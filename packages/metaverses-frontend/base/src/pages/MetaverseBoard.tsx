import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Grid, Button } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'

// project imports
import {
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG,
    StatCard,
    HighlightedCard,
    SessionsChart,
    PageViewsBarChart
} from '@universo/template-mui'

import { useMetaverseDetails } from '../api/useMetaverseDetails'

/**
 * Metaverse Board Page
 *
 * Displays analytics dashboard for a metaverse with:
 * - Real-time statistics (sections, entities, members)
 * - Documentation resources
 * - Activity and resource charts (demo data)
 *
 * Layout:
 * - Desktop: 4 cards in row (3 stats + 1 docs), 2 charts side-by-side
 * - Tablet: 2 cards per row, charts stacked
 * - Mobile: 1 card per row
 */
const MetaverseBoard = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const { t } = useTranslation('metaverses')
    const navigate = useNavigate()

    // Fetch metaverse details with TanStack Query
    const {
        data: metaverse,
        isLoading,
        error,
        isError
    } = useMetaverseDetails(metaverseId || '', {
        enabled: Boolean(metaverseId)
    })

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('board.loading', 'Loading dashboard...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (isError || !metaverse) {
        const errorMessage = error instanceof Error ? error.message : t('board.error', 'Failed to load metaverse data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading metaverse'
                    title={t('board.error', 'Failed to load metaverse data')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    // Success state with dashboard
    // Demo trend data for SparkLineChart (30 data points)
    // TODO: Replace with real historical data when analytics service is ready
    const sectionsData = [
        8, 9, 9, 10, 10, 10, 11, 11, 11, 11, 10, 11, 11, 11, 11, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11
    ]
    // Use current entity count as trend data (shows actual value in chart)
    const entitiesCount = metaverse.entitiesCount ?? 0
    const entitiesData = Array(30).fill(entitiesCount)

    const membersData = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={metaverse.name}
                    description={metaverse.description || t('board.defaultDescription', 'Metaverse analytics and statistics')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                    {t('board.overview', 'Overview')}
                </Typography>
                <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>

                    {/* Sections Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.sections.title')}
                            value={metaverse.sectionsCount ?? 0}
                            interval={t('board.stats.sections.interval')}
                            data={sectionsData}
                        />
                    </Grid>

                    {/* Entities Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.entities.title')}
                            value={metaverse.entitiesCount ?? 0}
                            interval={t('board.stats.entities.interval')}
                            data={entitiesData}
                        />
                    </Grid>

                    {/* Members Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.members.title')}
                            value={metaverse.membersCount ?? 0}
                            interval={t('board.stats.members.interval')}
                            data={membersData}
                        />
                    </Grid>

                    {/* Documentation Banner */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <HighlightedCard
                            icon={<MenuBookRoundedIcon sx={{ mb: 1 }} />}
                            title={t('board.documentation.title')}
                            description={t('board.documentation.description')}
                            buttonText={t('board.documentation.button')}
                            buttonIcon={<OpenInNewIcon />}
                            onButtonClick={() => window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')}
                        />
                    </Grid>

                    {/* Activity Chart (Demo Data) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SessionsChart title={t('board.charts.activity.title')} description={t('board.charts.activity.description')} />
                    </Grid>

                    {/* Resources Chart (Demo Data) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <PageViewsBarChart
                            title={t('board.charts.resources.title')}
                            description={t('board.charts.resources.description')}
                        />
                    </Grid>
                </Grid>

                {/* Back Button */}
                <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/metaverses')}>
                        {t('actions.backToList', 'Back to Metaverses')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default MetaverseBoard
