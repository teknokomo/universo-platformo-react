// Universo Platformo | Metaverses module i18n
// Register metaverses namespace with global i18n instance (side-effect)
import { registerNamespace } from '@universo/i18n/registry'
import enMetaverses from './locales/en/metaverses.json'
import ruMetaverses from './locales/ru/metaverses.json'

registerNamespace('metaverses', {
    en: enMetaverses,
    ru: ruMetaverses
})

type LanguageCode = 'en' | 'ru'

interface MetaversesTranslation {
    metaverses: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: MetaversesTranslation
}

// Export translations for backwards compatibility
export const metaversesTranslations: TranslationsMap = {
    en: { metaverses: enMetaverses },
    ru: { metaverses: ruMetaverses }
}

export function getMetaversesTranslations(language: LanguageCode): Record<string, unknown> {
    return metaversesTranslations[language]?.metaverses || metaversesTranslations.en.metaverses
}

export default metaversesTranslations
