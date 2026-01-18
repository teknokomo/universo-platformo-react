import type { VersionedLocalizedContent } from '@universo/types'
// Re-export centralized VLC utilities
export {
    getVLCString,
    getVLCStringWithFallback,
    normalizeLocale,
    type SimpleLocalizedInput,
    type VersatileLocalizedContent
} from '@universo/utils/vlc'

// Import for local use in helper functions
import { getVLCString, normalizeLocale } from '@universo/utils/vlc'
import type { SimpleLocalizedInput, VersatileLocalizedContent } from '@universo/utils/vlc'

// Application roles
export type ApplicationRole = 'owner' | 'admin' | 'editor' | 'member'

// Access type indicates how user obtained access to the entity
export type AccessType = 'member' | 'superadmin' | 'supermoderator'

export type ApplicationAssignableRole = Exclude<ApplicationRole, 'owner'>

export interface ApplicationPermissions {
    manageMembers: boolean
    manageApplication: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface ApplicationMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: ApplicationRole
    comment?: string
    createdAt: string
}

export interface ApplicationMembersResponse {
    members: ApplicationMember[]
    role: ApplicationRole
    permissions: ApplicationPermissions
}

export interface Application {
    id: string
    name: VersatileLocalizedContent
    description?: VersatileLocalizedContent
    slug?: string
    isPublic: boolean
    createdAt: string
    updatedAt: string
    schemaName?: string | null
    schemaStatus?: 'draft' | 'pending' | 'synced' | 'outdated' | 'error' | null
    schemaSyncedAt?: string | null
    schemaError?: string | null
    connectorsCount?: number
    membersCount?: number
    role?: ApplicationRole
    accessType?: AccessType
    permissions?: ApplicationPermissions
}

/**
 * Application display type for table rendering with localized strings
 */
export interface ApplicationDisplay {
    id: string
    name: string
    description: string
    slug?: string
    isPublic: boolean
    createdAt: string
    updatedAt: string
    connectorsCount?: number
    membersCount?: number
    role?: ApplicationRole
    accessType?: AccessType
    permissions?: ApplicationPermissions
}

export interface ApplicationLocalizedPayload {
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    slug?: string
    isPublic?: boolean
}

/**
 * Connector - a child entity within an Application
 */
export interface Connector {
    id: string
    applicationId: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    /** If true, connector can only be linked to one metahub */
    isSingleMetahub?: boolean
    /** If true, connector must have at least one metahub */
    isRequiredMetahub?: boolean
    createdAt: string
    updatedAt: string
    role?: ApplicationRole
    permissions?: ApplicationPermissions
}

/**
 * ConnectorMetahub - junction table linking Connector to Metahub
 * When fetched via API, includes nested metahub details
 */
export interface ConnectorMetahub {
    id: string
    connectorId: string
    metahubId: string
    sortOrder: number
    createdAt: string
    /** Metahub details (populated by backend join) */
    metahub?: MetahubSummary | null
}

/**
 * Metahub summary for selection panels
 * This is a minimal representation loaded from metahubs-backend
 */
export interface MetahubSummary {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
}

/**
 * Response for connector metahubs list
 */
export interface ConnectorMetahubsResponse {
    items: ConnectorMetahub[]
    total: number
    isSingleMetahub: boolean
    isRequiredMetahub: boolean
}

/**
 * Connector display type for table rendering
 */
export interface ConnectorDisplay {
    id: string
    applicationId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: ApplicationRole
    permissions?: ApplicationPermissions
}

export interface ConnectorLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    sortOrder?: number
}

// ============ HELPER FUNCTIONS ============

/**
 * Convert Application to display format
 */
export function toApplicationDisplay(application: Application, locale = 'en'): ApplicationDisplay {
    return {
        id: application.id,
        name: getVLCString(application.name, normalizeLocale(locale)),
        description: getVLCString(application.description, normalizeLocale(locale)),
        slug: application.slug,
        isPublic: application.isPublic,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        connectorsCount: application.connectorsCount,
        membersCount: application.membersCount,
        role: application.role,
        accessType: application.accessType,
        permissions: application.permissions
    }
}

/**
 * Convert Connector to display format
 */
export function toConnectorDisplay(connector: Connector, locale = 'en'): ConnectorDisplay {
    return {
        id: connector.id,
        applicationId: connector.applicationId,
        codename: connector.codename,
        name: getVLCString(connector.name, normalizeLocale(locale)),
        description: getVLCString(connector.description, normalizeLocale(locale)),
        sortOrder: connector.sortOrder,
        createdAt: connector.createdAt,
        updatedAt: connector.updatedAt,
        role: connector.role,
        permissions: connector.permissions
    }
}

// ============ PAGINATION TYPES ============
// Re-export from @universo/types for consistency
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
