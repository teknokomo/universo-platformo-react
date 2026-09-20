import { withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { isRuntimeRecordBehaviorEnabled, normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../../services/runtimeLifecycleDispatch'
import {
    ensureRuntimePermission,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    UUID_REGEX
} from '../../shared/runtimeHelpers'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import { runtimeRecordCommandBodySchema, type RuntimePostingMovementWriteResult } from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'

import type { RuntimeRowCommandHandlerDeps } from './types'

export const createRecordStateCommandHandlers = ({
    getDbExecutor,
    query,
    recordCommandService,
    postingMovementService
}: RuntimeRowCommandHandlerDeps) => {
    const resolveRecordCommandEventPrefix = (command: 'post' | 'unpost' | 'void'): 'Post' | 'Unpost' | 'Void' => {
        if (command === 'post') return 'Post'
        if (command === 'unpost') return 'Unpost'
        return 'Void'
    }
    const runPostingMovementWrites = async (params: {
        command: 'post' | 'unpost' | 'void'
        executor: DbExecutor
        schemaName: string
        registrarKind: string
        behavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
        currentWorkspaceId: string | null
        currentUserId: string
        beforeLifecycleResults: unknown[]
        storedMovements: unknown
    }): Promise<RuntimePostingMovementWriteResult> => {
        if (params.command === 'post') {
            return {
                postingMovements: await postingMovementService.appendMovements({
                    executor: params.executor,
                    schemaName: params.schemaName,
                    registrarKind: params.registrarKind,
                    behavior: params.behavior,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    results: params.beforeLifecycleResults
                }),
                postingReversals: []
            }
        }

        return {
            postingMovements: [],
            postingReversals: await postingMovementService.reversePostedMovements({
                executor: params.executor,
                schemaName: params.schemaName,
                registrarKind: params.registrarKind,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                storedMovements: params.storedMovements
            })
        }
    }
    const buildRecordCommandResponse = (
        command: 'post' | 'unpost' | 'void',
        row: Record<string, unknown>,
        movementResult: RuntimePostingMovementWriteResult
    ): Record<string, unknown> => ({
        id: String(row.id),
        status: command === 'post' ? 'posted' : command === 'unpost' ? 'unposted' : 'voided',
        recordState: row._app_record_state ?? null,
        recordNumber: row._app_record_number ?? null,
        postedAt: row._app_posted_at ?? null,
        postingBatchId: row._app_posting_batch_id ?? null,
        postingMovements: movementResult.postingMovements,
        postingReversals: movementResult.postingReversals
    })
    const runRecordStateCommand = async (req: Request, res: Response, command: 'post' | 'unpost' | 'void') => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeRecordCommandBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const behavior = normalizeRuntimeRecordBehavior(objectCollection.config)
        if (!isRuntimeRecordBehaviorEnabled(behavior) || behavior.posting.mode === 'disabled') {
            return res.status(409).json({ error: 'Record posting is disabled for this record collection', code: 'POSTING_DISABLED' })
        }

        const registrarKind = typeof objectCollection.kind === 'string' ? objectCollection.kind.trim() : ''
        if (!registrarKind) {
            return res.status(409).json({
                error: 'Record posting registrar kind is not available',
                code: 'POSTING_REGISTRAR_KIND_UNAVAILABLE'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const eventPrefix = resolveRecordCommandEventPrefix(command)
        let afterLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null
        let responsePayload: Record<string, unknown> | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                const commandAccessValues: unknown[] = [rowId]
                const commandAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: commandAccessValues,
                    minimumAccessLevel: 'edit'
                })
                const commandWhereSql = ['id = $1', runtimeRowCondition, commandAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const rows = (await txManager.query(
                    `
            SELECT *
            FROM ${dataTableIdent}
            WHERE ${commandWhereSql}
            FOR UPDATE
            LIMIT 1
          `,
                    commandAccessValues
                )) as Array<Record<string, unknown>>
                const previousRow = rows[0]
                if (!previousRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                if (
                    parsedBody.data.expectedVersion !== undefined &&
                    Number(previousRow._upl_version ?? 1) !== parsedBody.data.expectedVersion
                ) {
                    throw createRuntimeVersionConflictFailure(parsedBody.data.expectedVersion, Number(previousRow._upl_version ?? 1))
                }

                recordCommandService.assertCommandAllowed(command, previousRow)

                const beforeLifecycleResults =
                    (await dispatchRuntimeLifecycle({
                        manager: txManager,
                        applicationId,
                        schemaName: ctx.schemaName,
                        objectCollection,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        payload: {
                            eventName: `before${eventPrefix}` as 'beforePost' | 'beforeUnpost' | 'beforeVoid',
                            previousRow,
                            metadata: { command }
                        }
                    })) ?? []

                const movementResult = await runPostingMovementWrites({
                    command,
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    registrarKind,
                    behavior,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    beforeLifecycleResults,
                    storedMovements: previousRow._app_posting_movements
                })

                const { setClauses, values } = await recordCommandService.buildUpdate({
                    command,
                    previousRow,
                    behavior,
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    objectId: objectCollection.id,
                    rowId,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId
                })

                if (command === 'post') {
                    values.push(JSON.stringify(movementResult.postingMovements))
                    setClauses.push(`_app_posting_movements = $${values.length}::jsonb`)
                } else {
                    setClauses.push('_app_posting_movements = NULL')
                }

                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = ['id = $1', runtimeRowCondition, 'COALESCE(_upl_locked, false) = false', updateAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const updatedRows = (await txManager.query(
                    `
            UPDATE ${dataTableIdent}
            SET ${setClauses.join(', ')}
            WHERE ${updateWhereSql}
            RETURNING *
          `,
                    values
                )) as Array<Record<string, unknown>>

                const nextRow = updatedRows[0]
                if (!nextRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                nextRow._app_posting_movements = movementResult.postingMovements
                nextRow._app_posting_reversals = movementResult.postingReversals

                afterLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: `after${eventPrefix}` as 'afterPost' | 'afterUnpost' | 'afterVoid',
                        row: nextRow,
                        previousRow,
                        metadata: { command }
                    }
                }
                responsePayload = buildRecordCommandResponse(command, nextRow, movementResult)
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterLifecycleRequest)
        return res.json(responsePayload ?? { id: rowId, status: command })
    }
    const postRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'post')
    const unpostRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'unpost')
    const voidRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'void')
    return { runRecordStateCommand, postRow, unpostRow, voidRow }
}
