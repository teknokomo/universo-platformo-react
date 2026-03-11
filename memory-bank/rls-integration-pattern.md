# Row Level Security (RLS) Integration Pattern

## Overview

Pattern for integrating PostgreSQL Row Level Security with the current Knex-based runtime.

The repository no longer uses TypeORM `DataSource`, `EntityManager`, `QueryRunner`, or repository APIs. All request-bound database access now flows through neutral `DbSession` and `DbExecutor` contracts attached to `req.dbContext` by `ensureAuthWithRls`.

Use this pattern when a route must execute SQL under the authenticated user's PostgreSQL JWT context.

## Goals

- Keep JWT claims bound to one pinned database connection for the whole request.
- Expose only neutral SQL contracts to route and service code.
- Prevent RLS context leaks between pooled requests.
- Allow nested writes and transactions without breaking the request-bound session.

## Current Stack

- Middleware: `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`
- JWT to PostgreSQL context bridge: `packages/auth-backend/base/src/utils/rlsContext.ts`
- Neutral DB contracts: `packages/universo-utils/base/src/database/manager.ts`
- Knex runtime and RLS executor: `@universo/database`
- Route mounting: `packages/universo-core-backend/base/src/routes/index.ts`

## Architecture

```text
HTTP request with session/JWT
        |
        v
ensureAuthWithRls
  - ensureAuth()
  - acquire pinned Knex connection
  - BEGIN
  - SET LOCAL statement_timeout
  - create DbSession bound to pinned connection
  - applyRlsContext(session, accessToken)
  - create RLS DbExecutor bound to same connection
  - attach req.dbContext = { session, executor }
        |
        v
route / guard / service code
  - getRequestDbSession(req) for auth/permission checks
  - getRequestDbExecutor(req, fallback) for store queries
        |
        v
PostgreSQL query execution
  - same request transaction
  - same JWT claims in request.jwt.claims
  - RLS policies evaluate against the authenticated user
        |
        v
response finish/close
  - COMMIT or ROLLBACK
  - release pinned connection
  - clear req.dbContext
```

## Why the Same Connection Matters

PostgreSQL evaluates row security policies as part of the executing query context. The current implementation sets `request.jwt.claims` with `set_config(..., true)`, which PostgreSQL documents as transaction-local when `is_local = true`.

Implication:

- Queries that must observe the authenticated JWT context must run on the same pinned request transaction where `set_config('request.jwt.claims', ..., true)` was executed.
- A fresh pool executor created with `createKnexExecutor(getKnex())` does not inherit that transaction-local state.
- Therefore authenticated handlers must prefer `getRequestDbExecutor(req, fallback)` or `getRequestDbSession(req)`.

Relevant PostgreSQL notes:

- `set_config(setting_name, new_value, is_local)` applies only to the current transaction when `is_local` is `true`.
- RLS policy expressions are evaluated for each row as part of query execution.

## Middleware Lifecycle

### 1. Authenticate the request

`ensureAuthWithRls` first delegates to `ensureAuth` and extracts the Supabase access token from the authenticated request.

### 2. Pin one Knex connection

The middleware acquires a dedicated connection from the Knex pool and starts a request-level transaction with `BEGIN`.

### 3. Build a neutral request `DbSession`

The session wrapper exposes only:

- `query(sql, parameters)`
- `isReleased()`

The wrapper also converts PostgreSQL `$n` bindings to the placeholder format expected by the underlying Knex client before executing SQL on the pinned connection.

### 4. Apply JWT claims

`applyRlsContext(session, accessToken)` verifies the JWT and runs:

```sql
SELECT set_config('request.jwt.claims', $1::text, true)
```

The middleware does not switch the PostgreSQL role to `authenticated`; it only sets `request.jwt.claims`. This keeps schema access stable while still making `auth.uid()` and related policy helpers work.

### 5. Build a request `DbExecutor`

`createRlsExecutor(knex, connection, { inTransaction: true })` returns a request-bound executor whose queries and nested transactions stay on the same pinned connection. Top-level transaction calls become savepoint-based nested transactions inside the request transaction.

### 6. Attach the request context

The middleware stores the neutral context on `req.dbContext` via `createRequestDbContext(session, executor)`.

### 7. Cleanup safely

On `finish` and `close`, the middleware commits or rolls back as needed, releases the pinned connection, and removes `req.dbContext`.

## Reference Implementation

### Request context types

```typescript
export interface RequestDbContext {
    session: DbSession
    executor: DbExecutor
    isReleased(): boolean
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
}
```

