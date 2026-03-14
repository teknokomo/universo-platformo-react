# Metahubs Backend (@universo/metahubs-backend)

Backend package for metahub design-time resources, publication metadata, template seeding, and controlled runtime schema orchestration.

## Overview

This package owns the design-time side of the platform: metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, settings, templates, publications, and migration-control routes.
It combines SQL-first domain services with isolated DDL boundaries, template seeding, publication export flows, and metahub-specific runtime schema coordination.

## Architecture

- Domain routes and services use `DbExecutor` or `SqlQueryable` instead of raw Knex builders.
- Branch-schema reads and writes respect the metahub active-row predicate `_upl_deleted = false AND _mhb_deleted = false`.
- Tier 3 raw Knex stays isolated in the package DDL seams and schema-ddl integration paths.
- Publication-driven application sync is composed through package boundaries instead of duplicating runtime ownership here.
- Service-level mutations fail closed and use `RETURNING` when row confirmation matters.

## Main Responsibilities

- Expose authenticated CRUD routes for design-time metahub resources.
- Expose public read-only routes for published metahub data.
- Initialize rate limiters and assemble the full metahubs router tree.
- Seed built-in templates through the unified platform migration flow.
- Provide metahub migration history, dry-run, apply, rollback, and publication-linked sync seams.
- Keep DDL orchestration behind dedicated package-local boundaries.

## Database Access Rules

- Request-visible domain work uses request or pool executors, never direct Knex imports.
- Dynamic schema, table, and column identifiers go through shared quoting helpers.
- Domain SQL is schema-qualified and parameterized with PostgreSQL-style bindings.
- Copy, delete, restore, and reorder flows must preserve active-row and fail-closed contracts.
- Package-local DDL helpers are the only valid place for raw Knex and schema-ddl transport wiring.

## DDL And Publication Boundaries

- Native SQL platform migration definitions live in `src/platform/migrations/`.
- Runtime schema generation, diffing, and rollback primitives come from `@universo/schema-ddl`.
- The package consumes the shared runtime from `@universo/database`; it does not own a private Knex singleton.
- Publication routes may trigger downstream application sync seams, but application runtime route ownership stays in `@universo/applications-backend`.

## Router Composition

- `createMetahubsServiceRoutes()` mounts metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, settings, publications, and migration endpoints.
- `createPublicMetahubsServiceRoutes()` exposes public published-metahub reads without authentication.
- Package services and persistence helpers stay reusable outside the top-level router composition.
- Tests prove service-level contracts directly where route tests use mocks.

## Development

```bash
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/metahubs-backend test
pnpm --filter @universo/metahubs-backend build
```

## Related References

- [Database access standard](../../../docs/en/architecture/database-access-standard.md)
- [Database review checklist](../../../docs/en/contributing/database-code-review-checklist.md)
- [Creating packages](../../../docs/en/contributing/creating-packages.md)
- [MIGRATIONS.md](MIGRATIONS.md)

## Related Packages

- `@universo/database` for Knex runtime ownership and executor factories.
- `@universo/migrations-core` and `@universo/migrations-catalog` for migration planning and lifecycle tracking.
- `@universo/schema-ddl` for runtime schema generation and DDL execution.
- `@universo/applications-backend` for downstream application runtime sync ownership.

## License

Omsk Open License
