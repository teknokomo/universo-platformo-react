# QA Report: Unified Database Access Standard Plan

> Date: 2026-03-14
> Reviewed plan: `memory-bank/plan/unified-database-standard-plan-2026-03-14.md`
> Original TZ: `.backup/Единый-стандарт-работы-с-PostgreSQL.md`
> Status: **ALL ROUND 1 + ROUND 2 + ROUND 3 FINDINGS + GAP ANALYSIS (G1–G7) INCORPORATED INTO PLAN — ready for implementation**

---

## Executive Summary

The plan is architecturally sound and covers the majority of the original TZ requirements. However, QA analysis found **3 CRITICAL**, **3 HIGH**, and **4 MEDIUM** issues that must be corrected before implementation begins. The most impactful finding is a **circular dependency** in the proposed package placement of identifier helpers, and **SQL injection vulnerabilities** in the proposed `withAdvisoryLock` and `withTransaction` helpers.

Additionally, the user's explicit directives — "no legacy preservation needed" (DB will be recreated) and "no schema/template version increment" — significantly simplify the plan and are not yet reflected in it.

---

## Verdict Table

| # | Severity | Finding | Plan Section | Status |
|---|----------|---------|-------------|--------|
| F1 | **CRITICAL** | Circular dependency: `@universo/utils` → `@universo/migrations-core` | §2.2 identifiers | Must fix |
| F2 | **CRITICAL** | SQL injection in `withAdvisoryLock` via string interpolation of `timeoutMs` | §2.3 locks | Must fix |
| F3 | **CRITICAL** | SQL injection in `withTransaction` via string interpolation of `statementTimeoutMs` | §2.4 transactions | Must fix |
| F4 | **HIGH** | Existing advisory lock system in `schema-ddl` not reconciled | §2.3 locks | Must fix |
| F5 | **HIGH** | Plan assumes gradual migration; user said "clean break, DB recreated" | §3 all phases | Must fix |
| F6 | **HIGH** | Schema/template version increment not needed per user directive | §3 Phase 2.9 | Must fix |
| F7 | **MEDIUM** | Existing `buildSetLocalStatementTimeoutSql()` in utils not reused | §2.4 transactions | Should fix |
| F8 | **MEDIUM** | `qSchema`/`qTable` could live in `@universo/database` instead of utils | §2.2 identifiers | Recommendation |
| F9 | **MEDIUM** | `executeCount` implementation relies on `rows.length`, not `rowCount` | §2.1 query | Should fix |
| F10 | **MEDIUM** | Baseline lint script unnecessary given clean-break approach | §3 Phase 1.6 | Simplification |

---

## CRITICAL Findings

### F1. Circular Dependency: `@universo/utils` → `@universo/migrations-core`

**Location in plan**: Section 2.2 — Safe Identifier Helpers (`@universo/utils/database/identifiers`)

**Problem**: The plan proposes creating `packages/universo-utils/base/src/database/identifiers.ts` that imports from `@universo/migrations-core`:

```typescript
import {
    assertCanonicalSchemaName,
    assertCanonicalIdentifier,
    quoteIdentifier,
    quoteQualifiedIdentifier
} from '@universo/migrations-core'
```

However, `@universo/utils` has **no dependency** on `@universo/migrations-core` (verified in `packages/universo-utils/base/package.json`). Adding this dependency would violate the package's role as a leaf utility package.

**Current dependency graph**:
- `@universo/utils` → (no DB package deps)
- `@universo/database` → `@universo/utils`, `knex`, `pg`
- `@universo/migrations-core` → `@universo/types`, `knex`
- `@universo/schema-ddl` → `@universo/migrations-core`, `@universo/utils`, `knex`

**Recommended fix — Option A (preferred)**: Place `qSchema`/`qTable`/`qSchemaTable`/`qColumn` in `@universo/database` (which already depends on utils and can add migrations-core dependency). Domain packages already import from database.

**Recommended fix — Option B**: Copy the identifier validation logic (pure regex, no external deps) directly into `@universo/utils/database/identifiers.ts` so there's no import from migrations-core. Then re-export from migrations-core for backward compatibility. This is viable because `assertCanonicalIdentifier`, `assertCanonicalSchemaName`, and `quoteIdentifier` are **pure functions** with zero external dependencies — just regex checks and string replacements.

**Recommended fix — Option C**: Keep identifiers in `@universo/migrations-core` and have domain packages import `qSchema`/`qTable` from there directly. This avoids creating any new dependency. Many domain packages (metahubs-backend, applications-backend) already depend on migrations-core indirectly through schema-ddl.

---

### F2. SQL Injection in `withAdvisoryLock`

