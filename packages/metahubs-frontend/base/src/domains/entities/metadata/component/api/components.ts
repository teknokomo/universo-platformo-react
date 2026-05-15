import { apiClient } from '../../../../shared'
import { Component, ComponentLocalizedPayload, PaginationParams, PaginatedResponse } from '../../../../../types'
import type { PlatformSystemComponentsPolicy } from '@universo/types'
import type { ComponentCopyOptions } from '@universo/types'

export type ComponentListScope = 'business' | 'system' | 'all'

type ComponentListParams = PaginationParams & { locale?: string; scope?: ComponentListScope; includeShared?: boolean }
type ComponentListMeta = {
    totalAll?: number
    limit?: number
    limitReached?: boolean
    includeShared?: boolean
    platformSystemComponentsPolicy?: PlatformSystemComponentsPolicy
}
type ComponentListResponse = PaginatedResponse<Component> & { meta?: ComponentListMeta }

const resolveCollectionKindKey = (kindKey?: string) => kindKey?.trim() || 'object'

const buildCollectionInstancePath = (metahubId: string, collectionId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${collectionId}`

const buildContainerScopedCollectionPath = (metahubId: string, containerId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveCollectionKindKey(kindKey))}/instance/${containerId}/instance`

/**
 * List components for a specific object
 */
export const listComponents = async (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    params?: ComponentListParams & { kindKey?: string }
): Promise<ComponentListResponse> => {
    const response = await apiClient.get<{
        items: Component[]
        pagination: { total: number; limit: number; offset: number }
        meta?: ComponentListMeta
    }>(`${buildContainerScopedCollectionPath(metahubId, treeEntityId, params?.kindKey)}/${objectCollectionId}/components`, {
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
 * Get a single component
 */
export const getComponent = (metahubId: string, treeEntityId: string, objectCollectionId: string, componentId: string, kindKey?: string) =>
    apiClient.get<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/component/${componentId}`
    )

/**
 * Create a new component
 */
export const createComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    data: ComponentLocalizedPayload & {
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
    apiClient.post<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, data.kindKey)}/${objectCollectionId}/components`,
        data
    )

/**
 * Update a component
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    data: ComponentLocalizedPayload & {
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
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, data.kindKey)}/${objectCollectionId}/component/${componentId}`,
        data
    )

/**
 * Delete a component
 */
export const deleteComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    kindKey?: string
) =>
    apiClient.delete<void>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/component/${componentId}`
    )

/**
 * Move a component within a object (reorder)
 */
export const moveComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/component/${componentId}/move`,
        {
            direction
        }
    )

export type ComponentCopyInput = Partial<ComponentLocalizedPayload> & Partial<ComponentCopyOptions>

export const copyComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    data: ComponentCopyInput,
    kindKey?: string
) =>
    apiClient.post<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/component/${componentId}/copy`,
        data
    )

// ============ TreeEntity-less API functions (for objectCollections without hub association) ============

/**
 * List components for a object (without treeEntityId)
 */
export const listComponentsDirect = async (
    metahubId: string,
    objectCollectionId: string,
    params?: ComponentListParams & { kindKey?: string }
): Promise<ComponentListResponse> => {
    const response = await apiClient.get<{
        items: Component[]
        pagination: { total: number; limit: number; offset: number }
        meta?: ComponentListMeta
    }>(`${buildCollectionInstancePath(metahubId, objectCollectionId, params?.kindKey)}/components`, {
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
 * Create a component (without treeEntityId)
 */
export const createComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    data: ComponentLocalizedPayload & {
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
        kindKey?: string
    }
) => apiClient.post<Component>(`${buildCollectionInstancePath(metahubId, objectCollectionId, data.kindKey)}/components`, data)

/**
 * Update a component (without treeEntityId)
 * @param data.expectedVersion - Optional version for optimistic locking. If provided and doesn't match, returns 409 Conflict
 */
export const updateComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    componentId: string,
    data: ComponentLocalizedPayload & {
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
    apiClient.patch<Component>(`${buildCollectionInstancePath(metahubId, objectCollectionId, data.kindKey)}/component/${componentId}`, data)

/**
 * Delete a component (without treeEntityId)
 */
export const deleteComponentDirect = (metahubId: string, objectCollectionId: string, componentId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}`)

/**
 * Move a component within a object (without treeEntityId)
 */
export const moveComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    componentId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<Component>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}/move`, {
        direction
    })

/**
 * Reorder a component via DnD (with treeEntityId).
 * Supports same-list reorder and cross-list transfer.
 */
export const reorderComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    newSortOrder: number,
    newParentComponentId?: string | null,
    mergedOrderIds?: string[],
    autoRenameCodename?: boolean,
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/components/reorder`,
        {
            componentId,
            newSortOrder,
            ...(newParentComponentId !== undefined && { newParentComponentId }),
            ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds }),
            ...(autoRenameCodename && { autoRenameCodename })
        }
    )

/**
 * Reorder a component via DnD (without treeEntityId).
 * Supports same-list reorder and cross-list transfer.
 */
