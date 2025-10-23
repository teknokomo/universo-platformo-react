// Universo Platformo | UPDL Localization Exports
// Exports translations for integration with main i18n system

import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

type LanguageCode = 'en' | 'ru'

interface UPDLTranslation {
  updl: Record<string, unknown>
}

interface TranslationsMap {
  [key: string]: UPDLTranslation
}

/**
 * UPDL translations object for integration with the main i18n system
 * Format: { [language]: { updl: [translations] } }
 */
export const updlTranslations: TranslationsMap = {
  en: { updl: enMainTranslation },
  ru: { updl: ruMainTranslation }
}

/**
 * Get UPDL translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getUPDLTranslations(language: LanguageCode): Record<string, unknown> {
  return updlTranslations[language]?.updl || updlTranslations.en.updl
}

export default updlTranslations
