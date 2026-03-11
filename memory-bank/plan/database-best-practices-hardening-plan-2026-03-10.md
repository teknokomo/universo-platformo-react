# Database Best Practices & Hardening Plan

> **Date**: 2026-03-10  
> **Status**: DRAFT — QA review completed 2026-03-10, corrections applied  
> **Scope**: Companion remediation plan for Knex runtime binding fix, Supabase connection strategy, RLS hardening, advisory lock safety, test infrastructure, acceptance proof, and legacy surface cleanup. This plan complements the already-completed unified migration platform work; it does not re-specify Phases 9A-9C that are already implemented.

---

## QA Review Summary (2026-03-10)

### Verified Correct
- **Phase 1 (CRITICAL)**: `$1` binding incompatibility confirmed via terminal test. All 15 persistence store files + `permissionService.ts` + `rlsContext.ts` will fail at runtime. Root cause analysis and `convertPgBindings()` solution are architecturally correct.
- **Phase 2 (CRITICAL)**: Supabase transaction mode (port 6543) incompatibility confirmed via docs. Session mode (port 5432 on pooler) is correct for persistent Express server.
- **Phase 3 (HIGH)**: RLS transaction wrapping is sound. Current `set_config(..., false)` with session-level cleanup works but is fragile. Wrapping in `BEGIN/COMMIT` + `set_config(..., true)` is the recommended hardened pattern.
- **Phase 5 (MEDIUM)**: RLS `(select auth.uid())` subquery optimization confirmed by Supabase docs.
- **Phase 7 (HIGH)**: Test infrastructure gap is real — all unit tests mock `knex.raw()`.

### Corrections Applied
1. **Phase 4**: Plan incorrectly states runner.ts needs `pg_try_advisory_lock` → `pg_try_advisory_xact_lock`. In fact, `runner.ts` already uses `pg_advisory_xact_lock` for transaction-mode locks (line 72). Only the `withSessionLock` helper (line 89: `pg_try_advisory_lock`) and `schema-ddl/locking.ts` need this change. Corrected below.
2. **Phase 1 regex**: The `convertPgBindings()` regex JSDoc claims "outside of dollar-quoted strings" but the implementation doesn't actually skip `$$...$$`. This is **safe in practice** (no dollar-quoted SQL flows through executor with params), but the JSDoc must be corrected.
3. **Phase 6**: connectorsRoutes.ts `transaction()` helper always uses `getDbExecutor()` bypass (not just the `query()` helper), including connector creation at line 257. Plan correctly identifies this.

### Additional Findings (Not in Original Plan)
1. **TypeORM documentation residue**: 9 code comments, 4 .env comments, and outdated docs in AGENTS.md/docs/en/contributing reference TypeORM. Non-blocking but should be cleaned.
2. **Migration runner binding safety**: `runConnectionBoundQuery` (runner.ts:58) already handles empty bindings correctly — calls `knex.raw(sql)` without bindings array when none provided. No conversion needed for migration SQL.
3. **`locking.ts` already uses `?` placeholders**: Confirmed correct. Only advisory lock MODE needs change, not placeholder format.
4. **Full TypeORM removal STATUS**: Verified — zero `from 'typeorm'` imports in any src/ file. Migration system fully operational with custom SQL-first pattern.

### TZ Coverage Check
- ✅ TypeORM removal from metahubs/applications — COMPLETE (previous work)
- ✅ TypeORM removal from admin/profile/auth/start — COMPLETE (previous work)
- ✅ Custom migration system operational — 5-layer architecture verified (core → platform → catalog → schema-ddl → guard-shared)
- ✅ Definition lifecycle DB↔file workflow — already implemented via `DefinitionRegistryStore`, `definition_registry`, `definition_revisions`, `definition_exports`, CLI `status|plan|diff|export`
- ✅ Future editor-readiness storage — already implemented via `definition_drafts` and `approval_events`; no new UI is required in this plan
- ✅ Session-scoped set_config fix — Phase 3
- ✅ Soft-delete regression — PREVIOUSLY FIXED
- ✅ Outdated documentation cleanup — Phase 10
- ✅ `admin.roles` + `admin.locales` + `admin.settings` hard DELETE — Phase 11 (soft-delete parity)
- ⚠️ Hardening plan still needed explicit full-scenario acceptance/e2e verification of the original user journey
- ⚠️ Hardening plan still needed removal of residual legacy-neutral API names (`*ByDataSource`, `buildDataSource`, stale DataSource wording)

---

## Overview

The project's backend database layer (`@universo/database`, persistence stores, RLS middleware, schema-ddl) was recently migrated from TypeORM to Knex 3.1.0 with raw SQL stores. This migration introduced **critical runtime bugs** that were invisible during TypeScript compilation and unit testing (which mocks `knex.raw()`):

1. **ALL 200+ SQL queries use PostgreSQL `$1` placeholders** — but Knex `raw()` only recognizes `?` placeholders. Every parameterized query fails at runtime with "Expected N bindings, saw 0".
2. **Supabase UP-test uses Supavisor in transaction mode** (port 6543) — incompatible with session-level `set_config()` and `pg_try_advisory_lock()` that the RLS and DDL layers depend on.
3. **RLS policies use `auth.uid()` without subquery wrapping** — up to 10,000× slower per Supabase docs; all 16 RLS policies need `(select auth.uid())`.
4. **Unit tests mock `knex.raw()` entirely** — so none of the binding, connection, or RLS behaviors are validated against real Knex formatting.

This plan addresses ALL of these issues in a safe, phased order with full test coverage at each step.

## Scope Alignment with Original TZ

This plan should be read as a **companion hardening/closure plan**, not as a replacement for the earlier unified migration roadmap.

What is already implemented outside this plan:
1. Unified migration platform packages (`@universo/migrations-core`, `@universo/migrations-platform`, `@universo/migrations-catalog`, `@universo/schema-ddl`)
2. Canonical definition lifecycle storage (`definition_registry`, `definition_revisions`, `definition_exports`, `definition_drafts`, `approval_events`)
3. CLI support for `migration:status`, `migration:plan`, `migration:diff`, `migration:export`
4. Native SQL platform migrations for metahubs/applications/admin/profile and removal of TypeORM from the target migration flow

What this plan adds to fully satisfy the original TZ without leaving technical debt:
1. Fix the runtime Knex/Supabase regressions introduced by the SQL-first refactor
2. Prove the end-to-end acceptance path on a fresh database using the existing Metahubs and Applications UI/API flows
3. Remove the remaining legacy-neutral naming/API surface that still reflects the old DataSource terminology

What this plan intentionally does **not** add:
1. No new UI editors or new UI component systems
2. No second migration registry or parallel governance system
3. No legacy compatibility layer kept solely for old TypeORM semantics

---

## Affected Areas

