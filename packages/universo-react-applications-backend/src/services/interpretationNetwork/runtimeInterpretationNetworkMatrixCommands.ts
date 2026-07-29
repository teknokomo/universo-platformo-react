import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import type { RuntimeSchemaContext, RuntimeTableChildComponentMeta } from '../../shared/runtimeHelpers'
import {
    IDENTIFIER_REGEX,
    coerceRuntimeValue,
    getTableRowLimits,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    toRuntimeInputFormatErrorBody
} from '../../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    acquireCommandLock,
    activeWorkspaceWhere,
    assertColumn,
    assertReadySurface,
    assertRuntimePermissions,
    childTableIdent,
    getChildField,
    interpretationNetworkCommandErrorCodes,
    loadChildRows,
    selectRowById,
    type InterpretationNetworkRuntimeSurface,
    type ObjectContract,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'

export type MatrixCellPlacementIntent = {
    parentCellId?: string | null
    rowKey?: string
    colKey?: string
    sortOrder?: number
}

export type MatrixCellMoveIntent = {
    matrixRowId: string
    expectedVersion?: number
    placement: MatrixCellPlacementIntent
    data?: Record<string, unknown>
}

const failInvalidCell = (message: string, details?: Record<string, unknown>): never => {
    throw new InterpretationNetworkCommandError(400, interpretationNetworkCommandErrorCodes.invalidCell, message, details)
}

const isServerOwned = (field: { ui_config?: Record<string, unknown> | null }): boolean => field.ui_config?.serverOwned === true

const readInput = (data: Record<string, unknown>, codename: string, columnName: string): { present: boolean; value: unknown } => {
    if (Object.prototype.hasOwnProperty.call(data, columnName)) return { present: true, value: data[columnName] }
    if (Object.prototype.hasOwnProperty.call(data, codename)) return { present: true, value: data[codename] }
    return { present: false, value: undefined }
}

const prepareClientChildValues = (contract: ObjectContract, data: Record<string, unknown>): Record<string, unknown> => {
    const invalidControlField = Object.keys(data).find(
        (key) => key.startsWith('_tp_') || key.startsWith('_upl_') || key.startsWith('_app_')
    )
    if (invalidControlField) failInvalidCell('Runtime control fields cannot be supplied by the client', { field: invalidControlField })

    const values: Record<string, unknown> = {}
    const knownKeys = new Set<string>()
    for (const field of Object.values(contract.childFields)) {
        knownKeys.add(field.codename)
        knownKeys.add(field.column_name)
        const input = readInput(data, field.codename, field.column_name)
        if (!input.present) continue
        if (isServerOwned(field)) failInvalidCell('Matrix placement fields are server-owned', { field: field.codename })
        try {
            values[field.column_name] = normalizeConfiguredRuntimeJsonValue(
                coerceRuntimeValue(input.value, field.data_type, field.validation_rules ?? undefined),
                { data_type: field.data_type, ui_config: field.ui_config ?? undefined }
            )
        } catch (error) {
            const formatError = toRuntimeInputFormatErrorBody(error)
            failInvalidCell(formatError?.error ?? `Invalid value for ${field.codename}`, { field: field.codename })
        }
    }
    const unknownKey = Object.keys(data).find((key) => !knownKeys.has(key))
    if (unknownKey) failInvalidCell('Unknown Matrix cell field', { field: unknownKey })
    return values
}

type MatrixColumns = {
    cellId: string
    parentCellId: string
    rowKey: string
    colKey: string
    rowLabel?: string
    colLabel?: string
}

const resolveMatrixColumns = (contract: ObjectContract): MatrixColumns => ({
    cellId: assertColumn(getChildField(contract, 'CellId'), 'InterpretationMatrix.CellId'),
    parentCellId: assertColumn(getChildField(contract, 'ParentCellId'), 'InterpretationMatrix.ParentCellId'),
    rowKey: assertColumn(getChildField(contract, 'RowKey'), 'InterpretationMatrix.RowKey'),
    colKey: assertColumn(getChildField(contract, 'ColKey'), 'InterpretationMatrix.ColKey'),
    rowLabel: getChildField(contract, 'RowLabel')?.column_name,
    colLabel: getChildField(contract, 'ColLabel')?.column_name
})

