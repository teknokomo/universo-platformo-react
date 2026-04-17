import { apiClient } from '../../../shared'
import { TreeEntity, TreeEntityLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../../types'
import type { TreeEntityCopyOptions, VersionedLocalizedContent } from '@universo/types'

type EntityInstancePaginationParams = PaginationParams & { kindKey?: string }

const resolveHubKindKey = (kindKey?: string) => kindKey?.trim() || 'hub'

const buildTreeEntityInstancesPath = (metahubId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveHubKindKey(kindKey))}/instances`

const buildTreeEntityInstancePath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveHubKindKey(kindKey))}/instance/${treeEntityId}`

const buildTreeEntityConfig = (params: { sortOrder?: number; parentTreeEntityId?: string | null }) => {
    const { sortOrder, parentTreeEntityId } = params
    const config: Record<string, unknown> = {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(parentTreeEntityId !== undefined ? { parentTreeEntityId } : {})
    }

    return Object.keys(config).length > 0 ? config : undefined
}

/**
 * Blocking dependency info returned by the tree blocking endpoint.
 */
export interface BlockingTreeDependency {
    id: string
    name: VersionedLocalizedContent<string>
    codename: string
}

/**
 * Response from the tree blocking endpoint.
 */
export interface BlockingTreeDependencyResponse {
    treeEntityId: string
    blockingLinkedCollections: BlockingTreeDependency[]
    blockingValueGroups: BlockingTreeDependency[]
    blockingOptionLists: BlockingTreeDependency[]
    blockingChildTreeEntities: BlockingTreeDependency[]
    totalBlocking: number
    canDelete: boolean
}

/**
 * List treeEntities for a specific metahub
 */
export const listTreeEntities = async (
    metahubId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<TreeEntity>> => {
    const response = await apiClient.get<{ items: TreeEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        buildTreeEntityInstancesPath(metahubId, params?.kindKey),
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
 * List direct child treeEntities of a parent hub.
 */
export const listChildTreeEntities = async (
    metahubId: string,
    treeEntityId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<TreeEntity>> => {
    const response = await apiClient.get<{ items: TreeEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildTreeEntityInstancePath(metahubId, treeEntityId, params?.kindKey)}/instances`,
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
 * Get a single hub
 */
export const getTreeEntity = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    apiClient.get<TreeEntity>(buildTreeEntityInstancePath(metahubId, treeEntityId, kindKey))

/**
 * Create a new hub
 */
export const createTreeEntity = (
    metahubId: string,
    data: TreeEntityLocalizedPayload & { sortOrder?: number; parentTreeEntityId?: string | null; kindKey?: string }
) => {
    const { kindKey, sortOrder, parentTreeEntityId, ...payload } = data

    return apiClient.post<TreeEntity>(buildTreeEntityInstancesPath(metahubId, kindKey), {
        ...payload,
        kind: resolveHubKindKey(kindKey),
        config: buildTreeEntityConfig({ sortOrder, parentTreeEntityId })
    })
}

export type TreeEntityCopyInput = TreeEntityLocalizedPayload & {
    copyAllRelations?: TreeEntityCopyOptions['copyAllRelations']
    copyLinkedCollectionRelations?: TreeEntityCopyOptions['copyLinkedCollectionRelations']
    copyValueGroupRelations?: TreeEntityCopyOptions['copyValueGroupRelations']
    copyOptionListRelations?: TreeEntityCopyOptions['copyOptionListRelations']
}

export const copyTreeEntity = (metahubId: string, treeEntityId: string, data: TreeEntityCopyInput, kindKey?: string) => {
    const { parentTreeEntityId, ...payload } = data

    return apiClient.post<TreeEntity>(`${buildTreeEntityInstancePath(metahubId, treeEntityId, kindKey)}/copy`, {
        ...payload,
        config: buildTreeEntityConfig({ parentTreeEntityId })
    })
}

export const reorderTreeEntity = (metahubId: string, treeEntityId: string, newSortOrder: number, kindKey?: string) =>
    apiClient.patch<TreeEntity>(`${buildTreeEntityInstancesPath(metahubId, kindKey)}/reorder`, { treeEntityId, newSortOrder })

/**
 * Update a hub
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateTreeEntity = (
    metahubId: string,
    treeEntityId: string,
    data: Partial<TreeEntityLocalizedPayload> & { sortOrder?: number; parentTreeEntityId?: string | null; expectedVersion?: number },
    kindKey?: string
) => {
    const { sortOrder, parentTreeEntityId, ...payload } = data

    return apiClient.patch<TreeEntity>(buildTreeEntityInstancePath(metahubId, treeEntityId, kindKey), {
        ...payload,
        config: buildTreeEntityConfig({ sortOrder, parentTreeEntityId })
    })
}

/**
 * Delete a hub
 */
export const deleteTreeEntity = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    apiClient.delete<void>(buildTreeEntityInstancePath(metahubId, treeEntityId, kindKey))

/**
 * Get objects that would block tree-entity deletion.
 */
export const getBlockingTreeDependencies = async (
    metahubId: string,
    treeEntityId: string,
    kindKey?: string
): Promise<BlockingTreeDependencyResponse> => {
    const response = await apiClient.get<BlockingTreeDependencyResponse>(
        `${buildTreeEntityInstancePath(metahubId, treeEntityId, kindKey)}/blocking-dependencies`
    )
    return response.data
}
