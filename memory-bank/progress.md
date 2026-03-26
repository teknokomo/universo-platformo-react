# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
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
| 0.23.0-alpha | 2025-08-04 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | Russian docs, UPDL node params                                                                      |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️    | Memory Bank, MMOOMM improvements                                                                    |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 | Firm Resolve 💪       | Handler refactoring, PlayCanvas stabilization                                                       |

## 2026-03-27 QA Phase 3: Complete Schema Hardening & Lint Cleanup

All remaining QA audit findings resolved. Zero technical debt remaining in metahubs-backend schema validation and formatting.

### guards.ts Prettier Fix
Collapsed multi-line function params in `createEnsureMetahubRouteAccess` return arrow function to single line, resolving the only Prettier error introduced by Phase 2.

### applicationMigrationsRoutes.ts → resolveUserId
Replaced 3 unsafe `req.user as { id?: string; sub?: string }` extractions with shared `resolveUserId(req)`. Covers `ensureAdminAccess`, `ensureMemberAccess` helpers and inline status route.

### Comprehensive .strict() Hardening (~35 schemas)
Added `.strict()` to all remaining create/copy/move/reorder/layout Zod schemas across 12 files:
- constantsRoutes (3), elementsRoutes (4), hubsRoutes (3), branchesRoutes (1), setsRoutes (3), catalogsRoutes (3), enumerationsRoutes (7), publicationsRoutes (4), attributesRoutes (3), metahubMigrationsRoutes (2), applicationMigrationsRoutes (1), MetahubLayoutsService (6), layoutsRoutes (1)
- Schemas with `.superRefine()` chains (createBranchSchema, copyCatalogSchema): `.strict()` inserted before `.superRefine()`

### Prettier Cleanup
Auto-fixed all 135 pre-existing Prettier formatting errors via `eslint --fix`. Final state: **0 errors**, 211 warnings (pre-existing @typescript-eslint only).

### Validation
- Build: 28/28 green
- Tests: 41 suites, 346 passed, 3 skipped
- Lint: 0 errors, 211 warnings

## 2026-03-27 QA Phase 2: DRY Extraction & Schema Hardening

Comprehensive DRY refactoring and schema hardening based on QA Phase 2 analysis. Eliminated all duplicated auth/access utilities and added missing `.strict()` to remaining update schemas.

### DRY: Shared routeAuth.ts
Created `domains/shared/routeAuth.ts` with `AuthLikeUser` interface, `RequestWithAuthUser` type, and `resolveUserId(req)` function. Eliminated 13 duplicate definitions across route files (attributesRoutes, elementsRoutes, catalogsRoutes, enumerationsRoutes, hubsRoutes, branchesRoutes, publicationsRoutes, constantsRoutes, settingsRoutes, layoutsRoutes, metahubsRoutes, setsRoutes, metahubMigrationsRoutes).

### DRY: createEnsureMetahubRouteAccess Factory
Added `createEnsureMetahubRouteAccess(getDbExecutor)` factory to `domains/shared/guards.ts`. Replaced 7 duplicate inline closures (~10 lines each) with a single factory call. Updated 7 test file mocks with matching factory mock implementation.

### Zod Schema Hardening
Added `.strict()` to 7 update schemas: updateConstantSchema, updateElementSchema, settingsUpdateSchema, updatePublicationSchema, updateVersionSchema, updateSetSchema, updateEnumerationValueSchema.

### Bug Fix
Fixed `metahubMigrationsRoutes.ts` — `resolveUserId` was missing `userId` fallback property. Now uses the shared function with all 4 fallbacks (id, sub, user_id, userId).

### Validation
- Build: 28/28 green
- Tests: 41 suites, 346 passed, 3 skipped

## 2026-03-26 QA Security Hardening & Code Quality Remediation

Comprehensive security and code quality fixes based on QA audit findings. All metahubs-backend route handlers now have proper authorization checks.

### Security: ensureMetahubAccess on all route handlers (70 total)

| Route File | Handlers Secured | Already Had | Total |
| --- | --- | --- | --- |
| attributesRoutes.ts | 14 new | 0 | 14 |
| elementsRoutes.ts | 6 new | 2 (move, reorder) | 8 |
| catalogsRoutes.ts | 14 new | 2 (reorder, copy) | 16 |
| enumerationsRoutes.ts | 19 new | 2 (copy, reorder) | 21 |
| hubsRoutes.ts | 9 new | 2 (reorder, copy) | 11 |

Pattern: `ensureMetahubRouteAccess` wrapper resolves userId, calls `ensureMetahubAccess(exec, userId, metahubId, permission, dbSession)`. Permission: GET→undefined (read), POST/PATCH→'editContent', DELETE→'deleteContent'.

### Zod Schema Hardening
Added `.strict()` to 4 update schemas (updateCatalogSchema, updateHubSchema, updateEnumerationSchema, updateBranchSchema) — rejects unknown fields in PATCH request bodies.

### Code Quality
- Extracted `toTimestamp()` from 3 route files (catalogs, enumerations, sets) into `domains/shared/timestamps.ts`
- Fixed `(req as any).user` unsafe typing in constantsRoutes.ts, metahubsRoutes.ts → `RequestWithAuthUser` interface
- Fixed i18n: `conflict.useServerVersion` → `conflict.reloadLatest` in ConflictResolutionDialog.tsx
- Added `ensureMetahubAccess` mock to attributesRoutes.test.ts (16 tests were failing without it)

### Validation
- Build: 28/28 green
- Tests: 41 suites, 346 passed, 3 skipped

## 2026-03-26 Fix updateEntity VLC Codename Payload (Version Conflict Dialog Restored)

Fixed broken version conflict dialog across all metahub entity types. The `updateEntity` function in 6 entity List files was sending a plain string codename instead of a VLC (VersionedLocalizedContent) object to the backend PATCH endpoint, causing Zod validation failure (400 Bad Request) before the optimistic lock check could run.

| File | Problem | Fix |
| --- | --- | --- |
| SetList.tsx | `codename: normalizedCodename` (plain string) in dataWithVersion and pendingData | Wrapped with `ensureLocalizedContent(patch.codename, locale, normalizedCodename)` |
| CatalogList.tsx | Same pattern | Same fix |
| HubList.tsx | Same pattern in data and pendingUpdate | Same fix |
| EnumerationList.tsx | Same pattern | Same fix |
| BranchList.tsx | Same pattern in data and pendingUpdate | Same fix |
| AttributeList.tsx | Same pattern in updateEntity + `String(data.codename)` in handleCreateAttribute | Added `ensureLocalizedContent` import, wrapped both update and create paths |

Root cause: The previous VLC codename fix (2026-03-25) added `getVLCString()` extraction to fix `.trim()` TypeError, but replaced VLC codename with the extracted plain string in the API request body. The backend's `optionalCodenamePayloadSchema` (= `CodenameVLCSchema.optional()`) expects a VLC object, not a string, so Zod rejected the payload with 400 before the optimistic lock version check could run.

Backend confirmed OK: Global error handler in `routes/index.ts` and `middlewares/errors/index.ts` already catches `OptimisticLockError` with duck-typing fallback and returns 409 with conflict payload.

Validation: metahubs-frontend build green, metahubs-backend 41 suites / 346 tests, full build 28/28 green.

## 2026-03-26 Fix Knex JSONB Codename Queries in Template Seed

Fixed critical bug preventing metahub creation: `invalid input syntax for type json` error when seed executor tried to query/insert JSONB `codename` columns with plain string values via Knex.

| Area | Problem | Fix |
| --- | --- | --- |
| TemplateSeedExecutor.ts | 5 `.where({ codename: entity.codename })` passed plain string to JSONB column; 5 `.insert({ codename: entity.codename })` inserted string (not valid JSON) | WHERE: replaced with `.whereRaw(codenamePrimaryTextSql('codename') = ?, [string])`. INSERT: wrapped with `ensureCodenameValue(string)` to create proper VLC JSONB |
| TemplateSeedMigrator.ts | Same 10 patterns as Executor | Same fix applied |
| TemplateSeedCleanupService.ts | 1 `.where({ codename })` for cleanup lookup | Replaced with `whereRaw` + `codenamePrimaryTextSql` |
| systemAttributeSeed.ts | 1 `.insert({ codename: seed.codename })` + 1 `.update({ codename: seed.codename })` passed plain string for system attribute seeding in `_mhb_attributes` | Wrapped with `ensureCodenameValue(seed.codename)` |

