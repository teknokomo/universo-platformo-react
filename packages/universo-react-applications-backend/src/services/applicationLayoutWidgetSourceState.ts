import stableStringify from 'json-stable-stringify'
import { z } from 'zod'
import {
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    layoutLogicalPlacementSchema,
    parseApplicationLayoutWidgetConfig,
    type ApplicationTemplateKey,
    type LayoutLogicalPlacement
} from '@universo-react/types'

/** Application-only baseline for editable widget fields stored outside renderer config. */
export const applicationLayoutWidgetSourceStateSchema = z
    .object({
        rendererConfig: z.record(z.string(), z.unknown()),
        isActive: z.boolean(),
        sortOrder: z.number().int(),
        zone: z.string().trim().min(1),
        placement: layoutLogicalPlacementSchema.nullable()
    })
    .strict()
export type ApplicationLayoutWidgetSourceState = z.infer<typeof applicationLayoutWidgetSourceStateSchema>

export interface ApplicationLayoutWidgetSourceInput {
    widgetKey: string
    zone: string
    sortOrder: number
    isActive?: boolean
    config: unknown
    sourceBaseWidgetId?: string | null
}

interface WidgetPresentationInput {
    zone: string
    sortOrder: number
    isActive: boolean
    config: unknown
}

interface CurrentApplicationLayoutWidgetSourceRow {
    id: string
    widget_key: string
    zone: string
    sort_order: number
    is_active: boolean
    config: unknown
    source_config: unknown
    source_state: unknown
    source_widget_id: string | null
    source_base_widget_id: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
}

const canonicalWidgetSourceState = (
    templateKey: ApplicationTemplateKey,
    widgetKey: string,
    input: WidgetPresentationInput & { rendererConfig?: unknown; placement?: LayoutLogicalPlacement | null }
): ApplicationLayoutWidgetSourceState => {
    const rendererConfig = parseApplicationLayoutWidgetConfig(widgetKey, input.rendererConfig ?? {})
    const placement =
        input.placement === undefined
            ? getLayoutWidgetDefaultPlacement({ templateKey, widgetKey, zone: input.zone, rendererConfig }) ?? null
            : input.placement
    const canonicalPlacement = placement === null ? null : layoutLogicalPlacementSchema.parse(placement)
    encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: canonicalPlacement === null ? {} : { placement: canonicalPlacement } },
        { templateKey, widgetKey, zone: input.zone }
    )
    return applicationLayoutWidgetSourceStateSchema.parse({
        rendererConfig,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        zone: input.zone,
        placement: canonicalPlacement
    })
}

export const createApplicationLayoutWidgetSourceState = (
    templateKey: ApplicationTemplateKey,
    widgetKey: string,
    input: WidgetPresentationInput,
    options: { requireBindings?: boolean; rejectBindings?: boolean } = {}
): ApplicationLayoutWidgetSourceState => {
    const decoded = decodeLayoutWidgetConfigEnvelope(input.config, {
        templateKey,
        widgetKey,
        zone: input.zone,
        requireBindings: options.requireBindings
    })
    if (options.rejectBindings && decoded.neutral.bindings !== undefined) {
        throw new Error('[SchemaSync] Inherited Marketing widget config cannot contain entity bindings')
    }
    return canonicalWidgetSourceState(templateKey, widgetKey, {
        ...input,
        rendererConfig: decoded.rendererConfig,
        placement: decoded.neutral.placement
    })
}

export const parseApplicationLayoutWidgetSourceState = (
    value: unknown,
    templateKey: ApplicationTemplateKey,
    widgetKey: string
): ApplicationLayoutWidgetSourceState => {
    let candidate = value
    if (typeof candidate === 'string') {
        try {
            candidate = JSON.parse(candidate)
        } catch {
            throw new Error('[SchemaSync] Persisted widget source state is invalid JSON')
        }
    }
    const parsed = applicationLayoutWidgetSourceStateSchema.parse(candidate)
    return canonicalWidgetSourceState(templateKey, widgetKey, {
        ...parsed,
        config: {},
        rendererConfig: parsed.rendererConfig,
        placement: parsed.placement
    })
}

