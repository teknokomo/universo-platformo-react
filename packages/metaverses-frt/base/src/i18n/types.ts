import 'react-i18next'
import type enMetaverses from './locales/en/metaverses.json'

/**
 * Type augmentation for metaverses namespace
 * Extends react-i18next Resources with metaverses translations
 */
declare module 'react-i18next' {
    interface Resources {
        metaverses: typeof enMetaverses.metaverses
    }
}

/**
 * Typed hook for accessing metaverses translations
 * Provides full type safety and autocomplete for all metaverses translation keys
 *
 * @example
 * ```typescript
 * const { t } = useMetaversesTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useMetaversesTranslation() {
    return useTranslation<'metaverses'>('metaverses')
}
