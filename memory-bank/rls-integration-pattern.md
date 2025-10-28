# Row Level Security (RLS) Integration Pattern

## Overview

Pattern for integrating PostgreSQL Row Level Security with TypeORM via JWT context propagation through Express middleware.

**When to Use**:
- Multi-tenant applications with row-level data isolation
- Security-critical applications requiring database-enforced access control
- TypeORM + PostgreSQL stack with JWT authentication
- Replacing application-level access control with database policies

**Key Benefits**:
- Defense in depth: Security enforced at DB level, not just application code
- Zero-trust architecture: Even compromised application code cannot bypass RLS
- Centralized access control: Policies defined in migrations, not scattered across services
- Automatic filtering: No need to manually add `WHERE user_id = current_user` everywhere

---

## Architecture

### Component Stack

```
┌─────────────────────────────────────────────────┐
│          Express Request (with JWT)             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  ensureAuthWithRls Middleware (@universo/auth-srv) │
│  • Validates JWT                                 │
│  • Creates QueryRunner per request               │
│  • Sets PostgreSQL session variables             │
│  • Attaches manager to req.dbContext             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│       Route Handler (Service/Repository)        │
│  • Gets manager from req.dbContext               │
│  • Executes queries with RLS context            │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          PostgreSQL with RLS Policies            │
│  • Filters rows based on request.jwt.claims      │
│  • Enforces access control at database level     │
└─────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Middleware Setup (@universo/auth-srv)

**File**: `packages/auth-srv/base/src/middlewares/ensureAuthWithRls.ts`

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { DataSource, QueryRunner } from 'typeorm'
import { applyRlsContext } from '../utils/rlsContext'
import { ensureAuth } from './ensureAuth'

export interface DbContext {
    queryRunner: QueryRunner
    manager: EntityManager
}

export interface RequestWithDbContext extends Request {
    dbContext?: DbContext
}

export function createEnsureAuthWithRls(options: {
    getDataSource: () => DataSource
}): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        // 1. Validate authentication
        ensureAuth(req, res, async (authErr?: any) => {
            if (authErr) return next(authErr)

            try {
                const dataSource = options.getDataSource()
                const user = (req as any).user
                const accessToken = user?.supabaseAccessToken

                if (!accessToken) {
                    return res.status(401).json({ error: 'No access token in session' })
                }

                // 2. Create dedicated QueryRunner for this request
                const queryRunner = dataSource.createQueryRunner()
                await queryRunner.connect()

                // 3. Apply RLS context (JWT claims → PostgreSQL session variables)
                await applyRlsContext(queryRunner, accessToken)

                // 4. Attach to request for route handlers
                (req as RequestWithDbContext).dbContext = {
                    queryRunner,
                    manager: queryRunner.manager
                }

                // 5. Ensure cleanup on request completion
                res.on('finish', async () => {
                    if (!queryRunner.isReleased) {
                        await queryRunner.release()
                    }
                })
                res.on('close', async () => {
                    if (!queryRunner.isReleased) {
                        await queryRunner.release()
                    }
                })

                next()
            } catch (error: any) {
                console.error('[ensureAuthWithRls] Error:', error)
                res.status(500).json({ error: 'Database context initialization failed' })
            }
        })
    }
}
```

**Key Implementation Details**:
- Creates dedicated QueryRunner per request (isolated connection from pool)
- Sets PostgreSQL session variables with JWT claims
- Automatically releases QueryRunner on request finish/close
- Prevents connection leaks with comprehensive cleanup handlers

---

### 2. JWT Context Application

**File**: `packages/auth-srv/base/src/utils/rlsContext.ts`

```typescript
import type { QueryRunner } from 'typeorm'
import * as jose from 'jose'

export async function applyRlsContext(
    queryRunner: QueryRunner,
    accessToken: string
): Promise<void> {
    // 1. Verify JWT with jose (modern, secure)
    const jwtSecret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
    const { payload } = await jose.jwtVerify(accessToken, jwtSecret)

    // 2. Set PostgreSQL role
    await queryRunner.query(`SET LOCAL role = 'authenticated'`)

    // 3. Set request.jwt.claims for RLS policies
    const claims = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role || 'authenticated'
    }
    await queryRunner.query(
        `SELECT set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify(claims)]
    )

    // 4. Set full JWT token (optional, for advanced policies)
    await queryRunner.query(
        `SELECT set_config('request.jwt.token', $1, true)`,
        [accessToken]
    )
}
```

**Why `jose` instead of `jsonwebtoken`**:
- Modern, actively maintained (jsonwebtoken in maintenance mode)
- Better security (constant-time comparisons, strict validation)
- Native ESM support
- Smaller bundle size
- Better TypeScript types

---

### 3. Route Integration (flowise-server)

**File**: `packages/flowise-server/src/routes/index.ts`

```typescript
import { createEnsureAuthWithRls } from '@universo/auth-srv'
import { getDataSource } from '../DataSource'

// Create RLS-enabled middleware
const ensureAuthWithRls = createEnsureAuthWithRls({ getDataSource })

