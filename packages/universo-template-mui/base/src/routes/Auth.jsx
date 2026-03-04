/**
 * Universo Platformo | Application Auth Page Wrapper
 *
 * Integrates AuthPage from @universo/auth-frontend with application-specific:
 * - i18n translations via @universo/i18n
 * - CASL permissions refresh via @universo/store
 * - MainCard styling via @universo/template-mui
 */
import { useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { AuthPage, mapSupabaseError } from '@universo/auth-frontend'
import MainCard from '../components/cards/MainCard'
import { useTranslation } from '@universo/i18n'
import { useAbility } from '@universo/store'

/**
 * Card slot wrapper using MainCard for consistent UI styling
 */
const CardSlot = ({ children, sx, ...props }) => (
    <MainCard sx={sx} {...props}>
        {children}
    </MainCard>
)

CardSlot.propTypes = {
    children: PropTypes.node,
    sx: PropTypes.object
}

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
            successRegisterNoEmail: t('successRegisterNoEmail'),
            loginSuccess: t('loginSuccess'),
            loginError: (error) => t('loginError', { error }),
            // Consent labels for registration form
            termsCheckbox: t('termsCheckbox'),
            termsLink: t('termsLink'),
            privacyCheckbox: t('privacyCheckbox'),
            privacyLink: t('privacyLink'),
            privacySuffix: t('privacySuffix'),
            consentRequired: t('consentRequired'),
            captchaRequired: t('captchaRequired'),
            // Feature toggle labels
            registrationDisabled: t('registrationDisabled'),
            loginDisabled: t('loginDisabled')
        }),
        [t]
    )

    const handleErrorMapping = useCallback((message) => t(mapSupabaseError(message)), [t])

    return <AuthPage labels={labels} onLoginSuccess={refreshAbility} errorMapper={handleErrorMapping} slots={{ Card: CardSlot }} />
}

export default Auth
