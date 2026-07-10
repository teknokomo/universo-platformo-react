import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import type { MatrixCell } from '../../model'
import type { MatrixDragPreview, MatrixDropState } from '../../matrixDrag'
import { MatrixWorkspace } from '../MatrixWorkspace'

const t = ((key: string, options?: unknown, fallback?: string) => {
    const template =
        typeof options === 'string'
            ? options
            : options && typeof options === 'object' && 'defaultValue' in options
            ? String((options as { defaultValue?: unknown }).defaultValue)
            : fallback ?? key

    if (!options || typeof options !== 'object') return template
    return Object.entries(options as Record<string, unknown>).reduce(
        (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
        template
    )
}) as TFunction<'interpretationNetwork'>

const cell = (input: Partial<MatrixCell> & Pick<MatrixCell, 'id' | 'parentCellId' | 'sortOrder'>): MatrixCell => ({
    rawRowId: `row-${input.id}`,
    depth: input.parentCellId ? 1 : 0,
    rowKey: `${input.id}-row`,
    rowLabel: `${input.id} row`,
    rowLabelValue: `${input.id} row`,
    colKey: `${input.id}-column`,
    colLabel: `${input.id} column`,
    colLabelValue: `${input.id} column`,
    title: input.id,
    description: '',
    materialRef: null,
    style: {
        fill: null,
        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.12)'
    },
    ...input
})

const dropState: MatrixDropState = {
    activeCellId: 'child-a',
    overCellId: 'parent-a',
    placement: 'child',
    isValid: true,
    destination: {
        placement: 'child',
        targetCellId: 'parent-a',
        parentCellId: 'parent-a',
        insertionIndex: 0
    }
}