**Location in plan**: Section 2.3 — DbExecutor-Based Advisory Lock

**Problem**: The proposed code does:

```typescript
if (options?.timeoutMs) {
    await tx.query(`SET LOCAL lock_timeout = '${options.timeoutMs}ms'`)
}
```

This is **direct string interpolation** of a user-provided number into SQL. While `timeoutMs` is expected to be a number, TypeScript types don't prevent a caller from passing a string like `"1; DROP TABLE users; --"` at runtime (via `as any`, external input, etc.).

**Recommended fix**: Use the **existing** `formatStatementTimeoutLiteral()` from `@universo/utils/database/statementTimeout` which validates the input is a positive integer ≤ 300,000ms before interpolation. Or create an analogous `buildSetLocalLockTimeoutSql()`:

```typescript
const assertLockTimeoutMs = (ms: number): number => {
    if (!Number.isInteger(ms) || ms <= 0 || ms > 300_000) {
        throw new Error(`Invalid lock_timeout: must be positive integer <= 300000ms`)
    }
    return ms
}

await tx.query(`SET LOCAL lock_timeout TO '${assertLockTimeoutMs(options.timeoutMs)}ms'`)
```

---

### F3. SQL Injection in `withTransaction`

**Location in plan**: Section 2.4 — DbExecutor-Based Transaction Helper

**Problem**: Same pattern:

```typescript
await tx.query(
    `SET LOCAL statement_timeout = '${Math.min(options.statementTimeoutMs, 300000)}ms'`
)
```

**Recommended fix**: Replace with the **existing utility that already does exactly this**:

```typescript
import { buildSetLocalStatementTimeoutSql } from '@universo/utils/database'

await tx.query(buildSetLocalStatementTimeoutSql(options.statementTimeoutMs))
```

`buildSetLocalStatementTimeoutSql` (in `packages/universo-utils/base/src/database/statementTimeout.ts`) already validates the input as a positive integer ≤ 300,000ms and formats the SQL safely. There is **no reason** to reinvent this.

---

## HIGH Findings

### F4. Existing Advisory Lock System Not Reconciled

**Location in plan**: Section 2.3 vs existing `packages/schema-ddl/base/src/locking.ts`

**Problem**: The codebase already has a sophisticated advisory lock system in `@universo/schema-ddl`:
- `acquireAdvisoryLock(knex, lockKey, timeoutMs)` — uses pinned connection + BEGIN + poll loop with `pg_try_advisory_xact_lock` + configurable timeout + debug logging + in-memory Map for tracking
- `releaseAdvisoryLock(knex, lockKey)` — COMMIT + connection release

The plan's proposed `withAdvisoryLock` uses a different approach:
- Uses blocking `pg_advisory_xact_lock` (waits forever unless lock_timeout is set)
- No poll loop, no debug logging, no connection tracking

These are **two fundamentally different lock strategies** that will coexist in the codebase.

**Recommendation**: The plan should explicitly acknowledge the two systems and their scopes:
1. **schema-ddl's lock system** — for DDL/migration operations that use raw Knex connections (Tier 3). This is mature and battle-tested. **Keep as-is.**
2. **New `withAdvisoryLock`** — for domain-level DML operations through DbExecutor (Tier 1/2). This is the new standard for domain code.

Add a section to the plan explaining why both exist and when to use each.

---

### F5. Plan Assumes Gradual Migration; User Said Clean Break

**Location in plan**: Sections 3–4 (all phases), Section 1.6 (baseline lint script)

**Problem**: The plan is designed for **incremental migration**:
- Phase 1.6 creates a `--baseline` lint mode for tracking existing violations
- Section 5.4 discusses "Transition Period — Incremental Migration"
- Each phase converts "one service at a time"

But the user explicitly stated: **"Не нужно сохранять никакой легаси код, тестовая база данных будет удалена и создана новая"** (No need to preserve any legacy code, test DB will be deleted and recreated).

**Impact**: This significantly simplifies the plan:
- **No baseline lint script needed** — violations can be fixed in one wave since there's no production constraint
- **No gradual conversion** — services can be converted in larger batches
- **No backward compatibility requirements** — DDL migration history doesn't need to be preserved
- **Database can be bootstrapped fresh** — no need to worry about existing migration state
- Phase structure can be compressed from 7 phases to ~4

**Recommendation**: Rewrite the phasing to reflect a clean-break approach. Phase 1 (primitives) remains. Phases 2–4 can be merged and simplified — convert all services without incremental baseline tracking.

---

### F6. Schema/Template Version Increment Not Needed

**Location in plan**: §3 Phase 2.9 (MetahubSchemaService conversion)

**Problem**: The user said: **"Не нужно увеличивать версию схемы и шаблона метахаба"** (No need to increment metahub schema and template version).

