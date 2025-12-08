import type { PaginationParams } from '../types'
import type { InstancesListParams } from './instancesApi'
import type { RolesListParams } from './rolesApi'

/**
 * Query keys for admin module
 * Following TanStack Query best practices for cache invalidation
 */
export const adminQueryKeys = {
    // Root key for all admin queries
    all: ['admin'] as const,

    // Stats query
    stats: () => [...adminQueryKeys.all, 'stats'] as const,

    // Global users list
    globalUsers: () => [...adminQueryKeys.all, 'global-users'] as const,

    // Global users list with pagination params
    globalUsersList: (params?: PaginationParams) => [...adminQueryKeys.globalUsers(), 'list', params] as const,

    // Current user's role
    myRole: () => [...adminQueryKeys.all, 'my-role'] as const
}

/**
 * Query keys for instances module
 */
export const instancesQueryKeys = {
    // Root key for all instances queries
    all: ['instances'] as const,

    // All lists (for cache invalidation)
    lists: () => [...instancesQueryKeys.all, 'list'] as const,

    // Instances list with pagination params
    list: (params?: InstancesListParams) => [...instancesQueryKeys.all, 'list', params] as const,

    // Instance detail
    detail: (id: string) => [...instancesQueryKeys.all, 'detail', id] as const,

    // Instance stats
    stats: (id: string) => [...instancesQueryKeys.all, 'stats', id] as const
}

/**
 * Query keys for roles module
 */
export const rolesQueryKeys = {
    // Root key for all roles queries
    all: ['roles'] as const,

    // All lists (for cache invalidation)
    lists: () => [...rolesQueryKeys.all, 'list'] as const,

    // Roles list with pagination params
    list: (params?: RolesListParams) => [...rolesQueryKeys.all, 'list', params] as const,

    // Roles assignable to global users (has_global_access = true)
    assignable: () => [...rolesQueryKeys.all, 'assignable'] as const,

    // Role detail
    detail: (id: string) => [...rolesQueryKeys.all, 'detail', id] as const,

    // Role users (base key for cache invalidation)
    users: (id: string) => [...rolesQueryKeys.detail(id), 'users'] as const,

    // Role users list with pagination params (normalized for consistent cache keys)
    usersList: (id: string, params?: PaginationParams) => {
        const normalized = {
            limit: params?.limit ?? 20,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'assigned_at',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined
        }
        return [...rolesQueryKeys.users(id), 'list', normalized] as const
    }
}
