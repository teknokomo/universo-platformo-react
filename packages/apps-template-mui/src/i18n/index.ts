// Register apps-template-mui i18n namespace
import { registerNamespace } from '@universo/i18n/registry'
import enApps from './locales/en/apps.json'
import enQuiz from './locales/en/quiz.json'
import ruApps from './locales/ru/apps.json'
import ruQuiz from './locales/ru/quiz.json'

registerNamespace('apps', {
    en: enApps,
    ru: ruApps
})

registerNamespace('quiz', {
    en: enQuiz,
    ru: ruQuiz
})

export const appsTranslations = {
    en: { apps: enApps, quiz: enQuiz },
    ru: { apps: ruApps, quiz: ruQuiz }
}
