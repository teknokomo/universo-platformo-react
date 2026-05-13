---
description: Configure backend and frontend environment files for local startup.
---

# Configuration

## Backend Environment

Create a local `.env` file in `packages/universo-core-backend/base` and provide at least the Supabase/PostgreSQL and auth settings required by the backend.

Typical values include the Supabase URL, anonymous key, JWT secret, database connection settings, session configuration, and other deployment-specific secrets.

Minimum backend contract for first startup:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_public_anon_key
SERVICE_ROLE_KEY=your_server_only_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

Important notes:

-   `SERVICE_ROLE_KEY` is server-only. Never expose it to browser bundles.
-   `BOOTSTRAP_SUPERUSER_ENABLED` defaults to `true`.
-   When bootstrap is enabled, the backend creates or confirms a real Supabase auth user and assigns the exclusive global `superuser` role during startup.
-   The demo bootstrap email and password are for local/dev bootstrap only. Change both before any real deployment.
-   If the bootstrap email already belongs to an existing non-superuser account, startup fails fast instead of silently elevating that account.

## Frontend Environment

If you need frontend overrides, create a local `.env` file in `packages/universo-core-frontend/base`.

Typical values include UI host or port settings such as `VITE_PORT`.

## Configuration Rules

-   Keep real secrets out of version control.
-   Use placeholder-only tracked env files.
-   Re-run the root build after changing shared configuration assumptions.

## Local Supabase Profile

The default `.env` files may continue to point to a hosted Supabase project. For network-independent development, the repository also supports an explicit local Supabase Docker profile.

Prerequisites:

-   Install Docker Desktop or Docker Engine for your operating system.
-   Start the Docker daemon and verify `docker ps` works without errors.
-   Keep the Supabase CLI available through the workspace, for example `pnpm exec supabase --version`.

Start the local stack and generate local-only env files:

```bash
pnpm supabase:local:start
```

This command uses the committed `supabase/config.toml`, creates a Docker network bound to `127.0.0.1`, starts Supabase through the CLI, and writes:

-   `packages/universo-core-backend/base/.env.local-supabase`
-   `packages/universo-core-frontend/base/.env.local-supabase`

The generated files are ignored by git. They contain local Supabase keys and must not be copied into tracked files.

Backend profile generation preserves the full environment contract. The writer uses `packages/universo-core-backend/base/.env` as the preferred base, falls back to `packages/universo-core-backend/base/.env.example`, and uses a minimal generated profile only if neither file exists. It then replaces only local Supabase/PostgreSQL connection values, `NODE_ENV`, `UNIVERSO_ENV_TARGET`, and missing safe defaults. Existing settings such as bootstrap superuser flags, database reset flags, auth rate limits, storage settings, admin flags, and other feature toggles remain inherited from the base env file. Hosted-only values such as `DATABASE_SSL_KEY_BASE64`, `SUPABASE_JWKS_URL`, and `SUPABASE_JWT_ISSUER` are removed so local Supabase can use its own direct Postgres connection and local JWT secret.

This means you normally keep a hosted Supabase setup in the standard `.env`, while `pnpm env:local-supabase` derives a disposable `.env.local-supabase` profile from it and swaps only the local Supabase credentials and direct Postgres connection.

Run the local doctor before starting the platform:

```bash
pnpm doctor:local-supabase
```

The doctor validates Docker, Supabase CLI, Auth health, REST API, service-role Admin API access, direct PostgreSQL connectivity, and the required JWT secret. It fails if the profile points to a hosted Supabase URL, so destructive local commands cannot accidentally reset a remote project.

Start the application against local Supabase:

```bash
pnpm start:local-supabase
```

This command starts the local Supabase stack before generating and checking the profile, so it is safe to run even when the Supabase containers are currently stopped.

For day-to-day work that only needs Postgres, Auth, the REST API, service-role Admin API, and Studio, use the lighter startup command:

```bash
pnpm start:local-supabase:minimal
```

It runs the same env generation and doctor checks but starts Supabase without realtime, storage, imgproxy, edge runtime, logflare, and vector. Use the full `pnpm start:local-supabase` flow when you need any of those services.

Run a clean local rebuild and database reset only against the local profile:

```bash
pnpm start:allclean:local-supabase
```

The allclean local command follows the same guard order: start local Supabase, generate the local profile, run the doctor, rebuild, and then start with `_FORCE_DATABASE_RESET=true` against the local database.

The matching minimal reset command is:

```bash
pnpm start:allclean:local-supabase:minimal
```

The local Supabase web console is Supabase Studio. By default the CLI exposes it at `http://127.0.0.1:54323`. Open this URL to inspect local database tables, Auth users, SQL editor, storage tools when storage is running, API settings, and other local Supabase administration tools. The application itself uses the local API URL on `http://127.0.0.1:54321`; Studio is the browser administration UI.

Stop local Supabase without deleting data:

