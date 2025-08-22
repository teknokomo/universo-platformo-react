// Universo Platformo | Type declarations for template-mmoomm i18n module

/**
 * Structure for template MMOOMM translations
 */
export interface TemplateMmoommTranslations {
    [language: string]: {
        templateMmoomm: Record<string, any>
    }
}

/**
 * Get Template MMOOMM translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getTemplateMmoommTranslations(language: string): Record<string, any>

/**
 * Template MMOOMM translations object for integration with the main i18n system
 * Format: { [language]: { templateMmoomm: [translations] } }
 */
export const templateMmoommTranslations: TemplateMmoommTranslations

export default templateMmoommTranslations