import 'react-i18next'
import type enProjects from './locales/en/projects.json'

/**
 * Type augmentation for projects namespace
 * Extends react-i18next resources with projects translations
 */
declare module 'react-i18next' {
    interface CustomTypeOptions {
        resources: {
            projects: typeof enProjects.projects
        }
    }
}

/**
 * Typed hook for accessing projects translations
 * Provides full type safety and autocomplete for all projects translation keys
 *
 * @example
 * ```typescript
 * const { t } = useProjectsTranslation()
 * t('title')  // ✓ Valid key - autocomplete works
 * t('invalid') // ✗ Compile error - key doesn't exist
 * ```
 */
import { useTranslation } from 'react-i18next'

export function useProjectsTranslation() {
    return useTranslation<'projects'>('projects')
}
