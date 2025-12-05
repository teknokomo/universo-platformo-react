import type { PaginationParams } from '../types'
import type { InstancesListParams } from './instancesApi'

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
