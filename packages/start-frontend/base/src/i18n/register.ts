/**
 * Universo Platformo | Start Frontend i18n Registration
 *
 * Registers onboarding, landing, legal, and cookies translations with the i18n instance
 */
import type { i18n as I18nInstance } from 'i18next'
import onboardingEn from './locales/en/onboarding.json'
import onboardingRu from './locales/ru/onboarding.json'
import landingEn from './locales/en/landing.json'
import landingRu from './locales/ru/landing.json'
import legalEn from './locales/en/legal.json'
import legalRu from './locales/ru/legal.json'
import cookiesEn from './locales/en/cookies.json'
import cookiesRu from './locales/ru/cookies.json'

/**
 * Registers onboarding i18n resources with the provided i18n instance
 * @param i18n - The i18next instance to register resources with
 */
export function registerOnboardingI18n(i18n: I18nInstance): void {
    // Add English resources
    if (!i18n.hasResourceBundle('en', 'onboarding')) {
        i18n.addResourceBundle('en', 'onboarding', onboardingEn, true, true)
    }

    // Add Russian resources
    if (!i18n.hasResourceBundle('ru', 'onboarding')) {
        i18n.addResourceBundle('ru', 'onboarding', onboardingRu, true, true)
    }
}

/**
 * Registers landing page i18n resources with the provided i18n instance
 * @param i18n - The i18next instance to register resources with
 */
export function registerLandingI18n(i18n: I18nInstance): void {
    // Add English resources
    if (!i18n.hasResourceBundle('en', 'landing')) {
        i18n.addResourceBundle('en', 'landing', landingEn, true, true)
    }

    // Add Russian resources
    if (!i18n.hasResourceBundle('ru', 'landing')) {
        i18n.addResourceBundle('ru', 'landing', landingRu, true, true)
    }
}

/**
 * Registers legal pages i18n resources with the provided i18n instance
 * @param i18n - The i18next instance to register resources with
 */
export function registerLegalI18n(i18n: I18nInstance): void {
    // Add English resources
    if (!i18n.hasResourceBundle('en', 'legal')) {
        i18n.addResourceBundle('en', 'legal', legalEn, true, true)
    }

    // Add Russian resources
    if (!i18n.hasResourceBundle('ru', 'legal')) {
        i18n.addResourceBundle('ru', 'legal', legalRu, true, true)
    }
}

/**
 * Registers cookie consent i18n resources with the provided i18n instance
 * @param i18n - The i18next instance to register resources with
 */
export function registerCookiesI18n(i18n: I18nInstance): void {
    // Add English resources
    if (!i18n.hasResourceBundle('en', 'cookies')) {
        i18n.addResourceBundle('en', 'cookies', cookiesEn, true, true)
    }

    // Add Russian resources
    if (!i18n.hasResourceBundle('ru', 'cookies')) {
        i18n.addResourceBundle('ru', 'cookies', cookiesRu, true, true)
    }
}
