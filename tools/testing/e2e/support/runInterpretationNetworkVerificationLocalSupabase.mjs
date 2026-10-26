import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { acquireE2eRunLock, releaseE2eRunLock, withE2eRunLockDelegation } from './e2eRunLock.mjs'
import { withLocalSupabaseE2eEnv } from './env/localSupabaseE2eEnv.mjs'
import { repoRoot } from './env/load-e2e-env.mjs'
import { coordinateLocalSupabaseE2eGate } from './localSupabaseE2eGateCoordinator.mjs'
import { createManagedE2eCommandRunner } from './managedE2eCommand.mjs'
import {
    assertPlaywrightScenarioGate,
    collectPlaywrightTests,
    expectedScreenshotDimensions,
    readPngAttachmentDimensions
} from './playwrightResults.mjs'
import { preserveInterpretationNetworkPlaywrightRun } from './interpretationNetworkVerificationArtifacts.mjs'
import { loadLocalSupabaseDatabaseUrl } from '../../backend/localSupabaseEnv.mjs'
import {
    createSafeInterpretationNetworkPostgresEvidence,
    inspectInterpretationNetworkPostgresResults
} from '../../backend/interpretationNetworkPostgresResults.mjs'

const localSupabaseEnv = withLocalSupabaseE2eEnv({
    UNIVERSO_ENV_FILE: '.env.e2e.local-supabase',
    UNIVERSO_FRONTEND_ENV_FILE: 'packages/universo-react-core-frontend/.env.e2e.local-supabase'
})

const generatedFixturePath = 'tools/testing/e2e/.artifacts/generated-metahubs-interpretation-network-app-snapshot.json'
const generatedFixtureEnv = {
    ...localSupabaseEnv,
    INTERPRETATION_NETWORK_FIXTURE_PATH: generatedFixturePath
}

const coreFlowRequiredTitles = [
    'flows/interpretation-network-advanced-regressions-focused.spec.ts > Interpretation Network advanced workspace regressions @flow @interpretation-network-focused > saves only the selected branch as a template',
    'flows/interpretation-network-advanced-regressions-focused.spec.ts > Interpretation Network advanced workspace regressions @flow @interpretation-network-focused > opens the selected cell primary material first and returns to its full list',
    'flows/interpretation-network-advanced-regressions-focused.spec.ts > Interpretation Network advanced workspace regressions @flow @interpretation-network-focused > isolates Favorites by user and workspace and keeps the populated grid responsive',
    'flows/interpretation-network-app-imported-snapshot.spec.ts > Interpretation Network imported snapshot @flow > imported interpretation-network snapshot renders the interpretation workspace',
    'flows/interpretation-network-browser-navigation-focused.spec.ts > Interpretation Network browser gap coverage @flow @interpretation-network-focused > removes an unavailable Favorite through the Russian interface without exposing its UUID',
    'flows/interpretation-network-browser-navigation-focused.spec.ts > Interpretation Network browser gap coverage @flow @interpretation-network-focused > saves and inserts the selected branch across viewports and in Russian without changing its source',
    'flows/interpretation-network-cell-style-policy-focused.spec.ts > Interpretation Network browser gap coverage @flow @interpretation-network-focused > applies Metahub default, Application override, and delegated Workspace cell-style policies',
    'flows/interpretation-network-primary-material-focused.spec.ts > Interpretation Network browser gap coverage @flow @interpretation-network-focused > replaces, clears, and deletes the Primary Material with visible list transitions',
    'flows/interpretation-network-child-cell-focused.spec.ts > Interpretation Network imported snapshot child cell @flow @interpretation-network-focused > creates a Russian child Matrix cell when placement controls are hidden',
    'flows/interpretation-network-permissions-focused.spec.ts > Interpretation Network role boundaries @flow @permission @interpretation-network-focused > allows owner and editor Matrix creation, keeps members read-only, and rejects guessed IDs directly',
    'flows/interpretation-network-public-runtime.spec.ts > Interpretation Network public runtime lifecycle > @flow setup anonymous multiple-mode viewer and distinct single-system role fixture',
    'flows/interpretation-network-public-runtime.spec.ts > Interpretation Network public runtime lifecycle > @flow authorized member CRUD through canonical alias',
    'flows/interpretation-network-public-runtime.spec.ts > Interpretation Network public runtime lifecycle > @flow application member remains read-only through canonical alias',
    'flows/interpretation-network-public-runtime.spec.ts > Interpretation Network public runtime lifecycle > @flow authenticated non-member receives public read-only access only',
    'flows/interpretation-network-public-runtime.spec.ts > Interpretation Network public runtime lifecycle > @flow public alias routing, UUID routing, and revocation',
    'flows/interpretation-network-single-system-focused.spec.ts > Interpretation Network single-system navigation @flow @interpretation-network-focused > opens the Matrix through a canonical direct route and survives reload and browser history',
    'flows/interpretation-network-templates-focused.spec.ts > Interpretation Network template lifecycle @flow @interpretation-network-focused > copies structure-only and material templates with fresh IDs and immutable sources',
    'visual/interpretation-network-workspace.spec.ts > Interpretation Network workspace @visual > captures the interpretation workspace baseline'
]

