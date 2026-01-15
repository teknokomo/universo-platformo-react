import type { ProjectRole } from '@universo/types'

export type { ProjectRole }

export type ProjectAssignableRole = Exclude<ProjectRole, 'owner'>

export interface ProjectPermissions {
    manageMembers: boolean
    manageProject: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface ProjectMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: ProjectRole
    comment?: string
    createdAt: string
}

export interface ProjectMembersResponse {
    members: ProjectMember[]
    role: ProjectRole
    permissions: ProjectPermissions
}

export interface Project {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    MilestonesCount?: number
    TasksCount?: number
    membersCount?: number
    role?: ProjectRole
    permissions?: ProjectPermissions
}

export interface Milestone {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    TasksCount?: number
    role?: ProjectRole
    permissions?: ProjectPermissions
}

export interface Task {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: ProjectRole
    permissions?: ProjectPermissions
}

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