### Packages Modified

| Package | Files Affected | Reason |
|---------|---------------|--------|
| `@universo/database` | `knexExecutor.ts`, `KnexClient.ts`, new test files | Core executor fix, connection strategy |
| `@universo/auth-backend` | `rlsContext.ts`, `ensureAuthWithRls.ts`, `permissionService.ts` | Binding format + RLS transaction wrapping |
| `@universo/metahubs-backend` | 8 persistence stores, routes | Binding format migration |
| `@universo/applications-backend` | 3 persistence stores, routes | Binding format migration |
| `@universo/admin-backend` | 4 persistence stores | Binding format migration |
| `@universo/profile-backend` | 1 persistence store | Binding format migration |
| `@universo/schema-ddl` | `locking.ts` | Advisory lock mode (session → transaction-level) |
| `@universo/migrations-core` | `runner.ts` | Advisory lock mode |
| Supabase (UP-test) | RLS policies | Performance: `auth.uid()` → `(select auth.uid())` |

### Unchanged Packages
- `schema-ddl/locking.ts` already uses `?` placeholders (correct!) — only advisory lock *mode* changes.
- Frontend packages are unaffected.

---

## Phase 1: Knex Binding Translation Layer (CRITICAL — runtime blocker)

### Problem
Knex `raw(sql, params)` expects `?` placeholders. All 19 persistence stores use PostgreSQL-native `$1, $2, ...` — inherited from the TypeORM migration. Several stores **reuse parameters** (e.g., `VALUES ($1, $2, $3, $6, $6)`) which cannot be expressed with simple `?`.

**Confirmed reproduction:**
```
knex.raw('SELECT $1::text', ['abc']).toSQL()
→ ERROR: Expected 1 bindings, saw 0
```

### Solution: `convertPgBindings()` utility in `@universo/database`

Add a conversion function in the executor layer that transparently maps `$1`→`?` style, handling repeated parameter references:

```typescript
// packages/universo-database/base/src/pgBindings.ts

/**
 * Convert PostgreSQL $1, $2, ... placeholders to Knex ? format.
 * Handles repeated parameter references (e.g., $6, $6 → ?, ? with duplicated binding).
 * Handles casts (e.g., $1::text → ?::text).
 *
 * SAFE: Only matches $<digits> outside of PostgreSQL dollar-quoted strings ($$...$$).
 *
 * QA NOTE: The regex `/\$(\d+)/g` does NOT actually skip dollar-quoted strings.
 * This is safe in practice: dollar-quoted SQL appears ONLY in migration definitions
 * which have no params (bindings=[]), so the converter is bypassed. In persistence
 * stores, `$$` is JavaScript template literal syntax that evaluates to `$5`, `$6` etc.
 * at runtime (legitimate param placeholders). Remove the misleading claim from JSDoc.
 */
export function convertPgBindings(
    sql: string,
    params?: unknown[]
): { sql: string; bindings: unknown[] } {
    if (!params?.length) return { sql, bindings: [] }

    const hasDollarN = /\$(\d+)/.test(sql)
    const hasQuestionMark = sql.includes('?')

    // Guard: mixed placeholders are never valid
    if (hasDollarN && hasQuestionMark) {
        throw new Error(
            'Mixed ?/$N placeholders in a single SQL statement are not supported'
        )
    }

    // Pure ? SQL — pass params through unchanged (e.g., locking.ts style)
    if (!hasDollarN) {
        return { sql, bindings: [...params] }
    }

    // $N conversion path
    const bindings: unknown[] = []
    const convertedSql = sql.replace(/\$(\d+)/g, (_match, numStr: string) => {
        const paramIndex = parseInt(numStr, 10) - 1
        if (paramIndex < 0 || paramIndex >= params.length) {
            throw new Error(
                `Binding $${numStr} references index ${paramIndex} but only ${params.length} params provided`
            )
        }
        bindings.push(params[paramIndex])
        return '?'
    })

    return { sql: convertedSql, bindings }
}
```

### Integration in `knexExecutor.ts`

Both `createKnexExecutor` and `createRlsExecutor` call `convertPgBindings` before `knex.raw()`:

```typescript
import { convertPgBindings } from './pgBindings'

export function createKnexExecutor(knex: Knex): DbExecutor {
    return {
        query: async <T = unknown>(sql: string, params?: unknown[]) => {
            const { sql: knexSql, bindings } = convertPgBindings(sql, params)
            const result = await knex.raw(knexSql, bindings as Knex.RawBinding[])
            return (result.rows ?? result) as T[]
        },
        // ... transaction uses same pattern inside txExecutor
    }
}
```

### Why executor-level, not store-level conversion?

1. **Single point of change** — 1 file instead of 200+ queries.
2. **Preserves PostgreSQL-native SQL** — stores keep readable `$1` syntax (familiar to DB developers).
3. **Handles repeated params** — `$6, $6` patterns are transparently expanded.
4. **Backward compatible** — stores that already use `?` (like `locking.ts`) pass through unchanged (no `$N` to convert).
5. **Test-friendly** — existing mocks continue to work; new integration tests validate the conversion.

### Steps

- [ ] **1.1** Create `packages/universo-database/base/src/pgBindings.ts` with `convertPgBindings()`
- [ ] **1.2** Create `packages/universo-database/base/src/__tests__/pgBindings.test.ts` covering:
  - Simple `$1` → `?` conversion
  - Multiple parameters `$1, $2, $3`
  - Repeated parameters `$6, $6` → duplicated bindings
  - Cast syntax `$1::text`, `$1::uuid`
  - Mixed: `$1 AND $2 OR $1` → 3 bindings from 2 params
  - No params → passthrough
  - Out-of-range `$99` → error
  - Empty SQL → passthrough
  - SQL without any `$N` but with params → `?` passthrough (for stores already using `?`)
  - Mixed `?` + `$N` in same SQL → error thrown
  - Pure `?` SQL with params → bindings passed through unchanged
- [ ] **1.3** Update `createKnexExecutor()` to use `convertPgBindings()` in query and transaction paths
- [ ] **1.4** Update `createRlsExecutor()` to use `convertPgBindings()` in query path
- [ ] **1.5** Fix direct `getKnex().raw()` fallback in `permissionService.ts`:
  - The `runQuery()` helper falls back to `getKnex().raw(sql, params)` which bypasses the executor and `convertPgBindings`. All SQL in this file uses `$1` placeholders.
  - **Fix**: Replace with a pool executor: `const exec = createKnexExecutor(getKnex()); return exec.query<T>(sql, params)`
  - This ensures `convertPgBindings` is applied universally.
- [ ] **1.6** Re-export `convertPgBindings` from `@universo/database` index for any future direct-raw consumers
- [ ] **1.7** Run all existing tests → must remain green (executor mocks still work, new real behavior tested via pgBindings.test.ts)
- [ ] **1.8** Run `pnpm build` → 27/27 green

