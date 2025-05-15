// Universo Platformo | Generic component for toggling publication status
import React from 'react'
import { FormControlLabel, Switch, Box, Typography, Paper } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface PublishToggleProps {
    isPublic: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
}

const PublishToggle: React.FC<PublishToggleProps> = ({ isPublic, onChange, disabled = false }) => {
    const { t } = useTranslation('publish')

    return (
        <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant='subtitle1'>{t('configuration.makePublic')}</Typography>
                <Switch checked={isPublic} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
            </Box>

            {isPublic && (
                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                    {t('arPublication.publicLinkAvailable', 'Public link is available')}
                </Typography>
            )}
        </Paper>
    )
}

export default PublishToggle
