# Authentication Frontend (@universo/auth-frt)

Modern React authentication package providing secure, reusable authentication primitives for the Universo Platformo ecosystem. With CSRF protection, automatic retry mechanisms, and full Material-UI integration.

## Overview

This package provides a complete authentication solution that replaces legacy session-based authentication with modern token-based authentication. Includes React components, hooks, and API clients designed for production-grade security and user experience.

## Key Features

- **Secure API Client**: Axios-based client with CSRF token management and cookie support
- **Session Management**: React hooks for authentication state and session lifecycle
- **Error Handling**: Centralized 401 error handling with automatic redirects
- **Material-UI Components**: Ready-to-use authentication forms with customizable styling
- **TypeScript First**: Full type safety with comprehensive TypeScript definitions
- **Retry Logic**: Intelligent retry mechanism for temporary network failures
- **Developer Experience**: Debug logging and singleton detection for development

## Architecture

### Authentication Flow
```
1. Client requests CSRF token → Server validates → Token stored in sessionStorage
2. All API requests include CSRF token → Server validates → Response/Redirect
3. 401 errors trigger automatic logout → Redirect to /auth with return path
4. Session refresh maintains authentication state across browser sessions
```

### Core Components
- **AuthProvider**: Context provider for global authentication state
- **AuthClient**: Configured Axios instance with interceptors
- **AuthView**: Full-featured Material-UI authentication interface
- **LoginForm**: Minimal controlled form component
- **useAuthError**: Centralized error handling hook

## Structure

```
src/
├── components/
│   ├── AuthView.tsx           # Full Material-UI authentication interface
│   └── LoginForm.tsx          # Minimal controlled form component
├── hooks/
│   ├── useSession.ts          # Session management hook
│   └── useAuthError.ts        # Centralized 401 error handling
├── providers/
│   └── authProvider.tsx       # React context provider
├── api/
│   └── client.ts              # Axios client with CSRF protection
└── index.ts                   # Package exports
```

## Components and Hooks

### AuthProvider
React context provider that globally manages authentication state.

```tsx
import { createAuthClient, AuthProvider } from '@universo/auth-frt'

const authClient = createAuthClient({ 
  baseURL: `${window.location.origin}/api/v1` 
})

<AuthProvider client={authClient}>
  <App />
</AuthProvider>
```

**Features:**
- Automatic session restoration on app load
- Centralized login/logout methods
- Loading states and error handling
- Development warnings for duplicate instances

### AuthView (Material-UI)
Full-featured authentication interface with login/registration modes.

```tsx
import { AuthView } from '@universo/auth-frt'

<AuthView
  labels={{
    welcomeBack: "Welcome Back",
    register: "Create Account",
    email: "Email",
    password: "Password",
    loginButton: "Log In",
    registerButton: "Sign Up",
    // ... more labels
  }}
  onLogin={async (email, password) => {
    await authClient.post('auth/login', { email, password })
  }}
  onRegister={async (email, password) => {
    await authClient.post('auth/register', { email, password })
  }}
  errorMapper={(error) => translateError(error)}
/>
```

**Features:**
- Toggle between login/registration modes  
- Material-UI TextField integration with icons
- Comprehensive error handling and display
- Customizable styling with slots/slotProps
- Loading states with progress indicators

### LoginForm (Minimal)
Lightweight controlled form component for custom implementations.

```tsx
import { LoginForm } from '@universo/auth-frt'

<LoginForm
  client={authClient}
  labels={{ 
    submit: 'Log In', 
    submitting: 'Logging in…' 
  }}
  onSuccess={(user) => console.log('Logged in:', user)}
  onError={(message) => showToast(message)}
/>
```

### useSession Hook
Manages session state and provides authentication methods.

```tsx
import { useSession } from '@universo/auth-frt'

const { user, loading, error, refresh, logout } = useSession({ 
  client: authClient,
  fetchOnMount: true 
})

// Current user data
console.log(user) // { id: string, email: string } | null

// Manual session refresh
await refresh()

// Logout with cleanup
await logout()
```

### useAuthError Hook
Centralized 401 error handling with automatic redirects.

```tsx
import { useAuthError } from '@universo/auth-frt'

const { handleAuthError } = useAuthError()

try {
  await api.get('/protected-resource')
} catch (error) {
  if (handleAuthError(error)) {
    return // 401 error was handled automatically
  }
  // Handle other errors manually
  setLocalError(error)
}
```

**Behavior:**
- Detects 401 Unauthorized responses
- Automatically logs out authenticated users
- Redirects to `/auth` with return path
- Preserves current location for post-login redirect

### useAuth Hook
Access authentication context from any component.

```tsx
import { useAuth } from '@universo/auth-frt'

const { user, isAuthenticated, login, logout, client } = useAuth()

if (!isAuthenticated) {
  return <LoginPrompt />
}

return <AuthenticatedContent user={user} />
```

## API Client Features

### CSRF Protection
Automatic CSRF token fetching and inclusion in requests.

