# Unified Database Access Standard — Implementation Plan

> Created: 2026-03-14  
> Updated: 2026-03-14 (implemented across required phases; final status synced after completion audit)  
> Status: IMPLEMENTED — required phases are complete; optional Phase 6 was evaluated and intentionally deferred  
> QA report: `memory-bank/plan/unified-database-standard-qa-report-2026-03-14.md`  
> Scope: Full standardization of PostgreSQL access across the monorepo  
> Estimated complexity: Level 4 (multi-wave, cross-package, architectural)

### Implementation Outcome (2026-03-14)

- Required phases are complete in the repository: Phase 1 (foundation), Phase 2 (metahubs migration), Phase 3 (applications migration), Phase 4 (auth/core audit), Phase 5 (hardening), Phase 7 (test proof), and Section 8 documentation.
- Optional Phase 6 (materialized views) was explicitly evaluated and deferred because no measured bottleneck justified additional complexity.
- Final acceptance was recorded through `node tools/lint-db-access.mjs` = 0 violations, focused regression suites green, and root `pnpm build` = 27/27 successful tasks.
- Detailed execution and closure history lives in `memory-bank/tasks.md`, `memory-bank/activeContext.md`, and `memory-bank/progress.md`.

### Key Constraints (User Directives)

1. **Clean break — no legacy preservation required.** The test database will be deleted and recreated from scratch. No need for backward-compatible migration paths, baseline tracking of existing violations, or gradual rollout strategies.
2. **No schema/template version increment.** Metahub schema version and template version must NOT be bumped as part of this standardization work.
3. **All legacy code can be removed.** Compatibility wrappers like `KnexClient` in `domains/ddl/index.ts` should be deleted, not preserved.

---

## 1. Overview

### Goal

Establish a single, auditable standard for all PostgreSQL access in the Universo Platformo monorepo. Every domain service, persistence store, and route handler must use the same contracts, the same safety guarantees, and the same result normalization — regardless of whether the query is a user-visible SELECT under RLS, an admin mutation, or a DDL migration.

### Current State (Summary of Audit Findings)

The codebase already has a solid foundation:

- **DbExecutor / DbSession / SqlQueryable** interfaces in `@universo/utils/database/manager.ts`.
- **createKnexExecutor** (pool-level) and **createRlsExecutor** (pinned-connection) implementations in `@universo/database`.
- **ensureAuthWithRls** middleware that correctly pins one connection + set_config + BEGIN/COMMIT.
- **migrations-core** runner with advisory locks, execution budgets, drift detection.
- Clean SQL-first stores in **admin-backend**, **profile-backend**, and most of **applications-backend**.

However, a deep audit revealed **systemic violations** concentrated in **metahubs-backend** and parts of **applications-backend**:

| Problem | Count | Severity |
|---------|-------|----------|
| Direct `KnexClient.getInstance()` in domain services | 45+ | CRITICAL |
| Direct `getKnex()` in route handlers | 16+ | CRITICAL |
| `Knex.Transaction` type leaked into domain signatures | 100+ | HIGH |
| `.transaction()` directly from Knex in domain code | 15+ | HIGH |
| Custom `quoteSchemaName()` bypassing canonical identifiers | 10+ | HIGH |
| `knex.raw()` in domain code (non-DDL) | 40+ | MEDIUM |
| `import type { Knex } from 'knex'` in domain files | 12+ | MEDIUM |

### Decision: Keep Knex as Transport, Not as Domain API

After evaluating alternatives (pg-pool direct, Drizzle, Kysely, full removal of Knex), the recommendation is to **keep Knex as the underlying transport and DDL engine**, but completely isolate it behind the `DbExecutor` contract for all domain code.

**Why not remove Knex entirely?**
1. Knex already powers the pool, pinned-connection, and DDL subsystems reliably.
2. The schema-ddl package, migration runner, and 30+ migration files depend on Knex Schema Builder.
3. Replacing transport would be high-risk for zero user-facing benefit.
4. The real problem is not Knex itself, but **Knex leaking into domain code**.

**What we take from lsFusion's approach:**
1. **"No ORM, Yes SQL"** — queries execute on the DB server as SQL, not through an ORM abstraction. Already our direction.
2. **Set-based operations** — single SQL statement per action, not N round-trips. Standardize CTE + RETURNING patterns.
3. **Materialization** — for heavy read aggregates, use materialized views refreshed on publication events.
4. **Open database structure** — schema names are transparent, no generated surrogate names. Already implemented.
5. **ACID CI** — transactions as the unit of consistency. Already our pinned-connection pattern.

---

## 2. Architecture After Standardization

### Three Permitted Access Tiers

```
┌─ Tier 1: Request-Scoped (RLS) ─────────────────────────────┐
│                                                              │
│  Routes → getRequestDbExecutor(req, fallback)                │
│           ↓                                                  │
│  DbExecutor (pinned connection, RLS claims set)              │
│           ↓                                                  │
│  Store functions: raw SQL with $1..$N params                 │
│  Result: T[] / T | null (normalized by executor)             │
│                                                              │
│  RULE: No Knex imports. No .transaction(). No getKnex().     │
│  RULE: Advisory locks via acquireAdvisoryLock(executor, ...) │
└──────────────────────────────────────────────────────────────┘

┌─ Tier 2: Admin / Bootstrap (Non-RLS) ──────────────────────┐
│                                                              │
│  Admin routes → createKnexExecutor(getKnex())                │
│  Bootstrap → createKnexExecutor(getKnex())                   │
│           ↓                                                  │
│  DbExecutor (pool-level, no RLS claims)                      │
│           ↓                                                  │
│  Same store functions, same SQL, same normalization           │
│                                                              │
│  RULE: Only in admin-backend, auth-backend, core-backend.    │
└──────────────────────────────────────────────────────────────┘

┌─ Tier 3: DDL / Migrations (Infrastructure) ────────────────┐
│                                                              │
│  schema-ddl, migrations-core, migrations-catalog,            │
│  migrations-platform, universo-database                      │
│           ↓                                                  │
│  Knex instance directly (Schema Builder + raw)               │
│  Advisory locks (session or transaction)                     │
│  Execution budgets (SET LOCAL lock_timeout/statement_timeout) │
│           ↓                                                  │
│  DDL: CREATE SCHEMA / TABLE / INDEX / ALTER / DROP           │
│                                                              │
│  RULE: Only these 5 packages may import from 'knex'.         │
│  RULE: Domain packages NEVER do DDL directly.                │
└──────────────────────────────────────────────────────────────┘
```

