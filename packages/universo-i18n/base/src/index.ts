import { getInstance } from './instance'

// Export utilities
export { getInstance } from './instance'
export { registerNamespace } from './registry'
export type { I18nInstance, NamespaceTranslations } from './types'

// Export custom hooks
export { useCommonTranslations, useHeaderTranslations, useSpacesTranslations } from './hooks'

// Re-export react-i18next hook directly (no wrapper needed)
export { useTranslation } from 'react-i18next'

// Default export: initialized singleton instance
export default getInstance()
