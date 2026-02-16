// Register apps-template-mui i18n namespace
import { registerNamespace } from '@universo/i18n/registry'
import enApps from './locales/en/apps.json'
import ruApps from './locales/ru/apps.json'

registerNamespace('apps', {
    en: enApps,
    ru: ruApps
})

export const appsTranslations = {
    en: { apps: enApps },
    ru: { apps: ruApps }
}
