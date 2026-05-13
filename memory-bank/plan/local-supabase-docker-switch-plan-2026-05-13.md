# Local Supabase Docker Switch Plan

Date: 2026-05-13

## Overview

Add a safe, repeatable way to run Universo Platformo against a local Supabase stack started with Docker through Supabase CLI. The goal is to keep the existing production and hosted-E2E contracts intact while allowing local development and browser E2E flows to run without depending on `*.supabase.co` network availability.

This is a planning document only. It does not implement the feature yet.

## Current Findings

- The backend already supports explicit environment selection through `UNIVERSO_ENV_FILE`.
- The frontend Vite config already reads `UNIVERSO_FRONTEND_ENV_FILE` and can derive the dev proxy target from the selected backend env file.
- The E2E runner already has an isolated env-loading path for `UNIVERSO_ENV_TARGET=e2e` and can pass explicit env file paths to the started backend.
- The backend uses Supabase in three places:
  - Auth registration/login/session refresh via `@supabase/supabase-js`.
  - Admin user provisioning/deletion via `SERVICE_ROLE_KEY`.
  - JWT verification via either `SUPABASE_JWT_SECRET` for HS256 or JWKS derived from `SUPABASE_URL`.
- Local Supabase CLI returns a local API URL, local Postgres connection details, anon key, service role key, and JWT secret. That matches the current backend contract if mapped correctly.
- Startup full reset currently deletes `auth.users` through direct SQL. This should continue to work with local Supabase because the local Postgres container owns the `auth` schema.
- Real secrets currently live in ignored env files. The local Supabase implementation must not commit generated keys or passwords.

## External Documentation Notes

- Supabase local development requires a Docker-compatible container runtime such as Docker Desktop, Rancher Desktop, Podman, OrbStack, or similar.
- `supabase init` creates `supabase/config.toml`; `supabase start` starts local containers and prints the local API URL, DB URL, Studio URL, anon key, service role key, and JWT secret.
- `supabase start` starts all services by default and supports `-x/--exclude` to omit services such as Realtime, Storage, imgproxy, Edge Runtime, Logflare, Vector, Studio, Postgres Meta, or Supavisor.
- `supabase status -o env` can print machine-readable env values.
- `supabase stop` preserves local data by default; `supabase stop --no-backup` deletes local data volumes.
- Official Supabase docs recommend binding local services to localhost and not exposing local development stacks publicly.

References:

- https://supabase.com/docs/guides/local-development
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/reference/cli/supabase-start

## Target Developer Workflows

### Hosted Supabase

Existing workflows remain unchanged:

```bash
pnpm start
pnpm start:allclean
pnpm run test:e2e:smoke
```

These continue to use `.env` or `.env.e2e` unless the user explicitly selects another env file.

### Local Supabase

New workflows should be explicit. Normal local startup should not require editing `packages/universo-core-backend/base/.env`; switching is controlled by script-selected env files:

```bash
pnpm run supabase:local:start
pnpm run env:local-supabase
pnpm run start:local-supabase
```

Clean local rebuild:

```bash
pnpm run start:allclean:local-supabase
```

`start:allclean:local-supabase` must run the local Supabase doctor before `_FORCE_DATABASE_RESET=true` is passed to the backend. A failed Auth/API/DB/JWT preflight should stop the command before destructive reset begins.

Local browser smoke:

