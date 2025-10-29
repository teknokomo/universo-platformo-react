import { useTranslation, UseTranslationOptions } from 'react-i18next'

/**
 * Hook for accessing common translations with keyPrefix support
 * Simplifies usage of the 'common' namespace across components
 *
 * @example
 * // Without keyPrefix
 * const { t } = useCommonTranslations()
 * t('actions.save') // -> "Save"
 *
 * @example
 * // With keyPrefix
 * const { t } = useCommonTranslations('table')
 * t('role') // -> "Role"
 * t('description') // -> "Description"
 */
export function useCommonTranslations(keyPrefix?: string, options?: Omit<UseTranslationOptions<undefined>, 'keyPrefix'>) {
  return useTranslation('common', {
    ...options,
    keyPrefix
  })
}

/**
 * Hook for accessing header translations
 */
export function useHeaderTranslations(keyPrefix?: string, options?: Omit<UseTranslationOptions<undefined>, 'keyPrefix'>) {
  return useTranslation('header', {
    ...options,
    keyPrefix
  })
}

/**
 * Hook for accessing spaces translations
 */
export function useSpacesTranslations(keyPrefix?: string, options?: Omit<UseTranslationOptions<undefined>, 'keyPrefix'>) {
  return useTranslation('spaces', {
    ...options,
    keyPrefix
  })
}
