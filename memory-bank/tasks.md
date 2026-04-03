# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Active Open Tasks (Canonical)

- [x] Address validated PR #745 review findings in admin locale, instance, and role codename flows.
	- Note: Implemented the confirmed fixes only: locale typing now preserves a trailing separator, instance inline edits keep untouched locales, and role codename validation now honors runtime `metahubs` settings on backend routes while preserving legacy slug compatibility. Validation passed via focused Jest, package builds, and full `pnpm build`.

- [x] Add Package Configuration for `core-frontend` to include `.env*` files in build inputs, closing the .env cache-invalidation gap.
	- Note: `core-frontend` is the only package that reads `.env` via `dotenv` at Vite build time. Without explicit `.env*` inputs, changing a `.env` value would not invalidate the cached build.

## Current Wave Notes — 2026-04-03

- The repository currently runs the root build through Turbo, but `turbo.json` still uses the legacy `pipeline` key and explicitly disables cache for `build`, so Turbo acts mostly as an orchestrator instead of a cache accelerator.
- The installed Turbo version is `1.10.16`, while the current stable line is `2.9.3`; the migration must therefore cover both behavior and configuration format changes.
- The package inventory confirms one special-case override is needed for `packages/apps-template-mui`, whose `build` script is `tsc --noEmit` and should not inherit artifact outputs from the root build task.
- CI currently caches PNPM dependencies but does not expose any `TURBO_*` remote-cache environment, so remote cache support can be wired safely through optional GitHub secrets without forcing it on contributors.
- The migration must keep full-build safety first: no pre-release Turbo flags, no speculative package-level overrides, and no weakening of environment correctness just to chase cache hits.

## Current Wave Notes — 2026-04-02

- User-provided screenshots show remaining oversized side gutters on metahub settings and metahub layout details after a clean rebuild.
- The first confirmed offender is `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutDetails.tsx`, which still wraps header and content in ad hoc horizontal padding instead of the shared contract.
- The final root cause was split between one local layout-details wrapper and the shared tab-bar contract: settings content already widened via `PAGE_CONTENT_GUTTER_MX`, but `PAGE_TAB_BAR_SX` still left tab rows 16px narrower than the content below.
- The follow-up closure updated the shared tab-bar contract, fixed the admin test to use the real instance settings route, and revalidated with `pnpm run build:e2e`, targeted Playwright flows, and a full `pnpm build`.
- The layouts detail page needed one extra follow-up: the shared MUI surfaces theme applies `padding: 16px` to every `MuiCard`, so `LayoutDetails` still rendered 16px narrower than the already-correct layouts list until the page locally zeroed card `p` and `gap`.

## Recently Completed Work (Compact)

## Unified Page Padding Remediation — 2026-04-02

> Status: COMPLETE — the shared page-spacing contract is now the canonical non-list layout rule.

- [x] Added `PAGE_CONTENT_GUTTER_MX` and `PAGE_TAB_BAR_SX` to `@universo/template-mui`.
- [x] Migrated the known drifted pages in admin, applications, and metahubs frontends.
- [x] Removed ad hoc tab/content padding that made settings and migration pages narrower than their sibling screens.
- [x] Captured before/after screenshots for visual verification.
- [x] Revalidated via full build and the latest green E2E suite.

## Manual Playwright Artifact Capture Documentation — 2026-04-02

> Status: COMPLETE — screenshot/video capture is documented and mirrored in both E2E READMEs.

- [x] Documented manual screenshot capture and artifact locations in `tools/testing/e2e/README.md`.
- [x] Mirrored the same content in `tools/testing/e2e/README-RU.md`.
- [x] Recorded a real `.webm` demo artifact for manual review.
- [x] Rechecked README parity after the update.

## E2E Guard Loading-Shell Flake Fix — 2026-04-02

> Status: COMPLETE — direct navigation to `/metahubs` no longer flakes on the transient migration-guard shell.

