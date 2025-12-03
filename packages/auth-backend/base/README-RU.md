# Сервис аутентификации (@universo/auth-backend)

Производственный сервис аутентификации для серверной аутентификации Universo Platformo. Построен на Passport.js + Supabase и поставляется как двойная библиотека ESM/CJS. Монтируется внутри `packages/flowise-core-backend/base` по пути `/api/v1/auth`.

## Обзор

Этот пакет предоставляет комплексное решение для backend-аутентификации, объединяющее управление сессиями Passport.js с сервисами идентификации Supabase и продвинутой интеграцией Row Level Security (RLS) для PostgreSQL. Разработан как безопасный, масштабируемый слой аутентификации для мультитенантных приложений.

## Ключевые возможности

- **Интеграция Passport.js**: LocalStrategy с Supabase в качестве провайдера идентификации
- **Управление сессиями**: Express-session с HttpOnly cookies и настраиваемыми параметрами безопасности
- **Защита от CSRF**: Встроенные CSRF токены через middleware `csurf` с заголовками `X-CSRF-Token`
- **Ограничение скорости**: Защита от попыток входа (10 попыток в минуту)
- **Управление токенами**: Автоматическое обновление access-токенов Supabase с блокировкой одиночного полета
- **Row Level Security (RLS)**: Продвинутое распространение контекста JWT в PostgreSQL через TypeORM QueryRunner
- **Производственная безопасность**: Безопасность cookies, регенерация сессий и комплексная обработка ошибок

## Эндпоинты (монтируются под `/api/v1/auth`)

- `GET /csrf` — возвращает `{ csrfToken }`
- `POST /login` — `{ email, password }`, требуется CSRF
- `GET /me` — возвращает текущего пользователя Supabase
- `POST /refresh` — опциональное ручное обновление (сессии обновляются автоматически прозрачно)
- `POST /logout` — выход и очистка сессии

## Интеграция Row Level Security (RLS)

### Обзор

The package provides `createEnsureAuthWithRls` middleware that combines authentication with automatic RLS context setup for TypeORM requests. This enables PostgreSQL Row Level Security policies to access JWT claims (user_id, email, role) via session variables.

### Architecture

```typescript
import { createEnsureAuthWithRls } from '@universo/auth-backend'
import { getDataSource } from './DataSource'

// Create RLS-enabled authentication middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })

// Apply to routes that need DB access with RLS
router.use('/uniks', ensureAuthWithRls, uniksRouter)
router.use('/metaverses', ensureAuthWithRls, metaversesRoutes)
```

### Как это работает

1. **Authentication**: Validates user session via Passport
2. **JWT Extraction**: Retrieves Supabase access_token from session
3. **JWT Verification**: Verifies token using `jose` library with SUPABASE_JWT_SECRET
4. **QueryRunner Creation**: Creates dedicated TypeORM QueryRunner per request
5. **RLS Context Application**: Executes PostgreSQL commands:
   ```sql
   SET LOCAL role = 'authenticated';
   SELECT set_config('request.jwt.claims', '{"sub":"user-id","email":"user@example.com","role":"authenticated"}', true);
   SELECT set_config('request.jwt.token', 'actual-jwt-token', true);
   ```
6. **Request Context**: Attaches QueryRunner to `req.dbContext.manager` for route handlers
7. **Cleanup**: Automatically releases QueryRunner on request finish/close

### Usage in Services

Services should use request-bound EntityManager instead of DataSource manager:

```typescript
import type { RequestWithDbContext } from '@universo/auth-backend'

function getRequestManager(req: Request, dataSource: DataSource) {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

router.get('/items', async (req, res) => {
    const manager = getRequestManager(req, getDataSource())
    const items = await manager.getRepository(Item).find() // RLS applied
    res.json(items)
})
```

### PostgreSQL RLS Policies

RLS policies can access JWT claims via:

```sql
-- Example policy using request.jwt.claims
CREATE POLICY "Users can only access their own data" ON uniks
    FOR ALL
    USING (
        owner_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
    );
```

### Зависимости

- `jose@^5.9.6` - Modern JWT verification (replaces jsonwebtoken)
- `typeorm@^0.3.20` - QueryRunner lifecycle management

### Обработка ошибок

