import type { EntityDefinition } from '@universo-react/schema-ddl'
import {
    MARKETING_LAYOUT_ZONES,
    decodeLayoutConfigEnvelope,
    encodeLayoutConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetAllowedZones,
    layoutInstanceKeySchema,
    parseApplicationLayoutConfig,
    type ApplicationLayoutWidget,
    type ApplicationTemplateKey,
    type LayoutNeutralComposition,
    type PersistedLayoutNeutralMetadata,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { getCodenamePrimary, normalizeDashboardLayoutConfig } from '@universo-react/utils'
import {
    applicationLayoutWidgetPlacementSchema,
    decodePlacementWidgetConfigEnvelope,
    parsePlacementRendererConfig,
    resolvePlacementBindingValidation
} from '../../persistence/applicationLayoutWidgetPlacement'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { isRecord, parseApplicationTemplateKey } from './syncValueHelpers'
import type {
    PersistedAppLayout,
    PersistedAppLayoutZoneWidget,
    SnapshotLayoutRow,
    SnapshotScopedLayoutRow,
    SnapshotLayoutWidgetOverrideRow,
    SnapshotWidgetRow
} from './syncTypes'

const DASHBOARD_LAYOUT_ZONE_SET = new Set<ApplicationLayoutWidget['zone']>(['left', 'top', 'right', 'bottom', 'center'])
const MARKETING_LAYOUT_ZONE_SET = new Set<ApplicationLayoutWidget['zone']>(MARKETING_LAYOUT_ZONES)

const normalizeLayoutZone = (value: unknown, templateKey: ApplicationTemplateKey): ApplicationLayoutWidget['zone'] => {
    const zones = templateKey === 'dashboard' ? DASHBOARD_LAYOUT_ZONE_SET : MARKETING_LAYOUT_ZONE_SET
    if (typeof value === 'string' && zones.has(value as ApplicationLayoutWidget['zone'])) {
        return value as ApplicationLayoutWidget['zone']
    }
    throw new Error(`[SchemaSync] Invalid ${templateKey} layout widget zone`)
}

const resolveSnapshotEntityCodenameText = (value: unknown): string | null => {
    if (!isRecord(value)) return null
    const codename = getCodenamePrimary(value.codename as VersionedLocalizedContent<string> | string | undefined).trim()
    return codename.length > 0 ? codename : null
}

const resolveEntityDefinitionCodenameText = (entity: EntityDefinition): string | null => {
    const codename = getCodenamePrimary(entity.codename as VersionedLocalizedContent<string> | string | undefined).trim()
    return codename.length > 0 ? codename : null
}

export const remapSnapshotLayoutScopeEntityIds = (
    snapshot: PublishedApplicationSnapshot,
    entities: EntityDefinition[]
): PublishedApplicationSnapshot => {
    const snapshotEntities = isRecord(snapshot.entities) ? snapshot.entities : {}
    const snapshotCodenameById = new Map<string, string>()

    for (const [entityId, entity] of Object.entries(snapshotEntities)) {
        const codename = resolveSnapshotEntityCodenameText(entity)
        if (codename) {
            snapshotCodenameById.set(entityId, codename)
        }
    }

    if (snapshotCodenameById.size === 0) {
        return snapshot
    }

    const targetIdByCodename = new Map<string, string>()
    for (const entity of entities) {
        const codename = resolveEntityDefinitionCodenameText(entity)
        if (codename && typeof entity.id === 'string' && entity.id.length > 0) {
            targetIdByCodename.set(codename, entity.id)
        }
    }

    if (targetIdByCodename.size === 0) {
        return snapshot
    }

    const remapScopeEntityId = (scopeEntityId: unknown): unknown => {
        if (typeof scopeEntityId !== 'string' || scopeEntityId.length === 0) {
            return scopeEntityId
        }

        const codename = snapshotCodenameById.get(scopeEntityId)
        if (!codename) {
            return scopeEntityId
        }

        return targetIdByCodename.get(codename) ?? scopeEntityId
    }

    const remapLayoutRows = (rows: unknown): unknown => {
        if (!Array.isArray(rows)) return rows
        let changed = false
        const nextRows = rows.map((row) => {
            if (!isRecord(row)) return row
            const nextScopeEntityId = remapScopeEntityId(row.scopeEntityId)
            if (nextScopeEntityId === row.scopeEntityId) return row
            changed = true
            return { ...row, scopeEntityId: nextScopeEntityId }
        })
        return changed ? nextRows : rows
    }

    const nextLayouts = remapLayoutRows(snapshot.layouts)
    const nextScopedLayouts = remapLayoutRows(snapshot.scopedLayouts)

    if (nextLayouts === snapshot.layouts && nextScopedLayouts === snapshot.scopedLayouts) {
        return snapshot
    }

    return {
        ...snapshot,
        layouts: nextLayouts as PublishedApplicationSnapshot['layouts'],
        scopedLayouts: nextScopedLayouts as PublishedApplicationSnapshot['scopedLayouts']
    }
}

// --- Snapshot normalizers ---

type MaterializedSnapshotWidget = PersistedAppLayoutZoneWidget & {
    isActive: boolean
}

type NormalizedScopedLayout = PersistedAppLayout & {
    baseLayoutId: string | null
    compositionMode: 'overlay' | 'independent'
    neutral: PersistedLayoutNeutralMetadata
}

const encodeMaterializedLayoutConfig = (
    config: Record<string, unknown>,
    templateKey: ApplicationTemplateKey,
    neutral: PersistedLayoutNeutralMetadata = {}
): Record<string, unknown> => encodeLayoutConfigEnvelope({ rendererConfig: config, neutral }, { templateKey, omitSourceZoneSettings: true })

const readSnapshotComposition = (layout: SnapshotLayoutRow, layoutId: string, scope: 'global' | 'scoped'): LayoutNeutralComposition => {
    const rawCompositionMode = layout.compositionMode
    const baseLayoutId = readOptionalSnapshotString(layout.baseLayoutId, 'baseLayoutId', `${scope} layout ${layoutId}`, {
        nullable: true,
        defaultValue: null
    }) as string | null

    if (rawCompositionMode === undefined || rawCompositionMode === null) {
        throw new Error(`[SchemaSync] ${scope} layout ${layoutId} is missing an explicit composition mode`)
    }
    if (rawCompositionMode !== 'overlay' && rawCompositionMode !== 'independent') {
        throw new Error(`[SchemaSync] ${scope} layout ${layoutId} has an invalid composition mode`)
    }
    if (rawCompositionMode === 'overlay' && baseLayoutId === null) {
        throw new Error(`[SchemaSync] Overlay layout ${layoutId} must reference a base layout`)
    }
    if (rawCompositionMode === 'independent' && baseLayoutId !== null) {
        throw new Error(`[SchemaSync] Independent layout ${layoutId} cannot reference a base layout`)
    }
    if (scope === 'global' && rawCompositionMode === 'overlay') {
        throw new Error(`[SchemaSync] Global layout ${layoutId} cannot use overlay composition`)
    }
    if (rawCompositionMode === 'overlay') {
        return { mode: 'overlay', baseLayoutId: baseLayoutId as string }
    }
    return { mode: 'independent', baseLayoutId: null }
}

const normalizeSnapshotLayoutConfig = (
    templateKey: ApplicationTemplateKey,
    rawConfig: Record<string, unknown>,
    context: string,
    composition: { mode: 'overlay' | 'independent'; baseLayoutId: string | null }
): { rendererConfig: Record<string, unknown>; neutral: PersistedLayoutNeutralMetadata; encoded: Record<string, unknown> } => {
    try {
        const decoded = decodeLayoutConfigEnvelope(rawConfig, { templateKey })
        const rendererConfig = parseApplicationLayoutConfig(templateKey, decoded.rendererConfig)
        const neutral: PersistedLayoutNeutralMetadata = { ...decoded.neutral }
        if (neutral.composition) {
            const decodedComposition = neutral.composition
            if (
                decodedComposition.mode !== composition.mode ||
                (composition.mode === 'overlay' && decodedComposition.baseLayoutId !== composition.baseLayoutId) ||
                (composition.mode === 'independent' && decodedComposition.baseLayoutId !== null)
            ) {
                throw new Error('Snapshot config composition does not match its top-level composition')
            }
        }
        delete neutral.composition
        return {
            rendererConfig,
            neutral,
            encoded: encodeMaterializedLayoutConfig(rendererConfig, templateKey, neutral)
        }
    } catch {
        throw new Error(`${context} contains invalid ${templateKey} configuration`)
    }
}

const normalizeSnapshotWidgetConfig = (
    templateKey: ApplicationTemplateKey,
    widgetKey: string,
    zone: string,
    rawConfig: Record<string, unknown>,
    context: string,
    options: { instanceKey: string; requireBindings?: boolean; rejectBindings?: boolean }
): Record<string, unknown> => {
    const bindingValidation = resolvePlacementBindingValidation(widgetKey, rawConfig, false)
    const requireBindings = options.requireBindings ?? bindingValidation.requireBindings
    const rejectBindings = options.rejectBindings ?? bindingValidation.rejectBindings
    try {
        const decoded = decodePlacementWidgetConfigEnvelope(rawConfig, {
            templateKey,
            widgetKey,
            zone,
            instanceKey: options.instanceKey,
            requireBindings
        })
        if (rejectBindings && decoded.neutral.bindings !== undefined) {
            throw new Error('This widget source mode does not accept Entity bindings')
        }
        const config = parsePlacementRendererConfig(widgetKey, decoded.rendererConfig)
        return encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: config, neutral: decoded.neutral },
            { templateKey, widgetKey, zone, requireBindings }
        )
    } catch {
        throw new Error(`${context} contains invalid ${templateKey} widget configuration`)
    }
}

