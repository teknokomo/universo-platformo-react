import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const runnerPath = path.join(repoRoot, 'tools/testing/e2e/support/runCrossTemplateVerificationLocalSupabase.mjs')
const runLockPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock')
const dashboardArtifactsPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/dashboard-entity-backed')

async function readDirectoryNames(directory) {
    try {
        return (await fs.readdir(directory)).sort()
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
        throw error
    }
}

function runDashboardAcceptance(pathPrefix, markerPath) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [runnerPath, '--dashboard-acceptance'], {
            cwd: repoRoot,
            env: {
                ...process.env,
                PATH: `${pathPrefix}${path.delimiter}${process.env.PATH ?? ''}`,
                E2E_RUNNER_SUPABASE_MARKER: markerPath
            },
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let output = ''
        child.stdout.setEncoding('utf8').on('data', (chunk) => (output += chunk))
        child.stderr.setEncoding('utf8').on('data', (chunk) => (output += chunk))
        child.on('error', reject)
        child.on('close', (code, signal) => resolve({ code, signal, output }))
    })
}

test('Dashboard acceptance lock contention prevents Supabase and artifact side effects', async (t) => {
    if (process.platform === 'win32') {
        t.skip('The fake pnpm command uses a POSIX executable.')
        return
    }

    try {
        await fs.access(runLockPath)
        t.skip('A shared E2E run already owns the lock; avoid interfering with it.')
        return
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') throw error
    }

    const artifactsBefore = await readDirectoryNames(dashboardArtifactsPath)
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-acceptance-lock-'))
    const markerPath = path.join(tempDirectory, 'pnpm-invoked')
    const pnpmPath = path.join(tempDirectory, 'pnpm')
    await fs.writeFile(pnpmPath, `#!/bin/sh\nprintf invoked > '${markerPath}'\nexit 93\n`, { mode: 0o700 })

    let owner
    try {
        try {
            owner = await acquireE2eRunLock({ lockPath: runLockPath, metadata: { gate: 'dashboard-acceptance-lock-test' } })
        } catch (error) {
            if (error instanceof Error && error.message.includes('Another E2E run lock exists')) {
                t.skip('Another E2E run acquired the shared lock first; avoid interfering with it.')
                return
            }
            throw error
        }

        const ownerRecord = JSON.parse(await fs.readFile(runLockPath, 'utf8'))
        const result = await runDashboardAcceptance(tempDirectory, markerPath)

        assert.equal(result.signal, null)
        assert.notEqual(result.code, 0)
        assert.match(result.output, /Another E2E run lock exists at .*\(pid=.*active\)/u)
        await assert.rejects(fs.access(markerPath), { code: 'ENOENT' }, 'No pnpm or Supabase command may run during lock contention')
        assert.deepEqual(
            await readDirectoryNames(dashboardArtifactsPath),
            artifactsBefore,
            'Rejected contention must not write runner artifacts'
        )
        assert.deepEqual(JSON.parse(await fs.readFile(runLockPath, 'utf8')), ownerRecord, 'The active owner lock must remain unchanged')
    } finally {
        if (owner) await releaseE2eRunLock(owner)
        await fs.rm(tempDirectory, { recursive: true, force: true })
    }
})
