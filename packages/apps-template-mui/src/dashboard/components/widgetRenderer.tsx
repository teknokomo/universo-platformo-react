import type { ReactNode } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ColumnsContainerConfig } from '@universo/types'
import SelectContent from './SelectContent'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import OptionsMenu from './OptionsMenu'
import CustomizedTreeView from './CustomizedTreeView'
import ChartUserByCountry from './ChartUserByCountry'
import CustomizedDataGrid from './CustomizedDataGrid'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgetItem } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'

/**
 * Resolve the correct menu for a menuWidget using a 2-level fallback:
 * 1. widget.id → menus map lookup (direct widget ID match)
 * 2. Legacy single `menu` prop
 */
export function resolveMenuForWidget(
    widget: ZoneWidgetItem,
    menus?: DashboardMenusMap,
    fallbackMenu?: DashboardMenuSlot
): DashboardMenuSlot | undefined {
    if (menus?.[widget.id]) {
        return menus[widget.id]
    }
    return fallbackMenu
}

/**
 * Maximum nesting depth for columnsContainer widgets to prevent infinite recursion.
 * A columnsContainer inside another columnsContainer is blocked at render time.
 */
const MAX_CONTAINER_DEPTH = 1

/** Stable empty config reference to avoid re-renders when creating virtual ZoneWidgetItem objects. */
const EMPTY_WIDGET_CONFIG: Record<string, unknown> = Object.freeze({})

/**
 * Inner component for detailsTable widget that consumes DashboardDetailsContext.
 * Must be a proper React component (not a plain function) to use hooks.
 */
function DetailsTableWidget() {
    const details = useDashboardDetails()
    if (!details) return null
    return (
        <CustomizedDataGrid
            rows={details.rows}
            columns={details.columns}
            loading={details.loading}
            rowCount={details.rowCount}
            paginationModel={details.paginationModel}
            onPaginationModelChange={details.onPaginationModelChange}
            pageSizeOptions={details.pageSizeOptions}
            localeText={details.localeText}
        />
    )
}

/**
 * Shared widget renderer used by both left and right sidebars.
 * Maps widget keys to concrete React components.
 *
 * @param depth - Current nesting depth for columnsContainer (0 = top level). Used internally for recursion guard.
 */
export function renderWidget(widget: ZoneWidgetItem, menus?: DashboardMenusMap, fallbackMenu?: DashboardMenuSlot, depth = 0): ReactNode {
    switch (widget.widgetKey) {
        case 'brandSelector':
            return (
                <Box key={widget.id} sx={{ display: 'flex', p: 1.5 }}>
                    <SelectContent />
                </Box>
            )
        case 'divider':
            return <Divider key={widget.id} />
        case 'menuWidget': {
            const resolved = resolveMenuForWidget(widget, menus, fallbackMenu)
            return <MenuContent key={widget.id} menu={resolved} />
        }
        case 'spacer':
            return <Box key={widget.id} sx={{ flexGrow: 1 }} />
        case 'infoCard':
            return <CardAlert key={widget.id} />
        case 'userProfile':
            return (
                <Stack
                    key={widget.id}
                    direction='row'
                    sx={{
                        p: 2,
                        gap: 1,
                        alignItems: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Avatar sizes='small' alt='Riley Carter' src='/static/images/avatar/7.jpg' sx={{ width: 36, height: 36 }} />
                    <Box sx={{ mr: 'auto' }}>
                        <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px' }}>
                            Riley Carter
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                            riley@email.com
                        </Typography>
                    </Box>
                    <OptionsMenu />
                </Stack>
            )
        case 'productTree':
            return <CustomizedTreeView key={widget.id} />
        case 'usersByCountryChart':
            return <ChartUserByCountry key={widget.id} />
        case 'detailsTable':
            return <DetailsTableWidget key={widget.id} />
        case 'columnsContainer': {
            // Guard against infinite recursion if a columnsContainer nests another
            if (depth >= MAX_CONTAINER_DEPTH) return null
            const colConfig = widget.config as unknown as ColumnsContainerConfig | undefined
            if (!colConfig?.columns || !Array.isArray(colConfig.columns) || colConfig.columns.length === 0) return null
            return (
                <Grid key={widget.id} container spacing={2} sx={{ width: '100%' }}>
                    {colConfig.columns.map((col) => (
                        <Grid key={col.id} size={{ xs: 12, md: col.width }}>
                            {(col.widgets ?? []).map((w, wIdx) => {
                                const inner: ZoneWidgetItem = {
                                    id: `${col.id}-w${wIdx}`,
                                    widgetKey: w.widgetKey,
                                    sortOrder: wIdx,
                                    config: EMPTY_WIDGET_CONFIG
                                }
                                return (
                                    <Box key={inner.id} sx={wIdx > 0 ? { mt: 2 } : undefined}>
                                        {renderWidget(inner, menus, fallbackMenu, depth + 1)}
                                    </Box>
                                )
                            })}
                        </Grid>
                    ))}
                </Grid>
            )
        }
        default:
            return null
    }
}
