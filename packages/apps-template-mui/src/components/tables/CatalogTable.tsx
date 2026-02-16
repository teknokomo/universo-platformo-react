import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import CustomizedDataGrid from '../../dashboard/components/CustomizedDataGrid'

export interface CatalogTableRow {
  id: string
  [key: string]: unknown
}

export interface CatalogTableProps {
  rows: CatalogTableRow[]
  columns: GridColDef[]
  loading?: boolean
  rowCount?: number
  paginationModel?: GridPaginationModel
  onPaginationModelChange?: (model: GridPaginationModel) => void
  pageSizeOptions?: number[]
}

const CatalogTable = ({
  rows,
  columns,
  loading = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  pageSizeOptions = [25, 50, 100],
}: CatalogTableProps) => {
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

export default CatalogTable
