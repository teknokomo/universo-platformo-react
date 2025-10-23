import { getInstance } from './instance'
import type { NamespaceTranslations } from './types'

export function registerNamespace(namespace: string, translations: NamespaceTranslations): void {
    const i18n = getInstance()

    if (!i18n.isInitialized) {
        // If i18n is not initialized yet, add listener to register after initialization
        i18n.on('initialized', () => {
            i18n.addResourceBundle('en', namespace, translations.en, true, true)
            i18n.addResourceBundle('ru', namespace, translations.ru, true, true)
        })
    } else {
        // i18n is already initialized, register immediately
        i18n.addResourceBundle('en', namespace, translations.en, true, true)
        i18n.addResourceBundle('ru', namespace, translations.ru, true, true)
    }
}
