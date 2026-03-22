/**
 * Application Schema Sync Routes
 *
 * These routes handle schema creation, synchronization and diff calculation
 * for Applications. They use the Application → Connector → ConnectorPublication → Publication
 * chain to determine the structure.
 */

import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import stableStringify from 'json-stable-stringify'
import { createKnexExecutor } from '@universo/database'
import { assertCanonicalIdentifier, assertCanonicalSchemaName, quoteIdentifier, quoteQualifiedIdentifier } from '@universo/migrations-core'
import {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateChildTableName,
    generateMigrationName,
    uuidToLockKey,
    type DDLServices,
    type SchemaDiff,
    type SchemaSnapshot,
    type SchemaChange,
    type EntityDefinition
} from '@universo/schema-ddl'
import {
    ApplicationSchemaStatus,
    AttributeDataType,
    AttributeValidationRules,
    type ApplicationLifecycleContract,
    type VersionedLocalizedContent
} from '@universo/types'
import {
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    validateNumberOrThrow,
    type DbExecutor
} from '@universo/utils'
import { ensureApplicationAccess, type ApplicationRole } from './guards'
import {
    updateApplicationSyncFields,
    findApplicationCopySource,
    type ApplicationRecord,
    type ApplicationCopySourceRecord
} from '../persistence/applicationsStore'
import { findFirstConnectorByApplicationId, findFirstConnectorPublicationLinkByConnectorId } from '../persistence/connectorsStore'
import { TARGET_APP_STRUCTURE_VERSION } from '../constants'
import type { LoadPublishedApplicationSyncContext, PublishedApplicationSnapshot } from '../services/applicationSyncContracts'
import {
    buildInstalledReleaseMetadataFromBundle,
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    resolveApplicationReleaseSnapshotHash,
    validateApplicationReleaseBundleArtifacts,
    type ApplicationReleaseBundle,
    type ApplicationReleaseBundleExecutablePayload,
    type ApplicationReleaseInstallSourceKind
} from '../services/applicationReleaseBundle'
import { resolveExecutablePayloadEntities } from '../services/publishedApplicationSnapshotEntities'
import { persistApplicationSchemaSyncState } from '../services/ApplicationSchemaSyncStateStore'
import { persistConnectorSyncTouch } from '../services/ConnectorSyncTouchStore'
import {
    ensureApplicationRuntimeWorkspaceSchema,
    persistWorkspaceSeedTemplate,
    syncWorkspaceSeededElementsForAllActiveWorkspaces,
    withWorkspaceContract
} from '../services/applicationWorkspaces'
import {
    type ApplicationSyncQueryBuilder,
    type ApplicationSyncTransaction,
    acquireApplicationSyncAdvisoryLock,
    getApplicationSyncDdlServices,
    getApplicationSyncKnex,
    releaseApplicationSyncAdvisoryLock
} from '../ddl'

interface RequestUser {
    id?: string
    sub?: string
}

const resolveUserId = (req: Request): string | undefined => {
    const user = req.user as RequestUser | undefined
    return user?.id ?? user?.sub
}

const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin']

// Dashboard layout config (MVP) - show/hide template sections.
const dashboardLayoutConfigSchema = z.object({
    showSideMenu: z.boolean().optional(),
    showAppNavbar: z.boolean().optional(),
    showHeader: z.boolean().optional(),
    showBreadcrumbs: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    showDatePicker: z.boolean().optional(),
    showOptionsMenu: z.boolean().optional(),
    showOverviewTitle: z.boolean().optional(),
    showOverviewCards: z.boolean().optional(),
    showSessionsChart: z.boolean().optional(),
    showPageViewsChart: z.boolean().optional(),
    showDetailsTitle: z.boolean().optional(),
    showDetailsTable: z.boolean().optional(),
    showColumnsContainer: z.boolean().optional(),
    showFooter: z.boolean().optional()
})

const defaultDashboardLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true,
    showBreadcrumbs: true,
    showSearch: true,
    showDatePicker: true,
    showOptionsMenu: true,
    showOverviewTitle: true,
    showOverviewCards: true,
    showSessionsChart: true,
    showPageViewsChart: true,
    showDetailsTitle: true,
    showDetailsTable: true,
    showColumnsContainer: false,
    showFooter: true
} as const

const UI_LAYOUT_DIFF_MARKER = 'ui.layout.update'
const UI_LAYOUTS_DIFF_MARKER = 'ui.layouts.update'
const UI_LAYOUT_ZONES_DIFF_MARKER = 'ui.layout.zones.update'
const SYSTEM_METADATA_DIFF_MARKER = 'schema.metadata.update'

const buildDynamicRuntimeActiveRowSql = (contract: ApplicationLifecycleContract, platformConfig?: unknown): string => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses: string[] = []

    if (platformContract.delete.enabled) {
        clauses.push('_upl_deleted = false')
    }
    if (contract.delete.mode === 'soft') {
        clauses.push('_app_deleted = false')
    }

    return clauses.length > 0 ? clauses.join(' AND ') : 'TRUE'
}

const applyDynamicRuntimeActiveRowFilter = (
    qb: ApplicationSyncQueryBuilder,
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown
): ApplicationSyncQueryBuilder => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)

    if (platformContract.delete.enabled) {
        qb.where('_upl_deleted', false)
    }
    if (contract.delete.mode === 'soft') {
        qb.where('_app_deleted', false)
    }
    return qb
}

const resolveEntityLifecycleContract = (entity: EntityDefinition): ApplicationLifecycleContract => {
    return resolveApplicationLifecycleContractFromConfig(entity.config)
}

type SyncableApplicationRecord = ApplicationRecord &
    Partial<
        Pick<
            ApplicationCopySourceRecord,
            'schemaSnapshot' | 'lastSyncedPublicationVersionId' | 'appStructureVersion' | 'installedReleaseMetadata'
        >
    >

interface ApplicationSchemaSyncSource {
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

const schemaSnapshotArtifactSchema = z
    .object({
        version: z.number(),
        generatedAt: z.string().min(1),
        hasSystemTables: z.boolean(),
        entities: z.record(z.unknown())
    })
    .passthrough()

const toWorkspaceAwareSnapshot = (schemaSnapshot: unknown, workspacesEnabled: boolean): Record<string, unknown> | null =>
    withWorkspaceContract(schemaSnapshot as Record<string, unknown> | null | undefined, workspacesEnabled)

const toWorkspaceAwareSchemaSnapshot = (
    schemaSnapshot: SchemaSnapshot | null | undefined,
    workspacesEnabled: boolean
): SchemaSnapshot | null =>
    withWorkspaceContract(
        schemaSnapshot as unknown as Record<string, unknown> | null | undefined,
        workspacesEnabled
    ) as unknown as SchemaSnapshot | null

const schemaDiffSchema = z.object({
    hasChanges: z.boolean(),
    additive: z.array(z.object({}).passthrough()),
    destructive: z.array(z.object({}).passthrough()),
    summary: z.string()
})

const releaseBundleExecutablePayloadSchema = z.object({
    entities: z.array(z.object({}).passthrough()),
    schemaSnapshot: schemaSnapshotArtifactSchema
})

const applicationReleaseBundleSchema = z.object({
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

/**
 * Checks if a field stores VLC (versioned/localized content) as JSONB.
 * STRING fields with versioned=true or localized=true are stored as JSONB.
 */
function isVLCField(field: { dataType: AttributeDataType; validationRules?: Record<string, unknown> }): boolean {
    if (field.dataType !== AttributeDataType.STRING) {
        return false
    }
    const rules = field.validationRules as Partial<AttributeValidationRules> | undefined
    return rules?.versioned === true || rules?.localized === true
}

/**
 * Prepares a value for insertion into a JSONB column.
 * Knex handles object serialization automatically, but primitives need JSON.stringify.
 * PostgreSQL JSONB requires valid JSON: strings must be quoted, etc.
 */
function prepareJsonbValue(value: unknown): unknown {
    if (value === undefined || value === null) {
        return null
    }
    // Objects and arrays: Knex serializes them automatically
    if (typeof value === 'object') {
        return value
    }
    // Primitives (string, number, boolean): wrap in JSON.stringify for valid JSONB
    // PostgreSQL JSONB requires: '"string"' not just 'string'
    return JSON.stringify(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function compareStableValues(left: unknown, right: unknown): boolean {
    return stableStringify(left) === stableStringify(right)
}

export function toStructuralSchemaSnapshot(snapshot: SchemaSnapshot | null): Pick<SchemaSnapshot, 'hasSystemTables' | 'entities'> | null {
    if (!snapshot) {
        return null
    }

    return {
        hasSystemTables: snapshot.hasSystemTables,
        entities: snapshot.entities
    }
}

function quoteSchemaName(schemaName: string): string {
    assertCanonicalSchemaName(schemaName)
    return quoteIdentifier(schemaName)
}

function quoteObjectName(identifier: string): string {
    assertCanonicalIdentifier(identifier)
    return quoteIdentifier(identifier)
}

const EMPTY_VLC: VersionedLocalizedContent<string> = {
    _schema: '1',
    _primary: 'en',
    locales: {}
}

const RUNTIME_ENTITY_KINDS = new Set<EntityDefinition['kind']>(['hub', 'catalog', 'set', 'enumeration', 'relation', 'settings'])

function normalizeRuntimeEntityKind(value: unknown): EntityDefinition['kind'] | null {
    if (typeof value !== 'string') {
        return null
    }

    return RUNTIME_ENTITY_KINDS.has(value as EntityDefinition['kind']) ? (value as EntityDefinition['kind']) : null
}

function normalizeRuntimePresentation(value: unknown): EntityDefinition['presentation'] {
    if (isRecord(value) && isRecord(value.name)) {
        return value as unknown as EntityDefinition['presentation']
    }

    return {
        name: { ...EMPTY_VLC }
    }
}

function resolveLocalizedPreviewText(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    if (!isRecord(value)) return null

    const locales = value.locales
    const primary = value._primary
    if (!isRecord(locales)) return null

    if (typeof primary === 'string' && isRecord(locales[primary]) && typeof locales[primary].content === 'string') {
        const content = locales[primary].content.trim()
        if (content.length > 0) return content
    }

    for (const localeValue of Object.values(locales)) {
        if (isRecord(localeValue) && typeof localeValue.content === 'string') {
            const content = localeValue.content.trim()
            if (content.length > 0) return content
        }
    }

    return null
}

function normalizeReferenceId(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }
    if (!isRecord(value)) return null

    const directId = value.id
    if (typeof directId === 'string' && directId.trim().length > 0) {
        return directId.trim()
    }

    const nestedValue = value.value
    if (typeof nestedValue === 'string' && nestedValue.trim().length > 0) {
        return nestedValue.trim()
    }

    if (isRecord(nestedValue) && typeof nestedValue.id === 'string' && nestedValue.id.trim().length > 0) {
        return nestedValue.id.trim()
    }

    return null
}

function applyApplicationSyncState(
    application: SyncableApplicationRecord,
    state: {
        schemaStatus: ApplicationSchemaStatus
        schemaError: string | null
        schemaSyncedAt: Date | null
        schemaSnapshot: Record<string, unknown> | null
        lastSyncedPublicationVersionId: string | null
        appStructureVersion: number | null
        installedReleaseMetadata?: Record<string, unknown> | null
    }
): void {
    application.schemaStatus = state.schemaStatus
    application.schemaError = state.schemaError
    application.schemaSyncedAt = state.schemaSyncedAt
    application.schemaSnapshot = state.schemaSnapshot
    application.lastSyncedPublicationVersionId = state.lastSyncedPublicationVersionId
    application.appStructureVersion = state.appStructureVersion
    application.installedReleaseMetadata = state.installedReleaseMetadata ?? application.installedReleaseMetadata ?? null
}

function resolveApplicationReleaseVersion(input: {
    publicationVersionId?: string | null
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
}): string {
    const candidates = [input.publicationVersionId, input.snapshot.versionEnvelope?.templateVersion, input.snapshotHash]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim()
        }
    }

    return 'unversioned-release'
}

function extractInstalledReleaseMetadataString(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: string
): string | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function extractInstalledReleaseMetadataSchemaSnapshot(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot'
): SchemaSnapshot | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.entities)) {
        return null
    }

    return value as unknown as SchemaSnapshot
}

function createPublicationApplicationReleaseBundle(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
    }
}): ApplicationReleaseBundle {
    const previousReleaseVersion = extractInstalledReleaseVersion(options.application.installedReleaseMetadata)

    return createApplicationReleaseBundle({
        applicationId: options.application.id,
        applicationKey: options.application.slug ?? options.application.id,
        releaseVersion: resolveApplicationReleaseVersion({
            publicationVersionId: options.syncContext.publicationVersionId,
            snapshot: options.syncContext.snapshot,
            snapshotHash: options.syncContext.snapshotHash
        }),
        sourceKind: 'publication',
        snapshot: options.syncContext.snapshot,
        snapshotHash: options.syncContext.snapshotHash,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId,
        previousReleaseVersion,
        previousSchemaSnapshot: (options.application.schemaSnapshot as SchemaSnapshot | null) ?? null
    })
}

