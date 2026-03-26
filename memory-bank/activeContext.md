# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: QA Phase 3 — Complete Schema Hardening & Lint Cleanup — COMPLETE

### Summary
All remaining QA findings resolved: guards.ts Prettier fix, applicationMigrationsRoutes.ts migrated to shared resolveUserId, `.strict()` added to ALL remaining create/copy/move/reorder/layout schemas (~35 schemas total), all 135 pre-existing Prettier errors auto-fixed. Build 28/28, tests 346/346, lint 0 errors.

### guards.ts Prettier Fix
Collapsed multi-line function params in `createEnsureMetahubRouteAccess` return arrow function to single line, resolving Prettier formatting error.

### applicationMigrationsRoutes.ts Migration
Replaced 3 unsafe `req.user as { id?: string; sub?: string }` extractions with shared `resolveUserId(req)` from `domains/shared/routeAuth`. Covers `ensureAdminAccess`, `ensureMemberAccess` helpers and inline status route extraction. Now handles all 4 token property fallbacks (id, sub, user_id, userId).

### Comprehensive .strict() Hardening
Added `.strict()` to ~35 schemas across 12 files:
- **Route schemas**: constantsRoutes (3), elementsRoutes (4), hubsRoutes (3), branchesRoutes (1+superRefine), setsRoutes (3), catalogsRoutes (3+superRefine), enumerationsRoutes (7), publicationsRoutes (4), attributesRoutes (3), metahubMigrationsRoutes (2), applicationMigrationsRoutes (1)
- **Service schemas**: MetahubLayoutsService (6), layoutsRoutes (1)
- Schemas with `.superRefine()` (createBranchSchema, copyCatalogSchema): `.strict()` inserted before `.superRefine()`

### Prettier Cleanup
Auto-fixed all 135 pre-existing Prettier formatting errors via `eslint --fix`. Result: 0 errors, 211 warnings (all pre-existing @typescript-eslint warnings).

### Validation
- Build: 28/28 green
- Tests: 41 suites, 346 passed, 3 skipped
- Lint: 0 errors, 211 warnings

## Previous Focus: QA Phase 2 DRY Extraction & Schema Hardening — COMPLETE

(See progress.md for details)
- ConstantList.tsx: removed dead `copiedCodename` variable, fixed `source.codename || ''` and copy suffix
- ChildAttributeList.tsx, EnumerationValueList.tsx: fixed `source.codename || 'fallback'` to `getVLCString(source.codename) || 'fallback'`

### Validation
- metahubs-frontend build: green
- Full root build: 28/28 green

## Previous Focus: Restore codenameLocalizedEnabled Setting — COMPLETE

### Goal
Restore the "Enable Localized Codenames (VLC)" setting to both metahubs and admin settings pages. When disabled: UI shows simple single-locale field (versioned mode), data stored as VLC JSONB with single locale matching name's primary language. Backend enforces single-locale constraint.

### Implementation Summary
- **Settings infrastructure**: Added `general.codenameLocalizedEnabled` boolean (default true) to METAHUB_SETTINGS_REGISTRY, admin backend Zod schema, getCodenameSettings(), codename-defaults endpoint
- **Frontend hooks**: Extended `useCodenameConfig` (metahubs) and `usePlatformCodenameConfig` (admin) with `localizedEnabled` field
- **UI**: CodenameField switches between `mode='localized'` (VLC multi-locale) and `mode='versioned'` (VLC single-locale, no language switching) based on `localizedEnabled` prop. Added `normalizeOnBlur` support to VersionedFieldProps in LocalizedInlineField for codename normalization
- **Admin settings**: Added Switch toggle for codenameLocalizedEnabled in AdminSettings.tsx
- **Backend enforcement**: `enforceSingleLocaleCodename()` in `@universo/utils/vlc` strips extra locale variants keeping only primary when setting is disabled. Applied in admin-backend role routes (create, copy, update). Re-exported from `codenamePayload.ts` for metahubs-backend routes.
- **i18n**: EN/RU strings added to all 4 locale files (admin, metahubs)

