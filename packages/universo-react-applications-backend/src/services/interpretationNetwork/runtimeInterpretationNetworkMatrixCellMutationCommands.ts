import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { IDENTIFIER_REGEX, quoteIdentifier } from '../../shared/runtimeHelpers'
import { acquireInterpretationNetworkMatrixMembershipLock } from './runtimeInterpretationNetworkMatrixMembership'
import {
    InterpretationNetworkCommandError,
    acquireCommandLock,
    activeWorkspaceWhere,
    assertColumn,
    assertReadySurface,
    assertInterpretationNetworkAggregatePolicyValid,
    assertRuntimePermissions,
    childTableIdent,
    getField,
    interpretationNetworkCommandErrorCodes,
    loadChildRows,
    type InterpretationNetworkRuntimeSurface
} from './runtimeInterpretationNetworkCore'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import { buildLifecycleRequest, collectLifecycleFieldIds } from './runtimeInterpretationNetworkLifecycle'
import {
    assertMaterialAggregatePolicy,
    loadMaterialsByIdsOrCellIds,
    softDeleteMaterialAggregateRow
} from './runtimeInterpretationNetworkMaterials'
import { removeInterpretationNetworkFavoritesForTarget } from './runtimeInterpretationNetworkFavorites'
import {
    assertInterpretationExists,
    hasCellStylePolicyFields,
    normalizeComparable,
    prepareClientChildValues,
    resolveMatrixColumns,
    validateMatrixState,
    validateTouchedCellStylePolicy
} from './runtimeInterpretationNetworkMatrixCommandSupport'
import { resolveMatrixMutationSurface, type InterpretationNetworkMatrixMutationContext } from './runtimeInterpretationNetworkMatrixPolicy'

