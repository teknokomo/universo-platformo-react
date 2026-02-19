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
import { createLocalizedContent, NUMBER_DEFAULTS } from '@universo/utils'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'

export type DynamicFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON'

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
    isValuePresent,
    renderField: renderFieldOverride
}) => {
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [isReady, setReady] = useState(false)

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

    const isRuLocale = normalizedLocale === 'ru'
    const formatMessage = useCallback((en: string, ru: string) => (isRuLocale ? ru : en), [isRuLocale])

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
                        return formatMessage(
                            `Language "${failedLocale.toUpperCase()}": minimum length ${minLength}`,
                            `Язык "${failedLocale.toUpperCase()}": минимальная длина ${minLength}`
                        )
                    }
                }

                // For primary/simple string validation
                const stringValue = getStringValueForValidation(value)
                if (typeof stringValue === 'string') {
                    if (minLength !== null && maxLength !== null) {
                        if (stringValue.length < minLength || stringValue.length > maxLength) {
                            return formatMessage(
                                `Length must be between ${minLength} and ${maxLength}`,
                                `Длина должна быть от ${minLength} до ${maxLength}`
                            )
                        }
                    } else if (minLength !== null && stringValue.length < minLength) {
                        return formatMessage(`Minimum length: ${minLength}`, `Минимальная длина: ${minLength}`)
                    } else if (maxLength !== null && stringValue.length > maxLength) {
                        return formatMessage(`Maximum length: ${maxLength}`, `Максимальная длина: ${maxLength}`)
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
                    return formatMessage('Must be non-negative', 'Только неотрицательное значение')
                }
                if (typeof rules.min === 'number' && value < rules.min) {
                    return formatMessage(`Minimum value: ${rules.min}`, `Минимальное значение: ${rules.min}`)
                }
                if (typeof rules.max === 'number' && value > rules.max) {
                    return formatMessage(`Maximum value: ${rules.max}`, `Максимальное значение: ${rules.max}`)
                }
            }

            if (field.type === 'DATE') {
                if (typeof value !== 'string') return null

                const composition = rules.dateComposition ?? 'datetime'
                if (composition === 'time') {
                    return isValidTimeString(value) ? null : formatMessage('Expected time format: HH:MM', 'Ожидается время в формате ЧЧ:ММ')
                }
                if (composition === 'date') {
                    return isValidDateString(value)
                        ? null
                        : formatMessage('Expected date format: YYYY-MM-DD', 'Ожидается дата в формате ГГГГ-ММ-ДД')
                }

                return isValidDateTimeString(value)
                    ? null
                    : formatMessage('Expected date & time format: YYYY-MM-DD HH:MM', 'Ожидаются дата и время в формате ГГГГ-ММ-ДД ЧЧ:ММ')
            }

            return null
        },
        [formatMessage, getStringValueForValidation, getVlcMinLengthError, resolveValuePresent]
    )

    const hasAnyValue = useMemo(
        () => fields.some((field) => resolveValuePresent(field, formData[field.id])),
        [fields, formData, resolveValuePresent]
    )

    const hasMissingRequired = useMemo(
        () => fields.some((field) => field.required && !resolveValuePresent(field, formData[field.id])),
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
                    if (scale <= 0) {
                        target.setSelectionRange(0, target.value.length)
                        return
                    }
                    const valueText = target.value
                    const signOffset = valueText.startsWith('-') ? 1 : 0
                    const separatorIndex = valueText.indexOf(decimalSeparator)
                    if (separatorIndex === -1) {
                        target.setSelectionRange(signOffset, valueText.length)
                        return
                    }
                    const cursor = target.selectionStart ?? 0
                    if (cursor <= separatorIndex) {
                        target.setSelectionRange(signOffset, separatorIndex)
                    } else {
                        target.setSelectionRange(separatorIndex + 1, valueText.length)
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

                    // Allow navigation and control keys
                    if (
                        [
                            'Backspace',
                            'Delete',
                            'Tab',
                            'Escape',
                            'Enter',
                            'ArrowLeft',
                            'ArrowRight',
                            'ArrowUp',
                            'ArrowDown',
                            'Home',
                            'End'
                        ].includes(key)
                    ) {
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

                // Show precision format: "Длина: 8,2" means 8 digits before decimal, 2 after
                const formatInfo =
                    scale > 0
                        ? formatMessage(`Length: ${maxIntegerDigits},${scale}`, `Длина: ${maxIntegerDigits},${scale}`)
                        : formatMessage(`Length: ${maxIntegerDigits}`, `Длина: ${maxIntegerDigits}`)
                constraintParts.push(formatInfo)

                if (typeof rules?.min === 'number' && typeof rules?.max === 'number') {
                    constraintParts.push(formatMessage(`Range: ${rules.min}–${rules.max}`, `Диапазон: ${rules.min}–${rules.max}`))
                } else if (typeof rules?.min === 'number') {
                    constraintParts.push(formatMessage(`Min: ${rules.min}`, `Мин: ${rules.min}`))
                } else if (typeof rules?.max === 'number') {
                    constraintParts.push(formatMessage(`Max: ${rules.max}`, `Макс: ${rules.max}`))
                }
                if (rules?.nonNegative) {
                    constraintParts.push(formatMessage('Non-negative only', 'Только неотрицательное значение'))
                }

                const numberHelperText = fieldError ?? constraintParts.join(', ')

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
