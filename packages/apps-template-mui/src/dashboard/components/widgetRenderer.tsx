import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { GridColDef, GridFilterModel, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import Avatar from '@mui/material/Avatar'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import {
    detailsTableWidgetConfigSchema,
    detailsTabsWidgetConfigSchema,
    relationBuilderWidgetConfigSchema,
    readLocalizedTextValue,
    type ColumnsContainerConfig,
    type DetailsTabsWidgetConfig,
    type ReportDefinition,
    type RuntimePageBlock,
    type RuntimeDatasourceDescriptor,
    type RuntimeDatasourceSort,
    type SequencePolicy,
    type SequenceStep
} from '@universo/types'
import { COMPLETION_ITEM_STATUSES, evaluateSequenceStepAvailability } from '@universo/types'
import {
    exportRuntimeReportCsv,
    fetchAppData,
    fetchRuntimeLedgerFacts,
    fetchRuntimeLedgerProjection,
    reorderAppRows,
    restoreAppRow,
    runRuntimeReport,
    updateLearningContentProgress
} from '../../api/api'
import type { AppDataResponse } from '../../api/api'
import { ResourcePreview } from '../../components/resource-preview'
import { toGridColumns } from '../../utils/columns'
import { formatRuntimeValue } from '../../utils/displayValue'
import { findRuntimeSectionIdByCodename } from '../../utils/runtimeSections'
import { mapGridFilterModel, mapGridSortModel } from '../../utils/runtimeListQuery'
import { FlowListTable, type DragEndEvent, type TableColumn } from '../../components/runtime-ui'
import SelectContent from './SelectContent'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import CustomizedTreeView from './CustomizedTreeView'
import ChartUserByCountry from './ChartUserByCountry'
import CustomizedDataGrid from './CustomizedDataGrid'
import QuizWidget from './QuizWidget'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { RelationBuilderWidget } from './RelationBuilderWidget'
import PageBlocksView from './PageBlocksView'
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
const REORDER_LIST_LIMIT = 100
const COMPLETION_STATUS_SET = new Set<string>(COMPLETION_ITEM_STATUSES)
const SEQUENCE_REASON_FALLBACK_LABELS: Record<string, string> = {
    missingStep: 'Missing step',
    scheduledNotStarted: 'Not started',
    scheduledExpired: 'Expired',
    sequentialLocked: 'Locked',
    prerequisiteLocked: 'Prerequisite locked'
}

const readRuntimeRowVersion = (row: Record<string, unknown> | null | undefined): number | undefined => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : undefined
}

const readLocalizedWidgetText = (value: unknown, locale: string | undefined): string | undefined =>
    readLocalizedTextValue(value, locale ?? 'en')

const createGridColumnSource = (columns: AppDataResponse['columns'], rows: AppDataResponse['rows'], total: number): AppDataResponse =>
    ({
        section: null,
        objectCollection: null,
        sections: [],
        objectCollections: [],
        activeSectionId: null,
        activeObjectCollectionId: null,
        columns,
        rows,
        pagination: {
            total,
            limit: rows.length,
            offset: 0
        },
        layoutConfig: {},
        zoneWidgets: {
            left: [],
            right: [],
            center: []
        },
        menus: [],
        activeMenuId: null
    } as unknown as AppDataResponse)

