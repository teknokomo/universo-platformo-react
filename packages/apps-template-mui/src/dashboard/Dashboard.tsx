import type { GridColDef, GridFilterModel, GridPaginationModel, GridLocaleText, GridSortModel } from '@mui/x-data-grid'
import type {} from '@mui/material/themeCssVarsAugmentation'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useMemo } from 'react'
import { defaultDashboardLayoutConfig, type DashboardLayoutConfig, type RuntimePageBlock } from '@universo/types'
import AppNavbar from './components/AppNavbar'
import Header from './components/Header'
import MainGrid from './components/MainGrid'
import SideMenu from './components/SideMenu'
import SideMenuRight from './components/SideMenuRight'
import { DashboardDetailsProvider } from './DashboardDetailsContext'

export type { DashboardLayoutConfig } from '@universo/types'

export interface DashboardDetailsSlot {
    title: string
    applicationId?: string
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    sections?: Array<{ id: string; codename: string }>
    objectCollections?: Array<{ id: string; codename: string }>
    apiBaseUrl?: string
    locale?: string
    currentWorkspaceId?: string | null
    runtimeQueryKeyPrefix?: readonly unknown[]
    workspacesEnabled?: boolean
    banner?: React.ReactNode
    content?: React.ReactNode
    rows: Array<Record<string, unknown> & { id: string }>
    columns: GridColDef[]
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    sortModel?: GridSortModel
    onSortModelChange?: (model: GridSortModel) => void
    filterModel?: GridFilterModel
    onFilterModelChange?: (model: GridFilterModel) => void
    searchValue?: string
    onSearchValueChange?: (value: string) => void
    pageSizeOptions?: number[]
    /** Optional toolbar actions (e.g. Create button) rendered next to the title. */
    actions?: React.ReactNode
    /** Optional host-provided SPA navigation handler for runtime widgets. */
    navigate?: (href: string) => void
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
    /** Search scope contract for the current object runtime. */
    searchMode?: 'server' | 'page-local'
    /** Optional persisted row-reorder contract for the current object runtime. */
    rowReorder?: {
        onReorder: (orderedRowIds: string[]) => Promise<void>
        isPending?: boolean
    }
    /** Structured Page metadata blocks, compatible with the Editor.js block shape. */
    pageBlocks?: RuntimePageBlock[]
}

export interface DashboardMenuItem {
    id: string
    label: string
    icon?: string | null
    kind: 'section' | 'hub' | 'link'
    sectionId?: string | null
    objectCollectionId?: string | null
    treeEntityId?: string | null
    href?: string | null
    selected?: boolean
}

export interface DashboardMenuSlot {
    title?: string | null
    showTitle?: boolean
    items: DashboardMenuItem[]
    overflowItems?: DashboardMenuItem[]
    overflowLabel?: string | null
    activeSectionId?: string | null
    onSelectSection?: (sectionId: string) => void
    activeObjectCollectionId?: string | null
    onSelectObjectCollection?: (objectCollectionId: string) => void
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

const DEFAULT_LAYOUT: DashboardLayoutConfig = defaultDashboardLayoutConfig

const EMPTY_RIGHT_WIDGETS: ZoneWidgetItem[] = []
const EMPTY_CENTER_WIDGETS: ZoneWidgetItem[] = []
const WORKSPACE_SWITCHER_WIDGET_ID = 'runtime-workspace-switcher-widget'
const WORKSPACE_SWITCHER_DIVIDER_WIDGET_ID = 'runtime-workspace-switcher-divider-widget'
const FALLBACK_MENU_WIDGET_ID = 'runtime-workspace-menu-widget'

const withRuntimeWorkspaceSwitcher = (zoneWidgets: ZoneWidgets | undefined, workspacesEnabled?: boolean): ZoneWidgets | undefined => {
    if (!workspacesEnabled) return zoneWidgets

    const baseLeft = zoneWidgets?.left ?? []
    const hasWorkspaceSwitcher = baseLeft.some((widget) => widget.widgetKey === 'workspaceSwitcher')
    const nextLeft = hasWorkspaceSwitcher
        ? baseLeft
        : [
              {
                  id: WORKSPACE_SWITCHER_WIDGET_ID,
                  widgetKey: 'workspaceSwitcher',
                  sortOrder: -1000,
                  config: {}
              },
              {
                  id: WORKSPACE_SWITCHER_DIVIDER_WIDGET_ID,
                  widgetKey: 'divider',
                  sortOrder: -999,
                  config: {}
              },
              ...(baseLeft.length > 0
                  ? baseLeft
                  : [
                        {
                            id: FALLBACK_MENU_WIDGET_ID,
                            widgetKey: 'menuWidget',
                            sortOrder: 0,
                            config: {}
                        }
                    ])
          ]

    return {
        ...(zoneWidgets ?? {}),
        left: nextLeft,
        right: zoneWidgets?.right,
        center: zoneWidgets?.center
    }
}

export default function Dashboard(props: DashboardProps) {
    const layout = { ...DEFAULT_LAYOUT, ...(props.layoutConfig ?? {}) }
    const zoneWidgets = useMemo(
        () => withRuntimeWorkspaceSwitcher(props.zoneWidgets, props.details?.workspacesEnabled),
        [props.details?.workspacesEnabled, props.zoneWidgets]
    )
    const rightWidgets = zoneWidgets?.right ?? EMPTY_RIGHT_WIDGETS
    const centerWidgets = zoneWidgets?.center ?? EMPTY_CENTER_WIDGETS
    const showRightSideMenu = (layout.showRightSideMenu ?? true) && rightWidgets.length > 0

    return (
        <DashboardDetailsProvider value={props.details}>
            <Box sx={{ display: 'flex' }}>
                {layout.showSideMenu && <SideMenu menu={props.menu} menus={props.menus} zoneWidgets={zoneWidgets} />}
                {layout.showAppNavbar && (
                    <AppNavbar menu={props.menu} menus={props.menus} rightWidgets={rightWidgets} zoneWidgets={zoneWidgets} />
                )}
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
                        {layout.showHeader && <Header layoutConfig={layout} />}
                        <MainGrid layoutConfig={layout} centerWidgets={centerWidgets} />
                    </Stack>
                </Box>
                {showRightSideMenu && <SideMenuRight widgets={rightWidgets} menu={props.menu} menus={props.menus} />}
            </Box>
        </DashboardDetailsProvider>
    )
}
