import { useTranslation } from 'react-i18next'
import { Box, Typography, Stack, Alert, FormControlLabel, Switch, Tooltip, Chip, List, ListItem, ListItemText } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import InfoIcon from '@mui/icons-material/Info'
import type { ConnectorPublication, PublicationSummary } from '../types'
import { getVLCString } from '../types'

export interface ConnectorPublicationInfoPanelProps {
    /** List of all available publications (with metahub info) */
    availablePublications: PublicationSummary[]
    /** Currently linked publication records */
    linkedPublications: ConnectorPublication[]
    /** Loading state */
    isLoading?: boolean
    /** Whether connector is limited to single metahub (always true, locked) */
    isSinglePublication?: boolean
    /** Whether connector requires at least one metahub (always true, locked) */
    isRequiredPublication?: boolean
    /** Disable all interactions */
    disabled?: boolean
    /** Current UI locale for display */
    uiLocale?: string
}

/**
 * Panel for displaying locked Metahub info in Connector edit dialog.
 * Shows the linked Metahub(s) with locked constraint switches.
 *
 * Internally this works with publications, but UI shows Metahub names.
 * Constraints are temporarily locked:
 * - isSinglePublication is always true (one metahub)
 * - isRequiredPublication is always true (metahub required)
 * - Users cannot add/remove metahub links
 */
export const ConnectorPublicationInfoPanel = ({
    availablePublications,
    linkedPublications,
    isLoading = false,
    isSinglePublication = true,
    isRequiredPublication = true,
    disabled = false,
    uiLocale = 'en'
}: ConnectorPublicationInfoPanelProps) => {
    const { t } = useTranslation('applications')

    // Get metahub display name for a publication
    const getMetahubName = (publicationId: string): string => {
        const publication = availablePublications.find((p) => p.id === publicationId)
        if (!publication) return publicationId.substring(0, 8) + '...'
        // Show metahub name, not publication name
        if (publication.metahub) {
            return (
                getVLCString(publication.metahub.name, uiLocale) ||
                getVLCString(publication.metahub.name, 'en') ||
                publication.metahub.codename
            )
        }
        // Fallback to publication name
        return getVLCString(publication.name, uiLocale) || getVLCString(publication.name, 'en') || publication.codename
    }

    const getMetahubCodename = (publicationId: string): string => {
        const publication = availablePublications.find((p) => p.id === publicationId)
        return publication?.metahub?.codename || publication?.codename || ''
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color='text.secondary'>{t('common.loading', 'Loading...')}</Typography>
            </Box>
        )
    }

    return (
        <Stack spacing={2}>
            {/* Info alert about locked settings */}
            <Alert severity='info' icon={<InfoIcon />}>
                {t(
                    'connectors.metahubInfo.locked',
                    'Metahub links and constraints are currently locked. This functionality will be available in a future update.'
                )}
            </Alert>

            {/* Linked metahubs display */}
            <Box
                sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'action.hover'
                }}
            >
                <Stack direction='row' alignItems='center' spacing={1} mb={1}>
                    <Typography variant='subtitle2' color='text.secondary'>
                        {t('connectors.metahubs.title', 'Linked Metahubs')}
                    </Typography>
                    <LockIcon fontSize='small' color='action' />
                </Stack>

                {linkedPublications.length === 0 ? (
                    <Typography color='text.secondary' variant='body2'>
                        {t('connectors.metahubs.noLinked', 'No metahubs linked yet')}
                    </Typography>
                ) : (
                    <List dense disablePadding>
                        {linkedPublications.map((link) => (
                            <ListItem
                                key={link.id}
                                disablePadding
                                sx={{
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    mb: 0.5,
                                    px: 1.5,
                                    py: 0.5
                                }}
                            >
                                <ListItemText
                                    primary={getMetahubName(link.publicationId)}
                                    secondary={
                                        <Chip
                                            label={getMetahubCodename(link.publicationId)}
                                            size='small'
                                            variant='outlined'
                                            sx={{ mt: 0.5 }}
                                        />
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Box>

            {/* Locked constraint switches */}
            <Box
                sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1
                }}
            >
                <Typography variant='subtitle2' color='text.secondary' mb={1.5}>
                    {t('connectors.metahubInfo.constraints', 'Connector Constraints')}
                </Typography>

                <Stack spacing={1}>
                    <Tooltip title={t('connectors.metahubInfo.isSingleLocked', 'This setting is currently locked to "On"')}>
                        <FormControlLabel
                            control={<Switch checked={isSinglePublication} disabled size='small' />}
                            label={
                                <Stack direction='row' alignItems='center' spacing={0.5}>
                                    <Typography variant='body2'>{t('connectors.metahubs.singleLimit', 'Single metahub')}</Typography>
                                    <LockIcon fontSize='inherit' color='action' />
                                </Stack>
                            }
                        />
                    </Tooltip>

                    <Typography variant='caption' color='text.secondary' sx={{ pl: 4.5 }}>
                        {t('connectors.metahubInfo.isSingleHelp', 'Connector can only be linked to one Metahub')}
                    </Typography>

                    <Tooltip title={t('connectors.metahubInfo.isRequiredLocked', 'This setting is currently locked to "On"')}>
                        <FormControlLabel
                            control={<Switch checked={isRequiredPublication} disabled size='small' />}
                            label={
                                <Stack direction='row' alignItems='center' spacing={0.5}>
                                    <Typography variant='body2'>{t('connectors.metahubs.required', 'Required')}</Typography>
                                    <LockIcon fontSize='inherit' color='action' />
                                </Stack>
                            }
                        />
                    </Tooltip>

                    <Typography variant='caption' color='text.secondary' sx={{ pl: 4.5 }}>
                        {t('connectors.metahubInfo.isRequiredHelp', 'Connector must have at least one Metahub linked')}
                    </Typography>
                </Stack>
            </Box>
        </Stack>
    )
}

export default ConnectorPublicationInfoPanel
