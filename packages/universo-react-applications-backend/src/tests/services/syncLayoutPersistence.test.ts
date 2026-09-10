import type { PublishedApplicationSnapshot, SnapshotEntityDefinition } from '../../services/applicationSyncContracts'
import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { insertApplicationLayoutSyncWidget } from '../../persistence/applicationLayoutSyncStore'

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

const parseJson = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const rowIsActive = (row: StoredRow): boolean => row._upl_deleted !== true && row._app_deleted !== true

const mockSqlQuery = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    sql = sql.trim()
    const layouts = currentKnex.layoutRows
    const widgets = currentKnex.widgetRows
    if (sql.includes('information_schema.tables')) return [{ exists: true }]
    if (sql.includes('pg_advisory_xact_lock') || sql.includes('FOR UPDATE') || sql.includes('set_config')) {
        return []
    }
    if (sql.includes('SELECT id, scope_entity_id FROM')) {
        return layouts
            .filter((row) => row._app_deleted !== true)
            .map((row) => ({ id: row.id, scope_entity_id: row.scope_entity_id ?? null }))
    }
    if (sql.includes('SELECT id FROM') && sql.includes("source_kind = 'application'")) {
        const matches = layouts.filter(
            (row) =>
                rowIsActive(row) &&
                row.source_kind === 'application' &&
                row.source_layout_id === params[0] &&
                row.source_content_hash === params[1]
        )
        return matches.map((row) => ({ id: row.id }))
    }
    if (sql.includes('SELECT id, meta FROM')) return []
    if (sql.includes('AS "objectId"')) return [{ objectId: 'structure-object', tableName: 'structure' }]
    if (sql.includes('AS "columnName"')) return [{ columnName: 'system_key' }]
    if (sql.includes('COUNT(*)::int AS count')) return [{ count: 0 }]
    if (sql.includes('w.id,') && sql.includes('w.layout_id')) {
        const conflict = params[0]
        const layoutById = new Map(layouts.map((row) => [String(row.id), row]))
        return widgets
            .filter((row) => (sql.includes('l.source_kind') ? rowIsActive(row) && row.is_active !== false : true))
            .filter((row) => {
                const layout = layoutById.get(String(row.layout_id))
                return sql.includes('l.source_kind')
                    ? layout && layout.source_kind === 'metahub' && layout.is_source_excluded !== true && layout.sync_state !== conflict
                    : layout && layout._app_deleted !== true
            })
            .map((row) => ({
                ...row,
                source_base_widget_id: row.source_base_widget_id ?? null,
                source_widget_id: row.source_widget_id ?? null,
                template_key: layoutById.get(String(row.layout_id))?.template_key ?? 'dashboard'
            }))
    }
    if (sql.includes('l.id,') && sql.includes('_app_layouts')) {
        const conflict = params[0]
        return layouts
            .filter((row) => rowIsActive(row))
            .filter((row) => {
                if (!sql.includes('l.source_kind =')) return true
                return row.source_kind === 'metahub' && row.is_source_excluded !== true && row.sync_state !== conflict
            })
            .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    }
    if (sql.includes('SELECT config FROM')) {
        const isFallback = sql.includes('is_active = true')
        const matches = layouts.filter(
            (row) =>
                rowIsActive(row) &&
                row.scope_entity_id == null &&
                row.template_key === params[0] &&
                (isFallback ? row.is_active === true : row.is_default === true)
        )
        return matches.slice(0, 1).map((row) => ({ config: row.config }))
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET is_default = false')) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        row.is_default = false
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('UPDATE') && sql.includes('WHERE id = ANY($1::uuid[])') && sql.includes('_upl_updated_at = NOW()')) {
        const layoutIds = (params[0] as unknown[]) ?? []
        const changed = layouts.filter((row) => layoutIds.includes(row.id) && row._upl_deleted !== true && row._app_deleted !== true)
        for (const row of changed) {
            row._upl_version = Number(row._upl_version ?? 1) + 1
        }
        return changed.map((row) => ({ id: row.id }))
    }
    if (sql.startsWith('UPDATE') && sql.includes("source_kind = 'application'")) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        row.source_kind = 'application'
        row.source_layout_id = null
        row.source_snapshot_hash = null
        row.source_content_hash = null
        row.sync_state = 'clean'
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET is_active = CASE')) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        if (params[1] !== 'skip_source') {
            row.is_active = false
            row.is_default = false
        }
        row.sync_state = 'source_removed'
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('UPDATE') && sql.includes('source_snapshot_hash = COALESCE')) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        if (params[1] !== null) row.source_snapshot_hash = params[1]
        if (params[2] !== null) row.source_content_hash = params[2]
        if (params[3] !== null) row.sync_state = params[3]
        if (params[4] !== null) row.is_default = params[4]
        if (params[5] !== null) row.is_active = params[5]
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET source_config = NULL')) {
        const layoutIds = (params[0] as unknown[]) ?? []
        const nextIds = (params[1] as unknown[]) ?? []
        const changed = widgets.filter(
            (row) => layoutIds.includes(row.layout_id) && row.source_widget_id != null && !nextIds.includes(row.id) && rowIsActive(row)
        )
        for (const row of changed) {
            row.source_config = null
            if (row.source_base_widget_id != null) row.is_active = false
            row._upl_version = Number(row._upl_version ?? 1) + 1
        }
        return changed.map((row) => ({ id: row.id, layout_id: row.layout_id }))
    }
    if (
        sql.startsWith('UPDATE') &&
        sql.includes('WHERE layout_id = $1') &&
        sql.includes('_upl_deleted = true') &&
        sql.includes('RETURNING id, layout_id, is_active, _upl_deleted, _app_deleted')
    ) {
        const layoutId = params[0]
        const changed = widgets.filter((row) => row.layout_id === layoutId && row._upl_deleted !== true && row._app_deleted !== true)
        for (const row of changed) {
            row.is_active = false
            row._upl_deleted = true
            row._app_deleted = false
            row._upl_version = Number(row._upl_version ?? 1) + 1
        }
        return changed.map((row) => ({
            id: row.id,
            layout_id: row.layout_id,
            is_active: row.is_active,
            _upl_deleted: row._upl_deleted,
            _app_deleted: row._app_deleted
        }))
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET is_active = false') && sql.includes('_upl_deleted = true')) {
        const layoutIds = (params[0] as unknown[]) ?? []
        const nextIds = (params[1] as unknown[]) ?? []
        const changed = widgets.filter(
            (row) => layoutIds.includes(row.layout_id) && row.source_widget_id != null && !nextIds.includes(row.id) && rowIsActive(row)
        )
        for (const row of changed) {
            row.is_active = false
            row._upl_deleted = true
            row._upl_version = Number(row._upl_version ?? 1) + 1
        }
        return changed.map((row) => ({ id: row.id, layout_id: row.layout_id }))
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET layout_id =')) {
        const row = widgets.find((candidate) => candidate.id === params[0])
        if (!row) return []
        Object.assign(row, {
            layout_id: params[1],
            zone: params[2],
            widget_key: params[3],
            sort_order: params[4],
            config: parseJson(params[5]),
            source_config: parseJson(params[6]),
            is_active: params[7],
            source_widget_id: params[8],
            source_base_widget_id: params[9],
            source_content_hash: params[10],
            local_content_hash: params[10],
            _upl_deleted: false,
            _app_deleted: false
        })
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('UPDATE') && sql.includes('SET scope_entity_id =')) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        Object.assign(row, {
            scope_entity_id: params[1],
            template_key: params[2],
            name: parseJson(params[3]),
            description: parseJson(params[4]),
            config: parseJson(params[5]),
            is_active: params[6],
            is_default: params[7],
            sort_order: params[8],
            source_kind: params[9],
            source_layout_id: params[10],
            source_snapshot_hash: params[11],
            source_content_hash: params[12],
            local_content_hash: params[13],
            sync_state: params[14],
            is_source_excluded: params[15],
            _upl_deleted: false,
            _app_deleted: false
        })
        row._upl_version = Number(row._upl_version ?? 1) + 1
        return [{ id: row.id }]
    }
    if (sql.startsWith('INSERT INTO') && sql.includes('_app_layouts')) {
        layouts.push({
            id: params[0],
            scope_entity_id: params[1],
            template_key: params[2],
            name: parseJson(params[3]),
            description: parseJson(params[4]),
            config: parseJson(params[5]),
            is_active: params[6],
            is_default: params[7],
            sort_order: params[8],
            source_kind: params[9],
            source_layout_id: params[10],
            source_snapshot_hash: params[11],
            source_content_hash: params[12],
            local_content_hash: params[12],
            sync_state: params[13],
            is_source_excluded: false,
            _upl_version: 1,
            _upl_deleted: false,
            _app_deleted: false
        })
        return [{ id: params[0] }]
    }
    if (sql.startsWith('INSERT INTO') && sql.includes('_app_widgets')) {
        widgets.push({
            id: params[0],
            layout_id: params[1],
            zone: params[2],
            widget_key: params[3],
            sort_order: params[4],
            config: parseJson(params[5]),
            source_config: parseJson(params[5]),
            is_active: params[6],
            source_widget_id: params[7],
            source_base_widget_id: params[8],
            source_content_hash: params[9],
            local_content_hash: params[9],
            _upl_version: 1,
            _upl_deleted: false,
            _app_deleted: false
        })
        return [{ id: params[0] }]
    }
    return []
}

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

