import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'

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
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import { useTranslation } from 'react-i18next'
import {
    buildTableConstraintText,
    generateUuidV7,
    readTabularSiblingSelectConfig,
    type TabularSiblingSelectConfig
} from '@universo-react/utils'
import { ConfirmDeleteDialog } from '@universo-react/template-mui/components/dialogs'
import type { DynamicFieldConfig } from '@universo-react/template-mui'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import AssessmentOptionsEditorDialog from './AssessmentOptionsEditorDialog'
import { InlineSiblingRowSelectCell } from './InlineSiblingRowSelectCell'
import NumberTableCell from './InlineTableNumberCell'
import {
    extractInlineTableDisplayString,
    getInlineTableRowId,
    isInlineTableLocalizedField,
    resolveInlineTableEnumMode,
    resolveInlineTableOptionCount,
    resolveInlineTableSelectedEnumValue,
    toInlineTableLocalizedValue,
    validateInlineTableNumber,
    type InlineTableEnumOption as EnumOption
} from './inlineTableEditorValueUtils'
import { normalizeInlineTableRowOrdering, useInlineTableRowOrdering } from './useInlineTableRowOrdering'

export interface InlineTableEditorProps {
    /** Display label for the table section */
    label: string
    /** Current rows value (controlled) — array of objects with child component codenames as keys */
    value: Record<string, unknown>[]
    /** Called when rows change */
    onChange: (rows: Record<string, unknown>[]) => void
    /** Child components from DynamicFieldConfig.childFields */
    childFields: DynamicFieldConfig[]
    /** Current rows from sibling TABLE fields, keyed by their metadata codenames. */
    siblingTableValues?: Record<string, { rows: Record<string, unknown>[]; childFields: DynamicFieldConfig[]; rowOrdering?: unknown }>
    /** Optional row order metadata from the parent TABLE component. */
    rowOrdering?: unknown
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

type SiblingRowSelectConfig = TabularSiblingSelectConfig

const readSiblingRowSelectConfig = (field: DynamicFieldConfig): SiblingRowSelectConfig | null => readTabularSiblingSelectConfig(field)

const isHiddenChildField = (field: DynamicFieldConfig): boolean =>
    field.hidden === true ||
    field.uiConfig?.hidden === true ||
    field.uiConfig?.gridHidden === true ||
    field.uiConfig?.formHidden === true ||
    field.uiConfig?.serverOwned === true ||
    field.uiConfig?.generateUuidV7 === true

/**
 * Inline table editor for TABLE component child rows.
 * Uses simple MUI Table with editable inputs for a clean, compact look.
 */
export function InlineTableEditor({
    label,
    value,
    onChange,
    childFields,
    siblingTableValues,
    rowOrdering,
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
    const [assessmentOptionsEditor, setAssessmentOptionsEditor] = useState<{
        rowId: string
        fieldId: string
        value: unknown
        minOptions: number
        maxOptions: number
    } | null>(null)

    const handleCloseRowMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])
    const moveUpLabel = t('records.table.moveUp', 'Move up')
    const moveDownLabel = t('records.table.moveDown', 'Move down')
    const {
        orderedRows: orderedValue,
        rowsWithIds: rows,
        canReorderRows,
        handleMoveRow,
        menuRowIndex,
        menuRowLabel
    } = useInlineTableRowOrdering({
        value,
        rowOrdering,
        childFields,
        menuRowId,
        onChange,
        onCloseRowMenu: handleCloseRowMenu,
        locale,
        fallbackRowLabel: (rowNumber) => t('records.table.rowLabel', { row: rowNumber }),
        moveUpLabel,
        moveDownLabel
    })
    const visibleChildFields = useMemo(() => childFields.filter((field) => !isHiddenChildField(field)), [childFields])

    // Memoize first editable field for Edit menu item disabled state
    const firstEditableFieldId = useMemo(
        () => visibleChildFields.find((f) => (f.type === 'STRING' || f.type === 'NUMBER') && !readSiblingRowSelectConfig(f))?.id ?? null,
        [visibleChildFields]
    )

