# @universo/applications-backend

Backend package for applications, connectors, memberships, runtime sync, and release-bundle orchestration in Universo Platformo.

## Overview

This package owns the application-side metadata and runtime coordination layer.
It exposes authenticated CRUD routes, application membership guards, connector flows, runtime schema sync routes, and release-bundle export/apply endpoints.

## Architecture

- Domain routes and persistence helpers are SQL-first and use `DbExecutor` or `SqlQueryable`.
- Authenticated request flows use Tier 1 request-scoped executors with RLS context.
- Admin, bootstrap, and background flows use Tier 2 pool executors from `@universo/database`.
- Raw Knex is allowed only inside the package-local Tier 3 DDL boundary at `src/ddl/index.ts`.
- Mutation helpers use `RETURNING id` and fail closed when zero rows are affected.

## Main Responsibilities

- Manage applications, connectors, memberships, and publication links.
- Allow owner/admin visibility changes after creation while keeping workspace mode structural.
- Expose runtime sync, diff, and release-bundle routes for managed application schemas.
- Manage application-side layouts, including metahub lineage, application-owned copies, defaults, activation, and widget activity.
- Materialize curated runtime menu contracts from `menuWidget` config, including explicit section items, hub/catalog codename resolution, overflow items, start-page selection, and workspace entry placement.
- Execute published runtime scripts through a fail-closed server bridge that only exposes non-lifecycle server methods from `rpc.client` scripts and reuses runtime row helpers, workspace context, and permission maps.
- Persist schema sync state in `applications.cat_applications` through SQL-first stores.
- Keep runtime release metadata in the same central sync-state surface.
- Reuse shared guards, identifier helpers, and query helpers from the database standard packages.

## Workspaces, Public Access, and Limits

- Applications can be created as `closed` or `public`, and owners/admins can later change visibility from Application Settings.
- Switching a public application back to closed blocks new direct joins and public runtime link resolution while preserving existing members.
- Public applications default to `workspacesEnabled = true` in the UI, but owners may turn workspace mode off during creation when they intentionally want a shared data surface.
- Runtime schema bootstrap creates workspace support tables, seeds `owner` and `member` workspace roles, and provisions a personal `Main` workspace for the owner and every current member.
- Public workspace-enabled applications also receive a seeded shared `Published` workspace during schema sync. Public runtime access-link reads resolve through shared workspaces only, so personal workspace data stays isolated.
- Adding a new member to an application with initialized workspace runtime support provisions a personal workspace automatically.
- Leaving an application or removing a member archives the personal workspace instead of hard-deleting business rows.
- Published runtime workspace endpoints expose paginated workspace/member lists, email-based shared-workspace member invitation for active application members, default workspace switching, and owner-only member removal.
- Catalog tables and TABLE child tables become workspace-scoped in runtime schemas, and backend routes enforce per-workspace row limits before inserts and copies.

## Database Access Rules

- Application-domain reads use `_upl_deleted = false AND _app_deleted = false`.
- Dynamic identifiers go through `qSchema`, `qTable`, `qSchemaTable`, or `qColumn`.
- Domain SQL stays schema-qualified and parameterized with `$1`, `$2`, and later bindings.
- Route handlers choose the executor tier at the boundary instead of importing Knex directly.
- DDL helpers remain isolated from route and store code even when runtime sync needs schema generation.

## Runtime Sync Model

- Publication-driven sync and file-bundle install share the same schema sync engine.
- Successful sync writes `schema_status`, `schema_snapshot`, and `installed_release_metadata` into `applications.cat_applications`.
- Workspace-enabled applications also persist a workspace contract marker inside the canonical runtime snapshot lineage so incremental sync keeps workspace DDL intact.
- Layout sync preserves application-owned layouts, marks locally modified metahub layouts as conflicts instead of overwriting them, and keeps excluded metahub layouts excluded on later syncs.
- Active runtime script codenames are unique per `(attached_to_kind, attached_to_id, module_role, codename)` scope, and sync repairs the scoped index for existing schemas.
- Advisory locking serializes sync work per application before schema changes begin.
- Maintenance and error states are persisted through the same central store contract.

## Package Surface

- `createApplicationsRoutes(...)` mounts CRUD, connector, membership, and runtime-sync routes.
- The route surface now includes public join/leave flows and settings endpoints for per-workspace catalog limits.
- Application layout endpoints are mounted under `/applications/:applicationId/layouts` and `/applications/:applicationId/layout-scopes`.
- `initializeRateLimiters()` prepares package-level rate limiting before route creation.
- Persistence helpers in `src/services/` and `src/persistence/` form the SQL-first write/read seams.
- Platform migration definitions stay in the package migration surface instead of route handlers.

## Controller Architecture

Route files delegate to domain controllers that encapsulate handler logic:

- **`applicationsController.ts`** — application CRUD, membership management, runtime row operations.
- **`connectorsController.ts`** — connector CRUD and publication link management.
- **`syncController.ts`** — runtime schema sync, diff, and release-bundle operations.
- **`applicationLayoutsController.ts`** — application layout scopes, layout CRUD/copy, and layout widget mutations.

### `asyncHandler()`

Express middleware wrapper that catches rejected promises and forwards errors to `next()`:

```ts
import { asyncHandler } from '../shared/asyncHandler'
router.get('/apps', asyncHandler(async (req, res) => { /* ... */ }))
```

### `runtimeHelpers.ts`

Shared helpers for runtime row controllers: query validation, executor resolution, schema assertions, and response formatting — extracted from inline route logic (~920 lines, 60+ exports).

## Development

```bash
pnpm --filter @universo/applications-backend lint
pnpm --filter @universo/applications-backend test
pnpm --filter @universo/applications-backend build
```

## Related References

- [MIGRATIONS.md](MIGRATIONS.md)
- [MIGRATIONS-RU.md](MIGRATIONS-RU.md)
- [Database access standard](../../../docs/en/architecture/database-access-standard.md)
- [Database review checklist](../../../docs/en/contributing/database-code-review-checklist.md)

## Related Packages

- `@universo/applications-frontend` for application management UI.
- `@universo/database` for Knex runtime ownership and executor factories.
- `@universo/utils` for neutral executor/query helper contracts.
- `@universo/schema-ddl` for runtime schema generation and diff execution.

## License

Omsk Open License