### Cross-Cutting Rules (Gap G2)

1. **Schema-qualified SQL only — no search_path reliance.** All domain SQL MUST use
   `qSchemaTable(schema, table)` to produce `"schema"."table"` identifiers. Code MUST NOT
   rely on PostgreSQL `search_path` for table resolution. This matches the TZ directive:
   *"не полагаться на search_path, а использовать schema-qualified имена."*

2. **SECURITY DEFINER function standard (Gap G7 — future-proofing).** If any
   `SECURITY DEFINER` PostgreSQL functions are introduced in the future, they MUST fix
   `search_path` inside the function body:
   ```sql
   CREATE FUNCTION ... SECURITY DEFINER SET search_path = admin, pg_catalog, pg_temp
   ```
   This prevents privilege escalation through path manipulation. Currently no such
   functions exist, but the rule is documented to prevent future omissions.

### New Shared Primitives (What We Add)

> **DML RETURNING requirement:** All mutating DML (INSERT, UPDATE, DELETE) in domain
> code MUST use a `RETURNING` clause. This is because the `SqlQueryable.query()` contract
> normalizes results to `result.rows ?? result`, which loses the PostgreSQL `rowCount`
> metadata. Using `RETURNING` ensures that `rows.length` accurately reflects affected
> row count and that returned data is available for the caller. This also aligns with
> lsFusion's set-based philosophy: every mutation returns its result set.

#### 2.1. Typed Query Helpers — `@universo/utils/database/query`

```typescript
import { z } from 'zod'
import type { SqlQueryable, DbExecutor } from '@universo/utils/database'

// ── Query helpers ────────────────────────────────────────────

/**
 * Execute SQL and return all rows. Optional Zod validation for
 * API boundaries and migration snapshots.
 */
export async function queryMany<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>
): Promise<T[]> {
    const rows = await db.query<unknown>(sql, [...params])
    if (!schema) return rows as T[]
    return rows.map((row) => schema.parse(row))
}

/**
 * Execute SQL and return the first row or null.
 */
export async function queryOne<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>
): Promise<T | null> {
    const rows = await queryMany(db, sql, params, schema)
    return rows[0] ?? null
}

/**
 * Execute SQL and return the first row, or throw NotFoundError.
 *
 * Throws a plain Error (not http-errors) to keep @universo/utils transport-agnostic
 * (the package has browser exports and must not depend on http-errors).
 * Route handlers should catch this error and wrap it with createError(404) from
 * the http-errors package already available in every backend package.
 *
 * Alternatively, callers can supply a custom error factory:
 *   queryOneOrThrow(db, sql, params, schema, () => createError(404, 'Not found'))
 */
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'NotFoundError'
    }
}

export async function queryOneOrThrow<T>(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = [],
    schema?: z.ZodType<T>,
    errorOrMessage: string | (() => Error) = 'Not found'
): Promise<T> {
    const row = await queryOne(db, sql, params, schema)
    if (!row) {
        throw typeof errorOrMessage === 'function'
            ? errorOrMessage()
            : new NotFoundError(errorOrMessage)
    }
    return row
}

/**
 * Execute a DML statement with RETURNING clause and return the count of
 * affected rows. All mutating DML in this project MUST use RETURNING to
 * guarantee correct counts through the SqlQueryable normalization layer
 * (which exposes only `rows`, not `rowCount`).
 *
 * Example: `executeCount(db, 'DELETE FROM t WHERE id = $1 RETURNING id', [id])`
 */
export async function executeCount(
    db: SqlQueryable,
    sql: string,
    params: readonly unknown[] = []
): Promise<number> {
    const rows = await db.query<Record<string, unknown>>(sql, [...params])
    return rows.length
}
```

#### 2.2. Safe Identifier Helpers — `@universo/database/identifiers`

> **Package placement rationale (QA fix F1):** These helpers live in `@universo/database`,
> NOT in `@universo/utils`. Reason: they import from `@universo/migrations-core`, and
> `@universo/utils` is a leaf package that must not depend on migrations-core.
> `@universo/database` already depends on `@universo/utils` and adding
> `@universo/migrations-core` as a dependency is architecturally clean (both are DB
> infrastructure). Domain packages that need identifier quoting import from
> `@universo/database` (which they already depend on for `getPoolExecutor()`).

File: `packages/universo-database/base/src/identifiers.ts`

```typescript
import {
    assertCanonicalSchemaName,
    assertCanonicalIdentifier,
    quoteIdentifier,
    quoteQualifiedIdentifier
} from '@universo/migrations-core'

/**
 * Quote a validated schema name for use in SQL.
 */
export function qSchema(schema: string): string {
    assertCanonicalSchemaName(schema)
    return quoteIdentifier(schema)
}

/**
 * Quote a validated table name for use in SQL.
 */
export function qTable(table: string): string {
    assertCanonicalIdentifier(table)
    return quoteIdentifier(table)
}

/**
 * Return "schema"."table" with both identifiers validated.
 */
export function qSchemaTable(schema: string, table: string): string {
    assertCanonicalSchemaName(schema)
    assertCanonicalIdentifier(table)
    return quoteQualifiedIdentifier(schema, table)
}

/**
 * Quote a validated column name for use in SQL.
 */
export function qColumn(column: string): string {
    assertCanonicalIdentifier(column)
    return quoteIdentifier(column)
}
```

**Required package.json change:** Add `"@universo/migrations-core": "workspace:*"` to
`packages/universo-database/base/package.json` dependencies.

**Barrel export:** Add to `packages/universo-database/base/src/index.ts`:
```typescript
export { qSchema, qTable, qSchemaTable, qColumn } from './identifiers'
```

#### 2.3. DbExecutor-Based Advisory Lock — `@universo/utils/database/locks`

