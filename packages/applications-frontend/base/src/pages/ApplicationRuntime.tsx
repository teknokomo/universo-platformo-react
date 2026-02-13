import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppsDashboard, type DashboardLayoutConfig, type DashboardMenuItem, type DashboardMenusMap } from '@universo/apps-template-mui'
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
    const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(undefined)

    const runtimeQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.runtimeTable(applicationId, {
                  limit: paginationModel.pageSize,
                  offset: paginationModel.page * paginationModel.pageSize,
                  locale: i18n.language,
                  catalogId: selectedCatalogId
              })
            : ['applications', 'runtime', 'missing-id'],
        queryFn: async () => {
            if (!applicationId) throw new Error('Application ID is missing')
            return getApplicationRuntime(applicationId, {
                limit: paginationModel.pageSize,
                offset: paginationModel.page * paginationModel.pageSize,
                locale: i18n.language,
                catalogId: selectedCatalogId
            })
        },
        enabled: Boolean(applicationId),
        staleTime: 30_000,
        placeholderData: keepPreviousData
    })

    const runtime = runtimeQuery.data
    const activeCatalogId = runtime?.activeCatalogId ?? runtime?.catalog.id

    const updateCellMutation = useMutation({
        mutationFn: async (params: { rowId: string; field: string; value: boolean | null }) => {
            if (!applicationId) throw new Error('Application ID is missing')
            await updateApplicationRuntimeCell({
                applicationId,
                rowId: params.rowId,
                field: params.field,
                value: params.value,
                catalogId: selectedCatalogId ?? activeCatalogId
            })
        },
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: [...applicationsQueryKeys.detail(applicationId), 'runtime'] })
        }
    })

    // Initialize selected catalog from backend response
    useEffect(() => {
        if (!runtime || selectedCatalogId) return
        if (activeCatalogId) setSelectedCatalogId(activeCatalogId)
    }, [runtime, selectedCatalogId, activeCatalogId])

    // Find active menu from menus array
    const activeMenu = useMemo(() => {
        if (!runtime?.menus?.length) return null
        return runtime.menus.find((m) => m.id === runtime.activeMenuId) ?? runtime.menus[0]
    }, [runtime])

    // Build dashboard menu items from active menu
    const dashboardMenuItems = useMemo<DashboardMenuItem[]>(() => {
        if (!activeMenu) return []
        const catalogs = runtime?.catalogs ?? []

        return activeMenu.items.flatMap((item): DashboardMenuItem[] => {
            if (!item.isActive) return []

            if (item.kind === 'catalog') {
                return [
                    {
                        id: item.id,
                        label: item.title,
                        icon: item.icon ?? null,
                        kind: 'catalog' as const,
                        catalogId: item.catalogId ?? null,
                        href: null,
                        selected: item.catalogId != null && item.catalogId === activeCatalogId
                    }
                ]
            }

            if (item.kind === 'catalogs_all') {
                return catalogs.map((catalog) => ({
                    id: `${item.id}:${catalog.id}`,
                    label: catalog.name,
                    icon: item.icon ?? null,
                    kind: 'catalog' as const,
                    catalogId: catalog.id,
                    href: null,
                    selected: catalog.id === activeCatalogId
                }))
            }

            return [
                {
                    id: item.id,
                    label: item.title,
                    icon: item.icon ?? null,
                    kind: 'link' as const,
                    catalogId: null,
                    href: item.href ?? null,
                    selected: false
                }
            ]
        })
    }, [activeMenu, runtime, activeCatalogId])

    // Build menus map from all runtime menus, keyed by widgetId
    const menusMap = useMemo<DashboardMenusMap>(() => {
        if (!runtime?.menus?.length) return {}
        const catalogs = runtime.catalogs ?? []
        const onSelectCatalog = (catalogId: string) => {
            if (!catalogId || catalogId === activeCatalogId) return
            setPaginationModel((prev) => ({ ...prev, page: 0 }))
            setSelectedCatalogId(catalogId)
        }
        const map: DashboardMenusMap = {}
        for (const runtimeMenu of runtime.menus) {
            if (!runtimeMenu.widgetId) continue
            const items = runtimeMenu.items.flatMap((item): DashboardMenuItem[] => {
                if (!item.isActive) return []
                if (item.kind === 'catalog') {
                    return [
                        {
                            id: item.id,
                            label: item.title,
                            icon: item.icon ?? null,
                            kind: 'catalog' as const,
                            catalogId: item.catalogId ?? null,
                            href: null,
                            selected: item.catalogId != null && item.catalogId === activeCatalogId
                        }
                    ]
                }
                if (item.kind === 'catalogs_all') {
                    return catalogs.map((catalog) => ({
                        id: `${item.id}:${catalog.id}`,
                        label: catalog.name,
                        icon: item.icon ?? null,
                        kind: 'catalog' as const,
                        catalogId: catalog.id,
                        href: null,
                        selected: catalog.id === activeCatalogId
                    }))
                }
                return [
                    {
                        id: item.id,
                        label: item.title,
                        icon: item.icon ?? null,
                        kind: 'link' as const,
                        catalogId: null,
                        href: item.href ?? null,
                        selected: false
                    }
                ]
            })
            map[runtimeMenu.widgetId] = {
                title: runtimeMenu.showTitle ? runtimeMenu.title ?? null : null,
                showTitle: Boolean(runtimeMenu.showTitle),
                items,
                activeCatalogId: activeCatalogId ?? null,
                onSelectCatalog
            }
        }
        return map
    }, [runtime, activeCatalogId])

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
            renderHeader:
                column.dataType === 'BOOLEAN' && column.uiConfig?.headerAsCheckbox
                    ? () => <Checkbox size='small' disabled checked={false} indeterminate={false} sx={{ p: 0 }} title={column.headerName} />
                    : undefined,
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
            zoneWidgets={runtimeQuery.data.zoneWidgets}
            menus={Object.keys(menusMap).length > 0 ? menusMap : undefined}
            menu={
                dashboardMenuItems.length > 0
                    ? {
                          title: activeMenu?.showTitle ? activeMenu.title ?? null : null,
                          showTitle: Boolean(activeMenu?.showTitle),
                          items: dashboardMenuItems,
                          activeCatalogId: activeCatalogId ?? null,
                          onSelectCatalog: (catalogId: string) => {
                              if (!catalogId || catalogId === activeCatalogId) return
                              setPaginationModel((prev) => ({ ...prev, page: 0 }))
                              setSelectedCatalogId(catalogId)
                          }
                      }
                    : undefined
            }
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
