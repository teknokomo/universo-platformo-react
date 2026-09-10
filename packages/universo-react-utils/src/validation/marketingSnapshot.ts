import {
    MARKETING_PAGE_TEMPLATE_KEY,
    MARKETING_WIDGET_REGISTRY,
    applicationTemplateKeySchema,
    marketingPageConfigSchema,
    marketingWidgetKeySchema,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    type MarketingWidgetKey
} from '@universo-react/types'

import { getCodenamePrimary } from '../vlc'
import { isUuidV7 } from '../uuid'

export type MarketingSnapshotEntityLike = {
    kind?: unknown
    codename?: unknown
}

export type MarketingSnapshotLayoutLike = {
    id: string
    templateKey: string
    name: Record<string, unknown>
    description?: Record<string, unknown> | null
    config: Record<string, unknown>
    isDefault: boolean
    isActive: boolean
    sortOrder: number
    scopeEntityId?: string | null
    scopeEntityKind?: string | null
    baseLayoutId?: string | null
    compositionMode?: 'overlay' | 'independent'
}

export type MarketingSnapshotWidgetLike = {
    id: string
    layoutId: string
    zone: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    sourceBaseWidgetId?: string | null
}

export type MarketingSnapshotOverrideLike = {
    id: string
    layoutId: string
    baseWidgetId: string
    zone?: string | null
    sortOrder?: number | null
    config?: Record<string, unknown> | null
    isActive?: boolean | null
    isDeletedOverride?: boolean
}

export type MarketingSnapshotLike = {
    entities?: Record<string, MarketingSnapshotEntityLike>
    layouts?: MarketingSnapshotLayoutLike[]
    scopedLayouts?: MarketingSnapshotLayoutLike[]
    layoutZoneWidgets?: MarketingSnapshotWidgetLike[]
    layoutWidgetOverrides?: MarketingSnapshotOverrideLike[]
    defaultLayoutId?: unknown
    layoutConfig?: unknown
}

export class SnapshotLayoutValidationError extends Error {
    public readonly details: Record<string, unknown>

    constructor(message: string, details: Record<string, unknown> = {}) {
        super(message)
        this.name = 'SnapshotLayoutValidationError'
        this.details = details
    }
}

export class MarketingSnapshotValidationError extends SnapshotLayoutValidationError {
    constructor(message: string, details: Record<string, unknown> = {}) {
        super(message, details)
        this.name = 'MarketingSnapshotValidationError'
    }
}

