import { qSchemaTable } from '@universo-react/database'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_WIDGET_REGISTRY,
    applicationLayoutCompositionSchema,
    applicationTemplateKeySchema,
    getLayoutWidgetAllowedZones,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type ApplicationLayout,
    type ApplicationLayoutDetailResponse,
    type ApplicationLayoutWidget,
    type LayoutWidgetDefinition
} from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'

export const GLOBAL_SCOPE_ID = 'global'

export interface LayoutRow {
    id: string
    scope_entity_id: string | null
    template_key: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    config: Record<string, unknown>
    is_active: boolean
    is_default: boolean
    sort_order: number
    source_kind: 'metahub' | 'application'
    source_layout_id: string | null
    source_snapshot_hash: string | null
    source_content_hash: string | null
    local_content_hash: string | null
    sync_state: ApplicationLayout['syncState']
    is_source_excluded: boolean
    source_deleted_at: string | null
    source_deleted_by: string | null
    version: number
}

export interface WidgetRow {
    id: string
    layout_id: string
    zone: string
    widget_key: string
    sort_order: number
    config: Record<string, unknown>
    source_config: Record<string, unknown> | null
    source_widget_id?: string | null
    source_base_widget_id?: string | null
    is_customized: boolean
    is_active: boolean
    version: number
}

export type LayoutComposition = { compositionMode: 'overlay' | 'independent'; baseLayoutId: string | null }

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const stripLayoutCompositionMetadata = (value: unknown): Record<string, unknown> => {
    const config = isRecord(value) ? value : {}
    const { compositionMode: _compositionMode, baseLayoutId: _baseLayoutId, ...rendererConfig } = config
    return rendererConfig
}

export const withLayoutCompositionMetadata = (
    config: Record<string, unknown>,
    composition: LayoutComposition
): Record<string, unknown> => ({
    ...config,
    ...composition
})

export const resolveExistingLayoutComposition = (
    layout: ApplicationLayout,
    widgets: readonly ApplicationLayoutWidget[]
): LayoutComposition => {
    if (layout.scopeEntityId && layout.compositionMode === 'overlay' && layout.baseLayoutId) {
        return { compositionMode: 'overlay', baseLayoutId: layout.baseLayoutId }
    }
    const hasInheritedWidgets = widgets.some((widget) => widget.sourceBaseWidgetId !== null && widget.sourceBaseWidgetId !== undefined)
    if (layout.scopeEntityId && hasInheritedWidgets && layout.sourceLayoutId) {
        return { compositionMode: 'overlay', baseLayoutId: layout.sourceLayoutId }
    }
    return { compositionMode: 'independent', baseLayoutId: null }
}

export const parseLayoutConfigForStorage = (
    templateKey: ApplicationLayout['templateKey'],
    value: unknown,
    composition: LayoutComposition
): Record<string, unknown> => {
    const rendererConfig = parseApplicationLayoutConfig(templateKey, stripLayoutCompositionMetadata(value))
    return withLayoutCompositionMetadata(rendererConfig, composition)
}

export const parseLayoutConfigForRead = (templateKey: ApplicationLayout['templateKey'], value: unknown): ApplicationLayout['config'] => {
    const rawConfig = stripLayoutCompositionMetadata(value)
    try {
        return parseApplicationLayoutConfig(templateKey, rawConfig)
    } catch {
        // Keep a malformed persisted config inspectable by the admin UI. The
        // appearance panel can then show its localized invalid-config state;
        // mutation and runtime paths still validate strictly and fail closed.
        return rawConfig as ApplicationLayout['config']
    }
}

export function assertApplicationLayoutWidgetConfig(
    widgetKey: string,
    config: unknown,
    options: { generateInstanceKey?: boolean } = {}
): Record<string, unknown> {
    try {
        const candidate =
            options.generateInstanceKey &&
            Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey) &&
            isRecord(config) &&
            config.instanceKey === undefined
                ? { ...config, instanceKey: generateUuidV7() }
                : config
        return parseApplicationLayoutWidgetConfig(widgetKey, candidate)
    } catch {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
}

