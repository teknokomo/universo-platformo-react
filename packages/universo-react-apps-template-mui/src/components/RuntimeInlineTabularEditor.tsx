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
import { generateUuidV7, validateNumber, toNumberRules, type NumberValidationResult } from '@universo-react/utils'
import type { FieldConfig } from './dialogs/FormDialog'
import { ConfirmDeleteDialog } from './dialogs/ConfirmDeleteDialog'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import {
    fetchTabularRows,
    createTabularRow,
    updateTabularRow,
    deleteTabularRow,
    copyTabularRow,
    type TabularRowsResponse
} from '../api/api'
import { buildTabularColumns, isHiddenTabularField } from '../utils/tabularColumns'
import {
    buildInitialTabularRowValues,
    getTabularRowOrderingLabel,
    normalizeTabularCellValue,
    normalizeTabularRowOrdering,
    normalizeTabularRowValues,
    type TabularSiblingTableValues
} from '../utils/tabularCellValues'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'
import { useDeferredTabularRows } from '../hooks/useDeferredTabularRows'

export interface RuntimeInlineTabularEditorProps {
    /** Base API URL (e.g. `/api/v1`). */
    apiBaseUrl: string
    /** Application UUID. */
    applicationId: string
    /** Object UUID that owns the parent record. */
    objectCollectionId: string
    /** Current workspace scope for TABLE child rows. */
    currentWorkspaceId?: string | null
    /** Parent record UUID. */
    parentRecordId: string
    /** TABLE component UUID. */
    componentId: string
    /** Child components from the parent form's FieldConfig. */
    childFields: FieldConfig[]
    /** Current rows from sibling TABLE fields, keyed by their metadata codenames. */
    siblingTableValues?: TabularSiblingTableValues
    /** Optional row order metadata from the parent TABLE component. */
    rowOrdering?: unknown
    /** Supplies fetched rows to the parent form without marking the field edited. */
    onRowsLoaded?: (rows: Record<string, unknown>[]) => void
    /** Whether to show the component label above the table. */
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
    /** Deferred parent rows. Echo the emitted array unchanged; a new array reconciles external edits or rolls back a rejected candidate. */
    value?: Record<string, unknown>[]
    /** Temporarily prevents edits while a related TABLE value is loading. */
    disabled?: boolean
    /** Emits local table rows (child-field payload) when deferPersistence is enabled. */
    onChange?: (rows: Record<string, unknown>[]) => void
    /** Minimum number of rows (disables delete when at limit). */
    minRows?: number | null
    /** Maximum number of rows (disables add when at limit). */
    maxRows?: number | null
    /** Copy is disabled for matrix coordinate tables because a copy needs explicit new coordinates. */
    copyRowsEnabled?: boolean
}

/**
 * Runtime inline editor for TABLE component child rows during EDIT mode.
 *
 * Provides the same inline editing experience as TabularPartEditor (CREATE mode).
 * Supports two modes:
 * - immediate persistence (default): every row mutation is written via tabular endpoints;
 * - deferred persistence: keep edits local and emit rows to parent form, persisted on Save.
 */
