import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
    readLocalizedTextValue,
    type RelationBuilderPanelConfig,
    type RelationBuilderWidgetConfig,
    type RuntimeDatasourceDescriptor
} from '@universo/types'
import { createAppRow, deleteAppRow, fetchAppData, fetchAppRow, reorderAppRows, updateAppRow } from '../../api/api'
import { FormDialog } from '../../components/dialogs/FormDialog'
import { ConfirmDeleteDialog } from '../../components/dialogs/ConfirmDeleteDialog'
import { FlowListTable, type DragEndEvent, type TableColumn } from '../../components/runtime-ui'
import { formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { toFieldConfigs } from '../../utils/columns'
import { findRuntimeSectionIdByCodename } from '../../utils/runtimeSections'
import type { AppDataResponse } from '../../api/api'
import type { DashboardDetailsSlot } from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'

type RuntimeRow = Record<string, unknown> & { id: string }
type RecordsListDatasource = Extract<RuntimeDatasourceDescriptor, { kind: 'records.list' }>

const BUILDER_LIST_LIMIT = 100

const readLocalizedWidgetText = (value: unknown, locale: string | undefined): string | undefined =>
    readLocalizedTextValue(value, locale ?? 'en')

const humanizeRuntimeCodename = (value: string | null | undefined): string => {
    const normalized = value?.trim()
    if (!normalized) return ''

    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
}

const capitalizeRuntimeLabel = (value: string): string => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '')

const formatMetadataFallbackLabel = (value: string, locale: string | undefined, fallback: string): string => {
    const safeValue = formatRuntimeSafeValue(value, locale ?? 'en')
    const humanized = capitalizeRuntimeLabel(humanizeRuntimeCodename(safeValue))
    return humanized || fallback
}

const readRecordsListTarget = (datasource: RecordsListDatasource, details: DashboardDetailsSlot | undefined): string | undefined =>
    datasource.sectionId ??
    datasource.objectCollectionId ??
    findRuntimeSectionIdByCodename(details, datasource.sectionCodename ?? datasource.objectCollectionCodename)

const findColumnField = (columns: AppDataResponse['columns'] | undefined, codename: string): string =>
    columns?.find((column) => column.codename === codename || column.field === codename)?.field ?? codename

const readRuntimeRowVersion = (row: RuntimeRow | null | undefined): number | undefined => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : undefined
}

const reorderRowsByIds = (rows: RuntimeRow[], activeId: string, overId: string | null): RuntimeRow[] => {
    if (!overId || activeId === overId) return rows
    const activeIndex = rows.findIndex((row) => row.id === activeId)
    const overIndex = rows.findIndex((row) => row.id === overId)
    if (activeIndex < 0 || overIndex < 0) return rows
    const nextRows = [...rows]
    const [activeRow] = nextRows.splice(activeIndex, 1)
    nextRows.splice(overIndex, 0, activeRow)
    return nextRows
}

const buildFlowListColumns = (
    response: AppDataResponse | undefined,
    locale: string,
    hiddenFields: ReadonlySet<string>
): TableColumn<RuntimeRow>[] =>
    (response?.columns ?? [])
        .filter(
            (column) =>
                !hiddenFields.has(column.field) &&
                column.uiConfig?.hidden !== true &&
                column.uiConfig?.gridHidden !== true &&
                !isRuntimeTechnicalFieldName(column.field) &&
                !isRuntimeTechnicalFieldName(column.codename)
        )
        .map((column) => ({
            id: column.field,
            label: column.headerName,
            width:
                typeof column.uiConfig?.tableWidth === 'number' && Number.isFinite(column.uiConfig.tableWidth)
                    ? column.uiConfig.tableWidth
                    : 160,
            render: (row) => formatRuntimeSafeValue(row[column.field], locale)
        }))

