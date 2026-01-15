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

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
