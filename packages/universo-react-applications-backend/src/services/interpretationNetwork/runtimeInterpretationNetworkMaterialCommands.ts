import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { quoteIdentifier } from '../../shared/runtimeHelpers'
import { z } from 'zod'
import { uuidV7Schema } from '@universo-react/types'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import { buildLifecycleRequest, collectLifecycleFieldIds } from './runtimeInterpretationNetworkLifecycle'
import {
    InterpretationNetworkCommandError,
    activeWorkspaceWhere,
    assertColumn,
    assertReadySurface,
    assertInterpretationNetworkAggregatePolicyValid,
    assertRuntimePermissions,
    childTableIdent,
    findFieldByColumnOrCodename,
    getChildField,
    getField,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkMaterialCreateRequestSchema,
    interpretationNetworkMaterialDeleteRequestSchema,
    interpretationNetworkMaterialPrimaryRequestSchema,
    interpretationNetworkMaterialUpdateRequestSchema,
    prepareObjectValues,
    tableIdent,
    type InterpretationNetworkRuntimeSurface,
    type MaterialCreateResult,
    type ObjectContract,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'
import {
    assertMaterialAggregatePolicy,
    insertMaterialAggregateRow,
    softDeleteMaterialAggregateRow
} from './runtimeInterpretationNetworkMaterials'
import { getMaterialBodyByteLength, MAX_MATERIAL_BODY_BYTES } from './runtimeInterpretationNetworkSchemas'

const MATERIAL_EDITABLE_FIELDS = new Set(['Title', 'Description', 'Body'])

const assertMaterialBodyValueWithinLimit = (value: unknown): void => {
    const byteLength = getMaterialBodyByteLength(value)
    if (byteLength !== null && byteLength <= MAX_MATERIAL_BODY_BYTES) return
    throw new InterpretationNetworkCommandError(
        413,
        interpretationNetworkCommandErrorCodes.invalidMaterial,
        `Material Body must not exceed ${MAX_MATERIAL_BODY_BYTES} UTF-8 bytes`,
        { maxBytes: MAX_MATERIAL_BODY_BYTES, ...(byteLength === null ? {} : { actualBytes: byteLength }) }
    )
}

const assertMaterialBodyWithinLimit = (data: Record<string, unknown>): void => {
    if (Object.prototype.hasOwnProperty.call(data, 'Body')) assertMaterialBodyValueWithinLimit(data.Body)
}

export const interpretationNetworkMaterialAssociationsQuerySchema = z
    .object({
        interpretationId: uuidV7Schema,
        limit: z.coerce.number().int().min(1).max(250).default(100),
        offset: z.coerce.number().int().min(0).max(100_000).default(0)
    })
    .strict()

export type InterpretationNetworkMaterialAssociationsQuery = z.infer<typeof interpretationNetworkMaterialAssociationsQuerySchema>

type MaterialContext = {
    interpretationId: string
    cellId: string
    matrixRowId?: string
    expectedCellVersion?: number
}

type LockedCell = {
    matrixRow: Record<string, unknown>
    cellIdColumn: string
    materialRefColumn: string
    interpretationContract: ObjectContract
}

const materialCellLockKey = (ctx: RuntimeSchemaContext, interpretationId: string, cellId: string): string =>
    `interpretation-network:material:${JSON.stringify([
        ctx.schemaName,
        ctx.currentWorkspaceId,
        interpretationId.toLowerCase(),
        cellId.toLowerCase()
    ])}`

const loadLockedCell = async (ctx: RuntimeSchemaContext, surface: RuntimeSurfaceReady, input: MaterialContext): Promise<LockedCell> => {
    const interpretationContract = surface.contracts.Interpretation
    const interpretationLockedColumn = '_upl_locked'
    const cellIdColumn = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    const materialRefColumn = assertColumn(getChildField(interpretationContract, 'MaterialRef'), 'InterpretationMatrix.MaterialRef')

    await acquireAdvisoryXactLock(ctx.manager, materialCellLockKey(ctx, input.interpretationId, input.cellId))

    const interpretationValues: unknown[] = [input.interpretationId]
    const interpretations = await ctx.manager.query<Record<string, unknown>>(
        `SELECT id, ${quoteIdentifier(interpretationLockedColumn)}
         FROM ${tableIdent(ctx.schemaName, interpretationContract.object)}
         WHERE id = $1 AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, interpretationValues)}
         FOR UPDATE`,
        interpretationValues
    )
    if (interpretations.length !== 1) {
        throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.rowNotFound, 'Interpretation was not found')
    }
    if (interpretations[0]._upl_locked === true) {
        throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.rowNotFound, 'Interpretation is locked')
    }

    const cellValues: unknown[] = [input.interpretationId, input.cellId]
    const cells = await ctx.manager.query<Record<string, unknown>>(
        `SELECT id, _upl_version, ${quoteIdentifier(cellIdColumn)}, ${quoteIdentifier(materialRefColumn)}
         FROM ${childTableIdent(ctx.schemaName, interpretationContract)}
         WHERE _tp_parent_id = $1
           AND ${quoteIdentifier(cellIdColumn)} = $2
           AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, cellValues)}
         FOR UPDATE`,
        cellValues
    )
    if (cells.length !== 1) {
        throw new InterpretationNetworkCommandError(
            cells.length === 0 ? 404 : 409,
            cells.length === 0 ? interpretationNetworkCommandErrorCodes.rowNotFound : interpretationNetworkCommandErrorCodes.invalidMatrix,
            cells.length === 0 ? 'Matrix cell was not found' : 'Matrix contains duplicate CellId values'
        )
    }
    if (input.matrixRowId !== undefined && String(cells[0].id).toLowerCase() !== input.matrixRowId.toLowerCase()) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'Matrix cell identity changed'
        )
    }

    const matrixRow = cells[0]
    if (input.expectedCellVersion !== undefined && Number(matrixRow._upl_version ?? 1) !== input.expectedCellVersion) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.versionConflict,
            'Matrix cell version conflict',
            { expectedVersion: input.expectedCellVersion, actualVersion: Number(matrixRow._upl_version ?? 1) }
        )
    }

    return { matrixRow, cellIdColumn, materialRefColumn, interpretationContract }
}

