# Complete TypeORM Removal Plan — 2026-03-10

> **Goal**: Fully remove TypeORM from the entire project. Replace all remaining TypeORM consumers (auth, admin, profile, start, core-backend) with Knex/SQL-first architecture. Clean up all legacy compatibility layers. Ensure fresh DB startup creates all platform schemas and the full Metahub → Application workflow is operational. Deliver a unified migration/definition lifecycle for DB ↔ file round-trip readiness using the existing `upl_migrations` catalog primitives instead of introducing parallel registries.

> **Context**: TypeORM already removed from `metahubs-backend` and `applications-backend`. Unified migration system (`migrations-core`, `migrations-catalog`, `migrations-platform`) is 100% Knex. Native SQL platform migration definitions exist for all 4 platform schemas (admin, profile, metahubs, applications). The remaining TypeORM surface is isolated in `auth-backend`, `admin-backend`, `profile-backend`, `start-backend`, `universo-core-backend`, and `universo-utils`. The catalog layer already includes `definition_registry`, `definition_revisions`, `definition_exports`, `approval_events`, and `definition_drafts`; the final plan must REUSE this lifecycle instead of inventing a second one.

> **Constraint**: Fresh test database — no legacy data to preserve. No schema/template version increase required. All legacy TypeORM code can be removed without compatibility shims.

> **QA Review**: Plan updated 2026-03-10 after comprehensive QA analysis and a second-pass architecture review. Changes: FINDING-1 (set_config security fix), FINDING-2 (pinned-connection transaction architecture), FINDING-3 (circular dep → new `@universo/database` package), FINDING-4 (localesRoutes RLS distinction), FINDING-5 (pool budget moved to Phase 0), FINDING-6 (interface unification), FINDING-7 (parameter binding convention), FINDING-8 (`knex.raw().connection()` pattern), FINDING-9 (legacyChecksumAliases moved to Phase 0), FINDING-10 (no unnecessary new public interfaces), FINDING-11 (`schema-ddl` must stay DI-only), FINDING-12 (reuse existing definition lifecycle catalog), FINDING-13 (explicit metahub/application runtime convergence track), ТЗ gaps (definition lifecycle, editor readiness, convergence semantics added to Phase 9).

---

## Phase 0: Foundation — `@universo/database` Package, Pool, Checksum Cleanup

### Overview
Three sub-phases that establish the infrastructure for ALL subsequent work:

**0A. New `@universo/database` package** — Currently `KnexClient` lives inside `packages/metahubs-backend/base/src/domains/ddl/KnexClient.ts` and is imported by `core-backend` from `@universo/metahubs-backend`. Placing the new singleton in `core-backend` would create a **circular dependency** (`core-backend → metahubs-backend` for route wiring AND `metahubs-backend → core-backend` for KnexClient). Solution: extract into a dedicated leaf-level `@universo/database` package that everything can depend on without cycles.

**0B. Pool budget simplification** — With TypeORM being removed, the entire connection pool belongs to Knex. The dual-pool budget split logic (`connectionBudget / 3` for Knex, remainder for TypeORM) must be simplified NOW, not in Phase 9, to avoid budget confusion during intermediate phases.

**0C. legacyChecksumAliases cleanup** — Fresh database means zero stale checksum entries. The `legacyChecksumAliases` wrappers in `platformMigrations.ts` and the `withLegacyChecksumAliases()` machinery in `migrations-core` can be removed immediately, simplifying migration logic from the very first step.

### Steps

#### 0A. Create `@universo/database` package

- [ ] **0A.1** Create `packages/universo-database/base/` with:
  - `package.json` — deps: `knex`, `pg`; peerDep on `@universo/utils` (for `parsePositiveInt`)
  - `tsconfig.json` + build config (same pattern as `universo-utils`)
  - `src/KnexClient.ts` — Knex singleton (copied from `metahubs-backend/domains/ddl/KnexClient.ts`)
  - `src/knexExecutor.ts` — `createKnexExecutor()` and `createRlsExecutor()` factories (see Phase 1 for details)
  - `src/index.ts` — barrel exports

```typescript
// packages/universo-database/base/src/KnexClient.ts
import knex, { type Knex } from 'knex'
import { parsePositiveInt } from '@universo/utils'

let instance: Knex | null = null

export function initKnex(): Knex {
  if (instance) return instance
  const host = process.env.DATABASE_HOST
  const port = parsePositiveInt(process.env.DATABASE_PORT, 5432)
  const user = process.env.DATABASE_USER
  const password = process.env.DATABASE_PASSWORD
  const database = process.env.DATABASE_NAME
  if (!host || !user || !password || !database) {
    throw new Error('[KnexClient] Missing DATABASE_HOST/USER/PASSWORD/NAME')
  }
  const sslConfig = /* existing SSL detection logic from metahubs KnexClient */
  const poolMax = parsePositiveInt(process.env.DATABASE_POOL_MAX, 15) // FULL budget, no split
  instance = knex({
    client: 'pg',
    connection: { host, port, user, password, database, ssl: sslConfig },
    pool: { min: 0, max: poolMax, acquireTimeoutMillis: 10000, idleTimeoutMillis: 15000, reapIntervalMillis: 1000, createTimeoutMillis: 10000, destroyTimeoutMillis: 5000, propagateCreateError: false }
  })
  // Keep pool monitoring, tarn.js hooks (copy from existing KnexClient)
  return instance
}

export function getKnex(): Knex {
  if (!instance) return initKnex()
  return instance
}

export async function destroyKnex(): Promise<void> {
  if (instance) { await instance.destroy(); instance = null }
}
```

- [ ] **0A.2** Update `metahubs-backend` to import from `@universo/database` instead of local `domains/ddl/KnexClient.ts`
  - Redirect `metahubs-backend/base/src/domains/ddl/index.ts` re-export to `@universo/database`
  - All ~20 internal consumers in metahubs-backend keep their `../../ddl` import unchanged — only the barrel re-export changes
  - Delete the original `KnexClient.ts` from metahubs-backend

- [ ] **0A.3** Update `core-backend/base/src/index.ts` (`App.initDatabase()`) to use `getKnex()` from `@universo/database`
  - Remove the `import { KnexClient } from '@universo/metahubs-backend'` dependency

- [ ] **0A.4** Preserve `@universo/schema-ddl` as a DI-only package
  - Verify `schema-ddl` does NOT import `@universo/database`, `@universo/metahubs-backend`, or any singleton runtime wrapper
  - Keep `createDDLServices(knex)` as the canonical entrypoint; only runtime wrappers (`metahubs-backend/domains/ddl`, core-backend bootstrap) should bind the singleton
  - Update any stale comments/docs that imply `schema-ddl` depends on the metahubs-local Knex singleton

#### 0B. Pool Budget Simplification

- [ ] **0B.1** Remove dual-pool budget split logic from the new KnexClient
  - `poolMax` = `DATABASE_POOL_MAX` env or 15 (Supabase Nano default)
  - Remove `DATABASE_CONNECTION_BUDGET`, `DATABASE_KNEX_POOL_MAX` env handling — only `DATABASE_POOL_MAX` needed
  - Remove the `connectionBudget / 3` calculation and TypeORM headroom comments

