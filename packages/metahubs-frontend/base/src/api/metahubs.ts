import apiClient, { extractPaginationMeta } from './apiClient'
import type { Metahub, SysEntity, SysField, UserDataRecord, PaginationParams, PaginatedResponse } from '../types'

export interface MetahubPaginationParams extends PaginationParams {
    showAll?: boolean
}

// ===== Metahubs CRUD =====

function numberFromUnknown(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function buildPaginationMeta(args: { total: number; limit: number; offset: number }): {
    total: number
    limit: number
    offset: number
    hasMore: boolean
} {
    const hasMore = args.offset + args.limit < args.total
    return { ...args, hasMore }
}

function parseListResponse<T>(
    responseData: unknown,
    fallback: { limit: number; offset: number },
    headerMeta: { total: number; limit: number; offset: number }
): PaginatedResponse<T> {
    // 1) Common case: API returns an array
    if (Array.isArray(responseData)) {
        const total = headerMeta.total || responseData.length
        const limit = headerMeta.limit || fallback.limit
        const offset = headerMeta.offset || fallback.offset
        return {
            items: responseData as T[],
            pagination: buildPaginationMeta({ total, limit, offset })
        }
    }

    // 2) API returns an object wrapper: { items, total, limit, offset }
    if (isRecord(responseData)) {
        const itemsCandidate = responseData.items
        const items = Array.isArray(itemsCandidate) ? (itemsCandidate as T[]) : []

        const total =
            headerMeta.total ||
            numberFromUnknown(responseData.total) ||
            (isRecord(responseData.pagination) ? numberFromUnknown(responseData.pagination.total) : undefined) ||
            items.length

        const limit =
            headerMeta.limit ||
            numberFromUnknown(responseData.limit) ||
            (isRecord(responseData.pagination) ? numberFromUnknown(responseData.pagination.limit) : undefined) ||
            fallback.limit

        const offset =
            headerMeta.offset ||
            numberFromUnknown(responseData.offset) ||
            (isRecord(responseData.pagination) ? numberFromUnknown(responseData.pagination.offset) : undefined) ||
            fallback.offset

        return {
            items,
            pagination: buildPaginationMeta({ total, limit, offset })
        }
    }

    // 3) Unknown shape
    return {
        items: [],
        pagination: buildPaginationMeta({ total: 0, limit: fallback.limit, offset: fallback.offset })
    }
}

export const listMetahubs = async (params?: MetahubPaginationParams): Promise<PaginatedResponse<Metahub>> => {
    const response = await apiClient.get<unknown>('/metahubs', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search,
            showAll: params?.showAll
        }
    })

    const headerMeta = extractPaginationMeta(response)
    return parseListResponse<Metahub>(
        response.data,
        { limit: params?.limit ?? headerMeta.limit ?? 100, offset: params?.offset ?? headerMeta.offset ?? 0 },
        { total: headerMeta.total, limit: headerMeta.limit, offset: headerMeta.offset }
    )
}

export const getMetahub = async (id: string): Promise<Metahub> => {
    const response = await apiClient.get<Metahub>(`/metahubs/${id}`)
    return response.data
}

export const createMetahub = async (data: { name: string; description?: string }): Promise<Metahub> => {
    const response = await apiClient.post<Metahub>('/metahubs', data)
    return response.data
}

export const updateMetahub = async (id: string, data: { name?: string; description?: string }): Promise<Metahub> => {
    const response = await apiClient.put<Metahub>(`/metahubs/${id}`, data)
    return response.data
}

export const deleteMetahub = async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/metahubs/${id}`)
}

// ===== Entities CRUD =====

export const listEntities = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<SysEntity>> => {
    const response = await apiClient.get<unknown>(`/metahubs/${metahubId}/entities`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    const headerMeta = extractPaginationMeta(response)
    return parseListResponse<SysEntity>(
        response.data,
        { limit: params?.limit ?? headerMeta.limit ?? 100, offset: params?.offset ?? headerMeta.offset ?? 0 },
        { total: headerMeta.total, limit: headerMeta.limit, offset: headerMeta.offset }
    )
}

export const getEntity = async (metahubId: string, entityId: string): Promise<SysEntity & { fields: SysField[] }> => {
    const response = await apiClient.get<SysEntity & { fields: SysField[] }>(`/metahubs/${metahubId}/entities/${entityId}`)
    return response.data
}

export const createEntity = (
    metahubId: string,
    data: { name: string; codename: string; description?: string; displayConfig?: Record<string, unknown> }
) => apiClient.post<SysEntity>(`/metahubs/${metahubId}/entities`, data).then((r) => r.data)

export const deleteEntity = async (metahubId: string, entityId: string): Promise<void> => {
    await apiClient.delete<void>(`/metahubs/${metahubId}/entities/${entityId}`)
}

// ===== Fields CRUD =====

export const createField = (
    metahubId: string,
    entityId: string,
    data: {
        name: string
        codename: string
        fieldType: string
        required?: boolean
        fieldConfig?: Record<string, unknown>
        sortOrder?: number
    }
) => apiClient.post<SysField>(`/metahubs/${metahubId}/entities/${entityId}/fields`, data)

export const deleteField = async (metahubId: string, entityId: string, fieldId: string): Promise<void> => {
    await apiClient.delete<void>(`/metahubs/${metahubId}/entities/${entityId}/fields/${fieldId}`)
}

// ===== Records CRUD =====

export const listRecords = async (
    metahubId: string,
    entityId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<UserDataRecord>> => {
    const response = await apiClient.get<unknown>(`/metahubs/${metahubId}/entities/${entityId}/records`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortOrder: params?.sortOrder
        }
    })

    const headerMeta = extractPaginationMeta(response)
    return parseListResponse<UserDataRecord>(
        response.data,
        { limit: params?.limit ?? headerMeta.limit ?? 100, offset: params?.offset ?? headerMeta.offset ?? 0 },
        { total: headerMeta.total, limit: headerMeta.limit, offset: headerMeta.offset }
    )
}

export const getRecord = async (metahubId: string, entityId: string, recordId: string): Promise<UserDataRecord> => {
    const response = await apiClient.get<UserDataRecord>(`/metahubs/${metahubId}/entities/${entityId}/records/${recordId}`)
    return response.data
}

export const createRecord = async (
    metahubId: string,
    entityId: string,
    data: { data: Record<string, unknown> }
): Promise<UserDataRecord> => {
    const response = await apiClient.post<UserDataRecord>(`/metahubs/${metahubId}/entities/${entityId}/records`, data)
    return response.data
}

export const updateRecord = async (
    metahubId: string,
    entityId: string,
    recordId: string,
    data: { data: Record<string, unknown> }
): Promise<UserDataRecord> => {
    const response = await apiClient.put<UserDataRecord>(`/metahubs/${metahubId}/entities/${entityId}/records/${recordId}`, data)
    return response.data
}

export const deleteRecord = async (metahubId: string, entityId: string, recordId: string): Promise<void> => {
    await apiClient.delete<void>(`/metahubs/${metahubId}/entities/${entityId}/records/${recordId}`)
}
