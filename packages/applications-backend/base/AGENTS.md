# Applications Backend — AI Agent Guide

## Scope

This package owns application metadata, connector and membership flows, runtime sync orchestration, and release-bundle routes.
Treat it as a SQL-first backend package with one narrow Tier 3 DDL boundary.

## Database Access Rules

- Use Tier 1 request executors for authenticated route work.
- Use Tier 2 `getPoolExecutor()` for admin, bootstrap, or public non-RLS work.
- Keep raw Knex only behind `src/ddl/index.ts`.
- Route handlers and persistence stores must not call `getKnex()` directly.
- Dynamic identifiers must use shared identifier helpers.

## Persistence Rules

- Stores and service helpers should use parameterized schema-qualified SQL.
- Application-domain active rows require `_upl_deleted = false AND _app_deleted = false`.
- Mutating helpers should use `RETURNING id` when the caller needs row confirmation.
- Zero-row writes should fail closed with explicit errors instead of silently succeeding.
- Release metadata belongs in `applications.cat_applications`, not in parallel state tables.

## Runtime Sync Rules

- Publication sync and file-bundle install reuse the same schema sync engine.
- Maintenance and error states are persisted through the central sync-state store.
- Advisory locking serializes per-application sync work before schema mutation begins.
- Runtime DDL orchestration stays in the package DDL boundary, not in route code.

## Testing Expectations

- Prefer direct tests for SQL-first stores and sync-state helpers.
- Route tests may mock services, but critical persistence contracts still need direct unit coverage.
- When a route composes sync flows, verify both success and fail-closed error paths.

## References

- `README.md`
- `src/ddl/index.ts`
- `src/services/`
- `src/persistence/`
