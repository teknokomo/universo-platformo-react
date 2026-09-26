import fs from 'fs/promises'
import path from 'path'
import { repoRoot } from './env/load-e2e-env.mjs'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'
import { withLocalSupabaseE2eEnv } from './env/localSupabaseE2eEnv.mjs'
import { coordinateLocalSupabaseE2eGate } from './localSupabaseE2eGateCoordinator.mjs'
import { createManagedE2eCommandRunner } from './managedE2eCommand.mjs'

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

const localSupabaseEnv = withLocalSupabaseE2eEnv()

const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/marketing-page', artifactRunId)

async function preserveRunnerArtifacts(label) {
    await fs.mkdir(artifactRoot, { recursive: true })
    for (const directory of ['test-results', 'playwright-report']) {
        const source = path.join(repoRoot, directory)
        const target = path.join(artifactRoot, label, directory)
        try {
            await fs.cp(source, target, { recursive: true })
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue
            throw error
        }
    }
}

const collectPlaywrightTests = (suites, pathParts = [], collected = []) => {
    for (const suite of suites ?? []) {
        const nextPath = suite.title ? [...pathParts, suite.title] : pathParts
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                collected.push({
                    title: [...nextPath, spec.title].filter(Boolean).join(' > '),
                    projectName: test.projectName ?? test.projectId ?? 'unknown',
                    expectedStatus: test.expectedStatus ?? 'unknown',
                    annotations: test.annotations ?? [],
                    results: test.results ?? []
                })
            }
        }
        collectPlaywrightTests(suite.suites, nextPath, collected)
    }
    return collected
}

async function summarizePlaywrightResults(label) {
    const resultsPath = path.join(repoRoot, 'test-results/playwright-results.json')
    const raw = await fs.readFile(resultsPath, 'utf8')
    const report = JSON.parse(raw)
    const tests = collectPlaywrightTests(report.suites)
    const summarized = tests.map((test) => {
        const finalResult = test.results.at(-1)
        return {
            title: test.title,
            projectName: test.projectName,
            expectedStatus: test.expectedStatus,
            finalStatus: finalResult?.status ?? 'not-run',
            attempts: test.results.length,
            retriesUsed: test.results.filter((result) => Number(result.retry ?? 0) > 0).length,
            annotations: test.annotations
        }
    })
    const skipped = summarized.filter((test) => test.finalStatus === 'skipped')
    const retried = summarized.filter((test) => test.attempts > 1 || test.retriesUsed > 0)
    const unexpected = summarized.filter(
        (test) => !['passed', 'skipped'].includes(test.finalStatus) || (test.expectedStatus !== 'passed' && test.finalStatus !== 'skipped')
    )
    const summary = {
        label,
        generatedAt: new Date().toISOString(),
        total: summarized.length,
        skipped,
        retried,
        unexpected,
        tests: summarized
    }
    const summaryPath = path.join(artifactRoot, label, 'playwright-outcomes.json')
    await fs.mkdir(path.dirname(summaryPath), { recursive: true })
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

    process.stdout.write(
        `[marketing-page-verify] ${label}: tests=${summary.total}, skipped=${skipped.length}, retried=${retried.length}, unexpected=${unexpected.length}\n`
    )
    for (const test of skipped) {
        const reason = test.annotations.find((annotation) => annotation.type === 'skip')?.description ?? 'no skip reason reported'
        process.stdout.write(`[marketing-page-verify] SKIP ${test.projectName}: ${test.title} — ${reason}\n`)
    }
    for (const test of retried) {
        process.stdout.write(
            `[marketing-page-verify] RETRY ${test.projectName}: ${test.title} — attempts=${test.attempts}, retries=${test.retriesUsed}\n`
        )
    }
}

async function runPlaywrightBatch(label, args, lockLease, markSuiteStarted) {
    await resetSharedArtifacts()
    let commandError = null
    let suiteProcessStarted = false
    try {
        await run(process.execPath, args, {
            env: withLocalSupabaseE2eEnv({
                UNIVERSO_E2E_RUN_LOCK_OWNER_PID: String(lockLease.ownerPid),
                UNIVERSO_E2E_RUN_LOCK_TOKEN: lockLease.token
            }),
            onStarted: () => {
                suiteProcessStarted = true
                markSuiteStarted()
            }
        })
    } catch (error) {
        commandError = error
    }

    if (!suiteProcessStarted) {
        if (commandError) throw commandError
        throw new Error(`The ${label} Playwright suite did not start`)
    }

    try {
        await summarizePlaywrightResults(label)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[marketing-page-verify] Unable to summarize ${label} Playwright outcomes: ${message}\n`)
    }
    await preserveRunnerArtifacts(label)

    if (commandError) throw commandError
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
                metadata: { gate: 'marketing-page-full-verification' }
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
        runSuite: async (lockLease, markSuiteStarted) => {
            await runPlaywrightBatch(
                'chromium',
                [
                    'tools/testing/e2e/run-playwright-suite.mjs',
                    'tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts',
                    'tools/testing/e2e/specs/flows/application-aliases.spec.ts',
                    'tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts',
                    'tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts',
                    'tools/testing/e2e/specs/flows/cross-template-concurrency.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-binding-concurrency.spec.ts',
                    'tools/testing/e2e/specs/flows/metahub-global-entity-layouts.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-workspace-management.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-widget-lifecycle.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts',
                    'tools/testing/e2e/specs/flows/application-layout-management.spec.ts',
                    'tools/testing/e2e/specs/flows/marketing-page-standalone-runtime.spec.ts',
                    '--project',
                    'chromium'
                ],
                lockLease,
                markSuiteStarted
            )

            await runPlaywrightBatch(
                'matrix',
                [
                    'tools/testing/e2e/run-playwright-suite.mjs',
                    'tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts',
                    '--project',
                    'ru-light',
                    '--project',
                    'ru-dark',
                    '--project',
                    'en-light',
                    '--project',
                    'en-dark',
                    '--workers',
                    '1',
                    '--retries',
                    '2',
                    '--grep',
                    '@marketing-page'
                ],
                lockLease,
                markSuiteStarted
            )

            await runPnpm(['docs:marketing-page:screenshot:check'])
            await runPnpm(['docs:i18n:check'])
            await runPnpm(['docs:gitbook-screenshot-assets:check'])
            await runPnpm(['exec', 'node', 'tools/docs/check-gitbook-links.mjs'])
        },
        preserveArtifacts: async ({ status, error }) => {
            const statusPath = path.join(artifactRoot, 'gate-status.json')
            await fs.mkdir(artifactRoot, { recursive: true })
            await fs.writeFile(
                statusPath,
                `${JSON.stringify({ gate: 'marketing-page-full-verification', status, error }, null, 2)}\n`,
                'utf8'
            )
        },
        canReleaseLock: () => !stackMayStillBeInUse,
        reportCleanupFailure: (error) => {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Marketing-page verification cleanup failed: ${message}\n`)
            process.exitCode = 1
        }
    })
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    if (!commandRunner.receivedSignal) process.exitCode = 1
} finally {
    commandRunner.dispose()
}
