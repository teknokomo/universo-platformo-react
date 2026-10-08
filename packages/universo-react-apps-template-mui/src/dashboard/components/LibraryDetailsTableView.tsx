import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { DashboardLibraryTableWidgetConfig } from '@universo-react/types'
import type { GridColDef } from '@mui/x-data-grid'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

import { readLocalizedTextValue } from '@universo-react/types'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../contracts'
import CustomizedDataGrid from './CustomizedDataGrid'
import DetailsTableCreateTargetMenu from './DetailsTableCreateTargetMenu'
import LibraryDetailsShareDialog from './LibraryDetailsShareDialog'
import LibraryDetailsTargetPickerDialog from './LibraryDetailsTargetPickerDialog'
import { matchesTargetFilter, rowTitle, type LibraryToggleAction, type ReadyTableRuntimeData } from './libraryDetailsTableUtils'
import type { LibraryDetailsTableActions } from './useLibraryDetailsTableActions'
import { ItemCard, ToolbarControls, ViewHeaderMUI } from '../../components/runtime-ui'

interface LibraryDetailsTableViewProps {
    widget: ZoneWidgetItem
    config: DashboardLibraryTableWidgetConfig
    payload: ReadyTableRuntimeData
    details: DashboardDetailsSlot | undefined
    actions: LibraryDetailsTableActions
    viewMode: 'table' | 'card'
    onViewModeChange: (mode: 'table' | 'card') => void
    searchValue: string
    onSearchValueChange: (value: string) => void
    targetFilterId: string
    onTargetFilterIdChange: (value: string) => void
}

