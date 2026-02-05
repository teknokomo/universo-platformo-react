import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import Copyright from '../internals/Copyright'
import ChartUserByCountry from './ChartUserByCountry'
import CustomizedTreeView from './CustomizedTreeView'
import CustomizedDataGrid from './CustomizedDataGrid'
import HighlightedCard from './HighlightedCard'
import PageViewsBarChart from './PageViewsBarChart'
import SessionsChart from './SessionsChart'
import StatCard, { StatCardProps } from './StatCard'
import type { DashboardDetailsSlot, DashboardLayoutConfig } from './runtimeTypes'

const data: StatCardProps[] = [
    {
        title: 'Users',
        value: '14k',
        interval: 'Last 30 days',
        trend: 'up',
        data: [
            200, 24, 220, 260, 240, 380, 100, 240, 280, 240, 300, 340, 320, 360, 340, 380, 360, 400, 380, 420, 400, 640, 340, 460, 440, 480,
            460, 600, 880, 920
        ]
    },
    {
        title: 'Conversions',
        value: '325',
        interval: 'Last 30 days',
        trend: 'down',
        data: [
            1640, 1250, 970, 1130, 1050, 900, 720, 1080, 900, 450, 920, 820, 840, 600, 820, 780, 800, 760, 380, 740, 660, 620, 840, 500,
            520, 480, 400, 360, 300, 220
        ]
    },
    {
        title: 'Event count',
        value: '200k',
        interval: 'Last 30 days',
        trend: 'neutral',
        data: [
            500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510, 530, 520, 410, 530, 520, 610, 530, 520, 610, 530,
            420, 510, 430, 520, 510
        ]
    }
]

export default function MainGrid({ layoutConfig, details }: { layoutConfig?: DashboardLayoutConfig; details?: DashboardDetailsSlot }) {
    const showOverviewTitle = layoutConfig?.showOverviewTitle ?? true
    const showOverviewCards = layoutConfig?.showOverviewCards ?? true
    const showSessionsChart = layoutConfig?.showSessionsChart ?? true
    const showPageViewsChart = layoutConfig?.showPageViewsChart ?? true
    const showDetailsTitle = layoutConfig?.showDetailsTitle ?? true
    const showDetailsTable = layoutConfig?.showDetailsTable ?? true
    const showDetailsSidePanel = layoutConfig?.showDetailsSidePanel ?? true
    const showFooter = layoutConfig?.showFooter ?? true

    const detailsTitle = details?.title ?? 'Details'
    const detailsRows = details?.rows ?? []
    const detailsColumns = details?.columns ?? []

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            {/* cards */}
            {(showOverviewTitle || showOverviewCards || showSessionsChart || showPageViewsChart) && (
                <>
                    {showOverviewTitle && (
                        <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                            Overview
                        </Typography>
                    )}
                    <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>
                        {showOverviewCards && (
                            <>
                                {data.map((card, index) => (
                                    <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                                        <StatCard {...card} />
                                    </Grid>
                                ))}
                                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                    <HighlightedCard
                                        icon={<InsightsRoundedIcon />}
                                        title='Explore your data'
                                        description='Uncover performance and visitor insights with our data wizardry.'
                                        buttonText='Get insights'
                                        buttonIcon={<ChevronRightRoundedIcon />}
                                    />
                                </Grid>
                            </>
                        )}
                        {showSessionsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <SessionsChart />
                            </Grid>
                        )}
                        {showPageViewsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <PageViewsBarChart />
                            </Grid>
                        )}
                    </Grid>
                </>
            )}

            {(showDetailsTitle || showDetailsTable || showDetailsSidePanel) && (
                <>
                    {showDetailsTitle && (
                        <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                            {detailsTitle}
                        </Typography>
                    )}
                    <Grid container spacing={2} columns={12}>
                        {showDetailsTable && (
                            <Grid size={{ xs: 12, lg: 9 }}>
                                <CustomizedDataGrid
                                    rows={detailsRows}
                                    columns={detailsColumns}
                                    loading={details?.loading}
                                    rowCount={details?.rowCount}
                                    paginationModel={details?.paginationModel}
                                    onPaginationModelChange={details?.onPaginationModelChange}
                                    pageSizeOptions={details?.pageSizeOptions}
                                />
                            </Grid>
                        )}
                        {showDetailsSidePanel && (
                            <Grid size={{ xs: 12, lg: 3 }}>
                                <Stack gap={2} direction={{ xs: 'column', sm: 'row', lg: 'column' }}>
                                    <CustomizedTreeView />
                                    <ChartUserByCountry />
                                </Stack>
                            </Grid>
                        )}
                    </Grid>
                </>
            )}

            {showFooter && <Copyright sx={{ my: 4 }} />}
        </Box>
    )
}
