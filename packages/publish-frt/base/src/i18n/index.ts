// Publish module i18n (TypeScript version)
// English comments only inside code

import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export type PublishNamespace = {
    publish: Record<string, any>
}

export type PublishTranslations = Record<string, PublishNamespace>

export const publishTranslations: PublishTranslations = {
    en: {
        publish: enMainTranslation.publish
    },
    ru: {
        publish: ruMainTranslation.publish
    }
}

export function getPublishTranslations(language: string): Record<string, any> {
    return publishTranslations[language]?.publish || publishTranslations.en.publish
}

export default publishTranslations
