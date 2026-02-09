# Tasks
> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

## Active: Layout Defaults + Menu Creation + Schema Diff (2026-02-09)

- [ ] Add second left-zone divider in default layout seeds (layouts + schema services)
- [ ] Reset new menu widget defaults (empty title, auto-show off, no items)
- [ ] Prevent stale diff flash in connector schema sync dialog
- [ ] Validation: pnpm build (full workspace)

## QA Fixes: Menu Widget System (6 Issues) ✅ COMPLETED

### Fix 1: Rewrite MenuWidgetEditorDialog with standard components
- [x] 1.1 Replace raw TextField title fields with LocalizedInlineField (VLC format)
- [x] 1.2 Replace raw TextField in ItemFormDialog with LocalizedInlineField for item title
- [x] 1.3 Update menu title in config to use VLC format (VersionedLocalizedContent)

### Fix 2: Default menu name "Главное"/"Main"
- [x] 2.1 Update makeDefaultConfig() title to VLC format `{ en: 'Main', ru: 'Главное' }`
- [x] 2.2 Update DEFAULT_DASHBOARD_ZONE_WIDGETS in MetahubLayoutsService.ts
- [x] 2.3 Update DEFAULT_DASHBOARD_ZONE_MODULES in MetahubSchemaService.ts

### Fix 3: Add Edit button to editable widget chips
- [x] 3.1 Add EditRoundedIcon + Tooltip to SortableWidgetChip in LayoutDetails.tsx

### Fix 4: Remove "Меню" legacy nav item
- [x] 4.1 Confirmed clean in source — stale build artifact. Fresh build resolved it.

### Fix 5: Runtime shows demo data instead of real catalogs
- [x] 5.1 Remove mainListItems demo array from MenuContent.tsx
- [x] 5.2 Show empty state when no runtime items

### Fix 6: Menu title not showing in runtime
- [x] 6.1 Verify title data flow (backend resolves VLC title → runtime passes to MenuContent)
- [x] 6.2 Fix MenuContent to show title even when items come from menusMap

### Validation
- [x] 7.1 pnpm build (full) — 65/65 passed
- [x] 7.2 Update memory-bank

## QA Fixes: Metahub Menu Cleanup + Menu Editor UX

### Remove legacy metahub menus nav
- [x] 1.1 Drop "menus" item from metahub navigation config
- [x] 1.2 Remove menu breadcrumbs + hooks in template-mui

### Layout editor polish
- [x] 2.1 Add delete tooltip to widget chip remove button

### Menu editor dialog UX alignment
- [x] 3.1 Switch MenuWidgetEditorDialog to EntityFormDialog (no close icon/dividers)
- [x] 3.2 Use create/edit titles and standard "Name" label
- [x] 3.3 Reorder "Show title" toggle below name field + adjust spacing

### Validation
- [x] 4.1 pnpm build (full)
- [x] 4.2 Update memory-bank

## QA Fixes: Menu Editor Alignment + Item Dialog

### Main menu editor alignment
- [x] 1.1 Align toggle controls to left edge and normalize spacing

### Menu item dialog UX
- [x] 2.1 Switch item dialog to EntityFormDialog
- [x] 2.2 Reorder fields: Name first, then settings
- [x] 2.3 Use normal field sizes (no size='small')
- [x] 2.4 Add i18n for "Active" label

### Validation
- [x] 3.1 pnpm build (full)
- [x] 3.2 Update memory-bank

## QA Fixes: Publication Version Dialog

### Align create/edit version dialog actions
- [x] 1.1 Normalize DialogActions padding for version create/edit dialogs

### Validation
- [x] 2.1 pnpm build (full)
- [x] 2.2 Update memory-bank

## Move Menu Functionality Into Layout Widget System ✅ COMPLETED

### Phase 1: Types & Definitions (@universo/types) ✅
- [x] 1.1 Update MenuWidgetConfig with embedded items/title/showTitle/autoShowAllCatalogs
- [x] 1.2 Remove MetahubMenuDefinition, MetahubMenuItemDefinition (move METAHUB_MENU_ITEM_KINDS into MenuWidgetConfig scope)
- [x] 1.3 Build types package

### Phase 2: Backend — Remove Menus Domain ✅
- [x] 2.1 Delete domains/menus/ directory (service + routes)
- [x] 2.2 Remove createMenusRoutes from router.ts and index.ts
- [x] 2.3 Remove menus route registration from start-backend

### Phase 3: Backend — MetahubSchemaService (DDL) ✅
- [x] 3.1 Remove DDL for _mhb_menus / _mhb_menu_items tables
- [x] 3.2 Remove default menu seed data
- [x] 3.3 Update DEFAULT_DASHBOARD_ZONE_MODULES config for menuWidget

### Phase 4: Backend — MetahubLayoutsService ✅
- [x] 4.1 Update DEFAULT_DASHBOARD_ZONE_WIDGETS config for menuWidget
- [x] 4.2 Add updateLayoutZoneWidgetConfig() method
- [x] 4.3 Add PATCH route for widget config update

### Phase 5: Backend — Publication Pipeline ✅
- [x] 5.1 Remove menus reading from publicationsRoutes snapshot
- [x] 5.2 Remove MetahubMenuSnapshot from SnapshotSerializer
- [x] 5.3 Remove normalizeSnapshotMenus + persistPublishedMenus from applicationSyncRoutes
- [x] 5.4 Remove _app_menus / _app_menu_items DDL from SchemaGenerator

### Phase 6: Backend — Runtime API (applications-backend) ✅
- [x] 6.1 Remove _app_menus/_app_menu_items reading, build menus from _app_layout_zone_widgets config

### Phase 7: Frontend — Remove Menus Domain ✅
- [x] 7.1 Delete domains/menus/ directory
- [x] 7.2 Remove MetahubMenus / MetahubMenuDetails exports from index.ts
- [x] 7.3 Remove menus query keys from shared/queryKeys.ts
- [x] 7.4 Remove menus i18n keys, add layouts.menuEditor keys

### Phase 8: Frontend — Navigation & Routes ✅
- [x] 8.1 Remove "Menus" item from metahubDashboard.ts
- [x] 8.2 Remove menus routes from MainRoutesMUI.tsx

### Phase 9: Frontend — MenuWidgetEditorDialog in LayoutDetails ✅
- [x] 9.1 Create MenuWidgetEditorDialog with DnD, item CRUD, config editing
- [x] 9.2 Integrate into LayoutDetails (add/edit menuWidget opens editor)
- [x] 9.3 Add MenuItemFormDialog for individual item editing
- [x] 9.4 Add frontend API function for updateZoneWidgetConfig

### Phase 10: Frontend — Runtime Updates ✅
- [x] 10.1 Update SideMenu resolveMenuForWidget to use widget.id instead of menuCodename
- [x] 10.2 Update ApplicationRuntime to build menusMap keyed by widgetId
- [x] 10.3 Update ApplicationRuntimeMenu/MenuItem types (remove codename/isDefault, add widgetId/title)
- [x] 10.4 Update DashboardMenusMap to be keyed by widget ID

### Phase 11: Validation ✅
- [x] 11.1 Full pnpm build (65/65)
- [x] 11.2 Update memory-bank

## COMPLETED (2026-02-08): Fix Menu Highlight Width + Remove demoMenu Widget

### Task 1: Fix menu item highlight width
- [x] 1.1 Restructure MenuContent.tsx: replace Stack wrappers with flat List layout matching DemoMenuContent
- [x] 1.2 Remove explicit `component='button'` for catalog items (use MUI default)

### Task 2: Remove demoMenu widget from system
- [x] 2.1 Remove `demoMenu` from DASHBOARD_LAYOUT_WIDGETS in @universo/types
- [x] 2.2 Remove `demoMenu` from DEFAULT_DASHBOARD_ZONE_WIDGETS in MetahubLayoutsService.ts
- [x] 2.3 Remove `demoMenu` from DEFAULT_DASHBOARD_ZONE_MODULES in MetahubSchemaService.ts
- [x] 2.4 Remove `demoMenu` case from SideMenu.tsx renderWidget() + remove import
- [x] 2.5 Delete DemoMenuContent.tsx file
- [x] 2.6 Remove `demoMenu` i18n labels from en/ru
- [x] 2.7 Build validation — 65/65 successful

## COMPLETED (2026-02-08): Fix QA Issues #1-3 (menuWidget runtime, menu picker UI, cascade delete)

### Problem #1: menuWidget ignores config.menuCodename at runtime
- [x] 1.1 Dashboard.tsx: Add `DashboardMenusMap` type + `menus` prop
- [x] 1.2 SideMenu.tsx: Add `resolveMenuForWidget()` with 3-level fallback (codename → first in map → legacy prop)
- [x] 1.3 SideMenuMobile.tsx: Add `menus` prop, resolve first/fallback menu for mobile
- [x] 1.4 AppNavbar.tsx: Forward `menus` prop to SideMenuMobile
- [x] 1.5 index.ts: Export `DashboardMenusMap` from package
- [x] 1.6 ApplicationRuntime.tsx: Build `menusMap` from ALL runtime menus, pass `menus` + `menu` (backward compat)

### Problem #2: No UI to select menu when adding menuWidget in DnD editor
- [x] 2.1 LayoutDetails.tsx: Add menus query + MenuPickerDialog state
- [x] 2.2 LayoutDetails.tsx: Intercept menuWidget in add-widget Menu → open picker dialog
- [x] 2.3 LayoutDetails.tsx: Widget chip label shows menu name for menuWidget
- [x] 2.4 i18n en/ru: `layouts.menuPicker.title/empty/defaultMenu` keys

### Problem #3: Soft-delete layout doesn't cascade to zone widgets
- [x] 3.1 MetahubLayoutsService.deleteLayout(): Transaction-wrapped cascade soft-delete of zone widgets
- [x] 3.2 publicationsRoutes.ts: Snapshot filters zone widgets by active layout IDs