function buildApplicationSyncSourceFromPublication(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
        entities: EntityDefinition[]
        publicationSnapshot: Record<string, unknown>
    }
}): ApplicationSchemaSyncSource {
    const bundle = createPublicationApplicationReleaseBundle({
        application: options.application,
        syncContext: options.syncContext
    })
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'publication',
        snapshotHash: artifacts.snapshotHash,
        snapshot: options.syncContext.snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: options.syncContext.publicationSnapshot,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId
    }
}

function buildApplicationSyncSourceFromBundle(bundle: ApplicationReleaseBundle): ApplicationSchemaSyncSource {
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)
    const snapshot = bundle.snapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        throw new Error('Invalid application release bundle snapshot')
    }

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'release_bundle',
        snapshotHash: artifacts.snapshotHash,
        snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: snapshot as unknown as Record<string, unknown>,
        publicationId: bundle.manifest.publicationId ?? null,
        publicationVersionId: bundle.manifest.publicationVersionId ?? null
    }
}

type RuntimeApplicationObjectRow = {
    id: unknown
    kind: unknown
    codename: unknown
    table_name: unknown
    presentation: unknown
    config: unknown
}

type RuntimeApplicationAttributeRow = {
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

type RuntimeApplicationEnumerationValueRow = {
    id: unknown
    object_id: unknown
    codename: unknown
    presentation: unknown
    sort_order: unknown
    is_default: unknown
}

type RuntimeApplicationLayoutRow = {
    id: unknown
    template_key: unknown
    name: unknown
    description: unknown
    config: unknown
    is_active: unknown
    is_default: unknown
    sort_order: unknown
}

type RuntimeApplicationWidgetRow = {
    id: unknown
    layout_id: unknown
    zone: unknown
    widget_key: unknown
    sort_order: unknown
    config: unknown
}

function normalizeRuntimeSnapshotValue(value: unknown, field: EntityDefinition['fields'][number]): unknown {
    if (value === undefined || value === null) {
        return null
    }

    if (field.dataType === AttributeDataType.NUMBER && typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : value
    }

    if (field.dataType === AttributeDataType.DATE && value instanceof Date) {
        return value.toISOString()
    }

    return value
}

async function loadApplicationRuntimeEntities(exec: DbExecutor, schemaName: string): Promise<EntityDefinition[]> {
    const schemaIdent = quoteSchemaName(schemaName)
    const objectRows = await exec.query<RuntimeApplicationObjectRow>(
        `
            SELECT id, kind, codename, table_name, presentation, config
            FROM ${schemaIdent}._app_objects
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY codename ASC, id ASC
        `
    )
    const attributeRows = await exec.query<RuntimeApplicationAttributeRow>(
        `
            SELECT
                id,
                object_id,
                codename,
                sort_order,
                column_name,
                data_type,
                is_required,
                is_display_attribute,
                target_object_id,
                target_object_kind,
                parent_attribute_id,
                presentation,
                validation_rules,
                ui_config
            FROM ${schemaIdent}._app_attributes
            WHERE _upl_deleted = false
              AND _app_deleted = false
            ORDER BY object_id ASC, parent_attribute_id ASC NULLS FIRST, sort_order ASC, id ASC
        `
    )

    const fieldNodes = new Map<
        string,
        {
            objectId: string
            parentAttributeId: string | null
            sortOrder: number
            field: EntityDefinition['fields'][number]
        }
    >()

    for (const row of attributeRows) {
        const id = typeof row.id === 'string' ? row.id : null
        const objectId = typeof row.object_id === 'string' ? row.object_id : null
        const codename = typeof row.codename === 'string' ? row.codename : null
        const dataType = typeof row.data_type === 'string' ? (row.data_type as AttributeDataType) : null
        const columnName = typeof row.column_name === 'string' ? row.column_name : null

        if (!id || !objectId || !codename || !dataType || !columnName) {
            continue
        }

        const uiConfig = isRecord(row.ui_config) ? row.ui_config : {}
        const targetConstantId =
            row.target_object_kind === 'set' && typeof uiConfig.targetConstantId === 'string' ? uiConfig.targetConstantId : null

        fieldNodes.set(id, {
            objectId,
            parentAttributeId: typeof row.parent_attribute_id === 'string' ? row.parent_attribute_id : null,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            field: {
                id,
                codename,
                dataType,
                isRequired: row.is_required === true,
                isDisplayAttribute: row.is_display_attribute === true,
                targetEntityId: typeof row.target_object_id === 'string' ? row.target_object_id : null,
                targetEntityKind: normalizeRuntimeEntityKind(row.target_object_kind),
                targetConstantId,
                parentAttributeId: typeof row.parent_attribute_id === 'string' ? row.parent_attribute_id : null,
                presentation: normalizeRuntimePresentation(row.presentation),
                validationRules: isRecord(row.validation_rules) ? row.validation_rules : {},
                uiConfig,
                physicalColumnName: columnName
            }
        })
    }

    const sortFieldNodes = (left: { sortOrder: number; field: { id: string } }, right: { sortOrder: number; field: { id: string } }) =>
        left.sortOrder - right.sortOrder || left.field.id.localeCompare(right.field.id)

    const childNodesByParent = new Map<string, Array<{ sortOrder: number; field: EntityDefinition['fields'][number] }>>()
    const topLevelNodesByObject = new Map<string, Array<{ sortOrder: number; field: EntityDefinition['fields'][number] }>>()

    for (const node of fieldNodes.values()) {
        if (node.parentAttributeId) {
            const children = childNodesByParent.get(node.parentAttributeId) ?? []
            children.push({ sortOrder: node.sortOrder, field: node.field })
            childNodesByParent.set(node.parentAttributeId, children)
            continue
        }

        const fields = topLevelNodesByObject.get(node.objectId) ?? []
        fields.push({ sortOrder: node.sortOrder, field: node.field })
        topLevelNodesByObject.set(node.objectId, fields)
    }

    for (const [parentId, children] of childNodesByParent.entries()) {
        const parentNode = fieldNodes.get(parentId)
        if (!parentNode) continue
        parentNode.field.childFields = [...children].sort(sortFieldNodes).map((child) => child.field)
    }

    const entities: EntityDefinition[] = []
    for (const row of objectRows) {
        const id = typeof row.id === 'string' ? row.id : null
        const kind = normalizeRuntimeEntityKind(row.kind)
        const codename = typeof row.codename === 'string' ? row.codename : null
        const tableName = typeof row.table_name === 'string' ? row.table_name : null

        if (!id || !kind || !codename || !tableName) {
            continue
        }

        const topLevelFields = [...(topLevelNodesByObject.get(id) ?? [])].sort(sortFieldNodes).map((node) => node.field)

        entities.push({
            id,
            kind,
            codename,
            presentation: normalizeRuntimePresentation(row.presentation),
            fields: topLevelFields,
            physicalTableName: tableName,
            config: isRecord(row.config) ? row.config : {}
        })
    }

    return entities
}

async function loadApplicationRuntimeElements(
    exec: DbExecutor,
    schemaName: string,
    entities: EntityDefinition[]
): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {}

    for (const entity of entities) {
        if (entity.kind !== 'catalog') {
            continue
        }

        const tableName = entity.physicalTableName ?? generateTableName(entity.id, entity.kind)
        const tableIdent = quoteQualifiedIdentifier(schemaName, tableName)
        const runtimeRowCondition = buildDynamicRuntimeActiveRowSql(resolveEntityLifecycleContract(entity), entity.config)
        const topLevelFields = entity.fields.filter((field) => field.dataType !== AttributeDataType.TABLE && !field.parentAttributeId)
        const tableFields = entity.fields.filter(
            (field) => field.dataType === AttributeDataType.TABLE && !field.parentAttributeId && (field.childFields?.length ?? 0) > 0
        )
        const selectColumns = [
            'id',
            ...topLevelFields.map((field) => quoteObjectName(field.physicalColumnName ?? generateColumnName(field.id)))
        ]

        const rows = await exec.query<Record<string, unknown>>(
            `
                SELECT ${selectColumns.join(', ')}
                FROM ${tableIdent}
                                WHERE ${runtimeRowCondition}
                ORDER BY _upl_created_at ASC NULLS LAST, id ASC
            `
        )

        const childRowsByTableField = new Map<string, Map<string, Array<Record<string, unknown>>>>()
        for (const tableField of tableFields) {
            const childFields = tableField.childFields ?? []
            if (childFields.length === 0) continue

            const childTableName = tableField.physicalColumnName ?? generateChildTableName(tableField.id)
            const childTableIdent = quoteQualifiedIdentifier(schemaName, childTableName)
            const childSelectColumns = [
                '_tp_parent_id',
                '_tp_sort_order',
                ...childFields.map((field) => quoteObjectName(field.physicalColumnName ?? generateColumnName(field.id)))
            ]

            const childRows = await exec.query<Record<string, unknown>>(
                `
                    SELECT ${childSelectColumns.join(', ')}, id
                    FROM ${childTableIdent}
                                        WHERE ${runtimeRowCondition}
                    ORDER BY _tp_parent_id ASC, _tp_sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
                `
            )

            const rowsByParent = new Map<string, Array<Record<string, unknown>>>()
            for (const row of childRows) {
                const parentId = typeof row._tp_parent_id === 'string' ? row._tp_parent_id : null
                if (!parentId) continue

                const mappedRow: Record<string, unknown> = {
                    _tp_sort_order: typeof row._tp_sort_order === 'number' ? row._tp_sort_order : 0
                }
                for (const childField of childFields) {
                    const columnName = childField.physicalColumnName ?? generateColumnName(childField.id)
                    mappedRow[childField.codename] = normalizeRuntimeSnapshotValue(row[columnName], childField)
                }

                const list = rowsByParent.get(parentId) ?? []
                list.push(mappedRow)
                rowsByParent.set(parentId, list)
            }

            childRowsByTableField.set(tableField.id, rowsByParent)
        }

        const elements = rows.map((row, index) => {
            const elementId = typeof row.id === 'string' ? row.id : String(row.id ?? '')
            const data: Record<string, unknown> = {}

            for (const field of topLevelFields) {
                const columnName = field.physicalColumnName ?? generateColumnName(field.id)
                data[field.codename] = normalizeRuntimeSnapshotValue(row[columnName], field)
            }

            for (const tableField of tableFields) {
                const childRows = childRowsByTableField.get(tableField.id)?.get(elementId) ?? []
                data[tableField.codename] = childRows
            }

            return {
                id: elementId,
                data,
                sortOrder: index
            }
        })

        if (elements.length > 0) {
            result[entity.id] = elements
        }
    }

    return result
}

async function loadApplicationRuntimeEnumerationValues(
    exec: DbExecutor,
    schemaName: string,
    entities: EntityDefinition[]
): Promise<Record<string, unknown[]>> {
    const enumerationIds = new Set(entities.filter((entity) => entity.kind === 'enumeration').map((entity) => entity.id))
    if (enumerationIds.size === 0) {
        return {}
    }

    const schemaIdent = quoteSchemaName(schemaName)
    let rows: RuntimeApplicationEnumerationValueRow[] = []

    try {
        rows = await exec.query<RuntimeApplicationEnumerationValueRow>(
            `
                SELECT id, object_id, codename, presentation, sort_order, is_default
                FROM ${schemaIdent}._app_values
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY object_id ASC, sort_order ASC, id ASC
            `
        )
    } catch {
        return {}
    }

    const result: Record<string, unknown[]> = {}
    for (const row of rows) {
        const objectId = typeof row.object_id === 'string' ? row.object_id : null
        const id = typeof row.id === 'string' ? row.id : null
        const codename = typeof row.codename === 'string' ? row.codename : null
        if (!objectId || !id || !codename || !enumerationIds.has(objectId)) {
            continue
        }

        const list = result[objectId] ?? []
        list.push({
            id,
            codename,
            presentation: isRecord(row.presentation) ? row.presentation : { name: {} },
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            isDefault: row.is_default === true
        })
        result[objectId] = list
    }

    return result
}

