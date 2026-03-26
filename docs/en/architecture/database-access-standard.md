---
description: Explain the converged PostgreSQL tier model, allowed Knex boundaries, and SQL-first review rules.
---

# Database Access Standard

The repository uses one auditable PostgreSQL access standard across backend domain packages.
Knex remains the shared transport and DDL engine, but day-to-day domain logic talks through neutral executor contracts and SQL-first stores.

## Tier Model

1. Tier 1 uses a request-scoped `DbExecutor` with one pinned connection and RLS claims.
2. Tier 2 uses a pool-level `DbExecutor` for admin, bootstrap, and public non-RLS work.
3. Tier 3 keeps raw Knex only in infrastructure, migrations, and package-local DDL boundaries.

## Core Rules

- Domain routes and services accept `DbExecutor` or `SqlQueryable`.
- Domain code does not import `knex` or `KnexClient` directly.
- Dynamic identifiers go through `qSchema`, `qTable`, `qSchemaTable`, and `qColumn`.
- Mutating DML uses `RETURNING` so callers observe the committed row shape.
- Active-row reads must respect the owning domain soft-delete contract.
- Admin `SECURITY DEFINER` helper functions that accept `user_id` arguments may use explicit foreign user ids only from Tier 2 backend/bootstrap contexts; request-scoped authenticated sessions must stay self-scoped to `auth.uid()`.
- Zero-row writes fail closed instead of silently succeeding after stale lookups or races.
- Advisory locks go through shared helpers instead of route-local or service-local raw helper forks.
- Long-running work sets explicit `SET LOCAL lock_timeout` and `statement_timeout` budgets.
- Schema-qualified names are required; domain SQL does not rely on `search_path`.

## Allowed Tier 3 Boundaries

- `@universo/schema-ddl` and migration packages own direct Knex DDL orchestration.
- `@universo/database` owns the shared Knex lifecycle and executor factories.
- `@universo/applications-backend` keeps raw Knex behind `src/ddl/index.ts` for runtime sync DDL orchestration.
- `@universo/metahubs-backend` keeps raw Knex inside its DDL seams and schema-ddl integration paths.
- These boundaries may bridge back into executor-style contracts, but route and store code outside them stay SQL-first.

## Request Flow

1. `ensureAuthWithRls` pins one connection and applies `request.jwt.claims`.
2. Route handlers choose request executor or pool executor at the boundary.
3. Services and stores run schema-qualified parameterized SQL through shared query and identifier helpers.
4. DDL or migration code stays in Tier 3 and may keep direct Knex access inside dedicated boundaries only.

## Review Expectations

- New persistence helpers should have direct unit tests, not only route-level mocks.
- Route handlers should choose the correct tier once and pass neutral contracts downward.
- Copy, delete, restore, and sync flows should prove their fail-closed behavior explicitly.
- Package documentation and `AGENTS.md` guidance should match the same tier rules.

## Enforcement

- `tools/lint-db-access.mjs` blocks forbidden Knex usage in domain packages.
- CI runs the lint-db-access step before the workspace build.
- Reviewers use the database code review checklist in the contributing docs.

## Related References

- [Database Design](database.md)
- [Backend Architecture](backend.md)
- [Database Code Review Checklist](../contributing/database-code-review-checklist.md)