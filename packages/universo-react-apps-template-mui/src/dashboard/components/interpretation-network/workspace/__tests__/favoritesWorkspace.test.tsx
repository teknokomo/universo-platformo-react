import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { MatrixCell } from '../../model'
import { buildHierarchicalMatrixTableModel } from '../../model'
import {
    InterpretationNetworkFavoritesContext,
    type InterpretationNetworkFavoritesContextValue
} from '../InterpretationNetworkFavoritesContext'
import { MatrixWorkspace, type MatrixWorkspaceProps } from '../MatrixWorkspace'
import type { InterpretationNetworkFavoriteListItem } from '../runtimeInterpretationNetworkFavoritesApi'

const t = ((key: string, options?: unknown, fallback?: string) => {
    if (typeof options === 'string') return options
    if (options && typeof options === 'object' && 'defaultValue' in options) {
        return String((options as { defaultValue?: unknown }).defaultValue ?? key)
    }
    return fallback ?? key
}) as TFunction<'interpretationNetwork'>

const testCell: MatrixCell = {
    id: 'cell-1',
    rawRowId: 'row-1',
    parentCellId: null,
    sortOrder: 0,
    depth: 0,
    rowKey: 'row-1',
    rowLabel: 'Meaning',
    rowLabelValue: 'Meaning',
    colKey: 'column-1',
    colLabel: 'Concept',
    colLabelValue: 'Concept',
    title: 'Universe',
    description: '',
    materialRef: null,
    style: {
        fill: null,
        text: null,
        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.12)'
    }
}

const createFavoritesContext = (
    overrides: Partial<InterpretationNetworkFavoritesContextValue> = {}
): InterpretationNetworkFavoritesContextValue => ({
    items: [],
    enabled: true,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    loadMore: vi.fn(),
    isMutationPending: false,
    feedback: null,
    clearFeedback: vi.fn(),
    isFavorite: vi.fn(() => false),
    toggleFavorite: vi.fn(async () => undefined),
    removeFavorite: vi.fn(async () => undefined),
    selectedInterpretationId: 'interpretation-1',
    localeText: {},
    onNavigateFavorite: vi.fn(),
    ...overrides
})

const createWorkspaceProps = (cellMenuAnchor: HTMLElement | null = null): MatrixWorkspaceProps => ({
    t,
    locale: 'en',
    matrixMode: 'hierarchicalCells',
    matrixView: 'table',
    allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
    tableProjection: 'hierarchicalPath',
    toolbarLayout: 'horizontal',
    showHierarchicalTableHeaders: false,
    showHierarchicalTableHeaderCard: true,
    colorBreadcrumbsByCell: true,
    hierarchyRows: [[testCell]],
    hierarchicalTableModel: buildHierarchicalMatrixTableModel({
        cells: [testCell],
        focusedCellId: testCell.id,
        breadcrumbDepth: { mode: 'full' }
    }),
    positionLabels: new Map([[testCell.id, '1']]),
    matrixCells: [testCell],
    visibleMatrixCells: [testCell],
    matrixRows: [],
    materialCountByCellId: new Map(),
    matrixCellIds: [testCell.id],
    selectedCell: testCell,
    matrixDropState: { activeCellId: null, overCellId: null, placement: null, isValid: false, destination: null },
    matrixDragPreview: null,
    matrixMutationsDisabled: false,
    isSavingCell: false,
    isMovingCell: false,
    matrixRowsError: null,
    saveCellError: null,
    moveCellError: null,
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    cellMenuAnchor,
    menuCell: cellMenuAnchor ? testCell : undefined,
    menuMoves: [],
    isDeletingCell: false,
    sensors: [],
    onChangeMatrixView: vi.fn(),
    onOpenCellDialog: vi.fn(),
    onAddTableRow: vi.fn(),
    onAddTableColumn: vi.fn(),
    onMoveSelectedToSlot: vi.fn(),
    onSelectCell: vi.fn(),
    onOpenCellMenu: vi.fn(),
    onCloseCellMenu: vi.fn(),
    onRequestDeleteCell: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragOver: vi.fn(),
    onDragCancel: vi.fn(),
    onDragEnd: vi.fn()
})

const renderWorkspace = (
    favorites: InterpretationNetworkFavoritesContextValue,
    cellMenuAnchor: HTMLElement | null = null,
    templatePanel?: ReactNode
) =>
    render(
        <InterpretationNetworkFavoritesContext.Provider value={favorites}>
            <MatrixWorkspace {...createWorkspaceProps(cellMenuAnchor)} templatePanel={templatePanel} />
        </InterpretationNetworkFavoritesContext.Provider>
    )