const normalizeOverlayWidgetConfig = (
    templateKey: ApplicationTemplateKey,
    baseWidget: { widgetKey: string; zone: string; config: Record<string, unknown>; instanceKey: string },
    zone: string,
    rawConfig: Record<string, unknown> | null | undefined,
    context: string
): Record<string, unknown> => {
    const configInput = rawConfig === null || rawConfig === undefined ? baseWidget.config : rawConfig
    const bindingsInheritedFromBase = rawConfig !== null && rawConfig !== undefined
    const bindingValidation = resolvePlacementBindingValidation(baseWidget.widgetKey, configInput, false, bindingsInheritedFromBase)
    const normalizedConfig = normalizeSnapshotWidgetConfig(templateKey, baseWidget.widgetKey, zone, configInput, context, {
        instanceKey: baseWidget.instanceKey,
        requireBindings: bindingValidation.requireBindings,
        rejectBindings: bindingsInheritedFromBase || bindingValidation.rejectBindings
    })
    const decoded = decodePlacementWidgetConfigEnvelope(normalizedConfig, {
        templateKey,
        widgetKey: baseWidget.widgetKey,
        zone,
        instanceKey: baseWidget.instanceKey,
        requireBindings: false
    })
    const neutral = { ...decoded.neutral }
    delete neutral.bindings
    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig: decoded.rendererConfig, neutral },
        { templateKey, widgetKey: baseWidget.widgetKey, zone, requireBindings: false }
    )
}

