/**
 * Application Sync - Helper Functions
 *
 * Pure utility functions for schema sync operations.
 * No database access - only data transformation and validation.
 */

import { type Request, type Response, type RequestHandler } from 'express'
import stableStringify from 'json-stable-stringify'
import { assertCanonicalIdentifier, assertCanonicalSchemaName, quoteIdentifier } from '@universo/migrations-core'
import type { EntityDefinition, SchemaSnapshot } from '@universo/schema-ddl'
import {
    ApplicationSchemaStatus,
    AttributeDataType,
    type ApplicationLifecycleContract,
    type AttributeValidationRules,
    type VersionedLocalizedContent
} from '@universo/types'
import {
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    validateNumberOrThrow,
    type DbExecutor
} from '@universo/utils'
import { extractInstalledReleaseVersion } from '../../services/applicationReleaseBundle'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { withWorkspaceContract } from '../../services/applicationWorkspaces'
import type { ApplicationSyncQueryBuilder } from '../../ddl'
import {
    dashboardLayoutConfigSchema,
    defaultDashboardLayoutConfig,
    EMPTY_VLC,
    RUNTIME_ENTITY_KINDS,
    type SyncableApplicationRecord,
    type PersistedAppLayout,
    type PersistedAppLayoutZoneWidget,
    type SnapshotLayoutRow,
    type SnapshotWidgetRow,
    type EntityField,
    type SnapshotElementRow,
} from './syncTypes'

// --- Core utilities ---

export const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

export const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`

export const buildDynamicRuntimeActiveRowSql = (contract: ApplicationLifecycleContract, platformConfig?: unknown): string => {
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

export const applyDynamicRuntimeActiveRowFilter = (
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

export const resolveEntityLifecycleContract = (entity: EntityDefinition): ApplicationLifecycleContract => {
    return resolveApplicationLifecycleContractFromConfig(entity.config)
}


export const toWorkspaceAwareSnapshot = (schemaSnapshot: unknown, workspacesEnabled: boolean): Record<string, unknown> | null =>
    withWorkspaceContract(schemaSnapshot as Record<string, unknown> | null | undefined, workspacesEnabled)

export const toWorkspaceAwareSchemaSnapshot = (
    schemaSnapshot: SchemaSnapshot | null | undefined,
    workspacesEnabled: boolean
): SchemaSnapshot | null =>
    withWorkspaceContract(
        schemaSnapshot as unknown as Record<string, unknown> | null | undefined,
        workspacesEnabled
    ) as unknown as SchemaSnapshot | null

// --- Field helpers ---

export function isVLCField(field: { dataType: AttributeDataType; validationRules?: Record<string, unknown> }): boolean {
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
export function prepareJsonbValue(value: unknown): unknown {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

export function compareStableValues(left: unknown, right: unknown): boolean {
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

export function quoteSchemaName(schemaName: string): string {
    assertCanonicalSchemaName(schemaName)
    return quoteIdentifier(schemaName)
}

export function quoteObjectName(identifier: string): string {
    assertCanonicalIdentifier(identifier)
    return quoteIdentifier(identifier)
}

// --- Normalization ---

export function normalizeRuntimeEntityKind(value: unknown): EntityDefinition['kind'] | null {
    if (typeof value !== 'string') {
        return null
    }

    return RUNTIME_ENTITY_KINDS.has(value as EntityDefinition['kind']) ? (value as EntityDefinition['kind']) : null
}

export function normalizeRuntimePresentation(value: unknown): EntityDefinition['presentation'] {
    if (isRecord(value) && isRecord(value.name)) {
        return value as unknown as EntityDefinition['presentation']
    }

    return {
        name: { ...EMPTY_VLC }
    }
}

export function resolveLocalizedPreviewText(value: unknown): string | null {
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

export function normalizeReferenceId(value: unknown): string | null {
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

export function normalizeRuntimeSnapshotValue(value: unknown, field: EntityDefinition['fields'][number]): unknown {
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

// --- Application state ---

export function applyApplicationSyncState(
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

export function resolveApplicationReleaseVersion(input: {
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

export function extractInstalledReleaseMetadataString(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: string
): string | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function extractInstalledReleaseMetadataSchemaSnapshot(
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

// --- Snapshot normalizers ---

export function normalizeSnapshotLayouts(snapshot: PublishedApplicationSnapshot): PersistedAppLayout[] {
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

export function normalizeSnapshotLayoutZoneWidgets(snapshot: PublishedApplicationSnapshot): PersistedAppLayoutZoneWidget[] {
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

// --- Seeding helpers ---

export function extractSetConstantRefConfig(
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

export function resolveSetReferenceId(
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
export function normalizeChildFieldValue(
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

export function resolveCatalogSeedingOrder(entities: EntityDefinition[]): string[] {
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
export function validateNumericValue(options: {
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

export function resolveFieldDefaultEnumValueId(field: EntityDefinition['fields'][number]): string | null {
    if (!isRecord(field.uiConfig)) return null
    const candidate = field.uiConfig.defaultEnumValueId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

// --- Preview / diff helpers ---

export function resolveElementPreviewLabel(entity: EntityDefinition, data: Record<string, unknown>): string | null {
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

export function resolveSetConstantPreviewValue(field: EntityField, fallbackRefId: string): unknown {
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

export function buildMergedDashboardLayoutConfig(snapshot: PublishedApplicationSnapshot): Record<string, unknown> {
    const parsed = dashboardLayoutConfigSchema.safeParse(snapshot.layoutConfig ?? {})
    return {
        ...defaultDashboardLayoutConfig,
        ...(parsed.success ? parsed.data : {})
    }
}

