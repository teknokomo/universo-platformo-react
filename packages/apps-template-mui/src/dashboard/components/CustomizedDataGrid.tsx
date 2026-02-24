import { DataGrid, type GridColDef, type GridPaginationModel, type GridLocaleText } from '@mui/x-data-grid'

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
    pageSizeOptions?: number[]
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
}

export default function CustomizedDataGrid({
    rows,
    columns,
    checkboxSelection = false,
    loading = false,
    rowCount,
    paginationModel,
    onPaginationModelChange,
    pageSizeOptions = [10, 20, 50],
    localeText
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
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd')}
            initialState={
                paginationModel
                    ? undefined
                    : {
                          pagination: { paginationModel: { pageSize: 20, page: 0 } }
                      }
            }
            pageSizeOptions={pageSizeOptions}
            disableColumnResize
            density='compact'
            localeText={localeText}
            sx={{
                [`& .MuiDataGrid-columnHeader`]: {
                    position: 'relative'
                },
                '& .MuiDataGrid-cell': {
                    position: 'relative'
                },
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
                    : {})
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
