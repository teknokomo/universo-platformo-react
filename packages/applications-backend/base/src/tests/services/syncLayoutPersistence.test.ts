import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

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
let currentKnex: MockSyncKnex

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
            id: 'layout-1',
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
            id: 'widget-1',
            layoutId: 'layout-1',
            zone: 'center',
            widgetKey: 'detailsTable',
            sortOrder: 1,
            config: { columns: ['name'] },
            isActive: true
        }
    ],
    defaultLayoutId: 'layout-1'
})

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
        currentKnex = createMockSyncKnex()
    })

    it('reports source_updated changes for clean imported layouts when the metahub source changes', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: 'layout-1',
                    scope_entity_id: null,
                    name: { en: 'Main' },
                    is_active: true,
                    is_default: true,
                    source_kind: 'metahub',
                    source_layout_id: 'layout-1',
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
                    sourceLayoutId: 'layout-1',
                    currentSyncState: 'source_updated'
                })
            ])
        )
    })

    it('keeps local widget configuration untouched when keep_local preserves a locally modified layout', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: 'layout-1',
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
                    source_layout_id: 'layout-1',
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
                    id: 'widget-1',
                    layout_id: 'layout-1',
                    zone: 'center',
                    widget_key: 'detailsTable',
                    sort_order: 1,
                    config: { columns: ['legacy'] },
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
                    'layout-1': 'keep_local'
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
        expect(currentKnex.widgetRows[0]?.config).toEqual({ columns: ['legacy'] })
    })

    it('persists inherited scoped widgets with UUID v7 ids and stable base widget links', async () => {
        currentKnex = createMockSyncKnex({
            layoutRows: [
                {
                    id: 'layout-main',
                    scope_entity_id: null,
                    source_kind: 'metahub',
                    sync_state: 'clean',
                    is_source_excluded: false,
                    _upl_deleted: false,
                    _app_deleted: false
                },
                {
                    id: 'layout-page-home',
                    scope_entity_id: 'page-home',
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
                    id: 'layout-main',
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
                    id: 'layout-page-home',
                    scopeEntityId: 'page-home',
                    baseLayoutId: 'layout-main',
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
                    id: 'base-widget',
                    layoutId: 'layout-main',
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 10,
                    config: { datasource: { kind: 'records.list', sectionId: 'object-1' } },
                    isActive: true
                }
            ],
            defaultLayoutId: 'layout-main'
        }

        await persistPublishedWidgets({
            schemaName: 'app_schema',
            snapshot,
            userId: 'user-1'
        })

        const inheritedWidget = currentKnex.widgetRows.find((row) => row.layout_id === 'layout-page-home')
        expect(inheritedWidget?.source_widget_id).toBe('base-widget')
        expect(inheritedWidget?.source_base_widget_id).toBe('base-widget')
        expect(inheritedWidget?.id).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
        expect(inheritedWidget?.id).not.toBe('base-widget')
    })
})
