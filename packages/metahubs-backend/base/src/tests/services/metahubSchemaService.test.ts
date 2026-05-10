const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn(() => 'lock-key')
const mockCreateSchema = jest.fn(async () => undefined)
const mockHasRuntimeHistoryTable = jest.fn(async () => false)

const tablePresence = new Map<string, boolean>()
const migrationRows: Array<{
    id: string
    name: string
    from_version: string | number | null
    to_version: string | number | null
    applied_at: string
}> = []

const buildMigrationRowsSnapshot = () =>
    migrationRows
        .slice()
        .sort((left, right) => left.applied_at.localeCompare(right.applied_at) || left.name.localeCompare(right.name))
        .map((row) => ({
            id: row.id,
            name: row.name,
            to_version: row.to_version
        }))

const createSchemaServiceExec = () => ({
    query: jest.fn(async (sql: string, params?: unknown[]) => {
        // Simulate information_schema.tables lookup for inspectSchemaState and local migration-table checks.
        if (typeof sql === 'string' && sql.includes('information_schema.tables')) {
            if (Array.isArray(params) && typeof params[1] === 'string') {
                return [{ exists: tablePresence.get(params[1]) === true }]
            }

            const candidates = Array.isArray(params) && Array.isArray(params[1]) ? (params[1] as string[]) : []
            return candidates.filter((t) => tablePresence.get(t) === true).map((t) => ({ table_name: t }))
        }

        if (typeof sql === 'string' && sql.includes('SELECT id, name, to_version AS "toVersion"')) {
            return buildMigrationRowsSnapshot().map((row) => ({
                id: row.id,
                name: row.name,
                toVersion: row.to_version
            }))
        }

        if (typeof sql === 'string' && sql.includes('UPDATE') && sql.includes('._mhb_migrations')) {
            const [name, fromVersion, toVersion, id] = Array.isArray(params) ? params : []
            const row = migrationRows.find((candidate) => candidate.id === id)
            if (row) {
                row.name = String(name)
                row.from_version = fromVersion as string | number | null
                row.to_version = toVersion as string | number | null
            }
            return []
        }

        return []
    })
})

const buildSchemaScopedQueryBuilder = (_schemaName: string) => ({
    from: (tableName: string) => {
        if (tableName !== '_mhb_migrations') {
            throw new Error(`Unexpected table access in test: ${tableName}`)
        }

        return {
            select: () => ({
                where: () => ({
                    orderBy: () => ({
                        orderBy: () => ({
                            limit: async () => buildMigrationRowsSnapshot()
                        })
                    })
                })
            }),
            where: ({ id }: { id: string }) => ({
                update: async (payload: Partial<(typeof migrationRows)[number]>) => {
                    const row = migrationRows.find((candidate) => candidate.id === id)
                    if (!row) return 0
                    Object.assign(row, payload)
                    return 1
                }
            })
        }
    }
})

const mockKnex = {
    schema: {
        withSchema: jest.fn((schemaName: string) => ({
            hasTable: jest.fn(async (tableName: string) => tablePresence.get(tableName) === true)
        }))
    },
    withSchema: jest.fn((schemaName: string) => buildSchemaScopedQueryBuilder(schemaName)),
    raw: jest.fn(async () => ({ rows: [] })),
    transaction: jest.fn()
}

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: () => mockKnex,
    qSchema: jest.requireActual('@universo/database').qSchema,
    qTable: jest.requireActual('@universo/database').qTable,
    qSchemaTable: jest.requireActual('@universo/database').qSchemaTable,
    qColumn: jest.requireActual('@universo/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo/database').createKnexExecutor
}))

jest.mock('@universo/migrations-core', () => ({
    __esModule: true,
    ...jest.requireActual('@universo/migrations-core'),
    hasRuntimeHistoryTable: (...args: unknown[]) => mockHasRuntimeHistoryTable(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    getDDLServices: () => ({
        generator: {
            createSchema: (...args: unknown[]) => mockCreateSchema(...args)
        }
    })
}))

const mockFindMetahubById = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockFindMetahubMembership = jest.fn()
const mockUpdateBranch = jest.fn()
const mockFindBranchesByMetahub = jest.fn()
const mockFindTemplateVersionById = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args),
    findBranchByIdAndMetahub: (...args: unknown[]) => mockFindBranchByIdAndMetahub(...args),
    findMetahubMembership: (...args: unknown[]) => mockFindMetahubMembership(...args),
    updateBranch: (...args: unknown[]) => mockUpdateBranch(...args),
    findBranchesByMetahub: (...args: unknown[]) => mockFindBranchesByMetahub(...args),
    findTemplateVersionById: (...args: unknown[]) => mockFindTemplateVersionById(...args)
}))

