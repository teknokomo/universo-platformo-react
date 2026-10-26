import { moveInterpretationNetworkMatrixCells } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import {
    InterpretationNetworkCommandError,
    interpretationNetworkMatrixCellsMoveRequestSchema
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import {
    cellId,
    deniedInterpretationSurface,
    interpretationId,
    makeContext,
    matrixRowId,
    surface
} from './runtimeInterpretationNetworkMatrixTestUtils'

describe('moveInterpretationNetworkMatrixCells', () => {
    it('requires a positive expected version for each batch update', () => {
        const missingVersion = interpretationNetworkMatrixCellsMoveRequestSchema.safeParse({
            interpretationId,
            updates: [{ cellId, placement: {} }]
        })
        const versionedUpdate = interpretationNetworkMatrixCellsMoveRequestSchema.safeParse({
            interpretationId,
            updates: [{ cellId, expectedVersion: 1, placement: {} }]
        })

        expect(missingVersion.success).toBe(false)
        expect(versionedUpdate.success).toBe(true)
    })

    it('moves localized Matrix labels through json-backed VLC storage without accepting unknown fields', async () => {
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
                        row_label: { locales: { en: { content: 'Row' } } },
                        col_label: { locales: { en: { content: 'Column' } } },
                        cell_value: { locales: { en: { content: 'Value' } } }
                    }
                ]
            }
            if (String(sql).startsWith('UPDATE')) return [{ id: matrixRowId }]
            return []
        })

        await expect(
            moveInterpretationNetworkMatrixCells(ctx, deniedInterpretationSurface(), {
                interpretationId,
                updates: [
                    {
                        cellId,
                        expectedVersion: 1,
                        placement: { sortOrder: 1 },
                        data: {
                            RowLabel: { locales: { en: { content: 'Updated row' } } },
                            CellValue: { locales: { en: { content: 'Updated value' } } }
                        }
                    }
                ]
            })
        ).resolves.toEqual({ status: 'ok', updated: [cellId] })
        const updateCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE'))
        expect(updateCall?.[1]).toEqual(
            expect.arrayContaining(['{"locales":{"en":{"content":"Updated row"}}}', '{"locales":{"en":{"content":"Updated value"}}}'])
        )

        await expect(
            moveInterpretationNetworkMatrixCells(ctx, deniedInterpretationSurface(), {
                interpretationId,
                updates: [{ cellId, expectedVersion: 1, placement: {}, data: { NotAField: 'bad' } }]
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: 'INTERPRETATION_NETWORK_INVALID_CELL',
            details: { field: 'NotAField' }
        })
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
                updates: [{ cellId, expectedVersion: 1, placement: { rowKey: 'row-2', colKey: 'col-2' } }]
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
                updates: [{ cellId, expectedVersion: 1, placement: { sortOrder: 1 } }]
            })
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
    })

    it('rejects a stale item in a mixed batch before writing any Matrix rows', async () => {
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
                        row_label: 'Row 1',
                        col_label: 'Column 1'
                    },
                    {
                        id: '019f2000-0000-7000-8000-000000000014',
                        _tp_sort_order: 1,
                        _upl_version: 3,
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
                updates: [
                    { cellId, expectedVersion: 1, placement: { sortOrder: 1 } },
                    { cellId: '019f2000-0000-7000-8000-000000000022', expectedVersion: 2, placement: { sortOrder: 0 } }
                ]
            })
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE'))).toBe(false)
    })
})
