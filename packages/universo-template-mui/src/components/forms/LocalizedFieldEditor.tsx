import React, { useState, useCallback, useMemo } from 'react'
import { Box, TextField, IconButton, Menu, MenuItem, Chip, Stack, Typography, CircularProgress } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useQuery } from '@tanstack/react-query'
import type { VersionedLocalizedContent, LocaleCode } from '@universo/types'
import { updateLocalizedContentLocale, getLocalizedContentLocales, createLocalizedContent } from '@universo/utils'

/**
 * Query key for public content locales
 */
const CONTENT_LOCALES_QUERY_KEY = ['locales', 'content', 'public']

/**
 * Fallback locales when API is unavailable
 */
const FALLBACK_LOCALES = [
    { code: 'en', label: 'English', isDefault: true },
    { code: 'ru', label: 'Русский', isDefault: false }
]

interface ContentLocalesResponse {
    locales: Array<{ code: string; label: string; isDefault: boolean }>
    defaultLocale: string
}

interface LocalizedFieldEditorProps {
    value: VersionedLocalizedContent<string> | null
    onChange: (value: VersionedLocalizedContent<string>) => void
    label?: string
    required?: boolean
    disabled?: boolean
    error?: string | null
    multiline?: boolean
    rows?: number
}

/**
 * Editor component for localized content fields
 *
 * Loads available locales from public API endpoint /api/v1/locales/content
 * Falls back to hardcoded en/ru locales if API is unavailable
 */
export const LocalizedFieldEditor: React.FC<LocalizedFieldEditorProps> = ({
    value,
    onChange,
    label = 'Localized Field',
    required = false,
    disabled = false,
    error,
    multiline = false,
    rows = 1
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    // Fetch available locales from public API
    const {
        data: localesData,
        isLoading: localesLoading,
        isError: localesError
    } = useQuery<ContentLocalesResponse>({
        queryKey: CONTENT_LOCALES_QUERY_KEY,
        queryFn: async () => {
            const response = await fetch('/api/v1/locales/content')
            if (!response.ok) {
                throw new Error('Failed to fetch locales')
            }
            return response.json()
        },
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
        retry: 1 // Only retry once on failure
    })

    // Use API data or fallback
    const availableLocales = useMemo(() => {
        if (localesData?.locales && localesData.locales.length > 0) {
            return localesData.locales
        }
        return FALLBACK_LOCALES
    }, [localesData])

    const activeLocales = value ? getLocalizedContentLocales(value) : []
    const availableToAdd = availableLocales.filter((l) => !activeLocales.includes(l.code))

    const handleAddLocale = useCallback(
        (locale: LocaleCode) => {
            setAnchorEl(null)
            const updated = value ? updateLocalizedContentLocale(value, locale, '') : createLocalizedContent(locale, '')
            onChange(updated)
        },
        [value, onChange]
    )

    const handleContentChange = useCallback(
        (locale: LocaleCode, content: string) => {
            if (!value) return
            onChange(updateLocalizedContentLocale(value, locale, content))
        },
        [value, onChange]
    )

    const handleRemoveLocale = useCallback(
        (locale: LocaleCode) => {
            if (!value || locale === value._primary) return
            const newLocales = { ...value.locales }
            delete newLocales[locale]
            onChange({ ...value, locales: newLocales })
        },
        [value, onChange]
    )

    // Get label for a locale code
    const getLocaleLabel = useCallback(
        (code: string) => {
            return availableLocales.find((l) => l.code === code)?.label || code.toUpperCase()
        },
        [availableLocales]
    )

    // Show loading indicator while fetching locales
    if (localesLoading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant='body2' color='text.secondary'>
                    Loading languages...
                </Typography>
            </Box>
        )
    }

    return (
        <Box>
            <Stack direction='row' alignItems='center' spacing={1} mb={1}>
                <Typography variant='subtitle2'>{label}</Typography>
                {availableToAdd.length > 0 && !disabled && (
                    <>
                        <IconButton size='small' onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <AddIcon fontSize='small' />
                        </IconButton>
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                            {availableToAdd.map((l) => (
                                <MenuItem key={l.code} onClick={() => handleAddLocale(l.code)}>
                                    {l.label}
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}
                {localesError && (
                    <Typography variant='caption' color='warning.main'>
                        (Using fallback languages)
                    </Typography>
                )}
            </Stack>

            <Stack spacing={2}>
                {activeLocales.map((locale) => {
                    const entry = value?.locales[locale]
                    const isPrimary = value?._primary === locale
                    return (
                        <Box key={locale} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Chip label={getLocaleLabel(locale)} size='small' color={isPrimary ? 'primary' : 'default'} sx={{ mt: 1 }} />
                            <TextField
                                fullWidth
                                size='small'
                                value={entry?.content ?? ''}
                                onChange={(e) => handleContentChange(locale, e.target.value)}
                                disabled={disabled}
                                required={isPrimary && required}
                                error={!!error && isPrimary}
                                helperText={isPrimary && error ? error : undefined}
                                multiline={multiline}
                                rows={rows}
                            />
                            {!isPrimary && !disabled && (
                                <IconButton size='small' onClick={() => handleRemoveLocale(locale)}>
                                    <DeleteIcon fontSize='small' />
                                </IconButton>
                            )}
                        </Box>
                    )
                })}
            </Stack>
        </Box>
    )
}
