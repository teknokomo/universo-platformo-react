---
description: Learn how to set up app-level access control for your Universo Platformo instances
---

# Application

***

## Email & Password

Universo Platformo ships with a [**Passport.js**](https://www.passportjs.org/)-based session stack backed by Supabase. When a user signs in, their credentials are verified against Supabase, an access token is stored in the server-side session, and every subsequent API call is authorized via that session. Cookies are HTTP-only, automatically refreshed before expiry, and can be hardened through additional environment variables.

To migrate from the legacy Basic Auth flow, configure Supabase and expose the `/api/v1/auth` endpoints as described below.

<figure><img src="../../.gitbook/assets/image (18) (1) (1).png" alt="" width="387"><figcaption></figcaption></figure>

### Required environment variables

Add the following variables to `packages/flowise-server/.env` (or provide them via CLI flags):

- `SESSION_SECRET` — Secret string used to sign Express sessions.
- `SUPABASE_URL` — URL of your Supabase project.
- `SUPABASE_ANON_KEY` — Public anon key (used for CSRF/session bootstrap).
- `SUPABASE_JWT_SECRET` — Service JWT secret used to validate Supabase access tokens.

### Optional cookie tuning

- `SESSION_COOKIE_NAME` — Override the cookie name (default: `up.sid`).
- `SESSION_COOKIE_MAXAGE` — Max age in milliseconds (default: `86400000`).
- `SESSION_COOKIE_SAMESITE` — SameSite policy (`lax`, `strict`, or `none`).
- `SESSION_COOKIE_SECURE` — Set to `true` in production environments served over HTTPS.

### npm

1. Install dependencies

```bash
npm install -g flowise
```

2. Start the server with the required session variables (export them in your shell or store them in `.env`):

```bash
SESSION_SECRET=super-secret SUPABASE_URL=https://xyz.supabase.co \
SUPABASE_ANON_KEY=public-anon SUPABASE_JWT_SECRET=service-secret \
npx flowise start
```

3. Visit [http://localhost:3000](http://localhost:3000) and sign in via `/auth`.

### Docker

1. Navigate to the `docker` folder.

```bash
cd docker
```

2. Create a `.env` file containing the new authentication variables:

```dotenv
PORT=3000
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

3. Map those values inside `docker-compose.yml`:

```yaml
environment:
  - PORT=${PORT}
  - SESSION_SECRET=${SESSION_SECRET}
  - SUPABASE_URL=${SUPABASE_URL}
  - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
  - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
```

4. `docker compose up -d`
5. Open [http://localhost:3000](http://localhost:3000)
6. Stop the stack with `docker compose stop` when finished.

### Git clone

When running from source, add the variables to `packages/flowise-server/.env`:

```dotenv
SESSION_SECRET=super-secret
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=public-anon
SUPABASE_JWT_SECRET=service-secret
```

## Username & Password (Deprecated)

The legacy `FLOWISE_USERNAME`/`FLOWISE_PASSWORD` guard has been removed. Use the Supabase-backed session flow described above for all new deployments.