const assertInterpretationExists = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    interpretationId: string
): Promise<void> => {
    const interpretation = await selectRowById(executor, {
        schemaName: ctx.schemaName,
        contract: surface.contracts.Interpretation,
        rowId: interpretationId,
        workspaceId: ctx.currentWorkspaceId,
        forUpdate: true
    })
    if (!interpretation) {
        throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.rowNotFound, 'Interpretation was not found')
    }
    if (interpretation._upl_locked === true) {
        throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.invalidCell, 'Interpretation is locked')
    }
}

const normalizeComparable = (value: unknown): string => JSON.stringify(value ?? null)

const validateMatrixState = (rows: Array<Record<string, unknown>>, columns: MatrixColumns): void => {
    const rowByCellId = new Map<string, Record<string, unknown>>()
    const coordinateOwners = new Map<string, string>()
    const rowLabels = new Map<string, string>()
    const colLabels = new Map<string, string>()

    for (const row of rows) {
        const cellId = String(row[columns.cellId] ?? '').trim()
        const rowKey = String(row[columns.rowKey] ?? '').trim()
        const colKey = String(row[columns.colKey] ?? '').trim()
        if (!cellId || !rowKey || !colKey) failInvalidCell('Every Matrix cell must have a server-owned identity and coordinates')
        if (rowByCellId.has(cellId)) failInvalidCell('Duplicate Matrix CellId', { cellId })
        rowByCellId.set(cellId, row)
        const coordinate = `${rowKey}\u0000${colKey}`
        const coordinateOwner = coordinateOwners.get(coordinate)
        if (coordinateOwner) failInvalidCell('Matrix coordinates must be unique', { rowKey, colKey, cellIds: [coordinateOwner, cellId] })
        coordinateOwners.set(coordinate, cellId)

        if (columns.rowLabel) {
            const label = normalizeComparable(row[columns.rowLabel])
            const expected = rowLabels.get(rowKey)
            if (expected !== undefined && expected !== label)
                failInvalidCell('Cells on the same row axis must use the same label', { rowKey })
            rowLabels.set(rowKey, label)
        }
        if (columns.colLabel) {
            const label = normalizeComparable(row[columns.colLabel])
            const expected = colLabels.get(colKey)
            if (expected !== undefined && expected !== label)
                failInvalidCell('Cells on the same column axis must use the same label', { colKey })
            colLabels.set(colKey, label)
        }
    }

    for (const [cellId, row] of rowByCellId) {
        const parentCellId = String(row[columns.parentCellId] ?? '').trim()
        if (!parentCellId) continue
        if (!rowByCellId.has(parentCellId)) failInvalidCell('Matrix parent cell does not exist', { cellId, parentCellId })
        const visited = new Set<string>([cellId])
        let cursor = parentCellId
        while (cursor) {
            if (visited.has(cursor)) failInvalidCell('Matrix hierarchy cycle is not allowed', { cellId })
            visited.add(cursor)
            cursor = String(rowByCellId.get(cursor)?.[columns.parentCellId] ?? '').trim()
        }
    }
}

const toResponseItem = (row: Record<string, unknown>, contract: ObjectContract): Record<string, unknown> => {
    const item = { ...row }
    for (const field of Object.values(contract.childFields)) item[field.codename] = row[field.column_name] ?? null
    return item
}

