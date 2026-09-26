import { acquireAdvisoryXactLock, withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import {
    quoteIdentifier,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import { runtimeContentProgressBodySchema, type RuntimeProgressStoreBinding } from '../runtimeRowSupport/contracts'
import { loadRuntimeObjectAttrs, resolveRuntimeObjectByCodename } from '../runtimeRowSupport/objects'
import {
    applyRuntimeProgressParentAggregations,
    assertRuntimeProgressSequenceAvailable,
    readRuntimeProgressAggregateParents,
    readRuntimeProgressNumber,
    readRuntimeProgressString,
    resolveProgressStoreBinding
} from '../runtimeRowSupport/progress'
import { buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'
import { assertRuntimeEntityMutationAllowed, denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'

import { persistRuntimeActorLibraryRelation } from './actorRelations'
import type { RuntimeCommandGuardFailure, RuntimeProgressQuotedColumns, RuntimeProgressTarget, RuntimeRowCommandHandlerDeps } from './types'

export const ensureRuntimeProgressTargetAccessible = async (params: {
    ctx: RuntimeSchemaContext
    targetObjectCodename: string
    targetRecordId: string
}): Promise<{ targetObject: RuntimeProgressTarget } | { failure: RuntimeCommandGuardFailure }> => {
    const targetObject = await resolveRuntimeObjectByCodename(params.ctx.manager, params.ctx.schemaIdent, params.targetObjectCodename, {
        includePages: true
    })
    if (!targetObject) {
        return { failure: { statusCode: 404, body: { error: 'Progress target object not found' } } }
    }
    try {
        assertRuntimeEntityMutationAllowed(targetObject.config)
    } catch (error) {
        if (error instanceof UpdateFailure) {
            return { failure: { statusCode: error.statusCode, body: error.body } }
        }
        throw error
    }

    if (targetObject.kind === 'page') {
        if (targetObject.id !== params.targetRecordId) {
            return { failure: { statusCode: 404, body: { error: 'Progress target row not found' } } }
        }
    } else {
        if (!targetObject.table_name) {
            return { failure: { statusCode: 404, body: { error: 'Progress target object not found' } } }
        }

        const targetTableIdent = `${params.ctx.schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
        const targetActiveCondition = buildRuntimeActiveRowCondition(
            targetObject.lifecycleContract,
            targetObject.config,
            undefined,
            params.ctx.currentWorkspaceId
        )
        const targetAttrs = await loadRuntimeObjectAttrs(params.ctx.manager, params.ctx.schemaIdent, targetObject.id)
        const targetValues: unknown[] = [params.targetRecordId]
        const targetAccessClause = await buildRuntimeRecordAccessClause({
            manager: params.ctx.manager,
            schemaIdent: params.ctx.schemaIdent,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            currentUserId: params.ctx.userId,
            permissions: params.ctx.permissions,
            objectCodename: params.targetObjectCodename,
            attrs: targetAttrs,
            config: targetObject.config,
            outerRowIdSql: `${targetTableIdent}.id`,
            values: targetValues
        })
        const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const targetRows = (await params.ctx.manager.query(
            `
      SELECT id
      FROM ${targetTableIdent}
      WHERE ${targetWhereSql}
      LIMIT 1
    `,
            targetValues
        )) as Array<{ id: string }>

        if (!targetRows[0]?.id) {
            return { failure: { statusCode: 404, body: { error: 'Progress target row not found' } } }
        }
    }

    return { targetObject }
}

export const updateExistingRuntimeProgressRow = async (params: {
    executor: DbExecutor
    binding: RuntimeProgressStoreBinding
    existingRow: { id: string; status?: unknown; progress_percent?: unknown }
    action: 'view' | 'complete'
    status: string
    progressPercent: number
    userId: string
    quotedColumns: RuntimeProgressQuotedColumns
}): Promise<{ progressPercent: number; status: string }> => {
    const { executor, binding, existingRow, action, status, progressPercent, userId, quotedColumns: q } = params

    if (action === 'complete') {
        const updatedRows = await executor.query<{ id: string }>(
            `
        UPDATE ${binding.tableIdent}
        SET ${q.status} = $2,
            ${q.progressPercent} = $3,
            ${q.lastViewedAt} = NOW(),
            ${q.startedAt} = COALESCE(${q.startedAt}, NOW()),
            ${q.completedAt} = CASE WHEN $3 >= 100 THEN COALESCE(${q.completedAt}, NOW()) ELSE ${q.completedAt} END,
            _upl_updated_at = NOW(),
            _upl_updated_by = $4,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
        RETURNING id
      `,
            [existingRow.id, status, progressPercent, userId]
        )
        if (!updatedRows[0]?.id) {
            throw new UpdateFailure(409, {
                error: 'Progress update did not affect a row',
                code: 'PROGRESS_UPDATE_CONFLICT'
            })
        }
        return { progressPercent, status }
    }

    const updatedRows = await executor.query<{ id: string }>(
        `
        UPDATE ${binding.tableIdent}
        SET ${q.lastViewedAt} = NOW(),
            ${q.startedAt} = COALESCE(${q.startedAt}, NOW()),
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
        RETURNING id
      `,
        [existingRow.id, userId]
    )
    if (!updatedRows[0]?.id) {
        throw new UpdateFailure(409, {
            error: 'Progress update did not affect a row',
            code: 'PROGRESS_UPDATE_CONFLICT'
        })
    }
    return {
        progressPercent: readRuntimeProgressNumber(existingRow.progress_percent) ?? progressPercent,
        status: readRuntimeProgressString(existingRow.status) ?? status
    }
}

export const insertRuntimeProgressRow = async (params: {
    executor: DbExecutor
    binding: RuntimeProgressStoreBinding
    quotedColumns: RuntimeProgressQuotedColumns
    targetObjectCodename: string
    targetRecordId: string
    userId: string
    status: string
    progressPercent: number
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
}): Promise<void> => {
    const { executor, binding, quotedColumns: q } = params
    const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    const insertColumns = [
        'id',
        q.targetObjectCodename,
        q.targetRecordId,
        q.userId,
        q.status,
        q.progressPercent,
        q.startedAt,
        q.completedAt,
        q.lastViewedAt
    ]
    const insertValues: unknown[] = [
        id,
        params.targetObjectCodename,
        params.targetRecordId,
        params.userId,
        params.status,
        params.progressPercent
    ]
    const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5', '$6', 'NOW()', 'CASE WHEN $6 >= 100 THEN NOW() ELSE NULL END', 'NOW()']

    if (params.workspacesEnabled && params.currentWorkspaceId) {
        insertColumns.push('workspace_id')
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.currentWorkspaceId)
    }

    insertColumns.push('_upl_created_by', '_upl_updated_by')
    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
    insertValues.push(params.userId, params.userId)

    const insertedRows = await executor.query<{ id: string }>(
        `
      INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      RETURNING id
    `,
        insertValues
    )
    if (!insertedRows[0]?.id) {
        throw new UpdateFailure(409, {
            error: 'Progress insert did not create a row',
            code: 'PROGRESS_INSERT_CONFLICT'
        })
    }
}

type RuntimeProgressAggregateParents = Extract<ReturnType<typeof readRuntimeProgressAggregateParents>, { invalid: false }>

export const runRuntimeContentProgressRecalculation = async (params: {
    ctx: RuntimeSchemaContext
    binding: RuntimeProgressStoreBinding
    targetObject: RuntimeProgressTarget
    targetObjectCodename: string
    targetRecordId: string
    aggregateConfig: RuntimeProgressAggregateParents
}): Promise<{ payload: Record<string, unknown> } | { failure: RuntimeCommandGuardFailure }> => {
    try {
        await withTransactionSavepoint(params.ctx.manager, async (tx) => {
            const aggregationFailure = await applyRuntimeProgressParentAggregations({
                manager: tx,
                schemaIdent: params.ctx.schemaIdent,
                currentWorkspaceId: params.ctx.currentWorkspaceId,
                workspacesEnabled: params.ctx.workspacesEnabled,
                userId: params.ctx.userId,
                binding: params.binding,
                targetObject: params.targetObject,
                targetObjectCodename: params.targetObjectCodename,
                targetRecordId: params.targetRecordId,
                aggregateParents: params.aggregateConfig.aggregateParents
            })
            if (aggregationFailure) throw aggregationFailure
        })
    } catch (e) {
        if (e instanceof UpdateFailure) {
            return { failure: { statusCode: e.statusCode, body: e.body } }
        }
        throw e
    }

    return {
        payload: {
            persisted: true,
            action: 'recalculate',
            targetObjectCodename: params.targetObjectCodename,
            targetRecordId: params.targetRecordId
        }
    }
}

export const persistRuntimeContentProgress = async (params: {
    ctx: RuntimeSchemaContext
    applicationId: string
    binding: RuntimeProgressStoreBinding
    targetObject: RuntimeProgressTarget
    targetObjectCodename: string
    targetRecordId: string
    action: 'view' | 'complete'
    status: string
    progressPercent: number
    quotedColumns: RuntimeProgressQuotedColumns
    activeWorkspaceClause: string
    existingParams: unknown[]
    aggregateConfig: RuntimeProgressAggregateParents | null
}): Promise<{ progressPercent: number; status: string }> => {
    const { ctx, binding, targetObject, targetObjectCodename, targetRecordId } = params
    let storedProgressPercent = params.progressPercent
    let storedStatus = params.status

    await withTransactionSavepoint(ctx.manager, async (tx) => {
        await acquireAdvisoryXactLock(
            tx,
            [
                ctx.schemaIdent,
                binding.tableIdent,
                targetObjectCodename,
                targetRecordId,
                ctx.userId,
                ctx.workspacesEnabled && ctx.currentWorkspaceId ? ctx.currentWorkspaceId : ''
            ].join(':')
        )
        const existingRows = (await tx.query<{ id: string; status?: unknown; progress_percent?: unknown }>(
            `
      SELECT id,
             ${params.quotedColumns.status} AS status,
             ${params.quotedColumns.progressPercent} AS progress_percent
      FROM ${binding.tableIdent}
      WHERE ${params.quotedColumns.targetObjectCodename} = $1
        AND ${params.quotedColumns.targetRecordId} = $2
        AND ${params.quotedColumns.userId} = $3
        ${params.activeWorkspaceClause}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
            params.existingParams
        )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

        if (existingRows[0]?.id) {
            const storedProgress = await updateExistingRuntimeProgressRow({
                executor: tx,
                binding,
                existingRow: existingRows[0],
                action: params.action,
                status: params.status,
                progressPercent: params.progressPercent,
                userId: ctx.userId,
                quotedColumns: params.quotedColumns
            })
            storedProgressPercent = storedProgress.progressPercent
            storedStatus = storedProgress.status
        } else {
            await insertRuntimeProgressRow({
                executor: tx,
                binding,
                quotedColumns: params.quotedColumns,
                targetObjectCodename,
                targetRecordId,
                userId: ctx.userId,
                status: params.status,
                progressPercent: params.progressPercent,
                workspacesEnabled: ctx.workspacesEnabled,
                currentWorkspaceId: ctx.currentWorkspaceId
            })
        }

        if (ctx.userId) {
            await persistRuntimeActorLibraryRelation({
                manager: tx,
                applicationId: params.applicationId,
                schemaIdent: ctx.schemaIdent,
                objectCollectionId: targetObject.id,
                objectCodename: targetObjectCodename,
                objectConfig: targetObject.config,
                relationKey: 'recent',
                rowId: targetRecordId,
                userId: ctx.userId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                workspacesEnabled: ctx.workspacesEnabled,
                active: true,
                refreshTimestampOnActive: true
            })
        }

        if (params.aggregateConfig && params.aggregateConfig.aggregateParents.length > 0) {
            const aggregationFailure = await applyRuntimeProgressParentAggregations({
                manager: tx,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                workspacesEnabled: ctx.workspacesEnabled,
                userId: ctx.userId,
                binding,
                targetObject,
                targetObjectCodename,
                targetRecordId,
                aggregateParents: params.aggregateConfig.aggregateParents
            })
            if (aggregationFailure) throw aggregationFailure
        }
    })

    return { progressPercent: storedProgressPercent, status: storedStatus }
}

export const createContentProgressHandler = ({ getDbExecutor, query }: RuntimeRowCommandHandlerDeps) => {
    const updateContentProgress = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedBody = runtimeContentProgressBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const targetResult = await ensureRuntimeProgressTargetAccessible({
            ctx,
            targetObjectCodename: parsedBody.data.targetObjectCodename,
            targetRecordId: parsedBody.data.targetRecordId
        })
        if ('failure' in targetResult) {
            return res.status(targetResult.failure.statusCode).json(targetResult.failure.body)
        }
        const targetObject = targetResult.targetObject

        const binding = await resolveProgressStoreBinding(ctx.manager, ctx.schemaIdent, ctx.applicationSettings)
        if (!binding) {
            return res.json({ persisted: false, reason: 'progress_store_unavailable' })
        }
        if (denyRuntimeEntityMutation(res, binding.config)) return

        if (parsedBody.data.action !== 'recalculate') {
            const sequenceFailure = await assertRuntimeProgressSequenceAvailable({
                manager: ctx.manager,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                workspacesEnabled: ctx.workspacesEnabled,
                userId: ctx.userId,
                binding,
                targetObject,
                targetObjectCodename: parsedBody.data.targetObjectCodename,
                targetRecordId: parsedBody.data.targetRecordId
            })
            if (sequenceFailure) {
                return res.status(sequenceFailure.statusCode).json(sequenceFailure.body)
            }
        }

        const aggregateConfig = readRuntimeProgressAggregateParents(targetObject.config)
        if (aggregateConfig?.invalid) {
            return res.status(409).json({
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }

        if (parsedBody.data.action === 'recalculate') {
            if (!aggregateConfig || aggregateConfig.aggregateParents.length === 0) {
                return res.status(409).json({
                    error: 'Progress recalculation is not configured for this target',
                    code: 'PROGRESS_RECALCULATION_UNAVAILABLE'
                })
            }

            const recalcResult = await runRuntimeContentProgressRecalculation({
                ctx,
                binding,
                targetObject,
                targetObjectCodename: parsedBody.data.targetObjectCodename,
                targetRecordId: parsedBody.data.targetRecordId,
                aggregateConfig
            })
            if ('failure' in recalcResult) {
                return res.status(recalcResult.failure.statusCode).json(recalcResult.failure.body)
            }

            return res.json(recalcResult.payload)
        }

        const progressAction = parsedBody.data.action
        const progressPercent = parsedBody.data.action === 'complete' ? 100 : 0
        const status = parsedBody.data.action === 'complete' ? 'completed' : 'inProgress'
        const q = {
            targetObjectCodename: quoteIdentifier(binding.columns.targetObjectCodename),
            targetRecordId: quoteIdentifier(binding.columns.targetRecordId),
            userId: quoteIdentifier(binding.columns.userId),
            status: quoteIdentifier(binding.columns.status),
            progressPercent: quoteIdentifier(binding.columns.progressPercent),
            startedAt: quoteIdentifier(binding.columns.startedAt),
            completedAt: quoteIdentifier(binding.columns.completedAt),
            lastViewedAt: quoteIdentifier(binding.columns.lastViewedAt)
        }

        const activeWorkspaceClause = ctx.workspacesEnabled && ctx.currentWorkspaceId ? 'AND workspace_id = $4' : ''
        const existingParams =
            ctx.workspacesEnabled && ctx.currentWorkspaceId
                ? [parsedBody.data.targetObjectCodename, parsedBody.data.targetRecordId, ctx.userId, ctx.currentWorkspaceId]
                : [parsedBody.data.targetObjectCodename, parsedBody.data.targetRecordId, ctx.userId]

        let storedProgress: { progressPercent: number; status: string }
        try {
            storedProgress = await persistRuntimeContentProgress({
                ctx,
                applicationId,
                binding,
                targetObject,
                targetObjectCodename: parsedBody.data.targetObjectCodename,
                targetRecordId: parsedBody.data.targetRecordId,
                action: progressAction,
                status,
                progressPercent,
                quotedColumns: q,
                activeWorkspaceClause,
                existingParams,
                aggregateConfig
            })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }

        return res.json({
            persisted: true,
            targetObjectCodename: parsedBody.data.targetObjectCodename,
            targetRecordId: parsedBody.data.targetRecordId,
            progressPercent: storedProgress.progressPercent,
            status: storedProgress.status
        })
    }
    return updateContentProgress
}
