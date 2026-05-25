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
    CodenameVLC,
    VersionedLocalizedContent,
    ComponentDefinitionDataType,
    FixedValueDataType,
    EntityKind,
    SharedBehavior,
    DashboardLayoutZone,
    DashboardLayoutWidgetKey,
    BranchCopyOptions,
    ComponentSystemMetadata
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
    ComponentDefinitionDataType,
    FixedValueDataType,
    ComponentDefinitionValidationRules,
    PhysicalTypeInfo,
    ComponentSystemMetadata
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

/** Metahub root entity for hubs, objects, and related metadata. */
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
    treeEntitiesCount?: number
    objectCollectionsCount?: number
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
    treeEntitiesCount?: number
    objectCollectionsCount?: number
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
    scopeEntityId?: string | null
    baseLayoutId?: string | null
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

export interface MetahubCreateLayoutPayload extends MetahubLayoutLocalizedPayload {
    scopeEntityId?: string
    baseLayoutId?: string
}

export interface MetahubLayoutZoneWidget {
    id: string
    layoutId: string
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    isInherited?: boolean
    createdAt?: string
    updatedAt?: string
}

/** @deprecated Use MetahubLayoutZoneWidget instead. */
export type MetahubLayoutZoneModule = MetahubLayoutZoneWidget

export interface DashboardLayoutWidgetItem {
    key: DashboardLayoutWidgetKey
    allowedZones: DashboardLayoutZone[]
    multiInstance: boolean
}

/** @deprecated Use DashboardLayoutWidgetItem instead. */
export type DashboardLayoutModuleItem = DashboardLayoutWidgetItem

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

// ============ HUB ============

/**
 * TreeEntity - a hierarchical container within a Metahub.
 * Object collections can be associated through an N:M relationship.
 */