> **Two advisory lock systems coexist (QA fix F4):**
>
> | System | Package | Scope | API | Use when |
> |--------|---------|-------|-----|----------|
> | Existing | `@universo/schema-ddl/locking.ts` | DDL / migrations (Tier 3) | `acquireAdvisoryLock(knex, lockKey, timeoutMs)` — poll-loop with `pg_try_advisory_xact_lock`, pinned Knex connection, debug logging, in-memory tracking | Infrastructure packages doing DDL that already have a Knex instance |
> | New | `@universo/utils/database/locks` | Domain code (Tier 1/2) | `withAdvisoryLock(executor, lockKey, work, opts?)` — blocking `pg_advisory_xact_lock` inside `executor.transaction()`, validated timeout | Domain services and route handlers that use DbExecutor |
>
> The existing `schema-ddl` system is mature, battle-tested, and tightly coupled to Knex.
> It stays unchanged. The new system provides the same safety for domain code that must
> not import Knex. Both use transaction-scoped locks that auto-release on COMMIT/ROLLBACK.

```typescript
import type { DbExecutor } from '@universo/utils/database'

const MAX_LOCK_TIMEOUT_MS = 300_000

const assertLockTimeoutMs = (ms: number): number => {
    if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_LOCK_TIMEOUT_MS) {
        throw new Error(
            `Invalid lock_timeout: must be a positive integer <= ${MAX_LOCK_TIMEOUT_MS}ms`
        )
    }
    return ms
}

const buildSetLocalLockTimeoutSql = (timeoutMs: number): string =>
    `SET LOCAL lock_timeout TO '${assertLockTimeoutMs(timeoutMs)}ms'`

/**
 * Acquire a transaction-scoped advisory lock inside an executor transaction.
 * This replaces direct knex-based advisory lock calls in domain code.
 *
 * The lock is automatically released when the transaction commits or rolls back.
 * Uses blocking pg_advisory_xact_lock — if timeout is specified, PostgreSQL will
 * raise an error after the timeout expires. Without timeout it will wait
 * indefinitely (bounded only by statement_timeout).
 */
export async function withAdvisoryLock<T>(
    executor: DbExecutor,
    lockKey: string,
    work: (tx: DbExecutor) => Promise<T>,
    options?: { timeoutMs?: number }
): Promise<T> {
    return executor.transaction(async (tx) => {
        if (options?.timeoutMs) {
            await tx.query(buildSetLocalLockTimeoutSql(options.timeoutMs))
        }
        await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey])
        return work(tx)
    })
}

/**
 * Try to acquire advisory lock without blocking.
 * Returns null if lock is not available.
 */
export async function tryWithAdvisoryLock<T>(
    executor: DbExecutor,
    lockKey: string,
    work: (tx: DbExecutor) => Promise<T>
): Promise<T | null> {
    return executor.transaction(async (tx) => {
        const [{ acquired }] = await tx.query<{ acquired: boolean }>(
            `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
            [lockKey]
        )
        if (!acquired) return null
        return work(tx)
    })
}
```

#### 2.4. DbExecutor-Based Transaction Helper — `@universo/utils/database/transactions`

> **QA fix F3+F7:** Uses the existing `buildSetLocalStatementTimeoutSql()` from
> `@universo/utils/database/statementTimeout` instead of raw string interpolation.
> That helper already validates the timeout as a positive integer ≤ 300,000ms.

```typescript
import type { DbExecutor } from '@universo/utils/database'
import { buildSetLocalStatementTimeoutSql } from './statementTimeout'

/**
 * Run work inside a transaction with execution budget.
 * Replaces direct knex.transaction() calls in domain code.
 */
export async function withTransaction<T>(
    executor: DbExecutor,
    work: (tx: DbExecutor) => Promise<T>,
    options?: { statementTimeoutMs?: number }
): Promise<T> {
    return executor.transaction(async (tx) => {
        if (options?.statementTimeoutMs) {
            await tx.query(buildSetLocalStatementTimeoutSql(options.statementTimeoutMs))
        }
        return work(tx)
    })
}
```

---

## 3. Implementation Phases

### Phase 1: Foundation — Shared Primitives & Lint Rules (Week 1)

#### Step 1.1: Create typed query helpers

- [ ] Add `packages/universo-utils/base/src/database/query.ts` with `queryMany`, `queryOne`, `queryOneOrThrow`, `executeCount`
- [ ] Add Zod optional validation overload
- [ ] Export from `@universo/utils/database` barrel
- [ ] Tests: `packages/universo-utils/base/src/database/__tests__/query.test.ts`
  - Test: queryMany returns typed array
  - Test: queryOne returns null when empty
  - Test: queryOneOrThrow throws 404
  - Test: Zod validation rejects bad rows
  - Test: executeCount returns row count

#### Step 1.2: Create safe identifier helpers

- [ ] Add `packages/universo-database/base/src/identifiers.ts` with `qSchema`, `qTable`, `qSchemaTable`, `qColumn`
- [ ] Add `"@universo/migrations-core": "workspace:*"` to `packages/universo-database/base/package.json` dependencies
- [ ] Export from `@universo/database` barrel (`packages/universo-database/base/src/index.ts`)
- [ ] Tests: `packages/universo-database/base/src/__tests__/identifiers.test.ts`
  - Test: qSchema accepts canonical names (admin, metahubs, app_*, mhb_*)
  - Test: qSchema rejects malicious identifiers (`'; DROP TABLE`, `" OR 1=1 --`)
  - Test: qSchemaTable returns correct quoted form (`"schema"."table"`)
  - Test: qColumn validates and quotes

#### Step 1.3: Create DbExecutor-based advisory lock helpers

- [ ] Add `packages/universo-utils/base/src/database/locks.ts` with `withAdvisoryLock`, `tryWithAdvisoryLock`, `assertLockTimeoutMs`, `buildSetLocalLockTimeoutSql`
- [ ] Export from `@universo/utils/database` barrel
- [ ] Tests: `packages/universo-utils/base/src/database/__tests__/locks.test.ts`
  - Test: withAdvisoryLock acquires lock and runs work
  - Test: withAdvisoryLock respects timeout via validated `SET LOCAL lock_timeout`
  - Test: assertLockTimeoutMs rejects invalid values (negative, non-integer, >300000)
  - Test: tryWithAdvisoryLock returns null when unavailable

#### Step 1.4: Create DbExecutor-based transaction helper

