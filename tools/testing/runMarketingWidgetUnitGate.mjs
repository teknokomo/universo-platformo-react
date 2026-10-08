import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const marketingWidgetUnitGateCommands = [
    ['pnpm', ['check:apps-template-isolation']],
    [
        'node',
        [
            '--test',
            'tools/docs/pngDimensions.test.mjs',
            'tools/testing/e2e/support/browser/runtimeUx.test.ts',
            'tools/testing/e2e/support/e2eRunLock.test.mjs',
            'tools/testing/e2e/support/localSupabaseE2eGateCoordinator.test.mjs',
            'tools/testing/e2e/support/managedE2eCommand.test.mjs',
            'tools/testing/e2e/support/stopSupabaseStackWithRunLock.test.mjs',
            'tools/testing/e2e/support/env/localSupabaseE2eEnv.test.mjs',
            'tools/testing/backend/runPlatformMigrationsBeforeIntegration.test.mjs'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/types',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/__tests__/entityRecordPolicy.test.ts',
            'src/__tests__/widgetBindings.test.ts',
            'src/__tests__/widgetBindingApi.test.ts',
            'src/__tests__/layoutEnvelope.test.ts',
            'src/__tests__/marketingPage.test.ts'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/utils',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/validation/__tests__/marketingSnapshot.test.ts'
        ]
    ],
    ['pnpm', ['--filter', '@universo-react/template-mui', 'test', '--', 'DynamicEntityFormDialog']],
    ['pnpm', ['--filter', '@universo-react/template-mui', 'test', '--', 'dynamicEntityFormValidation']],
    ['pnpm', ['--filter', '@universo-react/template-mui', 'test', '--', 'StandardDialog']],
    ['pnpm', ['--filter', '@universo-react/template-mui', 'test', '--', 'MarketingWidgetConfigDialog']],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/metahubs-frontend',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/__tests__/displayConverters.test.ts',
            'src/domains/entities/metadata/record/ui/__tests__/recordListUtils.test.ts',
            'src/domains/entities/metadata/record/ui/fields/MarketingActionField.test.tsx',
            'src/domains/layouts/api/__tests__/layouts.test.ts',
            'src/domains/layouts/ui/__tests__/MarketingWidgetBindingDialog.test.tsx',
            'src/domains/layouts/ui/__tests__/MarketingWidgetBindingDialogView.test.tsx',
            'src/domains/layouts/ui/__tests__/useLayoutWidgetAuthoring.test.tsx',
            'src/domains/layouts/ui/__tests__/useMarketingWidgetBindingRecordForm.test.tsx',
            'src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx',
            'src/domains/layouts/ui/__tests__/LayoutDetails.zoneSettingsConsumer.test.tsx',
            'src/domains/layouts/ui/__tests__/LayoutRuntimeSettingsPanel.marketing.test.tsx',
            'src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx',
            'src/domains/metahubs/api/__tests__/apiWrappers.test.ts',
            'src/domains/metahubs/hooks/__tests__/useMetahubDetails.cancellation.test.tsx',
            'src/domains/metahubs/hooks/__tests__/useMetahubDetails.test.ts',
            'src/i18n/__tests__/index.test.ts',
            'src/i18n/__tests__/marketingLayoutTranslations.test.ts'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/applications-frontend',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/components/__tests__/ConnectorDiffDialog.test.tsx',
            'src/pages/__tests__/ApplicationLayouts.test.tsx',
            'src/pages/__tests__/ApplicationLayouts.marketing.test.tsx'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/core-frontend',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/__tests__/AbilityContextProvider.permissionsRace.test.tsx'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/apps-template-mui',
            'exec',
            'vitest',
            'run',
            '--config',
            'vitest.config.ts',
            'src/marketing-page/__tests__/MarketingPage.test.tsx',
            'src/marketing-page/__tests__/normalize.test.ts',
            'src/marketing-page/runtimeDto.test.ts'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/metahubs-backend',
            'exec',
            'node',
            '../../tools/testing/backend/run-jest.cjs',
            '--config',
            './jest.config.js',
            'src/domains/shared/guards.marketingWidgetRolePolicy.test.ts',
            'src/domains/layouts/widgetBindingSourceProvisioner.test.js',
            'src/domains/layouts/services/MetahubWidgetBindingsService.test.js',
            'src/domains/layouts/widgetBindingService.relationCompatibility.test.js',
            'src/domains/layouts/widgetBindingService.sourceDiscovery.test.js',
            'src/domains/layouts/widgetBindingService.bindingResolution.test.js',
            'src/domains/layouts/widgetBindingService.bindingMutations.test.js',
            'src/domains/layouts/widgetBindingService.readModels.test.js',
            'src/domains/layouts/widgetBindingsStore.test.js',
            'src/persistence/widgetBindingReferencesStore.test.js',
            'src/tests/routes/layoutsRoutes.test.ts',
            'src/tests/services/copyMetahubLayout.test.ts',
            'src/tests/services/widgetBindingPolicyStore.test.ts',
            'src/tests/services/layoutCopyBindings.test.ts',
            'src/tests/services/marketingHeroActionIntegrityStore.test.ts',
            'src/tests/services/MetahubLayoutsService.test.ts',
            'src/tests/services/MetahubComponentsService.test.ts',
            'src/tests/services/MetahubRecordsService.test.ts',
            'src/tests/services/marketingSnapshotValidation.test.ts',
            'src/tests/services/templateManifestValidator.test.ts',
            'src/tests/services/templateSeedTransactionScope.test.ts',
            'src/tests/services/SnapshotSerializer.test.ts',
            'src/tests/services/SnapshotRestoreService.test.ts',
            'src/tests/services/marketingHeroActionPolicy.test.ts',
            'src/tests/services/marketingPageLayouts.test.ts',
            'src/tests/services/entityRecordPolicy.test.ts',
            'src/tests/services/entityMetadataMutationPolicy.test.ts',
            'src/tests/routes/layoutsRoutes.marketingWidgetBindings.test.ts',
            'src/tests/services/MetahubRecordsService.marketingRecordPolicy.test.ts',
            'src/tests/services/marketingWidgetRecordDuplicate.test.ts',
            'src/tests/services/recordCopy.test.ts'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/applications-backend',
            'exec',
            'node',
            '../../tools/testing/backend/run-jest.cjs',
            '--config',
            './jest.config.js',
            'src/tests/services/widgetBindingResolver.test.ts',
            'src/tests/controllers/runtimeMarketingPageController.test.ts',
            'src/tests/services/effectiveLayoutResolver.test.ts',
            'src/tests/services/marketingWidgetEntityBinding.test.ts',
            'src/tests/persistence/widgetBindingRuntimeStore.test.ts',
            'src/tests/persistence/widgetBindingSemanticKey.test.ts',
            'src/tests/persistence/applicationLayoutStoreSupport.test.ts',
            'src/tests/persistence/applicationLayoutsStore.test.ts',
            'src/tests/persistence/applicationLayoutWidgetsStoreBindings.test.ts',
            'src/tests/persistence/applicationLayoutWidgetToggleIntegrity.test.ts',
            'src/tests/persistence/applicationLayoutSyncStore.test.ts',
            'src/tests/services/syncLayoutPersistence.test.ts',
            'src/tests/services/syncLayoutPersistenceLineage.test.ts',
            'src/tests/services/syncLayoutPersistenceReconciliation.test.ts',
            'src/tests/services/syncLayoutPersistenceBindings.test.ts',
            'src/tests/persistence/applicationLayoutEntityBindingPolicy.test.ts',
            'src/tests/services/publicApplicationRuntime.serialization.test.ts',
            'src/tests/services/publicApplicationRuntime.serialization-media.test.ts',
            'src/tests/persistence/marketingWidgetBindingStore.test.ts',
            'src/tests/controllers/runtimeRowSupport/rows.test.ts',
            'src/tests/routes/applicationSyncSeeding.test.ts',
            'src/tests/services/applicationWorkspaces.test.ts',
            'src/tests/services/marketingSeedGuard.test.ts',
            'src/tests/persistence/publicApplicationRuntimeStore.test.ts',
            'src/tests/persistence/applicationLayoutsStore.widgetMutations.test.ts',
            'src/tests/persistence/applicationLayoutsStore.entityBindingMutations.test.ts',
            'src/tests/persistence/applicationLayoutsStore.widgetCopy.test.ts',
            'src/tests/persistence/applicationLayoutsStore.widgetBatchMutations.test.ts',
            'src/tests/persistence/applicationLayoutsStore.widgetState.test.ts',
            'src/tests/services/applicationWorkspaces.lifecycle.test.ts',
            'src/tests/services/applicationWorkspaces.marketingSeedConstraints.test.ts',
            'src/tests/services/applicationWorkspaces.seedCreation.test.ts',
            'src/tests/services/applicationWorkspaces.seedReferenceRemapping.test.ts',
            'src/tests/services/applicationWorkspaces.workspaceOrdering.test.ts',
            'src/tests/services/syncLayoutMaterialization.test.ts',
            'src/tests/services/syncLayoutMaterializationTargets.test.ts',
            'src/tests/services/syncLayoutMaterializationScopedLayouts.test.ts',
            'src/tests/services/syncDataLoader.test.ts'
        ]
    ],
    [
        'pnpm',
        [
            '--filter',
            '@universo-react/schema-ddl',
            'exec',
            'node',
            '../../tools/testing/backend/run-jest.cjs',
            '--config',
            './jest.config.js',
            'src/__tests__/SchemaGenerator.test.ts',
            'src/__tests__/SchemaMigrator.test.ts'
        ]
    ]
]

const executeCommand = (executable, args) =>
    new Promise((resolveCode, reject) => {
        const child = spawn(executable, args, {
            cwd: repositoryRoot,
            stdio: 'inherit',
            shell: process.platform === 'win32'
        })
        child.once('error', reject)
        child.once('exit', (code, signal) => resolveCode(code ?? (signal ? 1 : 0)))
    })

export async function runMarketingWidgetUnitGate(commands = marketingWidgetUnitGateCommands, run = executeCommand) {
    for (const [executable, args] of commands) {
        const exitCode = await run(executable, args)
        if (exitCode !== 0) return exitCode
    }
    return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        process.exitCode = await runMarketingWidgetUnitGate()
    } catch (error) {
        console.error('Marketing widget unit gate could not start:', error)
        process.exitCode = 1
    }
}
