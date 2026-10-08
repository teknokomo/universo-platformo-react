import { withTransactionSavepoint } from '@universo-react/utils/database'
import type { Request, Response } from 'express'
import {
    ensureRuntimePermission,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    UpdateFailure,
    buildRuntimeActiveRowCondition
} from '../../shared/runtimeHelpers'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import { isRuntimeObjectTargetKind, runtimeReorderBodySchema } from '../../services/runtimeRowSupport/contracts'
import {
    findRuntimeAttrByFieldKey,
    resolveRuntimeObjectCollection,
    resolveRuntimeObjectCollectionConfig
} from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    resolveRuntimeRelationOwnedFieldCodenames,
    resolveRuntimeRelationPanelAuthority,
    resolveRuntimeReorderField,
    resolveRuntimeRowReorderAuthority
} from '../../services/runtimeRowSupport/list'
import {
    lockRuntimeRelationParentRecord,
    resolveRuntimeRelationWriteScope,
    type ResolvedRuntimeRelationScope
} from '../runtimeRowSupport/relationScope'
import { buildRuntimeRecordAccessClause } from '../../services/runtimeRowSupport/access'
import { resolveRuntimeRecordReference } from '../../services/runtimeRecordHandle'

import type { RuntimeRowCommandHandlerDeps } from './types'

