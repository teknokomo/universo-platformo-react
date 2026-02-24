import type { MouseEvent } from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Box from '@mui/material/Box'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { FieldConfig } from '../components/dialogs/FormDialog'

type RefOption = { id: string; label: string }

/**
 * Resolve the effective selected value for a REF enum field.
 * If the raw value is empty or missing, fall back to defaultEnumValueId when available.
 */
function resolveEnumValue(rawValue: unknown, field: FieldConfig, refOptions: RefOption[]): string {
    const explicit = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
    if (explicit) return explicit
    const def = field.defaultEnumValueId
    if (typeof def === 'string' && refOptions.some((o) => o.id === def)) return def
    return ''
}

export interface BuildTabularColumnsOptions {
    /** Child field definitions. */
    childFields: FieldConfig[]
    /** Map from row id → 1-based row number (for # column). */
    rowNumberById: Map<string, number>
    /** Called when the user requests to delete a row. */
    onDeleteRow: (rowId: string) => void
    /** Called when the row-actions "⋮" button is clicked. */
    onOpenRowMenu?: (event: MouseEvent<HTMLElement>, rowId: string) => void
    /** Called when a non-editable select cell value changes (REF select mode). */
    onSelectChange?: (rowId: string, fieldId: string, value: unknown) => void
    /** Accessible label for the delete button. */
    deleteAriaLabel?: string
    /** Accessible label for the row actions button. */
    actionsAriaLabel?: string
}

/**
 * Build DataGrid column definitions for inline tabular editing.
 *
 * Shared between TabularPartEditor (CREATE mode, local state) and
 * RuntimeInlineTabularEditor (EDIT mode, API-backed).
 */
export function buildTabularColumns({
    childFields,
    rowNumberById,
    onDeleteRow,
    onOpenRowMenu,
    onSelectChange,
    deleteAriaLabel = 'Delete',
    actionsAriaLabel = 'Actions'
}: BuildTabularColumnsOptions): GridColDef[] {
    const fieldCols: GridColDef[] = [
        {
            field: '__rowNumber',
            headerName: '#',
            width: 44,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            editable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => rowNumberById.get(String(params.id)) ?? ''
        },
        ...childFields.map((field): GridColDef => {
            // REF fields with options → singleSelect dropdown
            const refOptions = field.refOptions ?? field.enumOptions ?? []
            if (field.type === 'REF' && refOptions.length > 0) {
                const mode =
                    field.enumPresentationMode === 'radio' || field.enumPresentationMode === 'label' ? field.enumPresentationMode : 'select'
                const allowEmpty = field.enumAllowEmpty !== false
                const emptyDisplay = field.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

                if (mode === 'label') {
                    return {
                        field: field.id,
                        headerName: field.label,
                        flex: 1,
                        minWidth: 140,
                        editable: false,
                        renderCell: (params) => {
                            const selectedId = resolveEnumValue(params.value, field, refOptions)
                            const selected = selectedId ? refOptions.find((o) => o.id === selectedId) : null
                            const label = selected?.label ?? ''
                            return (
                                <Typography
                                    component='span'
                                    sx={{ fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    noWrap
                                >
                                    {label || (emptyDisplay === 'empty' ? '' : '—')}
                                </Typography>
                            )
                        }
                    }
                }

                if (mode === 'radio') {
                    // Always-visible radio buttons in renderCell (no DataGrid edit mode)
                    return {
                        field: field.id,
                        headerName: field.label,
                        flex: 1,
                        minWidth: 180,
                        editable: false,
                        renderCell: (params) => {
                            const selectedId = resolveEnumValue(params.value, field, refOptions)
                            return (
                                <RadioGroup
                                    value={selectedId}
                                    onChange={(event) => {
                                        onSelectChange?.(String(params.id), field.id, event.target.value || null)
                                    }}
                                    sx={{ py: 0.5 }}
                                >
                                    {refOptions.map((option) => (
                                        <FormControlLabel
                                            key={`${params.id}-${params.field}-${option.id}`}
                                            value={option.id}
                                            control={<Radio size='small' />}
                                            label={option.label || ' '}
                                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 'inherit', lineHeight: 1.4 } }}
                                        />
                                    ))}
                                </RadioGroup>
                            )
                        }
                    }
                }

                // Select mode: always-visible Select in renderCell (no edit mode toggle)
                return {
                    field: field.id,
                    headerName: field.label,
                    flex: 1,
                    minWidth: 140,
                    editable: false,
                    renderCell: (params) => {
                        const selectedValue = resolveEnumValue(params.value, field, refOptions)
                        return (
                            <Select
                                size='small'
                                variant='standard'
                                value={selectedValue}
                                onChange={(event) => {
                                    const newValue = event.target.value === '' ? null : event.target.value
                                    onSelectChange?.(String(params.id), field.id, newValue)
                                }}
                                fullWidth
                                displayEmpty
                                disableUnderline
                                sx={{
                                    fontSize: 'inherit',
                                    minWidth: 0,
                                    m: 0,
                                    p: 0,
                                    backgroundColor: 'transparent',
                                    borderRadius: 0,
                                    '&.MuiInputBase-root': {
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: 0,
                                        boxShadow: 'none'
                                    },
                                    // Remove all visual decoration — only the up/down arrow icon stays
                                    '& .MuiSelect-select': {
                                        py: 0,
                                        pr: '20px !important',
                                        pl: 0,
                                        background: 'transparent !important',
                                        border: 'none !important',
                                        borderRadius: 0
                                    },
                                    '& .MuiSelect-icon': {
                                        right: 0
                                    },
                                    '&:before, &:after': { display: 'none !important' }
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            '& .MuiMenuItem-root': { minHeight: 36 },
                                            '& .MuiMenuItem-root.Mui-selected': {
                                                bgcolor: 'action.selected'
                                            }
                                        }
                                    }
                                }}
                            >
                                {allowEmpty && (
                                    <MenuItem value='' sx={{ minHeight: 36 }}>
                                        {'\u00A0'}
                                    </MenuItem>
                                )}
                                {refOptions.map((opt) => (
                                    <MenuItem key={opt.id} value={opt.id} sx={{ minHeight: 36 }}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        )
                    },
                    valueFormatter: (value: unknown) => {
                        if (!value) return ''
                        const opt = refOptions.find((o) => o.id === value)
                        return opt?.label ?? String(value)
                    }
                }
            }
            return {
                field: field.id,
                headerName: field.label,
                flex: 1,
                minWidth: 120,
                editable: true,
                type: field.type === 'NUMBER' ? 'number' : field.type === 'BOOLEAN' ? 'boolean' : field.type === 'DATE' ? 'date' : 'string'
            }
        })
    ]

    // Actions column (delete)
    fieldCols.push({
        field: '__actions',
        type: 'actions' as const,
        headerName: actionsAriaLabel,
        width: 48,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        hideable: false,
        align: 'center',
        headerAlign: 'center',
        renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
        renderCell: (params) => {
            const rowId = String(params.id)

            return (
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
                        onClick={(e) => {
                            e.stopPropagation()
                            if (onOpenRowMenu) {
                                onOpenRowMenu(e, rowId)
                                return
                            }
                            onDeleteRow(rowId)
                        }}
                        aria-label={onOpenRowMenu ? actionsAriaLabel : deleteAriaLabel}
                        sx={{ width: 28, height: 28, p: 0.25 }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            )
        }
    })

    return fieldCols
}