- [ ] **0B.2** Update `techContext.md` pool formula documentation to reflect single-pool architecture

#### 0C. legacyChecksumAliases Cleanup

- [ ] **0C.1** Remove `legacyChecksumAliases` field from `PlatformMigrationFile` type in `migrations-core/types.ts`
- [ ] **0C.2** Simplify `shouldSkipAppliedMigration` in `migrations-core/runner.ts` — remove alias-matching logic
- [ ] **0C.3** Remove `withLegacyChecksumAliases()` wrapper from `migrations-core`
- [ ] **0C.4** Clean up `platformMigrations.ts` — remove all `legacyChecksumAliases` wrappers from migration registrations

### Tests
- [ ] **0.T1** Unit test for new `@universo/database` KnexClient: initialization, singleton behavior, destroy cleanup
- [ ] **0.T2** Update runner tests for simplified checksum logic (no alias matching)
- [ ] **0.T3** Verify `pnpm --filter @universo/database build` + `pnpm --filter @universo/core-backend build` + `pnpm --filter @universo/metahubs-backend build`

### Risk
- Low — KnexClient singleton pattern is battle-tested; legacyChecksumAliases are irrelevant on fresh DB
- **Circular dependency solved**: `@universo/database` is a leaf package — nothing depends on IT except consumers

---

## Phase 1: RLS Middleware — Replace TypeORM QueryRunner with Knex Connection Pinning

### Overview
`ensureAuthWithRls` is THE critical coupling point. It uses `DataSource.createQueryRunner()` to get a dedicated PG connection for RLS `set_config`. The Knex equivalent (`knex.client.acquireConnection()` + `knex.raw().connection()`) is already proven in `runner.ts` (migrations-core) and `locking.ts` (schema-ddl).

### Architecture Decision: Two Executor Types

**RLS-aware routes** (metahubs, applications, profile): Must use a **pinned-connection executor** (`createRlsExecutor`) — all queries AND transactions run on the SAME connection where `set_config('request.jwt.claims', ...)` was applied. Transactions use explicit `BEGIN/COMMIT/ROLLBACK` on the pinned connection, NOT `knex.transaction()` (which acquires a NEW connection from the pool without RLS claims).

**Non-RLS routes** (admin, public locales, bootstrap): Can use a **pool executor** (`createKnexExecutor`) — transactions use `knex.transaction()` which is fine because admin tables don't have RLS policies and rely on application-level access control via `ensureGlobalAccess`.

**Neutral-contract rule**: Do NOT introduce a new public request-scoped DB abstraction if the neutral `DbSession` / `DbExecutor` / `RequestDbContext` contract already covers the need. Any connection-handle shape used by auth middleware stays internal to that module.

### Steps

- [ ] **1.1** Implement executor factories in `packages/universo-database/base/src/knexExecutor.ts`

```typescript
// packages/universo-database/base/src/knexExecutor.ts
import type { Knex } from 'knex'
import type { DbExecutor, DbSession } from '@universo/utils'

/**
 * Pool-level executor — acquires connections from pool per-query.
 * Transactions use knex.transaction() (new connection from pool).
 * USE FOR: non-RLS routes (admin, bootstrap, public endpoints).
 */
export function createKnexExecutor(knex: Knex): DbExecutor {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const result = await knex.raw(sql, params as any)
      return result.rows ?? result
    },
    transaction: async (work) => {
      return knex.transaction(async (trx) => {
        const txExecutor: DbExecutor = {
          query: async (sql: string, params?: unknown[]) => {
            const result = await trx.raw(sql, params as any)
            return result.rows ?? result
          },
          transaction: async (innerWork) => innerWork(txExecutor), // nested = same trx
          isReleased: () => false
        }
        return work(txExecutor)
      })
    },
    isReleased: () => false
  }
}

/**
 * RLS pinned-connection executor — all queries AND transactions stay on the
 * SAME pg connection where set_config('request.jwt.claims', ...) was called.
 * Top-level transactions use BEGIN/COMMIT/ROLLBACK; nested transactions use
 * SAVEPOINT/RELEASE SAVEPOINT on the same pinned connection.
 * NEVER call knex.transaction() here — it would acquire a new pool connection without RLS claims.
 * USE FOR: RLS-protected routes (metahubs, applications, profile).
 *
 * PROVEN PATTERN: knex.raw(sql, params).connection(connection) — same approach
 * as locking.ts advisory locks and runner.ts session-lock queries.
 */
export function createRlsExecutor(knex: Knex, connection: unknown): DbExecutor {
  let txDepth = 0

  const executor: DbExecutor = {
    query: async (sql: string, params?: unknown[]) => {
      const result = await knex.raw(sql, params as any).connection(connection)
      return result.rows ?? result
    },
    transaction: async (work) => {
      const nextDepth = txDepth + 1
      const savepointName = `rls_sp_${nextDepth}`

      if (txDepth === 0) {
        await knex.raw('BEGIN').connection(connection)
      } else {
        await knex.raw(`SAVEPOINT ${savepointName}`).connection(connection)
      }

      txDepth = nextDepth
      try {
        const result = await work(executor)
        if (nextDepth === 1) {
          await knex.raw('COMMIT').connection(connection)
        } else {
          await knex.raw(`RELEASE SAVEPOINT ${savepointName}`).connection(connection)
        }
        return result
      } catch (err) {
        try {
          if (nextDepth === 1) {
            await knex.raw('ROLLBACK').connection(connection)
          } else {
            await knex.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`).connection(connection)
          }
        } catch {
          /* best-effort */
        }
        throw err
      } finally {
        txDepth -= 1
      }
    },
    isReleased: () => false
  }

  return executor
}
```

- [ ] **1.2** Create `packages/auth-backend/base/src/middlewares/knexRlsSession.ts` — Knex-based RLS session manager

```typescript
// packages/auth-backend/base/src/middlewares/knexRlsSession.ts
import type { Knex } from 'knex'
import { createDbSession, type DbSession } from '@universo/utils'

interface RlsConnectionHandle {
  connection: unknown  // raw pg connection from pool
  session: DbSession
  release(): Promise<void>
}

