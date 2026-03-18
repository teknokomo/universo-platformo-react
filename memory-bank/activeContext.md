# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: PR #729 Bot Review Fixes — Applied

- Date: 2026-03-19.
- Addressed all valid bot review comments from PR #729 (Copilot + Gemini Code Assist):
  1. **StatCard NaN/Infinity** — `buildRealisticTrendData()` now guards `points <= 0` (return `[]`) and `points === 1` (return single-element array), preventing division by zero in `i / (points - 1)`.
  2. **OnboardingWizard CTA** — "Start Acting" button now `disabled={completionLoading || !onComplete}` so optional `onComplete` prop doesn't create a no-op CTA.
  3. **Codename regex unification** — All codename validation (CreateRoleSchema, UpdateRoleSchema, CopyRoleSchema, RoleFormDialog frontend) unified to `/^[a-z][a-z0-9_-]*$/` — must start with letter (stricter than before) while preserving dashes (required by `slugifyCodename()` → `@justrelate/slugify`).
- Gemini's suggestion to use `/^[a-z][a-z0-9_]*$/` (no dashes) was rejected as incompatible with auto-generated codenames like `content-editor`.
- Validation: lint 0 errors across all touched packages, RoleFormDialog 6/6 tests pass, full root build 28/28 tasks.
- Pending: push updated commit to PR #729 branch.

## Previous Focus: QA Closure — Post-Implementation Fixes Complete

- Date: 2026-03-19.
- Two residual QA defects from the comprehensive code audit have been closed:
  1. Removed dead-code `.default(true)` from `includeSystem` schema in `admin-backend/rolesRoutes.ts` — the `z.preprocess()` already converts `undefined` to `true`, making the Zod default unreachable.
  2. Added `notifySubscribers({})` call to `resetUserSettingsCache()` in `useUserSettings.ts` — without this, active `useUserSettings()` hook instances would retain stale settings state after auth-transition cache reset until component remount.
- Validation: admin-backend lint 0 errors, 6/6 suites (34 tests); template-mui build OK; full root build 28/28 tasks in 2m56s.
- No remaining technical debt from the QA audit.

## Previous Focus: Superuser Metahub Visibility Fix Complete

- Date: 2026-03-18.
- Root cause identified and fixed: `z.coerce.boolean()` in Zod query parameter schemas was converting the string `"false"` (from Express `req.query`) via `Boolean("false")` which returns `true`. This meant the `showAll` parameter was always `true` for any value sent by the frontend, causing superusers to always see all metahubs regardless of the "Show other users' items" setting.
- Fix applied to three packages: `metahubs-backend`, `applications-backend`, and `admin-backend` — replaced `z.coerce.boolean()` with `z.preprocess((val) => val === 'true' || val === true, z.boolean())` which correctly handles string query parameters.
- Added regression test confirming `showAll=false` is correctly parsed as `false` for superusers.
- Validation: metahubs-backend 38/38 suites (254 tests), full build 28/28 tasks.

## Previous Focus: Admin Padding + Metahub Cache/Creation Fixes Complete

- Date: 2026-03-18.
- Fixed three categories of issues: admin layout consistency, auth-state cache isolation, and metahub creation resilience.
- Completed outcomes:
  - RoleEdit page header section no longer has extra `px` padding — all elements now align consistently with MainLayout padding.
  - App.tsx now tracks the authenticated user identity via `useRef` and clears React Query cache + user-settings singleton when the user changes (login/logout/user-switch), preventing stale data from a previous session.
  - Metahub creation cleanup now uses hard `DELETE FROM metahubs.cat_metahubs` instead of soft-delete when initial branch creation fails, preventing zombie rows without branches or schemas.
  - Validation: admin-frontend (0 errors, 13/13 tests), metahubs-backend (0 errors, 35/35 tests), start-frontend (20/20 tests), root `pnpm build` 28/28 tasks.

## Current State

