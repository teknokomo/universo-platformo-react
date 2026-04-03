# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Active Open Tasks (Canonical)



- [x] Close the verified snapshot/runtime follow-up gaps from 2026-04-04
	- Note: This wave reopens only the residual defects confirmed by direct verification after the previous implementation pass. Do not touch unrelated working-tree changes.
	- Required outcomes:
		- [x] Make `importFromSnapshot` cleanup-safe for the two early post-create failure branches (`Failed to create metahub branch`, `Branch schema not found`) instead of returning before compensation.
		- [x] Replace the runtime view smoke test with a deterministic `/a/...` flow that provisions a real application, asserts enhanced runtime controls, and proves the FlowListTable path is active when row reordering is enabled.
		- [x] Persist enhanced runtime layout settings into the self-model generator contract and regenerate `tools/fixtures/self-model-metahub-snapshot.json` from the corrected order of operations.
		- [x] Fix the manual self-model utility CSRF endpoint and refresh generator documentation so the described scope matches the real 13-section fixture.
	- Validation target: focused metahubs-backend tests, apps-template/runtime browser flow validation, targeted self-model generator rerun when available, and the canonical root `pnpm build`.
	- Outcome: early import branch/schema failures now reuse the rollback cleanup path, `app-runtime-views.spec.ts` exercises the real `/a/${applicationId}` route with card/search/list assertions, the self-model generator reran successfully and regenerated the fixture with enhanced runtime layout fields, the manual utility now uses `/api/v1/auth/csrf`, the generator docs describe the 13-section scope, and the validation stack passed (`metahubsRoutes.test.ts`, targeted runtime Playwright flow, targeted generator run, root `pnpm build`).


- [x] Implement QA closure for snapshot import cleanup, runtime list consistency, and self-model scope
	- Note: Keep scope limited to the six validated QA items from the current implementation pass. Do not revert unrelated worktree changes.
	- Required outcomes:
		- [x] Make metahub snapshot import cleanup-safe on restore/publication failure, including explicit cleanup-failure reporting.
		- [x] Add backend tests for import rollback and cleanup-failure paths.
		- [x] Fix apps-template runtime filtered-view pagination/search consistency in MainGrid.
		- [x] Finish the enableRowReordering runtime path with FlowListTable integration and LayoutDetails wiring without regressing the DataGrid path.
		- [x] Expand the self-model generator/fixture contract from the current 9-catalog shape to the planned 13-section scope and update dependent assertions/docs if needed.
		- [x] Clean remaining diagnostics/editorial issues in snapshotArchive.test.ts and SnapshotRestoreService.test.ts, then revalidate with focused tests and a full root pnpm build.
	- Validation target: focused Jest/Vitest runs for touched backend/frontend/utils areas, then full root `pnpm build`.
	- Outcome: metahub import now fails closed with explicit rollback vs cleanup-failure responses, MainGrid uses local filtered totals and FlowListTable reorder mode when configured, LayoutDetails exposes the now-real reorder toggle again, the self-model generator and CLI create the planned 13 sections via real hub/set/enumeration endpoints and regenerated `tools/fixtures/self-model-metahub-snapshot.json`, the two QA-flagged test files are diagnostics-clean, focused tests passed, and the root `pnpm build` finished green (`28/28`).

- [x] QA remediation follow-up for snapshot/runtime settings hardening
	- Note: Reopen the completed snapshot wave only for validated post-QA implementation gaps. Keep the fix scope limited to concrete defects: snapshot transport type contract drift, runtime view-settings contract drift, RBAC/import test gaps, and repository cleanup artifacts.
	- Required outcomes:
		- [x] Align `buildSnapshotEnvelope()` input typing with the stricter snapshot transport schema and remove the confirmed editor/TypeScript contract drift.
		- [x] Resolve the `enableRowReordering` contract debt consistently across apps-template-mui runtime, layout settings UI, and documentation without introducing a noop feature seam.
		- [x] Add backend tests that prove publication version import behavior and permission-path expectations more directly.
		- [x] Remove accidental repository-root artifact files left outside the project contract.
		- [x] Revalidate with focused package tests/checks and a full root `pnpm build`.
	- Validation target: strict package-level TypeScript validation for touched code where relevant, focused Jest/Vitest runs for touched backend/utils areas, then full root `pnpm build`.
	- Outcome: tightened snapshot envelope typing in `@universo/utils` and backend export callsites, removed the stale `enableRowReordering` config seam from runtime/docs/i18n, added publication-version import happy-path assertions, deleted accidental root artifacts, and finished with green focused tests plus a green root `pnpm build` (`28/28`).

