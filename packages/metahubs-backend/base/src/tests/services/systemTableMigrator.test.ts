import type { Knex } from 'knex'
import { SystemTableMigrator } from '../../domains/metahubs/services/SystemTableMigrator'
import { SYSTEM_TABLE_VERSIONS, type SystemTableDef } from '../../domains/metahubs/services/systemTableDefinitions'

const mockMirrorToGlobalCatalog = jest.fn().mockResolvedValue('019ccefc-2f7b-7b36-82f4-85cdb1312268')
let mockHasRuntimeHistoryTable = false
const mockIsGlobalMigrationCatalogEnabled = jest.fn(() => true)

jest.mock('@universo/migrations-catalog', () => ({
    mirrorToGlobalCatalog: (...args: unknown[]) => mockMirrorToGlobalCatalog(...args)
}))

jest.mock('@universo/migrations-core', () => ({
    hasRuntimeHistoryTable: jest.fn(async () => mockHasRuntimeHistoryTable)
}))

jest.mock('@universo/utils', () => ({
    isGlobalMigrationCatalogEnabled: (...args: unknown[]) => mockIsGlobalMigrationCatalogEnabled(...args)
}))

describe('SystemTableMigrator', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMirrorToGlobalCatalog.mockResolvedValue('019ccefc-2f7b-7b36-82f4-85cdb1312268')
        mockHasRuntimeHistoryTable = false
        mockIsGlobalMigrationCatalogEnabled.mockReturnValue(true)
    })

    it('blocks automatic migration when destructive diff is detected', async () => {
        const fromVersion = 101
        const toVersion = 102

        const fromDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_test_table',
                description: 'Temporary test table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]
        const toDefinitions: SystemTableDef[] = []

        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(fromVersion, fromDefinitions)
        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(toVersion, toDefinitions)

        try {
            const mockKnex = {
                transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) => callback({}))
            } as unknown as Knex

            const migrator = new SystemTableMigrator(mockKnex, 'mhb_test_schema')
            const result = await migrator.migrate(fromVersion, toVersion)

            expect(result.success).toBe(false)
            expect(result.applied).toEqual([])
            expect(result.skippedDestructive).toEqual([expect.stringContaining('Drop table "_mhb_test_table"')])
            expect(result.error).toContain('Destructive system-table changes detected')
            expect(mockKnex.transaction).not.toHaveBeenCalled()
        } finally {
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(fromVersion)
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(toVersion)
        }
    })

    it('applies explicit table and index rename mappings as additive migration', async () => {
        const fromVersion = 201
        const toVersion = 202

        const fromDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_test_widgets_old',
                description: 'Old test widgets table',
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'layout_id', type: 'uuid', nullable: false }
                ],
                indexes: [{ name: 'idx_mhb_test_widgets_old_layout_id', columns: ['layout_id'] }]
            }
        ]
        const toDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_test_widgets_new',
                renamedFrom: ['_mhb_test_widgets_old'],
                description: 'New test widgets table',
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'layout_id', type: 'uuid', nullable: false }
                ],
                indexes: [
                    {
                        name: 'idx_mhb_test_widgets_new_layout_id',
                        renamedFrom: ['idx_mhb_test_widgets_old_layout_id'],
                        columns: ['layout_id']
                    }
                ]
            }
        ]

        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(fromVersion, fromDefinitions)
        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(toVersion, toDefinitions)

        try {
            const hasTable = jest.fn(async (tableName: string) => {
                if (tableName === '_mhb_test_widgets_old') return true
                if (tableName === '_mhb_test_widgets_new') return false
                if (tableName === '_mhb_migrations') return false
                return false
            })
            const renameTable = jest.fn(async () => undefined)
            const raw = jest.fn(async (sql: string, bindings: unknown[]) => {
                if (sql.includes('FROM pg_indexes')) {
                    const indexName = String(bindings[1] ?? '')
                    if (indexName === 'idx_mhb_test_widgets_old_layout_id') {
                        return { rows: [{ exists: 1 }] }
                    }
                    if (indexName === 'idx_mhb_test_widgets_new_layout_id') {
                        return { rows: [] }
                    }
                }
                return { rows: [] }
            })

            const trx = {
                schema: {
                    withSchema: jest.fn(() => ({
                        hasTable,
                        renameTable
                    }))
                },
                raw
            } as unknown as Knex

            const mockKnex = {
                transaction: jest.fn(async (callback: (trx: Knex) => Promise<unknown>) => callback(trx))
            } as unknown as Knex

            const migrator = new SystemTableMigrator(mockKnex, 'mhb_test_schema')
            const result = await migrator.migrate(fromVersion, toVersion)

            expect(result.success).toBe(true)
            expect(result.skippedDestructive).toEqual([])
            expect(result.applied).toEqual(
                expect.arrayContaining([
                    'Rename table "_mhb_test_widgets_old" to "_mhb_test_widgets_new"',
                    'Rename index "idx_mhb_test_widgets_old_layout_id" to "idx_mhb_test_widgets_new_layout_id" on "_mhb_test_widgets_new"'
                ])
            )
            expect(renameTable).toHaveBeenCalledWith('_mhb_test_widgets_old', '_mhb_test_widgets_new')
            expect(
                raw.mock.calls.some(([sql]) =>
                    String(sql).includes(
                        'ALTER INDEX "mhb_test_schema"."idx_mhb_test_widgets_old_layout_id" RENAME TO "idx_mhb_test_widgets_new_layout_id"'
                    )
                )
            ).toBe(true)
        } finally {
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(fromVersion)
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(toVersion)
        }
    })

    it('records a global runtime run id when _mhb_migrations exists', async () => {
        const fromVersion = 301
        const toVersion = 302

        const fromDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]
        const toDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'title', type: 'string', length: 255, nullable: true }
                ]
            },
            {
                name: '_mhb_migrations',
                description: 'Migration table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]

        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(fromVersion, fromDefinitions)
        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(toVersion, toDefinitions)

        try {
            const insert = jest.fn().mockResolvedValue(undefined)
            const hasColumn = jest.fn(async () => false)
            const createColumnBuilder = () => ({
                primary: jest.fn().mockReturnThis(),
                nullable: jest.fn().mockReturnThis(),
                notNullable: jest.fn().mockReturnThis(),
                defaultTo: jest.fn().mockReturnThis()
            })
            const trx = {
                schema: {
                    withSchema: jest.fn(() => ({
                        hasTable: jest.fn(async (tableName: string) => tableName === '_mhb_migrations'),
                        hasColumn,
                        alterTable: jest.fn(async (_tableName: string, callback: (table: Record<string, jest.Mock>) => void) => {
                            const table = {
                                uuid: jest.fn(() => createColumnBuilder()),
                                string: jest.fn(() => createColumnBuilder()),
                                text: jest.fn(() => createColumnBuilder()),
                                integer: jest.fn(() => createColumnBuilder()),
                                boolean: jest.fn(() => createColumnBuilder()),
                                jsonb: jest.fn(() => createColumnBuilder()),
                                timestamp: jest.fn(() => createColumnBuilder())
                            }
                            callback(table as never)
                        })
                    }))
                },
                withSchema: jest.fn(() => ({
                    into: jest.fn(() => ({
                        insert
                    }))
                })),
                raw: jest.fn().mockResolvedValue({ rows: [] })
            } as unknown as Knex

            const mockKnex = {
                raw: jest.fn().mockResolvedValue({ rows: [] }),
                fn: {
                    now: jest.fn(() => 'now()')
                },
                transaction: jest.fn(async (callback: (trxArg: Knex) => Promise<unknown>) => callback(trx))
            } as unknown as Knex

            const migrator = new SystemTableMigrator(mockKnex, 'mhb_test_schema')
            mockHasRuntimeHistoryTable = true
            const result = await migrator.migrate(fromVersion, toVersion)

            expect(result.success).toBe(true)
            expect(mockMirrorToGlobalCatalog).toHaveBeenCalledWith(
                expect.objectContaining({
                    scopeKind: 'runtime_schema',
                    scopeKey: 'mhb_test_schema',
                    sourceKind: 'system_sync',
                    localHistoryTable: '_mhb_migrations'
                })
            )
            expect(insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    meta: expect.objectContaining({
                        globalRunId: '019ccefc-2f7b-7b36-82f4-85cdb1312268'
                    })
                })
            )
        } finally {
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(fromVersion)
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(toVersion)
        }
    })

    it('keeps local _mhb_migrations history when the global catalog is disabled and omits globalRunId', async () => {
        const fromVersion = 401
        const toVersion = 402

        const fromDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]
        const toDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'title', type: 'string', length: 255, nullable: true }
                ]
            },
            {
                name: '_mhb_migrations',
                description: 'Migration table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]

        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(fromVersion, fromDefinitions)
        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(toVersion, toDefinitions)

        try {
            const insert = jest.fn().mockResolvedValue(undefined)
            const trx = {
                schema: {
                    withSchema: jest.fn(() => ({
                        hasTable: jest.fn(async (tableName: string) => tableName === '_mhb_migrations'),
                        hasColumn: jest.fn(async () => false),
                        alterTable: jest.fn(async (_tableName: string, callback: (table: Record<string, jest.Mock>) => void) => {
                            const createColumnBuilder = () => ({
                                primary: jest.fn().mockReturnThis(),
                                nullable: jest.fn().mockReturnThis(),
                                notNullable: jest.fn().mockReturnThis(),
                                defaultTo: jest.fn().mockReturnThis()
                            })
                            callback({
                                uuid: jest.fn(() => createColumnBuilder()),
                                string: jest.fn(() => createColumnBuilder()),
                                text: jest.fn(() => createColumnBuilder()),
                                integer: jest.fn(() => createColumnBuilder()),
                                boolean: jest.fn(() => createColumnBuilder()),
                                jsonb: jest.fn(() => createColumnBuilder()),
                                timestamp: jest.fn(() => createColumnBuilder())
                            } as never)
                        })
                    }))
                },
                withSchema: jest.fn(() => ({
                    into: jest.fn(() => ({ insert }))
                })),
                raw: jest.fn().mockResolvedValue({ rows: [] })
            } as unknown as Knex

            const mockKnex = {
                raw: jest.fn().mockResolvedValue({ rows: [] }),
                fn: {
                    now: jest.fn(() => 'now()')
                },
                transaction: jest.fn(async (callback: (trxArg: Knex) => Promise<unknown>) => callback(trx))
            } as unknown as Knex

            mockHasRuntimeHistoryTable = true
            mockIsGlobalMigrationCatalogEnabled.mockReturnValue(false)
            mockMirrorToGlobalCatalog.mockResolvedValueOnce(null)

            const migrator = new SystemTableMigrator(mockKnex, 'mhb_test_schema')
            const result = await migrator.migrate(fromVersion, toVersion)

            expect(result.success).toBe(true)
            expect(mockMirrorToGlobalCatalog).toHaveBeenCalledWith(
                expect.objectContaining({
                    globalCatalogEnabled: false,
                    localHistoryTable: '_mhb_migrations'
                })
            )
            expect(insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    meta: expect.not.objectContaining({
                        globalRunId: expect.anything()
                    })
                })
            )
        } finally {
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(fromVersion)
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(toVersion)
        }
    })

    it('fails closed when enabled-mode global catalog mirroring throws before local metahub history is inserted', async () => {
        const fromVersion = 501
        const toVersion = 502

        const fromDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]
        const toDefinitions: SystemTableDef[] = [
            {
                name: '_mhb_alpha',
                description: 'Alpha table',
                columns: [
                    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
                    { name: 'title', type: 'string', length: 255, nullable: true }
                ]
            },
            {
                name: '_mhb_migrations',
                description: 'Migration table',
                columns: [{ name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' }]
            }
        ]

        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(fromVersion, fromDefinitions)
        ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).set(toVersion, toDefinitions)

        try {
            const insert = jest.fn().mockResolvedValue(undefined)
            const trx = {
                schema: {
                    withSchema: jest.fn(() => ({
                        hasTable: jest.fn(async (tableName: string) => tableName === '_mhb_migrations'),
                        hasColumn: jest.fn(async () => false),
                        alterTable: jest.fn(async (_tableName: string, callback: (table: Record<string, jest.Mock>) => void) => {
                            const createColumnBuilder = () => ({
                                primary: jest.fn().mockReturnThis(),
                                nullable: jest.fn().mockReturnThis(),
                                notNullable: jest.fn().mockReturnThis(),
                                defaultTo: jest.fn().mockReturnThis()
                            })
                            callback({
                                uuid: jest.fn(() => createColumnBuilder()),
                                string: jest.fn(() => createColumnBuilder()),
                                text: jest.fn(() => createColumnBuilder()),
                                integer: jest.fn(() => createColumnBuilder()),
                                boolean: jest.fn(() => createColumnBuilder()),
                                jsonb: jest.fn(() => createColumnBuilder()),
                                timestamp: jest.fn(() => createColumnBuilder())
                            } as never)
                        })
                    }))
                },
                withSchema: jest.fn(() => ({
                    into: jest.fn(() => ({ insert }))
                })),
                raw: jest.fn().mockResolvedValue({ rows: [] })
            } as unknown as Knex

            const mockKnex = {
                raw: jest.fn().mockResolvedValue({ rows: [] }),
                fn: {
                    now: jest.fn(() => 'now()')
                },
                transaction: jest.fn(async (callback: (trxArg: Knex) => Promise<unknown>) => callback(trx))
            } as unknown as Knex

            mockHasRuntimeHistoryTable = true
            mockIsGlobalMigrationCatalogEnabled.mockReturnValue(true)
            mockMirrorToGlobalCatalog.mockRejectedValueOnce(new Error('catalog unavailable'))

            const migrator = new SystemTableMigrator(mockKnex, 'mhb_test_schema')
            const result = await migrator.migrate(fromVersion, toVersion)

            expect(result.success).toBe(false)
            expect(result.error).toBe('catalog unavailable')
            expect(insert).not.toHaveBeenCalled()
        } finally {
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(fromVersion)
            ;(SYSTEM_TABLE_VERSIONS as Map<number, SystemTableDef[]>).delete(toVersion)
        }
    })
})
