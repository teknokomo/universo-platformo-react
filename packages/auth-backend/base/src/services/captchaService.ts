/**
 * Yandex Smart Captcha validation service for authentication
 *
 * Re-exports shared captcha service from @universo/utils with authentication-specific configurations.
 * Supports separate captcha settings for registration and login forms.
 *
 * SECURITY: Fail-closed behavior - if captcha service is unavailable,
 * authentication requests are REJECTED to prevent bot bypass during outages.
 *
 * @see https://yandex.cloud/en/docs/smartcaptcha/concepts/validation
 */
import { createRegistrationCaptchaService, createLoginCaptchaService } from '@universo/utils/captcha'

// Re-export types for backwards compatibility
export type { CaptchaValidationResult, CaptchaConfig } from '@universo/utils/captcha'

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

// ============================================================================
// Login Captcha (new functionality)
// ============================================================================

/**
 * Get captcha configuration for frontend (login form)
 * Returns configuration based on environment variables
 */
export const getLoginCaptchaConfig = loginCaptchaService.getLoginCaptchaConfig

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