function loadApplicationRuntimeSetConstants(entities: EntityDefinition[]): Record<string, unknown[]> {
    const constantsBySetId = new Map<string, Map<string, Record<string, unknown>>>()

    const registerFieldConstant = (field: EntityDefinition['fields'][number]): void => {
        const setId = typeof field.targetEntityId === 'string' && field.targetEntityKind === 'set' ? field.targetEntityId : null
        const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
        const constantId =
            typeof field.targetConstantId === 'string' && field.targetConstantId.trim().length > 0
                ? field.targetConstantId.trim()
                : setConstantRef?.id ?? null

        if (setId && constantId && setConstantRef) {
            const constants = constantsBySetId.get(setId) ?? new Map<string, Record<string, unknown>>()
            constants.set(constantId, {
                id: constantId,
                codename: setConstantRef.codename ?? constantId,
                dataType: setConstantRef.dataType ?? 'STRING',
                presentation: setConstantRef.name ? { name: setConstantRef.name } : {},
                validationRules: {},
                uiConfig: {},
                value: setConstantRef.value ?? null,
                sortOrder: 0
            })
            constantsBySetId.set(setId, constants)
        }

        for (const childField of field.childFields ?? []) {
            registerFieldConstant(childField)
        }
    }

    for (const entity of entities) {
        for (const field of entity.fields) {
            if (field.parentAttributeId) {
                continue
            }

            registerFieldConstant(field)
        }
    }

    return Object.fromEntries(
        [...constantsBySetId.entries()]
            .map(([setId, constants]) => [
                setId,
                [...constants.values()].sort((left, right) => {
                    const leftCodename = typeof left.codename === 'string' ? left.codename : ''
                    const rightCodename = typeof right.codename === 'string' ? right.codename : ''
                    if (leftCodename !== rightCodename) {
                        return leftCodename.localeCompare(rightCodename)
                    }

                    const leftId = typeof left.id === 'string' ? left.id : ''
                    const rightId = typeof right.id === 'string' ? right.id : ''
                    return leftId.localeCompare(rightId)
                })
            ])
            .filter(([, constants]) => constants.length > 0)
    )
}

async function loadApplicationRuntimeLayouts(
    exec: DbExecutor,
    schemaName: string
): Promise<{
    layouts: unknown[]
    layoutZoneWidgets: unknown[]
    defaultLayoutId: string | null
    layoutConfig: Record<string, unknown>
}> {
    const schemaIdent = quoteSchemaName(schemaName)

    try {
        const layouts = await exec.query<RuntimeApplicationLayoutRow>(
            `
                SELECT id, template_key, name, description, config, is_active, is_default, sort_order
                FROM ${schemaIdent}._app_layouts
                WHERE _upl_deleted = false
                  AND _app_deleted = false
                ORDER BY sort_order ASC, _upl_created_at ASC
            `
        )

        const normalizedLayouts = layouts.map((row) => ({
            id: String(row.id ?? ''),
            templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
            name: isRecord(row.name) ? row.name : {},
            description: isRecord(row.description) ? row.description : null,
            config: isRecord(row.config) ? row.config : {},
            isActive: row.is_active === true,
            isDefault: row.is_default === true,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
        }))

        const defaultLayoutId = normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
        const layoutConfig =
            normalizedLayouts.find((layout) => layout.isDefault)?.config ??
            normalizedLayouts.find((layout) => layout.isActive)?.config ??
            {}

        let normalizedWidgets: unknown[] = []
        try {
            const widgets = await exec.query<RuntimeApplicationWidgetRow>(
                `
                    SELECT id, layout_id, zone, widget_key, sort_order, config
                    FROM ${schemaIdent}._app_widgets
                    WHERE _upl_deleted = false
                      AND _app_deleted = false
                    ORDER BY layout_id ASC, zone ASC, sort_order ASC, _upl_created_at ASC
                `
            )

            normalizedWidgets = widgets.map((row) => ({
                id: String(row.id ?? ''),
                layoutId: String(row.layout_id ?? ''),
                zone: typeof row.zone === 'string' ? row.zone : 'center',
                widgetKey: typeof row.widget_key === 'string' ? row.widget_key : '',
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                config: isRecord(row.config) ? row.config : {},
                isActive: true
            }))
        } catch {
            normalizedWidgets = []
        }

        return {
            layouts: normalizedLayouts,
            layoutZoneWidgets: normalizedWidgets,
            defaultLayoutId,
            layoutConfig: isRecord(layoutConfig) ? layoutConfig : {}
        }
    } catch {
        return {
            layouts: [],
            layoutZoneWidgets: [],
            defaultLayoutId: null,
            layoutConfig: {}
        }
    }
}

function resolveRuntimeApplicationReleaseLineage(
    application: SyncableApplicationRecord,
    snapshotHash: string
): { releaseVersion: string; previousReleaseVersion: string | null } {
    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const previousReleaseVersion = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'previousReleaseVersion')

    if (installedSourceKind === 'release_bundle' && installedReleaseVersion && installedSnapshotHash === snapshotHash) {
        return {
            releaseVersion: installedReleaseVersion,
            previousReleaseVersion
        }
    }

    const structureVersion =
        typeof application.appStructureVersion === 'number' && Number.isFinite(application.appStructureVersion)
            ? application.appStructureVersion
            : TARGET_APP_STRUCTURE_VERSION

    return {
        releaseVersion: `application-runtime-v${structureVersion}-${snapshotHash.slice(0, 12)}`,
        previousReleaseVersion: installedReleaseVersion
    }
}

function resolveRuntimeApplicationReleaseBaseSnapshot(options: {
    application: SyncableApplicationRecord
    releaseLineage: { releaseVersion: string; previousReleaseVersion: string | null }
    snapshotHash: string
}): { snapshot: SchemaSnapshot | null; expectedKey: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot' | null } {
    const { application, releaseLineage, snapshotHash } = options

    if (!releaseLineage.previousReleaseVersion) {
        return {
            snapshot: null,
            expectedKey: null
        }
    }

    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const reusesStoredBundleLineage =
        installedSourceKind === 'release_bundle' &&
        installedReleaseVersion === releaseLineage.releaseVersion &&
        installedSnapshotHash === snapshotHash

    const expectedKey = reusesStoredBundleLineage ? 'baseSchemaSnapshot' : 'releaseSchemaSnapshot'

    return {
        snapshot: extractInstalledReleaseMetadataSchemaSnapshot(application.installedReleaseMetadata, expectedKey),
        expectedKey
    }
}

async function createExistingApplicationReleaseBundle(options: {
    exec: DbExecutor
    application: SyncableApplicationRecord
}): Promise<ApplicationReleaseBundle> {
    const { exec, application } = options

    if (!application.schemaName) {
        throw new Error('Application schema is not initialized yet. Sync or apply a release bundle first.')
    }

    const entities = await loadApplicationRuntimeEntities(exec, application.schemaName)
    if (entities.length === 0) {
        throw new Error('Application runtime metadata is empty. Sync the application before exporting a release bundle.')
    }

    const elements = await loadApplicationRuntimeElements(exec, application.schemaName, entities)
    const enumerationValues = await loadApplicationRuntimeEnumerationValues(exec, application.schemaName, entities)
    const constants = loadApplicationRuntimeSetConstants(entities)
    const runtimeLayouts = await loadApplicationRuntimeLayouts(exec, application.schemaName)
    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const snapshot: PublishedApplicationSnapshot = {
        versionEnvelope: {
            structureVersion: String(
                typeof application.appStructureVersion === 'number' && Number.isFinite(application.appStructureVersion)
                    ? application.appStructureVersion
                    : TARGET_APP_STRUCTURE_VERSION
            ),
            templateVersion: installedReleaseVersion,
            snapshotFormatVersion: 1
        },
        entities: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
    }

    if (Object.keys(elements).length > 0) {
        snapshot.elements = elements
    }
    if (Object.keys(enumerationValues).length > 0) {
        snapshot.enumerationValues = enumerationValues
    }
    if (Object.keys(constants).length > 0) {
        snapshot.constants = constants
    }
    if (runtimeLayouts.layouts.length > 0) {
        snapshot.layouts = runtimeLayouts.layouts
        snapshot.defaultLayoutId = runtimeLayouts.defaultLayoutId
        snapshot.layoutConfig = runtimeLayouts.layoutConfig
    }
    if (runtimeLayouts.layoutZoneWidgets.length > 0) {
        snapshot.layoutZoneWidgets = runtimeLayouts.layoutZoneWidgets
    }

    const snapshotHash = resolveApplicationReleaseSnapshotHash(snapshot)
    const releaseLineage = resolveRuntimeApplicationReleaseLineage(application, snapshotHash)
    const previousSchemaSnapshotSelection = resolveRuntimeApplicationReleaseBaseSnapshot({
        application,
        releaseLineage,
        snapshotHash
    })
    const previousSchemaSnapshot = previousSchemaSnapshotSelection.snapshot

    if (releaseLineage.previousReleaseVersion && !previousSchemaSnapshot) {
        throw new Error(
            `Installed release metadata is missing ${previousSchemaSnapshotSelection.expectedKey} for incremental runtime export.`
        )
    }

    return createApplicationReleaseBundle({
        applicationId: application.id,
        applicationKey: application.slug ?? application.id,
        releaseVersion: releaseLineage.releaseVersion,
        sourceKind: 'application',
        snapshot,
        snapshotHash,
        previousReleaseVersion: releaseLineage.previousReleaseVersion,
        previousSchemaSnapshot
    })
}

async function persistConnectorSyncTouchIfPresent(
    trx: ApplicationSyncTransaction,
    connectorId: string | null | undefined,
    userId?: string | null
): Promise<void> {
    if (!connectorId) {
        return
    }

    await persistConnectorSyncTouch(createKnexExecutor(trx), {
        connectorId,
        userId
    })
}

