import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import type { BindingComponentRow, BindingObjectRow } from './widgetBindingsStore'
import { relationReferenceRequirement } from './widgetBindingValidation'

export const relationTargetMatchesParent = (
    components: readonly BindingComponentRow[],
    slot: WidgetBindingSlotDefinition,
    parent: Pick<BindingObjectRow, 'id' | 'kind' | 'codename'>
): boolean => {
    const reference = relationReferenceRequirement(slot)
    const component = components.find(({ codename }) => codename === reference.componentCodename)
    return (
        component !== undefined &&
        ['REF', 'UUID'].includes(component.data_type.trim().toUpperCase()) &&
        component.target_object_id === parent.id &&
        component.target_object_kind === parent.kind &&
        component.target_object_codename === parent.codename
    )
}