### Test Plan for Phase 1

```typescript
// pgBindings.test.ts examples
describe('convertPgBindings', () => {
    it('converts single $1 to ?', () => {
        const result = convertPgBindings('SELECT $1 AS val', ['abc'])
        expect(result).toEqual({ sql: 'SELECT ? AS val', bindings: ['abc'] })
    })

    it('handles repeated parameters', () => {
        const result = convertPgBindings(
            'INSERT INTO t (a, b, c, c_copy) VALUES ($1, $2, $3, $3)',
            ['a', 'b', 'c']
        )
        expect(result).toEqual({
            sql: 'INSERT INTO t (a, b, c, c_copy) VALUES (?, ?, ?, ?)',
            bindings: ['a', 'b', 'c', 'c']
        })
    })

    it('preserves casts', () => {
        const result = convertPgBindings("SELECT set_config('x', $1::text, false)", ['val'])
        expect(result).toEqual({
            sql: "SELECT set_config('x', ?::text, false)",
            bindings: ['val']
        })
    })

    it('throws on out-of-range parameter', () => {
        expect(() => convertPgBindings('SELECT $5', ['only-one']))
            .toThrow('Binding $5 references index 4 but only 1 params provided')
    })

    it('passes through SQL without $N placeholders', () => {
        const result = convertPgBindings('SELECT ? AS val', ['abc'])
        expect(result).toEqual({ sql: 'SELECT ? AS val', bindings: ['abc'] })
    })

    it('passes through pure ? SQL with params unchanged', () => {
        const result = convertPgBindings(
            'SELECT pg_try_advisory_xact_lock(?)', [12345]
        )
        expect(result).toEqual({
            sql: 'SELECT pg_try_advisory_xact_lock(?)',
            bindings: [12345]
        })
    })

    it('throws on mixed ?/$N placeholders', () => {
        expect(() => convertPgBindings('SELECT ? FROM t WHERE id = $1', ['a', 'b']))
            .toThrow('Mixed ?/$N placeholders')
    })

    it('passes through SQL with no params', () => {
        const result = convertPgBindings('SELECT 1')
        expect(result).toEqual({ sql: 'SELECT 1', bindings: [] })
    })
})
```

---

## Phase 2: Connection Strategy Fix (CRITICAL — RLS + advisory locks broken)

### Problem