### Validation
- [x] Full build: pnpm build — 65/65 successful, 0 errors

## COMPLETED (2026-02-08): Decompose sideMenu into Widgets + Rename module → widget

### Phase 1: Types & Definitions (`@universo/types`)
- [x] 1.1 Replace DASHBOARD_LAYOUT_MODULES with DASHBOARD_LAYOUT_WIDGETS (21 widgets, 7 new left-zone)
- [x] 1.2 Add multiInstance flag to widget definitions
- [x] 1.3 Add MenuWidgetConfig type for menuWidget config
- [x] 1.4 Rename DashboardLayoutModuleKey → DashboardLayoutWidgetKey with deprecated aliases
- [x] 1.5 Build verified

### Phase 2: DB Schema (schema-ddl + metahubs-backend)
- [x] 2.1 Rename _mhb_layout_zone_modules → _mhb_layout_zone_widgets (column module_key → widget_key)
- [x] 2.2 Rename _app_layout_zone_modules → _app_layout_zone_widgets (column module_key → widget_key)
- [x] 2.3 Remove unique indexes on both tables for multi-instance support

### Phase 3: Backend — MetahubLayoutsService
- [x] 3.1 Full rewrite: UUID-based CRUD, multi-instance logic, sync layoutConfig from zone widgets
- [x] 3.2 Deprecated method aliases for backward compat

### Phase 4: Backend — layoutsRoutes.ts
- [x] 4.1 Routes: zone-modules → zone-widgets, zone-module → zone-widget, :moduleKey → :widgetId
- [x] 4.2 Catalog returns multiInstance field

### Phase 5: Publication & Sync pipeline
- [x] 5.1 SnapshotSerializer: layoutZoneModules → layoutZoneWidgets
- [x] 5.2 publicationsRoutes: reads _mhb_layout_zone_widgets
- [x] 5.3 applicationSyncRoutes: all functions renamed, reads _app_layout_zone_widgets

### Phase 6: Runtime API (applications-backend)
- [x] 6.1 Added zoneWidgets reading from _app_layout_zone_widgets
- [x] 6.2 Returns zoneWidgets: { left: [...] } in JSON response

### Phase 7: Frontend — apps-template-mui
- [x] 7.1 Dashboard.tsx: ZoneWidgetItem, ZoneWidgets interfaces, passes to SideMenu
- [x] 7.2 SideMenu.tsx: widget-based rendering with renderWidget() + legacy fallback
- [x] 7.3 Created DemoMenuContent.tsx
- [x] 7.4 api.ts: zoneWidgets zod schema in runtime response
- [x] 7.5 RuntimeDashboardApp.tsx: passes zoneWidgets
- [x] 7.6 index.ts: exports new types

### Phase 8: Frontend — applications-frontend
- [x] 8.1 types.ts: added zoneWidgets to ApplicationRuntimeResponse
- [x] 8.2 ApplicationRuntime.tsx: passes zoneWidgets to AppsDashboard

### Phase 9: Frontend — metahubs-frontend (DnD editor)
- [x] 9.1 types.ts: MetahubLayoutZoneWidget, DashboardLayoutWidgetCatalogItem + deprecated aliases
- [x] 9.2 queryKeys.ts: layoutZoneWidgets, layoutZoneWidgetsCatalog
- [x] 9.3 layouts.ts API: all methods renamed, URLs updated, widgetId-based move/remove
- [x] 9.4 LayoutDetails.tsx: DnD by UUID, multi-instance filter, widgetKey throughout
- [x] 9.5 i18n en/ru: widgets section with 21 widget labels

### Phase 10: Validation & Build
- [x] 10.1 Full build pnpm build — 65/65 successful, 0 errors
- [x] 10.2 Updated memory-bank

## COMPLETED (2026-02-08): Fix Runtime Menu Rendering in ApplicationRuntime

- [x] Export `DashboardMenuSlot` and `DashboardMenuItem` types from `@universo/apps-template-mui` index.
- [x] Add `ApplicationRuntimeMenu` and `ApplicationRuntimeMenuItem` interfaces to `@universo/applications-frontend` types.
- [x] Extend `ApplicationRuntimeResponse` with `menus`, `activeMenuId`, `catalogs`, `activeCatalogId` fields.
- [x] Add `catalogId` parameter to `runtimeTable` query key factory and `getApplicationRuntime` API function.
- [x] Port menu rendering logic from standalone `RuntimeDashboardApp.tsx` to production `ApplicationRuntime.tsx` page.
- [x] Export new types from `@universo/applications-frontend` public index.
- [x] Run targeted builds (`apps-template-mui`, `applications-frontend`) and full workspace build (`pnpm build`, 65/65 tasks).
- [x] Update memory-bank with implementation results.

## COMPLETED (2026-02-07): Metahub Layout Zones + Menus + Runtime Integration

- [x] Introduce shared contracts for layout zones/menu entities in `@universo/types` with UUID v7-safe identifiers.
- [x] Extend metahub schema initialization with menu tables and layout zone module tables (indexes, sort order, safety constraints).
- [x] Implement metahubs backend API for menus (CRUD + reorder + up/down actions) and layout zone module assignments with allowed-zone validation.
- [x] Extend publication snapshot/hash/sync pipeline to include menus and layout zone assignments.
- [x] Extend applications runtime API to provide menu payload and support multi-catalog navigation metadata.
- [x] Add Metahubs frontend "Menus" domain (list/cards/table/forms/actions) reusing layout UX patterns and i18n-first strings.
- [x] Upgrade layout details UI to zone-based module editor with drag-and-drop reordering and safe drop constraints.
- [x] Add shell navigation route for "Menus" under "Layouts" in metahub context.
- [x] Integrate runtime dashboard menu rendering in `apps-template-mui` replacing current demo left menu only (keep lower demo menu untouched).
- [x] Run targeted lint/build/tests for touched packages and resolve newly introduced violations.
- [x] Run full workspace build (`pnpm build`) after integration changes.
- [x] Update memory-bank (`activeContext.md`, `progress.md`, `tasks.md`) with implementation results.

## COMPLETED (2026-02-07): PR #666 Review Feedback Hardening

- [x] Validate bot review comments from PR #666 against current code and classify actionable items.
- [x] Apply safe fixes for confirmed issues (layout config query efficiency, localized fallback handling, i18n fallback labels, unused imports).
- [x] Run targeted lint/build validation for touched packages.
- [x] Update memory-bank status files with implementation outcomes.

## COMPLETED (2026-02-07): Catalog Blocking Delete Stabilization

- [x] Fix backend blocking references query for catalog delete (`[object Object]` SQL alias issue with Knex + `withSchema`).
- [x] Unify catalog delete flow in frontend mini-menu to always use blocking-aware delete dialog logic.
- [x] Run targeted validation for touched code paths (tests/build where feasible) and record outcomes in memory-bank.

## COMPLETED (2026-02-07): Post-QA Stabilization for Copy/Delete Flows

- [x] Fix `@universo/schema-ddl` `SchemaCloner` placeholder handling to support both Knex raw execution and TypeORM `manager.query` execution without binding mismatches.
- [x] Add focused `schema-ddl` tests for schema clone query binding behavior (prevent regression of `Expected ... bindings` runtime errors).
- [x] Remove divider between `Edit` and `Copy` actions in Applications mini-menu while preserving existing delete separator behavior.
- [x] Harden `copyAccess` behavior to copy only active (non-soft-deleted) membership records for Applications and Metahubs.
- [x] Run targeted validation (tests/build) for changed packages and update memory-bank status files (`activeContext.md`, `progress.md`, `tasks.md`).

## COMPLETED (2026-02-07): Metahub/Application Copy + Safe Metahub Delete

- [x] Fix Metahub delete flow to drop dynamic schemas before metadata removal (transaction-safe, identifier-safe)
- [x] Add shared schema clone service in `@universo/schema-ddl` for safe full-schema cloning
- [x] Extend Metahub branch cloning to copy all runtime tables (including `_mhb_settings` and `_mhb_layouts`) via shared clone service
- [x] Implement backend endpoint to copy Metahub with options:
  - [x] `copyDefaultBranchOnly` (default `true`)
  - [x] `copyAccess` (default `false`)
  - [x] ensure requester becomes only `owner` (no duplicate role rows)
- [x] Implement backend endpoint to copy Application with options:
  - [x] `copyAccess` (default `false`)
  - [x] copy connectors/publication links
  - [x] copy dynamic `app_*` schema when present
  - [x] ensure requester becomes only `owner` (no duplicate role rows)
- [x] Add frontend `Copy` action for Metahubs and Applications in mini-menu under `Edit`
- [x] Add copy dialogs (based on create/edit form) with defaults:
  - [x] localized title ("Copying")
  - [x] localized name suffix ` (copy)` / ` (копия)` per locale variant
  - [x] copy options checkboxes
- [x] Add backend/frontend API client methods and mutation hooks for copy operations with correct TanStack Query invalidation
- [x] Add i18n keys for copy dialogs, options, and success/error messages (en/ru)
- [x] Add/update targeted tests for new copy endpoints and delete-schema safety behavior
- [x] Run targeted lint/tests/build for touched packages and fix violations
- [x] Update memory-bank progress after implementation

## COMPLETED (2026-02-06): Layout Storage Alignment + Safe Layout Edit

- [x] Prevent layout config reset on layout rename/edit in Metahubs frontend (`includeConfig=false` for update payload)
- [x] Invalidate layout breadcrumb query after update to refresh renamed layout titles immediately
- [x] Add `_app_layouts` as dedicated runtime layouts storage in dynamic application schema
- [x] Keep `_app_settings` creation untouched (reserved for future app settings)
- [x] Move sync persistence/comparison logic from `_app_settings` keys to normalized `_app_layouts` rows
- [x] Keep diff markers (`ui.layout.update`, `ui.layouts.update`) and sync summary contract stable
- [x] Switch runtime API layout source to `_app_layouts` (default/active), with fallback to legacy `_app_settings` key for compatibility
- [x] Run targeted lint/build verification for touched packages and files

