import type { UnikRole } from '@universo/types'

export type { UnikRole }

export type UnikAssignableRole = Exclude<UnikRole, 'owner'>

export interface UnikPermissions {
    manageMembers: boolean
    manageUnik: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface UnikMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: UnikRole
    comment?: string
    createdAt: string
}

export interface UnikMembersResponse {
    members: UnikMember[]
    role: UnikRole
    permissions: UnikPermissions
}

export interface Unik {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    spacesCount?: number
    toolsCount?: number
    credentialsCount?: number
    variablesCount?: number
    apiKeysCount?: number
    documentStoresCount?: number
    membersCount?: number
    role?: UnikRole
    permissions?: UnikPermissions
}

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
