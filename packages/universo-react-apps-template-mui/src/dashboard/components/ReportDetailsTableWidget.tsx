import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { GridColDef, GridFilterModel, GridPaginationModel } from '@mui/x-data-grid'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import { dashboardWidgetConfigSchemaByKey, readLocalizedTextValue, type ReportDefinition } from '@universo-react/types'
import { exportRuntimeReportCsv, runRuntimeReport } from '../../api/api'
import { formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { mapGridFilterModel } from '../../utils/runtimeListQuery'
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

const isPrimitiveReportValue = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'

const formatReportGridValue = (value: unknown, field: string, locale: string): string => {
    if (isRuntimeTechnicalFieldName(field) && isPrimitiveReportValue(value)) return ''
    return formatRuntimeSafeValue(value, locale)
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

const toReportGridColumns = (definition: ReportDefinition, locale: string): GridColDef[] =>
    definition.columns
        .filter((column) => shouldRenderReportColumn(column, locale))
        .map((column) => ({
            field: column.field,
            headerName: readLocalizedWidgetText(column.label, locale) ?? humanizeRuntimeCodename(column.field) ?? column.field,
            flex: 1,
            minWidth: column.type === 'number' ? 120 : 160,
            type: column.type === 'number' || column.type === 'boolean' ? column.type : 'string',
            renderCell: (params) => formatReportGridValue(params.value, column.field, locale)
        }))

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
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const canFetch = Boolean(
        details?.apiBaseUrl && details.applicationId && details.runtimeAccessMode !== 'public' && details.permissions?.readReports === true
    )
    const runtimeFilters = useMemo(() => mapGridFilterModel(filterModel), [filterModel])

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'report-definition',
            details?.apiBaseUrl,
            details?.applicationId,
            reportCodename,
            { limit, offset, filters: runtimeFilters, locale: details?.locale ?? 'en', workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            runRuntimeReport({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                reportCodename,
                filters: runtimeFilters,
                limit,
                offset,
                locale: details?.locale ?? 'en',
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: canFetch
    })

    const rows = useMemo(() => toReportGridRows(query.data?.rows ?? []), [query.data?.rows])
    const resolvedDefinition = query.data?.definition
    const columns = useMemo(
        () => (resolvedDefinition ? toReportGridColumns(resolvedDefinition, details?.locale ?? 'en') : []),
        [details?.locale, resolvedDefinition]
    )
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
        setPaginationModelState((current) => ({ ...current, page: 0 }))
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
