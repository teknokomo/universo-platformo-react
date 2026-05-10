import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GridFilterModel, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { detailsTableWidgetConfigSchema, type ColumnsContainerConfig, type RuntimeDatasourceDescriptor } from '@universo/types'
import { fetchAppData, fetchRuntimeLedgerFacts, fetchRuntimeLedgerProjection } from '../../api/api'
import { toGridColumns } from '../../utils/columns'
import { mapGridFilterModel, mapGridSortModel } from '../../utils/runtimeListQuery'
import SelectContent from './SelectContent'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import CustomizedTreeView from './CustomizedTreeView'
import ChartUserByCountry from './ChartUserByCountry'
import CustomizedDataGrid from './CustomizedDataGrid'
import QuizWidget from './QuizWidget'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import type { DashboardDetailsSlot, DashboardMenuSlot, DashboardMenusMap, ZoneWidgetItem } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'

/**
 * Resolve the correct menu for a menuWidget using a 2-level fallback:
 * 1. widget.id → menus map lookup (direct widget ID match)
 * 2. Legacy single `menu` prop
 */
export function resolveMenuForWidget(
    widget: ZoneWidgetItem,
    menus?: DashboardMenusMap,
    fallbackMenu?: DashboardMenuSlot
): DashboardMenuSlot | undefined {
    if (menus?.[widget.id]) {
        return menus[widget.id]
    }
    return fallbackMenu
}

/**
 * Maximum nesting depth for columnsContainer widgets to prevent infinite recursion.
 * A columnsContainer inside another columnsContainer is blocked at render time.
 */
const MAX_CONTAINER_DEPTH = 1
const DATASOURCE_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const findRuntimeSectionIdByCodename = (
    details: DashboardDetailsSlot | undefined,
    codename: string | null | undefined
): string | undefined => {
    if (!details || !codename?.trim()) return undefined
    const normalized = codename.trim()
    return (
        details.sections?.find((section) => section.codename === normalized)?.id ??
        details.linkedCollections?.find((section) => section.codename === normalized)?.id ??
        undefined
    )
}

const readRecordsListTarget = (datasource: RuntimeDatasourceDescriptor, details: DashboardDetailsSlot | undefined): string | undefined => {
    if (datasource.kind !== 'records.list') return undefined
    return (
        datasource.sectionId ??
        datasource.linkedCollectionId ??
        findRuntimeSectionIdByCodename(details, datasource.sectionCodename ?? datasource.linkedCollectionCodename) ??
        undefined
    )
}

/**
 * Inner component for detailsTable widget that consumes DashboardDetailsContext.
 * Must be a proper React component (not a plain function) to use hooks.
 */
function RecordsListDetailsTableWidget({ datasource }: { datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.list' }> }) {
    const details = useDashboardDetails()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const targetSectionId = readRecordsListTarget(datasource, details)
    const staticSearch = datasource.query?.search?.trim() || undefined
    const runtimeSort = useMemo(
        () => [...(datasource.query?.sort ?? []), ...mapGridSortModel(sortModel)],
        [datasource.query?.sort, sortModel]
    )
    const runtimeFilters = useMemo(
        () => [...(datasource.query?.filters ?? []), ...mapGridFilterModel(filterModel)],
        [datasource.query?.filters, filterModel]
    )
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'widget-datasource',
            datasource,
            { limit, offset, sort: runtimeSort, filters: runtimeFilters }
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit,
                offset,
                linkedCollectionId: targetSectionId,
                sectionId: targetSectionId,
                search: staticSearch,
                sort: runtimeSort,
                filters: runtimeFilters
            }),
        enabled: Boolean(details?.apiBaseUrl && details?.applicationId && targetSectionId),
        placeholderData: (previous) => previous
    })

    const columns = useMemo(() => (query.data ? toGridColumns(query.data) : []), [query.data])

    const setPaginationModel = (model: GridPaginationModel) => {
        setPaginationModelState(model)
    }

    const setSortModel = (model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const setFilterModel = (model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    if (!details?.apiBaseUrl || !details.applicationId || !targetSectionId) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <CustomizedDataGrid
            rows={query.data?.rows ?? []}
            columns={columns}
            loading={query.isLoading || query.isFetching}
            rowCount={query.data?.pagination.total ?? 0}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
            localeText={details.localeText}
        />
    )
}

const toLedgerGridRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { id: string }> =>
    rows.map((row, index) => {
        const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : row
        return {
            id: typeof row.id === 'string' ? row.id : `ledger-row-${index}`,
            ...(typeof row.createdAt !== 'undefined' ? { createdAt: row.createdAt } : {}),
            ...data
        }
    })

const toLedgerGridColumns = (
    rows: Array<Record<string, unknown>>
): Array<{ field: string; headerName: string; flex: number; minWidth: number }> => {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== 'id'))))
    return keys.map((key) => ({ field: key, headerName: key, flex: 1, minWidth: 140 }))
}