export const createReorderRowsHandler = ({ getDbExecutor, query }: RuntimeRowCommandHandlerDeps) => {
    const reorderRows = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedBody = runtimeReorderBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        let { orderedRowIds, expectedVersionsByRowId } = parsedBody.data
        const { objectCollectionId: requestedObjectCollectionId, parentScope } = parsedBody.data
        const orderedRowIdSet = new Set(orderedRowIds)
        if (orderedRowIdSet.size !== orderedRowIds.length) {
            return res.status(400).json({
                error: 'Runtime row reorder received duplicate row IDs',
                code: 'RUNTIME_REORDER_DUPLICATE_ROWS'
            })
        }
        const expectedVersionEntries = Object.entries(expectedVersionsByRowId ?? {})
        if (parentScope && expectedVersionEntries.length !== orderedRowIds.length) {
            return res.status(409).json({
                error: 'Relation reorder requires a version for every selected row',
                code: 'RUNTIME_REORDER_VERSION_MAP_REQUIRED'
            })
        }
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
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
        const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
        const resolvedRows = orderedRowIds.map((reference) => ({
            reference,
            resolved: resolveRuntimeRecordReference(reference, {
                applicationId,
                workspaceId: ctx.currentWorkspaceId,
                entityCodename: objectCodename
            })
        }))
        if (resolvedRows.some(({ resolved }) => !resolved)) {
            return res.status(404).json({ error: 'One or more reordered rows are unavailable', code: 'RUNTIME_REORDER_ROW_UNAVAILABLE' })
        }
        const resolvedRowIds = resolvedRows.map(({ resolved }) => resolved!.recordId)
        if (new Set(resolvedRowIds).size !== resolvedRowIds.length) {
            return res.status(400).json({
                error: 'Runtime row reorder received duplicate rows',
                code: 'RUNTIME_REORDER_DUPLICATE_ROWS'
            })
        }
        const sourceExpectedVersionsByRowId = expectedVersionsByRowId
        const nextExpectedVersionsByRowId =
            sourceExpectedVersionsByRowId === undefined
                ? undefined
                : Object.fromEntries(
                      resolvedRows.map(({ reference, resolved }) => [resolved!.recordId, sourceExpectedVersionsByRowId[reference]!])
                  )
        orderedRowIds = resolvedRowIds
        expectedVersionsByRowId = nextExpectedVersionsByRowId

        const { selectedLayout } = await resolveRuntimeObjectCollectionConfig({
            manager: ctx.manager,
            applicationId,
            userId: ctx.userId,
            role: ctx.role,
            workspaceId: ctx.currentWorkspaceId,
            objectCollectionId: objectCollection.id,
            objectCollectionCodename: objectCodename
        })
        const parentFieldAttr = parentScope ? findRuntimeAttrByFieldKey(attrs, parentScope.fieldCodename) : undefined

        if (
            parentScope &&
            (!parentFieldAttr ||
                parentFieldAttr.data_type !== 'REF' ||
                !parentFieldAttr.target_object_id ||
                !isRuntimeObjectTargetKind(parentFieldAttr.target_object_kind))
        ) {
            return res.status(409).json({
                error: 'The requested parent scope is not a valid Entity reference',
                code: 'RUNTIME_REORDER_PARENT_SCOPE_INVALID'
            })
        }

        const parentCollection = parentFieldAttr
            ? await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parentFieldAttr.target_object_id ?? undefined)
            : undefined
        if (
            parentScope &&
            (!parentCollection?.objectCollection || parentCollection.objectCollection.id !== parentFieldAttr?.target_object_id)
        ) {
            return res.status(409).json({
                error: 'The requested parent Entity is unavailable',
                code: 'RUNTIME_REORDER_PARENT_ENTITY_UNAVAILABLE'
            })
        }
        if (parentCollection?.objectCollection && denyRuntimeEntityMutation(res, parentCollection.objectCollection.config)) return

        const relationPanelAuthority =
            parentScope && parentCollection?.objectCollection
                ? resolveRuntimeRelationPanelAuthority(selectedLayout.zoneWidgets, {
                      parentFieldCodename: parentScope.fieldCodename,
                      parentEntityCodename: resolveRuntimeCodenameText(parentCollection.objectCollection.codename),
                      parentRecordId: parentScope.parentRecordId,
                      childEntityCodename: resolveRuntimeCodenameText(objectCollection.codename)
                  })
                : null
        const reorderAuthority = parentScope
            ? relationPanelAuthority?.enableRowReordering === true
                ? { enableRowReordering: true, reorderPersistenceField: relationPanelAuthority.sortOrderFieldCodename }
                : { enableRowReordering: false, reorderPersistenceField: null }
            : resolveRuntimeRowReorderAuthority(selectedLayout.zoneWidgets, resolveRuntimeCodenameText(objectCollection.codename))
        const reorderFieldAttr = resolveRuntimeReorderField(attrs, reorderAuthority.reorderPersistenceField)

        if (
            !parentScope &&
            reorderFieldAttr &&
            resolveRuntimeRelationOwnedFieldCodenames(
                selectedLayout.zoneWidgets,
                resolveRuntimeCodenameText(objectCollection.codename)
            ).some((fieldCodename) => findRuntimeAttrByFieldKey(attrs, fieldCodename)?.column_name === reorderFieldAttr.column_name)
        ) {
            return res.status(409).json({
                error: 'A verified relation scope is required to reorder these related records',
                code: 'RUNTIME_RELATION_SCOPE_REQUIRED'
            })
        }

        if (!reorderAuthority.enableRowReordering || !reorderFieldAttr) {
            return res.status(409).json({ error: 'Persisted row reordering is not enabled for this Entity relation' })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            'target',
            ctx.currentWorkspaceId
        )

        try {
            await withTransactionSavepoint(ctx.manager, async (tx) => {
                let transactionRelationScope: ResolvedRuntimeRelationScope | null = null

                if (parentScope) {
                    const { selectedLayout: transactionLayout } = await resolveRuntimeObjectCollectionConfig({
                        manager: tx,
                        applicationId,
                        userId: ctx.userId,
                        role: ctx.role,
                        workspaceId: ctx.currentWorkspaceId,
                        objectCollectionId: objectCollection.id,
                        objectCollectionCodename: objectCodename
                    })
                    transactionRelationScope = await resolveRuntimeRelationWriteScope({
                        manager: tx,
                        applicationId,
                        workspaceId: ctx.currentWorkspaceId,
                        schemaIdent: ctx.schemaIdent,
                        zoneWidgets: transactionLayout.zoneWidgets,
                        childEntity: objectCollection,
                        childAttrs: attrs,
                        request: parentScope
                    })
                    const transactionAuthority = transactionRelationScope
                        ? resolveRuntimeRelationPanelAuthority(transactionLayout.zoneWidgets, {
                              parentFieldCodename: parentScope.fieldCodename,
                              parentEntityCodename: resolveRuntimeCodenameText(transactionRelationScope.parentCollection.codename),
                              parentRecordId: parentScope.parentRecordId,
                              childEntityCodename: objectCodename
                          })
                        : null
                    const transactionReorderField = transactionAuthority
                        ? resolveRuntimeReorderField(attrs, transactionAuthority.sortOrderFieldCodename)
                        : null
                    if (
                        !transactionRelationScope ||
                        !transactionAuthority?.enableRowReordering ||
                        transactionReorderField?.column_name !== reorderFieldAttr.column_name
                    ) {
                        throw new UpdateFailure(409, {
                            error: 'The relation layout changed before reordering could be completed',
                            code: 'RUNTIME_RELATION_SCOPE_INVALID'
                        })
                    }
                    await lockRuntimeRelationParentRecord({ executor: tx, ctx, scope: transactionRelationScope })

                    const totalScopedRows = (await tx.query(
                        `
                        SELECT COUNT(*)::int AS total
                        FROM ${dataTableIdent} AS target
                        WHERE ${runtimeRowCondition}
                          AND target.${quoteIdentifier(transactionRelationScope.parentFieldAttr.column_name)} = $1
                        `,
                        [transactionRelationScope.request.parentRecordId]
                    )) as Array<{ total: number }>
                    const visibleScopeValues: unknown[] = []
                    const visibleScopeAccessClause = await buildRuntimeRecordAccessClause({
                        manager: tx,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        objectCodename,
                        attrs,
                        config: objectCollection.config,
                        outerRowIdSql: 'target.id',
                        values: visibleScopeValues,
                        minimumAccessLevel: 'edit'
                    })
                    visibleScopeValues.push(transactionRelationScope.request.parentRecordId)
                    const visibleScopedRows = (await tx.query(
                        `
                        SELECT COUNT(*)::int AS total
                        FROM ${dataTableIdent} AS target
                        WHERE ${runtimeRowCondition}
                          AND ${visibleScopeAccessClause ?? 'TRUE'}
                          AND target.${quoteIdentifier(transactionRelationScope.parentFieldAttr.column_name)} = $${
                            visibleScopeValues.length
                        }
                        `,
                        visibleScopeValues
                    )) as Array<{ total: number }>
                    if ((totalScopedRows[0]?.total ?? 0) !== (visibleScopedRows[0]?.total ?? 0)) {
                        throw new UpdateFailure(409, { error: 'Reordering requires access to every active row in this relation.' })
                    }
                }

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
                    outerRowIdSql: 'target.id',
                    values: countValues,
                    minimumAccessLevel: 'edit'
                })
                const parentCountClause =
                    parentScope && transactionRelationScope
                        ? (() => {
                              countValues.push(transactionRelationScope.request.parentRecordId)
                              return `target.${quoteIdentifier(transactionRelationScope.parentFieldAttr.column_name)} = $${
                                  countValues.length
                              }`
                          })()
                        : null
                const countWhereSql = [runtimeRowCondition, countAccessClause, parentCountClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const [{ total }] = (await tx.query(
                    `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent} AS target
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
                    outerRowIdSql: 'target.id',
                    values: matchValues,
                    minimumAccessLevel: 'edit'
                })
                const parentMatchClause =
                    parentScope && transactionRelationScope
                        ? (() => {
                              matchValues.push(transactionRelationScope.request.parentRecordId)
                              return `target.${quoteIdentifier(transactionRelationScope.parentFieldAttr.column_name)} = $${
                                  matchValues.length
                              }`
                          })()
                        : null
                const matchWhereSql = [`target.id = ANY($1::uuid[])`, runtimeRowCondition, matchAccessClause, parentMatchClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const matchedRows = (await tx.query(
                    `
        SELECT target.id, target._upl_version, target._upl_locked
        FROM ${dataTableIdent} AS target
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
                    updateAccessClause,
                    parentScope && transactionRelationScope
                        ? (() => {
                              parameters.push(transactionRelationScope.request.parentRecordId)
                              return `target.${quoteIdentifier(transactionRelationScope.parentFieldAttr.column_name)} = $${
                                  parameters.length
                              }`
                          })()
                        : null
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
    return reorderRows
}
