// Universo Platformo | Uniks & Finance module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const uniksTranslations = {
    en: {
        uniks: enMainTranslation.uniks
    },
    ru: {
        uniks: ruMainTranslation.uniks
    }
}

export const financeTranslations = {
    en: {
        finance: enMainTranslation.finance
    },
    ru: {
        finance: ruMainTranslation.finance
    }
}

export function getUniksTranslations(language) {
    return uniksTranslations[language]?.uniks || uniksTranslations.en.uniks
}

export function getFinanceTranslations(language) {
    return financeTranslations[language]?.finance || financeTranslations.en.finance
}

const translations = {
    en: { ...uniksTranslations.en, ...financeTranslations.en },
    ru: { ...uniksTranslations.ru, ...financeTranslations.ru }
}

export default translations
