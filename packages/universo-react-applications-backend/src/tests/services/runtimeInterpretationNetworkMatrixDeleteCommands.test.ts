import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { InterpretationNetworkRuntimeSurface } from '../../shared/interpretationNetworkRuntimeContracts'
import { deleteInterpretationNetworkMatrixCell } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import {
    assertMaterialAggregatePolicy,
    loadMaterialsByIdsOrCellIds,
    softDeleteMaterialAggregateRow
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkMaterials'
import { removeInterpretationNetworkFavoritesForTarget } from '../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites'
import { dispatchRuntimeLifecycle, dispatchRuntimeLifecycleAfterCommit } from '../../services/runtimeLifecycleDispatch'
import { createMockDbExecutor } from '../utils/dbMocks'

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkMaterials', () => ({
    assertMaterialAggregatePolicy: jest.fn(),
    loadMaterialsByIdsOrCellIds: jest.fn(),
    softDeleteMaterialAggregateRow: jest.fn()
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites', () => ({
    removeInterpretationNetworkFavoritesForTarget: jest.fn()
}))

jest.mock('../../services/runtimeLifecycleDispatch', () => ({
    dispatchRuntimeLifecycle: jest.fn().mockResolvedValue([]),
    dispatchRuntimeLifecycleAfterCommit: jest.fn()
}))

const schemaName = 'app_018f8a787b8f7c1da111222233334440'
const workspaceId = '019f2000-0000-7000-8000-000000000010'
const userId = '019f2000-0000-7000-8000-000000000011'
const interpretationId = '019f2000-0000-7000-8000-000000000012'
const matrixRowId = '019f2000-0000-7000-8000-000000000013'
const cellId = '019f2000-0000-7000-8000-000000000021'
const materialId = '019f2000-0000-7000-8000-000000000031'
const secondMaterialId = '019f2000-0000-7000-8000-000000000032'
const unrelatedMaterialId = '019f2000-0000-7000-8000-000000000033'
const unrelatedCellId = '019f2000-0000-7000-8000-000000000022'

const field = (codename: string, column_name: string) => ({
    id: `${codename}-id`,
    codename,
    column_name,
    data_type: 'STRING' as const,
    parent_component_id: 'material-id'
})

const interpretationContract = {
    object: { id: 'interpretation-object', codename: 'Interpretation', table_name: 'interpretation' },
    fields: {},
    table: { id: 'matrix-table-id', codename: 'InterpretationMatrix', column_name: 'interpretation_matrix', data_type: 'TABLE' as const },
    childFields: Object.fromEntries(
        [
            field('CellId', 'cell_id'),
            field('ParentCellId', 'parent_cell_id'),
            field('RowKey', 'row_key'),
            field('ColKey', 'col_key'),
            field('CellValue', 'cell_value')
        ].map((item) => [item.codename, { ...item, ui_config: { serverOwned: item.codename !== 'CellValue' } }])
    ),
    childTableName: 'interpretation_matrix_rows'
}

const materialContract = {
    object: { id: 'material-object', codename: 'Material', table_name: 'material' },
    fields: {
        CellId: field('CellId', 'cell_id'),
        TemplateOwnerId: field('TemplateOwnerId', 'template_owner_id'),
        InterpretationId: field('InterpretationId', 'interpretation_id')
    },
    childFields: {}
}

const makeSurface = (rows: Array<Record<string, unknown>>, matrixMode: 'multiple' | 'hierarchicalCells' = 'multiple') =>
    ({
        applicationId: 'application-id',
        schemaName,
        workspaceId,
        layoutId: 'layout-id',
        widgetId: 'widget-id',
        widgetKey: 'interpretationNetworkWorkspace',
        widgetConfig: { structureMode: 'multiple', matrixMode },
        structureMode: 'multiple',
        featureState: 'ready',
        missing: [],
        contracts: {
            Structure: { object: { id: 'structure-object', codename: 'Structure', table_name: 'structure' }, fields: {}, childFields: {} },
            Interpretation: interpretationContract,
            Material: materialContract,
            TableTemplate: {
                object: { id: 'template-object', codename: 'TableTemplate', table_name: 'table_template' },
                fields: {},
                childFields: {}
            }
        },
        resolvedObjects: {
            Structure: 'structure-object',
            Interpretation: 'interpretation-object',
            Material: 'material-object',
            TableTemplate: 'template-object'
        },
        rows
    } as unknown as InterpretationNetworkRuntimeSurface)

