import type { Request, Response } from 'express'

import type { DbExecutor } from '@universo-react/utils'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { enforceObjectWorkspaceLimit } from '../services/applicationWorkspaces'
import { assertRuntimeRecordMutable, normalizeRuntimeRecordBehavior, RuntimeRecordCommandService } from '../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../services/runtimeLifecycleDispatch'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    UUID_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    buildRuntimeRestoreSetClause,
    buildRuntimeSoftDeleteSetClause,
    coerceRuntimeValue,
    createQueryHelper,
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
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    toRuntimeInputFormatErrorBody,
    type RuntimeSchemaContext,
    type RuntimeTableChildComponentMeta
} from '../shared/runtimeHelpers'
import { acquireRuntimeRecordRuleLock, assertRuntimeRecordRules } from '../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from './runtimeVersionConflict'
import {
    buildRuntimeExpectedVersionPredicate,
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeBulkUpdateBodySchema,
    runtimeCompensateCreateBodySchema,
    runtimeCopyBodySchema,
    runtimeCreateBodySchema,
    runtimeRestoreBodySchema,
    runtimeUpdateBodySchema,
    type RuntimeObjectCollectionAttr,
    isRuntimeServerOwnedAttr
} from './runtimeRowSupport/contracts'
import { getNextRuntimeSortValue, resolveRuntimeObjectCollection, resolveRuntimeObjectCollectionConfig } from './runtimeRowSupport/objects'
import {
    applyRuntimeDateOffsetDerivations,
    validateRuntimeDateOrderRules,
    validateRuntimeParentRecordAccessReferences,
    validateRuntimeRecordPickerReferences,
    validateRuntimeRequiredWhenRules
} from './runtimeRowSupport/validation'
import { resolveRuntimeReorderField } from './runtimeRowSupport/list'
import {
    assertInterpretationNetworkGenericCopyAllowed,
    assertInterpretationNetworkGenericCreateAllowed,
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause,
    hasRuntimeServerOwnedInput,
    loadRuntimeRowByIdWithRecordAccess,
    readRuntimeCopyRelations,
    validateRuntimeAccessEntryMembership
} from './runtimeRowSupport/access'
import {
    assertMarketingRuntimeRowCap,
    collectTouchedComponentIds,
    copyRuntimeConfiguredRelations,
    loadRuntimeRowById
} from './runtimeRowSupport/rows'

/**
 * Runtime row write handlers (single-cell and bulk updates, create, copy,
 * soft delete and restore). Extracted from `runtimeRowsController`; shared helpers
 * live in `./runtimeRowSupport/*`.
 */
export interface RuntimeRowWriteHandlerContext {
    getDbExecutor: () => DbExecutor
}

type RuntimeWriteResolvedObjectCollection = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectCollection>>['objectCollection']>

type RuntimeWriteColumnValue = { column: string; value: unknown }

type RuntimeTableChildAttrRow = {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
    ui_config?: Record<string, unknown>
}

type RuntimeWriteTableDataEntry = {
    tabTableName: string
    rows: Array<Record<string, unknown>>
    childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
}

type RuntimeWriteTableDataEntryWithAttr = RuntimeWriteTableDataEntry & {
    cmp: RuntimeObjectCollectionAttr
}

type RuntimeWriteCopyRelationsConfig = Exclude<ReturnType<typeof readRuntimeCopyRelations>, { invalid: true }>

const insertRuntimeChildRowsBatch = async (params: {
    executor: DbExecutor
    schemaIdent: string
    tabTableName: string
    parentRowId: string
    childRows: Array<Record<string, unknown>>
    childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
    userId: string
}): Promise<void> => {
    const tabTableIdent = `${params.schemaIdent}.${quoteIdentifier(params.tabTableName)}`
    const dataColSet = new Set<string>()
    for (const rd of params.childRows) {
        for (const cn of Object.keys(rd)) {
            if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
        }
    }
    const dataColumns = [...dataColSet]
    const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
    if (params.workspacesEnabled && params.currentWorkspaceId) {
        headerCols.push(quoteIdentifier('workspace_id'))
    }
    if (params.userId) headerCols.push('_upl_created_by')
    const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
    const allValues: unknown[] = []
    const valueTuples: string[] = []
    let pIdx = 1

    for (let rowIdx = 0; rowIdx < params.childRows.length; rowIdx++) {
        const rowData = params.childRows[rowIdx]
        const ph: string[] = []
        ph.push(`$${pIdx++}`)
        allValues.push(params.parentRowId)
        ph.push(`$${pIdx++}`)
        allValues.push(rowIdx)
        if (params.workspacesEnabled && params.currentWorkspaceId) {
            ph.push(`$${pIdx++}`)
            allValues.push(params.currentWorkspaceId)
        }
        if (params.userId) {
            ph.push(`$${pIdx++}`)
            allValues.push(params.userId)
        }
        for (const cn of dataColumns) {
            ph.push(`$${pIdx++}`)
            allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, params.childAttrsByColumn.get(cn)))
        }
        valueTuples.push(`(${ph.join(', ')})`)
    }

    await params.executor.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
}

