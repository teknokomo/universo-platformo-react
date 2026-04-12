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

## Legacy-Compatible Entity V2 Contract

- `config.compatibility.legacyObjectKind` is the source of truth for catalog, hub, set, and enumeration compatibility.
- Custom V2 rows keep their custom `kindKey` in `_mhb_objects.kind`; controllers widen legacy kind sets through compatibility helpers instead of rewriting stored kinds.
- Hubs, catalogs, sets, and enumerations controllers accept `kindKey`-aware compatibility filters so the legacy route family can serve both built-in and compatible custom rows.
- Publication, runtime, and schema seams classify V2 kinds through compatibility metadata so only catalog-compatible sections materialize in runtime navigation.

## Main Responsibilities

- Expose authenticated CRUD routes for design-time metahub resources.
- Keep design-time script source and bundle surfaces behind `manageMetahub` permission instead of broad member-level reads.
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
- Active design-time script codenames are unique only inside the attachment scope tuple `(attached_to_kind, attached_to_id, module_role)`.
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

## Controller–Service–Store Pattern

Each domain follows a three-layer split:

1. **Routes** (`domains/<domain>/routes/<domain>Routes.ts`) — thin Express route definitions (parameter extraction, response codes, delegation to controller).
2. **Controller** (`domains/<domain>/controllers/<domain>Controller.ts`) — handler functions that validate input, call services/stores, and return responses.
3. **Store** (`persistence/<domain>Store.ts`) — raw SQL queries via `DbExecutor.query()` with parameterized bindings.

### `createMetahubHandler()`

Factory-generated handler that wraps every metahub-scoped controller action:
- Resolves `userId` from the request.
- Obtains a request-scoped `DbExecutor` (with RLS context).
- Runs `ensureMetahubAccess()` permission check.
- Provides a `MetahubHandlerContext` (`req`, `res`, `userId`, `metahubId`, `exec`, `schemaService`) to the handler.

```ts
const handle = createMetahubHandler(getDbExecutor)
router.get('/:metahubId/hubs', handle(hubsController.list, { permission: 'viewer' }))
```

### Domain Error Hierarchy

`MetahubDomainError` is the base class with `statusCode`, `code`, and optional `details`:

| Subclass | Status | Code |
|---|---|---|
| `MetahubMigrationRequiredError` | 428 | `MIGRATION_REQUIRED` |
| `MetahubPoolExhaustedError` | 503 | `CONNECTION_POOL_EXHAUSTED` |
| `MetahubSchemaLockTimeoutError` | 503 | `SCHEMA_LOCK_TIMEOUT` |
| `MetahubMigrationApplyLockTimeoutError` | 409 | `MIGRATION_APPLY_LOCK_TIMEOUT` |

### Query Pagination

`paginateItems(items, { limit, offset })` provides in-memory pagination with `{ items, pagination: { limit, offset, total, hasMore } }`. Input validation uses `validateListQuery()` with Zod schema.

### Snapshot Export/Import

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/metahub/:id/export` | Export full metahub as JSON snapshot envelope |
| `POST` | `/api/v1/metahubs/import` | Import snapshot envelope as a new metahub |
| `GET` | `/api/v1/metahub/:id/publication/:pubId/versions/:verId/export` | Export a publication version snapshot |
| `POST` | `/api/v1/metahub/:id/publication/:pubId/versions/import` | Import snapshot as a new publication version |

Import endpoints validate envelope integrity (SHA-256 hash), nesting depth, prototype pollution, and entity count limits. See [Snapshot Export & Import guide](../../../docs/en/guides/snapshot-export-import.md) for details.

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
