---
description: The shortest safe path from clone to a locally running instance.
---

# Quick Start

## Recommended Flow

1. Clone the repository and run `pnpm install` from the root.
2. Add local backend environment variables.
3. Run `pnpm build` from the root.
4. Run `pnpm start` from the root.
5. Open `http://localhost:3000`.

## Local Supabase Flow

Use this flow when hosted Supabase is unavailable or when you need a fully local disposable database and Auth instance:

Prerequisite: install Docker Desktop or Docker Engine, start the Docker daemon, and verify `docker ps` works from your terminal. The Supabase CLI controls the local stack, but the services themselves run in Docker containers.

```bash
pnpm install
pnpm build
pnpm start:local-supabase
```

`start:local-supabase` starts the local Supabase stack, generates the local profile, runs the doctor checks, and then starts the app.

For the lighter local stack used by the current app runtime, run:

```bash
pnpm start:local-supabase:minimal
```

This keeps Postgres, Auth, REST, service-role Admin API, and Studio available while skipping realtime, storage, imgproxy, edge runtime, logflare, and vector.

Supabase Studio is the local web console. By default it is available at `http://127.0.0.1:54323` and gives access to local database, Auth, SQL editor, API, and other Supabase administration tools.

For a fresh rebuild with a local database reset:

```bash
pnpm start:allclean:local-supabase
```

The matching lighter reset flow is:

```bash
pnpm start:allclean:local-supabase:minimal
```

The local flow does not rewrite the normal `.env` files. It uses generated, gitignored `.env.local-supabase` profiles and explicit `UNIVERSO_ENV_FILE` values, so switching back to hosted Supabase remains the normal `pnpm start` command.

The generated backend profile is derived from the normal backend `.env` when it exists, or from `.env.example` otherwise. The generator keeps the rest of the application settings and replaces only the local Supabase/PostgreSQL connection values plus local execution markers.

Browser E2E has its own dedicated local Supabase profile:

```bash
pnpm supabase:e2e:start:minimal
pnpm run test:e2e:smoke:local-supabase
```

This E2E profile uses separate Docker volumes and ports from manual local development: API `55321`, Postgres `55322`, and Studio `55323`, while the manual development Studio remains on `54323`.

## Why This Flow

The root build validates cross-package dependencies and produces the artifacts expected by the start command.

The repository also exposes `pnpm dev`, but that mode is resource-intensive and should be used only when you explicitly need live development servers.

## After Startup

![Metahub creation dialog](../.gitbook/assets/entities/metahub-create-dialog.png)

Once the app is running, continue with the Platform section for domain context or with the Architecture section for implementation details.
