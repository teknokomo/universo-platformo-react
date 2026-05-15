import { apiClient } from '../../../shared'
import {
    ObjectCollectionEntity,
    ObjectCollectionLocalizedPayload,
    PaginationParams,
    PaginatedResponse,
    TreeEntityRef
} from '../../../../types'
import type { ObjectCollectionCopyOptions, VersionedLocalizedContent } from '@universo/types'
import { normalizeObjectRecordBehavior, normalizeLedgerConfig } from '@universo/types'

type EntityInstancePaginationParams = PaginationParams & { kindKey?: string }

const resolveObjectKindKey = (kindKey?: string) => kindKey?.trim() || 'object'

const buildObjectCollectionInstancesPath = (metahubId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveObjectKindKey(kindKey))}/instances`

const buildObjectCollectionInstancePath = (metahubId: string, objectCollectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveObjectKindKey(kindKey))}/instance/${objectCollectionId}`

const buildContainerScopedObjectCollectionPath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveObjectKindKey(kindKey))}/instance/${treeEntityId}`

const buildObjectCollectionConfig = (params: {
    sortOrder?: number
    treeEntityIds?: string[]
    isSingleHub?: boolean
    isRequiredHub?: boolean
    recordBehavior?: unknown
    ledgerConfig?: unknown | null
}) => {
    const { sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig } = params
    const config: Record<string, unknown> = {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(treeEntityIds !== undefined ? { hubs: treeEntityIds } : {}),
        ...(isSingleHub !== undefined ? { isSingleHub } : {}),
        ...(isRequiredHub !== undefined ? { isRequiredHub } : {}),
        ...(recordBehavior !== undefined ? { recordBehavior: normalizeObjectRecordBehavior(recordBehavior) } : {}),
        ...(ledgerConfig !== undefined && ledgerConfig !== null ? { ledger: normalizeLedgerConfig(ledgerConfig) } : {})
    }

    return Object.keys(config).length > 0 ? config : undefined
}

/**
 * ObjectCollectionEntity with parent treeEntities info (for "all objectCollections" view)
 * Uses the same treeEntities array as the ObjectCollectionEntity type
 */
export interface ObjectCollectionWithContainers extends ObjectCollectionEntity {
    treeEntities: TreeEntityRef[]
}

export interface BlockingObjectCollectionReference {
    sourceObjectCollectionId: string
    sourceObjectCodename: string
    sourceObjectName: VersionedLocalizedContent<string> | null
    componentId: string
    componentCodename: string
    componentName: VersionedLocalizedContent<string> | null
}

export interface BlockingObjectCollectionReferencesResponse {
    objectCollectionId: string
    blockingReferences: BlockingObjectCollectionReference[]
    canDelete: boolean
}

/**
 * List all objectCollections in a metahub (owner-level view)
 */
export const listAllObjectCollections = async (
    metahubId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<ObjectCollectionWithContainers>> => {
    const response = await apiClient.get<{
        items: ObjectCollectionWithContainers[]
        pagination: { total: number; limit: number; offset: number }
    }>(buildObjectCollectionInstancesPath(metahubId, params?.kindKey), {
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
 * List objectCollections for a specific hub (via junction table)
 */
export const listObjectCollections = async (
    metahubId: string,
    treeEntityId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<ObjectCollectionEntity>> => {
    const response = await apiClient.get<{ items: ObjectCollectionEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, params?.kindKey)}/instances`,
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
 * Get a single object (with its hub associations)
 */
export const getObjectCollection = async (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    kindKey?: string
): Promise<ObjectCollectionEntity> => {
    const response = await apiClient.get<ObjectCollectionEntity>(
        `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, kindKey)}/instance/${objectCollectionId}`
    )
    return response.data
}

/**
 * Get a single object by ID (owner-level, no hub required)
 * Returns object with all associated treeEntities
 */
export const getObjectCollectionById = async (
    metahubId: string,
    objectCollectionId: string,
    kindKey?: string
): Promise<ObjectCollectionWithContainers> => {
    const response = await apiClient.get<ObjectCollectionWithContainers>(
        buildObjectCollectionInstancePath(metahubId, objectCollectionId, kindKey)
    )
    return response.data
}

/**
 * Create a new object at metahub level (can have 0+ hub associations)
 * Used when creating objectCollections from the global objectCollections list
 */
