import { useCallback, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    resolveDashboardEntityTargetSectionId,
    useDashboardBoundRowActions,
    type CrudDataAdapter,
    type DashboardBoundRowActionGuardFailure,
    type DashboardBoundRowMutationAction,
    type DashboardEntityDescriptor,
    type DashboardRowTarget,
    type PendingDashboardRowTarget
} from '@universo-react/apps-template-mui'
import { resolveApiErrorMessage } from '@universo-react/utils'

interface UseHostedDashboardBoundRowActionsOptions {
    applicationId: string
    locale: string
    adapter: CrudDataAdapter | null
    currentWorkspaceId: string | null
    currentSectionId: string | null
    sections?: readonly DashboardEntityDescriptor[]
    objectCollections?: readonly DashboardEntityDescriptor[]
    onSelectObjectCollection: (objectCollectionId: string) => void
    setPendingRowTarget: Dispatch<SetStateAction<PendingDashboardRowTarget | null>>
    handleStateRowMenuOpen: (event: MouseEvent<HTMLElement>, rowId: string) => void
    onRuntimeDataChanged?: () => void | Promise<unknown>
}

export const useHostedDashboardBoundRowActions = ({
    applicationId,
    locale,
    adapter,
    currentWorkspaceId,
    currentSectionId,
    sections,
    objectCollections,
    onSelectObjectCollection,
    setPendingRowTarget,
    handleStateRowMenuOpen,
    onRuntimeDataChanged
}: UseHostedDashboardBoundRowActionsOptions) => {
    const { t } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const resolveRowTargetSectionId = useCallback(
        (target: DashboardRowTarget) => resolveDashboardEntityTargetSectionId(target, { sections, objectCollections }),
        [objectCollections, sections]
    )
    const onGuardFailure = useCallback(
        (failure: DashboardBoundRowActionGuardFailure) => {
            const message =
                failure === 'target'
                    ? t('app.targetActionUnavailable', 'This action is not available for this row.')
                    : failure === 'record-version'
                    ? t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.')
                    : t('app.errorWorkflowVersionRequired', 'Workflow action requires a current row version. Please reload and try again.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        [enqueueSnackbar, t]
    )
    const onMutationSuccess = useCallback(
        async (action: DashboardBoundRowMutationAction) => {
            if (adapter) await queryClient.invalidateQueries({ queryKey: adapter.queryKeyPrefix })
            await onRuntimeDataChanged?.()

            if (action.kind === 'record') {
                const messageKey =
                    action.command === 'post' ? 'app.recordPosted' : action.command === 'unpost' ? 'app.recordUnposted' : 'app.recordVoided'
                const fallback =
                    action.command === 'post' ? 'Record posted.' : action.command === 'unpost' ? 'Record unposted.' : 'Record voided.'
                enqueueSnackbar(t(messageKey, fallback), { variant: 'success' })
                return
            }
            enqueueSnackbar(t('app.workflowActionCompleted', 'Workflow action completed.'), { variant: 'success' })
        },
        [adapter, enqueueSnackbar, onRuntimeDataChanged, queryClient, t]
    )
    const onMutationError = useCallback(
        (error: unknown, action: DashboardBoundRowMutationAction) => {
            const fallback = t('app.targetActionUnavailable', 'This action is not available for this row.')
            const message = resolveApiErrorMessage(error, fallback)
            const messageKey = action.kind === 'record' ? 'app.errorRecordCommand' : 'app.errorWorkflowAction'
            enqueueSnackbar(
                t(messageKey, {
                    defaultValue: action.kind === 'record' ? 'Record command failed: {{message}}' : 'Workflow action failed: {{message}}',
                    message
                }),
                { variant: 'error' }
            )
        },
        [enqueueSnackbar, t]
    )

    return useDashboardBoundRowActions({
        applicationId,
        locale,
        adapter,
        currentWorkspaceId,
        currentSectionId,
        resolveRowTargetSectionId,
        onSelectObjectCollection,
        setPendingRowTarget,
        handleStateRowMenuOpen,
        onGuardFailure,
        onMutationSuccess,
        onMutationError
    })
}