type ParsedMarketingWidget = {
    widgetKey: MarketingWidgetKey
    instanceKey: string
    source: Record<string, unknown>
    copySource?: Record<string, unknown>
    variant?: string
    showBenefits?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const getSnapshotEntityCodename = (entity: MarketingSnapshotEntityLike): string | undefined => {
    if (typeof entity.codename === 'string') return entity.codename
    return getCodenamePrimary(entity.codename) ?? undefined
}

const fail = (message: string, details: Record<string, unknown>): never => {
    throw new MarketingSnapshotValidationError(message, details)
}

const failSnapshotLayout = (message: string, details: Record<string, unknown>): never => {
    throw new SnapshotLayoutValidationError(message, details)
}

const assertUuidV7 = (value: unknown, kind: string, scope: string): string => {
    return isUuidV7(value) ? value : fail(`Marketing snapshot ${kind} must be a UUID v7`, { kind, scope })
}

const assertSnapshotUuidV7 = (value: unknown, kind: string, scope: string): string => {
    return isUuidV7(value) ? value : failSnapshotLayout(`Snapshot ${kind} must be a UUID v7`, { kind, scope })
}

const readSnapshotArray = (value: unknown, field: string): unknown[] => {
    if (value === undefined) return []
    if (!Array.isArray(value)) failSnapshotLayout(`Snapshot ${field} must be an array`, {})
    return value
}

const assertOptionalSnapshotRecord = (value: unknown, field: string, scope: string, nullable = false): void => {
    if (value === undefined || (nullable && value === null)) return
    if (!isRecord(value) || Array.isArray(value)) {
        failSnapshotLayout(`Snapshot ${scope} ${field} must be an object`, { field, scope })
    }
}

const assertOptionalSnapshotBoolean = (value: unknown, field: string, scope: string, nullable = false): void => {
    if (value === undefined || (nullable && value === null)) return
    if (typeof value !== 'boolean') {
        failSnapshotLayout(`Snapshot ${scope} ${field} must be a boolean`, { field, scope })
    }
}

const assertOptionalSnapshotInteger = (value: unknown, field: string, scope: string, nullable = false): void => {
    if (value === undefined || (nullable && value === null)) return
    if (!Number.isInteger(value)) {
        failSnapshotLayout(`Snapshot ${scope} ${field} must be an integer`, { field, scope })
    }
}

const assertOptionalSnapshotString = (value: unknown, field: string, scope: string, nullable = false): void => {
    if (value === undefined || (nullable && value === null)) return
    if (typeof value !== 'string' || value.length === 0) {
        failSnapshotLayout(`Snapshot ${scope} ${field} must be a non-empty string`, { field, scope })
    }
}

const assertOptionalSnapshotTemplateKey = (value: unknown, scope: string): void => {
    if (value === undefined) return
    if (!applicationTemplateKeySchema.safeParse(value).success) {
        failSnapshotLayout(`Snapshot ${scope} template key is invalid`, { scope })
    }
}

/**
 * Validate the identity/reference envelope shared by dashboard and marketing
 * snapshot flows. It intentionally does not parse template-specific config;
 * adapters do that after this destructive-operation preflight succeeds.
 */
export const validateSnapshotLayoutIdentities = (snapshot: unknown): void => {
    if (!isRecord(snapshot)) failSnapshotLayout('Snapshot must be an object', {})

    const layouts = readSnapshotArray(snapshot.layouts, 'layouts').map((entry, index) => {
        if (!isRecord(entry)) failSnapshotLayout('Snapshot layout entry is invalid', { index })
        return entry
    })
    const scopedLayouts = readSnapshotArray(snapshot.scopedLayouts, 'scoped layouts').map((entry, index) => {
        if (!isRecord(entry)) failSnapshotLayout('Snapshot scoped layout entry is invalid', { index })
        return entry
    })
    const widgets = readSnapshotArray(snapshot.layoutZoneWidgets, 'layout widgets').map((entry, index) => {
        if (!isRecord(entry)) failSnapshotLayout('Snapshot layout widget entry is invalid', { index })
        return entry
    })
    const overrides = readSnapshotArray(snapshot.layoutWidgetOverrides, 'widget overrides').map((entry, index) => {
        if (!isRecord(entry)) failSnapshotLayout('Snapshot widget override entry is invalid', { index })
        return entry
    })

    if (snapshot.entities !== undefined && !isRecord(snapshot.entities)) {
        failSnapshotLayout('Snapshot entities must be an object', {})
    }
    for (const [entityId, entity] of Object.entries(snapshot.entities ?? {})) {
        if (!isRecord(entity)) failSnapshotLayout('Snapshot entity entry is invalid', { entityId })
    }

    const layoutEntries = [
        ...layouts.map((layout) => ({ layout, isScoped: false })),
        ...scopedLayouts.map((layout) => ({ layout, isScoped: true }))
    ]
    const layoutIds = new Set<string>()
    const layoutIdentityById = new Map<
        string,
        {
            isScoped: boolean
            baseLayoutId: string | null
            compositionMode: 'overlay' | 'independent' | null
        }
    >()
    for (const { layout } of layoutEntries) {
        const layoutScope = `layout:${String(layout.id)}`
        assertOptionalSnapshotTemplateKey(layout.templateKey, layoutScope)
        assertOptionalSnapshotRecord(layout.name, 'name', layoutScope)
        assertOptionalSnapshotRecord(layout.description, 'description', layoutScope, true)
        assertOptionalSnapshotRecord(layout.config, 'config', layoutScope)
        assertOptionalSnapshotBoolean(layout.isActive, 'isActive', layoutScope)
        assertOptionalSnapshotBoolean(layout.isDefault, 'isDefault', layoutScope)
        assertOptionalSnapshotInteger(layout.sortOrder, 'sortOrder', layoutScope)

        const id = assertSnapshotUuidV7(layout.id, 'layout id', 'layout')
        if (layoutIds.has(id)) failSnapshotLayout('Snapshot contains duplicate layout ids', { layoutId: id })
        layoutIds.add(id)
        layoutIdentityById.set(id, {
            isScoped: false,
            baseLayoutId: null,
            compositionMode: null
        })
    }
    for (const { layout, isScoped } of layoutEntries) {
        const id = layout.id
        const layoutIdentity = layoutIdentityById.get(id as string)
        if (!layoutIdentity) {
            failSnapshotLayout('Snapshot layout identity is invalid', { layoutId: id })
        }
        layoutIdentity.isScoped = isScoped
        if (isScoped) {
            assertSnapshotUuidV7(layout.scopeEntityId, 'layout scope entity id', `layout:${id}`)
            if (
                snapshot.entities !== undefined &&
                !Object.prototype.hasOwnProperty.call(snapshot.entities, layout.scopeEntityId as string)
            ) {
                failSnapshotLayout('Snapshot scoped layout references a missing entity', {
                    layoutId: id,
                    scopeEntityId: layout.scopeEntityId
                })
            }
            if (layout.compositionMode === 'overlay') {
                const baseLayoutId = assertSnapshotUuidV7(layout.baseLayoutId, 'base layout id', `layout:${id}`)
                layoutIdentity.baseLayoutId = baseLayoutId
                layoutIdentity.compositionMode = 'overlay'
                if (!layoutIds.has(baseLayoutId)) {
                    failSnapshotLayout('Snapshot layout references a missing base layout', {
                        layoutId: id,
                        baseLayoutId
                    })
                }
            } else if (layout.compositionMode === 'independent') {
                if (layout.baseLayoutId !== null) {
                    failSnapshotLayout('Independent layouts must have a null base layout id', { layoutId: id })
                }
                layoutIdentity.compositionMode = 'independent'
            } else {
                failSnapshotLayout('Scoped layouts require an explicit composition mode', { layoutId: id })
            }
        } else {
            if (layout.scopeEntityId !== undefined && layout.scopeEntityId !== null) {
                failSnapshotLayout('Global layouts cannot reference a scope entity', { layoutId: id })
            }
            if (layout.compositionMode !== 'independent' || layout.baseLayoutId !== null) {
                failSnapshotLayout('Global layouts require independent composition with a null base layout id', { layoutId: id })
            }
            layoutIdentity.compositionMode = 'independent'
        }
    }

    const widgetIds = new Set<string>()
    const widgetLayoutIdById = new Map<string, string>()
    for (const widget of widgets) {
        const widgetScope = `widget:${String(widget.id)}`
        assertOptionalSnapshotString(widget.zone, 'zone', widgetScope)
        assertOptionalSnapshotString(widget.widgetKey, 'widgetKey', widgetScope)
        assertOptionalSnapshotRecord(widget.config, 'config', widgetScope)
        assertOptionalSnapshotBoolean(widget.isActive, 'isActive', widgetScope)
        assertOptionalSnapshotInteger(widget.sortOrder, 'sortOrder', widgetScope)
        assertOptionalSnapshotString(widget.sourceLineageKey, 'sourceLineageKey', widgetScope)

        const id = assertSnapshotUuidV7(widget.id, 'widget id', 'widget')
        if (widgetIds.has(id)) failSnapshotLayout('Snapshot contains duplicate widget ids', { widgetId: id })
        widgetIds.add(id)
        const layoutId = assertSnapshotUuidV7(widget.layoutId, 'widget layout id', `widget:${id}`)
        if (!layoutIds.has(layoutId)) {
            failSnapshotLayout('Snapshot widget references a missing layout', { widgetId: id, layoutId })
        }
        widgetLayoutIdById.set(id, layoutId)
        if (widget.sourceBaseWidgetId !== undefined && widget.sourceBaseWidgetId !== null) {
            assertSnapshotUuidV7(widget.sourceBaseWidgetId, 'widget source base id', `widget:${id}`)
        }
    }

    // A source-base reference is a derived overlay lineage, not an arbitrary
    // client-provided relation. Accept it only when the target widget belongs
    // to a scoped overlay whose declared base layout owns that widget. This
    // prevents a forged reference from being carried into application sync and
    // later interpreted as inherited runtime content.
    for (const widget of widgets) {
        if (typeof widget.sourceBaseWidgetId !== 'string') continue
        const targetLayoutId = widgetLayoutIdById.get(String(widget.id))
        const baseLayoutId = widgetLayoutIdById.get(widget.sourceBaseWidgetId)
        const targetLayout = targetLayoutId ? layoutIdentityById.get(targetLayoutId) : undefined
        if (
            !targetLayout?.isScoped ||
            targetLayout.compositionMode !== 'overlay' ||
            !baseLayoutId ||
            targetLayout.baseLayoutId !== baseLayoutId
        ) {
            failSnapshotLayout('Snapshot widget source base reference is invalid', {
                widgetId: widget.id,
                sourceBaseWidgetId: widget.sourceBaseWidgetId,
                layoutId: targetLayoutId ?? null,
                baseLayoutId: baseLayoutId ?? null
            })
        }
    }

    const overrideIds = new Set<string>()
    const overrideTargets = new Set<string>()
    for (const override of overrides) {
        const overrideScope = `override:${String(override.id)}`
        assertOptionalSnapshotString(override.zone, 'zone', overrideScope, true)
        assertOptionalSnapshotRecord(override.config, 'config', overrideScope, true)
        assertOptionalSnapshotBoolean(override.isActive, 'isActive', overrideScope, true)
        assertOptionalSnapshotBoolean(override.isDeletedOverride, 'isDeletedOverride', overrideScope)
        assertOptionalSnapshotInteger(override.sortOrder, 'sortOrder', overrideScope, true)

        const id = assertSnapshotUuidV7(override.id, 'widget override id', 'override')
        if (overrideIds.has(id)) failSnapshotLayout('Snapshot contains duplicate widget override ids', { overrideId: id })
        overrideIds.add(id)
        const layoutId = assertSnapshotUuidV7(override.layoutId, 'widget override layout id', `override:${id}`)
        const baseWidgetId = assertSnapshotUuidV7(override.baseWidgetId, 'widget override base widget id', `override:${id}`)
        if (!layoutIds.has(layoutId)) {
            failSnapshotLayout('Snapshot widget override references a missing layout', { overrideId: id, layoutId })
        }
        const targetLayout = layoutIdentityById.get(layoutId)
        if (!targetLayout?.isScoped || targetLayout.compositionMode !== 'overlay') {
            failSnapshotLayout('Snapshot widget override must target a scoped overlay layout', { overrideId: id, layoutId })
        }
        const baseWidgetLayoutId = widgetLayoutIdById.get(baseWidgetId)
        if (!widgetIds.has(baseWidgetId) || !baseWidgetLayoutId) {
            failSnapshotLayout('Snapshot widget override references a missing widget', { overrideId: id, baseWidgetId })
        }
        if (targetLayout.baseLayoutId !== baseWidgetLayoutId) {
            failSnapshotLayout('Snapshot widget override base widget belongs to the wrong layout', {
                overrideId: id,
                baseWidgetId,
                baseLayoutId: targetLayout.baseLayoutId
            })
        }
        const target = `${layoutId}:${baseWidgetId}`
        if (overrideTargets.has(target)) {
            failSnapshotLayout('Snapshot contains duplicate widget override targets', { layoutId, baseWidgetId })
        }
        overrideTargets.add(target)
    }

    if (snapshot.defaultLayoutId !== undefined && snapshot.defaultLayoutId !== null) {
        const defaultLayoutId = assertSnapshotUuidV7(snapshot.defaultLayoutId, 'default layout id', 'snapshot')
        if (!layoutIds.has(defaultLayoutId)) {
            failSnapshotLayout('Snapshot default layout references a missing layout', { defaultLayoutId })
        }
    }
}

const assertObjectEntity = (snapshot: MarketingSnapshotLike, codename: unknown, scope: string): void => {
    if (typeof codename !== 'string') {
        fail('Marketing snapshot source codename is invalid', { scope })
    }

    const entity = Object.values(snapshot.entities ?? {}).find(
        (candidate) =>
            isRecord(candidate) &&
            candidate.kind === 'object' &&
            getSnapshotEntityCodename(candidate as MarketingSnapshotEntityLike) === codename
    )
    if (!entity) {
        fail('Marketing snapshot source entity is missing', { scope, entityCodename: codename })
    }
}

const readParsedSource = (value: unknown, scope: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        return fail('Marketing snapshot widget source is invalid', { scope })
    }
    const source = value
    if (typeof source.entityCodename !== 'string' || source.entityKind !== 'object') {
        fail('Marketing snapshot widget source is invalid', { scope })
    }
    if (source.recordKey !== undefined && typeof source.recordKey !== 'string') {
        fail('Marketing snapshot widget source record key is invalid', { scope })
    }
    return source
}

