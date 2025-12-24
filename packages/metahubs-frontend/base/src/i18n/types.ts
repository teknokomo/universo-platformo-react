import 'react-i18next'
import type enMetahubs from './locales/en/metahubs.json'

/**
 * Type augmentation for metahubs namespace
 * Extends react-i18next Resources with metahubs translations
 */
declare module 'react-i18next' {
    interface Resources {
        metahubs: typeof enMetahubs.metahubs
    }
}

/**
 * Typed hook for accessing metahubs translations
 * Provides full type safety and autocomplete for all metahubs translation keys
 *
 * @example
 * ```typescript
 * const { t } = useMetahubsTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useMetahubsTranslation() {
    return useTranslation<'metahubs'>('metahubs')
}
