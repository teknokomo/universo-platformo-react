import { createInterpretationNetworkMatrixCell } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import { insertRow } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { resolveEffectiveRolePermissions } from '../../routes/guards'
import {
    cellStyleSurface,
    deniedInterpretationSurface,
    interpretationContract,
    interpretationId,
    makeContext,
    matrixRowId,
    schemaName,
    surface,
    userId,
    workspaceId
} from './runtimeInterpretationNetworkMatrixTestUtils'

describe('createInterpretationNetworkMatrixCell', () => {
    it('rejects core Entity row inserts for a denied policy before issuing SQL', async () => {
        const { executor } = makeContext()
        const deniedContract = {
            ...interpretationContract,
            object: {
                ...interpretationContract.object,
                config: {
                    recordPolicy: {
                        version: 1,
                        denyDeleteWhenBound: false,
                        immutableSemanticKeyWhenBound: false,
                        runtimeMutation: 'deny'
                    }
                }
            }
        }

        await expect(
            insertRow(executor, {
                schemaName,
                contract: deniedContract as never,
                values: {},
                workspaceId: null,
                userId
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'RUNTIME_ENTITY_MUTATION_DENIED' })
        expect(executor.query).not.toHaveBeenCalled()
    })
    it.each(['owner', 'admin'] as const)('allows %s to create a Matrix cell with projected runtime permissions', async (role) => {
        const { ctx, txExecutor } = makeContext(resolveEffectiveRolePermissions(role))
        ctx.role = role
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

        const result = await createInterpretationNetworkMatrixCell(ctx, deniedInterpretationSurface(), {
            interpretationId,
            data: { RowLabel: 'Row', ColLabel: 'Column', CellValue: 'Value' },
            placement: { rowKey: 'row-1', colKey: 'col-1' }
        })

        expect(result.id).toBe(matrixRowId)
        expect(result.item.CellId).toBe('019f2000-0000-7000-8000-000000000099')
        const insertCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCall?.[1]).toEqual(expect.arrayContaining([workspaceId, userId, 'row-1', 'col-1']))
        expect(insertCall?.[1]).toEqual(
            expect.arrayContaining([
                expect.stringContaining('"_schema":"1"'),
                expect.stringContaining('"content":"Row"'),
                expect.stringContaining('"content":"Column"'),
                expect.stringContaining('"content":"Value"')
            ])
        )
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
    it('rejects Matrix creation when editContent is denied, even if createContent is allowed', async () => {
        const { ctx, executor } = makeContext({ createContent: true, editContent: false, deleteContent: true })

        await expect(
            createInterpretationNetworkMatrixCell(ctx, surface, {
                interpretationId,
                data: {},
                placement: {}
            })
        ).rejects.toMatchObject({ statusCode: 403, details: { permission: 'editContent' } })
        expect(executor.transaction).not.toHaveBeenCalled()
    })
    it('enforces the selected style palette and individual cell-style capabilities before writing', async () => {
        const { ctx, txExecutor } = makeContext()
        const policy = {
            allowedColors: ['#00FF00'],
            allowCustomColors: false,
            editable: { fillColor: false, textColor: true, borderColor: true, borderWidth: false, borderStyle: true }
        }

        await expect(
            createInterpretationNetworkMatrixCell(ctx, cellStyleSurface(policy), {
                interpretationId,
                data: { CellFillColor: '#00FF00' },
                placement: {}
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'INTERPRETATION_NETWORK_PERMISSION_DENIED' })
        await expect(
            createInterpretationNetworkMatrixCell(ctx, cellStyleSurface({ ...policy, editable: { ...policy.editable, fillColor: true } }), {
                interpretationId,
                data: { CellFillColor: '#FF0000' },
                placement: {}
            })
        ).rejects.toMatchObject({ statusCode: 400, code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        await expect(
            createInterpretationNetworkMatrixCell(
                ctx,
                cellStyleSurface({ ...policy, editable: { ...policy.editable, borderWidth: true } }),
                { interpretationId, data: { BorderTopWidth: '9px' }, placement: {} }
            )
        ).rejects.toMatchObject({ statusCode: 400, code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        await expect(
            createInterpretationNetworkMatrixCell(
                ctx,
                cellStyleSurface({ ...policy, editable: { ...policy.editable, borderStyle: true } }),
                { interpretationId, data: { BorderTopStyle: 'wavy' }, placement: {} }
            )
        ).rejects.toMatchObject({ statusCode: 400, code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })
    it('fails closed when the active cell-style policy is malformed', async () => {
        const { ctx, txExecutor } = makeContext()

        await expect(
            createInterpretationNetworkMatrixCell(
                ctx,
                cellStyleSurface({
                    allowedColors: ['#00FF00'],
                    allowCustomColors: true,
                    editable: { fillColor: true }
                }),
                { interpretationId, data: { CellFillColor: '#00FF00' }, placement: {} }
            )
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
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
        const insertCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCall?.[1]).toEqual(
            expect.arrayContaining([
                '{"locales":{"en":{"content":"Child"}}}',
                '{"locales":{"en":{"content":"Child"}}}',
                '{"locales":{"en":{"content":"Child"}}}'
            ])
        )
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
    it('rejects object payloads for non-localized STRING fields before a transaction', async () => {
        const { ctx, executor } = makeContext()
        await expect(
            createInterpretationNetworkMatrixCell(ctx, surface, {
                interpretationId,
                data: { PlainNote: { locales: { en: { content: 'Not allowed' } } } },
                placement: {}
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: 'INTERPRETATION_NETWORK_INVALID_CELL',
            details: { field: 'PlainNote' }
        })
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
})