const readRecordsListTarget = (datasource: RuntimeDatasourceDescriptor, details: DashboardDetailsSlot | undefined): string | undefined => {
    if (datasource.kind !== 'records.list') return undefined
    return (
        datasource.sectionId ??
        datasource.objectCollectionId ??
        findRuntimeSectionIdByCodename(details, datasource.sectionCodename ?? datasource.objectCollectionCodename) ??
        undefined
    )
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

const buildFlowListColumns = (
    columns: AppDataResponse['columns'],
    locale: string
): Array<TableColumn<Record<string, unknown> & { id: string }>> =>
    columns
        .filter((column) => column.field !== 'id' && column.field !== 'actions')
        .slice(0, 6)
        .map((column) => ({
            id: column.field,
            label: column.headerName || column.codename || column.field,
            render: (row) => formatRuntimeValue(row[column.field], locale)
        }))

const compareRuntimeValues = (left: unknown, right: unknown): number => {
    const leftNumber = typeof left === 'number' ? left : typeof left === 'string' && left.trim() ? Number(left) : Number.NaN
    const rightNumber = typeof right === 'number' ? right : typeof right === 'string' && right.trim() ? Number(right) : Number.NaN
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber
    }
    return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

const sortRuntimeRows = <T extends Record<string, unknown>>(rows: T[], sort: RuntimeDatasourceSort[] | undefined): T[] => {
    if (!Array.isArray(sort) || sort.length === 0) return rows

    return [...rows].sort((left, right) => {
        for (const descriptor of sort) {
            if (!descriptor || typeof descriptor.field !== 'string') continue
            const result = compareRuntimeValues(left[descriptor.field], right[descriptor.field])
            if (result !== 0) return descriptor.direction === 'desc' ? -result : result
        }
        return 0
    })
}

const readSequenceNumber = (row: Record<string, unknown>, field: string | undefined): number | undefined => {
    if (!field) return undefined
    const value = row[field]
    const numberValue =
        typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    return Number.isFinite(numberValue) ? numberValue : undefined
}

const readSequenceString = (row: Record<string, unknown>, field: string | undefined): string | undefined => {
    if (!field) return undefined
    const value = row[field]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const readSequenceStatus = (row: Record<string, unknown>) => {
    const candidates = [row.ProgressStatus, row.CompletionStatus, row.Status, row.status]
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
    if (typeof value !== 'string') return 'notStarted' as const
    return COMPLETION_STATUS_SET.has(value) ? (value as (typeof COMPLETION_ITEM_STATUSES)[number]) : ('notStarted' as const)
}

const readSequenceScopeKey = (row: Record<string, unknown>, field: string | undefined): string => {
    if (!field) return '__all__'
    const value = row[field]
    if (value === null || value === undefined) return '__missing__'
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id
    return JSON.stringify(value)
}

const readSequencePrerequisiteIds = (row: Record<string, unknown>, field: string | undefined): string[] => {
    if (!field) return []
    const value = row[field]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (typeof value !== 'string') return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

const addSequenceAvailabilityState = (
    rows: Array<Record<string, unknown> & { id: string }>,
    sequencePolicy: SequencePolicy | undefined
): Array<Record<string, unknown> & { id: string }> => {
    if (!sequencePolicy) return rows

    const rowsByScope = new Map<string, Array<Record<string, unknown> & { id: string }>>()
    rows.forEach((row) => {
        const scopeKey = readSequenceScopeKey(row, sequencePolicy.scopeFieldCodename)
        rowsByScope.set(scopeKey, [...(rowsByScope.get(scopeKey) ?? []), row])
    })

    const stepsByScope = new Map<string, SequenceStep[]>()
    rowsByScope.forEach((scopedRows, scopeKey) => {
        const scopedSteps = scopedRows.flatMap((row) => {
            const id = typeof row.id === 'string' ? row.id : null
            if (!id) return []

            return [
                {
                    id,
                    order: readSequenceNumber(row, sequencePolicy.orderFieldCodename),
                    availableFrom: readSequenceString(row, sequencePolicy.availableFromFieldCodename),
                    availableTo: readSequenceString(row, sequencePolicy.availableToFieldCodename),
                    status: readSequenceStatus(row),
                    progressPercent: readSequenceNumber(row, 'ProgressPercent') ?? readSequenceNumber(row, 'progressPercent'),
                    prerequisiteStepIds: readSequencePrerequisiteIds(row, sequencePolicy.prerequisiteFieldCodename)
                }
            ]
        })
        stepsByScope.set(scopeKey, scopedSteps)
    })

    return rows.map((row) => {
        const id = typeof row.id === 'string' ? row.id : null
        if (!id) return row
        const scopeKey = readSequenceScopeKey(row, sequencePolicy.scopeFieldCodename)
        const steps = stepsByScope.get(scopeKey) ?? []
        const availability = evaluateSequenceStepAvailability(sequencePolicy, steps, id)
        return {
            ...row,
            __runtimeSequenceAvailability: availability.reason,
            __runtimeSequenceLockedBy: availability.lockedByStepIds.join(', ')
        }
    })
}

const readRecordsUnionTargets = (
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }>,
    details: DashboardDetailsSlot | undefined
): Array<{ sectionId: string; displayType?: string }> =>
    datasource.targets.flatMap((target) => {
        const sectionId =
            target.sectionId ??
            target.objectCollectionId ??
            findRuntimeSectionIdByCodename(details, target.sectionCodename ?? target.objectCollectionCodename)

        if (!sectionId) return []

        return [{ sectionId, displayType: target.displayType }]
    })

/**
 * Inner component for detailsTable widget that consumes DashboardDetailsContext.
 * Must be a proper React component (not a plain function) to use hooks.
 */
function RecordsListDetailsTableWidget({
    datasource,
    enableRowReordering,
    rowCountWarning,
    sequencePolicy
}: {
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.list' }>
    enableRowReordering?: boolean
    rowCountWarning?: {
        threshold: number
        message: string | Record<string, unknown>
    }
    sequencePolicy?: SequencePolicy
}) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [orderedRows, setOrderedRows] = useState<Array<Record<string, unknown> & { id: string }>>([])
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
    const limit = enableRowReordering ? REORDER_LIST_LIMIT : paginationModel.pageSize
    const offset = enableRowReordering ? 0 : paginationModel.page * paginationModel.pageSize
    const queryKey = useMemo(
        () =>
            [
                ...(details?.runtimeQueryKeyPrefix ?? []),
                'widget-datasource',
                datasource,
                { limit, offset, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [details?.runtimeQueryKeyPrefix, datasource, limit, offset, runtimeSort, runtimeFilters]
    )

    const query = useQuery({
        queryKey,
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit,
                offset,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                workspaceId: details?.currentWorkspaceId ?? null,
                lifecycleState: datasource.query?.lifecycleState,
                search: staticSearch,
                sort: runtimeSort,
                filters: runtimeFilters
            }),
        enabled: Boolean(details?.apiBaseUrl && details?.applicationId && targetSectionId),
        placeholderData: (previous) => previous
    })

    useEffect(() => {
        setOrderedRows((query.data?.rows ?? []) as Array<Record<string, unknown> & { id: string }>)
    }, [query.data?.rows])

    const reorderMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-reorder', targetSectionId],
        mutationFn: async (orderedRowIds: string[]) => {
            if (!details?.apiBaseUrl || !details.applicationId || !targetSectionId) {
                throw new Error(t('app.reorderUnavailable', 'Row reordering is not available for this table.'))
            }

            await reorderAppRows({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                orderedRowIds
            })
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })

    const columns = useMemo(() => {
        if (!query.data) return []
        const baseColumns = toGridColumns(query.data, { locale: details?.locale ?? 'en' })
        if (!sequencePolicy) return baseColumns

        const sequenceColumns = [
            {
                field: '__runtimeSequenceAvailability',
                headerName: t('sequence.availability', 'Availability'),
                minWidth: 150,
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    const reason = String(params.value ?? 'available')
                    const isAvailable = reason === 'available'
                    return (
                        <Chip
                            size='small'
                            color={isAvailable ? 'success' : 'default'}
                            variant={isAvailable ? 'filled' : 'outlined'}
                            label={
                                isAvailable
                                    ? t('sequence.available', 'Available')
                                    : t(
                                          `sequence.reasons.${reason}`,
                                          SEQUENCE_REASON_FALLBACK_LABELS[reason] ?? reason.replace(/([A-Z])/g, ' $1').toLowerCase()
                                      )
                            }
                        />
                    )
                }
            },
            {
                field: '__runtimeSequenceLockedBy',
                headerName: t('sequence.lockedBy', 'Locked by'),
                minWidth: 160,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Typography variant='body2' color='text.secondary'>
                        {String(params.value ?? '')}
                    </Typography>
                )
            }
        ] satisfies GridColDef[]

        return [...sequenceColumns, ...baseColumns]
    }, [details?.locale, query.data, sequencePolicy, t])
    const flowListColumns = useMemo(
        () => buildFlowListColumns(query.data?.columns ?? [], details?.locale ?? 'en'),
        [details?.locale, query.data?.columns]
    )

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

    const canPersistRowReordering =
        enableRowReordering === true &&
        (query.data?.pagination.total ?? 0) === orderedRows.length &&
        orderedRows.length <= REORDER_LIST_LIMIT &&
        orderedRows.length > 0
    const totalRows = query.data?.pagination.total ?? 0
    const warningText =
        rowCountWarning && totalRows >= rowCountWarning.threshold ? readLocalizedWidgetText(rowCountWarning.message, details.locale) : null

    const handleSortableDragEnd = (event: DragEndEvent) => {
        if (!canPersistRowReordering || reorderMutation.isPending) return

        const activeId = String(event.active.id)
        const overId = event.over ? String(event.over.id) : null
        setOrderedRows((rows) => {
            const nextRows = reorderRowsByIds(rows, activeId, overId)
            const nextIds = nextRows.map((row) => row.id)
            void reorderMutation.mutateAsync(nextIds).catch(() => {
                setOrderedRows(rows)
            })
            return nextRows
        })
    }

    if (enableRowReordering) {
        return (
            <Stack spacing={1}>
                {warningText ? <Alert severity='warning'>{warningText}</Alert> : null}
                {!canPersistRowReordering ? (
                    <Typography variant='caption' color='text.secondary'>
                        {t(
                            'app.reorderRequiresCompleteDataset',
                            'Row reordering is available only when all rows are loaded and search is cleared.'
                        )}
                    </Typography>
                ) : null}
                <FlowListTable<Record<string, unknown> & { id: string }>
                    data={orderedRows}
                    customColumns={flowListColumns}
                    isLoading={query.isLoading || query.isFetching || reorderMutation.isPending}
                    sortableRows={canPersistRowReordering}
                    onSortableDragEnd={handleSortableDragEnd}
                    sortStateId={`datasource-${targetSectionId}-row-order`}
                />
            </Stack>
        )
    }

    return (
        <Stack spacing={1}>
            {warningText ? <Alert severity='warning'>{warningText}</Alert> : null}
            <CustomizedDataGrid
                rows={addSequenceAvailabilityState(
                    (query.data?.rows ?? []) as Array<Record<string, unknown> & { id: string }>,
                    sequencePolicy
                )}
                columns={columns}
                loading={query.isLoading || query.isFetching}
                rowCount={totalRows}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                sortModel={sortModel}
                onSortModelChange={setSortModel}
                filterModel={filterModel}
                onFilterModelChange={setFilterModel}
                pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                localeText={details.localeText}
            />
        </Stack>
    )
}

