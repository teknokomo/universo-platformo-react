import {
    dashboardWidgetConfigSchemaByKey,
    getLayoutWidgetDefinition,
    validateWidgetBindings,
    type WidgetBindingTarget
} from '@universo-react/types'
import { getApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'
import type { EffectiveLayoutWidget } from '../../services/effectiveLayoutContract'
import type { RuntimeZoneWidgets } from './contracts'

export type RuntimeTableReorderAuthorityProjection = {
    entityCodename: string
    reorderPersistenceField: string
}

const ENTITY_SCHEMA_REORDER_FIELD_CODENAME = 'SortOrder'

const runtimeTableReorderAuthorityProjectionSymbol: unique symbol = Symbol('runtime-table-reorder-authority-projection')

type ZoneWidgetsWithTableReorderAuthority = RuntimeZoneWidgets & {
    [runtimeTableReorderAuthorityProjectionSymbol]?: readonly RuntimeTableReorderAuthorityProjection[]
}

const isRecordSetObjectTarget = (
    target: WidgetBindingTarget | undefined
): target is WidgetBindingTarget & {
    entityKind: 'object'
    selector: { kind: 'record-set' }
} => target?.entityKind === 'object' && target.selector.kind === 'record-set'

const projectTableReorderAuthorities = (widgets: readonly EffectiveLayoutWidget[]): RuntimeTableReorderAuthorityProjection[] =>
    widgets.flatMap((widget) => {
        if (!widget.isActive || widget.widgetKey !== 'detailsTable') return []

        const configResult = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(widget.config)
        if (!configResult.success || configResult.data.variant !== 'records' || configResult.data.enableRowReordering !== true) return []

        const rawBindings = getApplicationLayoutWidgetSourceBindingState(widget)?.bindings
        const definition = getLayoutWidgetDefinition('detailsTable', configResult.data)
        if (!rawBindings || !definition) return []

        let bindings: ReturnType<typeof validateWidgetBindings>
        try {
            bindings = validateWidgetBindings(definition, rawBindings)
        } catch {
            return []
        }

        const rowsSlot = definition.bindingSlots?.find(({ key }) => key === 'rows')
        const rowsTargets = bindings.slots.find(({ slot }) => slot === 'rows')?.targets ?? []
        if (
            rowsSlot?.projectionMode !== 'entity-schema' ||
            rowsTargets.length !== 1 ||
            !isRecordSetObjectTarget(rowsTargets[0]) ||
            rowsTargets[0].projection.length !== 0
        ) {
            return []
        }

        const target = rowsTargets[0]
        return [{ entityCodename: target.entityCodename, reorderPersistenceField: ENTITY_SCHEMA_REORDER_FIELD_CODENAME }]
    })

/** Attach only validated source identity and the registry-owned order field to this in-process runtime layout. */
export const attachRuntimeTableReorderAuthorityProjection = (
    zoneWidgets: RuntimeZoneWidgets,
    widgets: readonly EffectiveLayoutWidget[]
): RuntimeZoneWidgets => {
    Object.defineProperty(zoneWidgets, runtimeTableReorderAuthorityProjectionSymbol, {
        configurable: false,
        enumerable: false,
        value: projectTableReorderAuthorities(widgets),
        writable: false
    })
    return zoneWidgets
}

export const getRuntimeTableReorderAuthorityProjection = (
    zoneWidgets: RuntimeZoneWidgets
): readonly RuntimeTableReorderAuthorityProjection[] =>
    (zoneWidgets as ZoneWidgetsWithTableReorderAuthority)[runtimeTableReorderAuthorityProjectionSymbol] ?? []
