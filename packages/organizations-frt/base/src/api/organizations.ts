import apiClient, { extractPaginationMeta } from './apiClient'
import {
    Organization,
    Department,
    Position,
    OrganizationMember,
    OrganizationAssignableRole,
    PaginationParams,
    PaginatedResponse
} from '../types'

// Updated listOrganizations with pagination support
export const listOrganizations = async (params?: PaginationParams): Promise<PaginatedResponse<Organization>> => {
    const response = await apiClient.get<Organization[]>('/organizations', {
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

export const getOrganization = (id: string) => apiClient.get<Organization>(`/organizations/${id}`)

export const createOrganization = (data: { name: string; description?: string }) => apiClient.post<Organization>('/organizations', data)

export const updateOrganization = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Organization>(`/organizations/${id}`, data)

export const deleteOrganization = (id: string) => apiClient.delete<void>(`/organizations/${id}`)

// Organization-Position relationships
export const getOrganizationPositions = (organizationId: string) => apiClient.get<Position[]>(`/organizations/${organizationId}/positions`)

export const addPositionToOrganization = (organizationId: string, positionId: string) =>
    apiClient.post<void>(`/organizations/${organizationId}/positions/${positionId}`)

export const removePositionFromOrganization = (organizationId: string, positionId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/positions/${positionId}`)

export const reorderOrganizationPositions = (organizationId: string, items: Array<{ positionId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/organizations/${organizationId}/positions/reorder`, { items })

// Organization-Department relationships
export const getOrganizationDepartments = (organizationId: string) =>
    apiClient.get<Department[]>(`/organizations/${organizationId}/departments`)

export const addDepartmentToOrganization = (organizationId: string, departmentId: string) =>
    apiClient.post<void>(`/organizations/${organizationId}/departments/${departmentId}`)

// Updated listOrganizationMembers with pagination support (matches backend changes)
export const listOrganizationMembers = async (
    organizationId: string,
    params?: PaginationParams
): Promise<PaginatedResponse<OrganizationMember>> => {
    const response = await apiClient.get<OrganizationMember[]>(`/organizations/${organizationId}/members`, {
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

export const inviteOrganizationMember = (
    organizationId: string,
    data: { email: string; role: OrganizationAssignableRole; comment?: string }
) => apiClient.post<OrganizationMember>(`/organizations/${organizationId}/members`, data)

export const updateOrganizationMemberRole = (
    organizationId: string,
    memberId: string,
    data: { role: OrganizationAssignableRole; comment?: string }
) => apiClient.patch<OrganizationMember>(`/organizations/${organizationId}/members/${memberId}`, data)

export const removeOrganizationMember = (organizationId: string, memberId: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/members/${memberId}`)