async function syncApplicationSchemaFromSource(options: {
    application: SyncableApplicationRecord
    exec: DbExecutor
    userId: string
    confirmDestructive: boolean
    connectorId?: string | null
    source: ApplicationSchemaSyncSource
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const { application, exec, userId, confirmDestructive, connectorId, source } = options
    const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()
    const knex = getApplicationSyncKnex()

    if (!application.schemaName) {
        application.schemaName = generateSchemaName(application.id)
        await updateApplicationSyncFields(exec, {
            applicationId: application.id,
            schemaName: application.schemaName,
            userId
        })
    }

    const schemaExists = await generator.schemaExists(application.schemaName)
    const migrationMeta = {
        publicationSnapshotHash: source.snapshotHash,
        publicationId: source.publicationId ?? undefined,
        publicationVersionId: source.publicationVersionId ?? undefined
    }
    const trackedSchemaSnapshot = toWorkspaceAwareSchemaSnapshot(
        application.schemaSnapshot as SchemaSnapshot | null,
        application.workspacesEnabled
    )
    const expectedReleaseSchemaSnapshot = toWorkspaceAwareSchemaSnapshot(
        source.incrementalPayload.schemaSnapshot,
        application.workspacesEnabled
    )
    const releaseSchemaSnapshotMatchesTrackedState = compareStableValues(
        toStructuralSchemaSnapshot(trackedSchemaSnapshot),
        toStructuralSchemaSnapshot(expectedReleaseSchemaSnapshot)
    )

    if (schemaExists) {
        const latestMigration = await migrationManager.getLatestMigration(application.schemaName)
        const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
        if (lastAppliedHash && lastAppliedHash === source.snapshotHash && releaseSchemaSnapshotMatchesTrackedState) {
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName, snapshot: source.snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName, snapshot: source.snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName,
                snapshot: source.snapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate

            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const schemaSnapshot = toWorkspaceAwareSnapshot(
                (application.schemaSnapshot as Record<string, unknown> | null) ??
                    (generator.generateSnapshot(source.entities) as unknown as Record<string, unknown>),
                application.workspacesEnabled
            )
            const { seedWarnings } = await knex.transaction(async (trx) => {
                await generator.syncSystemMetadata(application.schemaName!, source.entities, {
                    trx,
                    userId,
                    removeMissing: true
                })

                const runtimeSyncResult = await runPublishedApplicationRuntimeSync({
                    trx,
                    applicationId: application.id,
                    schemaName: application.schemaName!,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    userId,
                    workspacesEnabled: application.workspacesEnabled
                })

                await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaError: null,
                    schemaSyncedAt,
                    schemaSnapshot,
                    lastSyncedPublicationVersionId: source.publicationVersionId,
                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                    installedReleaseMetadata,
                    userId
                })

                await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)

                return runtimeSyncResult
            })

            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot,
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })

            return {
                statusCode: 200,
                body: {
                    status: hasUiChanges || seedWarnings.length > 0 ? 'ui_updated' : 'no_changes',
                    message: hasUiChanges ? 'UI layout settings updated' : 'Schema is already up to date',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }
    }

    application.schemaStatus = ApplicationSchemaStatus.MAINTENANCE
    await updateApplicationSyncFields(exec, {
        applicationId: application.id,
        schemaStatus: ApplicationSchemaStatus.MAINTENANCE,
        userId
    })

    try {
        if (!schemaExists) {
            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const result = await generator.generateFullSchema(application.schemaName!, source.bootstrapPayload.entities, {
                recordMigration: true,
                migrationDescription: 'initial_schema',
                migrationManager,
                migrationMeta,
                publicationSnapshot: source.publicationSnapshot,
                userId,
                afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                    await runPublishedApplicationRuntimeSync({
                        trx,
                        applicationId: application.id,
                        schemaName: application.schemaName!,
                        snapshot: source.snapshot,
                        entities: source.entities,
                        migrationManager,
                        migrationId,
                        userId,
                        workspacesEnabled: application.workspacesEnabled
                    })

                    await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                        applicationId: application.id,
                        schemaStatus: ApplicationSchemaStatus.SYNCED,
                        schemaError: null,
                        schemaSyncedAt,
                        schemaSnapshot: toWorkspaceAwareSnapshot(
                            snapshotAfter as unknown as Record<string, unknown>,
                            application.workspacesEnabled
                        ),
                        lastSyncedPublicationVersionId: source.publicationVersionId,
                        appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                        installedReleaseMetadata,
                        userId
                    })

                    await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                }
            })

            if (!result.success) {
                application.schemaStatus = ApplicationSchemaStatus.ERROR
                application.schemaError = result.errors.join('; ')
                await updateApplicationSyncFields(exec, {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.ERROR,
                    schemaError: result.errors.join('; '),
                    userId
                })

                return {
                    statusCode: 500,
                    body: {
                        status: 'error',
                        message: 'Schema creation failed',
                        errors: result.errors
                    }
                }
            }

            const schemaSnapshot = toWorkspaceAwareSnapshot(source.bootstrapPayload.schemaSnapshot, application.workspacesEnabled)
            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot: schemaSnapshot as unknown as Record<string, unknown>,
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })
            const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
            const seedWarnings = Array.isArray(latestMigration?.meta?.seedWarnings) ? latestMigration.meta.seedWarnings : []

            return {
                statusCode: 200,
                body: {
                    status: 'created',
                    schemaName: result.schemaName,
                    tablesCreated: result.tablesCreated,
                    message: `Schema created with ${result.tablesCreated.length} table(s)`,
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }

        const oldSnapshot = trackedSchemaSnapshot
        if (source.bundle.incrementalMigration.fromVersion && !source.incrementalBaseSchemaSnapshot) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: 'Release bundle is missing base schema snapshot for incremental apply.',
                userId
            })

            return {
                statusCode: 409,
                body: {
                    status: 'error',
                    error: 'Release schema snapshot mismatch',
                    message: 'Bundle incremental apply requires a trusted base schema snapshot for the installed release.'
                }
            }
        }

        if (
            !compareStableValues(
                oldSnapshot,
                toWorkspaceAwareSchemaSnapshot(source.incrementalBaseSchemaSnapshot ?? null, application.workspacesEnabled)
            )
        ) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: 'Target schema snapshot does not match the release bundle base snapshot.',
                userId
            })

            return {
                statusCode: 409,
                body: {
                    status: 'error',
                    error: 'Release schema snapshot mismatch',
                    message:
                        'Bundle incremental apply expects the tracked application schema snapshot to match the embedded base snapshot of the release.'
                }
            }
        }

        const diff = source.incrementalDiff
        const hasDestructiveChanges = diff.destructive.length > 0

        if (!diff.hasChanges) {
            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot: source.snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot: source.snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                schemaName: application.schemaName!,
                snapshot: source.snapshot
            })
            const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate

            const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
            const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
            const snapshotBefore = toWorkspaceAwareSchemaSnapshot(
                (application.schemaSnapshot as SchemaSnapshot | null) ?? null,
                application.workspacesEnabled
            )
            const snapshotAfter = toWorkspaceAwareSchemaSnapshot(source.incrementalPayload.schemaSnapshot, application.workspacesEnabled)
            const metaOnlyDiff = {
                hasChanges: false,
                additive: [],
                destructive: [],
                summary: 'System metadata updated (no DDL changes)'
            }

            const schemaSyncedAt = new Date()
            const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
                source.bundle,
                source.installSourceKind,
                schemaSyncedAt.toISOString()
            ) as unknown as Record<string, unknown>
            const { seedWarnings } = await knex.transaction(async (trx) => {
                await generator.syncSystemMetadata(application.schemaName!, source.entities, {
                    trx,
                    userId,
                    removeMissing: true
                })

                let migrationId: string | undefined
                if (lastAppliedHash !== source.snapshotHash) {
                    migrationId = await migrationManager.recordMigration(
                        application.schemaName!,
                        generateMigrationName('system_sync'),
                        snapshotBefore,
                        snapshotAfter as SchemaSnapshot,
                        metaOnlyDiff,
                        trx,
                        migrationMeta,
                        source.publicationSnapshot,
                        userId
                    )
                }

                const runtimeSyncResult = await runPublishedApplicationRuntimeSync({
                    trx,
                    applicationId: application.id,
                    schemaName: application.schemaName!,
                    snapshot: source.snapshot,
                    entities: source.entities,
                    migrationManager,
                    migrationId,
                    userId,
                    workspacesEnabled: application.workspacesEnabled
                })

                await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                    applicationId: application.id,
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaError: null,
                    schemaSyncedAt,
                    schemaSnapshot: toWorkspaceAwareSnapshot(
                        snapshotAfter as unknown as Record<string, unknown>,
                        application.workspacesEnabled
                    ),
                    lastSyncedPublicationVersionId: source.publicationVersionId,
                    appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                    installedReleaseMetadata,
                    userId
                })

                await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)

                return runtimeSyncResult
            })

            applyApplicationSyncState(application, {
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSyncedAt,
                schemaSnapshot: toWorkspaceAwareSnapshot(
                    snapshotAfter as unknown as Record<string, unknown>,
                    application.workspacesEnabled
                ),
                lastSyncedPublicationVersionId: source.publicationVersionId,
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                installedReleaseMetadata
            })

            const hasElementChanges = seedWarnings.length > 0
            return {
                statusCode: 200,
                body: {
                    status: hasUiChanges || hasElementChanges ? 'ui_updated' : 'no_changes',
                    message: hasUiChanges
                        ? 'UI layout settings updated'
                        : hasElementChanges
                        ? 'Predefined elements updated'
                        : 'Schema is already up to date',
                    ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                }
            }
        }

        if (hasDestructiveChanges && !confirmDestructive) {
            application.schemaStatus = ApplicationSchemaStatus.OUTDATED
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.OUTDATED,
                userId
            })

            return {
                statusCode: 200,
                body: {
                    status: 'pending_confirmation',
                    diff: {
                        hasChanges: diff.hasChanges,
                        hasDestructiveChanges,
                        additive: diff.additive.map((c: SchemaChange) => c.description),
                        destructive: diff.destructive.map((c: SchemaChange) => c.description),
                        summary: diff.summary
                    },
                    message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
                }
            }
        }

        const schemaSyncedAt = new Date()
        const installedReleaseMetadata = buildInstalledReleaseMetadataFromBundle(
            source.bundle,
            source.installSourceKind,
            schemaSyncedAt.toISOString()
        ) as unknown as Record<string, unknown>
        const migrationResult = await migrator.applyAllChanges(
            application.schemaName!,
            diff,
            source.incrementalPayload.entities,
            confirmDestructive,
            {
                recordMigration: true,
                migrationDescription: 'schema_sync',
                migrationMeta,
                publicationSnapshot: source.publicationSnapshot,
                userId,
                afterMigrationRecorded: async ({ trx, snapshotAfter, migrationId }) => {
                    await runPublishedApplicationRuntimeSync({
                        trx,
                        applicationId: application.id,
                        schemaName: application.schemaName!,
                        snapshot: source.snapshot,
                        entities: source.entities,
                        migrationManager,
                        migrationId,
                        userId,
                        workspacesEnabled: application.workspacesEnabled
                    })

                    await persistApplicationSchemaSyncState(createKnexExecutor(trx), {
                        applicationId: application.id,
                        schemaStatus: ApplicationSchemaStatus.SYNCED,
                        schemaError: null,
                        schemaSyncedAt,
                        schemaSnapshot: toWorkspaceAwareSnapshot(
                            snapshotAfter as unknown as Record<string, unknown>,
                            application.workspacesEnabled
                        ),
                        lastSyncedPublicationVersionId: source.publicationVersionId,
                        appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                        installedReleaseMetadata,
                        userId
                    })

                    await persistConnectorSyncTouchIfPresent(trx, connectorId, userId)
                }
            }
        )

        if (!migrationResult.success) {
            application.schemaStatus = ApplicationSchemaStatus.ERROR
            application.schemaError = migrationResult.errors.join('; ')
            await updateApplicationSyncFields(exec, {
                applicationId: application.id,
                schemaStatus: ApplicationSchemaStatus.ERROR,
                schemaError: migrationResult.errors.join('; '),
                userId
            })

            return {
                statusCode: 500,
                body: {
                    status: 'error',
                    message: 'Schema migration failed',
                    errors: migrationResult.errors
                }
            }
        }

        const newSnapshot = toWorkspaceAwareSnapshot(
            generator.generateSnapshot(source.entities) as unknown as Record<string, unknown>,
            application.workspacesEnabled
        )
        applyApplicationSyncState(application, {
            schemaStatus: ApplicationSchemaStatus.SYNCED,
            schemaError: null,
            schemaSyncedAt,
            schemaSnapshot: newSnapshot as unknown as Record<string, unknown>,
            lastSyncedPublicationVersionId: source.publicationVersionId,
            appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
            installedReleaseMetadata
        })
        const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
        const seedWarnings = Array.isArray(latestMigration?.meta?.seedWarnings) ? latestMigration.meta.seedWarnings : []

        return {
            statusCode: 200,
            body: {
                status: 'migrated',
                schemaName: application.schemaName,
                changesApplied: migrationResult.changesApplied,
                message: 'Schema migration applied successfully',
                ...(seedWarnings.length > 0 ? { seedWarnings } : {})
            }
        }
    } catch (error) {
        application.schemaStatus = ApplicationSchemaStatus.ERROR
        application.schemaError = error instanceof Error ? error.message : 'Unknown error'
        await updateApplicationSyncFields(exec, {
            applicationId: application.id,
            schemaStatus: ApplicationSchemaStatus.ERROR,
            schemaError: error instanceof Error ? error.message : 'Unknown error',
            userId
        })

        return {
            statusCode: 500,
            body: {
                status: 'error',
                message: 'Schema sync failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }
}

function extractSetConstantRefConfig(
    uiConfig: unknown
): { id: string; codename?: string; dataType?: string; value?: unknown; name?: unknown } | null {
    if (!isRecord(uiConfig)) return null
    const candidate = uiConfig.setConstantRef
    if (!isRecord(candidate)) return null
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return null

    return {
        id: candidate.id.trim(),
        codename: typeof candidate.codename === 'string' ? candidate.codename : undefined,
        dataType: typeof candidate.dataType === 'string' ? candidate.dataType : undefined,
        value: candidate.value,
        name: candidate.name
    }
}

function resolveSetReferenceId(
    value: unknown,
    field: { targetConstantId?: string | null; uiConfig?: Record<string, unknown> }
): string | null {
    if (typeof field.targetConstantId === 'string' && field.targetConstantId.trim().length > 0) {
        return field.targetConstantId.trim()
    }

    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (setConstantRef?.id) {
        return setConstantRef.id
    }

    return normalizeReferenceId(value)
}

/**
 * Normalize a child field value for TABLE row seeding.
 * Applies the same type-specific handling as parent seed logic.
 */
function normalizeChildFieldValue(
    value: unknown,
    field: {
        dataType: AttributeDataType
        validationRules?: Record<string, unknown>
        targetEntityKind?: string | null
        targetConstantId?: string | null
        uiConfig?: Record<string, unknown>
    },
    codename: string,
    tableName: string,
    elementId: string
): unknown {
    if (value === null || value === undefined) return null
    if (isVLCField(field)) return prepareJsonbValue(value)
    if (field.dataType === AttributeDataType.JSON) return prepareJsonbValue(value)
    if (field.dataType === AttributeDataType.NUMBER) {
        return validateNumericValue({
            value,
            field: { codename, validationRules: field.validationRules },
            tableName,
            elementId
        })
    }
    if (field.dataType === AttributeDataType.REF) {
        if (field.targetEntityKind === 'set') {
            return resolveSetReferenceId(value, field)
        }
        return normalizeReferenceId(value)
    }
    return value
}

function resolveCatalogSeedingOrder(entities: EntityDefinition[]): string[] {
    const catalogs = entities.filter((entity) => entity.kind === 'catalog')
    const catalogById = new Map(catalogs.map((entity) => [entity.id, entity]))
    const adjacency = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()

    for (const entity of catalogs) {
        adjacency.set(entity.id, new Set())
        indegree.set(entity.id, 0)
    }

    for (const entity of catalogs) {
        for (const field of entity.fields ?? []) {
            if (field.dataType !== AttributeDataType.REF) continue
            if (field.targetEntityKind !== 'catalog') continue
            const targetId = field.targetEntityId
            if (typeof targetId !== 'string' || targetId.length === 0 || targetId === entity.id) continue
            if (!catalogById.has(targetId)) continue

            const neighbors = adjacency.get(targetId)
            if (!neighbors || neighbors.has(entity.id)) continue
            neighbors.add(entity.id)
            indegree.set(entity.id, (indegree.get(entity.id) ?? 0) + 1)
        }
    }

    const queue = catalogs
        .filter((entity) => (indegree.get(entity.id) ?? 0) === 0)
        .map((entity) => entity.id)
        .sort((a, b) => {
            const aEntity = catalogById.get(a)
            const bEntity = catalogById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })

    const ordered: string[] = []
    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        ordered.push(current)

        const nextIds = Array.from(adjacency.get(current) ?? []).sort((a, b) => {
            const aEntity = catalogById.get(a)
            const bEntity = catalogById.get(b)
            if (!aEntity || !bEntity) return a.localeCompare(b)
            const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
            return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
        })
        for (const nextId of nextIds) {
            const nextDegree = (indegree.get(nextId) ?? 0) - 1
            indegree.set(nextId, nextDegree)
            if (nextDegree === 0) {
                queue.push(nextId)
                queue.sort((a, b) => {
                    const aEntity = catalogById.get(a)
                    const bEntity = catalogById.get(b)
                    if (!aEntity || !bEntity) return a.localeCompare(b)
                    const codenameCmp = aEntity.codename.localeCompare(bEntity.codename)
                    return codenameCmp !== 0 ? codenameCmp : a.localeCompare(b)
                })
            }
        }
    }

    const unprocessed = catalogs.map((entity) => entity.id).filter((id) => !ordered.includes(id))
    return [...ordered, ...unprocessed]
}

/**
 * Validates numeric values against NUMERIC(precision, scale) constraints.
 * Throws an error if the value is invalid or overflows.
 *
 * This ensures data integrity - if data passed metahub validation,
 * it should pass application sync too. Any overflow indicates
 * validation was bypassed during element creation.
 */
function validateNumericValue(options: {
    value: unknown
    field: { codename: string; validationRules?: Record<string, unknown> }
    tableName: string
    elementId: string
}): number | null {
    const { value, field, tableName, elementId } = options

    if (value === undefined || value === null) {
        return null
    }

    if (typeof value !== 'number') {
        // Let DB handle type mismatch
        return value as unknown as number
    }

    const rules = field.validationRules as Partial<AttributeValidationRules> | undefined

    try {
        return validateNumberOrThrow(
            value,
            {
                precision: rules?.precision,
                scale: rules?.scale,
                min: rules?.min ?? undefined,
                max: rules?.max ?? undefined,
                nonNegative: rules?.nonNegative
            },
            {
                fieldName: field.codename,
                elementId
            }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
            `[SchemaSync] Failed to sync element ${elementId} to ${tableName}: ${message}. ` +
                `This indicates the element contains invalid data that bypassed metahub validation.`
        )
    }
}

export async function seedPredefinedElements(
    schemaName: string,
    snapshot: PublishedApplicationSnapshot,
    entities: EntityDefinition[],
    userId?: string | null,
    trx?: ApplicationSyncTransaction
): Promise<string[]> {
    if (!snapshot.elements || Object.keys(snapshot.elements).length === 0) {
        return []
    }

    const entityMap = new Map<string, EntityDefinition>(entities.map((entity) => [entity.id, entity]))
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex
    const now = new Date()
    const warnings: string[] = []
    const seenDuplicateElementIds = new Set<string>()

    const catalogOrder = resolveCatalogSeedingOrder(entities)

    const applySeed = async (activeTrx: ApplicationSyncTransaction) => {
        for (const objectId of catalogOrder) {
            const rawElements = snapshot.elements?.[objectId] as unknown[] | undefined
            const elements = (rawElements ?? []) as SnapshotElementRow[]
            if (!elements || elements.length === 0) continue

            const entity = entityMap.get(objectId)
            if (!entity) continue

            const tableName = generateTableName(entity.id, entity.kind)
            // Build field map: codename -> { columnName, field definition }
            // Exclude TABLE-type fields (no physical column) and child fields (belong to tabular tables)
            const fieldByCodename = new Map<string, { columnName: string; field: EntityField }>(
                entity.fields
                    .filter((field: EntityField) => field.dataType !== AttributeDataType.TABLE && !field.parentAttributeId)
                    .map((field: EntityField) => [field.codename, { columnName: generateColumnName(field.id), field }])
            )
            const dataColumns = Array.from(fieldByCodename.values()).map((v) => v.columnName)
            // Collect TABLE-type fields for child row seeding
            const tableFields = entity.fields.filter(
                (field: EntityField) => field.dataType === AttributeDataType.TABLE && field.childFields && field.childFields.length > 0
            )

            const rows = elements.map((element: SnapshotElementRow) => {
                const data = element.data ?? {}
                const missingRequired = entity.fields
                    .filter(
                        (field: EntityField) => field.isRequired && field.dataType !== AttributeDataType.TABLE && !field.parentAttributeId
                    )
                    .filter((field: EntityField) => {
                        if (!Object.prototype.hasOwnProperty.call(data, field.codename)) return true
                        const value = (data as Record<string, unknown>)[field.codename]
                        return value === null || value === undefined
                    })

                if (missingRequired.length > 0) {
                    const message =
                        `[SchemaSync] Skipping predefined element ${element.id} for ${tableName} ` +
                        `due to missing required fields: ${missingRequired.map((f: EntityField) => f.codename).join(', ')}`
                    console.warn(message)
                    warnings.push(message)
                    return null
                }

                const row: Record<string, unknown> = {
                    id: element.id,
                    _upl_created_at: now,
                    _upl_created_by: userId ?? null,
                    _upl_updated_at: now,
                    _upl_updated_by: userId ?? null
                }

                for (const [codename, { columnName, field }] of fieldByCodename.entries()) {
                    if (Object.prototype.hasOwnProperty.call(data, codename)) {
                        const rawValue = (data as Record<string, unknown>)[codename]
                        // VLC fields (versioned/localized STRING) are JSONB columns
                        if (isVLCField(field)) {
                            row[columnName] = prepareJsonbValue(rawValue)
                        } else if (field.dataType === AttributeDataType.JSON) {
                            // JSON type is also JSONB, prepare value
                            row[columnName] = prepareJsonbValue(rawValue)
                        } else if (field.dataType === AttributeDataType.NUMBER) {
                            // Validate and normalize NUMBER values - throws on invalid data
                            row[columnName] = validateNumericValue({
                                value: rawValue,
                                field: { codename, validationRules: field.validationRules },
                                tableName,
                                elementId: element.id
                            })
                        } else if (field.dataType === AttributeDataType.REF) {
                            if (field.targetEntityKind === 'set') {
                                row[columnName] = resolveSetReferenceId(rawValue, field)
                            } else {
                                row[columnName] = normalizeReferenceId(rawValue)
                            }
                        } else {
                            row[columnName] = rawValue
                        }
                    } else {
                        row[columnName] = null
                    }
                }

                return row
            })

            const validRows = rows.filter((row): row is Record<string, unknown> => row !== null)
            if (validRows.length === 0) continue

            // PostgreSQL ON CONFLICT DO UPDATE cannot affect the same target row twice.
            // Keep the last row for each id deterministically and emit a warning for visibility.
            const deduplicatedRowsById = new Map<string, Record<string, unknown>>()
            for (const row of validRows) {
                const rowId = String(row.id ?? '')
                if (rowId.length === 0) {
                    continue
                }
                if (deduplicatedRowsById.has(rowId) && !seenDuplicateElementIds.has(rowId)) {
                    const duplicateMessage =
                        `[SchemaSync] Duplicate predefined element id "${rowId}" detected for ${tableName}; ` +
                        `the last occurrence will be applied.`
                    console.warn(duplicateMessage)
                    warnings.push(duplicateMessage)
                    seenDuplicateElementIds.add(rowId)
                }
                deduplicatedRowsById.set(rowId, row)
            }

            const deduplicatedRows = Array.from(deduplicatedRowsById.values())
            if (deduplicatedRows.length === 0) continue

            const mergeColumns = ['_upl_updated_at', '_upl_updated_by', ...dataColumns]
            await activeTrx.withSchema(schemaName).table(tableName).insert(deduplicatedRows).onConflict('id').merge(mergeColumns)

            // Seed TABLE child rows
            if (tableFields.length > 0) {
                for (const element of elements) {
                    if (!element.data) continue
                    for (const tableField of tableFields) {
                        const tableData = (element.data as Record<string, unknown>)[tableField.codename]
                        if (!Array.isArray(tableData) || tableData.length === 0) continue

                        const tabularTableName = generateChildTableName(tableField.id)
                        const childFieldMap = new Map(
                            tableField.childFields!.map((c) => [c.codename, { columnName: generateColumnName(c.id), field: c }])
                        )

                        const childRows = tableData.map((rowData, index) => {
                            const childRow: Record<string, unknown> = {
                                id: executor.raw('public.uuid_generate_v7()'),
                                _tp_parent_id: element.id,
                                _tp_sort_order: (rowData as Record<string, unknown>)?._tp_sort_order ?? index,
                                _upl_created_at: now,
                                _upl_created_by: userId ?? null,
                                _upl_updated_at: now,
                                _upl_updated_by: userId ?? null
                            }
                            for (const [codename, { columnName, field: childField }] of childFieldMap) {
                                const value = (rowData as Record<string, unknown>)[codename]
                                childRow[columnName] = normalizeChildFieldValue(value, childField, codename, tableName, element.id)
                            }
                            return childRow
                        })

                        // Delete existing child rows for this parent element (re-seed pattern)
                        await activeTrx.withSchema(schemaName).table(tabularTableName).where('_tp_parent_id', element.id).del()
                        await activeTrx.withSchema(schemaName).table(tabularTableName).insert(childRows)
                    }
                }
            }
        }
    }

    if (trx) {
        await applySeed(trx)
    } else {
        await knex.transaction(applySeed)
    }

    return warnings
}

type EnumerationSyncRow = {
    id: string
    object_id: string
    codename: string
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

type SnapshotEnumerationValue = {
    id?: unknown
    codename?: unknown
    presentation?: unknown
    sortOrder?: unknown
    isDefault?: unknown
    name?: unknown
    description?: unknown
}

type SnapshotLayoutRow = {
    id?: unknown
    templateKey?: unknown
    name?: unknown
    description?: unknown
    config?: unknown
    isActive?: unknown
    isDefault?: unknown
    sortOrder?: unknown
}

type SnapshotWidgetRow = {
    id?: unknown
    layoutId?: unknown
    zone?: unknown
    widgetKey?: unknown
    sortOrder?: unknown
    config?: unknown
    isActive?: unknown
}

const ENUMERATION_KIND = 'enumeration'
const REF_DATA_TYPE = AttributeDataType.REF

function resolveFieldDefaultEnumValueId(field: EntityDefinition['fields'][number]): string | null {
    if (!isRecord(field.uiConfig)) return null
    const candidate = field.uiConfig.defaultEnumValueId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

async function remapStaleEnumerationReferences(options: {
    trx: ApplicationSyncTransaction
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    staleValueIdsByObject: Map<string, Set<string>>
    activeValueIdsByObject: Map<string, string[]>
    defaultValueIdByObject: Map<string, string>
    now: Date
    userId?: string | null
}): Promise<void> {
    const { trx, schemaName, snapshot, staleValueIdsByObject, activeValueIdsByObject, defaultValueIdByObject, now, userId } = options
    if (staleValueIdsByObject.size === 0) return

    const knownTables = new Map<string, boolean>()
    const catalogEntities = Object.values(snapshot.entities ?? {}).filter((entity) => entity.kind === 'catalog')

    for (const entity of catalogEntities) {
        const tableName = generateTableName(entity.id, entity.kind)
        const lifecycleContract = resolveEntityLifecycleContract(entity)
        if (!knownTables.has(tableName)) {
            const exists = await trx.schema.withSchema(schemaName).hasTable(tableName)
            knownTables.set(tableName, exists)
        }
        if (!knownTables.get(tableName)) continue

        for (const field of entity.fields ?? []) {
            if (field.dataType !== REF_DATA_TYPE) continue
            if (field.targetEntityKind !== ENUMERATION_KIND) continue
            if (typeof field.targetEntityId !== 'string' || field.targetEntityId.length === 0) continue

            const staleIds = staleValueIdsByObject.get(field.targetEntityId)
            if (!staleIds || staleIds.size === 0) continue

            const activeIds = activeValueIdsByObject.get(field.targetEntityId) ?? []
            const activeIdsSet = new Set(activeIds)
            const uiDefaultValueId = resolveFieldDefaultEnumValueId(field)
            const fallbackValueId =
                (uiDefaultValueId && activeIdsSet.has(uiDefaultValueId) ? uiDefaultValueId : null) ??
                defaultValueIdByObject.get(field.targetEntityId) ??
                activeIds[0] ??
                null

            if (field.isRequired && !fallbackValueId) {
                throw new Error(
                    `[SchemaSync] Cannot remap stale enumeration references for required field "${field.codename}" of catalog "${entity.codename}": no active enumeration values available`
                )
            }

            const columnName = generateColumnName(field.id)
            const updatePayload: Record<string, unknown> = {
                [columnName]: fallbackValueId,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null
            }

            await trx
                .withSchema(schemaName)
                .table(tableName)
                .whereIn(columnName, Array.from(staleIds))
                .andWhere((qb: ApplicationSyncQueryBuilder) => applyDynamicRuntimeActiveRowFilter(qb, lifecycleContract, entity.config))
                .update(updatePayload)
        }
    }
}

export async function syncEnumerationValues(
    schemaName: string,
    snapshot: PublishedApplicationSnapshot,
    userId?: string | null,
    trx?: ApplicationSyncTransaction
): Promise<void> {
    const knex = getApplicationSyncKnex()
    const now = new Date()

    const enumerationObjectIds = Object.values(snapshot.entities ?? {})
        .filter((entity) => entity.kind === ENUMERATION_KIND)
        .map((entity) => entity.id)
    const validEnumerationObjectIds = new Set(enumerationObjectIds)

    const enumerationValues = snapshot.enumerationValues ?? {}
    const rows = Object.entries(enumerationValues).flatMap<EnumerationSyncRow>(([objectId, values]) => {
        if (!validEnumerationObjectIds.has(objectId)) return []

        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValue[]) : []

        return typedValues.map((value) => {
            const fallbackPresentation = value as { name?: unknown; description?: unknown }
            const presentation: { name?: unknown; description?: unknown } = isRecord(value.presentation)
                ? (value.presentation as { name?: unknown; description?: unknown })
                : {}
            const id = typeof value.id === 'string' ? value.id : ''
            const codename = typeof value.codename === 'string' ? value.codename : ''

            return {
                id,
                object_id: objectId,
                codename,
                presentation: {
                    name: presentation.name ?? fallbackPresentation.name ?? {},
                    description: presentation.description ?? fallbackPresentation.description ?? {}
                },
                sort_order: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
                is_default: value.isDefault === true,
                _upl_created_at: now,
                _upl_created_by: userId ?? null,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null,
                _upl_deleted: false,
                _upl_deleted_at: null,
                _upl_deleted_by: null,
                _app_deleted: false,
                _app_deleted_at: null,
                _app_deleted_by: null
            }
        })
    })
    const rowsByObject = new Map<string, EnumerationSyncRow[]>()
    for (const row of rows) {
        const list = rowsByObject.get(row.object_id) ?? []
        list.push(row)
        rowsByObject.set(row.object_id, list)
    }
    for (const objectRows of rowsByObject.values()) {
        objectRows.sort((left, right) => {
            if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order
            return left.id.localeCompare(right.id)
        })
        let defaultAssigned = false
        for (const row of objectRows) {
            if (row.is_default !== true) continue
            if (!defaultAssigned) {
                defaultAssigned = true
                continue
            }
            row.is_default = false
        }
    }

    const seenValueIds = new Set<string>()
    for (const row of rows) {
        if (!seenValueIds.has(row.id)) {
            seenValueIds.add(row.id)
            continue
        }
        throw new Error(`Duplicate enumeration value id in snapshot: ${row.id}`)
    }

    const valueIds = rows.map((row) => row.id)
    const desiredValueIdsByObject = new Map<string, Set<string>>()
    const defaultValueIdByObject = new Map<string, string>()
    const activeValueIdsByObject = new Map<string, string[]>()
    for (const [objectId, objectRows] of rowsByObject.entries()) {
        const ids = objectRows.map((row) => row.id)
        desiredValueIdsByObject.set(objectId, new Set(ids))
        activeValueIdsByObject.set(objectId, ids)
        const defaultRow = objectRows.find((row) => row.is_default)
        if (defaultRow) {
            defaultValueIdByObject.set(objectId, defaultRow.id)
        }
    }

    const softDeletePatch = {
        _upl_deleted: true,
        _upl_deleted_at: now,
        _upl_deleted_by: userId ?? null,
        _app_deleted: true,
        _app_deleted_at: now,
        _app_deleted_by: userId ?? null,
        _upl_updated_at: now,
        _upl_updated_by: userId ?? null
    }

    const applySync = async (activeTrx: ApplicationSyncTransaction) => {
        const tableQuery = () => activeTrx.withSchema(schemaName).table('_app_values')
        const existingActiveRows = (await tableQuery()
            .select(['id', 'object_id'])
            .where((qb) => qb.where('_upl_deleted', false).orWhere('_app_deleted', false))) as Array<{
            id: string
            object_id: string
        }>
        const staleValueIdsByObject = new Map<string, Set<string>>()
        for (const row of existingActiveRows) {
            const desiredIds = desiredValueIdsByObject.get(row.object_id)
            if (!validEnumerationObjectIds.has(row.object_id) || !desiredIds?.has(row.id)) {
                const ids = staleValueIdsByObject.get(row.object_id) ?? new Set<string>()
                ids.add(row.id)
                staleValueIdsByObject.set(row.object_id, ids)
            }
        }

        await remapStaleEnumerationReferences({
            trx: activeTrx,
            schemaName,
            snapshot,
            staleValueIdsByObject,
            activeValueIdsByObject,
            defaultValueIdByObject,
            now,
            userId
        })

        if (enumerationObjectIds.length === 0) {
            await tableQuery()
                .where((qb) => qb.where('_upl_deleted', false).orWhere('_app_deleted', false))
                .update(softDeletePatch)
            return
        }

        await tableQuery()
            .whereNotIn('object_id', enumerationObjectIds)
            .andWhere((qb) => qb.where('_upl_deleted', false).orWhere('_app_deleted', false))
            .update(softDeletePatch)

        if (valueIds.length > 0) {
            await tableQuery()
                .whereIn('object_id', enumerationObjectIds)
                .whereNotIn('id', valueIds)
                .andWhere((qb) => qb.where('_upl_deleted', false).orWhere('_app_deleted', false))
                .update(softDeletePatch)
            await tableQuery()
                .insert(rows)
                .onConflict('id')
                .merge([
                    'object_id',
                    'codename',
                    'presentation',
                    'sort_order',
                    'is_default',
                    '_upl_updated_at',
                    '_upl_updated_by',
                    '_upl_deleted',
                    '_upl_deleted_at',
                    '_upl_deleted_by',
                    '_app_deleted',
                    '_app_deleted_at',
                    '_app_deleted_by'
                ])
            return
        }

        await tableQuery()
            .whereIn('object_id', enumerationObjectIds)
            .andWhere((qb) => qb.where('_upl_deleted', false).orWhere('_app_deleted', false))
            .update(softDeletePatch)
    }

    if (trx) {
        await applySync(trx)
    } else {
        await knex.transaction(applySync)
    }
}

type PersistedAppLayout = {
    id: string
    templateKey: string
    name: Record<string, unknown>
    description: Record<string, unknown> | null
    config: Record<string, unknown>
    isActive: boolean
    isDefault: boolean
    sortOrder: number
}

function normalizeSnapshotLayouts(snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] {
    const rows = (Array.isArray(snapshot.layouts) ? snapshot.layouts : [])
        .map((layout) => {
            const normalizedLayout = (layout ?? {}) as SnapshotLayoutRow

            return {
                id: String(normalizedLayout.id ?? ''),
                templateKey:
                    typeof normalizedLayout.templateKey === 'string' && normalizedLayout.templateKey.length > 0
                        ? normalizedLayout.templateKey
                        : 'dashboard',
                name: isRecord(normalizedLayout.name) ? normalizedLayout.name : {},
                description: isRecord(normalizedLayout.description) ? normalizedLayout.description : null,
                config: isRecord(normalizedLayout.config) ? normalizedLayout.config : {},
                isActive: Boolean(normalizedLayout.isActive),
                isDefault: Boolean(normalizedLayout.isDefault),
                sortOrder: typeof normalizedLayout.sortOrder === 'number' ? normalizedLayout.sortOrder : 0
            }
        })
        .filter((layout) => layout.id.length > 0)

    const desiredDefaultLayoutId = typeof snapshot.defaultLayoutId === 'string' ? snapshot.defaultLayoutId : null
    if (desiredDefaultLayoutId) {
        for (const row of rows) {
            row.isDefault = row.id === desiredDefaultLayoutId
        }
    }

    if (rows.length > 0 && !rows.some((row) => row.isDefault)) {
        const fallback = rows.find((row) => row.isActive) ?? rows[0]
        fallback.isDefault = true
    }

    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

type PersistedAppLayoutZoneWidget = {
    id: string
    layoutId: string
    zone: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
}

type PersistedAppLayoutRowDb = {
    id: unknown
    template_key: unknown
    name: unknown
    description: unknown
    config: unknown
    is_active: unknown
    is_default: unknown
    sort_order: unknown
}

type PersistedAppWidgetRowDb = {
    id: unknown
    layout_id: unknown
    zone: unknown
    widget_key: unknown
    sort_order: unknown
    config: unknown
}

function normalizeSnapshotLayoutZoneWidgets(snapshot: PublishedApplicationSnapshot): PersistedAppLayoutZoneWidget[] {
    return (Array.isArray(snapshot.layoutZoneWidgets) ? snapshot.layoutZoneWidgets : [])
        .map((item) => (item ?? {}) as SnapshotWidgetRow)
        .filter((item) => item.isActive !== false)
        .map((item) => ({
            id: String(item.id ?? ''),
            layoutId: String(item.layoutId ?? ''),
            zone: typeof item.zone === 'string' ? item.zone : 'center',
            widgetKey: typeof item.widgetKey === 'string' ? item.widgetKey : '',
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: isRecord(item.config) ? item.config : {}
        }))
        .filter((item) => item.id.length > 0 && item.layoutId.length > 0 && item.widgetKey.length > 0)
        .sort((a, b) => {
            if (a.layoutId !== b.layoutId) return a.layoutId.localeCompare(b.layoutId)
            if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.id.localeCompare(b.id)
        })
}

type DiffTableFieldDetails = {
    id: string
    codename: string
    dataType: string
    isRequired: boolean
    parentAttributeId: string | null
}

type DiffTableDetails = {
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

type DiffStructuredChange = {
    type: string
    description: string
    entityCodename?: string
    fieldCodename?: string
    tableName?: string
    dataType?: string
    oldValue?: unknown
    newValue?: unknown
}

type EntityField = EntityDefinition['fields'][number]
type SnapshotElementRow = {
    id: string
    data?: Record<string, unknown>
    sortOrder?: number
}

function resolveElementPreviewLabel(entity: EntityDefinition, data: Record<string, unknown>): string | null {
    const fields = entity.fields ?? []
    const displayField =
        fields.find((field) => field.isDisplayAttribute) ?? fields.find((field) => field.dataType === AttributeDataType.STRING) ?? fields[0]

    if (!displayField) return null
    const rawValue = data[displayField.codename]
    if (rawValue === null || rawValue === undefined) return null

    const localized = resolveLocalizedPreviewText(rawValue)
    if (localized) return localized

    if (typeof rawValue === 'string') return rawValue
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') return String(rawValue)
    return null
}

function resolveSetConstantPreviewValue(field: EntityField, fallbackRefId: string): unknown {
    const setConstantRef = extractSetConstantRefConfig(field.uiConfig)
    if (!setConstantRef) return fallbackRefId

    const value = setConstantRef.value
    if (value === null || value === undefined) {
        const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
        return localizedName ?? setConstantRef.codename ?? setConstantRef.id
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
    }

    const localizedValue = resolveLocalizedPreviewText(value)
    if (localizedValue) return localizedValue

    const localizedName = resolveLocalizedPreviewText(setConstantRef.name)
    if (localizedName) return localizedName

    try {
        return JSON.stringify(value)
    } catch {
        return setConstantRef.codename ?? setConstantRef.id
    }
}

function buildPreviewLabelMaps(
    entities: EntityDefinition[],
    snapshot: PublishedApplicationSnapshot
): {
    catalogElementLabels: Map<string, Map<string, string>>
    enumerationValueLabels: Map<string, Map<string, string>>
} {
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]))
    const catalogElementLabels = new Map<string, Map<string, string>>()
    const enumerationValueLabels = new Map<string, Map<string, string>>()

    for (const [objectId, rawElements] of Object.entries(snapshot.elements ?? {})) {
        const entity = entityMap.get(objectId)
        if (!entity || entity.kind !== 'catalog') continue

        const labels = new Map<string, string>()
        for (const rawElement of rawElements ?? []) {
            const element = (rawElement ?? {}) as SnapshotElementRow
            if (!element.id || !isRecord(element.data)) continue

            const label = resolveElementPreviewLabel(entity, element.data as Record<string, unknown>)
            if (label) {
                labels.set(element.id, label)
            }
        }
        if (labels.size > 0) {
            catalogElementLabels.set(objectId, labels)
        }
    }

    for (const [objectId, values] of Object.entries(snapshot.enumerationValues ?? {})) {
        const labels = new Map<string, string>()
        const typedValues = Array.isArray(values) ? (values as SnapshotEnumerationValue[]) : []
        for (const value of typedValues) {
            const presentation = isRecord(value.presentation) ? (value.presentation as Record<string, unknown>) : null
            const localizedName = resolveLocalizedPreviewText(presentation?.name)
            const id = typeof value.id === 'string' ? value.id : null
            const label = localizedName || (typeof value.codename === 'string' ? value.codename : null) || id
            if (id && label) {
                labels.set(id, label)
            }
        }
        if (labels.size > 0) {
            enumerationValueLabels.set(objectId, labels)
        }
    }

    return { catalogElementLabels, enumerationValueLabels }
}

function buildCreateTableDetails(options: {
    entities: EntityDefinition[]
    snapshot: PublishedApplicationSnapshot
    includeEntityIds?: Set<string>
}): DiffTableDetails[] {
    const { entities, snapshot, includeEntityIds } = options
    const catalogEntities = entities.filter((entity) => entity.kind === 'catalog')
    const { catalogElementLabels, enumerationValueLabels } = buildPreviewLabelMaps(entities, snapshot)

    return catalogEntities
        .filter((entity) => (includeEntityIds ? includeEntityIds.has(entity.id) : true))
        .map((entity) => {
            const fields = (entity.fields ?? []).map((f: EntityField) => ({
                id: f.id,
                codename: f.codename,
                dataType: f.dataType,
                isRequired: Boolean(f.isRequired),
                parentAttributeId: f.parentAttributeId ?? null
            }))

            const elements = (snapshot.elements && (snapshot.elements as Record<string, unknown[]>)[entity.id]) as unknown[] | undefined
            const predefinedElements = Array.isArray(elements)
                ? elements.map((el) => {
                      const normalized = (el ?? {}) as Record<string, unknown>
                      const rawData = (normalized.data as Record<string, unknown>) ?? {}
                      const previewData: Record<string, unknown> = {}

                      for (const field of entity.fields ?? []) {
                          const rawValue = rawData[field.codename]
                          if (rawValue === null || rawValue === undefined) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          if (field.dataType !== AttributeDataType.REF) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          const refId = normalizeReferenceId(rawValue)
                          if (!refId) {
                              previewData[field.codename] = rawValue
                              continue
                          }

                          if (field.targetEntityKind === ENUMERATION_KIND && field.targetEntityId) {
                              const label = enumerationValueLabels.get(field.targetEntityId)?.get(refId)
                              previewData[field.codename] = label ?? refId
                              continue
                          }

                          if (field.targetEntityKind === 'set') {
                              previewData[field.codename] = resolveSetConstantPreviewValue(field, refId)
                              continue
                          }

                          if (field.targetEntityKind === 'catalog' && field.targetEntityId) {
                              const label = catalogElementLabels.get(field.targetEntityId)?.get(refId)
                              previewData[field.codename] = label ?? refId
                              continue
                          }

                          previewData[field.codename] = refId
                      }

                      return {
                          id: String(normalized.id ?? ''),
                          data: previewData,
                          sortOrder: typeof normalized.sortOrder === 'number' ? normalized.sortOrder : 0
                      }
                  })
                : []

            return {
                id: entity.id,
                codename: entity.codename,
                tableName: generateTableName(entity.id, entity.kind),
                fields,
                predefinedElementsCount: predefinedElements.length,
                predefinedElementsPreview: predefinedElements.slice(0, 50)
            }
        })
}

function mapStructuredChange(change: SchemaChange): DiffStructuredChange {
    return {
        type: String(change.type),
        description: change.description,
        entityCodename: change.entityCodename,
        fieldCodename: change.fieldCodename,
        tableName: change.tableName,
        dataType: typeof change.newValue === 'string' ? change.newValue : undefined,
        oldValue: change.oldValue,
        newValue: change.newValue
    }
}

export async function persistPublishedLayouts(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex

    try {
        const { generator } = getApplicationSyncDdlServices()
        await generator.ensureSystemTables(schemaName, trx)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SchemaSync] Failed to ensure _app_layouts for layouts (ignored)', e)
    }

    const hasLayouts = await executor.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) return

    const now = new Date()
    const nextLayouts = normalizeSnapshotLayouts(snapshot)

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        // Clear is_default on all existing active layouts to avoid unique partial
        // index violation (idx_app_layouts_default_active) when inserting a new
        // default layout while the old one still exists.
        if (existingRows.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false, is_default: true })
                .update({ is_default: false })
        }

        for (const row of nextLayouts) {
            const payload = {
                template_key: row.templateKey,
                name: row.name,
                description: row.description,
                config: row.config,
                is_active: row.isActive,
                is_default: row.isDefault,
                sort_order: row.sortOrder,
                owner_id: null
            }

            if (existingIds.has(row.id)) {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
                    .withSchema(schemaName)
                    .into('_app_layouts')
                    .insert({
                        id: row.id,
                        ...payload,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _app_published: true,
                        _app_archived: false,
                        _app_deleted: false
                    })
            }
        }

        const nextIds = nextLayouts.map((row) => row.id)
        if (nextIds.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_layouts').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

export async function persistPublishedWidgets(options: {
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    userId?: string | null
    trx?: ApplicationSyncTransaction
}): Promise<void> {
    const { schemaName, snapshot, userId, trx } = options
    const knex = getApplicationSyncKnex()
    const executor = trx ?? knex
    const hasTable = await executor.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) return

    const now = new Date()
    const nextRows = normalizeSnapshotLayoutZoneWidgets(snapshot)

    const applyPersist = async (activeTrx: ApplicationSyncTransaction) => {
        const existingRows = await activeTrx
            .withSchema(schemaName)
            .from('_app_widgets')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        for (const row of nextRows) {
            const payload = {
                layout_id: row.layoutId,
                zone: row.zone,
                widget_key: row.widgetKey,
                sort_order: row.sortOrder,
                config: row.config
            }
            if (existingIds.has(row.id)) {
                await activeTrx
                    .withSchema(schemaName)
                    .from('_app_widgets')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: activeTrx.raw('_upl_version + 1')
                    })
            } else {
                await activeTrx
                    .withSchema(schemaName)
                    .into('_app_widgets')
                    .insert({
                        id: row.id,
                        ...payload,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _app_published: true,
                        _app_archived: false,
                        _app_deleted: false
                    })
            }
        }

        const nextIds = nextRows.map((row) => row.id)
        if (nextIds.length > 0) {
            await activeTrx
                .withSchema(schemaName)
                .from('_app_widgets')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await activeTrx.withSchema(schemaName).from('_app_widgets').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    }

    if (trx) {
        await applyPersist(trx)
    } else {
        await knex.transaction(applyPersist)
    }
}

