// Universo Platformo | Document Store module i18n
// Export translations for use in the main application

// Import translations
import { registerNamespace } from '@universo/i18n/registry'
import enDocumentStoreTranslation from './locales/en/document-store.json'
import ruDocumentStoreTranslation from './locales/ru/document-store.json'
import enVectorStoreTranslation from './locales/en/vector-store.json'
import ruVectorStoreTranslation from './locales/ru/vector-store.json'

type LanguageCode = 'en' | 'ru'

interface DocumentStoreTranslation {
    'document-store': Record<string, unknown>
}

interface VectorStoreTranslation {
    'vector-store': Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: DocumentStoreTranslation & VectorStoreTranslation
}

/**
 * Document Store namespace constant for i18n
 */
export const documentStoreNamespace = 'document-store'

/**
 * Vector Store namespace constant for i18n
 */
export const vectorStoreNamespace = 'vector-store'

/**
 * Document Store translations object for integration with the main i18n system
 * Format: { [language]: { 'document-store': [translations], 'vector-store': [translations] } }
 */
export const docstoreResources: TranslationsMap = {
    en: {
        'document-store': enDocumentStoreTranslation,
        'vector-store': enVectorStoreTranslation
    },
    ru: {
        'document-store': ruDocumentStoreTranslation,
        'vector-store': ruVectorStoreTranslation
    }
}

let isRegistered = false

/**
 * Registers document-store and vector-store namespaces once.
 * Exported for cases when consumers prefer explicit initialization.
 */
export const registerDocstoreI18n = (): void => {
    if (isRegistered) {
        return
    }

    registerNamespace('document-store', {
        en: enDocumentStoreTranslation,
        ru: ruDocumentStoreTranslation
    })

    registerNamespace('vector-store', {
        en: enVectorStoreTranslation,
        ru: ruVectorStoreTranslation
    })

    isRegistered = true
}

// Side-effect: ensure namespaces are registered as soon as package is imported
registerDocstoreI18n()

/**
 * Get Document Store translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getDocumentStoreTranslations(language: LanguageCode): Record<string, unknown> {
    return docstoreResources[language]?.['document-store'] || docstoreResources.en['document-store']
}

/**
 * Get Vector Store translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getVectorStoreTranslations(language: LanguageCode): Record<string, unknown> {
    return docstoreResources[language]?.['vector-store'] || docstoreResources.en['vector-store']
}

export default docstoreResources
