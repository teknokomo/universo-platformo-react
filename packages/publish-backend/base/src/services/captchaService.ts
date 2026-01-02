/**
 * Universo Platformo | Publication Captcha Service
 * Configuration service for captcha in published content (quizzes, etc.)
 * Uses separate ENV variable from registration captcha for independent control
 * @see https://yandex.cloud/en/docs/smartcaptcha/concepts/validation
 */

export interface PublicationCaptchaConfig {
    enabled: boolean
    siteKey: string | null
    testMode: boolean
}

/**
 * Get captcha configuration for published content (quizzes, AR experiences, etc.)
 * Returns configuration based on environment variables
 * Uses SMARTCAPTCHA_PUBLICATION_ENABLED independently from SMARTCAPTCHA_REGISTRATION_ENABLED
 */
export function getPublicationCaptchaConfig(): PublicationCaptchaConfig {
    const enabled = process.env.SMARTCAPTCHA_PUBLICATION_ENABLED === 'true'
    const siteKey = process.env.SMARTCAPTCHA_SITE_KEY || null
    const testMode = process.env.SMARTCAPTCHA_TEST_MODE === 'true'

    console.info('[publication-captcha] Config loaded:', { enabled, hasSiteKey: !!siteKey, testMode })

    return {
        enabled: enabled && !!siteKey,
        siteKey: enabled ? siteKey : null,
        testMode
    }
}

/**
 * Check if captcha is enabled for publications
 * This does NOT require server key since validation happens client-side in exported HTML
 */
export function isPublicationCaptchaEnabled(): boolean {
    const enabled = process.env.SMARTCAPTCHA_PUBLICATION_ENABLED === 'true'
    const hasSiteKey = !!process.env.SMARTCAPTCHA_SITE_KEY
    return enabled && hasSiteKey
}