```typescript
const client = createAuthClient({ 
  baseURL: '/api/v1',
  csrfPath: 'auth/csrf',  // Default
  csrfStorageKey: 'up.auth.csrf'  // Default
})

// All requests automatically include X-CSRF-Token header
await client.post('protected-endpoint', data)
```

### Retry Logic
Intelligent retry mechanism for temporary failures.

- **Retryable Methods**: GET, HEAD, OPTIONS
- **Retryable Status Codes**: 503 Service Unavailable, 504 Gateway Timeout
- **Maximum Attempts**: 4 retries with exponential backoff
- **Retry-After Compliance**: Respects server retry-after headers

### Cookie Support
Automatic cookie handling for session persistence.

```typescript
// All requests include withCredentials: true
// Cookies are automatically sent and received
const client = createAuthClient({ baseURL: '/api/v1' })
```

## Development

### Prerequisites
- Node.js 18+
- PNPM workspace environment  
- Material-UI peer dependencies

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build package (dual CJS/ESM output)
pnpm --filter @universo/auth-frt build

# Development mode with watch
pnpm --filter @universo/auth-frt dev

# Type check
pnpm --filter @universo/auth-frt lint
```

### Build Output
- **CommonJS**: `dist/index.js` + `dist/index.d.ts`  
- **ES Modules**: `dist/index.mjs` + `dist/index.d.ts`
- **TypeScript**: Full type definitions included

### Development Features
- **Debug Logging**: Comprehensive console logging for authentication flow
- **Singleton Detection**: Warnings for duplicate package instances
- **Error Boundaries**: Graceful error handling in development and production

## Integration Examples

### Full App Setup
```tsx
// App.tsx
import { createAuthClient, AuthProvider, useAuth } from '@universo/auth-frt'
import { Routes, Route, Navigate } from 'react-router-dom'

const authClient = createAuthClient({ 
  baseURL: process.env.REACT_APP_API_URL 
})

function App() {
  return (
    <AuthProvider client={authClient}>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) return <LoadingScreen />
  
  return (
    <Routes>
      <Route path="/auth" element={
        isAuthenticated ? <Navigate to="/" /> : <AuthPage />
      } />
      <Route path="/*" element={
        isAuthenticated ? <AuthenticatedApp /> : <Navigate to="/auth" />
      } />
    </Routes>
  )
}
```

### Protected API Wrapper
```tsx
// api/client.ts
import { createAuthClient } from '@universo/auth-frt'

export const apiClient = createAuthClient({
  baseURL: `${window.location.origin}/api/v1`
})

// All requests automatically include CSRF tokens and handle 401 errors
export const api = {
  users: {
    list: () => apiClient.get('/users'),
    create: (data) => apiClient.post('/users', data),
    update: (id, data) => apiClient.put(`/users/${id}`, data)
  }
}
```

### Custom Error Mapping
```tsx
// utils/errorMapper.ts
export const translateError = (error: string): string => {
  const errorMap: Record<string, string> = {
    'Invalid credentials': 'Email or password is incorrect',
    'User not found': 'Account with this email not found',
    'Email already exists': 'Account with this email already exists'
  }
  
  return errorMap[error] || error
}

// Usage in component
<AuthView 
  onLogin={handleLogin}
  onRegister={handleRegister}
  errorMapper={translateError}
  labels={authLabels}
/>
```

## Security Considerations

### CSRF Protection
- Tokens fetched from `/auth/csrf` endpoint
- Stored in sessionStorage (not localStorage)
- Automatically included in all requests
- Invalid tokens trigger re-fetch (status 419)

### Session Management  
- HTTP-only cookies recommended for production
- Automatic session refresh on app load
- Secure logout with server-side cleanup
- Return path preservation for user experience

### Error Handling
- 401 errors trigger automatic logout
- Sensitive error details hidden in production
- Comprehensive logging for debugging
- Graceful degradation for network failures

## Migration Guide

### From Legacy Authentication
Package provides full replacement for legacy Flowise authentication:

**Old Pattern:**
```tsx
// Legacy LoginDialog approach
const [loginOpen, setLoginOpen] = useState(false)

useEffect(() => {
  if (apiError?.response?.status === 401) {
    setLoginOpen(true)
  }
}, [apiError])

<LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
```

**New Pattern:**
```tsx
// Modern useAuthError approach
const { handleAuthError } = useAuthError()

useEffect(() => {
  if (apiError && !handleAuthError(apiError)) {
    setLocalError(apiError)
  }
}, [apiError, handleAuthError])
```

### Integration Steps
1. **Replace AuthProvider**: Wrap app with new `AuthProvider`
2. **Update API Clients**: Use `createAuthClient` instead of plain axios
3. **Replace LoginDialog**: Use `AuthView` or `LoginForm` components
4. **Update Error Handling**: Replace manual 401 handling with `useAuthError`
5. **Remove Legacy Code**: Delete old authentication components and logic

## Related Documentation

- [Authentication Service Backend](../../auth-srv/base/README.md)
- [API Client Package](../../universo-api-client/README.md)
- [Material-UI Template](../../universo-template-mui/base/README.md)
- [Authentication Architecture](../../../docs/en/universo-platformo/README.md)

---

**Universo Platformo | Authentication Frontend Package**
