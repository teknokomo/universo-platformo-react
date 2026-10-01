import type { DbExecutor } from '@universo-react/utils/database'

export const copyLayoutFixtureIds = {
    source: '0190a9b5-3cde-7abc-8def-0123456789a1',
    created: '0190a9b5-3cde-7abc-8def-0123456789a2',
    copiedWidget: '0190a9b5-3cde-7abc-8def-0123456789a3'
} as const

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const sourceLayoutDefaults: Record<string, unknown> = {
    id: copyLayoutFixtureIds.source,
    scope_entity_id: null,
    base_layout_id: null,
    template_key: 'dashboard',
    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main dashboard' } } },
    description: null,
    config: { showOverviewCards: true },
    is_active: true,
    is_default: true,
    sort_order: 0,
    _upl_version: 1
}

const copiedLayoutDefaults: Record<string, unknown> = {
    id: copyLayoutFixtureIds.created,
    scope_entity_id: null,
    base_layout_id: null,
    template_key: 'dashboard',
    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main dashboard (copy)' } } },
    description: null,
    config: { showOverviewCards: true },
    is_active: true,
    is_default: false,
    sort_order: 0,
    _upl_version: 1
}

const withLayoutComposition = (layout: Record<string, unknown>): Record<string, unknown> => {
    const rawConfig = layout.config
    const rendererConfig =
        rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? (rawConfig as Record<string, unknown>) : {}
    const existingNeutral =
        rendererConfig.__layout && typeof rendererConfig.__layout === 'object' && !Array.isArray(rendererConfig.__layout)
            ? (rendererConfig.__layout as Record<string, unknown>)
            : {}
    const baseLayoutId = typeof layout.base_layout_id === 'string' ? layout.base_layout_id : null
    return {
        ...layout,
        config: {
            ...rendererConfig,
            __layout: {
                ...existingNeutral,
                composition: { mode: baseLayoutId ? 'overlay' : 'independent', baseLayoutId }
            }
        }
    }
}

const isLayoutSelect = (sql: string): boolean => sql.includes(`FROM "${schemaName}"."_mhb_layouts"`) && sql.includes('SELECT *')
const isLayoutInsert = (sql: string): boolean => sql.includes(`INSERT INTO "${schemaName}"."_mhb_layouts"`)

export const createCopyMetahubLayoutFixture = (options?: {
    sourceLayout?: Record<string, unknown>
    copiedLayout?: Record<string, unknown>
    sourceWidgets?: Array<Record<string, unknown>>
}) => {
    const sourceLayout = withLayoutComposition({ ...sourceLayoutDefaults, ...options?.sourceLayout })
    const copiedLayout = withLayoutComposition({ ...copiedLayoutDefaults, ...options?.copiedLayout })
    const queries: Array<{ sql: string; params: unknown[] }> = []
    const copiedWidgetIds: string[] = []

    const trx = {
        query: jest.fn(async (statement: string, values: unknown[] = []) => {
            const sql = String(statement)
            queries.push({ sql, params: values })
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (isLayoutSelect(sql)) return [sourceLayout]
            if (isLayoutInsert(sql)) return [copiedLayout]
            if (sql.includes(`FROM "${schemaName}"."_mhb_widgets"`) && sql.includes('SELECT id, zone, widget_key')) {
                return options?.sourceWidgets ?? []
            }
            if (sql.includes(`INSERT INTO "${schemaName}"."_mhb_widgets"`) && sql.includes('RETURNING id')) {
                const insertedIds = (options?.sourceWidgets ?? []).map((_, index) =>
                    index === 0 ? copyLayoutFixtureIds.copiedWidget : `0190a9b5-3cde-7abc-8def-${String(index + 4).padStart(12, '0')}`
                )
                copiedWidgetIds.push(...insertedIds)
                return insertedIds.map((id) => ({ id }))
            }
            throw new Error(`Unhandled SQL in copyMetahubLayout fixture: ${sql}`)
        }),
        transaction: jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(trx)),
        isReleased: () => false
    }
    const executor = {
        transaction: jest.fn(async (callback: (transaction: typeof trx) => Promise<unknown>) => callback(trx))
    } as unknown as DbExecutor

    return { executor, trx, queries, copiedWidgetIds }
}

export const copyLayoutFixtureSchema = schemaName
