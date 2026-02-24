/**
 * Application Schema Sync Routes
 *
 * These routes handle schema creation, synchronization and diff calculation
 * for Applications. They use the Application → Connector → ConnectorPublication → Publication
 * chain to determine the structure.
 */

import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { Knex } from 'knex'
import { z } from 'zod'
import stableStringify from 'json-stable-stringify'
import { AttributeDataType, AttributeValidationRules } from '@universo/types'
import { validateNumberOrThrow } from '@universo/utils'
import {
    Application,
    Connector,
    ConnectorPublication,
    ApplicationSchemaStatus,
    ensureApplicationAccess,
    type ApplicationRole
} from '@universo/applications-backend'
import { Publication } from '../../../database/entities/Publication'
import { PublicationVersion } from '../../../database/entities/PublicationVersion'
import { SnapshotSerializer, MetahubSnapshot } from '../../publications/services/SnapshotSerializer'
import {
    getDDLServices,
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateTabularTableName,
    generateMigrationName,
    KnexClient,
    uuidToLockKey,
    acquireAdvisoryLock,
    releaseAdvisoryLock
} from '../../ddl'
import type { SchemaSnapshot, SchemaChange, EntityDefinition } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { TARGET_APP_STRUCTURE_VERSION } from '../constants'

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

const ADMIN_ROLES: ApplicationRole[] = ['owner', 'admin', 'editor']

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

/**
 * Normalize a child field value for TABLE row seeding.
 * Applies the same type-specific handling as parent seed logic.
 */