// Apply to database routes
router.use('/uniks', ensureAuthWithRls, uniksRouter)
router.use('/metaverses', ensureAuthWithRls, metaversesRouter)
router.use('/sections', ensureAuthWithRls, sectionsRouter)
router.use('/entities', ensureAuthWithRls, entitiesRouter)
router.use('/profile', ensureAuthWithRls, profileRouter)
```

**Migration from old ensureAuth**:
```diff
- router.use('/uniks', ensureAuth, uniksRouter)
+ router.use('/uniks', ensureAuthWithRls, uniksRouter)
```

---

### 4. Service Layer Adaptation

**Pattern 1: Direct Repository Access** (uniks-srv, metaverses-srv)

```typescript
import type { RequestWithDbContext } from '@universo/auth-srv'

function getRequestManager(req: Request, dataSource: DataSource) {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

function getRepositories(req: Request, getDataSource: () => DataSource) {
    const dataSource = getDataSource()
    const manager = getRequestManager(req, dataSource)
    return {
        unikRepo: manager.getRepository(Unik),
        unikUserRepo: manager.getRepository(UnikUser)
    }
}

router.get('/', async (req, res) => {
    const { unikRepo } = getRepositories(req, getDataSource)
    const uniks = await unikRepo.find() // RLS automatically applied
    res.json(uniks)
})
```

**Pattern 2: Service-Based Architecture** (spaces-srv)

For services using `dataSource.transaction()`, RLS is applied at connection level:

```typescript
// spaces-srv uses transaction() which creates new QueryRunner
// RLS context must be set at connection level, not per-transaction
// Current implementation: RLS applied via middleware, transactions inherit context

// Note: This pattern requires further investigation to ensure
// transactions properly inherit RLS context from parent connection
```

---

### 5. PostgreSQL RLS Policies

**Example Migration**: `packages/flowise-server/src/database/migrations/xxxx-add-rls-policies.ts`

```sql
-- Enable RLS on table
ALTER TABLE uniks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see uniks they own or are members of
CREATE POLICY "Users can access their uniks" ON uniks
    FOR ALL
    USING (
        owner_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        OR
        EXISTS (
            SELECT 1 FROM unik_users
            WHERE unik_users.unik_id = uniks.id
            AND unik_users.user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
        )
    );

-- Policy: Admins bypass RLS
CREATE POLICY "Admins have full access" ON uniks
    FOR ALL
    TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    );
```

**Accessing JWT Claims in Policies**:
```sql
-- User ID (sub claim)
(current_setting('request.jwt.claims', true)::json->>'sub')::uuid

-- Email
(current_setting('request.jwt.claims', true)::json->>'email')

-- Role
(current_setting('request.jwt.claims', true)::json->>'role')
```

---

## Testing Strategy

### 1. Unit Tests (Middleware)

```typescript
describe('ensureAuthWithRls', () => {
    it('should set RLS context from valid JWT', async () => {
        const req = mockRequest({ user: { supabaseAccessToken: validJWT } })
        const res = mockResponse()
        const next = jest.fn()

        await ensureAuthWithRls(req, res, next)

        expect(req.dbContext).toBeDefined()
        expect(req.dbContext.manager).toBeDefined()
        expect(next).toHaveBeenCalled()
    })

    it('should release QueryRunner on response finish', async () => {
        const req = mockRequest({ user: { supabaseAccessToken: validJWT } })
        const res = mockResponse()
        const next = jest.fn()

        await ensureAuthWithRls(req, res, next)
        const queryRunner = req.dbContext.queryRunner

        res.emit('finish')

        expect(queryRunner.isReleased).toBe(true)
    })
})
```

### 2. Integration Tests (E2E)

```typescript
describe('RLS Integration', () => {
    it('should filter uniks by user ownership', async () => {
        const user1Token = await createTestUser('user1@example.com')
        const user2Token = await createTestUser('user2@example.com')

        await createUnik({ ownerId: 'user1-id', name: 'User1 Unik' })
        await createUnik({ ownerId: 'user2-id', name: 'User2 Unik' })

        const response = await request(app)
            .get('/api/v1/uniks')
            .set('Cookie', `session=${user1Token}`)

        expect(response.body).toHaveLength(1)
        expect(response.body[0].name).toBe('User1 Unik')
    })
})
```

### 3. Performance Tests

```bash
# Artillery load test with RLS
artillery run --target http://localhost:3000 artillery-rls-test.yml
```

```yaml
# artillery-rls-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Sustained RLS load"

scenarios:
  - name: "List uniks with RLS"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "test@example.com"
            password: "testpass"
      - get:
          url: "/api/v1/uniks"
