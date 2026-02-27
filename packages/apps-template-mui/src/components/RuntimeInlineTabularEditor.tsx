import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { DataGrid, type GridRowsProp, useGridApiRef } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { validateNumber, toNumberRules } from '@universo/utils'
import type { FieldConfig } from './dialogs/FormDialog'
import { ConfirmDeleteDialog } from './dialogs/ConfirmDeleteDialog'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { fetchTabularRows, createTabularRow, updateTabularRow, deleteTabularRow, copyTabularRow, type TabularRowsResponse } from '../api/api'
import { buildTabularColumns } from '../utils/tabularColumns'

export interface RuntimeInlineTabularEditorProps {
    /** Base API URL (e.g. `/api/v1`). */
    apiBaseUrl: string
    /** Application UUID. */
    applicationId: string
    /** Catalog UUID that owns the parent record. */
    catalogId: string
    /** Parent record UUID. */
    parentRecordId: string
    /** TABLE attribute UUID. */
    attributeId: string
    /** Child field definitions from the parent form's FieldConfig. */
    childFields: FieldConfig[]
    /** Whether to show the attribute label above the table. */
    showTitle?: boolean
    /** Label text for the table header. */
    label?: string
    /** BCP-47 locale string, e.g. `"en"`, `"ru"`. */
    locale?: string
    /** Optional error callback for mutation failures (e.g. to show a snackbar). */
    onError?: (message: string) => void
    /**
     * When true, all table edits are kept local and emitted via onChange.
     * Persistence happens only when parent form submits.
     */
    deferPersistence?: boolean
    /** Emits local table rows (child-field payload) when deferPersistence is enabled. */
    onChange?: (rows: Record<string, unknown>[]) => void
    /** Minimum number of rows (disables delete when at limit). */
    minRows?: number | null
    /** Maximum number of rows (disables add when at limit). */
    maxRows?: number | null
}

/**
 * Runtime inline editor for TABLE attribute child rows during EDIT mode.
 *
 * Provides the same inline editing experience as TabularPartEditor (CREATE mode).
 * Supports two modes:
 * - immediate persistence (default): every row mutation is written via tabular endpoints;
 * - deferred persistence: keep edits local and emit rows to parent form, persisted on Save.
 */
