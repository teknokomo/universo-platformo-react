import 'react-i18next'
import type enCampaigns from './locales/en/campaigns.json'

/**
 * Type augmentation for campaigns namespace
 * Extends react-i18next Activities with campaigns translations
 */
declare module 'react-i18next' {
    interface Activities {
        campaigns: typeof enCampaigns.campaigns
    }
}

/**
 * Typed hook for accessing campaigns translations
 * Provides full type safety and autocomplete for all campaigns translation keys
 *
 * @example
 * ```typescript
 * const { t } = useCampaignsTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useCampaignsTranslation() {
    return useTranslation<'campaigns'>('campaigns')
}
