# Tasks
> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## PR #731 Bot Review Closure — 2026-03-19
- Status: COMPLETE
- [x] PR731-1: Review every bot comment from PR #731 against the live code and accept only the changes that are technically justified and safe
- [x] PR731-2: Restore stable declaration-based path mapping for `@universo/applications-backend` in `metahubs-backend` for Node16/exports consistency
- [x] PR731-3: Keep the application `Settings` menu item visible in a disabled/loading state until application detail resolves, and hide it only after a definitive `schemaName = null`
- [x] PR731-4: Add/update focused regressions and rerun touched validation without changing purely stylistic or false-positive review suggestions
  - Note: focused `@universo/template-mui` tests passed (3/3), `@universo/template-mui` build passed, `@universo/metahubs-backend` build passed, `@universo/template-mui` lint stayed green apart from pre-existing warning-only debt outside this change-set, and the final root `pnpm build` passed with 28/28 successful tasks.
  - Accepted bot comments: `metahubs-backend` declaration path mapping and `application-settings` loading/visibility behavior in `MenuContent`.
  - Rejected bot comments: false-positive `UUID_REGEX` warning and two style-only suggestions that did not improve correctness or safety.

---

## Application Workspace QA Closure — Tabular Copy, Docs/Plan Sync, And Seed Regression — 2026-03-19
- Status: COMPLETE
- [x] QW1: Fix the runtime tabular child-row copy permission seam so copy requires create-capability instead of delete-capability
- [x] QW2: Synchronize the published application role matrix and related package docs with the implemented backend permission contract
- [x] QW3: Bring the workspace/public-access implementation plan artifact into its final completed state so it no longer advertises stale unchecked work
- [x] QW4: Add a deeper regression around workspace seed propagation/runtime lifecycle and rerun touched lint/tests/build validation
  - Note: focused backend route/service regressions passed (44/44), the full `@universo/applications-backend` suite passed (10/10 suites, 108/108 tests), `@universo/applications-backend` lint passed, `@universo/applications-frontend` lint stayed green, standalone `@universo/applications-backend` build passed after dependency rebuild, and the final root `pnpm build` completed green with 28/28 successful tasks.

---

## Auth Start Spacing, Application Shell Refresh, Runtime Access, And Limit Banner Closure — 2026-03-19
- Status: COMPLETE
- [x] AS1: Remove the extra authenticated mobile start-page top gap without regressing the already-correct desktop guest/authenticated layouts
- [x] AS2: Stop application admin entry clicks from falling through to runtime navigation and restore stable `/a/:applicationId/admin` access from the application list action menu
- [x] AS3: Align application admin-shell refresh behavior so breadcrumbs and `Settings` stop degrading to `...` / hidden state on cold admin-board reloads
- [x] AS4: Move runtime workspace-limit messaging into the centered dashboard content area, add member action icons, and restore ordinary-member runtime access after `Join`
- [x] AS5: Add/update focused regressions, rerun touched tests/lint/build checks, and sync memory-bank closure state
  - Note: focused `@universo/start-frontend` tests passed (21/21), focused `@universo/applications-backend` route tests passed (40/40), focused `@universo/applications-frontend` suites passed (24/24 files, 117/117 tests), `@universo/template-mui` tests/build passed, `@universo/applications-backend` lint/build passed, `@universo/applications-frontend` lint passed, and `@universo/core-frontend` build passed.

---

## Start Page Header Offset And Mobile Onboarding Progress Closure — 2026-03-19
- Status: COMPLETE
- [x] SP1: Remove the shared fixed-header spacer for guest start pages while preserving the authenticated start/onboarding offset
- [x] SP2: Replace the hidden mobile onboarding stepper gap with a compact responsive mobile progress pattern
- [x] SP3: Rename the final onboarding step label from `Completion` / `Завершение` to `Acting` / `Действуем`
- [x] SP4: Add/update focused tests, rerun touched builds, and sync memory-bank closure state
  - Note: focused `@universo/start-frontend` tests passed (21/21), `@universo/template-mui` build passed, and `@universo/core-frontend` build passed after rebuilding shared artifacts in dependency order.

---

## Publications Refresh, Workspace DDL, And Application Admin Route Reopen Closure — 2026-03-19
- Status: COMPLETE
- [x] PR1: Harden metahub/application breadcrumb detail loading on hard refresh so publication/admin paths stop falling back to `...` after a cold reload
- [x] PR2: Remove the multi-statement workspace policy recreation pattern from runtime DDL so publication-linked schema generation no longer trips the executor/statement-timeout seam
- [x] PR3: Restore application admin routing precedence so `Control panel` resolves to `/a/:applicationId/admin` instead of being captured by the runtime route
- [x] PR4: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state
  - Note: focused `template-mui` tests passed, focused `applications-backend` tests passed (41/41), `metahubs-backend` publication-route tests passed (4/4) after the full workspace rebuild, `@universo/core-frontend` build passed, and the final root `pnpm build` completed green with 28/28 successful tasks.

---

## Application Workspaces UX, Breadcrumbs, Seed Data, And Limits Closure — 2026-03-19
- Status: COMPLETE
- [x] W1: Fix metahub/application breadcrumb and admin-menu refresh behavior so publications/settings resolve correctly on hard reload
- [x] W2: Refine application settings UX for pre-schema limits availability and localized catalog/codename rendering
- [x] W3: Rename runtime limits storage to `_app_limits` with forward-compatible scope/metric/period fields and keep current workspace-row limits working
- [x] W4: Seed predefined metahub catalog elements into each personal workspace instead of leaving workspace-less rows in workspace-enabled runtimes
- [x] W5: Tighten runtime limit UX so the create action closes immediately when the limit is reached instead of only failing on submit
- [x] W6: Add/update focused regressions, rerun touched lint/tests/builds, and sync memory-bank closure state
  - Note: touched lint/test/build validation passed for `@universo/applications-backend`, `@universo/applications-frontend`, `@universo/apps-template-mui`, and `@universo/template-mui`, and the final root `pnpm build` completed green with 28/28 successful tasks.

---

## Application Admin Surface And Runtime Role Enforcement Closure — 2026-03-19
- Status: COMPLETE
- [x] S1: Restrict application admin metadata routes (`members`, connector metadata, connector publications, sync) to real application admins/owners instead of plain membership
- [x] S2: Enforce runtime row/content mutations against published role permissions so `editor` can no longer delete content outside its contract
- [x] S3: Fail closed for public non-members by returning an explicit no-permissions surface until membership exists
- [x] S4: Stabilize the full `@universo/applications-frontend` package suite and keep the real shell/runtime route validation green
- [x] S5: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state

---

## Application Public Runtime Guard And Permission Contract Closure — 2026-03-19
- Status: COMPLETE
- [x] G1: Protect the real `/a/:applicationId/*` runtime route with `ApplicationGuard` so public non-members cannot bypass the intended join flow via direct URL access
- [x] G2: Remove the remaining table-view direct runtime link for public non-members and keep `Join` as the only entry point before membership exists
- [x] G3: Align the published `member` permission contract with the implemented workspace-scoped runtime CRUD capabilities and update package documentation
- [x] G4: Stabilize the full `@universo/applications-frontend` package test run under coverage and add regression coverage for the table-view public non-member state
- [x] G5: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state

---

## Application Workspaces + Public Access + Limits Implementation — 2026-03-19
- Status: COMPLETE
- [x] I1: Extend applications system schema, DTOs, contracts, and immutable create/copy/update behavior for `isPublic` + `workspacesEnabled`
- [x] I2: Refactor application list/detail/member access semantics for explicit membership state, public discovery, and safe guard split
- [x] I3: Implement runtime workspace subsystem DDL, canonical snapshot/release-lineage integration, and first-sync/member bootstrap
- [x] I4: Implement runtime access resolution, workspace-scoped CRUD, child-table enforcement, and per-workspace limits backend
- [x] I5: Implement public join/leave and member add/remove lifecycle with personal workspace archive semantics
- [x] I6: Implement applications frontend create/edit/copy parameter tabs, public join/leave UX, settings navigation, and limits/settings UI
- [x] I7: Add/update i18n, shared query contracts, tests, package docs, GitBook docs, and final validation

---

## Application Public Access Reopen Closure — 2026-03-19
- Status: COMPLETE
- [x] A1: Restore correct top offset for authenticated start-page content under the fixed start app bar in desktop layout
- [x] A2: Remove synthetic application-admin access for ordinary global `applications:read` users so public apps remain join/use-only until membership exists
- [x] A3: Add regression coverage for read-only public app list semantics and member-safe frontend actions, then rerun touched lint/tests/builds plus final root build

---

## Application Workspaces QA Remediation — 2026-03-19
- Status: COMPLETE
- [x] R1: Rebuild `applications` RLS policies for create/public/member/admin flows so request-scoped RLS execution matches the implemented routes
- [x] R2: Enforce single-owner semantics in application copy flows when `copyAccess=true`
- [x] R3: Make workspace limit bulk updates atomic and fail-closed
- [x] R4: Strengthen runtime workspace integrity and add focused regression coverage for the new risk areas
- [x] R5: Re-run targeted lint/tests/builds, then update memory-bank closure state

---

## Application Workspaces QA Follow-Up Closure — 2026-03-19
- Status: COMPLETE
- [x] F1: Fix applications edit flow so immutable parameters remain visible but are never sent in update payloads
- [x] F2: Extend workspace leave/remove lifecycle to soft-delete workspace-scoped business rows before archiving the personal workspace
- [x] F3: Tighten settings UX so `Limits` only appears when runtime schema + workspace mode are actually available
- [x] F4: Add regression coverage for edit payload contract, workspace business-row archival, and settings gating
- [x] F5: Re-run touched lint/tests/builds, then update memory-bank closure state

---

## Application/Publications Create Flow Remediation — 2026-03-19
- Status: COMPLETE
- [x] P1: Remove the hard backend invariant `public => workspaces` from application create/copy flows and keep UI guidance instead of a silent submit blocker
- [x] P2: Extend publication auto-create and publication-linked application creation contracts to accept visibility/workspace parameters end-to-end
- [x] P3: Align standalone and publication-linked create dialogs with the shared parameter UX, including spacing, immutable info alerts, and public-without-workspaces warning
- [x] P4: Add/update focused regression coverage for standalone create and publication create flows, then rerun touched lint/tests/builds
  - Note: Focused validations passed with `applications-backend` route tests, direct `vitest` runs for `ApplicationList` and publication application flows, touched package lint runs (warning-only residual debt in `metahubs-*`), and a final green root `pnpm build` (`28 successful, 28 total`).

---

## Application Workspaces Final Closure — 2026-03-19
- Status: COMPLETE
- [x] FC1: Fix metapanel application copy text and publication/application schema generation regressions found during manual runtime verification
- [x] FC2: Remove prepared-statement-incompatible workspace DDL helper pattern and qualify connector-publication soft-delete updates
- [x] FC3: Make application admin `Settings` menu obey runtime-schema availability instead of showing a dead-end entry up front
- [x] FC4: Add focused regression coverage for menu gating and rerun touched lint/tests/builds
  - Note: the real `@universo/template-mui` dashboard shell now gates the menu entry from cached application detail, focused `MenuContent` / menu-config tests passed, and the final root `pnpm build` completed green with 28/28 successful tasks.

---

## QA Comprehensive Fix — 2026-03-19
- Status: COMPLETE
- [x] C1: Fix LIKE wildcard injection in `globalAccessService.ts` (~L408) and `instancesStore.ts` (~L50)
- [x] C2: Add UUID validation to `globalUsersRoutes.ts` (3 routes) and `rolesRoutes.ts` copy route
- [x] C3: Fix MetapanelDashboard.test.tsx mock to include `buildRealisticTrendData`
- [x] C4: Dashboard API access review (by-design, no change needed)
- [x] H1: Wrap create/update role routes in `exec.transaction()` in rolesRoutes.ts
- [x] H2: Remove 10 `console.log` debug statements from ensureGlobalAccess.ts
- [x] H3: Use `React.useId()` for StatCard gradient ID instead of `value`
- [x] H5: Replace `axios.create()` with `createAuthClient()` in metapanel-frontend/api/dashboard.ts
- [x] H6: Move setState during render to useEffect in RoleEdit.tsx
- [x] H7: Extract `EMPTY_ROLE_IDS` constant in UserFormDialog.tsx
- [x] H8: Replace `baseActions[1]` with `.find()` in RoleActions.tsx
- [x] H9: Truncate codename to fit 50 char limit in copy action
- [x] H10: Use current locale instead of hardcoded 'en' in RoleActions.tsx
- [x] Fix test failures caused by UUID validation and transaction changes
- [x] Validate: lint 0 errors, admin-backend 34/34 tests, admin-frontend 13/13 tests, metapanel-frontend 1/1 test, full build 28/28

---

## PR #729 Bot Review Fixes — 2026-03-19
- Status: COMPLETE
- [x] Fix `buildRealisticTrendData()` NaN/Infinity guard for `points <= 1` in `StatCard.tsx`
- [x] Fix `OnboardingWizard.tsx` CTA disabled state when `onComplete` is undefined
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in `CreateRoleSchema`, `UpdateRoleSchema` (schemas/index.ts)
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in `CopyRoleSchema` (rolesRoutes.ts)
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in frontend `RoleFormDialog.tsx`
- [x] Validate: all lint 0 errors, RoleFormDialog 6/6 tests pass, full root build 28/28 in 3m4s
- [x] Push updated commit to PR #729 branch

---

## QA Closure — Post-Implementation Fixes — 2026-03-19
- Status: COMPLETE
- [x] Remove redundant `.default(true)` from `includeSystem` in `admin-backend/rolesRoutes.ts` — preprocess already handles `undefined → true`
- [x] Add `notifySubscribers({})` to `resetUserSettingsCache()` in `useUserSettings.ts` — ensures active hook instances receive reset notification instead of holding stale state
- [x] Validate: admin-backend lint 0 errors, 34/34 tests; template-mui build OK; full root build 28/28 in 2m56s

---

## Fix Superuser Metahub Visibility (showAll query param) — 2026-03-18
- Status: COMPLETE
- [x] Root-cause: `z.coerce.boolean()` in query param schemas treats string `"false"` as `Boolean("false")===true` — superuser always sees all metahubs regardless of settings toggle
- [x] Fix `queryParams.ts` in metahubs-backend, applications-backend, admin-backend: replace `z.coerce.boolean()` with `z.preprocess()` that correctly maps `"true"`→true, `"false"`→false
- [x] Add regression test: superuser with `showAll=false` query param should pass `showAll: false` to store
- [x] Validate: metahubs-backend 38/38 test suites, 254/254 tests passed; full root build 28/28 in 3m11s

---

## Admin Padding + Metahub Cache/Creation Fixes — 2026-03-18
- Status: COMPLETE
- [x] Fix RoleEdit padding: removed extra `px` from header section Stack so all elements have consistent MainLayout-level padding
- [x] Fix stale cache on login/logout: added `useEffect` in App.tsx that watches auth user identity and clears React Query cache + user-settings singleton when user changes (login/logout/switch)
- [x] Fix metahub creation cleanup: replaced soft-delete with hard `DELETE FROM metahubs.cat_metahubs` when initial-branch creation fails, preventing zombie metahub rows without branches/schemas
- [x] Validate all changes: admin-frontend lint 0 errors, 13/13 tests; metahubs-backend lint 0 errors, 35/35 tests; start-frontend 20/20 tests; full root `pnpm build` 28/28 tasks in 3m13.772s
- [x] Update memory-bank (activeContext, progress)

---

