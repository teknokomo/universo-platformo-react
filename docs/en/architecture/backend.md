---
description: Describe the backend runtime and server-side package composition.
---

# Backend Architecture

The backend is centered on `@universo/core-backend`, which boots the Express
application, initializes the shared Knex runtime, runs platform migrations,
mounts service routers, and serves the frontend bundle.

## Runtime Pattern

- Express provides HTTP routing and middleware composition.
- Feature packages own routes, services, and SQL-first persistence helpers.
- `@universo/migrations-platform` validates and runs platform migrations.
- `@universo/database` provides the shared Knex singleton and executor factories.

## Controller–Service–Store Pattern

Domain route files follow the **Controller–Service–Store** pattern:

- **Thin Routes** (`*Routes.ts`) — declare HTTP method + path + controller ref. Typically 25–80 lines.
- **Controller** (`*Controller.ts`) — request handling: parse params, call services/stores, build response. Each handler is wrapped in `createMetahubHandler()` which provides `(req, res, { metahub, executor })` context with membership verification and error mapping.
- **Service** (optional) — complex business logic spanning multiple stores.
- **Store** (`*Store.ts`) — raw SQL via `DbExecutor.query()` with parametrized queries (`$1`, `$2`, …).

### createMetahubHandler

The shared `createMetahubHandler(fn, options?)` helper:
1. Resolves the metahub from `:metahubId` route param.
2. Verifies membership (or superuser/synthetic access).
3. Obtains a request-scoped `DbExecutor` with RLS context.
4. Catches errors: `MetahubDomainError` → structured JSON, Axios-like → status forwarding, generic → 500.

### Domain Error Handling

Domains throw `MetahubDomainError(message, code, status)` for structured errors (e.g., `LIMIT_EXCEEDED`, `CONFLICT`). These are caught by `createMetahubHandler` and returned as `{ error, code, …extras }`.

## Domain Structure

Each backend domain lives under `src/domains/<name>/` with:

```
routes/           — thin route declarations
controllers/      — request handlers
services/         — business logic (optional)
stores/           — SQL persistence
schemas/          — Zod validation schemas (optional)
```

### Active Domains (metahubs-backend)

| Domain | Handlers | Description |
|--------|----------|-------------|
| metahubs | — | Metahub CRUD, membership, copy, and board summary flows |
| entities | — | Entity type definitions, entity instances, metadata resources, actions, and event bindings |
| shared | — | Resources workspace containers, shared overrides, and shared helpers |
| branches | — | Branch lifecycle and activation |
| layouts | — | Shared layouts, widgets, and view behavior persistence |
| publications | — | Publication workflows, sync, versioning, export, and import |
| scripts | — | Design-time scripts, shared libraries, and bundle validation |
| settings | — | Per-metahub settings |
| templates | — | Built-in template and preset registry |
| ddl | — | Package-local runtime DDL boundaries |

### Active Domains (applications-backend)

| Domain | Handlers | Description |
|--------|----------|-------------|
| applications | — | Application CRUD, members, settings, layouts, and workspaces |
| connectors | — | Connector lifecycle, publication links, and schema sync |

## Current Domain Surface

The active public backend surface includes auth, onboarding, profiles,
metahubs, publications, applications, admin flows, and OpenAPI docs support.

This is a modular business backend for shared platform services.
