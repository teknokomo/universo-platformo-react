import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Copyright from '../internals/components/Copyright'
import CustomizedDataGrid from './CustomizedDataGrid'
import HighlightedCard from './HighlightedCard'
import PageViewsBarChart from './PageViewsBarChart'
import SessionsChart from './SessionsChart'
import StatCard, { StatCardProps } from './StatCard'
import type { ZoneWidgetItem } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { renderWidget } from './widgetRenderer'

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

export interface MainGridLayoutConfig {
    showOverviewTitle?: boolean
    showOverviewCards?: boolean
    showSessionsChart?: boolean
    showPageViewsChart?: boolean
    showDetailsTitle?: boolean
    /**
     * Show standalone DataGrid in the center zone.
     * When a `columnsContainer` widget is present, the details table is rendered
     * inside the container's column instead, so this flag is `false` for layouts
     * that use `columnsContainer`.
     */
    showDetailsTable?: boolean
    showColumnsContainer?: boolean
    showFooter?: boolean
}

export default function MainGrid({
    layoutConfig,
    centerWidgets
}: {
    layoutConfig?: MainGridLayoutConfig
    centerWidgets?: ZoneWidgetItem[]
}) {
    const details = useDashboardDetails()
    const showOverviewTitle = layoutConfig?.showOverviewTitle ?? true
    const showOverviewCards = layoutConfig?.showOverviewCards ?? true
    const showSessionsChart = layoutConfig?.showSessionsChart ?? true
    const showPageViewsChart = layoutConfig?.showPageViewsChart ?? true
    const showDetailsTitle = layoutConfig?.showDetailsTitle ?? true
    const showDetailsTable = layoutConfig?.showDetailsTable ?? true
    const showColumnsContainer = layoutConfig?.showColumnsContainer ?? false
    const showFooter = layoutConfig?.showFooter ?? true

    const detailsTitle = details?.title ?? 'Details'

    // Find all columnsContainer widgets in center zone (data-driven rendering, supports multiple)
    const columnsContainerWidgets = showColumnsContainer ? centerWidgets?.filter((w) => w.widgetKey === 'columnsContainer') ?? [] : []

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            {/* Overview section — boolean-driven */}
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
                                    <HighlightedCard />
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

            {/* Details section */}
            {(showDetailsTitle || showColumnsContainer || showDetailsTable) && (
                <>
                    {showDetailsTitle && (
                        <Typography component='h2' variant='h6' sx={{ mb: 1 }}>
                            {detailsTitle}
                        </Typography>
                    )}
                    {details?.actions && <Box sx={{ mb: 2 }}>{details.actions}</Box>}
                    {!details?.actions && showDetailsTitle && <Box sx={{ mb: 1 }} />}

                    {/* Data-driven: columnsContainer(s) from center zone widgets */}
                    {columnsContainerWidgets.length > 0
                        ? columnsContainerWidgets.map((w) => <Box key={w.id}>{renderWidget(w)}</Box>)
                        : showDetailsTable && (
                              <CustomizedDataGrid
                                  rows={details?.rows ?? []}
                                  columns={details?.columns ?? []}
                                  loading={details?.loading}
                                  rowCount={details?.rowCount}
                                  paginationModel={details?.paginationModel}
                                  onPaginationModelChange={details?.onPaginationModelChange}
                                  pageSizeOptions={details?.pageSizeOptions}
                                  localeText={details?.localeText}
                              />
                          )}
                </>
            )}

            {showFooter && <Copyright sx={{ my: 4 }} />}
        </Box>
    )
}