---

## COMPLETED (2026-02-04): UI Layout Sync + Dashboard Grid Fixes (MUI 7) + Auth Form Layout

- [x] Ensure Metahub Layout config changes are propagated to existing Applications during connector sync (UI-only diff marker + persist `_app_ui_settings` even with no DDL changes)
- [x] Return explicit sync status when only UI settings change (`ui_updated`) to avoid "no changes" confusion
- [x] Localize UI-only diff marker in connectors diff dialog (`ui.layout.update` -> i18n label)
- [x] Fix Metahub "Layout" page: remove extra divider lines and ensure all labels are i18n-ready (ru/en)
- [x] Normalize all `*Board` dashboards to MUI 7 Grid v2 API (`size`, Overview title placement) and restore template-like StatCard heights (remove `description` usage)
- [x] Fix AuthView form layout regression (restore vertical stacking + consistent button layout)
- [x] Run targeted builds (frontend/backends) + `@flowise/core-frontend` production build

---

## COMPLETED (2026-02-04): Applications Menu Delete + Drop Application Schema

- [x] Restore "Delete" action in Applications list item menu (single divider after Control Panel)
- [x] Drop application PostgreSQL schema on application delete to avoid orphan schemas
- [x] Run targeted build/tests for backend/frontend changes

---

## COMPLETED (2026-02-04): Runtime Routing Follow-up Hardening

- [x] Remove remaining frontend legacy app admin links in `flowise-template-mui` sidebar menu (`/application/...` -> `/a/:applicationId/admin/...`)
- [x] Fix `ApplicationGuard` wiring typo (`resourceIdParam`) and update unit test
- [x] Align `apps-template-mui` minimal runtime scaffold to use Dashboard `CustomizedDataGrid` without demo data
- [x] Apply Dashboard-like DataGrid behavior on runtime page (`/a/:applicationId`) for consistent UX
- [x] Run targeted checks (`applications-frontend` build + `ApplicationGuard` unit test + `flowise-template-mui` lint baseline)

---

## COMPLETED (2026-02-04): Runtime Table Data Normalization (MVP)

- [x] Normalize runtime `STRING` field values on backend (`JSONB VLC` -> locale string)
- [x] Keep runtime attribute order stable by creation order in `_app_attributes`
- [x] Show explicit boolean checkboxes in runtime table cells for `BOOLEAN` attributes
- [x] Improve pagination UX via TanStack Query `keepPreviousData`
- [x] Run targeted backend/frontend builds after runtime normalization changes

---

## COMPLETED (2026-02-04): Applications Runtime UI + New `/a/:applicationId` Routing

- [x] Harden backend authorization for application-scoped operations
- [x] Remove legacy frontend route links (`/application/...`) and migrate to `/a/:applicationId/admin/...`
- [x] Add application runtime API endpoint for single-catalog table rendering
- [x] Implement minimal runtime page (`/a/:applicationId`) with DataGrid and dynamic columns/rows
- [x] Add role-gated "Control Panel" action in Applications list item menu
- [x] Keep `/a/:applicationId` accessible for all application members, `/a/:applicationId/admin` for owner/admin/editor
- [x] Copy `.backup/templates` into new `packages/apps-template-mui` package
- [x] Update tests/fixtures impacted by new routing scheme
- [x] Run targeted lint/build checks and fix issues
- [x] Update memory-bank active context and progress after implementation

---

## COMPLETED (2026-02-03): Double Rate Limits for Normal Workflow

- [x] Increase rate limits to 600 read / 240 write across backend packages
- [x] Update memory bank entries (activeContext.md, progress.md)

---

## COMPLETED (2026-02-03): Supabase Connection Pool Optimization

### Problem
HTTP 429 (Too Many Requests) errors during normal workflow due to:
- Pool exhaustion: TypeORM (7) + Knex (8) = 15 = Supabase Nano limit (no headroom)
- Aggressive rate limiting: 100 read / 60 write per 15 min
- No pool observability for debugging

### Solution
- [x] Add pool diagnostics and monitoring to TypeORM DataSource
- [x] Add pool diagnostics and monitoring to KnexClient
- [x] Reduce pool sizes: TypeORM 7→5, Knex 8→5 (total 10, leaving 5 for Supabase)
- [x] Increase rate limits: 300 read / 120 write per 15 min (across 8 backend packages)
- [x] Add `DATABASE_POOL_MAX` and `DATABASE_KNEX_POOL_MAX` env vars for configuration
- [x] Update .env.example with pool configuration documentation
- [x] Update techContext.md with new pool architecture
- [x] Build verification (64 packages passed)

### Files Changed
- `packages/flowise-core-backend/base/src/DataSource.ts` - Pool monitoring, size reduction
- `packages/metahubs-backend/base/src/domains/ddl/KnexClient.ts` - Pool monitoring, size reduction
- `packages/metahubs-backend/base/src/domains/router.ts` - Rate limit increase
- 7 other `*-backend/base/src/routes/index.ts` - Rate limit increase
- `packages/flowise-core-backend/base/.env.example` - Pool config docs

---

## COMPLETED (2026-02-03): Display Attribute UX Fixes (Round 2)

### Bug Fixes
- [x] **BUG**: isDisplayAttribute not saved when editing attribute (backend PATCH ignores field)
    - Note: Added `isDisplayAttribute` handling in PATCH route via setDisplayAttribute/clearDisplayAttribute
- [x] **BUG**: isDisplayAttribute not saved when CREATING attribute (missing from destructuring and create call)
    - Note: Added `isDisplayAttribute` to parsed.data extraction and service.create() call + setDisplayAttribute() for exclusivity
- [x] Fix menu items logic: show only relevant actions (not both make required/optional pairs)
    - Note: Changed `enabled` to `visible` for conditional hiding of menu items
- [x] Remove "Clear display attribute" action completely (user must set another attribute instead)
    - Note: Removed the action entirely; users can only set, not clear

### UI Improvements
- [x] Add star icon before display attribute name in table
    - Note: Added StarIcon with tooltip in name column
- [x] Fix default sort order (by ID ascending, not updated date)
    - Note: Changed secondary sort from `DESC` to `ASC` in MetahubAttributesService

### Completed Previously
- [x] Auto-enable and lock display attribute when catalog has only one attribute
- [x] Set default NUMBER scale to 0
- [x] Fix action menu crash when context is undefined

## COMPLETED (2026-02-03): Display Attribute (Представление каталога)

Implemented "Display Attribute" feature (similar to 1C:Enterprise 8.x "Представление") that allows marking one attribute per catalog as the representation field used when elements are referenced from other catalogs.

### Phase 0: Database Schema
- [x] Add `is_display_attribute` BOOLEAN column to `_mhb_attributes` (MetahubSchemaService)
- [x] Add `is_display_attribute` column to `_app_attributes` (SchemaGenerator)
- [x] Update MetahubBranchesService clone SQL

### Phase 1-2: Type Definitions
- [x] Add `isDisplayAttribute` to `MetaFieldDefinition` (@universo/types)
- [x] Add `isDisplayAttribute` to `SchemaFieldSnapshot` (schema-ddl)

### Phase 3-4: Backend Services & API
- [x] Update MetahubAttributesService (create/update/mapRow + setDisplayAttribute/clearDisplayAttribute)
- [x] Add 3 new API endpoints: toggle-required, set-display, clear-display
- [x] Update Zod validation schemas

### Phase 5-6: Snapshot & Migration
- [x] Update SnapshotSerializer (serializeMetahub + normalizeSnapshotForHash)
- [x] Update applicationMigrationsRoutes for snapshot conversion

### Phase 7-10: Frontend
- [x] Add API functions (toggle/set/clear display attribute)
- [x] Add mutation hooks (useToggleAttributeRequired, useSetDisplayAttribute, useClearDisplayAttribute)
- [x] Add isDisplayAttribute to form (AttributeFormFields, AttributeList, AttributeActions)
- [x] Add action menu buttons (toggle required, set/clear display attribute)
- [x] Add isDisplayAttribute to Attribute/AttributeDisplay interfaces

### Phase 11: i18n
- [x] Add EN translations for new actions and labels
- [x] Add RU translations for new actions and labels

### Phase 12: Display Logic
- [x] Update `toHubElementDisplay()` to prefer display attribute over first STRING

### Phase 13: Build Verification
- [x] Full workspace build passed (64 packages)

---

## COMPLETED (2026-02-03): Attribute Edit Settings Parity + Validation Rules Fix

- [x] Align edit "Type Settings" UI with create dialog (shared component, data type locked)
- [x] Enable editing of NUMBER settings in edit dialog (precision, scale, min/max, nonNegative)
- [x] Persist NUMBER/DATE validation rules in backend (validation schema + update payload)
- [x] Build verification (metahubs-frontend, metahubs-backend)

## COMPLETED (2026-02-03): REF Dropdown Styling + Reference Display in Tables

- [x] Normalize REF dropdown indicators (no button-like icon) in attribute and element forms
- [x] Show referenced element display name (first STRING attribute, localized) in elements table instead of UUID
- [x] Build verification (full workspace)

## COMPLETED (2026-02-02): Fix Attribute Edit Dialog - Show All Types & Settings

**Problem**: When editing attributes, the "Data Type" dropdown showed empty for non-STRING types (only STRING option existed) and "Type Settings" section was missing entirely.

