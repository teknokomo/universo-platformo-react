# Authentication Backend (`@universo/auth-backend`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Backend для гибридной аутентификации с Passport.js и Supabase JWT.

## Технологический стек

- Express.js + Passport.js
- Supabase Auth
- JWT verification
- bcrypt (password hashing)

## REST API

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

## Authentication Flow

1. User submits credentials
2. Passport.js validates against database
3. Supabase JWT generated
4. JWT stored in httpOnly cookie
5. All requests verified via JWT middleware

## Middleware

```typescript
import { authenticateJWT } from '@universo/auth-backend';

router.get('/protected', authenticateJWT, (req, res) => {
  res.json({ user: req.user });
});
```

## Password Security

```typescript
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

## Связанная документация

- [Auth Frontend](frontend.md)
- [Auth Overview](README.md)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
