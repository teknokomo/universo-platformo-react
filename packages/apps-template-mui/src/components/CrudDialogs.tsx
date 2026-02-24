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
}

/**
 * Shared CRUD dialogs wrapper: `FormDialog` + `ConfirmDeleteDialog`.
 *
 * Extracts the duplicated dialog JSX from both `DashboardApp` and
 * `ApplicationRuntime`. Connect it to the `CrudDashboardState`.
 */
export function CrudDialogs({ state, locale, labels, apiBaseUrl, applicationId, catalogId }: CrudDialogsProps) {
    return (
        <>
            <FormDialog
                open={state.formOpen && state.isFormReady}
                title={state.editRowId ? labels.editTitle : labels.createTitle}
                fields={state.fieldConfigs}
                locale={locale}
                initialData={state.formInitialData}
                isSubmitting={state.isSubmitting}
                error={state.formError}
                saveButtonText={state.editRowId ? labels.saveText : labels.createText}
                savingButtonText={state.editRowId ? labels.savingText : labels.creatingText}
                cancelButtonText={labels.cancelText}
                emptyStateText={labels.noFieldsText}
                onClose={state.handleCloseForm}
                onSubmit={state.handleFormSubmit}
                apiBaseUrl={apiBaseUrl}
                applicationId={applicationId}
                catalogId={catalogId}
                editRowId={state.editRowId}
            />

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
        </>
    )
}