```bash
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

The local E2E scripts must also run the doctor preflight before starting the Playwright runner.

Stop local Supabase while preserving data:

```bash
pnpm run supabase:local:stop
```

Destroy local Supabase data:

```bash
pnpm run supabase:local:nuke
```

## Affected Areas

- Root `package.json`
- New `supabase/config.toml`
- Root `.gitignore`
- `packages/universo-core-backend/base/.env.local-supabase.example`
- `packages/universo-core-backend/base/.env.e2e.local-supabase.example`
- `packages/universo-core-frontend/base/.env.local-supabase.example`
- `packages/universo-core-frontend/base/.env.e2e.local-supabase.example`
- New tooling under `tools/local-supabase/`
- E2E env helper and runner scripts only if explicit local profiles require wrapper improvements
- Documentation:
  - `docs/en/getting-started/configuration.md`
  - `docs/ru/getting-started/configuration.md`
  - `docs/en/guides/browser-e2e-testing.md`
  - `docs/ru/guides/browser-e2e-testing.md`
  - `packages/universo-core-backend/base/README.md`
  - `tools/testing/e2e/README.md`

## Architecture Decision

Use Supabase CLI as the canonical local Supabase runtime, not a custom Docker Compose fork.

Reasons:

- Supabase CLI owns compatible service versions and local keys.
- The project already needs Supabase Auth behavior, not only Postgres.
- The current app contract only needs env values, so switching the data source should be an env concern.
- A custom Docker Compose stack would require more maintenance around GoTrue, Kong, PostgREST, JWT, and service-role key compatibility.

The implementation should not add a local-only auth provider in this phase. Local Supabase should exercise the same Supabase Auth code paths as hosted Supabase.

## Service Profile

Start with a balanced local stack:

- Required:
  - `postgres`
  - `gotrue`
  - `kong`
  - `postgrest`
- Useful for local diagnosis:
  - `studio`
  - `mailpit`
- Excludable by default for lower resource use:
  - `realtime`
  - `storage-api`
  - `imgproxy`
  - `edge-runtime`
  - `logflare`
  - `vector`
  - `postgres-meta` if Studio is disabled
  - `supavisor`

Use scripts that keep Docker-network handling in a Node helper rather than shell redirection, preserving cross-platform behavior and avoiding hidden Bash-only assumptions:

```json
{
    "supabase:local:network": "node tools/local-supabase/network.mjs ensure",
    "supabase:local:start": "pnpm run supabase:local:network && pnpm exec supabase start --network-id universo-local-supabase",
    "supabase:local:start:minimal": "pnpm run supabase:local:network && pnpm exec supabase start --network-id universo-local-supabase -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor"
}
```

If `postgres-meta` or `studio` become unstable or too heavy, add a second minimal profile that excludes both:

```bash
pnpm exec supabase start --network-id universo-local-supabase -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta
```

Do not exclude `gotrue`, `kong`, or `postgres`. Excluding `postgrest` should be treated as an advanced option only after smoke tests prove Auth, admin provisioning, reset, and app startup do not depend on the local API gateway expecting a REST route.

## Planned Files And Scripts

### Phase 1: Add Supabase CLI Project Skeleton

- Add Supabase CLI as a dev dependency using the pnpm 10-safe install path documented by Supabase:

```bash
pnpm add -D supabase --allow-build=supabase
```

- Add `supabase/config.toml` with stable local ports:
  - API gateway: `54321`
  - Postgres: `54322`
  - Studio: `54323`
  - Mailpit: `54324`
  - Auth internal service: keep CLI default unless generated config requires explicit value
- Configure Auth for local app URLs:
  - Site URL: `http://localhost:3000`
  - Additional redirect URLs: `http://127.0.0.1:3000`, `http://localhost:3100`, `http://127.0.0.1:3100`
  - Email confirmations disabled for local/e2e by default.
- Keep all local Supabase generated data in Docker volumes managed by Supabase CLI.
- Do not add Supabase migrations for Universo platform schemas. The platform continues to run its own registered platform migrations on app startup.
- Do not make `supabase init` part of the normal daily workflow after `supabase/config.toml` is committed. `supabase init --force` can overwrite project configuration, so any init helper must be guarded and should only create config when it is missing.

Example config shape:

```toml
project_id = "universo-platformo-local"

[api]
enabled = true
port = 54321
schemas = ["public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
major_version = 17

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = [
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100"
]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_confirmations = false
```

Implementation note: validate the exact generated `config.toml` keys against the installed Supabase CLI output during implementation, because the CLI may add new sections or comments.

### Phase 2: Add Env Generation Tool

Add `tools/local-supabase/write-env.mjs`.

Responsibilities:

- Run `supabase status -o env`.
- Parse only expected keys.
- Refuse to write if the local API URL or DB URL points outside localhost/127.0.0.1.
- Write backend env files with `0600` permissions when supported by the OS.
- Never print secrets to logs.
- Preserve user-owned values such as bootstrap email/password unless `--force` is passed.
- Preserve non-Supabase application settings from existing local profile files where safe, including `SESSION_SECRET`, captcha settings, storage settings, and auth feature toggles.
- Keep generated local profiles separate from hosted profiles:
  - hosted dev: `.env`
  - hosted e2e: `.env.e2e` / `.env.e2e.local`
  - local Supabase dev: `.env.local-supabase`
  - local Supabase e2e: `.env.e2e.local-supabase`
