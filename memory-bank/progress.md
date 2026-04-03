# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0.56.0-alpha | 2026-03-27 | 0.56.0 Alpha — 2026-03-27 (Cured Disease) 🤒      | Entity-display fixes, codename JSONB/VLC convergence, security hardening, csurf replacement        |
| 0.55.0-alpha | 2026-03-19 | 0.55.0 Alpha — 2026-03-19 (Best Role) 🎬          | DB access standard, start app, platform attributes, admin roles/metapanel, application workspaces, bootstrap superuser |
| 0.54.0-alpha | 2026-03-13 | 0.54.0 Alpha — 2026-03-13 (Beaver Migration) 🦫   | MetaHub drag-and-drop ordering, nested hubs, create options/settings UX, optimistic CRUD, SQL-first convergence |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 (Lucky Set) 🍱          | Copy options expansion across Applications, Metahubs, Branches, and Sets/Constants delivery        |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪   | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts                 |
| 0.51.0-alpha | 2026-02-19 | 0.51.0 Alpha — 2026-02-19 (Counting Sticks) 🥢    | Headless Controller, Application Templates, Enumerations                                            |
| 0.50.0-alpha | 2026-02-13 | 0.50.0 Alpha — 2026-02-13 (Great Love) ❤️         | Applications, Template System, DDL Migration Engine, Enhanced Migrations                            |
| 0.49.0-alpha | 2026-02-05 | 0.49.0 Alpha — 2026-02-05 (Stylish Cow) 🐮        | Attribute Data Types, Display Attribute, Layouts System                                             |
| 0.48.0-alpha | 2026-01-29 | 0.48.0 Alpha — 2026-01-29 (Joint Work) 🪏         | Branches, Elements rename, Three-level system fields                                                |
| 0.47.0-alpha | 2026-01-23 | 0.47.0 Alpha — 2026-01-23 (Friendly Integration) 🫶 | Runtime migrations, Publications, schema-ddl                                                      |
| 0.46.0-alpha | 2026-01-16 | 0.46.0 Alpha — 2026-01-16 (Running Stream) 🌊     | Applications modules, DDD architecture                                                              |
| 0.45.0-alpha | 2026-01-12 | 0.45.0 Alpha — 2026-01-11 (Structured Structure) 😳 | i18n localized fields, VLC, Catalogs                                                              |
| 0.44.0-alpha | 2026-01-04 | 0.44.0 Alpha — 2026-01-04 (Fascinating Acquaintance) 🖖 | Onboarding, legal consent, cookie banner, captcha                                              |
| 0.43.0-alpha | 2025-12-27 | 0.43.0 Alpha — 2025-12-27 (New Future) 🏋️‍♂️    | Pagination fixes, onboarding wizard                                                                 |
| 0.42.0-alpha | 2025-12-18 | 0.42.0 Alpha — 2025-12-18 (Dance Agents) 👯‍♀️   | VLC system, dynamic locales, upstream shell 3.0                                                    |
| 0.41.0-alpha | 2025-12-11 | 0.41.0 Alpha — 2025-12-11 (High Mountains) 🌄     | Admin panel, auth migration, UUID v7                                                                |
| 0.40.0-alpha | 2025-12-06 | 0.40.0 Alpha — 2025-12-05 (Straight Rows) 🎹      | Package extraction, Admin RBAC, global naming                                                       |
| 0.39.0-alpha | 2025-11-26 | 0.39.0 Alpha — 2025-11-25 (Mighty Campaign) 🧙🏿 | Storages, Campaigns, useMutation refactor                                                          |
| 0.38.0-alpha | 2025-11-22 | 0.38.0 Alpha — 2025-11-21 (Secret Organization) 🥷 | Projects, AR.js Quiz, Organizations                                                               |
| 0.37.0-alpha | 2025-11-14 | 0.37.0 Alpha — 2025-11-13 (Smooth Horizons) 🌅    | REST API docs, Uniks metrics, Clusters                                                              |
| 0.36.0-alpha | 2025-11-07 | 0.36.0 Alpha — 2025-11-07 (Revolutionary indicators) 📈 | dayjs migration, publish-frontend, Metaverse Dashboard                                         |
| 0.35.0-alpha | 2025-10-30 | 0.35.0 Alpha — 2025-10-30 (Bold Steps) 💃         | i18n TypeScript migration, Rate limiting                                                            |
| 0.34.0-alpha | 2025-10-23 | 0.34.0 Alpha — 2025-10-23 (Black Hole) ☕️        | Global monorepo refactoring, tsdown build system                                                   |
| 0.33.0-alpha | 2025-10-16 | 0.33.0 Alpha — 2025-10-16 (School Test) 💼        | Publication system fixes, Metaverses module                                                         |
| 0.32.0-alpha | 2025-10-09 | 0.32.0 Alpha — 2025-10-09 (Straight Path) 🛴      | Canvas versioning, Telemetry, Pagination                                                            |
| 0.31.0-alpha | 2025-10-02 | 0.31.0 Alpha — 2025-10-02 (Victory Versions) 🏆   | Quiz editing, Canvas refactor, MUI Template                                                         |
| 0.30.0-alpha | 2025-09-21 | 0.30.0 Alpha — 2025-09-21 (New Doors) 🚪          | TypeScript aliases, Publication library, Analytics                                                  |
| 0.29.0-alpha | 2025-09-15 | 0.29.0 Alpha — 2025-09-15 (Cluster Backpack) 🎒   | Resources/Entities architecture, CI i18n                                                            |
| 0.28.0-alpha | 2025-09-07 | 0.28.0 Alpha — 2025-09-07 (Orbital Switch) 🥨     | Resources, Entities modules, Template quiz                                                          |
| 0.27.0-alpha | 2025-08-31 | 0.27.0 Alpha — 2025-08-31 (Stable Takeoff) 🐣     | Finance module, i18n, Language switcher                                                             |
| 0.26.0-alpha | 2025-08-24 | 0.26.0 Alpha — 2025-08-24 (Slow Colossus) 🐌      | MMOOMM template, Colyseus multiplayer                                                               |
| 0.25.0-alpha | 2025-08-17 | 0.25.0 Alpha — 2025-08-17 (Gentle Memory) 😼      | Space Builder, Metaverse MVP, core utils                                                            |
| 0.24.0-alpha | 2025-08-12 | 0.24.0 Alpha — 2025-08-12 (Stellar Backdrop) 🌌   | Space Builder enhancements, AR.js wallpaper                                                         |
| 0.23.0-alpha | 2025-08-05 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | Russian docs, UPDL node params                                                                      |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️    | Memory Bank, MMOOMM improvements                                                                    |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 (Firm Resolve) 💪       | Handler refactoring, PlayCanvas stabilization                                                       |

