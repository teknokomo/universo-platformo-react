import { useQuery } from '@tanstack/react-query'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { Alert, Box, CircularProgress, Grid, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { HighlightedCard, StatCard, ViewHeaderMUI as ViewHeader, buildRealisticTrendData } from '@universo/template-mui'

import { getMetapanelStats } from '../api/dashboard'

export default function MetapanelDashboard() {
    const { t } = useTranslation('metapanel')
    const { data, isLoading, error } = useQuery({
        queryKey: ['metapanel', 'dashboard-stats'],
        queryFn: getMetapanelStats
    })

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return <Alert severity='error'>{error instanceof Error ? error.message : t('errors.loadFailed')}</Alert>
    }

    if (!data) {
        return null
    }

    const usersSeries = buildRealisticTrendData(data.totalGlobalUsers)
    const applicationsSeries = buildRealisticTrendData(data.totalApplications)
    const metahubsSeries = buildRealisticTrendData(data.totalMetahubs)

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader title={t('title')} search={false} />
            </Box>

            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                    {t('overview')}
                </Typography>
                <Grid container spacing={2} columns={12}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('stats.users.title')}
                            value={data.totalGlobalUsers}
                            interval={t('stats.users.interval')}
                            description={t('stats.users.description')}
                            data={usersSeries}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('stats.applications.title')}
                            value={data.totalApplications}
                            interval={t('stats.applications.interval')}
                            description={t('stats.applications.description')}
                            data={applicationsSeries}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard
                            title={t('stats.metahubs.title')}
                            value={data.totalMetahubs}
                            interval={t('stats.metahubs.interval')}
                            description={t('stats.metahubs.description')}
                            data={metahubsSeries}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <HighlightedCard
                            icon={<MenuBookRoundedIcon sx={{ mb: 1 }} />}
                            title={t('documentation.title')}
                            description={t('documentation.description')}
                            buttonText={t('documentation.button')}
                            buttonIcon={<OpenInNewRoundedIcon />}
                            onButtonClick={() => window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')}
                        />
                    </Grid>
                </Grid>
            </Box>
        </Stack>
    )
}
