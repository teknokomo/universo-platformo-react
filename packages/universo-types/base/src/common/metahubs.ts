// Shared metahubs metadata types and fixed values and configuration.
// Keep runtime-safe values for validation and enum-like usage.

import type { VersionedLocalizedContent } from './admin'
import type { ComponentManifest } from './entityComponents'
import type { EntityTypeUIConfig } from './entityTypeDefinition'
import type { SharedBehavior } from './shared'
import type { ScriptAttachmentKind } from './scripts'

/**
 * Supported attribute data types.
 * Note: DATETIME was removed in favor of DATE with dateComposition setting.
 */
export const FIELD_DEFINITION_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] as const

export type FieldDefinitionDataType = (typeof FIELD_DEFINITION_DATA_TYPES)[number]

// eslint-disable-next-line no-redeclare
export const FieldDefinitionDataType = FIELD_DEFINITION_DATA_TYPES.reduce((acc, value) => {
    acc[value] = value
    return acc
}, {} as Record<FieldDefinitionDataType, FieldDefinitionDataType>)

/**
 * Supported constant data types.
 * Constants use a strict subset of attribute types (no REF/JSON/TABLE at this stage).
 */
export const FIXED_VALUE_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'] as const
export type FixedValueDataType = (typeof FIXED_VALUE_DATA_TYPES)[number]

// eslint-disable-next-line no-redeclare
export const FixedValueDataType = FIXED_VALUE_DATA_TYPES.reduce((acc, value) => {
    acc[value] = value
    return acc
}, {} as Record<FixedValueDataType, FixedValueDataType>)

// ═══════════════════════════════════════
// Metahub Settings Types
// ═══════════════════════════════════════

/** Codename naming styles supported by the platform. */
export type CodenameStyle = 'kebab-case' | 'pascal-case'

/** Codename alphabet — which character sets are allowed in codenames. */
export type CodenameAlphabet = 'en' | 'ru' | 'en-ru'

/** Global metahub dialog width presets for modal editing surfaces. */
export type DialogSizePreset = 'small' | 'medium' | 'large'

/** How modal dialogs can be dismissed in metahub authoring surfaces. */
export type DialogCloseBehavior = 'strict-modal' | 'backdrop-close'

/** Entity metadata kinds that expose entity-scoped settings. */
export const ENTITY_SETTINGS_KINDS = ['hub', 'catalog', 'set', 'enumeration'] as const
export type EntitySettingsKind = (typeof ENTITY_SETTINGS_KINDS)[number]

/** Neutral entity-authoring surface aliases that map to stored builtin kind values. */
export const ENTITY_SURFACE_KEYS = ['treeEntity', 'linkedCollection', 'valueGroup', 'optionList'] as const
export type EntitySurfaceKey = (typeof ENTITY_SURFACE_KEYS)[number]

export type EntitySettingsScope = EntitySettingsKind | EntitySurfaceKey

const ENTITY_SURFACE_TO_SETTINGS_KIND_MAP: Record<EntitySurfaceKey, EntitySettingsKind> = {
    treeEntity: 'hub',
    linkedCollection: 'catalog',
    valueGroup: 'set',
    optionList: 'enumeration'
}

const SETTINGS_KIND_TO_ENTITY_SURFACE_MAP: Record<EntitySettingsKind, EntitySurfaceKey> = {
    hub: 'treeEntity',
    catalog: 'linkedCollection',
    set: 'valueGroup',
    enumeration: 'optionList'
}

export const ENTITY_SURFACE_LABELS: Record<EntitySurfaceKey, { singular: string; plural: string }> = {
    treeEntity: { singular: 'Hub', plural: 'Hubs' },
    linkedCollection: { singular: 'Catalog', plural: 'Catalogs' },
    valueGroup: { singular: 'Set', plural: 'Sets' },
    optionList: { singular: 'Enumeration', plural: 'Enumerations' }
}

export const isEntitySurfaceKey = (value: string): value is EntitySurfaceKey =>
    Object.prototype.hasOwnProperty.call(ENTITY_SURFACE_TO_SETTINGS_KIND_MAP, value)

export const resolveEntitySettingsKind = (scope: EntitySettingsScope): EntitySettingsKind =>
    isEntitySurfaceKey(scope) ? ENTITY_SURFACE_TO_SETTINGS_KIND_MAP[scope] : scope