async function getPersistedDashboardLayoutConfig(options: { schemaName: string }): Promise<Record<string, unknown>> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return {}
    }

    const preferredDefault = await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ is_default: true, _upl_deleted: false, _app_deleted: false })
        .select(['config'])
        .first()

    const fallbackActive = preferredDefault
        ? null
        : await knex
              .withSchema(schemaName)
              .from('_app_layouts')
              .where({ is_active: true, _upl_deleted: false, _app_deleted: false })
              .orderBy([
                  { column: 'sort_order', order: 'asc' },
                  { column: '_upl_created_at', order: 'asc' }
              ])
              .select(['config'])
              .first()

    const value = (preferredDefault?.config ?? fallbackActive?.config) as unknown
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

async function getPersistedPublishedLayouts(options: {
    schemaName: string
}): Promise<{ layouts: PersistedAppLayout[]; defaultLayoutId: string | null }> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return { layouts: [], defaultLayoutId: null }
    }

    const rows = (await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
        .orderBy([
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])) as PersistedAppLayoutRowDb[]

    const layouts = rows.map((row) => ({
        id: String(row.id),
        templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
        name: isRecord(row.name) ? row.name : {},
        description: isRecord(row.description) ? row.description : null,
        config: isRecord(row.config) ? row.config : {},
        isActive: Boolean(row.is_active),
        isDefault: Boolean(row.is_default),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    const defaultLayoutId = layouts.find((layout) => layout.isDefault)?.id ?? null
    return { layouts, defaultLayoutId }
}

async function getPersistedPublishedWidgets(options: { schemaName: string }): Promise<PersistedAppLayoutZoneWidget[]> {
    const { schemaName } = options
    const knex = getApplicationSyncKnex()

    const hasTable = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) {
        return []
    }

    const rows = (await knex
        .withSchema(schemaName)
        .from('_app_widgets')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'layout_id', 'zone', 'widget_key', 'sort_order', 'config'])
        .orderBy([
            { column: 'layout_id', order: 'asc' },
            { column: 'zone', order: 'asc' },
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])) as PersistedAppWidgetRowDb[]

    return rows.map((row) => ({
        id: String(row.id),
        layoutId: String(row.layout_id),
        zone: String(row.zone),
        widgetKey: String(row.widget_key),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: isRecord(row.config) ? row.config : {}
    }))
}

