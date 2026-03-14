import express from 'express'

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}
const mockValidateRegisteredPlatformMigrations = jest.fn(() => ({
    ok: true,
    issues: []
}))
const mockValidateRegisteredSystemAppDefinitions = jest.fn(() => ({
    ok: true,
    issues: []
}))
const mockValidateRegisteredSystemAppSchemaGenerationPlans = jest.fn(() => ({
    ok: true,
    issues: [],
    plans: []
}))
const mockValidateRegisteredSystemAppCompiledDefinitions = jest.fn(() => ({
    ok: true,
    issues: [],
    artifactSets: []
}))
const mockInspectLegacyFixedSchemaTables = jest.fn().mockResolvedValue({
    ok: true,
    leftovers: [],
    issues: []
})
const mockInspectRegisteredSystemAppStructureMetadata = jest.fn().mockResolvedValue({
    ok: true,
    issues: [],
    entries: []
})
const mockBootstrapRegisteredSystemAppStructureMetadata = jest.fn().mockResolvedValue({
    bootstrapped: [
        {
            definitionKey: 'profiles',
            schemaName: 'profiles',
            stage: 'target',
            storageModel: 'application_like',
            metadataObjectCount: 1,
            metadataAttributeCount: 12,
            systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_attributes']
        }
    ]
})
const mockRunRegisteredPlatformPreludeMigrations = jest.fn().mockResolvedValue({
    applied: ['PrepareMetahubsSchemaSupport1766351182000'],
    skipped: [],
    drifted: []
})
const mockEnsureRegisteredSystemAppSchemaGenerationPlans = jest.fn().mockResolvedValue({
    applied: ['applications', 'profiles'],
    skipped: ['admin', 'metahubs']
})
const mockRunRegisteredPlatformPostSchemaMigrations = jest.fn().mockResolvedValue({
    applied: ['FinalizeMetahubsSchemaSupport1766351182001'],
    skipped: [],
    drifted: []
})
const mockSyncRegisteredPlatformDefinitionsToCatalog = jest.fn().mockResolvedValue({
    created: 1,
    updated: 0,
    unchanged: 0,
    lint: {
        ok: true,
        issues: [],
        orderedKeys: ['platform_migration.platform_schema.metahubs.PrepareMetahubsSchemaSupport1766351182000::custom']
    }
})
const mockIsGlobalMigrationCatalogEnabled = jest.fn(() => true)
const mockKnex = { tag: 'knex' }
const mockGetKnex = jest.fn(() => mockKnex)
const mockDestroyKnex = jest.fn().mockResolvedValue(undefined)

jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: mockLogger,
    expressRequestLogger: jest.fn((_req, _res, next) => next())
}))

jest.mock('../utils/XSS', () => ({
    sanitizeMiddleware: jest.fn((_req, _res, next) => next()),
    getCorsOptions: jest.fn(() => ({})),
    getAllowedIframeOrigins: jest.fn(() => '*')
}))

jest.mock('../utils', () => ({
    getNodeModulesPackagePath: jest.fn(() => '/tmp/node_modules')
}))

jest.mock('../routes', () => ({
    __esModule: true,
    default: express.Router()
}))

jest.mock('../middlewares/errors', () => ({
    __esModule: true,
    default: jest.fn((error, _req, _res, next) => next(error))
}))

jest.mock(
    '@universo/auth-backend',
    () => ({
        passport: {
            initialize: jest.fn(() => jest.fn((_req, _res, next) => next())),
            session: jest.fn(() => jest.fn((_req, _res, next) => next()))
        },
        createAuthRouter: jest.fn(() => express.Router())
    }),
    { virtual: true }
)

jest.mock(
    '@universo/database',
    () => ({
        getKnex: mockGetKnex,
        destroyKnex: mockDestroyKnex
    }),
    { virtual: true }
)

