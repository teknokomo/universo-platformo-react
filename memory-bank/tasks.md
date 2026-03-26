# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Active Open Tasks (Canonical)

## QA Phase 3: Complete Schema Hardening & Lint Cleanup — 2026-03-27

> Status: COMPLETE — guards.ts Prettier fixed, applicationMigrationsRoutes migrated to resolveUserId, ~35 schemas hardened with .strict(), 135 Prettier errors auto-fixed; build 28/28 green, 346 tests pass, 0 lint errors

- [x] QA3-1: Fix guards.ts Prettier error (multi-line params → single line)
- [x] QA3-2: Migrate applicationMigrationsRoutes.ts — replace 3 unsafe user extractions with resolveUserId(req)
- [x] QA3-3: Add .strict() to create/copy schemas (constants, elements, hubs, branches, sets, catalogs, enumerations, publications)
- [x] QA3-4: Add .strict() to layout schemas (MetahubLayoutsService 6 schemas + layoutsRoutes 1 schema)
- [x] QA3-5: Add .strict() to remaining schemas (attributes move/copy/reorder, publications createApp, enumerations reorderValue, migrations plan/apply/rollback)
- [x] QA3-6: Run Prettier auto-fix — 135 errors → 0 errors
- [x] QA3-7: Full validation — build 28/28, tests 41/346, lint 0 errors
- [x] QA3-8: Update memory-bank (progress.md, activeContext.md, tasks.md)

## QA Phase 2: DRY Extraction & Schema Hardening — 2026-03-27

> Status: COMPLETE — shared routeAuth.ts + createEnsureMetahubRouteAccess factory extracted, 13 resolveUserId + 7 ensureMetahubRouteAccess deduped, 7 update schemas hardened with .strict(), metahubMigrationsRoutes bug fixed; build 28/28 green, 346 tests pass

- [x] DRY-1: Create shared `routeAuth.ts` — AuthLikeUser, RequestWithAuthUser, resolveUserId
- [x] DRY-2: Add `createEnsureMetahubRouteAccess` factory to guards.ts
- [x] DRY-3: Replace 13 duplicate resolveUserId + types with shared import
- [x] DRY-4: Replace 7 duplicate ensureMetahubRouteAccess with shared factory
- [x] DRY-5: Add .strict() to 7 update schemas (constants, elements, settings, publications×2, sets, enumerationValues)
- [x] DRY-6: Fix metahubMigrationsRoutes.ts incomplete resolveUserId (missing userId fallback)
- [x] DRY-7: Update shared/index.ts exports
- [x] DRY-8: Build + test validation (28/28 packages, 346/346 tests) + 7 test mocks updated
- [x] DRY-9: Update memory-bank (progress.md, activeContext.md, tasks.md)

---

## QA Remediation: Security, i18n, Code Quality Fixes — 2026-03-26

> Status: COMPLETE — all security gaps sealed, i18n bug fixed, code quality issues resolved; build 28/28 green, 346 tests pass

- [x] QA-SEC-1: Fix i18n key mismatch — conflict.useServerVersion → conflict.reloadLatest in ConflictResolutionDialog.tsx
- [x] QA-SEC-2: Add ensureMetahubAccess to all handlers in attributesRoutes.ts (14/14 handlers)
- [x] QA-SEC-3: Add ensureMetahubAccess to missing handlers in elementsRoutes.ts (8/8 handlers)
- [x] QA-SEC-4: Add ensureMetahubAccess to missing handlers in catalogsRoutes.ts (16/16 handlers)
- [x] QA-SEC-5: Add ensureMetahubAccess to missing handlers in enumerationsRoutes.ts (21/21 handlers)
- [x] QA-SEC-6: Add ensureMetahubAccess to missing handlers in hubsRoutes.ts (11/11 handlers)
- [x] QA-SEC-7: Add .strict() to updateCatalogSchema, updateHubSchema, updateEnumerationSchema, updateBranchSchema
- [x] QA-SEC-8: Extract duplicated toTimestamp() into domains/shared/timestamps.ts
- [x] QA-SEC-9: Fix (req as any).user typing — RequestWithAuthUser in constantsRoutes.ts, metahubsRoutes.ts
- [x] QA-SEC-10: Full validation — build 28/28, tests 346/346, ensureMetahubAccess mock added to attributesRoutes.test.ts

## Fix updateEntity VLC Codename Payload — 2026-03-26

> Status: COMPLETE — fixed 6 entity List files + 1 create handler sending plain string codename instead of VLC object, restoring version conflict dialog, build 28/28 green

- [x] VLC-UPDATE-1: Fix SetList.tsx updateEntity — wrap normalizedCodename in ensureLocalizedContent
- [x] VLC-UPDATE-2: Fix CatalogList.tsx updateEntity — same pattern
- [x] VLC-UPDATE-3: Fix HubList.tsx updateEntity — same pattern
- [x] VLC-UPDATE-4: Fix EnumerationList.tsx updateEntity — same pattern
- [x] VLC-UPDATE-5: Fix BranchList.tsx updateEntity — same pattern
- [x] VLC-UPDATE-6: Fix AttributeList.tsx updateEntity + handleCreateAttribute — add ensureLocalizedContent import, wrap both paths
- [x] VLC-UPDATE-7: Full validation — metahubs-frontend build, metahubs-backend 346 tests, full build 28/28

## Fix Knex JSONB Codename Queries in Template Seed — 2026-03-26

> Status: COMPLETE — fixed 25 Knex WHERE/INSERT/UPDATE queries passing plain string to JSONB codename columns across 4 files, build 28/28 green

- [x] SEED-1: Fix TemplateSeedExecutor.ts — 5 WHERE + 5 INSERT patterns (objects, constants, attributes, child attrs, values)
- [x] SEED-2: Fix TemplateSeedMigrator.ts — 5 WHERE + 5 INSERT patterns (mirrors Executor)
- [x] SEED-3: Fix TemplateSeedCleanupService.ts — 1 WHERE pattern (objects cleanup)
- [x] SEED-4: Fix systemAttributeSeed.ts — 1 INSERT + 1 UPDATE pattern (_mhb_attributes system attribute seeding)
- [x] SEED-5: Update systemAttributeSeed.test.ts — fix assertion for VLC codename structure
- [x] SEED-6: Comprehensive search — confirmed no other remaining plain-string codename patterns in Knex queries
- [x] SEED-7: Full validation — metahubs-backend 41 suites / 346 tests, build 28/28

## QA Remediation: Legacy V1/V2 Post-Implementation Fixes — 2026-03-25

> Status: COMPLETE — all QA findings fixed, +104 new tests, Prettier clean, build 28/28 green

- [x] QA-1: Fix Prettier formatting errors in admin-backend (8 errors across 6 files)
- [x] QA-2: Fix semantic issue in MetahubSchemaService.ts (effectiveStructureVersion on initializedNow)
- [x] QA-3: Add edge case tests for structureVersions.ts (~30 tests: unknown version, null handling, round-trip)
- [x] QA-4: Add dedicated tests for systemTableDefinitions.ts (~25 tests: table/column/index/FK validation)
- [x] QA-5: Add dedicated unit tests for systemTableDiff.ts (~25 tests: calculateSystemTableDiff)
- [x] QA-6: Add additive migration tests for SystemTableMigrator (~8 new tests: ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK, ALTER_COLUMN)
- [x] QA-7: Add admin migrations SQL validation tests (~15 tests: seed data, codename VLC, idempotency)
- [x] QA-8: Fix Prettier formatting errors in metahubs-backend (57 errors across 26+ files)
- [x] QA-9: Full build + test validation (metahubs 346 tests, admin 65 tests, build 28/28)

## Legacy V1/V2 Codename Upgrade Code Removal — 2026-03-25

> Status: COMPLETE — all ~400 lines of dead legacy V1/V2 upgrade code removed, CURRENT_STRUCTURE_VERSION simplified to 1, build 28/28 green, all tests pass.

