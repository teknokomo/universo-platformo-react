import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Simple localized input format for forms
 * Used when creating/updating entities via API
 */
export interface SimpleLocalizedInput {
    [key: string]: string | undefined
    en?: string
    ru?: string
}

/**
 * Normalize locale string to base language code
 * @example normalizeLocale('en-US') => 'en'
 */
export const normalizeLocale = (locale?: string): string => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

/**
 * Get value from SimpleLocalizedInput with fallback chain
 * Tries: requested locale → 'en' → 'ru' → any non-empty value
 */
export const getSimpleLocalizedValue = (field: SimpleLocalizedInput, locale = 'en'): string => {
    const normalized = normalizeLocale(locale)
    const localized = field[normalized]
    if (typeof localized === 'string' && localized.trim() !== '') return localized
    if (typeof field.en === 'string' && field.en.trim() !== '') return field.en
    if (typeof field.ru === 'string' && field.ru.trim() !== '') return field.ru
    const fallback = Object.values(field).find((value) => typeof value === 'string' && value.trim() !== '')
    return typeof fallback === 'string' ? fallback : ''
}

/**
 * VersatileLocalizedContent structure as returned by backend
 * Simplified version for frontend use - can be either full VLC or simple object
 */
export interface VersatileLocalizedContent {
    _schema?: string
    locales?: Record<string, { content: string }>
    _primary?: string
}

/**
 * Extract localized string from versatile localized content formats
 *
 * Handles:
 * - Full VLC format (VersionedLocalizedContent with locales object)
 * - Simple localized input (SimpleLocalizedInput with locale keys)
 * - Plain strings (pass-through)
 *
 * @param field - Localized content in any supported format
 * @param locale - Requested locale (default: 'en')
 * @returns Extracted string or empty string if not found
 *
 * @example
 * // With VLC format
 * const name = getVLCString(entity.name, 'ru') // 'Название'
 *
 * // With simple input
 * const desc = getVLCString({ en: 'Hello', ru: 'Привет' }, 'ru') // 'Привет'
 *
 * // With plain string
 * const text = getVLCString('plain text', 'en') // 'plain text'
 */
export function getVLCString(
    field: VersionedLocalizedContent<string> | VersatileLocalizedContent | SimpleLocalizedInput | string | undefined | null,
    locale = 'en'
): string {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (typeof field !== 'object') return ''

    // Check for VLC format with locales object containing content entries
    if ('locales' in field && field.locales && typeof field.locales === 'object') {
        const normalized = normalizeLocale(locale)
        const primary = typeof field._primary === 'string' ? field._primary : undefined

        // Try requested locale first
        const entry = field.locales[normalized]
        if (entry && typeof entry.content === 'string') {
            return entry.content
        }

        // Try primary locale
        if (primary && field.locales[primary]) {
            const primaryEntry = field.locales[primary]
            if (primaryEntry && typeof primaryEntry.content === 'string') {
                return primaryEntry.content
            }
        }

        // Try any available locale
        for (const localeEntry of Object.values(field.locales)) {
            if (localeEntry && typeof localeEntry.content === 'string') {
                return localeEntry.content
            }
        }

        return ''
    }

    // Fall back to SimpleLocalizedInput format
    return getSimpleLocalizedValue(field as SimpleLocalizedInput, locale)
}

/**
 * Get localized string with explicit fallback chain
 * Convenience wrapper that tries current locale, then 'en', then codename
 *
 * @param field - Localized content
 * @param locale - Requested locale
 * @param fallback - Fallback value if nothing found
 */
export function getVLCStringWithFallback(
    field: VersionedLocalizedContent<string> | VersatileLocalizedContent | SimpleLocalizedInput | string | undefined | null,
    locale: string,
    fallback: string
): string {
    const result = getVLCString(field, locale)
    if (result) return result

    // Try English as fallback
    if (locale !== 'en') {
        const enResult = getVLCString(field, 'en')
        if (enResult) return enResult
    }

    return fallback
}