type NormalizedLayoutWidgetOverride = {
    layoutId: string
    baseWidgetId: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    zone: string | null
    sortOrder: number | null
    config: Record<string, unknown> | null
    isActive: boolean | null
    isDeletedOverride: boolean
}

const isWidgetAllowedForTemplate = (templateKey: ApplicationTemplateKey, widgetKey: string, zone: string): boolean => {
    return Boolean(getLayoutWidgetAllowedZones(widgetKey, templateKey)?.includes(zone as never))
}

const readSnapshotRows = (value: unknown, field: string): unknown[] => {
    if (value === undefined) return []
    if (!Array.isArray(value)) {
        throw new Error(`[SchemaSync] Snapshot ${field} must be an array`)
    }
    return value
}

const readSnapshotRecord = (value: unknown, field: string, context: string): Record<string, unknown> => {
    if (!isRecord(value) || Array.isArray(value)) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be an object`)
    }
    return value
}

const readOptionalSnapshotRecord = (
    value: unknown,
    field: string,
    context: string,
    options: { nullable?: boolean } = {}
): Record<string, unknown> | null | undefined => {
    if (value === undefined) return undefined
    if (options.nullable && value === null) return null
    return readSnapshotRecord(value, field, context)
}

const readOptionalSnapshotBoolean = (value: unknown, field: string, context: string, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue
    if (typeof value !== 'boolean') {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be a boolean`)
    }
    return value
}

