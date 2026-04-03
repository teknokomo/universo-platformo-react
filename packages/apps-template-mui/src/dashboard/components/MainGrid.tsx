import { useEffect, useMemo, useState } from 'react'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import Copyright from '../internals/components/Copyright'
import CustomizedDataGrid from './CustomizedDataGrid'
import HighlightedCard from './HighlightedCard'
import PageViewsBarChart from './PageViewsBarChart'
import SessionsChart from './SessionsChart'
import StatCard, { StatCardProps } from './StatCard'
import type { ZoneWidgetItem, DashboardLayoutConfig } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { renderWidget } from './widgetRenderer'
import {
    ViewHeaderMUI,
    ToolbarControls,
    ItemCard,
    type ItemCardData,
    FlowListTable,
    type DragEndEvent,
    type TableColumn,
    PaginationControls,
    type PaginationState,
    type PaginationActions,
    useViewPreference
} from '@universo/template-mui'

const data: StatCardProps[] = [
    {
        title: 'Users',
        value: '14k',
        interval: 'Last 30 days',
        trend: 'up',
        data: [
            200, 24, 220, 260, 240, 380, 100, 240, 280, 240, 300, 340, 320, 360, 340, 380, 360, 400, 380, 420, 400, 640, 340, 460, 440, 480,
            460, 600, 880, 920
        ]
    },
    {
        title: 'Conversions',
        value: '325',
        interval: 'Last 30 days',
        trend: 'down',
        data: [
            1640, 1250, 970, 1130, 1050, 900, 720, 1080, 900, 450, 920, 820, 840, 600, 820, 780, 800, 760, 380, 740, 660, 620, 840, 500,
            520, 480, 400, 360, 300, 220
        ]
    },
    {
        title: 'Event count',
        value: '200k',
        interval: 'Last 30 days',
        trend: 'neutral',
        data: [
            500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510, 530, 520, 410, 530, 520, 610, 530, 520, 610, 530,
            420, 510, 430, 520, 510
        ]
    }
]

export interface MainGridLayoutConfig {
    showOverviewTitle?: boolean
    showOverviewCards?: boolean
    showSessionsChart?: boolean
    showPageViewsChart?: boolean
    showDetailsTitle?: boolean
    /**
     * Show standalone DataGrid in the center zone.
     * When a `columnsContainer` widget is present, the details table is rendered
     * inside the container's column instead, so this flag is `false` for layouts
     * that use `columnsContainer`.
     */
    showDetailsTable?: boolean
    showColumnsContainer?: boolean
    showFooter?: boolean
    // Enhanced view settings
    showViewToggle?: boolean
    defaultViewMode?: 'table' | 'card'
    showFilterBar?: boolean
    enableRowReordering?: boolean
    cardColumns?: number
    rowHeight?: number | 'auto'
}

type RuntimeDetailsRow = Record<string, unknown> & { id: string; name?: string }

const getSearchableText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

const reorderRowsByIds = <T extends { id: string }>(rows: T[], activeId: string, overId: string | null | undefined): T[] => {
    if (!overId || activeId === overId) return rows

    const activeIndex = rows.findIndex((row) => row.id === activeId)
    const overIndex = rows.findIndex((row) => row.id === overId)
    if (activeIndex < 0 || overIndex < 0) return rows

    const nextRows = [...rows]
    const [movedRow] = nextRows.splice(activeIndex, 1)
    nextRows.splice(overIndex, 0, movedRow)
    return nextRows
}

const paginateRows = <T,>(rows: T[], page: number, pageSize: number): T[] => rows.slice(page * pageSize, page * pageSize + pageSize)

const buildFlowListColumns = (columns: GridColDef[]): TableColumn<RuntimeDetailsRow>[] =>
    columns
        .filter((column) => column.field !== 'id')
        .map((column) => ({
            id: String(column.field),
            label: column.headerName ?? String(column.field),
            width: column.width,
            align: column.align ?? 'left',
            sortable: false,
            render: (row) => {
                const value = row[column.field]
                if (typeof column.renderCell === 'function') {
                    return column.renderCell({
                        id: row.id,
                        field: column.field,
                        value,
                        row,
                        colDef: column,
                        api: {} as never
                    } as never)
                }
                return getSearchableText(value)
            }
        }))

