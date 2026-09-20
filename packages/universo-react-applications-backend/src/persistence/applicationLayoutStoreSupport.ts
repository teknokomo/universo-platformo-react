import { qSchemaTable } from '@universo-react/database'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_WIDGET_REGISTRY,
    applicationLayoutDetailResponseSchema,
    applicationLayoutSchema,
    applicationLayoutWidgetSchema,
    applicationTemplateKeySchema,
    decodeLayoutConfigEnvelope,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefaultPlacement,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type LayoutLogicalPlacement,
    type PersistedLayoutNeutralMetadata,
    type ApplicationLayout,
    type ApplicationLayoutDetailResponse,
    type ApplicationLayoutWidget,
    type LayoutWidgetDefinition
} from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'

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

export type ApplicationLayoutWidgetWithPlacement = ApplicationLayoutWidget & { placement?: LayoutLogicalPlacement }

export type LayoutConfigEnvelope = {
    rendererConfig: Record<string, unknown>
    neutral: PersistedLayoutNeutralMetadata
}

const rawLayoutConfigSymbol = Symbol('application-layout-raw-config')

type InternalLayoutDetail = ApplicationLayoutDetailResponse & {
    [rawLayoutConfigSymbol]?: Record<string, unknown>
}

export const getApplicationLayoutRawConfig = (detail: ApplicationLayoutDetailResponse): Record<string, unknown> => {
    const rawConfig = (detail as InternalLayoutDetail)[rawLayoutConfigSymbol]
    if (!isRecord(rawConfig)) throw new Error('APPLICATION_LAYOUT_CONFIG_INVALID')
    return rawConfig
}

