import enResources from './locales/en/resources.json'
import ruResources from './locales/ru/resources.json'

// Expose the whole JSON as the "resources" namespace
export const resourcesTranslations = {
    en: { resources: enResources },
    ru: { resources: ruResources }
}

export function getResourcesTranslations(language: string) {
    return (resourcesTranslations as any)[language]?.resources || resourcesTranslations.en.resources
}

export default resourcesTranslations
