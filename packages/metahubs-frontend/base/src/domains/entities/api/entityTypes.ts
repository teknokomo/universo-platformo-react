import type { ComponentManifest, EntityTypeUIConfig, VersionedLocalizedContent } from '@universo/types'

import { apiClient } from '../../shared'
import type { PaginatedResponse, PaginationParams } from '../../../types'

export interface MetahubEntityType {
    id?: string
    kindKey: string
    components: ComponentManifest
    ui: EntityTypeUIConfig
    codename?: VersionedLocalizedContent<string> | string | null
    presentation?: Record<string, unknown>
    config?: Record<string, unknown>
    published?: boolean
    version?: number
    updatedAt?: string | null
}

export interface EntityTypeListParams extends PaginationParams {}

export interface EntityTypePayload {
    kindKey: string
    codename: VersionedLocalizedContent<string> | string | Record<string, unknown>
    presentation?: Record<string, unknown>
    components: ComponentManifest
    ui: EntityTypeUIConfig
    config?: Record<string, unknown>
    published?: boolean
}

export interface UpdateEntityTypePayload extends Partial<EntityTypePayload> {
    expectedVersion?: number
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

export const listEntityTypes = async (metahubId: string, params?: EntityTypeListParams): Promise<PaginatedResponse<MetahubEntityType>> => {
    const response = await apiClient.get<BackendPaginatedResponse<MetahubEntityType>>(`/metahub/${metahubId}/entity-types`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return toPaginatedResponse(response.data)
}

export const getEntityType = async (metahubId: string, entityTypeId: string): Promise<MetahubEntityType> => {
    const response = await apiClient.get<MetahubEntityType>(`/metahub/${metahubId}/entity-type/${entityTypeId}`)
    return response.data
}

export const createEntityType = (metahubId: string, data: EntityTypePayload) =>
    apiClient.post<MetahubEntityType>(`/metahub/${metahubId}/entity-types`, data)

export const updateEntityType = (metahubId: string, entityTypeId: string, data: UpdateEntityTypePayload) =>
    apiClient.patch<MetahubEntityType>(`/metahub/${metahubId}/entity-type/${entityTypeId}`, data)

export const deleteEntityType = (metahubId: string, entityTypeId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/entity-type/${entityTypeId}`)
