# Active Context

> **Last Updated**: 2026-02-19
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: QA Fixes + UI Polish Round 6 — Complete

**Status**: All changes implemented — 66/66 packages built.
**Date**: 2026-02-19

### What Was Done

QA analysis found 1 bug + 3 warnings. User also requested 4 additional improvements.

**QA Fixes:**
1. **BUG-1 + WARN-3**: Publication DELETE cascade — FK `fk_cp_publication` has `ON DELETE CASCADE`, so `remove()` deleted `ConnectorPublication` rows before they could be queried. Fixed by moving linked-app status reset query BEFORE `remove()` and replacing N+1 `findOneBy` loop with single bulk UPDATE using sub-select (same pattern as `notifyLinkedApplicationsUpdateAvailable()`).

2. **WARN-1**: Prettier indentation fix in `ApplicationMigrationGuard.tsx` — `MigrationGuardShell` props shifted from 12 to 16 spaces, closing tags from 8 to 12 spaces.

3. **WARN-2**: 89 prettier errors in `columns.tsx` — full file re-indented from 2-space to project-standard 4-space.

**UI & Backend Improvements:**
4. **Migrations page padding**: Removed extra `px: {xs:1.5, md:2}` from inner Stack — controls now align with page edges like MetahubList/PublicationList.

5. **Baseline template column**: Added `templateVersionLabel` to Zod `baselineMetaSchema` + `buildBaselineMigrationMeta()`. `initSystemTables()` now passes `manifest.version` to baseline record. Frontend shows `"0 → version"` for baseline kind.

6. **Default layout detailsTable**: Added standalone `detailsTable` widget (sortOrder 6, active) BEFORE `columnsContainer` (moved to sortOrder 7, `isActive: false`).

7. **Version reset**: Template version `1.1.0` → `1.0.0` in `basic.template.ts`. Structure version already 1. DB wipe pending.

### Files Modified (7 files in 4 packages)
- `packages/metahubs-backend/base/src/domains/publications/routes/publicationsRoutes.ts` — BUG-1 + WARN-3
- `packages/metahubs-backend/base/src/domains/metahubs/services/metahubMigrationMeta.ts` — baseline meta schema
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts` — baseline recording
- `packages/metahubs-backend/base/src/domains/shared/layoutDefaults.ts` — detailsTable widget
- `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts` — version reset
- `packages/applications-frontend/base/src/components/ApplicationMigrationGuard.tsx` — prettier fix
- `packages/apps-template-mui/src/utils/columns.tsx` — prettier fix
- `packages/metahubs-frontend/base/src/domains/migrations/ui/MetahubMigrations.tsx` — template column + padding

### Next Steps
- User verifies all fixes visually after DB wipe
- Proceed to REFLECT or ARCHIVE mode

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
- Structure V2 rename (_mhb_layout_zone_widgets → _mhb_widgets), V3 (is_active column).
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