The plan's Phase 2.9 discusses converting MetahubSchemaService and splitting it into DDL vs DML interfaces. While this is architecturally correct, the plan should explicitly note that existing schema_version and template_version values do NOT need to be bumped as part of this standardization work.

**Recommendation**: Add a note to Phase 2.9 and any DDL-touching phase that schema/template version remains unchanged during this refactor.

---

## MEDIUM Findings

### F7. Existing `buildSetLocalStatementTimeoutSql()` Not Reused

**File**: `packages/universo-utils/base/src/database/statementTimeout.ts`

The utility already exports:
- `formatStatementTimeoutLiteral(ms)` — validates and formats `"123ms"`
- `buildSetLocalStatementTimeoutSql(ms)` — returns `SET LOCAL statement_timeout TO '123ms'` with validation

The plan's `withTransaction` reinvents this with unsafe string interpolation. The plan should explicitly reference and reuse this existing helper.

---

### F8. Identifier Helpers Placement — `@universo/database` Is Better

As discussed in F1, `@universo/database` is the natural home for `qSchema`/`qTable`/`qSchemaTable`:
- It already depends on `@universo/utils`
- Adding `@universo/migrations-core` as dependency is architecturally clean (both are DB infrastructure)
- Domain packages that need identifiers already depend on `@universo/database` (or should)
- This preserves `@universo/utils` as a pure leaf utility package

---

### F9. `executeCount` Implementation Issue

**Location in plan**: Section 2.1 `executeCount`

The proposed implementation returns `rows.length`, which works for `INSERT ... RETURNING` but **does not work** for `UPDATE` or `DELETE` without `RETURNING`. For those, PostgreSQL returns `rowCount` in the result metadata, but `SqlQueryable.query()` normalizes to `rows` (via `result.rows ?? result`), losing the `rowCount` info.

**Recommendation**: Either:
1. Require all DML to use `RETURNING` (and document this), or
2. Extend `SqlQueryable`/`DbExecutor` with an `execute()` method that returns `{ rowCount }`, or
3. Remove `executeCount` from the helper set and use `RETURNING` + `queryMany().length` pattern explicitly.

Option 1 is simplest and already used in the codebase.

---

### F10. Baseline Lint Script Unnecessary

Given F5 (clean-break approach), the `--baseline` mode in `tools/lint-db-access.mjs` is not needed. The script itself (to catch violations) is valuable for CI, but the baseline/gradual-reduction tracking can be removed.

---

## Completeness Check vs Original TZ

| TZ Requirement | Plan Coverage | Notes |
|---------------|---------------|-------|
| Three access tiers (RLS, Admin, DDL) | ✅ Full | §2 Architecture diagram and rules |
| DML/DQL = SQL-first via DbExecutor | ✅ Full | queryMany/queryOne helpers |
| DDL = Knex (keep as transport) | ✅ Full | Tier 3 definition |
| Ban Knex from domain services | ✅ Full | Lint rules + conversion phases |
| RLS pinned-connection standard | ✅ Full | Already implemented, plan preserves |
| Advisory locks for DDL/concurrent ops | ✅ Full | withAdvisoryLock + existing schema-ddl system |
| Typed return values (T[] / T \| null) | ✅ Full | queryMany/queryOne wrappers |
| Safe identifier quoting | ✅ Full | qSchema/qTable/qColumn (placement issue aside) |
| Set-based operations (lsFusion) | ✅ Full | Phase 5 CTE+RETURNING patterns |
| Materialization strategy | ✅ Full | Phase 6 (optional) |
| statement_timeout / lock_timeout | ✅ Full | SET LOCAL enforcement |
| Transaction pooler 6543 ban | ✅ Mentioned | In Tier 3 rules |
| CI lint enforcement | ✅ Full | Phase 1.6 + Phase 7.4 |
| Zod optional validation | ✅ Full | queryMany/queryOne schema param |
| Batch introspection (no N+1) | ✅ Full | Phase 5.2 |
| Test strategy | ✅ Full | Per-phase tests + Phase 7 cross-cutting |
| "No legacy preservation" directive | ❌ **Missing** | Plan is incremental; should be clean-break |
| "No schema version increment" directive | ❌ **Missing** | Not mentioned in plan |
| `buildSetLocalStatementTimeoutSql` reuse | ❌ **Missing** | Reinvented unsafely |
| Reconcile existing advisory lock systems | ❌ **Missing** | Two systems will coexist without explanation |

---

## Positive Observations

