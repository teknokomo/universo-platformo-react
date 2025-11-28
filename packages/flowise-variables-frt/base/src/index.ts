/**
 * @universo/flowise-variables-frt
 *
 * Frontend package for Variables management UI.
 * Contains React components, pages, and i18n resources for variables.
 */

// Pages - main exports
export { Variables, AddEditVariableDialog, HowToUseVariablesDialog } from './pages'

// i18n resources
export { variablesNamespace, variablesResources } from './i18n'

// Re-export types from backend package for convenience
export type { Variable } from '@universo/flowise-variables-srv'
