// Universo Platformo | Analytics module i18n
// Export translations for use in the main application

// Import translations
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

/**
 * Analytics translations object for integration with the main i18n system
 * Format: { [language]: { analytics: [translations] } }
 */
export const analyticsTranslations = {
    en: {
        analytics: enMainTranslation.analytics
    },
    ru: {
        analytics: ruMainTranslation.analytics
    }
}

/**
 * Get Analytics translations for a specific language
 * @param {string} language - Language code (e.g., 'en', 'ru')
 * @returns {object} Translations for the specified language
 */
export function getAnalyticsTranslations(language) {
    return analyticsTranslations[language]?.analytics || analyticsTranslations.en.analytics
}

export default analyticsTranslations
