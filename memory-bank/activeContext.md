# Active Context

> **Last Updated**: 2026-02-19
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Enumerations QA Remediation Round 4 Completed

**Status**: Completed in IMPLEMENT mode, safety fixes + regression tests delivered.
**Date**: 2026-02-19

### Applied Fixes
1. Runtime `FormDialog` enum defaults no longer overwrite explicit `null` values during edit flow.
2. Enumeration restore route now maps DB unique violations (`23505`) to deterministic HTTP `409`.
3. Hub-scoped enumeration PATCH now preserves existing description primary locale when `descriptionPrimaryLocale` is omitted.
4. Regression tests expanded:
   - `metahubs-backend`: restore conflict handling + locale fallback checks in `enumerationsRoutes`.
   - `applications-backend`: runtime enum safeguards (`label` readonly + enum ownership validation).

### Verification
- `pnpm --filter @universo/metahubs-backend test -- enumerationsRoutes.test.ts` ✅
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` ✅
- `pnpm --filter @universo/apps-template-mui exec eslint src/components/dialogs/FormDialog.tsx` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/enumerations/routes/enumerationsRoutes.ts src/tests/routes/enumerationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/applications-backend exec eslint src/tests/routes/applicationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅ (after `applications-backend` build due local package type resolution order)

## Current Focus: Enumerations Stabilization Implementation Completed

**Status**: Completed in IMPLEMENT mode, critical blockers removed.
**Date**: 2026-02-19

## Current Focus: Enumerations QA Remediation Round 2 Completed

**Status**: Completed in IMPLEMENT mode after additional QA findings.
**Date**: 2026-02-19

### Applied Fixes
1. Restored single metahub structure baseline:
   - `_mhb_enum_values` included directly in V1 system table registry;
   - set `CURRENT_STRUCTURE_VERSION = 1`;
   - aligned `basic` template `minStructureVersion` to `1`.
2. Fixed Enumerations route consistency:
   - switched API timestamp payload mapping to `_upl_created_at/_upl_updated_at` with fallback;
   - added missing `isSingleHub` validation in both create endpoints.
3. Hardened application sync for stale enum references:
   - before soft-deleting removed enum values, runtime rows are remapped to valid fallback enum value or `null`;
   - required REF fields now fail sync with explicit error when no valid fallback exists.
4. Resolved remaining blocking prettier violations in template seeding services.
5. Added/updated regression checks:
   - new `structureVersions.test.ts` (V2 immutable without enum table, current version includes enum table);
   - migration routes/service tests aligned to `CURRENT_STRUCTURE_VERSION`.

### Verification
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/structureVersions.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/routes/metahubMigrationsRoutes.test.ts` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint <touched-files>` ✅ (warnings only, no errors)

### Applied Fixes
1. Unified enumeration snapshot/runtime contracts to use `presentation` as canonical shape while keeping legacy fallback mapping during sync.
2. Fixed `enumerationsRoutes` runtime/typing blockers:
   - safe handling of `updateEnumeration()` return value in strict mode;
   - wired `attributesService` for enumeration-value delete blockers.
3. Fixed template-seed migration counters drift by adding `enumValuesAdded` to migration meta schema and zero-seed constants.
4. Fixed `MetahubAttributesService.findElementEnumValueBlockers()` query typing (`rows.map` compile blocker removed).
5. Extended optimistic-lock `entityType` contract with `document` in shared utils types.
6. Updated migration/read-only tests to structure version `2` behavior and structured blocker payloads.
7. Resolved Prettier errors in new Enumerations frontend files (`metahubs-frontend`).
8. Reworked `_app_enum_values` sync cleanup to safe soft-delete/restore instead of hard delete to avoid FK/NOT NULL failures during version sync.

### Verification
- `pnpm --filter @universo/utils build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test` ✅ (12/12 suites)
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- Targeted eslint on touched files: no errors (warnings remain in legacy areas) ✅

---

## Current Focus: Enumerations QA Hardening Completed

**Status**: Implemented and verified (targeted lint/tests/build completed).
**Date**: 2026-02-19

### Applied Fixes
1. Prevented `_app_objects` recreate conflicts by running stale metadata cleanup before upsert in `syncSystemMetadata(removeMissing=true)`.
2. Enabled `removeMissing: true` in no-DDL sync branches and migrator metadata sync paths.
3. Hardened application enum sync:
   - stale `_app_enum_values` rows for removed enumeration objects are deleted;
   - duplicate enum value IDs in snapshot now fail fast.
4. Added declarative unique partial index (`uidx_mhb_enum_values_default_active`) for metahub enum defaults.
5. Added `schema-ddl` runtime compatibility fallback for `enumeration` kind and fixed old-snapshot ID reconstruction in diff engine.
6. Added regression tests for:
   - enumeration exclusion from physical DDL diff;
   - cleanup-before-upsert order in metadata sync.

### Verification
- `@universo/schema-ddl`: lint/test/build passed (lint warnings only, no errors).
- `@universo/metahubs-backend`: touched files linted (warnings only, no errors), targeted `systemTableMigrator` test passed.

---

## Current Focus: Enumerations Feature — Frontend/UI Integration Completed

**Status**: Core frontend integration completed, targeted builds/lint checks done.
**Date**: 2026-02-18

### What Was Done

**Metahubs frontend (enumerations domain + routing):**
1. Finalized Enumerations UI flow: list view, values view, delete blockers dialog, mutations, query invalidation.
2. Added metahub/global display state keys for enumerations list preferences.
3. Completed menu + route wiring in both `metahubs-frontend` and `universo-template-mui`:
   - `/metahub/:metahubId/enumerations`
   - `/metahub/:metahubId/enumeration/:enumerationId/values`
   - `/metahub/:metahubId/hub/:hubId/enumerations`
   - `/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId/values`

**Attributes UX for REF -> enumeration:**
4. Extended `TargetEntitySelector` to support `enumeration` target kind with dedicated loading/query keys.
5. Added Presentation tab controls for REF->enumeration:
   - `enumPresentationMode`: `select | radio | label`
   - `defaultEnumValueId` selector loaded from target enumeration values
6. Added UI-side `uiConfig` normalization to prevent invalid enum settings leaking for non-enumeration references.

**Backend validation hardening (`attributesRoutes.ts`):**
7. Extended `uiConfig` schema with `enumPresentationMode` and `defaultEnumValueId`.
8. Added validation that `defaultEnumValueId` belongs to selected target enumeration.
9. Added sanitization/cleanup of enum-specific uiConfig keys when reference target is not enumeration.

**i18n updates (EN/RU):**
10. Added full translation blocks for `enumerations` and `enumerationValues` in metahubs locales.
11. Added new reference keys for enumeration target selection.
12. Added Presentation tab labels/help texts for enum mode/default behavior.
13. Added `menu.enumerations` in shared menu locales and `app.emptyOption` in apps runtime locales.

### Verification
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/template-mui build` ✅
- Targeted eslint on changed TS/TSX files: no errors (warnings only) ✅
- `pnpm --filter @universo/metahubs-backend build` ❌ blocked by pre-existing unrelated TypeScript errors in other backend files

