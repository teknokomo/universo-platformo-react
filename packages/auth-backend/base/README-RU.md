# Сервис аутентификации (@universo/auth-backend)

Производственный сервис аутентификации для серверной аутентификации Universo Platformo. Построен на Passport.js + Supabase и монтируется внутри `packages/universo-core-backend/base` по пути `/api/v1/auth`.

## Обзор

Этот пакет предоставляет комплексное решение для backend-аутентификации, объединяющее управление сессиями Passport.js с сервисами идентификации Supabase и продвинутой интеграцией Row Level Security (RLS) для PostgreSQL. Разработан как безопасный, масштабируемый слой аутентификации для мультитенантных приложений.

## Ключевые возможности

- **Интеграция Passport.js**: LocalStrategy с Supabase в качестве провайдера идентификации
- **Управление сессиями**: Express-session с HttpOnly cookies и настраиваемыми параметрами безопасности
- **Защита от CSRF**: Встроенные CSRF токены через middleware `csurf` с заголовками `X-CSRF-Token`
- **Ограничение скорости**: Защита от попыток входа (10 попыток в минуту)
- **Управление токенами**: Автоматическое обновление access-токенов Supabase с блокировкой одиночного полета
- **Row Level Security (RLS)**: Продвинутое распространение контекста JWT в PostgreSQL через request-scoped DB session
- **Производственная безопасность**: Безопасность cookies, регенерация сессий и комплексная обработка ошибок

## Эндпоинты (монтируются под `/api/v1/auth`)

- `GET /csrf` — возвращает `{ csrfToken }`
- `POST /login` — `{ email, password }`, требуется CSRF
- `GET /me` — возвращает текущего пользователя Supabase
- `POST /refresh` — опциональное ручное обновление (сессии обновляются автоматически прозрачно)
- `POST /logout` — выход и очистка сессии

## Интеграция Row Level Security (RLS)

### Обзор

The package provides `createEnsureAuthWithRls` middleware that combines authentication with automatic RLS context setup for request-scoped database access. This enables PostgreSQL Row Level Security policies to access JWT claims (user_id, email, role) via session variables.

### Architecture

```typescript
import { createEnsureAuthWithRls } from '@universo/auth-backend'
import { getKnex } from '@universo/database'

// Create RLS-enabled authentication middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })

// Apply to routes that need DB access with RLS
router.use('/metahubs', ensureAuthWithRls, metahubsRouter)
router.use('/applications', ensureAuthWithRls, applicationsRouter)
```

### Как это работает

1. **Authentication**: Проверяет пользовательскую сессию через Passport
2. **JWT Extraction**: Извлекает Supabase access_token из сессии
3. **JWT Verification**: Проверяет токен через `jose` и получает payload JWT claims
4. **Pinned Connection**: Захватывает одно выделенное Knex-соединение на весь жизненный цикл запроса
5. **RLS Context Application**: Записывает `request.jwt.claims` в это соединение, чтобы PostgreSQL policies видели контекст пользователя
6. **Request Context**: Кладёт нейтральную пару `DbSession` / `DbExecutor` в `req.dbContext` для роутов и сервисов
7. **Cleanup**: Сбрасывает session claims и освобождает pinned connection при завершении запроса

### Usage in Services

Сервисы должны использовать executor, привязанный к запросу, а не глобальный pool helper, когда важен RLS-контекст:

```typescript
import type { RequestWithDbContext } from '@universo/auth-backend'

function getRequestExecutor(req: Request, fallbackExecutor: DbExecutor) {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.executor ?? fallbackExecutor
}

router.get('/items', async (req, res) => {
    const executor = getRequestExecutor(req, createKnexExecutor(getKnex()))
    const items = await executor.query('SELECT * FROM app.items ORDER BY created_at DESC')
    res.json(items)
})
```

### PostgreSQL RLS Policies

RLS policies can access JWT claims via:

```sql
-- Example policy using request.jwt.claims
CREATE POLICY "Users can only access their own data" ON app.items
    FOR ALL
    USING (
        owner_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    );
```

### Зависимости

- `jose@^5.9.6` - Современная JWT-верификация для Supabase access token
- `@universo/database` - Общий Knex runtime и `createRlsExecutor()` для pinned request execution

### Обработка ошибок

- **Invalid JWT**: Returns 401 Unauthorized with error details
- **Missing access_token**: Returns 401 if no token in session
- **DB Connection Issues**: Properly releases the request-scoped transport and returns 500
- **Query Timeout**: Request transport cleanup prevents connection leaks

### Performance Considerations

