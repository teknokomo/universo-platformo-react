# Browser E2E Testing

Use the Playwright browser suite when implementation must be validated against the real rendered UI and real backend effects.

## When To Run It

- Run `test:e2e:smoke` after changes to auth, routing, startup, or route guards.
- Run `test:e2e:permissions` after changes to admin roles, users, or access rules.
- Run `test:e2e:combined` after changes to publications, linked applications, connectors, or schema generation.
- Run `test:e2e:flows` for the broader day-to-day regression slice.
- Run `test:e2e:visual` only when layout-sensitive pages or dialogs changed.
- Run `test:e2e:restart-safe` after bootstrap, migrations, or first-run initialization changes.
- Run `test:e2e:diagnostics` when an entity dialog appears to idle hot and resource churn needs artifacts instead of guesswork.

## Environment Contract

- Keep browser-test secrets in `packages/universo-core-backend/base/.env.e2e.local`.
- Keep optional frontend overrides in `packages/universo-core-frontend/base/.env.e2e.local`.
- Use the dedicated Supabase test project and never commit real secrets or generated auth state.
- The backend e2e env must include Supabase URL, `SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `SUPABASE_ANON_KEY`, service-role key, bootstrap admin credentials, and database connection settings.
- Keep production-style auth rate limits by default, but raise `AUTH_LOGIN_RATE_LIMIT_MAX` in the dedicated e2e backend env when the full suite legitimately needs many login round-trips.

## What The Suite Covers

- Auth setup with disposable test users and stored browser state.
- Admin smoke coverage for least-privilege redirect-away behavior and positive bootstrap-admin access to the real `/admin` area.
- Admin access boundaries plus browser CRUD for roles, global users, locales, instances, and platform codename settings.
- Admin role-users coverage that verifies the real assigned-user list for a role through the existing admin route.
- Metahub create, copy, delete, settings-save, codename-mode, and member-permission flows.
- Metahub layouts coverage that verifies existing list/detail routes and persisted widget-toggle behavior without introducing test-only layout components.
- Metahub domain-entity coverage for hubs, catalogs, sets, enumerations, values, attributes, elements, and constants through the existing CRUD surfaces.
- Metahub branch lifecycle coverage for create, copy, default, activate, and delete through the existing Branches page.
- Metahub migrations coverage that switches the real branch selector, verifies branch-aware migration planning, and confirms that Apply stays disabled when no upgrade is pending.
- Application list coverage that verifies the shared list route and navigation into both runtime and admin surfaces.
- Application access/member flows that verify invite, redirect-away behavior for non-admin members, and admin promotion checks.
- Board overview coverage for metahub, application, admin, and instance pages with backend-verified counters rendered through the existing dashboard cards.
- Application connector coverage that creates a connector through the browser, selects a publication-backed metahub link, verifies the single-connector guardrail, and confirms edit persistence.
- Connector-board and application-migration coverage that verifies schema-state cards, navigation into migration history, backend-backed migration rows, and rollback-analysis dialog state.
- Application settings coverage that persists workspace limits and verifies runtime row creation becomes blocked at the configured limit.
- Application workspace regression coverage that verifies the pre-schema limits info-state and browser-level multi-user isolation when workspaces are enabled.
- Application runtime coverage that creates, edits, copies, and deletes runtime rows through the existing shared CRUD UI while verifying persisted row data after each step.
- Codename coverage that verifies UI switching between single-locale and localized editors while persisted codenames remain one JSONB/VLC field; disabling localized editing may trim non-primary locales, but must never flatten storage to plain text.
- Codename UX coverage that verifies name-driven auto-fill, manual codename override, and full-name reset restoring auto-generation.
- Metahub create-options coverage that verifies optional default entities can be disabled while branch/layout remain mandatory.
- Publication variant coverage for publication-only and publication-plus-application-without-schema flows in addition to the combined publication-plus-schema regression path.
- Entity-dialog regression coverage for set constant edit, enumeration-value edit/copy field completeness, and localized attribute-copy codename generation.
- Publication create/version/sync coverage plus combined and split flows into linked applications and connectors.
- Targeted Russian light/dark matrix coverage without cloning the full CRUD suite across every locale/theme combination.
- Profile update and reviewed visual snapshots.
- Deterministic Playwright runtime defaults with per-run artifact cleanup and failure-only traces/screenshots/videos.

## Workflow

1. Run `pnpm run build:e2e`.
2. Run the smallest relevant tagged suite first.
3. Inspect Playwright HTML report, trace, screenshots, and video only on failures.
4. Use MCP only for interactive investigation after CLI artifacts are not enough.
5. Let cleanup finish so the manifest can remove test users and test data safely.
6. Keep browser login retries bounded and only for visible transient auth-error alerts on `/auth`; persistent login failures should still be treated as defects.
7. When browser behavior depends on platform codename defaults, prefer the browser-covered `/metahubs/codename-defaults` contract over assuming an admin-settings write has already propagated everywhere.
8. Keep admin role helpers aligned with the shared one-field VLC codename contract so `general.codenameLocalizedEnabled` only trims locale variants inside the persisted JSONB payload and never behaves like a storage-type switch.
9. Reuse the shared `apps-template-mui` dialog and row-actions contracts for runtime CRUD flows instead of introducing runtime-specific test-only selectors or alternate admin surfaces.
10. For board pages, assert the real dashboard counters against backend summary APIs instead of introducing separate board-only fixtures or fake analytics components.
11. For connector-board and migration pages, assert the existing cards and migration table against backend migration APIs instead of adding duplicate migration widgets or hard-coded DOM assumptions.
12. For MUI branch selectors, keep the `InputLabel`/`Select` association valid and prefer stable browser contracts over guessing raw VLC JSONB values from the rendered option text.
13. Keep the browser runner deterministic: locale/timezone/theme, reduced motion, blocked service workers, and explicit action/navigation timeouts should stay pinned together with per-run cleanup of `test-results/` and `playwright-report/`.
14. For publication-linked application setup, wait for the publication to expose a ready active version before creating the linked application; if creation still fails after readiness is satisfied, treat it as a product defect and keep the helper fail-closed instead of masking it with retries.
15. Keep language/theme coverage targeted: run the dedicated matrix spec for `ru-light` and `ru-dark` instead of multiplying every CRUD flow across the entire browser matrix.
16. Use the restart-safe command for fresh-database validation so first-start and second-start behavior stay under automation instead of manual repetition.
17. Use the diagnostics command when long-lived dialogs appear resource-heavy; capture CDP metrics and traces rather than asserting on browser performance heuristics in ordinary CRUD specs.