Root cause: All `_mhb_*` system table `codename` columns were JSONB (VLC format), but the Knex-based seed files still treated them as plain strings. The `MetahubObjectsService` and other raw-SQL services already used `codenamePrimaryTextSql()` for queries and `ensureCodenameValue()` for inserts — the seed/migration Knex code was never updated.

Total fixes: 25 queries across 4 files (23 initial + 2 in systemAttributeSeed.ts discovered in follow-up session).

Validation: metahubs-backend 41 suites / 346 tests pass, lint 0 errors, build 28/28 green.

## 2026-03-25 QA Remediation: Legacy V1/V2 Post-Implementation Audit Fixes

Fixed all issues found by post-implementation QA audit of the legacy V1/V2 code removal. Added 104 new tests across 5 files.

| Area | Problem | Fix |
| --- | --- | --- |
| admin-backend Prettier | 8 formatting errors across 6 files (long `codenamePrimaryTextSql` lines) | Auto-fixed via `eslint --fix` |
| metahubs-backend Prettier | 57 formatting errors across 26+ source/test files | Auto-fixed via `eslint --fix` |
| MetahubSchemaService.ts | `effectiveStructureVersion = semverToStructureVersion(manifest.minStructureVersion)` when `initializedNow = true` — dead path but semantically incorrect | Changed to `effectiveStructureVersion = CURRENT_STRUCTURE_VERSION` since freshly initialized schema always matches current version |

**New test files created:**
- `systemTableDefinitions.test.ts` — ~25 tests: table presence, PK validation, FK references, column types, codename jsonb type, no duplicates, buildIndexSQL, snapshot
- `systemTableDiff.test.ts` — ~25 tests: ADD/DROP/RENAME TABLE, column add/drop/type change, nullable changes, index add/drop/rename/alter, FK add/drop, summary formatting
- `adminMigrations.test.ts` — ~15 tests: SQL contract integrity (IF NOT EXISTS, RLS, VLC jsonb cast, ordered versions, idempotency patterns)

**Expanded test files:**
- `structureVersions.test.ts` — expanded from 2 to ~30 tests (edge cases for null, undefined, 0, negative, unknown, numeric strings, round-trip)
- `systemTableMigrator.test.ts` — expanded with ~8 new tests (ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK, ALTER_COLUMN nullable, idempotent column add, no-op on same version)

**Test count after QA:**
- metahubs-backend: 39→41 suites, 259→346 tests (+87)
- admin-backend: 7→8 suites, 48→65 tests (+17)

**Validation:** Lint 0 errors in both packages, build 28/28 green, all 411 tests pass.

## 2026-03-25 Legacy V1/V2 Codename Upgrade Code Removal

Eliminated all legacy V1→V2 codename upgrade code since DB will be recreated from scratch (no migration needed). ~400 lines of dead code removed.

| Area | What was removed |
| --- | --- |
| systemTableDefinitions.ts | `upgradeCodenameColumnsToJsonb()`, `SYSTEM_TABLES_V1`/`SYSTEM_TABLES_V2` duplication — now single `SYSTEM_TABLES` with `codename: 'jsonb'` directly |
| codename.ts (shared) | `buildCodenameVlcSqlFromText()` helper — only used by deleted upgrade migrations |
| structureVersions.ts | `CURRENT_STRUCTURE_VERSION` 2→1, semver 0.2.0→0.1.0, removed `LEGACY_` map prefixes |
| SystemTableMigrator.ts | Special codename varchar→jsonb ALTER COLUMN logic in `alterColumn()` |
| systemTableDiff.ts | `isSafeCodenameJsonbUpgrade` special case (type changes now always destructive) |
| MetahubSchemaService.ts | `manifest.minStructureVersion` lookup — always uses `CURRENT_STRUCTURE_VERSION` |
| 1800000000301 migration | Entire `UpgradeMetahubsLegacyCodenames` file deleted |
| admin migrations/index.ts | `upgradeAdminLegacyCodenamesMigration`, `upgradeCodenamePascalCaseBilingualMigration`, `buildCodenameVlcSqlFromText()`, `upgradePascalCaseBilingualCodenameSql()`, unused `PlatformMigrationFile` import |
| admin systemAppDefinition.ts | Removed 2 legacy migration registrations from `migrations[]` array |
| metahubs systemAppDefinition.ts | Removed 1 legacy migration registration from `migrations[]` array |
| Tests | Updated `structureVersions.test.ts` (version 2→1), `metahubsSchemaParityContract.test.ts`, `systemAppDefinition.test.ts` (removed legacy migration IDs), `metahubMigrationsRoutes.test.ts` (v1=current, no upgrade needed), removed `systemTableMigrator.test.ts` codename string→jsonb test |

Validation: build 28/28 green, metahubs-backend 259 tests pass, admin-backend 48 tests pass.

## 2026-03-25 Fix VLC Codename updateEntity TypeError

Fixed `TypeError: e.trim is not a function` error (at `codename.ts:356`) occurring when editing entities in metahubs frontend. The error prevented saving edits and blocked version-conflict notification dialogs.

| Area | Problem | Fix |
| --- | --- | --- |
| updateEntity handlers | All 6 entity List files passed `patch.codename` (CodenameVLC object) directly to `normalizeCodenameForStyle(value: string)`, which calls `.trim()` on its argument | Added `getVLCString(patch.codename, ...)` extraction before normalization in CatalogList, HubList, SetList, EnumerationList, BranchList, AttributeList |
| ConstantList copy | Dead `copiedCodename` variable used `${source.codename}-copy` (VLC as template literal → `[object Object]-copy`); `source.codename \|\| ''` fallback always returned VLC object | Removed dead code; replaced with `getVLCString(source.codename)` |
| ChildAttributeList / EnumerationValueList | `source.codename \|\| 'fallback'` returned VLC object (truthy) instead of string | Changed to `getVLCString(source.codename) \|\| 'fallback'` |

Root cause: When codename field changed from `string` to `CodenameVLC` in payload types, the `toPayload()` functions in `*Actions.tsx` files were properly updated to extract string via `getVLCString()`, but the inline `updateEntity` handlers in `*List.tsx` files were not.

Validation: metahubs-frontend build green, full root build 28/28 green.

## 2026-03-25 Restore codenameLocalizedEnabled Setting (VLC Toggle)

Restored the "Enable Localized Codenames (VLC)" toggle to both admin platform settings and per-metahub settings pages.

| Layer | Changes |
| --- | --- |
| Settings infrastructure | Added `general.codenameLocalizedEnabled` (boolean, default true) to `METAHUB_SETTINGS_REGISTRY`, admin Zod schema, `getCodenameSettings()`, codename-defaults endpoint |
| Frontend hooks | Extended `useCodenameConfig` (metahubs) and `usePlatformCodenameConfig` (admin) with `localizedEnabled` |
| UI mode switching | `CodenameField` switches `mode='localized'` ↔ `mode='versioned'` based on `localizedEnabled` prop. Added `normalizeOnBlur` to `VersionedFieldProps` |
| Admin settings page | Added Switch toggle for codenameLocalizedEnabled in MetahubDefaults section |
| Backend enforcement | `enforceSingleLocaleCodename()` in `@universo/utils/vlc` strips extra locale variants keeping only primary. Applied in admin-backend role routes (create, copy, update). Re-exported from metahubs-backend `codenamePayload.ts` |
| i18n | EN/RU strings in all 4 locale files (admin + metahubs) |

Key design: When disabled, codename field uses VLC `mode='versioned'` (single locale, VLC JSONB structure, no language switching UI). Backend `enforceSingleLocaleCodename` silently strips extra locales to primary-only.

Validation: admin-frontend 13/13, apps-template-mui 14/14, full root build 28/28 green.

## 2026-03-25 CodenameField Auto-Init Loop Fix + Role HelperText Alignment

Fixed infinite render loop in codename field during role/metahub creation, and aligned role codename helperText with metahub format.

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Codename field flickers / infinite loop / CPU spin-up | `LocalizedInlineField` auto-init `useEffect` fires when `value=null` → sets `touched=true` → `useCodenameAutoFillVlc` resets `codename=null` → auto-init fires again → infinite loop | Set `autoInitialize={false}` on `LocalizedInlineField`; compute `effectiveValue = value ?? createLocalizedContent(...)` to guarantee valid VLC; memoize `handleLocalizedChange`, only mark `touched` on non-empty content |
| Only first letter auto-fills from name to codename | Auto-init fires `handleLocalizedChange` → `onTouchedChange(true)` before user types → auto-fill sees `touched=true` → returns early, never derives more characters | Same fix: `touched` only set when `hasNonEmptyPrimary(nextValue)` is true |
| Role codename helperText missing mixedRule info | helperText didn't include mixed-alphabet policy that metahub codename shows | Added `{{mixedRule}}` interpolation + 4 i18n keys (EN/RU) for mixed-alphabet policy variants |

