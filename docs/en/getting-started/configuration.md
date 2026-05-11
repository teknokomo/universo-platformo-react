---
description: Configure backend and frontend environment files for local startup.
---

# Configuration

## Backend Environment

Create a local `.env` file in `packages/universo-core-backend/base` and provide
at least the Supabase/PostgreSQL and auth settings required by the backend.

Typical values include the Supabase URL, anonymous key, JWT secret, database
connection settings, session configuration, and other deployment-specific
secrets.

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

- `SERVICE_ROLE_KEY` is server-only. Never expose it to browser bundles.
- `BOOTSTRAP_SUPERUSER_ENABLED` defaults to `true`.
- When bootstrap is enabled, the backend creates or confirms a real Supabase auth user and assigns the exclusive global `superuser` role during startup.
- The demo bootstrap email and password are for local/dev bootstrap only. Change both before any real deployment.
- If the bootstrap email already belongs to an existing non-superuser account, startup fails fast instead of silently elevating that account.

## Frontend Environment

If you need frontend overrides, create a local `.env` file in
`packages/universo-core-frontend/base`.

Typical values include UI host or port settings such as `VITE_PORT`.

## Configuration Rules

- Keep real secrets out of version control.
- Use placeholder-only tracked env files.
- Re-run the root build after changing shared configuration assumptions.

## Environment Mode (NODE_ENV)

The `NODE_ENV` variable controls the runtime environment mode and enables/disables certain features based on the deployment context.

### Values

| Value | Description |
|-------|-------------|
| `development` | Local development mode. Enables dangerous operations, detailed error messages, and auto-generated secrets for testing. |
| `production` | Production mode. Disables dangerous operations, minimizes error exposure, enforces security-first configuration. |

### Recommended Setup

For local development, add to your `.env`:

```env
NODE_ENV=development
```

### Development Mode Features

When `NODE_ENV=development`:

- **Database Reset**: `FULL_DATABASE_RESET` and `start:allclean` commands are enabled
- **Session Secret**: Auto-generated if `SESSION_SECRET` is not set (ephemeral, for testing only)
- **Error Details**: Full stack traces in error responses
- **RLS Debug**: Optional verbose logging for Row Level Security

### Production Mode Requirements

When `NODE_ENV=production` (or unset):

- **Database Reset**: Blocked with explicit error message
- **Session Secret**: `SESSION_SECRET` is **required** - startup fails without it
- **Secure Cookies**: Automatically enabled for session cookies
- **Error Messages**: Minimal exposure, no stack traces in responses

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

- Defaults to `false`. Must be explicitly enabled.
- Refuses to run when `NODE_ENV=production`.
- Uses a PostgreSQL advisory lock to prevent concurrent resets.
- Validates every schema name before dropping (only project-owned schemas are affected, `public` is never dropped).
- Requires both `SUPABASE_URL` and `SERVICE_ROLE_KEY` to be set.
- Performs a post-reset verification and fails if any residue remains.

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
pnpm clean:all && pnpm install && pnpm build && _FORCE_DATABASE_RESET=true pnpm start
```

The `_FORCE_DATABASE_RESET` environment variable forces a database reset regardless of the `FULL_DATABASE_RESET` environment variable value. All safety measures (production guard, advisory lock, schema validation) remain active.

**When to use `start:allclean` vs `FULL_DATABASE_RESET`:**

| Scenario | Recommended Approach |
|----------|---------------------|
| One-time local reset | `pnpm start:allclean` |
| CI/CD pipeline reset | `FULL_DATABASE_RESET=true` in env |
| Repeated testing | `FULL_DATABASE_RESET=true` temporarily |
| After accidental data corruption | `pnpm start:allclean` |

**Important**: Both methods are blocked in production environments.
