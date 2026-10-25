import type { z } from 'zod'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
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
    assertColumn,
    assertReadySurface,
    assertRuntimePermissions,
    assertSingleInterpretation,
    getChildField,
    getField,
    insertChildRows,
    insertRow,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkTemplateSaveRequestSchema,
    loadChildRows,
    loadInterpretationsForStructure,
    loadTemplateRow,
    selectRowById,
    toTemplateSummary,
    type InterpretationNetworkRuntimeSurface,
    type TemplateSummary
} from './runtimeInterpretationNetworkCore'
import { cloneMaterials, loadMaterialsByIdsOrCellIds } from './runtimeInterpretationNetworkMaterials'
import { planMatrixRowsCopy } from './runtimeInterpretationNetworkMatrixCopy'
import { acquireInterpretationNetworkMatrixMembershipLock, resolveTemplateMatrixRows } from './runtimeInterpretationNetworkMatrixMembership'
import {
    assertMaterialOwnership,
    assertValidMaterialRefs,
    collectCellIds,
    collectMaterialRefs
} from './runtimeInterpretationNetworkValidation'

/** Saves a workspace-scoped whole Matrix or a server-selected branch atomically. */
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
        const sourceInterpretationId = String(sourceInterpretation.id)
        // Keep parent-row -> membership-lock ordering consistent with Matrix writers.
        await acquireInterpretationNetworkMatrixMembershipLock(tx, surface, sourceInterpretationId)
        const snapshotRows = await loadChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: sourceInterpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        const sourceRows = resolveTemplateMatrixRows(
            snapshotRows,
            interpretationContract,
            input.scope,
            surface.widgetConfig.matrixMode ?? 'hierarchicalCells'
        )
        const matrixMode = surface.widgetConfig.matrixMode === 'independentRows' ? 'independentRows' : 'hierarchicalCells'
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
            interpretationId: sourceInterpretationId,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })
        if (input.includeMaterials) {
            const materialCellIdColumn = getField(materialContract, 'CellId')?.column_name
            assertMaterialOwnership({
                materials: sourceMaterials,
                materialIds: sourceMaterialIds,
                cellIds: sourceCellIds,
                materialCellIdColumn,
                interpretationIdColumn: getField(materialContract, 'InterpretationId')?.column_name,
                interpretationId: sourceInterpretationId
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
        planMatrixRowsCopy(sourceRows, interpretationContract, templateContract, new Map(), false, templateCellIdMap, matrixMode)
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
            templateCellIdMap,
            matrixMode
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