Key: The fix is in `CodenameField.tsx` (template-mui), which is the shared base component used by both role and metahub forms — single fix covers both.

Validation: admin-frontend 13/13, apps-template-mui 14/14, full root build 28/28 green.

## 2026-03-25 Role PascalCase + Metahub Flickering + Migration Fix

Four UI/UX/backend issues fixed in a single wave.

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Role codename still uses kebab-case | `RoleFormDialog` hardcoded `sanitizeCodename`, kebab regex validation, and kebab i18n hints | Created `usePlatformCodenameConfig` hook → `RoleFormDialog` now uses `sanitizeCodenameForStyle`/`isValidCodenameForStyle`/`normalizeCodenameForStyle` with platform settings; updated EN/RU i18n with interpolation keys |
| Metahub codename field flickers rapidly | `handleExtraValueChange` (EntityFormDialog) and `deriveCodename` (MetahubList/MetahubActions) were inline arrows → new refs every render → `useCodenameAutoFillVlc` effect re-fired | Wrapped both in `useCallback` with stable deps |
| New metahub shows "Migration required" | `createDefaultBranch`/`createBranch` stored `template.minStructureVersion` (0.1.0 → v1) instead of `CURRENT_STRUCTURE_VERSION` (2) | Always use `structureVersionToSemver(CURRENT_STRUCTURE_VERSION)` for newly initialized schemas |
| VLC codename toggle missing from admin | Intentionally removed in CJI4.b (codename JSONB unification) — VLC always on | No change needed (by design) |

Validation: admin-frontend tests 13/13, full root build 28/28 green.

## 2026-03-24 Admin Security + Bootstrap Regression + Docs Closure

Closed the remaining QA findings after the admin PL/pgSQL cast fix by tightening the admin SQL helper boundary, proving the second-start bootstrap path, and aligning the main documentation surface.

| Area | Resolution |
| --- | --- |
| Admin SQL helper security | `admin.has_permission(...)`, `admin.is_superuser(...)`, `admin.has_admin_permission(...)`, `admin.get_user_permissions(...)`, and `admin.get_user_global_roles(...)` now allow explicit foreign `user_id` introspection only when `auth.uid()` is absent. Authenticated request sessions are self-scoped and raise `42501` on cross-user inspection attempts. |
| Bootstrap regression coverage | The real Supabase integration harness now exercises the repeat-start bootstrap path: first run creates the bootstrap superuser, second run returns `noop_existing_superuser` for the same account, covering the existing-user SQL helper branch that previously failed only at runtime. |
| Documentation sync | Root README, admin-backend README, admin-frontend README, and the GitBook database-access architecture docs were updated to describe the implemented `codename JSONB` contract, current system role names, and the tightened admin SQL helper boundary. |
| Validation | `pnpm --filter @universo/admin-backend test` passed with 48 tests, `pnpm --filter @universo/admin-backend build` passed, `pnpm --filter @universo/auth-backend test` passed with 9 tests, and the final root `pnpm build` finished green with `28 successful, 28 total`. |

## 2026-03-24 Admin PL/pgSQL RETURN QUERY Explicit Cast Fix

Fixed second-startup bootstrap failure `structure of query does not match function result type` on `admin.get_user_global_roles`.

| Area | Resolution |
| --- | --- |
| Root cause | PostgreSQL 14+ PL/pgSQL `RETURN QUERY` enforces strict type matching — `varchar(N)` does NOT implicitly cast to `text`. The `RETURNS TABLE` correctly declares `TEXT`, but SELECT body referenced underlying columns with `VARCHAR(7)` (color), `VARCHAR(100)` (subject), `VARCHAR(20)` (action). PL/pgSQL validates function body at first execution, not at `CREATE OR REPLACE` time. First execution occurs on second startup because bootstrap only calls `getGlobalAccessInfo` when the user already exists (created at first boot). |
| Fix (phase 1) | Changed `RETURNS TABLE` from `VARCHAR` to `TEXT` for both functions — necessary but insufficient (the SELECT still returns varchar from the underlying columns). |
| Fix (phase 2) | Added explicit `::TEXT` casts in RETURN QUERY SELECTs: `r.color::TEXT` in `get_user_global_roles`; `r.color::TEXT`, `rp.subject::TEXT`, `rp.action::TEXT` in `get_user_permissions`. |
| Validation | admin-backend 47 tests, root `pnpm build` 28/28. |

## 2026-03-24 VLC Text Extraction SQL Fix (Project-Wide)

Fixed bootstrap failure `One or more role codenames are invalid: Superuser` and all other VLC text extraction throughout the project.

| Area | Resolution |
| --- | --- |
| Root cause | All `*CodenameTextSql` / `runtimeCodenameTextSql` helpers used `col->'locales'->>'en'` which returns the entire locale entry object (`{"content":"Superuser","version":1,...}`) as text, not just the `content` field. Comparisons like `= 'Superuser'` always failed. |
| Fix | Changed all 14 source copies to `col->'locales'->'en'->>'content'` (and similarly for the primary-language fallback path: `->(primary)->>'content'`). |
| Scope | admin-backend (4 files), metahubs-backend (6 files), applications-backend (3 files), schema-ddl (1 file), plus 4 test files. |
| Validation | admin-backend 47 tests, metahubs-backend 260 tests, root `pnpm build` 28/28. |

## 2026-03-24 Fixed System App Metadata JSONB Inspection Fix

Fixed fresh-bootstrap failure where fixed system app structure metadata synchronization completed, but the follow-up inspector falsely reported every `_app_objects` and `_app_attributes` row as missing across admin, profiles, metahubs, applications, and start.

| Area | Resolution |
| --- | --- |
| Root cause | `SchemaGenerator.syncSystemMetadata()` stores metadata codenames in `_app_objects` and `_app_attributes` as JSONB VLC, but `inspectSystemAppStructureMetadata()` and `loadActualSystemAppStructureMetadataSnapshot()` in `systemAppSchemaCompiler.ts` still assumed those columns were plain strings. As a result, the inspector discarded all object/attribute rows and produced global missing-metadata + fingerprint-mismatch failures. |
| Fix | Added shared codename normalization in `systemAppSchemaCompiler.ts` that resolves both legacy string codenames and JSONB VLC object payloads to canonical primary text before key comparison and fingerprint construction. |
| Regression coverage | Added a focused test for JSONB codename rows and re-ran the original string-row inspection test to preserve compatibility. |
| Validation | Targeted `@universo/migrations-platform` old/new inspection tests passed, changed-file ESLint clean, full root `pnpm build` passed with `28/28`. |

## 2026-03-24 Admin Bilingual Codename Parameter Typing Fix

Fixed fresh-bootstrap failure in `UpgradeCodenamePascalCaseBilingual1800000000400` where PostgreSQL could not infer the type of the Russian locale bind parameter used inside `jsonb_build_object(...)`.

| Area | Resolution |
| --- | --- |
| Root cause | The admin PascalCase bilingual codename upgrade used parameterized SQL, but only the first bind was explicitly typed. PostgreSQL could infer `to_jsonb(?::text)` for the English content bind, but not the bare bind used as `jsonb_build_object('content', ?, ...)`, causing `could not determine data type of parameter $2`. |
| Fix | Added explicit `::text` casts to the Russian locale content bind and the old-primary comparison bind in `upgradePascalCaseBilingualCodenameSql(...)`. |
| Validation | admin-backend: 47 tests passed, build passed, changed-file ESLint clean. Full root `pnpm build`: 28/28. |

## 2026-03-24 Metahubs Auth FK Idempotence Fix

Fixed fresh-bootstrap failure where post-schema-generation metahubs support SQL tried to re-add `fk_mu_auth_user` on `metahubs.rel_metahub_users` after the constraint already existed.

| Area | Resolution |
| --- | --- |
| Root cause | `finalizeMetahubsSchemaSupportMigrationDefinition` reuses the non-`CREATE TABLE` tail of `1766351182000-CreateMetahubsSchema.sql.ts` after fixed-schema generation and after the legacy codename upgrade finalization path. `fk_mu_auth_user` was the only remaining unguarded `ALTER TABLE ... ADD CONSTRAINT` in that support chain. |
| Fix | Wrapped `fk_mu_auth_user` creation in a `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mu_auth_user') ... END $$` block, matching the existing idempotent FK pattern already used for other metahubs support constraints. |
| Regression coverage | Added a focused assertion in `metahubsSchemaParityContract.test.ts` that the finalize support SQL keeps the auth-user FK creation idempotent. |
| Validation | Focused parity test passed. metahubs-backend: 260 tests passed. Full root `pnpm build`: 28/28. |

