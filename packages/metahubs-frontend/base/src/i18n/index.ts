// Universo Platformo | Metahubs module i18n
// Register consolidated metahubs namespace (includes meta_sections, meta_entities, members)
import { registerNamespace } from '@universo/i18n/registry'
import enMetahubs from './locales/en/metahubs.json'
import ruMetahubs from './locales/ru/metahubs.json'

interface MetahubsBundle {
    metahubs?: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
    hubs?: Record<string, unknown>
    attributes?: Record<string, unknown>
    records?: Record<string, unknown>
    common?: Record<string, unknown>
    errors?: Record<string, unknown>
}

const consolidateMetahubsNamespace = (bundle: MetahubsBundle) => ({
    ...(bundle?.metahubs ?? {}),
    meta_sections: bundle?.meta_sections ?? {},
    meta_entities: bundle?.meta_entities ?? {},
    members: bundle?.members ?? {},
    hubs: bundle?.hubs ?? {},
    attributes: bundle?.attributes ?? {},
    records: bundle?.records ?? {},
    common: bundle?.common ?? {},
    errors: bundle?.errors ?? {}
})

// Register single consolidated namespace
registerNamespace('metahubs', {
    en: consolidateMetahubsNamespace(enMetahubs),
    ru: consolidateMetahubsNamespace(ruMetahubs)
})

type LanguageCode = 'en' | 'ru'

interface MetahubsTranslation {
    metahubs: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
    common?: Record<string, unknown>
    errors?: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: MetahubsTranslation
}

// Export translations for backwards compatibility
export const metahubsTranslations: TranslationsMap = {
    en: { metahubs: consolidateMetahubsNamespace(enMetahubs) },
    ru: { metahubs: consolidateMetahubsNamespace(ruMetahubs) }
}

export function getMetahubsTranslations(language: LanguageCode): Record<string, unknown> {
    return metahubsTranslations[language]?.metahubs || metahubsTranslations.en.metahubs
}
