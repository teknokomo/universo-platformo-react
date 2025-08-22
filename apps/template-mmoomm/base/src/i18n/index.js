// Universo Platformo | Template MMOOMM i18n
// Export translations for use in the main application

// Import translations
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

/**
 * Template MMOOMM translations object for integration with the main i18n system
 * Format: { [language]: { templateMmoomm: [translations] } }
 */
export const templateMmoommTranslations = {
    en: {
        templateMmoomm: enMainTranslation.templateMmoomm
    },
    ru: {
        templateMmoomm: ruMainTranslation.templateMmoomm
    }
}

/**
 * Get Template MMOOMM translations for a specific language
 * @param {string} language - Language code (e.g., 'en', 'ru')
 * @returns {object} Translations for the specified language
 */
export function getTemplateMmoommTranslations(language) {
    return templateMmoommTranslations[language]?.templateMmoomm || templateMmoommTranslations.en.templateMmoomm
}

export default templateMmoommTranslations