    const handleAddRow = useCallback(() => {
        if (typeof maxRows === 'number' && orderedValue.length >= maxRows) return
        const localId = nextLocalIdRef.current++
        const rowId = `__local_new_${localId}`
        const newRow: Record<string, unknown> = {
            _localId: rowId
        }
        for (const field of childFields) {
            if (field.type === 'BOOLEAN') {
                newRow[field.id] = false
            } else if (field.type === 'STRING' && field.uiConfig?.generateUuidV7 === true) {
                newRow[field.id] = generateUuidV7()
            } else {
                newRow[field.id] = null
            }
        }
        onChange(normalizeInlineTableRowOrdering([...orderedValue, newRow], rowOrdering, childFields))
        // Auto-focus first editable STRING/NUMBER cell in the new row
        const firstEditable = visibleChildFields.find(
            (field) => (field.type === 'STRING' || field.type === 'NUMBER') && !readSiblingRowSelectConfig(field)
        )
        if (firstEditable) {
            setEditingCell({ rowId, fieldId: firstEditable.id })
        }
    }, [orderedValue, onChange, childFields, visibleChildFields, maxRows, rowOrdering])

    const handleDeleteRow = useCallback(
        (rowId: string) => {
            onChange(
                normalizeInlineTableRowOrdering(
                    orderedValue.filter((row, idx) => getInlineTableRowId(row, idx) !== rowId),
                    rowOrdering,
                    childFields
                )
            )
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
        [orderedValue, onChange, rowOrdering, childFields]
    )

    const handleOpenRowMenu = useCallback((event: MouseEvent<HTMLElement>, rowId: string) => {
        setMenuAnchorEl(event.currentTarget)
        setMenuRowId(rowId)
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

    const handleCopyRowFromMenu = useCallback(() => {
        if (!menuRowId) {
            handleCloseRowMenu()
            return
        }
        if (typeof maxRows === 'number' && rows.length >= maxRows) {
            handleCloseRowMenu()
            return
        }
        const sourceIndex = rows.findIndex((row, index) => getInlineTableRowId(row, index) === menuRowId)
        if (sourceIndex < 0) {
            handleCloseRowMenu()
            return
        }
        const sourceRow = rows[sourceIndex]
        const { __rowId: _rowId, ...sourceData } = sourceRow
        const copiedRow = { ...sourceData, _localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
        for (const field of childFields) {
            if (field.type === 'STRING' && field.uiConfig?.generateUuidV7 === true) copiedRow[field.id] = generateUuidV7()
        }
        const nextRows = [...orderedValue]
        nextRows.splice(sourceIndex + 1, 0, copiedRow)
        onChange(normalizeInlineTableRowOrdering(nextRows, rowOrdering, childFields))
        handleCloseRowMenu()
    }, [menuRowId, maxRows, rows, orderedValue, childFields, rowOrdering, onChange, handleCloseRowMenu])

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
            const updated = orderedValue.map((row, idx) => {
                if (getInlineTableRowId(row, idx) !== rowId) return row
                const patched = { ...row }
                if (readSiblingRowSelectConfig(field)) {
                    patched[fieldId] = typeof newValue === 'string' && newValue.trim() ? newValue.trim() : null
                } else if (isInlineTableLocalizedField(field)) {
                    const strValue = String(newValue ?? '')
                    patched[fieldId] = strValue ? toInlineTableLocalizedValue(strValue, locale) : null
                } else if (field.type === 'NUMBER') {
                    const numVal = newValue === '' || newValue === null ? null : Number(newValue)
                    const cellKey = `${rowId}:${fieldId}`
                    if (numVal !== null && !Number.isNaN(numVal)) {
                        const error = validateInlineTableNumber(numVal, field.validationRules)
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
            onChange(normalizeInlineTableRowOrdering(updated, rowOrdering, childFields))
        },
        [orderedValue, onChange, locale, rowOrdering, childFields]
    )

    const renderCell = (row: Record<string, unknown>, rowId: string, field: DynamicFieldConfig) => {
        const rawValue = row[field.id]
        const isEditing = editingCell?.rowId === rowId && editingCell?.fieldId === field.id
        const isNumberField = field.type === 'NUMBER'
        const isMultilineString = field.type === 'STRING' && field.uiConfig?.widget === 'textarea'
        const configuredRows = field.uiConfig?.rows
        const multilineRows =
            typeof configuredRows === 'number' && Number.isInteger(configuredRows) && configuredRows >= 2 && configuredRows <= 12
                ? configuredRows
                : 4

        if (readSiblingRowSelectConfig(field)) {
            return (
                <InlineSiblingRowSelectCell
                    field={field}
                    value={rawValue}
                    siblingTableValues={siblingTableValues}
                    locale={locale}
                    disabled={disabled}
                    onChange={(nextValue) => handleCellChange(rowId, field.id, nextValue, field)}
                />
            )
        }

        if (field.type === 'JSON' && field.uiConfig?.widget === 'assessmentOptions') {
            const optionCount = Array.isArray(rawValue) ? rawValue.length : 0
            const minOptions = resolveInlineTableOptionCount(field.uiConfig?.minOptions, 2)
            const maxOptions = Math.max(minOptions, resolveInlineTableOptionCount(field.uiConfig?.maxOptions, 20))
            return (
                <Button
                    size='small'
                    variant='text'
                    disabled={disabled}
                    onClick={() => setAssessmentOptionsEditor({ rowId, fieldId: field.id, value: rawValue, minOptions, maxOptions })}
                >
                    {t('records.table.assessmentOptions.open', 'Edit answers ({{count}})', { count: optionCount })}
                </Button>
            )
        }

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
            const mode = resolveInlineTableEnumMode(field.enumPresentationMode)
            const allowEmpty = field.enumAllowEmpty !== false
            const selectedValue = resolveInlineTableSelectedEnumValue(
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

        if (field.type === 'REF') {
            const hasReference = rawValue !== null && rawValue !== undefined && rawValue !== ''
            return (
                <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                    {hasReference
                        ? t('ref.unavailableSelection', 'Selected reference is unavailable.')
                        : t('ref.selectionUnavailable', 'Reference selection is not configured.')}
                </Typography>
            )
        }

        const displayValue =
            isInlineTableLocalizedField(field) || (rawValue !== null && typeof rawValue === 'object')
                ? extractInlineTableDisplayString(rawValue, locale)
                : rawValue ?? ''
        const displayText =
            displayValue == null || displayValue === '' ? (rawValue && typeof rawValue === 'object' ? '—' : '') : String(displayValue)

        if (disabled) {
            return (
                <Typography
                    sx={{
                        fontSize: 13,
                        ...(isMultilineString
                            ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', width: '100%' }
                            : { overflow: 'hidden', textOverflow: 'ellipsis' })
                    }}
                    noWrap={!isMultilineString}
                >
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
                    multiline={isMultilineString}
                    rows={isMultilineString ? multilineRows : undefined}
                    value={displayValue ?? ''}
                    onChange={(e) => handleCellChange(rowId, field.id, e.target.value, field)}
                    onBlur={() => {
                        if (suppressNextBlurRef.current) return
                        setEditingCell(null)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' || (e.key === 'Enter' && !isMultilineString)) {
                            setEditingCell(null)
                            return
                        }
                    }}
                    error={hasError}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    fullWidth
                    slotProps={{ input: { sx: { fontSize: 13 } }, htmlInput: { 'aria-label': field.label } }}
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
                    width: '100%',
                    minHeight: 20,
                    ...(isMultilineString
                        ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
                        : { overflow: 'hidden', textOverflow: 'ellipsis' })
                }}
                noWrap={!isMultilineString}
            >
                {displayText}
            </Typography>
        )
    }

    const addDisabled = typeof maxRows === 'number' && orderedValue.length >= maxRows

    const { helperText: tableHelperText, isMissing: checkMissing } = buildTableConstraintText({
        required,
        minRows,
        maxRows,
        t
    })
    const tableMissing = checkMissing(orderedValue.length)

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                {showTitle !== false && (
                    <Typography
                        variant='subtitle2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
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
                        {t('records.table.addRow', 'Add Row')}
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
                            {visibleChildFields.map((field) => (
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
                                        {visibleChildFields.map((field) => {
                                            const isTextLike =
                                                (field.type === 'STRING' || field.type === 'NUMBER') && !readSiblingRowSelectConfig(field)
                                            const isCellEditing = editingCell?.rowId === rowId && editingCell?.fieldId === field.id
                                            const canActivate = !disabled && isTextLike && !isCellEditing
                                            const anotherCellEditing = editingCell !== null && !isCellEditing

                                            return (
                                                <TableCell
                                                    key={field.id}
                                                    align={field.type === 'NUMBER' ? 'right' : 'left'}
                                                    tabIndex={canActivate ? 0 : undefined}
                                                    aria-label={
                                                        canActivate
                                                            ? t('records.table.editCell', 'Edit {{field}} in row {{row}}', {
                                                                  field: field.label,
                                                                  row: index + 1
                                                              })
                                                            : undefined
                                                    }
                                                    aria-keyshortcuts={canActivate ? 'Enter Space' : undefined}
                                                    onKeyDown={
                                                        canActivate
                                                            ? (event) => {
                                                                  if (event.key !== 'Enter' && event.key !== ' ') return
                                                                  event.preventDefault()
                                                                  setEditingCell({ rowId, fieldId: field.id })
                                                              }
                                                            : undefined
                                                    }
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
                                                            '&:hover': { backgroundColor: 'action.hover' },
                                                            '&:focus-visible': {
                                                                outline: '2px solid',
                                                                outlineColor: 'primary.main',
                                                                outlineOffset: '-2px'
                                                            }
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
                                                    aria-label={t('records.table.actions', 'Actions')}
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
                                    colSpan={visibleChildFields.length + (disabled ? 1 : 2)}
                                    sx={{ textAlign: 'center', py: 2, color: 'text.secondary', border: 0 }}
                                >
                                    <Typography
                                        variant='body2'
                                        sx={{
                                            color: 'text.secondary'
                                        }}
                                    >
                                        {t('records.table.noRows', 'No rows yet. Click "Add Row" to add data.')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {assessmentOptionsEditor ? (
                <AssessmentOptionsEditorDialog
                    open
                    value={assessmentOptionsEditor.value}
                    locale={locale}
                    minOptions={assessmentOptionsEditor.minOptions}
                    maxOptions={assessmentOptionsEditor.maxOptions}
                    onClose={() => setAssessmentOptionsEditor(null)}
                    onSave={(options) => {
                        const field = childFields.find((item) => item.id === assessmentOptionsEditor.fieldId)
                        if (field) handleCellChange(assessmentOptionsEditor.rowId, assessmentOptionsEditor.fieldId, options, field)
                        setAssessmentOptionsEditor(null)
                    }}
                />
            ) : null}
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
                disableAutoFocusItem
            >
                <MenuItem onClick={handleEditRowFromMenu} disabled={!firstEditableFieldId}>
                    <EditIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('records.table.edit', 'Edit')}
                </MenuItem>
                {canReorderRows ? (
                    <>
                        <MenuItem
                            onClick={() => handleMoveRow(-1)}
                            disabled={menuRowIndex <= 0}
                            aria-label={`${moveUpLabel}: ${menuRowLabel}`}
                        >
                            {moveUpLabel}
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleMoveRow(1)}
                            disabled={menuRowIndex < 0 || menuRowIndex >= orderedValue.length - 1}
                            aria-label={`${moveDownLabel}: ${menuRowLabel}`}
                        >
                            {moveDownLabel}
                        </MenuItem>
                    </>
                ) : null}
                <MenuItem onClick={handleCopyRowFromMenu}>
                    <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('records.table.copy', 'Copy')}
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleDeleteRowFromMenu} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('records.table.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <ConfirmDeleteDialog
                open={Boolean(deleteRowId)}
                title={t('records.table.deleteTitle', 'Delete Row')}
                description={t('records.table.deleteDescription', 'Are you sure you want to delete this row?')}
                confirmButtonText={t('records.table.delete', 'Delete')}
                cancelButtonText={t('records.table.cancel', 'Cancel')}
                onCancel={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </Box>
    )
}

export default InlineTableEditor
