import { createLocalizedContent, updateLocalizedContentLocale } from '@universo-react/utils'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export const readName = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    const locales = record.locales
    if (!locales || typeof locales !== 'object') return ''
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const primary = typeof record._primary === 'string' ? record._primary : normalizedLocale
    const entries = locales as Record<string, { content?: unknown }>
    const candidates = [normalizedLocale, primary, 'en']
    for (const candidate of candidates) {
        const content = entries[candidate]?.content
        if (typeof content === 'string' && content.trim()) return content
    }
    for (const entry of Object.values(entries)) {
        if (typeof entry?.content === 'string' && entry.content.trim()) return entry.content
    }
    return ''
}

export const normalizeLocale = (locale: string): 'en' | 'ru' => (locale.split(/[-_]/)[0]?.toLowerCase() === 'ru' ? 'ru' : 'en')

export const isLocalizedRecord = (
    value: unknown
): value is {
    _schema?: unknown
    _primary?: unknown
    locales?: Record<string, { content?: unknown }>
} => Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const ensureLocalizedString = (value: unknown, locale: string) => {
    if (isLocalizedRecord(value) && value._schema === '1') return value
    return createLocalizedContent(normalizeLocale(locale), typeof value === 'string' ? value : readName(value, locale))
}

export const appendCopySuffixToLocalizedValue = (value: unknown, fallback: string, locale: string): unknown => {
    const suffixForLocale = (localeCode: string) => (localeCode.toLowerCase().startsWith('ru') ? ' (копия)' : ' (copy)')
    if (!isLocalizedRecord(value) || value._schema !== '1') {
        return createLocalizedContent(normalizeLocale(locale), `${fallback}${appendCopySuffix('', locale)}`)
    }

    const primary = typeof value._primary === 'string' ? value._primary : normalizeLocale(locale)
    let next = value as ReturnType<typeof createLocalizedContent>
    const locales = value.locales ?? {}
    for (const [localeCode, entry] of Object.entries(locales)) {
        const content = typeof entry?.content === 'string' ? entry.content : ''
        next = updateLocalizedContentLocale(next, localeCode as 'en' | 'ru', `${content}${suffixForLocale(localeCode)}`)
    }

    if (Object.keys(locales).length === 0) {
        return createLocalizedContent(normalizeLocale(locale), `${fallback}${appendCopySuffix('', locale)}`)
    }

    return {
        ...next,
        _primary: primary
    }
}

export const readInputChangeValue = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const target = (value as { target?: { value?: unknown } }).target
    return typeof target?.value === 'string' ? target.value : ''
}

export const readWorkspaceRoleChangeValue = (value: unknown): 'owner' | 'member' => {
    const role = readInputChangeValue(value)
    return role === 'owner' ? 'owner' : 'member'
}

export const resolveWorkspaceRoleLabel = (roleCodename: string, translate: (key: string, fallback: string) => string): string => {
    if (roleCodename === 'owner') return translate('workspace.roleOwner', 'Owner')
    if (roleCodename === 'admin') return translate('workspace.roleAdmin', 'Application administrator')
    return translate('workspace.roleMember', 'Member')
}

export const appendCopySuffix = (value: string, locale: string): string => `${value} ${locale.startsWith('ru') ? '(копия)' : '(copy)'}`

export const toPagination = (limit: number, offset: number, total: number) => {
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(1, Math.ceil(total / limit))
    return {
        currentPage,
        pageSize: limit,
        totalItems: total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
    }
}

export const toPaginationActions = (
    limit: number,
    offset: number,
    setLimit: (limit: number) => void,
    setOffset: (offset: number) => void,
    setSearch: (search: string) => void
) => ({
    goToPage: (page: number) => setOffset((page - 1) * limit),
    nextPage: () => setOffset(offset + limit),
    previousPage: () => setOffset(Math.max(0, offset - limit)),
    setSearch,
    setSort: () => undefined,
    setPageSize: (pageSize: number) => {
        setLimit(pageSize)
        setOffset(0)
    }
})
