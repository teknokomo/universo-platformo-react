import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixCell, RuntimeColumnLike, RuntimeRow } from '../../model'
import {
    createInterpretationNetworkMatrixCell,
    deleteInterpretationNetworkMatrixCell,
    updateInterpretationNetworkMatrixCell
} from '../../../../../api/interpretationNetwork'
import { useCellMutations } from '../useCellMutations'

vi.mock('../../../../../api/interpretationNetwork', () => ({
    createInterpretationNetworkMatrixCell: vi.fn(),
    deleteInterpretationNetworkMatrixCell: vi.fn(),
    updateInterpretationNetworkMatrixCell: vi.fn()
}))

const t = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction<'interpretationNetwork'>

const matrixColumn: RuntimeColumnLike = {
    id: 'matrix-column',
    field: 'InterpretationMatrix',
    codename: 'InterpretationMatrix',
    dataType: 'TABLE',
    childColumns: [
        { id: 'cell-value', field: 'CellValue', codename: 'CellValue', dataType: 'STRING' },
        { id: 'cell-id', field: 'CellId', codename: 'CellId', dataType: 'STRING' },
        { id: 'parent-cell-id', field: 'ParentCellId', codename: 'ParentCellId', dataType: 'STRING' },
        { id: 'row-key', field: 'RowKey', codename: 'RowKey', dataType: 'STRING' },
        { id: 'col-key', field: 'ColKey', codename: 'ColKey', dataType: 'STRING' }
    ]
}

const rootCell: MatrixCell = {
    id: '019f2000-0000-7000-8000-000000000001',
    rawRowId: 'row-root',
    parentCellId: null,
    depth: 0,
    rowKey: 'root-row',
    rowLabel: 'Universe',
    rowLabelValue: 'Universe',
    colKey: 'root-column',
    colLabel: 'Universe',
    colLabelValue: 'Universe',
    title: 'Universe',
    description: '',
    materialRef: null,
    sortOrder: 0,
    style: {
        fill: null,
        text: null,
        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.12)'
    }
}

const rootRow: RuntimeRow = {
    id: 'row-root',
    CellId: rootCell.id,
    ParentCellId: null,
    RowKey: rootCell.rowKey,
    ColKey: rootCell.colKey,
    CellValue: 'Universe'
}

const renderUseCellMutations = (
    canCreateContent: boolean,
    setCellDialogError = vi.fn(),
    overrides: {
        cells?: MatrixCell[]
        rawRowsByCellId?: Map<string, RuntimeRow>
        deleteCell?: MatrixCell
        deleteRawCell?: RuntimeRow
        cellDeleteId?: string | null
    } = {}
) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    return renderHook(
        () =>
            useCellMutations({
                t,
                queryClient,
                canCreateContent,
                canEditContent: true,
                canDeleteContent: true,
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'workspace-1',
                widgetId: 'widget-1',
                layoutId: 'layout-1',
                locale: 'en',
                interpretationSectionId: 'interpretation-section',
                selectedInterpretationId: 'interpretation-1',
                matrixColumn,
                selectedCellId: rootCell.id,
                deleteCell: overrides.deleteCell,
                deleteRawCell: overrides.deleteRawCell,
                cellDialogSourceCellId: rootCell.id,
                activeCellDialogPlacement: {
                    row: { kind: 'new' },
                    column: { kind: 'new' },
                    parentCellId: rootCell.id
                },
                widgetMatrixMode: 'hierarchicalCells',
                rootCellId: rootCell.id,
                matrixRowsSnapshotRef: {
                    current: {
                        cells: overrides.cells ?? [rootCell],
                        rawRowsByCellId: overrides.rawRowsByCellId ?? new Map([[rootCell.id, rootRow]])
                    }
                },
                readRuntimeRowVersion: () => 1,
                readSubmittedText: (value) => (typeof value === 'string' ? value : ''),
                selectMatrixCell: vi.fn(),
                setPendingSelectedCellId: vi.fn(),
                setCellDialogMode: vi.fn(),
                setAxisDialogKind: vi.fn(),
                setCellDialogSourceCellId: vi.fn(),
                setCellDialogPlacement: vi.fn(),
                setCellDialogError,
                cellDeleteId: overrides.cellDeleteId ?? null,
                setCellDeleteId: vi.fn(),
                setCellDeleteError: vi.fn()
            }),
        { wrapper }
    )
}

describe('useCellMutations', () => {
    beforeEach(() => {
        vi.mocked(createInterpretationNetworkMatrixCell).mockReset()
        vi.mocked(updateInterpretationNetworkMatrixCell).mockReset()
        vi.mocked(deleteInterpretationNetworkMatrixCell).mockReset()
    })

    it('fails stale child creation before calling the backend when create permission is absent', async () => {
        const setCellDialogError = vi.fn()
        const { result } = renderUseCellMutations(false, setCellDialogError)

        await expect(
            result.current.saveCellMutation.mutateAsync({
                mode: 'create-child',
                data: { CellValue: 'Blocked child' }
            })
        ).rejects.toThrow('permission-denied')

        expect(createInterpretationNetworkMatrixCell).not.toHaveBeenCalled()
        await waitFor(() => expect(result.current.saveCellMutation.isError).toBe(true))
        expect(setCellDialogError).toHaveBeenCalledWith('You do not have permission to change matrix cells.')
    })

    it('allows edit submissions with edit permission even when create permission is absent', async () => {
        const { result } = renderUseCellMutations(false)

        await expect(
            result.current.saveCellMutation.mutateAsync({
                mode: 'edit',
                data: { CellValue: 'Renamed root' }
            })
        ).resolves.toBeTruthy()

        expect(createInterpretationNetworkMatrixCell).not.toHaveBeenCalled()
        expect(updateInterpretationNetworkMatrixCell).toHaveBeenCalledWith(
            expect.objectContaining({
                interpretationId: 'interpretation-1',
                cellId: rootCell.id,
                expectedCellVersion: 1,
                widgetId: 'widget-1',
                layoutId: 'layout-1',
                data: expect.objectContaining({ CellValue: 'Renamed root' })
            })
        )
        expect(JSON.stringify(vi.mocked(updateInterpretationNetworkMatrixCell).mock.calls[0]?.[0])).not.toContain('row-root')
    })

    it('deletes a cell through its semantic CellId and expected cell version', async () => {
        const childCell: MatrixCell = {
            ...rootCell,
            id: '019f2000-0000-7000-8000-000000000002',
            rawRowId: 'row-child',
            parentCellId: rootCell.id,
            depth: 1
        }
        const childRow: RuntimeRow = { ...rootRow, id: 'row-child', CellId: childCell.id, ParentCellId: rootCell.id }
        const { result } = renderUseCellMutations(true, vi.fn(), {
            cells: [rootCell, childCell],
            rawRowsByCellId: new Map([
                [rootCell.id, rootRow],
                [childCell.id, childRow]
            ]),
            deleteCell: childCell,
            deleteRawCell: childRow,
            cellDeleteId: childCell.id
        })

        await expect(result.current.deleteCellMutation.mutateAsync()).resolves.toBeUndefined()

        expect(deleteInterpretationNetworkMatrixCell).toHaveBeenCalledWith(
            expect.objectContaining({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                workspaceId: 'workspace-1',
                interpretationId: 'interpretation-1',
                cellId: childCell.id,
                expectedCellVersion: 1,
                widgetId: 'widget-1',
                layoutId: 'layout-1'
            })
        )
        expect(JSON.stringify(vi.mocked(deleteInterpretationNetworkMatrixCell).mock.calls[0]?.[0])).not.toContain('row-child')
    })
})
