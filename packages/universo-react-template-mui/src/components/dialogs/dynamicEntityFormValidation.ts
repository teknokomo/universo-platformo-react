import type { VersionedLocalizedContent } from '@universo-react/types'

interface DynamicFieldValidationConfig {
    type: string
    required?: boolean
    validationRules?: {
        localized?: boolean
        requiredLocales?: readonly string[]
        requiredWhen?: { field: string; equals: string | number | boolean }
    }
}

export const normalizeLocale = (locale?: string) => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

export const isLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const hasLocalizedLocaleValue = (value: unknown, locale: string): boolean => {
    if (!isLocalizedContent(value)) return false
    const entry = value.locales[normalizeLocale(locale)]
    return typeof entry?.content === 'string' && entry.content.trim() !== ''
}

export const hasAnyLocalizedContent = (value: VersionedLocalizedContent<string>) =>
    Object.values(value.locales ?? {}).some((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')

export const getMissingRequiredLocale = (field: DynamicFieldValidationConfig, value: unknown): string | null => {
    const hasAuthoredLocalizedContent = isLocalizedContent(value) && hasAnyLocalizedContent(value)
    if (field.type !== 'STRING' || (!field.required && !hasAuthoredLocalizedContent) || field.validationRules?.localized !== true) {
        return null
    }
    return field.validationRules.requiredLocales?.find((locale) => !hasLocalizedLocaleValue(value, locale)) ?? null
}

export const resolveEffectiveField = <T extends DynamicFieldValidationConfig>(
    field: T,
    values: Record<string, unknown>
): T | (Omit<T, 'required'> & { required: boolean }) => {
    const condition = field.validationRules?.requiredWhen
    if (!condition) return field
    return { ...field, required: field.required === true || values[condition.field] === condition.equals }
}

export const buildFormDataSignature = (values: Record<string, unknown>): string => {
    const comparable: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
        if (key.startsWith('_') || (isLocalizedContent(value) && !hasAnyLocalizedContent(value))) continue
        comparable[key] = value
    }
    return JSON.stringify(Object.fromEntries(Object.entries(comparable).sort(([left], [right]) => left.localeCompare(right))))
}
