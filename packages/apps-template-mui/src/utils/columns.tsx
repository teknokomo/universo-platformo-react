import type { GridColDef } from '@mui/x-data-grid'
import Checkbox from '@mui/material/Checkbox'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { AppDataResponse } from '../api/api'
import type { FieldConfig, FieldValidationRules } from '../components/dialogs/FormDialog'
import type { CellRendererOverrides } from '../api/types'

export interface ToGridColumnsOptions {
  /** Callback fired when the row-actions "⋮" button is clicked. */
  onMenuOpen?: (event: React.MouseEvent<HTMLElement>, rowId: string) => void
  /** Accessible label for the actions button. */
  actionsAriaLabel?: string
  /**
   * Per-dataType cell renderer overrides.
   * When provided, the matching override takes priority over the default renderer.
   * Used e.g. by ApplicationRuntime for inline BOOLEAN editing.
   */
  cellRenderers?: CellRendererOverrides
}

/**
 * Convert API column definitions into MUI DataGrid `GridColDef[]`.
 *
 * Optionally appends an "actions" column with a row-level "⋮" icon button
 * if `options.onMenuOpen` is provided.
 */
export function toGridColumns(
  response: AppDataResponse,
  options?: ToGridColumnsOptions
): GridColDef[] {
  const cols: GridColDef[] = response.columns.map((c) => ({
    field: c.field,
    headerName: c.headerName,
    flex: 1,
    minWidth: 140,
    sortable: true,
    filterable: true,
    renderHeader:
      c.dataType === 'BOOLEAN' && c.uiConfig?.headerAsCheckbox
        ? () => (
            <Checkbox
              size='small'
              disabled
              checked={false}
              indeterminate={false}
              sx={{ p: 0 }}
              title={c.headerName}
            />
          )
        : undefined,
    renderCell: (params) => {
      // Check for consumer-provided cell renderer override
      if (options?.cellRenderers?.[c.dataType]) {
        return options.cellRenderers[c.dataType]({
          value: params.value,
          rowId: String(params.id),
          field: c.field,
          column: c
        })
      }
      // Default rendering
      if (c.dataType === 'BOOLEAN') {
        return (
          <Checkbox
            size='small'
            disabled
            checked={params.value === true}
            indeterminate={false}
          />
        )
      }
      if (params.value === null || params.value === undefined) return ''
      return String(params.value)
    }
  }))

  if (options?.onMenuOpen) {
    const onMenuOpen = options.onMenuOpen
    cols.push({
      field: 'actions',
      headerName: '',
      width: 48,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderHeader: () => (
        <MoreVertRoundedIcon
          sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }}
        />
      ),
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}
        >
          <IconButton
            size='small'
            aria-label={options.actionsAriaLabel ?? 'Actions'}
            onClick={(e) => {
              e.stopPropagation()
              onMenuOpen(e, params.row.id as string)
            }}
            sx={{ width: 28, height: 28, p: 0.25 }}
          >
            <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )
    })
  }

  return cols
}

/**
 * Convert API column definitions into `FieldConfig[]` for `FormDialog`.
 */
export function toFieldConfigs(response: AppDataResponse): FieldConfig[] {
  return response.columns.map((c) => ({
    id: c.field,
    label: c.headerName,
    type: c.dataType,
    required: c.isRequired,
    validationRules: (c.validationRules ?? {}) as FieldValidationRules
  }))
}
