import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { quoteIdentifier } from '../../shared/runtimeHelpers'
import { z } from 'zod'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import {
    InterpretationNetworkCommandError,
    acquireCommandLock,
    activeWorkspaceWhere,
    assertColumn,
    assertReadySurface,
    assertRuntimePermissions,
    childTableIdent,
    findFieldByColumnOrCodename,
    getChildField,
    getField,
    insertRow,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkMaterialCreateRequestSchema,
    prepareObjectValues,
    tableIdent,
    type InterpretationNetworkRuntimeSurface,
    type MaterialCreateResult
} from './runtimeInterpretationNetworkCore'

/** Creates a Material and atomically attaches it to a trusted Matrix cell. */
export const createMaterialForCell = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkMaterialCreateRequestSchema>
): Promise<MaterialCreateResult> => {
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const surface = assertReadySurface(surfaceInput, 'createMaterialForCell')
    const materialContract = surface.contracts.Material
    const interpretationContract = surface.contracts.Interpretation
    const materialCellIdColumn = assertColumn(getField(materialContract, 'CellId'), 'Material.CellId')
    const matrixCellIdColumn = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    const matrixMaterialRefColumn = assertColumn(getChildField(interpretationContract, 'MaterialRef'), 'InterpretationMatrix.MaterialRef')
    const requestedFields = Object.keys(input.data)
        .map((key) => findFieldByColumnOrCodename(materialContract, key))
        .filter(Boolean)
    const serverOwnedInputField = requestedFields.find((field) => field?.ui_config?.serverOwned === true)
    if (serverOwnedInputField) {
        throw new InterpretationNetworkCommandError(
            400,
            interpretationNetworkCommandErrorCodes.invalidMaterial,
            `Field is server-owned: ${serverOwnedInputField.codename}`
        )
    }
    let afterMaterialCreate: RuntimeLifecycleDispatchRequest | null = null

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, 'create-material')
        const interpretationValues: unknown[] = [input.interpretationId]
        const interpretations = await tx.query<Record<string, unknown>>(
            `SELECT id, _upl_locked
             FROM ${tableIdent(ctx.schemaName, interpretationContract.object)}
             WHERE id = $1 AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, interpretationValues)}
             FOR UPDATE`,
            interpretationValues
        )
        if (interpretations.length === 0) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Matrix record was not found'
            )
        }
        if (interpretations[0]._upl_locked === true) {
            throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.rowNotFound, 'Matrix record is locked')
        }

        const childValues: unknown[] = [input.matrixRowId, input.interpretationId]
        const childRows = await tx.query<Record<string, unknown>>(
            `SELECT id, _upl_version, ${quoteIdentifier(matrixCellIdColumn)}, ${quoteIdentifier(matrixMaterialRefColumn)}
             FROM ${childTableIdent(ctx.schemaName, interpretationContract)}
             WHERE id = $1 AND _tp_parent_id = $2 AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, childValues)}
             FOR UPDATE`,
            childValues
        )
        const childRow = childRows[0]
        if (!childRow) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Matrix cell was not found'
            )
        }
        if (String(childRow[matrixCellIdColumn] ?? '').trim() !== input.cellId) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Matrix cell identity changed'
            )
        }
        const actualVersion = Number(childRow._upl_version ?? 1)
        if (input.expectedVersion !== undefined && actualVersion !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell version conflict',
                {
                    expectedVersion: input.expectedVersion,
                    actualVersion
                }
            )
        }
        if (typeof childRow[matrixMaterialRefColumn] === 'string' && childRow[matrixMaterialRefColumn].trim()) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Matrix cell already has a material'
            )
        }

        const materialValues = prepareObjectValues(materialContract, input.data, {
            allowedCodenames: new Set(['Title', 'Description', 'Body']),
            serverValues: { [materialCellIdColumn]: input.cellId }
        })
        const touchedComponentIds = Object.values(materialContract.fields)
            .filter((field) => Object.prototype.hasOwnProperty.call(materialValues, field.column_name))
            .map((field) => field.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        await dispatchRuntimeLifecycle(tx, {
            applicationId: surface.applicationId,
            schemaName: ctx.schemaName,
            objectCollection: materialContract.object,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            componentIds: touchedComponentIds,
            payload: {
                eventName: 'beforeCreate',
                patch: materialValues,
                metadata: {
                    aggregateCommand: 'createMaterialForCell',
                    interpretationId: input.interpretationId,
                    matrixRowId: input.matrixRowId,
                    cellId: input.cellId
                }
            }
        })
        const materialId = await insertRow(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            values: materialValues,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })

        const updateValues: unknown[] = [materialId, ctx.userId, input.matrixRowId, input.interpretationId, input.cellId]
        const updateWorkspaceWhere = activeWorkspaceWhere(ctx.currentWorkspaceId, updateValues)
        let versionClause = ''
        if (input.expectedVersion !== undefined) {
            updateValues.push(input.expectedVersion)
            versionClause = `AND COALESCE(_upl_version, 1) = $${updateValues.length}`
        }
        const updated = await tx.query<{ id: string }>(
            `UPDATE ${childTableIdent(ctx.schemaName, interpretationContract)}
             SET ${quoteIdentifier(matrixMaterialRefColumn)} = $1,
                 _upl_updated_at = NOW(), _upl_updated_by = $2,
                 _upl_version = COALESCE(_upl_version, 1) + 1
             WHERE id = $3 AND _tp_parent_id = $4
               AND ${quoteIdentifier(matrixCellIdColumn)} = $5
               AND ${updateWorkspaceWhere} ${versionClause}
             RETURNING id`,
            updateValues
        )
        if (updated.length !== 1) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell version conflict'
            )
        }
        afterMaterialCreate = {
            applicationId: surface.applicationId,
            schemaName: ctx.schemaName,
            objectCollection: materialContract.object,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            componentIds: touchedComponentIds,
            payload: {
                eventName: 'afterCreate',
                row: { id: materialId, ...materialValues },
                patch: materialValues,
                metadata: {
                    aggregateCommand: 'createMaterialForCell',
                    interpretationId: input.interpretationId,
                    matrixRowId: input.matrixRowId,
                    cellId: input.cellId
                }
            }
        }
        return { id: materialId, matrixRowId: input.matrixRowId }
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterMaterialCreate)
    return result
}
