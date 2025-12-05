import type { GlobalRole, RoleMetadata, GlobalUserMember as BaseGlobalUserMember, LocalizedString } from '@universo/types'
import type { BaseMemberEntity } from '@universo/types'

export type { GlobalRole, RoleMetadata, LocalizedString }

/**
 * Global user assignable roles (both are assignable, unlike entity roles where owner is not assignable)
 * Now dynamically loaded from database
 */
export type GlobalAssignableRole = string

/**
 * Global user member interface for frontend display
 * Compatible with BaseMemberEntity for createMemberActions factory
 */
export interface GlobalUserMember extends BaseMemberEntity {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: string
    roleName: string
    roleMetadata?: RoleMetadata
    comment?: string | null
    grantedBy?: string | null
    createdAt: string
}

/**
 * Stats response from admin API
 */
export interface AdminStats {
    totalGlobalUsers: number
    byRole: Record<string, number>
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
    limit?: number
    offset?: number
    sortBy?: 'created' | 'email' | 'role'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
    items: T[]
    pagination: {
        limit: number
        offset: number
        count: number
        total: number
        hasMore: boolean
    }
}