## Admin UX & Metahub Access Corrections — 2026-03-18
- Status: COMPLETE
- [x] Fix role detail header side inset so title/description align visually with the permissions section below
- [x] Restore fully localized role-create dialog wording and remove English fallback exposure in the create flow
- [x] Auto-generate role codename from the localized role name in create dialogs without breaking edit/copy defaults
- [x] Remove the `publications` permission subject from the shared admin role configuration and update role-permissions labels accordingly
- [x] Fix admin users create-dialog title/spacing and compact user-card role rendering to one role plus overflow count
- [x] Restrict metahub cross-user visibility to superusers only when `showAllItems` is enabled, and remove the generic `metahubs:read` bypass from backend access guards
- [x] Run touched validation, then resync `activeContext.md` and `progress.md`
  - Note: `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 12/12 tests, `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubsRoutes.test.ts` passed with 35/35 active tests, and the final root `pnpm build` passed with 28/28 successful tasks in 3m28.542s.

## UX Corrections Wave 3 — QA Fixes — 2026-03-18
- Status: COMPLETE
- [x] Fix AuthenticatedStartPage test: expect `navigate('/', { replace: true })` for registered-only users (architecture: HomeRouteResolver handles routing)
- [x] Fix OnboardingWizard prettier: collapse CompletionStep JSX to single line
- [x] Fix RoleEdit, RoleFormDialog, AdminBoard, LocalesList, RoleActions prettier formatting (ran `prettier --write`)
- [x] Fix RoleFormDialog copy test: `initialCodename` is now `'editor_copy'` (matches auto-generated codename from Wave 2)
- [x] Fix RoleFormDialog validate stale closure: added `isSuperuser, showIsSuperuser` to useCallback deps
- [x] Fix BaseEntityMenu onSubmit wrapper: added try-catch so dialog stays open on error, prevents unhandled rejection
- [x] Fix LocalesList warning: wrapped `data?.items || []` in useMemo to stabilize reference
- [x] Full validation: start-frontend 18/18 tests, admin-frontend 7/7 tests, all lint clean (0 errors), full build 28/28 (2m23s)

## UX Corrections Wave 4 — 2026-03-18
- Status: COMPLETE
- [x] Fix CompletionStep revisit layout so the completion buttons keep the canonical left/right order outside the wizard shell
  - Note: `CompletionStep` now renders `Start over` on the left and the primary action on the right with `justifyContent='space-between'`.
- [x] Remove extra side padding from admin role detail informational blocks
  - Note: `RoleEdit` now aligns the view header, back action, alert, and main content flush with the page layout instead of wrapping them in extra horizontal boxes.
- [x] Restore standard Locales page side padding and shorten the create CTA label
  - Note: `LocalesList` header now matches the table gutter and the create action uses `Create` / `Создать`.
- [x] Shorten the Users create CTA label to the shared `Create` wording
  - Note: both i18n values and `InstanceUsers` fallback strings now use the shorter label consistently.
- [x] Narrow UserFormDialog and increase action-area padding to match the role dialog contract
  - Note: the dialog now uses `maxWidth='sm'`, `DialogContent` top padding parity, and `DialogActions sx={{ p: 3, pt: 2 }}`.
- [x] Replace the UserFormDialog roles tab with the catalog-style entity selection panel
  - Note: the old autocomplete/chip legacy UI was removed; the roles tab now uses `EntitySelectionPanel` with localized labels and stable workspace-build-safe props.
- [x] Full validation: `@universo/admin-frontend` lint, `@universo/template-mui` build, admin-frontend tests 7/7, start-frontend tests 18/18, root `pnpm build` 28/28 (3m3.03s)

## UX Corrections Wave 4 — QA Follow-Through — 2026-03-18
- Status: COMPLETE
- [x] Remove the remaining EntitySelectionPanel type workaround from `UserFormDialog` and replace it with a stable package-level typing/export contract
  - Note: `UserFormDialog` now derives the labels type from `ComponentProps<typeof EntitySelectionPanel>['labels']`, avoids the unavailable root type export, and keeps the explicit optional props required by the current `@universo/template-mui` declaration contract so root builds stay green.
- [x] Add direct regression coverage for `UserFormDialog` create/edit behavior and role-tab validation instead of only mocking the dialog from `InstanceUsers`
  - Note: the regression coverage is now anchored at the pure `validateUserFormDialog(...)` contract, which directly proves create/edit payload trimming, missing-role routing to the roles tab, short-password handling, and edit-mode email preservation without relying on fragile dialog-portal internals.
- [x] Add direct regression coverage for the completion-step action contract so CTA order/availability and loading/error states are pinned in tests
  - Note: `CompletionStep.test.tsx` now verifies left/right CTA order, callback dispatch, primary-only rendering, loading disablement, and error visibility.
- [x] Re-run touched validation and final root build, then resync memory-bank closure state
  - Note: `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 11/11 tests, `pnpm --filter @universo/start-frontend test` passed with 5/5 files and 20/20 tests, and the final root `pnpm build` passed successfully.

## UX Corrections Wave 3 — 2026-03-18
- Status: COMPLETE
- [x] Onboarding last page: "Начать сначала" left, "Начать действовать" right, no "Назад" on last step
  - Note: Removed onPrimaryAction from CompletionStep in wizard; rewrote nav buttons layout
- [x] Fix "Начать действовать" redirect to `/` instead of `/start`
  - Note: Replaced shouldResolveAfterCompletion effect with direct `navigate('/', { replace: true })`
- [x] Metapanel: remove subtitle, side padding, "Текущий срез платформы", simplify descriptions
  - Note: Updated MetapanelDashboard + en/ru metapanel.json i18n files
- [x] Fix superusers count (showed 2, should be 1)
  - Note: SQL now JOINs rel_user_roles with cat_roles filtering `r.is_superuser = true`
- [x] Role edit dialog: fix content clipped at top
  - Note: Changed DialogContent sx to `{ mt: 1, pt: '16px !important' }`
- [x] Role detail: remove border, fix untranslated permissions, disabled checkboxes for system roles
  - Note: Replaced MainCard with Box; added 4 missing i18n keys (metahubs/applications/profile/onboarding) en+ru; PermissionMatrix uses elevation variant + opacity when disabled
- [x] Role edit dialog from list doesn't close after save
  - Note: BaseEntityMenu now wraps onSubmit to auto-close dialog via setDialogState(null)
- [x] Locales page: standard padding, button, filter, remove border
  - Note: Rewrote LocalesList with Stack + ViewHeader with search + ToolbarControls + flat FlowListTable; removed MainCard wrapper
- [x] Full build validation passed (28/28 packages, 2m34s)

## UX Corrections Wave 2 — 2026-03-18
- Status: COMPLETE
- [x] Allow /start access after onboarding completion (StartAccessGuard)
  - Note: Removed all redirect logic; now only requires authentication
- [x] Fix role dialogs: i18n, padding, star icon overflow, remove left ColorPicker (keep native)
  - Note: Replaced `t('common.cancel')` with `tc('actions.cancel')`, added `sx={{ p: 3, pt: 2 }}` to DialogActions, increased `mt: 2` for star icon; ColorPicker trimmed to native-only
- [x] Fix copy role dialog: auto-append "(копия)"/"(copy)" suffix, auto-generate codename, "Параметры" tab with copy options
  - Note: Added `appendCopySuffix()` to RoleActions, auto-generates `{codename}_copy`, added Tabs to RoleFormDialog when `showCopyPermissions=true`
- [x] Fix edit role dialog: make codename editable for non-system roles (verify UUID bindings — confirmed)
  - Note: Backend uses UUID in `rel_user_roles.role_id`, codename is already editable for non-system roles; verified no changes needed
- [x] Remove demo charts (SessionsChart + PageViewsBarChart) from InstanceBoard
- [x] Full build validation passed (28/28 packages)

---

## UX Corrections Wave — 2026-03-18
- Status: COMPLETE
- [x] Remove metahubs 'read' permission from 'user' system role seed and fix menu divider visibility
- [x] Fix applications settings button — only visible for superusers, not hasAnyGlobalRole
- [x] Fix dashboard user count — change totalGlobalUsers SQL from rel_user_roles COUNT to auth.users COUNT
- [x] Fix all dashboard graphs to show realistic growth instead of fake wave/flat patterns
  - Note: added shared buildRealisticTrendData helper; applied in MetapanelDashboard, AdminBoard, InstanceBoard, MetahubBoard, ApplicationBoard
- [x] Rewrite admin roles RoleEdit page to match catalog pattern
  - Note: Permissions tab stays with PermissionMatrix; Settings tab now opens RoleFormDialog dialog; removed inline settings form, Access Settings section, isSuperuser toggle from page; added isSuperuser support to RoleFormDialog
- [x] Full build validation passed (28/28 packages)

---

## Previous Completed Waves — 2026-03-13
> Status: COMPLETE — older same-day closure waves were archived into `progress.md` to keep this file focused on the canonical active queue plus the most actionable recent completions.
- [x] Metahub frontend regression reopen closure archived; see `progress.md` for the Settings continuity, confirm rendering, and optimistic publication feedback details.
- [x] QA follow-through closure archived; see `progress.md` for the profile fail-closed hardening, runtime release-bundle lineage fix, and shared helper reuse details.
- [x] Optional global catalog QA follow-through closure archived; see `progress.md` for the profile ownership hardening, true incremental artifact contract, and validation details.
## Active Open Tasks (Canonical)
### QA Residual Contract Closure — 2026-03-18
- Status: COMPLETE
- [x] Stabilize the admin primary-role contract so superuser detection does not depend on unordered role rows
  - Note: `admin.get_user_global_roles(...)`, `globalAccessService`, and `/admin/global-users/me` now prefer superuser deterministically and expose an explicit `isSuperuser` boolean for frontend consumers.
- [x] Align admin frontend action gating with backend RBAC permissions instead of superuser-only shortcuts
  - Note: admin roles/users create-edit-delete affordances now use shared CASL subject/action checks through the store-backed admin hook instead of superuser-only UI shortcuts.
- [x] Align role codename validation across frontend and backend
  - Note: the role dialog now blocks codenames outside the backend 2..50 length contract before submit, preventing avoidable 400 responses.
