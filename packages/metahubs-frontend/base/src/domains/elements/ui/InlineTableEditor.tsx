import { useCallback, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
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
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslation } from 'react-i18next'
import type { DynamicFieldConfig } from '@universo/template-mui'

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
 * Inline table editor for TABLE attribute child rows.
 * Uses simple MUI Table with editable inputs for a clean, compact look.
 */
export function InlineTableEditor({ label, value, onChange, childFields, disabled = false, locale }: InlineTableEditorProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const nextLocalIdRef = useRef(1)
    const suppressNextBlurRef = useRef(false)
    const [editingCell, setEditingCell] = useState<{ rowId: string; fieldId: string } | null>(null)

    const rows = useMemo(() => value.map((row, index) => ({ ...row, __rowId: getRowId(row, index) })), [value])

    const handleAddRow = useCallback(() => {
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
    }, [value, onChange, childFields])

    const handleDeleteRow = useCallback(
        (rowId: string) => {
            onChange(value.filter((row, idx) => getRowId(row, idx) !== rowId))
        },
        [value, onChange]
    )

    const handleCellChange = useCallback(
        (rowId: string, fieldId: string, newValue: unknown, field: DynamicFieldConfig) => {
            const updated = value.map((row, idx) => {
                if (getRowId(row, idx) !== rowId) return row
                const patched = { ...row }
                if (isVlcField(field)) {
                    const strValue = String(newValue ?? '')
                    patched[fieldId] = strValue ? toVlcString(strValue, locale) : null
                } else if (field.type === 'NUMBER') {
                    patched[fieldId] = newValue === '' || newValue === null ? null : Number(newValue)
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
                <Typography
                    sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isNumberField ? 'right' : 'left' }}
                    noWrap
                >
                    {displayText}
                </Typography>
            )
        }

        if (isEditing) {
            return (
                <TextField
                    size='small'
                    variant='standard'
                    type={field.type === 'NUMBER' ? 'number' : 'text'}
                    value={displayValue ?? ''}
                    onChange={(e) => handleCellChange(rowId, field.id, e.target.value, field)}
                    onBlur={() => {
                        if (suppressNextBlurRef.current) return
                        setEditingCell(null)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null)
                    }}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    fullWidth
                    InputProps={{ sx: { fontSize: 13, '& input': { textAlign: isNumberField ? 'right' : 'left' } } }}
                    sx={{ '& .MuiInput-underline:before': { borderBottom: 'none' } }}
                />
            )
        }

        return (
            <Typography
                sx={{
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: isNumberField ? 'right' : 'left',
                    width: '100%',
                    minHeight: 20
                }}
                noWrap
            >
                {displayText}
            </Typography>
        )
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant='subtitle2' color='text.secondary'>
                    {label}
                </Typography>
                {!disabled && (
                    <Button
                        size='small'
                        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                        onClick={handleAddRow}
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
                                />
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
                                                    onClick={() => handleDeleteRow(rowId)}
                                                    aria-label={t('common:actions.delete', 'Delete')}
                                                    sx={{ width: 24, height: 24 }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 16 }} />
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
        </Box>
    )
}

export default InlineTableEditor