export function RuntimeInlineTabularEditor({
    apiBaseUrl,
    applicationId,
    catalogId,
    parentRecordId,
    attributeId,
    childFields,
    showTitle = true,
    label,
    locale,
    onError,
    deferPersistence = false,
    onChange,
    minRows,
    maxRows
}: RuntimeInlineTabularEditorProps) {
    const { t, i18n } = useTranslation('apps')
    const resolvedLocale = locale ?? i18n.language ?? 'en'
    const dataGridLocale = useMemo(() => getDataGridLocaleText(resolvedLocale), [resolvedLocale])
    const queryClient = useQueryClient()
    const apiRef = useGridApiRef()

    const queryKey = useMemo(
        () => ['tabularRows', applicationId, parentRecordId, attributeId],
        [applicationId, parentRecordId, attributeId]
    )

    // Fetch rows via React Query
    const {
        data: rowsData,
        isLoading,
        error: fetchError
    } = useQuery({
        queryKey,
        queryFn: () => fetchTabularRows({ apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId }),
        staleTime: 0,
        refetchOnMount: 'always'
    })

    const rows = useMemo(() => rowsData?.items ?? [], [rowsData])
    const nextLocalIdRef = useRef(1)
    const pendingCellEditRef = useRef<{ rowId: string; fieldId: string } | null>(null)

    // Delete confirmation state
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [mutationError, setMutationError] = useState<string | null>(null)
    const [draftRows, setDraftRows] = useState<Array<Record<string, unknown>>>([])
    const [hasLocalChanges, setHasLocalChanges] = useState(false)
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)

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

    const toGridRows = useCallback(
        (inputRows: Array<Record<string, unknown>>) =>
            inputRows.map((row, index) => ({
                ...row,
                id: row.id ?? `__row_${index}`,
                _tp_sort_order: row._tp_sort_order ?? index
            })),
        []
    )

    const emitRowsChange = useCallback(
        (nextGridRows: Array<Record<string, unknown>>) => {
            if (!deferPersistence || !onChange) return
            const payload = nextGridRows.map((row) => {
                const mapped: Record<string, unknown> = {}
                for (const field of childFields) {
                    mapped[field.id] = row[field.id] === undefined ? null : row[field.id]
                }
                return mapped
            })
            onChange(payload)
        },
        [deferPersistence, onChange, childFields]
    )

    useEffect(() => {
        if (!deferPersistence) return
        setDraftRows([])
        setHasLocalChanges(false)
        nextLocalIdRef.current = 1
    }, [deferPersistence, parentRecordId, attributeId])

    useEffect(() => {
        if (!deferPersistence) return
        if (!rowsData) return
        if (hasLocalChanges) return
        setDraftRows(toGridRows(rowsData.items ?? []))
    }, [deferPersistence, rowsData, hasLocalChanges, toGridRows])

    const effectiveRows = useMemo(() => {
        if (deferPersistence) return draftRows
        return toGridRows(rows)
    }, [deferPersistence, draftRows, rows, toGridRows])

    useEffect(() => {
        if (!deferPersistence) return
        const pending = pendingCellEditRef.current
        if (!pending) return
        const exists = effectiveRows.some((row) => String(row.id ?? '') === pending.rowId)
        if (!exists) return

        pendingCellEditRef.current = null
        startRowPrimaryEdit(pending.rowId)
    }, [deferPersistence, effectiveRows, startRowPrimaryEdit])

    // CREATE a new row via API and refetch
    const handleAddRow = useCallback(async () => {
        // Row limit guard
        const currentCount = deferPersistence ? draftRows.length : rows.length
        if (typeof maxRows === 'number' && currentCount >= maxRows) return

        if (deferPersistence) {
            setMutationError(null)
            const localId = nextLocalIdRef.current++
            const rowId = `__local_new_${localId}`
            const maxSortOrder = draftRows.reduce((max, row) => Math.max(max, Number(row._tp_sort_order ?? 0)), -1)
            const newRow: Record<string, unknown> = {
                id: rowId,
                _tp_sort_order: maxSortOrder + 1
            }
            for (const field of childFields) {
                newRow[field.id] = field.type === 'BOOLEAN' ? false : null
            }
            const nextRows = [...draftRows, newRow]
            setDraftRows(nextRows)
            setHasLocalChanges(true)
            if (firstEditableFieldId) {
                pendingCellEditRef.current = { rowId, fieldId: firstEditableFieldId }
            }
            emitRowsChange(nextRows)
            return
        }

        try {
            setMutationError(null)
            const maxSortOrder = rows.reduce((max, row) => Math.max(max, Number(row._tp_sort_order ?? 0)), -1)
            const data: Record<string, unknown> = {}
            for (const field of childFields) {
                data[field.id] = field.type === 'BOOLEAN' ? false : null
            }
            data._tp_sort_order = maxSortOrder + 1
            await createTabularRow({ apiBaseUrl, applicationId, parentRecordId, attributeId, catalogId, data })
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create row'
            setMutationError(message)
            onError?.(message)
        }
    }, [
        deferPersistence,
        draftRows,
        childFields,
        firstEditableFieldId,
        emitRowsChange,
        rows,
        maxRows,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        attributeId,
        catalogId,
        queryClient,
        queryKey,
        onError
    ])

    // DELETE confirmation handlers
    const handleRequestDelete = useCallback((rowId: string) => {
        setDeleteRowId(rowId)
        setDeleteError(null)
    }, [])

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteRowId) return

        // Row minimum guard
        const currentCount = deferPersistence ? draftRows.length : rows.length
        if (typeof minRows === 'number' && currentCount <= minRows) return

        if (deferPersistence) {
            const nextRows = draftRows.filter((row) => String(row.id) !== deleteRowId)
            setDraftRows(nextRows)
            setHasLocalChanges(true)
            emitRowsChange(nextRows)
            setDeleteRowId(null)
            setDeleteError(null)
            return
        }

        try {
            await deleteTabularRow({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                attributeId,
                catalogId,
                childRowId: deleteRowId
            })
            setDeleteRowId(null)
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete row'
            setDeleteError(message)
            onError?.(message)
        }
    }, [
        deleteRowId,
        deferPersistence,
        draftRows,
        rows,
        minRows,
        emitRowsChange,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        attributeId,
        catalogId,
        queryClient,
        queryKey,
        onError
    ])

    const handleCancelDelete = useCallback(() => {
        setDeleteRowId(null)
        setDeleteError(null)
    }, [])

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
            handleRequestDelete(menuRowId)
        }
        handleCloseRowMenu()
    }, [menuRowId, handleRequestDelete, handleCloseRowMenu])

    const handleCopyRowFromMenu = useCallback(async () => {
        if (!menuRowId) {
            handleCloseRowMenu()
            return
        }

        if (typeof maxRows === 'number' && effectiveRows.length >= maxRows) {
            handleCloseRowMenu()
            return
        }

        if (deferPersistence) {
            const sourceIndex = effectiveRows.findIndex((row) => String(row.id ?? '') === menuRowId)
            if (sourceIndex >= 0) {
                const source = effectiveRows[sourceIndex]
                const copied = { ...source, id: `__local_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
                const nextRows = [...effectiveRows]
                nextRows.splice(sourceIndex + 1, 0, copied)
                setDraftRows(nextRows)
                setHasLocalChanges(true)
                emitRowsChange(nextRows)
            }
            handleCloseRowMenu()
            return
        }

        try {
            await copyTabularRow({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                attributeId,
                catalogId,
                childRowId: menuRowId
            })
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to copy row'
            setMutationError(message)
            onError?.(message)
        } finally {
            handleCloseRowMenu()
        }
    }, [
        menuRowId,
        maxRows,
        effectiveRows,
        deferPersistence,
        emitRowsChange,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        attributeId,
        catalogId,
        queryClient,
        queryKey,
        onError,
        handleCloseRowMenu
    ])

    // UPDATE a row via API (processRowUpdate handler for DataGrid).
    // Throws on failure so DataGrid reverts the cell and calls onProcessRowUpdateError.
    const processRowUpdate = useCallback(
        async (newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => {
            if (deferPersistence) {
                const rowId = String(newRow.id)
                // Validate NUMBER fields — revert invalid values
                const validatedRow = { ...newRow }
                for (const field of childFields) {
                    if (field.type === 'NUMBER' && validatedRow[field.id] != null && typeof validatedRow[field.id] === 'number' && !Number.isNaN(validatedRow[field.id] as number) && field.validationRules) {
                        const result = validateNumber(validatedRow[field.id] as number, toNumberRules(field.validationRules))
                        if (!result.valid) {
                            validatedRow[field.id] = oldRow[field.id] ?? null
                        }
                    }
                }
                const nextRows = draftRows.map((row) => (String(row.id) === rowId ? { ...row, ...validatedRow } : row))
                setDraftRows(nextRows)
                setHasLocalChanges(true)
                emitRowsChange(nextRows)
                return validatedRow
            }

            const rowId = String(newRow.id)

            // Build data patch from fields, converting '' → null for REF fields
            const data: Record<string, unknown> = {}
            for (const field of childFields) {
                if (newRow[field.id] !== undefined) {
                    let value = newRow[field.id]
                    if (field.type === 'REF' && value === '') {
                        value = null
                    }
                    // Validate NUMBER fields — revert to old value if invalid
                    if (field.type === 'NUMBER' && value != null && typeof value === 'number' && !Number.isNaN(value) && field.validationRules) {
                        const result = validateNumber(value, toNumberRules(field.validationRules))
                        if (!result.valid) {
                            value = oldRow[field.id] ?? null
                        }
                    }
                    data[field.id] = value
                }
            }

            // Skip API call if nothing actually changed
            let hasChanges = false
            for (const key of Object.keys(data)) {
                if (data[key] !== oldRow[key]) {
                    hasChanges = true
                    break
                }
            }
            if (!hasChanges) return oldRow

            await updateTabularRow({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                attributeId,
                catalogId,
                childRowId: rowId,
                data
            })
            await queryClient.invalidateQueries({ queryKey })
            return { ...newRow, ...data }
        },
        [
            deferPersistence,
            draftRows,
            emitRowsChange,
            childFields,
            apiBaseUrl,
            applicationId,
            parentRecordId,
            attributeId,
            catalogId,
            queryClient,
            queryKey
        ]
    )

    const handleProcessRowUpdateError = useCallback(
        (err: Error) => {
            const message = err.message || 'Failed to update row'
            setMutationError(message)
            onError?.(message)
        },
        [onError]
    )

    // Handle select/radio value changes for always-visible controls (REF select/radio mode).
    // Applies optimistic cache update for instant UI feedback, then persists via API.
    const handleSelectChange = useCallback(
        async (rowId: string, fieldId: string, newValue: unknown) => {
            if (deferPersistence) {
                const nextRows = draftRows.map((row) => (String(row.id) === rowId ? { ...row, [fieldId]: newValue } : row))
                setDraftRows(nextRows)
                setHasLocalChanges(true)
                emitRowsChange(nextRows)
                return
            }

            // Optimistic cache update — reflect the change immediately
            queryClient.setQueryData<TabularRowsResponse>(queryKey, (old) => {
                if (!old) return old
                return {
                    ...old,
                    items: old.items.map((row) => (String(row.id) === rowId ? { ...row, [fieldId]: newValue } : row))
                }
            })

            try {
                setMutationError(null)
                await updateTabularRow({
                    apiBaseUrl,
                    applicationId,
                    parentRecordId,
                    attributeId,
                    catalogId,
                    childRowId: rowId,
                    data: { [fieldId]: newValue }
                })
                await queryClient.invalidateQueries({ queryKey })
            } catch (err) {
                // Revert optimistic update by refetching from server
                await queryClient.invalidateQueries({ queryKey })
                const message = err instanceof Error ? err.message : 'Failed to update row'
                setMutationError(message)
                onError?.(message)
            }
        },
        [
            deferPersistence,
            draftRows,
            emitRowsChange,
            apiBaseUrl,
            applicationId,
            parentRecordId,
            attributeId,
            catalogId,
            queryClient,
            queryKey,
            onError
        ]
    )

    const rowNumberById = useMemo(() => {
        const map = new Map<string, number>()
        effectiveRows.forEach((row, index) => {
            map.set(String(row.id ?? ''), index + 1)
        })
        return map
    }, [effectiveRows])

    const columns = useMemo(
        () =>
            buildTabularColumns({
                childFields,
                rowNumberById,
                onDeleteRow: handleRequestDelete,
                onOpenRowMenu: handleOpenRowMenu,
                onSelectChange: handleSelectChange,
                deleteAriaLabel: t('tabular.delete', 'Delete'),
                actionsAriaLabel: t('app.actions', 'Actions'),
                locale: resolvedLocale
            }),
        [childFields, rowNumberById, handleRequestDelete, handleOpenRowMenu, handleSelectChange, t, resolvedLocale]
    )

    const addDisabled = typeof maxRows === 'number' && effectiveRows.length >= maxRows

    const gridRows: GridRowsProp = useMemo(() => effectiveRows, [effectiveRows])

    const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : fetchError ? String(fetchError) : null

    return (
        <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: showTitle ? 'space-between' : 'flex-end', mb: 1 }}>
                {showTitle && (
                    <Typography variant='subtitle2' color='text.secondary'>
                        {label}
                    </Typography>
                )}
                <Button size='small' startIcon={<AddIcon />} onClick={handleAddRow} disabled={addDisabled}>
                    {t('tabular.addRow', 'Add Row')}
                </Button>
            </Box>

            {fetchErrorMessage && (
                <Alert severity='error' sx={{ mb: 1 }}>
                    {fetchErrorMessage}
                </Alert>
            )}

            {mutationError && (
                <Alert severity='error' sx={{ mb: 1 }} onClose={() => setMutationError(null)}>
                    {mutationError}
                </Alert>
            )}

            {isLoading && gridRows.length === 0 ? (
                <Skeleton variant='rectangular' height={80} sx={{ borderRadius: 1 }} />
            ) : (
                /* Flex container replaces deprecated autoHeight prop (MUI DataGrid v7+) */
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 36, maxHeight: 400 }}>
                    <DataGrid
                        apiRef={apiRef}
                        key={`${parentRecordId}-${attributeId}`}
                        rows={gridRows}
                        columns={columns}
                        density='compact'
                        hideFooter
                        disableRowSelectionOnClick
                        disableColumnResize
                        getRowHeight={() => 'auto'}
                        localeText={{
                            ...dataGridLocale,
                            noRowsLabel: t('tabular.noRows', 'No rows yet. Click "Add Row" to start.')
                        }}
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={handleProcessRowUpdateError}
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
                    {t('app.edit', 'Edit')}
                </MenuItem>
                <MenuItem
                    onClick={() => void handleCopyRowFromMenu()}
                    disabled={typeof maxRows === 'number' && effectiveRows.length >= maxRows}
                >
                    <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.copy', 'Copy')}
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={handleDeleteRowFromMenu}
                    sx={{ color: 'error.main' }}
                >
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
                error={deleteError ?? undefined}
                onCancel={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </Box>
    )
}
