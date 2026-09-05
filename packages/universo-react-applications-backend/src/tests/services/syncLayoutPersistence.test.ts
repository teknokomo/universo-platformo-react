import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import type { DbExecutor } from '@universo-react/utils'

type StoredRow = Record<string, unknown>

type MockSyncKnex = {
    layoutRows: StoredRow[]
    widgetRows: StoredRow[]
    schema: {
        withSchema: jest.Mock
    }
    withSchema: jest.Mock
    transaction: jest.Mock
    raw: jest.Mock
}

const mockEnsureSystemTables = jest.fn(async () => undefined)
const mockSyncExecutor: DbExecutor = {
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
}
let currentKnex: MockSyncKnex

jest.mock('@universo-react/database', () => {
    const actual = jest.requireActual('@universo-react/database')
    return { ...actual, createKnexExecutor: () => mockSyncExecutor }
})

jest.mock('../../ddl', () => ({
    getApplicationSyncKnex: () => currentKnex,
    getApplicationSyncDdlServices: () => ({
        generator: {
            ensureSystemTables: (...args: unknown[]) => mockEnsureSystemTables(...args)
        }
    })
}))

import { buildApplicationLayoutChanges, persistPublishedLayouts, persistPublishedWidgets } from '../../routes/sync/syncLayoutPersistence'

const createSnapshot = (): PublishedApplicationSnapshot => ({
    entities: {},
    layouts: [
        {
            id: dashboardIds.layout,
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Main' },
            description: null,
            config: { showHeader: true },
            isActive: true,
            isDefault: true,
            sortOrder: 0
        }
    ],
    layoutZoneWidgets: [
        {
            id: dashboardIds.widget,
            layoutId: dashboardIds.layout,
            zone: 'center',
            widgetKey: 'detailsTable',
            sortOrder: 1,
            config: { datasource: { kind: 'records.list', sectionCodename: 'object-1' } },
            isActive: true
        }
    ],
    defaultLayoutId: dashboardIds.layout
})

const dashboardIds = {
    layout: '0190a9b5-3cde-7abc-8def-1123456789a1',
    widget: '0190a9b5-3cde-7abc-8def-1123456789a2',
    scopedLayout: '0190a9b5-3cde-7abc-8def-1123456789a3',
    scopedWidget: '0190a9b5-3cde-7abc-8def-1123456789a4',
    homeLayout: '0190a9b5-3cde-7abc-8def-1123456789a5',
    courseLayout: '0190a9b5-3cde-7abc-8def-1123456789a6',
    homeEntity: '0190a9b5-3cde-7abc-8def-1123456789a7',
    courseEntity: '0190a9b5-3cde-7abc-8def-1123456789a8',
    baseWidget: '0190a9b5-3cde-7abc-8def-1123456789a9',
    courseWidget: '0190a9b5-3cde-7abc-8def-1123456789aa'
} as const

const marketingIds = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    widget: '0190a9b5-3cde-7abc-8def-0123456789a2',
    siteSettings: '0190a9b5-3cde-7abc-8def-0123456789a3',
    logos: '0190a9b5-3cde-7abc-8def-0123456789a4'
} as const

