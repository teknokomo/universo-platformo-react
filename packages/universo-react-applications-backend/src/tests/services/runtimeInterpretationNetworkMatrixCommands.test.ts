import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import {
    createInterpretationNetworkMatrixCell,
    moveInterpretationNetworkMatrixCells
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import type { RuntimeSurfaceReady } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { InterpretationNetworkCommandError } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334440'
const workspaceId = '019f2000-0000-7000-8000-000000000010'
const userId = '019f2000-0000-7000-8000-000000000011'
const interpretationId = '019f2000-0000-7000-8000-000000000012'
const matrixRowId = '019f2000-0000-7000-8000-000000000013'

const field = (codename: string, columnName: string, uiConfig: Record<string, unknown> = {}) => ({
    id: `${codename}-id`,
    codename,
    column_name: columnName,
    data_type: 'STRING' as const,
    parent_component_id: 'matrix-id',
    ui_config: uiConfig
})

const interpretationContract = {
    object: { id: 'interpretation-object', codename: 'Interpretation', table_name: 'interpretation' },
    fields: {},
    table: {
        ...field('InterpretationMatrix', 'interpretation_matrix'),
        data_type: 'TABLE' as const,
        validation_rules: { maxRows: 5000 }
    },
    childFields: Object.fromEntries(
        [
            field('CellId', 'cell_id', { serverOwned: true }),
            field('ParentCellId', 'parent_cell_id', { serverOwned: true }),
            field('RowKey', 'row_key', { serverOwned: true }),
            field('ColKey', 'col_key', { serverOwned: true }),
            field('RowLabel', 'row_label'),
            field('ColLabel', 'col_label'),
            field('CellValue', 'cell_value')
        ].map((item) => [item.codename, item])
    ),
    childTableName: 'interpretation_matrix_rows'
}

const emptyContract = (codename: string) => ({
    object: { id: `${codename}-object`, codename, table_name: codename.toLowerCase() },
    fields: {},
    childFields: {}
})

const surface = {
    applicationId: 'application-id',
    schemaName,
    workspaceId,
    layoutId: 'layout-id',
    widgetId: 'widget-id',
    widgetKey: 'interpretationNetworkWorkspace',
    widgetConfig: { structureMode: 'multiple' },
    structureMode: 'multiple',
    featureState: 'ready',
    missing: [],
    contracts: {
        Structure: emptyContract('Structure'),
        Interpretation: interpretationContract,
        Material: emptyContract('Material'),
        TableTemplate: emptyContract('TableTemplate')
    },
    resolvedObjects: {
        Structure: 'Structure-object',
        Interpretation: 'interpretation-object',
        Material: 'Material-object',
        TableTemplate: 'TableTemplate-object'
    }
} as unknown as RuntimeSurfaceReady

const makeContext = (permissions = { createContent: true, editContent: true, deleteContent: true }) => {
    const { executor, txExecutor } = createMockDbExecutor()
    return {
        executor,
        txExecutor,
        ctx: {
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            permissions,
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true
        } as unknown as RuntimeSchemaContext
    }
}

describe('runtimeInterpretationNetworkMatrixCommands', () => {
    it('generates server-owned cell identity and inserts the Matrix cell atomically', async () => {
        const { ctx, txExecutor } = makeContext()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) return []
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: matrixRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: '019f2000-0000-7000-8000-000000000099',
                        parent_cell_id: null,
                        row_key: 'row-1',
                        col_key: 'col-1',
                        row_label: 'Row',
                        col_label: 'Column',
                        cell_value: 'Value'
                    }
                ]
            }
            return []
        })

        const result = await createInterpretationNetworkMatrixCell(ctx, surface, {
            interpretationId,
            data: { RowLabel: 'Row', ColLabel: 'Column', CellValue: 'Value' },
            placement: { rowKey: 'row-1', colKey: 'col-1' }
        })

        expect(result.id).toBe(matrixRowId)
        expect(result.item.CellId).toBe('019f2000-0000-7000-8000-000000000099')
        const insertCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCall?.[1]).toEqual(expect.arrayContaining([workspaceId, userId, 'row-1', 'col-1']))
    })

    it('requires createContent and editContent to create a Matrix cell', async () => {
        const { ctx, executor } = makeContext({ createContent: false, editContent: true, deleteContent: true })
        await expect(
            createInterpretationNetworkMatrixCell(ctx, surface, {
                interpretationId,
                data: {},
                placement: {}
            })
        ).rejects.toMatchObject({ statusCode: 403, details: { permission: 'createContent' } })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('adds a child to the freshly bootstrapped root Matrix row contract', async () => {
        const { ctx, txExecutor } = makeContext()
        const rootCellId = '019f2000-0000-7000-8000-000000000020'
        const childCellId = '019f2000-0000-7000-8000-000000000099'
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000019',
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: rootCellId,
                        parent_cell_id: null,
                        row_key: `axis-${rootCellId}`,
                        col_key: `axis-${rootCellId}`,
                        row_label: { locales: { en: { content: 'Universe' } } },
                        col_label: { locales: { en: { content: 'Universe' } } }
                    }
                ]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: matrixRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: childCellId,
                        parent_cell_id: rootCellId,
                        row_key: `row-${childCellId}`,
                        col_key: `column-${childCellId}`,
                        row_label: { locales: { en: { content: 'Child' } } },
                        col_label: { locales: { en: { content: 'Child' } } },
                        cell_value: { locales: { en: { content: 'Child' } } }
                    }
                ]
            }
            return []
        })

        const result = await createInterpretationNetworkMatrixCell(
            ctx,
            { ...surface, structureMode: 'singleSystem' },
            {
                interpretationId,
                data: {
                    RowLabel: { locales: { en: { content: 'Child' } } },
                    ColLabel: { locales: { en: { content: 'Child' } } },
                    CellValue: { locales: { en: { content: 'Child' } } }
                },
                placement: {
                    parentCellId: rootCellId,
                    rowKey: `row-${childCellId}`,
                    colKey: `column-${childCellId}`,
                    sortOrder: 0
                }
            }
        )

        expect(result.item).toMatchObject({ CellId: childCellId, ParentCellId: rootCellId })
    })

    it('rejects client-supplied server-owned Matrix fields before a transaction', async () => {
        const { ctx, executor } = makeContext()
        await expect(
            createInterpretationNetworkMatrixCell(ctx, surface, {
                interpretationId,
                data: { CellId: 'client-controlled' },
                placement: {}
            })
        ).rejects.toMatchObject({ statusCode: 400, code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('enforces the published Matrix maxRows contract before inserting', async () => {
        const { ctx, txExecutor } = makeContext()
        const limitedSurface = {
            ...surface,
            contracts: {
                ...surface.contracts,
                Interpretation: {
                    ...surface.contracts.Interpretation,
                    table: { ...surface.contracts.Interpretation.table!, validation_rules: { maxRows: 1 } }
                }
            }
        }
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: matrixRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: '019f2000-0000-7000-8000-000000000021',
                        parent_cell_id: null,
                        row_key: 'row-1',
                        col_key: 'col-1'
                    }
                ]
            }
            return []
        })

        await expect(
            createInterpretationNetworkMatrixCell(ctx, limitedSurface, {
                interpretationId,
                data: {},
                placement: {}
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'INTERPRETATION_NETWORK_INVALID_MATRIX',
            details: { maxRows: 1, currentRows: 1 }
        })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rolls back a move that creates duplicate logical coordinates', async () => {
        const { ctx, txExecutor } = makeContext()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: matrixRowId,
                        _tp_sort_order: 0,
                        _upl_version: 1,
                        cell_id: '019f2000-0000-7000-8000-000000000021',
                        parent_cell_id: null,
                        row_key: 'row-1',
                        col_key: 'col-1',
                        row_label: 'Row',
                        col_label: 'Column'
                    },
                    {
                        id: '019f2000-0000-7000-8000-000000000014',
                        _tp_sort_order: 1,
                        _upl_version: 1,
                        cell_id: '019f2000-0000-7000-8000-000000000022',
                        parent_cell_id: null,
                        row_key: 'row-2',
                        col_key: 'col-2',
                        row_label: 'Row 2',
                        col_label: 'Column 2'
                    }
                ]
            }
            return []
        })

        await expect(
            moveInterpretationNetworkMatrixCells(ctx, surface, {
                interpretationId,
                updates: [{ matrixRowId, placement: { rowKey: 'row-2', colKey: 'col-2' } }]
            })
        ).rejects.toBeInstanceOf(InterpretationNetworkCommandError)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false)
    })

    it('reports stale move versions as 409 before writing', async () => {
        const { ctx, txExecutor } = makeContext()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) {
                return [
                    {
                        id: matrixRowId,
                        _tp_sort_order: 0,
                        _upl_version: 2,
                        cell_id: '019f2000-0000-7000-8000-000000000021',
                        parent_cell_id: null,
                        row_key: 'row-1',
                        col_key: 'col-1',
                        row_label: 'Row',
                        col_label: 'Column'
                    }
                ]
            }
            return []
        })
        await expect(
            moveInterpretationNetworkMatrixCells(ctx, surface, {
                interpretationId,
                updates: [{ matrixRowId, expectedVersion: 1, placement: { sortOrder: 1 } }]
            })
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
    })
})