### Next Steps
- Resolve outstanding backend type/export drift (`MetaEntityKind.ENUMERATION` + template seed typing) to restore full backend build.
- Run full workspace build after backend fixes.

---

## Previous Focus: i18n Fix + LanguageSwitcher Widget — Complete

- Fixed BUG-5 (no columnsContainer in seed) and BUG-6 (widget duplication in center+right zones).
- Zone-aware `buildDashboardLayoutConfig()` with `centerActive` set. Seed: columnsContainer (sortOrder 6) in center zone.
- Runtime API expanded to include `center` zone. `DashboardDetailsContext` + `DetailsTableWidget` created.
- MainGrid renders columnsContainer via `renderWidget()` with standalone fallback. Template version `1.1.0` → `1.2.0`.
- 1 file created, 13+ files modified. Build: 65/65 OK.
- Details: progress.md#center-zone-columnscontainer-2026-02-19

---

## Previous Focus: Dashboard Zones & Widgets — 4 Phases + QA ✅ (2026-02-18)

- Phase 1: Split detailsSidePanel → productTree + usersByCountryChart widgets.
- Phase 2: columnsContainer widget (DnD-sortable columns, recursive grid rendering).
- Phase 3: Right Drawer (SideMenuRight 280px, mutual exclusion with left drawer).
- Phase 4: Routing isolation via `createAppRuntimeRoute()` factory.
- 8 QA fixes (BUG-1/2/3/4, WARN-1/2/3/4). Prettier applied. 5 files created, 17+ modified.
- Details: progress.md#dashboard-zones-widgets-2026-02-18

