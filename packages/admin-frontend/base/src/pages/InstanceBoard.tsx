import { useNavigate, useParams } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Grid, Button, Chip } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'
import { resolveLocalizedContent } from '@universo/utils'
import { isValidLocaleCode } from '@universo/types'

// Project imports
import {
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG,
    StatCard,
    HighlightedCard,
    SessionsChart,
    PageViewsBarChart
} from '@universo/template-mui'

import { useInstanceDetails, useInstanceStats } from '../hooks/useInstanceDetails'
import type { Instance } from '../types'

/**
 * Get localized display name for instance
 * Uses VLC resolution with safe fallback
 */
const getInstanceName = (instance: Instance, lang: string): string => {
    const locale = isValidLocaleCode(lang) ? lang : 'en'
    return resolveLocalizedContent(instance.name, locale, instance.codename)
}

/**
 * Instance Board Page
 *
 * Displays analytics dashboard for instance administration with:
 * - Instance info and status
 * - Statistics (total users, global access users)
 * - Documentation resources
 * - Activity charts (demo data)
 */
const InstanceBoard = () => {
    const { t, i18n } = useTranslation('admin')
    const navigate = useNavigate()
    const { instanceId } = useParams<{ instanceId: string }>()

    // Fetch instance details
    const { data: instance, isLoading: instanceLoading, error: instanceError, isError: instanceIsError } = useInstanceDetails(instanceId)

    // Fetch instance stats
    const { data: stats, isLoading: statsLoading, error: statsError, isError: statsIsError } = useInstanceStats(instanceId)

    const isLoading = instanceLoading || statsLoading
    const isError = instanceIsError || statsIsError

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
    if (isError || !instance) {
        const errorMessage =
            instanceError instanceof Error
                ? instanceError.message
                : statsError instanceof Error
                ? statsError.message
                : t('board.error', 'Failed to load dashboard data')

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
                <Box display='flex' justifyContent='center'>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/admin')}>
                        {t('common.back', 'Back')}
                    </Button>
                </Box>
            </Stack>
        )
    }

    // Stats data (with fallbacks for unavailable remote instance stats)
    const totalUsers = stats?.available ? stats.totalUsers ?? 0 : 0
    const globalAccessUsers = stats?.available ? stats.globalAccessUsers ?? 0 : 0

    // Demo trend data for SparkLineChart (30 data points)
    const totalUsersData = Array(30).fill(totalUsers)
    const globalUsersData = Array(30).fill(globalAccessUsers)

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={getInstanceName(instance, i18n.language)}
                    description={
                        resolveLocalizedContent(instance.description, isValidLocaleCode(i18n.language) ? i18n.language : 'en', '') ||
                        t('board.description', 'Instance administration and statistics')
                    }
                    search={false}
                />
                <Stack direction='row' spacing={1} sx={{ mx: { xs: -1.5, md: -2 }, mt: 1 }}>
                    <Chip
                        label={t(`instances.status.${instance.status}`, instance.status)}
                        color={instance.status === 'active' ? 'success' : instance.status === 'maintenance' ? 'warning' : 'error'}
                        size='small'
                    />
                    {instance.is_local && <Chip label={t('instances.local', 'Local')} variant='outlined' size='small' color='primary' />}
                </Stack>
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                    {t('board.overview', 'Overview')}
                </Typography>
                <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>
                    {/* Stats not available warning for remote instances */}
                    {!stats?.available && (
                        <Grid size={{ xs: 12 }}>
                            <Alert severity='info'>
                                {stats?.message || t('board.statsNotAvailable', 'Statistics not available for remote instances in MVP')}
                            </Alert>
                        </Grid>
                    )}

                    {/* Total Users */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.totalUsers.title', 'Total Users')}
                            value={totalUsers}
                            interval={t('board.stats.totalUsers.interval', 'All time')}
                            data={totalUsersData}
                        />
                    </Grid>

                    {/* Superusers */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.superusers.title', 'Superusers')}
                            value={globalAccessUsers}
                            interval={t('board.stats.superusers.interval', 'With global roles')}
                            data={globalUsersData}
                        />
                    </Grid>

                    {/* Roles */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('board.stats.roles.title', 'Roles')}
                            value={stats?.totalRoles ?? 0}
                            interval={t('board.stats.roles.interval', 'System + custom')}
                            data={Array(30).fill(stats?.totalRoles ?? 0)}
                        />
                    </Grid>

                    {/* Documentation Banner */}
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <HighlightedCard
                            icon={<MenuBookRoundedIcon sx={{ mb: 1 }} />}
                            title={t('board.documentation.title', 'Documentation')}
                            description={t('board.documentation.description', 'Learn about administration')}
                            buttonText={t('board.documentation.button', 'Read Docs')}
                            buttonIcon={<OpenInNewIcon />}
                            onButtonClick={() => window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')}
                        />
                    </Grid>

                    {/* Activity Chart (Demo Data) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <SessionsChart
                            title={t('board.charts.activity.title', 'Activity')}
                            description={t('board.charts.activity.description', 'Instance activity over time')}
                        />
                    </Grid>

                    {/* Users Chart (Demo Data) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <PageViewsBarChart
                            title={t('board.charts.users.title', 'Users')}
                            description={t('board.charts.users.description', 'User distribution')}
                        />
                    </Grid>
                </Grid>

                {/* Navigation to Access page */}
                <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                    <Button
                        variant='text'
                        startIcon={<ArrowBackRoundedIcon />}
                        onClick={() => navigate(`/admin/instance/${instanceId}/access`)}
                    >
                        {t('board.manageAccess', 'Manage Access')}
                    </Button>
                </Box>
            </Box>
        </Stack>
    )
}

export default InstanceBoard