const loadOwnedMaterial = async (
    ctx: RuntimeSchemaContext,
    contract: ObjectContract,
    materialId: string,
    cellId: string,
    interpretationId: string
): Promise<Record<string, unknown>> => {
    const cellIdColumn = assertColumn(getField(contract, 'CellId'), 'Material.CellId')
    const interpretationIdColumn = assertColumn(getField(contract, 'InterpretationId'), 'Material.InterpretationId')
    const templateOwnerColumn = assertColumn(getField(contract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')
    const values: unknown[] = [materialId, cellId, interpretationId]
    const rows = await ctx.manager.query<Record<string, unknown>>(
        `SELECT *
         FROM ${tableIdent(ctx.schemaName, contract.object)}
         WHERE id = $1
           AND ${quoteIdentifier(cellIdColumn)} = $2
           AND ${quoteIdentifier(interpretationIdColumn)} = $3
           AND ${quoteIdentifier(templateOwnerColumn)} IS NULL
           AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, values)}
         FOR UPDATE`,
        values
    )
    if (rows.length !== 1) {
        throw new InterpretationNetworkCommandError(
            404,
            interpretationNetworkCommandErrorCodes.invalidMaterial,
            'Material was not found for this Matrix cell'
        )
    }
    return rows[0]
}

const normalizeMaterialPatch = (contract: ObjectContract, data: Record<string, unknown>): Record<string, unknown> => {
    const canonical: Record<string, unknown> = {}
    const touchedCodenames = new Set<string>()
    for (const [key, value] of Object.entries(data)) {
        const field = findFieldByColumnOrCodename(contract, key)
        if (!field || !MATERIAL_EDITABLE_FIELDS.has(field.codename) || field.ui_config?.serverOwned === true) {
            throw new InterpretationNetworkCommandError(
                400,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                `Field cannot be edited as Material content: ${field?.codename ?? key}`
            )
        }
        if (touchedCodenames.has(field.codename)) {
            throw new InterpretationNetworkCommandError(
                400,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                `Material field was supplied more than once: ${field.codename}`
            )
        }
        touchedCodenames.add(field.codename)
        canonical[field.codename] = value
    }
    if (Object.keys(canonical).length === 0) {
        throw new InterpretationNetworkCommandError(
            400,
            interpretationNetworkCommandErrorCodes.invalidMaterial,
            'Material content is empty'
        )
    }
    return canonical
}

const buildMaterialUpdateValues = (
    contract: ObjectContract,
    existing: Record<string, unknown>,
    canonicalPatch: Record<string, unknown>
): Record<string, unknown> => {
    const fullCurrentValue: Record<string, unknown> = {}
    for (const codename of MATERIAL_EDITABLE_FIELDS) {
        const field = getField(contract, codename)
        if (field) fullCurrentValue[codename] = existing[field.column_name]
    }
    const normalized = prepareObjectValues(
        contract,
        { ...fullCurrentValue, ...canonicalPatch },
        { allowedCodenames: MATERIAL_EDITABLE_FIELDS }
    )
    const touchedColumns = new Set(
        Object.keys(canonicalPatch)
            .map((codename) => getField(contract, codename)?.column_name)
            .filter((column): column is string => Boolean(column))
    )
    return Object.fromEntries(Object.entries(normalized).filter(([column]) => touchedColumns.has(column)))
}

const updateMaterialValues = async (
    ctx: RuntimeSchemaContext,
    contract: ObjectContract,
    materialId: string,
    values: Record<string, unknown>,
    expectedVersion: number
): Promise<Record<string, unknown>> => {
    const assignments: string[] = []
    const queryValues: unknown[] = []
    for (const [column, value] of Object.entries(values)) {
        queryValues.push(value)
        assignments.push(`${quoteIdentifier(column)} = $${queryValues.length}`)
    }
    queryValues.push(ctx.userId)
    assignments.push(`_upl_updated_by = $${queryValues.length}`, '_upl_updated_at = NOW()', '_upl_version = COALESCE(_upl_version, 1) + 1')
    queryValues.push(materialId)
    const where = [`id = $${queryValues.length}`]
    queryValues.push(expectedVersion)
    where.push(`COALESCE(_upl_version, 1) = $${queryValues.length}`)
    where.push(activeWorkspaceWhere(ctx.currentWorkspaceId, queryValues))
    const rows = await ctx.manager.query<Record<string, unknown>>(
        `UPDATE ${tableIdent(ctx.schemaName, contract.object)}
         SET ${assignments.join(', ')}
         WHERE ${where.join(' AND ')}
         RETURNING *`,
        queryValues
    )
    if (rows.length !== 1) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.versionConflict,
            'Material version conflict',
            { expectedVersion }
        )
    }
    return rows[0]
}