const parseWidget = (snapshot: MarketingSnapshotLike, widget: MarketingSnapshotWidgetLike): ParsedMarketingWidget => {
    const widgetKeyResult = marketingWidgetKeySchema.safeParse(widget.widgetKey)
    const widgetKey = widgetKeyResult.success
        ? widgetKeyResult.data
        : fail('Marketing snapshot marketing widget key is invalid', { widgetId: widget.id, layoutId: widget.layoutId })

    const config = (() => {
        try {
            return parseApplicationLayoutWidgetConfig(widgetKey, widget.config)
        } catch {
            return fail('Marketing snapshot widget configuration is invalid', {
                widgetId: widget.id,
                layoutId: widget.layoutId,
                widgetKey
            })
        }
    })()

    const instanceKey =
        typeof config.instanceKey === 'string' && config.instanceKey.length > 0
            ? config.instanceKey
            : fail('Marketing snapshot widget instance key is missing', { widgetId: widget.id, layoutId: widget.layoutId })

    const registryEntry = MARKETING_WIDGET_REGISTRY[widgetKey]
    if (!registryEntry.allowedZones.some((allowedZone) => allowedZone === widget.zone)) {
        fail('Marketing snapshot widget placement is invalid', {
            widgetId: widget.id,
            layoutId: widget.layoutId,
            widgetKey,
            zone: widget.zone
        })
    }

    if (!Number.isInteger(widget.sortOrder) || widget.sortOrder < 0 || widget.sortOrder > 100_000) {
        fail('Marketing snapshot widget order is invalid', { widgetId: widget.id, layoutId: widget.layoutId })
    }
    if (typeof widget.isActive !== 'boolean') {
        fail('Marketing snapshot widget active state is invalid', { widgetId: widget.id, layoutId: widget.layoutId })
    }

    const source = readParsedSource(config.source, `widget:${widget.id}:source`)
    assertObjectEntity(snapshot, source.entityCodename, `widget:${widget.id}:source`)

    const copySource = config.copySource === undefined ? undefined : readParsedSource(config.copySource, `widget:${widget.id}:copySource`)
    if (copySource) {
        if (copySource.entityCodename !== 'MarketingPageSection' || typeof copySource.recordKey !== 'string') {
            fail('Marketing snapshot copy source is invalid', { widgetId: widget.id, layoutId: widget.layoutId })
        }
        assertObjectEntity(snapshot, copySource.entityCodename, `widget:${widget.id}:copySource`)
    }

    const variant = typeof config.variant === 'string' ? config.variant : undefined
    if (widgetKeyResult.data === 'marketing.collection' && variant === undefined) {
        fail('Marketing collection snapshot widget variant is missing', { widgetId: widget.id, layoutId: widget.layoutId })
    }

    return {
        widgetKey,
        instanceKey,
        source,
        ...(copySource ? { copySource } : {}),
        ...(variant ? { variant } : {}),
        ...(typeof config.showBenefits === 'boolean' ? { showBenefits: config.showBenefits } : {})
    }
}

