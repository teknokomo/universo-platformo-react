import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getGridDateOperators, type GridColDef, type GridFilterModel, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import { dashboardWidgetConfigSchemaByKey, readLocalizedTextValue, type ReportDefinition } from '@universo-react/types'
import { exportRuntimeReportCsv, runRuntimeReport } from '../../api/api'
import { formatRuntimeDateValue, formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { mapGridFilterModel, mapGridSortModel } from '../../utils/runtimeListQuery'
import { useDashboardDetails } from '../DashboardDetailsContext'
import type { ZoneWidgetItem } from '../contracts'
import CustomizedDataGrid from './CustomizedDataGrid'

const DATASOURCE_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50]
const readLocalizedWidgetText = (value: unknown, locale: string): string | undefined => readLocalizedTextValue(value, locale)
const humanizeRuntimeCodename = (value: string): string =>
    value
        .trim()
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()

const toReportGridRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { id: string }> =>
    rows.map((row, index) => ({
        ...row,
        id: typeof row.id === 'string' ? row.id : `report-row-${index}`
    }))

const formatReportGridValue = (value: unknown, locale: string): string => formatRuntimeSafeValue(value, locale)

const reportStatusKeys: Record<string, string> = {
    started: 'started',
    inprogress: 'started',
    submitted: 'submitted',
    completed: 'completed',
    timedout: 'timedOut',
    revoked: 'revoked',
    passed: 'passed',
    failed: 'failed'
}

const formatReportStatus = (value: unknown, locale: string, t: TFunction<'apps'>): string => {
    if (typeof value !== 'string') return formatReportGridValue(value, locale)
    const normalized = value
        .trim()
        .replace(/[\s_-]+/g, '')
        .toLowerCase()
    const statusKey = reportStatusKeys[normalized]
    return statusKey ? t(`reports.statusValues.${statusKey}`, { defaultValue: value }) : formatRuntimeSafeValue(value, locale)
}

const toValidDate = (value: unknown): Date | null => {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
    if (typeof value !== 'string' || value.length === 0) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
}

const normalizeRuntimeLabel = (value: string): string =>
    value
        .trim()
        .replace(/[-_\s]+/g, '')
        .toLowerCase()

const isSafeExplicitReportLabel = (label: unknown, field: string, locale: string): boolean => {
    const labelText = readLocalizedWidgetText(label, locale)?.trim()
    if (!labelText) return false

    const normalizedLabel = normalizeRuntimeLabel(labelText)
    if (!normalizedLabel || isRuntimeTechnicalFieldName(labelText)) return false

    const normalizedField = normalizeRuntimeLabel(field)
    const normalizedHumanizedField = normalizeRuntimeLabel(humanizeRuntimeCodename(field))
    return normalizedLabel !== normalizedField && normalizedLabel !== normalizedHumanizedField
}

const shouldRenderReportColumn = (column: ReportDefinition['columns'][number], locale: string): boolean =>
    !isRuntimeTechnicalFieldName(column.field) || isSafeExplicitReportLabel(column.label, column.field, locale)

const toReportGridColumns = (definition: ReportDefinition, locale: string, t: TFunction<'apps'>): GridColDef[] =>
    definition.columns
        .filter((column) => shouldRenderReportColumn(column, locale))
        .map((column) => {
            const isDateColumn = column.type === 'date'
            const isTimeOnlyColumn = isDateColumn && column.dateComposition === 'time'

            return {
                field: column.field,
                headerName: readLocalizedWidgetText(column.label, locale) ?? humanizeRuntimeCodename(column.field) ?? column.field,
                flex: 1,
                minWidth: column.type === 'number' ? 120 : 160,
                type:
                    isDateColumn && !isTimeOnlyColumn
                        ? column.dateComposition === 'date'
                            ? 'date'
                            : 'dateTime'
                        : column.type === 'number' || column.type === 'boolean'
                        ? column.type
                        : 'string',
                ...(isDateColumn && !isTimeOnlyColumn
                    ? {
                          valueGetter: (value: unknown) => toValidDate(value),
                          filterOperators: getGridDateOperators(column.dateComposition !== 'date').filter(
                              (operator) => operator.value !== 'not'
                          )
                      }
                    : {
                          valueGetter: (value: unknown) =>
                              value !== null && typeof value === 'object' ? formatRuntimeSafeValue(value, locale) : value
                      }),
                renderCell: (params) =>
                    isDateColumn
                        ? formatRuntimeDateValue(params.value, locale, column.dateComposition ?? 'datetime')
                        : column.type === 'status'
                        ? formatReportStatus(params.value, locale, t)
                        : column.type === 'boolean' && typeof params.value === 'boolean'
                        ? t(params.value ? 'reports.booleanValues.yes' : 'reports.booleanValues.no', {
                              defaultValue: params.value ? 'Yes' : 'No'
                          })
                        : formatReportGridValue(params.value, locale)
            }
        })