const createMarketingSnapshot = (): PublishedApplicationSnapshot =>
    ({
        entities: {
            [marketingIds.siteSettings]: { kind: 'object', codename: 'MarketingPageSiteSettings' },
            [marketingIds.logos]: { kind: 'object', codename: 'MarketingPageLogo' }
        },
        layouts: [
            {
                id: marketingIds.layout,
                templateKey: 'marketing-page',
                name: { en: 'Marketing page' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: [
            {
                id: marketingIds.widget,
                layoutId: marketingIds.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.collection',
                sortOrder: 0,
                config: {
                    instanceKey: 'logos',
                    source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' },
                    variant: 'logos'
                },
                isActive: true
            }
        ],
        defaultLayoutId: marketingIds.layout,
        layoutConfig: {}
    } as unknown as PublishedApplicationSnapshot)

const createMockSyncKnex = (overrides?: { layoutRows?: StoredRow[]; widgetRows?: StoredRow[] }): MockSyncKnex => {
    const state = {
        layoutRows: overrides?.layoutRows?.map((row) => ({ ...row })) ?? [],
        widgetRows: overrides?.widgetRows?.map((row) => ({ ...row })) ?? []
    }

    const createWhereBuilder = (rowsRef: 'layoutRows' | 'widgetRows') => {
        const filters: Array<Record<string, unknown>> = []
        let negativeFilters: Array<Record<string, unknown>> = []
        let whereInColumn: string | null = null
        let whereInValues: unknown[] = []
        let whereNotInColumn: string | null = null
        let whereNotInValues: unknown[] = []
        let rawCatalogId: unknown | undefined

        const matches = (row: StoredRow) =>
            filters.every((filter) => Object.entries(filter).every(([key, value]) => row[key] === value)) &&
            negativeFilters.every((filter) => Object.entries(filter).every(([key, value]) => row[key] !== value)) &&
            (whereInColumn === null || whereInValues.includes(row[whereInColumn])) &&
            (whereNotInColumn === null || !whereNotInValues.includes(row[whereNotInColumn])) &&
            (rawCatalogId === undefined || row.scope_entity_id === rawCatalogId)

        const builder = {
            where(filter: Record<string, unknown>) {
                filters.push(filter)
                return builder
            },
            whereNot(filter: Record<string, unknown>) {
                negativeFilters.push(filter)
                return builder
            },
            whereRaw(sql: string, params: unknown[]) {
                if (sql.includes('scope_entity_id IS NOT DISTINCT FROM ?')) {
                    rawCatalogId = params[0]
                }
                return builder
            },
            whereIn(column: string, values: unknown[]) {
                whereInColumn = column
                whereInValues = values
                return builder
            },
            whereNotIn(column: string, values: unknown[]) {
                whereNotInColumn = column
                whereNotInValues = values
                return builder
            },
            modify(callback: (queryBuilder: typeof builder) => void) {
                callback(builder)
                return builder
            },
            async first(columns: string[]) {
                const row = state[rowsRef]
                    .filter(matches)
                    .find((candidate) => (rawCatalogId === undefined ? true : candidate.scope_entity_id === rawCatalogId))
                return row ? Object.fromEntries(columns.map((column) => [column, row[column]])) : undefined
            },
            async select(columns: string[]) {
                return state[rowsRef]
                    .filter(matches)
                    .filter((row) => (rawCatalogId === undefined ? true : row.scope_entity_id === rawCatalogId))
                    .map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
            },
            async update(payload: Record<string, unknown>) {
                const rows = state[rowsRef].filter(matches)
                for (const row of rows) {
                    for (const [key, value] of Object.entries(payload)) {
                        row[key] = value
                    }
                }
                return rows.length
            },
            async insert(payload: Record<string, unknown>) {
                state[rowsRef].push({ ...payload })
                return [payload]
            },
            async del() {
                const before = state[rowsRef].length
                state[rowsRef] = state[rowsRef].filter((row) => !matches(row))
                return before - state[rowsRef].length
            }
        }

        return builder
    }

    const executor = {
        get layoutRows() {
            return state.layoutRows
        },
        get widgetRows() {
            return state.widgetRows
        },
        schema: {
            withSchema: jest.fn(() => ({
                hasTable: jest.fn(async () => true)
            }))
        },
        withSchema: jest.fn((_schemaName: string) => ({
            from: (tableName: string) => {
                if (tableName === '_app_layouts') {
                    return createWhereBuilder('layoutRows')
                }
                return createWhereBuilder('widgetRows')
            },
            into: (tableName: string) => ({
                insert: async (payload: Record<string, unknown>) => {
                    if (tableName === '_app_layouts') {
                        state.layoutRows.push({ ...payload })
                    } else {
                        state.widgetRows.push({ ...payload })
                    }
                    return [payload]
                }
            })
        })),
        transaction: jest.fn(async (callback: (trx: MockSyncKnex) => Promise<unknown>) => callback(executor as MockSyncKnex)),
        raw: jest.fn((sql: string) => {
            if (sql === '_upl_version + 1') {
                return 2
            }
            if (sql.includes('SELECT public.uuid_generate_v7()')) {
                return { rows: [{ id: 'generated-layout-copy' }] }
            }
            return { rows: [] }
        })
    } as unknown as MockSyncKnex

    return executor
}

describe('syncLayoutPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(mockSyncExecutor.query as jest.Mock).mockResolvedValue([])
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

        const changes = await buildApplicationLayoutChanges({ schemaName: 'app_schema', snapshot: createSnapshot() })

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

    it('rejects an invalid marketing snapshot before sync setup or writes', async () => {
        const snapshot = createMarketingSnapshot()
        snapshot.layoutZoneWidgets = []

        await expect(
            persistPublishedLayouts({
                schemaName: 'app_schema',
                snapshot,
                snapshotHash: 'snapshot-invalid',
                userId: 'user-1'
            })
        ).rejects.toThrow('at least one active widget')

        await expect(persistPublishedWidgets({ schemaName: 'app_schema', snapshot, userId: 'user-1' })).rejects.toThrow(
            'at least one active widget'
        )
        expect(mockEnsureSystemTables).not.toHaveBeenCalled()
        expect(currentKnex.layoutRows).toHaveLength(0)
        expect(currentKnex.widgetRows).toHaveLength(0)
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
        const snapshot = createMarketingSnapshot()

        await persistPublishedLayouts({ schemaName: 'app_schema', snapshot, snapshotHash: 'snapshot-valid', userId: 'user-1' })
        await persistPublishedWidgets({ schemaName: 'app_schema', snapshot, userId: 'user-1' })

        expect(currentKnex.layoutRows[0]).toMatchObject({
            id: marketingIds.layout,
            template_key: 'marketing-page',
            source_layout_id: marketingIds.layout,
            source_snapshot_hash: 'snapshot-valid',
            sync_state: 'clean'
        })
        expect(currentKnex.widgetRows[0]).toMatchObject({
            id: marketingIds.widget,
            layout_id: marketingIds.layout,
            widget_key: 'marketing.collection',
            source_widget_id: marketingIds.widget,
            source_base_widget_id: null
        })
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
            schemaName: 'app_schema',
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
                schemaName: 'app_schema',
                snapshot: createSnapshot(),
                snapshotHash: 'snapshot-bootstrap-failure',
                userId: 'user-1'
            })
        ).rejects.toThrow('Failed to ensure application layout tables')

        expect(currentKnex.layoutRows).toHaveLength(0)
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
                    config: { showHeader: false },
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
                    zone: 'center',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'legacy' } },
                    is_active: true,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await persistPublishedLayouts({
            schemaName: 'app_schema',
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
            schemaName: 'app_schema',
            snapshot: createSnapshot(),
            userId: 'user-1'
        })

        expect(currentKnex.layoutRows[0]?.source_snapshot_hash).toBe('snapshot-new')
        expect(currentKnex.layoutRows[0]?.sync_state).toBe('local_modified')
        expect(currentKnex.widgetRows[0]?.config).toEqual({ datasource: { kind: 'records.list', sectionCodename: 'legacy' } })
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
                    config: { showHeader: false },
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
                    zone: 'center',
                    widget_key: 'interpretationNetworkWorkspace',
                    sort_order: 1,
                    config: { structureMode: 'multiple', templatePanel: { showInStructureList: false, showInMatrix: true } },
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
                    sortOrder: 1,
                    config: { structureMode: 'singleSystem', templatePanel: { showInStructureList: true, showInMatrix: true } },
                    isActive: true
                }
            ]
        }

        await persistPublishedLayouts({
            schemaName: 'app_schema',
            snapshotHash: 'snapshot-new',
            snapshot,
            userId: 'user-1',
            layoutResolutionPolicy: { bySourceLayoutId: { [dashboardIds.layout]: 'keep_local' } }
        })
        await persistPublishedWidgets({ schemaName: 'app_schema', snapshot, userId: 'user-1' })

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

        await persistPublishedWidgets({ schemaName: 'app_schema', snapshot, userId: 'user-1' })

        expect(currentKnex.widgetRows[0]).toMatchObject({
            config: { structureMode: 'multiple' },
            source_config: null
        })
    })

    it('blocks an inherited sync transition to single-system mode before mutating widgets', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
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
                    widget_key: 'interpretationNetworkWorkspace',
                    config: { structureMode: 'multiple', conceptCodename: 'Structure' },
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
                    sortOrder: 1,
                    config: { structureMode: 'singleSystem', conceptCodename: 'Structure' },
                    isActive: true
                }
            ]
        }
        ;(mockSyncExecutor.query as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ objectId: 'structure-object', tableName: 'structure' }])
            .mockResolvedValueOnce([{ columnName: 'system_key' }])
            .mockResolvedValueOnce([{ count: 1 }])

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot, userId: 'user-1' })
        ).rejects.toThrow('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')

        expect(currentKnex.widgetRows[0]?.config).toEqual({ structureMode: 'multiple', conceptCodename: 'Structure' })
        expect(mockSyncExecutor.query).toHaveBeenCalledTimes(4)
    })

    it('persists inherited scoped widgets with UUID v7 ids and stable base widget links', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
                    scope_entity_id: null,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.homeLayout,
                    scope_entity_id: dashboardIds.homeEntity,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: dashboardIds.layout,
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { showDetailsTable: true },
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
                    widgetKey: 'detailsTable',
                    sortOrder: 10,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'object-1' } },
                    isActive: true
                }
            ],
            defaultLayoutId: dashboardIds.layout
        }

        await persistPublishedWidgets({
            schemaName: 'app_schema',
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
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: dashboardIds.courseLayout,
                    scope_entity_id: dashboardIds.courseEntity,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        const snapshot: PublishedApplicationSnapshot = {
            entities: {},
            layouts: [
                {
                    id: dashboardIds.layout,
                    scopeEntityId: null,
                    templateKey: 'dashboard',
                    name: { en: 'Main' },
                    description: null,
                    config: { showDetailsTable: true },
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
                    widgetKey: 'detailsTable',
                    sortOrder: 10,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'LearningResources' } },
                    isActive: true
                },
                {
                    id: dashboardIds.courseWidget,
                    layoutId: dashboardIds.courseLayout,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 20,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'CourseItems' } },
                    isActive: true
                }
            ],
            defaultLayoutId: dashboardIds.layout
        }

        await persistPublishedWidgets({
            schemaName: 'app_schema',
            snapshot,
            userId: 'user-1'
        })

        const scopedDetailsTables = currentKnex.widgetRows.filter(
            (row) => row.layout_id === dashboardIds.courseLayout && row.zone === 'center' && row.widget_key === 'detailsTable'
        )
        expect(scopedDetailsTables).toHaveLength(2)
        expect(scopedDetailsTables).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: dashboardIds.courseWidget,
                    source_base_widget_id: null,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'CourseItems' } }
                }),
                expect.objectContaining({
                    source_base_widget_id: dashboardIds.baseWidget,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'LearningResources' } }
                })
            ])
        )
    })

    it('fails closed when stored inherited widget lineage is duplicated', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
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

        await expect(persistPublishedWidgets({ schemaName: 'app_schema', snapshot: createSnapshot(), userId: 'user-1' })).rejects.toThrow(
            'duplicate source lineage'
        )
        expect(currentKnex.widgetRows).toHaveLength(2)
    })

    it('fails closed when a source widget id collides with an unrelated application widget', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: dashboardIds.layout,
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
                    layout_id: dashboardIds.homeLayout,
                    source_widget_id: null,
                    source_base_widget_id: null,
                    _upl_deleted: false,
                    _app_deleted: false
                }
            ]
        })

        await expect(persistPublishedWidgets({ schemaName: 'app_schema', snapshot: createSnapshot(), userId: 'user-1' })).rejects.toThrow(
            'identity collides with an unrelated application widget'
        )
        expect(currentKnex.widgetRows).toHaveLength(1)
    })
})
