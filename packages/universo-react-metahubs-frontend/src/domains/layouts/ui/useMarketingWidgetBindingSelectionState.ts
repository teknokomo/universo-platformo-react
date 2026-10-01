import { useCallback } from 'react'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import type { DraftBinding } from './marketingWidgetBindingDialogModel'

type BindingFocusTarget = { slotKey: string; control: 'source' | 'record' }

const getInvalidSlotControl = (
    slot: WidgetBindingSlotDefinition,
    draftBindings: Record<string, DraftBinding>
): BindingFocusTarget['control'] | undefined => {
    const draft = draftBindings[slot.key]
    if (!draft) return slot.cardinality.min > 0 ? 'source' : undefined
    if (draft.selectorKind === 'semantic-key' && !draft.semanticKey) return 'record'
    if (slot.relation && !draftBindings[slot.relation.parentSlot]) return 'source'
    return undefined
}

type UseMarketingWidgetBindingSelectionStateParams = {
    slots: readonly WidgetBindingSlotDefinition[]
    draftBindings: Record<string, DraftBinding>
    incompatibleRelationSlot: WidgetBindingSlotDefinition | undefined
    relationChecksReady: boolean
    setActiveSlotKey: (slotKey: string) => void
    setFocusTarget: (target: BindingFocusTarget | null) => void
}

export function useMarketingWidgetBindingSelectionState({
    slots,
    draftBindings,
    incompatibleRelationSlot,
    relationChecksReady,
    setActiveSlotKey,
    setFocusTarget
}: UseMarketingWidgetBindingSelectionStateParams) {
    const missingRequiredSlots = slots.filter((slot) => getInvalidSlotControl(slot, draftBindings) !== undefined)
    const isSelectionValid = missingRequiredSlots.length === 0 && slots.length > 0 && !incompatibleRelationSlot && relationChecksReady

    const focusFirstInvalidSlot = useCallback(() => {
        const slot = slots.find((candidate) => getInvalidSlotControl(candidate, draftBindings) !== undefined) ?? incompatibleRelationSlot
        if (!slot) return
        const control = getInvalidSlotControl(slot, draftBindings) ?? 'source'
        setActiveSlotKey(slot.key)
        setFocusTarget({ slotKey: slot.key, control })
    }, [draftBindings, incompatibleRelationSlot, setActiveSlotKey, setFocusTarget, slots])

    return { missingRequiredSlots, isSelectionValid, focusFirstInvalidSlot }
}
