import { useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Grid, Button } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

// Project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG, StatCard, HighlightedCard, SessionsChart, PageViewsBarChart } from '@universo/template-mui'

import apiClient from '../api/apiClient'
import { createAdminApi } from '../api/adminApi'
import { adminQueryKeys } from '../api/queryKeys'

// Singleton instance of adminApi
const adminApi = createAdminApi(apiClient)

/**
 * Admin Board Page
 *
 * Displays analytics dashboard for global administration with:
 * - Statistics (total global users, superadmins, supermoderators)
 * - Documentation resources
 * - Activity charts (demo data)
 *
 * Layout:
 * - Desktop: 4 cards in row (3 stats + 1 docs), 2 charts side-by-side
 * - Tablet: 2 cards per row, charts stacked
 * - Mobile: 1 card per row
 */
const AdminBoard = () => {
    const { t } = useTranslation('admin')
    const navigate = useNavigate()

    // Fetch admin statistics
    const { data: stats, isLoading, error, isError } = useQuery({
        queryKey: adminQueryKeys.stats(),
        queryFn: () => adminApi.getStats()
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
    if (isError || !stats) {
        const errorMessage = error instanceof Error ? error.message : t('board.error', 'Failed to load dashboard data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState image={APIEmptySVG} imageAlt='Error loading dashboard' title={t('board.error', 'Failed to load dashboard data')} />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    // Demo trend data for SparkLineChart (30 data points)
    const totalUsersData = Array(30).fill(stats.totalGlobalUsers)
    const superadminsData = Array(30).fill(stats.superadmins)
    const supermoderatorsData = Array(30).fill(stats.supermoderators)

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={t('board.title', 'Administration Dashboard')}
                    description={t('board.description', 'Global platform administration and statistics')}
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

                    {/* Total Global Users */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.totalUsers.title', 'Total Global Users')}
                            value={stats.totalGlobalUsers}
                            interval={t('board.stats.totalUsers.interval', 'All time')}
                            description={t('board.stats.totalUsers.description', 'Users with global access')}
                            data={totalUsersData}
                        />
                    </Grid>

                    {/* Superadmins Count */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.superadmins.title', 'Superadmins')}
                            value={stats.superadmins}
                            interval={t('board.stats.superadmins.interval', 'Full access')}
                            description={t('board.stats.superadmins.description', 'Can manage all global users')}
                            data={superadminsData}
                        />
                    </Grid>

                    {/* Supermoderators Count */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <StatCard
                            title={t('board.stats.supermoderators.title', 'Supermoderators')}
                            value={stats.supermoderators}
                            interval={t('board.stats.supermoderators.interval', 'View access')}
                            description={t('board.stats.supermoderators.description', 'Can view global users')}
                            data={supermoderatorsData}
                        />
                    </Grid>

                    {/* Documentation Banner */}
                    <Grid item xs={12} sm={6} lg={3}>
                        <HighlightedCard
                            icon={<MenuBookRoundedIcon sx={{ mb: 1 }} />}
                            title={t('board.documentation.title', 'Documentation')}
                            description={t('board.documentation.description', 'Learn about global administration')}
                            buttonText={t('board.documentation.button', 'Read Docs')}
                            buttonIcon={<OpenInNewIcon />}
                            onButtonClick={() => window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')}
                        />
                    </Grid>

                    {/* Activity Chart (Demo Data) */}
                    <Grid item xs={12} md={6}>
                        <SessionsChart title={t('board.charts.activity.title', 'Activity')} description={t('board.charts.activity.description', 'Platform activity over time')} />
                    </Grid>

                    {/* Global Users Chart (Demo Data) */}
                    <Grid item xs={12} md={6}>
                        <PageViewsBarChart
                            title={t('board.charts.users.title', 'Global Users')}
                            description={t('board.charts.users.description', 'Distribution of global roles')}
                        />
                    </Grid>
                </Grid>

                {/* Navigation to Access page */}
                <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/admin/access')}>
                        {t('board.manageAccess', 'Manage Global Access')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default AdminBoard
