jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            VersionColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
            JoinColumn: decorator,
            Index: decorator,
            Unique: decorator,
            In: jest.fn((value) => value)
        }
    },
    { virtual: true }
)

const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn(() => 'lock-key')
const mockCreateSchema = jest.fn(async () => undefined)

const tablePresence = new Map<string, boolean>()
const mockHasTable = jest.fn(async (_schema: string, table: string) => tablePresence.get(table) === true)

const mockKnex = {
    schema: {
        withSchema: jest.fn((schemaName: string) => ({
            hasTable: (tableName: string) => mockHasTable(schemaName, tableName)
        }))
    },
    raw: jest.fn(async (_sql: string, params?: unknown[]) => {
        // Simulates: SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ANY(?)
        const candidates = Array.isArray(params) && Array.isArray(params[1]) ? (params[1] as string[]) : []
        const rows = candidates.filter((t) => tablePresence.get(t) === true).map((t) => ({ table_name: t }))
        return { rows }
    })
}

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    },
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    getDDLServices: () => ({
        generator: {
            createSchema: (...args: unknown[]) => mockCreateSchema(...args)
        }
    })
}))

import { MetahubSchemaService } from '../../domains/metahubs/services/MetahubSchemaService'
import { SystemTableMigrator } from '../../domains/metahubs/services/SystemTableMigrator'
import { CURRENT_STRUCTURE_VERSION } from '../../domains/metahubs/services/structureVersions'
import { MetahubMigrationRequiredError } from '../../domains/shared/domainErrors'
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'

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

    const setupDataSource = (structureVersion: number) => {
        const metahubRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const metahubUserRepo = createMockRepository<any>()

        ;(metahubRepo as any).findOneByOrFail = jest.fn().mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateVersionId: null
        })
        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId,
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName,
            structureVersion,
            lastTemplateVersionId: null,
            lastTemplateVersionLabel: null
        })

        return createMockDataSource({
            Metahub: metahubRepo,
            MetahubBranch: branchRepo,
            MetahubUser: metahubUserRepo
        }) as any
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

        const ds = setupDataSource(1)
        const service = new MetahubSchemaService(ds)

        await expect(service.ensureSchema(metahubId, userId)).rejects.toBeInstanceOf(MetahubMigrationRequiredError)
        expect(mockAcquireAdvisoryLock).not.toHaveBeenCalled()
        expect(mockCreateSchema).not.toHaveBeenCalled()
    })

    it('returns schema in read_only mode for fully initialized and up-to-date branch without acquiring lock', async () => {
        seedExpectedTables([
            '_mhb_objects',
            '_mhb_attributes',
            '_mhb_enum_values',
            '_mhb_elements',
            '_mhb_settings',
            '_mhb_layouts',
            '_mhb_widgets',
            '_mhb_migrations'
        ])

        const ds = setupDataSource(CURRENT_STRUCTURE_VERSION)
        const service = new MetahubSchemaService(ds)

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
        const branchRepo = createMockRepository<any>()
        const dataSource = createMockDataSource({
            MetahubBranch: branchRepo
        }) as any
        const service = new MetahubSchemaService(dataSource)

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

        expect(branchRepo.update).not.toHaveBeenCalled()

        migrateSpy.mockRestore()
        syncSpy.mockRestore()
    })
})