/** Renders the library table and delegates runtime mutations to its controller. */
export default function LibraryDetailsTableView({
    widget,
    config,
    payload,
    details,
    actions,
    viewMode,
    onViewModeChange,
    searchValue,
    onSearchValueChange,
    targetFilterId,
    onTargetFilterIdChange
}: LibraryDetailsTableViewProps) {
    const { t } = useTranslation('apps')
    const { t: tCommon } = useTranslation('common')

    const selectedFilter = config.targetFilters?.find(({ id }) => id === targetFilterId)
    const normalizedSearch = searchValue.trim().toLocaleLowerCase(details?.locale)
    const rows = payload.rows.filter((row) => {
        if (selectedFilter && !matchesTargetFilter(row, selectedFilter)) return false
        if (!normalizedSearch) return true
        return row.cells.some(({ value }) => value.toLocaleLowerCase(details?.locale).includes(normalizedSearch))
    })
    const tableRows = rows.map((row) => ({ id: row.key, ...Object.fromEntries(row.cells.map(({ key, value }) => [key, value])) }))
    const loadedRowCount = payload.rows.length
    const totalRowCount = payload.pagination?.total ?? loadedRowCount
    const hasBoundedRows = totalRowCount > loadedRowCount
    const actionsColumn: GridColDef | null =
        config.lifecycleState === 'deleted'
            ? actions.canEdit
                ? {
                      field: '__actions',
                      headerName: t('trash.actions', 'Actions'),
                      width: 130,
                      sortable: false,
                      filterable: false,
                      disableColumnMenu: true,
                      renderCell: (params) => {
                          const row = rows.find((candidate) => candidate.key === String(params.id))
                          return row ? (
                              <Button
                                  type='button'
                                  size='small'
                                  variant='outlined'
                                  startIcon={<RestoreRoundedIcon fontSize='small' />}
                                  disabled={actions.restoreMutation.isPending}
                                  onClick={() => actions.requestRestore(row)}
                              >
                                  {t('trash.restore', 'Restore')}
                              </Button>
                          ) : null
                      }
                  }
                : null
            : actions.showMenu
            ? {
                  field: '__actions',
                  headerName: t('app.actions', 'Actions'),
                  width: 72,
                  sortable: false,
                  filterable: false,
                  disableColumnMenu: true,
                  renderCell: (params) => {
                      const row = rows.find((candidate) => candidate.key === String(params.id))
                      return row ? (
                          <IconButton
                              size='small'
                              aria-label={t('app.rowActionsFor', 'Actions for {{name}}', {
                                  name: rowTitle(row, payload.columns, t('app.createTargetFallback', 'Record'))
                              })}
                              onClick={(event) => actions.openMenu(event as MouseEvent<HTMLElement>, row)}
                          >
                              <MoreVertRoundedIcon fontSize='small' />
                          </IconButton>
                      ) : null
                  }
              }
            : null
    const columns: GridColDef[] = [
        ...payload.columns.map((column) => ({ field: column.key, headerName: column.label, flex: 1, minWidth: 120 })),
        ...(actionsColumn ? [actionsColumn] : [])
    ]
    const cardColumns = new Map(payload.columns.map(({ key, label }) => [key, label]))
    const targetDialogTitle =
        (actions.activeTargetConfig?.dialogTitle
            ? readLocalizedTextValue(actions.activeTargetConfig.dialogTitle, details?.locale ?? 'en')
            : undefined) ?? t('runtime.targetActionTitle', 'Choose target')
    const targetDialogLabel =
        (actions.activeTargetConfig?.targetLabel
            ? readLocalizedTextValue(actions.activeTargetConfig.targetLabel, details?.locale ?? 'en')
            : undefined) ?? t('runtime.targetActionLabel', 'Target')
    const targetDialogSubmit =
        (actions.activeTargetConfig?.label
            ? readLocalizedTextValue(actions.activeTargetConfig.label, details?.locale ?? 'en')
            : undefined) ?? t('runtime.targetActionSubmit', 'Apply')
    const restoreDialogTitle =
        (actions.restoreConfig?.dialogTitle
            ? readLocalizedTextValue(actions.restoreConfig.dialogTitle, details?.locale ?? 'en')
            : undefined) ?? t('trash.restoreTargetTitle', 'Restore to target')
    const restoreDialogLabel =
        (actions.restoreConfig?.targetLabel
            ? readLocalizedTextValue(actions.restoreConfig.targetLabel, details?.locale ?? 'en')
            : undefined) ?? t('trash.restoreTargetLabel', 'Target')
    return (
        <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='library-details-table'>
            {config.showSearch !== false ||
            config.showViewToggle === true ||
            config.createTargets?.length ||
            config.targetFilters?.length ? (
                <ViewHeaderMUI
                    title={tCommon('dashboard.widgets.records', 'Records')}
                    search={config.showSearch !== false}
                    searchValue={searchValue}
                    searchPlaceholder={tCommon('dashboard.widgets.searchRecords', 'Search records')}
                    onSearchChange={(event) => onSearchValueChange(event.target.value)}
                    controlsWrap
                >
                    <Stack direction='row' spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                        {config.targetFilters?.length ? (
                            <FormControl size='small' data-testid='library-target-filter' sx={{ minWidth: { xs: '100%', sm: 180 } }}>
                                <InputLabel id={'library-target-filter-' + widget.instanceKey + '-label'}>
                                    {t('toolbar.typeFilter', 'Type')}
                                </InputLabel>
                                <Select
                                    labelId={'library-target-filter-' + widget.instanceKey + '-label'}
                                    label={t('toolbar.typeFilter', 'Type')}
                                    value={targetFilterId}
                                    onChange={(event) => onTargetFilterIdChange(String(event.target.value))}
                                >
                                    <MenuItem value=''>{t('toolbar.allTypes', 'All types')}</MenuItem>
                                    {config.targetFilters.map((filter) => (
                                        <MenuItem key={filter.id} value={filter.id}>
                                            {readLocalizedTextValue(filter.label, details?.locale ?? 'en')}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        <DetailsTableCreateTargetMenu createTargets={config.createTargets} />
                        {config.showViewToggle === true ? (
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={viewMode === 'table' ? 'list' : 'card'}
                                onViewModeChange={(mode) => onViewModeChange(mode === 'list' ? 'table' : 'card')}
                                cardViewTitle={tCommon('cardView', 'Card view')}
                                listViewTitle={tCommon('dashboard.widgets.tableView', 'Table view')}
                            />
                        ) : null}
                    </Stack>
                </ViewHeaderMUI>
            ) : null}
            {hasBoundedRows ? (
                <Alert severity='info' data-testid='library-bounded-data-note'>
                    {t('runtime.loadedRowsSummary', 'Loaded {{loaded}} of {{total}} records.', {
                        loaded: loadedRowCount,
                        total: totalRowCount
                    })}{' '}
                    {config.showSearch !== false ? t('app.localSearchScope', 'Search applies to loaded rows only.') : null}
                </Alert>
            ) : null}
            {actions.libraryMutation.isError && !actions.shareDialog ? (
                <Alert severity='error'>
                    {extractRuntimeErrorMessage(
                        actions.libraryMutation.error,
                        t('runtime.libraryActionUnavailable'),
                        details?.locale ?? 'en'
                    )}
                </Alert>
            ) : null}
            {actions.restoreMutation.isError && !actions.restoreDialogRow ? (
                <Alert severity='error'>
                    {extractRuntimeErrorMessage(
                        actions.restoreMutation.error,
                        t('trash.restoreError', 'Record could not be restored.'),
                        details?.locale ?? 'en'
                    )}
                </Alert>
            ) : null}
            {rows.length === 0 ? (
                <Alert severity='info'>{t('dashboard.widget.empty', 'No matching content was found.')}</Alert>
            ) : viewMode === 'card' ? (
                <Grid container spacing={2} columns={12} sx={{ minWidth: 0 }}>
                    {rows.map((row) => {
                        const [titleCell, ...detailCells] = row.cells
                        const description = detailCells
                            .map(({ key, value }) => (cardColumns.get(key) ?? '') + ': ' + value)
                            .map((value) => value.trim())
                            .filter(Boolean)
                            .join('\n')
                        const action =
                            config.lifecycleState === 'deleted' && actions.canEdit ? (
                                <Tooltip title={t('trash.restore', 'Restore')}>
                                    <span>
                                        <IconButton
                                            size='small'
                                            aria-label={t('trash.restore', 'Restore')}
                                            disabled={actions.restoreMutation.isPending}
                                            onClick={() => actions.requestRestore(row)}
                                        >
                                            <RestoreRoundedIcon fontSize='small' />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            ) : actions.showMenu ? (
                                <IconButton
                                    size='small'
                                    aria-label={t('app.rowActionsFor', 'Actions for {{name}}', {
                                        name: rowTitle(row, payload.columns, t('app.createTargetFallback', 'Record'))
                                    })}
                                    onClick={(event) => actions.openMenu(event, row)}
                                >
                                    <MoreVertRoundedIcon fontSize='small' />
                                </IconButton>
                            ) : undefined
                        return (
                            <Grid key={row.key} size={{ xs: 12, sm: 6, md: 4 }} sx={{ minWidth: 0 }}>
                                <ItemCard
                                    allowStretch
                                    headerAction={action}
                                    data={{
                                        name: titleCell?.value || tCommon('entityContent.untitledRecord', 'Untitled content record'),
                                        description
                                    }}
                                />
                            </Grid>
                        )
                    })}
                </Grid>
            ) : (
                <CustomizedDataGrid
                    rows={tableRows}
                    columns={columns}
                    rowCount={undefined}
                    rowHeight={config.rowHeight}
                    pageSizeOptions={details?.pageSizeOptions}
                    localeText={details?.localeText}
                />
            )}
            <Menu anchorEl={actions.menuAnchor} open={Boolean(actions.menuAnchor)} onClose={actions.closeMenu}>
                {actions.visibleLibraryActions.map((action: LibraryToggleAction) => {
                    const active =
                        action.libraryView === 'starred'
                            ? actions.menuRow?.target?.starred === true
                            : actions.menuRow?.target?.shared === true
                    const showActive = action.principalTarget !== 'workspaceMember'
                    const label =
                        readLocalizedTextValue(showActive && active ? action.activeLabel : action.label, details?.locale ?? 'en') ??
                        (action.libraryView === 'starred'
                            ? active
                                ? t('app.unstar', 'Remove from starred')
                                : t('app.star', 'Add to starred')
                            : t('runtime.shareSubmit', 'Share'))
                    const Icon = action.libraryView === 'shared' ? ShareRoundedIcon : active ? StarRoundedIcon : StarBorderRoundedIcon
                    return (
                        <MenuItem
                            key={action.id}
                            disabled={actions.libraryMutation.isPending}
                            onClick={() => actions.selectLibraryAction(action)}
                        >
                            <Icon fontSize='small' sx={{ mr: 1 }} />
                            {label}
                        </MenuItem>
                    )
                })}
                {actions.targetActions.map((action) =>
                    actions.canEdit ? (
                        <MenuItem
                            key={action.id}
                            disabled={actions.targetMutation.isPending}
                            onClick={() => actions.selectTargetAction(action)}
                        >
                            <DriveFileMoveRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {readLocalizedTextValue(action.label, details?.locale ?? 'en') ?? t('runtime.targetActionSubmit', 'Apply')}
                        </MenuItem>
                    ) : null
                )}
                {(actions.visibleLibraryActions.length > 0 || (actions.canEdit && actions.targetActions.length > 0)) &&
                (actions.canEdit || actions.canCopy || actions.canDelete) ? (
                    <Divider />
                ) : null}
                {actions.canEdit && details?.onOpenRowTarget ? (
                    <MenuItem onClick={() => actions.openHostAction('edit')}>
                        <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.edit', 'Edit')}
                    </MenuItem>
                ) : null}
                {actions.canCopy && details?.onOpenRowTarget ? (
                    <MenuItem onClick={() => actions.openHostAction('copy')}>
                        <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.copy', 'Copy')}
                    </MenuItem>
                ) : null}
                {actions.canDelete && details?.onOpenRowTarget ? (
                    <MenuItem onClick={() => actions.openHostAction('delete')} sx={{ color: 'error.main' }}>
                        <DeleteOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.delete', 'Delete')}
                    </MenuItem>
                ) : null}
            </Menu>
            <LibraryDetailsTargetPickerDialog
                open={Boolean(actions.targetActionDialog)}
                config={actions.activeTargetConfig}
                title={targetDialogTitle}
                label={targetDialogLabel}
                help={
                    actions.targetQuery.isFetching
                        ? t('runtime.targetActionLoading', 'Loading available targets...')
                        : (actions.targetQuery.data?.rows.length ?? 0) === 0
                        ? t('runtime.targetActionEmpty', 'No available targets were found.')
                        : t('runtime.targetActionHelp', 'Choose the target for this action.')
                }
                submitLabel={targetDialogSubmit}
                submitIcon={<DriveFileMoveRoundedIcon fontSize='small' />}
                query={actions.targetQuery}
                selectedId={actions.selectedTargetId}
                onSelectedIdChange={actions.setSelectedTargetId}
                onClose={actions.closeTargetDialog}
                onSubmit={actions.submitTargetAction}
                pending={actions.targetMutation.isPending}
                mutationError={actions.targetMutation.error}
                queryErrorFallback={t('runtime.targetActionError', 'Targets could not be loaded.')}
                mutationErrorFallback={t('runtime.targetActionUpdateError', 'Record could not be updated.')}
                pageOffset={actions.targetPickerOffset}
                onPageOffsetChange={actions.changeTargetPickerOffset}
                untitledFallback={t('runtime.targetActionUntitled', 'Untitled target')}
            />
            <LibraryDetailsTargetPickerDialog
                open={Boolean(actions.restoreDialogRow)}
                config={actions.restoreConfig}
                title={restoreDialogTitle}
                label={restoreDialogLabel}
                help={
                    actions.restoreQuery.isFetching
                        ? t('trash.restoreTargetLoading', 'Loading available targets...')
                        : (actions.restoreQuery.data?.rows.length ?? 0) === 0
                        ? t('trash.restoreTargetEmpty', 'No available targets were found.')
                        : t('trash.restoreTargetHelp', 'Choose where this record should be restored.')
                }
                submitLabel={t('trash.restore', 'Restore')}
                submitIcon={<RestoreRoundedIcon fontSize='small' />}
                query={actions.restoreQuery}
                selectedId={actions.selectedRestoreId}
                onSelectedIdChange={actions.setSelectedRestoreId}
                onClose={actions.closeRestoreDialog}
                onSubmit={actions.submitRestore}
                pending={actions.restoreMutation.isPending}
                mutationError={actions.restoreMutation.error}
                queryErrorFallback={t('trash.restoreTargetError', 'Restore targets could not be loaded.')}
                mutationErrorFallback={t('trash.restoreError', 'Record could not be restored.')}
                pageOffset={actions.restorePickerOffset}
                onPageOffsetChange={actions.changeRestorePickerOffset}
                untitledFallback={t('trash.restoreTargetUntitled', 'Untitled target')}
            />
            <LibraryDetailsShareDialog
                open={Boolean(actions.shareDialog)}
                dialog={actions.shareDialog}
                query={actions.shareQuery}
                selectedMemberId={actions.selectedShareMemberId}
                onSelectedMemberChange={actions.setSelectedShareMemberId}
                onClose={actions.closeShareDialog}
                onSubmit={actions.submitShare}
                pending={actions.libraryMutation.isPending}
                mutationError={actions.libraryMutation.error}
                pageOffset={actions.sharePickerOffset}
                onPageOffsetChange={actions.changeSharePickerOffset}
            />
        </Stack>
    )
}
