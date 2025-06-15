// Universo Platformo | Profile module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const profileTranslations = {
    en: {
        profile: enMainTranslation.profile
    },
    ru: {
        profile: ruMainTranslation.profile
    }
}

export function getProfileTranslations(language) {
    return profileTranslations[language]?.profile || profileTranslations.en.profile
}

export default profileTranslations