- [x] Clear touched admin-backend lint debt and rerun focused validation plus final root build
  - Note: `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 13/13 tests, `pnpm --filter @universo/admin-frontend build` passed, `pnpm --filter @universo/admin-backend lint` passed with warning-only pre-existing debt and 0 errors, `pnpm --filter @universo/admin-backend test` passed with 6/6 suites and 34/34 tests, `pnpm --filter @universo/admin-backend build` passed, `pnpm install --lockfile-only` completed, and the final root `pnpm build` passed with 28/28 successful tasks in 3m27.908s.
- [x] Update activeContext/progress after all fixes and validations pass

### QA Follow-Through Closure — 2026-03-18
- Status: COMPLETE — the residual QA follow-through is closed. The `@universo/template-mui/navigation` subpath now resolves to built artifacts, direct admin user-management frontend regressions cover the create/edit/clear-roles seams, backend README examples match the current route factory contracts, and final validation finished with a green root `pnpm build` in 3m2.94s.
- [x] Fix the `@universo/template-mui/navigation` subpath export contract so package consumers resolve built JS for both ESM and CJS
  - Note: the subpath must stop pointing ESM consumers at raw TS source while CJS points to the root bundle; emit a dedicated built entry and keep package exports/types aligned.
- [x] Add direct admin user-management frontend regression coverage
  - Note: cover the create/edit/clear-roles UI seam around `InstanceUsers` and `UserActions` so payload wiring and `userId`-based actions are validated in frontend tests instead of only backend service tests.
- [x] Resync backend package README examples with the current route factory contracts
  - Note: `admin-backend` and `auth-backend` examples should reflect the current required factory arguments/options so future integrations do not copy stale code.
- [x] Re-run targeted validation, final root build, and then resync memory-bank closure state
  - Note: `pnpm --filter @universo/template-mui build` passed, the focused `@universo/admin-frontend` Vitest run passed with 3/3 files and 7/7 tests, `pnpm --filter @universo/admin-frontend lint` passed cleanly, README EN/RU parity stayed aligned, and the final root `pnpm build` passed with 28/28 successful tasks in 3m2.94s.

### QA Residual Debt Closure — 2026-03-18
- Status: COMPLETE — the last residual QA debt from the admin roles / metapanel wave is closed. The store package contract is explicit, touched applications lint is clean again, admin dialog loading no longer mixes eager and lazy paths, and validation finished with a green `@universo/applications-frontend` lint plus a successful root `pnpm build` (28/28 tasks in 2m26.514s).
- [x] Fix the `@universo/store` package contract so runtime imports from `@universo/types` are declared explicitly
  - Note: the root build warning around `ABILITY_MODULE_TO_SUBJECT` indicates a real manifest/dependency seam, not just noisy tooling output.
- [x] Remove the remaining touched lint warnings from `@universo/applications-frontend`
  - Note: finish the warning cleanup without broad unrelated refactors; the target is a clean touched package lint surface, not partial suppression.
- [x] Make admin dialog lazy-loading architecture internally consistent
  - Note: `RoleFormDialog` and `UserFormDialog` should either be truly lazy or truly eager, but not both dynamic and static at the same time.
- [x] Re-run targeted validation, final root build, and then resync memory-bank closure state
  - Note: validation must include the touched package lints/tests/build signals plus the final root `pnpm build`.

### Post-QA Full Completion Reopen — 2026-03-18
- Status: COMPLETE — the final reopen is closed. Role-management wording/detail UX now matches the requested contract more closely, metapanel uses shared dashboard primitives, touched applications warning debt is removed, the unexpected metapanel package build seam is fixed, and the final root `pnpm build` passed with 28/28 successful tasks in 2m36.104s.
- [x] Finish the remaining role-management UX gaps against the original metahub-style contract
  - Note: codename wording now uses `Кодовое имя` / `Code Name`, the role detail surface is settings/permissions-aware, and dialog/detail labels were aligned end-to-end through i18n and tests.
- [x] Rebuild the metapanel implementation to use the same shared dashboard primitives/patterns as the metahub board
  - Note: the dashboard now uses shared `StatCard` / `HighlightedCard` / `ViewHeader` primitives from `@universo/template-mui`; the final reopen additionally fixed the package contract by declaring `@universo/template-mui` and `@mui/icons-material` in `@universo/metapanel-frontend` and externalizing them in `tsdown` so build no longer parses foreign SVG assets.
- [x] Remove warning-level debt introduced or left visible in touched applications frontend surfaces
  - Note: connector admin DOM-nesting warnings and touched router/test warning noise were removed without broad unrelated refactors.
- [x] Re-run targeted validation, final root build, and then resync memory-bank closure state
  - Note: targeted admin/metapanel/applications validation was green, `pnpm --filter @universo/metapanel-frontend build` passed after the package-contract fix, `pnpm install --lockfile-only` resynced the workspace lockfile, and the final root `pnpm build` passed with 28/28 successful tasks in 2m36.104s.

### Post-QA Corrective Reopen — 2026-03-18
- Status: COMPLETE — the registered-only shell leak is fail-closed in both shared frontend/backend access resolvers, the touched start/applications regression surfaces are green again, and the final root `pnpm build` passed with 28/28 successful tasks in 2m26.925s.
- [x] Tighten the registered-user workspace-access contract so Profile read cannot unlock the workspace shell
  - Note: `registered` users must remain fail-closed on `/start`; capability-based shell access should not treat plain Profile visibility as sufficient workspace access when lifecycle policy says the user is still pre-workspace.
- [x] Restore a green and realistic `@universo/start-frontend` regression surface around onboarding completion routing
  - Note: narrow the `resolveShellAccess` import/test seam and align `useAbility` mocks with the actual runtime contract (`refreshAbility`, `globalRoles`, `ability`, `isSuperuser`).
- [x] Restore a green `@universo/applications-frontend` test contract for the new permission gating
  - Note: test mocks must match `useHasGlobalAccess()` and shared settings-dialog expectations so permission-gating regressions are validated instead of hidden behind partial mock shape drift.
- [x] Re-run targeted validation, final root build, and then close the reopen in memory-bank
  - Note: required validation includes the touched frontend/backend test suites plus the final root `pnpm build`.

### Admin Roles & Metapanel Corrective Completion Wave — 2026-03-18
- Status: COMPLETE — workspace access is now capability-based in the shared shell, admin create-user rollback compensates both profile and auth state, lifecycle role seeding is single-source again with legacy `manage` normalization, application admin affordances follow real permissions, route ownership moved back into `@universo/core-frontend`, targeted validation passed, touched-package lint is error-free, and the final root `pnpm build` passed with 28/28 successful tasks in 2m38.654s.
- [x] Replace codename-based workspace access with shared capability-based shell/dashboard/start access
  - Note: frontend shell/start routing and backend shared dashboard access must derive workspace eligibility from real permissions/CASL ability instead of only the `user` codename, while still keeping `registered` users fail-closed.
- [x] Make admin create-user rollback compensate both profile and auth state
  - Note: if role assignment fails after Supabase user provisioning, the admin flow must soft-delete `profiles.cat_profiles` before deleting the auth user, mirroring the registration cleanup contract.
- [x] Remove duplicate lifecycle system-role seed execution and normalize legacy permission action drift
  - Note: lifecycle seed/backfill must run from one canonical migration path only, and the seeded `user` role must stop relying on legacy `manage` rows that backend permission SQL does not interpret consistently.
- [x] Align applications management affordances with actual application/global capabilities
  - Note: application create/control-panel access must use real ability/application permission semantics instead of inheriting visibility from admin-panel access alone.
- [x] Extract feature route ownership out of the shared template shell where necessary
  - Note: `@universo/template-mui` should stop owning routed feature composition that forces new leaf-feature dependencies like metapanel into the shared shell package.
- [x] Re-run targeted validation and final root build, then close memory-bank state
  - Note: admin-backend focused route tests passed (5/5), the new template shell-access regression passed (3/3), `@universo/template-mui`, `@universo/core-frontend`, `@universo/start-frontend`, and `@universo/applications-frontend` builds passed, touched-package lint returned warning-only pre-existing noise with 0 errors, and the final root `pnpm build` passed with 28/28 successful tasks in 2m38.654s.

### Admin Roles & Metapanel UX Rework — 2026-03-18
- Status: COMPLETE — root/start routing now follows the requested guest vs `registered` vs `user` contract, the metapanel has been rebuilt into the requested dashboard shape on `/`, admin roles now use dialog-first edit UX plus a permissions-first detail page, ordinary `user` users no longer see application create/control-panel actions, and validation is green again.
- [x] Restore the correct root/start routing contract for guest, `registered`, and `user` states
  - Note: `/` must render the unauthenticated start page for guests, `/start` must remain the authenticated onboarding surface for `registered` users, and `/` must resolve to metapanel only for authenticated `user` users.
- [x] Add and document the onboarding auto-promotion environment switch in the backend env templates
  - Note: both `.env.example` and the local `.env` must clearly expose the setting that controls whether onboarding completion auto-grants the `user` role or leaves promotion for manual admin action.
- [x] Rebuild the metapanel from the metaproject dashboard pattern instead of the current custom layout
  - Note: reuse the same shared dashboard components/patterns from the metahub/metaproject implementation, keep one row with three chart cards plus one documentation card, fix breadcrumb translation, and delete the current throwaway metapanel-only UI files that are no longer needed.
- [x] Refactor admin role create/edit/detail UX to match the requested metahub patterns
  - Note: roles list should use a `Создать` action, create/edit must open metahub-style dialogs with name/description first and codename at the bottom, `Редактировать` must no longer navigate to the legacy page, and the role detail page must mirror the catalog attribute detail layout with `Разрешения` + `Настройки` tabs.
- [x] Hide admin-only application actions from ordinary `user` users
  - Note: ordinary users must not see application creation or admin settings actions; those controls should remain visible only for the intended privileged roles.
- [x] Re-run targeted validation, final root build, and update memory-bank closure state
  - Note: metapanel regression Vitest passed (1/1), admin role dialog Vitest passed (4/4), targeted applications gating regression passed with the focused `-t "hides create and control-panel actions for ordinary user roles"` run, touched frontend lints passed, and the final root `pnpm build` passed with 28/28 successful tasks in 2m32.91s.

### Admin Roles Refactoring & Метапанель Final QA Completion Reopen — 2026-03-18
- Status: COMPLETE — the legacy single-role seam is now compatibility-safe on top of the multi-role model, the role-copy flow contract is aligned end-to-end, the promised backend/frontend regressions are in place, and final validation is green again.
- Plan: `memory-bank/plan/admin-roles-metapanel-refactoring-plan-2026-03-17.md`
- [x] Close the remaining legacy role-assignment seam so superuser exclusivity and multi-role invariants hold across every still-supported backend/frontend entry point
  - Note: remove or harden the old single-role grant/update surfaces so they cannot bypass `setUserRoles(...)` semantics or preserve invalid mixed-role state.
- [x] Finish the role-copy flow contract end-to-end
  - Note: the copy dialog must clear codename by default, expose the optional `copyPermissions` choice, and keep backend/frontend validation rules aligned.
- [x] Add the missing direct regression coverage promised by the approved plan and cover the reopened QA findings
  - Note: add focused backend/frontend tests for the legacy role seam, copy dialog behavior, and any touched routing/contract edge cases introduced by the cleanup.
- [x] Remove the touched residual runtime/type debt and revalidate the full workspace
  - Note: clear the debug logging / touched editor debt that remains from this wave, rerun targeted package checks, then finish with the full root `pnpm build`.
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the final closure only after all validations pass
  - Note: targeted backend tests passed (19/19), admin-frontend Vitest passed (3/3), metapanel Vitest passed (1/1), touched frontend lints passed, and the final root `pnpm build` passed with 28/28 successful tasks in 2m38.24s.

### Admin Roles Refactoring & Метапанель QA Corrective Reopen — 2026-03-17
- Status: COMPLETE — the shared dashboard/user contract, lifecycle rollback handling, shell-access semantics, touched dialog/test/lint debt, and the final validation sweep are now closed.
- Plan: `memory-bank/plan/admin-roles-metapanel-refactoring-plan-2026-03-17.md`
- [x] Reopen the QA corrective plan in code and align the shared dashboard stats authorization with the metapanel/user role contract
  - Note: the shared stats route is consumed by both AdminBoard and metapanel, so it must allow real workspace users without weakening registered-only access rules.
- [x] Add compensation-safe lifecycle handling for admin-created users, registration, and onboarding completion
  - Note: when a later role-assignment step fails after auth/profile writes succeed, the route must either roll back the earlier state or fail with explicit cleanup instead of leaving hidden partial success.
- [x] Harden the touched admin user-management dialog UX and clear the touched backend/frontend regression debt
  - Note: remove edit-flow loading/null-email edge cases, fix the stale globalAccessService test expectation, and clear the remaining touched lint warning before final validation.
- [x] Re-run targeted validation plus the final root build, then resync memory-bank closure state
  - Note: `@universo/admin-backend` tests passed, `@universo/start-backend` tests passed, `@universo/auth-backend` tests passed, `@universo/admin-frontend lint` passed cleanly, `@universo/template-mui build` passed, and the final root `pnpm build` passed with 28/28 successful tasks in 3m9.663s.

### Admin Roles Refactoring & Метапанель — 2026-03-17
- Status: COMPLETE — all phases of the v3 implementation are now merged in code, the metapanel package integration seam is closed, and final validation passed including the full root build.
- Plan: `memory-bank/plan/admin-roles-metapanel-refactoring-plan-2026-03-17.md`
- [x] **Phase 0**: Extend shared types and align AbilityContext (CASL Subjects, shared subject map, admin types, section-aware role-menu mapping)
  - Note: make `@universo/types` the single source of truth for CASL module-to-subject mapping before backend/frontend role lifecycle work.
- [x] **Phase 1**: Database migrations & backend core
  - [x] Seed `registered` and `user` system roles + permissions
  - [x] Introduce a privileged injected helper for system-role provisioning
  - [x] Auto-assign `registered` role after registration via the injected helper
  - [x] Onboarding completion role transition via the same helper (ENV-controlled)
  - [x] Role copy backend route (POST /:id/copy, Zod validation, transaction)
  - [x] Multi-role set endpoint (PUT /:memberId/roles, superuser exclusivity, self-mod guard)
  - [x] Add `setUserRoles()` to GlobalAccessService (transaction-wrapped)
  - [x] Admin-side user creation (POST /create-user, Supabase Admin API, bootstrap-injected `supabaseAdmin`)
  - [x] Update user list to LEFT JOIN (show users without roles)
  - [x] Add dedicated admin dashboard stats route/contract for AdminBoard + Метапанель
  - [x] One-time data migration for existing users
- [x] **Phase 2**: Roles UI refactoring
  - [x] Create RoleFormDialog (basic fields only: name, codename, color, desc)
  - [x] Refactor RoleEdit.tsx into tabbed layout (Permissions + Settings tabs) — reuse existing PermissionMatrix + ColorPicker
  - [x] Update RolesList to use BaseEntityMenu + navigate-to-detail
  - [x] TanStack Query mutations for role CRUD + copy
- [x] **Phase 3**: User management & multi-role assignment
  - [x] Create UserFormDialog with "Основное" + "Роли" tabs (including user creation)
  - [x] Update InstanceUsers.tsx for multi-role chips + roleless users + create user button
  - [x] Replace MemberFormDialog with UserFormDialog
- [x] **Phase 4**: Onboarding integration
  - [x] Refactor OnboardingWizard so completion is not called before the CTA
  - [x] "Start Acting" button in CompletionStep + `AbilityContext` refresh
  - [x] Preserve completed registered-only `/start` state when auto role assignment is disabled
- [x] **Phase 5**: Метапанель & role-based menus
  - [x] Create `metapanel-frontend` package (dual-build TSX)
  - [x] MetapanelDashboard with stat summaries, role distribution, and dedicated i18n namespace
  - [x] Add explicit `/start` route and root home resolver
  - [x] Add `RegisteredUserGuard` + `StartAccessGuard` (typed, no `any`)
  - [x] Add section-aware role-based menu filtering in MenuContent
  - [x] Wrap main shell and add `/metapanel` route, rootMenuItems update, i18n namespace
- [x] **Phase 6**: Final integration closure
  - [x] Fix the `@universo/metapanel-frontend` package build/export surface so workspace consumers can resolve `@universo/metapanel-frontend/i18n` during the full shell build
  - [x] Refresh the root lockfile/workspace metadata so Turbo and PNPM both see the new package/dependency graph
  - [x] Re-run the full root `pnpm build` and close the implementation wave only after the workspace passes end-to-end
  - [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the final implementation/validation outcome
  - Note: the final integration fix added an explicit `tsdown` subpath entry for `./i18n`, declared the workspace dependency from `@universo/template-mui` to `@universo/metapanel-frontend`, removed the reverse metapanel -> template dependency to break the cycle, and the final root `pnpm build` passed with 28/28 successful tasks in 2m49.995s.

### QA Transactional Consistency Remediation — 2026-03-17
- Status: COMPLETE — attribute create/copy/update/delete/display/required mutations and child-attribute create now run schema sync inside the same transaction runner, catalog create routes seed managed system attributes atomically, new route tests assert runner propagation, targeted route tests passed 43/43, and the final root `pnpm build` completed successfully.
- [x] Make metahub attribute mutation routes fully atomic with schema sync
  - Note: create/copy/update/delete/display-toggle/required-toggle and child-attribute create must commit only if `syncMetahubSchema(...)` succeeds in the same transaction runner.
- [x] Make catalog create routes atomic with managed system-attribute seeding
  - Note: both metahub-level and hub-scoped catalog creation must wrap `createCatalog(...)` and `ensureCatalogSystemAttributes(...)` in one transaction.
- [x] Add direct regression coverage for transaction-runner propagation and fail-closed responses
  - Note: tests should prove the shared transaction runner is used for schema sync and system-attribute seeding, not only that HTTP 500 is returned.
- [x] Re-run targeted validation and final root build
- [x] Update memory-bank files

### Platform System Attributes Must Suppress Runtime _upl_* Columns — 2026-03-17
- Status: COMPLETE — runtime application business tables now derive configurable `_upl_archived*` / `_upl_deleted*` families from catalog `systemFields.fields`, runtime CRUD/sync SQL tolerates their absence, targeted lint/tests are green, and the final root build passed.
- [x] Make schema-ddl derive configurable platform archive/delete columns from catalog `systemFields.fields`
  - Note: application business tables should keep mandatory platform audit fields like `_upl_created_at` / `_upl_updated_at`, but must omit configurable `_upl_archived*` and `_upl_deleted*` families when the metahub disables all platform system attributes under the non-forcing admin policy.
- [x] Align runtime application row conditions and soft-delete SQL with the actual platform delete-field contract
  - Note: dynamic runtime CRUD and schema-sync helpers must stop referencing `_upl_deleted` when that configurable platform delete family is absent, while preserving the existing behavior for catalogs that still keep platform delete enabled.
- [x] Add direct regression coverage for omitted `_upl_*` schema columns and runtime SQL fallbacks
  - Note: cover schema-ddl business-table column generation plus applications-backend runtime delete/active-row paths for catalogs that disable `upl.deleted`.
- [x] Run targeted validation and final root build
  - Note: `@universo/utils` lint is back to warning-only package noise after fixing the touched Prettier issues; `@universo/schema-ddl` lint remains warning-only with 0 errors; `@universo/applications-backend` lint passed cleanly; targeted tests passed (`243/243`, `40/40`, `29/29`); and the final root `pnpm build` passed with 27/27 successful tasks in 3m24.562s.
- [x] Update memory-bank files

### QA Follow-Up Closure — Snapshot Hash Shared Contract + Touched Lint Debt — 2026-03-17
- Status: COMPLETE — publication snapshot hash normalization now lives in one shared `@universo/utils` helper reused by both metahubs-backend and applications-backend, the touched frontend/backend lint debt is removed, targeted regressions passed, and the final root `pnpm build` passed.
- [x] Move publication snapshot hash normalization to one shared helper contract
  - Note: `packages/universo-utils/base/src/serialization/publicationSnapshotHash.ts` now owns the canonical normalization contract, and both `applicationReleaseBundle.ts` and `SnapshotSerializer.ts` call that helper instead of maintaining drift-prone package-local copies.
- [x] Remove warning-only lint debt in touched frontend code
  - Note: the touched `ElementList.tsx`, `AttributeList.systemTab.test.tsx`, and `SnapshotSerializer.ts` warning debt was removed without changing the already-correct runtime behavior.
- [x] Re-run targeted tests, touched lint, and final root build
  - Note: the new utils serializer regression passed, targeted applications/metahubs frontend/backend suites passed, touched file eslint returned clean, and the final root `pnpm build` passed with 27/27 successful tasks in 2m33.051s.
- [x] Update memory-bank files

### Disabled Metahub System Attributes Must Suppress Runtime _app_* Columns — 2026-03-17
- Status: COMPLETE — publication-driven application schema generation now preserves the metahub snapshot lifecycle contract inside release-bundle executable entities, so disabled application lifecycle families no longer silently regenerate default `_app_*` runtime columns.
- [x] Preserve publication lifecycle contract when building application release bundle executable payloads
  - Note: `createApplicationReleaseBundle(...)` now hydrates `snapshot.systemFields[entity.id]` back into each executable entity config before schema snapshot generation, so schema-ddl receives `config.systemFields.lifecycleContract` instead of defaulting all lifecycle families on.
- [x] Add regression coverage for publication-driven runtime schema creation with disabled application lifecycle fields
  - Note: release-bundle tests now assert executable payload hydration from publication `systemFields`, and sync-route tests now prove `generateFullSchema(...)` receives the disabled lifecycle contract when syncing a published application.
- [x] Run touched validation and the final root build
  - Note: `@universo/applications-backend` targeted Jest suites passed 28/28, package lint passed, package build passed, and the final root `pnpm build` passed with 27/27 successful tasks in 2m55.301s.
- [x] Update memory-bank files

### Catalog Tab Isolation + Base Template Layout Defaults — 2026-03-17
- Status: COMPLETE — scoped attribute rows no longer bleed between Attributes and System views, and the built-in basic template now seeds the requested default widgets for newly created metahubs without legacy branches or template version bumps.
- [x] Fix catalog tab data isolation between Attributes and System views
  - Note: `AttributeList` now disables previous-query placeholder reuse across query-key changes and resets page/expanded TABLE state when switching catalog tabs, so System and ordinary Attributes no longer show stale mixed rows from the previous scope.
- [x] Adjust base metahub template default widgets
  - Note: the built-in `basic` template now seeds `appNavbar` + `header` in the top zone and `detailsTitle` + `detailsTable` in the center zone; the previous `columnsContainer(detailsTable + productTree)` seed is removed.
- [x] Add regression coverage for the tab isolation and template layout defaults
  - Note: frontend system-tab tests now assert scoped attribute views opt out of `keepPreviousData`, and backend template-manifest tests now assert the exact built-in basic-template widget set.
- [x] Run touched validation and the final root build
  - Note: `@universo/metahubs-frontend` targeted Vitest passed 2/2, `@universo/metahubs-backend` targeted Jest passed 4/4, touched package lint remains warning-only with 0 errors, and the final root `pnpm build` passed with 27/27 successful tasks in 3m21.269s.
- [x] Update memory-bank files

### Application Connector Schema Sync — Snapshot Hash Mismatch Fix — 2026-03-17
- Status: COMPLETE — application connector schema creation no longer fails when publication snapshots carry `systemFields` or omit optional layout/widget keys; the release-bundle snapshot hash contract is aligned again and validation is green.
- [x] Fix `normalizePublicationSnapshotForHash` in applications-backend to include `systemFields` (matching `SnapshotSerializer.normalizeSnapshotForHash`)
  - Note: the applications-backend normalization now includes `systemFields` both per entity and at the top level, and no longer coerces optional publication fields like `templateKey`/`widgetKey` or top-level publication metadata from `undefined` to `null`, eliminating the publication/application hash divergence that triggered the 500 during connector schema creation.
- [x] Update or add tests for the hash normalization alignment
  - Note: `applicationReleaseBundle.test.ts` now covers publication snapshots with `systemFields` and publication snapshots whose layout/widget optional keys are omitted, proving the explicit publication hash is accepted after normalization.
- [x] Run lint and full build verification
  - Note: `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/applicationReleaseBundle.test.ts` passed (10/10), `pnpm --filter @universo/applications-backend lint` passed, `pnpm --filter @universo/applications-backend build` passed, the compiled `dist` parity check now passes for the real layout-optional-key case, and the final root `pnpm build` passed with 27/27 successful tasks in 3m49.731s.
- [x] Update memory-bank files

### Dashboard Cleanup + System Attribute UX Fixes — 2026-03-17
- Status: COMPLETE — all four user-reported fixes are implemented, QA analysis passed with minor cleanups resolved, lint is clean, all tests pass, and the full workspace build passed (27/27).
- [x] Remove test charts from metahub dashboard and application dashboard
  - Note: Charts were already removed in the working tree from a prior session; verified as correct.
- [x] Rename system tab label to "Системные" (keep heading "Системные атрибуты")
  - Note: i18n keys already set correctly in the working tree from a prior session.
- [x] Fix system attribute ordering after enable/disable toggle
  - Note: `useUpdateAttribute.onMutate` now updates nested `system.isEnabled` (not top-level); `onSettled` forces active query refetch for system toggles so server sort order replaces any client drift.
- [x] Fix empty menu for platform system attributes when admin configuration is enabled
  - Note: `renderAttributeActions` now passes pre-filtered `visibleDescriptors` to `BaseEntityMenu` to eliminate visibility check divergence; shared `displayEntity` reference reduces stale-object risk.
- [x] QA follow-up: remove unnecessary type assertions and dead code
  - Note: removed `as` type casts for `toggleSystemEnabled` in system actions (ActionContext index signature handles it), removed redundant identical-branch ternary for `searchPlaceholder`, fixed Prettier error in `systemAttributeSeed.test.ts`.

### Platform System Attributes Final QA Closure Reopen — 2026-03-17
- Status: COMPLETE — the last reopen-only lint cleanup is closed, the introduced frontend warning debt is removed, targeted validation is green again, and the full workspace build passed.
- [x] Remove the remaining error-level lint failure in template policy-aware seeding
  - Note: `TemplateSeedMigrator.ts` must be reformatted cleanly so `@universo/metahubs-backend lint` returns to error-free status.
- [x] Remove touched-file lint debt in the System-tab continuity frontend code
  - Note: `ElementList.tsx` should stop producing avoidable hook-dependency and unused-variable warnings in the code introduced for Settings continuity and system routing.
- [x] Re-run touched lint, targeted tests, and the final root build
  - Note: `@universo/metahubs-backend` lint is back to warning-only package noise, `@universo/metahubs-frontend` no longer reports the introduced hook-dependency or unused-variable warnings, `@universo/applications-backend` lint passed cleanly, `@universo/schema-ddl` remains warning-only, targeted tests passed (`58/58`, `3/3`, `44/44`, plus targeted schema-ddl suites), and the final root `pnpm build` passed with 27/27 successful tasks in 2m37.2s.

### Platform System Attributes Policy Enforcement Reopen — 2026-03-17
- Status: COMPLETE — backend toggle writes, template seeding, frontend action visibility, and direct regressions now share the same platform-policy contract; targeted validation and the final root build are green.
- [x] Enforce global platform policy for existing system-attribute enable/disable updates
  - Note: `MetahubAttributesService.update(...)` now resolves the global platform policy and rejects `_upl_*` mutations when configuration is disabled or when `platformSystemAttributesIgnoreMetahubSettings` forces canonical platform defaults.
- [x] Make template system-attribute seeding use the same policy-aware seed plan as interactive catalog creation/copy
  - Note: template executor/migrator seeding now passes the resolved admin policy into `ensureCatalogSystemAttributesSeed(...)`, so builtin template repair no longer diverges from interactive catalog creation/copy behavior.
- [x] Add direct regression coverage for policy-enforced platform toggles and template seeding parity
  - Note: backend service tests now cover blocked `_upl_*` toggles under enforced defaults, and template seed tests prove non-forcing policy combinations skip optional platform rows instead of silently creating drift.
- [x] Re-run targeted validation, final root build, and resync memory-bank closure state
  - Note: `@universo/metahubs-backend` targeted tests passed 58/58, the touched frontend targeted suites passed, touched package lints are warning-only after clearing the new error-level issues, and the final root `pnpm build` passed with 27/27 successful tasks in 2m40.243s.

### Platform System Attributes QA Remediation Follow-Up — 2026-03-17
- Status: COMPLETE — the remaining QA findings are closed, direct regression proof is in place, targeted lint is error-free again, and the final root build is green.
- [x] Fail closed when metahub schema sync fails after attribute mutations
  - Note: attribute create/copy/update/delete/display-toggle flows must stop returning success when `syncMetahubSchema(...)` fails, and the response should make the failure explicit instead of silently logging it.
- [x] Make catalog system-attribute ensure/read paths transaction-safe
  - Note: `ensureCatalogSystemAttributes(...)` must not fall back to `this.exec` for its final read when a transaction runner was provided, otherwise callers can observe stale pre-commit state.
- [x] Add direct regression coverage for schema-sync failure handling and platform policy/admin settings seams
  - Note: cover route behavior on sync failure, service-level transaction-safe ensure reads, policy resolution/seed-plan helpers, and admin settings validation for the new metahubs platform toggles.
- [x] Re-run targeted validation and full workspace build, then resync memory-bank closure state
  - Note: `@universo/metahubs-backend` targeted tests passed 54/54, `@universo/admin-backend` request-scoped routes tests passed 6/6, `@universo/utils` tests passed 239/239, touched package lints are warning-only after clearing the remaining `@universo/utils` error-level formatting regressions, and the final root `pnpm build` passed with 27/27 successful tasks in 2m49.913s.

### Platform System Attributes Governance + System Tab UX — 2026-03-16
- Status: COMPLETE — global platform override policy, dedicated System routing, platform toggle UX, and deterministic row-order behavior are implemented and validated.
- [x] Add global admin settings for platform system attributes governance
  - Note: introduce the three requested switches in the admin settings surface and expose them through the existing admin settings persistence/API so metahub services can resolve platform defaults independently from per-metahub configuration.
- [x] Apply platform override rules to catalog system-attribute seeding and listing
  - Note: platform `_upl_*` attributes must be creatable independently of metahub configuration, hidden from catalog System view when platform editing is disabled, and forced back to platform defaults when the global ignore override is enabled.
- [x] Fix catalog System tab UX and routing
  - Note: rename UI copy from System fields to System attributes, move the dedicated tab route to `/system`, keep tab continuity from Attributes and Elements, and show only valid enable/disable actions with the same menu-icon conventions used on the Attributes tab.
- [x] Preserve deterministic system-row order during enable/disable changes
  - Note: system rows must remain in canonical registry order regardless of toggles, with no reorder side effects or front-end resorting drift.
- [x] Add regression coverage and run package/root validation
  - Note: targeted frontend/backend/shared tests passed, touched package lint checks are warning-only after fixing new errors, `@universo/types` and `@universo/utils` shared builds were refreshed, and the final root `pnpm build` passed with 27/27 successful tasks in 2m52.626s.

### Metahub System Attributes + Migration Hardening QA Remediation Reopen — 2026-03-16
- Status: COMPLETE — the route-level system toggle seam is reopened safely, copy-without-attributes now preserves source lifecycle state, new regressions cover both gaps, and final validation is green again.
- [x] Reopen the route-level system-field toggle path so System tab enable/disable actions can succeed safely
  - Note: `PATCH /attribute/:attributeId` now special-cases system rows, allows only guarded `isEnabled` + `expectedVersion` updates, and returns structured 409 responses for forbidden system mutations or protected `_upl_*` disables.
- [x] Preserve catalog system-field enabled states when copying a catalog without ordinary attributes
  - Note: copy-without-attributes now reads source system-row states inside the copy transaction and passes them into canonical seeding, so disabled lifecycle fields are preserved instead of silently resetting to defaults.
- [x] Add direct regression coverage for route-level system toggles and copy-without-attributes state preservation
  - Note: route tests now prove successful system enable/disable plus protected/forbidden failure modes, catalog copy tests assert state preservation, and the service tests now cover seeding with explicit disabled system states.
- [x] Re-run targeted validation, root build, and then resync memory-bank closure state
  - Note: metahubs-backend targeted route/service tests passed, metahubs-backend lint passed, frontend System tab regressions passed, and the final root `pnpm build` passed with 27/27 successful tasks in 3m2.158s.

### Metahub System Attributes + Migration Hardening QA Reopen — 2026-03-16
- Status: COMPLETE — catalog copy now reseeds canonical system rows inside the copy transaction, touched lint errors were removed across the lifecycle files/tests, targeted regressions stayed green, and the final root build passed again.
- [x] Restore the catalog-copy invariant so every newly created catalog still gets canonical system attributes even when copyAttributes is disabled
  - Note: the catalog copy route now calls the shared `ensureCatalogSystemAttributes(...)` helper inside the copy transaction, so copied catalogs keep managed lifecycle rows even when ordinary attributes are skipped.
- [x] Remove touched-file lint debt in applications-backend and schema-ddl
  - Note: removed the unused runtime helpers/locals plus the Prettier regressions in `applicationsRoutes.ts`, `applicationsRoutes.test.ts`, and `SchemaGenerator.ts`; metahubs feature files/tests were also reformatted where this wave surfaced package-level lint errors.
- [x] Add direct regression coverage for the copy-without-attributes path and keep duplicate-codename retry coverage intact
  - Note: `catalogsRoutes.test.ts` now proves system seeding still runs for copy-without-attributes while preserving the existing duplicate-codename retry assertions.
- [x] Re-run targeted validation and the final root build, then resync memory-bank closure state
  - Note: targeted metahubs/applications/schema tests passed, touched lints no longer reported error-level failures, and the final root `pnpm build` passed with 27/27 successful tasks in 2m52.165s.

### Metahub System Attributes + Migration Hardening Implementation — 2026-03-16
- Status: COMPLETE — write-time toggle persistence is now dependency-aware, shared nested-partial lifecycle typing is explicit, runtime/schema lifecycle regressions were added, and the architecture memory now matches the contract-driven runtime-column model.
- [x] Harden system-field toggle writes so invalid dependency states cannot be saved
  - Note: backend toggle writes now cascade dependency changes atomically, protected `_upl_*` rows cannot be disabled, and the System tab no longer offers disable actions for non-disableable rows.
- [x] Fix the shared lifecycle helper typing so nested partial contract inputs are supported without editor/type debt
  - Note: `@universo/types` now exports `ApplicationLifecycleContractInput`, and `@universo/utils` uses that public nested-partial contract directly.
- [x] Add the missing runtime/schema regression coverage required by the plan
  - Note: direct tests now cover runtime hard delete, selective `_app_deleted_at/_app_deleted_by` suppression, schema-ddl contract-driven lifecycle columns, and metahubs service-level toggle cascade/protection.
- [x] Resync architecture/docs memory with the conditional lifecycle-column model
  - Note: `systemPatterns.md` now documents contract-driven runtime lifecycle columns instead of an unconditional 27-field business-table model.
- [x] Re-run targeted validation and the final root build, then resync memory-bank state
  - Note: targeted suites/builds passed and the final root `pnpm build` passed with 27/27 successful tasks in 3m11.586s.

### Start System App PR Review Follow-Up — 2026-03-16
- Status: COMPLETE — reviewed all submitted PR feedback, implemented the valid fixes, and revalidated the touched packages plus the full workspace build.
- [x] Collect PR #725 review comments and classify which findings are valid, outdated, or non-actionable
  - Note: triaged 5 meaningful comments; 4 code changes and 1 memory-bank cleanup were confirmed valid and regression-safe.
- [x] Implement the valid fixes with minimal scope and preserve the current start-system-app behavior
  - Note: moved the missing `catalog_kind` CHECK into post-generation SQL, aligned selection soft-delete with dual-flag audit fields, routed onboarding status reads through `ProfileService`, and suppressed empty description typography in the selectable cards.
- [x] Revalidate affected packages/tests and update memory-bank state with the QA outcome
  - Note: start-backend 26/26 PASS, start-frontend 16/16 PASS, migrations-platform 127/127 PASS, targeted lint clean, root `pnpm build` passed with 27/27 successful tasks in 3m0.819s.

### Start System App — Onboarding Architecture Migration — 2026-03-15
- Status: COMPLETE — all 5 phases implemented, QA remediation closed, and the clean-db bootstrap ordering fix is validated with targeted package checks plus a full root build
- [x] Clean-db startup fix: move start RLS policy creation behind admin permission function availability
  - Note: `start` no longer creates admin-dependent RLS policies in `FinalizeStartSchemaSupport1710000000001`; the new `ApplyStartSchemaPolicies1733400000500` migration recreates the 9 policies only after admin bootstrap helpers exist.
- [x] Clean-db startup fix: add migration-order regression coverage for start vs admin bootstrap sequence
  - Note: migrations-platform tests now prove the new start policy migration sorts after `FinalizeAdminSchemaSupport1733400000001`, while the start manifest/system-app tests expect the explicit third migration entry.
- [x] Clean-db startup fix: validate affected packages and full root build, then resync memory-bank
  - Note: `@universo/start-backend` tests 26/26 PASS, `@universo/migrations-platform` tests 126/126 PASS, targeted lint clean, targeted builds clean, root `pnpm build` passed with 27/27 successful tasks in 2m57.464s.
- [x] QA remediation wave: make POST /selections atomic and deduplicate repeated item ids
  - Note: `POST /selections` now deduplicates incoming ids before validation, wraps the full 3-catalog sync in one `DbExecutor.transaction(...)`, and keeps `syncUserSelections(...)` defensive for duplicate callers.
- [x] QA remediation wave: remove AuthenticatedStartPage double-fetch and align stale onboarding wording
  - Note: `AuthenticatedStartPage` now prefetches onboarding data once and passes `initialItems` into `OnboardingWizard`, eliminating the extra request while keeping the fallback-to-wizard behavior on prefetch failure.
- [x] QA remediation wave: add direct regressions for transaction-safe sync and AuthenticatedStartPage preload flow
  - Note: backend tests now cover duplicate-id normalization and transaction usage; frontend tests now cover wizard preload/no-refetch and `AuthenticatedStartPage` completion/fallback branches.
- [x] QA remediation wave: resync memory-bank status after validation
  - Note: final validation passed: start-backend 26/26, start-frontend 16/16, migrations-platform 123/123, targeted lint clean, targeted builds clean, root `pnpm build` 27/27 successful in 4m55.803s.
- [x] Create initial plan for start system app migration
- [x] Comprehensive QA audit of the plan (11 findings — 2 HIGH, 4 MEDIUM, 3 LOW, 2 INFO)
- [x] Update plan to v2 incorporating all QA findings
  - Note: eliminated reinvented VLC type/resolver (use existing `@universo/types` + `@universo/utils/vlc`), fixed executor API, migration interface convention, seed dates, added RETURNING, updated goals to 10 items.
- [x] Second comprehensive QA audit of the v2 plan (8 findings — 0 HIGH, 3 MEDIUM, 2 LOW, 3 INFO)
- [x] Update plan to v3 incorporating second QA findings
  - Note: fixed `user_id`/`item_id` dataType to REF; added 2 missing package.json deps; corrected rlsPolicyOptimization format; clarified seed ordering; added ProfileService instantiation; updated File Change Summary.
- [x] Phase 1: Backend system app definition + migrations (Steps 1.1–1.5)
  - Note: systemAppDefinition.ts, migrations/index.ts with 30 VLC seeds, package.json exports, registration in migrations-platform, RLS policy optimization.
- [x] Phase 2: Backend store modules + route refactoring (Steps 2.1–2.3)
  - Note: onboardingStore.ts (5 functions with CatalogKind routing), onboardingRoutes.ts (3 endpoints with Zod validation), index.ts exports.
- [x] Phase 3: Frontend API + types + component updates (Steps 3.1–3.5)
  - Note: types/index.ts (VLC-based OnboardingCatalogItem), api/onboarding.ts (syncSelections + completeOnboarding), SelectableListCard VLC rendering, OnboardingWizard rewrite with goals/topics/features steps, i18n en+ru.
- [x] Phase 4: Testing — backend + frontend + migration integration (Steps 4.1–4.4)
  - Note: 3 backend test files (store, routes, systemAppDefinition), 3 frontend test files (api, SelectionStep, OnboardingWizard), updated migrations-platform tests for 'start' inclusion.
- [x] Phase 5: Build chain validation + full test run (Steps 5.1–5.3)
  - Note: Full build 27/27 tasks passed. All tests green: start-backend 22/22, start-frontend 12/12, migrations-platform 106/106, migrations-core 58/58. Added 'start' to FIXED_SCHEMA_NAMES.
- [x] QA follow-up: Fix lint formatting errors in start-backend (91 prettier), start-frontend (10 prettier+unused-imports), and migrations-platform (10 prettier in new test file)
  - Note: auto-fixed via `npx eslint --ext .ts src/ --fix` in each package directory. All three packages lint-clean.
- [x] QA follow-up: Create `startSystemApp.test.ts` in migrations-platform (plan File Change Summary requirement)
  - Note: 17 tests covering prepare/finalize migration split, RLS policies, seed data, VLC format, manifest wiring, loadPlatformMigrations scoping, bootstrap phase filtering. Added jest.config.js module name mappers for `@universo/start-backend/platform-definition` and `@universo/start-backend/platform-migrations`. All 123/123 migrations-platform tests pass.
- [x] Second comprehensive QA audit — all 14 ТЗ requirements verified, all 30 seed items validated against backup files, all 5 plan phases confirmed
  - Note: 1 LOW finding (missing 401 test for POST /selections) fixed. 3 INFO observations documented (mock VLC format cosmetic, double-fetch plan-deferred, auto-select UX). Final: start-backend 23/23, start-frontend 12/12, migrations-platform 123/123. All lint clean.

### Repository-Wide Legacy Branding Removal — 2026-03-15
- Status: COMPLETE — removed remaining legacy upstream branding across runtime code, env files, i18n, docs, memory-bank history, `.kiro` steering, repository instruction files, and generated artifacts; final repository-wide grep outside `.git` / `node_modules` returned zero matches, and the final root build passed clean.
- [x] Inventory all remaining legacy upstream mentions across the repository
  - Note: active matches were grouped into runtime/config/i18n files, memory-bank docs, generated logs, and `.backup` artifacts; `.git` internals stay untouched.
- [x] Replace or remove branding in runtime code, env samples, tests, docs, and archival artifacts
  - Note: this included runtime/frontend source, env comments, deployment docs, memory-bank core files, historical plan files, `.kiro` steering, repository instruction files, stale build/coverage outputs, backup/log artifacts, and regenerated package `dist` / `build` outputs.
- [x] Revalidate touched packages and full workspace build
  - Note: targeted builds passed for `@universo/admin-frontend`, `@universo/profile-backend`, `@universo/core-backend`, and `@universo/core-frontend`; final root `pnpm build` passed with 27/27 successful tasks in 3m10.826s.
- [x] Update memory-bank state
  - Note: `tasks.md`, `activeContext.md`, and `progress.md` now reflect the completed repository-wide branding removal state.

### Orphaned CLI Flags Cleanup — 2026-03-15
> Status: COMPLETE — `packages/universo-core-backend/base/src/commands/base.ts` now keeps only live backend runtime flags; the legacy upstream passthrough surface for removed features and dead env aliases was deleted, and validation is green again.
- [x] Audit `base.ts` flags/forwarding against current runtime env consumers
- [x] Remove confirmed dead legacy flags and passthrough assignments from `base.ts`
- [x] Revalidate `@universo/core-backend` and full workspace build as needed
  - Note: `pnpm --filter @universo/core-backend build` and the final root `pnpm build` both passed; workspace build finished 27/27 successful tasks in 3m16.58s.
- [x] Update memory-bank state

### Telemetry Removal + Definitive ENV Files — 2026-03-15
- Status: COMPLETE — deleted Telemetry class, posthog-node dep, OMIT_QUEUE_JOB_DATA dead constant, all telemetry refs in tests; added previously undocumented live vars to both env files, then closed the QA follow-up gaps by documenting `ALLOW_TRANSACTION_POOLER`, `DATABASE_KNEX_POOL_DEBUG`, `DATABASE_SHUTDOWN_GRACE_MS`, `UNIVERSO_PATH`, and the legacy `FILE_SIZE_LIMIT` alias while removing leftover `DATABASE_TYPE` and structured `REDIS_*` legacy entries.
- [x] Delete `telemetry.ts`, remove imports/usage from `index.ts`, remove CLI flags from `base.ts`, remove `posthog-node` dep
- [x] Remove dead `OMIT_QUEUE_JOB_DATA` constant (zero consumers)
- [x] Rewrite `.env.example` with all live vars, no garbage: add AUTH_*, SESSION_COOKIE_*, SMARTCAPTCHA_*, HOST sections
- [x] Rewrite `.env` with matching structure preserving real credentials
- [x] Remediate QA follow-up gaps in `.env.example` and `.env`
  - Note: kept `DATABASE_POOL_MAX=5` active because `KnexClient` still defaults to 15 and the current Supabase Nano profile documented in the repo should stay capped at 5.
- [x] Build and validate (`pnpm build` — 27/27 successful)
- [x] Update memory-bank state (activeContext.md, progress.md)

### Environment Config Cleanup (.env.example + .env) — 2026-03-14
> Status: COMPLETE — removed ~52 dead environment variables from both `.env.example` and `.env`, added 3 undocumented live pool-timeout vars, restructured sections around live functionality only.
- [x] Clean `.env.example`: remove dead sections (APIKEY, SECRET KEYS, METRICS, MULTIPLAYER, SPACE BUILDER, QUEUE/BullMQ, legacy upstream vars), add missing Knex pool timeout vars
- [x] Clean `.env`: mirror the same structure, preserve all real credentials, remove orphaned legacy upstream/Space Builder/Multiplayer values
- [x] Verify no dead vars remain and all live vars present in both files

### Applications + Metahubs Migration Docs Refresh — 2026-03-14
> Status: COMPLETE — the migration docs for `@universo/applications-backend` and `@universo/metahubs-backend` now describe the current fixed-system-app bootstrap model, runtime migration surfaces, and package ownership boundaries consistently in English and Russian.
- [x] Rewrite `packages/applications-backend/base/MIGRATIONS.md` and `MIGRATIONS-RU.md` around the current fixed-system-app lifecycle
  - Note: document applications as a fixed application-like system app whose initial schema is bootstrapped from registered schema plans and platform SQL support migrations, while the package runtime surface owns sync/diff/release-bundle behavior rather than the application migration-control routes.
- [x] Rewrite `packages/metahubs-backend/base/MIGRATIONS.md` and `MIGRATIONS-RU.md` around the current metahub/application migration split
  - Note: document metahubs as the design-time system app plus branch runtime migration owner, including metahub migration status/list/plan/apply routes, application migration-control routes hosted here, and the publication-to-application ownership seam.
- [x] Revalidate touched documentation surfaces and sync memory-bank state
  - Note: EN/RU line parity closed at 89/89 for the applications pair and 94/94 for the metahubs pair; `pnpm --filter @universo/applications-backend build`, `pnpm --filter @universo/metahubs-backend build`, and the final root `pnpm build` all passed, with the workspace build finishing 27/27 successful tasks in 3m13.394s.
### REST Documentation Package Follow-Up Cleanup — 2026-03-14
> Status: COMPLETE — duplicated legacy tails were removed from the touched package markdown files, the package-level docs now contain only the current generated-docs guidance, and the targeted validation path is green again.
- [x] Remove duplicated legacy content from the regenerated rest-docs package docs and keep EN/RU guidance aligned
  - Note: `README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` now contain only the current-state guidance, with the stale appended historical sections fully removed.
- [x] Revalidate the cleaned package/docs surfaces and resync memory-bank state
  - Note: the final line-count check ended at 73/73 for `README.md` and `README-RU.md`, 76 for `ARCHITECTURE.md`, and 79 for `API_ENDPOINTS.md`; `pnpm --filter @universo/rest-docs validate`, `lint`, and `build` all passed after the cleanup.
### REST Documentation Package Refactor — 2026-03-14
> Status: COMPLETE — `@universo/rest-docs` now regenerates its OpenAPI source from the live mounted route files, historical route groups are removed, GitBook docs link to the interactive docs flow in English and Russian, and the final validation path is green.
- [x] Rebuild the OpenAPI entrypoint and modular path/schema structure around current route groups
  - Note: `scripts/generate-openapi-source.js` now regenerates `src/openapi/index.yml` from the live auth/profile/start/admin/applications/metahubs route files, and the removed unik/space/canvas/metaverse fragments were deleted from the package.
- [x] Replace stale package-level REST documentation with current operational guidance
  - Note: `README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` now describe the package as a generated current-state docs server and document its operational limits explicitly.
- [x] Add GitBook references and a short run-and-use guide for the API docs
  - Note: `docs/en|ru/api-reference/README.md`, `rest-api.md`, the new `interactive-openapi-docs.md`, and both `SUMMARY.md` files now point readers at the standalone Swagger workflow and explain how to build, start, and use it safely.
- [x] Revalidate the package and synchronized documentation surfaces end to end
  - Note: `pnpm --filter @universo/rest-docs validate`, `pnpm --filter @universo/rest-docs lint`, `pnpm --filter @universo/rest-docs build`, EN/RU line-count parity checks, and the final root `pnpm build` all passed; the workspace build finished with 27/27 successful tasks in 4m4.739s.
### Unified Database Access Standardization — Documentation and Agent Guidance Sync — 2026-03-14
> Status: COMPLETE — package READMEs, docs architecture pages, AGENTS guidance, and memory-bank architecture notes now describe the converged SQL-first access model consistently in English and Russian, with final parity checks and full workspace validation complete.
- [x] Refresh the relevant package README files in English and Russian
  - Note: the touched backend/runtime packages must explain the current tier model, where raw Knex is allowed, where SQL-first stores are mandatory, and how request-scoped RLS flows work now.
- [x] Refresh the public documentation in `docs/` for the converged database-access architecture
  - Note: the architecture page and contributing guidance should capture Tier 1/Tier 2/Tier 3 boundaries, `RETURNING` requirements, schema-qualified SQL, identifier helpers, and package-creation expectations.
- [x] Update the relevant package-level `AGENTS.md` files and the root `AGENTS.md`
  - Note: AI guidance should clearly distinguish transport-only Knex usage from domain SQL usage and point agents at the correct executor/helper patterns for this repository.
- [x] Sync the architecture-facing memory-bank files with the standardized rules
  - Note: `systemPatterns.md`, `techContext.md`, `activeContext.md`, and `progress.md` must reflect the unified PostgreSQL access posture and the documentation/agent-guidance closure state.
- [x] Revalidate the touched docs/guidance surfaces
  - Note: all touched EN/RU pairs were kept line-for-line in sync by structure, parity checks matched exactly, stale Knex guidance phrases were removed from package agents, and the final root `pnpm build` passed with 27/27 successful tasks in 3m44.843s.
### Unified Database Access Standardization — Post-Closure Remediation Wave — 2026-03-14
> Status: COMPLETE — the last red sync-persistence suite is fixed, metahub object mutations now fail closed, the suspected utils lock typing issue did not reproduce on current package validation, and the initiative is back in a clean closed state.
- [x] Reproduce the remaining red validation signals on the current branch
  - Note: only `@universo/applications-backend` `syncPersistenceStores.test.ts` was red on current branch; `@universo/utils` advisory-lock tests and package diagnostics were already green, so no utils code change was required.
- [x] Align applications-backend sync persistence tests with the SqlQueryable contract
  - Note: `syncPersistenceStores.test.ts` now validates the live `trx.query(...)` + `RETURNING id` contract instead of mocking obsolete Knex builder chains.
- [x] Harden metahub object delete, restore, and permanent delete paths to fail closed
  - Note: `MetahubObjectsService.delete(...)`, `restore(...)`, and `permanentDelete(...)` now use scoped predicates plus `RETURNING id` and throw explicitly when zero rows are affected.
- [x] Fix remaining touched type/lint issues and add direct regressions where coverage is missing
  - Note: the suspected utils typing issue was not reproducible under current validation, and the new `MetahubObjectsService.test.ts` adds direct service-level proof for the mutation contract.
- [x] Revalidate touched packages and full workspace, then resync memory-bank state
  - Note: `@universo/applications-backend` tests passed 84/84, `@universo/metahubs-backend` tests passed 230/233 with 3 expected skips, touched lints stayed error-free / warning-only, `node tools/lint-db-access.mjs` returned 0 violations, and the final root `pnpm build` passed with 27/27 successful tasks.
### Unified Database Access Standardization — Plan Completion Audit — 2026-03-14
> Status: COMPLETE — repository audit confirmed that all mandatory plan steps are implemented, only optional Phase 6 remains intentionally deferred, and the status files now reflect the closed state truthfully.
- [x] Audit the plan against implemented repository artifacts and validation evidence
- [x] Implement any remaining mandatory step or explicitly confirm only optional deferred work remains
- [x] Sync plan/memory-bank status files to the final closed state
  - Note: the audit confirmed CI lint integration, architecture docs, code review checklist, `getPoolExecutor()` rollout, and the applications-backend DDL boundary in code; no additional mandatory implementation gap remained beyond status synchronization, and a fresh `node tools/lint-db-access.mjs` rerun still returned 0 violations.
### Unified Database Access Standardization — Core Implementation and QA Closure Complete
> Plan: `memory-bank/plan/unified-database-standard-plan-2026-03-14.md`
> QA report: `memory-bank/plan/unified-database-standard-qa-report-2026-03-14.md`
> Status: COMPLETE — required phases, follow-up QA closures, and residual-debt fixes are implemented; only optional Phase 6 remains evaluated/deferred by plan design.
- [x] Incorporate R2 findings F11–F15 into plan
  - F11: `queryOneOrThrow` now throws `NotFoundError`, accepts optional error factory
  - F12: §9 import path corrected to `@universo/utils/database`
  - F13: Lint script Step 1.6 excludes `auth-backend/**/middlewares/**`
  - F14: Phase 4.1 fully specifies `PermissionServiceOptions` API change
  - F15: Step 1.5 includes `getPoolExecutor()` implementation body
- [x] Incorporate R3 findings F16–F20 into plan
  - F16: Lint script + Success Criteria #3 now have DDL subsystem exclusions for metahubs-backend
  - F17: Step 2.9 reworded — acknowledges existing `exec: SqlQueryable` constructor
  - F18: Duplicate KnexClient deletion removed from Step 2.9
  - F19: applicationMigrationsRoutes + metahubMigrationsRoutes explicitly listed in Step 2.13
  - F20: §5.1 clarified as dual-interface class, not two-class split
- [x] Incorporate gap analysis G1–G7 into plan
  - G1 MEDIUM: New Step 4.1b — core-backend executor factory wiring (11 call sites)
  - G2 LOW: Schema-qualified SQL rule in §2 Cross-Cutting Rules
  - G3 LOW: Phase 5.1 scope expanded to all domain routes
  - G4 LOW: Step 2.9 simplified — DDL uses getKnex() directly
  - G5 LOW: Step 4.2 notes R3 audit confirmed start-backend clean
  - G6 LOW: Code review checklist (9 criteria) added to §8
  - G7 LOW: SECURITY DEFINER standard documented
- [x] Phase 1: Foundation — shared primitives & lint rules
  - [x] 1.1 Create typed query helpers (queryMany/queryOne/queryOneOrThrow/executeCount with RETURNING requirement)
  - [x] 1.2 Create safe identifier helpers in `@universo/database` (qSchema/qTable/qSchemaTable/qColumn) + add migrations-core dep
  - [x] 1.3 Create DbExecutor-based advisory lock helpers with `assertLockTimeoutMs` validation
  - [x] 1.4 Create DbExecutor-based transaction helper reusing `buildSetLocalStatementTimeoutSql`
  - [x] 1.5 Add getPoolExecutor() factory to @universo/database
  - [x] 1.6 Create lint-db-access.mjs enforcement script (zero-violation, no baseline; DDL subsystem exclusions for metahubs-backend)
  - [x] 1.7 Build and validate
  - Note: completed with 271 tests passing across all foundation packages.
- [x] Phase 2: Metahubs-backend migration (10+ services, 10+ routes)
  - Note: all 8 service constructors converted to DbExecutor injection, 68 route handler call sites updated, KnexClient removed from production code, all copy transaction stubs rewritten from Knex builders to SqlQueryable trx mocks, schema name validation fixed in all test suites (mhb_test_schema → canonical mhb_<hex32>_bN). 31/31 test suites passing (215 tests), 0 lint errors, full workspace build clean.
- [x] Phase 3: Applications-backend migration (sync routes + 2 stores + remove local quoteIdentifier)
  - Note: ApplicationSchemaStateStore converted from KnexClient to getKnex(), 84/84 tests passing.
- [x] Phase 4: Auth-backend and remaining packages audit (incl. permissionService API change + **Step 4.1b core-backend wiring of 11 getPoolExecutor call sites**)
  - Note: core-backend createKnexExecutor call sites converted to getPoolExecutor, all 4 backend packages build clean.
### QA Remediation Wave — 2026-03-14
> QA found 60 lint violations, 3 unfinished plan items, medium-severity data integrity gap.
> Status: COMPLETE — Full compliance with plan Hard Requirements 1–8 and lint-db-access zero violations.
- [x] Fix lint-db-access.mjs: add `tests/` to directory skip, add DDL/migration file exclusions, fix false positives in error messages
- [x] Create DDL-level pool wrappers in domains/ddl/index.ts
- [x] Delete deprecated KnexClient wrapper from domains/ddl/index.ts
- [x] Migrate advisory locks in 5 route files → use pool wrappers, remove getKnex imports
- [x] Convert Knex read queries in publicationsRoutes.ts → raw SQL via getPoolExecutor
- [x] Convert Knex reads in metahubMigrationsRoutes.ts → raw SQL via getPoolExecutor
- [x] Fix sets copy TOCTOU: move codename resolution inside retry loop
- [x] Add RETURNING id to batch INSERTs in copy operations
- [x] Update 11 test file DDL mocks
- [x] Run lint-db-access → 0 violations, full test suite 31/31 (215 tests), pnpm build 27/27
- [x] Update memory-bank
### QA Follow-Up Completion Wave — 2026-03-15
> Remaining plan phases (5, 7, 8) + QA findings (M1, L1) implemented.
> Status: SUPERSEDED — this wave completed its scoped work, but a later QA audit reopened the initiative for additional service/test/docs gaps that were closed in the Final QA Closure Wave below.
- [x] M1: Add bridge comments to createKnexExecutor(trx) calls in publicationsRoutes.ts
- [x] L1: Remove dead backward compat exports from ddl/index.ts
- [x] Phase 5.1: CTE audit — 4 candidates in applicationsRoutes.ts evaluated; current UPDATE+RETURNING pattern already optimal (diagnostic SELECT only on rare error path; CTE consolidation would introduce snapshot race in error diagnosis under concurrent modification)
- [x] Phase 5.2: N+1 pattern audit — none found in information_schema queries
- [x] Phase 5.3: Pool tuning — already documented in .env.example with tier-scaling table
- [x] Phase 5.4: Statement timeout — already enforced in KnexClient.ts afterCreate (30s), tested
- [x] Phase 7.1: Integration contract tests — 9 tests in integration.test.ts (executor contract, request context isolation, cross-layer composition, released state)
- [x] Phase 7.2: Result normalization regression tests — 8 tests in query.test.ts (T[] guarantee, null vs undefined, Zod validation)
- [x] Phase 7.3: Security regression tests — 10 injection payloads × 4 identifier helpers in identifiers.test.ts
- [x] Phase 7.4: Lint CI integration — added `node tools/lint-db-access.mjs` step to .github/workflows/main.yml
- [x] Section 8: Documentation — systemPatterns.md (Unified Database Access Standard pattern), techContext.md (tier system), code review checklist (en + ru)
- [x] Final validation: lint-db-access 0 violations, @universo/database 111 tests, @universo/utils 231 tests, metahubs-backend 215 tests, pnpm build 27/27
### Final QA Closure Wave — 2026-03-14
> Reopened because the post-implementation QA audit found two service-level soft-delete/active-row regressions, incomplete Phase 7 proof, and missing architecture docs.
> Status: COMPLETE — direct service regressions, missing Phase 7 proof, Section 8 architecture docs, and final validation are all closed.
- [x] Fix `MetahubHubsService` active-row contract and replace hard delete with metahub soft delete
  - Note: `findAll`, `findById`, `findByCodename`, `findByIds`, `count`, and update prefetch must consistently ignore `_mhb_deleted=true` rows.
- [x] Fix `MetahubEnumerationValuesService` active-row contract for reads, updates, and deletes
  - Note: `findById`, update pre-read, and delete pre-read must fail closed for soft-deleted values; delete must stop hard-deleting active rows.
- [x] Add direct service-level regressions for hubs and enumeration values
  - Note: route tests mock these services, so the missing behavior must be proven directly against service SQL / transaction behavior.
- [x] Complete remaining Phase 7 proof for RLS / transaction / injection scenarios
  - Note: cover the missing cross-cutting behaviors that QA flagged as still unproven, reusing existing executor tests where appropriate and adding the missing scenarios instead of duplicating them.
- [x] Complete Section 8 architecture documentation and align affected package READMEs
  - Note: create `docs/en/architecture/database-access-standard.md` plus the Russian twin, update both `docs/*/SUMMARY.md`, and align touched package README surfaces with the unified access standard.
- [x] Revalidate touched packages, run full root `pnpm build`, and resync memory-bank status
  - Note: `node tools/lint-db-access.mjs` finished with 0 violations, touched package validation passed (`@universo/metahubs-backend`, `@universo/database`, `@universo/auth-backend`, docs check), and the final root `pnpm build` finished with 27/27 successful tasks.
### Residual Debt Closure Wave — 2026-03-14
> Reopened immediately after the closure audit because the final QA pass still found one architecture boundary gap in `applicationSyncRoutes.ts` and one generic identifier-safety gap in the shared optimistic-lock helper.
> Status: COMPLETE — the route file is back under lint coverage, raw application-sync transport access now lives behind a dedicated Tier 3 DDL boundary, the shared optimistic-lock helper validates dynamic identifiers, direct regressions are in place, and the acceptance path is green again.
- [x] Restore `applicationSyncRoutes.ts` to full lint coverage by removing direct `getKnex()` / `Knex` usage from the route file
  - Note: the route layer now consumes a dedicated applications-backend DDL boundary for transport acquisition, DDL service factories, and advisory locks.
- [x] Isolate application runtime sync helpers behind a dedicated applications-backend DDL boundary
  - Note: raw Knex ownership now lives in `packages/applications-backend/base/src/ddl/index.ts`, while the route orchestration stays transport-agnostic.
- [x] Harden `packages/metahubs-backend/base/src/utils/optimisticLock.ts` against unsafe dynamic column identifiers
  - Note: dynamic update keys now flow through `qColumn(...)` before SQL generation and fail closed on malformed identifiers.
- [x] Add direct regressions for the DDL boundary and optimistic-lock identifier safety
  - Note: `applicationSyncRoutes.test.ts` and `applicationSyncSeeding.test.ts` stayed green after the route boundary refactor, and the new `optimisticLock.test.ts` proves validated quoting plus malformed-identifier rejection.
- [x] Revalidate touched packages, rerun `node tools/lint-db-access.mjs`, rerun full root `pnpm build`, and resync memory-bank state
  - Note: `lint-db-access` returned 0 violations, touched lints stayed warning-only with no errors in the changed files, focused apps/metahubs regressions passed 26/26, and the final root `pnpm build` passed with 27/27 successful tasks.
### Phase 6 (Materialized Views) — EVALUATED, DEFERRED
> Phase 6 is explicitly "optional" in the plan. Evaluated: no current bottleneck justifies materialized views. Can be revisited if information_schema query performance becomes a measured issue.
### Standing Guards
- [ ] Wait for an explicit QA, live, or product trigger before reopening fixed system-app startup work
  - Note: the 2026-03-13 repeated-start stability closure is complete and no active defect remains in this area.
- [ ] Keep future fixed-system startup changes behind the repeated-start acceptance gate
  - Note: required end-state is focused validation, package lint/build, root `pnpm build`, second live `pnpm start`, and healthy HTTP response.
- [ ] Keep optional global catalog and release-bundle contracts fail-closed in future changes
  - Note: do not reintroduce metadata-only startup shortcuts, checksum-only bundle artifacts, or a second application release state store.

---
## Completed Waves — 2026-03-13
### Metahub QA Shared-Table Final Reopen Closure — 2026-03-13
> Status: COMPLETE — the last QA-found shared-table DnD consistency gap is closed, and the metahub/shared-table slice is back to a fully validated closed state.
- [x] Fix `FlowListTable` so `SortableContext` item ids always follow the actual rendered row order
  - Note: external `sortableItemIds` now act only as the allowed DnD id set, while the final id order comes from the visible filtered/sorted rows.
- [x] Add a direct regression for `sortableItemIds + sortableRows + column sort`
  - Note: `FlowListTable.test.tsx` now proves the filtered DOM order and the `SortableContext` item ids reorder together after explicit column sorting.
- [x] Revalidate the shared-table slice and resync memory-bank state
  - Note: `FlowListTable.test.tsx` passed 4/4, `@universo/template-mui` lint returned to warning-only status, and the final root `pnpm build` passed.
### Metahub QA Final Closure Wave — 2026-03-13
> Status: COMPLETE — the reopened QA cleanup slice is fully closed, including the remaining shared-table filtering defect, the backend active-row gap, direct regressions, and the last package-local error-level lint blocker surfaced during revalidation.
- [x] Fix `FlowListTable` so `filterFunction` still applies when `sortableRows` is enabled
  - Note: the shared table now filters the sorted row set before render, empty-state evaluation, and DnD id derivation.
- [x] Close the remaining `MetahubAttributesService.getAllAttributes(...)` active-row consistency gap
  - Note: `getAllAttributes(...)` now applies `_upl_deleted = false AND _mhb_deleted = false` through the query-builder path before ordering.
- [x] Add direct regressions for the reopened shared-table and backend consistency cases
  - Note: `FlowListTable.test.tsx` now proves `filterFunction + sortableRows`, and `MetahubAttributesService.test.ts` now proves active-row filtering on `getAllAttributes(...)`.
- [x] Clear the package-local `@universo/template-mui` error-level lint blocker discovered during revalidation
  - Note: the remaining Prettier failure in `src/hooks/optimisticCrud.ts` was removed so package lint returned to warning-only status.
- [x] Revalidate the reopened remediation slice and resync memory-bank state
  - Note: backend service regressions passed 4/4, shared-table regressions passed 4/4, `HubList.settingsReopen` passed 1/1, `@universo/template-mui` lint is warning-only, and the final root `pnpm build` passed.
### Metahub QA Follow-Up Remediation Wave — 2026-03-13
> Status: COMPLETE — the remaining runtime read-contract gap and missing regression proofs in the metahub/shared-table slice were closed and revalidated.
- [x] Add active-row filtering to runtime attribute raw SQL reads
  - Note: `countByObjectIds`, root attribute list, child attribute batch reads, and attribute-by-id lookup now reject `_upl_deleted` / `_mhb_deleted` rows consistently with the branch-schema contract.
- [x] Add a direct regression for hub-scoped settings reopen
  - Note: `HubList.settingsReopen.test.tsx` proves `HubList` reopens edit settings from `location.state.openHubSettings` and clears the one-shot state afterwards.
- [x] Add a direct shared-table regression for actual sortable row order
  - Note: `FlowListTable.test.tsx` now proves rows reorder when a sortable column is clicked even when `sortableRows` is enabled.
- [x] Revalidate the touched backend/frontend slice and resync memory-bank status
  - Note: focused backend/frontend/shared-table tests passed, touched package lint is error-free, the `@universo/template-mui` Jest bootstrap blocker was fixed, and root `pnpm build` passed.
### Metahub Post-Refactor Regression Closure Wave — 2026-03-13
> Status: COMPLETE — the four live metahub regressions reported after the global refactor were fixed and revalidated on the touched frontend/backend slice.
- [x] Restore settings-tab continuity across hub-scoped sibling pages
  - Note: `CatalogList`, `SetList`, and `EnumerationList` expose the hub Settings tab again and route back through `HubList` state to reopen hub settings.
- [x] Restore the nested-entity warning confirmation path
  - Note: redundant metahub-page `ConfirmContextProvider` wrappers were removed so page-level `useConfirm()` calls resolve against the root layout dialog/provider pair.
- [x] Restore shared table-column sorting without dropping DnD row ordering
  - Note: `FlowListTable` now keeps sortable headers active when `sortableRows` is enabled and preserves incoming DnD order until a sortable column is explicitly selected.
- [x] Move the hot metahub catalog/attribute read path back onto request-scoped SQL
  - Note: object, hub, attribute-count, child-attribute, and element-count reads on the failing page path now use `MetahubSchemaService.query(...)` instead of global Knex pool acquisition.
- [x] Revalidate the touched slice with focused tests, package builds, and a root build
  - Note: direct Vitest regression for `ChildAttributeList.optimisticCreate` passed, backend `attributesRoutes`/`catalogsRoutes` tests passed 37/37, touched package builds passed, and root `pnpm build` passed. The targeted `@universo/template-mui` Jest test remains blocked by an existing `ci-info` bootstrap failure (`vendors.map is not a function`), so package/build validation remains the current confidence gate for that shared-table path.
### Fixed System App Restart Stability Wave — 2026-03-13
> Status: COMPLETE — repeated startup now reuses the valid local fixed-system snapshot contract instead of rejecting it as malformed.
- [x] Reproduce the repeated-start failure in the live startup compiler path
  - Note: the second startup failed with `malformed snapshotAfter` after a clean first bootstrap wrote local `_app_migrations` history.
- [x] Fix `readLatestSystemAppSnapshot(...)` to validate the canonical `SchemaSnapshot.entities` shape
  - Note: `snapshotAfter.entities` is a record/object map, not an array; the reader now matches the shared schema-ddl contract.
- [x] Align stale compiler regressions with the live snapshot and migrator contracts
  - Note: `systemAppSchemaCompiler.test.ts` no longer uses array-shaped snapshot fixtures or outdated `applyAllChanges` expectations.
- [x] Add a direct repeated-start regression and rerun validation
  - Note: `@universo/migrations-platform` full suite passed 105/105, focused lint passed, package build passed.
- [x] Revalidate the live runtime path and update memory-bank state
  - Note: root `pnpm build` passed, second live `pnpm start` stayed healthy, and `curl -I http://127.0.0.1:3000/` returned `HTTP/1.1 200 OK`.
