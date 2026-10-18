import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataGrid, type GridRowsProp, useGridApiRef } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import { validateNumber, toNumberRules, type NumberValidationResult } from '@universo-react/utils'
import type { FieldConfig } from './dialogs/FormDialog'
import { ConfirmDeleteDialog } from './dialogs/ConfirmDeleteDialog'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { buildTabularColumns, isHiddenTabularField } from '../utils/tabularColumns'
import {
    buildInitialTabularRowValues,
    getTabularRowOrderingLabel,
    normalizeTabularCellValue,
    normalizeTabularRowOrdering,
    readTabularRowOrderingConfig,
    sortTabularRowsByOrder,
    type TabularSiblingTableValues
} from '../utils/tabularCellValues'

export interface TabularPartEditorProps {
    /** Display label for the table section. */
    label: string
    /** Current rows value (controlled). */
    value: Record<string, unknown>[]
    /** Called when rows change. */
    onChange: (rows: Record<string, unknown>[]) => void
    /** Child components. */
    childFields: FieldConfig[]
    /** Current rows from sibling TABLE fields, keyed by their metadata codenames. */
    siblingTableValues?: TabularSiblingTableValues
    /** Optional row order metadata from the parent TABLE component. */
    rowOrdering?: unknown
    /** Whether to show the label above the table. */
    showTitle?: boolean
    /** BCP-47 locale string for DataGrid i18n (e.g. "en", "ru"). */
    locale?: string
    /** Minimum number of rows (disables delete when at limit). */
    minRows?: number | null
    /** Maximum number of rows (disables add when at limit). */
    maxRows?: number | null
}

/** Retrieve a stable identifier for a row. */
function getRowId(row: Record<string, unknown>, index: number): string {
    return String(row._localId ?? row.id ?? `__local_${index}`)
}

/**
 * Inline editor for TABLE component child rows during CREATE mode.
 *
 * Manages local state (no API calls). Rows produced here are submitted
 * as part of the parent record's create payload.
 */
