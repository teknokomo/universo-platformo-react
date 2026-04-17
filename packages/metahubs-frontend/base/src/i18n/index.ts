// Universo Platformo | Metahubs module i18n
// Register consolidated metahubs namespace (includes meta_sections, meta_entities, members)
import { registerNamespace } from '@universo/i18n/registry'
import enMetahubs from './locales/en/metahubs.json'
import ruMetahubs from './locales/ru/metahubs.json'

interface MetahubsBundle {
    metahubs?: Record<string, unknown>
    export?: Record<string, unknown>
    layouts?: Record<string, unknown>
    general?: Record<string, unknown>
    shared?: Record<string, unknown>
    menus?: Record<string, unknown>
    templates?: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
    branches?: Record<string, unknown>
    entities?: Record<string, unknown>
    documents?: Record<string, unknown>
    hubs?: Record<string, unknown>
    catalogs?: Record<string, unknown>
    sets?: Record<string, unknown>
    fixedValues?: Record<string, unknown>
    enumerations?: Record<string, unknown>
    optionValues?: Record<string, unknown>
    fieldDefinitions?: Record<string, unknown>
    records?: Record<string, unknown>
    publications?: Record<string, unknown>
    migrations?: Record<string, unknown>
    settings?: Record<string, unknown>
    createOptions?: Record<string, unknown>
    ref?: Record<string, unknown>
    common?: Record<string, unknown>
    actions?: Record<string, unknown>
    errors?: Record<string, unknown>
}

const consolidateMetahubsNamespace = (bundle: MetahubsBundle) => {
    const metahubsRoot = (bundle?.metahubs ?? {}) as Record<string, unknown>
    const metahubsActions = (metahubsRoot?.actions && typeof metahubsRoot.actions === 'object' ? metahubsRoot.actions : {}) as Record<
        string,
        unknown
    >

    return {
        ...metahubsRoot,
        // Merge metahubs-level actions with top-level actions (e.g., generic backToList)
        actions: {
            ...metahubsActions,
            ...(bundle?.actions ?? {})
        },
        general: bundle?.general ?? {},
        shared: bundle?.shared ?? {},
        templates: bundle?.templates ?? {},
        branches: bundle?.branches ?? {},
        layouts: bundle?.layouts ?? {},
        menus: bundle?.menus ?? {},
        meta_sections: bundle?.meta_sections ?? {},
        meta_entities: bundle?.meta_entities ?? {},
        members: bundle?.members ?? {},
        entities: bundle?.entities ?? {},
        documents: bundle?.documents ?? {},
        hubs: bundle?.hubs ?? {},
        catalogs: bundle?.catalogs ?? {},
        sets: bundle?.sets ?? {},
        fixedValues: bundle?.fixedValues ?? {},
        enumerations: bundle?.enumerations ?? {},
        optionValues: bundle?.optionValues ?? {},
        fieldDefinitions: bundle?.fieldDefinitions ?? {},
        records: bundle?.records ?? {},
        publications: bundle?.publications ?? {},
        migrations: bundle?.migrations ?? {},
        settings: bundle?.settings ?? {},
        export: bundle?.export ?? {},
        createOptions: bundle?.createOptions ?? {},
        ref: bundle?.ref ?? {},
        common: bundle?.common ?? {},
        errors: bundle?.errors ?? {}
    }
}

// Register single consolidated namespace
registerNamespace('metahubs', {
    en: consolidateMetahubsNamespace(enMetahubs),
    ru: consolidateMetahubsNamespace(ruMetahubs)
})

type LanguageCode = 'en' | 'ru'

interface MetahubsTranslation {
    metahubs: Record<string, unknown>
    layouts?: Record<string, unknown>
    menus?: Record<string, unknown>
    templates?: Record<string, unknown>
    shared?: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
    branches?: Record<string, unknown>
    entities?: Record<string, unknown>
    documents?: Record<string, unknown>
    hubs?: Record<string, unknown>
    catalogs?: Record<string, unknown>
    sets?: Record<string, unknown>
    fixedValues?: Record<string, unknown>
    enumerations?: Record<string, unknown>
    optionValues?: Record<string, unknown>
    publications?: Record<string, unknown>
    migrations?: Record<string, unknown>
    settings?: Record<string, unknown>
    export?: Record<string, unknown>
    ref?: Record<string, unknown>
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
