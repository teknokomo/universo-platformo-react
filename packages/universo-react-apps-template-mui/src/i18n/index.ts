// Register apps-template-mui i18n namespace
import i18n from '@universo-react/i18n'
import { registerNamespace } from '@universo-react/i18n/registry'
import { configureRuntimeRuleTranslator } from '../utils/runtimeErrors'
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

// Runtime rule errors (duplicate keys, pattern mismatches) resolve through the
// apps bundle so every locale is covered without importing i18n into utils.
configureRuntimeRuleTranslator((key, locale) => {
    const translated = i18n.t(key, { ns: 'apps', lng: locale, defaultValue: '' })
    return typeof translated === 'string' && translated.length > 0 ? translated : null
})
