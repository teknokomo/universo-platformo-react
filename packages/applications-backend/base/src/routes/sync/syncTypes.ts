/**
 * Application Sync - Types, Schemas & Constants
 */

import { z } from 'zod'
import type { EntityDefinition, SchemaSnapshot, SchemaDiff } from '@universo/schema-ddl'
import {
    AttributeDataType,
    dashboardLayoutConfigSchema,
    defaultDashboardLayoutConfig,
    type ApplicationLifecycleContract,
    type VersionedLocalizedContent
} from '@universo/types'
import type { ApplicationRecord, ApplicationCopySourceRecord } from '../../persistence/applicationsStore'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import type {
    ApplicationReleaseBundle,
    ApplicationReleaseBundleExecutablePayload,
    ApplicationReleaseInstallSourceKind
} from '../../services/applicationReleaseBundle'

// --- Diff marker constants ---

export const UI_LAYOUT_DIFF_MARKER = 'ui.layout.update'
export const UI_LAYOUTS_DIFF_MARKER = 'ui.layouts.update'
export const UI_LAYOUT_ZONES_DIFF_MARKER = 'ui.layout.zones.update'
export const SYSTEM_METADATA_DIFF_MARKER = 'schema.metadata.update'

// --- Exported types ---

export type SyncableApplicationRecord = ApplicationRecord &
    Partial<
        Pick<
            ApplicationCopySourceRecord,
            'schemaSnapshot' | 'lastSyncedPublicationVersionId' | 'appStructureVersion' | 'installedReleaseMetadata'
        >
    >

export interface ApplicationSchemaSyncSource {
    bundle: ApplicationReleaseBundle
    bootstrapPayload: ApplicationReleaseBundleExecutablePayload
    incrementalPayload: ApplicationReleaseBundleExecutablePayload
    incrementalBaseSchemaSnapshot: SchemaSnapshot | null
    incrementalDiff: SchemaDiff
    installSourceKind: ApplicationReleaseInstallSourceKind
    snapshotHash: string
    snapshot: PublishedApplicationSnapshot
    entities: EntityDefinition[]
    publicationSnapshot: Record<string, unknown>
    publicationId: string | null
    publicationVersionId: string | null
}


// --- Zod schemas ---

export const schemaSnapshotArtifactSchema = z
    .object({
        version: z.number(),
        generatedAt: z.string().min(1),
        hasSystemTables: z.boolean(),
        entities: z.record(z.unknown())
    })
    .passthrough()

export const schemaDiffSchema = z.object({
    hasChanges: z.boolean(),
    additive: z.array(z.object({}).passthrough()),
    destructive: z.array(z.object({}).passthrough()),
    summary: z.string()
})

export const releaseBundleExecutablePayloadSchema = z.object({
    entities: z.array(z.object({}).passthrough()),
    schemaSnapshot: schemaSnapshotArtifactSchema
})

export const applicationReleaseBundleSchema = z.object({
    kind: z.literal('application_release_bundle'),
    bundleVersion: z.literal(1),
    applicationKey: z.string().min(1),
    releaseVersion: z.string().min(1),
    manifest: z.object({
        engineVersion: z.string().min(1),
        structureVersion: z.string().min(1),
        sourceKind: z.enum(['publication', 'application']),
        generatedAt: z.string().min(1),
        applicationId: z.string().min(1),
        applicationKey: z.string().min(1),
        publicationId: z.string().min(1).nullable().optional(),
        publicationVersionId: z.string().min(1).nullable().optional(),
        snapshotHash: z.string().min(1)
    }),
    snapshot: z
        .object({
            entities: z.record(z.unknown())
        })
        .passthrough(),
    bootstrap: z.object({
        kind: z.literal('baseline_sql'),
        checksum: z.string().min(1),
        payload: releaseBundleExecutablePayloadSchema
    }),
    incrementalMigration: z.object({
        fromVersion: z.string().min(1).nullable(),
        kind: z.literal('ddl_plan'),
        checksum: z.string().min(1),
        baseSchemaSnapshot: schemaSnapshotArtifactSchema.nullable(),
        diff: schemaDiffSchema,
        payload: releaseBundleExecutablePayloadSchema
    })
})

// --- Runtime row types ---

export type RuntimeApplicationObjectRow = {
    id: unknown
    kind: unknown
    codename: unknown
    table_name: unknown
    presentation: unknown
    config: unknown
}

