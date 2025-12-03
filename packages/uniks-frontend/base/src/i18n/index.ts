// Universo Platformo | Uniks module i18n
// Register consolidated uniks namespace
import { registerNamespace } from '@universo/i18n/registry'
import enUniks from './locales/en/uniks.json'
import ruUniks from './locales/ru/uniks.json'

// Register single consolidated namespace
registerNamespace('uniks', {
    en: enUniks.uniks,
    ru: ruUniks.uniks
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
    en: { uniks: enUniks.uniks },
    ru: { uniks: ruUniks.uniks }
}

export function getUniksTranslations(language: LanguageCode): Record<string, unknown> {
    return uniksTranslations[language]?.uniks || uniksTranslations.en.uniks
}