1. **Three-tier architecture** is clean and well-structured. The separation of concerns is correct.
2. **Decision to keep Knex** as transport is pragmatic and well-justified.
3. **queryMany/queryOne** with optional Zod is the right level of abstraction.
4. **Per-service conversion** approach in Phase 2 is properly granular.
5. **Phase 5 CTE+RETURNING** patterns correctly apply lsFusion "set-based" philosophy.
6. **MetahubSchemaService split** (DDL vs DML) in §5.1 is architecturally correct.
7. **Affected packages table** (§4) gives clear risk assessment.
8. **Phase 7 security regression tests** cover real injection vectors.

---

## Recommended Action Sequence

1. **Fix F1** — Decide identifier helper placement (@universo/database or Option B/C from report)
2. **Fix F2+F3** — Use existing `buildSetLocalStatementTimeoutSql` and create analogous `buildSetLocalLockTimeoutSql` with validation
3. **Fix F4** — Add section explaining coexistence of schema-ddl locks (Knex, Tier 3) and new domain locks (DbExecutor, Tier 1/2)
4. **Fix F5** — Rewrite phasing for clean-break approach, remove baseline lint mode
5. **Fix F6** — Add "no version increment" note to MetahubSchemaService phase
6. **Fix F7** — Reference existing `statementTimeout.ts` in transaction helper
7. **Fix F9** — Either require RETURNING for all DML or document the limitation
8. **Fix F10** — Remove `--baseline` mode from lint script

After these corrections, the plan should be ready for implementation.

---

## Conclusion

The plan correctly identifies all systemic problems in the codebase and proposes a sound architectural solution (three-tier, Knex as transport only, DbExecutor as domain contract). The core direction is correct.

However, **3 Critical + 3 High issues must be resolved** before implementation — especially the circular dependency (F1), SQL injection in helpers (F2/F3), and alignment with the user's clean-break directive (F5). These are all fixable within the plan itself without changing the overall architecture.

**Recommendation**: Fix the listed issues in the plan document, then proceed to IMPLEMENT mode.

---
---

# QA Round 2: Post-Correction Verification

> Date: 2026-03-15
> Scope: Full re-analysis of corrected plan (~918 lines) after all 10 Round 1 findings were incorporated
> Methodology: Plan re-read + deep codebase audit targeting new angles (package.json deps, subpath exports, public API surfaces, ESM/CJS patterns)

---

## Round 2 Executive Summary

All 10 Round 1 findings (F1–F10) were **correctly incorporated**. The plan's architecture is solid. No CRITICAL or HIGH issues remain.

Round 2 found **3 MEDIUM** and **2 LOW** implementation-detail issues. These are localized discrepancies between the plan's code snippets and the actual codebase contracts. None affect the overall architecture.

---

## Round 2 Verdict Table

| # | Severity | Finding | Plan Section | Status |
|---|----------|---------|-------------|--------|
| F11 | **MEDIUM** | `queryOneOrThrow` uses non-existent `createHttpError` — `http-errors` not in `@universo/utils` deps | §2.1 query helpers | Should fix |
| F12 | **MEDIUM** | Import path `@universo/utils/database/query` is not a valid subpath export | §9 example code | Should fix |
| F13 | **MEDIUM** | Lint script scans `auth-backend` but `ensureAuthWithRls` middleware legitimately needs Knex | Step 1.6 + Phase 4.1 | Should clarify |
| F14 | **LOW** | `permissionService.ts` public API change (`PermissionServiceOptions.getKnex`) not fully specified | Phase 4.1 | Should clarify |
| F15 | **LOW** | `getPoolExecutor()` Step 1.5 shows signature but no implementation body | Step 1.5 | Minor |

---

## Round 2 Findings Detail

### F11. `queryOneOrThrow` Uses Non-Existent `createHttpError` (MEDIUM)

**Location**: §2.1, line `if (!row) throw createHttpError(404, message)`

**Problem**: The `createHttpError` function does not exist in `@universo/utils`. The `http-errors` package is NOT listed in `@universo/utils/base/package.json` dependencies.

The codebase uses `http-errors` in backend packages with the following ESM/CJS compatibility pattern:
```typescript
import * as httpErrors from 'http-errors'
const createError = (httpErrors as any).default || httpErrors
```

This pattern appears in: `metahubs-backend/guards.ts`, `auth-backend/createAccessGuards.ts`, `applications-backend/guards.ts`, `admin-backend/ensureGlobalAccess.ts`.

**Options**:
- **(A)** Add `http-errors` as a peer/optional dependency of `@universo/utils` and use the ESM/CJS pattern. Downcouples utils from a specific HTTP framework.
- **(B) Recommended**: Remove HTTP coupling from `queryOneOrThrow`. Throw a plain `Error` (or a custom `NotFoundError` class). Let the calling route/guard wrap it with `createError(404)` using the `http-errors` already available in every backend package. This keeps `@universo/utils` transport-agnostic (it also has browser exports).

