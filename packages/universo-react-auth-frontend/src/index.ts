export { createAuthClient, AUTH_CSRF_STORAGE_KEY, getStoredCsrfToken } from './api/client'
export type { AuthClient, AuthClientOptions } from './api/client'

export { useSession } from './hooks/useSession'
export type { AuthUser, UseSessionOptions, UseSessionResult } from './hooks/useSession'

export { useAuthError } from './hooks/useAuthError'
export type { UseAuthErrorResult } from './hooks/useAuthError'

export { AuthProvider, AuthContext, useAuth } from './providers/authProvider'
export type { AuthContextValue, AuthProviderProps } from './providers/authProvider'

export { LoginForm } from './components/LoginForm'
export type { LoginFormProps, LoginFormLabels } from './components/LoginForm'

export { AuthView } from './components/AuthView'
export type { AuthViewProps, AuthViewLabels, AuthViewMode, CaptchaConfig, AuthFeatureConfig } from './components/AuthView'

// Pages (full authentication flows)
export { AuthPage } from './pages/AuthPage'
export type { AuthPageProps } from './pages/AuthPage'

// Utils
export { mapSupabaseError } from './utils/errorMapping'
