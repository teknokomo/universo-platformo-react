// Universo Platformo | Finance module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const financeTranslations = {
    en: {
        finance: enMainTranslation.finance
    },
    ru: {
        finance: ruMainTranslation.finance
    }
}

export function getFinanceTranslations(language) {
    return financeTranslations[language]?.finance || financeTranslations.en.finance
}

const translations = {
    en: { ...financeTranslations.en },
    ru: { ...financeTranslations.ru }
}

export default translations
