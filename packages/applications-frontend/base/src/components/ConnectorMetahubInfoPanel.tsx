import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, Stack, Alert, FormControlLabel, Switch, Tooltip, Chip, List, ListItem, ListItemText } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import InfoIcon from '@mui/icons-material/Info'
import type { ConnectorMetahub, MetahubSummary } from '../types'
import { getVLCString } from '../types'

export interface ConnectorMetahubInfoPanelProps {
    /** List of all available metahubs */
    availableMetahubs: MetahubSummary[]
    /** Currently linked metahub records */
    linkedMetahubs: ConnectorMetahub[]
    /** Loading state */
    isLoading?: boolean
    /** Whether connector is limited to single metahub (always true, locked) */
    isSingleMetahub?: boolean
    /** Whether connector requires at least one metahub (always true, locked) */
    isRequiredMetahub?: boolean
    /** Disable all interactions */
    disabled?: boolean
    /** Current UI locale for display */
    uiLocale?: string
}

/**
 * Panel for displaying locked Metahub info in Connector edit dialog.
 * Shows the linked Metahub(s) with locked constraint switches.
 * 
 * This panel is read-only because constraints are temporarily locked:
 * - isSingleMetahub is always true
 * - isRequiredMetahub is always true
 * - Users cannot add/remove metahub links
 */
export const ConnectorMetahubInfoPanel = ({
    availableMetahubs,
    linkedMetahubs,
    isLoading = false,
    isSingleMetahub = true,
    isRequiredMetahub = true,
    disabled = false,
    uiLocale = 'en'
}: ConnectorMetahubInfoPanelProps) => {
    const { t } = useTranslation('applications')

    // Get display name for a metahub
    const getMetahubName = (metahubId: string): string => {
        const metahub = availableMetahubs.find((m) => m.id === metahubId)
        if (!metahub) return metahubId.substring(0, 8) + '...'
        return getVLCString(metahub.name, uiLocale) || getVLCString(metahub.name, 'en') || metahub.codename
    }

    const getMetahubCodename = (metahubId: string): string => {
        const metahub = availableMetahubs.find((m) => m.id === metahubId)
        return metahub?.codename || ''
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">{t('common.loading', 'Loading...')}</Typography>
            </Box>
        )
    }

    return (
        <Stack spacing={2}>
            {/* Info alert about locked settings */}
            <Alert severity="info" icon={<InfoIcon />}>
                {t('connectors.metahubInfo.locked', 'Metahub links and constraints are currently locked. This functionality will be available in a future update.')}
            </Alert>

            {/* Linked metahubs display */}
            <Box sx={{ 
                p: 2, 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover'
            }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                        {t('connectors.metahubs.title', 'Linked Metahubs')}
                    </Typography>
                    <LockIcon fontSize="small" color="action" />
                </Stack>
                
                {linkedMetahubs.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                        {t('connectors.metahubs.noLinked', 'No metahubs linked yet')}
                    </Typography>
                ) : (
                    <List dense disablePadding>
                        {linkedMetahubs.map((link) => (
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
                                    primary={getMetahubName(link.metahubId)}
                                    secondary={
                                        <Chip 
                                            label={getMetahubCodename(link.metahubId)} 
                                            size="small" 
                                            variant="outlined"
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
            <Box sx={{ 
                p: 2, 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
            }}>
                <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                    {t('connectors.metahubInfo.constraints', 'Connector Constraints')}
                </Typography>

                <Stack spacing={1}>
                    <Tooltip title={t('connectors.metahubInfo.isSingleLocked', 'This setting is currently locked to "On"')}>
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={isSingleMetahub} 
                                    disabled 
                                    size="small"
                                />
                            }
                            label={
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Typography variant="body2">
                                        {t('connectors.metahubs.singleLimit', 'Single metahub')}
                                    </Typography>
                                    <LockIcon fontSize="inherit" color="action" />
                                </Stack>
                            }
                        />
                    </Tooltip>

                    <Typography variant="caption" color="text.secondary" sx={{ pl: 4.5 }}>
                        {t('connectors.metahubInfo.isSingleHelp', 'Connector can only be linked to one Metahub')}
                    </Typography>

                    <Tooltip title={t('connectors.metahubInfo.isRequiredLocked', 'This setting is currently locked to "On"')}>
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={isRequiredMetahub} 
                                    disabled 
                                    size="small"
                                />
                            }
                            label={
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Typography variant="body2">
                                        {t('connectors.metahubs.required', 'Required')}
                                    </Typography>
                                    <LockIcon fontSize="inherit" color="action" />
                                </Stack>
                            }
                        />
                    </Tooltip>

                    <Typography variant="caption" color="text.secondary" sx={{ pl: 4.5 }}>
                        {t('connectors.metahubInfo.isRequiredHelp', 'Connector must have at least one Metahub linked')}
                    </Typography>
                </Stack>
            </Box>
        </Stack>
    )
}

export default ConnectorMetahubInfoPanel
