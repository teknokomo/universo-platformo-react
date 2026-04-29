# Browser E2E Testing

This directory contains the browser-testing foundation for agent-driven verification.

## Goals

-   Let the agent validate the real browser state instead of reasoning from JSX alone.
-   Run repeatable user flows with Playwright CLI and keep MCP as a focused debugging tool.
-   Provision a disposable authenticated user for each run and remove it during teardown.
-   Reset the dedicated hosted E2E Supabase to a project-empty state before and after suite runs.
-   Keep secrets out of git by using dedicated e2e env files.

## Files

-   `playwright.config.mjs`: main Playwright test runner configuration.
-   `playwright.mcp.config.json`: MCP runtime configuration for interactive browser debugging.
-   `specs/setup/auth.setup.ts`: provisions a fresh e2e user, logs in through the UI, and stores browser state.
-   `specs/matrix/*`: targeted locale/theme assertions that extend the suite to Russian rendering and dark-theme coverage without duplicating the entire flow inventory across every browser project.
-   `specs/smoke/*`: fast confidence checks for route availability and authenticated shell loading.
-   `specs/smoke/admin-access.spec.ts`: verifies least-privilege redirect-away behavior for `/admin` and positive bootstrap-admin access to the real admin area.
-   `specs/flows/*`: browser flows that click real controls and verify persisted outcomes.
-   `specs/flows/admin-rbac-management.spec.ts`: browser coverage for admin role creation, permission-matrix updates, global-user assignment and revocation, role deletion, and locale creation.
-   `specs/flows/admin-instance-settings.spec.ts`: browser coverage for admin instance editing and platform codename settings using the existing admin UI.
-   `specs/flows/admin-role-users.spec.ts`: browser coverage for the real role-users page in admin and backend-confirmed assigned-user visibility.
-   `specs/flows/application-settings-limits.spec.ts`: browser coverage for application workspace-limit editing and runtime create blocking at the configured limit.
-   `specs/flows/application-workspace-regressions.spec.ts`: browser coverage for pre-schema limits info-state plus multi-user workspace isolation in workspace-enabled applications.
-   `specs/flows/application-connectors.spec.ts`: browser coverage for connector creation, publication-link selection, single-connector guardrails, and edit persistence through the existing application admin UI.
-   `specs/flows/application-connector-board-migrations.spec.ts`: browser coverage for connector board schema state, navigation into application migration history, and rollback-analysis dialog state using real migration data.
-   `specs/flows/application-list.spec.ts`: browser coverage for the shared applications list, direct runtime navigation, and control-panel navigation into application admin.
-   `specs/flows/application-runtime-rows.spec.ts`: browser coverage for runtime row create, edit, copy, and delete through the existing application runtime UI with backend persistence checks.
-   `specs/flows/boards-overview.spec.ts`: browser coverage for metahub board, application board, admin board, and instance board counters with backend summary checks.
-   `specs/flows/codename-mode.spec.ts`: browser coverage for codename UI mode switching at platform-default and per-metahub levels while keeping persisted codenames in VLC shape.
-   `specs/flows/metahub-create-options-codename.spec.ts`: browser coverage for codename auto-fill UX, manual override reset behavior, and metahub create-options combinations with mandatory branch/layout defaults.
-   `specs/flows/metahub-branches-migrations.spec.ts`: browser coverage for branch create/copy/default/activate/delete flows plus branch-aware metahub migrations planning through the existing UI.
-   `specs/flows/metahub-domain-entities.spec.ts`: browser coverage for create/copy/delete across hub, catalog, set, enumeration, attribute, element, value, and constant routes using the existing metahub UI surfaces.
-   `specs/flows/metahub-entity-dialog-regressions.spec.ts`: browser coverage for constant edit, enumeration-value edit/copy field completeness, and localized attribute-copy codename generation.
-   `specs/flows/metahub-layouts.spec.ts`: browser coverage for layouts list/detail routes and persisted widget-toggle state through the existing layout UI.
-   `specs/flows/metahub-members-permissions.spec.ts`: browser coverage for metahub member invite flow and negative permission boundaries for non-managing roles.
-   `specs/flows/application-members-access.spec.ts`: browser coverage for application access invite flow, redirect-away behavior, and admin promotion checks.
-   `specs/flows/metahub-settings.spec.ts`: browser coverage for the real metahub settings page, unsaved-change affordance, and persisted settings updates.
-   `specs/flows/publication-application-regression.spec.ts`: combined and split publication-to-application regression coverage.
-   `specs/flows/publication-create-variants.spec.ts`: browser coverage for publication-only and publication-plus-application-without-schema creation variants.
-   `specs/generators/*`: on-demand snapshot generators that create metahub configurations and export persistent fixture files. Excluded from normal test runs; invoked explicitly via `pnpm run test:e2e:generators`.
-   `specs/visual/*`: screenshot assertions for layout regression detection.
-   `restart-safe-check.mjs`: sequential built-app start/stop/start validation for fresh-db restart safety.
-   `dialog-idle-diagnostics.mjs`: bounded diagnostics script that keeps a create dialog open, captures Chromium metrics via CDP, and stores trace/heap artifacts for idle resource investigation.
-   `support/backend/e2eFullReset.mjs`: guarded full reset/inspection helpers for project-owned schemas, `upl_migrations`, and Supabase auth users.
-   `support/backend/e2eDatabase.mjs`: shared direct PostgreSQL connection and advisory-lock helpers for hosted E2E maintenance scripts.
-   `support/backend/run-e2e-doctor.mjs`: CLI report for leftover project-owned schemas, auth users, and local E2E artifacts.
-   `support/backend/*`: provisioning, API login, run manifest, and cleanup helpers.
-   `support/browser/preferences.ts`: browser-local helpers for locale/theme preferences used by the targeted matrix assertions.
-   `support/env/*`: env-loading helpers that force the `e2e` configuration boundary.

