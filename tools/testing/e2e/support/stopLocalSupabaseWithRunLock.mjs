import path from 'node:path'
import { repoRoot } from './env/load-e2e-env.mjs'
import { withLocalSupabaseE2eEnv } from './env/localSupabaseE2eEnv.mjs'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'
import { createManagedE2eCommandRunner } from './managedE2eCommand.mjs'
import { stopSupabaseStackWithRunLock } from './stopSupabaseStackWithRunLock.mjs'

let processGroupUncertain = false
const commandRunner = createManagedE2eCommandRunner({
    cwd: repoRoot,
    onUncertainProcessGroup: (error) => {
        processGroupUncertain = true
        process.stderr.write(
            `E2E cleanup child process termination is uncertain: ${error instanceof Error ? error.message : String(error)}\n`
        )
    }
})

async function getLocalSupabaseState() {
    const status = await commandRunner.run('pnpm', ['supabase:e2e:status'], {
        captureOutput: true,
        env: withLocalSupabaseE2eEnv()
    })
    if (status.code === 0) return 'running'
    if (/No such container: supabase_db_[\w-]+/.test(status.output)) return 'stopped'
    throw new Error('Unable to confirm whether the minimal E2E Supabase stack is running; refusing CI cleanup')
}

try {
    await stopSupabaseStackWithRunLock({
        acquireLock: () =>
            acquireE2eRunLock({
                lockPath: path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock'),
                metadata: { gate: 'ci-local-supabase-cleanup' }
            }),
        releaseLock: releaseE2eRunLock,
        getStackState: getLocalSupabaseState,
        stopStack: () => commandRunner.run('pnpm', ['supabase:e2e:stop'], { env: withLocalSupabaseE2eEnv() }),
        canReleaseLock: () => !processGroupUncertain && !commandRunner.receivedSignal,
        onLockUnavailable: (error) => {
            process.stdout.write(
                `Skipping CI Supabase cleanup because the shared E2E run lock is unavailable: ${
                    error instanceof Error ? error.message : String(error)
                }\n`
            )
        },
        reportCleanupFailure: (error) => {
            process.stderr.write(`CI Supabase cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`)
            process.exitCode = 1
        }
    })
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    if (!commandRunner.receivedSignal) process.exitCode = 1
} finally {
    commandRunner.dispose()
}
