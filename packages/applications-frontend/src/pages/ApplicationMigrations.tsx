import { useParams } from 'react-router-dom'
import { Box, Stack, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

// project imports
import {
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG,
    PAGE_CONTENT_GUTTER_MX
} from '@universo/template-mui'
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
            <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('migrations.loading', 'Loading migrations...')}
                    </Typography>
                </Stack>
            </MainCard>
        )
    }

    // Error state
    if (isError || !applicationDisplay) {
        const errorMessage = error instanceof Error ? error.message : t('migrations.loadError', 'Failed to load migrations')

        return (
            <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading migrations'
                    title={t('migrations.loadError', 'Failed to load migrations')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600, m: 2 }}>
                    {errorMessage}
                </Alert>
            </MainCard>
        )
    }

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader
                title={t('migrations.title', 'Migration History')}
                description={t('migrations.description', 'Schema changes applied to this application database.')}
                search={false}
            />

            {/* Migrations Tab Content */}
            <Box sx={{ mx: PAGE_CONTENT_GUTTER_MX }}>
                <MigrationsTab applicationId={applicationId!} />
            </Box>
        </MainCard>
    )
}

export default ApplicationMigrations
