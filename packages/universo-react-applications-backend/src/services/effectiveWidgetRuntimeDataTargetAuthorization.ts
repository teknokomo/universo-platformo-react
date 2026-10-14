import { isCompatibleWidgetBindingEntity, MAX_WIDGET_BINDING_RESOLVED_RECORDS } from '@universo-react/types'
import type { WidgetBindingTarget } from '@universo-react/types'
import type { loadRuntimeWidgetBindingMetadata, RuntimeWidgetBindingObjectMetadata } from '../persistence/widgetBindingRuntimeStore'
import type { PreparedWidget } from './effectiveWidgetRuntimeDataProjectionShared'

const targetComponents = (slot: string, slots: ReadonlyMap<string, NonNullable<PreparedWidget['definition']['bindingSlots']>[number]>) => {
    const definition = slots.get(slot)
    if (!definition) return []
    return definition.requirements.components.map(({ componentCodename }) => componentCodename)
}

export const collectBindingMetadataRequests = (prepared: readonly PreparedWidget[]): Map<string, Set<string>> => {
    const requested = new Map<string, Set<string>>()
    for (const widget of prepared) {
        for (const { slot, target } of widget.targets) {
            const names = requested.get(target.entityCodename) ?? new Set<string>()
            for (const codename of targetComponents(slot, widget.slotByKey)) names.add(codename)
            requested.set(target.entityCodename, names)
        }
    }
    return requested
}

const isCompatibleTarget = (
    target: WidgetBindingTarget,
    slotKey: string,
    widget: PreparedWidget,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    relationParentObject?: RuntimeWidgetBindingObjectMetadata
): RuntimeWidgetBindingObjectMetadata | null => {
    if (target.entityKind !== 'object') return null
    const slot = widget.slotByKey.get(slotKey)
    const object = metadata.objectsByCodename.get(target.entityCodename)
    const codename = typeof object?.codename === 'string' ? object.codename : undefined
    if (!slot || !object || object.kind !== 'object' || codename !== target.entityCodename) return null
    const components = metadata.componentsByObjectId.get(String(object.id)) ?? []
    if (
        !isCompatibleWidgetBindingEntity(
            slot,
            {
                kind: 'object',
                codename,
                config: object.config,
                components: components.map((component) => ({
                    codename: String(component.codename),
                    dataType: String(component.dataType ?? ''),
                    isRequired: component.isRequired === true,
                    validationRules: component.validationRules,
                    targetObjectId: typeof component.targetObjectId === 'string' ? component.targetObjectId : null,
                    targetObjectKind: typeof component.targetObjectKind === 'string' ? component.targetObjectKind : null,
                    targetObjectCodename: typeof component.targetObjectCodename === 'string' ? component.targetObjectCodename : null,
                    uiConfig: component.uiConfig
                }))
            },
            relationParentObject &&
                typeof relationParentObject.id === 'string' &&
                typeof relationParentObject.kind === 'string' &&
                typeof relationParentObject.codename === 'string'
                ? {
                      relationParent: {
                          id: relationParentObject.id,
                          kind: relationParentObject.kind,
                          codename: relationParentObject.codename
                      }
                  }
                : undefined
        )
    ) {
        return null
    }
    return object
}

export const authorizeWidgetTargets = (
    widget: PreparedWidget,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>
): boolean => {
    for (const { slot, target } of widget.targets) {
        if (target.selector.kind !== 'relation-set') {
            if (!isCompatibleTarget(target, slot, widget, metadata)) return false
            continue
        }

        const parentSlotKey = target.selector.parentSlot
        const relation = widget.slotByKey.get(slot)?.relation
        const parentBinding = widget.bindings.slots.find((candidate) => candidate.slot === parentSlotKey)
        const parentTarget = parentBinding?.targets.length === 1 ? parentBinding.targets[0] : undefined
        const parentSlot = relation ? widget.slotByKey.get(relation.parentSlot) : undefined
        const parentObject = parentTarget && parentSlot ? isCompatibleTarget(parentTarget, parentSlot.key, widget, metadata) : null
        if (!relation || relation.parentSlot !== parentSlotKey || !parentTarget || !parentObject) return false
        const childObject = isCompatibleTarget(target, slot, widget, metadata, parentObject)
        if (!childObject) return false

        const relationComponent =
            metadata.componentsByObjectId
                .get(String(childObject.id))
                ?.find(
                    (component) =>
                        String(component.codename) ===
                        widget.slotByKey.get(slot)?.requirements.components.find(({ field }) => field === relation.field)?.componentCodename
                ) ?? null
        if (
            !relationComponent ||
            String(relationComponent.targetObjectId) !== String(parentObject.id) ||
            String(relationComponent.targetObjectKind) !== String(parentObject.kind) ||
            String(relationComponent.targetObjectCodename) !== String(parentObject.codename) ||
            !['REF', 'UUID'].includes(
                String(relationComponent.dataType ?? '')
                    .trim()
                    .toUpperCase()
            )
        ) {
            return false
        }
    }
    return true
}

export const estimateRecordBudget = (widget: PreparedWidget): number => {
    if (widget.candidate.widgetKey === 'detailsTable' && widget.candidate.config.variant === 'library') {
        const maxRows = widget.candidate.config.maxRows
        return Math.min(typeof maxRows === 'number' ? maxRows : MAX_WIDGET_BINDING_RESOLVED_RECORDS, MAX_WIDGET_BINDING_RESOLVED_RECORDS)
    }

    let estimate = 0
    for (const { slot, target } of widget.targets) {
        const definition = widget.slotByKey.get(slot)
        if (!definition) return Number.POSITIVE_INFINITY
        const perTarget =
            target.selector.kind === 'semantic-key'
                ? 1
                : Math.min(definition.maxResolvedRecords ?? MAX_WIDGET_BINDING_RESOLVED_RECORDS, MAX_WIDGET_BINDING_RESOLVED_RECORDS)
        estimate += perTarget
    }
    return estimate
}