## Env Strategy

Use dedicated local-only files:

-   `packages/universo-core-backend/base/.env.e2e.local`
-   `packages/universo-core-frontend/base/.env.e2e.local`

Commit only the `.example` variants. Never commit real secrets or generated storage state.

Backend e2e env must contain:

-   `SUPABASE_URL`
-   `SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `SUPABASE_ANON_KEY`
-   `SERVICE_ROLE_KEY`
-   `BOOTSTRAP_SUPERUSER_EMAIL`
-   `BOOTSTRAP_SUPERUSER_PASSWORD`

Optional e2e-specific overrides:

-   `SUPABASE_JWT_SECRET`
-   `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
-   `AUTH_LOGIN_RATE_LIMIT_MAX`
-   `E2E_TEST_USER_PASSWORD`
-   `E2E_TEST_USER_ROLE_CODENAMES`
-   `E2E_TEST_USER_EMAIL_DOMAIN`
-   `E2E_FULL_RESET_MODE` (`strict` by default, `off` only for manual debugging)

For large suites, raise `AUTH_LOGIN_RATE_LIMIT_MAX` in the dedicated e2e backend env instead of weakening production defaults. The browser suite legitimately performs many auth round-trips across disposable users, bootstrap-admin setup, and API-assisted provisioning.

All wrapper-based E2E commands now enforce the hosted-Supabase reset contract: drop all application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations`, and Supabase auth users before the suite starts and again after the server stops. Infrastructure schemas such as `public` stay in place so startup migrations can recreate platform state on top of a valid Supabase/Postgres base.
Direct `pnpm exec playwright test ...` commands bypass that contract and are therefore debug-only. Use the wrapper commands below for normal validation.

## Run Modes

Install browser binaries once:

```bash
pnpm run playwright:install
```

Run the fast browser contract:

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
pnpm run test:e2e:flows
```

Run focused RBAC and high-risk chained regressions:

```bash
pnpm run build:e2e
pnpm run test:e2e:permissions
pnpm run test:e2e:combined
```

Run the full suite including screenshots:

```bash
pnpm run build:e2e
pnpm run test:e2e:full
```