export const mapLayout = (row: LayoutRow): ApplicationLayout => {
    const templateKey = applicationTemplateKeySchema.parse(row.template_key)
    const rawConfig = isRecord(row.config) ? row.config : {}
    const composition = applicationLayoutCompositionSchema.parse({
        compositionMode: rawConfig.compositionMode ?? 'independent',
        baseLayoutId: rawConfig.baseLayoutId ?? null
    })
    return {
        id: row.id,
        scopeId: row.scope_entity_id ?? GLOBAL_SCOPE_ID,
        scopeKind: row.scope_entity_id ? 'entity' : 'global',
        scopeEntityId: row.scope_entity_id,
        templateKey,
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: parseLayoutConfigForRead(templateKey, row.config),
        compositionMode: composition.compositionMode,
        baseLayoutId: composition.baseLayoutId,
        isActive: row.is_active,
        isDefault: row.is_default,
        sortOrder: row.sort_order,
        sourceKind: row.source_kind,
        sourceLayoutId: row.source_layout_id,
        sourceSnapshotHash: row.source_snapshot_hash,
        sourceContentHash: row.source_content_hash,
        localContentHash: row.local_content_hash,
        syncState: row.sync_state,
        isSourceExcluded: row.is_source_excluded,
        sourceDeletedAt: row.source_deleted_at,
        sourceDeletedBy: row.source_deleted_by,
        version: row.version
    }
}

export const mapWidget = (row: WidgetRow): ApplicationLayoutWidget => ({
    id: row.id,
    layoutId: row.layout_id,
    zone: row.zone as ApplicationLayoutWidget['zone'],
    widgetKey: row.widget_key as ApplicationLayoutWidget['widgetKey'],
    instanceKey: isRecord(row.config) && typeof row.config.instanceKey === 'string' ? row.config.instanceKey : undefined,
    sortOrder: row.sort_order,
    config: isRecord(row.config) ? row.config : {},
    sourceConfig: isRecord(row.source_config) ? row.source_config : null,
    sourceWidgetId: row.source_widget_id ?? null,
    sourceBaseWidgetId: row.source_base_widget_id ?? null,
    isCustomized: row.is_customized === true,
    isActive: row.is_active,
    version: row.version
})

export const layoutSelect = (layoutsTable: string): string => `
    SELECT
      ${layoutsTable}.id,
      ${layoutsTable}.scope_entity_id,
      ${layoutsTable}.template_key,
      ${layoutsTable}.name,
      ${layoutsTable}.description,
      ${layoutsTable}.config,
      ${layoutsTable}.is_active,
      ${layoutsTable}.is_default,
      ${layoutsTable}.sort_order,
      ${layoutsTable}.source_kind,
      ${layoutsTable}.source_layout_id,
      ${layoutsTable}.source_snapshot_hash,
      ${layoutsTable}.source_content_hash,
      ${layoutsTable}.local_content_hash,
      ${layoutsTable}.sync_state,
      ${layoutsTable}.is_source_excluded,
      ${layoutsTable}.source_deleted_at::text,
      ${layoutsTable}.source_deleted_by,
      COALESCE(${layoutsTable}._upl_version, 1)::int AS version
    FROM ${layoutsTable}
`

export const widgetSelect = (widgetsTable: string): string => `
    SELECT
      id,
      layout_id,
      zone,
      widget_key,
      sort_order,
      config,
      source_config,
      source_widget_id,
      source_base_widget_id,
      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
      is_active,
      COALESCE(_upl_version, 1)::int AS version
    FROM ${widgetsTable}
`

/**
 * Layout widgets are valid only on active application layouts. The selected
 * template adapter performs the key/zone compatibility check before writes;
 * keeping this predicate broad lets both dashboard and marketing adapters use
 * the same SQL-first mutation paths.
 */
export type DashboardLayoutIdExpression = 'layout_id' | 'w.layout_id' | '$1'

