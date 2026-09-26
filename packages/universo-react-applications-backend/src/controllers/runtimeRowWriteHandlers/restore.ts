import type { Request, Response } from 'express'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
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
    buildRuntimeDeletedRowCondition,
    buildRuntimeRestoreSetClause,
    ensureRuntimePermission,
    isSoftDeleteLifecycle,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema
} from '../../shared/runtimeHelpers'
import { assertRuntimeRecordRules } from '../../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import { buildRuntimeExpectedVersionPredicate, runtimeRestoreBodySchema } from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation, assertRuntimeEntityMutationAllowed } from '../../shared/entityMutationPolicy'
import { validateRuntimeParentRecordAccessReferences } from '../runtimeRowSupport/validation'
import {
    assertInterpretationNetworkGenericCreateAllowed,
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause
} from '../runtimeRowSupport/access'
import { assertMarketingRuntimeRowCap, loadRuntimeRowById } from '../runtimeRowSupport/rows'

import type { RuntimeRowWriteDeps } from './types'

export const createRestoreRowHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
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
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
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
                    assertRuntimeEntityMutationAllowed(targetCollectionResult.objectCollection.config)

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
    return restoreRow
}
