# Universo Core Backend (@universo/core-backend)

Main backend server package for Universo Platformo.

## Overview

This package boots the Express application, initializes the shared Knex runtime, runs registered platform migrations, mounts service routers, and serves the frontend bundle. It is the composition root for authentication, metahubs, applications, onboarding, admin, and profile services.

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

1. Validate auth configuration for either legacy `SUPABASE_JWT_SECRET` verification or modern Supabase JWKS verification.
2. Initialize the shared Knex singleton from `@universo/database`.
3. Validate and run registered platform migrations through `@universo/migrations-platform`.
4. If `BOOTSTRAP_SUPERUSER_ENABLED=true`, create or confirm the startup superuser through the Supabase Admin API, repair the profile row if needed, and enforce the exclusive global `superuser` role.
5. Configure sessions, CSRF, CORS, JWT auth, sanitization, and request logging.
6. Initialize rate limiters for downstream service packages.
7. Mount `/api/v1` routers and serve the frontend bundle from `@universo/core-frontend`.

## Key Integrations

-   `@universo/database` provides `getKnex()`, `destroyKnex()`, and executor factories.
-   `@universo/migrations-platform` owns startup validation and unified platform migration execution.
-   `@universo/auth-backend` provides Passport setup, auth routes, and RLS-aware auth middleware.
-   `@universo/metahubs-backend`, `@universo/applications-backend`, `@universo/start-backend`, `@universo/admin-backend`, and `@universo/profile-backend` provide domain routers mounted by the core server.

## Routing Model

The server mounts a shared `/api/v1` router that combines:

-   public health and public metahub endpoints
-   authenticated metahub, applications, onboarding, admin, and profile routes
-   optimistic-lock conflict mapping and database timeout handling

Request-scoped database access is derived from the shared Knex runtime and request-aware executor helpers instead of TypeORM `DataSource` or `EntityManager` objects.

## Build And Test

```bash
pnpm --filter @universo/core-backend build
pnpm --filter @universo/core-backend test
```

## Local Supabase

Before using the local Supabase commands, install and start Docker. Supabase local development is managed by the Supabase CLI, but the actual services run as Docker containers. Install either Docker Desktop or Docker Engine for your operating system, make sure the Docker daemon is running, and verify access from the repository root:

```bash
docker --version
docker ps
pnpm exec supabase --version
```

On Linux, configure your user so Docker commands do not require `sudo`, then restart the terminal session before running the project commands.

The backend can run against a local Supabase Docker stack through explicit env profiles generated from `supabase status -o env`:

```bash
pnpm supabase:local:start
pnpm doctor:local-supabase
pnpm start:local-supabase
```

`start:local-supabase` also runs `supabase:local:start` first, so it is safe to use it directly after Docker is available. Keeping the explicit `doctor:local-supabase` command in the sequence is useful when you want a fast readiness check without starting the application.

You can also use local Supabase without this profile mechanism by copying the local Supabase URL, keys, and PostgreSQL settings directly into `packages/universo-core-backend/base/.env` and then running the normal `pnpm start` / `pnpm start:allclean` commands. The profile mechanism is still recommended because it keeps hosted and local settings separate, regenerates local keys after `supabase:local:nuke`, runs a doctor before destructive flows, and prevents accidental resets against hosted Supabase.

The generated backend profile is `packages/universo-core-backend/base/.env.local-supabase`; E2E uses `.env.e2e.local-supabase`. Both files are gitignored and must stay local.

Generation preserves the normal backend environment contract:

1. For development, the generator uses `packages/universo-core-backend/base/.env` as the base when it exists.
2. If `.env` is missing, it uses `packages/universo-core-backend/base/.env.example`.
3. If neither file exists, it falls back to a minimal generated local profile.

Only local Supabase/PostgreSQL values, `NODE_ENV`, `UNIVERSO_ENV_TARGET`, and safe missing defaults are replaced. Existing application settings such as `BOOTSTRAP_SUPERUSER_ENABLED`, rate limits, reset flags, admin toggles, storage settings, and feature flags are kept from the base env file. Hosted-only Postgres/Auth overrides such as `DATABASE_SSL_KEY_BASE64`, `SUPABASE_JWKS_URL`, and `SUPABASE_JWT_ISSUER` are cleared for local Supabase.

Use `pnpm start:allclean:local-supabase` for a full rebuild plus database reset against local Supabase. The script starts the local Supabase stack, runs `doctor:local-supabase`, and passes `UNIVERSO_ENV_FILE` explicitly so hosted Supabase `.env` files are not changed.

When the application only needs the local database, Auth, REST API, service-role Admin API, and Studio, use the minimal startup commands. They skip realtime, storage, imgproxy, edge runtime, logflare, and vector containers while keeping the same generated env profile and doctor checks:

```bash
pnpm start:local-supabase:minimal
pnpm start:allclean:local-supabase:minimal
```