const sanitizeReportFilenameSegment = (value: string): string => {
    const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

    if (!normalized) return ''

    return normalized
        .replace(/[^\p{L}\p{N} ._-]+/gu, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 96)
}

const buildReportDownloadFilename = (definition: ReportDefinition | undefined, reportCodename: string, locale: string): string => {
    const reportTitle = definition ? readLocalizedWidgetText(definition.title, locale) : undefined
    const filenameSource = reportTitle?.trim() || humanizeRuntimeCodename(reportCodename) || 'runtime-report'
    return `${sanitizeReportFilenameSegment(filenameSource) || 'runtime-report'}.csv`
}

function AuthorizedReportTable({ reportCodename, rowHeight }: { reportCodename: string; rowHeight?: number | 'auto' }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [runtimeFilters, setRuntimeFilters] = useState<ReturnType<typeof mapGridFilterModel>>([])
    const [retainedDefinition, setRetainedDefinition] = useState<ReportDefinition>()
    const [sortModelState, setSortModelState] = useState<GridSortModel | null>(null)
    const [sortReadyColumns, setSortReadyColumns] = useState<GridColDef[] | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const canFetch = Boolean(
        details?.apiBaseUrl && details.applicationId && details.runtimeAccessMode !== 'public' && details.permissions?.readReports === true
    )
    const runtimeSort = useMemo(() => (sortModelState === null ? undefined : mapGridSortModel(sortModelState)), [sortModelState])

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'report-definition',
            details?.apiBaseUrl,
            details?.applicationId,
            reportCodename,
            {
                limit,
                offset,
                filters: runtimeFilters,
                sort: runtimeSort ?? null,
                locale: details?.locale ?? 'en',
                workspaceId: details?.currentWorkspaceId ?? null
            }
        ],
        queryFn: () =>
            runRuntimeReport({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                reportCodename,
                filters: runtimeFilters,
                sort: runtimeSort,
                limit,
                offset,
                locale: details?.locale ?? 'en',
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: canFetch
    })

    const rows = useMemo(() => toReportGridRows(query.data?.rows ?? []), [query.data?.rows])
    useEffect(() => {
        if (query.data?.definition) setRetainedDefinition(query.data.definition)
    }, [query.data?.definition])
    const resolvedDefinition = query.data?.definition ?? retainedDefinition
    const dateCompositions = useMemo(
        () =>
            new Map(
                (resolvedDefinition?.columns ?? [])
                    .filter((column) => column.type === 'date')
                    .map((column) => [column.field, column.dateComposition ?? 'datetime'] as const)
            ),
        [resolvedDefinition]
    )
    const configuredSortModel = useMemo(() => {
        const datasource = resolvedDefinition?.datasource
        if (!datasource || (datasource.kind !== 'records.list' && datasource.kind !== 'records.union')) return []
        return (datasource.query?.sort ?? []).map((item) => ({ field: item.field, sort: item.direction }))
    }, [resolvedDefinition])
    const sortModel = sortModelState ?? configuredSortModel
    const supportsServerSort =
        resolvedDefinition?.datasource.kind === 'records.list' || resolvedDefinition?.datasource.kind === 'records.union'
    const columns = useMemo(
        () => (resolvedDefinition ? toReportGridColumns(resolvedDefinition, details?.locale ?? 'en', t) : []),
        [details?.locale, resolvedDefinition, t]
    )
    useEffect(() => {
        setSortReadyColumns(columns)
    }, [columns])
    const locale = details?.locale ?? 'en'
    const reportLoadError = query.isError
        ? extractRuntimeErrorMessage(query.error, t('reports.loadError', 'Report could not be loaded.'), locale)
        : null

    const handleExport = async () => {
        if (!canFetch || !details?.apiBaseUrl || !details.applicationId || query.isError || !resolvedDefinition) return

        setIsExporting(true)
        setExportError(null)
        try {
            const blob = await exportRuntimeReportCsv({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                reportCodename,
                filters: runtimeFilters,
                sort: runtimeSort,
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
            link.download = buildReportDownloadFilename(resolvedDefinition, reportCodename, details.locale ?? 'en')
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(objectUrl)
        } catch (error) {
            setExportError(
                extractRuntimeErrorMessage(error, t('reports.exportGenericError', 'Report could not be exported.'), details.locale ?? 'en')
            )
        } finally {
            setIsExporting(false)
        }
    }

    const setFilterModel = (model: GridFilterModel) => {
        setFilterModelState(model)
        setRuntimeFilters(mapGridFilterModel(model, dateCompositions))
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const setSortModel = (model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const handleSortModelChange = (model: GridSortModel) => {
        if (sortReadyColumns !== columns) {
            const visibleFields = new Set(columns.map((column) => column.field))
            const visibleConfiguredSort = configuredSortModel.filter((item) => visibleFields.has(item.field))
            const preservesConfiguredSort =
                sortModelState === null &&
                model.length === visibleConfiguredSort.length &&
                model.every(
                    (item, index) => item.field === visibleConfiguredSort[index]?.field && item.sort === visibleConfiguredSort[index]?.sort
                )
            if (preservesConfiguredSort) return

            queueMicrotask(() => setSortModel(model))
            return
        }
        setSortModel(model)
    }

    if (!canFetch) {
        return <Alert severity='error'>{t('dashboard.widget.requiredMissing')}</Alert>
    }

    return (
        <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='runtime-report-details-table'>
            <Stack direction='row' sx={{ justifyContent: 'flex-end' }}>
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    startIcon={<FileDownloadRoundedIcon fontSize='small' />}
                    disabled={isExporting || query.isError || !resolvedDefinition}
                    onClick={handleExport}
                >
                    {isExporting ? t('reports.exporting') : t('reports.exportCsv')}
                </Button>
            </Stack>
            {reportLoadError ? <Alert severity='error'>{reportLoadError}</Alert> : null}
            {exportError ? <Alert severity='error'>{t('reports.exportError', { message: exportError })}</Alert> : null}
            <CustomizedDataGrid
                rows={rows}
                columns={columns}
                loading={query.isLoading || query.isFetching}
                rowCount={query.data?.total ?? 0}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModelState}
                filterModel={filterModel}
                onFilterModelChange={setFilterModel}
                sortModel={sortModel}
                onSortModelChange={supportsServerSort ? handleSortModelChange : undefined}
                pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                localeText={details?.localeText}
                rowHeight={rowHeight}
            />
        </Stack>
    )
}

/** Execute saved reports only after the inherited source has been validated by the runtime resolver. */
export default function ReportDetailsTableWidget({ widget }: { widget: ZoneWidgetItem }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const parsed = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(widget.config)
    if (!parsed.success || parsed.data.variant !== 'report') {
        return <Alert severity='error'>{t('dashboard.widget.malformedConfig')}</Alert>
    }
    if (details?.runtimeAccessMode === 'public' || details?.permissions?.readReports !== true) {
        return <Alert severity='error'>{t('dashboard.widget.permissionDenied')}</Alert>
    }
    const source = widget.runtimeData
    if (source?.status !== 'ready') {
        const messages = {
            loading: 'loading',
            'required-missing': 'requiredMissing',
            'stale-source': 'staleSource',
            'permission-denied': 'permissionDenied',
            'malformed-config': 'malformedConfig',
            'network-error': 'networkError',
            'server-error': 'serverError'
        } as const
        const message = source && source.status in messages ? messages[source.status as keyof typeof messages] : 'requiredMissing'
        return (
            <Alert severity={source?.status === 'loading' ? 'info' : 'error'} role='status'>
                {t(`dashboard.widget.${message}`)}
            </Alert>
        )
    }
    if (source.data.kind !== 'report' || source.data.codename !== parsed.data.reportCodename) {
        return <Alert severity='error'>{t('dashboard.widget.staleSource')}</Alert>
    }
    const scopeKey = JSON.stringify([
        details.apiBaseUrl,
        details.applicationId,
        details.currentWorkspaceId,
        details.locale,
        parsed.data.reportCodename
    ])
    return (
        <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography component='h2' variant='h6'>
                {source.data.title}
            </Typography>
            <AuthorizedReportTable key={scopeKey} reportCodename={parsed.data.reportCodename} rowHeight={parsed.data.rowHeight} />
        </Stack>
    )
}
