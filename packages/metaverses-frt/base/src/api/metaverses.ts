import { AxiosResponse } from 'axios'
import apiClient from './apiClient'
import {
    Metaverse,
    Section,
    Entity,
    MetaverseMember,
    MetaverseMembersResponse,
    MetaverseAssignableRole,
    PaginationParams,
    PaginatedResponse,
    PaginationMeta
} from '../types'

// Helper function to extract pagination metadata from response headers
function extractPaginationMeta(response: AxiosResponse): PaginationMeta {
    const headers = response.headers
    return {
        limit: parseInt(headers['x-pagination-limit'] || '100', 10),
        offset: parseInt(headers['x-pagination-offset'] || '0', 10),
        count: parseInt(headers['x-pagination-count'] || '0', 10),
        total: parseInt(headers['x-total-count'] || '0', 10),
        hasMore: headers['x-pagination-has-more'] === 'true'
    }
}

// Updated listMetaverses with pagination support
export const listMetaverses = async (params?: PaginationParams): Promise<PaginatedResponse<Metaverse>> => {
    const response = await apiClient.get<Metaverse[]>('/metaverses', {
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

export const getMetaverse = (id: string) => apiClient.get<Metaverse>(`/metaverses/${id}`)

export const createMetaverse = (data: { name: string; description?: string }) => apiClient.post<Metaverse>('/metaverses', data)

export const updateMetaverse = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Metaverse>(`/metaverses/${id}`, data)

export const deleteMetaverse = (id: string) => apiClient.delete<void>(`/metaverses/${id}`)

// Metaverse-Entity relationships
export const getMetaverseEntities = (metaverseId: string) => apiClient.get<Entity[]>(`/metaverses/${metaverseId}/entities`)

export const addEntityToMetaverse = (metaverseId: string, entityId: string) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/entities/${entityId}`)

export const removeEntityFromMetaverse = (metaverseId: string, entityId: string) =>
    apiClient.delete<void>(`/metaverses/${metaverseId}/entities/${entityId}`)

export const reorderMetaverseEntities = (metaverseId: string, items: Array<{ entityId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/entities/reorder`, { items })

// Metaverse-Section relationships
export const getMetaverseSections = (metaverseId: string) => apiClient.get<Section[]>(`/metaverses/${metaverseId}/sections`)

export const addSectionToMetaverse = (metaverseId: string, sectionId: string) =>
    apiClient.post<void>(`/metaverses/${metaverseId}/sections/${sectionId}`)

export const listMetaverseMembers = (metaverseId: string) => apiClient.get<MetaverseMembersResponse>(`/metaverses/${metaverseId}/members`)

export const inviteMetaverseMember = (metaverseId: string, data: { email: string; role: MetaverseAssignableRole; comment?: string }) =>
    apiClient.post<MetaverseMember>(`/metaverses/${metaverseId}/members`, data)

export const updateMetaverseMemberRole = (
    metaverseId: string,
    memberId: string,
    data: { role: MetaverseAssignableRole; comment?: string }
) => apiClient.patch<MetaverseMember>(`/metaverses/${metaverseId}/members/${memberId}`, data)

export const removeMetaverseMember = (metaverseId: string, memberId: string) =>
    apiClient.delete<void>(`/metaverses/${metaverseId}/members/${memberId}`)