function normalizeChildFieldValue(
    value: unknown,
    field: { dataType: AttributeDataType; validationRules?: Record<string, unknown> },
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
    if (field.dataType === AttributeDataType.REF) return normalizeReferenceId(value)
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

async function seedPredefinedElements(
    schemaName: string,
    snapshot: MetahubSnapshot,
    entities: EntityDefinition[],
    userId?: string | null
): Promise<string[]> {
    if (!snapshot.elements || Object.keys(snapshot.elements).length === 0) {
        return []
    }

    const entityMap = new Map<string, EntityDefinition>(entities.map((entity) => [entity.id, entity]))
    const knex = KnexClient.getInstance()
    const now = new Date()
    const warnings: string[] = []

    const catalogOrder = resolveCatalogSeedingOrder(entities)

    await knex.transaction(async (trx) => {
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
                            row[columnName] = normalizeReferenceId(rawValue)
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

            const mergeColumns = ['_upl_updated_at', '_upl_updated_by', ...dataColumns]
            await trx.withSchema(schemaName).table(tableName).insert(validRows).onConflict('id').merge(mergeColumns)

            // Seed TABLE child rows
            if (tableFields.length > 0) {
                for (const element of elements) {
                    if (!element.data) continue
                    for (const tableField of tableFields) {
                        const tableData = (element.data as Record<string, unknown>)[tableField.codename]
                        if (!Array.isArray(tableData) || tableData.length === 0) continue

                        const tabularTableName = generateTabularTableName(tableName, tableField.id)
                        const childFieldMap = new Map(
                            tableField.childFields!.map((c) => [c.codename, { columnName: generateColumnName(c.id), field: c }])
                        )

                        const childRows = tableData.map((rowData, index) => {
                            const childRow: Record<string, unknown> = {
                                id: knex.raw('public.uuid_generate_v7()'),
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
                        await trx.withSchema(schemaName).table(tabularTableName).where('_tp_parent_id', element.id).del()
                        await trx.withSchema(schemaName).table(tabularTableName).insert(childRows)
                    }
                }
            }
        }
    })

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

const ENUMERATION_KIND = 'enumeration'
const REF_DATA_TYPE = AttributeDataType.REF

function resolveFieldDefaultEnumValueId(field: EntityDefinition['fields'][number]): string | null {
    if (!isRecord(field.uiConfig)) return null
    const candidate = field.uiConfig.defaultEnumValueId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

async function remapStaleEnumerationReferences(options: {
    trx: Knex.Transaction
    schemaName: string
    snapshot: MetahubSnapshot
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
                .andWhere((qb: Knex.QueryBuilder) => qb.where('_upl_deleted', false).andWhere('_app_deleted', false))
                .update(updatePayload)
        }
    }
}

async function syncEnumerationValues(schemaName: string, snapshot: MetahubSnapshot, userId?: string | null): Promise<void> {
    const knex = KnexClient.getInstance()
    const now = new Date()

    const enumerationObjectIds = Object.values(snapshot.entities ?? {})
        .filter((entity) => entity.kind === ENUMERATION_KIND)
        .map((entity) => entity.id)
    const validEnumerationObjectIds = new Set(enumerationObjectIds)

    const enumerationValues = snapshot.enumerationValues ?? {}
    const rows = Object.entries(enumerationValues).flatMap<EnumerationSyncRow>(([objectId, values]) => {
        if (!validEnumerationObjectIds.has(objectId)) return []

        return (values ?? []).map((value) => {
            const fallbackPresentation = value as unknown as { name?: unknown; description?: unknown }
            const presentation: { name?: unknown; description?: unknown } = isRecord(value.presentation)
                ? (value.presentation as { name?: unknown; description?: unknown })
                : {}

            return {
                id: value.id,
                object_id: objectId,
                codename: value.codename,
                presentation: {
                    name: presentation.name ?? fallbackPresentation.name ?? {},
                    description: presentation.description ?? fallbackPresentation.description ?? {}
                },
                sort_order: value.sortOrder ?? 0,
                is_default: value.isDefault ?? false,
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

    await knex.transaction(async (trx) => {
        const tableQuery = () => trx.withSchema(schemaName).table('_app_enum_values')
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
            trx,
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
    })
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

function normalizeSnapshotLayouts(snapshot: MetahubSnapshot): PersistedAppLayout[] {
    const rows = (Array.isArray(snapshot.layouts) ? snapshot.layouts : [])
        .map((layout) => ({
            id: String(layout.id ?? ''),
            templateKey: typeof layout.templateKey === 'string' && layout.templateKey.length > 0 ? layout.templateKey : 'dashboard',
            name: layout.name && typeof layout.name === 'object' ? layout.name : {},
            description: layout.description && typeof layout.description === 'object' ? layout.description : null,
            config: layout.config && typeof layout.config === 'object' ? layout.config : {},
            isActive: Boolean(layout.isActive),
            isDefault: Boolean(layout.isDefault),
            sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
        }))
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

/** @deprecated Use PersistedAppLayoutZoneWidget instead. */
type PersistedAppLayoutZoneModule = PersistedAppLayoutZoneWidget

function normalizeSnapshotLayoutZoneWidgets(snapshot: MetahubSnapshot): PersistedAppLayoutZoneWidget[] {
    return (Array.isArray(snapshot.layoutZoneWidgets) ? snapshot.layoutZoneWidgets : [])
        .filter((item) => item.isActive !== false)
        .map((item) => ({
            id: String(item.id ?? ''),
            layoutId: String(item.layoutId ?? ''),
            zone: typeof item.zone === 'string' ? item.zone : 'center',
            widgetKey: typeof item.widgetKey === 'string' ? item.widgetKey : '',
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: item.config && typeof item.config === 'object' ? item.config : {}
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

function buildPreviewLabelMaps(
    entities: EntityDefinition[],
    snapshot: MetahubSnapshot
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
        for (const value of values ?? []) {
            const presentation = isRecord(value.presentation) ? (value.presentation as Record<string, unknown>) : null
            const localizedName = resolveLocalizedPreviewText(presentation?.name)
            const label = localizedName || value.codename || value.id
            if (value.id && label) {
                labels.set(value.id, label)
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
    snapshot: MetahubSnapshot
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
                isRequired: Boolean(f.isRequired)
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

async function persistPublishedLayouts(options: { schemaName: string; snapshot: MetahubSnapshot; userId?: string | null }): Promise<void> {
    const { schemaName, snapshot, userId } = options
    const knex = KnexClient.getInstance()

    try {
        const { generator } = getDDLServices()
        await generator.ensureSystemTables(schemaName)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SchemaSync] Failed to ensure _app_layouts for layouts (ignored)', e)
    }

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) return

    const now = new Date()
    const nextLayouts = normalizeSnapshotLayouts(snapshot)

    await knex.transaction(async (trx) => {
        const existingRows = await trx
            .withSchema(schemaName)
            .from('_app_layouts')
            .where({ _upl_deleted: false, _app_deleted: false })
            .select(['id'])
        const existingIds = new Set(existingRows.map((row) => String(row.id)))

        // Clear is_default on all existing active layouts to avoid unique partial
        // index violation (idx_app_layouts_default_active) when inserting a new
        // default layout while the old one still exists.
        if (existingRows.length > 0) {
            await trx
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
                await trx
                    .withSchema(schemaName)
                    .from('_app_layouts')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            } else {
                await trx
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
            await trx
                .withSchema(schemaName)
                .from('_app_layouts')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await trx.withSchema(schemaName).from('_app_layouts').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    })
}

async function persistPublishedWidgets(options: { schemaName: string; snapshot: MetahubSnapshot; userId?: string | null }): Promise<void> {
    const { schemaName, snapshot, userId } = options
    const knex = KnexClient.getInstance()
    const hasTable = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) return

    const now = new Date()
    const nextRows = normalizeSnapshotLayoutZoneWidgets(snapshot)

    await knex.transaction(async (trx) => {
        const existingRows = await trx
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
                await trx
                    .withSchema(schemaName)
                    .from('_app_widgets')
                    .where({ id: row.id, _upl_deleted: false, _app_deleted: false })
                    .update({
                        ...payload,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            } else {
                await trx
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
            await trx
                .withSchema(schemaName)
                .from('_app_widgets')
                .where({ _upl_deleted: false, _app_deleted: false })
                .whereNotIn('id', nextIds)
                .del()
        } else {
            await trx.withSchema(schemaName).from('_app_widgets').where({ _upl_deleted: false, _app_deleted: false }).del()
        }
    })
}

async function getPersistedDashboardLayoutConfig(options: { schemaName: string }): Promise<Record<string, unknown>> {
    const { schemaName } = options
    const knex = KnexClient.getInstance()

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
    const knex = KnexClient.getInstance()

    const hasLayouts = await knex.schema.withSchema(schemaName).hasTable('_app_layouts')
    if (!hasLayouts) {
        return { layouts: [], defaultLayoutId: null }
    }

    const rows = await knex
        .withSchema(schemaName)
        .from('_app_layouts')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'template_key', 'name', 'description', 'config', 'is_active', 'is_default', 'sort_order'])
        .orderBy([
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])

    const layouts = rows.map((row: any) => ({
        id: String(row.id),
        templateKey: typeof row.template_key === 'string' && row.template_key.length > 0 ? row.template_key : 'dashboard',
        name: row.name && typeof row.name === 'object' ? row.name : {},
        description: row.description && typeof row.description === 'object' ? row.description : null,
        config: row.config && typeof row.config === 'object' ? row.config : {},
        isActive: Boolean(row.is_active),
        isDefault: Boolean(row.is_default),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    }))
    const defaultLayoutId = layouts.find((layout) => layout.isDefault)?.id ?? null
    return { layouts, defaultLayoutId }
}

async function getPersistedPublishedWidgets(options: { schemaName: string }): Promise<PersistedAppLayoutZoneWidget[]> {
    const { schemaName } = options
    const knex = KnexClient.getInstance()

    const hasTable = await knex.schema.withSchema(schemaName).hasTable('_app_widgets')
    if (!hasTable) {
        return []
    }

    const rows = await knex
        .withSchema(schemaName)
        .from('_app_widgets')
        .where({ _upl_deleted: false, _app_deleted: false })
        .select(['id', 'layout_id', 'zone', 'widget_key', 'sort_order', 'config'])
        .orderBy([
            { column: 'layout_id', order: 'asc' },
            { column: 'zone', order: 'asc' },
            { column: 'sort_order', order: 'asc' },
            { column: '_upl_created_at', order: 'asc' }
        ])

    return rows.map((row: any) => ({
        id: String(row.id),
        layoutId: String(row.layout_id),
        zone: String(row.zone),
        widgetKey: String(row.widget_key),
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        config: row.config && typeof row.config === 'object' ? row.config : {}
    }))
}

function buildMergedDashboardLayoutConfig(snapshot: MetahubSnapshot): Record<string, unknown> {
    const parsed = dashboardLayoutConfigSchema.safeParse(snapshot.layoutConfig ?? {})
    return {
        ...defaultDashboardLayoutConfig,
        ...(parsed.success ? parsed.data : {})
    }
}

async function hasDashboardLayoutConfigChanges(options: { schemaName: string; snapshot: MetahubSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedDashboardLayoutConfig({ schemaName })
    const next = buildMergedDashboardLayoutConfig(snapshot)

    // Stable compare to avoid false positives due to key ordering.
    return stableStringify(current) !== stableStringify(next)
}

async function hasPublishedLayoutsChanges(options: { schemaName: string; snapshot: MetahubSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options

    const current = await getPersistedPublishedLayouts({ schemaName })
    const normalizedLayouts = normalizeSnapshotLayouts(snapshot)
    const next = {
        layouts: normalizedLayouts,
        defaultLayoutId: normalizedLayouts.find((layout) => layout.isDefault)?.id ?? null
    }

    return stableStringify(current) !== stableStringify(next)
}

async function hasPublishedWidgetsChanges(options: { schemaName: string; snapshot: MetahubSnapshot }): Promise<boolean> {
    const { schemaName, snapshot } = options
    const current = await getPersistedPublishedWidgets({ schemaName })
    const next = normalizeSnapshotLayoutZoneWidgets(snapshot)
    return stableStringify(current) !== stableStringify(next)
}

async function persistSeedWarnings(
    schemaName: string,
    migrationManager: ReturnType<typeof getDDLServices>['migrationManager'],
    warnings: string[]
): Promise<void> {
    if (warnings.length === 0) return

    const latestMigration = await migrationManager.getLatestMigration(schemaName)
    if (!latestMigration) return

    const existing = Array.isArray(latestMigration.meta.seedWarnings) ? latestMigration.meta.seedWarnings : []
    const mergedWarnings = [...existing, ...warnings]

    const updatedMeta = {
        ...latestMigration.meta,
        seedWarnings: mergedWarnings
    }

    await KnexClient.getInstance()
        .withSchema(schemaName)
        .table('_app_migrations')
        .where({ id: latestMigration.id })
        .update({ meta: JSON.stringify(updatedMeta) })
}

export function createApplicationSyncRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
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
            const ds = getDataSource()

            // Check access
            try {
                await ensureApplicationAccess(ds, userId, applicationId, ADMIN_ROLES)
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
            const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Sync already in progress',
                    message: 'Another sync operation is already running for this application. Please try again later.'
                })
            }

            try {
                const applicationRepo = ds.getRepository(Application)
                const application = await applicationRepo.findOneBy({ id: applicationId })
                if (!application) {
                    return res.status(404).json({ error: 'Application not found' })
                }

                const connectorRepo = ds.getRepository(Connector)
                const connector = await connectorRepo.findOne({
                    where: { applicationId }
                })
                if (!connector) {
                    return res.status(400).json({ error: 'No connector found for this application. Create a connector first.' })
                }

                const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
                const connectorPublication = await connectorPublicationRepo.findOne({
                    where: { connectorId: connector.id }
                })
                if (!connectorPublication) {
                    return res.status(400).json({ error: 'Connector is not linked to any Publication. Link a Publication first.' })
                }

                const touchConnectorUpdatedAt = async () => {
                    connector._uplUpdatedBy = userId
                    connector._uplUpdatedAt = new Date()
                    await connectorRepo.save(connector)
                }

                const publicationRepo = ds.getRepository(Publication)
                const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
                if (!publication) {
                    return res.status(400).json({ error: 'Linked publication not found' })
                }

                if (!publication.activeVersionId) {
                    return res.status(400).json({
                        error: 'No active version found',
                        message: 'Publication must have an active version to sync. Please create and activate a version in Metahub.'
                    })
                }

                const versionRepo = ds.getRepository(PublicationVersion)
                const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
                if (!activeVersion) {
                    return res.status(404).json({ error: 'Active version data not found' })
                }

                const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
                if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                    return res.status(400).json({ error: 'Invalid publication snapshot' })
                }

                // Init services for serializer
                const schemaService = new MetahubSchemaService(ds)
                const objectsService = new MetahubObjectsService(schemaService)
                const attributesService = new MetahubAttributesService(schemaService)
                // hubRepo removed - hubs are now in isolated schemas

                const serializer = new SnapshotSerializer(objectsService, attributesService)
                const catalogDefs = serializer.deserializeSnapshot(snapshot)
                const snapshotHash = activeVersion.snapshotHash || serializer.calculateHash(snapshot)

                const { generator, migrator, migrationManager } = getDDLServices()

                if (!application.schemaName) {
                    application.schemaName = generateSchemaName(application.id)
                    await applicationRepo.save(application)
                }

                const schemaExists = await generator.schemaExists(application.schemaName)
                const publicationSnapshot = snapshot as unknown as Record<string, unknown>
                const migrationMeta = {
                    publicationSnapshotHash: snapshotHash,
                    publicationId: publication.id,
                    publicationVersionId: activeVersion.id
                }

                if (schemaExists) {
                    const latestMigration = await migrationManager.getLatestMigration(application.schemaName)
                    const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
                    if (lastAppliedHash && snapshotHash && lastAppliedHash === snapshotHash) {
                        const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot })
                        const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot })
                        const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                            schemaName: application.schemaName!,
                            snapshot
                        })
                        const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate

                        application.schemaStatus = ApplicationSchemaStatus.SYNCED
                        application.schemaError = null
                        application.schemaSyncedAt = new Date()
                        application.lastSyncedPublicationVersionId = activeVersion.id
                        application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                        await applicationRepo.save(application)

                        // Keep system metadata in sync even when DDL didn't change.
                        // This covers non-DDL evolutions (e.g., new metadata columns like sort_order) and keeps runtime UI stable.
                        await generator.syncSystemMetadata(application.schemaName!, catalogDefs, {
                            userId,
                            removeMissing: true
                        })

                        await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })
                        await persistPublishedWidgets({ schemaName: application.schemaName!, snapshot, userId })
                        await syncEnumerationValues(application.schemaName!, snapshot, userId)

                        // Seed predefined elements even on hash match — previous seed may have failed
                        let seedWarnings: string[] = []
                        try {
                            seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)
                            await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)
                        } catch (seedErr: unknown) {
                            const msg = seedErr instanceof Error ? seedErr.message : String(seedErr)
                            console.warn(`[sync] Seed predefined elements failed on hash-match fast path: ${msg}`)
                            seedWarnings = [`Seed error: ${msg}`]
                        }
                        await touchConnectorUpdatedAt()

                        return res.json({
                            status: hasUiChanges || seedWarnings.length > 0 ? 'ui_updated' : 'no_changes',
                            message: hasUiChanges ? 'UI layout settings updated' : 'Schema is already up to date',
                            ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                        })
                    }
                }

                // Set MAINTENANCE status so other users see the maintenance page during sync
                application.schemaStatus = ApplicationSchemaStatus.MAINTENANCE
                await applicationRepo.save(application)

                try {
                    if (!schemaExists) {
                        const result = await generator.generateFullSchema(application.schemaName!, catalogDefs, {
                            recordMigration: true,
                            migrationDescription: 'initial_schema',
                            migrationManager,
                            migrationMeta,
                            publicationSnapshot,
                            userId
                        })

                        if (!result.success) {
                            application.schemaStatus = ApplicationSchemaStatus.ERROR
                            application.schemaError = result.errors.join('; ')
                            await applicationRepo.save(application)

                            return res.status(500).json({
                                status: 'error',
                                message: 'Schema creation failed',
                                errors: result.errors
                            })
                        }

                        const schemaSnapshot = generator.generateSnapshot(catalogDefs)
                        application.schemaStatus = ApplicationSchemaStatus.SYNCED
                        application.schemaError = null
                        application.schemaSyncedAt = new Date()
                        application.schemaSnapshot = schemaSnapshot as unknown as Record<string, unknown>
                        application.lastSyncedPublicationVersionId = activeVersion.id
                        application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                        await applicationRepo.save(application)

                        await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })
                        await persistPublishedWidgets({ schemaName: application.schemaName!, snapshot, userId })
                        await syncEnumerationValues(application.schemaName!, snapshot, userId)

                        const seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)
                        await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)
                        await touchConnectorUpdatedAt()

                        return res.json({
                            status: 'created',
                            schemaName: result.schemaName,
                            tablesCreated: result.tablesCreated,
                            message: `Schema created with ${result.tablesCreated.length} table(s)`,
                            ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                        })
                    }

                    const oldSnapshot = application.schemaSnapshot as SchemaSnapshot | null
                    const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
                    const hasDestructiveChanges = diff.destructive.length > 0

                    if (!diff.hasChanges) {
                        const uiNeedsUpdate = await hasDashboardLayoutConfigChanges({ schemaName: application.schemaName!, snapshot })
                        const layoutsNeedUpdate = await hasPublishedLayoutsChanges({ schemaName: application.schemaName!, snapshot })
                        const widgetsNeedUpdate = await hasPublishedWidgetsChanges({
                            schemaName: application.schemaName!,
                            snapshot
                        })
                        const hasUiChanges = uiNeedsUpdate || layoutsNeedUpdate || widgetsNeedUpdate

                        await generator.syncSystemMetadata(application.schemaName!, catalogDefs, {
                            userId,
                            removeMissing: true
                        })

                        application.schemaStatus = ApplicationSchemaStatus.SYNCED
                        application.schemaError = null
                        application.schemaSyncedAt = new Date()
                        application.lastSyncedPublicationVersionId = activeVersion.id
                        application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                        await applicationRepo.save(application)

                        await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })
                        await persistPublishedWidgets({ schemaName: application.schemaName!, snapshot, userId })
                        await syncEnumerationValues(application.schemaName!, snapshot, userId)

                        // Seed predefined elements even when schema DDL hasn't changed —
                        // new elements may have been added to the metahub since the last sync.
                        const seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)

                        // Record a migration even if DDL didn't change, so the applied snapshot hash is updated.
                        // This prevents the diff endpoint from repeatedly suggesting a sync when only UI/meta changed.
                        const latestMigration = await migrationManager.getLatestMigration(application.schemaName!)
                        const lastAppliedHash = latestMigration?.meta?.publicationSnapshotHash
                        if (snapshotHash && lastAppliedHash !== snapshotHash) {
                            const snapshotBefore = (application.schemaSnapshot as SchemaSnapshot | null) ?? null
                            const snapshotAfter = generator.generateSnapshot(catalogDefs)
                            const metaOnlyDiff = {
                                hasChanges: false,
                                additive: [],
                                destructive: [],
                                summary: 'System metadata updated (no DDL changes)'
                            }

                            await migrationManager.recordMigration(
                                application.schemaName!,
                                generateMigrationName('system_sync'),
                                snapshotBefore,
                                snapshotAfter,
                                metaOnlyDiff,
                                undefined,
                                migrationMeta,
                                publicationSnapshot,
                                userId
                            )

                            application.schemaSnapshot = snapshotAfter as unknown as Record<string, unknown>
                            await applicationRepo.save(application)
                        }

                        if (seedWarnings.length > 0) {
                            await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)
                        }
                        await touchConnectorUpdatedAt()

                        const hasElementChanges = seedWarnings.length > 0
                        return res.json({
                            status: hasUiChanges || hasElementChanges ? 'ui_updated' : 'no_changes',
                            message: hasUiChanges
                                ? 'UI layout settings updated'
                                : hasElementChanges
                                ? 'Predefined elements updated'
                                : 'Schema is already up to date',
                            ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                        })
                    }

                    if (hasDestructiveChanges && !confirmDestructive) {
                        application.schemaStatus = ApplicationSchemaStatus.OUTDATED
                        await applicationRepo.save(application)

                        return res.json({
                            status: 'pending_confirmation',
                            diff: {
                                hasChanges: diff.hasChanges,
                                hasDestructiveChanges,
                                additive: diff.additive.map((c: SchemaChange) => c.description),
                                destructive: diff.destructive.map((c: SchemaChange) => c.description),
                                summary: diff.summary
                            },
                            message: 'Destructive changes detected. Set confirmDestructive=true to proceed.'
                        })
                    }

                    const migrationResult = await migrator.applyAllChanges(application.schemaName!, diff, catalogDefs, confirmDestructive, {
                        recordMigration: true,
                        migrationDescription: 'schema_sync',
                        migrationMeta,
                        publicationSnapshot,
                        userId
                    })

                    if (!migrationResult.success) {
                        application.schemaStatus = ApplicationSchemaStatus.ERROR
                        application.schemaError = migrationResult.errors.join('; ')
                        await applicationRepo.save(application)

                        return res.status(500).json({
                            status: 'error',
                            message: 'Schema migration failed',
                            errors: migrationResult.errors
                        })
                    }

                    const newSnapshot = generator.generateSnapshot(catalogDefs)
                    application.schemaStatus = ApplicationSchemaStatus.SYNCED
                    application.schemaError = null
                    application.schemaSyncedAt = new Date()
                    application.schemaSnapshot = newSnapshot as unknown as Record<string, unknown>
                    application.lastSyncedPublicationVersionId = activeVersion.id
                    application.appStructureVersion = TARGET_APP_STRUCTURE_VERSION
                    await applicationRepo.save(application)

                    await persistPublishedLayouts({ schemaName: application.schemaName!, snapshot, userId })
                    await persistPublishedWidgets({ schemaName: application.schemaName!, snapshot, userId })
                    await syncEnumerationValues(application.schemaName!, snapshot, userId)

                    const seedWarnings = await seedPredefinedElements(application.schemaName!, snapshot, catalogDefs, userId)
                    await persistSeedWarnings(application.schemaName!, migrationManager, seedWarnings)
                    await touchConnectorUpdatedAt()

                    return res.json({
                        status: 'migrated',
                        schemaName: application.schemaName,
                        changesApplied: migrationResult.changesApplied,
                        message: 'Schema migration applied successfully',
                        ...(seedWarnings.length > 0 ? { seedWarnings } : {})
                    })
                } catch (error) {
                    application.schemaStatus = ApplicationSchemaStatus.ERROR
                    application.schemaError = error instanceof Error ? error.message : 'Unknown error'
                    await applicationRepo.save(application)

                    return res.status(500).json({
                        status: 'error',
                        message: 'Schema sync failed',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    })
                }
            } finally {
                await releaseAdvisoryLock(KnexClient.getInstance(), lockKey)
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
            const ds = getDataSource()

            try {
                await ensureApplicationAccess(ds, userId, applicationId, ADMIN_ROLES)
            } catch (error) {
                const status = (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status
                if (status === 403) {
                    return res.status(403).json({ error: 'Access denied' })
                }
                throw error
            }

            const applicationRepo = ds.getRepository(Application)
            const application = await applicationRepo.findOneBy({ id: applicationId })
            if (!application) {
                return res.status(404).json({ error: 'Application not found' })
            }

            const connectorRepo = ds.getRepository(Connector)
            const connector = await connectorRepo.findOne({ where: { applicationId } })
            if (!connector) {
                return res.status(400).json({ error: 'No connector found' })
            }

            const connectorPublicationRepo = ds.getRepository(ConnectorPublication)
            const connectorPublication = await connectorPublicationRepo.findOne({
                where: { connectorId: connector.id }
            })
            if (!connectorPublication) {
                return res.status(400).json({ error: 'Connector not linked to Publication' })
            }

            const publicationRepo = ds.getRepository(Publication)
            const publication = await publicationRepo.findOneBy({ id: connectorPublication.publicationId })
            if (!publication) {
                return res.status(400).json({ error: 'Linked publication not found' })
            }

            if (!publication.activeVersionId) {
                return res.status(400).json({
                    error: 'No active version found',
                    message: 'Publication must have an active version to sync.'
                })
            }

            const versionRepo = ds.getRepository(PublicationVersion)
            const activeVersion = await versionRepo.findOneBy({ id: publication.activeVersionId })
            if (!activeVersion) {
                return res.status(404).json({ error: 'Active version data not found' })
            }

            const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
                return res.status(400).json({ error: 'Invalid publication snapshot' })
            }

            const schemaService = new MetahubSchemaService(ds)
            const objectsService = new MetahubObjectsService(schemaService)
            const attributesService = new MetahubAttributesService(schemaService)
            // hubRepo removed - hubs are now in isolated schemas

            const serializer = new SnapshotSerializer(objectsService, attributesService)
            const catalogDefs = serializer.deserializeSnapshot(snapshot)
            const snapshotHash = activeVersion.snapshotHash || serializer.calculateHash(snapshot)

            const { generator, migrator, migrationManager } = getDDLServices()

            const schemaName = application.schemaName || generateSchemaName(application.id)
            const schemaExists = await generator.schemaExists(schemaName)

            if (!schemaExists) {
                const createTables = buildCreateTableDetails({ entities: catalogDefs, snapshot })

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
            const diff = migrator.calculateDiff(oldSnapshot, catalogDefs)
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
                entities: catalogDefs,
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
