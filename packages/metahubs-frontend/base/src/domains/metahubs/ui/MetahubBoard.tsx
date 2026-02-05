import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Button, Grid } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

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

import { useMetahubDetails } from '../hooks/useMetahubDetails'
import { toMetahubDisplay } from '../../../types'
import { getMetahubBoardSummary } from '../api/metahubs'

/**
 * Metahub Board Page
 *
 * Displays analytics dashboard for a metahub with:
 * - Real-time statistics (hubs, catalogs, members)
 * - Documentation resources
 * - Activity and resource charts (demo data)
 *
 * Layout:
 * - Desktop: 4 cards in row (3 stats + 1 docs), 2 charts side-by-side
 * - Tablet: 2 cards per row, charts stacked
 * - Mobile: 1 card per row
 */
const MetahubBoard = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation('metahubs')
    const navigate = useNavigate()

    // Fetch metahub details with TanStack Query
    const {
        data: metahub,
        isLoading: isMetahubLoading,
        error: metahubError,
        isError: isMetahubError
    } = useMetahubDetails(metahubId || '', {
        enabled: Boolean(metahubId)
    })

    const {
        data: boardSummary,
        isLoading: isSummaryLoading,
        isError: isSummaryError,
        error: summaryError
    } = useQuery({
        queryKey: ['metahub-board-summary', metahubId],
        queryFn: () => getMetahubBoardSummary(metahubId || ''),
        enabled: Boolean(metahubId)
    })

    // Convert to display format (VLC -> string)
    const metahubDisplay = metahub ? toMetahubDisplay(metahub, i18n.language) : null

    // Loading state
    if (isMetahubLoading || isSummaryLoading) {
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
    if (isMetahubError || isSummaryError || !metahubDisplay) {
        const errorMessage =
            metahubError instanceof Error
                ? metahubError.message
                : summaryError instanceof Error
                    ? summaryError.message
                    : t('board.error', 'Failed to load metahub data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading metahub'
                    title={t('board.error', 'Failed to load metahub data')}
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
    const hubsCount = boardSummary?.hubsCount ?? 0
    const catalogsCount = boardSummary?.catalogsCount ?? 0
    const membersCount = boardSummary?.membersCount ?? 0
    const branchesCount = boardSummary?.branchesCount ?? 0
    const applicationsCount = boardSummary?.applicationsCount ?? 0
    const publicationsCount = boardSummary?.publicationsCount ?? 0
    const versionsCount = boardSummary?.publicationVersionsCount ?? 0

    const hubsData = Array(30).fill(hubsCount)
    const catalogsData = Array(30).fill(catalogsCount)
    const membersData = Array(30).fill(membersCount)
    const branchesData = Array(30).fill(branchesCount)
    const applicationsData = Array(30).fill(applicationsCount)
    const publicationsData = Array(30).fill(publicationsCount)
    const versionsData = Array(30).fill(versionsCount)

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={metahubDisplay.name}
                    description={metahubDisplay.description || t('board.defaultDescription', 'Metahub analytics and statistics')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                    {t('board.overview', 'Overview')}
                </Typography>
                <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>

                    {/* Branches Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.branches.title')}
                            value={branchesCount}
                            interval={t('board.stats.branches.interval')}
                            data={branchesData}
                        />
                    </Grid>

                    {/* Applications Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.applications.title')}
                            value={applicationsCount}
                            interval={t('board.stats.applications.interval')}
                            data={applicationsData}
                        />
                    </Grid>

                    {/* Members Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.members.title')}
                            value={metahubDisplay.membersCount ?? 0}
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

                    {/* Second row: Hubs */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.hubs.title')}
                            value={hubsCount}
                            interval={t('board.stats.hubs.interval')}
                            data={hubsData}
                        />
                    </Grid>

                    {/* Second row: Catalogs */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.catalogs.title')}
                            value={catalogsCount}
                            interval={t('board.stats.catalogs.interval')}
                            data={catalogsData}
                        />
                    </Grid>

                    {/* Second row: Publications */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.publications.title')}
                            value={publicationsCount}
                            interval={t('board.stats.publications.interval')}
                            data={publicationsData}
                        />
                    </Grid>

                    {/* Second row: Publication Versions */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.versions.title')}
                            value={versionsCount}
                            interval={t('board.stats.versions.interval')}
                            data={versionsData}
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
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/metahubs')}>
                        {t('actions.backToList', 'Back to Metahubs')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default MetahubBoard