### Core access helpers

```typescript
export function getRequestDbSession(req: unknown): DbSession | undefined {
    return getRequestDbContext(req)?.session
}

export function getRequestDbExecutor(req: unknown, fallback: DbExecutor): DbExecutor {
    return getRequestDbContext(req)?.executor ?? fallback
}
```

### Middleware mounting

```typescript
import { createEnsureAuthWithRls } from '@universo/auth-backend'
import { getKnex, createKnexExecutor } from '@universo/database'
import { getRequestDbExecutor } from '@universo/utils'

const ensureAuthWithRls = createEnsureAuthWithRls({ getKnex })

router.use('/admin/instances', ensureAuthWithRls, instancesRouter)
router.use('/admin/settings', ensureAuthWithRls, adminSettingsRouter)
router.use('/profile', profileRouter)

const profileRouter = createProfileRoutes(
    {
        getDbExecutor: () => createKnexExecutor(getKnex()),
        getRequestDbExecutor: (req) => getRequestDbExecutor(req, createKnexExecutor(getKnex()))
    },
    ensureAuthWithRls
)
```

## Route Patterns

### Correct pattern for authenticated store access

```typescript
router.get('/', ensureAuthWithRls, async (req, res) => {
    const exec = getRequestDbExecutor(req, getDbExecutor())
    const rows = await listSomething(exec)
    res.json({ success: true, data: rows })
})
```

### Correct pattern for permission and access checks

```typescript
const dbSession = getRequestDbSession(req)
const allowed = await permissionService.hasPermission(userId, subject, action, undefined, dbSession)
```

### Public route pattern

Routes that intentionally run without authentication or without request-level RLS may use the pool-level executor directly.

```typescript
router.get('/public-feed', async (_req, res) => {
    const exec = getDbExecutor()
    const rows = await listPublicRows(exec)
    res.json(rows)
})
```

## Store and Service Expectations

### Stores

- Accept `DbExecutor` for query and transaction support.
- Use raw parameterized SQL only.
- Remain agnostic to whether the executor is pool-level or request-scoped.

### Guards and permission layers

- Prefer `DbSession` when they only need scoped reads/checks.
- Read from `req.dbContext` through `getRequestDbSession(req)`.

### Services performing writes

- Use the request executor when the route is under `ensureAuthWithRls`.
- Nested `executor.transaction(...)` is safe because the request executor stays on the pinned connection.

## Anti-Patterns

### Do not create a fresh pool executor inside an authenticated handler

```typescript
// Wrong for authenticated request-bound work
const exec = getDbExecutor()
await storeCall(exec)
```

Reason: this can bypass the request transaction and lose `request.jwt.claims`.

### Do not use TypeORM-era primitives

The following are obsolete in this repository and must not appear in new RLS guidance:

- `DataSource`
- `EntityManager`
- `QueryRunner`
- `manager.getRepository(...)`
- `dataSource.transaction(...)` as the primary route-scoped RLS pattern

### Do not switch PostgreSQL role for normal request RLS

The current implementation intentionally avoids `SET ROLE authenticated`. JWT claims are sufficient for `auth.uid()`-based policies, and role switching can break schema privileges.

## Review Checklist

Use this checklist when reviewing RLS-sensitive code:

- Is the route mounted behind `ensureAuthWithRls`?
- Does the handler use `getRequestDbExecutor(req, fallback)` instead of a fresh pool executor?
- Do permission checks use `getRequestDbSession(req)` when a request context exists?
- Are nested writes performed through the request executor?
- Is the route public by design if it still uses `getDbExecutor()` directly?
- Does the code avoid TypeORM-era guidance and terminology?

## Known Safe Exceptions

- Public endpoints with no authenticated request context.
- Startup/bootstrap code executed outside the HTTP request lifecycle.
- Explicitly non-RLS administrative or migration flows that intentionally run on a pool executor and are not expected to inherit request JWT claims.

## Related Files

- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`
- `packages/auth-backend/base/src/utils/rlsContext.ts`
- `packages/universo-utils/base/src/database/manager.ts`
- `packages/universo-core-backend/base/src/routes/index.ts`
- `packages/admin-backend/base/src/guards/ensureGlobalAccess.ts`

## External Notes

- PostgreSQL configuration docs confirm that `set_config(..., true)` is transaction-local.
- PostgreSQL row security docs confirm that policy expressions are evaluated as part of query execution for the active user/query context.

Those two facts are the basis for the repository rule: authenticated request SQL must execute through the request-scoped context, not a fresh pooled executor.
