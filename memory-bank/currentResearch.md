# Current Research

## 2026-03-07: Optimistic create UX redesign audit

- Existing optimistic create/copy behavior is intentionally immediate in cache **and** immediate in presentation: `ItemCard`, `FlowListTable`, and `CustomizedDataGrid` all react to `__pending` right away instead of deferring visual feedback until user interaction.
- The current shared model has no dedicated concept of “optimistically created but visually normal until touched”; that distinction will need to be introduced at the helper/renderer level without changing backend schemas.
- Metahubs and Applications optimistic create hooks still contain temporary `sortOrder ?? 999` placeholders, while many list renderers still display `sortOrder ?? 0`; this combination is the strongest current explanation for the observed temporary `999` / `0` ordinal artifacts.
- `ElementList` still awaits `createElementMutation.mutateAsync(...)`, confirming that at least one create dialog remains blocking after the earlier fire-and-forget pass.
- `MetahubList` and `ApplicationList` table name cells use direct `Link` rendering, so pending entities in those views do not inherit the shared pending-navigation guard behavior.

## 2026-03-04: Codename QA closure follow-up

- Research outcome implemented: codename retry policy standardized across backend domains using shared constants.
- Added direct unit coverage for codename validation/sanitization (`@universo/utils`) and retry candidate generation (`metahubs-backend` helper).
- No unresolved blocker from this research thread remains.

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