### Optional Global Catalog Final Integrity Closure Wave — 2026-03-13
> Status: COMPLETE — the last post-QA integrity debt in delete cascade ordering and fixed-system evolution was closed.
- [x] Fix application delete cascade ordering for connector-publication cleanup
  - Note: `rel_connector_publications` is now soft-deleted before `cat_connectors`, so active link rows cannot survive connector cleanup ordering.
- [x] Replace existence-only fixed-system startup with local-history-driven drift handling
  - Note: fixed system apps now read canonical local `_app_migrations`, compute diff/apply, and record real incremental upgrades when the compiled target drifts.
- [x] Harden shared schema-ddl recorded-apply behavior for fixed-schema evolution
  - Note: physical names, explicit SQL defaults/types, capability-gated system tables, and explicit migration names are preserved during recorded apply flows.
- [x] Remove accidental generated artifacts from `@universo/migrations-core/src`
  - Note: `.js`, `.d.ts`, and `.d.ts.map` garbage was removed and the package `clean` script now removes the same patterns deterministically.
- [x] Revalidate focused suites and the full workspace build
  - Note: targeted regressions passed for applications-backend 9/9, schema-ddl 4/4, migrations-platform compiler 23/23, touched package builds passed, root `pnpm build` passed.
### Optional Global Catalog QA Closure Remediation Wave — 2026-03-13
> Status: COMPLETE — release-bundle snapshot provenance and Phase 8 regression coverage are now fail-closed and direct.
- [x] Recompute embedded snapshot hashes instead of trusting `manifest.snapshotHash`
  - Note: bundle validation now derives the canonical hash from the embedded snapshot and rejects tampered provenance.