const makeContext = () => {
    const { executor, txExecutor } = createMockDbExecutor()
    const ctx = {
        schemaName,
        schemaIdent: `"${schemaName}"`,
        manager: executor,
        userId,
        permissions: { createContent: true, editContent: true, deleteContent: true },
        currentWorkspaceId: workspaceId,
        workspacesEnabled: true
    } as unknown as RuntimeSchemaContext
    return { ctx, executor, txExecutor }
}

const cellRow = (overrides: Record<string, unknown> = {}) => ({
    id: matrixRowId,
    _upl_version: 2,
    cell_id: cellId,
    parent_cell_id: null,
    row_key: 'row-a',
    col_key: 'column-a',
    cell_value: 'value',
    ...overrides
})

const runDelete = async (
    rows: Array<Record<string, unknown>>,
    options: { expectedCellVersion?: number; matrixMode?: 'multiple' | 'hierarchicalCells'; deleteCell?: boolean } = {},
    transactionTrace: string[] = []
) => {
    const { ctx, executor, txExecutor } = makeContext()
    let rollbackObserved = false
    executor.transaction.mockImplementation(async (callback: (executor: typeof txExecutor) => Promise<unknown>) => {
        transactionTrace.push('transaction:begin')
        try {
            const result = await callback(txExecutor)
            transactionTrace.push('transaction:commit')
            return result
        } catch (error) {
            rollbackObserved = true
            transactionTrace.push('transaction:rollback')
            throw error
        }
    })
    txExecutor.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
        if (sql.includes('FROM') && sql.includes('"interpretation_matrix_rows"')) return rows
        if (sql.startsWith('UPDATE') && sql.includes('"interpretation_matrix_rows"')) {
            return options.deleteCell === false ? [] : [{ id: matrixRowId }]
        }
        return []
    })
    const result = deleteInterpretationNetworkMatrixCell(ctx, makeSurface(rows, options.matrixMode), {
        interpretationId,
        cellId,
        expectedCellVersion: options.expectedCellVersion ?? 2
    })
    return {
        result,
        ctx,
        executor,
        txExecutor,
        transactionTrace,
        get rollbackObserved() {
            return rollbackObserved
        }
    }
}

