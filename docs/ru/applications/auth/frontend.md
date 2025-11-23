# Authentication Frontend (`@universo/auth-frt`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Frontend для гибридной аутентификации (Passport.js + Supabase JWT).

## Технологический стек

- React 18 + TypeScript + Material-UI v5
- React Hook Form + Zod
- Supabase Auth Client
- i18next (EN/RU)

## Основные компоненты

- **LoginForm**: Форма входа
- **RegisterForm**: Форма регистрации
- **ForgotPasswordForm**: Восстановление пароля
- **ProtectedRoute**: HOC для защищенных маршрутов
- **AuthProvider**: Context provider

## Auth Context

```typescript
const { user, login, logout, isAuthenticated } = useAuth();
```

## Protected Routes

```tsx
import { ProtectedRoute } from '@universo/auth-frt';

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

## Связанная документация

- [Auth Backend](backend.md)
- [Auth Overview](README.md)
