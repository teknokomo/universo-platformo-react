import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GridColDef } from '@mui/x-data-grid'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { FlowListTable, ItemCard, ToolbarControls, ViewHeaderMUI } from '../../components/runtime-ui'
import { formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'
import { useDashboardDetails } from '../DashboardDetailsContext'
import type { ZoneWidgetItem } from '../contracts'
import type { RuntimeWidgetPayload } from '../runtime/widgetPlacementGraph'
import CustomizedDataGrid from './CustomizedDataGrid'
import DetailsTableCreateTargetMenu from './DetailsTableCreateTargetMenu'
import { RuntimeWidgetStatus } from './RuntimeWidgetStatus'
import { useDashboardRowActions } from './DashboardRowActions'

type DashboardEntityTablePayload = Extract<RuntimeWidgetPayload, { kind: 'record' | 'table' }>
type DashboardTablePayload = Extract<DashboardEntityTablePayload, { kind: 'table' }>
type DashboardTableRow = DashboardTablePayload['rows'][number]
type TableCellFormatter = (key: string, value: string) => string

const ROW_DISPLAY_NAME_KEYS = ['title', 'name', 'displayname', 'itemtitle', 'label'] as const
const isRowDisplayNameKey = (key: string): boolean => ROW_DISPLAY_NAME_KEYS.some((semanticKey) => key.toLowerCase() === semanticKey)

const resolveRowDisplayCell = (
    row: DashboardTableRow,
    formatCellValue: TableCellFormatter,
    visibleColumnKeys: ReadonlySet<string>
): { key: string; value: string } | undefined => {
    for (const semanticKey of ROW_DISPLAY_NAME_KEYS) {
        const semanticCell = row.cells.find(({ key }) => visibleColumnKeys.has(key) && key.toLowerCase() === semanticKey)
        if (!semanticCell) continue
        const value = formatCellValue(semanticCell.key, semanticCell.value).trim()
        if (value) return { key: semanticCell.key, value }
    }
    for (const cell of row.cells) {
        if (!visibleColumnKeys.has(cell.key)) continue
        const value = formatCellValue(cell.key, cell.value).trim()
        if (value) return { key: cell.key, value }
    }
    return undefined
}

interface DashboardEntityTableWidgetProps {
    config: ZoneWidgetItem['config']
    payload: DashboardEntityTablePayload
}

export default function DashboardEntityTableWidget({ config, payload }: DashboardEntityTableWidgetProps) {
    const { t } = useTranslation('apps')
    const { t: tCommon } = useTranslation('common')
    const details = useDashboardDetails()
    const parsedTableConfig = dashboardWidgetConfigSchemaByKey.detailsTable.safeParse(config)
    const tableConfig = parsedTableConfig.success && parsedTableConfig.data.variant !== 'report' ? parsedTableConfig.data : undefined
    const recordSetConfig = tableConfig && tableConfig.variant !== 'learner-enrollments' ? tableConfig : undefined
    const isLearnerEnrollmentTable = tableConfig?.variant === 'learner-enrollments'
    const defaultViewMode = recordSetConfig?.defaultViewMode ?? 'table'
    const [viewMode, setViewMode] = useState<'table' | 'card'>(defaultViewMode)
    const [searchValue, setSearchValue] = useState('')
    const rowActions = useDashboardRowActions(details)
    const tableColumnByKey = useMemo(
        () => (payload.kind === 'table' ? new Map(payload.columns.map((column) => [column.key, column] as const)) : new Map()),
        [payload]
    )
    const yesLabel = tCommon('yes', 'Yes')
    const noLabel = tCommon('no', 'No')
    const formatTableValue = useCallback(
        (key: string, value: string) => {
            if (isRuntimeTechnicalFieldName(key)) return ''
            const safeValue = formatRuntimeSafeValue(value, details?.locale)
            if (tableColumnByKey.get(key)?.valueType !== 'boolean') return safeValue
            if (safeValue === 'true') return yesLabel
            if (safeValue === 'false') return noLabel
            return safeValue
        },
        [details?.locale, noLabel, tableColumnByKey, yesLabel]
    )
    const visibleTableColumns = useMemo(() => {
        if (payload.kind !== 'table') return []
        return payload.columns.filter(({ key, label }) => {
            if (isRuntimeTechnicalFieldName(key) || isRuntimeTechnicalFieldName(label)) return false

            const columnCells = payload.rows.flatMap((row) => row.cells.filter((cell) => cell.key === key))
            const hasNonEmptyValue = columnCells.some(({ value }) => value.trim().length > 0)
            if (!hasNonEmptyValue) return true
            return columnCells.some(({ value }) => formatTableValue(key, value).trim().length > 0)
        })
    }, [formatTableValue, payload])
    const visibleColumnKeys = useMemo(() => new Set(visibleTableColumns.map(({ key }) => key)), [visibleTableColumns])
    const filteredTableRows = useMemo(() => {
        if (payload.kind !== 'table') return []
        const normalizedSearch = searchValue.trim().toLocaleLowerCase(details?.locale)
        if (!normalizedSearch) return payload.rows
        return payload.rows.filter((row) =>
            row.cells.some(
                ({ key, value }) =>
                    visibleColumnKeys.has(key) && formatTableValue(key, value).toLocaleLowerCase(details?.locale).includes(normalizedSearch)
            )
        )
    }, [details?.locale, formatTableValue, payload, searchValue, visibleColumnKeys])

    useEffect(() => setViewMode(defaultViewMode), [defaultViewMode])

    if (payload.kind === 'record') {
        const recordTitle = formatRuntimeSafeValue(payload.title, details?.locale)
        const columns: GridColDef[] = [
            { field: 'label', headerName: t('runtime.table.name', 'Name'), flex: 1, minWidth: 160 },
            { field: 'value', headerName: recordTitle || t('runtime.table.description', 'Details'), flex: 2, minWidth: 220 }
        ]
        const rows = payload.fields.flatMap((field, index) => {
            const label = formatRuntimeSafeValue(field.label, details?.locale)
            if (!label || isRuntimeTechnicalFieldName(field.label)) return []
            const value = formatRuntimeSafeValue(field.value, details?.locale)
            if (!value && field.value.trim().length > 0) return []
            return [{ id: `field-${index}`, label, value }]
        })
        return <CustomizedDataGrid rows={rows} columns={columns} rowCount={rows.length} localeText={details?.localeText} />
    }

    if (!parsedTableConfig.success) return <RuntimeWidgetStatus invalid />

    const canRenderRowActions = rowActions.showRowActions && (tableConfig?.variant === undefined || tableConfig.variant === 'records')
    const renderRowActionButton = (row: DashboardTablePayload['rows'][number]) => {
        const actionTarget = row.actionTarget
        if (!canRenderRowActions || !actionTarget) return null
        const title = resolveRowDisplayCell(row, formatTableValue, visibleColumnKeys)?.value
        return rowActions.renderRowActionButton(
            { entityCodename: actionTarget.entityCodename, recordHandle: actionTarget.recordHandle },
            title
        )
    }
    const columns: GridColDef[] = [
        ...visibleTableColumns.map((column) => ({
            field: column.key,
            headerName: column.label,
            flex: 1,
            minWidth: 120
        })),
        ...(canRenderRowActions
            ? [
                  {
                      field: '__runtimeActions',
                      headerName: t('app.actions', 'Actions'),
                      width: 96,
                      sortable: false,
                      filterable: false,
                      disableColumnMenu: true,
                      renderCell: (params: { id: string | number }) => {
                          const row = payload.rows.find(({ key }) => key === String(params.id))
                          return row ? renderRowActionButton(row) : null
                      }
                  }
              ]
            : [])
    ]
    const rows = filteredTableRows.map((row) => ({
        id: row.key,
        ...Object.fromEntries(
            visibleTableColumns.map(({ key }) => {
                const cell = row.cells.find((candidate) => candidate.key === key)
                return [key, cell ? formatTableValue(key, cell.value) : '']
            })
        )
    }))
    const showSearch = isLearnerEnrollmentTable || recordSetConfig?.showSearch !== false
    const showViewToggle = recordSetConfig?.showViewToggle === true
    const cardColumns = recordSetConfig?.cardColumns ?? 2
    const createTargets = recordSetConfig?.createTargets
    const cardSpan = Math.max(2, Math.floor(12 / cardColumns))
    const sourceEntityCodename = payload.sourceEntityCodename?.trim()
    const sourceEntityKey = sourceEntityCodename?.toLowerCase()
    const mutationTargets = payload.rows.map((row) => row.mutationTarget)
    const reorderableRowSetIsComplete =
        tableConfig !== undefined &&
        tableConfig.variant !== 'library' &&
        tableConfig.variant !== 'learner-enrollments' &&
        recordSetConfig?.enableRowReordering === true &&
        payload.pagination?.complete === true &&
        payload.pagination.offset === 0 &&
        payload.pagination.total === payload.rows.length &&
        Boolean(sourceEntityKey) &&
        mutationTargets.every(
            (target) =>
                target !== undefined &&
                target.entityCodename.trim().toLowerCase() === sourceEntityKey &&
                Number.isSafeInteger(target.version) &&
                target.version > 0
        ) &&
        new Set(mutationTargets.map((target) => target?.recordHandle)).size === payload.rows.length
    const canPersistTableReorder =
        reorderableRowSetIsComplete &&
        details?.runtimeAccessMode !== 'public' &&
        details?.permissions?.editContent === true &&
        Boolean(details?.rowReorder)
    const shouldRenderTableReorder = canPersistTableReorder && searchValue.trim().length === 0
    const reorderRows = (event: { active: { id: string }; over?: { id: string } | null }) => {
        if (!canPersistTableReorder || !details?.rowReorder || !sourceEntityCodename || !event.over || searchValue.trim()) return
        const fromIndex = payload.rows.findIndex(({ key }) => key === event.active.id)
        const toIndex = payload.rows.findIndex(({ key }) => key === event.over?.id)
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

        const orderedRows = [...payload.rows]
        const [movedRow] = orderedRows.splice(fromIndex, 1)
        if (!movedRow) return
        orderedRows.splice(toIndex, 0, movedRow)

        const orderedRowIds: string[] = []
        const expectedVersionsByRowId: Record<string, number> = {}
        for (const row of orderedRows) {
            const target = row.mutationTarget
            if (
                !target ||
                target.entityCodename.trim().toLowerCase() !== sourceEntityKey ||
                !Number.isSafeInteger(target.version) ||
                target.version <= 0 ||
                Object.prototype.hasOwnProperty.call(expectedVersionsByRowId, target.recordHandle)
            ) {
                return
            }
            orderedRowIds.push(target.recordHandle)
            expectedVersionsByRowId[target.recordHandle] = target.version
        }
        if (orderedRowIds.length !== payload.rows.length) return

        void details.rowReorder.onReorder({ objectCollectionCodename: sourceEntityCodename, orderedRowIds, expectedVersionsByRowId })
    }
    const reorderableTableRows = filteredTableRows.map((row) => ({
        id: row.key,
        name: resolveRowDisplayCell(row, formatTableValue, visibleColumnKeys)?.value,
        displayValues: new Map(
            visibleTableColumns.flatMap(({ key }) => {
                const cell = row.cells.find((candidate) => candidate.key === key)
                return cell ? [[key, formatTableValue(key, cell.value)] as const] : []
            })
        )
    }))
    const reorderableTableColumns = visibleTableColumns.map((column) => ({
        id: column.key,
        label: column.label,
        render: (row: (typeof reorderableTableRows)[number]) => row.displayValues.get(column.key) ?? ''
    }))

    return (
        <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='dashboard-entity-table'>
            {showSearch || showViewToggle || createTargets?.length ? (
                <ViewHeaderMUI
                    title={tCommon('dashboard.widgets.records', 'Records')}
                    search={showSearch}
                    searchValue={searchValue}
                    searchPlaceholder={tCommon('dashboard.widgets.searchRecords', 'Search records')}
                    onSearchChange={(event) => setSearchValue(event.target.value)}
                    controlsWrap
                >
                    <DetailsTableCreateTargetMenu createTargets={createTargets} />
                    {showViewToggle ? (
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={viewMode === 'table' ? 'list' : 'card'}
                            onViewModeChange={(mode) => setViewMode(mode === 'list' ? 'table' : 'card')}
                            cardViewTitle={tCommon('cardView', 'Card view')}
                            listViewTitle={tCommon('dashboard.widgets.tableView', 'Table view')}
                        />
                    ) : null}
                </ViewHeaderMUI>
            ) : null}
            {filteredTableRows.length === 0 ? (
                <RuntimeWidgetStatus state={{ status: 'empty' }} />
            ) : viewMode === 'card' ? (
                <Grid container spacing={2} columns={12} sx={{ minWidth: 0 }}>
                    {filteredTableRows.map((row) => {
                        const displayNameCell = resolveRowDisplayCell(row, formatTableValue, visibleColumnKeys)
                        const description = visibleTableColumns
                            .filter(({ key }) => key !== displayNameCell?.key)
                            .flatMap(({ key, label }) => {
                                if (isRowDisplayNameKey(key)) return []
                                const cell = row.cells.find((candidate) => candidate.key === key)
                                const value = cell ? formatTableValue(key, cell.value).trim() : ''
                                return value ? [`${label}: ${value}`] : []
                            })
                            .join('\n')
                        return (
                            <Grid key={row.key} size={{ xs: 12, sm: 6, md: cardSpan }} sx={{ minWidth: 0 }}>
                                <ItemCard
                                    allowStretch
                                    headerAction={renderRowActionButton(row)}
                                    data={{
                                        name: displayNameCell?.value || tCommon('entityContent.untitledRecord', 'Untitled content record'),
                                        description
                                    }}
                                />
                            </Grid>
                        )
                    })}
                </Grid>
            ) : shouldRenderTableReorder ? (
                <FlowListTable
                    data={reorderableTableRows}
                    customColumns={reorderableTableColumns}
                    sortableRows
                    tableAriaLabel={tCommon('dashboard.widgets.records', 'Records')}
                    sortableColumnLabel={tCommon('dashboard.widgets.reorderRows', 'Reorder rows')}
                    isLoading={details?.rowReorder?.isPending === true}
                    onSortableDragEnd={reorderRows}
                    renderActions={
                        canRenderRowActions
                            ? (row) => {
                                  const targetRow = payload.rows.find(({ key }) => key === String(row.id))
                                  return targetRow ? renderRowActionButton(targetRow) : null
                              }
                            : undefined
                    }
                />
            ) : (
                <CustomizedDataGrid
                    rows={rows}
                    columns={columns}
                    rowCount={rows.length}
                    rowHeight={tableConfig?.rowHeight}
                    pageSizeOptions={details?.pageSizeOptions}
                    localeText={details?.localeText}
                />
            )}
            {rowActions.rowActionMenu}
        </Stack>
    )
}
