# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0.54.0-alpha | 2026-03-13 | 0.54.0 Alpha — 2026-03-13                          | MetaHub drag-and-drop ordering, nested hubs, create options/settings UX, optimistic CRUD, SQL-first convergence |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 (Lucky Set) 🍱          | Copy options expansion across Applications, Metahubs, Branches, and Sets/Constants delivery        |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪   | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts                 |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢                                 | Headless Controller, Application Templates, Enumerations                                            |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️                                      | Applications, Template System, DDL Migration Engine, Enhanced Migrations                            |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮                                     | Attribute Data Types, Display Attribute, Layouts System                                             |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                                      | Branches, Elements rename, Three-level system fields                                                |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶                            | Runtime migrations, Publications, schema-ddl                                                        |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊                                  | Applications modules, DDD architecture                                                              |
| 0.45.0-alpha | 2026-01-12 | Structured Structure 😳                            | i18n localized fields, VLC, Catalogs                                                                |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖                        | Onboarding, Legal consent, Cookie banner, Captcha                                                   |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️                                     | Pagination fixes, Onboarding wizard                                                                 |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯                                    | VLC system, Dynamic locales, upstream shell 3.0                                                     |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄                                  | Admin panel, Auth migration, UUID v7                                                                |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹                                   | Package extraction, Admin RBAC, Global naming                                                       |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿                               | Storages, Campaigns, useMutation refactor                                                           |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷                             | Projects, AR.js Quiz, Organizations                                                                 |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅                                 | REST API docs, Uniks metrics, Clusters                                                              |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈                        | dayjs migration, publish-frontend, Metaverse Dashboard                                              |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃                                      | i18n TypeScript migration, Rate limiting                                                            |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️                                     | Global monorepo refactoring, tsdown build system                                                    |

## 2026-03-19 PR #731 Bot Review Closure

Validated every bot review comment on PR #731 against the live codebase and only accepted the recommendations that improved correctness without regressing the recently delivered application workspace/public-access functionality.

| Area | Resolution |
| --- | --- |
| TypeScript path stability | Restored declaration-based path resolution for `@universo/applications-backend` in `metahubs-backend`, aligning it with the package's other backend declaration mappings and avoiding package-root resolution drift under Node16/exports semantics. |
| Settings menu cold-load UX | The shared dashboard `MenuContent` now keeps the application `Settings` item visible in a disabled/loading state until application detail definitively resolves, and only hides the item after a confirmed `schemaName = null`. This removes the transient disappearance reported in the bot review without exposing a dead-end active link. |
| Review triage discipline | Rejected one false-positive backend warning (`UUID_REGEX` was already defined) and two purely stylistic frontend suggestions that did not improve safety, behavior, or maintainability. |
| Regression coverage | Added a focused `MenuContent` regression for the unresolved-detail state while preserving the existing positive/negative schema visibility checks. |
| Validation | Focused `@universo/template-mui` tests passed (3/3), `@universo/template-mui` lint stayed green apart from pre-existing warning-only debt outside this change-set, `@universo/template-mui` build passed, `@universo/metahubs-backend` build passed, and the final root `pnpm build` completed green with 28/28 successful tasks in 2m51.348s. |

## 2026-03-19 Application Workspace QA Closure — Tabular Copy, Docs/Plan Sync, And Seed Regression

Closed the last QA reopen on the application workspaces/public-access implementation by fixing the remaining runtime permission seam, syncing the published role contract, and turning the draft plan artifact into a truthful completed record.

| Area | Resolution |
| --- | --- |
| Tabular copy permission contract | Runtime child-row copy now requires `createContent` instead of `deleteContent`, so `editor` can copy TABLE child rows without regaining delete capability. |
| Documentation consistency | The applications frontend READMEs now match the backend role matrix and no longer claim that `editor` can delete content. |
| Plan closure fidelity | The application workspaces/public-access plan now reflects the delivered implementation instead of leaving stale unchecked tasks in the artifact. |
| Seed regression depth | Added a deeper service regression proving that newly created personal workspaces materialize predefined seed rows with workspace ownership and seed-source tracking. |
| Validation | Focused backend route/service regressions passed (44/44), the full `@universo/applications-backend` suite passed (10/10 suites, 108/108 tests), `@universo/applications-backend` lint passed, `@universo/applications-frontend` lint stayed green, standalone `@universo/applications-backend` build passed after dependency rebuild, and the final root `pnpm build` completed green with 28/28 successful tasks in 2m51.348s. |

## Auth Start Spacing, Application Shell Refresh, Runtime Access, And Limit Banner Closure COMPLETE (2026-03-19)

The last reopen on the application workspaces/public-access wave closed the remaining UX and access regressions around authenticated mobile start pages, application admin entry, admin-shell refresh, and runtime limit messaging.
| Area | Resolution |
| --- | --- |
| Authenticated mobile start spacing | The authenticated onboarding/completion containers now use mobile-safe top padding that works with the authenticated fixed-header spacer without reintroducing guest desktop/header regressions. |
| Application admin entry stability | BaseEntityMenu now prevents trigger/menu click fallthrough, so `Control panel` navigation stays on `/a/:applicationId/admin` instead of being overwritten by card/runtime navigation. |
| Admin-shell refresh consistency | Application menu and breadcrumb detail queries now use a consistent detail shape with mount retries/revalidation, preventing `...` labels and missing `Settings` on cold admin-board refreshes. |
| Runtime limit messaging | The workspace-limit alert now renders inside the centered dashboard details area instead of spanning under the shell sidebar, while member mini-menu actions also gained explicit icons. |
| Joined-member runtime access | The runtime bootstrap path now resolves through membership-aware runtime schema access rather than owner/admin-only gating, so ordinary joined members can load the application runtime after `Join`. |
Validation:

- focused `@universo/start-frontend` tests passed (`21/21`).
- focused `@universo/applications-backend` route tests passed (`40/40`) and `@universo/applications-backend` lint/build passed.
- focused `@universo/applications-frontend` suites passed (`24/24` files, `117/117` tests) and `@universo/applications-frontend` lint passed.
- focused `@universo/template-mui` tests/build passed.
- `@universo/core-frontend` build passed.
| 0.33.0-alpha | 2025-10-16 | School Test 💼                                     | Publication system fixes, Metaverses module                                                         |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴                                   | Canvas versioning, Telemetry, Pagination                                                            |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆                                | Quiz editing, Canvas refactor, MUI Template                                                         |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                                       | TypeScript aliases, Publication library, Analytics                                                  |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒                                | Resources/Entities architecture, CI i18n                                                            |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨                                  | Resources, Entities modules, Template quiz                                                          |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣                                  | Finance module, i18n, Language switcher                                                             |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌                                   | MMOOMM template, Colyseus multiplayer                                                               |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼                                   | Space Builder, Metaverse MVP, core utils                                                            |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌                                | Space Builder enhancements, AR.js wallpaper                                                         |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️                              | Russian docs, UPDL node params                                                                      |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️                                 | Memory Bank, MMOOMM improvements                                                                    |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪                                    | Handler refactoring, PlayCanvas stabilization                                                       |

## 2026-03-19 Start Page Header Offset And Mobile Onboarding Progress Closure

Closed a UI reopen on the start/onboarding surface after the earlier fixed-header offset correction introduced a guest-only top gap and left the mobile onboarding progress area blank.

| Area | Resolution |
| --- | --- |
| Guest start page top gap | `StartLayoutMUI` now renders the fixed-header spacer only for authenticated users, so guest landing pages no longer show an empty strip above the hero while the authenticated onboarding shell keeps the needed offset under the fixed app bar. |
| Mobile onboarding progress | `OnboardingWizard` now follows a compact responsive MUI pattern on small screens: a labeled mobile progress block with current-step text plus `MobileStepper` dots instead of hiding the stepper entirely and leaving dead whitespace. |
| Final step naming | The last onboarding step label now reads `Acting` / `Действуем` instead of `Complete` / `Завершение`, matching the requested wording and the existing `Start Acting` CTA direction. |
| Validation | Focused `@universo/start-frontend` tests passed with 21/21 tests, `@universo/template-mui` build passed, and `@universo/core-frontend` build passed after rebuilding shared artifacts in dependency order. |

## 2026-03-19 Publications Refresh, Workspace DDL, And Application Admin Route Reopen Closure

Closed the final reopen after the clean-database retest exposed three live regressions: metahub publication breadcrumbs still collapsing to `...` on hard refresh, publication-linked application schema generation still failing inside workspace policy DDL, and application `Control panel` navigation falling through to the runtime route instead of the admin surface.

| Area | Resolution |
| --- | --- |
| Breadcrumb refresh resilience | `NavbarBreadcrumbs` now revalidates metahub/application detail queries on mount with stronger retry semantics, so cold refreshes on publications and application-admin pages no longer stay stuck on `...` after an early transient fetch failure. |
| Workspace policy DDL safety | `applicationWorkspaces.ts` no longer recreates workspace RLS policies through a single multi-statement `DROP POLICY ...; CREATE POLICY ...` call. The helper now executes drop and create as separate parameter-safe DDL steps, which removed the executor timeout seam in publication-linked schema generation. |
| Application admin route precedence | `@universo/core-frontend` now exports `MainRoutes` before the wildcard runtime branch so `/a/:applicationId/admin` is matched by the real admin tree again instead of being swallowed by the runtime `a/:applicationId/*` route. |
| Validation | Focused `@universo/template-mui` tests passed, focused `@universo/applications-backend` tests passed with 41/41 tests, focused `@universo/metahubs-backend` publication-route tests passed with 4/4 tests after the full rebuild, `@universo/core-frontend` build passed, and the final root `pnpm build` completed green with 28/28 successful tasks in 2m41.592s. |

## 2026-03-19 Application Workspaces UX, Breadcrumbs, Seed Data, And Limits Closure

Closed the final UX/data-consistency follow-up around publications breadcrumbs, application settings breadcrumbs/menu refresh, localized limits labels, workspace seed propagation, and limit enforcement behavior.

| Area | Resolution |
| --- | --- |
| Breadcrumb resilience on hard reload | Publications and application-settings breadcrumbs now render their full path even before the metahub/application name query resolves, and the real dashboard menu fetches application detail on refresh so `Settings` remains visible when runtime schema already exists. |
| Settings limits prerequisites | `Application Settings -> Limits` now stays reachable but shows explicit informational alerts when runtime schema is not created yet or workspace mode is disabled instead of surfacing an error state. |
| Localized limits labels | Limits payloads now resolve both the catalog display name and codename from VLC presentation data using the active locale, so Russian labels render correctly when available. |
| Forward-compatible runtime limits schema | Workspace row limits moved from `_app_workspace_limits` to `_app_limits` with scope/object/metric/period fields so future application-wide, role-based, and time-window limits can reuse the same table contract. |
| Workspace seed propagation | Workspace-enabled runtime sync now persists a seed template from publication predefined elements and materializes a personal seeded copy for every active workspace, including child TABLE rows, instead of creating workspace-less default rows. |
| Immediate limit UX | CRUD dashboards now update workspace limit counters optimistically after create/delete, block create/copy dialogs as soon as `canCreate` becomes false, and keep active query invalidation so the disabled-state/banner shows immediately after the limit is reached. |
| Validation | `@universo/applications-backend` lint passed; focused backend suites passed (2 suites, 41 tests) and backend build passed. `@universo/applications-frontend` lint passed; frontend package suite passed (24 files, 116 tests, 61.80% statements coverage) and frontend build passed. `@universo/apps-template-mui` focused tests passed (3 files, 10 tests) and build passed. `@universo/template-mui` focused tests passed (2 suites, 3 tests) and build passed. Final root `pnpm build` passed with 28/28 successful tasks in 3m2.14s. |

## 2026-03-19 Application Admin Surface And Runtime Role Enforcement Closure

Closed the remaining backend/admin-surface and runtime-role gaps that the last QA pass still identified after the public join-flow fixes.

| Area | Resolution |
| --- | --- |
| Admin metadata boundary | Application members, connector metadata, connector publication links, and application sync routes now require real `owner/admin` application roles instead of any joined membership. |
| Runtime role enforcement | Workspace-scoped runtime mutations now enforce the published role-permission contract directly, so `editor` can create and edit content but can no longer delete rows outside its declared capability set. |
| Public non-member contract | Public applications that are visible before `Join` now return an explicit no-permissions surface until membership is created, preventing future UI drift from mistaking discovery access for runtime/admin access. |
| Frontend validation stability | The full `@universo/applications-frontend` package suite is green again after stabilizing the long-running export and members tests and keeping the public/list/runtime regressions intact. |
| Validation | `@universo/applications-backend` lint passed and the backend full suite passed (10/10 suites, 105/105 tests). `@universo/applications-frontend` lint passed and the frontend full suite passed (24/24 files, 116/116 tests, 61.86% statements coverage). `@universo/core-frontend` build passed. Final root `pnpm build` passed with 28/28 successful tasks in 3m7.158s. |

## 2026-03-19 Application Public Runtime Guard And Permission Contract Closure

Closed the last access-contract and validation gaps left after the previous public-application reopen passes.

| Area | Resolution |
| --- | --- |
| Runtime route protection | The real `/a/:applicationId/*` runtime shell route is now wrapped with `ApplicationGuard` before the migration/runtime surface mounts, so public non-members can no longer bypass the explicit join flow by navigating directly to the runtime URL. |
| Public list entry safety | The applications table view no longer renders a direct runtime link for public non-members; before membership exists, the row keeps the explicit `Join` action instead of exposing a clickable application name. |
| Member permission contract | The published `member` permission surface is now aligned with the implemented workspace-scoped runtime CRUD behavior, so frontend/backend contracts no longer claim that members cannot create or edit content while the runtime actually allows it. |
| Frontend suite stability | The full `@universo/applications-frontend` package test run now completes green under coverage after raising the timeout budget for the heavy create-dialog integration tests and adding regression coverage for the table-view public non-member state. |
| Validation | `@universo/applications-backend` lint passed and the backend full suite passed (10/10 suites, 102/102 tests). `@universo/applications-frontend` lint passed and the frontend full suite passed (24/24 files, 116/116 tests, 61.86% statements coverage). `@universo/core-frontend` build passed. Final root `pnpm build` passed with 28/28 successful tasks in 3m7.078s. |

## 2026-03-19 Application Public Access Reopen Closure

Closed the follow-up reopen around start-page layout offset and public application access semantics for ordinary workspace users.

| Area | Resolution |
| --- | --- |
| Start-page desktop offset | The shared start layout now renders a toolbar-height offset below the fixed start app bar, and the bar itself uses `top` instead of margin shifting so onboarding/completion content no longer starts hidden behind the header. |
| Public app access boundary | Ordinary users with only global `applications:read` no longer receive synthetic application-owner access. Public apps remain discoverable and joinable, but admin routes and control-panel actions now require true application membership or elevated global admin access. |
| Frontend action safety | The applications list continues to show `Join` for public non-members and no longer exposes control-panel affordances in the read-only public-user scenario. |
| Regression coverage | Added backend route coverage for public list/detail semantics under read-only global access and frontend list coverage for the join-only public-user state. |
| Validation | `@universo/applications-backend` route suite passed (37/37), `@universo/applications-backend` lint passed, `@universo/applications-frontend` focused Vitest run passed (1 file, 24 tests), `@universo/applications-frontend` lint passed, `@universo/template-mui` build passed, and final root `pnpm build` passed with 28/28 successful tasks in 3m5.691s. |

## 2026-03-19 Application Workspaces Final Closure

Closed the last remaining shell-level gap for Applications workspaces and revalidated the full workspace after the final menu gating fix.

| Area | Resolution |
| --- | --- |
| Real shell menu gating | The actually used `@universo/template-mui` dashboard shell now hides `Application Settings` until the cached application detail proves that a runtime schema exists, so the menu contract matches the intended application lifecycle instead of exposing a dead-end entry. |
| Regression coverage | Added direct `MenuContent` regression coverage that seeds the shared React Query cache and proves `Settings` appears only for applications with `schemaName`, while keeping the dedicated menu-config contract test in place. |
| Lint hygiene | Removed the only warning introduced by the final closure pass itself from the new menu test; remaining `template-mui` lint warnings are pre-existing package debt outside this change-set. |
| Validation | `@universo/template-mui` focused tests passed (2 suites, 3 tests). `@universo/applications-frontend` focused Vitest run passed (2 files, 26 tests). `@universo/template-mui` build passed. Final root `pnpm build` passed with 28/28 successful tasks in 2m39.573s. |

## 2026-03-19 Application Workspaces QA Follow-Up Closure

Closed the last follow-up defects found during QA for Applications workspaces, public access, and limits.

| Area | Resolution |
| --- | --- |
| Edit payload contract | The applications edit dialog still shows immutable `Public` / `Add workspaces` parameters, but update submissions now omit them entirely so normal name/description edits no longer fail against the immutable backend contract. |
| Workspace archival lifecycle | Leaving an application or removing a member now soft-deletes all workspace-scoped runtime catalog and TABLE rows for the archived personal workspace before soft-deleting the workspace relation rows and the workspace record itself. |
| Settings UX gating | `ApplicationSettings` now hides the `Limits` tab until runtime schema + workspace mode are actually available and shows explicit informational alerts when schema/workspace prerequisites are missing. |
| Regression coverage | Added backend regression coverage for runtime business-row archival and frontend regression coverage for the corrected edit payload contract plus settings gating when schema/workspace support is unavailable. |
| Validation | `@universo/applications-backend` lint passed; backend full suite passed (10/10 suites, 100/100 tests); backend build passed. `@universo/applications-frontend` lint passed; frontend full suite passed (24/24 files, 114/114 tests); frontend build passed. Final root `pnpm build` passed with 28/28 successful tasks in 2m56.552s. |

## 2026-03-19 Application Workspaces QA Remediation Closure

Closed the post-QA remediation pass for Applications workspaces, public membership, and limits.

| Area | Resolution |
| --- | --- |
| Applications RLS | Replaced coarse `FOR ALL` policies with operation-specific `SELECT` / `INSERT` / `UPDATE` policies for applications, memberships, connectors, and connector-publication links so request-scoped RLS aligns with create/join/member/admin flows. |
| Copy ownership | Application copy access duplication now demotes copied `owner` memberships to `admin`, preserving a single owner in the new application. |
| Limits atomicity | `PUT /applications/:id/settings/limits` now rejects duplicate payload rows, validates active catalog targets, and runs the full update inside one transaction. |
| Runtime integrity | Workspace-scoped runtime tables now add FK constraints to `_app_workspaces`, tighten workspace RLS visibility to active workspace rows, and add explicit SQL-side workspace filtering in runtime row conditions. |
| Regression coverage | Added focused backend coverage for copy-owner semantics, migration policy contracts, runtime workspace DDL guards, join/leave/settings limits routes, plus a frontend `ApplicationSettings` limits save flow. |
| Validation | `@universo/applications-backend` lint passed; backend targeted suites passed (44/44). `@universo/applications-frontend` Vitest run passed (24 files, 113 tests) and coverage stayed green for the new settings surface. `@universo/applications-backend` and `@universo/applications-frontend` builds passed. |

## 2026-03-19 QA Comprehensive Fix — All Issues Resolved

Applied all 13 code fixes from the comprehensive QA audit across admin-backend, admin-frontend, metapanel-frontend, and universo-template-mui packages.

