import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
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

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const tabularUpdateBodySchema = z
  .object({
    data: z.record(z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional()
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRuntimeChildRowsController(getDbExecutor: () => DbExecutor) {
  const query = createQueryHelper(getDbExecutor)

  // ============ LIST CHILD ROWS ============
  const listChildRows = async (req: Request, res: Response) => {
    const { applicationId, recordId, attributeId } = req.params
    if (!UUID_REGEX.test(recordId))
      return res.status(400).json({ error: 'Invalid record ID format' })
    const catalogId =
      typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
    if (!catalogId || !UUID_REGEX.test(catalogId))
      return res.status(400).json({ error: 'catalogId query parameter is required' })

    const limitParam =
      typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
    const offsetParam =
      typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined
    const limit =
      Number.isFinite(limitParam) && (limitParam as number) > 0 ? (limitParam as number) : 1000
    const offset =
      Number.isFinite(offsetParam) && (offsetParam as number) >= 0 ? (offsetParam as number) : 0

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'createContent')) return

    const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
    if (tc.error !== null) return res.status(400).json({ error: tc.error })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      tc.lifecycleContract,
      tc.catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    const safeChildAttrs = tc.childAttrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
    const selectCols = [
      'id',
      '_tp_sort_order',
      ...safeChildAttrs.map((a) => quoteIdentifier(a.column_name))
    ]

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
      for (const attr of safeChildAttrs) {
        const raw = row[attr.column_name] ?? null
        mapped[attr.column_name] =
          attr.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
      }
      return mapped
    })

    return res.json({ items, total })
  }

  // ============ CREATE CHILD ROW ============
  const createChildRow = async (req: Request, res: Response) => {
    const { applicationId, recordId, attributeId } = req.params
    if (!UUID_REGEX.test(recordId))
      return res.status(400).json({ error: 'Invalid record ID format' })
    const catalogId =
      typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
    if (!catalogId || !UUID_REGEX.test(catalogId))
      return res.status(400).json({ error: 'catalogId query parameter is required' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'editContent')) return

    const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
    if (tc.error !== null) return res.status(400).json({ error: tc.error })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      tc.lifecycleContract,
      tc.catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const data = (req.body?.data ?? req.body) as Record<string, unknown>
    const sortOrder = typeof data._tp_sort_order === 'number' ? data._tp_sort_order : 0

    const colNames: string[] = ['_tp_parent_id', '_tp_sort_order']
    const placeholders: string[] = ['$1', '$2']
    const values: unknown[] = [recordId, sortOrder]
    let pIdx = 3

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
      const isEnumRef =
        cAttr.data_type === 'REF' && cAttr.target_object_kind === 'enumeration'
      const { hasUserValue, value: inputValue } = getRuntimeInputValue(
        data,
        cAttr.column_name,
        cAttr.codename
      )
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
            if (
              error instanceof Error &&
              error.message === 'Enumeration value does not belong to target enumeration'
            ) {
              raw = undefined
            } else {
              throw error
            }
          }
        }
      }

      const setConstantConfig =
        cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set'
          ? getSetConstantConfig(cAttr.ui_config)
          : null
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
          pIdx++
        }
        continue
      }
      try {
        const coerced = coerceRuntimeValue(raw, cAttr.data_type, cAttr.validation_rules)
        if (isEnumRef && typeof cAttr.target_object_id === 'string' && coerced) {
          await ensureEnumerationValueBelongsToTarget(
            ctx.manager,
            ctx.schemaIdent,
            String(coerced),
            cAttr.target_object_id
          )
        }
        colNames.push(quoteIdentifier(cAttr.column_name))
        placeholders.push(`$${pIdx}`)
        values.push(coerced)
        pIdx++
      } catch (err) {
        return res.status(400).json({
          error: `Invalid value for ${childFieldPath}: ${
            err instanceof Error ? err.message : String(err)
          }`
        })
      }
    }

    // FIX: replaced manual BEGIN/COMMIT/ROLLBACK with .transaction()
    try {
      const inserted = await ctx.manager.transaction(async (tx) => {
        const parentRows = (await tx.query(
          `
            SELECT id, _upl_locked
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

        const [row] = (await tx.query(
          `INSERT INTO ${tc.tabTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
          values
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

  // ============ UPDATE CHILD ROW ============
  const updateChildRow = async (req: Request, res: Response) => {
    const { applicationId, recordId, attributeId, childRowId } = req.params
    if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }
    const catalogId =
      typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
    if (!catalogId || !UUID_REGEX.test(catalogId))
      return res.status(400).json({ error: 'catalogId query parameter is required' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'createContent')) return

    const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
    if (tc.error !== null) return res.status(400).json({ error: tc.error })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      tc.lifecycleContract,
      tc.catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    const parsedBody = tabularUpdateBodySchema.safeParse(req.body ?? {})
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
    }

    // Check parent record is not locked
    const parentRows = (await ctx.manager.query(
      `
        SELECT id, _upl_locked
        FROM ${tc.parentTableIdent}
        WHERE id = $1
          AND ${runtimeRowCondition}
      `,
      [recordId]
    )) as Array<{ id: string; _upl_locked?: boolean }>

    if (parentRows.length === 0)
      return res.status(404).json({ error: 'Parent record not found' })
    if (parentRows[0]._upl_locked)
      return res.status(423).json({ error: 'Parent record is locked' })

    const { expectedVersion } = parsedBody.data
    const data = (() => {
      if (parsedBody.data.data) {
        return parsedBody.data.data
      }
      const bodyData = parsedBody.data as Record<string, unknown>
      const { expectedVersion: _ignoredExpectedVersion, ...raw } = bodyData
      return raw
    })() as Record<string, unknown>
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
        return res.status(400).json({ error: `Field is read-only: ${childFieldPath}` })
      }
      const setConstantConfig =
        cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set'
          ? getSetConstantConfig(cAttr.ui_config)
          : null
      if (setConstantConfig) {
        const providedRefId = resolveRefId(raw)
        if (!providedRefId) {
          normalizedRaw = setConstantConfig.id
        } else if (providedRefId !== setConstantConfig.id) {
          return res.status(400).json({ error: `Field is read-only: ${childFieldPath}` })
        } else {
          normalizedRaw = setConstantConfig.id
        }
      }
      if (normalizedRaw === null && cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
        return res
          .status(400)
          .json({ error: `Required field cannot be set to null: ${childFieldPath}` })
      }
      try {
        const coerced = coerceRuntimeValue(normalizedRaw, cAttr.data_type, cAttr.validation_rules)
        if (
          cAttr.data_type === 'REF' &&
          cAttr.target_object_kind === 'enumeration' &&
          typeof cAttr.target_object_id === 'string' &&
          coerced
        ) {
          await ensureEnumerationValueBelongsToTarget(
            ctx.manager,
            ctx.schemaIdent,
            String(coerced),
            cAttr.target_object_id
          )
        }
        setClauses.push(`${quoteIdentifier(cAttr.column_name)} = $${pIdx}`)
        values.push(coerced)
        pIdx++
      } catch (err) {
        return res.status(400).json({
          error: `Invalid value for ${childFieldPath}: ${
            err instanceof Error ? err.message : String(err)
          }`
        })
      }
    }

    // Handle _tp_sort_order update
    if (typeof data._tp_sort_order === 'number') {
      setClauses.push(`_tp_sort_order = $${pIdx}`)
      values.push(data._tp_sort_order)
      pIdx++
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push(`_upl_updated_by = $${pIdx}`)
    values.push(ctx.userId)
    pIdx++
    setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

    values.push(childRowId)
    values.push(recordId)
    const childIdParam = pIdx
    const parentIdParam = pIdx + 1

    let expectedVersionClause = ''
    if (expectedVersion !== undefined) {
      values.push(expectedVersion)
      expectedVersionClause = `AND COALESCE(_upl_version, 1) = $${parentIdParam + 1}`
    }

    const updated = (await ctx.manager.query(
      `
        UPDATE ${tc.tabTableIdent}
        SET ${setClauses.join(', ')}
        WHERE id = $${childIdParam}
          AND _tp_parent_id = $${parentIdParam}
          AND ${runtimeRowCondition}
          AND NOT EXISTS (
            SELECT 1 FROM ${tc.parentTableIdent}
            WHERE id = $${parentIdParam} AND ${runtimeRowCondition} AND COALESCE(_upl_locked, false) = true
          )
          ${expectedVersionClause}
        RETURNING id
      `,
      values
    )) as Array<{ id: string }>

    if (updated.length === 0) {
      const parentLockRows = (await ctx.manager.query(
        `
          SELECT _upl_locked
          FROM ${tc.parentTableIdent}
          WHERE id = $1
            AND ${runtimeRowCondition}
          LIMIT 1
        `,
        [recordId]
      )) as Array<{ _upl_locked?: boolean }>

      if (parentLockRows.length > 0 && parentLockRows[0]._upl_locked) {
        return res.status(423).json({ error: 'Parent record is locked' })
      }

      const childRows = (await ctx.manager.query(
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

      if (childRows.length === 0) {
        return res.status(404).json({ error: 'Child row not found' })
      }

      if (expectedVersion !== undefined) {
        const actualVersion = Number(childRows[0]._upl_version ?? 1)
        if (actualVersion !== expectedVersion) {
          return res.status(409).json({
            error: 'Version mismatch',
            expectedVersion,
            actualVersion
          })
        }
      }

      return res.status(404).json({ error: 'Child row not found' })
    }

    return res.json({ status: 'ok' })
  }

  // ============ COPY CHILD ROW ============
  const copyChildRow = async (req: Request, res: Response) => {
    const { applicationId, recordId, attributeId, childRowId } = req.params
    if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }
    const catalogId =
      typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
    if (!catalogId || !UUID_REGEX.test(catalogId))
      return res.status(400).json({ error: 'catalogId query parameter is required' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return
    if (!ensureRuntimePermission(res, ctx, 'createContent')) return

    const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
    if (tc.error !== null) return res.status(400).json({ error: tc.error })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      tc.lifecycleContract,
      tc.catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )

    // FIX: replaced manual BEGIN/COMMIT/ROLLBACK with .transaction()
    try {
      const inserted = await ctx.manager.transaction(async (tx) => {
        const parentRows = (await tx.query(
          `
            SELECT id, _upl_locked
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
        const sourceSortOrder =
          typeof sourceRow._tp_sort_order === 'number' ? sourceRow._tp_sort_order : 0

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

        await tx.query(
          `
            UPDATE ${tc.tabTableIdent}
            SET _tp_sort_order = _tp_sort_order + 1,
                _upl_updated_at = NOW(),
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE _tp_parent_id = $1
              AND ${runtimeRowCondition}
              AND _tp_sort_order > $2
          `,
          [recordId, sourceSortOrder]
        )

        const copyColumns = tc.childAttrs
          .map((attr) => attr.column_name)
          .filter((column) => IDENTIFIER_REGEX.test(column))
        const headerColumns = [
          '_tp_parent_id',
          '_tp_sort_order',
          ...(ctx.workspacesEnabled && ctx.currentWorkspaceId
            ? [quoteIdentifier('workspace_id')]
            : []),
          ...(ctx.userId ? ['_upl_created_by'] : [])
        ]
        const allColumns = [
          ...headerColumns,
          ...copyColumns.map((column) => quoteIdentifier(column))
        ]
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
          copyValues.push(sourceRow[column] ?? null)
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
    const { applicationId, recordId, attributeId, childRowId } = req.params
    if (!UUID_REGEX.test(recordId) || !UUID_REGEX.test(childRowId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }
    const catalogId =
      typeof req.query.catalogId === 'string' ? req.query.catalogId : undefined
    if (!catalogId || !UUID_REGEX.test(catalogId))
      return res.status(400).json({ error: 'catalogId query parameter is required' })

    const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
    if (!ctx) return

    const tc = await resolveTabularContext(ctx.manager, ctx.schemaIdent, catalogId, attributeId)
    if (tc.error !== null) return res.status(400).json({ error: tc.error })
    const runtimeRowCondition = buildRuntimeActiveRowCondition(
      tc.lifecycleContract,
      tc.catalog.config,
      undefined,
      ctx.currentWorkspaceId
    )
    const runtimeDeleteSetClause = isSoftDeleteLifecycle(tc.lifecycleContract)
      ? buildRuntimeSoftDeleteSetClause('$1', tc.lifecycleContract, tc.catalog.config)
      : null

    // FIX: replaced manual BEGIN/COMMIT/ROLLBACK with .transaction()
    try {
      await ctx.manager.transaction(async (tx) => {
        const parentRows = (await tx.query(
          `
            SELECT id, _upl_locked
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

        const childRows = (await tx.query(
          `
            SELECT id
            FROM ${tc.tabTableIdent}
            WHERE id = $1
              AND _tp_parent_id = $2
              AND ${runtimeRowCondition}
            LIMIT 1
          `,
          [childRowId, recordId]
        )) as Array<{ id: string }>

        if (childRows.length === 0) {
          throw new UpdateFailure(404, { error: 'Child row not found' })
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

        const deleted = runtimeDeleteSetClause
          ? ((await tx.query(
              `
                UPDATE ${tc.tabTableIdent}
                SET ${runtimeDeleteSetClause},
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $2
                  AND _tp_parent_id = $3
                  AND ${runtimeRowCondition}
                RETURNING id
              `,
              [ctx.userId, childRowId, recordId]
            )) as Array<{ id: string }>)
          : ((await tx.query(
              `
                DELETE FROM ${tc.tabTableIdent}
                WHERE id = $1
                  AND _tp_parent_id = $2
                  AND ${runtimeRowCondition}
                RETURNING id
              `,
              [childRowId, recordId]
            )) as Array<{ id: string }>)

        if (deleted.length === 0) {
          throw new UpdateFailure(404, { error: 'Child row not found' })
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
    copyChildRow,
    deleteChildRow
  }
}