## 2026-04-03 PR #745 Review Remediation Closure

Closed the validated review findings on the Playwright CLI E2E / QA hardening branch without widening the change scope beyond confirmed defects.

| Area | Resolution |
| --- | --- |
| Locale input UX | `LocaleDialog` now preserves a temporary trailing `-` while the user types region-based locale codes such as `en-US`, instead of collapsing `en-` back to `en`. |
| Localized instance edits | `InstanceList` now updates only the active locale via `updateLocalizedContentLocale(...)`, so editing one locale no longer overwrites translations stored in other locales. |
| Role codename validation | `admin-backend` role routes now read runtime `metahubs` codename settings for exact validation, while the shared schema remains broad enough to avoid pre-parse false negatives and still accepts legacy lowercase slug codenames. |
| Regression coverage | Added focused route tests that prove runtime-setting-aware role codename rejection/acceptance paths. |

### Validation
- `pnpm --filter @universo/admin-backend test -- src/tests/routes/rolesRoutes.test.ts`
- `pnpm --filter @universo/admin-backend build`
- `pnpm --filter @universo/admin-frontend build`
- `pnpm build` (`28 successful, 28 total`)

## 2026-04-03 Turbo 2 .env Cache Correctness Hardening

Added a Package Configuration at `packages/universo-core-frontend/base/turbo.json` to include `.env*` files (excluding `*.example`) in the `core-frontend` build hash. This closes the gap where changing a `.env` value would not invalidate the Vite-built bundle. Backend packages (`core-backend`) do NOT need this fix since `tsc` does not read `.env` at build time.