### F12. Import Path `@universo/utils/database/query` Not a Valid Subpath (MEDIUM)

**Location**: §9 "After" example code:
```typescript
import { queryMany, queryOne } from '@universo/utils/database/query'
```

**Problem**: `@universo/utils` `package.json` defines subpath `"./database"` → `./dist/database/index.mjs`, but NOT `"./database/query"`. Node.js + TypeScript will fail to resolve this import.

Phase 1 Step 1.1 correctly says "Export from `@universo/utils/database` barrel", which means the import should be:
```typescript
import { queryMany, queryOne } from '@universo/utils/database'
```

**Fix**: Update §9 example (and any other code snippets) to use the barrel path `@universo/utils/database`, or explicitly add a new subpath export to `package.json`. The barrel is simpler.

### F13. Lint Script Scans `auth-backend` but Middleware Needs Knex (MEDIUM)

**Location**: Step 1.6 lint script scans `auth-backend`; Phase 4.1 audits auth-backend

**Problem**: Step 1.6 defines the lint script to scan domain packages including `auth-backend`. However, `@universo/auth-backend` contains `ensureAuthWithRls` middleware that **must** use `getKnex()` directly — it creates pinned RLS connections via `createRlsExecutor(knex, connection)`. This is legitimate infrastructure, not domain logic.

The lint rule catches `getKnex()` "in non-infrastructure paths" — but the plan doesn't define what counts as "non-infrastructure" within auth-backend.

**Options**:
- **(A)** Remove `auth-backend` from lint scan — it's foundational infrastructure like `@universo/database`.
- **(B) Recommended**: Define concrete path exclusions in the lint script: `**/middlewares/**` and `**/auth.ts` are infrastructure; `**/services/**` and `**/routes/**` are domain. This way `permissionService.ts` (services/) is linted but `ensureAuthWithRls` (middlewares/) is not.

### F14. `permissionService.ts` Public API Change Not Specified (LOW)

**Location**: Phase 4.1

**Problem**: The plan says to convert `permissionService.ts` from `createKnexExecutor(getKnex())` to `getPoolExecutor()`. But it doesn't mention that:

1. `PermissionServiceOptions` interface is typed as `{ getKnex: () => Knex }` — this is a **public type-level Knex dependency** exported from `@universo/auth-backend`
2. The call site in `universo-core-backend/routes/index.ts` passes `createPermissionService({ getKnex })` — this must change to `createPermissionService({ getDbExecutor: getPoolExecutor })` (or similar)

**Fix**: Phase 4.1 should explicitly state:
- Change `PermissionServiceOptions.getKnex: () => Knex` to `getDbExecutor: () => DbExecutor`
- Change internal `runQuery` fallback from `createKnexExecutor(getKnex())` to `options.getDbExecutor()`
- Update core-backend route wiring: `createPermissionService({ getDbExecutor: getPoolExecutor })`

### F15. `getPoolExecutor()` Lacks Implementation (LOW)

**Location**: Step 1.5

**Problem**: The step shows the function signature but not the trivial implementation:
```typescript
export function getPoolExecutor(): DbExecutor {
    return createKnexExecutor(getKnex())
}
```

This is minor since it's obvious, but other helpers (§2.1–2.4) show full code.

---

## Round 2 Verification Checklist

### Round 1 Fixes — All Verified ✅

| R1 Finding | Verification | Status |
|-----------|-------------|--------|
| F1 (circular dep) | Identifiers moved to `@universo/database` with `@universo/migrations-core` dep. Build order verified: types → migrations-core → utils → database. No cycle. | ✅ Correct |
| F2 (advisory lock injection) | `assertLockTimeoutMs()` validates positive integer ≤ 300000. Interpolation is safe post-validation. | ✅ Correct |
| F3 (transaction injection) | Reuses `buildSetLocalStatementTimeoutSql()` from `./statementTimeout`. No custom interpolation. | ✅ Correct |
| F4 (two lock systems) | Comparison table added. schema-ddl Tier 3 vs domain Tier 1/2 clearly documented. | ✅ Correct |
| F5 (clean break) | `--baseline` removed. Zero-violation policy from day one. Key Constraints header added. | ✅ Correct |
| F6 (schema version) | Phase 2.9 has explicit note: "schema_version and template_version must remain at current values". | ✅ Correct |
| F7 (statement timeout reuse) | `withTransaction` now imports `buildSetLocalStatementTimeoutSql` from `./statementTimeout`. | ✅ Correct |
| F8 (identifier placement) | Resolved by F1 — identifiers in `@universo/database`. | ✅ Correct |
| F9 (executeCount) | DML RETURNING requirement added as architectural standard. JSDoc documents this. | ✅ Correct |
| F10 (baseline lint) | Removed. Lint script is zero-violations, no exception tracking. | ✅ Correct |