- [x] Route lineage and install metadata through the recomputed canonical hash
  - Note: metadata persistence and release lineage now use the derived snapshot identity rather than the raw manifest field.
- [x] Add missing Phase 8 regression proof in the touched packages
  - Note: tests now cover tampered snapshot hashes, nullable `globalRunId`, disabled-mode local history persistence, and enabled-mode fail-closed mirror aborts.
- [x] Re-run focused validation for the touched release-bundle/runtime packages
  - Note: applications-backend tests passed 82/82, lint passed, targeted migration manager/system table regressions passed, package build passed.
- [x] Sync memory-bank status after full validation
  - Note: final root `pnpm build` passed and the optional global catalog/runtime migration plan returned to closed status.
### Optional Global Catalog True Final Closure Wave — 2026-03-13
> Status: COMPLETE — release bundles now carry deterministic executable payloads for both bootstrap and incremental execution.
- [x] Extend `application_release_bundle` with executable payloads
  - Note: both bootstrap and incremental artifacts now embed deterministic executable payloads plus canonical schema snapshots.
- [x] Route real execution paths through embedded payloads
  - Note: fresh installs use `bootstrap.payload.entities`, upgrades use `incrementalMigration.payload.entities`.
- [x] Add direct integrity regressions for payload and checksum validation
  - Note: corrupted executable artifacts now fail with `400 Invalid release bundle` before any schema execution begins.