## 2026-03-24 Metahubs Upgrade Migration SQL Quoting Fix

Fixed `syntax error at or near "', '"` crash on fresh Supabase startup caused by single-quote collision inside PL/pgSQL `EXECUTE '...'` strings.

| Area | Resolution |
| --- | --- |
| Root cause | `buildLegacyCodenameUpgradeSql()` in `1800000000301-UpgradeMetahubsLegacyCodenames.ts` wrapped DDL/DML in `EXECUTE '...'`. The JS helpers `buildCodenameVlcSqlFromText()` and `codenamePrimaryTextSql()` emit SQL with single quotes (`'_schema'`, `'1'`, `'en'`) that broke the EXECUTE string delimiter. |
| Fix | Removed all 5 `EXECUTE '...'` wrappers from `buildLegacyCodenameUpgradeSql()`, using direct DDL/DML statements inside the `DO $$...$$` block — consistent with the admin migration pattern in `UpgradeAdminLegacyCodenames1800000000300`. |
| Validation | metahubs-backend: 259 tests passed. Full root `pnpm build`: 28/28. |

## 2026-03-25 QA Phase 2 Remediation

Closed the second QA review findings on the PascalCase + bilingual enablement and admin role VLC work.

| Area | Resolution |
| --- | --- |
| CopyRoleSchema validation | Replaced `CodenameVLCSchema` with `RoleCodenameSchema` (regex `^[a-z][a-z0-9_-]*$`, min 2, max 50) so copy-role codename validation matches create-role validation. Exported `RoleCodenameSchema` from `schemas/index.ts`. |
| PascalCase logging fallback | Fixed `createAccessGuards.ts` superuser fallback label from `'superuser'` to `'Superuser'` for PascalCase consistency. |
| Migration SQL injection | Refactored `upgradePascalCaseBilingualCodename` into `upgradePascalCaseBilingualCodenameSql` returning parameterized SQL with `?` placeholders; migration `up()` now calls `ctx.raw(sql, [newPrimary, ruContent, oldPrimary])` with bind arrays. |
| Prettier formatting | `eslint --fix` applied to all modified files across admin-backend, auth-backend, start-backend. Also fixed pre-existing Prettier errors in `permissionService.ts` and `authRoutes.test.ts`. |
| Validation | Build 28/28 green. Tests: admin-backend 47, auth-backend 9, start-backend 28 — all passed. Lint: 0 errors across all three packages. |

## 2026-03-25 Admin Role Codename VLC Enablement

Enabled full VLC codename editing in admin role management, completing the last admin surface that still used plain text codename editing. Post-implementation QA remediation closed all identified tech debt.

| Area | Resolution |
| --- | --- |
| Backend persistence | `RoleRow.codename` typed as `CodenameVLC`; `ROLE_RETURNING_COLUMNS` and `ROLE_SELECT_COLUMNS` now return raw JSONB `codename` instead of extracted text; `roleCodenameTextSql()` still used in WHERE/ORDER BY/search clauses for text comparison; `listAssignableRoles` still extracts text for lightweight role assignment; `createRole`/`updateRole` accept only `CodenameVLC` (string union removed); permissions queries use explicit `ROLE_PERMISSION_RETURNING_COLUMNS` instead of `SELECT *`. |
| Backend routes | All text-context usages of `role.codename` in error messages, system-role protection, and `roleCodename` response field use `getCodenamePrimary()`. Validation failure log no longer includes full request body. |
| Shared types | `CreateRolePayload.codename`, `CopyRolePayload.codename`, `RoleWithPermissions.codename`, and `RoleListItem.codename` changed from `string` to `CodenameVLC`. `GlobalAssignableRole.codename` remains `string`. |
| Frontend dialog | `RoleFormDialog` now uses `CodenameField` + `useCodenameAutoFillVlc` from `@universo/template-mui`, submits VLC codename objects, validates via `getCodenamePrimary()`. Codename-specific validation errors forwarded to `CodenameField` `error` prop via `validationField` state. |
| Frontend hooks/pages | `useAllRoles`, `useRoles`, `useRoleDetails`, `RoleEdit`, `RolesList`, `RoleActions`, `RoleUsers`, `UserFormDialog`, `InstanceUsers` all use `getCodenamePrimary()` for text display. Copy action truncates base codename first to preserve `_copy` suffix within 50-char limit. `useRoles` normalizes `GlobalAssignableRole` to `RoleListItem` via `createCodenameVLC` instead of type-unsafe cast. |
| Frontend API | `rolesApi` `transformRole()` passes VLC codename through. |
| Test updates | Backend `sqlReturningRegression.test.ts` updated for raw codename column and VLC codename input via `createCodenameVLC`. Frontend `RoleFormDialog.test.tsx` updated with `CodenameField` mock, VLC entity codenames, VLC submit assertions. `InstanceUsers.test.tsx` role mock updated with VLC codename. |
| Validation | admin-backend: 47 tests passed. admin-frontend: 13 tests passed. ESLint clean on changed files. Full root `pnpm build`: 28/28 tasks. |

## 2026-03-25 System Role & Instance Codename PascalCase + Bilingual Enablement

Converted all system role codenames (`superuser`→`Superuser`, `registered`→`Registered`, `user`→`User`) and instance codename (`local`→`Local`) from lowercase English-only VLC to PascalCase bilingual (en+ru) VLC across the entire codebase.

| Area | Resolution |
| --- | --- |
| Type system | `SystemRoleCodename` type updated to `'Superuser' \| 'Registered' \| 'User'`; `ROLE_MENU_VISIBILITY` keys, `AssignSystemRoleInput` aligned. |
| Seed constants | `ROLE_SUPERUSER_CODENAME`, `ROLE_REGISTERED_CODENAME`, `ROLE_USER_CODENAME`, `INSTANCE_LOCAL_CODENAME` now PascalCase + bilingual (en: PascalCase, ru: Суперпользователь/Зарегистрированный/Пользователь/Локальный). |
| SQL comparisons | 6 WHERE clauses in admin migrations updated from lowercase to PascalCase. |
| Backend services | `globalAccessService.ts` (2 SQL + 1 JS), `authUserProvisioningService.ts` (1 resolveRoleIdsByCodenames), `auth.ts` (1 roleCodename), `onboardingRoutes.ts` (1 roleCodename) — all PascalCase. |
| Frontend | `roleAccess.ts` (~10 comparisons), `useGlobalRole.ts` (1 comparison) — all PascalCase. |
| Upgrade migration | New `UpgradeCodenamePascalCaseBilingual1800000000400` updates existing DB records to PascalCase + adds Russian locale for system roles and instance codenames. |
| Bilingual VLC support | `instancesStore.buildCodenameVlc` accepts optional `ruCodename` param for bilingual VLC creation. |
| Tests | 13 test files updated (~42 replacements) across admin-backend, auth-backend, start-backend, metahubs-backend, template-mui, start-frontend, applications-frontend, applications-backend. |
| Validation | Build 28/28 green. Tests: admin-backend 47, auth-backend 9, start-backend 28, metahubs-backend 259, template-mui 228, start-frontend 21, applications-frontend 120, applications-backend 113 — all passed. |

## 2026-03-24 Codename JSONB Final Contract Closure

Closed the last source and validation tail of the codename JSONB migration so the approved one-field VLC contract is now verified end-to-end across the touched backend, frontend, shared browser exports, and the full workspace build.

| Area | Resolution |
| --- | --- |
| Final backend compatibility cleanup | Removed the last live `codenameLocalized` acceptance/response alias from `MetahubAttributesService`, aligned the remaining touched backend route/service tests with canonical VLC codename payloads, and confirmed the remaining repository seam markers are limited to the intentional legacy upgrade migration. |
| Frontend/template closure | Deleted the obsolete `packages/universo-template-mui/base/src/hooks/useCodenameVlcSync.ts` hook and confirmed no live package-level `useCodenameVlcSync`, `localizedEnabled`, or `codenameLocalized` authoring seams remain outside the migration path. |
| Shared browser export parity | Fixed the final root-build blocker by restoring browser-safe codename/VLC helper parity in `@universo/utils/src/index.browser.ts`, so `@universo/metahubs-frontend` dist consumers inside `@universo/core-frontend` resolve the same public helpers as the main utils entrypoint. |
| Validation | `pnpm --filter @universo/metahubs-backend test`, `pnpm --filter @universo/metahubs-backend build`, `pnpm --filter @universo/metahubs-frontend test`, `pnpm --filter @universo/metahubs-frontend build`, and final root `pnpm build` all passed on 2026-03-24; the final root build finished with `28 successful, 28 total` tasks. |

