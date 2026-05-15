import { apiClient } from '../../../shared'
import { ValueGroupEntity, ValueGroupLocalizedPayload, PaginationParams, PaginatedResponse, TreeEntityRef } from '../../../../types'
import type { ValueGroupCopyOptions, VersionedLocalizedContent } from '@universo/types'

type EntityInstancePaginationParams = PaginationParams & { kindKey?: string }
const resolveSetKindKey = (kindKey?: string) => kindKey?.trim() || 'set'

const buildValueGroupInstancesPath = (metahubId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveSetKindKey(kindKey))}/instances`

const buildValueGroupInstancePath = (metahubId: string, valueGroupId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveSetKindKey(kindKey))}/instance/${valueGroupId}`

const buildContainerScopedValueGroupPath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveSetKindKey(kindKey))}/instance/${treeEntityId}`

const buildValueGroupConfig = (params: {
    sortOrder?: number
    treeEntityIds?: string[]
    isSingleHub?: boolean
    isRequiredHub?: boolean
}) => {
    const { sortOrder, treeEntityIds, isSingleHub, isRequiredHub } = params
    const config: Record<string, unknown> = {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(treeEntityIds !== undefined ? { hubs: treeEntityIds } : {}),
        ...(isSingleHub !== undefined ? { isSingleHub } : {}),
        ...(isRequiredHub !== undefined ? { isRequiredHub } : {})
    }

    return Object.keys(config).length > 0 ? config : undefined
}

/**
 * Set with parent treeEntities info (for "all valueGroups" view)
 * Uses the same treeEntities array as the Set type
 */
export interface ValueGroupWithContainers extends ValueGroupEntity {
    treeEntities: TreeEntityRef[]
}

export interface BlockingValueGroupReference {
    sourceObjectCollectionId: string
    sourceObjectCodename: string
    sourceObjectName: VersionedLocalizedContent<string> | null
    componentId: string
    componentCodename: string
    componentName: VersionedLocalizedContent<string> | null
}

export interface BlockingValueGroupReferencesResponse {
    valueGroupId: string
    blockingReferences: BlockingValueGroupReference[]
    canDelete: boolean
}

/**
 * List all valueGroups in a metahub (owner-level view)
 */
export const listAllValueGroups = async (
    metahubId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<ValueGroupWithContainers>> => {
    const response = await apiClient.get<{
        items: ValueGroupWithContainers[]
        pagination: { total: number; limit: number; offset: number }
    }>(buildValueGroupInstancesPath(metahubId, params?.kindKey), {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

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
 * List valueGroups for a specific hub (via junction table)
 */
export const listValueGroups = async (
    metahubId: string,
    treeEntityId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<ValueGroupEntity>> => {
    const response = await apiClient.get<{ items: ValueGroupEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, params?.kindKey)}/instances`,
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
 * Get a single set (with its hub associations)
 */
export const getValueGroup = async (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    kindKey?: string
): Promise<ValueGroupEntity> => {
    const response = await apiClient.get<ValueGroupEntity>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/instance/${valueGroupId}`
    )
    return response.data
}

/**
 * Get a single set by ID (owner-level, no hub required)
 * Returns set with all associated treeEntities
 */
export const getValueGroupById = async (metahubId: string, valueGroupId: string, kindKey?: string): Promise<ValueGroupWithContainers> => {
    const response = await apiClient.get<ValueGroupWithContainers>(buildValueGroupInstancePath(metahubId, valueGroupId, kindKey))
    return response.data
}

/**
 * Create a new set at metahub level (can have 0+ hub associations)
 * Used when creating valueGroups from the global valueGroups list
 */
export const createValueGroupAtMetahub = (
    metahubId: string,
    data: ValueGroupLocalizedPayload & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        kindKey?: string
    }
) => {
    const { kindKey, sortOrder, treeEntityIds, isSingleHub, isRequiredHub, ...payload } = data

    return apiClient.post<ValueGroupEntity>(buildValueGroupInstancesPath(metahubId, kindKey), {
        ...payload,
        kind: resolveSetKindKey(kindKey),
        config: buildValueGroupConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub })
    })
}

/**
 * Create a new set and associate with hub(s) - hub-scoped endpoint
 */
export const createValueGroup = (
    metahubId: string,
    treeEntityId: string,
    data: ValueGroupLocalizedPayload & { sortOrder?: number; kindKey?: string }
) => apiClient.post<ValueGroupEntity>(`${buildContainerScopedValueGroupPath(metahubId, treeEntityId, data.kindKey)}/instances`, data)

export type ValueGroupCopyInput = ValueGroupLocalizedPayload & {
    copyFixedValues?: ValueGroupCopyOptions['copyFixedValues']
}

export const copyValueGroup = (metahubId: string, valueGroupId: string, data: ValueGroupCopyInput, kindKey?: string) =>
    apiClient.post<ValueGroupEntity>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/copy`, data)

export const reorderValueGroup = (metahubId: string, valueGroupId: string, newSortOrder: number, treeEntityId?: string, kindKey?: string) =>
    apiClient.patch<ValueGroupEntity>(
        treeEntityId
            ? `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/instances/reorder`
            : `${buildValueGroupInstancesPath(metahubId, kindKey)}/reorder`,
        {
            valueGroupId,
            newSortOrder
        }
    )

/**
 * Update a set (including hub associations via treeEntityIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateValueGroup = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    data: Partial<ValueGroupLocalizedPayload> & { sortOrder?: number; expectedVersion?: number },
    kindKey?: string
) =>
    apiClient.patch<ValueGroupEntity>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/instance/${valueGroupId}`,
        data
    )

/**
 * Update a set at metahub level (for valueGroups without hub or with multiple treeEntities)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateValueGroupAtMetahub = (
    metahubId: string,
    valueGroupId: string,
    data: Partial<ValueGroupLocalizedPayload> & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        expectedVersion?: number
    },
    kindKey?: string
) => {
    const { sortOrder, treeEntityIds, isSingleHub, isRequiredHub, ...payload } = data

    return apiClient.patch<ValueGroupEntity>(buildValueGroupInstancePath(metahubId, valueGroupId, kindKey), {
        ...payload,
        config: buildValueGroupConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub })
    })
}

/**
 * Delete a set or remove from hub
 * If set is associated with multiple treeEntities and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire set
 */
export const deleteValueGroup = (metahubId: string, treeEntityId: string, valueGroupId: string, force = false, kindKey?: string) =>
    apiClient.delete<void | { message: string; remainingTreeEntities: number }>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/instance/${valueGroupId}`,
        {
            params: force ? { force: 'true' } : undefined
        }
    )

/**
 * Delete a set directly (without requiring treeEntityId)
 * Use for valueGroups without hub associations or force delete
 */
export const deleteValueGroupDirect = (metahubId: string, valueGroupId: string, kindKey?: string) =>
    apiClient.delete<void>(buildValueGroupInstancePath(metahubId, valueGroupId, kindKey))

/**
 * Get REF components from objectCollections that block deleting this set.
 */
export const getBlockingValueGroupReferences = async (
    metahubId: string,
    valueGroupId: string,
    kindKey?: string
): Promise<BlockingValueGroupReferencesResponse> => {
    const response = await apiClient.get<BlockingValueGroupReferencesResponse>(
        `${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/blocking-references`
    )
    return response.data
}
