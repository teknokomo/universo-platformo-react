import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    buildSingleTargetWidgetBinding,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    LAYOUT_WIDGET_DEFINITIONS
} from '@universo-react/types'
import {
    buildApplicationLayoutChanges,
    configureSyncLayoutPersistenceKnexAccessor,
    createMockSyncKnex,
    hasPublishedWidgetsChanges,
    mockEnsureSystemTables,
    mockSqlQuery,
    mockSyncExecutor,
    persistPublishedLayouts,
    persistPublishedWidgets,
    resetSyncLayoutPersistenceMocks,
    type MockSyncKnex
} from './syncLayoutPersistenceHarness'
import { listEffectiveLayoutWidgets } from '../../persistence/effectiveLayoutStore'
import {
    createBoundHeroSyncWidget,
    createBoundMarketingCollectionConfig,
    createMarketingHeroSnapshot,
    createMarketingSnapshot,
    createSnapshot,
    createScopedEntity,
    dashboardIds,
    marketingHeroRecordData,
    marketingIds,
    modifiedSourceLayoutRow
} from './syncLayoutPersistenceFixtures'

let currentKnex: MockSyncKnex
configureSyncLayoutPersistenceKnexAccessor(() => currentKnex)

describe('syncLayoutPersistence widget bindings', () => {
    beforeEach(() => {
        resetSyncLayoutPersistenceMocks()
        currentKnex = createMockSyncKnex()
    })

    it.each([false, true])('inserts child-first snapshots with physical parents before children (application copy=%s)', async (copy) => {
        const snapshot = createSnapshot()
        const parent = { ...snapshot.layoutZoneWidgets[0]!, sortOrder: 9 }
        const children = [dashboardIds.scopedWidget, dashboardIds.courseWidget].map((id, index) => ({
            ...parent,
            id,
            widgetKey: 'resourcePreview',
            instanceKey: `preview-${index}`,
            parentWidgetId: parent.id,
            slotKey: 'column:main',
            sourceWidgetId: id,
            sortOrder: index,
            config: { displayMode: 'compact' }
        }))
        snapshot.layoutZoneWidgets = [...children, parent]
        if (copy) {
            currentKnex = createMockSyncKnex({
                layoutRows: [modifiedSourceLayoutRow(dashboardIds.layout, 'dashboard', true)]
            })
        }
        const query = mockSyncExecutor.query as jest.Mock
        query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (/^\s*INSERT INTO\b/u.test(sql) && sql.includes('"_app_widgets"')) {
                const parentId = params[5]
                if (parentId !== null) {
                    // Model the immediate parent FK and same-layout constraint at the SQL seam.
                    expect(currentKnex.widgetRows).toEqual(
                        expect.arrayContaining([expect.objectContaining({ id: parentId, layout_id: params[1] })])
                    )
                    expect(snapshot.layoutZoneWidgets.map(({ id }) => id)).not.toContain(parentId)
                }
            }
            return mockSqlQuery(sql, params)
        })
        const options = {
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            snapshotHash: 'child-first-snapshot',
            userId: 'user-1'
        }
        await persistPublishedLayouts({
            ...options,
            ...(copy ? { layoutResolutionPolicy: { default: 'copy_source_as_application' as const } } : {})
        })
        await persistPublishedWidgets(options)

        const layouts = currentKnex.layoutRows.filter((row) => row.source_layout_id === dashboardIds.layout)
        expect(layouts).toHaveLength(copy ? 2 : 1)
        if (copy)
            expect(layouts).toEqual(expect.arrayContaining([expect.objectContaining({ source_kind: 'application', is_default: false })]))
        const snapshotIds = snapshot.layoutZoneWidgets.map(({ id }) => id)
        for (const layout of layouts) {
            const rows = currentKnex.widgetRows.filter((row) => row.layout_id === layout.id)
            expect(rows).toHaveLength(3)
            const root = rows.find((row) => row.instance_key === parent.instanceKey)!
            expect(root).toMatchObject({ parent_widget_id: null, slot_key: null, sort_order: 9 })
            const inserts = query.mock.calls.filter(
                ([sql, params]) =>
                    /^\s*INSERT INTO\b/u.test(String(sql)) && String(sql).includes('"_app_widgets"') && params[1] === layout.id
            )
            expect(inserts.map(([, params]) => params[4])).toEqual([parent.instanceKey, ...children.map(({ instanceKey }) => instanceKey)])
            for (const child of children) {
                expect(rows.find((row) => row.instance_key === child.instanceKey)).toMatchObject({
                    parent_widget_id: root.id,
                    slot_key: child.slotKey,
                    sort_order: child.sortOrder,
                    source_widget_id: layout.source_kind === 'application' ? null : child.id
                })
            }
            for (const row of rows) expect(snapshotIds).not.toContain(row.id)
        }
        const identities = currentKnex.widgetRows.map((row) => row.id)
        expect(new Set(identities).size).toBe(copy ? 6 : 3)
        query.mockClear()
        await persistPublishedWidgets(options)
        expect(currentKnex.widgetRows.map((row) => row.id)).toEqual(identities)
        expect(query.mock.calls.filter(([sql]) => /^\s*INSERT INTO\b/u.test(String(sql)))).toHaveLength(0)
        expect(snapshot.layoutZoneWidgets.map(({ id }) => id)).toEqual([...children.map(({ id }) => id), parent.id])
    })

    it('keeps a deleted source placement tombstoned on the next sync without reinserting its instance key', async () => {
        const snapshot = createSnapshot()
        const sourceWidget = snapshot.layoutZoneWidgets[0]
        if (!sourceWidget) throw new Error('Expected the dashboard source widget fixture')
        const deletedPhysicalWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b0'
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(dashboardIds.layout, 'dashboard', true)],
            widgetRows: [
                {
                    id: deletedPhysicalWidgetId,
                    layout_id: dashboardIds.layout,
                    zone: sourceWidget.zone,
                    widget_key: sourceWidget.widgetKey,
                    instance_key: sourceWidget.instanceKey,
                    parent_widget_id: sourceWidget.parentWidgetId,
                    slot_key: sourceWidget.slotKey,
                    sort_order: sourceWidget.sortOrder,
                    config: sourceWidget.config,
                    source_config: sourceWidget.config,
                    source_widget_id: sourceWidget.sourceWidgetId,
                    source_base_widget_id: sourceWidget.sourceBaseWidgetId,
                    is_active: true,
                    _upl_deleted: true,
                    _app_deleted: true
                }
            ]
        })

        await expect(
            persistPublishedWidgets({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                userId: 'user-1'
            })
        ).resolves.toBeUndefined()

        expect(currentKnex.widgetRows).toHaveLength(1)
        expect(currentKnex.widgetRows[0]).toMatchObject({
            id: deletedPhysicalWidgetId,
            instance_key: sourceWidget.instanceKey,
            source_widget_id: sourceWidget.sourceWidgetId,
            _upl_deleted: true,
            _app_deleted: true
        })
        const queries = (mockSyncExecutor.query as jest.Mock).mock.calls
        expect(
            queries.some(
                ([sql, params]) =>
                    /^\s*INSERT INTO\b/u.test(String(sql)) &&
                    String(sql).includes('"_app_widgets"') &&
                    params[4] === sourceWidget.instanceKey
            )
        ).toBe(false)
        expect(queries.some(([sql]) => /DELETE\s+FROM\s+.*(?:_app_objects|_mhb_objects)/iu.test(String(sql)))).toBe(false)
        expect(snapshot.layoutZoneWidgets).toHaveLength(1)
    })

    it('marks application copy unavailable for a locally modified entity-backed Hero conflict', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', true)]
        })

        const changes = await buildApplicationLayoutChanges({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createMarketingHeroSnapshot(),
            executor: mockSyncExecutor
        })

        expect(changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'LAYOUT_CONFLICT',
                    sourceLayoutId: marketingIds.layout,
                    recommendedResolution: 'keep_local',
                    copyAsApplicationUnavailable: true
                })
            ])
        )
    })

    it('marks copying a removed layout unavailable when its persisted Hero binding is still required', async () => {
        const heroWidget = createBoundHeroSyncWidget()
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', false)],
            widgetRows: [
                {
                    id: marketingIds.widget,
                    layout_id: marketingIds.layout,
                    zone: heroWidget.zone,
                    widget_key: heroWidget.widgetKey,
                    sort_order: heroWidget.sortOrder,
                    config: heroWidget.config,
                    source_config: heroWidget.config,
                    source_widget_id: marketingIds.widget,
                    source_base_widget_id: null,
                    is_active: true,
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
                    type: 'LAYOUT_SOURCE_REMOVED',
                    sourceLayoutId: marketingIds.layout,
                    recommendedResolution: 'keep_local',
                    copyAsApplicationUnavailable: true
                })
            ])
        )
    })

    it('compares Marketing overlay presentation deltas without requiring or duplicating base bindings', async () => {
        const snapshot = createMarketingSnapshot()
        const scopeEntityId = dashboardIds.homeEntity
        const scopedLayoutId = dashboardIds.scopedLayout
        const scopedWidgetId = dashboardIds.scopedWidget
        snapshot.entities![scopeEntityId] = createScopedEntity(scopeEntityId, 'Home')
        snapshot.scopedLayouts = [
            {
                id: scopedLayoutId,
                scopeEntityId,
                templateKey: 'marketing-page',
                baseLayoutId: marketingIds.layout,
                compositionMode: 'overlay',
                name: { en: 'Home' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0
            }
        ]

        const overlayConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { variant: 'logos' }, neutral: {} },
            { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: 'marketing-main', requireBindings: false }
        )
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: marketingIds.layout,
                    source_layout_id: marketingIds.layout,
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing page' },
                    description: null,
                    config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'b'.repeat(64),
                    local_content_hash: 'b'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: scopedLayoutId,
                    source_layout_id: scopedLayoutId,
                    scope_entity_id: scopeEntityId,
                    template_key: 'marketing-page',
                    name: { en: 'Home' },
                    description: null,
                    config: { __layout: { composition: { mode: 'overlay', baseLayoutId: marketingIds.layout } } },
                    is_active: true,
                    is_default: true,
                    sort_order: 0,
                    source_kind: 'metahub',
                    source_content_hash: 'c'.repeat(64),
                    local_content_hash: 'c'.repeat(64),
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ],
            widgetRows: [
                {
                    id: marketingIds.widget,
                    layout_id: marketingIds.layout,
                    source_widget_id: marketingIds.widget,
                    source_base_widget_id: null,
                    zone: 'marketing-main',
                    widget_key: 'marketing.collection',
                    instance_key: 'logos',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 0,
                    config: createBoundMarketingCollectionConfig(),
                    source_config: createBoundMarketingCollectionConfig(),
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: scopedWidgetId,
                    layout_id: scopedLayoutId,
                    source_widget_id: marketingIds.widget,
                    source_base_widget_id: marketingIds.widget,
                    zone: 'marketing-main',
                    widget_key: 'marketing.collection',
                    instance_key: 'logos',
                    parent_widget_id: null,
                    slot_key: null,
                    sort_order: 0,
                    config: overlayConfig,
                    source_config: overlayConfig,
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
        ).resolves.toBe(false)
    })

    it.each(['source', 'copySource'] as const)('rejects legacy marketing %s renderer configuration before sync writes', async (field) => {
        const snapshot = createMarketingSnapshot()
        const widget = snapshot.layoutZoneWidgets[0]!
        const decoded = decodeLayoutWidgetConfigEnvelope(widget.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            requireBindings: true
        })
        widget.config = encodeLayoutWidgetConfigEnvelope(
            {
                rendererConfig: {
                    ...decoded.rendererConfig,
                    [field]: { entityKind: 'object', entityCodename: 'MarketingPageLogo' }
                },
                neutral: decoded.neutral
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: 'marketing-main' }
        )

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: `snapshot-legacy-${field}`,
                userId: 'user-1'
            })
        ).rejects.toThrow('Snapshot widget configuration is invalid')

        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
        expect(currentKnex.layoutRows).toHaveLength(0)
        expect(currentKnex.widgetRows).toHaveLength(0)
    })

    it('rejects copy_source_as_application for a bound hero before any layout rows are written', async () => {
        const dashboardSnapshot = createSnapshot()
        const marketingSnapshot = createMarketingHeroSnapshot()
        const snapshot: PublishedApplicationSnapshot = {
            ...dashboardSnapshot,
            entities: { ...dashboardSnapshot.entities, ...marketingSnapshot.entities },
            elements: { ...(dashboardSnapshot.elements ?? {}), ...(marketingSnapshot.elements ?? {}) },
            layouts: [...dashboardSnapshot.layouts, { ...marketingSnapshot.layouts[0]!, isDefault: false }],
            layoutZoneWidgets: [...dashboardSnapshot.layoutZoneWidgets, ...marketingSnapshot.layoutZoneWidgets]
        }
        const priorRows = [
            modifiedSourceLayoutRow(dashboardIds.layout, 'dashboard', true),
            modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', false)
        ]
        currentKnex = createMockSyncKnex({ layoutRows: priorRows })

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot,
                snapshotHash: 'snapshot-new',
                userId: 'user-1',
                layoutResolutionPolicy: { default: 'copy_source_as_application' }
            })
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        const writes = (mockSyncExecutor.query as jest.Mock).mock.calls.filter(([sql]) =>
            /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(String(sql))
        )
        expect(writes).toHaveLength(0)
        expect(currentKnex.layoutRows).toEqual(expect.arrayContaining(priorRows))
        expect(currentKnex.widgetRows).toHaveLength(0)
    })

    it.each([
        ['per-layout', { bySourceLayoutId: { [marketingIds.layout]: 'copy_source_as_application' as const } }],
        ['bulk', { default: 'copy_source_as_application' as const }]
    ])('rejects %s copy of a locally modified removed bound layout before any writes', async (_name, layoutResolutionPolicy) => {
        const heroWidget = createBoundHeroSyncWidget()
        const layoutRow = modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', false)
        currentKnex = createMockSyncKnex({
            layoutRows: [layoutRow],
            widgetRows: [
                {
                    id: marketingIds.widget,
                    layout_id: marketingIds.layout,
                    zone: heroWidget.zone,
                    widget_key: heroWidget.widgetKey,
                    sort_order: heroWidget.sortOrder,
                    config: heroWidget.config,
                    source_config: heroWidget.config,
                    source_widget_id: marketingIds.widget,
                    source_base_widget_id: null,
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: createSnapshot(),
                snapshotHash: 'snapshot-without-marketing-layout',
                userId: 'user-1',
                layoutResolutionPolicy
            })
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        const writes = (mockSyncExecutor.query as jest.Mock).mock.calls.filter(([sql]) =>
            /^\s*(?:INSERT|UPDATE|DELETE)\b/iu.test(String(sql))
        )
        expect(writes).toHaveLength(0)
        expect(currentKnex.layoutRows[0]).toMatchObject({ source_kind: 'metahub', source_layout_id: marketingIds.layout })
        expect(currentKnex.widgetRows[0]).toMatchObject({ _upl_deleted: false, is_active: true })
    })

    it('retains lineage and tombstones a bound layout when keep_local resolves source removal', async () => {
        const heroWidget = createBoundHeroSyncWidget()
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', false)],
            widgetRows: [
                {
                    id: marketingIds.widget,
                    layout_id: marketingIds.layout,
                    zone: heroWidget.zone,
                    widget_key: heroWidget.widgetKey,
                    sort_order: heroWidget.sortOrder,
                    config: heroWidget.config,
                    source_config: heroWidget.config,
                    source_widget_id: marketingIds.widget,
                    source_base_widget_id: null,
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            snapshotHash: 'snapshot-without-marketing-layout',
            userId: 'user-1',
            layoutResolutionPolicy: { bySourceLayoutId: { [marketingIds.layout]: 'keep_local' } }
        })

        expect(currentKnex.layoutRows[0]).toMatchObject({
            source_kind: 'metahub',
            source_layout_id: marketingIds.layout,
            sync_state: 'source_removed',
            is_active: false,
            is_default: false
        })
        expect(currentKnex.widgetRows[0]).toMatchObject({ _upl_deleted: true, _app_deleted: false, is_active: false })

        const versionAfterRemoval = currentKnex.layoutRows[0]?._upl_version
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: createSnapshot(),
            userId: 'user-1',
            layoutResolutionPolicy: { bySourceLayoutId: { [marketingIds.layout]: 'keep_local' } }
        })
        expect(currentKnex.layoutRows[0]?._upl_version).toBe(versionAfterRemoval)
        expect(currentKnex.layoutRows[0]).toMatchObject({ source_kind: 'metahub', source_layout_id: marketingIds.layout })
    })

    it.each(['keep_local', 'overwrite_local'] as const)(
        'keeps the %s resolution available for a bound hero source layout',
        async (resolution) => {
            currentKnex = createMockSyncKnex({
                layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', true)]
            })

            await expect(
                persistPublishedLayouts({
                    schemaName: 'app_018f8a787b8f7c1da111222233334444',
                    snapshot: createMarketingHeroSnapshot(),
                    snapshotHash: 'snapshot-new',
                    userId: 'user-1',
                    layoutResolutionPolicy: { default: resolution }
                })
            ).resolves.toBeUndefined()

            expect(currentKnex.layoutRows[0]).toMatchObject({
                source_kind: 'metahub',
                sync_state: resolution === 'keep_local' ? 'local_modified' : 'clean'
            })
        }
    )

    it('continues ordinary materialization and widget sync for a bound hero', async () => {
        const snapshot = createMarketingHeroSnapshot()
        currentKnex = createMockSyncKnex()

        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            snapshotHash: 'snapshot-new',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        const materializedLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === marketingIds.layout)
        expect(materializedLayout).toMatchObject({ source_kind: 'metahub', template_key: 'marketing-page' })
        expect(currentKnex.widgetRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    widget_key: 'marketing.hero',
                    layout_id: materializedLayout?.id,
                    source_widget_id: marketingIds.widget,
                    source_config: expect.objectContaining({
                        __layout: expect.objectContaining({ bindings: expect.any(Object) })
                    })
                })
            ])
        )
    })

    it.each([
        { initialActive: true, expectedTombstone: true },
        { initialActive: false, expectedTombstone: false }
    ])(
        'preserves the inherited Hero overlay lifecycle when its base source disappears (active=$initialActive)',
        async ({ initialActive, expectedTombstone }) => {
            const heroSnapshot = createMarketingHeroSnapshot()
            const authWidget = {
                id: marketingIds.sharedWidget,
                layoutId: marketingIds.layout,
                zone: 'marketing-header' as const,
                widgetKey: 'marketing.auth' as const,
                instanceKey: 'auth',
                parentWidgetId: null,
                slotKey: null,
                sourceWidgetId: marketingIds.sharedWidget,
                sourceBaseWidgetId: null,
                sortOrder: 1,
                config: { showAuthActions: true },
                isActive: true
            }
            const scopeEntityId = dashboardIds.homeEntity
            const sourceSnapshot: PublishedApplicationSnapshot = {
                ...heroSnapshot,
                entities: { ...heroSnapshot.entities, [scopeEntityId]: createScopedEntity(scopeEntityId, 'Home') },
                layoutZoneWidgets: [...heroSnapshot.layoutZoneWidgets, authWidget],
                scopedLayouts: [
                    {
                        id: dashboardIds.homeLayout,
                        scopeEntityId,
                        templateKey: 'marketing-page',
                        baseLayoutId: marketingIds.layout,
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
            currentKnex = createMockSyncKnex()

            await persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: sourceSnapshot,
                snapshotHash: 'marketing-overlay-with-hero',
                userId: 'user-1'
            })
            const scopedLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === dashboardIds.homeLayout)
            if (!scopedLayout) throw new Error('Expected the source overlay layout to be materialized')
            scopedLayout.sync_state = 'local_modified'
            scopedLayout.local_content_hash = 'local-overlay-change'

            await persistPublishedWidgets({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: sourceSnapshot,
                userId: 'user-1'
            })

            const baseLayout = currentKnex.layoutRows.find((row) => row.source_layout_id === marketingIds.layout)
            const baseHero = currentKnex.widgetRows.find((row) => row.layout_id === baseLayout?.id && row.widget_key === 'marketing.hero')
            const overlayHero = currentKnex.widgetRows.find(
                (row) => row.layout_id === scopedLayout.id && row.source_base_widget_id === marketingIds.widget
            )
            if (!baseHero || !overlayHero) throw new Error('Expected base and inherited Hero rows to be materialized')
            const overlayId = overlayHero.id
            const overlaySourceConfig = structuredClone(overlayHero.source_config)
            const overlaySourceState = structuredClone(overlayHero.source_state)
            expect(overlaySourceState).toBeDefined()
            overlayHero.is_active = initialActive

            const removedSnapshot: PublishedApplicationSnapshot = {
                ...sourceSnapshot,
                layoutZoneWidgets: [authWidget]
            }
            await persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: removedSnapshot,
                snapshotHash: 'marketing-overlay-without-hero',
                userId: 'user-1'
            })
            scopedLayout.sync_state = 'local_modified'
            scopedLayout.local_content_hash = 'local-overlay-change'
            await persistPublishedWidgets({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: removedSnapshot,
                userId: 'user-1'
            })

            expect(overlayHero).toMatchObject({
                id: overlayId,
                _upl_deleted: expectedTombstone,
                is_active: false,
                source_widget_id: marketingIds.widget,
                source_base_widget_id: marketingIds.widget,
                source_config: overlaySourceConfig,
                source_state: overlaySourceState
            })

            await persistPublishedLayouts({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: sourceSnapshot,
                snapshotHash: 'marketing-overlay-with-hero-restored',
                userId: 'user-1'
            })
            await persistPublishedWidgets({
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                snapshot: sourceSnapshot,
                userId: 'user-1'
            })

            expect(currentKnex.widgetRows.find((row) => row.id === overlayId)).toMatchObject({
                id: overlayId,
                _upl_deleted: false,
                is_active: initialActive,
                source_widget_id: marketingIds.widget,
                source_base_widget_id: marketingIds.widget,
                source_config: overlaySourceConfig,
                source_state: overlaySourceState
            })
        }
    )

    it('deactivates a removed required base widget, preserves its source baseline, and restores it on resync', async () => {
        const heroSnapshot = createMarketingHeroSnapshot()
        const heroWidget = heroSnapshot.layoutZoneWidgets[0]
        if (!heroWidget) throw new Error('Expected the bound source Hero fixture')
        const authWidget = {
            id: marketingIds.sharedWidget,
            layoutId: marketingIds.layout,
            zone: 'marketing-header' as const,
            widgetKey: 'marketing.auth' as const,
            instanceKey: 'auth',
            parentWidgetId: null,
            slotKey: null,
            sourceWidgetId: marketingIds.sharedWidget,
            sourceBaseWidgetId: null,
            sortOrder: 1,
            config: { showAuthActions: true },
            isActive: true
        }
        const snapshot: PublishedApplicationSnapshot = {
            ...heroSnapshot,
            layoutZoneWidgets: [...heroSnapshot.layoutZoneWidgets, authWidget]
        }
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', true)]
        })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        const persistedWidget = currentKnex.widgetRows.find((row) => row.widget_key === 'marketing.hero')
        if (!persistedWidget) throw new Error('Expected the bound source Hero to be materialized')
        const sourceConfig = structuredClone(persistedWidget.source_config)
        const sourceState = structuredClone(persistedWidget.source_state)
        expect(sourceConfig).toEqual(heroWidget.config)
        expect(sourceState).toBeDefined()

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: { ...snapshot, layoutZoneWidgets: [authWidget] },
            userId: 'user-1'
        })

        expect(persistedWidget).toMatchObject({
            is_active: false,
            _upl_deleted: true,
            source_widget_id: marketingIds.widget,
            source_base_widget_id: null,
            source_config: sourceConfig,
            source_state: sourceState
        })
        const effectiveWidgets = await listEffectiveLayoutWidgets(
            mockSyncExecutor,
            'app_018f8a787b8f7c1da111222233334444',
            marketingIds.layout
        )
        expect(effectiveWidgets).toHaveLength(1)

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        expect(persistedWidget).toMatchObject({
            is_active: true,
            _upl_deleted: false,
            source_config: sourceConfig,
            source_state: sourceState
        })
    })

    it('preserves a locally disabled required widget when its source removes and restores it', async () => {
        const sourceSnapshot = createMarketingHeroSnapshot()
        const heroWidget = sourceSnapshot.layoutZoneWidgets[0]
        if (!heroWidget) throw new Error('Expected the bound source Hero fixture')
        const authWidget = {
            id: marketingIds.sharedWidget,
            layoutId: marketingIds.layout,
            zone: 'marketing-header' as const,
            widgetKey: 'marketing.auth' as const,
            instanceKey: 'auth',
            parentWidgetId: null,
            slotKey: null,
            sourceWidgetId: marketingIds.sharedWidget,
            sourceBaseWidgetId: null,
            sortOrder: 1,
            config: { showAuthActions: true },
            isActive: true
        }
        const snapshot: PublishedApplicationSnapshot = {
            ...sourceSnapshot,
            layoutZoneWidgets: [...sourceSnapshot.layoutZoneWidgets, authWidget]
        }
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(marketingIds.layout, 'marketing-page', true)]
        })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })
        const persistedWidget = currentKnex.widgetRows.find((row) => row.widget_key === 'marketing.hero')
        if (!persistedWidget) throw new Error('Expected the bound source Hero to be materialized')
        persistedWidget.is_active = false

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: { ...snapshot, layoutZoneWidgets: [authWidget] },
            userId: 'user-1'
        })
        expect(persistedWidget).toMatchObject({ is_active: false, _upl_deleted: false, source_widget_id: marketingIds.widget })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot,
            userId: 'user-1'
        })

        expect(persistedWidget).toMatchObject({ is_active: false, _upl_deleted: false, source_widget_id: marketingIds.widget })
    })

    it('transfers a removed unbound source widget to application ownership without dropping its local config', async () => {
        const snapshot = createSnapshot()
        const sourceWidget = snapshot.layoutZoneWidgets[0]
        if (!sourceWidget) throw new Error('Expected the dashboard source widget fixture')
        const physicalWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b0'
        currentKnex = createMockSyncKnex({
            layoutRows: [modifiedSourceLayoutRow(dashboardIds.layout, 'dashboard', true)],
            widgetRows: [
                {
                    id: physicalWidgetId,
                    layout_id: dashboardIds.layout,
                    zone: sourceWidget.zone,
                    widget_key: sourceWidget.widgetKey,
                    sort_order: sourceWidget.sortOrder,
                    config: sourceWidget.config,
                    source_config: sourceWidget.config,
                    source_state: {
                        rendererConfig: sourceWidget.config,
                        instanceKey: sourceWidget.instanceKey,
                        parentWidgetId: sourceWidget.parentWidgetId,
                        slotKey: sourceWidget.slotKey,
                        isActive: true,
                        sortOrder: sourceWidget.sortOrder,
                        zone: sourceWidget.zone,
                        placement: null
                    },
                    source_widget_id: sourceWidget.id,
                    source_base_widget_id: null,
                    source_content_hash: 'source-hash',
                    local_content_hash: 'source-hash',
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: { ...snapshot, layoutZoneWidgets: [] },
            userId: 'user-1'
        })

        expect(currentKnex.widgetRows[0]).toMatchObject({
            id: physicalWidgetId,
            config: sourceWidget.config,
            is_active: true,
            source_widget_id: null,
            source_base_widget_id: null,
            source_content_hash: null,
            local_content_hash: null,
            source_config: null,
            source_state: null
        })
        await expect(
            listEffectiveLayoutWidgets(mockSyncExecutor, 'app_018f8a787b8f7c1da111222233334444', dashboardIds.layout)
        ).resolves.toEqual([expect.objectContaining({ id: physicalWidgetId, is_active: true })])
    })

    it('persists a binding-only source update without adding bindings to the presentation baseline', async () => {
        const firstSnapshot = createMarketingHeroSnapshot()
        await persistPublishedLayouts({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: firstSnapshot,
            snapshotHash: 'snapshot-before-binding-update',
            userId: 'user-1'
        })
        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: firstSnapshot,
            userId: 'user-1'
        })

        const persistedBefore = currentKnex.widgetRows.find((row) => row.widget_key === 'marketing.hero')
        const sourceHashBefore = persistedBefore?.source_content_hash
        const sourceStateBefore = persistedBefore?.source_state
        expect(persistedBefore?.source_state).toEqual(expect.objectContaining({ zone: 'marketing-main', sortOrder: 0, isActive: true }))
        expect(persistedBefore?.source_state).not.toHaveProperty('bindings')

        const nextSnapshot = createMarketingHeroSnapshot()
        const sourceWidget = nextSnapshot.layoutZoneWidgets[0]!
        const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
        sourceWidget.config = encodeLayoutWidgetConfigEnvelope(
            {
                rendererConfig: { showLeadForm: true },
                neutral: {
                    bindings: buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                        entityKind: 'object',
                        entityCodename: 'MarketingPageHero',
                        semanticKey: 'campaign'
                    })
                }
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        sourceWidget.sourceContentHash = 'hero-widget-binding-updated'
        nextSnapshot.elements![marketingIds.hero] = [
            { codename: 'default', data: marketingHeroRecordData() },
            { codename: 'campaign', data: { ...marketingHeroRecordData(), HeroKey: 'campaign' } }
        ]

        await persistPublishedWidgets({
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            snapshot: nextSnapshot,
            userId: 'user-1'
        })

        const persistedAfter = currentKnex.widgetRows.find((row) => row.widget_key === 'marketing.hero')
        expect(persistedAfter?.id).toBe(persistedBefore?.id)
        expect(persistedAfter?.source_content_hash).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/u))
        expect(persistedAfter?.source_content_hash).not.toBe(sourceHashBefore)
        expect(persistedAfter?.source_state).toEqual(sourceStateBefore)
        expect(
            decodeLayoutWidgetConfigEnvelope(persistedAfter?.config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main'
            }).neutral.bindings
        ).toEqual(
            decodeLayoutWidgetConfigEnvelope(sourceWidget.config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main'
            }).neutral.bindings
        )
        expect(
            decodeLayoutWidgetConfigEnvelope(persistedAfter?.source_config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main'
            }).neutral.bindings
        ).toEqual(
            decodeLayoutWidgetConfigEnvelope(sourceWidget.config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: 'marketing-main'
            }).neutral.bindings
        )
    })
})
