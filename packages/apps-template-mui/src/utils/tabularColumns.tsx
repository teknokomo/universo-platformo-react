import { useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { GridColDef, GridRenderEditCellParams } from '@mui/x-data-grid'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Box from '@mui/material/Box'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import { NUMBER_DEFAULTS, validateNumber, toNumberRules } from '@universo/utils'
import type { FieldConfig } from '../components/dialogs/FormDialog'

type RefOption = { id: string; label: string }

/** Props for the inline NUMBER edit cell. */
interface NumberEditCellProps extends GridRenderEditCellParams {
    nonNegative: boolean
    scale: number
    maxIntegerDigits: number
    /** BCP-47 locale for decimal separator (e.g. "ru" → comma, "en" → dot). */
    locale: string
    /** Validation rules for stepper boundary checks. */
    validationRules?: Record<string, unknown>
}

/** Determine locale-appropriate decimal separator. */
const getDecimalSeparator = (locale: string, scale: number) => {
    if (scale <= 0) return ''
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    return lang === 'ru' ? ',' : '.'
}

/**
 * Custom DataGrid edit cell for NUMBER columns.
 *
 * Replicates the full NUMBER field behavior from FormDialog:
 * - formatted display with fixed decimal places and locale-aware separator
 * - zone-based selection (integer vs decimal part)
 * - ArrowUp/ArrowDown zone-aware stepping
 * - stepper buttons (▲▼)
 * - blocks "-" when nonNegative, prevents exceeding precision/scale
 */
function NumberEditCell({ id, field, value, api, nonNegative, scale, maxIntegerDigits, locale, validationRules }: NumberEditCellProps) {
    const decimalSeparator = getDecimalSeparator(locale, scale)
    const allowNegative = !nonNegative
    const inputRef = useRef<HTMLInputElement>(null)
    const cursorZoneRef = useRef<'integer' | 'decimal'>('integer')

    const formatValue = (val: unknown): string => {
        if (val == null || (typeof val === 'number' && Number.isNaN(val))) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        if (typeof val === 'number') {
            return scale > 0 ? val.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(val))
        }
        const parsed = parseFloat(String(val))
        if (Number.isNaN(parsed)) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        return scale > 0 ? parsed.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(parsed))
    }

    const [inputValue, setInputValue] = useState<string>(() => formatValue(value))

    const selectNumberPart = (target: HTMLInputElement) => {
        if (!target || target.value == null) return
        if (scale <= 0) {
            target.setSelectionRange(0, target.value.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const text = target.value
        const signOffset = text.startsWith('-') ? 1 : 0
        const sepIdx = text.indexOf(decimalSeparator)
        if (sepIdx === -1) {
            target.setSelectionRange(signOffset, text.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const cursor = target.selectionStart ?? 0
        if (cursor <= sepIdx) {
            target.setSelectionRange(signOffset, sepIdx)
            cursorZoneRef.current = 'integer'
        } else {
            target.setSelectionRange(sepIdx + 1, text.length)
            cursorZoneRef.current = 'decimal'
        }
    }

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
        const target = event.target
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    const handleClick = (event: ReactMouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    // Zone-aware stepper
    const numberRules = toNumberRules(validationRules)
    const doStep = (direction: 1 | -1, zone?: 'integer' | 'decimal') => {
        const effectiveZone = zone ?? cursorZoneRef.current
        const step = scale > 0 && effectiveZone === 'decimal' ? Math.pow(10, -scale) : 1
        const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
        let next = Number((current + direction * step).toFixed(scale))
        if (nonNegative && next < 0) next = 0
        if (typeof numberRules.min === 'number' && next < numberRules.min) next = numberRules.min
        if (typeof numberRules.max === 'number' && next > numberRules.max) next = numberRules.max
        if (!validateNumber(next, numberRules).valid) return
        setInputValue(formatValue(next))
        api.setEditCellValue({ id, field, value: next })
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value

        if (raw === '') {
            setInputValue('')
            api.setEditCellValue({ id, field, value: null })
            return
        }

        if (raw === '-') {
            if (!allowNegative) return
            setInputValue('-')
            api.setEditCellValue({ id, field, value: null })
            return
        }

        const normalized = raw.replace(/,/g, '.')
        const pattern = allowNegative
            ? (scale > 0 ? /^-?\d*\.?\d*$/ : /^-?\d*$/)
            : (scale > 0 ? /^\d*\.?\d*$/ : /^\d*$/)

        if (!pattern.test(normalized)) return

        const isNeg = normalized.startsWith('-')
        const abs = isNeg ? normalized.slice(1) : normalized
        const [intPart = '', decPart = ''] = abs.split('.')

        if (intPart.length > maxIntegerDigits) return
        if (decPart.length > scale) return

        setInputValue(raw)
        const parsed = parseFloat(normalized)
        if (Number.isFinite(parsed)) {
            api.setEditCellValue({ id, field, value: parsed })
        }
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const key = event.key
        const target = event.target as HTMLInputElement
        const currentValue = target.value
        const selectionStart = target.selectionStart ?? 0
        const selectionEnd = target.selectionEnd ?? selectionStart
        const hasSelection = selectionEnd > selectionStart
        const separatorIndex = scale > 0 ? currentValue.indexOf(decimalSeparator) : -1

        // Protect decimal separator from deletion
        if ((key === 'Backspace' || key === 'Delete') && scale > 0 && separatorIndex !== -1) {
            const crossesSep = selectionStart <= separatorIndex && selectionEnd > separatorIndex
            const bsOnSep = key === 'Backspace' && selectionStart === separatorIndex + 1 && !hasSelection
            const delOnSep = key === 'Delete' && selectionStart === separatorIndex && !hasSelection
            if (crossesSep || bsOnSep || delOnSep) {
                event.preventDefault()
                return
            }
        }

        // Zone-aware ArrowUp/ArrowDown
        if (key === 'ArrowUp') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(1, zone)
            return
        }
        if (key === 'ArrowDown') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(-1, zone)
            return
        }

        // Navigation keys
        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return

        // Ctrl/Cmd
        if (event.ctrlKey || event.metaKey) return

        // Minus
        if (key === '-') {
            if (!allowNegative) { event.preventDefault(); return }
            if (selectionStart !== 0 || currentValue.includes('-')) event.preventDefault()
            return
        }

        // Decimal separator
        if (key === '.' || key === ',') {
            event.preventDefault()
            if (scale === 0) return
            if (separatorIndex !== -1) {
                const decStart = separatorIndex + 1
                window.requestAnimationFrame(() => target.setSelectionRange(decStart, currentValue.length))
                cursorZoneRef.current = 'decimal'
            }
            return
        }

        // Digits
        if (/^\d$/.test(key)) {
            // Decimal zone: replace digit in-place
            if (scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex) {
                event.preventDefault()
                const decStart = separatorIndex + 1
                const localIdx = Math.min(selectionStart, currentValue.length) - decStart
                const decChars = currentValue.slice(decStart).split('')
                if (localIdx >= 0 && localIdx < decChars.length) {
                    decChars[localIdx] = key
                    const nextText = `${currentValue.slice(0, decStart)}${decChars.join('')}`
                    const parsed = parseFloat(nextText.replace(/,/g, '.'))
                    if (Number.isFinite(parsed)) {
                        setInputValue(nextText)
                        api.setEditCellValue({ id, field, value: parsed })
                    }
                    const nextCaret = Math.min(decStart + localIdx + 1, decStart + scale)
                    window.requestAnimationFrame(() => target.setSelectionRange(nextCaret, nextCaret))
                }
                return
            }

            // Integer zone: check digit limit
            const normVal = currentValue.replace(/,/g, '.')
            const isNeg = normVal.startsWith('-')
            const absVal = isNeg ? normVal.slice(1) : normVal
            const decIdx = absVal.indexOf('.')

            if (decIdx === -1) {
                if (absVal.length >= maxIntegerDigits && selectionStart >= (isNeg ? 1 : 0) && !hasSelection) {
                    event.preventDefault()
                }
            } else {
                const adjPos = isNeg ? selectionStart - 1 : selectionStart
                if (adjPos <= decIdx) {
                    if (absVal.slice(0, decIdx).length >= maxIntegerDigits && !hasSelection) {
                        event.preventDefault()
                    }
                }
            }
            return
        }

        event.preventDefault()
    }

    const handleBlur = () => {
        // Re-format on blur to fix display (e.g. after partial input)
        const parsed = typeof value === 'number' && Number.isFinite(value) ? value : null
        setInputValue(formatValue(parsed))
    }

    return (
        <InputBase
            inputRef={inputRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={handleClick}
            onBlur={handleBlur}
            autoFocus
            fullWidth
            sx={{ fontSize: 'inherit', '& input': { textAlign: 'right', px: 0.5, py: 0 } }}
            inputProps={{ inputMode: scale > 0 ? 'decimal' : 'numeric' }}
            endAdornment={
                <InputAdornment position='end' sx={{ ml: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <IconButton
                            size='small'
                            tabIndex={-1}
                            onClick={() => doStep(1)}
                            sx={{ width: 18, height: 14, p: 0 }}
                        >
                            <ArrowDropUpIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                            size='small'
                            tabIndex={-1}
                            onClick={() => doStep(-1)}
                            sx={{ width: 18, height: 14, p: 0 }}
                        >
                            <ArrowDropDownIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                </InputAdornment>
            }
        />
    )
}

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
    onOpenRowMenu?: (event: ReactMouseEvent<HTMLElement>, rowId: string) => void
    /** Called when a non-editable select cell value changes (REF select mode). */
    onSelectChange?: (rowId: string, fieldId: string, value: unknown) => void
    /** Accessible label for the delete button. */
    deleteAriaLabel?: string
    /** Accessible label for the row actions button. */
    actionsAriaLabel?: string
    /** Current locale for number formatting (e.g. 'ru', 'en'). */
    locale?: string
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
    actionsAriaLabel = 'Actions',
    locale = 'en'
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
            const colDef: GridColDef = {
                field: field.id,
                headerName: field.label,
                flex: 1,
                minWidth: 120,
                editable: true,
                type: field.type === 'NUMBER' ? 'number' : field.type === 'BOOLEAN' ? 'boolean' : field.type === 'DATE' ? 'date' : 'string'
            }

            // Customize NUMBER columns: custom edit cell + validation + alignment
            if (field.type === 'NUMBER') {
                const rules = field.validationRules
                const precision = typeof rules?.precision === 'number' ? rules.precision : NUMBER_DEFAULTS.precision
                const sc = typeof rules?.scale === 'number' ? rules.scale : NUMBER_DEFAULTS.scale
                const maxInt = precision - sc
                const nonNeg = Boolean(rules?.nonNegative)

                colDef.align = 'right'
                colDef.headerAlign = 'right'
                colDef.renderEditCell = (params) => (
                    <NumberEditCell {...params} nonNegative={nonNeg} scale={sc} maxIntegerDigits={maxInt} locale={locale} validationRules={rules} />
                )
                // Display formatted value with locale-aware decimal separator
                const sep = getDecimalSeparator(locale, sc)
                colDef.renderCell = (params) => {
                    const v = params.value
                    if (v == null) return ''
                    const n = typeof v === 'number' ? v : parseFloat(String(v))
                    if (!Number.isFinite(n)) return ''
                    return sc > 0 ? n.toFixed(sc).replace('.', sep) : String(Math.trunc(n))
                }

                if (rules) {
                    colDef.preProcessEditCellProps = (params) => {
                        const cellValue = params.props.value as number | null | undefined
                        if (cellValue == null || typeof cellValue !== 'number' || Number.isNaN(cellValue)) {
                            return { ...params.props, error: false }
                        }
                        const result = validateNumber(cellValue, toNumberRules(rules))
                        return { ...params.props, error: !result.valid }
                    }
                }
            }

            return colDef
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