export async function acquireRlsSession(knex: Knex): Promise<RlsConnectionHandle> {
  const connection = await knex.client.acquireConnection()
  let released = false
  const session = createDbSession({
    query: async <T = unknown>(sql: string, params?: unknown[]) => {
      if (released) throw new Error('RLS session already released')
      const result = await knex.raw(sql, params as any).connection(connection)
      return (result.rows ?? result) as T[]
    },
    isReleased: () => released
  })

  return {
    connection,
    session,
    async release() {
      if (released) return
      released = true
      try {
        // CRITICAL: Use set_config(..., false) = SESSION-level reset.
        // set_config(..., true) is transaction-local and is a NO-OP outside
        // explicit transactions — JWT claims would LEAK to next request.
        // Reference: rlsContext.ts line 50 and ensureAuthWithRls.ts cleanup.
        await knex.raw("SELECT set_config('request.jwt.claims', '', false)").connection(connection)
      } catch { /* best-effort cleanup */ }
      knex.client.releaseConnection(connection)
    }
  }
}
```

- [ ] **1.3** Rewrite `ensureAuthWithRls.ts` to use `acquireRlsSession(getKnex())` instead of `DataSource.createQueryRunner()`
  - Replace `import type { DataSource } from 'typeorm'` → import `getKnex` from `@universo/database`
  - Replace `ds.createQueryRunner()` → `await acquireRlsSession(getKnex())`
  - Replace `runner.query(sql, params)` → `rlsHandle.session.query(sql, params)`
  - Replace `runner.release()` → `session.release()`
  - Replace `runner.isReleased` → `rlsHandle.session.isReleased()`
  - Remove `createLegacyRequestDbContext(runner.manager, session)` — no more `runner.manager`
  - Remove `req.dbLegacyManager = runner.manager`
  - **Create `DbExecutor` via `createRlsExecutor(getKnex(), rlsHandle.connection)`** — this executor stays on the pinned connection for ALL queries and transactions within the request
  - Attach the RLS executor to `req.dbContext` via `createRequestDbContext(dbSession, rlsExecutor)`

  **CRITICAL**: The `DbSession` and `DbExecutor` created from this Knex session must provide the same request-scoped isolation guarantees. Reuse `createDbSession()` and `createRequestDbContext()` from `@universo/utils`; do NOT add a second public request-scoped contract just for the Knex transport.

- [ ] **1.4** Update `createEnsureAuthWithRls()` factory signature
  - Change from `{ getDataSource: () => DataSource }` to `{ getKnex: () => Knex }`
  - Update `core-backend/base/src/routes/index.ts` call site accordingly

- [ ] **1.5** Replace `createDataSourceExecutor(getDataSource())` calls in `core-backend/routes/index.ts`:
  - For metahubs/applications routes (RLS-aware, already use `() => DbExecutor`): pass `() => getRequestDbExecutor(req)` — the RLS executor is already on `req.dbContext` from the middleware
  - For admin routes (non-RLS): pass `() => createKnexExecutor(getKnex())` — pool-level, fine for admin schema
  - For public/auth routes: pass `getKnex` directly where only raw queries are needed

### Tests
- [ ] **1.T1** Unit test for `acquireRlsSession`: acquire, query, release, double-release safety, **verify `set_config(..., false)` in release**
- [ ] **1.T2** Unit test for `createRlsExecutor`: query on pinned connection, **top-level transaction uses BEGIN/COMMIT/ROLLBACK on same connection, nested transaction uses SAVEPOINT/RELEASE SAVEPOINT** (NOT knex.transaction)
- [ ] **1.T3** Unit test for `createKnexExecutor`: query passthrough, transaction via knex.transaction, nested transaction
- [ ] **1.T4** Integration test: `ensureAuthWithRls` with mock Knex → verify RLS claims are set and cleaned up
- [ ] **1.T5** Verify `pnpm --filter @universo/auth-backend build` passes

### Risk
- **High** — this is the core authentication/authorization middleware
- Mitigation: the Knex `acquireConnection()` + `knex.raw().connection()` pattern is proven in the codebase (runner.ts session advisory locks, locking.ts)
- The `set_config('request.jwt.claims', ...)` SQL is identical regardless of transport
- **QA FIX-1**: `set_config(..., false)` for session-level reset (was `true` in original plan — no-op outside tx)
- **QA FIX-2**: Pinned-connection transactions via `BEGIN/COMMIT/ROLLBACK`, with nested SAVEPOINT support (was `knex.transaction()` in original plan — would lose RLS context)
- **QA FIX-8**: Use `knex.raw(sql, params).connection(connection)` instead of `connection.query(sql, params)` — consistent with proven codebase patterns

---

## Phase 2: Admin Backend — SQL-First Persistence Stores

### Overview
Admin-backend has 6 TypeORM entities and 4 route files + 1 service that deeply use Repository/QueryBuilder API. Pattern: create SQL-first persistence stores (following the proven `applicationsStore`/`connectorsStore` pattern from applications-backend).

**RLS Note (QA FINDING-4)**: Admin schema tables (`admin.roles`, `admin.locales`, `admin.settings`, `admin.instances`) do NOT have RLS policies. Access is controlled at the application level by `ensureGlobalAccess` middleware. Therefore:
- `localesRoutes.ts` currently uses `ds.transaction()` (global DataSource, not request-scoped) — this is CORRECT for admin, not a bug.
- `adminSettingsRoutes.ts` uses `manager.transaction()` (request-scoped) — also correct, but the request scope is not needed for RLS.
- After migration: admin routes should use `createKnexExecutor(getKnex())` (pool-level). NO need for `createRlsExecutor`.

### Steps

#### 2A. Admin Persistence Stores

- [ ] **2A.1** Create `packages/admin-backend/base/src/persistence/rolesStore.ts`
  - SQL-first helpers for admin.roles CRUD: listRoles, getRoleById, getRoleByCodename, createRole, updateRole, deleteRole
  - SQL-first helpers for admin.role_permissions: listPermissions, setPermissions, deletePermissions
  - SQL-first helpers for admin.user_roles: listUserRoles, countUserRoles, assignRole, revokeRole
  - All queries use parameterized SQL via `DbExecutor.query(sql, params)`
  - Pagination pattern: `SELECT COUNT(*) OVER() AS total_count, * FROM admin.roles WHERE ... ORDER BY ... LIMIT $1 OFFSET $2`
  - JOIN pattern for roles + permissions: `LEFT JOIN admin.role_permissions rp ON rp.role_id = r.id`

```typescript
// Example: packages/admin-backend/base/src/persistence/rolesStore.ts
import type { DbExecutor } from '@universo/utils/database'