- [x] Preserve existing release-lineage and install-state boundaries
  - Note: the central `installed_release_metadata` seam in `applications.cat_applications` remains the only application release-state store.
- [x] Revalidate the touched slice and full workspace
  - Note: applications-backend tests passed 80/80, lint passed, root `pnpm build` passed.
### Optional Global Catalog Final Debt Closure Wave — 2026-03-13
> Status: COMPLETE — ambiguous baseline apply on legacy schema-bearing targets now fails closed, and disabled-mode mirroring is covered directly.
- [x] Harden bundle apply for schema-bearing targets without tracked installed release metadata
  - Note: baseline bundles are now rejected when the target already has `schema_name` but lacks trusted lineage.
- [x] Keep true fresh-install behavior unchanged
  - Note: fresh installs still use the existing baseline/bootstrap path when no runtime schema exists.
- [x] Add disabled-mode mirroring regression coverage at the actual mirror entry point
  - Note: `mirrorToGlobalCatalog(...)` now has a direct regression proving it returns `null` without catalog writes when disabled.
- [x] Add route-level regression coverage for the legacy existing-schema guard
  - Note: bundle apply now fails before schema existence, diff, or apply work begins on ambiguous legacy targets.
- [x] Revalidate touched packages and root build
  - Note: applications-backend tests/lint and migrations-catalog tests/lint passed, root `pnpm build` passed.
