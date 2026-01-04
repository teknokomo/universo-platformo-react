import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ComponentType, type ReactNode } from 'react'
import {
    Box,
    TextField,
    Button,
    Typography,
    Alert,
    Container as MuiContainer,
    Grid,
    Link,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    type BoxProps,
    type ContainerProps
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconMail, IconLock } from '@tabler/icons-react'
import { SmartCaptcha } from '@yandex/smart-captcha'

export type AuthViewMode = 'login' | 'register'

export interface AuthViewLabels {
    welcomeBack: string
    register: string
    email: string
    password: string
    loginButton: string
    registerButton: string
    loggingIn: string
    registering: string
    noAccount: string
    createAccount: string
    haveAccount: string
    loginInstead: string
    fieldsRequired: string
    successRegister: string
    loginSuccess: string
    loginError: (error: string) => string
    // Consent labels (optional for backwards compatibility)
    termsCheckbox?: string
    termsLink?: string
    privacyCheckbox?: string
    privacyLink?: string
    privacySuffix?: string
    consentRequired?: string
    captchaRequired?: string
    captchaNetworkError?: string
    // Feature toggle messages (optional for backwards compatibility)
    registrationDisabled?: string
    loginDisabled?: string
    successRegisterNoEmail?: string
}

/** Single captcha configuration for a specific form */
export interface SingleCaptchaConfig {
    enabled: boolean
    siteKey: string | null
    testMode: boolean
}

/** Combined captcha configuration from backend API */
export interface CaptchaConfig {
    // Legacy format (backwards compatible)
    enabled: boolean
    siteKey: string | null
    testMode: boolean
    // Separate configs for registration and login
    registration?: SingleCaptchaConfig
    login?: SingleCaptchaConfig
}

/** Auth feature toggles from backend API */
export interface AuthFeatureConfig {
    /** Whether new user registration is enabled */
    registrationEnabled: boolean
    /** Whether user login is enabled */
    loginEnabled: boolean
    /** Whether email confirmation is required (affects success message only) */
    emailConfirmationRequired: boolean
}

export interface AuthViewProps {
    labels: AuthViewLabels
    onLogin: (email: string, password: string, captchaToken?: string) => Promise<void>
    onRegister: (
        email: string,
        password: string,
        termsAccepted?: boolean,
        privacyAccepted?: boolean,
        captchaToken?: string
    ) => Promise<void>
    errorMapper?: (error: string) => string
    initialMode?: AuthViewMode
    /** Captcha configuration from backend API */
    captchaConfig?: CaptchaConfig
    /** Auth feature toggles from backend API */
    authFeatureConfig?: AuthFeatureConfig
    slots?: {
        Root?: ComponentType<{ children: ReactNode; sx?: BoxProps['sx'] }>
        Container?: ComponentType<ContainerProps>
        Card?: ComponentType<{ children: ReactNode; sx?: BoxProps['sx'] }>
    }
    slotProps?: {
        root?: BoxProps
        container?: ContainerProps
        card?: BoxProps
    }
}

