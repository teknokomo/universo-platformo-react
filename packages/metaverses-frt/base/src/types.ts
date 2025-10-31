export type { MetaverseRole } from '@universo/types'

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
    // Optional aggregated counters provided by backend list endpoint
    sectionsCount?: number
    entitiesCount?: number
    role?: MetaverseRole
    permissions?: MetaversePermissions
}

export interface Section {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
}

export interface Entity {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
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