function EnhancedDetailsSection({ layoutConfig }: { layoutConfig?: DashboardLayoutConfig }) {
    const details = useDashboardDetails()
    const [viewMode, setViewMode] = useViewPreference(
        'app-details-view',
        (layoutConfig?.defaultViewMode as 'table' | 'card') ?? 'table'
    )
    const [search, setSearch] = useState('')
    const [orderedRows, setOrderedRows] = useState<RuntimeDetailsRow[]>(() => (details?.rows as RuntimeDetailsRow[] | undefined) ?? [])
    const [clientPage, setClientPage] = useState(0)
    const [clientPageSize, setClientPageSize] = useState(details?.paginationModel?.pageSize ?? 20)

    useEffect(() => {
        setOrderedRows((details?.rows as RuntimeDetailsRow[] | undefined) ?? [])
    }, [details?.rows])

    useEffect(() => {
        setClientPageSize(details?.paginationModel?.pageSize ?? 20)
    }, [details?.paginationModel?.pageSize])

    const filteredRows = useMemo(() => {
        const rows = orderedRows
        if (!search.trim()) return rows
        const lower = search.toLowerCase()
        return rows.filter((row) => Object.values(row).some((val) => getSearchableText(val).toLowerCase().includes(lower)))
    }, [orderedRows, search])

    const flowListColumns = useMemo(() => buildFlowListColumns(details?.columns ?? []), [details?.columns])
    const isClientFiltered = search.trim().length > 0

    useEffect(() => {
        if (!isClientFiltered) return
        setClientPage(0)
    }, [isClientFiltered, search])

    useEffect(() => {
        if (!isClientFiltered) return
        const maxPage = Math.max(0, Math.ceil(filteredRows.length / clientPageSize) - 1)
        if (clientPage > maxPage) {
            setClientPage(maxPage)
        }
    }, [clientPage, clientPageSize, filteredRows.length, isClientFiltered])

    const detailsTitle = details?.title ?? 'Details'
    const serverPage = details?.paginationModel?.page ?? 0
    const serverPageSize = details?.paginationModel?.pageSize ?? 20
    const page = isClientFiltered ? clientPage : serverPage
    const pageSize = isClientFiltered ? clientPageSize : serverPageSize
    const totalItems = isClientFiltered ? filteredRows.length : details?.rowCount ?? filteredRows.length
    const visibleRows = isClientFiltered ? paginateRows(filteredRows, page, pageSize) : filteredRows

    const paginationState: PaginationState = {
        currentPage: page + 1,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
        hasNextPage: (page + 1) * pageSize < totalItems,
        hasPreviousPage: page > 0
    }

    const paginationActions: PaginationActions = {
        goToPage: (p: number) => {
            if (isClientFiltered) {
                setClientPage(Math.max(0, p - 1))
                return
            }
            details?.onPaginationModelChange?.({ page: p - 1, pageSize })
        },
        nextPage: () => {
            if (isClientFiltered) {
                setClientPage((prev) => prev + 1)
                return
            }
            details?.onPaginationModelChange?.({ page: page + 1, pageSize })
        },
        previousPage: () => {
            if (isClientFiltered) {
                setClientPage((prev) => Math.max(0, prev - 1))
                return
            }
            details?.onPaginationModelChange?.({ page: Math.max(0, page - 1), pageSize })
        },
        setSearch: (s: string) => setSearch(s),
        setSort: () => {},
        setPageSize: (size: number) => {
            if (isClientFiltered) {
                setClientPage(0)
                setClientPageSize(size)
                return
            }
            details?.onPaginationModelChange?.({ page: 0, pageSize: size })
        }
    }

    const handleSortableDragEnd = (event: DragEndEvent) => {
        const activeId = String(event.active.id)
        const overId = event.over ? String(event.over.id) : null
        setOrderedRows((rows) => reorderRowsByIds(rows, activeId, overId))
    }

    return (
        <>
            <ViewHeaderMUI
                title={detailsTitle}
                search={layoutConfig?.showFilterBar}
                searchValue={search}
                onSearchChange={(e) => setSearch(e.target.value)}
            >
                <ToolbarControls
                    viewToggleEnabled={layoutConfig?.showViewToggle}
                    viewMode={viewMode === 'card' ? 'card' : 'list'}
                    onViewModeChange={(mode) => setViewMode(mode === 'card' ? 'card' : 'table')}
                />
                {details?.actions}
            </ViewHeaderMUI>

            {viewMode === 'card' ? (
                <Grid container spacing={2}>
                    {visibleRows.map((row) => {
                        const displayCol = details?.columns?.find((c) => c.field !== 'id' && c.field !== 'actions')
                        const descCol = details?.columns?.find(
                            (c) => c.field !== 'id' && c.field !== displayCol?.field && c.field !== 'actions'
                        )
                        const cardData: ItemCardData = {
                            name: String(row[displayCol?.field ?? ''] ?? row.id),
                            description: descCol ? String(row[descCol.field] ?? '') : undefined
                        }
                        return (
                            <Grid key={row.id} size={{ xs: 12, sm: 6, md: 12 / (layoutConfig?.cardColumns ?? 3) }}>
                                <ItemCard data={cardData} />
                            </Grid>
                        )
                    })}
                </Grid>
            ) : layoutConfig?.enableRowReordering ? (
                <FlowListTable<RuntimeDetailsRow>
                    data={visibleRows}
                    customColumns={flowListColumns}
                    sortableRows
                    onSortableDragEnd={handleSortableDragEnd}
                    sortStateId='app-details-row-order'
                />
            ) : (
                <CustomizedDataGrid
                    rows={visibleRows}
                    columns={details?.columns ?? []}
                    loading={details?.loading}
                    rowCount={isClientFiltered ? undefined : details?.rowCount}
                    paginationModel={isClientFiltered ? undefined : details?.paginationModel}
                    onPaginationModelChange={isClientFiltered ? undefined : details?.onPaginationModelChange}
                    pageSizeOptions={details?.pageSizeOptions}
                    localeText={details?.localeText}
                    rowHeight={layoutConfig?.rowHeight}
                    hideFooter
                />
            )}

            {totalItems > 0 && <PaginationControls pagination={paginationState} actions={paginationActions} />}
        </>
    )
}

