import { getVLCString } from '@universo-react/utils/vlc'

/** Normalize locale tags in the same way as the runtime metadata boundary. */
export const normalizeLocale = (locale?: string): string => {
    if (!locale) return 'en'
    return locale.split('-')[0].split('_')[0].toLowerCase()
}

/** Resolve the runtime's supported localized-content shapes with a stable fallback. */
export const resolveLocalizedContent = (value: unknown, locale: string, fallback: string): string => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : fallback
    }

    if (value && typeof value === 'object') {
        const normalizedLocale = normalizeLocale(locale)
        const localized = getVLCString(value as Record<string, unknown>, normalizedLocale)
        if (localized && localized.trim().length > 0) {
            return localized
        }

        const plain = value as Record<string, unknown>
        const direct = plain[normalizedLocale]
        if (typeof direct === 'string' && direct.trim().length > 0) {
            return direct
        }
        const en = plain.en
        if (typeof en === 'string' && en.trim().length > 0) {
            return en
        }
    }

    return fallback
}