### Validation
- admin-frontend tests: 13/13 pass
- apps-template-mui tests: 14/14 pass
- Full root build: 28/28 green

## Previous Focus: Role Codename PascalCase + Metahub Flickering + Migration Fix — COMPLETE

### Issue 1: Role Codename PascalCase
- Created `usePlatformCodenameConfig` hook in admin-frontend that reads `admin.cfg_settings` category `metahubs` for codename style/alphabet/allowMixed/autoConvert settings.
- Rewired `RoleFormDialog.tsx` to use `sanitizeCodenameForStyle`, `normalizeCodenameForStyle`, `isValidCodenameForStyle` from `@universo/utils/validation/codename` with platform config instead of hardcoded `sanitizeCodename` (kebab-only).
- Updated EN/RU i18n strings: `codenameHint` now uses `{{style}}`/`{{alphabet}}` interpolation, added sub-keys `codenameStyle.*`, `codenameAlphabet.*`.
- Updated tests: mock `usePlatformCodenameConfig`, codenames changed from `editor-copy`→`EditorCopy`, auto-fill expectation `content-editor`→`ContentEditor`.

### Issue 2: Metahub Codename Flickering
- Root cause: unstable function references in `useCodenameAutoFillVlc` deps — `handleExtraValueChange` in `EntityFormDialog` and `deriveCodename` inline arrow in `GeneralTabFields`/`MetahubEditFields` were recreated every render, causing the effect to re-fire repeatedly.
- Fix: memoized `handleExtraValueChange` with `useCallback([])` in `EntityFormDialog.tsx`, extracted `deriveCodename` into `useCallback` with stable `[style, alphabet, allowMixed, autoConvert]` deps in both `MetahubList.tsx` and `MetahubActions.tsx`.

### Issue 3: VLC Codename Admin Setting
- The `codenameLocalizedEnabled` toggle was **intentionally removed** during CJI4.b (codename JSONB unification). VLC codename is now architecturally always on. No change needed.

### Issue 4: False Migration Required on New Metahub
- Root cause: `MetahubBranchesService.createDefaultBranch` stored `structureVersion = template.minStructureVersion` (0.1.0 → version 1) but `CURRENT_STRUCTURE_VERSION = 2`. Since `initializeSchema` creates schema with current definitions, stored version should match.
- Fix: both `createDefaultBranch` and `createBranch` (non-clone path) now always use `structureVersionToSemver(CURRENT_STRUCTURE_VERSION)`.

### Validation
- admin-frontend tests: 13/13 pass (including 6 RoleFormDialog)
- Full root build: 28/28 green

## Previous Focus: Admin Security + Bootstrap Regression + Docs Closure — COMPLETE

- PostgreSQL 14+ PL/pgSQL `RETURN QUERY` enforces strict type matching: `varchar(N)` → `text` implicit cast is NOT allowed. The `RETURNS TABLE` declarations correctly use `TEXT`, but the SELECT body referenced columns that are `VARCHAR(7)`, `VARCHAR(100)`, `VARCHAR(20)` from the underlying tables (created by SchemaGenerator with `physicalDataType: 'VARCHAR(N)'`).
- Fix: added explicit `::TEXT` casts for all varchar columns in both functions' RETURN QUERY SELECT:
  - `get_user_global_roles`: `r.color::TEXT`
  - `get_user_permissions`: `r.color::TEXT`, `rp.subject::TEXT`, `rp.action::TEXT`
