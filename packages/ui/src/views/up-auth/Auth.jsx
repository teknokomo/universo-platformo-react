import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/utils/authProvider'
import { Box, TextField, Button, Typography, Alert, Container, Grid, Link, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MainCard from '@/ui-component/cards/MainCard'
import { IconMail, IconLock } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// Universo Platformo | Map Supabase error messages to translation keys
const mapSupabaseError = (errorMessage) => {
    if (!errorMessage) return 'auth.unknownError'

    // Auth errors
    if (errorMessage.includes('Invalid login credentials')) return 'auth.invalidCredentials'
    if (errorMessage.includes('User already registered')) return 'auth.userAlreadyRegistered'
    if (errorMessage.includes('Email not confirmed')) return 'auth.emailNotConfirmed'
    if (errorMessage.includes('Password should be')) return 'auth.passwordRequirements'
    if (errorMessage.includes('Email is invalid')) return 'auth.invalidEmail'

    // General errors
    return 'auth.serverError'
}

// Universo Platformo | Login & Registration component
const Auth = () => {
    const theme = useTheme()
    const { t } = useTranslation('auth')
    const navigate = useNavigate()
    const location = useLocation()
    const { login, isAuthenticated } = useAuth() // Universo Platformo | Use auth context

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [isLogin, setIsLogin] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    // Universo Platformo | Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            const from = location.state?.from || '/'
            navigate(from)
        }
    }, [isAuthenticated, navigate, location])

    const handleRegister = async (e) => {
        e.preventDefault()
        if (!email || !password) {
            setError(t('auth.fieldsRequired'))
            return
        }

        setError('')
        setInfo('')
        setIsLoading(true)

        try {
            // Universo Platformo | Registration is now handled through our backend
            const response = await fetch(`${window.location.origin}/api/v1/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed')
            }

            setInfo(t('auth.successRegister'))
            // Switch to login form after successful registration
            setIsLogin(true)
        } catch (err) {
            setError(t('auth.registrationError', { error: err.message }))
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        if (!email || !password) {
            setError(t('auth.fieldsRequired'))
            return
        }

        setError('')
        setInfo('')
        setIsLoading(true)

        try {
            // Universo Platformo | Use the login method from auth context
            await login(email, password)
            setInfo(t('auth.loginSuccess'))
            // Redirect will happen automatically in useEffect
        } catch (err) {
            setError(t('auth.loginError', { error: err.message || err.response?.data?.error || 'Unknown error' }))
        } finally {
            setIsLoading(false)
        }
    }

    const toggleAuthMode = (e) => {
        // Prevent form submission when clicking the link
        e.preventDefault()
        e.stopPropagation()

        setIsLogin(!isLogin)
        setError('')
        setInfo('')
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '100vh'
            }}
        >
            <Container maxWidth='sm'>
                <MainCard>
                    <Typography variant='h2' align='center' gutterBottom>
                        {isLogin ? t('auth.welcomeBack') : t('auth.register')}
                    </Typography>

                    {error && (
                        <Alert severity='error' sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    {info && (
                        <Alert severity='success' sx={{ mb: 2 }}>
                            {info}
                        </Alert>
                    )}

                    {isLogin ? (
                        <Box component='form' onSubmit={handleLogin}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='email'
                                        label={t('auth.email')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <IconMail
                                                    stroke={1.5}
                                                    size='20px'
                                                    color={theme.palette.grey[500]}
                                                    style={{ marginRight: '8px' }}
                                                />
                                            )
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='password'
                                        label={t('auth.password')}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <IconLock
                                                    stroke={1.5}
                                                    size='20px'
                                                    color={theme.palette.grey[500]}
                                                    style={{ marginRight: '8px' }}
                                                />
                                            )
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        type='submit'
                                        variant='contained'
                                        color='primary'
                                        size='large'
                                        disabled={isLoading}
                                        startIcon={isLoading && <CircularProgress size={20} color='inherit' />}
                                    >
                                        {isLoading ? t('auth.loggingIn') : t('auth.loginButton')}
                                    </Button>
                                </Grid>
                                <Grid item xs={12} textAlign='center'>
                                    <Typography variant='body2'>
                                        {t('auth.noAccount')}{' '}
                                        <Link
                                            onClick={toggleAuthMode}
                                            sx={{
                                                cursor: 'pointer',
                                                textDecoration: 'none',
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                        >
                                            {t('auth.registerLink')}
                                        </Link>
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    ) : (
                        <Box component='form' onSubmit={handleRegister}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='email'
                                        label={t('auth.email')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <IconMail
                                                    stroke={1.5}
                                                    size='20px'
                                                    color={theme.palette.grey[500]}
                                                    style={{ marginRight: '8px' }}
                                                />
                                            )
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='password'
                                        label={t('auth.password')}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                        InputProps={{
                                            startAdornment: (
                                                <IconLock
                                                    stroke={1.5}
                                                    size='20px'
                                                    color={theme.palette.grey[500]}
                                                    style={{ marginRight: '8px' }}
                                                />
                                            )
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        type='submit'
                                        variant='contained'
                                        color='primary'
                                        size='large'
                                        disabled={isLoading}
                                        startIcon={isLoading && <CircularProgress size={20} color='inherit' />}
                                    >
                                        {isLoading ? t('auth.registering') : t('auth.registerButton')}
                                    </Button>
                                </Grid>
                                <Grid item xs={12} textAlign='center'>
                                    <Typography variant='body2'>
                                        {t('auth.hasAccount')}{' '}
                                        <Link
                                            onClick={toggleAuthMode}
                                            sx={{
                                                cursor: 'pointer',
                                                textDecoration: 'none',
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                        >
                                            {t('auth.loginLink')}
                                        </Link>
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </MainCard>
            </Container>
        </Box>
    )
}

export default Auth
