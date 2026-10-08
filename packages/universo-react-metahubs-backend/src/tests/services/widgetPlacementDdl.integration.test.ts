import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { SystemTableDDLGenerator } from '../../domains/metahubs/services/SystemTableDDLGenerator'
import { SYSTEM_TABLES } from '../../domains/metahubs/services/systemTableDefinitions'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

describeIntegration('fresh metahub widget placement DDL (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL })
        schemaName = `mhb_widget_placement_${randomBytes(10).toString('hex')}`

        await knex.raw('CREATE SCHEMA ??', [schemaName])
        await knex.schema.withSchema(schemaName).createTable('_mhb_layouts', (table) => {
            table.uuid('id').primary()
        })

        const widgetsTable = SYSTEM_TABLES.find((table) => table.name === '_mhb_widgets')!
        await new SystemTableDDLGenerator(knex, schemaName).createTable(widgetsTable)
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

    it('accepts same-layout parents, rejects cross-layout references, and cascades subtree deletes', async () => {
        const layoutId = '019a0000-0000-7000-8000-000000000001'
        const otherLayoutId = '019a0000-0000-7000-8000-000000000002'
        const rootId = '019a0000-0000-7000-8000-000000000011'
        const childId = '019a0000-0000-7000-8000-000000000012'
        const crossLayoutChildId = '019a0000-0000-7000-8000-000000000019'

        await knex
            .withSchema(schemaName)
            .table('_mhb_layouts')
            .insert([{ id: layoutId }, { id: otherLayoutId }])

        const insertWidget = (row: Record<string, unknown>) =>
            knex
                .withSchema(schemaName)
                .table('_mhb_widgets')
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
        const placements = await knex
            .withSchema(schemaName)
            .table('_mhb_widgets')
            .select('id', 'parent_widget_id', 'slot_key')
            .orderBy('id')
        expect(placements).toEqual([
            { id: rootId, parent_widget_id: null, slot_key: null },
            { id: childId, parent_widget_id: rootId, slot_key: 'content' }
        ])

        await expect(
            insertWidget({
                id: crossLayoutChildId,
                layout_id: otherLayoutId,
                instance_key: 'cross-layout-parent',
                parent_widget_id: rootId,
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23503' })

        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000013',
                layout_id: layoutId,
                instance_key: 'bad-null-pair',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000014',
                layout_id: layoutId,
                instance_key: 'self-parent',
                parent_widget_id: '019a0000-0000-7000-8000-000000000014',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23514' })
        await expect(
            insertWidget({
                id: '019a0000-0000-7000-8000-000000000016',
                layout_id: otherLayoutId,
                instance_key: 'missing-parent',
                parent_widget_id: '019a0000-0000-7000-8000-000000000099',
                slot_key: 'content'
            })
        ).rejects.toMatchObject({ code: '23503' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000017', layout_id: layoutId, instance_key: 'root' })
        ).rejects.toMatchObject({ code: '23505' })
        await expect(
            insertWidget({ id: '019a0000-0000-7000-8000-000000000018', layout_id: layoutId, instance_key: null })
        ).rejects.toMatchObject({ code: '23502' })

        await knex.withSchema(schemaName).table('_mhb_widgets').where({ id: rootId }).delete()
        const remainingSubtreeRows = await knex.withSchema(schemaName).table('_mhb_widgets').whereIn('id', [rootId, childId])
        expect(remainingSubtreeRows).toEqual([])
    })
})