const coreFlowRequiredScreenshotAttachments = {
    [coreFlowRequiredTitles[0]]: [
        'interpretation-network-selected-branch-template-dialog-tablet-768x1024',
        'interpretation-network-selected-branch-template-dialog-mobile-390x844'
    ],
    [coreFlowRequiredTitles[2]]: [
        'interpretation-network-favorites-list-mobile-390x844',
        'interpretation-network-favorites-list-tablet-768x1024',
        'interpretation-network-favorites-list-wide-desktop-1920x1080',
        'interpretation-network-favorites-list-scroll-bottom-mobile-390x844'
    ],
    [coreFlowRequiredTitles[4]]: ['interpretation-network-unavailable-favorite-removed-mobile-390x844'],
    [coreFlowRequiredTitles[5]]: [
        'interpretation-network-apply-template-to-existing-cell-wide-desktop-1920x1080',
        'interpretation-network-apply-template-to-existing-cell-tablet-768x1024',
        'interpretation-network-apply-template-to-existing-cell-mobile-390x844',
        'interpretation-network-template-inserted-below-existing-cell-wide-desktop-1920x1080',
        'interpretation-network-template-inserted-below-existing-cell-tablet-768x1024',
        'interpretation-network-template-inserted-below-existing-cell-mobile-390x844',
        'interpretation-network-russian-template-inserted-wide-desktop-1920x1080',
        'interpretation-network-russian-template-inserted-tablet-768x1024',
        'interpretation-network-russian-template-inserted-mobile-390x844'
    ],
    [coreFlowRequiredTitles[6]]: [
        'interpretation-network-style-policy-metahub-default-1280x900',
        'interpretation-network-style-policy-application-settings-390x844',
        'interpretation-network-style-policy-application-override-1280x900',
        'interpretation-network-style-policy-workspace-override-390x844',
        'interpretation-network-style-policy-workspace-override-ru-1280x900'
    ],
    [coreFlowRequiredTitles[7]]: [
        'interpretation-network-primary-material-replaced-1280x900',
        'interpretation-network-primary-material-cleared-1280x900',
        'interpretation-network-primary-material-detail-390x844',
        'interpretation-network-primary-material-deleted-390x844'
    ],
    [coreFlowRequiredTitles[10]]: [
        'interpretation-network-public-no-workspaces-en-wide-desktop',
        'interpretation-network-public-no-workspaces-en-tablet',
        'interpretation-network-public-no-workspaces-en-mobile',
        'interpretation-network-public-no-workspaces-ru-mobile',
        'interpretation-network-public-anonymous-matrix-mobile',
        'interpretation-network-public-primary-material-mobile'
    ],
    [coreFlowRequiredTitles[11]]: [
        'interpretation-network-member-edit-cell-dialog-mobile',
        'interpretation-network-public-member-matrix-mobile'
    ],
    [coreFlowRequiredTitles[12]]: ['interpretation-network-public-member-read-only-mobile']
}

