import type { StorageRole } from '@universo/types'

export type { StorageRole }

export type StorageAssignableRole = Exclude<StorageRole, 'owner'>

export interface StoragePermissions {
    manageMembers: boolean
    manageStorage: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface StorageMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: StorageRole
    comment?: string
    createdAt: string
}

export interface StorageMembersResponse {
    members: StorageMember[]
    role: StorageRole
    permissions: StoragePermissions
}

export interface Storage {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    containersCount?: number
    slotsCount?: number
    membersCount?: number
    role?: StorageRole
    permissions?: StoragePermissions
}

export interface Container {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    slotsCount?: number
    role?: StorageRole
    permissions?: StoragePermissions
}

export interface Slot {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: StorageRole
    permissions?: StoragePermissions
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
