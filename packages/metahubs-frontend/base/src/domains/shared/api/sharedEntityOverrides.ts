import type { SharedEntityKind } from '@universo/types'
import { apiClient } from '..'

export interface SharedEntityOverride {
    id: string
    entityKind: SharedEntityKind
    sharedEntityId: string
    targetObjectId: string
    isExcluded: boolean
    isActive: boolean | null
    sortOrder: number | null
    version: number
}

type SharedEntityOverridesResponse = {
    items: SharedEntityOverride[]
}

type SharedEntityOverrideResponse = {
    item: SharedEntityOverride | null
}

export const listSharedEntityOverridesByEntity = async (
    metahubId: string,
    entityKind: SharedEntityKind,
    sharedEntityId: string
): Promise<SharedEntityOverride[]> => {
    const response = await apiClient.get<SharedEntityOverridesResponse>(`/metahub/${metahubId}/shared-entity-overrides`, {
        params: {
            entityKind,
            sharedEntityId
        }
    })

    return response.data.items ?? []
}

export const upsertSharedEntityOverride = async (
    metahubId: string,
    data: {
        entityKind: SharedEntityKind
        sharedEntityId: string
        targetObjectId: string
        isExcluded?: boolean
        isActive?: boolean | null
        sortOrder?: number | null
    }
): Promise<SharedEntityOverride | null> => {
    const response = await apiClient.patch<SharedEntityOverrideResponse>(`/metahub/${metahubId}/shared-entity-overrides`, data)
    return response.data.item ?? null
}
