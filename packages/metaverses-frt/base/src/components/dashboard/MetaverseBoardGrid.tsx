import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Metaverse } from '../../types'
import { StatCard, HighlightedCard, SessionsChart, PageViewsBarChart } from './index'

interface MetaverseBoardGridProps {
    /**
     * Metaverse data with statistics
     */
    metaverse: Metaverse
}

/**
 * Grid layout for Metaverse dashboard
 *
 * Displays:
 * - 3 StatCards with real metrics (sections/entities/members)
 * - 1 HighlightedCard with documentation link
 * - 2 charts with demo data (activity/resources)
 *
 * Layout:
 * - Desktop: 4 cards in row (3 stats + 1 docs), 2 charts side-by-side
 * - Tablet: 2 cards per row, charts stacked
 * - Mobile: 1 card per row
 */
export default function MetaverseBoardGrid({ metaverse }: MetaverseBoardGridProps) {
    const { t } = useTranslation('metaverses')
    const navigate = useNavigate()

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
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Grid container spacing={2} columns={12}>
                {/* Overview Section */}
                <Grid item xs={12}>
                    <Typography component='h2' variant='h6'>
                        {t('board.overview', 'Overview')}
                    </Typography>
                </Grid>
                {/* Sections Count */}
                <Grid item xs={12} sm={6} lg={3}>
                    <StatCard
                        title={t('board.stats.sections.title')}
                        value={metaverse.sectionsCount ?? 0}
                        interval={t('board.stats.sections.interval')}
                        description={t('board.stats.sections.description')}
                        data={sectionsData}
                    />
                </Grid>

                {/* Entities Count */}
                <Grid item xs={12} sm={6} lg={3}>
                    <StatCard
                        title={t('board.stats.entities.title')}
                        value={metaverse.entitiesCount ?? 0}
                        interval={t('board.stats.entities.interval')}
                        description={t('board.stats.entities.description')}
                        data={entitiesData}
                    />
                </Grid>

                {/* Members Count */}
                <Grid item xs={12} sm={6} lg={3}>
                    <StatCard
                        title={t('board.stats.members.title')}
                        value={metaverse.membersCount ?? 0}
                        interval={t('board.stats.members.interval')}
                        description={t('board.stats.members.description')}
                        data={membersData}
                    />
                </Grid>

                {/* Documentation Banner */}
                <Grid item xs={12} sm={6} lg={3}>
                    <HighlightedCard />
                </Grid>

                {/* Activity Chart (Demo Data) */}
                <Grid item xs={12} md={6}>
                    <SessionsChart />
                </Grid>

                {/* Resources Chart (Demo Data) */}
                <Grid item xs={12} md={6}>
                    <PageViewsBarChart />
                </Grid>
            </Grid>

            {/* Back Button */}
            <Box display='flex' justifyContent='center' sx={{ mt: 2 }}>
                <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/metaverses')}>
                    {t('actions.backToList', 'Back to Metaverses')}
                </Button>
            </Box>
        </Box>
    )
}