const assertMarketingLayoutConfig = (layout: MarketingSnapshotLayoutLike): void => {
    try {
        parseApplicationLayoutConfig(MARKETING_PAGE_TEMPLATE_KEY, layout.config)
    } catch {
        fail('Marketing snapshot layout configuration is invalid', { layoutId: layout.id })
    }
    if (!isRecord(layout.name)) {
        fail('Marketing snapshot layout name is invalid', { layoutId: layout.id })
    }
    if (typeof layout.isActive !== 'boolean' || typeof layout.isDefault !== 'boolean' || !Number.isInteger(layout.sortOrder)) {
        fail('Marketing snapshot layout metadata is invalid', { layoutId: layout.id })
    }
}

const assertMarketingLayoutIdentity = (
    layout: MarketingSnapshotLayoutLike,
    kind: 'global' | 'scoped',
    compositionMode?: 'overlay' | 'independent'
): void => {
    assertUuidV7(layout.id, `${kind} layout id`, `layout:${layout.id}`)
    if (kind === 'global') {
        if (layout.compositionMode !== 'independent' || layout.baseLayoutId !== null) {
            fail('Marketing global layout requires independent composition with a null base layout id', { layoutId: layout.id })
        }
    } else {
        assertUuidV7(layout.scopeEntityId, 'layout scope entity id', `layout:${layout.id}`)
        if (compositionMode === 'overlay') {
            assertUuidV7(layout.baseLayoutId, 'base layout id', `layout:${layout.id}`)
        } else if (compositionMode === 'independent') {
            if (layout.baseLayoutId !== null) {
                fail('Independent marketing scoped layout must have a null base layout id', { layoutId: layout.id })
            }
        } else {
            fail('Marketing scoped layout composition mode is invalid', { layoutId: layout.id })
        }
    }
    assertMarketingLayoutConfig(layout)
}