const attachRawLayoutConfig = (
    detail: ApplicationLayoutDetailResponse,
    rawConfig: Record<string, unknown>
): ApplicationLayoutDetailResponse => {
    Object.defineProperty(detail, rawLayoutConfigSymbol, { configurable: false, enumerable: false, value: rawConfig })
    return detail
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

export const assertRendererConfigInput = (value: unknown): Record<string, unknown> => {
    const config = isRecord(value) ? value : {}
    if (hasOwn(config, '__layout') || hasOwn(config, 'compositionMode') || hasOwn(config, 'baseLayoutId')) {
        throw new Error('APPLICATION_LAYOUT_RESERVED_METADATA')
    }
    return config
}

export const layoutCompositionToNeutral = (composition: LayoutComposition): PersistedLayoutNeutralMetadata['composition'] => {
    if (composition.compositionMode === 'overlay') {
        if (!composition.baseLayoutId) throw new Error('APPLICATION_LAYOUT_COMPOSITION_INVALID')
        return { mode: 'overlay', baseLayoutId: composition.baseLayoutId }
    }
    return { mode: 'independent', baseLayoutId: null }
}

const neutralToComposition = (neutral: PersistedLayoutNeutralMetadata): LayoutComposition => {
    if (!neutral.composition) throw new Error('APPLICATION_LAYOUT_COMPOSITION_INVALID')
    return neutral.composition.mode === 'overlay'
        ? { compositionMode: 'overlay', baseLayoutId: neutral.composition.baseLayoutId }
        : { compositionMode: 'independent', baseLayoutId: null }
}

export const readLayoutConfigEnvelope = (templateKey: ApplicationLayout['templateKey'], value: unknown): LayoutConfigEnvelope => {
    if (!isRecord(value)) throw new Error('APPLICATION_LAYOUT_CONFIG_INVALID')
    const decoded = decodeLayoutConfigEnvelope(value, { templateKey })
    return {
        rendererConfig: parseApplicationLayoutConfig(templateKey, decoded.rendererConfig),
        neutral: decoded.neutral
    }
}

export const encodeLayoutConfigForStorage = (
    templateKey: ApplicationLayout['templateKey'],
    rendererConfig: unknown,
    neutral: PersistedLayoutNeutralMetadata,
    options: { omitSourceZoneSettings?: boolean } = {}
): Record<string, unknown> => {
    const parsedRendererConfig = parseApplicationLayoutConfig(templateKey, assertRendererConfigInput(rendererConfig))
    return encodeLayoutConfigEnvelope(
        { rendererConfig: parsedRendererConfig, neutral },
        { templateKey, omitSourceZoneSettings: options.omitSourceZoneSettings }
    )
}

export const withLayoutCompositionMetadata = (
    config: Record<string, unknown>,
    composition: LayoutComposition,
    templateKey: ApplicationLayout['templateKey'] = 'dashboard'
): Record<string, unknown> =>
    encodeLayoutConfigForStorage(templateKey, config, {
        composition: layoutCompositionToNeutral(composition)
    })

export const resolveExistingLayoutComposition = (layout: ApplicationLayout): LayoutComposition => {
    if (!layout.neutral?.composition) throw new Error('APPLICATION_LAYOUT_COMPOSITION_INVALID')
    return neutralToComposition(layout.neutral)
}

export const parseLayoutConfigForStorage = (
    templateKey: ApplicationLayout['templateKey'],
    value: unknown,
    composition: LayoutComposition
): Record<string, unknown> => {
    return encodeLayoutConfigForStorage(templateKey, value, {
        composition: layoutCompositionToNeutral(composition)
    })
}

export const parseLayoutConfigForRead = (templateKey: ApplicationLayout['templateKey'], value: unknown): ApplicationLayout['config'] => {
    try {
        return readLayoutConfigEnvelope(templateKey, value).rendererConfig as ApplicationLayout['config']
    } catch {
        throw new Error('APPLICATION_LAYOUT_CONFIG_INVALID')
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
        const candidateConfig = isRecord(candidate) ? candidate : {}
        if (hasOwn(candidateConfig, '__layout')) throw new Error('APPLICATION_LAYOUT_RESERVED_METADATA')
        return parseApplicationLayoutWidgetConfig(widgetKey, candidateConfig)
    } catch (error) {
        if (error instanceof Error && error.message === 'APPLICATION_LAYOUT_RESERVED_METADATA') throw error
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
}

export const mapLayout = (row: LayoutRow): ApplicationLayout => {
    const templateKey = applicationTemplateKeySchema.parse(row.template_key)
    const envelope = readLayoutConfigEnvelope(templateKey, row.config)
    const composition = neutralToComposition(envelope.neutral)
    if (!isRecord(row.name)) throw new Error('APPLICATION_LAYOUT_RESPONSE_INVALID')
    if (row.description !== null && !isRecord(row.description)) throw new Error('APPLICATION_LAYOUT_RESPONSE_INVALID')
    return applicationLayoutSchema.parse({
        id: row.id,
        scopeId: row.scope_entity_id ?? GLOBAL_SCOPE_ID,
        scopeKind: row.scope_entity_id ? 'entity' : 'global',
        scopeEntityId: row.scope_entity_id,
        templateKey,
        name: row.name,
        description: row.description,
        config: envelope.rendererConfig as ApplicationLayout['config'],
        neutral: envelope.neutral,
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
    })
}

export const readWidgetConfigEnvelope = (
    templateKey: ApplicationLayout['templateKey'],
    widgetKey: string,
    zone: string,
    value: unknown
): { rendererConfig: Record<string, unknown>; placement?: LayoutLogicalPlacement } => {
    const decoded = decodeLayoutWidgetConfigEnvelope(value, { templateKey, widgetKey, zone })
    const parsedConfig = parseApplicationLayoutWidgetConfig(widgetKey, decoded.rendererConfig)
    const defaultPlacement = getLayoutWidgetDefaultPlacement({ templateKey, widgetKey, zone })
    return {
        rendererConfig: parsedConfig,
        ...(decoded.neutral.placement ?? defaultPlacement ? { placement: decoded.neutral.placement ?? defaultPlacement } : {})
    }
}

export const encodeWidgetConfigForStorage = (
    templateKey: ApplicationLayout['templateKey'],
    widgetKey: string,
    zone: string,
    rendererConfig: unknown,
    placement?: LayoutLogicalPlacement
): Record<string, unknown> => {
    const config = isRecord(rendererConfig) ? rendererConfig : {}
    if (hasOwn(config, '__layout')) throw new Error('APPLICATION_LAYOUT_RESERVED_METADATA')
    const parsedConfig = parseApplicationLayoutWidgetConfig(widgetKey, config)
    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig: parsedConfig, neutral: placement === undefined ? {} : { placement } },
        { templateKey, widgetKey, zone }
    )
}