- Каждый защищённый запрос использует одно pinned Knex-соединение до завершения cleanup
- Request-scoped executor держит все query и transaction на этом же соединении
- JWT проверяется один раз на запрос до заполнения `req.dbContext`
- Cleanup явно очищает `request.jwt.claims` перед возвратом соединения в pool

## Основные компоненты

### Authentication Middleware
- **ensureAuth**: Basic authentication validation
- **ensureAuthenticated**: Session validation middleware
- **ensureAndRefresh**: Automatic token refresh middleware
- **createEnsureAuthWithRls**: Advanced RLS-enabled authentication middleware

### Session Services
- **Passport Configuration**: LocalStrategy with Supabase user verification
- **Session Management**: Token storage, refresh logic, and cleanup
- **CSRF Protection**: Token generation and validation
- **Rate Limiting**: Configurable login attempt protection

### RLS Integration
- **JWT Verification**: Secure token validation using `jose` library
- **Context Propagation**: PostgreSQL session variable management
- **Request Session Lifecycle**: Automatic resource cleanup and connection pooling
- **Request Context**: Per-request database manager attachment

## Разработка

### Предварительные требования
- Node.js 22.22.2 recommended (>=22.6.0 required)
- PNPM 10 workspace environment
- Access to Supabase project credentials
- PostgreSQL database with RLS policies (for RLS features)

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build package (dual CJS/ESM output)
pnpm --filter @universo/auth-backend build

# Development mode with watch
pnpm --filter @universo/auth-backend dev

# Lint TypeScript
pnpm --filter @universo/auth-backend lint
```

### Сборка Output
- **CommonJS**: `dist/index.js` + `dist/index.d.ts`
- **ES Modules**: `dist/index.mjs` + `dist/index.d.ts`
- **TypeScript**: Full type definitions included

## Конфигурация окружения

Используется из `packages/universo-core-backend/base`.

### Required Variables
- `SESSION_SECRET` - Secret key for session signing and encryption
- `SUPABASE_URL` - Supabase project URL for authentication
- `SUPABASE_PUBLISHABLE_DEFAULT_KEY` или `SUPABASE_ANON_KEY` - публичный клиентский ключ Supabase. Для новых проектов предпочитайте `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, для legacy-конфигов можно оставить `SUPABASE_ANON_KEY`.

### JWT Verification Variables
- `SUPABASE_JWT_SECRET` - Опциональный legacy JWT secret для HS256 verification
- `SUPABASE_JWKS_URL` - Опциональный явный override для JWKS endpoint
- `SUPABASE_JWT_ISSUER` - Опциональный override для issuer (по умолчанию `${SUPABASE_URL}/auth/v1`)
- `SUPABASE_JWT_AUDIENCE` - Опциональный override для audience (по умолчанию `authenticated`)

### Optional Cookie Configuration
- `SESSION_COOKIE_NAME` - Custom session cookie name (default: 'connect.sid')
- `SESSION_COOKIE_MAXAGE` - Session expiration time in milliseconds
- `SESSION_COOKIE_SAMESITE` - SameSite cookie attribute ('strict', 'lax', 'none')
- `SESSION_COOKIE_SECURE` - Secure cookie flag for HTTPS environments

### Example Environment Setup
```bash
# .env
SESSION_SECRET=your-strong-secret-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_key
# Optional legacy alias for older environments:
# SUPABASE_ANON_KEY=sb_publishable_or_legacy_anon_key
# Legacy HS256-only projects:
# SUPABASE_JWT_SECRET=your-jwt-secret-key
# Optional asymmetric overrides:
# SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
# SUPABASE_JWT_ISSUER=https://your-project.supabase.co/auth/v1
# SUPABASE_JWT_AUDIENCE=authenticated

# Optional production settings
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=strict
SESSION_COOKIE_MAXAGE=86400000
```

## Примеры интеграции

### Basic Authentication Setup
```typescript
// server.ts
import express from 'express'
import session from 'express-session'
import csurf from 'csurf'
import rateLimit from 'express-rate-limit'
import { createAuthRouter, passport } from '@universo/auth-backend'

const app = express()

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}))

// Passport setup
app.use(passport.initialize())
app.use(passport.session())

// CSRF and rate limiting
const csrfProtection = csurf({ cookie: false })
const loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10 // 10 attempts
})

// Mount auth routes
app.use('/api/v1/auth', createAuthRouter(csrfProtection, loginLimiter, {
    getDbExecutor: () => createKnexExecutor(getKnex()),
    assignSystemRole,
    deleteAuthUser
}))
```

Третий аргумент опционален, но именно через него подключаются поддерживаемые helper'ы для назначения ролей после регистрации/онбординга и для rollback cleanup.

