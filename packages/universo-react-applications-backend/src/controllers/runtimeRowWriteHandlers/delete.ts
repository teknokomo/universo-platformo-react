import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
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
    buildRuntimeSoftDeleteSetClause,
    ensureRuntimePermission,
    isSoftDeleteLifecycle,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema
} from '../../shared/runtimeHelpers'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import { buildRuntimeExpectedVersionPredicate, runtimeCompensateCreateBodySchema } from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import { assertNotProtectedSystemStructureRuntimeRow, buildRuntimeRecordAccessClause } from '../runtimeRowSupport/access'
import { loadRuntimeRowById } from '../runtimeRowSupport/rows'

import type { RuntimeRowWriteDeps } from './types'

export const createDeleteRowHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
    const deleteRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const compensateCreate = req.method === 'POST' && req.path.endsWith('/compensate-create')
        const parsedCompensation = compensateCreate ? runtimeCompensateCreateBodySchema.safeParse(req.body ?? {}) : null
        if (parsedCompensation && !parsedCompensation.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedCompensation.error.flatten() })
        }
        const objectCollectionId = compensateCreate
            ? parsedCompensation?.data.objectCollectionId
            : typeof req.query.objectCollectionId === 'string'
            ? req.query.objectCollectionId
            : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })
        const expectedVersion = compensateCreate
            ? parsedCompensation?.data.expectedVersion
            : typeof req.query.expectedVersion === 'string' && req.query.expectedVersion.trim().length > 0
            ? Number(req.query.expectedVersion)
            : undefined
        if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion <= 0)) {
            return res.status(400).json({ error: 'Invalid expected version' })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        const canDeleteContent = ctx.permissions.deleteContent === true
        const canCompensateCreate =
            compensateCreate && expectedVersion === 1 && ctx.permissions.createContent === true && ctx.permissions.editContent === true
        if (!canDeleteContent && !canCompensateCreate) {
            if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')

        let afterDeleteLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performDelete = async (mgr: DbExecutor) => {
            const sourceValues: unknown[] = [rowId]
            const sourceAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
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
            let compensationSourceClause = ''
            if (canCompensateCreate) {
                sourceValues.push(ctx.userId)
                compensationSourceClause = `_upl_created_by = $${sourceValues.length}
                   AND COALESCE(_upl_version, 1) = 1
                   AND _upl_created_at >= NOW() - INTERVAL '10 minutes'`
            }
            const sourceWhereSql = ['id = $1', runtimeRowCondition, sourceAccessClause, compensationSourceClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const sourceRows = (await mgr.query(
                `
              SELECT *
              FROM ${dataTableIdent}
              WHERE ${sourceWhereSql}
              LIMIT 1
              FOR UPDATE
            `,
                sourceValues
            )) as Array<Record<string, unknown>>
            const sourceRow = sourceRows[0]
            if (!sourceRow || !sourceRow.id) {
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }
            if (sourceRow._upl_locked) {
                throw new UpdateFailure(423, {
                    error: 'Record is locked'
                })
            }
            await assertNotProtectedSystemStructureRuntimeRow(mgr, ctx, applicationId, objectCollection.id, attrs, sourceRow)
            if (expectedVersion !== undefined) {
                const actualVersion = Number(sourceRow._upl_version ?? 1)
                if (actualVersion !== expectedVersion) {
                    throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                }
            }
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeDelete',
                    previousRow: sourceRow
                }
            })

            const deleteParams: unknown[] = runtimeDeleteSetClause ? [ctx.userId, rowId] : [rowId]
            const deleteRowIdPlaceholder = runtimeDeleteSetClause ? '$2' : '$1'
            const deleteAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: deleteParams,
                minimumAccessLevel: 'edit'
            })
            let compensationDeleteClause = ''
            if (canCompensateCreate) {
                deleteParams.push(ctx.userId)
                compensationDeleteClause = `_upl_created_by = $${deleteParams.length}
                   AND COALESCE(_upl_version, 1) = 1
                   AND _upl_created_at >= NOW() - INTERVAL '10 minutes'`
            }
            if (expectedVersion !== undefined) {
                deleteParams.push(expectedVersion)
            }
            const deleteExpectedVersionPredicate = buildRuntimeExpectedVersionPredicate(expectedVersion, deleteParams.length)
            const deleteWhereSql = [
                `id = ${deleteRowIdPlaceholder}`,
                runtimeRowCondition,
                'COALESCE(_upl_locked, false) = false',
                deleteAccessClause,
                compensationDeleteClause
            ]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const deleted = runtimeDeleteSetClause
                ? ((await mgr.query(
                      `
              UPDATE ${dataTableIdent}
              SET ${runtimeDeleteSetClause},
                  ${ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''}
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE ${deleteWhereSql}
                ${deleteExpectedVersionPredicate}
              RETURNING id
            `,
                      deleteParams
                  )) as Array<{ id: string }>)
                : ((await mgr.query(
                      `
              DELETE FROM ${dataTableIdent}
              WHERE ${deleteWhereSql}
                ${deleteExpectedVersionPredicate}
              RETURNING id
            `,
                      deleteParams
                  )) as Array<{ id: string }>)

            if (deleted.length === 0) {
                if (expectedVersion !== undefined) {
                    throw createRuntimeVersionConflictFailure(expectedVersion)
                }
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }

            if (runtimeDeleteSetClause) {
                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await mgr.query(
                        `
              UPDATE ${tabTableIdent}
              SET ${runtimeDeleteSetClause},
                  ${ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''}
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE _tp_parent_id = $2
                AND ${runtimeRowCondition}
            `,
                        [ctx.userId, rowId]
                    )
                }
            }

            const nextRow = runtimeDeleteSetClause ? await loadRuntimeRowById(mgr, dataTableIdent, rowId, runtimeRowCondition) : null
            afterDeleteLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterDelete',
                    row: nextRow,
                    previousRow: sourceRow
                }
            }
        }

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                await performDelete(txManager)
            })
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterDeleteLifecycleRequest)
            return res.json({ status: 'deleted' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }
    return deleteRow
}
