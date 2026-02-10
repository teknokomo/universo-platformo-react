# Current Research

## 2026-02-10: Application Runtime 404 on Checkbox Update

- Root cause: runtime update requests did not include `catalogId`, so backend defaulted to the first catalog by codename and returned 404 (row not found) for other catalogs.
- Fix: include `catalogId` in runtime cell update payloads to target the correct runtime table.

## 2026-02-03: Display Attribute UX Fixes

- No new external research required; changes were internal UX and default-value adjustments.

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations
- UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).

### Code audit (createQueryRunner call sites)
- `@universo/auth-backend`: `ensureAuthWithRls` creates a per-request QueryRunner and releases it on response completion.
- `@universo/auth-backend`: `permissionService` creates a QueryRunner only when one is not provided; releases it in `finally`.
- `@flowise/core-backend`: export/import uses QueryRunner with explicit connect + transaction and releases in `finally`.

### Current hypothesis
- The freeze is likely caused by pooled connection contention (too many concurrent requests each holding a per-request QueryRunner) or an edge-case where cleanup/release does not run.
- The middleware cleanup is now guarded to run once per request to reduce cleanup races.

---

## schema-ddl cleanup follow-up (2026-01-19)

### Notes
- Parameterized statement_timeout in `@universo/schema-ddl` locking helper to avoid raw interpolation
- Removed deprecated static wrapper methods in `SchemaGenerator` and `MigrationManager`
- Updated tests to use naming utilities directly

---

## Database pool monitoring (2026-01-31)

### Notes
- Supabase Pool Size observed at 15 connections for the project tier.
- Knex + TypeORM pool budgets aligned to 8 + 7 (total 15).
- Error logging now includes pool state metrics to diagnose exhaustion events.