import { MetahubSchemaService } from '../../domains/metahubs/services/MetahubSchemaService'
import { SystemTableMigrator } from '../../domains/metahubs/services/SystemTableMigrator'
import { CURRENT_STRUCTURE_VERSION } from '../../domains/metahubs/services/structureVersions'
import { MetahubMigrationRequiredError } from '../../domains/shared/domainErrors'
import { lmsTemplate } from '../../domains/templates/data/lms.template'

describe('MetahubSchemaService (read_only mode)', () => {
    const metahubId = '019c5a80-94a8-7ea4-a2eb-cf1522e0d123'
    const branchId = '019c5a80-bb7a-7df8-9ab3-e0e8ac2f11aa'
    const userId = '3a5c369e-43ba-44a8-a818-1924d685e970'
    const schemaName = 'mhb_019c5a8094a87ea4a2ebcf1522e0d123_b1'

    const seedExpectedTables = (tables: string[]) => {
        tablePresence.clear()
        for (const table of tables) {
            tablePresence.set(table, true)
        }
    }

    const setupExec = (structureVersion: number) => {
        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId,
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName,
            structureVersion,
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null
        })

        return createSchemaServiceExec()
    }

    beforeEach(() => {
        jest.clearAllMocks()
        tablePresence.clear()
        migrationRows.splice(0, migrationRows.length)
        mockHasRuntimeHistoryTable.mockResolvedValue(false)
        MetahubSchemaService.clearAllCaches()
    })

    it('returns MIGRATION_REQUIRED when required system tables are missing', async () => {
        seedExpectedTables([
            '_mhb_objects',
            '_mhb_attributes',
            '_mhb_elements',
            '_mhb_settings',
            '_mhb_layouts',
            '_mhb_widgets',
            '_mhb_migrations'
        ])

        const exec = setupExec(1)
        const service = new MetahubSchemaService(exec)

        await expect(service.ensureSchema(metahubId, userId)).rejects.toBeInstanceOf(MetahubMigrationRequiredError)
        expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
        expect(mockCreateSchema).not.toHaveBeenCalled()
    })

    it('returns schema in read_only mode for fully initialized and up-to-date branch without acquiring lock', async () => {
        seedExpectedTables([
            '_mhb_objects',
            '_mhb_constants',
            '_mhb_attributes',
            '_mhb_values',
            '_mhb_elements',
            '_mhb_settings',
            '_mhb_layouts',
            '_mhb_widgets',
            '_mhb_catalog_widget_overrides',
            '_mhb_shared_entity_overrides',
            '_mhb_migrations',
            '_mhb_scripts',
            '_mhb_entity_type_definitions',
            '_mhb_actions',
            '_mhb_event_bindings'
        ])

        const exec = setupExec(CURRENT_STRUCTURE_VERSION)
        const service = new MetahubSchemaService(exec)

        await expect(service.ensureSchema(metahubId, userId)).resolves.toBe(schemaName)
        expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
        expect(mockCreateSchema).not.toHaveBeenCalled()
    })
})

describe('MetahubSchemaService migration sequencing', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        migrationRows.splice(0, migrationRows.length)
        mockHasRuntimeHistoryTable.mockResolvedValue(false)
    })

    it('does not update branch structureVersion when seed sync fails after structure migration', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        const migrateSpy = jest.spyOn(SystemTableMigrator.prototype, 'migrate').mockResolvedValue({
            fromVersion: 1,
            toVersion: CURRENT_STRUCTURE_VERSION,
            applied: [],
            skippedDestructive: [],
            success: true
        })
        const syncSpy = jest.spyOn(service as any, 'syncTemplateSeed').mockRejectedValue(new Error('seed sync failed'))

        await expect((service as any).migrateStructure('mhb_schema', 'branch-id', 1, { seed: {} } as any, undefined)).rejects.toThrow(
            'seed sync failed'
        )

        expect(mockUpdateBranch).not.toHaveBeenCalled()

        migrateSpy.mockRestore()
        syncSpy.mockRestore()
    })
})

