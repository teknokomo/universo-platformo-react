/**
 * Universo Platformo | Publication Captcha Validation Service
 *
 * Re-exports shared captcha service from @universo/utils with publication-specific configuration.
 * Validates captcha tokens for lead forms in published content (quizzes, etc.)
 *
 * SECURITY: Fail-closed behavior - if captcha service is unavailable,
 * requests are REJECTED to prevent bot bypass during outages.
 *
 * @see https://yandex.cloud/en/docs/smartcaptcha/concepts/validation
 */
import { createPublicationCaptchaService } from '@universo/utils/captcha'

// Re-export types for backwards compatibility
export type { CaptchaValidationResult } from '@universo/utils/captcha'

// Create service instance with publication configuration
const captchaService = createPublicationCaptchaService()

/**
 * Check if captcha validation is required for lead forms
 * Uses SMARTCAPTCHA_PUBLICATION_ENABLED (separate from registration)
 */
export const isPublicationCaptchaRequired = captchaService.isPublicationCaptchaRequired

/**
 * Validates captcha token against Yandex SmartCaptcha API
 * @param token - Token received from frontend SmartCaptcha widget
 * @param ip - Client IP address for additional validation
 * @returns Promise with validation result
 */
export const validatePublicationCaptcha = captchaService.validatePublicationCaptcha
