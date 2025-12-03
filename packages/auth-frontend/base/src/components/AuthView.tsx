import { useCallback, useMemo, useState, type FormEvent, type MouseEvent, type ComponentType, type ReactNode } from 'react'
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
    type BoxProps,
    type ContainerProps
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconMail, IconLock } from '@tabler/icons-react'

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
}

export interface AuthViewProps {
    labels: AuthViewLabels
    onLogin: (email: string, password: string) => Promise<void>
    onRegister: (email: string, password: string) => Promise<void>
    errorMapper?: (error: string) => string
    initialMode?: AuthViewMode
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

export const AuthView = ({ labels, onLogin, onRegister, errorMapper, initialMode = 'login', slots, slotProps }: AuthViewProps) => {
    const theme = useTheme()
    const [mode, setMode] = useState<AuthViewMode>(initialMode)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string>('')
    const [info, setInfo] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

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

        resetMessages()
        setSubmitting(true)
        try {
            await onRegister(email, password)
            setInfo(labels.successRegister)
            setMode('login')
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || 'Registration failed'
            setError(mapError(message))
        } finally {
            setSubmitting(false)
        }
    }

    const handleLogin = async () => {
        if (!email || !password) {
            setError(labels.fieldsRequired)
            return
        }

        resetMessages()
        setSubmitting(true)
        try {
            await onLogin(email, password)
            setInfo(labels.loginSuccess)
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || 'Login failed'
            setError(mapError(message))
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
                            <Grid item xs={12}>
                                <Button
                                    fullWidth
                                    type='submit'
                                    variant='contained'
                                    color='primary'
                                    size='large'
                                    disabled={submitting}
                                    startIcon={submitting ? <CircularProgress size={20} color='inherit' /> : null}
                                >
                                    {submitLabel}
                                </Button>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography align='center'>
                                    {mode === 'login' ? labels.noAccount : labels.haveAccount}{' '}
                                    <Link href='#' onClick={toggleMode} underline='hover'>
                                        {mode === 'login' ? labels.createAccount : labels.loginInstead}
                                    </Link>
                                </Typography>
                            </Grid>
                        </Grid>
                    </Box>
                </CardComponent>
            </ContainerComponent>
        </RootComponent>
    )
}

export default AuthView