import {
    buildApplicationLayoutChanges,
    persistPublishedLayouts as persistPublishedLayoutsImpl,
    persistPublishedWidgets as persistPublishedWidgetsImpl
} from '../../routes/sync/syncLayoutPersistence'

const persistPublishedLayouts = (options: Parameters<typeof persistPublishedLayoutsImpl>[0]) =>
    persistPublishedLayoutsImpl({ ...options, executor: options.executor ?? mockSyncExecutor })
const persistPublishedWidgets = (options: Parameters<typeof persistPublishedWidgetsImpl>[0]) =>
    persistPublishedWidgetsImpl({ ...options, executor: options.executor ?? mockSyncExecutor })

const createSnapshot = (): PublishedApplicationSnapshot => ({
    entities: {},
    layouts: [
        {
            id: dashboardIds.layout,
            scopeEntityId: null,
            templateKey: 'dashboard',
            compositionMode: 'independent',
            baseLayoutId: null,
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

const createScopedEntity = (id: string, codename: string): SnapshotEntityDefinition => ({
    id,
    kind: 'page',
    codename,
    presentation: {
        name: {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: {
                    content: codename,
                    version: 1,
                    isActive: true,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z'
                }
            }
        }
    },
    fields: []
})

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
                compositionMode: 'independent',
                baseLayoutId: null,
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
        ;(mockSyncExecutor.query as jest.Mock).mockImplementation(mockSqlQuery)
        ;(mockSyncExecutor.transaction as jest.Mock).mockImplementation(async (callback: (executor: DbExecutor) => Promise<unknown>) =>
            callback(mockSyncExecutor)
        )
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
        const snapshot = createMarketingSnapshot()
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
            widget_key: 'marketing.collection',
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

        const changedSnapshot = createMarketingSnapshot()
        const changedWidget = changedSnapshot.layoutZoneWidgets[0]
        if (!changedWidget) throw new Error('Expected marketing widget fixture')
        changedWidget.config = { ...changedWidget.config, showTitle: false }
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
            widgetKey: 'detailsTable',
            sortOrder: 1,
            config: { datasource: { kind: 'records.list', sectionCodename: 'Object' } },
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
        expect(sql).toMatch(/NULL, NULL, NULL, \$10/u)
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
        expect((scopedLayout?.config as Record<string, unknown>)?.baseLayoutId).toBe(baseLayout?.id)

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
                    widgetKey: 'detailsTable',
                    sortOrder: 10,
                    config: { datasource: { kind: 'records.list', sectionCodename: 'object-1' } },
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
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
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

        await expect(
            persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })
        ).rejects.toThrow('duplicate source lineage')
        expect(currentKnex.widgetRows).toHaveLength(2)
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

    it('allocates a new physical widget id when the source id belongs to an unrelated application row', async () => {
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

        await persistPublishedWidgets({ schemaName: 'app_018f8a787b8f7c1da111222233334444', snapshot: createSnapshot(), userId: 'user-1' })
        expect(currentKnex.widgetRows).toHaveLength(2)
        const materialized = currentKnex.widgetRows.find((row) => row.layout_id === dashboardIds.layout)
        expect(materialized).toMatchObject({
            source_widget_id: dashboardIds.widget,
            source_base_widget_id: null
        })
        expect(materialized?.id).not.toBe(dashboardIds.widget)
    })
})