```bash
pnpm supabase:local:stop
```

Delete local Supabase containers and volumes:

```bash
pnpm supabase:local:nuke
```

Browser E2E can use a separate local Supabase instance so test resets do not touch the manual local development database:

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

The dedicated local E2E profile uses API `http://127.0.0.1:55321`, database port `55322`, and Studio `http://127.0.0.1:55323`. Use `pnpm supabase:e2e:start` or the `*:local-supabase:full` E2E commands only for tests that require Storage, Realtime, Edge Functions, or logging services.

E2E source selection is controlled by `E2E_SUPABASE_PROVIDER` and `E2E_SUPABASE_ISOLATION`. The recommended default is `hosted + dedicated`. Reusing the main `.env` or the dev local Supabase profile requires `E2E_ALLOW_MAIN_SUPABASE=true` and `E2E_FULL_RESET_MODE=off`.

To switch back to a hosted project, use the normal `.env` files and run `pnpm start` or `pnpm start:allclean`. The local scripts always pass explicit `UNIVERSO_ENV_FILE` and `UNIVERSO_FRONTEND_ENV_FILE` values instead of changing the default hosted configuration.

## Environment Mode (NODE_ENV)

The `NODE_ENV` variable controls the runtime environment mode and enables/disables certain features based on the deployment context.

### Values

| Value         | Description                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `development` | Local development mode. Enables dangerous operations, detailed error messages, and auto-generated secrets for testing. |
| `production`  | Production mode. Disables dangerous operations, minimizes error exposure, enforces security-first configuration.       |

### Recommended Setup

For local development, add to your `.env`:

```env
NODE_ENV=development
```

### Development Mode Features

When `NODE_ENV=development`:

-   **Database Reset**: `FULL_DATABASE_RESET` and `start:allclean` commands are enabled
-   **Session Secret**: Auto-generated if `SESSION_SECRET` is not set (ephemeral, for testing only)
-   **Error Details**: Full stack traces in error responses
-   **RLS Debug**: Optional verbose logging for Row Level Security

### Production Mode Requirements

When `NODE_ENV=production` (or unset):

-   **Database Reset**: Blocked with explicit error message
-   **Session Secret**: `SESSION_SECRET` is **required** - startup fails without it
-   **Secure Cookies**: Automatically enabled for session cookies
-   **Error Messages**: Minimal exposure, no stack traces in responses

### Security Note

Never set `NODE_ENV=development` in production environments. This would enable dangerous operations like database reset and expose sensitive error information.

## Danger Zone: Full Database Reset

The `FULL_DATABASE_RESET` option performs a complete database reset at platform startup. When enabled, all project-owned schemas (`app_*`, `mhb_*`, fixed schemas) are dropped, all Supabase auth users are deleted, and the database is left in a clean state before migrations run.

**This action is irreversible.** It is strongly recommended to create a database backup before enabling this option.

Usage:

```env
FULL_DATABASE_RESET=true
```

Safety measures:

-   Defaults to `false`. Must be explicitly enabled.
-   Refuses to run when `NODE_ENV=production`.
-   Uses a PostgreSQL advisory lock to prevent concurrent resets.
-   Validates every schema name before dropping (only project-owned schemas are affected, `public` is never dropped).
-   Requires both `SUPABASE_URL` and `SERVICE_ROLE_KEY` to be set.
-   Performs a post-reset verification and fails if any residue remains.

Typical workflow for manual testing or resetting stale data:

1. Back up your database.
2. Set `FULL_DATABASE_RESET=true` in `.env`.
3. Start the platform. The reset runs before any migrations or bootstrap logic.
4. After startup completes, set `FULL_DATABASE_RESET=false` to prevent accidental resets on next startup.

### Alternative: start:allclean Command

Instead of manually setting `FULL_DATABASE_RESET=true`, you can use the `start:allclean` command which performs a complete reset without modifying your `.env` file:

```bash
pnpm start:allclean
```

This command is equivalent to:

```bash
pnpm clean:all && pnpm install && pnpm build && cross-env _FORCE_DATABASE_RESET=true pnpm start
```

The `cross-env` package ensures the `_FORCE_DATABASE_RESET` environment variable is set correctly across all platforms (Windows, macOS, Linux). This variable forces a database reset regardless of the `FULL_DATABASE_RESET` environment variable value. All safety measures (production guard, advisory lock, schema validation) remain active.

**When to use `start:allclean` vs `FULL_DATABASE_RESET`:**

| Scenario                         | Recommended Approach                   |
| -------------------------------- | -------------------------------------- |
| One-time local reset             | `pnpm start:allclean`                  |
| CI/CD pipeline reset             | `FULL_DATABASE_RESET=true` in env      |
| Repeated testing                 | `FULL_DATABASE_RESET=true` temporarily |
| After accidental data corruption | `pnpm start:allclean`                  |

**Important**: Both methods are blocked in production environments.
