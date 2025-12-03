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
