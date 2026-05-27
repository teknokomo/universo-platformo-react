import { useQuery } from '@tanstack/react-query'
import { SHARED_OBJECT_KINDS, type SharedObjectKind } from '@universo-react/types'
import { apiClient, metahubsQueryKeys } from '..'

type SharedContainerResponseItem = {
    kind: SharedObjectKind
    objectId: string
}

type SharedContainersResponse = {
    items: SharedContainerResponseItem[]
}

export type SharedContainerIds = Partial<Record<SharedObjectKind, string>>

const listSharedContainers = async (metahubId: string): Promise<SharedContainerIds> => {
    const response = await apiClient.post<SharedContainersResponse>(`/metahub/${metahubId}/shared-containers/ensure`)
    return (response.data.items ?? []).reduce<SharedContainerIds>((acc, item) => {
        acc[item.kind] = item.objectId
        return acc
    }, {})
}

export const useSharedContainerIds = (metahubId?: string, enabled = true) =>
    useQuery({
        queryKey: metahubsQueryKeys.sharedContainers(metahubId ?? ''),
        queryFn: () => listSharedContainers(metahubId ?? ''),
        enabled: Boolean(metahubId) && enabled,
        select: (data: SharedContainerIds) => ({
            [SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL]: data[SHARED_OBJECT_KINDS.SHARED_OBJECT_POOL] ?? null,
            [SHARED_OBJECT_KINDS.SHARED_SET_POOL]: data[SHARED_OBJECT_KINDS.SHARED_SET_POOL] ?? null,
            [SHARED_OBJECT_KINDS.SHARED_ENUM_POOL]: data[SHARED_OBJECT_KINDS.SHARED_ENUM_POOL] ?? null
        })
    })
