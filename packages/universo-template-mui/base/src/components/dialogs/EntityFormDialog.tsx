import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    IconButton,
    Box,
    Typography,
    Tabs,
    Tab,
    Tooltip,
    useMediaQuery,
    useTheme
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { mergeDialogPaperProps, mergeDialogSx, useDialogPresentation } from './dialogPresentation'

/**
 * Configuration for a single tab in the EntityFormDialog.
 * When tabs are provided, the dialog renders a tabbed interface instead of flat content.
 */
export interface TabConfig {
    /** Unique identifier for the tab */
    id: string
    /** Label displayed on the tab button */
    label: string
    /** Content to render when this tab is active */
    content: React.ReactNode
}

/**
 * Helper component for rendering tab panel content.
 * Only renders children when the tab is active.
 */
interface TabPanelProps {
    children?: React.ReactNode
    index: number
    value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <Box
            role='tabpanel'
            hidden={value !== index}
            id={`entity-tabpanel-${index}`}
            aria-labelledby={`entity-tab-${index}`}
            sx={{ pt: 2 }}
        >
            {value === index && children}
        </Box>
    )
}

function a11yProps(index: number) {
    return {
        id: `entity-tab-${index}`,
        'aria-controls': `entity-tabpanel-${index}`
    }
}

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isBlankLocalizedScaffold = (value: unknown): boolean => {
    if (!isRecord(value) || !isRecord(value.locales)) {
        return false
    }

    const localeEntries = Object.values(value.locales).filter(isRecord)
    if (localeEntries.length === 0) {
        return false
    }

    return localeEntries.every((entry) => {
        const content = entry.content
        return typeof content !== 'string' || content.trim().length === 0
    })
}

const shouldPreserveAsyncHydration = (fieldName: string, previousValue: unknown, nextValue: unknown): boolean => {
    if (fieldName.startsWith('_')) {
        return true
    }

    return (previousValue === null || previousValue === undefined) && isBlankLocalizedScaffold(nextValue)
}

export interface EntityFormDialogProps {
    open: boolean
    title: string
    /** Mode of the dialog: 'create' for new entities, 'edit' for existing ones, 'copy' for duplication (default: 'create') */
    mode?: 'create' | 'edit' | 'copy'
    saveButtonText?: string
    /** Text shown on save button while loading (e.g., "Saving...") */
    savingButtonText?: string
    cancelButtonText?: string
    /** Text for the delete button (only shown in 'edit' mode when showDeleteButton is true) */
    deleteButtonText?: string
    nameLabel: string
    descriptionLabel: string
    namePlaceholder?: string
    descriptionPlaceholder?: string
    initialName?: string
    initialDescription?: string
    loading?: boolean
    error?: string
    onClose: () => void
    onSave: (data: { name: string; description?: string } & Record<string, any>) => Promise<void> | void
    /** Optional callback called after successful save (before auto-close). */
    onSuccess?: () => void
    /** If true (default), the dialog will auto-close after a successful save. Set to false to keep it open. */
    autoCloseOnSuccess?: boolean
    /** Show delete button in edit mode (default: false) */
    showDeleteButton?: boolean
    /** Disable delete button (shows button but in disabled state) */
    deleteButtonDisabled?: boolean
    /** Reason why the delete button is disabled (shown as tooltip) */
    deleteButtonDisabledReason?: string
    /** Callback when delete button is clicked (only in edit mode) */
    onDelete?: () => void | Promise<void>
    /** Hide default name/description fields (useful for custom field rendering). */
    hideDefaultFields?: boolean
    /** Custom save gating based on current values. */
    canSave?: (values: { name: string; description: string } & Record<string, any>) => boolean
    extraFields?: (helpers: {
        values: Record<string, any>
        setValue: (name: string, value: any) => void
        isLoading: boolean
        errors: Record<string, string>
    }) => React.ReactNode
    initialExtraValues?: Record<string, any>
    validate?: (values: { name: string; description: string } & Record<string, any>) => Record<string, string> | null
    /**
     * Optional function that returns tab configurations for tabbed dialog layout.
     * When provided, the dialog renders a tabbed interface instead of flat content.
     * The function receives the same helpers as extraFields for building dynamic tab content.
     * Note: When using tabs, consider using hideDefaultFields=true and rendering
     * name/description fields within the first tab for better UX.
     */
    tabs?: (helpers: {
        values: Record<string, any>
        setValue: (name: string, value: any) => void
        isLoading: boolean
        errors: Record<string, string>
    }) => TabConfig[]
    /** Initial active tab index (default: 0) */
    initialTabIndex?: number
}

