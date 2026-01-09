import type { MetahubRole, GlobalRole, VersionedLocalizedContent } from '@universo/types'
import { getSimpleLocalizedValue, normalizeLocale } from './utils/localizedInput'

export type { MetahubRole }

// Access type indicates how user obtained access to the entity
// 'member' = direct membership, 'superadmin'/'supermoderator' = global admin access
export type AccessType = 'member' | GlobalRole

export type MetahubAssignableRole = Exclude<MetahubRole, 'owner'>

export interface MetahubPermissions {
    manageMembers: boolean
    manageMetahub: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface MetahubMember {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: MetahubRole
    comment?: string
    createdAt: string
}

export interface MetahubMembersResponse {
    members: MetahubMember[]
    role: MetahubRole
    permissions: MetahubPermissions
}

/**
 * VersatileLocalizedContent structure as returned by backend
 */
export interface VersatileLocalizedContent {
    _schema: string
    locales: Record<string, { content: string }>
    _primary: string
}

export interface Metahub {
    id: string
    name: VersatileLocalizedContent
    description?: VersatileLocalizedContent
    createdAt: string
    updatedAt: string
    // Optional aggregated counters provided by backend
    meta_sectionsCount?: number
    meta_entitiesCount?: number
    membersCount?: number
    role?: MetahubRole
    // accessType indicates how user obtained access: 'member' for direct membership,
    // 'superadmin'/'supermoderator' for global admin access
    accessType?: AccessType
    permissions?: MetahubPermissions
    // New architecture counters
    hubsCount?: number
}

/**
 * Metahub display type for table rendering with localized strings
 */
export interface MetahubDisplay {
    id: string
    name: string
    description: string
    createdAt: string
    updatedAt: string
    meta_sectionsCount?: number
    meta_entitiesCount?: number
    membersCount?: number
    role?: MetahubRole
    accessType?: AccessType
    permissions?: MetahubPermissions
    hubsCount?: number
}

// ============ NEW ARCHITECTURE TYPES ============

/**
 * Simple localized input format for forms
 * Used when creating/updating entities via API
 */
export interface SimpleLocalizedInput {
    [key: string]: string | undefined
    en?: string
    ru?: string
}

export interface MetahubLocalizedPayload {
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

export interface HubLocalizedPayload {
    codename: string
    name: SimpleLocalizedInput
    description?: SimpleLocalizedInput
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}

export interface AttributeLocalizedPayload {
    codename: string
    dataType: AttributeDataType
    name: SimpleLocalizedInput
    namePrimaryLocale?: string
    isRequired?: boolean
}

/**
 * Hub - a virtual table within a Metahub
 * Replaces the old MetaSection concept
 *
 * Note: name/description are stored as VersionedLocalizedContent (VLC).
 * API payloads still use SimpleLocalizedInput for create/update.
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
    // Optional aggregated counter
    attributesCount?: number
    recordsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/**
 * Hub display type for table rendering
 * Converts localized fields to strings for current locale
 */
export interface HubDisplay {
    id: string
    metahubId: string
    codename: string
    name: string
    description: string
    sortOrder: number
    createdAt: string
    updatedAt: string
    attributesCount?: number
    recordsCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/**
 * Attribute data types for dynamic field definitions
 */
export type AttributeDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'REF' | 'JSON'

/**
 * Attribute - a virtual field within a Hub
 * Replaces the old MetaEntity concept
 *
 * Note: name is stored as VersionedLocalizedContent (VLC).
 */
export interface Attribute {
    id: string
    hubId: string
    codename: string
    dataType: AttributeDataType
    name: VersionedLocalizedContent<string>
    targetHubId?: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/**
 * Attribute display type for table rendering
 */
export interface AttributeDisplay {
    id: string
    hubId: string
    codename: string
    dataType: AttributeDataType
    name: string
    targetHubId?: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    isRequired: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/**
 * HubRecord - a data row within a Hub
 * Stores actual data as JSONB
 */
export interface HubRecord {
    id: string
    hubId: string
    data: Record<string, unknown>
    ownerId: string
    sortOrder: number
    createdAt: string
    updatedAt: string
}

/**
 * HubRecord display type for table rendering
 * Adds name/description derived from data for FlowListTable compatibility
 */
export interface HubRecordDisplay {
    id: string
    hubId: string
    name: string
    description: string
    data: Record<string, unknown>
    ownerId: string
    sortOrder: number
    createdAt: string
    updatedAt: string
}

/**
 * Localized field structure (VLC pattern) - used internally by backend
 * @deprecated Prefer SimpleLocalizedInput for frontend use
 */
export interface LocalizedField {
    _schema: string
    _primary: string
    locales: Record<
        string,
        {
            content: string
            version: number
            isActive: boolean
            createdAt: string
            updatedAt: string
        }
    >
}

/**
 * Helper to extract localized content from VersatileLocalizedContent
 */
export function getVLCString(field: VersatileLocalizedContent | SimpleLocalizedInput | string | undefined | null, locale = 'en'): string {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field !== 'object') return ''

