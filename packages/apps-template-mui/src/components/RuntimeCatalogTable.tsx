import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import CustomizedDataGrid from '../dashboard/components/CustomizedDataGrid'

export interface RuntimeCatalogTableRow {
  id: string
  [key: string]: unknown
}

export interface RuntimeCatalogTableProps {
  rows: RuntimeCatalogTableRow[]
  columns: GridColDef[]
  loading?: boolean
  rowCount?: number
  paginationModel?: GridPaginationModel
  onPaginationModelChange?: (model: GridPaginationModel) => void
  pageSizeOptions?: number[]
}

const RuntimeCatalogTable = ({
  rows,
  columns,
  loading = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  pageSizeOptions = [25, 50, 100],
}: RuntimeCatalogTableProps) => {
  return (
    <CustomizedDataGrid
      rows={rows}
      columns={columns}
      rowCount={rowCount}
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
      pageSizeOptions={pageSizeOptions}
      loading={loading}
    />
  )
}

export default RuntimeCatalogTable
