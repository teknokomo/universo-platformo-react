import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { useTranslation } from 'react-i18next'
import { renderWidget } from './widgetRenderer'
import PageBlocksView from './PageBlocksView'
import { rootPlacements, type RuntimePlacement } from '../runtime/widgetPlacementGraph'
import { useDashboardDetails } from '../DashboardDetailsContext'

export interface MainGridProps {
    placements: readonly RuntimePlacement[]
    fullWidth?: boolean
}

const getWidgetGridSize = (widgetKey: string) => (widgetKey === 'sessionsChart' || widgetKey === 'pageViewsChart' ? 6 : 12)

export default function MainGrid({ placements, fullWidth = false }: MainGridProps) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const roots = rootPlacements(placements, 'center')
    const bottomRoots = rootPlacements(placements, 'bottom')
    const hostContent =
        details?.content ??
        (details?.pageBlocks?.length ? (
            <PageBlocksView
                blocks={details.pageBlocks}
                showOutline={details.pagePlayer?.showOutline}
                showProgressHeader={details.pagePlayer?.showProgressHeader}
                completeButtonMode={details.pagePlayer?.completeButtonMode}
                progressStorageKey={details.pagePlayer?.progressStorageKey}
                onProgressChange={details.pagePlayer?.onProgressChange}
            />
        ) : null)
    const banner = details?.banner

    return (
        <Box
            data-testid='runtime-main-grid'
            sx={{
                minWidth: 0,
                width: '100%',
                maxWidth: fullWidth ? '100%' : { xs: '100%', sm: '100%', md: '1700px' },
                overflowX: 'hidden'
            }}
        >
            {banner ? <Box sx={{ mb: 2 }}>{banner}</Box> : null}
            {hostContent ? <Box data-testid='dashboard-host-content'>{hostContent}</Box> : null}
            {roots.length === 0 && !hostContent ? (
                <Alert severity='info' role='status'>
                    {t('dashboard.empty', 'No dashboard content is available yet.')}
                </Alert>
            ) : null}
            <Grid container spacing={2} columns={12} sx={{ minWidth: 0 }}>
                {roots.map((widget) => (
                    <Grid key={widget.id} size={{ xs: 12, md: getWidgetGridSize(widget.widgetKey) }} sx={{ minWidth: 0 }}>
                        {renderWidget(widget, { placements })}
                    </Grid>
                ))}
            </Grid>
            {bottomRoots.map((widget) => (
                <Box key={widget.id} data-testid={`bottom-zone-widget-${widget.widgetKey}`} sx={{ width: '100%', minWidth: 0 }}>
                    {renderWidget(widget, { placements })}
                </Box>
            ))}
        </Box>
    )
}
