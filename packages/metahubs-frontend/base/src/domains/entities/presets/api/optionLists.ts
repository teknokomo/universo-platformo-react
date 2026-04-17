import { apiClient } from '../../../shared'
import {
    OptionListEntity,
    OptionListLocalizedPayload,
    OptionValue,
    OptionValueLocalizedPayload,
    PaginationParams,
    PaginatedResponse,
    TreeEntityRef
} from '../../../../types'
import type { OptionListCopyOptions, VersionedLocalizedContent } from '@universo/types'

type EntityInstancePaginationParams = PaginationParams & { kindKey?: string }

const buildKindKeyParams = (kindKey?: string) => (kindKey ? { kindKey } : undefined)

const resolveEnumerationKindKey = (kindKey?: string) => kindKey?.trim() || 'enumeration'

const buildOptionListInstancesPath = (metahubId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveEnumerationKindKey(kindKey))}/instances`

const buildOptionListInstancePath = (metahubId: string, optionListId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveEnumerationKindKey(kindKey))}/instance/${optionListId}`

const buildContainerScopedOptionListPath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveEnumerationKindKey(kindKey))}/instance/${treeEntityId}`

const buildOptionListConfig = (params: {
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
 * OptionListEntity with parent treeEntities info (for "all optionLists" view)
 * Uses the same treeEntities array as the OptionListEntity type
 */
export interface OptionListWithContainers extends OptionListEntity {
    treeEntities: TreeEntityRef[]
}

export interface BlockingOptionListReference {
    sourceLinkedCollectionId: string
    sourceCatalogCodename: string
    sourceCatalogName: VersionedLocalizedContent<string> | null
    fieldDefinitionId: string
    attributeCodename: string
    attributeName: VersionedLocalizedContent<string> | null
}

export interface BlockingOptionListReferencesResponse {
    optionListId: string
    blockingReferences: BlockingOptionListReference[]
    canDelete: boolean
}

/**
 * List all optionLists in a metahub (owner-level view)
 */
export const listAllOptionLists = async (
    metahubId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<OptionListWithContainers>> => {
    const response = await apiClient.get<{
        items: OptionListWithContainers[]
        pagination: { total: number; limit: number; offset: number }
    }>(buildOptionListInstancesPath(metahubId, params?.kindKey), {
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
 * List optionLists for a specific hub (via junction table)
 */
export const listOptionLists = async (
    metahubId: string,
    treeEntityId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<OptionListEntity>> => {
    const response = await apiClient.get<{ items: OptionListEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedOptionListPath(metahubId, treeEntityId, params?.kindKey)}/instances`,
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
export const getOptionList = async (
    metahubId: string,
    treeEntityId: string,
    optionListId: string,
    kindKey?: string
): Promise<OptionListEntity> => {
    const response = await apiClient.get<OptionListEntity>(
        `${buildContainerScopedOptionListPath(metahubId, treeEntityId, kindKey)}/instance/${optionListId}`
    )
    return response.data
}

/**
 * Get a single enumeration by ID (owner-level, no hub required)
 * Returns enumeration with all associated treeEntities
 */
export const getOptionListById = async (metahubId: string, optionListId: string, kindKey?: string): Promise<OptionListWithContainers> => {
    const response = await apiClient.get<OptionListWithContainers>(buildOptionListInstancePath(metahubId, optionListId, kindKey))
    return response.data
}

/**
 * Create a new enumeration at metahub level (can have 0+ hub associations)
 * Used when creating optionLists from the global optionLists list
 */
export const createOptionListAtMetahub = (
    metahubId: string,
    data: OptionListLocalizedPayload & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        kindKey?: string
    }
) => {
    const { kindKey, sortOrder, treeEntityIds, isSingleHub, isRequiredHub, ...payload } = data

    return apiClient.post<OptionListEntity>(buildOptionListInstancesPath(metahubId, kindKey), {
        ...payload,
        kind: resolveEnumerationKindKey(kindKey),
        config: buildOptionListConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub })
    })
}

/**
 * Create a new enumeration and associate with hub(s) - hub-scoped endpoint
 */
export const createOptionList = (
    metahubId: string,
    treeEntityId: string,
    data: OptionListLocalizedPayload & { sortOrder?: number; kindKey?: string }
) => apiClient.post<OptionListEntity>(`${buildContainerScopedOptionListPath(metahubId, treeEntityId, data.kindKey)}/instances`, data)

export type OptionListCopyInput = OptionListLocalizedPayload & {
    copyOptionValues?: OptionListCopyOptions['copyOptionValues']
}

