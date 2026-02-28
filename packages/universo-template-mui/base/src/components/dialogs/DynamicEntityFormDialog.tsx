import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
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
    IconButton,
    InputAdornment,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material'
import type { VersionedLocalizedContent } from '@universo/types'
import { buildTableConstraintText, createLocalizedContent, NUMBER_DEFAULTS, toNumberRules, validateNumber } from '@universo/utils'
import { useTranslation } from 'react-i18next'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'

export type DynamicFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

/**
 * Validation rules for dynamic fields.
 * Matches AttributeValidationRules from @universo/types.
 */
export interface DynamicFieldValidationRules {
    // STRING settings
    minLength?: number | null
    maxLength?: number | null
    versioned?: boolean
    localized?: boolean

    // NUMBER settings
    precision?: number
    scale?: number
    min?: number | null
    max?: number | null
    nonNegative?: boolean

    // DATE settings
    dateComposition?: 'date' | 'time' | 'datetime'

    // TABLE settings
    minRows?: number | null
    maxRows?: number | null
}

export interface DynamicFieldConfig {
    id: string
    label: string
    type: DynamicFieldType
    required?: boolean
    /** @deprecated Use validationRules.localized instead */
    localized?: boolean
    placeholder?: string
    helperText?: string
    validationRules?: DynamicFieldValidationRules
    /** Optional target entity ID for REF fields */
    refTargetEntityId?: string | null
    /** Optional target entity kind for REF fields */
    refTargetEntityKind?: string | null
    /** Runtime options for REF->enumeration fields. */
    enumOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
    /** REF->enumeration presentation mode. */
    enumPresentationMode?: 'select' | 'radio' | 'label'
    /** Optional default enumeration value id. */
    defaultEnumValueId?: string | null
    /** Controls whether empty value can be selected for enumeration references. */
    enumAllowEmpty?: boolean
    /** Defines how empty label-mode value should be rendered. */
    enumLabelEmptyDisplay?: 'empty' | 'dash'
    /** Child field definitions for TABLE type attributes */
    childFields?: DynamicFieldConfig[]
    /** Whether to show the TABLE title (default: true) */
    tableShowTitle?: boolean
}

