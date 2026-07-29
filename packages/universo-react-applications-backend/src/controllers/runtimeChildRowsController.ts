import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    formatRuntimeFieldPath,
    getRuntimeInputValue,
    pgNumericToNumber,
    buildRuntimeActiveRowCondition,
    coerceRuntimeValue,
    toRuntimeInputFormatErrorBody,
    getTableRowLimits,
    getTableRowCountError,
    getEnumPresentationMode,
    getDefaultEnumValueId,
    getSetConstantConfig,
    resolveRefId,
    ensureEnumerationValueBelongsToTarget,
    createQueryHelper,
    resolveTabularContext,
    resolveRuntimeSchema,
    ensureRuntimePermission
} from '../shared/runtimeHelpers'
import {
    assertAllowedUniformTabularUpdates,
    assertNoClientSuppliedServerOwnedChildFields,
    assertNoGenericMatrixPlacement,
    buildChildRowUpdate,
    prepareHierarchyCreateData,
    validateTabularCoordinates,
    validateTabularHierarchy
} from './runtimeChildRowsValidation'
import { createRuntimeChildRowCopyDeleteHandlers } from './runtimeChildRowCopyDeleteHandlers'
import { assertRuntimeRecordMutable } from '../services/runtimeRecordBehavior'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const tabularUpdateBodySchema = z
    .object({
        data: z.record(z.unknown()).optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .passthrough()

const tabularCreateBodySchema = z
    .object({
        data: z.record(z.unknown())
    })
    .strict()

const tabularBatchUpdateBodySchema = z
    .object({
        updates: z
            .array(
                z.object({
                    childRowId: z.string().trim().uuid(),
                    data: z.record(z.unknown()),
                    expectedVersion: z.number().int().positive().optional()
                })
            )
            .min(1)
            .max(5000),
        uniformUpdates: z
            .array(
                z.object({
                    rows: z
                        .array(
                            z.object({
                                childRowId: z.string().trim().uuid(),
                                expectedVersion: z.number().int().positive().optional()
                            })
                        )
                        .min(1)
                        .max(5000),
                    data: z.record(z.unknown()).refine((data) => Object.keys(data).length === 1, {
                        message: 'Uniform updates must contain exactly one field.'
                    })
                })
            )
            .max(2)
            .optional()
    })
    .superRefine((value, ctx) => {
        const fieldUpdateCount = value.updates.filter(
            (update) => Object.keys(update.data).length !== 1 || typeof update.data._tp_sort_order !== 'number'
        ).length
        if (fieldUpdateCount > 25) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['updates'],
                message: 'A batch can contain at most 25 non-order updates.'
            })
        }
    })

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRuntimeChildRowsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const listChildRows = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId } = req.params
        if (!UUID_REGEX.test(recordId)) return res.status(400).json({ error: 'Invalid record ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })

        const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
        const offsetParam = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined
        const limit = Number.isFinite(limitParam) && (limitParam as number) > 0 ? (limitParam as number) : 1000
        const offset = Number.isFinite(offsetParam) && (offsetParam as number) >= 0 ? (offsetParam as number) : 0

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const safeChildAttrs = tc.childAttrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
        const selectCols = ['id', '_tp_sort_order', '_upl_version', ...safeChildAttrs.map((a) => quoteIdentifier(a.column_name))]

        const countResult = (await ctx.manager.query(
            `
        SELECT COUNT(*)::int AS total
        FROM ${tc.tabTableIdent}
        WHERE _tp_parent_id = $1
          AND ${runtimeRowCondition}
      `,
            [recordId]
        )) as Array<{ total: number }>
        const total = countResult[0]?.total ?? 0

        const rows = (await ctx.manager.query(
            `
        SELECT ${selectCols.join(', ')}
        FROM ${tc.tabTableIdent}
        WHERE _tp_parent_id = $1
          AND ${runtimeRowCondition}
        ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
        LIMIT $2 OFFSET $3
      `,
            [recordId, limit, offset]
        )) as Array<Record<string, unknown>>

        const items = rows.map((row) => {
            const mapped: Record<string, unknown> & { id: string } = { id: String(row.id) }
            mapped._tp_sort_order = row._tp_sort_order ?? 0
            mapped._upl_version = Number(row._upl_version ?? 1)
            for (const attr of safeChildAttrs) {
                const raw = row[attr.column_name] ?? null
                mapped[attr.column_name] = attr.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
            }
            return mapped
        })

        return res.json({ items, total })
    }

    // ============ CREATE CHILD ROW ============
    const createChildRow = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId } = req.params
        if (!UUID_REGEX.test(recordId)) return res.status(400).json({ error: 'Invalid record ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const parsedBody = tabularCreateBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }
        const clientData = parsedBody.data.data
        try {
            assertNoClientSuppliedServerOwnedChildFields(tc, clientData)
            if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates === true) {
                throw new UpdateFailure(400, {
                    error: 'Matrix cells must be created through the server-owned Matrix cell command'
                })
            }
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }
        const data = prepareHierarchyCreateData(tc, clientData)
        const sortOrder = typeof data._tp_sort_order === 'number' ? data._tp_sort_order : 0

        const colNames: string[] = ['_tp_parent_id', '_tp_sort_order']
        const placeholders: string[] = ['$1', '$2']
        const values: unknown[] = [recordId, sortOrder]
        let pIdx = 3
        const effectiveCreateData: Record<string, unknown> = { ...data }

        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
            colNames.push(quoteIdentifier('workspace_id'))
            placeholders.push(`$${pIdx}`)
            values.push(ctx.currentWorkspaceId)
            pIdx++
        }

        if (ctx.userId) {
            colNames.push('_upl_created_by')
            placeholders.push(`$${pIdx}`)
            values.push(ctx.userId)
            pIdx++
        }

        for (const cAttr of tc.childAttrs) {
            if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
            const childFieldPath = formatRuntimeFieldPath(tc.tableAttr.codename, cAttr.codename)
            const isEnumRef = cAttr.data_type === 'REF' && cAttr.target_object_kind === 'enumeration'
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(data, cAttr.column_name, cAttr.codename)
            let raw = inputValue

            if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
                return res.status(400).json({ error: `Field is read-only: ${childFieldPath}` })
            }

            if (raw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(
                            ctx.manager,
                            ctx.schemaIdent,
                            defaultEnumValueId,
                            cAttr.target_object_id
                        )
                        raw = defaultEnumValueId
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                            raw = undefined
                        } else {
                            throw error
                        }
                    }
                }
            }

            const setConstantConfig =
                cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
            if (setConstantConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    raw = setConstantConfig.id
                } else if (providedRefId !== setConstantConfig.id) {
                    return res.status(400).json({ error: `Field is read-only: ${childFieldPath}` })
                } else {
                    raw = setConstantConfig.id
                }
            }

            if (raw === undefined || raw === null) {
                if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                    let defaultValue: unknown
                    switch (cAttr.data_type) {
                        case 'STRING':
                            defaultValue = ''
                            break
                        case 'NUMBER':
                            defaultValue = 0
                            break
                        default:
                            defaultValue = ''
                    }
                    colNames.push(quoteIdentifier(cAttr.column_name))
                    placeholders.push(`$${pIdx}`)
                    values.push(defaultValue)
                    effectiveCreateData[cAttr.column_name] = defaultValue
                    if (cAttr.codename) effectiveCreateData[cAttr.codename] = defaultValue
                    pIdx++
                }
                continue
            }
            try {
                const coerced = coerceRuntimeValue(raw, cAttr.data_type, cAttr.validation_rules)
                if (isEnumRef && typeof cAttr.target_object_id === 'string' && coerced) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cAttr.target_object_id)
                }
                colNames.push(quoteIdentifier(cAttr.column_name))
                placeholders.push(`$${pIdx}`)
                values.push(coerced)
                effectiveCreateData[cAttr.column_name] = coerced
                if (cAttr.codename) effectiveCreateData[cAttr.codename] = coerced
                pIdx++
            } catch (err) {
                const formatError = toRuntimeInputFormatErrorBody(err)
                if (formatError) {
                    return res.status(400).json(formatError)
                }
                return res.status(400).json({
                    error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                })
            }
        }

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
                await validateTabularHierarchy(tx, tc, recordId, runtimeRowCondition, [{ data: effectiveCreateData }])
                await validateTabularCoordinates(tx, tc, recordId, runtimeRowCondition, [{ data: effectiveCreateData }])

                const { minRows, maxRows } = getTableRowLimits(tc.tableAttr.validation_rules)
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
                const maxRowsError = getTableRowCountError(activeCount + 1, tc.tableAttr.codename, {
                    minRows,
                    maxRows
                })
                if (maxRowsError && maxRows !== null) {
                    throw new UpdateFailure(400, { error: maxRowsError })
                }

                const safeChildAttrs = tc.childAttrs.filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))
                const returningCols = [
                    'id',
                    '_tp_sort_order',
                    '_upl_version',
                    ...safeChildAttrs.map((attr) => quoteIdentifier(attr.column_name))
                ]
                const [row] = (await tx.query(
                    `INSERT INTO ${tc.tabTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(
                        ', '
                    )}) RETURNING ${returningCols.join(', ')}`,
                    values
                )) as Array<Record<string, unknown> & { id: string }>

                if (!row?.id) {
                    throw new UpdateFailure(500, { error: 'Failed to create child row' })
                }

                const item: Record<string, unknown> & { id: string } = { id: row.id }
                for (const [key, value] of Object.entries(row)) {
                    item[key] = value
                }
                for (const attr of safeChildAttrs) {
                    item[attr.codename] = row[attr.column_name] ?? null
                }
                return item
            })

            return res.status(201).json({ id: inserted.id, status: 'created', item: inserted })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) {
                return res.status(400).json(formatError)
            }
            throw e
        }
    }

    // ============ UPDATE CHILD ROW ============
    const updateChildRow = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId, childRowId } = req.params
        if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
            return res.status(400).json({ error: 'Invalid ID format' })
        }
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const parsedBody = tabularUpdateBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { expectedVersion } = parsedBody.data
        const data = (() => {
            if (parsedBody.data.data) {
                return parsedBody.data.data
            }
            const bodyData = parsedBody.data as Record<string, unknown>
            const { expectedVersion: _ignoredExpectedVersion, ...raw } = bodyData
            return raw
        })() as Record<string, unknown>

        try {
            assertNoClientSuppliedServerOwnedChildFields(tc, data)
            assertNoGenericMatrixPlacement(tc, data)
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }

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

                if (parentRows.length === 0) throw new UpdateFailure(404, { error: 'Parent record not found' })
                if (parentRows[0]._upl_locked) throw new UpdateFailure(423, { error: 'Parent record is locked' })
                assertRuntimeRecordMutable(tc.object.config, parentRows[0])
                await validateTabularHierarchy(tx, tc, recordId, runtimeRowCondition, [{ childRowId, data }])
                await validateTabularCoordinates(tx, tc, recordId, runtimeRowCondition, [{ childRowId, data }])

                const update = await buildChildRowUpdate(tx, ctx.schemaIdent, tc, data, ctx.userId)
                if ('error' in update) throw new UpdateFailure(400, update.error)
                const { setClauses, values, nextParamIndex: pIdx } = update

                values.push(childRowId)
                values.push(recordId)
                const childIdParam = pIdx
                const parentIdParam = pIdx + 1
                let expectedVersionClause = ''
                if (expectedVersion !== undefined) {
                    values.push(expectedVersion)
                    expectedVersionClause = `AND COALESCE(_upl_version, 1) = $${parentIdParam + 1}`
                }

                const updated = (await tx.query(
                    `
          UPDATE ${tc.tabTableIdent}
          SET ${setClauses.join(', ')}
          WHERE id = $${childIdParam}
            AND _tp_parent_id = $${parentIdParam}
            AND ${runtimeRowCondition}
            ${expectedVersionClause}
          RETURNING id
        `,
                    values
                )) as Array<{ id: string }>

                if (updated.length > 0) return

                const childRows = (await tx.query(
                    `
          SELECT id, _upl_version
          FROM ${tc.tabTableIdent}
          WHERE id = $1
            AND _tp_parent_id = $2
            AND ${runtimeRowCondition}
          LIMIT 1
        `,
                    [childRowId, recordId]
                )) as Array<{ id: string; _upl_version?: number }>
                if (childRows.length === 0) throw new UpdateFailure(404, { error: 'Child row not found' })
                if (expectedVersion !== undefined) {
                    const actualVersion = Number(childRows[0]._upl_version ?? 1)
                    if (actualVersion !== expectedVersion) {
                        throw new UpdateFailure(409, {
                            error: 'Version mismatch',
                            expectedVersion,
                            actualVersion
                        })
                    }
                }
                throw new UpdateFailure(404, { error: 'Child row not found' })
            })
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }

        return res.json({ status: 'ok' })
    }

    // ============ BATCH UPDATE CHILD ROWS ============
    const batchUpdateChildRows = async (req: Request, res: Response) => {
        const { applicationId, recordId, componentId } = req.params
        if (!UUID_REGEX.test(recordId)) {
            return res.status(400).json({ error: 'Invalid record ID format' })
        }
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (!objectCollectionId || !UUID_REGEX.test(objectCollectionId))
            return res.status(400).json({ error: 'objectCollectionId query parameter is required' })

        const parsedBody = tabularBatchUpdateBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const uniformUpdates = parsedBody.data.uniformUpdates ?? []
        const allRequestedRows = [
            ...parsedBody.data.updates.map((update) => ({
                childRowId: update.childRowId,
                expectedVersion: update.expectedVersion
            })),
            ...uniformUpdates.flatMap((group) => group.rows)
        ]
        const seenChildRowIds = new Set<string>()
        for (const update of allRequestedRows) {
            if (seenChildRowIds.has(update.childRowId)) {
                return res.status(400).json({ error: 'Duplicate childRowId in batch update' })
            }
            seenChildRowIds.add(update.childRowId)
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        try {
            for (const update of parsedBody.data.updates) {
                assertNoClientSuppliedServerOwnedChildFields(tc, update.data)
                assertNoGenericMatrixPlacement(tc, update.data)
            }
            for (const uniformUpdate of uniformUpdates) {
                assertNoClientSuppliedServerOwnedChildFields(tc, uniformUpdate.data)
            }
        } catch (error) {
            if (error instanceof UpdateFailure) return res.status(error.statusCode).json(error.body)
            throw error
        }
        try {
            assertAllowedUniformTabularUpdates(tc, uniformUpdates)
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

        try {
            const updatedIds = await ctx.manager.transaction(async (tx) => {
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
                await validateTabularHierarchy(tx, tc, recordId, runtimeRowCondition, [
                    ...parsedBody.data.updates.map((update) => ({ childRowId: update.childRowId, data: update.data })),
                    ...uniformUpdates.flatMap((group) => group.rows.map((row) => ({ childRowId: row.childRowId, data: group.data })))
                ])
                await validateTabularCoordinates(tx, tc, recordId, runtimeRowCondition, [
                    ...parsedBody.data.updates.map((update) => ({ childRowId: update.childRowId, data: update.data })),
                    ...uniformUpdates.flatMap((group) => group.rows.map((row) => ({ childRowId: row.childRowId, data: group.data })))
                ])

                const requestedChildRowIds = allRequestedRows.map((update) => update.childRowId)
                const childRows = (await tx.query(
                    `
            SELECT id, _upl_version
            FROM ${tc.tabTableIdent}
            WHERE id = ANY($1)
              AND _tp_parent_id = $2
              AND ${runtimeRowCondition}
            FOR UPDATE
          `,
                    [requestedChildRowIds, recordId]
                )) as Array<{ id: string; _upl_version?: number }>

                const childRowsById = new Map(childRows.map((row) => [row.id, row]))
                for (const childRowId of requestedChildRowIds) {
                    if (!childRowsById.has(childRowId)) {
                        throw new UpdateFailure(404, { error: 'Child row not found', childRowId })
                    }
                }

                for (const updateInput of allRequestedRows) {
                    if (updateInput.expectedVersion === undefined) continue
                    const actualVersion = Number(childRowsById.get(updateInput.childRowId)?._upl_version ?? 1)
                    if (actualVersion !== updateInput.expectedVersion) {
                        throw new UpdateFailure(409, {
                            error: 'Version mismatch',
                            childRowId: updateInput.childRowId,
                            expectedVersion: updateInput.expectedVersion,
                            actualVersion
                        })
                    }
                }

                const sortOnlyUpdates = parsedBody.data.updates.filter(
                    (update) => Object.keys(update.data).length === 1 && typeof update.data._tp_sort_order === 'number'
                )
                const fieldUpdates = parsedBody.data.updates.filter(
                    (update) => Object.keys(update.data).length !== 1 || typeof update.data._tp_sort_order !== 'number'
                )
                const fieldUpdateIds = new Set(fieldUpdates.map((update) => update.childRowId))
                const pendingSortOnlyUpdates = sortOnlyUpdates.filter((update) => !fieldUpdateIds.has(update.childRowId))

                for (const updateInput of fieldUpdates) {
                    const update = await buildChildRowUpdate(tx, ctx.schemaIdent, tc, updateInput.data, ctx.userId)
                    if ('error' in update) {
                        throw new UpdateFailure(400, update.error)
                    }
                    const { setClauses, values, nextParamIndex: pIdx } = update
                    values.push(updateInput.childRowId)
                    values.push(recordId)
                    const childIdParam = pIdx
                    const parentIdParam = pIdx + 1

                    let expectedVersionClause = ''
                    if (updateInput.expectedVersion !== undefined) {
                        values.push(updateInput.expectedVersion)
                        expectedVersionClause = `AND COALESCE(_upl_version, 1) = $${parentIdParam + 1}`
                    }

                    const rows = (await tx.query(
                        `
              UPDATE ${tc.tabTableIdent}
              SET ${setClauses.join(', ')}
              WHERE id = $${childIdParam}
                AND _tp_parent_id = $${parentIdParam}
                AND ${runtimeRowCondition}
                ${expectedVersionClause}
              RETURNING id
            `,
                        values
                    )) as Array<{ id: string }>

                    if (rows.length === 0) {
                        throw new UpdateFailure(updateInput.expectedVersion === undefined ? 404 : 409, {
                            error: updateInput.expectedVersion === undefined ? 'Child row not found' : 'Version mismatch',
                            childRowId: updateInput.childRowId,
                            ...(updateInput.expectedVersion === undefined ? {} : { expectedVersion: updateInput.expectedVersion })
                        })
                    }
                }

                for (const uniformUpdate of uniformUpdates) {
                    const update = await buildChildRowUpdate(tx, ctx.schemaIdent, tc, uniformUpdate.data, ctx.userId)
                    if ('error' in update) {
                        throw new UpdateFailure(400, update.error)
                    }
                    const setClauses = update.setClauses.filter((setClause) => setClause !== '_upl_version = COALESCE(_upl_version, 1) + 1')
                    const values = [...update.values]
                    const childIdsParam = update.nextParamIndex
                    const expectedVersionsParam = childIdsParam + 1
                    const parentIdParam = expectedVersionsParam + 1
                    values.push(uniformUpdate.rows.map((row) => row.childRowId))
                    values.push(uniformUpdate.rows.map((row) => row.expectedVersion ?? null))
                    values.push(recordId)
                    const updatedRows = (await tx.query(
                        `
              UPDATE ${tc.tabTableIdent} AS target
              SET ${setClauses.join(', ')},
                  _upl_version = COALESCE(target._upl_version, 1) + 1
              FROM UNNEST($${childIdsParam}::uuid[], $${expectedVersionsParam}::integer[]) AS requested(id, expected_version)
              WHERE target.id = requested.id
                AND target._tp_parent_id = $${parentIdParam}
                AND ${runtimeRowCondition}
                AND (requested.expected_version IS NULL OR COALESCE(target._upl_version, 1) = requested.expected_version)
              RETURNING target.id
            `,
                        values
                    )) as Array<{ id: string }>

                    if (updatedRows.length !== uniformUpdate.rows.length) {
                        throw new UpdateFailure(409, { error: 'Version mismatch during uniform batch update' })
                    }
                }

                const updateSortOnlyRows = async (
                    updates: typeof sortOnlyUpdates,
                    options: { withExpectedVersion: boolean }
                ): Promise<Array<{ id: string }>> => {
                    if (updates.length === 0) return []
                    if (options.withExpectedVersion) {
                        return (await tx.query(
                            `
              UPDATE ${tc.tabTableIdent} AS target
              SET _tp_sort_order = ordering.sort_order,
                  _upl_updated_at = NOW(),
                  _upl_updated_by = $4,
                  _upl_version = COALESCE(target._upl_version, 1) + 1
              FROM UNNEST($1::uuid[], $2::integer[], $3::integer[]) AS ordering(id, sort_order, expected_version)
              WHERE target.id = ordering.id
                AND target._tp_parent_id = $5
                AND ${runtimeRowCondition}
                AND (ordering.expected_version IS NULL OR COALESCE(target._upl_version, 1) = ordering.expected_version)
              RETURNING target.id
            `,
                            [
                                updates.map((update) => update.childRowId),
                                updates.map((update) => update.data._tp_sort_order as number),
                                updates.map((update) => update.expectedVersion as number),
                                ctx.userId,
                                recordId
                            ]
                        )) as Array<{ id: string }>
                    }

                    return (await tx.query(
                        `
              UPDATE ${tc.tabTableIdent} AS target
              SET _tp_sort_order = ordering.sort_order,
                  _upl_updated_at = NOW(),
                  _upl_updated_by = $3,
                  _upl_version = COALESCE(target._upl_version, 1) + 1
              FROM UNNEST($1::uuid[], $2::integer[]) AS ordering(id, sort_order)
              WHERE target.id = ordering.id
                AND target._tp_parent_id = $4
                AND ${runtimeRowCondition}
              RETURNING target.id
            `,
                        [
                            updates.map((update) => update.childRowId),
                            updates.map((update) => update.data._tp_sort_order as number),
                            ctx.userId,
                            recordId
                        ]
                    )) as Array<{ id: string }>
                }

                if (pendingSortOnlyUpdates.length > 0) {
                    const versionedSortOnlyUpdates = pendingSortOnlyUpdates.filter((update) => update.expectedVersion !== undefined)
                    const unversionedSortOnlyUpdates = pendingSortOnlyUpdates.filter((update) => update.expectedVersion === undefined)
                    const reorderedRows = [
                        ...(await updateSortOnlyRows(versionedSortOnlyUpdates, { withExpectedVersion: true })),
                        ...(await updateSortOnlyRows(unversionedSortOnlyUpdates, { withExpectedVersion: false }))
                    ]

                    if (reorderedRows.length !== pendingSortOnlyUpdates.length) {
                        const currentRows = (await tx.query(
                            `
              SELECT id, _upl_version
              FROM ${tc.tabTableIdent}
              WHERE id = ANY($1)
                AND _tp_parent_id = $2
                AND ${runtimeRowCondition}
              FOR UPDATE
            `,
                            [pendingSortOnlyUpdates.map((update) => update.childRowId), recordId]
                        )) as Array<{ id: string; _upl_version?: number }>
                        const currentRowsById = new Map(currentRows.map((row) => [row.id, row]))
                        for (const updateInput of pendingSortOnlyUpdates) {
                            const currentRow = currentRowsById.get(updateInput.childRowId)
                            if (!currentRow) continue
                            if (updateInput.expectedVersion !== undefined) {
                                const actualVersion = Number(currentRow._upl_version ?? 1)
                                if (actualVersion !== updateInput.expectedVersion) {
                                    throw new UpdateFailure(409, {
                                        error: 'Version mismatch',
                                        childRowId: updateInput.childRowId,
                                        expectedVersion: updateInput.expectedVersion,
                                        actualVersion
                                    })
                                }
                            }
                        }
                        const hasExpectedVersion = pendingSortOnlyUpdates.some((update) => update.expectedVersion !== undefined)
                        throw new UpdateFailure(hasExpectedVersion ? 409 : 404, {
                            error: hasExpectedVersion ? 'Version mismatch during reorder' : 'Child row not found during reorder'
                        })
                    }
                }

                return requestedChildRowIds
            })

            return res.json({ status: 'ok', updated: updatedIds })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return res.status(400).json(formatError)
            throw e
        }
    }

    // ============ COPY CHILD ROW ============
    const { copyChildRow, deleteChildRow } = createRuntimeChildRowCopyDeleteHandlers(getDbExecutor, query)

    return {
        listChildRows,
        createChildRow,
        updateChildRow,
        batchUpdateChildRows,
        copyChildRow,
        deleteChildRow
    }
}
