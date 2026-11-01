import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material'
import { ItemCard } from '@universo-react/template-mui'
import { useTranslation } from 'react-i18next'
import { buildMessengerLaunchUrl } from '../../utils/messengerBotUsername'
import type { ApplicationBotBinding } from '../../api/applicationBotBindings'

const ACTION_BUTTON_SX = { width: 44, height: 44, minWidth: 44 } as const

type MessengerBindingCardProps = {
    binding: ApplicationBotBinding
    formatBindingDate: (value: string) => string
    onCopy: (value: string) => void
    onEdit: (binding: ApplicationBotBinding) => void
    onRelease: (binding: ApplicationBotBinding) => void
}

export function MessengerBindingCard({ binding, formatBindingDate, onCopy, onEdit, onRelease }: MessengerBindingCardProps) {
    const { t } = useTranslation('applications')
    const launchUrl = buildMessengerLaunchUrl(binding.platform, binding.botUsername, binding.shortId)
    const displayName = binding.displayName?.trim()
    const usernameLabel = `@${binding.botUsername}`
    const bindingLabel = displayName ? `${displayName} (${usernameLabel})` : usernameLabel
    const platformLabel = t(`messenger.platform.${binding.platform}`, binding.platform === 'telegram' ? 'Telegram' : 'MAX')
    const statusLabel =
        binding.status === 'active'
            ? t('messenger.status.active', 'Enabled')
            : binding.status === 'disabled'
            ? t('messenger.status.disabled', 'Disabled')
            : t('messenger.status.draft', 'Setup needed')

    return (
        <Box data-testid='messenger-binding-card' sx={{ minWidth: 0 }}>
            <ItemCard
                allowStretch
                footerStackOnMobile
                wrapTitle
                wrapDescription
                data={{
                    name: displayName || usernameLabel,
                    description: `${platformLabel} · ${usernameLabel}`
                }}
                titleTooltip={bindingLabel}
                titleEndContent={<Chip size='small' variant='outlined' label={platformLabel} />}
                footerStartContent={
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Chip size='small' color={binding.status === 'active' ? 'success' : 'default'} label={statusLabel} />
                        <Typography variant='caption' color='text.secondary' sx={{ overflowWrap: 'anywhere' }}>
                            {t('messenger.createdAt', 'Created')}: {formatBindingDate(binding.createdAt)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary' sx={{ overflowWrap: 'anywhere' }}>
                            {t('messenger.updatedAt', 'Updated')}: {formatBindingDate(binding.updatedAt)}
                        </Typography>
                    </Stack>
                }
                footerEndContent={
                    <Stack direction='row' spacing={0.25}>
                        <IconButton
                            size='small'
                            sx={ACTION_BUTTON_SX}
                            aria-label={t('messenger.copyLaunchLink', 'Copy {{platform}} launch link for {{username}}', {
                                platform: platformLabel,
                                username: binding.botUsername
                            })}
                            onClick={() => onCopy(launchUrl)}
                        >
                            <ContentCopyRoundedIcon fontSize='small' />
                        </IconButton>
                        <IconButton
                            size='small'
                            sx={ACTION_BUTTON_SX}
                            aria-label={t('messenger.editBinding', 'Edit {{username}} connection', { username: binding.botUsername })}
                            onClick={() => onEdit(binding)}
                        >
                            <EditRoundedIcon fontSize='small' />
                        </IconButton>
                        <IconButton
                            size='small'
                            sx={ACTION_BUTTON_SX}
                            color='error'
                            aria-label={t('messenger.releaseBinding', 'Release {{username}} connection', { username: binding.botUsername })}
                            onClick={() => onRelease(binding)}
                        >
                            <DeleteOutlineRoundedIcon fontSize='small' />
                        </IconButton>
                    </Stack>
                }
            />
        </Box>
    )
}
