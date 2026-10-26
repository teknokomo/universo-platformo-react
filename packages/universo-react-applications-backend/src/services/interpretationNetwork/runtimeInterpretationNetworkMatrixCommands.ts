import { acquireInterpretationNetworkMatrixMembershipLock } from './runtimeInterpretationNetworkMatrixMembership'
import { generateUuidV7 } from '@universo-react/utils'
import type { RuntimeSchemaContext, RuntimeTableChildComponentMeta } from '../../shared/runtimeHelpers'
import { IDENTIFIER_REGEX, getTableRowLimits, quoteIdentifier } from '../../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    acquireCommandLock,
    assertReadySurface,
    assertInterpretationNetworkAggregatePolicyValid,
    assertRuntimePermissions,
    childTableIdent,
    interpretationNetworkCommandErrorCodes,
    loadChildRows,
    type InterpretationNetworkRuntimeSurface
} from './runtimeInterpretationNetworkCore'
import {
    assertInterpretationExists,
    failInvalidCell,
    hasCellStylePolicyFields,
    prepareClientChildValues,
    resolveMatrixColumns,
    toResponseItem,
    validateMatrixState,
    validateTouchedCellStylePolicy
} from './runtimeInterpretationNetworkMatrixCommandSupport'
import { activeWorkspaceWhere } from './runtimeInterpretationNetworkCore'
import { resolveMatrixMutationSurface, type InterpretationNetworkMatrixMutationContext } from './runtimeInterpretationNetworkMatrixPolicy'

export type MatrixCellPlacementIntent = {
    parentCellId?: string | null
    rowKey?: string
    colKey?: string
    sortOrder?: number
}

export type MatrixCellMoveIntent = {
    cellId: string
    expectedVersion: number
    placement: MatrixCellPlacementIntent
    data?: Record<string, unknown>
}

export const createInterpretationNetworkMatrixCell = async (
    ctx: RuntimeSchemaContext,
    runtimeSurface: InterpretationNetworkRuntimeSurface,
    input: { interpretationId: string; data: Record<string, unknown>; placement: MatrixCellPlacementIntent },
    mutationContext?: InterpretationNetworkMatrixMutationContext
): Promise<{ id: string; status: 'created'; item: Record<string, unknown> }> => {
    const surface = assertReadySurface(runtimeSurface, 'createMatrixCell')
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const contract = surface.contracts.Interpretation
    assertInterpretationNetworkAggregatePolicyValid(contract.object.config)
    const columns = resolveMatrixColumns(contract)
    const clientValues = prepareClientChildValues(contract, input.data)
    const needsFreshPolicy = hasCellStylePolicyFields(contract, clientValues)

    return ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `create-matrix-cell:${input.interpretationId}`)
        const policySurface =
            needsFreshPolicy && mutationContext ? await resolveMatrixMutationSurface(tx, mutationContext, surface) : surface
        validateTouchedCellStylePolicy(policySurface, contract, clientValues)
        await assertInterpretationExists(tx, ctx, surface, input.interpretationId)
        await acquireInterpretationNetworkMatrixMembershipLock(tx, surface, input.interpretationId)
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
        values.push(...dataColumns.map((column) => nextRow[column]))
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
    input: { interpretationId: string; updates: MatrixCellMoveIntent[] },
    mutationContext?: InterpretationNetworkMatrixMutationContext
): Promise<{ status: 'ok'; updated: string[] }> => {
    const surface = assertReadySurface(runtimeSurface, 'moveMatrixCells')
    assertRuntimePermissions(ctx, 'editContent')
    const contract = surface.contracts.Interpretation
    assertInterpretationNetworkAggregatePolicyValid(contract.object.config)
    const columns = resolveMatrixColumns(contract)
    const duplicateId = input.updates.find(
        (update, index) => input.updates.findIndex((candidate) => candidate.cellId === update.cellId) !== index
    )?.cellId
    if (duplicateId) failInvalidCell('Duplicate Matrix cell in move request', { cellId: duplicateId })
    const preparedUpdates = input.updates.map((update) => ({ ...update, values: prepareClientChildValues(contract, update.data ?? {}) }))
    const needsFreshPolicy = preparedUpdates.some((update) => hasCellStylePolicyFields(contract, update.values))

    return ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `move-matrix-cells:${input.interpretationId}`)
        const policySurface =
            needsFreshPolicy && mutationContext ? await resolveMatrixMutationSurface(tx, mutationContext, surface) : surface
        await assertInterpretationExists(tx, ctx, surface, input.interpretationId)
        await acquireInterpretationNetworkMatrixMembershipLock(tx, surface, input.interpretationId)
        const currentRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract,
            parentId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const byCellId = new Map(currentRows.map((row) => [String(row[columns.cellId] ?? '').trim(), row]))
        const nextRows = currentRows.map((row) => ({ ...row }))
        const nextByCellId = new Map(nextRows.map((row) => [String(row[columns.cellId] ?? '').trim(), row]))
        for (const update of preparedUpdates) {
            const current = byCellId.get(update.cellId)
            const next = nextByCellId.get(update.cellId)
            if (!current || !next) {
                throw new InterpretationNetworkCommandError(
                    404,
                    interpretationNetworkCommandErrorCodes.rowNotFound,
                    'Matrix cell was not found',
                    { cellId: update.cellId }
                )
            }
            const actualVersion = Number(current._upl_version ?? 1)
            if (update.expectedVersion !== actualVersion) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.versionConflict,
                    'Matrix cell version conflict',
                    {
                        cellId: update.cellId,
                        expectedVersion: update.expectedVersion,
                        actualVersion
                    }
                )
            }
            validateTouchedCellStylePolicy(policySurface, contract, update.values, current)
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
            values.push(String(byCellId.get(update.cellId)?.id), input.interpretationId)
            const where = [
                `id = $${values.length - 1}`,
                `_tp_parent_id = $${values.length}`,
                activeWorkspaceWhere(ctx.currentWorkspaceId, values)
            ]
            values.push(update.expectedVersion)
            where.push(`COALESCE(_upl_version, 1) = $${values.length}`)
            const updated = await tx.query<{ id: string }>(
                `UPDATE ${childTableIdent(ctx.schemaName, contract)} SET ${sets.join(', ')}
                 WHERE ${where.join(' AND ')} RETURNING id`,
                values
            )
            if (updated.length !== 1) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.versionConflict,
                    'Matrix cell version conflict',
                    { cellId: update.cellId, expectedVersion: update.expectedVersion }
                )
            }
        }
        return { status: 'ok' as const, updated: preparedUpdates.map((update) => update.cellId) }
    })
}

export {
    updateInterpretationNetworkMatrixCell,
    deleteInterpretationNetworkMatrixCell
} from './runtimeInterpretationNetworkMatrixCellMutationCommands'
