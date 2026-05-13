# Browser E2E Testing

Use the Playwright browser suite when a change must be validated through the real rendered UI, the real backend, and the real metahub/application contracts.

## When To Run It

-   Run `test:e2e:smoke` after changes to auth, startup, route guards, or global navigation.
-   Run `test:e2e:permissions` after changes to roles, members, or access checks.
-   Run `test:e2e:flows` after changes to metahub authoring, entity types, Resources, publications, linked applications, or connector flows.
-   Run `test:e2e:visual` only when layout-sensitive pages or dialogs changed.
-   Run `test:e2e:restart-safe` after bootstrap, migrations, or first-start logic changes.
-   Run the generator project when GitBook screenshots or product fixtures must be regenerated from the actual product UI.

## Environment Contract

-   Keep browser-test secrets in `packages/universo-core-backend/base/.env.e2e.local`.
-   Keep optional frontend overrides in `packages/universo-core-frontend/base/.env.e2e.local`.
-   Use a dedicated Supabase test project by default.
-   Never commit real secrets, generated auth state, or production credentials.
-   Keep Playwright runtime deterministic: timezone, locale, reduced motion, cleanup of artifacts, and explicit navigation/action timeouts must stay pinned.

### Local Supabase E2E Profile

The browser suite can run against local Supabase without changing the hosted E2E profile:

Prerequisite: install and start Docker before using local Supabase E2E commands. The Supabase CLI starts the local services as Docker containers, and the E2E doctor verifies Docker, the CLI, Auth, REST, the service-role Admin API, direct PostgreSQL access, and the JWT secret before the browser server starts.

```bash
pnpm supabase:e2e:start:minimal
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

This starts a dedicated local Supabase E2E project, not the manual development local Supabase project. The default E2E local stack is minimal. Use `pnpm supabase:e2e:start` or `*:local-supabase:full` only for tests that need Storage, Realtime, Edge Functions, or logging services.

The generated files are:

-   `packages/universo-core-backend/base/.env.e2e.local-supabase`
-   `packages/universo-core-frontend/base/.env.e2e.local-supabase`

The generated backend file is based on `.env.e2e` when present, then `.env`, then `.env.e2e.example`, then `.env.example`. The generator keeps unrelated application settings and replaces only local Supabase/PostgreSQL values plus E2E execution defaults.

The E2E local scripts set `UNIVERSO_ENV_FILE` and `UNIVERSO_FRONTEND_ENV_FILE` explicitly. The normal `build:e2e` and `test:e2e:*` commands continue to use `.env.e2e.local` / `.env.e2e` and remain available for hosted Supabase validation.

Dedicated E2E local ports:

-   API: `http://127.0.0.1:55321`
-   Database: `127.0.0.1:55322`
-   Studio: `http://127.0.0.1:55323`

Shared/main Supabase mode is only for manual debugging. It requires `E2E_ALLOW_MAIN_SUPABASE=true` and `E2E_FULL_RESET_MODE=off`; otherwise the E2E loader refuses to use `.env` or the dev local Supabase profile.

## What The Suite Must Cover

-   Real login and least-privilege navigation boundaries.
-   Metahub create, copy, delete, settings, members, and publication flows.
-   Entity-type authoring through the real Entities workspace, including preset-backed creation and manual creation from the `empty` metahub template.
-   Shared Resources flows for layouts, attributes, constants, values, and shared scripts.
-   Runtime-facing publication and linked-application flows.
-   Snapshot export/import fixtures that match the currently shipped entity-first schema.
-   GitBook screenshot generators that open the real UI and capture the real product state.

## Engineering Rules

1. Prefer user-facing locators such as roles, labels, and stable test ids.
2. Reuse existing dialogs, cards, and list surfaces instead of adding test-only UI branches.
3. Use API-assisted setup only when it removes irrelevant boilerplate without hiding the product behavior under test.
4. Fail closed when a required backend state never appears; do not mask product defects with broad retries.
5. Keep browser assertions focused on visible behavior and persisted backend state, not on implementation details.
6. When a flow covers Resources, verify the real labels shown in the UI, not only the API payload.
7. When a flow covers templates, include the `empty` path so manual entity-type authoring stays protected against regressions.

## Recommended Workflow

1. Run `pnpm run build:e2e`.
2. Run the smallest relevant Playwright slice first.
3. Inspect HTML report, trace, screenshots, and video only on failures.
4. Regenerate screenshots or fixtures only after the product flow itself is green.
5. Let cleanup finish so the manifest can remove test users and metahubs safely.

## References

-   [Playwright Best Practices](https://playwright.dev/docs/best-practices)
-   [Playwright Locators](https://playwright.dev/docs/locators)
-   [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts)
