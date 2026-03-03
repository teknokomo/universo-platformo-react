import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeLocale } from '../../../utils/localizedInput'
import { useSettingValue } from './useSettings'

const SYSTEM_LANGUAGE_OPTION = 'system'

export const useMetahubPrimaryLocale = (): string => {
    const { i18n } = useTranslation('metahubs')
    const languageSetting = useSettingValue<string>('general.language')

    return useMemo(() => {
        if (typeof languageSetting === 'string') {
            const trimmed = languageSetting.trim()
            if (trimmed.length > 0 && trimmed !== SYSTEM_LANGUAGE_OPTION) {
                return normalizeLocale(trimmed)
            }
        }
        return normalizeLocale(i18n.language)
    }, [languageSetting, i18n.language])
}
