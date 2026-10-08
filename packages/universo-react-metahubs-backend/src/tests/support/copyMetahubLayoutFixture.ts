import type { DbExecutor } from '@universo-react/utils/database'

export const copyLayoutFixtureIds = {
    source: '0190a9b5-3cde-7abc-8def-0123456789a1',
    created: '0190a9b5-3cde-7abc-8def-0123456789a2',
    copiedWidget: '0190a9b5-3cde-7abc-8def-0123456789a3',
    base: '0190a9b5-3cde-7abc-8def-0123456789a4',
    scopeEntity: '0190a9b5-3cde-7abc-8def-0123456789a5'
} as const

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const sourceLayoutDefaults: Record<string, unknown> = {
    id: copyLayoutFixtureIds.source,
    scope_entity_id: null,
    base_layout_id: null,
    template_key: 'dashboard',
    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main dashboard' } } },
    description: null,
    config: {},
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
    config: {},
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
    baseWidgets?: Array<Record<string, unknown>>
    failOnWidgetInsertAt?: number
}) => {
    const sourceLayout = withLayoutComposition({ ...sourceLayoutDefaults, ...options?.sourceLayout })
    const copiedLayout = withLayoutComposition({ ...copiedLayoutDefaults, ...options?.copiedLayout })
    const baseLayoutId = typeof sourceLayout.base_layout_id === 'string' ? sourceLayout.base_layout_id : copyLayoutFixtureIds.base
    const baseLayout = withLayoutComposition({
        ...sourceLayoutDefaults,
        id: baseLayoutId,
        scope_entity_id: null,
        base_layout_id: null
    })
    const queries: Array<{ sql: string; params: unknown[] }> = []
    const copiedWidgetIds: string[] = []
    const committedWidgetRows: Array<{ id: string; instance_key: string; parent_widget_id: string | null; slot_key: string | null }> = []
    let widgetInsertCount = 0

    const trx = {
        query: jest.fn(async (statement: string, values: unknown[] = []) => {
            const sql = String(statement)
            queries.push({ sql, params: values })
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (isLayoutSelect(sql)) return [sourceLayout]
            if (sql.includes(`FROM "${schemaName}"."_mhb_layouts"`) && sql.includes('SELECT id, scope_entity_id, base_layout_id')) {
                return [baseLayout]
            }
            if (isLayoutInsert(sql)) return [copiedLayout]
            if (sql.includes(`FROM "${schemaName}"."_mhb_objects"`) && sql.includes('SELECT t.capabilities')) {
                return [{ capabilities: { layoutConfig: { enabled: true } } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_mhb_layout_widget_overrides"`)) return []
            if (sql.includes(`FROM "${schemaName}"."_mhb_widgets"`) && sql.includes('SELECT id, instance_key, parent_widget_id')) {
                return values[0] === baseLayoutId ? options?.baseWidgets ?? [] : options?.sourceWidgets ?? []
            }
            if (sql.includes(`INSERT INTO "${schemaName}"."_mhb_widgets"`) && sql.includes('RETURNING id, instance_key')) {
                widgetInsertCount += 1
                if (options?.failOnWidgetInsertAt === widgetInsertCount) throw new Error('Injected copied widget insert failure')
                const row = {
                    id: String(values[0]),
                    instance_key: String(values[2]),
                    parent_widget_id: values[3] === null ? null : String(values[3]),
                    slot_key: values[4] === null ? null : String(values[4])
                }
                copiedWidgetIds.push(row.id)
                committedWidgetRows.push(row)
                return [{ id: row.id, instance_key: row.instance_key }]
            }
            throw new Error(`Unhandled SQL in copyMetahubLayout fixture: ${sql}`)
        }),
        transaction: jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
            const rowCount = committedWidgetRows.length
            try {
                return await callback(trx)
            } catch (error) {
                committedWidgetRows.splice(rowCount)
                copiedWidgetIds.splice(rowCount)
                throw error
            }
        }),
        isReleased: () => false
    }
    const executor = {
        transaction: jest.fn(async (callback: (transaction: typeof trx) => Promise<unknown>) => {
            const rowCount = committedWidgetRows.length
            try {
                return await callback(trx)
            } catch (error) {
                committedWidgetRows.splice(rowCount)
                copiedWidgetIds.splice(rowCount)
                throw error
            }
        })
    } as unknown as DbExecutor

    return { executor, trx, queries, copiedWidgetIds, committedWidgetRows }
}

export const copyLayoutFixtureSchema = schemaName
