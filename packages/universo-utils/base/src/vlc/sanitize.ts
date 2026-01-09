import type { VersionedLocalizedContent, LocaleCode } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'
import { createLocalizedContent, updateLocalizedContentLocale } from './index'

/**
 * Sanitize and normalize localized input from API requests.
 * - Trims whitespace from values
 * - Normalizes locale codes (en_US -> en-US)
 * - Filters out empty values and invalid locale codes
 *
 * @param input - Raw localized input object from API request
 * @returns Sanitized record with valid locale codes and trimmed values
 */
export const sanitizeLocalizedInput = (input: Record<string, string | undefined>): Record<LocaleCode, string> => {
    const sanitized: Record<string, string> = {}

    for (const [locale, value] of Object.entries(input)) {
        if (typeof value !== 'string') continue

        const trimmedValue = value.trim()
        if (!trimmedValue) continue

        const normalized = locale.trim().replace(/_/g, '-')
        const [lang, region] = normalized.split('-')
        const normalizedCode = region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase()

        if (!isValidLocaleCode(normalizedCode)) continue
        sanitized[normalizedCode] = trimmedValue
    }

    return sanitized
}

/**
 * Build VersionedLocalizedContent from sanitized input.
 * Used by backend routes to create VLC structures for database storage.
 *
 * @param input - Sanitized localized input (use sanitizeLocalizedInput first)
 * @param primaryLocale - Preferred primary locale
 * @param fallbackPrimary - Fallback if primaryLocale has no content
 * @returns VLC structure or undefined if input is empty
 */
export const buildLocalizedContent = (
    input: Record<string, string>,
    primaryLocale?: string,
    fallbackPrimary?: string
): VersionedLocalizedContent<string> | undefined => {
    const localeCodes = Object.keys(input).sort()
    if (localeCodes.length === 0) return undefined

    const primaryCandidate =
        primaryLocale && input[primaryLocale] ? primaryLocale : fallbackPrimary && input[fallbackPrimary] ? fallbackPrimary : undefined

    const primary = primaryCandidate ?? localeCodes[0]
    let content = createLocalizedContent(primary, input[primary] ?? '')

    for (const locale of localeCodes) {
        if (locale === primary) continue
        const value = input[locale]
        if (typeof value !== 'string') continue
        content = updateLocalizedContentLocale(content, locale, value)
    }

    return content
}