## 2026-03-24 Codename JSONB Copy-Flow And Boundary Finalization

Closed the last QA findings left after the main codename JSONB migration so touched copy flows, touched admin/template boundaries, and shared codename regression coverage now all obey the same canonical VLC contract.

| Area | Resolution |
| --- | --- |
| Admin role copy contract | Replaced the copy route's raw SQL codename insert with the shared `createRole(...)` store path, preserved `_upl_created_by` through that path, and moved touched role request validation from string codename input to canonical VLC payloads without losing the primary-codename regex rules. |
| Set constant copy contract | Fixed metahub set copy so constant uniqueness uses extracted primary codename text from the source VLC payload instead of `String(jsonbValue)`, preventing `[object Object]` retry inputs during constant duplication. |
| Template/store boundary | `CreateTemplateInput` now accepts canonical codename VLC values at the persistence boundary instead of advertising a string-only contract in the touched store seam. |
| Shared component regressions | Rewrote `CodenameField.test.tsx` for the live localized runtime, including React Query provider wiring, locale-fetch mocking, translation mocking, and controlled VLC update assertions. |
| Validation | Changed-file ESLint passed on errors for the remediation edits, focused tests passed for `@universo/admin-backend`, `@universo/metahubs-backend`, and `@universo/template-mui`, and final root `pnpm build` passed on 2026-03-24 with `28 successful, 28 total` tasks in `3m15.705s`. |

## 2026-03-24 Codename JSONB Metahubs Frontend Authoring Closure

Closed the remaining metahubs frontend codename authoring seams for the touched entity flows so dialogs/forms now edit one canonical `codename` VLC value instead of mirroring scalar and localized codename state.

| Area | Resolution |
| --- | --- |
| Authoring form state | Metahubs, catalogs, sets, enumerations, enumeration values, attributes, child attributes, constants, hubs, and branches now use a single `codename: VersionedLocalizedContent<string> | null` field with `codenameTouched`, removing the split `codename` string + `codenameVlc` UI contract from the touched flows. |
| Autofill and field wiring | Touched forms now use `useCodenameAutoFillVlc`, no longer pass `localizedEnabled` / `localizedValue` / `onLocalizedChange` into `CodenameField`, and derive normalized primary codename text through `getVLCString(...)` before validation and payload construction. |
| Copy/create behavior | Copy dialogs in the touched flows now reset canonical codename state to `null` where appropriate so the copied name can drive fresh VLC codename autofill; hub/branch list-level create handlers were also aligned with the same canonical VLC payload path. |
| Regression coverage | Updated the touched metahubs frontend tests/mocks so they no longer reference `useCodenameVlcSync`, `localizedEnabled`, `codenameLocalized`, or split `codenameVlc` fixtures for the migrated dialogs and payload checks. `AttributeList.tsx` required no direct source edit because the search audit found no remaining split codename authoring seam there. |
| Validation | Focused `@universo/metahubs-frontend` Vitest coverage passed for child-attribute create, enumeration-value edit, metahub copy payloads, branch copy options, and hub settings reopen; the full `pnpm --filter @universo/metahubs-frontend test` run passed with `43/43` suites and `152/152` tests; `pnpm --filter @universo/metahubs-frontend build` passed on 2026-03-24. |

## 2026-03-24 Codename JSONB QA Remediation Closure

Closed the remaining QA findings on the codename JSONB/VLC migration so the live fixed-schema rollout path, backend/frontend duplicate semantics, all-locale sanitization behavior, and planning artifacts now match one final contract.

