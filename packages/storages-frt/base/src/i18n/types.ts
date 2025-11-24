import 'react-i18next'
import type enStorages from './locales/en/storages.json'

/**
 * Type augmentation for storages namespace
 * Extends react-i18next Slots with storages translations
 */
declare module 'react-i18next' {
    interface Slots {
        storages: typeof enStorages.storages
    }
}

/**
 * Typed hook for accessing storages translations
 * Provides full type safety and autocomplete for all storages translation keys
 *
 * @example
 * ```typescript
 * const { t } = useStoragesTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useStoragesTranslation() {
    return useTranslation<'storages'>('storages')
}
