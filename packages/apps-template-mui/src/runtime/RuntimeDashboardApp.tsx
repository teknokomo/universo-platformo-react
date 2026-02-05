import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dashboard from '../dashboard/Dashboard'
import { fetchApplicationRuntime, type ApplicationRuntimeResponse, type DashboardLayoutConfig } from './api'

function withDashboardDefaults(config: DashboardLayoutConfig | undefined): Required<NonNullable<DashboardLayoutConfig>> {
  return {
    showSideMenu: config?.showSideMenu ?? true,
    showAppNavbar: config?.showAppNavbar ?? true,
    showHeader: config?.showHeader ?? true,
    showBreadcrumbs: config?.showBreadcrumbs ?? true,
    showSearch: config?.showSearch ?? true,
    showDatePicker: config?.showDatePicker ?? true,
    showOptionsMenu: config?.showOptionsMenu ?? true,
    showOverviewTitle: config?.showOverviewTitle ?? true,
    showOverviewCards: config?.showOverviewCards ?? true,
    showSessionsChart: config?.showSessionsChart ?? true,
    showPageViewsChart: config?.showPageViewsChart ?? true,
    showDetailsTitle: config?.showDetailsTitle ?? true,
    showDetailsTable: config?.showDetailsTable ?? true,
    showDetailsSidePanel: config?.showDetailsSidePanel ?? true,
    showFooter: config?.showFooter ?? true,
  }
}

function toGridColumns(response: ApplicationRuntimeResponse): GridColDef[] {
  return response.columns.map((c) => ({
    field: c.field,
    headerName: c.headerName,
    flex: 1,
    minWidth: 140,
    sortable: false,
    filterable: true,
    renderCell: (params) => {
      if (c.dataType === 'BOOLEAN') {
        return <Checkbox size="small" disabled checked={Boolean(params.value)} />
      }
      if (params.value === null || params.value === undefined) return ''
      return String(params.value)
    },
  }))
}

export interface RuntimeDashboardAppProps {
  applicationId: string
  locale: string
  apiBaseUrl: string
}

export default function RuntimeDashboardApp(props: RuntimeDashboardAppProps) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })

  const isReady = Boolean(props.applicationId)
  const limit = paginationModel.pageSize
  const offset = paginationModel.page * paginationModel.pageSize

  const query = useQuery({
    queryKey: ['application-runtime', props.applicationId, limit, offset, props.locale],
    enabled: isReady,
    queryFn: () =>
      fetchApplicationRuntime({
        apiBaseUrl: props.apiBaseUrl,
        applicationId: props.applicationId,
        limit,
        offset,
        locale: props.locale,
      }),
    placeholderData: (prev) => prev,
  })

  const runtime = query.data
  const columns = useMemo(() => (runtime ? toGridColumns(runtime) : []), [runtime])
  const rows = useMemo(() => (runtime ? runtime.rows : []), [runtime])
  const rowCount = runtime?.pagination.total
  const detailsTitle = runtime?.catalog.name ?? 'Details'
  const layoutConfig = useMemo(() => withDashboardDefaults(runtime?.layoutConfig), [runtime?.layoutConfig])

  if (!isReady) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2">Missing applicationId</Typography>
      </Box>
    )
  }

  return (
    <Dashboard
      layoutConfig={layoutConfig}
      details={{
        title: detailsTitle,
        rows,
        columns,
        loading: query.isLoading,
        rowCount,
        paginationModel,
        onPaginationModelChange: setPaginationModel,
        pageSizeOptions: [10, 20, 50],
      }}
    />
  )
}

