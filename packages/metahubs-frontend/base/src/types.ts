/**
 * Metahubs Frontend Types
 *
 * Core type definitions for the Metahubs module.
 * Follows the VLC (Versioned Localized Content) pattern for localized fields.
 *
 * @packageDocumentation
 */

import type { MetahubRole, GlobalRole, VersionedLocalizedContent, AttributeDataType } from '@universo/types'

// Re-export centralized VLC utilities for consumers
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from '@universo/utils/vlc'
export type { SimpleLocalizedInput, VersatileLocalizedContent } from '@universo/utils/vlc'

// Import for local use in helper functions
import { getVLCString } from '@universo/utils/vlc'
import type { SimpleLocalizedInput, VersatileLocalizedContent } from '@universo/utils/vlc'

// Re-export role type
export type { MetahubRole }

// ============ PAGINATION TYPES ============
// Re-export from @universo/types for consistency
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
export type { AttributeDataType } from '@universo/types'

// ============ ACCESS & PERMISSIONS ============

/**
 * Access type indicates how user obtained access to the entity
 * - 'member': direct membership
 * - 'superadmin'/'supermoderator': global admin access
 */
export type AccessType = 'member' | GlobalRole

/** Roles that can be assigned to new members (excludes 'owner') */
export type MetahubAssignableRole = Exclude<MetahubRole, 'owner'>

/** Permission flags for metahub operations */
export interface MetahubPermissions {
    manageMembers: boolean
    manageMetahub: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

// ============ MEMBER TYPES ============

/** Metahub member representation */
export interface MetahubMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: MetahubRole
    comment?: string
    createdAt: string
}

/** Response for metahub members list */
export interface MetahubMembersResponse {
    members: MetahubMember[]
    role: MetahubRole
    permissions: MetahubPermissions
}

// ============ METAHUB ENTITY ============

/** Metahub - the root entity containing Hubs and Catalogs */
export interface Metahub {
    id: string
    codename: string
    name: VersatileLocalizedContent
    description?: VersatileLocalizedContent
    slug?: string
    isPublic?: boolean
    createdAt: string
    updatedAt: string
    // Aggregated counters
    meta_sectionsCount?: number
    meta_entitiesCount?: number
    membersCount?: number
    hubsCount?: number
    catalogsCount?: number
    // Access info
    role?: MetahubRole
    accessType?: AccessType
    permissions?: MetahubPermissions
}

/** Metahub with localized strings for table rendering */
export interface MetahubDisplay {
    id: string
    codename: string
    name: string
    description: string
    slug?: string
    isPublic?: boolean
    createdAt: string
    updatedAt: string
    meta_sectionsCount?: number
    meta_entitiesCount?: number
    membersCount?: number
    hubsCount?: number
    catalogsCount?: number
    role?: MetahubRole
    accessType?: AccessType
    permissions?: MetahubPermissions
}

// ============ BRANCH ENTITY ============

export interface MetahubBranch {
    id: string
    metahubId: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    sourceBranchId?: string | null
    branchNumber: number
    createdAt: string
    updatedAt: string
    isDefault?: boolean
    isActive?: boolean
    sourceChain?: BranchSourceNode[]
}

export interface MetahubBranchDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    branchNumber: number
    createdAt: string
    updatedAt: string
    isDefault?: boolean
    isActive?: boolean
}

export interface BranchSourceNode {
    id: string
    codename?: string | null
    name?: VersionedLocalizedContent<string> | null
    isMissing?: boolean
}

export interface BlockingBranchUser {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: MetahubRole
}

// ============ PUBLICATION ENTITY ============

/**
 * Schema synchronization status for publications
 */
export type PublicationSchemaStatus = 'draft' | 'pending' | 'synced' | 'outdated' | 'error'

/**
 * Publication with localized strings for display (cards/tables)
 */
export interface PublicationDisplay {
    id: string
    name: string
    description: string
    accessMode: 'full' | 'restricted'
}

// ============ HUB ENTITY ============

/**
 * Hub - a subsystem within a Metahub (like 1C Подсистема)
 * Contains Catalogs via N:M relationship
 */
