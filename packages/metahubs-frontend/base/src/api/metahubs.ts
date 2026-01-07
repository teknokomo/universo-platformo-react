import apiClient, { extractPaginationMeta } from './apiClient'
import {
    Metahub,
    MetahubMember,
    MetahubAssignableRole,
    PaginationParams,
    PaginatedResponse,
    MetaEntity,
    MetaSection,
    MetahubLocalizedPayload
} from '../types'

// Input type for creating/updating metahubs with localized content
export interface MetahubInput extends MetahubLocalizedPayload {
    slug?: string
    isPublic?: boolean
}

// Extended pagination params with showAll for admin users
export interface MetahubPaginationParams extends PaginationParams {
    showAll?: boolean
}

// ============ METAHUBS ============

export const listMetahubs = async (params?: MetahubPaginationParams): Promise<PaginatedResponse<Metahub>> => {
    const response = await apiClient.get<{ items: Metahub[]; total: number; limit: number; offset: number }>('/metahubs', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search,
            showAll: params?.showAll
        }
    })

    // Backend returns { items, total, limit, offset } in response body
    const { items, total, limit, offset } = response.data
    const count = items.length

    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

export const getMetahub = (id: string) => apiClient.get<Metahub>(`/metahubs/${id}`)

export const createMetahub = (data: MetahubInput) => apiClient.post<Metahub>('/metahubs', data)

export const updateMetahub = (id: string, data: Partial<MetahubInput>) => apiClient.put<Metahub>(`/metahubs/${id}`, data)

export const deleteMetahub = (id: string) => apiClient.delete<void>(`/metahubs/${id}`)

// ============ METAHUB CONTENT (SECTIONS / ENTITIES) ============

export const listMetahubMetaEntities = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetaEntity>> => {
    const response = await apiClient.get<MetaEntity[]>(`/metahubs/${metahubId}/entities`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return {
        items: response.data,
        pagination: extractPaginationMeta(response)
    }
}

export const listMetahubMetaSections = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetaSection>> => {
    const response = await apiClient.get<MetaSection[]>(`/metahubs/${metahubId}/sections`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return {
        items: response.data,
        pagination: extractPaginationMeta(response)
    }
}

// ============ METAHUB MEMBERS ============

export const listMetahubMembers = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubMember>> => {
    const response = await apiClient.get<{ members: MetahubMember[]; total: number; limit?: number; offset?: number }>(
        `/metahubs/${metahubId}/members`,
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

    // Backend returns { members, total } in response body
    const { members, total } = response.data
    const limit = params?.limit ?? 100
    const offset = params?.offset ?? 0
    const count = members.length

    return {
        items: members,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

export const inviteMetahubMember = (metahubId: string, data: { email: string; role: MetahubAssignableRole; comment?: string }) =>
    apiClient.post<MetahubMember>(`/metahubs/${metahubId}/members`, data)

export const updateMetahubMemberRole = (metahubId: string, memberId: string, data: { role: MetahubAssignableRole; comment?: string }) =>
    apiClient.patch<MetahubMember>(`/metahubs/${metahubId}/members/${memberId}`, data)

export const removeMetahubMember = (metahubId: string, memberId: string) =>
    apiClient.delete<void>(`/metahubs/${metahubId}/members/${memberId}`)
