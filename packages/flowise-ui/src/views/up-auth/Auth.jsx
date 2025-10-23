import React, { useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, AuthView } from '@universo/auth-frt'
import { MainCard } from '@flowise/template-mui'
import { useTranslation } from '@universo/i18n/hooks'

const mapSupabaseError = (errorMessage) => {
    if (!errorMessage) return 'auth.unknownError'
    if (errorMessage.includes('Invalid login credentials')) return 'auth.invalidCredentials'
    if (errorMessage.includes('User already registered')) return 'auth.userAlreadyRegistered'
    if (errorMessage.includes('Email not confirmed')) return 'auth.emailNotConfirmed'
    if (errorMessage.includes('Password should be')) return 'auth.passwordRequirements'
    if (errorMessage.includes('Email is invalid')) return 'auth.invalidEmail'
    return 'auth.serverError'
}

const CardSlot = ({ children, sx, ...props }) => (
    <MainCard sx={sx} {...props}>
        {children}
    </MainCard>
)

const Auth = () => {
    const { t } = useTranslation('auth')
    const navigate = useNavigate()
    const location = useLocation()
    const { login, client, isAuthenticated, loading } = useAuth()

    useEffect(() => {
        if (!loading && isAuthenticated) {
            const from = location.state?.from || '/'
            navigate(from, { replace: true })
        }
    }, [isAuthenticated, loading, navigate, location])

    if (!client) return null

    const labels = useMemo(
        () => ({
            welcomeBack: t('auth.welcomeBack'),
            register: t('auth.register'),
            email: t('auth.email'),
            password: t('auth.password'),
            loginButton: t('auth.loginButton'),
            registerButton: t('auth.registerButton'),
            loggingIn: t('auth.loggingIn'),
            registering: t('auth.registering'),
            noAccount: t('auth.noAccount'),
            createAccount: t('auth.registerLink'),
            haveAccount: t('auth.hasAccount'),
            loginInstead: t('auth.loginLink'),
            fieldsRequired: t('auth.fieldsRequired'),
            successRegister: t('auth.successRegister'),
            loginSuccess: t('auth.loginSuccess'),
            loginError: (error) => t('auth.loginError', { error }),
        }),
        [t]
    )

    const handleLogin = async (email, password) => {
        await login(email, password)
        const from = location.state?.from || '/'
        navigate(from, { replace: true })
    }

    const handleRegister = async (email, password) => {
        await client.post('auth/register', { email, password })
    }

    return (
        <AuthView
            labels={labels}
            onLogin={handleLogin}
            onRegister={handleRegister}
            errorMapper={(message) => t(mapSupabaseError(message))}
            slots={{ Card: CardSlot }}
        />
    )
}

export default Auth
