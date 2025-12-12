import React, { useState, useCallback } from 'react'
import { Box, TextField, IconButton, Menu, MenuItem, Chip, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { VersionedLocalizedContent, SupportedLocale } from '@universo/types'
import { updateVlcLocale, getVlcLocales, createVlc } from '@universo/utils'

const AVAILABLE_LOCALES: Array<{ code: SupportedLocale; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' }
]

interface LocalizedFieldEditorProps {
    value: VersionedLocalizedContent<string> | null
    onChange: (value: VersionedLocalizedContent<string>) => void
    label?: string
    required?: boolean
    disabled?: boolean
    error?: string
    multiline?: boolean
    rows?: number
}

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

    const activeLocales = value ? getVlcLocales(value) : []
    const availableToAdd = AVAILABLE_LOCALES.filter((l) => !activeLocales.includes(l.code))

    const handleAddLocale = useCallback(
        (locale: SupportedLocale) => {
            setAnchorEl(null)
            const updated = value ? updateVlcLocale(value, locale, '') : createVlc(locale, '')
            onChange(updated)
        },
        [value, onChange]
    )

    const handleContentChange = useCallback(
        (locale: SupportedLocale, content: string) => {
            if (!value) return
            onChange(updateVlcLocale(value, locale, content))
        },
        [value, onChange]
    )

    const handleRemoveLocale = useCallback(
        (locale: SupportedLocale) => {
            if (!value || locale === value._primary) return
            const newLocales = { ...value.locales }
            delete newLocales[locale]
            onChange({ ...value, locales: newLocales })
        },
        [value, onChange]
    )

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
            </Stack>

            <Stack spacing={2}>
                {activeLocales.map((locale) => {
                    const entry = value?.locales[locale]
                    const isPrimary = value?._primary === locale
                    return (
                        <Box key={locale} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Chip label={locale.toUpperCase()} size='small' color={isPrimary ? 'primary' : 'default'} sx={{ mt: 1 }} />
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
