import {
    deleteApplicationLayout,
    moveApplicationLayoutWidget,
    upsertApplicationLayoutWidget
} from '../../persistence/applicationLayoutsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationLayoutsStore', () => {
    it('reassigns the default layout when deleting the current default layout', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([]) // advisory lock
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
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
                    version: 4
                }
            ]) // detail layout row
            .mockResolvedValueOnce([]) // detail widgets
            .mockResolvedValueOnce([{ count: '1' }]) // other active rows
            .mockResolvedValueOnce([{ id: 'layout-1', layout_id: 'layout-1' }]) // soft delete
            .mockResolvedValueOnce([{ id: 'layout-2' }]) // next default candidate
            .mockResolvedValueOnce([]) // assign next default

        const deleted = await deleteApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', 'layout-1', 'user-1', 4)

        expect(deleted).toBe(true)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls[5]?.[0]).toContain('SELECT id')
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('CASE WHEN id = $2 THEN true ELSE false END')
        expect(txExecutor.query.mock.calls[6]?.[1]).toEqual([null, 'layout-2', 'user-1'])
    })

    it('rejects nested columnsContainer widgets through the shared widget-config schema', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                'layout-1',
                {
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    config: {
                        columns: [
                            {
                                id: 'col-1',
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

    it('reorders widgets with a single batch update query', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query
            .mockResolvedValueOnce([]) // advisory lock
            .mockResolvedValueOnce([
                {
                    id: 'widget-1',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'menuWidget',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 3
                },
                {
                    id: 'widget-2',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'header',
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 2
                },
                {
                    id: 'widget-3',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 4
                }
            ]) // current widgets
            .mockResolvedValueOnce([
                {
                    id: 'widget-2',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'header',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 3
                },
                {
                    id: 'widget-1',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'menuWidget',
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 4
                }
            ]) // batch widget update
            .mockResolvedValueOnce([
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
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
                    id: 'widget-2',
                    layout_id: 'layout-1',
                    zone: 'left',
                    widget_key: 'header',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 3
                },
                {
                    id: 'widget-3',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: {},
                    is_active: true,
                    version: 4
                },
                {
                    id: 'widget-1',
                    layout_id: 'layout-1',
                    zone: 'right',
                    widget_key: 'menuWidget',
                    sort_order: 2,
                    config: {},
                    is_active: true,
                    version: 4
                }
            ]) // detail widgets for refresh hash
            .mockResolvedValueOnce([]) // refresh hash update

        const moved = await moveApplicationLayoutWidget(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            'layout-1',
            {
                widgetId: 'widget-1',
                targetZone: 'right',
                targetIndex: 1,
                expectedVersion: 3
            },
            'user-1'
        )

        expect(moved).toEqual(
            expect.objectContaining({
                id: 'widget-1',
                zone: 'right',
                sortOrder: 2,
                version: 4
            })
        )
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(6)
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('WITH updates AS')
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('unnest($3::uuid[], $4::text[], $5::int[])')
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual(['layout-1', 'user-1', ['widget-2', 'widget-1'], ['left', 'right'], [1, 2]])
    })
})
