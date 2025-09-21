# Auth (Passport.js + Supabase)

Universo Platformo now uses Passport.js sessions backed by Supabase for authentication. The implementation lives in two reusable packages:

- `@universo/auth-srv` — Express/Passport integration mounted inside `packages/server`
- `@universo/auth-frt` — React primitives (`createAuthClient`, `useSession`, `LoginForm`) consumed by `packages/ui`

## Request flow

1. `POST /api/v1/auth/login`
    - Validates credentials against Supabase Auth using Passport LocalStrategy
    - Stores access/refresh tokens inside the Express session (HttpOnly cookie)
2. Subsequent API calls
    - Browser sends the session cookie (`up.sid` by default)
    - Middleware upgrades the request with `Authorization: Bearer <access>` so existing services keep working
    - Tokens are transparently refreshed when they are near expiry
3. `GET /api/v1/auth/me`
    - Returns the Supabase user profile associated with the current session
4. `POST /api/v1/auth/logout`
    - Revokes the Supabase session and destroys the Express session

CSRF protection is enforced on state-changing routes via `csurf` and the `X-CSRF-Token` header fetched from `GET /api/v1/auth/csrf`.

## Frontend integration

`packages/ui` consumes `@universo/auth-frt`:

```ts
const authClient = createAuthClient({ baseURL: `${baseURL}/api/v1` })
const { user, refresh, logout } = useSession({ client: authClient })
```

The login screen reuses `LoginForm`, removes all `localStorage` token handling, and relies on cookies + `withCredentials` requests.

## Environment variables

Defined in `packages/server`:

- `SESSION_SECRET`
- `SESSION_COOKIE_NAME` (optional, default `up.sid`)
- `SESSION_COOKIE_MAXAGE` (optional, milliseconds, default 7 days)
- `SESSION_COOKIE_SAMESITE` (`lax`, `strict`, `none`, or `true`/`false`)
- `SESSION_COOKIE_SECURE` (`true` to force Secure cookies)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

## Build & testing tips

```bash
pnpm --filter @universo/auth-srv build
pnpm --filter @universo/auth-frt build
pnpm --filter flowise build   # packages/server
pnpm --filter flowise lint
```

After building, start the server (`pnpm --filter flowise dev`) and verify the flow:

1. `POST /api/v1/auth/login`
2. `GET /api/v1/auth/me`
3. Call a protected route (e.g. `/api/v1/uniks`) — succeeds without manual tokens
4. `POST /api/v1/auth/logout`
