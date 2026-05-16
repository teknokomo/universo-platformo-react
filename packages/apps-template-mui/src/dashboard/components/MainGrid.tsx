import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import {
    defaultDashboardLayoutConfig,
    overviewCardsWidgetConfigSchema,
    recordsSeriesChartWidgetConfigSchema,
    type RecordsSeriesChartWidgetConfig,
    type StatCardWidgetConfig
} from '@universo/types'
import { fetchAppData, fetchRuntimeLedgerProjection, runRuntimeReport } from '../../api/api'
import Copyright from '../internals/components/Copyright'
import CustomizedDataGrid from './CustomizedDataGrid'
import HighlightedCard from './HighlightedCard'
import PageViewsBarChart from './PageViewsBarChart'
import SessionsChart from './SessionsChart'
import StatCard, { StatCardProps } from './StatCard'
import type { ZoneWidgetItem, DashboardLayoutConfig, DashboardDetailsSlot } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { renderWidget } from './widgetRenderer'
import PageBlocksView from './PageBlocksView'
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
} from '../../components/runtime-ui'

const noopSetSort = () => undefined

const DEFAULT_SPARKLINE_DATA = Array.from({ length: 30 }, () => 0)
const ZERO_TREND_LABEL = '0%'
const EMPTY_RECORDS_SERIES_CHART_CONFIG: RecordsSeriesChartWidgetConfig = {}