const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/interpretation-network-verification', artifactRunId)
const e2eRunLockPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock')
const gateManifest = {
    runId: artifactRunId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    playwrightRuns: []
}

const writeGateManifest = async () => {
    await fs.mkdir(artifactRoot, { recursive: true })
    await fs.writeFile(path.join(artifactRoot, 'manifest.json'), `${JSON.stringify(gateManifest, null, 2)}\n`, 'utf8')
}

let lockLease = null
let stackMayStillBeInUse = false
const commandRunner = createManagedE2eCommandRunner({
    cwd: repoRoot,
    onUncertainProcessGroup: (error) => {
        stackMayStillBeInUse = true
        process.stderr.write(`E2E child process termination is uncertain: ${error instanceof Error ? error.message : String(error)}\n`)
    }
})
const run = (args, options = {}) => {
    const { passRunLock = false, ...runnerOptions } = options
    const runnerEnv = withE2eRunLockDelegation({ ...localSupabaseEnv, ...runnerOptions.env }, passRunLock ? lockLease : null)
    return commandRunner.run('pnpm', args, {
        ...runnerOptions,
        env: withLocalSupabaseE2eEnv(runnerEnv)
    })
}

const runPlaywright = async (label, args, options = {}, markSuiteStarted = () => {}) => {
    const startedAt = new Date().toISOString()
    let commandError = null
    try {
        await run(args, { env: options.env, onStarted: markSuiteStarted, passRunLock: true })
    } catch (error) {
        commandError = error
    }

    let evidence = null
    try {
        evidence = await preserveInterpretationNetworkPlaywrightRun({
            repoRoot: process.cwd(),
            artifactRoot,
            label,
            command: ['pnpm', ...args],
            project: options.project ?? (args.includes('--project') ? args[args.indexOf('--project') + 1] : 'default'),
            startedAt,
            finishedAt: new Date().toISOString(),
            status: commandError ? 'failed' : 'passed'
        })
        gateManifest.playwrightRuns.push(evidence)
        await writeGateManifest()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[interpretation-network-verify] Unable to preserve ${label} Playwright evidence: ${message}\n`)
        if (!commandError) commandError = error
    }

    if (commandError) throw commandError
    if (!evidence?.reportAvailable || evidence.summary.total === 0) {
        throw new Error(`The ${label} Playwright run completed without a machine-readable report containing tests`)
    }
}

const assertAcceptanceRan = async (project, requiredTitle, requiredScreenshotNames = []) => {
    const report = JSON.parse(await fs.readFile('test-results/playwright-results.json', 'utf8'))
    const selected = collectPlaywrightTests(report.suites).filter((test) => test.projectName === project && test.title === requiredTitle)
    if (selected.length !== 1) {
        throw new Error(`The ${project} project expected exactly one acceptance test titled "${requiredTitle}", found ${selected.length}`)
    }
    const [scenario] = selected
    const statuses = scenario.results.map((result) => result.status)
    if (scenario.expectedStatus !== 'passed' || statuses.length === 0 || statuses.some((status) => status !== 'passed')) {
        throw new Error(
            `The ${project} acceptance test "${requiredTitle}" did not pass on every attempt; expected=${
                scenario.expectedStatus
            }, attempts=${statuses.join(',') || 'none'}`
        )
    }
    const attachments = scenario.results.flatMap((result) => result.attachments ?? [])
    for (const name of requiredScreenshotNames) {
        const screenshot = attachments.find((attachment) => attachment.name === name && attachment.contentType === 'image/png')
        if (!screenshot) throw new Error(`The ${project} acceptance test "${requiredTitle}" missed required PNG "${name}"`)
        const dimensions = readPngAttachmentDimensions(screenshot)
        if (!dimensions) throw new Error(`The ${project} acceptance test "${requiredTitle}" attached an invalid PNG "${name}"`)
        const expected = expectedScreenshotDimensions(name)
        if (expected && (dimensions.width !== expected.width || dimensions.height < expected.height)) {
            throw new Error(
                `The ${project} acceptance test PNG "${name}" must be ${expected.width}px wide and at least ${expected.height}px tall; found ${dimensions.width}x${dimensions.height}`
            )
        }
    }
    process.stdout.write(`${requiredTitle} passed for ${project}.\n`)
}

const assertCoreFlowsPassed = async () => {
    const report = JSON.parse(await fs.readFile('test-results/playwright-results.json', 'utf8'))
    const result = assertPlaywrightScenarioGate(report.suites, {
        projectName: 'chromium',
        requiredTitles: coreFlowRequiredTitles,
        requiredScreenshotAttachments: coreFlowRequiredScreenshotAttachments
    })
    process.stdout.write(`${result.passedRequiredScenarios} exact core-flow scenarios passed for ${result.projectName}.\n`)
}

const integrationSuitePaths = [
    'src/tests/persistence/interpretationNetworkWorkspaceSettings.integration.test.ts',
    'src/tests/persistence/interpretationNetworkWorkspaceSettingsSchema.integration.test.ts',
    'src/tests/persistence/runtimeWorkspaceCopy.integration.test.ts',
    'src/tests/persistence/publicInterpretationNetworkRuntimeStore.integration.test.ts',
    'src/tests/persistence/interpretationNetworkFavoriteLocking.integration.test.ts'
]

const compactDiagnostic = (value, secrets = []) => {
    let text = typeof value === 'string' ? value : value?.message ?? JSON.stringify(value)
    text = text.replace(/\s+/g, ' ').trim()
    text = text.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '[redacted PostgreSQL URL]')
    for (const secret of secrets) {
        if (secret) text = text.replaceAll(secret, '[redacted]')
    }
    return text.slice(0, 360)
}

const runPostgresIntegrationWithDiagnostics = async () => {
    const { databaseEnv, databaseUrl } = loadLocalSupabaseDatabaseUrl()
    const secrets = [databaseUrl, databaseEnv.DATABASE_PASSWORD, encodeURIComponent(databaseEnv.DATABASE_PASSWORD)]
    const migrations = await run(['exec', 'node', 'tools/testing/backend/ensure-platform-migrations.mjs'], {
        captureOutput: true,
        env: { ...databaseEnv, DATABASE_TEST_URL: databaseUrl }
    })
    if (migrations.code !== 0) {
        const diagnostic = compactDiagnostic(migrations.output, secrets)
        throw new Error(
            `Platform migrations could not be applied; the Interpretation Network PostgreSQL suite was not run.${
                diagnostic ? ` ${diagnostic}` : ''
            }`
        )
    }

    const resultDirectory = path.join(artifactRoot, 'postgres-integration')
    await fs.mkdir(resultDirectory, { recursive: true })
    const temporaryResultDirectory = await fs.mkdtemp(path.join(tmpdir(), 'universo-interpretation-network-jest-'))
    const resultsPath = path.join(temporaryResultDirectory, 'jest-results.json')

    try {
        const commandResult = await run(
            [
                '--filter',
                '@universo-react/applications-backend',
                'exec',
                'node',
                '../../tools/testing/backend/run-jest.cjs',
                '--config',
                './jest.config.js',
                '--runInBand',
                '--json',
                `--outputFile=${resultsPath}`,
                ...integrationSuitePaths
            ],
            {
                captureOutput: true,
                env: {
                    DATABASE_TEST_URL: databaseUrl,
                    REQUIRE_DATABASE_TESTS: '1'
                }
            }
        )
        const exitCode = commandResult.code
        const commandOutput = commandResult.output.slice(-12_000)

        let results
        try {
            results = JSON.parse(await fs.readFile(resultsPath, 'utf8'))
        } catch {
            const output = compactDiagnostic(commandOutput, secrets)
            const outputDiagnostic = output ? `; runtime output: ${output}` : ''
            throw new Error(`Jest did not produce a result file for the required PostgreSQL integration suite${outputDiagnostic}`)
        }

        const safeEvidence = createSafeInterpretationNetworkPostgresEvidence({ results, suitePaths: integrationSuitePaths })
        await fs.writeFile(path.join(resultDirectory, 'jest-results.json'), `${JSON.stringify(safeEvidence, null, 2)}\n`, 'utf8')

        const total = Number(results.numTotalTests ?? 0)
        const passed = Number(results.numPassedTests ?? 0)
        const pending = Number(results.numPendingTests ?? 0)
        const failedCount = Number(results.numFailedTests ?? 0)
        const suiteResults = Array.isArray(results.testResults) ? results.testResults : []
        const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths: integrationSuitePaths, exitCode })
        const suiteDiagnostics = suiteResults.map((suite) => {
            const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : []
            const assertionPassed = assertions.filter((assertion) => assertion.status === 'passed').length
            const assertionPending = assertions.filter((assertion) => ['pending', 'todo'].includes(assertion.status)).length
            const assertionFailed = assertions.filter((assertion) => assertion.status === 'failed').length
            const suiteName = path.basename(String(suite.name ?? 'unknown suite'))
            const messages = [
                suite.failureMessage,
                suite.message,
                suite.testExecError?.message,
                ...assertions.flatMap((assertion) => (assertion.status === 'failed' ? assertion.failureMessages ?? [] : []))
            ]
                .filter(Boolean)
                .map((message) => compactDiagnostic(message, secrets))
            const runtimeError = suite.testExecError ? `; runtime error: ${compactDiagnostic(suite.testExecError, secrets)}` : ''
            const failureMessage = messages.length > 0 ? `; failure: ${messages[0]}` : ''
            const counts = `tests=${assertions.length}, passed=${assertionPassed}, pending=${assertionPending}, failed=${assertionFailed}`
            return `- ${suiteName}: ${suite.status ?? 'unknown'} (${counts})${runtimeError}${failureMessage}`
        })

        const missingSuites = integrationSuitePaths.filter(
            (suitePath) => !suiteResults.some((result) => String(result.name ?? '').endsWith(suitePath))
        )
        const failedSuites = suiteResults.filter((suite) => {
            const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : []
            return (
                suite.status !== 'passed' ||
                assertions.length === 0 ||
                assertions.some((assertion) => assertion.status !== 'passed') ||
                Boolean(suite.testExecError)
            )
        })

        if (
            exitCode !== 0 ||
            total === 0 ||
            passed === 0 ||
            pending > 0 ||
            failedCount > 0 ||
            results.success !== true ||
            missingSuites.length > 0 ||
            failedSuites.length > 0 ||
            !validation.ok
        ) {
            const output = compactDiagnostic(commandOutput, secrets)
            const summaryMetrics = `total=${total}, passed=${passed}, pending=${pending}, failed=${failedCount}, success=${
                results.success
            }, runtimeErrorSuites=${results.numRuntimeErrorTestSuites ?? 0}, exitCode=${exitCode}`
            const failureSummary = `Required PostgreSQL integration suite did not fully pass (${summaryMetrics}).`
            const diagnostics = [
                failureSummary,
                ...validation.errors.map((message) => `- ${message}`),
                ...suiteDiagnostics,
                ...missingSuites.map((suitePath) => `- missing suite result: ${suitePath}`),
                ...(output ? [`- runtime output: ${output}`] : [])
            ]
            throw new Error(diagnostics.join('\n'))
        }

        process.stdout.write(
            `Interpretation Network PostgreSQL integration passed: ${validation.passedCases} non-skipped cases, 0 skipped.\n`
        )
    } finally {
        await fs.rm(temporaryResultDirectory, { recursive: true, force: true })
    }
}

const prepareVerification = async () => {
    await run([
        'exec',
        'node',
        '--test',
        'tools/testing/backend/interpretationNetworkPostgresResults.test.mjs',
        'tools/testing/e2e/support/playwrightResults.test.mjs',
        'tools/testing/e2e/support/interpretationNetworkVerificationArtifacts.test.mjs'
    ])
    await run(['check:runtime-support-cycles'])
    await run(['test:interpretation-network-ui-primitives'])
    await run(['test:interpretation-network-unit'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
}

const runVerificationSuite = async (markSuiteStarted) => {
    await runPlaywright(
        'runtime-ux-oracles',
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'specs/contracts/runtime-ux-oracles.spec.ts',
            '--project',
            'en-light'
        ],
        { env: localSupabaseEnv },
        markSuiteStarted
    )
    await assertAcceptanceRan(
        'en-light',
        'contracts/runtime-ux-oracles.spec.ts > runtime UX oracles inspect visible control values and compact structured cells'
    )
    await runPlaywright(
        'fixture-regeneration',
        ['test:e2e:interpretation-network-fixture-generator'],
        {
            project: 'generators',
            env: {
                ...localSupabaseEnv,
                INTERPRETATION_NETWORK_FIXTURE_OUTPUT_PATH: generatedFixturePath
            }
        },
        markSuiteStarted
    )
    await assertAcceptanceRan(
        'generators',
        'generators/metahubs-interpretation-network-app-export.spec.ts > Metahubs Interpretation Network App Export > @generator create canonical interpretation-network metahub and export snapshot fixture'
    )
    await run(['check:interpretation-network-fixture-contract'], { env: generatedFixtureEnv })
    await run(['check:interpretation-network-fixture-drift', '--', generatedFixturePath])
    await runPlaywright(
        'core-flows',
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'specs/flows/interpretation-network-single-system-focused.spec.ts',
            'specs/flows/interpretation-network-templates-focused.spec.ts',
            'specs/flows/interpretation-network-permissions-focused.spec.ts',
            'specs/flows/interpretation-network-child-cell-focused.spec.ts',
            'specs/flows/interpretation-network-app-imported-snapshot.spec.ts',
            'specs/flows/interpretation-network-public-runtime.spec.ts',
            'specs/flows/interpretation-network-advanced-regressions-focused.spec.ts',
            'specs/flows/interpretation-network-browser-navigation-focused.spec.ts',
            'specs/flows/interpretation-network-cell-style-policy-focused.spec.ts',
            'specs/flows/interpretation-network-primary-material-focused.spec.ts',
            'specs/visual/interpretation-network-workspace.spec.ts'
        ],
        {
            env: generatedFixtureEnv
        },
        markSuiteStarted
    )
    await assertCoreFlowsPassed()
    await runPostgresIntegrationWithDiagnostics()
    for (const project of ['en-light', 'ru-light']) {
        await runPlaywright(
            `locale-${project}`,
            [
                'exec',
                'node',
                'tools/testing/e2e/run-playwright-suite.mjs',
                'specs/matrix/interpretation-network-public-locale-acceptance.spec.ts',
                'specs/matrix/interpretation-network-localized-validation-acceptance.spec.ts',
                '--project',
                project
            ],
            {
                env: generatedFixtureEnv
            },
            markSuiteStarted
        )
        const locale = project === 'ru-light' ? 'ru' : 'en'
        await assertAcceptanceRan(
            project,
            'matrix/interpretation-network-public-locale-acceptance.spec.ts > @matrix Interpretation Network locale acceptance proves public anonymous read-only behavior'
        )
        await assertAcceptanceRan(
            project,
            'matrix/interpretation-network-localized-validation-acceptance.spec.ts > @matrix @interpretation-network Interpretation Network editable cell validation is localized',
            [
                `interpretation-network-localized-validation-${locale}-wide-desktop-1920x1080`,
                `interpretation-network-localized-validation-${locale}-tablet-768x1024`,
                `interpretation-network-localized-validation-${locale}-mobile-390x844`
            ]
        )
    }
    await runPlaywright(
        'gitbook-screenshots',
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            '--project',
            'generators',
            '--grep',
            'interpretation network gitbook screenshots'
        ],
        {
            env: generatedFixtureEnv
        },
        markSuiteStarted
    )
    await run(['docs:i18n:check'])
    await run(['exec', 'node', 'tools/docs/check-gitbook-links.mjs'])
    await run(['docs:gitbook-screenshot-assets:check'])
    await run(['docs:interpretation-network:check'])
    await run(['docs:interpretation-network:drift:check'])
}

const resetSharedArtifacts = async () =>
    Promise.all(
        ['test-results', 'playwright-report'].map((directory) => fs.rm(path.join(repoRoot, directory), { recursive: true, force: true }))
    )

const getLocalSupabaseState = async ({ afterStartFailure = false, allowAfterSignal = afterStartFailure } = {}) => {
    const status = await run(['supabase:e2e:status'], { captureOutput: true, allowAfterSignal })
    if (status.code === 0) return 'running'
    if (/No such container: supabase_db_[\w-]+/.test(status.output)) return 'stopped'
    throw new Error('Unable to confirm whether the minimal E2E Supabase stack is running; inspect its local status before retrying')
}

const runQuietly = async (args, options = {}) => {
    const result = await run(args, { ...options, captureOutput: true })
    if (result.code !== 0) throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.code}`)
}