| Area | Severity | Resolution |
| --- | --- | --- |
| LIKE wildcard injection | **CRITICAL** | Added `escapeLikeWildcards()` to search queries in `globalAccessService.ts` and `instancesStore.ts`. |
| UUID validation | **CRITICAL** | Added `uuid.isValidUuid()` to 3 globalUsersRoutes params (PUT/PATCH/DELETE) and 1 rolesRoutes copy param. |
| MetapanelDashboard test mock | **CRITICAL** | Used `importOriginal` pattern to import real `buildRealisticTrendData`. |
| Dashboard API access | **CRITICAL** | Reviewed: by-design — uses `ensureGlobalAccess('users', 'read')` middleware. |
| Transaction wrapping | **HIGH** | Create and update role routes now wrapped in `exec.transaction()`. |
| Debug console.logs | **HIGH** | Removed all 10 `console.log` from `ensureGlobalAccess.ts`. |
| StatCard gradient ID | **HIGH** | Replaced value-based SVG ID with `React.useId()`. |
| createAuthClient | **HIGH** | Replaced `axios.create()` with shared `createAuthClient()` in metapanel-frontend. |
| RoleEdit setState | **HIGH** | Moved render-time setState to `useEffect`. |
| UserFormDialog render stability | **HIGH** | Extracted stable `EMPTY_ROLE_IDS` module-level constant. |
| RoleActions index fragility | **HIGH** | Replaced `baseActions[1]` with `.find((a) => a.id === 'delete')`. |
| Copy codename overflow | **HIGH** | Added 50-char truncation for auto-generated copy codenames. |
| Locale hardcoding | **HIGH** | Copy/edit actions now use `i18n.language` instead of hardcoded `'en'`. |
| Test fixes | — | Updated 4 tests: replaced non-UUID IDs with valid UUIDs, added transaction mock implementations. |
| Validation | — | Lint 0 errors, admin-backend 34/34 tests, admin-frontend 13/13 tests, metapanel-frontend 1/1 test, full build 28/28. |

## 2026-03-19 PR #729 Bot Review Fixes

Applied fixes for valid bot review comments on PR #729 (Copilot and Gemini Code Assist).

| Area | Resolution |
| --- | --- |
| StatCard NaN/Infinity | `buildRealisticTrendData()` now guards `points <= 0` → `[]` and `points === 1` → single-value array, preventing `i / (points - 1)` = `0/0` = NaN. |
| OnboardingWizard CTA | "Start Acting" button now `disabled={completionLoading \|\| !onComplete}` — prevents no-op CTA when `onComplete` prop is undefined. |
| Codename regex unification | Unified ALL codename validation schemas to `/^[a-z][a-z0-9_-]*$/` (must start with letter, allows dashes for slugify compat): `CreateRoleSchema`, `UpdateRoleSchema`, `CopyRoleSchema`, and frontend `RoleFormDialog`. |
| Gemini suggestion (rejected) | Gemini proposed `/^[a-z][a-z0-9_]*$/` (no dashes) but this would break `slugifyCodename()` which generates kebab-case like `content-editor`. |
| Validation | All lint 0 errors, RoleFormDialog 6/6 tests pass, full root build 28/28 tasks in 3m4s. |

## 2026-03-19 QA Closure — Post-Implementation Fixes

Closed two residual defects found during the comprehensive QA audit.

| Area | Resolution |
| --- | --- |
| Dead code `includeSystem` | Removed unreachable `.default(true)` from `admin-backend/rolesRoutes.ts` `includeSystem` schema — `z.preprocess()` already converts `undefined` to `true`, making the Zod default dead code. |
| `resetUserSettingsCache` subscriber notify | Added `notifySubscribers({})` to `resetUserSettingsCache()` in `useUserSettings.ts` — active hook instances now receive immediate notification on cache reset instead of holding stale state until remount. |
| Validation | admin-backend lint 0 errors, 6/6 suites (34 tests); template-mui build OK; full root build 28/28 tasks in 2m56s. |

## 2026-03-18 Superuser Metahub Visibility Fix (showAll query param)

Fixed a critical bug where superusers always saw all metahubs regardless of the "Show other users' items" setting being disabled.

| Area | Resolution |
| --- | --- |
| Root cause | `z.coerce.boolean()` in Zod query param schemas uses `Boolean(value)` — `Boolean("false")===true` because any non-empty string is truthy. The `showAll=false` query parameter from frontend was always parsed as `true`. |
| Fix scope | Replaced `z.coerce.boolean()` with `z.preprocess((val) => val === 'true' || val === true, z.boolean())` in: `metahubs-backend/queryParams.ts`, `applications-backend/queryParams.ts`, `admin-backend/rolesRoutes.ts`, `admin-backend/schemas/index.ts`. |
| Regression test | Added test: superuser sending `showAll=false` must result in `showAll: false` being passed to the store layer. |
| Validation | metahubs-backend 38/38 test suites (254 tests), full root build 28/28 tasks in 3m11s. |

## 2026-03-18 Admin Padding + Metahub Cache/Creation Fixes

Fixed three categories of issues: admin layout consistency, auth-state cache isolation, and metahub creation resilience.

| Area | Resolution |
| --- | --- |
| RoleEdit padding | Removed extra `px: { xs: 1, md: 2 }` from the header section Stack so title, back-button, alert, and content sections all share consistent MainLayout-level padding. |
| Auth cache isolation | Added a `useEffect` in App.tsx that tracks user identity via `useRef` and calls `queryClient.clear()` + `resetUserSettingsCache()` when the user changes (logout, login, or user switch). This prevents stale metahub lists, settings, and other data from persisting across auth transitions. |
| Metahub creation cleanup | Replaced soft-delete with hard `DELETE FROM metahubs.cat_metahubs` (with CASCADE) when initial-branch creation fails, preventing zombie metahub rows without branches, schemas, or cleanup markers. |
| Validation | admin-frontend lint 0 errors, 13/13 tests; metahubs-backend lint 0 errors (205 pre-existing warnings), 35/35 tests; start-frontend 20/20 tests; root `pnpm build` 28/28 tasks in 3m13.772s. |

## 2026-03-18 QA Residual Contract Closure

Closed the final residual QA defects left in the admin role/user management seam after the earlier corrective waves. The remaining issues were contract-level rather than feature-level: superuser detection still depended on unordered role rows, admin frontend actions still used superuser-only shortcuts in several surfaces, and role codename validation remained weaker in the client than in the backend.

| Area | Resolution |
| --- | --- |
| Primary-role contract | `admin.get_user_global_roles(...)` now orders superuser rows first, `globalAccessService` sorts aggregated roles deterministically, and `/admin/global-users/me` returns an explicit `isSuperuser` boolean while preferring the superuser role as the primary role when present. |
| Admin frontend RBAC gating | `useGlobalRole.ts` now exposes a shared `useAdminPermission(...)` hook backed by the store CASL ability context, and roles/users create-edit-delete affordances were migrated from superuser-only gating to explicit `Role` and `User` permission checks. |
| Codename validation parity | `RoleFormDialog` now rejects codenames shorter than the backend 2..50 contract before submit, eliminating avoidable create/copy validation mismatches. |
| Regression coverage | Added focused frontend/backend regressions for short role codenames, deterministic superuser-first role ordering, and `/admin/global-users/me` primary-role selection plus explicit `isSuperuser` output. |
| Validation | `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 13/13 tests, `pnpm --filter @universo/admin-frontend build` passed, `pnpm --filter @universo/admin-backend lint` passed with warning-only pre-existing debt and 0 errors, `pnpm --filter @universo/admin-backend test` passed with 6/6 suites and 34/34 tests, `pnpm --filter @universo/admin-backend build` passed, `pnpm install --lockfile-only` completed, and the final root `pnpm build` passed with 28/28 successful tasks in 3m27.908s. |

## 2026-03-18 Admin UX & Metahub Access Corrections

Closed a fresh post-rebuild QA reopen that exposed residual admin role/user UX gaps and an over-broad metahub visibility rule.

| Area | Resolution |
| --- | --- |
| Role detail and create flow | `RoleEdit` now restores a clearer header inset, the role-create dialog uses explicit localized create-title/submit keys, and `RoleFormDialog` auto-fills codename from the localized name while keeping edit/copy defaults stable. |
| Admin users surface | `UserFormDialog` now opens with the requested `Create User` / `Создать пользователя` title and tighter top spacing, while `InstanceUsers` cards collapse large role lists to one visible role plus a numeric remainder chip. |
| Shared admin permission model | Removed the `publications` subject from the shared admin permission union/iteration lists plus backend role-schema validation, and renamed the Russian `instances` permissions label to `Экземпляры`. |
| Metahub visibility hardening | `metahubsRoutes` now treats `showAll` as a superuser-only expansion, and `ensureMetahubAccess(...)` no longer grants synthetic owner access from generic `metahubs:read` permissions. Non-superusers remain membership-scoped even if a reused browser profile still has `showAllItems` enabled. |
| Validation | `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 12/12 tests, `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubsRoutes.test.ts` passed with 35/35 active tests, and the final root `pnpm build` passed with 28/28 successful tasks in 3m28.542s. |

## 2026-03-18 UX Corrections Wave 4

Closed 6 more UX issues after the previous QA/fix passes. This wave was focused on polish and consistency rather than new feature behavior: completion-screen button layout outside the wizard shell, admin role-detail spacing, standard page gutters for Locales, shared `Create` wording on admin list pages, and a full replacement of the user-role assignment tab with the same catalog-style selection pattern already used elsewhere.

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Completion screen button order regressed when revisiting onboarding | `CompletionStep` used its own internal action ordering when rendered outside the wizard navigation shell | Reordered the buttons to keep `Start over` on the left and the primary action on the right, with `justifyContent: 'space-between'` for stable layout parity |
| Role detail informational blocks had extra horizontal padding | `RoleEdit` wrapped the header, back action, alert, and content in additional `Box` padders beyond the page layout | Removed the extra wrappers so the detail page aligns flush with the surrounding admin layout |
| Locales page header gutter and CTA wording were inconsistent | The page header did not match the table gutter, and the action text still used the longer add-language wording | Restored header side padding and changed the create action to `Create` / `Создать` |
| Users page create action wording was inconsistent | The create button and dialog fallbacks still used the longer `Create user` label | Updated both i18n entries and `InstanceUsers` fallback strings to the shared short `Create` wording |
| User create/edit dialog felt too wide and bottom actions were cramped | `UserFormDialog` still used the older wider dialog and default action spacing | Switched it to the compact role-dialog sizing/padding contract: `maxWidth='sm'`, restored top content padding, and `DialogActions sx={{ p: 3, pt: 2 }}` |
| Roles tab used the wrong interaction pattern | The old autocomplete + chip summary did not match the catalog/hub selection UI used elsewhere | Replaced the legacy UI with `EntitySelectionPanel`, localized all panel labels, and hardened the usage so monorepo declaration builds stay stable |

Validation:

- `pnpm --filter @universo/admin-frontend lint` passed.
- `pnpm --filter @universo/template-mui build` passed.
- `pnpm --filter @universo/admin-frontend test -- --run` passed with 3/3 files and 7/7 tests.
- `pnpm --filter @universo/start-frontend test -- --run` passed with 4/4 files and 18/18 tests.
- Final root `pnpm build` passed with 28/28 successful tasks in 3m3.03s.

## 2026-03-18 UX Corrections Wave 4 — QA Follow-Through Closure

Closed the two residual QA concerns left after Wave 4: the `UserFormDialog` selection-panel integration still depended on a fragile declaration-time workaround, and there was still no direct regression proof for the rewritten dialog or the extracted completion-step action contract.

| Area | Resolution |
| --- | --- |
| User dialog typing seam | `UserFormDialog` now derives its selection-label typing from `ComponentProps<typeof EntitySelectionPanel>['labels']` instead of importing a root type that is not actually available to declaration consumers. This keeps the dialog aligned with the public component surface while still satisfying the current explicit optional-prop requirements of the `@universo/template-mui` declaration contract. |
| User dialog regression proof | Added focused `@universo/admin-frontend` coverage for the pure `validateUserFormDialog(...)` contract. The new tests pin missing-role behavior (`roles` tab redirect), short-password handling (`main` tab redirect), trimmed create-mode payloads, and edit-mode initial-email preservation. |
| Completion action regression proof | Added direct `CompletionStep` tests covering canonical left/right button order, callback dispatch, primary-only rendering, loading disablement, and inline error visibility. |
| Validation | `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 11/11 tests, `pnpm --filter @universo/start-frontend test` passed with 5/5 files and 20/20 tests, and the final root `pnpm build` passed successfully. |

Validation:

- `pnpm --filter @universo/admin-frontend lint` passed.
- `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 11/11 tests.
- `pnpm --filter @universo/start-frontend test` passed with 5/5 files and 20/20 tests.
- Final root `pnpm build` passed.

## 2026-03-18 UX Corrections Wave 3

Fixed 8 UX issues reported during QA after Wave 2:

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Onboarding last page button layout | CompletionStep had its own "Начать действовать" + wizard nav had "Назад" and "Начать сначала" | Removed `onPrimaryAction` from CompletionStep in wizard; rewrote nav: last step shows "Начать сначала" (left, outlined) + "Начать действовать" (right, contained) with no "Назад" |
| "Начать действовать" stays on `/start` | `shouldResolveAfterCompletion` effect gave up when `hasWorkspaceAccess` was false | Replaced entire effect with direct `navigate('/', { replace: true })` after completion; HomeRouteResolver handles routing |
| Metapanel verbose text + padding | Subtitle, "Текущий срез платформы", verbose descriptions, extra side padding | Removed subtitle from ViewHeader, removed px padding from cards Box, changed interval labels to "Total"/"Всего", simplified descriptions in en/ru i18n |
| Superusers count shows 2 instead of 1 | `globalAccessUsers` SQL counted all users with ANY role, not just superusers | Changed SQL to JOIN `rel_user_roles` with `cat_roles` and filter `r.is_superuser = true` |
| Role dialog content clipped at top | MUI `DialogContent` auto-sets `paddingTop: 0` after `DialogTitle` | Added `pt: '16px !important'` to DialogContent sx |
| Role detail: border, untranslated permissions, disabled look | MainCard added unwanted border; i18n missing for metahubs/applications/profile/onboarding; system role checkboxes looked active | Replaced MainCard with Box; added 4 missing i18n keys in en+ru admin.json; PermissionMatrix uses `variant='elevation'` + `opacity: 0.6` + `cursor: not-allowed` when disabled |
| Role edit dialog doesn't close after save | BaseEntityMenu rendered dialogs but never closed after successful onSubmit | Wrapped dialog's onSubmit to call `setDialogState(null)` after await resolves |
| Locales page: non-standard layout | MainCard wrapper with IconButton add, no search, border | Rewrote LocalesList: Stack + ViewHeader with search + ToolbarControls with primary action button + flat FlowListTable; removed MainCard |

Validation: Full build (28/28 packages) passed in 2m34s.

## 2026-03-18 UX Corrections Wave 3 — QA Fixes

QA analysis found 6 issues (2 failing tests, 2 prettier violations, 1 stale closure, 1 unhandled error). All fixed:

| Issue | Root Cause | Fix |
| --- | --- | --- |
| AuthenticatedStartPage test failure | Test expected `navigate` NOT called for registered-only users, but Wave 3 changed to always navigate('/') | Updated test to expect `navigate('/', { replace: true })` — HomeRouteResolver handles routing decisions |
| OnboardingWizard prettier error | CompletionStep JSX multiline in short format | Collapsed to single-line JSX |
| RoleEdit + 4 more files prettier errors | Multiline imports/props exceeding prettier printWidth contract | Ran `prettier --write` on RoleEdit, RoleFormDialog, AdminBoard, LocalesList, RoleActions (20+ errors total) |
| RoleFormDialog copy test failure | Test expected empty `initialCodename` but Wave 2 added auto-generated `{codename}_copy` | Changed expected value to `'editor_copy'` |
| RoleFormDialog validate stale closure | `useCallback` deps missing `isSuperuser, showIsSuperuser` used in body | Added both to dependency array |
| BaseEntityMenu onSubmit unhandled rejection | Async wrapper had no try-catch; rejection if onSubmit throws | Wrapped in try-catch: success → close dialog; error → dialog stays open (original handler manages error state) |
| LocalesList react-hooks/exhaustive-deps warning | `data?.items \|\| []` created new array reference every render | Wrapped in `useMemo(() => data?.items \|\| [], [data])` |

Validation: start-frontend 18/18 tests, admin-frontend 7/7 tests, all lint clean (0 errors), full build 28/28 (2m23s).

## 2026-03-18 UX Corrections Wave 2

Fixed 5 UX issues reported during QA after Wave 1:

| Issue | Root Cause | Fix |
| --- | --- | --- |
| `/start` inaccessible after onboarding | `StartAccessGuard` redirected users with `hasWorkspaceAccess` away from `/start` | Removed all redirect logic; guard now only requires authentication |
| Role dialog English text + padding | `t('common.cancel', 'Cancel')` hardcoded English fallback; DialogActions had no padding; DialogContent `mt:1` clipped star icon | Replaced with `tc('actions.cancel')`; added `sx={{ p: 3, pt: 2 }}` to DialogActions; increased `mt:2` |
| Role dialog: two color pickers | ColorPicker had both a left startAdornment (popover with presets) and right endAdornment (native `<input type='color'>`) | Removed startAdornment, Popover, and preset colors array; kept only native color picker |
| Copy role dialog: no suffix/codename/tabs | Copy used source name without "(копия)", empty codename, copyPermissions as inline checkbox | Added `appendCopySuffix()` for VLC names, auto-generates `{codename}_copy`, moved copy options to "Параметры" tab using Tabs component |
| InstanceBoard demo charts | SessionsChart + PageViewsBarChart showed hardcoded demo data (13,277 sessions / 1.3M views) | Removed both chart Grid items and unused imports |
| Role codename editability | Verified — codename is already editable for non-system roles (disabled only for system roles); backend uses UUID in `rel_user_roles.role_id` | No change needed; behavior confirmed correct |

Validation: Full build (28/28 packages) passed in 2m44s.

## 2026-03-18 UX Corrections Wave

Fixed 5 UX issues reported after fresh build + DB reset:

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Regular users see Metahubs menu | User role seed had `metahubs:read` permission → CASL mapped to Metahub capability | Removed `('metahubs', 'read', ...)` from user role permission seed in migrations; fixed menu divider to only show when metahubs/admin sections visible |
| Applications settings via non-superuser | `hasAnyGlobalRole` was true for users with 'user' system role | Changed settings button condition to `isSuperuser` only |
| Metapanel shows 3 users not 5 | SQL counted `COUNT(DISTINCT user_id) FROM admin.rel_user_roles` (only role-assigned users) | Changed to `COUNT(*) FROM auth.users` |
| Dashboard graphs show fake data | Each dashboard had different fake patterns (wavy, flat, hardcoded demo arrays) | Created shared `buildRealisticTrendData()` in StatCard; applied to all 5 dashboards |
| Admin roles RoleEdit UI is cluttered | Inline settings form, Access Settings section, isSuperuser toggle, admin info Alert | Rewritten: Settings tab now opens RoleFormDialog dialog (catalog pattern); permissions tab has PermissionMatrix + Save button; added isSuperuser toggle support to RoleFormDialog |

Validation: Full build (28/28 packages) passed in 2m55.7s.

## 2026-03-18 QA Follow-Through Closure

Closed the residual QA implementation items left after the larger admin roles / metapanel wave. The remaining issues were narrow but real: the shared template package exposed a broken `navigation` subpath contract to consumers, direct frontend coverage was still missing for the admin user-management create/edit/clear-roles seams, and backend README examples had drifted away from the current route factory signatures.

| Area | Resolution |
| --- | --- |
| Template package export contract | `@universo/template-mui` now emits a dedicated `navigation/index` build entry and exports `./navigation` to dist-backed ESM/CJS artifacts instead of mixing raw TS source with the root bundle. |
| Admin user-management regressions | Added focused `@universo/admin-frontend` tests for `InstanceUsers` and `UserActions`, covering create-user payload wiring, list invalidation, success feedback, and `userId`-based edit/clear-roles actions. |
| Backend README drift | `packages/admin-backend/base/README.md`, `packages/admin-backend/base/README-RU.md`, `packages/auth-backend/base/README.md`, and `packages/auth-backend/base/README-RU.md` now reflect the current route factory contracts and supported bootstrap options. |
| Validation | `pnpm --filter @universo/template-mui build` passed, the focused `@universo/admin-frontend` Vitest run passed with 3/3 files and 7/7 tests, `pnpm --filter @universo/admin-frontend lint` passed cleanly, and the final root `pnpm build` passed with 28/28 successful tasks in 3m2.94s. |

