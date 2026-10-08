import { dashboardWidgetConfigSchemaByKey, getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { getApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'
import type { EffectiveLayoutWidget } from '../../services/effectiveLayoutContract'
import type { RuntimeZoneWidgets } from './contracts'

export type RuntimeRelationAuthorityProjection = {
    slotKey: string
    parentEntityCodename: string
    childEntityCodename: string
    parentFieldCodename: string
    sortOrderFieldCodename: string
    enableRowReordering: boolean
}

const runtimeRelationAuthorityProjectionSymbol: unique symbol = Symbol('runtime-relation-authority-projection')

type ZoneWidgetsWithRelationAuthority = RuntimeZoneWidgets & {
    [runtimeRelationAuthorityProjectionSymbol]?: readonly RuntimeRelationAuthorityProjection[]
}

const projectRelationAuthorities = (widgets: readonly EffectiveLayoutWidget[]): RuntimeRelationAuthorityProjection[] =>
    widgets.flatMap((widget) => {
        if (!widget.isActive || widget.widgetKey !== 'relationBuilder') return []

        const configResult = dashboardWidgetConfigSchemaByKey.relationBuilder.safeParse(widget.config)
        const bindings = getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
        const definition = getLayoutWidgetDefinition('relationBuilder', configResult.success ? configResult.data : undefined)
        if (!configResult.success || !bindings || !definition) return []

        let validatedBindings: ReturnType<typeof validateWidgetBindings>
        try {
            validatedBindings = validateWidgetBindings(definition, bindings)
        } catch {
            return []
        }

        const parentTargets = validatedBindings.slots.find(({ slot }) => slot === 'parent')?.targets ?? []
        if (parentTargets.length !== 1) return []
        const parentTarget = parentTargets[0]
        if (parentTarget.entityKind !== 'object' || parentTarget.selector.kind !== 'record-set') return []

        return configResult.data.panels.flatMap((panel) => {
            const panelTargets = validatedBindings.slots.find(({ slot }) => slot === panel.slotKey)?.targets ?? []
            if (panelTargets.length !== 1) return []
            const panelTarget = panelTargets[0]
            if (
                panelTarget.entityKind !== 'object' ||
                panelTarget.selector.kind !== 'relation-set' ||
                panelTarget.selector.parentSlot !== 'parent'
            ) {
                return []
            }

            return [
                {
                    slotKey: panel.slotKey,
                    parentEntityCodename: parentTarget.entityCodename,
                    childEntityCodename: panelTarget.entityCodename,
                    parentFieldCodename: panel.parentFieldCodename,
                    sortOrderFieldCodename: panel.sortOrderFieldCodename ?? 'SortOrder',
                    enableRowReordering: (panel.enableRowReordering ?? configResult.data.enableRowReordering) === true
                }
            ]
        })
    })

/** Attach only the validated Entity-level authority needed by row commands; never copy binding envelopes or record data. */
export const attachRuntimeRelationAuthorityProjection = (
    zoneWidgets: RuntimeZoneWidgets,
    widgets: readonly EffectiveLayoutWidget[]
): RuntimeZoneWidgets => {
    Object.defineProperty(zoneWidgets, runtimeRelationAuthorityProjectionSymbol, {
        configurable: false,
        enumerable: false,
        value: projectRelationAuthorities(widgets),
        writable: false
    })
    return zoneWidgets
}

export const getRuntimeRelationAuthorityProjection = (zoneWidgets: RuntimeZoneWidgets): readonly RuntimeRelationAuthorityProjection[] =>
    (zoneWidgets as ZoneWidgetsWithRelationAuthority)[runtimeRelationAuthorityProjectionSymbol] ?? []