- [x] Isolated the real failure from noisy cleanup logs.
- [x] Reused the existing guarded-route wait pattern instead of introducing a new timing hack.
- [x] Patched both affected specs that asserted the final heading too early.
- [x] Revalidated with a targeted Playwright rerun.

## E2E Hardening Follow-up Closure — 2026-04-02

> Status: COMPLETE — the final helper and backend timing races are closed; the browser suite is green.

- [x] Moved publication/application metadata creation for combined bootstrap into a committed pool transaction visible to DDL callbacks.
- [x] Reused committed compensation cleanup so rollback paths no longer depend on uncommitted request state.
- [x] Updated publication route tests for the committed metadata transaction and RLS reapplication path.
- [x] Replaced the last fragile publication persistence poll with response-id-based or persisted-state confirmation.
- [x] Hardened the remaining metahub create flow against optimistic `waitForResponse(...)` races.
- [x] Fixed admin access smoke locator ambiguity and the constant-edit dialog regression discovered by the full rerun.
- [x] Extended matrix coverage to Russian and dark-theme authenticated surfaces.
- [x] Revalidated publication variants, restart-safe behavior, diagnostics, codename UX, metahub create options, limits info-state, and workspace isolation.
- [x] Reran the full E2E suite to a green state.

## Extended Playwright Coverage, Restart-Safe Validation, And Diagnostics — 2026-04-02

> Status: COMPLETE — the acceptance surface now covers more real product behavior without introducing test-only UI.

- [x] Added locale/theme matrix coverage for Russian and dark mode.
- [x] Added restart-safe fresh-db validation with sequential starts.
- [x] Added bounded browser diagnostics for long-lived dialogs.
- [x] Added browser coverage for publication variants, metahub create options, codename autofill/reset, and dialog regressions.
- [x] Added application limits pre-schema info-state and workspace-isolation browser coverage.
- [x] Refreshed docs and memory-bank state to the validated inventory.

## Playwright Route-Surface Completion — 2026-04-02

> Status: COMPLETE — the planned board, connector, runtime, and route-surface coverage is complete.

- [x] Covered the remaining application/admin/metahub routes through existing UI surfaces.
- [x] Stabilized linked-application setup without masking real errors.
- [x] Added board-level coverage for backend-driven counters.
- [x] Added connector, migration-history, and runtime-row browser scenarios.
- [x] Refreshed route-inventory documentation after the validation pass.

## Full Business Scenario Playwright Coverage — 2026-04-01

> Status: COMPLETE — the browser-testing foundation now covers the planned scenario matrix.

- [x] Closed the flaky metahub list/browser contract after create-copy-delete.
- [x] Expanded helpers and manifest tracking for admin, locales, publications, applications, and cleanup.
- [x] Added admin smoke/RBAC/global-user coverage.
- [x] Added metahub/application board, members, access, connectors, runtime rows, settings, publication, and chained-flow coverage.
- [x] Added the publishable-key alias needed for modern Supabase configuration compatibility.
- [x] Updated README and docs to the expanded workflow.

## Supabase JWT/JWKS Compatibility Remediation — 2026-04-01

> Status: COMPLETE — backend auth and RLS now support both legacy HS256 and modern Supabase JWKS projects.

- [x] Replaced symmetric-only verification with dual-mode JWT verification.
- [x] Updated startup validation to accept JWKS-backed projects.
- [x] Preserved backward compatibility for existing secret-based environments.
- [x] Fixed the `ensureAuthWithRls` aborted-request lifecycle race.
- [x] Updated docs and env examples for the new contract.
- [x] Revalidated with focused tests, build, and browser suites.

## E2E Browser Testing QA Remediation — 2026-03-31

> Status: COMPLETE — the browser-testing stack is now cleanup-safe, portable, and validated end-to-end.

- [x] Made cleanup retain recovery state on partial teardown.
- [x] Separated backend-only env loading from frontend e2e overrides.
- [x] Pinned runner/runtime behavior for safer repeated execution.
- [x] Switched the default e2e persona to a least-privilege role where possible.
- [x] Added reviewed visual baselines and an explicit snapshot-update workflow.
- [x] Closed the remaining QA debt in docs and memory-bank state.

