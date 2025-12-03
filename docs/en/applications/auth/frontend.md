# Authentication Frontend (`@universo/auth-frontend`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend for   (Passport.js + Supabase JWT).

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- React Hook Form + Zod
- Supabase Auth Client
- i18next (EN/RU)

## Main Components

- **LoginForm**: Form 
- **RegisterForm**: Form 
- **ForgotPasswordForm**:  password
- **ProtectedRoute**: HOC for  
- **AuthProvider**: Context provider

## Auth Context

```typescript
const { user, login, logout, isAuthenticated } = useAuth();
```

## Protected Routes

```tsx
import { ProtectedRoute } from '@universo/auth-frontend';

<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## Login Flow

```typescript
const { login } = useAuth();

await login({
  email: 'user@example.com',
  password: 'password123'
});
// Redirect to dashboard
```

## Related Documentation

- [Auth Backend](backend.md)
- [Auth Overview](README.md)