function LedgerDetailsTableWidget({
    datasource
}: {
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'ledger.facts' | 'ledger.projection' }>
}) {
    const details = useDashboardDetails()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const targetLedgerId = datasource.ledgerId ?? null
    const targetLedgerCodename = datasource.ledgerCodename ?? null
    const canFetch = Boolean(
        details?.apiBaseUrl &&
            details.applicationId &&
            (targetLedgerId || targetLedgerCodename) &&
            (datasource.kind !== 'ledger.projection' || datasource.projectionCodename)
    )

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'ledger-datasource',
            datasource,
            { limit, offset, locale: details?.locale ?? 'en' }
        ],
        queryFn: async () => {
            if (datasource.kind === 'ledger.facts') {
                return {
                    rows: toLedgerGridRows(
                        (
                            await fetchRuntimeLedgerFacts({
                                apiBaseUrl: details!.apiBaseUrl!,
                                applicationId: details!.applicationId!,
                                ledgerId: targetLedgerId,
                                ledgerCodename: targetLedgerCodename,
                                limit,
                                offset
                            })
                        ).rows
                    )
                }
            }

            return {
                rows: toLedgerGridRows(
                    (
                        await fetchRuntimeLedgerProjection({
                            apiBaseUrl: details!.apiBaseUrl!,
                            applicationId: details!.applicationId!,
                            ledgerId: targetLedgerId,
                            ledgerCodename: targetLedgerCodename,
                            projectionCodename: datasource.projectionCodename,
                            filters: datasource.filters,
                            limit,
                            offset
                        })
                    ).rows
                )
            }
        },
        enabled: canFetch,
        placeholderData: (previous) => previous
    })

    const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows])
    const columns = useMemo(() => toLedgerGridColumns(rows), [rows])

    if (!canFetch) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <CustomizedDataGrid
            rows={rows}
            columns={columns}
            loading={query.isLoading || query.isFetching}
            rowCount={rows.length}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModelState}
            pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
            localeText={details?.localeText}
        />
    )
}

function CurrentDetailsTableWidget() {
    const details = useDashboardDetails()
    if (!details) return null
    return (
        <CustomizedDataGrid
            rows={details.rows}
            columns={details.columns}
            loading={details.loading}
            rowCount={details.rowCount}
            paginationModel={details.paginationModel}
            onPaginationModelChange={details.onPaginationModelChange}
            sortModel={details.sortModel}
            onSortModelChange={details.onSortModelChange}
            filterModel={details.filterModel}
            onFilterModelChange={details.onFilterModelChange}
            pageSizeOptions={details.pageSizeOptions}
            localeText={details.localeText}
        />
    )
}

function DetailsTableWidget({ config }: { config?: Record<string, unknown> }) {
    const parsed = detailsTableWidgetConfigSchema.safeParse(config ?? {})
    const datasource = parsed.success ? parsed.data.datasource : undefined
    if (datasource?.kind === 'records.list') {
        return <RecordsListDetailsTableWidget datasource={datasource} />
    }
    if (datasource?.kind === 'ledger.facts' || datasource?.kind === 'ledger.projection') {
        return <LedgerDetailsTableWidget datasource={datasource} />
    }
    return <CurrentDetailsTableWidget />
}

/**
 * Shared widget renderer used by both left and right sidebars.
 * Maps widget keys to concrete React components.
 *
 * @param depth - Current nesting depth for columnsContainer (0 = top level). Used internally for recursion guard.
 */
export function renderWidget(widget: ZoneWidgetItem, menus?: DashboardMenusMap, fallbackMenu?: DashboardMenuSlot, depth = 0): ReactNode {
    switch (widget.widgetKey) {
        case 'brandSelector':
            return (
                <Box key={widget.id} sx={{ display: 'flex', p: 1.5 }}>
                    <SelectContent />
                </Box>
            )
        case 'divider':
            return <Divider key={widget.id} />
        case 'menuWidget': {
            const resolved = resolveMenuForWidget(widget, menus, fallbackMenu)
            return <MenuContent key={widget.id} menu={resolved} />
        }
        case 'workspaceSwitcher':
            return (
                <Box key={widget.id} sx={{ p: 1.5, pb: 0.75 }}>
                    <WorkspaceSwitcher variant='sidebar' />
                </Box>
            )
        case 'spacer':
            return <Box key={widget.id} sx={{ flexGrow: 1 }} />
        case 'infoCard':
            return <CardAlert key={widget.id} />
        case 'userProfile':
            return (
                <Stack
                    key={widget.id}
                    direction='row'
                    sx={{
                        p: 2,
                        gap: 1,
                        alignItems: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Avatar sizes='small' sx={{ width: 36, height: 36 }}>
                        <PersonRoundedIcon fontSize='small' />
                    </Avatar>
                    <Box sx={{ mr: 'auto' }}>
                        <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px' }}>
                            User
                        </Typography>
                    </Box>
                </Stack>
            )
        case 'productTree':
            return <CustomizedTreeView key={widget.id} />
        case 'usersByCountryChart':
            return <ChartUserByCountry key={widget.id} />
        case 'detailsTable':
            return <DetailsTableWidget key={widget.id} config={widget.config} />
        case 'quizWidget':
            return <QuizWidget key={widget.id} config={widget.config} />
        case 'columnsContainer': {
            // Guard against infinite recursion if a columnsContainer nests another
            if (depth >= MAX_CONTAINER_DEPTH) return null
            const colConfig = widget.config as unknown as ColumnsContainerConfig | undefined
            if (!colConfig?.columns || !Array.isArray(colConfig.columns) || colConfig.columns.length === 0) return null
            return (
                <Grid key={widget.id} container spacing={2} sx={{ width: '100%' }}>
                    {colConfig.columns.map((col) => (
                        <Grid key={col.id} size={{ xs: 12, md: col.width }}>
                            {(col.widgets ?? []).map((w, wIdx) => {
                                const inner: ZoneWidgetItem = {
                                    id: w.id ?? `${col.id}-w${wIdx}`,
                                    widgetKey: w.widgetKey,
                                    sortOrder: typeof w.sortOrder === 'number' ? w.sortOrder : wIdx,
                                    config: w.config ?? {}
                                }
                                return (
                                    <Box key={inner.id} sx={wIdx > 0 ? { mt: 2 } : undefined}>
                                        {renderWidget(inner, menus, fallbackMenu, depth + 1)}
                                    </Box>
                                )
                            })}
                        </Grid>
                    ))}
                </Grid>
            )
        }
        default:
            return null
    }
}