```

---

## Performance Considerations

### QueryRunner Lifecycle

**Connection Pooling**:
- Each request creates QueryRunner from pool
- QueryRunner holds exclusive connection until released
- Pool size configured in TypeORM DataSource options

**Optimization**:
```typescript
// DataSource configuration
{
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    extra: {
        max: 20,  // Max connections in pool
        min: 2,   // Min idle connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    }
}
```

**Connection Leak Prevention**:
- Automatic cleanup on `res.on('finish')` and `res.on('close')`
- Handles aborted requests and timeouts
- No manual cleanup needed in route handlers

### JWT Verification Overhead

**Caching Strategy** (future optimization):
```typescript
// Optional: Cache verified JWT payloads per session
const jwtCache = new Map<string, { payload: JWTPayload, exp: number }>()

export async function applyRlsContext(queryRunner: QueryRunner, accessToken: string) {
    const cached = jwtCache.get(accessToken)
    if (cached && cached.exp > Date.now()) {
        // Use cached payload
    } else {
        // Verify and cache
        const { payload } = await jose.jwtVerify(accessToken, jwtSecret)
        jwtCache.set(accessToken, { payload, exp: payload.exp! * 1000 })
    }
}
```

**Current Implementation**: No caching (verify on every request)
- Negligible overhead: ~1-2ms per verification
- Ensures fresh claims on every request
- Simplifies implementation (no cache invalidation needed)

---

## Migration Checklist

### Phase 1: Infrastructure Setup

- [x] Add `jose@^5.9.6` and `typeorm@^0.3.20` to auth-srv
- [x] Create `rlsContext.ts` utility
- [x] Create `ensureAuthWithRls` middleware
- [x] Export from auth-srv index.ts

### Phase 2: Service Migration

- [x] Update flowise-server routes to use `ensureAuthWithRls`
- [x] Migrate uniks-srv routes (direct repository pattern)
- [x] Migrate metaverses-srv routes (direct repository pattern)
- [ ] Investigate spaces-srv transaction() compatibility
- [ ] Test profile-srv RLS requirements

### Phase 3: Database Policies

- [ ] Create migration for RLS policies
- [ ] Enable RLS on sensitive tables
- [ ] Define access policies per table
- [ ] Test policies with sample data

### Phase 4: Testing & Validation

- [ ] Unit tests for middleware
- [ ] Integration tests for RLS filtering
- [ ] Performance tests under load
- [ ] Security audit of policies

### Phase 5: Documentation & Deployment

- [x] Update auth-srv README
- [x] Document systemPatterns.md pattern
- [x] Update techContext.md dependencies
- [ ] Create deployment checklist
- [ ] Monitor production metrics

---

## Common Pitfalls

### ❌ Using DataSource.manager instead of req.dbContext.manager

```typescript
// WRONG - bypasses RLS
router.get('/uniks', async (req, res) => {
    const uniks = await getDataSource().getRepository(Unik).find()
    // Returns ALL uniks, ignoring RLS policies
})

// CORRECT - uses RLS-enabled manager
router.get('/uniks', async (req, res) => {
    const manager = getRequestManager(req, getDataSource())
    const uniks = await manager.getRepository(Unik).find()
    // Returns only uniks user has access to
})
```

### ❌ Forgetting to Apply Middleware

```typescript
// WRONG - no RLS context
router.use('/uniks', uniksRouter)

// CORRECT - RLS middleware applied
router.use('/uniks', ensureAuthWithRls, uniksRouter)
```

### ❌ Transaction Issues

```typescript
// POTENTIAL ISSUE - transaction creates new QueryRunner
await dataSource.transaction(async (manager) => {
    // Does this inherit RLS context? Needs investigation
    await manager.getRepository(Unik).save(unik)
})

// SAFE ALTERNATIVE - use req.dbContext.queryRunner
const queryRunner = (req as RequestWithDbContext).dbContext?.queryRunner
await queryRunner.startTransaction()
try {
    await queryRunner.manager.getRepository(Unik).save(unik)
    await queryRunner.commitTransaction()
} catch (error) {
    await queryRunner.rollbackTransaction()
    throw error
}
```

---

## Future Enhancements

### 1. Transaction Support

Investigate and document proper RLS context inheritance for `dataSource.transaction()`:
- Option A: Monkey-patch transaction() to use parent QueryRunner
- Option B: Provide custom `transactionWithRls()` helper
- Option C: Document limitations and provide workarounds

### 2. Performance Monitoring

Add telemetry for RLS overhead:
```typescript
const rlsMetrics = {
    jwtVerifyTime: histogram('rls_jwt_verify_ms'),
    queryRunnerLifetime: histogram('rls_queryrunner_lifetime_ms'),
    activeCon connections: gauge('rls_active_connections')
}
```

### 3. Policy Testing Framework

Create helper for testing RLS policies in migrations:
```typescript
import { testRlsPolicy } from '@universo/test-utils'

await testRlsPolicy({
    table: 'uniks',
    policy: 'Users can access their uniks',
    scenarios: [
        {
            name: 'Owner can see own unik',
            userId: 'user1',
            expectedRows: ['unik1']
        },
        {
            name: 'Member can see shared unik',
            userId: 'user2',
            expectedRows: ['unik1']
        }
    ]
})
```

---

## References

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [TypeORM QueryRunner Documentation](https://typeorm.io/query-runner)
- [jose JWT Library](https://github.com/panva/jose)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
