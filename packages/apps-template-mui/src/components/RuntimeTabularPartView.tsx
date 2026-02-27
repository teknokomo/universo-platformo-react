import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import AddIcon from '@mui/icons-material/Add'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import { createTabularPartAdapter } from '../api/TabularPartAdapter'
import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { CrudDialogs } from './CrudDialogs'
import { RowActionsMenu } from './RowActionsMenu'
import type { FieldConfig } from './dialogs/FormDialog'

export interface RuntimeTabularPartViewProps {
    /** Base API URL (e.g. `/api/v1`). */
    apiBaseUrl: string
    /** Application UUID. */
    applicationId: string
    /** Catalog UUID that owns the parent record. */
    catalogId: string
    /** Parent record UUID. */
    parentRecordId: string
    /** TABLE attribute UUID. */
    attributeId: string
    /** Child field definitions from the parent form's FieldConfig. */
    childFields: FieldConfig[]
    /** Whether to show the attribute label above the table. */
    showTitle?: boolean
    /** Label text for the table header. */
    label?: string
    /** BCP-47 locale string, e.g. `"en"`, `"ru"`. */
    locale: string
}

/**
 * @deprecated Use `RuntimeInlineTabularEditor` instead. This component uses dialog-based
 * editing via `useCrudDashboard` and will be removed in a future version.
 *
 * Runtime view for TABLE attribute child rows.
 *
 * Reuses `useCrudDashboard` with a `TabularPartAdapter` to provide
 * full CRUD (list, create, edit, delete) with the same DataGrid/dialog
 * components used by catalog tables.
 */
export function RuntimeTabularPartView({
    apiBaseUrl,
    applicationId,
    catalogId,
    parentRecordId,
    attributeId,
    childFields,
    showTitle = true,
    label,
    locale
}: RuntimeTabularPartViewProps) {
    const { t } = useTranslation('apps')

    /** Maximum rows to show before enabling footer pagination. */
    const PAGE_SIZE_THRESHOLD = 50

    const stableChildFields = useMemo(() => childFields, [childFields])

    const adapter = useMemo(
        () =>
            createTabularPartAdapter({
                apiBaseUrl,
                applicationId,
                catalogId,
                parentRecordId,
                attributeId,
                childFields: stableChildFields
            }),
        [apiBaseUrl, applicationId, catalogId, parentRecordId, attributeId, stableChildFields]
    )

    const state = useCrudDashboard({
        adapter,
        locale,
        defaultPageSize: PAGE_SIZE_THRESHOLD,
        pageSizeOptions: [10, 25, PAGE_SIZE_THRESHOLD]
    })

    const labels = useMemo(
        () => ({
            editTitle: t('tabular.editTitle', 'Edit Row'),
            createTitle: t('tabular.createTitle', 'New Row'),
            saveText: t('tabular.save', 'Save'),
            createText: t('tabular.create', 'Create'),
            savingText: t('tabular.saving', 'Saving…'),
            creatingText: t('tabular.creating', 'Creating…'),
            cancelText: t('tabular.cancel', 'Cancel'),
            noFieldsText: t('tabular.noFields', 'No fields configured'),
            deleteTitle: t('tabular.deleteTitle', 'Delete Row'),
            deleteDescription: t('tabular.deleteDescription', 'Are you sure you want to delete this row?'),
            deleteText: t('tabular.delete', 'Delete'),
            deletingText: t('tabular.deleting', 'Deleting…'),
            copyTitle: t('tabular.copyTitle', 'Copy row'),
            copyingText: t('tabular.copying', 'Copying...'),
            editText: t('tabular.edit', 'Edit'),
            copyText: t('tabular.copy', 'Copy'),
            addText: t('tabular.addRow', 'Add Row')
        }),
        [t]
    )

    const rowNumberById = useMemo(() => {
        const map = new Map<string, number>()
        state.rows.forEach((row, index) => {
            map.set(String((row as Record<string, unknown>).id ?? ''), index + 1)
        })
        return map
    }, [state.rows])

    const columnsWithRowNumber = useMemo<GridColDef[]>(
        () => [
            {
                field: '__rowNumber',
                headerName: '#',
                width: 44,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                align: 'center',
                headerAlign: 'center',
                renderCell: (params) => rowNumberById.get(String(params.id)) ?? ''
            },
            ...state.columns
        ],
        [rowNumberById, state.columns]
    )

    return (
        <Box sx={{ mt: 1, mb: 2 }}>
            {showTitle && label && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant='subtitle2' color='text.secondary'>
                        {label}
                    </Typography>
                    <Button size='small' startIcon={<AddIcon />} onClick={state.handleOpenCreate}>
                        {labels.addText}
                    </Button>
                </Box>
            )}

            {!showTitle && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <Button size='small' startIcon={<AddIcon />} onClick={state.handleOpenCreate}>
                        {labels.addText}
                    </Button>
                </Box>
            )}

            {state.isLoading && state.rows.length === 0 ? (
                <Skeleton variant='rectangular' height={80} sx={{ borderRadius: 1 }} />
            ) : (
                /* Flex container replaces deprecated autoHeight prop (MUI DataGrid v7+) */
                <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 400 }}>
                    <DataGrid
                        rows={state.rows}
                        columns={columnsWithRowNumber}
                        loading={state.isLoading || state.isFetching}
                        density='compact'
                        hideFooter={(state.rowCount ?? state.rows.length) <= PAGE_SIZE_THRESHOLD}
                        paginationMode='server'
                        rowCount={state.rowCount ?? state.rows.length}
                        paginationModel={state.paginationModel}
                        onPaginationModelChange={state.setPaginationModel}
                        pageSizeOptions={state.pageSizeOptions}
                        disableRowSelectionOnClick
                        disableColumnResize
                        localeText={state.localeText}
                        onRowClick={(params) => {
                            state.handleOpenEdit(String(params.id))
                        }}
                        sx={{
                            flex: 1,
                            '& .MuiDataGrid-row': { cursor: 'pointer' },
                            [`& .MuiDataGrid-columnHeader`]: {
                                backgroundColor: 'grey.100'
                            },
                            '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root:hover, & .MuiDataGrid-menuIconButton:hover': {
                                backgroundColor: 'grey.300'
                            },
                            '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root:active, & .MuiDataGrid-menuIconButton:active': {
                                backgroundColor: 'grey.400'
                            }
                        }}
                    />
                </Box>
            )}

            <CrudDialogs state={state} locale={locale} labels={labels} />

            <RowActionsMenu
                state={state}
                labels={{ editText: labels.editText, copyText: labels.copyText, deleteText: labels.deleteText }}
            />
        </Box>
    )
}