export const createObjectCollectionAtMetahub = (
    metahubId: string,
    data: ObjectCollectionLocalizedPayload & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        ledgerConfig?: unknown | null
        kindKey?: string
    }
) => {
    const { kindKey, sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig, ...payload } = data

    return apiClient.post<ObjectCollectionEntity>(buildObjectCollectionInstancesPath(metahubId, kindKey), {
        ...payload,
        kind: resolveObjectKindKey(kindKey),
        config: buildObjectCollectionConfig({
            sortOrder,
            treeEntityIds,
            isSingleHub,
            isRequiredHub,
            recordBehavior,
            ledgerConfig
        })
    })
}

/**
 * Create a new object and associate with hub(s) - hub-scoped endpoint
 */
export const createObjectCollection = (
    metahubId: string,
    treeEntityId: string,
    data: ObjectCollectionLocalizedPayload & { sortOrder?: number; ledgerConfig?: unknown | null; kindKey?: string }
) =>
    apiClient.post<ObjectCollectionEntity>(
        `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, data.kindKey)}/instances`,
        data
    )

export type ObjectCollectionCopyInput = ObjectCollectionLocalizedPayload & {
    config?: Record<string, unknown>
    copyComponents?: ObjectCollectionCopyOptions['copyComponents']
    copyRecords?: ObjectCollectionCopyOptions['copyRecords']
}

export const copyObjectCollection = (metahubId: string, objectCollectionId: string, data: ObjectCollectionCopyInput, kindKey?: string) =>
    apiClient.post<ObjectCollectionEntity>(`${buildObjectCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/copy`, data)

export const reorderObjectCollection = (
    metahubId: string,
    objectCollectionId: string,
    newSortOrder: number,
    treeEntityId?: string,
    kindKey?: string
) =>
    apiClient.patch<ObjectCollectionEntity>(
        treeEntityId
            ? `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, kindKey)}/instances/reorder`
            : `${buildObjectCollectionInstancesPath(metahubId, kindKey)}/reorder`,
        {
            objectCollectionId,
            newSortOrder
        }
    )

/**
 * Update a object (including hub associations via treeEntityIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateObjectCollection = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    data: Partial<ObjectCollectionLocalizedPayload> & {
        sortOrder?: number
        ledgerConfig?: unknown | null
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<ObjectCollectionEntity>(
        `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, data.kindKey)}/instance/${objectCollectionId}`,
        data
    )

/**
 * Update a object at metahub level (for objectCollections without hub or with multiple treeEntities)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateObjectCollectionAtMetahub = (
    metahubId: string,
    objectCollectionId: string,
    data: Partial<ObjectCollectionLocalizedPayload> & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        ledgerConfig?: unknown | null
        expectedVersion?: number
        kindKey?: string
    }
) => {
    const { kindKey, sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig, ...payload } = data

    return apiClient.patch<ObjectCollectionEntity>(buildObjectCollectionInstancePath(metahubId, objectCollectionId, kindKey), {
        ...payload,
        config: buildObjectCollectionConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig })
    })
}

/**
 * Delete a object or remove from hub
 * If object is associated with multiple treeEntities and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire object
 */
export const deleteObjectCollection = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    force = false,
    kindKey?: string
) =>
    apiClient.delete<void | { message: string; remainingTreeEntities: number }>(
        `${buildContainerScopedObjectCollectionPath(metahubId, treeEntityId, kindKey)}/instance/${objectCollectionId}`,
        {
            params: force ? { force: 'true' } : undefined
        }
    )

/**
 * Delete a object directly (without requiring treeEntityId)
 * Use for objectCollections without hub associations or force delete
 */
export const deleteObjectCollectionDirect = (metahubId: string, objectCollectionId: string, kindKey?: string) =>
    apiClient.delete<void>(buildObjectCollectionInstancePath(metahubId, objectCollectionId, kindKey))

/**
 * Get cross-object REF components that block deleting this object.
 */
export const getBlockingObjectCollectionReferences = async (
    metahubId: string,
    objectCollectionId: string,
    kindKey?: string
): Promise<BlockingObjectCollectionReferencesResponse> => {
    try {
        const response = await apiClient.get<BlockingObjectCollectionReferencesResponse>(
            `${buildObjectCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/blocking-references`
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