function buildMergedDashboardLayoutConfig(snapshot: PublishedApplicationSnapshot): Record<string, unknown> {
    const parsed = dashboardLayoutConfigSchema.safeParse(snapshot.layoutConfig ?? {})
    return {
        ...defaultDashboardLayoutConfig,
        ...(parsed.success ? parsed.data : {})
    }
}

async function hasDashboardLayoutConfigChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedDashboardLayoutConfig({ schemaName })
    const next = buildMergedDashboardLayoutConfig(snapshot)

    // Stable compare to avoid false positives due to key ordering.
    return stableStringify(current) !== stableStringify(next)
}

async function hasPublishedLayoutsChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedPublishedLayouts({ schemaName })
    const normalizedLayouts = normalizeSnapshotLayouts(snapshot)
    const next = {
        layouts: normalizedLayouts,
        defaultLayoutId: normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
    }

    return stableStringify(current) !== stableStringify(next)
}

async function hasPublishedWidgetsChanges(options: { schemaName: string; snapshot: PublishedApplicationSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options
    const current = await getPersistedPublishedWidgets({ schemaName })
    const next = normalizeSnapshotLayoutZoneWidgets(snapshot)
    return stableStringify(current) !== stableStringify(next)
}

export async function persistSeedWarnings(
    schemaName: string,
    migrationManager: DDLServices['migrationManager'],
    warnings: string[],
    options?: {
        trx?: ApplicationSyncTransaction
        migrationId?: string
    }
): Promise<void> {
    if (warnings.length === 0) return

    const executor = options?.trx ?? getApplicationSyncKnex()

    let migrationRecord: { id: string; meta: Record<string, unknown> } | null = null

    if (options?.migrationId) {
        const row = await executor
            .withSchema(schemaName)
            .table('_app_migrations')
            .select(['id', 'meta'])
            .where({ id: options.migrationId })
            .first()
        if (!row) return
        migrationRecord = {
            id: String(row.id),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
        }
    } else if (options?.trx) {
        const row = await executor
            .withSchema(schemaName)
            .table('_app_migrations')
            .select(['id', 'meta'])
            .orderBy('applied_at', 'desc')
            .first()
        if (!row) return
        migrationRecord = {
            id: String(row.id),
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
        }
    } else {
        const latestMigration = await migrationManager.getLatestMigration(schemaName)
        if (!latestMigration) return
        migrationRecord = {
            id: latestMigration.id,
            meta: latestMigration.meta as unknown as Record<string, unknown>
        }
    }

    const existing = Array.isArray(migrationRecord.meta.seedWarnings) ? migrationRecord.meta.seedWarnings : []
    const mergedWarnings = [...existing, ...warnings]

    await executor
        .withSchema(schemaName)
        .table('_app_migrations')
        .where({ id: migrationRecord.id })
        .update({
            meta: JSON.stringify({
                ...migrationRecord.meta,
                seedWarnings: mergedWarnings
            })
        })
}

export async function runPublishedApplicationRuntimeSync(options: {
    trx: ApplicationSyncTransaction
    applicationId: string
    schemaName: string
    snapshot: PublishedApplicationSnapshot
    entities: EntityDefinition[]
    migrationManager: DDLServices['migrationManager']
    migrationId?: string
    userId?: string | null
    workspacesEnabled?: boolean
}): Promise<{ seedWarnings: string[] }> {
    const { trx, applicationId, schemaName, snapshot, entities, migrationManager, migrationId, userId } = options

    await persistPublishedLayouts({
        schemaName,
        snapshot,
        userId,
        trx
    })
    await persistPublishedWidgets({
        schemaName,
        snapshot,
        userId,
        trx
    })
    await syncEnumerationValues(schemaName, snapshot, userId, trx)

    if (options.workspacesEnabled) {
        await persistWorkspaceSeedTemplate(createKnexExecutor(trx), {
            schemaName,
            elements: snapshot.elements ?? {},
            actorUserId: userId
        })

        await ensureApplicationRuntimeWorkspaceSchema(createKnexExecutor(trx), {
            schemaName,
            applicationId,
            entities,
            actorUserId: userId
        })
        await syncWorkspaceSeededElementsForAllActiveWorkspaces(createKnexExecutor(trx), {
            schemaName,
            actorUserId: userId
        })
    }

    const seedWarnings = options.workspacesEnabled ? [] : await seedPredefinedElements(schemaName, snapshot, entities, userId, trx)
    await persistSeedWarnings(schemaName, migrationManager, seedWarnings, {
        trx,
        migrationId
    })

    return { seedWarnings }
}

export function createApplicationSyncRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    loadPublishedApplicationSyncContext: LoadPublishedApplicationSyncContext,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router()

    // ════════════════════════════════════════════════════════════════════
    // POST /application/:applicationId/sync - Create or update schema
    // ════════════════════════════════════════════════════════════════════
    router.post(
        '/application/:applicationId/sync',
        ensureAuth,
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            // Check access
            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const syncSchema = z.object({
                confirmDestructive: z.boolean().optional().default(false)
            })
            const parsed = syncSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }
            const { confirmDestructive } = parsed.data

            // Acquire advisory lock to prevent concurrent syncs on the same application
            const lockKey = uuidToLockKey(`app-sync:${applicationId}`)
            const lockAcquired = await acquireApplicationSyncAdvisoryLock(lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    message: 'Another sync operation is already running for this application. Please try again later.'
                })
            }

            try {
                const application = await findApplicationCopySource(exec, applicationId)
                if (!application) {
                    return res.status(404).json({ error: 'Application not found' })
                }

                const connector = await findFirstConnectorByApplicationId(exec, applicationId)
                if (!connector) {
                    return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
                }

                const connectorPublication = await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id)
                if (!connectorPublication) {
                    return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
                }

                const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
                if (!syncContext) {
                    return res.status(400).json({
                        error: 'Publication sync context unavailable',
                        message: 'Linked publication must exist and have a valid active version to sync.'
                    })
                }

                const {
                    publicationId,
                    publicationVersionId,
                    snapshotHash,
                    snapshot,
                    entities: catalogDefs,
                    publicationSnapshot
                } = syncContext
                if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                    return res.status(400).json({ error: 'Invalid publication snapshot' })
                }
                const source = buildApplicationSyncSourceFromPublication({
                    application,
                    syncContext: {
                        publicationId,
                        publicationVersionId,
                        snapshotHash,
                        snapshot,
                        entities: catalogDefs,
                        publicationSnapshot
                    }
                })
                const result = await syncApplicationSchemaFromSource({
                    application,
                    exec,
                    userId,
                    confirmDestructive,
                    connectorId: connector.id,
                    source
                })

                return res.status(result.statusCode).json(result.body)
            } finally {
                await releaseApplicationSyncAdvisoryLock(lockKey)
            }
        })
    )

    router.get(
        '/application/:applicationId/release-bundle',
        ensureAuth,
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const application = await findApplicationCopySource(exec, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const exportQuery = z.object({
                source: z.enum(['publication', 'application']).optional()
            })
            const parsedQuery = exportQuery.safeParse(req.query)
            if (!parsedQuery.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsedQuery.error.flatten() })
            }

            const requestedSource = parsedQuery.data.source

            let connector = null as Awaited<ReturnType<typeof findFirstConnectorByApplicationId>> | null
            let connectorPublication = null as Awaited<ReturnType<typeof findFirstConnectorPublicationLinkByConnectorId>> | null

            if (requestedSource !== 'application') {
                connector = await findFirstConnectorByApplicationId(exec, applicationId)
                connectorPublication = connector ? await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id) : null

                if (connector && connectorPublication) {
                    const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
                    if (syncContext) {
                        const bundle = createPublicationApplicationReleaseBundle({
                            application,
                            syncContext
                        })

                        return res.json({ bundle })
                    }

                    if (requestedSource === 'publication') {
                        return res.status(400).json({
                            error: 'Publication sync context unavailable',
                            message: 'Linked publication must exist and have a valid active version to sync.'
                        })
                    }
                } else if (requestedSource === 'publication') {
                    if (!connector) {
                        return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
                    }

                    return res.status(400).json({
                        error: 'Connector is not linked to any Publication. Link a Publication first.'
                    })
                }
            }

            try {
                const bundle = await createExistingApplicationReleaseBundle({
                    exec,
                    application
                })

                return res.json({ bundle })
            } catch (error) {
                if (requestedSource === 'application') {
                    const message = error instanceof Error ? error.message : 'Application runtime export is unavailable.'
                    return res.status(400).json({ error: 'Application runtime export unavailable', message })
                }
            }

            if (!connector) {
                return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
            }

            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
            }

            const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
            if (!syncContext) {
                return res.status(400).json({
                    error: 'Publication sync context unavailable',
                    message: 'Linked publication must exist and have a valid active version to sync.'
                })
            }

            const bundle = createPublicationApplicationReleaseBundle({
                application,
                syncContext
            })

            return res.json({ bundle })
        })
    )

    router.post(
        '/application/:applicationId/release-bundle/apply',
        ensureAuth,
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const applySchema = z.object({
                confirmDestructive: z.boolean().optional().default(false),
                bundle: applicationReleaseBundleSchema
            })
            const parsed = applySchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const lockKey = uuidToLockKey(`app-sync:${applicationId}`)
            const lockAcquired = await acquireApplicationSyncAdvisoryLock(lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    message: 'Another sync operation is already running for this application. Please try again later.'
                })
            }

            try {
                const application = await findApplicationCopySource(exec, applicationId)
                if (!application) {
                    return res.status(404).json({ error: 'Application not found' })
                }

                const connector = await findFirstConnectorByApplicationId(exec, applicationId)
                const currentInstalledReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
                const expectedFromVersion = parsed.data.bundle.incrementalMigration.fromVersion ?? null

                if (currentInstalledReleaseVersion && currentInstalledReleaseVersion !== expectedFromVersion) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message: `Bundle expects installed release ${
                            expectedFromVersion ?? 'null'
                        }, but application currently has ${currentInstalledReleaseVersion}.`
                    })
                }

                if (!currentInstalledReleaseVersion && expectedFromVersion && application.schemaName) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message:
                            'Bundle expects an existing installed release, but the target application has no tracked installed_release_metadata.'
                    })
                }

                if (!currentInstalledReleaseVersion && !expectedFromVersion && application.schemaName) {
                    return res.status(409).json({
                        error: 'Release version mismatch',
                        message:
                            'Bundle install is ambiguous for an existing schema without tracked installed_release_metadata. Resync from the publication source or initialize release metadata before applying a baseline bundle.'
                    })
                }

                let source: ApplicationSchemaSyncSource
                try {
                    source = buildApplicationSyncSourceFromBundle(parsed.data.bundle as unknown as ApplicationReleaseBundle)
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Release bundle artifact validation failed'
                    return res.status(400).json({
                        error: 'Invalid release bundle',
                        message
                    })
                }
                const result = await syncApplicationSchemaFromSource({
                    application,
                    exec,
                    userId,
                    confirmDestructive: parsed.data.confirmDestructive,
                    connectorId: connector?.id ?? null,
                    source
                })

                return res.status(result.statusCode).json(result.body)
            } finally {
                await releaseApplicationSyncAdvisoryLock(lockKey)
            }
        })
    )

    // ════════════════════════════════════════════════════════════════════
    // GET /application/:applicationId/diff - Calculate schema diff
    // ════════════════════════════════════════════════════════════════════
    router.get(
        '/application/:applicationId/diff',
        ensureAuth,
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { applicationId } = req.params
            const exec = getDbExecutor()

            try {
                await ensureApplicationAccess(exec, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const application = await findApplicationCopySource(exec, applicationId)
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const connector = await findFirstConnectorByApplicationId(exec, applicationId)
            if (!connector) {
                return res.status(400).json({ error: 'No connector found' })
            }

            const connectorPublication = await findFirstConnectorPublicationLinkByConnectorId(exec, connector.id)
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector not linked to Publication' })
            }

            const syncContext = await loadPublishedApplicationSyncContext(exec, connectorPublication.publicationId)
            if (!syncContext) {
                return res.status(400).json({
                    error: 'Publication sync context unavailable',
                    message: 'Linked publication must exist and have a valid active version to sync.'
                })
            }

            const { snapshot, snapshotHash } = syncContext
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }
            const executableCatalogDefs = resolveExecutablePayloadEntities(snapshot)

            const { generator, migrator, migrationManager } = getApplicationSyncDdlServices()

            const schemaName = application.schemaName || generateSchemaName(application.id)
            const schemaExists = await generator.schemaExists(schemaName)

            if (!schemaExists) {
                const createTables = buildCreateTableDetails({ entities: executableCatalogDefs, snapshot })

                // Keep human-readable additive strings for backward compatibility.
                // Frontend should prefer `diff.details.create.tables` for i18n-friendly rendering.
                const additive = createTables.map((t) => `Create table "${t.codename}" with ${t.fields.length} field(s)`)

                return res.json({
                    schemaExists: false,
                    schemaName,
                    diff: {
                        hasChanges: true,
                        hasDestructiveChanges: false,
                        additive,
                        destructive: [],
                        summaryKey: 'schema.create.summary',
                        summaryParams: { tablesCount: createTables.length },
                        summary: `Create ${createTables.length} table(s) in new schema`,
                        details: {
                            create: {
                                tables: createTables
                            },
                            changes: {
                                additive: additive.map((description) => ({
                                    type: 'CREATE_TABLE',
                                    description
                                })),
                                destructive: []
                            }
                        }
                    },
                    messageKey: 'schema.create.message',
                    message: 'Schema does not exist yet. These tables will be created.'
                })
            }

            const latestMigration = await migrationManager.getLatestMigration(schemaName)
            const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
            if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
                const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
                const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
                const widgetsNeedUpdate = await hasPublishedWidgetsChanges({ schemaName, snapshot })
                const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate
                return res.json({
                    schemaExists: true,
                    schemaName,
                    diff: {
                        hasChanges: hasUiChanges,
                        hasDestructiveChanges: false,
                        additive: [
                            ...(uiNeedsUpdate ? [UI_LAYOUT_DIFF_MARKER] : []),
                            ...(layoutsNeedUpdate ? [UI_LAYOUTS_DIFF_MARKER] : []),
                            ...(widgetsNeedUpdate ? [UI_LAYOUT_ZONES_DIFF_MARKER] : [])
                        ],
                        destructive: [],
                        summaryKey: hasUiChanges ? 'ui.layout.changed' : 'schema.upToDate',
                        summary: hasUiChanges ? 'UI layout settings have changed' : 'Schema is already up to date'
                    }
                })
            }

            const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
            const diff = migrator.calculateDiff(oldSnapshot, executableCatalogDefs)
            const hasDestructiveChanges = diff.destructive.length > 0

            const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName, snapshot })
            const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName, snapshot })
            const widgetsNeedUpdate = await hasPublishedWidgetsChanges({ schemaName, snapshot })
            const addedTableEntityIds = new Set<string>(
                diff.additive
                    .filter((change: SchemaChange) => change.type === 'ADD_TABLE' && Boolean(change.entityId))
                    .map((change: SchemaChange) => String(change.entityId))
            )
            const createTables = buildCreateTableDetails({
                entities: executableCatalogDefs,
                snapshot,
                includeEntityIds: addedTableEntityIds
            })
            const additive = diff.additive.map((c: SchemaChange) => c.description)
            if (uiNeedsUpdate) {
                additive.push(UI_LAYOUT_DIFF_MARKER)
            }
            if (layoutsNeedUpdate) {
                additive.push(UI_LAYOUTS_DIFF_MARKER)
            }
            if (widgetsNeedUpdate) {
                additive.push(UI_LAYOUT_ZONES_DIFF_MARKER)
            }
            // Snapshot hash can change without any DDL changes (e.g., attribute reorder, labels, validations).
            // We still need to allow users to "apply" changes so system metadata tables are synced and the
            // applied snapshot hash is advanced by the sync endpoint.
            const systemMetadataNeedsUpdate =
                Boolean(snapshotHash && lastAppliedHash && snapshotHash !== lastAppliedHash) &&
                !diff.hasChanges &&
                !uiNeedsUpdate &&
                !layoutsNeedUpdate &&
                !widgetsNeedUpdate
            if (systemMetadataNeedsUpdate) {
                additive.push(SYSTEM_METADATA_DIFF_MARKER)
            }

            const additiveStructured: DiffStructuredChange[] = diff.additive.map((c: SchemaChange) => mapStructuredChange(c))
            if (uiNeedsUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUT_UPDATE',
                    description: UI_LAYOUT_DIFF_MARKER
                })
            }
            if (layoutsNeedUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUTS_UPDATE',
                    description: UI_LAYOUTS_DIFF_MARKER
                })
            }
            if (widgetsNeedUpdate) {
                additiveStructured.push({
                    type: 'UI_LAYOUT_ZONES_UPDATE',
                    description: UI_LAYOUT_ZONES_DIFF_MARKER
                })
            }
            if (systemMetadataNeedsUpdate) {
                additiveStructured.push({
                    type: 'SYSTEM_METADATA_UPDATE',
                    description: SYSTEM_METADATA_DIFF_MARKER
                })
            }

            const destructiveStructured: DiffStructuredChange[] = diff.destructive.map((c: SchemaChange) => mapStructuredChange(c))

            return res.json({
                schemaExists: true,
                schemaName,
                diff: {
                    hasChanges: diff.hasChanges || uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate || systemMetadataNeedsUpdate,
                    hasDestructiveChanges,
                    additive,
                    destructive: diff.destructive.map((c: SchemaChange) => c.description),
                    summaryKey: systemMetadataNeedsUpdate
                        ? 'schema.metadata.changed'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate)
                        ? 'ui.layout.changed'
                        : undefined,
                    summary: systemMetadataNeedsUpdate
                        ? 'System metadata will be updated'
                        : !diff.hasChanges && (uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate)
                        ? 'UI layout settings have changed'
                        : diff.summary,
                    details: {
                        create: {
                            tables: createTables
                        },
                        changes: {
                            additive: additiveStructured,
                            destructive: destructiveStructured
                        }
                    }
                }
            })
        })
    )

    return router
}
