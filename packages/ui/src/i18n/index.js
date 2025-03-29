import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from './locales/en.json'
import ruTranslation from './locales/ru.json'

// i18next initialization with error handling
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enTranslation },
            ru: { translation: ruTranslation }
        },
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        debug: process.env.NODE_ENV === 'development',
        react: {
            useSuspense: false
        }
    }, (err) => {
        if (err) {
            console.error('i18next initialization error:', err);
        }
    });

export default i18n
