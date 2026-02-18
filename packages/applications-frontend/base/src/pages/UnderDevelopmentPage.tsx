/**
 * Universo Platformo | Under Development Page
 *
 * Friendly placeholder shown when a section is not yet available,
 * for example when the application schema has not been created yet
 * or a feature route is not implemented.
 */

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ConstructionIcon from '@mui/icons-material/Construction'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const UnderDevelopmentPage = () => {
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
                <ConstructionIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />

                <Typography variant='h5' color='text.primary'>
                    {t('underDevelopment.title', 'Section under development')}
                </Typography>

                <Typography variant='body1' color='text.secondary'>
                    {t(
                        'underDevelopment.description',
                        'This section is not available yet. We are working on it and it will be ready soon.'
                    )}
                </Typography>

                <Stack direction='row' spacing={1} sx={{ pt: 1 }}>
                    {applicationId && (
                        <Button variant='outlined' onClick={() => navigate(`/a/${applicationId}/admin`)}>
                            {t('underDevelopment.backToApp', 'Back to application')}
                        </Button>
                    )}
                    <Button variant='contained' onClick={() => navigate('/applications')}>
                        {t('underDevelopment.backToList', 'Back to applications')}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    )
}

export default UnderDevelopmentPage
