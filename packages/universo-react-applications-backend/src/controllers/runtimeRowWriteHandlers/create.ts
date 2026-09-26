import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { enforceObjectWorkspaceLimit } from '../../services/applicationWorkspaces'
import { normalizeRuntimeRecordBehavior, RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../../services/runtimeLifecycleDispatch'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
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
import {
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeCreateBodySchema,
    type RuntimeObjectCollectionAttr,
    isRuntimeServerOwnedAttr
} from '../runtimeRowSupport/contracts'
import { getNextRuntimeSortValue, resolveRuntimeObjectCollection, resolveRuntimeObjectCollectionConfig } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    applyRuntimeDateOffsetDerivations,
    validateRuntimeDateOrderRules,
    validateRuntimeParentRecordAccessReferences,
    validateRuntimeRecordPickerReferences,
    validateRuntimeRequiredWhenRules
} from '../runtimeRowSupport/validation'
import { resolveRuntimeReorderField } from '../runtimeRowSupport/list'
import {
    assertInterpretationNetworkGenericCreateAllowed,
    hasRuntimeServerOwnedInput,
    validateRuntimeAccessEntryMembership
} from '../runtimeRowSupport/access'
import { assertMarketingRuntimeRowCap, collectTouchedComponentIds, loadRuntimeRowById } from '../runtimeRowSupport/rows'

import { insertRuntimeChildRowsBatch } from './tableChildren'
import type {
    RuntimeRowWriteDeps,
    RuntimeTableChildAttrRow,
    RuntimeWriteColumnValue,
    RuntimeWriteResolvedObjectCollection,
    RuntimeWriteTableDataEntryWithAttr
} from './types'

export const buildCreateScalarColumnValues = async (params: {
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

export const validateCreatePendingRow = async (params: {
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

export const applyCreateReorderField = async (params: {
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

export const prepareCreateTableChildRows = async (params: {
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

export const buildCreateTableEntries = async (params: {
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

export const executeCreateRowTransaction = async (params: {
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

export const createCreateRowHandler = ({ getDbExecutor, query, recordCommandService }: RuntimeRowWriteDeps) => {
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
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
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
    return createRow
}
