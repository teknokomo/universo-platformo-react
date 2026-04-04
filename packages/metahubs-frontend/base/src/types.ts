/**
 * Metahubs Frontend Types
 *
 * Core type definitions for the Metahubs module.
 * Follows the VLC (Versioned Localized Content) pattern for localized fields.
 *
 * @packageDocumentation
 */

import type {
    MetahubRole,
    GlobalRole,
    CatalogRuntimeViewConfig,
    CodenameVLC,
    VersionedLocalizedContent,
    AttributeDataType,
    ConstantDataType,
    MetaEntityKind,
    DashboardLayoutZone,
    DashboardLayoutWidgetKey,
    BranchCopyOptions,
    CatalogAttributeSystemMetadata
} from '@universo/types'

// Re-export centralized VLC utilities for consumers
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from '@universo/utils/vlc'
export type { SimpleLocalizedInput, VersatileLocalizedContent } from '@universo/utils/vlc'

// Import types for local use in entity interfaces and payloads
import type { SimpleLocalizedInput, VersatileLocalizedContent } from '@universo/utils/vlc'

// Re-export role type
export type { MetahubRole }

// Re-export conflict info for optimistic locking
export type { ConflictInfo } from '@universo/utils'

// ============ PAGINATION TYPES ============
// Re-export from @universo/types for consistency
export type { PaginationParams, PaginationMeta, PaginatedResponse } from '@universo/types'
export type {
    AttributeDataType,
    ConstantDataType,
    AttributeValidationRules,
    PhysicalTypeInfo,
    CatalogAttributeSystemMetadata
} from '@universo/types'
export { getDefaultValidationRules, getPhysicalDataType, formatPhysicalType } from '@universo/types'

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
    commentVlc?: VersionedLocalizedContent<string> | null
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
    codename: CodenameVLC
    name: VersatileLocalizedContent
    description?: VersatileLocalizedContent
    slug?: string
    isPublic?: boolean
    templateId?: string | null
    templateVersionId?: string | null
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
    codename: CodenameVLC
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

// ============ LAYOUT ENTITY ============

export type LayoutTemplateKey = 'dashboard'

export interface MetahubLayout {
    id: string
    templateKey: LayoutTemplateKey
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    config: Record<string, unknown>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
}

export interface MetahubLayoutDisplay {
    id: string
    templateKey: LayoutTemplateKey
    name: string
    description: string
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
}

export interface MetahubLayoutLocalizedPayload {
    templateKey: LayoutTemplateKey
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput | null
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isActive?: boolean
    isDefault?: boolean
    sortOrder?: number
    config?: Record<string, unknown>
    expectedVersion?: number
}

export interface MetahubLayoutZoneWidget {
    id: string
    layoutId: string
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    createdAt?: string
    updatedAt?: string
}

/** @deprecated Use MetahubLayoutZoneWidget instead. */
export type MetahubLayoutZoneModule = MetahubLayoutZoneWidget

export interface DashboardLayoutWidgetCatalogItem {
    key: DashboardLayoutWidgetKey
    allowedZones: DashboardLayoutZone[]
    multiInstance: boolean
}

/** @deprecated Use DashboardLayoutWidgetCatalogItem instead. */
export type DashboardLayoutModuleCatalogItem = DashboardLayoutWidgetCatalogItem

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
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    parentHubId?: string | null
    createdAt: string
    updatedAt: string
    version?: number
    catalogsCount?: number
    itemsCount?: number
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
    parentHubId?: string | null
    createdAt: string
    updatedAt: string
    catalogsCount?: number
    itemsCount?: number
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
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
    runtimeConfig?: CatalogRuntimeViewConfig
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

// ============ SET ENTITY ============

/**
 * Set - container of constants.
 * Mirrors catalog structure, but stores constants instead of attributes/elements.
 */