- [x] LEG-1: Clean systemTableDefinitions.ts — remove V1/V2, define jsonb directly, single SYSTEM_TABLES
- [x] LEG-2: Clean shared codename.ts — remove buildCodenameVlcSqlFromText
- [x] LEG-3: Simplify structureVersions.ts — version 2→1, semver 0.2.0→0.1.0
- [x] LEG-4: Clean SystemTableMigrator.ts — remove codename special case
- [x] LEG-5: Clean systemTableDiff.ts — remove isSafeCodenameJsonbUpgrade
- [x] LEG-6: Simplify MetahubSchemaService.ts — always use CURRENT_STRUCTURE_VERSION
- [x] LEG-7: Remove metahubs legacy migration file + export
- [x] LEG-8: Clean admin-backend migrations — remove all legacy blocks + unused import
- [x] LEG-9: Clean systemAppDefinitions — remove migration registrations (admin + metahubs)
- [x] LEG-10: Update tests — structureVersions, parity contracts, migration routes, systemTableMigrator
- [x] LEG-11: Validate — build 28/28, metahubs-backend 259 tests, admin-backend 48 tests
- [x] LEG-12: Update memory-bank

## Fix VLC Codename updateEntity TypeError — 2026-03-25

> Status: COMPLETE — VLC codename string extraction added to all updateEntity handlers in 6 entity List files, VLC-as-string fallback patterns fixed in 3 files, build 28/28 green.

- [x] VLCFIX-1: Fix `updateEntity` handlers in CatalogList, HubList, SetList, EnumerationList, BranchList, AttributeList — add `getVLCString()` extraction before `normalizeCodenameForStyle()`
- [x] VLCFIX-2: Fix ConstantList.tsx — remove dead `copiedCodename` variable, fix `source.codename || ''` fallbacks with `getVLCString()`
- [x] VLCFIX-3: Fix ChildAttributeList.tsx and EnumerationValueList.tsx — `source.codename || 'fallback'` → `getVLCString(source.codename) || 'fallback'`
- [x] VLCFIX-4: Validate — metahubs-frontend build green, full root build 28/28 green

## Restore codenameLocalizedEnabled setting — 2026-03-25

> Status: COMPLETE — VLC localized codenames toggle restored in metahubs/admin settings, backend enforcement via enforceSingleLocaleCodename, tests passing, build 28/28 green.

- [x] VLC-1: Add `general.codenameLocalizedEnabled` to `METAHUB_SETTINGS_REGISTRY` (universo-types)
- [x] VLC-2: Add to admin backend validation schema (`adminSettingsRoutes.ts`)
- [x] VLC-3: Add to `getCodenameSettings()` in `codenameStyleHelper.ts`
- [x] VLC-4: Add to `getGlobalMetahubCodenameConfig` + codename-defaults endpoint
- [x] VLC-5: Add to `useCodenameConfig` (metahubs-frontend) + `usePlatformCodenameConfig` (admin-frontend)
- [x] VLC-6: Add `normalizeOnBlur` support to `VersionedFieldProps` in `LocalizedInlineField`
- [x] VLC-7: Add `localizedEnabled` prop to `CodenameField` (template-mui) — switch mode
- [x] VLC-8: Wire `localizedEnabled` in metahubs-frontend `CodenameField` + admin `RoleFormDialog`
- [x] VLC-9: Add toggle UI in `AdminSettings.tsx`
- [x] VLC-10: Add `enforceSingleLocaleCodename()` to `@universo/utils/vlc` + admin-backend roles enforcement
- [x] VLC-11: i18n EN/RU for admin and metahubs settings
- [x] VLC-12: Run tests + full root build
- [x] VLC-13: Sync memory-bank

## CodenameField Auto-Init Loop Fix + Role HelperText Alignment — 2026-03-25

> Status: COMPLETE — infinite loop fixed in CodenameField (autoInitialize=false + effectiveValue), role helperText aligned with metahub format, tests pass, build 28/28 green.

- [x] LOOP-1: Fix CodenameField (template-mui) — disable autoInitialize, compute effectiveValue from value??emptyVLC, memoize handleLocalizedChange + only touch on non-empty content
- [x] HELPER-1: Update RoleFormDialog helperText to match metahub codenameHelperDynamic format (include mixedRule)
- [x] I18N-1: Add mixedRule i18n keys in admin EN/RU json
- [x] VAL-1: Run tests + full root build
- [x] MEM-1: Sync memory-bank

## Role Codename PascalCase + Metahub Codename Flickering + Migration Fix — 2026-03-24

> Status: COMPLETE — role form uses platform codename config (PascalCase/bilingual), metahub auto-fill memoized (no flickering), new branches use CURRENT_STRUCTURE_VERSION. Tests 13/13, build 28/28 green.

- [x] RC-1: Create `usePlatformCodenameConfig` hook in admin-frontend to read platform codename settings (style, alphabet, allowMixed, autoConvert)
- [x] RC-2: Update RoleFormDialog to use platform config for deriveCodename, validation, normalizeOnBlur, helperText
- [x] RC-3: Update role i18n strings (EN/RU) for PascalCase codename hints/validation/format
- [x] RC-4: Update RoleFormDialog tests for PascalCase codenames + mock usePlatformCodenameConfig
- [x] MF-1: Memoize deriveCodename callback in MetahubList GeneralTabFields + MetahubActions MetahubEditFields
- [x] MF-2: Memoize handleExtraValueChange in EntityFormDialog with useCallback
- [x] MR-1: Fix branch creation to store CURRENT_STRUCTURE_VERSION instead of template minStructureVersion
- [x] VAL-1: Run admin-frontend tests (13/13 pass) + root build (28/28 green)
- [x] MEM-1: Sync memory-bank after validation

## Admin Security + Bootstrap Regression + Docs Closure — 2026-03-24

> Status: COMPLETE — authenticated admin SQL sessions are now self-scoped, the repeat-start bootstrap path has real regression coverage, docs are aligned, auth/admin tests pass, and root build is green.

- [x] SEC-1: Harden admin SECURITY DEFINER functions so authenticated sessions cannot introspect arbitrary users via explicit `user_id` parameters while preserving backend/bootstrap service flows.
- [x] REG-1: Add regression coverage for the repeat-start bootstrap path and the tightened admin SQL function authorization contract.
- [x] DOC-1: Update root/package README files and GitBook docs that still lag behind the implemented codename JSONB and admin role/security contract.
- [x] VAL-1: Re-run targeted package tests/builds and finish with full root `pnpm build`.
- [x] MEM-1: Sync Memory Bank completion state after validation.

## Admin PL/pgSQL RETURN QUERY Explicit Cast Fix — 2026-03-24

> Status: COMPLETE — added explicit `::TEXT` casts for varchar columns in RETURN QUERY SELECTs; admin-backend 47 tests pass; root build 28/28 green.

