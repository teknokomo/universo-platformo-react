import type { GridColDef, GridPaginationModel, GridLocaleText } from '@mui/x-data-grid'
import type {} from '@mui/material/themeCssVarsAugmentation'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import AppNavbar from './components/AppNavbar'
import Header from './components/Header'
import MainGrid from './components/MainGrid'
import SideMenu from './components/SideMenu'
import SideMenuRight from './components/SideMenuRight'
import { DashboardDetailsProvider } from './DashboardDetailsContext'

export interface DashboardLayoutConfig {
    showSideMenu: boolean
    showRightSideMenu?: boolean
    showAppNavbar: boolean
    showHeader: boolean
    showBreadcrumbs?: boolean
    showSearch?: boolean
    showDatePicker?: boolean
    showOptionsMenu?: boolean
    showLanguageSwitcher?: boolean
    showOverviewTitle?: boolean
    showOverviewCards?: boolean
    showSessionsChart?: boolean
    showPageViewsChart?: boolean
    showDetailsTitle?: boolean
    showDetailsTable?: boolean
    showColumnsContainer?: boolean
    showProductTree?: boolean
    showUsersByCountryChart?: boolean
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
    /** Optional toolbar actions (e.g. Create button) rendered next to the title. */
    actions?: React.ReactNode
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
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
    isActive?: boolean
}

export interface ZoneWidgets {
    left: ZoneWidgetItem[]
    right?: ZoneWidgetItem[]
    center?: ZoneWidgetItem[]
}

export interface DashboardProps {
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

const EMPTY_RIGHT_WIDGETS: ZoneWidgetItem[] = []
const EMPTY_CENTER_WIDGETS: ZoneWidgetItem[] = []

export default function Dashboard(props: DashboardProps) {
    const layout = { ...DEFAULT_LAYOUT, ...(props.layoutConfig ?? {}) }
    const rightWidgets = props.zoneWidgets?.right ?? EMPTY_RIGHT_WIDGETS
    const centerWidgets = props.zoneWidgets?.center ?? EMPTY_CENTER_WIDGETS
    const showRightSideMenu = (layout.showRightSideMenu ?? true) && rightWidgets.length > 0

    return (
        <DashboardDetailsProvider value={props.details}>
            <Box sx={{ display: 'flex' }}>
                {layout.showSideMenu && <SideMenu menu={props.menu} menus={props.menus} zoneWidgets={props.zoneWidgets} />}
                {layout.showAppNavbar && <AppNavbar menu={props.menu} menus={props.menus} rightWidgets={rightWidgets} />}
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
                        <MainGrid layoutConfig={props.layoutConfig} centerWidgets={centerWidgets} />
                    </Stack>
                </Box>
                {showRightSideMenu && <SideMenuRight widgets={rightWidgets} menu={props.menu} menus={props.menus} />}
            </Box>
        </DashboardDetailsProvider>
    )
}
