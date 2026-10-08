import * as layoutTypes from '@universo-react/types'
import { copyApplicationLayout, updateApplicationLayout, upsertApplicationLayoutWidget } from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'
import { primeLockedLayout } from './applicationLayoutsStore.test-utils'

describe('applicationLayoutsStore widget mutations', () => {
    it('rejects nested columnsContainer widgets through the shared widget-config schema', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d1',
                {
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    expectedVersion: 1,
                    config: {
                        columns: [
                            {
                                id: '0190a9b5-3cde-7abc-8def-2123456789d5',
                                width: 6,
                                widgets: [{ widgetKey: 'columnsContainer' }]
                            }
                        ]
                    }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')
    })

    it('rejects a valid dashboard widget when the parent layout is marketing-page', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, { layoutId: '0190a9b5-3cde-7abc-8def-2123456789d8', templateKey: 'marketing-page' })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                {
                    zone: 'top',
                    widgetKey: 'header',
                    expectedVersion: 1,
                    config: {}
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(txExecutor.query.mock.calls.map(([sql]) => String(sql)).some((sql) => sql.includes('INSERT INTO'))).toBe(false)
    })

    it('rejects a second Dashboard appNavbar instance under the locked layout mutation', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d9',
            templateKey: 'dashboard',
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789da',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d9',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 1,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d9',
                { zone: 'top', widgetKey: 'appNavbar', expectedVersion: 1, config: {} },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it.each([
        { widgetKey: 'appNavbar', zone: 'top', config: {} },
        { widgetKey: 'header', zone: 'top', config: {} },
        { widgetKey: 'detailsTable', zone: 'center', config: { variant: 'report', reportCodename: 'sales-summary' } }
    ])('fails closed when the registry denies first application Add for $widgetKey', async ({ widgetKey, zone, config }) => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789df'
        primeLockedLayout(txExecutor, { layoutId, templateKey: 'dashboard', sourceKind: 'metahub' })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                layoutId,
                { zone, widgetKey, expectedVersion: 1, config } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it.each([
        { widgetKey: 'header', zone: 'top', config: {} },
        { widgetKey: 'detailsTable', zone: 'center', config: { variant: 'report', reportCodename: 'sales-summary' } }
    ])('rejects host/entity-backed $widgetKey additions to an application-owned layout', async ({ widgetKey, zone, config }) => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789df'
        primeLockedLayout(txExecutor, { layoutId, templateKey: 'dashboard', sourceKind: 'application' })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                layoutId,
                { zone, widgetKey, expectedVersion: 1, config } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('allows an application-owned layout to add a self-contained structural divider', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789df'
        primeLockedLayout(txExecutor, { layoutId, templateKey: 'dashboard', sourceKind: 'application' })
        txExecutor.query.mockImplementation(async (sql: unknown, parameters: unknown[] = []) => {
            if (typeof sql !== 'string' || !sql.includes('INSERT INTO')) return []
            return [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789e2',
                    layout_id: layoutId,
                    zone: 'top',
                    widget_key: 'divider',
                    instance_key: String(parameters[3]),
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        const addedWidget = await upsertApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            { zone: 'top', widgetKey: 'divider', expectedVersion: 1, config: {} },
            'user-1'
        )

        expect(addedWidget).toMatchObject({ widgetKey: 'divider', sourceWidgetId: null, sourceBaseWidgetId: null })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(true)
    })

    it('rejects source ownership fields on an application-owned structural placement', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789df'
        const sourceWidgetId = '0190a9b5-3cde-7abc-8def-2123456789e1'
        primeLockedLayout(txExecutor, { layoutId, templateKey: 'dashboard' })

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                layoutId,
                {
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    expectedVersion: 1,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    sourceWidgetId,
                    sourceBaseWidgetId: sourceWidgetId
                } as never,
                'user-1'
            )
        ).rejects.toThrow()

        expect(executor.transaction).not.toHaveBeenCalled()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects a graph-invalid application Add before issuing an insert', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789df'
        const missingParentId = '0190a9b5-3cde-7abc-8def-2123456789e0'
        const config = { columns: [{ slotKey: 'column:main', width: 12 }] }
        primeLockedLayout(txExecutor, { layoutId, templateKey: 'dashboard' })

        const registeredDefinition = layoutTypes.LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'columnsContainer')
        if (!registeredDefinition) throw new Error('The columns container widget must be registered')
        const applicationAuthoring = registeredDefinition.authoring.application
        const originalCanAdd = applicationAuthoring.canAdd
        applicationAuthoring.canAdd = true

        try {
            await expect(
                upsertApplicationLayoutWidget(
                    executor,
                    'app_018f8a787b8f7c1da111222233334444',
                    layoutId,
                    {
                        zone: 'center',
                        widgetKey: 'columnsContainer',
                        parentWidgetId: missingParentId,
                        slotKey: 'column:main',
                        expectedVersion: 1,
                        config
                    } as never,
                    'user-1'
                )
            ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        } finally {
            applicationAuthoring.canAdd = originalCanAdd
        }

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
    })

    it('fails closed on an already-persisted duplicate Dashboard singleton before copying', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d9',
            templateKey: 'dashboard',
            includeStructureLock: false,
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789db',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d9',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 1,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789dc',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d9',
                    zone: 'top',
                    widget_key: 'appNavbar',
                    sort_order: 2,
                    config: {},
                    source_config: null,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            copyApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d9',
                { expectedVersion: 1 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rejects unknown widget mutation fields before opening a transaction', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d9',
                { zone: 'top', widgetKey: 'header', expectedVersion: 1, config: {}, unknownField: true } as never,
                'user-1'
            )
        ).rejects.toThrow()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('rejects reserved layout and widget metadata at renderer-config mutation boundaries', async () => {
        const layoutDb = createMockDbExecutor()
        primeLockedLayout(layoutDb.txExecutor, { layoutId: '0190a9b5-3cde-7abc-8def-2123456789d9', templateKey: 'dashboard' })

        await expect(
            updateApplicationLayout(
                layoutDb.executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d9',
                { expectedVersion: 1, config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } } },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_RESERVED_METADATA')

        const widgetDb = createMockDbExecutor()
        await expect(
            upsertApplicationLayoutWidget(
                widgetDb.executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d9',
                {
                    zone: 'top',
                    widgetKey: 'header',
                    expectedVersion: 1,
                    config: { __layout: { placement: 'start' } }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_RESERVED_METADATA')
        expect(widgetDb.executor.transaction).not.toHaveBeenCalled()
    })
})
