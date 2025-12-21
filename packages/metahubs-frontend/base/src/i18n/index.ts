// Universo Platformo | MetaHubs module i18n
// Register consolidated metahubs namespace
import { registerNamespace } from '@universo/i18n/registry'
import enMetahubs from './locales/en/metahubs.json'
import ruMetahubs from './locales/ru/metahubs.json'

// Register single consolidated namespace
registerNamespace('metahubs', {
    en: enMetahubs.metahubs,
    ru: ruMetahubs.metahubs
})

type LanguageCode = 'en' | 'ru'

interface MetahubsTranslation {
    metahubs: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: MetahubsTranslation
}

// Export translations for backwards compatibility
export const metahubsTranslations: TranslationsMap = {
    en: { metahubs: enMetahubs.metahubs },
    ru: { metahubs: ruMetahubs.metahubs }
}

export function getMetahubsTranslations(language: LanguageCode): Record<string, unknown> {
    return metahubsTranslations[language]?.metahubs || metahubsTranslations.en.metahubs
}
