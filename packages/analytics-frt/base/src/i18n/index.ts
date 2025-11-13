// Universo Platformo | Analytics module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

type LanguageCode = 'en' | 'ru'

interface AnalyticsTranslation {
  analytics: Record<string, unknown>
}

interface TranslationsMap {
  [key: string]: AnalyticsTranslation
}

/**
 * Analytics translations object for integration with the main i18n system
 * Format: { [language]: { analytics: [translations] } }
 */
export const analyticsTranslations: TranslationsMap = {
  en: {
    analytics: enMainTranslation.analytics
  },
  ru: {
    analytics: ruMainTranslation.analytics
  }
}

// Side-effect: register the 'analytics' namespace with the global i18n instance
// Ensures translations are available when the Analytics page is rendered
registerNamespace('analytics', {
  en: enMainTranslation.analytics,
  ru: ruMainTranslation.analytics
})

/**
 * Get Analytics translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getAnalyticsTranslations(language: LanguageCode): Record<string, unknown> {
  return analyticsTranslations[language]?.analytics || analyticsTranslations.en.analytics
}

export default analyticsTranslations
