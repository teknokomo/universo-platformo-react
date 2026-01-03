// Universo Platformo | Start Frontend i18n
// Register onboarding, landing, legal, and cookies namespaces
import { registerNamespace } from '@universo/i18n/registry'
import enOnboarding from './locales/en/onboarding.json'
import ruOnboarding from './locales/ru/onboarding.json'
import enLanding from './locales/en/landing.json'
import ruLanding from './locales/ru/landing.json'
import enLegal from './locales/en/legal.json'
import ruLegal from './locales/ru/legal.json'
import enCookies from './locales/en/cookies.json'
import ruCookies from './locales/ru/cookies.json'

// Register namespaces
registerNamespace('onboarding', {
    en: enOnboarding,
    ru: ruOnboarding
})

registerNamespace('landing', {
    en: enLanding,
    ru: ruLanding
})

registerNamespace('legal', {
    en: enLegal,
    ru: ruLegal
})

registerNamespace('cookies', {
    en: enCookies,
    ru: ruCookies
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
