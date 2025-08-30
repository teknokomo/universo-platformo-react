// Universo Platformo | Template Quiz module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const templateQuizTranslations = {
    en: {
        templateQuiz: enMainTranslation.publish
    },
    ru: {
        templateQuiz: ruMainTranslation.publish
    }
}

export function getTemplateQuizTranslations(language) {
    return templateQuizTranslations[language]?.templateQuiz || templateQuizTranslations.en.templateQuiz
}

export default templateQuizTranslations