export interface Hub {
    id: string
    metahubId: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    createdAt: string
    updatedAt: string
    catalogsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Hub with localized strings for table rendering */
export interface HubDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    createdAt: string
    updatedAt: string
    catalogsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Hub reference for catalog associations */
export interface HubRef {
    id: string
    name: VersionedLocalizedContent<string>
    codename: string
}

// ============ CATALOG ENTITY ============

/**
 * Catalog - a virtual table within a Metahub (like 1C Справочник)
 * Can be associated with multiple Hubs via junction table.
 *
 * Hub association constraints (orthogonal flags):
 * - isSingleHub: max 1 hub (true) or unlimited (false)
 * - isRequiredHub: min 1 hub required (true) or can have 0 (false)
 */
export interface Catalog {
    id: string
    metahubId: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    hubs?: HubRef[]
    attributesCount?: number
    elementsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Catalog with localized strings for table rendering */
export interface CatalogDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    hubs?: Array<{ id: string; name: string; codename: string }>
    attributesCount?: number
    elementsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

// ============ ATTRIBUTE ENTITY ============

/**
 * Attribute - a virtual field within a Catalog
 * Defines the schema for Catalog elements
 */
export interface Attribute {
    id: string
    catalogId: string
    codename: string
    dataType: AttributeDataType
    name: VersionedLocalizedContent<string>
    targetCatalogId?: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Attribute with localized strings for table rendering */
export interface AttributeDisplay {
    id: string
    catalogId: string
    codename: string
    dataType: AttributeDataType
    name: string
    targetCatalogId?: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
}

// ============ ELEMENT ENTITY ============

/** HubElement - a data row within a Catalog */
export interface HubElement {
    id: string
    catalogId: string
    data: Record<string, unknown>
    ownerId: string | null
    sortOrder: number
    createdAt: string
    updatedAt: string
}

/** HubElement with derived name/description for FlowListTable compatibility */
export interface HubElementDisplay {
    id: string
    catalogId: string
    name: string
    description: string
    data: Record<string, unknown>
    ownerId: string | null
    sortOrder: number
    createdAt: string
    updatedAt: string
}

// ============ API PAYLOADS ============

/** Payload for creating/updating Metahub */
export interface MetahubLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/** Payload for creating/updating Hub */
export interface HubLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/** Payload for creating/updating Branch */
export interface BranchLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    sourceBranchId?: string
}

/** Payload for creating/updating Catalog */
export interface CatalogLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    hubIds?: string[]
}

/** Payload for creating/updating Attribute */
export interface AttributeLocalizedPayload {
    codename: string
    dataType: AttributeDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    isRequired?: boolean
}

// ============ DISPLAY CONVERTERS ============

/** Convert Metahub to MetahubDisplay for table rendering */
export function toMetahubDisplay(metahub: Metahub, locale = 'en'): MetahubDisplay {
    return {
        ...metahub,
        name: getVLCString(metahub.name, locale),
        description: getVLCString(metahub.description, locale)
    }
}

/** Convert Branch to BranchDisplay for table rendering */
export function toBranchDisplay(branch: MetahubBranch, locale = 'en'): MetahubBranchDisplay {
    return {
        ...branch,
        name: getVLCString(branch.name, locale),
        description: getVLCString(branch.description, locale)
    }
}

/** Convert Hub to HubDisplay for table rendering */
export function toHubDisplay(hub: Hub, locale = 'en'): HubDisplay {
    const name = getVLCString(hub.name, locale)
    return {
        ...hub,
        name: name || hub.codename || '',
        description: getVLCString(hub.description, locale)
    }
}

/** Convert Catalog to CatalogDisplay for table rendering */
export function toCatalogDisplay(catalog: Catalog, locale = 'en'): CatalogDisplay {
    const name = getVLCString(catalog.name, locale)
    return {
        ...catalog,
        name: name || catalog.codename || '',
        description: getVLCString(catalog.description, locale),
        hubs: catalog.hubs?.map((hub) => ({
            id: hub.id,
            name: getVLCString(hub.name, locale) || hub.codename,
            codename: hub.codename
        }))
    }
}

/** Convert Attribute to AttributeDisplay for table rendering */
export function toAttributeDisplay(attr: Attribute, locale = 'en'): AttributeDisplay {
    return {
        ...attr,
        name: getVLCString(attr.name, locale)
    }
}

/** Convert HubElement to HubElementDisplay for table rendering */
export function toHubElementDisplay(element: HubElement, attributes: Attribute[] = [], locale = 'en'): HubElementDisplay {
    const firstStringAttr = attributes.find((a) => a.dataType === 'STRING')
    const rawValue = firstStringAttr ? element.data[firstStringAttr.codename] : undefined
    const nameValue =
        firstStringAttr && rawValue !== undefined && rawValue !== null
            ? getVLCString(rawValue as VersatileLocalizedContent, locale) || String(rawValue)
            : `Element ${element.id.slice(0, 8)}`

    return {
        ...element,
        name: nameValue,
        description: ''
    }
}
