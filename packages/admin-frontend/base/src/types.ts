import type {
    AdminCreateUserPayload,
    AdminDashboardStats,
    GlobalRole,
    GlobalUserMember,
    GlobalUserRoleAssignment,
    RoleMetadata,
    SetUserRolesPayload,
    VersionedLocalizedContent
} from '@universo/types'

// Re-export types from @universo/types for convenience
export type {
    AdminCreateUserPayload,
    AdminDashboardStats,
    GlobalRole,
    GlobalUserMember,
    GlobalUserRoleAssignment,
    RoleMetadata,
    SetUserRolesPayload,
    VersionedLocalizedContent
}

/**
 * Instance status type
 */
export type InstanceStatus = 'active' | 'inactive' | 'maintenance'

/**
 * Instance entity for platform instances management
 */
export interface Instance {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    url?: string
    status: InstanceStatus
    is_local: boolean
    _upl_created_at: string
    _upl_updated_at: string
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
    totalRoles?: number
    instanceName?: string
    instanceStatus?: InstanceStatus
}

/**
 * Instance update payload
 */
export interface UpdateInstancePayload {
    codename?: string
    name?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    url?: string | null
    status?: InstanceStatus
}

/**
 * Global user assignable roles (dynamic, loaded from database)
 */
export type GlobalAssignableRole = string

/**
 * Stats response from admin API
 */
export type AdminStats = AdminDashboardStats

/**
 * Pagination types - re-exported from @universo/types (canonical source)
 */
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