## QA Audit Remediation: Test Coverage & TypeORM Cleanup — 2026-04-03

> Status: COMPLETE — route coverage gaps and residual TypeORM comments were closed.

- [x] Added admin-backend route tests for settings, instances, locales/public locales, and roles.
- [x] Added metahubs-backend public route coverage for the public metahub hierarchy.
- [x] Removed residual TypeORM comments from touched source files.
- [x] Revalidated admin-backend, metahubs-backend, and the root build.

## Deep Domain Error Cleanup & Hardening — 2026-04-03

> Status: COMPLETE — remaining domain-error, response-shape, and cleanup debt is closed.

- [x] Converted remaining generic service errors to typed domain errors.
- [x] Unified handler response details at the root error payload level.
- [x] Removed duplicate error guards and stale helper code.
- [x] Updated affected route/service/helper tests to the canonical contract.
- [x] Revalidated with build, Jest, and Vitest.

## Late-March Technical Closure Summary — 2026-03-31 To 2026-03-24

> Status: COMPLETE — detailed implementation logs from the late-March closures were moved to progress.md.

### QA And Refactoring
- [x] Closed the comprehensive QA fix wave across bugs, architecture debt, public routes, and dead code.
- [x] Finished the metahubs/applications 9-phase refactor and the related follow-up QA passes.
- [x] Added direct coverage for shared abstractions such as `createMetahubHandler`, `useListDialogs`, and error guards.
- [x] Details: progress.md#2026-04-01-comprehensive-qa-fix--all-16-issues-resolved
- [x] Details: progress.md#2026-03-30-metahubs--applications-refactoring--all-9-phases-complete

### Security And Dependency Hardening
- [x] Replaced deprecated `csurf` with the local CSRF middleware.
- [x] Closed the late-March dependency/CVE hardening waves.
- [x] Reduced dead dependency and override noise in the workspace.
- [x] Details: progress.md#2026-03-28-comprehensive-cleanup--csurf-replacement
- [x] Details: progress.md#2026-03-27-security-vulnerability-fixes-3-cves

### Codename JSONB Closure
- [x] Closed the codename JSONB/VLC convergence across fixed schemas, runtime metadata, backend routes, and touched frontend flows.
- [x] Fixed template seeding, copy flows, and admin role codename editing to obey the same canonical contract.
- [x] Details: progress.md#2026-03-24-codename-jsonb-final-contract-closure
- [x] Details: progress.md#2026-03-25-admin-role-codename-vlc-enablement

### Admin, Start, And Application Workspaces
- [x] Closed bootstrap-superuser startup and follow-up QA hardening.
- [x] Closed application workspaces/public-access follow-through around limits, breadcrumbs, seed propagation, and access rules.
- [x] Details: progress.md#2026-03-19-bootstrap-superuser-startup-closure
- [x] Details: progress.md#2026-03-19-application-workspaces-ux-breadcrumbs-seed-data-and-limits-closure

## Historical Archive — 2026-03-17 To 2026-03-11

> Status: ARCHIVED AS RECENT HISTORY — keep these closures discoverable while avoiding verbose notes in the active ledger.

### Platform System Attributes And Snapshot Integrity — 2026-03-17

- [x] Added platform-governed `_upl_*` catalog system attributes through one shared backend policy seam.
- [x] Routed catalog system views through dedicated `/system` pages.
- [x] Hydrated publication `systemFields` back into executable release-bundle payloads.
- [x] Kept publication snapshot hashing parity-safe across producer and consumer packages.
- [x] Disabled stale placeholder reuse on scoped tab switches.

### Admin Roles / Metapanel Revalidation — 2026-03-17

- [x] Confirmed `AbilityContext.refreshAbility()` as the real role-refresh contract.
- [x] Confirmed onboarding completion must move to the final CTA.
- [x] Confirmed `/start` plus a root resolver are both required in the live routing topology.
- [x] Confirmed menu filtering must operate at section level, not only on `rootMenuItems`.
- [x] Promoted metapanel/admin stats to a dedicated shared dashboard contract.

