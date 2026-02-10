import { apiClient } from '../../shared'
import { Metahub, MetahubMember, MetahubAssignableRole, PaginationParams, PaginatedResponse, MetahubLocalizedPayload } from '../../../types'

// Input type for creating/updating metahubs with localized content
export interface MetahubInput extends MetahubLocalizedPayload {
    slug?: string
    isPublic?: boolean
    expectedVersion?: number
    templateId?: string
}

export interface MetahubCopyInput extends Partial<MetahubInput> {
    copyDefaultBranchOnly?: boolean
    copyAccess?: boolean
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

export const getMetahub = (id: string) => apiClient.get<Metahub>(`/metahub/${id}`)

export const createMetahub = (data: MetahubInput) => apiClient.post<Metahub>('/metahubs', data)

export const updateMetahub = (id: string, data: Partial<MetahubInput>) => apiClient.put<Metahub>(`/metahub/${id}`, data)

export const deleteMetahub = (id: string) => apiClient.delete<void>(`/metahub/${id}`)

export const copyMetahub = (id: string, data: MetahubCopyInput = {}) => apiClient.post<Metahub>(`/metahub/${id}/copy`, data)

// ============ METAHUB MEMBERS ============

export const listMetahubMembers = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubMember>> => {
    const response = await apiClient.get<{ members: MetahubMember[]; total: number; limit?: number; offset?: number }>(
        `/metahub/${metahubId}/members`,
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
    apiClient.post<MetahubMember>(`/metahub/${metahubId}/members`, data)

export const updateMetahubMemberRole = (metahubId: string, memberId: string, data: { role: MetahubAssignableRole; comment?: string }) =>
    apiClient.patch<MetahubMember>(`/metahub/${metahubId}/member/${memberId}`, data)

export const removeMetahubMember = (metahubId: string, memberId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/member/${memberId}`)

// ============ METAHUB BOARD ============

export interface MetahubBoardSummary {
    metahubId: string
    activeBranchId: string | null
    branchesCount: number
    hubsCount: number
    catalogsCount: number
    membersCount: number
    publicationsCount: number
    publicationVersionsCount: number
    applicationsCount: number
}

export const getMetahubBoardSummary = async (metahubId: string): Promise<MetahubBoardSummary> => {
    const response = await apiClient.get<MetahubBoardSummary>(`/metahub/${metahubId}/board/summary`)
    return response.data
}
