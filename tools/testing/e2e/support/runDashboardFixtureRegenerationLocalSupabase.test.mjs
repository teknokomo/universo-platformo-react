import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const fixtureDirectory = path.join(repoRoot, 'tools/fixtures')
const fixtureGate = path.join(repoRoot, 'tools/testing/e2e/support/runDashboardFixtureRegenerationLocalSupabase.mjs')
const runLockPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock')

async function captureDirectory(directory) {
    const entries = new Map()
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            for (const [nestedPath, digest] of await captureDirectory(absolutePath)) {
                entries.set(path.join(entry.name, nestedPath), digest)
            }
        } else if (entry.isFile()) {
            const digest = createHash('sha256')
                .update(await fs.readFile(absolutePath))
                .digest('hex')
            entries.set(entry.name, digest)
        }
    }
    return entries
}

function runFixtureGate(pathPrefix) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fixtureGate], {
            cwd: repoRoot,
            env: { ...process.env, PATH: `${pathPrefix}${path.delimiter}${process.env.PATH ?? ''}` },
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let output = ''
        child.stdout.setEncoding('utf8').on('data', (chunk) => (output += chunk))
        child.stderr.setEncoding('utf8').on('data', (chunk) => (output += chunk))
        child.on('error', reject)
        child.on('close', (code, signal) => resolve({ code, signal, output }))
    })
}

test('Dashboard fixture gate lock contention has no Supabase or fixture side effects', async (t) => {
    if (process.platform === 'win32') {
        t.skip('The pnpm shim assertion uses a POSIX executable.')
        return
    }
    try {
        await fs.access(runLockPath)
        t.skip('A shared E2E run already owns the lock; avoid interfering with it.')
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }

    const fixtureStateBefore = await captureDirectory(fixtureDirectory)
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-fixture-lock-'))
    const markerPath = path.join(tempDirectory, 'pnpm-invoked')
    const pnpmPath = path.join(tempDirectory, 'pnpm')
    await fs.writeFile(pnpmPath, `#!/bin/sh\nprintf invoked > '${markerPath}'\nexit 93\n`, { mode: 0o700 })

    let owner
    try {
        owner = await acquireE2eRunLock({ lockPath: runLockPath, metadata: { gate: 'fixture-lock-test' } })
        const result = await runFixtureGate(tempDirectory)
        assert.equal(result.signal, null)
        assert.notEqual(result.code, 0)
        assert.match(result.output, /Another E2E run lock exists/u)
        await assert.rejects(fs.access(markerPath), { code: 'ENOENT' }, 'Supabase commands must not be started')
        assert.deepEqual(await captureDirectory(fixtureDirectory), fixtureStateBefore, 'Fixtures must remain untouched')
        const lockRecord = JSON.parse(await fs.readFile(runLockPath, 'utf8'))
        assert.equal(lockRecord.pid, owner.ownerPid)
        assert.equal(lockRecord.token, owner.token)
    } finally {
        if (owner) await releaseE2eRunLock(owner)
        await fs.rm(tempDirectory, { recursive: true, force: true })
    }
})
