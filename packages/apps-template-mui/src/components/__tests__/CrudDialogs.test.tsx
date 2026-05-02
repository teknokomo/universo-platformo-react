import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CrudDialogs } from '../CrudDialogs'
import type { CrudDashboardState } from '../../hooks/useCrudDashboard'

vi.mock('../dialogs/FormDialog', () => ({
    FormDialog: ({ open, surface }: { open: boolean; surface?: 'dialog' | 'page' }) => (
        <div data-testid='crud-form-dialog'>
            {String(open)}:{surface ?? 'dialog'}
        </div>
    )
}))

vi.mock('../dialogs/ConfirmDeleteDialog', () => ({
    ConfirmDeleteDialog: () => <div data-testid='crud-delete-dialog'>delete</div>
}))

const labels = {
    editTitle: 'Edit',
    createTitle: 'Create',
    saveText: 'Save',
    createText: 'Create',
    savingText: 'Saving',
    creatingText: 'Creating',
    cancelText: 'Cancel',
    noFieldsText: 'No fields',
    deleteTitle: 'Delete',
    deleteDescription: 'Delete row',
    deleteText: 'Delete',
    deletingText: 'Deleting',
    copyTitle: 'Copy',
    copyText: 'Copy',
    copyingText: 'Copying'
}

const makeState = (overrides: Partial<CrudDashboardState>): CrudDashboardState =>
    ({
        appData: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        layoutConfig: {},
        columns: [],
        fieldConfigs: [],
        rows: [],
        rowCount: undefined,
        paginationModel: { page: 0, pageSize: 20 },
        setPaginationModel: vi.fn(),
        pageSizeOptions: [10, 20, 50],
        localeText: undefined,
        handlePendingInteractionAttempt: vi.fn(() => true),
        activeSectionId: undefined,
        selectedSectionId: undefined,
        onSelectSection: vi.fn(),
        activeLinkedCollectionId: undefined,
        selectedLinkedCollectionId: undefined,
        onSelectLinkedCollection: vi.fn(),
        activeMenu: null,
        dashboardMenuItems: [],
        menuSlot: undefined,
        menusMap: {},
        formOpen: false,
        editRowId: null,
        formError: null,
        formInitialData: undefined,
        isFormReady: true,
        isSubmitting: false,
        isReordering: false,
        canPersistRowReorder: false,
        handleOpenCreate: vi.fn(),
        handleOpenEdit: vi.fn(),
        handleCloseForm: vi.fn(),
        handleFormSubmit: vi.fn(async () => undefined),
        handlePersistRowReorder: vi.fn(async () => undefined),
        deleteRowId: null,
        deleteError: null,
        isDeleting: false,
        handleOpenDelete: vi.fn(),
        handleCloseDelete: vi.fn(),
        handleConfirmDelete: vi.fn(async () => undefined),
        copyRowId: null,
        copyError: null,
        isCopying: false,
        handleOpenCopy: vi.fn(),
        handleCloseCopy: vi.fn(),
        menuAnchorEl: null,
        menuRowId: null,
        handleOpenMenu: vi.fn(),
        handleCloseMenu: vi.fn(),
        ...overrides
    } satisfies CrudDashboardState)

describe('CrudDialogs', () => {
    it('keeps page-surface forms mounted while submit is pending', () => {
        render(
            <CrudDialogs
                state={makeState({ formOpen: false, isFormReady: true, isSubmitting: true })}
                locale='en'
                labels={labels}
                surface='page'
                renderDelete={false}
            />
        )

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('true:page')
    })

    it('does not force dialog-surface forms open during submit when the form is already closed', () => {
        render(
            <CrudDialogs
                state={makeState({ formOpen: false, isFormReady: true, isSubmitting: true })}
                locale='en'
                labels={labels}
                surface='dialog'
                renderDelete={false}
            />
        )

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('false:dialog')
    })
})
