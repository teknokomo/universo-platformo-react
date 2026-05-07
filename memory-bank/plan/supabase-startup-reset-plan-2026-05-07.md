# Plan: Startup Supabase Full Reset via Environment Configuration

**Date:** 2026-05-07
**Status:** QA-Reviewed — Pending User Approval
**QA Date:** 2026-05-07

---

## Overview

Enable a runtime-configurable full Supabase database reset at platform startup via the `.env` / `.env.example` configuration files. This reuses the proven E2E cleanup logic from `e2eFullReset.mjs` but adapts it for the production startup path in `packages/universo-core-backend/base/src/`. The feature gives users a safe, logged, advisory-locked way to wipe all platform data and start fresh — useful for manual testing, demo resets, and cleaning up stale databases.

---

## Affected Areas

| Area | Files / Packages |
|---|---|
| **Backend startup** | `packages/universo-core-backend/base/src/index.ts` |
| **New module** | `packages/universo-core-backend/base/src/bootstrap/startupReset.ts` |
| **Environment config** | `packages/universo-core-backend/base/.env.example`, `.env` |
| **Database utils** | `packages/universo-database` (getPoolExecutor, getKnex), `packages/universo-utils/database` (withAdvisoryLock, queryMany) |
| **Admin client** | `packages/universo-core-backend/base/src/utils/supabaseAdmin.ts` (reuse existing `createSupabaseAdminClient`) |
| **Migrations platform** | `packages/universo-migrations-platform` (reuse `registeredSystemAppDefinitions`) |
| **Tests** | New `__tests__/startupReset.test.ts`, updated `__tests__/App.initDatabase.test.ts` |
| **Documentation** | `docs/ru/getting-started/configuration.md`, `docs/en/getting-started/configuration.md` |
| **Memory bank** | `memory-bank/progress.md`, `memory-bank/tasks.md` |

---

## Plan Steps

### Phase 1: Environment Configuration

#### Step 1.1 — Add "Danger Zone" block to `.env.example`

Add a new section at the **bottom** of `.env.example` with a clearly labeled danger zone:

```env
############################################################################################################
########################################### DANGER ZONE ####################################################
############################################################################################################

# ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
# ║  WARNING: FULL DATABASE RESET                                                             ║
# ║                                                                                             ║
# ║  Enabling FULL_DATABASE_RESET will COMPLETELY DESTROY all platform data on startup:        ║
# ║  - All project-owned schemas (app_*, mhb_*, fixed schemas) will be dropped                 ║
# ║  - All Supabase auth users will be deleted                                                 ║
# ║  - All local run artifacts will be removed                                                 ║
# ║                                                                                             ║
# ║  ⚠ It is STRONGLY RECOMMENDED to create a database backup before enabling this option.     ║
# ║  This action is IRREVERSIBLE.                                                              ║
# ╚═════════════════════════════════════════════════════════════════════════════════════════════╝
#
# FULL_DATABASE_RESET: Perform a complete database reset before platform initialization
# Default: false
# This is intended for development/demo/testing purposes only.
# NEVER enable this in production.
#
# FULL_DATABASE_RESET=false
```

**Why separate section at the bottom?** The `.env.example` follows a logical ordering pattern: common config → database → auth → session → storage → danger zone. Keeping destructive options isolated and at the end makes them hard to miss and easy to avoid.

#### Step 1.2 — Add the same block to `.env`

Mirror the block in the active `.env` file with `FULL_DATABASE_RESET=false` (disabled by default).

---

### Phase 2: Startup Reset Module

#### Step 2.1 — Create `src/bootstrap/startupReset.ts`

Create a new module that implements the full reset logic. This reuses the **same algorithmic approach** as `e2eFullReset.mjs` but uses the project's TypeScript/DbExecutor stack:

```typescript
// packages/universo-core-backend/base/src/bootstrap/startupReset.ts

import logger from '../utils/logger'
import { getPoolExecutor } from '@universo/database'
import { createSupabaseAdminClient } from '../utils/supabaseAdmin'
import { withAdvisoryLock, queryMany } from '@universo/utils/database'
import { registeredSystemAppDefinitions } from '@universo/migrations-platform'
```