export async function listRoles(exec: DbExecutor, options: {
  search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string
}) {
  const { search, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options
  const offset = (page - 1) * limit
  const conditions: string[] = []
  const params: unknown[] = []
  
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(r.codename ILIKE $${params.length} OR r.name::text ILIKE $${params.length})`)
  }
  
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  // Whitelist sortBy to prevent injection
  const safeSortBy = ['codename', 'created_at', 'updated_at'].includes(sortBy) ? sortBy : 'created_at'
  const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC'
  
  const sql = `
    SELECT r.*, COUNT(*) OVER() AS total_count
    FROM admin.roles r
    ${where}
    ORDER BY r.${safeSortBy} ${safeSortOrder}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  params.push(limit, offset)
  return exec.query(sql, params)
}
```

- [ ] **2A.2** Create `packages/admin-backend/base/src/persistence/localesStore.ts`
  - SQL-first helpers for admin.locales CRUD
  - Include `transformLocale()` (existing camelCase transformation)
  - Transactional batch updates (e.g., set-default-locale atomically)

- [ ] **2A.3** Create `packages/admin-backend/base/src/persistence/instancesStore.ts`
  - SQL-first helpers for admin.instances CRUD (read-only + update)
  - Stats query (count users, roles)

- [ ] **2A.4** Create `packages/admin-backend/base/src/persistence/settingsStore.ts`
  - SQL-first helpers for admin.settings upsert
  - Category/key lookup with JSONB
  - Transactional batch upsert

- [ ] **2A.5** Create `packages/admin-backend/base/src/persistence/index.ts` — barrel re-export

#### 2B. Port Admin Routes to SQL-First

- [ ] **2B.1** Rewrite `rolesRoutes.ts` to use `rolesStore.*` + `DbExecutor` instead of `getRequestManager().getRepository()`
  - Each handler: `const exec = getRequestDbExecutor(req)` → call store functions
  - Remove `import { DataSource, In } from 'typeorm'`
  - Remove `getRequestManager` import and usage

- [ ] **2B.2** Rewrite `localesRoutes.ts` the same way
  - Transactions: `exec.transaction(async (txExec) => { ... })` replaces `ds.transaction()` (global DataSource)
  - NOTE: Uses `createKnexExecutor` (pool-level), not `createRlsExecutor` — admin tables have NO RLS policies

- [ ] **2B.3** Rewrite `instancesRoutes.ts` the same way

- [ ] **2B.4** Rewrite `adminSettingsRoutes.ts` the same way
  - Upsert pattern: `INSERT INTO admin.settings ... ON CONFLICT (category, key) DO UPDATE SET value = $3`

- [ ] **2B.5** Rewrite `publicLocalesRoutes.ts` — note this uses `ds.getRepository(Locale)` WITHOUT RLS (direct DataSource)
  - Replace with `createKnexExecutor(getKnex()).query(sql, params)` — no RLS needed for public locale endpoints

#### 2C. Port Admin Services to SQL-First

- [ ] **2C.1** Rewrite `globalAccessService.ts`
  - Already ~60% raw SQL through `ds.query()`
  - Replace remaining `ds.getRepository(Role)` calls with `rolesStore.*`
  - Replace `ds.manager.find(AuthUser, ...)` with SQL: `SELECT id, email FROM auth.users WHERE id = ANY($1)`
  - Replace `ds.manager.find(Profile, ...)` with SQL: `SELECT user_id, nickname FROM public.profiles WHERE user_id = ANY($1)`
  - Change input from `DataSource` to `DbExecutor` (from Knex)
  - The `runQuery()` helper already routes through `dbSession` — simplify to always use `exec.query()`

- [ ] **2C.2** Update `ensureGlobalAccess.ts` guard — **already TypeORM-free** (uses DbSession) — verify no changes needed

- [ ] **2C.3** Update `globalUsersRoutes.ts` — **already TypeORM-free** — verify no changes needed

#### 2D. Admin Cleanup

- [ ] **2D.1** Delete all TypeORM entity files: `packages/admin-backend/base/src/database/entities/*.ts`
- [ ] **2D.2** Delete `packages/admin-backend/base/src/database/` directory entirely (entities + TypeORM migrations)
  - TypeORM migration files (`1733400000000-CreateAdminSchema.ts`, `1733500000000-AddCodenameAutoConvertMixedSetting.ts`) are superseded by native SQL definitions in `platform/migrations/`
- [ ] **2D.3** Remove `typeorm` from `packages/admin-backend/base/package.json` dependencies
- [ ] **2D.4** Remove legacy `getRequestManager` re-exports from `admin-backend/base/src/utils/`
- [ ] **2D.5** Update admin-backend route factory to accept `getKnex: () => Knex` (from `@universo/database`) instead of `getDataSource: () => DataSource`
  - Wire up `createKnexExecutor(getKnex())` for all admin route handlers

### Tests
- [ ] **2.T1** Create `packages/admin-backend/base/src/tests/persistence/rolesStore.test.ts` — test all role CRUD SQL helpers with mock DbExecutor
- [ ] **2.T2** Create `packages/admin-backend/base/src/tests/persistence/localesStore.test.ts`
- [ ] **2.T3** Create `packages/admin-backend/base/src/tests/persistence/instancesStore.test.ts`
- [ ] **2.T4** Create `packages/admin-backend/base/src/tests/persistence/settingsStore.test.ts`
- [ ] **2.T5** Create `packages/admin-backend/base/src/tests/routes/rolesRoutes.test.ts` — test route handlers with mock stores
- [ ] **2.T6** Create `packages/admin-backend/base/src/tests/routes/localesRoutes.test.ts`
- [ ] **2.T7** Create `packages/admin-backend/base/src/tests/routes/instancesRoutes.test.ts`
- [ ] **2.T8** Create `packages/admin-backend/base/src/tests/routes/adminSettingsRoutes.test.ts`
- [ ] **2.T9** Create `packages/admin-backend/base/src/tests/services/globalAccessService.test.ts`
- [ ] **2.T10** Verify `pnpm --filter @universo/admin-backend build` + `pnpm --filter @universo/admin-backend test`

### Risk
- Medium — admin routes are relatively straightforward CRUD; the proven store pattern from applications-backend is directly applicable
- `publicLocalesRoutes` uses DataSource without RLS — needs careful handling to avoid RLS context leak

---

## Phase 3: Profile Backend — SQL-First Persistence Store

### Overview
Profile-backend has 1 TypeORM entity (`Profile`) and 1 service (`ProfileService`) that is a classic Repository-based CRUD service.

### Steps

- [ ] **3.1** Create `packages/profile-backend/base/src/persistence/profileStore.ts`

```typescript
// SQL-first profile CRUD
import type { DbExecutor } from '@universo/utils/database'

export async function findProfileByUserId(exec: DbExecutor, userId: string) {
  const rows = await exec.query(
    'SELECT * FROM public.profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  return rows[0] ?? null
}

export async function createProfile(exec: DbExecutor, data: {
  user_id: string; nickname: string; first_name?: string; last_name?: string; settings?: object
}) {
  const rows = await exec.query(
    `INSERT INTO public.profiles (id, user_id, nickname, first_name, last_name, settings)
     VALUES (public.uuid_generate_v7(), $1, $2, $3, $4, $5)
     RETURNING *`,
    [data.user_id, data.nickname, data.first_name ?? null, data.last_name ?? null, JSON.stringify(data.settings ?? {})]
  )
  return rows[0]
}

export async function updateProfile(exec: DbExecutor, userId: string, data: Partial<{
  nickname: string; first_name: string; last_name: string; settings: object;
  onboarding_completed: boolean; terms_accepted: boolean; privacy_accepted: boolean;
  terms_version: string; privacy_version: string
}>) {
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 1
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sets.push(`${key} = $${idx++}`)
      params.push(key === 'settings' ? JSON.stringify(value) : value)
    }
  }
  if (sets.length === 0) return null
  params.push(userId)
  const rows = await exec.query(
    `UPDATE public.profiles SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = $${idx} RETURNING *`,
    params
  )
  return rows[0] ?? null
}

export async function isNicknameAvailable(exec: DbExecutor, nickname: string, excludeUserId?: string) {
  const params: unknown[] = [nickname]
  let sql = 'SELECT 1 FROM public.profiles WHERE nickname = $1'
  if (excludeUserId) {
    sql += ' AND user_id != $2'
    params.push(excludeUserId)
  }
  sql += ' LIMIT 1'
  const rows = await exec.query(sql, params)
  return rows.length === 0
}

// ... findAllProfiles, deleteProfile, countProfiles
```

- [ ] **3.2** Rewrite `ProfileService` to use `profileStore.*` + `DbExecutor` instead of `Repository<Profile>`
  - Constructor: `constructor(private exec: DbExecutor)` instead of `Repository<Profile>`
  - Replace all repository calls with store functions
  - Preserve deep-merge settings logic
  - Preserve auto-nickname generation logic

- [ ] **3.3** Rewrite `profileRoutes.ts` route factory
  - Profile routes are behind `ensureAuthWithRls` — use `getRequestDbExecutor(req)` to get the RLS pinned-connection executor
  - Instantiate `ProfileService(rlsExecutor)` instead of `ProfileService(repo)`
  - Do NOT use `createKnexExecutor(getKnex())` here — profile tables have RLS policies

- [ ] **3.4** Delete TypeORM entity: `packages/profile-backend/base/src/database/entities/Profile.ts`
- [ ] **3.5** Delete TypeORM migration files: `packages/profile-backend/base/src/database/migrations/postgres/*.ts`
  - Superseded by native SQL definitions in `platform/migrations/`
- [ ] **3.6** Delete `packages/profile-backend/base/src/database/` directory
- [ ] **3.7** Delete `packages/profile-backend/base/src/tests/utils/typeormMocks.ts`
- [ ] **3.8** Remove `typeorm` from `packages/profile-backend/base/package.json`
- [ ] **3.9** Export profile store from package public API for cross-package consumers (start-backend uses Profile)

### Tests
- [ ] **3.T1** Create `packages/profile-backend/base/src/tests/persistence/profileStore.test.ts`
- [ ] **3.T2** Rewrite `packages/profile-backend/base/src/tests/services/profileService.test.ts` — use mock DbExecutor instead of mock Repository
- [ ] **3.T3** Rewrite `packages/profile-backend/base/src/tests/routes/profileRoutes.test.ts` — use mock stores
- [ ] **3.T4** Verify `pnpm --filter @universo/profile-backend build` + `pnpm --filter @universo/profile-backend test`

### Risk
- Low — straightforward Repository → SQL replacement
- `start-backend` cross-imports `Profile` entity from profile-backend — will be updated in Phase 4

---

## Phase 4: Start Backend + Auth Backend Cleanup

### Overview
- `start-backend` uses `getRequestManager(req, ds)` to access Profile entity for onboarding routes (2 operations)
- `auth-backend` has the `AuthUser` TypeORM entity (read-only), auth routes using `DataSource.query()`, and permission service
- After Phase 1, ensureAuthWithRls no longer uses TypeORM — but auth routes still pass around DataSource type

### Steps

#### 4A. Start Backend

- [ ] **4A.1** Rewrite `start-backend/routes/onboardingRoutes.ts`
  - Replace `getRequestManager(req, ds).findOne(Profile, ...)` → SQL via `getRequestDbExecutor(req).query('SELECT onboarding_completed FROM public.profiles WHERE user_id = $1', [userId])`
  - Replace `manager.update(Profile, ...)` → SQL via `exec.query('UPDATE public.profiles SET onboarding_completed = true WHERE user_id = $1', [userId])`
  - Remove `import { Profile } from '@universo/profile-backend'`
  - Remove `import { getRequestManager } from '@universo/utils/database/legacy'`

- [ ] **4A.2** Update `start-backend/routes/index.ts` route factory
  - Start-backend onboarding is behind `ensureAuthWithRls` — use `getRequestDbExecutor(req)` for RLS executor
  - Remove `import type { DataSource } from 'typeorm'`

- [ ] **4A.3** Remove `typeorm` from `packages/start-backend/base/package.json`

#### 4B. Auth Backend

- [ ] **4B.1** Rewrite `auth.ts` routes to use `getKnex()` from `@universo/database` raw queries instead of `DataSource.query()`
  - `dataSource.query(sql, params)` → `getKnex().raw(sql, params).then(r => r.rows)`
  - This is mostly a transport swap — the SQL is already raw

- [ ] **4B.2** Rewrite `permissionService.ts`
  - Replace `getDataSource().query(sql, params)` → `getKnex().raw(sql, params)` (from `@universo/database`)
  - Change interface from `DataSource` to `Knex`

- [ ] **4B.3** Update `abilityMiddleware.ts` type imports — remove `DataSource` type

- [ ] **4B.4** Update `guards/createAccessGuards.ts` and `guards/types.ts` — remove `DataSource` type references

- [ ] **4B.5** Delete `AuthUser` TypeORM entity: `packages/auth-backend/base/src/database/entities/AuthUser.ts`
  - AuthUser is read-only (maps to Supabase `auth.users`)
  - It was used only by admin routes for email lookup — those will use direct SQL after Phase 2
  - Create a lightweight TypeScript interface `AuthUserRow` in `@universo/types` instead

- [ ] **4B.6** Remove `typeorm` from `packages/auth-backend/base/package.json`

### Tests
- [ ] **4.T1** Create `packages/start-backend/base/src/tests/routes/onboardingRoutes.test.ts` — test the 2 SQL operations
- [ ] **4.T2** Create `packages/auth-backend/base/src/tests/middlewares/ensureAuthWithRls.test.ts` — test Knex RLS session lifecycle
- [ ] **4.T3** Create `packages/auth-backend/base/src/tests/services/permissionService.test.ts` — test permission SQL queries
- [ ] **4.T4** Verify `pnpm --filter @universo/auth-backend build` + `pnpm --filter @universo/start-backend build`

### Risk
- Medium for auth — this is security-critical code
- Low for start — only 2 trivial SQL operations
- `AuthUser` entity removal must not break admin routes that already use SQL in Phase 2

---

## Phase 5: Core Backend — Remove TypeORM DataSource

### Overview
After Phases 1-4, no package uses TypeORM DataSource/EntityManager/Repository anymore. Now we remove the TypeORM DataSource singleton, entity registry, and rlsHelpers from core-backend.

### Steps

- [ ] **5.1** Delete `packages/universo-core-backend/base/src/DataSource.ts`
- [ ] **5.2** Delete `packages/universo-core-backend/base/src/database/entities/index.ts` (entity registry)
- [ ] **5.3** Delete `packages/universo-core-backend/base/src/utils/typeormDataSource.ts`
- [ ] **5.4** Delete `packages/universo-core-backend/base/src/utils/rlsHelpers.ts`
- [ ] **5.5** Rewrite `packages/universo-core-backend/base/src/index.ts` (App class)
  - Remove `import { DataSource } from 'typeorm'`
  - Remove `AppDataSource: DataSource` field
  - `initDatabase()`: use `initKnex()` from `@universo/database` → `runRegisteredPlatformMigrations(getKnex(), logger)`
  - Rewire startup template seeding: `seedMetahubTemplates(createKnexExecutor(getKnex()))` instead of `createDataSourceExecutor(this.AppDataSource)`
  - `stopApp()`: use `destroyKnex()` from `@universo/database` instead of `AppDataSource.destroy()`
  - Remove entity count diagnostics (TypeORM-specific)

- [ ] **5.6** Rewrite `packages/universo-core-backend/base/src/routes/index.ts`
  - Replace all `getDataSource` references with `getKnex` from `@universo/database`
  - Pass `getKnex` to auth middleware (`createEnsureAuthWithRls({ getKnex })`)
  - Pass `() => createKnexExecutor(getKnex())` to admin routes (non-RLS)
  - Pass `() => getRequestDbExecutor(req)` to metahubs/applications routes (RLS via pinned-connection executor on req.dbContext)
  - Remove `import { getDataSource } from '../DataSource'`

- [ ] **5.7** Remove `typeorm` from `packages/universo-core-backend/base/package.json`

- [ ] **5.8** Update `packages/universo-core-backend/base/test/setup.ts` — remove TypeORM mocks
- [ ] **5.9** Rewrite `packages/universo-core-backend/base/test/routes/botsRoutes.test.ts` — remove DataSource mock
- [ ] **5.10** Rewrite `packages/universo-core-backend/base/test/services/workspaceAccessService.test.ts` — remove DataSource/Repository mocks

### Tests
- [ ] **5.T1** Rewrite `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts` — mock `getKnex` from `@universo/database` instead of DataSource
- [ ] **5.T2** Verify `pnpm --filter @universo/core-backend build` + `pnpm --filter @universo/core-backend test`

### Risk
- Medium — this is the central app bootstrap file
- All consumers MUST be migrated first (Phases 1-4)

---

## Phase 6: Utils Legacy Cleanup + Interface Unification

### Overview
Remove the deprecated legacy TypeORM compatibility layer from `@universo/utils/database`. Additionally, unify the three duplicate SQL executor interfaces (QA FINDING-6):
- `DbExecutor` (`@universo/utils/database/manager.ts`): `query() + transaction() + isReleased()` — full contract
- `SqlExecutor` (`applications-backend/persistence/applicationsStore.ts`, `connectorsStore.ts`): `query()` only — defined locally
- `SqlQueryable` (`metahubs-backend/persistence/types.ts`): `query()` only — defined locally

After TypeORM removal, consolidate into two canonical interfaces in `@universo/utils`:
- `DbExecutor` — full contract (query + transaction + isReleased) — for routes/services
- `SqlQueryable` — read-only contract (query only) — for persistence stores

### Steps

- [ ] **6.1** Delete `packages/universo-utils/base/src/database/legacyManager.ts`
- [ ] **6.2** Delete `packages/universo-utils/base/src/database/legacy.ts` (the barrel re-export)
- [ ] **6.3** Clean up `packages/universo-utils/base/src/database/manager.ts`
  - Remove `import type { DataSource, EntityManager } from 'typeorm'`
  - Remove `dbLegacyManager?: EntityManager` from `RequestWithDbContext`
  - Remove `createDataSourceExecutor()` (replaced by `createKnexExecutor` in `@universo/database`)
  - Remove `createManagerExecutor` import from legacyManager
  - Export `SqlQueryable` interface: `{ query<T>(sql: string, parameters?: unknown[]): Promise<T[]> }` — canonical read-only SQL contract
  - Note: persistence stores across packages can then import `SqlQueryable` from one place
- [ ] **6.4** Update `packages/universo-utils/base/src/database/userLookup.ts`
  - Replace `DataSource.query()` → `getKnex().raw()` or accept `DbExecutor` parameter
  - Change import from `DataSource` to accept `DbExecutor`
- [ ] **6.5** Clean up test mocks in `packages/universo-utils/base/src/database/__tests__/manager.test.ts`
  - Remove all TypeORM-related test cases (getRequestManager, dbLegacyManager, etc.)
  - Keep only neutral DbSession/DbExecutor tests
- [ ] **6.6** Delete `tools/testing/backend/typeormMocks.ts` — shared TypeORM test mock utility

#### 6G. Interface Unification (QA FINDING-6)

- [ ] **6G.1** Replace local `SqlExecutor` in `applications-backend/persistence/applicationsStore.ts` and `connectorsStore.ts` with import from `@universo/utils`
  - Change `import type { SqlExecutor }` (locally defined) → `import type { SqlQueryable } from '@universo/utils'`
  - Rename parameter types from `SqlExecutor` to `SqlQueryable` in all store functions
  - This is a type-only change — no runtime impact
- [ ] **6G.2** Verify `metahubs-backend/persistence/types.ts` `SqlQueryable` matches the canonical definition in `@universo/utils`
  - If identical: replace local definition with re-export: `export type { SqlQueryable } from '@universo/utils'`
  - If different: reconcile (the `@universo/utils` definition is canonical)
- [ ] **6G.3** Update persistence barrel re-exports to export `SqlQueryable` from `@universo/utils`

### Tests
- [ ] **6.T1** Verify `pnpm --filter @universo/utils build` + `pnpm --filter @universo/utils test`
- [ ] **6.T2** Verify no remaining `@universo/utils/database/legacy` imports anywhere
- [ ] **6.T3** Verify `pnpm --filter @universo/metahubs-backend build` + `pnpm --filter @universo/applications-backend build` (interface unification)

### Risk
- Low — this is cleanup after all consumers are migrated
- Interface unification is type-only, no runtime behavior change

---

## Phase 7: Global TypeORM Removal

### Overview
Remove TypeORM from the workspace entirely.

### Steps

- [ ] **7.1** Remove `typeorm: ^0.3.28` from `pnpm-workspace.yaml` catalog
- [ ] **7.2** Remove `pnpm typeorm migration:create` script from root `package.json`
- [ ] **7.3** Run `pnpm install` to remove `typeorm` from `node_modules`
- [ ] **7.4** Verify: `grep -r "from 'typeorm'" packages/ --include='*.ts'` returns **zero** results
- [ ] **7.5** Verify: `grep -r "typeorm" packages/*/base/package.json` returns **zero** results

### Tests
- [ ] **7.T1** Full workspace build: `pnpm build` — all 26/26 must pass
- [ ] **7.T2** Full workspace test: run all existing test suites
- [ ] **7.T3** Lint: `pnpm lint` — or at minimum lint changed packages

---

## Phase 8: Startup Validation and Smoke Test

### Overview
Verify the complete bootstrap on a fresh database — all platform schemas created, full Metahub → Application workflow operational.

### Steps

- [ ] **8.1** Clear the test database (recreate from scratch in Supabase)
- [ ] **8.2** `pnpm build` — ensure clean build
- [ ] **8.3** `pnpm start` — verify startup succeeds
  - Expected: unified platform runner creates schemas `admin`, `profile`, `metahubs`, `applications` via `upl_migrations`
  - `public.uuid_generate_v7()` function created
  - All RLS policies applied
  - All seed data inserted (superuser role, default locales, metahubs settings)
- [ ] **8.4** Verify: log in at `http://localhost:3000`, onboarding completes
- [ ] **8.5** Navigate to `/metahubs`, create a new Metahub
  - Verify: `mhb_<uuid>_b1` schema created in DB
- [ ] **8.6** Create catalogs, hubs, attributes in the metahub — verify DDL operations work
- [ ] **8.7** Create a Publication/Version
- [ ] **8.8** Create an Application + Connector → connect to the metahub's publication
- [ ] **8.9** Trigger schema creation for the Application
  - Verify: `app_<uuid>` schema created with all tables from the publication snapshot
- [ ] **8.10** Verify application data access and CRUD operations work

### Risk
- This is the integration checkpoint — any regression from Phases 0-7 will show here
- Fresh database ensures no stale `upl_migrations` entries

---

## Phase 9: Migration System Improvements + Full ТЗ Convergence (Post-TypeORM)

### Overview
After TypeORM is fully removed, finish the migration system itself and close the remaining architectural parts of the ТЗ: (a) promote dry-run to a first-class runner capability, (b) connect DB ↔ file workflow to the EXISTING `upl_migrations` definition lifecycle tables instead of inventing a parallel registry, (c) explicitly converge metahub/application runtime definition lifecycle toward one shared Universo engine while preserving current metahubs schema parity and UI behavior. The legacyChecksumAliases cleanup and pool simplification were moved to Phase 0 (fresh DB, no reason to defer).

### Steps

#### 9A. Dry-Run Mode and Migration CLI

- [ ] **9A.1** Add `dryRun` as a FIRST-CLASS capability in `@universo/migrations-core`
  - Extend `RunPlatformMigrationsOptions` / `RunPlatformMigrationsResult` to support dry-run metadata (`planned`, `blocked`, `reviewRequired`) instead of hiding it behind a thin wrapper script
  - `runPlatformMigrations({ dryRun: true })` must validate, acquire the same catalog context, and return the ordered execution plan without mutating DB state
  - Keep `runRegisteredPlatformMigrations(...)` as the single entrypoint, but extend its signature/options rather than adding a second near-duplicate runner

- [ ] **9A.2** Add migration runner CLI helper for development
  - `pnpm migration:status` — show applied vs pending platform migrations
  - `pnpm migration:plan` — dry-run output (human-readable diff)
  - `pnpm migration:diff` — compare code definitions vs DB catalog vs exported files
  - Implementation: thin scripts in `tools/` that call the FIRST-CLASS `runRegisteredPlatformMigrations(..., { dryRun: true })` and catalog APIs; no duplicate planning logic in CLI layer

#### 9B. Canonical Definition Lifecycle + DB ↔ File Workflow (ТЗ Points 3-4-6)

- [ ] **9B.1** Treat existing `upl_migrations` definition tables as the canonical lifecycle storage
  - Reuse `definition_registry`, `definition_revisions`, `definition_exports`, `approval_events`, and `definition_drafts`
  - Reuse `DefinitionRegistryStore.registerDefinition()` / `recordDefinitionExport()` and related catalog helpers as the only source of truth for persisted definition metadata
  - Do NOT introduce a second registry/table family for editor readiness or file export tracking

- [ ] **9B.2** Assess current migration/definition structure for artifact-based editability
  - Map which current definitions can be represented as cataloged artifacts immediately: platform SQL definitions, metahub structure snapshots, application schema snapshots, template manifests
  - Document which flows still remain procedural and what adapter layer is needed to register them in the canonical catalog
  - Create a summary document: `memory-bank/plan/migration-round-trip-assessment.md`

- [ ] **9B.3** Create a `migration:export` CLI command (prototype)
  - `pnpm migration:export --scope platform` — dumps `upl_migrations` catalog to a structured directory of `.sql` / `.json` files
  - Each file = one exported artifact or migration unit, filename = `<ordinal>_<logical-key>.sql|json`, content = canonical artifact payload
  - Persist export metadata via `definition_exports` so DB state, file output, and checksums stay linked
  - Purpose: versioned-file representation of current DB state that can be committed to git without creating a second hidden state store

- [ ] **9B.4** Create a `migration:diff` CLI command (prototype)
  - Compares THREE views of truth: registered code definitions, active DB catalog revisions, and exported files
  - Reports: new definitions (in code but not in DB), orphaned DB revisions, file drift, checksum mismatches, unpublished drafts
  - Enables editor/CI workflow: detect drift between file-based definitions, DB state, and registered code artifacts

- [ ] **9B.5** Document the recommended lifecycle workflow for developers
  - How to add a new platform migration or shared definition artifact (file structure, registration, export metadata)
  - How drafts, approvals, and exports map to future editor flows
  - How to verify with `migration:plan` / `migration:diff` before applying
  - How to handle rollbacks (manual SQL, not automated — document the limitation)
  - Add to `docs/en/guides/` and `docs/ru/guides/`

#### 9C. Runtime Convergence: Metahub Structure → Shared Application Definition Kernel

- [ ] **9C.1** Explicitly converge metahub/application runtime definition lifecycle on shared Universo packages
  - Promote the shared kernel in `@universo/schema-ddl` + `@universo/migrations-*` as the canonical runtime engine
  - Reduce metahub-specific runtime migration code to thin adapters where business semantics differ, instead of keeping a parallel metahub-only migration architecture forever
  - Preserve current external behavior of `packages/metahubs-frontend` and `packages/universo-template-mui` — NO new UI surface required in this task

- [ ] **9C.2** Formalize the semantic mapping required by the ТЗ
  - Define: “metahub structure” = application schema definition for the built-in Metahubs application
  - Define: “metahub template” = application template/seed definition for that built-in Metahubs application
  - Document which current metahub-only services remain adapters and which shared runtime primitives they must call

- [ ] **9C.3** Preserve strict parity for the current metahubs schema contract
  - Static platform schema `metahubs.*` created by native SQL migrations must remain byte-for-byte compatible at the table/column/index/constraint level with the current implementation contract
  - Dynamic branch schemas `mhb_<uuid>_b<n>` must keep the existing naming and data-shape contract until the old metahubs packages are intentionally retired in a future task
  - Add explicit parity checklist for tables/columns/indexes/functions/triggers required by current `metahubs-frontend`

- [ ] **9C.4** Add architecture note for future Metahubs-as-Application bootstrap
  - The current task does NOT add new UI editors, but it must leave the backend lifecycle ready for a future flow where built-in metahub definitions can be loaded from files or DB drafts/exports on first startup
  - Reuse existing `definition_drafts` / `approval_events` storage for this future editor path instead of planning new tables later

#### 9D. KnexClient Deduplication Final Cleanup

- [ ] **9D.1** Verify `metahubs-backend` no longer has any local copy of `KnexClient.ts`
  - If a thin re-export still exists in `domains/ddl/index.ts`, verify it's just `export { getKnex } from '@universo/database'`
  - No orphan pool monitoring or connection config in metahubs-backend

- [ ] **9D.2** Verify pool monitoring works correctly with the single `@universo/database` instance

### Tests
- [ ] **9.T1** Add tests for dry-run mode
- [ ] **9.T2** Add tests for definition export/diff against the existing catalog lifecycle tables
- [ ] **9.T3** Add parity verification tests for metahubs static schema + dynamic branch bootstrap contract
- [ ] **9.T4** Final full build + full smoke rerun after Phase 9 convergence work

---

## Dependency Graph

```
Phase 0 (Knex Singleton + Pool + Checksum Cleanup)
  ↓
Phase 1 (RLS Middleware + Executor Factories) ← depends on Phase 0
  ↓
Phase 2 (Admin SQL-First) ← depends on Phase 1 (needs createKnexExecutor from @universo/database)
Phase 3 (Profile SQL-First) ← can run in parallel with Phase 2
  ↓
Phase 4 (Start + Auth cleanup) ← depends on Phases 2 & 3 (AuthUser entity, Profile entity removed)
  ↓
Phase 5 (Core Backend) ← depends on Phases 1-4 (all consumers migrated)
  ↓
Phase 6 (Utils cleanup + Interface Unification) ← depends on Phase 5
  ↓
Phase 7 (Global removal) ← depends on Phase 6
  ↓
Phase 8 (Smoke Test) ← depends on Phase 7
  ↓
Phase 9 (Definition Lifecycle + Runtime Convergence + Final ТЗ Completeness) ← depends on Phase 8
```

### Package Dependency (No Cycles)
```
@universo/utils          ← leaf (DbExecutor, DbSession, SqlQueryable interfaces)
  ↑
@universo/database       ← leaf (KnexClient singleton, createKnexExecutor, createRlsExecutor)
  ↑                        depends on: @universo/utils (interfaces), knex, pg
  |
@universo/auth-backend   ← acquireRlsSession uses @universo/database
@universo/admin-backend  ← persistence stores use DbExecutor from @universo/utils
@universo/metahubs-backend ← domains/ddl re-exports getKnex from @universo/database
@universo/applications-backend ← persistence stores use DbExecutor from @universo/utils
@universo/core-backend   ← route wiring, imports from ALL above (no reverse dependency)
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| New packages to create | 1 (`@universo/database` — Knex singleton + executor factories) |
| TypeORM entities to delete | 8 (AuthUser, Profile, AdminSetting, Role, RolePermission, UserRole, Instance, Locale) |
| TypeORM migration files to delete | 6 (2 admin + 4 profile) — already superseded by native SQL definitions |
| SQL-first persistence stores to create | 5 (rolesStore, localesStore, instancesStore, settingsStore, profileStore) |
| Route files to rewrite | 7 (4 admin + 1 profile + 1 start + 1 auth) |
| Service files to rewrite | 3 (globalAccessService, profileService, permissionService) |
| Middleware to rewrite | 1 (ensureAuthWithRls — CRITICAL) |
| Package.json to clean | 5 (core-backend, auth-backend, admin-backend, profile-backend, start-backend) |
| Test files to create | ~22 new test files (including executor + RLS session tests) |
| Test files to rewrite | ~5 existing test files |
| Packages with zero remaining TypeORM | ALL (27/27 after adding `@universo/database`) |
| Interfaces unified | 3 → 2 (SqlExecutor+SqlQueryable → SqlQueryable) |
| Migration CLI tools to add | 4 (migration:status, migration:plan, migration:export, migration:diff) |
| Existing catalog lifecycle primitives reused | 5 (`definition_registry`, `definition_revisions`, `definition_exports`, `approval_events`, `definition_drafts`) |
| New UI components to add in this task | 0 |

---

## Execution Notes

1. **No version increment** — schema/template versions stay at `0.1.0`
2. **Fresh test database** — all `upl_migrations` entries will be fresh; no backward compatibility needed
3. **All texts i18n-ready** — any new user-facing strings must have EN/RU keys in `@universo/i18n`
4. **UUID v7** — all new `INSERT` queries use `public.uuid_generate_v7()` for ID generation
5. **Parameterized SQL** — all queries MUST use parameterized placeholders. NO string interpolation for values.
6. **Parameter binding convention (QA FINDING-7)** — existing persistence stores use PostgreSQL-native `$1, $2` syntax (from TypeORM era). `knex.raw(sql, params)` with pg driver passes `$1`-style SQL through to PostgreSQL driver which handles it natively. Therefore: **keep `$1, $2` syntax in all persistence stores** — no mass-rewrite needed. For new Knex-level infrastructure code (executor factories, locking), use `?` placeholders (Knex convention, converted to `$1` automatically). **Never mix `?` and `$1` in the same query.** Validate in Phase 0.T1.
7. **Identifier safety** — table/column/schema names that come from user input must go through `quoteIdentifier()` from `@universo/migrations-core/identifiers`
8. **RLS preservation** — request-scoped `set_config('request.jwt.claims', ...)` behavior MUST be preserved through the Knex migration. **Use `createRlsExecutor` for RLS routes, `createKnexExecutor` for non-RLS routes.**
9. **Soft-delete parity** — all list/count queries must include `COALESCE(_upl_deleted, false) = false` where applicable (follows existing pattern)
10. **Two executor types (QA FINDING-2)** — `createRlsExecutor(knex, connection)` for pinned-connection RLS routes (top-level transactions via BEGIN/COMMIT on same connection, nested via SAVEPOINT); `createKnexExecutor(knex)` for pool-level non-RLS routes (transactions via knex.transaction). Never use `createKnexExecutor` in RLS-protected request handlers — it would lose JWT claims.
11. **set_config is_local parameter (QA FINDING-1)** — ALWAYS `false` (session-level). `true` is transaction-local and is a no-op outside explicit transactions. Confirmed correct in existing `rlsContext.ts` line 58 and `ensureAuthWithRls.ts` cleanup.
12. **No redundant public DB interfaces (QA FINDING-10)** — reuse `DbSession`, `DbExecutor`, and `RequestDbContext`. Any transport-specific connection handle stays internal to the middleware module.
13. **`schema-ddl` must stay DI-only (QA FINDING-11)** — do not couple `@universo/schema-ddl` to `@universo/database` or package-local singletons. Bind the singleton only in runtime wrappers.
14. **Canonical definition lifecycle (QA FINDING-12)** — reuse the existing `upl_migrations` definition tables and `DefinitionRegistryStore` flows for DB/file/export/draft metadata. Do NOT create a second registry.
15. **Metahub/application convergence (QA FINDING-13)** — treat the current metahub runtime model as a transitional adapter over the shared Universo migration kernel, while preserving exact schema and UI contract parity until old metahub packages are intentionally retired.

---

## QA Findings Traceability

| Finding | Severity | Resolution in Plan |
|---------|----------|--------------------|
| F-1: set_config `true` → `false` | CRITICAL | Phase 1.2 (`acquireRlsSession.release()`), Execution Note 11 |
| F-2: knex.transaction() loses RLS | CRITICAL | Phase 1.1 (`createRlsExecutor` with BEGIN/COMMIT/ROLLBACK), Execution Note 10 |
| F-3: Circular dep (core↔metahubs) | HIGH | Phase 0A (new `@universo/database` package), Dependency Graph |
| F-4: localesRoutes `ds.transaction()` | HIGH | Phase 2 Overview (admin = no RLS = pool executor), Phase 2B.2 |
| F-5: Pool budget deferred to Phase 9 | MEDIUM | Moved to Phase 0B |
| F-6: Duplicate SQL executor interfaces | MEDIUM | Phase 6G (SqlExecutor → SqlQueryable unification) |
| F-7: $1 vs ? param binding | MEDIUM | Execution Note 6 (keep $1 in stores, ? in infra) |
| F-8: connection.query() vs knex.raw().connection() | MEDIUM | Phase 1.2 (all code uses knex.raw().connection()), Risk section |
| F-9: legacyChecksumAliases deferred | MEDIUM | Moved to Phase 0C |
| F-10: unnecessary new public RLS interface | MEDIUM | Phase 1.2-1.3, Execution Note 12 |
| F-11: `schema-ddl` DI boundary drift | MEDIUM | Phase 0A.4, Execution Note 13 |
| F-12: existing definition lifecycle catalog unused | HIGH | Phase 9B, Execution Note 14 |
| F-13: metahub/application runtime convergence missing | HIGH | Phase 9C, Execution Note 15 |
| ТЗ 3-4-6: DB/file round-trip, editor readiness, lifecycle tooling | GAP | Phase 9B + 9C |