| Area | Resolution |
| --- | --- |
| Live fixed-schema upgrade path | Added new versioned admin and metahubs platform migrations for already-deployed installations, so legacy fixed schemas converge to the canonical JSONB codename contract without relying on edits to previously applied bootstrap migration ids. |
| Canonical duplicate semantics | Frontend duplicate warnings now compare only the canonical primary codename text, matching backend uniqueness/index semantics instead of treating non-primary locale aliases as hard collisions. |
| All-locale codename sanitization | Shared/backend codename payload handling now normalizes every locale entry in the VLC payload under the configured style/alphabet while keeping hard uniqueness primary-only. |
| Plan and Memory Bank fidelity | `tasks.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, and the codename unification plan now describe the delivered contract instead of leaving the remediation wave in a draft/open state. |
| Validation | Focused admin/metahubs manifest-parity tests passed; focused codename regressions passed for `@universo/utils`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`; touched package builds passed for `@universo/utils`, `@universo/admin-backend`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`; final root `pnpm build` passed on 2026-03-24. |

## 2026-03-24 Codename JSONB Request-Contract Closure

Closed the remaining metahubs backend/frontend request-contract tail of the codename JSONB migration so the touched authoring, copy, and route flows no longer exchange split codename payloads.

| Area | Resolution |
| --- | --- |
| Backend route contract | `catalogsRoutes.ts`, `setsRoutes.ts`, `constantsRoutes.ts`, `enumerationsRoutes.ts`, `attributesRoutes.ts`, and `metahubsRoutes.ts` now validate canonical `codename` VLC payloads and normalize final primary codename text through shared `codenamePayload` helpers instead of route-local builders or split request fields. |
| Frontend request contract | Touched metahubs authoring/copy flows now submit one canonical `codename` VLC object, and the last touched frontend payload expectations were updated accordingly in metahub copy/create, child-attribute optimistic create, and enumeration-value edit tests. |
| Regression closure | Added/updated backend regressions for route payloads, template persistence, hub lookup SQL, and migration metadata expectations; added/updated frontend regressions for the canonical codename payload shape and fixed a missing `ensureEntityCodenameContent(...)` import in `EnumerationValueList.tsx`. |
| Documentation state | No stale README or GitBook references to the removed split codename request contract were found in the touched docs surface; the closure required memory-bank synchronization only. |
| Validation | `pnpm --filter metahubs-backend build`, `pnpm --filter metahubs-backend test`, `pnpm --filter metahubs-frontend build`, `pnpm --filter metahubs-frontend test`, and final root `pnpm build` all passed on 2026-03-24. |

## 2026-03-23 Codename JSONB Shared + Fixed-Schema + Runtime Core

Completed the lower infrastructure layers of the codename JSONB unification wave so the platform now has one canonical codename container in shared code, fixed system-app storage, and runtime metadata generation/queries.

| Area | Resolution |
| --- | --- |
| Shared codename contract | `@universo/types` and `@universo/utils` now expose `CodenameVLC`, dedicated codename VLC validation, primary-text extraction helpers, and codename VLC normalization/sanitization helpers, replacing ad hoc codename JSON handling. |
| Fixed system-app schema | Admin and metahubs fixed-schema manifests and support SQL migrations now use one persisted `codename JSONB` column instead of string or dual-field storage, and uniqueness/indexing moved to extracted-primary expression indexes. |
| Runtime metadata contract | `@universo/schema-ddl` now generates `_app_objects`, `_app_attributes`, and `_app_values` with `codename JSONB`, stores runtime metadata through canonical VLC-wrapped codenames, and uses extracted-primary expression indexes for runtime uniqueness. |
| Applications runtime readers/writers | `@universo/applications-backend` runtime routes/services now sort by extracted primary codename text, resolve presentation fallbacks from JSON codename safely, and normalize request-body field access through runtime codename helpers instead of treating JSONB codename as a raw string key. |
| Validation | Shared tests passed for `@universo/types` and `@universo/utils`; targeted builds passed for `@universo/admin-backend`, `@universo/metahubs-backend`, `@universo/schema-ddl`, and `@universo/applications-backend`. |

## 2026-03-23 Codename JSONB Admin Backend Slice

Closed the first business-logic wave of the codename JSONB migration inside `@universo/admin-backend` so the package no longer assumes scalar `codename` storage for roles or instances even though the current admin UI compatibility surface still consumes the extracted primary codename text.

| Area | Resolution |
| --- | --- |
| Roles persistence | `rolesStore` now stores role codenames as canonical JSONB/VLC, uses extracted-primary SQL for duplicate checks, search, and sort order, and returns primary codename text via SQL aliases for current API compatibility. |
| Global access services | `globalAccessService` now resolves role lookups, ordering, dashboard counts, and legacy single-role compatibility fields through extracted-primary codename expressions instead of raw JSONB equality or ordering. |
| Provisioning | `authUserProvisioningService` now resolves bootstrap/admin role ids from the extracted primary codename text inside `admin.cat_roles.codename` instead of assuming plain `text[]` equality over a scalar column. |
| Fixed admin instances | `instancesStore` now follows the same JSONB codename write/search/order pattern as roles, matching the already-migrated `admin.cfg_instances` fixed-schema contract. |
| Validation | `pnpm --filter @universo/admin-backend test` passed with `7 passed / 1 skipped suites` and `47 passed / 2 skipped tests`; `pnpm --filter @universo/admin-backend build` passed on 2026-03-23. |

## 2026-03-23 Codename JSONB Metahubs Persistence Slice

Closed the first metahubs-backend business-logic slice of the codename JSONB migration so the main metahub and branch persistence/search paths no longer rely on persisted `codename_localized`, while compatibility fields still project current string codename data for the untouched route/frontend seams.

| Area | Resolution |
| --- | --- |
| Metahub persistence | `metahubsStore` now writes one JSONB/VLC codename value, resolves duplicate/search/order logic through extracted-primary SQL, and projects both `codename` and compatibility `codenameLocalized` from the same JSONB source. |
| Branch persistence | `branchesStore` now follows the same single-field JSONB codename write/read/search contract and no longer depends on a second persisted `codename_localized` field. |
| Direct branch service SQL | `MetahubBranchesService` list/search/order queries now compare and sort by extracted-primary JSONB codename text instead of scalar `b.codename`, keeping outward compatibility only at the projection boundary. |
| Fixed-schema parity | `metahubsSchemaParityContract.test.ts` now matches the live metahubs system-app definition, which already declares the fixed-schema `codename` field as `JSON`. |
| Validation | `pnpm --filter @universo/metahubs-backend test` passed on 2026-03-23 after the parity-test correction, and package compile validation passed with `pnpm --filter @universo/metahubs-backend exec sh -lc 'tsc -p tsconfig.json --pretty false --noEmit && echo BUILD_OK'`. |

## 2026-03-23 Codename JSONB Metahubs Dynamic Schema And Toggle Cleanup

Closed the next metahubs codename migration wave by landing the dynamic `_mhb_*` JSONB structure path, removing the remaining persisted enumeration-value dual-field seam, and deleting the obsolete localized-codename toggle from live settings and locale payloads.

| Area | Resolution |
| --- | --- |
| Dynamic metahub schema | `systemTableDefinitions`, `systemTableDiff`, `SystemTableMigrator`, and `structureVersions` now support the JSONB codename structure upgrade for `_mhb_objects`, `_mhb_attributes`, `_mhb_constants`, and `_mhb_values`, including extracted-primary codename index handling and migration coverage. |
| Dynamic services | `MetahubObjectsService`, `MetahubHubsService`, `MetahubConstantsService`, `MetahubAttributesService`, and `templatesStore` now treat `codename` JSONB as the only persisted source and derive compatibility projections from that one field. `SnapshotSerializer` was aligned with the new codename compatibility typing. |
| Enumeration values seam | `MetahubEnumerationValuesService` no longer persists `presentation.codename`; enumeration values now store only the canonical `codename` JSONB column, and compatibility `codenameLocalized` is derived from that column at read time. |
| Route compatibility cleanup | Enumeration and catalog routes now prefer normalized `codenameLocalized` compatibility fields from service rows instead of assuming legacy `presentation.codename` storage in their response mappings and current-value flows. |
| Settings cleanup | Removed `codenameLocalizedEnabled` from shared settings, admin backend validation, admin frontend UI, metahubs defaults responses, built-in template seeds, and the remaining admin/metahubs locale keys. The platform now treats localized codename support as always enabled by architecture. |
| Validation | `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/systemTableMigrator.test.ts src/tests/services/structureVersions.test.ts` passed; `pnpm --filter @universo/metahubs-backend build`, `pnpm --filter @universo/admin-backend build`, `pnpm --filter @universo/admin-frontend build`, and `pnpm --filter @universo/metahubs-frontend build` all passed on 2026-03-23. |

## 2026-03-23 Codename JSONB Route Fallback Cleanup And Frontend Resolver Centralization

Reduced the remaining live codename compatibility surface after the dynamic-schema migration by removing route-level presentation fallbacks in the most important metahubs routes and centralizing frontend codename resolution into one helper instead of many direct `codenameLocalized` reads.

| Area | Resolution |
| --- | --- |
| Backend route cleanup | `catalogsRoutes.ts`, `enumerationsRoutes.ts`, and `setsRoutes.ts` no longer read `presentation.codename` when building live route responses or edit/copy state. Canonical `codenameLocalized` projections from the service layer are now the only route-level compatibility source in those flows. |
| Frontend compatibility centralization | Metahubs frontend form initializers and edit/copy flows now resolve codename VLC values through `ensureEntityCodenameContent(...)` in `utils/localizedInput.ts` instead of reading `codenameLocalized` directly across many UI files. This shrank the live dual-field UI surface to a single helper boundary. |
| Resolver hardening | The new helper prefers canonical object-form `codename`, falls back to legacy `codenameLocalized` only when needed, and finally falls back to a plain string codename. This preserves current backend compatibility while keeping future one-field responses safe. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/metahubs-frontend build` passed twice during the cleanup, and the final root `pnpm build` passed with `28 successful, 28 total` tasks in `3m3.006s`. |

## 2026-03-21 Predefined Element Create Validation Fix

Closed a metahub-elements regression where creating a predefined catalog element with TABLE child rows returned HTTP 400 and the create dialog still closed, making the failure look silent from the page state alone.

| Area | Resolution |
| --- | --- |
| Root cause | TABLE child localized STRING cells were serialized by `InlineTableEditor` into a legacy VLC object shape, while backend element validation now recognizes only the canonical localized-content contract produced by `createLocalizedContent(...)`. |
| Payload contract fix | Replaced the custom TABLE child VLC builder with `createLocalizedContent(...)` from `@universo/utils`, so child row payloads now match the same localized-content shape used by the rest of the platform. |
| Submit-flow fix | `ElementList` create/copy handlers now `await mutateAsync(...)` instead of calling `mutate(...)` inside `try/catch`, which keeps the dialog open and surfaces the API validation message when element creation fails. |
| Regression coverage | Added a focused `InlineTableEditor` regression that proves localized child rows emit canonical VLC objects, plus an `ElementList` regression that proves failed create requests keep the dialog open and show the server error. |
| Validation | Focused ESLint on touched files passed, focused Vitest regressions passed (`2/2`), and `@universo/metahubs-frontend` build passed. |

## 2026-03-21 Table Child Attributes Reload Fix

Closed a runtime regression where reloading the catalog attributes page after creating a TABLE attribute with child attributes caused `GET .../attribute/:id/children` to fail with `TypeError: Cannot read properties of undefined (reading 'getSystemMetadata')`.

| Area | Resolution |
| --- | --- |
| Root cause | `MetahubAttributesService.findChildAttributes(...)` used `rows.map(this.mapRowToAttribute)`, which passed the class method as an unbound callback and dropped the service `this` context. |
| Service fix | Converted `mapRowToAttribute` into an instance-bound arrow function so all callback-style usages preserve access to `getSystemMetadata(...)` and any future instance helpers. |
| Regression coverage | Added a direct service regression proving `findChildAttributes(...)` maps child attribute rows correctly and keeps the `system` metadata for a fresh read path. |
| Validation | `@universo/metahubs-backend` tests passed (`38 suites`, `255 passed`, `3 skipped`, `258 total`), lint remained green on errors with the same pre-existing warning-only debt outside this closure, and `build` passed. |

## 2026-03-20 Bootstrap Superuser Final QA Remediation

Closed the final bootstrap-superuser QA follow-up by correcting the last unsafe template mismatch and fixing the previously unexecuted live integration harness so it runs against real Supabase instead of the global Jest mock.

