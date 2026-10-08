import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    configureSyncLayoutPersistenceKnexAccessor,
    createMockSyncKnex,
    mockSqlQuery,
    mockSyncExecutor,
    persistPublishedLayouts,
    persistPublishedWidgets,
    resetSyncLayoutPersistenceMocks,
    type MockSyncKnex
} from './syncLayoutPersistenceHarness'
import { createScopedEntity, createSnapshot, dashboardIds } from './syncLayoutPersistenceFixtures'

let currentKnex: MockSyncKnex
configureSyncLayoutPersistenceKnexAccessor(() => currentKnex)

describe('syncLayoutPersistenceReconciliation', () => {
    beforeEach(() => {
        resetSyncLayoutPersistenceMocks()
        currentKnex = createMockSyncKnex()
    })

    it('keeps local widget configuration untouched when keep_local preserves a locally modified layout', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { sideMenu: { primaryMode: 'compact' } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    owner_id: null,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_snapshot_hash: 'snapshot-old',
                    source_content_hash: 'old-source-hash',
                    local_content_hash: 'local-custom-hash',
                    sync_state: 'local_modified',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    zone: 'center',
                    widget_key: 'columnsContainer',
                    instance_key: 'columns-main',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: { columns: [{ slotKey: 'column:local', width: 12 }] },
                    source_config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot: createSnapshot(),
            userId: 'user-1',
            layoutResolutionPolicy: {
                bySourceLayoutId: {
                    [dashboardIds.layout]: 'keep_local'
                }
            }
        })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows[0]?.source_snapshot_hash).toBe('snapshot-new')
        expect(currentKnex.layoutRows[0]?.sync_state).toBe('local_modified')
        expect(currentKnex.widgetRows[0]?.config).toEqual({ columns: [{ slotKey: 'column:local', width: 12 }] })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot: createSnapshot(),
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows[0]?.config).toEqual({ sideMenu: { primaryMode: 'compact' } })
        expect(currentKnex.layoutRows[0]?.source_content_hash).toBeDefined()
        expect(currentKnex.layoutRows[0]?.sync_state).toBe('local_modified')
    })

    it('does not advance an unresolved source baseline or overwrite local state on a repeated sync', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { sideMenu: { primaryMode: 'compact' } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    owner_id: null,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_snapshot_hash: 'snapshot-old',
                    source_content_hash: 'old-source-hash',
                    local_content_hash: 'local-custom-hash',
                    sync_state: 'local_modified',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot = createSnapshot()
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot,
            userId: 'user-1'
        })
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot,
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows[0]).toMatchObject({
            config: { sideMenu: { primaryMode: 'compact' } },
            source_snapshot_hash: 'snapshot-old',
            source_content_hash: 'old-source-hash',
            sync_state: 'conflict'
        })
    })

    it('keeps a clean local layout and its accepted baseline when skip_source is selected', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { sideMenu: { primaryMode: 'overlay' } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_snapshot_hash: 'snapshot-old',
                    source_content_hash: 'old-source-hash',
                    local_content_hash: 'old-source-hash',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot = createSnapshot()
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot,
            userId: 'user-1',
            layoutResolutionPolicy: { default: 'skip_source' }
        })

        expect(currentKnex.layoutRows[0]).toMatchObject({
            config: { sideMenu: { primaryMode: 'overlay' } },
            source_snapshot_hash: 'snapshot-old',
            source_content_hash: 'old-source-hash',
            local_content_hash: 'old-source-hash',
            sync_state: 'source_updated'
        })
    })

    it('keeps an application-owned Interpretation Network mode override during metahub re-sync', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { sideMenu: { primaryMode: 'compact' } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    owner_id: null,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_snapshot_hash: 'snapshot-old',
                    source_content_hash: 'old-source-hash',
                    local_content_hash: 'local-custom-hash',
                    sync_state: 'local_modified',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    instance_key: 'interpretation-network',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: { structureMode: 'multiple', templatePanel: { showInStructureList: false, showInMatrix: true } },
                    source_config: { structureMode: 'singleSystem', templatePanel: { showInStructureList: true, showInMatrix: true } },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })
        const snapshot: PublishedApplicationSnapshot = {
            ...createSnapshot(),
            layoutZoneWidgets: [
                {
                    id: dashboardIds.widget,
                    layoutId: dashboardIds.layout,
                    zone: 'center',
                    widgetKey: 'interpretationNetworkWorkspace',
                    instanceKey: 'interpretation-network',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: dashboardIds.widget,
                    sourceBaseWidgetId: null,
                    sortOrder: 1,
                    config: { structureMode: 'singleSystem', templatePanel: { showInStructureList: true, showInMatrix: true } },
                    isActive: true
                }
            ]
        }

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshotHash: 'snapshot-new',
            snapshot,
            userId: 'user-1',
            layoutResolutionPolicy: { bySourceLayoutId: { [dashboardIds.layout]: 'keep_local' } }
        })
        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })

        expect(currentKnex.widgetRows[0]?.config).toEqual({
            structureMode: 'multiple',
            templatePanel: { showInStructureList: false, showInMatrix: true }
        })
        expect(currentKnex.widgetRows[0]?.source_config).toEqual({
            structureMode: 'singleSystem',
            templatePanel: { showInStructureList: true, showInMatrix: true }
        })
    })

    it('removes the reset source when a metahub widget disappears from a locally modified layout', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    source_layout_id: dashboardIds.layout,
                    source_kind: 'metahub',
                    sync_state: 'local_modified',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    instance_key: 'interpretation-network',
                    parent_widget_id: null,
                    slot_key: null,
                    widget_key: 'interpretationNetworkWorkspace',
                    config: { structureMode: 'multiple' },
                    source_config: { structureMode: 'singleSystem' },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })
        const snapshot: PublishedApplicationSnapshot = {
            ...createSnapshot(),
            layoutZoneWidgets: []
        }

        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })

        expect(currentKnex.widgetRows[0]).toMatchObject({
            config: { structureMode: 'multiple' },
            source_config: null
        })
    })

    it('tombstones removed inherited widgets without losing their physical row and restores it on resync', async () => {
        const physicalWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b0'
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: physicalWidgetId,
                    layout_id: dashboardIds.layout,
                    widget_key: 'columnsContainer',
                    zone: 'center',
                    instance_key: 'columns-main',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 0,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    source_config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })

        const removedSnapshot = { ...createSnapshot(), layoutZoneWidgets: [] }
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: removedSnapshot,
            userId: 'user-1'
        })

        expect(currentKnex.widgetRows).toHaveLength(1)
        expect(currentKnex.widgetRows[0]).toMatchObject({
            id: physicalWidgetId,
            _upl_deleted: true,
            _app_deleted: false,
            is_active: false
        })

        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })

        expect(currentKnex.widgetRows).toHaveLength(1)
        expect(currentKnex.widgetRows[0]).toMatchObject({
            id: physicalWidgetId,
            _upl_deleted: false,
            _app_deleted: false,
            is_active: true
        })
    })

    it('tombstones dependent widgets on source layout removal and restores them on safe resync', async () => {
        const initialSnapshot: PublishedApplicationSnapshot = {
            ...createSnapshot(),
            entities: {
                [dashboardIds.homeEntity]: createScopedEntity(dashboardIds.homeEntity, 'Home')
            },
            scopedLayouts: [
                {
                    id: dashboardIds.homeLayout,
                    scopeEntityId: dashboardIds.homeEntity,
                    baseLayoutId: dashboardIds.layout,
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Home' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ]
        }

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: initialSnapshot,
            snapshotHash: 'snapshot-with-scoped-layout',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: initialSnapshot,
            userId: 'user-1'
        })

        const scopedLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)
        const inheritedWidget = currentKnex.widgetRows.find((row) => row.layout_id === scopedLayout?.id)
        expect(inheritedWidget).toMatchObject({
            source_widget_id: dashboardIds.widget,
            source_base_widget_id: dashboardIds.widget,
            _upl_deleted: false,
            _app_deleted: false,
            is_active: true
        })
        const inheritedWidgetId = inheritedWidget?.id

        const removedSnapshot: PublishedApplicationSnapshot = {
            ...initialSnapshot,
            entities: {},
            scopedLayouts: []
        }
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: removedSnapshot,
            snapshotHash: 'snapshot-without-scoped-layout',
            userId: 'user-1'
        })

        const removedLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)
        expect(removedLayout).toMatchObject({ is_active: false, is_default: false, sync_state: 'source_removed' })
        expect(currentKnex.widgetRows.find((row) => row.id === inheritedWidgetId)).toMatchObject({
            _upl_deleted: true,
            _app_deleted: false,
            is_active: false
        })
        const versionAfterRemoval = removedLayout?._upl_version

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: removedSnapshot,
            snapshotHash: 'snapshot-without-scoped-layout',
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)?._upl_version).toBe(
            versionAfterRemoval
        )

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: initialSnapshot,
            snapshotHash: 'snapshot-restored-scoped-layout',
            userId: 'user-1'
        })
        expect(currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)).toMatchObject({
            is_active: true,
            is_default: true,
            sync_state: 'clean',
            _upl_deleted: false,
            _app_deleted: false
        })
        expect(currentKnex.widgetRows.find((row) => row.id === inheritedWidgetId)).toMatchObject({
            _upl_deleted: true,
            _app_deleted: false,
            is_active: false
        })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: initialSnapshot,
            userId: 'user-1'
        })
        expect(currentKnex.widgetRows.find((row) => row.id === inheritedWidgetId)).toMatchObject({
            _upl_deleted: false,
            _app_deleted: false,
            is_active: true
        })
    })

    it('does not rewrite an active source-removal decision when skip_source is retained', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.homeLayout,
                    scope_entity_id: dashboardIds.homeEntity,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.homeLayout,
                    source_content_hash: 'same-source',
                    local_content_hash: 'same-source',
                    sync_state: 'source_removed',
                    is_active: true,
                    is_default: true,
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false,
                    _upl_version: 4
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.scopedWidget,
                    layout_id: dashboardIds.homeLayout,
                    source_widget_id: dashboardIds.scopedWidget,
                    source_base_widget_id: null,
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const policy = { default: 'skip_source' as const }
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            userId: 'user-1',
            layoutResolutionPolicy: policy
        })
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            userId: 'user-1',
            layoutResolutionPolicy: policy
        })
        const versionAfterLayoutSync = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)?._upl_version
        expect(versionAfterLayoutSync).toBe(4)
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            userId: 'user-1'
        })

        expect(currentKnex.widgetRows.find((row) => row.id === dashboardIds.scopedWidget)).toMatchObject({
            _upl_deleted: false,
            _app_deleted: false,
            is_active: true
        })
    })

    it('blocks an inherited sync transition to single-system mode before mutating widgets', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    source_layout_id: dashboardIds.layout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    instance_key: 'interpretation-network',
                    parent_widget_id: null,
                    slot_key: null,
                    widget_key: 'interpretationNetworkWorkspace',
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    source_config: { structureMode: 'multiple', conceptCodename: 'Structure' },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })
        const snapshot: PublishedApplicationSnapshot = {
            ...createSnapshot(),
            layoutZoneWidgets: [
                {
                    id: dashboardIds.widget,
                    layoutId: dashboardIds.layout,
                    zone: 'center',
                    widgetKey: 'interpretationNetworkWorkspace',
                    instanceKey: 'interpretation-network',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: dashboardIds.widget,
                    sourceBaseWidgetId: null,
                    sortOrder: 1,
                    config: { structureMode: 'singleSystem', conceptCodename: 'Structure' },
                    isActive: true
                }
            ]
        }
        ;(mockSyncExecutor.query as jest.Mock).mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('COUNT(*)::int AS count')) return [{ count: 1 }]
            return mockSqlQuery(sql, params)
        })

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(currentKnex.widgetRows[0]?.config).toEqual({ structureMode: 'multiple', conceptCodename: 'Structure' })
        expect(mockSyncExecutor.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)::int AS count'), expect.any(Array))
    })
})