### Validation
- Dry-run after appending a test line to `.env`: `core-frontend` and `core-backend` MISS, all others HIT.
- After reverting `.env`: 28/28 cache HITs restored (FULL TURBO in ~1.9s).

## 2026-04-03 Deep Domain Error Cleanup & Hardening — ALL ISSUES RESOLVED

Closed the final error-handling cleanup wave after the late-March metahubs/applications refactor and QA passes.

| Area | Resolution |
| --- | --- |
| Service error model | Converted remaining generic `throw new Error()` paths to typed domain errors and aligned factory helpers with frontend error-code expectations. |
| Response contract | `domainErrorHandler` and `createMetahubHandler` now expose `{ error, code, ...details }`, removing nested-details drift. |
| Test parity | Updated route, controller, service, and helper tests to assert the canonical domain-error shape instead of message-sniffing behavior. |
| Cleanup | Removed duplicate error guards, orphaned try-blocks, and one remaining lodash helper usage on the touched path. |
| Validation | Full workspace build, touched Jest suites, and Vitest remained green. |

### Validation
- Build: `28/28` packages successful.
- Jest: `45/45` suites green on the touched wave.
- Vitest: touched file set green.

## 2026-04-03 Turbo 2 Root Contract Migration And Cache Hardening

Completed the root Turborepo modernization so the monorepo now runs on a current Turbo 2 contract with real cacheability instead of an effectively uncached orchestration layer.

| Area | Resolution |
| --- | --- |
| Root task model | Migrated the root config from legacy `pipeline` syntax to Turbo 2 `tasks`, added a root `packageManager`, and upgraded the workspace to `turbo 2.9.3`. |
| Cache correctness | Restored build caching by removing the previous `build.cache = false` behavior and then hardening task `inputs` so generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts no longer self-invalidate subsequent runs. |
| Package exceptions | Added one evidence-based package override for `packages/apps-template-mui`, whose `build` contract is `tsc --noEmit` and therefore must not advertise artifact outputs. |
| CI contract | Wired optional `TURBO_TEAM` and `TURBO_TOKEN` secrets into GitHub Actions so remote cache can be enabled without forcing extra local setup on contributors. |
| Documentation | Updated the root README pair and memory-bank context to document the new Turbo 2 build contract and repeated-build cache expectation. |

### Validation
- `pnpm install` completed successfully after the Turbo 2 upgrade.
- First `pnpm build` under Turbo 2 passed with `28/28` packages successful.
- Repeated-build validation exposed and confirmed the self-invalidation seam through Turbo summaries before the `inputs` exclusions were added.
- Final repeated `pnpm build` after the `inputs` fix ended with `Cached: 28 cached, 28 total` in about `1.8s`.

## 2026-04-02 Shared Page-Spacing Regression Follow-up Closure

Closed the rebuild-discovered spacing drift that remained on settings/layout pages after the earlier page-padding remediation.

| Area | Resolution |
| --- | --- |
| Shared UI contract | Updated `PAGE_TAB_BAR_SX` so settings tab rows widen to the same horizontal gutter as the content underneath instead of staying 16px narrower. |
| Affected pages | Revalidated metahub settings, metahub layout details, admin settings, and application settings against the corrected shared contract; `LayoutDetails` also needed a local `MainCard` `p: 0, gap: 0` override because the shared MUI surfaces theme adds `padding: 16px` to every card root. |
| E2E coverage | Added geometry-based Playwright assertions for the touched settings/layout screens and corrected the admin flow to use the real instance settings route. |
| Validation | The dedicated `build:e2e`, targeted Playwright rerun, and full root build all stayed green after the follow-up patch. |

