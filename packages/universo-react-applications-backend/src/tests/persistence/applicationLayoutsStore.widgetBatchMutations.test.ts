import {
    deleteApplicationLayoutWidget,
    moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutWidgetConfigsBatch
} from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'
import {
    scopedBatchLayoutIdA,
    scopedBatchLayoutIdB,
    independentLayoutConfig,
    primeLockedLayout
} from './applicationLayoutsStore.test-utils'

describe('applicationLayoutsStore batch widget mutations', () => {
    it('binds direct widget mutations to the route layout and fails closed for an id mismatch', async () => {
        const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
        const routeLayoutId = '018f8a78-7b8f-7c1d-a111-2222333345a1'

        const updateDb = createMockDbExecutor()
        primeLockedLayout(updateDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        const updateResult = await updateApplicationLayoutWidgetConfig(
            updateDb.executor,
            'app_018f8a787b8f7c1da111222233334444',
            routeLayoutId,
            widgetId,
            { expectedVersion: 2, config: {} },
            'user-1'
        )
        expect(updateResult).toBeNull()
        expect(updateDb.txExecutor.query.mock.calls).toHaveLength(8)

        const toggleDb = createMockDbExecutor()
        primeLockedLayout(toggleDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        const toggleResult = await toggleApplicationLayoutWidget(
            toggleDb.executor,
            'app_018f8a787b8f7c1da111222233334444',
            routeLayoutId,
            widgetId,
            { expectedVersion: 2, isActive: false },
            'user-1'
        )
        expect(toggleResult).toBeNull()
        expect(toggleDb.txExecutor.query.mock.calls).toHaveLength(8)

        const deleteDb = createMockDbExecutor()
        primeLockedLayout(deleteDb.txExecutor, { layoutId: routeLayoutId, templateKey: 'dashboard' })
        await expect(
            deleteApplicationLayoutWidget(deleteDb.executor, 'app_018f8a787b8f7c1da111222233334444', routeLayoutId, widgetId, 'user-1', 2)
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        const deleteMutation = deleteDb.txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('id = $1 AND layout_id = $3'))
        expect(deleteMutation).toBeUndefined()
    })

    it('reorders widgets with a single batch update query', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, {
            layoutId: '0190a9b5-3cde-7abc-8def-2123456789d1',
            templateKey: 'dashboard',
            widgets: [
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: { items: [] },
                    is_customized: false,
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: { items: [] },
                    is_active: true,
                    version: 2
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'productTree',
                    sort_order: 1,
                    config: { items: [] },
                    is_active: true,
                    version: 4
                }
            ]
        })
        txExecutor.query
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: { items: [] },
                    is_customized: false,
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: { items: [] },
                    is_customized: false,
                    is_active: true,
                    version: 4
                }
            ]) // batch widget update
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: { items: [] },
                    is_customized: false,
                    is_active: true,
                    version: 4
                }
            ]) // moved widget config update
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: independentLayoutConfig,
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'application',
                    source_layout_id: null,
                    source_snapshot_hash: null,
                    source_content_hash: null,
                    local_content_hash: 'hash-local',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    source_deleted_at: null,
                    source_deleted_by: null,
                    version: 5
                }
            ]) // detail layout row for refresh hash
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c4',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'left',
                    widget_key: 'spacer',
                    sort_order: 1,
                    config: {},
                    is_customized: false,
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'productTree',
                    sort_order: 1,
                    config: {},
                    is_customized: false,
                    is_active: true,
                    version: 4
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'spacer',
                    sort_order: 2,
                    config: {},
                    is_customized: false,
                    is_active: true,
                    version: 4
                }
            ]) // detail widgets for refresh hash
            .mockResolvedValueOnce([{ id: '0190a9b5-3cde-7abc-8def-2123456789d1' }]) // refresh hash update

        const moved = await moveApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            '0190a9b5-3cde-7abc-8def-2123456789d1',
            {
                widgetId: '0190a9b5-3cde-7abc-8def-0123456789c3',
                targetZone: 'right',
                targetIndex: 1,
                expectedVersion: 3
            },
            'user-1'
        )

        expect(moved).toEqual(
            expect.objectContaining({
                id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                zone: 'right',
                sortOrder: 2,
                version: 4
            })
        )
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(13)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('WITH updates AS')
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('unnest($3::uuid[], $4::text[], $5::int[])')
        expect(txExecutor.query.mock.calls[8]?.[1]).toEqual([
            '0190a9b5-3cde-7abc-8def-2123456789d1',
            'user-1',
            ['0190a9b5-3cde-7abc-8def-0123456789c4', '0190a9b5-3cde-7abc-8def-0123456789c3'],
            ['left', 'right'],
            [1, 2]
        ])
    })

    it('rejects stale batch widget configs before applying any update', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdB, templateKey: 'dashboard', includeStructureLock: false })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                layout_id: scopedBatchLayoutIdA,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 7
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                layout_id: scopedBatchLayoutIdB,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 5
            }
        ])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            expectedVersion: 7,
                            config: { matrixMode: 'hierarchicalCells' }
                        },
                        {
                            layoutId: scopedBatchLayoutIdB,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                            expectedVersion: 6,
                            config: { matrixMode: 'hierarchicalCells' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual(['app_018f8a787b8f7c1da111222233334444:interpretation-network:structure-mode'])
        expect(txExecutor.query).toHaveBeenCalledTimes(16)
        expect(txExecutor.query.mock.calls[15]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[15]?.[0]).toContain('UNNEST($1::uuid[], $2::uuid[])')
        expect(txExecutor.query.mock.calls[15]?.[1]).toEqual([
            [scopedBatchLayoutIdA, scopedBatchLayoutIdB],
            ['018f8a78-7b8f-7c1d-a111-2222333344a1', '018f8a78-7b8f-7c1d-a111-2222333344a2']
        ])
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })

    it('rejects batch widget configs when the widget is not owned by the requested layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        primeLockedLayout(txExecutor, { layoutId: scopedBatchLayoutIdA, templateKey: 'dashboard' })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                layout_id: scopedBatchLayoutIdB,
                zone: 'main',
                widget_key: 'interpretationNetworkWorkspace',
                sort_order: 0,
                config: {},
                is_active: true,
                version: 7
            }
        ])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: scopedBatchLayoutIdA,
                            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            expectedVersion: 7,
                            config: { matrixMode: 'hierarchicalCells' }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('(layout_id, id)')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('SET config = $2::jsonb'))).toBe(false)
    })
})
