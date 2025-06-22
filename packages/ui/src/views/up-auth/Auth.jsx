import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/utils/authProvider'
import { Box, TextField, Button, Typography, Alert, Container, Grid, Link, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MainCard from '@/ui-component/cards/MainCard'
import { IconMail, IconLock, IconUser } from '@tabler/icons-react'
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
    if (errorMessage.includes('Nickname is already taken')) return 'auth.nicknameAlreadyTaken'

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
    const [nickname, setNickname] = useState('')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [isLogin, setIsLogin] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [nicknameStatus, setNicknameStatus] = useState('') // 'checking', 'available', 'taken', 'error'
    const [nicknameCheckTimeout, setNicknameCheckTimeout] = useState(null)

    // Universo Platformo | Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            const from = location.state?.from || '/'
            navigate(from)
        }
    }, [isAuthenticated, navigate, location])

    // Check nickname availability
    const checkNicknameAvailability = useCallback(async (nicknameToCheck) => {
        if (!nicknameToCheck || nicknameToCheck.length < 3) {
            setNicknameStatus('')
            return
        }

        setNicknameStatus('checking')

        try {
            const response = await fetch(`${window.location.origin}/api/v1/profile/check-nickname/${encodeURIComponent(nicknameToCheck)}`)
            const data = await response.json()

            if (response.ok && data.success) {
                setNicknameStatus(data.data.available ? 'available' : 'taken')
            } else {
                setNicknameStatus('error')
            }
        } catch (err) {
            setNicknameStatus('error')
        }
    }, [])

    // Debounced nickname check
    useEffect(() => {
        if (!isLogin && nickname) {
            if (nicknameCheckTimeout) {
                clearTimeout(nicknameCheckTimeout)
            }

            const timeout = setTimeout(() => {
                checkNicknameAvailability(nickname)
            }, 500) // Check after 500ms of no typing

            setNicknameCheckTimeout(timeout)

            return () => {
                if (timeout) {
                    clearTimeout(timeout)
                }
            }
        }
    }, [nickname, isLogin, checkNicknameAvailability])

    const validateNickname = (nick) => {
        if (!nick) return t('auth.nicknameRequired')
        if (nick.length < 3) return t('auth.nicknameTooShort')
        if (nick.length > 20) return t('auth.nicknameTooLong')
        if (!/^[a-zA-Z0-9_]+$/.test(nick)) return t('auth.nicknameInvalidChars')
        return ''
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        if (!email || !password || !nickname) {
            setError(t('auth.fieldsRequired'))
            return
        }

        // Validate nickname
        const nicknameError = validateNickname(nickname)
        if (nicknameError) {
            setError(nicknameError)
            return
        }

        if (nicknameStatus === 'taken') {
            setError(t('auth.nicknameAlreadyTaken'))
            return
        }

        if (nicknameStatus !== 'available') {
            setError(t('auth.nicknameNotValidated'))
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
                body: JSON.stringify({ email, password, nickname })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed')
            }

            setInfo(t('auth.successRegister'))
            // Switch to login form after successful registration
            setIsLogin(true)
            setNickname('')
            setNicknameStatus('')
        } catch (err) {
            setError(t(mapSupabaseError(err.message)))
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
        setNickname('')
        setNicknameStatus('')
    }

    const getNicknameHelperText = () => {
        if (!nickname) return t('auth.nicknameHelp')

        const validationError = validateNickname(nickname)
        if (validationError) return validationError

        switch (nicknameStatus) {
            case 'checking':
                return t('auth.nicknameChecking')
            case 'available':
                return t('auth.nicknameAvailable')
            case 'taken':
                return t('auth.nicknameAlreadyTaken')
            case 'error':
                return t('auth.nicknameCheckError')
            default:
                return t('auth.nicknameHelp')
        }
    }

    const getNicknameColor = () => {
        if (!nickname) return 'text.secondary'

        const validationError = validateNickname(nickname)
        if (validationError) return 'error.main'

        switch (nicknameStatus) {
            case 'available':
                return 'success.main'
            case 'taken':
            case 'error':
                return 'error.main'
            default:
                return 'text.secondary'
        }
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
                                        type='text'
                                        label={t('auth.nickname')}
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        disabled={isLoading}
                                        required
                                        helperText={
                                            <Typography variant='caption' sx={{ color: getNicknameColor() }}>
                                                {getNicknameHelperText()}
                                            </Typography>
                                        }
                                        InputProps={{
                                            startAdornment: (
                                                <IconUser
                                                    stroke={1.5}
                                                    size='20px'
                                                    color={theme.palette.grey[500]}
                                                    style={{ marginRight: '8px' }}
                                                />
                                            ),
                                            endAdornment: nicknameStatus === 'checking' && <CircularProgress size={16} color='inherit' />
                                        }}
                                        error={nickname && (validateNickname(nickname) !== '' || nicknameStatus === 'taken')}
                                    />
                                </Grid>
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
                                        disabled={isLoading || nicknameStatus !== 'available'}
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