const readOptionalSnapshotInteger = (value: unknown, field: string, context: string, defaultValue: number): number => {
    if (value === undefined) return defaultValue
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be an integer`)
    }
    return value
}

const readOptionalSnapshotString = (
    value: unknown,
    field: string,
    context: string,
    options: { nullable?: boolean; defaultValue?: string | null } = {}
): string | null | undefined => {
    if (value === undefined) return options.defaultValue
    if (options.nullable && value === null) return null
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`[SchemaSync] Snapshot ${context} ${field} must be a non-empty string`)
    }
    return value
}

const materializedWidgetInstanceKey = (widget: Pick<PersistedAppLayoutZoneWidget, 'instanceKey'>): string =>
    layoutInstanceKeySchema.parse(widget.instanceKey)

const getSnapshotTemplateByLayoutId = (snapshot: PublishedApplicationSnapshot): Map<string, ApplicationTemplateKey> => {
    const templateByLayoutId = new Map<string, ApplicationTemplateKey>()
    for (const rawLayout of readSnapshotRows(snapshot.layouts, 'layouts')) {
        const layout = (rawLayout ?? {}) as SnapshotLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'layout', { defaultValue: '' })
        if (!id) continue
        templateByLayoutId.set(id, parseApplicationTemplateKey(layout.templateKey, `layout ${id}`))
    }
    for (const rawLayout of readSnapshotRows(snapshot.scopedLayouts, 'scoped layouts')) {
        const layout = (rawLayout ?? {}) as SnapshotScopedLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'scoped layout', { defaultValue: '' })
        if (!id) continue
        templateByLayoutId.set(id, parseApplicationTemplateKey(layout.templateKey, `scoped layout ${id}`))
    }
    return templateByLayoutId
}

const normalizeSnapshotLayoutEntries = (snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] => {
    const rows = readSnapshotRows(snapshot.layouts, 'layouts').map((layout) => {
        const normalizedLayout = (layout ?? {}) as SnapshotLayoutRow
        const layoutId = readOptionalSnapshotString(normalizedLayout.id, 'id', 'layout', { defaultValue: '' })
        if (!layoutId) {
            throw new Error('[SchemaSync] Snapshot global layout must have an id')
        }
        if (normalizedLayout.scopeEntityId !== undefined && normalizedLayout.scopeEntityId !== null) {
            throw new Error(`[SchemaSync] Global layout ${layoutId} cannot contain a scope entity`)
        }

        const templateKey = parseApplicationTemplateKey(normalizedLayout.templateKey, `layout ${layoutId}`)
        const composition = readSnapshotComposition(normalizedLayout, layoutId, 'global')
        const rawConfig = (readOptionalSnapshotRecord(normalizedLayout.config, 'config', `layout ${layoutId}`) ?? {}) as Record<
            string,
            unknown
        >
        const config = normalizeSnapshotLayoutConfig(templateKey, rawConfig, `Layout ${layoutId}`, composition).encoded

        return {
            id: layoutId,
            scopeEntityId: null,
            templateKey,
            name: (readOptionalSnapshotRecord(normalizedLayout.name, 'name', `layout ${layoutId}`) ?? {}) as Record<string, unknown>,
            description: (readOptionalSnapshotRecord(normalizedLayout.description, 'description', `layout ${layoutId}`, {
                nullable: true
            }) ?? null) as Record<string, unknown> | null,
            config,
            sourceComposition: composition,
            isActive: readOptionalSnapshotBoolean(normalizedLayout.isActive, 'isActive', `layout ${layoutId}`, false),
            isDefault: readOptionalSnapshotBoolean(normalizedLayout.isDefault, 'isDefault', `layout ${layoutId}`, false),
            sortOrder: readOptionalSnapshotInteger(normalizedLayout.sortOrder, 'sortOrder', `layout ${layoutId}`, 0)
        }
    })

    const desiredDefaultLayoutId = readOptionalSnapshotString(snapshot.defaultLayoutId, 'defaultLayoutId', 'snapshot', {
        nullable: true,
        defaultValue: null
    }) as string | null
    if (desiredDefaultLayoutId) {
        if (!rows.some((row) => row.id === desiredDefaultLayoutId)) {
            throw new Error(`[SchemaSync] Snapshot default layout ${desiredDefaultLayoutId} does not exist`)
        }
        for (const row of rows) {
            if (row.scopeEntityId === null) {
                row.isDefault = row.id === desiredDefaultLayoutId
            }
        }
    }

    return rows
}

const ensureScopedDefaultLayouts = (rows: PersistedAppLayout[]): PersistedAppLayout[] => {
    const rowsByScope = new Map<string, PersistedAppLayout[]>()

    for (const row of rows) {
        const scopeKey = row.scopeEntityId ?? '__global__'
        const bucket = rowsByScope.get(scopeKey) ?? []
        bucket.push(row)
        rowsByScope.set(scopeKey, bucket)
    }

    for (const bucket of rowsByScope.values()) {
        if (bucket.length === 0) continue
        const scopeEntityId = bucket[0]?.scopeEntityId ?? null
        const activeDefaults = bucket.filter((row) => row.isActive && row.isDefault)
        const hasInactiveDefault = bucket.some((row) => row.isDefault && !row.isActive)
        const hasInvalidGlobalDefault = scopeEntityId === null && activeDefaults.length !== 1
        if (activeDefaults.length > 1 || hasInactiveDefault || hasInvalidGlobalDefault) {
            throw new EffectiveLayoutError('LAYOUT_DEFAULT_INVALID')
        }
    }

    return rows.sort((a, b) => {
        if ((a.scopeEntityId ?? '') !== (b.scopeEntityId ?? '')) {
            return (a.scopeEntityId ?? '').localeCompare(b.scopeEntityId ?? '')
        }
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.id.localeCompare(b.id)
    })
}

const normalizeSnapshotWidgetEntries = (
    snapshot: PublishedApplicationSnapshot,
    templateByLayoutId = getSnapshotTemplateByLayoutId(snapshot)
): MaterializedSnapshotWidget[] => {
    return readSnapshotRows(snapshot.layoutZoneWidgets, 'layout widgets').map((item) => {
        const normalizedItem = (item ?? {}) as SnapshotWidgetRow
        const id = readOptionalSnapshotString(normalizedItem.id, 'id', 'layout widget', { defaultValue: '' })
        const layoutId = readOptionalSnapshotString(normalizedItem.layoutId, 'layoutId', `layout widget ${id}`, { defaultValue: '' })
        const widgetKey = readOptionalSnapshotString(normalizedItem.widgetKey, 'widgetKey', `layout widget ${id}`, { defaultValue: '' })
        if (!id || !layoutId || !widgetKey) {
            throw new Error('[SchemaSync] Snapshot layout widget has an invalid identity')
        }
        const templateKey = templateByLayoutId.get(layoutId)
        if (!templateKey) {
            throw new Error('[SchemaSync] Snapshot layout widget references an unknown layout')
        }
        const zone = normalizeLayoutZone(normalizedItem.zone, templateKey)
        if (!isWidgetAllowedForTemplate(templateKey, widgetKey, zone)) {
            throw new Error(`[SchemaSync] Widget ${widgetKey} is not allowed in ${templateKey} zone ${zone}`)
        }
        const rawConfig = (readOptionalSnapshotRecord(normalizedItem.config, 'config', `layout widget ${id}`) ?? {}) as Record<
            string,
            unknown
        >
        const placement = applicationLayoutWidgetPlacementSchema.parse({
            instanceKey: readOptionalSnapshotString(normalizedItem.instanceKey, 'instanceKey', `layout widget ${id}`),
            parentWidgetId: readOptionalSnapshotString(normalizedItem.parentWidgetId, 'parentWidgetId', `layout widget ${id}`, {
                nullable: true
            }),
            slotKey: readOptionalSnapshotString(normalizedItem.slotKey, 'slotKey', `layout widget ${id}`, { nullable: true })
        })
        const config = normalizeSnapshotWidgetConfig(templateKey, widgetKey, zone, rawConfig, `[SchemaSync] Layout widget ${id}`, {
            instanceKey: placement.instanceKey
        })
        return {
            id,
            layoutId,
            instanceKey: placement.instanceKey,
            parentWidgetId: placement.parentWidgetId,
            slotKey: placement.slotKey,
            sourceWidgetId: readOptionalSnapshotString(normalizedItem.sourceWidgetId, 'sourceWidgetId', `layout widget ${id}`, {
                nullable: true,
                defaultValue: null
            }) as string | null,
            sourceBaseWidgetId: readOptionalSnapshotString(normalizedItem.sourceBaseWidgetId, 'sourceBaseWidgetId', `layout widget ${id}`, {
                nullable: true,
                defaultValue: null
            }) as string | null,
            ...(normalizedItem.sourceLineageKey === undefined
                ? {}
                : {
                      sourceLineageKey: readOptionalSnapshotString(
                          normalizedItem.sourceLineageKey,
                          'sourceLineageKey',
                          `layout widget ${id}`
                      ) as string
                  }),
            zone,
            widgetKey,
            sortOrder: readOptionalSnapshotInteger(normalizedItem.sortOrder, 'sortOrder', `layout widget ${id}`, 0),
            config,
            isActive: readOptionalSnapshotBoolean(normalizedItem.isActive, 'isActive', `layout widget ${id}`, true)
        }
    })
}

const normalizeSnapshotScopedLayouts = (snapshot: PublishedApplicationSnapshot): NormalizedScopedLayout[] => {
    const rows = readSnapshotRows(snapshot.scopedLayouts, 'scoped layouts').map((rawLayout) => {
        const layout = (rawLayout ?? {}) as SnapshotScopedLayoutRow
        const id = readOptionalSnapshotString(layout.id, 'id', 'scoped layout', { defaultValue: '' })
        const scopeEntityId = readOptionalSnapshotString(layout.scopeEntityId, 'scopeEntityId', `scoped layout ${id}`, {
            defaultValue: ''
        })
        if (!id || !scopeEntityId) {
            throw new Error('[SchemaSync] Scoped layout must have both id and scope entity id')
        }
        const baseLayoutId = readOptionalSnapshotString(layout.baseLayoutId, 'baseLayoutId', `scoped layout ${id}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const compositionMode = layout.compositionMode
        if (compositionMode !== 'overlay' && compositionMode !== 'independent') {
            throw new Error(`[SchemaSync] Scoped layout ${id} has an invalid composition mode`)
        }
        if (compositionMode === 'overlay' && !baseLayoutId) {
            throw new Error(`[SchemaSync] Overlay layout ${id} must reference a base layout`)
        }
        if (compositionMode === 'independent' && baseLayoutId) {
            throw new Error(`[SchemaSync] Independent layout ${id} cannot reference a base layout`)
        }
        const templateKey = parseApplicationTemplateKey(layout.templateKey, `scoped layout ${id}`)
        const rawConfig = (readOptionalSnapshotRecord(layout.config, 'config', `scoped layout ${id}`) ?? {}) as Record<string, unknown>
        const normalized = normalizeSnapshotLayoutConfig(templateKey, rawConfig, `Scoped layout ${id}`, {
            mode: compositionMode,
            baseLayoutId
        })
        return {
            id,
            scopeEntityId,
            baseLayoutId,
            compositionMode,
            templateKey,
            name: (readOptionalSnapshotRecord(layout.name, 'name', `scoped layout ${id}`) ?? {}) as Record<string, unknown>,
            description: (readOptionalSnapshotRecord(layout.description, 'description', `scoped layout ${id}`, {
                nullable: true
            }) ?? null) as Record<string, unknown> | null,
            config: normalized.rendererConfig,
            sourceComposition: normalized.neutral.composition ?? {
                mode: compositionMode,
                baseLayoutId
            },
            neutral: normalized.neutral,
            isActive: readOptionalSnapshotBoolean(layout.isActive, 'isActive', `scoped layout ${id}`, true),
            isDefault: readOptionalSnapshotBoolean(layout.isDefault, 'isDefault', `scoped layout ${id}`, false),
            sortOrder: readOptionalSnapshotInteger(layout.sortOrder, 'sortOrder', `scoped layout ${id}`, 0)
        }
    })
    return rows as NormalizedScopedLayout[]
}

