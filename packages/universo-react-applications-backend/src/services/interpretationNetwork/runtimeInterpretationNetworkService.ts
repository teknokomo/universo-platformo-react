import { normalizeLocale, type RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { z } from 'zod'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import { buildLifecycleRequest, collectLifecycleFieldIds } from './runtimeInterpretationNetworkLifecycle'
import {
    TEMPLATE_POLICY_STRUCTURE_ONLY,
    TEMPLATE_POLICY_WITH_MATERIALS,
    InterpretationNetworkCommandError,
    acquireCommandLock,
    acquireStructureModeLock,
    assertColumn,
    assertReadySurface,
    assertRuntimePermissions,
    assertSingleInterpretation,
    assertStructureMode,
    getChildField,
    getField,
    insertChildRows,
    insertRow,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkStructureDeleteRequestSchema,
    interpretationNetworkTemplateDeleteRequestSchema,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    interpretationNetworkTemplateUpdateRequestSchema,
    loadChildRows,
    loadInterpretationsForStructure,
    loadTemplateRow,
    readTemplateIncludesMaterials,
    activeWorkspaceWhere,
    selectRowById,
    softDeleteRow,
    softDeleteChildRows,
    softDeleteRowsByField,
    tableIdent,
    toTemplateSummary,
    updateRowValues,
    type InterpretationNetworkRuntimeSurface,
    type TemplateDetail,
    type TemplateSummary
} from './runtimeInterpretationNetworkCore'
import { cloneMaterials, loadMaterialsByIdsOrCellIds } from './runtimeInterpretationNetworkMaterials'
import { loadMaterialsByIds } from './runtimeInterpretationNetworkCore'
import { planMatrixRowsCopy } from './runtimeInterpretationNetworkMatrixCopy'
import {
    assertMaterialOwnership,
    assertUniqueMaterialsByCellId,
    assertValidMaterialRefs,
    buildMatrixTitle,
    collectCellIds,
    collectMaterialRefs,
    getString
} from './runtimeInterpretationNetworkValidation'
export {
    InterpretationNetworkCommandError,
    buildFeatureNotReadyError,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkStructureCreateRequestSchema,
    interpretationNetworkMaterialCreateRequestSchema,
    interpretationNetworkStructureDeleteRequestSchema,
    interpretationNetworkStructureRouteParamsSchema,
    interpretationNetworkTemplateDeleteRequestSchema,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    interpretationNetworkTemplateUpdateRequestSchema,
    type InterpretationNetworkRuntimeSurface
} from './runtimeInterpretationNetworkCore'
export { resolveInterpretationNetworkRuntimeSurface } from './runtimeInterpretationNetworkSurface'
export { createMaterialForCell } from './runtimeInterpretationNetworkMaterialCommands'
export { createStructureAggregate, ensureSingleSystemStructure, getSingleSystemStructure } from './runtimeInterpretationNetworkStructures'

export const listTableTemplates = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface
): Promise<TemplateSummary[]> => {
    const surface = assertReadySurface(surfaceInput, 'listTemplates')
    const values: unknown[] = []
    const rows = await ctx.manager.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(ctx.schemaName, surface.contracts.TableTemplate.object)}
        WHERE ${activeWorkspaceWhere(ctx.currentWorkspaceId, values)}
        ORDER BY _upl_updated_at DESC NULLS LAST, _upl_created_at DESC NULLS LAST, id DESC
        `,
        values
    )
    return rows.map((row) => toTemplateSummary(row, surface.contracts.TableTemplate))
}

export const getTableTemplateDetail = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    templateId: string
): Promise<TemplateDetail> => {
    const surface = assertReadySurface(surfaceInput, 'getTemplateDetail')
    const template = await loadTemplateRow(ctx.manager, {
        schemaName: ctx.schemaName,
        surface,
        templateId,
        workspaceId: ctx.currentWorkspaceId
    })
    if (!template) {
        throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.templateNotFound, 'Template was not found')
    }
    const matrixRows = await loadChildRows(ctx.manager, {
        schemaName: ctx.schemaName,
        contract: surface.contracts.TableTemplate,
        parentId: templateId,
        workspaceId: ctx.currentWorkspaceId
    })
    const materialRefs = collectMaterialRefs(matrixRows, getChildField(surface.contracts.TableTemplate, 'MaterialRef')?.column_name)
    const cellIdColumn = getChildField(surface.contracts.TableTemplate, 'CellId')?.column_name
    const parentCellIdColumn = getChildField(surface.contracts.TableTemplate, 'ParentCellId')?.column_name
    const parentByCellId = new Map<string, string | null>()
    for (const row of matrixRows) {
        const cellId = cellIdColumn ? getString(row, cellIdColumn) : ''
        if (!cellId) continue
        const parent = parentCellIdColumn ? getString(row, parentCellIdColumn) : ''
        parentByCellId.set(cellId, parent || null)
    }
    const roots = [...parentByCellId.values()].filter((parent) => parent === null).length
    let maxDepth = 0
    for (const cellId of parentByCellId.keys()) {
        let depth = 0
        let cursor: string | null = cellId
        const seen = new Set<string>()
        while (cursor && !seen.has(cursor)) {
            seen.add(cursor)
            cursor = parentByCellId.get(cursor) ?? null
            depth += 1
        }
        maxDepth = Math.max(maxDepth, depth)
    }
    return {
        ...toTemplateSummary(template, surface.contracts.TableTemplate),
        matrix: {
            cellCount: matrixRows.length,
            rootCount: roots,
            maxDepth
        },
        materialCount: new Set(materialRefs).size
    }
}

export const saveStructureAsTemplate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkTemplateSaveRequestSchema>
): Promise<TemplateSummary> => {
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const surface = assertReadySurface(surfaceInput, 'saveTemplate')
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const templateContract = surface.contracts.TableTemplate
    const materialContract = surface.contracts.Material
    const templateNameColumn = assertColumn(getField(templateContract, 'Name'), 'TableTemplate.Name')
    const materialPolicyColumn = assertColumn(getField(templateContract, 'MaterialPolicy'), 'TableTemplate.MaterialPolicy')
    const templateDescriptionColumn = getField(templateContract, 'Description')?.column_name
    let afterTemplateCreate: RuntimeLifecycleDispatchRequest | null = null
    const afterMaterialCreates: RuntimeLifecycleDispatchRequest[] = []

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, 'save-template')
        const source = await selectRowById(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            rowId: input.sourceStructureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!source) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.sourceNotFound,
                'Source Structure was not found'
            )
        }
        if (input.expectedVersion !== undefined && Number(source._upl_version ?? 1) !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Source Structure version conflict',
                {
                    expectedVersion: input.expectedVersion,
                    actualVersion: Number(source._upl_version ?? 1)
                }
            )
        }
        const sourceInterpretations = await loadInterpretationsForStructure(tx, {
            schemaName: ctx.schemaName,
            surface,
            structureId: input.sourceStructureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const sourceInterpretation = assertSingleInterpretation(
            sourceInterpretations,
            interpretationNetworkCommandErrorCodes.invalidMatrix,
            'Source Structure must have exactly one Matrix'
        )
        const sourceRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: String(sourceInterpretation.id),
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const sourceCellIdColumn = getChildField(interpretationContract, 'CellId')?.column_name
        const sourceCellIds = input.includeMaterials ? collectCellIds(sourceRows, sourceCellIdColumn) : []
        const materialRefColumn = getChildField(interpretationContract, 'MaterialRef')?.column_name
        const sourceMaterialIds = input.includeMaterials ? collectMaterialRefs(sourceRows, materialRefColumn) : []
        if (input.includeMaterials) assertValidMaterialRefs(sourceMaterialIds)
        const sourceMaterials = await loadMaterialsByIdsOrCellIds(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialIds: sourceMaterialIds,
            cellIds: sourceCellIds,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (input.includeMaterials) {
            const materialCellIdColumn = getField(materialContract, 'CellId')?.column_name
            assertUniqueMaterialsByCellId(sourceMaterials, materialCellIdColumn)
            assertMaterialOwnership({
                materials: sourceMaterials,
                materialIds: sourceMaterialIds,
                cellIds: sourceCellIds,
                materialCellIdColumn
            })
        }
        const templateValues = {
            [templateNameColumn]: input.templateName,
            [materialPolicyColumn]: input.includeMaterials ? TEMPLATE_POLICY_WITH_MATERIALS : TEMPLATE_POLICY_STRUCTURE_ONLY,
            ...(templateDescriptionColumn && input.description !== undefined ? { [templateDescriptionColumn]: input.description } : {})
        }
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                templateContract,
                {
                    eventName: 'beforeCreate',
                    patch: templateValues,
                    metadata: { aggregateCommand: 'saveStructureAsTemplate', sourceStructureId: input.sourceStructureId }
                },
                collectLifecycleFieldIds(templateContract, templateValues)
            )
        )
        const templateId = await insertRow(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            values: templateValues,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        afterTemplateCreate = buildLifecycleRequest(
            ctx,
            surface,
            templateContract,
            {
                eventName: 'afterCreate',
                row: { id: templateId, ...templateValues },
                patch: templateValues,
                metadata: { aggregateCommand: 'saveStructureAsTemplate', sourceStructureId: input.sourceStructureId }
            },
            collectLifecycleFieldIds(templateContract, templateValues)
        )
        const templateCellIdMap = new Map<string, string>()
        planMatrixRowsCopy(sourceRows, interpretationContract, templateContract, new Map(), false, templateCellIdMap)
        const materialIdMap = input.includeMaterials
            ? await cloneMaterials(tx, {
                  schemaName: ctx.schemaName,
                  contract: materialContract,
                  materials: sourceMaterials,
                  cellIdMap: templateCellIdMap,
                  templateOwnerId: templateId,
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
                                  metadata: { aggregateCommand: 'saveStructureAsTemplate', templateId }
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
                                  metadata: { aggregateCommand: 'saveStructureAsTemplate', templateId }
                              },
                              collectLifecycleFieldIds(materialContract, values)
                          )
                      )
                  }
              })
            : new Map<string, string>()
        const templateRows = planMatrixRowsCopy(
            sourceRows,
            interpretationContract,
            templateContract,
            materialIdMap,
            input.includeMaterials,
            templateCellIdMap
        ).rows
        await insertChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            parentId: templateId,
            rows: templateRows,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        const template = await loadTemplateRow(tx, {
            schemaName: ctx.schemaName,
            surface,
            templateId,
            workspaceId: ctx.currentWorkspaceId
        })
        return toTemplateSummary(
            template ?? {
                id: templateId,
                [templateNameColumn]: input.templateName,
                [materialPolicyColumn]: input.includeMaterials ? TEMPLATE_POLICY_WITH_MATERIALS : TEMPLATE_POLICY_STRUCTURE_ONLY
            },
            templateContract
        )
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterTemplateCreate)
    afterMaterialCreates.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
    return result
}

export const updateTableTemplate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    templateId: string,
    input: z.infer<typeof interpretationNetworkTemplateUpdateRequestSchema>
): Promise<TemplateSummary> => {
    assertRuntimePermissions(ctx, 'editContent')
    const surface = assertReadySurface(surfaceInput, 'updateTemplate')
    const templateContract = surface.contracts.TableTemplate
    const templateNameColumn = assertColumn(getField(templateContract, 'Name'), 'TableTemplate.Name')
    const templateDescriptionColumn = getField(templateContract, 'Description')?.column_name
    let afterTemplateUpdate: RuntimeLifecycleDispatchRequest | null = null

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, 'update-template')
        const existing = await loadTemplateRow(tx, {
            schemaName: ctx.schemaName,
            surface,
            templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!existing) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.templateNotFound,
                'Template was not found'
            )
        }
        if (input.expectedVersion !== undefined && Number(existing._upl_version ?? 1) !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Template version conflict',
                {
                    expectedVersion: input.expectedVersion,
                    actualVersion: Number(existing._upl_version ?? 1)
                }
            )
        }

        const updateValues = {
            [templateNameColumn]: input.templateName,
            ...(templateDescriptionColumn && input.description !== undefined ? { [templateDescriptionColumn]: input.description } : {})
        }
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                templateContract,
                {
                    eventName: 'beforeUpdate',
                    previousRow: existing,
                    patch: updateValues,
                    metadata: { aggregateCommand: 'updateTableTemplate', templateId }
                },
                collectLifecycleFieldIds(templateContract, updateValues)
            )
        )
        const updated = await updateRowValues(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            rowId: templateId,
            values: updateValues,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        afterTemplateUpdate = buildLifecycleRequest(
            ctx,
            surface,
            templateContract,
            {
                eventName: 'afterUpdate',
                row: updated,
                previousRow: existing,
                patch: updateValues,
                metadata: { aggregateCommand: 'updateTableTemplate', templateId }
            },
            collectLifecycleFieldIds(templateContract, updateValues)
        )

        return toTemplateSummary(updated, templateContract)
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterTemplateUpdate)
    return result
}

export const deleteTableTemplate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    templateId: string,
    input: z.infer<typeof interpretationNetworkTemplateDeleteRequestSchema>
): Promise<void> => {
    assertRuntimePermissions(ctx, 'deleteContent')
    const surface = assertReadySurface(surfaceInput, 'deleteTemplate')
    const templateContract = surface.contracts.TableTemplate
    const materialContract = surface.contracts.Material
    const materialRefColumn = getChildField(templateContract, 'MaterialRef')?.column_name
    const templateOwnerField = getField(materialContract, 'TemplateOwnerId')
    assertColumn(templateOwnerField, 'Material.TemplateOwnerId')
    let afterTemplateDelete: RuntimeLifecycleDispatchRequest | null = null
    const afterMaterialDeletes: RuntimeLifecycleDispatchRequest[] = []

    await ctx.manager.transaction(async (tx) => {
        await acquireCommandLock(tx, surface, 'delete-template')
        const existing = await loadTemplateRow(tx, {
            schemaName: ctx.schemaName,
            surface,
            templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!existing) {
            throw new InterpretationNetworkCommandError(
                404,
                interpretationNetworkCommandErrorCodes.templateNotFound,
                'Template was not found'
            )
        }
        if (input.expectedVersion !== undefined && Number(existing._upl_version ?? 1) !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Template version conflict',
                {
                    expectedVersion: input.expectedVersion,
                    actualVersion: Number(existing._upl_version ?? 1)
                }
            )
        }

        const templateRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            parentId: templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const materialIds = collectMaterialRefs(templateRows, materialRefColumn)
        assertValidMaterialRefs(materialIds)
        const materials = await loadMaterialsByIds(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialIds,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        assertMaterialOwnership({
            materials,
            materialIds,
            cellIds: collectCellIds(templateRows, getChildField(templateContract, 'CellId')?.column_name),
            materialCellIdColumn: getField(materialContract, 'CellId')?.column_name,
            templateOwnerColumn: templateOwnerField?.column_name,
            templateOwnerId: templateId
        })

        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(ctx, surface, templateContract, {
                eventName: 'beforeDelete',
                previousRow: existing,
                metadata: { aggregateCommand: 'deleteTableTemplate', templateId, childRowCount: templateRows.length }
            })
        )
        for (const material of materials) {
            await dispatchRuntimeLifecycle(
                tx,
                buildLifecycleRequest(ctx, surface, materialContract, {
                    eventName: 'beforeDelete',
                    previousRow: material,
                    metadata: { aggregateCommand: 'deleteTableTemplate', templateId }
                })
            )
        }
        await softDeleteChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            parentIds: [templateId],
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        const deletedMaterialIds = await softDeleteRowsByField(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            field: templateOwnerField!,
            value: templateId,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        if (deletedMaterialIds.length !== materials.length) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                'Template material provenance changed during deletion'
            )
        }

        await softDeleteRow(tx, {
            schemaName: ctx.schemaName,
            contract: surface.contracts.TableTemplate,
            rowId: templateId,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        afterTemplateDelete = buildLifecycleRequest(ctx, surface, templateContract, {
            eventName: 'afterDelete',
            row: null,
            previousRow: existing,
            metadata: { aggregateCommand: 'deleteTableTemplate', templateId, childRowCount: templateRows.length }
        })
        afterMaterialDeletes.push(
            ...materials.map((material) =>
                buildLifecycleRequest(ctx, surface, materialContract, {
                    eventName: 'afterDelete',
                    row: null,
                    previousRow: material,
                    metadata: { aggregateCommand: 'deleteTableTemplate', templateId }
                })
            )
        )
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterTemplateDelete)
    afterMaterialDeletes.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
}

export const instantiateTableTemplate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    templateId: string,
    input: z.infer<typeof interpretationNetworkTemplateInstantiateRequestSchema>
): Promise<{ structureId: string; interpretationId: string }> => {
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const surface = assertReadySurface(surfaceInput, 'instantiateTemplate')
    assertStructureMode(surface, 'multiple', 'instantiateTemplate')
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const templateContract = surface.contracts.TableTemplate
    const materialContract = surface.contracts.Material
    const structureNameColumn = assertColumn(getField(structureContract, 'Name'), 'Structure.Name')
    const structureDescriptionColumn = getField(structureContract, 'Description')?.column_name
    const titleColumn = assertColumn(getField(interpretationContract, 'Title'), 'Interpretation.Title')
    const parentColumn = assertColumn(getField(interpretationContract, 'ParentStructure'), 'Interpretation.ParentStructure')
    let afterStructureCreate: RuntimeLifecycleDispatchRequest | null = null
    let afterInterpretationCreate: RuntimeLifecycleDispatchRequest | null = null
    const afterMaterialCreates: RuntimeLifecycleDispatchRequest[] = []

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireStructureModeLock(tx, surface)
        await acquireCommandLock(tx, surface, 'instantiate-template')
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
                'Template was not found'
            )
        }
        if (input.expectedVersion !== undefined && Number(template._upl_version ?? 1) !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Template version conflict',
                {
                    expectedVersion: input.expectedVersion,
                    actualVersion: Number(template._upl_version ?? 1)
                }
            )
        }
        const templateRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: templateContract,
            parentId: templateId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const includesMaterials = readTemplateIncludesMaterials(template, templateContract)
        const materialRefColumn = getChildField(templateContract, 'MaterialRef')?.column_name
        const templateMaterialIds = includesMaterials ? collectMaterialRefs(templateRows, materialRefColumn) : []
        if (includesMaterials) assertValidMaterialRefs(templateMaterialIds)
        const templateCellIdColumn = getChildField(templateContract, 'CellId')?.column_name
        const templateCellIds = includesMaterials ? collectCellIds(templateRows, templateCellIdColumn) : []
        const structureValues = {
            [structureNameColumn]: input.structureName,
            ...(structureDescriptionColumn && input.description !== undefined ? { [structureDescriptionColumn]: input.description } : {})
        }
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                structureContract,
                {
                    eventName: 'beforeCreate',
                    patch: structureValues,
                    metadata: { aggregateCommand: 'instantiateTableTemplate', templateId }
                },
                collectLifecycleFieldIds(structureContract, structureValues)
            )
        )
        const structureId = await insertRow(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            values: structureValues,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        afterStructureCreate = buildLifecycleRequest(
            ctx,
            surface,
            structureContract,
            {
                eventName: 'afterCreate',
                row: { id: structureId, ...structureValues },
                patch: structureValues,
                metadata: { aggregateCommand: 'instantiateTableTemplate', templateId }
            },
            collectLifecycleFieldIds(structureContract, structureValues)
        )
        const matrixCellIdMap = new Map<string, string>()
        planMatrixRowsCopy(templateRows, templateContract, interpretationContract, new Map(), false, matrixCellIdMap)
        const templateMaterials = await loadMaterialsByIdsOrCellIds(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialIds: templateMaterialIds,
            cellIds: templateCellIds,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (includesMaterials) {
            const materialCellIdColumn = getField(materialContract, 'CellId')?.column_name
            assertUniqueMaterialsByCellId(templateMaterials, materialCellIdColumn)
            assertMaterialOwnership({
                materials: templateMaterials,
                materialIds: templateMaterialIds,
                cellIds: templateCellIds,
                materialCellIdColumn,
                templateOwnerColumn: getField(materialContract, 'TemplateOwnerId')?.column_name,
                templateOwnerId: templateId
            })
        }
        const materialIdMap = await cloneMaterials(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materials: templateMaterials,
            cellIdMap: matrixCellIdMap,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId,
            onBeforeCreate: (templateMaterial, values) =>
                dispatchRuntimeLifecycle(
                    tx,
                    buildLifecycleRequest(
                        ctx,
                        surface,
                        materialContract,
                        {
                            eventName: 'beforeCreate',
                            patch: values,
                            previousRow: templateMaterial,
                            metadata: { aggregateCommand: 'instantiateTableTemplate', templateId, structureId }
                        },
                        collectLifecycleFieldIds(materialContract, values)
                    )
                ).then(() => undefined),
            onAfterCreate: (templateMaterial, newId, values) => {
                afterMaterialCreates.push(
                    buildLifecycleRequest(
                        ctx,
                        surface,
                        materialContract,
                        {
                            eventName: 'afterCreate',
                            row: { id: newId, ...values },
                            patch: values,
                            previousRow: templateMaterial,
                            metadata: { aggregateCommand: 'instantiateTableTemplate', templateId, structureId }
                        },
                        collectLifecycleFieldIds(materialContract, values)
                    )
                )
            }
        })
        const interpretationValues = {
            [titleColumn]: buildMatrixTitle(input.structureName, normalizeLocale(input.locale)),
            [parentColumn]: structureId
        }
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                interpretationContract,
                {
                    eventName: 'beforeCreate',
                    patch: interpretationValues,
                    metadata: { aggregateCommand: 'instantiateTableTemplate', templateId, structureId }
                },
                collectLifecycleFieldIds(interpretationContract, interpretationValues)
            )
        )
        const interpretationId = await insertRow(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            values: interpretationValues,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        const matrixRows = planMatrixRowsCopy(
            templateRows,
            templateContract,
            interpretationContract,
            materialIdMap,
            includesMaterials,
            matrixCellIdMap
        ).rows
        await insertChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: interpretationId,
            rows: matrixRows,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        afterInterpretationCreate = buildLifecycleRequest(
            ctx,
            surface,
            interpretationContract,
            {
                eventName: 'afterCreate',
                row: { id: interpretationId, ...interpretationValues },
                patch: interpretationValues,
                metadata: { aggregateCommand: 'instantiateTableTemplate', templateId, structureId, childRowCount: matrixRows.length }
            },
            collectLifecycleFieldIds(interpretationContract, interpretationValues)
        )
        return { structureId, interpretationId }
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterStructureCreate)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterInterpretationCreate)
    afterMaterialCreates.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
    return result
}

export const deleteStructureAggregate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    structureId: string,
    input: z.infer<typeof interpretationNetworkStructureDeleteRequestSchema>
): Promise<void> => {
    assertRuntimePermissions(ctx, 'deleteContent')
    const surface = assertReadySurface(surfaceInput, 'deleteStructure')
    assertStructureMode(surface, 'multiple', 'deleteStructure')
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const materialContract = surface.contracts.Material
    const materialRefColumn = getChildField(interpretationContract, 'MaterialRef')?.column_name
    let afterStructureDelete: RuntimeLifecycleDispatchRequest | null = null
    let afterInterpretationDelete: RuntimeLifecycleDispatchRequest | null = null
    const afterMaterialDeletes: RuntimeLifecycleDispatchRequest[] = []

    await ctx.manager.transaction(async (tx) => {
        await acquireStructureModeLock(tx, surface)
        await acquireCommandLock(tx, surface, 'delete-structure')
        const structure = await selectRowById(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            rowId: structureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (!structure) {
            throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.rowNotFound, 'Structure was not found')
        }
        // A Structure is protected by SystemKey only while single-system mode is active.
        // This aggregate command is intentionally available only in multiple mode, where
        // a formerly canonical Structure is an ordinary user-managed Structure again.
        if (input.expectedVersion !== undefined && Number(structure._upl_version ?? 1) !== input.expectedVersion) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.versionConflict,
                'Structure version conflict',
                { expectedVersion: input.expectedVersion, actualVersion: Number(structure._upl_version ?? 1) }
            )
        }

        const interpretations = await loadInterpretationsForStructure(tx, {
            schemaName: ctx.schemaName,
            surface,
            structureId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (interpretations.length !== 1 || !interpretations[0]?.id) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.invalidMatrix,
                'Structure must have exactly one Matrix before deletion',
                { count: interpretations.length }
            )
        }
        const interpretationId = String(interpretations[0].id)
        const matrixRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const materialIds = collectMaterialRefs(matrixRows, materialRefColumn)
        assertValidMaterialRefs(materialIds)
        const matrixCellIds = collectCellIds(matrixRows, getChildField(interpretationContract, 'CellId')?.column_name)
        const materials = await loadMaterialsByIdsOrCellIds(tx, {
            schemaName: ctx.schemaName,
            contract: materialContract,
            materialIds,
            cellIds: matrixCellIds,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        assertMaterialOwnership({
            materials,
            materialIds,
            cellIds: matrixCellIds,
            materialCellIdColumn: getField(materialContract, 'CellId')?.column_name
        })

        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(ctx, surface, structureContract, {
                eventName: 'beforeDelete',
                previousRow: structure,
                metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId }
            })
        )
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(ctx, surface, interpretationContract, {
                eventName: 'beforeDelete',
                previousRow: interpretations[0],
                metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId, childRowCount: matrixRows.length }
            })
        )
        for (const material of materials) {
            await dispatchRuntimeLifecycle(
                tx,
                buildLifecycleRequest(ctx, surface, materialContract, {
                    eventName: 'beforeDelete',
                    previousRow: material,
                    metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId }
                })
            )
        }
        await softDeleteChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentIds: [interpretationId],
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        for (const material of materials) {
            await softDeleteRow(tx, {
                schemaName: ctx.schemaName,
                contract: materialContract,
                rowId: String(material.id),
                workspaceId: ctx.currentWorkspaceId,
                userId: ctx.userId
            })
        }
        await softDeleteRow(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            rowId: interpretationId,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId
        })
        await softDeleteRow(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            rowId: structureId,
            workspaceId: ctx.currentWorkspaceId,
            userId: ctx.userId,
            expectedVersion: input.expectedVersion
        })
        afterStructureDelete = buildLifecycleRequest(ctx, surface, structureContract, {
            eventName: 'afterDelete',
            row: null,
            previousRow: structure,
            metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId }
        })
        afterInterpretationDelete = buildLifecycleRequest(ctx, surface, interpretationContract, {
            eventName: 'afterDelete',
            row: null,
            previousRow: interpretations[0],
            metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId, childRowCount: matrixRows.length }
        })
        afterMaterialDeletes.push(
            ...materials.map((material) =>
                buildLifecycleRequest(ctx, surface, materialContract, {
                    eventName: 'afterDelete',
                    row: null,
                    previousRow: material,
                    metadata: { aggregateCommand: 'deleteStructureAggregate', structureId, interpretationId }
                })
            )
        )
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterStructureDelete)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterInterpretationDelete)
    afterMaterialDeletes.forEach((request) => dispatchRuntimeLifecycleAfterCommit(ctx.manager, request))
}

export const listInterpretationNetworkTemplates = listTableTemplates

export const getInterpretationNetworkTemplateDetail = getTableTemplateDetail

export const updateInterpretationNetworkTemplate = (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkTemplateUpdateRequestSchema> & { templateId: string }
) => updateTableTemplate(ctx, surfaceInput, input.templateId, input)

export const deleteInterpretationNetworkTemplate = (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkTemplateDeleteRequestSchema> & { templateId: string }
) => deleteTableTemplate(ctx, surfaceInput, input.templateId, input)

export const instantiateStructureFromTemplate = (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    input: z.infer<typeof interpretationNetworkTemplateInstantiateRequestSchema> & { templateId: string }
) => instantiateTableTemplate(ctx, surfaceInput, input.templateId, input)