describe('MatrixWorkspace', () => {
    it('keeps the full Matrix Table model while a hierarchical drag preview is focused', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, rowLabel: 'Root row', colLabel: 'Root column', title: 'Universe' }),
            cell({ id: 'parent-a', parentCellId: 'root', sortOrder: 0, rowLabel: 'Parent A row', colLabel: 'Parent A column' }),
            cell({ id: 'parent-b', parentCellId: 'root', sortOrder: 1, rowLabel: 'Parent B row', colLabel: 'Parent B column' }),
            cell({ id: 'child-a', parentCellId: 'parent-a', sortOrder: 0, rowLabel: 'Child A row', colLabel: 'Child A column' }),
            cell({ id: 'child-b', parentCellId: 'parent-b', sortOrder: 0, rowLabel: 'Child B row', colLabel: 'Child B column' })
        ]
        const focusedPreview: MatrixDragPreview = {
            activeCellId: 'child-a',
            destination: dropState.destination!,
            visibleCells: [cells[0], cells[1], cells[3]],
            hierarchyRows: [[cells[0]], [cells[1]], [cells[3]]]
        }

        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                hierarchyRows={[[cells[0]], [cells[1], cells[2]], [cells[3], cells[4]]]}
                positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
                matrixCells={cells}
                visibleMatrixCells={cells}
                matrixRows={[]}
                materialCountByCellId={new Map()}
                matrixCellIds={cells.map((item) => item.id)}
                selectedCell={cells[3]}
                matrixDropState={dropState}
                matrixDragPreview={focusedPreview}
                matrixMutationsDisabled={false}
                isSavingCell={false}
                isMovingCell={false}
                matrixRowsError={null}
                saveCellError={null}
                moveCellError={null}
                canEditContent
                canDeleteContent
                cellMenuAnchor={null}
                menuCell={undefined}
                menuMoves={[]}
                isDeletingCell={false}
                sensors={[]}
                onChangeMatrixView={vi.fn()}
                onOpenCellDialog={vi.fn()}
                onAddTableRow={vi.fn()}
                onAddTableColumn={vi.fn()}
                onMoveSelectedToSlot={vi.fn()}
                onSelectCell={vi.fn()}
                onOpenCellMenu={vi.fn()}
                onCloseCellMenu={vi.fn()}
                onRequestDeleteCell={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragOver={vi.fn()}
                onDragCancel={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        const table = screen.getByRole('table', { name: 'Matrix table' })
        expect(within(table).getByRole('rowheader', { name: 'Parent B row' })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: 'Child B row' })).toBeInTheDocument()
        expect(within(table).getByRole('columnheader', { name: 'Parent B column' })).toBeInTheDocument()
        expect(within(table).getByRole('columnheader', { name: 'Child B column' })).toBeInTheDocument()
    })

    it('keeps Matrix Table axis actions reachable while requiring a selected cell for empty-slot keyboard moves', async () => {
        const user = userEvent.setup()
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, rowLabel: 'Root row', colLabel: 'Root column', title: 'Universe' }),
            cell({ id: 'child', parentCellId: 'root', sortOrder: 0, rowLabel: 'Child row', colLabel: 'Child column' })
        ]
        const onAddTableRow = vi.fn()
        const onAddTableColumn = vi.fn()
        const onMoveSelectedToSlot = vi.fn()

        const { rerender } = render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                hierarchyRows={[[cells[0]], [cells[1]]]}
                positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
                matrixCells={cells}
                visibleMatrixCells={cells}
                matrixRows={[]}
                materialCountByCellId={new Map()}
                matrixCellIds={cells.map((item) => item.id)}
                selectedCell={undefined}
                matrixDropState={EMPTY_TEST_DROP_STATE}
                matrixDragPreview={null}
                matrixMutationsDisabled={false}
                isSavingCell={false}
                isMovingCell={false}
                matrixRowsError={null}
                saveCellError={null}
                moveCellError={null}
                canEditContent
                canDeleteContent
                cellMenuAnchor={null}
                menuCell={undefined}
                menuMoves={[]}
                isDeletingCell={false}
                sensors={[]}
                onChangeMatrixView={vi.fn()}
                onOpenCellDialog={vi.fn()}
                onAddTableRow={onAddTableRow}
                onAddTableColumn={onAddTableColumn}
                onMoveSelectedToSlot={onMoveSelectedToSlot}
                onSelectCell={vi.fn()}
                onOpenCellMenu={vi.fn()}
                onCloseCellMenu={vi.fn()}
                onRequestDeleteCell={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragOver={vi.fn()}
                onDragCancel={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        const table = screen.getByRole('table', { name: 'Matrix table' })
        const addRow = within(table).getByRole('button', { name: 'Add row' })
        const addColumn = within(table).getByRole('button', { name: 'Add column' })
        expect(addRow).toBeEnabled()
        expect(addColumn).toBeEnabled()
        fireEvent.click(addRow)
        fireEvent.click(addColumn)
        expect(onAddTableRow).toHaveBeenCalledTimes(1)
        expect(onAddTableColumn).toHaveBeenCalledTimes(1)

        const moveToFreeSlot = within(table).getByRole('button', { name: 'Move selected cell here: Root row, Child column' })
        expect(moveToFreeSlot).toBeDisabled()
        await user.keyboard('{Enter}')
        expect(onMoveSelectedToSlot).not.toHaveBeenCalled()

        rerender(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                hierarchyRows={[[cells[0]], [cells[1]]]}
                positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
                matrixCells={cells}
                visibleMatrixCells={cells}
                matrixRows={[]}
                materialCountByCellId={new Map()}
                matrixCellIds={cells.map((item) => item.id)}
                selectedCell={cells[0]}
                matrixDropState={EMPTY_TEST_DROP_STATE}
                matrixDragPreview={null}
                matrixMutationsDisabled={false}
                isSavingCell={false}
                isMovingCell={false}
                matrixRowsError={null}
                saveCellError={null}
                moveCellError={null}
                canEditContent
                canDeleteContent
                cellMenuAnchor={null}
                menuCell={undefined}
                menuMoves={[]}
                isDeletingCell={false}
                sensors={[]}
                onChangeMatrixView={vi.fn()}
                onOpenCellDialog={vi.fn()}
                onAddTableRow={onAddTableRow}
                onAddTableColumn={onAddTableColumn}
                onMoveSelectedToSlot={onMoveSelectedToSlot}
                onSelectCell={vi.fn()}
                onOpenCellMenu={vi.fn()}
                onCloseCellMenu={vi.fn()}
                onRequestDeleteCell={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragOver={vi.fn()}
                onDragCancel={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        const enabledMoveToFreeSlot = within(table).getByRole('button', { name: 'Move selected cell here: Root row, Child column' })
        expect(enabledMoveToFreeSlot).toBeEnabled()
        await act(async () => {
            enabledMoveToFreeSlot.focus()
        })
        expect(enabledMoveToFreeSlot).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(onMoveSelectedToSlot).toHaveBeenCalledWith({
            rowKey: 'root-row',
            rowLabel: 'Root row',
            rowLabelValue: 'root row',
            colKey: 'child-column',
            colLabel: 'Child column',
            colLabelValue: 'child column'
        })
    })

    it('disables table axis actions when an independent matrix has no anchor cell', () => {
        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='independentRows'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows']}
                hierarchyRows={[]}
                positionLabels={new Map()}
                matrixCells={[]}
                visibleMatrixCells={[]}
                matrixRows={[]}
                materialCountByCellId={new Map()}
                matrixCellIds={[]}
                selectedCell={undefined}
                matrixDropState={EMPTY_TEST_DROP_STATE}
                matrixDragPreview={null}
                matrixMutationsDisabled={false}
                matrixAxisActionsDisabled={false}
                addCellDisabled={false}
                isSavingCell={false}
                isMovingCell={false}
                matrixRowsError={null}
                saveCellError={null}
                moveCellError={null}
                canEditContent
                canDeleteContent
                cellMenuAnchor={null}
                menuCell={undefined}
                menuMoves={[]}
                isDeletingCell={false}
                sensors={[]}
                onChangeMatrixView={vi.fn()}
                onOpenCellDialog={vi.fn()}
                onAddTableRow={vi.fn()}
                onAddTableColumn={vi.fn()}
                onMoveSelectedToSlot={vi.fn()}
                onSelectCell={vi.fn()}
                onOpenCellMenu={vi.fn()}
                onCloseCellMenu={vi.fn()}
                onRequestDeleteCell={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragOver={vi.fn()}
                onDragCancel={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
        const table = screen.getByRole('table', { name: 'Matrix table' })
        expect(within(table).queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Add column' })).toBeDisabled()
    })
})

const EMPTY_TEST_DROP_STATE: MatrixDropState = {
    activeCellId: null,
    overCellId: null,
    placement: null,
    isValid: false,
    destination: null
}
