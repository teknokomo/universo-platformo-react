/**
 * Application Sync - Seeding
 *
 * Seed predefined elements and synchronize enumeration values
 * during application schema sync operations.
 */

import { resolveEntityTableName, generateColumnName, generateChildTableName, type EntityDefinition } from '@universo/schema-ddl'
import { AttributeDataType } from '@universo/types'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { type ApplicationSyncQueryBuilder, type ApplicationSyncTransaction, getApplicationSyncKnex } from '../../ddl'
import {
    type EnumerationSyncRow,
    type SnapshotEnumerationValue,
    type EntityField,
    type SnapshotElementRow,
    ENUMERATION_KIND,
    REF_DATA_TYPE
} from './syncTypes'
import {
    isRecord,
    isVLCField,
    prepareJsonbValue,
    normalizeReferenceId,
    resolveEntityLifecycleContract,
    applyDynamicRuntimeActiveRowFilter,
    resolveSetReferenceId,
    normalizeChildFieldValue,
    resolveCatalogSeedingOrder,
    validateNumericValue,
    resolveFieldDefaultEnumValueId,
    normalizeSnapshotCodenameValue
} from './syncHelpers'

// --- Element seeding ---

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

            const tableName = resolveEntityTableName(entity)
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

// --- Enumeration sync ---

export async function remapStaleEnumerationReferences(options: {
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
        const tableName = resolveEntityTableName(entity)
        const lifecycleContract = resolveEntityLifecycleContract(entity as unknown as EntityDefinition)
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
            const uiDefaultValueId = resolveFieldDefaultEnumValueId(field as unknown as EntityField)
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
            const codename = normalizeSnapshotCodenameValue(value.codename, `enumeration value "${id || objectId}"`)

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