Supabase UP-test uses **Supavisor in transaction mode** (port 6543):
- `set_config('request.jwt.claims', ..., false)` is session-scoped. In transaction mode, outside an explicit `BEGIN`/`COMMIT`, each statement may be routed to a different PG backend. The `set_config` call goes to backend A, but the next query might go to backend B — which has no claims set. **RLS fails silently** (returns empty results instead of errors).
- `pg_try_advisory_lock()` is session-level. The lock might be acquired on backend A, but subsequent DDL runs on backend B — **no mutual exclusion**.
- **Prepared statements are not supported** in transaction mode (not currently an issue since `knex.raw()` doesn't use prepared statements, but must be documented).

### Evidence

```
Supavisor config for UP-test (from MCP Supabase API):
  pool_mode: "transaction"
  db_port: 6543
  db_host: aws-0-eu-central-2.pooler.supabase.com
```

### Solution: Switch to session mode or direct connection

For a persistent Express server with a Knex connection pool (max 15), **session mode** or **direct connection** is the correct choice:

| Mode | Port | Session vars | Advisory locks | Prepared stmts | Best for |
|------|------|-------------|----------------|----------------|----------|
| Direct | 5432 (db host) | ✅ | ✅ | ✅ | Persistent servers |
| Session pooler | 5432 (pooler) | ✅ | ✅ | ✅ | Persistent servers + scaling |
| Transaction pooler | 6543 (pooler) | ❌ (only in txn) | ❌ (session-level) | ❌ | Serverless/edge |

**Recommended**: **Session mode pooler** (port 5432 via Supavisor) — combines connection pooling with full session variable support. Direct connection is acceptable for development/testing.

### Steps

- [ ] **2.1** Update `.env` / `.env.example` to document connection modes:
  ```env
  # RECOMMENDED: Session mode pooler (supports session variables for RLS + advisory locks)
  DATABASE_HOST=aws-0-eu-central-2.pooler.supabase.com
  DATABASE_PORT=5432
  DATABASE_USER=postgres.osnvhnawsmyfduygsajj

  # ALTERNATIVE: Direct connection (full PG access, limited to 60 connections on Nano tier)
  # DATABASE_HOST=db.osnvhnawsmyfduygsajj.supabase.co
  # DATABASE_PORT=5432

  # NOT RECOMMENDED for this app: Transaction mode pooler (no session vars / advisory locks)
  # DATABASE_PORT=6543
  ```
- [ ] **2.2** Update `KnexClient.ts` to warn more aggressively for port 6543:
  ```typescript
  if (isTransactionPooler) {
      console.error(
          '[KnexClient] ❌ Transaction pooler (port 6543) is NOT compatible with RLS session ' +
          'variables and advisory locks. Switch to session mode (port 5432 via pooler) or direct connection.'
      )
  }
  ```
- [ ] **2.3** Add connection mode validation at startup in `start-backend` that **fails fast** if transaction mode is detected and `ALLOW_TRANSACTION_POOLER` env is not set
- [ ] **2.4** Update `KnexClient.ts` pool `afterCreate` hook to set search_path and validate connection:
  ```typescript
  pool: {
      // ... existing settings ...
      afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
          conn.query(
              "SET search_path TO public, metahubs, applications, admin; SET statement_timeout TO '30s';",
              (err: Error | null) => done(err, conn)
          )
      }
  }
  ```
- [ ] **2.5** Document connection modes in `packages/universo-database/base/README.md`
- [ ] **2.6** Run integration test against UP-test with session mode to validate

### Potential Challenges

- **Supavisor session mode port**: Supabase session mode uses port 5432 on the pooler host (same port as direct). Verify the correct connection string format: `postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
- **Pool budget**: With session mode, each Knex pool connection pins a backend PG connection for the TCP session lifetime. Pool max should stay at 15 or below for Nano tier (60 max_connections with other services sharing).

---

## Phase 3: RLS Middleware Transaction Wrapping (HIGH — defense-in-depth)

### Problem

Even with session mode, `set_config(..., false)` leaves JWT claims on the connection after cleanup failure. The current cleanup resets claims, but if cleanup fails (process crash, unhandled exception), the next request using that pooled connection could inherit stale claims.

### Solution: Wrap entire RLS request lifecycle in an explicit transaction

Using `set_config(..., true)` **(transaction-local)** ensures claims auto-disappear on `COMMIT`/`ROLLBACK`, regardless of cleanup bugs:

```typescript
// ensureAuthWithRls.ts — enhanced flow:
// 1. Acquire dedicated connection
// 2. BEGIN
// 3. set_config('request.jwt.claims', payload, true)  ← transaction-local!
// 4. Route handler runs (all queries on same connection)
// 5. COMMIT  (or ROLLBACK on error)
// 6. Release connection
```

### Steps

- [ ] **3.1** Modify `ensureAuthWithRls.ts`:
  - After acquiring connection: `await knex.raw('BEGIN').connection(connection)`
  - Create RLS executor and set it on request
  - On response finish: `await knex.raw('COMMIT').connection(connection)` then release
  - On error/crash: `await knex.raw('ROLLBACK').connection(connection)` then release
- [ ] **3.2** Update `rlsContext.ts` to use `set_config(..., true)` (transaction-local):
  ```typescript
  await session.query(
      "SELECT set_config('request.jwt.claims', $1::text, true)",  // true = transaction-local
      [JSON.stringify(payload)]
  )
  ```
  Note: After Phase 1, `$1` will be auto-converted to `?` by the executor.
- [ ] **3.3** Update `createRlsExecutor` transaction handling to use SAVEPOINTs (since outer BEGIN already exists):
  - The executor's `transaction()` method should now always use `SAVEPOINT/RELEASE SAVEPOINT` (never raw `BEGIN/COMMIT` which would conflict with the middleware transaction)
  - Simplify: `txDepth` logic starts at 1 (already in a transaction)
- [ ] **3.4** Remove manual cleanup `set_config('request.jwt.claims', '', false)` from middleware — no longer needed since COMMIT auto-clears transaction-local config
- [ ] **3.5** Update `ensureAuthWithRls.test.ts`:
  - Assert `BEGIN` is called after connection acquisition
  - Assert `COMMIT` on success, `ROLLBACK` on error
  - Assert `set_config(..., true)` (not `false`)
  - Assert connection release happens after transaction end
- [ ] **3.6** Run all auth-backend tests → green
- [ ] **3.7** Update memory-bank patterns (systemPatterns.md, rls-integration-pattern.md)

### Example: Updated ensureAuthWithRls flow

```typescript
export function createEnsureAuthWithRls(knex: Knex) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // ... auth token validation ...

        let connection: any = null
        let committed = false

        try {
            connection = await knex.client.acquireConnection()
            
            // Begin transaction — claims will be transaction-local
            await knex.raw('BEGIN').connection(connection)

            // Create session and apply RLS context
            const session = createDbSession(knex, connection)
            await applyRlsContext(session, accessToken) // uses set_config(..., true)

            // Create executor — all queries run within this transaction
            const executor = createRlsExecutor(knex, connection, { inTransaction: true })
            req.dbContext = createRequestDbContext(session, executor)

            // Cleanup handler
            const cleanup = async () => {
                try {
                    if (!committed) {
                        await knex.raw('COMMIT').connection(connection)
                        committed = true
                    }
                } catch {
                    try { await knex.raw('ROLLBACK').connection(connection) } catch { /* best-effort */ }
                } finally {
                    knex.client.releaseConnection(connection)
                }
            }

            res.once('finish', cleanup)
            res.once('close', cleanup)
            next()
        } catch (err) {
            if (connection) {
                try { await knex.raw('ROLLBACK').connection(connection) } catch { /* best-effort */ }
                knex.client.releaseConnection(connection)
            }
            next(err)
        }
    }
}
```

### Potential Challenges

- **Long-running requests**: Since the entire request is wrapped in a PG transaction, long-running requests hold a transaction open. Mitigate with `SET LOCAL statement_timeout TO '30s'` at the beginning.
- **RLS executor nested transactions**: The executor's `transaction()` method must use SAVEPOINTs, not raw BEGIN/COMMIT. The current code already has savepoint support for `txDepth > 0` — we just need to adjust the initial depth.
- **Backward compatibility**: `set_config(..., true)` only works inside a transaction. Since we BEGIN before calling it, this is guaranteed. But if any code path calls `applyRlsContext` outside a transaction, it must be caught.

---

## Phase 4: Advisory Lock Safety (HIGH — DDL consistency)

### Problem

`pg_try_advisory_lock()` acquires a **session-level** lock. In session mode pooler, this is tied to the backend PG connection assigned to the Knex pool connection's TCP session. This is generally safe but:
1. If the Knex pool connection is destroyed (timeout, error), the lock is silently released.
2. Advisory lock cleanup depends on `pg_advisory_unlock()` on the same connection — if the connection drops, the lock is released but the process doesn't know.

### Solution: Use transaction-level advisory locks

```sql
-- Before (session-level, persists until explicit unlock or disconnect):
SELECT pg_try_advisory_lock(hashtextextended($1, 0))

-- After (transaction-level, auto-released on COMMIT/ROLLBACK):
SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0))
```

### Steps

> **QA Note**: `runner.ts` already uses `pg_advisory_xact_lock` in `withTransactionLock` (line 72). Only `withSessionLock` (line 89) and `schema-ddl/locking.ts` use session-level `pg_try_advisory_lock` and need this change. Both files already use `?` placeholders (correct for knex).

- [ ] **4.1** Update `schema-ddl/locking.ts` `buildLockSql()`:
  - Use `pg_try_advisory_xact_lock` instead of `pg_try_advisory_lock`
  - Wrap lock acquisition + usage in explicit `BEGIN/COMMIT` transaction block
  - Remove explicit `pg_advisory_unlock()` (handled by COMMIT)
- [ ] **4.2** Update `migrations-core/runner.ts` `withSessionLock` helper only:
  - Change `pg_try_advisory_lock` → `pg_try_advisory_xact_lock` (line 89)
  - Wrap migration execution in transaction on the lock connection
  - Keep `withTransactionLock` unchanged (already uses `pg_advisory_xact_lock`)
- [ ] **4.3** Update `locking.test.ts` and `runner.test.ts`:
  - Verify `pg_try_advisory_xact_lock` is called in affected code paths
  - Verify lock auto-releases on COMMIT/ROLLBACK
  - Verify no explicit `pg_advisory_unlock` call in session-lock path
- [ ] **4.4** Remove `lockConnections` Map tracking in `withSessionLock` (no longer needed — lock lifetime = transaction lifetime)
- [ ] **4.5** Update `schema-ddl/README.md` locking section

### Potential Challenges

- **Lock duration**: Transaction-level locks are held for the entire transaction. For long DDL operations (schema cloning), this is acceptable since the lock exists specifically to serialize DDL.
- **Nested locks**: Multiple advisory locks within the same transaction are supported by PostgreSQL. No changes needed.

---

## Phase 5: RLS Policy Performance Optimization (MEDIUM — production performance)

### Problem

All 16 RLS policies in UP-test use direct function calls:
```sql
-- Current (SLOW — function evaluated per row):
auth.uid() = user_id