const preserveGateArtifacts = async ({ status, error, includeSharedArtifacts }) => {
    if (includeSharedArtifacts) {
        for (const directory of ['test-results', 'playwright-report']) {
            const source = path.join(repoRoot, directory)
            try {
                await fs.cp(source, path.join(artifactRoot, directory), { recursive: true })
            } catch (copyError) {
                if (copyError && typeof copyError === 'object' && 'code' in copyError && copyError.code === 'ENOENT') continue
                throw copyError
            }
        }
    }
    gateManifest.status = status
    gateManifest.error = error ? compactDiagnostic(error) : null
    gateManifest.completedAt = new Date().toISOString()
    await writeGateManifest()
}

try {
    await coordinateLocalSupabaseE2eGate({
        acquireLock: async () => {
            lockLease = await acquireE2eRunLock({
                lockPath: e2eRunLockPath,
                metadata: { gate: 'interpretation-network-full-verification', baseURL: localSupabaseEnv.E2E_BASE_URL }
            })
            return lockLease
        },
        releaseLock: releaseE2eRunLock,
        resetArtifacts: resetSharedArtifacts,
        getStackState: getLocalSupabaseState,
        startStack: () => runQuietly(['supabase:e2e:start:minimal']),
        stopStack: () => runQuietly(['supabase:e2e:stop'], { allowAfterSignal: true }),
        prepare: prepareVerification,
        runSuite: async (lease, markSuiteStarted) => {
            lockLease = lease
            await runVerificationSuite(markSuiteStarted)
        },
        preserveArtifacts: preserveGateArtifacts,
        canReleaseLock: () => !stackMayStillBeInUse,
        reportCleanupFailure: (error) => {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Interpretation Network verification cleanup failed: ${message}\n`)
            gateManifest.status = 'failed'
            gateManifest.error = compactDiagnostic(error)
            process.exitCode = 1
        }
    })
} catch (error) {
    gateManifest.status = 'failed'
    gateManifest.error = compactDiagnostic(error)
    process.stderr.write(`[interpretation-network-verify] ${gateManifest.error}\n`)
    process.exitCode = 1
} finally {
    commandRunner.dispose()
    try {
        if (gateManifest.status === 'running') {
            gateManifest.status = 'failed'
            gateManifest.error = 'E2E gate did not reach a terminal state'
            process.exitCode = 1
        }
        if (!gateManifest.completedAt) gateManifest.completedAt = new Date().toISOString()
        await writeGateManifest()
    } catch (manifestError) {
        const message = manifestError instanceof Error ? manifestError.message : String(manifestError)
        process.stderr.write(`Failed to write Interpretation Network verification manifest: ${message}\n`)
        process.exitCode = 1
    }
    process.stdout.write(`[interpretation-network-verify] Evidence: ${path.relative(repoRoot, artifactRoot)}\n`)
}