---

## Previous Focus: Architecture Refactoring — Headless Controller Hook ✅ (2026-02-17)

- Adapter Pattern + `useCrudDashboard()` hook eliminates ~80% code duplication.
- `DashboardApp.tsx` 483→95 lines (-80%), `ApplicationRuntime.tsx` 553→130 lines (-76%).
- 7 new files created (types, adapters, columns, hook, dialogs, menu, runtime adapter).
- Details: progress.md#architecture-refactoring-2026-02-17

---

## Previous Focus: UI Polish + QA Rounds 3-6 ✅ (2026-02-15 — 2026-02-17)

- Button position, DataGrid i18n localization, actions column dropdown.
- M1-M4 fixes (null check, error parsing, mutation hooks, schema fingerprint).
- Dialog input styling fix (Dashboard compact → form-compatible spacing).
- Theme dedup, runtime→app rename (60+ identifiers), backward-compat aliases.
- Theme/hooks/delete/i18n/layout fixes, validation/cache/VLC improvements.
- Details: progress.md (entries from 2026-02-15 to 2026-02-17)

---

## Previous Focus: Runtime CRUD + Metahubs UX ✅ (2026-02-13 — 2026-02-14)

- Full backend CRUD (POST/PATCH/DELETE runtime rows) with VLC support.
- Frontend: FormDialog, ConfirmDeleteDialog, actions column in DataGrid.
- Boolean fix (indeterminate checkbox), auto-fill publication name, Presentation tab, header checkbox.
- UI/UX polish (create buttons rename, hubs tab, codename auto-fill, widget toggle).
- Details: progress.md (entries from 2026-02-13 to 2026-02-14)

---

## Previous Focus: Metahub Migration & Template System ✅ (2026-02-09 — 2026-02-12)

- Template system: DB entities, seed executor, Zod validator, frontend selector.
- Declarative DDL + migration engine with diff detection + SystemTableMigrator.
- 16+ QA rounds for pool stability, lock safety, cache consistency, error mapping.
- Structure baseline uses `_mhb_widgets` table and current widget activity model.
- Template cleanup policy (keep/dry_run/confirm), MigrationGuard modal, advisory locks.
- Details: progress.md (entries from 2026-02-09 to 2026-02-12)

---

## Previous Focus: Applications Runtime + Layout Widgets ✅ (2026-02-06 — 2026-02-08)

- Application runtime with DataGrid: row selection, column transformations, BOOLEAN checkbox.
- Menu widget system: embedded items, auto-show catalogs, VLC titles.
- Layout widget DnD ordering, zone widget configuration, runtime menu rendering.
- Details: progress.md (entries from 2026-02-06 to 2026-02-08)

---

## Historical Context (pre-2026-02-06)

- See progress.md for completed work before 2026-02-06.
- Key milestones in reverse chronological order:
  - v0.49.0 (2026-02-05): Attribute data types, display attribute, layouts system, MUI 7
  - v0.48.0 (2026-01-29): Branches, elements rename, three-level system fields
  - v0.47.0 (2026-01-23): Runtime migrations, publications, schema-ddl
  - v0.46.0 (2026-01-16): Applications modules, DDD architecture refactoring
  - v0.45.0 (2026-01-11): i18n localized fields, VLC, catalogs
  - v0.44.0 (2026-01-04): Onboarding, legal consent, captcha, auth toggles
  - v0.43.0 (2025-12-27): Pagination, onboarding wizard
  - v0.42.0 (2025-12-18): VLC system, dynamic locales, Flowise 3.0
  - v0.41.0 (2025-12-11): Admin panel, auth migration, UUID v7
  - v0.40.0 (2025-12-05): Package extraction, admin RBAC, global naming
