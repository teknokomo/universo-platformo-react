import { useState, useEffect, useCallback } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Switch,
    Stack,
    Alert,
    CircularProgress
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { createLocalizedContent } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'

import { LocalizedFieldEditor } from '@universo/template-mui'

import * as localesApi from '../api/localesApi'
import type { LocaleItem, CreateLocalePayload, UpdateLocalePayload } from '../api/localesApi'

interface LocaleDialogProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    locale: LocaleItem | null // null = create mode, LocaleItem = edit mode
}

/**
 * Dialog for creating/editing locales
 */
const LocaleDialog = ({ open, onClose, onSuccess, locale }: LocaleDialogProps) => {
    const { t } = useTranslation('admin')
    const { enqueueSnackbar } = useSnackbar()
    const isEditMode = Boolean(locale)

    // Form state
    const [code, setCode] = useState('')
    const [name, setName] = useState<VersionedLocalizedContent<string> | null>(null)
    const [nativeName, setNativeName] = useState('')
    const [isEnabledContent, setIsEnabledContent] = useState(true)
    const [isEnabledUi, setIsEnabledUi] = useState(false)
    const [sortOrder, setSortOrder] = useState(0)
    const [error, setError] = useState<string | null>(null)

    // Reset form when dialog opens/closes or locale changes
    useEffect(() => {
        if (open) {
            if (locale) {
                // Edit mode - populate from locale
                setCode(locale.code)
                setName(locale.name)
                setNativeName(locale.nativeName || '')
                setIsEnabledContent(locale.isEnabledContent)
                setIsEnabledUi(locale.isEnabledUi)
                setSortOrder(locale.sortOrder)
            } else {
                // Create mode - reset to defaults
                setCode('')
                setName(null)
                setNativeName('')
                setIsEnabledContent(true)
                setIsEnabledUi(false)
                setSortOrder(0)
            }
            setError(null)
        }
    }, [open, locale])

    // Create mutation
    const createMutation = useMutation({
        mutationFn: localesApi.createLocale,
        onSuccess: () => {
            enqueueSnackbar(t('locales.createSuccess', 'Locale created successfully'), { variant: 'success' })
            onSuccess()
        },
        onError: (err: Error) => {
            setError(err.message || t('locales.createError', 'Failed to create locale'))
        }
    })

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateLocalePayload }) => localesApi.updateLocale(id, data),
        onSuccess: () => {
            enqueueSnackbar(t('locales.updateSuccess', 'Locale updated successfully'), { variant: 'success' })
            onSuccess()
        },
        onError: (err: Error) => {
            setError(err.message || t('locales.updateError', 'Failed to update locale'))
        }
    })

    const isLoading = createMutation.isPending || updateMutation.isPending

    // Validate locale code format
    const validateCode = (value: string): boolean => {
        return /^[a-z]{2}(-[A-Z]{2})?$/.test(value)
    }

    // Handle name change from LocalizedFieldEditor
    const handleNameChange = useCallback((value: VersionedLocalizedContent<string>) => {
        setName(value)
    }, [])

    // Handle form submit
    const handleSubmit = useCallback(() => {
        setError(null)

        // Validation
        if (!isEditMode && !code) {
            setError(t('locales.validation.codeRequired', 'Locale code is required'))
            return
        }

        if (!isEditMode && !validateCode(code)) {
            setError(t('locales.validation.codeInvalid', 'Invalid locale code format (e.g., en, ru, en-US)'))
            return
        }

        // nativeName is required, name is optional
        if (!nativeName.trim()) {
            setError(t('locales.validation.nativeNameRequired', 'Native name is required'))
            return
        }

        if (isEditMode && locale) {
            // Update existing locale
            const updateData: UpdateLocalePayload = {
                name: name || undefined,
                nativeName: nativeName || null,
                isEnabledContent,
                isEnabledUi,
                sortOrder
            }
            updateMutation.mutate({ id: locale.id, data: updateData })
        } else {
            // Create new locale - if name not set, create with nativeName
            const effectiveName = name || createLocalizedContent('en', nativeName)
            const createData: CreateLocalePayload = {
                code,
                name: effectiveName,
                nativeName: nativeName || undefined,
                isEnabledContent,
                isEnabledUi,
                sortOrder
            }
            createMutation.mutate(createData)
        }
    }, [isEditMode, locale, code, name, nativeName, isEnabledContent, isEnabledUi, sortOrder, createMutation, updateMutation, t])

    // Initialize name VLC if empty
    const handleInitializeName = useCallback(() => {
        if (!name) {
            setName(createLocalizedContent('en', ''))
        }
    }, [name])

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{isEditMode ? t('locales.editTitle', 'Edit Locale') : t('locales.createTitle', 'Add Locale')}</DialogTitle>

            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {error && (
                        <Alert severity='error' onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {/* Locale Code (only for create mode) */}
                    {!isEditMode && (
                        <TextField
                            label={t('locales.code', 'Code')}
                            value={code}
                            onChange={(e) => setCode(e.target.value.toLowerCase())}
                            placeholder='en'
                            helperText={t('locales.codeHelp', 'ISO 639-1 code (e.g., en, ru, de, fr)')}
                            required
                            fullWidth
                            disabled={isLoading}
                            error={Boolean(code && !validateCode(code))}
                        />
                    )}

                    {/* Display code in edit mode */}
                    {isEditMode && (
                        <TextField
                            label={t('locales.code', 'Code')}
                            value={code}
                            disabled
                            fullWidth
                            helperText={t('locales.codeReadonly', 'Locale code cannot be changed')}
                        />
                    )}

                    {/* Native Name (required, shown first) */}
                    <TextField
                        label={t('locales.nativeName', 'Native Name')}
                        value={nativeName}
                        onChange={(e) => setNativeName(e.target.value)}
                        placeholder='English'
                        helperText={t('locales.nativeNameHelp', 'Name in the language itself (e.g., "Русский" for Russian)')}
                        fullWidth
                        required
                        disabled={isLoading}
                    />

                    {/* Localized Name (optional) */}
                    <LocalizedFieldEditor
                        value={name}
                        onChange={handleNameChange}
                        label={t('locales.name', 'Name')}
                        required={false}
                        disabled={isLoading}
                        error={null}
                    />

                    {/* Initialize button if name is empty */}
                    {!name && (
                        <Button variant='outlined' size='small' onClick={handleInitializeName}>
                            {t('locales.initializeName', 'Initialize Name')}
                        </Button>
                    )}

                    {/* Sort Order */}
                    <TextField
                        label={t('locales.sortOrder', 'Sort Order')}
                        type='number'
                        value={sortOrder}
                        onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                        helperText={t('locales.sortOrderHelp', 'Display order in locale lists (lower = first)')}
                        fullWidth
                        disabled={isLoading}
                        inputProps={{ min: 0 }}
                    />

                    {/* Enabled for Content */}
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isEnabledContent}
                                onChange={(e) => setIsEnabledContent(e.target.checked)}
                                disabled={isLoading}
                            />
                        }
                        label={t('locales.enabledContent', 'Enabled for Content')}
                    />

                    {/* Enabled for UI (informational) */}
                    <FormControlLabel
                        control={<Switch checked={isEnabledUi} onChange={(e) => setIsEnabledUi(e.target.checked)} disabled={isLoading} />}
                        label={t('locales.enabledUi', 'Enabled for UI')}
                    />
                    <Alert severity='info' sx={{ mt: -2 }}>
                        {t('locales.uiNote', 'UI translations require JSON files in the codebase. This setting is informational only.')}
                    </Alert>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={isLoading}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    disabled={isLoading}
                    startIcon={isLoading && <CircularProgress size={16} />}
                >
                    {isEditMode ? t('common.save', 'Save') : t('common.create', 'Create')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default LocaleDialog
