---
description: Describe authentication, sessions, CSRF, and request-scoped RLS handling.
---

# Authentication and Authorization

The current auth model combines Passport.js session handling with Supabase
identity and request-scoped database context.

## Current Model

- Backend auth routes and middleware live in `@universo/auth-backend`.
- Frontend auth helpers and UI flows live in `@universo/auth-frontend`.
- Clients use session-aware requests and CSRF protection.
- Request-scoped RLS context is applied for protected database operations.
- Server-side provisioning flows use the Supabase Admin API through a server-only client built from `SUPABASE_URL` + `SERVICE_ROLE_KEY`.

## Startup Superuser Bootstrap

During the first platform startup, `@universo/core-backend` can automatically create or confirm a bootstrap superuser when `BOOTSTRAP_SUPERUSER_ENABLED=true`.

The flow is intentionally strict:

- It creates a real Supabase auth account through `supabase.auth.admin.createUser(...)`.
- It repairs the profile row through the shared profile service if the trigger-created row is missing.
- It assigns the exclusive global `superuser` role through the shared admin provisioning pipeline.
- It does not synthesize public-registration legal-consent acceptance.
- It fails fast if the configured bootstrap email already belongs to an existing non-superuser account.

## Important Contracts

- Public routes are centrally defined in shared auth utilities.
- CSRF failures map to HTTP 419 and should retry only once when safe.
- 401 handling is coordinated with frontend redirect behavior.
- Membership and role checks remain explicit platform concerns.

This model supports multi-user business flows across shared platform modules.
