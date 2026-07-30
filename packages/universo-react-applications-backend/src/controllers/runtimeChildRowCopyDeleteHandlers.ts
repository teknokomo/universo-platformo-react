import type { Request, Response } from 'express'
import { z } from 'zod'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    buildRuntimeActiveRowCondition,
    buildRuntimeSoftDeleteSetClause,
    isSoftDeleteLifecycle,
    normalizeRuntimeTableChildInsertValueByMeta,
    getTableRowLimits,
    getTableRowCountError,
    toRuntimeInputFormatErrorBody,
    resolveTabularContext,
    resolveRuntimeSchema,
    ensureRuntimePermission,
    type RuntimeTableChildComponentMeta
} from '../shared/runtimeHelpers'
import { assertRuntimeRecordMutable } from '../services/runtimeRecordBehavior'
import { assertCanonicalMatrixChildMutation } from './runtimeChildRowsInterpretationNetworkGuard'
import {
    resolveHierarchyAttrs,
    validateTabularCoordinates,
    validateTabularHierarchy,
    isServerOwnedChildAttr
} from './runtimeChildRowsValidation'

const tabularDeleteQuerySchema = z
    .object({
        expectedVersion: z.coerce.number().int().positive().optional()
    })
    .strict()

export const createRuntimeChildRowCopyDeleteHandlers = (
    getDbExecutor: () => DbExecutor,
    query: ReturnType<typeof import('../shared/runtimeHelpers').createQueryHelper>
) => {
    const copyChildRow = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId, childRowId } = req.params
        if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
            return res.status(400).json({ error: 'Invalid ID format' })
        }
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        try {
            await assertCanonicalMatrixChildMutation(ctx, applicationId, tc, recordId, 'copy')
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }
        if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates === true) {
            return res.status(400).json({ error: 'Matrix coordinate rows cannot be copied without selecting new coordinates' })
        }
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )

        // FIX: replaced manual BEGIN/COMMIT/ROLLBACK with .transaction()
        try {
            const inserted = await ctx.manager.transaction(async (tx) => {
                const parentRows = (await tx.query(
                    `
                    SELECT *
            FROM ${tc.parentTableIdent}
            WHERE id = $1
              AND ${runtimeRowCondition}
            FOR UPDATE
          `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    throw new UpdateFailure(404, { error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Parent record is locked' })
                }
                assertRuntimeRecordMutable(tc.object.config, parentRows[0])

                const sourceRows = (await tx.query(
                    `
            SELECT *
            FROM ${tc.tabTableIdent}
            WHERE id = $1
              AND _tp_parent_id = $2
              AND ${runtimeRowCondition}
            LIMIT 1
          `,
                    [childRowId, recordId]
                )) as Array<Record<string, unknown>>

                if (sourceRows.length === 0) {
                    throw new UpdateFailure(404, { error: 'Child row not found' })
                }
                const sourceRow = sourceRows[0]
                const sourceSortOrder = typeof sourceRow._tp_sort_order === 'number' ? sourceRow._tp_sort_order : 0
                const hierarchyAttrs = resolveHierarchyAttrs(tc)
                const copiedHierarchyIdentity = hierarchyAttrs ? generateUuidV7() : null
                const sourceHierarchyParentValue = hierarchyAttrs ? sourceRow[hierarchyAttrs.parentAttr.column_name] ?? null : null

                const { minRows, maxRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                const countRows = (await tx.query(
                    `
            SELECT COUNT(*)::int AS cnt
            FROM ${tc.tabTableIdent}
            WHERE _tp_parent_id = $1
              AND ${runtimeRowCondition}
          `,
                    [recordId]
                )) as Array<{ cnt: number }>
                const activeCount = Number(countRows[0]?.cnt ?? 0)
                const maxRowsError = getTableRowCountError(activeCount + 1, tc.tableAttr.codename, {
                    minRows,
                    maxRows
                })
                if (maxRowsError && maxRows !== null) {
                    throw new UpdateFailure(400, { error: maxRowsError })
                }

                const sortShiftParams = hierarchyAttrs
                    ? [recordId, sourceSortOrder, sourceHierarchyParentValue]
                    : [recordId, sourceSortOrder]
                await tx.query(
                    `
            UPDATE ${tc.tabTableIdent}
            SET _tp_sort_order = _tp_sort_order + 1,
                _upl_updated_at = NOW(),
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE _tp_parent_id = $1
              AND ${runtimeRowCondition}
              AND _tp_sort_order > $2
              ${hierarchyAttrs ? `AND ${quoteIdentifier(hierarchyAttrs.parentAttr.column_name)} IS NOT DISTINCT FROM $3` : ''}
          `,
                    sortShiftParams
                )

                const childAttrsByColumn = new Map<string, RuntimeTableChildComponentMeta>(
                    tc.childAttrs
                        .filter(
                            (attr) =>
                                IDENTIFIER_REGEX.test(attr.column_name) &&
                                (!isServerOwnedChildAttr(attr) ||
                                    attr === hierarchyAttrs?.identityAttr ||
                                    attr === hierarchyAttrs?.parentAttr)
                        )
                        .map((attr) => [
                            attr.column_name,
                            {
                                column_name: attr.column_name,
                                data_type: attr.data_type,
                                validation_rules: attr.validation_rules
                            }
                        ])
                )
                const copyColumns = [...childAttrsByColumn.keys()]
                const headerColumns = [
                    '_tp_parent_id',
                    '_tp_sort_order',
                    ...(ctx.workspacesEnabled && ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
                    ...(ctx.userId ? ['_upl_created_by'] : [])
                ]
                const allColumns = [...headerColumns, ...copyColumns.map((column) => quoteIdentifier(column))]
                const copyValues: unknown[] = [recordId, sourceSortOrder + 1]
                const copyPlaceholders: string[] = ['$1', '$2']

                let paramIndex = 3
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    copyPlaceholders.push(`$${paramIndex++}`)
                    copyValues.push(ctx.currentWorkspaceId)
                }
                if (ctx.userId) {
                    copyPlaceholders.push(`$${paramIndex++}`)
                    copyValues.push(ctx.userId)
                }
                for (const column of copyColumns) {
                    copyPlaceholders.push(`$${paramIndex++}`)
                    const copyValue =
                        hierarchyAttrs && column === hierarchyAttrs.identityAttr.column_name
                            ? copiedHierarchyIdentity
                            : sourceRow[column] ?? null
                    copyValues.push(normalizeRuntimeTableChildInsertValueByMeta(copyValue, childAttrsByColumn.get(column)))
                }

                const copiedData = Object.fromEntries(
                    copyColumns.map((column, index) => [column, copyValues[headerColumns.length + index]])
                )
                await validateTabularCoordinates(tx, tc, recordId, runtimeRowCondition, [{ data: copiedData }])

                if (hierarchyAttrs && copiedHierarchyIdentity) {
                    await validateTabularHierarchy(tx, tc, recordId, runtimeRowCondition, [
                        {
                            data: {
                                [hierarchyAttrs.identityAttr.column_name]: copiedHierarchyIdentity,
                                [hierarchyAttrs.parentAttr.column_name]: sourceHierarchyParentValue
                            }
                        }
                    ])
                }

                const [row] = (await tx.query(
                    `INSERT INTO ${tc.tabTableIdent} (${allColumns.join(', ')}) VALUES (${copyPlaceholders.join(', ')}) RETURNING id`,
                    copyValues
                )) as Array<{ id: string }>

                if (!row?.id) {
                    throw new UpdateFailure(500, { error: 'Failed to copy child row' })
                }

                return row
            })

            return res.status(201).json({ id: inserted.id, status: 'created' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return res.status(400).json(formatError)
            throw e
        }
    }

    // ============ DELETE CHILD ROW ============
    const deleteChildRow = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId, childRowId } = req.params
        if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
            return res.status(400).json({ error: 'Invalid ID format' })
        }
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })
        const parsedDeleteQuery = tabularDeleteQuerySchema.safeParse({
            expectedVersion: req.query.expectedVersion
        })
        if (!parsedDeleteQuery.success) {
            return res.status(400).json({ error: 'expectedVersion must be a positive integer' })
        }
        const { expectedVersion } = parsedDeleteQuery.data

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        try {
            await assertCanonicalMatrixChildMutation(ctx, applicationId, tc, recordId, 'delete')
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(tc.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', tc.lifecycleContract, tc.object.config)
            : null

        // FIX: replaced manual BEGIN/COMMIT/ROLLBACK with .transaction()
        try {
            await ctx.manager.transaction(async (tx) => {
                const parentRows = (await tx.query(
                    `
                    SELECT *
            FROM ${tc.parentTableIdent}
            WHERE id = $1
              AND ${runtimeRowCondition}
            FOR UPDATE
          `,
                    [recordId]
                )) as Array<{ id: string; _upl_locked?: boolean }>

                if (parentRows.length === 0) {
                    throw new UpdateFailure(404, { error: 'Parent record not found' })
                }
                if (parentRows[0]._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Parent record is locked' })
                }
                assertRuntimeRecordMutable(tc.object.config, parentRows[0])

                const hierarchyAttrs = resolveHierarchyAttrs(tc)
                const childRows = (await tx.query(
                    `
            SELECT id, COALESCE(_upl_version, 1)::int AS version${
                hierarchyAttrs ? `, ${quoteIdentifier(hierarchyAttrs.identityAttr.column_name)} AS hierarchy_identity` : ''
            }
            FROM ${tc.tabTableIdent}
            WHERE id = $1
              AND _tp_parent_id = $2
              AND ${runtimeRowCondition}
            LIMIT 1
          `,
                    [childRowId, recordId]
                )) as Array<{ id: string; version: number; hierarchy_identity?: unknown }>

                if (childRows.length === 0) {
                    throw new UpdateFailure(404, { error: 'Child row not found' })
                }
                if (expectedVersion !== undefined && childRows[0].version !== expectedVersion) {
                    throw new UpdateFailure(409, {
                        error: 'Version conflict',
                        expectedVersion,
                        actualVersion: childRows[0].version
                    })
                }
                if (hierarchyAttrs) {
                    const hierarchyIdentity = childRows[0].hierarchy_identity
                    if (typeof hierarchyIdentity !== 'string' || !UUID_REGEX.test(hierarchyIdentity)) {
                        throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
                    }
                    const referencedChildren = (await tx.query(
                        `
              SELECT id
              FROM ${tc.tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
                AND ${quoteIdentifier(hierarchyAttrs.parentAttr.column_name)} = $2
              LIMIT 1
            `,
                        [recordId, hierarchyIdentity]
                    )) as Array<{ id: string }>
                    if (referencedChildren.length > 0) {
                        throw new UpdateFailure(409, { error: 'Hierarchy child rows must be moved or deleted first' })
                    }
                }

                const { minRows } = getTableRowLimits(tc.tableAttr.validation_rules)
                if (minRows !== null) {
                    const activeCountRows = (await tx.query(
                        `
              SELECT COUNT(*)::int AS cnt
              FROM ${tc.tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
            `,
                        [recordId]
                    )) as Array<{ cnt: number }>
                    const activeCount = Number(activeCountRows[0]?.cnt ?? 0)
                    const minRowsError = getTableRowCountError(activeCount - 1, tc.tableAttr.codename, {
                        minRows,
                        maxRows: null
                    })
                    if (minRowsError) {
                        throw new UpdateFailure(400, { error: minRowsError })
                    }
                }

                const deleteVersionClause = expectedVersion !== undefined ? 'AND COALESCE(_upl_version, 1) = $4' : ''
                const deleteParameters =
                    expectedVersion !== undefined ? [ctx.userId, childRowId, recordId, expectedVersion] : [ctx.userId, childRowId, recordId]
                const hardDeleteVersionClause = expectedVersion !== undefined ? 'AND COALESCE(_upl_version, 1) = $3' : ''
                const hardDeleteParameters =
                    expectedVersion !== undefined ? [childRowId, recordId, expectedVersion] : [childRowId, recordId]
                const deleted = runtimeDeleteSetClause
                    ? ((await tx.query(
                          `
                UPDATE ${tc.tabTableIdent}
                SET ${runtimeDeleteSetClause},
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $2
                  AND _tp_parent_id = $3
                  AND ${runtimeRowCondition}
                  ${deleteVersionClause}
                RETURNING id
              `,
                          deleteParameters
                      )) as Array<{ id: string }>)
                    : ((await tx.query(
                          `
                DELETE FROM ${tc.tabTableIdent}
                WHERE id = $1
                  AND _tp_parent_id = $2
                  AND ${runtimeRowCondition}
                  ${hardDeleteVersionClause}
                RETURNING id
              `,
                          hardDeleteParameters
                      )) as Array<{ id: string }>)

                if (deleted.length === 0) {
                    throw new UpdateFailure(expectedVersion !== undefined ? 409 : 404, {
                        error: expectedVersion !== undefined ? 'Version conflict' : 'Child row not found'
                    })
                }
            })

            return res.json({ status: 'deleted' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    return { copyChildRow, deleteChildRow }
}
