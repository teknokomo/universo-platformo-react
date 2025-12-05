import type { PaginationParams } from '../types'

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
