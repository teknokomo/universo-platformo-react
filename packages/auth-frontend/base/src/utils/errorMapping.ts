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
 * @returns Translation key suffix (e.g., 'invalidCredentials')
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

    if (errorMessage.includes('Invalid login credentials')) return 'invalidCredentials'
    if (errorMessage.includes('User already registered')) return 'userAlreadyRegistered'
    if (errorMessage.includes('Email not confirmed')) return 'emailNotConfirmed'
    if (errorMessage.includes('Password should be')) return 'passwordRequirements'
    if (errorMessage.includes('Email is invalid')) return 'invalidEmail'

    return 'serverError'
}
