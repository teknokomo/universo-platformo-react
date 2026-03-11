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

## Frontend Environment

If you need frontend overrides, create a local `.env` file in
`packages/universo-core-frontend/base`.

Typical values include UI host or port settings such as `VITE_PORT`.

## Configuration Rules

- Keep real secrets out of version control.
- Use placeholder-only tracked env files.
- Re-run the root build after changing shared configuration assumptions.
