import { apiClient } from '../../../../shared'
import { FieldDefinition, FieldDefinitionLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../../../types'
import type { PlatformSystemFieldDefinitionsPolicy } from '@universo/types'
import type { FieldDefinitionCopyOptions } from '@universo/types'

export type FieldDefinitionListScope = 'business' | 'system' | 'all'

type FieldDefinitionListParams = PaginationParams & { locale?: string; scope?: FieldDefinitionListScope; includeShared?: boolean }
type FieldDefinitionListMeta = {
    totalAll?: number
    limit?: number
    limitReached?: boolean
    includeShared?: boolean
    platformSystemFieldDefinitionsPolicy?: PlatformSystemFieldDefinitionsPolicy
}
type FieldDefinitionListResponse = PaginatedResponse<FieldDefinition> & { meta?: FieldDefinitionListMeta }

const resolveCollectionKindKey = (kindKey?: string) => kindKey?.trim() || 'catalog'

const buildCollectionInstancePath = (metahubId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${collectionId}`

const buildContainerScopedCollectionPath = (metahubId: string, containerId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${containerId}/instance`

/**
 * List field definitions for a specific catalog
 */
export const listFieldDefinitions = async (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    params?: FieldDefinitionListParams & { kindKey?: string }
): Promise<FieldDefinitionListResponse> => {
    const response = await apiClient.get<{
        items: FieldDefinition[]
        pagination: { total: number; limit: number; offset: number }
        meta?: FieldDefinitionListMeta
    }>(`${buildContainerScopedCollectionPath(metahubId, treeEntityId, params?.kindKey)}/${linkedCollectionId}/field-definitions`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared
        }
    })

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
        },
        meta: response.data.meta
    }
}

/**
 * Get a single field definition
 */
export const getFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.get<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}`
    )

/**
 * Create a new field definition
 */
export const createFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    data: FieldDefinitionLocalizedPayload & {
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
        kindKey?: string
    }
) =>
    apiClient.post<FieldDefinition>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, data.kindKey)}/${linkedCollectionId}/field-definitions`,
        data
    )

/**
 * Update a field definition
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    data: FieldDefinitionLocalizedPayload & {
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            data.kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}`,
        data
    )

/**
 * Delete a field definition
 */
export const deleteFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.delete<void>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}`
    )

/**
 * Move a field definition within a catalog (reorder)
 */
export const moveFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}/move`,
        {
            direction
        }
    )

export type FieldDefinitionCopyInput = Partial<FieldDefinitionLocalizedPayload> & Partial<FieldDefinitionCopyOptions>

export const copyFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    data: FieldDefinitionCopyInput,
    kindKey?: string
) =>
    apiClient.post<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}/copy`,
        data
    )

// ============ TreeEntity-less API functions (for linkedCollections without hub association) ============

/**
 * List field definitions for a catalog (without treeEntityId)
 */
export const listFieldDefinitionsDirect = async (
    metahubId: string,
    linkedCollectionId: string,
    params?: FieldDefinitionListParams & { kindKey?: string }
): Promise<FieldDefinitionListResponse> => {
    const response = await apiClient.get<{
        items: FieldDefinition[]
        pagination: { total: number; limit: number; offset: number }
        meta?: FieldDefinitionListMeta
    }>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, params?.kindKey)}/field-definitions`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search,
            locale: params?.locale,
            scope: params?.scope,
            includeShared: params?.includeShared
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
        },
        meta: response.data.meta
    }
}

/**
 * Create a field definition (without treeEntityId)
 */
export const createFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    data: FieldDefinitionLocalizedPayload & {
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
        kindKey?: string
    }
) => apiClient.post<FieldDefinition>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, data.kindKey)}/field-definitions`, data)

/**
 * Update a field definition (without treeEntityId)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    data: FieldDefinitionLocalizedPayload & {
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
        expectedVersion?: number
        kindKey?: string
    }
) =>
    apiClient.patch<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, data.kindKey)}/field-definition/${fieldDefinitionId}`,
        data
    )

/**
 * Delete a field definition (without treeEntityId)
 */
export const deleteFieldDefinitionDirect = (metahubId: string, linkedCollectionId: string, fieldDefinitionId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}`)

/**
 * Move a field definition within a catalog (without treeEntityId)
 */
export const moveFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}/move`,
        { direction }
    )

/**
 * Reorder a field definition via DnD (with treeEntityId).
 * Supports same-list reorder and cross-list transfer.
 */
export const reorderFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    newSortOrder: number,
    newParentAttributeId?: string | null,
    mergedOrderIds?: string[],
    autoRenameCodename?: boolean,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${linkedCollectionId}/field-definitions/reorder`,
        {
            fieldDefinitionId,
            newSortOrder,
            ...(newParentAttributeId !== undefined && { newParentAttributeId }),
            ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds }),
            ...(autoRenameCodename && { autoRenameCodename })
        }
    )

/**
 * Reorder a field definition via DnD (without treeEntityId).
 * Supports same-list reorder and cross-list transfer.
 */
export const reorderFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    newSortOrder: number,
    newParentAttributeId?: string | null,
    mergedOrderIds?: string[],
    autoRenameCodename?: boolean,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(`${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definitions/reorder`, {
        fieldDefinitionId,
        newSortOrder,
        ...(newParentAttributeId !== undefined && { newParentAttributeId }),
        ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds }),
        ...(autoRenameCodename && { autoRenameCodename })
    })

export const copyFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    data: FieldDefinitionCopyInput,
    kindKey?: string
) =>
    apiClient.post<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}/copy`,
        data
    )

