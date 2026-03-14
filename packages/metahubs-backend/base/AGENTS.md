# Metahubs Backend — AI Agent Guide

## Scope

This package owns design-time metahub resources, publication metadata, template seeding, metahub migration control, and package-local DDL seams.
It does not own the final application runtime route surface even when publication flows trigger downstream sync behavior.

## Database Access Rules

- Domain routes and services use `DbExecutor` or `SqlQueryable`.
- Request-visible work should stay on Tier 1 or Tier 2 executors, not raw Knex.
- Raw Knex is valid only inside DDL seams and schema-ddl integration boundaries.
- Dynamic schema names and table names must use shared identifier helpers.
- Branch-schema active rows require `_upl_deleted = false AND _mhb_deleted = false`.

## Mutation Rules

- Copy, delete, restore, reorder, and update flows must fail closed on stale or missing rows.
- Service-level delete and restore paths should constrain row state, not mutate by bare `id` only.
- Mutations should use `RETURNING` when the contract depends on affected-row confirmation.
- Route handlers should not hide service-level races behind silent success paths.
- Cross-schema joins must use the correct predicate for each alias.

## DDL And Publication Rules

- Keep schema generation and DDL transport access inside package-local boundaries.
- Publication routes may compose downstream application sync seams but should not absorb application runtime ownership.
- Template seeding and migration orchestration may use DDL helpers, but domain services stay SQL-first.
- The package uses the shared Knex runtime from `@universo/database`; no private runtime singleton belongs here.

## Testing Expectations

- Add direct service tests when route tests mock the service layer.
- Preserve regressions for active-row predicates, fail-closed delete/restore behavior, and publication sync boundaries.
- Prefer SQL-contract assertions for stores and service helpers over broad route-only coverage.

## References

- `README.md`
- `src/domains/`
- `src/persistence/`
- `src/platform/migrations/`
