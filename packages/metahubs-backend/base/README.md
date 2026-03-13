# Metahubs Backend (@universo/metahubs-backend)

Backend package for metahub design-time operations, publication metadata, template seeding, and runtime schema orchestration in Universo Platformo.

## Overview

This package owns the metadata authoring side of the platform: metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, templates, settings, publications, and migration control endpoints.
It integrates with the shared Knex runtime, the unified platform migration catalog, and the schema DDL toolkit.

## Package Structure

```text
packages/metahubs-backend/base/
├── src/
│   ├── domains/             # Domain modules, routes, services, guards, DDL facade
│   ├── persistence/         # Shared SQL-first persistence helpers
│   ├── platform/migrations/ # Native SQL platform migration definitions
│   ├── services/            # Cross-domain services
│   ├── tests/               # Package regression tests
│   ├── types/               # Shared metahub contracts
│   ├── utils/               # Package utilities
│   └── index.ts             # Public package surface
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Responsibilities

- Expose authenticated CRUD routes for metahub design-time resources.
- Expose public read-only endpoints for published metahubs.
- Initialize package rate limiters and compose the full metahubs service router.
- Seed built-in metahub templates through the unified platform migration flow.
- Provide metahub migration history, dry-run, apply, rollback, and application sync endpoints.
- Re-export DDL services from `@universo/schema-ddl` preconfigured with the shared Knex runtime.

## Migration And DDL Model

- Native SQL platform migration definitions live in `src/platform/migrations/`.
- Controlled migration execution is tracked through `@universo/migrations-core` and `@universo/migrations-catalog`.
- Runtime schema generation, diffing, and rollback primitives come from `@universo/schema-ddl`.
- The package no longer owns a private Knex singleton; DDL helpers use the shared runtime from `@universo/database`.

## Router Composition

`createMetahubsServiceRoutes()` mounts:

- metahubs and branches
- publications
- metahub migration endpoints
- application migration and sync endpoints
- hubs, catalogs, sets, enumerations, attributes, constants, elements, and layouts
- settings and template catalog routes

`createPublicMetahubsServiceRoutes()` exposes public published-metahub reads without authentication.

## Build And Test

```bash
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-backend test
```

## Related Packages

- `@universo/database` provides the shared Knex runtime.
- `@universo/migrations-core` and `@universo/migrations-catalog` provide migration tracking and dry-run planning.
- `@universo/schema-ddl` provides schema generation and migration primitives.
- `@universo/applications-backend` consumes publication and runtime schema outputs downstream.