export const createInterpretationNetworkMatrixCell = async (
    ctx: RuntimeSchemaContext,
    runtimeSurface: InterpretationNetworkRuntimeSurface,
    input: { interpretationId: string; data: Record<string, unknown>; placement: MatrixCellPlacementIntent }
): Promise<{ id: string; status: 'created'; item: Record<string, unknown> }> => {
    const surface = assertReadySurface(runtimeSurface, 'createMatrixCell')
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const contract = surface.contracts.Interpretation
    const columns = resolveMatrixColumns(contract)
    const clientValues = prepareClientChildValues(contract, input.data)

    return ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `create-matrix-cell:${input.interpretationId}`)
        await assertInterpretationExists(tx, ctx, surface, input.interpretationId)
        const currentRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract,
            parentId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const { maxRows } = getTableRowLimits(contract.table?.validation_rules ?? undefined)
        if (maxRows !== null && currentRows.length >= maxRows) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                `Interpretation Matrix allows at most ${maxRows} row(s)`,
                { maxRows, currentRows: currentRows.length }
            )
        }
        const cellId = generateUuidV7()
        const parentCellId = input.placement.parentCellId ?? null
        const rowKey = input.placement.rowKey ?? `row-${cellId}`
        const colKey = input.placement.colKey ?? `column-${cellId}`
        const siblingRows = currentRows.filter((row) => String(row[columns.parentCellId] ?? '').trim() === (parentCellId ?? ''))
        const sortOrder =
            input.placement.sortOrder ??
            (siblingRows.length === 0 ? 0 : Math.max(...siblingRows.map((row) => Number(row._tp_sort_order ?? 0))) + 1)
        const nextRow: Record<string, unknown> = {
            id: generateUuidV7(),
            _tp_parent_id: input.interpretationId,
            _tp_sort_order: sortOrder,
            _upl_version: 1,
            ...clientValues,
            [columns.cellId]: cellId,
            [columns.parentCellId]: parentCellId,
            [columns.rowKey]: rowKey,
            [columns.colKey]: colKey
        }
        validateMatrixState([...currentRows, nextRow], columns)

        const childMeta = new Map<string, RuntimeTableChildComponentMeta>(
            Object.values(contract.childFields).map((field) => [
                field.column_name,
                { column_name: field.column_name, data_type: field.data_type, validation_rules: field.validation_rules ?? undefined }
            ])
        )
        const dataColumns = Object.keys(nextRow).filter((column) => IDENTIFIER_REGEX.test(column) && childMeta.has(column))
        const insertColumns = ['id', '_tp_parent_id', '_tp_sort_order']
        const values: unknown[] = [nextRow.id, input.interpretationId, sortOrder]
        if (ctx.currentWorkspaceId) {
            insertColumns.push(quoteIdentifier('workspace_id'))
            values.push(ctx.currentWorkspaceId)
        }
        insertColumns.push('_upl_created_by', '_upl_updated_by')
        values.push(ctx.userId, ctx.userId)
        insertColumns.push(...dataColumns.map(quoteIdentifier))
        values.push(...dataColumns.map((column) => normalizeRuntimeTableChildInsertValueByMeta(nextRow[column], childMeta.get(column))))
        const placeholders = values.map((_, index) => `$${index + 1}`)
        const returningColumns = [
            'id',
            '_tp_sort_order',
            '_upl_version',
            ...Object.values(contract.childFields).map((field) => quoteIdentifier(field.column_name))
        ]
        const [inserted] = await tx.query<Record<string, unknown>>(
            `INSERT INTO ${childTableIdent(ctx.schemaName, contract)} (${insertColumns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING ${returningColumns.join(', ')}`,
            values
        )
        if (!inserted?.id) {
            throw new InterpretationNetworkCommandError(500, 'INTERPRETATION_NETWORK_CELL_INSERT_FAILED', 'Failed to create Matrix cell')
        }
        return { id: String(inserted.id), status: 'created' as const, item: toResponseItem(inserted, contract) }
    })
}