### Validation
- `pnpm run build:e2e`: `28/28` packages successful.
- `pnpm exec playwright test -c tools/testing/e2e/playwright.config.mjs tools/testing/e2e/specs/flows/metahub-layouts.spec.ts`: `2 passed` after the local layout-details card-padding fix.
- Targeted Playwright rerun: `5 passed`.
- `pnpm build`: `28/28` packages successful.

## 2026-04-02 Unified Page Padding Remediation

Introduced one shared spacing contract for non-list pages and migrated the known drifted screens to it.

| Area | Resolution |
| --- | --- |
| Shared UI contract | Added `PAGE_CONTENT_GUTTER_MX` and `PAGE_TAB_BAR_SX` to `@universo/template-mui`. |
| Affected pages | `AdminSettings`, `ApplicationSettings`, `ApplicationMigrations`, `SettingsPage`, and `MetahubMigrations` now use the shared contract. |
| UI result | Tabs flush with content edges and settings/migration pages align with the canonical `ViewHeader` geometry. |
| Evidence | Before/after screenshots captured and compared; the remediation also stayed green under the browser suite. |

### Validation
- `pnpm build` passed (`28/28`).
- Latest full browser suite stayed green (`42/42`).

## 2026-04-02 Final E2E Hardening Closure and Full-Suite Green

Closed the last helper and route-timing regressions in the Playwright suite without weakening assertions.

| Area | Resolution |
| --- | --- |
| Create/copy determinism | Replaced brittle `waitForResponse(...)` timing dependencies with backend-persistence confirmation in the touched metahub flows. |
| Guarded routes | Direct navigation to guarded metahub pages now waits through the transient migration-guard shell before steady-state assertions. |
| Regression contract | Publication variants, admin RBAC, metahub create/copy/delete, and branch flows remained green after the last fixes. |
| Validation | Targeted reruns stayed green before the final full suite. |

### Validation
- `pnpm run test:e2e:full` finished at `42 passed`.
- Targeted route-flow reruns stayed green on the same wave.

## 2026-04-02 Extended Playwright Coverage, Restart-Safe Validation, and Diagnostics

Expanded browser acceptance coverage around locale/theme, restart-safe startup, diagnostics, publication variants, codename UX, and workspace isolation.

| Area | Resolution |
| --- | --- |
| Locale/theme matrix | Added focused Russian and dark-theme coverage without cloning the entire CRUD surface. |
| Restart-safe checks | Added sequential start-stop-start validation against the same e2e environment. |
| Diagnostics | Added bounded browser diagnostics and artifact capture for long-lived dialog investigation. |
| Product flows | Covered publication create variants, metahub create options, codename autofill/reset, dialog regressions, pre-schema limits, and workspace isolation. |

### Validation
- `test:e2e:restart-safe` and diagnostics commands verified on the same remediation wave.
- Flow inventory and full-suite verification stayed aligned with the documented README state.

## 2026-04-02 Playwright Full-Suite Closure and Route-Surface Completion

Finished the remaining route-surface coverage planned for the browser-testing program.

| Area | Resolution |
| --- | --- |
| Linked-application stability | Removed retry masking and stabilized the linked application creation path through real publication readiness checks. |
| Board and route surfaces | Added browser coverage for board pages, admin role-users, application lists, layouts, connectors, migration history, and runtime CRUD through existing UI surfaces only. |
| Documentation parity | README and browser-testing guidance now reflect the validated route inventory and suite contract. |

### Validation
- Full route-surface coverage passed on the owned server.
- Flow inventory and suite counts were refreshed in docs during the same closure wave.

## 2026-04-01 Playwright Determinism and Linked Application Stability Hardening

