import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireE2eRunLock, releaseE2eRunLock } from '../testing/e2e/support/e2eRunLock.mjs'
import { withLocalSupabaseE2eEnv } from '../testing/e2e/support/env/localSupabaseE2eEnv.mjs'
import { coordinateLocalSupabaseE2eGate } from '../testing/e2e/support/localSupabaseE2eGateCoordinator.mjs'
import { createManagedE2eCommandRunner } from '../testing/e2e/support/managedE2eCommand.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const E2E_RUN_LOCK = path.join(ROOT, 'tools/testing/e2e/.artifacts/run.lock')
const MARKETING_SCREENSHOT_PROVENANCE = path.join(ROOT, 'tools/docs/marketing-page-screenshot-provenance.json')
const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(ROOT, 'tools/testing/e2e/.artifacts/marketing-page-docs', artifactRunId)
const LOCAL_SUPABASE_ENV = withLocalSupabaseE2eEnv()

let stackMayStillBeInUse = false
const commandRunner = createManagedE2eCommandRunner({
    cwd: ROOT,
    onUncertainProcessGroup: (error) => {
        stackMayStillBeInUse = true
        process.stderr.write(`E2E child process termination is uncertain: ${error instanceof Error ? error.message : String(error)}\n`)
    }
})
const runPnpm = (args, options = {}) => commandRunner.run('pnpm', args, { ...options, env: withLocalSupabaseE2eEnv(options.env) })

async function resetSharedArtifacts() {
    await Promise.all(
        ['test-results', 'playwright-report'].map((directory) => fs.rm(path.join(ROOT, directory), { recursive: true, force: true }))
    )
}

async function getLocalSupabaseState({ afterStartFailure = false, allowAfterSignal = afterStartFailure } = {}) {
    const status = await runPnpm(['supabase:e2e:status'], { captureOutput: true, allowAfterSignal })
    if (status.code === 0) return 'running'
    if (/No such container: supabase_db_[\w-]+/.test(status.output)) return 'stopped'
    throw new Error('Unable to confirm whether the minimal E2E Supabase stack is running; inspect its local status before retrying')
}

async function preserveArtifacts({ status, error, includeSharedArtifacts }) {
    await fs.mkdir(artifactRoot, { recursive: true })
    if (includeSharedArtifacts) {
        for (const directory of ['test-results', 'playwright-report']) {
            const source = path.join(ROOT, directory)
            try {
                await fs.cp(source, path.join(artifactRoot, directory), { recursive: true })
            } catch (copyError) {
                if (copyError && typeof copyError === 'object' && 'code' in copyError && copyError.code === 'ENOENT') continue
                throw copyError
            }
        }
    }
    await fs.writeFile(path.join(artifactRoot, 'status.json'), `${JSON.stringify({ status, error }, null, 2)}\n`, 'utf8')
}

try {
    await coordinateLocalSupabaseE2eGate({
        acquireLock: () =>
            acquireE2eRunLock({
                lockPath: E2E_RUN_LOCK,
                metadata: { gate: 'marketing-page-docs-screenshot-verification' }
            }),
        releaseLock: releaseE2eRunLock,
        resetArtifacts: resetSharedArtifacts,
        getStackState: getLocalSupabaseState,
        startStack: () => runPnpm(['supabase:e2e:start:minimal']),
        stopStack: () => runPnpm(['supabase:e2e:stop'], { allowAfterSignal: true }),
        prepare: async () => {
            await runPnpm(['env:e2e:local-supabase'])
            await runPnpm(['doctor:e2e:local-supabase'])
            await runPnpm(['build:e2e'], { env: LOCAL_SUPABASE_ENV })
        },
        runSuite: async (lease, markSuiteStarted) => {
            await runPnpm(['docs:marketing-page:screenshot:check'])
            const committedProvenance = JSON.parse(await fs.readFile(MARKETING_SCREENSHOT_PROVENANCE, 'utf8'))
            await commandRunner.run(
                process.execPath,
                [
                    'tools/testing/e2e/run-playwright-suite.mjs',
                    '--project',
                    'generators',
                    '--grep',
                    'marketing page GitBook screenshot generator'
                ],
                {
                    env: withLocalSupabaseE2eEnv({
                        UNIVERSO_E2E_RUN_LOCK_OWNER_PID: String(lease.ownerPid),
                        UNIVERSO_E2E_RUN_LOCK_TOKEN: lease.token
                    }),
                    onStarted: markSuiteStarted
                }
            )
            await runPnpm(['docs:marketing-page:screenshot:check'])
            const regeneratedProvenance = JSON.parse(await fs.readFile(MARKETING_SCREENSHOT_PROVENANCE, 'utf8'))
            delete committedProvenance.generatedAt
            delete regeneratedProvenance.generatedAt
            if (JSON.stringify(regeneratedProvenance) !== JSON.stringify(committedProvenance)) {
                throw new Error('Regenerated marketing-page screenshots differ from committed assets and provenance')
            }
            await runPnpm(['docs:i18n:check'])
            await runPnpm(['docs:gitbook-screenshot-assets:check'])
            await runPnpm(['exec', 'node', 'tools/docs/check-gitbook-links.mjs'])
        },
        preserveArtifacts,
        canReleaseLock: () => !stackMayStillBeInUse,
        reportCleanupFailure: (error) => {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Marketing-page docs verification cleanup failed: ${message}\n`)
            process.exitCode = 1
        }
    })
} finally {
    commandRunner.dispose()
}

if (process.exitCode === undefined || process.exitCode === 0) {
    process.stdout.write('Marketing-page docs screenshots and provenance verified on minimal local Supabase.\n')
}