export const resolveBuiltinEntityKindFromSurface = (surface: EntitySurfaceKey): BuiltinEntityKind =>
    ENTITY_SURFACE_TO_SETTINGS_KIND_MAP[surface]

export const resolveEntitySurfaceKey = (scope: EntitySettingsScope | string): EntitySurfaceKey | null => {
    if (isEntitySurfaceKey(scope)) {
        return scope
    }

    return Object.prototype.hasOwnProperty.call(SETTINGS_KIND_TO_ENTITY_SURFACE_MAP, scope)
        ? SETTINGS_KIND_TO_ENTITY_SURFACE_MAP[scope as EntitySettingsKind]
        : null
}

/** Tab groups for the Settings UI. */
export const METAHUB_SETTINGS_TABS = ['general', 'common', ...ENTITY_SETTINGS_KINDS] as const
export type SettingsTab = (typeof METAHUB_SETTINGS_TABS)[number]

/** Build an entity metadata setting key in the canonical entity-scoped namespace. */
export const buildEntitySettingKey = (kind: EntitySettingsKind, suffix: string): string => `entity.${kind}.${suffix}`

/** Build an entity metadata setting key from a neutral entity-surface alias. */
export const buildEntitySurfaceSettingKey = (surface: EntitySurfaceKey, suffix: string): string =>
    buildEntitySettingKey(resolveEntitySettingsKind(surface), suffix)

/** Value type discriminator for settings. */
export type SettingValueType = 'string' | 'boolean' | 'select' | 'multiselect' | 'number'

/** Individual setting definition in the registry. */
export interface SettingDefinition {
    /** Dot-notation key stored in _mhb_settings.key */
    key: string
    /** Which tab this setting belongs to */
    tab: SettingsTab
    /** Value type for UI rendering */
    valueType: SettingValueType
    /** Default value (used when setting doesn't exist in DB) */
    defaultValue: unknown
    /** For 'select' / 'multiselect' type — list of allowed values */
    options?: readonly string[]
    /** Sort order within its tab */
    sortOrder: number
}

/**
 * Shape of a setting row returned by the API.
 * Matches _mhb_settings table structure.
 */
export interface MetahubSettingRow {
    id: string
    key: string
    value: Record<string, unknown>
    _upl_version: number
    _upl_updated_at: string
    _upl_updated_by: string | null
}

/**
 * Bulk update payload: array of { key, value } pairs.
 * Backend will upsert (insert if missing, update if exists).
 */
export interface SettingsUpdatePayload {
    settings: Array<{
        key: string
        value: Record<string, unknown>
    }>
}

/**
 * All known metahub settings with their metadata.
 * Single source of truth for both backend validation and frontend UI rendering.
 */