export interface DynamicEntityFormDialogProps {
    open: boolean
    title: string
    fields: DynamicFieldConfig[]
    locale: string
    /** i18n namespace for react-i18next t() calls (e.g. 'metahubs', 'apps'). */
    i18nNamespace?: string
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
    renderField?: (params: {
        field: DynamicFieldConfig
        value: unknown
        onChange: (value: unknown) => void
        disabled: boolean
        error: string | null
        helperText?: string
        locale: string
    }) => React.ReactNode | undefined
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

const getLocalizedStringValue = (value: unknown, locale: string): string | null => {
    if (!isLocalizedContent(value)) return null
    const locales = value.locales ?? {}
    const normalizedLocale = normalizeLocale(locale)
    const entry = locales[normalizedLocale]
    if (typeof entry?.content === 'string') return entry.content
    const primary = value._primary
    const primaryEntry = locales[primary]
    if (typeof primaryEntry?.content === 'string') return primaryEntry.content
    const firstEntry = Object.values(locales).find((item) => typeof item?.content === 'string')
    return typeof firstEntry?.content === 'string' ? firstEntry.content : null
}

const isValidTimeString = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$/.test(value)

const isValidDateString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00`)
    return !Number.isNaN(date.getTime())
}

const isValidDateTimeString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) return false
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
}

/**
 * Normalize date/datetime input to ensure year has max 4 digits.
 * Browser native date inputs allow typing 5+ digit years which breaks validation.
 * This function truncates the year to 4 digits while preserving the rest.
 */
const normalizeDateValue = (value: string, inputType: 'date' | 'time' | 'datetime-local'): string => {
    if (!value || inputType === 'time') return value

    // Find the year portion (everything before first '-')
    const dashIndex = value.indexOf('-')
    if (dashIndex <= 0) return value

    const yearPart = value.substring(0, dashIndex)

    // If year has more than 4 digits, keep only the last 4 digits
    if (yearPart.length > 4) {
        const truncatedYear = yearPart.slice(-4)
        return truncatedYear + value.substring(dashIndex)
    }

    return value
}

/**
 * Inline table cell component for NUMBER fields.
 * Replicates the full standalone NUMBER field behavior:
 * - Formatted display with locale-aware decimal separator (comma for 'ru')
 * - Zone-based selection (integer vs decimal part) on focus/click
 * - ArrowUp/ArrowDown zone-aware stepping
 * - Stepper buttons (▲▼)
 * - Blocks "-" for nonNegative, protects decimal separator
 * - Digit replacement in decimal zone (overwrites digits instead of inserting)
 */
interface NumberTableCellProps {
    value: unknown
    onChange: (value: unknown) => void
    rules: DynamicFieldValidationRules | undefined
    locale: string
    disabled: boolean
}

function NumberTableCell({ value, onChange, rules, locale, disabled }: NumberTableCellProps) {
    const precision = typeof rules?.precision === 'number' ? rules.precision : NUMBER_DEFAULTS.precision
    const scale = typeof rules?.scale === 'number' ? rules.scale : NUMBER_DEFAULTS.scale
    const maxIntegerDigits = precision - scale
    const allowNegative = !rules?.nonNegative
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    const decimalSeparator = scale > 0 ? (lang === 'ru' ? ',' : '.') : ''

    const inputRef = useRef<HTMLInputElement>(null)
    const cursorZoneRef = useRef<'integer' | 'decimal'>('integer')

    const formatValue = (val: unknown): string => {
        if (val == null || val === '' || (typeof val === 'number' && Number.isNaN(val))) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        if (typeof val === 'number') {
            return scale > 0 ? val.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(val))
        }
        const parsed = parseFloat(String(val))
        if (Number.isNaN(parsed)) {
            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
        }
        return scale > 0 ? parsed.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(parsed))
    }

    const selectNumberPart = (target: HTMLInputElement) => {
        if (!target || target.value == null) return
        if (scale <= 0) {
            target.setSelectionRange(0, target.value.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const text = target.value
        const signOffset = text.startsWith('-') ? 1 : 0
        const sepIdx = text.indexOf(decimalSeparator)
        if (sepIdx === -1) {
            target.setSelectionRange(signOffset, text.length)
            cursorZoneRef.current = 'integer'
            return
        }
        const cursor = target.selectionStart ?? 0
        if (cursor <= sepIdx) {
            target.setSelectionRange(signOffset, sepIdx)
            cursorZoneRef.current = 'integer'
        } else {
            target.setSelectionRange(sepIdx + 1, text.length)
            cursorZoneRef.current = 'decimal'
        }
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        window.requestAnimationFrame(() => selectNumberPart(event.target))
    }

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement
        window.requestAnimationFrame(() => selectNumberPart(target))
    }

    // Zone-aware stepper
    const numberRules = toNumberRules(rules)
    const doStep = (direction: 1 | -1, zone?: 'integer' | 'decimal') => {
        const effectiveZone = zone ?? cursorZoneRef.current
        const step = scale > 0 && effectiveZone === 'decimal' ? Math.pow(10, -scale) : 1
        const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
        let next = Number((current + direction * step).toFixed(scale))
        if (rules?.nonNegative && next < 0) next = 0
        if (typeof numberRules.min === 'number' && next < numberRules.min) next = numberRules.min
        if (typeof numberRules.max === 'number' && next > numberRules.max) next = numberRules.max
        if (!validateNumber(next, numberRules).valid) return
        onChange(next)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value

        if (raw === '' || raw === '-') {
            if (raw === '-' && !allowNegative) return
            onChange(null)
            return
        }

        const normalized = raw.replace(/,/g, '.')
        const pattern = allowNegative ? (scale > 0 ? /^-?\d*\.?\d*$/ : /^-?\d*$/) : scale > 0 ? /^\d*\.?\d*$/ : /^\d*$/

        if (!pattern.test(normalized)) return

        const isNeg = normalized.startsWith('-')
        const abs = isNeg ? normalized.slice(1) : normalized
        const [intPart = '', decPart = ''] = abs.split('.')

        if (intPart.length > maxIntegerDigits) return
        if (decPart.length > scale) return

        const parsed = parseFloat(normalized)
        if (Number.isFinite(parsed)) {
            onChange(parsed)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const key = event.key
        const target = event.target as HTMLInputElement
        const currentValue = target.value
        const selectionStart = target.selectionStart ?? 0
        const selectionEnd = target.selectionEnd ?? selectionStart
        const hasSelection = selectionEnd > selectionStart
        const separatorIndex = scale > 0 ? currentValue.indexOf(decimalSeparator) : -1

        // Protect decimal separator from deletion
        if ((key === 'Backspace' || key === 'Delete') && scale > 0 && separatorIndex !== -1) {
            const crossesSep = selectionStart <= separatorIndex && selectionEnd > separatorIndex
            const bsOnSep = key === 'Backspace' && selectionStart === separatorIndex + 1 && !hasSelection
            const delOnSep = key === 'Delete' && selectionStart === separatorIndex && !hasSelection
            if (crossesSep || bsOnSep || delOnSep) {
                event.preventDefault()
                return
            }
        }

        // Zone-aware ArrowUp/ArrowDown
        if (key === 'ArrowUp') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(1, zone)
            return
        }
        if (key === 'ArrowDown') {
            event.preventDefault()
            const zone: 'integer' | 'decimal' =
                scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
            cursorZoneRef.current = zone
            doStep(-1, zone)
            return
        }

        // Navigation keys
        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return

        // Ctrl/Cmd
        if (event.ctrlKey || event.metaKey) return

        // Minus
        if (key === '-') {
            if (!allowNegative) {
                event.preventDefault()
                return
            }
            if (selectionStart !== 0 || currentValue.includes('-')) event.preventDefault()
            return
        }

        // Decimal separator
        if (key === '.' || key === ',') {
            event.preventDefault()
            if (scale === 0) return
            if (separatorIndex !== -1) {
                const decStart = separatorIndex + 1
                window.requestAnimationFrame(() => target.setSelectionRange(decStart, currentValue.length))
                cursorZoneRef.current = 'decimal'
            }
            return
        }

        // Digits
        if (/^\d$/.test(key)) {
            // Decimal zone: replace digit in-place
            if (scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex) {
                event.preventDefault()
                const decStart = separatorIndex + 1
                const localIdx = Math.min(selectionStart, currentValue.length) - decStart
                const decChars = currentValue.slice(decStart).split('')
                if (localIdx >= 0 && localIdx < decChars.length) {
                    decChars[localIdx] = key
                    const nextText = `${currentValue.slice(0, decStart)}${decChars.join('')}`
                    const parsed = parseFloat(nextText.replace(/,/g, '.'))
                    if (Number.isFinite(parsed)) {
                        onChange(parsed)
                    }
                    const nextCaret = Math.min(decStart + localIdx + 1, decStart + scale)
                    window.requestAnimationFrame(() => target.setSelectionRange(nextCaret, nextCaret))
                }
                return
            }

            // Integer zone: check digit limit
            const normVal = currentValue.replace(/,/g, '.')
            const isNeg = normVal.startsWith('-')
            const absVal = isNeg ? normVal.slice(1) : normVal
            const decIdx = absVal.indexOf('.')

            if (decIdx === -1) {
                if (absVal.length >= maxIntegerDigits && selectionStart >= (isNeg ? 1 : 0) && !hasSelection) {
                    event.preventDefault()
                }
            } else {
                const adjPos = isNeg ? selectionStart - 1 : selectionStart
                if (adjPos <= decIdx) {
                    if (absVal.slice(0, decIdx).length >= maxIntegerDigits && !hasSelection) {
                        event.preventDefault()
                    }
                }
            }
            return
        }

        event.preventDefault()
    }

    const handleBlur = () => {
        // No special handling needed — value is always formatted from prop
    }

    return (
        <TextField
            inputRef={inputRef}
            size='small'
            variant='standard'
            type='text'
            inputProps={{
                inputMode: scale > 0 ? 'decimal' : 'numeric',
                style: { textAlign: 'right' }
            }}
            value={formatValue(value)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={handleClick}
            onBlur={handleBlur}
            disabled={disabled}
            fullWidth
            InputProps={{
                sx: { fontSize: 13 },
                disableUnderline: true,
                endAdornment: !disabled ? (
                    <InputAdornment position='end' sx={{ ml: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <IconButton size='small' tabIndex={-1} onClick={() => doStep(1)} sx={{ width: 16, height: 12, p: 0 }}>
                                <ArrowDropUpIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton size='small' tabIndex={-1} onClick={() => doStep(-1)} sx={{ width: 16, height: 12, p: 0 }}>
                                <ArrowDropDownIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Box>
                    </InputAdornment>
                ) : undefined
            }}
        />
    )
}

export const DynamicEntityFormDialog: React.FC<DynamicEntityFormDialogProps> = ({
    open,
    title,
    fields,
    locale,
    i18nNamespace,
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
    isValuePresent,
    renderField: renderFieldOverride
}) => {
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [isReady, setReady] = useState(false)
    const tableLocalIdRef = useRef(1)
    // Track NUMBER input refs and last cursor zone for zone-aware steppers
    const numberInputRefsRef = useRef<Map<string, HTMLInputElement>>(new Map())
    const numberCursorZoneRef = useRef<Map<string, 'integer' | 'decimal'>>(new Map())

    const applyFieldDefaults = useCallback(
        (seed: Record<string, unknown>) => {
            const next = { ...seed }

            for (const field of fields) {
                if (next[field.id] !== undefined) continue
                if (field.type !== 'REF') continue
                if (field.refTargetEntityKind !== 'enumeration') continue

                const defaultFromConfig = field.defaultEnumValueId ?? null
                const defaultFromOptions = field.enumOptions?.find((option) => option.isDefault)?.id ?? null
                const fallbackDefault = defaultFromConfig ?? defaultFromOptions
                if (fallbackDefault) {
                    next[field.id] = fallbackDefault
                }
            }

            return next
        },
        [fields]
    )

    useEffect(() => {
        if (open) {
            setReady(false)
            setFormData(applyFieldDefaults(initialData ?? {}))
            setReady(true)
        } else {
            setReady(false)
        }
    }, [open, initialData, applyFieldDefaults])

    const normalizedLocale = useMemo(() => normalizeLocale(locale), [locale])

    const { t } = useTranslation(i18nNamespace)

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

    const getStringValueForValidation = useCallback(
        (value: unknown) => {
            if (typeof value === 'string') return value
            const localizedValue = getLocalizedStringValue(value, normalizedLocale)
            if (typeof localizedValue === 'string') return localizedValue
            if (value === null || value === undefined) return null
            return String(value)
        },
        [normalizedLocale]
    )

    /**
     * For VLC fields, check minLength for ALL locales that have content.
     * Returns the locale code that fails validation, or null if all pass.
     */
    const getVlcMinLengthError = useCallback((value: unknown, minLength: number): string | null => {
        if (!isLocalizedContent(value)) return null
        const vlc = value as VersionedLocalizedContent<string>
        const locales = vlc.locales
        for (const [localeCode, entry] of Object.entries(locales)) {
            const content = entry?.content
            // Only validate locales that have content (not empty)
            if (typeof content === 'string' && content.length > 0 && content.length < minLength) {
                return localeCode
            }
        }
        return null
    }, [])

    const getFieldError = useCallback(
        (field: DynamicFieldConfig, value: unknown) => {
            if (!resolveValuePresent(field, value)) return null

            const rules = field.validationRules ?? {}

            if (field.type === 'STRING') {
                const minLength = typeof rules.minLength === 'number' ? rules.minLength : null
                const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : null

                // For VLC fields, check minLength for ALL locales
                if (isLocalizedContent(value) && minLength !== null) {
                    const failedLocale = getVlcMinLengthError(value, minLength)
                    if (failedLocale) {
                        return t('validation.vlcMinLength', {
                            defaultValue: 'Language "{{locale}}": minimum length {{min}}',
                            locale: failedLocale.toUpperCase(),
                            min: minLength
                        })
                    }
                }

                // For primary/simple string validation
                const stringValue = getStringValueForValidation(value)
                if (typeof stringValue === 'string') {
                    if (minLength !== null && maxLength !== null) {
                        if (stringValue.length < minLength || stringValue.length > maxLength) {
                            return t('validation.lengthBetween', {
                                defaultValue: 'Length must be between {{min}} and {{max}}',
                                min: minLength,
                                max: maxLength
                            })
                        }
                    } else if (minLength !== null && stringValue.length < minLength) {
                        return t('validation.minLength', { defaultValue: 'Minimum length: {{min}}', min: minLength })
                    } else if (maxLength !== null && stringValue.length > maxLength) {
                        return t('validation.maxLength', { defaultValue: 'Maximum length: {{max}}', max: maxLength })
                    }
                }
            }

            if (field.type === 'NUMBER') {
                // For NUMBER fields, precision/scale is enforced by input restrictions.
                // Only validate min/max/nonNegative rules which can't be controlled by input alone.
                if (typeof value !== 'number' || Number.isNaN(value)) {
                    return null // Empty or non-number is not an error (will show default)
                }

                if (rules.nonNegative === true && value < 0) {
                    return t('validation.nonNegative', 'Must be non-negative')
                }
                if (typeof rules.min === 'number' && value < rules.min) {
                    return t('validation.minValue', { defaultValue: 'Minimum value: {{min}}', min: rules.min })
                }
                if (typeof rules.max === 'number' && value > rules.max) {
                    return t('validation.maxValue', { defaultValue: 'Maximum value: {{max}}', max: rules.max })
                }
            }

            if (field.type === 'DATE') {
                if (typeof value !== 'string') return null

                const composition = rules.dateComposition ?? 'datetime'
                if (composition === 'time') {
                    return isValidTimeString(value) ? null : t('validation.timeFormat', 'Expected time format: HH:MM')
                }
                if (composition === 'date') {
                    return isValidDateString(value) ? null : t('validation.dateFormat', 'Expected date format: YYYY-MM-DD')
                }

                return isValidDateTimeString(value) ? null : t('validation.datetimeFormat', 'Expected date & time format: YYYY-MM-DD HH:MM')
            }

            return null
        },
        [t, getStringValueForValidation, getVlcMinLengthError, resolveValuePresent]
    )

    const hasAnyValue = useMemo(
        () => fields.some((field) => resolveValuePresent(field, formData[field.id])),
        [fields, formData, resolveValuePresent]
    )

    const hasMissingRequired = useMemo(
        () =>
            fields.some((field) => {
                if (field.type === 'TABLE' && field.required) {
                    // TABLE required: must have at least max(1, minRows) rows
                    const rows = formData[field.id]
                    const rowCount = Array.isArray(rows) ? rows.length : 0
                    const minRequired = Math.max(1, typeof field.validationRules?.minRows === 'number' ? field.validationRules.minRows : 1)
                    if (rowCount < minRequired) return true
                    return false
                }
                if (field.required && !resolveValuePresent(field, formData[field.id])) return true
                return false
            }),
        [fields, formData, resolveValuePresent]
    )

    const hasValidationErrors = useMemo(
        () => fields.some((field) => Boolean(getFieldError(field, formData[field.id]))),
        [fields, formData, getFieldError]
    )

    const buildPayload = useCallback(() => {
        const payload: Record<string, unknown> = {}
        fields.forEach((field) => {
            const value = formData[field.id]
            if (!resolveValuePresent(field, value)) return
            // Strip internal-only properties from TABLE row arrays before sending to the API
            if (field.type === 'TABLE' && Array.isArray(value)) {
                payload[field.id] = value.map((row: Record<string, unknown>) => {
                    const { _localId, __rowId, ...rest } = row
                    return rest
                })
            } else {
                payload[field.id] = value
            }
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
        const rules = field.validationRules
        const fieldError = getFieldError(field, value)
        const helperText = fieldError ?? field.helperText

        const customField = renderFieldOverride?.({
            field,
            value,
            onChange: (next) => handleFieldChange(field.id, next),
            disabled,
            error: fieldError,
            helperText,
            locale: normalizedLocale
        })

        if (customField !== undefined) {
            return customField
        }

        switch (field.type) {
            case 'STRING': {
                // Check if localized: from validationRules or legacy localized prop
                const isLocalized = rules?.localized ?? field.localized
                const isVersioned = rules?.versioned

                // For VLC fields, compute which locale has the minLength error
                const vlcErrorLocale = isLocalizedContent(value) && rules?.minLength ? getVlcMinLengthError(value, rules.minLength) : null

                // If both versioned and localized, use localized mode
                // If only versioned, use versioned mode (no language switching)
                // If only localized, use localized mode
                if (isLocalized) {
                    return (
                        <LocalizedInlineField
                            mode='localized'
                            label={field.label}
                            required={field.required}
                            value={ensureLocalizedValue(value, normalizedLocale)}
                            onChange={(next) => handleFieldChange(field.id, next)}
                            uiLocale={locale}
                            disabled={disabled}
                            error={fieldError}
                            errorLocale={vlcErrorLocale}
                            helperText={field.helperText}
                            maxLength={rules?.maxLength}
                            minLength={rules?.minLength}
                        />
                    )
                }

                if (isVersioned) {
                    return (
                        <LocalizedInlineField
                            mode='versioned'
                            label={field.label}
                            required={field.required}
                            value={ensureLocalizedValue(value, normalizedLocale)}
                            onChange={(next) => handleFieldChange(field.id, next)}
                            uiLocale={locale}
                            disabled={disabled}
                            error={fieldError}
                            errorLocale={vlcErrorLocale}
                            helperText={field.helperText}
                            maxLength={rules?.maxLength}
                            minLength={rules?.minLength}
                        />
                    )
                }

                // Plain string with optional length validation
                return (
                    <TextField
                        fullWidth
                        label={field.label}
                        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
                        onChange={(event) => handleFieldChange(field.id, event.target.value)}
                        required={field.required}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                        inputProps={{
                            minLength: rules?.minLength ?? undefined,
                            maxLength: rules?.maxLength ?? undefined
                        }}
                    />
                )
            }
            case 'NUMBER': {
                // Calculate precision/scale constraints
                const precision = rules?.precision ?? NUMBER_DEFAULTS.precision
                const scale = rules?.scale ?? NUMBER_DEFAULTS.scale
                const maxIntegerDigits = precision - scale
                const allowNegative = !rules?.nonNegative
                // Use locale-appropriate decimal separator: comma for Russian, dot for others
                const normalizedLocale = normalizeLocale(locale)
                const decimalSeparator = scale > 0 ? (normalizedLocale === 'ru' ? ',' : '.') : ''

                /**
                 * Format number value for display.
                 * Shows fixed decimal places (e.g., "0.00" for scale=2).
                 * For optional fields, empty values remain empty (not "0").
                 */
                const formatNumberValue = (val: unknown): string => {
                    if (val === null || val === undefined || val === '') {
                        // For optional fields, show empty; for required, show default "0"
                        if (!field.required) return ''
                        return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                    }
                    if (typeof val === 'number') {
                        if (Number.isNaN(val)) {
                            if (!field.required) return ''
                            return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                        }
                        return scale > 0 ? val.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(val))
                    }
                    // Parse string value
                    const parsed = parseFloat(String(val))
                    if (Number.isNaN(parsed)) {
                        if (!field.required) return ''
                        return scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'
                    }
                    return scale > 0 ? parsed.toFixed(scale).replace('.', decimalSeparator) : String(Math.trunc(parsed))
                }

                const selectNumberPart = (target: HTMLInputElement) => {
                    // Guard against stale DOM target after re-render (rAF may fire after unmount)
                    if (!target || target.value == null) return
                    if (scale <= 0) {
                        target.setSelectionRange(0, target.value.length)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                        return
                    }
                    const valueText = target.value
                    const signOffset = valueText.startsWith('-') ? 1 : 0
                    const separatorIndex = valueText.indexOf(decimalSeparator)
                    if (separatorIndex === -1) {
                        target.setSelectionRange(signOffset, valueText.length)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                        return
                    }
                    const cursor = target.selectionStart ?? 0
                    if (cursor <= separatorIndex) {
                        target.setSelectionRange(signOffset, separatorIndex)
                        numberCursorZoneRef.current.set(field.id, 'integer')
                    } else {
                        target.setSelectionRange(separatorIndex + 1, valueText.length)
                        numberCursorZoneRef.current.set(field.id, 'decimal')
                    }
                }

                const handleNumberFocus = (event: React.FocusEvent<HTMLInputElement>) => {
                    const target = event.target
                    window.requestAnimationFrame(() => selectNumberPart(target))
                }

                const handleNumberClick = (event: React.MouseEvent<HTMLInputElement>) => {
                    const target = event.target as HTMLInputElement
                    window.requestAnimationFrame(() => selectNumberPart(target))
                }

                /**
                 * Handle input change with digit restrictions.
                 * Prevents entering more digits than allowed by precision/scale.
                 */
                const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                    const inputValue = event.target.value

                    // Allow empty to reset
                    if (inputValue === '' || inputValue === '-') {
                        handleFieldChange(field.id, null)
                        return
                    }

                    // Normalize decimal separator (replace comma with dot for parsing)
                    const normalizedInput = inputValue.replace(/,/g, '.')

                    // Validate input format: optional minus, digits, optional decimal point, digits
                    const validPattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/

                    if (!validPattern.test(normalizedInput)) {
                        return // Block invalid characters
                    }

                    // Split into integer and decimal parts
                    const isNegative = normalizedInput.startsWith('-')
                    const absValue = isNegative ? normalizedInput.slice(1) : normalizedInput
                    const [intPart = '', decPart = ''] = absValue.split('.')

                    // Check digit limits
                    if (intPart.length > maxIntegerDigits) {
                        return // Block: too many integer digits
                    }
                    if (decPart.length > scale) {
                        return // Block: too many decimal digits
                    }

                    // Parse and store as number
                    const parsed = parseFloat(normalizedInput)
                    if (Number.isFinite(parsed)) {
                        handleFieldChange(field.id, parsed)
                    }
                }

                /**
                 * Handle key press to prevent invalid characters.
                 */
                const handleNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
                    const key = event.key
                    const target = event.target as HTMLInputElement
                    const currentValue = target.value
                    const selectionStart = target.selectionStart ?? 0
                    const selectionEnd = target.selectionEnd ?? selectionStart
                    const hasSelection = selectionEnd > selectionStart
                    const separatorIndex = scale > 0 ? currentValue.indexOf(decimalSeparator) : -1

                    if ((key === 'Backspace' || key === 'Delete') && scale > 0 && separatorIndex !== -1) {
                        const selectionCrossesSeparator = selectionStart <= separatorIndex && selectionEnd > separatorIndex
                        const backspaceOnSeparator =
                            key === 'Backspace' && selectionStart === separatorIndex + 1 && selectionEnd === selectionStart
                        const deleteOnSeparator = key === 'Delete' && selectionStart === separatorIndex && selectionEnd === selectionStart
                        if (selectionCrossesSeparator || backspaceOnSeparator || deleteOnSeparator) {
                            event.preventDefault()
                            return
                        }
                    }

                    // ArrowUp/ArrowDown: trigger zone-aware stepper increment/decrement
                    if (key === 'ArrowUp') {
                        event.preventDefault()
                        const zone: 'integer' | 'decimal' =
                            scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
                        numberCursorZoneRef.current.set(field.id, zone)
                        handleStepUp(zone)
                        return
                    }
                    if (key === 'ArrowDown') {
                        event.preventDefault()
                        const zone: 'integer' | 'decimal' =
                            scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex ? 'decimal' : 'integer'
                        numberCursorZoneRef.current.set(field.id, zone)
                        handleStepDown(zone)
                        return
                    }

                    // Allow navigation and control keys
                    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
                        return
                    }

                    // Allow Ctrl/Cmd combinations (copy, paste, select all)
                    if (event.ctrlKey || event.metaKey) {
                        return
                    }

                    // Handle minus sign
                    if (key === '-') {
                        if (!allowNegative) {
                            event.preventDefault()
                            return
                        }
                        // Only allow at the beginning and if not already present
                        if (selectionStart !== 0 || currentValue.includes('-')) {
                            event.preventDefault()
                        }
                        return
                    }

                    // Handle decimal point (dot or comma)
                    if (key === '.' || key === ',') {
                        if (scale === 0) {
                            event.preventDefault() // No decimals allowed
                            return
                        }
                        event.preventDefault()
                        if (separatorIndex !== -1) {
                            const decimalStart = separatorIndex + 1
                            window.requestAnimationFrame(() => target.setSelectionRange(decimalStart, currentValue.length))
                        }
                        return
                    }

                    // Allow digits 0-9
                    if (/^\d$/.test(key)) {
                        if (scale > 0 && separatorIndex !== -1 && selectionStart > separatorIndex) {
                            event.preventDefault()
                            const decimalStart = separatorIndex + 1
                            const localIndex = Math.min(selectionStart, currentValue.length) - decimalStart
                            const decimalChars = currentValue.slice(decimalStart).split('')
                            if (localIndex >= 0 && localIndex < decimalChars.length) {
                                decimalChars[localIndex] = key
                                const nextValue = `${currentValue.slice(0, decimalStart)}${decimalChars.join('')}`
                                const parsed = parseFloat(nextValue.replace(/,/g, '.'))
                                if (Number.isFinite(parsed)) {
                                    handleFieldChange(field.id, parsed)
                                }
                                const nextCaret = Math.min(decimalStart + localIndex + 1, decimalStart + scale)
                                window.requestAnimationFrame(() => target.setSelectionRange(nextCaret, nextCaret))
                                return
                            }
                        }

                        // Check if adding this digit would exceed limits (integer part)
                        const normalizedValue = currentValue.replace(/,/g, '.')
                        const isNegative = normalizedValue.startsWith('-')
                        const absValue = isNegative ? normalizedValue.slice(1) : normalizedValue
                        const decimalIndex = absValue.indexOf('.')

                        if (decimalIndex === -1) {
                            const intPartLength = absValue.length
                            if (intPartLength >= maxIntegerDigits && selectionStart >= (isNegative ? 1 : 0) && !hasSelection) {
                                event.preventDefault()
                            }
                        } else {
                            const adjustedPos = isNegative ? selectionStart - 1 : selectionStart
                            if (adjustedPos <= decimalIndex) {
                                const intPart = absValue.slice(0, decimalIndex)
                                if (intPart.length >= maxIntegerDigits && !hasSelection) {
                                    event.preventDefault()
                                }
                            } else {
                                const decPart = absValue.slice(decimalIndex + 1)
                                if (decPart.length >= scale && !hasSelection) {
                                    event.preventDefault()
                                }
                            }
                        }
                        return
                    }

                    // Block all other characters
                    event.preventDefault()
                }

                /**
                 * Handle blur to format value properly.
                 */
                const handleNumberBlur = () => {
                    // When field loses focus, for required fields normalize empty to 0,
                    // but keep optional fields empty (null/undefined) so they can persist as NULL.
                    if ((value === null || value === undefined) && field.required) {
                        handleFieldChange(field.id, 0)
                    }
                }

                // Build helper text showing constraints (like STRING shows "Макс. длина: 10")
                const constraintParts: string[] = []

                // Show precision format: "Length: 8,2" means 8 digits before decimal, 2 after
                const formatInfo =
                    scale > 0
                        ? t('validation.numberLengthWithScale', {
                              defaultValue: 'Length: {{integer}},{{scale}}',
                              integer: maxIntegerDigits,
                              scale
                          })
                        : t('validation.numberLength', { defaultValue: 'Length: {{integer}}', integer: maxIntegerDigits })
                constraintParts.push(formatInfo)

                if (typeof rules?.min === 'number' && typeof rules?.max === 'number') {
                    constraintParts.push(t('validation.range', { defaultValue: 'Range: {{min}}–{{max}}', min: rules.min, max: rules.max }))
                } else if (typeof rules?.min === 'number') {
                    constraintParts.push(t('validation.min', { defaultValue: 'Min: {{min}}', min: rules.min }))
                } else if (typeof rules?.max === 'number') {
                    constraintParts.push(t('validation.max', { defaultValue: 'Max: {{max}}', max: rules.max }))
                }
                if (rules?.nonNegative) {
                    constraintParts.push(t('validation.nonNegativeOnly', 'Non-negative only'))
                }

                const numberHelperText = fieldError ?? constraintParts.join(', ')

                // Zone-aware stepper: integer zone → step 1, decimal zone → step 10^(-scale)
                const stepValue = scale > 0 ? Math.pow(10, -scale) : 1
                const getStepValue = (zone?: 'integer' | 'decimal') => {
                    if (scale <= 0) return 1
                    return zone === 'decimal' ? stepValue : 1
                }
                const handleStepUp = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current + step).toFixed(scale))
                    if (typeof rules?.max === 'number' && next > rules.max) next = rules.max
                    // Validate precision limits before applying
                    const result = validateNumber(next, {
                        precision,
                        scale,
                        min: rules?.min,
                        max: rules?.max,
                        nonNegative: rules?.nonNegative
                    })
                    if (!result.valid) return
                    handleFieldChange(field.id, next)
                }
                const handleStepDown = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current - step).toFixed(scale))
                    if (rules?.nonNegative && next < 0) next = 0
                    if (typeof rules?.min === 'number' && next < rules.min) next = rules.min
                    // Validate precision limits before applying
                    const result = validateNumber(next, {
                        precision,
                        scale,
                        min: rules?.min,
                        max: rules?.max,
                        nonNegative: rules?.nonNegative
                    })
                    if (!result.valid) return
                    handleFieldChange(field.id, next)
                }

                return (
                    <TextField
                        fullWidth
                        type='text'
                        inputMode='decimal'
                        label={field.label}
                        value={formatNumberValue(value)}
                        onChange={handleNumberChange}
                        onKeyDown={handleNumberKeyDown}
                        onFocus={handleNumberFocus}
                        onClick={handleNumberClick}
                        onBlur={handleNumberBlur}
                        required={field.required}
                        disabled={disabled}
                        placeholder={scale > 0 ? `0${decimalSeparator}${'0'.repeat(scale)}` : '0'}
                        error={Boolean(fieldError)}
                        helperText={numberHelperText}
                        inputRef={(el: HTMLInputElement | null) => {
                            if (el) {
                                numberInputRefsRef.current.set(field.id, el)
                            } else {
                                numberInputRefsRef.current.delete(field.id)
                            }
                        }}
                        inputProps={{ style: { textAlign: 'right' } }}
                        InputProps={{
                            endAdornment: !disabled ? (
                                <InputAdornment position='end'>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5, mr: -0.5 }}>
                                        <IconButton
                                            size='small'
                                            tabIndex={-1}
                                            onClick={() => handleStepUp()}
                                            sx={{ width: 20, height: 16, p: 0 }}
                                            aria-label={t('number.increment', 'Increment')}
                                        >
                                            <ArrowDropUpIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            tabIndex={-1}
                                            onClick={() => handleStepDown()}
                                            sx={{ width: 20, height: 16, p: 0 }}
                                            aria-label={t('number.decrement', 'Decrement')}
                                        >
                                            <ArrowDropDownIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Box>
                                </InputAdornment>
                            ) : undefined
                        }}
                    />
                )
            }
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
            case 'DATE': {
                // Determine input type and max value based on dateComposition
                // Browser native date/time inputs allow 5+ digit years, so we add max constraint and normalize
                const composition = rules?.dateComposition ?? 'datetime'
                let inputType: 'date' | 'time' | 'datetime-local'
                let maxValue: string | undefined

                switch (composition) {
                    case 'date':
                        inputType = 'date'
                        maxValue = '9999-12-31'
                        break
                    case 'time':
                        inputType = 'time'
                        maxValue = undefined
                        break
                    case 'datetime':
                    default:
                        inputType = 'datetime-local'
                        maxValue = '9999-12-31T23:59'
                        break
                }

                return (
                    <TextField
                        fullWidth
                        type={inputType}
                        label={field.label}
                        value={(value as string) ?? ''}
                        onChange={(event) => {
                            const normalizedValue = normalizeDateValue(event.target.value, inputType)
                            handleFieldChange(field.id, normalizedValue)
                        }}
                        required={field.required}
                        disabled={disabled}
                        InputLabelProps={{ shrink: true }}
                        error={Boolean(fieldError)}
                        helperText={helperText}
                        inputProps={{ max: maxValue }}
                    />
                )
            }
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
                        error={Boolean(fieldError)}
                        helperText={helperText}
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
                        error={Boolean(fieldError)}
                        helperText={helperText}
                    />
                )
            case 'TABLE': {
                const childFieldDefs = field.childFields ?? []
                const tableRows = (Array.isArray(value) ? value : []) as Record<string, unknown>[]
                const tableMinRows = typeof field.validationRules?.minRows === 'number' ? field.validationRules.minRows : null
                const tableMaxRows = typeof field.validationRules?.maxRows === 'number' ? field.validationRules.maxRows : null

                const { helperText: tableHelperText, isMissing: checkMissing } = buildTableConstraintText({
                    required: field.required,
                    minRows: tableMinRows,
                    maxRows: tableMaxRows,
                    t
                })
                const isMissing = checkMissing(tableRows.length)

                const handleAddTableRow = () => {
                    const localId = tableLocalIdRef.current++
                    const newRow: Record<string, unknown> = { _localId: `__local_new_${localId}` }
                    for (const child of childFieldDefs) {
                        newRow[child.id] = child.type === 'BOOLEAN' ? false : null
                    }
                    handleFieldChange(field.id, [...tableRows, newRow])
                }

                const handleDeleteTableRow = (rowId: string) => {
                    handleFieldChange(
                        field.id,
                        tableRows.filter((row, idx) => String(row._localId ?? row.id ?? `__local_${idx}`) !== rowId)
                    )
                }

                const handleTableCellChange = (rowId: string, childId: string, cellValue: unknown) => {
                    // Validate NUMBER child fields against their validationRules
                    const childField = childFieldDefs.find((c) => c.id === childId)
                    if (childField?.type === 'NUMBER' && cellValue != null && cellValue !== '') {
                        const numVal = Number(cellValue)
                        if (!Number.isNaN(numVal) && childField.validationRules) {
                            const result = validateNumber(numVal, toNumberRules(childField.validationRules))
                            if (!result.valid) return
                        }
                    }
                    handleFieldChange(
                        field.id,
                        tableRows.map((row, idx) => {
                            if (String(row._localId ?? row.id ?? `__local_${idx}`) !== rowId) return row
                            return { ...row, [childId]: cellValue }
                        })
                    )
                }

                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant='subtitle2' color='text.secondary'>
                                {field.label}
                            </Typography>
                            {!disabled && (
                                <Button
                                    size='small'
                                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                    onClick={handleAddTableRow}
                                    sx={{ height: 28, fontSize: 12, textTransform: 'none' }}
                                >
                                    {t('tableField.addRow', 'Add Row')}
                                </Button>
                            )}
                        </Box>

                        <TableContainer
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                height: tableRows.length > 1 ? 'auto' : 108
                            }}
                        >
                            <Table size='small' stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        {childFieldDefs.map((child) => (
                                            <TableCell
                                                key={child.id}
                                                sx={{ p: '4px 8px', fontSize: 12, fontWeight: 600, backgroundColor: 'grey.100' }}
                                            >
                                                {child.label}
                                            </TableCell>
                                        ))}
                                        {!disabled && <TableCell sx={{ width: 40, p: '4px 8px', backgroundColor: 'grey.100' }} />}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableRows.length > 0 ? (
                                        tableRows.map((row, index) => {
                                            const rowId = String(row._localId ?? row.id ?? `__local_${index}`)
                                            return (
                                                <TableRow key={rowId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    {childFieldDefs.map((child) => (
                                                        <TableCell key={child.id} sx={{ p: '4px 8px' }}>
                                                            {child.type === 'NUMBER' ? (
                                                                <NumberTableCell
                                                                    value={row[child.id]}
                                                                    onChange={(cellValue) =>
                                                                        handleTableCellChange(rowId, child.id, cellValue)
                                                                    }
                                                                    rules={child.validationRules}
                                                                    locale={normalizedLocale}
                                                                    disabled={disabled}
                                                                />
                                                            ) : (
                                                                <TextField
                                                                    size='small'
                                                                    variant='standard'
                                                                    type='text'
                                                                    value={row[child.id] ?? ''}
                                                                    onChange={(e) => handleTableCellChange(rowId, child.id, e.target.value)}
                                                                    disabled={disabled}
                                                                    fullWidth
                                                                    InputProps={{ sx: { fontSize: 13 }, disableUnderline: true }}
                                                                />
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                    {!disabled && (
                                                        <TableCell align='center' sx={{ p: '2px 4px' }}>
                                                            <IconButton
                                                                size='small'
                                                                onClick={() => handleDeleteTableRow(rowId)}
                                                                sx={{ width: 24, height: 24 }}
                                                            >
                                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={childFieldDefs.length + (disabled ? 0 : 1)}
                                                sx={{ textAlign: 'center', py: 2, color: 'text.secondary', border: 0 }}
                                            >
                                                <Typography variant='body2' color='text.secondary'>
                                                    {t('tableField.noRowsYet', 'No rows yet. Click "Add Row" to start.')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {tableHelperText && (
                            <Typography variant='caption' color={isMissing ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
                                {tableHelperText}
                            </Typography>
                        )}
                    </Box>
                )
            }
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
                        error={Boolean(fieldError)}
                        helperText={helperText}
                    />
                )
        }
    }

    const isSubmitDisabled =
        isSubmitting || !isReady || fields.length === 0 || hasMissingRequired || hasValidationErrors || (requireAnyValue && !hasAnyValue)

    const hasTableFields = fields.some((f) => f.type === 'TABLE')
    const dialogMaxWidth = hasTableFields ? 'md' : 'sm'

    return (
        <Dialog open={open} onClose={onClose} maxWidth={dialogMaxWidth} fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
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