export const applicationLayoutWidgetPredicate = (layoutsTable: string, layoutIdExpression: DashboardLayoutIdExpression): string =>
    `EXISTS (
        SELECT 1
        FROM ${layoutsTable} AS layout_guard
        WHERE layout_guard.id = ${layoutIdExpression}
          AND layout_guard.template_key IN ('dashboard', 'marketing-page')
          AND layout_guard.is_active = true
          AND layout_guard._upl_deleted = false
          AND layout_guard._app_deleted = false
    )`

export const getApplicationWidgetDefinition = (widgetKey: string): LayoutWidgetDefinition | undefined =>
    LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === widgetKey)

export const isMarketingWidgetKey = (widgetKey: string): boolean =>
    Object.prototype.hasOwnProperty.call(MARKETING_WIDGET_REGISTRY, widgetKey)

export const assertWidgetPlacementForTemplate = (
    templateKey: ApplicationLayout['templateKey'],
    widgetKey: string,
    zone: string
): LayoutWidgetDefinition => {
    const definition = getApplicationWidgetDefinition(widgetKey)
    if (
        !definition ||
        !definition.supportedTemplates.includes(templateKey) ||
        !getLayoutWidgetAllowedZones(widgetKey, templateKey)?.includes(zone as ApplicationLayoutWidget['zone'])
    ) {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
    return definition
}

export const assertApplicationLayoutWidgetMultiplicity = (
    templateKey: ApplicationLayout['templateKey'],
    widgets: readonly Pick<ApplicationLayoutWidget, 'widgetKey'>[]
): void => {
    const seenSingletons = new Set<string>()

    for (const widget of widgets) {
        const definition = getApplicationWidgetDefinition(widget.widgetKey)
        if (!definition || !definition.supportedTemplates.includes(templateKey) || definition.multiInstance) continue
        if (seenSingletons.has(widget.widgetKey)) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_SINGLETON_CONFLICT')
        }
        seenSingletons.add(widget.widgetKey)
    }
}

export const prepareCopiedWidgetConfigs = (
    templateKey: ApplicationLayout['templateKey'],
    widgets: ApplicationLayoutWidget[]
): Map<string, Record<string, unknown>> => {
    assertApplicationLayoutWidgetMultiplicity(templateKey, widgets)
    const instanceKeys = new Set<string>()
    const copiedConfigs = new Map<string, Record<string, unknown>>()

    for (const widget of widgets) {
        assertWidgetPlacementForTemplate(templateKey, widget.widgetKey, widget.zone)

        const sourceConfig = isMarketingWidgetKey(widget.widgetKey) ? { ...widget.config, instanceKey: generateUuidV7() } : widget.config
        const config = assertApplicationLayoutWidgetConfig(widget.widgetKey, sourceConfig)
        if (isMarketingWidgetKey(widget.widgetKey)) {
            const instanceKey = String(config.instanceKey)
            if (instanceKeys.has(instanceKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
            instanceKeys.add(instanceKey)
        }
        copiedConfigs.set(widget.id, config)
    }

    return copiedConfigs
}

export const applicationLayoutScopeLockKey = (schemaName: string, scopeEntityId: string | null): string =>
    `${schemaName}:layout-scope:${scopeEntityId ?? GLOBAL_SCOPE_ID}`

export const applicationLayoutMutationLockKey = (schemaName: string): string => `${schemaName}:application-layout-mutations`

export const applicationLayoutLockKey = (schemaName: string, layoutId: string): string => `${schemaName}:layout:${layoutId}`

export const applicationLayoutWidgetsLockKey = (schemaName: string, layoutId: string): string => `${schemaName}:layout:${layoutId}:widgets`

const applicationLayoutMutationError = (constraint: unknown): string | null => {
    if (typeof constraint !== 'string') return null
    if (constraint === 'idx_app_layouts_default_active') return 'APPLICATION_LAYOUT_DEFAULT_CONFLICT'
    if (constraint === 'idx_app_widgets_layout_source_base_active') return 'APPLICATION_LAYOUT_WIDGET_SOURCE_CONFLICT'
    return null
}

const normalizeApplicationLayoutMutationError = (error: unknown): unknown => {
    if (!isRecord(error) || error.code !== '23505') return error
    const code = applicationLayoutMutationError(error.constraint)
    return code ? new Error(code) : error
}

export const runApplicationLayoutTransaction = async <T>(
    executor: DbExecutor,
    callback: (transaction: DbExecutor) => Promise<T>
): Promise<T> => {
    try {
        return await executor.transaction(callback)
    } catch (error) {
        throw normalizeApplicationLayoutMutationError(error)
    }
}

/**
 * All layout mutations acquire the same advisory lock family before taking a
 * scope, layout, or widget lock.  Publication sync uses these helpers too so
 * authoring and publication cannot observe or update the same hierarchy in a
 * different order.
 */
export const lockApplicationLayoutMutationFamily = async (executor: DbExecutor, schemaName: string): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutMutationLockKey(schemaName)])
}