- [ ] Add `packages/universo-utils/base/src/database/transactions.ts` with `withTransaction`
- [ ] Reuse existing `buildSetLocalStatementTimeoutSql()` from `./statementTimeout` for safe timeout SQL
- [ ] Export from `@universo/utils/database` barrel
- [ ] Tests: `packages/universo-utils/base/src/database/__tests__/transactions.test.ts`
  - Test: withTransaction wraps work in transaction
  - Test: withTransaction delegates to `buildSetLocalStatementTimeoutSql` for timeout SQL
  - Test: withTransaction inherits the 300s cap from that helper

#### Step 1.5: Add DbExecutor factory to universo-database exports

- [ ] Ensure `@universo/database` exports a factory that domain packages can import without touching Knex:
  ```typescript
  import { createKnexExecutor } from './knexExecutor'
  import { getKnex } from './KnexClient'
  import type { DbExecutor } from '@universo/utils/database'

  /**
   * Returns a pool-level DbExecutor backed by the shared Knex instance.
   * Domain packages import this instead of getKnex() directly.
   */
  export function getPoolExecutor(): DbExecutor {
      return createKnexExecutor(getKnex())
  }
  ```
- [ ] This wraps `createKnexExecutor(getKnex())` so domain code never imports getKnex directly
- [ ] Export from `@universo/database` barrel (`packages/universo-database/base/src/index.ts`)

#### Step 1.6: Create lint enforcement script

> **Clean-break approach (QA fix F5+F10):** Since the test database will be recreated
> from scratch and no legacy code needs preservation, there is no `--baseline` mode.
> The script enforces a **zero-violation policy from day one.** All violations found
> must be fixed within the same phase that creates them.

- [ ] Create `tools/lint-db-access.mjs` script that:
  - Scans domain packages (metahubs-backend, applications-backend, admin-backend, profile-backend, auth-backend) for:
    - `import.*from 'knex'` (including type-only imports — no exceptions in domain packages)
    - `KnexClient.getInstance()` in any file
    - `KnexClient` import/usage in any file
    - `getKnex()` in non-infrastructure paths
    - String interpolation patterns for SQL identifiers: `` `"${` `` or `` `${schema}` `` in SQL context
  - **Path exclusions for auth-backend (QA fix F13):** `ensureAuthWithRls` middleware in
    `**/middlewares/**` legitimately uses `getKnex()` to create pinned RLS connections
    via `createRlsExecutor(knex, connection)`. This is infrastructure, not domain logic.
    Excluded paths: `packages/auth-backend/**/middlewares/**`.
    Scanned paths (domain): `packages/auth-backend/**/services/**`, `packages/auth-backend/**/routes/**`.
  - **Path exclusions for metahubs-backend DDL subsystem (QA fix F16):** Several files in
    metahubs-backend are genuine DDL infrastructure that legitimately requires Knex types:
    `SystemTableDDLGenerator.ts` (creates tables via `knex.schema`),
    `SystemTableMigrator.ts` (applies DDL migrations), `structureVersions.ts` (DDL version
    specs with `init: (knex: Knex) => Promise<void>`), and `domains/ddl/index.ts`
    (getDDLServices factory + Knex re-exports). These are Tier 3-equivalent code that
    happens to live inside a domain package for colocation reasons.
    Excluded paths:
    - `packages/metahubs-backend/**/domains/ddl/**`
    - `packages/metahubs-backend/**/services/SystemTableDDLGenerator.ts`
    - `packages/metahubs-backend/**/services/SystemTableMigrator.ts`
    - `packages/metahubs-backend/**/services/structureVersions.ts`
    Note: `widgetTableResolver.ts`, `TemplateSeedExecutor.ts`, `TemplateSeedMigrator.ts`,
    and `TemplateSeedCleanupService.ts` are evaluated in Step 2.11 — those that can be
    converted to DbExecutor MUST be; only files that genuinely need Knex Schema Builder
    for DDL remain excluded.
  - Returns non-zero exit code if violations found
  - Reports violation count and file locations
- [ ] Tests: The script correctly flags known violations and passes clean files

#### Step 1.7: Build and validate

- [ ] `pnpm --filter @universo/utils build`
- [ ] `pnpm --filter @universo/database build` (now includes identifiers + migrations-core dep)
- [ ] Run new tests
- [ ] Full `pnpm build`

---

### Phase 2: Metahubs-Backend Migration — Services (Week 2–3)

This is the largest wave. The metahubs-backend has ~10 service classes that use `KnexClient.getInstance()` directly.

**Strategy**: Convert each service to accept `DbExecutor | SqlQueryable` instead of `this.knex`. Because metahubs services currently work with dynamic schemas (`mhb_<uuid>_bN`), they need the identifier helpers.

#### Step 2.1: Convert MetahubSettingsService

- [ ] Replace `private get knex() { return KnexClient.getInstance() }` with constructor-injected `DbExecutor`
- [ ] Replace Knex query builder calls with raw SQL through `executor.query()`
- [ ] Use `qSchemaTable()` for dynamic schema references
- [ ] Tests: Unit tests with mock DbExecutor
  - Test: findAll returns settings from correct schema
  - Test: update modifies correct row
  - Test: correct schema qualification in SQL

#### Step 2.2: Convert MetahubAttributesService

- [ ] Same pattern: inject `DbExecutor`, replace `.withSchema().from().where()` chains
- [ ] Replace local `quoteSchemaName()` with `qSchema()` from `@universo/database`
- [ ] Replace `Knex.Transaction` parameter types with `DbExecutor`
- [ ] Replace direct `.transaction()` calls with `executor.transaction()` or `withTransaction()`
- [ ] Tests:
  - Test: create attribute with SQL
  - Test: update attribute with correct parameters
  - Test: delete uses soft-delete SQL
  - Test: optimistic lock version increment

#### Step 2.3: Convert MetahubHubsService

- [ ] Inject `DbExecutor`, replace `this.knex` usage
- [ ] Remove local `quoteSchemaName()` method
- [ ] Replace `Knex.Transaction` signatures with `DbExecutor`
- [ ] Tests: hub CRUD via SQL through executor

#### Step 2.4: Convert MetahubObjectsService

