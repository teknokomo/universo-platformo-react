import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { assertRuntimeRecordMutable } from '../../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../../services/runtimeLifecycleDispatch'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    UUID_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeSoftDeleteSetClause,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    ensureRuntimePermission,
    formatRuntimeFieldLabel,
    formatRuntimeFieldPath,
    getDefaultEnumValueId,
    getEnumPresentationMode,
    getRuntimeInputValue,
    getSetConstantConfig,
    getTableRowCountError,
    getTableRowLimits,
    isSoftDeleteLifecycle,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValue,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    toRuntimeInputFormatErrorBody,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import { assertRuntimeRecordRules } from '../../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import {
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeBulkUpdateBodySchema,
    type RuntimeObjectCollectionAttr
} from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    validateRuntimeDateOrderRules,
    validateRuntimeParentRecordAccessReferences,
    validateRuntimeRecordPickerReferences,
    validateRuntimeRequiredWhenRules
} from '../runtimeRowSupport/validation'
import {
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause,
    hasRuntimeServerOwnedInput,
    loadRuntimeRowByIdWithRecordAccess,
    validateRuntimeAccessEntryMembership
} from '../runtimeRowSupport/access'
import { collectTouchedComponentIds, loadRuntimeRowById } from '../runtimeRowSupport/rows'

import { insertRuntimeChildRowsBatch } from './tableChildren'
import type {
    RuntimeRowWriteDeps,
    RuntimeWriteResolvedObjectCollection,
    RuntimeWriteTableDataEntry,
    RuntimeTableChildAttrRow
} from './types'

export const buildBulkUpdateScalarPatch = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    nonTableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    | { kind: 'ok'; setClauses: string[]; values: unknown[]; normalizedPatchByColumn: Record<string, unknown>; paramIndex: number }
    | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const setClauses: string[] = []
    const values: unknown[] = []
    const normalizedPatchByColumn: Record<string, unknown> = {}
    let paramIndex = 1

    for (const cmp of params.nonTableAttrs) {
        const attrLabel = formatRuntimeFieldLabel(cmp.codename)
        const { value: raw } = getRuntimeInputValue(params.data, cmp.column_name, cmp.codename)
        if (raw === undefined) continue
        if (hasRuntimeServerOwnedInput(params.data, cmp)) {
            return { kind: 'failure', statusCode: 400, body: { error: `Field is server-owned: ${attrLabel}` } }
        }
        let normalizedRaw = raw

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
        }
        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(raw)
            if (!providedRefId) {
                normalizedRaw = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
            } else {
                normalizedRaw = valueGroupFixedValueConfig.id
            }
        }

        try {
            const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(normalizedRaw, cmp.data_type, cmp.validation_rules), cmp)
            if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                return { kind: 'failure', statusCode: 400, body: { error: `Required field cannot be set to null: ${attrLabel}` } }
            }

            if (
                cmp.data_type === 'REF' &&
                isRuntimeEnumerationKind(cmp.target_object_kind) &&
                typeof cmp.target_object_id === 'string' &&
                coerced
            ) {
                await ensureEnumerationValueBelongsToTarget(params.manager, params.schemaIdent, String(coerced), cmp.target_object_id)
            }

            setClauses.push(`${quoteIdentifier(cmp.column_name)} = $${paramIndex}`)
            values.push(coerced)
            normalizedPatchByColumn[cmp.column_name] = coerced
            paramIndex++
        } catch (e) {
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
            return { kind: 'failure', statusCode: 400, body: { error: `Invalid value for ${attrLabel}: ${(e as Error).message}` } }
        }
    }

    return { kind: 'ok', setClauses, values, normalizedPatchByColumn, paramIndex }
}

