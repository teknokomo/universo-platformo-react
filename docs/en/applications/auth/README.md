# Auth (Passport.js + Supabase) — Isolated PoC

This document describes the isolated authentication Proof of Concept (PoC) implemented as separate packages under `apps/auth-srv/base` (server) and `apps/auth-frt/base` (frontend). The PoC stores Supabase tokens server-side and exposes a safe cookie/CSRF-based API for the client.

> Important: The PoC code is fully isolated and NOT integrated into the current system. No existing routes or UI were modified.

## Features

-   Passport LocalStrategy with Supabase as IdP
-   Server-side sessions with secure cookies (HttpOnly, SameSite, Secure)
-   CSRF protection (double-submit cookie + `X-CSRF-Token`)
-   Rate limiting on `/login`
-   Per-request Supabase client with RLS using `Authorization: Bearer <access>` from the session
-   Automatic token refresh (single-flight); session invalidation on refresh failure

## Endpoints (prefix: `/api/v2/auth`)

-   `GET /csrf` — returns `{ csrfToken }`
-   `POST /login` — `{ email, password }` (CSRF required)
-   `GET /me` — returns `{ id, email }` if authenticated
-   `POST /refresh` — optional manual refresh (CSRF required); auto refresh is transparent
-   `POST /logout` — logs out (CSRF required)

## Environment

-   `PORT` (default: 3101)
-   `SESSION_SECRET` (required)
-   `SUPABASE_URL` (required)
-   `SUPABASE_ANON_KEY` (required)
-   `SAME_SITE` (optional; `lax` or `none`)
-   `DEV_SAME_ORIGIN` (optional; `true` to force `lax` during dev on same origin)

## Quick Start (PoC)

-   Server (`apps/auth-srv/base`):
    ```bash
    pnpm --filter @universo/auth-srv build
    pnpm --filter @universo/auth-srv start
    ```
-   Frontend (`apps/auth-frt/base`):
    ```bash
    # set VITE_AUTH_API=http://localhost:3101/api/v2
    pnpm --filter @universo/auth-frt dev
    ```

## Rollout Plan (Replacing current auth)

1. PoC (isolated)
    - Run auth server on port 3101
    - Use the `apps/auth-frt` client to verify login → me → auto-refresh → logout
2. Integrate into `packages/server`
    - Add `express-session`, `passport`, `helmet`, `csurf`, `cors` as needed
    - Replace header-based RLS with session-based: `Authorization: Bearer <req.session.tokens.access>`
    - Protect routes with `req.isAuthenticated()`
3. Integrate UI in `packages/ui`
    - Remove `localStorage` token usage and Authorization interceptor
    - Switch to `withCredentials: true` and `GET /auth/me` for guards
4. Production
    - Redis session store, `SameSite=Lax; Secure; HttpOnly` cookies
    - CSRF for state-changing routes
    - Regression and performance tests (login rate limiting)