export const AuthView = ({
    labels,
    onLogin,
    onRegister,
    errorMapper,
    initialMode = 'login',
    captchaConfig,
    authFeatureConfig,
    slots,
    slotProps
}: AuthViewProps) => {
    const theme = useTheme()
    const [mode, setMode] = useState<AuthViewMode>(initialMode)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [privacyAccepted, setPrivacyAccepted] = useState(false)
    const [captchaToken, setCaptchaToken] = useState('')
    const [error, setError] = useState<string>('')
    const [info, setInfo] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    // Auth feature defaults (all enabled for backwards compatibility)
    const authFeatures = authFeatureConfig ?? {
        registrationEnabled: true,
        loginEnabled: true,
        emailConfirmationRequired: true
    }

    // Get mode-specific captcha config (with legacy fallback for registration)
    const registrationCaptchaConfig = captchaConfig?.registration ?? {
        enabled: captchaConfig?.enabled ?? false,
        siteKey: captchaConfig?.siteKey ?? null,
        testMode: captchaConfig?.testMode ?? false
    }
    const loginCaptchaConfig = captchaConfig?.login ?? {
        enabled: false,
        siteKey: null,
        testMode: false
    }

    // Captcha is enabled based on current mode
    const currentCaptchaConfig = mode === 'register' ? registrationCaptchaConfig : loginCaptchaConfig
    const captchaEnabled = Boolean(currentCaptchaConfig.enabled && currentCaptchaConfig.siteKey)
    const siteKey = currentCaptchaConfig.siteKey ?? ''
    const testMode = currentCaptchaConfig.testMode ?? false

    // Debug log for captcha configuration
    console.info('[AuthView] Captcha config:', {
        mode,
        captchaEnabled,
        siteKey: siteKey ? '***' : null,
        testMode,
        registrationEnabled: registrationCaptchaConfig.enabled,
        loginEnabled: loginCaptchaConfig.enabled
    })

    // Important: Yandex SmartCaptcha test mode does NOT bypass domain validation.
    // If you see a "key cannot be used on domain localhost" error, you must configure domains in Yandex Cloud
    // (or use a separate dev key / disable domain validation).
    useEffect(() => {
        if (!captchaEnabled) return
        if (!testMode) return

        const hostname = window.location.hostname
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
        if (!isLocalhost) return

        console.warn(
            `[AuthView] SmartCaptcha (${mode}): testMode=true does not bypass domain validation. Configure Yandex Cloud CAPTCHA domains for localhost/127.0.0.1 or use a dedicated dev sitekey.`
        )
    }, [captchaEnabled, mode, testMode])

    // Reset captcha token when switching modes
    useEffect(() => {
        setCaptchaToken('')
    }, [mode])

    // Check if consent labels are provided (enables consent checkboxes)
    const hasConsentLabels = Boolean(labels.termsCheckbox && labels.termsLink && labels.privacyCheckbox && labels.privacyLink)

    const isConsentBlockingRegister = mode === 'register' && hasConsentLabels && (!termsAccepted || !privacyAccepted)
    const isCaptchaBlocking = captchaEnabled && !captchaToken

    const mapError = useCallback(
        (message: string) => {
            if (!message) return labels.loginError(message)
            const mapped = errorMapper?.(message)
            return mapped ?? labels.loginError(message)
        },
        [errorMapper, labels]
    )

    const adornment = useMemo(
        () => ({
            email: <IconMail stroke={1.5} size='20px' color={theme.palette.grey[500]} style={{ marginRight: '8px' }} />,
            password: <IconLock stroke={1.5} size='20px' color={theme.palette.grey[500]} style={{ marginRight: '8px' }} />
        }),
        [theme.palette.grey]
    )

    const resetMessages = () => {
        setError('')
        setInfo('')
    }

    const handleRegister = async () => {
        if (!email || !password) {
            setError(labels.fieldsRequired)
            return
        }

        // Validate consent if consent labels are provided
        if (hasConsentLabels && (!termsAccepted || !privacyAccepted)) {
            setError(labels.consentRequired || 'You must accept the Terms and Privacy Policy')
            return
        }

        // Validate captcha if enabled
        if (captchaEnabled && !captchaToken) {
            setError(labels.captchaRequired || 'Please complete the captcha')
            return
        }

        resetMessages()
        setSubmitting(true)
        try {
            await onRegister(email, password, termsAccepted, privacyAccepted, captchaToken)
            // Show appropriate success message based on email confirmation setting
            const successMessage = authFeatures.emailConfirmationRequired
                ? labels.successRegister
                : labels.successRegisterNoEmail || labels.successRegister
            setInfo(successMessage)
            setMode('login')
            // Reset consent checkboxes and captcha after successful registration
            setTermsAccepted(false)
            setPrivacyAccepted(false)
            setCaptchaToken('')
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
            const message = axiosErr?.response?.data?.error || axiosErr?.message || 'Registration failed'
            setError(mapError(message))
            // Reset captcha on error
            setCaptchaToken('')
        } finally {
            setSubmitting(false)
        }
    }

    const handleLogin = async () => {
        if (!email || !password) {
            setError(labels.fieldsRequired)
            return
        }

        // Validate captcha if enabled for login
        if (captchaEnabled && !captchaToken) {
            setError(labels.captchaRequired || 'Please complete the captcha')
            return
        }

        resetMessages()
        setSubmitting(true)
        try {
            await onLogin(email, password, captchaToken || undefined)
            setInfo(labels.loginSuccess)
            // Reset captcha on success
            setCaptchaToken('')
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
            const message = axiosErr?.response?.data?.error || axiosErr?.message || 'Login failed'
            setError(mapError(message))
            // Reset captcha on error
            setCaptchaToken('')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (mode === 'login') {
            await handleLogin()
        } else {
            await handleRegister()
        }
    }

    const toggleMode = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        setMode((prev) => (prev === 'login' ? 'register' : 'login'))
        resetMessages()
    }

    const submitLabel = submitting
        ? mode === 'login'
            ? labels.loggingIn
            : labels.registering
        : mode === 'login'
        ? labels.loginButton
        : labels.registerButton

    const RootComponent = slots?.Root ?? Box
    const ContainerComponent = slots?.Container ?? MuiContainer
    const CardComponent = slots?.Card ?? Box

    return (
        <RootComponent
            {...slotProps?.root}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '100vh',
                ...(slotProps?.root?.sx ?? {})
            }}
        >
            <ContainerComponent maxWidth='sm' {...slotProps?.container}>
                <CardComponent
                    {...slotProps?.card}
                    sx={{
                        borderRadius: 2,
                        boxShadow: ({ palette }) => `0 10px 30px ${palette.grey[200]}`,
                        padding: 4,
                        backgroundColor: 'background.paper',
                        ...(slotProps?.card?.sx ?? {})
                    }}
                >
                    <Typography variant='h2' align='center' gutterBottom>
                        {mode === 'login' ? labels.welcomeBack : labels.register}
                    </Typography>

                    {error ? (
                        <Alert severity='error' sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}
                    {info ? (
                        <Alert severity='success' sx={{ mb: 2 }}>
                            {info}
                        </Alert>
                    ) : null}

                    {/* Feature disabled - show only warning message, no form */}
                    {(mode === 'register' && !authFeatures.registrationEnabled) || (mode === 'login' && !authFeatures.loginEnabled) ? (
                        <Box>
                            <Alert severity='warning' sx={{ mb: 3 }}>
                                {mode === 'register'
                                    ? labels.registrationDisabled || 'Registration is currently unavailable. Please try again later.'
                                    : labels.loginDisabled || 'Login is currently unavailable. The system is under maintenance.'}
                            </Alert>
                        </Box>
                    ) : (
                        <Box component='form' onSubmit={handleSubmit}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='email'
                                        label={labels.email}
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        disabled={submitting}
                                        InputProps={{ startAdornment: adornment.email }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        type='password'
                                        label={labels.password}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        disabled={submitting}
                                        InputProps={{ startAdornment: adornment.password }}
                                    />
                                </Grid>
                                {/* Consent checkboxes - only shown in register mode when labels are provided */}
                                {mode === 'register' && hasConsentLabels ? (
                                    <>
                                        <Grid item xs={12}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={termsAccepted}
                                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                                        disabled={submitting}
                                                        size='small'
                                                    />
                                                }
                                                label={
                                                    <Typography variant='body2'>
                                                        {labels.termsCheckbox}{' '}
                                                        <Link href='/terms' target='_blank' rel='noopener noreferrer' underline='hover'>
                                                            {labels.termsLink}
                                                        </Link>
                                                    </Typography>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sx={{ mt: -1 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={privacyAccepted}
                                                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                                        disabled={submitting}
                                                        size='small'
                                                    />
                                                }
                                                label={
                                                    <Typography variant='body2'>
                                                        {labels.privacyCheckbox}{' '}
                                                        <Link href='/privacy' target='_blank' rel='noopener noreferrer' underline='hover'>
                                                            {labels.privacyLink}
                                                        </Link>
                                                        {labels.privacySuffix}
                                                    </Typography>
                                                }
                                            />
                                        </Grid>
                                    </>
                                ) : null}
                                {/* Captcha widget - shown for both login and register when enabled */}
                                {/* key prop forces re-render on mode change, resetting the widget state */}
                                {captchaEnabled ? (
                                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                                        <SmartCaptcha
                                            key={`captcha-${mode}`}
                                            sitekey={siteKey}
                                            onSuccess={setCaptchaToken}
                                            onTokenExpired={() => setCaptchaToken('')}
                                            onNetworkError={() => {
                                                console.error('[AuthView] SmartCaptcha network error')
                                                setError(
                                                    labels.captchaNetworkError ||
                                                        'Captcha service is temporarily unavailable. Please try again.'
                                                )
                                            }}
                                            test={testMode}
                                        />
                                    </Grid>
                                ) : null}
                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        type='submit'
                                        variant='contained'
                                        color='primary'
                                        size='large'
                                        disabled={submitting || isConsentBlockingRegister || isCaptchaBlocking}
                                        startIcon={submitting ? <CircularProgress size={20} color='inherit' /> : null}
                                    >
                                        {submitLabel}
                                    </Button>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                    {/* Mode switcher - shown for both enabled and disabled states (DRY) */}
                    <Typography align='center' sx={{ mt: 2 }}>
                        {mode === 'login' ? labels.noAccount : labels.haveAccount}{' '}
                        <Link href='#' onClick={toggleMode} underline='hover'>
                            {mode === 'login' ? labels.createAccount : labels.loginInstead}
                        </Link>
                    </Typography>
                </CardComponent>
            </ContainerComponent>
        </RootComponent>
    )
}

export default AuthView