export const METAHUB_SETTINGS_REGISTRY: readonly SettingDefinition[] = [
    // ── General ──
    // NOTE: `general.language` = default primary locale for VLC fields in metahub entities.
    // - 'system' means current interface language
    // - explicit locale code means fixed locale for VLC primary values
    {
        key: 'general.language',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'system',
        options: ['system', 'en', 'ru'] as const,
        sortOrder: 1
    },
    {
        key: 'general.timezone',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'UTC',
        options: ['UTC', 'Europe/Moscow', 'Asia/Tokyo', 'America/New_York', 'Europe/London'] as const,
        sortOrder: 2
    },
    {
        key: 'general.codenameStyle',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'pascal-case',
        options: ['kebab-case', 'pascal-case'] as const,
        sortOrder: 3
    },
    {
        key: 'general.codenameAlphabet',
        tab: 'general',
        valueType: 'select',
        defaultValue: 'en-ru',
        options: ['en', 'ru', 'en-ru'] as const,
        sortOrder: 4
    },
    {
        key: 'general.codenameAllowMixedAlphabets',
        tab: 'general',
        valueType: 'boolean',
        defaultValue: false,
        sortOrder: 5
    },
    {
        key: 'general.codenameAutoConvertMixedAlphabets',
        tab: 'general',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 6
    },
    {
        key: 'general.codenameAutoReformat',
        tab: 'general',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 7
    },
    {
        key: 'general.codenameRequireReformat',
        tab: 'general',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 8
    },
    {
        key: 'general.codenameLocalizedEnabled',
        tab: 'general',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 9
    },
    // ── Common ──
    {
        key: 'common.dialogSizePreset',
        tab: 'common',
        valueType: 'select',
        defaultValue: 'medium',
        options: ['small', 'medium', 'large'] as const,
        sortOrder: 1
    },
    {
        key: 'common.dialogAllowFullscreen',
        tab: 'common',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: 'common.dialogAllowResize',
        tab: 'common',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 3
    },
    {
        key: 'common.dialogCloseBehavior',
        tab: 'common',
        valueType: 'select',
        defaultValue: 'strict-modal',
        options: ['strict-modal', 'backdrop-close'] as const,
        sortOrder: 4
    },
    // ── Hubs ──
    {
        key: buildEntitySettingKey('hub', 'allowCopy'),
        tab: 'hub',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: buildEntitySettingKey('hub', 'allowDelete'),
        tab: 'hub',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: buildEntitySettingKey('hub', 'allowNesting'),
        tab: 'hub',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 3
    },
    {
        key: buildEntitySettingKey('hub', 'resetNestingOnce'),
        tab: 'hub',
        valueType: 'boolean',
        defaultValue: false,
        sortOrder: 4
    },
    {
        key: buildEntitySettingKey('hub', 'allowAttachExistingEntities'),
        tab: 'hub',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 5
    },

    // ── Catalogs ──
    {
        key: buildEntitySettingKey('catalog', 'allowCopy'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: buildEntitySettingKey('catalog', 'allowDelete'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: buildEntitySettingKey('catalog', 'attributeCodenameScope'),
        tab: 'catalog',
        valueType: 'select',
        defaultValue: 'per-level',
        options: ['per-level', 'global'] as const,
        sortOrder: 3
    },
    {
        key: buildEntitySettingKey('catalog', 'allowedAttributeTypes'),
        tab: 'catalog',
        valueType: 'multiselect',
        defaultValue: [...FIELD_DEFINITION_DATA_TYPES],
        options: FIELD_DEFINITION_DATA_TYPES,
        sortOrder: 4
    },
    {
        key: buildEntitySettingKey('catalog', 'allowAttributeCopy'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 5
    },
    {
        key: buildEntitySettingKey('catalog', 'allowAttributeDelete'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 6
    },
    {
        key: buildEntitySettingKey('catalog', 'allowDeleteLastDisplayAttribute'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 7
    },
    {
        key: buildEntitySettingKey('catalog', 'allowElementCopy'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 8
    },
    {
        key: buildEntitySettingKey('catalog', 'allowElementDelete'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 9
    },
    {
        key: buildEntitySettingKey('catalog', 'allowAttributeMoveBetweenRootAndChildren'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 10
    },
    {
        key: buildEntitySettingKey('catalog', 'allowAttributeMoveBetweenChildLists'),
        tab: 'catalog',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 11
    },

    // ── Sets ──
    {
        key: buildEntitySettingKey('set', 'allowCopy'),
        tab: 'set',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: buildEntitySettingKey('set', 'allowDelete'),
        tab: 'set',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    },
    {
        key: buildEntitySettingKey('set', 'constantCodenameScope'),
        tab: 'set',
        valueType: 'select',
        defaultValue: 'global',
        options: ['global'] as const,
        sortOrder: 3
    },
    {
        key: buildEntitySettingKey('set', 'allowedConstantTypes'),
        tab: 'set',
        valueType: 'multiselect',
        defaultValue: [...FIXED_VALUE_DATA_TYPES],
        options: FIXED_VALUE_DATA_TYPES,
        sortOrder: 4
    },
    {
        key: buildEntitySettingKey('set', 'allowConstantCopy'),
        tab: 'set',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 5
    },
    {
        key: buildEntitySettingKey('set', 'allowConstantDelete'),
        tab: 'set',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 6
    },

    // ── Enumerations ──
    {
        key: buildEntitySettingKey('enumeration', 'allowCopy'),
        tab: 'enumeration',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 1
    },
    {
        key: buildEntitySettingKey('enumeration', 'allowDelete'),
        tab: 'enumeration',
        valueType: 'boolean',
        defaultValue: true,
        sortOrder: 2
    }
]

/** Helper to get settings for a specific tab. */
export const getSettingsForTab = (tab: SettingsTab): SettingDefinition[] =>
    METAHUB_SETTINGS_REGISTRY.filter((s) => s.tab === tab).sort((a, b) => a.sortOrder - b.sortOrder)

/** Helper to get a setting definition by key. */
export const getSettingDefinition = (key: string): SettingDefinition | undefined => METAHUB_SETTINGS_REGISTRY.find((s) => s.key === key)

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
export interface FieldDefinitionValidationRules {
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

    // TABLE settings
    /** Minimum number of rows in TABLE child table (leave empty for no limit) */
    minRows?: number | null
    /** Maximum number of rows in TABLE child table (leave empty for no limit) */
    maxRows?: number | null
    /** Maximum number of child attributes allowed inside TABLE (leave empty for no limit) */
    maxChildAttributes?: number | null
}

/**
 * Returns default validation rules for a given data type.
 */
export function getDefaultValidationRules(dataType: FieldDefinitionDataType): Partial<FieldDefinitionValidationRules> {
    switch (dataType) {
        case 'STRING':
            return { maxLength: null, versioned: false, localized: false }
        case 'NUMBER':
            return { precision: 10, scale: 0, nonNegative: false }
        case 'DATE':
            return { dateComposition: 'datetime' } // Full datetime by default
        case 'JSON':
            return {}
        case 'TABLE':
            return {} // TABLE has no validation rules — it's a container
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
 * Maps logical FieldDefinitionDataType + validation rules to physical PostgreSQL type.
 * This mirrors SchemaGenerator.mapDataType() logic but without Knex dependency.
 *
 * @param dataType - Logical data type from FieldDefinitionDataType enum
 * @param rules - Validation rules containing type-specific settings
 * @returns Physical type information for UI display
 */
export function getPhysicalDataType(dataType: FieldDefinitionDataType, rules?: Partial<FieldDefinitionValidationRules>): PhysicalTypeInfo {
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

        case 'TABLE':
            // TABLE is not a physical column — it's a virtual container
            return { type: 'TABLE', isVLC: false }

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
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub'
} as const

export const MetaEntityKind = _META_ENTITY_KIND_MAP

export const BuiltinEntityKinds = {
    CATALOG: 'catalog',
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub'
} as const

// eslint-disable-next-line no-redeclare
export type MetaEntityKind = (typeof _META_ENTITY_KIND_MAP)[keyof typeof _META_ENTITY_KIND_MAP]

export type BuiltinEntityKind = (typeof BuiltinEntityKinds)[keyof typeof BuiltinEntityKinds]
export const BUILTIN_ENTITY_KIND_VALUES = Object.values(BuiltinEntityKinds) as [BuiltinEntityKind, ...BuiltinEntityKind[]]
const BUILTIN_ENTITY_KIND_SET = new Set<string>(BUILTIN_ENTITY_KIND_VALUES)
export const isBuiltinEntityKind = (kind: string): kind is BuiltinEntityKind => BUILTIN_ENTITY_KIND_SET.has(kind)

export type EntityKind = BuiltinEntityKind | (string & {})

/** Array of valid MetaEntityKind values for Zod validation */
export const META_ENTITY_KINDS = Object.values(_META_ENTITY_KIND_MAP) as [MetaEntityKind, ...MetaEntityKind[]]

export interface MetaPresentation {
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
}

export interface MetaFieldDefinition {
    id: string
    codename: string
    dataType: FieldDefinitionDataType
    isRequired: boolean
    /** Whether this attribute is used to display the element when referenced */
    isDisplayAttribute?: boolean
    /** ID of the target entity for REF field type */
    targetEntityId?: string | null
    /** Kind of the target entity for REF field type (polymorphic discriminator) */
    targetEntityKind?: EntityKind | null
    /** Target constant id for REF fields that point to `set` entities. */
    targetConstantId?: string | null
    presentation: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    /** Parent TABLE attribute ID (for child attributes of tabular parts) */
    parentAttributeId?: string | null
    /** Child fields for TABLE attributes (populated in snapshots) */
    childFields?: MetaFieldDefinition[]
}

export interface MetaEntityDefinition {
    id: string
    kind: EntityKind
    codename: string
    presentation: MetaPresentation
    fields: MetaFieldDefinition[]
}

/**
 * UI representation mode for REF fields targeting enumeration values.
 * - select: dropdown
 * - radio: radio group
 * - label: read-only text label
 */
export const ENUM_PRESENTATION_MODES = ['select', 'radio', 'label'] as const
export type EnumPresentationMode = (typeof ENUM_PRESENTATION_MODES)[number]

/**
 * Extended UI config for REF fields.
 * This shape is optional and stored inside generic uiConfig JSON.
 */
export interface AttributeRefUiConfig {
    /** Applies when REF points to an enumeration entity. */
    enumPresentationMode?: EnumPresentationMode
    /** Optional default enum value id used by runtime forms. */
    defaultEnumValueId?: string | null
}

/**
 * TABLE type UI configuration.
 * Controls how the tabular part is displayed.
 */
export interface TableTypeUiConfig {
    /** Whether to show the table title in element forms */
    showTitle?: boolean
}

/** Data types allowed as children inside TABLE attributes (no nesting) */
export const TABLE_CHILD_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'] as const
export type TableChildDataType = (typeof TABLE_CHILD_DATA_TYPES)[number]

/**
 * Enumeration value row used in metahub/app snapshots and API responses.
 */
export interface EnumerationValueDefinition {
    id: string
    objectId: string
    codename: string
    presentation: MetaPresentation
    sortOrder: number
    isDefault: boolean
}

// ========= Dashboard layout zones/widgets (Metahubs + Runtime UI) =========

export const DASHBOARD_LAYOUT_ZONES = ['left', 'top', 'right', 'bottom', 'center'] as const
export type DashboardLayoutZone = (typeof DASHBOARD_LAYOUT_ZONES)[number]

export const DASHBOARD_LAYOUT_WIDGETS = [
    // Left zone widgets (decomposed from former monolithic sideMenu)
    { key: 'brandSelector', allowedZones: ['left'] as const, multiInstance: false },
    { key: 'divider', allowedZones: ['left', 'top', 'bottom', 'right'] as const, multiInstance: true },
    { key: 'menuWidget', allowedZones: ['left'] as const, multiInstance: true },
    { key: 'spacer', allowedZones: ['left', 'right'] as const, multiInstance: true },
    { key: 'infoCard', allowedZones: ['left', 'right'] as const, multiInstance: false },
    { key: 'userProfile', allowedZones: ['left'] as const, multiInstance: false },
    // Top zone widgets
    { key: 'appNavbar', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'header', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'breadcrumbs', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'search', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'datePicker', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'optionsMenu', allowedZones: ['top'] as const, multiInstance: false },
    { key: 'languageSwitcher', allowedZones: ['top'] as const, multiInstance: false },
    // Center zone widgets
    { key: 'overviewTitle', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'overviewCards', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'sessionsChart', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'pageViewsChart', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'detailsTitle', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'detailsTable', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'columnsContainer', allowedZones: ['center'] as const, multiInstance: true },
    { key: 'quizWidget', allowedZones: ['center', 'right'] as const, multiInstance: true },
    // LMS widgets
    { key: 'moduleViewerWidget', allowedZones: ['center'] as const, multiInstance: false },
    { key: 'statsViewerWidget', allowedZones: ['center', 'right'] as const, multiInstance: false },
    { key: 'qrCodeWidget', allowedZones: ['center', 'right'] as const, multiInstance: true },
    // Right zone widgets
    { key: 'detailsSidePanel', allowedZones: ['right'] as const, multiInstance: false },
    { key: 'productTree', allowedZones: ['center', 'right'] as const, multiInstance: false },
    { key: 'usersByCountryChart', allowedZones: ['center', 'right'] as const, multiInstance: false },
    // Bottom zone widgets
    { key: 'footer', allowedZones: ['bottom'] as const, multiInstance: false }
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
    /** Enables direct binding of this menu widget to a specific hub. */
    bindToHub?: boolean
    /** Hub ID used when direct binding is enabled. */
    boundHubId?: string | null
    sharedBehavior?: SharedBehavior
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
    hubId?: string | null
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
    isActive: boolean
}

// ========= ColumnsContainer widget config =========

/** A single widget entry rendered inside a column. */
export interface ColumnsContainerColumnWidget {
    /** Widget key to render. */
    widgetKey: DashboardLayoutWidgetKey
}

/** A single column inside a columnsContainer widget. */
export interface ColumnsContainerColumn {
    /** Client-generated UUID for stable identity. */
    id: string
    /** MUI Grid column width (1-12). */
    width: number
    /** Ordered list of widgets rendered vertically inside this column. */
    widgets: ColumnsContainerColumnWidget[]
}

/** Configuration for the columnsContainer widget — multi-column center layout. */
export interface ColumnsContainerConfig {
    /** Ordered array of columns. Widths should sum to 12 for a balanced row. */
    columns: ColumnsContainerColumn[]
    sharedBehavior?: SharedBehavior
}

export interface QuizWidgetConfig {
    title?: string
    description?: string
    scriptCodename?: string | null
    attachedToKind?: ScriptAttachmentKind
    quizId?: string | null
    mountMethodName?: string
    submitMethodName?: string
    emptyStateTitle?: string
    emptyStateDescription?: string
    sharedBehavior?: SharedBehavior
}

export interface ModuleViewerWidgetConfig {
    scriptCodename?: string | null
    attachedToKind?: ScriptAttachmentKind
    mountMethodName?: string
    emptyStateTitle?: string
    emptyStateDescription?: string
    sharedBehavior?: SharedBehavior
}

export interface StatsViewerWidgetConfig {
    scriptCodename?: string | null
    attachedToKind?: ScriptAttachmentKind
    mountMethodName?: string
    emptyStateTitle?: string
    emptyStateDescription?: string
    sharedBehavior?: SharedBehavior
}

export interface QRCodeWidgetConfig {
    url: string
    publicLinkSlug?: string
    size?: number
    title?: string
    sharedBehavior?: SharedBehavior
}

// ========= Menu item kinds (used by MenuWidgetConfig) =========

export const METAHUB_MENU_ITEM_KINDS = ['catalog', 'catalogs_all', 'hub', 'link'] as const
export type MetahubMenuItemKind = (typeof METAHUB_MENU_ITEM_KINDS)[number]

// ========= Template Manifest Types =========

/** Schema version discriminator for future manifest format evolution. */
export type MetahubTemplateSchemaVersion = 'metahub-template/v1'

/** Snapshot envelope version used for metahub export/publication snapshots. */
export type MetahubSnapshotFormatVersion = 1 | 2 | 3

/**
 * Unified version envelope that separates:
 * - platform structure version (DDL)
 * - template semantic version
 * - snapshot format version
 */
export interface MetahubSnapshotVersionEnvelope {
    structureVersion: string
    templateVersion: string | null
    snapshotFormatVersion: MetahubSnapshotFormatVersion
}

export const CATALOG_SYSTEM_FIELD_KEYS = [
    'app.published',
    'app.published_at',
    'app.published_by',
    'app.archived',
    'app.archived_at',
    'app.archived_by',
    'app.deleted',
    'app.deleted_at',
    'app.deleted_by',
    'upl.archived',
    'upl.archived_at',
    'upl.archived_by',
    'upl.deleted',
    'upl.deleted_at',
    'upl.deleted_by'
] as const

export type CatalogSystemFieldKey = (typeof CATALOG_SYSTEM_FIELD_KEYS)[number]
export type CatalogSystemFieldLayer = 'app' | 'upl'
export type CatalogSystemFieldFamily = 'published' | 'archived' | 'deleted'
export type CatalogSystemFieldValueType = 'boolean' | 'timestamp' | 'uuid'

export interface CatalogSystemFieldDefinition {
    key: CatalogSystemFieldKey
    columnName: string
    layer: CatalogSystemFieldLayer
    family: CatalogSystemFieldFamily
    valueType: CatalogSystemFieldValueType
    fieldDefinitionDataType: FieldDefinitionDataType
    physicalType: 'boolean' | 'timestamptz' | 'uuid'
    sortOrder: number
    defaultEnabled: boolean
    canDisable: boolean
    requires?: CatalogSystemFieldKey[]
}

export interface CatalogSystemFieldState {
    key: CatalogSystemFieldKey
    enabled: boolean
}

export interface PlatformSystemFieldDefinitionsPolicy {
    allowConfiguration: boolean
    forceCreate: boolean
    ignoreMetahubSettings: boolean
}

export const PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS = {
    allowConfiguration: 'platformSystemFieldDefinitionsConfigurable',
    forceCreate: 'platformSystemFieldDefinitionsRequired',
    ignoreMetahubSettings: 'platformSystemFieldDefinitionsIgnoreMetahubSettings'
} as const

export const DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY: PlatformSystemFieldDefinitionsPolicy = {
    allowConfiguration: false,
    forceCreate: true,
    ignoreMetahubSettings: true
}

export interface FieldDefinitionSystemMetadata {
    isSystem: boolean
    systemKey: CatalogSystemFieldKey | null
    isManaged: boolean
    isEnabled: boolean
}

export interface LifecycleFamilyContract {
    enabled: boolean
    trackAt: boolean
    trackBy: boolean
}

export interface DeleteLifecycleContract {
    mode: 'soft' | 'hard'
    trackAt: boolean
    trackBy: boolean
}

export interface ApplicationLifecycleContract {
    publish: LifecycleFamilyContract
    archive: LifecycleFamilyContract
    delete: DeleteLifecycleContract
}

export interface LifecycleFamilyContractInput {
    enabled?: boolean
    trackAt?: boolean
    trackBy?: boolean
}

export interface DeleteLifecycleContractInput {
    mode?: 'soft' | 'hard'
    trackAt?: boolean
    trackBy?: boolean
}

export interface ApplicationLifecycleContractInput {
    publish?: LifecycleFamilyContractInput
    archive?: LifecycleFamilyContractInput
    delete?: DeleteLifecycleContractInput
}

export interface CatalogSystemFieldsSnapshot {
    fields: CatalogSystemFieldState[]
    lifecycleContract: ApplicationLifecycleContract
}

/** Template metadata (author, tags, icon). */
export interface MetahubTemplateMeta {
    author?: string
    tags?: string[]
    icon?: string
    previewUrl?: string
}

/** Seed layout definition (codename-based, no UUIDs). */
export interface TemplateSeedLayout {
    codename: string
    templateKey: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    isDefault: boolean
    isActive: boolean
    sortOrder: number
    config?: Record<string, unknown>
}

/** Seed zone widget assignment. */
export interface TemplateSeedZoneWidget {
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    sortOrder: number
    config?: Record<string, unknown>
    /** When omitted, defaults to true at seed time. */
    isActive?: boolean
}

/** Seed setting key/value pair. */
export interface TemplateSeedSetting {
    key: string
    value: Record<string, unknown> | string | number | boolean
}

/** Seed entity attribute (uses codenames for REF targets). */
export interface TemplateSeedAttribute {
    codename: string
    dataType: FieldDefinitionDataType
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isRequired?: boolean
    isDisplayAttribute?: boolean
    sortOrder?: number
    targetEntityCodename?: string
    targetEntityKind?: EntityKind
    targetConstantCodename?: string
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    /** Child attributes for TABLE data type (no nesting allowed) */
    childAttributes?: TemplateSeedAttribute[]
}

/** Seed set constant definition (uses codename identity inside a set). */
export interface TemplateSeedFixedValue {
    codename: string
    dataType: FixedValueDataType
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder?: number
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    value?: unknown
}

/** Seed entity definition keyed by a concrete entity kind. */
export interface TemplateSeedEntity {
    codename: string
    kind: EntityKind
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    config?: Record<string, unknown>
    attributes?: TemplateSeedAttribute[]
    /** Constants are supported only for entities with kind = set. */
    fixedValues?: TemplateSeedFixedValue[]
    hubs?: string[]
}

/** Seed element (predefined data row for an entity). */
export interface TemplateSeedElement {
    codename: string
    data: Record<string, unknown>
    sortOrder: number
}

/** Seed enumeration value (predefined fixed value for an enumeration entity). */
export interface TemplateSeedEnumerationValue {
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    sortOrder?: number
    isDefault?: boolean
}

/** All seed data that populates system tables when creating a metahub from a template. */
export interface MetahubTemplateSeed {
    layouts: TemplateSeedLayout[]
    /** Zone widget assignments keyed by layout codename. */
    layoutZoneWidgets: Record<string, TemplateSeedZoneWidget[]>
    settings?: TemplateSeedSetting[]
    entities?: TemplateSeedEntity[]
    /** Predefined elements keyed by entity codename. */
    elements?: Record<string, TemplateSeedElement[]>
    /** Enumeration values keyed by enumeration codename. */
    optionValues?: Record<string, TemplateSeedEnumerationValue[]>
}

/**
 * Root template manifest — stored as JSON file in the codebase
 * and as JSONB in templates_versions.manifest_json.
 */
export interface MetahubTemplateManifest {
    $schema: MetahubTemplateSchemaVersion
    codename: string
    version: string
    minStructureVersion: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    meta?: MetahubTemplateMeta
    presets?: TemplatePresetReference[]
    seed: MetahubTemplateSeed
}

export const TEMPLATE_DEFINITION_TYPES = ['metahub_template', 'entity_type_preset'] as const

export type TemplateDefinitionType = (typeof TEMPLATE_DEFINITION_TYPES)[number]

export interface EntityTypePresetManifest {
    $schema: 'entity-type-preset/v1'
    codename: string
    version: string
    minStructureVersion: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    meta?: MetahubTemplateMeta
    entityType: {
        kindKey: string
        codename?: VersionedLocalizedContent<string>
        components: ComponentManifest
        ui: EntityTypeUIConfig
        presentation?: Record<string, unknown>
        config?: Record<string, unknown>
    }
    defaultInstances?: PresetDefaultInstance[]
}

export interface PresetDefaultInstance {
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    config?: Record<string, unknown>
    hubs?: string[]
    attributes?: TemplateSeedAttribute[]
    fixedValues?: TemplateSeedFixedValue[]
    elements?: TemplateSeedElement[]
    optionValues?: TemplateSeedEnumerationValue[]
}

export interface TemplatePresetReference {
    presetCodename: string
    includedByDefault?: boolean
}

export type TemplateDefinitionManifest = MetahubTemplateManifest | EntityTypePresetManifest

/**
 * Preset toggles passed at metahub creation time.
 * Determines which preset-defined entity types and default instances are created.
 * Branch and Layout are always required (no toggle).
 */
export interface MetahubCreateOptions {
    presetToggles?: Record<string, boolean>
}

export interface MetahubMenuEntityType {
    kindKey: string
    title: string
    iconName: string
    sidebarSection?: 'objects' | 'admin'
    sidebarOrder?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Template API DTOs — shared response types for template catalog endpoints
// ═══════════════════════════════════════════════════════════════════════════

/** Template version summary DTO (GET /templates response element). */
export interface TemplateVersionSummaryDTO {
    id: string
    versionNumber: number
    versionLabel: string
    changelog?: VersionedLocalizedContent<string> | string | null
}

/** Template summary DTO (GET /templates response element). */
export interface TemplateSummaryDTO {
    id: string
    codename: string
    definitionType: TemplateDefinitionType
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    icon?: string | null
    isSystem: boolean
    sortOrder: number
    activeVersion: TemplateVersionSummaryDTO | null
}

/** Template detail DTO (GET /templates/:templateId response). */
export interface TemplateDetailDTO extends Omit<TemplateSummaryDTO, 'activeVersion'> {
    isActive: boolean
    activeVersionId: string | null
    activeVersionManifest: TemplateDefinitionManifest | null
    versions: Array<
        TemplateVersionSummaryDTO & {
            isActive: boolean
            createdAt: string
        }
    >
}

/** Paginated templates list response DTO. */
export interface TemplatesListResponseDTO {
    data: TemplateSummaryDTO[]
    total: number
}

// ========= Migration / Cleanup structured blockers =========

/** A structured blocker object returned by cleanup / migration analysis. */
export interface StructuredBlocker {
    /** Machine-readable blocker code for i18n look-up. */
    code: string
    /** Interpolation parameters for the i18n message. */
    params: Record<string, string>
    /** English fallback message. */
    message: string
}

// ========= Application migration types =========

/**
 * Severity level for schema updates.
 * Controls how the UI presents the update notification:
 * - MANDATORY: Blocking dialog, user must apply before accessing the app
 * - RECOMMENDED: Dismissible banner, user can postpone
 * - OPTIONAL: Info badge, user applies manually
 */
export enum UpdateSeverity {
    MANDATORY = 'mandatory',
    RECOMMENDED = 'recommended',
    OPTIONAL = 'optional'
}

/** Response from GET /application/:applicationId/migrations/status */
export interface ApplicationMigrationStatusResponse {
    applicationId: string
    schemaName: string | null
    schemaExists: boolean
    currentAppStructureVersion: number
    targetAppStructureVersion: number
    structureUpgradeRequired: boolean
    publicationUpdateAvailable: boolean
    migrationRequired: boolean
    severity: UpdateSeverity
    blockers: StructuredBlocker[]
    status: 'up_to_date' | 'requires_migration' | 'blocked'
    code: 'UP_TO_DATE' | 'MIGRATION_REQUIRED' | 'MIGRATION_BLOCKED'
    /** Role of the requesting user within this application */
    currentUserRole?: 'owner' | 'admin' | 'editor' | 'member'
    /** True when the application is actively being synced */
    isMaintenance?: boolean
}

/** Response from GET /metahub/:metahubId/migrations/status */
export interface MetahubMigrationStatusResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: string
    targetStructureVersion: string
    structureUpgradeRequired: boolean
    templateUpgradeRequired: boolean
    migrationRequired: boolean
    severity: UpdateSeverity
    blockers: StructuredBlocker[]
    status: 'up_to_date' | 'requires_migration' | 'blocked'
    code: 'UP_TO_DATE' | 'MIGRATION_REQUIRED' | 'MIGRATION_BLOCKED'
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
}