export interface TreeEntity {
    id: string
    metahubId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder: number
    parentTreeEntityId?: string | null
    createdAt: string
    updatedAt: string
    version?: number
    objectCollectionsCount?: number
    itemsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** TreeEntity with localized strings for table rendering */
export interface TreeEntityDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    parentTreeEntityId?: string | null
    createdAt: string
    updatedAt: string
    objectCollectionsCount?: number
    itemsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** TreeEntity reference for container associations. */
export interface TreeEntityRef {
    id: string
    name: VersionedLocalizedContent<string>
    codename: string
}

// ============ CATALOG ENTITY ============

/**
 * ObjectCollectionEntity - a design-time collection inside a Metahub.
 * Can be associated with multiple hubs via a junction table.
 *
 * TreeEntity association constraints (orthogonal flags):
 * - isSingleHub: max 1 hub (true) or unlimited (false)
 * - isRequiredHub: min 1 hub required (true) or can have 0 (false)
 */
export interface ObjectCollectionEntity {
    id: string
    metahubId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    config?: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    version?: number
    treeEntities?: TreeEntityRef[]
    componentsCount?: number
    recordsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** ObjectCollectionEntity with localized strings for table rendering */
export interface ObjectCollectionDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    isSingleHub: boolean
    isRequiredHub: boolean
    sortOrder: number
    config?: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    treeEntities?: Array<{ id: string; name: string; codename: string }>
    componentsCount?: number
    recordsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

// ============ SET ENTITY ============

/**
 * ValueGroupEntity - a container for grouped fixed values.
 * Mirrors object-collection association rules while storing fixed values instead of records.
 */
export interface ValueGroupEntity {
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
    treeEntities?: TreeEntityRef[]
    fixedValuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** ValueGroupEntity with localized strings for table rendering. */
export interface ValueGroupDisplay {
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
    treeEntities?: Array<{ id: string; name: string; codename: string }>
    fixedValuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

// ============ ENUMERATION ENTITY ============

/**
 * OptionListEntity - fixed list of selectable values.
 * Stores value options in `_mhb_values`.
 */
export interface OptionListEntity {
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
    treeEntities?: TreeEntityRef[]
    optionValuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** OptionListEntity with localized strings for table rendering */
export interface OptionListDisplay {
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
    treeEntities?: Array<{ id: string; name: string; codename: string }>
    optionValuesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** Fixed value inside an OptionListEntity. */
export interface OptionValue {
    id: string
    objectId: string
    codename: CodenameVLC
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    presentation?: Record<string, unknown> & { sharedBehavior?: SharedBehavior }
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    isDefault: boolean
    createdAt: string
    updatedAt: string
    version?: number
}

export interface OptionValueDisplay {
    id: string
    objectId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    isDefault: boolean
    createdAt: string
    updatedAt: string
}

// ============ FIELD DEFINITION ENTITY ============

/**
 * Component - a virtual field within a ObjectCollectionEntity
 * Defines the schema for ObjectCollectionEntity records
 */
export interface Component {
    id: string
    objectCollectionId: string
    codename: CodenameVLC
    dataType: ComponentDefinitionDataType
    name: VersionedLocalizedContent<string>
    targetEntityId?: string | null
    targetEntityKind?: EntityKind | null
    targetConstantId?: string | null
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    isDisplayComponent?: boolean
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    createdAt: string
    updatedAt: string
    version?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
    system?: ComponentSystemMetadata | null
}

/** Component with localized strings for table rendering */
export interface ComponentDisplay {
    id: string
    objectCollectionId: string
    codename: string
    dataType: ComponentDefinitionDataType
    name: string
    targetEntityId?: string | null
    targetEntityKind?: EntityKind | null
    targetConstantId?: string | null
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    isDisplayComponent?: boolean
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
    system?: ComponentSystemMetadata | null
}

// ============ FIXED VALUE ENTITY ============

/**
 * FixedValue - typed value definition inside a Set.
 */
export interface FixedValue {
    id: string
    valueGroupId: string
    codename: CodenameVLC
    dataType: FixedValueDataType
    name: VersionedLocalizedContent<string>
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    value: unknown
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    createdAt: string
    updatedAt: string
    version?: number
}

/** FixedValue with localized strings for table rendering. */
export interface FixedValueDisplay {
    id: string
    valueGroupId: string
    codename: string
    dataType: FixedValueDataType
    name: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    value: unknown
    sortOrder: number
    effectiveSortOrder?: number
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    sharedBehavior?: Required<SharedBehavior> | null
    createdAt: string
    updatedAt: string
}

// ============ RECORD ENTITY ============

/** RecordItem - a data row within a ObjectCollectionEntity */
export interface RecordItem {
    id: string
    objectCollectionId: string
    data: Record<string, unknown>
    ownerId: string | null
    sortOrder: number
    createdAt: string
    updatedAt: string
    version?: number
}

/** RecordItem with derived name/description for FlowListTable compatibility */
export interface RecordItemDisplay {
    id: string
    objectCollectionId: string
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

/** Payload for creating/updating TreeEntity */
export interface TreeEntityLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    parentTreeEntityId?: string | null
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
    copyTreeEntities?: BranchCopyOptions['copyTreeEntities']
    copyObjectCollections?: BranchCopyOptions['copyObjectCollections']
    copyValueGroups?: BranchCopyOptions['copyValueGroups']
    copyOptionLists?: BranchCopyOptions['copyOptionLists']
}

/** Payload for creating/updating ObjectCollectionEntity */
export interface ObjectCollectionLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    treeEntityIds?: string[]
    recordBehavior?: Record<string, unknown>
}

/** Payload for creating/updating Set. */
export interface ValueGroupLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    treeEntityIds?: string[]
}

/** Payload for creating/updating OptionListEntity */
export interface OptionListLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    isSingleHub?: boolean
    isRequiredHub?: boolean
    treeEntityIds?: string[]
}

/** Payload for creating/updating option value */
export interface OptionValueLocalizedPayload {
    codename: CodenameVLC
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
    presentation?: Record<string, unknown> & { sharedBehavior?: SharedBehavior }
    sortOrder?: number
    isDefault?: boolean
}

/** Payload for creating/updating component */
export interface ComponentLocalizedPayload {
    codename: CodenameVLC
    dataType: ComponentDefinitionDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    isRequired?: boolean
    isDisplayComponent?: boolean
    validationRules?: Record<string, unknown>
    targetEntityId?: string
    targetEntityKind?: EntityKind
    targetConstantId?: string | null
    uiConfig?: Record<string, unknown>
    isEnabled?: boolean
}

/** Payload for creating/updating fixed value. */
export interface FixedValueLocalizedPayload {
    codename: CodenameVLC
    dataType: FixedValueDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    value?: unknown
    sortOrder?: number
    expectedVersion?: number
}

// ============ DISPLAY CONVERTERS ============
// Re-exported from displayConverters.ts for the local types barrel
export {
    toMetahubDisplay,
    toBranchDisplay,
    toMetahubLayoutDisplay,
    toTreeEntityDisplay,
    toObjectCollectionDisplay,
    toValueGroupDisplay,
    toOptionListDisplay,
    toOptionValueDisplay,
    toComponentDisplay,
    toFixedValueDisplay,
    toRecordItemDisplay
} from './displayConverters'
