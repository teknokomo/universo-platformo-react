import { updateInterpretationNetworkMatrixCell } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCommands'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { resolveEffectiveRolePermissions } from '../../routes/guards'
import {
    cellId,
    deniedInterpretationSurface,
    interpretationId,
    makeContext,
    matrixRowId
} from './runtimeInterpretationNetworkMatrixTestUtils'

describe('updateInterpretationNetworkMatrixCell', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it.each(['owner', 'admin'] as const)('allows %s to edit Matrix content with projected runtime permissions', async (role) => {
        const runtimeSurface = deniedInterpretationSurface()
        runtimeSurface.contracts.Interpretation.childFields.CellDescription = {
            id: 'CellDescription-id',
            codename: 'CellDescription',
            column_name: 'cell_description',
            data_type: 'STRING',
            parent_component_id: 'matrix-id',
            validation_rules: { localized: true, versioned: true },
            ui_config: { widget: 'textarea', gridHidden: true }
        }

        const description = {
            _schema: '1',
            _primary: 'en',
            locales: { en: { content: 'Updated description.\nSecond line.' } }
        }
        const rows = [
            {
                id: matrixRowId,
                _upl_version: 4,
                cell_id: cellId,
                parent_cell_id: null,
                row_key: 'row-a',
                col_key: 'column-a',
                row_label: JSON.stringify({ locales: { en: { content: 'Row A' } } }),
                col_label: JSON.stringify({ locales: { en: { content: 'Column A' } } }),
                cell_value: JSON.stringify({ locales: { en: { content: 'Before' } } }),
                cell_description: JSON.stringify({ locales: { en: { content: 'Before description' } } })
            }
        ]
        const { ctx, txExecutor } = makeContext(resolveEffectiveRolePermissions(role))
        ctx.role = role
        let persistedDescription: unknown
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) return rows
            if (sql.startsWith('UPDATE') && sql.includes('"interpretation_matrix_rows"')) {
                const descriptionParameter = sql.match(/"cell_description" = \$(\d+)/)
                if (descriptionParameter) persistedDescription = params[Number(descriptionParameter[1]) - 1]
                return [{ id: matrixRowId, _upl_version: 5 }]
            }
            return []
        })

        const result = await updateInterpretationNetworkMatrixCell(ctx, runtimeSurface, {
            interpretationId,
            cellId,
            expectedCellVersion: 4,
            data: { CellValue: 'Updated title', CellDescription: description }
        })

        expect(result).toEqual({ cellId, version: 5 })
        expect(persistedDescription).toBe(JSON.stringify(description))
        expect(JSON.parse(String(persistedDescription))).toEqual(description)
        expect(txExecutor.query.mock.calls).toContainEqual([
            'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
            [`interpretation-network:matrix:${runtimeSurface.schemaName}:${runtimeSurface.workspaceId}:${interpretationId}`]
        ])
    })

    it('rejects a Matrix edit when editContent is denied before opening a transaction', async () => {
        const { ctx, executor } = makeContext({ createContent: true, editContent: false, deleteContent: true })

        await expect(
            updateInterpretationNetworkMatrixCell(ctx, deniedInterpretationSurface(), {
                interpretationId,
                cellId,
                expectedCellVersion: 1,
                data: { CellValue: 'Updated' }
            })
        ).rejects.toMatchObject({ statusCode: 403, details: { permission: 'editContent' } })
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('fans changed axis labels out atomically and leaves peers untouched when labels are unchanged', async () => {
        const localized = (content: string) => JSON.stringify({ locales: { en: { content } } })
        const rows = [
            {
                id: matrixRowId,
                _upl_version: 2,
                cell_id: cellId,
                parent_cell_id: null,
                row_key: 'row-a',
                col_key: 'column-a',
                row_label: localized('Row A'),
                col_label: localized('Column A'),
                cell_value: localized('Before')
            },
            {
                id: '019f2000-0000-7000-8000-000000000014',
                _upl_version: 4,
                cell_id: '019f2000-0000-7000-8000-000000000022',
                parent_cell_id: null,
                row_key: 'row-a',
                col_key: 'column-b',
                row_label: localized('Row A'),
                col_label: localized('Column B'),
                cell_value: localized('Peer row')
            },
            {
                id: '019f2000-0000-7000-8000-000000000015',
                _upl_version: 6,
                cell_id: '019f2000-0000-7000-8000-000000000023',
                parent_cell_id: null,
                row_key: 'row-b',
                col_key: 'column-a',
                row_label: localized('Row B'),
                col_label: localized('Column A'),
                cell_value: localized('Peer column')
            },
            {
                id: '019f2000-0000-7000-8000-000000000016',
                _upl_version: 8,
                cell_id: '019f2000-0000-7000-8000-000000000024',
                parent_cell_id: null,
                row_key: 'row-b',
                col_key: 'column-b',
                row_label: localized('Row B'),
                col_label: localized('Column B'),
                cell_value: localized('Unrelated peer')
            }
        ]

        const runUpdate = async (data: Record<string, unknown>) => {
            const { ctx, txExecutor } = makeContext()
            txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
                if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
                if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) return rows
                if (sql.startsWith('UPDATE') && sql.includes('"interpretation_matrix_rows"')) {
                    const updatedRow = rows.find((row) => params.includes(row.id))
                    return updatedRow ? [{ id: updatedRow.id, _upl_version: Number(updatedRow._upl_version) + 1 }] : []
                }
                return []
            })

            const result = await updateInterpretationNetworkMatrixCell(ctx, deniedInterpretationSurface(), {
                interpretationId,
                cellId,
                expectedCellVersion: 2,
                data
            })
            const updateCalls = txExecutor.query.mock.calls.filter(
                ([sql]) => String(sql).startsWith('UPDATE') && String(sql).includes('"interpretation_matrix_rows"')
            )
            return { result, updateCalls }
        }

        const changedLabels = await runUpdate({
            RowLabel: { locales: { en: { content: 'Row A updated' } } },
            ColLabel: { locales: { en: { content: 'Column A updated' } } },
            CellValue: { locales: { en: { content: 'Updated value' } } }
        })

        expect(changedLabels.result).toEqual({ cellId, version: 3 })
        expect(changedLabels.updateCalls).toHaveLength(3)
        const updatesByRowId = new Map(
            changedLabels.updateCalls.map(([sql, params]) => {
                const row = rows.find((candidate) => (params as unknown[]).includes(candidate.id))
                return [row?.id, String(sql)]
            })
        )
        expect(updatesByRowId.get(matrixRowId)).toContain('"cell_value" = $')
        expect(updatesByRowId.get(matrixRowId)).toContain('"row_label" = $')
        expect(updatesByRowId.get(matrixRowId)).toContain('"col_label" = $')
        expect(updatesByRowId.get('019f2000-0000-7000-8000-000000000014')).toContain('"row_label" = $')
        expect(updatesByRowId.get('019f2000-0000-7000-8000-000000000014')).not.toContain('"col_label" = $')
        expect(updatesByRowId.get('019f2000-0000-7000-8000-000000000015')).toContain('"col_label" = $')
        expect(updatesByRowId.get('019f2000-0000-7000-8000-000000000015')).not.toContain('"row_label" = $')
        expect(updatesByRowId.has('019f2000-0000-7000-8000-000000000016')).toBe(false)

        const unchangedLabels = await runUpdate({
            RowLabel: { locales: { en: { content: 'Row A' } } },
            ColLabel: { locales: { en: { content: 'Column A' } } },
            CellValue: { locales: { en: { content: 'Updated value only' } } }
        })

        expect(unchangedLabels.result).toEqual({ cellId, version: 3 })
        expect(unchangedLabels.updateCalls).toHaveLength(1)
        const unchangedUpdateParams = (unchangedLabels.updateCalls[0]?.[1] ?? []) as unknown[]
        const unchangedUpdateRowId = rows.find((row) => unchangedUpdateParams.includes(row.id))?.id
        expect(unchangedUpdateRowId).toBe(matrixRowId)
        expect(String(unchangedLabels.updateCalls[0]?.[0])).toContain('"cell_value" = $')
        expect(String(unchangedLabels.updateCalls[0]?.[0])).toContain('"row_label" = $')
        expect(String(unchangedLabels.updateCalls[0]?.[0])).toContain('"col_label" = $')
    })

    it('dispatches lifecycle events only to components changed by each row update', async () => {
        const dispatchLifecycleEvent = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
        const { ctx, txExecutor } = makeContext()
        const localized = (content: string) => JSON.stringify({ locales: { en: { content } } })
        const rows = [
            {
                id: matrixRowId,
                _upl_version: 2,
                cell_id: cellId,
                parent_cell_id: null,
                row_key: 'row-a',
                col_key: 'column-a',
                row_label: localized('Row A'),
                col_label: localized('Column A'),
                cell_value: localized('Before')
            },
            {
                id: '019f2000-0000-7000-8000-000000000014',
                _upl_version: 4,
                cell_id: '019f2000-0000-7000-8000-000000000022',
                parent_cell_id: null,
                row_key: 'row-a',
                col_key: 'column-b',
                row_label: localized('Row A'),
                col_label: localized('Column B'),
                cell_value: localized('Peer row')
            },
            {
                id: '019f2000-0000-7000-8000-000000000015',
                _upl_version: 6,
                cell_id: '019f2000-0000-7000-8000-000000000023',
                parent_cell_id: null,
                row_key: 'row-b',
                col_key: 'column-a',
                row_label: localized('Row B'),
                col_label: localized('Column A'),
                cell_value: localized('Peer column')
            },
            {
                id: '019f2000-0000-7000-8000-000000000016',
                _upl_version: 8,
                cell_id: '019f2000-0000-7000-8000-000000000024',
                parent_cell_id: null,
                row_key: 'row-b',
                col_key: 'column-b',
                row_label: localized('Row B'),
                col_label: localized('Column B'),
                cell_value: localized('Unrelated peer')
            }
        ]
        txExecutor.query.mockImplementation(async (sql: string, _params: unknown[] = []) => {
            if (sql.includes('FROM') && sql.includes('"interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('SELECT id') && sql.includes('"interpretation_matrix_rows"')) return rows
            if (sql.startsWith('UPDATE') && sql.includes('"interpretation_matrix_rows"')) {
                const updatedRow = rows.find((row) => _params.includes(row.id))
                return updatedRow ? [{ id: updatedRow.id, _upl_version: Number(updatedRow._upl_version) + 1 }] : []
            }
            return []
        })

        await updateInterpretationNetworkMatrixCell(ctx, deniedInterpretationSurface(), {
            interpretationId,
            cellId,
            expectedCellVersion: 2,
            data: {
                RowLabel: { locales: { en: { content: 'Row A updated' } } },
                ColLabel: { locales: { en: { content: 'Column A updated' } } },
                CellValue: { locales: { en: { content: 'After' } } }
            }
        })
        await new Promise<void>((resolve) => setImmediate(resolve))

        expect(dispatchLifecycleEvent).toHaveBeenCalledTimes(6)
        expect(dispatchLifecycleEvent.mock.calls.map(([request]) => request.componentIds)).toEqual([
            ['RowLabel-id', 'ColLabel-id', 'CellValue-id'],
            ['RowLabel-id'],
            ['ColLabel-id'],
            ['RowLabel-id', 'ColLabel-id', 'CellValue-id'],
            ['RowLabel-id'],
            ['ColLabel-id']
        ])
    })
})
