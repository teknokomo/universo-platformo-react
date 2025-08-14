// Universo Platformo | Metaverse module i18n
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

export const metaverseTranslations = {
    en: {
        metaverse: enMainTranslation.metaverse
    },
    ru: {
        metaverse: ruMainTranslation.metaverse
    }
}

export function getMetaverseTranslations(language) {
    return metaverseTranslations[language]?.metaverse || metaverseTranslations.en.metaverse
}

export default metaverseTranslations