Validation:

- `pnpm --filter @universo/template-mui build` passed.
- `pnpm --filter @universo/admin-frontend test -- --runInBand src/pages/InstanceUsers.test.tsx src/pages/UserActions.test.tsx` passed with 3/3 files and 7/7 tests.
- `pnpm --filter @universo/admin-frontend lint` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 3m2.94s.

## 2026-03-18 Post-QA Corrective Reopen Closure

## 2026-03-18 QA Residual Debt Closure

Closed the last engineering-quality debt that remained after the admin roles / metapanel QA follow-through. The product behavior was already correct, but the wave still left one real package-contract seam, one touched frontend lint surface, and one inconsistent admin dialog loading pattern that kept showing up in validation.

| Area | Resolution |
| --- | --- |
| Store package contract | `@universo/store` now declares `@universo/types` explicitly in `dependencies`, so the shared `ABILITY_MODULE_TO_SUBJECT` runtime import no longer relies on an undeclared workspace edge. |
| Applications frontend lint debt | The touched `@universo/applications-frontend` pages/components/tests/declaration files were narrowed back to typed `unknown`/local helper contracts, package-local test overrides stayed test-only, and the package lint surface is green again. |
| Admin dialog loading consistency | `RoleActions.tsx` and `UserActions.tsx` now use one eager dialog-loading path instead of mixing direct imports with dynamic loaders for the same dialogs. |
| Validation | `pnpm --filter @universo/store build` passed, `pnpm --filter @universo/admin-frontend build` passed, `pnpm --filter @universo/applications-frontend lint` passed cleanly, and the final root `pnpm build` passed with 28/28 successful tasks in 2m26.514s. |

Validation:

- `pnpm --filter @universo/store build` passed.
- `pnpm --filter @universo/admin-frontend build` passed.
- `pnpm --filter @universo/applications-frontend lint` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m26.514s.

## 2026-03-18 Post-QA Full Completion Reopen Closure

Closed the final reopen that remained after the comprehensive QA pass over the admin roles / metapanel wave. Functional UX and warning-cleanup work was already implemented, but the first final root build exposed one last integration defect: `@universo/metapanel-frontend` was consuming shared `@universo/template-mui` dashboard primitives without declaring that workspace dependency or externalizing it in its own `tsdown` config, so the monorepo build attempted to parse foreign SVG assets out of `template-mui` dist output and failed.

| Area | Resolution |
| --- | --- |
| Role-management UX closure | The remaining role dialog/detail copy and tab-aware action labels now follow the requested codename terminology and settings/permissions-oriented contract, with updated EN/RU strings and regression coverage. |
| Shared metapanel pattern | Metapanel now uses the shared `StatCard`, `HighlightedCard`, and `ViewHeader` primitives instead of package-local dashboard cards, preserving the requested one-row overview layout plus documentation CTA. |
| Applications warning cleanup | The touched connector/admin DOM-nesting warnings and router future-flag warning noise were removed from the focused applications frontend surfaces and tests. |
| Package/build seam | `@universo/metapanel-frontend` now explicitly declares `@universo/template-mui` and `@mui/icons-material`, and its `tsdown` config externalizes those imports so the package no longer traverses `template-mui` dist assets during workspace builds. |
| Validation | `pnpm --filter @universo/metapanel-frontend build` passed after the package-contract fix, `pnpm install --lockfile-only` resynced `pnpm-lock.yaml`, and the final root `pnpm build` passed with 28/28 successful tasks in 2m36.104s. |

Validation:

- `pnpm --filter @universo/metapanel-frontend build` passed.
- `pnpm install --lockfile-only` completed from the repository root and refreshed `pnpm-lock.yaml`.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m36.104s.

Closed the last open items left by the comprehensive QA pass on the admin roles / metapanel wave. The reopen was intentionally narrow and focused on one real policy defect plus two touched regression-surface issues: `registered`-only users could still satisfy workspace access through `profile:read`, `start-frontend` was validating onboarding completion routing through an over-broad import seam and stale `useAbility()` mock shape, and `applications-frontend` was validating permission gating with an incomplete `useHasGlobalAccess()` mock contract.

| Area | Resolution |
| --- | --- |
| Registered-only workspace policy | Shared shell access now fails closed for `registered`-only role sets even if the role still carries `profile:read`. `resolveShellAccess(...)` now short-circuits those users back to the registered-only visibility contract, and backend `hasWorkspaceAccess(...)` mirrors that policy before permission-based capability checks. |
| Start frontend regression surface | `AuthenticatedStartPage` now imports `resolveShellAccess` from the narrower `@universo/template-mui/navigation` surface, and the focused onboarding-routing tests now mock the full runtime `useAbility()` contract (`refreshAbility`, `globalRoles`, `ability`, `isSuperuser`) instead of a drifted partial shape. |
| Applications frontend regression surface | `ApplicationList` tests now mock the real `useHasGlobalAccess()` contract expected by shared settings UI, including `hasAnyGlobalRole` plus `adminConfig`, so permission-gating regressions are exercised instead of hidden by incomplete test doubles. |
| Validation | Focused `@universo/template-mui` regression tests passed 3/3, focused `@universo/admin-backend` service tests passed 7/7, focused `@universo/start-frontend` package tests passed 18/18 across 4 files, focused `@universo/applications-frontend` package tests passed 111/111 across 23 files, and the final root `pnpm build` passed with 28/28 successful tasks in 2m26.925s. |

Validation:

- `pnpm --filter @universo/template-mui test -- --runInBand src/navigation/__tests__/roleAccess.test.ts` passed with 3/3 tests.
- `pnpm --filter @universo/admin-backend test -- --runInBand src/tests/services/globalAccessService.test.ts` passed with 7/7 tests.
- `pnpm --filter @universo/start-frontend test -- --runInBand src/__tests__/views/AuthenticatedStartPage.test.tsx` completed with 4 test files passed and 18/18 tests green.
- `pnpm --filter @universo/applications-frontend test -- --runInBand src/pages/__tests__/ApplicationList.test.tsx` completed with 23 test files passed and 111/111 tests green.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m26.925s.

## 2026-03-18 Admin Roles + Metapanel Corrective Completion Closure

Closed the last correctness gaps left after the admin roles and metapanel UX wave. The earlier implementation already delivered the requested shell, onboarding, and roles UX, but the final QA pass still identified several contract defects: shared workspace access was still codename-driven in key paths, admin create-user rollback did not compensate the profile row, lifecycle role seeding had duplicate execution and legacy `manage` drift, application admin affordances inherited too much from admin-panel access, and shared route ownership still lived in the template shell.

| Area | Resolution |
| --- | --- |
| Workspace access contract | Shared shell routing, `/start` resolution, and backend dashboard access now derive workspace eligibility from real capabilities over `Application`, `Metahub`, and `Profile` instead of the `user` codename alone. `registered` users remain fail-closed on `/start`, while admin-only roles continue to route to `/admin`. |
| Admin create-user rollback | The admin create-user flow now compensates both persistence layers when downstream role assignment fails: it soft-deletes the `profiles.cat_profiles` row through the request-scoped DB session before deleting the provisioned Supabase auth user, and returns explicit rollback context instead of leaving hidden partial success. |
| Lifecycle role migration contract | The `user` role seed now uses the canonical `profile/*` permission, legacy `profile/manage` rows are normalized in migration SQL, the backend permission helper tolerates legacy `manage` during transition, and duplicate lifecycle seed/backfill execution was removed from the base admin schema path so one canonical migration owns it again. |
| Application affordance gating | Application create, control-panel, and guarded admin-route access now follow real ability plus per-application permission semantics instead of broad admin-panel visibility or role-name shortcuts such as `editor`. |
| Route ownership | Shared feature-route composition moved from `@universo/template-mui` into `@universo/core-frontend`, removing the leaf-feature dependency drift that pulled metapanel routes into the shell package. |
| Validation | Focused admin-backend route tests passed 5/5, the new template shell-access regression passed 3/3, touched package builds passed, touched-package lints now return warning-only pre-existing noise with 0 errors, and the final root `pnpm build` passed with 28/28 successful tasks in 2m38.654s. |

Validation:

- `pnpm --filter @universo/admin-backend test -- --runInBand src/tests/routes/dashboardAndGlobalUsersRoutes.test.ts` passed with 5/5 tests.
- `pnpm --filter @universo/template-mui test -- --runInBand src/navigation/__tests__/roleAccess.test.ts` passed with 3/3 tests.
- `pnpm --filter @universo/template-mui build` passed.
- `pnpm --filter @universo/core-frontend build` passed.
- `pnpm --filter @universo/start-frontend build` passed.
- `pnpm --filter @universo/applications-frontend build` passed.
- `pnpm --filter @universo/admin-backend lint`, `pnpm --filter @universo/template-mui lint`, and `pnpm --filter @universo/applications-frontend lint` returned 0 errors with warning-only pre-existing package noise.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m38.654s.

## 2026-03-18 Admin Roles + Metapanel UX Rework Closure

Closed the requested follow-up UX rework on top of the earlier admin roles / onboarding / metapanel delivery. The previous implementation was functionally working, but it still violated the original interaction contract in several visible places: guest/root routing, `/start` access, metapanel placement/design, role edit/detail ergonomics, and application action visibility for ordinary workspace users.

| Area | Resolution |
| --- | --- |
| Root/start routing | `/` now renders the guest landing/start surface for unauthenticated users, authenticated `registered`-only users remain on `/start`, authenticated workspace users render the metapanel directly on `/`, and admin-only users are redirected to `/admin`. Legacy `/dashboard` and `/metapanel` paths now resolve back to `/`. |
| Onboarding env switch | Both `packages/universo-core-backend/base/.env.example` and the local `.env` now expose `AUTO_ROLE_AFTER_ONBOARDING` next to the auth settings, with explicit guidance that `false` keeps users on `/start` until manual admin promotion. |
| Metapanel dashboard | Replaced the old summary-card + role-chip layout with a metahub-board-style one-row dashboard: registered users, applications, metahubs, and a documentation card. Breadcrumb resolution for the root path now shows `Метапанель`. |
| Admin roles UX | Roles list CTA now uses `Создать`; the shared role dialog now puts name/description first and codename below a divider; row-level `Редактировать` opens the dialog instead of navigating away; and the role detail page is now permissions-first with a settings tab that behaves like an inline edit surface. |
| Applications gating | Ordinary platform `user` users no longer see application creation or control-panel/admin entry actions; those affordances are now gated by admin-capable global access instead of appearing for every workspace user. |
| Validation | Metapanel regression Vitest passed (1/1), admin role dialog Vitest passed (4/4), the focused applications gating regression passed, touched frontend lints passed, and the final root `pnpm build` passed with 28/28 successful tasks in 2m32.91s. |

Validation:

- `pnpm exec vitest run --config packages/metapanel-frontend/base/vitest.config.ts packages/metapanel-frontend/base/src/views/MetapanelDashboard.test.tsx` passed with 1/1 tests.
- `pnpm exec vitest run --config packages/admin-frontend/base/vitest.config.ts packages/admin-frontend/base/src/components/RoleFormDialog.test.tsx` passed with 4/4 tests.
- `pnpm exec vitest run --config packages/applications-frontend/base/vitest.config.ts packages/applications-frontend/base/src/pages/__tests__/ApplicationList.test.tsx -t "hides create and control-panel actions for ordinary user roles"` passed (1 focused regression, 21 skipped).
- `pnpm --filter @universo/template-mui build` passed.
- `pnpm --filter @universo/metapanel-frontend lint` passed.
- `pnpm --filter @universo/admin-frontend lint` passed.
- `pnpm --filter @universo/applications-frontend lint` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m32.91s.

## 2026-03-18 Admin Roles Refactoring + Metapanel Final QA Completion Closure

Closed the last open QA-completion items for the admin roles / onboarding / metapanel wave. The earlier implementation and first corrective reopen were already integrated, but the final QA pass still found one legacy role-management seam, an incomplete role-copy UX/API contract, missing direct frontend regressions, and a small amount of touched runtime debt.

| Area | Resolution |
| --- | --- |
| Legacy compatibility seam | Legacy single-role `POST/PATCH/DELETE /global-users` flows were hardened so they now operate safely on top of the user-level multi-role model instead of bypassing it; legacy patch/delete now use user-level role replacement/revoke semantics, and legacy superuser grants now clear other roles transactionally instead of creating invalid mixed-role state. |
| Role copy contract | `RoleFormDialog` now exposes `copyPermissions`, copy dialogs start with a blank codename by default, `RolesList` forwards the explicit toggle instead of hardcoding `true`, and backend/frontend codename validation now uses the same lowercase-alphanumeric-plus-underscore-or-dash rule. |
| Conflict handling + cleanup | Admin role create/copy routes now return clean 409 responses on database uniqueness races after the optimistic pre-check, and the lingering `useHasGlobalAccess` debug logging was removed. |
| Regression proof | Added direct admin-backend route/service regressions for the legacy seam and codename conflict races, added admin-frontend Vitest coverage for the copy dialog contract, and added metapanel frontend Vitest coverage for the shared dashboard rendering contract. |
| Validation | Targeted admin-backend tests passed 19/19, admin-frontend Vitest passed 3/3, metapanel Vitest passed 1/1, `@universo/admin-frontend lint` passed, `@universo/metapanel-frontend lint` passed, and the final root `pnpm build` passed with 28/28 successful tasks in 2m38.24s. |

Validation:

- `pnpm --filter admin-backend test -- --runInBand packages/admin-backend/base/src/tests/routes/requestScopedExecutorRoutes.test.ts packages/admin-backend/base/src/tests/routes/dashboardAndGlobalUsersRoutes.test.ts packages/admin-backend/base/src/tests/services/globalAccessService.test.ts` passed with 19/19 tests.
- `pnpm exec vitest run --config packages/admin-frontend/base/vitest.config.ts` passed with 3/3 tests.
- `pnpm exec vitest run --config packages/metapanel-frontend/base/vitest.config.ts` passed with 1/1 tests.
- `pnpm --filter admin-frontend lint` passed.
- `pnpm --filter metapanel-frontend lint` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m38.24s.

## 2026-03-17 Admin Roles Refactoring + Metapanel QA Corrective Closure

Closed the post-implementation QA reopen for the admin roles / onboarding / metapanel wave. The original implementation was already integrated, but the QA pass found several contract-level issues: shared dashboard stats were still guarded by an admin-only permission, auth/admin lifecycle writes could leave partial success after later role-assignment failures, admin-only roles were being routed into the workspace shell, and a small amount of touched test/lint/UI debt remained open.

| Area | Resolution |
| --- | --- |
| Shared dashboard contract | `admin/dashboard/stats` now allows real workspace users (`user`) plus admin-capable roles while still denying `registered`-only access, so AdminBoard and metapanel share one route without forcing `users:read` onto ordinary users. |
| Lifecycle compensation | Admin-created users now roll back the just-created Supabase auth account when role assignment fails, registration now returns explicit rollback status after post-signup provisioning failures and compensates the profile/auth state when possible, and onboarding completion now reverts `onboarding_completed` when auto-promotion to `user` fails. |
| Shell-access semantics | `resolveShellAccess(...)` now treats workspace-shell access as `user`/`superuser` only; admin-only roles route to `/admin`, while `registered` users remain constrained to `/start`. |
| Touched UI + regression debt | `UserFormDialog` no longer fails edit-mode validation for blank/null email state, create/edit dialog loading is unified, the stale `globalAccessService` test was updated to the current profile hydration SQL, and new route regressions cover shared dashboard access plus auth/admin/onboarding rollback paths. |
| Validation | `@universo/admin-backend` tests passed, `@universo/start-backend` tests passed, `@universo/auth-backend` tests passed, `@universo/admin-frontend lint` passed cleanly, `@universo/template-mui build` passed, and the final root `pnpm build` passed with 28/28 successful tasks in 3m9.663s. |

Validation:

- `pnpm --filter @universo/admin-backend test` passed.
- `pnpm --filter @universo/start-backend test` passed.
- `pnpm --filter @universo/auth-backend test` passed.
- `pnpm --filter @universo/admin-frontend lint` passed.
- `pnpm --filter @universo/template-mui build` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 3m9.663s.

## 2026-03-17 Admin Roles Refactoring + Metapanel Closure

Closed the full admin roles / onboarding / shell-routing / metapanel implementation wave without leaving the last integration debt behind. The code work itself was already complete across backend and frontend phases, but the final workspace validation exposed one real package-integration defect in the new metapanel package surface.

| Area | Resolution |
| --- | --- |
| Admin/frontend workflow | Admin role CRUD/copy flows, role detail tabs, multi-role user management, roleless-user handling, direct admin-side user creation, and dedicated dashboard stats are now aligned end-to-end with the new backend contracts. |
| Onboarding + routing | `OnboardingWizard` now defers final completion until the CTA, `AuthenticatedStartPage` refreshes auth/ability state after completion, registered-only users stay on `/start`, and the shared shell now uses explicit `/start`, a root home resolver, and dedicated guards for registered-only vs promoted users. |
| Metapanel package | Added `@universo/metapanel-frontend` with dedicated stats API wiring, dashboard view, and i18n namespace, then closed the final integration seam by adding an explicit `tsdown` entry for `./i18n` so workspace consumers can resolve the exported subpath during production builds. |
| Package graph hardening | `@universo/template-mui` now declares the one-way workspace dependency on `@universo/metapanel-frontend`, while metapanel no longer depends back on the shell package; the dashboard now uses local MUI cards instead of shell exports, eliminating the package cycle. |
| Validation | `@universo/start-frontend` tests passed 18/18, `@universo/start-frontend` lint/build passed, `@universo/admin-frontend` build passed with lint returning warning-only pre-existing noise, `@universo/template-mui` build passed, `@universo/metapanel-frontend` lint/build passed, `@universo/core-frontend build` passed after the package-graph fix, and the final root `pnpm build` passed with 28/28 successful tasks in 2m49.995s. |

Validation:

- `pnpm --filter @universo/start-frontend test` passed with 18/18 tests.
- `pnpm --filter @universo/start-frontend lint` and `pnpm --filter @universo/start-frontend build` passed.
- `pnpm --filter @universo/admin-frontend lint` returned warning-only pre-existing package noise after touched-file cleanup; `pnpm --filter @universo/admin-frontend build` passed.
- `pnpm --filter @universo/template-mui build` passed.
- `pnpm --filter @universo/metapanel-frontend lint` and `pnpm --filter @universo/metapanel-frontend build` passed.
- `pnpm --filter @universo/core-frontend build` passed.
- Final root `pnpm build` passed with 28/28 successful tasks in 2m49.995s.

## 2026-03-17 QA Transactional Consistency Remediation Closure

Closed the last real transactional consistency gaps left by the QA pass over configurable system attributes. The remaining defects were architectural rather than cosmetic: attribute mutation routes still committed writes before schema sync finished, and plain catalog create routes could persist a catalog even if managed system-attribute seeding failed afterward.

| Area | Resolution |
| --- | --- |
| Shared transaction contract | `updateWithVersionCheck(...)` and `MetahubAttributesService` mutation helpers now accept an existing `DbExecutor | SqlQueryable` runner so route-level transactions can keep all writes on one executor without nested transaction assumptions. |
| Attribute mutation atomicity | Attribute create/copy/update/delete/display-toggle/required-toggle and child-attribute create now call `syncMetahubSchema(...)` inside the same transaction runner that performs the write, so schema-sync failure aborts the whole mutation instead of acknowledging a partial commit. |
| Catalog create atomicity | Metahub-level and hub-scoped catalog create routes now execute `createCatalog(...)` and `ensureCatalogSystemAttributes(...)` inside one transaction runner, eliminating partial catalog creation when managed seeding fails. |
| Regression proof and validation | Route regressions now assert runner propagation into schema sync and managed seeding, targeted `attributesRoutes` + `catalogsRoutes` Jest suites passed 43/43, `pnpm --filter @universo/metahubs-backend lint` returned 0 errors with warning-only pre-existing package noise, and the final root `pnpm build` completed successfully. |

