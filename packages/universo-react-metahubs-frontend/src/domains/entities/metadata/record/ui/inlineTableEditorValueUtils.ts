import { createLocalizedContent, toNumberRules, validateNumber } from '@universo-react/utils'
import type { DynamicFieldConfig } from '@universo-react/template-mui'

export type InlineTableEnumOption = { id: string; label: string }
export type InlineTableEnumMode = 'select' | 'radio' | 'label'

/** Retrieve a stable identifier for a row. */
export function getInlineTableRowId(row: Record<string, unknown>, index: number): string {
    return String(row._localId ?? row.id ?? `__local_${index}`)
}

/** Extract a readable string from a localized value or scalar. */
export function extractInlineTableDisplayString(value: unknown, locale: string): string {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object' && 'locales' in value) {
        const vlc = value as { locales: Record<string, { content?: string }>; _primary?: string }
        const normalizedLocale = locale.split(/[-_]/)[0].toLowerCase()
        const entry = vlc.locales?.[normalizedLocale]
        if (typeof entry?.content === 'string') return entry.content
        const primary = vlc._primary
        if (primary && vlc.locales?.[primary]?.content) return vlc.locales[primary].content as string
        for (const localeEntry of Object.values(vlc.locales ?? {})) {
            if (typeof localeEntry?.content === 'string' && localeEntry.content) return localeEntry.content
        }
        return ''
    }
    return ''
}

/** Build a localized value for a plain-string child field. */
export function toInlineTableLocalizedValue(value: string, locale: string): Record<string, unknown> {
    return createLocalizedContent(locale.split(/[-_]/)[0].toLowerCase(), value)
}

export function isInlineTableLocalizedField(field: DynamicFieldConfig): boolean {
    return field.type === 'STRING' && Boolean(field.validationRules?.versioned || field.validationRules?.localized)
}

/** Validate a number against the field's configured precision and range rules. */
export function validateInlineTableNumber(value: number, rules?: Record<string, unknown>): string | null {
    if (!rules) return null
    const result = validateNumber(value, toNumberRules(rules))
    return result.valid ? null : result.errorKey ?? 'invalid'
}

export function resolveInlineTableEnumMode(mode: DynamicFieldConfig['enumPresentationMode']): InlineTableEnumMode {
    if (mode === 'radio' || mode === 'label') return mode
    return 'select'
}

export function resolveInlineTableOptionCount(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback
}

export function resolveInlineTableSelectedEnumValue(
    rawValue: unknown,
    defaultValueId: string | null,
    options: InlineTableEnumOption[],
    allowEmpty: boolean,
    required: boolean,
    mode: InlineTableEnumMode
): string | null {
    const explicitValue = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null
    if (explicitValue) return explicitValue
    if (defaultValueId && options.some((option) => option.id === defaultValueId)) return defaultValueId
    if (mode === 'select' && allowEmpty && !required) return ''
    if (mode === 'radio') return ''
    return null
}