- Support both dev and e2e targets:
  - `.env.local-supabase`
  - `.env.e2e.local-supabase`
- Write frontend env examples only for ports/proxy; do not put service-role keys in frontend env files.

Safe parser example:

```js
const allowedOutputKeys = new Set([
    'SUPABASE_URL',
    'SUPA_API_URL',
    'API_URL',
    'SUPABASE_DB_URL',
    'SUPA_DB_URL',
    'DB_URL',
    'SUPABASE_ANON_KEY',
    'SUPA_ANON_KEY',
    'ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPA_SERVICE_KEY',
    'SERVICE_ROLE_KEY',
    'JWT_SECRET'
])

function assertLocalUrl(name, value) {
    const url = new URL(value)
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
        throw new Error(`${name} must point to localhost for local Supabase env generation`)
    }
}
```

Backend env output example:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<local_anon_key>
SUPABASE_ANON_KEY=<local_anon_key>
SERVICE_ROLE_KEY=<local_service_role_key>
SUPABASE_JWT_SECRET=<local_jwt_secret>
SUPABASE_JWT_AUDIENCE=authenticated

DATABASE_HOST=127.0.0.1
DATABASE_PORT=54322
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false
DATABASE_POOL_MAX=5

BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=local-admin@example.test
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_Local-123456!
AUTH_EMAIL_CONFIRMATION_REQUIRED=false
AUTH_LOGIN_RATE_LIMIT_MAX=200
```

E2E env output example:

```env
PORT=3100
NODE_ENV=development
UNIVERSO_ENV_TARGET=e2e

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<local_anon_key>
SUPABASE_ANON_KEY=<local_anon_key>
SERVICE_ROLE_KEY=<local_service_role_key>
SUPABASE_JWT_SECRET=<local_jwt_secret>
SUPABASE_JWT_AUDIENCE=authenticated

DATABASE_HOST=127.0.0.1
DATABASE_PORT=54322
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false
DATABASE_POOL_MAX=15

BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=e2e-local-admin@example.test
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_E2E-Local-123456!
E2E_TEST_USER_PASSWORD=ChangeMe_E2E-123456!
E2E_TEST_USER_ROLE_CODENAMES=User
E2E_TEST_USER_EMAIL_DOMAIN=example.test
E2E_FULL_RESET_MODE=strict
AUTH_LOGIN_RATE_LIMIT_MAX=200
```

### Phase 3: Add NPM Scripts

Add scripts in root `package.json`:

```json
{
    "supabase:local:init": "node tools/local-supabase/init.mjs",
    "supabase:local:network": "node tools/local-supabase/network.mjs ensure",
    "supabase:local:start": "pnpm run supabase:local:network && pnpm exec supabase start --network-id universo-local-supabase",
    "supabase:local:start:minimal": "pnpm run supabase:local:network && pnpm exec supabase start --network-id universo-local-supabase -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor",
    "supabase:local:status": "pnpm exec supabase status",
    "supabase:local:stop": "pnpm exec supabase stop",
    "supabase:local:nuke": "pnpm exec supabase stop --no-backup",
    "env:local-supabase": "node tools/local-supabase/write-env.mjs --target dev",
    "env:e2e:local-supabase": "node tools/local-supabase/write-env.mjs --target e2e",
    "doctor:local-supabase": "node tools/local-supabase/doctor.mjs --target dev",
    "doctor:e2e:local-supabase": "node tools/local-supabase/doctor.mjs --target e2e",
    "start:local-supabase": "pnpm run env:local-supabase && pnpm run doctor:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.local-supabase pnpm start",
    "start:allclean:local-supabase": "pnpm run env:local-supabase && pnpm run doctor:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.local-supabase _FORCE_DATABASE_RESET=true pnpm start",
    "build:e2e:local-supabase": "pnpm run env:e2e:local-supabase && pnpm run doctor:e2e:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_ENV_TARGET=e2e pnpm build",
    "test:e2e:smoke:local-supabase": "pnpm run env:e2e:local-supabase && pnpm run doctor:e2e:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_ENV_TARGET=e2e node tools/testing/e2e/run-playwright-suite.mjs --grep @smoke"
}
```

Implementation notes:

- `supabase:local:init` must be non-destructive. It should refuse to overwrite an existing `supabase/config.toml` unless an explicit `--force` argument is passed by the developer.
- `doctor:local-supabase` and `doctor:e2e:local-supabase` are not optional for local destructive or browser-test workflows.
- The default hosted commands must not call the local doctor, because hosted development and hosted E2E should remain independent.

### Phase 4: Add Doctor Command

Add `tools/local-supabase/doctor.mjs`.

Checks:

- Docker command is available.
- Supabase CLI command is available.
- Local Supabase status can be read.
- API URL is local.
- `GET /auth/v1/health` responds.
- `GET /auth/v1/settings` responds.
- `GET /rest/v1/` responds with an expected auth/route result, not a connect timeout.
- PostgreSQL connection works with generated DB env.
- JWT verification mode is valid:
  - local HS256 requires `SUPABASE_JWT_SECRET`;
  - hosted/asymmetric profiles can use JWKS, but local Supabase scripts should require the local secret to avoid network-dependent JWKS failures.
- Required env keys exist:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - `SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
  - DB connection values