const DEFAULT_STAT_CARDS: StatCardProps[] = [
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

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readStringParam = (params: Record<string, unknown> | undefined, key: string): string | undefined => {
    const value = params?.[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const hasTextValue = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const normalizeLocaleCode = (locale: string | undefined): string => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

const readLocalizedConfigText = (value: unknown, locale: string | undefined): string | undefined => {
    if (typeof value === 'string') {
        return value.trim() || undefined
    }
    if (!isRecord(value)) {
        return undefined
    }

    const normalizedLocale = normalizeLocaleCode(locale)
    const locales = isRecord(value.locales) ? value.locales : undefined
    if (locales) {
        const preferred = isRecord(locales[normalizedLocale]) ? locales[normalizedLocale].content : undefined
        if (hasTextValue(preferred)) {
            return preferred.trim()
        }

        const primaryLocale = typeof value._primary === 'string' ? normalizeLocaleCode(value._primary) : undefined
        const primary = primaryLocale && isRecord(locales[primaryLocale]) ? locales[primaryLocale].content : undefined
        if (hasTextValue(primary)) {
            return primary.trim()
        }

        for (const entry of Object.values(locales)) {
            const content = isRecord(entry) ? entry.content : undefined
            if (hasTextValue(content)) {
                return content.trim()
            }
        }
    }

    const directPreferred = value[normalizedLocale]
    if (hasTextValue(directPreferred)) {
        return directPreferred.trim()
    }

    return undefined
}

const findRuntimeSectionIdByCodename = (details: DashboardDetailsSlot | undefined, codename: string | undefined): string | undefined => {
    if (!details || !codename) return undefined
    const normalized = codename.trim()
    return (
        details.sections?.find((section) => section.codename === normalized)?.id ??
        details.objectCollections?.find((section) => section.codename === normalized)?.id ??
        undefined
    )
}

const formatMetricValue = (value: number, locale: string): string =>
    new Intl.NumberFormat(locale || 'en', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(value)

const formatMetricDisplayValue = (value: unknown, locale: string): string => {
    if (typeof value === 'number' && Number.isFinite(value)) return formatMetricValue(value, locale)
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? formatMetricValue(parsed, locale) : value.trim()
    }
    if (typeof value === 'boolean') return value ? '1' : '0'
    return '0'
}

const readOptionalId = (value: string | null | undefined): string | undefined => (value?.trim() ? value.trim() : undefined)

const toFiniteNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

const toChartTrendLabel = (trend: RecordsSeriesChartWidgetConfig['trend'] | undefined): string | undefined => {
    if (trend === 'up') return '+0%'
    if (trend === 'down') return '-0%'
    if (trend === 'neutral') return '0%'
    return undefined
}

const getChartNoDataText = (locale: string): string =>
    normalizeLocaleCode(locale) === 'ru' ? 'Нет данных для отображения' : 'No data to display'

const toStatCardProps = (config: StatCardWidgetConfig, fallback: StatCardProps, locale: string | undefined): StatCardProps => ({
    title: readLocalizedConfigText(config.title, locale) ?? fallback.title,
    value: config.value ?? fallback.value,
    interval: readLocalizedConfigText(config.interval, locale) ?? fallback.interval,
    trend: config.trend ?? fallback.trend,
    data: config.data?.length ? config.data : fallback.data?.length ? fallback.data : DEFAULT_SPARKLINE_DATA
})

function RuntimeStatCard({ config, fallback }: { config: StatCardWidgetConfig; fallback: StatCardProps }) {
    const details = useDashboardDetails()
    const base = toStatCardProps(config, fallback, details?.locale)
    const datasource = config.datasource
    const hasMetricDatasource = datasource?.kind === 'metric' && datasource.metricKey === 'records.count'
    const hasReportAggregationDatasource = datasource?.kind === 'metric' && datasource.metricKey === 'report.aggregation'
    const runtimeBase =
        hasMetricDatasource || hasReportAggregationDatasource
            ? {
                  ...base,
                  trend: 'neutral' as const,
                  trendLabel: ZERO_TREND_LABEL,
                  data: config.data?.length ? config.data : DEFAULT_SPARKLINE_DATA
              }
            : base
    const params = isRecord(datasource?.params) ? datasource.params : undefined
    const explicitTargetSectionId =
        readStringParam(params, 'sectionId') ??
        readStringParam(params, 'objectCollectionId') ??
        findRuntimeSectionIdByCodename(
            details,
            readStringParam(params, 'sectionCodename') ?? readStringParam(params, 'objectCollectionCodename')
        )
    const hasExplicitTarget =
        Boolean(readStringParam(params, 'sectionId')) ||
        Boolean(readStringParam(params, 'objectCollectionId')) ||
        Boolean(readStringParam(params, 'sectionCodename')) ||
        Boolean(readStringParam(params, 'objectCollectionCodename'))
    const targetSectionId =
        explicitTargetSectionId ?? (!hasExplicitTarget ? details?.sectionId ?? details?.objectCollectionId ?? undefined : undefined)
    const search = readStringParam(params, 'search')
    const reportId = readStringParam(params, 'reportId')
    const reportCodename = readStringParam(params, 'reportCodename')
    const aggregationAlias = readStringParam(params, 'aggregationAlias')
    const metricQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'metric',
            datasource?.metricKey,
            { targetSectionId, search, locale: details?.locale ?? 'en' }
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit: 1,
                offset: 0,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                search
            }),
        enabled: Boolean(
            datasource?.kind === 'metric' && datasource.metricKey === 'records.count' && details?.apiBaseUrl && details?.applicationId
        ),
        placeholderData: (previous) => previous
    })
    const reportMetricQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'report-metric',
            {
                reportId,
                reportCodename,
                aggregationAlias,
                locale: details?.locale ?? 'en',
                workspaceId: details?.currentWorkspaceId ?? null
            }
        ],
        queryFn: () =>
            runRuntimeReport({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                reportId,
                reportCodename,
                limit: 1,
                offset: 0,
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: Boolean(
            hasReportAggregationDatasource &&
                details?.apiBaseUrl &&
                details?.applicationId &&
                aggregationAlias &&
                (reportId || reportCodename)
        ),
        placeholderData: (previous) => previous
    })

    const value =
        hasMetricDatasource && metricQuery.data
            ? formatMetricValue(metricQuery.data.pagination.total, details?.locale ?? 'en')
            : hasReportAggregationDatasource && reportMetricQuery.data && aggregationAlias
            ? formatMetricDisplayValue(reportMetricQuery.data.aggregations[aggregationAlias], details?.locale ?? 'en')
            : runtimeBase.value

    return <StatCard {...runtimeBase} value={value} />
}

