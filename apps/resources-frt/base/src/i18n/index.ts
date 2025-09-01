import enResources from './locales/en/resources.json'
import ruResources from './locales/ru/resources.json'

export const resourcesTranslations = {
    en: { resources: enResources.resources },
    ru: { resources: ruResources.resources }
}

export function getResourcesTranslations(language: string) {
    return (resourcesTranslations as any)[language]?.resources || resourcesTranslations.en.resources
}

export default resourcesTranslations