- [x] Fix snapshot import UX, backend compatibility, and remaining E2E failures
	- Note: Closed the snapshot-import follow-up wave by fixing the import-created publication/version linkage, aligning the import dialog with the shared modal contract, and stabilizing the remaining full-suite regressions.
	- Required outcomes:
		- [x] Import dialog copy is renamed from snapshot wording to configuration wording, including RU text for the no-file-selected state.
		- [x] Import dialog matches the shared modal style contract and does not render the extra horizontal divider lines.
		- [x] `tools/fixtures/self-model-metahub-snapshot.json` imports successfully through the real browser UI.
		- [x] Connector-driven schema creation for an application linked to the imported self-model metahub no longer fails on `GET /api/v1/application/:id/diff`.
		- [x] E2E covers the imported-self-model -> connector -> create schema path.
		- [x] Residual full-suite failures are fixed and `pnpm run test:e2e:full` completes green.
		- [x] Wrapper-managed E2E runs stop the owned server and release port `3100` after completion.
	- Validation target: focused Playwright CLI reruns for the touched flows, then full `pnpm run test:e2e:full`, plus an explicit post-run port-availability check.
	- Outcome: full root `pnpm build` passed; targeted metahubs import tests, connector/snapshot/admin/visual Playwright reruns passed; final `pnpm run test:e2e:full` finished green; post-run `lsof -iTCP:3100 -sTCP:LISTEN` showed no listener.