function RecordsUnionDetailsTableWidget({ datasource }: { datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }> }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const targets = useMemo(() => readRecordsUnionTargets(datasource, details), [datasource, details])
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
    const requestLimit = offset + limit
    const queryKey = useMemo(
        () =>
            [
                ...(details?.runtimeQueryKeyPrefix ?? []),
                'widget-datasource-union',
                datasource,
                { limit, offset, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [details?.runtimeQueryKeyPrefix, datasource, limit, offset, runtimeSort, runtimeFilters]
    )

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const responses = await Promise.all(
                targets.map((target) =>
                    fetchAppData({
                        apiBaseUrl: details!.apiBaseUrl!,
                        applicationId: details!.applicationId!,
                        locale: details?.locale ?? 'en',
                        limit: requestLimit,
                        offset: 0,
                        objectCollectionId: target.sectionId,
                        sectionId: target.sectionId,
                        workspaceId: details?.currentWorkspaceId ?? null,
                        lifecycleState: datasource.query?.lifecycleState,
                        libraryView: datasource.query?.libraryView,
                        search: staticSearch,
                        sort: runtimeSort,
                        filters: runtimeFilters
                    }).then((response) => ({ target, response }))
                )
            )

            return {
                columns: responses[0]?.response.columns ?? [],
                total: responses.reduce((sum, item) => sum + (item.response.pagination.total ?? item.response.rows.length), 0),
                rows: sortRuntimeRows(
                    responses.flatMap(({ target, response }) =>
                        response.rows.map((row) => ({
                            ...row,
                            id: `${target.sectionId}:${row.id}`,
                            __runtimeObjectCollectionId: target.sectionId,
                            __runtimeSourceRowId: row.id,
                            __runtimeDisplayType: target.displayType
                        }))
                    ),
                    runtimeSort
                ).slice(offset, offset + limit)
            }
        },
        enabled: Boolean(details?.apiBaseUrl && details?.applicationId && targets.length > 0),
        placeholderData: (previous) => previous
    })

    const restoreMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-union-restore'],
        mutationFn: async (row: Record<string, unknown>) => {
            const sourceRowId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : null
            const objectCollectionId = typeof row.__runtimeObjectCollectionId === 'string' ? row.__runtimeObjectCollectionId : null
            if (!details?.apiBaseUrl || !details.applicationId || !sourceRowId || !objectCollectionId) {
                throw new Error(t('trash.restoreUnavailable', 'Restore is not available for this row.'))
            }

            await restoreAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: sourceRowId,
                objectCollectionId,
                sectionId: objectCollectionId,
                expectedVersion: readRuntimeRowVersion(row)
            })
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })

    const columns = useMemo(() => {
        if (!query.data) return []
        const baseColumns = toGridColumns(createGridColumnSource(query.data.columns, query.data.rows, query.data.total), {
            locale: details?.locale ?? 'en'
        })

        if (datasource.query?.lifecycleState !== 'deleted') {
            return baseColumns
        }

        return [
            ...baseColumns,
            {
                field: '__runtimeRestore',
                headerName: t('trash.actions', 'Actions'),
                width: 130,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                    <Button
                        type='button'
                        size='small'
                        variant='outlined'
                        startIcon={<RestoreRoundedIcon fontSize='small' />}
                        disabled={restoreMutation.isPending}
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void restoreMutation.mutateAsync(params.row)
                        }}
                    >
                        {t('trash.restore', 'Restore')}
                    </Button>
                )
            } satisfies GridColDef
        ]
    }, [datasource.query?.lifecycleState, details?.locale, query.data, restoreMutation, t])

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

    if (!details?.apiBaseUrl || !details.applicationId || targets.length === 0) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <CustomizedDataGrid
            rows={query.data?.rows ?? []}
            columns={columns}
            loading={query.isLoading || query.isFetching}
            rowCount={query.data?.total ?? 0}
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

