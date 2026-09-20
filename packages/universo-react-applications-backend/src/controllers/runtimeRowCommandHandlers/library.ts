import { acquireAdvisoryXactLock, withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import {
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    UUID_REGEX,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import {
    runtimeLibraryRelationActionBodySchema,
    runtimeLibraryRelationKeyParamSchema,
    type RuntimeLibraryRelation,
    type RuntimeLibraryRelationKey,
    type RuntimeObjectCollectionAttr,
    type RuntimeRelationBinding
} from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection, resolveRuntimeRecordOwnerColumnName } from '../runtimeRowSupport/objects'
import {
    buildRuntimeRecordAccessClause,
    readRuntimeLibraryConfig,
    resolveRuntimeRelationBinding,
    validateRuntimeSharedRelationPrincipal
} from '../runtimeRowSupport/access'

import { deactivateLibraryRelationRow, insertLibraryRelationRow, updateExistingLibraryRelationRow } from './actorRelations'
import type {
    RuntimeCommandGuardFailure,
    RuntimeLibraryRelationColumns,
    RuntimeResolvedObjectCollection,
    RuntimeRowCommandHandlerDeps
} from './types'

export const resolveLibraryRelationRequest = (params: {
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

export const resolveLibraryRelationBindingForRequest = async (params: {
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

export const loadLibraryRelationSourceRow = async (params: {
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

export const buildLibraryRelationMutationColumns = (binding: RuntimeRelationBinding): RuntimeLibraryRelationColumns => ({
    targetObjectColumn: quoteIdentifier(binding.targetObjectColumnName),
    targetRecordColumn: quoteIdentifier(binding.targetRecordColumnName),
    actorColumn: binding.actorColumnName ? quoteIdentifier(binding.actorColumnName) : null,
    principalTypeColumn: binding.principalTypeColumnName ? quoteIdentifier(binding.principalTypeColumnName) : null,
    principalIdColumn: binding.principalIdColumnName ? quoteIdentifier(binding.principalIdColumnName) : null,
    accessLevelColumn: binding.accessLevelColumnName ? quoteIdentifier(binding.accessLevelColumnName) : null,
    timestampColumn: binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
})

export const buildLibraryRelationPredicates = (params: {
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

export const createLibraryRelationHandler = ({ getDbExecutor, query }: RuntimeRowCommandHandlerDeps) => {
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
    return setLibraryRelation
}