-- Recommended by Supabase (up to 99.99% faster — cached per statement):
(select auth.uid()) = user_id
```

Similarly, `admin.is_superuser(auth.uid())` is called without subquery wrapping.

### Steps

- [ ] **5.1** Create a platform migration in `@universo/migrations-platform` that rewrites all 16 RLS policies:
  ```sql
  -- Example for applications.applications:
  DROP POLICY IF EXISTS "Allow users to manage their own applications" ON applications.applications;
  CREATE POLICY "Allow users to manage their own applications" ON applications.applications
    FOR ALL TO public
    USING (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM applications.applications_users au
        WHERE au.application_id = applications.id
        AND au.user_id = (select auth.uid())
      )
      OR (select admin.is_superuser((select auth.uid())))
    );
  ```
- [ ] **5.2** Apply same `(select ...)` wrapping to ALL policies across:
  - `applications.applications` (1 policy)
  - `applications.applications_users` (1 policy)
  - `applications.connectors` (1 policy)
  - `applications.connectors_publications` (1 policy)
  - `metahubs.metahubs` (1 policy)
  - `metahubs.metahubs_branches` (1 policy)
  - `metahubs.metahubs_users` (1 policy)
  - `metahubs.publications` (1 policy)
  - `metahubs.publications_versions` (1 policy)
  - `metahubs.templates` (2 policies — read + write)
  - `metahubs.templates_versions` (2 policies — read + write)
  - `public.profiles` (3 policies — select + update + insert)
- [ ] **5.3** Use `authenticated` role instead of `public` where possible:
  ```sql
  -- Before (applies even to unauthenticated access):
  TO public
  -- After (only applies to logged-in users):
  TO authenticated
  ```
  Keep `public` only for genuinely public data (templates read, public applications).
- [ ] **5.4** Verify policies via `EXPLAIN ANALYZE` on representative queries
- [ ] **5.5** Add test in platform migrations that validates all policies exist after migration

### Potential Challenges

- **Migration ordering**: The new migration must run AFTER all existing table-creation migrations. Use a timestamp after the latest existing migration.
- **Rollback**: Include a `down()` migration that restores the original policies.

---

## Phase 6: RLS Executor Bypass Fix (MEDIUM — security gap)

### Problem

`applications-backend/connectorsRoutes.ts` has two helpers — `query()` and `transaction()`. The `transaction()` helper **always** uses `getDbExecutor()` (root pool executor without RLS), while `query()` tries the RLS session first and falls back to pool executor if unavailable.

Specific bypass points:
- `transaction()` helper: always creates transactions via `getDbExecutor().transaction()`, bypassing RLS completely
- Line 257: `getDbExecutor().transaction()` for connector creation — security-critical CRUD without RLS
- `query()` helper fallback: if `req.dbSession` is undefined, silently falls back to pool executor

> **QA Note**: The `transaction()` helper pattern exists because the RLS executor's `transaction()` creates SAVEPOINTs (within the already-open pinned connection), not true top-level transactions. This is an architectural limitation, not simply a bug. The fix should create a proper transaction path within the RLS pinned connection.

### Steps

- [ ] **6.1** Audit all routes in `connectorsRoutes.ts` and `applicationsRoutes.ts`:
  - Identify all `getDbExecutor()` usages
  - Determine if each is intentional (admin/bootstrap) or a security gap (should use RLS)
- [ ] **6.2** For connector CRUD: use RLS executor's transaction capability (SAVEPOINT-based within pinned connection) instead of pool-level transaction. If a true top-level transaction is required, wrap the pinned connection in explicit `BEGIN/COMMIT`:
  ```typescript
  // Before:
  return getDbExecutor().transaction(async (txExec) => { ... })
  
  // After (within RLS pinned connection):
  const session = getRequestDbSession(req)
  return session.transaction(async (txExec) => { ... })
  ```
- [ ] **6.3** Add test coverage asserting RLS executor is used for connector CRUD
- [ ] **6.4** Run applications-backend tests → green

---

## Phase 7: Comprehensive Test Infrastructure (HIGH — prevents regressions)

### Problem

Current tests mock `knex.raw()` entirely. They validate logic flow but NOT:
- Knex binding format correctness
- Connection pinning behavior
- Transaction/savepoint semantics
- RLS claim propagation
- Advisory lock acquisition/release

### Solution: Add layered test infrastructure

#### 7A. `pgBindings` unit tests (Phase 1 already covers this)

#### 7B. Executor integration tests with real Knex formatting

```typescript
// packages/universo-database/base/src/__tests__/knexExecutor.integration.test.ts
describe('Executor Integration (requires PG)', () => {
    let knex: Knex
    
    beforeAll(async () => {
        knex = Knex({
            client: 'pg',
            connection: process.env.DATABASE_TEST_URL || 'postgresql://localhost:5432/test'
        })
        await knex.raw('CREATE TEMP TABLE _test_exec (id int, name text)')
    })
    
    afterAll(async () => {
        await knex.destroy()
    })

    it('pool executor handles $1-style params via conversion', async () => {
        const exec = createKnexExecutor(knex)
        await exec.query('INSERT INTO _test_exec VALUES ($1, $2)', [1, 'alice'])
        const rows = await exec.query<{ id: number; name: string }>(
            'SELECT * FROM _test_exec WHERE id = $1', [1]
        )
        expect(rows).toEqual([{ id: 1, name: 'alice' }])
    })

    it('pool executor handles ? params natively', async () => {
        const exec = createKnexExecutor(knex)
        const rows = await exec.query<{ val: string }>(
            'SELECT ?::text AS val', ['hello']
        )
        expect(rows).toEqual([{ val: 'hello' }])
    })

    it('RLS executor runs queries on pinned connection', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            const exec = createRlsExecutor(knex, connection)
            await exec.query('INSERT INTO _test_exec VALUES ($1, $2)', [2, 'bob'])
            const rows = await exec.query<{ name: string }>(
                'SELECT name FROM _test_exec WHERE id = $1', [2]
            )
            expect(rows).toEqual([{ name: 'bob' }])
        } finally {
            knex.client.releaseConnection(connection)
        }
    })

    it('RLS executor transaction uses SAVEPOINT for nested', async () => {
        const connection = await knex.client.acquireConnection()
        try {
            await knex.raw('BEGIN').connection(connection)
            const exec = createRlsExecutor(knex, connection, { inTransaction: true })
            
            await exec.transaction(async (txExec) => {
                await txExec.query('INSERT INTO _test_exec VALUES ($1, $2)', [3, 'carol'])
            })
            
            const rows = await exec.query<{ name: string }>(
                'SELECT name FROM _test_exec WHERE id = $1', [3]
            )
            expect(rows).toEqual([{ name: 'carol' }])
            
            await knex.raw('ROLLBACK').connection(connection)
        } finally {
            knex.client.releaseConnection(connection)
        }
    })
})
```

#### 7C. RLS middleware integration test

```typescript
// packages/auth-backend/base/src/tests/integration/rlsMiddleware.integration.test.ts
describe('RLS middleware integration', () => {
    it('sets and clears JWT claims within transaction', async () => {
        // Verify that:
        // 1. BEGIN is called
        // 2. set_config is called with true (transaction-local)
        // 3. Claims are visible during request
        // 4. COMMIT is called on finish
        // 5. Claims are NOT visible after COMMIT
    })

    it('rolls back on error', async () => {
        // Verify ROLLBACK is called when route handler throws
    })
})
```

#### 7D. Store SQL regression tests

For each persistence store, add a test that validates SQL compilation through the real `convertPgBindings` path:

```typescript
// packages/metahubs-backend/base/src/tests/persistence/sqlCompilation.test.ts
describe('Store SQL compilation', () => {
    it('all store queries produce valid Knex bindings', () => {
        // Import all store functions
        // Mock executor.query to capture SQL + params
        // Call each store function with representative data
        // Verify convertPgBindings(sql, params) succeeds for each
    })
})
```

### Steps

- [ ] **7.1** Create `knexExecutor.integration.test.ts` in `@universo/database` (requires PG for CI, uses temp tables)
- [ ] **7.2** Add `DATABASE_TEST_URL` env variable support and document in README
- [ ] **7.3** Create RLS middleware integration test in `@universo/auth-backend`
- [ ] **7.4** Create SQL compilation regression test for each backend persistence store
- [ ] **7.5** Add `test:integration` script to root `package.json` for CI
- [ ] **7.6** Ensure all 237+ existing tests remain green
- [ ] **7.7** Run all new tests → green

---

## Phase 8: KnexClient Hardening (LOW — operational safety)

### Steps

- [ ] **8.1** Add `afterCreate` pool hook for connection validation:
  ```typescript
  afterCreate: (conn, done) => {
      conn.query("SELECT 1", (err) => {
          if (err) {
              console.error('[KnexClient] Connection validation failed:', err.message)
          }
          done(err, conn)
      })
  }
  ```
- [ ] **8.2** Add connection health check helper:
  ```typescript
  export async function checkDatabaseHealth(): Promise<{
      connected: boolean
      latencyMs: number
      poolStatus: { used: number; free: number; pending: number }
  }> { /* ... */ }
  ```
- [ ] **8.3** Expose health check as `/api/v1/health/db` endpoint (for monitoring)
- [ ] **8.4** Add graceful shutdown hook that drains pool properly:
  ```typescript
  process.on('SIGTERM', async () => {
      console.log('[KnexClient] Graceful shutdown: draining pool...')
      await destroyKnex()
      process.exit(0)
  })
  ```
- [ ] **8.5** Document all env variables in `@universo/database/README.md`:
  - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
  - `DATABASE_POOL_MAX`, `DATABASE_KNEX_POOL_DEBUG`
  - `DATABASE_KNEX_ACQUIRE_TIMEOUT_MS`, `DATABASE_KNEX_IDLE_TIMEOUT_MS`, `DATABASE_KNEX_CREATE_TIMEOUT_MS`
  - `DATABASE_SSL`, `DATABASE_SSL_KEY_BASE64`
  - `ALLOW_TRANSACTION_POOLER` (escape hatch)
  - `DATABASE_TEST_URL` (for integration tests)

---

## Phase 9: Secrets Sanitization Completion (LOW — security hygiene)

### Problem

The tracked `.env` file at `packages/universo-core-backend/base/.env` may still contain real secrets despite previous sanitization pass. The committed `.env` must be placeholder-only.

### Steps

- [ ] **9.1** Audit ALL `.env` and `.env.example` files across all packages for real secrets
- [ ] **9.2** Replace any remaining real values with documented placeholders:
  ```env
  DATABASE_PASSWORD=<YOUR_DATABASE_PASSWORD>
  SUPABASE_JWT_SECRET=<YOUR_SUPABASE_JWT_SECRET>
  SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
  ```
- [ ] **9.3** Add `.env.local` to `.gitignore` (for real secrets in development)
- [ ] **9.4** Document the env setup flow in root README

---

## Phase 10: TypeORM Documentation & Comment Cleanup (LOW — codebase hygiene)

### Problem (identified during QA)

TypeORM has been fully removed from all source code (zero imports), but residual references remain:
- **9 code comments** across packages mentioning TypeORM as if it's still used
- **4 `.env` comments** referencing TypeORM pool budget settings
- **Outdated documentation**: AGENTS.md, `docs/en/contributing/creating-packages.md`, `.kiro/`, `.gemini/` still describe TypeORM-based architecture

### Steps

- [ ] **10.1** Update or remove TypeORM references in code comments (9 instances across packages)
- [ ] **10.2** Update `.env` comments to reflect Knex pool configuration instead of TypeORM
- [ ] **10.3** Update AGENTS.md to reflect current architecture (Knex + custom migration system)
- [ ] **10.4** Update `docs/en/contributing/creating-packages.md` to remove TypeORM entity/repository instructions
- [ ] **10.5** Clean up `.kiro/` and `.gemini/` AI instruction files referencing TypeORM
- [ ] **10.6** Verify no remaining stale TypeORM references via `grep -r "typeorm\|TypeORM" --include="*.ts" --include="*.md" --include="*.env"`

---

## Phase 11: Admin-Backend Soft-Delete Parity (MEDIUM — data audit compliance)

### Problem (identified during QA)

The soft-delete pattern (`_upl_deleted` / `_upl_deleted_by` columns, `UPDATE ... SET _upl_deleted = NOW()` instead of `DELETE`) was established in `metahubs-backend` and `applications-backend`, but `admin-backend` still uses **hard DELETE** for:
- `admin.roles` — `rolesStore.ts` line 188: `DELETE FROM admin.roles WHERE id = $1`
- `admin.role_permissions` — `rolesStore.ts` line 199: `DELETE FROM admin.role_permissions WHERE role_id = $1`
- `admin.locales` — `localesStore.ts` line 218: `DELETE FROM admin.locales WHERE id = $1`
- `admin.settings` — `settingsStore.ts` line 77: `DELETE FROM admin.settings WHERE category = $1 AND key = $2`

These tables currently have **NO soft-delete columns** in their schema definitions (`admin-backend/base/src/platform/migrations/index.ts`).

### Solution

Add soft-delete columns via platform migration, update stores and queries, add partial indexes to exclude deleted rows.

### Steps

- [ ] **11.1** Create a platform migration that adds soft-delete columns to admin tables:
  ```sql
  ALTER TABLE admin.roles
      ADD COLUMN IF NOT EXISTS _upl_deleted TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID DEFAULT NULL;

  ALTER TABLE admin.role_permissions
      ADD COLUMN IF NOT EXISTS _upl_deleted TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID DEFAULT NULL;

  ALTER TABLE admin.locales
      ADD COLUMN IF NOT EXISTS _upl_deleted TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID DEFAULT NULL;

  ALTER TABLE admin.settings
      ADD COLUMN IF NOT EXISTS _upl_deleted TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS _upl_deleted_by UUID DEFAULT NULL;
  ```
- [ ] **11.2** Add partial indexes excluding deleted rows (match metahubs/applications pattern):
  ```sql
  CREATE INDEX IF NOT EXISTS idx_roles_active ON admin.roles (id) WHERE _upl_deleted IS NULL;
  CREATE INDEX IF NOT EXISTS idx_locales_active ON admin.locales (id) WHERE _upl_deleted IS NULL;
  CREATE INDEX IF NOT EXISTS idx_settings_active ON admin.settings (category, key) WHERE _upl_deleted IS NULL;
  CREATE INDEX IF NOT EXISTS idx_role_permissions_active ON admin.role_permissions (role_id) WHERE _upl_deleted IS NULL;
  ```
- [ ] **11.3** Convert `deleteRole()` in `rolesStore.ts` to soft-delete:
  ```typescript
  // Before: DELETE FROM admin.roles WHERE id = $1
  // After: UPDATE admin.roles SET _upl_deleted = NOW(), _upl_deleted_by = $2 WHERE id = $1 AND _upl_deleted IS NULL
  ```
- [ ] **11.4** Convert `replaceRolePermissions()` cascade delete to soft-delete
- [ ] **11.5** Convert `deleteLocale()` in `localesStore.ts` to soft-delete
- [ ] **11.6** Convert `deleteSetting()` in `settingsStore.ts` to soft-delete
- [ ] **11.7** Update ALL `SELECT` queries in admin stores to add `WHERE _upl_deleted IS NULL` filter
- [ ] **11.8** Update route handler call sites to pass `userId` parameter
- [ ] **11.9** Update admin-backend tests to verify soft-delete SQL patterns
- [ ] **11.10** Run admin-backend tests + workspace build → green

### Potential Challenges

- **`role_permissions` junction table**: When a role is soft-deleted, its permission entries should also be soft-deleted (cascade). But when permissions are replaced (`replaceRolePermissions`), old entries should be hard-deleted since they're being replaced, not removed. Consider: soft-delete the old entries or truly replace them?
  - **Recommendation**: For `replaceRolePermissions`, soft-delete old entries and insert new ones. This preserves audit trail.
- **System roles (`is_system = true`)**: System roles should never be deletable. Add guard: `WHERE id = $1 AND is_system = false AND _upl_deleted IS NULL`.
- **Unique constraints**: `admin.roles.codename` has a UNIQUE constraint. After soft-delete, the codename is still occupied. Either:
  - Add partial unique index: `CREATE UNIQUE INDEX idx_roles_codename_active ON admin.roles (codename) WHERE _upl_deleted IS NULL`
  - Or accept that soft-deleted codenames cannot be reused (simpler).

---

## Phase 12: Full Acceptance & E2E Proof (HIGH — original TZ closure)

### Problem

Current tests are mostly unit/route-level and do not prove the full user-visible target scenario from the original TZ on a **fresh database**:
1. start the platform on a new DB
2. open `/metahubs`
3. create a metahub
4. create the first branch schema `mhb_*_b1`
5. configure a basic structure/template (for example, Shopping List)
6. create publication/version
7. create application + connector
8. create application schema `app_*`
9. verify runtime data/schema sync completes successfully

Without this proof, the repository can be green while the actual product journey is still broken.

### Steps

- [ ] **12.1** Add a deterministic fresh-database bootstrap script for QA runs:
    - Drops/recreates the test database or schema set
    - Runs platform migrations
    - Seeds only the minimal auth/admin/profile prerequisites
- [ ] **12.2** Add backend integration scenario tests that execute the core flow through existing APIs (no new UI):
    - create metahub
    - create first branch/runtime schema
    - create publication/version
    - create application/connector
    - verify `app_*` schema creation and migration history
- [ ] **12.3** Add one existing-UI smoke scenario using current frontend routes (`/metahubs`, current forms, current templates) rather than inventing any new components
- [ ] **12.4** Verify the resulting schemas match the expected contracts:
    - `metahubs` platform schema matches native SQL definition exactly
    - dynamic metahub branch schema `mhb_*_b1` is created and queryable
    - dynamic application schema `app_*` is created and queryable
- [ ] **12.5** Verify publication→connector→application sync copies the expected metadata/data and leaves no partial state on failure
- [ ] **12.6** Add an acceptance checklist script/documented command path for maintainers to rerun after major migration/runtime changes
- [ ] **12.7** Gate final closure of this remediation plan on this acceptance scenario passing on a fresh database

### Potential Challenges

- **Test speed**: Full acceptance on a fresh DB will be slower than route/unit tests; keep it in a dedicated QA target, not every small unit run.
- **Fixture minimization**: Reuse existing auth/admin bootstrap flows instead of introducing a parallel fake setup path.
- **No new UI debt**: The smoke path must use existing Metahubs and Applications frontends/routes only.

---

## Phase 13: Legacy Surface Removal Closure (MEDIUM — no leftover refactor debt)

### Problem

Production code is already TypeORM-free in the target runtime flow, but residual legacy-neutral naming still leaks the old architecture and creates avoidable maintenance debt:
- `admin-backend` still exports `isSuperuserByDataSource`, `canAccessAdminByDataSource`, `getGlobalRoleCodenameByDataSource`, `hasSubjectPermissionByDataSource`
- comments still mention `DataSource` / `static TypeORM entities` in neutral SQL code
- tests still use helper names like `buildDataSource()` even though they now mock SQL executors

This is not a runtime TypeORM dependency, but it is leftover refactor debt and should be removed if the goal is **no legacy code**.

### Steps

- [ ] **13.1** Replace `*ByDataSource` exports/usages with neutral names only (`isSuperuser`, `canAccessAdmin`, `getGlobalRoleCodename`, `hasSubjectPermission`)
- [ ] **13.2** Remove deprecated wrapper exports from `admin-backend/src/index.ts` after callers/tests are migrated
- [ ] **13.3** Rename legacy test helpers such as `buildDataSource()` to executor/session-oriented names so tests match the real architecture
- [ ] **13.4** Remove stale DataSource/TypeORM wording from production comments in neutral SQL utilities and guards
- [ ] **13.5** Re-run touched package tests after the API/name cleanup to ensure no hidden coupling remains

### Potential Challenges

- **Public API change**: If any internal package still imports the deprecated names, migrate all call sites in one pass to avoid dual-surface drift.
- **Test churn**: The rename is mostly mechanical, but it should be kept in the same cleanup phase so the repository stops teaching the wrong abstractions.

---

## Execution Order & Dependencies

```
Phase 1 (Binding Fix)
    ↓
