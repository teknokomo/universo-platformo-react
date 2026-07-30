import { normalizeLocale, type RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { z } from 'zod'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../runtimeLifecycleDispatch'
import {
    SYSTEM_INTERPRETATION_TITLE,
    SYSTEM_STRUCTURE_KEY,
    SYSTEM_STRUCTURE_NAME,
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
    getRootCellId,
    insertChildRows,
    insertRow,
    interpretationNetworkCommandErrorCodes,
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkStructureCreateRequestSchema,
    loadChildRows,
    loadInterpretationsForStructure,
    selectActiveRowsByField,
    toRootMatrixRow,
    type InterpretationNetworkRuntimeSurface,
    type SystemStructureAggregate
} from './runtimeInterpretationNetworkCore'
import { assertNoOrdinaryStructuresInSingleSystemMode } from './runtimeInterpretationNetworkValidation'
import { buildLifecycleRequest, collectLifecycleFieldIds } from './runtimeInterpretationNetworkLifecycle'

export const createStructureAggregate = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    options: z.infer<typeof interpretationNetworkStructureCreateRequestSchema>
): Promise<SystemStructureAggregate> => {
    const surface = assertReadySurface(surfaceInput, 'createStructure')
    assertStructureMode(surface, 'multiple', 'createStructure')
    assertRuntimePermissions(ctx, 'createContent', 'editContent')
    const locale = normalizeLocale(options.locale)
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const nameColumn = assertColumn(getField(structureContract, 'Name'), 'Structure.Name')
    const descriptionColumn = getField(structureContract, 'Description')?.column_name
    const titleColumn = assertColumn(getField(interpretationContract, 'Title'), 'Interpretation.Title')
    const parentColumn = assertColumn(getField(interpretationContract, 'ParentStructure'), 'Interpretation.ParentStructure')
    const cellIdColumn = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    let afterStructureCreate: RuntimeLifecycleDispatchRequest | null = null
    let afterInterpretationCreate: RuntimeLifecycleDispatchRequest | null = null

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireStructureModeLock(tx, surface)
        await acquireCommandLock(tx, surface, 'create-structure')
        const structureValues: Record<string, unknown> = { [nameColumn]: options.name }
        if (descriptionColumn && options.description !== undefined) structureValues[descriptionColumn] = options.description
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                structureContract,
                { eventName: 'beforeCreate', patch: structureValues, metadata: { aggregateCommand: 'createStructureAggregate' } },
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
                metadata: { aggregateCommand: 'createStructureAggregate' }
            },
            collectLifecycleFieldIds(structureContract, structureValues)
        )
        const interpretationValues = { [titleColumn]: options.name, [parentColumn]: structureId }
        await dispatchRuntimeLifecycle(
            tx,
            buildLifecycleRequest(
                ctx,
                surface,
                interpretationContract,
                { eventName: 'beforeCreate', patch: interpretationValues, metadata: { aggregateCommand: 'createStructureAggregate' } },
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
        const rootRow = toRootMatrixRow(interpretationContract, locale)
        await insertChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: interpretationId,
            rows: [rootRow],
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
                metadata: { aggregateCommand: 'createStructureAggregate', childRowCount: 1 }
            },
            collectLifecycleFieldIds(interpretationContract, interpretationValues)
        )
        return {
            structureId,
            interpretationId,
            rootCellId: String(rootRow[cellIdColumn] ?? ''),
            created: true
        }
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterStructureCreate)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterInterpretationCreate)
    return result
}

