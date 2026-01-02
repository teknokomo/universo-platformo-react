/**
 * Universo Platformo | Yandex SmartCaptcha Validation Service
 *
 * Shared captcha validation logic for all backend services.
 * Uses axios for HTTP requests with proper timeout and error handling.
 *
 * SECURITY: Fail-closed behavior - if captcha service is unavailable,
 * requests are REJECTED to prevent bot bypass during outages.
 *
 * @see https://yandex.cloud/en/docs/smartcaptcha/concepts/validation
 */
import axios, { AxiosError } from 'axios'

// ============================================================================
// Types
// ============================================================================

export interface CaptchaValidationResult {
    success: boolean
    error?: string
}

export interface CaptchaConfig {
    enabled: boolean
    siteKey: string | null
    testMode: boolean
}

export interface CaptchaServiceOptions {
    /**
     * Environment variable name for enabled flag
     * @example 'SMARTCAPTCHA_REGISTRATION_ENABLED' or 'SMARTCAPTCHA_PUBLICATION_ENABLED'
     */
    enabledEnvVar: string

    /**
     * Log prefix for debugging
     * @example '[captcha]' or '[leads-captcha]'
     */
    logPrefix: string

    /**
     * Request timeout in milliseconds
     * @default 5000
     */
    timeout?: number
}

// ============================================================================
// Constants
// ============================================================================

const SMARTCAPTCHA_VALIDATE_URL = 'https://smartcaptcha.yandexcloud.net/validate'
const DEFAULT_TIMEOUT = 5000

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if captcha validation is required based on environment configuration
 *
 * @param enabledEnvVar - Environment variable name to check (e.g., 'SMARTCAPTCHA_REGISTRATION_ENABLED')
 * @returns true if captcha is enabled and properly configured
 */
export function isCaptchaRequired(enabledEnvVar: string): boolean {
    const enabled = process.env[enabledEnvVar] === 'true'
    const hasServerKey = !!process.env.SMARTCAPTCHA_SERVER_KEY
    const hasSiteKey = !!process.env.SMARTCAPTCHA_SITE_KEY
    return enabled && hasServerKey && hasSiteKey
}

/**
 * Get captcha configuration for frontend
 *
 * @param enabledEnvVar - Environment variable name for enabled flag
 * @param logPrefix - Prefix for log messages
 * @returns CaptchaConfig object for frontend consumption
 */
export function getCaptchaConfig(enabledEnvVar: string, logPrefix: string): CaptchaConfig {
    const enabled = process.env[enabledEnvVar] === 'true'
    const siteKey = process.env.SMARTCAPTCHA_SITE_KEY || null
    const testMode = process.env.SMARTCAPTCHA_TEST_MODE === 'true'

    // eslint-disable-next-line no-console
    console.info(`${logPrefix} Config loaded:`, { enabled, hasSiteKey: !!siteKey, testMode })

    return {
        enabled: enabled && !!siteKey,
        siteKey: enabled ? siteKey : null,
        testMode
    }
}

/**
 * Validates captcha token against Yandex SmartCaptcha API
 *
 * SECURITY: Implements fail-closed pattern - all errors result in rejection
 *
 * @param token - Token received from frontend SmartCaptcha widget
 * @param ip - Client IP address for additional validation (optional)
 * @param options - Service configuration options
 * @returns Promise with validation result
 *
 * @example
 * ```typescript
 * const result = await validateCaptchaToken('token123', '192.168.1.1', {
 *   enabledEnvVar: 'SMARTCAPTCHA_REGISTRATION_ENABLED',
 *   logPrefix: '[captcha]'
 * })
 * if (!result.success) {
 *   throw new Error(result.error)
 * }
 * ```
 */
