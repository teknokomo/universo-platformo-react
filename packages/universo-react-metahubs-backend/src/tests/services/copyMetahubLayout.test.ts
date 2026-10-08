import { copyMetahubLayout } from '../../domains/layouts/services/copyMetahubLayout'
import { marketingLayoutZoneWidgets } from '../../domains/templates/data/marketing-page.layouts'
import { isUuidV7 } from '@universo-react/utils'
import { encodeWidgetConfigEnvelope, layoutInstanceKeySchema } from '@universo-react/types'
import { copyLayoutFixtureIds, copyLayoutFixtureSchema, createCopyMetahubLayoutFixture } from '../support/copyMetahubLayoutFixture'

describe('copyMetahubLayout', () => {
    it('copies a dashboard without widgets and disables default widget seeding', async () => {
        const { executor, trx, queries } = createCopyMetahubLayoutFixture()

        const copiedLayout = await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: false, name: { en: 'Main dashboard copy' } }
        })

        expect(copiedLayout.id).toBe(copyLayoutFixtureIds.created)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(trx.transaction).toHaveBeenCalledTimes(1)
        expect(queries.some(({ sql }) => sql.includes('pg_advisory_xact_lock'))).toBe(true)

        const sourceLock = queries.find(
            ({ sql, params }) =>
                sql.includes(`SELECT * FROM "${copyLayoutFixtureSchema}"."_mhb_layouts"`) &&
                sql.includes('FOR UPDATE') &&
                params[0] === copyLayoutFixtureIds.source
        )
        expect(sourceLock).toBeDefined()

        const layoutInsert = queries.find(({ sql }) => sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_layouts"`))
        expect(layoutInsert).toBeDefined()
        const config = JSON.parse(String(layoutInsert?.params[5])) as Record<string, unknown>
        expect(config.__layout.skipDefaultZoneWidgetSeed).toBe(true)
        expect(
            queries.some(
                ({ sql }) =>
                    sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_widgets"`) ||
                    sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_layout_widget_overrides"`)
            )
        ).toBe(false)
    })

    it('checks the source version under its row lock before writing a copy', async () => {
        const { executor, queries } = createCopyMetahubLayoutFixture({
            sourceLayout: { _upl_version: 2 }
        })

        await expect(
            copyMetahubLayout({
                executor,
                schemaName: copyLayoutFixtureSchema,
                layoutId: copyLayoutFixtureIds.source,
                userId: 'test-user-id',
                input: { copyWidgets: false, expectedVersion: 1, name: { en: 'Main dashboard copy' } }
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
            details: { operation: 'copy-layout' }
        })

        expect(queries.some(({ sql }) => sql.includes('pg_advisory_xact_lock'))).toBe(true)
        expect(
            queries.some(
                ({ sql, params }) =>
                    sql.includes(`SELECT * FROM "${copyLayoutFixtureSchema}"."_mhb_layouts"`) &&
                    sql.includes('FOR UPDATE') &&
                    params[0] === copyLayoutFixtureIds.source
            )
        ).toBe(true)
        expect(queries.some(({ sql }) => sql.includes('INSERT INTO'))).toBe(false)
    })

    it('reuses Entity bindings when registry copy policy permits sharing', async () => {
        const seededWidget = marketingLayoutZoneWidgets['marketing-main'].find(({ widgetKey }) => widgetKey === 'marketing.collection')
        if (!seededWidget) throw new Error('The Marketing Page template must seed a collection placement')
        if (!seededWidget.bindings) throw new Error('The Marketing Page collection placement must seed Entity bindings')
        const sourceWidgetConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: seededWidget.rendererConfig, neutral: { bindings: seededWidget.bindings } },
            { templateKey: 'marketing-page', widgetKey: seededWidget.widgetKey, zone: seededWidget.zone, requireBindings: true }
        )
        const sourceWidget = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a4',
            instance_key: '0190a9b5-3cde-7abc-8def-0123456789a5',
            parent_widget_id: null,
            slot_key: null,
            zone: seededWidget.zone,
            widget_key: seededWidget.widgetKey,
            sort_order: seededWidget.sortOrder,
            config: sourceWidgetConfig,
            is_active: seededWidget.isActive
        }
        const { executor, queries, copiedWidgetIds, committedWidgetRows } = createCopyMetahubLayoutFixture({
            sourceLayout: {
                template_key: 'marketing-page',
                config: { themeMode: 'system' }
            },
            sourceWidgets: [sourceWidget]
        })

        const copiedLayout = await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Marketing page copy' } }
        })

        const widgetInsert = queries.find(({ sql }) => sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_widgets"`))
        expect(widgetInsert).toBeDefined()
        expect(widgetInsert?.params[0]).toBe(copiedWidgetIds[0])
        expect(widgetInsert?.params[1]).toBe(copiedLayout.id)
        expect(widgetInsert?.params[6]).toBe('marketing.collection')
        expect(copiedWidgetIds).toHaveLength(1)
        expect(isUuidV7(copiedWidgetIds[0])).toBe(true)
        expect(copiedWidgetIds[0]).not.toBe(sourceWidget.id)

        const copiedInstanceKey = committedWidgetRows[0]?.instance_key
        expect(layoutInstanceKeySchema.safeParse(copiedInstanceKey).success).toBe(true)
        expect(copiedInstanceKey).not.toBe(sourceWidget.instance_key)

        const copiedWidgetConfig = JSON.parse(String(widgetInsert?.params[8])) as Record<string, unknown>
        expect(copiedWidgetConfig).not.toHaveProperty('instanceKey')
        const copiedNeutral = copiedWidgetConfig.__layout as Record<string, unknown>
        expect(copiedNeutral.bindings).toEqual(seededWidget.bindings)
        expect(queries.some(({ sql }) => /INSERT\s+INTO\s+"[^"]+"\."(?:obj|cmp)_[^"]+"/iu.test(sql))).toBe(false)
    })

    it('rejects reusing bindings when registry copy policy requires cloning the record', async () => {
        const seededHero = marketingLayoutZoneWidgets['marketing-main'].find(({ widgetKey }) => widgetKey === 'marketing.hero')
        if (!seededHero) throw new Error('The Marketing Page template must seed a Hero placement')
        const { executor, queries } = createCopyMetahubLayoutFixture({
            sourceLayout: { template_key: 'marketing-page', config: { themeMode: 'system' } },
            sourceWidgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789aa',
                    instance_key: '0190a9b5-3cde-7abc-8def-0123456789ab',
                    parent_widget_id: null,
                    slot_key: null,
                    zone: seededHero.zone,
                    widget_key: seededHero.widgetKey,
                    sort_order: seededHero.sortOrder,
                    config: seededHero.config,
                    is_active: seededHero.isActive
                }
            ]
        })

        await expect(
            copyMetahubLayout({
                executor,
                schemaName: copyLayoutFixtureSchema,
                layoutId: copyLayoutFixtureIds.source,
                userId: 'test-user-id',
                input: { copyWidgets: true, entityBindingCopyMode: 'reuse', name: { en: 'Invalid Hero copy' } }
            })
        ).rejects.toMatchObject({ statusCode: 409, code: 'VALIDATION_ERROR' })
        expect(queries.some(({ sql }) => sql.includes('INSERT INTO'))).toBe(false)
    })

    it('copies a nested placement graph with fresh UUID v7 identities and remapped parents', async () => {
        const sourceRootId = '0190a9b5-3cde-7abc-8def-0123456789b1'
        const sourceChildId = '0190a9b5-3cde-7abc-8def-0123456789b2'
        const sourceWidgets = [
            {
                id: sourceChildId,
                instance_key: '0190a9b5-3cde-7abc-8def-0123456789b4',
                parent_widget_id: sourceRootId,
                slot_key: 'column:main',
                zone: 'center',
                widget_key: 'quizWidget',
                sort_order: 1,
                config: {},
                is_active: true
            },
            {
                id: sourceRootId,
                instance_key: '0190a9b5-3cde-7abc-8def-0123456789b3',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                is_active: true
            }
        ]
        const { executor, queries, committedWidgetRows } = createCopyMetahubLayoutFixture({ sourceWidgets })

        await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: true, name: { en: 'Nested dashboard copy' } }
        })

        expect(committedWidgetRows).toHaveLength(2)
        const copiedRoot = committedWidgetRows.find(({ parent_widget_id }) => parent_widget_id === null)
        const copiedChild = committedWidgetRows.find(({ parent_widget_id }) => parent_widget_id !== null)
        expect(copiedRoot).toBeDefined()
        expect(copiedChild).toBeDefined()
        expect(copiedRoot?.id).not.toBe(sourceRootId)
        expect(copiedChild?.id).not.toBe(sourceChildId)
        expect(copiedChild?.parent_widget_id).toBe(copiedRoot?.id)
        expect(copiedChild?.slot_key).toBe('column:main')
        for (const id of committedWidgetRows.map(({ id }) => id)) expect(isUuidV7(id)).toBe(true)
        for (const { instance_key } of committedWidgetRows) expect(layoutInstanceKeySchema.safeParse(instance_key).success).toBe(true)
        expect(committedWidgetRows.map(({ instance_key }) => instance_key)).not.toContain('dashboard-root')
        expect(committedWidgetRows.map(({ instance_key }) => instance_key)).not.toContain('quiz-child')
        expect(queries.filter(({ sql }) => sql.includes('INSERT INTO') && sql.includes('_mhb_widgets'))).toHaveLength(2)
    })

    it('copies an overlay child while keeping its parent reference to the unchanged base placement', async () => {
        const baseRootId = copyLayoutFixtureIds.base
        const baseWidgets = [
            {
                id: baseRootId,
                instance_key: '0190a9b5-3cde-7abc-8def-0123456789a6',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                is_active: true
            }
        ]
        const sourceWidgets = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a7',
                instance_key: '0190a9b5-3cde-7abc-8def-0123456789a8',
                parent_widget_id: baseRootId,
                slot_key: 'column:main',
                zone: 'center',
                widget_key: 'quizWidget',
                sort_order: 1,
                config: {},
                is_active: true
            }
        ]
        const { executor, queries, committedWidgetRows } = createCopyMetahubLayoutFixture({
            sourceLayout: {
                scope_entity_id: copyLayoutFixtureIds.scopeEntity,
                base_layout_id: baseRootId
            },
            copiedLayout: {
                scope_entity_id: copyLayoutFixtureIds.scopeEntity,
                base_layout_id: baseRootId
            },
            baseWidgets,
            sourceWidgets
        })

        await copyMetahubLayout({
            executor,
            schemaName: copyLayoutFixtureSchema,
            layoutId: copyLayoutFixtureIds.source,
            userId: 'test-user-id',
            input: { copyWidgets: true, name: { en: 'Overlay dashboard copy' } }
        })

        expect(committedWidgetRows).toHaveLength(1)
        expect(committedWidgetRows[0]?.id).not.toBe(sourceWidgets[0]?.id)
        expect(committedWidgetRows[0]?.parent_widget_id).toBe(baseRootId)
        expect(committedWidgetRows[0]?.slot_key).toBe('column:main')
        const layoutInsert = queries.find(({ sql }) => sql.includes(`INSERT INTO "${copyLayoutFixtureSchema}"."_mhb_layouts"`))
        expect(layoutInsert?.params[1]).toBe(baseRootId)
        expect(
            queries.some(
                ({ sql, params }) => sql.includes('SELECT id, instance_key, parent_widget_id, slot_key') && params[0] === baseRootId
            )
        ).toBe(true)
    })

    it('rolls back the copied layout and earlier descendants if any subtree insert fails', async () => {
        const sourceWidgets = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                instance_key: 'rollback-root',
                parent_widget_id: null,
                slot_key: null,
                zone: 'center',
                widget_key: 'columnsContainer',
                sort_order: 1,
                config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                is_active: true
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789c2',
                instance_key: 'rollback-child',
                parent_widget_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                slot_key: 'column:main',
                zone: 'center',
                widget_key: 'quizWidget',
                sort_order: 1,
                config: {},
                is_active: true
            }
        ]
        const { executor, committedWidgetRows } = createCopyMetahubLayoutFixture({ sourceWidgets, failOnWidgetInsertAt: 2 })

        await expect(
            copyMetahubLayout({
                executor,
                schemaName: copyLayoutFixtureSchema,
                layoutId: copyLayoutFixtureIds.source,
                userId: 'test-user-id',
                input: { copyWidgets: true, name: { en: 'Failed nested copy' } }
            })
        ).rejects.toThrow('Injected copied widget insert failure')

        expect(committedWidgetRows).toHaveLength(0)
    })

    it('rejects and rolls back a subtree whose child points outside the source placement graph', async () => {
        const sourceWidgets = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789d1',
                instance_key: '0190a9b5-3cde-7abc-8def-0123456789d3',
                parent_widget_id: '0190a9b5-3cde-7abc-8def-0123456789d9',
                slot_key: 'column:main',
                zone: 'center',
                widget_key: 'quizWidget',
                sort_order: 1,
                config: {},
                is_active: true
            }
        ]
        const { executor, committedWidgetRows, queries } = createCopyMetahubLayoutFixture({ sourceWidgets })

        await expect(
            copyMetahubLayout({
                executor,
                schemaName: copyLayoutFixtureSchema,
                layoutId: copyLayoutFixtureIds.source,
                userId: 'test-user-id',
                input: { copyWidgets: true, name: { en: 'Invalid nested copy' } }
            })
        ).rejects.toThrow(/parent/u)

        expect(committedWidgetRows).toHaveLength(0)
        expect(queries.some(({ sql }) => sql.includes('INSERT INTO') && sql.includes('_mhb_widgets'))).toBe(false)
    })
})