const normalizeSnapshotLayoutWidgetOverrides = (snapshot: PublishedApplicationSnapshot): NormalizedLayoutWidgetOverride[] => {
    return readSnapshotRows(snapshot.layoutWidgetOverrides, 'widget overrides').map((rawRow) => {
        const row = (rawRow ?? {}) as SnapshotLayoutWidgetOverrideRow
        const layoutId = readOptionalSnapshotString(row.layoutId, 'layoutId', 'widget override', { defaultValue: '' })
        const baseWidgetId = readOptionalSnapshotString(row.baseWidgetId, 'baseWidgetId', `widget override ${layoutId}`, {
            defaultValue: ''
        })
        if (!layoutId || !baseWidgetId) {
            throw new Error('[SchemaSync] Snapshot widget override has an invalid identity')
        }
        const placement = applicationLayoutWidgetPlacementSchema.parse({
            instanceKey: readOptionalSnapshotString(row.instanceKey, 'instanceKey', `widget override ${layoutId}`),
            parentWidgetId: readOptionalSnapshotString(row.parentWidgetId, 'parentWidgetId', `widget override ${layoutId}`, {
                nullable: true
            }),
            slotKey: readOptionalSnapshotString(row.slotKey, 'slotKey', `widget override ${layoutId}`, { nullable: true })
        })
        const zone = readOptionalSnapshotString(row.zone, 'zone', `widget override ${layoutId}`, {
            nullable: true,
            defaultValue: null
        }) as string | null
        const config = readOptionalSnapshotRecord(row.config, 'config', `widget override ${layoutId}`, { nullable: true })
        const isActive =
            row.isActive === undefined || row.isActive === null
                ? null
                : readOptionalSnapshotBoolean(row.isActive, 'isActive', `widget override ${layoutId}`, false)
        const isDeletedOverride =
            row.isDeletedOverride === undefined
                ? false
                : readOptionalSnapshotBoolean(row.isDeletedOverride, 'isDeletedOverride', `widget override ${layoutId}`, false)
        return {
            layoutId,
            baseWidgetId,
            instanceKey: placement.instanceKey,
            parentWidgetId: placement.parentWidgetId,
            slotKey: placement.slotKey,
            zone,
            sortOrder:
                row.sortOrder === undefined || row.sortOrder === null
                    ? null
                    : readOptionalSnapshotInteger(row.sortOrder, 'sortOrder', `widget override ${layoutId}`, 0),
            config: config === undefined ? null : config,
            isActive,
            isDeletedOverride
        }
    })
}