- [ ] Inject `DbExecutor`, replace `KnexClient.getInstance()` getter
- [ ] Replace advisory lock calls to use `withAdvisoryLock(executor, ...)`
- [ ] Tests: object mutations with advisory lock

#### Step 2.5: Convert MetahubElementsService

- [ ] Same pattern: DbExecutor injection
- [ ] Replace `.transaction()` calls
- [ ] Tests: element CRUD operations

#### Step 2.6: Convert MetahubLayoutsService

- [ ] Convert `KnexTransaction` type alias to `DbExecutor`
- [ ] Replace all `.transaction()` calls (9 instances)
- [ ] Tests: layout operations

#### Step 2.7: Convert MetahubConstantsService

- [ ] Inject DbExecutor, replace Knex.Transaction parameters
- [ ] Tests: constant CRUD

#### Step 2.8: Convert MetahubEnumerationValuesService

- [ ] Inject DbExecutor, replace `Knex | Knex.Transaction` types
- [ ] Replace `.transaction()` calls (6 instances)
- [ ] Tests: enumeration value operations

#### Step 2.9: Convert MetahubSchemaService (CAREFUL)

> **No schema/template version increment (QA fix F6):** This standardization refactor
> does NOT change the logical schema structure. The `schema_version` and `template_version`
> fields in metahubs tables must remain at their current values. Only the access patterns
> (Knex → DbExecutor) change; the SQL output and table structure stay identical.

- [ ] **Note (QA fix F17):** The constructor already accepts `exec: SqlQueryable` (line 97).
  The `private get knex()` getter is a SEPARATE access path used only for DDL and
  advisory locks. The conversion must:
  1. **Remove** `private get knex() { return KnexClient.getInstance() }` getter
  2. **DDL methods** (`createEmptySchemaIfNeeded`, `dropSchema`): replace `KnexClient.getInstance()`
     with `getKnex()` imported directly from `@universo/database`. This is the standard Tier 3
     API. Since this file is in the DDL lint exclusion list (QA fix F16), importing `getKnex()`
     and `Knex` types is permitted. **(Gap G4 simplification):** Passing Knex from callers
     (route handlers) would force domain code to know about Knex — contradicting the goal.
     Direct import in a DDL-excluded file is the correct Tier 3 pattern.
  3. **Advisory locks** in `ensureSchema()`: use `getKnex()` for
     `acquireAdvisoryLock(getKnex(), lockKey)` (Tier 3 lock system from schema-ddl)
  4. **DML/introspection methods**: keep using existing `this.exec: SqlQueryable` (already correct)
- [ ] Verify: schema_version and template_version values are NOT modified
- [ ] This file stays in the DDL lint exclusion list (QA fix F16) since it uses Knex types
- [ ] Tests: schema introspection via executor, DDL via passed Knex

#### Step 2.10: Fix metahubsQueryHelpers unsafe identifier interpolation

> **Security fix:** `metahubsQueryHelpers.ts` currently uses `"${schema}"."${table}"` and
> `"${filterColumn}"` — direct string interpolation without validation. This must be
> replaced with `qSchemaTable(schema, table)` and `qColumn(column)` from `@universo/database`.

- [ ] Replace all `"${schema}"."${table}"` patterns with `${qSchemaTable(schema, table)}`
- [ ] Replace all `"${filterColumn}"` patterns with `${qColumn(filterColumn)}`
- [ ] Ensure `softDelete()`, `restoreDeleted()`, `purgeOldDeleted()`, `countDeleted()` all use safe identifiers
- [ ] Tests: verify injection payloads are rejected by q* helpers

#### Step 2.11: Convert template services

- [ ] Convert `widgetTableResolver.ts`, `TemplateSeedExecutor.ts`, `TemplateSeedMigrator.ts`, `TemplateSeedCleanupService.ts`
- [ ] These do DDL-adjacent work — evaluate which need Knex and which can use DbExecutor
- [ ] Tests: template seed operations

#### Step 2.12: Delete KnexClient compatibility wrapper

- [ ] Remove `KnexClient` from `metahubs-backend/domains/ddl/index.ts`
- [ ] Remove all imports referencing `KnexClient` across metahubs-backend
- [ ] Verify no runtime code depends on this wrapper

#### Step 2.13: Convert metahubs route handlers

- [ ] Replace `KnexClient.getInstance()` calls in route files: attributesRoutes, hubsRoutes,
  catalogsRoutes, enumerationsRoutes, layoutsRoutes, setsRoutes, publicationsRoutes,
  metahubsRoutes, **applicationMigrationsRoutes** (3 KnexClient + advisory lock + direct `knex.transaction()`),
  **metahubMigrationsRoutes** (7–8 KnexClient calls — highest density)
- [ ] Advisory lock calls → `withAdvisoryLock(executor, ...)`
- [ ] Inject executor from `getRequestDbExecutor(req, getPoolExecutor())`
- [ ] Replace all `import ... from 'knex'` with `import ... from '@universo/database'` for identifiers
- [ ] Tests: route-level integration tests

#### Step 2.14: Validate metahubs-backend

- [ ] `pnpm --filter @universo/metahubs-backend build`
- [ ] `pnpm --filter @universo/metahubs-backend test`
- [ ] `pnpm --filter @universo/metahubs-backend lint`

---

### Phase 3: Applications-Backend Migration (Week 3)

#### Step 3.1: Convert ApplicationSchemaSyncStateStore

- [ ] Replace `Knex.Transaction` parameter with `DbExecutor`
- [ ] Rewrite Knex builder chains as raw SQL
- [ ] Tests: sync state persistence

#### Step 3.2: Convert ConnectorSyncTouchStore

- [ ] Replace `Knex.Transaction` parameter with `DbExecutor`
- [ ] Tests: connector touch persistence

#### Step 3.3: Convert applicationSyncRoutes

- [ ] Replace all `getKnex()` direct calls (16+ instances)
- [ ] Replace `Knex.Transaction` type annotations
- [ ] Replace `.transaction()` calls with executor.transaction()
- [ ] Remove LOCAL `quoteIdentifier` function — use `qSchema`/`qTable` from `@universo/database`
- [ ] DDL operations: accept Knex from route boundary, not via getKnex()
- [ ] Tests: sync route operations

