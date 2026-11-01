import { useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { gridSpacing } from '@universo-react/template-mui'
import type { ApplicationBotBinding } from '../../api/applicationBotBindings'
import { copyMessengerBindingText } from './messengerBindingsPanelSupport'
import { MessengerBindingCard } from './MessengerBindingCard'
import { MessengerBindingFormDialog } from './MessengerBindingFormDialog'
import { MessengerBindingReleaseDialog } from './MessengerBindingReleaseDialog'
import { useMessengerBindingsPanel } from './useMessengerBindingsPanel'

type MessengerBindingsPanelProps = {
    applicationId: string
    isPublic: boolean
}

type BotBindingDialogState = { mode: 'create' } | { mode: 'edit'; binding: ApplicationBotBinding }

export function MessengerBindingsPanel({ applicationId, isPublic }: MessengerBindingsPanelProps) {
    const { t } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const { bindingsQuery, aliasesQuery, primaryAlias, publicUrl, formatBindingDate } = useMessengerBindingsPanel(applicationId)
    const [dialogState, setDialogState] = useState<BotBindingDialogState | null>(null)
    const [releaseTarget, setReleaseTarget] = useState<ApplicationBotBinding | null>(null)

    const showCopyResult = async (value: string) => {
        try {
            await copyMessengerBindingText(value)
            enqueueSnackbar(t('messenger.copySuccess', 'Copied to clipboard'), { variant: 'success' })
        } catch {
            enqueueSnackbar(t('messenger.copyError', 'Could not copy. Select and copy the address manually.'), { variant: 'error' })
        }
    }

    if (bindingsQuery.isLoading) {
        return <CircularProgress size={28} aria-label={t('messenger.loading', 'Loading bot connections')} />
    }

    return (
        <Stack spacing={2} data-testid='application-messenger-bindings'>
            {!isPublic ? (
                <Alert severity='warning'>
                    {t('messenger.publicRequired', 'Set this application to Public before sharing its web or messenger links.')}
                </Alert>
            ) : null}
            {aliasesQuery.isLoading ? (
                <Alert severity='info'>{t('messenger.aliasLookupLoading', 'Checking for a primary public address...')}</Alert>
            ) : null}
            {aliasesQuery.isError ? (
                <Alert severity='warning'>
                    <Stack spacing={1}>
                        <Typography variant='body2'>
                            {t(
                                'messenger.aliasLookupError',
                                'The primary public address could not be loaded. Retry before copying a Web App URL.'
                            )}
                        </Typography>
                        <Button color='inherit' size='small' onClick={() => void aliasesQuery.refetch()}>
                            {t('messenger.retry', 'Retry')}
                        </Button>
                    </Stack>
                </Alert>
            ) : null}
            {aliasesQuery.isSuccess && !primaryAlias ? (
                <Alert severity='info'>
                    <Stack spacing={1}>
                        <Typography variant='body2'>
                            {t(
                                'messenger.primaryAddressRequired',
                                'No primary public address is set. Ask a platform administrator to open this application’s Settings from the Applications list, choose Public addresses, and set a primary address. Then return here and retry.'
                            )}
                        </Typography>
                        <Button color='inherit' size='small' onClick={() => void aliasesQuery.refetch()}>
                            {t('messenger.retry', 'Retry')}
                        </Button>
                    </Stack>
                </Alert>
            ) : null}
            {publicUrl ? (
                <Alert severity='info'>
                    <Stack spacing={1.5}>
                        <Typography variant='subtitle2'>{t('messenger.publicUrlTitle', 'Public application URL')}</Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                            <TextField
                                size='small'
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={3}
                                value={publicUrl}
                                label={t('messenger.publicUrlLabel', 'Web application address')}
                                slotProps={{
                                    htmlInput: { readOnly: true, 'aria-label': t('messenger.publicUrlLabel', 'Web application address') }
                                }}
                                sx={{ minWidth: 0, '& textarea': { overflowWrap: 'anywhere' } }}
                            />
                            <Button
                                variant='outlined'
                                startIcon={<ContentCopyRoundedIcon />}
                                onClick={() => void showCopyResult(publicUrl)}
                                sx={{ flexShrink: 0 }}
                            >
                                {t('messenger.copyUrl', 'Copy URL')}
                            </Button>
                        </Stack>
                        <Typography variant='body2'>
                            {t(
                                'messenger.telegramSetup',
                                'Telegram: use this public URL in the bot Main Mini App, menu button, or a web_app link. Universo does not configure or verify external bot settings.'
                            )}
                        </Typography>
                        <Typography variant='body2'>
                            {t(
                                'messenger.maxSetup',
                                'MAX: use this same public URL in the Mini App settings. Universo does not configure or verify external bot settings.'
                            )}
                        </Typography>
                    </Stack>
                </Alert>
            ) : null}

            {bindingsQuery.isError ? (
                <Alert
                    severity='error'
                    action={
                        <Button color='inherit' size='small' onClick={() => void bindingsQuery.refetch()}>
                            {t('messenger.retry', 'Retry')}
                        </Button>
                    }
                >
                    {t('messenger.errors.load', 'Bot connections could not be loaded.')}
                </Alert>
            ) : null}

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
                <Box>
                    <Typography variant='h6'>{t('messenger.title', 'Bots and connections')}</Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t('messenger.description', 'Connect a Telegram or MAX bot to this public application.')}
                    </Typography>
                </Box>
                <Button
                    startIcon={<AddRoundedIcon />}
                    variant='contained'
                    disabled={!isPublic}
                    onClick={() => setDialogState({ mode: 'create' })}
                >
                    {t('messenger.addBinding', 'Add bot connection')}
                </Button>
            </Stack>

            {bindingsQuery.isSuccess && bindingsQuery.data.length === 0 ? (
                <Alert severity='info'>{t('messenger.empty', 'No bot connections yet.')}</Alert>
            ) : null}

            {bindingsQuery.data?.length ? (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                        gap: gridSpacing,
                        minWidth: 0
                    }}
                >
                    {bindingsQuery.data.map((binding) => (
                        <MessengerBindingCard
                            key={binding.id}
                            binding={binding}
                            formatBindingDate={formatBindingDate}
                            onCopy={(value) => void showCopyResult(value)}
                            onEdit={(editedBinding) => setDialogState({ mode: 'edit', binding: editedBinding })}
                            onRelease={setReleaseTarget}
                        />
                    ))}
                </Box>
            ) : null}

            {dialogState ? (
                <MessengerBindingFormDialog
                    applicationId={applicationId}
                    binding={dialogState.mode === 'edit' ? dialogState.binding : undefined}
                    onClose={() => setDialogState(null)}
                />
            ) : null}

            {releaseTarget ? (
                <MessengerBindingReleaseDialog
                    applicationId={applicationId}
                    binding={releaseTarget}
                    onClose={() => setReleaseTarget(null)}
                />
            ) : null}
        </Stack>
    )
}
