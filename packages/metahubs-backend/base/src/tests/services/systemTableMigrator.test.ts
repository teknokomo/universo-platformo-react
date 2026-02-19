import type { Knex } from 'knex'
import { SystemTableMigrator } from '../../domains/metahubs/services/SystemTableMigrator'
import { SYSTEM_TABLE_VERSIONS, type SystemTableDef } from '../../domains/metahubs/services/systemTableDefinitions'

describe('SystemTableMigrator', () => {
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
})
