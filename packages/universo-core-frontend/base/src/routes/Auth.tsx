import { useCallback, useMemo, type ReactNode } from 'react'
import { AuthPage, mapSupabaseError } from '@universo/auth-frontend'
import { MainCard } from '@universo/template-mui'
import { useTranslation } from '@universo/i18n'
import { useAbility } from '@universo/store'

interface CardSlotProps {
    children?: ReactNode
    sx?: Record<string, unknown>
}

const CardSlot = ({ children, sx, ...props }: CardSlotProps) => (
    <MainCard sx={sx} {...props}>
        {children}
    </MainCard>
)

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
            loginError: (error: string) => t('loginError', { error }),
            termsCheckbox: t('termsCheckbox'),
            termsLink: t('termsLink'),
            privacyCheckbox: t('privacyCheckbox'),
            privacyLink: t('privacyLink'),
            privacySuffix: t('privacySuffix'),
            consentRequired: t('consentRequired'),
            captchaRequired: t('captchaRequired'),
            registrationDisabled: t('registrationDisabled'),
            loginDisabled: t('loginDisabled')
        }),
        [t]
    )

    const handleErrorMapping = useCallback((message: string) => t(mapSupabaseError(message)), [t])

    return <AuthPage labels={labels} onLoginSuccess={refreshAbility} errorMapper={handleErrorMapping} slots={{ Card: CardSlot }} />
}

export default Auth