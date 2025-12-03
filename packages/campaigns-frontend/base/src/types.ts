import type { CampaignRole } from '@universo/types'

export type { CampaignRole }

export type CampaignAssignableRole = Exclude<CampaignRole, 'owner'>

export interface CampaignPermissions {
    manageMembers: boolean
    manageCampaign: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface CampaignMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: CampaignRole
    comment?: string
    createdAt: string
}

export interface CampaignMembersResponse {
    members: CampaignMember[]
    role: CampaignRole
    permissions: CampaignPermissions
}

export interface Campaign {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    eventsCount?: number
    activitiesCount?: number
    membersCount?: number
    role?: CampaignRole
    permissions?: CampaignPermissions
}

export interface Event {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    activitiesCount?: number
    role?: CampaignRole
    permissions?: CampaignPermissions
}

export interface Activity {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: CampaignRole
    permissions?: CampaignPermissions
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
