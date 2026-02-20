# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️ | Applications, Template System, DDL Migration Engine, Enhanced Migrations |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮 | Attribute Data Types, Display Attribute, Layouts System |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏 | Branches, Elements rename, Three-level system fields |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶 | Runtime migrations, Publications, schema-ddl |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊 | Applications modules, DDD architecture |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳 | i18n localized fields, VLC, Catalogs |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding, Legal consent, Cookie banner, Captcha |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️ | Pagination fixes, Onboarding wizard |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯 | VLC system, Dynamic locales, Flowise 3.0 |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄 | Admin panel, Auth migration, UUID v7 |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹 | Package extraction, Admin RBAC, Global naming |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿 | Storages, Campaigns, useMutation refactor |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷 | Projects, AR.js Quiz, Organizations |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅 | REST API docs, Uniks metrics, Clusters |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | dayjs migration, publish-frontend, Metaverse Dashboard |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n TypeScript migration, Rate limiting |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown build system |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication system fixes, Metaverses module |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas versioning, Telemetry, Pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Quiz editing, Canvas refactor, MUI Template |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript aliases, Publication library, Analytics |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities architecture, CI i18n |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Resources, Entities modules, Template quiz |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Finance module, i18n, Language switcher |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM template, Colyseus multiplayer |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder, Metaverse MVP, core utils |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌 | Space Builder enhancements, AR.js wallpaper |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️ | Russian docs, UPDL node params |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️ | Memory Bank, MMOOMM improvements |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪 | Handler refactoring, PlayCanvas stabilization |

---

## Unified Action Menus, Row Indexing, Access Member VLC, Migrations Spacing (2026-02-19)

Completed the implementation pass for menu/action consistency, numbering parity, and metahub access dialog modernization.

### Delivered
1. **Unified action menu behavior across target lists/cards**:
   - Removed remaining custom trigger override in `ApplicationMembers` so card/table actions now use the shared three-dot trigger from `BaseEntityMenu`.
   - Kept the Enumerations Values menu as the visual reference implementation.
   - Preserved red destructive entries via `tone: 'danger'` in target action descriptors.

2. **Auto-numbering parity for Hubs/Catalogs/Enumerations**:
   - Added backend auto-assignment for `sortOrder` on create (`max + 1`) in:
     - `MetahubHubsService.create()`
     - `MetahubObjectsService.createObject()` (covers catalogs/enumerations and future object kinds).
   - Updated create routes to stop forcing `sortOrder: 0` when client omits value, enabling service-level sequencing.
   - Kept list sorting by `sortOrder asc` for stable `#` column behavior.

3. **Metahub members dialog modernization (VLC comments)**:
   - `MemberFormDialog` now supports localized comment mode (`commentMode='localized'`) with `LocalizedInlineField`.
   - Metahub member add/edit now reads/writes `commentVlc` payloads and returns both resolved text and VLC object.
   - Add-member title uses localized key (`members.addMemberTitle`) while toolbar trigger text remains short.

4. **Migrations page horizontal spacing alignment**:
   - Preserved/validated negative horizontal compensation in `MetahubMigrations` so table/pagination gutters match list pages.

5. **Type/build hardening during implementation**:
   - Fixed `sortBy` narrow-type comparisons in catalogs/enumerations list sorting blocks.
   - Fixed union typing for member comment normalization in `metahubsRoutes`.

### Verification
- `pnpm --filter @universo/template-mui build` ✅
- `pnpm --filter @universo/applications-frontend build` ✅
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/template-mui exec eslint src/components/menu/BaseEntityMenu.tsx src/components/dialogs/MemberFormDialog.tsx src/factories/createMemberActions.tsx` ✅ (warnings only)
- `pnpm --filter @universo/applications-frontend exec eslint src/pages/ApplicationMembers.tsx` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/metahubs/services/MetahubObjectsService.ts src/domains/metahubs/services/MetahubHubsService.ts src/domains/hubs/routes/hubsRoutes.ts src/domains/catalogs/routes/catalogsRoutes.ts src/domains/enumerations/routes/enumerationsRoutes.ts src/domains/metahubs/routes/metahubsRoutes.ts` ✅ (warnings only)

---

## Hub Delete Blockers for Enumerations (2026-02-19)

Implemented parity blocker logic for Hub deletion so required Enumerations now block deletion exactly like required Catalogs.

### Delivered
1. **Backend blocker detection expanded**:
   - Replaced catalogs-only lookup with grouped object detection in `hubsRoutes`.
   - Added SQL filtering for `kind IN (catalog, enumeration)` with strict required/single-hub conditions.
   - `GET /blocking-catalogs` now returns grouped payload: `blockingCatalogs`, `blockingEnumerations`, `totalBlocking`, `canDelete`.
   - `DELETE /hub/:hubId` now blocks when either group is non-empty and returns grouped `409` payload.

2. **Frontend delete dialog upgraded**:
   - Reworked `HubDeleteDialog` to query grouped blocker payload via TanStack Query.
   - Added separate tables for blocking Catalogs and blocking Enumerations.
   - Added links to object editors (`/catalog/:id/attributes`, `/enumeration/:id/values`).
   - Delete button is now disabled when any blocking object exists.

3. **Localization updated (RU/EN)**:
   - Added grouped warning strings and section labels for catalogs/enumerations.
   - Updated blocker fetch error wording from catalogs-only to generic blocking entities.

### Verification
- `pnpm --filter ./packages/metahubs-backend/base exec eslint src/domains/hubs/routes/hubsRoutes.ts` ✅ (warnings only, no new errors)
- `pnpm --filter ./packages/metahubs-frontend/base exec eslint src/components/HubDeleteDialog.tsx src/domains/hubs/api/hubs.ts` ✅
- `pnpm --filter ./packages/metahubs-backend/base build` ✅
- `pnpm --filter ./packages/metahubs-frontend/base build` ✅

---

## Enumerations QA Remediation Round 5 (2026-02-19)

Implemented final targeted fixes for runtime consistency and connector sync metadata.

### Delivered
1. **`toggle-required` invariant safety fixed**:
   - Added missing `enumerationValuesService` wiring in the route handler to avoid runtime `500`.
   - Preserved required-mode guards for enum REF attributes (`label` mode + ownership validation for `defaultEnumValueId`).

2. **Runtime enum display hardened**:
   - Updated `apps-template-mui` enum REF cell rendering to avoid UUID fallback in grids.
   - Rendering now prefers object label/name and otherwise falls back to an empty value instead of raw UUID.

3. **Connector sync timestamp reliability**:
   - Updated connector touch logic in schema sync flow to always set `_uplUpdatedAt = new Date()` and persist it.
   - This guarantees connector `updatedAt` changes when sync runs, even if user metadata is unchanged.

4. **Lint/prettier blocker removed**:
   - Fixed `HubList.tsx` and `attributesRoutes.ts` formatting issues that produced blocking prettier errors.

### Verification
- `pnpm --filter ./packages/metahubs-backend/base test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts src/tests/services/structureVersions.test.ts` ✅
- `pnpm --filter ./packages/apps-template-mui exec eslint src/utils/columns.tsx` ✅
- `pnpm --filter ./packages/metahubs-frontend/base exec eslint src/domains/hubs/ui/HubList.tsx` ✅ (warnings only)
- `pnpm --filter ./packages/metahubs-backend/base exec eslint src/domains/applications/routes/applicationSyncRoutes.ts src/domains/attributes/routes/attributesRoutes.ts` ✅ (warnings only)
- `pnpm --filter ./packages/metahubs-backend/base build` ✅
- `pnpm --filter ./packages/apps-template-mui build` ✅
- `pnpm --filter ./packages/metahubs-frontend/base build` ✅

---

## Enumerations QA Remediation Round 4 (2026-02-19)

Implemented targeted fixes for the remaining high/medium QA findings on Enumerations runtime and routes.

### Delivered
1. **Runtime edit safety in `FormDialog`**:
   - Changed enum default injection to apply only when field value is `undefined`.
   - Explicit `null` values are preserved and are no longer auto-replaced in edit flow.

2. **Deterministic restore conflict behavior**:
   - Added unique-violation detection in enumeration restore route.
   - `POST /metahub/:metahubId/enumeration/:enumerationId/restore` now returns `409` with a clear conflict message on codename collisions.

3. **Locale fallback consistency for enumeration PATCH**:
   - Aligned hub-scoped PATCH description primary-locale fallback with metahub-scoped PATCH behavior.
   - Existing `description._primary` is now preserved when `descriptionPrimaryLocale` is not explicitly provided.

4. **Regression coverage expansion**:
   - `metahubs-backend`: added restore conflict and locale fallback tests in `enumerationsRoutes.test.ts`.
   - `applications-backend`: added runtime enum validation tests in `applicationsRoutes.test.ts`:
     - reject writes to enum `label` mode fields;
     - reject enum values that do not belong to target enumeration in PATCH.

