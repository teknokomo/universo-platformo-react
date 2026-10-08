import { useCallback } from 'react'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import type { MarketingWidgetRecordCopyIntent } from '../api'
import type { DraftBinding } from './marketingWidgetBindingDialogModel'
import { findRecordBySemanticKey } from './marketingWidgetBindingRecordLookup'

type UseMarketingWidgetBindingRecordCopyParams = {
    metahubId: string
    shouldCloneRecord: boolean
    slots: readonly WidgetBindingSlotDefinition[]
    sourceEntity: { id: string } | null
    sourceEntityKind?: 'object' | 'page'
    treeEntityId: string | null
}

export type MarketingWidgetRecordCopyResult = {
    selections: Record<string, DraftBinding>
    recordCopy?: MarketingWidgetRecordCopyIntent
}

/** Resolve the source record; the authenticated backend copies it with its new placement transactionally. */
export function useMarketingWidgetBindingRecordCopy({
    metahubId,
    shouldCloneRecord,
    slots,
    sourceEntity,
    sourceEntityKind,
    treeEntityId
}: UseMarketingWidgetBindingRecordCopyParams) {
    return useCallback(
        async (selections: Record<string, DraftBinding>): Promise<MarketingWidgetRecordCopyResult> => {
            if (!shouldCloneRecord) return { selections }
            const slot = slots.find(
                (candidate) => candidate.selectorKinds.includes('semantic-key') && selections[candidate.key]?.semanticKey
            )
            const selected = slot ? selections[slot.key] : undefined
            const keyRequirement = slot?.requirements.components.find(({ semanticKey }) => semanticKey)
            if (!slot || !selected?.semanticKey || !keyRequirement || !treeEntityId || !sourceEntity) {
                throw new Error('MARKETING_WIDGET_CLONE_SOURCE_UNAVAILABLE')
            }

            const sourceRecord = await findRecordBySemanticKey(
                metahubId,
                treeEntityId,
                sourceEntity.id,
                keyRequirement.componentCodename,
                selected.semanticKey,
                sourceEntityKind
            )

            return {
                selections,
                recordCopy: {
                    entityId: sourceEntity.id,
                    recordId: sourceRecord.id,
                    sourceKey: selected.sourceKey,
                    sourceSemanticKey: selected.semanticKey,
                    slot: slot.key
                }
            }
        },
        [metahubId, shouldCloneRecord, slots, sourceEntity, sourceEntityKind, treeEntityId]
    )
}