export const prepareBulkUpdateTableChildRows = async (params: {
    manager: DbExecutor
    schemaIdent: string
    tableFieldPath: string
    tableAttr: RuntimeObjectCollectionAttr
    childRows: Array<Record<string, unknown>>
    childAttrs: RuntimeTableChildAttrRow[]
}): Promise<
    { kind: 'ok'; rows: Array<Record<string, unknown>> } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const preparedRows: Array<Record<string, unknown>> = []

    for (let rowIdx = 0; rowIdx < params.childRows.length; rowIdx++) {
        const rowData = params.childRows[rowIdx]
        if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `Invalid row ${rowIdx + 1} for ${params.tableFieldPath}: row must be an object` }
            }
        }

        const preparedRow: Record<string, unknown> = {}

        for (const cAttr of params.childAttrs) {
            if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

            const childFieldPath = formatRuntimeFieldPath(params.tableAttr.codename, cAttr.codename)
            if (hasRuntimeServerOwnedInput(rowData, cAttr)) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is server-owned: ${childFieldPath}` } }
            }
            const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
            const { hasUserValue: hasChildUserValue, value: childInputValue } = getRuntimeInputValue(
                rowData,
                cAttr.column_name,
                cAttr.codename
            )
            let cRaw = childInputValue

            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasChildUserValue) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${childFieldPath}` } }
            }

            if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(
                            params.manager,
                            params.schemaIdent,
                            defaultEnumValueId,
                            cAttr.target_object_id
                        )
                        cRaw = defaultEnumValueId
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                            cRaw = undefined
                        } else {
                            throw error
                        }
                    }
                }
            }

            const childSetConstantConfig =
                cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind) ? getSetConstantConfig(cAttr.ui_config) : null
            if (childSetConstantConfig) {
                const providedRefId = resolveRefId(cRaw)
                if (!providedRefId) {
                    cRaw = childSetConstantConfig.id
                } else if (providedRefId !== childSetConstantConfig.id) {
                    return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${childFieldPath}` } }
                } else {
                    cRaw = childSetConstantConfig.id
                }
            }

            if (cRaw === undefined || cRaw === null) {
                if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                    let defaultValue: unknown
                    switch (cAttr.data_type) {
                        case 'STRING':
                            defaultValue = ''
                            break
                        case 'NUMBER':
                            defaultValue = 0
                            break
                        default:
                            defaultValue = ''
                    }
                    preparedRow[cAttr.column_name] = defaultValue
                }
                continue
            }

            try {
                const cCoerced = normalizeConfiguredRuntimeJsonValue(
                    coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                    cAttr
                )

                if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                    await ensureEnumerationValueBelongsToTarget(
                        params.manager,
                        params.schemaIdent,
                        String(cCoerced),
                        cAttr.target_object_id
                    )
                }

                preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(cCoerced, cAttr.data_type, cAttr.validation_rules)
            } catch (err) {
                const formatError = toRuntimeInputFormatErrorBody(err)
                if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
                return {
                    kind: 'failure',
                    statusCode: 400,
                    body: { error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}` }
                }
            }
        }

        preparedRows.push(preparedRow)
    }

    return { kind: 'ok', rows: preparedRows }
}

export const buildBulkUpdateTableEntries = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    tableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    { kind: 'ok'; entries: RuntimeWriteTableDataEntry[] } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const tableDataEntries: RuntimeWriteTableDataEntry[] = []

    for (const tAttr of params.tableAttrs) {
        const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
        const { hasUserValue, value: raw } = getRuntimeInputValue(params.data, tAttr.column_name, tAttr.codename)
        if (!hasUserValue) continue
        if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `Invalid value for ${tableFieldPath}: TABLE value must be an array` }
            }
        }

        const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
        const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
        if (rowCountError) {
            return { kind: 'failure', statusCode: 400, body: { error: rowCountError } }
        }

        const fallbackTabTableName = generateChildTableName(tAttr.id)
        const tabTableName =
            typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
        if (!IDENTIFIER_REGEX.test(tabTableName)) {
            return { kind: 'failure', statusCode: 400, body: { error: `Invalid tabular table name for ${tableFieldPath}` } }
        }

        const childAttrsResult = (await params.manager.query(
            `
      SELECT id, codename, column_name, data_type, is_required, validation_rules,
             target_object_id, target_object_kind, ui_config
      FROM ${params.schemaIdent}._app_components
      WHERE parent_component_id = $1
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC
    `,
            [tAttr.id]
        )) as RuntimeTableChildAttrRow[]

        const preparedResult = await prepareBulkUpdateTableChildRows({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            tableFieldPath,
            tableAttr: tAttr,
            childRows,
            childAttrs: childAttrsResult
        })
        if (preparedResult.kind !== 'ok') return preparedResult

        tableDataEntries.push({
            tabTableName,
            rows: preparedResult.rows,
            childAttrsByColumn: new Map(
                childAttrsResult.map((childAttr) => [
                    childAttr.column_name,
                    {
                        column_name: childAttr.column_name,
                        data_type: childAttr.data_type,
                        validation_rules: childAttr.validation_rules
                    }
                ])
            )
        })
    }

    return { kind: 'ok', entries: tableDataEntries }
}

