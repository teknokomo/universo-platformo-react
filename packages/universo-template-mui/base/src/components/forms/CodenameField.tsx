import React, { useCallback, useMemo } from 'react'
import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent } from '@universo/utils'
import { sanitizeCodename } from '@universo/utils/validation/codename'
import { LocalizedInlineField } from './LocalizedInlineField'

const normalizeLocale = (locale?: string): string => (locale || 'en').split('-')[0] || 'en'

/** Check if a VLC value has non-empty content in its primary locale. */
const hasNonEmptyPrimary = (value: VersionedLocalizedContent<string> | null | undefined): boolean => {
    if (!value) return false
    const primary = value._primary
    const content = primary ? value.locales?.[primary]?.content : ''
    return typeof content === 'string' && content.length > 0
}

export interface CodenameFieldProps {
    /** Current codename value */
    value: VersionedLocalizedContent<string> | null
    /** Called when codename changes */
    onChange: (value: VersionedLocalizedContent<string> | null) => void
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
    /** UI locale used by localized editor */
    uiLocale?: string
    /** Optional blur normalizer override. Defaults to sanitizeCodename for backward compatibility. */
    normalizeOnBlur?: (value: string) => string
    /** Whether localized (multi-locale) codenames are enabled. When false, shows single-locale field without language switching. Defaults to true. */
    localizedEnabled?: boolean
}

/**
 * Reusable VLC-only Codename field with auto-normalization on blur.
 *
 * Uses autoInitialize={false} on the underlying LocalizedInlineField and provides
 * a guaranteed non-null effectiveValue to avoid infinite re-init loops when paired
 * with useCodenameAutoFillVlc (which may set codename back to null).
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
    uiLocale,
    normalizeOnBlur,
    localizedEnabled = true
}) => {
    // Always provide a valid VLC so LocalizedInlineField never fires its auto-init effect.
    const effectiveValue = useMemo(
        () => value ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
        [value, uiLocale]
    )

    // Only mark as "touched" when user types actual content (non-empty primary).
    // This prevents auto-init from marking the field as touched.
    const handleLocalizedChange = useCallback(
        (nextValue: VersionedLocalizedContent<string>) => {
            onChange(nextValue)
            if (!touched && hasNonEmptyPrimary(nextValue)) {
                onTouchedChange(true)
            }
        },
        [onChange, touched, onTouchedChange]
    )

    const effectiveNormalizeOnBlur = useCallback(
        (rawValue: string) => (normalizeOnBlur ? normalizeOnBlur(rawValue) : sanitizeCodename(rawValue)),
        [normalizeOnBlur]
    )

    return (
        <LocalizedInlineField
            mode={localizedEnabled ? 'localized' : 'versioned'}
            label={label}
            value={effectiveValue}
            onChange={handleLocalizedChange}
            required={required}
            disabled={disabled}
            error={error || null}
            helperText={error || helperText}
            uiLocale={uiLocale}
            normalizeOnBlur={effectiveNormalizeOnBlur}
            maxLength={100}
            autoInitialize={false}
        />
    )
}

export default CodenameField
