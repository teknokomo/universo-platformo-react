import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import { provisionWidgetBindingSource, type WidgetBindingSourceOption } from '../api'
import { metahubsQueryKeys } from '../../shared'
import type { DraftBinding } from './marketingWidgetBindingDialogModel'

type UseMarketingWidgetBindingSourceProvisionParams = {
    metahubId: string
    layoutId: string
    widgetKey: string
    locale: 'en' | 'ru'
    variant: string
    activeSlot: WidgetBindingSlotDefinition | undefined
    activeDraft: DraftBinding | undefined
    parentDraft: DraftBinding | undefined
    onSourceChange: (source: WidgetBindingSourceOption | null) => void
}

export function useMarketingWidgetBindingSourceProvision({
    metahubId,
    layoutId,
    widgetKey,
    locale,
    variant,
    activeSlot,
    activeDraft,
    parentDraft,
    onSourceChange
}: UseMarketingWidgetBindingSourceProvisionParams) {
    const queryClient = useQueryClient()
    const [state, setState] = useState({ open: false, name: '', error: false })

    const sourceProvisionMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!activeSlot || !activeDraft) throw new Error('MARKETING_WIDGET_SOURCE_CONTEXT_UNAVAILABLE')
            return (
                await provisionWidgetBindingSource(metahubId, layoutId, widgetKey, activeSlot.key, {
                    locale,
                    templateSourceKey: activeDraft.sourceKey,
                    ...(activeSlot.relation && parentDraft ? { parentSourceKey: parentDraft.sourceKey } : {}),
                    ...(variant ? { variant } : {}),
                    name
                })
            ).data
        },
        onSuccess: async (result) => {
            if (!activeSlot) return
            setState({ open: false, name: '', error: false })
            onSourceChange(result.source)
            await queryClient.invalidateQueries({
                queryKey: [...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId), 'widgetBindingSources', widgetKey, activeSlot.key]
            })
        },
        onError: () => setState((current) => ({ ...current, error: true }))
    })

    const openSourceProvision = () => setState({ open: true, name: '', error: false })

    const closeSourceProvision = () => {
        if (sourceProvisionMutation.isPending) return
        setState({ open: false, name: '', error: false })
    }

    return {
        sourceProvisionMutation,
        sourceProvisionOpen: state.open,
        sourceProvisionName: state.name,
        sourceProvisionError: state.error,
        setSourceProvisionName: (name: string) => setState((current) => ({ ...current, name })),
        setSourceProvisionError: (error: boolean) => setState((current) => ({ ...current, error })),
        openSourceProvision,
        closeSourceProvision
    }
}