describe('deleteInterpretationNetworkMatrixCell', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(dispatchRuntimeLifecycle).mockResolvedValue([])
        jest.mocked(dispatchRuntimeLifecycleAfterCommit).mockImplementation(() => undefined)
        jest.mocked(loadMaterialsByIdsOrCellIds).mockResolvedValue([])
        jest.mocked(removeInterpretationNetworkFavoritesForTarget).mockResolvedValue(undefined)
        jest.mocked(softDeleteMaterialAggregateRow).mockResolvedValue(undefined)
    })

    it('soft-deletes attached Materials and the target cell in one authorized aggregate, then dispatches lifecycle after commit', async () => {
        jest.mocked(loadMaterialsByIdsOrCellIds).mockResolvedValue([
            { id: materialId, _upl_version: 4, cell_id: cellId, title: 'Attached material' },
            { id: secondMaterialId, _upl_version: 6, cell_id: cellId, title: 'Second attached material' },
            { id: unrelatedMaterialId, _upl_version: 8, cell_id: unrelatedCellId, title: 'Unrelated material' }
        ])
        const trace: string[] = []
        jest.mocked(dispatchRuntimeLifecycle).mockImplementation(async (_manager, request) => {
            trace.push(`before:${String(request?.objectCollection.codename)}`)
            return []
        })
        jest.mocked(dispatchRuntimeLifecycleAfterCommit).mockImplementation((_manager, request) => {
            trace.push(`after-commit:${request?.payload.eventName}:${String(request?.objectCollection.codename)}`)
        })
        const scenario = await runDelete([cellRow()], {}, trace)

        await expect(scenario.result).resolves.toEqual({ cellId, deletedMaterialCount: 2 })
        expect(assertMaterialAggregatePolicy).toHaveBeenCalledWith(materialContract)
        expect(loadMaterialsByIdsOrCellIds).toHaveBeenCalledWith(
            scenario.txExecutor,
            expect.objectContaining({ materialIds: [], cellIds: [cellId], interpretationId, workspaceId, forUpdate: true })
        )
        expect(softDeleteMaterialAggregateRow).toHaveBeenNthCalledWith(
            1,
            scenario.txExecutor,
            expect.objectContaining({ materialId, expectedVersion: 4, workspaceId, userId })
        )
        expect(softDeleteMaterialAggregateRow).toHaveBeenNthCalledWith(
            2,
            scenario.txExecutor,
            expect.objectContaining({ materialId: secondMaterialId, expectedVersion: 6, workspaceId, userId })
        )
        expect(softDeleteMaterialAggregateRow).not.toHaveBeenCalledWith(
            scenario.txExecutor,
            expect.objectContaining({ materialId: unrelatedMaterialId })
        )
        expect(removeInterpretationNetworkFavoritesForTarget).toHaveBeenCalledWith(scenario.ctx, scenario.txExecutor, expect.anything(), {
            interpretationId,
            cellId
        })
        const deleteCalls = txCalls(scenario.txExecutor, 'UPDATE')
        expect(deleteCalls).toHaveLength(1)
        expect(deleteCalls[0]?.[0]).toContain('"workspace_id" = $4')
        expect(deleteCalls[0]?.[0]).toContain('COALESCE(_upl_version, 1) = $5')
        expect(deleteCalls[0]?.[1]).toEqual([userId, matrixRowId, interpretationId, workspaceId, 2])
        expect(dispatchRuntimeLifecycle).toHaveBeenCalledTimes(3)
        expect(
            jest
                .mocked(dispatchRuntimeLifecycle)
                .mock.calls.map(([manager, request]) => [manager === scenario.txExecutor, request?.payload.eventName])
        ).toEqual([
            [true, 'beforeDelete'],
            [true, 'beforeDelete'],
            [true, 'beforeDelete']
        ])
        expect(dispatchRuntimeLifecycleAfterCommit).toHaveBeenCalledTimes(3)
        expect(
            jest
                .mocked(dispatchRuntimeLifecycleAfterCommit)
                .mock.calls.map(([manager, request]) => [manager === scenario.ctx.manager, request?.payload.eventName])
        ).toEqual([
            [true, 'afterDelete'],
            [true, 'afterDelete'],
            [true, 'afterDelete']
        ])
        expect(trace).toEqual([
            'transaction:begin',
            'before:Interpretation',
            'before:Material',
            'before:Material',
            'transaction:commit',
            'after-commit:afterDelete:Material',
            'after-commit:afterDelete:Material',
            'after-commit:afterDelete:Interpretation'
        ])
        expect(scenario.rollbackObserved).toBe(false)
    })

    it('rejects deleting a hierarchical root before touching Materials or cell rows', async () => {
        const scenario = await runDelete([cellRow()], { matrixMode: 'hierarchicalCells' })

        await expect(scenario.result).rejects.toMatchObject({
            name: 'InterpretationNetworkCommandError',
            statusCode: 409,
            code: 'INTERPRETATION_NETWORK_INVALID_MATRIX'
        })
        expect(scenario.executor.transaction).toHaveBeenCalledTimes(1)
        expect(scenario.rollbackObserved).toBe(true)
        expect(scenario.transactionTrace).toEqual(['transaction:begin', 'transaction:rollback'])
        expect(loadMaterialsByIdsOrCellIds).not.toHaveBeenCalled()
        expect(softDeleteMaterialAggregateRow).not.toHaveBeenCalled()
        expect(txCalls(scenario.txExecutor, 'UPDATE')).toHaveLength(0)
        expect(dispatchRuntimeLifecycleAfterCommit).not.toHaveBeenCalled()
    })

    it('rejects deleting a cell with children before any aggregate side effects', async () => {
        const scenario = await runDelete(
            [
                cellRow(),
                cellRow({
                    id: '019f2000-0000-7000-8000-000000000014',
                    cell_id: '019f2000-0000-7000-8000-000000000022',
                    parent_cell_id: cellId
                })
            ],
            { matrixMode: 'hierarchicalCells' }
        )

        await expect(scenario.result).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(scenario.executor.transaction).toHaveBeenCalledTimes(1)
        expect(scenario.rollbackObserved).toBe(true)
        expect(scenario.transactionTrace).toEqual(['transaction:begin', 'transaction:rollback'])
        expect(loadMaterialsByIdsOrCellIds).not.toHaveBeenCalled()
        expect(softDeleteMaterialAggregateRow).not.toHaveBeenCalled()
        expect(txCalls(scenario.txExecutor, 'UPDATE')).toHaveLength(0)
        expect(dispatchRuntimeLifecycleAfterCommit).not.toHaveBeenCalled()
    })

    it('fails closed on a stale cell version before reading or deleting attached Materials', async () => {
        const scenario = await runDelete([cellRow()], { expectedCellVersion: 1 })

        await expect(scenario.result).rejects.toMatchObject({
            name: 'InterpretationNetworkCommandError',
            statusCode: 409,
            code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT'
        })
        expect(scenario.executor.transaction).toHaveBeenCalledTimes(1)
        expect(scenario.rollbackObserved).toBe(true)
        expect(scenario.transactionTrace).toEqual(['transaction:begin', 'transaction:rollback'])
        expect(loadMaterialsByIdsOrCellIds).not.toHaveBeenCalled()
        expect(softDeleteMaterialAggregateRow).not.toHaveBeenCalled()
        expect(txCalls(scenario.txExecutor, 'UPDATE')).toHaveLength(0)
        expect(dispatchRuntimeLifecycleAfterCommit).not.toHaveBeenCalled()
    })

    it('does not dispatch post-commit hooks when a cell mutation fails after Material handling', async () => {
        jest.mocked(loadMaterialsByIdsOrCellIds).mockResolvedValue([
            { id: materialId, _upl_version: 4, cell_id: cellId, title: 'Attached material' }
        ])
        const trace: string[] = []
        jest.mocked(dispatchRuntimeLifecycle).mockImplementation(async (_manager, request) => {
            trace.push(`before:${String(request?.objectCollection.codename)}`)
            return []
        })
        jest.mocked(dispatchRuntimeLifecycleAfterCommit).mockImplementation((_manager, request) => {
            trace.push(`after-commit:${request?.payload.eventName}:${String(request?.objectCollection.codename)}`)
        })
        const scenario = await runDelete([cellRow()], { deleteCell: false }, trace)

        await expect(scenario.result).rejects.toMatchObject({
            name: 'InterpretationNetworkCommandError',
            statusCode: 409,
            code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT'
        })
        expect(softDeleteMaterialAggregateRow).toHaveBeenCalledTimes(1)
        expect(removeInterpretationNetworkFavoritesForTarget).toHaveBeenCalledWith(scenario.ctx, scenario.txExecutor, expect.anything(), {
            interpretationId,
            cellId
        })
        expect(scenario.rollbackObserved).toBe(true)
        expect(scenario.transactionTrace).toEqual(['transaction:begin', 'before:Interpretation', 'before:Material', 'transaction:rollback'])
        expect(trace).toEqual(['transaction:begin', 'before:Interpretation', 'before:Material', 'transaction:rollback'])
        expect(dispatchRuntimeLifecycleAfterCommit).not.toHaveBeenCalled()
    })
})

const txCalls = (executor: { query: jest.Mock }, prefix: string) =>
    executor.query.mock.calls.filter(([sql]) => String(sql).startsWith(prefix))
