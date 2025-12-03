// Universo Platformo | ApiKeys module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enApiKeysTranslation from './locales/en/apiKeys.json'
import ruApiKeysTranslation from './locales/ru/apiKeys.json'

type LanguageCode = 'en' | 'ru'

interface ApiKeysTranslation {
    apiKeys: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ApiKeysTranslation
}

/**
 * ApiKeys namespace constant for i18n
 */
export const apiKeysNamespace = 'apiKeys'

/**
 * ApiKeys translations object for integration with the main i18n system
 * Format: { [language]: { apiKeys: [translations] } }
 */
export const apiKeysResources: TranslationsMap = {
    en: {
        apiKeys: enApiKeysTranslation
    },
    ru: {
        apiKeys: ruApiKeysTranslation
    }
}

// Side-effect: register the 'apiKeys' namespace with the global i18n instance
// Ensures translations are available when the ApiKeys page is rendered
registerNamespace('apiKeys', {
    en: enApiKeysTranslation,
    ru: ruApiKeysTranslation
})

/**
 * Get ApiKeys translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getApiKeysTranslations(language: LanguageCode): Record<string, unknown> {
    return apiKeysResources[language]?.apiKeys || apiKeysResources.en.apiKeys
}

export { enApiKeysTranslation, ruApiKeysTranslation }
