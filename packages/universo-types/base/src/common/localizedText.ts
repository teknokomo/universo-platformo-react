export type LocalizedTextRecord = {
    _primary?: unknown
    locales?: Record<string, { content?: unknown } | unknown>
    en?: unknown
    ru?: unknown
}

const normalizeLocale = (locale: string | null | undefined): string => locale?.split(/[-_]/)[0]?.trim().toLowerCase() || 'en'

const readString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const text = value.trim()
    return text || undefined
}

const readLocaleEntry = (entry: unknown): string | undefined => {
    if (typeof entry === 'string') return readString(entry)
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
    return readString((entry as { content?: unknown }).content)
}

const readLocaleMapValue = (record: LocalizedTextRecord, locale: string): string | undefined => {
    const fromLocales = record.locales?.[locale]
    if (fromLocales !== undefined) return readLocaleEntry(fromLocales)
    return readString((record as Record<string, unknown>)[locale])
}

export const readLocalizedTextValue = (
    value: unknown,
    locale = 'en',
    fallbackLocales: readonly string[] = ['en', 'ru']
): string | undefined => {
    if (typeof value === 'string') return readString(value)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

    const record = value as LocalizedTextRecord
    const normalizedLocale = normalizeLocale(locale)
    const primaryLocale = normalizeLocale(readString(record._primary) ?? 'en')
    const orderedLocales = [
        normalizedLocale,
        primaryLocale,
        ...fallbackLocales.map((fallbackLocale) => normalizeLocale(fallbackLocale))
    ].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index)

    for (const candidate of orderedLocales) {
        const text = readLocaleMapValue(record, candidate)
        if (text) return text
    }

    for (const entry of Object.values(record.locales ?? {})) {
        const text = readLocaleEntry(entry)
        if (text) return text
    }

    return undefined
}

export const isLocalizedTextValue = (value: unknown): boolean => readLocalizedTextValue(value) !== undefined
