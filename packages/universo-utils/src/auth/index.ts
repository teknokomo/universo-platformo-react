/**
 * Auth Feature Toggles Service
 *
 * Provides configuration for auth feature toggles (registration, login, email confirmation).
 * Follows the same pattern as captcha service for consistency.
 *
 * @example
 * ```typescript
 * import { getAuthFeatureConfig, isRegistrationEnabled } from '@universo/utils/auth'
 *
 * // Get full config for API response
 * const config = getAuthFeatureConfig()
 *
 * // Check individual features
 * if (!isRegistrationEnabled()) {
 *   return res.status(403).json({ error: 'Registration is currently disabled' })
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface AuthFeatureConfig {
    /**
     * Whether new user registration is enabled
     * @default true
     */
    registrationEnabled: boolean

    /**
     * Whether user login is enabled
     * @default true
     */
    loginEnabled: boolean

    /**
     * Whether email confirmation is required after registration
     * Controls the UI message shown to users.
     * Actual email confirmation is configured in Supabase Dashboard.
     * @default true
     */
    emailConfirmationRequired: boolean
}

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Get auth feature configuration from environment variables
 *
 * All features default to `true` for backwards compatibility.
 * Only explicitly setting to 'false' disables a feature.
 *
 * @returns AuthFeatureConfig object for API response
 */
export function getAuthFeatureConfig(): AuthFeatureConfig {
    return {
        registrationEnabled: isRegistrationEnabled(),
        loginEnabled: isLoginEnabled(),
        emailConfirmationRequired: isEmailConfirmationRequired()
    }
}

/**
 * Check if new user registration is enabled
 *
 * @returns true if registration is enabled (default), false only if explicitly disabled
 */
export function isRegistrationEnabled(): boolean {
    return process.env.AUTH_REGISTRATION_ENABLED !== 'false'
}

/**
 * Check if user login is enabled
 *
 * @returns true if login is enabled (default), false only if explicitly disabled
 */
export function isLoginEnabled(): boolean {
    return process.env.AUTH_LOGIN_ENABLED !== 'false'
}

/**
 * Check if email confirmation is required after registration
 *
 * This controls the UI message shown to users.
 * The actual email confirmation behavior is configured in Supabase Dashboard.
 *
 * @returns true if email confirmation is required (default), false only if explicitly disabled
 */
export function isEmailConfirmationRequired(): boolean {
    return process.env.AUTH_EMAIL_CONFIRMATION_REQUIRED !== 'false'
}