const toLedgerGridColumns = (rows: Array<Record<string, unknown>>, locale: string): GridColDef[] => {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== 'id'))))
    return keys.map((key) => ({
        field: key,
        headerName: key,
        flex: 1,
        minWidth: 140,
        renderCell: (params) => formatRuntimeValue(params.value, locale)
    }))
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
    const columns = useMemo(() => toLedgerGridColumns(rows, details?.locale ?? 'en'), [rows, details?.locale])

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

const toReportGridRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { id: string }> =>
    rows.map((row, index) => ({
        id: typeof row.id === 'string' ? row.id : `report-row-${index}`,
        ...row
    }))

const toReportGridColumns = (definition: ReportDefinition, locale: string): GridColDef[] =>
    definition.columns.map((column) => ({
        field: column.field,
        headerName: readLocalizedWidgetText(column.label, locale) ?? column.field,
        flex: 1,
        minWidth: column.type === 'number' ? 120 : 160,
        type: column.type === 'number' || column.type === 'boolean' ? column.type : 'string',
        renderCell: (params) => formatRuntimeValue(params.value, locale)
    }))

function ReportDetailsTableWidget({ definition }: { definition: ReportDefinition }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const canFetch = Boolean(details?.apiBaseUrl && details.applicationId)
    const reportCodename = definition.codename

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'report-definition',
            reportCodename,
            { limit, offset, workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            runRuntimeReport({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                reportCodename,
                limit,
                offset,
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: canFetch,
        placeholderData: (previous) => previous
    })

    const rows = useMemo(() => toReportGridRows(query.data?.rows ?? []), [query.data?.rows])
    const columns = useMemo(
        () => toReportGridColumns(query.data?.definition ?? definition, details?.locale ?? 'en'),
        [definition, details?.locale, query.data?.definition]
    )

    const handleExport = async () => {
        if (!details?.apiBaseUrl || !details.applicationId) return

        setIsExporting(true)
        setExportError(null)
        try {
            const blob = await exportRuntimeReportCsv({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                reportCodename,
                limit: 5000,
                offset: 0,
                locale: details.locale ?? 'en',
                workspaceId: details.currentWorkspaceId
            })
            if (typeof URL.createObjectURL !== 'function') {
                throw new Error(t('reports.exportUnsupported'))
            }

            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = `${reportCodename.replace(/[^a-zA-Z0-9._-]+/g, '-') || 'runtime-report'}.csv`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(objectUrl)
        } catch (error) {
            setExportError(error instanceof Error ? error.message : String(error))
        } finally {
            setIsExporting(false)
        }
    }

    if (!canFetch) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <Stack spacing={1.5}>
            <Stack direction='row' justifyContent='flex-end'>
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    startIcon={<FileDownloadRoundedIcon fontSize='small' />}
                    disabled={isExporting}
                    onClick={handleExport}
                >
                    {isExporting ? t('reports.exporting') : t('reports.exportCsv')}
                </Button>
            </Stack>
            {exportError ? (
                <Typography variant='body2' color='error'>
                    {t('reports.exportError', { message: exportError })}
                </Typography>
            ) : null}
            <CustomizedDataGrid
                rows={rows}
                columns={columns}
                loading={query.isLoading || query.isFetching}
                rowCount={query.data?.total ?? 0}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModelState}
                pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                localeText={details?.localeText}
            />
        </Stack>
    )
}

function ResourcePreviewWidget({ config }: { config?: Record<string, unknown> }) {
    const details = useDashboardDetails()

    return (
        <ResourcePreview
            source={config?.source}
            title={readLocalizedWidgetText(config?.title, details?.locale)}
            description={readLocalizedWidgetText(config?.description, details?.locale)}
        />
    )
}

