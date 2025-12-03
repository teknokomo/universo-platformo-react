// Universo Platformo | Tools module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

type LanguageCode = 'en' | 'ru'

interface ToolsTranslation {
    tools: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ToolsTranslation
}

/**
 * Tools translations object for integration with the main i18n system
 * Format: { [language]: { tools: [translations] } }
 */
export const toolsTranslations: TranslationsMap = {
    en: {
        tools: enMainTranslation.tools
    },
    ru: {
        tools: ruMainTranslation.tools
    }
}

// Side-effect: register the 'tools' namespace with the global i18n instance
// Ensures translations are available when the Tools page is rendered
registerNamespace('tools', {
    en: enMainTranslation.tools,
    ru: ruMainTranslation.tools
})

/**
 * Get Tools translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getToolsTranslations(language: LanguageCode): Record<string, unknown> {
    return toolsTranslations[language]?.tools || toolsTranslations.en.tools
}

export default toolsTranslations
