// English comments per project guidelines.
// Centralized date formatting utility using dayjs (replaces moment.js).
// Supports i18n integration and multiple format patterns.

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import 'dayjs/locale/ru'
import 'dayjs/locale/en'

// Initialize dayjs plugins
dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(advancedFormat)

// Fallback i18n object for isolated environments
const FALLBACK_I18N = { language: 'en' }

// i18n instance interface
interface I18nInstance {
    language: string
}

// Format options interface
interface FormatOptions {
    i18n?: I18nInstance
}

// Pattern type union
type FormatPattern = 'full' | 'short' | 'date' | 'time' | 'iso' | 'relative'

/**
 * Resolves i18n instance with priority fallback chain.
 * @param overrideI18n - Optional i18n instance override
 * @returns i18n instance with `language` property
 */
function resolveI18nInstance(overrideI18n?: I18nInstance): I18nInstance {
    // Priority 1: Explicit override (for future extensibility)
    if (overrideI18n?.language) {
        return overrideI18n
    }

    // Priority 2: Global instance (main path in browser)
    if (typeof globalThis !== 'undefined' && (globalThis as any).__universo_i18n__instance) {
        return (globalThis as any).__universo_i18n__instance
    }

    // Priority 3: Hardcoded fallback
    return FALLBACK_I18N
}

// Map of pattern keys to dayjs format tokens (fallback). Using localized tokens when possible.
const FORMAT_MAP: Record<string, string | undefined> = {
    full: 'lll', // e.g. localized "Sep 15, 2025 2:23 PM" (lowercase for dayjs)
    short: 'YYYY-MM-DD HH:mm',
    date: 'll', // e.g. localized "Sep 15, 2025" (lowercase for dayjs)
    time: 'HH:mm:ss',
    iso: undefined // special case -> ISO string
}

/**
 * formatDate - returns localized formatted date string.
 * @param dateInput - date source (Date, string, number, or falsy)
 * @param pattern - one of keys in FORMAT_MAP or 'relative'
 * @param langOverride - optional language override (e.g., 'en', 'ru')
 * @param options - optional configuration
 * @returns formatted date string or empty string if invalid
 */
export function formatDate(
    dateInput: Date | string | number | undefined | null,
    pattern: FormatPattern = 'full',
    langOverride?: string,
    options: FormatOptions = {}
): string {
    if (!dateInput) return ''

    // Resolve i18n instance with fallback chain
    const i18n = resolveI18nInstance(options.i18n)
    const lang = langOverride || i18n.language || 'en'

    dayjs.locale(lang)
    const d = dayjs(dateInput)
    if (!d.isValid()) return ''

    if (pattern === 'relative') return d.fromNow()
    if (pattern === 'iso') return d.toISOString()

    const fmt = FORMAT_MAP[pattern] || FORMAT_MAP.full
    return d.format(fmt)
}

/**
 * formatRange - simple range formatting (no timezone normalization).
 * @param start - start date
 * @param end - end date
 * @param pattern - format pattern
 * @param langOverride - optional language override
 * @param options - optional configuration
 * @returns formatted date range string (e.g., "Jan 1, 2025 – Jan 31, 2025")
 */
export function formatRange(
    start: Date | string | number | undefined | null,
    end: Date | string | number | undefined | null,
    pattern: FormatPattern = 'short',
    langOverride?: string,
    options: FormatOptions = {}
): string {
    if (!start || !end) return ''
    return `${formatDate(start, pattern, langOverride, options)} – ${formatDate(end, pattern, langOverride, options)}`
}

export default formatDate
