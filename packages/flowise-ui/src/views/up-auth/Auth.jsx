import React, { useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, AuthView } from '@universo/auth-frt'
import { MainCard } from '@flowise/template-mui'
import { useTranslation } from '@universo/i18n'

const mapSupabaseError = (errorMessage) => {
    if (!errorMessage) return 'unknownError'
    if (errorMessage.includes('Invalid login credentials')) return 'invalidCredentials'
    if (errorMessage.includes('User already registered')) return 'userAlreadyRegistered'
    if (errorMessage.includes('Email not confirmed')) return 'emailNotConfirmed'
    if (errorMessage.includes('Password should be')) return 'passwordRequirements'
    if (errorMessage.includes('Email is invalid')) return 'invalidEmail'
    return 'serverError'
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
            loginError: (error) => t('loginError', { error }),
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