Validation:

- `pnpm --filter @universo/metahubs-backend lint` returned 0 errors and warning-only pre-existing package noise.
- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/routes/attributesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts` passed with 43/43 tests.
- Final root `pnpm build` completed successfully.

## 2026-03-17 Configurable Platform Runtime Column Closure

Closed the last runtime gap in the platform system-attributes wave. The metahub/publication side had already preserved disabled `upl.*` state correctly, but runtime application business-table generation and dynamic CRUD/sync SQL still treated configurable `_upl_archived*` / `_upl_deleted*` families as unconditional.

| Area | Resolution |
| --- | --- |
| Shared contract | `@universo/utils` now exposes `derivePlatformSystemFieldsContract(...)` and `resolvePlatformSystemFieldsContractFromConfig(...)` so schema-ddl and applications-backend consume one platform delete/archive contract. |
| Runtime DDL | `@universo/schema-ddl` business tables and tabular tables now keep mandatory platform audit columns but omit configurable `_upl_archived*` / `_upl_deleted*` columns when catalog `systemFields.fields` disables them. |
| Runtime SQL | `@universo/applications-backend` active-row predicates, soft-delete updates, and sync-side dynamic filters now stop referencing `_upl_deleted*` when the platform delete family is disabled for a catalog. |
| Regression proof | Added direct tests for the shared utils contract, schema-ddl column suppression, and applications-backend runtime delete behavior when `upl.deleted*` is disabled. |
| Validation | `@universo/utils` lint is warning-only with 0 errors after fixing touched Prettier issues, `@universo/schema-ddl` lint is warning-only with 0 errors, `@universo/applications-backend` lint passed cleanly, targeted tests passed (`243/243`, `40/40`, `29/29`), and the final root `pnpm build` passed with 27/27 successful tasks in 3m24.562s. |

Validation:

- `pnpm --filter @universo/utils lint` passed with 0 errors and warning-only pre-existing package noise.
- `pnpm --filter @universo/schema-ddl lint` passed with 0 errors and warning-only pre-existing package noise.
- `pnpm --filter @universo/applications-backend lint` passed.
- `pnpm --filter @universo/utils test -- src/database/__tests__/catalogSystemFields.test.ts` passed with 243/243 package tests.
- `pnpm --filter @universo/schema-ddl test -- src/__tests__/SchemaGenerator.test.ts` passed with 40/40 tests.
- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/applicationsRoutes.test.ts` passed with 29/29 tests.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m24.562s.

## 2026-03-17 QA Follow-Up Closure for Shared Publication Snapshot Hash Contract

Closed the last two residual QA items from the lifecycle/system-attributes wave without reopening runtime behavior. The producer and consumer sides of publication snapshot hashing no longer maintain separate normalization logic, and the touched warning-only lint debt in the continuity/error-handling seams is removed instead of being deferred.

| Area | Resolution |
| --- | --- |
| Shared snapshot-hash contract | Added `packages/universo-utils/base/src/serialization/publicationSnapshotHash.ts` as the canonical normalization helper and exported it through `@universo/utils`, so both `@universo/applications-backend` and `@universo/metahubs-backend` now hash the same normalized payload structure. |
| Backend consumer cleanup | `applicationReleaseBundle.ts` now delegates publication snapshot normalization to the shared helper, and `SnapshotSerializer.ts` uses the same helper while preserving the metahub-side fallback version-envelope behavior. |
| Touched lint/type cleanup | Removed the touched warning-level debt in `ElementList.tsx`, `AttributeList.systemTab.test.tsx`, and `SnapshotSerializer.ts`, including safer response-message extraction, typed localized-content guards, and replacement of touched explicit `any` usage. |
| Validation | New utils regression coverage passed, targeted applications/metahubs serializer and frontend continuity suites passed, touched file eslint checks passed, and the final root `pnpm build` passed with 27/27 successful tasks in 2m33.051s. |

Validation:

- `pnpm --filter @universo/utils exec vitest run src/serialization/__tests__/publicationSnapshotHash.test.ts` passed.
- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts` passed.
- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/SnapshotSerializer.test.ts` passed.
- `pnpm --filter @universo/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx` passed.
- Touched file eslint checks for the utils helper/test, `applicationReleaseBundle.ts`, `SnapshotSerializer.ts`, `ElementList.tsx`, and `AttributeList.systemTab.test.tsx` passed cleanly.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m33.051s.

## 2026-03-17 Disabled System Attributes Runtime Column Propagation Fix

Closed the runtime lifecycle-contract propagation bug reported after the earlier metahub system-attributes work. The platform already stored disabled lifecycle state in publication snapshots and schema-ddl already knew how to omit `_app_*` lifecycle columns, but the application release-bundle executable payload builder was reconstructing entities from raw `snapshot.entities` and dropping the snapshot-level `systemFields` metadata before schema generation.

| Area | Resolution |
| --- | --- |
| Root cause | Publication snapshots stored the catalog lifecycle contract in top-level `snapshot.systemFields`, while `createApplicationReleaseBundle(...)` built executable payload entities directly from `snapshot.entities`, so `config.systemFields.lifecycleContract` never reached schema-ddl during application sync. |
| Backend fix | `@universo/applications-backend` now hydrates `snapshot.systemFields[entity.id]` back into every executable entity config before building the bundle schema snapshot and the bootstrap/incremental payloads. |
| Regression proof | Release-bundle tests now assert that publication `systemFields` are preserved in executable payload entities, and sync-route tests now prove `generateFullSchema(...)` receives the disabled lifecycle contract during publication-driven application schema creation. |
| Validation | `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts src/tests/routes/applicationSyncRoutes.test.ts` passed with 28/28 tests, package lint/build passed, and the final root `pnpm build` passed with 27/27 successful tasks in 2m55.301s. |

Validation:

- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts src/tests/routes/applicationSyncRoutes.test.ts` passed with 28/28 tests.
- `pnpm --filter @universo/applications-backend lint` passed.
- `pnpm --filter @universo/applications-backend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m55.301s.

## 2026-03-17 Catalog Tab Isolation + Basic Template Layout Defaults

Closed two user-facing regressions in the metahubs experience. The first was a frontend state/caching defect where `Attributes` and `System` reused previous paginated rows during scope switches; the second was an unwanted default layout seed in the built-in `basic` template for newly created metahubs.

| Area | Resolution |
| --- | --- |
| Catalog tab isolation | `AttributeList` now opts out of `keepPreviousData` across query-key changes and resets pagination/expanded TABLE state when switching catalog tabs, so scoped list views no longer show stale rows from the previous scope. |
| Base template defaults | `basic.template.ts` now seeds `appNavbar` and `header` in the top zone and only `detailsTitle` + `detailsTable` in the center zone; the old default `columnsContainer(detailsTable + productTree)` seed is removed. |
| Regression proof | Frontend system-tab tests now assert the scoped list uses `keepPreviousDataOnQueryKeyChange: false`, and backend template-manifest tests assert the exact built-in basic-template widget set. |
| Validation | `@universo/metahubs-frontend` targeted Vitest passed 2/2, `@universo/metahubs-backend` targeted Jest passed 4/4, touched package lint remained warning-only with 0 errors, and the final root `pnpm build` passed with 27/27 successful tasks in 3m21.269s. |

Validation:

- `pnpm --filter @universo/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx` passed with 2/2 tests.
- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/templateManifestValidator.test.ts` passed with 4/4 tests.
- `pnpm --filter @universo/metahubs-frontend lint` passed with 0 errors and warning-only pre-existing package noise.
- `pnpm --filter @universo/metahubs-backend lint` passed with 0 errors and warning-only pre-existing package noise.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m21.269s.

## 2026-03-17 Application Connector Schema Sync Snapshot-Hash Fix

Closed a real runtime blocker in the application connector schema-sync flow. Connector schema creation could fail with `Application release snapshot hash does not match the embedded snapshot state` when a publication snapshot contained `systemFields`, because the publication-side serializer and the application-side verifier were hashing different normalized payloads.

| Area | Resolution |
| --- | --- |
| Root cause | `SnapshotSerializer.normalizeSnapshotForHash(...)` included `systemFields` and preserved omission semantics for optional keys, while `normalizePublicationSnapshotForHash(...)` in `@universo/applications-backend` had drifted by omitting `systemFields` and coercing some optional publication/layout keys from `undefined` to `null`. |
| Backend fix | `normalizePublicationSnapshotForHash(...)` now includes `systemFields` per entity and as a normalized top-level array, and no longer rewrites optional publication/layout keys such as `templateKey`, `widgetKey`, and top-level publication metadata into `null` values that were never present in the source serializer payload. |
| Regression proof | `applicationReleaseBundle.test.ts` now covers both a publication snapshot with `systemFields` and a serializer-compatible layout snapshot with omitted optional keys, proving the explicit publication hash is accepted instead of throwing the mismatch error. |
| Validation | `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts` passed with 10/10, package lint/build passed, the compiled `dist` parity probe now passes for the real layout-optional-key scenario, and the final root `pnpm build` passed with 27/27 successful tasks in 3m49.731s. |

Validation:

- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts` passed with 10/10 tests.
- `pnpm --filter @universo/applications-backend lint` passed.
- `pnpm --filter @universo/applications-backend build` passed.
- A compiled `dist` parity probe now confirms that a serializer-produced hash is accepted for the real omitted-layout-key publication snapshot shape.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m49.731s.

## 2026-03-17 Dashboard Cleanup + System Attribute UX Fixes
- Removed two test charts from MetahubBoard and ApplicationBoard (already done in working tree from prior session).
- Renamed system tab label from "Системные атрибуты" to "Системные" (heading "Системные атрибуты" kept as-is; already done in working tree).
- Fixed system attribute ordering after enable/disable toggle: `useUpdateAttribute.onMutate` now updates nested `system.isEnabled` so action visibility is correct during the optimistic period; `onSettled` forces active query refetch for system toggles to restore server sort order.
- Fixed empty menu for platform system attributes: `renderAttributeActions` now passes pre-filtered `visibleDescriptors` to `BaseEntityMenu` to prevent divergence between outer guard check and inner menu visibility re-evaluation.
- QA follow-up: removed unnecessary `as` type assertions for `toggleSystemEnabled` in system actions (ActionContext index signature `[key: string]: any` already covers it), removed identical-branch ternary for `searchPlaceholder`, fixed Prettier formatting in `systemAttributeSeed.test.ts`.
- Validation: metahubs-backend 38 suites / 249 tests PASS; ApplicationBoard 13 tests PASS; MetahubBoard 13 tests PASS; queryKeys 2 tests PASS; metahubs-frontend lint 0 errors (206 warnings); metahubs-backend lint 0 errors (214 warnings); full workspace build passed 27/27 in 2m57s.

## 2026-03-17 Platform System Attributes Final QA Closure Cleanup

Closed the last non-functional reopen in the platform system-attributes governance wave. This pass intentionally avoided changing runtime behavior and only removed the final lint residue that the QA audit still considered open: the template-seeding formatter blocker in the backend and the introduced hook-dependency / unused-variable warnings in the frontend System-tab continuity code.

| Area | Resolution |
| --- | --- |
| Backend lint blocker | Reformatted `TemplateSeedMigrator.ts` so the policy-aware template seeding path no longer produces an error-level lint failure in `@universo/metahubs-backend`. |
| Frontend continuity lint debt | Stabilized the derived attribute arrays in `ElementList.tsx` with `useMemo(...)` and removed the unused `searchValue` binding, eliminating the warnings introduced by the System-tab continuity work. |
| Targeted validation | `@universo/metahubs-backend` targeted tests passed 58/58, `@universo/metahubs-frontend` targeted tests passed 3/3, `@universo/applications-backend` targeted route tests passed 44/44, and the targeted schema-ddl suites passed. |
| Final integration gate | `pnpm --filter @universo/metahubs-backend lint` returned to warning-only package noise, `pnpm --filter @universo/metahubs-frontend lint` no longer reports the introduced continuity warnings, `pnpm --filter @universo/applications-backend lint` passed cleanly, `pnpm --filter @universo/schema-ddl lint` remained warning-only, and the final root `pnpm build` passed with 27/27 successful tasks in 2m37.2s. |

Validation:

- `pnpm --filter @universo/metahubs-backend lint` returned 0 errors and warning-only pre-existing package noise after the `TemplateSeedMigrator.ts` cleanup.
- `pnpm --filter @universo/metahubs-frontend lint` no longer reports the introduced `ElementList.tsx` hook-dependency or unused-variable warnings; remaining warnings are pre-existing package noise.
- `pnpm --filter @universo/applications-backend lint` passed cleanly.
- `pnpm --filter @universo/schema-ddl lint` remained warning-only with 0 errors.
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/MetahubAttributesService.test.ts src/tests/services/systemAttributeSeed.test.ts src/tests/routes/attributesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts src/tests/shared/platformSystemAttributesPolicy.test.ts` passed with 58/58 tests.
- `pnpm --filter @universo/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/__tests__/types.test.ts --reporter=basic` passed with 3/3 tests.
- `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts src/tests/routes/applicationSyncRoutes.test.ts` passed with 44/44 tests.
- `pnpm --filter @universo/schema-ddl test -- src/__tests__/SchemaGenerator.test.ts src/__tests__/SchemaMigrator.test.ts` passed for both targeted suites.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m37.2s.

## 2026-03-17 Platform System Attributes Policy Enforcement Reopen Closure

Closed the last reopened semantic gap in the platform system-attributes governance wave. The remaining defects were both contract-level issues rather than superficial polish: existing `_upl_*` enable/disable writes still bypassed the global platform override policy, and builtin template catalog seeding still used a separate policy-blind path that could drift from interactive catalog creation/copy behavior.

| Area | Resolution |
| --- | --- |
| Backend toggle enforcement | `MetahubAttributesService.update(...)` now resolves the global platform policy and rejects `_upl_*` system-attribute mutations when metahub-level configuration is disabled or when enforced platform defaults make the row immutable at the metahub layer. |
| Template seeding parity | Template executor and migrator seeding now resolve the same admin policy and pass it into `ensureCatalogSystemAttributesSeed(...)`, so builtin-template repair uses the same seed-plan semantics as interactive catalog creation/copy. |
| Frontend contract alignment | The System tab now hides enable/disable actions for `_upl_*` rows when the backend policy forbids metahub-level overrides, keeping the UI aligned with the backend mutation contract instead of offering actions that must always fail. |
| Regression proof and validation | Added direct regressions for blocked `_upl_*` toggles and policy-aware template seeding, reran targeted backend/frontend validation, cleared the new error-level lint issues in the touched files, and confirmed the final root build with 27/27 successful tasks in 2m40.243s. |

Validation:

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/MetahubAttributesService.test.ts src/tests/services/systemAttributeSeed.test.ts src/tests/routes/attributesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts src/tests/shared/platformSystemAttributesPolicy.test.ts` passed with 58/58 tests.
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/__tests__/types.test.ts` passed for the touched frontend suites.
- `pnpm --filter @universo/metahubs-backend lint` and `pnpm --filter @universo/metahubs-frontend lint` are error-free and report warning-only pre-existing package noise.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m40.243s.

## 2026-03-17 Platform System Attributes QA Remediation Follow-Up Closure

Closed the final QA follow-up for the platform system-attributes governance wave. The remaining issues were all real runtime-quality gaps rather than cosmetic debt: attribute mutations still acknowledged success when post-write schema sync failed, `ensureCatalogSystemAttributes(...)` could fall back to a non-transactional final read, and the new platform-policy/admin-settings seam still lacked direct regression proof.

| Area | Resolution |
| --- | --- |
| Fail-closed mutation contract | Attribute create/copy/update/delete/display-toggle flows now route post-write schema synchronization through an explicit fail-closed helper and return structured `SCHEMA_SYNC_FAILED` responses instead of silently logging sync failures after successful writes. |
| Transaction-safe system reads | `MetahubAttributesService.ensureCatalogSystemAttributes(...)` now keeps its final catalog system-row read on the provided transaction runner, so create/copy callers observe the same transactional view that seeded or repaired the rows. |
| Missing seam coverage | Added direct regressions for schema-sync failure handling in attribute routes, transaction-safe ensure reads in the attributes service, platform policy/seed-plan resolution, and admin request-scoped validation/persistence for the three metahubs platform toggle keys. |
| Validation | `@universo/metahubs-backend` targeted tests passed 54/54, `@universo/admin-backend` request-scoped route tests passed 6/6, `@universo/utils` tests passed 239/239, touched lints are now warning-only after clearing the remaining `@universo/utils` error-level formatting regressions, and the final root `pnpm build` passed with 27/27 successful tasks in 2m49.913s. |

Validation:

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts src/tests/services/MetahubAttributesService.test.ts src/tests/shared/platformSystemAttributesPolicy.test.ts` passed with 54/54 tests.
- `pnpm --filter @universo/admin-backend test -- src/tests/routes/requestScopedExecutorRoutes.test.ts` passed with 6/6 tests.
- `pnpm --filter @universo/utils test -- src/database/__tests__/catalogSystemFields.test.ts` passed with 239/239 package tests.
- `pnpm --filter @universo/metahubs-backend lint`, `pnpm --filter @universo/admin-backend lint`, and `pnpm --filter @universo/utils lint` are now error-free and report warning-only pre-existing package noise.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m49.913s.

## 2026-03-16 Platform System Attributes Governance + System Tab UX Closure

Closed the follow-up wave for platform `_upl_*` system attributes so metahub catalogs now obey a global platform policy without collapsing platform defaults into per-metahub configuration. The work covered the full seam: shared type contracts, admin settings, backend policy resolution, catalog seeding/list filtering, frontend System routing/menu behavior, and deterministic optimistic ordering.

| Area | Resolution |
| --- | --- |
| Global governance | Added three admin `metahubs` settings: `platformSystemAttributesConfigurable` (default `false`), `platformSystemAttributesRequired` (default `true`), and `platformSystemAttributesIgnoreMetahubSettings` (default `true`), with backend validation, migration seeds, and admin frontend switches in EN/RU. |
| Policy-aware seeding/listing | Metahubs backend now resolves platform policy from `admin.cfg_settings`, passes it into `ensureCatalogSystemAttributes(...)` on catalog create/copy flows, filters `_upl_*` rows from System responses when configuration is disabled, and returns the resolved policy in response `meta`. |
| System tab UX | Catalog System now uses dedicated `/system` routes, Elements view routes back to `/system` instead of `attributes?tab=system`, UI wording is consistently “System attributes”, and system enable/disable menu actions use compact labels plus explicit icons. |
| Platform toggle behavior | `_upl_*` registry rows are now configurable, platform action menus no longer render empty, and optimistic attribute updates no longer move toggled rows to the top, preserving canonical registry order. |
| Validation | Targeted metahubs frontend/backend/shared tests passed, `@universo/types` and `@universo/utils` builds were refreshed for runtime consumers, touched package lint errors were removed, warning-only lint noise remains pre-existing in other files, and the final root `pnpm build` passed with 27/27 successful tasks in 2m52.626s. |

Validation:

- `pnpm --filter @universo/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx` passed.
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx` passed for the touched frontend routing/continuity coverage.
- `pnpm --filter @universo/utils test -- src/database/__tests__/catalogSystemFields.test.ts` passed with the updated `_upl_*` disableability contract.
- `pnpm --filter @universo/types build` and `pnpm --filter @universo/utils build` passed so backend runtime consumers picked up the new exports and registry changes.
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts src/tests/services/MetahubAttributesService.test.ts` passed.
- `pnpm --filter @universo/admin-frontend lint`, `pnpm --filter @universo/admin-backend lint`, and `pnpm --filter @universo/metahubs-backend lint` are error-free and now report warning-only pre-existing package noise.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m52.626s.

