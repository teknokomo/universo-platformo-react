import { createInstance, Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'

export interface CreateTestI18nOptions {
  locale?: string
  fallbackLocale?: string
  resources?: Resource
}

export const defaultTestTranslations: Resource = {
  en: { translation: {} },
  ru: { translation: {} },
}

export async function createTestI18n(options: CreateTestI18nOptions = {}): Promise<I18nInstance> {
  const {
    locale = 'en',
    fallbackLocale = 'en',
    resources = defaultTestTranslations,
  } = options

  const instance = createInstance()

  await instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: fallbackLocale,
    resources,
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    initImmediate: false,
  })

  return instance
}
