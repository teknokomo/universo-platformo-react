# @universo/auth-srv

Passport.js + Supabase session toolkit powering Universo Platformo server authentication. The module now ships as a dual ESM/CJS library and is mounted inside `packages/flowise-server` at `/api/v1/auth`.

## Features

- Passport LocalStrategy with Supabase as identity provider
- Express-session cookie storage (HttpOnly, configurable SameSite/Secure)
- CSRF protection via `csurf` and `X-CSRF-Token`
- Login rate limiting (1 minute window, 10 attempts)
- Automatic Supabase access-token refresh with single-flight locking
- **Row Level Security (RLS) Integration** - JWT context propagation to PostgreSQL via QueryRunner

## Endpoints (mounted under `/api/v1/auth`)

- `GET /csrf` — returns `{ csrfToken }`
- `POST /login` — `{ email, password }`, CSRF required
- `GET /me` — resolves current Supabase user
- `POST /refresh` — optional manual refresh (sessions auto-refresh transparently)
- `POST /logout` — signs out and clears session

## Row Level Security (RLS) Integration

### Overview

The package provides `createEnsureAuthWithRls` middleware that combines authentication with automatic RLS context setup for TypeORM requests. This enables PostgreSQL Row Level Security policies to access JWT claims (user_id, email, role) via session variables.

### Architecture

```typescript
import { createEnsureAuthWithRls } from '@universo/auth-srv'
import { getDataSource } from './DataSource'

// Create RLS-enabled authentication middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })

// Apply to routes that need DB access with RLS
router.use('/uniks', ensureAuthWithRls, uniksRouter)
router.use('/metaverses', ensureAuthWithRls, metaversesRoutes)
```

### How It Works

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
import type { RequestWithDbContext } from '@universo/auth-srv'

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

### Dependencies

- `jose@^5.9.6` - Modern JWT verification (replaces jsonwebtoken)
- `typeorm@^0.3.20` - QueryRunner lifecycle management

### Error Handling

- **Invalid JWT**: Returns 401 Unauthorized with error details
- **Missing access_token**: Returns 401 if no token in session
- **DB Connection Issues**: Properly releases QueryRunner and returns 500
- **Query Timeout**: QueryRunner cleanup prevents connection leaks

### Performance Considerations

- Each request creates a dedicated QueryRunner (connection from pool)
- QueryRunner is released on request completion (automatic cleanup)
- JWT verification is done once per request (cached in req.dbContext)
- Session variables are transaction-scoped (LOCAL) for isolation

## Environment

Consumed by `packages/flowise-server`. Required variables:

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET` - Used for JWT verification in RLS context
- Optional cookie tuning: `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAXAGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`

## Build

```bash
pnpm --filter @universo/auth-srv build
```

Outputs CommonJS build to `dist/` and ESM build to `dist/esm/`.
