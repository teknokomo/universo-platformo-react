import type { DbExecutor } from '@universo-react/utils'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'

export type StoredRow = Record<string, unknown>

export type MockSyncKnex = {
    layoutRows: StoredRow[]
    widgetRows: StoredRow[]
    schema: {
        withSchema: jest.Mock
    }
    withSchema: jest.Mock
    transaction: jest.Mock
    raw: jest.Mock
}

export const mockEnsureSystemTables = jest.fn(async () => undefined)
export const mockSyncExecutor: DbExecutor = {
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
}
let mockCurrentKnexAccessor: (() => MockSyncKnex) | undefined

const mockGetCurrentKnex = (): MockSyncKnex => {
    if (!mockCurrentKnexAccessor) throw new Error('Sync layout persistence test Knex accessor is not configured')
    return mockCurrentKnexAccessor()
}

export const configureSyncLayoutPersistenceKnexAccessor = (accessor: () => MockSyncKnex): void => {
    mockCurrentKnexAccessor = accessor
}

const parseJson = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const rowIsActive = (row: StoredRow): boolean => row._upl_deleted !== true && row._app_deleted !== true

export const mockSqlQuery = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    sql = sql.trim()
    const activeKnex = mockGetCurrentKnex()
    const layouts = activeKnex.layoutRows
    const widgets = activeKnex.widgetRows
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
            .filter((row) => !sql.includes('w.is_active = true') || row.is_active === true)
            .filter((row) => !sql.includes('w._upl_deleted = false') || row._upl_deleted !== true)
            .filter((row) => !sql.includes('w._app_deleted = false') || row._app_deleted !== true)
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
    if (
        sql.startsWith('UPDATE') &&
        sql.includes("sync_state = 'source_removed'") &&
        sql.includes('SET is_active = false, is_default = false')
    ) {
        const row = layouts.find((candidate) => candidate.id === params[0])
        if (!row) return []
        row.is_active = false
        row.is_default = false
        row.sync_state = 'source_removed'
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
    if (sql.startsWith('UPDATE') && sql.includes('SET source_config = CASE')) {
        const layoutIds = (params[0] as unknown[]) ?? []
        const nextIds = (params[1] as unknown[]) ?? []
        const idsToDeactivate = (params[3] as unknown[]) ?? []
        const idsToDetach = (params[4] as unknown[]) ?? []
        const changed = widgets.filter(
            (row) => layoutIds.includes(row.layout_id) && row.source_widget_id != null && !nextIds.includes(row.id) && rowIsActive(row)
        )
        for (const row of changed) {
            if (idsToDeactivate.includes(row.id)) {
                row.is_active = false
                row._upl_deleted = true
                row._upl_deleted_at = 'now'
                row._upl_deleted_by = params[2]
            } else if (row.source_base_widget_id != null) {
                row.is_active = false
            }
            if (idsToDetach.includes(row.id)) {
                row.source_config = null
                row.source_state = null
                row.source_widget_id = null
                row.source_base_widget_id = null
                row.source_content_hash = null
                row.local_content_hash = null
            }
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
            source_state: parseJson(params[7]),
            is_active: params[8],
            source_widget_id: params[9],
            source_base_widget_id: params[10],
            source_content_hash: params[11],
            local_content_hash: params[11],
            _upl_deleted: false,
            _upl_deleted_at: null,
            _upl_deleted_by: null,
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
        const applicationOwned = sql.includes('$6::jsonb, NULL::jsonb, NULL::jsonb')
        widgets.push({
            id: params[0],
            layout_id: params[1],
            zone: params[2],
            widget_key: params[3],
            sort_order: params[4],
            config: parseJson(params[5]),
            source_config: applicationOwned ? null : parseJson(params[5]),
            source_state: applicationOwned ? null : parseJson(params[6]),
            is_active: params[7],
            source_widget_id: applicationOwned ? null : params[8],
            source_base_widget_id: applicationOwned ? null : params[9],
            source_content_hash: params[10],
            local_content_hash: params[10],
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
    getApplicationSyncKnex: () => mockGetCurrentKnex(),
    getApplicationSyncDdlServices: () => ({
        generator: {
            ensureSystemTables: (...args: unknown[]) => mockEnsureSystemTables(...args)
        }
    })
}))

import {
    buildApplicationLayoutChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    persistPublishedLayouts as persistPublishedLayoutsImpl,
    persistPublishedWidgets as persistPublishedWidgetsImpl
} from '../../routes/sync/syncLayoutPersistence'

export const persistPublishedLayouts = (options: Parameters<typeof persistPublishedLayoutsImpl>[0]) =>
    persistPublishedLayoutsImpl({ ...options, executor: options.executor ?? mockSyncExecutor })
export const persistPublishedWidgets = (options: Parameters<typeof persistPublishedWidgetsImpl>[0]) =>
    persistPublishedWidgetsImpl({ ...options, executor: options.executor ?? mockSyncExecutor })

export const createMockSyncKnex = (overrides?: { layoutRows?: StoredRow[]; widgetRows?: StoredRow[] }): MockSyncKnex => {
    const normalizeLayoutFixture = (row: StoredRow): StoredRow => ({
        template_key: 'dashboard',
        config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
        ...row
    })
    const normalizeWidgetFixture = (input: StoredRow): StoredRow => {
        const row = {
            zone: 'center',
            widget_key: 'detailsTable',
            sort_order: 0,
            config: {},
            source_config: null,
            is_active: true,
            ...input
        }
        const layout = (overrides?.layoutRows ?? []).find((candidate) => candidate.id === row.layout_id)
        const hasSourceLineage =
            (row.source_config !== null && row.source_config !== undefined) ||
            (row.source_widget_id !== null && row.source_widget_id !== undefined) ||
            (row.source_base_widget_id !== null && row.source_base_widget_id !== undefined)
        if (row.source_state === undefined && hasSourceLineage) {
            try {
                row.source_state = createApplicationLayoutWidgetSourceState(
                    String(layout?.template_key ?? 'dashboard') as 'dashboard' | 'marketing-page',
                    String(row.widget_key),
                    {
                        zone: String(row.zone),
                        sortOrder: Number(row.sort_order),
                        isActive: row.is_active === true,
                        config: row.source_config ?? row.config
                    }
                )
            } catch {
                row.source_state = null
            }
        }
        return row
    }
    const state = {
        layoutRows: overrides?.layoutRows?.map(normalizeLayoutFixture) ?? [],
        widgetRows: overrides?.widgetRows?.map(normalizeWidgetFixture) ?? []
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

export const resetSyncLayoutPersistenceMocks = (): void => {
    jest.clearAllMocks()
    ;(mockSyncExecutor.query as jest.Mock).mockImplementation(mockSqlQuery)
    ;(mockSyncExecutor.transaction as jest.Mock).mockImplementation(async (callback: (executor: DbExecutor) => Promise<unknown>) =>
        callback(mockSyncExecutor)
    )
}

export {
    buildApplicationLayoutChanges,
    hasPublishedLayoutsChanges,
    hasPublishedWidgetsChanges,
    persistPublishedLayoutsImpl,
    persistPublishedWidgetsImpl
}
