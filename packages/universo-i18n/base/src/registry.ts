import { getInstance } from './instance'
import type { NamespaceTranslations } from './types'

/**
 * Registers a new namespace with translations for EN and RU languages
 * @param namespace - Namespace identifier
 * @param translations - Translation resources for EN and RU
 */
export function registerNamespace(namespace: string, translations: NamespaceTranslations): void {
    const i18n = getInstance()

    // Helper function to register bundles (DRY)
    const register = () => {
        i18n.addResourceBundle('en', namespace, translations.en, true, true)
        i18n.addResourceBundle('ru', namespace, translations.ru, true, true)

        // Debug: confirm registration
        console.log(`[registry] Registered namespace '${namespace}':`, {
            currentLang: i18n.language,
            hasEn: i18n.hasResourceBundle('en', namespace),
            hasRu: i18n.hasResourceBundle('ru', namespace),
            hasCurrentLang: i18n.hasResourceBundle(i18n.language, namespace)
        })
    }

    if (!i18n.isInitialized) {
        i18n.on('initialized', register)
    } else {
        register()
    }
}