export const getWidgetPlacement = (
    templateKey: ApplicationLayout['templateKey'],
    widgetKey: string,
    zone: string,
    value: unknown
): LayoutLogicalPlacement | undefined => readWidgetConfigEnvelope(templateKey, widgetKey, zone, value).placement

export const mapWidget = (row: WidgetRow, templateKey: ApplicationLayout['templateKey']): ApplicationLayoutWidgetWithPlacement => {
    if (typeof row.is_customized !== 'boolean') throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    let rendererConfig: Record<string, unknown>
    let placement: LayoutLogicalPlacement | undefined
    try {
        const decoded = readWidgetConfigEnvelope(templateKey, row.widget_key, row.zone, row.config)
        rendererConfig = decoded.rendererConfig
        placement = decoded.placement
    } catch {
        throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    }
    let sourceConfig: Record<string, unknown> | null = null
    if (row.source_config !== null && row.source_config !== undefined) {
        try {
            sourceConfig = readWidgetConfigEnvelope(templateKey, row.widget_key, row.zone, row.source_config).rendererConfig
        } catch {
            throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
        }
    }
    return applicationLayoutWidgetSchema.parse({
        id: row.id,
        layoutId: row.layout_id,
        zone: row.zone as ApplicationLayoutWidget['zone'],
        widgetKey: row.widget_key as ApplicationLayoutWidget['widgetKey'],
        instanceKey: typeof rendererConfig.instanceKey === 'string' ? rendererConfig.instanceKey : undefined,
        sortOrder: row.sort_order,
        config: rendererConfig,
        sourceConfig,
        sourceWidgetId: row.source_widget_id ?? null,
        sourceBaseWidgetId: row.source_base_widget_id ?? null,
        isCustomized: row.is_customized,
        isActive: row.is_active,
        version: row.version,
        ...(placement === undefined ? {} : { placement })
    })
}

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
        copiedConfigs.set(
            widget.id,
            encodeWidgetConfigForStorage(
                templateKey,
                widget.widgetKey,
                widget.zone,
                config,
                (widget as ApplicationLayoutWidgetWithPlacement).placement ??
                    getWidgetPlacement(templateKey, widget.widgetKey, widget.zone, config)
            )
        )
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
    await acquireAdvisoryXactLock(executor, applicationLayoutMutationLockKey(schemaName))
}

export const lockApplicationLayoutScope = async (executor: DbExecutor, schemaName: string, scopeEntityId: string | null): Promise<void> => {
    await acquireAdvisoryXactLock(executor, applicationLayoutScopeLockKey(schemaName, scopeEntityId))
}

export const lockApplicationLayoutRow = async (executor: DbExecutor, schemaName: string, layoutId: string): Promise<void> => {
    await acquireAdvisoryXactLock(executor, applicationLayoutLockKey(schemaName, layoutId))
}

export const lockApplicationLayoutWidgetSet = async (executor: DbExecutor, schemaName: string, layoutId: string): Promise<void> => {
    await acquireAdvisoryXactLock(executor, applicationLayoutWidgetsLockKey(schemaName, layoutId))
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
    const mappedWidgets = widgets.map((widget) => mapWidget(widget, mappedLayout.templateKey))
    assertApplicationLayoutWidgetMultiplicity(mappedLayout.templateKey, mappedWidgets)
    return attachRawLayoutConfig(
        applicationLayoutDetailResponseSchema.parse({ item: mappedLayout, widgets: mappedWidgets }),
        layoutRows[0].config
    )
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
    const mappedLayout = mapLayout(rows[0])
    return attachRawLayoutConfig(
        applicationLayoutDetailResponseSchema.parse({
            item: mappedLayout,
            widgets: widgets.map((widget) => mapWidget(widget, mappedLayout.templateKey))
        }),
        rows[0].config
    )
}