- [x] E2E Supabase full reset and teardown hardening
	- Note: Replaced manifest-only cleanup as the primary isolation boundary with a guarded full project reset for the dedicated hosted E2E Supabase. Scope now covers application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations`, Supabase auth users, runner orchestration, diagnostics, and EN/RU docs.
	- Validation:
		- [x] Added a safe `full reset` backend helper with dry-run/report support and strict E2E-only guardrails.
		- [x] Derived resettable fixed schemas from registered system app definitions while keeping infrastructure schema `public` intact and self-healed.
		- [x] Integrated reset before suite startup and after server shutdown in the Playwright runner.
		- [x] Kept manifest cleanup as a narrow recovery/helper path, not the primary isolation strategy.
		- [x] Added doctor/report tooling to verify leftover schemas/users after teardown.
		- [x] Updated English and Russian E2E documentation with the new reset contract and safety rules.
		- [x] Validated via full `pnpm build`, full `pnpm run test:e2e:full`, explicit post-run cleanup verification, and a green smoke rerun proving automatic runner-finalize reset.
	- Outcome: full `test:e2e:full` completed and exposed 5 pre-existing spec failures outside the reset scope (`app-runtime-views`, `profile-update`, `snapshot-export-import`, visual metahub dialog). After the run, `test:e2e:cleanup` + `test:e2e:doctor -- --assert-empty` confirmed zero project-owned schemas/auth users/artifacts; after the runner process-group fix, `test:e2e:smoke` passed `11/11` and automatic `runner-finalize` left the database empty without manual intervention.

- [x] Address validated PR #745 review findings in admin locale, instance, and role codename flows.
	- Note: Implemented the confirmed fixes only: locale typing now preserves a trailing separator, instance inline edits keep untouched locales, and role codename validation now honors runtime `metahubs` settings on backend routes while preserving legacy slug compatibility. Validation passed via focused Jest, package builds, and full `pnpm build`.

- [x] Add Package Configuration for `core-frontend` to include `.env*` files in build inputs, closing the .env cache-invalidation gap.
	- Note: `core-frontend` is the only package that reads `.env` via `dotenv` at Vite build time. Without explicit `.env*` inputs, changing a `.env` value would not invalidate the cached build.

- [x] Metahub Self-Hosted App & Snapshot Export/Import — ALL PHASES COMPLETE
	- Plan: `memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md`
	- QA v2 deep-dive found 3 critical + 4 high + 4 medium issues; all 11 corrections applied to plan v3
	- Phases 1–8 ALL COMPLETE — backend, frontend, apps-template-mui, layout config UI, self-model, tests, docs
	- Full build passing: 28 successful, 0 failed; snapshot tests: 15/15 passing; unit tests: 274/274
	- QA Post-Implementation Fixes (2026-04-03):
		- [x] H1: E2E tampered hash test now uses 64-char fake hash to test integrity, not Zod length
		- [x] H2: Removed noop `enableRowReordering` toggle from LayoutDetails View Settings (Zod schema field kept for future DnD)
		- [x] M3: Added per-entity field count (200) and element count (10,000) validation to `validateSnapshotEnvelope`
		- [x] M4: File input in ImportSnapshotDialog now resets on close via `useRef`
	- Self-Model E2E (2026-04-03):
		- [x] Created `self-model-metahub-export.spec.ts` — creates 9 catalogs with 27 attributes, publication, version, screenshots, exports to fixture
		- [x] Fixed codename JSONB/VLC format in all E2E specs (createMetahub, catalogs, attributes, publication, version)
		- [x] Fixture saved: `tools/fixtures/self-model-metahub-snapshot.json` (62 KB, 13 entities)
		- [x] 3 screenshots in `test-results/self-model/`
	- Remaining QA Findings (2026-04-03):
		- [x] F2: Import endpoint VLC format fix — replaced `buildLocalizedContent` with `ensureVLC` in `importFromSnapshot`
		- [x] F1: E2E toolbar dropdown selector fixed — `toolbar-primary-action-menu-trigger` (matches actual data-testid)
	- QA v3 Hardening Fixes (2026-04-03):
		- [x] C1: Fixed VLC format incompatibility — import now uses `ensureVLC()` instead of `buildLocalizedContent()` for name/description/publication
		- [x] H1+H2: Added `log.warn()` for unmapped hub references and silent cross-reference nullification in SnapshotRestoreService
		- [x] H3: `defaultLayoutId` confirmed as false positive — snapshot is self-consistent with original IDs
		- [x] H4: `enableRowReordering` intentionally kept as future DnD placeholder (previous QA decision)
		- [x] M1: Tightened Zod snapshot schema — explicit optional fields for known snapshot structure, passthrough kept for forward compatibility
		- [x] M2: Server-side `Content-Length` check added as defense-in-depth in import route (Express body parser also enforces global limit)
		- [x] L1: i18n keys confirmed already present (`export.exportVersion`, `export.exportMetahub` etc.)
		- [x] C2: Added 7 unit tests for import/export routes (401, 400, hash mismatch, 201 happy path, export 401/404/400)
		- [x] M5: Created SnapshotRestoreService.test.ts with 6 unit tests (entities, hub remap, constants, layouts, orphan skip, empty snapshot)
		- [x] M3: Fixed E2E snapshot spec — selector mismatch + import response ID extraction
	- Full build: 28/28 passing; metahubs-backend: 47 suites, 421 tests; utils: 274 tests
	- Generators Architecture (2026-04-03):
		- [x] Created `specs/generators/` folder and moved `self-model-metahub-export.spec.ts` from `specs/flows/`
		- [x] Added `generators` project to `playwright.config.mjs` (dedicated `testMatch`, isolated from `chromium` via `testIgnore`)
		- [x] Updated `package.json`: `test:e2e:full` explicitly lists non-generator projects; added `test:e2e:generators` script
		- [x] Documented Snapshot Generators section in both E2E READMEs (EN + RU, 331/331 lines parity)

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
