/** Resolve the text value used for runtime codenames stored as strings or VLCs. */
export const resolveRuntimeCodenameText = (codename: unknown): string => {
    if (typeof codename === 'string') {
        return codename
    }

    if (codename && typeof codename === 'object') {
        const localized = codename as {
            _primary?: string
            locales?: Record<string, { content?: string }>
        }
        const primaryLocale = typeof localized._primary === 'string' ? localized._primary : 'en'
        const primaryValue = localized.locales?.[primaryLocale]?.content
        if (typeof primaryValue === 'string' && primaryValue.trim().length > 0) {
            return primaryValue
        }

        const englishValue = localized.locales?.en?.content
        if (typeof englishValue === 'string' && englishValue.trim().length > 0) {
            return englishValue
        }

        for (const entry of Object.values(localized.locales ?? {})) {
            if (typeof entry?.content === 'string' && entry.content.trim().length > 0) {
                return entry.content
            }
        }
    }

    return ''
}
