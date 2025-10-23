// Universo Platformo | Profile module i18n
import { registerNamespace } from '@universo/i18n/registry'
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

// Register profile namespace with global i18n instance
registerNamespace('profile', {
  en: enMainTranslation,
  ru: ruMainTranslation
})

type LanguageCode = 'en' | 'ru'

interface ProfileTranslation {
  profile: Record<string, unknown>
}

interface TranslationsMap {
  [key: string]: ProfileTranslation
}

export const profileTranslations: TranslationsMap = {
  en: enMainTranslation,
  ru: ruMainTranslation
}

export function getProfileTranslations(language: LanguageCode): Record<string, unknown> {
  return profileTranslations[language]?.profile || profileTranslations.en.profile
}

export default profileTranslations
