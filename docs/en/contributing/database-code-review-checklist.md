# Database Code Review Checklist

Checklist for reviewing any pull request that touches backend database access, persistence stores, or SQL queries.

---

## 1. Access Tier Correctness

- [ ] Authenticated route handlers use `getRequestDbExecutor(req, getDbExecutor())` (Tier 1, RLS-scoped)
- [ ] Admin/bootstrap code uses `getPoolExecutor()` from `@universo/database` (Tier 2, non-RLS)
- [ ] DDL/migration code uses `getKnex()` from `@universo/database` (Tier 3)
- [ ] Tier 3 access is isolated in explicit DDL boundaries such as package-local `src/ddl/` seams, not mixed into route/store code
- [ ] No direct Knex imports in domain route handlers or persistence stores

## 2. Identifier Safety

- [ ] All dynamic schema/table/column names use `qSchema()`, `qTable()`, `qColumn()`, or `qSchemaTable()` from `@universo/database`
- [ ] No string template interpolation (`${...}`) for identifiers in SQL
- [ ] All user-supplied values use bind parameters (`$1`, `$2`, ...)

## 3. Active-Row Predicate

- [ ] Application-domain queries include `_upl_deleted = false AND _app_deleted = false`
- [ ] Metahub-domain queries include `_upl_deleted = false AND _mhb_deleted = false`
- [ ] Cross-schema joins use the correct predicate per alias (never mix `_app_deleted` with metahub aliases)
- [ ] Restore/delete flows constrain row state explicitly instead of updating by bare `id` only

## 4. Transaction & Lock Safety

- [ ] DDL operations use advisory locks (`withAdvisoryLock`) for concurrency
- [ ] Long-running transactions set `statementTimeoutMs` via `withTransaction`
- [ ] Transactions keep scope minimal — no external HTTP calls inside transaction blocks

## 5. Error Handling

- [ ] `RETURNING` clause used for mutation confirmation (UPDATE/DELETE)
- [ ] Zero-row mutation results throw or map to an explicit fail-closed path
- [ ] Diagnostic queries run on error path only (not on every write)
- [ ] Error messages never expose raw SQL or internal table names to clients

## 6. Result Normalization

- [ ] `queryMany<T>()` returns typed `T[]` (never raw object)
- [ ] `queryOne<T>()` returns `T | null` (never undefined)
- [ ] Zod schemas applied at system boundaries for input validation

## 7. Pool & Connection Health

- [ ] No connection leaks — all borrowed connections returned via executor lifecycle
- [ ] `isReleased()` checked before reusing executors in long-lived contexts
- [ ] `statement_timeout` (30s default) enforced via `afterCreate` hook

## 8. Lint Compliance

- [ ] `node tools/lint-db-access.mjs` passes with 0 violations
- [ ] New excluded paths added to `EXCLUDED_PATTERNS` only with justification comment
- [ ] No `KnexClient.getInstance()` or `getKnex()` calls in domain code

## 9. Test Coverage

- [ ] SQL-first persistence stores have direct unit tests (not only route-level mocks)
- [ ] Critical service-level delete/restore/sync contracts have direct tests when route tests mock the service
- [ ] Identifier safety helpers tested with injection payloads
- [ ] Result normalization helpers tested for type guarantees (array, null, never undefined)

---

**Lint command**: `node tools/lint-db-access.mjs`  
**Related patterns**: See `memory-bank/systemPatterns.md` — "Unified Database Access Standard"  
**Plan reference**: `memory-bank/plan/unified-database-standard-plan-2026-03-14.md`