/** Edits one Matrix cell by semantic CellId and fans shared axis-label changes out server-side. */
export const updateInterpretationNetworkMatrixCell = async (
    ctx: RuntimeSchemaContext,
    runtimeSurface: InterpretationNetworkRuntimeSurface,
    input: { interpretationId: string; cellId: string; data: Record<string, unknown>; expectedCellVersion: number },
    mutationContext?: InterpretationNetworkMatrixMutationContext
): Promise<{ cellId: string; version: number }> => {
    const surface = assertReadySurface(runtimeSurface, 'updateMatrixCell')
    assertRuntimePermissions(ctx, 'editContent')
    const contract = surface.contracts.Interpretation
    assertInterpretationNetworkAggregatePolicyValid(contract.object.config)
    const columns = resolveMatrixColumns(contract)
    const values = prepareClientChildValues(contract, input.data)
    const needsFreshPolicy = hasCellStylePolicyFields(contract, values)
    const cellId = input.cellId.trim().toLowerCase()
    let afterRequests: RuntimeLifecycleDispatchRequest[] = []

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `update-matrix-cell:${input.interpretationId}:${cellId}`)
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
        const byCellId = new Map(
            currentRows.map((row) => [
                String(row[columns.cellId] ?? '')
                    .trim()
                    .toLowerCase(),
                row
            ])
        )
        const source = byCellId.get(cellId)
        if (!source) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Matrix cell was not found',
                { cellId: input.cellId }
            )
        }
        const actualVersion = Number(source._upl_version ?? 1)
        if (actualVersion !== input.expectedCellVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell version conflict',
                { expectedVersion: input.expectedCellVersion, actualVersion }
            )
        }
        validateTouchedCellStylePolicy(policySurface, contract, values, source)

        const rowLabelColumn = columns.rowLabel
        const colLabelColumn = columns.colLabel
        const rowLabelChanged = Boolean(
            rowLabelColumn &&
                Object.prototype.hasOwnProperty.call(values, rowLabelColumn) &&
                normalizeComparable(source[rowLabelColumn]) !== normalizeComparable(values[rowLabelColumn])
        )
        const colLabelChanged = Boolean(
            colLabelColumn &&
                Object.prototype.hasOwnProperty.call(values, colLabelColumn) &&
                normalizeComparable(source[colLabelColumn]) !== normalizeComparable(values[colLabelColumn])
        )
        const planned = new Map<string, { row: Record<string, unknown>; values: Record<string, unknown> }>()
        planned.set(String(source.id), { row: source, values })

        for (const peer of currentRows) {
            if (peer.id === source.id) continue
            const peerValues: Record<string, unknown> = {}
            if (rowLabelChanged && rowLabelColumn && peer[columns.rowKey] === source[columns.rowKey]) {
                peerValues[rowLabelColumn] = values[rowLabelColumn]
            }
            if (colLabelChanged && colLabelColumn && peer[columns.colKey] === source[columns.colKey]) {
                peerValues[colLabelColumn] = values[colLabelColumn]
            }
            if (Object.keys(peerValues).length > 0) planned.set(String(peer.id), { row: peer, values: peerValues })
        }

        const nextRows = currentRows.map((row) => {
            const update = planned.get(String(row.id))
            return update ? { ...row, ...update.values } : row
        })
        validateMatrixState(nextRows, columns)

        const after: RuntimeLifecycleDispatchRequest[] = []
        let sourceVersion = actualVersion
        for (const [rowId, update] of planned) {
            const componentIds = Object.values(contract.childFields)
                .filter((field) => Object.prototype.hasOwnProperty.call(update.values, field.column_name))
                .map((field) => field.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
            await dispatchRuntimeLifecycle(
                tx,
                buildLifecycleRequest(
                    ctx,
                    surface,
                    contract,
                    {
                        eventName: 'beforeUpdate',
                        previousRow: update.row,
                        patch: update.values,
                        metadata: {
                            aggregateCommand: 'updateInterpretationNetworkMatrixCell',
                            interpretationId: input.interpretationId,
                            cellId
                        }
                    },
                    componentIds
                )
            )
            const setClauses: string[] = []
            const params: unknown[] = []
            for (const [column, value] of Object.entries(update.values)) {
                if (!IDENTIFIER_REGEX.test(column)) continue
                params.push(value)
                setClauses.push(`${quoteIdentifier(column)} = $${params.length}`)
            }
            params.push(ctx.userId)
            setClauses.push(
                `_upl_updated_by = $${params.length}`,
                '_upl_updated_at = NOW()',
                '_upl_version = COALESCE(_upl_version, 1) + 1'
            )
            params.push(rowId, input.interpretationId)
            const where = [
                `id = $${params.length - 1}`,
                `_tp_parent_id = $${params.length}`,
                activeWorkspaceWhere(ctx.currentWorkspaceId, params)
            ]
            if (rowId === String(source.id)) {
                params.push(input.expectedCellVersion)
                where.push(`COALESCE(_upl_version, 1) = $${params.length}`)
            }
            const changed = await tx.query<{ id: string; _upl_version: number }>(
                `UPDATE ${childTableIdent(ctx.schemaName, contract)}
                 SET ${setClauses.join(', ')}
                 WHERE ${where.join(' AND ')}
                 RETURNING id, _upl_version`,
                params
            )
            if (changed.length !== 1) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.versionConflict,
                    'Matrix cell changed while the update was being applied',
                    { cellId: rowId === String(source.id) ? input.cellId : undefined }
                )
            }
            if (rowId === String(source.id)) sourceVersion = Number(changed[0]._upl_version)
            after.push(
                buildLifecycleRequest(
                    ctx,
                    surface,
                    contract,
                    {
                        eventName: 'afterUpdate',
                        row: { ...update.row, ...update.values, _upl_version: changed[0]._upl_version },
                        previousRow: update.row,
                        patch: update.values,
                        metadata: {
                            aggregateCommand: 'updateInterpretationNetworkMatrixCell',
                            interpretationId: input.interpretationId,
                            cellId
                        }
                    },
                    componentIds
                )
            )
        }
        afterRequests = after
        return { cellId: input.cellId, version: sourceVersion }
    })

    afterRequests.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
    return result
}

