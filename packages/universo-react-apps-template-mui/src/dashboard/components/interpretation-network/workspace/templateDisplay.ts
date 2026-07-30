export const readInterpretationNetworkTemplateLabel = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const localized = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const direct = localized.locales?.[locale]?.content
    if (typeof direct === 'string' && direct.trim()) return direct.trim()
    const primary = localized._primary ? localized.locales?.[localized._primary]?.content : undefined
    if (typeof primary === 'string' && primary.trim()) return primary.trim()
    const first = Object.values(localized.locales ?? {}).find((entry) => typeof entry.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : ''
}