- The residual QA follow-through items are closed with no remaining open implementation work in this wave.
- Shared contracts, backend role lifecycle work, admin frontend refactoring, multi-role user management, onboarding completion flow, explicit `/start` routing, role-aware shell guards, and the new `@universo/metapanel-frontend` package are all in place.
- Root routing now follows the final UX contract: guests see the landing/start surface on `/`, authenticated `registered`-only users stay on `/start`, authenticated workspace users render the metapanel directly on `/`, and admin-only users are redirected to `/admin` instead of leaking into the workspace shell.
- The registered-only shell leak is now fail-closed in both shared frontend/backend access contracts: `resolveShellAccess(...)` rejects `registered`-only role sets even when `profile:read` exists, and `hasWorkspaceAccess(...)` mirrors that policy on the backend before capability checks.
- `start-frontend` now consumes the narrower `@universo/template-mui/navigation` surface for `resolveShellAccess`, and its onboarding-routing tests mock the full runtime `useAbility()` contract.
- `applications-frontend` permission-gating tests now mock the real `useHasGlobalAccess()` shape expected by the shared settings UI, including `hasAnyGlobalRole` and `adminConfig`.
- Targeted validation is green: the focused touched suites passed, `pnpm --filter @universo/metapanel-frontend build` passed after the package-contract fix, `pnpm install --lockfile-only` resynced the workspace lockfile, and the final root `pnpm build` passed with 28/28 successful tasks in 2m36.104s.
- The metapanel dashboard now uses a metahub-board-style one-row layout with three stat/chart cards plus a documentation card, and breadcrumb resolution for `/` now resolves to `Метапанель` instead of falling back to a raw key or unrelated application label.
- Admin roles now use dialog-first editing from the list, the role dialog field order matches the requested name/description-first flow with codename at the bottom, and the role detail page is now permissions-first with a settings tab that behaves like an inline edit surface.
- Applications list gating now derives create/control-panel affordances from real application/global permissions instead of inheriting them from admin-panel access.
- The final QA completion pass closed the remaining legacy compatibility seam: legacy single-role grant/update/delete entry points now preserve the multi-role model instead of bypassing it, and legacy superuser grants can no longer create invalid mixed-role state.
- The role-copy contract is fully aligned end-to-end: the copy dialog now starts with a blank codename, exposes an explicit `copyPermissions` toggle, frontend/backend codename validation matches, and backend create/copy routes now fail cleanly on database uniqueness races instead of depending only on pre-checks.
- The last corrective debt from QA is now closed: shared shell/dashboard/start access is capability-based, admin create-user rollback compensates profile plus auth state, lifecycle role seeding is canonical again with legacy `manage` normalization, application admin affordances follow real permissions, and shared feature-route composition lives in `@universo/core-frontend`.

## Key Architecture Decisions (Implemented)

- AD-1: Role binding uses UUID, not codename → codename safely editable for non-system roles.
- AD-2: VLC fields for role name/description (existing JSONB schema).
- AD-3: Three system roles: `superuser` (existing), `registered` (new), `user` (new).
- AD-4: Completion CTA owns the final onboarding mutation; `AUTO_ROLE_AFTER_ONBOARDING` controls whether that mutation also adds `user`.
- AD-5: New `metapanel-frontend` package — StatCard + Grid directly (MainGrid has no `cards` prop).
- AD-6: Menu visibility is role-based but section-aware; Admin uses `canAccessAdminPanel`, logout remains a footer action.
- AD-7: Explicit `/start` route + authenticated home resolver are required in addition to `RegisteredUserGuard`.
- AD-8: Role copy via EntityFormDialog `mode='copy'` (basic fields only).
- AD-9: Role Detail Page with tabs (Permissions + Settings) — kept as standalone page, not dialog.
- AD-10: Superuser role is exclusive — assigning superuser clears other roles in transaction.
- AD-11: Admin-side user creation via Supabase Admin API (`supabase.auth.admin.createUser()`) with `SERVICE_ROLE_KEY` bootstrap injection.
- AD-12: Authorization refresh after role changes must use `AbilityContext.refreshAbility()`, not TanStack Query invalidation.
- AD-13: AdminBoard and Метапанель should share a dedicated `admin/dashboard/stats` contract.
- AD-14: Feature frontend packages hosted by `@universo/template-mui` must remain leaf packages and must not depend back on the shell package; use MUI or lower-level shared packages instead of re-importing shell UI exports.
- AD-15: Workspace shell access is narrower than admin access, but it should now be determined from actual workspace capabilities (`Application`, `Metahub`, `Profile`) rather than from hardcoded `user`/`superuser` codenames; admin-only roles still route to `/admin`, and `registered`-only users remain on `/start`.
- AD-17: The final root route contract is content-based, not redirect-based: `/` renders the guest landing page for unauthenticated users and renders the metapanel shell directly for authenticated workspace users; legacy `/dashboard` and `/metapanel` paths now only redirect back to `/`.
- AD-18: Metapanel must stay a leaf package, but it may consume shared shell UI primitives only when that dependency is declared explicitly and externalized in its own build config; otherwise tsdown can traverse `template-mui` dist assets and fail on foreign SVG parsing during root builds.
- AD-19: Applications page create/control-panel affordances must follow real global ability plus per-application permissions, not admin-panel access alone and not broad role-name shortcuts such as `editor`.
- AD-16: Post-auth lifecycle helpers must compensate prior writes when later role-assignment steps fail; rollback status should be explicit instead of hidden behind a generic 500.
- AD-20: Lifecycle system-role seeding/backfill must execute from one canonical migration path, and legacy admin permission rows using `manage` must be normalized because backend SQL helper contracts are defined around exact action or `*`.
- AD-21: Shared feature-route composition belongs in `@universo/core-frontend`, not in `@universo/template-mui`, when the route graph imports leaf feature packages such as metapanel.

