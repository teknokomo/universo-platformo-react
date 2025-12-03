// Debug: identify module instance and first importer stack (helps catch duplicates)
(() => {
  try {
    const src = typeof import.meta?.url === 'string' ? import.meta.url : 'unknown'
    let hash = 0
    for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) | 0
    const debugId = `auth-frontend:${(hash >>> 0).toString(16)}`
    // eslint-disable-next-line no-console
    console.info('[auth] module loaded', { moduleId: src, debugId })
  } catch {}
})()

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
export type { AuthViewProps, AuthViewLabels, AuthViewMode } from './components/AuthView'
