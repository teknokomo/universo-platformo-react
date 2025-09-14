import enMetaverses from './locales/en/metaverses.json'
import ruMetaverses from './locales/ru/metaverses.json'

// Expose the whole JSON as the "metaverses" namespace
export const metaversesTranslations = {
    en: { metaverses: enMetaverses },
    ru: { metaverses: ruMetaverses }
}

export function getMetaversesTranslations(language: string) {
    return (metaversesTranslations as any)[language]?.metaverses || metaversesTranslations.en.metaverses
}

export default metaversesTranslations
