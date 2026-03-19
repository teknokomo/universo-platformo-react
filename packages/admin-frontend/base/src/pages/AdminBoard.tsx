import { useNavigate } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Grid, Button, Chip } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

// Project imports
import {
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG,
    StatCard,
    HighlightedCard,
    buildRealisticTrendData
} from '@universo/template-mui'

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
    const {
        data: stats,
        isLoading,
        error,
        isError
    } = useQuery({
        queryKey: adminQueryKeys.dashboardStats(),
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
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading dashboard'
                    title={t('board.error', 'Failed to load dashboard data')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    const totalUsersData = buildRealisticTrendData(stats.totalGlobalUsers)
    const rolesData = buildRealisticTrendData(stats.totalRoles)
    const applicationsData = buildRealisticTrendData(stats.totalApplications)
    const metahubsData = buildRealisticTrendData(stats.totalMetahubs)

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
                <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                    {t('board.overview', 'Overview')}
                </Typography>
                <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>
                    {/* Total Global Users */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.totalUsers.title', 'Total Global Users')}
                            value={stats.totalGlobalUsers}
                            interval={t('board.stats.totalUsers.interval', 'All time')}
                            data={totalUsersData}
                        />
                    </Grid>

                    {/* Roles Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.roles.title', 'Roles')}
                            value={stats.totalRoles}
                            interval={t('board.stats.roles.interval', 'System + custom')}
                            data={rolesData}
                        />
                    </Grid>

                    {/* Applications Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.totalApplications.title', 'Applications')}
                            value={stats.totalApplications}
                            interval={t('board.stats.totalApplications.interval', 'Published + draft')}
                            data={applicationsData}
                        />
                    </Grid>

                    {/* Metahubs Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.totalMetahubs.title', 'Metahubs')}
                            value={stats.totalMetahubs}
                            interval={t('board.stats.totalMetahubs.interval', 'All metahubs')}
                            data={metahubsData}
                        />
                    </Grid>

                    {/* Documentation Banner */}
                    <Grid size={{ xs: 12, lg: 6 }}>
                        <HighlightedCard
                            icon={<MenuBookRoundedIcon sx={{ mb: 1 }} />}
                            title={t('board.documentation.title', 'Documentation')}
                            description={t('board.documentation.description', 'Learn about global administration')}
                            buttonText={t('board.documentation.button', 'Read Docs')}
                            buttonIcon={<OpenInNewIcon />}
                            onButtonClick={() => window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6 }}>
                        <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: '100%' }}>
                            <Typography variant='h6' sx={{ mb: 1.5 }}>
                                {t('board.roleBreakdown.title', 'Role distribution')}
                            </Typography>
                            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                                {t('board.roleBreakdown.description', 'Current active global roles across the platform.')}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {Object.entries(stats.byRole).length > 0 ? (
                                    Object.entries(stats.byRole).map(([codename, count]) => (
                                        <Chip key={codename} label={`${codename}: ${count}`} variant='outlined' />
                                    ))
                                ) : (
                                    <Chip label={t('board.roleBreakdown.empty', 'No global roles assigned')} variant='outlined' />
                                )}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>

                {/* Navigation to Access page */}
                <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/admin')}>
                        {t('board.manageAccess', 'Open administration')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default AdminBoard
