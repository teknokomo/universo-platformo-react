import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CrudDialogs } from '../CrudDialogs'
import type { CrudDashboardState } from '../../hooks/useCrudDashboard'

vi.mock('../dialogs/FormDialog', () => ({
    FormDialog: ({
        open,
        surface,
        wizardSteps
    }: {
        open: boolean
        surface?: 'dialog' | 'page'
        wizardSteps?: Array<{ label?: string; helperText?: string; fieldIds: string[] }>
    }) => (
        <div data-testid='crud-form-dialog'>
            {String(open)}:{surface ?? 'dialog'}:{wizardSteps?.length ?? 0}
            {wizardSteps?.map((step) => (
                <div key={step.label} data-testid='crud-form-wizard-step' data-fields={step.fieldIds.join(',')}>
                    {step.label}:{step.helperText}
                </div>
            ))}
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
        rawAppData: undefined,
        appData: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        columns: [],
        fieldConfigs: [],
        rows: [],
        rowCount: undefined,
        paginationModel: { page: 0, pageSize: 20 },
        setPaginationModel: vi.fn(),
        sortModel: [],
        setSortModel: vi.fn(),
        filterModel: { items: [] },
        setFilterModel: vi.fn(),
        searchValue: '',
        setSearchValue: vi.fn(),
        pageSizeOptions: [10, 20, 50],
        localeText: undefined,
        handlePendingInteractionAttempt: vi.fn(() => true),
        activeSectionId: undefined,
        selectedSectionId: undefined,
        onSelectSection: vi.fn(),
        activeObjectCollectionId: undefined,
        selectedObjectCollectionId: undefined,
        onSelectObjectCollection: vi.fn(),
        formOpen: false,
        editRowId: null,
        formError: null,
        formInitialData: undefined,
        createWizard: undefined,
        isFormReady: true,
        isSubmitting: false,
        isReordering: false,
        canPersistRowReorder: false,
        canPersistRelationRowReorder: false,
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

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('true:page:0')
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

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('false:dialog:0')
    })

    it('localizes entity component wizard steps and resolves component codenames to form fields', () => {
        render(
            <CrudDialogs
                state={makeState({
                    formOpen: true,
                    createWizard: {
                        steps: [
                            {
                                id: 'content',
                                label: { en: 'Content', ru: 'Содержание' },
                                helperText: { en: 'Describe the lesson.', ru: 'Опишите урок.' },
                                fieldCodenames: ['Title', 'Body']
                            }
                        ]
                    },
                    appData: {
                        columns: [
                            { id: 'title-id', field: 'title_value', codename: 'Title' },
                            { id: 'body-id', field: 'body_value', codename: 'Body' }
                        ]
                    } as unknown as CrudDashboardState['appData']
                })}
                locale='ru'
                labels={labels}
                renderDelete={false}
            />
        )

        expect(screen.getByTestId('crud-form-dialog')).toHaveTextContent('true:dialog:1')
        expect(screen.getByTestId('crud-form-wizard-step')).toHaveTextContent('Содержание:Опишите урок.')
        expect(screen.getByTestId('crud-form-wizard-step')).toHaveAttribute('data-fields', 'title_value,body_value')
    })
})
