import 'react-i18next'
import type enClusters from './locales/en/clusters.json'

/**
 * Type augmentation for clusters namespace
 * Extends react-i18next Resources with clusters translations
 */
declare module 'react-i18next' {
    interface Resources {
        clusters: typeof enClusters.clusters
    }
}

/**
 * Typed hook for accessing clusters translations
 * Provides full type safety and autocomplete for all clusters translation keys
 *
 * @example
 * ```typescript
 * const { t } = useClustersTranslation()
 * t('title')  // ✅ Valid key - autocomplete works
 * t('invalid') // ❌ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useClustersTranslation() {
    return useTranslation<'clusters'>('clusters')
}
