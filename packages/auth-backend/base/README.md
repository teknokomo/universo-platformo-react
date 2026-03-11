# Authentication Service (@universo/auth-backend)

Production-grade authentication service powering Universo Platformo's server-side authentication. Built with Passport.js + Supabase and mounted inside `packages/universo-core-backend/base` at `/api/v1/auth`.

## Overview

This package provides a comprehensive backend authentication solution that combines Passport.js session management with Supabase identity services and advanced Row Level Security (RLS) integration for PostgreSQL. Designed as a secure, scalable authentication layer for multi-tenant applications.

## Key Features

- **Passport.js Integration**: LocalStrategy with Supabase as identity provider
- **Session Management**: Express-session with HttpOnly cookies and configurable security settings
- **CSRF Protection**: Built-in CSRF tokens via `csurf` middleware with `X-CSRF-Token` headers
- **Rate Limiting**: Login attempt protection (10 attempts per minute window)
- **Token Management**: Automatic Supabase access-token refresh with single-flight locking
- **Row Level Security (RLS)**: Advanced JWT context propagation to PostgreSQL via a request-scoped DB session
- **Production Security**: Cookie security, session regeneration, and comprehensive error handling

## Endpoints (mounted under `/api/v1/auth`)

- `GET /csrf` — returns `{ csrfToken }`
- `POST /login` — `{ email, password }`, CSRF required
- `GET /me` — resolves current Supabase user
- `POST /refresh` — optional manual refresh (sessions auto-refresh transparently)
- `POST /logout` — signs out and clears session

## Row Level Security (RLS) Integration

### Overview

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

### How It Works

1. **Authentication**: Validates user session via Passport
2. **JWT Extraction**: Retrieves Supabase access_token from session
3. **JWT Verification**: Verifies the Supabase token with `jose` and resolves the JWT claims payload
4. **Pinned Connection**: Acquires one dedicated Knex pool connection for the full request lifecycle
5. **RLS Context Application**: Writes `request.jwt.claims` on that pinned connection so PostgreSQL policies can read the authenticated user context
6. **Request Context**: Attaches a neutral `DbSession` / `DbExecutor` pair to `req.dbContext` for route handlers and services
7. **Cleanup**: Resets the session claims and releases the pinned connection on request finish/close

### Usage in Services

Services should use the request-bound executor instead of a global pool query helper when RLS matters:

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

### Dependencies

- `jose@^5.9.6` - Modern JWT verification for Supabase access tokens
- `@universo/database` - Shared Knex runtime plus `createRlsExecutor()` for pinned request execution

### Error Handling

- **Invalid JWT**: Returns 401 Unauthorized with error details
- **Missing access_token**: Returns 401 if no token in session
- **DB Connection Issues**: Properly releases the request-scoped transport and returns 500
- **Query Timeout**: Request transport cleanup prevents connection leaks

### Performance Considerations

- Each protected request uses one pinned Knex connection until cleanup runs
- The request-scoped executor keeps all queries and transactions on that same connection
- JWT verification happens once per request before `req.dbContext` is populated
- Cleanup explicitly clears `request.jwt.claims` before the connection returns to the pool

## Core Components

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

## Development

### Prerequisites
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

### Build Output
- **CommonJS**: `dist/index.js` + `dist/index.d.ts`
- **ES Modules**: `dist/index.mjs` + `dist/index.d.ts`
- **TypeScript**: Full type definitions included

## Environment Configuration

Consumed by `packages/universo-core-backend/base`. Required variables:

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

## Integration Examples

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

## Security Considerations

### Session Security
- **HttpOnly Cookies**: Prevents XSS attacks via client-side cookie access
- **Secure Flag**: Ensures cookies only sent over HTTPS in production
- **SameSite Protection**: Prevents CSRF attacks via cookie SameSite attribute
- **Session Regeneration**: New session ID on login to prevent session fixation

### CSRF Protection
- **Token-based**: CSRF tokens required for state-changing operations
- **Header Validation**: `X-CSRF-Token` header validation on protected routes
- **Session-bound**: CSRF tokens tied to user session for security

### Rate Limiting
- **Login Protection**: Configurable limits on login attempts per IP
- **Sliding Window**: Time-based rate limiting with automatic reset
- **Customizable**: Adjustable window size and attempt limits

### JWT Security
- **Secret Verification**: JWT tokens verified using `SUPABASE_JWT_SECRET`
- **Expiration Handling**: Automatic token refresh before expiration
- **Single-flight Refresh**: Prevents concurrent refresh requests
- **Secure Storage**: Access tokens stored in session, not client-side

## Migration Guide

### From Basic Authentication
If migrating from simple authentication to RLS-enabled authentication:

1. **Update Middleware**: Replace `ensureAuth` with `createEnsureAuthWithRls`
2. **Service Layer**: Use a request-bound executor instead of global database helpers
3. **Database Policies**: Create appropriate RLS policies in PostgreSQL
4. **Environment**: Add `SUPABASE_JWT_SECRET` to environment variables

### Migration Steps
```typescript
// Before: Basic authentication
router.use('/api/v1/metahubs', ensureAuth, metahubsRouter)

// After: RLS-enabled authentication  
const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })
router.use('/api/v1/metahubs', ensureAuthWithRls, metahubsRouter)
```

## Testing

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

## Performance Optimization

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

## Related Documentation

- [Authentication Frontend](../../auth-frontend/base/README.md)
- [RLS Integration Pattern](../../../memory-bank/rls-integration-pattern.md)
- [Core Backend Integration](../../universo-core-backend/base/README.md)
- [Database Architecture](../../../docs/en/architecture/database.md)

---

**Universo Platformo | Authentication Service Package**
