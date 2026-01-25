import { apiClient } from '../../shared'
import axios from 'axios'
import {
    MetahubBranch,
    BranchLocalizedPayload,
    PaginationParams,
    PaginatedResponse,
    BlockingBranchUser,
    BranchSourceNode
} from '../../../types'

export interface MetahubBranchDetails extends MetahubBranch {
    sourceBranchId?: string | null
    sourceChain?: BranchSourceNode[]
}

export interface BlockingBranchUsersResponse {
    branchId: string
    blockingUsers: BlockingBranchUser[]
    canDelete: boolean
    isDefault: boolean
}

export interface BranchOptionsResponse {
    items: MetahubBranch[]
    total: number
    meta?: {
        defaultBranchId?: string | null
        activeBranchId?: string | null
    }
}

export interface BranchOptionsParams {
    sortBy?: PaginationParams['sortBy']
    sortOrder?: PaginationParams['sortOrder']
    search?: PaginationParams['search']
}

/**
 * List branches for a specific metahub
 */
export const listBranches = async (metahubId: string, params?: PaginationParams): Promise<PaginatedResponse<MetahubBranch>> => {
    const response = await apiClient.get<{ items: MetahubBranch[]; pagination: { total: number; limit: number; offset: number } }>(
        `/metahub/${metahubId}/branches`,
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
        meta: (response.data as any).meta
    }
}

/**
 * List all branches without pagination (for selectors/options)
 */
export const listBranchOptions = async (metahubId: string, params?: BranchOptionsParams): Promise<BranchOptionsResponse> => {
    const response = await apiClient.get<BranchOptionsResponse>(`/metahub/${metahubId}/branches/options`, {
        params: {
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })
    return response.data
}

/**
 * Get a single branch
 */
export const getBranch = (metahubId: string, branchId: string) =>
    apiClient.get<MetahubBranchDetails>(`/metahub/${metahubId}/branch/${branchId}`)

/**
 * Create a new branch
 */
export const createBranch = (metahubId: string, data: BranchLocalizedPayload) =>
    apiClient.post<MetahubBranch>(`/metahub/${metahubId}/branches`, data)

/**
 * Update a branch
 */
export const updateBranch = (metahubId: string, branchId: string, data: BranchLocalizedPayload) =>
    apiClient.patch<MetahubBranch>(`/metahub/${metahubId}/branch/${branchId}`, data)

/**
 * Activate branch for current user
 */
export const activateBranch = (metahubId: string, branchId: string) =>
    apiClient.post<{ metahubId: string; branchId: string }>(`/metahub/${metahubId}/branch/${branchId}/activate`)

/**
 * Set default branch for metahub
 */
export const setDefaultBranch = (metahubId: string, branchId: string) =>
    apiClient.post<{ metahubId: string; branchId: string }>(`/metahub/${metahubId}/branch/${branchId}/default`)

/**
 * Delete a branch
 */
export const deleteBranch = (metahubId: string, branchId: string) => apiClient.delete<void>(`/metahub/${metahubId}/branch/${branchId}`)

/**
 * Get users who block branch deletion (active for other users)
 */
export const getBlockingUsers = async (metahubId: string, branchId: string): Promise<BlockingBranchUsersResponse> => {
    try {
        const response = await apiClient.get<BlockingBranchUsersResponse>(`/metahub/${metahubId}/branch/${branchId}/blocking-users`)
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return {
                branchId,
                blockingUsers: [],
                canDelete: false,
                isDefault: false
            }
        }
        throw error
    }
}