export const EntityFormDialog: React.FC<EntityFormDialogProps> = ({
    open,
    title,
    mode = 'create',
    saveButtonText = 'Save',
    savingButtonText,
    cancelButtonText = 'Cancel',
    deleteButtonText = 'Delete',
    nameLabel,
    descriptionLabel,
    namePlaceholder,
    descriptionPlaceholder,
    initialName = '',
    initialDescription = '',
    loading = false,
    error,
    onClose,
    onSave,
    onSuccess,
    autoCloseOnSuccess = true,
    showDeleteButton = false,
    deleteButtonDisabled = false,
    deleteButtonDisabledReason,
    onDelete,
    hideDefaultFields = false,
    canSave,
    extraFields,
    initialExtraValues,
    validate,
    tabs,
    initialTabIndex = 0
}) => {
    const normalizedInitialExtraValues = useMemo(() => initialExtraValues || {}, [initialExtraValues])
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const [name, setName] = useState(initialName)
    const [description, setDescription] = useState(initialDescription)
    const [extraValues, setExtraValues] = useState<Record<string, any>>(normalizedInitialExtraValues)
    const [hasTouchedExtraValues, setHasTouchedExtraValues] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState(initialTabIndex)
    const nameInputRef = useRef<HTMLInputElement>(null)
    const extraValuesRef = useRef<Record<string, any>>(normalizedInitialExtraValues)
    const wasOpenRef = useRef(false)
    const isFreshOpen = open && !wasOpenRef.current
    const renderedName = isFreshOpen ? initialName : name
    const renderedDescription = isFreshOpen ? initialDescription : description
    const renderedExtraValues = isFreshOpen ? normalizedInitialExtraValues : extraValues

    extraValuesRef.current = renderedExtraValues

    useEffect(() => {
        extraValuesRef.current = extraValues
    }, [extraValues])

    // Only reset form when dialog opens, not when initialExtraValues change
    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setName(initialName)
            setDescription(initialDescription)
            setExtraValues(normalizedInitialExtraValues)
            setHasTouchedExtraValues(false)
            setFieldErrors({})
            setActiveTab(initialTabIndex)
        }
        wasOpenRef.current = open
    }, [open, initialName, initialDescription, initialTabIndex, normalizedInitialExtraValues])

    useEffect(() => {
        if (open && !hideDefaultFields) {
            nameInputRef.current?.focus()
        }
    }, [open, hideDefaultFields])

    // Keep async-loaded dialog state in sync until the user starts editing extra fields.
    useEffect(() => {
        if (open && !hasTouchedExtraValues) {
            setExtraValues(normalizedInitialExtraValues)
        }
    }, [open, normalizedInitialExtraValues, hasTouchedExtraValues])

    const handleExtraValueChange = useCallback((fieldName: string, value: any) => {
        const previousValue = extraValuesRef.current[fieldName]
        if (!shouldPreserveAsyncHydration(fieldName, previousValue, value)) {
            setHasTouchedExtraValues(true)
        }
        setExtraValues((prev) => ({ ...prev, [fieldName]: value }))
    }, [])

    const handleSave = async () => {
        const trimmedName = renderedName.trim()
        const trimmedDescription = renderedDescription.trim()

        if (!hideDefaultFields && !trimmedName) {
            setFieldErrors({ name: 'Name is required' })
            return
        }

        if (validate) {
            const errors = validate({ name: trimmedName, description: trimmedDescription, ...renderedExtraValues })
            if (errors) {
                setFieldErrors(errors)
                return
            }
        }

        if (canSave && !canSave({ name: trimmedName, description: trimmedDescription, ...renderedExtraValues })) {
            return
        }

        setFieldErrors({})
        setIsSubmitting(true)
        try {
            await onSave({ name: trimmedName, description: trimmedDescription || undefined, ...renderedExtraValues })
            // Call optional success callback and close dialog if enabled
            try {
                onSuccess && onSuccess()
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('EntityFormDialog onSuccess handler error:', e)
            }
            if (autoCloseOnSuccess) {
                onClose()
            }
        } catch (e) {
            const cancelled =
                e && typeof e === 'object' && '__dialogCancelled' in e && (e as { __dialogCancelled?: unknown }).__dialogCancelled === true
            if (cancelled) {
                return
            }
            // error is shown via `error` prop from parent
            // eslint-disable-next-line no-console
            console.error('EntityFormDialog save error:', e)
        } finally {
            setIsSubmitting(false)
        }
    }

    const isLoading = loading || isSubmitting
    const isSubmitDisabled = canSave
        ? !canSave({ name: renderedName.trim(), description: renderedDescription.trim(), ...renderedExtraValues })
        : !hideDefaultFields && !renderedName.trim()

    const handleClose = () => {
        if (!isLoading) onClose()
    }

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue)
    }

    const presentation = useDialogPresentation({ open, onClose: handleClose, fallbackMaxWidth: 'sm', isBusy: isLoading })
    const titleNode = presentation.titleActions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box component='span' sx={{ minWidth: 0 }}>
                {title}
            </Box>
            {presentation.titleActions}
        </Box>
    ) : (
        title
    )

    // Build helpers object for extraFields and tabs
    const formHelpers = {
        values: renderedExtraValues,
        setValue: handleExtraValueChange,
        isLoading,
        errors: fieldErrors
    }

    // Render content based on whether tabs are provided
    const renderContent = () => {
        // Tabbed layout - call tabs function with helpers
        if (tabs) {
            const tabConfigs = tabs(formHelpers)
            if (tabConfigs.length > 0) {
                return (
                    <>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: -3, px: 3 }}>
                            <Tabs value={activeTab} onChange={handleTabChange} aria-label='entity form tabs'>
                                {tabConfigs.map((tab, index) => (
                                    <Tab key={tab.id} label={tab.label} {...a11yProps(index)} />
                                ))}
                            </Tabs>
                        </Box>
                        {tabConfigs.map((tab, index) => (
                            <TabPanel key={tab.id} value={activeTab} index={index}>
                                {tab.content}
                            </TabPanel>
                        ))}
                        {error && (
                            <Typography color='error' variant='body2' sx={{ mt: 2 }}>
                                {error}
                            </Typography>
                        )}
                    </>
                )
            }
        }

        // Default flat layout (backward compatible)
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                {!hideDefaultFields && (
                    <>
                        <TextField
                            label={nameLabel}
                            placeholder={namePlaceholder}
                            value={renderedName}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                            disabled={isLoading}
                            inputRef={nameInputRef}
                            variant='outlined'
                            error={!!fieldErrors.name}
                            helperText={fieldErrors.name}
                            InputProps={{ sx: { borderRadius: 1 } }}
                        />
                        <TextField
                            label={descriptionLabel}
                            placeholder={descriptionPlaceholder}
                            value={renderedDescription}
                            onChange={(e) => setDescription(e.target.value)}
                            fullWidth
                            disabled={isLoading}
                            variant='outlined'
                            InputProps={{ sx: { borderRadius: 1 } }}
                        />
                    </>
                )}
                {extraFields && extraFields(formHelpers)}
                {error && (
                    <Typography color='error' variant='body2'>
                        {error}
                    </Typography>
                )}
            </Box>
        )
    }

    return (
        <Dialog
            open={open}
            onClose={presentation.dialogProps.onClose}
            maxWidth={presentation.dialogProps.maxWidth ?? 'sm'}
            fullWidth={presentation.dialogProps.fullWidth ?? true}
            disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
            PaperProps={mergeDialogPaperProps({ sx: { borderRadius: 1 } }, presentation.dialogProps.PaperProps)}
        >
            <DialogTitle>{titleNode}</DialogTitle>
            <DialogContent sx={mergeDialogSx({ overflowY: 'visible' }, presentation.contentSx)}>{renderContent()}</DialogContent>
            <DialogActions sx={{ p: 3, pt: 2, justifyContent: 'space-between' }}>
                {/* Delete button - shown in edit/copy mode when showDeleteButton is true */}
                {(mode === 'edit' || mode === 'copy') && showDeleteButton ? (
                    <Tooltip
                        title={
                            deleteButtonDisabled && deleteButtonDisabledReason
                                ? deleteButtonDisabledReason
                                : isMobile
                                ? deleteButtonText || ''
                                : ''
                        }
                        arrow
                    >
                        <span>
                            {isMobile ? (
                                <IconButton
                                    onClick={deleteButtonDisabled ? undefined : onDelete}
                                    disabled={isLoading || deleteButtonDisabled}
                                    color='error'
                                    aria-label={deleteButtonText}
                                    data-testid='entity-form-delete'
                                    title={deleteButtonText}
                                    sx={{ mr: 'auto' }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            ) : (
                                <Button
                                    onClick={deleteButtonDisabled ? undefined : onDelete}
                                    disabled={isLoading || deleteButtonDisabled}
                                    variant='outlined'
                                    color='error'
                                    startIcon={<DeleteIcon />}
                                    data-testid='entity-form-delete'
                                    sx={{ borderRadius: 1, mr: 'auto' }}
                                >
                                    {deleteButtonText}
                                </Button>
                            )}
                        </span>
                    </Tooltip>
                ) : (
                    <Box /> // Empty box to maintain layout when no delete button
                )}

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={handleClose} disabled={isLoading} data-testid='entity-form-cancel' sx={{ borderRadius: 1 }}>
                        {cancelButtonText}
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant='contained'
                        data-testid='entity-form-submit'
                        disabled={isLoading || isSubmitDisabled}
                        sx={{
                            borderRadius: 1,
                            minWidth: '100px', // Ensure button doesn't shrink too much
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isLoading ? savingButtonText || saveButtonText || 'Saving...' : saveButtonText}
                    </Button>
                </Box>
            </DialogActions>
            {presentation.resizeHandle}
        </Dialog>
    )
}

export default EntityFormDialog
