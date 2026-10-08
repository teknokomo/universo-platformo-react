import stableStringify from 'json-stable-stringify'
import { z } from 'zod'
import {
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    layoutInstanceKeySchema,
    layoutLogicalPlacementSchema,
    uuidV7Schema,
    type ApplicationTemplateKey,
    type LayoutLogicalPlacement
} from '@universo-react/types'
import {
    classifyPlacementLineage,
    decodePlacementWidgetConfigEnvelope,
    parsePlacementRendererConfig,
    resolvePlacementBindingValidation
} from '../persistence/applicationLayoutWidgetPlacement'

/** Application-only baseline for editable widget fields stored outside renderer config. */
export const applicationLayoutWidgetSourceStateSchema = z
    .object({
        rendererConfig: z.record(z.string(), z.unknown()),
        instanceKey: layoutInstanceKeySchema,
        parentWidgetId: uuidV7Schema.nullable(),
        slotKey: z.string().trim().min(1).max(128).nullable(),
        isActive: z.boolean(),
        sortOrder: z.number().int(),
        zone: z.string().trim().min(1),
        placement: layoutLogicalPlacementSchema.nullable()
    })
    .strict()
    .superRefine((state, context) => {
        if ((state.parentWidgetId === null) !== (state.slotKey === null)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Parent and slot must either both be set or both be null' })
        }
    })
export type ApplicationLayoutWidgetSourceState = z.infer<typeof applicationLayoutWidgetSourceStateSchema>

export interface ApplicationLayoutWidgetSourceInput {
    widgetKey: string
    zone: string
    sortOrder: number
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    isActive?: boolean
    config: unknown
    sourceBaseWidgetId?: string | null
    sourceWidgetId?: string | null
}

interface WidgetPresentationInput {
    zone: string
    sortOrder: number
    isActive: boolean
    config: unknown
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
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
    instance_key: string
    parent_widget_id: string | null
    slot_key: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
}

