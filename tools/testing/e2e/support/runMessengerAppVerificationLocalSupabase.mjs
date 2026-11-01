import { spawn } from 'node:child_process'

const localSupabaseEnv = {
    UNIVERSO_ENV_FILE: '.env.e2e.local-supabase',
    UNIVERSO_FRONTEND_ENV_FILE: 'packages/universo-react-core-frontend/.env.e2e.local-supabase'
}

const generatedFixturePath = 'tools/testing/e2e/.artifacts/generated-metahubs-messenger-app-snapshot.json'
const run = (args, { env = {}, silent = false } = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn('pnpm', args, {
            stdio: ['inherit', silent ? 'ignore' : 'inherit', silent ? 'ignore' : 'inherit'],
            shell: process.platform === 'win32',
            env: { ...process.env, ...env }
        })
        child.on('error', reject)
        child.on('close', (code, signal) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`pnpm ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
        })
    })

let failed = false

try {
    process.stdout.write('Starting the dedicated minimal E2E Supabase profile.\n')
    await run(['supabase:e2e:start:minimal'], { silent: true })
    await run(['env:e2e:local-supabase'], { silent: true })
    await run(['doctor:e2e:local-supabase'], { silent: true })
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run([
        '--filter',
        '@universo-react/types',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/__tests__/dashboardWidgetRegistry.test.ts',
        'src/__tests__/applicationBotBindings.test.ts',
        'src/__tests__/messengerAppLayout.test.ts'
    ])
    await run([
        '--filter',
        '@universo-react/utils',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/validation/__tests__/messengerBotUsername.test.ts'
    ])
    await run([
        '--filter',
        '@universo-react/applications-frontend',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/api/__tests__/applicationBotBindings.test.ts',
        'src/hooks/__tests__/useApplicationBotBindings.test.tsx',
        'src/pages/application-settings/__tests__/MessengerBindingsPanel.test.tsx',
        'src/pages/application-settings/__tests__/CatalogVisibilitySetting.test.tsx',
        'src/pages/__tests__/ApplicationRuntime.test.tsx',
        'src/pages/__tests__/ApplicationRuntime.public.test.tsx',
        'src/utils/messengerBotUsername.test.ts'
    ])
    await run([
        '--filter',
        '@universo-react/apps-template-mui',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/api/__tests__/messengerLaunchAttribution.test.ts',
        'src/api/__tests__/messengerLayoutAdapter.test.ts',
        'src/dashboard/components/__tests__/RuntimeMenuWidget.navigation.test.tsx',
        'src/messenger/__tests__/launchAttribution.test.tsx',
        'src/messenger/__tests__/MessengerRuntimeShell.test.tsx',
        'src/messenger/__tests__/bridgeScriptLoader.test.ts',
        'src/public-runtime/__tests__/PublicMessengerRuntime.test.tsx',
        'src/dashboard/components/__tests__/CustomizedDataGrid.test.tsx'
    ])
    await run([
        '--filter',
        '@universo-react/applications-backend',
        'exec',
        'node',
        '../../tools/testing/backend/run-jest.cjs',
        '--config',
        './jest.config.js',
        'src/tests/controllers/applicationBotBindingsController.test.ts',
        'src/tests/controllers/applicationLayoutsController.test.ts',
        'src/tests/controllers/publicApplicationRuntimeController.test.ts',
        'src/tests/persistence/applicationCopyPersistence.test.ts',
        'src/tests/persistence/applicationsShowInAppList.test.ts',
        'src/tests/persistence/applicationBotBindingsStore.test.ts',
        'src/tests/persistence/applicationLayoutsStore.messengerSeed.test.ts',
        'src/tests/platform/applicationBotBindingsMigration.test.ts',
        'src/tests/services/applicationBotBindings.test.ts',
        'src/tests/services/messengerBotBindingIdentity.test.ts',
        'src/tests/services/publicApplicationRuntime.readiness.test.ts',
        'src/tests/services/publicApplicationRuntime.routing.test.ts',
        'src/tests/services/publicMessengerRuntime.test.ts',
        'src/tests/services/syncMessengerZoneNormalization.test.ts'
    ])
    await run([
        '--filter',
        '@universo-react/metahubs-backend',
        'exec',
        'node',
        '../../tools/testing/backend/run-jest.cjs',
        '--config',
        './jest.config.js',
        'src/tests/services/messengerAppLayoutSeed.test.ts'
    ])
    await run([
        '--filter',
        '@universo-react/metahubs-frontend',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/domains/entities/metadata/component/ui/__tests__/ComponentFormFields.publicMessenger.test.tsx'
    ])
    await run([
        '--filter',
        '@universo-react/metahubs-frontend',
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.config.ts',
        'src/domains/layouts/ui/__tests__/DashboardNestedPlacements.test.tsx',
        'src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx',
        'src/domains/layouts/ui/__tests__/useLayoutWidgetAuthoring.test.tsx'
    ])
    await run(['test:e2e:messenger-app:fixture-generator'], {
        env: { ...localSupabaseEnv, MESSENGER_APP_FIXTURE_OUTPUT_PATH: generatedFixturePath }
    })
    await run(['check:messenger-app-fixture-contract', '--', generatedFixturePath])
    await run(['test:e2e:messenger-app:fixture-contract'])
    await run(['check:messenger-app-fixture-drift', '--', generatedFixturePath, '--drift'])
    await run(['test:e2e:messenger-app:management'], { env: localSupabaseEnv })
    await run(['test:e2e:messenger-app:ux-oracles'], { env: localSupabaseEnv })
    await run(['test:e2e:messenger-app:fixture-runtime'], {
        env: { ...localSupabaseEnv, MESSENGER_APP_FIXTURE_PATH: generatedFixturePath }
    })
    await run(
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'tools/testing/e2e/specs/flows/app-runtime-views.entity-backed.spec.ts',
            '--project',
            'chromium',
            '--grep',
            'entity-backed dashboard applies detailsTable view settings, search, copy isolation, role access, and Entity row ordering'
        ],
        { env: localSupabaseEnv }
    )
    await run(['test:applications-integration:local-supabase'], { env: localSupabaseEnv })
} catch (error) {
    failed = true
    throw error
} finally {
    process.stdout.write('Stopping only the dedicated E2E Supabase profile.\n')
    try {
        await run(['supabase:e2e:stop'], { silent: true })
    } catch (stopError) {
        const message = stopError instanceof Error ? stopError.message : String(stopError)
        process.stderr.write(`Failed to stop the local E2E Supabase profile after Messenger verification: ${message}\n`)
        if (!failed) process.exitCode = 1
    }
}
