import type { OrganizationRole } from '@universo/types'

export type { OrganizationRole }

export type OrganizationAssignableRole = Exclude<OrganizationRole, 'owner'>

export interface OrganizationPermissions {
    manageMembers: boolean
    manageOrganization: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface OrganizationMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: OrganizationRole
    comment?: string
    createdAt: string
}

export interface OrganizationMembersResponse {
    members: OrganizationMember[]
    role: OrganizationRole
    permissions: OrganizationPermissions
}

export interface Organization {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    departmentsCount?: number
    positionsCount?: number
    membersCount?: number
    role?: OrganizationRole
    permissions?: OrganizationPermissions
}

export interface Department {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    positionsCount?: number
    role?: OrganizationRole
    permissions?: OrganizationPermissions
}

export interface Position {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: OrganizationRole
    permissions?: OrganizationPermissions
}

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