#### Step 3.4: Validate applications-backend

- [ ] `pnpm --filter @universo/applications-backend build`
- [ ] `pnpm --filter @universo/applications-backend test`
- [ ] `pnpm --filter @universo/applications-backend lint`

---

### Phase 4: Auth-Backend and Remaining Packages (Week 3–4)

#### Step 4.1: Audit auth-backend

> **`ensureAuthWithRls` middleware is infrastructure (QA fix F13):** This middleware
> legitimately uses `getKnex()` + `createRlsExecutor(knex, connection)` to set up
> pinned RLS connections. It stays as-is — the lint script excludes `**/middlewares/**`.

- [ ] `getKnex()` in auth.ts route — evaluate if this is bootstrap/admin context (acceptable) or should use `getPoolExecutor()`
- [ ] `permissionService.ts` — convert public API and internal implementation (QA fix F14):
  - Change `PermissionServiceOptions` from `{ getKnex: () => Knex }` to `{ getDbExecutor: () => DbExecutor }`
  - Change internal `runQuery` fallback from `createKnexExecutor(getKnex())` to `options.getDbExecutor()`
  - Remove `import type { Knex } from 'knex'` and `import { createKnexExecutor } from '@universo/database'`
  - Add `import type { DbExecutor } from '@universo/utils/database'`
  - Update call site in `universo-core-backend/base/src/routes/index.ts`:
    ```typescript
    // Before:
    const permissionService = createPermissionService({ getKnex })
    // After:
    const permissionService = createPermissionService({ getDbExecutor: getPoolExecutor })
    ```
- [ ] Tests: auth route tests — verify permissionService still loads permissions correctly

#### Step 4.1b: Update core-backend executor factory wiring (Gap G1)

> **Context:** `universo-core-backend/base/src/routes/index.ts` is the DI wiring hub that
> creates all router factories. After Phase 1.5 adds `getPoolExecutor()`, this file must
> be updated to use the new factory instead of `() => createKnexExecutor(getKnex())`.
> Step 4.1 only addresses `permissionService` — this step covers the remaining 10+ sites.

- [ ] Import `getPoolExecutor` from `@universo/database` (replacing `createKnexExecutor`)
- [ ] Replace all `() => createKnexExecutor(getKnex())` factory arguments with `getPoolExecutor`:
  | Router factory | Current | After |
  |---|---|---|
  | `createPublicMetahubsServiceRoutes` | `() => createKnexExecutor(getKnex())` | `getPoolExecutor` |
  | `createPublicLocalesRoutes` | `{ getDbExecutor: () => createKnexExecutor(getKnex()) }` | `{ getDbExecutor: getPoolExecutor }` |
  | `createMetahubsServiceRoutes` | `() => createKnexExecutor(getKnex())` | `getPoolExecutor` |
  | `createApplicationsServiceRoutes` | `() => createKnexExecutor(getKnex())` | `getPoolExecutor` |
  | `createStartServiceRoutes` | `(r) => getRequestDbExecutor(r, createKnexExecutor(getKnex()))` | `(r) => getRequestDbExecutor(r, getPoolExecutor())` |
  | `createGlobalAccessService` | `{ getDbExecutor: () => createKnexExecutor(getKnex()) }` | `{ getDbExecutor: getPoolExecutor }` |
  | `createInstancesRoutes` | `getDbExecutor: () => createKnexExecutor(getKnex())` | `getDbExecutor: getPoolExecutor` |
  | `createRolesRoutes` | `getDbExecutor: () => createKnexExecutor(getKnex())` | `getDbExecutor: getPoolExecutor` |
  | `createLocalesRoutes` | `getDbExecutor: () => createKnexExecutor(getKnex())` | `getDbExecutor: getPoolExecutor` |
  | `createAdminSettingsRoutes` | `getDbExecutor: () => createKnexExecutor(getKnex())` | `getDbExecutor: getPoolExecutor` |
  | `createProfileRoutes` | both `getDbExecutor` and `getRequestDbExecutor` | `getPoolExecutor` + `(req) => getRequestDbExecutor(req, getPoolExecutor())` |
- [ ] Keep `getKnex` import ONLY for `createEnsureAuthWithRls({ getKnex })` — this is the
  RLS middleware (infrastructure, Tier 3) that legitimately needs the raw Knex pool
- [ ] Verify that `createKnexExecutor` import can be removed entirely from this file
  (all usages should be replaced by `getPoolExecutor`)
- [ ] Tests: all existing route integration tests still pass

#### Step 4.2: Audit start-backend

> **R3 audit result (Gap G5):** Deep codebase audit confirmed that start-backend has
> **zero** direct Knex usage in domain code. This step is verification-only.
> Expected outcome: already clean, no changes needed.

- [ ] Check for any direct Knex usage in domain code
- [ ] Remediate if needed (expected: no remediation required)

#### Step 4.3: Full workspace validation

- [ ] Full `pnpm build` — 27/27 packages
- [ ] Full test suite run
- [ ] Run `tools/lint-db-access.mjs` — zero violations in domain packages

---

### Phase 5: Performance & Safety Hardening (Week 4)

#### Step 5.1: Set-based operation audit

Inspired by lsFusion's "one query per action" principle:

- [ ] Audit **all domain routes** (metahubs-backend, applications-backend) for multi-round-trip
  patterns (SELECT → check → UPDATE) — **(Gap G3):** the "one query per action" principle
  from lsFusion applies to ALL domain packages, not just metahubs
- [ ] Refactor to CTE + RETURNING where possible:
  ```sql
  WITH target AS (
      SELECT id FROM "metahubs"."metahubs"
      WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false
  )
  UPDATE "metahubs"."metahubs" SET slug = $2, _upl_updated_at = NOW()
  FROM target WHERE "metahubs"."metahubs".id = target.id
  RETURNING id
  ```
- [ ] Tests: verify single-round-trip for key operations

#### Step 5.2: Batch introspection safety

- [ ] Audit all `information_schema` queries for N+1 patterns
- [ ] Ensure all schema/table existence checks are batched (already done in MetahubSchemaService — verify everywhere)
- [ ] Tests: verify batch behavior

#### Step 5.3: Connection pool tuning documentation