const updatePrimaryPointer = async (
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    cell: LockedCell,
    input: z.infer<typeof interpretationNetworkMaterialPrimaryRequestSchema>,
    primaryMaterialId: string | null
): Promise<{
    primaryMaterialId: string | null
    cellVersion: number
    afterRequest?: RuntimeLifecycleDispatchRequest
}> => {
    const currentPrimary =
        typeof cell.matrixRow[cell.materialRefColumn] === 'string' ? String(cell.matrixRow[cell.materialRefColumn]) : null
    const currentVersion = Number(cell.matrixRow._upl_version ?? 1)
    if (currentPrimary === primaryMaterialId) return { primaryMaterialId, cellVersion: currentVersion }

    const field = getChildField(cell.interpretationContract, 'MaterialRef')
    const componentIds = field?.id ? [field.id] : []
    const patch = { [cell.materialRefColumn]: primaryMaterialId }
    await dispatchRuntimeLifecycle(
        ctx.manager,
        buildLifecycleRequest(
            ctx,
            surface,
            cell.interpretationContract,
            {
                eventName: 'beforeUpdate',
                previousRow: cell.matrixRow,
                patch,
                metadata: {
                    aggregateCommand: primaryMaterialId ? 'setPrimaryMaterial' : 'clearPrimaryMaterial',
                    interpretationId: input.interpretationId,
                    cellId: input.cellId
                }
            },
            componentIds
        )
    )

    const values: unknown[] = [primaryMaterialId, ctx.userId, cell.matrixRow.id, input.interpretationId, input.cellId]
    const workspaceWhere = activeWorkspaceWhere(ctx.currentWorkspaceId, values)
    values.push(input.expectedCellVersion)
    const updated = await ctx.manager.query<{ id: string; _upl_version: number }>(
        `UPDATE ${childTableIdent(ctx.schemaName, cell.interpretationContract)}
         SET ${quoteIdentifier(cell.materialRefColumn)} = $1,
             _upl_updated_at = NOW(),
             _upl_updated_by = $2,
             _upl_version = COALESCE(_upl_version, 1) + 1
         WHERE id = $3
           AND _tp_parent_id = $4
           AND ${quoteIdentifier(cell.cellIdColumn)} = $5
           AND ${workspaceWhere}
           AND COALESCE(_upl_version, 1) = $${values.length}
         RETURNING id, _upl_version`,
        values
    )
    if (updated.length !== 1) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.versionConflict,
            'Matrix cell version conflict'
        )
    }
    const request: RuntimeLifecycleDispatchRequest = buildLifecycleRequest(
        ctx,
        surface,
        cell.interpretationContract,
        {
            eventName: 'afterUpdate',
            row: { ...cell.matrixRow, ...patch, _upl_version: updated[0]._upl_version },
            previousRow: cell.matrixRow,
            patch,
            metadata: {
                aggregateCommand: primaryMaterialId ? 'setPrimaryMaterial' : 'clearPrimaryMaterial',
                interpretationId: input.interpretationId,
                cellId: input.cellId
            }
        },
        componentIds
    )
    return { primaryMaterialId, cellVersion: Number(updated[0]._upl_version), afterRequest: request }
}

