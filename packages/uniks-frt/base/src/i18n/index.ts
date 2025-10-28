// Universo Platformo | Uniks module i18n
// Register uniks-frt namespaces with global i18n instance
import { registerNamespace } from '@universo/i18n/registry'
import enMainTranslation from '@universo/uniks-frt/src/i18n/locales/en/main.json'
import ruMainTranslation from '@universo/uniks-frt/src/i18n/locales/ru/main.json'

// Register uniks namespace with .uniks subtree (includes menu.uniks inside)
registerNamespace('uniks', {
    en: enMainTranslation.uniks,
    ru: ruMainTranslation.uniks
})

type LanguageCode = 'en' | 'ru'

interface UniksTranslation {
    uniks: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: UniksTranslation
}

// Export translations for backwards compatibility
export const uniksTranslations: TranslationsMap = {
    en: enMainTranslation,
    ru: ruMainTranslation
}

export function getUniksTranslations(language: LanguageCode): UniksTranslation {
    return uniksTranslations[language] || uniksTranslations.en
}
