import type { VersionedLocalizedContent } from '@universo/types'

import { apiClient } from '../../shared'
import type { PaginatedResponse, PaginationParams } from '../../../types'

export interface MetahubEntityInstance {
    id: string
    kind: string
    codename: VersionedLocalizedContent<string> | string | null
    name?: VersionedLocalizedContent<string> | null
    description?: VersionedLocalizedContent<string> | null
    config?: Record<string, unknown> | null
    sortOrder?: number
    version?: number
    updatedAt?: string | null
    createdAt?: string | null
    _mhb_deleted?: boolean
    [key: string]: unknown
}

export interface EntityInstancesListParams extends PaginationParams {
    kind: string
    locale?: string
    includeDeleted?: boolean
    onlyDeleted?: boolean
    treeEntityId?: string
}

export interface EntityInstancePayload {
    kind: string
    codename: VersionedLocalizedContent<string> | string | Record<string, unknown>
    name?: Record<string, string>
    namePrimaryLocale?: string
    description?: Record<string, string>
    descriptionPrimaryLocale?: string
    config?: Record<string, unknown>
}

export interface UpdateEntityInstancePayload extends Omit<Partial<EntityInstancePayload>, 'kind'> {
    expectedVersion?: number
}

export interface CopyEntityInstancePayload extends Omit<Partial<EntityInstancePayload>, 'kind'> {
    copyFieldDefinitions?: boolean
    copyRecords?: boolean
}

type BackendPaginatedResponse<T> = {
    items: T[]
    pagination?: {
        limit?: number
        offset?: number
        total?: number
        hasMore?: boolean
    }
}

function toPaginatedResponse<T>(response: BackendPaginatedResponse<T>): PaginatedResponse<T> {
    const items = response.items ?? []
    const pagination = response.pagination ?? {}

    return {
        items,
        pagination: {
            limit: pagination.limit ?? 100,
            offset: pagination.offset ?? 0,
            count: items.length,
            total: pagination.total ?? items.length,
            hasMore: pagination.hasMore ?? false
        }
    }
}

export const listEntityInstances = async (
    metahubId: string,
    params: EntityInstancesListParams
): Promise<PaginatedResponse<MetahubEntityInstance>> => {
    const response = await apiClient.get<BackendPaginatedResponse<MetahubEntityInstance>>(`/metahub/${metahubId}/entities`, {
        params: {
            kind: params.kind,
            limit: params.limit,
            offset: params.offset,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            search: params.search,
            locale: params.locale,
            includeDeleted: params.includeDeleted,
            onlyDeleted: params.onlyDeleted,
            treeEntityId: params.treeEntityId
        }
    })

    return toPaginatedResponse(response.data)
}

export const getEntityInstance = async (metahubId: string, entityId: string): Promise<MetahubEntityInstance> => {
    const response = await apiClient.get<MetahubEntityInstance>(`/metahub/${metahubId}/entity/${entityId}`)
    return response.data
}

export const createEntityInstance = (metahubId: string, data: EntityInstancePayload) =>
    apiClient.post<MetahubEntityInstance>(`/metahub/${metahubId}/entities`, data)

export const updateEntityInstance = (metahubId: string, entityId: string, data: UpdateEntityInstancePayload) =>
    apiClient.patch<MetahubEntityInstance>(`/metahub/${metahubId}/entity/${entityId}`, data)

export const deleteEntityInstance = (metahubId: string, entityId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/entity/${entityId}`)

export const restoreEntityInstance = (metahubId: string, entityId: string) =>
    apiClient.post<void>(`/metahub/${metahubId}/entity/${entityId}/restore`)

export const permanentlyDeleteEntityInstance = (metahubId: string, entityId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/entity/${entityId}/permanent`)

export const copyEntityInstance = (metahubId: string, entityId: string, data: CopyEntityInstancePayload) =>
    apiClient.post<MetahubEntityInstance>(`/metahub/${metahubId}/entity/${entityId}/copy`, data)

export const reorderEntityInstances = (metahubId: string, kind: string, entityId: string, newSortOrder: number) =>
    apiClient.post<MetahubEntityInstance>(`/metahub/${metahubId}/entities/reorder`, {
        kind,
        entityId,
        newSortOrder
    })
