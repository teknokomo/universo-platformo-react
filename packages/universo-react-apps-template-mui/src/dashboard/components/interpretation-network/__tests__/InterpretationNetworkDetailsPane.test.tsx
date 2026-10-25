import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { InterpretationNetworkDetailsPane, type InterpretationNetworkDetailsPaneProps } from '../InterpretationNetworkDetailsPane'
import type { MatrixCell } from '../model'

const translate = ((key: string, options?: unknown) => {
    if (typeof options === 'string') return options
    if (options && typeof options === 'object') {
        const values = options as { defaultValue?: string; title?: string }
        return values.defaultValue?.replace('{{title}}', values.title ?? '') ?? key
    }
    return key
}) as unknown as TFunction<'interpretationNetwork'>

const selectedCell: MatrixCell = {
    id: 'cell-1',
    rawRowId: 'matrix-row-1',
    sortOrder: 0,
    parentCellId: null,
    depth: 0,
    rowKey: 'row-1',
    rowLabel: 'Definition',
    colKey: 'column-1',
    colLabel: 'Meaning',
    title: 'Definition, Meaning',
    description: '',
    materialRef: 'material-primary',
    style: {
        fill: null,
        text: null,
        borderTop: '1px solid transparent',
        borderRight: '1px solid transparent',
        borderBottom: '1px solid transparent',
        borderLeft: '1px solid transparent'
    }
}

const materialSummaries = [
    {
        id: 'material-primary',
        row: { id: 'material-primary', Title: 'Primary note' },
        title: 'Primary note',
        description: 'Primary description',
        body: '',
        isPrimary: true
    },
    {
        id: 'material-secondary',
        row: { id: 'material-secondary', Title: 'Secondary note' },
        title: 'Secondary note',
        description: 'Secondary description',
        body: '',
        isPrimary: false
    }
]

const makeProps = (overrides: Partial<InterpretationNetworkDetailsPaneProps> = {}): InterpretationNetworkDetailsPaneProps => ({
    t: translate,
    locale: 'en',
    selectedCell,
    selectedMaterial: undefined,
    materialSummaries,
    materialTitle: '',
    selectedMaterialId: null,
    materialBodyField: undefined,
    materialBodyValue: undefined,
    primaryMaterialId: 'material-primary',
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    isSavingMaterial: false,
    isUpdatingPrimary: false,
    isDeletingMaterial: false,
    materialEditorError: null,
    primaryActionError: null,
    deleteMaterialError: null,
    onOpenCreateMaterial: vi.fn(),
    onOpenEditMaterial: vi.fn(),
    onSelectMaterial: vi.fn(),
    onCloseMaterial: vi.fn(),
    onSetPrimaryMaterial: vi.fn(),
    onClearPrimaryMaterial: vi.fn(),
    onDeleteMaterial: vi.fn(async () => undefined),
    onSaveMaterialBody: vi.fn(async () => undefined),
    ...overrides
})

