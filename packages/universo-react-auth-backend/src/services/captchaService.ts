/**
 * Yandex Smart Captcha validation service for authentication
 *
 * Re-exports shared captcha service from @universo-react/utils with authentication-specific configurations.
 * Supports separate captcha settings for registration and login forms.
 *
 * SECURITY: Fail-closed behavior - if captcha service is unavailable,
 * authentication requests are REJECTED to prevent bot bypass during outages.
 *
 * @see https://yandex.cloud/en/docs/smartcaptcha/concepts/validation
 */
import {
    createRegistrationCaptchaService,
    createLoginCaptchaService,
    getGuestCaptchaConfig as getSharedGuestCaptchaConfig,
    validateCaptchaToken
} from '@universo-react/utils/captcha'

// Re-export types for backwards compatibility
export type { CaptchaValidationResult, CaptchaConfig } from '@universo-react/utils/captcha'

// Create service instances
const registrationCaptchaService = createRegistrationCaptchaService()
const loginCaptchaService = createLoginCaptchaService()

// ============================================================================
// Registration Captcha (existing functionality)
// ============================================================================

/**
 * Get captcha configuration for frontend (registration form)
 * Returns configuration based on environment variables
 */
export const getCaptchaConfig = registrationCaptchaService.getCaptchaConfig

/**
 * Check if captcha validation is required for registration
 */
export const isCaptchaRequired = registrationCaptchaService.isCaptchaRequired

/**
 * Validates captcha token against Yandex SmartCaptcha API for registration
 * @param token - Token received from frontend SmartCaptcha widget
 * @param ip - Client IP address for additional validation
 * @returns Promise with validation result
 */
export const validateCaptcha = registrationCaptchaService.validateCaptcha

/** Always validate a link-configured guest CAPTCHA, independent of site-wide auth settings. */
export const validateRequiredGuestCaptcha = (token: string, ip: string) =>
    validateCaptchaToken(token, ip, {
        enabledEnvVar: 'SMARTCAPTCHA_GUEST_INTAKE_ENABLED',
        logPrefix: '[captcha-guest]',
        forceRequired: true
    })

// ============================================================================
// Login Captcha (new functionality)
// ============================================================================

/**
 * Get captcha configuration for frontend (login form)
 * Returns configuration based on environment variables
 */
export const getLoginCaptchaConfig = loginCaptchaService.getLoginCaptchaConfig

/** Public SmartCaptcha widget settings for per-link guest intake protection. */
export const getGuestCaptchaConfig = getSharedGuestCaptchaConfig

/**
 * Check if captcha validation is required for login
 */
export const isLoginCaptchaRequired = loginCaptchaService.isLoginCaptchaRequired

/**
 * Validates captcha token against Yandex SmartCaptcha API for login
 * @param token - Token received from frontend SmartCaptcha widget
 * @param ip - Client IP address for additional validation
 * @returns Promise with validation result
 */
export const validateLoginCaptcha = loginCaptchaService.validateLoginCaptcha