Phase 2 (Connection Strategy)
    ↓
Phase 3 (RLS Transaction Wrapping) ← depends on Phase 1 (converted bindings) + Phase 2 (session mode)
    ↓
Phase 4 (Advisory Lock Safety) ← can run in parallel with Phase 3
    ↓
Phase 5 (RLS Policy Optimization) ← independent, can run anytime after Phase 2
    ↓
Phase 6 (Executor Bypass Fix) ← depends on Phase 1 + Phase 3
    ↓
Phase 7 (Test Infrastructure) ← depends on Phase 1-4 (tests validate all fixes)
    ↓
Phase 8 (KnexClient Hardening) ← independent
    ↓
Phase 9 (Secrets) ← independent
    ↓
Phase 10 (TypeORM Documentation Cleanup) ← independent
    ↓
Phase 11 (Admin Soft-Delete Parity) ← depends on Phase 1 (binding fix for new queries)
    ↓
Phase 12 (Acceptance & E2E Proof) ← depends on Phases 1-11 where relevant; final proof gate
    ↓
Phase 13 (Legacy Surface Removal) ← can run late, after functional correctness is stable
```

**Minimum viable fix**: Phase 1 + Phase 2 → application can start and serve requests.  
**Production-ready fix**: Phase 1 through Phase 7 → all security, performance, and correctness issues resolved.  
**Full technical debt closure**: Phase 1 through Phase 13 → zero remaining known issues.

---

## Verification Checkpoints

### After Phase 1
- [ ] `pnpm build` → 27/27 green
- [ ] All existing unit tests pass
- [ ] New `pgBindings.test.ts` passes
- [ ] Manual verification: `createKnexExecutor(knex).query('SELECT $1::text AS val', ['hello'])` returns `[{ val: 'hello' }]`

### After Phase 2
- [ ] Application starts against UP-test with session mode (port 5432)
- [ ] KnexClient logs `poolerMode: 'session/direct'`
- [ ] TemplateSeeder runs successfully (no "Expected N bindings" errors)

### After Phase 3
- [ ] RLS middleware sets claims within transaction
- [ ] Stale claims cannot leak to subsequent requests
- [ ] All existing auth-backend tests pass + new integration tests pass

### After Phase 4
- [ ] Advisory locks work correctly on session mode connection
- [ ] Schema DDL operations are properly serialized
- [ ] Lock auto-releases on transaction commit

### After Phase 5
- [ ] `EXPLAIN ANALYZE` shows index scan (not seq scan + filter) on policy queries
- [ ] All RLS policies use `(select auth.uid())` subquery pattern

### After Phase 7
- [ ] Integration tests pass against real PostgreSQL
- [ ] SQL compilation tests cover all 200+ store queries
- [ ] CI can run integration tests with `DATABASE_TEST_URL`

### After Phase 12
- [ ] Fresh-database acceptance scenario passes end to end
- [ ] Existing `/metahubs` flow creates a metahub and first branch schema successfully
- [ ] Publication/version → connector → application flow creates `app_*` schema successfully
- [ ] No partial metadata/runtime state remains after forced failure scenarios

### Final Verification
- [ ] `pnpm build` → all packages green
- [ ] `pnpm test` → all tests green (unit + integration)
- [ ] Application starts, logs in, navigates to /metahubs, /applications, /profile — all functional
- [ ] Memory bank updated with new patterns and completion status

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `convertPgBindings` regex misses edge case | High | Extensive unit tests + SQL compilation regression tests for all stores |
| Session mode pooler behaves differently than expected | Medium | Test against UP-test before deploying; keep direct connection as fallback |
| RLS transaction wrapping adds latency | Low | Transaction overhead is ~1ms; request handler already does multiple queries |
| Advisory lock mode change causes DDL race | Medium | Run DDL tests before and after change; use pg_try_advisory_xact_lock retry |
| Policy migration breaks existing data access | High | Test migration in staging; include rollback migration |
| Admin soft-delete migration breaks unique constraints | Medium | Use partial unique indexes (`WHERE _upl_deleted IS NULL`) to allow reuse of codenames |

---

## i18n Notes

All new error messages, log messages, and user-facing text must be internationalized:
- Error messages for binding validation: add to `@universo/i18n` under `database.errors.*`
- Health check responses: localized via existing error middleware
- Connection mode warnings: server-side only (English OK for logs)

---

## Changes to Shared Packages

| Package | Changes | Export Changes |
|---------|---------|---------------|
| `@universo/database` | `convertPgBindings`, updated executors, health check | New export: `convertPgBindings` |
| `@universo/utils` | No changes | — |
| `@universo/types` | No changes | — |
| `@universo/migrations-platform` | New migration: RLS policy optimization | New migration file |
| `@universo/schema-ddl` | Advisory lock mode update | No export changes |
| `@universo/migrations-core` | Advisory lock mode update | No export changes |
| Various backend packages | Phase 10: TypeORM comment cleanup | No export changes |
| AGENTS.md, docs/ | Phase 10: documentation updates | — |
| `@universo/admin-backend` | Phase 11: soft-delete columns + store updates | No export changes |
| `@universo/migrations-platform` | Phase 11: admin soft-delete DDL migration | New migration file |
| Existing backend/frontend test suites | Phase 12: full acceptance coverage using existing routes/UI | No new UI components |
| `@universo/admin-backend`, neutral SQL utilities | Phase 13: remove deprecated DataSource-named surface | Export cleanup |

---

## Estimated Complexity

- **Phase 1**: Level 2 (focused change, well-scoped, high test coverage)
- **Phase 2**: Level 1 (configuration change + documentation)
- **Phase 3**: Level 3 (middleware refactor with careful state management)
- **Phase 4**: Level 2 (lock mode change with test updates)
- **Phase 5**: Level 2 (SQL migration with rollback)
- **Phase 6**: Level 1 (route audit + executor swap)
- **Phase 7**: Level 3 (test infrastructure, CI integration)
- **Phase 8**: Level 1 (utility additions)
- **Phase 9**: Level 1 (config cleanup)
- **Phase 10**: Level 1 (documentation cleanup, grep + replace)
- **Phase 11**: Level 2 (admin DDL migration + store queries + tests)
- **Phase 12**: Level 3 (fresh-db acceptance harness + end-to-end proof)
- **Phase 13**: Level 1 (legacy API/comment cleanup)