type LearnerPlayerConfig = {
    parentDatasource?: RuntimeDatasourceDescriptor
    itemsDatasource?: RuntimeDatasourceDescriptor
    parentLabel?: unknown
    parentFieldCodename?: string
    itemTitleFieldCodename?: string
    targetObjectCodenameField?: string
    targetObjectCodename?: string
    targetRecordIdField?: string
    completionTargetObjectCodename?: string
    sequencePolicy?: SequencePolicy
    targetContent?: {
        titleFieldCodename?: string
        descriptionFieldCodename?: string
        sourceFieldCodename?: string
        bodyFieldCodename?: string
    }
}

const readWidgetString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const readWidgetRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const readLearnerPlayerConfig = (config: Record<string, unknown> | undefined): LearnerPlayerConfig => {
    const targetContent = readWidgetRecord(config?.targetContent)
    return {
        parentDatasource: readWidgetRecord(config?.parentDatasource) as RuntimeDatasourceDescriptor | undefined,
        itemsDatasource: readWidgetRecord(config?.itemsDatasource) as RuntimeDatasourceDescriptor | undefined,
        parentLabel: config?.parentLabel,
        parentFieldCodename: readWidgetString(config?.parentFieldCodename),
        itemTitleFieldCodename: readWidgetString(config?.itemTitleFieldCodename) ?? 'Title',
        targetObjectCodenameField: readWidgetString(config?.targetObjectCodenameField) ?? 'TargetObjectCodename',
        targetObjectCodename: readWidgetString(config?.targetObjectCodename),
        targetRecordIdField: readWidgetString(config?.targetRecordIdField) ?? 'TargetRecordId',
        completionTargetObjectCodename: readWidgetString(config?.completionTargetObjectCodename),
        sequencePolicy: readWidgetRecord(config?.sequencePolicy) as SequencePolicy | undefined,
        targetContent: {
            titleFieldCodename: readWidgetString(targetContent?.titleFieldCodename) ?? 'Title',
            descriptionFieldCodename: readWidgetString(targetContent?.descriptionFieldCodename) ?? 'Description',
            sourceFieldCodename: readWidgetString(targetContent?.sourceFieldCodename) ?? 'Source',
            bodyFieldCodename: readWidgetString(targetContent?.bodyFieldCodename) ?? 'Body'
        }
    }
}

