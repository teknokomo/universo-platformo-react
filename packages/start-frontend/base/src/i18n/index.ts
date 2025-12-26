// Universo Platformo | Start Frontend i18n
// Register onboarding namespace
import { registerNamespace } from '@universo/i18n/registry'
import enOnboarding from './locales/en/onboarding.json'
import ruOnboarding from './locales/ru/onboarding.json'

// Register namespace
registerNamespace('onboarding', {
    en: enOnboarding,
    ru: ruOnboarding
})

type LanguageCode = 'en' | 'ru'

interface OnboardingTranslation {
    onboarding: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: OnboardingTranslation
}

// Export translations for backwards compatibility
export const onboardingTranslations: TranslationsMap = {
    en: { onboarding: enOnboarding },
    ru: { onboarding: ruOnboarding }
}

export function getOnboardingTranslations(language: LanguageCode): Record<string, unknown> {
    return onboardingTranslations[language]?.onboarding || onboardingTranslations.en.onboarding
}
