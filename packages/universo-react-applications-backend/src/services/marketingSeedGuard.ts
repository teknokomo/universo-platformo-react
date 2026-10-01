import stableStringify from 'json-stable-stringify'
import { decodeLayoutWidgetConfigEnvelope } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import { PUBLIC_MARKETING_ROW_LIMIT } from '../shared/marketingRuntimeLimits'

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const readString = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null)

export interface MarketingWidgetBindingConfigRow {
    widgetKey: unknown
    zone: unknown
    config: unknown
    sourceConfig?: unknown
    sourceBaseWidgetId?: unknown
}

/** Collect every validated Entity source used by Marketing widget bindings. */
export const collectMarketingWidgetBindingSourcesFromConfigs = (widgets: readonly MarketingWidgetBindingConfigRow[]): Set<string> => {
    const sources = new Set<string>()

    for (const widget of widgets) {
        const widgetKey = readString(widget.widgetKey)
        const zone = readString(widget.zone)
        if (!widgetKey || !zone) throw new Error('Persisted Marketing widget identity is invalid')

        const inheritsBinding = widget.sourceBaseWidgetId !== null && widget.sourceBaseWidgetId !== undefined
        if (inheritsBinding && !isUuidV7(widget.sourceBaseWidgetId)) {
            throw new Error('Persisted Marketing widget source identity is invalid')
        }
        const hasSourceConfig = widget.sourceConfig !== null && widget.sourceConfig !== undefined
        const configBindings = readMarketingWidgetBindings(widget.config, {
            widgetKey,
            zone,
            requireBindings: !inheritsBinding && !hasSourceConfig
        })
        const sourceConfigBindings = hasSourceConfig
            ? readMarketingWidgetBindings(widget.sourceConfig, { widgetKey, zone, requireBindings: !inheritsBinding })
            : undefined

        if (
            !inheritsBinding &&
            configBindings !== undefined &&
            hasSourceConfig &&
            stableStringify(configBindings) !== stableStringify(sourceConfigBindings)
        ) {
            throw new Error(`Marketing widget ${widgetKey} bindings do not match its trusted source config`)
        }
        if (inheritsBinding && (configBindings !== undefined || sourceConfigBindings !== undefined)) {
            throw new Error(`Marketing overlay widget ${widgetKey} cannot override inherited Entity bindings`)
        }

        for (const bindings of [configBindings, sourceConfigBindings]) {
            for (const slot of bindings?.slots ?? []) {
                for (const target of slot.targets) sources.add(target.entityCodename)
            }
        }
    }

    return sources
}


/**
 * Runtime row-cap discovery must not make an unrelated Entity write fail only
 * because another Marketing placement is malformed. Publication and runtime
 * resolution keep using the strict collector above; every valid placement still
 * contributes its bound sources here.
 */
export const collectMarketingWidgetBindingSourcesForRuntimeWritesFromConfigs = (
    widgets: readonly MarketingWidgetBindingConfigRow[]
): Set<string> => {
    const sources = new Set<string>()
    for (const widget of widgets) {
        try {
            for (const source of collectMarketingWidgetBindingSourcesFromConfigs([widget])) sources.add(source)
        } catch {
            // Broken layouts fail closed at their authoring/publication/runtime boundaries.
        }
    }
    return sources
}

const readMarketingWidgetBindings = (rawConfig: unknown, context: { widgetKey: string; zone: string; requireBindings: boolean }) => {
    if (!asRecord(rawConfig)) throw new Error('Persisted Marketing widget config is invalid')
    return decodeLayoutWidgetConfigEnvelope(rawConfig, {
        templateKey: 'marketing-page',
        widgetKey: context.widgetKey,
        zone: context.zone,
        requireBindings: context.requireBindings
    }).neutral.bindings
}

/** Collect sources from trusted layout snapshots; unrelated templates add no sources. */
export const collectMarketingWidgetBindingSources = (snapshot: {
    layouts?: unknown[]
    scopedLayouts?: unknown[]
    layoutZoneWidgets?: unknown[]
}): Set<string> => {
    const templateByLayoutId = new Map<string, string>()
    for (const rawLayout of [...(snapshot.layouts ?? []), ...(snapshot.scopedLayouts ?? [])]) {
        const layout = asRecord(rawLayout)
        const layoutId = readString(layout?.id)
        const templateKey = readString(layout?.templateKey)
        if (!layoutId || !templateKey) throw new Error('Marketing layout snapshot identity is invalid')
        const currentTemplateKey = templateByLayoutId.get(layoutId)
        if (currentTemplateKey !== undefined && currentTemplateKey !== templateKey) {
            throw new Error(`Layout ${layoutId} has conflicting template identities`)
        }
        templateByLayoutId.set(layoutId, templateKey)
    }

    const marketingWidgets: MarketingWidgetBindingConfigRow[] = []
    for (const rawWidget of snapshot.layoutZoneWidgets ?? []) {
        const widget = asRecord(rawWidget)
        const layoutId = readString(widget?.layoutId)
        if (!layoutId) throw new Error('Layout widget snapshot identity is invalid')
        const templateKey = templateByLayoutId.get(layoutId)
        if (!templateKey) throw new Error(`Layout widget references unknown layout ${layoutId}`)
        if (templateKey !== 'marketing-page') continue

        marketingWidgets.push({
            widgetKey: widget?.widgetKey,
            zone: widget?.zone,
            config: widget?.config
        })
    }

    return collectMarketingWidgetBindingSourcesFromConfigs(marketingWidgets)
}

/**
 * Shared marketing seed guards used by the application sync and the workspace
 * seed paths. Published marketing content is read back through the anonymous
 * public runtime, which caps each object and requires unique semantic keys, so
 * both write paths fail closed at seed time instead of breaking the page later.
 */
export const assertMarketingSeedRows = (params: {
    objectCodename: string
    rows: readonly unknown[]
    uniqueFieldCodenames: readonly string[]
}): void => {
    assertMarketingSeedRowCount({ objectCodename: params.objectCodename, rowCount: params.rows.length })
    if (params.uniqueFieldCodenames.length === 0) return
    const seen = new Map<string, string>()
    for (const [index, row] of params.rows.entries()) {
        const data = (row && typeof row === 'object' ? (row as { data?: Record<string, unknown> }).data : undefined) ?? {}
        for (const codename of params.uniqueFieldCodenames) {
            const value = data[codename]
            if (typeof value !== 'string' || value.trim().length === 0) continue
            // Compare case-insensitively/trimmed: the public serializer
            // normalizes semantic keys, so case-only collisions still break it.
            const compositeKey = `${codename}\u0000${value.trim().toLowerCase()}`
            if (seen.has(compositeKey)) {
                throw new Error(
                    `Snapshot predefined elements contain a duplicate unique key "${value}" for ${codename} in ${params.objectCodename}; resolve the duplicate before publishing`
                )
            }
            seen.set(compositeKey, String(index))
        }
    }
}

export const assertMarketingSeedRowCount = (params: { objectCodename: string; rowCount: number }): void => {
    if (!Number.isSafeInteger(params.rowCount) || params.rowCount < 0 || params.rowCount > PUBLIC_MARKETING_ROW_LIMIT) {
        throw new Error(
            `Published marketing object ${params.objectCodename} exceeds the public runtime row limit (${PUBLIC_MARKETING_ROW_LIMIT}); reduce the records or split the collection`
        )
    }
}
