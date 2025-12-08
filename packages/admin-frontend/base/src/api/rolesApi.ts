import type { AxiosInstance, AxiosResponse } from 'axios'
import type { PaginatedResponse } from '../types'
import type { CreateRolePayload, UpdateRolePayload, PermissionInput, GlobalAssignableRole } from '@universo/types'

/**
 * Role from API (camelCase version for frontend)
 */
export interface RoleListItem {
    id: string
    name: string
    description?: string
    displayName: Record<string, string>
    color: string
    hasGlobalAccess: boolean
    isSystem: boolean
    createdAt: string
    updatedAt: string
    permissions: PermissionInput[]
}

/**
 * User status based on auth state
 */
export type UserStatus = 'active' | 'inactive' | 'pending' | 'banned'

/**
 * Role user assignment
 */
export interface RoleUser {
    id: string
    email: string | null
    fullName: string | null
    assignedAt: string
    assignedBy: string | null
    status: UserStatus
}

/**
 * API response for role user (snake_case from backend)
 */
interface ApiRoleUser {
    id: string
    email: string | null
    full_name: string | null
    assigned_at: string
    assigned_by: string | null
    status: UserStatus
}

/**
 * Parameters for listing role users
 */
export interface RoleUsersParams {
    limit?: number
    offset?: number
    search?: string
    sortBy?: 'email' | 'assigned_at'
    sortOrder?: 'asc' | 'desc'
}

/**
 * Parameters for listing roles
 */
export interface RolesListParams {
    limit?: number
    offset?: number
    search?: string
    sortBy?: 'name' | 'created' | 'has_global_access'
    sortOrder?: 'asc' | 'desc'
    includeSystem?: boolean
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
 * Transform snake_case API response to camelCase frontend model
 */
function transformRole(apiRole: Record<string, unknown>): RoleListItem {
    return {
        id: apiRole.id as string,
        name: apiRole.name as string,
        description: apiRole.description as string | undefined,
        displayName: apiRole.display_name as Record<string, string>,
        color: apiRole.color as string,
        hasGlobalAccess: apiRole.has_global_access as boolean,
        isSystem: apiRole.is_system as boolean,
        createdAt: apiRole.created_at as string,
        updatedAt: apiRole.updated_at as string,
        permissions: ((apiRole.permissions as Record<string, unknown>[] | undefined) || []).map((p) => ({
            module: p.module as string,
            action: p.action as string,
            conditions: p.conditions as Record<string, unknown> | undefined,
            fields: p.fields as string[] | undefined
        }))
    }
}

/**
 * Create roles API client
 */
export function createRolesApi(client: AxiosInstance) {
    const BASE_PATH = '/admin/roles'

    return {
        /**
         * List all roles with pagination
         */
        listRoles: async (params?: RolesListParams): Promise<PaginatedResponse<RoleListItem>> => {
            const response = await client.get<{ data: Record<string, unknown>[] }>(BASE_PATH, {
                params: {
                    limit: params?.limit,
                    offset: params?.offset,
                    search: params?.search,
                    sortBy: params?.sortBy,
                    sortOrder: params?.sortOrder,
                    includeSystem: params?.includeSystem
                }
            })

            return {
                items: response.data.data.map(transformRole),
                pagination: extractPaginationMeta(response)
            }
        },

        /**
         * Get role by ID with permissions
         * @throws Error if id is 'new' (reserved for create mode)
         */
        getRole: async (id: string): Promise<RoleListItem> => {
            // Guard against fetching 'new' - this is a reserved route for create mode
            if (id === 'new') {
                throw new Error('Cannot fetch role with id "new" - this is reserved for create mode')
            }
            const response = await client.get<{ data: Record<string, unknown> }>(`${BASE_PATH}/${id}`)
            return transformRole(response.data.data)
        },

        /**
         * Create a new role
         */
        createRole: async (payload: CreateRolePayload): Promise<RoleListItem> => {
            const response = await client.post<{ data: Record<string, unknown> }>(BASE_PATH, payload)
            return transformRole(response.data.data)
        },

        /**
         * Update an existing role
         */
        updateRole: async (id: string, payload: UpdateRolePayload): Promise<RoleListItem> => {
            const response = await client.patch<{ data: Record<string, unknown> }>(`${BASE_PATH}/${id}`, payload)
            return transformRole(response.data.data)
        },

        /**
         * Delete a role
         */
        deleteRole: async (id: string): Promise<void> => {
            await client.delete(`${BASE_PATH}/${id}`)
        },

        /**
         * Get users assigned to a role with pagination
         */
        getRoleUsers: async (id: string, params?: RoleUsersParams): Promise<PaginatedResponse<RoleUser>> => {
            const response = await client.get<{ data: { roleId: string; roleName: string; users: ApiRoleUser[] } }>(
                `${BASE_PATH}/${id}/users`,
                {
                    params: {
                        limit: params?.limit,
                        offset: params?.offset,
                        search: params?.search,
                        sortBy: params?.sortBy,
                        sortOrder: params?.sortOrder
                    }
                }
            )

            return {
                items: response.data.data.users.map((u) => ({
                    id: u.id,
                    email: u.email,
                    fullName: u.full_name,
                    assignedAt: u.assigned_at,
                    assignedBy: u.assigned_by,
                    status: u.status
                })),
                pagination: extractPaginationMeta(response)
            }
        },

        /**
         * Get roles assignable to global users (has_global_access = true)
         * Used for populating role dropdowns in global access management
         */
        getAssignableRoles: async (): Promise<GlobalAssignableRole[]> => {
            const response = await client.get<{ data: GlobalAssignableRole[] }>(`${BASE_PATH}/assignable`)
            return response.data.data
        }
    }
}

export type RolesApi = ReturnType<typeof createRolesApi>

// =============================================================================
// Direct exports for usePaginated hook compatibility
// =============================================================================

import apiClient from './apiClient'

/**
 * Singleton instance for direct function exports
 * Used by usePaginated and other hooks that need direct function references
 */
const rolesApiSingleton = createRolesApi(apiClient)

/** List roles with pagination */
export const listRoles = rolesApiSingleton.listRoles

/** Get single role by ID */
export const getRole = rolesApiSingleton.getRole

/** Create new role */
export const createRole = rolesApiSingleton.createRole

/** Update existing role */
export const updateRole = rolesApiSingleton.updateRole

/** Delete role */
export const deleteRole = rolesApiSingleton.deleteRole

/** Get users assigned to a role */
export const getRoleUsers = rolesApiSingleton.getRoleUsers

/** Get roles assignable to global users */
export const getAssignableRoles = rolesApiSingleton.getAssignableRoles