**Key design decisions (QA-verified):**

1. **DbExecutor, not Knex directly** — QA found that `packages/universo-core-backend` uses `DbExecutor.query()` for all SQL, never `knex.raw()` directly. The plan correctly uses `getPoolExecutor()` + `withAdvisoryLock` which gives a `DbExecutor` transaction (`tx`). All schema discovery and DROP operations use `tx.query(sql, params)` with `$1` parameterized bindings, consistent with the project's SQL-first pattern.

2. **Advisory lock** — Uses `withAdvisoryLock` from `@universo/utils/database` — the exact same API used by `bootstrapSuperuser.ts`:
   ```typescript
   withAdvisoryLock<T>(executor: DbExecutor, lockKey: string, work: (tx: DbExecutor) => Promise<T>, options?: { timeoutMs?: number }): Promise<T>
   ```
   Uses `getPoolExecutor()` as the executor (proven pattern from bootstrap).

3. **Schema safety** — Same validation rules as E2E:
   - Only drop schemas matching `app_*`, `mhb_*`, or registered fixed project schemas
   - Never drop `public` or other infrastructure schemas
   - Validate each schema name against `FIXED_SCHEMA_NAME_PATTERN`

4. **Fixed schema discovery** — Import `registeredSystemAppDefinitions` directly from `@universo/migrations-platform` (verified: this is the correct public export name). Extract fixed schemas the same way as E2E's `loadFixedProjectSchemaNames()`.

5. **Auth user deletion** — Use `supabaseAdmin.auth.admin.deleteUser(userId)` via `createSupabaseAdminClient` — the exact same method used in `index.ts` (line 290), `admin-backend/authUserProvisioningService.ts`, and E2E `api-session.mjs`.

6. **Drop order** — Dynamic schemas first (app_\*, mhb_\*), then fixed schemas (excluding upl_migrations), then upl_migrations last — same as E2E `buildSchemaDropOrder`.

7. **DROP SCHEMA precedent** — QA found 13 instances of `DROP SCHEMA IF EXISTS ... CASCADE` across production code (migrations, runtime schema deletion in schema-ddl, metahubs-backend, applications-backend). The pattern `DROP SCHEMA IF EXISTS "schema_name" CASCADE` with identifier quoting is well-established.

#### Step 2.2 — Load fixed schema names from migrations platform

```typescript
function loadFixedProjectSchemaNames(): string[] {
  const definitions = registeredSystemAppDefinitions ?? []
  const fixedSchemas = definitions
    .flatMap((def) =>
      def?.schemaTarget?.kind === 'fixed' && typeof def.schemaTarget.schemaName === 'string'
        ? [def.schemaTarget.schemaName]
        : []
    )
    .filter((name) => !INFRASTRUCTURE_SCHEMAS.has(name))
    .concat('upl_migrations')

  const unique = Array.from(new Set(fixedSchemas)).sort()
  for (const name of unique) {
    if (!FIXED_SCHEMA_NAME_PATTERN.test(name)) {
      throw new Error(`Unsafe fixed project schema name: ${name}`)
    }
  }
  return unique
}
```

#### Step 2.3 — Implement the reset execution flow

All SQL operations use `tx.query()` (the `DbExecutor` provided by `withAdvisoryLock`), NOT `knex.raw()`.