Stabilized the Playwright runtime contract and the publication-linked application path under full-suite load.

| Area | Resolution |
| --- | --- |
| Runtime determinism | Pinned browser defaults, artifact cleanup, and timeout/motion behavior. |
| Linked application flow | Added publication-ready polling and bounded retry only for the known narrow generic-500 seam. |
| Suite reliability | The full flow slice and the full suite stopped relying on transport timing luck. |

### Validation
- Full flow slice green.
- Full browser suite green after the hardening pass.

## 2026-04-01 Supabase JWT/JWKS Compatibility Remediation — COMPLETE

Resolved the auth/runtime incompatibility between legacy HS256 projects and modern Supabase JWKS-backed JWT projects.

| Area | Resolution |
| --- | --- |
| Shared verification contract | Added one shared verifier that supports legacy `SUPABASE_JWT_SECRET` and modern JWKS validation. |
| RLS parity | Request auth and RLS setup now reuse the same verification path and no longer diverge on token shape. |
| Startup/env contract | Startup validation now accepts JWKS-era Supabase projects without forcing deprecated secret-only configuration. |
| Cleanup ordering | `ensureAuthWithRls` no longer releases the request session too early on aborted requests. |
| Docs | Backend docs and env guidance now explain JWKS support and pooler expectations for RLS workloads. |

### Validation
- Focused auth/core tests passed for both HS256 and JWKS paths.
- Build and browser validation passed against the updated Supabase test project.

## 2026-04-01 E2E Browser Testing QA Remediation — COMPLETE

Closed the foundational QA debt in the browser-testing stack.

| Area | Resolution |
| --- | --- |
| Cleanup safety | Retained manifests on partial teardown and made repeated cleanup idempotent enough to recover orphaned resources. |
| Runtime boundary | Separated backend-only env loading from frontend e2e env overrides. |
| Runner safety | Locked suite execution and stopped silently reusing stale servers by default. |
| Access defaults | Moved the default browser persona away from `Superuser` to least-privilege coverage where possible. |
| Visual layer | Added and documented committed Playwright snapshots with an explicit refresh workflow. |

### Validation
- End-to-end browser foundation validated against the real workspace runtime.

## 2026-04-01 Comprehensive QA Fix — ALL 16 ISSUES RESOLVED

Closed the broad cross-package QA report that covered bugs, architecture drift, public routes, and dead code.

| Area | Resolution |
| --- | --- |
| Product bugs | Fixed dialog-open state, breadcrumb fallback handling, and Metahub schema-sync response shape. |
| Backend architecture | Replaced remaining raw controller errors with domain errors and extracted the large public routes controller. |
| Public-route hardening | Added limit/offset validation and DTO filtering on the public metahubs surface. |
| Frontend cleanup | Removed dead hooks and migrated the touched list pages to `useListDialogs`. |
| Validation | Full workspace build plus full Jest/Vitest validation stayed green. |

## 2026-03-31 Late-March QA, Breadcrumbs, And Security Summary

The late-March wave focused on two threads: repository hardening and the large breadcrumb/query-state cleanup.

| Theme | Resolution |
| --- | --- |
| Breadcrumb refresh | Fixed the final root cause in `queryClient.clear()` during initial auth restore, then aligned retry/refetch behavior and authenticated client usage across breadcrumb hooks. |
| Attribute/codename UX | Restored the attribute-create button after VLC codename typing drift and fixed connector/metahub selector failures caused by JSONB/text SQL mismatches. |
| Security hardening | Upgraded/patched vulnerable dependency chains, removed hardcoded-secret fallbacks, and improved supply-chain policy (`minimumReleaseAge`, trust settings, exotic subdep blocking). |
| Cleanup | Removed dead hooks, dead comments, and remaining pre-refactor debt uncovered by the QA passes. |

### Representative validated outcomes
- Full build stayed green across the security and breadcrumb waves.
- Touched Jest/Vitest suites were rerun on each closure wave.
- The browser suite stayed green after the final breadcrumb/query fix.