### Verification
- `pnpm --filter @universo/metahubs-backend test -- enumerationsRoutes.test.ts` ✅
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` ✅
- `pnpm --filter @universo/apps-template-mui exec eslint src/components/dialogs/FormDialog.tsx` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/enumerations/routes/enumerationsRoutes.ts src/tests/routes/enumerationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/applications-backend exec eslint src/tests/routes/applicationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅

---

## Enumerations QA Remediation Round 3 (2026-02-19)

Implemented final safety fixes requested by repeated QA passes for Enumerations.

### Delivered
1. **Schema DDL FK safety for enum references**:
   - Updated `SchemaMigrator` `ADD_FK` flow to resolve the source field and honor `targetEntityKind`.
   - For `REF -> enumeration`, FK now targets `${schema}._app_enum_values(id)` instead of a non-existent physical enumeration table.
   - Added `ensureSystemTables()` call before enum FK creation to guarantee target table existence.

2. **Attribute required-toggle invariant guard**:
   - Hardened `toggle-required` route in `attributesRoutes.ts`.
   - Route now rejects toggling to `required=true` when attribute is `REF -> enumeration`, presentation mode is `label`, and `defaultEnumValueId` is missing or invalid.
   - Added ownership validation: `defaultEnumValueId` must belong to the selected target enumeration.

3. **Enumeration permanent delete blocker parity**:
   - Added blocker checks to `DELETE /metahub/:metahubId/enumeration/:enumerationId/permanent`.
   - Permanent delete now returns `409` with `blockingReferences` when attributes still reference the enumeration, matching soft-delete safety semantics.

4. **Regression tests added**:
   - `schema-ddl`: `SchemaMigrator.test.ts` validates enum FK targets `_app_enum_values`.
   - `metahubs-backend`: `attributesRoutes.test.ts` validates required-toggle guard failures.
   - `metahubs-backend`: `enumerationsRoutes.test.ts` validates permanent-delete blocker behavior.

### Verification
- `pnpm --filter @universo/schema-ddl test -- --runInBand src/__tests__/SchemaMigrator.test.ts` ✅
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/attributesRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts` ✅
- `pnpm --filter @universo/schema-ddl lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/schema-ddl build` ✅
- `pnpm --filter @universo/metahubs-backend build` ⚠️ failed due pre-existing unrelated TypeScript issues in `applicationMigrationsRoutes.ts`, `applicationSyncRoutes.ts`, publication snapshot typing, and local package resolution (`@universo/schema-ddl`) outside this fix scope.

---

## Enumerations QA Remediation Round 2 (2026-02-19)

Implemented an additional safety pass after QA findings:

1. **Metahub structure versioning fixed**:
   - Consolidated system tables into a single `SYSTEM_TABLES_V1` set with `_mhb_enum_values`.
   - Removed V2/V3 split from active code paths.
   - Set `CURRENT_STRUCTURE_VERSION` to `1`.
   - Updated `basic` template `minStructureVersion` to `1`.

2. **Enumerations routes consistency fixed**:
   - API now maps timestamps from `_upl_created_at` / `_upl_updated_at` (with backward-compatible fallback).
   - Added missing `isSingleHub` guard for both global and hub-scoped enumeration create endpoints.

3. **Runtime stale enum references hardened**:
   - During application sync, stale enum references in runtime catalog rows are remapped before soft-deleting removed enum values.
   - Fallback order: field `defaultEnumValueId` (if still active) → enumeration default value → first active value.
   - Required REF fields now fail sync with explicit error if no valid fallback exists.

4. **Lint blockers resolved**:
   - Fixed Prettier errors in:
     - `TemplateSeedExecutor.ts`
     - `TemplateSeedMigrator.ts`
     - `TemplateSeedCleanupService.ts`

5. **Regression coverage updated**:
   - Added `src/tests/services/structureVersions.test.ts`.
   - Updated migration-related tests to assert against `CURRENT_STRUCTURE_VERSION` instead of hardcoded `2`.

### Verification
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/structureVersions.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/routes/metahubMigrationsRoutes.test.ts` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint <touched-files>` ✅ (warnings only, zero errors)

---

## Enumerations Stabilization Implementation (2026-02-19)

Completed IMPLEMENT pass for Enumerations after QA findings. Focus was compile/runtime safety, contract consistency, and verification recovery.

### Delivered
1. **Contract alignment (`presentation` canonicalization)**:
   - normalized enumeration value mapping in publication snapshot serialization;
   - added backward-compatible sync mapping for legacy `name/description` payloads in `_app_enum_values` sync.
2. **Backend blocker fixes**:
   - fixed strict typing in `enumerationsRoutes` update handlers;
   - fixed missing `attributesService` wiring in enumeration value delete handler;
   - fixed metahub migration seed counters (`enumValuesAdded`) across route/meta schemas;
   - fixed blocker query typing in `MetahubAttributesService`.
3. **Shared type safety**:
   - extended optimistic-lock `ConflictInfo.entityType` with `document`.
4. **Tests updated to current structure semantics (V2)**:
   - read-only schema test now expects full V2 table set;
   - migration routes tests now assert `targetStructureVersion: 2`, `MIGRATION_REQUIRED` status, and structured blocker payloads.
5. **Frontend polish**:
   - fixed Prettier errors in new Enumerations frontend files.
6. **Safer enum cleanup strategy in application sync**:
   - replaced hard delete of stale `_app_enum_values` rows with soft-delete updates;
   - added undelete restoration via upsert merge columns for values that reappear in newer snapshots.

### Verification
- `pnpm --filter @universo/utils build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test` ✅ (12 passed, 0 failed)
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- Targeted eslint on touched files: no errors (warnings only) ✅

---

## Enumerations QA Hardening (2026-02-19)

Implemented a safety-focused hardening pass after QA findings for enumeration sync and metadata lifecycle.

### Delivered
1. **Metadata cleanup order fixed**:
   - `schema-ddl` now removes stale `_app_objects/_app_attributes` rows before metadata upsert when `removeMissing=true`.
   - This eliminates unique conflicts on `(kind, codename)` when an object is recreated with a new UUID.

2. **Consistent missing-row cleanup in sync flows**:
   - Enabled `removeMissing: true` in application and publication no-DDL sync branches.
   - Updated migrator metadata sync paths to always prune stale metadata.

3. **Enumeration values sync hardened**:
   - Added duplicate enum value ID guard during snapshot sync.
   - Added stale `_app_enum_values` cleanup for removed enumeration objects.

4. **Declarative schema contract improved**:
   - Added `uidx_mhb_enum_values_default_active` unique partial index to `_mhb_enum_values` system table definitions.

5. **Compatibility + regression fixes in `schema-ddl`**:
   - Added runtime fallback for `enumeration` kind if older `@universo/types` runtime is loaded.
   - Fixed `calculateSchemaDiff()` to restore old entity IDs from snapshot map keys (`Object.entries` path).
   - Added regression tests:
     - enumeration entities are ignored for physical DDL diff;
     - `syncSystemMetadata(removeMissing=true)` cleanup runs before upsert.

### Verification
- `pnpm --filter @universo/schema-ddl lint` ✅ (warnings only)
- `pnpm --filter @universo/schema-ddl test` ✅ (7/7 suites)
- `pnpm --filter @universo/schema-ddl build` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint <touched-files>` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/systemTableMigrator.test.ts` ✅

---

## Enumerations Feature — Frontend/UI Integration (2026-02-18)

Implemented the planned Enumerations integration across metahub UI, attribute presentation settings, and runtime-facing i18n.

### Delivered
1. **Metahubs frontend enumeration domain finalized**:
   - Enumeration list + values list flows
   - Value CRUD hooks/mutations and query invalidation
   - Blocking delete dialog wired for cross-catalog REF references

2. **Navigation and routes completed**:
   - Added `menu.enumerations` entry under metahub navigation
   - Added metahub + hub-scoped enumeration routes in `MainRoutesMUI.tsx`
   - Added external module declarations and package exports

3. **Attribute UX extended for REF -> enumeration**:
   - `TargetEntitySelector` supports `enumeration` target kind
   - Presentation tab now supports:
     - `enumPresentationMode` (`select`, `radio`, `label`)
     - `defaultEnumValueId` from selected enumeration values
   - Added `uiConfig` normalization in create/edit payload builders

4. **Backend validation hardened (`attributesRoutes.ts`)**:
   - Added `uiConfig` schema fields: `enumPresentationMode`, `defaultEnumValueId`
   - Added ownership validation: `defaultEnumValueId` must belong to selected enumeration
   - Added cleanup of enum-only config keys when target is not enumeration

5. **i18n updates (EN/RU)**:
   - New sections: `enumerations`, `enumerationValues`
   - New `ref.*` keys for enumeration target selection
   - New `attributes.presentation.*` keys for enum controls/warnings
   - Added `menu.enumerations` (shared menu locales)
   - Added `app.emptyOption` in runtime app locales