describe('InterpretationNetworkDetailsPane', () => {
    it('shows a loading status instead of a false empty-material state', () => {
        render(<InterpretationNetworkDetailsPane {...makeProps({ isLoadingMaterialAssociations: true })} />)

        expect(screen.getByRole('status')).toHaveTextContent('Loading materials…')
        expect(screen.queryByText('The selected cell has no attached material yet.')).not.toBeInTheDocument()
    })

    it('marks the Primary Material and offers set, replace, and clear actions only to editors', async () => {
        const user = userEvent.setup()
        const onSetPrimaryMaterial = vi.fn()
        const onClearPrimaryMaterial = vi.fn()
        const props = makeProps({ onSetPrimaryMaterial, onClearPrimaryMaterial })
        const { rerender } = render(<InterpretationNetworkDetailsPane {...props} />)
        const table = screen.getByTestId('interpretation-network-material-table')

        expect(within(table).getByText('Primary Material')).toBeInTheDocument()
        await user.click(within(table).getByRole('button', { name: 'Material actions: Secondary note' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Replace Primary Material' }))
        expect(onSetPrimaryMaterial).toHaveBeenCalledWith('material-secondary')

        await user.click(within(table).getByRole('button', { name: 'Material actions: Primary note' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Clear Primary Material' }))
        expect(onClearPrimaryMaterial).toHaveBeenCalledOnce()

        await user.click(screen.getByRole('button', { name: 'Card view' }))
        const cards = screen.getByTestId('interpretation-network-material-cards')
        expect(within(cards).getByText('Primary Material')).toBeInTheDocument()
        rerender(<InterpretationNetworkDetailsPane {...props} canEditContent={false} />)
        expect(screen.queryByRole('button', { name: 'Material actions: Primary note' })).not.toBeInTheDocument()
        expect(screen.getByText('Primary Material')).toBeInTheDocument()
    }, 15_000)

    it('shows the selected material description in the read-only detail view and preserves line breaks', () => {
        const description = 'Primary description\nSecond detail line'
        render(
            <InterpretationNetworkDetailsPane
                {...makeProps({
                    selectedMaterial: { id: 'material-primary', Title: 'Primary note' },
                    selectedMaterialId: 'material-primary',
                    materialTitle: 'Primary note',
                    materialSummaries: materialSummaries.map((material) =>
                        material.id === 'material-primary' ? { ...material, description } : material
                    ),
                    canCreateContent: false,
                    canEditContent: false,
                    canDeleteContent: false
                })}
            />
        )

        const materialDescription = screen.getByTestId('interpretation-network-material-description')
        expect(materialDescription.textContent).toBe(description)
        expect(materialDescription).toHaveStyle({ whiteSpace: 'pre-wrap' })
        expect(screen.queryByRole('button', { name: 'Delete material' })).not.toBeInTheDocument()
    })

    it('restores focus to the material trigger after returning from details', async () => {
        const user = userEvent.setup()
        const onSelectMaterial = vi.fn()
        const onCloseMaterial = vi.fn()
        const props = makeProps({ onSelectMaterial, onCloseMaterial })
        const { rerender } = render(<InterpretationNetworkDetailsPane {...props} />)

        const materialButton = screen.getByRole('button', { name: 'Secondary note' })
        await user.click(materialButton)
        expect(onSelectMaterial).toHaveBeenCalledWith('material-secondary')

        rerender(
            <InterpretationNetworkDetailsPane
                {...props}
                selectedMaterial={{ id: 'material-secondary', Title: 'Secondary note' }}
                selectedMaterialId='material-secondary'
                materialTitle='Secondary note'
            />
        )
        await user.click(screen.getByRole('button', { name: 'Back to materials' }))
        expect(onCloseMaterial).toHaveBeenCalledOnce()

        rerender(<InterpretationNetworkDetailsPane {...props} selectedMaterialId='material-secondary' />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Secondary note' })).toHaveFocus())
    }, 15_000)

    it('returns to the materials list and focuses it after deleting the Primary Material', async () => {
        const user = userEvent.setup()
        const onDeleteMaterial = vi.fn(async () => undefined)
        const props = makeProps({
            selectedMaterial: { id: 'material-primary', Title: 'Primary note' },
            selectedMaterialId: 'material-primary',
            materialTitle: 'Primary note',
            onDeleteMaterial
        })
        const { rerender } = render(<InterpretationNetworkDetailsPane {...props} />)

        await user.click(screen.getByRole('button', { name: 'Delete material' }))
        const confirmation = await screen.findByRole('dialog', { name: 'Delete material?' })
        expect(confirmation).toHaveTextContent('If this is the Primary Material, the cell will return to the materials list.')
        await user.click(within(confirmation).getByTestId('confirm-delete-confirm'))
        await waitFor(() => expect(onDeleteMaterial).toHaveBeenCalledWith('material-primary'))

        const listProps = makeProps({
            selectedCell: { ...selectedCell, materialRef: null },
            materialSummaries: materialSummaries.filter((material) => material.id !== 'material-primary'),
            primaryMaterialId: null,
            selectedMaterialId: null
        })
        rerender(<InterpretationNetworkDetailsPane {...listProps} />)
        expect(screen.queryByRole('dialog', { name: 'Delete material?' })).not.toBeInTheDocument()
        const materialsRegion = screen.getByRole('region', { name: 'Materials' })
        await waitFor(() => expect(materialsRegion).toHaveFocus())
        expect(screen.getByText('Materials')).toBeInTheDocument()
        expect(screen.queryByText('material-primary')).not.toBeInTheDocument()

        rerender(
            <InterpretationNetworkDetailsPane
                {...makeProps({
                    selectedMaterial: { id: 'material-secondary', Title: 'Secondary note' },
                    selectedMaterialId: 'material-secondary',
                    materialTitle: 'Secondary note'
                })}
            />
        )
        expect(screen.queryByRole('dialog', { name: 'Delete material?' })).not.toBeInTheDocument()
    })
})
