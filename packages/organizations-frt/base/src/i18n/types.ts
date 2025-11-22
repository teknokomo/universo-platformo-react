import 'react-i18next'
import type enOrganizations from './locales/en/organizations.json'

/**
 * Type augmentation for organizations namespace
 * Extends react-i18next Positions with organizations translations
 */
declare module 'react-i18next' {
    interface Positions {
        organizations: typeof enOrganizations.organizations
    }
}

/**
 * Typed hook for accessing organizations translations
 * Provides full type safety and autocomplete for all organizations translation keys
 *
 * @example
 * ```typescript
 * const { t } = useOrganizationsTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useOrganizationsTranslation() {
    return useTranslation<'organizations'>('organizations')
}