## 2026-03-16 Metahub System Attributes QA Final Remediation Closure

Closed the last two real QA gaps in the metahub system-attributes initiative. The remaining issues were both functional rather than cosmetic: the System tab could not actually toggle system fields because the attribute PATCH route rejected all system-row updates too early, and catalog copy with `copyAttributes=false` silently reset disabled lifecycle fields back to default-enabled states instead of preserving the source catalog configuration.

| Area | Resolution |
| --- | --- |
| Route-level system toggles | `PATCH /attribute/:attributeId` now special-cases system rows, accepts only guarded `isEnabled` + `expectedVersion` updates, and returns structured 409 responses for forbidden system mutations or protected platform-field disable attempts. |
| Copy semantics | Catalog copy now reads the source system-field enabled states and passes them into canonical seeding when ordinary attributes are skipped, so copied catalogs preserve the source lifecycle contract instead of silently reverting to defaults. |
| Regression proof | Added direct route regressions for successful system toggle, forbidden system patch payloads, protected `_upl_*` disable rejection, catalog-copy state preservation, and service-level seeded disabled-state handling. |
| Validation | `@universo/metahubs-backend` targeted tests passed, `@universo/metahubs-backend` lint passed, the frontend System tab / Settings continuity / types regressions passed, and the final root `pnpm build` passed with 27/27 successful tasks in 3m2.158s. |

Validation:

- `pnpm --filter @universo/metahubs-backend test -- attributesRoutes.test.ts catalogsRoutes.test.ts MetahubAttributesService.test.ts SnapshotSerializer.test.ts systemAttributeSeed.test.ts` passed.
- `pnpm --filter @universo/metahubs-backend lint` passed.
- `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/__tests__/types.test.ts --reporter=basic` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m2.158s.

## 2026-03-16 Metahub System Attributes + Migration Hardening QA Reopen Closure

Closed the last reopened gap in the metahub system-attributes initiative after QA found that catalog copy could bypass canonical system-row seeding. The fix keeps the implementation aligned with the original plan requirement that every new catalog starts with managed lifecycle system attributes, while also clearing the error-level lint regressions that had accumulated in the touched runtime/schema/metahubs/frontend files.

| Area | Resolution |
| --- | --- |
| Catalog copy invariant | The copy route now calls the shared `ensureCatalogSystemAttributes(...)` helper inside the copy transaction, so copied catalogs always finish with canonical managed system rows even when `copyAttributes` is false. |
| Regression proof | `catalogsRoutes.test.ts` now asserts shared system seeding for copy-without-attributes and keeps the duplicate-codename retry behavior covered. |
| Lint cleanup | Removed the reopened error-level lint regressions in `applicationsRoutes.ts`, `applicationsRoutes.test.ts`, `SchemaGenerator.ts`, and the touched metahubs/frontend feature files/tests that surfaced during final package lint validation. |
| Validation | Targeted metahubs/application/schema/frontend regressions passed, touched lint checks no longer reported error-level failures, and the final root `pnpm build` passed with 27/27 successful tasks in 2m52.165s. |

Validation:

- `pnpm --filter @universo/metahubs-backend test -- catalogsRoutes.test.ts` passed.
- `pnpm --filter @universo/metahubs-backend test -- SnapshotSerializer.test.ts systemAttributeSeed.test.ts MetahubObjectsService.test.ts` passed.
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` passed.
- `pnpm --filter @universo/schema-ddl test -- SchemaGenerator.test.ts` passed.
- `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/__tests__/types.test.ts --reporter=basic` passed.
- Error-level lint failures were cleared from the touched metahubs/application/schema/frontend files validated during this reopen wave.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m52.165s.

## 2026-03-16 Metahub System Attributes + Migration Hardening Final QA Remediation Closure

Closed the second remediation pass for the metahub system-attributes initiative after the QA audit disproved the earlier closure state. The remaining gap was not cosmetic: the backend could persist invalid lifecycle toggle combinations, the shared helper surface did not advertise nested-partial lifecycle inputs explicitly, runtime/schema branches still lacked direct regression proof, and browser consumers were missing one shared export needed by the final frontend bundle.

| Area | Resolution |
| --- | --- |
| Write-time lifecycle integrity | `MetahubAttributesService.update(...)` now applies system toggle changes inside one transaction, cascades dependency changes before persistence, rejects protected `_upl_*` disable attempts, and preserves optimistic-lock behavior for the toggled row. |
| Shared contract cleanup | `@universo/types` now exports `ApplicationLifecycleContractInput`, `@universo/utils` consumes that nested-partial input explicitly, and the browser entrypoint re-exports the catalog system-field helpers needed by frontend bundles. |
| Missing regression proof | Added direct metahubs service tests for protected/cascading system toggles, applications-backend route tests for hard-delete vs selective `_app_deleted_*` behavior, and schema-ddl tests proving contract-driven lifecycle column generation. |
| Frontend/system UX hardening | The System tab no longer exposes disable actions for non-disableable system rows, aligning the UI with the canonical `canDisable` contract instead of relying on backend rejection alone. |
| Validation | `pnpm --filter @universo/utils test` passed, `pnpm --filter @universo/metahubs-backend test -- MetahubAttributesService.test.ts` passed, `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` passed, `pnpm --filter @universo/schema-ddl test -- SchemaGenerator.test.ts` passed, `pnpm --filter @universo/metahubs-frontend lint` passed, `pnpm --filter @universo/metahubs-backend build` passed, and the final root `pnpm build` passed with 27/27 successful tasks in 3m11.586s. |

Validation:

- `pnpm --filter @universo/utils test` passed with 239/239 tests.
- `pnpm --filter @universo/metahubs-backend test -- MetahubAttributesService.test.ts` passed.
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` passed.
- `pnpm --filter @universo/schema-ddl test -- SchemaGenerator.test.ts` passed.
- `pnpm --filter @universo/metahubs-frontend lint` passed.
- `pnpm --filter @universo/metahubs-backend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m11.586s.

## 2026-03-16 Metahub System Attributes + Migration Hardening QA Remediation Closure

Closed the follow-up remediation wave that reopened this feature after QA found a real backend defect, incomplete regression proof, duplicated seed orchestration, missing reserved-codename protection, and overstated memory-bank completion status. The feature is now re-closed with direct proof for the backend and frontend seams that were previously under-covered.

| Area | Resolution |
| --- | --- |
| Backend correctness hardening | Fixed the `MetahubAttributesService.getAllAttributes()` callback-binding defect, added reserved managed-system codename protection for business attributes, blocked copying system attributes, and normalized route-level 409 handling for reserved system codenames. |
| Shared seed orchestration | Moved canonical system-attribute seed-record generation into `@universo/utils` so `MetahubAttributesService` and template seeding now repair/seed the same lifecycle rows without drift. |
| Backend regression proof | Added/expanded regressions for shared system-field registry helpers, reserved business codenames, catalog seeding, template repair behavior, and snapshot `systemFields` serialization/runtime propagation. |
| Frontend direct UI proof | Added explicit UI regressions for the System tab and Settings continuity flow, then hardened the tests with partial shared-package mocks so transitive exports remain available during isolated component mounting. |
| Validation and status sync | `@universo/utils` tests passed 239/239; `@universo/metahubs-backend` tests passed 234/234 with 3 expected skips; `@universo/metahubs-frontend` tests passed 147/147; targeted builds passed for `@universo/utils`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`; final root `pnpm build` passed with 27/27 successful tasks in 2m54.865s. |

Validation:

- `pnpm --filter @universo/utils test` passed with 239/239 tests.
- `pnpm --filter @universo/metahubs-backend test` passed with 234/234 tests and 3 expected skips.
- `pnpm --filter @universo/metahubs-frontend test` passed with 147/147 tests.
- `pnpm --filter @universo/utils build` passed.
- `pnpm --filter @universo/metahubs-backend build` passed.
- `pnpm --filter @universo/metahubs-frontend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 2m54.865s.

## 2026-03-16 Metahub System Attributes + Migration Hardening IMPLEMENTED

Completed the full implementation wave for configurable metahub catalog lifecycle system attributes, runtime lifecycle-contract propagation, and the metahubs frontend System tab UX. The feature now spans shared contracts, metahubs persistence and template seeding, publication/runtime metadata propagation, lifecycle-aware runtime CRUD/sync behavior, and the requested `Attributes -> System -> Elements -> Settings` navigation flow.

| Area | Resolution |
| --- | --- |
| Shared contracts and helpers | Added canonical catalog system-field metadata/types in `@universo/types` and shared registry/helper logic in `@universo/utils`, reusing the existing low-level system field constants rather than duplicating raw names. |
| Metahubs backend hardening | `_mhb_attributes` now stores explicit system-row metadata, new catalogs/templates seed the canonical `_app_*` and `_upl_*` rows, generic business attribute APIs exclude system rows by default, and protected mutations reject delete/reorder/move/structural edits while still allowing enable/disable toggles. |
| Snapshot/runtime propagation | Publication serialization now emits dedicated `systemFields` metadata outside ordinary business `fields`, runtime application config persists the resolved lifecycle contract, and schema-ddl wiring plus runtime CRUD/sync flows consume that contract without changing `snapshotFormatVersion`. |
| Frontend System UX | `@universo/metahubs-frontend` now exposes a query-param System view with `scope=system` loading, scope-aware query keys, system metadata preservation in frontend types, localized enable/disable actions and success messages, visible physical type/status rendering, and Settings continuity from both Attributes and Elements views. |
| Final validation and late compile fixes | Final root validation surfaced three compile-only regressions that were fixed before closure: missing runtime lifecycle predicate declarations in `applicationsRoutes.ts`, a missing `attributesService` destructure in the hub-scoped catalog create route, and broad `system_key` typing in `MetahubAttributesService` that now normalizes through the canonical registry. |

Validation:

- Touched frontend files reported no editor diagnostics.
- Changed frontend files reached targeted eslint status of 0 errors and warning-only noise in pre-existing `ElementList.tsx` areas.
- `pnpm --filter @universo/metahubs-frontend build` passed.
- `pnpm --filter @universo/applications-backend build` passed.
- `pnpm --filter @universo/metahubs-backend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m12.818s.

## 2026-03-16 Metahub System Attributes + Migration Hardening Planning Complete

Completed the requested deep planning pass for configurable metahub catalog lifecycle system attributes and the related runtime migration hardening. This was a planning/documentation milestone rather than an implementation wave: the codebase, external references, and live UP-test schema were audited to produce a repository-specific execution plan with explicit sequencing, safety rules, performance constraints, and a full test matrix.

| Area | Resolution |
| --- | --- |
| Cross-package audit | Verified the affected seams across `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/schema-ddl`, `@universo/applications-backend`, builtin templates, shared i18n/types/utils packages, and the catalog tab UX surface. |
| Critical architecture finding | Confirmed that runtime `_app_*` lifecycle fields are currently hardcoded in schema generation and also assumed directly by runtime sync and CRUD routes, so the final implementation must introduce an explicit lifecycle-contract/delete-strategy layer instead of relying on column existence or UI-only toggles. |
| Planning decision | Recommended a safe scope cut: make publish/archive/delete lifecycle families configurable per catalog while keeping owner/access and baseline audit infrastructure fixed for wave 1. |
| Propagation model | Locked the publication snapshot as the required seam for carrying catalog system-field metadata into runtime application generation, release bundles, and CRUD/sync behavior. |
| UX direction | Captured the requested catalog tab order `Attributes -> System -> Elements -> Settings`, persistent Settings visibility, and toggle-only management for system rows with localized RU/EN labels and visible type information. |
| QA-refined planning artifact | Added and then refined `memory-bank/plan/metahub-system-attributes-migration-hardening-plan-2026-03-16.md`, which now explicitly requires reuse of the existing shared system-field contract, `_mhb_attributes`-based persistence, template migrator/cleanup coverage, backend reorder/move guards for system rows, reuse of existing metahub list/dialog/query-key patterns, and strict isolation of system rows from ordinary attribute lists, element forms, generic snapshot fields, and runtime business-field metadata. |

Validation:

- This planning wave did not change runtime code, so no package build/test rerun was required.
- The completed deliverable is the discussion-ready plan plus synchronized memory-bank context.

## 2026-03-16 Start System App — PR Review Follow-Up Closure

Closed the first PR review wave for the onboarding system-app refactor by validating every bot comment against the repository contracts before changing code. The accepted fixes were kept narrow so they closed real correctness gaps without reopening the already-resolved bootstrap and onboarding-flow work.

| Area | Resolution |
| --- | --- |
| Definition-driven constraint gap | Moved the `rel_user_selections.catalog_kind` CHECK from the discarded package-local `CREATE TABLE` SQL into explicit post-generation `ALTER TABLE ... DROP/ADD CONSTRAINT ...` statements, and added a migration integration regression proving the finalized start migration now reapplies the constraint after compiler-driven table generation. |
| Selection soft-delete contract | `syncUserSelections(...)` now performs dual-flag soft delete (`_upl_*` + `_app_*`) and bumps `_upl_version`, aligning the start schema with the repository application-like system-field contract instead of only toggling `_upl_deleted`. |
| Profile encapsulation | `GET /onboarding/items` now reads `onboarding_completed` through `ProfileService.getUserProfile(...)` rather than raw SQL against `profiles.cat_profiles`, keeping the start module behind the profile package boundary consistently with the completion endpoint. |
| Frontend rendering + docs cleanup | `SelectableListCard` now resolves description text before rendering so missing VLC content does not emit empty typography, and the accidental duplicate `Second Comprehensive QA Closure` heading was removed from `progress.md`. |
| Validation | `@universo/start-backend` tests passed 26/26, `@universo/start-frontend` tests passed 16/16, `@universo/migrations-platform` tests passed 127/127, targeted lint stayed clean for all three packages, and the final root `pnpm build` passed with 27/27 successful tasks in 3m0.819s. |

## 2026-03-16 Start System App — Clean-DB Bootstrap Ordering Fix Complete

Closed the clean-database startup regression that surfaced after the onboarding system-app migration had already passed QA. The issue was not in the schema itself, but in cross-system-app migration ordering: `start` tried to create admin-dependent RLS policies before the admin permission helper existed on a fresh database.

| Area | Resolution |
| --- | --- |
| Root cause | Platform migrations are flattened across system apps and globally sorted by version/id. The original `FinalizeStartSchemaSupport1710000000001` migration therefore ran before `FinalizeAdminSchemaSupport1733400000001` on a clean database, while `start` policy SQL already referenced `admin.has_admin_permission((select auth.uid()))`. |
| Migration fix | Removed policy creation from the original `start` finalize migration and added `ApplyStartSchemaPolicies1733400000500`, which drops/recreates the 9 `start` schema policies only after admin bootstrap helpers are available. |
| Regression coverage | Updated the start system-app manifest tests to expect the explicit third migration, moved policy assertions into the new policy migration tests, and added an ordering regression that proves the start policy migration sorts after admin finalize. |
| Validation | `@universo/start-backend` tests passed 26/26, `@universo/migrations-platform` tests passed 126/126, targeted lint stayed clean, targeted package builds passed, and the final root `pnpm build` passed with 27/27 successful tasks in 2m57.464s. |

## 2026-03-15 Start System App — Final Remediation Closure

Closed the remaining QA debt after the second comprehensive audit so the onboarding system-app flow is now consistent, atomic, and free of duplicate-fetch behavior in the authenticated start-page path.

| Area | Resolution |
| --- | --- |
| Atomic selection sync | `POST /selections` now performs validation plus the goals/topics/features replacement flow inside one `DbExecutor.transaction(...)`, eliminating partial-write outcomes when one catalog sync fails mid-request. |
| Duplicate-id hardening | Incoming `goals/topics/features` arrays are normalized before validation and sync, and `syncUserSelections(...)` also deduplicates defensively so response counts and INSERT attempts stay correct even if a caller repeats the same UUID. |
| Frontend preload flow | `AuthenticatedStartPage` now reuses its prefetch result by passing `initialItems` into `OnboardingWizard`, removing the extra onboarding-items request while preserving the fallback-to-wizard behavior on prefetch failure. |
| Regression coverage | Added backend regressions for duplicate-id normalization and transaction-bound sync, plus frontend regressions for wizard preload/no-refetch and authenticated start-page completion/fallback rendering. |
| Validation | start-backend 26/26 PASS, start-frontend 16/16 PASS, migrations-platform 123/123 PASS, targeted lint clean, targeted package builds clean, root `pnpm build` passed with 27/27 successful tasks in 4m55.803s. |

## 2026-03-15 Start System App — Second Comprehensive QA Closure

Second comprehensive QA audit verified all 14 ТЗ requirements, all 30 seed items against backup files, all 5 plan phases, security model, and data integrity. One LOW finding fixed.

| Area | Resolution |
| --- | --- |
| LOW-1: Missing 401 test | Added `returns 401 when unauthenticated` test for POST /selections in `onboardingRoutes.test.ts`. Test count: start-backend 23/23 (was 22). |
| INFO observations | (1) Mock VLC format in route tests uses simplified shape — cosmetic, no impact. (2) Double-fetch in AuthenticatedStartPage + OnboardingWizard — plan-acknowledged, deferred to TanStack Query adoption. (3) Auto-select first item per category — UX decision, not in plan. |
| Validation | start-backend 23/23, start-frontend 12/12, migrations-platform 123/123. All three packages lint-clean. All 14 ТЗ requirements verified DONE. |

## 2026-03-15 Start System App — QA Follow-Up Closure

Resolved both issues identified in the post-implementation QA audit of the Start System App migration.

| Area | Resolution |
| --- | --- |
| Lint formatting | Auto-fixed Prettier errors via `npx eslint --fix` in start-backend (91 errors), start-frontend (10 errors), and migrations-platform (10 errors in new test file). All three packages now lint-clean. |
| Missing test file | Created `startSystemApp.test.ts` in migrations-platform with 17 tests covering: prepare/finalize migration split, no CREATE TABLE in finalize, index presence, RLS enablement on 4 tables, 9 RLS policies with correct names, WITH CHECK on user self-management, 30 seed items (10+10+10), ON CONFLICT idempotency, VLC format with 2024-12-06 date, en/ru locales, manifest wiring, loadPlatformMigrations scoping, bootstrap phase filtering. Added jest.config.js module name mappers for `@universo/start-backend/platform-definition` and `@universo/start-backend/platform-migrations`. |
| Validation | start-backend 22/22 PASS, start-frontend 12/12 PASS, migrations-platform 123/123 PASS (was 106, +17 new). All three packages lint-clean. |

## 2026-03-15 Start System App — Onboarding Architecture Migration IMPLEMENTED

Completed the full 5-phase migration of the Start/Onboarding module to the system-app architecture, following plan v3. The `start` schema now has 4 business tables with VLC-based catalog items (goals, topics, features) and user selection tracking, all managed through the fixed system-app lifecycle.