### Optional Global Catalog Final Closure Wave — 2026-03-13
> Status: COMPLETE — application-origin release-bundle export, runtime parity, executable evidence, and live smoke are all closed.
- [x] Fix application-origin release-bundle lineage so upgrades keep a real prior-version to new-version transition
  - Note: runtime-origin export now preserves real upgrade provenance instead of collapsing both sides onto one installed version.
- [x] Bring runtime-origin export into canonical snapshot parity with publication bundles
  - Note: top-level set constants and runtime metadata/data reconstruction now follow the canonical bundle shape.
- [x] Add executable Phase 8 regressions for runtime-origin export and apply
  - Note: direct regressions prove upgrade apply, unchanged runtime re-export lineage reuse, and the empty-install fast path.
- [x] Run live UP-test smoke from this workspace
  - Note: direct SQL smoke reached the target, `pnpm migration:status` reported `apply=0`, `skip=12`, `drift=0`, `blocked=0`, and live `pnpm start` returned `pong` on `/api/v1/ping`.
- [x] Revalidate and resync memory-bank state
  - Note: focused applications-backend validation passed and the final root build passed again.
### Optional Global Catalog Architecture Closure Wave — 2026-03-13
> Status: COMPLETE — the backend/runtime architecture is now stable in both disabled and enabled catalog modes.
- [x] Replace remaining raw global-catalog env parsing with the shared helper contract
  - Note: touched startup, runtime, and CLI paths now consume the shared `@universo/utils` parser.
- [x] Complete application-owned runtime release-bundle export from application data/state
  - Note: runtime export reconstructs the canonical snapshot from `_app_objects`, `_app_attributes`, `_app_values`, runtime data, layouts, and widgets.
- [x] Keep local migration history canonical in disabled mode and fail closed in enabled mode
  - Note: `_app_migrations` / `_mhb_migrations` remain canonical locally, while enabled-mode mirror failures abort instead of degrading silently.
- [x] Publish mirrored operator docs for optional global catalog modes
  - Note: English and Russian docs were added and linked through architecture README/SUMMARY files with verified line parity.
- [x] Revalidate the full architecture slice
  - Note: focused package tests/lint passed and the final root build passed.
### QA Remnant Fix Wave — 2026-03-13
> Status: COMPLETE — the last four findings from the comprehensive QA analysis were closed without reopening unrelated areas.
- [x] Fix `ApplicationSchemaStateStore.ts` table targeting and active-row predicates
  - Note: `.table('applications')` became `.table('cat_applications')` with dual-flag active-row filtering.
- [x] Clear six error-level Prettier failures in metahubs-backend
  - Note: only touched formatting debt was removed; no behavioral change was introduced.
- [x] Add missing `activeAppRowCondition()` usage in `globalAccessService.ts`
  - Note: three UPDATE queries and one SELECT now reject soft-deleted rows correctly.
- [x] Remove dead duplicate `ConnectorSyncTouchStore.ts`
  - Note: the unused metahubs-side duplicate had a wrong table name and no dual-flag guard; the applications-owned version remains canonical.
- [x] Revalidate tests, lint, and root build
  - Note: metahubs/admin tests passed, lint is error-free in the touched packages, and root `pnpm build` passed.
### QA Blocker Closure Wave — 2026-03-13
> Status: COMPLETE — the last live red surfaces were closed without weakening the actual runtime contracts.
- [x] Reproduce the still-red QA blockers on the live branch
  - Note: the failing surfaces were confirmed in migrations-core tests/lint, schema-ddl lint, and core-backend lint.
- [x] Fix the managed-owner validation mismatch at the test contract instead of weakening runtime validation
  - Note: the broken test input was replaced with a canonical UUID while strict runtime validation stayed intact.
- [x] Narrow `@universo/migrations-core` lint to implementation sources
  - Note: package lint now ignores committed/generated `src/**/*.d.ts` output and evaluates actual implementation files.
- [x] Restore the package-level core-backend lint gate and clear touched format debt
  - Note: schema-ddl and core-backend error-level lint debt on the touched path was removed.
- [x] Revalidate focused packages and root build
  - Note: migrations-core, schema-ddl, and core-backend passed their focused validation, and the final root build passed.
### QA Closure Completion Wave — 2026-03-13
> Status: COMPLETE — operational lifecycle recording, browser env compatibility, dependency-aware registry drift detection, and managed owner-id validation are locked down.
- [x] Record definition export lifecycle rows for bundle-oriented catalog exports
  - Note: CLI export, doctor, and registry lifecycle state now observe the same export recording seam.
- [x] Restore browser env precedence and Vite compatibility in shared helpers
  - Note: precedence is `__UNIVERSO_PUBLIC_ENV__` -> `import.meta.env` -> `process.env` -> browser origin.
- [x] Make registry drift detection dependency-aware rather than SQL-text-only
  - Note: stable artifact payload signatures now prevent dependency-only changes from being treated as unchanged.
- [x] Harden managed owner-id validation against silent normalization collisions
  - Note: only canonical UUID or 32-character lowercase hex owner ids are accepted for managed schema naming.
- [x] Revalidate focused suites and the full workspace
  - Note: migrations-catalog/platform, utils, and migrations-core validation passed, touched lint passed, store build passed, root `pnpm build` passed.
### QA Plan Completion Wave — 2026-03-13
> Status: COMPLETE — only the real remaining defects were fixed after revalidation, and the end-to-end slice is green again.
- [x] Align doctor lifecycle checks with the real sync/export-target contract
  - Note: doctor now accepts any export row recorded for the active published revision instead of a single hardcoded target.
- [x] Restore package-local Jest execution for the metahubs parity suite
  - Note: shared backend Jest mapping now resolves `@universo/database` correctly for the package-local suite.
- [x] Add cross-package acceptance coverage for publication-created application sync
  - Note: a core-backend router-level regression now proves publication creation and application sync remain connected end to end.
- [x] Re-run focused validation for the touched packages
  - Note: migrations-platform, metahubs-backend parity, and core-backend composition regressions all passed.
- [x] Finish with a final root build and memory-bank sync
  - Note: root `pnpm build` passed and the verified closure state was recorded.
### Definition Lifecycle Closure Wave — 2026-03-13
> Status: COMPLETE — the DB/file definition lifecycle now runs through the real draft -> review -> publish path in active platform flows.
- [x] Route live imports through lifecycle-aware draft/review/publish helpers
  - Note: `importDefinitions()` no longer bypasses the real lifecycle path for incomplete imports.
- [x] Preserve published provenance on created, updated, and unchanged revisions
  - Note: first publication from a draft-backed shell is now classified correctly and merged safely.
- [x] Require published lifecycle provenance in bulk no-op and doctor checks
  - Note: pre-fix direct-import rows are repaired instead of being treated as healthy forever.
- [x] Persist raw JSON imports as file-sourced lifecycle imports
  - Note: operational import provenance now matches platform sync semantics.
- [x] Revalidate focused packages and root build
  - Note: migrations-catalog/platform tests passed, package lint/build passed, root `pnpm build` passed.
### QA Deep Remediation Wave 2 — 2026-03-13
> Status: COMPLETE — the second deep QA pass closed cross-package dual-flag and cascade gaps that survived the earlier remediation wave.
- [x] Add `activeAppRowCondition()` to the remaining nine application query helpers
  - Note: all touched SELECT, UPDATE, and sub-select queries across `cat_applications`, `cat_connectors`, `rel_connector_publications`, and `rel_application_users` now reject deleted rows.
- [x] Add child-first soft-delete for `doc_publication_versions` in metahub cascade delete
  - Note: publication versions now delete before publications.
- [x] Add the same child-first ordering for individual publication delete
  - Note: direct publication delete now cascades versions before deleting the publication row.
- [x] Add active-row predicates to the metahub stats endpoint inline queries
  - Note: publications, publication versions, and applications counts now ignore deleted rows.
- [x] Revalidate the touched slices and root build
  - Note: focused regressions passed and the final root build passed again.
### QA Final Remediation Wave 1 — 2026-03-13
> Status: COMPLETE — the first final QA remediation wave closed the remaining dual-flag and migration idempotency gaps.
- [x] Set both `_upl_deleted` and `_app_deleted` during metahub cascade delete
  - Note: child rows now receive the full dual-flag soft-delete contract instead of partial deletion metadata.
- [x] Add `activeAppRowCondition()` to `countUsersByRoleId()` and `listRoleUsers()`
  - Note: role user reads now reject deleted rows consistently.
- [x] Add dual-flag filtering to `findTemplateById()`
  - Note: template reads now align with the converged active-row contract.
- [x] Wrap five bare `ALTER TABLE ADD CONSTRAINT` statements with idempotent guards
  - Note: the migration now tolerates repeated startup/replay safely.
- [x] Revalidate focused regressions and root build
  - Note: touched tests passed and the workspace build stayed green.
### QA-Discovered Store/Service Layer Fixes — 2026-03-13
> Status: COMPLETE — persistence-layer SQL contracts now match the converged DDL schema and active-row rules.
- [x] Rename stale admin/profile/app SQL column references to converged `_upl_*` names
  - Note: touched stores, services, routes, and frontend types now match the real DDL contract.
- [x] Replace single-flag soft-delete checks with dual-flag active-row helpers
  - Note: `activeAppRowCondition()` now protects the touched queries consistently.