function RuntimeRecordsSeriesChart({ config, variant }: { config: RecordsSeriesChartWidgetConfig; variant: 'sessions' | 'pageViews' }) {
    const details = useDashboardDetails()
    const datasource = config.datasource
    const recordsDatasource = datasource?.kind === 'records.list' ? datasource : null
    const ledgerProjectionDatasource = datasource?.kind === 'ledger.projection' ? datasource : null
    const explicitTargetSectionId =
        readOptionalId(recordsDatasource?.sectionId) ??
        readOptionalId(recordsDatasource?.objectCollectionId) ??
        findRuntimeSectionIdByCodename(
            details,
            recordsDatasource?.sectionCodename ?? recordsDatasource?.objectCollectionCodename ?? undefined
        )
    const hasExplicitTarget =
        hasTextValue(recordsDatasource?.sectionId) ||
        hasTextValue(recordsDatasource?.objectCollectionId) ||
        hasTextValue(recordsDatasource?.sectionCodename) ||
        hasTextValue(recordsDatasource?.objectCollectionCodename)
    const targetSectionId =
        explicitTargetSectionId ?? (!hasExplicitTarget ? details?.sectionId ?? details?.objectCollectionId ?? undefined : undefined)
    const configuredSeries = config.series ?? []
    const canFetchRecordSeries = Boolean(
        recordsDatasource &&
            config.xField &&
            configuredSeries.length > 0 &&
            targetSectionId &&
            details?.apiBaseUrl &&
            details?.applicationId
    )
    const canFetchLedgerProjectionSeries = Boolean(
        ledgerProjectionDatasource &&
            config.xField &&
            configuredSeries.length > 0 &&
            (ledgerProjectionDatasource.ledgerId || ledgerProjectionDatasource.ledgerCodename) &&
            ledgerProjectionDatasource.projectionCodename &&
            details?.apiBaseUrl &&
            details?.applicationId
    )
    const canFetchRuntimeSeries = canFetchRecordSeries || canFetchLedgerProjectionSeries
    const listQuery = recordsDatasource?.query
    const seriesQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'runtime-series-chart',
            variant,
            {
                datasource,
                targetSectionId,
                xField: config.xField,
                maxRows: config.maxRows ?? 30,
                series: configuredSeries,
                query: listQuery,
                locale: details?.locale ?? 'en'
            }
        ],
        queryFn: async () => {
            if (ledgerProjectionDatasource) {
                const result = await fetchRuntimeLedgerProjection({
                    apiBaseUrl: details!.apiBaseUrl!,
                    applicationId: details!.applicationId!,
                    ledgerId: ledgerProjectionDatasource.ledgerId,
                    ledgerCodename: ledgerProjectionDatasource.ledgerCodename,
                    projectionCodename: ledgerProjectionDatasource.projectionCodename,
                    filters: ledgerProjectionDatasource.filters,
                    limit: config.maxRows ?? 30,
                    offset: 0
                })
                return { rows: result.rows }
            }

            return fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit: config.maxRows ?? 30,
                offset: 0,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                search: listQuery?.search,
                sort: listQuery?.sort,
                filters: listQuery?.filters
            })
        },
        enabled: canFetchRuntimeSeries,
        placeholderData: (previous) => previous
    })

    const rows = seriesQuery.data?.rows ?? []
    const hasRuntimeDatasource = Boolean(recordsDatasource || ledgerProjectionDatasource)
    const hasRuntimeSeries = canFetchRuntimeSeries && rows.length > 0 && Boolean(config.xField)
    const shouldSuppressDemoSeries = Boolean(
        (recordsDatasource || ledgerProjectionDatasource) && config.xField && configuredSeries.length > 0
    )
    const locale = details?.locale ?? 'en'
    const xAxisData = hasRuntimeSeries ? rows.map((row) => String(row[config.xField!] ?? '')) : shouldSuppressDemoSeries ? [] : undefined
    const series = hasRuntimeSeries
        ? configuredSeries.map((item) => ({
              id: item.id ?? item.field,
              label: readLocalizedConfigText(item.label, locale) ?? item.field,
              data: rows.map((row) => toFiniteNumber(row[item.field])),
              stack: item.stack,
              area: item.area
          }))
        : shouldSuppressDemoSeries
        ? configuredSeries.map((item) => ({
              id: item.id ?? item.field,
              label: readLocalizedConfigText(item.label, locale) ?? item.field,
              data: [],
              stack: item.stack,
              area: item.area
          }))
        : undefined
    const computedValue =
        hasRuntimeSeries && series?.[0]?.data.length
            ? formatMetricValue(
                  series[0].data.reduce((sum, value) => sum + value, 0),
                  locale
              )
            : shouldSuppressDemoSeries
            ? '0'
            : undefined
    const commonProps = {
        title: readLocalizedConfigText(config.title, locale),
        value: config.value ?? computedValue,
        interval: readLocalizedConfigText(config.interval, locale),
        trend: config.trend ?? (hasRuntimeDatasource ? 'neutral' : undefined),
        trendLabel: hasRuntimeDatasource ? toChartTrendLabel(config.trend ?? 'neutral') : toChartTrendLabel(config.trend),
        noDataText: getChartNoDataText(locale),
        xAxisData,
        series
    }

    return variant === 'sessions' ? <SessionsChart {...commonProps} /> : <PageViewsBarChart {...commonProps} />
}

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
type FlowListCellParams = Parameters<NonNullable<GridColDef['renderCell']>>[0]

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