/** Deletes a leaf Matrix cell and every attached Material as one aggregate mutation. */
export const deleteInterpretationNetworkMatrixCell = async (
    ctx: RuntimeSchemaContext,
    runtimeSurface: InterpretationNetworkRuntimeSurface,
    input: { interpretationId: string; cellId: string; expectedCellVersion: number }
): Promise<{ cellId: string; deletedMaterialCount: number }> => {
    const surface = assertReadySurface(runtimeSurface, 'deleteMatrixCell')
    assertRuntimePermissions(ctx, 'deleteContent')
    const contract = surface.contracts.Interpretation
    assertInterpretationNetworkAggregatePolicyValid(contract.object.config)
    const columns = resolveMatrixColumns(contract)
    const cellId = input.cellId.trim().toLowerCase()
    const materialContract = surface.contracts.Material
    const materialCellIdColumn = assertColumn(getField(materialContract, 'CellId'), 'Material.CellId')
    const afterRequests: RuntimeLifecycleDispatchRequest[] = []

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, `delete-matrix-cell:${input.interpretationId}:${cellId}`)
        await assertInterpretationExists(tx, ctx, surface, input.interpretationId)
        await acquireInterpretationNetworkMatrixMembershipLock(tx, surface, input.interpretationId)
        const rows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract,
            parentId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const target = rows.find(
            (row) =>
                String(row[columns.cellId] ?? '')
                    .trim()
                    .toLowerCase() === cellId
        )
        if (!target) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Matrix cell was not found',
                { cellId: input.cellId }
            )
        }
        const actualVersion = Number(target._upl_version ?? 1)
        if (actualVersion !== input.expectedCellVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell version conflict',
                { expectedVersion: input.expectedCellVersion, actualVersion }
            )
        }
        if (
            rows.some(
                (row) =>
                    String(row[columns.parentCellId] ?? '')
                        .trim()
                        .toLowerCase() === cellId
            )
        ) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Move or delete child cells before deleting this cell'
            )
        }
        if (surface.widgetConfig.matrixMode === 'hierarchicalCells' && !String(target[columns.parentCellId] ?? '').trim()) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'The root Matrix cell cannot be deleted'
            )
        }

        assertMaterialAggregatePolicy(materialContract)
        const materials = await loadMaterialsByIdsOrCellIds(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialIds: [],
            cellIds: [String(target[columns.cellId])],
            interpretationId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const materialRows = materials.filter(
            (material) => String(material[materialCellIdColumn] ?? '').trim() === String(target[columns.cellId])
        )
        const childComponentIds = Object.values(contract.childFields)
            .map((field) => field.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                contract,
                {
                    eventName: 'beforeDelete',
                    previousRow: target,
                    metadata: {
                        aggregateCommand: 'deleteInterpretationNetworkMatrixCell',
                        interpretationId: input.interpretationId,
                        cellId
                    }
                },
                childComponentIds
            )
        )
        for (const material of materialRows) {
            await dispatchRuntimeLifecycle(
                tx,
                buildLifecycleRequest(
                    ctx,
                    surface,
                    materialContract,
                    {
                        eventName: 'beforeDelete',
                        previousRow: material,
                        metadata: {
                            aggregateCommand: 'deleteInterpretationNetworkMatrixCell',
                            interpretationId: input.interpretationId,
                            cellId
                        }
                    },
                    collectLifecycleFieldIds(materialContract, material)
                )
            )
            await softDeleteMaterialAggregateRow(tx, {
                schemaName: ctx.schemaName,
                contract: materialContract,
                materialId: String(material.id),
                workspaceId: ctx.currentWorkspaceId,
                userId: ctx.userId,
                expectedVersion: Number(material._upl_version ?? 1)
            })
            afterRequests.push(
                buildLifecycleRequest(
                    ctx,
                    surface,
                    materialContract,
                    {
                        eventName: 'afterDelete',
                        previousRow: material,
                        metadata: {
                            aggregateCommand: 'deleteInterpretationNetworkMatrixCell',
                            interpretationId: input.interpretationId,
                            cellId
                        }
                    },
                    collectLifecycleFieldIds(materialContract, material)
                )
            )
        }
        await removeInterpretationNetworkFavoritesForTarget(ctx, tx, surface, {
            interpretationId: input.interpretationId,
            cellId
        })

        const deleteValues: unknown[] = [ctx.userId, String(target.id), input.interpretationId]
        const where = [
            'id = $2',
            '_tp_parent_id = $3',
            activeWorkspaceWhere(ctx.currentWorkspaceId, deleteValues),
            `COALESCE(_upl_version, 1) = $${deleteValues.length + 1}`
        ]
        deleteValues.push(input.expectedCellVersion)
        const deleted = await tx.query<{ id: string }>(
            `UPDATE ${childTableIdent(ctx.schemaName, contract)}
             SET _upl_deleted = true,
                 _app_deleted = true,
                 _upl_deleted_at = NOW(),
                 _app_deleted_at = NOW(),
                 _upl_deleted_by = $1,
                 _app_deleted_by = $1,
                 _upl_updated_by = $1,
                 _upl_updated_at = NOW(),
                 _upl_version = COALESCE(_upl_version, 1) + 1
             WHERE ${where.join(' AND ')}
             RETURNING id`,
            deleteValues
        )
        if (deleted.length !== 1) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell changed while it was being deleted',
                { cellId: input.cellId }
            )
        }
        afterRequests.push(
            buildLifecycleRequest(
                ctx,
                surface,
                contract,
                {
                    eventName: 'afterDelete',
                    previousRow: target,
                    metadata: {
                        aggregateCommand: 'deleteInterpretationNetworkMatrixCell',
                        interpretationId: input.interpretationId,
                        cellId
                    }
                },
                childComponentIds
            )
        )
        return { cellId: input.cellId, deletedMaterialCount: materialRows.length }
    })

    afterRequests.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
    return result
}
