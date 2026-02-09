import { useEffect, useMemo, useState } from 'react'
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
        showFooter: config?.showFooter ?? true
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
                return <Checkbox size='small' disabled checked={Boolean(params.value)} />
            }
            if (params.value === null || params.value === undefined) return ''
            return String(params.value)
        }
    }))
}

export interface RuntimeDashboardAppProps {
    applicationId: string
    locale: string
    apiBaseUrl: string
}

export default function RuntimeDashboardApp(props: RuntimeDashboardAppProps) {
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(undefined)

    const isReady = Boolean(props.applicationId)
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize

    const query = useQuery({
        queryKey: ['application-runtime', props.applicationId, selectedCatalogId ?? 'default', limit, offset, props.locale],
        enabled: isReady,
        queryFn: () =>
            fetchApplicationRuntime({
                apiBaseUrl: props.apiBaseUrl,
                applicationId: props.applicationId,
                limit,
                offset,
                locale: props.locale,
                catalogId: selectedCatalogId
            }),
        placeholderData: (prev) => prev
    })

    const runtime = query.data
    const activeCatalogId = runtime?.activeCatalogId ?? runtime?.catalog.id

    useEffect(() => {
        if (!runtime) return
        if (!selectedCatalogId && activeCatalogId) {
            setSelectedCatalogId(activeCatalogId)
        }
    }, [runtime, selectedCatalogId, activeCatalogId])

    const columns = useMemo(() => (runtime ? toGridColumns(runtime) : []), [runtime])
    const rows = useMemo(() => (runtime ? runtime.rows : []), [runtime])
    const rowCount = runtime?.pagination.total
    const detailsTitle = runtime?.catalog.name ?? 'Details'
    const layoutConfig = useMemo(() => withDashboardDefaults(runtime?.layoutConfig), [runtime?.layoutConfig])

    const activeMenu = useMemo(() => {
        if (!runtime || !Array.isArray(runtime.menus) || runtime.menus.length === 0) {
            return null
        }
        return (
            runtime.menus.find((menu) => menu.id === runtime.activeMenuId) ??
            runtime.menus.find((menu) => menu.isDefault) ??
            runtime.menus[0]
        )
    }, [runtime])

    const dashboardMenuItems = useMemo(() => {
        if (!runtime || !Array.isArray(runtime.menus) || runtime.menus.length === 0) {
            return []
        }
        const catalogs = runtime.catalogs ?? []
        const selectedMenu = activeMenu
        if (!selectedMenu) {
            return []
        }

        return selectedMenu.items.flatMap((item) => {
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
    }, [runtime, activeMenu, activeCatalogId])

    if (!isReady) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant='body2'>Missing applicationId</Typography>
            </Box>
        )
    }

    return (
        <Dashboard
            layoutConfig={layoutConfig}
            zoneWidgets={runtime?.zoneWidgets}
            menu={{
                title: activeMenu?.showTitle ? activeMenu?.name ?? null : null,
                showTitle: Boolean(activeMenu?.showTitle),
                items: dashboardMenuItems,
                activeCatalogId: activeCatalogId ?? null,
                onSelectCatalog: (catalogId) => {
                    if (!catalogId || catalogId === activeCatalogId) return
                    setPaginationModel((prev) => ({ ...prev, page: 0 }))
                    setSelectedCatalogId(catalogId)
                }
            }}
            details={{
                title: detailsTitle,
                rows,
                columns,
                loading: query.isLoading,
                rowCount,
                paginationModel,
                onPaginationModelChange: setPaginationModel,
                pageSizeOptions: [10, 20, 50]
            }}
        />
    )
}