- [ ] Document recommended pool settings for different deployment sizes
- [ ] Add pool overflow alert thresholds
- [ ] Add `DATABASE_POOL_MAX` guidance to .env.example

#### Step 5.4: Statement timeout enforcement

- [ ] Ensure all user-facing queries respect the 30s statement_timeout from KnexClient
- [ ] For long-running admin operations, document explicit `SET LOCAL statement_timeout` usage
- [ ] Tests: verify timeout behavior

---

### Phase 6: Materialized Views Strategy (Week 5, optional)

Inspired by lsFusion's materialization concept.

#### Step 6.1: Identify materialization candidates

- [ ] Audit queries that aggregate across many rows (entity counts, attribute statistics, etc.)
- [ ] Create a list of candidates for materialized views

#### Step 6.2: Implement materialized view refresh triggers

- [ ] Create helper for `CREATE MATERIALIZED VIEW` + `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- [ ] Attach refresh to publication events (existing event system)
- [ ] Tests: materialized view creation and refresh

---

### Phase 7: Comprehensive Test Suite (Across All Phases)

Each phase includes its own tests. Additionally:

#### Step 7.1: Cross-cutting integration tests

- [ ] `packages/universo-utils/base/src/database/__tests__/integration.test.ts`:
  - Test: RLS executor preserves claims across queries
  - Test: Pool executor does not have RLS claims
  - Test: Advisory lock blocks concurrent work
  - Test: Transaction rollback clears intermediate state
  - Test: Nested transactions use SAVEPOINT

#### Step 7.2: Regression test for result normalization

- [ ] Test: no query path returns raw `{}` instead of `T[]`
- [ ] Test: all store methods return typed arrays
- [ ] Test: Zod schemas reject malformed rows

#### Step 7.3: Security regression tests

- [ ] Test: identifier helper rejects SQL injection payloads
  - `'; DROP TABLE users; --`
  - `" OR 1=1 --`
  - `"admin"; SELECT * FROM auth.users; --`
- [ ] Test: parameter binding prevents value injection
- [ ] Test: RLS claims correctly isolate user data

#### Step 7.4: Lint script CI integration

- [ ] Add `tools/lint-db-access.mjs` to CI pipeline
- [ ] Zero-violation policy — no baseline, no exceptions
- [ ] Script also validates: no `KnexClient` references remaining in the codebase

---

## 4. Affected Packages (Detailed)

| Package | Changes | Risk |
|---------|---------|------|
| `@universo/utils` | Add query/locks/transactions modules | LOW — additive |
| `@universo/database` | Add `getPoolExecutor()` export, add `identifiers.ts`, add `@universo/migrations-core` dependency | LOW — additive |
| `@universo/metahubs-backend` | Convert 10+ services, 10+ routes, delete `KnexClient` wrapper | HIGH — core domain |
| `@universo/applications-backend` | Convert sync routes + 2 stores, remove local `quoteIdentifier` | MEDIUM |
| `@universo/auth-backend` | Minor: switch to getPoolExecutor() | LOW |
| `@universo/admin-backend` | Already clean — verify only | LOW |
| `@universo/profile-backend` | Already clean — verify only | LOW |
| `@universo/schema-ddl` | No changes (Tier 3 — Knex is allowed, keeps own advisory lock system) | NONE |
| `@universo/migrations-*` | No changes (Tier 3 — Knex is allowed) | NONE |

---

## 5. Potential Challenges

### 5.1. MetahubSchemaService DDL Boundary

*Problem*: MetahubSchemaService legitimately creates/alters schemas and tables. It needs Knex for DDL but should use DbExecutor for DML.

*Solution*: The service accepts BOTH dependencies: `exec: SqlQueryable` (already present in
the constructor) for DML/introspection, and a Knex instance passed from the route boundary for
DDL operations. This is NOT a split into two separate classes, but a dual-interface in one class:
- `MetahubSchemaDDL` — DDL methods receive Knex as a parameter from the caller
- `MetahubSchemaInspector` — read-only methods use `this.exec: SqlQueryable`
- `ensureSchema()` orchestrator keeps its current flow (DML → DDL → DML) using both dependencies
- The file stays in the DDL lint exclusion list since it imports `Knex` type (QA fix F16)

### 5.2. Advisory Locks Require Raw Connection

*Problem*: `pg_advisory_xact_lock` must run on the same connection as the work it protects. In the pool executor, `executor.transaction()` already ensures this because Knex opens a new connection for the transaction.

*Solution*: The `withAdvisoryLock` helper uses `executor.transaction()` which guarantees single connection. For RLS executors, the connection is already pinned. No special handling needed.

### 5.3. Metahubs Services Require Schema-Qualified Queries

*Problem*: Dynamic schemas (`mhb_<uuid>_bN`) require schema names in SQL. Currently done via `knex.withSchema()` which is Knex-specific.

*Solution*: Use `qSchemaTable(schemaName, tableName)` in SQL strings:
```typescript
// Before (Knex-coupled):
const rows = await this.knex.withSchema(schemaName).from('_mhb_objects').where({ ... })

// After (SQL-first):
const rows = await executor.query<MhbObject>(
    `SELECT * FROM ${qSchemaTable(schemaName, '_mhb_objects')}
     WHERE _upl_deleted = false AND _mhb_deleted = false`,
    []
)
```

### 5.4. Clean Break — No Gradual Migration

> **User directive:** "No need to preserve any legacy code. The test database will be
> deleted and recreated from scratch. No need to increment schema/template version."

This means:
- **No baseline tracking** in the lint script — all violations must be zero after each phase.
- **No compatibility wrappers** — `KnexClient` in `domains/ddl/index.ts` is deleted, not preserved.
- **No migration state preservation** — the database boots fresh from platform migrations.
- **Schema/template version fields** remain unchanged since we're refactoring access patterns, not modifying schema structure.
- Services can be converted in **larger batches** without worrying about backward compatibility.

This significantly reduces risk because there's no "half-migrated" state in production.

### 5.5. RLS Context in Metahubs Services

*Problem*: Currently metahubs services bypass RLS by using KnexClient.getInstance(). Switching to request-scoped DbExecutor means RLS policies will apply. This might break queries that currently work because they bypass RLS.

