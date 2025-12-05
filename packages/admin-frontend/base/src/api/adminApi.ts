import type { AxiosInstance, AxiosResponse } from 'axios'
import type { GlobalUserMember, AdminStats, PaginationParams, PaginatedResponse, GlobalAssignableRole, RoleMetadata } from '../types'

/**
 * Payload for granting global role (by email)
 */
export interface GrantRolePayload {
    email: string
    role: GlobalAssignableRole
    comment?: string
}

/**
 * Payload for updating global user (role and/or comment)
 */
export interface UpdateRolePayload {
    role?: GlobalAssignableRole
    comment?: string
}

/**
 * Response from /me endpoint with role metadata
 */
export interface MyRoleResponse {
    role: string | null
    hasGlobalAccess: boolean
    roleMetadata: RoleMetadata | null
}

/**
 * Extract pagination metadata from response headers
 */
function extractPaginationMeta(response: AxiosResponse): PaginatedResponse<unknown>['pagination'] {
    return {
        limit: parseInt(response.headers['x-pagination-limit'] || '20', 10),
        offset: parseInt(response.headers['x-pagination-offset'] || '0', 10),
        count: parseInt(response.headers['x-pagination-count'] || '0', 10),
        total: parseInt(response.headers['x-total-count'] || '0', 10),
        hasMore: response.headers['x-pagination-has-more'] === 'true'
    }
}

/**
 * Create admin API client
 */
export function createAdminApi(client: AxiosInstance) {
    // Note: client.baseURL already includes '/api/v1', so only add the relative path
    const BASE_PATH = '/admin/global-users'

    return {
        /**
         * Get current user's global role and metadata
         */
        getMyRole: async (): Promise<MyRoleResponse> => {
            const { data } = await client.get<{ data: MyRoleResponse }>(`${BASE_PATH}/me`)
            return data.data
        },

        /**
         * List all global users with pagination
         */
        listGlobalUsers: async (params?: PaginationParams): Promise<PaginatedResponse<GlobalUserMember>> => {
            const response = await client.get<{ data: GlobalUserMember[] }>(BASE_PATH, {
                params: {
                    limit: params?.limit,
                    offset: params?.offset,
                    sortBy: params?.sortBy,
                    sortOrder: params?.sortOrder,
                    search: params?.search
                }
            })

            return {
                items: response.data.data,
                pagination: extractPaginationMeta(response)
            }
        },

        /**
         * Get admin statistics for dashboard
         */
        getStats: async (): Promise<AdminStats> => {
            const { data } = await client.get<{ data: AdminStats }>(`${BASE_PATH}/stats`)
            return data.data
        },

        /**
         * Grant global role to user by email
         */
        grantRole: async (payload: GrantRolePayload): Promise<GlobalUserMember> => {
            const { data } = await client.post<{ data: GlobalUserMember }>(BASE_PATH, payload)
            return data.data
        },

        /**
         * Update global user's role and/or comment
         */
        updateRole: async (memberId: string, payload: UpdateRolePayload): Promise<GlobalUserMember> => {
            const { data } = await client.patch<{ data: GlobalUserMember }>(`${BASE_PATH}/${memberId}`, payload)
            return data.data
        },

        /**
         * Revoke global role from user
         */
        revokeRole: async (memberId: string): Promise<void> => {
            await client.delete(`${BASE_PATH}/${memberId}`)
        }
    }
}

export type AdminApi = ReturnType<typeof createAdminApi>