Use the full stack when you are testing Supabase Storage, realtime channels, Edge Functions, or logging services.

The local Supabase web console is Supabase Studio. By default the CLI exposes it at `http://127.0.0.1:54323`. Open this URL to inspect local database tables, Auth users, SQL editor, storage tools when storage is running, API settings, and other local Supabase administration tools. The application itself uses the local API URL on `http://127.0.0.1:54321`; Studio is the browser administration UI.

Local Supabase commands:

```bash
pnpm supabase:local:start          # Start the local Supabase Docker stack and regenerate local dev env files.
pnpm supabase:local:start:minimal  # Start a lighter stack without realtime/storage/imgproxy/edge/logflare/vector.
pnpm supabase:local:status         # Print Supabase CLI status.
pnpm doctor:local-supabase         # Validate Auth, REST, service role, JWT secret, and direct Postgres.
pnpm start:local-supabase          # Start Supabase, run doctor, then start the app on the local profile.
pnpm start:local-supabase:minimal  # Start the app on the lighter local Supabase stack.
pnpm start:allclean:local-supabase # Start Supabase, run doctor, rebuild, reset the local DB, then start the app.
pnpm start:allclean:local-supabase:minimal # Rebuild and reset against the lighter local Supabase stack.
pnpm supabase:local:stop           # Stop local Supabase containers and keep Docker volumes/data.
pnpm supabase:local:nuke           # Stop local Supabase and delete its local Docker volumes/data.
```

For E2E local Supabase runs:

```bash
pnpm supabase:e2e:start:minimal
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

E2E local Supabase uses a separate CLI project, Docker volumes, and ports from manual local development. The dedicated E2E API is `http://127.0.0.1:55321`, database is `127.0.0.1:55322`, and Studio is `http://127.0.0.1:55323`. The default E2E local stack is minimal. Use `pnpm supabase:e2e:start` or the `:full` E2E variants only when the test needs Storage, Realtime, Edge Functions, or logging services.

Additional E2E Supabase commands:

```bash
pnpm supabase:e2e:start:minimal          # Start the dedicated E2E local Supabase minimal stack.
pnpm supabase:e2e:start                  # Start the dedicated E2E local Supabase full stack.
pnpm supabase:e2e:status                 # Print status for the dedicated E2E local Supabase profile.
pnpm supabase:e2e:stop                   # Stop the dedicated E2E local Supabase profile and keep data.
pnpm supabase:e2e:nuke                   # Stop the dedicated E2E profile and delete its Docker volumes/data.
pnpm run build:e2e:local-supabase:full   # Build E2E with the full local Supabase stack.
pnpm run test:e2e:smoke:local-supabase:full # Run smoke E2E with the full local Supabase stack.
```

E2E source selection is controlled by `E2E_SUPABASE_PROVIDER` and `E2E_SUPABASE_ISOLATION`. The safe default is `hosted + dedicated`, using `.env.e2e.local` / `.env.e2e`. Reusing the main `.env` or the dev local Supabase profile is intentionally discouraged and requires `E2E_ALLOW_MAIN_SUPABASE=true` plus `E2E_FULL_RESET_MODE=off`.

## Bootstrap Superuser

The core backend can provision the first platform superuser automatically during startup. This flow is intended for a fresh platform bootstrap and uses a real Supabase auth account instead of direct SQL writes into `auth.users`.

Required backend env contract when bootstrap is enabled:

```env
SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your_server_only_service_role_key
BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=stalin@kremlin.ru
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

Notes:

-   `BOOTSTRAP_SUPERUSER_ENABLED` defaults to `true`.
-   `BOOTSTRAP_SUPERUSER_EMAIL` and `BOOTSTRAP_SUPERUSER_PASSWORD` ship as demo credentials for local/dev bootstrap only.
-   Change the demo email and password before any real deployment.
-   If the bootstrap email already belongs to an existing non-superuser account, startup fails fast instead of silently elevating that account.
-   If the account already exists and is already a superuser, startup becomes a safe no-op and only repairs the missing profile row if necessary.

## Migration Commands

Run workspace-level migration helpers from the repository root:

```bash
pnpm migration:status
pnpm migration:plan
pnpm migration:diff
pnpm migration:export
```

## Notes

-   The package still contains compatibility exports under `src/database/entities/` for code that has not been fully trimmed yet.
-   The canonical database runtime is Knex-based and shared through `@universo/database`.
-   New backend services should register native SQL platform migration definitions instead of TypeORM entities and migrations.
-   For Supabase Postgres connectivity in this project, use direct connection when your host can reach it reliably; otherwise prefer the session pooler on `:5432`. Do not use the transaction pooler on `:6543` because request-scoped RLS depends on pinned session state.
-   The auth login/register limiter defaults to `10` attempts per `60_000ms`. Dedicated e2e environments can raise `AUTH_LOGIN_RATE_LIMIT_MAX` and `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` instead of changing the production-safe defaults in code.