```typescript
export async function executeStartupFullReset(): Promise<StartupResetReport | { enabled: false; status: 'disabled' }> {
  const config = getStartupResetConfig()
  if (!config.enabled) {
    logger.info('[startup-reset]: Full database reset is disabled')
    return { enabled: false, status: 'disabled' }
  }

  assertNotProduction()

  logger.warn('⚠️ [startup-reset]: FULL DATABASE RESET IS ENABLED — all data will be destroyed!')

  const fixedProjectSchemas = loadFixedProjectSchemaNames()

  return withAdvisoryLock(
    getPoolExecutor(),
    STARTUP_RESET_LOCK_KEY,
    async (tx) => {
      // 1. Ensure public schema exists
      await tx.query('CREATE SCHEMA IF NOT EXISTS public')

      // 2. Enumerate current state (using tx.query, not knex.raw)
      const beforeState = await inspectDatabaseState(tx, fixedProjectSchemas)

      // 3. Drop schemas in safe order (using tx.query)
      const dropResults = await dropProjectSchemas(tx, beforeState.ownedSchemas, fixedProjectSchemas)

      // 4. Delete all auth users (using Supabase Admin API)
      const deleteResults = await deleteAllAuthUsers(config)

      // 5. Re-ensure public schema exists after drops
      await tx.query('CREATE SCHEMA IF NOT EXISTS public')

      // 6. Verify post-reset state
      const afterState = await inspectDatabaseState(tx, fixedProjectSchemas)

      // 7. Build and return report
      const report = buildReport({ fixedProjectSchemas, beforeState, afterState, dropResults, deleteResults })

      if (hasProjectOwnedResidue(afterState)) {
        throw new Error(
          `Startup reset incomplete: residual schemas=${afterState.ownedSchemaCount}, auth users=${afterState.authUserCount}`
        )
      }

      logger.info('[startup-reset]: Full reset completed', {
        droppedSchemas: dropResults.length,
        deletedAuthUsers: deleteResults.length
      })

      return report
    },
    { timeoutMs: STARTUP_RESET_LOCK_TIMEOUT_MS }
  )
}
```

**QA correction**: The original plan used `knex.raw()` for SQL operations. QA verified that `packages/universo-core-backend` consistently uses `DbExecutor.query()` with `$1` parameterized bindings, never `knex.raw()`. All operations inside `withAdvisoryLock` use `tx` (the `DbExecutor` from the transaction).

---

### Phase 3: Integration into Startup Sequence

#### Step 3.1 — Hook into `App.initDatabase()` in `index.ts`

The reset must happen **before** any migration or bootstrap logic:

```typescript
// In App.initDatabase(), BEFORE the existing try block content:
async initDatabase() {
  try {
    // ═══ NEW: Full database reset (if enabled) ═══
    await executeStartupFullReset()

    logger.info('📦 [server]: Knex is initializing...')
    // ... rest of existing initDatabase() unchanged
```

**Why here and not in `start.ts`?** Because `initDatabase()` is the single entry point for database initialization. The reset needs to run before Knex migrations, system app schema generation, and bootstrap. Placing it here ensures the database is clean before any initialization logic runs.

**Why before `initKnex()` completes?** `initKnex()` is already called in `start.ts` before `Server.start()`. The reset uses the already-initialized Knex pool.

#### Step 3.2 — Ensure Knex is available before reset

In `start.ts`, Knex is already initialized before `Server.start()` is called:

```typescript
async run(): Promise<void> {
  // ...
  initKnex()        // ← Knex ready here
  await Server.start()  // ← initDatabase() called inside
}
```

This is correct — `executeStartupFullReset()` will use `getKnex()` which is available.

---

### Phase 4: Safety Measures

#### Step 4.1 — Multiple safety guards

1. **Off by default** — `FULL_DATABASE_RESET=false` unless explicitly enabled
2. **Environment variable gating** — Only reads from process.env, not from URL params or API calls
3. **Advisory lock** — Prevents concurrent resets
4. **Schema name validation** — Regex validation prevents SQL injection via schema names
5. **Infrastructure protection** — Never drops `public` schema
6. **Supabase URL/Key required** — Won't run without proper Supabase admin credentials
7. **Comprehensive logging** — Every step logged at WARN level
8. **Post-reset verification** — Inspects state after reset and reports residuals
9. **Auto-disable** — After reset completes, the env var still reads `true` but the reset won't run again until next startup (idempotent check via advisory lock)

#### Step 4.2 — Guard against production use