- **Invalid JWT**: Returns 401 Unauthorized with error details
- **Missing access_token**: Returns 401 if no token in session
- **DB Connection Issues**: Properly releases QueryRunner and returns 500
- **Query Timeout**: QueryRunner cleanup prevents connection leaks

### Performance Considerations

- Each request creates a dedicated QueryRunner (connection from pool)
- QueryRunner is released on request completion (automatic cleanup)
- JWT verification is done once per request (cached in req.dbContext)
- Session variables are transaction-scoped (LOCAL) for isolation

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
- **QueryRunner Lifecycle**: Automatic resource cleanup and connection pooling
- **Request Context**: Per-request database manager attachment

## Разработка

### Предварительные требования
- Node.js 18+
- PNPM workspace environment
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

Consumed by `packages/flowise-core-backend/base`. Required variables:

### Required Variables
- `SESSION_SECRET` - Secret key for session signing and encryption
- `SUPABASE_URL` - Supabase project URL for authentication
- `SUPABASE_ANON_KEY` - Supabase anonymous public key
- `SUPABASE_JWT_SECRET` - JWT secret for token verification in RLS context

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
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-key

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
app.use('/api/v1/auth', createAuthRouter(csrfProtection, loginLimiter))
```

### RLS-Enabled Route Protection
```typescript
// routes/index.ts
import { createEnsureAuthWithRls } from '@universo/auth-backend'
import { getDataSource } from '../DataSource'

// Create RLS middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })

// Apply to database routes
router.use('/uniks', ensureAuthWithRls, uniksRouter)
router.use('/metaverses', ensureAuthWithRls, metaversesRouter)
router.use('/profile', ensureAuthWithRls, profileRouter)
```

### Service Layer with RLS
```typescript
// services/uniksService.ts
import type { Request } from 'express'
import type { RequestWithDbContext } from '@universo/auth-backend'
import { getDataSource } from '../DataSource'

function getRequestManager(req: Request) {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? getDataSource().manager
}

export async function getUserUniks(req: Request) {
    const manager = getRequestManager(req)
    const unikRepo = manager.getRepository(Unik)
    
    // RLS policies automatically filter by user
    return await unikRepo.find({
        relations: ['users', 'sections']
    })
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
- **Secret Verification**: JWT tokens verified using `SUPABASE_JWT_SECRET`
- **Expiration Handling**: Automatic token refresh before expiration
- **Single-flight Refresh**: Prevents concurrent refresh requests
- **Secure Storage**: Access tokens stored in session, not client-side

## Руководство по миграции

### From Basic Authentication
If migrating from simple authentication to RLS-enabled authentication:

1. **Update Middleware**: Replace `ensureAuth` with `createEnsureAuthWithRls`
2. **Service Layer**: Use `getRequestManager()` instead of direct DataSource
3. **Database Policies**: Create appropriate RLS policies in PostgreSQL
4. **Environment**: Add `SUPABASE_JWT_SECRET` to environment variables

### Migration Steps
```typescript
// Before: Basic authentication
router.use('/api/uniks', ensureAuth, uniksRouter)

// After: RLS-enabled authentication  
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })
router.use('/api/uniks', ensureAuthWithRls, uniksRouter)
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
        const runner = mockQueryRunner()
        await applyRlsContext(runner, mockJwtToken)
        
        expect(runner.query).toHaveBeenCalledWith(
            "SET LOCAL role = 'authenticated'"
        )
        expect(runner.query).toHaveBeenCalledWith(
            "SELECT set_config('request.jwt.claims', $1::text, true)",
            [expect.stringContaining('"sub":"test-user-id"')]
        )
    })
})
```

## Оптимизация производительности

### QueryRunner Management
- **Per-request Pools**: Each request gets dedicated QueryRunner from connection pool
- **Automatic Cleanup**: QueryRunner released on request completion (finish/close)
- **Error Recovery**: Proper cleanup even on request errors or timeouts
- **Connection Reuse**: Pool management prevents connection exhaustion

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
    if (!runner.isReleased) {
        await runner.release()
    }
    delete req.dbContext
}
```

## Связанная документация

- [Authentication Frontend](../../auth-frontend/base/README.md)
- [RLS Integration Pattern](../../../memory-bank/rls-integration-pattern.md)
- [Flowise Server Integration](../../flowise-server/README.md)
- [TypeORM Data Access](../../../docs/en/universo-platformo/database.md)

---

**Universo Platformo | Authentication Service Package**
