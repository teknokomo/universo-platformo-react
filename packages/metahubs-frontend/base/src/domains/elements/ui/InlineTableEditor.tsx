import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import AddIcon from '@mui/icons-material/Add'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import { useTranslation } from 'react-i18next'
import { buildTableConstraintText, NUMBER_DEFAULTS, validateNumber, toNumberRules } from '@universo/utils'
import { ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import type { DynamicFieldConfig, DynamicFieldValidationRules } from '@universo/template-mui'

export interface InlineTableEditorProps {
    /** Display label for the table section */
    label: string
    /** Current rows value (controlled) — array of objects with child attribute codenames as keys */
    value: Record<string, unknown>[]
    /** Called when rows change */
    onChange: (rows: Record<string, unknown>[]) => void
    /** Child field definitions from DynamicFieldConfig.childFields */
    childFields: DynamicFieldConfig[]
    /** Whether editing is disabled */
    disabled?: boolean
    /** Current locale */
    locale: string
    /** Whether to show the table title (default: true) */
    showTitle?: boolean
    /** Minimum number of rows (disables delete when at limit) */
    minRows?: number | null
    /** Maximum number of rows (disables add when at limit) */
    maxRows?: number | null
    /** Whether TABLE must have rows to submit (default: false) */
    required?: boolean
}

type EnumOption = {
    id: string
    label: string
}

type EnumMode = 'select' | 'radio' | 'label'

/** Retrieve a stable identifier for a row */
function getRowId(row: Record<string, unknown>, index: number): string {
    return String(row._localId ?? row.id ?? `__local_${index}`)
}

/**
 * Extract a plain string from a value that might be VLC or plain string.
 */
function extractDisplayString(value: unknown, locale: string): string {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    // VLC object
    if (typeof value === 'object' && 'locales' in (value as Record<string, unknown>)) {
        const vlc = value as { locales: Record<string, { content?: string }>; _primary?: string }
        const normalizedLocale = locale.split(/[-_]/)[0].toLowerCase()
        const entry = vlc.locales?.[normalizedLocale]
        if (typeof entry?.content === 'string') return entry.content
        const primary = vlc._primary
        if (primary && vlc.locales?.[primary]?.content) return vlc.locales[primary].content as string
        for (const localeEntry of Object.values(vlc.locales ?? {})) {
            if (typeof localeEntry?.content === 'string' && localeEntry.content) return localeEntry.content
        }
        return ''
    }
    return String(value)
}

/**
 * Build a VLC object from a plain string value for STRING fields.
 */
function toVlcString(value: string, locale: string): Record<string, unknown> {
    const normalizedLocale = locale.split(/[-_]/)[0].toLowerCase()
    return {
        _primary: normalizedLocale,
        _version: 1,
        locales: {
            [normalizedLocale]: { content: value, version: 1 }
        }
    }
}

/**
 * Determine whether a child field stores values as VLC (versioned/localized).
 */
function isVlcField(field: DynamicFieldConfig): boolean {
    const rules = field.validationRules
    return field.type === 'STRING' && Boolean(rules?.versioned || rules?.localized)
}

/** Validate a NUMBER value against its validationRules using shared validator. Returns null if valid, error key otherwise. */
function validateNumberField(value: number, rules?: Record<string, unknown>): string | null {
    if (!rules) return null
    const result = validateNumber(value, toNumberRules(rules))
    return result.valid ? null : result.errorKey ?? 'invalid'
}

function resolveEnumMode(mode: DynamicFieldConfig['enumPresentationMode']): EnumMode {
    if (mode === 'radio' || mode === 'label') return mode
    return 'select'
}

function resolveSelectedEnumValue(
    rawValue: unknown,
    defaultValueId: string | null,
    options: EnumOption[],
    allowEmpty: boolean,
    required: boolean,
    mode: EnumMode
): string | null {
    const explicitValue = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
    if (explicitValue) return explicitValue

    if (defaultValueId && options.some((option) => option.id === defaultValueId)) {
        return defaultValueId
    }

    if (mode === 'select' && allowEmpty && !required) {
        return ''
    }

    if (mode === 'radio') {
        return ''
    }

    return null
}

/**
 * Full-featured NUMBER cell for inline table rows.
 * Replicates the standalone NUMBER field behavior:
 * - Formatted display with locale-aware decimal separator (comma for 'ru')
 * - Zone-based selection (integer vs decimal part) on focus/click
 * - ArrowUp/ArrowDown zone-aware stepping
 * - Stepper buttons (▲▼)
 * - Blocks "-" for nonNegative, protects decimal separator
 * - Digit replacement in decimal zone
 */
interface NumberTableCellProps {
    value: unknown
    onChange: (value: unknown) => void
    rules: DynamicFieldValidationRules | undefined
    locale: string
    disabled: boolean
}

function NumberTableCell({ value, onChange, rules, locale, disabled }: NumberTableCellProps) {
    const precision = typeof rules?.precision === 'number' ? rules.precision : NUMBER_DEFAULTS.precision
    const scale = typeof rules?.scale === 'number' ? rules.scale : NUMBER_DEFAULTS.scale
    const maxIntegerDigits = precision - scale
    const allowNegative = !rules?.nonNegative
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    const decimalSeparator = scale > 0 ? (lang === 'ru' ? ',' : '.') : ''

    const inputRef = useRef<HTMLInputElement>(null)
    const cursorZoneRef = useRef<'integer' | 'decimal'>('integer')

    const formatValue = (val: unknown): string => {
        if (val == null || val === '' || (typeof val === 'number' && Number.isNaN(val))) {
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

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        window.requestAnimationFrame(() => selectNumberPart(event.target))
    }

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    // Zone-aware stepper
    const numberRules = toNumberRules(rules)
    const doStep = (direction: 1 | -1, zone?: 'integer' | 'decimal') => {
        const effectiveZone = zone ?? cursorZoneRef.current
        const step = scale > 0 && effectiveZone === 'decimal' ? Math.pow(10, -scale) : 1
        const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
        let next = Number((current + direction * step).toFixed(scale))
        if (rules?.nonNegative && next < 0) next = 0
        if (typeof numberRules.min === 'number' && next < numberRules.min) next = numberRules.min
        if (typeof numberRules.max === 'number' && next > numberRules.max) next = numberRules.max
        if (!validateNumber(next, numberRules).valid) return
        onChange(next)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value

        if (raw === '' || raw === '-') {
            if (raw === '-' && !allowNegative) return
            onChange(null)
            return
        }

        const normalized = raw.replace(/,/g, '.')
        const pattern = allowNegative ? (scale > 0 ? /^-?\d*\.?\d*$/ : /^-?\d*$/) : scale > 0 ? /^\d*\.?\d*$/ : /^\d*$/

        if (!pattern.test(normalized)) return

        const isNeg = normalized.startsWith('-')
        const abs = isNeg ? normalized.slice(1) : normalized
        const [intPart = '', decPart = ''] = abs.split('.')

        if (intPart.length > maxIntegerDigits) return
        if (decPart.length > scale) return

        const parsed = parseFloat(normalized)
        if (Number.isFinite(parsed)) {
            onChange(parsed)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
            if (!allowNegative) {
                event.preventDefault()
                return
            }
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
                        onChange(parsed)
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

    return (
        <TextField
            inputRef={inputRef}
            size='small'
            variant='standard'
            type='text'
            inputProps={{
                inputMode: scale > 0 ? 'decimal' : 'numeric',
                style: { textAlign: 'right' }
            }}
            value={formatValue(value)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={handleClick}
            disabled={disabled}
            fullWidth
            InputProps={{
                sx: { fontSize: 13 },
                disableUnderline: true,
                endAdornment: !disabled ? (
                    <InputAdornment position='end' sx={{ ml: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <IconButton size='small' tabIndex={-1} onClick={() => doStep(1)} sx={{ width: 16, height: 12, p: 0 }}>
                                <ArrowDropUpIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton size='small' tabIndex={-1} onClick={() => doStep(-1)} sx={{ width: 16, height: 12, p: 0 }}>
                                <ArrowDropDownIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Box>
                    </InputAdornment>
                ) : undefined
            }}
        />
    )
}

/**
 * Inline table editor for TABLE attribute child rows.
 * Uses simple MUI Table with editable inputs for a clean, compact look.
 */
export function InlineTableEditor({
    label,
    value,
    onChange,
    childFields,
    disabled = false,
    locale,
    showTitle,
    minRows,
    maxRows,
    required = false
}: InlineTableEditorProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const nextLocalIdRef = useRef(1)
    const suppressNextBlurRef = useRef(false)
    const [editingCell, setEditingCell] = useState<{ rowId: string; fieldId: string } | null>(null)
    const [cellErrors, setCellErrors] = useState<Record<string, string | null>>({})
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)

    const rows = useMemo(() => value.map((row, index) => ({ ...row, __rowId: getRowId(row, index) })), [value])

    // Memoize first editable field for Edit menu item disabled state
    const firstEditableFieldId = useMemo(
        () => childFields.find((f) => f.type === 'STRING' || f.type === 'NUMBER')?.id ?? null,
        [childFields]
    )

    const handleAddRow = useCallback(() => {
        if (typeof maxRows === 'number' && value.length >= maxRows) return
        const localId = nextLocalIdRef.current++
        const rowId = `__local_new_${localId}`
        const newRow: Record<string, unknown> = {
            _localId: rowId
        }
        for (const field of childFields) {
            if (field.type === 'BOOLEAN') {
                newRow[field.id] = false
            } else {
                newRow[field.id] = null
            }
        }
        onChange([...value, newRow])
        // Auto-focus first editable STRING/NUMBER cell in the new row
        const firstEditable = childFields.find((f) => f.type === 'STRING' || f.type === 'NUMBER')
        if (firstEditable) {
            setEditingCell({ rowId, fieldId: firstEditable.id })
        }
    }, [value, onChange, childFields, maxRows])

    const handleDeleteRow = useCallback(
        (rowId: string) => {
            onChange(value.filter((row, idx) => getRowId(row, idx) !== rowId))
            // Clean up cellErrors for the deleted row
            setCellErrors((prev) => {
                const prefix = `${rowId}:`
                const hasKeys = Object.keys(prev).some((k) => k.startsWith(prefix))
                if (!hasKeys) return prev
                const next: Record<string, string | null> = {}
                for (const [k, v] of Object.entries(prev)) {
                    if (!k.startsWith(prefix)) next[k] = v
                }
                return next
            })
        },
        [value, onChange]
    )

    const handleOpenRowMenu = useCallback((event: MouseEvent<HTMLElement>, rowId: string) => {
        setMenuAnchorEl(event.currentTarget)
        setMenuRowId(rowId)
    }, [])

    const handleCloseRowMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    const handleEditRowFromMenu = useCallback(() => {
        if (menuRowId && firstEditableFieldId) {
            setEditingCell({ rowId: menuRowId, fieldId: firstEditableFieldId })
        }
        handleCloseRowMenu()
    }, [menuRowId, firstEditableFieldId, handleCloseRowMenu])

    const handleDeleteRowFromMenu = useCallback(() => {
        if (menuRowId) {
            setDeleteRowId(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, handleCloseRowMenu])

    const handleConfirmDelete = useCallback(() => {
        if (deleteRowId) {
            handleDeleteRow(deleteRowId)
        }
        setDeleteRowId(null)
    }, [deleteRowId, handleDeleteRow])

    const handleCancelDelete = useCallback(() => {
        setDeleteRowId(null)
    }, [])

    const handleCellChange = useCallback(
        (rowId: string, fieldId: string, newValue: unknown, field: DynamicFieldConfig) => {
            const updated = value.map((row, idx) => {
                if (getRowId(row, idx) !== rowId) return row
                const patched = { ...row }
                if (isVlcField(field)) {
                    const strValue = String(newValue ?? '')
                    patched[fieldId] = strValue ? toVlcString(strValue, locale) : null
                } else if (field.type === 'NUMBER') {
                    const numVal = newValue === '' || newValue === null ? null : Number(newValue)
                    const cellKey = `${rowId}:${fieldId}`
                    if (numVal !== null && !Number.isNaN(numVal)) {
                        const error = validateNumberField(numVal, field.validationRules)
                        setCellErrors((prev) => (prev[cellKey] !== error ? { ...prev, [cellKey]: error } : prev))
                        if (error) {
                            // Invalid value — do not persist the change
                            return row
                        }
                    } else {
                        setCellErrors((prev) => (prev[cellKey] ? { ...prev, [cellKey]: null } : prev))
                    }
                    patched[fieldId] = numVal
                } else if (field.type === 'BOOLEAN') {
                    patched[fieldId] = Boolean(newValue)
                } else {
                    patched[fieldId] = newValue
                }
                return patched
            })
            onChange(updated)
        },
        [value, onChange, locale]
    )

    const renderCell = (row: Record<string, unknown>, rowId: string, field: DynamicFieldConfig) => {
        const rawValue = row[field.id]
        const isEditing = editingCell?.rowId === rowId && editingCell?.fieldId === field.id
        const isNumberField = field.type === 'NUMBER'

        if (field.type === 'BOOLEAN') {
            return (
                <Checkbox
                    size='small'
                    checked={Boolean(rawValue)}
                    onChange={(e) => handleCellChange(rowId, field.id, e.target.checked, field)}
                    disabled={disabled}
                    sx={{ p: 0 }}
                />
            )
        }

        // NUMBER fields → full-featured NumberTableCell with formatting, zones, steppers
        if (isNumberField) {
            return (
                <NumberTableCell
                    value={rawValue}
                    onChange={(val) => handleCellChange(rowId, field.id, val, field)}
                    rules={field.validationRules}
                    locale={locale}
                    disabled={disabled}
                />
            )
        }

        // REF fields with options → Select dropdown
        const refOptions = (field.enumOptions ?? []) as EnumOption[]
        if (field.type === 'REF' && refOptions.length > 0) {
            const mode = resolveEnumMode(field.enumPresentationMode)
            const allowEmpty = field.enumAllowEmpty !== false
            const selectedValue = resolveSelectedEnumValue(
                rawValue,
                field.defaultEnumValueId ?? null,
                refOptions,
                allowEmpty,
                Boolean(field.required),
                mode
            )
            const selectedOption = selectedValue ? refOptions.find((option) => option.id === selectedValue) : null
            const selectedLabel = selectedOption?.label ?? ''
            const emptyDisplay = field.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

            if (mode === 'label') {
                return (
                    <Typography
                        sx={{ fontSize: 13, minHeight: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        noWrap
                    >
                        {selectedLabel || (emptyDisplay === 'empty' ? '' : '—')}
                    </Typography>
                )
            }

            if (mode === 'radio') {
                if (disabled) {
                    return (
                        <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                            {selectedLabel || (emptyDisplay === 'empty' ? '' : '—')}
                        </Typography>
                    )
                }

                return (
                    <RadioGroup
                        value={selectedValue ?? ''}
                        onChange={(e) => handleCellChange(rowId, field.id, e.target.value || null, field)}
                        sx={{ my: -0.25 }}
                    >
                        {refOptions.map((option) => (
                            <FormControlLabel
                                key={`${field.id}-${rowId}-${option.id || '__empty'}`}
                                value={option.id}
                                control={<Radio size='small' />}
                                label={option.label || ' '}
                                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 13, lineHeight: 1.25 } }}
                            />
                        ))}
                    </RadioGroup>
                )
            }

            if (disabled) {
                return (
                    <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                        {selectedLabel}
                    </Typography>
                )
            }

            return (
                <Select
                    size='small'
                    variant='standard'
                    disableUnderline
                    value={selectedValue ?? ''}
                    onChange={(e) => handleCellChange(rowId, field.id, e.target.value === '' ? null : e.target.value, field)}
                    fullWidth
                    sx={{
                        fontSize: 13,
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
                        '& .MuiSelect-icon': {
                            right: 0
                        },
                        '&:before, &:after': { display: 'none !important' }
                    }}
                    displayEmpty
                >
                    {allowEmpty && (
                        <MenuItem value='' sx={{ minHeight: 36 }}>
                            {'\u00A0'}
                        </MenuItem>
                    )}
                    {refOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </Select>
            )
        }

        const displayValue = isVlcField(field) ? extractDisplayString(rawValue, locale) : rawValue ?? ''
        const displayText = displayValue == null ? '' : String(displayValue)

        if (disabled) {
            return (
                <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                    {displayText}
                </Typography>
            )
        }

        if (isEditing) {
            const cellKey = `${rowId}:${field.id}`
            const hasError = Boolean(cellErrors[cellKey])
            const errorMessage = cellErrors[cellKey] ?? ''
            const textField = (
                <TextField
                    size='small'
                    variant='standard'
                    type='text'
                    value={displayValue ?? ''}
                    onChange={(e) => handleCellChange(rowId, field.id, e.target.value, field)}
                    onBlur={() => {
                        if (suppressNextBlurRef.current) return
                        setEditingCell(null)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingCell(null)
                            return
                        }
                    }}
                    error={hasError}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    fullWidth
                    InputProps={{ sx: { fontSize: 13 } }}
                    sx={{ '& .MuiInput-underline:before': { borderBottom: 'none' } }}
                />
            )
            // Show error message as tooltip when validation fails
            if (hasError && errorMessage) {
                return (
                    <Tooltip title={errorMessage} arrow placement='top'>
                        {textField}
                    </Tooltip>
                )
            }
            return textField
        }

        return (
            <Typography
                sx={{
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    minHeight: 20
                }}
                noWrap
            >
                {displayText}
            </Typography>
        )
    }

    const addDisabled = typeof maxRows === 'number' && value.length >= maxRows

    const { helperText: tableHelperText, isMissing: checkMissing } = buildTableConstraintText({
        required,
        minRows,
        maxRows,
        t
    })
    const tableMissing = checkMissing(value.length)

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                {showTitle !== false && (
                    <Typography variant='subtitle2' color='text.secondary'>
                        {label}
                    </Typography>
                )}
                {showTitle === false && <Box sx={{ flex: 1 }} />}
                {!disabled && (
                    <Button
                        size='small'
                        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                        onClick={handleAddRow}
                        disabled={addDisabled}
                        sx={{ height: 28, fontSize: 12, textTransform: 'none' }}
                    >
                        {t('elements.table.addRow', 'Add Row')}
                    </Button>
                )}
            </Box>

            <TableContainer
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    ...(rows.length > 1 ? { maxHeight: 300 } : { height: 108 })
                }}
            >
                <Table size='small' stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell
                                sx={{
                                    width: 40,
                                    p: '4px 8px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    backgroundColor: 'grey.100',
                                    position: 'relative'
                                }}
                                align='center'
                            >
                                #
                            </TableCell>
                            {childFields.map((field) => (
                                <TableCell
                                    key={field.id}
                                    sx={{
                                        p: '4px 8px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        backgroundColor: 'grey.100',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            left: 0,
                                            top: 6,
                                            bottom: 6,
                                            width: '1px',
                                            backgroundColor: 'common.white'
                                        }
                                    }}
                                >
                                    {field.label}
                                </TableCell>
                            ))}
                            {!disabled && (
                                <TableCell
                                    sx={{
                                        width: 40,
                                        p: '4px 8px',
                                        backgroundColor: 'grey.100',
                                        position: 'relative',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            left: 0,
                                            top: 6,
                                            bottom: 6,
                                            width: '1px',
                                            backgroundColor: 'common.white'
                                        }
                                    }}
                                    align='center'
                                >
                                    <MoreVertRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((row, index) => {
                                const rowId = row.__rowId as string
                                return (
                                    <TableRow key={rowId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell align='center' sx={{ p: '4px 8px', fontSize: 12, color: 'text.secondary' }}>
                                            {index + 1}
                                        </TableCell>
                                        {childFields.map((field) => {
                                            const isTextLike = field.type === 'STRING' || field.type === 'NUMBER'
                                            const isCellEditing = editingCell?.rowId === rowId && editingCell?.fieldId === field.id
                                            const canActivate = !disabled && isTextLike && !isCellEditing
                                            const anotherCellEditing = editingCell !== null && !isCellEditing

                                            return (
                                                <TableCell
                                                    key={field.id}
                                                    align={field.type === 'NUMBER' ? 'right' : 'left'}
                                                    onDoubleClick={
                                                        canActivate
                                                            ? () => {
                                                                  setEditingCell({ rowId, fieldId: field.id })
                                                              }
                                                            : undefined
                                                    }
                                                    onMouseDown={
                                                        canActivate && anotherCellEditing
                                                            ? (e) => {
                                                                  suppressNextBlurRef.current = true
                                                                  e.preventDefault()
                                                                  setEditingCell({ rowId, fieldId: field.id })
                                                                  window.setTimeout(() => {
                                                                      suppressNextBlurRef.current = false
                                                                  }, 0)
                                                              }
                                                            : undefined
                                                    }
                                                    sx={{
                                                        p: '4px 8px',
                                                        overflow: 'hidden',
                                                        position: 'relative',
                                                        cursor: canActivate ? 'text' : undefined,
                                                        ...(canActivate && {
                                                            '&:hover': { backgroundColor: 'action.hover' }
                                                        }),
                                                        '&::before': {
                                                            content: '""',
                                                            position: 'absolute',
                                                            left: 0,
                                                            top: 6,
                                                            bottom: 6,
                                                            width: '1px',
                                                            backgroundColor: 'grey.100'
                                                        }
                                                    }}
                                                >
                                                    {renderCell(row, rowId, field)}
                                                </TableCell>
                                            )
                                        })}
                                        {!disabled && (
                                            <TableCell
                                                align='center'
                                                sx={{
                                                    p: '2px 4px',
                                                    position: 'relative',
                                                    '&::before': {
                                                        content: '""',
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 6,
                                                        bottom: 6,
                                                        width: '1px',
                                                        backgroundColor: 'grey.100'
                                                    }
                                                }}
                                            >
                                                <IconButton
                                                    size='small'
                                                    onClick={(e) => handleOpenRowMenu(e, rowId)}
                                                    aria-label={t('elements.table.actions', 'Actions')}
                                                    sx={{ width: 24, height: 24 }}
                                                >
                                                    <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={childFields.length + (disabled ? 1 : 2)}
                                    sx={{ textAlign: 'center', py: 2, color: 'text.secondary', border: 0 }}
                                >
                                    <Typography variant='body2' color='text.secondary'>
                                        {t('elements.table.noRows', 'No rows yet. Click "Add Row" to add data.')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {tableHelperText && (
                <Typography variant='caption' color={tableMissing ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
                    {tableHelperText}
                </Typography>
            )}

            <Menu
                open={Boolean(menuAnchorEl)}
                anchorEl={menuAnchorEl}
                onClose={handleCloseRowMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={handleEditRowFromMenu} disabled={!firstEditableFieldId}>
                    <EditIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('elements.table.edit', 'Edit')}
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleDeleteRowFromMenu} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('elements.table.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <ConfirmDeleteDialog
                open={Boolean(deleteRowId)}
                title={t('elements.table.deleteTitle', 'Delete Row')}
                description={t('elements.table.deleteDescription', 'Are you sure you want to delete this row?')}
                confirmButtonText={t('elements.table.delete', 'Delete')}
                cancelButtonText={t('elements.table.cancel', 'Cancel')}
                onCancel={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </Box>
    )
}

export default InlineTableEditor
