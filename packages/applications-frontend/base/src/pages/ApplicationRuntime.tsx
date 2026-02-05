import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppsDashboard, type DashboardLayoutConfig } from '@universo/apps-template-mui'
import { getApplicationRuntime, updateApplicationRuntimeCell } from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'

const DEFAULT_PAGE_SIZE = 50

const withDashboardDefaults = (config: Record<string, unknown> | undefined): DashboardLayoutConfig => {
    const c = config ?? {}
    const getBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
    return {
        showSideMenu: getBool(c['showSideMenu'], true),
        showAppNavbar: getBool(c['showAppNavbar'], true),
        showHeader: getBool(c['showHeader'], true),
        showBreadcrumbs: getBool(c['showBreadcrumbs'], true),
        showSearch: getBool(c['showSearch'], true),
        showDatePicker: getBool(c['showDatePicker'], true),
        showOptionsMenu: getBool(c['showOptionsMenu'], true),
        showOverviewTitle: getBool(c['showOverviewTitle'], true),
        showOverviewCards: getBool(c['showOverviewCards'], true),
        showSessionsChart: getBool(c['showSessionsChart'], true),
        showPageViewsChart: getBool(c['showPageViewsChart'], true),
        showDetailsTitle: getBool(c['showDetailsTitle'], true),
        showDetailsTable: getBool(c['showDetailsTable'], true),
        showDetailsSidePanel: getBool(c['showDetailsSidePanel'], true),
        showFooter: getBool(c['showFooter'], true)
    }
}

const ApplicationRuntime = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')
    const queryClient = useQueryClient()
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: DEFAULT_PAGE_SIZE
    })

    const updateCellMutation = useMutation({
        mutationFn: async (params: { rowId: string; field: string; value: boolean | null }) => {
            if (!applicationId) throw new Error('Application ID is missing')
            await updateApplicationRuntimeCell({
                applicationId,
                rowId: params.rowId,
                field: params.field,
                value: params.value
            })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: [...applicationsQueryKeys.detail(applicationId), 'runtime'] })
        }
    })

    const runtimeQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.runtimeTable(applicationId, {
                  limit: paginationModel.pageSize,
                  offset: paginationModel.page * paginationModel.pageSize,
                  locale: i18n.language
              })
            : ['applications', 'runtime', 'missing-id'],
        queryFn: async () => {
            if (!applicationId) throw new Error('Application ID is missing')
            return getApplicationRuntime(applicationId, {
                limit: paginationModel.pageSize,
                offset: paginationModel.page * paginationModel.pageSize,
                locale: i18n.language
            })
        },
        enabled: Boolean(applicationId),
        staleTime: 30_000,
        placeholderData: keepPreviousData
    })

    const columns = useMemo<GridColDef[]>(() => {
        const baseColumns = runtimeQuery.data?.columns ?? []
        return baseColumns.map((column) => ({
            field: column.field,
            headerName: column.headerName,
            flex: 1,
            minWidth: 160,
            sortable: false,
            type: column.dataType === 'BOOLEAN' ? 'boolean' : column.dataType === 'NUMBER' ? 'number' : 'string',
            headerAlign: 'center',
            align: 'center',
            renderCell:
                column.dataType === 'BOOLEAN'
                    ? (params) => (
                          <Checkbox
                              disableRipple
                              checked={Boolean(params.value)}
                              indeterminate={params.value === null || params.value === undefined}
                              disabled={updateCellMutation.isPending}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(_, checked) => {
                                  updateCellMutation.mutate({
                                      rowId: String(params.id),
                                      field: column.field,
                                      value: checked
                                  })
                              }}
                          />
                      )
                    : undefined
        }))
    }, [runtimeQuery.data?.columns, updateCellMutation.isPending, updateCellMutation.mutate])

    if (!applicationId) {
        return <Alert severity='error'>{t('runtime.errors.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (runtimeQuery.isLoading && !runtimeQuery.data) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (runtimeQuery.isError || !runtimeQuery.data) {
        return <Alert severity='error'>{t('runtime.errors.loadFailed', 'Failed to load runtime data')}</Alert>
    }

    return (
        <AppsDashboard
            layoutConfig={withDashboardDefaults(runtimeQuery.data.layoutConfig as Record<string, unknown> | undefined)}
            details={{
                title: runtimeQuery.data.catalog.name,
                rows: runtimeQuery.data.rows,
                columns,
                loading: runtimeQuery.isFetching,
                rowCount: runtimeQuery.data.pagination.total,
                paginationModel,
                onPaginationModelChange: setPaginationModel,
                pageSizeOptions: [25, 50, 100]
            }}
        />
    )
}

export default ApplicationRuntime