export const replaceRuntimeTableChildRows = async (params: {
    executor: DbExecutor
    schemaIdent: string
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
    runtimeRowCondition: string
    runtimeDeleteSetClause: string | null
    parentRowId: string
    entries: RuntimeWriteTableDataEntry[]
}): Promise<void> => {
    for (const { tabTableName, rows: childRows, childAttrsByColumn } of params.entries) {
        const tabTableIdent = `${params.schemaIdent}.${quoteIdentifier(tabTableName)}`

        if (params.runtimeDeleteSetClause) {
            await params.executor.query(
                `
          UPDATE ${tabTableIdent}
          SET ${params.runtimeDeleteSetClause},
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE _tp_parent_id = $2
            AND ${params.runtimeRowCondition}
        `,
                [params.userId, params.parentRowId]
            )
        } else {
            await params.executor.query(
                `
          DELETE FROM ${tabTableIdent}
          WHERE _tp_parent_id = $1
            AND ${params.runtimeRowCondition}
        `,
                [params.parentRowId]
            )
        }

        if (childRows.length > 0) {
            await insertRuntimeChildRowsBatch({
                executor: params.executor,
                schemaIdent: params.schemaIdent,
                tabTableName,
                parentRowId: params.parentRowId,
                childRows,
                childAttrsByColumn,
                workspacesEnabled: params.workspacesEnabled,
                currentWorkspaceId: params.currentWorkspaceId,
                userId: params.userId
            })
        }
    }
}

export const executeBulkUpdateStatement = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    dataTableIdent: string
    runtimeRowCondition: string
    runtimeDeleteSetClause: string | null
    setClauses: string[]
    values: unknown[]
    rowId: string
    rowIdParamIndex: number
    versionCheckClause: string
    expectedVersion: number | undefined
    tableDataEntries: RuntimeWriteTableDataEntry[]
}): Promise<void> => {
    const objectCodename = resolveRuntimeCodenameText(params.objectCollection.codename)
    const updateAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename,
        attrs: params.attrs,
        config: params.objectCollection.config,
        outerRowIdSql: `${params.dataTableIdent}.id`,
        values: params.values,
        minimumAccessLevel: 'edit'
    })
    const updateWhereSql = [
        `id = $${params.rowIdParamIndex}`,
        params.runtimeRowCondition,
        'COALESCE(_upl_locked, false) = false',
        updateAccessClause
    ]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const updated = (await params.executor.query(
        `
      UPDATE ${params.dataTableIdent}
      SET ${params.setClauses.join(', ')}
      WHERE ${updateWhereSql}
        ${params.versionCheckClause}
      RETURNING id
    `,
        params.values
    )) as Array<{ id: string }>

    if (updated.length === 0) {
        const exists = (await params.executor.query(
            `SELECT id, _upl_locked, _upl_version FROM ${params.dataTableIdent} WHERE id = $1 AND ${params.runtimeRowCondition}`,
            [params.rowId]
        )) as Array<{
            id: string
            _upl_locked?: boolean
            _upl_version?: number
        }>

        if (exists.length > 0 && exists[0]._upl_locked) {
            throw new UpdateFailure(423, {
                error: 'Record is locked'
            })
        }
        if (exists.length > 0 && params.expectedVersion !== undefined) {
            const actualVersion = Number(exists[0]._upl_version ?? 1)
            if (actualVersion !== params.expectedVersion) {
                throw createRuntimeVersionConflictFailure(params.expectedVersion, actualVersion)
            }
        }
        throw new UpdateFailure(404, {
            error: 'Row not found'
        })
    }

    await replaceRuntimeTableChildRows({
        executor: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        userId: params.ctx.userId,
        workspacesEnabled: params.ctx.workspacesEnabled,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        runtimeRowCondition: params.runtimeRowCondition,
        runtimeDeleteSetClause: params.runtimeDeleteSetClause,
        parentRowId: params.rowId,
        entries: params.tableDataEntries
    })
}

