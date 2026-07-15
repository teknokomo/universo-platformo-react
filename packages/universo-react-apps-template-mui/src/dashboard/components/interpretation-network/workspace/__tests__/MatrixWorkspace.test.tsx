import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createLocalizedContent } from '@universo-react/utils'
import type { ComponentProps, ReactElement } from 'react'
import { buildHierarchicalMatrixTableModel, type MatrixCell } from '../../model'
import type { MatrixDragPreview, MatrixDropState } from '../../matrixDrag'
import { CellEditDialog } from '../../CellEditDialog'
import { WorkspaceShell } from '../WorkspaceShell'
import { WorkspaceDialogs } from '../WorkspaceDialogs'
import { MatrixWorkspace } from '../MatrixWorkspace'
import { getBreadcrumbSx } from '../HierarchicalMatrixTableView'

const t = ((key: string, options?: unknown, fallback?: string) => {
    const pluralDefault =
        options && typeof options === 'object' && 'count' in options
            ? Number((options as { count?: unknown }).count) === 1 && 'defaultValue_one' in options
                ? (options as { defaultValue_one?: unknown }).defaultValue_one
                : 'defaultValue_other' in options
                ? (options as { defaultValue_other?: unknown }).defaultValue_other
                : undefined
            : undefined
    const template =
        typeof options === 'string'
            ? options
            : pluralDefault
            ? String(pluralDefault)
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
        text: null,
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

const renderWithQueryClient = (ui: ReactElement) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const renderHierarchicalPathWorkspace = ({
    cells,
    focusedCellId,
    selectedCell,
    materialCountByCellId = new Map(),
    onSelectCell = vi.fn(),
    breadcrumbDepth = { mode: 'full' as const },
    showHierarchicalTableHeaders = false,
    showHierarchicalTableHeaderCard = true,
    showMatrixTreeTotalCells = true,
    colorBreadcrumbsByCell = true
}: {
    cells: MatrixCell[]
    focusedCellId: string
    selectedCell?: MatrixCell
    materialCountByCellId?: Map<string, number>
    onSelectCell?: (cellId: string) => void
    breadcrumbDepth?: Parameters<typeof buildHierarchicalMatrixTableModel>[0]['breadcrumbDepth']
    showHierarchicalTableHeaders?: boolean
    showHierarchicalTableHeaderCard?: boolean
    showMatrixTreeTotalCells?: boolean
    colorBreadcrumbsByCell?: boolean
}) =>
    render(
        <MatrixWorkspace
            t={t}
            locale='en'
            matrixMode='hierarchicalCells'
            matrixView='table'
            allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
            tableProjection='hierarchicalPath'
            toolbarLayout='horizontal'
            showHierarchicalTableHeaders={showHierarchicalTableHeaders}
            showHierarchicalTableHeaderCard={showHierarchicalTableHeaderCard}
            showMatrixTreeTotalCells={showMatrixTreeTotalCells}
            colorBreadcrumbsByCell={colorBreadcrumbsByCell}
            hierarchyRows={[]}
            hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId,
                breadcrumbDepth
            })}
            positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
            matrixCells={cells}
            visibleMatrixCells={cells}
            matrixRows={[]}
            materialCountByCellId={materialCountByCellId}
            matrixCellIds={cells.map((item) => item.id)}
            selectedCell={selectedCell}
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
            onAddTableRow={vi.fn()}
            onAddTableColumn={vi.fn()}
            onMoveSelectedToSlot={vi.fn()}
            onSelectCell={onSelectCell}
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

