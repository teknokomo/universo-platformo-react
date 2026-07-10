import type { Request, Response } from 'express'
import { z } from 'zod'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    formatRuntimeFieldPath,
    getRuntimeInputValue,
    pgNumericToNumber,
    isSoftDeleteLifecycle,
    buildRuntimeActiveRowCondition,
    buildRuntimeSoftDeleteSetClause,
    coerceRuntimeValue,
    normalizeRuntimeTableChildInsertValueByMeta,
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
    ensureRuntimePermission,
    type RuntimeTableChildComponentMeta
} from '../shared/runtimeHelpers'
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

const tabularDeleteQuerySchema = z.object({
    expectedVersion: z.coerce.number().int().positive().optional()
})

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

    const resolveHierarchyAttrs = (
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>
    ): { identityAttr: (typeof tc.childAttrs)[number]; parentAttr: (typeof tc.childAttrs)[number] } | null => {
        const parentAttr = tc.childAttrs.find(
            (attr) => typeof attr.ui_config?.hierarchyIdentityField === 'string' && attr.ui_config.hierarchyIdentityField.trim()
        )
        if (!parentAttr) return null

        const identityField = String(parentAttr.ui_config?.hierarchyIdentityField).trim()
        const identityAttr = tc.childAttrs.find((attr) => attr.codename === identityField || attr.column_name === identityField)
        if (!identityAttr || !IDENTIFIER_REGEX.test(identityAttr.column_name) || !IDENTIFIER_REGEX.test(parentAttr.column_name)) {
            throw new UpdateFailure(400, { error: 'Invalid hierarchy metadata' })
        }
        return { identityAttr, parentAttr }
    }

    const validateTabularHierarchy = async (
        manager: DbExecutor,
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
        recordId: string,
        runtimeRowCondition: string,
        updates: Array<{ childRowId?: string; data: Record<string, unknown> }>
    ): Promise<void> => {
        const hierarchyAttrs = resolveHierarchyAttrs(tc)
        if (!hierarchyAttrs) return
        const { identityAttr, parentAttr } = hierarchyAttrs

        const rows = (await manager.query(
            `
        SELECT id,
               ${quoteIdentifier(identityAttr.column_name)} AS identity,
               ${quoteIdentifier(parentAttr.column_name)} AS parent_identity
        FROM ${tc.tabTableIdent}
        WHERE _tp_parent_id = $1
          AND ${runtimeRowCondition}
        FOR UPDATE
      `,
            [recordId]
        )) as Array<{ id: string; identity?: unknown; parent_identity?: unknown }>
        const identityByRowId = new Map<string, string>()
        const parentByIdentity = new Map<string, string | null>()

        for (const row of rows) {
            if (typeof row.identity !== 'string' || !UUID_REGEX.test(row.identity)) {
                throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
            }
            if (parentByIdentity.has(row.identity)) {
                throw new UpdateFailure(400, { error: 'Duplicate hierarchy identity' })
            }
            identityByRowId.set(row.id, row.identity)
            parentByIdentity.set(row.identity, typeof row.parent_identity === 'string' && row.parent_identity ? row.parent_identity : null)
        }

        const proposedParentByIdentity = new Map(parentByIdentity)
        for (const update of updates) {
            const identityInput = getRuntimeInputValue(update.data, identityAttr.column_name, identityAttr.codename)
            const submittedIdentity = typeof identityInput.value === 'string' && identityInput.value ? identityInput.value : undefined
            const existingIdentity = update.childRowId ? identityByRowId.get(update.childRowId) : undefined
            if (update.childRowId && !existingIdentity) continue
            if (identityInput.hasUserValue && !submittedIdentity) {
                throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
            }
            if (identityInput.hasUserValue && existingIdentity && submittedIdentity !== existingIdentity) {
                throw new UpdateFailure(400, { error: 'Hierarchy identity cannot be changed' })
            }
            const identity = submittedIdentity ?? existingIdentity
            const parentInput = getRuntimeInputValue(update.data, parentAttr.column_name, parentAttr.codename)
            if (!identity || !UUID_REGEX.test(identity)) {
                throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
            }
            if (!update.childRowId && parentByIdentity.has(identity)) {
                throw new UpdateFailure(400, { error: 'Duplicate hierarchy identity' })
            }
            if (!parentInput.hasUserValue) {
                if (!update.childRowId) proposedParentByIdentity.set(identity, null)
                continue
            }
            const parentIdentity = parentInput.value == null || parentInput.value === '' ? null : String(parentInput.value)
            if (parentIdentity !== null && !UUID_REGEX.test(parentIdentity)) {
                throw new UpdateFailure(400, { error: 'Invalid hierarchy parent identity' })
            }
            proposedParentByIdentity.set(identity, parentIdentity)
        }

        const verified = new Set<string>()
        for (const [identity, parentIdentity] of proposedParentByIdentity) {
            if (parentIdentity === null) continue
            if (!proposedParentByIdentity.has(parentIdentity)) {
                throw new UpdateFailure(400, { error: 'Hierarchy parent does not exist' })
            }
            if (verified.has(identity)) continue
            const visited = new Set<string>([identity])
            let current: string | null = parentIdentity
            while (current) {
                if (verified.has(current)) break
                if (visited.has(current)) {
                    throw new UpdateFailure(400, { error: 'Hierarchy cycle is not allowed' })
                }
                visited.add(current)
                current = proposedParentByIdentity.get(current) ?? null
            }
            for (const id of visited) {
                verified.add(id)
            }
        }
    }

    const validateTabularCoordinates = async (
        manager: DbExecutor,
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
        recordId: string,
        runtimeRowCondition: string,
        updates: Array<{ childRowId?: string; data: Record<string, unknown> }>
    ): Promise<void> => {
        if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates !== true) return
        const rowKeyAttr = tc.childAttrs.find((attr) => attr.codename === 'RowKey' || attr.column_name === 'RowKey')
        const colKeyAttr = tc.childAttrs.find((attr) => attr.codename === 'ColKey' || attr.column_name === 'ColKey')
        if (!rowKeyAttr || !colKeyAttr) return
        if (!IDENTIFIER_REGEX.test(rowKeyAttr.column_name) || !IDENTIFIER_REGEX.test(colKeyAttr.column_name)) {
            throw new UpdateFailure(400, { error: 'Invalid coordinate metadata' })
        }

        const rows = (await manager.query(
            `
        SELECT id,
               ${quoteIdentifier(rowKeyAttr.column_name)} AS row_key,
               ${quoteIdentifier(colKeyAttr.column_name)} AS col_key
        FROM ${tc.tabTableIdent}
        WHERE _tp_parent_id = $1
          AND ${runtimeRowCondition}
        FOR UPDATE
      `,
            [recordId]
        )) as Array<{ id: string; row_key?: unknown; col_key?: unknown }>

        const proposedCoordinates = new Map<string, { rowKey: string | null; colKey: string | null }>()
        for (const row of rows) {
            proposedCoordinates.set(row.id, {
                rowKey: typeof row.row_key === 'string' ? row.row_key : null,
                colKey: typeof row.col_key === 'string' ? row.col_key : null
            })
        }

        let newRowIndex = 0
        for (const update of updates) {
            const rowId = update.childRowId ?? `__new_${newRowIndex++}`
            const existing = update.childRowId ? proposedCoordinates.get(update.childRowId) : undefined
            const rowInput = getRuntimeInputValue(update.data, rowKeyAttr.column_name, rowKeyAttr.codename)
            const colInput = getRuntimeInputValue(update.data, colKeyAttr.column_name, colKeyAttr.codename)
            const nextRowKey = rowInput.hasUserValue
                ? typeof rowInput.value === 'string'
                    ? rowInput.value
                    : null
                : existing?.rowKey ?? null
            const nextColKey = colInput.hasUserValue
                ? typeof colInput.value === 'string'
                    ? colInput.value
                    : null
                : existing?.colKey ?? null

            proposedCoordinates.set(rowId, { rowKey: nextRowKey, colKey: nextColKey })
        }

        const ownerByCoordinate = new Map<string, string>()
        for (const [rowId, coordinate] of proposedCoordinates) {
            if (coordinate.rowKey === null || coordinate.colKey === null) continue
            const key = `${coordinate.rowKey}\u0000${coordinate.colKey}`
            const owner = ownerByCoordinate.get(key)
            if (owner && owner !== rowId) {
                throw new UpdateFailure(409, { error: 'Duplicate tabular coordinates' })
            }
            ownerByCoordinate.set(key, rowId)
        }
    }

    const assertAllowedUniformTabularUpdates = (
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
        uniformUpdates: Array<{ data: Record<string, unknown> }>
    ): void => {
        if (uniformUpdates.length === 0) return
        if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates !== true) {
            throw new UpdateFailure(400, { error: 'Uniform tabular updates are available only for Matrix axis labels' })
        }

        const allowedFields = new Set<string>()
        for (const codename of ['RowLabel', 'ColLabel']) {
            const attr = tc.childAttrs.find((field) => field.codename === codename || field.column_name === codename)
            if (attr) {
                allowedFields.add(attr.codename)
                allowedFields.add(attr.column_name)
            }
        }

        for (const update of uniformUpdates) {
            const [field] = Object.keys(update.data)
            if (!field || !allowedFields.has(field)) {
                throw new UpdateFailure(400, { error: 'Uniform tabular updates are available only for Matrix axis labels' })
            }
        }
    }

    const prepareHierarchyCreateData = (
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
        data: Record<string, unknown>
    ): Record<string, unknown> => {
        const hierarchyAttrs = resolveHierarchyAttrs(tc)
        if (!hierarchyAttrs) return data

        const { identityAttr } = hierarchyAttrs
        const generatedIdentity = generateUuidV7()
        return {
            ...data,
            [identityAttr.column_name]: generatedIdentity,
            [identityAttr.codename]: generatedIdentity
        }
    }

    const buildChildRowUpdate = async (
        manager: DbExecutor,
        schemaIdent: string,
        tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
        data: Record<string, unknown>,
        userId: string
    ): Promise<{ setClauses: string[]; values: unknown[]; nextParamIndex: number } | { error: Record<string, unknown> }> => {
        const setClauses: string[] = []
        const values: unknown[] = []
        let pIdx = 1

        for (const cAttr of tc.childAttrs) {
            if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
            const childFieldPath = formatRuntimeFieldPath(tc.tableAttr.codename, cAttr.codename)
            const { value: raw } = getRuntimeInputValue(data, cAttr.column_name, cAttr.codename)
            if (raw === undefined) continue
            let normalizedRaw = raw
            if (
                cAttr.data_type === 'REF' &&
                cAttr.target_object_kind === 'enumeration' &&
                getEnumPresentationMode(cAttr.ui_config) === 'label'
            ) {
                return { error: { error: `Field is read-only: ${childFieldPath}` } }
            }
            const setConstantConfig =
                cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
            if (setConstantConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    normalizedRaw = setConstantConfig.id
                } else if (providedRefId !== setConstantConfig.id) {
                    return { error: { error: `Field is read-only: ${childFieldPath}` } }
                } else {
                    normalizedRaw = setConstantConfig.id
                }
            }
            if (normalizedRaw === null && cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                return { error: { error: `Required field cannot be set to null: ${childFieldPath}` } }
            }
            try {
                const coerced = coerceRuntimeValue(normalizedRaw, cAttr.data_type, cAttr.validation_rules)
                if (
                    cAttr.data_type === 'REF' &&
                    cAttr.target_object_kind === 'enumeration' &&
                    typeof cAttr.target_object_id === 'string' &&
                    coerced
                ) {
                    await ensureEnumerationValueBelongsToTarget(manager, schemaIdent, String(coerced), cAttr.target_object_id)
                }
                setClauses.push(`${quoteIdentifier(cAttr.column_name)} = $${pIdx}`)
                values.push(coerced)
                pIdx++
            } catch (err) {
                return {
                    error: {
                        error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                    }
                }
            }
        }

        if (typeof data._tp_sort_order === 'number') {
            setClauses.push(`_tp_sort_order = $${pIdx}`)
            values.push(data._tp_sort_order)
            pIdx++
        }

        if (setClauses.length === 0) {
            return { error: { error: 'No valid fields to update' } }
        }

        setClauses.push('_upl_updated_at = NOW()')
        setClauses.push(`_upl_updated_by = $${pIdx}`)
        values.push(userId)
        pIdx++
        setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

        return { setClauses, values, nextParamIndex: pIdx }
    }

    // ============ LIST CHILD ROWS ============
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
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, objectCollectionId, componentId)
        if (tc.error !== null) return res.status(400).json({ error: tc.error })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            tc.lifecycleContract,
            tc.object.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const data = prepareHierarchyCreateData(tc, (req.body?.data ?? req.body) as Record<string, unknown>)
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
                        throw new UpdateFailure(404, { error: 'Child row not found', childRowId: updateInput.childRowId })
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
                        throw new UpdateFailure(404, { error: 'Child row not found during reorder' })
                    }
                }

                return requestedChildRowIds
            })

            return res.json({ status: 'ok', updated: updatedIds })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ COPY CHILD ROW ============
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
                        .filter((attr) => IDENTIFIER_REGEX.test(attr.column_name))
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

                return row
            })

            return res.status(201).json({ id: inserted.id, status: 'created' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
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

    return {
        listChildRows,
        createChildRow,
        updateChildRow,
        batchUpdateChildRows,
        copyChildRow,
        deleteChildRow
    }
}