```typescript
function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FULL_DATABASE_RESET is not allowed in production environment. ' +
      'Set NODE_ENV to development or remove FULL_DATABASE_RESET=true.'
    )
  }
}
```

This is a defense-in-depth measure. Even if someone accidentally sets `FULL_DATABASE_RESET=true` in production, it will refuse to execute.

---

### Phase 5: Testing Strategy

#### Step 5.1 — Unit tests for startupReset module (`__tests__/startupReset.test.ts`)

Test cases:
1. **Config parsing**
   - Returns disabled when env var is unset/false
   - Returns enabled when env var is true with valid config
   - Throws when enabled but SUPABASE_URL missing
   - Throws when enabled but SERVICE_ROLE_KEY missing

2. **Schema name validation**
   - Accepts valid fixed schema names (e.g., `admin`, `profiles`)
   - Accepts valid dynamic schema names (e.g., `app_abc123`, `mhb_xyz789`)
   - Rejects names with special characters, SQL injection attempts
   - Never includes `public` in droppable list

3. **Schema drop order**
   - Dynamic app schemas come first
   - Dynamic mhb schemas come second
   - Fixed schemas come third (excluding upl_migrations)
   - upl_migrations comes last

4. **Reset execution flow**
   - Does nothing when disabled
   - Executes full flow when enabled
   - Handles partial failures gracefully (reports failures but doesn't throw mid-drop)
   - Verifies post-reset state

5. **Production guard**
   - Throws when NODE_ENV=production and reset enabled

#### Step 5.2 — Update `App.initDatabase.test.ts`

Add test cases:
1. Reset is not called when `FULL_DATABASE_RESET` is unset
2. Reset is called before migrations when enabled
3. Init sequence continues normally after reset
4. Init fails if reset fails

#### Step 5.3 — Integration test considerations

The actual destructive reset cannot be safely tested in unit tests (requires real database). The existing E2E infrastructure (`e2eFullReset.mjs`) already covers this at the integration level. The startup reset reuses the same algorithm, so:
- Unit tests mock the database layer and verify logic
- E2E tests validate the full reset against a real database
- Manual testing via `.env` toggle validates the startup integration

---

### Phase 6: Documentation

#### Step 6.1 — Update configuration docs

Update `docs/ru/getting-started/configuration.md` and `docs/en/getting-started/configuration.md`:
- Add a "Danger Zone" section describing `FULL_DATABASE_RESET`
- Document the safety measures and recommended backup procedure
- Add example workflow for manual database reset

#### Step 6.2 — Update `.env.example` comments

Already covered in Phase 1 — the comments in `.env.example` serve as inline documentation.

---

## Potential Challenges

### Challenge 1: DbExecutor vs raw `pg` Client (RESOLVED by QA)

The E2E reset uses `pg.Client` directly for SQL operations. The startup reset uses `DbExecutor.query()` via `withAdvisoryLock` → `getPoolExecutor()`. QA verified this is the correct pattern — `bootstrapSuperuser.ts` uses the identical approach, and `packages/universo-core-backend` has zero `knex.raw()` calls in production code. The `withAdvisoryLock` API provides a transaction-scoped `DbExecutor` (`tx`) as the callback parameter, which is exactly what we need.

### Challenge 2: Advisory Lock API Compatibility (RESOLVED by QA)

Verified: `withAdvisoryLock` signature is `withAdvisoryLock<T>(executor: DbExecutor, lockKey: string, work: (tx: DbExecutor) => Promise<T>, options?: { timeoutMs?: number })`. The `getPoolExecutor()` returns `DbExecutor`. This pattern is already used in `bootstrapSuperuser.ts` — proven and safe.

### Challenge 3: Fixed Schema Discovery at Startup (RESOLVED by QA)

Verified: `registeredSystemAppDefinitions` is the correct public export name from `@universo/migrations-platform`. The backend already imports from this package in `initDatabase()` (via `validateRegisteredSystemAppDefinitions`, `validateRegisteredSystemAppSchemaGenerationPlans`, etc.), so it's guaranteed to be built and available at startup.

### Challenge 4: Cascade Effects

Dropping schemas with `CASCADE` will also drop all dependent objects (tables, functions, triggers). This is intentional — it's the same behavior as the E2E reset. **Mitigation:** Post-reset verification catches any residual state. QA found 13 existing `DROP SCHEMA ... CASCADE` instances in production code, confirming this pattern is well-established.

### Challenge 5: Auth User Deletion Timing

Auth users are stored in Supabase's `auth.users` table, managed by Supabase Auth service. We delete them via the Admin API (`supabaseAdmin.auth.admin.deleteUser(userId)`), not SQL. QA verified this exact method is used in `index.ts` (line 290), `admin-backend/authUserProvisioningService.ts`, and E2E `api-session.mjs`. Need to handle rate limits or timeouts — iterate with error handling per user, report failures but continue (same as E2E).

### Challenge 6: Transaction Pooler Incompatibility (NEW — identified by QA)

The `withAdvisoryLock` function uses `pg_advisory_xact_lock` which requires session-level PostgreSQL connections. If the user is connected via Supabase transaction pooler (port 6543), advisory locks won't work. The `KnexClient.ts` already has a guard that throws an error when `DATABASE_PORT=6543` unless `ALLOW_TRANSACTION_POOLER=true`. This is sufficient protection — the startup reset will fail early with a clear error message if the connection is incompatible.

---

## QA Review Report

**Review Date:** 2026-05-07
**Reviewer:** QA Mode
**Verdict:** Plan requires corrections (addressed below)

### Issues Found and Resolved

#### Issue 1: Incorrect database access pattern (CRITICAL — Fixed)

**Problem:** The original plan proposed using `getKnex().raw()` for SQL operations. QA verified that `packages/universo-core-backend` has **zero** `knex.raw()` calls in production code. All SQL goes through `DbExecutor.query()` with `$1` parameterized bindings.

**Fix:** All SQL operations now use `tx.query(sql, params)` — the `DbExecutor` provided by `withAdvisoryLock`'s transaction callback.

#### Issue 2: Incorrect advisory lock usage (CRITICAL — Fixed)

**Problem:** The original plan had ambiguous advisory lock code with comments like "Use getPoolExecutor() or knex directly" and mixed `knex`/`tx` usage inside the lock callback.

**Fix:** Now uses the exact proven pattern from `bootstrapSuperuser.ts`:
```typescript
withAdvisoryLock(getPoolExecutor(), LOCK_KEY, async (tx) => { /* all ops use tx */ })
```

#### Issue 3: parseEnvBoolean duplication (MODERATE — Follows existing pattern)

**Observation:** `parseEnvBoolean` is duplicated in 3 locations (`adminConfig.ts`, `globalMigrationCatalogConfig.ts`, `bootstrapSuperuser.ts`). The plan introduces another local copy.

**Decision:** Acceptable — follows the established project convention of keeping `parseEnvBoolean` local to each config module. Centralization would be a separate cleanup task.

#### Issue 4: Local artifacts cleanup omitted from scope (MODERATE — By design)

**Observation:** The E2E full reset also cleans local artifacts (`run-manifest.json`, `storage-state.json`). The startup reset does not include this step.

**Decision:** Correct omission. These artifacts are E2E-specific files (Playwright storage state, test run manifest). A production startup reset has no such artifacts to clean.

#### Issue 5: `start.ts` listed as affected but not actually modified (MINOR — Fixed)

**Problem:** The affected areas table listed `src/commands/start.ts` as a file to modify, but no changes are needed there. Knex is already initialized before `Server.start()` in the existing code.

**Fix:** Removed from affected areas.

### Requirements Coverage Check

| Requirement | Covered? | Notes |
|---|---|---|
| Reuse existing E2E cleanup logic | YES | Same algorithm: schema discovery, drop order, auth user deletion |
| Activation via `.env` / `.env.example` | YES | `FULL_DATABASE_RESET` env var |
| Separate "Danger Zone" block | YES | Dedicated section at bottom of `.env.example` with box drawing warnings |
| Warning about data destruction | YES | Box drawing + text in `.env.example` + startup WARN log |
| Recommendation to create backup | YES | Explicitly stated in `.env.example` comments |
| Works for manual testing | YES | Set env var, start platform — clean DB ready |
| Works for "zeroing old data" | YES | Full reset then re-initialization via normal startup |
| Safe (no accidental triggers) | YES | Off by default, production guard, advisory lock, schema validation |

### Architecture Verification

| Aspect | Verdict | Evidence |
|---|---|---|
| Uses existing `withAdvisoryLock` | PASS | Same API as `bootstrapSuperuser.ts` |
| Uses existing `getPoolExecutor()` | PASS | Same pattern as bootstrap |
| Uses existing `createSupabaseAdminClient` | PASS | Same client as `index.ts`, `bootstrapSuperuser.ts` |
| Uses existing `registeredSystemAppDefinitions` | PASS | Same import as `e2eFullReset.mjs` |
| Uses `DbExecutor.query()` not `knex.raw()` | PASS | Corrected from original plan |
| No new UI components | PASS | Pure backend feature |
| No new interfaces beyond config | PASS | Only `StartupResetConfig` and `StartupResetReport` |
| Follows existing env config pattern | PASS | Matches `adminConfig.ts` / `globalMigrationCatalogConfig.ts` |
| Follows existing `.env.example` format | PASS | Section header + comments pattern |

### Safety Pattern Verification

| Safety Layer | Present? | Pattern Source |
|---|---|---|
| Off by default | YES | Same as `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` |
| Production environment guard | YES | New — stricter than existing patterns |
| Advisory lock | YES | Same as `bootstrapSuperuser.ts` |
| Schema name regex validation | YES | Same as E2E `e2eFullReset.mjs` |
| Infrastructure schema protection | YES | `public` excluded, same as E2E |
| Supabase credentials required | YES | Same as bootstrap superuser |
| Post-reset verification | YES | Same as E2E `hasProjectOwnedResidue()` |
| Transaction pooler guard | YES | Inherited from `KnexClient.ts` |
| Comprehensive logging | YES | WARN for destructive ops, INFO for progress |

---

## File Change Summary

| File | Action | Description |
|---|---|---|
| `packages/universo-core-backend/base/.env.example` | MODIFY | Add "Danger Zone" block with FULL_DATABASE_RESET |
| `packages/universo-core-backend/base/.env` | MODIFY | Add FULL_DATABASE_RESET=false |
| `packages/universo-core-backend/base/src/bootstrap/startupReset.ts` | CREATE | New module with reset logic (reuses DbExecutor, withAdvisoryLock, registeredSystemAppDefinitions) |
| `packages/universo-core-backend/base/src/index.ts` | MODIFY | Call `executeStartupFullReset()` before existing init logic |
| `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts` | CREATE | Unit tests for reset module |
| `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts` | MODIFY | Add reset integration test cases |
| `docs/ru/getting-started/configuration.md` | MODIFY | Add danger zone section |
| `docs/en/getting-started/configuration.md` | MODIFY | Add danger zone section |
| `memory-bank/progress.md` | MODIFY | Record completed work |
| `memory-bank/tasks.md` | MODIFY | Track task status |

---

## Implementation Order

```
Phase 1 (env config) → Phase 2 (reset module) → Phase 3 (integration) → Phase 4 (safety) → Phase 5 (tests) → Phase 6 (docs)
```

Each phase can be verified independently before proceeding to the next.

---

## Out of Scope

- **CLI command for reset** — Not needed; the env var approach is simpler and safer
- **Web UI trigger** — Too risky; env var is sufficient for manual testing
- **Selective reset** — Full reset only; selective cleanup would be a separate feature
- **Backup automation** — The user is responsible for backups; we only warn
- **Playwright E2E changes** — The existing E2E cleanup system remains unchanged
- **i18n for log messages** — Server-side log messages stay in English (project convention)
