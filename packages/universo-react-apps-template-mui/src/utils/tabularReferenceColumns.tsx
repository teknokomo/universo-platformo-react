import type { GridColDef } from '@mui/x-data-grid'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { buildTabularSiblingRowOptions, readTabularSiblingRowSelectConfig, type TabularSiblingTableValues } from './tabularCellValues'
import { formatRuntimeSafeValue } from './displayValue'

type RefOption = { id: string; label: string; codename?: string }

type TabularReferenceColumnOptions = {
    locale: string
    disabled?: boolean
    siblingTableValues?: TabularSiblingTableValues
    onSelectChange?: (rowId: string, fieldId: string, value: unknown) => void
    siblingSelectPlaceholderLabel: string
    siblingNoOptionsLabel: string
    siblingNoSelectableOptionsLabel?: string
    siblingUnavailableLabel: string
}

const resolveEnumValue = (rawValue: unknown, field: FieldConfig, refOptions: RefOption[]): string => {
    const explicit = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
    if (explicit) return explicit
    const defaultValue = field.defaultEnumValueId
    return typeof defaultValue === 'string' && refOptions.some((option) => option.id === defaultValue) ? defaultValue : ''
}

/** Build a column for a sibling-row selector or a configured REF field. */
export const buildTabularReferenceColumn = (field: FieldConfig, options: TabularReferenceColumnOptions): GridColDef | null => {
    const {
        locale,
        disabled = false,
        siblingTableValues,
        onSelectChange,
        siblingSelectPlaceholderLabel,
        siblingNoOptionsLabel,
        siblingNoSelectableOptionsLabel = siblingNoOptionsLabel,
        siblingUnavailableLabel
    } = options

    const siblingSelectConfig = readTabularSiblingRowSelectConfig(field)
    if (siblingSelectConfig) {
        const siblingOptions = buildTabularSiblingRowOptions(field, siblingTableValues, locale)
        const hasSiblingRows = (siblingTableValues?.[siblingSelectConfig.tableCodename]?.rows.length ?? 0) > 0
        const emptyOptionsLabel = hasSiblingRows ? siblingNoSelectableOptionsLabel : siblingNoOptionsLabel
        return {
            field: field.id,
            headerName: field.label,
            flex: 1,
            minWidth: 160,
            editable: false,
            renderCell: (params) => {
                const selectedValue = typeof params.value === 'string' ? params.value : ''
                const selectedOption = siblingOptions.find((option) => option.id.toLowerCase() === selectedValue.toLowerCase())
                const selectValue = selectedOption?.id ?? selectedValue
                return (
                    <Select
                        size='small'
                        variant='standard'
                        inputProps={{ 'aria-label': field.label }}
                        value={selectValue}
                        onChange={(event) => onSelectChange?.(String(params.id), field.id, event.target.value || null)}
                        disabled={disabled}
                        fullWidth
                        displayEmpty
                        disableUnderline
                        sx={{ minWidth: 0, '& .MuiSelect-select': { py: 0, pr: '20px !important', pl: 0 } }}
                    >
                        <MenuItem value='' disabled={siblingSelectConfig.requiredWithRows && hasSiblingRows}>
                            {siblingOptions.length === 0 ? emptyOptionsLabel : siblingSelectPlaceholderLabel}
                        </MenuItem>
                        {selectedValue && !selectedOption ? (
                            <MenuItem value={selectedValue} disabled>
                                {siblingUnavailableLabel}
                            </MenuItem>
                        ) : null}
                        {siblingOptions.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                )
            },
            valueFormatter: (value: unknown) => {
                if (typeof value !== 'string' || !value) return ''
                return siblingOptions.find((option) => option.id.toLowerCase() === value.toLowerCase())?.label ?? siblingUnavailableLabel
            }
        }
    }

    if (field.type !== 'REF') return null

    const refOptions = field.refOptions ?? field.enumOptions ?? []
    if (refOptions.length === 0) {
        return {
            field: field.id,
            headerName: field.label,
            flex: 1,
            minWidth: 140,
            editable: false,
            renderCell: (params) => (
                <Typography component='span' sx={{ fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                    {params.value === null || params.value === undefined || params.value === '' ? '—' : siblingUnavailableLabel}
                </Typography>
            ),
            valueFormatter: (value: unknown) => (value === null || value === undefined || value === '' ? '' : siblingUnavailableLabel)
        }
    }

    const mode = field.enumPresentationMode === 'radio' || field.enumPresentationMode === 'label' ? field.enumPresentationMode : 'select'
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
                const selected = selectedId ? refOptions.find((option) => option.id === selectedId) : null
                return (
                    <Typography component='span' sx={{ fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                        {selected?.label || (emptyDisplay === 'empty' ? '' : '—')}
                    </Typography>
                )
            }
        }
    }

    if (mode === 'radio') {
        return {
            field: field.id,
            headerName: field.label,
            flex: 1,
            minWidth: 180,
            editable: false,
            renderCell: (params) => (
                <RadioGroup
                    value={resolveEnumValue(params.value, field, refOptions)}
                    aria-label={field.label}
                    onChange={(event) => onSelectChange?.(String(params.id), field.id, event.target.value || null)}
                    aria-disabled={disabled}
                    sx={{ py: 0.5 }}
                >
                    {refOptions.map((option) => (
                        <FormControlLabel
                            key={`${params.id}-${params.field}-${option.id}`}
                            value={option.id}
                            control={<Radio size='small' />}
                            label={option.label || ' '}
                            disabled={disabled}
                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 'inherit', lineHeight: 1.4 } }}
                        />
                    ))}
                </RadioGroup>
            )
        }
    }

    return {
        field: field.id,
        headerName: field.label,
        flex: 1,
        minWidth: 140,
        editable: false,
        renderCell: (params) => (
            <Select
                size='small'
                variant='standard'
                inputProps={{ 'aria-label': field.label }}
                value={resolveEnumValue(params.value, field, refOptions)}
                onChange={(event) => onSelectChange?.(String(params.id), field.id, event.target.value === '' ? null : event.target.value)}
                disabled={disabled}
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
                    '& .MuiSelect-select': {
                        py: 0,
                        pr: '20px !important',
                        pl: 0,
                        background: 'transparent !important',
                        border: 'none !important',
                        borderRadius: 0
                    },
                    '& .MuiSelect-icon': { right: 0 },
                    '&:before, &:after': { display: 'none !important' }
                }}
                MenuProps={{
                    slotProps: {
                        paper: {
                            sx: {
                                '& .MuiMenuItem-root': { minHeight: 36 },
                                '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'action.selected' }
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
                {refOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id} sx={{ minHeight: 36 }}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
        ),
        valueFormatter: (value: unknown) => {
            if (!value) return ''
            return refOptions.find((option) => option.id === value)?.label ?? formatRuntimeSafeValue(value, locale)
        }
    }
}
