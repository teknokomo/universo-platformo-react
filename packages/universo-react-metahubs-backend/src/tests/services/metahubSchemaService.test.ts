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

const createColumnBuilder = () => ({
    primary: jest.fn(() => createColumnBuilder()),
    defaultTo: jest.fn(() => createColumnBuilder()),
    nullable: jest.fn(() => createColumnBuilder()),
    notNullable: jest.fn(() => createColumnBuilder())
})

const createTableBuilder = () => ({
    uuid: jest.fn(() => createColumnBuilder()),
    string: jest.fn(() => createColumnBuilder()),
    text: jest.fn(() => createColumnBuilder()),
    integer: jest.fn(() => createColumnBuilder()),
    boolean: jest.fn(() => createColumnBuilder()),
    jsonb: jest.fn(() => createColumnBuilder()),
    timestamp: jest.fn(() => createColumnBuilder()),
    index: jest.fn(),
    unique: jest.fn(),
    foreign: jest.fn(() => ({
        references: jest.fn(() => ({
            inTable: jest.fn(() => ({
                onDelete: jest.fn()
            }))
        }))
    }))
})

const mockCreateTable = jest.fn(async (tableName: string, callback?: (builder: unknown) => void) => {
    tablePresence.set(tableName, true)
    callback?.(createTableBuilder())
})

const mockKnex = {
    schema: {
        withSchema: jest.fn((_schemaName: string) => ({
            hasTable: jest.fn(async (tableName: string) => tablePresence.get(tableName) === true),
            createTable: mockCreateTable
        }))
    },
    fn: {
        now: jest.fn(() => 'NOW()')
    },
    withSchema: jest.fn((schemaName: string) => buildSchemaScopedQueryBuilder(schemaName)),
    raw: jest.fn(async () => ({ rows: [] })),
    transaction: jest.fn()
}

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    getKnex: () => mockKnex,
    qSchema: jest.requireActual('@universo-react/database').qSchema,
    qTable: jest.requireActual('@universo-react/database').qTable,
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable,
    qColumn: jest.requireActual('@universo-react/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo-react/database').createKnexExecutor
}))

