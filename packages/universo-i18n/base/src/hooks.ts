import { useTranslation as useI18nextTranslation } from 'react-i18next'
import { getInstance } from './instance'

export function useTranslation(namespace?: string) {
    // Ensure instance is initialized
    getInstance()

    // Use react-i18next's hook
    return useI18nextTranslation(namespace)
}