export default function MainGrid({
    layoutConfig,
    centerWidgets
}: {
    layoutConfig?: DashboardLayoutConfig
    centerWidgets?: ZoneWidgetItem[]
}) {
    const details = useDashboardDetails()
    const showOverviewTitle = layoutConfig?.showOverviewTitle ?? true
    const showOverviewCards = layoutConfig?.showOverviewCards ?? true
    const showSessionsChart = layoutConfig?.showSessionsChart ?? true
    const showPageViewsChart = layoutConfig?.showPageViewsChart ?? true
    const showDetailsTitle = layoutConfig?.showDetailsTitle ?? true
    const showDetailsTable = layoutConfig?.showDetailsTable ?? true
    const showColumnsContainer = layoutConfig?.showColumnsContainer ?? false
    const showFooter = layoutConfig?.showFooter ?? true

    const detailsTitle = details?.title ?? 'Details'
    const isEnhancedMode = layoutConfig?.showViewToggle || layoutConfig?.showFilterBar || layoutConfig?.enableRowReordering

    // Find all columnsContainer widgets in center zone (data-driven rendering, supports multiple)
    const columnsContainerWidgets = showColumnsContainer ? centerWidgets?.filter((w) => w.widgetKey === 'columnsContainer') ?? [] : []

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            {/* Overview section — boolean-driven */}
            {(showOverviewTitle || showOverviewCards || showSessionsChart || showPageViewsChart) && (
                <>
                    {showOverviewTitle && (
                        <Typography component='h2' variant='h6' sx={{ mb: 2 }}>
                            Overview
                        </Typography>
                    )}
                    <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>
                        {showOverviewCards && (
                            <>
                                {data.map((card, index) => (
                                    <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                                        <StatCard {...card} />
                                    </Grid>
                                ))}
                                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                    <HighlightedCard />
                                </Grid>
                            </>
                        )}
                        {showSessionsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <SessionsChart />
                            </Grid>
                        )}
                        {showPageViewsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <PageViewsBarChart />
                            </Grid>
                        )}
                    </Grid>
                </>
            )}

            {/* Details section */}
            {(showDetailsTitle || showColumnsContainer || showDetailsTable) && (
                <>
                    {details?.banner ? <Box sx={{ mb: 2 }}>{details.banner}</Box> : null}

                    {/* Data-driven: columnsContainer(s) from center zone widgets */}
                    {columnsContainerWidgets.length > 0
                        ? columnsContainerWidgets.map((w) => <Box key={w.id}>{renderWidget(w)}</Box>)
                        : showDetailsTable &&
                          (isEnhancedMode ? (
                              <EnhancedDetailsSection layoutConfig={layoutConfig} />
                          ) : (
                              <>
                                  {showDetailsTitle && (
                                      <Typography component='h2' variant='h6' sx={{ mb: 1 }}>
                                          {detailsTitle}
                                      </Typography>
                                  )}
                                  {details?.actions && <Box sx={{ mb: 2 }}>{details.actions}</Box>}
                                  {!details?.actions && showDetailsTitle && <Box sx={{ mb: 1 }} />}
                                  <CustomizedDataGrid
                                      rows={details?.rows ?? []}
                                      columns={details?.columns ?? []}
                                      loading={details?.loading}
                                      rowCount={details?.rowCount}
                                      paginationModel={details?.paginationModel}
                                      onPaginationModelChange={details?.onPaginationModelChange}
                                      pageSizeOptions={details?.pageSizeOptions}
                                      localeText={details?.localeText}
                                  />
                              </>
                          ))}
                </>
            )}

            {showFooter && <Copyright sx={{ my: 4 }} />}
        </Box>
    )
}