    if ('locales' in field && field.locales && typeof field.locales === 'object') {
        const normalized = normalizeLocale(locale)
        const primary = typeof field._primary === 'string' ? field._primary : undefined
        const entry = field.locales[normalized] || (primary ? field.locales[primary] : undefined)
        return typeof entry?.content === 'string' ? entry.content : ''
    }

    return getSimpleLocalizedValue(field as SimpleLocalizedInput, locale)
}

/**
 * Helper to extract localized content from SimpleLocalizedInput
 */
export function getLocalizedString(field: SimpleLocalizedInput | undefined | null, locale = 'en'): string {
    if (!field) return ''
    return getSimpleLocalizedValue(field, locale)
}

/**
 * Helper to extract localized content from full VLC format
 * @deprecated Use getLocalizedString with SimpleLocalizedInput instead
 */
export function getLocalizedContent(field: LocalizedField | undefined, locale = 'en'): string {
    if (!field) return ''
    const normalized = normalizeLocale(locale)
    const entry = field.locales[normalized] || field.locales[field._primary]
    return entry?.content || ''
}

/**
 * Convert Metahub to MetahubDisplay for table rendering
 */
export function toMetahubDisplay(metahub: Metahub, locale = 'en'): MetahubDisplay {
    return {
        ...metahub,
        name: getVLCString(metahub.name, locale),
        description: getVLCString(metahub.description, locale)
    }
}

/**
 * Convert Hub to HubDisplay for table rendering
 */
export function toHubDisplay(hub: Hub, locale = 'en'): HubDisplay {
    const name = getVLCString(hub.name, locale)
    return {
        ...hub,
        // Fallback to codename if name is empty
        name: name || hub.codename || '',
        description: getVLCString(hub.description, locale)
    }
}

/**
 * Convert Attribute to AttributeDisplay for table rendering
 */
export function toAttributeDisplay(attr: Attribute, locale = 'en'): AttributeDisplay {
    return {
        ...attr,
        name: getVLCString(attr.name, locale)
    }
}

/**
 * Convert HubRecord to HubRecordDisplay for table rendering
 * Uses first attribute value as name, or record id as fallback
 */
export function toHubRecordDisplay(record: HubRecord, attributes: Attribute[] = [], locale = 'en'): HubRecordDisplay {
    // Find first string attribute to use as display name
    const firstStringAttr = attributes.find((a) => a.dataType === 'STRING')
    const rawValue = firstStringAttr ? record.data[firstStringAttr.codename] : undefined
    const nameValue =
        firstStringAttr && rawValue !== undefined && rawValue !== null
            ? getVLCString(rawValue as VersatileLocalizedContent, locale) || String(rawValue)
            : `Record ${record.id.slice(0, 8)}`

    return {
        ...record,
        name: nameValue,
        description: ''
    }
}

// ============ LEGACY TYPES (deprecated, kept for backward compatibility) ============

/** @deprecated Use Hub instead */
export interface MetaSection {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    // Optional aggregated counter provided by backend list endpoint
    meta_entitiesCount?: number
    role?: MetahubRole
    permissions?: MetahubPermissions
}

/** @deprecated Use Attribute instead */
export interface MetaEntity {
    id: string
    name: string
    description?: string
    createdAt: string
    updatedAt: string
    role?: MetahubRole
    permissions?: MetahubPermissions
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
