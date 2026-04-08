import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SharedEntityKind } from '@universo/types'
import { listSharedEntityOverridesByEntity, upsertSharedEntityOverride } from '../api/sharedEntityOverrides'
import { metahubsQueryKeys } from '../queryKeys'

export const useSharedEntityOverridesByEntity = (metahubId?: string, entityKind?: SharedEntityKind, sharedEntityId?: string | null) =>
    useQuery({
        queryKey:
            metahubId && entityKind && sharedEntityId
                ? metahubsQueryKeys.sharedEntityOverridesByEntity(metahubId, entityKind, sharedEntityId)
                : ['metahubs', 'sharedEntityOverrides', 'empty'],
        queryFn: () => listSharedEntityOverridesByEntity(metahubId!, entityKind!, sharedEntityId!),
        enabled: Boolean(metahubId && entityKind && sharedEntityId)
    })

export const useUpsertSharedEntityOverride = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            metahubId,
            data
        }: {
            metahubId: string
            data: {
                entityKind: SharedEntityKind
                sharedEntityId: string
                targetObjectId: string
                isExcluded?: boolean
                isActive?: boolean | null
                sortOrder?: number | null
            }
        }) => upsertSharedEntityOverride(metahubId, data),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.sharedEntityOverridesByEntity(
                    variables.metahubId,
                    variables.data.entityKind,
                    variables.data.sharedEntityId
                )
            })
        }
    })
}
