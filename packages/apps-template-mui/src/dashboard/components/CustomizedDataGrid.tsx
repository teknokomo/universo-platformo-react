import {
    DataGrid,
    type GridColDef,
    type GridFilterModel,
    type GridLocaleText,
    type GridPaginationModel,
    type GridSortModel
} from '@mui/x-data-grid'
import { getPendingAction, shouldShowPendingFeedback } from '@universo/utils'

export interface CustomizedDataGridRow {
    id: string
    [key: string]: unknown
}

export interface CustomizedDataGridProps {
    rows: CustomizedDataGridRow[]
    columns: GridColDef[]
    checkboxSelection?: boolean
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    sortModel?: GridSortModel
    onSortModelChange?: (model: GridSortModel) => void
    filterModel?: GridFilterModel
    onFilterModelChange?: (model: GridFilterModel) => void
    pageSizeOptions?: number[]
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
    /** Custom row height: number for fixed px, 'auto' for multi-line content */
    rowHeight?: number | 'auto'
    hideFooter?: boolean
}

export function getCustomizedDataGridRowClassName(row: Record<string, unknown> | undefined, index: number): string {
    const classes = [index % 2 === 0 ? 'even' : 'odd']
    const action = getPendingAction(row)

    if (action === 'delete' && shouldShowPendingFeedback(row)) {
        classes.push('pending-delete')
    }

    if ((action === 'create' || action === 'copy') && shouldShowPendingFeedback(row)) {
        classes.push('pending-create')
    }

    return classes.join(' ')
}

export default function CustomizedDataGrid({
    rows,
    columns,
    checkboxSelection = false,
    loading = false,
    rowCount,
    paginationModel,
    onPaginationModelChange,
    sortModel,
    onSortModelChange,
    filterModel,
    onFilterModelChange,
    pageSizeOptions = [10, 20, 50],
    localeText,
    rowHeight,
    hideFooter = false
}: CustomizedDataGridProps) {
    const firstDataField = columns.find((column) => typeof column.field === 'string' && !String(column.field).startsWith('__'))?.field

    return (
        <DataGrid
            checkboxSelection={checkboxSelection}
            disableRowSelectionOnClick
            rows={rows}
            columns={columns}
            loading={loading}
            paginationMode={rowCount === undefined ? 'client' : 'server'}
            sortingMode={onSortModelChange ? 'server' : 'client'}
            filterMode={onFilterModelChange ? 'server' : 'client'}
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            sortModel={sortModel}
            onSortModelChange={onSortModelChange}
            filterModel={filterModel}
            onFilterModelChange={onFilterModelChange}
            getRowClassName={(params) => getCustomizedDataGridRowClassName(params.row, params.indexRelativeToCurrentPage)}
            initialState={
                paginationModel
                    ? undefined
                    : {
                          pagination: { paginationModel: { pageSize: 20, page: 0 } }
                      }
            }
            pageSizeOptions={pageSizeOptions}
            hideFooter={hideFooter}
            disableColumnResize
            density={rowHeight ? undefined : 'compact'}
            getRowHeight={rowHeight === 'auto' ? () => 'auto' : typeof rowHeight === 'number' ? () => rowHeight : undefined}
            localeText={localeText}
            sx={{
                [`& .MuiDataGrid-columnHeader`]: {
                    position: 'relative'
                },
                '& .MuiDataGrid-cell': {
                    position: 'relative'
                },
                ...(rowHeight === 'auto'
                    ? {
                          '& .MuiDataGrid-cell': {
                              position: 'relative',
                              whiteSpace: 'normal',
                              wordWrap: 'break-word',
                              lineHeight: 1.5,
                              py: 1
                          }
                      }
                    : {}),
                ...(firstDataField
                    ? {
                          // Internal header separators only (exclude first real column)
                          [`& .MuiDataGrid-columnHeader[data-field]:not([data-field="${firstDataField}"])::before`]: {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 6,
                              bottom: 6,
                              width: '1px',
                              backgroundColor: 'common.white'
                          },
                          // Internal body separators only (exclude first real column)
                          [`& .MuiDataGrid-cell[data-field]:not([data-field="${firstDataField}"])::before`]: {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 6,
                              bottom: 6,
                              width: '1px',
                              backgroundColor: 'grey.100'
                          }
                      }
                    : {}),
                // Pending row styles for optimistic delete
                '& .pending-delete': {
                    textDecoration: 'line-through',
                    opacity: 0.4,
                    pointerEvents: 'none'
                },
                '& .pending-create': {
                    opacity: 0.7,
                    pointerEvents: 'none',
                    backgroundImage: 'linear-gradient(90deg, transparent, #1976d2, transparent)',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '200% 2px',
                    backgroundPosition: '0 100%',
                    animation: 'pending-row-shimmer 1.5s infinite'
                },
                '& .pending-create:hover': {
                    backgroundImage: 'linear-gradient(90deg, transparent, #1976d2, transparent)',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '200% 2px',
                    backgroundPosition: '0 100%'
                },
                '@keyframes pending-row-shimmer': {
                    '0%': { backgroundPosition: '200% 100%' },
                    '100%': { backgroundPosition: '-200% 100%' }
                }
            }}
            slotProps={{
                filterPanel: {
                    filterFormProps: {
                        logicOperatorInputProps: {
                            variant: 'outlined',
                            size: 'small'
                        },
                        columnInputProps: {
                            variant: 'outlined',
                            size: 'small',
                            sx: { mt: 'auto' }
                        },
                        operatorInputProps: {
                            variant: 'outlined',
                            size: 'small',
                            sx: { mt: 'auto' }
                        },
                        valueInputProps: {
                            InputComponentProps: {
                                variant: 'outlined',
                                size: 'small'
                            }
                        }
                    }
                }
            }}
        />
    )
}
