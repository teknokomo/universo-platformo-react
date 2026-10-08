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
    const placementLayoutId = '0190a9b5-3cde-7abc-8def-2123456789d1'
    const placementContainerId = '0190a9b5-3cde-7abc-8def-0123456789c6'
    const placementWidgetId = '0190a9b5-3cde-7abc-8def-0123456789c7'
    const placementConfig = { columns: [{ slotKey: 'column:main', width: 12 }] }

    const placementWidgetRow = (
        id: string,
        instanceKey: string,
        widgetKey: string,
        sortOrder: number,
        config: Record<string, unknown> = {},
        parentWidgetId: string | null = null,
        slotKey: string | null = null
    ): Record<string, unknown> => ({
        id,
        layout_id: placementLayoutId,
        zone: 'center',
        widget_key: widgetKey,
        instance_key: instanceKey,
        parent_widget_id: parentWidgetId,
        slot_key: slotKey,
        sort_order: sortOrder,
        config,
        is_active: true,
        version: 2
    })

    const primePlacementMove = (widgets: Array<Record<string, unknown>>) => {
        const db = createMockDbExecutor()
        primeLockedLayout(db.txExecutor, { layoutId: placementLayoutId, templateKey: 'dashboard', widgets })
        return db
    }

    const expectNoMutationQueries = (txExecutor: ReturnType<typeof createMockDbExecutor>['txExecutor']) => {
        const mutationQueries = txExecutor.query.mock.calls.filter(([sql]) => {
            const statement = String(sql)
            return /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(statement) || /^\s*WITH\s+updates\s+AS\b/iu.test(statement)
        })
        expect(mutationQueries).toEqual([])
    }

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
                    config: {},
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
                    config: {},
                    is_active: true,
                    version: 2
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'divider',
                    sort_order: 1,
                    config: {},
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
                    instance_key: 'spacer-c4',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: {},
                    is_customized: false,
                    is_active: true,
                    version: 3
                },
                {
                    id: '0190a9b5-3cde-7abc-8def-0123456789c3',
                    layout_id: '0190a9b5-3cde-7abc-8def-2123456789d1',
                    zone: 'right',
                    widget_key: 'spacer',
                    instance_key: 'spacer-c3',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 2,
                    config: {},
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
                    instance_key: 'spacer-c3',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 2,
                    config: {},
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
                    instance_key: 'spacer-c4',
                    parent_widget_id: null,
                    slot_key: null,
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
                    widget_key: 'divider',
                    instance_key: 'divider-c5',
                    parent_widget_id: null,
                    slot_key: null,
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
                    instance_key: 'spacer-c3',
                    parent_widget_id: null,
                    slot_key: null,
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
        expect(txExecutor.query.mock.calls[8]?.[0]).toContain('unnest($3::uuid[], $4::text[], $5::int[], $6::uuid[], $7::text[])')
        expect(txExecutor.query.mock.calls[8]?.[1]).toEqual([
            '0190a9b5-3cde-7abc-8def-2123456789d1',
            'user-1',
            ['0190a9b5-3cde-7abc-8def-0123456789c4', '0190a9b5-3cde-7abc-8def-0123456789c3'],
            ['left', 'right'],
            [1, 2],
            [null, null],
            [null, null]
        ])
    })

    it('rejects reordering before writes when an application-owned move would reorder a linked neighbor with order disabled', async () => {
        const linkedHeaderId = '0190a9b5-3cde-7abc-8def-0123456789c8'
        const sourceHeaderId = '0190a9b5-3cde-7abc-8def-0123456789c9'
        const { executor, txExecutor } = primePlacementMove([
            {
                ...placementWidgetRow(linkedHeaderId, 'source-header', 'header', 1),
                zone: 'top',
                source_widget_id: sourceHeaderId,
                source_base_widget_id: null
            },
            { ...placementWidgetRow(placementWidgetId, 'local-divider', 'divider', 2), zone: 'top' }
        ])

        await expect(
            moveApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                { widgetId: placementWidgetId, targetZone: 'top', targetIndex: 0, expectedVersion: 2 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('rejects deactivating an active container while an active child still depends on it', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main')
        ])

        await expect(
            toggleApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementContainerId,
                { expectedVersion: 2, isActive: false },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')

        expectNoMutationQueries(txExecutor)
    })

    it('rejects activating a child when its parent remains inactive', async () => {
        const { executor, txExecutor } = primePlacementMove([
            { ...placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig), is_active: false },
            {
                ...placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main'),
                is_active: false
            }
        ])

        await expect(
            toggleApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementWidgetId,
                { expectedVersion: 2, isActive: true },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')

        expectNoMutationQueries(txExecutor)
    })

    it('rejects an active-state override for a linked widget whose registry policy forbids it', async () => {
        const headerId = '0190a9b5-3cde-7abc-8def-0123456789c8'
        const sourceHeaderId = '0190a9b5-3cde-7abc-8def-0123456789c9'
        const { executor, txExecutor } = primePlacementMove([
            {
                ...placementWidgetRow(headerId, 'source-header', 'header', 1),
                zone: 'top',
                source_widget_id: sourceHeaderId,
                source_base_widget_id: null
            }
        ])

        await expect(
            toggleApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                headerId,
                { expectedVersion: 2, isActive: false },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expectNoMutationQueries(txExecutor)
    })

    it('assigns sibling-local order when moving into a parent slot while keeping the zone', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = placementLayoutId
        const containerId = placementContainerId
        const tableId = placementWidgetId

        primeLockedLayout(txExecutor, {
            layoutId,
            templateKey: 'dashboard',
            widgets: [
                {
                    id: containerId,
                    layout_id: layoutId,
                    zone: 'center',
                    widget_key: 'columnsContainer',
                    instance_key: 'results-columns',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    is_active: true,
                    version: 2
                },
                {
                    id: tableId,
                    layout_id: layoutId,
                    zone: 'center',
                    widget_key: 'detailsTable',
                    instance_key: 'results-table',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 2
                }
            ]
        })
        txExecutor.query.mockResolvedValueOnce([
            {
                id: tableId,
                layout_id: layoutId,
                zone: 'center',
                widget_key: 'detailsTable',
                instance_key: 'results-table',
                parent_widget_id: containerId,
                slot_key: 'column:main',
                sort_order: 1,
                config: {},
                is_customized: false,
                is_active: true,
                version: 3
            }
        ])

        const moved = await moveApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            layoutId,
            {
                widgetId: tableId,
                targetZone: 'center',
                targetIndex: 1,
                parentWidgetId: containerId,
                slotKey: 'column:main',
                expectedVersion: 2
            },
            'user-1'
        )

        const placementUpdate = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('WITH updates AS'))
        expect(placementUpdate?.[1]).toEqual([layoutId, 'user-1', [tableId], ['center'], [1], [containerId], ['column:main']])
        expect(moved).toEqual(expect.objectContaining({ parentWidgetId: containerId, slotKey: 'column:main', sortOrder: 1 }))
    })

    it('rejects a move with a missing parent before issuing a mutation query', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 2)
        ])

        await expect(
            moveApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                {
                    widgetId: placementWidgetId,
                    targetZone: 'center',
                    targetIndex: 1,
                    parentWidgetId: '0190a9b5-3cde-7abc-8def-0123456789c8',
                    slotKey: 'column:main',
                    expectedVersion: 2
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('renumbers only root siblings when moving a root beside a source-linked nested widget', async () => {
        const secondContainerId = '0190a9b5-3cde-7abc-8def-0123456789c8'
        const sourceReportId = '0190a9b5-3cde-7abc-8def-0123456789c9'
        const reportConfig = { variant: 'report', reportCodename: 'LearningContentSummary' }
        const movingContainer = placementWidgetRow(placementContainerId, 'moving-columns', 'columnsContainer', 1, placementConfig)
        const linkedNestedReport = {
            ...placementWidgetRow(placementWidgetId, 'source-report', 'detailsTable', 2, reportConfig, placementContainerId, 'column:main'),
            source_config: reportConfig,
            source_widget_id: sourceReportId,
            source_base_widget_id: sourceReportId
        }
        const secondContainer = placementWidgetRow(secondContainerId, 'second-columns', 'columnsContainer', 2, placementConfig)
        const { executor, txExecutor } = primePlacementMove([movingContainer, linkedNestedReport, secondContainer])
        txExecutor.query.mockResolvedValueOnce([
            {
                ...placementWidgetRow(secondContainerId, 'second-columns', 'columnsContainer', 1, placementConfig),
                source_config: null,
                source_widget_id: null,
                source_base_widget_id: null,
                is_customized: false,
                version: 3
            },
            {
                ...placementWidgetRow(placementContainerId, 'moving-columns', 'columnsContainer', 2, placementConfig),
                source_config: null,
                source_widget_id: null,
                source_base_widget_id: null,
                is_customized: false,
                version: 3
            }
        ])

        const moved = await moveApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            placementLayoutId,
            { widgetId: placementContainerId, targetZone: 'center', targetIndex: 1, expectedVersion: 2 },
            'user-1'
        )

        const placementUpdate = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('WITH updates AS'))
        expect(placementUpdate?.[1]).toEqual([
            placementLayoutId,
            'user-1',
            [secondContainerId, placementContainerId],
            ['center', 'center'],
            [1, 2],
            [null, null],
            [null, null]
        ])
        expect(placementUpdate?.[1]?.[2]).not.toContain(placementWidgetId)
        expect(moved).toEqual(expect.objectContaining({ id: placementContainerId, sortOrder: 2 }))
    })

    it('rejects a move into an unsupported container slot before issuing a mutation query', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 2)
        ])

        await expect(
            moveApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                {
                    widgetId: placementWidgetId,
                    targetZone: 'center',
                    targetIndex: 1,
                    parentWidgetId: placementContainerId,
                    slotKey: 'column:unknown',
                    expectedVersion: 2
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('rejects a cyclic self-parent move before issuing a mutation query', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig)
        ])

        await expect(
            moveApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                {
                    widgetId: placementContainerId,
                    targetZone: 'center',
                    targetIndex: 0,
                    parentWidgetId: placementContainerId,
                    slotKey: 'column:main',
                    expectedVersion: 2
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('rejects a single config update that invalidates a child placement before writing', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main')
        ])

        await expect(
            updateApplicationLayoutWidgetConfig(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementContainerId,
                {
                    expectedVersion: 2,
                    config: { columns: [{ slotKey: 'column:secondary', width: 12 }] }
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('rejects a batch config update that invalidates a child placement before writing', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main')
        ])
        txExecutor.query.mockResolvedValueOnce([
            {
                ...placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
                source_config: null,
                source_widget_id: null,
                source_base_widget_id: null,
                is_customized: false
            }
        ])

        await expect(
            updateApplicationLayoutWidgetConfigsBatch(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                {
                    updates: [
                        {
                            layoutId: placementLayoutId,
                            widgetId: placementContainerId,
                            expectedVersion: 2,
                            config: { columns: [{ slotKey: 'column:secondary', width: 12 }] }
                        }
                    ]
                },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('soft-deletes a container and its descendants in one version-checked write', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main')
        ])
        txExecutor.query.mockResolvedValueOnce([
            { id: placementContainerId, layout_id: placementLayoutId },
            { id: placementWidgetId, layout_id: placementLayoutId }
        ])

        await expect(
            deleteApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementContainerId,
                'user-1',
                2
            )
        ).resolves.toBe(true)

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        const deleteQuery = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('FROM unnest($3::uuid[], $4::int[])'))
        expect(deleteQuery?.[1]).toEqual(['user-1', placementLayoutId, [placementContainerId, placementWidgetId], [2, 2]])
        expect(String(deleteQuery?.[0])).toContain('COALESCE(w._upl_version, 1) = deletion_target.version')
        expect(String(deleteQuery?.[0])).toContain('_app_deleted = true')
        expect(String(deleteQuery?.[0])).toContain('"_app_widgets"')
        expect(String(deleteQuery?.[0])).toContain('WHERE w.id = deletion_target.id AND w.layout_id = $2')
        expect(String(deleteQuery?.[0])).toContain('RETURNING w.id, w.layout_id')
        expect(String(deleteQuery?.[0])).not.toMatch(/(?:DELETE\s+FROM|UPDATE)\s+.*(?:_app_objects|_mhb_objects)/iu)
    })

    it('deletes a source-linked overlay subtree from its application layout only', async () => {
        const baseLayoutId = '0190a9b5-3cde-7abc-8def-2123456789c8'
        const baseContainerId = '0190a9b5-3cde-7abc-8def-2123456789c9'
        const baseChildId = '0190a9b5-3cde-7abc-8def-2123456789ca'
        const container = {
            ...placementWidgetRow(placementContainerId, 'source-columns', 'columnsContainer', 1, placementConfig),
            source_widget_id: baseContainerId,
            source_base_widget_id: baseContainerId,
            source_config: null
        }
        const child = {
            ...placementWidgetRow(placementWidgetId, 'source-table', 'detailsTable', 1, {}, placementContainerId, 'column:main'),
            source_widget_id: baseChildId,
            source_base_widget_id: baseChildId,
            source_config: null
        }
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutRow = primeLockedLayout(txExecutor, {
            layoutId: placementLayoutId,
            templateKey: 'dashboard',
            sourceKind: 'application',
            config: { __layout: { composition: { mode: 'overlay', baseLayoutId } } },
            widgets: [container, child]
        })
        txExecutor.query
            .mockResolvedValueOnce([
                { id: placementContainerId, layout_id: placementLayoutId },
                { id: placementWidgetId, layout_id: placementLayoutId }
            ])
            .mockResolvedValueOnce([{ ...layoutRow, version: 3 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    template_key: 'dashboard',
                    scope_entity_id: null,
                    local_content_hash: 'a'.repeat(64),
                    source_content_hash: null
                }
            ])
            .mockResolvedValueOnce([{ id: placementLayoutId }])

        await expect(
            deleteApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementContainerId,
                'user-1',
                2
            )
        ).resolves.toBe(true)

        const deleteQuery = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('FROM unnest($3::uuid[], $4::int[])'))
        expect(deleteQuery?.[1]).toEqual(['user-1', placementLayoutId, [placementContainerId, placementWidgetId], [2, 2]])
        expect(String(deleteQuery?.[0])).toContain('WHERE w.id = deletion_target.id AND w.layout_id = $2')
        expect(String(deleteQuery?.[0])).toContain('RETURNING w.id, w.layout_id')

        const mutationSql = txExecutor.query.mock.calls
            .map(([sql]) => String(sql))
            .filter((sql) => /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(sql))
        expect(mutationSql.every((sql) => sql.includes('"_app_widgets"') || sql.includes('"_app_layouts"'))).toBe(true)
        expect(mutationSql.join('\n')).not.toMatch(/_mhb_widgets|_app_objects|_mhb_objects/iu)
    })

    it('rejects direct deletion of a source-owned descendant at the persistence boundary', async () => {
        const sourceWidget = {
            ...placementWidgetRow(placementWidgetId, 'source-table', 'detailsTable', 1, {}, placementContainerId, 'column:main'),
            source_widget_id: '0190a9b5-3cde-7abc-8def-2123456789d2',
            source_base_widget_id: null
        }
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'local-columns', 'columnsContainer', 1, placementConfig),
            sourceWidget
        ])

        await expect(
            deleteApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementWidgetId,
                'user-1',
                2
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expectNoMutationQueries(txExecutor)
    })

    it('uses registry source authority when an inherited placement has no persisted lineage ids', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        primeLockedLayout(txExecutor, {
            layoutId: placementLayoutId,
            templateKey: 'dashboard',
            sourceKind: 'metahub',
            widgets: [placementWidgetRow(placementWidgetId, 'source-table', 'detailsTable', 1)]
        })

        await expect(
            deleteApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementWidgetId,
                'user-1',
                2
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_INVALID')

        expectNoMutationQueries(txExecutor)
    })

    it('fails the whole subtree delete when any descendant optimistic version is stale', async () => {
        const { executor, txExecutor } = primePlacementMove([
            placementWidgetRow(placementContainerId, 'results-columns', 'columnsContainer', 1, placementConfig),
            placementWidgetRow(placementWidgetId, 'results-table', 'detailsTable', 1, {}, placementContainerId, 'column:main')
        ])
        txExecutor.query.mockResolvedValueOnce([{ id: placementContainerId, layout_id: placementLayoutId }])

        await expect(
            deleteApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                placementLayoutId,
                placementContainerId,
                'user-1',
                2
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')

        const deleteQuery = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('FROM unnest($3::uuid[], $4::int[])'))
        expect(deleteQuery?.[1]).toEqual(['user-1', placementLayoutId, [placementContainerId, placementWidgetId], [2, 2]])
        expect(String(deleteQuery?.[0])).toContain('COALESCE(w._upl_version, 1) = deletion_target.version')
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
