import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { SchemaGenerator } from '../SchemaGenerator'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

describeIntegration('fresh application widget placement DDL (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL })
        schemaName = `app_${randomBytes(16).toString('hex')}`

        const generator = new SchemaGenerator(knex)
        await generator.createSchema(schemaName)
        await generator.ensureSystemTables(schemaName, undefined, {
            includeComponents: false,
            includeValues: false,
            includeLayouts: true,
            includeWidgets: true
        })
    })

    afterAll(async () => {
        if (knex) {
            try {
                if (schemaName) await knex.raw('DROP SCHEMA IF EXISTS ?? CASCADE', [schemaName])
            } finally {
                await knex.destroy()
            }
        }
    })

    it('keeps fresh widget DDL idempotent and rejects invalid placement relationships', async () => {
        const layoutId = '019a0000-0000-7000-8000-000000000101'
        const otherLayoutId = '019a0000-0000-7000-8000-000000000102'
        const rootId = '019a0000-0000-7000-8000-000000000111'
        const childId = '019a0000-0000-7000-8000-000000000112'

        await knex
            .withSchema(schemaName)
            .table('_app_layouts')
            .insert([{ id: layoutId }, { id: otherLayoutId }])

        const insertWidget = (row: Record<string, unknown>) =>
            knex
                .withSchema(schemaName)
                .table('_app_widgets')
                .insert({
                    zone: 'main',
                    widget_key: 'testWidget',
                    config: {},
                    is_active: true,
                    ...row
                })

        await insertWidget({ id: rootId, layout_id: layoutId, instance_key: 'root' })
        await insertWidget({
            id: childId,
            layout_id: layoutId,
            instance_key: 'child',
            parent_widget_id: rootId,
            slot_key: 'content'
        })

        const generator = new SchemaGenerator(knex)
        await generator.ensureSystemTables(schemaName, undefined, {
            includeComponents: false,
            includeValues: false,
            includeLayouts: true,
            includeWidgets: true
        })
        const placements = await knex
            .withSchema(schemaName)
            .table('_app_widgets')
            .select('id', 'parent_widget_id', 'slot_key')
            .orderBy('id')
        expect(placements).toEqual([
            { id: rootId, parent_widget_id: null, slot_key: null },
            { id: childId, parent_widget_id: rootId, slot_key: 'content' }
        ])

        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000113',
                layout_id: layoutId,
                instance_key: 'bad-null-pair',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000114',
                layout_id: layoutId,
                instance_key: 'self-parent',
                parent_widget_id: '019a0000-0000-7000-8000-000000000114',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000115',
                layout_id: otherLayoutId,
                instance_key: 'cross-layout-parent',
                parent_widget_id: rootId,
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23503' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000116', layout_id: layoutId, instance_key: 'root' })
        ).rejects.toMatchObject({ code: '23505' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000117', layout_id: layoutId, instance_key: null })
        ).rejects.toMatchObject({ code: '23502' })
    })
})