Run the targeted locale/theme matrix checks:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs specs/matrix/auth-locale-theme.spec.ts
```

Validate restart-safe behavior against the same fresh e2e environment:

```bash
pnpm run build:e2e
pnpm run test:e2e:restart-safe
```

Capture bounded idle-dialog diagnostics with trace and Chromium metrics:

```bash
pnpm run build:e2e
pnpm run test:e2e:diagnostics
```

The e2e runner is intentionally single-run:

-   It acquires a lock under `tools/testing/e2e/.artifacts/run.lock` and fails fast if another suite is already active.
-   It fails fast when `E2E_BASE_URL` already serves a running app, preventing accidental reuse of stale servers.
-   It refuses `--no-deps` because bypassing Playwright dependencies would skip the authenticated setup contract.
-   `E2E_FULL_RESET_MODE=strict` is incompatible with `E2E_ALLOW_REUSE_SERVER=true`; set `E2E_FULL_RESET_MODE=off` only for manual debugging against an already-running instance.

Tag usage:

-   `@smoke`: startup/auth/access boundary checks.
    This includes both deny-by-default admin access and positive bootstrap-admin entry.
-   `@flow`: primary user and admin workflows.
-   `@permission`: RBAC and access-denied expectations.
-   `@combined`: chained publication/application/connectors regressions.
-   `@visual`: screenshot assertions for layout drift.
-   `@generator`: on-demand snapshot generators (excluded from normal runs).

Current `@flow` inventory: `30` tests across `25` files, confirmed via `pnpm exec playwright test -c tools/testing/e2e/playwright.config.mjs --grep @flow --list` on 2026-04-02.
Current full-suite validation status: `pnpm run test:e2e:full` passed with `42/42` tests on 2026-04-02 after finishing the QA remediation wave, closing Gap D CRUD breadth, and stabilizing the combined publication-plus-schema flow.

Refresh reviewed screenshot baselines after an intentional UI change:

```bash
pnpm run build:e2e
pnpm run test:e2e:visual:update
```

Run on-demand snapshot generators (see **Snapshot Generators** below):

```bash
pnpm run build:e2e
pnpm run test:e2e:generators
```

Force teardown if a previous run crashed:

```bash
pnpm run test:e2e:cleanup
```

Inspect the hosted E2E Supabase state without mutating it:

```bash
pnpm run test:e2e:doctor
```

Preview the full reset plan without dropping schemas or deleting users:

```bash
pnpm run test:e2e:reset:dry
```

Force the full hosted-Supabase reset manually:

```bash
pnpm run test:e2e:reset
```

## Snapshot Generators

Generator specs live in `specs/generators/` and produce persistent fixture files without requiring `pnpm dev`. They use the same E2E infrastructure (built app via `pnpm start`, disposable test user, API helpers) but are **excluded from all normal test runs** (`test:e2e:full`, `test:e2e:flows`, etc.).

### How It Works

1.  The Playwright config defines a dedicated `generators` project that only matches `specs/generators/*.spec.ts`.
2.  The `chromium` project explicitly ignores generator files via `testIgnore`, so they never run during `test:e2e:full` or any `--grep @flow`/`@smoke`/etc. command.
3.  Generator specs write their output to `tools/fixtures/` — this directory is **not** cleaned by the E2E runner and is **not** in `.gitignore`, so fixture files persist until manually deleted and can be committed to the repository.
4.  Informational screenshots go to `test-results/self-hosted-app/` (or a similarly named generator-specific folder), which **is** cleaned on the next E2E run — this is expected.

### Running Generators

Run all generators:

```bash
pnpm run build:e2e
pnpm run test:e2e:generators
```

Run a specific generator by name:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"
```

If the server is already running (e.g., from a previous E2E run), reuse it:

```bash
E2E_FULL_RESET_MODE=off E2E_ALLOW_REUSE_SERVER=true pnpm run test:e2e:generators
```

### Available Generators

| Generator | Output | Description |
| --- | --- | --- |
| `metahubs-self-hosted-app-export` | `tools/fixtures/metahubs-self-hosted-app-snapshot.json` | Creates the localized Metahubs Self-Hosted App fixture, seeds the runtime settings baseline, publishes it, and exports the snapshot used by the self-hosted parity flows. |
| `metahubs-quiz-app-export` | `tools/fixtures/metahubs-quiz-app-snapshot.json` | Creates the localized quiz application fixture and exports the snapshot used by quiz runtime import flows. |
| `metahubs-lms-app-export` | `tools/fixtures/metahubs-lms-app-snapshot.json` | Creates the localized LMS application fixture and exports the snapshot used by LMS runtime import flows. |

### Creating New Generators

To add a new generator:

1.  Create a spec file in `specs/generators/`, e.g., `admin-config-export.spec.ts`.
2.  Tag the test with `@generator` (not `@flow`).
3.  Use `createLoggedInApiContext` + API helpers from `support/backend/api-session.mjs` to create resources via API.
4.  Write output fixtures to `tools/fixtures/` using `fs.writeFileSync`.
5.  Use `recordCreatedMetahub` / `recordCreatedApplication` so the runner can clean up database resources after the generator finishes.
6.  Set a generous `test.setTimeout()` (generators are long-running by nature, 300s+ is typical).

Generator specs follow the same conventions as flow specs — they depend on the `setup` project for authentication, use the same E2E env, and participate in the same cleanup lifecycle.

## Manual Screenshots and Video

Use direct Playwright artifacts when you need visual evidence before or after a change without running the whole suite.

Manual screenshots against an already-running app:

```bash
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' --full-page http://127.0.0.1:3100 test-results/manual-cli/home-full.png
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' http://127.0.0.1:3100/auth test-results/manual-cli/auth.png
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' --color-scheme dark http://127.0.0.1:3100 test-results/manual-cli/home-dark.png
```

Useful flags:

-   `--full-page` captures the whole document, not only the visible viewport.
-   `--viewport-size '1440,900'` pins the review surface to the suite default desktop size.
-   `--color-scheme dark` is useful for matrix-style UI checks without running the full matrix project.
-   `--wait-for-timeout 2500` or `--wait-for-selector <selector>` helps wait for hydration, dialogs, or async content.

Prefer manual screenshots for:

-   before/after UI comparisons during implementation;
-   targeted evidence for a single route, dialog, or role state;
-   quick visual inspection when a full `@visual` run would be excessive.

Artifacts and failure media:

-   Store ad hoc screenshots under `test-results/manual-cli/` so they stay separate from suite-managed artifacts.
-   Regular Playwright test runs already write failure screenshots, traces, and HTML report data under `test-results/` and `playwright-report/`.
-   The suite config currently keeps `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, and `video: 'retain-on-failure'`.

Manual video capture is also possible, but Playwright does not provide a dedicated `playwright video` CLI subcommand. Use a short inline Node script with the Playwright library when you need a reviewable recording:

```bash
pnpm exec node --input-type=module <<'EOF'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const outDir = path.resolve('test-results/manual-cli-video')
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }
})

const page = await context.newPage()
await page.goto('http://127.0.0.1:3100', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.goto('http://127.0.0.1:3100/auth', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const video = page.video()
await context.close()
const savedPath = await video.path()
console.log(savedPath)
EOF
```

The saved file will usually be a `.webm` artifact inside `test-results/manual-cli-video/`, which you can review directly in VS Code.

## Agent Workflow

Use this default sequence for agent-driven implementation:

1. `pnpm run build:e2e`
2. `pnpm run test:e2e:smoke`
3. If the change touches permissions, run `pnpm run test:e2e:permissions`
4. If the change touches publication/application chaining, run `pnpm run test:e2e:combined`
5. Run `pnpm run test:e2e:flows` for the broader browser flow slice
6. If the change is layout-sensitive, run `pnpm run test:e2e:visual`
7. Inspect `playwright-report/` and `test-results/` only on failures
8. Use MCP only when interactive inspection is needed and CLI artifacts are insufficient
9. Treat transient `/auth` error alerts as retryable only inside the shared login helper; persistent auth failures must still fail the suite
10. When codename platform defaults change, verify `/api/v1/metahubs/codename-defaults` through browser-driven coverage instead of assuming the admin-settings write alone is authoritative
11. Keep admin-role API-assisted setup compatible with the same VLC codename contract the browser uses; single-locale enforcement must never degrade codenames into legacy flat objects
12. For application runtime CRUD, prefer the shared `apps-template-mui` row-actions and form-dialog contracts; browser coverage should keep asserting persisted row state instead of inventing runtime-specific test surfaces
13. For board pages, prefer backend-backed summary assertions through the existing dashboard cards instead of adding dedicated test widgets or duplicate overview components
14. For connector-board and migration pages, prefer backend-verified migration names, summaries, and rollback-analysis results over DOM-only assumptions or ad-hoc timeout-based waits
15. Keep Playwright deterministic defaults pinned for suite work: fixed locale/timezone/light theme, reduced motion, blocked service workers, and explicit action/navigation timeouts should stay aligned with the runner contract
16. Treat `test-results/` and `playwright-report/` as per-run artifacts; the runner now clears them before each suite so report contents always match the latest execution
17. For `publication -> linked application` setup, wait for the publication to report a ready active version before creating the linked application; if creation still fails, treat it as a real product defect and keep the helper fail-closed instead of masking it with retries
18. Keep the targeted matrix slice focused: verify Russian rendering and dark theme through dedicated matrix specs instead of cloning every CRUD flow into multiple locale/theme projects
19. Use `test:e2e:restart-safe` whenever bootstrap, migrations, or first-run initialization changes so second-start regressions on a fresh database are caught before manual QA
20. Use `test:e2e:diagnostics` when a create/edit dialog appears to idle hot; the script records Chromium performance metrics and a Playwright trace instead of trying to infer CPU churn from DOM assertions alone

## Safety Rules

-   The browser suite must never expose `SERVICE_ROLE_KEY` to frontend code.
-   Disposable users are created through authenticated admin routes and deleted through Supabase admin cleanup.
-   Generated artifacts live only under `tools/testing/e2e/.auth` and `tools/testing/e2e/.artifacts`.
-   Cleanup keeps the run manifest when teardown is incomplete so the next `test:e2e:cleanup` can recover orphaned resources.
-   Do not run multiple e2e commands in parallel against the same workspace; the runner enforces sequential execution for data safety.
-   Screenshot baselines should be reviewed manually before accepting updates.
-   Shared browser login retries are intentionally bounded and only trigger when the page remains on `/auth` with a visible error alert.
-   Restart-safe validation intentionally starts and stops the built app twice; the child `pnpm start` process may log `ELIFECYCLE` on controlled shutdown, but the command itself must exit successfully or the check is considered failed.

## MCP Usage

The repository includes `playwright.mcp.config.json` and `playwright.mcp.client.example.json`.

Start the pinned MCP server from the repository root:

```bash
pnpm run mcp:playwright
```

Then point your local MCP client to the example JSON and run the normal e2e setup once so that `storage-state.json` exists. MCP should be treated as a debugging companion, not as the primary regression runner.
