// Universo Platformo | Type declarations for i18n module
import { i18n } from 'i18next'

/**
 * Structure for publish translations
 */
export interface PublishTranslations {
    [language: string]: {
        publish: Record<string, any>
    }
}

/**
 * Get Publish translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getPublishTranslations(language: string): Record<string, any>

/**
 * Publish translations object for integration with the main i18n system
 * Format: { [language]: { publish: [translations] } }
 */
export const publishTranslations: PublishTranslations

// Universo Platformo | Export default as i18next instance
declare const i18nInstance: i18n
export default i18nInstance
