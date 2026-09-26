import { withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'
import { applyWorkflowAction } from '../../services/runtimeWorkflowActions'
import {
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    UUID_REGEX
} from '../../shared/runtimeHelpers'
import { runtimeWorkflowActionBodySchema, runtimeWorkflowActionParamSchema } from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    buildWorkflowEnumStatusValueMap,
    ensureWorkflowEnumStatusesConfigured,
    readConfiguredWorkflowActions,
    resolveWorkflowStatusColumnName
} from '../runtimeRowSupport/workflow'
import { loadRuntimeRowByIdWithRecordAccess } from '../runtimeRowSupport/access'

import type { RuntimeRowCommandHandlerDeps } from './types'

export const createWorkflowActionHandler = ({ getDbExecutor, query }: RuntimeRowCommandHandlerDeps) => {
    const runWorkflowAction = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedActionCodename = runtimeWorkflowActionParamSchema.safeParse(req.params.actionCodename)
        if (!parsedActionCodename.success) {
            return res.status(400).json({ error: 'Invalid workflow action codename' })
        }

        const parsedBody = runtimeWorkflowActionBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return

        const action = readConfiguredWorkflowActions(objectCollection.config).find(
            (candidate) => candidate.codename === parsedActionCodename.data
        )
        if (!action) {
            return res.status(404).json({
                error: 'Workflow action is not configured for this record collection',
                code: 'WORKFLOW_ACTION_NOT_CONFIGURED'
            })
        }
        const statusColumnName = resolveWorkflowStatusColumnName(action, attrs)
        if (!statusColumnName) {
            return res.status(400).json({
                error: 'Workflow action status field is not configured for this record collection',
                code: 'WORKFLOW_STATUS_FIELD_NOT_CONFIGURED'
            })
        }
        const statusAttr = attrs.find((attr) => attr.column_name === statusColumnName)

        try {
            const result = await withTransactionSavepoint(ctx.manager, async (txManager) => {
                const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
                const runtimeRowCondition = buildRuntimeActiveRowCondition(
                    objectCollection.lifecycleContract,
                    objectCollection.config,
                    undefined,
                    ctx.currentWorkspaceId
                )
                const accessibleRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!accessibleRow?.id) {
                    throw new UpdateFailure(404, { error: 'Workflow action row not found', code: 'WORKFLOW_ROW_NOT_FOUND' })
                }

                const statusValueMap = await buildWorkflowEnumStatusValueMap(txManager, ctx.schemaIdent, statusAttr)
                ensureWorkflowEnumStatusesConfigured(action, statusValueMap)

                return applyWorkflowAction({
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    tableName: objectCollection.table_name,
                    objectId: objectCollection.id,
                    rowId,
                    action,
                    capabilities: ctx.workflowCapabilities,
                    userId: ctx.userId,
                    statusColumnName,
                    statusValueMap,
                    expectedVersion: parsedBody.data.expectedVersion,
                    workspaceId: ctx.currentWorkspaceId,
                    hasWorkspaceColumn: ctx.workspacesEnabled,
                    auditMetadata: {
                        source: 'runtime.rows.workflowAction',
                        applicationId
                    }
                })
            })

            return res.json(result)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }
    return runWorkflowAction
}