### Architecture Checks ✅

| Check | Result |
|-------|--------|
| Build order: no cycles with new `@universo/database` → `@universo/migrations-core` dep | ✅ types → migrations-core → utils/i18n → database → domain packages |
| `@universo/utils/database` barrel already exports all key types | ✅ DbExecutor, DbSession, SqlQueryable, softDelete, systemFields, statementTimeout |
| `zod` is a dependency of `@universo/utils` | ✅ Version 3.25.76 in package.json |
| `convertPgBindings` correctly handles $1..$N ↔ ? conversion | ✅ Validated, throws on mixed placeholders |
| `createRlsExecutor` SAVEPOINT naming is safe (uses depth counter) | ✅ `rls_sp_${nextDepth}` — no user input |
| Three-tier boundary correctly documented | ✅ Tier 1 (RLS), Tier 2 (Pool), Tier 3 (Knex DDL) |
| Advisory lock `hashtext($1)` uses parameter binding (no injection) | ✅ $1 placeholder, not interpolation |
| DML RETURNING standard is clearly stated | ✅ §Architecture + executeCount JSDoc |
| `createEnsureAuthWithRls({ getKnex })` is correct Tier 3 usage | ✅ Infrastructure needs raw Knex for pinned connection |
| Phase 2.10 fixes metahubsQueryHelpers injection | ✅ Replaces `"${schema}"."${table}"` with `qSchemaTable(schema, table)` |
| Phase 2.12 deletes KnexClient wrapper | ✅ Explicit step with verification |

### TZ Completeness ✅

| Requirement | Coverage |
|------------|---------|
| SQL-first via DbExecutor/SqlQueryable | ✅ Full |
| Knex stays as transport only | ✅ Full |
| Ban Knex from domain code | ✅ Full (lint + conversion) |
| RLS pinned-connection standard | ✅ Preserved |
| Advisory locks | ✅ Two systems documented |
| Safe identifier quoting | ✅ qSchema/qTable in @universo/database |
| Set-based operations (lsFusion) | ✅ Phase 5 |
| Materialized views (lsFusion) | ✅ Phase 6 (optional) |
| Typed query results | ✅ queryMany/queryOne |
| Zod validation at API boundary | ✅ Optional schema param |
| statement_timeout enforcement | ✅ Reuses existing helper |
| lock_timeout enforcement | ✅ assertLockTimeoutMs validator |
| CI lint enforcement | ✅ tools/lint-db-access.mjs |
| "No legacy preservation" | ✅ Clean-break approach |
| "No schema/template version increment" | ✅ Explicit note in Phase 2.9 |
| DML RETURNING requirement | ✅ Architectural standard |
| Test strategy | ✅ Per-phase + Phase 7 cross-cutting |
| Documentation plan | ✅ §8 — systemPatterns, techContext, docs/, README |

---

## Round 2 Positive Observations

1. **All 10 Round 1 fixes were correctly applied** — no regressions introduced.
2. **Key Constraints header** at the top of the plan is excellent — prevents drift.
3. **Advisory lock two-system comparison table** is clear and well-structured.
4. **DML RETURNING standard** as a documented architectural decision is a strong addition.
5. **Build order is correct** — verified no cycles with the new dependency chain.
6. **`assertLockTimeoutMs` + `buildSetLocalLockTimeoutSql`** pattern matches the existing `statementTimeout.ts` style.
7. **Phase 2.10 (metahubsQueryHelpers fix)** and **Phase 2.12 (KnexClient deletion)** are important new steps that close remaining attack vectors.
8. **Before/After example (§9)** is clear and demonstrates the full migration pattern.
9. **Clean-break §5.4** is well-written with all implications listed.
10. The **`createRlsExecutor`** savepoint naming (`rls_sp_${depth}`) is safe — uses a numeric counter, not user input.

---
---

## Round 3 Executive Summary

Deep codebase audit (6 targeted areas via Explore subagent) + full plan re-read (940 lines).
Severity: **2 MEDIUM + 3 LOW**. No CRITICAL or HIGH issues. All R1+R2 fixes verified correct.

### R3 Verdict Table