jest.mock('@universo-react/migrations-core', () => ({
    __esModule: true,
    ...jest.requireActual('@universo-react/migrations-core'),
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
import { SYSTEM_TABLES } from '../../domains/metahubs/services/systemTableDefinitions'
import { CURRENT_STRUCTURE_VERSION } from '../../domains/metahubs/services/structureVersions'
import { MetahubConflictError, MetahubMigrationRequiredError } from '../../domains/shared/domainErrors'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { oneCCompatibleTemplate } from '../../domains/templates/data/one-c-compatible.template'
import { builtinEntityTypePresets } from '../../domains/templates/data'
import { oneCCompatibleAllPresets } from '../../domains/templates/data/one-c-compatible.entity-presets'

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
            '_mhb_components',
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
        seedExpectedTables(SYSTEM_TABLES.map((table) => table.name))

        const exec = setupExec(CURRENT_STRUCTURE_VERSION)
        const service = new MetahubSchemaService(exec)

        await expect(service.ensureSchema(metahubId, userId)).resolves.toBe(schemaName)
        expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
        expect(mockCreateSchema).not.toHaveBeenCalled()
    })

    it('repairs the current additive PlayCanvas sourcefiles table in read_only mode', async () => {
        seedExpectedTables(SYSTEM_TABLES.map((table) => table.name).filter((table) => table !== '_mhb_playcanvas_sourcefiles'))

        const exec = setupExec(CURRENT_STRUCTURE_VERSION)
        const service = new MetahubSchemaService(exec)

        await expect(service.ensureSchema(metahubId, userId)).resolves.toBe(schemaName)
        expect(mockAcquireAdvisoryLock).toHaveBeenCalled()
        expect(mockCreateTable).toHaveBeenCalledWith('_mhb_playcanvas_sourcefiles', expect.any(Function))
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

describe('MetahubSchemaService additive baseline repairs', () => {
    const metahubId = '019c5a80-94a8-7ea4-a2eb-cf1522e0d123'
    const branchId = '019c5a80-bb7a-7df8-9ab3-e0e8ac2f11aa'
    const userId = '3a5c369e-43ba-44a8-a818-1924d685e970'
    const schemaName = 'mhb_019c5a8094a87ea4a2ebcf1522e0d123_b1'

    beforeEach(() => {
        jest.clearAllMocks()
        tablePresence.clear()
        migrationRows.splice(0, migrationRows.length)
        mockHasRuntimeHistoryTable.mockResolvedValue(false)
        MetahubSchemaService.clearAllCaches()
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
            structureVersion: CURRENT_STRUCTURE_VERSION,
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null
        })
    })

    it('creates the current additive PlayCanvas sourcefiles table without bumping structure version', async () => {
        for (const table of SYSTEM_TABLES.map((item) => item.name)) {
            if (table !== '_mhb_playcanvas_sourcefiles') {
                tablePresence.set(table, true)
            }
        }

        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)
        const syncTemplateSeedSpy = jest.spyOn(service as any, 'syncTemplateSeed').mockResolvedValue(false)

        await expect(service.ensureSchema(metahubId, userId, { mode: 'apply_migrations' })).resolves.toBe(schemaName)
        expect(mockCreateTable).toHaveBeenCalledWith('_mhb_playcanvas_sourcefiles', expect.any(Function))
        expect(mockUpdateBranch).not.toHaveBeenCalled()
        syncTemplateSeedSpy.mockRestore()
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
                object: true,
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
                    { presetCodename: 'object', includedByDefault: false },
                    { presetCodename: 'set', includedByDefault: true }
                ]
            },
            {
                presetToggles: {
                    hub: false,
                    object: true
                }
            },
            {
                set: false
            }
        )

        expect(toggles).toEqual({
            hub: false,
            object: true,
            set: false
        })
    })

    it('loads LMS entity type definitions from the Basic baseline presets and direct seed entities', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        const bundle = await (service as any).buildTemplateBootstrapBundle(lmsTemplate)
        const kindKeys = bundle.entityTypePresets.map((preset: { entityType: { kindKey: string } }) => preset.entityType.kindKey)
        const entityCodenames = bundle.seed.entities.map((entity: { codename: string }) => entity.codename)
        const objectPreset = bundle.entityTypePresets.find(
            (preset: { entityType: { kindKey: string } }) => preset.entityType.kindKey === 'object'
        )

        expect(kindKeys).toEqual(expect.arrayContaining(['hub', 'page', 'object', 'set', 'enumeration']))
        expect(objectPreset?.entityType.ui.tabs).toContain('behavior')
        expect(objectPreset?.entityType.ui.tabs).toContain('ledgerSchema')
        expect(objectPreset?.entityType.capabilities.identityFields).toEqual({
            enabled: true,
            allowNumber: true,
            allowEffectiveDate: true
        })
        expect(objectPreset?.entityType.capabilities.recordLifecycle).toEqual({
            enabled: true,
            allowCustomStates: true
        })
        expect(objectPreset?.entityType.capabilities.posting).toEqual({
            enabled: true,
            allowManualPosting: true,
            allowAutomaticPosting: true
        })
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'Learning',
                'LmsConfiguration',
                'LearningContentDefaults',
                'LearningResources',
                'ContentProjects',
                'Courses',
                'LearningTracks',
                'LearningResourceStatus',
                'QuestionType'
            ])
        )
        expect(entityCodenames).not.toContain('Modules')
    })

    it('builds the 1C-Compatible full preset graph with valid behavior references', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        const bundle = await (service as any).buildTemplateBootstrapBundle(oneCCompatibleTemplate)
        const kindKeys = bundle.entityTypePresets.map((preset: { entityType: { kindKey: string } }) => preset.entityType.kindKey)
        const entityCodenames = bundle.seed.entities.map((entity: { codename: string }) => entity.codename)

        expect(kindKeys).toEqual(
            expect.arrayContaining([
                'constant',
                'catalog',
                'document',
                'document-journal',
                'information-register',
                'accumulation-register',
                'chart-of-accounts',
                'chart-of-characteristic-types',
                'accounting-register',
                'chart-of-calculation-types',
                'calculation-register'
            ])
        )
        expect(entityCodenames).toEqual(expect.arrayContaining(['OrganizationName', 'Products', 'GoodsReceipt', 'StockBalance']))
    })

    it('rejects 1C-Compatible preset toggles that create dangling journal sources', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        await expect(
            (service as any).buildTemplateBootstrapBundle(oneCCompatibleTemplate, {
                createOptions: {
                    presetToggles: {
                        'one-c-document': false,
                        'one-c-document-journal': true
                    }
                }
            })
        ).rejects.toThrow(/JOURNAL_SOURCE_NOT_FOUND/)
    })

    it('rejects 1C-Compatible preset toggles that create dangling posting register targets', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)

        await expect(
            (service as any).buildTemplateBootstrapBundle(oneCCompatibleTemplate, {
                createOptions: {
                    presetToggles: {
                        'one-c-accumulation-register': false,
                        'one-c-document': true
                    }
                }
            })
        ).rejects.toThrow(/TARGET_REGISTER_NOT_FOUND/)
    })

    it('refuses to overwrite an existing non-template-managed entity type during preset sync', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)
        const existingDocumentType = {
            id: 'entity-type-1',
            codename: { _primary: 'en', locales: { en: { content: 'Legacy Document' } } },
            presentation: {},
            capabilities: {},
            ui_config: {},
            config: {}
        }
        const updateMock = jest.fn()

        mockKnex.withSchema.mockImplementationOnce(() => ({
            from: (tableName: string) => {
                expect(tableName).toBe('_mhb_entity_type_definitions')
                return {
                    where: () => ({
                        first: async () => existingDocumentType,
                        update: updateMock
                    })
                }
            }
        }))

        const documentPreset = oneCCompatibleAllPresets.find((preset) => preset.entityType.kindKey === 'document')
        if (!documentPreset) {
            throw new Error('document preset is missing')
        }

        await expect((service as any).syncEntityTypePresets('mhb_test_schema', [documentPreset])).rejects.toBeInstanceOf(
            MetahubConflictError
        )
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('migrates legacy builtin preset rows without a template-managed marker during preset sync', async () => {
        const exec = createSchemaServiceExec()
        const service = new MetahubSchemaService(exec)
        const existingObjectType = {
            id: 'entity-type-object',
            codename: { _primary: 'en', locales: { en: { content: 'Legacy Object' } } },
            presentation: {},
            capabilities: {},
            ui_config: {},
            config: {}
        }
        const updateMock = jest.fn(async () => 1)

        mockKnex.withSchema
            .mockImplementationOnce(() => ({
                from: (tableName: string) => {
                    expect(tableName).toBe('_mhb_entity_type_definitions')
                    return {
                        where: () => ({
                            first: async () => existingObjectType
                        })
                    }
                }
            }))
            .mockImplementationOnce(() => ({
                from: (tableName: string) => {
                    expect(tableName).toBe('_mhb_entity_type_definitions')
                    return {
                        where: () => ({
                            update: updateMock
                        })
                    }
                }
            }))

        const objectPreset = builtinEntityTypePresets.find((preset) => preset.entityType.kindKey === 'object')
        if (!objectPreset) {
            throw new Error('object preset is missing')
        }

        await expect((service as any).syncEntityTypePresets('mhb_test_schema', [objectPreset])).resolves.toBe(1)
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                config: expect.objectContaining({
                    systemTemplatePreset: expect.objectContaining({
                        managed: true,
                        presetCodename: 'object',
                        source: 'entity_type_preset'
                    })
                })
            })
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

    it('rewrites the baseline migration row to the imported snapshot baseline structure version', async () => {
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

        await service.rewriteBaselineMigrationVersion('mhb_test_schema', '0.1.0')

        expect(migrationRows[0]).toEqual(
            expect.objectContaining({
                name: 'baseline_structure_v1',
                from_version: 1,
                to_version: 1
            })
        )
    })
})