export const reorderComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    componentId: string,
    newSortOrder: number,
    newParentComponentId?: string | null,
    mergedOrderIds?: string[],
    autoRenameCodename?: boolean,
    kindKey?: string
) =>
    apiClient.patch<Component>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/components/reorder`, {
        componentId,
        newSortOrder,
        ...(newParentComponentId !== undefined && { newParentComponentId }),
        ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds }),
        ...(autoRenameCodename && { autoRenameCodename })
    })

export const copyComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    componentId: string,
    data: ComponentCopyInput,
    kindKey?: string
) => apiClient.post<Component>(`${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}/copy`, data)

// ============ Toggle Required API functions ============

/**
 * Toggle required flag for a component (with treeEntityId)
 */
export const toggleComponentRequired = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    isRequired: boolean,
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${objectCollectionId}/component/${componentId}/toggle-required`,
        {
            isRequired
        }
    )

/**
 * Toggle required flag for a component (without treeEntityId)
 */
export const toggleComponentRequiredDirect = (
    metahubId: string,
    objectCollectionId: string,
    componentId: string,
    isRequired: boolean,
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}/toggle-required`,
        {
            isRequired
        }
    )

// ============ Display Component API functions ============

/**
 * Set a component as display component for object (with treeEntityId)
 */
export const setDisplayComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${objectCollectionId}/component/${componentId}/set-display`,
        {}
    )

/**
 * Set a component as display component for object (without treeEntityId)
 */
export const setDisplayComponentDirect = (metahubId: string, objectCollectionId: string, componentId: string, kindKey?: string) =>
    apiClient.patch<Component>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}/set-display`,
        {}
    )

/**
 * Clear display component flag from a component (with treeEntityId)
 */
export const clearDisplayComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    componentId: string,
    kindKey?: string
) =>
    apiClient.patch<Component>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${objectCollectionId}/component/${componentId}/clear-display`,
        {}
    )

/**
 * Clear display component flag from a component (without treeEntityId)
 */
export const clearDisplayComponentDirect = (metahubId: string, objectCollectionId: string, componentId: string, kindKey?: string) =>
    apiClient.patch<Component>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${componentId}/clear-display`,
        {}
    )

// ============ Child Component API functions (TABLE tabular parts) ============

/**
 * List child components of a TABLE component (with treeEntityId)
 */
export const listChildComponents = async (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    parentComponentId: string,
    kindKey?: string
): Promise<{ items: Component[]; total: number }> => {
    const response = await apiClient.get<{ items: Component[]; total: number }>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            kindKey
        )}/${objectCollectionId}/component/${parentComponentId}/children`
    )
    return response.data
}

/**
 * List child components of a TABLE component (without treeEntityId)
 */
export const listChildComponentsDirect = async (
    metahubId: string,
    objectCollectionId: string,
    parentComponentId: string,
    kindKey?: string
): Promise<{ items: Component[]; total: number }> => {
    const response = await apiClient.get<{ items: Component[]; total: number }>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component/${parentComponentId}/children`
    )
    return response.data
}

/**
 * Batch-fetch child components for multiple TABLE parents in a single request.
 * Eliminates N+1 queries when rendering RecordList with TABLE columns.
 */
export const listChildComponentsBatch = async (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    parentIds: string[],
    kindKey?: string
): Promise<Record<string, Component[]>> => {
    const response = await apiClient.get<{ children: Record<string, Component[]> }>(
        `${buildContainerScopedCollectionPath(metahubId, treeEntityId, kindKey)}/${objectCollectionId}/components/children/batch`,
        { params: { parentIds: parentIds.join(',') } }
    )
    return response.data.children
}

/**
 * Batch-fetch child components for multiple TABLE parents (without treeEntityId)
 */
export const listChildComponentsBatchDirect = async (
    metahubId: string,
    objectCollectionId: string,
    parentIds: string[],
    kindKey?: string
): Promise<Record<string, Component[]>> => {
    const response = await apiClient.get<{ children: Record<string, Component[]> }>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/components/children/batch`,
        { params: { parentIds: parentIds.join(',') } }
    )
    return response.data.children
}

/**
 * Create a child component inside a TABLE component (with treeEntityId)
 */
export const createChildComponent = (
    metahubId: string,
    treeEntityId: string,
    objectCollectionId: string,
    parentComponentId: string,
    data: ComponentLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        kindKey?: string
    }
) =>
    apiClient.post<Component>(
        `${buildContainerScopedCollectionPath(
            metahubId,
            treeEntityId,
            data.kindKey
        )}/${objectCollectionId}/component/${parentComponentId}/children`,
        data
    )

/**
 * Create a child component inside a TABLE component (without treeEntityId)
 */
export const createChildComponentDirect = (
    metahubId: string,
    objectCollectionId: string,
    parentComponentId: string,
    data: ComponentLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        targetEntityId?: string | null
        targetEntityKind?: string | null
        targetConstantId?: string | null
        kindKey?: string
    }
) =>
    apiClient.post<Component>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, data.kindKey)}/component/${parentComponentId}/children`,
        data
    )

// ============ All Field-Definition Codenames (for global scope duplicate checking) ============

export interface ComponentCodenameEntry {
    id: string
    codename: Record<string, unknown> | string | null
}

/**
 * List ALL component codenames (root + children) for a object.
 * Lightweight endpoint used when componentCodenameScope = 'global'.
 */
export const listAllComponentCodenames = async (
    metahubId: string,
    objectCollectionId: string,
    kindKey?: string
): Promise<{ items: ComponentCodenameEntry[] }> => {
    const response = await apiClient.get<{ items: ComponentCodenameEntry[] }>(
        `${buildCollectionInstancePath(metahubId, objectCollectionId, kindKey)}/component-codenames`
    )
    return response.data
}
