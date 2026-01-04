/**
 * Universo Platformo | Supabase Auth Error Mapping
 *
 * Maps Supabase authentication error messages to i18n translation keys.
 * These keys correspond to translations in @universo/i18n auth namespace.
 */

/**
 * Maps Supabase error messages to i18n translation key suffixes.
 *
 * @param errorMessage - Raw error message from Supabase API
 * @returns Translation key suffix (e.g., 'loginFailed', 'serverError')
 *
 * @example
 * ```typescript
 * import { mapSupabaseError } from '@universo/auth-frontend'
 * import { useTranslation } from '@universo/i18n'
 *
 * // Note: When using useTranslation('auth'), the namespace is already set,
 * // so keys should NOT have 'auth.' prefix
 * const { t } = useTranslation('auth')
 * const translatedError = t(mapSupabaseError(error.message))
 * ```
 */
export const mapSupabaseError = (errorMessage: string | null | undefined): string => {
    if (!errorMessage) return 'unknownError'

    // Match both Supabase phrase and our backend message for login failures
    // Security: Uses generic message that doesn't reveal if email exists (OWASP best practice)
    if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('Invalid credentials')) {
        return 'loginFailed'
    }
    if (errorMessage.includes('User already registered')) return 'userAlreadyRegistered'
    if (errorMessage.includes('Email not confirmed')) return 'emailNotConfirmed'
    if (errorMessage.includes('Password should be')) return 'passwordRequirements'
    if (errorMessage.includes('Email is invalid')) return 'invalidEmail'

    return 'serverError'
}