export interface MetahubSet {
    id: string
    metahubId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
    hubs?: HubRef[]
    constantsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Set with localized strings for table rendering. */
export interface MetahubSetDisplay {
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
    constantsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

// ============ ENUMERATION ENTITY ============

/**
 * Enumeration - fixed list of values (like 1C Enumerations).
 * Stores value options in `_mhb_values`.
 */
export interface Enumeration {
    id: string
    metahubId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
    hubs?: HubRef[]
    valuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Enumeration with localized strings for table rendering */
export interface EnumerationDisplay {
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
    valuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Fixed value inside an Enumeration. */
export interface EnumerationValue {
    id: string
    objectId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    isDefault: boolean
    createdAt: string
    updatedAt: string
    version?: number
}

export interface EnumerationValueDisplay {
    id: string
    objectId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

// ============ ATTRIBUTE ENTITY ============

/**
 * Attribute - a virtual field within a Catalog
 * Defines the schema for Catalog elements
 */
export interface Attribute {
    id: string
    catalogId: string
    codename: CodenameVLC
    dataType: AttributeDataType
    name: VersionedLocalizedContent<string>
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
    targetConstantId?: string | null
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    isDisplayAttribute?: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
    system?: CatalogAttributeSystemMetadata | null
}

/** Attribute with localized strings for table rendering */
export interface AttributeDisplay {
    id: string
    catalogId: string
    codename: string
    dataType: AttributeDataType
    name: string
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
    targetConstantId?: string | null
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    isDisplayAttribute?: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
    system?: CatalogAttributeSystemMetadata | null
}

// ============ CONSTANT ENTITY ============

/**
 * Constant - typed value definition inside a Set.
 */
export interface Constant {
    id: string
    setId: string
    codename: CodenameVLC
    dataType: ConstantDataType
    name: VersionedLocalizedContent<string>
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    value: unknown
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
}

/** Constant with localized strings for table rendering. */
export interface ConstantDisplay {
    id: string
    setId: string
    codename: string
    dataType: ConstantDataType
    name: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    value: unknown
    sortOrder: number
    createdAt: string
    updatedAt: string
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
    version?: number
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
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

/** Payload for creating/updating Hub */
export interface HubLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    parentHubId?: string | null
}

/** Payload for creating/updating Branch */
export interface BranchLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    sourceBranchId?: string
    fullCopy?: BranchCopyOptions['fullCopy']
    copyLayouts?: BranchCopyOptions['copyLayouts']
    copyHubs?: BranchCopyOptions['copyHubs']
    copyCatalogs?: BranchCopyOptions['copyCatalogs']
    copySets?: BranchCopyOptions['copySets']
    copyEnumerations?: BranchCopyOptions['copyEnumerations']
}

/** Payload for creating/updating Catalog */
export interface CatalogLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    hubIds?: string[]
    runtimeConfig?: CatalogRuntimeViewConfig
}

/** Payload for creating/updating Set. */
export interface SetLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    hubIds?: string[]
}

/** Payload for creating/updating Enumeration */
export interface EnumerationLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    hubIds?: string[]
}

/** Payload for creating/updating Enumeration value */
export interface EnumerationValueLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    sortOrder?: number
    isDefault?: boolean
}

/** Payload for creating/updating Attribute */
export interface AttributeLocalizedPayload {
    codename: CodenameVLC
    dataType: AttributeDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    isRequired?: boolean
    isDisplayAttribute?: boolean
    validationRules?: Record<string, unknown>
    targetEntityId?: string
    targetEntityKind?: MetaEntityKind
    targetConstantId?: string | null
    uiConfig?: Record<string, unknown>
    isEnabled?: boolean
}

/** Payload for creating/updating Constant. */
export interface ConstantLocalizedPayload {
    codename: CodenameVLC
    dataType: ConstantDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    value?: unknown
    sortOrder?: number
    expectedVersion?: number
}

// ============ DISPLAY CONVERTERS ============
// Re-exported from displayConverters.ts for backward compatibility
export {
    toMetahubDisplay,
    toBranchDisplay,
    toMetahubLayoutDisplay,
    toHubDisplay,
    toCatalogDisplay,
    toSetDisplay,
    toEnumerationDisplay,
    toEnumerationValueDisplay,
    toAttributeDisplay,
    toConstantDisplay,
    toHubElementDisplay
} from './displayConverters'