const readRowText = (row: Record<string, unknown> | undefined, field: string | undefined, locale: string | undefined): string => {
    if (!row || !field) return ''
    const value = row[field]
    const localized = readLocalizedWidgetText(value, locale)
    if (localized) return localized
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

const readRowString = (row: Record<string, unknown> | undefined, field: string | undefined): string | undefined => {
    if (!row || !field) return undefined
    const value = row[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return undefined
}

type RuntimeColumnAlias = {
    codename?: unknown
    field?: unknown
}

const addColumnCodenameAliases = (
    row: Record<string, unknown> & { id: string },
    columns: readonly RuntimeColumnAlias[] | undefined
): Record<string, unknown> & { id: string } => {
    if (!columns?.length) return row

    const aliases = columns.reduce<Record<string, unknown>>((acc, column) => {
        if (typeof column.codename !== 'string' || typeof column.field !== 'string') {
            return acc
        }
        if (column.codename === column.field || Object.prototype.hasOwnProperty.call(row, column.codename)) {
            return acc
        }
        if (Object.prototype.hasOwnProperty.call(row, column.field)) {
            acc[column.codename] = row[column.field]
        }
        return acc
    }, {})

    return Object.keys(aliases).length > 0 ? { ...row, ...aliases } : row
}

function LearnerPlayerWidget({ config }: { config?: Record<string, unknown> }) {
    const details = useDashboardDetails()
    const queryClient = useQueryClient()
    const { t } = useTranslation('apps')
    const widgetConfig = useMemo(() => readLearnerPlayerConfig(config), [config])
    const parentDatasource = widgetConfig.parentDatasource
    const itemsDatasource = widgetConfig.itemsDatasource
    const applicationId = details?.applicationId
    const apiBaseUrl = details?.apiBaseUrl
    const locale = details?.locale ?? 'en'
    const workspaceId = details?.currentWorkspaceId ?? null

    const parentSectionId = useMemo(
        () => (parentDatasource ? readRecordsListTarget(parentDatasource, details) : undefined),
        [details, parentDatasource]
    )
    const itemsSectionId = useMemo(
        () => (itemsDatasource ? readRecordsListTarget(itemsDatasource, details) : undefined),
        [details, itemsDatasource]
    )

    const parentQuery = useQuery({
        queryKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'learner-player-parents', parentDatasource, workspaceId, locale],
        enabled: Boolean(applicationId && apiBaseUrl && parentDatasource?.kind === 'records.list' && parentSectionId),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: parentSectionId,
                workspaceId,
                limit: 50,
                offset: 0,
                locale,
                sort: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.sort : undefined,
                filters: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.filters : undefined,
                search: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.search : undefined
            })
    })

    const parentRows = useMemo(() => {
        const sourceRows = parentQuery.data?.rows ?? details?.rows ?? []
        const columns = parentQuery.data?.rows ? parentQuery.data.columns : details?.columns
        return sourceRows.map((row) => addColumnCodenameAliases(row, columns))
    }, [details?.columns, details?.rows, parentQuery.data?.columns, parentQuery.data?.rows])
    const [selectedParentId, setSelectedParentId] = useState<string>('')

    useEffect(() => {
        if (parentRows.length === 0) {
            setSelectedParentId('')
            return
        }
        if (parentRows.some((row) => row.id === selectedParentId)) return
        setSelectedParentId(parentRows[0].id)
    }, [parentRows, selectedParentId])

    const itemFilters = useMemo(() => {
        const filters = itemsDatasource?.kind === 'records.list' ? [...(itemsDatasource.query?.filters ?? [])] : []
        if (widgetConfig.parentFieldCodename && selectedParentId) {
            filters.push({ field: widgetConfig.parentFieldCodename, operator: 'equals', value: selectedParentId })
        }
        return filters
    }, [itemsDatasource, selectedParentId, widgetConfig.parentFieldCodename])

    const itemsQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'learner-player-items',
            itemsDatasource,
            selectedParentId,
            workspaceId,
            locale
        ],
        enabled: Boolean(applicationId && apiBaseUrl && itemsDatasource?.kind === 'records.list' && itemsSectionId && selectedParentId),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: itemsSectionId,
                workspaceId,
                limit: 100,
                offset: 0,
                locale,
                sort: itemsDatasource?.kind === 'records.list' ? itemsDatasource.query?.sort : undefined,
                filters: itemFilters,
                search: itemsDatasource?.kind === 'records.list' ? itemsDatasource.query?.search : undefined
            })
    })

    const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(() => new Set())
    const playerRows = useMemo(() => {
        const rows = (itemsQuery.data?.rows ?? []).map((row) => {
            const aliasedRow = addColumnCodenameAliases(row, itemsQuery.data?.columns)
            return completedItemIds.has(row.id) ? { ...aliasedRow, ProgressStatus: 'completed', ProgressPercent: 100 } : aliasedRow
        })
        return addSequenceAvailabilityState(rows, widgetConfig.sequencePolicy)
    }, [completedItemIds, itemsQuery.data?.columns, itemsQuery.data?.rows, widgetConfig.sequencePolicy])
    const [selectedItemId, setSelectedItemId] = useState<string>('')

    useEffect(() => {
        if (playerRows.length === 0) {
            setSelectedItemId('')
            return
        }
        if (playerRows.some((row) => row.id === selectedItemId)) return
        setSelectedItemId(playerRows[0].id)
    }, [playerRows, selectedItemId])

    const selectedItem = playerRows.find((row) => row.id === selectedItemId) ?? playerRows[0]
    const selectedItemIndex = selectedItem ? playerRows.findIndex((row) => row.id === selectedItem.id) : -1
    const selectedItemLocked = Boolean(
        selectedItem?.__runtimeSequenceAvailability && selectedItem.__runtimeSequenceAvailability !== 'available'
    )
    const selectedTargetObjectCodename =
        readRowString(selectedItem, widgetConfig.targetObjectCodenameField) ?? widgetConfig.targetObjectCodename
    const selectedTargetRecordId = readRowString(selectedItem, widgetConfig.targetRecordIdField)
    const targetSectionId = useMemo(
        () => (selectedTargetObjectCodename ? findRuntimeSectionIdByCodename(details, selectedTargetObjectCodename) : undefined),
        [details, selectedTargetObjectCodename]
    )

    const targetQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'learner-player-target',
            selectedTargetObjectCodename,
            selectedTargetRecordId,
            workspaceId,
            locale
        ],
        enabled: Boolean(applicationId && apiBaseUrl && targetSectionId && selectedTargetRecordId && !selectedItemLocked),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: targetSectionId,
                workspaceId,
                limit: 100,
                offset: 0,
                locale
            })
    })
    const targetRows = useMemo(
        () => (targetQuery.data?.rows ?? []).map((row) => addColumnCodenameAliases(row, targetQuery.data?.columns)),
        [targetQuery.data?.columns, targetQuery.data?.rows]
    )
    const targetRecord = targetRows.find((row) => row.id === selectedTargetRecordId)

    const completeMutation = useMutation({
        mutationFn: async () => {
            if (!apiBaseUrl || !applicationId || !selectedItem) return
            await updateLearningContentProgress({
                apiBaseUrl,
                applicationId,
                targetObjectCodename:
                    widgetConfig.completionTargetObjectCodename ??
                    (itemsDatasource?.kind === 'records.list' ? itemsDatasource.sectionCodename : undefined) ??
                    'RuntimeItem',
                targetRecordId: selectedItem.id,
                progressPercent: 100,
                action: 'complete',
                status: 'completed'
            })
        },
        onSuccess: async () => {
            if (!selectedItem) return
            setCompletedItemIds((current) => new Set(current).add(selectedItem.id))
            await queryClient.invalidateQueries({ queryKey: details?.runtimeQueryKeyPrefix ?? [] })
        }
    })

    if (!parentDatasource || !itemsDatasource) {
        return null
    }

    if (parentQuery.isLoading || (parentRows.length > 0 && !selectedParentId) || itemsQuery.isLoading) {
        return <Alert severity='info'>{t('learnerPlayer.loading', 'Loading player...')}</Alert>
    }

    if (parentRows.length === 0) {
        return <Alert severity='info'>{t('learnerPlayer.emptyParent', 'No learning content is available yet.')}</Alert>
    }

    const selectedParent = parentRows.find((row) => row.id === selectedParentId) ?? parentRows[0]
    const progressPercent = playerRows.length > 0 ? Math.round((completedItemIds.size / playerRows.length) * 100) : 0
    const targetSource = targetRecord?.[widgetConfig.targetContent?.sourceFieldCodename ?? 'Source']
    const targetBody = targetRecord?.[widgetConfig.targetContent?.bodyFieldCodename ?? 'Body']
    const targetBlocks = Array.isArray(targetBody) ? (targetBody as RuntimePageBlock[]) : []
    const selectedTitle = readRowText(selectedItem, widgetConfig.itemTitleFieldCodename, locale) || selectedItem?.id || ''

    return (
        <Stack data-testid='learner-player' spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='h6' sx={{ fontWeight: 700 }}>
                        {readRowText(selectedParent, 'Title', locale) || readRowText(selectedParent, 'Name', locale) || selectedParent.id}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t('learnerPlayer.progress', '{{completed}} of {{total}} completed', {
                            completed: completedItemIds.size,
                            total: playerRows.length
                        })}
                    </Typography>
                    <LinearProgress
                        aria-label={t('learnerPlayer.progressLabel', 'Learner progress')}
                        variant='determinate'
                        value={progressPercent}
                        sx={{ mt: 1 }}
                    />
                </Box>
                {parentRows.length > 1 ? (
                    <FormControl size='small' sx={{ minWidth: { xs: '100%', md: 260 } }}>
                        <InputLabel id='learner-player-parent-label'>
                            {readLocalizedWidgetText(widgetConfig.parentLabel, locale) ?? t('learnerPlayer.parentLabel', 'Content')}
                        </InputLabel>
                        <Select
                            data-testid='learner-player-parent-select'
                            labelId='learner-player-parent-label'
                            value={selectedParentId}
                            label={readLocalizedWidgetText(widgetConfig.parentLabel, locale) ?? t('learnerPlayer.parentLabel', 'Content')}
                            onChange={(event) => setSelectedParentId(String(event.target.value))}
                        >
                            {parentRows.map((row) => (
                                <MenuItem key={row.id} value={row.id}>
                                    {readRowText(row, 'Title', locale) || readRowText(row, 'Name', locale) || row.id}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}
                <Stack direction='row' spacing={1}>
                    <Button
                        size='small'
                        variant='outlined'
                        startIcon={<NavigateBeforeRoundedIcon />}
                        disabled={selectedItemIndex <= 0}
                        onClick={() => setSelectedItemId(playerRows[selectedItemIndex - 1]?.id ?? selectedItemId)}
                    >
                        {t('learnerPlayer.previous', 'Previous')}
                    </Button>
                    <Button
                        size='small'
                        variant='outlined'
                        endIcon={<NavigateNextRoundedIcon />}
                        disabled={selectedItemIndex < 0 || selectedItemIndex >= playerRows.length - 1}
                        onClick={() => setSelectedItemId(playerRows[selectedItemIndex + 1]?.id ?? selectedItemId)}
                    >
                        {t('learnerPlayer.next', 'Next')}
                    </Button>
                </Stack>
            </Stack>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Stack spacing={1} data-testid='learner-player-outline'>
                        {playerRows.map((row, index) => {
                            const locked = row.__runtimeSequenceAvailability && row.__runtimeSequenceAvailability !== 'available'
                            const completed = completedItemIds.has(row.id) || readSequenceStatus(row) === 'completed'
                            return (
                                <Button
                                    key={row.id}
                                    fullWidth
                                    variant={row.id === selectedItem?.id ? 'contained' : 'outlined'}
                                    color={locked ? 'inherit' : 'primary'}
                                    startIcon={locked ? <LockRoundedIcon /> : completed ? <CheckCircleRoundedIcon /> : undefined}
                                    onClick={() => setSelectedItemId(row.id)}
                                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                >
                                    <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0, width: '100%' }}>
                                        <Typography component='span' variant='body2' sx={{ flex: 1, minWidth: 0 }} noWrap>
                                            {index + 1}. {readRowText(row, widgetConfig.itemTitleFieldCodename, locale) || row.id}
                                        </Typography>
                                        {locked ? <Chip size='small' label={t('learnerPlayer.locked', 'Locked')} /> : null}
                                    </Stack>
                                </Button>
                            )
                        })}
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Stack spacing={2} data-testid='learner-player-content'>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                                    {selectedTitle}
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {selectedTargetObjectCodename ?? t('learnerPlayer.noTarget', 'No target')}
                                </Typography>
                            </Box>
                            <Button
                                size='small'
                                variant='contained'
                                startIcon={<CheckCircleRoundedIcon />}
                                disabled={!selectedItem || Boolean(selectedItemLocked) || completeMutation.isPending}
                                onClick={() => completeMutation.mutate()}
                            >
                                {t('learnerPlayer.complete', 'Complete')}
                            </Button>
                        </Stack>

                        {selectedItemLocked ? (
                            <Alert severity='warning'>
                                {t('learnerPlayer.lockedMessage', 'Complete previous items to unlock this content.')}
                            </Alert>
                        ) : targetQuery.isLoading ? (
                            <Alert severity='info'>{t('learnerPlayer.loadingContent', 'Loading content...')}</Alert>
                        ) : targetRecord ? (
                            <>
                                {targetSource ? (
                                    <ResourcePreview
                                        source={targetSource}
                                        title={readRowText(targetRecord, widgetConfig.targetContent?.titleFieldCodename, locale)}
                                        description={readRowText(
                                            targetRecord,
                                            widgetConfig.targetContent?.descriptionFieldCodename,
                                            locale
                                        )}
                                    />
                                ) : null}
                                {targetBlocks.length > 0 ? (
                                    <PageBlocksView
                                        blocks={targetBlocks}
                                        showOutline
                                        showProgressHeader={false}
                                        completeButtonMode='hidden'
                                    />
                                ) : null}
                                {!targetSource && targetBlocks.length === 0 ? (
                                    <Alert severity='info'>
                                        {t('learnerPlayer.noPreview', 'This content item does not have a previewable source yet.')}
                                    </Alert>
                                ) : null}
                            </>
                        ) : (
                            <Alert severity='info'>{t('learnerPlayer.targetNotFound', 'The selected content record was not found.')}</Alert>
                        )}
                    </Stack>
                </Grid>
            </Grid>
        </Stack>
    )
}

