import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataGrid, type GridRowsProp, useGridApiRef } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import type { FieldConfig } from './dialogs/FormDialog'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { buildTabularColumns } from '../utils/tabularColumns'

export interface TabularPartEditorProps {
    /** Display label for the table section. */
    label: string
    /** Current rows value (controlled). */
    value: Record<string, unknown>[]
    /** Called when rows change. */
    onChange: (rows: Record<string, unknown>[]) => void
    /** Child field definitions. */
    childFields: FieldConfig[]
    /** Whether to show the label above the table. */
    showTitle?: boolean
    /** BCP-47 locale string for DataGrid i18n (e.g. "en", "ru"). */
    locale?: string
}

/** Retrieve a stable identifier for a row. */
function getRowId(row: Record<string, unknown>, index: number): string {
    return String(row._localId ?? row.id ?? `__local_${index}`)
}

/**
 * Inline editor for TABLE attribute child rows during CREATE mode.
 *
 * Manages local state (no API calls). Rows produced here are submitted
 * as part of the parent record's create payload.
 */
export function TabularPartEditor({ label, value, onChange, childFields, showTitle = true, locale }: TabularPartEditorProps) {
    const { t, i18n } = useTranslation('apps')
    const nextLocalIdRef = useRef(1)
    const pendingCellEditRef = useRef<{ rowId: string; fieldId: string } | null>(null)
    const apiRef = useGridApiRef()
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)
    const resolvedLocale = locale ?? i18n.language ?? 'en'
    const dataGridLocale = useMemo(() => getDataGridLocaleText(resolvedLocale), [resolvedLocale])
    const firstEditableFieldId = useMemo(
        () => childFields.find((field) => field.type === 'STRING' || field.type === 'NUMBER')?.id ?? null,
        [childFields]
    )

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
            value.map((row, index) => ({
                ...row,
                id: getRowId(row, index),
                _tp_sort_order: row._tp_sort_order ?? index
            })),
        [value]
    )

    const handleAddRow = useCallback(() => {
        const localId = nextLocalIdRef.current++
        const newRow: Record<string, unknown> = {
            _localId: `__local_new_${localId}`,
            _tp_sort_order: value.length
        }
        for (const field of childFields) {
            newRow[field.id] = field.type === 'BOOLEAN' ? false : null
        }

        const firstEditableField = childFields.find((field) => field.type === 'STRING' || field.type === 'NUMBER')
        if (firstEditableField) {
            pendingCellEditRef.current = { rowId: String(newRow._localId), fieldId: firstEditableField.id }
        }

        onChange([...value, newRow])
    }, [value, onChange, childFields])

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
            onChange(value.filter((row, idx) => getRowId(row, idx) !== rowId))
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
        if (menuRowId) {
            startRowPrimaryEdit(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, startRowPrimaryEdit, handleCloseRowMenu])

    const handleDeleteRowFromMenu = useCallback(() => {
        if (menuRowId) {
            handleDeleteRow(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, handleDeleteRow, handleCloseRowMenu])

    const handleSelectChange = useCallback(
        (rowId: string, fieldId: string, newValue: unknown) => {
            const updated = value.map((row, idx) => {
                if (getRowId(row, idx) !== rowId) return row
                return { ...row, [fieldId]: newValue }
            })
            onChange(updated)
        },
        [value, onChange]
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
                actionsAriaLabel: t('app.actions', 'Actions')
            }),
        [childFields, rowNumberById, handleDeleteRow, handleOpenRowMenu, handleSelectChange, t]
    )

    return (
        <Box sx={{ mt: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: showTitle ? 'space-between' : 'flex-end', mb: 1 }}>
                {showTitle && (
                    <Typography variant='subtitle2' color='text.secondary'>
                        {label}
                    </Typography>
                )}
                <Button size='small' startIcon={<AddIcon />} onClick={handleAddRow}>
                    {t('tabular.addRow', 'Add Row')}
                </Button>
            </Box>

            {/* Flex container replaces deprecated autoHeight prop (MUI DataGrid v7+) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 36, maxHeight: 400 }}>
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
                    processRowUpdate={(newRow) => {
                        const rowId = String(newRow.id)
                        const updated = value.map((row, idx) => {
                            if (getRowId(row, idx) !== rowId) return row
                            const patched = { ...row }
                            for (const field of childFields) {
                                if (newRow[field.id] !== undefined) {
                                    let cellValue = newRow[field.id]
                                    // Convert empty string to null for REF fields (singleSelect empty option)
                                    if (field.type === 'REF' && cellValue === '') {
                                        cellValue = null
                                    }
                                    patched[field.id] = cellValue
                                }
                            }
                            return patched
                        })
                        onChange(updated)
                        return newRow
                    }}
                    onProcessRowUpdateError={(error) => {
                        console.error('[TabularPartEditor] Row update error:', error)
                    }}
                    sx={{
                        flex: 1,
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
                <Divider />
                <MenuItem onClick={handleDeleteRowFromMenu} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('tabular.delete', 'Delete')}
                </MenuItem>
            </Menu>
        </Box>
    )
}
