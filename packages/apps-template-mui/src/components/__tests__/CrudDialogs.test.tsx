import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CrudDialogs } from '../CrudDialogs'

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

describe('CrudDialogs', () => {
    it('keeps page-surface forms mounted while submit is pending', () => {
        render(
            <CrudDialogs
                state={{
                    formOpen: false,
                    isFormReady: true,
                    isSubmitting: true,
                    fieldConfigs: [],
                    formInitialData: undefined,
                    formError: null,
                    copyError: null,
                    copyRowId: null,
                    editRowId: null,
                    handleCloseForm: vi.fn(),
                    handleFormSubmit: vi.fn(),
                    deleteRowId: null,
                    deleteError: null,
                    isDeleting: false,
                    handleCloseDelete: vi.fn(),
                    handleConfirmDelete: vi.fn()
                } as any}
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
                state={{
                    formOpen: false,
                    isFormReady: true,
                    isSubmitting: true,
                    fieldConfigs: [],
                    formInitialData: undefined,
                    formError: null,
                    copyError: null,
                    copyRowId: null,
                    editRowId: null,
                    handleCloseForm: vi.fn(),
                    handleFormSubmit: vi.fn(),
                    deleteRowId: null,
                    deleteError: null,
                    isDeleting: false,
                    handleCloseDelete: vi.fn(),
                    handleConfirmDelete: vi.fn()
                } as any}
                locale='en'
                labels={labels}
                surface='dialog'
                renderDelete={false}
            />
        )

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('false:dialog')
    })
})