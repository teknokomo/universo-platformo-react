// Universo Platformo | Credentials module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enCredentialsTranslation from './locales/en/credentials.json'
import ruCredentialsTranslation from './locales/ru/credentials.json'

type LanguageCode = 'en' | 'ru'

interface CredentialsTranslation {
    credentials: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: CredentialsTranslation
}

/**
 * Credentials namespace constant for i18n
 */
export const credentialsNamespace = 'credentials'

/**
 * Credentials translations object for integration with the main i18n system
 * Format: { [language]: { credentials: [translations] } }
 */
export const credentialsResources: TranslationsMap = {
    en: {
        credentials: enCredentialsTranslation
    },
    ru: {
        credentials: ruCredentialsTranslation
    }
}

// Side-effect: register the 'credentials' namespace with the global i18n instance
// Ensures translations are available when the Credentials page is rendered
registerNamespace('credentials', {
    en: enCredentialsTranslation,
    ru: ruCredentialsTranslation
})

/**
 * Get Credentials translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getCredentialsTranslations(language: LanguageCode): Record<string, unknown> {
    return credentialsResources[language]?.credentials || credentialsResources.en.credentials
}

export default credentialsResources
