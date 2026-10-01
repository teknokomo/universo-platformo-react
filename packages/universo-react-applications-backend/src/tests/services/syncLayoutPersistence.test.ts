import {
    buildApplicationLayoutChanges,
    configureSyncLayoutPersistenceKnexAccessor,
    createMockSyncKnex,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    mockEnsureSystemTables,
    mockSyncExecutor,
    persistPublishedLayouts,
    persistPublishedLayoutsImpl,
    persistPublishedWidgets,
    resetSyncLayoutPersistenceMocks,
    type MockSyncKnex
} from './syncLayoutPersistenceHarness'
import {
    createMarketingHeroSnapshot,
    createMarketingSnapshot,
    createSnapshot,
    dashboardIds,
    marketingIds
} from './syncLayoutPersistenceFixtures'

let currentKnex: MockSyncKnex
configureSyncLayoutPersistenceKnexAccessor(() => currentKnex)

describe('syncLayoutPersistence', () => {
    beforeEach(() => {
        resetSyncLayoutPersistenceMocks()
        currentKnex = createMockSyncKnex()
    })

    it('reports source_updated changes for clean imported layouts when the metahub source changes', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    name: { en: 'Main' },
                    is_active: true,
                    is_default: true,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_content_hash: 'old-source-hash',
                    local_content_hash: 'old-source-hash',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const changes = await buildApplicationLayoutChanges({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            executor: mockSyncExecutor
        })

        expect(changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'LAYOUT_SOURCE_UPDATED',
                    sourceLayoutId: dashboardIds.layout,
                    currentSyncState: 'source_updated'
                })
            ])
        )
    })

    it('treats a canonical persisted layout and widget as unchanged against the same publication snapshot', async () => {
        const snapshot = createSnapshot()
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: `0190a9b5-3cde-7abc-8def-2123456789a1`,
                    source_layout_id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {
                        showHeader: true,
                        __layout: {
                            composition: { mode: 'independent', baseLayoutId: null }
                        }
                    },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'a'.repeat(64),
                    local_content_hash: 'a'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: `0190a9b5-3cde-7abc-8def-2123456789a2`,
                    layout_id: `0190a9b5-3cde-7abc-8def-2123456789a1`,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    zone: 'center',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'object-1' } },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            hasPublishedLayoutsChanges({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                executor: mockSyncExecutor
            })
        ).resolves.toBe(false)
        await expect(
            hasPublishedWidgetsChanges({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                executor: mockSyncExecutor
            })
        ).resolves.toBe(false)
    })

    it('fails closed when persisted widget config is malformed during change comparison', async () => {
        const snapshot = createSnapshot()
        const physicalLayoutId = '0190a9b5-3cde-7abc-8def-2123456789a1'
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: physicalLayoutId,
                    source_layout_id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {
                        showHeader: true,
                        __layout: { composition: { mode: 'independent', baseLayoutId: null } }
                    },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'a'.repeat(64),
                    local_content_hash: 'a'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789a2',
                    layout_id: physicalLayoutId,
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    zone: 'center',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: { __layout: { placement: 'invalid' } },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            hasPublishedWidgetsChanges({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                executor: mockSyncExecutor
            })
        ).rejects.toThrow()
    })

    it('fails closed when persisted layout response fields are malformed during change comparison', async () => {
        const snapshot = createSnapshot()
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789a1',
                    source_layout_id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: 'Main',
                    description: null,
                    config: {
                        showHeader: true,
                        __layout: { composition: { mode: 'independent', baseLayoutId: null } }
                    },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'a'.repeat(64),
                    local_content_hash: 'a'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            hasPublishedLayoutsChanges({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                executor: mockSyncExecutor
            })
        ).rejects.toThrow('name is invalid')
    })

    it('fails closed before DDL when no request executor or trusted transaction is supplied', async () => {
        await expect(
            persistPublishedLayoutsImpl({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: createSnapshot(),
                userId: 'user-1'
            })
        ).rejects.toThrow('Request-scoped executor or trusted sync transaction is required')

        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
    })

    it('rejects an invalid marketing snapshot before sync setup or writes', async () => {
        const snapshot = createMarketingHeroSnapshot()
        snapshot.layoutZoneWidgets = []

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: 'snapshot-invalid',
                userId: 'user-1'
            })
        ).rejects.toThrow('at least one active widget')

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })
        ).rejects.toThrow('at least one active widget')
        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
        expect(currentKnex.layoutRows).toHaveLength(0)
        expect(currentKnex.widgetRows).toHaveLength(0)
    })

    it('rejects duplicate Dashboard singleton widgets before sync writes', async () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets = [
            {
                id: dashboardIds.widget,
                layoutId: dashboardIds.layout,
                zone: 'top',
                widgetKey: 'appNavbar',
                sortOrder: 0,
                config: {},
                isActive: true
            },
            {
                id: dashboardIds.scopedWidget,
                layoutId: dashboardIds.layout,
                zone: 'top',
                widgetKey: 'appNavbar',
                sortOrder: 1,
                config: {},
                isActive: true
            }
        ]

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: 'snapshot-duplicate-singleton',
                userId: 'user-1'
            })
        ).rejects.toThrow('duplicate singleton widget appNavbar')
        expect(currentKnex.layoutRows).toHaveLength(0)
        expect(currentKnex.widgetRows).toHaveLength(0)
    })

    it('accepts strict neutral layout metadata and shared marketing-header widgets during application sync', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: marketingIds.layout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })
        const snapshot = createMarketingHeroSnapshot()
        const neutralConfig = {
            __layout: {
                zoneSettings: {
                    'marketing-header': { position: 'flow' }
                }
            }
        }
        snapshot.layouts[0]!.config = neutralConfig
        snapshot.layoutConfig = neutralConfig
        snapshot.layoutZoneWidgets.push({
            id: marketingIds.sharedWidget,
            layoutId: marketingIds.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: { __layout: { placement: 'end' } },
            isActive: true
        })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            snapshotHash: 'snapshot-neutral',
            userId: 'user-1'
        })
        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })

        expect(currentKnex.layoutRows[0]?.config).toMatchObject({
            __layout: {
                composition: {
                    mode: 'independent',
                    baseLayoutId: null
                },
                sourceZoneSettings: {
                    'marketing-header': { position: 'flow' }
                }
            }
        })
        expect(currentKnex.widgetRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    widget_key: 'languageSwitcher',
                    config: { __layout: { placement: 'end' } }
                })
            ])
        )
    })

    it('rejects application-only neutral metadata before application sync writes', async () => {
        const snapshot = createMarketingSnapshot()
        snapshot.layouts[0]!.config = {
            __layout: {
                sourceZoneSettings: {
                    'marketing-header': { position: 'fixed' }
                }
            }
        }

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: 'snapshot-invalid-neutral',
                userId: 'user-1'
            })
        ).rejects.toThrow('application-only source zone settings')

        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
        expect(currentKnex.layoutRows).toHaveLength(0)
        expect(currentKnex.widgetRows).toHaveLength(0)
    })

    it('rejects UUID v4 snapshot identities before bootstrapping or mutating application layout tables', async () => {
        const v4LayoutId = '018f8a78-7b8f-4c1d-a111-2222333344a1'
        const snapshot = createSnapshot()
        snapshot.layouts = [{ ...snapshot.layouts[0], id: v4LayoutId }]
        snapshot.layoutZoneWidgets = [{ ...snapshot.layoutZoneWidgets[0], layoutId: v4LayoutId }]
        snapshot.defaultLayoutId = v4LayoutId

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: 'snapshot-v4',
                userId: 'user-1'
            })
        ).rejects.toThrow(/UUID v7/u)
        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
        expect(currentKnex.layoutRows).toHaveLength(0)
    })

    it('bumps the displaced default layout version during metahub synchronization', async () => {
        const displacedLayoutId = dashboardIds.homeLayout
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: displacedLayoutId,
                    scope_entity_id: null,
                    source_kind: 'metahub',
                    is_active: true,
                    is_default: true,
                    source_content_hash: 'same-source',
                    local_content_hash: 'same-source',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_version: 1,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            snapshotHash: 'snapshot-default',
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows.find((row) => row.id === displacedLayoutId)).toMatchObject({
            is_default: false,
            _upl_version: 2
        })
    })

    it('fails closed when application layout table bootstrap fails', async () => {
        mockEnsureSystemTables.mockRejectedValueOnce(new Error('DDL unavailable'))

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: createSnapshot(),
                snapshotHash: 'snapshot-bootstrap-failure',
                userId: 'user-1'
            })
        ).rejects.toThrow('Failed to ensure application layout tables')

        expect(currentKnex.layoutRows).toHaveLength(0)
    })

    it('fails closed when persisted Dashboard singleton identity is duplicated', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    template_key: 'dashboard',
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
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    widget_key: 'appNavbar',
                    zone: 'top',
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.scopedWidget,
                    layout_id: dashboardIds.layout,
                    widget_key: 'appNavbar',
                    zone: 'top',
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })
        ).rejects.toThrow('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        expect(currentKnex.widgetRows).toHaveLength(2)
    })
})