describe('Interpretation Network Favorites workspace', () => {
    it('keeps Matrix, Favorites, and Templates as peer tabs in one accessible row', async () => {
        const user = userEvent.setup()
        renderWorkspace(createFavoritesContext(), null, <div>Saved templates panel</div>)

        const tabList = screen.getByRole('tablist', { name: 'Workspace sections' })
        expect(
            within(tabList)
                .getAllByRole('tab')
                .map((tab) => tab.textContent)
        ).toEqual(['Matrix', 'Favorites', 'Templates'])
        await user.click(within(tabList).getByRole('tab', { name: 'Favorites' }))

        expect(screen.getByRole('tabpanel', { name: 'Favorites' })).toBeVisible()
        expect(screen.getByText('No favorites yet.')).toBeInTheDocument()
        const matrixTab = screen.getByRole('tab', { name: 'Matrix' })
        expect(document.getElementById(matrixTab.getAttribute('aria-controls') ?? '')).not.toBeVisible()

        await user.click(within(tabList).getByRole('tab', { name: 'Templates' }))
        expect(screen.getByRole('tabpanel', { name: 'Templates' })).toBeVisible()
        expect(screen.getByText('Saved templates panel')).toBeInTheDocument()
    })

    it('adds or removes the selected cell through the matrix cell menu', async () => {
        const user = userEvent.setup()
        const anchor = document.createElement('button')
        document.body.appendChild(anchor)
        const isFavorite = vi.fn(() => false)
        const favorites = createFavoritesContext({ isFavorite })

        let workspace = renderWorkspace(favorites, anchor)
        await user.click(screen.getByRole('menuitem', { name: 'Add to favorites' }))
        expect(favorites.toggleFavorite).toHaveBeenCalledWith({ interpretationId: 'interpretation-1', cellId: 'cell-1' })

        workspace.unmount()
        isFavorite.mockReturnValue(true)
        workspace = renderWorkspace(favorites, anchor)
        await user.click(screen.getByRole('menuitem', { name: 'Remove from favorites' }))
        expect(favorites.toggleFavorite).toHaveBeenCalledTimes(2)
        expect(favorites.toggleFavorite).toHaveBeenLastCalledWith({ interpretationId: 'interpretation-1', cellId: 'cell-1' })

        workspace.unmount()
        anchor.remove()
    })

    it('opens an available favorite, calls its navigation action, and returns to the Matrix tab', async () => {
        const user = userEvent.setup()
        const favorite: Extract<InterpretationNetworkFavoriteListItem, { availability: 'available' }> = {
            favoriteId: '019f7f10-0000-7000-8000-000000000101',
            target: {
                interpretationId: '019f7f10-0000-7000-8000-000000000102',
                cellId: '019f7f10-0000-7000-8000-000000000103'
            },
            structureId: '019f7f10-0000-7000-8000-000000000104',
            availability: 'available',
            structureName: 'City structure',
            interpretationTitle: 'Cultural history',
            cellPath: [
                { label: 'City structure', rowLabel: null, columnLabel: null, cellValue: null },
                { label: 'Suzdal', rowLabel: 'Places', columnLabel: 'History', cellValue: 'Suzdal' }
            ],
            addedAt: '2026-10-23T09:00:00.000Z'
        }
        const onNavigateFavorite = vi.fn()
        renderWorkspace(createFavoritesContext({ items: [favorite], onNavigateFavorite }))

        const favoritesTab = screen.getByRole('tab', { name: 'Favorites' })
        await user.click(favoritesTab)
        const matrixTab = screen.getByRole('tab', { name: 'Matrix' })
        expect(matrixTab).toHaveAttribute('aria-selected', 'false')
        await user.click(screen.getByRole('button', { name: 'Open {{location}}' }))

        expect(onNavigateFavorite).toHaveBeenCalledWith(favorite)
        expect(matrixTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tabpanel', { name: 'Matrix' })).toBeVisible()
    })

    it('lets the user remove an unavailable favorite without rendering its identity', async () => {
        const user = userEvent.setup()
        const favoriteId = '019f7f10-0000-7000-8000-000000000099'
        const staleFavorite: InterpretationNetworkFavoriteListItem = {
            favoriteId,
            target: null,
            structureId: null,
            availability: 'unavailable',
            structureName: null,
            interpretationTitle: null,
            cellPath: [],
            addedAt: null
        }
        const favorites = createFavoritesContext({ items: [staleFavorite] })
        renderWorkspace(favorites)

        await user.click(screen.getByRole('tab', { name: 'Favorites' }))
        const removeButton = await screen.findByRole('button', { name: 'Remove unavailable favorite' })
        expect(screen.getByText('Unavailable')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(favoriteId)

        await user.click(removeButton)
        await waitFor(() => expect(favorites.removeFavorite).toHaveBeenCalledWith(favoriteId))
    })
})