/** Creates an attached Material and preserves Primary assignment for v1 row-identity requests. */
export const createMaterialForCell = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkMaterialCreateRequestSchema>
): Promise<MaterialCreateResult> => {
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const surface = assertReadySurface(surfaceInput, 'createMaterialForCell')
    const materialContract = surface.contracts.Material
    assertMaterialAggregatePolicy(materialContract)
    if (input.matrixRowId !== undefined) {
        assertInterpretationNetworkAggregatePolicyValid(surface.contracts.Interpretation.object.config)
    }
    const canonicalData = normalizeMaterialPatch(materialContract, input.data)
    assertMaterialBodyWithinLimit(canonicalData)
    const result = await ctx.manager.transaction(async (tx) => {
        const transactionCtx = { ...ctx, manager: tx }
        const cell = await loadLockedCell(transactionCtx, surface, input)
        const actualCellVersion = Number(cell.matrixRow._upl_version ?? 1)
        if (input.expectedCellVersion !== undefined && actualCellVersion !== input.expectedCellVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Matrix cell version conflict'
            )
        }
        if (input.matrixRowId !== undefined) {
            const currentPrimary = cell.matrixRow[cell.materialRefColumn]
            if (typeof currentPrimary === 'string' && currentPrimary.trim() !== '') {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.invalidMatrix,
                    'Matrix cell already has a material'
                )
            }
        }

        const materialCellIdColumn = assertColumn(getField(materialContract, 'CellId'), 'Material.CellId')
        const materialInterpretationIdColumn = assertColumn(getField(materialContract, 'InterpretationId'), 'Material.InterpretationId')
        const values = prepareObjectValues(materialContract, canonicalData, {
            allowedCodenames: MATERIAL_EDITABLE_FIELDS,
            serverValues: {
                [materialCellIdColumn]: input.cellId,
                [materialInterpretationIdColumn]: input.interpretationId
            }
        })
        if (Object.prototype.hasOwnProperty.call(canonicalData, 'Body')) {
            const bodyColumn = assertColumn(getField(materialContract, 'Body'), 'Material.Body')
            assertMaterialBodyValueWithinLimit(values[bodyColumn])
        }
        const touchedComponentIds = collectLifecycleFieldIds(materialContract, values)
        const beforeRequest = buildLifecycleRequest(
            transactionCtx,
            surface,
            materialContract,
            {
                eventName: 'beforeCreate',
                patch: values,
                metadata: {
                    aggregateCommand: 'createMaterialForCell',
                    interpretationId: input.interpretationId,
                    cellId: input.cellId
                }
            },
            touchedComponentIds
        )
        await dispatchRuntimeLifecycle(tx, beforeRequest)
        const id = await insertMaterialAggregateRow(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            values,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        const afterRequest = buildLifecycleRequest(
            transactionCtx,
            surface,
            materialContract,
            {
                eventName: 'afterCreate',
                row: { id, ...values },
                patch: values,
                metadata: {
                    aggregateCommand: 'createMaterialForCell',
                    interpretationId: input.interpretationId,
                    cellId: input.cellId
                }
            },
            touchedComponentIds
        )
        const primaryResult =
            input.matrixRowId === undefined
                ? undefined
                : await updatePrimaryPointer(
                      transactionCtx,
                      surface,
                      cell,
                      {
                          interpretationId: input.interpretationId,
                          cellId: input.cellId,
                          materialId: id,
                          expectedCellVersion: actualCellVersion
                      },
                      id
                  )
        return {
            id,
            matrixRowId: String(cell.matrixRow.id),
            afterRequest,
            primaryAfterRequest: primaryResult?.afterRequest
        }
    })
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.afterRequest)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.primaryAfterRequest)
    return { id: result.id, matrixRowId: result.matrixRowId }
}

