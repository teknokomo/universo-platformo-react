// Publish module i18n (TypeScript version)
// English comments only inside code

import { registerNamespace } from '@universo/i18n/registry'
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

// Register publish namespace with global i18n instance
registerNamespace('publish', {
    en: enMainTranslation.publish,
    ru: ruMainTranslation.publish
})

// Export translations for use in spaces-frt i18nInstance.js
export const publishTranslations = {
    en: { publish: enMainTranslation.publish },
    ru: { publish: ruMainTranslation.publish }
}
