// Universo Platformo | Template MMOOMM module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const templateMmoommTranslations = {
    en: {
        templateMmoomm: enMainTranslation.templateMmoomm
    },
    ru: {
        templateMmoomm: ruMainTranslation.templateMmoomm
    }
}

export function getTemplateMmoommTranslations(language) {
    return templateMmoommTranslations[language]?.templateMmoomm || templateMmoommTranslations.en.templateMmoomm
}

export default templateMmoommTranslations
