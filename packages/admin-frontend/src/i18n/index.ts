// Universo Platformo | Admin module i18n
// Register admin namespace for global users management
import { registerNamespace } from '@universo/i18n/registry'
import enAdmin from './en/admin.json'
import ruAdmin from './ru/admin.json'

// Register admin namespace
registerNamespace('admin', {
    en: enAdmin,
    ru: ruAdmin
})

type LanguageCode = 'en' | 'ru'

interface TranslationsMap {
    [key: string]: Record<string, unknown>
}

// Export translations for backwards compatibility
export const adminTranslations: TranslationsMap = {
    en: enAdmin,
    ru: ruAdmin
}

export function getAdminTranslations(language: LanguageCode): Record<string, unknown> {
    return adminTranslations[language] || adminTranslations.en
}