const readNextSortOrder = (rows: RuntimeRow[], field: string): number => {
    let max = 0
    for (const row of rows) {
        const value = row[field]
        const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
        if (Number.isFinite(numeric)) max = Math.max(max, numeric)
    }
    return max + 1
}

const readMaxSortOrder = (rows: RuntimeRow[], field: string): number | null => {
    let max: number | null = null
    for (const row of rows) {
        const value = row[field]
        const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
        if (Number.isFinite(numeric)) max = max === null ? numeric : Math.max(max, numeric)
    }
    return max
}

const buildRelationBuilderWizardSteps = (
    panel: RelationBuilderPanelConfig,
    columns: AppDataResponse['columns'] | undefined,
    locale: string,
    stepFallback: string
) =>
    panel.createWizard?.steps.map((step) => ({
        id: step.id,
        label: readLocalizedWidgetText(step.label, locale) ?? formatMetadataFallbackLabel(step.id, locale, stepFallback),
        helperText: readLocalizedWidgetText(step.helperText, locale),
        fieldIds: step.fieldCodenames.map((codename) => findColumnField(columns, codename))
    }))

const compareRuntimeValues = (left: unknown, right: unknown): number => {
    const leftNumber = typeof left === 'number' ? left : typeof left === 'string' && left.trim() ? Number(left) : Number.NaN
    const rightNumber = typeof right === 'number' ? right : typeof right === 'string' && right.trim() ? Number(right) : Number.NaN
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber
    }
    return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

const sortRuntimeRows = (
    rows: RuntimeRow[],
    sort: NonNullable<RecordsListDatasource['query']>['sort'] | undefined,
    columns: AppDataResponse['columns'] | undefined
): RuntimeRow[] => {
    if (!sort?.length) return rows
    const descriptors = sort.map((descriptor) => ({
        field: findColumnField(columns, descriptor.field),
        direction: descriptor.direction
    }))
    return [...rows].sort((left, right) => {
        for (const descriptor of descriptors) {
            const result = compareRuntimeValues(left[descriptor.field], right[descriptor.field])
            if (result !== 0) return descriptor.direction === 'desc' ? -result : result
        }
        return 0
    })
}