### Implementation (MVP - Read-Only Settings)
- [x] Update AttributeEditFields to show all 6 data types in Select (disabled - type cannot be changed after creation)
- [x] Add physical PostgreSQL type Alert info box
- [x] Add Accordion with read-only type settings per data type (STRING, NUMBER, DATE, REF)
- [x] Update buildInitialValues to load validationRules, targetEntityId, targetEntityKind from attribute
- [x] Add backend validation in attributesRoutes.ts to reject dataType changes (DATA_TYPE_CHANGE_FORBIDDEN)
- [x] Add backend validation to reject VLC setting changes for STRING type (VLC_CHANGE_FORBIDDEN)
- [x] Add i18n keys for edit restrictions (EN/RU): `attributes.edit.typeChangeDisabled`, `attributes.edit.settingsReadOnly`
- [x] Build verification (metahubs-frontend, metahubs-backend)

**Design Decision**: MVP approach prevents destructive changes while allowing safe edits (name, codename, isRequired). Full attribute type/settings migration would require schema restructuring (similar to 1C:Enterprise) which is out of scope for MVP.

---

## COMPLETED (2026-02-02): Polymorphic REF System for Multiple Entity Types

Implementing polymorphic reference system to support REF fields linking to multiple entity types (Catalog, Document, Register, etc.).

### Phase 0: Database Schema Updates
- [x] Change `_mhb_attributes.target_object_id` from STRING to UUID in MetahubSchemaService
- [x] Add `target_object_kind` column (VARCHAR(20)) to `_mhb_attributes`
- [x] Update `_app_attributes` in SchemaGenerator with `target_object_kind`
- [x] Update MetahubBranchesService clone SQL for target_object_kind
- [x] Update catalogs.ts to include targetEntityKind

### Phase 1: Type Definitions (@universo/types)
- [x] Add `targetEntityKind` to MetaFieldDefinition interface
- [x] Add META_ENTITY_KINDS array for Zod validation
- [x] Ensure MetaEntityKind enum is extensible for future types

### Phase 2: Backend Updates
- [x] Update MetahubAttributesService (create/update/mapRow)
- [x] Update attributesRoutes.ts Zod schemas with targetEntityKind
- [x] Add validation for REF type requiring both targetEntityId and targetEntityKind
- [x] Fix validationRules schema to accept nullable fields (minLength, maxLength, etc.)

### Phase 3: Schema Migration System
- [x] Update SnapshotSerializer (snapshot.ts) to include targetEntityKind
- [x] Update schema-ddl types.ts SchemaFieldSnapshot
- [x] Update SchemaGenerator syncSystemMetadata
- [x] Update diff.ts to compare targetEntityKind
- [x] Add MODIFY_FIELD to ChangeType enum for field metadata changes
- [x] Include targetEntityKind in publication snapshot normalization
- [x] Include targetEntityKind in application migration snapshot conversion

### Phase 4: UI Components
- [x] Create TargetEntitySelector component (self-contained with useQuery for catalogs)
- [x] Integrate into AttributeList.tsx for REF type settings
- [x] Add validation for REF type in form
- [x] Add ref i18n consolidation in metahubs i18n registry
- [x] Fix TargetEntitySelector i18n + styling (icons, size, dropdown background)

### Phase 4b: Element Reference Input
- [x] Add REF element selector (list elements of target catalog)
- [x] Extend DynamicEntityFormDialog with custom field renderer
- [x] Update Attribute types to include targetEntityId/Kind
- [x] Fix ReferenceFieldAutocomplete height styling (remove size="small", add fullWidth)

### Phase 5: Internationalization
- [x] Add EN keys for REF field UI (validation, ref section)
- [x] Add RU keys for REF field UI (validation, ref section)

### Phase 5b: Reference Element i18n
- [x] Add EN/RU keys for reference element selection

### Phase 6: Build Verification
- [x] Full project build (64/64 tasks successful)
- [x] Partial build verification for bug fixes (19/19 tasks successful)

---

## COMPLETED (2026-01-31): PR #660 Bot Recommendations QA

QA analysis of bot comments (Gemini Code Assist, GitHub Copilot) on PR #660.

**Issues Fixed:**
- [x] Fix scale validation in numberValidation.ts - return error instead of silent clamp when scale >= precision
- [x] Fix countIntegerDigits() for 0 < |value| < 1 - return 1 (for leading "0") matching docstring and PostgreSQL behavior
- [x] Add risk comments for TypeORM/Knex internal pool access (fragile but accepted for observability)
- [x] Fix attributesRoutes.ts scale validation - validate against effective precision (default 10) even when precision not provided
- [x] Remove noisy afterCreate pool connection log (reduces production log noise)
- [x] Fix handleNumberBlur for optional NUMBER fields - only force 0 for required fields, keep null for optional
- [x] Add i18n for backend type helperText in AttributeList.tsx (JSONB, TEXT, VARCHAR)
- [x] Fix decimalSeparator locale handling - use ',' for Russian, '.' for others
- [x] Full build verification (64 tasks, 5m20s)

**Issues Not Fixed (by design):**
- memory-bank file compression (tasks.md, progress.md) - requires separate MB compression run, not code fix

## COMPLETED (2026-01-31): Pool Error Logging

- [x] Reduce KnexClient pool max to 8 (Supabase pool budget)
- [x] Reduce TypeORM pool max to 7 (Supabase pool budget)
- [x] Add Knex pool error logging with pool state metrics
- [x] Add TypeORM pool error logging with pool state metrics
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): Fix VLC Error Display Location

**Problem**: minLength validation error showed under the WRONG field (primary/first locale field) even when the error was in a different locale.

**Solution**: Added `errorLocale` prop to track which locale has the error and display error text under that specific locale's field.

- [x] Add `errorLocale?: string | null` prop to LocalizedInlineField BaseProps
- [x] Update DynamicEntityFormDialog to compute and pass `errorLocale` from `getVlcMinLengthError()`
- [x] Update LocalizedInlineFieldContent to show error under the correct locale field (where `locale === errorLocale`)
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): VLC minLength Validation for All Locales

- [x] Add getVlcMinLengthError() helper function to validate minLength for ALL VLC locales
- [x] Update getFieldError() to use VLC validation for STRING fields with localized content
- [x] Add per-locale error display in LocalizedInlineFieldContent (hasMinLengthError check)
- [x] Show "min: X" in field helper text when locale fails minLength validation
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): VLC String Field UX Fixes

- [x] Add 'versioned' mode to LocalizedInlineField (no language switching for versioned-only fields)
- [x] Add maxLength/minLength props to LocalizedInlineField BaseProps
- [x] Create VersionedInlineField component (single locale, no language tabs)
- [x] Update SimpleInlineField with maxLength blocking and constraintText
- [x] Update LocalizedInlineFieldContent with maxLength blocking and constraintText
- [x] Update DynamicEntityFormDialog to use correct mode (versioned vs localized)
- [x] Pass maxLength/minLength from validationRules to LocalizedInlineField
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): QA Fix - Precision/Scale Limits

- [x] Reduce maxPrecision from 38 to 15 (JavaScript number precision limit)
- [x] Change scale validation to strict inequality (scale < precision, at least 1 integer digit required)
- [x] Update @universo/utils/numberValidation.ts - NUMBER_DEFAULTS.maxPrecision: 15
- [x] Update @universo/types/metahubs.ts - getPhysicalDataType limits
- [x] Update attributesRoutes.ts - Zod schema precision max: 15, scale max: 14
- [x] Update AttributeList.tsx - UI limits precision: 1-15, scale: 0-(precision-1)
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): NUMBER Input UX Improvement

- [x] Research MUI TextField number formatting best practices (react-number-format, NumericFormat)
- [x] Implement controlled text input with digit restrictions (maxIntegerDigits, scale)
- [x] Block invalid characters via onKeyDown handler
- [x] Format value with fixed decimal places (e.g., "0.00" for scale=2)
- [x] Show constraints hint below field (Range/Min/Max, Non-negative)
- [x] Display precision format (e.g., "8,2") in helper text
- [x] Remove precision/scale validation errors (enforced by input restrictions instead)
- [x] Auto-select integer/decimal parts for overwrite editing
- [x] Prevent deleting decimal separator; overwrite decimal digits in-place
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-31): NUMBER Precision/Scale Validation

- [x] Create validateNumber() utility in @universo/utils with precision/scale checks
- [x] Add validateNumberOrThrow() for sync operations that throw on overflow
- [x] Update MetahubElementsService.validateRules() with precision/scale validation
- [x] Update applicationSyncRoutes.ts to throw on overflow instead of setting null
- [x] Full build verification (64 tasks successful)

## COMPLETED (2026-01-30): QA Fixes Round 3

- [x] Add numeric overflow handling in seedPredefinedElements for NUMERIC precision/scale
- [x] Add warnings/logs for numeric overflow during sync
- [x] Full build and verification (64 tasks successful)

## COMPLETED (2026-01-30): QA Fixes Round 2

- [x] Fix MuiAlert severity colors (removed custom info palette from colorSchemes)
- [x] Fix number input minus sign for non-nonNegative fields (check currentValue.length > 0)
- [x] Fix JSON sync error for VLC fields in seedPredefinedElements (JSON.stringify primitives for JSONB)
- [x] Full build and verification (64 tasks successful)

## COMPLETED (2026-01-30): QA Fixes for Physical Type Display

- [x] Fix MuiAlert severity-based colors (removed hardcoded orange, now uses MUI severity colors)
- [x] Consolidate type mapping logic (SchemaGenerator.mapDataType now uses getPhysicalDataType from @universo/types)
- [x] Refactor IIFE anti-pattern in AttributeList JSX to useMemo
- [x] Fix number input allowing double minus and minus for nonNegative fields (added onKeyDown handler)
- [x] Remove redundant VLC info Alert (now shown in PostgreSQL type Alert)
- [x] Full workspace build verification - 64 tasks successful

## COMPLETED (2026-01-30): Physical PostgreSQL Type Display in Attribute UI

- [x] Add getPhysicalDataType() and formatPhysicalType() helpers to @universo/types
- [x] Add PhysicalTypeInfo interface for type information
- [x] Add Tooltip to AttributeList table showing PostgreSQL type on hover
- [x] Add info Alert in AttributeForm showing computed PostgreSQL type
- [x] Add physicalType i18n keys (EN/RU)
- [x] Re-export new functions from metahubs-frontend types.ts
- [x] Full build verification - all packages build successfully
- [x] Update memory bank entries