export const lockApplicationLayoutScope = async (executor: DbExecutor, schemaName: string, scopeEntityId: string | null): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutScopeLockKey(schemaName, scopeEntityId)])
}

export const lockApplicationLayoutRow = async (executor: DbExecutor, schemaName: string, layoutId: string): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutLockKey(schemaName, layoutId)])
}

export const lockApplicationLayoutWidgetSet = async (executor: DbExecutor, schemaName: string, layoutId: string): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [applicationLayoutWidgetsLockKey(schemaName, layoutId)])
}

/**
 * Locks an application layout mutation in the single scope -> layout -> widgets order.
 * The first scope lookup is deliberately not trusted as the mutation snapshot: the
 * layout row is read again with FOR UPDATE after the advisory locks are acquired.
 */
export const lockApplicationLayoutMutation = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string
): Promise<ApplicationLayoutDetailResponse | null> => {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const scopeRows = await executor.query<{ scope_entity_id: string | null }>(
        `
        SELECT scope_entity_id
        FROM ${layoutsTable}
        WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
        LIMIT 1
        `,
        [layoutId]
    )
    if (!scopeRows[0]) return null

    const initialScopeEntityId = scopeRows[0].scope_entity_id ?? null
    await lockApplicationLayoutMutationFamily(executor, schemaName)
    await lockApplicationLayoutScope(executor, schemaName, initialScopeEntityId)
    await lockApplicationLayoutRow(executor, schemaName, layoutId)

    const layoutRows = await executor.query<LayoutRow>(
        `${layoutSelect(layoutsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1 FOR UPDATE`,
        [layoutId]
    )
    if (!layoutRows[0]) return null

    const lockedScopeEntityId = layoutRows[0].scope_entity_id ?? null
    if (lockedScopeEntityId !== initialScopeEntityId) {
        throw new Error('APPLICATION_LAYOUT_SCOPE_CONFLICT')
    }

    await lockApplicationLayoutWidgetSet(executor, schemaName, layoutId)
    const widgets = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC FOR UPDATE`,
        [layoutId]
    )
    const mappedLayout = mapLayout(layoutRows[0])
    const mappedWidgets = widgets.map(mapWidget)
    assertApplicationLayoutWidgetMultiplicity(mappedLayout.templateKey, mappedWidgets)
    return { item: mappedLayout, widgets: mappedWidgets }
}

export const getApplicationLayoutDetail = async (
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    options: { forUpdate?: boolean } = {}
): Promise<ApplicationLayoutDetailResponse | null> => {
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const rowLock = options.forUpdate === true ? ' FOR UPDATE' : ''
    const rows = await executor.query<LayoutRow>(
        `${layoutSelect(layoutsTable)} WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1${rowLock}`,
        [layoutId]
    )
    if (!rows[0]) return null
    const widgets = await executor.query<WidgetRow>(
        `${widgetSelect(widgetsTable)}
         WHERE layout_id = $1 AND _upl_deleted = false AND _app_deleted = false
         ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC${rowLock}`,
        [layoutId]
    )
    return { item: mapLayout(rows[0]), widgets: widgets.map(mapWidget) }
}
