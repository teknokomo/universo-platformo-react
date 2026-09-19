import { acquireAdvisoryXactLock, withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'

import type { DbExecutor } from '@universo-react/utils'
import {
    isRuntimeRecordBehaviorEnabled,
    normalizeRuntimeRecordBehavior,
    RuntimeRecordCommandService
} from '../services/runtimeRecordBehavior'
import { RuntimePostingMovementService } from '../services/runtimePostingMovements'
import { applyWorkflowAction } from '../services/runtimeWorkflowActions'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../services/runtimeLifecycleDispatch'
import {
    ensureRuntimePermission,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeSoftDeleteSetClause,
    createQueryHelper,
    UUID_REGEX,
    type RuntimeSchemaContext
} from '../shared/runtimeHelpers'
import { createRuntimeVersionConflictFailure } from './runtimeVersionConflict'
import {
    runtimeContentProgressBodySchema,
    runtimeLibraryRelationActionBodySchema,
    runtimeLibraryRelationKeyParamSchema,
    runtimeRecordCommandBodySchema,
    runtimeReorderBodySchema,
    runtimeWorkflowActionBodySchema,
    runtimeWorkflowActionParamSchema,
    type RuntimeLibraryRelation,
    type RuntimeLibraryRelationKey,
    type RuntimeObjectCollectionAttr,
    type RuntimePostingMovementWriteResult,
    type RuntimeProgressStoreBinding,
    type RuntimeRelationBinding
} from './runtimeRowSupport/contracts'
import {
    loadRuntimeObjectAttrs,
    resolveRuntimeObjectByCodename,
    resolveRuntimeObjectCollection,
    resolveRuntimeObjectCollectionConfig,
    resolveRuntimeRecordOwnerColumnName
} from './runtimeRowSupport/objects'
import {
    buildWorkflowEnumStatusValueMap,
    ensureWorkflowEnumStatusesConfigured,
    readConfiguredWorkflowActions,
    resolveWorkflowStatusColumnName
} from './runtimeRowSupport/workflow'
import {
    applyRuntimeProgressParentAggregations,
    assertRuntimeProgressSequenceAvailable,
    readRuntimeProgressAggregateParents,
    readRuntimeProgressNumber,
    readRuntimeProgressString,
    resolveProgressStoreBinding
} from './runtimeRowSupport/progress'
import { resolveRuntimeReorderField } from './runtimeRowSupport/list'
import {
    buildRuntimeRecordAccessClause,
    loadRuntimeRowByIdWithRecordAccess,
    readRuntimeLibraryConfig,
    resolveRuntimeRelationBinding,
    validateRuntimeSharedRelationPrincipal
} from './runtimeRowSupport/access'

/**
 * Runtime row command handlers: record state commands (post/unpost/void),
 * workflow actions, learning-content progress, library relations and manual
 * reordering. Extracted from `runtimeRowsController`; shared helpers live in `./runtimeRowSupport/*`
 * and are referenced at request time.
 */
export interface RuntimeRowCommandHandlerContext {
    getDbExecutor: () => DbExecutor
}

type RuntimeCommandGuardFailure = { statusCode: number; body: Record<string, unknown> }

type RuntimeProgressTarget = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectByCodename>>>

type RuntimeResolvedObjectCollection = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectCollection>>['objectCollection']>

type RuntimeProgressQuotedColumns = {
    targetObjectCodename: string
    targetRecordId: string
    userId: string
    status: string
    progressPercent: string
    startedAt: string
    completedAt: string
    lastViewedAt: string
}

type RuntimeLibraryRelationColumns = {
    targetObjectColumn: string
    targetRecordColumn: string
    actorColumn: string | null
    principalTypeColumn: string | null
    principalIdColumn: string | null
    accessLevelColumn: string | null
    timestampColumn: string | null
}

const ensureRuntimeProgressTargetAccessible = async (params: {
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

const updateExistingRuntimeProgressRow = async (params: {
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

const insertRuntimeProgressRow = async (params: {
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

const resolveLibraryRelationRequest = (params: {
    objectConfig: Record<string, unknown> | null | undefined
    relationKey: RuntimeLibraryRelationKey
    hasPrincipalInput: boolean
}): { relation: RuntimeLibraryRelation; isSharedRelation: boolean } | { failure: RuntimeCommandGuardFailure } => {
    const isSharedRelation = params.relationKey === 'shared'
    if (!isSharedRelation && params.hasPrincipalInput) {
        return {
            failure: { statusCode: 400, body: { error: 'Runtime library principal target is only supported for shared relations' } }
        }
    }

    const libraryConfig = readRuntimeLibraryConfig(params.objectConfig)
    const relation = libraryConfig?.[params.relationKey]
    if (!relation) {
        return { failure: { statusCode: 409, body: { error: 'Runtime library relation is not configured for this object' } } }
    }
    if (!isSharedRelation && !relation.actorFieldCodename) {
        return { failure: { statusCode: 409, body: { error: 'Runtime library relation is not configured for this object' } } }
    }
    if (
        isSharedRelation &&
        (!relation.principalTypeFieldCodename ||
            !relation.principalIdFieldCodename ||
            (relation.accessLevelFieldCodename && !relation.defaultAccessLevel))
    ) {
        return { failure: { statusCode: 409, body: { error: 'Runtime library relation is not configured for this object' } } }
    }

    return { relation, isSharedRelation }
}

const resolveLibraryRelationBindingForRequest = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    relation: RuntimeLibraryRelation
    isSharedRelation: boolean
}): Promise<{ binding: RuntimeRelationBinding } | { failure: RuntimeCommandGuardFailure }> => {
    const binding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation: params.relation
    })
    if (!binding || (!params.isSharedRelation && !binding.actorColumnName)) {
        return { failure: { statusCode: 409, body: { error: 'Runtime library relation is not configured for this object' } } }
    }
    if (params.isSharedRelation && (!binding.principalTypeColumnName || !binding.principalIdColumnName)) {
        return { failure: { statusCode: 409, body: { error: 'Runtime library relation is not configured for this object' } } }
    }

    return { binding }
}

const loadLibraryRelationSourceRow = async (params: {
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    binding: RuntimeRelationBinding
    objectCodename: string
    rowId: string
    isSharedRelation: boolean
    sharedPrincipalType: 'workspaceMember' | 'user' | null
    sharedPrincipalId: string | null
    hasExplicitSharedPrincipal: boolean
}): Promise<{ sourceRow: { id: string; owner_user_id?: string | null } } | { failure: RuntimeCommandGuardFailure }> => {
    const sourceTableIdent = `${params.ctx.schemaIdent}.${quoteIdentifier(params.objectCollection.table_name)}`
    const sourceValues: unknown[] = [params.rowId]
    const sourceActiveCondition = buildRuntimeActiveRowCondition(
        params.objectCollection.lifecycleContract,
        params.objectCollection.config,
        'src',
        params.ctx.currentWorkspaceId
    )
    const sharedOwnerColumnName =
        params.isSharedRelation && !params.ctx.permissions.editContent
            ? resolveRuntimeRecordOwnerColumnName(params.attrs, params.objectCollection.config)
            : null
    if (params.isSharedRelation && !params.ctx.permissions.editContent && !sharedOwnerColumnName) {
        return {
            failure: { statusCode: 403, body: { error: 'Runtime library shared relation requires content owner or editor access' } }
        }
    }
    const recordAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.ctx.manager,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: params.objectCodename,
        attrs: params.attrs,
        config: params.objectCollection.config,
        outerRowIdSql: 'src.id',
        values: sourceValues,
        minimumAccessLevel: params.isSharedRelation ? 'edit' : 'read'
    })
    const sourceWhereSql = ['src.id = $1', sourceActiveCondition, recordAccessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const sourceSelectSql = ['src.id', ...(sharedOwnerColumnName ? [`src.${quoteIdentifier(sharedOwnerColumnName)} AS owner_user_id`] : [])]
    const sourceRows = (await params.ctx.manager.query(
        `
  SELECT ${sourceSelectSql.join(', ')}
  FROM ${sourceTableIdent} src
  WHERE ${sourceWhereSql}
  LIMIT 1
`,
        sourceValues
    )) as Array<{ id: string; owner_user_id?: string | null }>
    if (!sourceRows[0]?.id) {
        return { failure: { statusCode: 404, body: { error: 'Runtime library target row was not found' } } }
    }
    if (params.isSharedRelation && !params.ctx.permissions.editContent && String(sourceRows[0].owner_user_id ?? '') !== params.ctx.userId) {
        return {
            failure: { statusCode: 403, body: { error: 'Runtime library shared relation requires content owner or editor access' } }
        }
    }
    if (params.isSharedRelation) {
        const sharedPrincipalError = await validateRuntimeSharedRelationPrincipal({
            manager: params.ctx.manager,
            applicationId: params.applicationId,
            schemaIdent: params.ctx.schemaIdent,
            currentWorkspaceId: params.ctx.currentWorkspaceId,
            binding: params.binding,
            principalType: params.sharedPrincipalType!,
            principalId: params.sharedPrincipalId!,
            explicitPrincipal: params.hasExplicitSharedPrincipal
        })
        if (sharedPrincipalError) {
            return { failure: { statusCode: 400, body: { error: sharedPrincipalError } } }
        }
    }

    return { sourceRow: sourceRows[0] }
}

const buildLibraryRelationMutationColumns = (binding: RuntimeRelationBinding): RuntimeLibraryRelationColumns => ({
    targetObjectColumn: quoteIdentifier(binding.targetObjectColumnName),
    targetRecordColumn: quoteIdentifier(binding.targetRecordColumnName),
    actorColumn: binding.actorColumnName ? quoteIdentifier(binding.actorColumnName) : null,
    principalTypeColumn: binding.principalTypeColumnName ? quoteIdentifier(binding.principalTypeColumnName) : null,
    principalIdColumn: binding.principalIdColumnName ? quoteIdentifier(binding.principalIdColumnName) : null,
    accessLevelColumn: binding.accessLevelColumnName ? quoteIdentifier(binding.accessLevelColumnName) : null,
    timestampColumn: binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
})

const buildLibraryRelationPredicates = (params: {
    columns: RuntimeLibraryRelationColumns
    objectCodename: string
    rowId: string
    isSharedRelation: boolean
    sharedPrincipalType: string | null
    sharedPrincipalId: string | null
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
}): { relationParams: unknown[]; relationWhereSql: string } => {
    const relationParams: unknown[] = params.isSharedRelation
        ? [params.objectCodename, params.rowId, params.sharedPrincipalType, params.sharedPrincipalId]
        : [params.objectCodename, params.rowId, params.userId]
    const relationPredicates = [
        `rel.${params.columns.targetObjectColumn}::text = $1::text`,
        `rel.${params.columns.targetRecordColumn}::text = $2::text`,
        params.isSharedRelation
            ? `rel.${params.columns.principalTypeColumn!}::text = $3::text AND rel.${params.columns.principalIdColumn!}::text = $4::text`
            : `rel.${params.columns.actorColumn!}::text = $3::text`
    ]
    if (params.workspacesEnabled && params.currentWorkspaceId) {
        relationParams.push(params.currentWorkspaceId)
        relationPredicates.push(`rel.workspace_id = $${relationParams.length}`)
    }
    const relationWhereSql = relationPredicates.join('\n            AND ')
    return { relationParams, relationWhereSql }
}

const updateExistingLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    activeRowId: string
    relationKey: RuntimeLibraryRelationKey
    isSharedRelation: boolean
    accessLevelColumn: string | null
    timestampColumn: string | null
    sharedAccessLevel: string
    refreshTimestampOnActive?: boolean
    userId: string
}): Promise<{ active: boolean; changed: boolean }> => {
    const { accessLevelColumn, timestampColumn } = params
    if (
        !(
            (params.relationKey === 'recent' && timestampColumn) ||
            (params.isSharedRelation && (accessLevelColumn || timestampColumn)) ||
            (params.refreshTimestampOnActive === true && timestampColumn)
        )
    ) {
        return { active: true, changed: false }
    }

    const updateAssignments = [
        ...(accessLevelColumn ? [`${accessLevelColumn} = $2`] : []),
        ...(timestampColumn ? [`${timestampColumn} = NOW()`] : []),
        `_upl_updated_at = NOW()`,
        `_upl_updated_by = $${accessLevelColumn ? 3 : 2}`,
        `_upl_version = COALESCE(_upl_version, 1) + 1`
    ]
    const updateValues = accessLevelColumn
        ? [params.activeRowId, params.sharedAccessLevel, params.userId]
        : [params.activeRowId, params.userId]
    const updatedRows = (await params.executor.query(
        `
    UPDATE ${params.binding.tableIdent} rel
    SET ${updateAssignments.join(',\n            ')}
    WHERE rel.id = $1
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
        updateValues
    )) as Array<{ id: string }>
    if (updatedRows.length === 0) {
        throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
    }
    return { active: true, changed: true }
}

const insertLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    columns: RuntimeLibraryRelationColumns
    objectCodename: string
    rowId: string
    isSharedRelation: boolean
    sharedPrincipalType: string | null
    sharedPrincipalId: string | null
    sharedAccessLevel: string
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
}): Promise<{ active: boolean; changed: boolean }> => {
    const [{ id }] = await params.executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    const insertColumns = params.isSharedRelation
        ? [
              'id',
              params.columns.targetObjectColumn,
              params.columns.targetRecordColumn,
              params.columns.principalTypeColumn!,
              params.columns.principalIdColumn!
          ]
        : ['id', params.columns.targetObjectColumn, params.columns.targetRecordColumn, params.columns.actorColumn!]
    const insertValues: unknown[] = params.isSharedRelation
        ? [id, params.objectCodename, params.rowId, params.sharedPrincipalType, params.sharedPrincipalId]
        : [id, params.objectCodename, params.rowId, params.userId]
    const insertPlaceholders = insertValues.map((_value, index) => `$${index + 1}`)

    if (params.columns.timestampColumn) {
        insertColumns.push(params.columns.timestampColumn)
        insertPlaceholders.push('NOW()')
    }
    if (params.isSharedRelation && params.columns.accessLevelColumn) {
        insertColumns.push(params.columns.accessLevelColumn)
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.sharedAccessLevel)
    }
    if (params.workspacesEnabled && params.currentWorkspaceId) {
        insertColumns.push('workspace_id')
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.currentWorkspaceId)
    }

    insertColumns.push('_upl_created_by', '_upl_updated_by')
    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
    insertValues.push(params.userId, params.userId)

    await params.executor.query(
        `
    INSERT INTO ${params.binding.tableIdent} (${insertColumns.join(', ')})
    VALUES (${insertPlaceholders.join(', ')})
  `,
        insertValues
    )
    return { active: true, changed: true }
}

const deactivateLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    relationWhereSql: string
    relationParams: unknown[]
    userId: string
}): Promise<{ active: boolean; changed: boolean }> => {
    if (params.binding.isSoftDelete) {
        const deletedByParam = `$${params.relationParams.length + 1}`
        const updatedRows = (await params.executor.query(
            `
    UPDATE ${params.binding.tableIdent} rel
    SET ${buildRuntimeSoftDeleteSetClause(deletedByParam, params.binding.lifecycleContract, params.binding.config)},
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE ${params.relationWhereSql}
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
            [...params.relationParams, params.userId]
        )) as Array<{ id: string }>
        if (updatedRows.length === 0) {
            throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
        }
    } else {
        const deletedRows = (await params.executor.query(
            `
    DELETE FROM ${params.binding.tableIdent} rel
    WHERE ${params.relationWhereSql}
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
            params.relationParams
        )) as Array<{ id: string }>
        if (deletedRows.length === 0) {
            throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
        }
    }

    return { active: false, changed: true }
}

const persistRuntimeActorLibraryRelation = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaIdent: string
    objectCollectionId: string
    objectCodename: string
    objectConfig: Record<string, unknown> | null | undefined
    relationKey: RuntimeLibraryRelationKey
    rowId: string
    userId: string
    currentWorkspaceId: string | null
    workspacesEnabled: boolean
    active: boolean
    refreshTimestampOnActive?: boolean
}): Promise<{ active: boolean; changed: boolean } | null> => {
    const libraryConfig = readRuntimeLibraryConfig(params.objectConfig)
    const relation = libraryConfig?.[params.relationKey]
    if (!relation?.actorFieldCodename) return null

    const binding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation
    })
    if (!binding?.actorColumnName) return null

    const targetObjectColumn = quoteIdentifier(binding.targetObjectColumnName)
    const targetRecordColumn = quoteIdentifier(binding.targetRecordColumnName)
    const actorColumn = quoteIdentifier(binding.actorColumnName)
    const timestampColumn = binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
    const relationWorkspaceClause = params.workspacesEnabled && params.currentWorkspaceId ? 'AND rel.workspace_id = $4' : ''
    const relationParams =
        params.workspacesEnabled && params.currentWorkspaceId
            ? [params.objectCodename, params.rowId, params.userId, params.currentWorkspaceId]
            : [params.objectCodename, params.rowId, params.userId]
    const relationWhereSql = `
        rel.${targetObjectColumn}::text = $1::text
        AND rel.${targetRecordColumn}::text = $2::text
        AND rel.${actorColumn}::text = $3::text
        ${relationWorkspaceClause}
    `
    const relationLockKey = `${params.applicationId}:${params.objectCollectionId}:${params.rowId}:${params.relationKey}:${params.userId}:${
        params.currentWorkspaceId ?? 'default'
    }`

    await acquireAdvisoryXactLock(params.manager, relationLockKey)
    const activeRows = (await params.manager.query(
        `
    SELECT rel.id
    FROM ${binding.tableIdent} rel
    WHERE ${relationWhereSql}
      AND ${binding.activeCondition}
    LIMIT 1
  `,
        relationParams
    )) as Array<{ id: string }>
    const activeRowId = activeRows[0]?.id
    const wasActive = Boolean(activeRowId)

    if (params.active) {
        if (wasActive && activeRowId) {
            return updateExistingLibraryRelationRow({
                executor: params.manager,
                binding,
                activeRowId,
                relationKey: params.relationKey,
                isSharedRelation: false,
                accessLevelColumn: null,
                timestampColumn,
                sharedAccessLevel: '',
                refreshTimestampOnActive: params.refreshTimestampOnActive,
                userId: params.userId
            })
        }

        return insertLibraryRelationRow({
            executor: params.manager,
            binding,
            columns: {
                targetObjectColumn,
                targetRecordColumn,
                actorColumn,
                principalTypeColumn: null,
                principalIdColumn: null,
                accessLevelColumn: null,
                timestampColumn
            },
            objectCodename: params.objectCodename,
            rowId: params.rowId,
            isSharedRelation: false,
            sharedPrincipalType: null,
            sharedPrincipalId: null,
            sharedAccessLevel: '',
            userId: params.userId,
            workspacesEnabled: params.workspacesEnabled,
            currentWorkspaceId: params.currentWorkspaceId
        })
    }

    if (!wasActive) {
        return { active: false, changed: false }
    }

    return deactivateLibraryRelationRow({
        executor: params.manager,
        binding,
        relationWhereSql,
        relationParams,
        userId: params.userId
    })
}

type RuntimeProgressAggregateParents = Extract<ReturnType<typeof readRuntimeProgressAggregateParents>, { invalid: false }>

const runRuntimeContentProgressRecalculation = async (params: {
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

const persistRuntimeContentProgress = async (params: {
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

export function createRuntimeRowCommandHandlers({ getDbExecutor }: RuntimeRowCommandHandlerContext) {
    const query = createQueryHelper(getDbExecutor)
    const recordCommandService = new RuntimeRecordCommandService()
    const postingMovementService = new RuntimePostingMovementService()

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

    const setLibraryRelation = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        const parsedRelationKey = runtimeLibraryRelationKeyParamSchema.safeParse(req.params.relationKey)
        if (!parsedRelationKey.success) {
            return res.status(404).json({ error: 'Runtime library relation action is not configured' })
        }
        if (!UUID_REGEX.test(rowId)) {
            return res.status(400).json({ error: 'Invalid row id' })
        }

        const parsedBody = runtimeLibraryRelationActionBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) {
            return res.status(401).json({ error: 'Runtime library actions require an authenticated user' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) {
            return res.status(404).json({ error: objectCollectionError })
        }

        const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
        const relationKey = parsedRelationKey.data
        const relationResult = resolveLibraryRelationRequest({
            objectConfig: objectCollection.config,
            relationKey,
            hasPrincipalInput: Boolean(parsedBody.data.principalType || parsedBody.data.principalId)
        })
        if ('failure' in relationResult) {
            return res.status(relationResult.failure.statusCode).json(relationResult.failure.body)
        }
        const { relation, isSharedRelation } = relationResult

        const bindingResult = await resolveLibraryRelationBindingForRequest({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            relation,
            isSharedRelation
        })
        if ('failure' in bindingResult) {
            return res.status(bindingResult.failure.statusCode).json(bindingResult.failure.body)
        }
        const { binding } = bindingResult

        const sharedPrincipalType = isSharedRelation ? parsedBody.data.principalType ?? 'user' : null
        const sharedPrincipalId = isSharedRelation ? parsedBody.data.principalId ?? ctx.userId : null
        const hasExplicitSharedPrincipal = Boolean(parsedBody.data.principalType && parsedBody.data.principalId)
        const sharedAccessLevel = relation.defaultAccessLevel ?? 'canView'

        const sourceResult = await loadLibraryRelationSourceRow({
            ctx,
            applicationId,
            objectCollection,
            attrs,
            binding,
            objectCodename,
            rowId,
            isSharedRelation,
            sharedPrincipalType,
            sharedPrincipalId,
            hasExplicitSharedPrincipal
        })
        if ('failure' in sourceResult) {
            return res.status(sourceResult.failure.statusCode).json(sourceResult.failure.body)
        }

        const columns = buildLibraryRelationMutationColumns(binding)
        const { relationParams, relationWhereSql } = buildLibraryRelationPredicates({
            columns,
            objectCodename,
            rowId,
            isSharedRelation,
            sharedPrincipalType,
            sharedPrincipalId,
            userId: ctx.userId,
            workspacesEnabled: ctx.workspacesEnabled,
            currentWorkspaceId: ctx.currentWorkspaceId
        })
        const relationLockPrincipal = isSharedRelation ? `${sharedPrincipalType}:${sharedPrincipalId}` : ctx.userId
        const relationLockKey = `${applicationId}:${objectCollection.id}:${rowId}:${relationKey}:${relationLockPrincipal}:${
            ctx.currentWorkspaceId ?? 'default'
        }`

        try {
            const result = await withTransactionSavepoint(ctx.manager, async (tx) => {
                await acquireAdvisoryXactLock(tx, relationLockKey)
                const activeRows = (await tx.query(
                    `
    SELECT rel.id
    FROM ${binding.tableIdent} rel
    WHERE ${relationWhereSql}
      AND ${binding.activeCondition}
    LIMIT 1
  `,
                    relationParams
                )) as Array<{ id: string }>
                const wasActive = Boolean(activeRows[0]?.id)

                if (parsedBody.data.active) {
                    if (wasActive) {
                        return updateExistingLibraryRelationRow({
                            executor: tx,
                            binding,
                            activeRowId: activeRows[0].id,
                            relationKey,
                            isSharedRelation,
                            accessLevelColumn: columns.accessLevelColumn,
                            timestampColumn: columns.timestampColumn,
                            sharedAccessLevel,
                            userId: ctx.userId
                        })
                    }

                    return insertLibraryRelationRow({
                        executor: tx,
                        binding,
                        columns,
                        objectCodename,
                        rowId,
                        isSharedRelation,
                        sharedPrincipalType,
                        sharedPrincipalId,
                        sharedAccessLevel,
                        userId: ctx.userId,
                        workspacesEnabled: ctx.workspacesEnabled,
                        currentWorkspaceId: ctx.currentWorkspaceId
                    })
                }

                if (!wasActive) {
                    return { active: false, changed: false }
                }

                return deactivateLibraryRelationRow({
                    executor: tx,
                    binding,
                    relationWhereSql,
                    relationParams,
                    userId: ctx.userId
                })
            })

            return res.json({ relationKey, ...result })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    const reorderRows = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedBody = runtimeReorderBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const { orderedRowIds, objectCollectionId: requestedObjectCollectionId, expectedVersionsByRowId } = parsedBody.data
        const orderedRowIdSet = new Set(orderedRowIds)
        if (orderedRowIdSet.size !== orderedRowIds.length) {
            return res.status(400).json({
                error: 'Runtime row reorder received duplicate row IDs',
                code: 'RUNTIME_REORDER_DUPLICATE_ROWS'
            })
        }
        const expectedVersionEntries = Object.entries(expectedVersionsByRowId ?? {})
        if (expectedVersionEntries.length > 0) {
            const missingVersionRows = orderedRowIds.filter((id) => expectedVersionsByRowId?.[id] === undefined)
            const extraVersionRows = expectedVersionEntries.map(([id]) => id).filter((id) => !orderedRowIdSet.has(id))
            if (missingVersionRows.length > 0 || extraVersionRows.length > 0) {
                return res.status(409).json({
                    error: 'Runtime row reorder expected-version map must match ordered rows',
                    code: 'RUNTIME_REORDER_VERSION_MAP_MISMATCH',
                    details: { missingVersionRows, extraVersionRows }
                })
            }
        }
        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) {
            return res.status(404).json({ error: objectCollectionError })
        }

        const { runtimeConfig } = await resolveRuntimeObjectCollectionConfig({
            manager: ctx.manager,
            applicationId,
            userId: ctx.userId,
            role: ctx.role,
            workspaceId: ctx.currentWorkspaceId,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(attrs, runtimeConfig.reorderPersistenceField)

        if (!runtimeConfig.enableRowReordering || !reorderFieldAttr) {
            return res.status(409).json({ error: 'Persisted row reordering is not enabled for this object' })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        try {
            await withTransactionSavepoint(ctx.manager, async (tx) => {
                const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
                const countValues: unknown[] = []
                const countAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: countValues,
                    minimumAccessLevel: 'edit'
                })
                const countWhereSql = [runtimeRowCondition, countAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const [{ total }] = (await tx.query(
                    `
    SELECT COUNT(*)::int AS total
    FROM ${dataTableIdent}
    WHERE ${countWhereSql}
  `,
                    countValues
                )) as Array<{ total: number }>

                if (total !== orderedRowIds.length) {
                    throw new UpdateFailure(409, {
                        error: 'Persisted row reordering requires the complete loaded dataset',
                        details: { total, received: orderedRowIds.length }
                    })
                }

                const matchValues: unknown[] = [orderedRowIds]
                const matchAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: matchValues,
                    minimumAccessLevel: 'edit'
                })
                const matchWhereSql = [`id = ANY($1::uuid[])`, runtimeRowCondition, matchAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const matchedRows = (await tx.query(
                    `
    SELECT id, _upl_version, _upl_locked
    FROM ${dataTableIdent}
    WHERE ${matchWhereSql}
    FOR UPDATE
  `,
                    matchValues
                )) as Array<{ id: string; _upl_version?: number | string | null; _upl_locked?: boolean | null }>

                if (matchedRows.length !== orderedRowIds.length) {
                    throw new UpdateFailure(404, { error: 'One or more rows could not be reordered' })
                }
                if (matchedRows.some((row) => row._upl_locked === true)) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }

                if (expectedVersionEntries.length > 0) {
                    for (const row of matchedRows) {
                        const expectedVersion = expectedVersionsByRowId?.[row.id]
                        if (expectedVersion === undefined) continue
                        const actualVersion = Number(row._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                        }
                    }
                }

                const valuesSql = orderedRowIds.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::numeric)`).join(', ')
                const parameters = orderedRowIds.flatMap((rowId, index) => [rowId, index])
                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: 'target.id',
                    values: parameters,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = [
                    'target.id = incoming.id',
                    runtimeRowCondition,
                    'COALESCE(target._upl_locked, false) = false',
                    updateAccessClause
                ]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const seedOwnershipClause = ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''

                const updatedRows = await tx.query<{ id: string }>(
                    `
    WITH incoming(id, sort_order) AS (
      VALUES ${valuesSql}
    )
    UPDATE ${dataTableIdent} AS target
    SET ${quoteIdentifier(reorderFieldAttr.column_name)} = incoming.sort_order,
        ${seedOwnershipClause}
        _upl_updated_at = NOW(),
        _upl_updated_by = $${parameters.length + 1},
        _upl_version = COALESCE(target._upl_version, 1) + 1
    FROM incoming
    WHERE ${updateWhereSql}
    RETURNING target.id
  `,
                    [...parameters, ctx.userId]
                )
                if (updatedRows.length !== orderedRowIds.length) {
                    throw new UpdateFailure(409, {
                        error: 'One or more rows could not be reordered',
                        code: 'RUNTIME_REORDER_UPDATE_CONFLICT',
                        details: { updated: updatedRows.length, received: orderedRowIds.length }
                    })
                }
            })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }

        return res.json({ status: 'reordered' })
    }

    return {
        runRecordStateCommand,
        postRow,
        unpostRow,
        voidRow,
        runWorkflowAction,
        updateContentProgress,
        setLibraryRelation,
        reorderRows
    }
}
