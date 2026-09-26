import fs from 'node:fs/promises'
import path from 'node:path'
import { repoRoot } from './env/load-e2e-env.mjs'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'
import { withLocalSupabaseE2eEnv } from './env/localSupabaseE2eEnv.mjs'
import { coordinateLocalSupabaseE2eGate } from './localSupabaseE2eGateCoordinator.mjs'
import { createManagedE2eCommandRunner } from './managedE2eCommand.mjs'

const localSupabaseEnv = withLocalSupabaseE2eEnv()
const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/marketing-page-authoring', artifactRunId)

let stackMayStillBeInUse = false
const commandRunner = createManagedE2eCommandRunner({
    cwd: repoRoot,
    onUncertainProcessGroup: (error) => {
        stackMayStillBeInUse = true
        process.stderr.write(`E2E child process termination is uncertain: ${error instanceof Error ? error.message : String(error)}\n`)
    }
})
const run = (command, args, options) => commandRunner.run(command, args, options)
const runPnpm = (args, options = {}) => run('pnpm', args, { ...options, env: withLocalSupabaseE2eEnv(options.env) })

async function preserveArtifacts({ status, error, includeSharedArtifacts }) {
    await fs.mkdir(artifactRoot, { recursive: true })
    if (includeSharedArtifacts) {
        for (const directory of ['test-results', 'playwright-report']) {
            const source = path.join(repoRoot, directory)
            try {
                await fs.cp(source, path.join(artifactRoot, directory), { recursive: true })
            } catch (error) {
                if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue
                throw error
            }
        }
    }
    await fs.writeFile(
        path.join(artifactRoot, 'status.json'),
        `${JSON.stringify(
            {
                gate: 'marketing-page-authoring-chromium',
                status,
                error: error ?? null,
                finishedAt: new Date().toISOString()
            },
            null,
            2
        )}\n`,
        'utf8'
    )
}

async function resetSharedArtifacts() {
    await Promise.all(
        ['test-results', 'playwright-report'].map((directory) => fs.rm(path.join(repoRoot, directory), { recursive: true, force: true }))
    )
}

async function getLocalSupabaseState({ afterStartFailure = false, allowAfterSignal = afterStartFailure } = {}) {
    const status = await runPnpm(['supabase:e2e:status'], { captureOutput: true, allowAfterSignal })
    if (status.code === 0) return 'running'
    if (/No such container: supabase_db_[\w-]+/.test(status.output)) return 'stopped'
    throw new Error('Unable to confirm whether the minimal E2E Supabase stack is running; inspect its local status before retrying')
}

try {
    await coordinateLocalSupabaseE2eGate({
        acquireLock: () =>
            acquireE2eRunLock({
                lockPath: path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock'),
                metadata: {
                    gate: 'marketing-page-authoring-chromium',
                    baseURL: localSupabaseEnv.E2E_BASE_URL
                }
            }),
        releaseLock: releaseE2eRunLock,
        resetArtifacts: resetSharedArtifacts,
        getStackState: getLocalSupabaseState,
        startStack: () => runPnpm(['supabase:e2e:start:minimal']),
        stopStack: () => runPnpm(['supabase:e2e:stop'], { allowAfterSignal: true }),
        prepare: async () => {
            await runPnpm(['env:e2e:local-supabase'])
            await runPnpm(['doctor:e2e:local-supabase'])
            await runPnpm(['build:e2e'], { env: localSupabaseEnv })
            await runPnpm(['check:marketing-page-template-contract'], { env: localSupabaseEnv })
        },
        runSuite: (lease, markSuiteStarted) =>
            run(
                process.execPath,
                [
                    'tools/testing/e2e/run-playwright-suite.mjs',
                    'tools/testing/e2e/specs/contracts/runtime-ux-oracles.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts',
                    '--project',
                    'chromium',
                    '--workers',
                    '1'
                ],
                {
                    env: withLocalSupabaseE2eEnv({
                        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: String(lease.ownerPid),
                        UNIVERSO_E2E_RUN_LOCK_TOKEN: lease.token
                    }),
                    onStarted: markSuiteStarted
                }
            ),
        preserveArtifacts,
        canReleaseLock: () => !stackMayStillBeInUse,
        reportCleanupFailure: (error) => {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Marketing page authoring cleanup failed: ${message}\n`)
            process.exitCode = 1
        }
    })
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    if (!commandRunner.receivedSignal) process.exitCode = 1
} finally {
    commandRunner.dispose()
}