- Bootstrap credentials pass the same validation used by `bootstrapSuperuser.ts`.
- Transaction pooler port `6543` is not used.
- `SERVICE_ROLE_KEY` must successfully call a harmless local Auth Admin endpoint, or the doctor must fail before startup.

Do not log key values. Log only booleans and masked URLs.

Safe logging example:

```js
function maskSecret(value) {
    return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '<missing>'
}

console.info('[local-supabase-doctor] auth', {
    supabaseUrl: safeUrl,
    hasAnonKey: Boolean(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_DEFAULT_KEY),
    hasServiceRoleKey: Boolean(env.SERVICE_ROLE_KEY),
    hasJwtSecret: Boolean(env.SUPABASE_JWT_SECRET)
})
```

### Phase 5: Harden Env Loading For Profile Files

Prefer explicit script-level env selection over changing the default `.env` discovery rules:

- Keep default `pnpm start` behavior unchanged.
- Use `UNIVERSO_ENV_FILE=.env.local-supabase` for local Supabase dev.
- Use `UNIVERSO_ENV_FILE=.env.e2e.local-supabase` and `UNIVERSO_ENV_TARGET=e2e` for local Supabase E2E.
- Use `UNIVERSO_FRONTEND_ENV_FILE` only for frontend-dev workflows that need explicit Vite values.
- Add docs with direct one-line switching examples:
  - hosted: `pnpm start`
  - local: `pnpm run start:local-supabase`
  - hosted clean reset: `pnpm start:allclean`
  - local clean reset: `pnpm run start:allclean:local-supabase`

Only add new env-discovery candidates if repeated manual workflows show that explicit env variables are too cumbersome. Avoid surprising developers by making `.env.local-supabase` auto-load without an explicit script.

### Phase 6: Update Git Ignore And Examples

Update `.gitignore`:

```gitignore
**/.env.local-supabase
**/.env.e2e.local-supabase
```

Add tracked examples only:

- `packages/universo-core-backend/base/.env.local-supabase.example`
- `packages/universo-core-backend/base/.env.e2e.local-supabase.example`
- `packages/universo-core-frontend/base/.env.local-supabase.example`
- `packages/universo-core-frontend/base/.env.e2e.local-supabase.example`

The examples must use placeholders and must not contain real generated Supabase keys.

### Phase 7: Integrate E2E Local Mode

Keep hosted E2E as the default because CI and existing docs rely on it.

Add local Supabase E2E as an explicit opt-in:

```bash
pnpm run supabase:local:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Potential E2E runner changes:

- Allow `E2E_FULL_RESET_MODE=strict` with local Supabase because local reset is safe and isolated.
- Keep the existing refusal to run when the app server is already alive.
- Keep the lock file behavior.
- Ensure the E2E full reset path deletes local `auth.users` and project schemas, then verifies residue.
- Add an E2E doctor mode that refuses to run if `SUPABASE_URL` is not local when local Supabase scripts are used.

### Phase 8: Documentation

Update GitBook docs:

- Explain the three supported data-source profiles:
  - Hosted Supabase development.
  - Hosted dedicated E2E Supabase.
  - Local Supabase Docker.
- Document that local Supabase still uses real Supabase Auth semantics through GoTrue.
- Document that `SERVICE_ROLE_KEY` is server-only even when local.
- Document the minimal and balanced service profiles.
- Document cleanup:
  - `pnpm run supabase:local:stop`
  - `pnpm run supabase:local:nuke`
  - `pnpm run start:allclean:local-supabase`
- Document common failures:
  - Docker not running.
  - Supabase port conflict.
  - Missing JWT secret.
  - Transaction pooler port accidentally selected.
  - Env file generated before `supabase start`.

Required documentation files:

- `docs/en/getting-started/configuration.md`
- `docs/ru/getting-started/configuration.md`
- `docs/en/getting-started/quick-start.md`
- `docs/ru/getting-started/quick-start.md`
- `docs/en/guides/browser-e2e-testing.md`
- `docs/ru/guides/browser-e2e-testing.md`
- `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if a new GitBook page is added instead of extending existing pages.
- `packages/universo-core-backend/base/README.md`
- `packages/universo-core-backend/base/README-RU.md`
- `tools/testing/e2e/README.md`
- `tools/testing/e2e/README-RU.md`
- Root `README.md` only if the local Supabase workflow becomes a recommended first-run path.

Docs acceptance rules:

- EN and RU pages must contain equivalent content, not abbreviated translations.
- Docs must show hosted and local commands side by side so switching is obvious.
- Docs must explicitly warn that generated local keys and `SERVICE_ROLE_KEY` are server-only and must not be committed.
- Docs must explain that local Supabase uses real GoTrue Auth and is not a mocked auth path.
- Run `pnpm docs:i18n:check` after documentation updates.

### Phase 9: Deep Test Coverage And Quality Gates

Create a complete test system for the local Supabase switching feature. This phase is mandatory, not optional cleanup.

#### Jest Coverage

Use existing backend Jest patterns for packages that already use Jest:

- `packages/universo-core-backend/base/src/__tests__/bootstrapSuperuser.test.ts`
  - Add or verify cases that local Supabase env with `SUPABASE_JWT_SECRET` and `SERVICE_ROLE_KEY` passes startup config validation.
  - Ensure missing local `SERVICE_ROLE_KEY` still fails fast when bootstrap is enabled.
- `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts`
  - Prove local DB port `54322` is treated as session/direct mode and reset remains allowed only outside production.
  - Keep the production guard for `_FORCE_DATABASE_RESET=true`.
- `packages/auth-backend/base/src/tests/utils/rlsContext.test.ts` or `verifySupabaseJwt` focused tests
  - Prove local HS256 JWT verification works with `SUPABASE_JWT_SECRET`.
  - Prove JWKS mode remains available for hosted Supabase.
- `packages/auth-backend/base/src/tests/routes/authRoutes.test.ts`
  - Ensure auth routes use the selected `SUPABASE_URL` and public key env without leaking service-role credentials.

#### Vitest Coverage

Use Vitest for frontend and tool-facing TypeScript/JavaScript utilities where it fits existing package patterns:

- `tools/local-supabase/__tests__/write-env.test.mjs`
  - Parses `supabase status -o env` output.
  - Accepts known CLI key aliases.
  - Rejects remote API and DB URLs for local profile generation.
  - Preserves user-owned local settings such as `SESSION_SECRET`, captcha settings, storage settings, and bootstrap credentials unless explicitly forced.
  - Writes dev and e2e env files with correct ports and without frontend service-role leakage.
  - Masks secrets in all report output.
- `tools/local-supabase/__tests__/doctor.test.mjs`
  - Passes when Auth, REST, DB, JWT, and service-role checks are healthy.
  - Fails for missing Docker, missing Supabase CLI, stopped local Supabase, Auth health timeout, REST timeout, DB connection failure, missing JWT secret, and rejected service-role key.
  - Verifies local scripts fail before destructive reset when doctor fails.
- `tools/local-supabase/__tests__/scripts-contract.test.mjs`
  - Asserts local clean-start scripts run `doctor` before `_FORCE_DATABASE_RESET=true`.
  - Asserts local E2E scripts run `doctor` before Playwright.
  - Asserts hosted scripts remain unchanged and do not call local Supabase tooling.
  - Asserts Docker network creation is implemented through a Node helper, not shell redirection.
