import enEntities from './locales/en/entities.json'
import ruEntities from './locales/ru/entities.json'

export const entitiesTranslations = {
  en: { entities: enEntities.entities },
  ru: { entities: ruEntities.entities }
}

export function getEntitiesTranslations(language: string) {
  return (entitiesTranslations as any)[language]?.entities || entitiesTranslations.en.entities
}

export default entitiesTranslations
