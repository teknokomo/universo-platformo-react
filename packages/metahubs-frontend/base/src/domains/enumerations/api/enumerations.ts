import { apiClient } from '../../shared'
import {
    Enumeration,
    EnumerationLocalizedPayload,
    EnumerationValue,
    EnumerationValueLocalizedPayload,
    PaginationParams,
    PaginatedResponse,
    HubRef
} from '../../../types'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Enumeration with parent hubs info (for "all enumerations" view)
 * Uses the same hubs array as the Enumeration type
 */
export interface EnumerationWithHubs extends Enumeration {
    hubs: HubRef[]
}

export interface BlockingEnumerationReference {
    sourceCatalogId: string
    sourceCatalogCodename: string
    sourceCatalogName: VersionedLocalizedContent<string> | null
    attributeId: string
    attributeCodename: string
    attributeName: VersionedLocalizedContent<string> | null
}

export interface BlockingEnumerationReferencesResponse {
    enumerationId: string
    blockingReferences: BlockingEnumerationReference[]
    canDelete: boolean
}

/**
 * List all enumerations in a metahub (owner-level view)
 */
export const listAllEnumerations = async (
    metahubId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<EnumerationWithHubs>> => {
    const response = await apiClient.get<{ items: EnumerationWithHubs[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/enumerations`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search
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
 * List enumerations for a specific hub (via junction table)
 */
export const listEnumerations = async (
    metahubId: string,
    hubId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<Enumeration>> => {
    const response = await apiClient.get<{ items: Enumeration[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/hub/${hubId}/enumerations`,
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search
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
 * Get a single enumeration (with its hub associations)
 */
export const getEnumeration = async (metahubId: string, hubId: string, enumerationId: string): Promise<Enumeration> => {
    const response = await apiClient.get<Enumeration>(`/metahub/${metahubId}/hub/${hubId}/enumeration/${enumerationId}`)
    return response.data
}

/**
 * Get a single enumeration by ID (owner-level, no hub required)
 * Returns enumeration with all associated hubs
 */
export const getEnumerationById = async (metahubId: string, enumerationId: string): Promise<EnumerationWithHubs> => {
    const response = await apiClient.get<EnumerationWithHubs>(`/metahub/${metahubId}/enumeration/${enumerationId}`)
    return response.data
}

/**
 * Create a new enumeration at metahub level (can have 0+ hub associations)
 * Used when creating enumerations from the global enumerations list
 */
export const createEnumerationAtMetahub = (metahubId: string, data: EnumerationLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Enumeration>(`/metahub/${metahubId}/enumerations`, data)

/**
 * Create a new enumeration and associate with hub(s) - hub-scoped endpoint
 */
export const createEnumeration = (metahubId: string, hubId: string, data: EnumerationLocalizedPayload & { sortOrder?: number }) =>
    apiClient.post<Enumeration>(`/metahub/${metahubId}/hub/${hubId}/enumerations`, data)

/**
 * Update a enumeration (including hub associations via hubIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateEnumeration = (
    metahubId: string,
    hubId: string,
    enumerationId: string,
    data: Partial<EnumerationLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
) => apiClient.patch<Enumeration>(`/metahub/${metahubId}/hub/${hubId}/enumeration/${enumerationId}`, data)

/**
 * Update a enumeration at metahub level (for enumerations without hub or with multiple hubs)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateEnumerationAtMetahub = (
    metahubId: string,
    enumerationId: string,
    data: Partial<EnumerationLocalizedPayload> & { sortOrder?: number; expectedVersion?: number }
) => apiClient.patch<Enumeration>(`/metahub/${metahubId}/enumeration/${enumerationId}`, data)

/**
 * Delete a enumeration or remove from hub
 * If enumeration is associated with multiple hubs and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire enumeration
 */
export const deleteEnumeration = (metahubId: string, hubId: string, enumerationId: string, force = false) =>
    apiClient.delete<void | { message: string; remainingHubs: number }>(`/metahub/${metahubId}/hub/${hubId}/enumeration/${enumerationId}`, {
        params: force ? { force: 'true' } : undefined
    })

/**
 * Delete a enumeration directly (without requiring hubId)
 * Use for enumerations without hub associations or force delete
 */
export const deleteEnumerationDirect = (metahubId: string, enumerationId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/enumeration/${enumerationId}`)

/**
 * Get cross-enumeration REF attributes that block deleting this enumeration.
 */
export const getBlockingEnumerationReferences = async (
    metahubId: string,
    enumerationId: string
): Promise<BlockingEnumerationReferencesResponse> => {
    try {
        const response = await apiClient.get<BlockingEnumerationReferencesResponse>(
            `/metahub/${metahubId}/enumeration/${enumerationId}/blocking-references`
        )
        return response.data
    } catch (error: unknown) {
        const status =
            error &&
            typeof error === 'object' &&
            'response' in error &&
            typeof (error as { response?: { status?: unknown } }).response?.status === 'number'
                ? (error as { response?: { status?: number } }).response?.status ?? undefined
                : undefined
        if (status !== 404) throw error

        const fallbackResponse = await apiClient.get<BlockingEnumerationReferencesResponse>(
            `/metahub/${metahubId}/enumerations/${enumerationId}/blocking-references`
        )
        return fallbackResponse.data
    }
}

export interface EnumerationValuesResponse {
    items: EnumerationValue[]
    total: number
}

export const listEnumerationValues = async (metahubId: string, enumerationId: string): Promise<EnumerationValuesResponse> => {
    const response = await apiClient.get<EnumerationValuesResponse>(`/metahub/${metahubId}/enumeration/${enumerationId}/values`)
    return response.data
}

export const getEnumerationValue = async (metahubId: string, enumerationId: string, valueId: string): Promise<EnumerationValue> => {
    const response = await apiClient.get<EnumerationValue>(`/metahub/${metahubId}/enumeration/${enumerationId}/value/${valueId}`)
    return response.data
}

export const createEnumerationValue = (metahubId: string, enumerationId: string, data: EnumerationValueLocalizedPayload) =>
    apiClient.post<EnumerationValue>(`/metahub/${metahubId}/enumeration/${enumerationId}/values`, data)

export const updateEnumerationValue = (
    metahubId: string,
    enumerationId: string,
    valueId: string,
    data: Partial<EnumerationValueLocalizedPayload> & { expectedVersion?: number }
) => apiClient.patch<EnumerationValue>(`/metahub/${metahubId}/enumeration/${enumerationId}/value/${valueId}`, data)

export const moveEnumerationValue = (metahubId: string, enumerationId: string, valueId: string, direction: 'up' | 'down') =>
    apiClient.patch<EnumerationValue>(`/metahub/${metahubId}/enumeration/${enumerationId}/value/${valueId}/move`, { direction })

export const deleteEnumerationValue = (metahubId: string, enumerationId: string, valueId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/enumeration/${enumerationId}/value/${valueId}`)
