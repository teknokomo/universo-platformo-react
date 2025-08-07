// Universo Platformo | Uniks module i18n
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

export function getUniksTranslations(language) {
    return uniksTranslations[language]?.uniks || uniksTranslations.en.uniks
}

export default uniksTranslations
