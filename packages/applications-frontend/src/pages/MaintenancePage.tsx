/**
 * Universo Platformo | Maintenance Page
 *
 * Shown to non-privileged users when the application schema is currently
 * being synchronised (schema_status = 'maintenance'). Privileged users
 * (owner, admin) see the regular migration dialog instead.
 */

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import BuildIcon from '@mui/icons-material/Build'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const MaintenancePage = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('applications')

    return (
        <Box
            role='status'
            aria-live='polite'
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
                p: 4
            }}
        >
            <Stack spacing={2} alignItems='center' sx={{ maxWidth: 480, textAlign: 'center' }}>
                <BuildIcon sx={{ fontSize: 64, color: 'warning.main', opacity: 0.7 }} />

                <Typography variant='h5' color='text.primary'>
                    {t('maintenance.title', 'Maintenance in progress')}
                </Typography>

                <Typography variant='body1' color='text.secondary'>
                    {t('maintenance.description', 'The application is currently being updated. Please try again in a few minutes.')}
                </Typography>

                <Stack direction='row' spacing={1} sx={{ pt: 1 }}>
                    {applicationId && (
                        <Button variant='outlined' onClick={() => navigate(`/a/${applicationId}/admin`)}>
                            {t('maintenance.backToApp', 'Back to application')}
                        </Button>
                    )}
                    <Button variant='contained' onClick={() => navigate('/applications')}>
                        {t('maintenance.backToList', 'Back to applications')}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    )
}

export default MaintenancePage
