import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
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
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import type { VersionedLocalizedContent } from '@universo/types'
import { buildTableConstraintText, createLocalizedContent, NUMBER_DEFAULTS, toNumberRules, validateNumber } from '@universo/utils'
import { useTranslation } from 'react-i18next'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'
import { TabularPartEditor } from '../TabularPartEditor'
import { RuntimeInlineTabularEditor } from '../RuntimeInlineTabularEditor'

export type FieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

/**
 * Validation rules for form fields.
 * Matches AttributeValidationRules from @universo/types.
 */
export interface FieldValidationRules extends Record<string, unknown> {
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

export interface FieldConfig {
    id: string
    label: string
    type: FieldType
    required?: boolean
    /** @deprecated Use validationRules.localized instead */
    localized?: boolean
    placeholder?: string
    helperText?: string
    validationRules?: FieldValidationRules
    /** Optional target entity ID for REF fields */
    refTargetEntityId?: string | null
    /** Optional target entity kind for REF fields */
    refTargetEntityKind?: string | null
    /** Runtime options for REF fields (catalog/enumeration). */
    refOptions?: Array<{
        id: string
        label: string
        codename?: string
        isDefault?: boolean
        sortOrder?: number
    }>
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
    /** Child field definitions for TABLE-type attributes. */
    childFields?: FieldConfig[]
    /** UI configuration for TABLE-type attributes. */
    tableUiConfig?: Record<string, unknown>
    /** Original attribute UUID — used for TABLE-type API calls (tabular part endpoint). */
    attributeId?: string
}

export interface FormDialogProps {
    open: boolean
    title: string
    fields: FieldConfig[]
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
    isValuePresent?: (field: FieldConfig, value: unknown) => boolean
    /** API base URL — required for TABLE inline editing in EDIT mode. */
    apiBaseUrl?: string
    /** Application UUID — required for TABLE inline editing in EDIT mode. */
    applicationId?: string
    /** Catalog UUID — required for TABLE inline editing in EDIT mode. */
    catalogId?: string
    /** Row being edited (null = create mode) — used for TABLE rendering. */
    editRowId?: string | null
    renderField?: (params: {
        field: FieldConfig
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
 */
const normalizeDateValue = (value: string, inputType: 'date' | 'time' | 'datetime-local'): string => {
    if (!value || inputType === 'time') return value

    const dashIndex = value.indexOf('-')
    if (dashIndex <= 0) return value

    const yearPart = value.substring(0, dashIndex)

    if (yearPart.length > 4) {
        const truncatedYear = yearPart.slice(-4)
        return truncatedYear + value.substring(dashIndex)
    }

    return value
}

export const FormDialog: React.FC<FormDialogProps> = ({
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
    renderField: renderFieldOverride,
    apiBaseUrl,
    applicationId,
    catalogId,
    editRowId
}) => {
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [isReady, setReady] = useState(false)
    const wasOpenRef = useRef(false)
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
        const wasOpen = wasOpenRef.current

        if (open && !wasOpen) {
            setReady(false)
            setFormData(applyFieldDefaults(initialData ?? {}))
            setReady(true)
        } else if (!open && wasOpen) {
            setReady(false)
        }

        wasOpenRef.current = open
    }, [open, initialData, applyFieldDefaults])

    const normalizedLocale = useMemo(() => normalizeLocale(locale), [locale])

    const { t } = useTranslation('apps')

    const handleFieldChange = useCallback((id: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [id]: value }))
    }, [])

    const resolveValuePresent = useCallback(
        (field: FieldConfig, value: unknown) => {
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
            if (typeof content === 'string' && content.length > 0 && content.length < minLength) {
                return localeCode
            }
        }
        return null
    }, [])

    const getFieldError = useCallback(
        (field: FieldConfig, value: unknown) => {
            if (!resolveValuePresent(field, value)) return null

            const rules = field.validationRules ?? {}

            if (field.type === 'STRING') {
                const minLength = typeof rules.minLength === 'number' ? rules.minLength : null
                const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : null

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
                        return t('validation.minLength', {
                            defaultValue: 'Minimum length: {{min}}',
                            min: minLength
                        })
                    } else if (maxLength !== null && stringValue.length > maxLength) {
                        return t('validation.maxLength', {
                            defaultValue: 'Maximum length: {{max}}',
                            max: maxLength
                        })
                    }
                }
            }

            if (field.type === 'NUMBER') {
                if (typeof value !== 'number' || Number.isNaN(value)) {
                    return null
                }

                const result = validateNumber(value, toNumberRules(rules))
                if (result.valid) return null

                switch (result.errorKey) {
                    case 'mustBeNonNegative':
                        return t('validation.nonNegative', 'Must be non-negative')
                    case 'belowMinimum':
                        return t('validation.minValue', {
                            defaultValue: 'Minimum value: {{min}}',
                            min: rules.min
                        })
                    case 'aboveMaximum':
                        return t('validation.maxValue', {
                            defaultValue: 'Maximum value: {{max}}',
                            max: rules.max
                        })
                    case 'tooManyIntegerDigits':
                    case 'tooManyDecimalDigits':
                    case 'exceedsSafeInteger':
                        return t('validation.numberPrecisionExceeded', 'Value exceeds allowed precision')
                    default:
                        return result.errorMessage ?? t('validation.invalidNumber', 'Invalid number')
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
                    const tableMinRows =
                        typeof field.validationRules?.minRows === 'number' ? field.validationRules.minRows : null
                    const minRequired = Math.max(1, tableMinRows ?? 1)
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

    const renderField = (field: FieldConfig) => {
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
                const isLocalized = rules?.localized ?? field.localized
                const isVersioned = rules?.versioned

                const vlcErrorLocale = isLocalizedContent(value) && rules?.minLength ? getVlcMinLengthError(value, rules.minLength) : null

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
                const precision = rules?.precision ?? NUMBER_DEFAULTS.precision
                const scale = rules?.scale ?? NUMBER_DEFAULTS.scale
                const maxIntegerDigits = precision - scale
                const allowNegative = !rules?.nonNegative
                const fieldLocale = normalizeLocale(locale)
                const decimalSeparator = scale > 0 ? (fieldLocale === 'ru' ? ',' : '.') : ''

                const formatNumberValue = (val: unknown): string => {
                    if (val === null || val === undefined || val === '') {
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

                const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                    const inputValue = event.target.value

                    if (inputValue === '' || inputValue === '-') {
                        handleFieldChange(field.id, null)
                        return
                    }

                    const normalizedInput = inputValue.replace(/,/g, '.')

                    const validPattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/

                    if (!validPattern.test(normalizedInput)) {
                        return
                    }

                    const isNegative = normalizedInput.startsWith('-')
                    const absValue = isNegative ? normalizedInput.slice(1) : normalizedInput
                    const [intPart = '', decPart = ''] = absValue.split('.')

                    if (intPart.length > maxIntegerDigits) {
                        return
                    }
                    if (decPart.length > scale) {
                        return
                    }

                    const parsed = parseFloat(normalizedInput)
                    if (Number.isFinite(parsed)) {
                        handleFieldChange(field.id, parsed)
                    }
                }

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

                    if (
                        [
                            'Backspace',
                            'Delete',
                            'Tab',
                            'Escape',
                            'Enter',
                            'ArrowLeft',
                            'ArrowRight',
                            'Home',
                            'End'
                        ].includes(key)
                    ) {
                        return
                    }

                    if (event.ctrlKey || event.metaKey) {
                        return
                    }

                    if (key === '-') {
                        if (!allowNegative) {
                            event.preventDefault()
                            return
                        }
                        if (selectionStart !== 0 || currentValue.includes('-')) {
                            event.preventDefault()
                        }
                        return
                    }

                    if (key === '.' || key === ',') {
                        if (scale === 0) {
                            event.preventDefault()
                            return
                        }
                        event.preventDefault()
                        if (separatorIndex !== -1) {
                            const decimalStart = separatorIndex + 1
                            window.requestAnimationFrame(() => target.setSelectionRange(decimalStart, currentValue.length))
                        }
                        return
                    }

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

                        const normalizedValue = currentValue.replace(/,/g, '.')
                        const isNeg = normalizedValue.startsWith('-')
                        const absVal = isNeg ? normalizedValue.slice(1) : normalizedValue
                        const decimalIndex = absVal.indexOf('.')

                        if (decimalIndex === -1) {
                            const intPartLength = absVal.length
                            if (intPartLength >= maxIntegerDigits && selectionStart >= (isNeg ? 1 : 0) && !hasSelection) {
                                event.preventDefault()
                            }
                        } else {
                            const adjustedPos = isNeg ? selectionStart - 1 : selectionStart
                            if (adjustedPos <= decimalIndex) {
                                const intPart = absVal.slice(0, decimalIndex)
                                if (intPart.length >= maxIntegerDigits && !hasSelection) {
                                    event.preventDefault()
                                }
                            } else {
                                const decPart = absVal.slice(decimalIndex + 1)
                                if (decPart.length >= scale && !hasSelection) {
                                    event.preventDefault()
                                }
                            }
                        }
                        return
                    }

                    event.preventDefault()
                }

                const handleNumberBlur = () => {
                    if ((value === null || value === undefined) && field.required) {
                        handleFieldChange(field.id, 0)
                    }
                }

                const constraintParts: string[] = []

                const formatInfo =
                    scale > 0
                        ? t('validation.numberLengthWithScale', {
                              defaultValue: 'Length: {{integer}},{{scale}}',
                              integer: maxIntegerDigits,
                              scale
                          })
                        : t('validation.numberLength', {
                              defaultValue: 'Length: {{integer}}',
                              integer: maxIntegerDigits
                          })
                constraintParts.push(formatInfo)

                if (typeof rules?.min === 'number' && typeof rules?.max === 'number') {
                    constraintParts.push(
                        t('validation.range', {
                            defaultValue: 'Range: {{min}}–{{max}}',
                            min: rules.min,
                            max: rules.max
                        })
                    )
                } else if (typeof rules?.min === 'number') {
                    constraintParts.push(
                        t('validation.min', {
                            defaultValue: 'Min: {{min}}',
                            min: rules.min
                        })
                    )
                } else if (typeof rules?.max === 'number') {
                    constraintParts.push(
                        t('validation.max', {
                            defaultValue: 'Max: {{max}}',
                            max: rules.max
                        })
                    )
                }
                if (rules?.nonNegative) {
                    constraintParts.push(t('validation.nonNegativeOnly', 'Non-negative only'))
                }

                const numberHelperText = fieldError ?? constraintParts.join(', ')

                // Zone-aware stepper: integer zone → step 1, decimal zone → step 10^(-scale)
                const numberRules = toNumberRules(rules)
                const getStepValue = (zone?: 'integer' | 'decimal') => {
                    if (scale <= 0) return 1
                    return zone === 'decimal' ? Math.pow(10, -scale) : 1
                }
                const handleStepUp = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current + step).toFixed(scale))
                    if (typeof rules?.max === 'number' && next > rules.max) next = rules.max
                    if (!validateNumber(next, numberRules).valid) return
                    handleFieldChange(field.id, next)
                }
                const handleStepDown = (zone?: 'integer' | 'decimal') => {
                    const effectiveZone = zone ?? numberCursorZoneRef.current.get(field.id) ?? 'integer'
                    const step = getStepValue(effectiveZone)
                    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
                    let next = Number((current - step).toFixed(scale))
                    if (rules?.nonNegative && next < 0) next = 0
                    if (typeof rules?.min === 'number' && next < rules.min) next = rules.min
                    if (!validateNumber(next, numberRules).valid) return
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
                if (field.refTargetEntityKind === 'enumeration' && Array.isArray(field.enumOptions)) {
                    const options = field.refOptions && field.refOptions.length > 0 ? field.refOptions : field.enumOptions
                    const mode = field.enumPresentationMode ?? 'select'
                    const selectedOption = options.find((option) => option.id === value)
                    const allowEmpty = field.enumAllowEmpty !== false
                    const emptyDisplay = field.enumLabelEmptyDisplay === 'empty' ? 'empty' : 'dash'

                    if (mode === 'label') {
                        return (
                            <Stack spacing={0.5}>
                                <Typography variant='body2' color='text.secondary'>
                                    {field.label}
                                </Typography>
                                <Typography variant='body1'>{selectedOption?.label ?? (emptyDisplay === 'empty' ? '' : '—')}</Typography>
                                {helperText ? <FormHelperText error={Boolean(fieldError)}>{helperText}</FormHelperText> : null}
                            </Stack>
                        )
                    }

                    if (mode === 'radio') {
                        return (
                            <FormControl error={Boolean(fieldError)} required={field.required} disabled={disabled}>
                                <Typography variant='body2' sx={{ mb: 0.5 }}>
                                    {field.label}
                                </Typography>
                                <RadioGroup
                                    value={typeof value === 'string' ? value : ''}
                                    onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                >
                                    {options.map((option) => (
                                        <FormControlLabel
                                            key={option.id}
                                            value={option.id}
                                            control={<Radio size='small' />}
                                            label={option.label}
                                        />
                                    ))}
                                </RadioGroup>
                                {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                            </FormControl>
                        )
                    }

                    return (
                        <FormControl fullWidth error={Boolean(fieldError)}>
                            <InputLabel id={`${field.id}-enum-select-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-enum-select-label`}
                                value={typeof value === 'string' ? value : ''}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && allowEmpty && <MenuItem value=''> </MenuItem>}
                                {!allowEmpty && <MenuItem value='' sx={{ display: 'none' }} />}
                                {options.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

                if (Array.isArray(field.refOptions) && field.refOptions.length > 0) {
                    return (
                        <FormControl fullWidth error={Boolean(fieldError)}>
                            <InputLabel id={`${field.id}-ref-select-label`}>{field.label}</InputLabel>
                            <Select
                                labelId={`${field.id}-ref-select-label`}
                                value={typeof value === 'string' ? value : ''}
                                label={field.label}
                                onChange={(event) => handleFieldChange(field.id, event.target.value || null)}
                                required={field.required}
                                disabled={disabled}
                                sx={{ bgcolor: 'background.default' }}
                                MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}
                            >
                                {!field.required && <MenuItem value=''> </MenuItem>}
                                {field.refOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
                        </FormControl>
                    )
                }

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
                const tableValue = (formData[field.id] as Record<string, unknown>[]) ?? []
                const tableShowTitle = field.tableUiConfig?.showTitle !== false
                const tableMinRows = field.validationRules?.minRows as number | undefined
                const tableMaxRows = field.validationRules?.maxRows as number | undefined
                const rowCount = tableValue.length

                const { helperText: tableHelperText, isMissing: checkMissing } = buildTableConstraintText({
                    required: field.required, minRows: tableMinRows, maxRows: tableMaxRows, t
                })
                const tableMissing = checkMissing(rowCount)

                // EDIT mode: inline editor with deferred persistence (commit on form Save)
                if (editRowId && apiBaseUrl && applicationId && catalogId) {
                    return (
                        <Box>
                            <RuntimeInlineTabularEditor
                                apiBaseUrl={apiBaseUrl}
                                applicationId={applicationId}
                                catalogId={catalogId}
                                parentRecordId={editRowId}
                                attributeId={field.attributeId ?? field.id}
                                childFields={childFieldDefs}
                                showTitle={tableShowTitle}
                                label={field.label}
                                locale={locale}
                                deferPersistence
                                onChange={(rows) => handleFieldChange(field.id, rows)}
                                minRows={tableMinRows}
                                maxRows={tableMaxRows}
                            />
                            {tableHelperText && (
                                <Typography
                                    variant='caption'
                                    color={tableMissing ? 'error' : 'text.secondary'}
                                    sx={{ mt: 0.5, ml: 1.75 }}
                                >
                                    {tableHelperText}
                                </Typography>
                            )}
                        </Box>
                    )
                }

                // CREATE mode: inline local editor
                if (childFieldDefs.length > 0) {
                    return (
                        <Box>
                            <TabularPartEditor
                                label={field.label}
                                value={tableValue}
                                onChange={(rows) => handleFieldChange(field.id, rows)}
                                childFields={childFieldDefs}
                                showTitle={tableShowTitle}
                                locale={locale}
                                minRows={tableMinRows}
                                maxRows={tableMaxRows}
                            />
                            {tableHelperText && (
                                <Typography
                                    variant='caption'
                                    color={tableMissing ? 'error' : 'text.secondary'}
                                    sx={{ mt: 0.5, ml: 1.75 }}
                                >
                                    {tableHelperText}
                                </Typography>
                            )}
                        </Box>
                    )
                }

                // Fallback: no child fields configured
                return (
                    <Box sx={{ py: 1, px: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                        <Typography variant='body2' color='text.secondary'>
                            {field.label}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                            {t('table.editAfterSave', 'Table data can be edited after saving the record.')}
                        </Typography>
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

export default FormDialog