function RelationBuilderPanel({ panel, selectedParentId }: { panel: RelationBuilderPanelConfig; selectedParentId: string }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [orderedRows, setOrderedRows] = useState<RuntimeRow[]>([])
    const [createOpen, setCreateOpen] = useState(false)
    const [editRowId, setEditRowId] = useState<string | null>(null)
    const [deleteRow, setDeleteRow] = useState<RuntimeRow | null>(null)
    const [mutationError, setMutationError] = useState<string | null>(null)
    const targetSectionId = readRecordsListTarget(panel.datasource, details)
    const runtimeFilters = useMemo(
        () => [
            ...(panel.datasource.query?.filters ?? []),
            {
                field: panel.parentFieldCodename,
                operator: 'equals' as const,
                value: selectedParentId
            }
        ],
        [panel.datasource.query?.filters, panel.parentFieldCodename, selectedParentId]
    )
    const queryKey = useMemo(
        () => [...(details?.runtimeQueryKeyPrefix ?? []), 'relation-builder-panel', panel.id, selectedParentId, panel.datasource] as const,
        [details?.runtimeQueryKeyPrefix, panel.datasource, panel.id, selectedParentId]
    )
    const canFetch = Boolean(details?.apiBaseUrl && details.applicationId && targetSectionId)
    const query = useQuery({
        queryKey,
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit: BUILDER_LIST_LIMIT,
                offset: 0,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                workspaceId: details?.currentWorkspaceId ?? null,
                lifecycleState: panel.datasource.query?.lifecycleState,
                search: panel.datasource.query?.search,
                sort: panel.datasource.query?.sort,
                filters: runtimeFilters
            }),
        enabled: canFetch,
        placeholderData: (previous) => previous
    })

    useEffect(() => {
        setOrderedRows((query.data?.rows ?? []) as RuntimeRow[])
    }, [query.data?.rows])

    const parentField = findColumnField(query.data?.columns, panel.parentFieldCodename)
    const sortOrderField = panel.sortOrderFieldCodename ? findColumnField(query.data?.columns, panel.sortOrderFieldCodename) : null
    const hiddenFields = useMemo(() => new Set([parentField]), [parentField])
    const fieldConfigs = useMemo(
        () =>
            query.data
                ? toFieldConfigs(query.data).map((field) =>
                      field.id === parentField ? { ...field, uiConfig: { ...(field.uiConfig ?? {}), hidden: true } } : field
                  )
                : [],
        [parentField, query.data]
    )
    const editQuery = useQuery({
        queryKey: [...queryKey, 'row', editRowId],
        queryFn: () =>
            fetchAppRow({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                rowId: editRowId!,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId
            }),
        enabled: Boolean(canFetch && editRowId)
    })
    const maxSortOrderQuery = useQuery({
        queryKey: [...queryKey, 'max-sort-order', panel.sortOrderFieldCodename],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit: 1,
                offset: 0,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                workspaceId: details?.currentWorkspaceId ?? null,
                lifecycleState: panel.datasource.query?.lifecycleState,
                search: panel.datasource.query?.search,
                sort: [{ field: panel.sortOrderFieldCodename!, direction: 'desc' }],
                filters: runtimeFilters
            }),
        enabled: Boolean(canFetch && panel.sortOrderFieldCodename)
    })
    const createInitialData = useMemo(() => {
        const initial: Record<string, unknown> = { ...(panel.createDefaults ?? {}), [parentField]: selectedParentId }
        if (sortOrderField) {
            const authoritativeMax = maxSortOrderQuery.data
                ? readMaxSortOrder(maxSortOrderQuery.data.rows as RuntimeRow[], sortOrderField)
                : null
            initial[sortOrderField] = (authoritativeMax ?? readNextSortOrder(orderedRows, sortOrderField) - 1) + 1
        }
        return initial
    }, [maxSortOrderQuery.data, orderedRows, panel.createDefaults, parentField, selectedParentId, sortOrderField])
    const columns = useMemo(
        () => buildFlowListColumns(query.data, details?.locale ?? 'en', hiddenFields),
        [details?.locale, hiddenFields, query.data]
    )
    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey })
        if (details?.runtimeQueryKeyPrefix) {
            await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
        }
    }
    const createMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) =>
            createAppRow({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                data: { ...data, ...(panel.createDefaults ?? {}), [parentField]: selectedParentId }
            }),
        onSuccess: invalidate
    })
    const updateMutation = useMutation({
        mutationFn: ({ row, data }: { row: RuntimeRow; data: Record<string, unknown> }) =>
            updateAppRow({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                rowId: row.id,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                data: { ...data, ...(panel.createDefaults ?? {}), [parentField]: selectedParentId },
                expectedVersion: readRuntimeRowVersion(row)
            }),
        onSuccess: invalidate
    })
    const deleteMutation = useMutation({
        mutationFn: (row: RuntimeRow) =>
            deleteAppRow({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                rowId: row.id,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                expectedVersion: readRuntimeRowVersion(row)
            }),
        onSuccess: invalidate
    })
    const reorderMutation = useMutation({
        mutationFn: (nextRows: RuntimeRow[]) =>
            reorderAppRows({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                orderedRowIds: nextRows.map((row) => row.id),
                expectedVersionsByRowId: nextRows.reduce<Record<string, number>>((acc, row) => {
                    const version = readRuntimeRowVersion(row)
                    if (typeof version === 'number') acc[row.id] = version
                    return acc
                }, {})
            }),
        onSuccess: invalidate
    })
    const totalRows = query.data?.pagination.total ?? 0
    const hasSearch = Boolean(panel.datasource.query?.search?.trim())
    const requiresAuthoritativeSortOrder = Boolean(sortOrderField && totalRows > orderedRows.length)
    const createDisabled = requiresAuthoritativeSortOrder && !maxSortOrderQuery.data
    const canPersistRowReordering =
        panel.enableRowReordering === true &&
        !hasSearch &&
        totalRows === orderedRows.length &&
        orderedRows.length > 0 &&
        orderedRows.length <= BUILDER_LIST_LIMIT
    const warningText =
        panel.rowCountWarning && totalRows >= panel.rowCountWarning.threshold
            ? readLocalizedWidgetText(panel.rowCountWarning.message, details?.locale)
            : null
    const loadErrorText =
        query.isError && query.error
            ? extractRuntimeErrorMessage(query.error, t('relationBuilder.loadFailed', 'Unable to load related records.'), details?.locale)
            : null

    const handleFormSubmit = async (data: Record<string, unknown>) => {
        setMutationError(null)
        try {
            if (editRowId) {
                const currentEditRow = orderedRows.find((row) => row.id === editRowId) ?? null
                await updateMutation.mutateAsync({ row: currentEditRow ?? ({ id: editRowId } as RuntimeRow), data })
                setEditRowId(null)
                return
            }
            await createMutation.mutateAsync(data)
            setCreateOpen(false)
        } catch (error) {
            setMutationError(
                extractRuntimeErrorMessage(error, t('app.errorGenericMessage', 'Please try again or reload the page.'), details?.locale)
            )
        }
    }
    const handleDelete = async () => {
        if (!deleteRow) return
        setMutationError(null)
        try {
            await deleteMutation.mutateAsync(deleteRow)
            setDeleteRow(null)
        } catch (error) {
            setMutationError(
                extractRuntimeErrorMessage(error, t('app.errorGenericMessage', 'Please try again or reload the page.'), details?.locale)
            )
        }
    }
    const handleSortableDragEnd = (event: DragEndEvent) => {
        if (!canPersistRowReordering || reorderMutation.isPending) return
        const activeId = String(event.active.id)
        const overId = event.over ? String(event.over.id) : null
        const previousRows = orderedRows
        const nextRows = reorderRowsByIds(previousRows, activeId, overId)
        if (nextRows === previousRows) return

        setOrderedRows(nextRows)
        void reorderMutation.mutateAsync(nextRows).catch(() => {
            setOrderedRows(previousRows)
        })
    }

    if (!canFetch) return null

    return (
        <Stack spacing={1.25} data-testid={`runtime-relation-panel-${panel.id}`} sx={{ minWidth: 0 }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' gap={1} sx={{ minWidth: 0 }}>
                <Typography variant='subtitle2'>
                    {readLocalizedWidgetText(panel.title, details?.locale) ??
                        formatMetadataFallbackLabel(panel.id, details?.locale, t('relationBuilder.untitledPanel', 'Related records'))}
                </Typography>
                <Button size='small' startIcon={<AddRoundedIcon />} disabled={createDisabled} onClick={() => setCreateOpen(true)}>
                    {t('relationBuilder.create', 'Create')}
                </Button>
            </Stack>
            {warningText ? <Alert severity='warning'>{warningText}</Alert> : null}
            {loadErrorText ? <Alert severity='error'>{loadErrorText}</Alert> : null}
            {panel.enableRowReordering && !canPersistRowReordering ? (
                <Typography variant='caption' color='text.secondary'>
                    {t(
                        'app.reorderRequiresCompleteDataset',
                        'Row reordering is available only when all rows are loaded and search is cleared.'
                    )}
                </Typography>
            ) : null}
            <FlowListTable<RuntimeRow>
                data={orderedRows}
                customColumns={columns}
                isLoading={query.isLoading || query.isFetching}
                sortableRows={canPersistRowReordering}
                onSortableDragEnd={handleSortableDragEnd}
                renderActions={(row) => (
                    <Stack direction='row' justifyContent='flex-end'>
                        <IconButton
                            size='small'
                            aria-label={t('app.edit', 'Edit')}
                            data-testid={`runtime-relation-edit-${panel.id}-${row.id}`}
                            onClick={() => setEditRowId(row.id)}
                        >
                            <EditRoundedIcon fontSize='small' />
                        </IconButton>
                        <IconButton
                            size='small'
                            aria-label={t('app.delete', 'Delete')}
                            data-testid={`runtime-relation-delete-${panel.id}-${row.id}`}
                            onClick={() => setDeleteRow(row)}
                        >
                            <DeleteOutlineRoundedIcon fontSize='small' />
                        </IconButton>
                    </Stack>
                )}
            />
            <FormDialog
                open={createOpen || Boolean(editRowId)}
                title={
                    editRowId
                        ? t('relationBuilder.editTitle', 'Edit related record')
                        : t('relationBuilder.createTitle', 'Create related record')
                }
                fields={fieldConfigs}
                locale={details?.locale ?? 'en'}
                initialData={editRowId ? editQuery.data : createInitialData}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
                error={mutationError}
                saveButtonText={editRowId ? t('app.save', 'Save') : t('app.create', 'Create')}
                savingButtonText={editRowId ? t('app.saving', 'Saving...') : t('app.creating', 'Creating...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                emptyStateText={t('app.noFields', 'No fields configured for this object.')}
                onClose={() => {
                    setCreateOpen(false)
                    setEditRowId(null)
                    setMutationError(null)
                }}
                onSubmit={handleFormSubmit}
                apiBaseUrl={details?.apiBaseUrl}
                applicationId={details?.applicationId}
                objectCollectionId={targetSectionId}
                editRowId={editRowId}
                objectCollections={details?.objectCollections}
                currentWorkspaceId={details?.currentWorkspaceId}
                resourceSourceTypes={details?.resourceSourceTypes}
                wizardSteps={
                    editRowId
                        ? undefined
                        : buildRelationBuilderWizardSteps(
                              panel,
                              query.data?.columns,
                              details?.locale ?? 'en',
                              t('relationBuilder.untitledStep', 'Step')
                          )
                }
            />
            <ConfirmDeleteDialog
                open={Boolean(deleteRow)}
                title={t('relationBuilder.deleteTitle', 'Delete related record?')}
                description={t('relationBuilder.deleteDescription', 'This related record will be deleted.')}
                confirmButtonText={t('app.delete', 'Delete')}
                deletingButtonText={t('app.deleting', 'Deleting...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                loading={deleteMutation.isPending}
                error={mutationError ?? undefined}
                onCancel={() => {
                    setDeleteRow(null)
                    setMutationError(null)
                }}
                onConfirm={handleDelete}
            />
        </Stack>
    )
}

export function RelationBuilderWidget({ config }: { config: RelationBuilderWidgetConfig }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const parentDatasource = config.parentDatasource
    const parentTargetSectionId = parentDatasource ? readRecordsListTarget(parentDatasource, details) : undefined
    const isCurrentParentDatasource =
        Boolean(parentDatasource && parentTargetSectionId) &&
        (parentTargetSectionId === details?.sectionId || parentTargetSectionId === details?.objectCollectionId)
    const parentQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'relation-builder-parents',
            parentDatasource,
            details?.currentWorkspaceId ?? null
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit: BUILDER_LIST_LIMIT,
                offset: 0,
                objectCollectionId: parentTargetSectionId,
                sectionId: parentTargetSectionId,
                workspaceId: details?.currentWorkspaceId ?? null,
                lifecycleState: parentDatasource?.query?.lifecycleState,
                search: parentDatasource?.query?.search,
                sort: parentDatasource?.query?.sort,
                filters: parentDatasource?.query?.filters
            }),
        enabled: Boolean(parentDatasource && details?.apiBaseUrl && details.applicationId && parentTargetSectionId),
        placeholderData: (previous) => previous
    })
    const parentRows = useMemo(() => {
        if (parentDatasource) {
            if (parentQuery.data?.rows?.length) return parentQuery.data.rows as RuntimeRow[]
            if (isCurrentParentDatasource) {
                return sortRuntimeRows((details?.rows ?? []) as RuntimeRow[], parentDatasource.query?.sort, details?.runtimeColumns)
            }
            return []
        }
        return (details?.rows ?? []) as RuntimeRow[]
    }, [details?.rows, details?.runtimeColumns, isCurrentParentDatasource, parentDatasource, parentQuery.data?.rows])
    const parentColumns = parentDatasource
        ? parentQuery.data?.columns ?? (isCurrentParentDatasource ? details?.runtimeColumns : undefined)
        : isCurrentParentDatasource
        ? details?.runtimeColumns
        : undefined
    const [selectedParentId, setSelectedParentId] = useState<string>('')
    const [hasManualParentSelection, setHasManualParentSelection] = useState(false)

    useEffect(() => {
        setHasManualParentSelection(false)
    }, [details?.currentWorkspaceId, parentTargetSectionId])

    useEffect(() => {
        if (!hasManualParentSelection && parentDatasource && parentQuery.data?.rows) {
            setSelectedParentId(parentRows[0]?.id ?? '')
            return
        }
        if (parentRows.some((row) => row.id === selectedParentId)) return
        setSelectedParentId(parentRows[0]?.id ?? '')
    }, [hasManualParentSelection, parentDatasource, parentQuery.data?.rows, parentRows, selectedParentId])

    const titleField = config.parentTitleFieldCodename ? findColumnField(parentColumns, config.parentTitleFieldCodename) : undefined
    const readParentLabel = (row: RuntimeRow): string => {
        const candidate = titleField ? row[titleField] : undefined
        const formatted = formatRuntimeSafeValue(candidate, details?.locale ?? 'en')
        return formatted || t('relationBuilder.untitledParent', 'Untitled parent')
    }
    const parentLoadErrorText =
        parentDatasource && parentQuery.isError && parentQuery.error && parentRows.length === 0
            ? extractRuntimeErrorMessage(
                  parentQuery.error,
                  t('relationBuilder.parentLoadFailed', 'Unable to load parent records.'),
                  details?.locale
              )
            : null

    if (parentLoadErrorText) {
        return <Alert severity='error'>{parentLoadErrorText}</Alert>
    }

    if (parentRows.length === 0) {
        return (
            <Alert severity='info'>
                {readLocalizedWidgetText(config.emptyParentMessage, details?.locale) ??
                    t('relationBuilder.emptyParent', 'Create a parent record before adding related records.')}
            </Alert>
        )
    }

    return (
        <Stack spacing={2} data-testid='runtime-relation-builder'>
            <FormControl fullWidth size='small'>
                <InputLabel id='runtime-relation-builder-parent-label'>
                    {readLocalizedWidgetText(config.parentLabel, details?.locale) ?? t('relationBuilder.parent', 'Parent')}
                </InputLabel>
                <Select
                    data-testid='runtime-relation-builder-parent-select'
                    labelId='runtime-relation-builder-parent-label'
                    value={selectedParentId}
                    label={readLocalizedWidgetText(config.parentLabel, details?.locale) ?? t('relationBuilder.parent', 'Parent')}
                    onChange={(event) => {
                        setSelectedParentId(String(event.target.value))
                        setHasManualParentSelection(true)
                    }}
                >
                    {parentRows.map((row) => (
                        <MenuItem key={row.id} value={row.id}>
                            {readParentLabel(row)}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Grid container spacing={2}>
                {config.panels.map((panel) => (
                    <Grid key={panel.id} size={{ xs: 12, md: panel.width ?? 12 }}>
                        <Box>
                            <RelationBuilderPanel panel={panel} selectedParentId={selectedParentId} />
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Stack>
    )
}