export const copyOptionList = (metahubId: string, optionListId: string, data: OptionListCopyInput, kindKey?: string) =>
    apiClient.post<OptionListEntity>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/copy`, data)

export const reorderOptionList = (metahubId: string, optionListId: string, newSortOrder: number, treeEntityId?: string, kindKey?: string) =>
    apiClient.patch<OptionListEntity>(
        treeEntityId
            ? `${buildContainerScopedOptionListPath(metahubId, treeEntityId, kindKey)}/instances/reorder`
            : `${buildOptionListInstancesPath(metahubId, kindKey)}/reorder`,
        { optionListId, newSortOrder },
        undefined
    )

/**
 * Update a enumeration (including hub associations via treeEntityIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateOptionList = (
    metahubId: string,
    treeEntityId: string,
    optionListId: string,
    data: Partial<OptionListLocalizedPayload> & { sortOrder?: number; expectedVersion?: number },
    kindKey?: string
) =>
    apiClient.patch<OptionListEntity>(
        `${buildContainerScopedOptionListPath(metahubId, treeEntityId, kindKey)}/instance/${optionListId}`,
        data
    )

/**
 * Update a enumeration at metahub level (for optionLists without hub or with multiple treeEntities)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateOptionListAtMetahub = (
    metahubId: string,
    optionListId: string,
    data: Partial<OptionListLocalizedPayload> & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        expectedVersion?: number
    },
    kindKey?: string
) => {
    const { sortOrder, treeEntityIds, isSingleHub, isRequiredHub, ...payload } = data

    return apiClient.patch<OptionListEntity>(buildOptionListInstancePath(metahubId, optionListId, kindKey), {
        ...payload,
        config: buildOptionListConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub })
    })
}

/**
 * Delete a enumeration or remove from hub
 * If enumeration is associated with multiple treeEntities and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire enumeration
 */
export const deleteOptionList = (metahubId: string, treeEntityId: string, optionListId: string, force = false, kindKey?: string) =>
    apiClient.delete<void | { message: string; remainingTreeEntities: number }>(
        `${buildContainerScopedOptionListPath(metahubId, treeEntityId, kindKey)}/instance/${optionListId}`,
        {
            params: {
                ...(force ? { force: 'true' } : {})
            }
        }
    )

/**
 * Delete a enumeration directly (without requiring treeEntityId)
 * Use for optionLists without hub associations or force delete
 */
export const deleteOptionListDirect = (metahubId: string, optionListId: string, kindKey?: string) =>
    apiClient.delete<void>(buildOptionListInstancePath(metahubId, optionListId, kindKey))

/**
 * Get cross-enumeration REF fieldDefinitions that block deleting this enumeration.
 */
export const getBlockingOptionListReferences = async (
    metahubId: string,
    optionListId: string,
    kindKey?: string
): Promise<BlockingOptionListReferencesResponse> => {
    try {
        const response = await apiClient.get<BlockingOptionListReferencesResponse>(
            `${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/blocking-references`
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
        throw error
    }
}

export interface OptionValueListResponse {
    items: OptionValue[]
    total: number
    meta?: {
        includeShared?: boolean
    }
}

export interface OptionValueBlockingReferencesResponse {
    valueId: string
    canDelete: boolean
    blockingDefaults: unknown[]
    blockingRecords: unknown[]
}

export const listOptionValues = async (
    metahubId: string,
    optionListId: string,
    params?: { includeShared?: boolean; kindKey?: string }
): Promise<OptionValueListResponse> => {
    const response = await apiClient.get<OptionValueListResponse>(
        `${buildOptionListInstancePath(metahubId, optionListId, params?.kindKey)}/values`,
        {
            params: {
                includeShared: params?.includeShared
            }
        }
    )
    return response.data
}

export const getOptionValue = async (metahubId: string, optionListId: string, valueId: string, kindKey?: string): Promise<OptionValue> => {
    const response = await apiClient.get<OptionValue>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}`)
    return response.data
}

export const getOptionValueBlockingReferences = async (
    metahubId: string,
    optionListId: string,
    valueId: string,
    kindKey?: string
): Promise<OptionValueBlockingReferencesResponse> => {
    const response = await apiClient.get<OptionValueBlockingReferencesResponse>(
        `${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}/blocking-references`
    )
    return response.data
}

export const createOptionValue = (metahubId: string, optionListId: string, data: OptionValueLocalizedPayload, kindKey?: string) =>
    apiClient.post<OptionValue>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/values`, data)

export const updateOptionValue = (
    metahubId: string,
    optionListId: string,
    valueId: string,
    data: Partial<OptionValueLocalizedPayload> & { expectedVersion?: number },
    kindKey?: string
) => apiClient.patch<OptionValue>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}`, data)

export const moveOptionValue = (metahubId: string, optionListId: string, valueId: string, direction: 'up' | 'down', kindKey?: string) =>
    apiClient.patch<OptionValue>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}/move`, { direction })

/**
 * Reorder an enumeration value via DnD to a new sort_order position.
 */
export const reorderOptionValue = (
    metahubId: string,
    optionListId: string,
    valueId: string,
    newSortOrder: number,
    mergedOrderIds?: string[],
    kindKey?: string
) =>
    apiClient.patch<OptionValue>(
        `${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/values/reorder`,
        {
            valueId,
            newSortOrder,
            ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds })
        },
        undefined
    )

export const deleteOptionValue = (metahubId: string, optionListId: string, valueId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}`)

export const copyOptionValue = (metahubId: string, optionListId: string, valueId: string, data?: OptionValueCopyInput, kindKey?: string) =>
    apiClient.post<OptionValue>(`${buildOptionListInstancePath(metahubId, optionListId, kindKey)}/value/${valueId}/copy`, data ?? {})

export type OptionValueCopyInput = Partial<
    Pick<OptionValueLocalizedPayload, 'codename' | 'name' | 'description' | 'namePrimaryLocale' | 'descriptionPrimaryLocale' | 'isDefault'>
>