*Solution*:
- Audit RLS policies on metahubs tables before switching
- Some metahubs operations (branch schema DDL) legitimately need admin-level access
- Route handlers will decide: RLS executor for user-visible queries, pool executor for admin/DDL operations
- This is actually a security improvement, not a regression

---

## 6. Success Criteria

### Hard Requirements (Must Pass)

1. **Zero `KnexClient.getInstance()` calls in domain packages** (metahubs-backend, applications-backend, admin-backend, profile-backend)
2. **Zero `KnexClient` references in the entire codebase** (the compatibility wrapper is deleted)
3. **Zero `import type { Knex } from 'knex'` in domain packages** except files in the DDL subsystem excluded by the lint script (see Step 1.6 path exclusions for metahubs-backend DDL infrastructure)
4. **All domain stores accept `DbExecutor | SqlQueryable`** as their database parameter
5. **`tools/lint-db-access.mjs` passes with zero violations**
6. **All existing tests pass**
7. **Full `pnpm build` passes (27/27)**
8. **Schema_version and template_version values are NOT modified**

### Soft Requirements (Should Achieve)

7. **queryMany/queryOne helpers used in 80%+ of new store methods**
8. **Zod validation on all API-boundary queries**
9. **Advisory locks through withAdvisoryLock helper, not raw pg_advisory calls**
10. **Set-based CTE patterns for multi-step mutations**

### Metrics to Track

- Knex import count in domain packages (target: 0)
- Test coverage for database layer (target: >80%)
- Connection pool utilization under load (target: <70% at peak)
- RLS bypass count (target: 0 in user-facing routes)

---

## 7. Rollback Strategy

Each phase is independently deployable and testable. If a phase introduces regressions:

1. **Phase 1** (primitives): Pure additive — no rollback needed.
2. **Phase 2-4** (migrations): Each service conversion is a separate PR. Revert the specific PR.
3. **Phase 5** (hardening): Performance improvements are opt-in patterns.
4. **Phase 6** (materialization): Entirely optional, can be dropped.

---

## 8. Documentation Plan

- [ ] Update `memory-bank/systemPatterns.md` — add "Unified Database Access Standard" pattern
- [ ] Update `memory-bank/techContext.md` — add DbExecutor tier system
- [ ] Create `docs/en/architecture/database-access-standard.md` — full architecture page
- [ ] Create `docs/ru/architecture/database-access-standard.md` — Russian translation
- [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`
- [ ] Update README files for affected packages with the new access patterns
- [ ] Add inline JSDoc to all new shared helpers
- [ ] **(Gap G6)** Create database code review checklist document
  (`docs/en/contributing/database-code-review-checklist.md` + Russian translation).
  Based on the TZ's "Стандарты и чеклист для code review" section, must include:
  1. SQL query → `executor.query(sql, params)` — no Knex builder in domain code
  2. All identifiers through `qSchemaTable()` / `qColumn()` from `@universo/database`
  3. No raw driver result in store contract — always `T[]` / `T | null`
  4. Advisory lock required for all DDL operations
  5. `SET LOCAL lock_timeout` / `statement_timeout` for long operations
  6. Transaction pooler (port 6543) forbidden — session pooler only
  7. All mutating DML uses `RETURNING` clause
  8. Schema-qualified names only — no `search_path` reliance
  9. SECURITY DEFINER functions must fix `search_path` (if any appear in future)

---

## 9. Example: Full Before/After Comparison

### Before (MetahubSettingsService — current code)

```typescript
import type { Knex } from 'knex'
import { KnexClient } from '@universo/database'

export class MetahubSettingsService {
    private get knex(): Knex {
        return KnexClient.getInstance()
    }

    async findAll(schemaName: string) {
        return this.knex
            .withSchema(schemaName)
            .from('_mhb_settings')
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .select('*')
    }

    async update(schemaName: string, id: string, data: Partial<Setting>, userId: string) {
        return this.knex
            .withSchema(schemaName)
            .from('_mhb_settings')
            .where({ id })
            .update({
                ...data,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId,
                _upl_version: this.knex.raw('_upl_version + 1')
            })
            .returning('*')
    }
}
```

### After (MetahubSettingsService — unified standard)

```typescript
import type { SqlQueryable, DbExecutor } from '@universo/utils/database'
import { queryMany, queryOne } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'

export function createMetahubSettingsStore(db: SqlQueryable) {
    return {
        async findAll(schemaName: string) {
            return queryMany<Setting>(
                db,
                `SELECT * FROM ${qSchemaTable(schemaName, '_mhb_settings')}
                 WHERE _upl_deleted = false AND _mhb_deleted = false
                 ORDER BY _upl_created_at`,
                []
            )
        },

        async update(executor: DbExecutor, schemaName: string, id: string, data: SettingUpdate, userId: string) {
            return queryOne<Setting>(
                executor,
                `UPDATE ${qSchemaTable(schemaName, '_mhb_settings')}
                 SET codename = COALESCE($1, codename),
                     value = COALESCE($2, value),
                     _upl_updated_at = NOW(),
                     _upl_updated_by = $3,
                     _upl_version = _upl_version + 1
                 WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                 RETURNING *`,
                [data.codename, data.value, userId, id]
            )
        }
    }
}
```

### Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Database dependency | `KnexClient.getInstance()` | Injected `SqlQueryable / DbExecutor` |
| RLS compatibility | ❌ Bypasses pinned connection | ✅ Uses request executor |
| Identifier safety | `knex.withSchema()` (Knex-specific) | `qSchemaTable()` (validated + quoted) |
| Result normalization | Knex builder returns | `queryMany`/`queryOne` (always T[]/T) |
| Type safety | Knex generic types | Explicit TypeScript types + optional Zod |
| Testability | Requires Knex mock | Simple `SqlQueryable` mock |
| Transaction management | `knex.raw('_upl_version + 1')` | SQL expression `_upl_version + 1` |

---

## 10. Related Documents

- `.backup/Единый-стандарт-работы-с-PostgreSQL.md` — original research
- `memory-bank/systemPatterns.md` — existing system patterns
- `memory-bank/techContext.md` — technical context
- `memory-bank/rls-integration-pattern.md` — RLS integration details
- `docs/en/architecture/database.md` — current database architecture docs