| Area | Resolution |
| --- | --- |
| Env-template safety | `packages/universo-core-backend/base/.env.example` now uses the same neutral demo bootstrap credentials as runtime/docs: `demo-admin@example.com` / `ChangeMe_123456!`. This restores the intended safety warning path and removes the stale public old-values mismatch. |
| Live Supabase test harness | `authUserProvisioningService.integration.test.ts` now imports the real `createClient(...)` via `jest.requireActual('@supabase/supabase-js')`, bypassing the backend Jest setup mock that previously made `auth.admin` undefined and silently invalidated the integration suite. |
| Real integration proof | Re-ran the env-gated live suite against `UP-test` with a real `DATABASE_TEST_URL`, `SUPABASE_URL`, and `SERVICE_ROLE_KEY`. Both the bootstrap happy-path and the rollback failure-path passed against the actual Supabase Auth + Postgres boundary. |
| Validation | Live `@universo/admin-backend` integration tests passed (2/2), focused admin regression suites passed (23/23), focused core bootstrap tests passed (6/6), and touched admin lint remained green on errors with the same pre-existing warning-only debt outside this closure. |

## 2026-03-19 Bootstrap Superuser QA Reopen Closure

Closed the second QA reopen for startup bootstrap and admin-side provisioning by removing the last rollback consistency seam and adding the missing real failure-path verification.

| Area | Resolution |
| --- | --- |
| Privileged rollback cleanup | `createAuthUserProvisioningService(...)` no longer accepts request-scoped cleanup executors. Compensation now always runs profile cleanup through the privileged executor before deleting the Supabase auth user, so admin-side create-user failures cannot leave orphan active profile rows behind because of RLS. |
| Admin route alignment | The admin global-users create-user route no longer passes request-scoped session state into provisioning cleanup, keeping the route fully aligned with the shared privileged rollback contract. |
| Real failure-path integration coverage | Extended the env-gated live Supabase integration suite to verify a real rollback after auth-user creation when role synchronization fails. The test now proves that both the Supabase auth account and the generated profile row are removed, not only the happy-path bootstrap/provision flow. |
| Deployment safety warning | Startup bootstrap now emits an explicit warning when `BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com` and `BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!` are still configured, reducing the chance of shipping public demo credentials into a real environment. |
| Validation | `@universo/admin-backend` tests passed with `43 passed / 2 skipped / 45 total`, `@universo/core-backend` tests passed (23/23), touched admin/core lint stayed green with warning-only pre-existing debt outside this change-set, standalone `@universo/admin-backend` and `@universo/core-backend` builds passed, and the final root `pnpm build` completed green with 28/28 successful tasks in 2m52.491s. |

## 2026-03-19 Bootstrap Superuser QA Closure

Closed the follow-up QA reopen for startup bootstrap and admin-side user provisioning by hardening protected-role mutation rules, filling the remaining regression gaps, and restoring safe demo bootstrap defaults.

| Area | Resolution |
| --- | --- |
| Protected-role security boundary | `createGlobalAccessService(...)` now blocks non-superusers from assigning, downgrading, or revoking `superuser` / `is_system=true` role state across `setUserRoles(...)`, `grantRole(...)`, `revokeGlobalAccess(...)`, `revokeAssignment(...)`, and the legacy single-role update path. |
| Legacy role-shape correctness | Legacy role grant/update responses now preserve `isSystem` correctly for system roles instead of flattening them to `false`, keeping the API role model aligned with the database metadata. |
| Provisioning regression depth | Added invite-path coverage for `createAuthUserProvisioningService(...)` so admin-side provisioning is tested both for password-based auth-user creation and `inviteUserByEmail(...)`, alongside existing rollback/bootstrap regressions. Added an env-gated live integration suite for the real Supabase bootstrap path (`DATABASE_TEST_URL` + `SUPABASE_URL` + `SERVICE_ROLE_KEY`) so the security-critical auth/profile/role flow no longer relies only on mocks. |
| Bootstrap config coverage | Extended bootstrap tests to reject invalid email configuration explicitly and kept the fail-fast env contract around `SUPABASE_URL`, `SERVICE_ROLE_KEY`, and password quality. |
| Safe demo defaults | Restored the public `.env.example` bootstrap credentials to neutral demo values (`demo-admin@example.com` / `ChangeMe_123456!`) with the existing “change before real use” guidance. |
| Validation | `@universo/admin-backend` tests passed with `43 passed / 1 skipped / 44 total`, `@universo/core-backend` tests passed (22/22), touched admin/core lint stayed green with warning-only pre-existing debt outside this change-set, standalone `@universo/admin-backend` and `@universo/core-backend` builds passed, and the final root `pnpm build` completed green with 28/28 successful tasks in 2m40.814s. |

## 2026-03-19 Bootstrap Superuser Startup Closure

Implemented automatic startup bootstrap for the first platform superuser so a fresh Supabase environment no longer requires a manual SQL step after first launch.

| Area | Resolution |
| --- | --- |
| Shared provisioning pipeline | Extracted `createAuthUserProvisioningService(...)` in `@universo/admin-backend` so startup bootstrap and admin-side `POST /api/v1/admin/global-users/create-user` now share one canonical flow for auth-user creation, profile repair, global-role synchronization, and rollback. |
| Safe startup bootstrap | `@universo/core-backend` now runs bootstrap provisioning during `App.initDatabase()` after migrations and fixed role seed. The flow is guarded by a transaction-scoped advisory lock, requires valid `SUPABASE_URL` + `SERVICE_ROLE_KEY` when enabled, creates a real Supabase auth user, repairs the profile row through `ProfileService.getOrCreateProfile(...)`, and assigns the exclusive `superuser` role. |
| Fail-closed privilege policy | Automatic bootstrap now refuses to elevate an existing non-superuser account, does not auto-reset the password of an existing account in v1, and remains a safe no-op when the configured bootstrap account already exists as a superuser. |
| Env and CLI parity | Added `SERVICE_ROLE_KEY`, `BOOTSTRAP_SUPERUSER_ENABLED`, `BOOTSTRAP_SUPERUSER_EMAIL`, and `BOOTSTRAP_SUPERUSER_PASSWORD` to the core-backend CLI/env contract and documented the demo bootstrap credentials in `.env` / `.env.example` with explicit “change before real use” guidance. |
| Documentation sync | Updated root README/README-RU, `@universo/core-backend` README/README-RU, `@universo/admin-backend` README/README-RU, and GitBook docs in `docs/en` + `docs/ru` so startup behavior, security constraints, and server-only provisioning requirements match the implementation. |
| Validation | `@universo/admin-backend` tests passed (39/39), `@universo/core-backend` tests passed (21/21), touched lint passed with warning-only pre-existing debt outside this change-set, standalone admin/core builds passed, and the final root `pnpm build` completed green with 28/28 successful tasks in 3m25.588s. |

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
| Final step naming | The last onboarding step label now reads `Acting` instead of `Complete`, matching the requested wording and the existing `Start Acting` CTA direction. |
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
| Admin users surface | `UserFormDialog` now opens with the requested `Create User` title and tighter top spacing, while `InstanceUsers` cards collapse large role lists to one visible role plus a numeric remainder chip. |
| Shared admin permission model | Removed the `publications` subject from the shared admin permission union/iteration lists plus backend role-schema validation, and aligned the affected permission labels across locales. |
| Metahub visibility hardening | `metahubsRoutes` now treats `showAll` as a superuser-only expansion, and `ensureMetahubAccess(...)` no longer grants synthetic owner access from generic `metahubs:read` permissions. Non-superusers remain membership-scoped even if a reused browser profile still has `showAllItems` enabled. |
| Validation | `pnpm --filter @universo/admin-frontend lint` passed, `pnpm --filter @universo/admin-frontend test` passed with 4/4 files and 12/12 tests, `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubsRoutes.test.ts` passed with 35/35 active tests, and the final root `pnpm build` passed with 28/28 successful tasks in 3m28.542s. |

## 2026-03-18 UX Corrections Wave 4

