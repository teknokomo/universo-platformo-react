// Shared metahubs metadata types and constants.
// Keep runtime-safe values for validation and enum-like usage.

import type { VersionedLocalizedContent } from './admin'

/**
 * Supported attribute data types.
 * Note: DATETIME was removed in favor of DATE with dateComposition setting.
 */
export const ATTRIBUTE_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'] as const

export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number]

export const AttributeDataType = ATTRIBUTE_DATA_TYPES.reduce((acc, value) => {
    acc[value] = value
    return acc
}, {} as Record<AttributeDataType, AttributeDataType>)

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
export function getPhysicalDataType(dataType: AttributeDataType, rules?: Partial<AttributeValidationRules>): PhysicalTypeInfo {
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
    DOCUMENT: 'document'
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
}

// ========= Menu item kinds (used by MenuWidgetConfig) =========

export const METAHUB_MENU_ITEM_KINDS = ['catalog', 'catalogs_all', 'link'] as const
export type MetahubMenuItemKind = (typeof METAHUB_MENU_ITEM_KINDS)[number]

// ========= Template Manifest Types =========

/** Schema version discriminator for future manifest format evolution. */
export type MetahubTemplateSchemaVersion = 'metahub-template/v1'

/** Snapshot envelope version used for metahub export/publication snapshots. */
export type MetahubSnapshotFormatVersion = 1

/**
 * Unified version envelope that separates:
 * - platform structure version (DDL)
 * - template semantic version
 * - snapshot format version
 */
export interface MetahubSnapshotVersionEnvelope {
    structureVersion: number
    templateVersion: string | null
    snapshotFormatVersion: MetahubSnapshotFormatVersion
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
    dataType: AttributeDataType
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    isRequired?: boolean
    isDisplayAttribute?: boolean
    sortOrder?: number
    targetEntityCodename?: string
    targetEntityKind?: MetaEntityKind
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

/** Seed entity definition (catalog, hub, document). */
export interface TemplateSeedEntity {
    codename: string
    kind: MetaEntityKind
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    config?: Record<string, unknown>
    attributes?: TemplateSeedAttribute[]
    hubs?: string[]
}

/** Seed element (predefined data row for an entity). */
export interface TemplateSeedElement {
    codename: string
    data: Record<string, unknown>
    sortOrder: number
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
}

/**
 * Root template manifest — stored as JSON file in the codebase
 * and as JSONB in templates_versions.manifest_json.
 */
export interface MetahubTemplateManifest {
    $schema: MetahubTemplateSchemaVersion
    codename: string
    version: string
    minStructureVersion: number
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    meta?: MetahubTemplateMeta
    seed: MetahubTemplateSeed
}

// ═══════════════════════════════════════════════════════════════════════════
// Template API DTOs — shared response types for template catalog endpoints
// ═══════════════════════════════════════════════════════════════════════════

/** Template version summary DTO (GET /templates response element). */
export interface TemplateVersionSummaryDTO {
    id: string
    versionNumber: number
    versionLabel: string
    changelog?: string | null
}

/** Template summary DTO (GET /templates response element). */
export interface TemplateSummaryDTO {
    id: string
    codename: string
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
    OPTIONAL = 'optional',
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
    currentStructureVersion: number
    targetStructureVersion: number
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
