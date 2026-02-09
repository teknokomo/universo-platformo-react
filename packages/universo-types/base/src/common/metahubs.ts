// Shared metahubs metadata types and constants.
// Keep runtime-safe values for validation and enum-like usage.

import type { VersionedLocalizedContent } from './admin'

/**
 * Supported attribute data types.
 * Note: DATETIME was removed in favor of DATE with dateComposition setting.
 */
export const ATTRIBUTE_DATA_TYPES = [
    'STRING',
    'NUMBER',
    'BOOLEAN',
    'DATE',
    'REF',
    'JSON',
] as const

export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number]

export const AttributeDataType = ATTRIBUTE_DATA_TYPES.reduce(
    (acc, value) => {
        acc[value] = value
        return acc
    },
    {} as Record<AttributeDataType, AttributeDataType>
)

// ============ TYPE-SPECIFIC CONFIGURATION INTERFACES ============

/**
 * STRING type settings.
 * Controls length limits and pattern validation.
 */
export interface StringTypeConfig {
    /** Maximum length limit (1-10000), null for unlimited */
    maxLength?: number | null
    /** Minimum length (0-maxLength) */
    minLength?: number
    /** Pattern regex for validation */
    pattern?: string
    /** Fixed options list for enum-like behavior */
    options?: string[]
}

/**
 * NUMBER type settings.
 * Controls precision, scale, and range.
 */
export interface NumberTypeConfig {
    /** Total significant digits (1-38) */
    precision?: number
    /** Digits after decimal point (0-precision) */
    scale?: number
    /** Minimum value */
    min?: number
    /** Maximum value */
    max?: number
    /** Only allow non-negative values */
    nonNegative?: boolean
}

/**
 * DATE type settings (replaces former DATETIME).
 * Controls what temporal component to store.
 */
export interface DateTypeConfig {
    /**
     * What component to store:
     * - 'date': DATE only (YYYY-MM-DD)
     * - 'time': TIME only (HH:MM:SS)
     * - 'datetime': Full TIMESTAMPTZ (default for backward compatibility)
     */
    dateComposition?: 'date' | 'time' | 'datetime'
}

/**
 * Combined validation rules with type-specific settings.
 * Stored in attribute's validationRules field.
 */
export interface AttributeValidationRules {
    // Generic rules
    required?: boolean

    // STRING settings
    maxLength?: number | null
    minLength?: number
    pattern?: string
    options?: string[]
    /** Enable versioning (VLC pattern). When true, field stores JSONB instead of TEXT */
    versioned?: boolean
    /** Enable localization (multiple language versions via VLC). When true, field stores JSONB instead of TEXT */
    localized?: boolean

    // NUMBER settings
    precision?: number
    scale?: number
    min?: number
    max?: number
    nonNegative?: boolean

    // DATE settings
    dateComposition?: 'date' | 'time' | 'datetime'
}

/**
 * Returns default validation rules for a given data type.
 */
export function getDefaultValidationRules(dataType: AttributeDataType): Partial<AttributeValidationRules> {
    switch (dataType) {
        case 'STRING':
            return { maxLength: null, versioned: false, localized: false }
        case 'NUMBER':
            return { precision: 10, scale: 0, nonNegative: false }
        case 'DATE':
            return { dateComposition: 'datetime' } // Full datetime by default
        case 'JSON':
            return {}
        default:
            return {}
    }
}

/**
 * Physical PostgreSQL type information returned by getPhysicalDataType().
 */
export interface PhysicalTypeInfo {
    /** PostgreSQL type name (e.g., 'TEXT', 'VARCHAR', 'JSONB', 'TIMESTAMPTZ') */
    type: string
    /** Whether storage uses VLC (versioned/localized content) pattern */
    isVLC: boolean
    /** Optional length for VARCHAR types */
    length?: number
    /** Optional precision for NUMERIC types */
    precision?: number
    /** Optional scale for NUMERIC types */
    scale?: number
}

/**
 * Maps logical AttributeDataType + validation rules to physical PostgreSQL type.
 * This mirrors SchemaGenerator.mapDataType() logic but without Knex dependency.
 *
 * @param dataType - Logical data type from AttributeDataType enum
 * @param rules - Validation rules containing type-specific settings
 * @returns Physical type information for UI display
 */
export function getPhysicalDataType(
    dataType: AttributeDataType,
    rules?: Partial<AttributeValidationRules>
): PhysicalTypeInfo {
    switch (dataType) {
        case 'STRING': {
            // If versioned or localized, store as JSONB for VLC structure
            if (rules?.versioned || rules?.localized) {
                return { type: 'JSONB', isVLC: true }
            }
            // VARCHAR(n) when explicit limit is set
            const maxLength = rules?.maxLength
            if (typeof maxLength === 'number' && maxLength > 0 && maxLength <= 10000) {
                return { type: 'VARCHAR', isVLC: false, length: maxLength }
            }
            // Default: unlimited TEXT
            return { type: 'TEXT', isVLC: false }
        }

        case 'NUMBER': {
            // Max precision limited to 15 due to JavaScript number precision limits
            const precision = Math.min(Math.max(1, rules?.precision ?? 10), 15)
            // Scale must be < precision (at least 1 integer digit required)
            const scale = Math.min(Math.max(0, rules?.scale ?? 0), precision - 1)
            return { type: 'NUMERIC', isVLC: false, precision, scale }
        }

        case 'BOOLEAN':
            return { type: 'BOOLEAN', isVLC: false }

        case 'DATE': {
            const composition = rules?.dateComposition || 'datetime'
            switch (composition) {
                case 'date':
                    return { type: 'DATE', isVLC: false }
                case 'time':
                    return { type: 'TIME', isVLC: false }
                case 'datetime':
                default:
                    return { type: 'TIMESTAMPTZ', isVLC: false }
            }
        }

        case 'REF':
            return { type: 'UUID', isVLC: false }

        case 'JSON':
            return { type: 'JSONB', isVLC: false }

        default:
            return { type: 'TEXT', isVLC: false }
    }
}