export function TabularPartEditor({
    label,
    value,
    onChange,
    childFields,
    siblingTableValues,
    rowOrdering,
    showTitle = true,
    locale,
    minRows,
    maxRows
}: TabularPartEditorProps) {
    const { t, i18n } = useTranslation('apps')
    const nextLocalIdRef = useRef(1)
    const pendingCellEditRef = useRef<{ rowId: string; fieldId: string } | null>(null)
    const orderingConfig = useMemo(() => readTabularRowOrderingConfig(rowOrdering), [rowOrdering])
    const orderedValue = useMemo(() => sortTabularRowsByOrder(value, rowOrdering, childFields), [value, rowOrdering, childFields])
    const canReorderRows = Boolean(orderingConfig)
    const apiRef = useGridApiRef()
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [rowEditError, setRowEditError] = useState<string | null>(null)
    const resolvedLocale = locale ?? i18n.language ?? 'en'
    const dataGridLocale = useMemo(() => getDataGridLocaleText(resolvedLocale), [resolvedLocale])
    const firstEditableFieldId = useMemo(
        () => childFields.find((field) => !isHiddenTabularField(field) && (field.type === 'STRING' || field.type === 'NUMBER'))?.id ?? null,
        [childFields]
    )
    const deleteDisabled = typeof minRows === 'number' && orderedValue.length <= minRows

    const startRowPrimaryEdit = useCallback(
        (rowId: string) => {
            if (!firstEditableFieldId) return
            window.requestAnimationFrame(() => {
                const api = apiRef.current
                if (!api) return
                api.setCellFocus(rowId, firstEditableFieldId)
                api.startCellEditMode({ id: rowId, field: firstEditableFieldId })
            })
        },
        [apiRef, firstEditableFieldId]
    )

    // Ensure every row has a local id for DataGrid
    const rows: GridRowsProp = useMemo(
        () =>
            orderedValue.map((row, index) => ({
                ...row,
                id: getRowId(row, index),
                _tp_sort_order: row._tp_sort_order ?? index
            })),
        [orderedValue]
    )

    const addDisabled = typeof maxRows === 'number' && orderedValue.length >= maxRows

    const getNumberValidationMessage = useCallback(
        (field: FieldConfig, result: NumberValidationResult): string => {
            const rules = field.validationRules ?? {}

            switch (result.errorKey) {
                case 'mustBeNonNegative':
                    return t('validation.nonNegative', 'Must be non-negative')
                case 'belowMinimum':
                    return t('validation.minValue', {
                        defaultValue: 'Minimum value: {{min}}',
                        min: typeof rules.min === 'number' ? rules.min : result.errorParams?.min
                    })
                case 'aboveMaximum':
                    return t('validation.maxValue', {
                        defaultValue: 'Maximum value: {{max}}',
                        max: typeof rules.max === 'number' ? rules.max : result.errorParams?.max
                    })
                case 'tooManyIntegerDigits':
                case 'tooManyDecimalDigits':
                case 'exceedsSafeInteger':
                    return t('validation.numberPrecisionExceeded', 'Value exceeds allowed precision')
                default:
                    return t('validation.invalidNumber', 'Invalid number')
            }
        },
        [t]
    )

    const handleAddRow = useCallback(() => {
        if (typeof maxRows === 'number' && orderedValue.length >= maxRows) return
        setRowEditError(null)
        const localId = nextLocalIdRef.current++
        const newRow: Record<string, unknown> = {
            _localId: `__local_new_${localId}`,
            ...buildInitialTabularRowValues(childFields),
            _tp_sort_order: orderedValue.length
        }

        if (firstEditableFieldId) {
            pendingCellEditRef.current = { rowId: String(newRow._localId), fieldId: firstEditableFieldId }
        }

        onChange(normalizeTabularRowOrdering([...orderedValue, newRow], rowOrdering, childFields))
    }, [orderedValue, onChange, childFields, maxRows, firstEditableFieldId, rowOrdering])

    useEffect(() => {
        const pending = pendingCellEditRef.current
        if (!pending) return

        const exists = rows.some((row) => String((row as Record<string, unknown>).id ?? '') === pending.rowId)
        if (!exists) return

        pendingCellEditRef.current = null
        startRowPrimaryEdit(pending.rowId)
    }, [rows, startRowPrimaryEdit])

    const handleDeleteRow = useCallback(
        (rowId: string) => {
            if (deleteDisabled) return
            setRowEditError(null)
            onChange(
                normalizeTabularRowOrdering(
                    orderedValue.filter((row, idx) => getRowId(row, idx) !== rowId),
                    rowOrdering,
                    childFields
                )
            )
        },
        [orderedValue, onChange, deleteDisabled, rowOrdering, childFields]
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
        if (menuRowId) {
            startRowPrimaryEdit(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, startRowPrimaryEdit, handleCloseRowMenu])

    const handleDeleteRowFromMenu = useCallback(() => {
        if (menuRowId && !deleteDisabled) {
            setDeleteRowId(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, deleteDisabled, handleCloseRowMenu])

    const handleConfirmDelete = useCallback(() => {
        if (deleteRowId) {
            handleDeleteRow(deleteRowId)
        }
        setDeleteRowId(null)
    }, [deleteRowId, handleDeleteRow])

    const handleCancelDelete = useCallback(() => {
        setDeleteRowId(null)
    }, [])

    const handleSelectChange = useCallback(
        (rowId: string, fieldId: string, newValue: unknown) => {
            setRowEditError(null)
            const updated = orderedValue.map((row, idx) => {
                if (getRowId(row, idx) !== rowId) return row
                return { ...row, [fieldId]: newValue }
            })
            onChange(normalizeTabularRowOrdering(updated, rowOrdering, childFields))
        },
        [orderedValue, onChange, rowOrdering, childFields]
    )

    const rowNumberById = useMemo(() => {
        const map = new Map<string, number>()
        rows.forEach((row, index) => {
            map.set(String((row as Record<string, unknown>).id ?? ''), index + 1)
        })
        return map
    }, [rows])

    const columns = useMemo(
        () =>
            buildTabularColumns({
                childFields,
                rowNumberById,
                onDeleteRow: handleDeleteRow,
                onOpenRowMenu: handleOpenRowMenu,
                onSelectChange: handleSelectChange,
                deleteAriaLabel: t('tabular.delete', 'Delete'),
                actionsAriaLabel: t('app.actions', 'Actions'),
                locale: resolvedLocale,
                numberIncrementAriaLabel: t('number.increment', 'Increment'),
                numberDecrementAriaLabel: t('number.decrement', 'Decrement'),
                numberInvalidMessage: t('validation.invalidNumber', 'Invalid number'),
                getNumberValidationMessage,
                siblingTableValues,
                siblingSelectPlaceholderLabel: t(
                    'tabular.siblingSelectPlaceholder',
                    resolvedLocale.startsWith('ru') ? 'Выберите вариант' : 'Select an option'
                ),
                siblingNoOptionsLabel: t(
                    'tabular.siblingNoOptions',
                    resolvedLocale.startsWith('ru') ? 'Нет доступных вариантов' : 'No options available'
                ),
                siblingNoSelectableOptionsLabel: t(
                    'tabular.siblingNoSelectableOptions',
                    resolvedLocale.startsWith('ru') ? 'Нет записей с доступными названиями' : 'No items have usable labels'
                ),
                siblingUnavailableLabel: t(
                    'tabular.siblingUnavailable',
                    resolvedLocale.startsWith('ru') ? 'Вариант недоступен' : 'Unavailable option'
                )
            }),
        [
            childFields,
            rowNumberById,
            handleDeleteRow,
            handleOpenRowMenu,
            handleSelectChange,
            siblingTableValues,
            t,
            resolvedLocale,
            getNumberValidationMessage
        ]
    )

    const handleMoveRow = useCallback(
        (direction: -1 | 1) => {
            if (!canReorderRows || !menuRowId) return
            const currentIndex = orderedValue.findIndex((row, index) => getRowId(row, index) === menuRowId)
            const nextIndex = currentIndex + direction
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedValue.length) {
                handleCloseRowMenu()
                return
            }
            const nextRows = [...orderedValue]
            ;[nextRows[currentIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[currentIndex]]
            onChange(normalizeTabularRowOrdering(nextRows, rowOrdering, childFields))
            handleCloseRowMenu()
        },
        [canReorderRows, menuRowId, orderedValue, rowOrdering, childFields, onChange, handleCloseRowMenu]
    )

    const menuRowIndex = orderedValue.findIndex((row, index) => getRowId(row, index) === menuRowId)
    const menuRowLabel =
        menuRowIndex >= 0
            ? getTabularRowOrderingLabel(orderedValue[menuRowIndex], rowOrdering, childFields, resolvedLocale) ||
              (resolvedLocale.startsWith('ru') ? `Строка ${menuRowIndex + 1}` : `Row ${menuRowIndex + 1}`)
            : ''
    const moveUpLabel = t('runtime.table.moveUp', resolvedLocale.startsWith('ru') ? 'Переместить вверх' : 'Move up')
    const moveDownLabel = t('runtime.table.moveDown', resolvedLocale.startsWith('ru') ? 'Переместить вниз' : 'Move down')

    return (
        <Box sx={{ mt: 1, width: '100%', maxWidth: '100%', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: showTitle ? 'space-between' : 'flex-end', mb: 1 }}>
                {showTitle && (
                    <Typography
                        variant='subtitle2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        {label}
                    </Typography>
                )}
                <Button size='small' startIcon={<AddIcon />} onClick={handleAddRow} disabled={addDisabled}>
                    {t('tabular.addRow', 'Add Row')}
                </Button>
            </Box>

            {rowEditError && (
                <Alert severity='error' sx={{ mb: 1 }} onClose={() => setRowEditError(null)}>
                    {rowEditError}
                </Alert>
            )}

            {/* Flex container replaces deprecated autoHeight prop (MUI DataGrid v7+) */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 36,
                    maxHeight: 400,
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflowX: 'hidden'
                }}
            >
                <DataGrid
                    apiRef={apiRef}
                    rows={rows}
                    columns={columns}
                    density='compact'
                    hideFooter
                    disableRowSelectionOnClick
                    disableColumnResize
                    getRowHeight={() => 'auto'}
                    getRowId={(row) => String((row as Record<string, unknown>).id)}
                    localeText={{
                        ...dataGridLocale,
                        noRowsLabel: t('tabular.noRows', 'No rows yet. Click "Add Row" to start.')
                    }}
                    processRowUpdate={(newRow, _oldRow) => {
                        const rowId = String(newRow.id)
                        const correctedRow = { ...newRow }
                        setRowEditError(null)
                        const updated = orderedValue.map((row, idx) => {
                            if (getRowId(row, idx) !== rowId) return row
                            const patched = { ...row }
                            for (const field of childFields) {
                                if (newRow[field.id] !== undefined) {
                                    let cellValue = normalizeTabularCellValue(field, newRow[field.id], resolvedLocale)
                                    // Convert empty string to null for REF fields (singleSelect empty option)
                                    if (field.type === 'REF' && cellValue === '') {
                                        cellValue = null
                                    }
                                    // Validate NUMBER fields before committing the local row.
                                    if (
                                        field.type === 'NUMBER' &&
                                        cellValue != null &&
                                        typeof cellValue === 'number' &&
                                        !Number.isNaN(cellValue) &&
                                        field.validationRules
                                    ) {
                                        const result = validateNumber(cellValue, toNumberRules(field.validationRules))
                                        if (!result.valid) {
                                            throw new Error(getNumberValidationMessage(field, result))
                                        }
                                    }
                                    patched[field.id] = cellValue
                                    correctedRow[field.id] = cellValue
                                }
                            }
                            return patched
                        })
                        onChange(normalizeTabularRowOrdering(updated, rowOrdering, childFields))
                        return correctedRow
                    }}
                    onProcessRowUpdateError={(error) => {
                        setRowEditError(
                            error instanceof Error && error.message ? error.message : t('validation.invalidNumber', 'Invalid number')
                        )
                    }}
                    sx={{
                        flex: 1,
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        // Compact overlay height for empty state
                        '--DataGrid-overlayHeight': '52px',
                        [`& .MuiDataGrid-columnHeader`]: {
                            backgroundColor: 'grey.100',
                            position: 'relative'
                        },
                        // Internal header separators only (exclude the first real column)
                        '& .MuiDataGrid-columnHeader[data-field]:not([data-field="__rowNumber"])::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 6,
                            bottom: 6,
                            width: '1px',
                            backgroundColor: 'common.white'
                        },
                        // Ensure all cell content is vertically centered with padding for auto row height
                        '& .MuiDataGrid-cell': {
                            display: 'flex',
                            alignItems: 'center',
                            py: '8px',
                            minHeight: 36,
                            position: 'relative'
                        },
                        // Right-aligned cells (NUMBER type) need flex-end in flex context
                        '& .MuiDataGrid-cell--textRight': {
                            justifyContent: 'flex-end'
                        },
                        // Internal body separators only (exclude the first real column)
                        '& .MuiDataGrid-cell[data-field]:not([data-field="__rowNumber"])::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 6,
                            bottom: 6,
                            width: '1px',
                            backgroundColor: 'grey.100'
                        },
                        '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root:hover, & .MuiDataGrid-menuIconButton:hover': {
                            backgroundColor: 'grey.300'
                        },
                        '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root:active, & .MuiDataGrid-menuIconButton:active': {
                            backgroundColor: 'grey.400'
                        }
                    }}
                />
            </Box>

            <Menu
                open={Boolean(menuAnchorEl)}
                anchorEl={menuAnchorEl}
                onClose={handleCloseRowMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={handleEditRowFromMenu} disabled={!firstEditableFieldId}>
                    <EditIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.edit', 'Edit')}
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
                <Divider />
                <MenuItem onClick={handleDeleteRowFromMenu} disabled={deleteDisabled} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('tabular.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <ConfirmDeleteDialog
                open={Boolean(deleteRowId)}
                title={t('tabular.deleteTitle', 'Delete Row')}
                description={t('tabular.deleteDescription', 'Are you sure you want to delete this row?')}
                confirmButtonText={t('tabular.delete', 'Delete')}
                cancelButtonText={t('tabular.cancel', 'Cancel')}
                onCancel={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </Box>
    )
}
