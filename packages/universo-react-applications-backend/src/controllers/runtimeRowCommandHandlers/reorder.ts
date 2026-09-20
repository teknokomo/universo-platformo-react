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
import { runtimeReorderBodySchema } from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection, resolveRuntimeObjectCollectionConfig } from '../runtimeRowSupport/objects'
import { resolveRuntimeReorderField } from '../runtimeRowSupport/list'
import { buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'

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
    return reorderRows
}
