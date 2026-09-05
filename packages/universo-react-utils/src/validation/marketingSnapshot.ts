import {
    MARKETING_PAGE_TEMPLATE_KEY,
    MARKETING_WIDGET_REGISTRY,
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
}

export type MarketingSnapshotWidgetLike = {
    id: string
    layoutId: string
    zone: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
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

    const layoutIds = new Set<string>()
    for (const layout of [...layouts, ...scopedLayouts]) {
        const id = assertSnapshotUuidV7(layout.id, 'layout id', 'layout')
        if (layoutIds.has(id)) failSnapshotLayout('Snapshot contains duplicate layout ids', { layoutId: id })
        layoutIds.add(id)
        if (layout.scopeEntityId !== undefined && layout.scopeEntityId !== null) {
            assertSnapshotUuidV7(layout.scopeEntityId, 'layout scope entity id', `layout:${id}`)
        }
        if (layout.baseLayoutId !== undefined && layout.baseLayoutId !== null) {
            assertSnapshotUuidV7(layout.baseLayoutId, 'base layout id', `layout:${id}`)
            if (!layoutIds.has(layout.baseLayoutId)) {
                failSnapshotLayout('Snapshot layout references a missing base layout', {
                    layoutId: id,
                    baseLayoutId: layout.baseLayoutId
                })
            }
        }
    }

    const widgetIds = new Set<string>()
    for (const widget of widgets) {
        const id = assertSnapshotUuidV7(widget.id, 'widget id', 'widget')
        if (widgetIds.has(id)) failSnapshotLayout('Snapshot contains duplicate widget ids', { widgetId: id })
        widgetIds.add(id)
        const layoutId = assertSnapshotUuidV7(widget.layoutId, 'widget layout id', `widget:${id}`)
        if (!layoutIds.has(layoutId)) {
            failSnapshotLayout('Snapshot widget references a missing layout', { widgetId: id, layoutId })
        }
        if (widget.sourceBaseWidgetId !== undefined && widget.sourceBaseWidgetId !== null) {
            assertSnapshotUuidV7(widget.sourceBaseWidgetId, 'widget source base id', `widget:${id}`)
        }
    }

    const overrideIds = new Set<string>()
    const overrideTargets = new Set<string>()
    for (const override of overrides) {
        const id = assertSnapshotUuidV7(override.id, 'widget override id', 'override')
        if (overrideIds.has(id)) failSnapshotLayout('Snapshot contains duplicate widget override ids', { overrideId: id })
        overrideIds.add(id)
        const layoutId = assertSnapshotUuidV7(override.layoutId, 'widget override layout id', `override:${id}`)
        const baseWidgetId = assertSnapshotUuidV7(override.baseWidgetId, 'widget override base widget id', `override:${id}`)
        if (!layoutIds.has(layoutId)) {
            failSnapshotLayout('Snapshot widget override references a missing layout', { overrideId: id, layoutId })
        }
        if (!widgetIds.has(baseWidgetId)) {
            failSnapshotLayout('Snapshot widget override references a missing widget', { overrideId: id, baseWidgetId })
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

const assertMarketingLayoutIdentity = (layout: MarketingSnapshotLayoutLike, kind: 'global' | 'scoped'): void => {
    assertUuidV7(layout.id, `${kind} layout id`, `layout:${layout.id}`)
    if (kind === 'scoped') {
        assertUuidV7(layout.scopeEntityId, 'layout scope entity id', `layout:${layout.id}`)
        assertUuidV7(layout.baseLayoutId, 'base layout id', `layout:${layout.id}`)
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
    const marketingWidgets = widgets.filter((widget) => typeof widget.widgetKey === 'string' && widget.widgetKey.startsWith('marketing.'))

    if (marketingLayouts.length === 0 && marketingWidgets.length === 0) return
    if (marketingLayouts.length === 0) {
        fail('Marketing snapshot widget has no marketing layout', { widgetCount: marketingWidgets.length })
    }
    if (allLayouts.some((layout) => layout.templateKey !== MARKETING_PAGE_TEMPLATE_KEY)) {
        fail('Marketing snapshot cannot mix dashboard and marketing layouts', {})
    }
    if (snapshotRecord.layoutZoneWidgets === undefined) fail('Marketing snapshot layout widgets are missing', {})

    const globalLayoutIds = new Set<string>()
    const allLayoutIds = new Set<string>()
    for (const layout of layouts) {
        const layoutRecord = layout as unknown as Record<string, unknown>
        if ('scopeEntityId' in layoutRecord || 'baseLayoutId' in layoutRecord) {
            fail('Marketing global layout contains scoped layout references', { layoutId: layout.id })
        }
        assertMarketingLayoutIdentity(layout, 'global')
        if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
        globalLayoutIds.add(layout.id)
        allLayoutIds.add(layout.id)
    }

    for (const layout of scopedLayouts) {
        assertMarketingLayoutIdentity(layout, 'scoped')
        if (allLayoutIds.has(layout.id)) fail('Marketing snapshot contains duplicate layout ids', { layoutId: layout.id })
        if (!globalLayoutIds.has(layout.baseLayoutId as string)) {
            fail('Marketing scoped layout references a missing global layout', { layoutId: layout.id, baseLayoutId: layout.baseLayoutId })
        }
        const scopeEntity = entities[layout.scopeEntityId as string]
        if (!isRecord(scopeEntity) || scopeEntity.kind !== 'object') {
            fail('Marketing scoped layout references a missing Object entity type', {
                layoutId: layout.id,
                scopeEntityId: layout.scopeEntityId
            })
        }
        allLayoutIds.add(layout.id)
    }

    const defaultLayoutId =
        normalizedSnapshot.defaultLayoutId === undefined || normalizedSnapshot.defaultLayoutId === null
            ? fail('Marketing snapshot has no explicit default layout', {})
            : assertUuidV7(normalizedSnapshot.defaultLayoutId, 'default layout id', 'snapshot')
    if (!globalLayoutIds.has(defaultLayoutId)) {
        fail('Marketing snapshot default layout must reference a global layout', { defaultLayoutId })
    }
    const defaultLayout = layouts.find((layout) => layout.id === defaultLayoutId)
    if (!defaultLayout?.isActive || !defaultLayout.isDefault) {
        fail('Marketing snapshot default layout must be active and marked as default', { defaultLayoutId })
    }
    if (snapshotRecord.layoutConfig !== undefined) {
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
        const scopedLayout = scopedLayouts.find((layout) => layout.id === override.layoutId)
        if (!scopedLayout) {
            fail('Marketing widget override must reference a scoped marketing layout', {
                overrideId: override.id,
                layoutId: override.layoutId
            })
        }
        const baseWidget = widgetsById.get(override.baseWidgetId)
        if (!baseWidget) {
            fail('Marketing widget override references a missing global widget', {
                overrideId: override.id,
                baseWidgetId: override.baseWidgetId
            })
        }
        const baseLayout = layouts.find((layout) => layout.id === scopedLayout?.baseLayoutId)
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
