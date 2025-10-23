// English comments per project guidelines.
// Minimal localized date formatting helper.
import moment from 'moment'
import { getInstance as getI18nInstance } from '@universo/i18n'

// Fallback i18n object for isolated environments
const FALLBACK_I18N = { language: 'en' }

/**
 * Resolves i18n instance with priority fallback chain.
 * @param {object} [overrideI18n] - Optional i18n instance override
 * @returns {object} i18n instance with `language` property
 */
function resolveI18nInstance(overrideI18n) {
    // Priority 1: Explicit override (for future extensibility)
    if (overrideI18n?.language) {
        return overrideI18n
    }

    // Priority 2: Global instance (main path in browser)
    if (typeof globalThis !== 'undefined' && globalThis.__universo_i18n__instance) {
        return globalThis.__universo_i18n__instance
    }

    // Priority 3: Lazy initialization via getInstance
    try {
        const instance = getI18nInstance()
        if (instance?.language) {
            return instance
        }
    } catch (error) {
        // Silent fallback if @universo/i18n not available
    }

    // Priority 4: Hardcoded fallback
    return FALLBACK_I18N
}

// Map of pattern keys to moment format tokens (fallback). Using localized tokens L/LLL when possible.
const FORMAT_MAP = {
    full: 'LLL', // e.g. localized "September 15, 2025 14:23"
    short: 'YYYY-MM-DD HH:mm',
    date: 'LL',
    time: 'HH:mm:ss',
    iso: undefined // special case -> ISO string
}

/**
 * formatDate - returns localized formatted date string.
 * @param {Date|string|number} dateInput - date source
 * @param {string} [pattern='full'] - one of keys in FORMAT_MAP
 * @param {string} [langOverride] - optional language override
 * @param {object} [options] - optional configuration
 * @param {object} [options.i18n] - optional i18n instance override
 * @returns {string} formatted date string
 */
export function formatDate(dateInput, pattern = 'full', langOverride, options = {}) {
    if (!dateInput) return ''

    // Resolve i18n instance with fallback chain
    const i18n = resolveI18nInstance(options.i18n)
    const lang = langOverride || i18n.language || 'en'

    moment.locale(lang)
    const m = moment(dateInput)
    if (!m.isValid()) return ''

    if (pattern === 'relative') return m.fromNow()
    if (pattern === 'iso') return m.toISOString()

    const fmt = FORMAT_MAP[pattern] || FORMAT_MAP.full
    return m.format(fmt)
}

/**
 * formatRange - simple range formatting (no timezone normalization here).
 * @param {Date|string|number} start - start date
 * @param {Date|string|number} end - end date
 * @param {string} [pattern='short'] - format pattern
 * @param {string} [langOverride] - optional language override
 * @param {object} [options] - optional configuration
 * @param {object} [options.i18n] - optional i18n instance override
 * @returns {string} formatted date range string
 */
export function formatRange(start, end, pattern = 'short', langOverride, options = {}) {
    if (!start || !end) return ''
    return `${formatDate(start, pattern, langOverride, options)} – ${formatDate(end, pattern, langOverride, options)}`
}

export default formatDate
