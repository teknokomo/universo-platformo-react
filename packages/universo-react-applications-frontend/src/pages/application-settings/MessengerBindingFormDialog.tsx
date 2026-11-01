import { useState } from 'react'
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { StandardDialog } from '@universo-react/template-mui/components/dialogs'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { isSafeApplicationBotDisplayName } from '@universo-react/types'
import type { ApplicationBotBinding, ApplicationBotBindingStatus, ApplicationBotPlatform } from '../../api/applicationBotBindings'
import { useCreateApplicationBotBinding, useUpdateApplicationBotBinding } from '../../hooks/useApplicationBotBindings'
import { validateBotUsername, type BotUsernameValidation } from '../../utils/messengerBotUsername'
import { getMessengerBindingMutationError } from './messengerBindingsPanelSupport'

type MessengerBindingFormDialogProps = {
    applicationId: string
    binding?: ApplicationBotBinding
    onClose: () => void
}

type EditableBindingStatus = Extract<ApplicationBotBindingStatus, 'draft' | 'active' | 'disabled'>
type InvalidUsernameReason = Extract<BotUsernameValidation, { valid: false }>['reason']

export function MessengerBindingFormDialog({ applicationId, binding, onClose }: MessengerBindingFormDialogProps) {
    const { t } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const createMutation = useCreateApplicationBotBinding(applicationId)
    const updateMutation = useUpdateApplicationBotBinding(applicationId)
    const isPending = createMutation.isPending || updateMutation.isPending
    const [platform, setPlatform] = useState<ApplicationBotPlatform>(binding?.platform ?? 'telegram')
    const [botUsername, setBotUsername] = useState(binding?.botUsername ?? '')
    const [displayName, setDisplayName] = useState(binding?.displayName ?? '')
    const [status, setStatus] = useState<EditableBindingStatus>(binding?.status ?? 'draft')
    const [formError, setFormError] = useState<string | null>(null)
    const [usernameError, setUsernameError] = useState<string | null>(null)
    const [displayNameError, setDisplayNameError] = useState<string | null>(null)
    const [usernameWarning, setUsernameWarning] = useState(false)

    const getUsernameErrorMessage = (reason: InvalidUsernameReason): string =>
        reason === 'max-at'
            ? t('messenger.validation.maxUsernameAt', 'MAX bot usernames must not contain @.')
            : reason === 'max-format'
            ? t('messenger.validation.maxUsername', 'Use 11–60 letters, numbers, or underscores, starting with a letter.')
            : t('messenger.validation.telegramUsername', 'Use 5–32 Latin letters, numbers, or underscores.')

    const closeDialog = () => {
        if (isPending) return
        onClose()
        setFormError(null)
    }

    const saveBinding = async () => {
        const validation = validateBotUsername(platform, botUsername)
        if (!validation.valid) {
            setUsernameError(getUsernameErrorMessage(validation.reason))
            setUsernameWarning(false)
            return
        }

        setFormError(null)
        setUsernameError(null)
        setUsernameWarning(validation.warning === 'telegram-suffix')
        const normalizedDisplayName = displayName.trim()
        if (normalizedDisplayName && !isSafeApplicationBotDisplayName(normalizedDisplayName)) {
            setDisplayNameError(
                t('messenger.validation.displayName', 'Use a short label only. Do not include contact details or credentials.')
            )
            return
        }
        setDisplayNameError(null)

        try {
            if (binding) {
                const updateStatus = status !== binding.status ? status : undefined
                await updateMutation.mutateAsync({
                    bindingId: binding.id,
                    data: {
                        botUsername: validation.value,
                        displayName: normalizedDisplayName || null,
                        ...(updateStatus ? { status: updateStatus } : {}),
                        expectedVersion: binding.version
                    }
                })
            } else {
                await createMutation.mutateAsync({
                    platform,
                    botUsername: validation.value,
                    ...(normalizedDisplayName ? { displayName: normalizedDisplayName } : {})
                })
            }
            onClose()
            enqueueSnackbar(t('messenger.saveSuccess', 'Bot connection saved'), { variant: 'success' })
        } catch (error) {
            setFormError(getMessengerBindingMutationError(error, t))
        }
    }

    return (
        <StandardDialog
            open
            onClose={closeDialog}
            title={t(binding ? 'messenger.editTitle' : 'messenger.createTitle', binding ? 'Edit bot connection' : 'Add bot connection')}
            maxWidth='sm'
            isBusy={isPending}
            actions={
                <>
                    <Button onClick={closeDialog} disabled={isPending}>
                        {t('messenger.cancel', 'Cancel')}
                    </Button>
                    <Button variant='contained' onClick={() => void saveBinding()} disabled={isPending}>
                        {t('messenger.save', 'Save connection')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ pt: 1 }}>
                {formError ? <Alert severity='error'>{formError}</Alert> : null}
                <FormControl fullWidth disabled={Boolean(binding) || isPending}>
                    <InputLabel id='messenger-platform-label'>{t('messenger.platformLabel', 'Platform')}</InputLabel>
                    <Select
                        labelId='messenger-platform-label'
                        label={t('messenger.platformLabel', 'Platform')}
                        value={platform}
                        onChange={(event) => {
                            const nextPlatform = event.target.value as ApplicationBotPlatform
                            setPlatform(nextPlatform)
                            setFormError(null)
                            const nextValidation = validateBotUsername(nextPlatform, botUsername)
                            setUsernameError(nextValidation.valid ? null : getUsernameErrorMessage(nextValidation.reason))
                            setUsernameWarning(nextValidation.valid && nextValidation.warning === 'telegram-suffix')
                        }}
                    >
                        <MenuItem value='telegram'>{t('messenger.platform.telegram', 'Telegram')}</MenuItem>
                        <MenuItem value='max'>{t('messenger.platform.max', 'MAX')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    fullWidth
                    required
                    label={t('messenger.usernameLabel', 'Bot username')}
                    value={botUsername}
                    onChange={(event) => {
                        setBotUsername(event.target.value)
                        setFormError(null)
                        setUsernameError(null)
                        const nextValidation = validateBotUsername(platform, event.target.value)
                        setUsernameWarning(nextValidation.valid && nextValidation.warning === 'telegram-suffix')
                    }}
                    onBlur={() => {
                        const validation = validateBotUsername(platform, botUsername)
                        setUsernameWarning(validation.valid && validation.warning === 'telegram-suffix')
                    }}
                    error={Boolean(usernameError)}
                    helperText={
                        usernameError ||
                        (platform === 'telegram'
                            ? t('messenger.usernameHelp.telegram', 'Telegram usernames may start with @; it is removed before saving.')
                            : t('messenger.usernameHelp.max', 'Enter the MAX username without @.'))
                    }
                    autoComplete='off'
                />
                {usernameWarning ? (
                    <Alert severity='warning'>
                        {t(
                            'messenger.validation.telegramSuffixWarning',
                            'Telegram usernames often end in “bot”, but some valid usernames do not.'
                        )}
                    </Alert>
                ) : null}
                <TextField
                    fullWidth
                    label={t('messenger.displayNameLabel', 'Display name (optional)')}
                    value={displayName}
                    onChange={(event) => {
                        setDisplayName(event.target.value)
                        setDisplayNameError(null)
                    }}
                    error={Boolean(displayNameError)}
                    helperText={
                        displayNameError ||
                        t('messenger.displayNameHelp', 'Use a short label only. Do not include contact details or credentials.')
                    }
                    slotProps={{ htmlInput: { maxLength: 240 } }}
                />
                {binding ? (
                    <FormControl fullWidth>
                        <InputLabel id='messenger-status-label'>{t('messenger.statusLabel', 'Connection status')}</InputLabel>
                        <Select
                            labelId='messenger-status-label'
                            label={t('messenger.statusLabel', 'Connection status')}
                            value={status}
                            onChange={(event) => setStatus(event.target.value as EditableBindingStatus)}
                        >
                            <MenuItem value='draft'>{t('messenger.status.draft', 'Setup needed')}</MenuItem>
                            <MenuItem value='active'>{t('messenger.status.active', 'Enabled')}</MenuItem>
                            <MenuItem value='disabled'>{t('messenger.status.disabled', 'Disabled')}</MenuItem>
                        </Select>
                    </FormControl>
                ) : null}
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t(
                        'messenger.activationHint',
                        'Enabling a connection allows its launch link to resolve; it does not configure or verify the external bot.'
                    )}
                </Typography>
            </Stack>
        </StandardDialog>
    )
}