## COMPLETED (2026-01-30): DATE Input Year Digits Fix (Round 3)

- [x] Research HTML5 date input 5+ digit year issue
- [x] Implement normalizeDateValue helper function to truncate year to 4 digits
- [x] Add max attribute for date/datetime-local inputs (9999-12-31 / 9999-12-31T23:59)
- [x] Update DATE case in renderField with normalization and max constraint
- [x] Build @universo/template-mui successfully
- [x] Update memory bank entries

## COMPLETED (2026-01-30): Validation UX Round 2

- [x] Return maxLength restriction for STRING (prevent typing beyond max)
- [x] Fix Save button disabled state (was missing disabled prop)
- [x] Fix DATE/DATETIME inputs (remove custom normalization, use native browser handling)
- [x] Build @universo/template-mui successfully
- [x] Update memory bank entries

## COMPLETED (2026-01-30): Validation UX Follow-up

- [x] Allow max-length errors to surface (remove HTML maxLength lock)
- [x] Add helper text for number range constraints
- [x] Improve date/time input normalization to avoid clearing
- [x] Update numeric precision label to "Length" (EN/RU)
- [x] Run targeted builds (template-mui, metahubs-frontend)
- [x] Update memory bank entries (activeContext/progress)

## COMPLETED (2026-01-30): QA Fix - Attribute Validation Rules in Element Form

- [x] Phase 1: Update @universo/types - move versioned/localized from JSON to STRING settings
- [x] Phase 2: Update @universo/schema-ddl - STRING with VLC → JSONB mapping
- [x] Phase 3: Update metahubs-backend Zod schema comments (VLC under STRING)
- [x] Phase 4: Update AttributeList UI - VLC settings in STRING, [V][L] badges in table
- [x] Phase 5: Extend DynamicFieldConfig - add DynamicFieldValidationRules interface
- [x] Phase 6: Update ElementList - pass validationRules from attributes to dynamic fields
- [x] Phase 7: Update i18n (EN/RU) - move VLC keys from json to string section
- [x] Phase 8: Full build verification - all packages build successfully

## COMPLETED (2026-01-30): Enhanced Attribute Types with Type-Specific Settings

- [x] Phase 1: Update @universo/types - remove DATETIME, add type config interfaces (StringTypeConfig, NumberTypeConfig, DateTypeConfig, JsonTypeConfig, AttributeValidationRules)
- [x] Phase 2: Update @universo/schema-ddl - mapDataType() now accepts optional config for VARCHAR(n), NUMERIC(p,s), DATE/TIME/TIMESTAMPTZ
- [x] Phase 3: Update metahubs-backend - extend Zod schemas with type settings, update migration (remove DATETIME from enum), update ElementsService validation
- [x] Phase 4: Update metahubs-frontend - add collapsible "Type Settings" panel with conditional fields for STRING/NUMBER/DATE/JSON
- [x] Phase 5: Update i18n (EN/RU) - remove datetime key, add typeSettings keys
- [x] Phase 6: Update SchemaGenerator tests - new tests for mapDataType with config parameter
- [x] Phase 7: Full build verification - all packages build successfully

## BUG FIX (2026-01-29): Optimistic Locking Returns 500 Instead of 409

