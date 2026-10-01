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
