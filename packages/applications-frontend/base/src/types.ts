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
    commentVlc?: VersionedLocalizedContent<string> | null
    createdAt: string
}

export interface ApplicationMembersResponse {
    members: ApplicationMember[]
    role: ApplicationRole
    permissions: ApplicationPermissions
}

/** Schema lifecycle states matching backend ApplicationSchemaStatus enum */
export type SchemaStatus = 'draft' | 'pending' | 'synced' | 'outdated' | 'error' | 'update_available' | 'maintenance'

export interface Application {
    id: string
    name: VersatileLocalizedContent
    description?: VersatileLocalizedContent
    slug?: string
    isPublic: boolean
    createdAt: string
    updatedAt: string
    schemaName?: string | null
    schemaStatus?: SchemaStatus | null
    schemaSyncedAt?: string | null
    schemaError?: string | null
    appStructureVersion?: number | null
    lastSyncedPublicationVersionId?: string | null
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
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    /** If true, connector can only be linked to one publication */
    isSinglePublication?: boolean
    /** If true, connector must have at least one publication */
    isRequiredPublication?: boolean
    createdAt: string
    updatedAt: string
    role?: ApplicationRole
    permissions?: ApplicationPermissions
}

/**
 * ConnectorPublication - junction table linking Connector to Publication
 * When fetched via API, includes nested publication details
 */
export interface ConnectorPublication {
    id: string
    connectorId: string
    publicationId: string
    sortOrder: number
    createdAt: string
    /** Publication details (populated by backend join) */
    publication?: PublicationSummary | null
}

/**
 * Publication summary for selection panels
 * This is a minimal representation loaded from metahubs-backend
 */
export interface PublicationSummary {
    id: string
    codename: string
    schemaName?: string | null
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    /** Parent metahub info */
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
 * Response for connector publications list
 */
export interface ConnectorPublicationsResponse {
    items: ConnectorPublication[]
    total: number
    isSinglePublication: boolean
    isRequiredPublication: boolean
}

/**
 * Connector display type for table rendering
 */
export interface ConnectorDisplay {
    id: string
    applicationId: string
    name: string
    description: string
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: ApplicationRole
    permissions?: ApplicationPermissions
}

export interface ConnectorLocalizedPayload {
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    sortOrder?: number
    publicationId?: string // Optional publication to link on creation
}

export interface ApplicationRuntimeColumn {
    id: string
    codename: string
    field: string
    dataType: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON'
    headerName: string
    isRequired?: boolean
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    refTargetEntityId?: string | null
    refTargetEntityKind?: string | null
    refOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    enumOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
}

export interface ApplicationRuntimeCatalog {
    id: string
    codename: string
    tableName: string
    name: string
}

export interface ApplicationRuntimeMenuItem {
    id: string
    kind: 'catalog' | 'catalogs_all' | 'link'
    title: string
    icon?: string | null
    href?: string | null
    catalogId?: string | null
    sortOrder?: number
    isActive?: boolean
}

export interface ApplicationRuntimeMenu {
    id: string
    widgetId: string
    showTitle?: boolean
    title?: string
    autoShowAllCatalogs?: boolean
    items: ApplicationRuntimeMenuItem[]
}

export interface ApplicationRuntimeResponse {
    catalog: ApplicationRuntimeCatalog
    catalogs?: ApplicationRuntimeCatalog[]
    activeCatalogId?: string
    columns: ApplicationRuntimeColumn[]
    rows: Array<Record<string, unknown> & { id: string }>
    pagination: {
        total: number
        limit: number
        offset: number
    }
    layoutConfig?: Record<string, unknown>
    zoneWidgets?: {
        left: Array<{
            id: string
            widgetKey: string
            sortOrder: number
            config: Record<string, unknown>
        }>
        right?: Array<{
            id: string
            widgetKey: string
            sortOrder: number
            config: Record<string, unknown>
        }>
        center?: Array<{
            id: string
            widgetKey: string
            sortOrder: number
            config: Record<string, unknown>
        }>
    }
    menus?: ApplicationRuntimeMenu[]
    activeMenuId?: string | null
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
