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

import { useUnikDetails } from '../api/useUnikDetails'

/**
 * Unik Board Page
 *
 * Displays analytics dashboard for a unik with:
 * - Real-time statistics (spaces, tools, members)
 * - Documentation resources
 * - Activity and resource charts (demo data)
 *
 * Layout:
 * - Desktop: 4 cards in row (3 stats + 1 docs), 2 charts side-by-side
 * - Tablet: 2 cards per row, charts stacked
 * - Mobile: 1 card per row
 */
const UnikBoard = () => {
    const { unikId } = useParams<{ unikId: string }>()
    const { t } = useTranslation('uniks')
    const navigate = useNavigate()

    // Fetch unik details with TanStack Query
    const {
        data: unik,
        isLoading,
        error,
        isError
    } = useUnikDetails(unikId || '', {
        enabled: Boolean(unikId)
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
    if (isError || !unik) {
        const errorMessage = error instanceof Error ? error.message : t('board.error', 'Failed to load unik data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState image={APIEmptySVG} imageAlt='Error loading unik' title={t('board.error', 'Failed to load unik data')} />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    // Success state with dashboard
    // Demo trend data for SparkLineChart (30 data points)
    // TODO: Replace with real historical data when analytics service is ready
    const spacesData = [8, 9, 9, 10, 10, 10, 11, 11, 11, 11, 10, 11, 11, 11, 11, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11]
    // Use current tools count as trend data (shows actual value in chart)
    const toolsCount = unik.toolsCount ?? 0
    const toolsData = Array(30).fill(toolsCount)

    const membersData = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={unik.name}
                    description={unik.description || t('board.defaultDescription', 'Unik analytics and statistics')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Grid container spacing={2} columns={12}>
                    {/* Overview Section */}
                    <Grid item xs={12}>
                        <Typography component='h2' variant='h6'>
                            {t('board.overview', 'Overview')}
                        </Typography>
                    </Grid>

                    {/* Spaces Count */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.spaces.title')}
                            value={unik.spacesCount ?? 0}
                            interval={t('board.stats.spaces.interval')}
                            description={t('board.stats.spaces.description')}
                            data={spacesData}
                        />
                    </Grid>

                    {/* Tools Count */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.tools.title')}
                            value={unik.toolsCount ?? 0}
                            interval={t('board.stats.tools.interval')}
                            description={t('board.stats.tools.description')}
                            data={toolsData}
                        />
                    </Grid>

                    {/* Members Count */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.members.title')}
                            value={unik.membersCount ?? 0}
                            interval={t('board.stats.members.interval')}
                            description={t('board.stats.members.description')}
                            data={membersData}
                        />
                    </Grid>

                    {/* Documentation Banner */}
                    <Grid item xs={12} sm={6} lg={3}>
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
                    <Grid item xs={12} md={6}>
                        <SessionsChart title={t('board.charts.activity.title')} description={t('board.charts.activity.description')} />
                    </Grid>

                    {/* Resources Chart (Demo Data) */}
                    <Grid item xs={12} md={6}>
                        <PageViewsBarChart
                            title={t('board.charts.resources.title')}
                            description={t('board.charts.resources.description')}
                        />
                    </Grid>
                </Grid>

                {/* Back Button */}
                <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/uniks')}>
                        {t('actions.backToList', 'Back to Uniks')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default UnikBoard