function DetailsTableWidget({ config }: { config?: Record<string, unknown> }) {
    const parsed = detailsTableWidgetConfigSchema.safeParse(config ?? {})
    const reportDefinition = parsed.success ? parsed.data.reportDefinition : undefined
    if (reportDefinition) {
        return <ReportDetailsTableWidget definition={reportDefinition} />
    }
    const datasource = parsed.success ? parsed.data.datasource : undefined
    const enableRowReordering = parsed.success ? parsed.data.enableRowReordering : undefined
    const rowCountWarning = parsed.success ? parsed.data.rowCountWarning : undefined
    const sequencePolicy = parsed.success ? parsed.data.sequencePolicy : undefined
    if (datasource?.kind === 'records.list') {
        return (
            <RecordsListDetailsTableWidget
                datasource={datasource}
                enableRowReordering={enableRowReordering}
                rowCountWarning={rowCountWarning}
                sequencePolicy={sequencePolicy}
            />
        )
    }
    if (datasource?.kind === 'records.union') {
        return <RecordsUnionDetailsTableWidget datasource={datasource} />
    }
    if (datasource?.kind === 'ledger.facts' || datasource?.kind === 'ledger.projection') {
        return <LedgerDetailsTableWidget datasource={datasource} />
    }
    return <CurrentDetailsTableWidget />
}