jest.mock(
    '@universo/metahubs-backend',
    () => ({
        initializeRateLimiters: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/applications-backend',
    () => ({
        initializeRateLimiters: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/start-backend',
    () => ({
        initializeRateLimiters: jest.fn()
    }),
    { virtual: true }
)

jest.mock(
    '@universo/migrations-platform',
    () => ({
        validateRegisteredPlatformMigrations: mockValidateRegisteredPlatformMigrations,
        validateRegisteredSystemAppDefinitions: mockValidateRegisteredSystemAppDefinitions,
        validateRegisteredSystemAppSchemaGenerationPlans: mockValidateRegisteredSystemAppSchemaGenerationPlans,
        validateRegisteredSystemAppCompiledDefinitions: mockValidateRegisteredSystemAppCompiledDefinitions,
        inspectLegacyFixedSchemaTables: mockInspectLegacyFixedSchemaTables,
        inspectRegisteredSystemAppStructureMetadata: mockInspectRegisteredSystemAppStructureMetadata,
        ensureRegisteredSystemAppSchemaGenerationPlans: mockEnsureRegisteredSystemAppSchemaGenerationPlans,
        bootstrapRegisteredSystemAppStructureMetadata: mockBootstrapRegisteredSystemAppStructureMetadata,
        runRegisteredPlatformPreludeMigrations: mockRunRegisteredPlatformPreludeMigrations,
        runRegisteredPlatformPostSchemaMigrations: mockRunRegisteredPlatformPostSchemaMigrations,
        syncRegisteredPlatformDefinitionsToCatalog: mockSyncRegisteredPlatformDefinitionsToCatalog
    }),
    { virtual: true }
)

jest.mock(
    '@universo/utils',
    () => ({
        API_WHITELIST_URLS: [],
        isGlobalMigrationCatalogEnabled: (...args: unknown[]) => mockIsGlobalMigrationCatalogEnabled(...args)
    }),
    { virtual: true }
)

import { App } from '../index'

describe('App.initDatabase', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsGlobalMigrationCatalogEnabled.mockReturnValue(true)
        mockValidateRegisteredPlatformMigrations.mockReturnValue({
            ok: true,
            issues: []
        })
        mockValidateRegisteredSystemAppDefinitions.mockReturnValue({
            ok: true,
            issues: []
        })
        mockValidateRegisteredSystemAppSchemaGenerationPlans.mockReturnValue({
            ok: true,
            issues: [],
            plans: []
        })
        mockValidateRegisteredSystemAppCompiledDefinitions.mockReturnValue({
            ok: true,
            issues: [],
            artifactSets: []
        })
        mockInspectLegacyFixedSchemaTables.mockResolvedValue({
            ok: true,
            leftovers: [],
            issues: []
        })
        mockInspectRegisteredSystemAppStructureMetadata.mockResolvedValue({
            ok: true,
            issues: [],
            entries: []
        })
        mockBootstrapRegisteredSystemAppStructureMetadata.mockResolvedValue({
            bootstrapped: [
                {
                    definitionKey: 'profiles',
                    schemaName: 'profiles',
                    stage: 'target',
                    storageModel: 'application_like',
                    metadataObjectCount: 1,
                    metadataAttributeCount: 12,
                    systemTables: ['_app_migrations', '_app_settings', '_app_objects', '_app_attributes']
                }
            ]
        })
        mockRunRegisteredPlatformPreludeMigrations.mockResolvedValue({
            applied: ['PrepareMetahubsSchemaSupport1766351182000'],
            skipped: [],
            drifted: []
        })
        mockEnsureRegisteredSystemAppSchemaGenerationPlans.mockResolvedValue({
            applied: ['applications', 'profiles'],
            skipped: ['admin', 'metahubs']
        })
        mockRunRegisteredPlatformPostSchemaMigrations.mockResolvedValue({
            applied: ['FinalizeMetahubsSchemaSupport1766351182001'],
            skipped: [],
            drifted: []
        })
        mockSyncRegisteredPlatformDefinitionsToCatalog.mockResolvedValue({
            created: 1,
            updated: 0,
            unchanged: 0,
            lint: {
                ok: true,
                issues: [],
                orderedKeys: ['platform_migration.platform_schema.metahubs.PrepareMetahubsSchemaSupport1766351182000::custom']
            }
        })
    })

    it('initializes database and runs unified platform migrations', async () => {
        const app = new App()

        await app.initDatabase()

        expect(mockValidateRegisteredPlatformMigrations).toHaveBeenCalledTimes(1)
        expect(mockValidateRegisteredSystemAppDefinitions).toHaveBeenCalledTimes(1)
        expect(mockValidateRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockValidateRegisteredSystemAppCompiledDefinitions).toHaveBeenCalledTimes(1)
        expect(mockGetKnex).toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledWith(
            mockKnex,
            expect.objectContaining({
                info: expect.any(Function),
                warn: expect.any(Function),
                error: expect.any(Function)
            })
        )
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledWith(mockKnex, {
            stage: 'target'
        })
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledWith(
            mockKnex,
            expect.objectContaining({
                info: expect.any(Function),
                warn: expect.any(Function),
                error: expect.any(Function)
            })
        )
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledWith(mockKnex, {
            stage: 'target'
        })
        expect(mockInspectLegacyFixedSchemaTables).toHaveBeenCalledWith(mockKnex)
        expect(mockInspectRegisteredSystemAppStructureMetadata).toHaveBeenCalledWith(mockKnex)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).toHaveBeenCalledWith(
            mockKnex,
            expect.objectContaining({
                source: 'core-backend-initDatabase'
            })
        )
        expect(mockDestroyKnex).not.toHaveBeenCalled()
    })

    it('fails fast when platform migration validation is not ok', async () => {
        mockValidateRegisteredPlatformMigrations.mockReturnValue({
            ok: false,
            issues: [{ message: 'invalid migration registry' }]
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('invalid migration registry')

        expect(mockRunRegisteredPlatformPreludeMigrations).not.toHaveBeenCalled()
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPostSchemaMigrations).not.toHaveBeenCalled()
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when registered system app definition validation is not ok', async () => {
        mockValidateRegisteredSystemAppDefinitions.mockReturnValue({
            ok: false,
            issues: [{ message: 'invalid system app manifest registry' }]
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('invalid system app manifest registry')

        expect(mockRunRegisteredPlatformPreludeMigrations).not.toHaveBeenCalled()
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPostSchemaMigrations).not.toHaveBeenCalled()
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when registered system app schema generation plans are not ok', async () => {
        mockValidateRegisteredSystemAppSchemaGenerationPlans.mockReturnValue({
            ok: false,
            issues: ['profiles: invalid plan'],
            plans: []
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('profiles: invalid plan')

        expect(mockRunRegisteredPlatformPreludeMigrations).not.toHaveBeenCalled()
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPostSchemaMigrations).not.toHaveBeenCalled()
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when registered system app compiled definitions are not ok', async () => {
        mockValidateRegisteredSystemAppCompiledDefinitions.mockReturnValue({
            ok: false,
            issues: ['profiles compiled artifacts are invalid'],
            artifactSets: []
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('profiles compiled artifacts are invalid')

        expect(mockRunRegisteredPlatformPreludeMigrations).not.toHaveBeenCalled()
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPostSchemaMigrations).not.toHaveBeenCalled()
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when platform prelude migration execution throws', async () => {
        mockRunRegisteredPlatformPreludeMigrations.mockRejectedValue(new Error('platform migration failed'))
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('platform migration failed')

        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).not.toHaveBeenCalled()
        expect(mockRunRegisteredPlatformPostSchemaMigrations).not.toHaveBeenCalled()
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).not.toHaveBeenCalled()
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when fixed system app structure bootstrap throws after migrations succeed', async () => {
        mockBootstrapRegisteredSystemAppStructureMetadata.mockRejectedValue(new Error('fixed system app bootstrap failed'))
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('fixed system app bootstrap failed')

        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledTimes(1)
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledTimes(1)
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when legacy fixed schema tables remain after bootstrap', async () => {
        mockInspectLegacyFixedSchemaTables.mockResolvedValue({
            ok: false,
            leftovers: [
                {
                    definitionKey: 'admin',
                    schemaName: 'admin',
                    legacyTableName: 'roles',
                    targetSchemaName: 'admin',
                    targetTableName: 'cat_roles',
                    legacyQualifiedName: 'admin.roles',
                    targetQualifiedName: 'admin.cat_roles'
                }
            ],
            issues: ['admin.roles must be reconciled to admin.cat_roles']
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('Legacy fixed schema tables remain after bootstrap')

        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledTimes(1)
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledTimes(1)
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockInspectLegacyFixedSchemaTables).toHaveBeenCalledTimes(1)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when fixed system app structure metadata inspection is not ok', async () => {
        mockInspectRegisteredSystemAppStructureMetadata.mockResolvedValue({
            ok: false,
            issues: ['profiles: missing _app_attributes metadata for profiles.nickname'],
            entries: []
        })
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('Fixed system app structure metadata inspection failed')

        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledTimes(1)
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledTimes(1)
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockInspectLegacyFixedSchemaTables).toHaveBeenCalledTimes(1)
        expect(mockInspectRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('fails fast when platform definition synchronization throws after migrations succeed', async () => {
        mockSyncRegisteredPlatformDefinitionsToCatalog.mockRejectedValue(new Error('definition sync failed'))
        const app = new App()

        await expect(app.initDatabase()).rejects.toThrow('definition sync failed')

        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledTimes(1)
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledTimes(1)
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).toHaveBeenCalledTimes(1)
        expect(mockDestroyKnex).toHaveBeenCalledTimes(1)
        expect(mockLogger.error).toHaveBeenCalledWith('❌ [server]: Error during database initialization:', expect.any(Error))
    })

    it('skips catalog definition synchronization when the global catalog is disabled by config', async () => {
        mockIsGlobalMigrationCatalogEnabled.mockReturnValue(false)
        const app = new App()

        await app.initDatabase()

        expect(mockRunRegisteredPlatformPreludeMigrations).toHaveBeenCalledTimes(1)
        expect(mockEnsureRegisteredSystemAppSchemaGenerationPlans).toHaveBeenCalledTimes(1)
        expect(mockRunRegisteredPlatformPostSchemaMigrations).toHaveBeenCalledTimes(1)
        expect(mockBootstrapRegisteredSystemAppStructureMetadata).toHaveBeenCalledTimes(1)
        expect(mockSyncRegisteredPlatformDefinitionsToCatalog).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith('[server]: Global migration catalog is disabled; skipping catalog definition sync')
        expect(mockDestroyKnex).not.toHaveBeenCalled()
    })
})