Closed 6 more UX issues after the previous QA/fix passes. This wave was focused on polish and consistency rather than new feature behavior: completion-screen button layout outside the wizard shell, admin role-detail spacing, standard page gutters for Locales, shared `Create` wording on admin list pages, and a full replacement of the user-role assignment tab with the same catalog-style selection pattern already used elsewhere.

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Completion screen button order regressed when revisiting onboarding | `CompletionStep` used its own internal action ordering when rendered outside the wizard navigation shell | Reordered the buttons to keep `Start over` on the left and the primary action on the right, with `justifyContent: 'space-between'` for stable layout parity |
| Role detail informational blocks had extra horizontal padding | `RoleEdit` wrapped the header, back action, alert, and content in additional `Box` padders beyond the page layout | Removed the extra wrappers so the detail page aligns flush with the surrounding admin layout |
| Locales page header gutter and CTA wording were inconsistent | The page header did not match the table gutter, and the action text still used the longer add-language wording | Restored header side padding and changed the create action to `Create` |
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
| Onboarding last page button layout | CompletionStep kept its own final CTA while wizard navigation still rendered redundant restart/back actions | Removed `onPrimaryAction` from CompletionStep in the wizard and rewrote final-step navigation to the intended two-button layout with no back action |
| `Start Acting` stayed on `/start` | `shouldResolveAfterCompletion` stopped when `hasWorkspaceAccess` was false | Replaced the effect with direct `navigate('/', { replace: true })` after completion; `HomeRouteResolver` now owns the final destination |
| Metapanel verbose text + padding | Subtitle, `Current platform snapshot`, verbose descriptions, and extra side padding made the dashboard noisy | Removed the subtitle, removed extra card padding, aligned interval labels, and simplified dashboard descriptions |
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
| Copy role dialog: no suffix/codename/tabs | Copy used the source name without a copy suffix, left codename empty, and exposed `copyPermissions` as an inline checkbox | Added `appendCopySuffix()` for VLC names, auto-generates `{codename}_copy`, and moved copy options into a dedicated `Parameters` tab |
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
| Metapanel dashboard | Replaced the old summary-card + role-chip layout with a metahub-board-style one-row dashboard: registered users, applications, metahubs, and a documentation card. Breadcrumb resolution for the root path now shows `Metapanel`. |
| Admin roles UX | The roles list CTA now uses the shared create wording; the role dialog now puts name/description first and codename below a divider; row-level edit opens the dialog instead of navigating away; and the role detail page is now permissions-first with a settings tab that behaves like an inline edit surface. |
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


## 2026-03-17 Admin Roles / Metapanel Corrective Summary

Older same-day corrective closures from 2026-03-17 through 2026-03-11 were condensed into thematic summaries to keep the log chronological and searchable without duplicating every validation transcript.

| Area | Resolution |
| --- | --- |
| Shared dashboard contract | `admin/dashboard/stats` was widened to real workspace-capable users while still denying `registered`-only users, so AdminBoard and metapanel now share one route without leaking admin-only gating into workspace flows. |
| Lifecycle compensation | Admin create-user, registration, and onboarding-completion flows now compensate earlier writes when later role-assignment steps fail, including auth-user cleanup and `onboarding_completed` rollback where applicable. |
| Shell-access semantics | `resolveShellAccess(...)` and aligned backend/frontend guards now separate workspace access from admin-panel access, keep `registered` users on `/start`, and route admin-only roles to `/admin`. |
| Validation | Focused admin/auth/start/backend/frontend validation stayed green before the repository moved into the final 2026-03-18 and 2026-03-19 corrective waves. |

## 2026-03-17 Platform System Attributes And Snapshot-Hash Hardening

| Area | Resolution |
| --- | --- |
| Platform governance | Platform `_upl_*` catalog attributes now follow one backend-resolved admin policy and use dedicated `/system` routes instead of ad hoc tab state. |
| Runtime column propagation | Runtime business tables now honor configurable `_upl_archived*` / `_upl_deleted*` families through shared helpers rather than assuming those columns always exist. |
| Publication snapshot parity | Publication snapshot normalization and release-bundle payload hydration were aligned so `systemFields` and omitted optional keys hash consistently across metahubs and applications packages. |
| Scoped list stability | Tab switches that change semantic list scope now opt out of stale placeholder reuse and reset local UI state accordingly. |
| Validation | Focused shared-utils, schema-ddl, applications-backend, and metahubs slices passed after each corrective pass. |

## 2026-03-16 Platform System Attributes Governance + Migration Hardening

| Area | Resolution |
| --- | --- |
| Governance closure | Platform system attributes stopped depending only on per-metahub settings; the backend now resolves one global admin policy and exposes that result through list-response metadata. |
| Migration hardening | Design-time and runtime lifecycle propagation for system attributes were routed through dedicated metadata channels so disabled `_app_*` families no longer leak back into generated runtime schemas. |
| Template/default behavior | Builtin templates and manual catalog creation now share one idempotent system-attribute seeding path instead of parallel interpretations. |
| Start-app ordering | Start-system support migrations that depend on generated tables now run in `post_schema_generation`, closing fresh-database ordering defects. |
| Validation | Clean-database bootstrap, migration-platform regressions, and touched package validation all stayed green after the hardening wave. |

## 2026-03-15 Start System App Closure Wave

| Area | Resolution |
| --- | --- |
| Architecture migration | The start system app was moved onto the application-like fixed-schema model with definition-driven bootstrap and explicit support-migration boundaries. |
| QA follow-through | Follow-up and second-pass QA defects were closed without reopening the delivered fixed-schema direction. |
| Repository cleanup | Legacy branding, telemetry remnants, and stale env-file examples were removed or normalized alongside the start-app wave. |
| Validation | Startup smoke, focused backend/platform checks, and the root build passed after the final remediation closures. |

## 2026-03-14 Unified Database Access Standardization

| Area | Resolution |
| --- | --- |
| Three-tier contract | Backend DB access was standardized around request-scoped RLS executors, pool executors for admin/bootstrap work, and explicit Tier 3 DDL boundaries for raw Knex usage. |
| Enforcement | `tools/lint-db-access.mjs` became the enforcement gate, and touched routes/services were brought back under lint coverage instead of exempting direct transport access. |
| Identifier safety | Dynamic identifier handling and shared optimistic-lock helpers were hardened so domain SQL keeps schema-qualified, validated identifiers. |
| Documentation sync | READMEs, agent guidance, architecture docs, and memory-bank files were updated to the SQL-first contract. |
| Validation | Focused package tests plus the root `pnpm build` stayed green across the final QA, residual-debt, and post-closure remediation passes. |

## 2026-03-13 Optional Global Catalog, Metahub QA, And Definition Lifecycle

| Area | Resolution |
| --- | --- |
| Optional catalog modes | The repository now supports explicit catalog-enabled and catalog-disabled modes without forcing the full definition registry into the cold-start path. |
| Deterministic baselines | Fixed system apps record deterministic local baseline rows and may backfill missing `_app_migrations` baselines on repeated startup instead of inventing new history. |
| Definition lifecycle | Active imports now use the real draft -> review -> publish lifecycle, and doctor/no-op checks require lifecycle provenance rather than checksum/export parity alone. |
| Bundle/export integrity | Bundle-style exports record lifecycle rows, recompute canonical snapshot hashes, and preserve release/install state through the central applications sync-state seam. |
| Metahub QA | Shared-table sorting/filtering, active-row parity, repeated-start stability, and metahub runtime read contracts were all closed through focused QA reopens. |
| Validation | Migrations-catalog/platform, schema-ddl, core-backend, applications-backend, metahubs-backend, and root-build validation stayed green through the final closure waves. |

## 2026-03-12 System-App Structural Convergence And Acceptance Coverage

| Area | Resolution |
| --- | --- |
| Structural convergence | Admin, profile, applications, and metahubs fixed schemas converged onto one application-like model with definition-driven business-table creation. |
| Metadata/compiler foundation | Fixed-system metadata observability, compiler artifact preservation, legacy reconciliation bridges, and doctor/startup fail-fast gates landed together. |
| Frontend acceptance proof | CRUD flows, sync dialogs, migration guards, runtime shells, and publication-linked application flows received direct acceptance coverage. |
| Ownership seam | Publication-derived runtime sync stopped at the metahubs publication-source seam while applications-backend kept final sync-context ownership. |
| Validation | Focused backend/platform/frontend suites plus the root build remained green after the convergence and acceptance bursts. |

## 2026-03-11 Registry, Naming, And Runtime Ownership Foundation

| Area | Resolution |
| --- | --- |
| Registry foundation | The platform registry moved toward a real draft/review/publish/export/import lifecycle with stronger bootstrap and doctor visibility. |
| Runtime ownership | Application runtime sync ownership was explicitly assigned to `@universo/applications-backend`, with metahubs limited to publication runtime-source loading. |
| Managed naming | Runtime and branch schema naming switched to shared migrations-core helpers to prevent drift across bootstrap, schema-ddl, and cleanup paths. |
| Validation | Focused acceptance, lifecycle, naming, and root workspace validation established the baseline used by later March corrective waves. |

## Older 2026-03-11 To 2026-03-17 Detail Condensed

The older detailed closure transcripts from the same implementation cluster were intentionally compressed into the grouped summaries above to keep this file operationally dense while preserving the delivered outcomes.
