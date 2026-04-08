import { FormDialog } from './dialogs/FormDialog'
import { ConfirmDeleteDialog } from './dialogs/ConfirmDeleteDialog'
import type { CrudDashboardState } from '../hooks/useCrudDashboard'

export interface CrudDialogsProps {
    /** State object returned by `useCrudDashboard()`. */
    state: CrudDashboardState
    /** BCP-47 locale string, e.g. `"en"`, `"ru"`. */
    locale: string
    /** i18n-resolved labels for the dialogs. */
    labels: CrudDialogsLabels
    /** Base API URL for TABLE (tabular part) CRUD operations. */
    apiBaseUrl?: string
    /** Application ID for TABLE (tabular part) CRUD operations. */
    applicationId?: string
    /** Catalog ID for TABLE (tabular part) CRUD operations. */
    catalogId?: string
    /** Surface used for create/edit/copy forms. */
    surface?: 'dialog' | 'page'
    /** Render create/edit/copy form surface. */
    renderForm?: boolean
    /** Render delete confirmation surface. */
    renderDelete?: boolean
}

export interface CrudDialogsLabels {
    editTitle: string
    createTitle: string
    saveText: string
    createText: string
    savingText: string
    creatingText: string
    cancelText: string
    noFieldsText: string
    deleteTitle: string
    deleteDescription: string
    deleteText: string
    deletingText: string
    copyTitle: string
    copyText: string
    copyingText: string
}

/**
 * Shared CRUD dialogs wrapper: `FormDialog` + `ConfirmDeleteDialog`.
 *
 * Extracts the duplicated dialog JSX from both `DashboardApp` and
 * `ApplicationRuntime`. Connect it to the `CrudDashboardState`.
 */
export function CrudDialogs({
    state,
    locale,
    labels,
    apiBaseUrl,
    applicationId,
    catalogId,
    surface = 'dialog',
    renderForm = true,
    renderDelete = true
}: CrudDialogsProps) {
    const keepPageSurfaceMounted = surface === 'page' && state.isSubmitting

    return (
        <>
            {renderForm ? (
                <FormDialog
                    open={(state.formOpen || keepPageSurfaceMounted) && state.isFormReady}
                    title={state.copyRowId ? labels.copyTitle : state.editRowId ? labels.editTitle : labels.createTitle}
                    surface={surface}
                    fields={state.fieldConfigs}
                    locale={locale}
                    initialData={state.formInitialData}
                    isSubmitting={state.isSubmitting}
                    error={state.formError || state.copyError}
                    saveButtonText={state.copyRowId ? labels.copyText : state.editRowId ? labels.saveText : labels.createText}
                    savingButtonText={state.copyRowId ? labels.copyingText : state.editRowId ? labels.savingText : labels.creatingText}
                    cancelButtonText={labels.cancelText}
                    emptyStateText={labels.noFieldsText}
                    onClose={state.handleCloseForm}
                    onSubmit={state.handleFormSubmit}
                    apiBaseUrl={apiBaseUrl}
                    applicationId={applicationId}
                    catalogId={catalogId}
                    editRowId={state.editRowId}
                />
            ) : null}

            {renderDelete ? (
                <ConfirmDeleteDialog
                    open={Boolean(state.deleteRowId)}
                    title={labels.deleteTitle}
                    description={labels.deleteDescription}
                    confirmButtonText={labels.deleteText}
                    deletingButtonText={labels.deletingText}
                    cancelButtonText={labels.cancelText}
                    loading={state.isDeleting}
                    error={state.deleteError ?? undefined}
                    onCancel={state.handleCloseDelete}
                    onConfirm={state.handleConfirmDelete}
                />
            ) : null}
        </>
    )
}
