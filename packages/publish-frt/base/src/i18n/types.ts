import 'react-i18next'
import type enPublish from './locales/en/main.json'

/**
 * Type augmentation for publish namespace
 * Extends react-i18next Resources with publish translations
 */
declare module 'react-i18next' {
  interface Resources {
    publish: typeof enPublish.publish
  }
}

/**
 * Typed hook for accessing publish translations
 * Provides full type safety and autocomplete for all publish translation keys
 * 
 * @example
 * ```typescript
 * const { t } = usePublishTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function usePublishTranslation() {
  return useTranslation<'publish'>('publish')
}
