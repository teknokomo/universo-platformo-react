import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { createManagedE2eCommandRunner } from './managedE2eCommand.mjs'

async function processIsAlive(pid) {
    try {
        process.kill(pid, 0)
    } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ESRCH') return false
        throw error
    }

    if (process.platform === 'linux') {
        try {
            const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8')
            const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0]
            return state !== 'Z' && state !== 'X'
        } catch (error) {
            if (error && typeof error === 'object' && error.code === 'ENOENT') return false
            throw error
        }
    }

    return true
}

test('waits for detached command descendants before returning', { skip: process.platform === 'win32' }, async (t) => {
    const runner = createManagedE2eCommandRunner({ cwd: process.cwd() })
    t.after(() => runner.dispose())
    const startedAt = Date.now()

    await runner.run(process.execPath, [
        '-e',
        "const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 400)'], { stdio: 'ignore' }); process.exit(0)"
    ])

    assert.ok(Date.now() - startedAt >= 250, 'the parent command must wait until its child exits')
    assert.equal(runner.hasUncertainProcessGroup, false)
})

test('terminates and waits for the whole command group on shutdown', { skip: process.platform === 'win32' }, async (t) => {
    const runner = createManagedE2eCommandRunner({ cwd: process.cwd() })
    t.after(() => runner.dispose())
    let markStarted
    const childStarted = new Promise((resolve) => {
        markStarted = resolve
    })
    const command = runner.run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { onStarted: markStarted })
    await childStarted

    runner.requestShutdown('SIGTERM')
    await assert.rejects(command, /interrupted by SIGTERM/)
    assert.equal(runner.hasUncertainProcessGroup, false)
})

test(
    'escalates signal shutdown and waits for background descendants that ignore SIGTERM',
    { skip: process.platform === 'win32' },
    async (t) => {
        const runner = createManagedE2eCommandRunner({ cwd: process.cwd() })
        const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-e2e-signal-'))
        const childPidFile = path.join(temporaryDirectory, 'child-pid')
        t.after(() => runner.dispose())
        t.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }))
        let markStarted
        const childStarted = new Promise((resolve) => {
            markStarted = resolve
        })
        const stubbornChildScript = "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000)"
        const parentScript = [
            "const { spawn } = require('node:child_process')",
            "const fs = require('node:fs')",
            `const child = spawn(process.execPath, ['-e', ${JSON.stringify(
                stubbornChildScript
            )}], { stdio: ['ignore', 'pipe', 'ignore'] })`,
            `child.stdout.once('data', () => fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid)))`,
            "process.on('SIGTERM', () => {})",
            'setInterval(() => {}, 1000)'
        ].join(';')

        const command = runner.run(process.execPath, ['-e', parentScript], { onStarted: markStarted })
        await childStarted
        const childReadyDeadline = Date.now() + 5000
        let childPid
        while (Date.now() < childReadyDeadline) {
            try {
                childPid = Number(await fs.readFile(childPidFile, 'utf8'))
                break
            } catch (error) {
                if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
                await new Promise((resolve) => setTimeout(resolve, 20))
            }
        }
        assert.ok(Number.isInteger(childPid) && childPid > 0, 'the stubborn descendant must be ready before signaling')
        runner.requestShutdown('SIGTERM')

        await assert.rejects(command, /interrupted by SIGTERM/)
        assert.equal(runner.hasUncertainProcessGroup, false)
        assert.equal(await processIsAlive(childPid), false, 'the stubborn background child must not escape signal cleanup')
    }
)

test('terminates background descendants before rejecting a failed command', { skip: process.platform === 'win32' }, async (t) => {
    const runner = createManagedE2eCommandRunner({ cwd: process.cwd() })
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-e2e-command-'))
    const childPidFile = path.join(temporaryDirectory, 'child-pid')
    t.after(async () => {
        runner.dispose()
        await fs.rm(temporaryDirectory, { recursive: true, force: true })
    })

    const childScript = "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000)"
    const parentScript = [
        "const { spawn } = require('node:child_process')",
        "const fs = require('node:fs')",
        `const child = spawn(process.execPath, ['-e', ${JSON.stringify(childScript)}], { stdio: 'ignore' })`,
        `fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid))`,
        'process.exit(17)'
    ].join(';')

    await assert.rejects(runner.run(process.execPath, ['-e', parentScript]), /exit code 17/)
    const childPid = Number(await fs.readFile(childPidFile, 'utf8'))
    assert.ok(Number.isInteger(childPid) && childPid > 0)
    assert.equal(runner.hasUncertainProcessGroup, false)
    assert.equal(await processIsAlive(childPid), false, 'the background child must be gone before the failed command settles')
})
