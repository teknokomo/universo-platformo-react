import { LAYOUT_ZONE_DEFINITIONS, type ApplicationTemplateKey, type PersistedLayoutNeutralMetadata } from '@universo-react/types'
import { copyApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { effectiveLayoutWidgetRuntimeSchema, failEffectiveLayout, type EffectiveLayoutWidget } from './effectiveLayoutContract'
import type { EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'
import {
    resolvePlacementRegistryDefinition,
    semanticParentInstanceKey,
    validatePlacementGraph,
    type PlacementGraphNode
} from '../persistence/applicationLayoutWidgetPlacement'

type RuntimeWidgetProjectionInput = {
    id: string
    layoutId: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    zone: string
    semanticRegion: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    placement?: 'start' | 'end'
    isActive: boolean
}

type ZoneSettingsLayer = {
    neutral: Pick<PersistedLayoutNeutralMetadata, 'sourceZoneSettings' | 'zoneSettings'>
}

/** Merge default, inherited, and local settings in layout precedence order. */
export const resolveEffectiveZoneSettings = (
    templateKey: ApplicationTemplateKey,
    layers: readonly ZoneSettingsLayer[]
): Record<string, Record<string, unknown>> => {
    const result: Record<string, Record<string, unknown>> = {}
    const zoneDefinitions = LAYOUT_ZONE_DEFINITIONS.filter((definition) => definition.templateKey === templateKey)

    for (const definition of zoneDefinitions) {
        if (definition.settings.length === 0) continue
        result[definition.key] = Object.fromEntries(definition.settings.map((setting) => [setting.key, setting.defaultValue]))
    }

    for (const layer of layers) {
        const source = (layer.neutral.sourceZoneSettings ?? {}) as Record<string, Record<string, unknown>>
        const local = (layer.neutral.zoneSettings ?? {}) as Record<string, Record<string, unknown>>
        for (const [zone, values] of Object.entries(source)) {
            if (!result[zone]) result[zone] = {}
            Object.assign(result[zone], values)
        }
        for (const [zone, values] of Object.entries(local)) {
            if (!result[zone]) result[zone] = {}
            Object.assign(result[zone], values)
        }
    }

    return result
}

/** Validate placement relationships and project allowlisted runtime widget data. */
export const projectEffectiveRuntimeWidgets = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly RuntimeWidgetProjectionInput[],
    runtimeDataByWidgetId: ReadonlyMap<string, EffectiveWidgetRuntimeData>
): EffectiveLayoutWidget[] => {
    try {
        validatePlacementGraph(
            widgets.map(
                (widget) =>
                    ({
                        id: widget.id,
                        layoutId: widget.layoutId,
                        templateKey,
                        widgetKey: widget.widgetKey,
                        zone: widget.zone,
                        rendererConfig: widget.config,
                        instanceKey: widget.instanceKey,
                        parentWidgetId: widget.parentWidgetId,
                        slotKey: widget.slotKey
                    } satisfies PlacementGraphNode)
            ),
            { effectiveGraph: true, resolveRegistryDefinition: resolvePlacementRegistryDefinition }
        )
    } catch {
        return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
    }
    const instanceKeyById = new Map(widgets.map(({ id, instanceKey }) => [id, instanceKey]))
    return widgets.map((widget) => {
        try {
            const runtimeData = runtimeDataByWidgetId.get(widget.id)
            const projected = effectiveLayoutWidgetRuntimeSchema.parse({
                id: widget.id,
                instanceKey: widget.instanceKey,
                parentInstanceKey: semanticParentInstanceKey(widget, instanceKeyById),
                slotKey: widget.slotKey,
                zone: widget.zone,
                semanticRegion: widget.semanticRegion,
                widgetKey: widget.widgetKey,
                sortOrder: widget.sortOrder,
                config: widget.config,
                ...(widget.placement === undefined ? {} : { placement: widget.placement }),
                isActive: widget.isActive,
                ...(runtimeData === undefined ? {} : { runtimeData })
            })
            return copyApplicationLayoutWidgetSourceBindingState(widget, projected)
        } catch {
            return failEffectiveLayout('LAYOUT_PERSISTED_INVALID')
        }
    })
}
