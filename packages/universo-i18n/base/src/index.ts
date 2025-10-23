// Side-effect import: initializes i18n instance on module load
import { getInstance } from './instance'

// Initialize the global instance immediately
getInstance()

// Export the instance and utilities
export { getInstance } from './instance'
export { registerNamespace } from './registry'
export { useTranslation } from './hooks'
export type { I18nInstance, NamespaceTranslations } from './types'

// Default export for backwards compatibility
export default getInstance()
