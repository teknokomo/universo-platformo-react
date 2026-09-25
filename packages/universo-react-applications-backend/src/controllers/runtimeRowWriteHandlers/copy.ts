import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { enforceObjectWorkspaceLimit } from '../../services/applicationWorkspaces'
import { assertRuntimeRecordMutable } from '../../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../../services/runtimeLifecycleDispatch'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    ensureRuntimePermission,
    formatRuntimeFieldLabel,
    getEnumPresentationMode,
    getRuntimeInputValue,
    getSetConstantConfig,
    getTableRowLimits,
    normalizeConfiguredRuntimeJsonValue,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    toRuntimeInputFormatErrorBody,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import { acquireRuntimeRecordRuleLock, assertRuntimeRecordRules } from '../../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import {
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeCopyBodySchema,
    type RuntimeObjectCollectionAttr
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
    assertInterpretationNetworkGenericCopyAllowed,
    assertInterpretationNetworkGenericCreateAllowed,
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause,
    hasRuntimeServerOwnedInput,
    readRuntimeCopyRelations,
    validateRuntimeAccessEntryMembership
} from '../runtimeRowSupport/access'
import { assertMarketingRuntimeRowCap, copyRuntimeConfiguredRelations, loadRuntimeRowById } from '../runtimeRowSupport/rows'

import { copyRuntimeChildTableRows } from './tableChildren'
import type { RuntimeRowWriteDeps, RuntimeWriteCopyRelationsConfig, RuntimeWriteResolvedObjectCollection } from './types'

export const buildCopyOverrideValues = async (params: {
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

export const buildPendingCopyState = async (params: {
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

export const loadLockedCopySourceRow = async (params: {
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

export const executeCopyRowTransaction = async (params: {
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

export const createCopyRowHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
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
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return

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
    return copyRow
}