export const applicationLayoutWidgetSourceStatesEqual = (
    left: ApplicationLayoutWidgetSourceState,
    right: ApplicationLayoutWidgetSourceState
): boolean => stableStringify(left) === stableStringify(right)

export const resolveSyncedApplicationLayoutWidgetState = (
    templateKey: ApplicationTemplateKey,
    row: ApplicationLayoutWidgetSourceInput,
    current?: CurrentApplicationLayoutWidgetSourceRow
): {
    config: Record<string, unknown>
    zone: string
    sortOrder: number
    isActive: boolean
    sourceState: ApplicationLayoutWidgetSourceState
} => {
    const inheritsMarketingBindings =
        templateKey === 'marketing-page' && row.sourceBaseWidgetId !== undefined && row.sourceBaseWidgetId !== null
    const sourceConfigOptions = inheritsMarketingBindings ? { requireBindings: false, rejectBindings: true } : { requireBindings: true }
    const sourceState = createApplicationLayoutWidgetSourceState(
        templateKey,
        row.widgetKey,
        {
            zone: row.zone,
            sortOrder: row.sortOrder,
            isActive: row.isActive !== false,
            config: row.config
        },
        sourceConfigOptions
    )
    let resolved = sourceState

    if (current) {
        if (current.widget_key !== row.widgetKey) {
            throw new Error(`[SchemaSync] Widget ${current.id} changed its registered widget key`)
        }
        const currentInheritsMarketingBindings =
            templateKey === 'marketing-page' && current.source_base_widget_id !== null && current.source_base_widget_id !== undefined
        if (currentInheritsMarketingBindings !== inheritsMarketingBindings) {
            throw new Error(`[SchemaSync] Widget ${current.id} changed its base placement lineage`)
        }
        const currentConfigOptions = inheritsMarketingBindings
            ? { requireBindings: false, rejectBindings: true }
            : { requireBindings: false }
        let currentSourceBindings: ReturnType<typeof decodeLayoutWidgetConfigEnvelope>['neutral']['bindings']
        if (current.source_config !== null && current.source_config !== undefined) {
            const currentSourceConfig = decodeLayoutWidgetConfigEnvelope(current.source_config, {
                templateKey,
                widgetKey: current.widget_key,
                zone: current.zone,
                requireBindings: !inheritsMarketingBindings
            })
            currentSourceBindings = currentSourceConfig.neutral.bindings
            if (inheritsMarketingBindings && currentSourceBindings !== undefined) {
                throw new Error(`[SchemaSync] Inherited Marketing widget ${current.id} source config cannot contain entity bindings`)
            }
        } else if (current.source_widget_id !== null && current.source_widget_id !== undefined) {
            throw new Error(`[SchemaSync] Inherited widget ${current.id} is missing its source config baseline`)
        }
        if (current.source_state === null || current.source_state === undefined) {
            if (
                (current.source_config !== null && current.source_config !== undefined) ||
                (current.source_widget_id !== null && current.source_widget_id !== undefined) ||
                (current.source_base_widget_id !== null && current.source_base_widget_id !== undefined)
            ) {
                throw new Error(`[SchemaSync] Inherited widget ${current.id} is missing its source-state baseline`)
            }
        } else {
            const previousSourceState = parseApplicationLayoutWidgetSourceState(current.source_state, templateKey, current.widget_key)
            const currentConfig = decodeLayoutWidgetConfigEnvelope(current.config, {
                templateKey,
                widgetKey: current.widget_key,
                zone: current.zone,
                requireBindings: false
            })
            if (inheritsMarketingBindings && currentConfig.neutral.bindings !== undefined) {
                throw new Error(`[SchemaSync] Inherited Marketing widget ${current.id} config cannot contain entity bindings`)
            }
            if (
                !inheritsMarketingBindings &&
                currentConfig.neutral.bindings !== undefined &&
                (currentSourceBindings === undefined ||
                    stableStringify(currentConfig.neutral.bindings) !== stableStringify(currentSourceBindings))
            ) {
                throw new Error(`[SchemaSync] Widget ${current.id} config bindings do not match its source baseline`)
            }
            const currentState = createApplicationLayoutWidgetSourceState(
                templateKey,
                current.widget_key,
                {
                    zone: current.zone,
                    sortOrder: current.sort_order,
                    isActive: current.is_active,
                    config: current.config
                },
                currentConfigOptions
            )
            const nextDecoded = decodeLayoutWidgetConfigEnvelope(row.config, {
                templateKey,
                widgetKey: row.widgetKey,
                zone: row.zone,
                requireBindings: !inheritsMarketingBindings
            })
            if (inheritsMarketingBindings && nextDecoded.neutral.bindings !== undefined) {
                throw new Error('[SchemaSync] Inherited Marketing widget config cannot contain entity bindings')
            }
            const sameRendererConfig = stableStringify(currentState.rendererConfig) === stableStringify(previousSourceState.rendererConfig)
            const sameZone = currentState.zone === previousSourceState.zone
            const sameSortOrder = currentState.sortOrder === previousSourceState.sortOrder
            const sameActiveState =
                (current._upl_deleted && !current._app_deleted) || currentState.isActive === previousSourceState.isActive
            const samePlacement = stableStringify(currentState.placement) === stableStringify(previousSourceState.placement)
            resolved = {
                rendererConfig: sameRendererConfig ? sourceState.rendererConfig : currentState.rendererConfig,
                isActive: sameActiveState ? sourceState.isActive : currentState.isActive,
                sortOrder: sameSortOrder ? sourceState.sortOrder : currentState.sortOrder,
                zone: sameZone ? sourceState.zone : currentState.zone,
                placement: samePlacement ? sourceState.placement : currentState.placement
            }
            const bindings = inheritsMarketingBindings ? undefined : nextDecoded.neutral.bindings
            const config = encodeLayoutWidgetConfigEnvelope(
                {
                    rendererConfig: resolved.rendererConfig,
                    neutral: {
                        ...(resolved.placement === null ? {} : { placement: resolved.placement }),
                        ...(bindings === undefined ? {} : { bindings })
                    }
                },
                { templateKey, widgetKey: row.widgetKey, zone: resolved.zone, requireBindings: !inheritsMarketingBindings }
            )
            return {
                config,
                zone: resolved.zone,
                sortOrder: resolved.sortOrder,
                isActive: resolved.isActive,
                sourceState
            }
        }
    }

    const bindings = decodeLayoutWidgetConfigEnvelope(row.config, {
        templateKey,
        widgetKey: row.widgetKey,
        zone: row.zone,
        requireBindings: !inheritsMarketingBindings
    }).neutral.bindings
    if (inheritsMarketingBindings && bindings !== undefined) {
        throw new Error('[SchemaSync] Inherited Marketing widget config cannot contain entity bindings')
    }
    const config = encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig: resolved.rendererConfig,
            neutral: {
                ...(resolved.placement === null ? {} : { placement: resolved.placement }),
                ...(bindings === undefined ? {} : { bindings })
            }
        },
        { templateKey, widgetKey: row.widgetKey, zone: resolved.zone, requireBindings: !inheritsMarketingBindings }
    )
    return { config, zone: resolved.zone, sortOrder: resolved.sortOrder, isActive: resolved.isActive, sourceState }
}

export const isApplicationLayoutWidgetCustomized = (
    templateKey: ApplicationTemplateKey,
    widget: WidgetPresentationInput & { widgetKey: string; placement?: LayoutLogicalPlacement | null },
    sourceState: ApplicationLayoutWidgetSourceState
): boolean => {
    const current = canonicalWidgetSourceState(templateKey, widget.widgetKey, {
        ...widget,
        rendererConfig: widget.config,
        placement: widget.placement
    })
    return !applicationLayoutWidgetSourceStatesEqual(current, sourceState)
}