/** Reads only the cell-to-material links for one readable Matrix in the active workspace. */
export const listMaterialAssociationsForInterpretation = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: InterpretationNetworkMaterialAssociationsQuery
): Promise<{
    items: Array<{ cellId: string; materialId: string }>
    page: { offset: number; limit: number; hasMore: boolean }
}> => {
    const surface = assertReadySurface(surfaceInput, 'listMaterialAssociations')
    const interpretationContract = surface.contracts.Interpretation
    const materialContract = surface.contracts.Material
    const cellIdColumn = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    const materialCellIdColumn = assertColumn(getField(materialContract, 'CellId'), 'Material.CellId')
    const materialInterpretationIdColumn = assertColumn(getField(materialContract, 'InterpretationId'), 'Material.InterpretationId')
    const templateOwnerColumn = assertColumn(getField(materialContract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')

    const parentValues: unknown[] = [input.interpretationId]
    const parentRows = await ctx.manager.query<{ id: string }>(
        `SELECT id
         FROM ${tableIdent(ctx.schemaName, interpretationContract.object)}
         WHERE id = $1 AND ${activeWorkspaceWhere(ctx.currentWorkspaceId, parentValues)}`,
        parentValues
    )
    if (parentRows.length !== 1) {
        throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.rowNotFound, 'Interpretation was not found')
    }

    const values: unknown[] = [input.interpretationId]
    const matrixScope = activeWorkspaceWhere(ctx.currentWorkspaceId, values, 'matrix')
    const materialScope = activeWorkspaceWhere(ctx.currentWorkspaceId, values, 'material')
    values.push(input.limit + 1)
    const limitParameter = values.length
    values.push(input.offset)
    const offsetParameter = values.length
    const rows = await ctx.manager.query<{ cellId: string; materialId: string }>(
        `SELECT matrix.${quoteIdentifier(cellIdColumn)} AS "cellId", material.id AS "materialId"
         FROM ${childTableIdent(ctx.schemaName, interpretationContract)} AS matrix
         JOIN ${tableIdent(ctx.schemaName, materialContract.object)} AS material
           ON material.${quoteIdentifier(materialCellIdColumn)} = matrix.${quoteIdentifier(cellIdColumn)}
          AND material.${quoteIdentifier(materialInterpretationIdColumn)} = $1
          AND material.${quoteIdentifier(templateOwnerColumn)} IS NULL
          AND ${materialScope}
         WHERE matrix._tp_parent_id = $1
           AND ${matrixScope}
         ORDER BY matrix.${quoteIdentifier(cellIdColumn)} ASC, material._upl_created_at ASC NULLS LAST, material.id ASC
         LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
        values
    )
    const hasMore = rows.length > input.limit
    return {
        items: rows.slice(0, input.limit).map((row) => ({ cellId: String(row.cellId), materialId: String(row.materialId) })),
        page: { offset: input.offset, limit: input.limit, hasMore }
    }
}

/** Edits authored Material fields while preserving server-owned attachment identity. */
export const updateMaterialForCell = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    materialId: string,
    input: z.infer<typeof interpretationNetworkMaterialUpdateRequestSchema>
): Promise<{ id: string; version: number }> => {
    assertRuntimePermissions(ctx, 'editContent')
    const surface = assertReadySurface(surfaceInput, 'updateMaterialForCell')
    const materialContract = surface.contracts.Material
    assertMaterialAggregatePolicy(materialContract)
    const canonicalPatch = normalizeMaterialPatch(materialContract, input.data)
    assertMaterialBodyWithinLimit(canonicalPatch)
    const result = await ctx.manager.transaction(async (tx) => {
        const transactionCtx = { ...ctx, manager: tx }
        await loadLockedCell(transactionCtx, surface, input)
        const existing = await loadOwnedMaterial(transactionCtx, materialContract, materialId, input.cellId, input.interpretationId)
        const actualVersion = Number(existing._upl_version ?? 1)
        if (actualVersion !== input.expectedMaterialVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Material version conflict',
                { expectedVersion: input.expectedMaterialVersion, actualVersion }
            )
        }
        const values = buildMaterialUpdateValues(materialContract, existing, canonicalPatch)
        if (Object.prototype.hasOwnProperty.call(canonicalPatch, 'Body')) {
            const bodyColumn = assertColumn(getField(materialContract, 'Body'), 'Material.Body')
            assertMaterialBodyValueWithinLimit(values[bodyColumn])
        }
        const componentIds = collectLifecycleFieldIds(materialContract, values)
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                transactionCtx,
                surface,
                materialContract,
                {
                    eventName: 'beforeUpdate',
                    previousRow: existing,
                    patch: values,
                    metadata: { aggregateCommand: 'updateMaterialForCell', interpretationId: input.interpretationId, cellId: input.cellId }
                },
                componentIds
            )
        )
        const updated = await updateMaterialValues(transactionCtx, materialContract, materialId, values, input.expectedMaterialVersion)
        const afterRequest = buildLifecycleRequest(
            transactionCtx,
            surface,
            materialContract,
            {
                eventName: 'afterUpdate',
                row: updated,
                previousRow: existing,
                patch: values,
                metadata: { aggregateCommand: 'updateMaterialForCell', interpretationId: input.interpretationId, cellId: input.cellId }
            },
            componentIds
        )
        return { version: Number(updated._upl_version ?? actualVersion + 1), afterRequest }
    })
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.afterRequest)
    return { id: materialId, version: result.version }
}

/** Explicitly sets, replaces, or clears the cell's optional Primary Material. */
export const setPrimaryMaterialForCell = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkMaterialPrimaryRequestSchema>
): Promise<{ primaryMaterialId: string | null; cellVersion: number }> => {
    assertRuntimePermissions(ctx, 'editContent')
    const surface = assertReadySurface(surfaceInput, 'setPrimaryMaterialForCell')
    assertInterpretationNetworkAggregatePolicyValid(surface.contracts.Interpretation.object.config)
    const materialContract = surface.contracts.Material
    assertMaterialAggregatePolicy(materialContract)
    const result = await ctx.manager.transaction(async (tx) => {
        const transactionCtx = { ...ctx, manager: tx }
        const cell = await loadLockedCell(transactionCtx, surface, input)
        if (input.materialId)
            await loadOwnedMaterial(transactionCtx, materialContract, input.materialId, input.cellId, input.interpretationId)
        return updatePrimaryPointer(transactionCtx, surface, cell, input, input.materialId)
    })
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.afterRequest)
    return { primaryMaterialId: result.primaryMaterialId, cellVersion: result.cellVersion }
}

/** Deletes a Material and clears its Primary pointer atomically when necessary. */
export const deleteMaterialForCell = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    materialId: string,
    input: z.infer<typeof interpretationNetworkMaterialDeleteRequestSchema>
): Promise<{ primaryMaterialCleared: boolean; cellVersion: number }> => {
    assertRuntimePermissions(ctx, 'deleteContent')
    const canonicalMaterialId = materialId.toLowerCase()
    const surface = assertReadySurface(surfaceInput, 'deleteMaterialForCell')
    assertInterpretationNetworkAggregatePolicyValid(surface.contracts.Interpretation.object.config)
    const materialContract = surface.contracts.Material
    assertMaterialAggregatePolicy(materialContract)
    const result = await ctx.manager.transaction(async (tx) => {
        const transactionCtx = { ...ctx, manager: tx }
        const cell = await loadLockedCell(transactionCtx, surface, input)
        const existing = await loadOwnedMaterial(
            transactionCtx,
            materialContract,
            canonicalMaterialId,
            input.cellId,
            input.interpretationId
        )
        const actualMaterialVersion = Number(existing._upl_version ?? 1)
        if (actualMaterialVersion !== input.expectedMaterialVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Material version conflict',
                { expectedVersion: input.expectedMaterialVersion, actualVersion: actualMaterialVersion }
            )
        }
        const primaryMaterialCleared = String(cell.matrixRow[cell.materialRefColumn] ?? '').toLowerCase() === canonicalMaterialId
        let cellVersion = Number(cell.matrixRow._upl_version ?? 1)
        let primaryRequest: RuntimeLifecycleDispatchRequest | undefined
        if (primaryMaterialCleared) {
            const pointerResult = await updatePrimaryPointer(transactionCtx, surface, cell, { ...input, materialId: null }, null)
            cellVersion = pointerResult.cellVersion
            primaryRequest = pointerResult.afterRequest
        }

        const lifecycleFields = collectLifecycleFieldIds(materialContract, existing)
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                transactionCtx,
                surface,
                materialContract,
                {
                    eventName: 'beforeDelete',
                    previousRow: existing,
                    metadata: { aggregateCommand: 'deleteMaterialForCell', interpretationId: input.interpretationId, cellId: input.cellId }
                },
                lifecycleFields
            )
        )
        await softDeleteMaterialAggregateRow(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialId: canonicalMaterialId,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId,
            expectedVersion: input.expectedMaterialVersion
        })
        const afterRequest = buildLifecycleRequest(
            transactionCtx,
            surface,
            materialContract,
            {
                eventName: 'afterDelete',
                row: null,
                previousRow: existing,
                metadata: { aggregateCommand: 'deleteMaterialForCell', interpretationId: input.interpretationId, cellId: input.cellId }
            },
            lifecycleFields
        )
        return { primaryMaterialCleared, cellVersion, primaryRequest, afterRequest }
    })
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.primaryRequest)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, result.afterRequest)
    return { primaryMaterialCleared: result.primaryMaterialCleared, cellVersion: result.cellVersion }
}