export const moveInterpretationNetworkMatrixCells = async (
    ctx: RuntimeSchemaContext,
    runtimeSurface: InterpretationNetworkRuntimeSurface,
    input: { interpretationId: string; updates: MatrixCellMoveIntent[] }
): Promise<{ status: 'ok'; updated: string[] }> => {
    const surface = assertReadySurface(runtimeSurface, 'moveMatrixCells')
    assertRuntimePermissions(ctx, 'editContent')
    const contract = surface.contracts.Interpretation
    const columns = resolveMatrixColumns(contract)
    const duplicateId = input.updates.find(
        (update, index) => input.updates.findIndex((candidate) => candidate.matrixRowId === update.matrixRowId) !== index
    )?.matrixRowId
    if (duplicateId) failInvalidCell('Duplicate Matrix row in move request', { matrixRowId: duplicateId })
    const preparedUpdates = input.updates.map((update) => ({ ...update, values: prepareClientChildValues(contract, update.data ?? {}) }))

    return ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `move-matrix-cells:${input.interpretationId}`)
        await assertInterpretationExists(tx, ctx, surface, input.interpretationId)
        const currentRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract,
            parentId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const byId = new Map(currentRows.map((row) => [String(row.id), row]))
        const nextRows = currentRows.map((row) => ({ ...row }))
        const nextById = new Map(nextRows.map((row) => [String(row.id), row]))
        for (const update of preparedUpdates) {
            const current = byId.get(update.matrixRowId)
            const next = nextById.get(update.matrixRowId)
            if (!current || !next) {
                throw new InterpretationNetworkCommandError(
                    404,
                    interpretationNetworkCommandErrorCodes.rowNotFound,
                    'Matrix cell was not found',
                    {
                        matrixRowId: update.matrixRowId
                    }
                )
            }
            const actualVersion = Number(current._upl_version ?? 1)
            if (update.expectedVersion !== undefined && update.expectedVersion !== actualVersion) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.versionConflict,
                    'Matrix cell version conflict',
                    {
                        matrixRowId: update.matrixRowId,
                        expectedVersion: update.expectedVersion,
                        actualVersion
                    }
                )
            }
            Object.assign(next, update.values)
            if (update.placement.parentCellId !== undefined) next[columns.parentCellId] = update.placement.parentCellId
            if (update.placement.rowKey !== undefined) next[columns.rowKey] = update.placement.rowKey
            if (update.placement.colKey !== undefined) next[columns.colKey] = update.placement.colKey
            if (update.placement.sortOrder !== undefined) next._tp_sort_order = update.placement.sortOrder
        }
        validateMatrixState(nextRows, columns)

        for (const update of preparedUpdates) {
            const setValues: Record<string, unknown> = { ...update.values }
            if (update.placement.parentCellId !== undefined) setValues[columns.parentCellId] = update.placement.parentCellId
            if (update.placement.rowKey !== undefined) setValues[columns.rowKey] = update.placement.rowKey
            if (update.placement.colKey !== undefined) setValues[columns.colKey] = update.placement.colKey
            const values: unknown[] = []
            const sets: string[] = []
            for (const [column, value] of Object.entries(setValues)) {
                values.push(value)
                sets.push(`${quoteIdentifier(column)} = $${values.length}`)
            }
            if (update.placement.sortOrder !== undefined) {
                values.push(update.placement.sortOrder)
                sets.push(`_tp_sort_order = $${values.length}`)
            }
            values.push(ctx.userId)
            sets.push(`_upl_updated_by = $${values.length}`, '_upl_updated_at = NOW()', '_upl_version = COALESCE(_upl_version, 1) + 1')
            values.push(update.matrixRowId, input.interpretationId)
            const where = [
                `id = $${values.length - 1}`,
                `_tp_parent_id = $${values.length}`,
                activeWorkspaceWhere(ctx.currentWorkspaceId, values)
            ]
            if (update.expectedVersion !== undefined) {
                values.push(update.expectedVersion)
                where.push(`COALESCE(_upl_version, 1) = $${values.length}`)
            }
            const updated = await tx.query<{ id: string }>(
                `UPDATE ${childTableIdent(ctx.schemaName, contract)} SET ${sets.join(', ')}
                 WHERE ${where.join(' AND ')} RETURNING id`,
                values
            )
            if (updated.length !== 1) {
                throw new InterpretationNetworkCommandError(
                    update.expectedVersion === undefined ? 404 : 409,
                    update.expectedVersion === undefined
                        ? interpretationNetworkCommandErrorCodes.rowNotFound
                        : interpretationNetworkCommandErrorCodes.versionConflict,
                    update.expectedVersion === undefined ? 'Matrix cell was not found' : 'Matrix cell version conflict',
                    { matrixRowId: update.matrixRowId, expectedVersion: update.expectedVersion }
                )
            }
        }
        return { status: 'ok' as const, updated: preparedUpdates.map((update) => update.matrixRowId) }
    })
}
