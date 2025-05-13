// Universo Platformo | Publish module i18n
// Export translations for use in the main application

// Import translations
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

/**
 * Publish translations object for integration with the main i18n system
 * Format: { [language]: { publish: [translations] } }
 */
export const publishTranslations = {
    en: {
        publish: enMainTranslation.publish
    },
    ru: {
        publish: ruMainTranslation.publish
    }
}

/**
 * Get Publish translations for a specific language
 * @param {string} language - Language code (e.g., 'en', 'ru')
 * @returns {object} Translations for the specified language
 */
export function getPublishTranslations(language) {
    return publishTranslations[language]?.publish || publishTranslations.en.publish
}

export default publishTranslations
