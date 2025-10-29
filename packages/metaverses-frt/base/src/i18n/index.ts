// Universo Platformo | Metaverses module i18n
// Register metaverses namespace with global i18n instance (side-effect)
import { registerNamespace } from '@universo/i18n/registry'
import enMetaverses from './locales/en/metaverses.json'
import ruMetaverses from './locales/ru/metaverses.json'

// Debug: Log namespace registration
console.log('[metaverses-i18n] Registering namespace', {
    namespace: 'metaverses',
    enKeys: Object.keys(enMetaverses.metaverses),
    ruKeys: Object.keys(ruMetaverses.metaverses)
})

// Extract inner object to avoid double-wrapping in i18next namespace
registerNamespace('metaverses', {
    en: enMetaverses.metaverses,
    ru: ruMetaverses.metaverses
})

console.log('[metaverses-i18n] Namespace registered successfully')

type LanguageCode = 'en' | 'ru'

interface MetaversesTranslation {
    metaverses: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: MetaversesTranslation
}

// Export translations for backwards compatibility
export const metaversesTranslations: TranslationsMap = {
    en: { metaverses: enMetaverses.metaverses },
    ru: { metaverses: ruMetaverses.metaverses }
}

export function getMetaversesTranslations(language: LanguageCode): Record<string, unknown> {
    return metaversesTranslations[language]?.metaverses || metaversesTranslations.en.metaverses
}