- [x] Replace physical delete in profile persistence with the shared dual-flag soft-delete contract
  - Note: `softDeleteSetClause()` now drives the touched delete path.
- [x] Export the shared helper surface through the root `@universo/utils` barrel
  - Note: touched packages can consume the canonical helper surface without subpath drift.
- [x] Validate the persistence-layer remediation with full build
  - Note: the touched package set was updated and root `pnpm build` finished green.
### QA Follow-up Remediation Closure — 2026-03-13
> Status: COMPLETE — the follow-up QA wave resynced memory-bank state and closed the remaining active-row and compensation-test drift.
- [x] Reopen and resync memory-bank state with the real remediation status
  - Note: `tasks.md` and `activeContext.md` no longer claimed closure prematurely.
- [x] Close remaining auth/admin profile active-row gaps
  - Note: touched profile existence, update, search, hydration, and consent flows now require active rows.
- [x] Stabilize publication compensation regressions against brittle SQL call ordering
  - Note: cleanup assertions now verify behavior directly instead of depending on mock call indexes.
- [x] Re-run focused package lint/test validation
  - Note: auth-backend, admin-backend, and targeted metahubs-backend checks passed.
- [x] Finish with a full root build and memory sync
  - Note: root `pnpm build` passed and the wave closed cleanly.
### Ownership And Validation Closure Wave — 2026-03-12
> Status: COMPLETE — the publication-runtime seam now respects package ownership, tests are repeatable, and live startup serves HTTP successfully.
- [x] Remove the remaining publication/application sync ownership leak
  - Note: metahubs-backend now exposes only publication runtime-source loading, while applications-backend owns sync-context adaptation.
- [x] Restore repeatable package-level Jest forwarding for touched backend packages
  - Note: the shared Jest wrapper now forwards args correctly instead of turning them into false patterns.
- [x] Revalidate touched runtime paths after the refactor
  - Note: focused backend suites and migrations-platform regressions passed, and root `pnpm build` passed.
- [x] Recheck live startup behavior on port 3000
  - Note: `pnpm start` completed bootstrap and the workspace served `HTTP/1.1 200 OK` on `http://127.0.0.1:3000/`.
- [x] Sync memory-bank state after validation
  - Note: active context and progress were updated to the verified closure state.
### QA Debt Closure Wave — 2026-03-12
> Status: COMPLETE — only the real residual debt still present on the branch was fixed after revalidation.
- [x] Revalidate the remaining QA blockers against the live branch
  - Note: the previously suspected compiler blocker no longer reproduced, so this wave stayed focused on the debt that remained real.
- [x] Close backend technical-debt findings from the QA pass
  - Note: touched stores moved to explicit returning contracts, admin revocation uses soft-delete, and metahub compensation cleanup is now safe.
- [x] Add acceptance-oriented regressions around the still-real cleanup surfaces
  - Note: touched service and route regressions now cover the live failure/cleanup seams that were still open.
- [x] Remove touched frontend tooling deprecation debt
  - Note: the shared MUI template SCSS entrypoint now uses Sass `@use` instead of deprecated `@import`.
- [x] Re-run focused validation and root build
  - Note: targeted backend tests passed and the final root workspace build passed.
### System-App Definition Cutover And QA Closure — 2026-03-12
> Status: COMPLETE — fixed application-like system apps now bootstrap through definition-driven schema-ddl plans plus phased support migrations.
- [x] Move fixed-system business-table creation to definition-driven schema generation
  - Note: applications, profile, admin, and metahubs bootstrap through registered schema plans before metadata bootstrap.
- [x] Remove remaining fixed-schema business-table creation from active manifest chains
  - Note: active manifest migrations now keep only auxiliary setup that schema-ddl does not express directly.
- [x] Converge touched predicates and security helpers on the real runtime contract
  - Note: direct dual-flag predicates and deterministic execute privileges are now enforced across touched paths.
- [x] Repair and extend compiler/bootstrap regressions for the new path
  - Note: registry, compiler, startup, manifest parity, and security suites now validate the definition-driven bootstrap model.
- [x] Revalidate touched packages and root build
  - Note: focused backend/platform suites passed and root `pnpm build` passed.
### Startup Runtime Regression Remediation — 2026-03-13
> Status: COMPLETE — repeated startup skips unnecessary fixed metadata and catalog work when runtime state is already aligned.
- [x] Add a safe metadata no-op fast path for already-aligned fixed system apps
  - Note: startup now compares a deterministic live-vs-compiled metadata fingerprint before replaying metadata sync.
- [x] Add a safe registered-definition catalog no-op fast path
  - Note: bulk preflight checks skip `registerDefinition()` and export writes for unchanged artifacts.
- [x] Keep the full bootstrap path as the fallback on drift
  - Note: startup still heals metadata/catalog state when fingerprints or export rows drift.
- [x] Add focused repeated-start regressions for the no-op path and drift fallback
  - Note: already-initialized startup behavior is now covered directly in tests.
- [x] Re-run focused validation and final root build
  - Note: touched suites passed and the final workspace build passed.
### System-App Structural Convergence QA Remediation Closure — 2026-03-12
> Status: COMPLETE — the remaining QA findings after structural convergence were closed on the live schema model.
- [x] Target converged `cat_*` tables in application sync persistence helpers
  - Note: fresh-DB sync flows and connector/application sync-state writes now match the converged schema names.
- [x] Remove the applications legacy reconcile migration from the active manifest path
  - Note: fresh bootstrap now follows the canonical creation path only.
- [x] Complete applications dual-flag soft-delete parity across touched delete paths
  - Note: touched writes now set `_upl_*` and `_app_*` delete fields together.
- [x] Replace stale COALESCE-based helpers with direct dual-flag predicates where convergence guarantees apply
  - Note: touched runtime and persistence paths now use explicit active-row conditions.
- [x] Revalidate focused suites and root build
  - Note: applications-backend, start-backend, and migrations-platform validation passed and root `pnpm build` stayed green.
### System-App Structural Convergence Implementation — 2026-03-12
> Status: COMPLETE — the full implementation plan landed and the final workspace build is green.
- [x] Converge admin, profile, metahubs, and applications platform migrations onto the application-like model
  - Note: all four system-app migrations were rewritten or folded into the converged physical contract.
- [x] Add shared SQL helpers for direct active-row predicates and soft-delete writes
  - Note: `activeAppRowCondition()` and `softDeleteSetClause()` became the canonical touched-slice helpers.
- [x] Update touched stores, aliases, and tests from `_mhb_*` platform fields to `_app_*`
  - Note: platform catalog tables now expose the converged field family consistently.
- [x] Remove dead code and stale migration/test references that the plan folded away
  - Note: orphaned migrations and stale test expectations were cleaned up in the same wave.
- [x] Validate the full implementation with root build
  - Note: root `pnpm build` passed 27/27.
### QA Closure Completion Wave 2 — 2026-03-13
> Status: COMPLETE — manifest validation parity, copy persistence coverage, fixed-bootstrap acceptance proof, and mirrored architecture docs are in place.
- [x] Align manifest validation limits with real `VARCHAR(N)` storage contracts
  - Note: profile `nickname` and admin role `codename` now cap validation at the actual physical limit.
- [x] Add direct persistence-level copy regression coverage
  - Note: application copy flows now have dedicated tests for access guards, option handling, and propagated failures.
- [x] Promote fixed-bootstrap proof into executable cross-package acceptance coverage
  - Note: core-backend acceptance now asserts the fresh-bootstrap contract for all fixed application-like schemas.
- [x] Publish mirrored architecture docs for fixed system-app convergence
  - Note: English and Russian docs plus README/SUMMARY links now have verified parity.
- [x] Revalidate focused suites and the root build
  - Note: targeted Jest, lint, docs parity, and the final workspace build all passed.
### Frontend Acceptance Coverage Burst — CRUD, Navigation, and Runtime Shells — 2026-03-12
> Status: COMPLETE — page-level acceptance coverage now exists for the main user-facing CRUD and navigation surfaces.
- [x] Add list-level acceptance coverage for application, metahub, and connector create/edit/copy/delete flows
  - Note: the touched suites now prove localized payload forwarding through the existing page shells without new wrappers.
- [x] Add acceptance coverage for connector detail navigation and application control-panel navigation
  - Note: current list pages now have explicit route-level proof for detail/admin navigation flows.
- [x] Add runtime-shell acceptance coverage for `ApplicationRuntime`
  - Note: loading state, error state, and create-action wiring through `useCrudDashboard` are now covered.
- [x] Add publication-to-application page-level acceptance coverage
  - Note: `PublicationApplicationList` now proves linked-application creation and runtime/admin row actions.
- [x] Revalidate the touched frontend packages and root build
  - Note: focused ESLint/Vitest/build checks passed for applications-frontend and metahubs-frontend, and the root build stayed green.
### Frontend Acceptance Coverage Burst — Sync Flows and Migration Guards — 2026-03-12
> Status: COMPLETE — direct user-facing sync dialogs, sync mutations, migration screens, and migration guards are covered.
- [x] Add dialog-level acceptance coverage for connector/publication diff dialogs
  - Note: safe apply, destructive apply, and disabled syncing states are now covered.
- [x] Add mutation-level acceptance coverage for connector and publication sync hooks
  - Note: success, pending-confirmation, and error branches now have explicit query invalidation proof.
- [x] Add page-level acceptance coverage for `ConnectorBoard`, `PublicationList`, and `MetahubMigrations`
  - Note: sync button wiring, destructive confirmation, and apply gating are now covered at the page shell.
- [x] Add interactive acceptance coverage for `ApplicationMigrationGuard` and `MetahubMigrationGuard`
  - Note: mandatory update gating, admin bypass, under-development, maintenance, blocker states, and apply errors are all covered.
- [x] Revalidate the touched frontend packages and root build
  - Note: focused ESLint/Vitest/build checks passed for the touched slices and the root build stayed green.
### Fixed-System Metadata, Legacy Reconciliation, and Compiler Foundation Burst — 2026-03-12
> Status: COMPLETE — metadata bootstrap observability, doctor/startup gates, legacy-schema reconciliation, and compiler metadata preservation are in place.
- [x] Add fixed-system metadata bootstrap observability and CLI entry points
  - Note: bootstrap now reports object and attribute counts and is callable through both platform and backend CLI surfaces.
- [x] Add doctor/startup fail-fast gates for incomplete fixed-system metadata and leftover legacy table names
  - Note: platform doctor, sync, and startup now reject incomplete metadata or mixed legacy physical models.
- [x] Add forward-only reconciliation bridges for legacy profile, admin, applications, and metahubs fixed schemas
  - Note: old physical tables are renamed or merged into the converged `cat_` / `cfg_` / `doc_` / `rel_` targets safely.
- [x] Preserve explicit object/attribute metadata through compiler artifacts and validation gates
  - Note: compiled artifacts now prove manifest metadata preservation instead of relying on synthetic defaults alone.
- [x] Revalidate touched backend/platform packages and root build
  - Note: focused regressions and standalone package builds passed, and the root workspace build remained green.
## Completed Waves — 2026-03-11
### Catalog, Registry, and Master-Plan Closure Burst — 2026-03-11
> Status: COMPLETE — the architecture foundation for system-app registry lifecycle, runtime sync ownership, and bundle/doctor behavior is in place.
- [x] Move application runtime sync ownership into `@universo/applications-backend`
  - Note: metahubs-backend now supplies publication context only; applications-backend owns sync routes/orchestration.
- [x] Turn the definition registry lifecycle into a real draft/review/publish/export/import contract
  - Note: lifecycle state, approval events, export rows, and canonical bundles are now real operational behavior rather than storage-only scaffolding.
- [x] Strengthen bootstrap and doctor lifecycle visibility
  - Note: startup and doctor now fail or report actionable issues when lifecycle/export state is missing after bootstrap/sync.
- [x] Add deep acceptance proof for bootstrap, registry lifecycle, and publication-driven runtime sync
  - Note: focused regressions now cover the live seams that the long-range plan depended on.
- [x] Revalidate focused packages and root workspace gates
  - Note: targeted tests/builds passed and the final root workspace build was green.
### Shared Schema Naming and Qualification Adoption Burst — 2026-03-11
> Status: COMPLETE — canonical schema naming moved to shared helpers and the touched runtime/bootstrap paths now consume it consistently.
- [x] Replace local branch/runtime schema-name builders with shared migrations-core helpers
  - Note: the existing `app_<uuid32>` and `mhb_<uuid32>_bN` contracts were preserved exactly while duplication was removed.
- [x] Adopt shared schema-target resolution in touched bootstrap utilities
  - Note: runtime/bootstrap paths now use the shared helper contract instead of local drift-prone builders.
- [x] Align focused regressions with the canonical naming helpers
  - Note: tests now lock down naming compatibility and invalid-schema rejection on the touched paths.
- [x] Keep publication compensation and cleanup checks on canonical managed-schema names
  - Note: cleanup validation now uses the shared schema helper surface rather than route-local assumptions.
- [x] Revalidate focused suites and package builds
  - Note: schema-ddl and metahubs-backend validation passed and the touched lint/build surface remained green.
### Planning Baseline Retained — Structural Convergence Program
> Status: OPEN AS REFERENCE ONLY — implementation is already complete; the old plan section remains here only as historical context for future audits.
- [x] Preserve the corrected plan narrative as a historical checkpoint
  - Note: QA-corrected planning details remain useful for future audit trails even though the implementation has already landed.
- [x] Keep the implementation/result split explicit
  - Note: new work should use the completed convergence entries above, not reopen the original planning checklist.
- [x] Keep future reopen decisions tied to live triggers instead of plan churn
  - Note: no planning-only reopen should happen without a real defect or product requirement.
- [x] Keep references to the completed convergence artifacts discoverable
  - Note: progress.md remains the durable record for the actual delivered waves.
- [x] Treat this section as archive context, not an active work queue
  - Note: it remains checked only to prevent accidental reuse as a live task list.
### Fixed-System Compiler Metadata Expansion Burst — 2026-03-12
> Status: COMPLETE — fixed-system manifests, compiler artifacts, and metadata preservation gates were expanded before the final convergence closure.
- [x] Add richer field-level metadata support for fixed system-app manifests
  - Note: explicit table/field presentation, validation rules, and UI config now survive the manifest-to-compiler bridge.
- [x] Expand remaining fixed-system manifests with explicit metadata and internal REF targets
  - Note: admin, applications, and metahubs now declare stable business metadata instead of relying on synthetic defaults alone.
- [x] Add compiled object/attribute artifacts and preservation validation
  - Note: compiled artifacts now prove object/attribute metadata integrity for `_app_objects` / `_app_attributes` bootstrap.
- [x] Harden standalone package builds for the touched migration packages
  - Note: source-fallback resolution now avoids dependency on prebuilt neighbor `dist` output.
- [x] Revalidate focused platform/backend packages and root build
  - Note: touched migrations-core, migrations-platform, and owner-package checks passed and the root workspace stayed green.
### Registry and Acceptance Hardening Burst — 2026-03-11
> Status: COMPLETE — registry lifecycle, export dedupe, workspace validation, and deep acceptance proof were hardened before later closure waves.
- [x] Enforce lifecycle governance for draft/review/publish transitions
  - Note: callers can no longer skip review-state guarantees or bypass approval-event recording on the touched lifecycle paths.
- [x] Make export recording idempotent and race-safe
  - Note: repeated export targets now reuse the existing lifecycle row instead of failing under uniqueness constraints.
- [x] Add deep acceptance proof for publication-driven runtime sync and bootstrap lifecycle behavior
  - Note: the touched suites now prove real success-path composition instead of only isolated helper behavior.
- [x] Stabilize the touched root/frontend validation gates
  - Note: the workspace Vitest path was revalidated after the acceptance and lifecycle hardening changes.
- [x] Finish with green focused validation and root `pnpm build`
  - Note: later 2026-03-13 closure waves depended on this foundation remaining green and trustworthy.
