import { uuidV7Schema } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { z } from 'zod'
import { getTableRowLimits, type RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import { buildLifecycleRequest, collectLifecycleFieldIds } from './runtimeInterpretationNetworkLifecycle'
import {
    SYSTEM_STRUCTURE_KEY,
    InterpretationNetworkCommandError,
    acquireCommandLock,
    acquireStructureModeLock,
    assertColumn,
    assertReadySurface,
    assertRuntimePermissions,
    assertSingleInterpretation,
    getChildField,
    getField,
    insertChildRows,
    interpretationNetworkCommandErrorCodes,
    loadChildRows,
    loadInterpretationsForStructure,
    loadTemplateRow,
    readTemplateIncludesMaterials,
    selectActiveRowsByField,
    selectRowById,
    type InterpretationNetworkRuntimeSurface
} from './runtimeInterpretationNetworkCore'
import { acquireInterpretationNetworkMatrixMembershipLock } from './runtimeInterpretationNetworkMatrixMembership'
import { cloneMaterials, loadMaterialsByTemplateOwner } from './runtimeInterpretationNetworkMaterials'
import { planMatrixRowsCopy } from './runtimeInterpretationNetworkMatrixCopy'
import {
    hasCellStylePolicyFields,
    resolveMatrixColumns,
    validateMatrixState,
    validateTouchedCellStylePolicy
} from './runtimeInterpretationNetworkMatrixCommandSupport'
import { resolveMatrixMutationSurface, type InterpretationNetworkMatrixMutationContext } from './runtimeInterpretationNetworkMatrixPolicy'
import {
    assertMaterialOwnership,
    assertNoOrdinaryStructuresInSingleSystemMode,
    assertValidMaterialRefs,
    collectCellIds,
    collectMaterialRefs,
    getString
} from './runtimeInterpretationNetworkValidation'

export const interpretationNetworkTemplateApplyRequestSchema = z
    .object({
        interpretationId: uuidV7Schema,
        targetCellId: uuidV7Schema,
        expectedTemplateVersion: z.number().int().positive(),
        expectedTargetVersion: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkTemplateApplyResponseSchema = z
    .object({
        templateId: uuidV7Schema,
        templateVersion: z.number().int().positive(),
        interpretationId: uuidV7Schema,
        targetCellId: uuidV7Schema,
        targetCellVersion: z.number().int().positive(),
        insertedRootCellId: uuidV7Schema,
        insertedCellCount: z.number().int().positive(),
        insertedMaterialCount: z.number().int().nonnegative()
    })
    .strict()

type ApplyInput = z.infer<typeof interpretationNetworkTemplateApplyRequestSchema>

const invalidMatrix = (message: string, details?: Record<string, unknown>): never => {
    throw new InterpretationNetworkCommandError(409, interpretationNetworkCommandErrorCodes.invalidMatrix, message, details)
}

const assertRowCountWithinBounds = (
    rowCount: number,
    tableName: string,
    validationRules: Record<string, unknown> | null | undefined
): void => {
    const { minRows, maxRows } = getTableRowLimits(validationRules ?? undefined)
    if ((minRows !== null && rowCount < minRows) || (maxRows !== null && rowCount > maxRows)) {
        invalidMatrix('The ' + tableName + ' row count is outside its configured bounds', { rowCount, minRows, maxRows })
    }
}

const ensureCollisionFreeAxisKeys = (
    rows: Array<Record<string, unknown>>,
    sourceRows: Array<Record<string, unknown>>,
    sourceColumn: string,
    destinationColumn: string,
    existingRows: Array<Record<string, unknown>>,
    prefix: 'row' | 'column'
): void => {
    if (rows.length !== sourceRows.length) invalidMatrix('Template axis remapping lost Matrix row alignment')
    const occupied = new Set(
        existingRows
            .map((row) =>
                String(row[destinationColumn] ?? '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
    )
    const remapped = new Map<string, string>()

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index]
        const sourceValue = sourceRows[index][sourceColumn]
        const sourceKey = typeof sourceValue === 'string' && sourceValue.trim() ? 'source:' + sourceValue.trim() : 'row:' + index
        let destinationKey = remapped.get(sourceKey)
        if (!destinationKey) {
            for (let attempt = 0; attempt < 16; attempt++) {
                const candidate = prefix + '-' + generateUuidV7()
                const normalizedCandidate = candidate.toLowerCase()
                if (occupied.has(normalizedCandidate)) continue
                destinationKey = candidate
                occupied.add(normalizedCandidate)
                remapped.set(sourceKey, candidate)
                break
            }
        }
        if (!destinationKey) invalidMatrix('Could not allocate a unique ' + prefix + ' axis key')
        row[destinationColumn] = destinationKey
    }
}

const assertFreshCellIds = (
    rows: Array<Record<string, unknown>>,
    cellIdColumn: string,
    existingRows: Array<Record<string, unknown>>
): void => {
    const existing = new Set(
        existingRows
            .map((row) =>
                String(row[cellIdColumn] ?? '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
    )
    const generated = new Set<string>()
    for (const row of rows) {
        const cellId = String(row[cellIdColumn] ?? '').trim()
        const normalizedCellId = cellId.toLowerCase()
        if (!uuidV7Schema.safeParse(cellId).success || existing.has(normalizedCellId) || generated.has(normalizedCellId)) {
            invalidMatrix('Template application did not produce fresh UUID v7 CellIds')
        }
        generated.add(normalizedCellId)
    }
}

const assertTemplateMaterialBindings = (
    templateRows: Array<Record<string, unknown>>,
    materials: Array<Record<string, unknown>>,
    materialRefColumn: string | undefined,
    materialCellIdColumn: string | undefined,
    templateCellIdColumn: string
): void => {
    if (!materialRefColumn) return
    const materialById = new Map(materials.map((material) => [getString(material, 'id'), material]))
    for (const row of templateRows) {
        const materialId = getString(row, materialRefColumn)
        if (!materialId) continue
        const material = materialById.get(materialId)
        if (!material || getString(material, materialCellIdColumn) !== getString(row, templateCellIdColumn)) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                'A template Material reference is not owned by its Matrix cell'
            )
        }
    }
}

/** Appends a saved TableTemplate below one selected Matrix cell in the same workspace. */
export const applyTableTemplateToMatrix = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    templateId: string,
    input: ApplyInput,
    mutationContext?: InterpretationNetworkMatrixMutationContext
): Promise<z.infer<typeof interpretationNetworkTemplateApplyResponseSchema>> => {
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const surface = assertReadySurface(surfaceInput, 'applyTemplate')
    if (surface.structureMode !== 'multiple' && surface.structureMode !== 'singleSystem') {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.unsupportedMode,
            'Applying a Table Template requires a supported Interpretation Network structure mode'
        )
    }
    const matrixMode = surface.widgetConfig.matrixMode ?? 'hierarchicalCells'
    if (matrixMode !== 'hierarchicalCells') {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.unsupportedMode,
            'Applying a Table Template is available only in hierarchicalCells mode',
            { matrixMode }
        )
    }

    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const templateContract = surface.contracts.TableTemplate
    const materialContract = surface.contracts.Material
    const targetParentColumn = assertColumn(getField(interpretationContract, 'ParentStructure'), 'Interpretation.ParentStructure')
    const systemKeyColumn =
        surface.structureMode === 'singleSystem' ? assertColumn(getField(structureContract, 'SystemKey'), 'Structure.SystemKey') : undefined
    const matrixColumns = resolveMatrixColumns(interpretationContract)
    const templateMatrixColumns = resolveMatrixColumns(templateContract)
    const destinationCellIdColumn = matrixColumns.cellId
    const destinationParentCellIdColumn = matrixColumns.parentCellId
    const destinationRowKeyColumn = matrixColumns.rowKey
    const destinationColKeyColumn = matrixColumns.colKey
    const templateCellIdColumn = assertColumn(getChildField(templateContract, 'CellId'), 'TableTemplate.CellId')
    const templateParentCellIdColumn = assertColumn(getChildField(templateContract, 'ParentCellId'), 'TableTemplate.ParentCellId')
    const templateRowKeyColumn = assertColumn(getChildField(templateContract, 'RowKey'), 'TableTemplate.RowKey')
    const templateColKeyColumn = assertColumn(getChildField(templateContract, 'ColKey'), 'TableTemplate.ColKey')
    const templateMaterialRefColumn = getChildField(templateContract, 'MaterialRef')?.column_name
    const destinationMaterialRefColumn = getChildField(interpretationContract, 'MaterialRef')?.column_name
    let afterMaterialCreates: RuntimeLifecycleDispatchRequest[] = []

    const response = await ctx.manager.transaction(async (tx) => {
        // Keep the global lock order aligned with structure-mode mutations and Matrix membership writers.
        await acquireStructureModeLock(tx, surface)
        await acquireCommandLock(tx, surface, 'apply-template')
        const policySurface = mutationContext ? await resolveMatrixMutationSurface(tx, mutationContext, surface) : surface

        const observedInterpretation = await selectRowById(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            rowId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId
        })
        if (!observedInterpretation) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Target Interpretation was not found'
            )
        }

        const structureId = getString(observedInterpretation, targetParentColumn)
        if (!structureId) invalidMatrix('Target Interpretation is not attached to a Structure')
        const targetStructure = await selectRowById(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            rowId: structureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!targetStructure) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Target Structure was not found in the current workspace'
            )
        }
        if (targetStructure._upl_locked === true) {
            throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.invalidCell, 'Structure is locked')
        }
        const targetInterpretation = await selectRowById(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            rowId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!targetInterpretation) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Target Interpretation was not found'
            )
        }
        if (getString(targetInterpretation, targetParentColumn) !== structureId) {
            invalidMatrix('Target Interpretation changed Structure during template application')
        }
        if (targetInterpretation._upl_locked === true) {
            throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.invalidCell, 'Interpretation is locked')
        }

        if (surface.structureMode === 'singleSystem') {
            const primaryStructures = await selectActiveRowsByField(tx, {
                schemaName: ctx.schemaName,
                contract: structureContract,
                field: getField(structureContract, 'SystemKey')!,
                value: SYSTEM_STRUCTURE_KEY,
                workspaceId: ctx.currentWorkspaceId,
                forUpdate: true
            })
            if (primaryStructures.length > 1) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.duplicateSystemStructure,
                    'More than one system Structure exists in this workspace'
                )
            }
            if (primaryStructures.length !== 1 || String(primaryStructures[0].id) !== structureId) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.malformedSystemStructure,
                    'The selected Interpretation is not part of the primary system Structure'
                )
            }
            await assertNoOrdinaryStructuresInSingleSystemMode(tx, {
                schemaName: ctx.schemaName,
                structureContract,
                systemKeyColumn: systemKeyColumn!,
                workspaceId: ctx.currentWorkspaceId,
                allowedSystemStructureId: structureId,
                forUpdate: true
            })
        }

        const structureInterpretations = await loadInterpretationsForStructure(tx, {
            schemaName: ctx.schemaName,
            surface,
            structureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const onlyInterpretation = assertSingleInterpretation(
            structureInterpretations,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'Target Structure must have exactly one Interpretation'
        )
        if (String(onlyInterpretation.id) !== input.interpretationId) {
            invalidMatrix('Target Interpretation does not match the selected Structure')
        }

        await acquireInterpretationNetworkMatrixMembershipLock(tx, surface, input.interpretationId)
        const currentRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: input.interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const targetCellId = input.targetCellId.toLowerCase()
        const targetRow = currentRows.find(
            (row) =>
                String(row[destinationCellIdColumn] ?? '')
                    .trim()
                    .toLowerCase() === targetCellId
        )
        if (!targetRow) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.rowNotFound,
                'Target cell was not found in the selected Interpretation'
            )
        }
        const targetCellVersion = Number(targetRow._upl_version ?? 1)
        if (targetCellVersion !== input.expectedTargetVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Target cell version conflict',
                { expectedVersion: input.expectedTargetVersion, actualVersion: targetCellVersion }
            )
        }

        const template = await loadTemplateRow(tx, {
            schemaName: ctx.schemaName,
            surface,
            templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!template) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.templateNotFound,
                'Template was not found in the current workspace'
            )
        }
        const templateVersion = Number(template._upl_version ?? 1)
        if (templateVersion !== input.expectedTemplateVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Template version conflict',
                { expectedVersion: input.expectedTemplateVersion, actualVersion: templateVersion }
            )
        }

        const templateRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            parentId: templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        assertRowCountWithinBounds(templateRows.length, 'Table Template', templateContract.table?.validation_rules)
        validateMatrixState(templateRows, templateMatrixColumns)

        const templateCellIds = collectCellIds(templateRows, templateCellIdColumn)
        const cellIdMap = new Map<string, string>()
        const plannedRows = planMatrixRowsCopy(
            templateRows,
            templateContract,
            interpretationContract,
            new Map(),
            false,
            cellIdMap,
            'hierarchicalCells'
        ).rows
        for (const row of plannedRows) {
            if (hasCellStylePolicyFields(interpretationContract, row)) {
                validateTouchedCellStylePolicy(policySurface, interpretationContract, row)
            }
        }
        assertFreshCellIds(plannedRows, destinationCellIdColumn, currentRows)
        ensureCollisionFreeAxisKeys(plannedRows, templateRows, templateRowKeyColumn, destinationRowKeyColumn, currentRows, 'row')
        ensureCollisionFreeAxisKeys(plannedRows, templateRows, templateColKeyColumn, destinationColKeyColumn, currentRows, 'column')

        const includesMaterials = readTemplateIncludesMaterials(template, templateContract)
        const templateMaterialRefs = collectMaterialRefs(templateRows, templateMaterialRefColumn)
        if (includesMaterials) assertValidMaterialRefs(templateMaterialRefs)
        if (!includesMaterials && templateMaterialRefs.length > 0) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                'Structure-only template contains Material references'
            )
        }
        const templateMaterials = includesMaterials
            ? await loadMaterialsByTemplateOwner(tx, {
                  schemaName: ctx.schemaName,
                  contract: materialContract,
                  templateId,
                  workspaceId: ctx.currentWorkspaceId,
                  forUpdate: true
              })
            : []
        if (includesMaterials) {
            assertMaterialOwnership({
                materials: templateMaterials,
                materialIds: templateMaterialRefs,
                cellIds: templateCellIds,
                materialCellIdColumn: getField(materialContract, 'CellId')?.column_name,
                templateOwnerColumn: getField(materialContract, 'TemplateOwnerId')?.column_name,
                templateOwnerId: templateId
            })
            assertTemplateMaterialBindings(
                templateRows,
                templateMaterials,
                templateMaterialRefColumn,
                getField(materialContract, 'CellId')?.column_name,
                templateCellIdColumn
            )
            if (templateMaterialRefs.length > 0 && (!templateMaterialRefColumn || !destinationMaterialRefColumn)) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.missingMetadata,
                    'Material reference metadata is required to apply this template'
                )
            }
        }

        const materialIdMap = includesMaterials
            ? await cloneMaterials(tx, {
                  schemaName: ctx.schemaName,
                  contract: materialContract,
                  materials: templateMaterials,
                  cellIdMap,
                  interpretationId: input.interpretationId,
                  workspaceId: ctx.currentWorkspaceId,
                  userId: ctx.userId,
                  onBeforeCreate: (sourceMaterial, values) =>
                      dispatchRuntimeLifecycle(
                          tx,
                          buildLifecycleRequest(
                              ctx,
                              surface,
                              materialContract,
                              {
                                  eventName: 'beforeCreate',
                                  patch: values,
                                  previousRow: sourceMaterial,
                                  metadata: {
                                      aggregateCommand: 'applyTableTemplate',
                                      templateId,
                                      interpretationId: input.interpretationId,
                                      targetCellId: String(targetRow[destinationCellIdColumn])
                                  }
                              },
                              collectLifecycleFieldIds(materialContract, values)
                          )
                      ).then(() => undefined),
                  onAfterCreate: (sourceMaterial, newId, values) => {
                      afterMaterialCreates.push(
                          buildLifecycleRequest(
                              ctx,
                              surface,
                              materialContract,
                              {
                                  eventName: 'afterCreate',
                                  row: { id: newId, ...values },
                                  patch: values,
                                  previousRow: sourceMaterial,
                                  metadata: {
                                      aggregateCommand: 'applyTableTemplate',
                                      templateId,
                                      interpretationId: input.interpretationId,
                                      targetCellId: String(targetRow[destinationCellIdColumn])
                                  }
                              },
                              collectLifecycleFieldIds(materialContract, values)
                          )
                      )
                  }
              })
            : new Map<string, string>()

        if (includesMaterials && templateMaterialRefColumn && destinationMaterialRefColumn) {
            const templateRowsByCellId = new Map(templateRows.map((row) => [getString(row, templateCellIdColumn), row]))
            const destinationCellIdToSource = new Map([...cellIdMap].map(([sourceId, destinationId]) => [destinationId, sourceId]))
            for (const row of plannedRows) {
                const sourceCellId = destinationCellIdToSource.get(String(row[destinationCellIdColumn] ?? '').trim())
                const sourceRow = sourceCellId ? templateRowsByCellId.get(sourceCellId) : undefined
                const sourceMaterialId = sourceRow ? getString(sourceRow, templateMaterialRefColumn) : ''
                if (!sourceMaterialId) {
                    row[destinationMaterialRefColumn] = null
                    continue
                }
                const destinationMaterialId = materialIdMap.get(sourceMaterialId)
                if (!destinationMaterialId) {
                    throw new InterpretationNetworkCommandError(
                        409,
                        interpretationNetworkCommandErrorCodes.invalidMaterial,
                        'Template Material reference could not be remapped'
                    )
                }
                row[destinationMaterialRefColumn] = destinationMaterialId
            }
        }

        const sourceRootRows = templateRows.filter((row) => !getString(row, templateParentCellIdColumn))
        if (sourceRootRows.length !== 1) {
            invalidMatrix('Table Template must contain exactly one root cell', { rootCount: sourceRootRows.length })
        }
        const sourceRootId = getString(sourceRootRows[0], templateCellIdColumn)
        const insertedRootCellId = cellIdMap.get(sourceRootId)
        if (!insertedRootCellId) invalidMatrix('The Table Template root could not be remapped')
        const rootRow =
            plannedRows.find((row) => String(row[destinationCellIdColumn] ?? '').trim() === insertedRootCellId) ??
            invalidMatrix('The Table Template root could not be remapped')

        const siblingRows = currentRows.filter(
            (row) =>
                String(row[destinationParentCellIdColumn] ?? '')
                    .trim()
                    .toLowerCase() === targetCellId
        )
        const maximumSiblingOrder = siblingRows.length === 0 ? -1 : Math.max(...siblingRows.map((row) => Number(row._tp_sort_order ?? 0)))
        const rootSortOrder = maximumSiblingOrder + 1
        if (!Number.isSafeInteger(rootSortOrder) || rootSortOrder < 0 || rootSortOrder > 2_147_483_647) {
            invalidMatrix('No valid sibling sort order remains for the applied template')
        }
        rootRow[destinationParentCellIdColumn] = String(targetRow[destinationCellIdColumn])
        rootRow._tp_sort_order = rootSortOrder

        const resultingRows = [...currentRows, ...plannedRows]
        assertRowCountWithinBounds(resultingRows.length, 'Interpretation Matrix', interpretationContract.table?.validation_rules)
        validateMatrixState(resultingRows, matrixColumns)

        await insertChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: input.interpretationId,
            rows: plannedRows,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId,
            trustedAggregate: true
        })

        return interpretationNetworkTemplateApplyResponseSchema.parse({
            templateId,
            templateVersion,
            interpretationId: input.interpretationId,
            targetCellId: String(targetRow[destinationCellIdColumn]),
            targetCellVersion,
            insertedRootCellId,
            insertedCellCount: plannedRows.length,
            insertedMaterialCount: templateMaterials.length
        })
    })

    afterMaterialCreates.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
    return interpretationNetworkTemplateApplyResponseSchema.parse(response)
}