## 2026-03-30 Metahubs & Applications Refactoring — ALL 9 PHASES COMPLETE

Completed the main structural refactor that split oversized route and frontend list surfaces into reusable abstractions.

| Phase | Resolution |
| --- | --- |
| Backend | Route files became thin registrations; controllers/services/stores and `asyncHandler` / `createMetahubHandler` became the default pattern. |
| Frontend | Large list pages were split into data hooks, utils, and presentation layers; shared mutation/error helpers were introduced. |
| Performance | Reused shared hub queries and batch child-attribute loading to remove repeated query work. |
| Testing and docs | Added direct tests for the new abstractions and updated package READMEs plus memory-bank context. |

### Validation
- Workspace build green.
- Touched backend/frontend test suites green.

## 2026-03-28 Comprehensive Cleanup & csurf Replacement

Replaced deprecated `csurf` with a local CSRF middleware and removed a large dead-dependency tail.

| Area | Resolution |
| --- | --- |
| CSRF contract | Preserved session-secret storage, `req.csrfToken()`, header/body/query token handling, and the existing 419 error mapping. |
| Dependency cleanup | Removed dead frontend devDependencies, stale Babel/browserlist config, and orphan root overrides. |
| Validation | Full build, lint, and large test surface stayed green after lockfile regeneration. |

## 2026-03-27 Security Vulnerability Fixes (3 CVEs)

Closed the initial late-March security batch.

| CVE Theme | Resolution |
| --- | --- |
| `SESSION_SECRET` | Moved to fail-fast outside development and auto-generated only for local dev. |
| `flatted` | Forced a patched transitive version through root overrides. |
| `happy-dom` | Upgraded the testing environment package and catalog version to a safe release line. |

### Validation
- Build green.
- Workspace tests green.

## 2026-03-25 Admin Role Codename VLC Enablement

Closed the last major admin-surface seam that still edited codenames as plain text.

| Area | Resolution |
| --- | --- |
| Backend | Roles persistence now treats codename as VLC/JSONB at the store boundary while text comparisons use extracted primary text. |
| Frontend | `RoleFormDialog` now uses `CodenameField` plus VLC-aware autofill and validation. |
| Shared types | Role payloads and admin-facing role shapes now carry canonical codename VLC values instead of strings. |
| QA follow-through | Fixed codename-specific validation wiring, copy truncation, route logging, and migration SQL parameter safety. |

### Validation
- Admin backend/frontend tests green.
- Root build green.

## 2026-03-24 Codename JSONB Final Contract Closure

Closed the codename migration so the live architecture now treats codename as one canonical JSONB/VLC field across fixed schemas, snapshots, runtime metadata, backend routes, and touched frontend flows.

| Area | Resolution |
| --- | --- |
| Fixed schemas and runtime metadata | Admin/metahubs fixed schemas plus runtime `_app_*` metadata now use one codename JSONB contract with extracted-primary text for lookup/order/uniqueness. |
| Backend route contract | Touched metahubs/admin routes stopped exchanging split codename payloads and now normalize canonical VLC payloads through shared helpers. |
| Frontend authoring | Touched metahubs/admin dialogs now use one canonical VLC codename value instead of split string/localized state. |
| Copy/seeding flows | Template seed, copy, retry, and duplicate-check flows now derive uniqueness from primary text but persist through canonical VLC helpers. |
| Browser export parity | Restored browser-safe export parity in `@universo/utils` so downstream dist consumers resolve the same codename helpers. |

### Related closures on the same wave
- Admin SQL helper security tightened for self-scoped authenticated introspection only.
- PL/pgSQL `RETURN QUERY` strict-type issues fixed with explicit `::TEXT` casts.
- Fixed-system metadata inspectors updated to understand JSONB codename rows.
- Idempotent metahubs auth FK and quoting fixes closed fresh-bootstrap failures in the same time window.

