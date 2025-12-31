/**
 * Universo Platformo | Start Frontend
 *
 * Frontend module for onboarding and start page functionality
 */

// Components
export { OnboardingWizard } from './components/OnboardingWizard'
export { SelectableListCard } from './components/SelectableListCard'
export { CookieConsentBanner } from './components/CookieConsentBanner'
export { CookieRejectionDialog } from './components/CookieRejectionDialog'

// Hooks
export { useCookieConsent } from './hooks/useCookieConsent'
export type { CookieConsentStatus } from './hooks/useCookieConsent'

// Views
export * from './views'

// API
export * from './api/onboarding'

// Types
export * from './types'

// i18n registration
export { registerOnboardingI18n, registerLandingI18n, registerCookiesI18n } from './i18n/register'
