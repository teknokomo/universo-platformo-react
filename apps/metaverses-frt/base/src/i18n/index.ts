import enEntities from './locales/en/entities.json'
import ruEntities from './locales/ru/entities.json'

// Expose the whole JSON as the "entities" namespace
export const metaversesTranslations = {
    en: { entities: enEntities },
    ru: { entities: ruEntities }
}

export function getMetaversesTranslations(language: string) {
    return (metaversesTranslations as any)[language]?.entities || metaversesTranslations.en.entities
}

export default metaversesTranslations
