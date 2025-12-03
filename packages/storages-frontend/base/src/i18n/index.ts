// Universo Platformo | Storages module i18n
// Register consolidated storages namespace (includes containers, slots, members)
import { registerNamespace } from '@universo/i18n/registry'
import enStorages from './locales/en/storages.json'
import ruStorages from './locales/ru/storages.json'

// Register single consolidated namespace
registerNamespace('storages', {
    en: enStorages.storages,
    ru: ruStorages.storages
})

type LanguageCode = 'en' | 'ru'

interface StoragesTranslation {
    storages: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: StoragesTranslation
}

// Export translations for backwards compatibility
export const storagesTranslations: TranslationsMap = {
    en: { storages: enStorages.storages },
    ru: { storages: ruStorages.storages }
}

export function getStoragesTranslations(language: LanguageCode): Record<string, unknown> {
    return storagesTranslations[language]?.storages || storagesTranslations.en.storages
}