export const ensureSingleSystemStructure = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface,
    options: z.infer<typeof interpretationNetworkEnsureSystemStructureRequestSchema>
): Promise<SystemStructureAggregate> => {
    const surface = assertReadySurface(surfaceInput, 'ensureSystemStructure')
    assertStructureMode(surface, 'singleSystem', 'ensureSystemStructure')
    const locale = normalizeLocale(options.locale)
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const systemKeyColumn = assertColumn(getField(structureContract, 'SystemKey'), 'Structure.SystemKey')
    const nameColumn = assertColumn(getField(structureContract, 'Name'), 'Structure.Name')
    const titleColumn = assertColumn(getField(interpretationContract, 'Title'), 'Interpretation.Title')
    const parentColumn = assertColumn(getField(interpretationContract, 'ParentStructure'), 'Interpretation.ParentStructure')
    const cellIdColumn = assertColumn(getChildField(interpretationContract, 'CellId'), 'InterpretationMatrix.CellId')
    let afterStructureCreate: RuntimeLifecycleDispatchRequest | null = null
    let afterInterpretationCreate: RuntimeLifecycleDispatchRequest | null = null

    const result = await ctx.manager.transaction(async (tx) => {
        await acquireStructureModeLock(tx, surface)
        await acquireCommandLock(tx, surface, 'ensure')
        const structures = await selectActiveRowsByField(tx, {
            schemaName: ctx.schemaName,
            contract: structureContract,
            field: getField(structureContract, 'SystemKey')!,
            value: SYSTEM_STRUCTURE_KEY,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })

        if (structures.length > 1) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.duplicateSystemStructure,
                'More than one system Structure exists in this workspace'
            )
        }

        if (structures.length === 1) {
            const structureId = String(structures[0].id)
            await assertNoOrdinaryStructuresInSingleSystemMode(tx, {
                schemaName: ctx.schemaName,
                structureContract,
                systemKeyColumn,
                workspaceId: ctx.currentWorkspaceId,
                allowedSystemStructureId: structureId,
                forUpdate: true
            })
            const interpretations = await loadInterpretationsForStructure(tx, {
                schemaName: ctx.schemaName,
                surface,
                structureId,
                workspaceId: ctx.currentWorkspaceId,
                forUpdate: true
            })
            const interpretation = assertSingleInterpretation(
                interpretations,
                interpretationNetworkCommandErrorCodes.malformedSystemStructure,
                'The system Structure must have exactly one Matrix'
            )
            const rows = await loadChildRows(tx, {
                schemaName: ctx.schemaName,
                contract: interpretationContract,
                parentId: String(interpretation.id),
                workspaceId: ctx.currentWorkspaceId,
                forUpdate: true
            })
            const rootCellId = getRootCellId(rows, interpretationContract)
            if (!rootCellId) {
                throw new InterpretationNetworkCommandError(
                    409,
                    interpretationNetworkCommandErrorCodes.malformedSystemStructure,
                    'The system Matrix must have exactly one root cell'
                )
            }
            return {
                structureId,
                interpretationId: String(interpretation.id),
                rootCellId,
                created: false
            }
        }

        await assertNoOrdinaryStructuresInSingleSystemMode(tx, {
            schemaName: ctx.schemaName,
            structureContract,
            systemKeyColumn,
            workspaceId: ctx.currentWorkspaceId,
            forUpdate: true
        })

        const structureValues = {
            [nameColumn]: SYSTEM_STRUCTURE_NAME,
            [systemKeyColumn]: SYSTEM_STRUCTURE_KEY
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
                    metadata: { aggregateCommand: 'ensureSingleSystemStructure' }
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
                metadata: { aggregateCommand: 'ensureSingleSystemStructure' }
            },
            collectLifecycleFieldIds(structureContract, structureValues)
        )
        const interpretationValues = {
            [titleColumn]: SYSTEM_INTERPRETATION_TITLE,
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
                    metadata: { aggregateCommand: 'ensureSingleSystemStructure' }
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
        const rootRow = toRootMatrixRow(interpretationContract, locale)
        await insertChildRows(tx, {
            schemaName: ctx.schemaName,
            contract: interpretationContract,
            parentId: interpretationId,
            rows: [rootRow],
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
                metadata: { aggregateCommand: 'ensureSingleSystemStructure', childRowCount: 1 }
            },
            collectLifecycleFieldIds(interpretationContract, interpretationValues)
        )

        return {
            structureId,
            interpretationId,
            rootCellId: String(rootRow[cellIdColumn] ?? ''),
            created: true
        }
    })

    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterStructureCreate)
    dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterInterpretationCreate)
    return result
}

export const getSingleSystemStructure = async (
    ctx: RuntimeSchemaContext,
    surfaceInput: InterpretationNetworkRuntimeSurface
): Promise<SystemStructureAggregate | null> => {
    const surface = assertReadySurface(surfaceInput, 'getSystemStructure')
    assertStructureMode(surface, 'singleSystem', 'getSystemStructure')
    const structureContract = surface.contracts.Structure
    const interpretationContract = surface.contracts.Interpretation
    const systemKeyColumn = assertColumn(getField(structureContract, 'SystemKey'), 'Structure.SystemKey')

    const structures = await selectActiveRowsByField(ctx.manager, {
        schemaName: ctx.schemaName,
        contract: structureContract,
        field: getField(structureContract, 'SystemKey')!,
        value: SYSTEM_STRUCTURE_KEY,
        workspaceId: ctx.currentWorkspaceId
    })

    if (structures.length > 1) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.duplicateSystemStructure,
            'More than one system Structure exists in this workspace'
        )
    }

    if (structures.length === 0) return null

    const structureId = String(structures[0].id)
    await assertNoOrdinaryStructuresInSingleSystemMode(ctx.manager, {
        schemaName: ctx.schemaName,
        structureContract,
        systemKeyColumn,
        workspaceId: ctx.currentWorkspaceId,
        allowedSystemStructureId: structureId
    })
    const interpretations = await loadInterpretationsForStructure(ctx.manager, {
        schemaName: ctx.schemaName,
        surface,
        structureId,
        workspaceId: ctx.currentWorkspaceId
    })
    const interpretation = assertSingleInterpretation(
        interpretations,
        interpretationNetworkCommandErrorCodes.malformedSystemStructure,
        'The system Structure must have exactly one Matrix'
    )
    const rows = await loadChildRows(ctx.manager, {
        schemaName: ctx.schemaName,
        contract: interpretationContract,
        parentId: String(interpretation.id),
        workspaceId: ctx.currentWorkspaceId
    })
    const rootCellId = getRootCellId(rows, interpretationContract)
    if (!rootCellId) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.malformedSystemStructure,
            'The system Matrix must have exactly one root cell'
        )
    }

    return {
        structureId,
        interpretationId: String(interpretation.id),
        rootCellId,
        created: false
    }
}
