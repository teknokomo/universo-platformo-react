import apiClient, { extractPaginationMeta } from './apiClient'
import { Metaverse, Section, Entity, MetaverseMember, MetaverseAssignableRole, PaginationParams, PaginatedResponse } from '../types'

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

// Updated listMetaverseMembers with pagination support (matches backend changes)
export const listMetaverseMembers = async (metaverseId: string, params?: PaginationParams): Promise<PaginatedResponse<MetaverseMember>> => {
    const response = await apiClient.get<MetaverseMember[]>(`/metaverses/${metaverseId}/members`, {
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

export const inviteMetaverseMember = (metaverseId: string, data: { email: string; role: MetaverseAssignableRole; comment?: string }) =>
    apiClient.post<MetaverseMember>(`/metaverses/${metaverseId}/members`, data)

export const updateMetaverseMemberRole = (
    metaverseId: string,
    memberId: string,
    data: { role: MetaverseAssignableRole; comment?: string }
) => apiClient.patch<MetaverseMember>(`/metaverses/${metaverseId}/members/${memberId}`, data)

export const removeMetaverseMember = (metaverseId: string, memberId: string) =>
    apiClient.delete<void>(`/metaverses/${metaverseId}/members/${memberId}`)
