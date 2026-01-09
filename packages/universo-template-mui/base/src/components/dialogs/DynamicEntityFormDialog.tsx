import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent } from '@universo/utils'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'

export type DynamicFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'REF' | 'JSON'

export interface DynamicFieldConfig {
    id: string
    label: string
    type: DynamicFieldType
    required?: boolean
    localized?: boolean
    placeholder?: string
    helperText?: string
}

export interface DynamicEntityFormDialogProps {
    open: boolean
    title: string
    fields: DynamicFieldConfig[]
    locale: string
    initialData?: Record<string, unknown>
    isSubmitting?: boolean
    error?: string | null
    requireAnyValue?: boolean
    emptyStateText?: string
    saveButtonText?: string
    savingButtonText?: string
    cancelButtonText?: string
    showDeleteButton?: boolean
    deleteButtonText?: string
    deleteButtonDisabled?: boolean
    onDelete?: () => void
    onClose: () => void
    onSubmit: (data: Record<string, unknown>) => Promise<void>
    isValuePresent?: (field: DynamicFieldConfig, value: unknown) => boolean
}

const normalizeLocale = (locale?: string) => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

const ensureLocalizedValue = (value: unknown, locale: string): VersionedLocalizedContent<string> | null => {
    if (value == null) return null
    if (isLocalizedContent(value)) return value
    if (typeof value === 'string') {
        return createLocalizedContent(locale, value)
    }
    return createLocalizedContent(locale, String(value))
}

