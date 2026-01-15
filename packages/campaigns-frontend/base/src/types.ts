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

// Pagination types - re-exported from @universo/types (canonical source)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
