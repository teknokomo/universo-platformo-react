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
export function toGridColumns(response: AppDataResponse, options?: ToGridColumnsOptions): GridColDef[] {
    const cols: GridColDef[] = response.columns.map((c) => {
        const refOptionLabels =
            c.dataType === 'REF' && Array.isArray(c.refOptions) && c.refOptions.length > 0
                ? new Map(c.refOptions.map((option) => [option.id, option.label]))
                : c.dataType === 'REF' && Array.isArray(c.enumOptions) && c.enumOptions.length > 0
                ? new Map(c.enumOptions.map((option) => [option.id, option.label]))
                : null

        return {
            field: c.field,
            headerName: c.headerName,
            flex: 1,
            minWidth: 140,
            sortable: true,
            filterable: true,
            renderHeader:
                c.dataType === 'BOOLEAN' && c.uiConfig?.headerAsCheckbox
                    ? () => <Checkbox size='small' disabled checked={false} indeterminate={false} sx={{ p: 0 }} title={c.headerName} />
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
                    return <Checkbox size='small' disabled checked={params.value === true} indeterminate={false} />
                }
                if (c.dataType === 'REF' && refOptionLabels) {
                    let value = ''
                    if (typeof params.value === 'string') {
                        value = params.value
                    } else if (params.value && typeof params.value === 'object') {
                        const refObject = params.value as Record<string, unknown>
                        let objectLabel = ''
                        if (typeof refObject.label === 'string') {
                            objectLabel = refObject.label
                        } else if (typeof refObject.name === 'string') {
                            objectLabel = refObject.name
                        }
                        if (objectLabel) {
                            return objectLabel
                        }
                        value = String(refObject.id ?? '')
                    }
                    if (!value) return ''

                    return refOptionLabels.get(value) ?? ''
                }
                if (params.value === null || params.value === undefined) return ''
                return String(params.value)
            }
        }
    })

    if (options?.onMenuOpen) {
        const onMenuOpen = options.onMenuOpen
        cols.push({
            field: 'actions',
            type: 'actions' as const,
            headerName: options.actionsAriaLabel ?? 'Actions',
            width: 48,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            hideable: false,
            align: 'center',
            headerAlign: 'center',
            renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
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
        validationRules: (c.validationRules ?? {}) as FieldValidationRules,
        refTargetEntityId: c.refTargetEntityId ?? null,
        refTargetEntityKind: c.refTargetEntityKind ?? null,
        refOptions: c.refOptions ?? c.enumOptions ?? [],
        enumOptions: c.enumOptions ?? [],
        enumPresentationMode:
            c.uiConfig?.enumPresentationMode === 'radio' || c.uiConfig?.enumPresentationMode === 'label'
                ? c.uiConfig.enumPresentationMode
                : 'select',
        defaultEnumValueId: typeof c.uiConfig?.defaultEnumValueId === 'string' ? c.uiConfig.defaultEnumValueId : null,
        enumAllowEmpty: c.uiConfig?.enumAllowEmpty !== false,
        enumLabelEmptyDisplay: c.uiConfig?.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'
    }))
}
