import type { ClusterRole } from '@universo/types'

export type { ClusterRole }

export type ClusterAssignableRole = Exclude<ClusterRole, 'owner'>

export interface ClusterPermissions {
    manageMembers: boolean
    manageCluster: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface ClusterMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: ClusterRole
    comment?: string
    createdAt: string
}

export interface ClusterMembersResponse {
    members: ClusterMember[]
    role: ClusterRole
    permissions: ClusterPermissions
}

export interface Cluster {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    domainsCount?: number
    resourcesCount?: number
    membersCount?: number
    role?: ClusterRole
    permissions?: ClusterPermissions
}

export interface Domain {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    resourcesCount?: number
    role?: ClusterRole
    permissions?: ClusterPermissions
}

export interface Resource {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: ClusterRole
    permissions?: ClusterPermissions
}

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
