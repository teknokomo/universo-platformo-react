import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'

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

