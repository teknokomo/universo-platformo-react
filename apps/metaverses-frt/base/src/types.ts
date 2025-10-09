export type MetaverseRole = 'owner' | 'admin' | 'editor' | 'member'

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