const assertMarketingWidgetIdentity = (widget: MarketingSnapshotWidgetLike, layoutId: string): void => {
    assertUuidV7(widget.id, 'widget id', `widget:${widget.id}`)
    assertUuidV7(widget.layoutId, 'widget layout id', `widget:${widget.id}`)
    if (widget.layoutId !== layoutId) {
        fail('Marketing snapshot widget layout reference is inconsistent', { widgetId: widget.id, layoutId: widget.layoutId })
    }
}

const assertMarketingOverrideIdentity = (override: MarketingSnapshotOverrideLike): void => {
    assertUuidV7(override.id, 'widget override id', `override:${override.id}`)
    assertUuidV7(override.layoutId, 'widget override layout id', `override:${override.id}`)
    assertUuidV7(override.baseWidgetId, 'widget override base widget id', `override:${override.id}`)
    if (override.zone !== undefined && override.zone !== null && typeof override.zone !== 'string') {
        fail('Marketing snapshot widget override zone is invalid', { overrideId: override.id })
    }
    if (
        override.sortOrder !== undefined &&
        override.sortOrder !== null &&
        (!Number.isInteger(override.sortOrder) || override.sortOrder < 0)
    ) {
        fail('Marketing snapshot widget override order is invalid', { overrideId: override.id })
    }
    if (override.isActive !== undefined && override.isActive !== null && typeof override.isActive !== 'boolean') {
        fail('Marketing snapshot widget override active state is invalid', { overrideId: override.id })
    }
    if (typeof override.isDeletedOverride !== 'boolean') {
        fail('Marketing snapshot widget override deletion state is invalid', { overrideId: override.id })
    }
}

