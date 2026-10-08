import type { Knex } from 'knex'
import knexFactory from 'knex'
import { SystemTableDDLGenerator } from '../../domains/metahubs/services/SystemTableDDLGenerator'
import { SYSTEM_TABLES } from '../../domains/metahubs/services/systemTableDefinitions'

describe('SystemTableDDLGenerator widget placement DDL', () => {
    const schemaName = 'safe_schema'
    const widgetsTable = SYSTEM_TABLES.find((table) => table.name === '_mhb_widgets')!
    const realKnex = knexFactory({ client: 'pg' })

    afterAll(async () => {
        await realKnex.destroy()
    })

    it('compiles fresh widget table DDL with same-layout parent references', async () => {
        const rawSql: string[] = []
        let createTableCallback: ((table: Knex.CreateTableBuilder) => void) | undefined
        let alterTableCallback: ((table: Knex.TableBuilder) => void) | undefined
        const schemaBuilder = {
            hasTable: jest.fn().mockResolvedValue(false),
            createTable: jest.fn((_name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
                createTableCallback = callback
                return Promise.resolve()
            }),
            alterTable: jest.fn((_name: string, callback: (table: Knex.TableBuilder) => void) => {
                alterTableCallback = callback
                return Promise.resolve()
            })
        }
        const mockKnex = {
            schema: { withSchema: jest.fn(() => schemaBuilder) },
            raw: jest.fn((sql: string) => {
                rawSql.push(sql)
                return sql === 'public.uuid_generate_v7()' ? realKnex.raw(sql) : Promise.resolve(undefined)
            }),
            fn: { now: () => realKnex.fn.now() }
        } as unknown as Knex

        await new SystemTableDDLGenerator(mockKnex, schemaName).createTable(widgetsTable)

        expect(createTableCallback).toBeDefined()
        const compiledDdl = realKnex.schema
            .withSchema(schemaName)
            .createTable('_mhb_widgets', (table) => createTableCallback!(table))
            .toSQL()
        const createSql = compiledDdl.map((statement) => statement.sql).join('\n')
        expect(createSql).toContain('"instance_key" text not null')
        expect(createSql).toContain('"parent_widget_id" uuid null')
        expect(createSql).toContain('"slot_key" text null')
        expect(createSql).toContain('unique ("layout_id", "instance_key")')
        expect(createSql).toContain('unique ("layout_id", "id")')
        expect(createSql).not.toContain('foreign key ("parent_widget_id")')
        expect(alterTableCallback).toBeDefined()
        const alterSql = realKnex.schema
            .withSchema(schemaName)
            .alterTable('_mhb_widgets', (table) => alterTableCallback!(table))
            .toSQL()
            .map((statement) => statement.sql)
            .join('\n')
        expect(alterSql).toContain('foreign key ("layout_id", "parent_widget_id")')
        expect(alterSql).toContain('references "safe_schema"."_mhb_widgets" ("layout_id", "id") on delete CASCADE')
        expect(createSql).toContain(
            'check (((parent_widget_id IS NULL AND slot_key IS NULL) OR (parent_widget_id IS NOT NULL AND slot_key IS NOT NULL)))'
        )
        expect(createSql).toContain('check (parent_widget_id IS NULL OR parent_widget_id <> id)')
        expect(rawSql).toContain(
            'CREATE INDEX IF NOT EXISTS "idx_mhb_widgets_parent_graph" ON "safe_schema"."_mhb_widgets"("layout_id", "parent_widget_id", "slot_key", "sort_order", "id")'
        )
        expect(compiledDdl.every((statement) => statement.bindings.length === 0)).toBe(true)
    })

    it('keeps the existing-table idempotency boundary', async () => {
        const schemaBuilder = {
            hasTable: jest.fn().mockResolvedValue(true),
            createTable: jest.fn()
        }
        const mockKnex = {
            schema: { withSchema: jest.fn(() => schemaBuilder) },
            raw: jest.fn()
        } as unknown as Knex

        await new SystemTableDDLGenerator(mockKnex, schemaName).createTable(widgetsTable)

        expect(schemaBuilder.createTable).not.toHaveBeenCalled()
        expect(mockKnex.raw).not.toHaveBeenCalled()
    })
})
