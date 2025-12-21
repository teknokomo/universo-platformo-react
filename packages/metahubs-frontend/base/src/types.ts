/**
 * MetaHubs Frontend Types
 */

export interface Metahub {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    entitiesCount?: number
    membersCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

export type MetahubRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface MetahubPermissions {
    canEdit: boolean
    canManageMembers: boolean
    canDelete: boolean
}

export interface SysEntity {
    id: string
    name: string
    codename: string
    description?: string
    displayConfig?: Record<string, unknown>
    createdAt: string
    updatedAt: string
    fieldsCount?: number
}

export interface SysField {
    id: string
    name: string
    codename: string
    fieldType: FieldType
    required: boolean
    fieldConfig?: Record<string, unknown>
    sortOrder: number
    createdAt?: string
    updatedAt?: string
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'text' | 'select' | 'multiselect' | 'reference'

export interface UserDataRecord {
    id: string
    data: Record<string, unknown>
    createdBy?: string
    updatedBy?: string
    createdAt: string
    updatedAt: string
}

export interface PaginationParams {
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface PaginationMeta {
    total: number
    limit: number
    offset: number
    hasMore?: boolean
}

export interface PaginatedResponse<T> {
    items: T[]
    pagination: PaginationMeta
}
