import i18n from '@universo/i18n'

export * from '@universo/utils/optimistic-crud'

export function getCurrentLanguageKey(): string {
    return (i18n?.resolvedLanguage || i18n?.language || 'en').split(/[-_]/)[0].toLowerCase()
}