// ============ Toggle Required API functions ============

/**
 * Toggle required flag for a field definition (with treeEntityId)
 */
export const toggleFieldDefinitionRequired = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    isRequired: boolean,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}/toggle-required`,
        {
            isRequired
        }
    )

/**
 * Toggle required flag for a field definition (without treeEntityId)
 */
export const toggleFieldDefinitionRequiredDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    isRequired: boolean,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}/toggle-required`,
        {
            isRequired
        }
    )

// ============ Display Attribute API functions ============

/**
 * Set a field definition as display attribute for catalog (with treeEntityId)
 */
export const setDisplayFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}/set-display`,
        {}
    )

/**
 * Set a field definition as display attribute for catalog (without treeEntityId)
 */
export const setDisplayFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}/set-display`,
        {}
    )

/**
 * Clear display attribute flag from a field definition (with treeEntityId)
 */
export const clearDisplayFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${fieldDefinitionId}/clear-display`,
        {}
    )

/**
 * Clear display attribute flag from a field definition (without treeEntityId)
 */
export const clearDisplayFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    fieldDefinitionId: string,
    kindKey?: string
) =>
    apiClient.patch<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${fieldDefinitionId}/clear-display`,
        {}
    )

// ============ Child Attribute API functions (TABLE tabular parts) ============

/**
 * List child field definitions of a TABLE field definition (with treeEntityId)
 */
export const listChildFieldDefinitions = async (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    parentAttributeId: string,
    kindKey?: string
): Promise<{ items: FieldDefinition[]; total: number }> => {
    const response = await apiClient.get<{ items: FieldDefinition[]; total: number }>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${linkedCollectionId}/field-definition/${parentAttributeId}/children`
    )
    return response.data
}

/**
 * List child field definitions of a TABLE field definition (without treeEntityId)
 */
export const listChildFieldDefinitionsDirect = async (
    metahubId: string,
    linkedCollectionId: string,
    parentAttributeId: string,
    kindKey?: string
): Promise<{ items: FieldDefinition[]; total: number }> => {
    const response = await apiClient.get<{ items: FieldDefinition[]; total: number }>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition/${parentAttributeId}/children`
    )
    return response.data
}

/**
 * Batch-fetch child field definitions for multiple TABLE parents in a single request.
 * Eliminates N+1 queries when rendering RecordList with TABLE columns.
 */
export const listChildFieldDefinitionsBatch = async (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    parentIds: string[],
    kindKey?: string
): Promise<Record<string, FieldDefinition[]>> => {
    const response = await apiClient.get<{ children: Record<string, FieldDefinition[]> }>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${linkedCollectionId}/field-definitions/children/batch`,
        { params: { parentIds: parentIds.join(',') } }
    )
    return response.data.children
}

/**
 * Batch-fetch child field definitions for multiple TABLE parents (without treeEntityId)
 */
export const listChildFieldDefinitionsBatchDirect = async (
    metahubId: string,
    linkedCollectionId: string,
    parentIds: string[],
    kindKey?: string
): Promise<Record<string, FieldDefinition[]>> => {
    const response = await apiClient.get<{ children: Record<string, FieldDefinition[]> }>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definitions/children/batch`,
        { params: { parentIds: parentIds.join(',') } }
    )
    return response.data.children
}

/**
 * Create a child field definition inside a TABLE field definition (with treeEntityId)
 */
export const createChildFieldDefinition = (
    metahubId: string,
    treeEntityId: string,
    linkedCollectionId: string,
    parentAttributeId: string,
    data: FieldDefinitionLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        kindKey?: string
    }
) =>
    apiClient.post<FieldDefinition>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            data.kindKey
        )}/${linkedCollectionId}/field-definition/${parentAttributeId}/children`,
        data
    )

/**
 * Create a child field definition inside a TABLE field definition (without treeEntityId)
 */
export const createChildFieldDefinitionDirect = (
    metahubId: string,
    linkedCollectionId: string,
    parentAttributeId: string,
    data: FieldDefinitionLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        kindKey?: string
    }
) =>
    apiClient.post<FieldDefinition>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, data.kindKey)}/field-definition/${parentAttributeId}/children`,
        data
    )

// ============ All Field-Definition Codenames (for global scope duplicate checking) ============

export interface FieldDefinitionCodenameEntry {
    id: string
    codename: Record<string, unknown> | string | null
}

/**
 * List ALL field-definition codenames (root + children) for a catalog.
 * Lightweight endpoint used when attributeCodenameScope = 'global'.
 */
export const listAllFieldDefinitionCodenames = async (
    metahubId: string,
    linkedCollectionId: string,
    kindKey?: string
): Promise<{ items: FieldDefinitionCodenameEntry[] }> => {
    const response = await apiClient.get<{ items: FieldDefinitionCodenameEntry[] }>(
        `${buildCollectionInstancePath(metahubId, linkedCollectionId, kindKey)}/field-definition-codenames`
    )
    return response.data
}
