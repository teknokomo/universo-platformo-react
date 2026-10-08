import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { WidgetBindingReadDto } from '@universo-react/types'
import { getLayoutWidgetDefinition } from '@universo-react/types'

import { metahubsQueryKeys } from '../../shared'
import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import { getLayoutZoneWidgetBindings } from '../api'

interface UseDashboardContentBindingIdsOptions {
    metahubId?: string
    layoutId?: string
    layout?: MetahubLayout
    placements: readonly MetahubLayoutZoneWidget[]
    locale: string
    enabled: boolean
}

export const hasSingleRecordSemanticBinding = (widgetKey: string, config: unknown, binding?: WidgetBindingReadDto): boolean => {
    const definition = getLayoutWidgetDefinition(widgetKey, config)
    if (definition?.authoring.metahub.contentEditing !== 'single-record' || !binding) return false

    return binding.bindings.some((item) => {
        const slot = definition.bindingSlots?.find(
            (candidate) => candidate.key === item.slot && candidate.selectorKinds.includes('semantic-key')
        )
        return slot !== undefined && item.selectorKind === 'semantic-key' && Boolean(item.semanticKey?.trim())
    })
}

export const useDashboardContentBindingIds = ({
    metahubId,
    layoutId,
    layout,
    placements,
    locale,
    enabled
}: UseDashboardContentBindingIdsOptions): ReadonlySet<string> => {
    const candidates = useMemo(
        () =>
            enabled && layout?.templateKey === 'dashboard' && layoutId
                ? placements.filter((placement) => {
                      if (placement.isInherited || placement.layoutId !== layoutId) return false
                      const definition = getLayoutWidgetDefinition(placement.widgetKey, placement.config)
                      return definition?.authoring.metahub.contentEditing === 'single-record'
                  })
                : [],
        [enabled, layout?.templateKey, layoutId, placements]
    )

    const bindingQueries = useQueries({
        queries: candidates.map((placement) => ({
            queryKey: metahubsQueryKeys.layoutZoneWidgetBinding(metahubId ?? '', layoutId ?? '', placement.id, locale),
            queryFn: async () => {
                if (!metahubId || !layoutId) throw new Error('DASHBOARD_CONTENT_BINDING_CONTEXT_UNAVAILABLE')
                return (await getLayoutZoneWidgetBindings(metahubId, layoutId, placement.id, locale)).data
            },
            enabled: Boolean(enabled && metahubId && layoutId),
            staleTime: 30_000
        }))
    })

    return useMemo(() => {
        const boundPlacementIds = new Set<string>()
        candidates.forEach((placement, index) => {
            if (hasSingleRecordSemanticBinding(placement.widgetKey, placement.config, bindingQueries[index]?.data)) {
                boundPlacementIds.add(placement.id)
            }
        })
        return boundPlacementIds
    }, [bindingQueries, candidates])
}
