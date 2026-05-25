import type { KeyPrefix } from 'i18next'
import { useTranslation, type UseTranslationOptions } from 'react-i18next'

type CommonKeyPrefix = KeyPrefix<'common'>
type HeaderKeyPrefix = KeyPrefix<'header'>
type SpacesKeyPrefix = KeyPrefix<'spaces'>

type TranslationOptions<KPrefix> = Omit<UseTranslationOptions<KPrefix>, 'keyPrefix'>

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
export function useCommonTranslations<KPrefix extends CommonKeyPrefix = undefined>(
    keyPrefix?: KPrefix,
    options?: TranslationOptions<KPrefix>
) {
    return useTranslation('common', {
        ...options,
        keyPrefix
    })
}

/**
 * Hook for accessing header translations
 */
export function useHeaderTranslations<KPrefix extends HeaderKeyPrefix = undefined>(
    keyPrefix?: KPrefix,
    options?: TranslationOptions<KPrefix>
) {
    return useTranslation('header', {
        ...options,
        keyPrefix
    })
}

/**
 * Hook for accessing spaces translations
 */
export function useSpacesTranslations<KPrefix extends SpacesKeyPrefix = undefined>(
    keyPrefix?: KPrefix,
    options?: TranslationOptions<KPrefix>
) {
    return useTranslation('spaces', {
        ...options,
        keyPrefix
    })
}
