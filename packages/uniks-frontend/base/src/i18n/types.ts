import 'react-i18next'
import type enUniks from './locales/en/uniks.json'

/**
 * Type augmentation for uniks namespace
 * Extends react-i18next Resources with uniks translations
 */
declare module 'react-i18next' {
    interface Resources {
        uniks: typeof enUniks.uniks
    }
}

/**
 * Typed hook for accessing uniks translations
 * Provides full type safety and autocomplete for all uniks translation keys
 *
 * @example
 * ```typescript
 * const { t } = useUniksTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useUniksTranslation() {
    return useTranslation<'uniks'>('uniks')
}