const buildFlowListCellParams = (
    column: GridColDef,
    row: RuntimeDetailsRow,
    rowsById: Map<string, RuntimeDetailsRow>
): FlowListCellParams => {
    const value = row[column.field]
    const api = {
        getRow: (id: string | number) => rowsById.get(String(id)) ?? null,
        getCellValue: (id: string | number, field: string) => rowsById.get(String(id))?.[field]
    } as FlowListCellParams['api']

    return {
        id: row.id,
        field: column.field,
        value,
        formattedValue: value,
        row,
        colDef: column,
        api
    } as FlowListCellParams
}

const buildFlowListColumns = (columns: GridColDef[], rows: RuntimeDetailsRow[]): TableColumn<RuntimeDetailsRow>[] => {
    const rowsById = new Map(rows.map((item) => [String(item.id), item]))

    return columns
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
                    return column.renderCell(buildFlowListCellParams(column, row, rowsById))
                }
                return getSearchableText(value)
            }
        }))
}

function EnhancedDetailsSection({ layoutConfig, showTitle = true }: { layoutConfig?: DashboardLayoutConfig; showTitle?: boolean }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [viewMode, setViewMode] = useViewPreference('app-details-view', (layoutConfig?.defaultViewMode as 'table' | 'card') ?? 'table')
    const [localSearch, setLocalSearch] = useState('')
    const [orderedRows, setOrderedRows] = useState<RuntimeDetailsRow[]>(() => (details?.rows as RuntimeDetailsRow[] | undefined) ?? [])
    const [clientPage, setClientPage] = useState(0)
    const [clientPageSize, setClientPageSize] = useState(details?.paginationModel?.pageSize ?? 20)

    useEffect(() => {
        setOrderedRows((details?.rows as RuntimeDetailsRow[] | undefined) ?? [])
    }, [details?.rows])

    useEffect(() => {
        setClientPageSize(details?.paginationModel?.pageSize ?? 20)
    }, [details?.paginationModel?.pageSize])

    const searchMode = details?.searchMode ?? 'page-local'
    const search = searchMode === 'server' ? details?.searchValue ?? '' : localSearch
    const handleSearchChange = (value: string) => {
        if (searchMode === 'server') {
            details?.onSearchValueChange?.(value)
            return
        }
        setLocalSearch(value)
    }
    const filteredRows = useMemo(() => {
        const rows = orderedRows
        if (searchMode === 'server') return rows
        if (!search.trim()) return rows
        const lower = search.toLowerCase()
        return rows.filter((row) => Object.values(row).some((val) => getSearchableText(val).toLowerCase().includes(lower)))
    }, [orderedRows, search, searchMode])

    const isClientFiltered = searchMode !== 'server' && search.trim().length > 0
    const baseCanPersistRowReorder = Boolean(layoutConfig?.enableRowReordering && details?.rowReorder?.onReorder)
    const knownRowCount = details?.rowCount ?? orderedRows.length
    const hasCompleteDatasetLoaded = knownRowCount <= orderedRows.length
    const canPersistRowReorder = baseCanPersistRowReorder && hasCompleteDatasetLoaded && !isClientFiltered
    const usesLocalSearchScope = searchMode === 'page-local'
    const showSearchScopeHint = Boolean(
        layoutConfig?.showFilterBar && usesLocalSearchScope && (details?.rowCount ?? orderedRows.length) > orderedRows.length
    )
    const showRowReorderHint = baseCanPersistRowReorder && !canPersistRowReorder

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
    const headerTitle = showTitle ? detailsTitle : undefined
    const serverPage = details?.paginationModel?.page ?? 0
    const serverPageSize = details?.paginationModel?.pageSize ?? 20
    const page = isClientFiltered ? clientPage : serverPage
    const pageSize = isClientFiltered ? clientPageSize : serverPageSize
    const totalItems = isClientFiltered ? filteredRows.length : details?.rowCount ?? filteredRows.length
    const visibleRows = useMemo(() => {
        if (viewMode === 'card') {
            if (!isClientFiltered && details?.rowCount !== undefined) {
                return filteredRows
            }
            return paginateRows(filteredRows, page, pageSize)
        }
        if (canPersistRowReorder) {
            return filteredRows
        }
        return isClientFiltered ? paginateRows(filteredRows, page, pageSize) : filteredRows
    }, [canPersistRowReorder, details?.rowCount, filteredRows, isClientFiltered, page, pageSize, viewMode])
    const flowListColumns = useMemo(() => buildFlowListColumns(details?.columns ?? [], orderedRows), [details?.columns, orderedRows])
    const gridPaginationModel = isClientFiltered ? { page: clientPage, pageSize: clientPageSize } : details?.paginationModel
    const showHeader = Boolean(details?.actions || layoutConfig?.showFilterBar || layoutConfig?.showViewToggle || headerTitle)

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
        setSearch: (s: string) => handleSearchChange(s),
        setSort: noopSetSort,
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
        if (!canPersistRowReorder) return

        const activeId = String(event.active.id)
        const overId = event.over ? String(event.over.id) : null
        setOrderedRows((rows) => {
            const nextRows = reorderRowsByIds(rows, activeId, overId)
            const nextIds = nextRows.map((row) => row.id)
            void details?.rowReorder?.onReorder(nextIds).catch(() => {
                setOrderedRows(rows)
            })
            return nextRows
        })
    }

    return (
        <>
            {showHeader ? (
                <Box
                    sx={{
                        mb: { xs: 1.5, sm: 2 },
                        '& .MuiToolbar-root': {
                            rowGap: 1.5,
                            columnGap: 2,
                            alignItems: { xs: 'stretch', sm: 'center' }
                        }
                    }}
                >
                    <ViewHeaderMUI
                        title={headerTitle}
                        search={layoutConfig?.showFilterBar}
                        searchValue={search}
                        onSearchChange={(e) => handleSearchChange(e.target.value)}
                    >
                        <ToolbarControls
                            viewToggleEnabled={layoutConfig?.showViewToggle}
                            viewMode={viewMode === 'card' ? 'card' : 'list'}
                            onViewModeChange={(mode) => setViewMode(mode === 'card' ? 'card' : 'table')}
                        />
                        {details?.actions}
                    </ViewHeaderMUI>
                </Box>
            ) : null}

            {showSearchScopeHint ? (
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
                    {t('app.localSearchScope', 'Search applies to loaded rows only.')}
                </Typography>
            ) : null}

            {showRowReorderHint ? (
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
                    {t(
                        'app.reorderRequiresCompleteDataset',
                        'Row reordering is available only when all rows are loaded and search is cleared.'
                    )}
                </Typography>
            ) : null}

            {viewMode === 'card' ? (
                <Grid container spacing={2} data-testid='dashboard-details-card-view'>
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
                                <ItemCard data={cardData} allowStretch />
                            </Grid>
                        )
                    })}
                </Grid>
            ) : canPersistRowReorder ? (
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
                    paginationModel={gridPaginationModel}
                    onPaginationModelChange={(model) => {
                        if (isClientFiltered) {
                            setClientPage(model.page)
                            setClientPageSize(model.pageSize)
                            return
                        }
                        details?.onPaginationModelChange?.(model)
                    }}
                    sortModel={details?.sortModel}
                    onSortModelChange={details?.onSortModelChange}
                    filterModel={details?.filterModel}
                    onFilterModelChange={details?.onFilterModelChange}
                    pageSizeOptions={details?.pageSizeOptions}
                    localeText={details?.localeText}
                    rowHeight={layoutConfig?.rowHeight}
                />
            )}

            {viewMode === 'card' && totalItems > 0 ? <PaginationControls pagination={paginationState} actions={paginationActions} /> : null}
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
    const showOverviewTitle = layoutConfig?.showOverviewTitle ?? defaultDashboardLayoutConfig.showOverviewTitle
    const showOverviewCards = layoutConfig?.showOverviewCards ?? defaultDashboardLayoutConfig.showOverviewCards
    const showSessionsChart = layoutConfig?.showSessionsChart ?? defaultDashboardLayoutConfig.showSessionsChart
    const showPageViewsChart = layoutConfig?.showPageViewsChart ?? defaultDashboardLayoutConfig.showPageViewsChart
    const showDetailsTitle = layoutConfig?.showDetailsTitle ?? defaultDashboardLayoutConfig.showDetailsTitle
    const showDetailsTable = layoutConfig?.showDetailsTable ?? defaultDashboardLayoutConfig.showDetailsTable
    const showColumnsContainer = layoutConfig?.showColumnsContainer ?? defaultDashboardLayoutConfig.showColumnsContainer
    const showFooter = layoutConfig?.showFooter ?? defaultDashboardLayoutConfig.showFooter
    const hasCustomDetailsContent = Boolean(details?.content)
    const hasPageBlocks = (details?.pageBlocks?.length ?? 0) > 0

    // Find all columnsContainer widgets in center zone (data-driven rendering, supports multiple)
    const columnsContainerWidgets = showColumnsContainer ? centerWidgets?.filter((w) => w.widgetKey === 'columnsContainer') ?? [] : []
    const overviewCardsWidget = centerWidgets?.find((widget) => widget.widgetKey === 'overviewCards')
    const parsedOverviewCards = overviewCardsWidgetConfigSchema.safeParse(overviewCardsWidget?.config ?? {})
    const sessionsChartWidget = centerWidgets?.find((widget) => widget.widgetKey === 'sessionsChart')
    const parsedSessionsChart = recordsSeriesChartWidgetConfigSchema.safeParse(sessionsChartWidget?.config ?? {})
    const sessionsChartConfig = parsedSessionsChart.success ? parsedSessionsChart.data : EMPTY_RECORDS_SERIES_CHART_CONFIG
    const pageViewsChartWidget = centerWidgets?.find((widget) => widget.widgetKey === 'pageViewsChart')
    const parsedPageViewsChart = recordsSeriesChartWidgetConfigSchema.safeParse(pageViewsChartWidget?.config ?? {})
    const pageViewsChartConfig = parsedPageViewsChart.success ? parsedPageViewsChart.data : EMPTY_RECORDS_SERIES_CHART_CONFIG
    const overviewCards =
        parsedOverviewCards.success && parsedOverviewCards.data.cards?.length
            ? parsedOverviewCards.data.cards
            : DEFAULT_STAT_CARDS.map((card) => ({
                  title: card.title,
                  value: card.value,
                  interval: card.interval,
                  trend: card.trend,
                  data: card.data
              }))
    const standaloneCenterWidgets =
        centerWidgets?.filter(
            (widget) =>
                ![
                    'columnsContainer',
                    'detailsTable',
                    'detailsTitle',
                    'overviewTitle',
                    'overviewCards',
                    'sessionsChart',
                    'pageViewsChart'
                ].includes(widget.widgetKey)
        ) ?? []
    const showCenterContent =
        hasCustomDetailsContent || showDetailsTitle || showColumnsContainer || showDetailsTable || standaloneCenterWidgets.length > 0

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
                                {overviewCards.map((card, index) => (
                                    <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                                        <RuntimeStatCard config={card} fallback={DEFAULT_STAT_CARDS[index] ?? DEFAULT_STAT_CARDS[0]} />
                                    </Grid>
                                ))}
                                {parsedOverviewCards.success && parsedOverviewCards.data.cards?.length ? null : (
                                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                        <HighlightedCard />
                                    </Grid>
                                )}
                            </>
                        )}
                        {showSessionsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <RuntimeRecordsSeriesChart config={sessionsChartConfig} variant='sessions' />
                            </Grid>
                        )}
                        {showPageViewsChart && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <RuntimeRecordsSeriesChart config={pageViewsChartConfig} variant='pageViews' />
                            </Grid>
                        )}
                    </Grid>
                </>
            )}

            {/* Details section */}
            {showCenterContent && (
                <>
                    {details?.banner ? <Box sx={{ mb: 2 }}>{details.banner}</Box> : null}

                    {hasCustomDetailsContent ? (
                        <Box data-testid='dashboard-custom-details-content'>{details?.content}</Box>
                    ) : hasPageBlocks ? (
                        <PageBlocksView blocks={details?.pageBlocks ?? []} />
                    ) : (
                        <>
                            {/* Data-driven: columnsContainer(s) from center zone widgets */}
                            {columnsContainerWidgets.length > 0
                                ? columnsContainerWidgets.map((widget) => <Box key={widget.id}>{renderWidget(widget)}</Box>)
                                : null}

                            {standaloneCenterWidgets.length > 0 ? (
                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    {standaloneCenterWidgets.map((widget) => (
                                        <Box
                                            key={widget.id}
                                            data-testid={`center-zone-widget-${widget.widgetKey}`}
                                            sx={
                                                widget.widgetKey === 'quizWidget'
                                                    ? {
                                                          width: '100%',
                                                          maxWidth: 960,
                                                          mx: 'auto'
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {renderWidget(widget)}
                                        </Box>
                                    ))}
                                </Box>
                            ) : null}

                            {showDetailsTable ? <EnhancedDetailsSection layoutConfig={layoutConfig} showTitle={showDetailsTitle} /> : null}
                        </>
                    )}
                </>
            )}

            {showFooter && <Copyright sx={{ my: 4 }} />}
        </Box>
    )
}