### RLS-Enabled Route Protection
```typescript
// routes/index.ts
import { createEnsureAuthWithRls } from '@universo/auth-backend'
import { getKnex } from '@universo/database'

// Create RLS middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })

// Apply to database routes
router.use('/metahubs', ensureAuthWithRls, metahubsRouter)
router.use('/applications', ensureAuthWithRls, applicationsRouter)
router.use('/profile', ensureAuthWithRls, profileRouter)
```

### Service Layer with RLS
```typescript
import type { Request } from 'express'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { createKnexExecutor, getKnex } from '@universo/database'

function getRequestExecutor(req: Request) {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.executor ?? createKnexExecutor(getKnex())
}

export async function getUserItems(req: Request) {
    const executor = getRequestExecutor(req)
    return executor.query('SELECT * FROM app.items ORDER BY created_at DESC')
}
```

## Соображения безопасности

### Безопасность сессий
- **HttpOnly Cookies**: Prevents XSS attacks via client-side cookie access
- **Флаг Secure**: Ensures cookies only sent over HTTPS in production
- **SameSite Protection**: Prevents CSRF attacks via cookie SameSite attribute
- **Регенерация сессии**: New session ID on login to prevent session fixation

### Защита от CSRF
- **Token-based**: CSRF tokens required for state-changing operations
- **Header Validation**: `X-CSRF-Token` header validation on protected routes
- **Session-bound**: CSRF tokens tied to user session for security

### Ограничение скорости
- **Login Protection**: Configurable limits on login attempts per IP
- **Sliding Window**: Time-based rate limiting with automatic reset
- **Customizable**: Adjustable window size and attempt limits

### JWT Security
- **Dual-mode Verification**: HS256 токены используют `SUPABASE_JWT_SECRET`, а asymmetric Supabase JWT проверяются через JWKS с помощью `jose`
- **Expiration Handling**: Automatic token refresh before expiration
- **Single-flight Refresh**: Prevents concurrent refresh requests
- **Secure Storage**: Access tokens stored in session, not client-side

## Руководство по миграции

### From Basic Authentication
If migrating from simple authentication to RLS-enabled authentication:

1. **Update Middleware**: Replace `ensureAuth` with `createEnsureAuthWithRls`
2. **Service Layer**: Use a request-bound executor instead of global database helpers
3. **Database Policies**: Create appropriate RLS policies in PostgreSQL
4. **Environment**: Настройте либо legacy `SUPABASE_JWT_SECRET`, либо JWKS-based Supabase env contract

### Migration Steps
```typescript
// Before: Basic authentication
router.use('/api/v1/metahubs', ensureAuth, metahubsRouter)

// After: RLS-enabled authentication
const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })
router.use('/api/v1/metahubs', ensureAuthWithRls, metahubsRouter)
```

## Тестирование

### Unit Testing
```typescript
// Mock authentication middleware for testing
const mockEnsureAuth = (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' }
    req.session = { tokens: { access: 'mock-token' } }
    next()
}

// Test RLS context application
describe('RLS Context', () => {
    it('should apply PostgreSQL session variables', async () => {
        const session = createDbSession({
            query: jest.fn(async () => []),
            isReleased: () => false
        })
        await applyRlsContext(session, mockJwtToken)

        expect(session.query).toHaveBeenCalledWith(
            "SELECT set_config('request.jwt.claims', $1::text, false)",
            [expect.stringContaining('"sub":"test-user-id"')]
        )
    })
})
```

## Оптимизация производительности

### Pinned Connection Management
- **Per-request Connection**: Each protected request pins one Knex/pg connection while RLS context is active
- **Automatic Cleanup**: `request.jwt.claims` is reset before the pinned connection is released on finish/close
- **Error Recovery**: Cleanup still attempts release even if claim reset fails or request processing errors
- **Connection Reuse**: Pool management prevents connection exhaustion once cleanup completes

### Caching Strategy
- **Session Cache**: In-memory session storage for frequently accessed user data
- **Token Refresh**: Smart refresh logic minimizes unnecessary Supabase API calls
- **Single-flight**: Prevents duplicate refresh requests for same user

### Resource Management
```typescript
// Automatic cleanup example
res.once('finish', cleanup)
res.once('close', cleanup)

const cleanup = async () => {
    await knex.raw("SELECT set_config('request.jwt.claims', '', false)").connection(connection)
    knex.client.releaseConnection(connection)
    delete req.dbContext
}
```

## Связанная документация

- [Фронтенд аутентификации](../../auth-frontend/base/README-RU.md)
- [RLS Integration Pattern](../../../memory-bank/rls-integration-pattern.md)
- [Интеграция с core backend](../../universo-core-backend/base/README-RU.md)
- [Архитектура базы данных](../../../docs/ru/architecture/database.md)

---

**Universo Platformo | Authentication Service Package**
