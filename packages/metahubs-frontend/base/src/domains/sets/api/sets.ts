import { apiClient } from '../../shared'
import { MetahubSet, SetLocalizedPayload, PaginationParams, PaginatedResponse, HubRef } from '../../../types'
import type { SetCopyOptions, VersionedLocalizedContent } from '@universo/types'

type LegacyCompatiblePaginationParams = PaginationParams & { kindKey?: string }

/**
 * Set with parent hubs info (for "all sets" view)
 * Uses the same hubs array as the Set type
 */
export interface SetWithHubs extends MetahubSet {
    hubs: HubRef[]
}

export interface BlockingSetReference {
    sourceCatalogId: string
    sourceCatalogCodename: string
    sourceCatalogName: VersionedLocalizedContent<string> | null
    attributeId: string
    attributeCodename: string
    attributeName: VersionedLocalizedContent<string> | null
}

export interface BlockingSetReferencesResponse {
    setId: string
    blockingReferences: BlockingSetReference[]
    canDelete: boolean
}

/**
 * List all sets in a metahub (owner-level view)
 */
export const listAllSets = async (metahubId: string, params?: LegacyCompatiblePaginationParams): Promise<PaginatedResponse<SetWithHubs>> => {
    const response = await apiClient.get<{ items: SetWithHubs[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/sets`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                kindKey: params?.kindKey
            }
        }
    )

    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * List sets for a specific hub (via junction table)
 */
export const listSets = async (
    metahubId: string,
    hubId: string,
    params?: LegacyCompatiblePaginationParams
): Promise<PaginatedResponse<MetahubSet>> => {
    const response = await apiClient.get<{ items: MetahubSet[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/sets`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                kindKey: params?.kindKey
            }
        }
    )

    // Backend returns { items, pagination } object
    const backendPagination = response.data.pagination
    return {
        items: response.data.items || [],
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: response.data.items?.length ?? 0,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + (response.data.items?.length ?? 0) < (backendPagination?.total ?? 0)
        }
    }
}

/**
 * Get a single set (with its hub associations)
 */
export const getSet = async (metahubId: string, hubId: string, setId: string): Promise<MetahubSet> => {
    const response = await apiClient.get<MetahubSet>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}`)
    return response.data
}

/**
 * Get a single set by ID (owner-level, no hub required)
 * Returns set with all associated hubs
 */
export const getSetById = async (metahubId: string, setId: string, kindKey?: string): Promise<SetWithHubs> => {
    const response = await apiClient.get<SetWithHubs>(`/metahub/${metahubId}/set/${setId}`, {
        params: kindKey ? { kindKey } : undefined
    })
    return response.data
}

/**
 * Create a new set at metahub level (can have 0+ hub associations)
 * Used when creating sets from the global sets list
 */
export const createSetAtMetahub = (metahubId: string, data: SetLocalizedPayload & { sortOrder?: number; kindKey?: string }) =>
    apiClient.post<MetahubSet>(`/metahub/${metahubId}/sets`, data)

/**
 * Create a new set and associate with hub(s) - hub-scoped endpoint
 */
export const createSet = (metahubId: string, hubId: string, data: SetLocalizedPayload & { sortOrder?: number; kindKey?: string }) =>
    apiClient.post<MetahubSet>(`/metahub/${metahubId}/hub/${hubId}/sets`, data)

export type SetCopyInput = SetLocalizedPayload & {
    copyConstants?: SetCopyOptions['copyConstants']
}

export const copySet = (metahubId: string, setId: string, data: SetCopyInput) =>
    apiClient.post<MetahubSet>(`/metahub/${metahubId}/set/${setId}/copy`, data)

export const reorderSet = (metahubId: string, setId: string, newSortOrder: number, hubId?: string) =>
    apiClient.patch<MetahubSet>(hubId ? `/metahub/${metahubId}/hub/${hubId}/sets/reorder` : `/metahub/${metahubId}/sets/reorder`, {
        setId,
        newSortOrder
    })

/**
 * Update a set (including hub associations via hubIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateSet = (
    metahubId: string,
    hubId: string,
    setId: string,
    data: Partial<SetLocalizedPayload> & { sortOrder?: number; expectedVersion?: number },
    kindKey?: string
) =>
    apiClient.patch<MetahubSet>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}`, data, {
        params: kindKey ? { kindKey } : undefined
    })

/**
 * Update a set at metahub level (for sets without hub or with multiple hubs)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateSetAtMetahub = (
    metahubId: string,
    setId: string,
    data: Partial<SetLocalizedPayload> & { sortOrder?: number; expectedVersion?: number },
    kindKey?: string
) =>
    apiClient.patch<MetahubSet>(`/metahub/${metahubId}/set/${setId}`, data, {
        params: kindKey ? { kindKey } : undefined
    })

/**
 * Delete a set or remove from hub
 * If set is associated with multiple hubs and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire set
 */
export const deleteSet = (metahubId: string, hubId: string, setId: string, force = false) =>
    apiClient.delete<void | { message: string; remainingHubs: number }>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}`, {
        params: force ? { force: 'true' } : undefined
    })

/**
 * Delete a set directly (without requiring hubId)
 * Use for sets without hub associations or force delete
 */
export const deleteSetDirect = (metahubId: string, setId: string) => apiClient.delete<void>(`/metahub/${metahubId}/set/${setId}`)

/**
 * Get REF attributes from catalogs that block deleting this set.
 */
export const getBlockingSetReferences = async (
    metahubId: string,
    setId: string,
    kindKey?: string
): Promise<BlockingSetReferencesResponse> => {
    const response = await apiClient.get<BlockingSetReferencesResponse>(`/metahub/${metahubId}/set/${setId}/blocking-references`, {
        params: kindKey ? { kindKey } : undefined
    })
    return response.data
}
