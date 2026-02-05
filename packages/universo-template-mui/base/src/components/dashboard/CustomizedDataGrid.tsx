import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import { columns as demoColumns, rows as demoRows } from '../internals/data/gridData'

export interface CustomizedDataGridRow {
    id: string
    [key: string]: unknown
}

export interface CustomizedDataGridProps {
    rows?: CustomizedDataGridRow[]
    columns?: GridColDef[]
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    pageSizeOptions?: number[]
}

export default function CustomizedDataGrid(props: CustomizedDataGridProps) {
    const rows = props.rows ?? (demoRows as unknown as CustomizedDataGridRow[])
    const columns = props.columns ?? (demoColumns as unknown as GridColDef[])

    return (
        <DataGrid
            checkboxSelection
            rows={rows}
            columns={columns}
            loading={props.loading ?? false}
            getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd')}
            paginationMode={props.rowCount === undefined ? 'client' : 'server'}
            rowCount={props.rowCount}
            paginationModel={props.paginationModel}
            onPaginationModelChange={props.onPaginationModelChange}
            initialState={
                props.paginationModel
                    ? undefined
                    : {
                          pagination: { paginationModel: { pageSize: 20, page: 0 } }
                      }
            }
            pageSizeOptions={props.pageSizeOptions ?? [10, 20, 50]}
            disableColumnResize
            density='compact'
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
