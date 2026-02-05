import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import MinimalRuntimeLayout from '../layouts/MinimalRuntimeLayout'
import RuntimeCatalogTable, { type RuntimeCatalogTableRow } from '../components/RuntimeCatalogTable'

export interface RuntimeTableRouteProps {
  rows: RuntimeCatalogTableRow[]
  columns: GridColDef[]
  loading?: boolean
  rowCount?: number
  paginationModel?: GridPaginationModel
  onPaginationModelChange?: (model: GridPaginationModel) => void
}

const RuntimeTableRoute = ({
  rows,
  columns,
  loading = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
}: RuntimeTableRouteProps) => {
  return (
    <MinimalRuntimeLayout>
      <RuntimeCatalogTable
        rows={rows}
        columns={columns}
        loading={loading}
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
      />
    </MinimalRuntimeLayout>
  )
}

export default RuntimeTableRoute