- [x] Identify root cause: `instanceof OptimisticLockError` fails across module bundles
- [x] Add `isOptimisticLockError()` duck typing helper to error middleware
- [x] Handle OptimisticLockError in router-level error handler (flowise-core-backend routes)
- [x] Rebuild @flowise/core-backend after error handler changes
- [x] Add updatedByEmail lookup in router-level conflict response
- [x] Rebuild @flowise/core-backend after updatedByEmail fix
- [x] User tests: edit metahub, change _upl_version in DB, save → expect 409 + ConflictResolutionDialog
- [x] Fix metahub conflict metadata to use stored updatedBy/updatedAt
- [x] Set updatedBy for branch updates
- [x] Set updatedBy for publication updates (resolve user)
- [x] Add VersionColumn to typeorm jest mocks (metahubs/applications backends)
- [x] Re-run backend tests for metahubs/applications
    - Note: Tests still failing in metahubs-backend and applications-backend due to outdated expectations/mocks (see progress.md#2026-01-29).

## IMPLEMENT (2026-01-29): Optimistic Locking Pattern Unification

> See full plan: `memory-bank/plans/optimistic-locking-implementation.md`

### Phase 1: Extend Error Handler Middleware
- [x] Add OptimisticLockError handling to flowise-core-backend errorHandlerMiddleware
- [x] Verify lookupUserEmail export in @universo/utils

### Phase 2: Migrate Metahubs Backend Routes (Pattern A → B)
- [ ] metahubsRoutes.ts - Move version check to service, remove inline 409
- [ ] branchesRoutes.ts - Move version check to service, remove inline 409
- [ ] publicationsRoutes.ts - Move version check to service, remove inline 409

### Phase 3: Migrate Applications Backend Routes
- [ ] applicationsRoutes.ts - Move version check to service, remove inline 409
- [ ] connectorsRoutes.ts - Move version check to service, remove inline 409

### Phase 4: Simplify Existing Pattern B Routes
- [ ] attributesRoutes.ts - Remove try/catch, let middleware handle
- [ ] hubsRoutes.ts - Remove try/catch, let middleware handle
- [ ] elementsRoutes.ts - Remove try/catch, let middleware handle
- [ ] catalogsRoutes.ts - Remove try/catch, let middleware handle

### Phase 5: Consolidate Frontend Utilities
- [ ] Delete metahubs-frontend/utils/conflictDetection.ts (duplicate)
- [ ] Update imports to use @universo/utils

### Phase 6: Add i18n Keys
- [ ] Add conflict error keys to EN locale
- [ ] Add conflict error keys to RU locale

### Phase 7: Build & Test
- [ ] Run targeted builds for affected packages
- [ ] Run tests for metahubs-backend and applications-backend

### Phase 8: Documentation
- [ ] Update memory-bank/systemPatterns.md
- [ ] Update memory-bank/progress.md

## IMPLEMENT (2026-01-24): Elements Rename + Metahub UI Sync

- [x] Rename Records domain to Elements across metahubs-backend (routes/services/types/schema table `_mhb_elements`, snapshot `elements`, sync/seed usage).
- [x] Update metahubs-frontend to Elements (routes/tabs/queryKeys/hooks/types/UI labels) and remove legacy Records naming.
- [x] Update i18n keys for Elements (EN/RU) and remove/replace Records keys.
- [x] Add "Storage" tab to Metahub edit dialog (match create dialog; fixed first option).
- [x] Verify Catalog↔Hub relations persist in snapshot and app schema generation; fix serialization/DDL if missing.
- [x] Publication edit "Applications" tab: show only application name/description (remove `pub-*` system label).
- [x] Reorder Metahub side menu with separators (Board / Hubs / Catalogs / Publications / Access).
- [x] Update metahubs README docs (EN/RU) and vitest config path after Elements rename.
- [x] Run targeted builds/tests for metahubs-backend, metahubs-frontend, and template-mui.

## IMPLEMENT (2026-01-24): Metahubs Branches (Default/Active per user)

- [ ] Update metahubs migration to add metahubs_branches, default_branch_id, active_branch_id (no new migration).
- [ ] Add MetahubBranch entity + update Metahub/MetahubUser entities.
- [ ] Implement MetahubBranchesService (create/clone/activate/delete, created_by, blocking users).
- [ ] Update MetahubSchemaService to resolve schema by user active branch (fallback to default).
- [ ] Update hubs/catalogs/attributes/elements/services & routes to pass userId.
- [ ] Add branches API routes (list/create/update/activate/delete/blocking-users).
- [ ] Create branches frontend domain (list UI, create/edit, activate, delete blocking dialog).
- [ ] Update metahub menu/routes/breadcrumbs for branches.
- [ ] Add i18n keys for branches (metahubs + menu).
- [ ] Run targeted builds/tests for metahubs-backend and metahubs-frontend.

## IMPLEMENT (2026-01-23): Metahub Codename + Migration Squash + Menu Order

- [x] Merge metahubs migrations into 1766351182000 (publications, versions, schema_name, codename).
- [x] Update metahubs-backend for codename (entity, CRUD validation, search, responses) and use metahub codename in publications/available + connectors joins.
- [x] Update metahubs-frontend for codename (types, create/edit UI, validation, i18n).
- [x] Add divider support in template-mui side menu and reorder metahub menu sections.
- [x] Update applications UI/backend display to show metahub codename where UUID was shown.
- [x] Run targeted builds/tests and update memory-bank progress/active context.

## IMPLEMENT (2026-01-23): Metahub UI Tweaks + Attribute Search + Records Ordering

- [x] Add divider above Metahub codename field in create/edit dialogs (match Catalog UI).
- [x] Metahub list table: remove "Catalogs" column, add sortable "Codename" as 3rd column.
- [x] Attribute search should match localized name as well as codename.
- [x] Records table columns should follow attribute sortOrder left-to-right.
- [x] Run targeted builds/tests and update memory-bank progress/active context.

## IMPLEMENT (2026-01-23): Attributes Limit + Locale Sort + Pagination Banner

- [x] Enforce 100-attribute limit per catalog in backend create endpoint.
- [x] Add attributes list meta (totalAll/limit/limitReached) and locale-aware name sorting.
- [x] Pass locale to attribute list queries and include in query keys.
- [x] Add attribute count query for limitReached and disable Add button at 100.
- [x] Render info banner when limit reached; add i18n keys (EN/RU).
- [x] Run metahubs-backend and metahubs-frontend builds.

## IMPLEMENT (2026-01-23): PR Review Fixes (Attributes + RLS + Memory Bank)

- [x] Remove extra attributes count query by exposing meta in usePaginated.
- [x] Pass limit param in limitReached error and use meta limit in banner.
- [x] Avoid extra COUNT in attributes list (use items length for totalAll).
- [x] Add WITH CHECK to publication_versions RLS policy.
- [x] Normalize activeContext.md to single Current Focus block.
- [x] Run template-mui, metahubs-backend, metahubs-frontend builds.
## IMPLEMENT (2026-01-23): Publication Snapshots + App System Tables

- [x] Replace `_sys_*` with `_app_*` in schema-ddl (generator/migrator/manager/types/tests).
- [x] Remove `_predefined_data` creation and unused `MetahubPredefinedDataService`.
- [x] Extend SnapshotSerializer with predefined records + stable hash (exclude generatedAt).
- [x] Fix publication version creation/activation to store snapshot + hash and set `activeVersionId`.
- [x] Use active version snapshot for application sync + skip diff by hash when possible.
- [x] Persist full MetahubSnapshot in `_app_migrations.meta` (publication* fields).
- [x] Seed predefined records into app tables during create/sync.
- [x] Update versions UI to show duplicate snapshot warning (i18n).
- [x] Update README docs (EN/RU) for `_app_*` tables and snapshots.

## IMPLEMENT (2026-01-23): Snapshot v1 + Hubs + Predefined Records

- [x] Include HUB entities in snapshots and application schemas (hub tables + _app_objects entries).
- [x] Treat all metahub records as predefined (owner_id NULL) and include all records in snapshot.
- [x] Set snapshot_json.version to 1 (format version) and keep stable hash.

## IMPLEMENT (2026-01-23): Stable JSON Stringify Library

- [x] Add json-stable-stringify dependency to metahubs-backend (workspace).
- [x] Replace SnapshotSerializer.stableStringify with json-stable-stringify usage.
- [x] Update/remove custom stableStringify helper if unused.
- [x] Run metahubs-backend build and schema-ddl tests.
- [x] Update memory-bank (activeContext.md, progress.md).

## IMPLEMENT (2026-01-23): Metahubs QoL Fixes (Attributes, Records, Hubs, Migrations)

- [x] Append new attributes to the end by default (max sort_order + 1).
- [x] Return record timestamps in camelCase for UI (updatedAt/createdAt).
- [x] Persist hub table_name in _mhb_objects for new hubs.
- [x] Reorder snapshot JSON sections (metahubId, generatedAt, version, entities, records).
- [x] Move publication snapshot out of _app_migrations.meta into a dedicated column.
- [x] Run metahubs-backend build and schema-ddl tests.
- [x] Update memory-bank (activeContext.md, progress.md).

## IMPLEMENT (2026-01-23): QA Fixes (Snapshots + Records + Defaults)

- [x] Remove hub snapshot limit (fetch all hubs for snapshot).
- [x] Preserve full catalog.config in snapshot (not only isSingleHub/isRequiredHub).
- [x] Prevent seedPredefinedRecords from failing on new NOT NULL fields (skip invalid rows with warning).
- [x] Align records API with "all records predefined" (remove ownerId input, keep owner_id null).
- [x] Update @universo/utils stableStringify to use json-stable-stringify (dependency added).
- [x] Run metahubs-backend build and schema-ddl tests.
- [x] Update memory-bank (activeContext.md, progress.md).

## IMPLEMENT (2026-01-23): QA Follow-ups (Records + Seed Warnings)

- [x] Fix HubRecord ownerId type (string | null) in frontend types.
- [x] Persist seed warnings to latest migration meta.
- [x] Run metahubs-backend build and schema-ddl tests.
- [x] Update memory-bank (activeContext.md, progress.md).

## IMPLEMENT (2026-01-23): UI Seed Warnings

- [x] Expose seedWarnings in migration detail API response.
- [x] Render seedWarnings in Application Migrations UI.
- [x] Add seedWarnings indicator in migrations list.
- [x] Include seedWarnings in /application/:id/sync response when present.
- [x] Update i18n keys for seed warnings (EN/RU).
- [x] Run applications-frontend build (if needed) and schema-ddl tests.
- [x] Update memory-bank (activeContext.md, progress.md).

## COMPLETED (2026-01-19): QA Fixes - RLS bypass, validation key, unused import

- [x] Fix RLS bypass in `/publications/available` endpoint: Use `getRequestManager(req, ds)` instead of raw `ds.query()`
- [x] Fix validation key mismatch in ConnectorList.tsx: Use `publicationRequired` instead of `metahubRequired`
- [x] Remove unused import `useConnectorDiff` in ConnectorDiffDialog.tsx
- [x] Build affected packages (19 tasks, 1m39s)
## COMPLETED (2026-01-19): schema-ddl cleanup

- [x] Fix statement_timeout interpolation in schema-ddl locking helper
- [x] Remove deprecated static wrapper methods in SchemaGenerator and MigrationManager
- [x] Run schema-ddl tests and full workspace build
- [x] Update memory-bank (activeContext.md, progress.md, systemPatterns.md, techContext.md, productContext.md, projectbrief.md, currentResearch.md)
## COMPLETED (2026-01-19): Connector Name Link Styling Fix

- [x] Change connector name link color from blue (`primary.main`) to inherit
- [x] Add hover effect (underline + blue color) matching ApplicationList pattern
- [x] Build successful (64 tasks, 4m38s)
## COMPLETED (2026-01-19): Connector List Relation + Admin Notice Layout

- [x] Align admin instances notice spacing with connector list banner
- [x] Add connector relation chip on card view (Metahub)
- [x] Add "Relation" column with "Metahub" in connector table view
- [x] Make connector name column a link in table view
- [x] Build project to validate changes
- [x] Update memory-bank files (activeContext.md, progress.md)
## COMPLETED (2026-01-19): Connector UI + Admin Notice Fixes

- [x] Fix missing "Codename" translation in connector Metahub selection
- [x] Fix "Created" translation on connector details card
- [x] Move admin instances notice to top and update text (ru/en)
- [x] Build project to validate changes
- [x] Update memory-bank files (activeContext.md, progress.md)
## COMPLETED (2026-01-19): Connector UI Localization Fixes

- [x] Add `common.search` key for search placeholder translation (en/ru)
- [x] Add `table.name` and `table.codename` top-level keys (en/ru)
- [x] Add `connectors.table.created` key for created date translation (en/ru)
- [x] Update `connectors.metahubInfo.locked` text to user-requested wording (en/ru)
- [x] Change tab id and label from 'publications' to 'metahubs' in ConnectorActions.tsx
- [x] Remove Publication row from ConnectorBoard.tsx (internal info not needed)
- [x] Build successful (64 tasks)
## COMPLETED (2026-01-19): Remove publications_users Table

- [x] Delete PublicationUser.ts entity file
- [x] Remove PublicationUser from entities/index.ts and main index.ts exports
- [x] Remove publicationUsers relation from Publication.ts entity
- [x] Update publicationsRoutes.ts - remove PublicationUser import and usage
- [x] Update /publications/available query to use metahubs_users instead
- [x] Fix /publications/available codename mapping (metahub slug, publication schema_name)
- [x] Rewrite migration to remove publications_users table
- [x] Update RLS policy to use metahubs_users for access control
- [x] Build successful (64 tasks)
## 2025-01 Historical Completed Tasks ✅

- [x] Connector/publication refactor, schema-ddl extraction, and related QA fixes completed.
- [x] Details archived in progress.md (2025-01 entries).
## IMPLEMENT (2026-01-18): Publication as Separate Entity

- [x] Create migration `AddPublicationsTable` in metahubs-backend (publications + publications_users)
- [x] Create migration `AddConnectorsPublications` in applications-backend (junction table)
- [x] Register migrations in respective index.ts files
- [x] Create `Publication` entity in metahubs-backend
- [x] Create `PublicationUser` entity in metahubs-backend
- [x] Create `ConnectorPublication` entity in applications-backend
- [x] Update `Connector` entity with new relation
- [x] Update entity exports in both packages
- [x] Refactor `publicationsRoutes.ts` to use new Publication entity
- [x] Add endpoint for linked applications
- [x] Update Publication tabs (Access + Applications)
- [x] Add AccessPanel and ApplicationsPanel components
- [x] Update API types in publications.ts (accessMode, accessConfig, LinkedApplication)
- [x] Add new translation keys (EN + RU)
- [x] Build metahubs-backend - SUCCESS
- [x] Build applications-backend - SUCCESS
- [x] Build metahubs-frontend - SUCCESS
- [x] Run full pnpm build - SUCCESS (63 tasks, 6m48s)
- [x] Update memory-bank files
## IMPLEMENT (2026-01-17): Add DDL Module Unit Tests ✅

- [x] Study existing test structure (jest.config.js, typeormMocks.ts)
- [x] Create tests for `naming.ts` - 5 pure functions (generateSchemaName, generateTableName, generateColumnName, isValidSchemaName, buildFkConstraintName)
- [x] Create tests for `diff.ts` - calculateSchemaDiff with various scenarios (initial, add/drop tables/columns, kind changes)
- [x] Create tests for `snapshot.ts` - buildSchemaSnapshot with entities and fields
- [x] Create tests for `SchemaGenerator` - static methods (mapDataType) and instance methods (createSchema, dropSchema, generateFullSchema)
- [x] Create tests for `MigrationManager` - generateMigrationName, recordMigration, listMigrations, getMigration
- [x] Run all tests: 7 passed, 127 total (5 DDL test files added)
## IMPLEMENT (2026-01-17): Fix Migrations Page Not Loading Data ✅

- **Root cause**: Frontend API client used wrong URL prefix `/metahubs/application/...` but routes are mounted directly as `/application/...`
- [x] Remove `/metahubs/` prefix from `fetchMigrations()` URL
- [x] Remove `/metahubs/` prefix from `fetchMigration()` URL
- [x] Remove `/metahubs/` prefix from `analyzeMigrationRollback()` URL
- [x] Remove `/metahubs/` prefix from `rollbackMigration()` URL
- [x] Run pnpm build (63 tasks, 4m49s) — all successful
## IMPLEMENT (2026-01-17): Fix Schema Status Display + Initial Migration Recording ✅

- **Root cause**: `ConnectorBoard` received `application` as prop but it was never passed from `MainRoutesMUI`
- [x] Add `useApplicationDetails` hook call in ConnectorBoard to fetch application data directly
- [x] Remove unused `application` prop from `ConnectorBoardProps`
- **Root cause**: `generateFullSchema()` doesn't call `recordMigration()` — only `applyAllChanges()` does
- [x] Add `GenerateFullSchemaOptions` interface with `recordMigration` and `migrationDescription` options
- [x] Update `generateFullSchema()` to record initial migration when `recordMigration: true`
- [x] Export `GenerateFullSchemaOptions` from ddl/index.ts
- [x] Update sync endpoint in `publicationsRoutes.ts` to pass `{ recordMigration: true, migrationDescription: 'initial_schema' }`
- [x] Run pnpm build (63 tasks, 4m50s) — all successful
## IMPLEMENT (2026-01-17): Fix ConnectorBoard Issues ✅

## IMPLEMENT (2026-01-17): Fix Schema Sync Endpoint Path

- [x] Update connectors API endpoints to use `/metahub/...` (remove extra `/metahubs` prefix) for diff + sync.
- [x] Remove temporary debug logs added during diagnosis (applications-frontend connectors API, core-backend API debug middleware, metahubs-backend schema sync/diff logs if no longer needed).
- [x] Rebuild affected packages (applications-frontend, core-frontend, core-backend, metahubs-backend) and re-verify sync.
- [x] Create `useConnectorName` hook in useBreadcrumbName.ts.
- [x] Export `useConnectorName` from hooks/index.ts.
- [x] Add `connector` segment handling in NavbarBreadcrumbs.tsx.
- [x] Update route from `connector` to `connector/:connectorId` in MainRoutesMUI.tsx.
- [x] Update ConnectorBoard to use `connectorId` from params.
- [x] Update PublicationList navigation to include connectorId.
- [x] Update ConnectorList navigation to include connectorId.
- [x] Update backend to return connectorId in publication responses (POST, GET, LIST).
- [x] Add debug logging to backend diff endpoint (catalogDefs.length, oldSnapshot, hasChanges).
- [x] Treat missing schema as actionable diff in ConnectorDiffDialog (use schemaExists to allow create).
- [x] User to verify schema creation works via sync dialog.
- [x] Add `schemaUpToDate` key to EN i18n.
- [x] Add `schemaUpToDate` key to RU i18n.
- [x] Run pnpm build and verify (63 tasks, 5m37s - all successful).
- [x] Update memory-bank files.
## IMPLEMENT (2026-01-17): Fix Connector Metahub Query Error

- [x] Update cross-schema join to use `metahubs.metahubs.slug` (no `codename` column).
- [x] Build applications-backend.
- [x] Run full workspace build.
- [x] Update memory-bank files.
## IMPLEMENT (2026-01-17): Fix Sync Button Disabled (Missing Metahub Data) ✅

- **Root cause**: Backend returned `ConnectorMetahub` links without nested `metahub` object (only `metahubId`).
- **Frontend expected**: `linkedMetahubs[0].metahub` to contain metahub details, but it was undefined.
- [x] Update `connectorsRoutes.ts` GET endpoint to use cross-schema SQL join with `metahubs.metahubs` table.
- [x] Transform response to include nested `metahub` object with id, codename, name, description.
- [x] Update `ConnectorMetahub` type in `types.ts` to include optional `metahub?: MetahubSummary | null`.
- [x] Update `useConnectorMetahubs.ts` hooks to handle nullish coalescing (`?? null`).
- [x] Build and verify (63 tasks, 6m29s) — all successful.
## IMPLEMENT (2026-01-17): Fix i18n Keys in ConnectorBoard ✅

- [x] Fix `t('connectors.sync', ...)` → `t('connectors.sync.button', ...)` and `t('connectors.sync.syncing', ...)`.
- [x] Fix `t('connectors.viewMigrations', ...)` → `t('connectors.board.viewMigrations', ...)`.
- [x] Add missing `connectors.schema.*` keys (title, name, status, lastSync, source) to EN i18n.
- [x] Add missing `connectors.schema.*` keys to RU i18n.
- [x] Build and verify (63 tasks, 6m42s) — all successful.
- [x] Update memory-bank files.
## IMPLEMENT (2026-01-17): Fix Migration Recording + Move Sync UI to Applications ✅

- [x] Add `{recordMigration: true, migrationDescription: 'schema_sync'}` to `applyAllChanges()` in publicationsRoutes.ts.
- [x] Add `migrations?: Record<string, unknown>` to ApplicationsBundle interface.
- [x] Add `migrations: bundle?.migrations ?? {}` to consolidateApplicationsNamespace return.
- [x] Create sync API functions in applications-frontend/api/connectors.ts.
- [x] Create useSyncConnector mutation hook.
- [x] Create useConnectorSync hook for diff fetching.
- [x] Create useFirstConnectorDetails hook (fetches first connector by applicationId).
- [x] Create ConnectorDiffDialog component.
- [x] Create ConnectorBoard page (uses useFirstConnectorDetails, no connectorId in URL).
- [x] Export ConnectorDiffDialog from components/index.ts.
- [x] Change route to `/application/:applicationId/connector` (without connectorId).
- [x] Change PublicationList navigation to `/application/{id}/connector`.
- [x] Change ConnectorList navigation to `/application/{id}/connector`.
- [x] Add i18n keys: connectors.status, connectors.statusDescription, connectors.sync, connectors.diffDialog, connectors.board (EN + RU).
- [x] Run pnpm build (63 tasks, 7m19s) — all successful.
- [x] Update memory-bank files.
## IMPLEMENT (2026-01-17): Runtime Migrations with Knex

- [x] Create MigrationManager class in domains/ddl with migration recording and listing.
- [x] Add recordMigration() method to SchemaGenerator.
- [x] Implement listMigrations() for retrieving migration history.
- [x] Implement rollbackMigration() with destructive change blocking.
- [x] Add analyzeRollbackPath() to check if rollback is safe.
- [x] Add DDL exports to metahubs-backend/src/index.ts.
- [x] Create applicationMigrationsRoutes.ts in metahubs-backend.
- [x] Add GET /application/:applicationId/migrations endpoint.
- [x] Add GET /application/:applicationId/migrations/:id/analyze endpoint.
- [x] Add POST /application/:applicationId/migrations/:id/rollback endpoint.
- [x] Mount routes in metahubs-backend router.ts.
- [x] Update flowise-core-backend to expose new routes (via metahubs-backend index.ts).
- [x] Create MigrationsTab component in applications-frontend.
- [x] Add migrations API client and hooks.
- [x] Move/adapt SchemaSyncPanel from metahubs to applications (migrations tab replaces sync panel).
- [x] Add rollback UI with destructive change warnings.
- [x] Add i18n keys for migrations UI (EN + RU).
- [x] Add "Migrations" tab to ApplicationBoard tabbed interface (created ApplicationMigrations page).
- [x] Add route `/application/:applicationId/migrations` in universo-template-mui.
- [x] Add Migrations menu item to Application sidebar with IconHistory.
- [x] Add i18n keys for "migrations" menu item (EN + RU).
- [ ] Add Publications menu item to Application sidebar (navigate to linked Metahubs) — DEFERRED: requires Connector→Metahub API.
- [ ] Update breadcrumbs for Publications → Metahub → Application path — DEFERRED: complex navigation flow.
- [ ] Add unit tests for MigrationManager.
- [ ] Add integration tests for migration routes.
- [ ] Update metahubs-backend README (EN/RU).
- [ ] Update applications-frontend README (EN/RU).
- [ ] Update memory-bank files.
## In Progress / QA Follow-ups

- [x] QA cleanup: add MSW handler for connectors metahubs requests in applications-frontend tests.
- [x] QA cleanup: suppress act/AbilityContext warnings in applications-frontend tests.
- [x] Applications connectors refactor: update applications-backend entities/migrations/routes/guards and backend tests.
- [x] Applications connectors refactor: update applications-frontend API/hooks/types/pages/components and frontend tests.
- [x] Metahubs integration: update publications routes and metahubs UI texts to use connectors terminology.
- [x] UI integration: update template-mui routes/menu/breadcrumbs and universo-i18n menu keys to connectors.
- [x] Documentation: update applications READMEs (EN/RU) to connectors terminology and paths.
- [x] Verification: run targeted tests for applications backend/frontend and document any gaps.
- [x] Wrap-up: update memory-bank/progress.md and note changes in activeContext if needed.
- [ ] Reduce non-fatal test noise (optional).
- [ ] Manual QA: breadcrumbs show Application name (not UUID).
- [ ] Manual QA: Access page loads members list (no connection error).
- [ ] Manual QA: delete attribute and confirm UI "#" renumbers 1..N (hub + hub-less).
- [ ] Manual QA: create records repeatedly and confirm UI does not hang.
- [ ] Confirm server logs show QueryRunner cleanup per request.
## IMPLEMENT (2026-01-17): Application system metadata tables (Phase 1)

- [x] Extend @universo/types with MetaPresentation + exports for metahubs metadata.
- [x] Extend DDL types to include presentation + sys metadata shapes.
- [x] Populate presentation/validation/uiConfig in buildCatalogDefinitions.
- [x] Add system tables + DML registration in SchemaGenerator (transaction-safe).
- [x] Update SchemaMigrator for DML changes + new change types.
- [x] Bump schema snapshot version and add hasSystemTables/backward-compat logic.
- [x] Verify builds/tests for @universo/types and @universo/metahubs-backend.
- [x] Update memory-bank activeContext.md and progress.md.
## IMPLEMENT (2026-01-16): Metahubs API routes standardization + test warnings + coverage

- [x] Remove act/MSW/useHasGlobalAccess warnings in metahubs-frontend tests (setup mocks + test fixes).
- [x] Add MSW handler for `/api/v1/profile/settings` in metahubs-frontend mocks.
- [x] Restore shared/utils coverage in metahubs-frontend and add tests to meet thresholds.
- [x] Refactor metahubs-backend routes to singular detail paths (metahub/hub/catalog/attribute/record/publication) and align public routes.
- [x] Update metahubs-frontend API clients/tests and template-mui breadcrumb fetches to new backend paths.
- [x] Update metahubs backend/frontend READMEs (EN/RU) to match new routes and i18n docs rules.
- [ ] Run full root build (timed out after ~200s; re-run needed).
- [x] Update progress.md and activeContext.md with route standardization changes.
## IMPLEMENT (2026-01-16): Metahubs frontend build-first + docs + tests

- [x] Switch metahubs-frontend to build-first (dist exports + tsdown entry for src/index.ts).
- [x] Remove src/index.d.ts temporary stub and align package.json exports.
- [x] Update README.md and README-RU.md to remove /api imports and match i18n-docs rules.
- [x] Update/add metahubs-frontend tests for entry exports after build-first.
- [x] Fix failing metahubs-frontend tests (api wrappers mock path, view preference mock shape, actions expectations).
- [x] Verify metahubs-frontend tests, metahubs-backend tests, and full root build.
- [x] Update progress.md and activeContext.md with build-first changes.
## IMPLEMENT (2026-01-16): Metahubs backend tests + ddl rename

- [x] Rename `domains/runtime-schema` to `domains/ddl` and update imports/docs.
- [x] Fix metahubsRoutes tests (mocks + expectations for sorting/search/members).
- [x] Move ts-jest isolatedModules to tsconfig.test.json and update base jest config.
- [x] Verify metahubs-backend tests/build and note any gaps.
- [x] Update progress.md and activeContext.md with changes.
## IMPLEMENT (2026-01-16): Metahubs backend domain refactor

- [x] Inventory current routes/schema/services usage and monorepo imports.
- [x] Create domain folders (metahubs, hubs, catalogs, attributes, records, publications, runtime-schema, shared) and move code.
- [x] Rebuild route composition and exports using domain routers (no legacy paths).
- [x] Update internal imports, tests, and docs to new domain structure.
- [x] Remove old folders (src/routes, src/schema, src/services, src/schemas) after migration.
- [x] Verify builds/tests for metahubs-backend and note any gaps.
- [x] Update progress.md and activeContext.md with refactor summary.
## IMPLEMENT (2026-01-15): Metahubs TS verification

- [x] Run targeted TS builds for metahubs-backend and metahubs-frontend to detect errors.
- [x] Fix any TS errors uncovered by the builds and re-run the affected build.
- [x] Update progress.md with results and note any decisions in activeContext.md if needed.
## IMPLEMENT (2026-01-16): Metahubs frontend modular refactor

- [x] Introduce domain folders for metahubs frontend and move UI pages/actions into domains with compatibility exports.
- [x] Move API modules into domain folders and keep stable re-exports for existing imports.
- [x] Update internal imports and tests to match new structure where needed.
- [x] Verify targeted builds for metahubs-frontend.
- [x] Update progress.md with refactor summary.
## IMPLEMENT (2026-01-16): Metahubs frontend cleanup + domain barrels

- [x] Inventory and update monorepo imports to remove pages/* usage; switch routes to root exports.
- [x] Introduce domain barrel exports to reduce relative import depth.
- [x] Domainize metahubs mutations and shared helpers; update imports.
- [x] Remove obsolete proxy layers (src/pages, src/api) and update package exports/tests.
- [x] Verify targeted builds/tests for metahubs-frontend.
- [x] Update progress.md with cleanup summary.
## ✅ COMPLETED (2026-01-15): QA fixes for types unification

- [x] Update roleSchema/memberFormSchema tests for dynamic roles; add empty role rejection test.
- [x] Remove PaginationMeta duplication (re-export from @universo/types).
- [x] Replace dangerouslySetInnerHTML with SafeHTML in chat UI.
- [x] All tests passing.
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): Monorepo-wide types unification

- [x] Canonical types in @universo/types: PaginatedResponse items, PaginationParams alias, Filter types.
- [x] @universo/template-mui re-exports pagination/filter types; keeps MUI-specific types.
- [x] getLocalizedString -> getVLCString migration (applications/metahubs).
- [x] Pagination types migrated across 11 frontends (admin, campaigns, storages, projects, spaces, organizations, publish, start, clusters, metaverses, metahubs, applications, uniks).
- [x] Remove UseApi from 7 frontends (campaigns, projects, storages, organizations, clusters, metaverses, uniks).
- [x] Full build passed; systemPatterns updated.
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): Metahubs types refactor + cleanup

- [x] Remove dead/legacy types (gulp.d.ts, ui.d.ts, LocalizedField, getLocalizedContent, UseApi).
- [x] Migrate pagination types to @universo/types; add PaginationParams alias.
- [x] Reorganize types.ts with JSDoc and grouped exports.
- [x] Build metahubs-frontend and full monorepo passed.
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): Metahubs QA fixes

- [x] SchemaMigrator FK naming + constraint length fixes.
- [x] Reuse shared getVLCString; remove renderLocalizedFields.
- [x] Publications UI naming cleanup + EN grammar fix.
- [x] Lint re-run (pre-existing warnings remain).
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): Publications refactor + sync fixes

- [x] Backend routes: `/metahubs/:id/publications` (list/detail/sync/diff/delete).
- [x] Frontend publications API aligned to `/publications` endpoints.
- [x] Breadcrumbs fetch publication names from `/publications`.
- [x] Sync action wired to create/update/sync/delete publication APIs.
- [x] Build verified (63 tasks).
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): Source -> Metahub links UI (Phase 5-6)

- [x] MetahubSelectionPanel component.
- [x] sourceMetahubs API functions (list/link/unlink/listAvailable).
- [x] useSourceMetahubs hooks (list/available/link/unlink).
- [x] Types: SourceMetahub, MetahubSummary, SourceMetahubsResponse.
- [x] EN/RU translations for sources.metahubs.*.
- [x] Build @universo/applications-frontend success.
- [x] Details: progress.md#2026-01-15.
## ✅ COMPLETED (2026-01-15): useViewPreference QA improvements

- [x] SSR-safe hook in @universo/template-mui with isLocalStorageAvailable guard.
- [x] Export ViewStyle + DEFAULT_VIEW_STYLE; re-export across 7 packages.
- [x] 14 unit tests added; keys normalized (projects/storages).
- [x] Lint and build verification completed.
- [x] Details: progress.md#2026-01-15.
## COMPLETED (2026-01-01 to 2026-01-14): Condensed log

- Publications rename + page fixes, sources linking, application creation/QA, and UI improvements.
- Catalogs/attributes improvements, schema sync UUID naming, and application UI/diff fixes.
- Catalogs QA rounds, VLC rollout, record edit fixes, and localization hardening.
- Project metadata i18n/login UX, auth fixes/toggles, and SmartCaptcha/lead forms updates.
- Details: progress.md#2026-01-14, progress.md#2026-01-13, progress.md#2026-01-12, progress.md#2026-01-11, progress.md#2026-01-10, progress.md#2026-01-09, progress.md#2026-01-08, progress.md#2026-01-06, progress.md#2026-01-05, progress.md#2026-01-04, progress.md#2026-01-03, progress.md#2026-01-02, progress.md#2026-01-01.
## ✅ COMPLETED (2025-12-31 to 2025-12-14): Condensed log

- [x] Cookie/lead consent, legal pages, onboarding/auth fixes, start page MVP.
- [x] Metahubs transformation + RLS QA fixes.
- [x] AgentFlow integration, config UX, QA hardening.
- [x] Flowise 3.0.12 components refresh.
- [x] Details: progress.md#2025-12-31.
- [x] Also see progress.md#2025-12-30 for legal/profile updates.
## 📋 PLANNED TASKS

- Status: Deferred until production deployment pattern is clear; currently using MemoryStore.
- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT).
- [ ] Review auth architecture for scalability.
- [ ] Role cloning, templates, permission inheritance.
- [ ] Audit log for role/permission changes.
- [ ] Multi-instance support (remote instances).
- [ ] Dark mode theme.
- [ ] Keyboard shortcuts.
- [ ] Mobile responsiveness improvements.
- [ ] Tour/onboarding for new users.
- [ ] Server-side caching, CDN integration.
- [ ] Bundle size optimization.
- [ ] Complete API documentation (OpenAPI).
- [ ] Architecture decision records (ADR).
## 🧪 TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation.
- [ ] Standardize error handling across packages.
- [ ] Add unit/E2E tests for critical flows.
- [ ] Resolve Template MUI CommonJS/ESM conflict.
- [ ] Database connection pooling optimization.
## 🔒 SECURITY TASKS

- [ ] Rate limiting for all API endpoints.
- [ ] CSRF protection review.
- [ ] API key rotation mechanism.
- [ ] Security headers (HSTS, CSP).
- [ ] Security audit.
- [ ] 2FA/MFA system.
## 📚 HISTORICAL TASKS

- v0.40.0: Tools/Credentials/Variables/ApiKey/Assistants/Leads/ChatMessage/DocStore/CustomTemplates extraction, Admin Instances MVP, RBAC Global Roles.
- v0.39.0: Campaigns, Storages modules, useMutation refactor.
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes.
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics.
- v0.36.0: dayjs migration, publish-frontend architecture.
- v0.35.0: i18n TypeScript migration, rate limiting, RLS analysis.
- v0.34.0: Global monorepo refactoring, tsdown build system.
