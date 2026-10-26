import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixCell, RuntimeColumnLike, RuntimeRow } from '../../model'
import { moveInterpretationNetworkMatrixCells } from '../../../../../api/interpretationNetwork'
import { useMatrixWorkspaceActions } from '../useMatrixWorkspaceActions'

vi.mock('../../../../../api/interpretationNetwork', () => ({
    moveInterpretationNetworkMatrixCells: vi.fn()
}))

const t = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction<'interpretationNetwork'>

const makeCell = (id: string, rawRowId: string, sortOrder: number): MatrixCell => ({
    id,
    rawRowId,
    parentCellId: null,
    depth: 0,
    rowKey: 'row-main',
    rowLabel: 'Main row',
    rowLabelValue: 'Main row',
    colKey: `column-${sortOrder}`,
    colLabel: `Column ${sortOrder + 1}`,
    colLabelValue: `Column ${sortOrder + 1}`,
    title: `Cell ${sortOrder + 1}`,
    description: '',
    materialRef: null,
    sortOrder,
    style: {
        fill: null,
        text: null,
        borderTop: '1px solid transparent',
        borderRight: '1px solid transparent',
        borderBottom: '1px solid transparent',
        borderLeft: '1px solid transparent'
    }
})

describe('useMatrixWorkspaceActions', () => {
    beforeEach(() => {
        vi.mocked(moveInterpretationNetworkMatrixCells).mockReset()
        vi.mocked(moveInterpretationNetworkMatrixCells).mockResolvedValue({ status: 'ok', updated: [] })
    })

    it('sends CellId and expected cell versions for matrix moves', async () => {
        const source = makeCell('019f2000-0000-7000-8000-000000000011', 'physical-row-source', 0)
        const target = makeCell('019f2000-0000-7000-8000-000000000012', 'physical-row-target', 1)
        const sourceRow: RuntimeRow = {
            id: 'physical-row-source',
            CellId: source.id,
            ParentCellId: null,
            RowKey: source.rowKey,
            ColKey: source.colKey,
            CellValue: source.title,
            _upl_version: 4
        }
        const targetRow: RuntimeRow = {
            id: 'physical-row-target',
            CellId: target.id,
            ParentCellId: null,
            RowKey: target.rowKey,
            ColKey: target.colKey,
            CellValue: target.title,
            _upl_version: 7
        }
        const cells = [source, target]
        const rawRowsByCellId = new Map([
            [source.id, sourceRow],
            [target.id, targetRow]
        ])
        const matrixChildColumns: RuntimeColumnLike[] = [
            { id: 'cell-id', field: 'CellId', codename: 'CellId', dataType: 'STRING', uiConfig: { serverOwned: true } },
            { id: 'parent', field: 'ParentCellId', codename: 'ParentCellId', dataType: 'STRING', uiConfig: { serverOwned: true } },
            { id: 'row-key', field: 'RowKey', codename: 'RowKey', dataType: 'STRING', uiConfig: { serverOwned: true } },
            { id: 'col-key', field: 'ColKey', codename: 'ColKey', dataType: 'STRING', uiConfig: { serverOwned: true } }
        ]
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(
            () =>
                useMatrixWorkspaceActions({
                    t,
                    queryClient,
                    canEditContent: true,
                    apiBaseUrl: '/api/v1',
                    applicationId: 'app-1',
                    workspaceId: 'workspace-1',
                    widgetId: 'widget-1',
                    layoutId: 'layout-1',
                    selectedInterpretationId: 'interpretation-1',
                    matrixChildColumns,
                    matrixRowsSnapshotRef: { current: { cells, rawRowsByCellId } },
                    setMatrixDropState: vi.fn(),
                    matrixMutationsDisabled: false,
                    effectiveMatrixView: 'verticalTree',
                    tableProjection: 'hierarchicalPath',
                    widgetMatrixMode: 'hierarchicalCells',
                    locale: 'en',
                    visibleMatrixCells: cells,
                    matrixCellIds: cells.map((cell) => cell.id),
                    selectedCell: source,
                    selectMatrixCell: vi.fn(),
                    readRuntimeRowVersion: (row) => (typeof row?._upl_version === 'number' ? row._upl_version : undefined),
                    readSubmittedText: (value) => (typeof value === 'string' ? value : ''),
                    setCellDialogError: vi.fn()
                }),
            { wrapper }
        )

        await result.current.moveCellMutation.mutateAsync({
            sourceCellId: source.id,
            targetCellId: target.id,
            placement: 'after',
            destination: { placement: 'after', targetCellId: target.id, parentCellId: null, insertionIndex: 1 }
        })

        expect(moveInterpretationNetworkMatrixCells).toHaveBeenCalledWith(
            expect.objectContaining({
                interpretationId: 'interpretation-1',
                widgetId: 'widget-1',
                layoutId: 'layout-1',
                updates: [
                    expect.objectContaining({ cellId: source.id, expectedVersion: 4 }),
                    expect.objectContaining({ cellId: target.id, expectedVersion: 7 })
                ]
            })
        )
        const request = vi.mocked(moveInterpretationNetworkMatrixCells).mock.calls[0]?.[0]
        expect(JSON.stringify(request)).not.toContain('physical-row-source')
        expect(JSON.stringify(request)).not.toContain('physical-row-target')
        expect(JSON.stringify(request)).not.toContain('matrixRowId')
    })
})