- Error manifested only on second startup because `ensureBootstrapSuperuser` calls `getGlobalAccessInfo` → `get_user_global_roles` only when the user already exists (first boot creates, doesn't query).
- PL/pgSQL delayed validation: function body is NOT validated at `CREATE OR REPLACE` time — only at first execution. First execution happens during second boot.
- Validation: admin-backend 47 tests, root build 28/28.

## Previous Closure: VLC Text Extraction SQL Fix — COMPLETE

- Fixed project-wide bug in VLC JSONB text extraction SQL. The expression `col->'locales'->>'en'` returns the entire locale entry object (`{"content":"...","version":1,...}`) as text instead of just the `content` string. Correct form: `col->'locales'->'en'->>'content'`.
- Affected 14 source files across admin-backend, metahubs-backend, applications-backend, and schema-ddl. Also affected inline `name` VLC extractions in MetahubBranchesService and MetahubLayoutsService.
- Updated 4 test files with corrected SQL assertion strings.
- Bootstrap error was: `One or more role codenames are invalid: Superuser` because `resolveRoleIdsByCodenames` used the buggy extraction and could never match the codename text.
- Validation: admin-backend 47 tests, metahubs-backend 260 tests, root build 28/28.

## Previous Closure: Fixed System App Metadata JSONB Inspection Fix — COMPLETE

- Fixed `packages/universo-migrations-platform/base/src/systemAppSchemaCompiler.ts` so metadata inspection and fingerprint loading normalize `_app_objects.codename` / `_app_attributes.codename` from JSONB VLC to canonical primary text instead of assuming raw strings.
- Root cause: `SchemaGenerator.syncSystemMetadata()` already persists metadata codenames as VLC JSONB, but `inspectSystemAppStructureMetadata()` and `loadActualSystemAppStructureMetadataSnapshot()` still filtered out any non-string codename values. That made bootstrap appear successful while inspection reported every object/attribute as missing.
- Added a regression test for JSONB codename rows and re-ran the original string-row inspection test to preserve backwards compatibility.
- Validation: targeted old/new inspection tests pass, changed-file ESLint clean, root build 28/28.

## Previous Closure: Admin Bilingual Codename Parameter Typing Fix — OBSOLETE (code deleted)

- The `UpgradeCodenamePascalCaseBilingual1800000000400` migration was fully removed as part of legacy V1/V2 code cleanup.

## Previous Closure: Metahubs Auth FK Idempotence Fix — COMPLETE

- Fixed `1766351182000-CreateMetahubsSchema.sql.ts`: `fk_mu_auth_user` creation now runs inside `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mu_auth_user') ... END $$`.
- Root cause: post-schema-generation support SQL re-applies non-`CREATE TABLE` statements after fixed-schema generation; the auth FK add was the only unguarded `ADD CONSTRAINT` in the metahubs support chain.
- Added parity regression coverage to keep the post-generation auth-user FK creation idempotent.
- Validation: focused parity test pass, metahubs-backend 260 tests pass, root build 28/28.

## Previous Closure: Metahubs Upgrade Migration SQL Quoting Fix — OBSOLETE (code deleted)

- The `1800000000301-UpgradeMetahubsLegacyCodenames.ts` migration was fully removed as part of legacy V1/V2 code cleanup.

## Previous Closure: QA Phase 2 Remediation — COMPLETE

- The 2026-03-25 QA Phase 2 remediation is fully complete.
- QA-1: `CopyRoleSchema` now uses `RoleCodenameSchema` (consistent `^[a-z][a-z0-9_-]*$` validation).
- QA-2: `createAccessGuards.ts` logging fallback corrected to PascalCase `'Superuser'`.
- QA-3: Migration SQL parameterized — `upgradePascalCaseBilingualCodenameSql` returns `?`-placeholder SQL, values bound via `ctx.raw(sql, [...])`.
- QA-4: Prettier formatting auto-fixed across admin-backend, auth-backend, start-backend.
- Validation: build 28/28, tests (admin 47, auth 9, start 28) pass, lint 0 errors.

## Previous Closure: System Role & Instance Codename PascalCase + Bilingual Enablement — COMPLETE

- ~150 references updated across 25+ files (types, seed constants, SQL comparisons, backend services, frontend, tests).
- New upgrade migration `UpgradeCodenamePascalCaseBilingual1800000000400` handles existing DB data.

## Previous Closure: Admin Role Codename VLC Enablement — COMPLETE

- 17 files modified across backend, shared types, and frontend (including QA remediation).
- admin-backend tests (47), admin-frontend tests (13), ESLint clean, full root build (28/28).

## Current State

- The approved codename architecture is now source-clean on the live repository surface: one field only, `codename JSONB`, using the canonical VLC/`VersionedLocalizedContent<string>` shape.
- Admin roles now use the same VLC codename editing flow as metahubs — `CodenameField` with localized inline editing, auto-fill from role name via `useCodenameAutoFillVlc`.
- `GlobalAssignableRole.codename` remains `string` (extracted text) for lightweight role assignment dropdowns; normalization to VLC happens in `useRoles` queryFn via `createCodenameVLC`.
- Copy flows now follow the same rule as create/update flows across both admin and metahubs.
- `rolesStore` accepts only `CodenameVLC` (no string union), uses explicit permission columns (not SELECT *), and no longer contains `normalizeRoleCodename`.
- `RoleFormDialog` forwards validation errors to `CodenameField` via `validationField` state.
- `RoleActions` copy-codename truncation preserves `_copy` suffix within 50-char limit.
- Validation failure log in `rolesRoutes` no longer includes full request body.

## Recent Closures Still Relevant

- 2026-03-21: fixed TABLE child localized-content payload generation in `InlineTableEditor`.
- 2026-03-21: fixed async create/copy submit flow in `ElementList` so failed mutations stay visible to the user.
- 2026-03-21: fixed `MetahubAttributesService.findChildAttributes(...)` reload path by preserving service `this` context.
- 2026-03-20: aligned `.env.example`, runtime warnings, and docs around neutral bootstrap demo credentials.
- 2026-03-20: repaired the live Supabase integration harness so it uses the real `@supabase/supabase-js` client instead of the shared Jest mock.
- 2026-03-19: closed the final bootstrap rollback seam by forcing privileged cleanup of profile rows before auth-user deletion.
- 2026-03-19: completed automatic startup bootstrap for the first superuser with strict fail-fast and no implicit privilege escalation of existing non-superusers.
- 2026-03-19: closed the applications workspaces/public-access/limits wave and the admin roles/metapanel corrective wave.

## Guardrails

- Do not reopen fixed system-app startup work without an explicit QA, live-runtime, or product trigger.
- Keep repeated-start acceptance coverage as the gate for future startup/bootstrap changes.
- Keep optional global catalog and release-bundle behavior fail-closed when enabled.
- Preserve the three-tier DB contract: request-scoped RLS, pool executor for admin/bootstrap, raw Knex only inside explicit DDL boundaries.
- Domain routes, services, and stores must stay SQL-first and must not import `knex`, `KnexClient`, or `getKnex()` directly.
- Dynamic identifiers must use `qSchema()`, `qTable()`, `qSchemaTable()`, or `qColumn()`.
- Mutations that need row confirmation must keep `RETURNING` and fail closed on zero-row results.
- Cross-schema active-row predicates must remain schema-specific: applications use `_app_deleted`, metahubs use `_mhb_deleted`.
- For the active codename closure wave, do not preserve or reintroduce the dual-field contract; all new edits must remove legacy compatibility instead of wrapping it.
- Frontend routed feature packages must remain leaf packages relative to `@universo/template-mui`.
- Public routes must continue using centralized route constants and the shared 401/419 contracts.
- Browser env resolution must keep the precedence `__UNIVERSO_PUBLIC_ENV__ -> import.meta.env -> process.env -> browser origin`.
- Package-local docs and system-app manifests must keep the current ownership split explicit: applications own runtime sync, metahubs own publication authoring.

## Verified Architecture Decisions

- Role bindings use UUID identity; non-system role codenames remain editable.
- Role name and description stay VLC-backed.
- System roles are now PascalCase bilingual: `Superuser`, `Registered`, `User` (en+ru VLC).
- Onboarding completion owns the final role-promotion mutation.
- `@universo/metapanel-frontend` stays a leaf package.
- Menu visibility stays section-aware and admin visibility uses `canAccessAdminPanel`.
- `/start` remains explicit and separate from the root route resolver.
- Role copy continues through `EntityFormDialog` copy mode.
- Role detail stays a standalone page with tabs instead of collapsing into a dialog.
- Superuser remains exclusive; assigning it clears other roles transactionally.
- Admin-side create-user uses the Supabase Admin API with `SERVICE_ROLE_KEY`.
- Role-change refresh on the frontend must use `AbilityContext.refreshAbility()`.
- AdminBoard and metapanel share a dedicated dashboard stats contract.
- Feature frontend packages hosted by the shell must not import the shell back.
- Workspace shell access is capability-based; admin access stays separate.
- Post-auth lifecycle flows must compensate earlier writes when later steps fail.
- Root `/` is content-based for guests and workspace users; legacy dashboard aliases redirect back to `/`.
- Metapanel may consume explicit shared shell primitives only when its own build exports remain stable.
- Applications list create/control-panel affordances must follow real permissions, not admin-only shortcuts.
- System-role seeding and legacy permission normalization belong to one canonical migration path.
- Shared feature-route composition belongs in `@universo/core-frontend`, not in shell leaf packages.
- Startup bootstrap superuser provisioning must reuse the shared provisioning service.
- Startup bootstrap may create or confirm a superuser, but must never auto-elevate an existing non-superuser account.

## QA Corrections To Preserve

- Reuse `PermissionMatrix`; do not replace it with a new matrix component without a real reason.
- Reuse `ColorPicker`; the rejected `ColorPickerField` idea was not a live component.
- Use `getVLCString()` rather than inventing alternate VLC read helpers.
- Metapanel cards use StatCard + Grid directly; `MainGrid` has no `cards` prop.
- Multi-role writes must stay wrapped in transactions.
- Self-modification guards on role mutation routes are required.
- Users without roles must remain visible in the admin list via LEFT JOIN semantics.
- `UserFormDialog` keeps its `Main` tab and catalog-style role selection flow.
- Ability refresh stays outside TanStack Query invalidation.
- Menu filtering must cover real section composition, not only `rootMenuItems`.
- Registration/onboarding system-role assignment remains centralized in an injected privileged helper.
- Applications/public runtime guards must keep the join-first contract for public non-members.

## Immediate Next Steps

- Start future sessions from the now-complete codename remediation notes in `progress.md` rather than reopening the retired dual-field or raw-string copy assumptions.
- Treat any future codename work as incremental feature work on top of the canonical JSONB/VLC contract, not as another compatibility cleanup wave.
- Preserve browser-entry export parity when expanding shared browser-safe helpers in `@universo/utils` or similar dual-entry packages.

## Session Hygiene

- Start future sessions from `tasks.md` and `progress.md`, not from stale plan artifacts.
- Prefer the compressed Memory Bank files over long archived notes when rebuilding context.
- Move any new durable closure detail into `progress.md` instead of expanding this file again.
- Keep `activeContext.md` limited to current state, guardrails, and next-step framing.

## References

- `memory-bank/tasks.md`
- `memory-bank/progress.md`
- `memory-bank/systemPatterns.md`
- `memory-bank/techContext.md`
- `memory-bank/rls-integration-pattern.md`
- `memory-bank/plan/codename-jsonb-unification-plan-2026-03-23.md`
- `memory-bank/plan/bootstrap-superuser-startup-plan-2026-03-19.md`
- `memory-bank/plan/application-workspaces-public-access-and-limits-plan-2026-03-19.md`
- `memory-bank/plan/admin-roles-metapanel-refactoring-plan-2026-03-17.md`
