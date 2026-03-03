import React from 'react'
import { TextField, TextFieldProps } from '@mui/material'
import { sanitizeCodename } from '@universo/utils/validation/codename'
import type { VersionedLocalizedContent } from '@universo/types'
import { LocalizedInlineField } from './LocalizedInlineField'

export interface CodenameFieldProps {
    /** Current codename value */
    value: string
    /** Called when codename changes */
    onChange: (value: string) => void
    /** Whether the user has manually touched/edited the codename */
    touched: boolean
    /** Called when touched state should change */
    onTouchedChange: (touched: boolean) => void
    /** Field label */
    label: string
    /** Helper text shown below the field */
    helperText?: string
    /** Error message (overrides helperText) */
    error?: string
    /** Whether the field is disabled */
    disabled?: boolean
    /** Whether the field is required */
    required?: boolean
    /** Enables localized VLC mode for codename input */
    localizedEnabled?: boolean
    /** Current localized codename value (used when localizedEnabled=true) */
    localizedValue?: VersionedLocalizedContent<string> | null
    /** Called when localized codename changes (used when localizedEnabled=true) */
    onLocalizedChange?: (value: VersionedLocalizedContent<string> | null) => void
    /** UI locale used by localized editor */
    uiLocale?: string
    /** Optional blur normalizer override. Defaults to sanitizeCodename for backward compatibility. */
    normalizeOnBlur?: (value: string) => string
    /** Additional TextField props */
    textFieldProps?: Partial<Omit<TextFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'error' | 'disabled' | 'required'>>
}

/**
 * Reusable Codename field with auto-normalization on blur.
 * Use together with useCodenameAutoFill hook for auto-fill from name.
 *
 * Features:
 * - Auto-normalizes value on blur using sanitizeCodename (handles transliteration)
 * - Tracks "touched" state to prevent overwriting user edits
 * - Integrates with form validation via error prop
 *
 * @example
 * ```tsx
 * import { CodenameField, useCodenameAutoFill } from '@universo/template-mui'
 *
 * const [codename, setCodename] = useState('')
 * const [touched, setTouched] = useState(false)
 *
 * useCodenameAutoFill({ codename, codenameTouched: touched, ... })
 *
 * <CodenameField
 *   value={codename}
 *   onChange={setCodename}
 *   touched={touched}
 *   onTouchedChange={setTouched}
 *   label={t('codename')}
 * />
 * ```
 */
export const CodenameField: React.FC<CodenameFieldProps> = ({
    value,
    onChange,
    touched,
    onTouchedChange,
    label,
    helperText,
    error,
    disabled = false,
    required = false,
    localizedEnabled = false,
    localizedValue,
    onLocalizedChange,
    uiLocale,
    normalizeOnBlur,
    textFieldProps
}) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value)
        if (!touched) {
            onTouchedChange(true)
        }
    }

    const handleBlur = () => {
        const normalized = normalizeOnBlur ? normalizeOnBlur(value) : sanitizeCodename(value)
        if (normalized && normalized !== value) {
            onChange(normalized)
        }
    }

    const handleLocalizedChange = (nextValue: VersionedLocalizedContent<string>) => {
        onLocalizedChange?.(nextValue)
        const primaryLocale = nextValue?._primary
        const primaryContent =
            primaryLocale && nextValue?.locales?.[primaryLocale] && typeof nextValue.locales[primaryLocale]?.content === 'string'
                ? nextValue.locales[primaryLocale]?.content
                : ''
        onChange(primaryContent ?? '')
        if (!touched) {
            onTouchedChange(true)
        }
    }

    if (localizedEnabled && onLocalizedChange) {
        return (
            <LocalizedInlineField
                mode='localized'
                label={label}
                required={required}
                disabled={disabled}
                value={localizedValue ?? null}
                onChange={handleLocalizedChange}
                error={error || null}
                helperText={error || helperText}
                uiLocale={uiLocale}
                normalizeOnBlur={(rawValue) => (normalizeOnBlur ? normalizeOnBlur(rawValue) : sanitizeCodename(rawValue))}
                maxLength={100}
            />
        )
    }

    return (
        <TextField
            label={label}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            fullWidth
            required={required}
            disabled={disabled}
            error={Boolean(error)}
            helperText={error || helperText}
            {...textFieldProps}
        />
    )
}

export default CodenameField