/**
 * Formats PhysicalTypeInfo into a human-readable PostgreSQL type string.
 *
 * @param info - Physical type information
 * @returns Formatted string like 'VARCHAR(1024)', 'NUMERIC(10,2)', 'TEXT'
 */
export function formatPhysicalType(info: PhysicalTypeInfo): string {
    switch (info.type) {
        case 'VARCHAR':
            return info.length ? `VARCHAR(${info.length})` : 'VARCHAR'
        case 'NUMERIC':
            return `NUMERIC(${info.precision ?? 10},${info.scale ?? 0})`
        default:
            return info.type
    }
}

const _META_ENTITY_KIND_MAP = {
    CATALOG: 'catalog',
    HUB: 'hub',
    DOCUMENT: 'document',
} as const

export const MetaEntityKind = _META_ENTITY_KIND_MAP

export type MetaEntityKind = (typeof _META_ENTITY_KIND_MAP)[keyof typeof _META_ENTITY_KIND_MAP]

/** Array of valid MetaEntityKind values for Zod validation */
export const META_ENTITY_KINDS = Object.values(_META_ENTITY_KIND_MAP) as [MetaEntityKind, ...MetaEntityKind[]]

export interface MetaPresentation {
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
}

export interface MetaFieldDefinition {
    id: string
    codename: string
    dataType: AttributeDataType
    isRequired: boolean
    /** Whether this attribute is used to display the element when referenced */
    isDisplayAttribute?: boolean
    /** ID of the target entity for REF field type */
    targetEntityId?: string | null
    /** Kind of the target entity for REF field type (polymorphic discriminator) */
    targetEntityKind?: MetaEntityKind | null
    presentation: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

export interface MetaEntityDefinition {
    id: string
    kind: MetaEntityKind
    codename: string
    presentation: MetaPresentation
    fields: MetaFieldDefinition[]
}

// ========= Dashboard layout zones/widgets (Metahubs + Runtime UI) =========

export const DASHBOARD_LAYOUT_ZONES = ['left', 'top', 'right', 'bottom', 'center'] as const
export type DashboardLayoutZone = (typeof DASHBOARD_LAYOUT_ZONES)[number]

export const DASHBOARD_LAYOUT_WIDGETS = [
    // Left zone widgets (decomposed from former monolithic sideMenu)
    { key: 'brandSelector', allowedZones: ['left'] as const, multiInstance: false },
    { key: 'divider', allowedZones: ['left', 'top', 'bottom'] as const, multiInstance: true },
    { key: 'menuWidget', allowedZones: ['left'] as const, multiInstance: true },
    { key: 'spacer', allowedZones: ['left'] as const, multiInstance: true },
    { key: 'infoCard', allowedZones: ['left'] as const, multiInstance: false },
    { key: 'userProfile', allowedZones: ['left'] as const, multiInstance: false },
    // Top zone widgets
    { key: 'appNavbar', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'header', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'breadcrumbs', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'search', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'datePicker', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'optionsMenu', allowedZones: ['top'] as const, multiInstance: false },
    // Center zone widgets
    { key: 'overviewTitle', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'overviewCards', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'sessionsChart', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'pageViewsChart', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'detailsTitle', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'detailsTable', allowedZones: ['center'] as const, multiInstance: false },
    // Right zone widgets
    { key: 'detailsSidePanel', allowedZones: ['right'] as const, multiInstance: false },
    // Bottom zone widgets
    { key: 'footer', allowedZones: ['bottom'] as const, multiInstance: false },
] as const

export type DashboardLayoutWidgetKey = (typeof DASHBOARD_LAYOUT_WIDGETS)[number]['key']

export type DashboardLayoutWidgetDefinition = {
    key: DashboardLayoutWidgetKey
    allowedZones: readonly DashboardLayoutZone[]
    multiInstance: boolean
}

/** Configuration for the menuWidget — embeds menu definition directly in widget config. */
export interface MenuWidgetConfig {
    showTitle: boolean
    title: VersionedLocalizedContent<string>
    /** When true, runtime automatically includes all catalogs as menu items. */
    autoShowAllCatalogs: boolean
    items: MenuWidgetConfigItem[]
}

/** A single menu item embedded in MenuWidgetConfig. */
export interface MenuWidgetConfigItem {
    /** Client-generated UUID for stable DnD identity. */
    id: string
    kind: MetahubMenuItemKind
    title: VersionedLocalizedContent<string>
    icon?: string | null
    href?: string | null
    catalogId?: string | null
    sortOrder: number
    isActive: boolean
}

export interface DashboardLayoutZoneWidget {
    id: string
    layoutId: string
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config: Record<string, unknown>
}

// ========= Menu item kinds (used by MenuWidgetConfig) =========

export const METAHUB_MENU_ITEM_KINDS = ['catalog', 'catalogs_all', 'link'] as const
export type MetahubMenuItemKind = (typeof METAHUB_MENU_ITEM_KINDS)[number]
