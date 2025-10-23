# @universo/auth-srv

Passport.js + Supabase session toolkit powering Universo Platformo server authentication. The module now ships as a dual ESM/CJS library and is mounted inside `packages/flowise-server` at `/api/v1/auth`.

## Features

- Passport LocalStrategy with Supabase as identity provider
- Express-session cookie storage (HttpOnly, configurable SameSite/Secure)
- CSRF protection via `csurf` and `X-CSRF-Token`
- Login rate limiting (1 minute window, 10 attempts)
- Automatic Supabase access-token refresh with single-flight locking

## Endpoints (mounted under `/api/v1/auth`)

- `GET /csrf` — returns `{ csrfToken }`
- `POST /login` — `{ email, password }`, CSRF required
- `GET /me` — resolves current Supabase user
- `POST /refresh` — optional manual refresh (sessions auto-refresh transparently)
- `POST /logout` — signs out and clears session

## Environment

Consumed by `packages/flowise-server`. Required variables:

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- Optional cookie tuning: `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAXAGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`

## Build

```bash
pnpm --filter @universo/auth-srv build
```

Outputs CommonJS build to `dist/` and ESM build to `dist/esm/`.