- [x] FN-1: Change RETURNS TABLE from VARCHAR to TEXT (completed earlier, necessary but insufficient).
- [x] FN-2: Add explicit `::TEXT` casts for `r.color` in `get_user_global_roles` RETURN QUERY SELECT.
- [x] FN-3: Add explicit `::TEXT` casts for `r.color`, `rp.subject`, `rp.action` in `get_user_permissions` RETURN QUERY SELECT.
- [x] FN-4: Tests verified — no test changes needed (tests don't assert on exact function SQL).
- [x] FN-5: Validate — admin-backend 47 tests, root build 28/28.

## VLC Text Extraction SQL Fix (Project-Wide) — 2026-03-24

> Status: COMPLETE — all 14 source files + 4 test files fixed; admin-backend 47 tests, metahubs-backend 260 tests pass; root build 28/28 green.

- [x] VLC-SQL-1: Fix `roleCodenameTextSql` in `authUserProvisioningService.ts`, `rolesStore.ts`, `globalAccessService.ts` — add `->(key)->>'content'` instead of `->>(key)`.
- [x] VLC-SQL-2: Fix `instanceCodenameTextSql` in `instancesStore.ts`.
- [x] VLC-SQL-3: Fix `runtimeCodenameTextSql` in `SchemaGenerator.ts`, `applicationsRoutes.ts`, `applicationSyncRoutes.ts`, `applicationWorkspaces.ts`.
- [x] VLC-SQL-4: Fix `codenamePrimaryTextSql` in shared `codename.ts`, metahubs migration, admin migration.
- [x] VLC-SQL-5: Fix `branchCodenameTextSql` / `metahubCodenameTextSql` in stores and services, plus inline `name` VLC SQL in `MetahubBranchesService` and `MetahubLayoutsService`.
- [x] VLC-SQL-6: Update 4 test files with corrected SQL assertions.
- [x] VLC-SQL-7: Validate — admin-backend 47, metahubs-backend 260, root build 28/28.

## Fixed System App Metadata JSONB Inspection Fix — 2026-03-24

> Status: COMPLETE — inspector now resolves `_app_objects` / `_app_attributes` codenames from JSONB VLC as well as legacy strings; targeted regression tests pass; changed-file lint clean; root build 28/28 green.

- [x] META-1: Fix `systemAppSchemaCompiler.ts` inspection and fingerprint loading to normalize object-form JSONB VLC codenames to canonical primary text instead of assuming string values.
- [x] META-2: Add regression coverage for JSONB codename rows in `systemAppSchemaCompiler.test.ts` while preserving string-row compatibility.
- [x] META-3: Validate — targeted old/new inspection tests pass, changed-file lint clean, root `pnpm build` 28/28 green.

## Admin Bilingual Codename Parameter Typing Fix — 2026-03-24

> Status: COMPLETE — explicit `::text` casts added for bilingual codename migration bind parameters, admin-backend tests/build green, changed-file lint clean, root build 28/28 green.

- [x] CAST-1: Add explicit `::text` casts for bilingual codename migration bind parameters used inside `jsonb_build_object(...)` / WHERE comparison.
- [x] CAST-2: Validate with focused admin-backend checks and full root build.

## Metahubs Auth FK Idempotence Fix — 2026-03-24

> Status: COMPLETE — `fk_mu_auth_user` is now guarded with `IF NOT EXISTS`, focused parity regression added, metahubs-backend 260 tests pass, root build 28/28 green.

- [x] FK-1: Wrap `fk_mu_auth_user` creation in `1766351182000-CreateMetahubsSchema.sql.ts` with `pg_constraint` existence check so post-schema-generation support SQL can run safely when the constraint already exists.
- [x] FK-2: Add regression coverage in `metahubsSchemaParityContract.test.ts` for idempotent auth-user FK creation.
- [x] FK-3: Validate — metahubs-backend tests 260 passed, root `pnpm build` 28/28 green.

## Metahubs Upgrade Migration SQL Quoting Fix — 2026-03-24

> Status: COMPLETE — removed EXECUTE wrappers from PL/pgSQL DDL in `1800000000301-UpgradeMetahubsLegacyCodenames.ts`, build 28/28, metahubs-backend 259 tests pass.

- [x] MIG-1: Remove `EXECUTE '...'` wrappers from 5 DDL/DML statements in `buildLegacyCodenameUpgradeSql()` to fix single-quote collision from `buildCodenameVlcSqlFromText()` / `codenamePrimaryTextSql()`.
- [x] MIG-2: Validate — build 28/28, metahubs-backend 259 tests pass.

## System Role & Instance Codename PascalCase + Bilingual Enablement — 2026-03-24

> Status: COMPLETE — all 9 tasks done, build 28/28 green, all affected test suites pass (admin-backend 47, auth-backend 9, start-backend 28, metahubs-backend 259, template-mui 228, start-frontend 21, applications-frontend 120, applications-backend 113).

- [x] SRC-1: Update `SystemRoleCodename` type, `ROLE_MENU_VISIBILITY`, `AssignSystemRoleInput` in `@universo/types` to PascalCase (`'Superuser' | 'Registered' | 'User'`).
- [x] SRC-2: Update role seed constants (`ROLE_SUPERUSER_CODENAME`, `ROLE_REGISTERED_CODENAME`, `ROLE_USER_CODENAME`) to PascalCase + bilingual (en+ru) VLC. Update `INSTANCE_LOCAL_CODENAME` similarly.
- [x] SRC-3: Update all SQL comparisons in admin migrations using the new PascalCase codename text.
- [x] SRC-4: Update all hardcoded codename comparisons in backend services (`globalAccessService.ts`, `authUserProvisioningService.ts`, `auth.ts`, `onboardingRoutes.ts`).
- [x] SRC-5: Update all frontend codename comparisons (`roleAccess.ts`, `useGlobalRole.ts`).
- [x] SRC-6: Add upgrade migration `UpgradeCodenamePascalCaseBilingual1800000000400` for existing DB data (PascalCase + add Russian locale).
- [x] SRC-7: Fix `instancesStore.buildCodenameVlc` to support bilingual VLC with optional `ruCodename` param.
- [x] SRC-8: Update all test files with PascalCase codenames (13 test files, ~42 replacements).
- [x] SRC-9: Validate with `pnpm build` + tests + lint — all green.

## Admin Role Codename VLC Enablement — 2026-03-25

> Status: COMPLETE — implementation + QA Phase 1 & 2 remediation done. All tech debt closed, build 28/28, backend tests (admin 47, auth 9, start 28) all pass, lint clean (0 errors).

- [x] VLC-R1: Backend rolesStore — stop extracting text from codename in ROLE_RETURNING_COLUMNS / ROLE_SELECT_COLUMNS, return raw JSONB. Keep listAssignableRoles returning extracted text.
- [x] VLC-R2: Backend rolesRoutes — use getCodenamePrimary() for all text-context usages of role.codename (error messages, roleCodename in users response, system-role protection checks).
- [x] VLC-R3: Shared types admin.ts — change CreateRolePayload.codename, CopyRolePayload.codename, RoleWithPermissions.codename, and RoleListItem.codename from string to CodenameVLC.
- [x] VLC-R4: Frontend RoleFormDialog — replace plain TextField + useCodenameAutoFill with CodenameField + useCodenameAutoFillVlc, change state/props/submit types to VLC.
- [x] VLC-R5: Frontend rolesApi — update RoleListItem.codename type, fix transformRole() to pass VLC object through.
- [x] VLC-R6: Frontend RoleEdit / RolesList / RoleActions / hooks — use getCodenamePrimary() for text displays, pass VLC codename to dialogs. Also fixed useAllRoles, useRoles, useRoleDetails, RoleUsers, UserFormDialog, InstanceUsers.
- [x] VLC-R7: Validate with pnpm build and sync memory-bank. Backend and frontend tests all pass, full root build green (28/28 tasks).

### QA Remediation — 2026-03-25
- [x] FIX-1: RoleFormDialog — forward codename-specific validation error to CodenameField `error` prop via `validationField` state instead of hardcoded `undefined`.
- [x] FIX-2: useRoles — remove type-unsafe `as () => Promise<RoleListItem[]>` cast by normalizing GlobalAssignableRole to RoleListItem in queryFn using `createCodenameVLC`.
- [x] FIX-3: rolesStore — remove legacy `CodenameVLC | string` union from createRole/updateRole, remove `normalizeRoleCodename` helper; replace `SELECT *` for permissions with explicit `ROLE_PERMISSION_RETURNING_COLUMNS`.
- [x] FIX-4: RoleActions — improve copy codename truncation to truncate base first, preserving `_copy` suffix within 50-char limit.
- [x] FIX-5: rolesRoutes — remove full `req.body` from console.error in update validation failure log (data leak risk).
- [x] FIX-6: sqlReturningRegression.test — update createRole test calls to pass VLC codename via `createCodenameVLC('en', 'editor')` instead of string.
- [x] FIX-7: Validate with `pnpm build` (28/28), tests (47+13), and `eslint --fix` on changed files. All green.

### QA Phase 2 Remediation — 2026-03-25
- [x] QA-1: CopyRoleSchema — replaced `CodenameVLCSchema` with `RoleCodenameSchema` (consistent `^[a-z][a-z0-9_-]*$` validation for copied roles). Exported `RoleCodenameSchema` from `schemas/index.ts`.
- [x] QA-2: createAccessGuards.ts — fixed logging fallback from `'superuser'` to `'Superuser'` for PascalCase consistency.
- [x] QA-3: Migration SQL injection — refactored `upgradePascalCaseBilingualCodename` into `upgradePascalCaseBilingualCodenameSql` returning parameterized SQL with `?` placeholders; `up()` now passes bindings via `ctx.raw(sql, [...])`.
- [x] QA-4: Prettier formatting — eslint --fix applied to all affected files across admin-backend, auth-backend, start-backend. Also fixed pre-existing Prettier errors in permissionService.ts and authRoutes.test.ts.
- [x] QA-V: Validated — build 28/28 green, tests admin-backend 47, auth-backend 9, start-backend 28 all passed, lint 0 errors on all three packages.

## Codename JSONB Final Contract Closure — 2026-03-24

> Status: COMPLETE — the final backend/frontend compatibility seams were removed, the last browser-entry export mismatch was fixed, and the touched validation plus final root build are green.

- [x] CJF1: Remove the last backend compatibility leftovers that still expose or accept legacy codename transport after the now-green `@universo/metahubs-backend` route refactor.
	- Completed on 2026-03-24: removed the last live `codenameLocalized` acceptance/response alias from `MetahubAttributesService`, cleaned stale backend fixtures/expectations, and deleted the obsolete `useCodenameVlcSync` template hook.
- [x] CJF2: Replace the shared frontend codename contract with one VLC-only editing path.
	- Completed on 2026-03-24: touched metahubs authoring dialogs/forms now use one canonical `codename` VLC value, list-level create handlers in hubs/branches are aligned, and the touched/frontend package tests plus build are green without `useCodenameVlcSync`, `localizedEnabled`, or split codename state in the migrated flows.
	- [x] CJF2.a: Migrate metahubs/catalogs/sets/enumerations authoring and list dialogs from split `codename` + `codenameVlc` state to one canonical VLC `codename` field.
	- [x] CJF2.b: Migrate attributes/constants/hubs/branches and child/enumeration-value editors to the same canonical VLC codename contract.
	- [x] CJF2.c: Refresh touched metahubs-frontend tests/mocks that still expect `useCodenameVlcSync`, `localizedEnabled`, or split codename form state, then rerun focused validation.
- [x] CJF3: Remove legacy codename compatibility types/helpers from metahubs/admin frontend code and refresh affected regression coverage.
	- Completed on 2026-03-24: source audit confirmed the remaining live codename compatibility markers outside intentional migrations were removed, touched duplicate-check/frontend contract coverage was refreshed earlier in the wave, and no package-level live `codenameLocalized` / `localizedEnabled` / `useCodenameVlcSync` seams remain.
- [x] CJF4: Re-run touched package validation plus final root `pnpm build`, then sync Memory Bank closure state.
	- Completed on 2026-03-24: `pnpm --filter @universo/metahubs-backend test`, `pnpm --filter @universo/metahubs-backend build`, `pnpm --filter @universo/metahubs-frontend test`, `pnpm --filter @universo/metahubs-frontend build`, and final root `pnpm build` all passed after restoring browser-entry export parity for browser-safe codename helpers in `@universo/utils`.

## Codename JSONB QA Remediation — 2026-03-24

> Status: COMPLETE — copy-flow defects, remaining touched raw-string seams, stale codename tests, and final validation are closed.

- [x] CJR5: Fix confirmed codename JSONB copy-flow defects in admin role copy and metahub set constant copy so copy paths never stringify or raw-insert JSONB codename payloads.
	- Completed on 2026-03-24: admin role copy now persists codename through the shared role store/VLC contract, and set constant copy derives uniqueness from canonical primary codename text instead of `String(jsonbValue)`.
- [x] CJR6: Remove the remaining raw-string codename API/persistence seams still exposed in touched admin/template flows and replace them with canonical VLC codename payloads end-to-end.
	- Completed on 2026-03-24: touched admin role schemas/routes/store now use canonical codename VLC payloads with preserved regex validation, template persistence accepts canonical codename VLC at the store boundary, and role create/copy keeps audit-created-by metadata through the shared store path.
- [x] CJR7: Repair stale codename shared-component regression coverage and validate the touched codename/UI/backend surfaces again, then sync docs and Memory Bank closure state.
	- Completed on 2026-03-24: `CodenameField.test.tsx` was rewritten for the current localized runtime, changed-file ESLint is clean, focused admin/metahubs/template-mui tests all passed, and final root `pnpm build` completed green with `28 successful, 28 total` tasks.

- [x] CJR1: Add new versioned fixed-schema upgrade migrations for existing admin and metahubs installations so previously-applied bootstrap migrations still converge live tables and indexes to the canonical JSONB codename contract.
	- Added `UpgradeAdminLegacyCodenames1800000000300` and `UpgradeMetahubsLegacyCodenames1800000000301`, wired them into the fixed system-app manifests, and validated the manifest chains with focused admin/metahubs parity tests.
- [x] CJR2: Align canonical codename normalization and duplicate semantics with the approved primary-codename uniqueness rule across shared helpers, backend payload handling, and frontend duplicate checks.
	- Added shared all-locales codename normalization, passed style/alphabet context through backend codename payload sync, switched frontend duplicate warnings to canonical primary-only comparison, and validated with focused utils/backend/frontend tests.
- [x] CJR3: Remove remaining codename dual-contract documentation / plan drift and close the Memory Bank state for the final canonical JSONB codename contract.
	- Updated the codename plan/status wording plus Memory Bank architecture/context notes so they reflect the implemented JSONB contract, the rollout-safe fixed-schema migration rule, and the primary-only uniqueness + all-locales sanitization behavior.
- [x] CJR4: Re-run targeted tests/builds plus final root `pnpm build`, then sync `progress.md` and mark this remediation complete.
	- Focused codename regressions passed across utils/backend/frontend plus admin/metahubs manifest-parity coverage, touched package builds passed, and the final root `pnpm build` completed green on 2026-03-24.

- [x] CJI1: Add canonical shared codename JSONB types, validators, and helper utilities in `@universo/types` and `@universo/utils`
	- Added `CodenameVLC`, `CodenameVLCSchema`, canonical primary-text helpers, codename VLC normalizers, and focused shared tests; validated with `pnpm --filter @universo/types test` and `pnpm --filter @universo/utils test`.
- [x] CJI2: Replace fixed-schema codename storage in metahubs/admin system-app definitions and SQL support migrations with one `codename JSONB` contract
	- Admin and metahubs fixed system-app definitions plus support SQL now use a single `codename JSONB` field with extracted-primary expression indexes; validated with `pnpm --filter @universo/admin-backend build` and `pnpm --filter @universo/metahubs-backend build`.
- [x] CJI3: Replace runtime metadata codename storage/indexing/order contracts in `@universo/schema-ddl` and `@universo/applications-backend`
	- `_app_objects`, `_app_attributes`, and `_app_values` now store `codename` as JSONB, runtime ordering/lookup paths extract primary codename text, and request-body codename key access is normalized through runtime helpers; validated with `pnpm --filter @universo/schema-ddl build` and `pnpm --filter @universo/applications-backend build`.
- [x] CJI4: Refactor metahubs/admin backend stores, routes, DTOs, duplicate checks, and publication/snapshot seams to use JSON codename only
	- Status update 2026-03-24: complete. Backend metahubs route payloads now accept canonical codename VLC only, shared codename payload helpers own normalization, and touched route/service/persistence regressions are green.
	- [x] CJI4.a Admin roles/global access + instances: replace string codename SQL lookups, ordering, uniqueness checks, and fixed-schema store writes with extracted-primary JSONB codename logic.
	  - Validated with `pnpm --filter @universo/admin-backend test` and `pnpm --filter @universo/admin-backend build` on 2026-03-23 after converting `rolesStore`, `globalAccessService`, `authUserProvisioningService`, and `instancesStore`.
	- [x] CJI4.b Admin settings/metahub-config follow-up: remove remaining admin codename legacy toggles/settings assumptions such as `codenameLocalizedEnabled` and any scalar-only admin config seams.
	  - Completed on 2026-03-23: removed the obsolete codename-localization toggle from shared settings definitions, admin backend validation, admin frontend UI, metahubs defaults responses, and leftover admin/metahubs locale keys; localized codename mode is now architecturally always on.
	- [x] CJI4.c Metahubs persistence/routes/publication seams: remove `codename_localized`, string codename duplicate checks, and route-local codename builders.
	  - First persistence slice is complete: `metahubsStore`, `branchesStore`, and `MetahubBranchesService` now persist/query/search/order by extracted-primary JSONB codename text while compatibility projections still expose current string fields; `metahubsSchemaParityContract.test.ts` now matches the live JSON codename manifest.
	  - Latest progress on 2026-03-23: dynamic `_mhb_*` structure v2, migrator support, templates/objects/hubs/constants/attributes services, and `SnapshotSerializer` are already on the canonical JSONB codename contract.
	  - Latest progress on 2026-03-23: `MetahubEnumerationValuesService` no longer stores `presentation.codename`, enumeration/catalog/set route flows no longer read `presentation.codename`, and the remaining backend storage/snapshot debt is concentrated in route payload normalization plus temporary response aliases.
	  - Completed on 2026-03-24: `catalogsRoutes.ts`, `setsRoutes.ts`, `enumerationsRoutes.ts`, `constantsRoutes.ts`, `attributesRoutes.ts`, and `metahubsRoutes.ts` now validate one canonical `codename` VLC payload and rely on shared codename payload helpers; no route-local codename builders remain in source.
	- [x] CJI4.d Revalidate touched backend packages after each seam wave and keep only build-clean intermediate states.
	  - Completed on 2026-03-24: `pnpm --filter metahubs-backend build` and `pnpm --filter metahubs-backend test` both passed after the final route/request-contract cleanup.
- [x] CJI5: Remove dual-field/frontend setting logic and migrate metahubs/admin/template UI flows to one VLC codename object
	- Completed on 2026-03-24: all touched metahubs authoring submit/copy flows now send one canonical `codename` VLC object, and frontend regressions were updated to assert the canonical payload shape instead of split `codenameInput` / `codenamePrimaryLocale` pairs.
- [x] CJI6: Add or update deep regressions across shared helpers, schema-ddl, backend routes/services, snapshots, and touched frontend flows
	- Completed on 2026-03-24: backend route/service/persistence regressions and touched metahubs frontend payload tests now cover the single-field codename contract, including metahub copy/create flows, child-attribute optimistic create, enumeration value edit, migrations metadata, template persistence, and hub lookup SQL.
- [x] CJI7: Update root/package README files, GitBook EN/RU docs, and memory-bank architecture notes for the single-field codename contract
	- Completed on 2026-03-24 for this slice: no stale README or GitBook references to the removed dual-field codename payload were found in the touched docs surface, so only memory-bank closure state required updates.
- [x] CJI8: Run targeted lint/tests/builds plus final root `pnpm build`, then sync memory-bank completion state
	- Completed on 2026-03-24: `pnpm --filter metahubs-backend build`, `pnpm --filter metahubs-backend test`, `pnpm --filter metahubs-frontend build`, `pnpm --filter metahubs-frontend test`, and final root `pnpm build` all passed.


---

## Predefined Element Create Validation Fix — 2026-03-21

> Status: COMPLETE — see progress.md for validation details.

- [x] PEC1: Fix TABLE child localized-string payload generation so inline row editors emit canonical VLC objects accepted by backend element validation
- [x] PEC2: Fix `ElementList` create/copy async submit flow so failed mutations keep the dialog open and surface the API error instead of closing immediately
- [x] PEC3: Add focused frontend regressions for canonical VLC row payloads and create-error dialog handling, then rerun targeted validation

## Table Child Attributes Reload Fix — 2026-03-21

> Status: COMPLETE — backend read-path regression closed.

- [x] TCR1: Fix child-attribute reload crash in `MetahubAttributesService.findChildAttributes(...)` caused by losing the service `this` context inside `mapRowToAttribute`
- [x] TCR2: Add a direct regression proving child attributes are mapped with system metadata after a fresh read path
- [x] TCR3: Re-run `@universo/metahubs-backend` validation and sync memory-bank closure state

## Bootstrap Superuser Final QA Remediation — 2026-03-20

> Status: COMPLETE — env template, docs, and live test harness are aligned.

- [x] BSF1: Align `.env.example` bootstrap demo credentials with the runtime warning contract and the README / GitBook documentation
- [x] BSF2: Fix the env-gated live Supabase integration harness so it uses the real `@supabase/supabase-js` client instead of the global Jest mock
- [x] BSF3: Re-run real Supabase integration verification plus touched bootstrap/admin regressions and sync memory-bank closure state

## Bootstrap Superuser QA Reopen — 2026-03-19

> Status: COMPLETE — rollback compensation is now privilege-safe.

- [x] BSR1: Remove request-scoped / RLS-dependent cleanup from auth-user provisioning rollback so admin create-user compensation always uses a privileged executor
- [x] BSR2: Add live failure-path regression coverage for real Supabase rollback so auth/profile cleanup is verified beyond mock-only tests
- [x] BSR3: Add an explicit startup warning when demo bootstrap credentials are still in use, then rerun touched validation and sync memory-bank closure state

## Bootstrap Superuser QA Closure — 2026-03-19

> Status: COMPLETE — protected-role mutation paths are fail-closed.

- [x] BQ1: Harden role-assignment security so non-superusers cannot create, elevate, downgrade, or revoke `superuser` / system-role assignments through admin user-management flows
- [x] BQ2: Add deeper regression coverage for role-assignment restrictions, invite-path provisioning, bootstrap config contract, and failure-path behavior
- [x] BQ3: Restore safe neutral demo bootstrap credentials in `.env.example`, revalidate touched packages, and sync memory-bank closure state

## Bootstrap Superuser Startup Implementation — 2026-03-19

> Status: COMPLETE — startup bootstrap now reuses the shared provisioning pipeline.

- [x] BS1: Extract shared backend auth-user provisioning / rollback / profile-repair service in `@universo/admin-backend`
- [x] BS2: Implement startup bootstrap orchestrator in `@universo/core-backend` with strict env validation, advisory lock, and fail-fast existing-user policy
- [x] BS3: Add CLI/env parity for `SERVICE_ROLE_KEY` and bootstrap superuser env flags in core-backend commands
- [x] BS4: Refactor admin create-user route to reuse the shared provisioning pipeline without breaking existing behavior
- [x] BS5: Add deep regression coverage for startup bootstrap, shared provisioning, rollback, existing-user conflict, and route reuse
- [x] BS6: Update `.env.example`, root/package README files, GitBook docs, and memory-bank closure state; rerun focused validation and final root build

## PR #731 Bot Review Closure — 2026-03-19

> Status: COMPLETE — accepted only correctness-improving bot comments.

- [x] PR731-1: Review every bot comment from PR #731 against the live code and accept only the changes that are technically justified and safe
- [x] PR731-2: Restore stable declaration-based path mapping for `@universo/applications-backend` in `metahubs-backend` for Node16/exports consistency
- [x] PR731-3: Keep the application `Settings` menu item visible in a disabled/loading state until application detail resolves, and hide it only after a definitive `schemaName = null`
- [x] PR731-4: Add/update focused regressions and rerun touched validation without changing purely stylistic or false-positive review suggestions

## Application Workspace QA Closure — Tabular Copy, Docs/Plan Sync, And Seed Regression — 2026-03-19

> Status: COMPLETE — runtime copy permission and docs/plan drift are closed.

- [x] QW1: Fix the runtime tabular child-row copy permission seam so copy requires create-capability instead of delete-capability
- [x] QW2: Synchronize the published application role matrix and related package docs with the implemented backend permission contract
- [x] QW3: Bring the workspace/public-access implementation plan artifact into its final completed state so it no longer advertises stale unchecked work
- [x] QW4: Add a deeper regression around workspace seed propagation/runtime lifecycle and rerun touched lint/tests/build validation

## Auth Start Spacing, Application Shell Refresh, Runtime Access, And Limit Banner Closure — 2026-03-19

> Status: COMPLETE — start/app shell UX and joined-member runtime access are stable.

- [x] AS1: Remove the extra authenticated mobile start-page top gap without regressing the already-correct desktop guest/authenticated layouts
- [x] AS2: Stop application admin entry clicks from falling through to runtime navigation and restore stable `/a/:applicationId/admin` access from the application list action menu
- [x] AS3: Align application admin-shell refresh behavior so breadcrumbs and `Settings` stop degrading to `...` / hidden state on cold admin-board reloads
- [x] AS4: Move runtime workspace-limit messaging into the centered dashboard content area, add member action icons, and restore ordinary-member runtime access after `Join`
- [x] AS5: Add/update focused regressions, rerun touched tests/lint/build checks, and sync memory-bank closure state

## Start Page Header Offset And Mobile Onboarding Progress Closure — 2026-03-19

> Status: COMPLETE — guest/authenticated offset and mobile progress UI are corrected.

- [x] SP1: Remove the shared fixed-header spacer for guest start pages while preserving the authenticated start/onboarding offset
- [x] SP2: Replace the hidden mobile onboarding stepper gap with a compact responsive mobile progress pattern
- [x] SP3: Rename the final onboarding step label from `Completion` to `Acting`
- [x] SP4: Add/update focused tests, rerun touched builds, and sync memory-bank closure state

## Publications Refresh, Workspace DDL, And Application Admin Route Reopen Closure — 2026-03-19

> Status: COMPLETE — refresh resilience and route precedence are fixed.

- [x] PR1: Harden metahub/application breadcrumb detail loading on hard refresh so publication/admin paths stop falling back to `...` after a cold reload
- [x] PR2: Remove the multi-statement workspace policy recreation pattern from runtime DDL so publication-linked schema generation no longer trips the executor/statement-timeout seam
- [x] PR3: Restore application admin routing precedence so `Control panel` resolves to `/a/:applicationId/admin` instead of being captured by the runtime route
- [x] PR4: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state

## Application Workspaces UX, Breadcrumbs, Seed Data, And Limits Closure — 2026-03-19

> Status: COMPLETE — runtime limits, breadcrumb refresh, and seed propagation are aligned.

- [x] W1: Fix metahub/application breadcrumb and admin-menu refresh behavior so publications/settings resolve correctly on hard reload
- [x] W2: Refine application settings UX for pre-schema limits availability and localized catalog/codename rendering
- [x] W3: Rename runtime limits storage to `_app_limits` with forward-compatible scope/metric/period fields and keep current workspace-row limits working
- [x] W4: Seed predefined metahub catalog elements into each personal workspace instead of leaving workspace-less rows in workspace-enabled runtimes
- [x] W5: Tighten runtime limit UX so the create action closes immediately when the limit is reached instead of only failing on submit
- [x] W6: Add/update focused regressions, rerun touched lint/tests/builds, and sync memory-bank closure state

## Application Admin Surface And Runtime Role Enforcement Closure — 2026-03-19

> Status: COMPLETE — admin metadata and runtime role enforcement follow the published contract.

- [x] S1: Restrict application admin metadata routes (`members`, connector metadata, connector publications, sync) to real application admins/owners instead of plain membership
- [x] S2: Enforce runtime row/content mutations against published role permissions so `editor` can no longer delete content outside its contract
- [x] S3: Fail closed for public non-members by returning an explicit no-permissions surface until membership exists
- [x] S4: Stabilize the full `@universo/applications-frontend` package suite and keep the real shell/runtime route validation green
- [x] S5: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state

## Application Public Runtime Guard And Permission Contract Closure — 2026-03-19

> Status: COMPLETE — public non-members cannot bypass the join-first contract.

- [x] G1: Protect the real `/a/:applicationId/*` runtime route with `ApplicationGuard` so public non-members cannot bypass the intended join flow via direct URL access
- [x] G2: Remove the remaining table-view direct runtime link for public non-members and keep `Join` as the only entry point before membership exists
- [x] G3: Align the published `member` permission contract with the implemented workspace-scoped runtime CRUD capabilities and update package documentation
- [x] G4: Stabilize the full `@universo/applications-frontend` package test run under coverage and add regression coverage for the table-view public non-member state
- [x] G5: Re-run touched lint/tests/builds plus final root `pnpm build`, then sync memory-bank closure state

## Application Workspaces + Public Access + Limits Implementation — 2026-03-19

> Status: COMPLETE — the full workspace/public-access feature set landed.

- [x] I1: Extend applications system schema, DTOs, contracts, and immutable create/copy/update behavior for `isPublic` + `workspacesEnabled`
- [x] I2: Refactor application list/detail/member access semantics for explicit membership state, public discovery, and safe guard split
- [x] I3: Implement runtime workspace subsystem DDL, canonical snapshot/release-lineage integration, and first-sync/member bootstrap
- [x] I4: Implement runtime access resolution, workspace-scoped CRUD, child-table enforcement, and per-workspace limits backend
- [x] I5: Implement public join/leave and member add/remove lifecycle with personal workspace archive semantics
- [x] I6: Implement applications frontend create/edit/copy parameter tabs, public join/leave UX, settings navigation, and limits/settings UI
- [x] I7: Add/update i18n, shared query contracts, tests, package docs, GitBook docs, and final validation

## Application Public Access Reopen Closure — 2026-03-19

> Status: COMPLETE — ordinary workspace users no longer inherit synthetic admin access.

- [x] A1: Restore correct top offset for authenticated start-page content under the fixed start app bar in desktop layout
- [x] A2: Remove synthetic application-admin access for ordinary global `applications:read` users so public apps remain join/use-only until membership exists
- [x] A3: Add regression coverage for read-only public app list semantics and member-safe frontend actions, then rerun touched lint/tests/builds plus final root build

## Application Workspaces QA Remediation — 2026-03-19

> Status: COMPLETE — RLS, single-owner copy, and atomic limit updates are hardened.

- [x] R1: Rebuild `applications` RLS policies for create/public/member/admin flows so request-scoped RLS execution matches the implemented routes
- [x] R2: Enforce single-owner semantics in application copy flows when `copyAccess=true`
- [x] R3: Make workspace limit bulk updates atomic and fail-closed
- [x] R4: Strengthen runtime workspace integrity and add focused regression coverage for the new risk areas
- [x] R5: Re-run targeted lint/tests/builds, then update memory-bank closure state

## Application Workspaces QA Follow-Up Closure — 2026-03-19

> Status: COMPLETE — immutable edit payloads and workspace archival behavior are corrected.

- [x] F1: Fix applications edit flow so immutable parameters remain visible but are never sent in update payloads
- [x] F2: Extend workspace leave/remove lifecycle to soft-delete workspace-scoped business rows before archiving the personal workspace
- [x] F3: Tighten settings UX so `Limits` only appears when runtime schema + workspace mode are actually available
- [x] F4: Add regression coverage for edit payload contract, workspace business-row archival, and settings gating
- [x] F5: Re-run touched lint/tests/builds, then update memory-bank closure state

## Application/Publications Create Flow Remediation — 2026-03-19

> Status: COMPLETE — create dialogs and backend contracts now allow public apps without forced workspaces.

- [x] P1: Remove the hard backend invariant `public => workspaces` from application create/copy flows and keep UI guidance instead of a silent submit blocker
- [x] P2: Extend publication auto-create and publication-linked application creation contracts to accept visibility/workspace parameters end-to-end
- [x] P3: Align standalone and publication-linked create dialogs with the shared parameter UX, including spacing, immutable info alerts, and public-without-workspaces warning
- [x] P4: Add/update focused regression coverage for standalone create and publication create flows, then rerun touched lint/tests/builds

## Application Workspaces Final Closure — 2026-03-19

> Status: COMPLETE — final shell-level menu gating and runtime schema availability are aligned.

- [x] FC1: Fix metapanel application copy text and publication/application schema generation regressions found during manual runtime verification
- [x] FC2: Remove prepared-statement-incompatible workspace DDL helper pattern and qualify connector-publication soft-delete updates
- [x] FC3: Make application admin `Settings` menu obey runtime-schema availability instead of showing a dead-end entry up front
- [x] FC4: Add focused regression coverage for menu gating and rerun touched lint/tests/builds

## QA Comprehensive Fix — 2026-03-19

> Status: COMPLETE — cross-package QA audit defects are closed.

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

## PR #729 Bot Review Fixes — 2026-03-19

> Status: COMPLETE — valid bot findings were applied without widening scope.

- [x] Fix `buildRealisticTrendData()` NaN/Infinity guard for `points <= 1` in `StatCard.tsx`
- [x] Fix `OnboardingWizard.tsx` CTA disabled state when `onComplete` is undefined
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in `CreateRoleSchema`, `UpdateRoleSchema` (schemas/index.ts)
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in `CopyRoleSchema` (rolesRoutes.ts)
- [x] Unify codename regex to `/^[a-z][a-z0-9_-]*$/` in frontend `RoleFormDialog.tsx`
- [x] Validate: all lint 0 errors, RoleFormDialog 6/6 tests pass, full root build 28/28 in 3m4s

## QA Closure — Post-Implementation Fixes — 2026-03-19

> Status: COMPLETE — residual post-implementation defects are closed.

- [x] Remove redundant `.default(true)` from `includeSystem` in `admin-backend/rolesRoutes.ts` — preprocess already handles `undefined → true`
- [x] Add `notifySubscribers({})` to `resetUserSettingsCache()` in `useUserSettings.ts` — ensures active hook instances receive reset notification instead of holding stale state
- [x] Validate: admin-backend lint 0 errors, 34/34 tests; template-mui build OK; full root build 28/28 in 2m56s

## Fix Superuser Metahub Visibility (showAll query param) — 2026-03-18

> Status: COMPLETE — query-param boolean coercion is fixed across packages.

- [x] Root-cause: `z.coerce.boolean()` in query param schemas treats string `"false"` as `Boolean("false")===true` — superuser always sees all metahubs regardless of settings toggle
- [x] Fix `queryParams.ts` in metahubs-backend, applications-backend, admin-backend: replace `z.coerce.boolean()` with `z.preprocess()` that correctly maps `"true"`→true, `"false"`→false
- [x] Add regression test: superuser with `showAll=false` query param should pass `showAll: false` to store
- [x] Validate: metahubs-backend 38/38 test suites, 254/254 tests passed; full root build 28/28 in 3m11s

## Admin Padding + Metahub Cache/Creation Fixes — 2026-03-18

> Status: COMPLETE — layout, auth-state cache isolation, and metahub cleanup behavior are stable.

- [x] Fix RoleEdit padding: removed extra `px` from header section Stack so all elements have consistent MainLayout-level padding
- [x] Fix stale cache on login/logout: added `useEffect` in App.tsx that watches auth user identity and clears React Query cache + user-settings singleton when user changes (login/logout/switch)
- [x] Fix metahub creation cleanup: replaced soft-delete with hard `DELETE FROM metahubs.cat_metahubs` when initial-branch creation fails, preventing zombie metahub rows without branches/schemas
- [x] Validate all changes: admin-frontend lint 0 errors, 13/13 tests; metahubs-backend lint 0 errors, 35/35 tests; start-frontend 20/20 tests; full root `pnpm build` 28/28 tasks in 3m13.772s
- [x] Update memory-bank (activeContext, progress)

## Admin UX & Metahub Access Corrections — 2026-03-18

> Status: COMPLETE — admin dialogs and metahub visibility rules match the live contract.

- [x] Fix role detail header side inset so title/description align visually with the permissions section below
- [x] Restore fully localized role-create dialog wording and remove English fallback exposure in the create flow
- [x] Auto-generate role codename from the localized role name in create dialogs without breaking edit/copy defaults
- [x] Remove the `publications` permission subject from the shared admin role configuration and update role-permissions labels accordingly
- [x] Fix admin users create-dialog title/spacing and compact user-card role rendering to one role plus overflow count
- [x] Restrict metahub cross-user visibility to superusers only when `showAllItems` is enabled, and remove the generic `metahubs:read` bypass from backend access guards
- [x] Run touched validation, then resync `activeContext.md` and `progress.md`

## UX Corrections Wave 3 — QA Fixes — 2026-03-18

> Status: COMPLETE — follow-through QA issues from the UX waves are closed.

- [x] Fix AuthenticatedStartPage test: expect `navigate('/', { replace: true })` for registered-only users (architecture: HomeRouteResolver handles routing)
- [x] Fix OnboardingWizard prettier: collapse CompletionStep JSX to single line
- [x] Fix RoleEdit, RoleFormDialog, AdminBoard, LocalesList, RoleActions prettier formatting (ran `prettier --write`)
- [x] Fix RoleFormDialog copy test: `initialCodename` is now `'editor_copy'` (matches auto-generated codename from Wave 2)
- [x] Fix RoleFormDialog validate stale closure: added `isSuperuser, showIsSuperuser` to useCallback deps
- [x] Fix BaseEntityMenu onSubmit wrapper: added try-catch so dialog stays open on error, prevents unhandled rejection
- [x] Fix LocalesList warning: wrapped `data?.items || []` in useMemo to stabilize reference
- [x] Full validation: start-frontend 18/18 tests, admin-frontend 7/7 tests, all lint clean (0 errors), full build 28/28 (2m23s)

## UX Corrections Wave 4 — 2026-03-18

> Status: COMPLETE — dialog sizing, padding, and action-order polish landed.

- [x] Fix CompletionStep revisit layout so the completion buttons keep the canonical left/right order outside the wizard shell
- [x] Remove extra side padding from admin role detail informational blocks
- [x] Restore standard Locales page side padding and shorten the create CTA label
- [x] Shorten the Users create CTA label to the shared `Create` wording
- [x] Narrow UserFormDialog and increase action-area padding to match the role dialog contract
- [x] Replace the UserFormDialog roles tab with the catalog-style entity selection panel
- [x] Full validation: `@universo/admin-frontend` lint, `@universo/template-mui` build, admin-frontend tests 7/7, start-frontend tests 18/18, root `pnpm build` 28/28 (3m3.03s)

## UX Corrections Wave 4 — QA Follow-Through — 2026-03-18

> Status: COMPLETE — typing and direct regression coverage were added.

- [x] Remove the remaining EntitySelectionPanel type workaround from `UserFormDialog` and replace it with a stable package-level typing/export contract
- [x] Add direct regression coverage for `UserFormDialog` create/edit behavior and role-tab validation instead of only mocking the dialog from `InstanceUsers`
- [x] Add direct regression coverage for the completion-step action contract so CTA order/availability and loading/error states are pinned in tests
- [x] Re-run touched validation and final root build, then resync memory-bank closure state

## UX Corrections Wave 3 — 2026-03-18

> Status: COMPLETE — start flow and metapanel visual corrections are closed.

- [x] Onboarding last page: `Start Over` on the left, `Start Acting` on the right, and no `Back` action on the final step
- [x] Fix `Start Acting` redirect so it resolves to `/` instead of `/start`
- [x] Metapanel: remove subtitle, side padding, `Current platform snapshot`, and overly verbose descriptions
- [x] Fix superusers count (showed 2, should be 1)
- [x] Role edit dialog: fix content clipped at top
- [x] Role detail: remove border, fix untranslated permissions, disabled checkboxes for system roles
- [x] Role edit dialog from list doesn't close after save
- [x] Locales page: standard padding, button, filter, remove border
- [x] Full build validation passed (28/28 packages, 2m34s)

## UX Corrections Wave 2 — 2026-03-18

> Status: COMPLETE — onboarding/start access and role-dialog behavior are aligned.

- [x] Allow /start access after onboarding completion (StartAccessGuard)
- [x] Fix role dialogs: i18n, padding, star icon overflow, remove left ColorPicker (keep native)
- [x] Fix copy role dialog: auto-append `(copy)` suffix, auto-generate codename, and move copy options into a dedicated `Parameters` tab
- [x] Fix edit role dialog: make codename editable for non-system roles (verify UUID bindings — confirmed)
- [x] Remove demo charts (SessionsChart + PageViewsBarChart) from InstanceBoard
- [x] Full build validation passed (28/28 packages)

## UX Corrections Wave — 2026-03-18

> Status: COMPLETE — the first correction wave closed dashboard, menu, and permissions issues.

- [x] Remove metahubs 'read' permission from 'user' system role seed and fix menu divider visibility
- [x] Fix applications settings button — only visible for superusers, not hasAnyGlobalRole
- [x] Fix dashboard user count — change totalGlobalUsers SQL from rel_user_roles COUNT to auth.users COUNT
- [x] Fix all dashboard graphs to show realistic growth instead of fake wave/flat patterns
- [x] Rewrite admin roles RoleEdit page to match catalog pattern
- [x] Full build validation passed (28/28 packages)

## Historical Archive — 2026-03-17 To 2026-03-11

> Status: ARCHIVED AS RECENT HISTORY — keep these closures discoverable while avoiding full verbose notes in the active checklist.

### Platform System Attributes And Snapshot Integrity — 2026-03-17

- [x] Add platform-governed `_upl_*` catalog system attributes with one shared backend policy seam
- [x] Route catalog System views through dedicated `/system` pages instead of query-param tab state
- [x] Hydrate publication `systemFields` back into executable release-bundle payloads
- [x] Keep publication snapshot hash normalization shared and parity-safe across producer and consumer packages
- [x] Disable stale scoped-list placeholder reuse on tab switches that change semantic scope

### Admin Roles / Metapanel Revalidation — 2026-03-17

- [x] Confirm `AbilityContext.refreshAbility()` as the real post-role-change refresh contract
- [x] Confirm onboarding completion mutation must move out of the wizard body and into the final CTA
- [x] Confirm `/start` plus root route resolver are both required for the live routing topology
- [x] Confirm menu filtering must cover section-level composition instead of only `rootMenuItems`
- [x] Promote metapanel/admin stats to a dedicated shared dashboard contract

### Start System App Hardening — 2026-03-16 To 2026-03-15

- [x] Keep start-system support migrations that depend on generated tables in `post_schema_generation`
- [x] Fix clean-database bootstrap ordering for start-system support migrations
- [x] Converge the onboarding/start system app onto the application-like fixed-schema model
- [x] Close repository-wide legacy branding and stale env-file cleanup tied to the start-system wave
- [x] Revalidate startup bootstrap behavior on a fresh environment

### Unified Database Access Standardization — 2026-03-14

- [x] Standardize backend DB access around Tier 1 request-scoped executors, Tier 2 pool executors, and Tier 3 explicit DDL boundaries
- [x] Add `tools/lint-db-access.mjs` as the enforcement gate for domain packages
- [x] Keep `applicationSyncRoutes.ts` under lint coverage by moving raw Knex access behind a dedicated DDL boundary
- [x] Harden dynamic identifier handling and shared optimistic-lock helpers
- [x] Sync docs, READMEs, and memory-bank architecture notes with the unified SQL-first contract

### Optional Global Catalog And Definition Lifecycle — 2026-03-13

- [x] Support catalog-enabled and catalog-disabled modes without forcing full definition-registry bootstrap on every startup
- [x] Keep local `_app_migrations` / `_mhb_migrations` history canonical even when global mirroring is disabled
- [x] Record deterministic fixed-system baselines and backfill missing local baseline rows safely
- [x] Route active imports through the real draft -> review -> publish lifecycle
- [x] Treat export rows on the active published revision as healthy in doctor checks
- [x] Record bundle-style exports in the same lifecycle/export ledger as non-bundle exports
- [x] Make no-op detection dependency-aware, not checksum-only
- [x] Restore browser env precedence and managed owner-id validation contracts

### Metahub QA And Repeated-Start Stability — 2026-03-13

- [x] Fix shared-table sorting/filtering regressions in `FlowListTable`
- [x] Restore active-row filtering across touched metahub runtime reads and stats paths
- [x] Revalidate repeated-start behavior for fixed-system snapshots
- [x] Close final delete-cascade and soft-delete parity defects in applications/metahubs
- [x] Keep focused metahub/backend/frontend validation green after each reopen closure

### System-App Structural Convergence — 2026-03-12

- [x] Converge admin, profile, metahubs, and applications fixed schemas onto the application-like contract
- [x] Move fixed-system business-table creation to definition-driven schema generation
- [x] Remove the applications legacy reconcile migration from the active manifest path
- [x] Add shared direct active-row and soft-delete helper contracts
- [x] Target converged `cat_*`, `cfg_*`, `doc_*`, and `rel_*` tables in touched persistence helpers

### Frontend Acceptance Coverage Burst — 2026-03-12

- [x] Add page-level CRUD acceptance coverage for applications, metahubs, connectors, and publication-linked flows
- [x] Add sync-dialog and migration-guard acceptance coverage
- [x] Add runtime-shell acceptance coverage for `ApplicationRuntime`
- [x] Revalidate touched frontend packages, shared template packages, and the root build
- [x] Keep publication-to-application and control-panel navigation flows under direct test coverage

### Metadata, Compiler, And Bootstrap Foundation — 2026-03-12

- [x] Add fixed-system metadata bootstrap observability and CLI entry points
- [x] Add doctor/startup fail-fast gates for incomplete metadata and leftover legacy table names
- [x] Add forward-only reconciliation bridges for legacy fixed schemas
- [x] Preserve explicit object/attribute metadata through compiler artifacts
- [x] Revalidate touched backend/platform packages and root build

### Registry, Naming, And Runtime Ownership Foundation — 2026-03-11

- [x] Move application runtime sync ownership into `@universo/applications-backend`
- [x] Keep metahubs limited to publication runtime-source loading instead of owning application sync orchestration
- [x] Replace local branch/runtime schema-name builders with shared migrations-core helpers
- [x] Strengthen bootstrap and doctor lifecycle visibility around the registry/export contract
- [x] Keep publication compensation and cleanup on canonical managed-schema names
- [x] Add deep acceptance proof for registry lifecycle and publication-driven runtime sync

### QA Closure Completion Wave — 2026-03-13

- [x] Record definition export lifecycle rows for bundle-oriented catalog exports
- [x] Restore browser env precedence and Vite compatibility in shared helpers
- [x] Make registry drift detection dependency-aware rather than SQL-text-only
- [x] Harden managed owner-id validation against silent normalization collisions
- [x] Revalidate focused suites and the full workspace

### QA Plan Completion Wave — 2026-03-13

- [x] Align doctor lifecycle checks with the real sync/export-target contract
- [x] Restore package-local Jest execution for the metahubs parity suite
- [x] Add cross-package acceptance coverage for publication-created application sync
- [x] Re-run focused validation for the touched packages
- [x] Finish with a final root build and memory-bank sync

### Definition Lifecycle Closure Wave — 2026-03-13

- [x] Route live imports through lifecycle-aware draft/review/publish helpers
- [x] Preserve published provenance on created, updated, and unchanged revisions
- [x] Require published lifecycle provenance in bulk no-op and doctor checks
- [x] Persist raw JSON imports as file-sourced lifecycle imports
- [x] Revalidate focused packages and root build

### Ownership And Validation Closure Wave — 2026-03-12

- [x] Remove the remaining publication/application sync ownership leak
- [x] Restore repeatable package-level Jest forwarding for touched backend packages
- [x] Revalidate touched runtime paths after the refactor
- [x] Recheck live startup behavior on port 3000
- [x] Sync memory-bank state after validation

### QA Debt Closure Wave — 2026-03-12

- [x] Revalidate the remaining QA blockers against the live branch
- [x] Close backend technical-debt findings from the QA pass
- [x] Add acceptance-oriented regressions around the still-real cleanup surfaces
- [x] Remove touched frontend tooling deprecation debt
- [x] Re-run focused validation and root build

### Registry And Acceptance Hardening Burst — 2026-03-11

- [x] Enforce lifecycle governance for draft/review/publish transitions
- [x] Make export recording idempotent and race-safe
- [x] Add deep acceptance proof for publication-driven runtime sync and bootstrap lifecycle behavior
- [x] Stabilize the touched root/frontend validation gates
- [x] Finish with green focused validation and root `pnpm build`

### Additional 2026-03-13 Validation Foundations

- [x] Record definition export lifecycle rows for bundle-oriented catalog exports
- [x] Restore browser env precedence and Vite compatibility in shared helpers
- [x] Make registry drift detection dependency-aware rather than SQL-text-only
- [x] Harden managed owner-id validation against silent normalization collisions
- [x] Revalidate focused suites and the full workspace

### Additional 2026-03-13 Metahub QA Reopens

- [x] Fix shared-table filtering behavior when `sortableRows` is enabled
- [x] Restore active-row filtering to metahub runtime attribute reads
- [x] Add direct regressions for hub-scoped settings reopen and sortable row order
- [x] Revalidate the touched backend/frontend slice and resync memory-bank status
- [x] Keep the repeated-start stability proof green after the metahub reopen closures

### Additional 2026-03-12 Convergence Follow-Through

- [x] Add fixed-system metadata bootstrap observability and CLI entry points
- [x] Add doctor/startup fail-fast gates for incomplete fixed-system metadata and leftover legacy table names
- [x] Add forward-only reconciliation bridges for legacy fixed schemas
- [x] Preserve explicit object/attribute metadata through compiler artifacts and validation gates
- [x] Revalidate touched backend/platform packages and root build

### Additional 2026-03-11 Naming And Ownership Checks

- [x] Replace local branch/runtime schema-name builders with shared migrations-core helpers
- [x] Adopt shared schema-target resolution in touched bootstrap utilities
- [x] Align focused regressions with canonical managed-schema helpers
- [x] Keep publication compensation and cleanup checks on canonical managed-schema names
- [x] Revalidate focused suites and package builds