export const applyBulkUpdateInTransaction = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    data: Record<string, unknown>
    normalizedPatchByColumn: Record<string, unknown>
    expectedVersion: number | undefined
    runtimeRowCondition: string
    dataTableIdent: string
    touchedComponentIds: string[]
    runtimeDeleteSetClause: string | null
    setClauses: string[]
    values: unknown[]
    rowId: string
    rowIdParamIndex: number
    versionCheckClause: string
    tableDataEntries: RuntimeWriteTableDataEntry[]
}): Promise<RuntimeLifecycleDispatchRequest | null> => {
    const previousRow = await loadRuntimeRowByIdWithRecordAccess({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        attrs: params.attrs,
        config: params.objectCollection.config,
        rowId: params.rowId,
        rowCondition: params.runtimeRowCondition,
        minimumAccessLevel: 'edit'
    })
    if (!previousRow || !previousRow.id) {
        throw new UpdateFailure(404, {
            error: 'Row not found'
        })
    }
    if (previousRow._upl_locked) {
        throw new UpdateFailure(423, {
            error: 'Record is locked'
        })
    }
    await assertNotProtectedSystemStructureRuntimeRow(
        params.executor,
        params.ctx,
        params.applicationId,
        params.objectCollection.id,
        params.attrs,
        previousRow
    )
    assertRuntimeRecordMutable(params.objectCollection.config, previousRow)

    const referenceValidationError = await validateRuntimeRecordPickerReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (referenceValidationError) {
        throw new UpdateFailure(400, { error: referenceValidationError })
    }
    const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (accessEntryValidationError) {
        throw new UpdateFailure(400, { error: accessEntryValidationError })
    }
    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn },
        minimumAccessLevel: 'edit'
    })
    if (parentAccessValidationError) {
        throw new UpdateFailure(400, { error: parentAccessValidationError })
    }
    const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (requiredWhenValidationError) {
        throw new UpdateFailure(400, { error: requiredWhenValidationError })
    }
    const dateOrderValidationError = validateRuntimeDateOrderRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (dateOrderValidationError) {
        throw new UpdateFailure(400, { error: dateOrderValidationError })
    }

    if (params.expectedVersion !== undefined) {
        const versionRows = (await params.executor.query(
            `SELECT _upl_version FROM ${params.dataTableIdent} WHERE id = $1 AND ${params.runtimeRowCondition}`,
            [params.rowId]
        )) as Array<{ _upl_version?: number }>
        const actualVersion = Number(versionRows[0]?._upl_version ?? 1)
        if (versionRows.length > 0 && actualVersion !== params.expectedVersion) {
            throw createRuntimeVersionConflictFailure(params.expectedVersion, actualVersion)
        }
    }
    await assertRuntimeRecordRules({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        activeCondition: params.runtimeRowCondition,
        attrs: params.attrs,
        row: params.normalizedPatchByColumn,
        excludeRowId: params.rowId
    })

    await dispatchRuntimeLifecycle({
        manager: params.executor,
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'beforeUpdate',
            previousRow,
            patch: params.data
        }
    })

    await executeBulkUpdateStatement({
        executor: params.executor,
        ctx: params.ctx,
        objectCollection: params.objectCollection,
        attrs: params.attrs,
        dataTableIdent: params.dataTableIdent,
        runtimeRowCondition: params.runtimeRowCondition,
        runtimeDeleteSetClause: params.runtimeDeleteSetClause,
        setClauses: params.setClauses,
        values: params.values,
        rowId: params.rowId,
        rowIdParamIndex: params.rowIdParamIndex,
        versionCheckClause: params.versionCheckClause,
        expectedVersion: params.expectedVersion,
        tableDataEntries: params.tableDataEntries
    })

    const nextRow = await loadRuntimeRowById(params.executor, params.dataTableIdent, params.rowId, params.runtimeRowCondition)
    return {
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'afterUpdate',
            row: nextRow,
            previousRow,
            patch: params.data
        }
    }
}

export const createBulkUpdateRowHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
    // ============ BULK UPDATE ROW ============
    const bulkUpdateRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data, expectedVersion } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const touchedComponentIds = collectTouchedComponentIds(attrs, data)

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForUpdate = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const scalarPatchResult = await buildBulkUpdateScalarPatch({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            nonTableAttrs
        })
        if (scalarPatchResult.kind === 'failure') {
            return res.status(scalarPatchResult.statusCode).json(scalarPatchResult.body)
        }
        const { setClauses, values, normalizedPatchByColumn, paramIndex: scalarParamIndex } = scalarPatchResult

        const tableEntriesResult = await buildBulkUpdateTableEntries({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            tableAttrs: tableAttrsForUpdate
        })
        if (tableEntriesResult.kind === 'failure') {
            return res.status(tableEntriesResult.statusCode).json(tableEntriesResult.body)
        }
        const tableDataEntries = tableEntriesResult.entries

        if (setClauses.length === 0 && tableDataEntries.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' })
        }

        let paramIndex = scalarParamIndex
        setClauses.push('_upl_updated_at = NOW()')
        setClauses.push(`_upl_updated_by = $${paramIndex}`)
        values.push(ctx.userId)
        paramIndex++
        // Keep the immutable seed key for reconciliation while marking the row
        // as authored. This prevents the next publication from materializing a
        // duplicate row for the same source element.
        if (ctx.workspacesEnabled) {
            setClauses.push('_seed_source_owned = false')
        }
        setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        values.push(rowId)
        const rowIdParamIndex = paramIndex
        let versionCheckClause = ''

        if (expectedVersion !== undefined) {
            values.push(expectedVersion)
            versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
        }

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                afterUpdateLifecycleRequest = await applyBulkUpdateInTransaction({
                    executor: txManager,
                    ctx,
                    applicationId,
                    objectCollection,
                    attrs,
                    data,
                    normalizedPatchByColumn,
                    expectedVersion,
                    runtimeRowCondition,
                    dataTableIdent,
                    touchedComponentIds,
                    runtimeDeleteSetClause,
                    setClauses,
                    values,
                    rowId,
                    rowIdParamIndex,
                    versionCheckClause,
                    tableDataEntries
                })
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
            return res.json({ status: 'ok' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }
    return bulkUpdateRow
}