### Validation
- Focused admin/metahubs/utils/frontend builds and tests green.
- Final root build green.

## 2026-03-19 Bootstrap Superuser Startup Closure

Added automatic first-start bootstrap for the initial platform superuser.

| Area | Resolution |
| --- | --- |
| Shared provisioning | Startup bootstrap and admin create-user reuse one canonical provisioning/rollback pipeline. |
| Safe startup behavior | Bootstrap runs after migrations under advisory-lock protection and refuses unsafe elevation/reset scenarios. |
| Env/CLI parity | Added the required bootstrap env flags and service-role requirements to backend runtime/docs. |
| Follow-through | Later March follow-ups hardened rollback, protected-role mutation rules, and live integration coverage against real Supabase. |

### Validation
- Focused admin/core tests green.
- Final root build green after the follow-up QA closures.

## 2026-03-19 Application Workspaces UX, Breadcrumbs, Seed Data, And Limits Closure

Closed the largest application workspaces follow-through wave after the public-access implementation landed.

| Area | Resolution |
| --- | --- |
| Runtime limits | Moved limit state to a forward-compatible runtime table shape and fixed pre-schema/info-state UX. |
| Workspace seed propagation | Publication seed data now materializes into personal workspaces instead of leaking into workspace-less rows. |
| Breadcrumb/admin refresh | Cold reloads on application/publication/admin surfaces keep detail labels and menu visibility stable. |
| Access model | Public discovery, join/leave, member access, and runtime/admin role boundaries were hardened across backend and frontend paths. |
| UI polish | Start page offsets, onboarding progress, admin-entry routing, and runtime-limit banners were corrected across the same wave. |

### Validation
- Focused applications backend/frontend/template packages green.
- Final root build green.

## 2026-03-14 Unified Database Access Standardization

| Area | Resolution |
| --- | --- |
| Three-tier contract | Standardized backend DB access around request-scoped RLS executors, pool executors, and explicit Tier 3 DDL boundaries. |
| Enforcement | Added `tools/lint-db-access.mjs` as the policy gate for domain packages. |
| Identifier safety | Hardened shared identifier helpers and optimistic-lock boundaries for SQL-first paths. |
| Documentation | Synced READMEs, docs, and memory-bank architecture notes to the SQL-first contract. |

## 2026-03-13 Optional Global Catalog, Metahub QA, And Definition Lifecycle

| Area | Resolution |
| --- | --- |
| Optional catalog modes | The platform now supports catalog-enabled and catalog-disabled operation without forcing full definition-registry bootstrap on every startup. |
| Lifecycle integrity | Imports/exports and doctor checks now rely on real lifecycle provenance instead of checksum parity alone. |
| Metahub QA | Active-row parity, repeated-start stability, and sorting/filtering regressions were closed through focused QA reopens. |
| Validation | Platform/backend/workspace validation remained green through the closure waves. |

## 2026-03-12 System-App Structural Convergence And Acceptance Coverage

| Area | Resolution |
| --- | --- |
| Structural convergence | Admin, profile, applications, and metahubs fixed schemas moved onto one application-like model. |
| Metadata/compiler foundation | Added metadata observability, compiler artifact preservation, and fail-fast startup checks. |
| Acceptance proof | Added direct frontend acceptance coverage for CRUD, sync dialogs, migration guards, runtime shells, and publication-linked flows. |

## 2026-03-11 Registry, Naming, And Runtime Ownership Foundation

| Area | Resolution |
| --- | --- |
| Runtime ownership | Application runtime sync ownership moved decisively into `@universo/applications-backend`. |
| Managed naming | Shared schema-name helpers replaced local naming logic across bootstrap/runtime paths. |
| Registry foundation | Definition lifecycle and export-health checks received their first stable baseline. |

## Older 2025-07 To 2026-02 Summary

- Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model.
- Release milestones `0.21.0-alpha` through `0.52.0-alpha` are preserved in the version history table above and remain the canonical high-level timeline for those earlier waves.
