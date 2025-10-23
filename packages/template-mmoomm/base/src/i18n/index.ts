// Template MMOOMM module i18n (TypeScript version)
// English comments only inside code

import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export type TemplateMmoommNamespace = {
    templateMmoomm: Record<string, any>
}

export type TemplateMmoommTranslations = Record<string, TemplateMmoommNamespace>

export const templateMmoommTranslations: TemplateMmoommTranslations = {
    en: {
        templateMmoomm: enMainTranslation.templateMmoomm
    },
    ru: {
        templateMmoomm: ruMainTranslation.templateMmoomm
    }
}

export function getTemplateMmoommTranslations(language: string): Record<string, any> {
    return templateMmoommTranslations[language]?.templateMmoomm || templateMmoommTranslations.en.templateMmoomm
}

export default templateMmoommTranslations