export function buildMergedDashboardLayoutConfig(snapshot: PublishedApplicationSnapshot): Record<string, unknown> {
    if (snapshot.layoutConfig !== undefined && !isRecord(snapshot.layoutConfig)) {
        throw new Error('[SchemaSync] Snapshot layoutConfig must be an object')
    }
    const decoded = decodeLayoutConfigEnvelope(snapshot.layoutConfig ?? {}, { templateKey: 'dashboard' })
    const parsed = parseApplicationLayoutConfig('dashboard', decoded.rendererConfig)
    return normalizeDashboardLayoutConfig(parsed) as unknown as Record<string, unknown>
}
export {
    encodeMaterializedLayoutConfig,
    ensureScopedDefaultLayouts,
    getSnapshotTemplateByLayoutId,
    isWidgetAllowedForTemplate,
    materializedWidgetInstanceKey,
    normalizeLayoutZone,
    normalizeOverlayWidgetConfig,
    normalizeSnapshotLayoutEntries,
    normalizeSnapshotLayoutWidgetOverrides,
    normalizeSnapshotScopedLayouts,
    normalizeSnapshotWidgetEntries,
    readOptionalSnapshotString,
    readSnapshotRows
}
export type { MaterializedSnapshotWidget, NormalizedLayoutWidgetOverride, NormalizedScopedLayout }