const hasAnyLocalizedContent = (value: VersionedLocalizedContent<string>) =>
    Object.values(value.locales ?? {}).some((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')

export const DynamicEntityFormDialog: React.FC<DynamicEntityFormDialogProps> = ({
    open,
    title,
    fields,
    locale,
    initialData,
    isSubmitting = false,
    error = null,
    requireAnyValue = false,
    emptyStateText,
    saveButtonText = 'Save',
    savingButtonText,
    cancelButtonText = 'Cancel',
    showDeleteButton = false,
    deleteButtonText = 'Delete',
    deleteButtonDisabled = false,
    onDelete,
    onClose,
    onSubmit,
    isValuePresent
}) => {
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [isReady, setReady] = useState(false)

    useEffect(() => {
        if (open) {
            setReady(false)
            setFormData(initialData ?? {})
            setReady(true)
        } else {
            setReady(false)
        }
    }, [open, initialData])

    const normalizedLocale = useMemo(() => normalizeLocale(locale), [locale])

    const handleFieldChange = useCallback((id: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [id]: value }))
    }, [])

    const resolveValuePresent = useCallback(
        (field: DynamicFieldConfig, value: unknown) => {
            if (isValuePresent) {
                return isValuePresent(field, value)
            }
            if (value === null || value === undefined) return false
            if (field.type === 'STRING') {
                if (field.localized !== false && isLocalizedContent(value)) {
                    return hasAnyLocalizedContent(value)
                }
                if (typeof value === 'string') return value.trim() !== ''
                return String(value).trim() !== ''
            }
            if (field.type === 'NUMBER') {
                return typeof value === 'number' ? !Number.isNaN(value) : value !== ''
            }
            if (field.type === 'BOOLEAN') {
                return value !== undefined
            }
            if (field.type === 'JSON') {
                if (typeof value === 'string') return value.trim() !== ''
                if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
                return true
            }
            if (typeof value === 'string') return value.trim() !== ''
            return true
        },
        [isValuePresent]
    )

    const hasAnyValue = useMemo(
        () => fields.some((field) => resolveValuePresent(field, formData[field.id])),
        [fields, formData, resolveValuePresent]
    )

    const hasMissingRequired = useMemo(
        () => fields.some((field) => field.required && !resolveValuePresent(field, formData[field.id])),
        [fields, formData, resolveValuePresent]
    )

    const buildPayload = useCallback(() => {
        const payload: Record<string, unknown> = {}
        fields.forEach((field) => {
            const value = formData[field.id]
            if (!resolveValuePresent(field, value)) return
            payload[field.id] = value
        })
        return payload
    }, [fields, formData, resolveValuePresent])

    const handleSubmit = async () => {
        if (hasMissingRequired) return
        if (requireAnyValue && !hasAnyValue) return
        await onSubmit(buildPayload())
    }

    const renderField = (field: DynamicFieldConfig) => {
        const value = formData[field.id]
        const disabled = isSubmitting

        switch (field.type) {
            case 'STRING': {
                if (field.localized === false) {
                    return (
                        <TextField
                            fullWidth
                            label={field.label}
                            value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                            onChange={(event) => handleFieldChange(field.id, event.target.value)}
                            required={field.required}
                            disabled={disabled}
                            placeholder={field.placeholder}
                            helperText={field.helperText}
                        />
                    )
                }

                return (
                    <LocalizedInlineField
                        mode='localized'
                        label={field.label}
                        required={field.required}
                        value={ensureLocalizedValue(value, normalizedLocale)}
                        onChange={(next) => handleFieldChange(field.id, next)}
                        uiLocale={locale}
                        disabled={disabled}
                    />
                )
            }
            case 'NUMBER':
                return (
                    <TextField
                        fullWidth
                        type='number'
                        label={field.label}
                        value={typeof value === 'number' ? value : value == null ? '' : Number(value)}
                        onChange={(event) =>
                            handleFieldChange(field.id, event.target.value ? parseFloat(event.target.value) : null)
                        }
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        helperText={field.helperText}
                    />
                )
            case 'BOOLEAN':
                return (
                    <FormControlLabel
                        control={
                            <Checkbox checked={Boolean(value)} onChange={(event) => handleFieldChange(field.id, event.target.checked)} />
                        }
                        label={field.label}
                        disabled={disabled}
                    />
                )
            case 'DATE':
                return (
                    <TextField
                        fullWidth
                        type='date'
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        InputLabelProps={{ shrink: true }}
                        helperText={field.helperText}
                    />
                )
            case 'DATETIME':
                return (
                    <TextField
                        fullWidth
                        type='datetime-local'
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        InputLabelProps={{ shrink: true }}
                        helperText={field.helperText}
                    />
                )
            case 'JSON': {
                const stringValue =
                    typeof value === 'string' ? value : value && typeof value === 'object' ? JSON.stringify(value, null, 2) : ''
                return (
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label={field.label}
                        value={stringValue}
                        onChange={(event) => {
                            try {
                                handleFieldChange(field.id, JSON.parse(event.target.value))
                            } catch {
                                handleFieldChange(field.id, event.target.value)
                            }
                        }}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        helperText={field.helperText}
                    />
                )
            }
            case 'REF':
                return (
                    <TextField
                        fullWidth
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        helperText={field.helperText}
                    />
                )
            default:
                return (
                    <TextField
                        fullWidth
                        label={field.label}
                        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        helperText={field.helperText}
                    />
                )
        }
    }

    const isSubmitDisabled =
        isSubmitting || !isReady || fields.length === 0 || hasMissingRequired || (requireAnyValue && !hasAnyValue)

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ overflowY: 'visible', overflowX: 'visible' }}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity='error'>{error}</Alert>}
                    {!isReady ? (
                        <Stack alignItems='center' justifyContent='center' sx={{ py: 3 }}>
                            <CircularProgress size={20} />
                        </Stack>
                    ) : fields.length === 0 ? (
                        <Typography color='text.secondary'>{emptyStateText}</Typography>
                    ) : (
                        fields.map((field) => <React.Fragment key={field.id}>{renderField(field)}</React.Fragment>)
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 2, justifyContent: showDeleteButton ? 'space-between' : 'flex-end' }}>
                {showDeleteButton ? (
                    <Button
                        onClick={deleteButtonDisabled ? undefined : onDelete}
                        disabled={isSubmitting || deleteButtonDisabled}
                        variant='outlined'
                        color='error'
                        startIcon={<DeleteIcon />}
                        sx={{ borderRadius: 1, mr: 'auto' }}
                    >
                        {deleteButtonText}
                    </Button>
                ) : null}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={onClose} disabled={isSubmitting}>
                        {cancelButtonText}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant='contained'
                        disabled={isSubmitDisabled}
                        startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                    >
                        {isSubmitting ? savingButtonText ?? saveButtonText : saveButtonText}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    )
}

export default DynamicEntityFormDialog