| # | Severity | Finding | Plan Section | Status |
|---|----------|---------|-------------|--------|
| F16 | **MEDIUM** | Lint script & Success Criteria #3 contradicted DDL subsystem needs in metahubs-backend | §3 Step 1.6, §6 #3 | ✅ Fixed |
| F17 | **MEDIUM** | Step 2.9 wording didn't acknowledge MetahubSchemaService already has `exec: SqlQueryable` | §3 Step 2.9 | ✅ Fixed |
| F18 | **LOW** | Steps 2.9 and 2.12 duplicated KnexClient deletion | §3 Steps 2.9/2.12 | ✅ Fixed |
| F19 | **LOW** | applicationMigrationsRoutes + metahubMigrationsRoutes not explicitly listed in Step 2.13 | §3 Step 2.13 | ✅ Fixed |
| F20 | **LOW** | §5.1 MetahubSchemaService split didn't address ensureSchema() orchestration | §5.1 | ✅ Fixed |

### F16 Detail: DDL Subsystem Lint Exclusions (MEDIUM)

**Problem:** Step 1.6 lint script bans `import.*from 'knex'` in all domain packages. Success
Criteria #3: "Zero imports — no exceptions." But 6+ files in metahubs-backend are genuine DDL
infrastructure that MUST keep Knex types:
- `SystemTableDDLGenerator.ts` — creates tables via `knex.schema`
- `SystemTableMigrator.ts` — applies DDL migrations via `knex.schema`
- `structureVersions.ts` — DDL version specs with `init: (knex: Knex) => Promise<void>`
- `domains/ddl/index.ts` — `getDDLServices()` factory + Knex re-exports

**Fix applied:** Added DDL subsystem path exclusions to Step 1.6 (4 specific paths).
Updated Success Criteria #3 to reference the exclusion list.

### F17 Detail: MetahubSchemaService Constructor State (MEDIUM)

**Problem:** Step 2.9 said "Replace knex getter with constructor-injected DbExecutor"
but the constructor ALREADY accepts `exec: SqlQueryable` (line 97 of MetahubSchemaService.ts).
The `knex` getter is a SEPARATE access path for DDL/advisory locks only.

**Fix applied:** Rewrote Step 2.9 with explicit 4-point conversion plan:
1. Remove `knex` getter 2. DDL methods accept Knex as parameter
3. Advisory locks use passed Knex 4. DML keeps `this.exec` (unchanged)

### F18 Detail: Duplicate KnexClient Deletion (LOW)

**Problem:** KnexClient deletion was described in both Step 2.9 AND Step 2.12.
**Fix applied:** Removed from Step 2.9; kept only in Step 2.12 (dedicated step).

### F19 Detail: Missing Route File Names (LOW)

**Problem:** Step 2.13 said "attributesRoutes, hubsRoutes, catalogsRoutes, etc." but
`applicationMigrationsRoutes.ts` (3 KnexClient + advisory lock + direct transaction)
and `metahubMigrationsRoutes.ts` (7-8 calls) were not named.
**Fix applied:** Both files now explicitly listed with complexity notes.

### F20 Detail: MetahubSchemaService Split Orchestration (LOW)

**Problem:** §5.1 proposed splitting into two classes but `ensureSchema()` orchestrates
DML then DDL then DML in one flow.
**Fix applied:** Clarified as dual-interface in one class. ensureSchema() keeps its flow.

---

## Round 3 Codebase Verification (Deep Audit)

| Area | Result |
|------|--------|
| RLS policies on metahub tables | ✅ 8 tables, RLS enabled + policies (migration lines 608-753) |
| start-backend Knex usage | ✅ Zero — fully aligned with DbExecutor |
| MetahubBranchesService | ✅ Clean — no KnexClient, no Knex import |
| KnexClient.getInstance() in routes | 34 calls across 10 route files — plan coverage confirmed |
| getDDLServices() call sites | 11 calls across 5 files — DDL-only |
| Core backend route wiring | ✅ Executor factory pattern established |
| lsFusion principles | ✅ All 5 adequately represented |
| Security: SQL injection | ✅ All vectors covered |
| Security: RLS bypass | ✅ §5.5 correctly addresses risk |

---

## Final Assessment (After 3 Rounds)

| Round | Findings | Severity Distribution |
|-------|----------|----------------------|
| R1 | 10 | 3 CRITICAL + 3 HIGH + 4 MEDIUM |
| R2 | 5 | 3 MEDIUM + 2 LOW |
| R3 | 5 | 2 MEDIUM + 3 LOW |
| **Total** | **20** | **All incorporated** |

**Verdict:** Plan is ready for IMPLEMENT mode. All 20 findings across 3 QA rounds
incorporated. Post-QA gap analysis added 7 more improvements (G1–G7).

---

## Post-QA Gap Analysis (G1–G7) — TZ vs Plan Cross-Reference

After all QA rounds, a systematic cross-reference of the original TZ
(`.backup/Единый-стандарт-работы-с-PostgreSQL.md`) against the corrected plan
identified **7 remaining gaps**:

| # | Severity | Gap Description | Plan Change |
|---|----------|-----------------|-------------|
| G1 | **MEDIUM** | Core-backend executor factory wiring: plan only fixes `permissionService` (Step 4.1) but `routes/index.ts` has 10+ sites passing `() => createKnexExecutor(getKnex())` | Added **Step 4.1b** with explicit migration table for all 11 router factory call sites |
| G2 | LOW | Schema-qualified SQL rule not explicitly stated as a standard — TZ says "не полагаться на search_path" | Added **§2 "Cross-Cutting Rules"** section with explicit rule |
| G3 | LOW | Phase 5.1 "one query per action" scope too narrow — said "metahubs routes" but applies to ALL domains | Expanded Step 5.1 to "all domain routes (metahubs-backend, applications-backend)" |
| G4 | LOW | Step 2.9 DDL Knex source overcomplicated — "accept from caller" forces domain code to know Knex | Simplified to "import `getKnex()` from `@universo/database` directly" (DDL-excluded file) |
| G5 | LOW | Step 4.2 (start-backend) missing expected outcome — R3 audit confirmed zero Knex usage | Added note: "verification-only, expected: already clean" |
| G6 | LOW | Code review checklist from TZ not in Documentation Plan | Added checklist creation task to §8 with 9 review criteria from TZ |
| G7 | LOW | SECURITY DEFINER function standard from TZ not documented | Added future-proofing rule to §2 Cross-Cutting Rules |

### Verification: Core-Backend Wiring (G1 Deep Dive)

`universo-core-backend/base/src/routes/index.ts` call sites analyzed:

```
Line 31:  import { getKnex, createKnexExecutor } → keep getKnex (for ensureAuthWithRls), replace createKnexExecutor with getPoolExecutor
Line 57:  createPublicMetahubsServiceRoutes(() => createKnexExecutor(getKnex())) → getPoolExecutor
Line 65:  { getDbExecutor: () => createKnexExecutor(getKnex()) } → { getDbExecutor: getPoolExecutor }
Line 74:  createMetahubsServiceRoutes(ensureAuthWithRls, () => createKnexExecutor(getKnex())) → getPoolExecutor
Line 84:  createApplicationsServiceRoutes(ensureAuthWithRls, () => createKnexExecutor(getKnex()), ...) → getPoolExecutor
Line 96:  (r) => getRequestDbExecutor(r, createKnexExecutor(getKnex())) → (r) => getRequestDbExecutor(r, getPoolExecutor())
Line 102: { getDbExecutor: () => createKnexExecutor(getKnex()) } → { getDbExecutor: getPoolExecutor }
Line 108: getDbExecutor: () => createKnexExecutor(getKnex()) → getDbExecutor: getPoolExecutor
Line 133: getDbExecutor: () => createKnexExecutor(getKnex()) → getDbExecutor: getPoolExecutor
Line 139: getDbExecutor: () => createKnexExecutor(getKnex()) → getDbExecutor: getPoolExecutor
Line 146: getDbExecutor: () => createKnexExecutor(getKnex()) → getDbExecutor: getPoolExecutor
Line 155: getDbExecutor + getRequestDbExecutor → getPoolExecutor + (req) => getRequestDbExecutor(req, getPoolExecutor())
```

**Only `createEnsureAuthWithRls({ getKnex })` retains direct Knex pool access** (infrastructure, Tier 3).

**All 7 gaps incorporated into plan on 2026-03-14.**

---

## Round 2 Conclusion

The plan is **architecturally complete and correctly incorporates all Round 1 fixes**. No CRITICAL or HIGH issues remain.

The 3 MEDIUM findings (F11–F13) are **implementation-detail gaps** that should be clarified in the plan before coding begins, but they do not affect the overall architecture or phasing strategy. The 2 LOW findings (F14–F15) are documentation improvements.

**Recommendation**: Incorporate F11–F15 into the plan, then proceed to **IMPLEMENT** mode. The plan is ready for implementation with these minor adjustments.

> **Update 2026-03-14**: All Round 2 findings (F11–F15) have been incorporated into the plan:
> - F11: `queryOneOrThrow` now throws `NotFoundError` (plain Error subclass) with optional error factory — no `http-errors` dep.
> - F12: §9 example corrected to `@universo/utils/database` barrel import.
> - F13: Lint script Step 1.6 now defines path exclusions for `auth-backend/**/middlewares/**`.
> - F14: Phase 4.1 now fully specifies `PermissionServiceOptions` API change + core-backend call-site update.
> - F15: Step 1.5 now includes full `getPoolExecutor()` implementation body.