export function RuntimeInlineTabularEditor({
    apiBaseUrl,
    applicationId,
    objectCollectionId,
    currentWorkspaceId = null,
    parentRecordId,
    componentId,
    childFields,
    siblingTableValues,
    rowOrdering,
    onRowsLoaded,
    showTitle = true,
    label,
    locale,
    onError,
    deferPersistence = false,
    value,
    disabled = false,
    onChange,
    minRows,
    maxRows,
    copyRowsEnabled = true
}: RuntimeInlineTabularEditorProps) {
    const { t, i18n } = useTranslation('apps')
    const resolvedLocale = locale ?? i18n.language ?? 'en'
    const dataGridLocale = useMemo(() => getDataGridLocaleText(resolvedLocale), [resolvedLocale])
    const queryClient = useQueryClient()
    const apiRef = useGridApiRef()
    const getTabularErrorMessage = useCallback(
        (err: unknown, fallbackKey: string, fallback: string) => extractRuntimeErrorMessage(err, t(fallbackKey, fallback), resolvedLocale),
        [resolvedLocale, t]
    )
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

    const queryKey = useMemo(
        () => ['tabularRows', applicationId, parentRecordId, componentId, currentWorkspaceId],
        [applicationId, parentRecordId, componentId, currentWorkspaceId]
    )

    // Fetch rows via React Query
    const {
        data: rowsData,
        isLoading,
        isFetching,
        error: fetchError,
        refetch
    } = useQuery({
        queryKey,
        queryFn: () =>
            fetchTabularRows({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                componentId,
                objectCollectionId,
                workspaceId: currentWorkspaceId
            }),
        staleTime: 0,
        refetchOnMount: 'always'
    })

    const rows = useMemo(() => rowsData?.items ?? [], [rowsData])
    const nextLocalIdRef = useRef(1)
    const pendingCellEditRef = useRef<{ rowId: string; fieldId: string } | null>(null)
    const clearPendingCellEdit = useCallback(() => {
        pendingCellEditRef.current = null
    }, [])
    const { draftRows, setDraftRows, setHasLocalChanges, effectiveRows, emitRowsChange, canReorderRows } = useDeferredTabularRows({
        rowsData,
        rows,
        deferPersistence,
        parentRecordId,
        componentId,
        childFields,
        rowOrdering,
        resolvedLocale,
        onRowsLoaded,
        value,
        onChange,
        onValueReconciled: clearPendingCellEdit
    })

    // Delete confirmation state
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [mutationError, setMutationError] = useState<string | null>(null)
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)

    const firstEditableFieldId = useMemo(
        () => childFields.find((field) => !isHiddenTabularField(field) && (field.type === 'STRING' || field.type === 'NUMBER'))?.id ?? null,
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

    useEffect(() => {
        if (!deferPersistence) return
        nextLocalIdRef.current = 1
        pendingCellEditRef.current = null
    }, [deferPersistence, parentRecordId, componentId])

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
        if (disabled || isLoading) return
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
                ...buildInitialTabularRowValues(childFields),
                _tp_sort_order: maxSortOrder + 1
            }
            const nextRows = normalizeTabularRowOrdering([...draftRows, newRow], rowOrdering, childFields)
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
            const data: Record<string, unknown> = buildInitialTabularRowValues(childFields)
            data._tp_sort_order = maxSortOrder + 1
            await createTabularRow({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                componentId,
                objectCollectionId,
                workspaceId: currentWorkspaceId,
                data
            })
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = getTabularErrorMessage(err, 'tabular.errorCreate', 'Failed to create row')
            setMutationError(message)
            onError?.(message)
        }
    }, [
        deferPersistence,
        disabled,
        isLoading,
        draftRows,
        setDraftRows,
        setHasLocalChanges,
        childFields,
        rowOrdering,
        firstEditableFieldId,
        emitRowsChange,
        rows,
        maxRows,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        componentId,
        objectCollectionId,
        currentWorkspaceId,
        queryClient,
        queryKey,
        onError,
        getTabularErrorMessage
    ])

    // DELETE confirmation handlers
    const handleRequestDelete = useCallback(
        (rowId: string) => {
            if (disabled) return
            setDeleteRowId(rowId)
            setDeleteError(null)
        },
        [disabled]
    )

    const handleConfirmDelete = useCallback(async () => {
        if (disabled || !deleteRowId) return

        // Row minimum guard
        const currentCount = deferPersistence ? draftRows.length : rows.length
        if (typeof minRows === 'number' && currentCount <= minRows) return

        if (deferPersistence) {
            const nextRows = normalizeTabularRowOrdering(
                draftRows.filter((row) => String(row.id) !== deleteRowId),
                rowOrdering,
                childFields
            )
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
                componentId,
                objectCollectionId,
                workspaceId: currentWorkspaceId,
                childRowId: deleteRowId
            })
            setDeleteRowId(null)
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = getTabularErrorMessage(err, 'tabular.errorDelete', 'Failed to delete row')
            setDeleteError(message)
            onError?.(message)
        }
    }, [
        deleteRowId,
        disabled,
        deferPersistence,
        draftRows,
        setDraftRows,
        setHasLocalChanges,
        rows,
        rowOrdering,
        childFields,
        minRows,
        emitRowsChange,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        componentId,
        objectCollectionId,
        currentWorkspaceId,
        queryClient,
        queryKey,
        onError,
        getTabularErrorMessage
    ])

    const handleCancelDelete = useCallback(() => {
        setDeleteRowId(null)
        setDeleteError(null)
    }, [])

    const handleOpenRowMenu = useCallback(
        (event: MouseEvent<HTMLElement>, rowId: string) => {
            if (disabled) return
            setMenuAnchorEl(event.currentTarget)
            setMenuRowId(rowId)
        },
        [disabled]
    )

    const handleCloseRowMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    const handleEditRowFromMenu = useCallback(() => {
        if (disabled) return
        if (menuRowId) {
            startRowPrimaryEdit(menuRowId)
        }
        handleCloseRowMenu()
    }, [disabled, menuRowId, startRowPrimaryEdit, handleCloseRowMenu])

    const handleDeleteRowFromMenu = useCallback(() => {
        if (disabled) return
        if (menuRowId) {
            handleRequestDelete(menuRowId)
        }
        handleCloseRowMenu()
    }, [disabled, menuRowId, handleRequestDelete, handleCloseRowMenu])

    const handleCopyRowFromMenu = useCallback(async () => {
        if (disabled) {
            handleCloseRowMenu()
            return
        }
        if (!menuRowId) {
            handleCloseRowMenu()
            return
        }

        if (!copyRowsEnabled) {
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
                const copied: Record<string, unknown> = {
                    ...source,
                    id: `__local_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                }
                for (const field of childFields) {
                    if (field.type === 'STRING' && field.uiConfig?.generateUuidV7 === true) copied[field.id] = generateUuidV7()
                }
                const nextRows = [...effectiveRows]
                nextRows.splice(sourceIndex + 1, 0, copied)
                const orderedRows = normalizeTabularRowOrdering(nextRows, rowOrdering, childFields)
                setDraftRows(orderedRows)
                setHasLocalChanges(true)
                emitRowsChange(orderedRows)
            }
            handleCloseRowMenu()
            return
        }

        try {
            await copyTabularRow({
                apiBaseUrl,
                applicationId,
                parentRecordId,
                componentId,
                objectCollectionId,
                workspaceId: currentWorkspaceId,
                childRowId: menuRowId
            })
            await queryClient.invalidateQueries({ queryKey })
        } catch (err) {
            const message = getTabularErrorMessage(err, 'tabular.errorCopy', 'Failed to copy row')
            setMutationError(message)
            onError?.(message)
        } finally {
            handleCloseRowMenu()
        }
    }, [
        menuRowId,
        disabled,
        maxRows,
        effectiveRows,
        setDraftRows,
        setHasLocalChanges,
        childFields,
        rowOrdering,
        deferPersistence,
        emitRowsChange,
        apiBaseUrl,
        applicationId,
        parentRecordId,
        componentId,
        objectCollectionId,
        currentWorkspaceId,
        queryClient,
        queryKey,
        onError,
        handleCloseRowMenu,
        getTabularErrorMessage,
        copyRowsEnabled
    ])

    // UPDATE a row via API (processRowUpdate handler for DataGrid).
    // Throws on failure so DataGrid reverts the cell and calls onProcessRowUpdateError.
    const processRowUpdate = useCallback(
        async (newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => {
            if (disabled) return oldRow
            setMutationError(null)

            if (deferPersistence) {
                const rowId = String(newRow.id)
                // Validate NUMBER fields before committing the local row.
                const validatedRow = normalizeTabularRowValues(newRow, childFields, resolvedLocale)
                for (const field of childFields) {
                    if (
                        field.type === 'NUMBER' &&
                        validatedRow[field.id] != null &&
                        typeof validatedRow[field.id] === 'number' &&
                        !Number.isNaN(validatedRow[field.id] as number) &&
                        field.validationRules
                    ) {
                        const result = validateNumber(validatedRow[field.id] as number, toNumberRules(field.validationRules))
                        if (!result.valid) {
                            throw new Error(getNumberValidationMessage(field, result))
                        }
                    }
                }
                const nextRows = normalizeTabularRowOrdering(
                    draftRows.map((row) => (String(row.id) === rowId ? { ...row, ...validatedRow } : row)),
                    rowOrdering,
                    childFields
                )
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
                    let value = normalizeTabularCellValue(field, newRow[field.id], resolvedLocale)
                    if (field.type === 'REF' && value === '') {
                        value = null
                    }
                    // Validate NUMBER fields before persisting the row.
                    if (
                        field.type === 'NUMBER' &&
                        value != null &&
                        typeof value === 'number' &&
                        !Number.isNaN(value) &&
                        field.validationRules
                    ) {
                        const result = validateNumber(value, toNumberRules(field.validationRules))
                        if (!result.valid) {
                            throw new Error(getNumberValidationMessage(field, result))
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
                componentId,
                objectCollectionId,
                workspaceId: currentWorkspaceId,
                childRowId: rowId,
                data
            })
            await queryClient.invalidateQueries({ queryKey })
            return { ...newRow, ...data }
        },
        [
            deferPersistence,
            disabled,
            draftRows,
            setDraftRows,
            setHasLocalChanges,
            emitRowsChange,
            rowOrdering,
            childFields,
            resolvedLocale,
            apiBaseUrl,
            applicationId,
            parentRecordId,
            componentId,
            objectCollectionId,
            currentWorkspaceId,
            queryClient,
            queryKey,
            getNumberValidationMessage
        ]
    )

    const handleProcessRowUpdateError = useCallback(
        (err: Error) => {
            const message = getTabularErrorMessage(err, 'tabular.errorUpdate', 'Failed to update row')
            setMutationError(message)
            onError?.(message)
        },
        [onError, getTabularErrorMessage]
    )

    // Handle select/radio value changes for always-visible controls (REF select/radio mode).
    // Applies optimistic cache update for instant UI feedback, then persists via API.
    const handleSelectChange = useCallback(
        async (rowId: string, fieldId: string, newValue: unknown) => {
            if (disabled) return
            if (deferPersistence) {
                const nextRows = normalizeTabularRowOrdering(
                    draftRows.map((row) => (String(row.id) === rowId ? { ...row, [fieldId]: newValue } : row)),
                    rowOrdering,
                    childFields
                )
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
                    componentId,
                    objectCollectionId,
                    workspaceId: currentWorkspaceId,
                    childRowId: rowId,
                    data: { [fieldId]: newValue }
                })
                await queryClient.invalidateQueries({ queryKey })
            } catch (err) {
                // Revert optimistic update by refetching from server
                await queryClient.invalidateQueries({ queryKey })
                const message = getTabularErrorMessage(err, 'tabular.errorUpdate', 'Failed to update row')
                setMutationError(message)
                onError?.(message)
            }
        },
        [
            deferPersistence,
            disabled,
            draftRows,
            setDraftRows,
            setHasLocalChanges,
            rowOrdering,
            childFields,
            emitRowsChange,
            apiBaseUrl,
            applicationId,
            parentRecordId,
            componentId,
            objectCollectionId,
            currentWorkspaceId,
            queryClient,
            queryKey,
            onError,
            getTabularErrorMessage
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
                locale: resolvedLocale,
                numberIncrementAriaLabel: t('number.increment', 'Increment'),
                numberDecrementAriaLabel: t('number.decrement', 'Decrement'),
                numberInvalidMessage: t('validation.invalidNumber', 'Invalid number'),
                getNumberValidationMessage,
                disabled,
                siblingTableValues,
                siblingSelectPlaceholderLabel: t(
                    'tabular.siblingSelectPlaceholder',
                    resolvedLocale === 'ru' ? 'Выберите вариант' : 'Select an option'
                ),
                siblingNoOptionsLabel: t(
                    'tabular.siblingNoOptions',
                    resolvedLocale === 'ru' ? 'Нет доступных вариантов' : 'No options available'
                ),
                siblingNoSelectableOptionsLabel: t(
                    'tabular.siblingNoSelectableOptions',
                    resolvedLocale === 'ru' ? 'Нет записей с доступными названиями' : 'No items have usable labels'
                ),
                siblingUnavailableLabel: t(
                    'tabular.siblingUnavailable',
                    resolvedLocale === 'ru' ? 'Вариант недоступен' : 'Unavailable option'
                )
            }),
        [
            childFields,
            rowNumberById,
            handleRequestDelete,
            handleOpenRowMenu,
            handleSelectChange,
            siblingTableValues,
            t,
            resolvedLocale,
            getNumberValidationMessage,
            disabled
        ]
    )

    const handleMoveRow = useCallback(
        (direction: -1 | 1) => {
            if (disabled || !canReorderRows || !menuRowId) return
            const currentIndex = effectiveRows.findIndex((row) => String(row.id ?? '') === menuRowId)
            const nextIndex = currentIndex + direction
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= effectiveRows.length) {
                handleCloseRowMenu()
                return
            }
            const nextRows = [...effectiveRows]
            ;[nextRows[currentIndex], nextRows[nextIndex]] = [nextRows[nextIndex], nextRows[currentIndex]]
            const orderedRows = normalizeTabularRowOrdering(nextRows, rowOrdering, childFields)
            setDraftRows(orderedRows)
            setHasLocalChanges(true)
            emitRowsChange(orderedRows)
            handleCloseRowMenu()
        },
        [
            disabled,
            canReorderRows,
            menuRowId,
            effectiveRows,
            rowOrdering,
            childFields,
            setDraftRows,
            setHasLocalChanges,
            emitRowsChange,
            handleCloseRowMenu
        ]
    )

    const menuRowIndex = effectiveRows.findIndex((row) => String(row.id ?? '') === menuRowId)
    const menuRowLabel =
        menuRowIndex >= 0
            ? getTabularRowOrderingLabel(effectiveRows[menuRowIndex], rowOrdering, childFields, resolvedLocale) ||
              (resolvedLocale === 'ru' ? `Строка ${menuRowIndex + 1}` : `Row ${menuRowIndex + 1}`)
            : ''
    const moveUpLabel = t('runtime.table.moveUp', resolvedLocale === 'ru' ? 'Переместить вверх' : 'Move up')
    const moveDownLabel = t('runtime.table.moveDown', resolvedLocale === 'ru' ? 'Переместить вниз' : 'Move down')

    const addDisabled = disabled || isLoading || (typeof maxRows === 'number' && effectiveRows.length >= maxRows)

    const gridRows: GridRowsProp = useMemo(() => effectiveRows, [effectiveRows])

    const fetchErrorMessage = fetchError ? getTabularErrorMessage(fetchError, 'tabular.errorFetch', 'Failed to load rows') : null

    return (
        <Box sx={{ mt: 1 }}>
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

            {fetchErrorMessage && (
                <Alert
                    severity='error'
                    sx={{ mb: 1 }}
                    action={
                        <Button size='small' color='inherit' onClick={() => void refetch()} disabled={isFetching}>
                            {t('tabular.retry', 'Retry')}
                        </Button>
                    }
                >
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
                        key={`${parentRecordId}-${componentId}`}
                        rows={gridRows}
                        columns={columns}
                        density='compact'
                        hideFooter
                        isCellEditable={() => !disabled}
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
                <MenuItem onClick={handleEditRowFromMenu} disabled={disabled || !firstEditableFieldId}>
                    <EditIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.edit', 'Edit')}
                </MenuItem>
                {canReorderRows ? (
                    <>
                        <MenuItem
                            onClick={() => handleMoveRow(-1)}
                            disabled={disabled || menuRowIndex <= 0}
                            aria-label={`${moveUpLabel}: ${menuRowLabel}`}
                        >
                            {moveUpLabel}
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleMoveRow(1)}
                            disabled={disabled || menuRowIndex < 0 || menuRowIndex >= effectiveRows.length - 1}
                            aria-label={`${moveDownLabel}: ${menuRowLabel}`}
                        >
                            {moveDownLabel}
                        </MenuItem>
                    </>
                ) : null}
                {copyRowsEnabled ? (
                    <MenuItem
                        onClick={() => void handleCopyRowFromMenu()}
                        disabled={disabled || (typeof maxRows === 'number' && effectiveRows.length >= maxRows)}
                    >
                        <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.copy', 'Copy')}
                    </MenuItem>
                ) : null}
                <Divider />
                <MenuItem onClick={handleDeleteRowFromMenu} disabled={disabled} sx={{ color: 'error.main' }}>
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
