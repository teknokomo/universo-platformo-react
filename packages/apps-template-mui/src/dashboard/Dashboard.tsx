import type {} from '@mui/x-date-pickers/themeAugmentation'
import type {} from '@mui/x-charts/themeAugmentation'
import type {} from '@mui/x-data-grid/themeAugmentation'
import type {} from '@mui/x-tree-view/themeAugmentation'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { alpha } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import AppNavbar from './components/AppNavbar'
import Header from './components/Header'
import MainGrid from './components/MainGrid'
import SideMenu from './components/SideMenu'
import AppTheme from '../shared-theme/AppTheme'
import { chartsCustomizations, dataGridCustomizations, datePickersCustomizations, treeViewCustomizations } from './theme/customizations'

const xThemeComponents = {
    ...chartsCustomizations,
    ...dataGridCustomizations,
    ...datePickersCustomizations,
    ...treeViewCustomizations
}

export interface DashboardLayoutConfig {
    showSideMenu: boolean
    showAppNavbar: boolean
    showHeader: boolean
    showBreadcrumbs?: boolean
    showSearch?: boolean
    showDatePicker?: boolean
    showOptionsMenu?: boolean
    showOverviewTitle?: boolean
    showOverviewCards?: boolean
    showSessionsChart?: boolean
    showPageViewsChart?: boolean
    showDetailsTitle?: boolean
    showDetailsTable?: boolean
    showDetailsSidePanel?: boolean
    showFooter?: boolean
}

export interface DashboardDetailsSlot {
    title: string
    rows: Array<Record<string, unknown> & { id: string }>
    columns: GridColDef[]
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    pageSizeOptions?: number[]
}

export interface DashboardMenuItem {
    id: string
    label: string
    icon?: string | null
    kind: 'catalog' | 'link'
    catalogId?: string | null
    href?: string | null
    selected?: boolean
}

export interface DashboardMenuSlot {
    title?: string | null
    showTitle?: boolean
    items: DashboardMenuItem[]
    activeCatalogId?: string | null
    onSelectCatalog?: (catalogId: string) => void
}

/** Map of menus keyed by widget ID. Each menuWidget resolves its menu via widget.id lookup. */
export type DashboardMenusMap = { [widgetId: string]: DashboardMenuSlot }

export interface ZoneWidgetItem {
    id: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
}

export interface ZoneWidgets {
    left: ZoneWidgetItem[]
}

export interface DashboardProps {
    disableCustomTheme?: boolean
    layoutConfig?: DashboardLayoutConfig
    zoneWidgets?: ZoneWidgets
    details?: DashboardDetailsSlot
    /** @deprecated Use `menus` map instead. Kept for backward compatibility. */
    menu?: DashboardMenuSlot
    /** Map of menus by widget ID. Each menuWidget resolves its menu via widget.id. */
    menus?: DashboardMenusMap
}

const DEFAULT_LAYOUT: DashboardLayoutConfig = {
    showSideMenu: true,
    showAppNavbar: true,
    showHeader: true
}

export default function Dashboard(props: DashboardProps) {
    const layout = { ...DEFAULT_LAYOUT, ...(props.layoutConfig ?? {}) }
    return (
        <AppTheme {...props} themeComponents={xThemeComponents}>
            <CssBaseline enableColorScheme />
            <Box sx={{ display: 'flex' }}>
                {layout.showSideMenu && <SideMenu menu={props.menu} menus={props.menus} zoneWidgets={props.zoneWidgets} />}
                {layout.showAppNavbar && <AppNavbar menu={props.menu} menus={props.menus} />}
                {/* Main content */}
                <Box
                    component='main'
                    sx={(theme) => ({
                        flexGrow: 1,
                        backgroundColor: theme.vars
                            ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                            : alpha(theme.palette.background.default, 1),
                        overflow: 'auto'
                    })}
                >
                    <Stack
                        spacing={2}
                        sx={{
                            alignItems: 'center',
                            mx: 3,
                            pb: 5,
                            mt: { xs: 8, md: 0 }
                        }}
                    >
                        {layout.showHeader && <Header layoutConfig={props.layoutConfig} />}
                        <MainGrid layoutConfig={props.layoutConfig} details={props.details} />
                    </Stack>
                </Box>
            </Box>
        </AppTheme>
    )
}
