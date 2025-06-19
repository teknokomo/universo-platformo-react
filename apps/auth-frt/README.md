# Authentication Frontend (auth-frt)

Frontend authentication system for Universo Platformo based on Supabase integration.

## Project Overview

This module provides a complete authentication system that replaces the legacy Flowise authentication with modern Supabase-based authentication. The system ensures secure user authentication and provides consistent error handling across all application components.

## Authentication Architecture

### Migration from Legacy System

The authentication system has been migrated from a legacy Flowise-based authentication (username/password in localStorage) to a modern Supabase-based system with JWT tokens and proper authentication flow.

#### Legacy System (Removed)

-   **LoginDialog Component**: Modal-based authentication with basic username/password
-   **localStorage Storage**: Credentials stored in browser localStorage
-   **Manual Error Handling**: Each component handled 401 errors individually

#### New System (Current)

-   **Auth Page Component**: Full-page authentication interface
-   **AuthProvider Context**: Centralized authentication state management
-   **JWT Token Storage**: Secure token-based authentication
-   **Unified Error Handling**: Consistent authentication error handling via custom hook

### System Components

```
packages/ui/src/
├── views/up-auth/
│   └── Auth.jsx                    # Main authentication page
├── utils/
│   └── authProvider.jsx            # Authentication context provider
├── routes/
│   ├── AuthGuard.jsx              # Route protection component
│   └── index.jsx                  # Main routing configuration
└── hooks/
    └── useAuthError.js            # Custom authentication error handler
```

## Core Components

### 1. Authentication Page (`Auth.jsx`)

The main authentication interface that handles user login and registration.

**Features:**

-   Email/password authentication
-   User registration
-   Password reset functionality
-   Supabase integration
-   Error message translation
-   Responsive design

**Key Functions:**

```javascript
// Login function
const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
}

// Registration function
const handleRegister = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })
}
```

### 2. Authentication Provider (`authProvider.jsx`)

Centralized authentication state management using React Context.

**Provides:**

-   User authentication state
-   Login/logout functions
-   Token management
-   User profile information

**Context Structure:**

```javascript
const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: () => {},
    logout: () => {},
    register: () => {}
})
```

### 3. Authentication Guard (`AuthGuard.jsx`)

Route protection component that ensures only authenticated users can access protected routes.

**Features:**

-   Route-based access control
-   Automatic redirection to auth page
-   Loading state management
-   Return path preservation

### 4. Authentication Error Hook (`useAuthError.js`)

Custom hook for consistent authentication error handling across components.

**Purpose:**

-   Centralizes 401 error handling
-   Provides automatic logout on authentication failure
-   Redirects to authentication page with return path
-   Eliminates code duplication

**Usage Example:**

```javascript
import { useAuthError } from '@/hooks/useAuthError'

const MyComponent = () => {
    const { handleAuthError } = useAuthError()

    useEffect(() => {
        if (apiError) {
            if (!handleAuthError(apiError)) {
                // Handle non-authentication errors
                setError(apiError)
            }
        }
    }, [apiError, handleAuthError])
}
```

## Migration Implementation

### Components Migrated

The following components were successfully migrated from legacy authentication:

1. **`packages/ui/src/views/chatflows/index.jsx`**

    - Removed: `LoginDialog` import and usage
    - Added: `useAuthError` hook integration
    - Removed: Manual 401 error handling

2. **`packages/ui/src/views/agentflows/index.jsx`**

    - Removed: `LoginDialog` import and usage
    - Added: `useAuthError` hook integration
    - Removed: Manual 401 error handling

3. **`packages/ui/src/views/up-uniks/UnikList.jsx`**

    - Removed: `LoginDialog` import and usage
    - Added: `useAuthError` hook integration
    - Removed: Manual 401 error handling

4. **`packages/ui/src/views/publish/bots/BaseBot.jsx`**

    - Removed: `LoginDialog` import and usage
    - Added: `useAuthError` hook integration
    - Enhanced: Public/private API access logic

