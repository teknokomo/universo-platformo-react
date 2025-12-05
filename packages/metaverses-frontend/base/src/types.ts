import type { MetaverseRole, GlobalRole } from '@universo/types'

export type { MetaverseRole }

// Access type indicates how user obtained access to the entity
// 'member' = direct membership, 'superadmin'/'supermoderator' = global admin access
export type AccessType = 'member' | GlobalRole

export type MetaverseAssignableRole = Exclude<MetaverseRole, 'owner'>

export interface MetaversePermissions {
    manageMembers: boolean
    manageMetaverse: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface MetaverseMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: MetaverseRole
    comment?: string
    createdAt: string
}

export interface MetaverseMembersResponse {
    members: MetaverseMember[]
    role: MetaverseRole
    permissions: MetaversePermissions
}

export interface Metaverse {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    sectionsCount?: number
    entitiesCount?: number
    membersCount?: number
    role?: MetaverseRole
    // accessType indicates how user obtained access: 'member' for direct membership, 
    // 'superadmin'/'supermoderator' for global admin access
    accessType?: AccessType
    permissions?: MetaversePermissions
}

export interface Section {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    entitiesCount?: number
    role?: MetaverseRole
    permissions?: MetaversePermissions
}

export interface Entity {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: MetaverseRole
    permissions?: MetaversePermissions
}

export type UseApi = <T, TArgs extends any[] = any[]>(
    apiFunc: (...args: TArgs) => Promise<{ data: T }>
) => {
    data: T | null
    error: any
    loading: boolean
    request: (...args: TArgs) => Promise<T | null>
}

// Pagination types - using local declarations to avoid build issues
// These mirror the types from @universo/template-mui
export interface PaginationParams {
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface PaginationMeta {
    limit: number
    offset: number
    count: number
    total: number
    hasMore: boolean
}

export interface PaginatedResponse<T> {
    items: T[]
    pagination: PaginationMeta
}
