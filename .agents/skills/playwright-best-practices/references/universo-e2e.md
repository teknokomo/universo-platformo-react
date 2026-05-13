# Universo Platformo E2E Rules

Use this reference when an agent needs browser automation, screenshots, or Playwright regression checks in this repository.

## Default Hosted E2E

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
```

-   The E2E server is started by `tools/testing/e2e/run-playwright-suite.mjs`.
-   The browser target is `http://127.0.0.1:3100`.
-   Backend credentials come from `packages/universo-core-backend/base/.env.e2e.local` or `.env.e2e`.
-   Do not run `pnpm dev` for this workflow.

## Dedicated Local Supabase E2E

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

-   Local E2E uses a separate Supabase CLI project and Docker volumes from manual local development.
-   The default local E2E stack is `minimal`.
-   Use `pnpm supabase:e2e:start` or `*:local-supabase:full` only when a test needs Storage, Realtime, Edge Functions, or logging/analytics.
-   Use `pnpm supabase:e2e:stop` to stop the dedicated E2E instance.
-   Use `pnpm supabase:e2e:nuke` only when you intentionally want to remove the dedicated local E2E data volumes.

## Manual App Is Different

Manual development can use `http://localhost:3000`, `pnpm start:local-supabase:minimal`, or `pnpm start:allclean:local-supabase:minimal`.
That is not the Playwright E2E target unless the user explicitly asks to inspect the manual app.