### Start System App Hardening — 2026-03-16 To 2026-03-15

- [x] Kept generated-table-dependent support migrations in `post_schema_generation`.
- [x] Fixed clean-bootstrap ordering for start-system support migrations.
- [x] Converged the start/onboarding system app onto the application-like fixed-schema model.
- [x] Closed branding/env cleanup tied to the start-system wave.
- [x] Revalidated startup behavior on a fresh environment.

### Unified Database Access Standardization — 2026-03-14

- [x] Standardized backend DB access around Tier 1 request-scoped executors, Tier 2 pool executors, and Tier 3 explicit DDL boundaries.
- [x] Added `tools/lint-db-access.mjs` as the enforcement gate.
- [x] Moved raw Knex access behind dedicated DDL boundaries where required.
- [x] Hardened identifier handling and optimistic-lock helpers.
- [x] Synced docs and memory-bank notes to the SQL-first contract.

### Optional Global Catalog And Definition Lifecycle — 2026-03-13

- [x] Supported catalog-enabled and catalog-disabled modes without forcing full registry bootstrap on every startup.
- [x] Kept local `_app_migrations` / `_mhb_migrations` history canonical.
- [x] Recorded deterministic fixed-system baselines and safe backfill behavior.
- [x] Routed active imports through the real draft-review-publish lifecycle.
- [x] Treated active published revision exports as healthy in doctor checks.
- [x] Recorded bundle-style exports in the same lifecycle ledger.
- [x] Made no-op detection dependency-aware, not checksum-only.
- [x] Restored browser env precedence and managed owner-id validation contracts.

### Metahub QA And Repeated-Start Stability — 2026-03-13

- [x] Fixed shared-table sorting/filtering regressions.
- [x] Restored active-row filtering across touched metahub runtime reads and stats paths.
- [x] Revalidated repeated-start behavior for fixed-system snapshots.
- [x] Closed final delete-cascade and soft-delete parity defects.
- [x] Kept focused validation green after each reopen closure.

### System-App Structural Convergence — 2026-03-12

- [x] Converged admin, profile, metahubs, and applications fixed schemas onto the application-like contract.
- [x] Moved fixed-system business-table creation to definition-driven schema generation.
- [x] Removed the legacy applications reconcile migration from the active manifest path.
- [x] Added shared active-row and soft-delete helper contracts.
- [x] Targeted converged `cat_*`, `cfg_*`, `doc_*`, and `rel_*` tables in touched persistence helpers.

### Frontend Acceptance Coverage Burst — 2026-03-12

- [x] Added page-level CRUD acceptance coverage for applications, metahubs, connectors, and publication-linked flows.
- [x] Added sync-dialog and migration-guard acceptance coverage.
- [x] Added runtime-shell acceptance coverage for `ApplicationRuntime`.
- [x] Revalidated touched frontend packages and the root build.
- [x] Kept publication-to-application and control-panel navigation flows under direct coverage.

### Metadata, Compiler, And Bootstrap Foundation — 2026-03-12

- [x] Added fixed-system metadata bootstrap observability and CLI entry points.
- [x] Added doctor/startup fail-fast gates for incomplete metadata and leftover legacy table names.
- [x] Added forward-only reconciliation bridges for legacy fixed schemas.
- [x] Preserved explicit object/attribute metadata through compiler artifacts.
- [x] Revalidated touched backend/platform packages and the root build.

### Registry, Naming, And Runtime Ownership Foundation — 2026-03-11

- [x] Moved application runtime sync ownership into `@universo/applications-backend`.
- [x] Kept metahubs limited to publication runtime-source loading.
- [x] Replaced local branch/runtime naming with shared migrations-core helpers.
- [x] Strengthened bootstrap and doctor visibility around registry/export contracts.
- [x] Added deep acceptance proof for registry lifecycle and publication-driven runtime sync.