const buildBulkUpdateScalarPatch = async (params: {
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

const prepareBulkUpdateTableChildRows = async (params: {
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

const buildBulkUpdateTableEntries = async (params: {
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

const replaceRuntimeTableChildRows = async (params: {
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

const executeBulkUpdateStatement = async (params: {
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

const applyBulkUpdateInTransaction = async (params: {
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

const buildCreateScalarColumnValues = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    safeAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    { kind: 'ok'; columnValues: RuntimeWriteColumnValue[] } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const columnValues: RuntimeWriteColumnValue[] = []

    for (const cmp of params.safeAttrs) {
        const attrLabel = formatRuntimeFieldLabel(cmp.codename)
        const { hasUserValue, value: inputValue } = getRuntimeInputValue(params.data, cmp.column_name, cmp.codename)
        let raw = inputValue

        const isEnumRef = cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind)
        const enumMode = getEnumPresentationMode(cmp.ui_config)

        if (isEnumRef && enumMode === 'label' && hasUserValue) {
            return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
        }

        if (raw === undefined && isEnumRef && typeof cmp.target_object_id === 'string') {
            const defaultEnumValueId = getDefaultEnumValueId(cmp.ui_config)
            if (defaultEnumValueId) {
                try {
                    await ensureEnumerationValueBelongsToTarget(
                        params.manager,
                        params.schemaIdent,
                        defaultEnumValueId,
                        cmp.target_object_id
                    )
                    raw = defaultEnumValueId
                } catch (error) {
                    if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                        raw = undefined
                    } else {
                        throw error
                    }
                }
            }
        }

        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(raw)
            if (!providedRefId) {
                raw = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
            } else {
                raw = valueGroupFixedValueConfig.id
            }
        }

        if (raw === undefined) {
            if (cmp.is_required && cmp.data_type !== 'BOOLEAN') {
                return { kind: 'failure', statusCode: 400, body: { error: `Required field missing: ${attrLabel}` } }
            }
            continue
        }
        try {
            const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(raw, cmp.data_type, cmp.validation_rules), cmp)
            if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                return { kind: 'failure', statusCode: 400, body: { error: `Required field cannot be set to null: ${attrLabel}` } }
            }

            if (isEnumRef && typeof cmp.target_object_id === 'string' && coerced) {
                await ensureEnumerationValueBelongsToTarget(params.manager, params.schemaIdent, String(coerced), cmp.target_object_id)
            }

            columnValues.push({
                column: cmp.column_name,
                value: coerced
            })
        } catch (e) {
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
            return { kind: 'failure', statusCode: 400, body: { error: `Invalid value for ${attrLabel}: ${(e as Error).message}` } }
        }
    }

    return { kind: 'ok', columnValues }
}

const validateCreatePendingRow = async (params: {
    ctx: RuntimeSchemaContext
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    safeAttrs: RuntimeObjectCollectionAttr[]
    columnValues: RuntimeWriteColumnValue[]
}): Promise<
    | { kind: 'ok'; pendingCreateRow: Record<string, unknown>; columnValues: RuntimeWriteColumnValue[] }
    | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    let pendingCreateRow = Object.fromEntries(params.columnValues.map(({ column, value }) => [column, value]))
    const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
        manager: params.ctx.manager,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCreateRow
    })
    if (accessEntryValidationError) {
        return { kind: 'failure', statusCode: 400, body: { error: accessEntryValidationError } }
    }
    const referenceValidationError = await validateRuntimeRecordPickerReferences({
        manager: params.ctx.manager,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        attrs: params.attrs,
        row: pendingCreateRow
    })
    if (referenceValidationError) {
        return { kind: 'failure', statusCode: 400, body: { error: referenceValidationError } }
    }
    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
        manager: params.ctx.manager,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCreateRow,
        minimumAccessLevel: 'edit'
    })
    if (parentAccessValidationError) {
        return { kind: 'failure', statusCode: 400, body: { error: parentAccessValidationError } }
    }
    const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCreateRow
    })
    if (requiredWhenValidationError) {
        return { kind: 'failure', statusCode: 400, body: { error: requiredWhenValidationError } }
    }
    const dateDerivationResult = applyRuntimeDateOffsetDerivations({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCreateRow
    })
    if (dateDerivationResult.error) {
        return { kind: 'failure', statusCode: 400, body: { error: dateDerivationResult.error } }
    }
    pendingCreateRow = dateDerivationResult.row
    const safeAttrColumnSet = new Set(params.safeAttrs.map((attr) => attr.column_name))
    for (const [column, value] of Object.entries(pendingCreateRow)) {
        if (!safeAttrColumnSet.has(column)) continue
        const existing = params.columnValues.find((item) => item.column === column)
        if (existing) {
            existing.value = value
        } else {
            params.columnValues.push({ column, value })
        }
    }
    const dateOrderValidationError = validateRuntimeDateOrderRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCreateRow
    })
    if (dateOrderValidationError) {
        return { kind: 'failure', statusCode: 400, body: { error: dateOrderValidationError } }
    }

    return { kind: 'ok', pendingCreateRow, columnValues: params.columnValues }
}

const applyCreateReorderField = async (params: {
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    safeAttrs: RuntimeObjectCollectionAttr[]
    columnValues: RuntimeWriteColumnValue[]
    dataTableIdent: string
    runtimeRowCondition: string
}): Promise<RuntimeWriteColumnValue[]> => {
    const { runtimeConfig } = await resolveRuntimeObjectCollectionConfig({
        manager: params.ctx.manager,
        applicationId: params.applicationId,
        userId: params.ctx.userId,
        role: params.ctx.role,
        workspaceId: params.ctx.currentWorkspaceId,
        objectCollectionId: params.objectCollection.id
    })
    const reorderFieldAttr = resolveRuntimeReorderField(
        params.safeAttrs,
        runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
    )
    if (reorderFieldAttr && !params.columnValues.some((item) => item.column === reorderFieldAttr.column_name)) {
        const nextSortValue = await getNextRuntimeSortValue({
            manager: params.ctx.manager,
            dataTableIdent: params.dataTableIdent,
            runtimeRowCondition: params.runtimeRowCondition,
            reorderColumnName: reorderFieldAttr.column_name
        })
        params.columnValues.push({
            column: reorderFieldAttr.column_name,
            value: nextSortValue
        })
    }

    return params.columnValues
}

