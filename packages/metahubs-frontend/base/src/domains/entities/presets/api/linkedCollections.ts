import { apiClient } from '../../../shared'
import {
    LinkedCollectionEntity,
    LinkedCollectionLocalizedPayload,
    PaginationParams,
    PaginatedResponse,
    TreeEntityRef
} from '../../../../types'
import type { LinkedCollectionCopyOptions, VersionedLocalizedContent } from '@universo/types'
import { normalizeCatalogRecordBehavior, normalizeLedgerConfig } from '@universo/types'

type EntityInstancePaginationParams = PaginationParams & { kindKey?: string }

const resolveCatalogKindKey = (kindKey?: string) => kindKey?.trim() || 'catalog'

const buildLinkedCollectionInstancesPath = (metahubId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCatalogKindKey(kindKey))}/instances`

const buildLinkedCollectionInstancePath = (metahubId: string, linkedCollectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCatalogKindKey(kindKey))}/instance/${linkedCollectionId}`

const buildContainerScopedLinkedCollectionPath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCatalogKindKey(kindKey))}/instance/${treeEntityId}`

const buildLinkedCollectionConfig = (params: {
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
        ...(recordBehavior !== undefined ? { recordBehavior: normalizeCatalogRecordBehavior(recordBehavior) } : {}),
        ...(ledgerConfig !== undefined && ledgerConfig !== null ? { ledger: normalizeLedgerConfig(ledgerConfig) } : {})
    }

    return Object.keys(config).length > 0 ? config : undefined
}

/**
 * LinkedCollectionEntity with parent treeEntities info (for "all linkedCollections" view)
 * Uses the same treeEntities array as the LinkedCollectionEntity type
 */
export interface LinkedCollectionWithContainers extends LinkedCollectionEntity {
    treeEntities: TreeEntityRef[]
}

export interface BlockingLinkedCollectionReference {
    sourceLinkedCollectionId: string
    sourceCatalogCodename: string
    sourceCatalogName: VersionedLocalizedContent<string> | null
    fieldDefinitionId: string
    attributeCodename: string
    attributeName: VersionedLocalizedContent<string> | null
}

export interface BlockingLinkedCollectionReferencesResponse {
    linkedCollectionId: string
    blockingReferences: BlockingLinkedCollectionReference[]
    canDelete: boolean
}

/**
 * List all linkedCollections in a metahub (owner-level view)
 */
export const listAllLinkedCollections = async (
    metahubId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<LinkedCollectionWithContainers>> => {
    const response = await apiClient.get<{
        items: LinkedCollectionWithContainers[]
        pagination: { total: number; limit: number; offset: number }
    }>(buildLinkedCollectionInstancesPath(metahubId, params?.kindKey), {
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
 * List linkedCollections for a specific hub (via junction table)
 */
export const listLinkedCollections = async (
    metahubId: string,
    treeEntityId: string,
    params?: EntityInstancePaginationParams
): Promise<PaginatedResponse<LinkedCollectionEntity>> => {
    const response = await apiClient.get<{ items: LinkedCollectionEntity[]; pagination: { total: number; limit: number; offset: number } }>(
        `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, params?.kindKey)}/instances`,
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
 * Get a single catalog (with its hub associations)
 */
export const getLinkedCollection = async (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    kindKey?: string
): Promise<LinkedCollectionEntity> => {
    const response = await apiClient.get<LinkedCollectionEntity>(
        `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, kindKey)}/instance/${linkedCollectionId}`
    )
    return response.data
}

/**
 * Get a single catalog by ID (owner-level, no hub required)
 * Returns catalog with all associated treeEntities
 */
export const getLinkedCollectionById = async (
    metahubId: string,
    linkedCollectionId: string,
    kindKey?: string
): Promise<LinkedCollectionWithContainers> => {
    const response = await apiClient.get<LinkedCollectionWithContainers>(
        buildLinkedCollectionInstancePath(metahubId, linkedCollectionId, kindKey)
    )
    return response.data
}

/**
 * Create a new catalog at metahub level (can have 0+ hub associations)
 * Used when creating linkedCollections from the global linkedCollections list
 */
export const createLinkedCollectionAtMetahub = (
    metahubId: string,
    data: LinkedCollectionLocalizedPayload & {
        sortOrder?: number
        treeEntityIds?: string[]
        isSingleHub?: boolean
        isRequiredHub?: boolean
        ledgerConfig?: unknown | null
        kindKey?: string
    }
) => {
    const { kindKey, sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig, ...payload } = data

    return apiClient.post<LinkedCollectionEntity>(buildLinkedCollectionInstancesPath(metahubId, kindKey), {
        ...payload,
        kind: resolveCatalogKindKey(kindKey),
        config: buildLinkedCollectionConfig({
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
 * Create a new catalog and associate with hub(s) - hub-scoped endpoint
 */
export const createLinkedCollection = (
    metahubId: string,
    treeEntityId: string,
    data: LinkedCollectionLocalizedPayload & { sortOrder?: number; ledgerConfig?: unknown | null; kindKey?: string }
) =>
    apiClient.post<LinkedCollectionEntity>(
        `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, data.kindKey)}/instances`,
        data
    )

export type LinkedCollectionCopyInput = LinkedCollectionLocalizedPayload & {
    config?: Record<string, unknown>
    copyFieldDefinitions?: LinkedCollectionCopyOptions['copyFieldDefinitions']
    copyRecords?: LinkedCollectionCopyOptions['copyRecords']
}

export const copyLinkedCollection = (metahubId: string, linkedCollectionId: string, data: LinkedCollectionCopyInput, kindKey?: string) =>
    apiClient.post<LinkedCollectionEntity>(`${buildLinkedCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/copy`, data)

export const reorderLinkedCollection = (
    metahubId: string,
    linkedCollectionId: string,
    newSortOrder: number,
    treeEntityId?: string,
    kindKey?: string
) =>
    apiClient.patch<LinkedCollectionEntity>(
        treeEntityId
            ? `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, kindKey)}/instances/reorder`
            : `${buildLinkedCollectionInstancesPath(metahubId, kindKey)}/reorder`,
        {
            linkedCollectionId,
            newSortOrder
        }
    )

/**
 * Update a catalog (including hub associations via treeEntityIds array)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateLinkedCollection = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    data: Partial<LinkedCollectionLocalizedPayload> & {
        sortOrder?: number
        ledgerConfig?: unknown | null
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<LinkedCollectionEntity>(
        `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, data.kindKey)}/instance/${linkedCollectionId}`,
        data
    )

/**
 * Update a catalog at metahub level (for linkedCollections without hub or with multiple treeEntities)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateLinkedCollectionAtMetahub = (
    metahubId: string,
    linkedCollectionId: string,
    data: Partial<LinkedCollectionLocalizedPayload> & {
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

    return apiClient.patch<LinkedCollectionEntity>(buildLinkedCollectionInstancePath(metahubId, linkedCollectionId, kindKey), {
        ...payload,
        config: buildLinkedCollectionConfig({ sortOrder, treeEntityIds, isSingleHub, isRequiredHub, recordBehavior, ledgerConfig })
    })
}

/**
 * Delete a catalog or remove from hub
 * If catalog is associated with multiple treeEntities and force=false, only removes from this hub
 * If force=true or single hub, deletes the entire catalog
 */
export const deleteLinkedCollection = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    force = false,
    kindKey?: string
) =>
    apiClient.delete<void | { message: string; remainingTreeEntities: number }>(
        `${buildContainerScopedLinkedCollectionPath(metahubId, treeEntityId, kindKey)}/instance/${linkedCollectionId}`,
        {
            params: force ? { force: 'true' } : undefined
        }
    )

/**
 * Delete a catalog directly (without requiring treeEntityId)
 * Use for linkedCollections without hub associations or force delete
 */
export const deleteLinkedCollectionDirect = (metahubId: string, linkedCollectionId: string, kindKey?: string) =>
    apiClient.delete<void>(buildLinkedCollectionInstancePath(metahubId, linkedCollectionId, kindKey))

/**
 * Get cross-catalog REF fieldDefinitions that block deleting this catalog.
 */
export const getBlockingLinkedCollectionReferences = async (
    metahubId: string,
    linkedCollectionId: string,
    kindKey?: string
): Promise<BlockingLinkedCollectionReferencesResponse> => {
    try {
        const response = await apiClient.get<BlockingLinkedCollectionReferencesResponse>(
            `${buildLinkedCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/blocking-references`
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