describe('MatrixWorkspace', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('hides system-managed row and column placement in the default hierarchical add dialog', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [
                        { code: 'en', label: 'English', isDefault: true },
                        { code: 'ru', label: 'Russian', isDefault: false }
                    ]
                })
            })
        )

        renderWithQueryClient(
            <WorkspaceDialogs
                t={t}
                locale='en'
                structureDialogMode={null}
                structureFields={[]}
                structureInitialData={{}}
                isCreatingStructure={false}
                isUpdatingStructure={false}
                structureDialogError={null}
                onCloseStructureDialog={vi.fn()}
                onSubmitStructure={vi.fn()}
                structureDeleteId={null}
                deleteStructure={undefined}
                isDeletingStructure={false}
                structureDeleteError={null}
                onCancelDeleteStructure={vi.fn()}
                onConfirmDeleteStructure={vi.fn()}
                materialDialogMode={null}
                materialFields={[]}
                materialInitialData={{}}
                isSavingMaterialMetadata={false}
                materialDialogError={null}
                onCloseMaterialDialog={vi.fn()}
                onSubmitMaterial={vi.fn()}
                cellDialogMode='create-child'
                axisDialogKind={null}
                cellMetadataFields={[
                    { id: 'RowLabel', codename: 'RowLabel', label: 'Row label', type: 'STRING' },
                    { id: 'ColLabel', codename: 'ColLabel', label: 'Column label', type: 'STRING' },
                    { id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' },
                    { id: 'CellDescription', codename: 'CellDescription', label: 'Description', type: 'STRING' }
                ]}
                styleFields={[]}
                cellDialogInitialData={{
                    RowLabel: createLocalizedContent('en', ''),
                    ColLabel: createLocalizedContent('en', ''),
                    CellValue: createLocalizedContent('en', ''),
                    CellDescription: createLocalizedContent('en', '')
                }}
                matrixAxisOptions={{ rows: [], columns: [] }}
                cellDialogPlacement={{
                    row: { kind: 'new', label: '' },
                    column: { kind: 'new', label: '' },
                    parentCellId: 'root'
                }}
                allowNewAxesInCellDialog={false}
                hideAxisLabelFields={true}
                isSavingCell={false}
                cellDialogError={null}
                onCloseCellDialog={vi.fn()}
                onSubmitCell={vi.fn()}
                onCloseAxisDialog={vi.fn()}
                onSubmitAxis={vi.fn()}
                cellDeleteId={null}
                deleteCell={undefined}
                isDeletingCell={false}
                cellDeleteError={null}
                onCancelDeleteCell={vi.fn()}
                onConfirmDeleteCell={vi.fn()}
            />
        )

        expect(screen.getByRole('dialog', { name: 'Add cell' })).toBeInTheDocument()
        expect(await screen.findByRole('textbox', { name: /Title/ })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: /Description/ })).toBeInTheDocument()
        expect(screen.queryByText('Created automatically for the new cell.')).not.toBeInTheDocument()
        expect(screen.queryByText('Placement')).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: /Row label/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: /Column label/ })).not.toBeInTheDocument()
    })

    it('submits hidden system-managed placement when row and column placement are omitted by the caller', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [
                        { code: 'en', label: 'English', isDefault: true },
                        { code: 'ru', label: 'Russian', isDefault: false }
                    ]
                })
            })
        )
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        renderWithQueryClient(
            <CellEditDialog
                open
                mode='create'
                t={t}
                locale='en'
                fields={[
                    { id: 'RowLabel', codename: 'RowLabel', label: 'Row label', type: 'STRING' },
                    { id: 'ColLabel', codename: 'ColLabel', label: 'Column label', type: 'STRING' },
                    { id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' },
                    { id: 'CellDescription', codename: 'CellDescription', label: 'Description', type: 'STRING' }
                ]}
                styleFields={[]}
                initialData={{
                    RowLabel: createLocalizedContent('en', ''),
                    ColLabel: createLocalizedContent('en', ''),
                    CellValue: createLocalizedContent('en', ''),
                    CellDescription: createLocalizedContent('en', '')
                }}
                axisOptions={{ rows: [], columns: [] }}
                hidePlacementFields
                allowNewAxes={false}
                isSubmitting={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByText('Placement')).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /Row label/ })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /Column label/ })).not.toBeInTheDocument()

        fireEvent.change(within(dialog).getByRole('textbox', { name: /Title/ }), {
            target: { value: 'Child without placement fields' }
        })
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        expect(onSubmit.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                __matrixCellPlacement: {
                    row: { kind: 'new' },
                    column: { kind: 'new' },
                    parentCellId: null
                }
            })
        )
    })

    it('hides system-derived row and column labels while editing hierarchical path cells', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [{ code: 'en', label: 'English', isDefault: true }]
                })
            })
        )

        const baseProps = {
            open: true,
            mode: 'edit' as const,
            t,
            locale: 'en',
            fields: [
                { id: 'RowLabel', codename: 'RowLabel', label: 'Row label', type: 'STRING' as const },
                { id: 'ColLabel', codename: 'ColLabel', label: 'Column label', type: 'STRING' as const },
                { id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' as const },
                { id: 'CellDescription', codename: 'CellDescription', label: 'Description', type: 'STRING' as const }
            ],
            styleFields: [],
            initialData: {
                RowLabel: createLocalizedContent('en', 'System row'),
                ColLabel: createLocalizedContent('en', 'System column'),
                CellValue: createLocalizedContent('en', 'Meaning'),
                CellDescription: createLocalizedContent('en', '')
            },
            isSubmitting: false,
            onClose: vi.fn(),
            onSubmit: vi.fn().mockResolvedValue(undefined)
        }

        const { rerender } = renderWithQueryClient(<CellEditDialog {...baseProps} hideAxisLabelFields />)
        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })

        expect(within(dialog).queryByRole('textbox', { name: /Row label/ })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /Column label/ })).not.toBeInTheDocument()
        expect(within(dialog).getByRole('textbox', { name: /Title/ })).toHaveValue('Meaning')

        rerender(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
                <CellEditDialog {...baseProps} hideAxisLabelFields={false} />
            </QueryClientProvider>
        )

        expect(await screen.findByRole('textbox', { name: /Row label/ })).toHaveValue('System row')
        expect(screen.getByRole('textbox', { name: /Column label/ })).toHaveValue('System column')
    })

    it('saves edited hierarchical path cells when hidden row and column labels are empty', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [{ code: 'en', label: 'English', isDefault: true }]
                })
            })
        )
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        renderWithQueryClient(
            <CellEditDialog
                open
                mode='edit'
                t={t}
                locale='en'
                fields={[
                    { id: 'RowLabel', codename: 'RowLabel', label: 'Row label', type: 'STRING' },
                    { id: 'ColLabel', codename: 'ColLabel', label: 'Column label', type: 'STRING' },
                    { id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' },
                    { id: 'CellDescription', codename: 'CellDescription', label: 'Description', type: 'STRING' }
                ]}
                styleFields={[]}
                initialData={{
                    RowLabel: createLocalizedContent('en', ''),
                    ColLabel: createLocalizedContent('en', ''),
                    CellValue: createLocalizedContent('en', 'Meaning'),
                    CellDescription: createLocalizedContent('en', '')
                }}
                hideAxisLabelFields
                isSubmitting={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })

        expect(within(dialog).queryByRole('textbox', { name: /Row label/ })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /Column label/ })).not.toBeInTheDocument()

        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
            RowLabel: expect.any(Object),
            ColLabel: expect.any(Object),
            CellValue: expect.any(Object)
        })
    })

    it('shows a visible style contrast warning and still saves the authored colours', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [{ code: 'en', label: 'English', isDefault: true }]
                })
            })
        )
        const user = userEvent.setup()
        const onSubmit = vi.fn().mockResolvedValue(undefined)

        renderWithQueryClient(
            <CellEditDialog
                open
                mode='edit'
                t={t}
                locale='en'
                fields={[{ id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' }]}
                styleFields={[
                    { id: 'TextColor', codename: 'TextColor', label: 'Text color', type: 'STRING', validationRules: { format: 'hexColor' } }
                ]}
                initialData={{ CellValue: createLocalizedContent('en', 'Meaning'), TextColor: null }}
                isSubmitting={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />
        )

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        await user.click(within(dialog).getByRole('tab', { name: 'Style' }))
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Hex color/ }), { target: { value: '#FFFFFF' } })
        expect(await within(dialog).findByRole('status')).toHaveTextContent(
            'This text and fill combination may be difficult to read. You can still save it.'
        )
        expect(within(dialog).getByRole('textbox', { name: /Hex color/ })).toHaveAttribute('aria-invalid', 'false')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    })

    it('places the white preset immediately after black for every colour control', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [{ code: 'en', label: 'English', isDefault: true }]
                })
            })
        )

        renderWithQueryClient(
            <CellEditDialog
                open
                mode='edit'
                t={t}
                locale='en'
                fields={[{ id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' }]}
                styleFields={[
                    { id: 'CellFillColor', codename: 'CellFillColor', label: 'Fill', type: 'STRING' },
                    { id: 'TextColor', codename: 'TextColor', label: 'Text color', type: 'STRING' },
                    { id: 'BorderTopColor', codename: 'BorderTopColor', label: 'Border', type: 'STRING' }
                ]}
                initialData={{ CellValue: createLocalizedContent('en', 'Meaning') }}
                isSubmitting={false}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />
        )

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        await userEvent.click(within(dialog).getByRole('tab', { name: 'Style' }))
        const groups = within(dialog).getAllByRole('group', { name: /preset colors/i })
        expect(groups).toHaveLength(3)
        for (const group of groups) {
            const presets = within(group).getAllByRole('button')
            expect(presets[0]).toHaveAccessibleName('black')
            expect(presets[1]).toHaveAccessibleName('white')
        }
    })

    it('resets grouped border editing state when opening a different cell', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [{ code: 'en', label: 'English', isDefault: true }]
                })
            })
        )
        const styleFields = [
            { id: 'BorderTopColor', codename: 'BorderTopColor', label: 'Top border color', type: 'STRING' as const },
            { id: 'BorderRightColor', codename: 'BorderRightColor', label: 'Right border color', type: 'STRING' as const },
            { id: 'BorderBottomColor', codename: 'BorderBottomColor', label: 'Bottom border color', type: 'STRING' as const },
            { id: 'BorderLeftColor', codename: 'BorderLeftColor', label: 'Left border color', type: 'STRING' as const }
        ]
        const baseProps = {
            open: true,
            mode: 'edit' as const,
            t,
            locale: 'en',
            fields: [{ id: 'CellValue', codename: 'CellValue', label: 'Title', type: 'STRING' as const }],
            styleFields,
            initialData: {
                CellValue: createLocalizedContent('en', 'Uniform cell'),
                BorderTopColor: '#000000',
                BorderRightColor: '#000000',
                BorderBottomColor: '#000000',
                BorderLeftColor: '#000000'
            },
            isSubmitting: false,
            onClose: vi.fn(),
            onSubmit: vi.fn().mockResolvedValue(undefined)
        }

        const { rerender } = renderWithQueryClient(<CellEditDialog {...baseProps} />)
        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        await userEvent.click(within(dialog).getByRole('tab', { name: 'Style' }))
        const editSidesButton = within(dialog).getByRole('button', { name: 'Edit sides separately' })
        expect(editSidesButton).toBeInTheDocument()

        // Explicitly enter advanced mode, then make every side equal. The editor
        // must keep the user's chosen mode instead of collapsing mid-edit.
        await userEvent.click(editSidesButton)
        expect(within(dialog).getByRole('button', { name: 'Edit all sides together' })).toBeInTheDocument()
        const rightBorderHex = document.getElementById('BorderRightColor-hex')
        expect(rightBorderHex).toBeInstanceOf(HTMLInputElement)
        await userEvent.clear(rightBorderHex as HTMLInputElement)
        await userEvent.type(rightBorderHex as HTMLInputElement, '#000000')
        fireEvent.blur(rightBorderHex as HTMLInputElement)
        expect(within(dialog).getByRole('button', { name: 'Edit all sides together' })).toBeInTheDocument()

        rerender(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
                <CellEditDialog
                    {...baseProps}
                    initialData={{
                        CellValue: createLocalizedContent('en', 'Split border cell'),
                        BorderTopColor: '#000000',
                        BorderRightColor: '#E53935',
                        BorderBottomColor: '#000000',
                        BorderLeftColor: '#000000'
                    }}
                />
            </QueryClientProvider>
        )
        await userEvent.click(within(dialog).getByRole('tab', { name: 'Style' }))

        expect(await within(dialog).findByRole('button', { name: 'Edit all sides together' })).toBeInTheDocument()
    })

    it('keeps the adjusted split-pane size when the selected structure row is refreshed with the same id', () => {
        const structure = {
            t,
            selectedConcept: { id: 'structure-1', Name: 'Structure one' },
            conceptColumns: [{ id: 'Name', codename: 'Name', field: 'Name' }],
            conceptNameField: 'Name',
            locale: 'en',
            structureFilter: '',
            structureViewMode: 'cards' as const,
            filteredStructures: [],
            canCreateStructure: true,
            structureFieldsReady: true,
            createStructureError: false,
            normalizedStructureFilter: '',
            matrixWorkspace: <div>Matrix</div>,
            structureMenuAnchor: null,
            structureMenuId: null,
            canEditStructure: true,
            canDeleteStructure: true,
            onFilterChange: vi.fn(),
            onViewModeChange: vi.fn(),
            onOpenCreateStructure: vi.fn(),
            onOpenStructure: vi.fn(),
            onOpenStructureMenu: vi.fn(),
            onCloseStructureMenu: vi.fn(),
            onEditStructure: vi.fn(),
            onDeleteStructure: vi.fn(),
            onBackToList: vi.fn()
        }
        const details = {
            t,
            locale: 'en',
            selectedCell: undefined,
            selectedMaterial: undefined,
            cellMaterials: [],
            selectedMaterialId: null,
            openedMaterialId: null,
            materialBodyField: undefined,
            materialBodyValue: undefined,
            canCreateContent: true,
            canEditContent: true,
            isSavingMaterial: false,
            materialEditorError: null,
            materials: [],
            materialColumns: [],
            materialTitleField: 'Title',
            saveMaterialBodyMutation: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
            actions: {
                setMaterialDialogError: vi.fn(),
                setEditingMaterialId: vi.fn(),
                setMaterialDialogMode: vi.fn(),
                setSelectedMaterialId: vi.fn(),
                setOpenedMaterialId: vi.fn()
            }
        }
        const dialogs = {
            t,
            locale: 'en',
            structure: {
                mode: null,
                fields: [],
                initialData: {},
                error: null,
                deleteId: null,
                deleteStructure: undefined,
                deleteError: null
            },
            material: { mode: null, fields: [], initialData: {}, error: null },
            cell: {
                mode: null,
                axisDialogKind: null,
                fields: [],
                styleFields: [],
                initialData: {},
                axisOptions: { rows: [], columns: [] },
                placement: null,
                allowNewAxesInCellDialog: false,
                hideAxisLabelFields: false,
                error: null,
                deleteId: null,
                deleteCell: undefined,
                deleteError: null
            },
            mutations: {
                createStructure: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
                updateStructure: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
                deleteStructure: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
                saveMaterialMetadata: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
                saveCell: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
                deleteCell: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) }
            },
            actions: {
                setStructureDialogMode: vi.fn(),
                setEditingStructureId: vi.fn(),
                setStructureDialogError: vi.fn(),
                setStructureDeleteId: vi.fn(),
                setStructureDeleteError: vi.fn(),
                setMaterialDialogMode: vi.fn(),
                setEditingMaterialId: vi.fn(),
                setMaterialDialogError: vi.fn(),
                setCellDialogMode: vi.fn(),
                setCellDialogSourceCellId: vi.fn(),
                setCellDialogPlacement: vi.fn(),
                setAxisDialogKind: vi.fn(),
                setCellDialogError: vi.fn(),
                setCellDeleteId: vi.fn(),
                setCellDeleteError: vi.fn()
            }
        }

        const { rerender } = render(<WorkspaceShell structure={structure} details={details} dialogs={dialogs} splitPaneEnabled />)

        const separator = screen.getByRole('separator', { name: 'Resize structure and details panes' })
        fireEvent.keyDown(separator, { key: 'ArrowRight' })
        expect(separator).toHaveAttribute('aria-valuenow', '55')

        rerender(
            <WorkspaceShell
                structure={{ ...structure, selectedConcept: { id: 'structure-1', Name: 'Structure one refreshed' } }}
                details={details}
                dialogs={dialogs}
                splitPaneEnabled
            />
        )

        expect(screen.getByRole('separator', { name: 'Resize structure and details panes' })).toHaveAttribute('aria-valuenow', '55')
    })

    it('renders the hierarchical path table with a header card, row cells, and ancestor breadcrumbs', async () => {
        const user = userEvent.setup()
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, rowLabel: 'Root row', colLabel: 'Root column', title: 'Universe' }),
            cell({
                id: 'parent-a',
                parentCellId: 'root',
                sortOrder: 0,
                rowLabel: 'Parent A row',
                colLabel: 'Parent A column',
                title: 'Meaning'
            }),
            cell({
                id: 'child-a',
                parentCellId: 'parent-a',
                sortOrder: 0,
                rowLabel: 'Child A row',
                colLabel: 'Child A column',
                title: 'Definition'
            }),
            cell({
                id: 'grandchild-a',
                parentCellId: 'child-a',
                sortOrder: 0,
                rowLabel: 'Grandchild A row',
                colLabel: 'Grandchild A column',
                title: 'Term'
            })
        ]
        const onSelectCell = vi.fn()

        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                tableProjection='hierarchicalPath'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                showMatrixTreeTotalCells={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], [cells[1]], [cells[2]]]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'child-a',
                    breadcrumbDepth: { mode: 'last', count: 1 }
                })}
                positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
                matrixCells={cells}
                visibleMatrixCells={[cells[0], cells[1], cells[2], cells[3]]}
                matrixRows={[]}
                materialCountByCellId={new Map([['grandchild-a', 2]])}
                matrixCellIds={cells.map((item) => item.id)}
                selectedCell={cells[2]}
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
                onAddTableRow={vi.fn()}
                onAddTableColumn={vi.fn()}
                onMoveSelectedToSlot={vi.fn()}
                onSelectCell={onSelectCell}
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

        expect(screen.getByTestId('interpretation-network-hierarchical-table')).toBeInTheDocument()
        expect(screen.getByRole('table', { name: 'Matrix table for Meaning' })).toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Current level' })).not.toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Cell' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Show hidden path' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Universe/ })).toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-cell-id', 'parent-a')
        expect(screen.getByRole('button', { name: '2, Meaning' })).toBeInTheDocument()
        expect(screen.getByRole('rowheader', { name: /Definition/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '4, Term' })).toBeInTheDocument()
        expect(screen.getByText('2 materials')).toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-tree-total-cells')).toHaveTextContent('Total 4 cells in the structure')
        expect(screen.getAllByRole('button', { name: 'Drag cell' }).every((button) => !button.hasAttribute('disabled'))).toBe(true)
        expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add column' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Universe' }))
        expect(onSelectCell).toHaveBeenCalledWith('root')
    })

    it('shows hierarchical table headers only when the setting is enabled', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'meaning', parentCellId: 'root', sortOrder: 0, title: 'Meaning' }),
            cell({ id: 'term', parentCellId: 'meaning', sortOrder: 0, title: 'Term' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'meaning',
            selectedCell: cells[1],
            showHierarchicalTableHeaders: true
        })

        const table = screen.getByRole('table', { name: 'Matrix table for Universe' })
        expect(within(table).getByRole('columnheader', { name: 'Current level' })).toBeInTheDocument()
        expect(within(table).getByRole('columnheader', { name: 'Cell' })).toBeInTheDocument()
    })

    it('renders breadcrumb items as cell-colored boxes when enabled', () => {
        const cells = [
            cell({
                id: 'root',
                parentCellId: null,
                sortOrder: 0,
                title: 'Universe',
                style: { ...cell({ id: 'x', parentCellId: null, sortOrder: 0 }).style, fill: '#fb8c00' }
            }),
            cell({ id: 'meaning', parentCellId: 'root', sortOrder: 0, title: 'Meaning' }),
            cell({ id: 'term', parentCellId: 'meaning', sortOrder: 0, title: 'Term' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'term',
            selectedCell: cells[2],
            colorBreadcrumbsByCell: true
        })

        expect(screen.getByRole('button', { name: 'Universe' })).toHaveStyle({ backgroundColor: '#fb8c00' })
        expect(screen.getByTestId('interpretation-network-breadcrumb-item')).toHaveAttribute('data-cell-colored', 'true')
    })

    it('preserves authored breadcrumb colours while applying hover and keyboard-focus effects', () => {
        const styledCell = cell({
            id: 'root',
            parentCellId: null,
            sortOrder: 0,
            title: 'Universe',
            style: { ...cell({ id: 'x', parentCellId: null, sortOrder: 0 }).style, fill: '#FB8C00', text: '#FFFFFF' }
        })
        const sx = getBreadcrumbSx(styledCell, true, false) as Record<string, unknown>

        expect(sx.backgroundColor).toBe('#FB8C00')
        expect(sx.color).toBe('#FFFFFF')
        expect(sx['&:hover']).toEqual(expect.objectContaining({ backgroundColor: '#FB8C00', color: '#FFFFFF', filter: 'brightness(1.04)' }))
        expect(sx['&:focus-visible']).toEqual(expect.objectContaining({ backgroundColor: '#FB8C00', color: '#FFFFFF' }))
    })

    it('keeps default breadcrumb text theme-coloured when cell colouring is disabled', () => {
        const cells = [
            cell({
                id: 'root',
                parentCellId: null,
                sortOrder: 0,
                title: 'Universe',
                style: {
                    ...cell({ id: 'x', parentCellId: null, sortOrder: 0 }).style,
                    fill: '#212121',
                    text: '#FFFFFF'
                }
            }),
            cell({ id: 'meaning', parentCellId: 'root', sortOrder: 0, title: 'Meaning' }),
            cell({ id: 'term', parentCellId: 'meaning', sortOrder: 0, title: 'Term' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'term',
            selectedCell: cells[2],
            colorBreadcrumbsByCell: false
        })

        expect(screen.getByRole('button', { name: 'Universe' })).toHaveStyle({ color: '#1976d2' })
    })

    it('uses a one-word Add action for hierarchical cell creation', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'meaning', parentCellId: 'root', sortOrder: 0, title: 'Meaning' })
        ]
        const onOpenCellDialog = vi.fn()

        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                tableProjection='hierarchicalPath'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], [cells[1]]]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'root',
                    breadcrumbDepth: { mode: 'full' }
                })}
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
                onOpenCellDialog={onOpenCellDialog}
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

        const addButton = screen.getByRole('button', { name: 'Add' })
        expect(addButton).toBeEnabled()
        expect(screen.queryByRole('button', { name: 'Add child cell' })).not.toBeInTheDocument()

        fireEvent.click(addButton)
        expect(onOpenCellDialog).toHaveBeenCalledWith('create-child', 'root')
    })

    it('renders the selected root with children as a header card and child row labels', () => {
        const cells = [
            cell({
                id: 'root',
                parentCellId: null,
                sortOrder: 0,
                rowLabel: 'Universe row',
                colLabel: 'Universe column',
                title: 'Universe'
            }),
            cell({ id: 'cell-1', parentCellId: 'root', sortOrder: 0, rowLabel: 'Cell 1 row', colLabel: 'Cell 1 column', title: 'Cell 1' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 1, rowLabel: 'Cell 2 row', colLabel: 'Cell 2 column', title: 'Cell 2' }),
            cell({ id: 'cell-3', parentCellId: 'root', sortOrder: 2, rowLabel: 'Cell 3 row', colLabel: 'Cell 3 column', title: 'Cell 3' }),
            cell({ id: 'cell-4', parentCellId: 'root', sortOrder: 3, rowLabel: 'Cell 4 row', colLabel: 'Cell 4 column', title: 'Cell 4' })
        ]

        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                tableProjection='hierarchicalPath'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], cells.slice(1)]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'root',
                    breadcrumbDepth: { mode: 'full' }
                })}
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

        const table = screen.getByRole('table', { name: 'Matrix table for Universe' })
        const rows = within(table).getAllByTestId('interpretation-network-table-row')
        const headerCard = screen.getByTestId('interpretation-network-table-header-card')

        expect(rows).toHaveLength(4)
        expect(headerCard).toHaveAttribute('data-cell-id', 'root')
        expect(headerCard).toHaveAttribute('data-selected-outline', 'inset')
        expect(within(table).queryByRole('rowheader', { name: /Universe/ })).not.toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: /Cell 1/ })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: /Cell 4/ })).toBeInTheDocument()
        expect(within(table).queryByTestId('interpretation-network-table-header-row')).not.toBeInTheDocument()
        expect(within(table).queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(within(table).queryByRole('button', { name: 'Add column' })).not.toBeInTheDocument()
    })

    it('renders a root-only hierarchy as one full-width cell card', () => {
        const cells = [
            cell({
                id: 'root',
                parentCellId: null,
                sortOrder: 0,
                rowLabel: 'Universe row',
                colLabel: 'Universe column',
                title: 'Universe'
            })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'root',
            selectedCell: cells[0]
        })

        expect(screen.queryByRole('table', { name: 'Matrix table for Universe' })).not.toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-cell-id', 'root')
        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-selected-outline', 'inset')
        expect(screen.getByRole('button', { name: '1, Universe' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cell actions: Universe' })).toBeEnabled()
        expect(screen.queryByRole('button', { name: 'Drag cell' })).not.toBeInTheDocument()
        expect(screen.queryByText('This cell has no child cells yet.')).not.toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-tree-total-cells')).toHaveTextContent('Total 1 cell in the structure')
    })

    it('shows the total tree-cell counter and selected inset outline outside the table view', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({
                id: 'cell-1',
                parentCellId: 'root',
                sortOrder: 0,
                title: 'Cell 1',
                style: { ...cell({ id: 'cell-1-style', parentCellId: null, sortOrder: 0 }).style, fill: '#FB8C00', text: '#FFFFFF' }
            }),
            cell({
                id: 'cell-2',
                parentCellId: 'root',
                sortOrder: 1,
                title: 'Cell 2',
                style: { ...cell({ id: 'cell-2-style', parentCellId: null, sortOrder: 0 }).style, fill: '#212121', text: '#E53935' }
            })
        ]
        const baseProps: ComponentProps<typeof MatrixWorkspace> = {
            t,
            locale: 'en',
            matrixMode: 'hierarchicalCells',
            matrixView: 'horizontalRows',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            tableProjection: 'hierarchicalPath',
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true,
            hierarchyRows: [[cells[0]], [cells[1], cells[2]]],
            hierarchicalTableModel: buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId: 'root',
                breadcrumbDepth: { mode: 'full' }
            }),
            positionLabels: new Map(cells.map((item, index) => [item.id, String(index + 1)])),
            matrixCells: cells,
            visibleMatrixCells: cells,
            matrixRows: [],
            materialCountByCellId: new Map(),
            matrixCellIds: cells.map((item) => item.id),
            selectedCell: cells[1],
            matrixDropState: EMPTY_TEST_DROP_STATE,
            matrixDragPreview: null,
            matrixMutationsDisabled: false,
            isSavingCell: false,
            isMovingCell: false,
            matrixRowsError: null,
            saveCellError: null,
            moveCellError: null,
            canEditContent: true,
            canDeleteContent: true,
            cellMenuAnchor: null,
            menuCell: undefined,
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
        }

        const { rerender } = render(<MatrixWorkspace {...baseProps} />)

        expect(screen.getByTestId('interpretation-network-tree-total-cells')).toHaveTextContent('Total 3 cells in the structure')
        expect(screen.getByRole('button', { name: /2, Cell 1/ }).closest('[data-testid="interpretation-network-cell"]')).toHaveAttribute(
            'data-selected-outline',
            'inset'
        )

        const whiteCellButton = screen.getByRole('button', { name: /2, Cell 1/ })
        expect(whiteCellButton).toHaveStyle({ color: '#FFFFFF' })
        expect(whiteCellButton.closest('[data-testid="interpretation-network-cell"]')).toHaveStyle({
            backgroundColor: '#FB8C00',
            color: '#FFFFFF'
        })

        const redCellButton = screen.getByRole('button', { name: /3, Cell 2/ })
        expect(redCellButton).toHaveStyle({ color: '#E53935' })
        expect(redCellButton.closest('[data-testid="interpretation-network-cell"]')).toHaveStyle({
            backgroundColor: '#212121',
            color: '#E53935'
        })

        rerender(<MatrixWorkspace {...baseProps} matrixView='verticalTree' showMatrixTreeTotalCells={false} />)

        expect(screen.queryByTestId('interpretation-network-tree-total-cells')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /2, Cell 1/ }).closest('[data-testid="interpretation-network-cell"]')).toHaveAttribute(
            'data-selected-outline',
            'inset'
        )
    })

    it('renders a focused root with child cells as a header card when the setting is enabled', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-1', parentCellId: 'root', sortOrder: 0, title: 'Cell 1' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 1, title: 'Cell 2' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'root',
            selectedCell: cells[0]
        })

        const table = screen.getByRole('table', { name: 'Matrix table for Universe' })

        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-cell-id', 'root')
        expect(
            within(screen.getByTestId('interpretation-network-table-header-card')).getByRole('button', { name: '1, Universe' })
        ).toBeInTheDocument()
        expect(within(table).queryByRole('rowheader', { name: /Universe/ })).not.toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: /Cell 1/ })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: /Cell 2/ })).toBeInTheDocument()
    })

    it('renders first-level focus with the root as a header card and sibling rows underneath', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-1', parentCellId: 'root', sortOrder: 0, title: 'Cell 1' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 1, title: 'Cell 2' }),
            cell({ id: 'cell-3', parentCellId: 'root', sortOrder: 2, title: 'Cell 3' }),
            cell({ id: 'cell-4', parentCellId: 'root', sortOrder: 3, title: 'Cell 4' }),
            cell({ id: 'cell-1-a', parentCellId: 'cell-1', sortOrder: 0, title: 'Cell 1 A' }),
            cell({ id: 'cell-2-a', parentCellId: 'cell-2', sortOrder: 0, title: 'Cell 2 A' }),
            cell({ id: 'cell-2-b', parentCellId: 'cell-2', sortOrder: 1, title: 'Cell 2 B' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'cell-2',
            selectedCell: cells[2]
        })

        const table = screen.getByRole('table', { name: 'Matrix table for Universe' })
        const dataRows = within(table).getAllByTestId('interpretation-network-table-row')

        expect(within(table).queryByTestId('interpretation-network-table-header-row')).not.toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-cell-id', 'root')
        expect(
            within(screen.getByTestId('interpretation-network-table-header-card')).getByRole('button', {
                name: '1, Universe'
            })
        ).toBeInTheDocument()
        expect(dataRows).toHaveLength(4)
        expect(within(dataRows[0]).getByRole('rowheader', { name: /Cell 1/ })).toBeInTheDocument()
        expect(within(dataRows[1]).getByRole('rowheader', { name: /Cell 2/ })).toBeInTheDocument()
        expect(within(dataRows[2]).getByRole('rowheader', { name: /Cell 3/ })).toBeInTheDocument()
        expect(within(dataRows[3]).getByRole('rowheader', { name: /Cell 4/ })).toBeInTheDocument()
        expect(within(dataRows[0]).getByRole('button', { name: '6, Cell 1 A' })).toBeInTheDocument()
        expect(within(dataRows[1]).getByRole('button', { name: '7, Cell 2 A' })).toBeInTheDocument()
        expect(within(dataRows[1]).getByRole('button', { name: '8, Cell 2 B' })).toBeInTheDocument()
        expect(
            within(dataRows[1])
                .getByRole('rowheader', { name: /Cell 2/ })
                .closest('th')
        ).toHaveAttribute('data-selected-outline', 'inset')
        expect(within(dataRows[0]).getByRole('button', { name: '6, Cell 1 A' }).closest('td')).toHaveAttribute('data-leading-gap', 'true')
        expect(
            within(dataRows[0])
                .getByRole('rowheader', { name: /Cell 1/ })
                .closest('th')
        ).not.toHaveAttribute('data-leading-gap')
        expect(screen.queryByRole('navigation', { name: 'Matrix path' })).not.toBeInTheDocument()
    })

    it('renders deeper focus with the immediate parent as header and higher ancestors as breadcrumbs', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-1', parentCellId: 'root', sortOrder: 0, title: 'Cell 1' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 1, title: 'Cell 2' }),
            cell({ id: 'cell-2-a', parentCellId: 'cell-2', sortOrder: 0, title: 'Cell 2 A' }),
            cell({ id: 'cell-2-b', parentCellId: 'cell-2', sortOrder: 1, title: 'Cell 2 B' }),
            cell({ id: 'cell-2-a-i', parentCellId: 'cell-2-a', sortOrder: 0, title: 'Cell 2 A I' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'cell-2-a',
            selectedCell: cells[3]
        })

        const breadcrumbs = screen.getByRole('navigation', { name: 'Matrix path' })
        const table = screen.getByRole('table', { name: 'Matrix table for Cell 2' })
        const dataRows = within(table).getAllByTestId('interpretation-network-table-row')

        expect(within(breadcrumbs).getByRole('button', { name: 'Universe' })).toBeInTheDocument()
        expect(within(table).queryByTestId('interpretation-network-table-header-row')).not.toBeInTheDocument()
        expect(screen.getByTestId('interpretation-network-table-header-card')).toHaveAttribute('data-cell-id', 'cell-2')
        expect(screen.getByRole('button', { name: '3, Cell 2' })).toBeInTheDocument()
        expect(dataRows).toHaveLength(2)
        expect(within(dataRows[0]).getByRole('rowheader', { name: /Cell 2 A/ })).toBeInTheDocument()
        expect(within(dataRows[0]).getByRole('button', { name: '6, Cell 2 A I' })).toBeInTheDocument()
        expect(within(dataRows[1]).getByRole('rowheader', { name: /Cell 2 B/ })).toBeInTheDocument()
    })

    it('moves the focused parent directly into breadcrumbs when the intermediate header card is disabled', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 0, title: 'Cell 2' }),
            cell({ id: 'cell-2-a', parentCellId: 'cell-2', sortOrder: 0, title: 'Cell 2 A' }),
            cell({ id: 'cell-2-a-i', parentCellId: 'cell-2-a', sortOrder: 0, title: 'Cell 2 A I' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'cell-2-a',
            selectedCell: cells[2],
            showHierarchicalTableHeaderCard: false
        })

        const breadcrumbs = screen.getByRole('navigation', { name: 'Matrix path' })
        const table = screen.getByRole('table', { name: 'Matrix table for Cell 2' })

        expect(within(breadcrumbs).getByRole('button', { name: 'Universe' })).toBeInTheDocument()
        expect(within(breadcrumbs).getByRole('button', { name: 'Cell 2' })).toBeInTheDocument()
        expect(within(table).queryByTestId('interpretation-network-table-header-row')).not.toBeInTheDocument()
        expect(within(table).queryByTestId('interpretation-network-table-header-gap')).not.toBeInTheDocument()
        expect(screen.queryByTestId('interpretation-network-table-header-card')).not.toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: /Cell 2 A/ })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: '4, Cell 2 A I' })).toBeInTheDocument()
    })

    it('keeps finite breadcrumb depth after moving the header card into breadcrumbs', () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-2', parentCellId: 'root', sortOrder: 0, title: 'Cell 2' }),
            cell({ id: 'cell-2-a', parentCellId: 'cell-2', sortOrder: 0, title: 'Cell 2 A' }),
            cell({ id: 'cell-2-a-i', parentCellId: 'cell-2-a', sortOrder: 0, title: 'Cell 2 A I' })
        ]

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: 'cell-2-a',
            selectedCell: cells[2],
            showHierarchicalTableHeaderCard: false,
            breadcrumbDepth: { mode: 'last', count: 1 }
        })

        const breadcrumbs = screen.getByRole('navigation', { name: 'Matrix path' })

        expect(within(breadcrumbs).queryByRole('button', { name: 'Universe' })).not.toBeInTheDocument()
        expect(within(breadcrumbs).getByRole('button', { name: 'Show hidden path' })).toBeInTheDocument()
        expect(within(breadcrumbs).getByRole('button', { name: 'Cell 2' })).toBeInTheDocument()
        expect(screen.queryByTestId('interpretation-network-table-header-card')).not.toBeInTheDocument()
    })

    it('renders multiple root candidates as table rows without requiring a focused root first', () => {
        const cells = [
            cell({ id: 'root-a', parentCellId: null, sortOrder: 0, title: 'Root A' }),
            cell({ id: 'root-b', parentCellId: null, sortOrder: 1, title: 'Root B' }),
            cell({ id: 'root-a-child', parentCellId: 'root-a', sortOrder: 0, title: 'Root A Child' })
        ]
        const onSelectCell = vi.fn()

        renderHierarchicalPathWorkspace({
            cells,
            focusedCellId: '',
            selectedCell: undefined,
            onSelectCell,
            showMatrixTreeTotalCells: false
        })

        const table = screen.getByRole('table', { name: 'Hierarchical matrix table' })
        const dataRows = within(table).getAllByTestId('interpretation-network-table-row')

        expect(screen.getByText('Multiple root cells')).toBeInTheDocument()
        expect(screen.getByText('Choose a root cell to continue navigation.')).toBeInTheDocument()
        expect(dataRows).toHaveLength(2)
        expect(within(dataRows[0]).getByRole('rowheader', { name: /Root A/ })).toBeInTheDocument()
        expect(within(dataRows[0]).getByRole('button', { name: '3, Root A Child' })).toBeInTheDocument()
        expect(within(dataRows[1]).getByRole('rowheader', { name: /Root B/ })).toBeInTheDocument()
        expect(screen.queryByTestId('interpretation-network-tree-total-cells')).not.toBeInTheDocument()
    })

    it('opens the intermediate header card menu without changing the focused cell', async () => {
        const cells = [
            cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' }),
            cell({ id: 'cell-1', parentCellId: 'root', sortOrder: 0, title: 'Cell 1' })
        ]
        const onSelectCell = vi.fn()
        const onOpenCellMenu = vi.fn()

        render(
            <MatrixWorkspace
                t={t}
                locale='en'
                matrixMode='hierarchicalCells'
                matrixView='table'
                allowedMatrixViews={['table', 'horizontalRows', 'verticalTree']}
                tableProjection='hierarchicalPath'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'cell-1',
                    breadcrumbDepth: { mode: 'full' }
                })}
                positionLabels={new Map(cells.map((item, index) => [item.id, String(index + 1)]))}
                matrixCells={cells}
                visibleMatrixCells={cells}
                matrixRows={[]}
                materialCountByCellId={new Map()}
                matrixCellIds={cells.map((item) => item.id)}
                selectedCell={cells[1]}
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
                onAddTableRow={vi.fn()}
                onAddTableColumn={vi.fn()}
                onMoveSelectedToSlot={vi.fn()}
                onSelectCell={onSelectCell}
                onOpenCellMenu={onOpenCellMenu}
                onCloseCellMenu={vi.fn()}
                onRequestDeleteCell={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragOver={vi.fn()}
                onDragCancel={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        const headerCard = screen.getByTestId('interpretation-network-table-header-card')
        await userEvent.click(within(headerCard).getByRole('button', { name: 'Cell actions: Universe' }))

        expect(onOpenCellMenu).toHaveBeenCalledTimes(1)
        expect(onOpenCellMenu.mock.calls[0]?.[1]).toBe('root')
        expect(onSelectCell).not.toHaveBeenCalled()
    })

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
                tableProjection='independentAxes'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], [cells[1], cells[2]], [cells[3], cells[4]]]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'child-a',
                    breadcrumbDepth: { mode: 'full' }
                })}
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
                tableProjection='independentAxes'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], [cells[1]]]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'root',
                    breadcrumbDepth: { mode: 'full' }
                })}
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
                tableProjection='independentAxes'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[[cells[0]], [cells[1]]]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells,
                    focusedCellId: 'root',
                    breadcrumbDepth: { mode: 'full' }
                })}
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
                tableProjection='independentAxes'
                toolbarLayout='horizontal'
                showHierarchicalTableHeaders={false}
                showHierarchicalTableHeaderCard={true}
                colorBreadcrumbsByCell={true}
                hierarchyRows={[]}
                hierarchicalTableModel={buildHierarchicalMatrixTableModel({
                    cells: [],
                    focusedCellId: null,
                    breadcrumbDepth: { mode: 'full' }
                })}
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

    it('keeps the menu cell target when opening a dialog after the menu closes', async () => {
        const user = userEvent.setup()
        const cells = [cell({ id: 'root', parentCellId: null, sortOrder: 0, title: 'Universe' })]
        const anchor = document.createElement('button')
        anchor.getBoundingClientRect = () =>
            ({
                width: 24,
                height: 24,
                top: 10,
                right: 34,
                bottom: 34,
                left: 10,
                x: 10,
                y: 10,
                toJSON: () => ({})
            } as DOMRect)
        document.body.appendChild(anchor)
        const onOpenCellDialog = vi.fn()
        const onCloseCellMenu = vi.fn()

        const baseProps: ComponentProps<typeof MatrixWorkspace> = {
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
            hierarchyRows: [[cells[0]]],
            hierarchicalTableModel: buildHierarchicalMatrixTableModel({
                cells,
                focusedCellId: 'root',
                breadcrumbDepth: { mode: 'full' }
            }),
            positionLabels: new Map([['root', '1']]),
            matrixCells: cells,
            visibleMatrixCells: cells,
            matrixRows: [],
            materialCountByCellId: new Map(),
            matrixCellIds: ['root'],
            selectedCell: cells[0],
            matrixDropState: EMPTY_TEST_DROP_STATE,
            matrixDragPreview: null,
            matrixMutationsDisabled: false,
            matrixAxisActionsDisabled: false,
            addCellDisabled: false,
            isSavingCell: false,
            isMovingCell: false,
            matrixRowsError: null,
            saveCellError: null,
            moveCellError: null,
            canEditContent: true,
            canDeleteContent: true,
            cellMenuAnchor: anchor,
            menuCell: cells[0],
            menuMoves: [],
            isDeletingCell: false,
            sensors: [],
            onChangeMatrixView: vi.fn(),
            onOpenCellDialog,
            onAddTableRow: vi.fn(),
            onAddTableColumn: vi.fn(),
            onMoveSelectedToSlot: vi.fn(),
            onSelectCell: vi.fn(),
            onOpenCellMenu: vi.fn(),
            onCloseCellMenu,
            onRequestDeleteCell: vi.fn(),
            onDragStart: vi.fn(),
            onDragMove: vi.fn(),
            onDragOver: vi.fn(),
            onDragCancel: vi.fn(),
            onDragEnd: vi.fn()
        }

        const { rerender, unmount } = render(<MatrixWorkspace {...baseProps} />)
        onCloseCellMenu.mockImplementation(() => {
            rerender(<MatrixWorkspace {...baseProps} cellMenuAnchor={null} menuCell={undefined} />)
        })

        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        await waitFor(() => expect(onOpenCellDialog).toHaveBeenCalledWith('edit', 'root'))
        unmount()
        anchor.remove()
    })
})

const EMPTY_TEST_DROP_STATE: MatrixDropState = {
    activeCellId: null,
    overCellId: null,
    placement: null,
    isValid: false,
    destination: null
}
