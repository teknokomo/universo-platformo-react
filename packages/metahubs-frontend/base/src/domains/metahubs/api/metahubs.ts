import type { MetahubCreateOptions } from '@universo/types'
import { apiClient } from '../../shared'
import {
    Metahub,
    MetahubMember,
    MetahubAssignableRole,
    MetahubMembersResponse,
    PaginationParams,
    PaginatedResponse,
    MetahubLocalizedPayload,
    SimpleLocalizedInput
} from '../../../types'

// Input type for creating/updating metahubs with localized content
export interface MetahubInput extends MetahubLocalizedPayload {
    slug?: string
    isPublic?: boolean
    expectedVersion?: number
    templateId?: string
    createOptions?: MetahubCreateOptions
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

export const importMetahubFromSnapshot = (envelopeJson: unknown) =>
    apiClient.post<{ metahub: Metahub; publication: { id: string }; version: { id: string } }>('/metahubs/import', envelopeJson)

export const exportMetahubSnapshot = async (metahubId: string): Promise<void> => {
    const response = await apiClient.get(`/metahub/${metahubId}/export`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const disposition = response.headers['content-disposition'] ?? ''
    const filenameMatch = disposition.match(/filename\*?="?(?:UTF-8'')?([^";]+)"?/)

    anchor.href = url
    anchor.download = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : 'metahub-snapshot.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}

// ============ METAHUB MEMBERS ============

export const listMetahubMembers = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubMember>> => {
    const response = await apiClient.get<MetahubMembersResponse & { total: number; limit?: number; offset?: number }>(
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
        },
        meta: {
            role: response.data.role,
            permissions: response.data.permissions
        }
    }
}

export const inviteMetahubMember = (
    metahubId: string,
    data: { email: string; role: MetahubAssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
) => apiClient.post<MetahubMember>(`/metahub/${metahubId}/members`, data)

export const updateMetahubMemberRole = (
    metahubId: string,
    memberId: string,
    data: { role: MetahubAssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
) => apiClient.patch<MetahubMember>(`/metahub/${metahubId}/member/${memberId}`, data)

export const removeMetahubMember = (metahubId: string, memberId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/member/${memberId}`)

// ============ METAHUB BOARD ============

export interface MetahubBoardSummary {
    metahubId: string
    activeBranchId: string | null
    branchesCount: number
    entityCounts: Record<string, number>
    membersCount: number
    publicationsCount: number
    publicationVersionsCount: number
    applicationsCount: number
}

export const getMetahubBoardSummary = async (metahubId: string): Promise<MetahubBoardSummary> => {
    const response = await apiClient.get<MetahubBoardSummary>(`/metahub/${metahubId}/board/summary`)
    return response.data
}
