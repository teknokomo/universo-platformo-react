import { useParams } from 'react-router-dom'
import { Box, Stack, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

// project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG } from '@universo/template-mui'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { toApplicationDisplay } from '../types'
import { MigrationsTab } from '../components'

/**
 * Application Migrations Page
 *
 * Displays the migration history for an application's schema.
 * Allows viewing applied migrations and rolling back to previous states.
 */
const ApplicationMigrations = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')

    // Fetch application details with TanStack Query
    const {
        data: application,
        isLoading,
        error,
        isError
    } = useApplicationDetails(applicationId || '', {
        enabled: Boolean(applicationId)
    })

    // Convert to display format (VLC -> string)
    const applicationDisplay = application ? toApplicationDisplay(application, i18n.language) : null

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('migrations.loading', 'Loading migrations...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (isError || !applicationDisplay) {
        const errorMessage = error instanceof Error ? error.message : t('migrations.loadError', 'Failed to load migrations')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading migrations'
                    title={t('migrations.loadError', 'Failed to load migrations')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={t('migrations.title', 'Migration History')}
                    description={t('migrations.description', 'Schema changes applied to this application database.')}
                    search={false}
                />
            </Box>

            {/* Migrations Tab Content */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <MigrationsTab applicationId={applicationId!} />
            </Box>
        </Stack>
    )
}

export default ApplicationMigrations
