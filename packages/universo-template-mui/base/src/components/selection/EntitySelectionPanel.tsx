import { useState, useMemo, useCallback } from 'react'
import {
    Box,
    Typography,
    Button,
    IconButton,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Checkbox,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    TextField,
    InputAdornment,
    Switch,
    FormControlLabel,
    FormHelperText,
    Alert
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'

import { CompactListTable } from '../table/CompactListTable'
import type { TableColumn, FlowListTableData } from '../table/FlowListTable'

/**
 * Base entity interface required for EntitySelectionPanel.
 * Entities must have at least an id.
 */
export interface SelectableEntity {
    id: string
}

/**
 * Labels for UI text customization.
 */
export interface EntitySelectionLabels {
    /** Panel title (e.g., "Hubs", "Categories") */
    title: string
    /** Add button text */
    addButton: string
    /** Dialog title for entity picker */
    dialogTitle: string
    /** Empty state message when no entities selected */
    emptyMessage: string
    /** Warning message when required but no entities selected */
    requiredWarningMessage?: string
    /** Message when no entities available to select */
    noAvailableMessage: string
    /** Search placeholder */
    searchPlaceholder: string
    /** Cancel button text */
    cancelButton: string
    /** Confirm add button text (count will be appended) */
    confirmButton: string
    /** Remove button title */
    removeTitle: string
    /** Table header for name column */
    nameHeader: string
    /** Table header for codename column */
    codenameHeader: string
    /** Required toggle label */
    requiredLabel?: string
    /** Required toggle helper text when enabled */
    requiredEnabledHelp?: string
    /** Required toggle helper text when disabled */
    requiredDisabledHelp?: string
    /** Single selection toggle label */
    singleLabel?: string
    /** Single selection helper text when enabled */
    singleEnabledHelp?: string
    /** Single selection helper text when disabled */
    singleDisabledHelp?: string
    /** Warning when cannot enable single mode */
    singleWarning?: string
}

export interface EntitySelectionPanelProps<T extends SelectableEntity> {
    /** List of all available entities */
    availableEntities: T[]
    /** Currently selected entity IDs */
    selectedIds: string[]
    /** Callback when selection changes */
    onSelectionChange: (ids: string[]) => void
    /** Function to get display name from entity */
    getDisplayName: (entity: T) => string
    /** Function to get codename/identifier from entity */
    getCodename: (entity: T) => string
    /** UI labels for customization */
    labels: EntitySelectionLabels
    /** Disable all interactions */
    disabled?: boolean
    /** Error message to display */
    error?: string
    /** Whether entity is required (minimum 1) */
    isRequired?: boolean
    /** Callback when isRequired changes */
    onRequiredChange?: (value: boolean) => void
    /** Whether only single entity is allowed */
    isSingle?: boolean
    /** Callback when isSingle changes */
    onSingleChange?: (value: boolean) => void
    /** Disable only the toggle switches (required/single) while keeping selection active */
    togglesDisabled?: boolean
    /** Optional filter function for search */
    filterEntity?: (entity: T, query: string) => boolean
}

/**
 * Generic panel for managing entity associations.
 * Displays selected entities in a table with add/remove functionality.
 * Optionally includes toggles for "required" and "single entity" modes.
 *
 * @example
 * ```tsx
 * <EntitySelectionPanel
 *   availableEntities={hubs}
 *   selectedIds={selectedHubIds}
 *   onSelectionChange={setSelectedHubIds}
 *   getDisplayName={(hub) => getVLCString(hub.name, locale)}
 *   getCodename={(hub) => hub.codename}
 *   labels={hubSelectionLabels}
 * />
 * ```
 */
export const EntitySelectionPanel = <T extends SelectableEntity>({
    availableEntities,
    selectedIds,
    onSelectionChange,
    getDisplayName,
    getCodename,
    labels,
    disabled = false,
    error,
    isRequired,
    onRequiredChange,
    isSingle,
    onSingleChange,
    togglesDisabled = false,
    filterEntity
}: EntitySelectionPanelProps<T>) => {
    const [pickerOpen, setPickerOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [pendingSelection, setPendingSelection] = useState<string[]>([])

    // Map of entity ID to entity object for quick lookup
    const entitiesMap = useMemo(() => {
        const map = new Map<string, T>()
        availableEntities.forEach((entity) => map.set(entity.id, entity))
        return map
    }, [availableEntities])

    // Selected entities with full info
    const selectedEntities = useMemo(() => {
        return selectedIds.map((id) => entitiesMap.get(id)).filter((entity): entity is T => !!entity)
    }, [selectedIds, entitiesMap])

    // Entities available for selection (not already selected)
    const availableForSelection = useMemo(() => {
        const selectedSet = new Set(selectedIds)
        return availableEntities.filter((entity) => !selectedSet.has(entity.id))
    }, [availableEntities, selectedIds])

    // Default filter by name and codename
    const defaultFilterEntity = useCallback(
        (entity: T, query: string): boolean => {
            const lowerQuery = query.toLowerCase()
            const name = getDisplayName(entity) || ''
            const codename = getCodename(entity) || ''
            return name.toLowerCase().includes(lowerQuery) || codename.toLowerCase().includes(lowerQuery)
        },
        [getDisplayName, getCodename]
    )

    const filterFn = filterEntity || defaultFilterEntity

    // Filtered entities based on search
    const filteredEntities = useMemo(() => {
        if (!searchQuery.trim()) return availableForSelection
        return availableForSelection.filter((entity) => filterFn(entity, searchQuery))
    }, [availableForSelection, searchQuery, filterFn])

    const handleRemoveEntity = useCallback(
        (entityId: string) => {
            onSelectionChange(selectedIds.filter((id) => id !== entityId))
        },
        [onSelectionChange, selectedIds]
    )

    const handleOpenPicker = useCallback(() => {
        setPendingSelection([])
        setSearchQuery('')
        setPickerOpen(true)
    }, [])

    const handleClosePicker = useCallback(() => {
        setPickerOpen(false)
        setPendingSelection([])
        setSearchQuery('')
    }, [])

    const handleTogglePending = useCallback(
        (entityId: string) => {
            setPendingSelection((prev) => {
                if (prev.includes(entityId)) {
                    return prev.filter((id) => id !== entityId)
                }
                // If single mode, only allow one selection
                if (isSingle && selectedIds.length === 0) {
                    return [entityId]
                }
                if (isSingle && prev.length > 0) {
                    return [entityId]
                }
                return [...prev, entityId]
            })
        },
        [isSingle, selectedIds.length]
    )

    const handleConfirmSelection = useCallback(() => {
        onSelectionChange([...selectedIds, ...pendingSelection])
        handleClosePicker()
    }, [onSelectionChange, selectedIds, pendingSelection, handleClosePicker])

    const handleSingleToggle = useCallback(
        (checked: boolean) => {
            if (!onSingleChange) return
            if (checked && selectedIds.length > 1) {
                // Cannot enable single mode with multiple entities selected
                return
            }
            onSingleChange(checked)
        },
        [onSingleChange, selectedIds.length]
    )

    const canAddMore = !isSingle || selectedIds.length === 0
    const showRequiredToggle = onRequiredChange !== undefined && labels.requiredLabel
    const showSingleToggle = onSingleChange !== undefined && labels.singleLabel

    return (
        <Box>
            {/* Header with Add button */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant='subtitle1' fontWeight={500}>
                    {labels.title}
                </Typography>
                <Button
                    size='small'
                    startIcon={<AddIcon />}
                    onClick={handleOpenPicker}
                    disabled={disabled || !canAddMore || availableForSelection.length === 0}
                >
                    {labels.addButton}
                </Button>
            </Box>

            {/* Error display */}
            {error && (
                <Alert severity='error' sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Selected entities table */}
            {selectedEntities.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                    <CompactListTable<T & FlowListTableData>
                        data={selectedEntities as (T & FlowListTableData)[]}
                        columns={[
                            {
                                id: 'name',
                                label: labels.nameHeader,
                                render: (entity) => getDisplayName(entity)
                            },
                            {
                                id: 'codename',
                                label: labels.codenameHeader,
                                render: (entity) => (
                                    <Typography variant='body2' color='text.secondary' fontFamily='monospace'>
                                        {getCodename(entity)}
                                    </Typography>
                                )
                            }
                        ] as TableColumn<T & FlowListTableData>[]}
                        renderRowAction={(entity) => (
                            <IconButton
                                size='small'
                                onClick={() => handleRemoveEntity(entity.id)}
                                disabled={disabled}
                                title={labels.removeTitle}
                            >
                                <DeleteOutlineIcon fontSize='small' />
                            </IconButton>
                        )}
                        maxHeight={200}
                    />
                </Box>
            ) : isRequired && labels.requiredWarningMessage ? (
                <Alert severity='warning' sx={{ mb: 2 }}>
                    {labels.requiredWarningMessage}
                </Alert>
            ) : (
                <Paper variant='outlined' sx={{ p: 3, textAlign: 'center', mb: 2, bgcolor: 'action.hover' }}>
                    <Typography color='text.secondary'>{labels.emptyMessage}</Typography>
                </Paper>
            )}

            {/* Required toggle - controls minimum requirement */}
            {showRequiredToggle && (
                <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch checked={!!isRequired} onChange={(e) => onRequiredChange?.(e.target.checked)} disabled={disabled || togglesDisabled} />
                        }
                        label={labels.requiredLabel}
                    />
                    <FormHelperText sx={{ ml: 2, mt: -0.5 }}>
                        {isRequired ? labels.requiredEnabledHelp : labels.requiredDisabledHelp}
                    </FormHelperText>
                </Box>
            )}

            {/* Single entity toggle */}
            {showSingleToggle && (
                <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={!!isSingle}
                                onChange={(e) => handleSingleToggle(e.target.checked)}
                                disabled={disabled || togglesDisabled || selectedIds.length > 1}
                            />
                        }
                        label={labels.singleLabel}
                    />
                    <FormHelperText sx={{ ml: 2, mt: -0.5 }}>
                        {isSingle ? labels.singleEnabledHelp : labels.singleDisabledHelp}
                    </FormHelperText>
                    {selectedIds.length > 1 && !isSingle && labels.singleWarning && (
                        <FormHelperText sx={{ ml: 2, color: 'warning.main' }}>{labels.singleWarning}</FormHelperText>
                    )}
                </Box>
            )}

            {/* Entity picker dialog */}
            <Dialog open={pickerOpen} onClose={handleClosePicker} maxWidth='xs' fullWidth>
                <DialogTitle>{labels.dialogTitle}</DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {/* Search field */}
                    <Box sx={{ p: 2, pb: 1 }}>
                        <TextField
                            size='small'
                            fullWidth
                            placeholder={labels.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <SearchIcon fontSize='small' />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>

                    {/* Entity list */}
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {filteredEntities.length > 0 ? (
                            filteredEntities.map((entity) => (
                                <ListItem key={entity.id} disablePadding>
                                    <ListItemButton onClick={() => handleTogglePending(entity.id)} dense>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <Checkbox edge='start' checked={pendingSelection.includes(entity.id)} disableRipple />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={getDisplayName(entity)}
                                            secondary={getCodename(entity)}
                                            secondaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))
                        ) : (
                            <ListItem>
                                <ListItemText primary={labels.noAvailableMessage} sx={{ textAlign: 'center', color: 'text.secondary' }} />
                            </ListItem>
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePicker}>{labels.cancelButton}</Button>
                    <Button onClick={handleConfirmSelection} variant='contained' disabled={pendingSelection.length === 0}>
                        {labels.confirmButton} ({pendingSelection.length})
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default EntitySelectionPanel
