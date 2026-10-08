import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { isUuidV7 } from '@universo-react/utils'
import { decodeLayoutWidgetConfigEnvelope, encodeLayoutWidgetConfigEnvelope } from '@universo-react/types'
import { insertApplicationLayoutSyncWidget } from '../../persistence/applicationLayoutSyncStore'
import {
    configureSyncLayoutPersistenceKnexAccessor,
    createMockSyncKnex,
    persistPublishedLayouts,
    persistPublishedWidgets,
    resetSyncLayoutPersistenceMocks,
    type MockSyncKnex
} from './syncLayoutPersistenceHarness'
import {
    createMarketingHeroSnapshot,
    createScopedEntity,
    createSnapshot,
    dashboardIds,
    marketingIds
} from './syncLayoutPersistenceFixtures'

let currentKnex: MockSyncKnex
configureSyncLayoutPersistenceKnexAccessor(() => currentKnex)

describe('syncLayoutPersistenceLineage', () => {
    beforeEach(() => {
        resetSyncLayoutPersistenceMocks()
        currentKnex = createMockSyncKnex()
    })

    it('persists a valid marketing layout and widget with their UUID v7 identities', async () => {
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

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            snapshotHash: 'snapshot-valid',
            userId: 'user-1'
        })
        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })

        expect(currentKnex.layoutRows[0]).toMatchObject({
            id: marketingIds.layout,
            template_key: 'marketing-page',
            source_layout_id: marketingIds.layout,
            source_snapshot_hash: 'snapshot-valid',
            sync_state: 'clean'
        })
        expect(currentKnex.widgetRows[0]).toMatchObject({
            layout_id: marketingIds.layout,
            widget_key: 'marketing.hero',
            source_widget_id: marketingIds.widget,
            source_base_widget_id: null
        })
        expect(currentKnex.widgetRows[0]?.id).toEqual(
            expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        )

        const firstPhysicalWidgetId = currentKnex.widgetRows[0]?.id
        const firstSourceWidgetHash = currentKnex.widgetRows[0]?.source_content_hash
        const firstLayoutVersion = Number(currentKnex.layoutRows[0]?._upl_version)
        expect(firstSourceWidgetHash).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/u))

        const changedSnapshot = createMarketingHeroSnapshot()
        const changedWidget = changedSnapshot.layoutZoneWidgets[0]
        if (!changedWidget) throw new Error('Expected marketing widget fixture')
        const currentWidgetConfig = decodeLayoutWidgetConfigEnvelope(changedWidget.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.hero',
            zone: 'marketing-main'
        })
        changedWidget.config = encodeLayoutWidgetConfigEnvelope(
            {
                rendererConfig: { ...currentWidgetConfig.rendererConfig, showLeadForm: false },
                neutral: currentWidgetConfig.neutral
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: changedSnapshot,
            userId: 'user-1'
        })

        expect(currentKnex.widgetRows[0]?.id).toBe(firstPhysicalWidgetId)
        expect(currentKnex.widgetRows[0]?.source_content_hash).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/u))
        expect(currentKnex.widgetRows[0]?.source_content_hash).not.toBe(firstSourceWidgetHash)
        expect(Number(currentKnex.layoutRows[0]?._upl_version)).toBeGreaterThan(firstLayoutVersion)
    })

    it('does not attach inherited lineage metadata to application-owned copied widgets', async () => {
        const query = jest.fn().mockResolvedValue([{ id: dashboardIds.widget }])
        const executor = { query } as unknown as DbExecutor
        const row = {
            id: dashboardIds.widget,
            layoutId: dashboardIds.layout,
            sourceLineageKey: 'copy:dashboard:widget',
            zone: 'center',
            widgetKey: 'columnsContainer',
            instanceKey: 'columns-main',
            parentWidgetId: null,
            slotKey: null,
            sortOrder: 1,
            config: { columns: [{ slotKey: 'column:main', width: 12 }] },
            isActive: true,
            sourceContentHash: 'a'.repeat(64)
        }

        await insertApplicationLayoutSyncWidget(
            executor,
            '"app_schema"."_app_widgets"',
            dashboardIds.widget,
            dashboardIds.layout,
            row,
            row.sourceContentHash,
            'user-1',
            { ownership: 'application' }
        )

        const sql = String(query.mock.calls[0]?.[0])
        expect(sql).toContain('NULL::jsonb')
        expect(sql).toMatch(/NULL, NULL, NULL, \$14/u)
    })

    it('allocates physical UUID v7 identities, remaps overlay references, and reuses them on resync', async () => {
        const snapshot: PublishedApplicationSnapshot = {
            ...createSnapshot(),
            entities: {
                [dashboardIds.homeEntity]: createScopedEntity(dashboardIds.homeEntity, 'Home')
            },
            scopedLayouts: [
                {
                    id: dashboardIds.scopedLayout,
                    scopeEntityId: dashboardIds.homeEntity,
                    templateKey: 'dashboard',
                    baseLayoutId: dashboardIds.layout,
                    compositionMode: 'overlay',
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
            snapshot,
            snapshotHash: 'snapshot-physical-1',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        const baseLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.layout)
        const scopedLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.scopedLayout)
        expect(baseLayout?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(scopedLayout?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(baseLayout?.id).not.toBe(dashboardIds.layout)
        expect(scopedLayout?.id).not.toBe(dashboardIds.scopedLayout)
        expect(((scopedLayout?.config as Record<string, unknown>)?.__layout as Record<string, unknown>)?.composition).toMatchObject({
            mode: 'overlay',
            baseLayoutId: baseLayout?.id
        })

        const firstLayoutIds = new Map(currentKnex.layoutRows.map((row) => [String(row.source_layout_id), String(row.id)]))
        const firstWidgetIds = new Map(
            currentKnex.widgetRows.map((row) => [
                `${String(row.layout_id)}:${String(row.source_base_widget_id ?? row.source_widget_id)}`,
                String(row.id)
            ])
        )

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            snapshotHash: 'snapshot-physical-1',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows).toHaveLength(2)
        expect(currentKnex.widgetRows).toHaveLength(2)
        for (const [sourceId, physicalId] of firstLayoutIds) {
            expect(currentKnex.layoutRows.find((row) => String(row.source_layout_id) === sourceId)?.id).toBe(physicalId)
        }
        for (const [sourceWidgetKey, physicalId] of firstWidgetIds) {
            expect(
                currentKnex.widgetRows.find(
                    (row) => `${String(row.layout_id)}:${String(row.source_base_widget_id ?? row.source_widget_id)}` === sourceWidgetKey
                )?.id
            ).toBe(physicalId)
        }
    })

    it('reuses a generated widget physical row from stable source lineage when its materialization id changes', async () => {
        const firstSnapshot = createSnapshot()
        firstSnapshot.layoutZoneWidgets = [
            {
                ...firstSnapshot.layoutZoneWidgets[0],
                sourceLineageKey: 'workspace:global:workspaceSwitcher'
            }
        ] as typeof firstSnapshot.layoutZoneWidgets

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: firstSnapshot,
            snapshotHash: 'snapshot-lineage',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: firstSnapshot,
            userId: 'user-1'
        })

        const firstPhysicalId = currentKnex.widgetRows[0]?.id
        const secondSnapshot = {
            ...firstSnapshot,
            layoutZoneWidgets: [
                {
                    ...firstSnapshot.layoutZoneWidgets[0],
                    id: dashboardIds.scopedWidget
                }
            ]
        }
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: secondSnapshot,
            userId: 'user-1'
        })

        expect(currentKnex.widgetRows).toHaveLength(1)
        expect(currentKnex.widgetRows[0]?.id).toBe(firstPhysicalId)
        expect(currentKnex.widgetRows[0]?.source_widget_id).not.toBe(dashboardIds.widget)
        expect(isUuidV7(currentKnex.widgetRows[0]?.source_widget_id)).toBe(true)
        expect(String(currentKnex.widgetRows[0]?.source_widget_id).replace(/-/gu, '').slice(0, 12)).toBe(
            dashboardIds.layout.replace(/-/gu, '').slice(0, 12)
        )
    })

    it('starts copied application layouts without an inherited snapshot baseline', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    template_key: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_layout_id: dashboardIds.layout,
                    source_snapshot_hash: 'snapshot-old',
                    source_content_hash: 'source-old',
                    local_content_hash: 'local-custom',
                    sync_state: 'local_modified',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false,
                    _upl_version: 2
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.layout,
                    zone: 'center',
                    widget_key: 'columnsContainer',
                    instance_key: 'columns-main',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 1,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    source_widget_id: dashboardIds.widget,
                    source_base_widget_id: null,
                    source_content_hash: 'widget-source',
                    local_content_hash: 'widget-source',
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false,
                    _upl_version: 1
                }
            ]
        })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            snapshotHash: 'snapshot-new',
            userId: 'user-1',
            layoutResolutionPolicy: { default: 'copy_source_as_application' }
        })

        const copiedLayout = currentKnex.layoutRows.find((row) => row.source_kind === 'application')
        expect(copiedLayout).toMatchObject({
            source_layout_id: dashboardIds.layout,
            source_snapshot_hash: null,
            source_content_hash: expect.any(String),
            sync_state: 'clean'
        })
    })

    it('persists inherited scoped widgets with UUID v7 ids and stable base widget links', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    source_layout_id: dashboardIds.layout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.homeLayout,
                    scope_entity_id: dashboardIds.homeEntity,
                    source_layout_id: dashboardIds.homeLayout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                [dashboardIds.homeEntity]: createScopedEntity(dashboardIds.homeEntity, 'Home')
            },
            layouts: [
                {
                    id: dashboardIds.layout,
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
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
            ],
            layoutZoneWidgets: [
                {
                    id: dashboardIds.baseWidget,
                    layoutId: dashboardIds.layout,
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    instanceKey: 'base-columns',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: dashboardIds.baseWidget,
                    sourceBaseWidgetId: null,
                    sortOrder: 10,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    isActive: true
                }
            ],
            defaultLayoutId: dashboardIds.layout
        }

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        const inheritedWidget = currentKnex.widgetRows.find((row) => row.layout_id === dashboardIds.homeLayout)
        expect(inheritedWidget?.source_widget_id).toBe(dashboardIds.baseWidget)
        expect(inheritedWidget?.source_base_widget_id).toBe(dashboardIds.baseWidget)
        expect(inheritedWidget?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(inheritedWidget?.id).not.toBe(dashboardIds.baseWidget)
    })

    it('preserves scoped owned widgets alongside inherited widgets with the same key', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    source_layout_id: dashboardIds.layout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.courseLayout,
                    scope_entity_id: dashboardIds.courseEntity,
                    source_layout_id: dashboardIds.courseLayout,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot: PublishedApplicationSnapshot = {
            entities: {
                [dashboardIds.courseEntity]: createScopedEntity(dashboardIds.courseEntity, 'Course')
            },
            layouts: [
                {
                    id: dashboardIds.layout,
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    name: { en: 'Main' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            scopedLayouts: [
                {
                    id: dashboardIds.courseLayout,
                    scopeEntityId: dashboardIds.courseEntity,
                    baseLayoutId: dashboardIds.layout,
                    compositionMode: 'overlay',
                    templateKey: 'dashboard',
                    name: { en: 'Course' },
                    description: null,
                    config: {},
                    isActive: true,
                    isDefault: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: dashboardIds.baseWidget,
                    layoutId: dashboardIds.layout,
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    instanceKey: 'base-columns',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: dashboardIds.baseWidget,
                    sourceBaseWidgetId: null,
                    sortOrder: 10,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
                    isActive: true
                },
                {
                    id: dashboardIds.courseWidget,
                    layoutId: dashboardIds.courseLayout,
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    instanceKey: 'course-columns',
                    parentWidgetId: null,
                    slotKey: null,
                    sourceWidgetId: dashboardIds.courseWidget,
                    sourceBaseWidgetId: null,
                    sortOrder: 20,
                    config: { columns: [{ slotKey: 'column:course', width: 12 }] },
                    isActive: true
                }
            ],
            defaultLayoutId: dashboardIds.layout
        }

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        const scopedColumns = currentKnex.widgetRows.filter(
            (row) => row.layout_id === dashboardIds.courseLayout && row.zone === 'center' && row.widget_key === 'columnsContainer'
        )
        expect(scopedColumns).toHaveLength(2)
        expect(scopedColumns).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    source_base_widget_id: null,
                    config: { columns: [{ slotKey: 'column:course', width: 12 }] }
                }),
                expect.objectContaining({
                    source_base_widget_id: dashboardIds.baseWidget,
                    config: { columns: [{ slotKey: 'column:main', width: 12 }] }
                })
            ])
        )
    })

    it('fails closed when stored inherited widget lineage is duplicated', async () => {
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
                    source_base_widget_id: dashboardIds.baseWidget,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.scopedWidget,
                    layout_id: dashboardIds.layout,
                    source_base_widget_id: dashboardIds.baseWidget,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })
        ).rejects.toThrow('duplicate source lineage')
        expect(currentKnex.widgetRows).toHaveLength(2)
    })

    it('allocates a new physical widget id when the source id belongs to an unrelated application row', async () => {
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
                },
                {
                    id: dashboardIds.homeLayout,
                    source_layout_id: null,
                    source_kind: 'application',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: dashboardIds.widget,
                    layout_id: dashboardIds.homeLayout,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })
        expect(currentKnex.widgetRows).toHaveLength(2)
        const materialized = currentKnex.widgetRows.find((row) => row.layout_id === dashboardIds.layout)
        expect(materialized).toMatchObject({
            source_widget_id: dashboardIds.widget,
            source_base_widget_id: null
        })
        expect(materialized?.id).not.toBe(dashboardIds.widget)
    })

    it('fails closed when a snapshot widget has no persisted source layout lineage', async () => {
        currentKnex = createMockSyncKnex()

        await expect(
            persistPublishedWidgets({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: createSnapshot(),
                userId: 'user-1'
            })
        ).rejects.toThrow('missing source lineage')
        expect(currentKnex.widgetRows).toHaveLength(0)
    })
})
