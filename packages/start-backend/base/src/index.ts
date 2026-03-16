/**
 * Universo Platformo | Start Backend
 *
 * Provides onboarding functionality for new users:
 * - Predefined catalog data (Goals, Topics, Features) with VLC localization
 * - User selection tracking via rel_user_selections
 * - Onboarding completion flow
 */

export { initializeRateLimiters, getRateLimiters, createStartServiceRoutes } from './routes/index'
export { startSystemAppDefinition } from './platform/systemAppDefinition'
export type { CatalogKind, OnboardingCatalogRow, UserSelectionRow } from './persistence/onboardingStore'
