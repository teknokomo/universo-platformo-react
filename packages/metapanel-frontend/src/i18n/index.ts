import { registerNamespace } from '@universo/i18n/registry'
import enMetapanel from './locales/en/metapanel.json'
import ruMetapanel from './locales/ru/metapanel.json'

registerNamespace('metapanel', {
    en: enMetapanel,
    ru: ruMetapanel
})