5. **`packages/ui/src/layout/MainLayout/Header/ProfileSection/index.jsx`**
    - Updated: Authentication status check using `useAuth`
    - Replaced: localStorage username/password check with `isAuthenticated`

### Removed Components

-   **`packages/ui/src/ui-component/dialog/LoginDialog.jsx`** - Completely removed as no longer needed

### Error Handling Migration

**Before (Legacy):**

```javascript
useEffect(() => {
    if (apiError?.response?.status === 401) {
        setLoginDialogProps({
            title: 'Login',
            confirmButtonName: 'Login'
        })
        setLoginDialogOpen(true)
    } else {
        setError(apiError)
    }
}, [apiError])
```

**After (New System):**

```javascript
useEffect(() => {
    if (apiError) {
        if (!handleAuthError(apiError)) {
            setError(apiError)
        }
    }
}, [apiError, handleAuthError])
```

## Authentication Flow

### 1. Initial Load

1. Application loads and checks authentication state
2. `AuthProvider` verifies existing session with Supabase
3. Routes protected by `AuthGuard` check authentication status

### 2. Unauthenticated Access

1. User tries to access protected route
2. `AuthGuard` detects unauthenticated state
3. User is redirected to `/auth` page with return path

### 3. Authentication Process

1. User enters credentials on auth page
2. Supabase validates credentials
3. JWT token is stored in session
4. User is redirected to original destination

### 4. API Error Handling

1. API request returns 401 status
2. `useAuthError` hook detects authentication error
3. User is automatically logged out
4. Redirect to auth page with current path

## Security Features

### Token Management

-   JWT tokens stored securely in Supabase session
-   Automatic token refresh
-   Secure logout process

### Route Protection

-   All sensitive routes protected by `AuthGuard`
-   Automatic redirection for unauthenticated users
-   Return path preservation

### Error Handling

-   Centralized authentication error handling
-   Automatic cleanup on authentication failure
-   User-friendly error messages

## Integration with Supabase

### Configuration

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Authentication Methods

-   Email/password authentication
-   User registration with email verification
-   Password reset functionality
-   Session management

## Future Enhancements

### Planned Features

1. **OAuth Integration**: Google, GitHub, and other providers
2. **Multi-factor Authentication**: SMS and authenticator app support
3. **Session Management**: Advanced session controls
4. **Audit Logging**: Authentication event tracking

### Migration Roadmap

1. **Phase 1**: Complete migration to `apps/auth-frt` structure
2. **Phase 2**: Enhanced security features
3. **Phase 3**: Advanced authentication methods
4. **Phase 4**: Full audit and compliance features

## Development Guidelines

### Adding New Protected Components

1. Import and use `useAuthError` hook for API error handling
2. Wrap routes with `AuthGuard` component
3. Use `useAuth` hook for authentication state

### Error Handling Best Practices

```javascript
// Always use useAuthError for API errors
const { handleAuthError } = useAuthError()

useEffect(() => {
    if (error) {
        // Let useAuthError handle 401s, handle others manually
        if (!handleAuthError(error)) {
            setLocalError(error)
        }
    }
}, [error, handleAuthError])
```

### Authentication State Access

```javascript
// Use AuthProvider context for authentication state
const { user, isAuthenticated, login, logout } = useAuth()
```

## Testing

### Authentication Flow Testing

1. Test unauthenticated route access
2. Verify authentication page functionality
3. Test automatic logout on 401 errors
4. Verify return path functionality

### Error Handling Testing

1. Test API 401 error handling
2. Verify automatic redirection
3. Test session expiration handling

## Troubleshooting

### Common Issues

**1. Authentication not working**

-   Check Supabase configuration
-   Verify environment variables
-   Check network connectivity

**2. 401 errors not handled**

-   Ensure `useAuthError` hook is imported and used
-   Verify error object structure

**3. Redirect loops**

-   Check `AuthGuard` implementation
-   Verify route configuration

### Debug Mode

Enable debug logging by setting:

```javascript
localStorage.setItem('auth_debug', 'true')
```
