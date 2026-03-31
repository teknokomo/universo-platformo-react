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
| metahubs | 14 | Core CRUD, membership, copy |
| catalogs | 16 | Catalog lifecycle with hub scoping |
| attributes | 14 | Attribute management, child attributes, system fields |
| enumerations | 24 | Enum types and values with ordering |
| elements | 8 | Row-level CRUD with dynamic schemas |
| hubs | — | Hub grouping and ordering |
| sets | — | Set/constant grouping |
| constants | — | Constant value management |
| branches | 9 | Branch lifecycle and activation |
| layouts | 13 | Dashboard/widget layout persistence |
| publications | 15 | Publication workflows, sync, versioning |
| settings | 4 | Per-metahub settings |
| migrations | 8 | Runtime DDL migration management |

### Active Domains (applications-backend)

| Domain | Handlers | Description |
|--------|----------|-------------|
| applications | 20+ | Application CRUD, templates, workspaces |
| connectors | 18 | Connector lifecycle, sync engine |

## Current Domain Surface

The active public backend surface includes auth, onboarding, profiles,
metahubs, publications, applications, admin flows, and OpenAPI docs support.

This is a modular business backend for shared platform services.