### Verification
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/template-mui build` ✅
- Targeted eslint on changed TS/TSX files: no errors (warnings only) ✅
- `pnpm --filter @universo/metahubs-backend build` ❌ blocked by existing unrelated backend TypeScript issues outside this change set

---

## PR #682 Bot Review Fixes (2026-02-18)

Addressed 9 actionable items from Gemini Code Assist and Copilot PR Reviewer comments on PR #682:

1. **staleTime for list/plan hooks**: Added `staleTime: 30_000` to `useMetahubMigrationsList` and `useMetahubMigrationsPlan` — prevents unnecessary refetches on re-focus/navigation (status hook already uses `MIGRATION_STATUS_QUERY_OPTIONS`).
2. **Unused imports**: Removed `UpdateSeverity` from `metahubMigrationsRoutes.ts` and `applicationMigrationsRoutes.ts` — only `determineSeverity()` is used.
3. **Type safety**: Added `typeof meta?.templateVersionLabel === 'string'` guard in `MetahubMigrations.tsx` — prevents non-string values from reaching UI.
4. **determineSeverity JSDoc**: Clarified that OPTIONAL = "no update needed / pass-through", not a user-visible severity. Added rationale for not introducing a NONE enum value.
5. **AGENTS.md roles**: Fixed `viewer` → `member` to match `ApplicationRole` type.
6. **AGENTS.md statuses**: Added missing `DRAFT`, `OUTDATED`, `UPDATE_AVAILABLE` to `ApplicationSchemaStatus` list.
7. **MIGRATIONS.md**: Fixed guard behavior description — `isAdminRoute` skip (not `/migrations`), maintenance condition (isMaintenance && !isPrivileged, not structureUpgradeRequired), button navigates to `/a/:id/admin`.
8. **memory-bank English-only**: Translated 6 Russian fragments in `progress.md` to English.

**Skipped**: Copilot's suggestion to add `NONE` to `UpdateSeverity` enum — would require changes across 8+ files (types, shared, frontend guards, backend routes) with no behavior change since OPTIONAL already acts as pass-through.

**Build**: 66/66 packages.

---

## QA Fixes + UI Polish Round 6 (2026-02-19)

Seven fixes from QA analysis + user requests:

1. **BUG-1 + WARN-3 — Publication DELETE cascade + N+1**: FK `fk_cp_publication` has ON DELETE CASCADE — `remove()` was deleting `ConnectorPublication` rows before they could be queried for linked app status reset. Fixed: moved status reset query BEFORE `remove()`, replaced N+1 `findOneBy` loop with single bulk UPDATE sub-select (matching `notifyLinkedApplicationsUpdateAvailable()` pattern).

2. **WARN-1 — Prettier fix in ApplicationMigrationGuard.tsx**: `MigrationGuardShell` props re-indented from 12 to 16 spaces (parent `<AppMainLayout>` at 8, child component at 12, props at 16).

3. **WARN-2 — Prettier fix in columns.tsx**: Entire file re-indented from 2-space to project-standard 4-space (89 prettier errors resolved).

4. **Migrations page padding alignment**: Removed extra `px: {xs:1.5, md:2}` from inner Stack — controls now at same horizontal level as ViewHeader, matching MetahubList/PublicationList/BranchList pattern.

5. **Baseline migration template column**: Added `templateVersionLabel` (optional string) to `baselineMetaSchema` Zod discriminated union. Updated `buildBaselineMigrationMeta()` to accept template version. `initSystemTables()` now passes `manifest.version` to baseline record. Frontend shows `"0 → version"` for baseline kind.

6. **Default layout detailsTable widget**: Added standalone `detailsTable` (sortOrder 6, active) to `DEFAULT_DASHBOARD_ZONE_WIDGETS` center zone. `columnsContainer` moved to sortOrder 7 with `isActive: false`. New metahubs will show the table directly instead of inside a multi-column container.

7. **Version reset**: Template version `1.1.0` → `1.0.0` in `basic.template.ts`. Structure version confirmed at 1. `TARGET_APP_STRUCTURE_VERSION` confirmed at 1. Test DB wipe pending.

**Build**: 66/66 packages successful.

---

## UI Polish Round 5 — 5 Fixes (2026-02-19)

Five UI issues fixed after LanguageSwitcher widget integration:

1. **languageSwitcher widget label i18n**: Added `"languageSwitcher"` key to `layouts.widgets` in both EN/RU `metahubs.json`. `LayoutDetails.tsx` line 221 uses `t('layouts.widgets.${item.key}', item.key)` — raw key was showing as fallback.
2. **Dry run button text simplified**: RU locale `dryRun` shortened (removed "(dry run)" suffix), EN `"Dry run"` → `"Verify"`.
3. **Actions column in MUI DataGrid v8 column management panel**: `headerName: ''` (empty) caused field name "actions" to show as fallback. Fixed with `type: 'actions' as const` + non-empty `headerName`.
4. **Table side padding root cause**: `MainLayoutMUI.tsx` `Stack px: {xs:2, md:3}` is layout-level padding (16-24px). Inner `Stack px: 2` + `Box mx: -2` compensating pattern in list pages is by design, not a bug.
5. **Schema/Template columns split**: Replaced single `fromTo` column with separate `schema` (14%) and `template` (14%) columns. Baseline migrations: schema shows `"0 → N"`. Template seed: template shows `"— → {version}"`.

**Modified files**: 4 across 2 packages. **Build**: 66/66 packages.

---

## i18n Fix + LanguageSwitcher Widget (2026-02-18)

Two issues addressed:

1. **i18n consolidation bug**: `consolidateApplicationsNamespace()` in `applications-frontend/i18n/index.ts` was dropping 3 top-level JSON sections (`migrationGuard`, `underDevelopment`, `maintenance`) during resource bundle consolidation. These keys existed in both EN and RU JSON files but were never passed to `registerNamespace()`. Result: guard dialog always showed English fallback text regardless of `i18nextLng` localStorage value. Fixed by adding all 3 sections to the `ApplicationsBundle` type and function return.

2. **LanguageSwitcher widget**: Copied language switcher from `universo-template-mui` to `apps-template-mui` as a dashboard widget:
   - Self-contained component using static language labels (no i18n namespace dependency)
   - Registered in `DASHBOARD_LAYOUT_WIDGETS` (key: `languageSwitcher`, top zone, single instance)
   - Added to `DEFAULT_DASHBOARD_ZONE_WIDGETS` (sortOrder 7, active by default)
   - Integrated into Header (desktop) and AppNavbar (mobile) with `showLanguageSwitcher` config flag
   - Full config pipeline: Zod schema → useCrudDashboard defaults → DashboardLayoutConfig → buildDashboardLayoutConfig
   - Template version bumped `1.0.0` → `1.1.0` to trigger `update_available` on existing metahubs

**New files**: 1 (`LanguageSwitcher.tsx`). **Modified files**: 10 across 4 packages.
**Build**: 66/66 packages.

---

## Post-QA Polish Round 3 — 6 Fixes (2026-02-18)

Comprehensive QA analysis found 6 issues (3 bugs + 3 warnings):

1. **BUG-1 (CRITICAL)**: `MainRoutesMUI.tsx` was missing `import '@universo/applications-frontend/i18n'` — all applications `t()` calls returned English fallbacks. Fixed by adding the import.
2. **BUG-2 (MEDIUM)**: `ConnectorDiffDialog.tsx` had local `SchemaStatus` with 5 values vs 7 in backend. Fixed: exported type from `types.ts`, imported in both components — single source of truth.
3. **BUG-3 (MINOR)**: `paginationDisplayedRows` in `getDataGridLocale.ts` ignored MUI v8 `estimated` parameter. Fixed with proper handling.
4. **WARN-1**: Double `AppMainLayout` wrapping (Guard + Runtime). Fixed by removing from `ApplicationRuntime.tsx`.
5. **WARN-2**: Typo in RU locale key (extra character removed).
6. **WARN-3**: `bgcolor: 'grey.50'` hardcoded — not dark-theme compatible. Changed to `'action.hover'`.

**Files modified**: 7 files across 3 packages.
**Build**: 66/66 packages.

---

## Post-QA Polish — 4 Fixes (2026-02-18)

After manual testing revealed 4 remaining issues (QA assessed ~96% spec coverage):

1. **WARN-1 — MIGRATIONS.md links**: Added `> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)` to 4 README files in `applications-backend` and `applications-frontend` (EN + RU).
2. **Guard dialog theme**: `MinimalLayout` has no ThemeProvider → guard Dialog rendered with default MUI blue buttons. Fixed by wrapping `ApplicationMigrationGuard` with `<AppMainLayout>` from `@universo/apps-template-mui`.
3. **Table i18n**: (a) Actions column showed "actions" in column toggle panel — fixed with `hideable: false`. (b) Pagination showed "1-1 of 1" — MUI X DataGrid v8 ruRU locale lacks `paginationDisplayedRows` — added custom override in `getDataGridLocale.ts`.
4. **SchemaStatus display**: `ConnectorBoard.tsx` had incomplete `SchemaStatus` type (5 values vs 7 in backend). When backend returned `update_available`, UI fell back to default status label. Added `update_available` and `maintenance` to type, `statusConfig`, descriptions, and EN/RU i18n.

**Files modified**: 10 files across 3 packages (`applications-frontend`, `applications-backend`, `apps-template-mui`).
**Build**: 66/66 packages.

---

## Runtime Fix — React is not defined (2026-02-18)

- **Context**: Metahub page (`/metahub/:id`) crashed with `ReferenceError: React is not defined` at `index.mjs:33` in `@universo/migration-guard-shared` ESM bundle.
- **Root cause**: `tsconfig.json` had `"jsx": "react"` (classic transform) which compiles TSX to `React.createElement(...)`, but the source file only imports `{ useState }` from React — no default `import React` exists. The ESM bundle therefore contained `React.createElement` calls with no `React` variable in scope.
- **Fix**: Changed `"jsx": "react"` to `"jsx": "react-jsx"` in `packages/migration-guard-shared/base/tsconfig.json`. The automatic JSX runtime (React 17+) compiles TSX to `_jsx()` / `_jsxs()` calls and auto-imports `react/jsx-runtime`.
- **Verification**: `dist/index.mjs` now contains `import { Fragment, jsx, jsxs } from "react/jsx-runtime"` — zero `React.createElement` references in both ESM and CJS bundles.
- **Build**: 66/66 packages.

---

## QA Fixes Round 2 — WARN-1/2/3 (2026-02-18)

- **Context**: Second QA pass found 3 remaining WARNs after BUG-1 + WARN-3/4/5 fixes.
- **WARN-1**: `MIGRATION_STATUS_QUERY_OPTIONS` (retry: false, refetchOnWindowFocus: false, staleTime: 30_000) was spread into data-listing hooks (`useMetahubMigrationsList`, `useMetahubMigrationsPlan`), suppressing retry and auto-refetch. Removed spread — only `useMetahubMigrationsStatus` retains it.
- **WARN-2**: `utils.ts` (backend-safe entry) re-exported `MIGRATION_STATUS_QUERY_OPTIONS` — a TanStack Query config useless on backend. Removed export; `utils.ts` now exports only `determineSeverity` + `DetermineSeverityOptions`.
- **WARN-3**: `package.json` missing `peerDependenciesMeta` with `optional: true` for React-related peer deps. Added `peerDependenciesMeta` for `react`, `react-dom`, `@mui/material`, `@tanstack/react-query` — prevents peer dep warnings when backend consumes `./utils` only.
- **Files modified**: 3 (`utils.ts`, `package.json`, `useMetahubMigrations.ts`)
- **Build**: 66/66 packages, 0 lint errors. Verified `dist/utils.js` contains only `determineSeverity` chunk.

---

## QA Fixes — BUG-1 + WARN-3/4/5 (2026-02-18)

- **Context**: Fixes for critical and warning issues from comprehensive QA analysis of Migration Guard implementation.
- **BUG-1 (Critical)**: `migration-guard-shared` CJS bundle required `react` and `@mui/material` at top level — backend import of `determineSeverity` loaded React as side effect. Fixed by splitting into two entry points: `./utils` (pure JS, no React/MUI) and `.` (full, React-dependent). Backend imports now use `@universo/migration-guard-shared/utils`. `tsdown.config.ts` produces `index.js/mjs` + `utils.js/mjs`, `package.json` exports both subpaths.
- **WARN-3**: `useMetahubMigrationsList` and `useMetahubMigrationsPlan` duplicated 4/5 query options inline (missing `staleTime: 30_000`). Replaced with `...MIGRATION_STATUS_QUERY_OPTIONS` spread.
- **WARN-4**: `handleApplyKeep` had single try-catch for both `applyMetahubMigrations()` and `statusQuery.refetch()`. If refetch failed after successful migration, user saw "Failed to apply migrations". Separated into two try-catch blocks.
- **WARN-5**: `useCallback` deps included `statusQuery` (unstable object). Extracted `refetchStatus = statusQuery.refetch` (stable ref from TanStack Query) and used in deps.
- **Files modified**: 5 (`utils.ts` new, `tsdown.config.ts`, `package.json`, `applicationMigrationsRoutes.ts`, `metahubMigrationsRoutes.ts`, `MetahubMigrationGuard.tsx`, `useMetahubMigrations.ts`)
- **Build**: 66/66 packages, 0 lint errors.

---

## Migration Guard — Full Spec Coverage (6-Phase Plan) (2026-02-18)

- **Context**: 6-phase plan to achieve 100% spec coverage for the Unified Application Migration Guard. Prior assessment: ~71% coverage.
- **Phase 1 — Table rename**: `_app_layout_zone_widgets` → `_app_widgets` across 3 files (~20 string replacements). Template version `1.2.0` → `1.0.0`. CURRENT_STRUCTURE_VERSION already at 1.
- **Phase 2 — Shared package**: Created `@universo/migration-guard-shared` with `determineSeverity()`, `MIGRATION_STATUS_QUERY_OPTIONS`, and `MigrationGuardShell<TStatus>` (render-props pattern). Dual-format build (ESM+CJS) via tsdown. Peer deps: React ≥18, MUI ≥5, TanStack Query ≥5.
- **Phase 3 — AGENTS.md**: Created 3 new files (metahubs-frontend, applications-backend, migration-guard-shared), updated 2 existing (applications-frontend, metahubs-backend).
- **Phase 4 — MIGRATIONS.md**: Created 8 files (4 packages × EN/RU): metahubs-backend, metahubs-frontend, applications-frontend, applications-backend.
- **Phase 5 — README updates**: Replaced verbose migration sections in metahubs-backend (4 sections) and metahubs-frontend (2 sections) READMEs with brief summaries + links to new MIGRATIONS.md files. Both EN and RU.
- **Phase 6 — Code deduplication**: Both Guards rewritten with `MigrationGuardShell` (202→134 / 199→154 lines). Both backend severity endpoints use `determineSeverity()`. Both frontend hooks use `MIGRATION_STATUS_QUERY_OPTIONS`.
- **New files**: 15 (7 package source + 8 documentation). **Modified files**: 13 code + 4 READMEs.
- **Build**: 66/66 packages (65 + 1 new `migration-guard-shared`). Lint: clean after auto-fix.

---

## Unified Application Migration Guard — QA Fixes Round 2 (2026-02-18)

- **Context**: Fixes for 5 BUGs + 8 WARNs from second comprehensive QA analysis. Also relocated AGENTS.md files.
- **BUG-1**: `extractAxiosError()` returns `ApiError` object, not string — appended `.message` in 4 call sites (ApplicationGuard, MetahubGuard×2, mutations.ts).
- **BUG-2**: `isAdminRoute` used `.includes('/admin')` which matched `/admin-settings` etc. Replaced with regex `/\/admin(\/|$)/`. Same for `isMigrationsRoute`. Removed unused `useMemo` imports.
- **BUG-3**: Application copy inherited stale `schemaStatus` (MAINTENANCE/ERROR/UPDATE_AVAILABLE). Now resets: SYNCED→SYNCED, else→OUTDATED. Clears `schemaError` and `lastSyncedPublicationVersionId`.
- **BUG-4**: Publication DELETE didn't cleanup `UPDATE_AVAILABLE` on linked apps. Added within-transaction reset to `SYNCED`.
- **BUG-5**: Connector/ConnectorPublication DELETE same issue — added `UPDATE_AVAILABLE` → `SYNCED` cleanup.
- **WARN-4**: `notifyLinkedApplicationsUpdateAvailable()` had N+1 query pattern. Replaced with single TypeORM `UPDATE ... WHERE id IN (sub-select)`.
- **WARN-5**: Application sync had no concurrency protection. Added PostgreSQL advisory lock (`pg_try_advisory_lock`) via existing `acquireAdvisoryLock` utility. Returns 409 on conflict.
- **WARN-6**: `useMetahubMigrationsStatus` missing `staleTime` — added `staleTime: 30_000` for consistency with `useApplicationMigrationStatus`.
- **WARN-7**: MetahubGuard severity fallback was inverted (`!status?.severity` showed mandatory). Changed to explicit `status?.severity === MANDATORY` check.
- **WARN-8/11**: MetahubGuard `key={idx}` → `key={blocker.code}`. ApplicationGuard blockers now use i18n with `t('migrationGuard.blockers.${blocker.code}')` — 15 keys added to EN + RU.
- **WARN-9/10/12**: ARIA improvements — Dialog `aria-describedby` + `onClose` for RECOMMENDED. `MaintenancePage`/`UnderDevelopmentPage` — `role='status'` + `aria-live='polite'`.
- **AGENTS.md**: Moved from package root to `/base` dirs (metahubs-backend, applications-frontend). Updated content with advisory lock + publications info.
- **Files**: 10 code files + 2 i18n files + 2 AGENTS.md. Build: 65/65, 0 new lint errors.

---

## Unified Application Migration Guard — QA Fixes (2026-02-24)

- **Context**: Fixes for 2 BUGs + 5 WARNs/INFOs from QA analysis of the Application Migration Guard feature.
- **BUG-1**: "Continue anyway" button in `ApplicationMigrationGuard.tsx` was calling `refetch()` instead of dismissing. Added `useState` dismissed state.
- **BUG-2**: Application copy (`POST /:applicationId/copy`) was missing `appStructureVersion` and `lastSyncedPublicationVersionId` — copied app showed false-positive MANDATORY dialog.
- **WARN-1**: Test timeout in `exports.test.ts` (19s > 15s) — added mocks for 6 unmocked exports. Now ~650ms.
- **WARN-2**: Prettier formatting fixes in guard and hook files.
- **WARN-3**: Changed `key={idx}` to `key={blocker.code}` for stable React keys.
- **INFO-2**: Extracted `TARGET_APP_STRUCTURE_VERSION = 1` constant (was hardcoded in 5 places across 2 files).
- **INFO-5**: Status endpoint now uses `ensureMemberAccess` (any member) instead of `ensureAdminAccess` (admin-only). Prevents 403 for `member` role users entering runtime.
- **Files**: 6 modified. Build: 65/65 packages, 0 errors.

---

## Documentation Updates — QA Recommendations (2026-02-22)

- **Context**: README documentation updates recommended during comprehensive QA analysis of columnsContainer + migration guard feature.
- **metahubs-frontend README** (EN + RU): Added 4 new sections — ColumnsContainerEditorDialog (DnD editor, MAX_COLUMNS=6, MAX_WIDGETS_PER_COLUMN=6), MetahubMigrationGuard (route guard, status check, apply button), Structured Blockers i18n (StructuredBlocker type, rendering pattern), and updated file structure with `domains/layouts/` + `domains/migrations/` directories. Lines: 365 → 435.
- **metahubs-backend README** (EN + RU): Added 3 new subsections to Key Features — Structured Blockers & Migration Guard, ColumnsContainer Seed Config. Added Metahub Migrations Endpoints section with GET/POST and response format. Updated file structure with `migrations/` domain. Lines: 730 → 771.
- **apps-template-mui README** (NEW, EN + RU): Created from scratch — covers dashboard system, zone-based widgets, columnsContainer, widget renderer, CRUD components, route factory, architecture diagrams, DashboardDetailsContext, file structure, key types. 307 lines.
- **Line count parity**: All EN/RU pairs verified — 435/435, 771/771, 307/307.

## QA Bug & Warning Fixes (2026-02-21)

- **Context**: Fixes for 2 BUGs + 3 WARNs from QA analysis. 1 WARN (WARN-4, test failures) confirmed as false positive — tests pass with existing `happy-dom` + `setupTests.ts` config.
- **BUG-1**: "Apply (keep user data)" button disabled when blockers present via `disabled={applying || hasBlockers}` in `MetahubMigrationGuard.tsx`.
- **BUG-2**: Inlined `goToMigrations` into onClick. Fixed pre-existing Rules of Hooks violation — moved `useCallback` + derived state above all conditional returns.
- **WARN-1**: Widget list keys in `SortableColumnRow` changed from `key={idx}` to `key={\`${column.id}-w${idx}\`}` for stable React reconciliation.
- **WARN-2**: `useState` initializer in `ColumnsContainerEditorDialog` simplified from `makeDefaultConfig()` to `[]` — `useEffect` handles real initialization on dialog open.
- **WARN-3**: `handleSave` now filters out `columnsContainer` widgetKeys as defense-in-depth against accidental nesting.
- **Files**: 2 modified (`MetahubMigrationGuard.tsx`, `ColumnsContainerEditorDialog.tsx`).
- **Build**: 65/65 packages, 0 errors. Lint: 0 errors. Tests: 3/3 passing.

---

## 5-Étap QA Fixes — User-Reported Issues (2026-02-20)

- **Context**: Comprehensive QA fixes addressing user-reported issues. 5 étaps, 12 files modified.
- **Étap 1 — Editor canSave + dirty tracking**: `useRef` snapshot for initial state, `isDirty` useMemo, `canSave` prop with width validation in `ColumnsContainerEditorDialog.tsx`. Added `widthError` i18n key to EN/RU.
- **Étap 2 — LayoutDetails inner widgets**: `getWidgetChipLabel()` shows inner widget names for columnsContainer via `col.widgets.flatMap()`.
- **Étap 3 — Migration guard button**: Warning-color "Apply (keep data)" button in `MetahubMigrationGuard.tsx` with loading/error states. Added `applyKeepData` i18n key.
- **Étap 4 — Structured blockers i18n** (7 files): New `StructuredBlocker` interface in `@universo/types`. 16 blocker sites converted (11 cleanup service + 5 migration routes). Frontend renders with `<ul>/<li>` and `t()`. 15 i18n keys added. Pattern: systemPatterns.md#structured-blocker-pattern
- **Étap 5A — multiInstance revert**: `columnsContainer.multiInstance` → `true`, MainGrid `.find()` → `.filter()` for multiple containers.
- **Étap 5B — Multi-widget columns** (6 files): New `ColumnsContainerColumnWidget` interface, column `widgetKey` → `widgets[]` array, `widgetRenderer.tsx` renders per-column widget lists, editor rewrite with `MAX_WIDGETS_PER_COLUMN=6`. Added `addWidget` i18n key.
- **Build**: 65/65 packages, 0 errors.
- **Files**: `metahubs.ts`, `ColumnsContainerEditorDialog.tsx`, `LayoutDetails.tsx`, `MetahubMigrationGuard.tsx`, `migrations.ts`, `metahubs.json` (EN+RU), `TemplateSeedCleanupService.ts`, `metahubMigrationsRoutes.ts`, `layoutDefaults.ts`, `MainGrid.tsx`, `widgetRenderer.tsx`.

---

## QA Fixes for columnsContainer Implementation (2026-02-17)

- **BUG-1**: Changed `columnsContainer.multiInstance` from `true` to `false` in `metahubs.ts` — MainGrid uses `.find()` which only returns first instance; multiple were silently ignored.
- **BUG-2**: Added `Array.isArray(colConfig.columns)` guard in `widgetRenderer.tsx` — JSONB config from DB is cast without runtime validation; non-array values could crash `.map()`.
- **WARN-1/1b**: Memoized `details` object via `useMemo` in `DashboardApp.tsx` and `ApplicationRuntime.tsx` — new reference each render caused consumer re-renders. Fixed Rules of Hooks violation (hooks before early returns).
- **WARN-2**: Extracted `EMPTY_WIDGET_CONFIG = Object.freeze({})` module-level constant — virtual `ZoneWidgetItem` had `config: {}` (unstable reference) per render.
- **WARN-3**: Added JSDoc comment for `showDetailsTable` in `MainGridLayoutConfig` interface explaining semantics when `columnsContainer` is present.
- Build: 65/65 OK. Files: `metahubs.ts`, `widgetRenderer.tsx`, `MainGrid.tsx`, `DashboardApp.tsx`, `ApplicationRuntime.tsx`.

---

## Center Zone columnsContainer + Data-Driven MainGrid (2026-02-19)

- **Context**: Fixes BUG-5 (no columnsContainer in seed), BUG-6 (widget duplication), INFO-2 (confusing detailsSidePanel).
- **Etap A**: Zone-aware `buildDashboardLayoutConfig()` with `centerActive` set. Removed `showDetailsSidePanel`, added `showColumnsContainer`.
- **Etap D**: Center zone seed: columnsContainer (sortOrder 6) with detailsTable (width 9) + productTree (width 3). Template version `1.1.0` → `1.2.0`.
- **Etap B**: Runtime API expanded to include center zone. Updated Zod schema and types.
- **Etap C**: Created `DashboardDetailsContext.tsx`. MainGrid renders columnsContainer via `renderWidget()` with standalone fallback.
- **Etap F**: Removed `showDetailsSidePanel` from all configs, types, i18n. Replaced with `showColumnsContainer`.
- **Etap E**: Migration verification (TemplateSeedMigrator + enrichConfig). Build: 65/65 OK.
- 1 file created, 13+ modified.

---

## Dashboard Zones & Widgets Enhancement — 4 Phases + QA Fixes (2026-02-18)

- **Design**: `memory-bank/creative/creative-dashboard-zones-widgets.md`.
- **Phase 1**: Split detailsSidePanel → productTree + usersByCountryChart. Updated DashboardLayoutConfig, useCrudDashboard, Zod schema, i18n.
- **Phase 3**: Right Drawer. `SideMenuRight.tsx` (280px permanent), `SideMenuMobileRight.tsx` (temporary). Dual drawer support in Dashboard + AppNavbar. Backend zone filter expanded.
- **Phase 2**: columnsContainer widget. `ColumnsContainerConfig` type, `ColumnsContainerEditorDialog.tsx` with DnD-sortable columns, recursive grid rendering.
- **Phase 4**: `createAppRuntimeRoute()` factory for routing isolation.
- **QA Fixes**: BUG-1 (dead state reset), BUG-2 (ghost widget), BUG-3 (template version), BUG-4 (isActive from seed), WARN-1 (width validation), WARN-2 (column limit), WARN-3 (recursion guard), WARN-4 (anchor comment). Prettier applied.
- 5 files created, 17+ modified. Build: all packages OK.

---

## Architecture Refactoring — Headless Controller Hook + Adapter Pattern (2026-02-17)

- **Problem**: ~80% duplication between DashboardApp (483 lines) and ApplicationRuntime (553 lines).
- **Solution**: `CrudDataAdapter` interface + `useCrudDashboard()` headless controller hook.
- **Adapters**: `createStandaloneAdapter()` (raw fetch) + `createRuntimeAdapter()` (auth'd apiClient).
- **Shared components**: `CrudDialogs`, `RowActionsMenu`, `toGridColumns()`, `toFieldConfigs()`.
- **Result**: DashboardApp 483→95 lines (-80%), ApplicationRuntime 553→130 lines (-76%).
- 7 files created, 4 modified. Pattern: systemPatterns.md#headless-controller-hook

---

## UI Polish — Button Position, Actions Centering, DataGrid i18n (2026-02-17)

- Create button moved below title. Options button centered in DataGrid cells.
- DataGrid i18n: `getDataGridLocaleText()` utility → `ruRU` locale via `localeText` prop. Column menu and pagination fully localized.
- 6 files modified, 1 created. Build: 65/65 OK.

---

## QA Round 6 Fixes — M1-M4, UX Improvements (2026-02-17)

- **M1**: Required-field null check in PATCH bulk update. **M2**: `extractErrorMessage()` helper (JSON error parsing).
- **M3**: 5 shared mutation hooks in `mutations.ts`, refactored ApplicationRuntime (~80 lines removed).
- **M4**: Schema fingerprint tracking via `useRef` (prevents stale data submission).
- Actions dropdown: `MoreVertRoundedIcon` menu (28x28, width 48). Button text simplified. i18n keys added.

---

## QA Round 5 Fix — Dialog Input Styling (2026-02-16)

- **Root cause**: `apps-template-mui` shared-theme had original MUI Dashboard compact input style (`MuiOutlinedInput.input: { padding: 0 }`, `notchedOutline: { border: 'none' }`). Incompatible with standard form Dialog fields — cramped/unreadable inputs.
- **Key insight**: `universo-template-mui` already had proper form-compatible spacing. `apps-template-mui` still had the untouched original.
- **Fix applied** to `inputs.tsx`: replaced compact style with `padding: '15.5px 16px'`, standard `notchedOutline` border, multiline support.
- Added `MuiInputLabel` customization (floating label, shrink background, focused color).
- Added `MuiButton` disabled state (`opacity: 0.6`) + per-variant disabled colors.
- Added `sharedInputSpacing` / `sharedInputSpacingSmall` constants for consistent padding.
- Build: 65/65 OK.

---

## QA Fixes Round 4 — Theme Dedup, Runtime Rename (2026-02-16)

- **THEME-1 (CRITICAL)**: Removed duplicate `<AppTheme>` + `<CssBaseline>` from `Dashboard.tsx`. Theme already provided by parent `AppMainLayout`.
- **RUNTIME rename** (60+ identifiers across 6+ files):
  - `api.ts`: `fetchApplicationRuntime`→`fetchAppData`, `ApplicationRuntimeResponse`→`AppDataResponse`, etc.
  - `mutations.ts`: `runtimeKeys`→`appQueryKeys`, `useRuntimeRow`→`useAppRow`. Cache namespace: `'application-runtime'`→`'application-data'`.
  - `DashboardApp.tsx`: imports, local var `runtime`→`appData`, i18n keys `runtime.*`→`app.*`.
  - `ApplicationRuntime.tsx`: new `FormDialog`/`FieldConfig`/`FieldValidationRules` imports, i18n keys.
  - `tsconfig.runtime.json`→`tsconfig.build.json` + package.json script updated.
- **i18n**: Renamed `runtime.*` → `app.*` in 4 locale files (apps-template-mui + applications-frontend, EN + RU).
- **Backward compat**: Deprecated aliases preserved (`ApplicationRuntimeResponse`, `runtimeKeys`, `RuntimeFormDialog`).
- Build: 65/65 OK.

---

## QA Fixes Round 3 — Theme, Hooks, Delete, i18n, Layout (2026-02-15)

- Created `AppMainLayout` component (theme wrapper). Fixed hooks order in DashboardApp.
- Fixed ConfirmDeleteDialog auto-close. FormDialog i18n with `useTranslation`. 16 new i18n keys.
- Deleted dead code (MinimalLayout, TableRoute, empty routes/). Build: 65/65 OK.

---

## QA Fixes Round 2 — Validation, Cache, VLC (2026-02-14)

- **DATE-1 (MEDIUM)**: Added `new Date()` + `isNaN` check in `coerceRuntimeValue` for DATE type. Invalid dates return 400 instead of PostgreSQL 500.
- **VALID-2 (LOW)**: UUID validation for `catalogId` query param in GET-row and DELETE handlers.
- **VALID-3 (LOW)**: UUID validation for `applicationId` in main GET runtime endpoint.
- **CACHE-1 (LOW)**: Broadened cache invalidation — use `runtimeKeys.list(applicationId)` without catalogId.
- **VLC-1 (LOW)**: Structural check for VLC objects — require `locales` property in `coerceRuntimeValue`.
- Files modified: `applicationsRoutes.ts`, `mutations.ts`. Build: 65/65 OK.

---

## QA Fixes — Runtime CRUD Security & UX (2026-02-15)

- **VALID-1 (MEDIUM)**: `UUID_REGEX` constant + UUID format validation for `applicationId` and `rowId` path params. Returns 400 instead of PostgreSQL 500 on malformed IDs.
- **AUDIT-1 (LOW)**: Added `_upl_updated_by` to per-field PATCH and bulk PATCH endpoints. Extended `resolveRuntimeSchema` to return `userId`.
- **UX-1 (MEDIUM)**: Removed `throw err` from `handleConfirmDelete` in `ApplicationRuntime.tsx` and `RuntimeDashboardApp.tsx`. Error displayed via `setDeleteError()`, re-throw caused Unhandled Promise Rejection.
- **I18N-1 (LOW)**: Updated standalone `apps.json` error keys (EN + RU) with `{{message}}` interpolation.
- **Not fixed (by design)**: AUTH-1 (role restrictions — architectural), OCC-1 (optimistic concurrency — deferred), CSRF-1 (dev-only).
- Files modified: `applicationsRoutes.ts`, `ApplicationRuntime.tsx`, `RuntimeDashboardApp.tsx`, `apps.json` (EN + RU). Build: 65/65 OK.

---

## Runtime CRUD + VLC + i18n + DataGrid Improvements (2026-02-15)

- 7 phases: Backend API (POST/PATCH/DELETE runtime rows), Components (FormDialog, LocalizedInlineField, ConfirmDeleteDialog), API/Mutations, CRUD UI, i18n, DataGrid UX, Finalization.
- Full CRUD lifecycle with VLC support, validation rules, date/JSON types. Build: 65/65 OK.

---

## Metahubs UX Improvements — Boolean Fix, Auto-fill, Presentation Tab, Header Checkbox (2026-02-13)

- Boolean indeterminate fix: DDL `.defaultTo(false)`, runtime normalizer `null→false`, frontend `indeterminate={false}`.
- Auto-fill: publication name from metahub name + " API" suffix.
- Presentation tab: `uiConfig` for attributes with `headerAsCheckbox` option. Full pipeline: backend schema → SQL → Zod → DataGrid renderHeader.
- QA: TYPE-1 (uiConfig type), CONCUR-1 (shallow merge). Build: 65/65 OK.

---

## UI/UX Polish Round 2 — Menu Fix, Create Buttons, Widget Toggle (2026-02-14)

- **Menu fix**: Fixed "Layouts" menu position in PRODUCTION config (`menuConfigs.ts` in `universo-template-mui`). Previous fix was in legacy config only. Also synced `metahubDashboard.ts` with missing migrations item.
- **Create buttons**: Changed `tc('addNew')` → `tc('create')` in primaryAction across 10 list pages (metahubs: 8, applications: 2). Global `addNew` key preserved for Flowise-upstream pages.
- **Widget toggle**: Replaced MUI `Switch` with text `Button` + icon (`ToggleOn`/`ToggleOff`) in `LayoutDetails.tsx`. Inactive widget label dimmed (opacity 0.45) but action buttons remain full opacity.
- Key discovery: TWO separate sidebar menu configs exist — `metahubDashboard.ts` (legacy) and `menuConfigs.ts` (production). Both now synchronized.
- Build: 65/65 OK.

---

## UI/UX Polish — Create Buttons, Hubs Tab, Codename AutoFill (2026-02-14)

- **Hubs tab**: Removed conditional display in catalog edit dialog — always shows, matching create mode behavior.
- **Create dialog button**: Changed "Save"/"Saving" → "Create"/"Creating" in 10 create dialogs across metahubs (8) and applications (2). Edit/copy dialogs unchanged.
- **Codename auto-fill**: Fixed `useCodenameAutoFill` hook — reset `codenameTouched` when name is fully cleared in edit mode, enabling auto-generation restart.
- Build: 65/65 OK.

---

## 2026-02-13: QA Remediation, Migration Fixes, Widget Activation ✅

### QA Round 2 Remediation + Menu + Version Reset
- Fixed `ensureDefaultZoneWidgets` and `createLayout` to respect `isActive` from defaults (`isActive !== false`).
- Added unique partial index `idx_mhb_widgets_unique_active` on `(layout_id, zone, widget_key, sort_order)`.
- Fixed stale test expectations in migrations and branches test suites.
- Fixed `layoutCodename → template_key` assumption in `TemplateSeedCleanupService`.
- Consolidated V1/V2/V3 into single V1: `CURRENT_STRUCTURE_VERSION=1`, template `1.0.0`, `minStructureVersion=1`.

### Zod Schema + cleanupMode + Seed isActive
- Zod `isActive` fix: added `isActive: z.boolean().optional()` to `seedZoneWidgetSchema`.
- `cleanupMode` default `'keep'` → `'confirm'` across backend route, frontend hooks, and UI handler.
- Added `isActive` to `DefaultZoneWidget` type, mapped through `buildSeedZoneWidgets()`.
- i18n: `UI_LAYOUT_ZONES_UPDATE` case in `ConnectorDiffDialog` + keys.

### Migration 503 Pool Starvation Fix
- Root cause: `Promise.all(7×hasTable)` in `inspectSchemaState` + tarn.js pool max=2 → deadlock.
- Fix: Replace with single `information_schema.tables` query. Same for `widgetTableResolver`.
- Pool formula updates: Knex default from `floor(budget/4)` to `floor(budget/3)`.

### Widget Activation Toggle
- Structure V3 DDL (`is_active` column in `_mhb_widgets`) + backend service toggle + route.
- Hash normalization with `isActive`, optimistic UI update + rollback for toggle.
- Snapshot/Publication pipeline updates, frontend types/API/UI/i18n.

### README Documentation
- Full rewrite metahubs-backend README.md (EN, 730 lines) + README-RU.md (RU, 730 lines).
- Build: 65/65 OK.

---

## 2026-02-12: QA Rounds 9-16 — Pool, Locks, Cache, Migrations ✅

### Round 9: Migration Gate, Baseline Compatibility, Pool-Safe Apply
- DB-aware `ensureSchema()` with strict order: structure migration → seed sync.
- Widget table resolver aligned to `_mhb_widgets`.
- Deterministic API error model: `MIGRATION_REQUIRED` (428), `CONNECTION_POOL_EXHAUSTED` (503).
- `GET /metahub/:metahubId/migrations/status` preflight endpoint.
- Frontend `MetahubMigrationGuard` modal — blocks non-migration metahub pages.
- Serialized in-process advisory-lock acquires per lock key in `@universo/schema-ddl`.

### Round 10: Template Version Source, Cache Safety, Retry/Loading UX
- `plan/status` now read current template from branch sync fields (`last_template_version_id`).
- Removed unsafe early cache-return paths in `ensureSchema()`.
- Apply pointer update requires confirmed branch sync (409 if not).
- Disabled auto-retries for migration queries, added Apply button loading indicator.
- Connect-timeout errors mapped to deterministic 503.

### Round 11: Read-Only EnsureSchema, Scoped Repos
- Split `ensureSchema()` into explicit modes: `read_only` / `initialize` / `apply_migrations`.
- Read paths return 428 for outdated structure/template — no hidden DDL side effects.
- Version-aware expected table validation, partial-schema detection.
- Request-scoped manager via `getRequestManager` for migration routes. Frontend refetch flow fixes.

### Round 12: Request-Scoped SchemaService Manager
- `MetahubSchemaService` constructor accepts optional `EntityManager`.
- Internal repo operations use `repoManager` to avoid extra pool acquisitions.
- Propagated to all metahub backend entry points (catalogs, hubs, elements, attributes, layouts, publications, migrations).

### Round 13: Atomic Structure Sync, Scoped Resolver, Retry Dedup
- Branch `structureVersion` update only after successful structure + seed sync.
- `resolveWidgetTableName` accepts transaction context for executor/migrator.
- `auth-frontend` API client: `transientRetryAttempts = 0` (retries via React Query only).
- Timeout/pool failures → deterministic 503, domain errors preserved.

### Round 14: Apply Error Mapping, Status Load Shedding, Copy Sync Fields
- Apply pre-plan errors mapped through common migrations route mapper (not generic 422).
- `GET /migrations/status` requests plan without seed dry-run (reduced DB pool pressure).
- Metahub copy now transfers `lastTemplateVersionId/Label/SyncedAt` to branch.
- Fixed `SchemaGenerator` NUMBER default test in `@universo/schema-ddl`.

### Round 15: Apply Post-Read Safety, Widget Cache, Lock Semantics
- Post-apply response tolerates read failures — returns `status: "applied"` with `postApplyReadWarning`.
- Widget table resolver cache invalidated before template seed sync paths.
- Copy rollback: explicit error aggregation instead of silent swallowing.
- Advisory lock helper: throws on DB/connect failures instead of returning false.

### Round 16: Pool Contention + Initial Branch Compensation
- RLS cleanup guard: skip reset-query when `QueryRunner` never connected.
- Pool budget rebalance: explicit env knobs for TypeORM/Knex split.
- `createInitialBranch`: advisory lock + transactional metadata + safe schema rollback.
- Regression test for initial-branch cleanup path.
- 12 test suites, 76+ tests across all rounds. Build: 65-73/65-73 packages OK.

---

## 2026-02-11: QA Rounds 3-8, Structure Baseline, Template Cleanup ✅

### Structure Baseline + Template Cleanup Policy
- `_mhb_widgets` baseline table, `CURRENT_STRUCTURE_VERSION=1`.
- Diff engine emits `RENAME_TABLE` and `RENAME_INDEX` operations via `renamedFrom` metadata.
- Migrator executes rename transactionally before other additive changes.
- `TemplateSeedCleanupService` with modes `keep`/`dry_run`/`confirm` + ownership safety checks.
- Removed starter `tags` catalog from `basic.template.ts` for new metahubs.
- Added regression tests for baseline cleanup blocker behavior.

### QA Round 3: Security + Atomicity + Seed Consistency
- Metahub access checks across all publications/migrations endpoints with request-scoped `QueryRunner`.
- Publication delete: advisory lock + pessimistic row locks + fail-fast on schema drop errors.
- Kind normalization to canonical lowercase (`catalog|hub|document`).
- Protected non-empty layout `config` from seed widget sync overwrite.
- Replaced unsafe `JSON.parse` with safe parser fallback.

### QA Round 4: Branch Access + Delete Locking
- Explicit metahub access guards in branches routes (read vs `manageMetahub`).
- Metahub delete: advisory lock → transactional row-level pessimistic locks → safe schema drop.
- Replaced 32-bit hash lock-key with `hashtextextended` strategy in `@universo/schema-ddl`.
- Restored QA gate: green suites for `branchesOptions`, `catalogsRoutes`, `metahubsRoutes`.

### QA Round 5: Locks, Migration Semantics, Copy Safety
- Application rollback route migrated to shared advisory lock helpers.
- `SystemTableMigrator` aborts automatic apply when destructive diffs detected.
- Metahub copy excludes soft-deleted branches, maps unique DB conflicts → 409.
- Frontend test fixes: board mock, Vitest CSS handling, flaky timeout resilience.

### QA Round 6: Consistency, Races, Lock Timeout
- Source-less branch creation stores `structureVersion = manifest.minStructureVersion`.
- PostgreSQL unique-violation extraction (`code=23505`) → deterministic HTTP 409.
- Advisory lock: session-safe timeout via `set_config` + explicit `RESET` before release.

### QA Round 7: Branch Cache Consistency & Conflict Semantics
- User-branch cache invalidation/update utilities in `MetahubSchemaService`.
- `ensureSchema` race hardening: branch context resolved under advisory lock.
- `findByCodename` filters only active rows (matching partial unique index).
- Branch delete lock contention mapped to HTTP 409.

### QA Round 8: MSW, Coverage Gate, Route Hygiene
- MSW handlers for `/api/v1/templates` and `/api/v1/templates/:templateId`.
- `vitest.config.ts` env-driven coverage mode (`VITEST_COVERAGE`, `VITEST_ENFORCE_COVERAGE`).
- Replaced `any` catches with `unknown` + safe extraction in branches routes.
- Default branch cache invalidation regression test.

### DDL Deep Fixes + Declarative DDL QA
- JSONB `meta` column fix, unique migration names, SQL identifier quoting.
- Entity lookup by `kind`, layouts/zone widgets incremental migration, lazy manifest load.
- Copy route structureVersion, branch creation structureVersion, shared helper extraction.
- Build/test: all rounds green.

---

## Metahub Migration Hardening — Structured Plan/Apply (2026-02-11)

- Typed migration metadata contracts in `metahubMigrationMeta.ts`: `baseline | structure | template_seed | manual_destructive` discriminated payloads with safe parse/write paths.
- Template manifest validation with cross-reference safety checks (layouts, widgets, entities, elements, attribute targets) and structure compatibility guard.
- Seed migration dry-run planning using `TemplateSeedMigrator` with `dryRun` flag, seed-sync events in `_mhb_migrations`.
- Upgraded plan/apply API: structured structure-diff by version step, deterministic apply blocking on destructive blockers (422), lock contention → 409.
- Branch-level template sync tracking fields (`last_template_version_id`, `last_template_version_label`, `last_template_synced_at`) wired into schema ensure/apply flow.
- Seed executor layout lookup corrected: uses `template_key` per layout without codename fallback ambiguity.
- Added tests: `templateManifestValidator.test.ts`, `metahubMigrationMeta.test.ts`, extended `metahubMigrationsRoutes.test.ts`.
- Build + tests: OK.

---

## 2026-02-10: Template System, DDL Engine, Migration Architecture ✅

### Metahub Template System (10 phases)
- DB entities: `templates` and `templates_versions` with TypeORM migration.
- `TemplateSeedExecutor`: applies seed to metahub schema (catalogs, attributes, elements, layouts, widgets).
- `TemplateManifestValidator` (Zod-based): validates JSON template structure.
- `TemplateSeeder`: SHA-256 idempotent seeding at application startup.
- Frontend `TemplateSelector`: chip layout, localization, edit display, default auto-selection, disabled in edit mode.
- Build: 65/65 OK.

### QA Fixes + Hardening — Template System
- Zod VLC schema fix, default template auto-assign, `SYSTEM_SEEDER_MARKER` audit fields.
- Transaction wrapper in `TemplateSeedExecutor` for atomicity.
- Atomic metahub creation (full transaction), strict VLC schema `_schema: z.literal('1')`.
- Runtime manifest validation, shared DTO types, `widgetKey` type narrowing.

### Declarative DDL & Migration Engine (7 phases)
- `SystemTableDef` declarative types with shared field sets (`UPL_SYSTEM_FIELDS`, `MHB_SYSTEM_FIELDS`).
- 6 V1 tables defined. `SystemTableDDLGenerator` for CREATE/INDEX SQL.
- `SystemTableDiff` engine for schema comparison. `SystemTableMigrator` with additive auto-migration + destructive warnings.
- Layout defaults dedup. Build: 65/65 OK.

### DDL Phase 2 — FK Diff + Seed Enrichment
- `buildIndexSQL` DRY refactor (helper extracted).
- FK diff detection: `ADD_FK`, `DROP_FK`, `ALTER_COLUMN` in SystemTableDiff.
- `_mhb_migrations` table (V2), `SystemTableMigrator` FK support with `recordMigration`.
- Seed enrichment: settings (language, timezone), entities (tags catalog with attributes), elements.
- `TemplateSeedMigrator` implementation for existing metahub upgrades.

### Migration Architecture Reset
- V1 baseline with baseline entry in `_mhb_migrations`.
- Decoupled template seed from structure upgrades, idempotent seed migration.
- `ALTER_COLUMN` handling in system structure migrator (no silent skips).
- Migration history/plan/apply backend API, Migrations page + menu route.
- Explicit metahub snapshot/version envelope types.

### Metahubs UX Fixes
- Template description overflow in TemplateSelector.
- KnexClient pooler warning documented. Application runtime checkbox (catalogId fix).

---

## 2026-02-09: PR Review + Menu/Layout Widget System ✅

- **PR #668 Bot Review Fixes**: Zod schema mismatch (menus, menu items), non-deterministic `Object.keys` → `Object.values`, unused imports cleanup.
- **Move Menu into Layout Widget System**: Removed menus domain (service + routes). MenuWidgetConfig with embedded items. Backend PATCH route for widget config. Publication pipeline updated. Frontend `MenuWidgetEditorDialog`, `MenuContent` integration. 8 phases.
- **Menu Widget QA Fixes**: 6 issues fixed — LocalizedInlineField for VLC, default menu title, edit button on chips, runtime catalog rendering, title display.
- **Menu editor UX**: EntityFormDialog, left-aligned toggle, item dialog field reorder, publication version dialog alignment.

---

## 2026-02-08: Layout Widget System (DnD, Edit, Zone Rendering) ✅

- Widget DnD reorder, zone rendering, widget configuration, editor dialog for columnsContainer.
- `widgetRenderer.tsx` shared renderer, SortableWidgetChip with icons.
- Menu legacy nav removal, editor polish (EntityFormDialog pattern).

---

## 2026-02-07: Application Runtime + DataGrid ✅

- Application runtime page with DataGrid: column transformers, row counts, menu propagation.
- Route refactoring: `createAppRuntimeRoute()` factory, centralized route definitions.
- Menu rendering in SideMenu/SideMenuMobile from runtime API data.

---

## 2026-02-06: Layouts System Foundation ✅

- Layouts domain: backend CRUD routes, frontend LayoutList/LayoutDetails/LayoutInput.
- Zone widget management: default widgets per zone, drag-and-drop ordering.
- Application sync for layout config. DashboardLayoutConfig type.
- Pattern: systemPatterns.md#dual-sidebar-menu-config

---

## 2026-02-05: Attribute Data Types + Display Attribute + Layouts ✅ (v0.49.0-alpha)

- Enhanced attribute data types (STRING, NUMBER, BOOLEAN, DATE, REF, JSON) with validation rules.
- Display attribute feature with auto-selection for single-attribute catalogs.
- MUI 7 migration prep. Layouts system initial implementation.
- Pattern: systemPatterns.md#attribute-type-architecture

---

## 2026-01-29 through 2026-02-04: Branches, Elements, System Fields ✅ (v0.48.0-alpha)

- Metahub branches system (create, activate, delete, copy with schema isolation).
- Records renamed to Elements across backend, frontend, types, i18n.
- Three-level system fields (`_upl_*`, `_mhb_*`, `_app_*`) with cascade soft delete.
- Optimistic locking (version column, 409 conflicts, email lookup for `updated_by`).
- Pattern: systemPatterns.md#three-level-system-fields

---

## 2026-01-16 through 2026-01-28: Publications, schema-ddl, Migrations ✅ (v0.47.0-alpha)

- Runtime migrations (schema sync between metahub design and application runtime).
- Publication as separate entity with application-centric schema sync.
- `@universo/schema-ddl` package for DDL utilities (SchemaGenerator, SchemaMigrator, KnexClient).
- Isolated schema storage + publication versioning system.
- Codename field consolidation across metahubs.
- Pattern: systemPatterns.md#runtime-migration-pattern, systemPatterns.md#applications-config-data-separation

---

## 2026-01-11 through 2026-01-15: i18n, VLC, Catalogs ✅ (v0.45.0-alpha, v0.46.0-alpha)

- Applications modules (frontend + backend) with Metahubs publications integration.
- Domain-Driven Design architecture refactoring for metahubs packages.
- VLC (Versioned Localized Content) localization system for metahub entities.
- Catalogs functionality in Metahubs (CRUD, attributes, elements).
- i18n localized fields UI, admin locales refactoring.
- Pattern: systemPatterns.md#vlc-utilities

---

## 2026-01-04 through 2026-01-10: Auth & Onboarding ✅ (v0.44.0-alpha)

- Onboarding completion tracking with registration 419 auto-retry.
- Legal consent feature (Terms of Service, Privacy Policy) during registration.
- GDPR-compliant cookie consent banner.
- Yandex SmartCaptcha integration. Auth feature toggles.
- StartFooter component, i18n migration, auth error handling improvements.
- Pattern: systemPatterns.md#public-routes-401-redirect, systemPatterns.md#csrf-token-lifecycle

---

## 2025-12-18 through 2025-12-31: VLC, Flowise 3.0, Onboarding ✅ (v0.42.0-alpha, v0.43.0-alpha)

- VLC system implementation + breadcrumb hooks refactoring.
- Dynamic locales management system. Flowise Components upgrade 2.2.8 → 3.0.12.
- AgentFlow Agents + Executions integration (Flowise 3.x).
- Pagination display + localization fixes. Onboarding wizard with start pages i18n.

---

## 2025-12-05 through 2025-12-17: Admin Panel, Auth, Package Extraction ✅ (v0.40.0-alpha, v0.41.0-alpha)

- Admin panel disable system with ENV-based feature flags.
- Axios 1.13.2 upgrade (CVE-2025-27152 fix). Auth.jsx → auth-frontend TypeScript migration.
- Dynamic role dropdown for global users. Legacy comment cleanup.
- UUID v7 infrastructure and core backend package.
- Package extraction: Tools, Credentials, Variables, ApiKey, Assistants, Leads, ChatMessage, DocStore, Custom Templates.
- Canvas migrations consolidation + Zod validation schemas.
- Global package naming refactoring. Admin panel + RBAC system. Admin Instances MVP.
- Pattern: systemPatterns.md#source-only-package-peerdependencies

---

## 2025-11-07 through 2025-11-25: Organizations, Projects, Campaigns ✅ (v0.36.0-v0.39.0-alpha)

- dayjs migration, UI component refactoring, publish-frontend TypeScript migration.
- Russian README files with UTF-8 encoding. Metaverse Dashboard with analytics.
- REST API docs (OpenAPI 3.1) refactoring. Uniks metrics expansion. Clusters module.
- Member actions factory, Agents migration from Chatmodes.
- Projects management system with hierarchical structure. AR.js Quiz Nodes.
- Organizations module. Campaigns integration. Storages management.
- useMutation refactor across frontend packages.
- Pattern: systemPatterns.md#universal-list-pattern, systemPatterns.md#pagination-pattern

---

## 2025-10-23 through 2025-11-01: Global Refactoring ✅ (v0.34.0-alpha, v0.35.0-alpha)

- Global monorepo refactoring: package restructuring, tsdown build system, centralized dependencies.
- i18n TypeScript migration. Rate limiting production implementation with Redis.
- Pattern: systemPatterns.md#build-system-patterns, systemPatterns.md#rate-limiting-pattern

---

## 2025-10-02 through 2025-10-16: Metaverses, Canvas, Publications ✅ (v0.31.0-v0.33.0-alpha)

- Publication system fixes, Metaverses module MVP.
- Quiz timer feature. Canvas versioning, telemetry refactoring.
- Role-based permission matrix, publication system with Base58 links.
- MUI Template System implementation.

---

## 2025-09-07 through 2025-09-21: Resources, Testing, Auth ✅ (v0.28.0-v0.30.0-alpha)

- Resources/Entities architecture with tenant isolation and security hardening.
- CI i18n docs consistency checker. Spaces/Canvases publication settings.
- Space Builder provider/model selection. Metaverses frontend/backend.
- TypeScript path aliases standardization. Global publication library.
- Analytics hierarchy, QR code download, testing utilities and coverage.
- Passport.js + Supabase hybrid session architecture migration.

---

## Pre-2025-09: Foundation Work ✅ (v0.21.0-v0.27.0-alpha)

- v0.27.0 (2025-08-31): Finance module, language switcher, i18n integration.
- v0.26.0 (2025-08-24): MMOOMM template extraction, Colyseus multiplayer server.
- v0.25.0 (2025-08-17): Space Builder MVP, Metaverse module, core utils package.
- v0.24.0 (2025-08-12): Space Builder enhancements, AR.js wallpaper mode.
- v0.23.0 (2025-08-05): Russian documentation, UPDL node params, custom modes.
- v0.22.0 (2025-07-27): Memory Bank system, MMOOMM improvements, documentation.
- v0.21.0 (2025-07-20): Handler refactoring, PlayCanvas stabilization, Alpha status.