- Frontend/Vite config tests if a helper is extracted:
  - Ensure `UNIVERSO_FRONTEND_ENV_FILE` and `UNIVERSO_ENV_FILE` keep existing proxy behavior.
  - Ensure no Supabase service-role values can be read by browser bundles.

#### Playwright Coverage

Add browser coverage that exercises real user behavior against local Supabase:

- Local Supabase smoke:
  - Start local Supabase.
  - Generate local env.
  - Start backend on `:3100`.
  - Provision bootstrap superuser through local Supabase Auth.
  - Log in through `/auth`.
  - Verify authenticated shell and logout.
- Registration/login flow:
  - Register a disposable user through the real UI.
  - Confirm profile creation and onboarding/auth route behavior.
  - Log out and log back in with the same account.
- Admin access flow:
  - Verify bootstrap superuser reaches `/admin`.
  - Verify a regular local user is redirected or denied according to current RBAC rules.
- Clean reset flow:
  - Run `start:allclean:local-supabase` or the same runner path.
  - Verify platform-owned schemas are recreated and previous local auth users are removed.
- Hosted regression:
  - Existing `pnpm run test:e2e:smoke` remains supported and is not silently redirected to local Supabase.

Playwright quality rules:

- Use the existing Playwright runner and storage-state setup; do not add a separate browser harness unless required.
- Keep local Supabase tests opt-in and tagged so they do not unexpectedly replace hosted E2E in CI.
- Capture screenshots on failure using existing Playwright config.
- Fail on visible unexpected auth errors, network timeouts, or missing admin access rather than only checking HTTP status.
- Keep tests bounded: run a focused smoke/local-auth suite by default, with deeper local flows available as a separate command.

#### Validation Commands

Implementation must finish with at least:

```bash
pnpm --filter @universo/core-backend test
pnpm --filter @universo/auth-backend test
pnpm exec vitest run tools/local-supabase/__tests__
pnpm run supabase:local:start:minimal
pnpm run doctor:local-supabase
pnpm run start:allclean:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
pnpm run build:e2e
pnpm run test:e2e:smoke
pnpm docs:i18n:check
```

If local Supabase cannot be started in the current environment, the implementation must still include unit/integration coverage and document the blocked manual validation with the exact Docker/Supabase CLI error.

## Test Plan

The detailed test matrix is defined in Phase 9. The following checklist summarizes the acceptance-level coverage.

### Unit Tests

- `tools/local-supabase/write-env.test.mjs` or equivalent Vitest coverage:
  - Parses `supabase status -o env` output.
  - Accepts both current and older CLI key names.
  - Refuses non-local API URLs.
  - Refuses non-local DB URLs for local profile generation.
  - Masks secrets in error/report output.
  - Writes dev and e2e env files with the expected non-secret keys.

- Backend config tests:
  - `SUPABASE_JWT_SECRET` local HS256 config passes `assertSupabaseJwtVerificationConfig`.
  - Local DB port `54322` is not treated as transaction pooler.
  - Port `6543` still fails closed unless `ALLOW_TRANSACTION_POOLER=true`.
  - Bootstrap superuser config still fails closed when required local Supabase secrets are missing.

### Integration Tests

- Doctor command with mocked Supabase CLI output and mocked HTTP/DB checks:
  - Pass state.
  - Missing Docker.
  - Auth health timeout.
  - REST endpoint timeout.
  - PostgreSQL connection failure.
  - Invalid or missing local `SUPABASE_JWT_SECRET`.
  - Missing service role key.
  - Service-role key rejected by Auth Admin.
  - Remote URL accidentally passed to local generator.
- Script contract tests:
  - Local clean-start script includes doctor before `_FORCE_DATABASE_RESET=true`.
  - Local E2E script includes doctor before Playwright runner.
  - Hosted scripts remain unchanged and do not call local Supabase tooling.
- Documentation checks:
  - EN/RU GitBook pages stay synchronized.
  - README updates include both local and hosted switching instructions.

### Manual Local Validation

Run after implementation:

```bash
pnpm run supabase:local:start:minimal
pnpm run doctor:local-supabase
pnpm run build
pnpm run start:allclean:local-supabase
```

Expected:

- Backend starts on `:3000`.
- Startup reset completes.
- Bootstrap superuser is created through local Supabase Auth.
- Registration/login work without reaching `*.supabase.co`.

### Browser E2E Validation

Run after implementation:

```bash
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Expected:

- E2E runner starts backend on `:3100`.
- Setup creates a disposable user through local Supabase Auth.
- Auth page login succeeds.
- Admin access smoke passes with bootstrap superuser.
- Final reset drops project-owned schemas and deletes local auth users.

### Hosted Regression Validation

Run after implementation to prove existing behavior is unchanged:

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
pnpm --filter @universo/core-backend test
pnpm --filter @universo/auth-backend test
```

## Security Requirements

- Never commit generated Supabase keys.
- Never write `SERVICE_ROLE_KEY` to frontend env files.
- Never print `SERVICE_ROLE_KEY`, anon key, JWT secret, DB password, or bootstrap password to logs.
- Refuse local profile generation if Supabase API or DB URLs point to non-local hosts.
- Keep production guards for full database reset unchanged.
- Keep `NODE_ENV=production` blocking destructive reset even for local scripts.
- Bind local Docker network to `127.0.0.1` where supported.
- Document that local Supabase is for local development and must not be exposed on public networks.

## Potential Challenges

- The repository uses `pnpm@10.33.2`; Supabase CLI installation must allow the package build step (`--allow-build=supabase`) or the local CLI binary may be unavailable.
- Supabase CLI env output names can change. The generator should support a small set of known aliases and fail with a clear message for unknown output instead of guessing.
- Supabase CLI versions can change `config.toml` defaults. Implementation should initialize once with the installed CLI and review generated comments before committing the final config.
- Excluding too many services may make Kong health checks or Studio unavailable. Start with a balanced profile and only tighten after smoke tests.
- E2E local mode should not replace hosted E2E by default. Hosted Supabase remains the production-like external dependency check; local mode is for resilience and offline productivity.
- Local Supabase Auth may issue HS256 JWTs while modern hosted Supabase can issue asymmetric JWTs. The current verifier supports both, but generated local env must include `SUPABASE_JWT_SECRET`.
- Full reset direct SQL deletes `auth.users`. This is acceptable for local/dev and already part of project behavior, but docs should clearly keep it out of production.

## Acceptance Criteria

- A developer can start local Supabase and run the platform without editing the committed `.env`.
- A developer can regenerate local env files from `supabase status` without exposing secrets in logs.
- Registration, login, bootstrap superuser, JWT verification, profile creation, and role assignment work against local Supabase.
- `start:allclean:local-supabase` rebuilds platform-owned schemas and auth users on local Supabase.
- `test:e2e:smoke:local-supabase` passes against local Supabase.
- Existing hosted Supabase scripts remain unchanged and still pass.
- Docs explain setup, switching, cleanup, and troubleshooting in both EN and RU GitBook pages.
- No generated local secrets are tracked by git.

## Recommended Implementation Order

- [ ] Add Supabase CLI dependency and local `supabase/config.toml`.
- [ ] Add local Supabase env examples and `.gitignore` entries.
- [ ] Implement `tools/local-supabase/write-env.mjs` with safe parsing and secret masking.
- [ ] Implement `tools/local-supabase/doctor.mjs`.
- [ ] Add root package scripts for local Supabase lifecycle, env generation, local start, clean start, and local E2E.
- [ ] Add Jest coverage for backend config, JWT verification, bootstrap, startup reset, and auth route safety.
- [ ] Add Vitest coverage for local Supabase env generation, doctor checks, script contracts, and any extracted frontend env helpers.
- [ ] Add Playwright local Supabase smoke, registration/login, admin access, and clean-reset coverage using the existing E2E runner.
- [ ] Run manual local Supabase startup and clean platform startup.
- [ ] Run local E2E smoke.
- [ ] Run hosted regression smoke/build tests.
- [ ] Update GitBook docs in `docs/en` and `docs/ru`, update package/tool READMEs, and run docs i18n validation.
- [ ] Update `memory-bank/tasks.md`, `memory-bank/activeContext.md`, and `memory-bank/progress.md` after implementation validation.