| Area | Resolution |
| --- | --- |
| Phase 1: Platform definition | Created `systemAppDefinition.ts` (key='start', schema='start', application_like storage, 4 business tables), `migrations/index.ts` (~380 lines: local interfaces, VLC seed helper, 30 seed items en/ru, full DDL, RLS policies, prepare/finalize split), registered in `systemAppDefinitions.ts` (6th entry), added 6 RLS policy rewrites in `rlsPolicyOptimization.ts`. |
| Phase 2: Backend persistence | Created `onboardingStore.ts` (5 functions: fetchCatalogItems with CatalogKind routing, fetchUserSelections, fetchAllUserSelections, validateItemExists, syncUserSelections with RETURNING + soft delete). Rewrote `onboardingRoutes.ts` (3 endpoints: GET /items with parallel fetch, POST /selections with Zod + existence validation, POST /complete with ProfileService). Updated `index.ts` exports. |
| Phase 3: Frontend | Updated `types/index.ts` (VLC-based OnboardingCatalogItem, SyncSelectionsRequest/Response, CompleteOnboardingResponse, OnboardingStep). Updated `api/onboarding.ts` (syncSelections + completeOnboarding). Updated `SelectableListCard.tsx` (getVLCString for name/description rendering). Rewrote `OnboardingWizard.tsx` (goals/topics/features steps, syncSelections + completeOnboarding on final data step). Updated i18n en/ru files (projects→goals, campaigns→topics, clusters→features). |
| Phase 4: Testing | Created 6 new test files: backend (onboardingStore.test.ts, onboardingRoutes.test.ts, systemAppDefinition.test.ts), frontend (onboarding.test.ts, SelectionStep.test.tsx, OnboardingWizard.test.tsx). Updated platformMigrations.test.ts and systemAppDefinitions.test.ts for 'start' inclusion. |
| Phase 5: Validation | Added 'start' to FIXED_SCHEMA_NAMES in migrations-core/identifiers.ts. Added 'test' script to start-frontend/package.json. Full build 27/27 tasks. Tests: start-backend 22/22, start-frontend 12/12, migrations-platform 106/106, migrations-core 58/58. |
| Key discoveries | (1) FIXED_SCHEMA_NAMES in migrations-core must include 'start' for assertCanonicalSchemaName validation. (2) Zod route validation requires proper UUID format in tests. (3) Frontend tests need stable `t` function reference in react-i18next mock to avoid useEffect infinite loop. (4) VLC in tests must use proper `VersionedLocalizedContent` format (locales object with content entries, not versions array). |

## 2026-03-15 Repository-Wide Legacy Branding Removal Complete

Closed the repository-wide legacy branding purge so editable workspace content no longer contains the old upstream brand naming outside git internals. The sweep covered runtime/backend/frontend source, env comments, i18n bundles, deployment docs, memory-bank files, historical plan history, `.kiro` steering guidance, repository instruction files, and generated artifacts/logs.

| Area | Resolution |
| --- | --- |
| Runtime and frontend source | Removed remaining legacy env aliases, comments, path references, external docs links, profile/backend notes, and frontend HTML metadata references. |
| Documentation and guidance | Scrubbed memory-bank core files and historical plans, `.kiro` steering guidance, deployment docs, and repository instruction files so they no longer mention the legacy upstream brand. |
| Generated artifacts | Deleted stale backup/log/coverage artifacts, removed obsolete generated files, and rebuilt the touched packages so regenerated `dist` / `build` outputs stayed clean. |
| Validation | Targeted builds passed for `@universo/admin-frontend`, `@universo/profile-backend`, `@universo/core-backend`, and `@universo/core-frontend`; final repository-wide grep outside `.git` and `node_modules` returned zero matches for `Flowise|FLOWISE|flowise`; final root `pnpm build` passed with 27/27 successful tasks in 3m10.826s. |

## 2026-03-15 Telemetry Removal + Definitive ENV Files Complete

Deleted the entire PostHog telemetry subsystem and produced the definitive version of both `.env.example` and `.env` with all live variables documented and all garbage removed.

| Area | Resolution |
| --- | --- |
| Deleted files | `packages/universo-core-backend/base/src/utils/telemetry.ts` (PostHog `Telemetry` class). |
| Removed dependency | `posthog-node` from `packages/universo-core-backend/base/package.json`. |
| Code cleanup | `index.ts`: removed import, property, initialization, flush. `base.ts`: removed `POSTHOG_PUBLIC_API_KEY` and the legacy telemetry-disable flag definitions and forwarding. `constants.ts`: removed dead `OMIT_QUEUE_JOB_DATA` (zero consumers). `App.initDatabase.test.ts`: removed mock and all 12 telemetry assertions. |
| ENV vars removed | `POSTHOG_PUBLIC_API_KEY` and the legacy telemetry-disable flag from both env files. |
| ENV vars added (12) | **Authentication**: `AUTH_REGISTRATION_ENABLED`, `AUTH_LOGIN_ENABLED`, `AUTH_EMAIL_CONFIRMATION_REQUIRED`, `AUTH_RLS_DEBUG`. **Session cookies**: `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAXAGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_PARTITIONED`. **Captcha**: `SMARTCAPTCHA_SERVER_KEY`, `SMARTCAPTCHA_SITE_KEY`, `SMARTCAPTCHA_TEST_MODE`, `SMARTCAPTCHA_REGISTRATION_ENABLED`, `SMARTCAPTCHA_LOGIN_ENABLED`, `SMARTCAPTCHA_PUBLICATION_ENABLED`. **Server**: `HOST`. |
| New sections | AUTHENTICATION, SESSION (expanded), CAPTCHA in both env files. |
| QA remediation follow-up | Added documentation for `ALLOW_TRANSACTION_POOLER`, `DATABASE_KNEX_POOL_DEBUG`, `DATABASE_SHUTDOWN_GRACE_MS`, `UNIVERSO_PATH`, and the `FILE_SIZE_LIMIT` alias; removed leftover `DATABASE_TYPE` and structured `REDIS_*` entries that no longer have direct runtime consumers. |
| Pool decision | Kept `DATABASE_POOL_MAX=5` active because `KnexClient` still defaults to 15, while the current repository guidance and Supabase Nano deployment profile require a safe cap of 5 connections. |
| CLI cleanup follow-up | Removed orphaned Oclif flags and process.env passthrough from `packages/universo-core-backend/base/src/commands/base.ts` for `APIKEY_*`, `SECRETKEY_*`, `TOOL_FUNCTION_*`, `DATABASE_TYPE`, `DATABASE_PATH`, `LANGCHAIN_*`, `MODEL_LIST_CONFIG_JSON`, `SHOW_COMMUNITY_NODES`, `DISABLED_NODES`, `BLOB_STORAGE_PATH`, `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`, `GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS`, `DEBUG`, queue/BullMQ vars, and structured `REDIS_*` fields beyond `REDIS_URL`. |

Validation: `pnpm --filter @universo/core-backend build` passed. Final `pnpm build` passed with 27/27 successful tasks. Zero telemetry references in source. All intended env vars are present, and `BaseCommand` now mirrors only live backend runtime inputs.

## 2026-03-14 Environment Config Cleanup Complete

Removed ~52 dead environment variables from `packages/universo-core-backend/base/.env.example` and `.env` that accumulated after the removal of legacy upstream packages, Space Builder, Multiplayer, and metrics infrastructure during prior refactoring waves.
| Area | Resolution |
| --- | --- |
| Deleted sections | APIKEY (2 vars), SECRET KEYS (7 vars; `SESSION_SECRET` moved to own section), METRICS (7 vars), MULTIPLAYER (3 vars), SPACE BUILDER (15 vars), QUEUE/BullMQ config (6 vars). |
| Cleaned vars | `DATABASE_PATH`, `DATABASE_CONNECTION_BUDGET`, `DATABASE_KNEX_POOL_MAX`, `TOOL_FUNCTION_BUILTIN_DEP`, `TOOL_FUNCTION_EXTERNAL_DEP`, `BLOB_STORAGE_PATH`, `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`, `GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS`, `LANGCHAIN_*` (4), `MODEL_LIST_CONFIG_JSON`, `SHOW_COMMUNITY_NODES`, `DISABLED_NODES`. |
| Added vars | `DATABASE_KNEX_ACQUIRE_TIMEOUT_MS`, `DATABASE_KNEX_IDLE_TIMEOUT_MS`, `DATABASE_KNEX_CREATE_TIMEOUT_MS` — already used in `KnexClient.ts` but were not documented. |
| Section restructuring | QUEUE CONFIGURATION → REDIS (rate-limiting only); SECRET KEYS split into standalone SESSION section; pooling header updated from "Knex only" to "Knex". |
Validation: both files verified with grep — 0 dead variable matches, all live variables present.

## 2026-03-14 Applications + Metahubs Migration Docs Refresh Complete

Closed the package-local migration documentation drift that had accumulated after the fixed-system-app convergence and runtime migration refactors. The `MIGRATIONS.md` / `MIGRATIONS-RU.md` pairs for `@universo/applications-backend` and `@universo/metahubs-backend` now describe the current bootstrap origin, runtime migration surfaces, and ownership split truthfully instead of mixing pre-refactor route ownership and obsolete system-table assumptions.
| Area | Resolution |
| --- | --- |
| Applications migration docs | Rewrote the applications pair around the current fixed-system-app lifecycle: manual snapshot-equivalent baseline, manifest plus file-backed SQL support migrations, first-start bootstrap through registered schema plans, real runtime system-table set, and the applications-owned sync/diff/release-bundle surface. |
| Metahubs migration docs | Rewrote the metahubs pair around the current hybrid model: fixed design-time system app bootstrap, branch runtime migrations in `_mhb_migrations`, built-in template seeding, metahub migration status/list/plan/apply routes, and the hosted application migration-control routes. |
| Ownership boundary clarity | Removed the stale implication that applications-backend owns the application migration-control endpoints, and replaced it with the actual split where metahubs-backend hosts migration-control while applications-backend owns runtime sync and release-bundle execution. |
| Validation | Touched EN/RU line-count parity closed at 89/89 for the applications pair and 94/94 for the metahubs pair; focused package builds passed for both backend packages, and the final root `pnpm build` passed with 27/27 successful tasks in 3m13.394s. |
Validation:

- `pnpm --filter @universo/applications-backend build` passed.
- `pnpm --filter @universo/metahubs-backend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m13.394s.
## 2026-03-14 REST Documentation Package Follow-Up Cleanup Complete

Closed the short follow-up wave that reopened immediately after the main `@universo/rest-docs` refactor. Post-implementation verification found that four package-level markdown files still contained duplicated legacy sections appended after the refreshed current-state guidance, so this pass removed the stale tails and reran the package validation path.
| Area | Resolution |
| --- | --- |
| Package markdown cleanup | Removed the leftover historical sections from `packages/universo-rest-docs/README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` so each file now contains only the new generated-docs guidance. |
| Validation rerun | Re-ran `pnpm --filter @universo/rest-docs validate`, `pnpm --filter @universo/rest-docs lint`, and `pnpm --filter @universo/rest-docs build`; all three commands passed after the cleanup. |
| Final doc sizes | The cleaned package docs now end at 73/73 lines for `README.md` and `README-RU.md`, 76 lines for `ARCHITECTURE.md`, and 79 lines for `API_ENDPOINTS.md`, replacing the inflated line counts caused by the duplicated tails. |
Validation:

- `pnpm --filter @universo/rest-docs validate` passed and regenerated a valid OpenAPI source.
- `pnpm --filter @universo/rest-docs lint` passed.
- `pnpm --filter @universo/rest-docs build` passed and bundled the OpenAPI spec successfully.
## 2026-03-14 REST Documentation Package Refactor Complete

Closed the `@universo/rest-docs` modernization wave after the audit confirmed that the package still documented removed workspace-era API groups. The package now rebuilds its OpenAPI source from the live mounted backend route files, the historical YAML fragments are gone, and GitBook now points readers to a real run-and-use path for the interactive Swagger docs.
| Area | Resolution |
| --- | --- |
| Generated OpenAPI source | Added `packages/universo-rest-docs/scripts/generate-openapi-source.js` and wired package scripts so validate/build regenerate `src/openapi/index.yml` from the live auth, profile, start, admin, applications, and metahubs route files before linting or bundling. |
| Legacy docs removal | Deleted the old unik/space/canvas/metaverse-oriented path and component fragments from `packages/universo-rest-docs/src/openapi/`, eliminating the stale historical taxonomy from the package source tree. |
| Package guidance refresh | Rewrote `packages/universo-rest-docs/README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` so they describe the current generated docs flow, route-family scope, runtime commands, and the limits of generic payload schemas. |
| GitBook integration | Updated `docs/en|ru/api-reference/README.md`, `rest-api.md`, both `SUMMARY.md` files, and added `interactive-openapi-docs.md` in both languages so readers can find, launch, and safely use the interactive API docs. |
Validation:

- `pnpm --filter @universo/rest-docs validate` passed after regenerating the OpenAPI source.
- `pnpm --filter @universo/rest-docs lint` passed.
- `pnpm --filter @universo/rest-docs build` passed and regenerated/bundled the YAML successfully.
- Touched English/Russian doc pairs passed line-count parity checks.
- Final root `pnpm build` passed with 27/27 successful tasks in 4m4.739s.
## 2026-03-14 Unified Database Access Standardization — Documentation and Agent Guidance Sync Complete

Closed the follow-through documentation wave after the implementation and remediation work had already stabilized the code. This pass made the repository documentation, package READMEs, AGENTS guidance, and architecture-facing memory-bank files all describe the same finalized SQL-first PostgreSQL access model, so future contributors and agents see the same boundaries the code now enforces.
| Area | Resolution |
| --- | --- |
| Package README alignment | Updated the English and Russian READMEs for `@universo/applications-backend`, `@universo/metahubs-backend`, `@universo/utils`, and `@universo/database` so they explain Tier 1 request-scoped executors, Tier 2 pool executors, Tier 3 transport/DDL-only Knex ownership, and the fail-closed mutation posture consistently. |
| Public architecture and contributing docs | Refreshed `docs/en|ru/architecture/database-access-standard.md`, `docs/en|ru/contributing/creating-packages.md`, and `docs/en|ru/contributing/database-code-review-checklist.md` to document schema-qualified SQL, identifier helpers, `RETURNING` requirements, explicit package-local DDL seams, and code-review expectations. |
| Agent guidance | Updated the root `AGENTS.md`, rewrote the applications/metahubs backend package agents, and added package-local agents for `@universo/utils` and `@universo/database` so repository automation guidance now matches the final transport-versus-domain boundary. |
| Memory-bank architecture sync | Synced `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`, `memory-bank/activeContext.md`, and `memory-bank/tasks.md` so durable architecture notes, active context, and completion tracking all reflect the same closed-state rules. |
Validation:

- All touched English/Russian document pairs passed structure/parity checks with matching line counts.
- Package AGENTS validation confirmed stale direct-Knex domain guidance was removed from the touched agent files.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m44.843s.
## 2026-03-14 Unified Database Access Standardization — Post-Closure Remediation Complete

Closed the final post-closure remediation wave that remained after the broader plan-completion audit. Repository truth showed only one live red test suite and one service-level fail-closed gap: `@universo/applications-backend` still had a stale sync-persistence spec that mocked pre-SQL-refactor transaction builders, and `MetahubObjectsService` still allowed delete/restore/permanent-delete mutations to succeed silently when zero rows were affected.
| Area | Resolution |
| --- | --- |
| Applications sync-persistence proof | `packages/applications-backend/base/src/tests/services/syncPersistenceStores.test.ts` now validates the live `SqlQueryable.query(...)` contract, including the schema-qualified SQL shape, `RETURNING id`, and exact parameter ordering for both persistence helpers. |
| Metahub object mutation hardening | `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` now constrains soft delete to active rows, restore to trash rows, and permanent delete to existing non-`_upl_deleted` rows; each mutation requires `RETURNING id` and throws when zero rows are touched. |
| Direct service-level regression proof | Added `packages/metahubs-backend/base/src/tests/services/MetahubObjectsService.test.ts` to prove delete, restore, permanent delete, and zero-row fail-closed behavior directly at the service layer. |
| Utils advisory-lock follow-up | Revalidated the previously suspected `@universo/utils` advisory-lock typing issue and confirmed it does not reproduce in current diagnostics or package tests, so no speculative code change was introduced. |
Validation:

- `@universo/applications-backend` lint passed and tests passed 84/84.
- `@universo/metahubs-backend` lint remained warning-only with no new errors, and tests passed 230/233 with 3 expected skips.
- `@universo/utils` advisory-lock tests remained green.
- `node tools/lint-db-access.mjs` passed with 0 violations.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Residual Debt Closure Complete

Closed the last residual debts that the final QA truth-check had reopened after the earlier closure claim. The remaining work was narrow but important: `applicationSyncRoutes.ts` still relied on direct Knex transport access behind a lint exclusion, and the shared metahub optimistic-lock helper still accepted raw dynamic SQL identifiers.
| Area | Resolution |
| --- | --- |
| Applications route boundary | Added `packages/applications-backend/base/src/ddl/index.ts` as the dedicated Tier 3 surface for application schema-sync transport acquisition, DDL service factories, and advisory locks; `applicationSyncRoutes.ts` now consumes that boundary instead of importing `Knex` / calling `getKnex()` directly. |
| Lint enforcement truthfulness | Removed the `applicationSyncRoutes.ts` exclusion from `tools/lint-db-access.mjs`; only the dedicated applications-backend DDL boundary remains excluded as a legitimate transport-owning surface. |
| Optimistic-lock helper safety | `packages/metahubs-backend/base/src/utils/optimisticLock.ts` now routes every dynamic update key through `qColumn(...)`, so malformed identifiers fail closed before any SQL update is constructed. |
| Direct regression proof | Added `packages/metahubs-backend/base/src/tests/utils/optimisticLock.test.ts` to prove quoted update-column generation and malformed identifier rejection; existing applications-backend route/seeding regressions stayed green after the boundary refactor. |
Validation:

- `node tools/lint-db-access.mjs` passed with 0 violations.
- `@universo/applications-backend` lint passed and focused route/seeding regressions passed 17/17.
- `@universo/metahubs-backend` lint remained warning-only with no new errors in the touched files, and focused helper/service regressions passed 9/9.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Final QA Closure Complete

Closed the reopened final QA wave for the Unified Database Access Standardization initiative. The earlier completion claim was incomplete; this closure adds the missing service-level soft-delete/active-row fixes, the remaining Phase 7 evidence, the missing Section 8 architecture docs, and a clean final acceptance run.
| Area | Resolution |
| --- | --- |
| Metahub hubs service | `MetahubHubsService` now enforces `_upl_deleted = false AND _mhb_deleted = false` across list/lookups/count/update prefetch, and delete uses metahub soft-delete metadata instead of hard delete. |
| Enumeration values service | `MetahubEnumerationValuesService` now fails closed on soft-deleted values for read/update/delete flows and preserves reorder normalization on the remaining active values. |
| Direct regression proof | New service-level tests prove the hubs and enumeration-values SQL contracts directly, closing the gap left by route tests that mocked the services. |
| Remaining Phase 7 evidence | Added binding-safety regression coverage, optional real-Postgres executor tests for pinned-connection claims / pool isolation / advisory-lock serialization, and auth-side RLS claim isolation tests. |
| Section 8 architecture docs | Added `docs/en/architecture/database-access-standard.md` plus the Russian counterpart, updated both `docs/*/SUMMARY.md`, and aligned the touched package READMEs with the unified access standard. |
Validation:

- `node tools/lint-db-access.mjs` passed with 0 violations.
- `@universo/metahubs-backend` lint ended warning-only and tests passed 222/225 with 3 expected skips.
- `@universo/database` lint ended warning-only and tests passed 112/121 with 9 expected skips.
- `@universo/auth-backend` lint ended warning-only and tests passed 8/8.
- `pnpm docs:i18n:check` passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Phases 1–4 + QA Remediation Complete

Implemented the Unified Database Access Standardization plan (Phases 1–4) plus a full QA Remediation Wave. Converted the backend from mixed KnexClient/Knex.Transaction usage to the canonical DbExecutor/SqlQueryable pattern for the covered domain surfaces. This milestone was later reopened by follow-up QA and fully closed in the later 2026-03-14 residual-debt entry above.

**Phase 1 (Foundation):** Created queryMany/queryOne/queryOneOrThrow typed query helpers in `@universo/utils/database`, safe identifier helpers (qSchemaTable) in `@universo/database`, advisory lock helpers, transaction helpers, getPoolExecutor factory, and lint enforcement script. 271 foundation tests passing.

**Phase 2 (Metahubs-backend):** Converted all 8 service constructors from KnexClient.getInstance() to DbExecutor injection. Updated 68 route handler constructor call sites. Rewrote 10+ copy transaction test stubs from Knex builder chains to SqlQueryable trx mocks. Fixed schema name validation in all test suites. Removed KnexClient from production code. 31/31 test suites (215 tests), 0 lint errors.

**Phase 3 (Applications-backend):** Converted ApplicationSchemaStateStore from KnexClient to getKnex(). 84/84 tests passing.

**Phase 4 (Auth/Core-backend):** Converted core-backend createKnexExecutor call sites to getPoolExecutor. All 4 backend packages build clean.

**QA Remediation Wave:** Addressed all 60 lint violations and 3 unfinished plan items. Created 6 DDL pool wrappers (acquirePoolAdvisoryLock, releasePoolAdvisoryLock, hasPoolRuntimeHistoryTable, createPoolTemplateSeedCleanupService, createPoolTemplateSeedMigrator, poolKnexTransaction). Migrated advisory locks in 5 route files. Converted publicationsRoutes.attachLayoutsToSnapshot and metahubMigrationsRoutes migration-list reads from Knex builder to raw SQL via getPoolExecutor. Fixed sets copy TOCTOU race condition (retry-inside-transaction pattern). Added RETURNING id to 3 batch copy INSERTs (catalogs elements, enumerations values, layouts widgets). Updated 11 test file DDL mocks. Deleted KnexClient deprecated wrapper.

**Validation:** lint-db-access 0 violations. 31/31 test suites (215 tests) metahubs-backend. 19/19 (214 tests) utils. 4/4 (57 tests) database. Full workspace build 27/27 packages successful.

This intermediate milestone was later extended through Phase 5 hardening, Phase 7 proof, Section 8 docs, and the final residual-debt closure. Only optional Phase 6 (materialized views) remains intentionally deferred.
## 2026-03-14 Unified Database Access Standardization — Plan Completion Audit Complete

Ran a final repository-level truthfulness audit against the implementation plan after all closure waves had already landed. The audit confirmed that the repository contains the required CI lint step, architecture docs, bilingual checklist pages, `getPoolExecutor()` rollout, and the dedicated applications-backend DDL boundary, so no additional mandatory implementation gap remained.
| Area | Outcome |
| --- | --- |
| Plan truthfulness | `memory-bank/plan/unified-database-standard-plan-2026-03-14.md` now reports the initiative as implemented instead of awaiting approval. |
| Status alignment | `tasks.md` and `activeContext.md` now describe the database-standard initiative as closed rather than reopened. |
| Scope confirmation | The only intentionally unimplemented item is optional Phase 6 (materialized views), which was already evaluated and deferred by the plan itself. |
Validation:

- Repository audit confirmed the expected implementation artifacts in code, docs, and CI.
- A fresh `node tools/lint-db-access.mjs` rerun still returned 0 violations after the status sync.
- No new source-code changes were needed beyond status/document truthfulness updates.
- The latest recorded acceptance remains `node tools/lint-db-access.mjs` = 0 violations and root `pnpm build` = 27/27 successful tasks.
## 2026-03-13 Metahub Frontend Regression Reopen Closure

Closed the metahub frontend regression reopen that surfaced after the earlier shared-table and hub-settings QA waves had already been marked complete. This narrow follow-through restored deep-view Settings continuity, hardened shared confirm delayed-render behavior for detached hub-entity creation, and brought optimistic publication row interaction feedback back to parity with the existing pending card path.
| Area | Resolution |
| --- | --- |
| Deep-view Settings continuity | `ElementList` now exposes hub Settings again, and `PublicationApplicationList` keeps publication Settings reachable from the applications subview by reusing the existing publication settings dialog flow. |
| Detached-create confirmation rendering | Shared `useConfirm` fallback timing now tolerates delayed dialog mount, and `ConfirmDialog` exposes an extra request-id marker so detached-create warnings no longer auto-cancel before the dialog renders. |
| Optimistic publication feedback parity | `FlowListTable` and `FlowListTableDnd` now intercept blocked pending-row interactions across custom row content, so optimistic publication rows show the same blocked-click glow/spinner feedback path as other optimistic entities. |
| Direct regression proof | `PublicationApplicationList.test.tsx` proves Settings stays reachable from the applications subview, `useConfirm.test.tsx` proves delayed dialog mount no longer auto-cancels early, and `FlowListTable.test.tsx` proves pending feedback can be triggered from custom row cells. |
Validation:

- `PublicationApplicationList.test.tsx` passed 3/3.
- Touched `@universo/template-mui` tests passed 6/6.
- Touched `@universo/template-mui` and `@universo/metahubs-frontend` lint runs ended warning-only with no errors.
- `@universo/template-mui` build passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-13 System App Migration Documentation

Created missing documentation for the system app migration lifecycle, schema update workflow, and CLI commands.
| Area | Work Done |
| --- | --- |
| Architecture page | `docs/en/architecture/system-app-migration-lifecycle.md` + RU translation. Covers bootstrap sequence, diff engine change types, migration storage JSON format, synthetic entity generation, ensure vs apply semantics, and the shared pipeline diagram. |
| Practical guide | `docs/en/guides/updating-system-app-schemas.md` + RU translation. Step-by-step instructions for adding, modifying, and removing fields/tables in SystemAppDefinition manifests. |
| admin-backend README | Added "Platform Schema Definition" section explaining the manifest-driven schema approach in both EN and RU READMEs. |
| migrations-platform README | Added "System App Schema Management" and "CLI Commands" sections in both EN and RU READMEs. |
| Navigation | Updated SUMMARY.md, guides/README.md, and architecture/README.md in both languages. |
## 2026-03-13 Optional Global Catalog QA Reopen Follow-Through Closure

Closed the residual debt left after the earlier optional global catalog QA closure was re-reviewed. This narrow reopen wave hardened public profile updates and deletes at the controller/store boundary, corrected runtime-origin release-bundle lineage to follow the actual installed release contract, and removed the touched local SQL identifier quoting fork.
| Area | Resolution |
| --- | --- |
| Profile public update/delete hardening | `PUT /profile/:userId` and `DELETE /profile/:userId` now fail closed for cross-user requests before RLS is reached, public update payloads reject unsupported fields, and persistence only updates an explicit allowlist of columns. |
| Direct regression proof | `profileController.test.ts` now proves cross-user update/delete rejection and malformed payload rejection, while `profileService.test.ts` proves unsupported fields never reach SQL update construction. |
| Runtime bundle lineage correctness | Runtime release-bundle export now chooses the incremental base snapshot from the installed release semantics: advancing from an installed release uses `releaseSchemaSnapshot`, while unchanged application-origin bundle re-exports keep stored `baseSchemaSnapshot` lineage. |
| Shared helper reuse | The touched runtime snapshot loaders now use `@universo/migrations-core` identifier helpers instead of a private regex-based `quoteIdentifier` implementation. |
Validation:

- `@universo/profile-backend` tests passed 25/25.
- `@universo/profile-backend` lint passed.
- `@universo/applications-backend` tests passed 84/84.
- `@universo/applications-backend` lint passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-13 Optional Global Catalog QA Follow-Through Closure

Closed the last open QA follow-through findings without reopening unrelated metahub or startup work. This wave hardened profile ownership end to end and upgraded application release bundles from checksum-protected snapshots to true lineage-aware incremental artifacts.
| Area | Resolution |
| --- | --- |
| Profile ownership security | `POST /profile` no longer trusts request-body `user_id`; controller logic now fails closed on cross-user attempts, and the profile INSERT policy is limited to `auth.uid() = user_id`. |
| Direct regression proof | `profileController.test.ts`, `platformMigrationsSecurity.test.ts`, and the touched profile service expectations now prove the self-only creation and delete-audit path directly. |
| Incremental release artifact contract | `application_release_bundle.incrementalMigration` now carries `baseSchemaSnapshot` plus a precomputed `diff`, and bundle validation recomputes that diff against the embedded target payload. |
| Release apply/export lineage | Application-origin export now requires trusted base-snapshot lineage, and upgrade apply rejects tracked-schema mismatches instead of recalculating opportunistic diffs from current target state. |
Validation:

- `@universo/profile-backend` tests passed 21/21.
- `@universo/profile-backend` lint passed.
- `@universo/applications-backend` tests passed 84/84.
- `@universo/applications-backend` lint passed.
- Final root `pnpm build` passed.
## 2026-03-13 Metahub QA Final Closure
## 2026-03-13 Metahub QA Shared-Table Final Reopen Closure

Closed the last remaining defect found by the post-closure QA pass in the metahub/shared-table slice. The residual issue was not the filtered render path anymore, but a deeper DnD contract mismatch: when callers supplied external `sortableItemIds`, the table could render rows in explicit column-sort order while `SortableContext` still kept the pre-sort external order.
| Area | Resolution |
| --- | --- |
| Shared table DnD ordering contract | `FlowListTable` now derives final `SortableContext` ids from the visible filtered/sorted row sequence and only uses external `sortableItemIds` as the allowed DnD membership set. |
| Direct proof | `FlowListTable.test.tsx` now proves `sortableItemIds + sortableRows + filterFunction + column sort`, asserting both the rendered DOM row order and the captured sortable item ids reorder together. |
| Final validation | The targeted shared-table Jest suite passed 4/4 again, `@universo/template-mui` lint returned to its pre-existing warning-only state with no new errors, and the final root `pnpm build` passed. |
Validation:

- `FlowListTable.test.tsx` passed 4/4.
- `@universo/template-mui` lint is warning-only with no errors.
- Root `pnpm build` passed.
## 2026-03-13 Metahub QA Final Closure

Closed the last QA-found debt in the metahub/shared-table slice after the earlier follow-up remediation wave had been marked complete too early. This final closure repaired the remaining `sortableRows` filtering contract in the shared table, aligned the backend query-builder helper with the branch-schema active-row contract, added direct regression proof for both, and removed the final package-local error-level lint blocker surfaced during revalidation.
| Area | Resolution |
| --- | --- |
| Shared table filtering contract | `FlowListTable` now filters the sorted row set before render, empty-state/header decisions, and sortable DnD id derivation when `sortableRows` is enabled. |
| Backend active-row consistency | `MetahubAttributesService.getAllAttributes(...)` now applies `_upl_deleted = false AND _mhb_deleted = false` before ordering. |
| Direct proof | `FlowListTable.test.tsx` now proves `filterFunction + sortableRows`, and `MetahubAttributesService.test.ts` now proves active-row filtering on the query-builder path. |
| Lint closure during revalidation | The remaining error-level Prettier failure in `@universo/template-mui` `src/hooks/optimisticCrud.ts` was cleared so package lint returned to warning-only status. |
Validation:

- `MetahubAttributesService.test.ts` passed 4/4.
- `FlowListTable.test.tsx` passed 4/4.
- `HubList.settingsReopen.test.tsx` passed 1/1.
- `@universo/template-mui` lint is warning-only with no errors.
- `@universo/metahubs-backend` lint remained warning-only on the touched validation pass.
- Root `pnpm build` passed.
## 2026-03-13 Metahub QA Follow-Up Remediation Closure

Closed the remaining debt left by the direct QA review of the metahub/shared-table refactor wave. This follow-up completed the missing branch-schema active-row filtering in hot attribute reads, added direct regression evidence for hub settings reopen and shared sortable-row behavior, and removed the shared Jest bootstrap blocker that had previously hidden the table-level proof.
| Area | Resolution |
| --- | --- |
| Runtime attribute read contract | `MetahubAttributesService` now applies `_upl_deleted = false AND _mhb_deleted = false` consistently across the remaining hot raw-SQL and query-builder read paths. |
| Hub settings reopen proof | `HubList.settingsReopen.test.tsx` now proves `HubList` reopens edit settings from one-shot router state and clears that state via replace navigation. |
| Shared table sorting proof | `FlowListTable.test.tsx` now proves explicit column sorting still reorders rows correctly when `sortableRows` is enabled. |
| Shared Jest bootstrap | `@universo/template-mui` no longer proxies all `.json` files through `identity-obj-proxy`, so dependencies like `ci-info/vendors.json` load correctly during package-local test execution. |
Validation:

- metahubs-backend focused regressions passed 77/80 with 3 expected skips;
- metahubs-frontend focused regressions passed 2/2;
- `@universo/template-mui` `FlowListTable` regression passed 3/3;
- touched package lint is error-free in `@universo/metahubs-backend` and `@universo/metahubs-frontend`;
- root `pnpm build` passed.
## 2026-03-13 Metahub Post-Refactor Regression Closure

Closed the four live metahub regressions that appeared after the global refactor. The failures were split across shared frontend infrastructure, hub-scoped navigation continuity, shared table behavior, and backend request-scoped SQL boundaries.
| Area | Resolution |
| --- | --- |
| Settings-tab continuity | `CatalogList`, `SetList`, and `EnumerationList` now expose the hub-scoped Settings tab again and navigate back through `HubList` state to reopen the hub settings dialog. |
| Warning confirmation flow | Redundant metahub-page `ConfirmContextProvider` wrappers were removed so page-level `useConfirm()` calls use the root dialog/provider pair mounted in the shared layout. |
| Attribute sorting | `FlowListTable` now keeps sortable headers active even when `sortableRows` is enabled and preserves DnD order until the user explicitly selects a sortable column. |
| Backend 500/pool exhaustion | Hot metahub read/count methods on the catalog and attribute page path now use `MetahubSchemaService.query(...)` instead of global Knex pool acquisition under RLS. |
| Type compatibility after raw SQL refactor | `MetahubObjectsService` now exposes an explicit compatible object-row contract again so routes and snapshot serializers do not collapse to `{}` after the service-level raw-SQL change. |
Validation:

- direct Vitest regression for `ChildAttributeList.optimisticCreate` passed 1/1;
- metahubs-backend route regressions for `attributesRoutes` and `catalogsRoutes` passed 37/37;
- touched package builds passed for `@universo/template-mui`, `@universo/metahubs-frontend`, and `@universo/metahubs-backend`;
- root `pnpm build` passed.
Residual validation note:

- the targeted `@universo/template-mui` Jest run for `FlowListTable.test.tsx` is currently blocked by an existing pre-test bootstrap failure in the shared Jest stack (`vendors.map is not a function` from `ci-info`), so package build plus downstream integration validation remains the current acceptance signal for that shared-table path.
## 2026-03-13 Repeated-Start Stability Closure

Closed the last live regression in fixed system-app repeated startup. The first clean bootstrap was already green, but the second startup failed because the fixed-system snapshot reader rejected a valid local snapshot shape that schema-ddl had written intentionally.
| Area | Resolution |
| --- | --- |
| Root cause | `readLatestSystemAppSnapshot` in `packages/universo-migrations-platform/base/src/systemAppSchemaCompiler.ts` incorrectly validated `snapshotAfter.entities` as an array. |
| Canonical contract | `SchemaSnapshot.entities` is a record/object map in `packages/schema-ddl/base/src/types.ts`, and the same shape is emitted by `packages/schema-ddl/base/src/snapshot.ts`. |
| Live failure mode | First startup wrote a valid local `_app_migrations` snapshot, but second startup rejected that valid snapshot as malformed and failed closed. |
| Regression debt | `systemAppSchemaCompiler.test.ts` still used stale array-shaped snapshot fixtures and outdated `applyAllChanges` expectations, so the suite stayed green while the live repeated-start path was broken. |
| Fix | The snapshot reader now accepts the canonical record-shaped payload, stale regressions were updated, and a dedicated repeated-start regression was added. |
Validation:

- `@universo/migrations-platform` full suite passed 105/105.
- Focused lint on the touched package passed.
- Touched package build passed.
- Root `pnpm build` passed.
- Second live `pnpm start` stayed healthy.
- `curl -I http://127.0.0.1:3000/` returned `HTTP/1.1 200 OK`.
Impact:

- Fixed application-like system apps now reuse valid local `_app_migrations` snapshots across repeated starts.
- Acceptance for future startup work in this area now requires a real second startup, not only focused compiler tests.
## Optional Global Catalog Final Integrity Closure COMPLETE (2026-03-13)

Closed the last integrity debt that remained after the renewed QA re-check. This wave fixed delete-cascade ordering, replaced existence-only startup shortcuts with canonical local-history-driven evolution, and hardened shared schema-ddl apply behavior for fixed-schema upgrades.
| Area | Resolution |
| --- | --- |
| Delete-cascade integrity | `deleteApplicationWithSchema(...)` now soft-deletes `rel_connector_publications` before `cat_connectors`, so active link rows cannot survive connector cleanup order. |
| Fixed-system evolution | `ensureRegisteredSystemAppSchemaGenerationPlans(...)` now reads canonical local `_app_migrations`, computes diff/apply through `SchemaMigrator`, and records real incremental migrations for drift. |
| Shared DDL safety | Recorded apply flows now preserve physical table/column names, explicit SQL defaults/types, capability-gated system tables, and explicit migration names. |
| Artifact hygiene | Accidental generated `.js`, `.d.ts`, and `.d.ts.map` files were removed from `@universo/migrations-core/src`, and package cleanup now removes the same patterns deterministically. |
Validation:

- applications-backend targeted regression passed 9/9.
- schema-ddl targeted regression passed 4/4.
- migrations-platform compiler regression passed 23/23.
- Touched package builds passed.
- Root `pnpm build` passed.
## Optional Global Catalog Strict QA Remediation COMPLETE (2026-03-13)

Closed the last two strict QA gaps in release-bundle provenance and Phase 8 executable evidence without reopening unrelated runtime paths.
| Area | Resolution |
| --- | --- |
| Snapshot provenance | Bundle validation now recomputes the embedded snapshot hash instead of trusting `manifest.snapshotHash`. |
| Trusted lineage seam | Install metadata and lineage persistence now flow through the recomputed canonical hash. |
| Phase 8 proof | Direct regressions now cover tampered snapshot hashes, nullable `globalRunId`, disabled-mode local history persistence, and enabled-mode fail-closed mirror aborts. |
| Operating mode safety | Disabled-mode local `_app_migrations` / `_mhb_migrations` history remains canonical, and enabled-mode failures still abort rather than degrading silently. |
Validation:

- applications-backend tests passed 82/82.
- applications-backend lint passed.
- targeted `MigrationManager.test.ts` passed.
- targeted `systemTableMigrator.test.ts` passed.
- applications-backend build passed.
- root `pnpm build` passed.
## Optional Global Catalog True Final Closure Wave COMPLETE (2026-03-13)

Release bundles now carry deterministic executable payloads for both bootstrap and incremental execution, and apply consumes those payloads directly.
| Area | Resolution |
| --- | --- |
| Executable artifact contract | Both `bootstrap` and `incrementalMigration` now embed deterministic executable payloads plus canonical schema snapshots. |
| Real execution path | Fresh installs execute from `bootstrap.payload.entities`; upgrades reconcile from `incrementalMigration.payload.entities`. |
| Fail-closed import | Corrupted executable artifact checksums now fail with `400 Invalid release bundle` before schema execution starts. |
| Persistence boundary | The central `installed_release_metadata` seam in `applications.cat_applications` remains unchanged. |
Validation:

- applications-backend tests passed 80/80.
- applications-backend lint passed.
- root `pnpm build` passed.
## Optional Global Catalog Final Debt Closure Wave COMPLETE (2026-03-13)

Closed the last ambiguous baseline-apply gap and added direct evidence for disabled-mode mirror behavior.
| Area | Resolution |
| --- | --- |
| Existing-schema guard | Baseline bundle apply now fails when a target already has `schema_name` but lacks trusted `installed_release_metadata`. |
| Fresh-install boundary | Fresh installs remain on the baseline/bootstrap path when no runtime schema exists. |
| Disabled-mode regression | `mirrorToGlobalCatalog(...)` now has direct regression proof that disabled mode returns `null` and performs no catalog writes. |
| Route-level fail-closed proof | Existing-schema/no-lineage bundle apply now fails before schema existence, diff, or apply execution begins. |
Validation:

- applications-backend tests passed 77/77.
- applications-backend lint passed.
- migrations-catalog tests passed 37/37.
- migrations-catalog lint passed.
- root `pnpm build` passed.
## Optional Global Catalog Final Closure Wave COMPLETE (2026-03-13)

Closed the last semantic gap in application-origin release-bundle export and verified the live runtime path from this workspace.
| Area | Resolution |
| --- | --- |
| Application-origin lineage | Runtime-origin export now preserves a real prior-version -> new-version transition for upgrade bundles. |
| Canonical runtime parity | Runtime export reconstructs top-level set constants and canonical snapshot data from `_app_*` metadata/data sources. |
| Executable proof | Direct regressions now cover runtime-origin upgrade apply, unchanged runtime re-export lineage reuse, and the baseline empty-install fast path. |
| Live smoke | Read-only SQL smoke, `pnpm migration:status`, and live `pnpm start` all succeeded from this workspace. |
Validation:

- applications-backend tests passed 76/76.
- applications-backend lint passed.
- root `pnpm build` passed.
- live `pnpm start` returned `pong` on `/api/v1/ping`.
## Optional Global Catalog Architecture Closure COMPLETE (2026-03-13)

The optional global catalog/runtime migration architecture is now closed across startup, runtime, CLI, and operator documentation.
| Area | Resolution |
| --- | --- |
| Shared helper adoption | Remaining raw `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` parsing was replaced with the shared `@universo/utils` helper. |
| Application-owned export | `@universo/applications-backend` can now export canonical release bundles directly from existing application runtime state. |
| Canonical local history | `_app_migrations` and `_mhb_migrations` remain canonical in disabled mode, while enabled mode remains fail-closed on mirror failure. |
| Operator docs | Mirrored English/Russian architecture docs were published and linked from the docs navigation with verified parity. |
Validation:

- utils, core-backend, applications-backend, and migrations-platform focused validation passed.
- touched lint passed on the relevant packages.
- root `pnpm build` passed.
## QA Remnant Fix Wave COMPLETE (2026-03-13)

Closed the last four findings from the comprehensive QA analysis without reopening unrelated architecture work.
| Area | Resolution |
| --- | --- |
| ApplicationSchemaStateStore | `.table('applications')` became `.table('cat_applications')` and active-row filtering now requires both `_upl_deleted = false` and `_app_deleted = false`. |
| Error-level formatting debt | Six Prettier failures in metahubs-backend were resolved on the touched path. |
| globalAccessService active-row safety | Three UPDATE statements and one SELECT gained `activeAppRowCondition()` filtering. |
| Dead code removal | The duplicate metahubs-side `ConnectorSyncTouchStore.ts` and its test were removed. |
Validation:

- metahubs-backend tests passed.
- admin-backend tests passed.
- touched lint is error-free.
- root `pnpm build` passed.
## QA Blocker Closure Wave COMPLETE (2026-03-13)

Closed the last reproducible red validation surfaces without weakening actual runtime contracts.
| Area | Resolution |
| --- | --- |
| Managed-owner validation | The failing migrations-core test now uses a canonical UUID; runtime validation remains strict. |
| Lint scope hygiene | `@universo/migrations-core` lint now ignores committed/generated `src/**/*.d.ts` output and evaluates real implementation sources. |
| schema-ddl touched lint debt | The remaining touched error-level formatting failure was removed from schema-ddl. |
| core-backend lint gate | A package-level lint script exists again and the touched error-level formatting debt is gone. |
Validation:

- migrations-core tests/lint passed.
- schema-ddl tests passed and lint is warning-only.
- core-backend tests passed and lint is warning-only.
- root `pnpm build` passed.
## Final QA Closure Wave COMPLETE (2026-03-13)

Closed the last repository-side gaps that the renewed QA pass found in the system-app completion program.
| Area | Resolution |
| --- | --- |
| Manifest-to-DDL parity | Profile `nickname` and admin role `codename` now cap validation at `VARCHAR(50)` parity, and shared tests assert that manifest `maxLength` never exceeds declared `VARCHAR(N)`. |
| Copy persistence coverage | applications-backend now has direct persistence regression coverage for `copyApplicationWithOptions(...)`, including copied-access guards and propagated failures. |
| Executable bootstrap proof | The core-backend publication-to-application acceptance regression now also asserts the fixed fresh-bootstrap contract for all application-like system schemas. |
| Architecture docs parity | Mirrored docs for fixed system-app convergence were published with verified English/Russian line parity. |
Validation:

- profile, admin, applications persistence, migrations-platform, and core-backend acceptance suites passed.
- applications-backend and migrations-platform lint are error-free.
- touched profile/admin/core lint is warning-only.
- root `pnpm build` passed.
## QA Closure Completion Wave COMPLETE (2026-03-13)

Closed the remaining operational debt around export lifecycle recording, browser env compatibility, dependency-aware drift detection, and managed owner-id hardening.
| Area | Resolution |
| --- | --- |
| Bundle export lifecycle parity | `@universo/migrations-platform` now records `definition_exports` rows for bundle-oriented catalog exports. |
| Browser env precedence | The browser env entry now resolves `__UNIVERSO_PUBLIC_ENV__` -> `import.meta.env` -> `process.env` -> browser origin, and `@universo/store` mirrors the same fallback. |
| Dependency-aware drift | `@universo/migrations-catalog` and `@universo/migrations-platform` now compare stable artifact payload signatures instead of SQL text alone. |
| Managed owner-id hardening | Managed schema names now accept only canonical UUID or 32-character lowercase hex owner ids. |
Validation:

- migrations-catalog tests passed 28/28.
- migrations-platform regressions passed 64/64.
- utils env tests passed 5/5.
- migrations-core identifier tests passed 8/8.
- touched lint/build passed.
- root `pnpm build` passed.
## Definition Lifecycle Closure Wave COMPLETE (2026-03-13)

The live DB/file definition lifecycle now runs through the real draft -> review -> publish contract instead of bypassing it in operational paths.
| Area | Resolution |
| --- | --- |
| Lifecycle-aware imports | `importDefinitions()` now creates drafts, requests review, and publishes when needed instead of bypassing lifecycle helpers. |
| Provenance repair | `registerDefinition()` now preserves or merges published lifecycle provenance for created, updated, and unchanged revisions. |
| No-op and doctor safety | Bulk lifecycle checks now require published provenance in addition to checksum/export parity, so pre-fix direct-import rows are repaired once. |
| File import semantics | Raw JSON imports are now persisted as file-sourced lifecycle imports. |
Validation:

- migrations-catalog tests passed 34/34.
- migrations-platform tests passed 98/98.
- touched lint/build passed.
- root `pnpm build` passed.
## QA Deep Remediation Wave 2 COMPLETE (2026-03-13)

The second deep QA pass closed the remaining cross-package dual-flag and cascade delete gaps.
| Area | Resolution |
| --- | --- |
| applicationQueriesStore dual-flag parity | Nine touched query helpers across applications catalog tables now use `activeAppRowCondition()`. |
| Metahub cascade delete ordering | `doc_publication_versions` now soft-delete before `doc_publications` in metahub cascade delete. |
| Publication delete ordering | Individual publication delete now also soft-deletes publication versions before the publication row. |
| Stats endpoint filtering | Touched inline stats queries now ignore deleted rows through active-row predicates. |
Validation:

- focused regressions passed in applications-backend and metahubs-backend.
- touched route/store assertions were updated.
- root `pnpm build` passed.
## QA Final Remediation Wave 1 COMPLETE (2026-03-13)

Closed the first final QA set of dual-flag and migration idempotency defects.
| Area | Resolution |
| --- | --- |
| Metahub cascade dual-flag | Child rows now receive both `_upl_deleted` and `_app_deleted` fields during cascade delete. |
| rolesStore active-row parity | `countUsersByRoleId()` and `listRoleUsers()` now use `activeAppRowCondition()`. |
| templatesStore active-row parity | `findTemplateById()` now filters on both `_upl_deleted = false` and `_app_deleted = false`. |
| Migration idempotency | Five bare `ALTER TABLE ADD CONSTRAINT` statements are wrapped with `IF NOT EXISTS` guards. |
Validation:

- focused admin-backend, metahubs-backend, and migrations-platform checks passed.
- regression tests were added or updated.
- root `pnpm build` passed.
## QA Follow-up Remediation Closure COMPLETE (2026-03-13)

Closed the follow-up QA issues found after the earlier cutover/build-green milestone.
| Area | Resolution |
| --- | --- |
| Memory-bank accuracy | tasks.md and activeContext.md were reopened and resynchronized with the real remediation state. |
| Auth/profile active-row safety | touched auth/profile read and update flows now require active rows and target the correct partial unique index. |
| Admin/profile active-row safety | `globalAccessService.ts` now uses the converged direct dual-flag predicate for the touched profile search/hydration paths. |
| Compensation-test stability | publication compensation tests now assert full cleanup behavior instead of brittle SQL call ordering. |
Validation:

- auth-backend lint/test passed.
- admin-backend lint/test passed.
- targeted metahubs-backend regressions passed.
- root `pnpm build` passed.
## QA-Discovered Store/Service Layer Fixes COMPLETE (2026-03-13)

Post-implementation QA showed that while DDL was converged, parts of the persistence layer still referenced pre-convergence columns and single-flag delete logic.
| Area | Resolution |
| --- | --- |
| Column-name convergence | Touched admin/profile/app stores, services, routes, and frontend types now use `_upl_created_at` / `_upl_updated_at` instead of stale names. |
| Dual-flag active-row parity | Touched SQL paths now use `activeAppRowCondition()` instead of `_upl_deleted = false` alone. |
| Soft-delete parity | The profile delete path now uses `softDeleteSetClause()` instead of physical `DELETE FROM`. |
| Shared helper exposure | The root `@universo/utils` barrel now exports the canonical touched helper surface. |
Validation:

- touched files across backend, frontend, shared utils, and tests were updated.
- contract regressions were aligned.
- root `pnpm build` passed 27/27.
## Ownership And Validation Closure Wave COMPLETE (2026-03-12)

Closed the final post-QA implementation debt around publication/runtime sync ownership, repeatable backend tests, and live startup HTTP serving.
| Area | Resolution |
| --- | --- |
| Publication/runtime seam | metahubs-backend now exposes only publication runtime source loading; applications-backend owns application sync-context adaptation; core-backend composes the seam. |
| Repeatable backend tests | A shared Jest wrapper now forwards CLI args correctly for backend package test runs. |
| Live startup behavior | `pnpm start` now completes bootstrap successfully and the workspace serves HTTP on port 3000. |
| Final validation | Focused backend/platform validation and the root build are green. |
## QA Debt Closure Wave COMPLETE (2026-03-12)

Revalidated the previously reported debt and fixed only the still-real residual issues.
| Area | Resolution |
| --- | --- |
| QA revalidation | The earlier suspected compiler blocker no longer reproduced, so this wave stayed focused on real remaining debt. |
| SQL row-shape hardening | Touched admin/profile stores now use explicit `RETURNING column_list` contracts instead of `RETURNING *`. |
| Soft-delete and cleanup parity | Admin revocation and metahub compensation cleanup now follow the converged soft-delete contract. |
| Frontend tooling cleanup | The shared MUI template SCSS entrypoint now uses Sass `@use` instead of deprecated `@import`. |
Validation:

- targeted backend validation passed.
- touched frontend tooling remained green.
- root `pnpm build` passed.
## System-App Definition Cutover And QA Closure COMPLETE (2026-03-12)

Fixed application-like system apps now bootstrap through definition-driven schema-ddl plans, while phased support migrations keep only auxiliary setup that schema-ddl does not express.
| Area | Resolution |
| --- | --- |
| Bootstrap source of truth | applications, profile, admin, and metahubs now create/sync business tables through registered schema generation plans. |
| Manifest cleanup | Active fixed-system manifest chains now keep phased support migrations plus required auxiliary setup only. |
| Predicate/security convergence | Touched cross-schema joins and runtime routes now use direct dual-flag active-row predicates, and touched `SECURITY DEFINER` helpers now enforce deterministic execute privileges. |
| Regression coverage | Registry, compiler, startup orchestration, manifest parity, soft-delete parity, and security tests were aligned with the definition-driven path. |
Validation:

- focused migrations-platform, core-backend, profile-backend, admin-backend, applications-backend, and metahubs-backend suites passed.
- root `pnpm build` passed.
## Startup Runtime Regression Remediation COMPLETE (2026-03-13)

Closed the repeated-start performance and no-op regression discovered after the structural convergence rollout.
| Area | Resolution |
| --- | --- |
| Metadata fast path | `systemAppSchemaCompiler` now skips fixed metadata sync when the live metadata fingerprint already matches the compiled target state. |
| Drift recovery | The previous bootstrap path remains the fallback whenever tables, metadata rows, or fingerprints drift. |
| Catalog fast path | Bulk registry/export preflight now skips `registerDefinition()` and export-row writes for unchanged artifacts on repeated startup. |
| Regression coverage | Focused tests prove no-op startup behavior and drift fallback on both the metadata and catalog sides. |
Validation:

- focused migrations-platform/core-backend validation passed.
- root `pnpm build` passed.
## Frontend Acceptance Coverage Burst COMPLETE (2026-03-12)

Page-level acceptance coverage now exists across the main user-facing CRUD, navigation, sync, and migration-guard flows.
| Area | Resolution |
| --- | --- |
| CRUD/list coverage | Application, metahub, connector, and publication pages now prove create/edit/copy/delete payload routing through existing shells. |
| Navigation coverage | Connector detail navigation, application control-panel navigation, and publication-linked application entry flows are covered directly. |
| Sync coverage | Connector/publication diff dialogs, sync mutations, `ConnectorBoard`, `PublicationList`, and `MetahubMigrations` all have direct user-facing acceptance proof. |
| Guard coverage | `ApplicationMigrationGuard` and `MetahubMigrationGuard` now have route-level and interactive acceptance coverage for the real user-visible states. |
Validation:

- focused ESLint/Vitest/build checks passed for the touched frontend packages.
- standalone package builds passed on the touched slices.
- root `pnpm build` passed.
## Fixed-System Metadata, Legacy-Reconciliation, and Compiler Foundation Burst COMPLETE (2026-03-12)

The safety and metadata foundations for converged fixed system apps are now in place.
| Area | Resolution |
| --- | --- |
| Metadata observability | Fixed-system bootstrap now reports object and attribute counts, and CLI entry points expose the same bootstrap path. |
| Doctor/startup gates | Platform doctor, sync, and startup now fail fast on incomplete fixed-system metadata or leftover legacy fixed-schema table names. |
| Legacy reconciliation | Forward-only reconciliation bridges now rename or merge legacy profile, admin, applications, and metahubs fixed tables into the converged application-like model. |
| Compiler metadata preservation | Compiled object/attribute artifacts and validation gates now preserve explicit manifest metadata and relation targets. |
Validation:

- focused platform/backend regressions passed.
- standalone package builds on the touched slices passed.
- root `pnpm build` passed.
## Registry and Master-Plan Foundation Burst COMPLETE (2026-03-11)

The registry, lifecycle, and ownership foundations that later waves built on were completed earlier in the session and remain relevant.
| Area | Resolution |
| --- | --- |
| Runtime sync ownership | Application runtime sync routes are application-owned, with metahubs-backend providing publication context only. |
| Definition lifecycle | Draft/review/publish/export/import flows, approval-event persistence, and canonical bundle behavior are real operational contracts. |
| Doctor/bootstrap visibility | Startup and doctor report missing lifecycle/export state explicitly instead of relying on silent assumptions. |
| Shared schema naming | Managed application and metahub schema naming moved to shared helpers, removing local builder drift. |
Validation:

- focused migrations-catalog, migrations-platform, applications-backend, metahubs-backend, and core-backend validation passed across the relevant waves.
- root workspace validation finished green on the associated closure waves.
## Older 2026-03-11 to 2026-03-12 Detail Condensed

The older sections from this same implementation cluster were intentionally compressed into the grouped entries above to keep the file within an operational size range while preserving the critical delivered outcomes:

- fixed-system convergence implementation and QA remediation,
- publication/runtime sync ownership transfer,
- registry lifecycle and export recording hardening,
- metadata bootstrap observability and fail-fast gates,
- legacy fixed-schema reconciliation,
- frontend acceptance coverage expansion,
- repeated-start no-op optimization,
- copy/runtime/persistence regression hardening.

Use tasks.md for checklist-oriented summaries and systemPatterns.md for reusable implementation rules. This file keeps the durable outcome record only.
## Fixed-System Compiler Metadata Expansion Burst COMPLETE (2026-03-12)

Before the final repeated-start and convergence closures, the fixed-system compiler pipeline was expanded so `_app_objects` / `_app_attributes` bootstrap no longer depended on thin synthetic defaults alone.
| Area | Resolution |
| --- | --- |
| Rich manifest metadata | Fixed-system manifests now support explicit table presentation, field presentation, validation rules, and UI config on stable business metadata. |
| Remaining manifest expansion | admin, applications, and metahubs now declare richer business metadata and targeted internal REF metadata instead of leaving those details implicit. |
| Compiled artifact integrity | `system_app_compiled.*` now includes deterministic object and attribute artifacts, and validation rejects dropped or malformed metadata. |
| Relation target preservation | Internal REF target metadata now survives into compiler entities and compiled attribute artifacts for fixed system apps. |
| Standalone build hygiene | touched migration packages now resolve workspace dependencies from source when neighbor `dist` output is absent. |
Validation: focused migrations-core/platform plus owner-package backend validation passed, standalone touched-package builds passed, and root `pnpm build` stayed green.
## Legacy Safety and Doctor Gates Burst COMPLETE (2026-03-12)

The platform now fails fast when fixed-system bootstrap or reconciliation leaves the database in an incomplete or mixed physical state.
| Area | Resolution |
| --- | --- |
| Metadata completeness gate | platform doctor, sync, and startup now inspect required `_app_objects` and `_app_attributes` rows for registered fixed system apps. |
| Legacy physical-model gate | startup and doctor now reject leftover legacy fixed-schema table names after reconciliation/bootstrap instead of silently continuing. |
| Forward-only reconciliation bridges | profile, admin, applications, and metahubs fixed schemas now have deterministic forward-only rename/merge bridges into the converged application-like model. |
| CLI/bootstrap observability | fixed-system bootstrap reports object and attribute counts directly and is available through both platform and backend CLI surfaces. |
| Startup failure semantics | startup stops before later sync/doctor assumptions if metadata or physical-table invariants are still broken. |
Validation: focused migrations-platform/core-backend validation plus touched backend regression coverage passed, standalone touched-package builds passed, and root `pnpm build` stayed green.
## Registry + Validation Foundations COMPLETE (2026-03-11 to 2026-03-13)

Earlier 2026-03-11 lifecycle hardening and later 2026-03-13 validation-posture work were intentionally grouped here because they now act as one shared foundation for future reopen decisions.
| Area | Resolution |
| --- | --- |
| Lifecycle governance | Draft/review/publish/export flows, export dedupe, and approval-event persistence are real operational contracts backed by database uniqueness and focused regression coverage. |
| Runtime ownership boundary | Application runtime sync remains application-owned, with metahubs-backend limited to publication runtime context. |
| Doctor/bootstrap health | Registry/export/lifecycle drift is surfaced explicitly instead of being treated as an implicit clean state. |
| Acceptance posture | Startup-sensitive work now requires focused validation plus live second-start/HTTP checks where relevant, and closure claims still end with touched package validation plus a final root `pnpm build`. |
| Fail-closed rule | Malformed snapshot history, ambiguous release lineage, and enabled-mode catalog failures must stay fail-closed instead of silently degrading. |
Validation: focused migrations-catalog/platform, applications-backend, metahubs-backend, and core-backend validation passed across the source waves, and root workspace validation stayed green.
