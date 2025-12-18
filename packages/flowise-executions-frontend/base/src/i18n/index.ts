// Universo Platformo | Executions module i18n
// Export translations for use in the main application

import { registerNamespace } from '@universo/i18n'
import executionsEn from './en/executions.json'
import executionsRu from './ru/executions.json'

type LanguageCode = 'en' | 'ru'

interface ExecutionsTranslation {
    executions: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ExecutionsTranslation
}

/**
 * Executions namespace constant for i18n
 */
export const executionsNamespace = 'executions'

/**
 * Executions translations object for integration with the main i18n system
 * Format: { [language]: { executions: [translations] } }
 */
export const executionsResources: TranslationsMap = {
    en: {
        executions: executionsEn
    },
    ru: {
        executions: executionsRu
    }
}

// Side-effect: register the 'executions' namespace with the global i18n instance
// Ensures translations are available when the Executions page is rendered
registerNamespace('executions', {
    en: executionsEn,
    ru: executionsRu
})

/**
 * Get Executions translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getExecutionsTranslations(language: LanguageCode): Record<string, unknown> {
    return executionsResources[language]?.executions || executionsResources.en.executions
}

// Re-export for consumers
export { executionsEn, executionsRu }