## Key QA Corrections Applied (v1 → v3)

- RoleEdit page preserved with tabbed layout (was incorrectly planned for deletion).
- Existing `PermissionMatrix` reused (was incorrectly proposing new component).
- Existing `ColorPicker` reused (was referencing non-existent `ColorPickerField`).
- `getVLCString()` corrected (was incorrectly `getVlcContent()`).
- Метапанель uses StatCard + Grid directly (MainGrid has no `cards` prop).
- Multi-role set wrapped in `exec.transaction()` (was missing).
- Self-modification guard added to PUT /:memberId/roles.
- Admin user creation via Supabase Admin API added.
- Superuser exclusivity enforcement added.
- Users without roles visible in list (LEFT JOIN).
- "Основное" tab added to UserFormDialog.
- One-time data migration as explicit step.
- Third stat card corrected: "Глобальные роли" (was "Publications").
- Completion mutation moved out of `OnboardingWizard` and into the final CTA.
- Ability refresh corrected from TanStack Query invalidation to `AbilityContext.refreshAbility()`.
- Root `/` and `/start` topology corrected to match the live router.
- Menu filtering corrected to cover real shell sections, not only `rootMenuItems`.
- Метапанель stats corrected to use a dedicated dashboard contract instead of `global-users/stats`.
- Registration/onboarding system-role assignment consolidated around one injected privileged helper.

## Plan Decision: Keep Knex as Transport, Ban from Domain

- Knex stays as pool manager, connection handler, DDL engine.
- Only infrastructure packages may import from 'knex'.
- Domain packages must use DbExecutor/SqlQueryable exclusively.
- Enforced by `tools/lint-db-access.mjs` in CI pipeline.

## Immediate Next Steps

- No active implementation work remains. Four UX correction waves are complete.
- Developer role question: can be created via admin UI with permissions on `metahubs`, `applications`, `publications` subjects.
- If another QA pass inspects packaging, use the new dist-backed `@universo/template-mui/navigation` contract and the focused admin user-management tests as the baseline for this closure.
- If QA wants another pass, use the green applications lint surface plus the Wave 4 root-build result from 2026-03-18 as the new baseline.
- Existing root-build warnings outside this wave still include the known `@universo/utils` CJS `import.meta` notice and the large-chunk warning from `@universo/core-frontend`; neither was introduced by this closure.

## References

- Active planning artifact: `memory-bank/plan/admin-roles-metapanel-refactoring-plan-2026-03-17.md`.
- Active tasks: `memory-bank/tasks.md`.
- Architecture patterns: `memory-bank/systemPatterns.md`.
- Package docs entrypoint: `packages/universo-rest-docs/README.md`.
