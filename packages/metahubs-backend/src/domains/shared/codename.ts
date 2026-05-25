type LocaleCode = string

type CodenameLocaleEntry = {
    content?: string
    version?: number
    isActive?: boolean
    createdAt?: string
    updatedAt?: string
}

type CodenameLike = {
    _schema?: string
    _primary?: string
    locales?: Record<string, CodenameLocaleEntry>
}

export const DEFAULT_CODENAME_LOCALE: LocaleCode = 'en'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const codenamePrimaryTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const buildCodenameValue = (locale: LocaleCode, codename: string): CodenameLike => {
    const now = new Date().toISOString()

    return {
        _schema: '1',
        _primary: locale,
        locales: {
            [locale]: {
                content: codename,
                version: 1,
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        }
    }
}

export const ensureCodenameValue = (value: unknown, locale: LocaleCode = DEFAULT_CODENAME_LOCALE): CodenameLike => {
    if (value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>)) {
        return value as CodenameLike
    }
    if (typeof value === 'string') {
        return buildCodenameValue(locale, value)
    }
    return buildCodenameValue(locale, '')
}

export const getCodenameText = (value: unknown, locale: LocaleCode = DEFAULT_CODENAME_LOCALE): string => {
    if (typeof value === 'string') {
        return value
    }

    const codename = ensureCodenameValue(value, locale)
    const primaryLocale = codename._primary || locale
    return codename.locales?.[primaryLocale]?.content || codename.locales?.en?.content || ''
}
