const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn(() => 'lock-key')
const mockCreateSchema = jest.fn(async () => undefined)

const tablePresence = new Map<string, boolean>()

const mockKnex = {
    schema: {
        withSchema: jest.fn((schemaName: string) => ({
            hasTable: jest.fn(async (tableName: string) => tablePresence.get(tableName) === true)
        }))
    },
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

    const mockExec = {
        query: jest.fn(async (sql: string, params?: unknown[]) => {
            // Simulate information_schema.tables lookup for inspectSchemaState
            if (typeof sql === 'string' && sql.includes('information_schema.tables')) {
                const candidates = Array.isArray(params) && Array.isArray(params[1]) ? (params[1] as string[]) : []
                return candidates.filter((t) => tablePresence.get(t) === true).map((t) => ({ table_name: t }))
            }
            return []
        })
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

        return mockExec
    }

    beforeEach(() => {
        jest.clearAllMocks()
        tablePresence.clear()
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
            '_mhb_migrations'
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
    })

    it('does not update branch structureVersion when seed sync fails after structure migration', async () => {
        const exec = { query: jest.fn().mockResolvedValue([]) }
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
        MetahubSchemaService.clearAllCaches()
    })

    it('passes createOptions through initializeSchema into system table initialization', async () => {
        const exec = { query: jest.fn().mockResolvedValue([]) }
        const service = new MetahubSchemaService(exec)
        const manifest = {
            version: '0.1.0',
            minStructureVersion: '0.1.0',
            seed: {}
        } as any
        const createOptions = {
            createHub: false,
            createCatalog: true,
            createSet: false,
            createEnumeration: true
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

    it('filters template seed entities, elements, and enum values by create options', () => {
        const seed = {
            entities: [
                { kind: 'hub', codename: 'hub_root' },
                { kind: 'catalog', codename: 'catalog_products' },
                { kind: 'set', codename: 'set_tags' },
                { kind: 'enumeration', codename: 'enum_status' }
            ],
            elements: {
                catalog_products: [{ codename: 'product-1' }],
                set_tags: [{ codename: 'tag-1' }],
                enum_status: [{ codename: 'status-1' }]
            },
            enumerationValues: {
                enum_status: [{ codename: 'draft' }],
                set_tags: [{ codename: 'should-be-removed' }]
            }
        } as any

        const filtered = (MetahubSchemaService as any).filterSeedByCreateOptions(seed, {
            createHub: false,
            createCatalog: true,
            createSet: false,
            createEnumeration: true
        })

        expect(filtered.entities).toEqual([
            { kind: 'catalog', codename: 'catalog_products' },
            { kind: 'enumeration', codename: 'enum_status' }
        ])
        expect(filtered.elements).toEqual({
            catalog_products: [{ codename: 'product-1' }],
            enum_status: [{ codename: 'status-1' }]
        })
        expect(filtered.enumerationValues).toEqual({
            enum_status: [{ codename: 'draft' }]
        })
    })
})