const canonicalWidgetSourceState = (
    templateKey: ApplicationTemplateKey,
    widgetKey: string,
    input: WidgetPresentationInput & { rendererConfig?: unknown; placement?: LayoutLogicalPlacement | null }
): ApplicationLayoutWidgetSourceState => {
    const rendererConfig = parsePlacementRendererConfig(widgetKey, input.rendererConfig ?? {})
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
        instanceKey: input.instanceKey,
        parentWidgetId: input.parentWidgetId,
        slotKey: input.slotKey,
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
    const decoded = decodePlacementWidgetConfigEnvelope(input.config, {
        templateKey,
        widgetKey,
        zone: input.zone,
        instanceKey: input.instanceKey,
        requireBindings: options.requireBindings
    })
    if (options.rejectBindings && decoded.neutral.bindings !== undefined) {
        throw new Error('[SchemaSync] Inherited widget config cannot contain bindings')
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
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    sourceState: ApplicationLayoutWidgetSourceState
} => {
    const rowLineage = classifyPlacementLineage(row.sourceWidgetId, row.sourceBaseWidgetId)
    const rowSourceLinked = rowLineage.kind === 'source-linked'
    const rowBindingsInheritedFromBase = row.sourceBaseWidgetId !== null && row.sourceBaseWidgetId !== undefined
    const sourceBindingOptions = resolvePlacementBindingValidation(row.widgetKey, row.config, rowSourceLinked, rowBindingsInheritedFromBase)
    const sourceState = createApplicationLayoutWidgetSourceState(
        templateKey,
        row.widgetKey,
        {
            zone: row.zone,
            sortOrder: row.sortOrder,
            isActive: row.isActive !== false,
            config: row.config,
            instanceKey: row.instanceKey,
            parentWidgetId: row.parentWidgetId,
            slotKey: row.slotKey
        },
        sourceBindingOptions
    )
    let resolved = sourceState

    if (current) {
        if (current.widget_key !== row.widgetKey) {
            throw new Error(`[SchemaSync] Widget ${current.id} changed its registered widget key`)
        }
        const currentLineage = classifyPlacementLineage(current.source_widget_id, current.source_base_widget_id)
        const currentSourceLinked = currentLineage.kind === 'source-linked'
        if (currentSourceLinked !== rowSourceLinked) throw new Error(`[SchemaSync] Widget ${current.id} changed its placement lineage`)
        const currentBindingsInheritedFromBase = current.source_base_widget_id !== null && current.source_base_widget_id !== undefined
        const currentBindingOptions = resolvePlacementBindingValidation(
            current.widget_key,
            current.config,
            currentSourceLinked,
            currentBindingsInheritedFromBase
        )
        let currentSourceBindings: ReturnType<typeof decodeLayoutWidgetConfigEnvelope>['neutral']['bindings']
        if (current.source_config !== null && current.source_config !== undefined) {
            const currentSourceConfig = decodePlacementWidgetConfigEnvelope(current.source_config, {
                templateKey,
                widgetKey: current.widget_key,
                zone: current.zone,
                instanceKey: current.instance_key,
                requireBindings: currentBindingOptions.requireBindings
            })
            currentSourceBindings = currentSourceConfig.neutral.bindings
            if (currentBindingOptions.rejectBindings && currentSourceBindings !== undefined) {
                throw new Error(`[SchemaSync] Widget ${current.id} source config cannot contain Entity bindings`)
            }
        } else if (currentSourceLinked) {
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
            const currentConfig = decodePlacementWidgetConfigEnvelope(current.config, {
                templateKey,
                widgetKey: current.widget_key,
                zone: current.zone,
                instanceKey: current.instance_key,
                requireBindings: false
            })
            if (currentBindingOptions.rejectBindings && currentConfig.neutral.bindings !== undefined) {
                throw new Error(`[SchemaSync] Widget ${current.id} config cannot contain Entity bindings`)
            }
            if (
                currentSourceLinked &&
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
                    config: current.config,
                    instanceKey: current.instance_key,
                    parentWidgetId: current.parent_widget_id,
                    slotKey: current.slot_key
                },
                { requireBindings: false, rejectBindings: currentBindingOptions.rejectBindings }
            )
            const nextBindingOptions = resolvePlacementBindingValidation(
                row.widgetKey,
                row.config,
                rowSourceLinked,
                rowBindingsInheritedFromBase
            )
            const nextDecoded = decodePlacementWidgetConfigEnvelope(row.config, {
                templateKey,
                widgetKey: row.widgetKey,
                zone: row.zone,
                instanceKey: row.instanceKey,
                requireBindings: nextBindingOptions.requireBindings
            })
            if (nextBindingOptions.rejectBindings && nextDecoded.neutral.bindings !== undefined) {
                throw new Error('[SchemaSync] Placement config cannot contain Entity bindings')
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
                placement: samePlacement ? sourceState.placement : currentState.placement,
                instanceKey: sourceState.instanceKey,
                parentWidgetId: sourceState.parentWidgetId,
                slotKey: sourceState.slotKey
            }
            const bindings = nextBindingOptions.rejectBindings ? undefined : nextDecoded.neutral.bindings
            const config = encodeLayoutWidgetConfigEnvelope(
                {
                    rendererConfig: resolved.rendererConfig,
                    neutral: {
                        ...(resolved.placement === null ? {} : { placement: resolved.placement }),
                        ...(bindings === undefined ? {} : { bindings })
                    }
                },
                { templateKey, widgetKey: row.widgetKey, zone: resolved.zone, requireBindings: nextBindingOptions.requireBindings }
            )
            return {
                config,
                zone: resolved.zone,
                sortOrder: resolved.sortOrder,
                isActive: resolved.isActive,
                instanceKey: resolved.instanceKey,
                parentWidgetId: resolved.parentWidgetId,
                slotKey: resolved.slotKey,
                sourceState
            }
        }
    }

    const bindingsOptions = resolvePlacementBindingValidation(row.widgetKey, row.config, rowSourceLinked, rowBindingsInheritedFromBase)
    const bindings = decodePlacementWidgetConfigEnvelope(row.config, {
        templateKey,
        widgetKey: row.widgetKey,
        zone: row.zone,
        instanceKey: row.instanceKey,
        requireBindings: bindingsOptions.requireBindings
    }).neutral.bindings
    if (bindingsOptions.rejectBindings && bindings !== undefined) {
        throw new Error('[SchemaSync] Placement config cannot contain Entity bindings')
    }
    const config = encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig: resolved.rendererConfig,
            neutral: {
                ...(resolved.placement === null ? {} : { placement: resolved.placement }),
                ...(bindingsOptions.rejectBindings || bindings === undefined ? {} : { bindings })
            }
        },
        { templateKey, widgetKey: row.widgetKey, zone: resolved.zone, requireBindings: bindingsOptions.requireBindings }
    )
    return {
        config,
        zone: resolved.zone,
        sortOrder: resolved.sortOrder,
        isActive: resolved.isActive,
        instanceKey: resolved.instanceKey,
        parentWidgetId: resolved.parentWidgetId,
        slotKey: resolved.slotKey,
        sourceState
    }
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