/**
 * Validate the template-owned layout payload before publication, sync, or a
 * restore operation can persist or delete any layout rows. Dashboard payloads
 * intentionally return without applying this marketing-specific contract.
 */
export const validateMarketingSnapshotLayouts = (snapshot: unknown): void => {
    if (!isRecord(snapshot)) {
        fail('Marketing snapshot is invalid', {})
    }

    const snapshotRecord = snapshot as unknown as Record<string, unknown>
    const entities = snapshotRecord.entities === undefined ? {} : snapshotRecord.entities
    if (!isRecord(entities)) {
        fail('Marketing snapshot entities are invalid', {})
    }

    const readArray = (value: unknown, field: string): unknown[] => {
        if (value === undefined) return []
        if (!Array.isArray(value)) fail(`Marketing snapshot ${field} are invalid`, {})
        return value
    }
    const readLayouts = (value: unknown, field: string): MarketingSnapshotLayoutLike[] =>
        readArray(value, field).map((entry, index) => {
            if (!isRecord(entry)) fail(`Marketing snapshot ${field} entry is invalid`, { index })
            return entry as unknown as MarketingSnapshotLayoutLike
        })
    const readWidgets = (value: unknown): MarketingSnapshotWidgetLike[] =>
        readArray(value, 'layout widgets').map((entry, index) => {
            if (!isRecord(entry)) fail('Marketing snapshot layout widget entry is invalid', { index })
            return entry as unknown as MarketingSnapshotWidgetLike
        })
    const readOverrides = (value: unknown): MarketingSnapshotOverrideLike[] =>
        readArray(value, 'widget overrides').map((entry, index) => {
            if (!isRecord(entry)) fail('Marketing snapshot widget override entry is invalid', { index })
            return entry as unknown as MarketingSnapshotOverrideLike
        })

    const layouts = readLayouts(snapshotRecord.layouts, 'layouts')
    const scopedLayouts = readLayouts(snapshotRecord.scopedLayouts, 'scoped layouts')
    const widgets = readWidgets(snapshotRecord.layoutZoneWidgets)
    const overrides = readOverrides(snapshotRecord.layoutWidgetOverrides)
    const normalizedSnapshot = { ...snapshotRecord, entities } as unknown as MarketingSnapshotLike
    const allLayouts = [...layouts, ...scopedLayouts]
    const marketingLayouts = allLayouts.filter((layout) => layout.templateKey === MARKETING_PAGE_TEMPLATE_KEY)
    const marketingGlobalLayouts = layouts.filter((layout) => layout.templateKey === MARKETING_PAGE_TEMPLATE_KEY)
    const marketingWidgets = widgets.filter((widget) => typeof widget.widgetKey === 'string' && widget.widgetKey.startsWith('marketing.'))

    if (marketingLayouts.length === 0 && marketingWidgets.length === 0) return
    if (marketingLayouts.length === 0) {
        fail('Marketing snapshot widget has no marketing layout', { widgetCount: marketingWidgets.length })
    }
    if (snapshotRecord.layoutZoneWidgets === undefined) fail('Marketing snapshot layout widgets are missing', {})

    const hasMixedTemplates = allLayouts.some((layout) => layout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY)
    const globalLayoutIds = new Set<string>()
    const allLayoutIds = new Set<string>()
    for (const layout of layouts) {
        if (layout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY) {
            assertSnapshotUuidV7(layout.id, 'layout id', 'layout')
            if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
            allLayoutIds.add(layout.id)
            continue
        }
        if (layout.scopeEntityId !== undefined && layout.scopeEntityId !== null) {
            fail('Marketing global layout contains scoped layout references', { layoutId: layout.id })
        }
        assertMarketingLayoutIdentity(layout, 'global')
        if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
        globalLayoutIds.add(layout.id)
        allLayoutIds.add(layout.id)
    }

    for (const layout of scopedLayouts) {
        if (layout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY) {
            assertSnapshotUuidV7(layout.id, 'layout id', 'scoped layout')
            if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
            allLayoutIds.add(layout.id)
            continue
        }

        const compositionMode = layout.compositionMode
        assertMarketingLayoutIdentity(layout, 'scoped', compositionMode)
        if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
        if (compositionMode === 'overlay' && !globalLayoutIds.has(layout.baseLayoutId as string)) {
            fail('Marketing scoped layout references a missing global layout', { layoutId: layout.id, baseLayoutId: layout.baseLayoutId })
        }
        const scopeEntity = entities[layout.scopeEntityId as string]
        if (!isRecord(scopeEntity) || (scopeEntity.kind !== 'page' && scopeEntity.kind !== 'object')) {
            fail('Marketing scoped layout references a missing Page or Object entity type', {
                layoutId: layout.id,
                scopeEntityId: layout.scopeEntityId
            })
        }
        allLayoutIds.add(layout.id)
    }

    const explicitDefaultLayoutId =
        normalizedSnapshot.defaultLayoutId === undefined || normalizedSnapshot.defaultLayoutId === null
            ? null
            : assertUuidV7(normalizedSnapshot.defaultLayoutId, 'default layout id', 'snapshot')
    const explicitDefaultLayout = explicitDefaultLayoutId ? layouts.find((layout) => layout.id === explicitDefaultLayoutId) : undefined
    const activeScopedIndependentLayout = scopedLayouts.find(
        (layout) =>
            layout.templateKey === MARKETING_PAGE_TEMPLATE_KEY &&
            layout.isActive &&
            layout.isDefault &&
            layout.compositionMode === 'independent'
    )
    const hasScopedOverlay = scopedLayouts.some(
        (layout) => layout.templateKey === MARKETING_PAGE_TEMPLATE_KEY && layout.isActive && layout.compositionMode === 'overlay'
    )
    const marketingDefaultLayout =
        explicitDefaultLayout?.templateKey === MARKETING_PAGE_TEMPLATE_KEY
            ? explicitDefaultLayout
            : marketingGlobalLayouts.find((layout) => layout.isActive && (layout.isDefault || hasMixedTemplates))

    if (!marketingDefaultLayout && (marketingGlobalLayouts.length > 0 || hasScopedOverlay) && !activeScopedIndependentLayout) {
        fail('Marketing snapshot has no active global marketing layout', {})
    }
    if (explicitDefaultLayoutId && explicitDefaultLayout?.templateKey !== MARKETING_PAGE_TEMPLATE_KEY && !hasMixedTemplates) {
        fail('Marketing snapshot default layout must reference a global layout', { defaultLayoutId: explicitDefaultLayoutId })
    }
    if (
        explicitDefaultLayout?.templateKey === MARKETING_PAGE_TEMPLATE_KEY &&
        (!explicitDefaultLayout.isActive || !explicitDefaultLayout.isDefault)
    ) {
        fail('Marketing snapshot default layout must be active and marked as default', { defaultLayoutId: explicitDefaultLayoutId })
    }
    if (snapshotRecord.layoutConfig !== undefined && explicitDefaultLayout?.templateKey === MARKETING_PAGE_TEMPLATE_KEY) {
        try {
            marketingPageConfigSchema.parse(snapshotRecord.layoutConfig)
        } catch {
            fail('Marketing snapshot default layout configuration is invalid', {})
        }
    }

    const activeMarketingWidgets = widgets.filter(
        (widget) => typeof widget.widgetKey === 'string' && widget.widgetKey.startsWith('marketing.') && widget.isActive === true
    )
    if (activeMarketingWidgets.length === 0) {
        fail('Marketing snapshot must contain at least one active widget', {})
    }

    const allWidgetsById = new Map<string, MarketingSnapshotWidgetLike>()
    for (const widget of widgets) {
        if (typeof widget.id === 'string') {
            allWidgetsById.set(widget.id, widget)
        }
    }

    const widgetsById = new Map<string, { widget: MarketingSnapshotWidgetLike; parsed: ParsedMarketingWidget; layoutId: string }>()
    const instanceKeysByLayout = new Map<string, Set<string>>()
    for (const widget of widgets) {
        const layout = allLayouts.find((candidate) => candidate.id === widget.layoutId)
        const isMarketingWidget = marketingWidgets.includes(widget)
        if (!layout) {
            if (isMarketingWidget) {
                fail('Marketing snapshot widget references a missing layout', { widgetId: widget.id, layoutId: widget.layoutId })
            }
            continue
        }
        const isMarketingLayout = layout.templateKey === MARKETING_PAGE_TEMPLATE_KEY
        if (isMarketingLayout !== isMarketingWidget) {
            fail('Marketing and dashboard widgets cannot share a layout', { widgetId: widget.id, layoutId: widget.layoutId })
        }
        if (!isMarketingLayout) continue

        assertMarketingWidgetIdentity(widget, layout.id)
        const parsed = parseWidget(normalizedSnapshot, widget)
        const instanceKeys = instanceKeysByLayout.get(layout.id) ?? new Set<string>()
        if (instanceKeys.has(parsed.instanceKey)) {
            fail('Marketing snapshot contains duplicate widget instance keys', { layoutId: layout.id, instanceKey: parsed.instanceKey })
        }
        instanceKeys.add(parsed.instanceKey)
        instanceKeysByLayout.set(layout.id, instanceKeys)
        if (widgetsById.has(widget.id)) fail('Marketing snapshot contains duplicate widget ids', { widgetId: widget.id })
        widgetsById.set(widget.id, { widget, parsed, layoutId: layout.id })

        if (parsed.widgetKey === 'marketing.pricing' && parsed.showBenefits !== false) {
            assertObjectEntity(normalizedSnapshot, 'MarketingPagePricingBenefit', `widget:${widget.id}:benefits`)
        }
    }

    const overrideIds = new Set<string>()
    const overridePairs = new Set<string>()
    for (const override of overrides) {
        assertMarketingOverrideIdentity(override)
        if (overrideIds.has(override.id)) {
            fail('Marketing snapshot contains duplicate widget override ids', { overrideId: override.id })
        }
        overrideIds.add(override.id)
        const overridePair = `${override.layoutId}:${override.baseWidgetId}`
        if (overridePairs.has(overridePair)) {
            fail('Marketing snapshot contains duplicate widget override targets', {
                layoutId: override.layoutId,
                baseWidgetId: override.baseWidgetId
            })
        }
        overridePairs.add(overridePair)
        const baseWidget = widgetsById.get(override.baseWidgetId)
        const scopedLayout = scopedLayouts.find((layout) => layout.id === override.layoutId)
        if (scopedLayout && scopedLayout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY) {
            if (scopedLayout.compositionMode !== 'overlay' || !scopedLayout.baseLayoutId) {
                fail('Scoped dashboard widget override must target an overlay layout', {
                    overrideId: override.id,
                    layoutId: override.layoutId
                })
            }
            const dashboardBaseWidget = allWidgetsById.get(override.baseWidgetId)
            if (!dashboardBaseWidget) {
                fail('Dashboard widget override references a missing base widget', {
                    overrideId: override.id,
                    baseWidgetId: override.baseWidgetId
                })
            }
            if (dashboardBaseWidget.layoutId !== scopedLayout.baseLayoutId) {
                fail('Dashboard widget override base widget belongs to the wrong layout', {
                    overrideId: override.id,
                    baseWidgetId: override.baseWidgetId,
                    baseLayoutId: scopedLayout.baseLayoutId
                })
            }
            continue
        }
        if (!scopedLayout || scopedLayout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY) {
            if (baseWidget) {
                fail('Marketing widget override must reference a scoped marketing layout', {
                    overrideId: override.id,
                    layoutId: override.layoutId
                })
            }
            continue
        }
        if (scopedLayout.compositionMode !== 'overlay' || !scopedLayout.baseLayoutId) {
            fail('Independent marketing layouts cannot contain widget overrides', { overrideId: override.id, layoutId: override.layoutId })
        }
        if (!baseWidget) {
            fail('Marketing widget override references a missing global widget', {
                overrideId: override.id,
                baseWidgetId: override.baseWidgetId
            })
        }
        const baseLayout = marketingGlobalLayouts.find((layout) => layout.id === scopedLayout.baseLayoutId)
        if (!baseLayout || baseWidget.layoutId !== baseLayout.id) {
            fail('Marketing widget override base widget belongs to the wrong layout', { overrideId: override.id })
        }
        if (
            override.zone !== undefined &&
            override.zone !== null &&
            !MARKETING_WIDGET_REGISTRY[baseWidget.parsed.widgetKey].allowedZones.some((allowedZone) => allowedZone === override.zone)
        ) {
            fail('Marketing widget override placement is invalid', { overrideId: override.id, zone: override.zone })
        }
        if (override.config !== undefined && override.config !== null) {
            const config = (() => {
                try {
                    return parseApplicationLayoutWidgetConfig(baseWidget.parsed.widgetKey, override.config)
                } catch {
                    return fail('Marketing widget override configuration is invalid', { overrideId: override.id })
                }
            })()
            if (config.instanceKey !== baseWidget.parsed.instanceKey) {
                fail('Marketing widget override cannot change the base instance key', { overrideId: override.id })
            }
        }
    }
}
