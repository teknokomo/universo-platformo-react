/**
 * Universo Platformo | Application Auth Page Wrapper
 *
 * Integrates AuthPage from @universo/auth-frontend with application-specific:
 * - i18n translations via @universo/i18n
 * - CASL permissions refresh via @flowise/store
 * - MainCard styling via @flowise/template-mui
 */
import { useCallback, useMemo } from 'react'
import { AuthPage, mapSupabaseError } from '@universo/auth-frontend'
import { MainCard } from '@flowise/template-mui'
import { useTranslation } from '@universo/i18n'
import { useAbility } from '@flowise/store'

/**
 * Card slot wrapper using MainCard for consistent UI styling
 */
const CardSlot = ({ children, sx, ...props }) => (
    <MainCard sx={sx} {...props}>
        {children}
    </MainCard>
)

/**
 * Application-specific Auth wrapper with i18n and CASL integration.
 *
 * This wrapper combines:
 * - Generic AuthPage component from @universo/auth-frontend
 * - Localized labels from auth namespace
 * - CASL ability refresh after successful login
 * - Supabase error message mapping to i18n keys
 * - MainCard styling for consistent UI
 */
const Auth = () => {
    const { t } = useTranslation('auth')
    const { refreshAbility } = useAbility()

    // Note: When using useTranslation('auth'), the namespace is already 'auth',
    // so keys should NOT have 'auth.' prefix. The JSON structure { "auth": { "key": "value" } }
    // is unwrapped during i18n init (see instance.ts: auth: authEn.auth)
    const labels = useMemo(
        () => ({
            welcomeBack: t('welcomeBack'),
            register: t('register'),
            email: t('email'),
            password: t('password'),
            loginButton: t('loginButton'),
            registerButton: t('registerButton'),
            loggingIn: t('loggingIn'),
            registering: t('registering'),
            noAccount: t('noAccount'),
            createAccount: t('registerLink'),
            haveAccount: t('hasAccount'),
            loginInstead: t('loginLink'),
            fieldsRequired: t('fieldsRequired'),
            successRegister: t('successRegister'),
            loginSuccess: t('loginSuccess'),
            loginError: (error) => t('loginError', { error })
        }),
        [t]
    )

    // Use useCallback for memoizing functions (more semantically correct than useMemo)
    const handleErrorMapping = useCallback((message) => t(mapSupabaseError(message)), [t])

    return <AuthPage labels={labels} onLoginSuccess={refreshAbility} errorMapper={handleErrorMapping} slots={{ Card: CardSlot }} />
}

export default Auth
