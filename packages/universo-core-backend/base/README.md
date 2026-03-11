# Universo Core Backend (@universo/core-backend)

Main backend server package for Universo Platformo.

## Overview

This package boots the Express application, initializes the shared Knex runtime, runs registered platform migrations, mounts service routers, and serves the frontend bundle.
It is the composition root for authentication, metahubs, applications, onboarding, admin, and profile services.

## Package Structure

```text
packages/universo-core-backend/base/
├── src/
│   ├── commands/        # Oclif CLI commands
│   ├── database/        # Legacy entity exports still kept for compatibility
│   ├── errors/          # Shared backend error types
│   ├── middlewares/     # Error and request middleware
│   ├── routes/          # API composition and global API error handling
│   ├── utils/           # Logging, telemetry, XSS, helpers
│   ├── Interface.ts     # Public app interface types
│   └── index.ts         # App bootstrap and server lifecycle
├── bin/                 # Oclif runtime entrypoint
├── package.json
└── tsconfig.json
```

## Startup Flow

1. Validate required auth configuration such as `SUPABASE_JWT_SECRET`.
2. Initialize the shared Knex singleton from `@universo/database`.
3. Validate and run registered platform migrations through `@universo/migrations-platform`.
4. Configure sessions, CSRF, CORS, JWT auth, sanitization, and request logging.
5. Initialize rate limiters for downstream service packages.
6. Seed metahub templates through `@universo/metahubs-backend`.
7. Mount `/api/v1` routers and serve the frontend bundle from `@universo/core-frontend`.

## Key Integrations

- `@universo/database` provides `getKnex()`, `destroyKnex()`, and executor factories.
- `@universo/migrations-platform` owns startup validation and unified platform migration execution.
- `@universo/auth-backend` provides Passport setup, auth routes, and RLS-aware auth middleware.
- `@universo/metahubs-backend`, `@universo/applications-backend`, `@universo/start-backend`, `@universo/admin-backend`, and `@universo/profile-backend` provide domain routers mounted by the core server.

## Routing Model

The server mounts a shared `/api/v1` router that combines:

- public health and public metahub endpoints
- authenticated metahub, applications, onboarding, admin, and profile routes
- optimistic-lock conflict mapping and database timeout handling

Request-scoped database access is derived from the shared Knex runtime and request-aware executor helpers instead of TypeORM `DataSource` or `EntityManager` objects.

## Build And Test

```bash
pnpm --filter @universo/core-backend build
pnpm --filter @universo/core-backend test
```

## Migration Commands

Run workspace-level migration helpers from the repository root:

```bash
pnpm migration:status
pnpm migration:plan
pnpm migration:diff
pnpm migration:export
```

## Notes

- The package still contains compatibility exports under `src/database/entities/` for code that has not been fully trimmed yet.
- The canonical database runtime is Knex-based and shared through `@universo/database`.
- New backend services should register native SQL platform migration definitions instead of TypeORM entities and migrations.
