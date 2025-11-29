// Universo Platformo | Assistants module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enAssistantsTranslation from './locales/en/assistants.json'
import ruAssistantsTranslation from './locales/ru/assistants.json'

type LanguageCode = 'en' | 'ru'

interface AssistantsTranslation {
    assistants: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: AssistantsTranslation
}

/**
 * Assistants namespace constant for i18n
 */
export const assistantsNamespace = 'assistants'

/**
 * Assistants translations object for integration with the main i18n system
 * Format: { [language]: { assistants: [translations] } }
 */
export const assistantsResources: TranslationsMap = {
    en: {
        assistants: enAssistantsTranslation
    },
    ru: {
        assistants: ruAssistantsTranslation
    }
}

// Side-effect: register the 'assistants' namespace with the global i18n instance
// Ensures translations are available when the Assistants pages are rendered
registerNamespace('assistants', {
    en: enAssistantsTranslation,
    ru: ruAssistantsTranslation
})

/**
 * Get Assistants translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getAssistantsTranslations(language: LanguageCode): Record<string, unknown> {
    return assistantsResources[language]?.assistants || assistantsResources.en.assistants
}

/**
 * Export language-specific resources for dynamic loading
 */
export { enAssistantsTranslation, ruAssistantsTranslation }
