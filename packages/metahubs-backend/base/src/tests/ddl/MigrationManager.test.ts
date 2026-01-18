import { MigrationManager } from '../../domains/ddl/MigrationManager'
import { ChangeType } from '../../domains/ddl/diff'
import type { SchemaDiff, SchemaChange } from '../../domains/ddl/diff'
import type { SchemaSnapshot } from '../../domains/ddl/types'

// Mock KnexClient
jest.mock('../../domains/ddl/KnexClient', () => ({
    KnexClient: {
        getInstance: jest.fn(() => mockKnex),
    },
}))

// Create mock Knex instance
const mockSchemaBuilder = {
    withSchema: jest.fn().mockReturnThis(),
    hasTable: jest.fn().mockResolvedValue(true),
}

const mockQueryBuilder = {
    withSchema: jest.fn().mockReturnThis(),
    table: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'migration-id-123' }]),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
}

const mockKnex = Object.assign(
    jest.fn(() => mockQueryBuilder),
    {
        raw: jest.fn().mockResolvedValue({ rows: [{ exists: true }] }),
        schema: mockSchemaBuilder,
        withSchema: jest.fn().mockReturnValue(mockQueryBuilder),
    }
)

describe('MigrationManager', () => {
    let manager: MigrationManager

    beforeEach(() => {
        jest.clearAllMocks()
        manager = new MigrationManager()

        // Reset mock implementations
        mockQueryBuilder.withSchema.mockReturnThis()
        mockQueryBuilder.table.mockReturnThis()
        mockQueryBuilder.insert.mockReturnThis()
        mockQueryBuilder.returning.mockResolvedValue([{ id: 'migration-id-123' }])
        mockQueryBuilder.select.mockReturnThis()
        mockQueryBuilder.where.mockReturnThis()
        mockQueryBuilder.first.mockResolvedValue(null)
        mockQueryBuilder.orderBy.mockReturnThis()
        mockQueryBuilder.limit.mockReturnThis()
        mockQueryBuilder.offset.mockReturnThis()
        mockQueryBuilder.count.mockReturnThis()
        mockSchemaBuilder.hasTable.mockResolvedValue(true)
        mockKnex.raw.mockResolvedValue({ rows: [{ exists: true }] })
    })

    describe('generateMigrationName', () => {
        it('should generate migration name with timestamp prefix', () => {
            const name = MigrationManager.generateMigrationName('add products table')

            // Format: YYYYMMDD_HHMMSS_description
            expect(name).toMatch(/^\d{8}_\d{6}_add_products_table$/)
        })

        it('should sanitize description (lowercase, underscores)', () => {
            const name = MigrationManager.generateMigrationName('Add NEW Products-Table!')

            expect(name).toMatch(/_add_new_products_table$/)
        })

        it('should remove leading/trailing underscores from description', () => {
            const name = MigrationManager.generateMigrationName('___test___')

            expect(name).toMatch(/_test$/)
        })

        it('should truncate long descriptions to 50 chars', () => {
            const longDescription = 'a'.repeat(100)
            const name = MigrationManager.generateMigrationName(longDescription)

            // Timestamp is 15 chars (YYYYMMDD_HHMMSS_), description max 50
            const descriptionPart = name.split('_').slice(2).join('_')
            expect(descriptionPart.length).toBeLessThanOrEqual(50)
        })

        it('should handle special characters', () => {
            const name = MigrationManager.generateMigrationName('add@field#with$special%chars')

            expect(name).toMatch(/_add_field_with_special_chars$/)
        })

        it('should handle empty description', () => {
            const name = MigrationManager.generateMigrationName('')

            // Should be timestamp with trailing underscore (sanitization leaves empty after strip)
            expect(name).toMatch(/^\d{8}_\d{6}_$/)
        })
    })

    describe('recordMigration', () => {
        const createTestSnapshot = (): SchemaSnapshot => ({
            version: 3,
            generatedAt: new Date().toISOString(),
            hasSystemTables: true,
            entities: {},
        })

        const createTestDiff = (hasDestructive = false): SchemaDiff => ({
            hasChanges: true,
            additive: [
                {
                    type: ChangeType.ADD_TABLE,
                    entityCodename: 'products',
                    tableName: 'cat_products',
                    isDestructive: false,
                    description: 'Create table "products"',
                },
            ],
            destructive: hasDestructive
                ? [
                      {
                          type: ChangeType.DROP_TABLE,
                          entityCodename: 'old_table',
                          tableName: 'cat_old',
                          isDestructive: true,
                          description: 'Drop table "old_table"',
                      },
                  ]
                : [],
            summary: hasDestructive ? '1 additive, 1 destructive' : '1 additive change',
        })

        it('should record migration with correct data', async () => {
            const snapshotAfter = createTestSnapshot()
            const diff = createTestDiff()

            const migrationId = await manager.recordMigration(
                'app_test123',
                '20260117_143022_add_products',
                null,
                snapshotAfter,
                diff
            )

            expect(migrationId).toBe('migration-id-123')
            // Knex.withSchema is called on the knex instance
            expect(mockKnex.withSchema).toHaveBeenCalledWith('app_test123')
            expect(mockQueryBuilder.table).toHaveBeenCalledWith('_sys_migrations')
            expect(mockQueryBuilder.insert).toHaveBeenCalled()
        })

        it('should store migration meta with snapshots and changes', async () => {
            const snapshotBefore = createTestSnapshot()
            const snapshotAfter = createTestSnapshot()
            const diff = createTestDiff()

            await manager.recordMigration(
                'app_test123',
                '20260117_143022_test',
                snapshotBefore,
                snapshotAfter,
                diff
            )

            // Verify insert was called with stringified meta
            const insertCall = mockQueryBuilder.insert.mock.calls[0][0]
            expect(insertCall.name).toBe('20260117_143022_test')
            expect(insertCall.meta).toBeDefined()

            const meta = JSON.parse(insertCall.meta)
            expect(meta.snapshotBefore).toBeDefined()
            expect(meta.snapshotAfter).toBeDefined()
            expect(meta.changes).toHaveLength(1)
            expect(meta.hasDestructive).toBe(false)
        })

        it('should mark hasDestructive true when diff has destructive changes', async () => {
            const snapshotAfter = createTestSnapshot()
            const diff = createTestDiff(true) // with destructive

            await manager.recordMigration('app_test123', 'test_migration', null, snapshotAfter, diff)

            const insertCall = mockQueryBuilder.insert.mock.calls[0][0]
            const meta = JSON.parse(insertCall.meta)
            expect(meta.hasDestructive).toBe(true)
            expect(meta.changes.length).toBe(2) // 1 additive + 1 destructive
        })
    })

    describe('listMigrations', () => {
        it('should return empty array when schema does not exist', async () => {
            mockKnex.raw.mockResolvedValueOnce({ rows: [{ exists: false }] })

            const result = await manager.listMigrations('app_nonexistent')

            expect(result.migrations).toEqual([])
            expect(result.total).toBe(0)
        })

        it('should return empty array when _sys_migrations table does not exist', async () => {
            mockSchemaBuilder.hasTable.mockResolvedValueOnce(false)

            const result = await manager.listMigrations('app_test123')

            expect(result.migrations).toEqual([])
            expect(result.total).toBe(0)
        })

        it('should return migrations with parsed meta', async () => {
            mockQueryBuilder.first.mockResolvedValueOnce({ count: '2' })
            mockQueryBuilder.offset.mockResolvedValueOnce([
                {
                    id: 'mig-1',
                    name: '20260117_143022_first',
                    applied_at: '2026-01-17T14:30:22Z',
                    meta: JSON.stringify({
                        hasDestructive: false,
                        summary: 'test',
                        changes: [],
                        snapshotBefore: null,
                        snapshotAfter: {},
                    }),
                },
                {
                    id: 'mig-2',
                    name: '20260117_150000_second',
                    applied_at: '2026-01-17T15:00:00Z',
                    meta: { hasDestructive: true, summary: 'test2', changes: [], snapshotBefore: null, snapshotAfter: {} },
                },
            ])

            const result = await manager.listMigrations('app_test123')

            expect(result.total).toBe(2)
            expect(result.migrations).toHaveLength(2)
            expect(result.migrations[0].name).toBe('20260117_143022_first')
            expect(result.migrations[0].meta.hasDestructive).toBe(false)
            expect(result.migrations[1].meta.hasDestructive).toBe(true)
        })

        it('should apply limit and offset', async () => {
            mockQueryBuilder.first.mockResolvedValueOnce({ count: '100' })
            mockQueryBuilder.offset.mockResolvedValueOnce([])

            await manager.listMigrations('app_test123', { limit: 10, offset: 20 })

            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10)
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20)
        })

        it('should use default limit of 50', async () => {
            mockQueryBuilder.first.mockResolvedValueOnce({ count: '0' })
            mockQueryBuilder.offset.mockResolvedValueOnce([])

            await manager.listMigrations('app_test123')

            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50)
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0)
        })
    })

    describe('getMigration', () => {
        it('should return null when table does not exist', async () => {
            mockSchemaBuilder.hasTable.mockResolvedValueOnce(false)

            const result = await manager.getMigration('app_test123', 'mig-id')

            expect(result).toBeNull()
        })

        it('should return null when migration not found', async () => {
            mockQueryBuilder.first.mockResolvedValueOnce(null)

            const result = await manager.getMigration('app_test123', 'nonexistent-id')

            expect(result).toBeNull()
        })

        it('should return migration record with parsed meta', async () => {
            mockQueryBuilder.first.mockResolvedValueOnce({
                id: 'mig-123',
                name: '20260117_143022_test',
                applied_at: '2026-01-17T14:30:22Z',
                meta: JSON.stringify({
                    hasDestructive: false,
                    summary: 'Test migration',
                    changes: [],
                    snapshotBefore: null,
                    snapshotAfter: { version: 3 },
                }),
            })

            const result = await manager.getMigration('app_test123', 'mig-123')

            expect(result).not.toBeNull()
            expect(result!.id).toBe('mig-123')
            expect(result!.name).toBe('20260117_143022_test')
            expect(result!.appliedAt).toBeInstanceOf(Date)
            expect(result!.meta.hasDestructive).toBe(false)
            expect(result!.meta.summary).toBe('Test migration')
        })
    })
})