export async function validateCaptchaToken(token: string, ip: string, options: CaptchaServiceOptions): Promise<CaptchaValidationResult> {
    const { enabledEnvVar, logPrefix, timeout = DEFAULT_TIMEOUT } = options

    // If captcha is disabled, allow the request
    if (!isCaptchaRequired(enabledEnvVar)) {
        // eslint-disable-next-line no-console
        console.info(`${logPrefix} Captcha is disabled, skipping validation`)
        return { success: true }
    }

    const serverKey = process.env.SMARTCAPTCHA_SERVER_KEY

    // If server key is not configured but captcha is required, reject (fail-closed)
    if (!serverKey) {
        // eslint-disable-next-line no-console
        console.error(`${logPrefix} SMARTCAPTCHA_SERVER_KEY not configured but captcha is required`)
        return { success: false, error: 'Captcha service is not configured' }
    }

    if (!token) {
        return { success: false, error: 'Captcha token is required' }
    }

    // Build query parameters
    const params: Record<string, string> = {
        secret: serverKey,
        token
    }
    if (ip) {
        params.ip = ip
    }

    try {
        const response = await axios.get<{ status: string; message?: string }>(SMARTCAPTCHA_VALIDATE_URL, {
            params,
            timeout,
            // Don't throw on non-2xx status - we handle it manually
            validateStatus: () => true
        })

        if (response.status !== 200) {
            // eslint-disable-next-line no-console
            console.error(`${logPrefix} Validation API error`, { statusCode: response.status })
            // Fail-closed: reject on API error
            return { success: false, error: 'Captcha service unavailable' }
        }

        const result = response.data
        if (result.status === 'ok') {
            // eslint-disable-next-line no-console
            console.info(`${logPrefix} Validation passed`)
            return { success: true }
        } else {
            // eslint-disable-next-line no-console
            console.warn(`${logPrefix} Validation failed`, { status: result.status })
            return { success: false, error: 'Captcha verification failed' }
        }
    } catch (error: unknown) {
        const axiosError = error as AxiosError

        // Check for timeout
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
            // eslint-disable-next-line no-console
            console.error(`${logPrefix} Request timeout`)
            return { success: false, error: 'Captcha service timeout' }
        }

        // Network or other error
        // eslint-disable-next-line no-console
        console.error(`${logPrefix} Request failed`, { error: axiosError.message })
        // Fail-closed: reject on network error
        return { success: false, error: 'Captcha service unavailable' }
    }
}

// ============================================================================
// Factory Functions for Specific Use Cases
// ============================================================================

/**
 * Creates a captcha service for registration (auth-backend)
 */
export function createRegistrationCaptchaService() {
    const options: CaptchaServiceOptions = {
        enabledEnvVar: 'SMARTCAPTCHA_REGISTRATION_ENABLED',
        logPrefix: '[captcha-register]'
    }

    return {
        isCaptchaRequired: () => isCaptchaRequired(options.enabledEnvVar),
        getCaptchaConfig: () => getCaptchaConfig(options.enabledEnvVar, options.logPrefix),
        validateCaptcha: (token: string, ip: string) => validateCaptchaToken(token, ip, options)
    }
}

/**
 * Creates a captcha service for login (auth-backend)
 */
export function createLoginCaptchaService() {
    const options: CaptchaServiceOptions = {
        enabledEnvVar: 'SMARTCAPTCHA_LOGIN_ENABLED',
        logPrefix: '[captcha-login]'
    }

    return {
        isLoginCaptchaRequired: () => isCaptchaRequired(options.enabledEnvVar),
        getLoginCaptchaConfig: () => getCaptchaConfig(options.enabledEnvVar, options.logPrefix),
        validateLoginCaptcha: (token: string, ip: string) => validateCaptchaToken(token, ip, options)
    }
}

/**
 * Creates a captcha service for publications (leads-backend)
 */
export function createPublicationCaptchaService() {
    const options: CaptchaServiceOptions = {
        enabledEnvVar: 'SMARTCAPTCHA_PUBLICATION_ENABLED',
        logPrefix: '[captcha-leads]'
    }

    return {
        isPublicationCaptchaRequired: () => isCaptchaRequired(options.enabledEnvVar),
        validatePublicationCaptcha: (token: string, ip: string) => validateCaptchaToken(token, ip, options)
    }
}
