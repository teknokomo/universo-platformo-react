// Universo Platformo | Start Frontend i18n
// Register onboarding and legal namespaces
import { registerNamespace } from '@universo/i18n/registry'
import enOnboarding from './locales/en/onboarding.json'
import ruOnboarding from './locales/ru/onboarding.json'
import enLegal from './locales/en/legal.json'
import ruLegal from './locales/ru/legal.json'

// Register namespaces
registerNamespace('onboarding', {
    en: enOnboarding,
    ru: ruOnboarding
})

registerNamespace('legal', {
    en: enLegal,
    ru: ruLegal
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
