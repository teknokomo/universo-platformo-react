import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Box, ButtonBase, CircularProgress, Divider, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { styled, useTheme } from '@mui/material/styles'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import type { LocaleCode, VersionedLocalizedContent } from '@universo/types'
import { useQuery } from '@tanstack/react-query'
import { createLocalizedContent, getLocalizedContentLocales, updateLocalizedContentLocale } from '@universo/utils'
import { useCommonTranslations } from '@universo/i18n'

const CONTENT_LOCALES_QUERY_KEY = ['locales', 'content', 'public']

const FALLBACK_LOCALES = [
    { code: 'en', label: 'English', isDefault: true },
    { code: 'ru', label: 'Русский', isDefault: false }
]

type LocaleOption = { code: string; label: string; isDefault: boolean }

const PrimaryBadge = styled(Badge)(({ theme }) => ({
    '& .MuiBadge-badge': {
        minWidth: 16,
        height: 16,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${theme.palette.background.paper}`,
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
        color: theme.palette.text.primary
    }
}))

const LocaleButton = styled(ButtonBase)(({ theme }) => ({
    minWidth: 36,
    height: 24,
    padding: theme.spacing(0, 1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
}))

type BaseProps = {
    label: string
    required?: boolean
    disabled?: boolean
    error?: string | null
    /** Locale code that has the error (for VLC fields, shows error under specific locale) */
    errorLocale?: string | null
    helperText?: string
    multiline?: boolean
    rows?: number
    size?: 'small' | 'medium'
    /** Maximum string length (blocks input beyond limit) */
    maxLength?: number | null
    /** Minimum string length (for validation display) */
    minLength?: number | null
}

type SimpleFieldProps = BaseProps & {
    mode?: 'simple'
    value: string
    onChange: (value: string) => void
}

type VersionedFieldProps = BaseProps & {
    /** Versioned-only mode: single locale, no language switching */
    mode: 'versioned'
    value: VersionedLocalizedContent<string> | null
    onChange: (value: VersionedLocalizedContent<string>) => void
    uiLocale?: string
    autoInitialize?: boolean
}

type LocalizedFieldProps = BaseProps & {
    /** Localized mode: multiple locales with language switching */
    mode: 'localized'
    value: VersionedLocalizedContent<string> | null
    onChange: (value: VersionedLocalizedContent<string>) => void
    uiLocale?: string
    autoInitialize?: boolean
    localesEndpoint?: string
}

export type LocalizedInlineFieldProps = SimpleFieldProps | VersionedFieldProps | LocalizedFieldProps

const normalizeLocale = (locale?: string) => (locale ? String(locale).split(/[-_]/)[0].toLowerCase() : 'en')

const pickInitialLocale = (uiLocale: string, available: LocaleOption[], defaultLocale?: string) => {
    const codes = new Set(available.map((l) => l.code))
    if (codes.has(uiLocale)) return uiLocale
    if (defaultLocale && codes.has(defaultLocale)) return defaultLocale
    return available[0]?.code || 'en'
}

const resolveInlineMetrics = (size?: 'small' | 'medium') => {
    const isSmall = size === 'small'
    const buttonHeight = isSmall ? 22 : 24
    const buttonMinWidth = isSmall ? 32 : 36
    const offset = isSmall ? -4 : -6
    return { buttonHeight, buttonMinWidth, offset }
}

/** Simple non-localized field variant (no hooks needed) */
const SimpleInlineField: React.FC<SimpleFieldProps> = ({
    value,
    onChange,
    label,
    required,
    disabled,
    error,
    helperText,
    multiline,
    rows,
    size,
    maxLength,
    minLength
}) => {
    // Block input beyond maxLength
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value
        if (maxLength != null && newValue.length > maxLength) {
            return // Block input
        }
        onChange(newValue)
    }

    // Build constraint helper text
    const constraintText = useMemo(() => {
        if (minLength != null && maxLength != null) {
            return `${minLength}-${maxLength}`
        }
        if (maxLength != null) {
            return `max: ${maxLength}`
        }
        if (minLength != null) {
            return `min: ${minLength}`
        }
        return null
    }, [minLength, maxLength])

    const finalHelperText = error || helperText || constraintText

    return (
        <TextField
            fullWidth
            label={label}
            required={required}
            disabled={disabled}
            error={Boolean(error)}
            helperText={finalHelperText}
            value={value}
            onChange={handleChange}
            multiline={multiline}
            rows={rows}
            size={size}
            inputProps={{
                maxLength: maxLength ?? undefined
            }}
        />
    )
}

/** Versioned-only field: single locale with version tracking, no language switching */
const VersionedInlineField: React.FC<VersionedFieldProps> = ({
    value,
    onChange,
    label,
    required,
    disabled,
    error,
    helperText,
    multiline,
    rows,
    size,
    uiLocale,
    autoInitialize = true,
    maxLength,
    minLength
}) => {
    const normalizedUiLocale = normalizeLocale(uiLocale)

    // Auto-initialize if needed
    useEffect(() => {
        if (!autoInitialize || value) return
        onChange(createLocalizedContent(normalizedUiLocale, ''))
    }, [autoInitialize, value, normalizedUiLocale, onChange])

    // Get content from primary locale
    const primaryLocale = value?._primary ?? normalizedUiLocale
    const content = value?.locales?.[primaryLocale]?.content ?? ''

    // Block input beyond maxLength
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value
        if (maxLength != null && newValue.length > maxLength) {
            return // Block input
        }
        if (!value) {
            onChange(createLocalizedContent(primaryLocale, newValue))
        } else {
            onChange(updateLocalizedContentLocale(value, primaryLocale, newValue))
        }
    }

    // Build constraint helper text
    const constraintText = useMemo(() => {
        if (minLength != null && maxLength != null) {
            return `${minLength}-${maxLength}`
        }
        if (maxLength != null) {
            return `max: ${maxLength}`
        }
        if (minLength != null) {
            return `min: ${minLength}`
        }
        return null
    }, [minLength, maxLength])

    const finalHelperText = error || helperText || constraintText

    return (
        <TextField
            fullWidth
            label={label}
            required={required}
            disabled={disabled}
            error={Boolean(error)}
            helperText={finalHelperText}
            value={content}
            onChange={handleChange}
            multiline={multiline}
            rows={rows}
            size={size}
            inputProps={{
                maxLength: maxLength ?? undefined
            }}
        />
    )
}

/** Localized field variant with full hook logic */
const LocalizedInlineFieldContent: React.FC<LocalizedFieldProps> = ({
    value,
    onChange,
    label,
    required,
    disabled,
    error,
    errorLocale,
    helperText,
    multiline,
    rows,
    size,
    uiLocale,
    autoInitialize = true,
    localesEndpoint = '/api/v1/locales/content',
    maxLength,
    minLength
}) => {
    const { t } = useCommonTranslations('localizedField')
    const theme = useTheme()

    const {
        data: localesData,
        isLoading: localesLoading,
        isError: localesError
    } = useQuery<{ locales: LocaleOption[]; defaultLocale?: string }>({
        queryKey: [...CONTENT_LOCALES_QUERY_KEY, localesEndpoint],
        queryFn: async () => {
            const response = await fetch(localesEndpoint)
            if (!response.ok) {
                throw new Error('Failed to fetch locales')
            }
            return response.json()
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1
    })

    const availableLocales = useMemo(() => {
        if (localesData?.locales && localesData.locales.length > 0) return localesData.locales
        return FALLBACK_LOCALES
    }, [localesData])

    const defaultLocale = localesData?.defaultLocale
    const normalizedUiLocale = normalizeLocale(uiLocale)

    useEffect(() => {
        // Note: onChange should be memoized at the call site to avoid re-init loops.
        if (!autoInitialize || value) return
        if (!availableLocales.length) return
        const initialLocale = pickInitialLocale(normalizedUiLocale, availableLocales, defaultLocale)
        onChange(createLocalizedContent(initialLocale, ''))
    }, [autoInitialize, value, availableLocales, normalizedUiLocale, defaultLocale, onChange])

    const activeLocales = useMemo(() => (value ? getLocalizedContentLocales(value) : []), [value])
    const availableToAdd = useMemo(
        () => availableLocales.filter((locale) => !activeLocales.includes(locale.code)),
        [availableLocales, activeLocales]
    )

    const orderedLocales = useMemo(() => {
        if (!value) return []
        const primary = value._primary
        const orderIndex = new Map(availableLocales.map((l, index) => [l.code, index]))
        return [...activeLocales].sort((a, b) => {
            if (a === primary) return -1
            if (b === primary) return 1
            const aIndex = orderIndex.get(a) ?? Number.MAX_SAFE_INTEGER
            const bIndex = orderIndex.get(b) ?? Number.MAX_SAFE_INTEGER
            return aIndex - bIndex
        })
    }, [activeLocales, availableLocales, value])

    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
    const [menuLocale, setMenuLocale] = useState<LocaleCode | null>(null)
    const [menuMode, setMenuMode] = useState<'main' | 'add' | 'change'>('main')
    const [focusedLocale, setFocusedLocale] = useState<LocaleCode | null>(null)

    const closeMenu = useCallback(() => {
        setMenuAnchor(null)
        setMenuLocale(null)
        setMenuMode('main')
    }, [])

    const openMenu = useCallback((event: React.MouseEvent<HTMLElement>, locale: LocaleCode) => {
        setMenuAnchor(event.currentTarget)
        setMenuLocale(locale)
        setMenuMode('main')
    }, [])

    const handleAddLocale = useCallback(
        (locale: LocaleCode) => {
            closeMenu()
            if (!value) {
                onChange(createLocalizedContent(locale, ''))
                return
            }
            onChange(updateLocalizedContentLocale(value, locale, ''))
        },
        [closeMenu, onChange, value]
    )

    const handleChangeLocale = useCallback(
        (locale: LocaleCode) => {
            if (!value || !menuLocale) return
            closeMenu()
            const content = value.locales[menuLocale]?.content ?? ''
            const updated = updateLocalizedContentLocale(value, locale, content)
            const locales = { ...updated.locales }
            delete locales[menuLocale]
            const nextPrimary = menuLocale === updated._primary ? locale : updated._primary
            onChange({ ...updated, _primary: nextPrimary, locales })
        },
        [closeMenu, menuLocale, onChange, value]
    )

    const handleMakePrimary = useCallback(() => {
        if (!value || !menuLocale) return
        closeMenu()
        onChange({ ...value, _primary: menuLocale })
    }, [closeMenu, menuLocale, onChange, value])

    const handleRemoveLocale = useCallback(() => {
        if (!value || !menuLocale) return
        if (activeLocales.length <= 1) return
        closeMenu()
        const locales = { ...value.locales }
        delete locales[menuLocale]
        const remainingLocales = Object.keys(locales)
        const nextPrimary = menuLocale === value._primary ? remainingLocales[0] || value._primary : value._primary
        onChange({ ...value, _primary: nextPrimary, locales })
    }, [activeLocales.length, closeMenu, menuLocale, onChange, value])

    const menuLocalesAvailable = availableToAdd
    const canChangeLocale = menuLocalesAvailable.length > 0
    const canAddLocale = menuLocalesAvailable.length > 0
    const canRemoveLocale = activeLocales.length > 1
    const isPrimaryLocale = menuLocale && value?._primary === menuLocale

    // Build constraint helper text - MUST be before conditional returns
    const constraintText = useMemo(() => {
        if (minLength != null && maxLength != null) {
            return `${minLength}-${maxLength}`
        }
        if (maxLength != null) {
            return `max: ${maxLength}`
        }
        if (minLength != null) {
            return `min: ${minLength}`
        }
        return null
    }, [minLength, maxLength])

    // Handler that blocks input beyond maxLength - MUST be before conditional returns
    const handleLocaleChange = useCallback(
        (locale: string, newValue: string) => {
            if (maxLength != null && newValue.length > maxLength) {
                return // Block input
            }
            if (!value) return
            onChange(updateLocalizedContentLocale(value, locale, newValue))
        },
        [maxLength, value, onChange]
    )

    if (localesLoading && !value) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant='body2' color='text.secondary'>
                    {t('loading', 'Loading languages...')}
                </Typography>
            </Box>
        )
    }

    if (!value) {
        return (
            <TextField
                fullWidth
                label={label}
                required={required}
                disabled={disabled}
                error={Boolean(error)}
                helperText={error || helperText}
                multiline={multiline}
                rows={rows}
                size={size}
                value=''
                InputLabelProps={{ shrink: false }}
            />
        )
    }

    return (
        <Stack spacing={1.5}>
            {orderedLocales.map((locale, index) => {
                const entry = value.locales[locale]
                const isPrimary = value._primary === locale
                const buttonLabel = locale.toUpperCase()
                const metrics = resolveInlineMetrics(size)
                const connectorOffset = Math.abs(metrics.offset)
                const showConnector = orderedLocales.length > 1 && connectorOffset > 0
                const isFirst = index === 0
                const isLast = index === orderedLocales.length - 1
                const connectorGap = theme.spacing(0.75)

                const languageButton = (
                    <LocaleButton
                        onClick={(event) => openMenu(event, locale)}
                        disabled={disabled}
                        sx={{
                            height: metrics.buttonHeight,
                            minWidth: metrics.buttonMinWidth
                        }}
                    >
                        {buttonLabel}
                    </LocaleButton>
                )

                const isFocused = focusedLocale === locale
                const shouldShrink = Boolean(entry?.content?.trim()) || isFocused

                // Check minLength validation for this specific locale
                const localeContent = entry?.content ?? ''
                const hasMinLengthError = minLength != null && localeContent.length > 0 && localeContent.length < minLength

                // Determine if error should show under THIS locale:
                // - If errorLocale is specified, show error only on that locale
                // - If errorLocale is not specified (null/undefined), show error on primary (backward compat)
                // - Also show minLength error independently for visual feedback
                const isErrorLocale = errorLocale ? locale.toLowerCase() === errorLocale.toLowerCase() : isPrimary
                const showError = (isErrorLocale && error) || hasMinLengthError
                const fieldHelperText =
                    isErrorLocale && error ? error : hasMinLengthError ? `min: ${minLength}` : helperText || constraintText

                return (
                    <Box key={locale} sx={{ position: 'relative', overflow: 'visible' }}>
                        {showConnector && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: -connectorOffset,
                                    top: isFirst ? '50%' : `calc(0px - ${connectorGap})`,
                                    bottom: isLast ? '50%' : `calc(0px - ${connectorGap})`,
                                    width: connectorOffset,
                                    borderLeft: `1px solid ${theme.palette.divider}`,
                                    borderTopLeftRadius: isFirst ? theme.shape.borderRadius : 0,
                                    borderBottomLeftRadius: isLast ? theme.shape.borderRadius : 0,
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                        <TextField
                            fullWidth
                            label={label}
                            required={isPrimary && required}
                            disabled={disabled}
                            error={Boolean(showError)}
                            helperText={fieldHelperText}
                            multiline={multiline}
                            rows={rows}
                            size={size}
                            value={entry?.content ?? ''}
                            InputLabelProps={{ shrink: shouldShrink }}
                            onChange={(event) => handleLocaleChange(locale, event.target.value)}
                            onFocus={() => setFocusedLocale(locale)}
                            onBlur={() => setFocusedLocale((prev) => (prev === locale ? null : prev))}
                            inputProps={{
                                maxLength: maxLength ?? undefined
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                top: metrics.offset,
                                right: metrics.offset,
                                zIndex: 1
                            }}
                        >
                            <PrimaryBadge
                                overlap='rectangular'
                                badgeContent={isPrimary ? <StarRoundedIcon sx={{ fontSize: 11 }} /> : null}
                                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                                {languageButton}
                            </PrimaryBadge>
                        </Box>
                    </Box>
                )
            })}

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                {menuMode === 'main' && (
                    <>
                        {canAddLocale && <MenuItem onClick={() => setMenuMode('add')}>{t('addLanguage', 'Add language')}</MenuItem>}
                        {canChangeLocale && (
                            <MenuItem onClick={() => setMenuMode('change')}>{t('changeLanguage', 'Change language')}</MenuItem>
                        )}
                        {isPrimaryLocale ? (
                            <MenuItem disabled>{t('primaryVariant', 'Primary variant')}</MenuItem>
                        ) : (
                            <MenuItem onClick={handleMakePrimary}>{t('makePrimary', 'Make primary')}</MenuItem>
                        )}
                        {canRemoveLocale && (
                            <>
                                <Divider />
                                <MenuItem onClick={handleRemoveLocale}>{t('removeLanguage', 'Remove')}</MenuItem>
                            </>
                        )}
                    </>
                )}

                {menuMode !== 'main' && (
                    <>
                        <MenuItem onClick={() => setMenuMode('main')}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <ArrowBackRoundedIcon fontSize='small' />
                                <span>{t('back', 'Back')}</span>
                            </Stack>
                        </MenuItem>
                        <Divider />
                        {menuLocalesAvailable.map((locale) => (
                            <MenuItem
                                key={locale.code}
                                onClick={() => (menuMode === 'add' ? handleAddLocale(locale.code) : handleChangeLocale(locale.code))}
                            >
                                {locale.label}
                            </MenuItem>
                        ))}
                        {menuLocalesAvailable.length === 0 && (
                            <MenuItem disabled>{t('noLanguagesAvailable', 'No languages available')}</MenuItem>
                        )}
                    </>
                )}
                {localesError && (
                    <Typography variant='caption' color='warning.main' sx={{ px: 2, pb: 1 }}>
                        {t('fallbackNotice', 'Using fallback languages')}
                    </Typography>
                )}
            </Menu>
        </Stack>
    )
}

/**
 * Unified field component that switches between simple, versioned, and localized modes.
 * No hooks are called conditionally - each variant is a separate component.
 *
 * Modes:
 * - 'simple' (default): Plain text field, no VLC structure
 * - 'versioned': VLC structure with version tracking, single locale (no language switching)
 * - 'localized': VLC structure with multiple locales and language switching UI
 */
export const LocalizedInlineField: React.FC<LocalizedInlineFieldProps> = (props) => {
    if (props.mode === 'localized') {
        return <LocalizedInlineFieldContent {...props} />
    }
    if (props.mode === 'versioned') {
        return <VersionedInlineField {...props} />
    }
    return <SimpleInlineField {...props} />
}

export default LocalizedInlineField
