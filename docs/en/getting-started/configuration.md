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
