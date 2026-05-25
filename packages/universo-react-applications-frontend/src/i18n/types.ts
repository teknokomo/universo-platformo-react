import 'react-i18next'
import type enApplications from './locales/en/applications.json'

/**
 * Type augmentation for applications namespace
 * Extends react-i18next Resources with applications translations
 */
declare module 'react-i18next' {
    interface Resources {
        applications: typeof enApplications.applications
    }
}

/**
 * Typed hook for accessing applications translations
 * Provides full type safety and autocomplete for all applications translation keys
 *
 * @example
 * ```typescript
 * const { t } = useApplicationsTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useApplicationsTranslation() {
    return useTranslation<'applications'>('applications')
}
