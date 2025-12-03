// Universo Platformo | Variables module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enVariablesTranslation from './locales/en/variables.json'
import ruVariablesTranslation from './locales/ru/variables.json'

type LanguageCode = 'en' | 'ru'

interface VariablesTranslation {
    variables: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: VariablesTranslation
}

/**
 * Variables namespace constant for i18n
 */
export const variablesNamespace = 'variables'

/**
 * Variables translations object for integration with the main i18n system
 * Format: { [language]: { variables: [translations] } }
 */
export const variablesResources: TranslationsMap = {
    en: {
        variables: enVariablesTranslation
    },
    ru: {
        variables: ruVariablesTranslation
    }
}

// Side-effect: register the 'variables' namespace with the global i18n instance
// Ensures translations are available when the Variables page is rendered
registerNamespace('variables', {
    en: enVariablesTranslation,
    ru: ruVariablesTranslation
})

/**
 * Get Variables translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getVariablesTranslations(language: LanguageCode): Record<string, unknown> {
    return variablesResources[language]?.variables || variablesResources.en.variables
}
