import type { GlobalRole, RoleMetadata, LocalizedString } from '@universo/types'
import type { BaseMemberEntity } from '@universo/types'

export type { GlobalRole, RoleMetadata, LocalizedString }

/**
 * Instance status type
 */
export type InstanceStatus = 'active' | 'inactive' | 'maintenance'

/**
 * Instance entity for platform instances management
 */
export interface Instance {
    id: string
    name: string
    display_name: LocalizedString
    description?: string
    url?: string
    status: InstanceStatus
    is_local: boolean
    created_at: string
    updated_at: string
}

/**
 * Instance statistics response
 */
export interface InstanceStats {
    instanceId: string
    available: boolean
    message?: string
    totalUsers?: number
    globalAccessUsers?: number
    instanceName?: string
    instanceStatus?: InstanceStatus
}

/**
 * Instance update payload
 */
export interface UpdateInstancePayload {
    name?: string
    display_name?: LocalizedString
    description?: string | null
    url?: string | null
    status?: InstanceStatus
}

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
