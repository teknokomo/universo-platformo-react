/**
 * Universo Platformo | AuthPage Component
 *
 * Full authentication page with login/register forms.
 * Provides integration points via callbacks for application-specific logic.
 */
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { BoxProps } from '@mui/material'

import { clearStoredCsrfToken } from '../api/client'
import { useAuth } from '../providers/authProvider'
import { AuthView, type AuthViewLabels, type CaptchaConfig, type AuthFeatureConfig } from '../components/AuthView'

export interface AuthPageProps {
    /**
     * Localized labels for the authentication form.
     * All fields are required for proper display.
     */
    labels: AuthViewLabels

    /**
     * Called after successful login, before navigation.
     * Use for side effects like refreshing CASL permissions.
     * Errors are caught and logged but don't block navigation.
     */
    onLoginSuccess?: () => Promise<void> | void

    /**
     * Maps API error messages to display strings.
     * @param message - Raw error message from API
     * @returns Translated or user-friendly error message
     */
    errorMapper?: (message: string) => string

    /**
     * Redirect path after successful login.
     * Defaults to location.state.from or '/'
     */
    redirectTo?: string

    /**
     * Custom UI slots for AuthView composition.
     * Card slot is commonly used for custom card styling (e.g., MainCard).
     */
    slots?: {
        Card?: ComponentType<{ children: ReactNode; sx?: BoxProps['sx'] }>
    }
}

/**
 * Full authentication page component.
 *
 * Handles:
 * - Login/register form display via AuthView
 * - Automatic redirect if already authenticated
 * - Post-login side effects via onLoginSuccess callback
 * - Navigation after successful authentication
 *
 * @example
 * ```tsx
 * import { AuthPage } from '@universo/auth-frontend'
 * import { useTranslation } from '@universo/i18n'
 * import { useAbility } from '@flowise/store'
 *
 * const AuthRoute = () => {
 *   const { t } = useTranslation('auth')
 *   const { refreshAbility } = useAbility()
 *
 *   // Note: When using useTranslation('auth'), the namespace is already set,
 *   // so keys should NOT have 'auth.' prefix
 *   const labels = useMemo(() => ({
 *     welcomeBack: t('welcomeBack'),
 *     // ... other labels
 *   }), [t])
 *
 *   return (
 *     <AuthPage
 *       labels={labels}
 *       onLoginSuccess={refreshAbility}
 *       errorMapper={(msg) => t(mapSupabaseError(msg))}
 *     />
 *   )
 * }
 * ```
 */
export const AuthPage = ({ labels, onLoginSuccess, errorMapper, redirectTo, slots }: AuthPageProps): JSX.Element | null => {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, client, isAuthenticated, loading } = useAuth()
    const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig | undefined>(undefined)
    const [authFeatureConfig, setAuthFeatureConfig] = useState<AuthFeatureConfig | undefined>(undefined)

    // Memoize redirect path calculation to avoid duplication (DRY principle)
    const getRedirectPath = useCallback(() => {
        return (location.state as { from?: string } | null)?.from ?? redirectTo ?? '/'
    }, [location.state, redirectTo])

    // Memoize handlers to prevent unnecessary re-renders of AuthView
    // IMPORTANT: All hooks must be called unconditionally before any early returns
    const handleLogin = useCallback(
        async (email: string, password: string, captchaToken?: string): Promise<void> => {
            await login(email, password, captchaToken)

            // Execute post-login callback (e.g., refresh CASL abilities)
            // Non-critical: errors logged but don't block navigation
            if (onLoginSuccess) {
                try {
                    await onLoginSuccess()
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err)
                    console.warn('[AuthPage] onLoginSuccess callback failed:', errorMessage)
                }
            }

            navigate(getRedirectPath(), { replace: true })
        },
        [login, onLoginSuccess, navigate, getRedirectPath]
    )

    const handleRegister = useCallback(
        async (
            email: string,
            password: string,
            termsAccepted?: boolean,
            privacyAccepted?: boolean,
            captchaToken?: string
        ): Promise<void> => {
            if (!client) {
                throw new Error('Auth client not initialized')
            }

            const doRegister = async () => {
                return await client.post('auth/register', {
                    email,
                    password,
                    termsAccepted,
                    privacyAccepted,
                    captchaToken
                })
            }

            try {
                await doRegister()
            } catch (err: unknown) {
                const axiosErr = err as { response?: { status?: number } }
                const status = axiosErr?.response?.status
                if (status === 419) {
                    clearStoredCsrfToken(client)
                    await doRegister()
                    return
                }
                throw err
            }
        },
        [client]
    )

    // Fetch captcha configuration from backend on mount
    useEffect(() => {
        if (!client) return

        const fetchCaptchaConfig = async () => {
            try {
                const response = await client.get<CaptchaConfig>('auth/captcha-config')
                console.info('[AuthPage] Captcha config received:', response.data)
                setCaptchaConfig(response.data)
            } catch (err) {
                console.warn('[AuthPage] Failed to fetch captcha config:', err)
                // Default to disabled if fetch fails
                setCaptchaConfig({ enabled: false, siteKey: null, testMode: false })
            }
        }

        fetchCaptchaConfig()
    }, [client])

    // Fetch auth feature configuration from backend on mount
    useEffect(() => {
        if (!client) return

        const fetchAuthFeatureConfig = async () => {
            try {
                const response = await client.get<AuthFeatureConfig>('auth/auth-config')
                console.info('[AuthPage] Auth feature config received:', response.data)
                setAuthFeatureConfig(response.data)
            } catch (err) {
                console.warn('[AuthPage] Failed to fetch auth feature config:', err)
                // Default to all enabled if fetch fails (backwards compatibility)
                setAuthFeatureConfig({
                    registrationEnabled: true,
                    loginEnabled: true,
                    emailConfirmationRequired: true
                })
            }
        }

        fetchAuthFeatureConfig()
    }, [client])

    // Redirect if already authenticated
    useEffect(() => {
        if (!loading && isAuthenticated) {
            navigate(getRedirectPath(), { replace: true })
        }
    }, [isAuthenticated, loading, navigate, getRedirectPath])

    // Don't render until client is ready (after all hooks are called)
    if (!client) return null

    return (
        <AuthView
            labels={labels}
            onLogin={handleLogin}
            onRegister={handleRegister}
            errorMapper={errorMapper}
            captchaConfig={captchaConfig}
            authFeatureConfig={authFeatureConfig}
            slots={slots}
        />
    )
}

export default AuthPage