export type RuntimeApplicationAttributeRow = {
    id: unknown
    object_id: unknown
    codename: unknown
    sort_order: unknown
    column_name: unknown
    data_type: unknown
    is_required: unknown
    is_display_attribute: unknown
    target_object_id: unknown
    target_object_kind: unknown
    parent_attribute_id: unknown
    presentation: unknown
    validation_rules: unknown
    ui_config: unknown
}

export type RuntimeApplicationEnumerationValueRow = {
    id: unknown
    object_id: unknown
    codename: unknown
    presentation: unknown
    sort_order: unknown
    is_default: unknown
}

export type RuntimeApplicationLayoutRow = {
    id: unknown
    template_key: unknown
    name: unknown
    description: unknown
    config: unknown
    is_active: unknown
    is_default: unknown
    sort_order: unknown
}

export type RuntimeApplicationWidgetRow = {
    id: unknown
    layout_id: unknown
    zone: unknown
    widget_key: unknown
    sort_order: unknown
    config: unknown
}

// --- Enumeration / layout snapshot types ---

export type EnumerationSyncRow = {
    id: string
    object_id: string
    codename: VersionedLocalizedContent<string>
    presentation: { name?: unknown; description?: unknown }
    sort_order: number
    is_default: boolean
    _upl_created_at: Date
    _upl_created_by: string | null
    _upl_updated_at: Date
    _upl_updated_by: string | null
    _upl_deleted: boolean
    _upl_deleted_at: Date | null
    _upl_deleted_by: string | null
    _app_deleted: boolean
    _app_deleted_at: Date | null
    _app_deleted_by: string | null
}

export type SnapshotEnumerationValue = {
    id?: unknown
    codename?: unknown
    presentation?: unknown
    sortOrder?: unknown
    isDefault?: unknown
    name?: unknown
    description?: unknown
}

export type SnapshotLayoutRow = {
    id?: unknown
    catalogId?: unknown
    templateKey?: unknown
    name?: unknown
    description?: unknown
    config?: unknown
    isActive?: unknown
    isDefault?: unknown
    sortOrder?: unknown
}

export type SnapshotCatalogLayoutRow = SnapshotLayoutRow & {
    catalogId?: unknown
    baseLayoutId?: unknown
}

export type SnapshotCatalogLayoutWidgetOverrideRow = {
    id?: unknown
    catalogLayoutId?: unknown
    baseWidgetId?: unknown
    zone?: unknown
    sortOrder?: unknown
    config?: unknown
    isActive?: unknown
    isDeletedOverride?: unknown
}

export type SnapshotWidgetRow = {
    id?: unknown
    layoutId?: unknown
    zone?: unknown
    widgetKey?: unknown
    sortOrder?: unknown
    config?: unknown
    isActive?: unknown
}

export const ENUMERATION_KIND = 'enumeration'
export const REF_DATA_TYPE = AttributeDataType.REF

// --- Layout persistence types ---

export type PersistedAppLayout = {
    id: string
    catalogId: string | null
    templateKey: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    config: Record<string, unknown>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
}

export type PersistedAppLayoutZoneWidget = {
    id: string
    layoutId: string
    zone: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
}

export type PersistedAppLayoutRowDb = {
    id: unknown
    catalog_id: unknown
    template_key: unknown
    name: unknown
    description: unknown
    config: unknown
    is_active: unknown
    is_default: unknown
    sort_order: unknown
}

export type PersistedAppWidgetRowDb = {
    id: unknown
    layout_id: unknown
    zone: unknown
    widget_key: unknown
    sort_order: unknown
    config: unknown
}

// --- Diff types ---

export type DiffTableFieldDetails = {
    id: string
    codename: string
    dataType: string
    isRequired: boolean
    parentAttributeId: string | null
}

export type DiffTableDetails = {
    id: string
    codename: string
    tableName: string | null
    fields: DiffTableFieldDetails[]
    predefinedElementsCount: number
    predefinedElementsPreview: Array<{
        id: string
        data: Record<string, unknown>
        sortOrder: number
    }>
}

export type DiffStructuredChange = {
    type: string
    description: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    dataType?: string
    oldValue?: unknown
    newValue?: unknown
}

export type EntityField = EntityDefinition['fields'][number]
export type SnapshotElementRow = {
    id: string
    data?: Record<string, unknown>
    sortOrder?: number
}

// --- Shared constants ---

export const EMPTY_VLC: VersionedLocalizedContent<string> = {
    _schema: '1',
    _primary: 'en',
    locales: {}
}

export const RUNTIME_ENTITY_KINDS = new Set<EntityDefinition['kind']>(['hub', 'catalog', 'set', 'enumeration', 'relation', 'settings'])