function RuntimeRelationBuilderWidget({ config }: { config?: Record<string, unknown> }) {
    const parsed = relationBuilderWidgetConfigSchema.safeParse(config ?? {})
    if (!parsed.success) return null
    return <RelationBuilderWidget config={parsed.data} />
}

function DetailsTabsWidget({
    config,
    menus,
    fallbackMenu,
    depth
}: {
    config?: Record<string, unknown>
    menus?: DashboardMenusMap
    fallbackMenu?: DashboardMenuSlot
    depth: number
}) {
    const details = useDashboardDetails()
    const parsed = detailsTabsWidgetConfigSchema.safeParse(config ?? {})
    const tabs = useMemo(() => {
        if (!parsed.success) return [] as DetailsTabsWidgetConfig['tabs']
        return parsed.data.tabs
            .filter((tab) => tab.isActive !== false)
            .map((tab) => ({
                ...tab,
                widgets: (tab.widgets ?? [])
                    .filter((widget) => widget.isActive !== false)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            }))
            .filter((tab) => tab.widgets.length > 0)
    }, [parsed])
    const [activeTabId, setActiveTabId] = useState<string | false>(tabs[0]?.id ?? false)

    useEffect(() => {
        if (tabs.length === 0) {
            setActiveTabId(false)
            return
        }
        if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
            setActiveTabId(tabs[0].id)
        }
    }, [activeTabId, tabs])

    if (tabs.length === 0 || activeTabId === false) return null

    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

    return (
        <Box data-testid='runtime-details-tabs'>
            <Tabs
                value={activeTabId}
                onChange={(_, value: string) => setActiveTabId(value)}
                variant='scrollable'
                scrollButtons='auto'
                sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
            >
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        value={tab.id}
                        label={readLocalizedWidgetText(tab.label, details?.locale) ?? tab.id}
                        sx={{ minHeight: 40, textTransform: 'none' }}
                    />
                ))}
            </Tabs>
            <Box sx={{ pt: 2 }}>
                {activeTab.widgets.map((widget, index) => {
                    const inner: ZoneWidgetItem = {
                        id: widget.id ?? `${activeTab.id}-w${index}`,
                        widgetKey: widget.widgetKey,
                        sortOrder: typeof widget.sortOrder === 'number' ? widget.sortOrder : index,
                        config: widget.config ?? {}
                    }

                    return (
                        <Box key={inner.id} sx={index > 0 ? { mt: 2 } : undefined}>
                            {renderWidget(inner, menus, fallbackMenu, depth)}
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
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
        case 'learnerPlayer':
            return <LearnerPlayerWidget key={widget.id} config={widget.config} />
        case 'relationBuilder':
            return <RuntimeRelationBuilderWidget key={widget.id} config={widget.config} />
        case 'detailsTabs':
            return <DetailsTabsWidget key={widget.id} config={widget.config} menus={menus} fallbackMenu={fallbackMenu} depth={depth} />
        case 'quizWidget':
            return <QuizWidget key={widget.id} config={widget.config} />
        case 'resourcePreview':
            return <ResourcePreviewWidget key={widget.id} config={widget.config} />
        case 'columnsContainer': {
            // Guard against infinite recursion if a columnsContainer nests another
            if (depth >= MAX_CONTAINER_DEPTH) return null
            const colConfig = widget.config as unknown as ColumnsContainerConfig | undefined
            if (!colConfig?.columns || !Array.isArray(colConfig.columns) || colConfig.columns.length === 0) return null
            const activeColumns = colConfig.columns
                .map((col) => ({
                    ...col,
                    widgets: (col.widgets ?? []).filter((childWidget) => childWidget.isActive !== false)
                }))
                .filter((col) => col.widgets.length > 0)
            if (activeColumns.length === 0) return null
            return (
                <Grid key={widget.id} container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
                    {activeColumns.map((col) => (
                        <Grid key={col.id} size={{ xs: 12, md: col.width }} sx={{ minWidth: 0 }}>
                            {col.widgets.map((w, wIdx) => {
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