describe('MetahubSchemaService create options', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        tablePresence.clear()
        migrationRows.splice(0, migrationRows.length)
        mockHasRuntimeHistoryTable.mockResolvedValue(false)
        MetahubSchemaService.clearAllCaches()
    })

    it('passes createOptions through initializeSchema into system table initialization', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)
        const manifest = {
            version: '0.1.0',
            minStructureVersion: '0.1.0',
            seed: {}
        } as any
        const createOptions = {
            presetToggles: {
                hub: false,
                catalog: true,
                set: false,
                enumeration: true
            }
        }

        jest.spyOn(service as any, 'inspectSchemaState').mockResolvedValue({
            initialized: false,
            hasAnyExpectedTables: false,
            expectedTables: [],
            missingTables: []
        })
        jest.spyOn(service as any, 'createEmptySchemaIfNeeded').mockResolvedValue(undefined)
        const initSystemTablesSpy = jest.spyOn(service as any, 'initSystemTables').mockResolvedValue(undefined)

        await service.initializeSchema('mhb_test_schema', manifest, createOptions)

        expect(initSystemTablesSpy).toHaveBeenCalledWith('mhb_test_schema', manifest, createOptions)
    })

    it('builds effective preset toggles from template defaults, persisted values, and explicit overrides', () => {
        const toggles = (MetahubSchemaService as any).buildEffectivePresetToggles(
            {
                presets: [
                    { presetCodename: 'hub', includedByDefault: true },
                    { presetCodename: 'catalog', includedByDefault: false },
                    { presetCodename: 'set', includedByDefault: true }
                ]
            },
            {
                presetToggles: {
                    hub: false,
                    catalog: true
                }
            },
            {
                set: false
            }
        )

        expect(toggles).toEqual({
            hub: false,
            catalog: true,
            set: false
        })
    })

    it('loads LMS entity type definitions from the Basic baseline presets and direct seed entities', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        const bundle = await (service as any).buildTemplateBootstrapBundle(lmsTemplate)
        const kindKeys = bundle.entityTypePresets.map((preset: { entityType: { kindKey: string } }) => preset.entityType.kindKey)
        const entityCodenames = bundle.seed.entities.map((entity: { codename: string }) => entity.codename)
        const catalogPreset = bundle.entityTypePresets.find(
            (preset: { entityType: { kindKey: string } }) => preset.entityType.kindKey === 'catalog'
        )

        expect(kindKeys).toEqual(expect.arrayContaining(['hub', 'page', 'catalog', 'set', 'enumeration']))
        expect(catalogPreset?.entityType.ui.tabs).toContain('behavior')
        expect(catalogPreset?.entityType.ui.tabs).toContain('ledgerSchema')
        expect(catalogPreset?.entityType.components.identityFields).toEqual({
            enabled: true,
            allowNumber: true,
            allowEffectiveDate: true
        })
        expect(catalogPreset?.entityType.components.recordLifecycle).toEqual({
            enabled: true,
            allowCustomStates: true
        })
        expect(catalogPreset?.entityType.components.posting).toEqual({
            enabled: true,
            allowManualPosting: true,
            allowAutomaticPosting: true
        })
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'MainHub',
                'LearnerHome',
                'MainCatalog',
                'MainSet',
                'MainEnumeration',
                'Learning',
                'LmsConfiguration',
                'Modules',
                'ModuleStatus',
                'QuestionType'
            ])
        )
    })

    it('resolves the public structure version from the baseline migration row', async () => {
        tablePresence.set('_mhb_migrations', true)
        migrationRows.push({
            id: 'migration-1',
            name: 'baseline_structure_v1',
            from_version: 1,
            to_version: 1,
            applied_at: '2026-04-12T00:00:00.000Z'
        })

        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        await expect(service.resolvePublicStructureVersion('mhb_test_schema', CURRENT_STRUCTURE_VERSION)).resolves.toBe('0.1.0')
    })

    it('rewrites the baseline migration row to the imported snapshot structure version', async () => {
        tablePresence.set('_mhb_migrations', true)
        migrationRows.push({
            id: 'migration-1',
            name: 'baseline_structure_v1',
            from_version: 1,
            to_version: 1,
            applied_at: '2026-04-12T00:00:00.000Z'
        })

        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        await service.rewriteBaselineMigrationVersion('mhb_test_schema', '0.4.0')

        expect(migrationRows[0]).toEqual(
            expect.objectContaining({
                name: 'baseline_structure_v4',
                from_version: 4,
                to_version: 4
            })
        )
    })
})