const prepareCreateTableChildRows = async (params: {
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
            const { hasUserValue, value: childInputValue } = getRuntimeInputValue(rowData, cAttr.column_name, cAttr.codename)
            let cRaw = childInputValue

            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
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
                    return { kind: 'failure', statusCode: 400, body: { error: `Required field missing: ${childFieldPath}` } }
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

const buildCreateTableEntries = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    tableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    { kind: 'ok'; entries: RuntimeWriteTableDataEntryWithAttr[] } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const tableDataEntries: RuntimeWriteTableDataEntryWithAttr[] = []

    for (const tAttr of params.tableAttrs) {
        const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
        const { value: raw } = getRuntimeInputValue(params.data, tAttr.column_name, tAttr.codename)
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

        if (childRows.length > 0) {
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

            const preparedResult = await prepareCreateTableChildRows({
                manager: params.manager,
                schemaIdent: params.schemaIdent,
                tableFieldPath,
                tableAttr: tAttr,
                childRows,
                childAttrs: childAttrsResult
            })
            if (preparedResult.kind !== 'ok') return preparedResult

            tableDataEntries.push({
                cmp: tAttr,
                rows: preparedResult.rows,
                tabTableName,
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
    }

    return { kind: 'ok', entries: tableDataEntries }
}

const executeCreateRowTransaction = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    data: Record<string, unknown>
    runtimeRowCondition: string
    dataTableIdent: string
    columnValues: RuntimeWriteColumnValue[]
    touchedComponentIds: string[]
    recordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
    tableDataEntries: RuntimeWriteTableDataEntryWithAttr[]
    recordCommandService: RuntimeRecordCommandService
}): Promise<{ parentId: string; afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest }> => {
    const mgr = params.executor
    await assertInterpretationNetworkGenericCreateAllowed(mgr, params.ctx, params.applicationId, params.objectCollection.id)
    if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) {
        const limitState = await enforceObjectWorkspaceLimit(mgr, {
            schemaName: params.ctx.schemaName,
            objectId: params.objectCollection.id,
            tableName: params.objectCollection.table_name,
            workspaceId: params.ctx.currentWorkspaceId,
            runtimeRowCondition: params.runtimeRowCondition
        })

        if (!limitState.canCreate) {
            throw new UpdateFailure(409, {
                error: 'Workspace object row limit reached',
                code: 'WORKSPACE_LIMIT_REACHED',
                details: limitState
            })
        }
    }

    const createColumnValues = await params.recordCommandService.buildInitialCreateColumnValues({
        columnValues: params.columnValues,
        behavior: params.recordBehavior,
        manager: mgr,
        schemaIdent: params.ctx.schemaIdent,
        objectId: params.objectCollection.id,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId
    })
    const transactionalCreateRow = Object.fromEntries(createColumnValues.map(({ column, value }) => [column, value]))
    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
        manager: mgr,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: transactionalCreateRow,
        minimumAccessLevel: 'edit'
    })
    if (parentAccessValidationError) {
        throw new UpdateFailure(400, { error: parentAccessValidationError })
    }

    await assertMarketingRuntimeRowCap({
        manager: mgr,
        schemaIdent: params.ctx.schemaIdent,
        tableName: params.objectCollection.table_name,
        runtimeRowCondition: params.runtimeRowCondition,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename)
    })

    await assertRuntimeRecordRules({
        manager: mgr,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        activeCondition: params.runtimeRowCondition,
        attrs: params.attrs,
        row: transactionalCreateRow
    })

    await dispatchRuntimeLifecycle({
        manager: mgr,
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'beforeCreate',
            patch: params.data
        }
    })

    const colNames = createColumnValues.map((cv) => quoteIdentifier(cv.column))
    const placeholders = createColumnValues.map((_, i) => `$${i + 1}`)
    const insertValues = createColumnValues.map((cv) => cv.value)

    if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) {
        colNames.push(quoteIdentifier('workspace_id'))
        placeholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.ctx.currentWorkspaceId)
    }

    if (params.ctx.userId) {
        colNames.push('_upl_created_by')
        placeholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.ctx.userId)
    }

    const insertSql =
        colNames.length > 0
            ? `INSERT INTO ${params.dataTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
            : `INSERT INTO ${params.dataTableIdent} DEFAULT VALUES RETURNING id`
    const [inserted] = (await mgr.query(insertSql, insertValues)) as Array<{ id: string }>
    const parentId = inserted.id

    for (const { rows: childRows, tabTableName, childAttrsByColumn } of params.tableDataEntries) {
        if (childRows.length === 0) continue
        await insertRuntimeChildRowsBatch({
            executor: mgr,
            schemaIdent: params.ctx.schemaIdent,
            tabTableName,
            parentRowId: parentId,
            childRows,
            childAttrsByColumn,
            workspacesEnabled: params.ctx.workspacesEnabled,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            userId: params.ctx.userId
        })
    }

    const nextRow = await loadRuntimeRowById(mgr, params.dataTableIdent, parentId)
    const afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest = {
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'afterCreate',
            row: nextRow,
            patch: params.data
        }
    }

    return { parentId, afterCreateLifecycleRequest }
}

const buildCopyOverrideValues = async (params: {
    ctx: RuntimeSchemaContext
    objectCollection: RuntimeWriteResolvedObjectCollection
    nonTableAttrs: RuntimeObjectCollectionAttr[]
    tableAttrsForCopy: RuntimeObjectCollectionAttr[]
    copyOverrideData: Record<string, unknown>
}): Promise<
    { kind: 'ok'; copyOverrideValues: Map<string, unknown> } | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const copyOverrideValues = new Map<string, unknown>()
    for (const cmp of params.tableAttrsForCopy) {
        const { hasUserValue, value } = getRuntimeInputValue(params.copyOverrideData, cmp.column_name, cmp.codename)
        const isEmptyTableOverride = Array.isArray(value) && value.length === 0
        if (hasUserValue && !isEmptyTableOverride) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `TABLE overrides are not supported during copy: ${formatRuntimeFieldLabel(cmp.codename)}` }
            }
        }
    }
    if (Object.keys(params.copyOverrideData).length > 0) {
        const serverOwnedOverrideAttr = params.nonTableAttrs.find((attr) => hasRuntimeServerOwnedInput(params.copyOverrideData, attr))
        if (serverOwnedOverrideAttr) {
            return {
                kind: 'failure',
                statusCode: 400,
                body: { error: `Field is server-owned: ${formatRuntimeFieldLabel(serverOwnedOverrideAttr.codename)}` }
            }
        }
        for (const cmp of params.nonTableAttrs) {
            const attrLabel = formatRuntimeFieldLabel(cmp.codename)
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(params.copyOverrideData, cmp.column_name, cmp.codename)
            if (!hasUserValue) continue

            let raw = inputValue
            const isEnumRef = cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind)

            if (isEnumRef && getEnumPresentationMode(cmp.ui_config) === 'label') {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
            }

            const valueGroupFixedValueConfig =
                cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
            if (valueGroupFixedValueConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    raw = valueGroupFixedValueConfig.id
                } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                    return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
                } else {
                    raw = valueGroupFixedValueConfig.id
                }
            }

            try {
                const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(raw, cmp.data_type, cmp.validation_rules), cmp)
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                    return {
                        kind: 'failure',
                        statusCode: 400,
                        body: { error: `Required field cannot be set to null: ${attrLabel}` }
                    }
                }

                if (isEnumRef && typeof cmp.target_object_id === 'string' && coerced) {
                    await ensureEnumerationValueBelongsToTarget(
                        params.ctx.manager,
                        params.ctx.schemaIdent,
                        String(coerced),
                        cmp.target_object_id
                    )
                }

                copyOverrideValues.set(cmp.column_name, coerced)
            } catch (error) {
                const formatError = toRuntimeInputFormatErrorBody(error)
                if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
                return {
                    kind: 'failure',
                    statusCode: 400,
                    body: { error: `Invalid value for ${attrLabel}: ${(error as Error).message}` }
                }
            }
        }
    }

    return { kind: 'ok', copyOverrideValues }
}

const buildPendingCopyState = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    nonTableAttrs: RuntimeObjectCollectionAttr[]
    copyOverrideValues: Map<string, unknown>
    currentSourceRow: Record<string, unknown>
}): Promise<Map<string, unknown>> => {
    let pendingCopyRow: Record<string, unknown> = Object.fromEntries(
        params.nonTableAttrs.map((cmp) => [cmp.column_name, params.currentSourceRow[cmp.column_name] ?? null])
    )
    const effectiveCopyValues = new Map(params.copyOverrideValues)
    for (const [column, value] of effectiveCopyValues) {
        pendingCopyRow[column] = value
    }

    const dateDerivationResult = applyRuntimeDateOffsetDerivations({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCopyRow
    })
    if (dateDerivationResult.error) {
        throw new UpdateFailure(400, { error: dateDerivationResult.error })
    }
    pendingCopyRow = dateDerivationResult.row
    for (const [column, value] of Object.entries(pendingCopyRow)) {
        if (params.nonTableAttrs.some((cmp) => cmp.column_name === column)) {
            effectiveCopyValues.set(column, value)
        }
    }

    const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCopyRow
    })
    if (accessEntryValidationError) {
        throw new UpdateFailure(400, { error: accessEntryValidationError })
    }
    const referenceValidationError = await validateRuntimeRecordPickerReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        attrs: params.attrs,
        row: pendingCopyRow
    })
    if (referenceValidationError) {
        throw new UpdateFailure(400, { error: referenceValidationError })
    }
    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCopyRow,
        minimumAccessLevel: 'edit'
    })
    if (parentAccessValidationError) {
        throw new UpdateFailure(400, { error: parentAccessValidationError })
    }
    const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCopyRow
    })
    if (requiredWhenValidationError) {
        throw new UpdateFailure(400, { error: requiredWhenValidationError })
    }
    const dateOrderValidationError = validateRuntimeDateOrderRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: pendingCopyRow
    })
    if (dateOrderValidationError) {
        throw new UpdateFailure(400, { error: dateOrderValidationError })
    }

    return effectiveCopyValues
}

const loadLockedCopySourceRow = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    rowId: string
    runtimeRowCondition: string
    expectedVersion: number | undefined
    dataTableIdent: string
}): Promise<Record<string, unknown>> => {
    const transactionalSourceValues: unknown[] = [params.rowId]
    const transactionalSourceAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        attrs: params.attrs,
        config: params.objectCollection.config,
        outerRowIdSql: `${params.dataTableIdent}.id`,
        values: transactionalSourceValues,
        minimumAccessLevel: 'edit'
    })
    const transactionalSourceWhereSql = ['id = $1', params.runtimeRowCondition, transactionalSourceAccessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const sourceRowsForCopy = (await params.executor.query(
        `
      SELECT *
      FROM ${params.dataTableIdent}
      WHERE ${transactionalSourceWhereSql}
      FOR UPDATE
      LIMIT 1
    `,
        transactionalSourceValues
    )) as Array<Record<string, unknown>>
    const transactionalSourceRow = sourceRowsForCopy[0]
    if (!transactionalSourceRow?.id) {
        throw new UpdateFailure(404, { error: 'Row not found' })
    }
    if (transactionalSourceRow._upl_locked) {
        throw new UpdateFailure(423, { error: 'Record is locked' })
    }
    await assertNotProtectedSystemStructureRuntimeRow(
        params.executor,
        params.ctx,
        params.applicationId,
        params.objectCollection.id,
        params.attrs,
        transactionalSourceRow
    )
    if (params.expectedVersion !== undefined) {
        const actualVersion = Number(transactionalSourceRow._upl_version ?? 1)
        if (actualVersion !== params.expectedVersion) {
            throw createRuntimeVersionConflictFailure(params.expectedVersion, actualVersion)
        }
    }
    assertRuntimeRecordMutable(params.objectCollection.config, transactionalSourceRow)

    return transactionalSourceRow
}

const copyRuntimeChildTableRows = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    tableAttr: RuntimeObjectCollectionAttr
    runtimeRowCondition: string
    sourceParentId: string
    copiedParentId: string
}): Promise<void> => {
    const { minRows } = getTableRowLimits(params.tableAttr.validation_rules)
    const fallbackTabTableName = generateChildTableName(params.tableAttr.id)
    const tabTableName =
        typeof params.tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(params.tableAttr.column_name)
            ? params.tableAttr.column_name
            : fallbackTabTableName
    if (!IDENTIFIER_REGEX.test(tabTableName)) return
    const tabTableIdent = `${params.ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

    const childAttrs = (await params.executor.query(
        `
          SELECT codename, column_name, data_type, validation_rules, ui_config
          FROM ${params.ctx.schemaIdent}._app_components
          WHERE parent_component_id = $1
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
        `,
        [params.tableAttr.id]
    )) as Array<{
        codename: string
        column_name: string
        data_type?: string | null
        validation_rules?: Record<string, unknown>
        ui_config?: Record<string, unknown> | null
    }>

    const validChildColumns = childAttrs
        .filter((cmp) => !isRuntimeServerOwnedAttr(cmp))
        .map((cmp) => cmp.column_name)
        .filter((column) => IDENTIFIER_REGEX.test(column))
    const childAttrsByColumn = new Map(childAttrs.map((cmp) => [cmp.column_name, cmp]))
    const sourceChildRows = (await params.executor.query(
        `
          SELECT ${validChildColumns.length > 0 ? validChildColumns.map((column) => quoteIdentifier(column)).join(', ') + ',' : ''}
                 _tp_sort_order
          FROM ${tabTableIdent}
          WHERE _tp_parent_id = $1
            AND ${params.runtimeRowCondition}
          ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
        `,
        [params.sourceParentId]
    )) as Array<Record<string, unknown>>

    if (minRows !== null && sourceChildRows.length < minRows) {
        throw new UpdateFailure(400, {
            error: `TABLE ${params.tableAttr.codename} requires at least ${minRows} row(s)`
        })
    }

    if (sourceChildRows.length === 0) return

    const headerColumns = [
        '_tp_parent_id',
        '_tp_sort_order',
        ...(params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
        ...(params.ctx.userId ? ['_upl_created_by'] : [])
    ]
    const allColumns = [...headerColumns, ...validChildColumns.map((column) => quoteIdentifier(column))]
    const copyValues: unknown[] = []
    const valueTuples: string[] = []
    let copyParamIndex = 1
    for (let index = 0; index < sourceChildRows.length; index++) {
        const sourceChild = sourceChildRows[index]
        const tuple: string[] = []
        tuple.push(`$${copyParamIndex++}`)
        copyValues.push(params.copiedParentId)
        tuple.push(`$${copyParamIndex++}`)
        copyValues.push(index)
        if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(params.ctx.currentWorkspaceId)
        }
        if (params.ctx.userId) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(params.ctx.userId)
        }
        for (const column of validChildColumns) {
            tuple.push(`$${copyParamIndex++}`)
            copyValues.push(normalizeRuntimeTableChildInsertValueByMeta(sourceChild[column] ?? null, childAttrsByColumn.get(column)))
        }
        valueTuples.push(`(${tuple.join(', ')})`)
    }
    await params.executor.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, copyValues)
}

