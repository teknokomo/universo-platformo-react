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
            raw: jest.fn((sql: string, bindings?: unknown[]) => {
                if (sql === 'public.uuid_generate_v7()') return realKnex.raw(sql)
                rawSql.push(realKnex.raw(sql, bindings).toQuery())
                return Promise.resolve(undefined)
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
        expect(createSql).not.toContain('unique ("layout_id", "id")')
        expect(createSql).toContain('foreign key ("parent_widget_id")')
        expect(createSql).toContain('references "safe_schema"."_mhb_widgets" ("id") on delete CASCADE')
        expect(alterTableCallback).toBeUndefined()
        expect(createSql).toContain(
            'check (((parent_widget_id IS NULL AND slot_key IS NULL) OR (parent_widget_id IS NOT NULL AND slot_key IS NOT NULL)))'
        )
        expect(createSql).toContain('check (parent_widget_id IS NULL OR parent_widget_id <> id)')
        expect(rawSql).toContain(
            'CREATE INDEX IF NOT EXISTS "idx_mhb_widgets_parent_graph" ON "safe_schema"."_mhb_widgets"("layout_id", "parent_widget_id", "slot_key", "sort_order", "id")'
        )
        expect(rawSql.some((sql) => sql.includes('CREATE OR REPLACE FUNCTION "safe_schema"."validate_mhb_widget_parent_layout"'))).toBe(
            true
        )
        expect(
            rawSql.some((sql) => sql.includes('CREATE OR REPLACE TRIGGER "trg_mhb_widgets_parent_layout" AFTER INSERT OR UPDATE OF'))
        ).toBe(true)
        expect(rawSql.some((sql) => sql.includes('CREATE OR REPLACE TRIGGER "trg_mhb_layouts_widget_parent_layout" AFTER UPDATE OF'))).toBe(
            true
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
