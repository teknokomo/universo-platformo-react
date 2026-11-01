import { ConfirmDeleteDialog } from '@universo-react/template-mui/components/dialogs'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { ApplicationBotBinding } from '../../api/applicationBotBindings'
import { useReleaseApplicationBotBinding } from '../../hooks/useApplicationBotBindings'
import { getMessengerBindingMutationError } from './messengerBindingsPanelSupport'

type MessengerBindingReleaseDialogProps = {
    applicationId: string
    binding: ApplicationBotBinding
    onClose: () => void
}

export function MessengerBindingReleaseDialog({ applicationId, binding, onClose }: MessengerBindingReleaseDialogProps) {
    const { t } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const releaseMutation = useReleaseApplicationBotBinding(applicationId)

    const releaseBinding = async () => {
        try {
            await releaseMutation.mutateAsync({ bindingId: binding.id, expectedVersion: binding.version })
            onClose()
            enqueueSnackbar(t('messenger.releaseSuccess', 'Bot connection released'), { variant: 'success' })
        } catch (error) {
            enqueueSnackbar(getMessengerBindingMutationError(error, t), { variant: 'error' })
        }
    }

    return (
        <ConfirmDeleteDialog
            open
            title={t('messenger.releaseTitle', 'Release this bot connection?')}
            description={t(
                'messenger.releaseDescription',
                'Release is permanent. Existing launch links will no longer resolve to this bot connection, and its short link identifier will not be reused.'
            )}
            confirmButtonText={t('messenger.releaseConfirm', 'Release connection')}
            deletingButtonText={t('messenger.releasing', 'Releasing…')}
            cancelButtonText={t('messenger.cancel', 'Cancel')}
            loading={releaseMutation.isPending}
            onCancel={onClose}
            onConfirm={releaseBinding}
        />
    )
}