const executeCopyRowTransaction = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    nonTableAttrs: RuntimeObjectCollectionAttr[]
    tableAttrsForCopy: RuntimeObjectCollectionAttr[]
    rowId: string
    runtimeRowCondition: string
    expectedVersion: number | undefined
    dataTableIdent: string
    copyOverrideValues: Map<string, unknown>
    reorderFieldAttr: ReturnType<typeof resolveRuntimeReorderField>
    copyChildTables: boolean
    copyRelationsConfig: RuntimeWriteCopyRelationsConfig
    insertColumns: string[]
}): Promise<{ copiedId: string; afterCopyLifecycleRequest: RuntimeLifecycleDispatchRequest }> => {
    await assertInterpretationNetworkGenericCopyAllowed(params.executor, params.ctx, params.applicationId, params.objectCollection.id)
    await assertInterpretationNetworkGenericCreateAllowed(params.executor, params.ctx, params.applicationId, params.objectCollection.id)
    await assertMarketingRuntimeRowCap({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        tableName: params.objectCollection.table_name,
        runtimeRowCondition: params.runtimeRowCondition,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename)
    })

    // Unique-rule writers serialize on the rule advisory lock before taking the
    // source row lock; update paths take the advisory lock first as well, so the
    // copy/update pair can no longer deadlock on inverted lock order.
    const hasUniqueRuleAttr = params.attrs.some((attr) => attr.data_type === 'STRING' && attr.validation_rules?.unique === true)
    if (hasUniqueRuleAttr) {
        await acquireRuntimeRecordRuleLock(params.executor, params.ctx.schemaIdent, params.dataTableIdent)
    }

    const transactionalSourceRow = await loadLockedCopySourceRow({
        executor: params.executor,
        ctx: params.ctx,
        applicationId: params.applicationId,
        objectCollection: params.objectCollection,
        attrs: params.attrs,
        rowId: params.rowId,
        runtimeRowCondition: params.runtimeRowCondition,
        expectedVersion: params.expectedVersion,
        dataTableIdent: params.dataTableIdent
    })
    const effectiveCopyValues = await buildPendingCopyState({
        executor: params.executor,
        ctx: params.ctx,
        objectCollection: params.objectCollection,
        attrs: params.attrs,
        nonTableAttrs: params.nonTableAttrs,
        copyOverrideValues: params.copyOverrideValues,
        currentSourceRow: transactionalSourceRow
    })

    if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) {
        const limitState = await enforceObjectWorkspaceLimit(params.executor, {
            schemaName: params.ctx.schemaName,
            objectId: params.objectCollection.id,
            tableName: params.objectCollection.table_name,
            workspaceId: params.ctx.currentWorkspaceId,
            runtimeRowCondition: params.runtimeRowCondition
        })

        if (!limitState.canCreate) {
            throw new UpdateFailure(409, {
                error: 'Workspace object row limit reached',
                code: 'WORKSPACE_LIMIT_REACHED',
                details: limitState
            })
        }
    }

    const copiedRuleValues = Object.fromEntries(
        params.nonTableAttrs
            .filter((cmp) => cmp.column_name !== params.reorderFieldAttr?.column_name)
            .map((cmp) => [
                cmp.column_name,
                effectiveCopyValues.has(cmp.column_name)
                    ? effectiveCopyValues.get(cmp.column_name) ?? null
                    : transactionalSourceRow[cmp.column_name] ?? null
            ])
    )
    await assertRuntimeRecordRules({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        activeCondition: params.runtimeRowCondition,
        attrs: params.attrs,
        row: copiedRuleValues
    })

    await dispatchRuntimeLifecycle({
        manager: params.executor,
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        payload: {
            eventName: 'beforeCopy',
            previousRow: transactionalSourceRow,
            metadata: {
                copyChildTables: params.copyChildTables
            }
        }
    })

    const insertValuesArr = params.nonTableAttrs.map((cmp) =>
        params.reorderFieldAttr?.column_name === cmp.column_name
            ? null
            : effectiveCopyValues.has(cmp.column_name)
            ? effectiveCopyValues.get(cmp.column_name) ?? null
            : transactionalSourceRow[cmp.column_name] ?? null
    )
    if (params.ctx.workspacesEnabled && params.ctx.currentWorkspaceId) insertValuesArr.push(params.ctx.currentWorkspaceId)
    if (params.ctx.userId) insertValuesArr.push(params.ctx.userId)
    const placeholders = insertValuesArr.map((_, index) => `$${index + 1}`)

    if (params.reorderFieldAttr) {
        const reorderFieldIndex = params.nonTableAttrs.findIndex((cmp) => cmp.column_name === params.reorderFieldAttr?.column_name)
        if (reorderFieldIndex >= 0) {
            insertValuesArr[reorderFieldIndex] = await getNextRuntimeSortValue({
                manager: params.executor,
                dataTableIdent: params.dataTableIdent,
                runtimeRowCondition: params.runtimeRowCondition,
                reorderColumnName: params.reorderFieldAttr.column_name
            })
        }
    }

    const [insertedParent] = (await params.executor.query(
        `INSERT INTO ${params.dataTableIdent} (${params.insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
        insertValuesArr
    )) as Array<{ id: string }>

    if (params.copyChildTables) {
        for (const tableAttr of params.tableAttrsForCopy) {
            await copyRuntimeChildTableRows({
                executor: params.executor,
                ctx: params.ctx,
                tableAttr,
                runtimeRowCondition: params.runtimeRowCondition,
                sourceParentId: params.rowId,
                copiedParentId: insertedParent.id
            })
        }
    }

    if (params.copyRelationsConfig && params.copyRelationsConfig.relations.length > 0) {
        await copyRuntimeConfiguredRelations({
            manager: params.executor,
            schemaIdent: params.ctx.schemaIdent,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            workspacesEnabled: params.ctx.workspacesEnabled,
            userId: params.ctx.userId,
            sourceParentId: params.rowId,
            copiedParentId: insertedParent.id,
            relations: params.copyRelationsConfig.relations
        })
    }

    const nextRow = await loadRuntimeRowById(params.executor, params.dataTableIdent, insertedParent.id)
    const afterCopyLifecycleRequest: RuntimeLifecycleDispatchRequest = {
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        payload: {
            eventName: 'afterCopy',
            row: nextRow,
            previousRow: transactionalSourceRow,
            metadata: {
                copyChildTables: params.copyChildTables
            }
        }
    }

    return { copiedId: insertedParent.id, afterCopyLifecycleRequest }
}

export function createRuntimeRowWriteHandlers({ getDbExecutor }: RuntimeRowWriteHandlerContext) {
    const query = createQueryHelper(getDbExecutor)
    const recordCommandService = new RuntimeRecordCommandService()

    const updateCell = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { field, value, objectCollectionId: requestedObjectCollectionId, expectedVersion } = parsedBody.data
        if (!IDENTIFIER_REGEX.test(field)) {
            return res.status(400).json({ error: 'Invalid field name' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const cmp = attrs.find((a) => a.column_name === field)
        if (!cmp) return res.status(404).json({ error: 'Component not found' })
        if (isRuntimeServerOwnedAttr(cmp)) {
            return res.status(400).json({
                error: `Field is server-owned: ${formatRuntimeFieldLabel(cmp.codename)}`
            })
        }
        if (!RUNTIME_WRITABLE_TYPES.has(cmp.data_type)) {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} is not editable`
            })
        }

        if (cmp.data_type === 'TABLE') {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} must be edited via tabular endpoints`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return res.status(400).json({
                error: `Field is read-only: ${cmp.codename}`
            })
        }

        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        let rawValue = value
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(rawValue)
            if (!providedRefId) {
                rawValue = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return res.status(400).json({
                    error: `Field is read-only: ${cmp.codename}`
                })
            } else {
                rawValue = valueGroupFixedValueConfig.id
            }
        }

        let coerced: unknown
        try {
            coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(rawValue, cmp.data_type, cmp.validation_rules), cmp)
        } catch (e) {
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return res.status(400).json(formatError)
            return res.status(400).json({ error: (e as Error).message })
        }

        if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
            return res.status(400).json({
                error: `Required field cannot be set to null: ${cmp.codename}`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            typeof cmp.target_object_id === 'string' &&
            coerced
        ) {
            try {
                await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
            } catch (error) {
                return res.status(400).json({ error: (error as Error).message })
            }
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
                const previousRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                await assertNotProtectedSystemStructureRuntimeRow(txManager, ctx, applicationId, objectCollection.id, attrs, previousRow)
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                const referenceValidationError = await validateRuntimeRecordPickerReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (referenceValidationError) {
                    throw new UpdateFailure(400, { error: referenceValidationError })
                }
                const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (accessEntryValidationError) {
                    throw new UpdateFailure(400, { error: accessEntryValidationError })
                }
                const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced },
                    minimumAccessLevel: 'edit'
                })
                if (parentAccessValidationError) {
                    throw new UpdateFailure(400, { error: parentAccessValidationError })
                }
                const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (requiredWhenValidationError) {
                    throw new UpdateFailure(400, { error: requiredWhenValidationError })
                }
                const dateOrderValidationError = validateRuntimeDateOrderRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (dateOrderValidationError) {
                    throw new UpdateFailure(400, { error: dateOrderValidationError })
                }

                if (expectedVersion !== undefined && Number(previousRow._upl_version ?? 1) !== expectedVersion) {
                    throw createRuntimeVersionConflictFailure(expectedVersion, Number(previousRow._upl_version ?? 1))
                }

                await assertRuntimeRecordRules({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    activeCondition: runtimeRowCondition,
                    attrs,
                    row: { [field]: coerced },
                    excludeRowId: rowId
                })

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: { [field]: coerced }
                    }
                })

                const updateValues: unknown[] = [coerced, ctx.userId, rowId]
                if (expectedVersion !== undefined) updateValues.push(expectedVersion)
                const versionCheckClause = expectedVersion !== undefined ? `AND COALESCE(_upl_version, 1) = $${updateValues.length}` : ''
                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: updateValues,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = ['id = $3', runtimeRowCondition, 'COALESCE(_upl_locked, false) = false', updateAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const seedOwnershipClause = ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''

                const updated = (await txManager.query(
                    `
        UPDATE ${dataTableIdent}
        SET ${quoteIdentifier(field)} = $1,
            ${seedOwnershipClause}
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE ${updateWhereSql}
          ${versionCheckClause}
        RETURNING id
      `,
                    updateValues
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (updated.length === 0) {
                    const exists = (await txManager.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{
                        id: string
                        _upl_locked?: boolean
                        _upl_version?: number
                    }>

                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }

                    if (exists.length > 0 && expectedVersion !== undefined) {
                        const actualVersion = Number(exists[0]._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                        }
                    }

                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: { [field]: coerced }
                    }
                }
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

    // ============ CREATE ROW ============
    const createRow = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const parsedBody = runtimeCreateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const safeAttrs = attrs.filter(
            (a) =>
                IDENTIFIER_REGEX.test(a.column_name) &&
                RUNTIME_WRITABLE_TYPES.has(a.data_type) &&
                a.data_type !== 'TABLE' &&
                !isRuntimeServerOwnedAttr(a)
        )
        const serverOwnedInputAttr = attrs.find((attr) => hasRuntimeServerOwnedInput(data, attr))
        if (serverOwnedInputAttr) {
            return res.status(400).json({
                error: `Field is server-owned: ${formatRuntimeFieldLabel(serverOwnedInputAttr.codename)}`
            })
        }

        const scalarColumnValuesResult = await buildCreateScalarColumnValues({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            safeAttrs
        })
        if (scalarColumnValuesResult.kind === 'failure') {
            return res.status(scalarColumnValuesResult.statusCode).json(scalarColumnValuesResult.body)
        }
        const columnValues = scalarColumnValuesResult.columnValues

        const pendingRowResult = await validateCreatePendingRow({
            ctx,
            objectCollection,
            attrs,
            safeAttrs,
            columnValues
        })
        if (pendingRowResult.kind === 'failure') {
            return res.status(pendingRowResult.statusCode).json(pendingRowResult.body)
        }

        await applyCreateReorderField({
            ctx,
            applicationId,
            objectCollection,
            safeAttrs,
            columnValues,
            dataTableIdent,
            runtimeRowCondition
        })

        const touchedComponentIds = collectTouchedComponentIds(attrs, data)
        const recordBehavior = normalizeRuntimeRecordBehavior(objectCollection.config)

        const tableAttrsForCreate = attrs.filter((a) => a.data_type === 'TABLE')
        const tableEntriesResult = await buildCreateTableEntries({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            tableAttrs: tableAttrsForCreate
        })
        if (tableEntriesResult.kind === 'failure') {
            return res.status(tableEntriesResult.statusCode).json(tableEntriesResult.body)
        }
        const tableDataEntries = tableEntriesResult.entries

        let afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        let parentId: string
        try {
            const createResult = await withTransactionSavepoint(ctx.manager, async (txManager) =>
                executeCreateRowTransaction({
                    executor: txManager,
                    ctx,
                    applicationId,
                    objectCollection,
                    attrs,
                    data,
                    runtimeRowCondition,
                    dataTableIdent,
                    columnValues,
                    touchedComponentIds,
                    recordBehavior,
                    tableDataEntries,
                    recordCommandService
                })
            )
            parentId = createResult.parentId
            afterCreateLifecycleRequest = createResult.afterCreateLifecycleRequest
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCreateLifecycleRequest)
        return res.status(201).json({ id: parentId, status: 'created' })
    }

    // ============ COPY ROW ============
    const copyRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeCopyBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForCopy = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const hasRequiredChildTables = tableAttrsForCopy.some((cmp) => {
            const { minRows } = getTableRowLimits(cmp.validation_rules)
            return Boolean(cmp.is_required) || (minRows !== null && minRows > 0)
        })
        const copyChildTables = hasRequiredChildTables ? true : parsedBody.data.copyChildTables !== false
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const { runtimeConfig } = await resolveRuntimeObjectCollectionConfig({
            manager: ctx.manager,
            applicationId,
            userId: ctx.userId,
            role: ctx.role,
            workspaceId: ctx.currentWorkspaceId,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            nonTableAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )
        const copyRelationsConfig = readRuntimeCopyRelations(objectCollection.config)
        if (copyRelationsConfig?.invalid) {
            return res.status(409).json({
                error: 'Runtime copy relations are not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        const copyOverrideResult = await buildCopyOverrideValues({
            ctx,
            objectCollection,
            nonTableAttrs,
            tableAttrsForCopy,
            copyOverrideData: parsedBody.data.data ?? {}
        })
        if (copyOverrideResult.kind === 'failure') {
            return res.status(copyOverrideResult.statusCode).json(copyOverrideResult.body)
        }
        const copyOverrideValues = copyOverrideResult.copyOverrideValues

        const insertColumns = nonTableAttrs.map((cmp) => quoteIdentifier(cmp.column_name))
        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) insertColumns.push(quoteIdentifier('workspace_id'))
        if (ctx.userId) insertColumns.push('_upl_created_by')

        let afterCopyLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            const copyResult = await withTransactionSavepoint(ctx.manager, async (tx) =>
                executeCopyRowTransaction({
                    executor: tx,
                    ctx,
                    applicationId,
                    objectCollection,
                    attrs,
                    nonTableAttrs,
                    tableAttrsForCopy,
                    rowId,
                    runtimeRowCondition,
                    expectedVersion: parsedBody.data.expectedVersion,
                    dataTableIdent,
                    copyOverrideValues,
                    reorderFieldAttr,
                    copyChildTables,
                    copyRelationsConfig,
                    insertColumns
                })
            )
            afterCopyLifecycleRequest = copyResult.afterCopyLifecycleRequest
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCopyLifecycleRequest)
            return res.status(201).json({
                id: copyResult.copiedId,
                status: 'created',
                copyOptions: { copyChildTables },
                hasRequiredChildTables
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(error)
            if (formatError) return res.status(400).json(formatError)
            throw error
        }
    }

    const deleteRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const compensateCreate = req.method === 'POST' && req.path.endsWith('/compensate-create')
        const parsedCompensation = compensateCreate ? runtimeCompensateCreateBodySchema.safeParse(req.body ?? {}) : null
        if (parsedCompensation && !parsedCompensation.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedCompensation.error.flatten() })
        }
        const objectCollectionId = compensateCreate
            ? parsedCompensation?.data.objectCollectionId
            : typeof req.query.objectCollectionId === 'string'
            ? req.query.objectCollectionId
            : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })
        const expectedVersion = compensateCreate
            ? parsedCompensation?.data.expectedVersion
            : typeof req.query.expectedVersion === 'string' && req.query.expectedVersion.trim().length > 0
            ? Number(req.query.expectedVersion)
            : undefined
        if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion <= 0)) {
            return res.status(400).json({ error: 'Invalid expected version' })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        const canDeleteContent = ctx.permissions.deleteContent === true
        const canCompensateCreate =
            compensateCreate && expectedVersion === 1 && ctx.permissions.createContent === true && ctx.permissions.editContent === true
        if (!canDeleteContent && !canCompensateCreate) {
            if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')

        let afterDeleteLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performDelete = async (mgr: DbExecutor) => {
            const sourceValues: unknown[] = [rowId]
            const sourceAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: sourceValues,
                minimumAccessLevel: 'edit'
            })
            let compensationSourceClause = ''
            if (canCompensateCreate) {
                sourceValues.push(ctx.userId)
                compensationSourceClause = `_upl_created_by = $${sourceValues.length}
               AND COALESCE(_upl_version, 1) = 1
               AND _upl_created_at >= NOW() - INTERVAL '10 minutes'`
            }
            const sourceWhereSql = ['id = $1', runtimeRowCondition, sourceAccessClause, compensationSourceClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const sourceRows = (await mgr.query(
                `
          SELECT *
          FROM ${dataTableIdent}
          WHERE ${sourceWhereSql}
          LIMIT 1
          FOR UPDATE
        `,
                sourceValues
            )) as Array<Record<string, unknown>>
            const sourceRow = sourceRows[0]
            if (!sourceRow || !sourceRow.id) {
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }
            if (sourceRow._upl_locked) {
                throw new UpdateFailure(423, {
                    error: 'Record is locked'
                })
            }
            await assertNotProtectedSystemStructureRuntimeRow(mgr, ctx, applicationId, objectCollection.id, attrs, sourceRow)
            if (expectedVersion !== undefined) {
                const actualVersion = Number(sourceRow._upl_version ?? 1)
                if (actualVersion !== expectedVersion) {
                    throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                }
            }
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeDelete',
                    previousRow: sourceRow
                }
            })

            const deleteParams: unknown[] = runtimeDeleteSetClause ? [ctx.userId, rowId] : [rowId]
            const deleteRowIdPlaceholder = runtimeDeleteSetClause ? '$2' : '$1'
            const deleteAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: deleteParams,
                minimumAccessLevel: 'edit'
            })
            let compensationDeleteClause = ''
            if (canCompensateCreate) {
                deleteParams.push(ctx.userId)
                compensationDeleteClause = `_upl_created_by = $${deleteParams.length}
               AND COALESCE(_upl_version, 1) = 1
               AND _upl_created_at >= NOW() - INTERVAL '10 minutes'`
            }
            if (expectedVersion !== undefined) {
                deleteParams.push(expectedVersion)
            }
            const deleteExpectedVersionPredicate = buildRuntimeExpectedVersionPredicate(expectedVersion, deleteParams.length)
            const deleteWhereSql = [
                `id = ${deleteRowIdPlaceholder}`,
                runtimeRowCondition,
                'COALESCE(_upl_locked, false) = false',
                deleteAccessClause,
                compensationDeleteClause
            ]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const deleted = runtimeDeleteSetClause
                ? ((await mgr.query(
                      `
          UPDATE ${dataTableIdent}
          SET ${runtimeDeleteSetClause},
              ${ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''}
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE ${deleteWhereSql}
            ${deleteExpectedVersionPredicate}
          RETURNING id
        `,
                      deleteParams
                  )) as Array<{ id: string }>)
                : ((await mgr.query(
                      `
          DELETE FROM ${dataTableIdent}
          WHERE ${deleteWhereSql}
            ${deleteExpectedVersionPredicate}
          RETURNING id
        `,
                      deleteParams
                  )) as Array<{ id: string }>)

            if (deleted.length === 0) {
                if (expectedVersion !== undefined) {
                    throw createRuntimeVersionConflictFailure(expectedVersion)
                }
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }

            if (runtimeDeleteSetClause) {
                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await mgr.query(
                        `
          UPDATE ${tabTableIdent}
          SET ${runtimeDeleteSetClause},
              ${ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''}
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE _tp_parent_id = $2
            AND ${runtimeRowCondition}
        `,
                        [ctx.userId, rowId]
                    )
                }
            }

            const nextRow = runtimeDeleteSetClause ? await loadRuntimeRowById(mgr, dataTableIdent, rowId, runtimeRowCondition) : null
            afterDeleteLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterDelete',
                    row: nextRow,
                    previousRow: sourceRow
                }
            }
        }

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                await performDelete(txManager)
            })
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterDeleteLifecycleRequest)
            return res.json({ status: 'deleted' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ RESTORE ROW (soft-delete reversal) ============
    const restoreRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeRestoreBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (!isSoftDeleteLifecycle(objectCollection.lifecycleContract)) {
            return res.status(409).json({
                error: 'Restore is not available for hard-delete runtime objects',
                code: 'RUNTIME_RECORD_RESTORE_UNSUPPORTED'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const deletedRowCondition = buildRuntimeDeletedRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const activeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeRestoreSetClause = buildRuntimeRestoreSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
        const tableAttrsForRestore = attrs.filter((a) => a.data_type === 'TABLE')
        let afterRestoreLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                const sourceValues: unknown[] = [rowId]
                const sourceAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: sourceValues,
                    minimumAccessLevel: 'edit'
                })
                const sourceWhereSql = ['id = $1', deletedRowCondition, sourceAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const sourceRows = (await txManager.query(
                    `
          SELECT *
          FROM ${dataTableIdent}
          WHERE ${sourceWhereSql}
          LIMIT 1
        `,
                    sourceValues
                )) as Array<Record<string, unknown>>
                const sourceRow = sourceRows[0]
                if (!sourceRow || !sourceRow.id) {
                    throw new UpdateFailure(404, {
                        error: 'Deleted row not found',
                        code: 'RUNTIME_RECORD_RESTORE_NOT_FOUND'
                    })
                }
                if (sourceRow._upl_locked) {
                    throw new UpdateFailure(423, {
                        error: 'Record is locked'
                    })
                }
                await assertNotProtectedSystemStructureRuntimeRow(txManager, ctx, applicationId, objectCollection.id, attrs, sourceRow)
                await assertInterpretationNetworkGenericCreateAllowed(txManager, ctx, applicationId, objectCollection.id)
                if (parsedBody.data.expectedVersion !== undefined) {
                    const actualVersion = Number(sourceRow._upl_version ?? 1)
                    if (actualVersion !== parsedBody.data.expectedVersion) {
                        throw createRuntimeVersionConflictFailure(parsedBody.data.expectedVersion, actualVersion)
                    }
                }
                assertRuntimeRecordMutable(objectCollection.config, sourceRow)

                const restoreTarget = parsedBody.data.restoreTarget
                let restoreTargetSetClause = ''
                const restoreParams: unknown[] = [ctx.userId, rowId]
                let expectedVersionParamIndex = 0
                if (parsedBody.data.expectedVersion !== undefined) {
                    restoreParams.push(parsedBody.data.expectedVersion)
                    expectedVersionParamIndex = restoreParams.length
                }

                if (restoreTarget?.mode === 'target') {
                    if (
                        ctx.currentWorkspaceId &&
                        restoreTarget.targetWorkspaceId &&
                        restoreTarget.targetWorkspaceId !== ctx.currentWorkspaceId
                    ) {
                        throw new UpdateFailure(403, {
                            error: 'Restore target belongs to a different workspace',
                            code: 'RUNTIME_RESTORE_TARGET_WORKSPACE_DENIED'
                        })
                    }

                    const targetCollectionResult = await resolveRuntimeObjectCollection(
                        txManager,
                        ctx.schemaIdent,
                        restoreTarget.targetObjectCollectionId
                    )
                    if (
                        !targetCollectionResult.objectCollection ||
                        targetCollectionResult.objectCollection.id !== restoreTarget.targetObjectCollectionId
                    ) {
                        throw new UpdateFailure(404, {
                            error: targetCollectionResult.error,
                            code: 'RUNTIME_RESTORE_TARGET_NOT_FOUND'
                        })
                    }

                    const targetTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(targetCollectionResult.objectCollection.table_name)}`
                    const targetActiveCondition = buildRuntimeActiveRowCondition(
                        targetCollectionResult.objectCollection.lifecycleContract,
                        targetCollectionResult.objectCollection.config,
                        undefined,
                        ctx.currentWorkspaceId
                    )
                    const targetValues: unknown[] = [restoreTarget.targetRecordId]
                    const targetAccessClause = await buildRuntimeRecordAccessClause({
                        manager: txManager,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        objectCodename: resolveRuntimeCodenameText(targetCollectionResult.objectCollection.codename),
                        attrs: targetCollectionResult.attrs,
                        config: targetCollectionResult.objectCollection.config,
                        outerRowIdSql: `${targetTableIdent}.id`,
                        values: targetValues,
                        minimumAccessLevel: 'edit'
                    })
                    const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
                        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                        .join(' AND ')
                    const targetRows = (await txManager.query(
                        `
          SELECT id
          FROM ${targetTableIdent}
          WHERE ${targetWhereSql}
          LIMIT 1
        `,
                        targetValues
                    )) as Array<{ id: string }>
                    if (!targetRows[0]?.id) {
                        throw new UpdateFailure(404, {
                            error: 'Restore target row not found',
                            code: 'RUNTIME_RESTORE_TARGET_ROW_NOT_FOUND'
                        })
                    }

                    if (restoreTarget.parentFieldCodename) {
                        const parentAttr = attrs.find(
                            (attr) =>
                                attr.column_name === restoreTarget.parentFieldCodename ||
                                resolveRuntimeCodenameText(attr.codename) === restoreTarget.parentFieldCodename
                        )
                        if (
                            !parentAttr ||
                            parentAttr.data_type !== 'REF' ||
                            parentAttr.target_object_id !== restoreTarget.targetObjectCollectionId
                        ) {
                            throw new UpdateFailure(400, {
                                error: 'Restore target parent field does not reference the target object',
                                code: 'RUNTIME_RESTORE_TARGET_FIELD_INVALID'
                            })
                        }
                        restoreParams.push(restoreTarget.targetRecordId)
                        restoreTargetSetClause = `,
              ${quoteIdentifier(parentAttr.column_name)} = $${restoreParams.length}`
                    }
                }

                if (restoreTarget?.mode !== 'target' || !restoreTarget.parentFieldCodename) {
                    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                        manager: txManager,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        objectConfig: objectCollection.config,
                        attrs,
                        row: sourceRow,
                        minimumAccessLevel: 'edit'
                    })
                    if (parentAccessValidationError) {
                        throw new UpdateFailure(404, {
                            error: parentAccessValidationError,
                            code: 'RUNTIME_RESTORE_ORIGINAL_PARENT_NOT_FOUND'
                        })
                    }
                }

                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    const limitState = await enforceObjectWorkspaceLimit(txManager, {
                        schemaName: ctx.schemaName,
                        objectId: objectCollection.id,
                        tableName: objectCollection.table_name,
                        workspaceId: ctx.currentWorkspaceId,
                        runtimeRowCondition: activeRowCondition
                    })

                    if (!limitState.canCreate) {
                        throw new UpdateFailure(409, {
                            error: 'Workspace object row limit reached',
                            code: 'WORKSPACE_LIMIT_REACHED',
                            details: limitState
                        })
                    }
                }

                await assertMarketingRuntimeRowCap({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    tableName: objectCollection.table_name,
                    runtimeRowCondition: activeRowCondition,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename)
                })

                const restoreAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: restoreParams,
                    minimumAccessLevel: 'edit'
                })
                const restoreWhereSql = ['id = $2', deletedRowCondition, 'COALESCE(_upl_locked, false) = false', restoreAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')

                // Restoring reactivates the stored values, so unique/pattern rules
                // must pass again: a soft-deleted row can be restored after its
                // key was legitimately reused by a newer record.
                const restoreTargetField = restoreTarget?.mode === 'target' ? restoreTarget.parentFieldCodename : undefined
                const restoreParentAttr = restoreTargetField
                    ? attrs.find(
                          (attr) =>
                              attr.column_name === restoreTargetField || resolveRuntimeCodenameText(attr.codename) === restoreTargetField
                      )
                    : undefined
                const restoredRowValues =
                    restoreParentAttr && restoreTarget?.mode === 'target'
                        ? { ...sourceRow, [restoreParentAttr.column_name]: restoreTarget.targetRecordId }
                        : sourceRow
                await assertRuntimeRecordRules({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    activeCondition: activeRowCondition,
                    attrs,
                    row: restoredRowValues,
                    excludeRowId: rowId
                })

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow: sourceRow,
                        metadata: { action: 'restore' }
                    }
                })

                const restored = (await txManager.query(
                    `
          UPDATE ${dataTableIdent}
          SET ${runtimeRestoreSetClause},
              ${restoreTargetSetClause ? `${restoreTargetSetClause.trim().replace(/^,/, '')},` : ''}
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE ${restoreWhereSql}
            ${buildRuntimeExpectedVersionPredicate(parsedBody.data.expectedVersion, expectedVersionParamIndex)}
          RETURNING id
        `,
                    restoreParams
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (restored.length === 0) {
                    if (parsedBody.data.expectedVersion !== undefined) {
                        throw createRuntimeVersionConflictFailure(parsedBody.data.expectedVersion)
                    }
                    throw new UpdateFailure(404, {
                        error: 'Deleted row not found',
                        code: 'RUNTIME_RECORD_RESTORE_NOT_FOUND'
                    })
                }

                for (const tAttr of tableAttrsForRestore) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await txManager.query(
                        `
          UPDATE ${tabTableIdent}
          SET ${runtimeRestoreSetClause},
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE _tp_parent_id = $2
            AND ${deletedRowCondition}
        `,
                        [ctx.userId, rowId]
                    )
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, activeRowCondition)
                afterRestoreLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow: sourceRow,
                        metadata: { action: 'restore' }
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterRestoreLifecycleRequest)
            return res.json({ status: 'restored' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    return { updateCell, bulkUpdateRow, createRow, copyRow, deleteRow, restoreRow }
}
