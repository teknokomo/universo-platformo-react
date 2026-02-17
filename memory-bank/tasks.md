# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

## Completed: Documentation Updates (QA Recommendations) — 2026-02-22 ✅

> **Context**: README updates recommended during QA analysis of columnsContainer + migration guard implementation.

### metahubs-frontend README (EN + RU)
- [x] Add ColumnsContainerEditorDialog section (DnD editor, MAX_COLUMNS=6, MAX_WIDGETS_PER_COLUMN=6)
- [x] Add MetahubMigrationGuard section (route guard, status check, apply button, structured blockers)
- [x] Add Structured Blockers i18n section (StructuredBlocker type, rendering pattern)
- [x] Update file structure to show `domains/layouts/` and `domains/migrations/` directories
- [x] Verify EN/RU line count parity: 435/435

### metahubs-backend README (EN + RU)
- [x] Add Structured Blockers & Migration Guard subsection to Key Features
- [x] Add ColumnsContainer Seed Config subsection to Key Features
- [x] Add Metahub Migrations Endpoints section (GET status + POST apply with response format)
- [x] Update file structure to show `migrations/` domain and updated `layoutDefaults.ts` description
- [x] Verify EN/RU line count parity: 771/771

### apps-template-mui README (NEW, EN + RU)
- [x] Create README.md — dashboard system, columnsContainer, widget renderer, CRUD components, route factory, architecture, file structure, key types
- [x] Create README-RU.md — mirror of EN with identical line count
- [x] Verify EN/RU line count parity: 307/307

---

## Completed: QA Bug & Warning Fixes — 2026-02-21 ✅

> **Context**: Fixes for 2 BUGs and 4 WARNs found during QA of the 5-Étap implementation.

### BUG Fixes
- [x] BUG-1: Disable "Apply (keep user data)" button when `status.blockers.length > 0` (`MetahubMigrationGuard.tsx`)
- [x] BUG-2: Inline `goToMigrations` function + fix Rules of Hooks violation (`MetahubMigrationGuard.tsx`)

### WARN Fixes
- [x] WARN-1: Replace `key={idx}` with stable `key={column.id}-w${idx}` in SortableColumnRow widgets (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-2: Remove redundant `makeDefaultConfig()` call from `useState` initializer (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-3: Add save-time validation to strip `columnsContainer` widgetKey nesting (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-4: Tests already passing — confirmed setup via `happy-dom` + shared `setupTests.ts` chain

### Verification
- [x] Full workspace build: 65/65 packages, 0 errors
- [x] Lint: 0 errors (320 pre-existing warnings)
- [x] Tests: 3/3 passing
- [x] Update memory-bank

---

## Completed: 5-Etap QA Fixes — User-Reported Issues — 2026-02-20 ✅

> **Context**: Comprehensive QA fixes addressing user-reported issues across metahubs and apps-template-mui. 5 etaps covering editor UX, layout display, migration UX, structured i18n blockers, and multi-widget columns.

### Etap 1: Editor canSave + dirty tracking
- [x] Add `useRef` snapshot for initial state in `ColumnsContainerEditorDialog.tsx`
- [x] Add `isDirty` useMemo comparing JSON snapshots
- [x] Add `canSave` prop to EntityFormDialog: `() => isDirty && columns.length > 0 && totalWidth <= MAX_WIDTH`
- [x] Add `widthError` i18n key to EN and RU

### Etap 2: LayoutDetails inner widgets display
- [x] `getWidgetChipLabel()` in `LayoutDetails.tsx` shows inner widget names for columnsContainer
- [x] Uses `col.widgets.flatMap()` for multi-widget support

### Etap 3: Migration guard "Apply (keep user data)" button
- [x] Add warning-color button in `MetahubMigrationGuard.tsx` calling `applyMetahubMigrations(id, { cleanupMode: 'keep' })`
- [x] Add loading (`applying`) and error (`applyError`) states
- [x] Add `applyKeepData` i18n key to EN and RU

### Etap 4: Structured blockers i18n (largest change, 7 files)
- [x] New `StructuredBlocker` interface in `@universo/types`: `{ code, params, message }`
- [x] Backend `TemplateSeedCleanupService.ts`: 11 blocker sites converted from strings to structured objects
- [x] Backend `metahubMigrationsRoutes.ts`: 5 blocker sites converted
- [x] Frontend `migrations.ts` API types updated to `StructuredBlocker[]`
- [x] Frontend `MetahubMigrationGuard.tsx` renders structured blockers with `<ul>/<li>` and `t()`
- [x] 15 blocker i18n keys added to EN/RU locales

### Etap 5A: multiInstance revert + MainGrid filter
- [x] `columnsContainer.multiInstance` back to `true` in `metahubs.ts`
- [x] `MainGrid.tsx`: `.find()` -> `.filter()` for multiple columnsContainers, each rendered in `<Box>`

### Etap 5B: Multi-widget columns (6 files)
- [x] New `ColumnsContainerColumnWidget` interface: `{ widgetKey: DashboardLayoutWidgetKey }`
- [x] `ColumnsContainerColumn`: `widgetKey` property replaced with `widgets: ColumnsContainerColumnWidget[]`
- [x] `widgetRenderer.tsx`: renders `(col.widgets ?? []).map()` per column
- [x] `layoutDefaults.ts`: seed updated to `widgets: [{ widgetKey: 'detailsTable' }]`
- [x] `ColumnsContainerEditorDialog.tsx`: full rewrite for multi-widget — per-column widget list with add/remove, `MAX_WIDGETS_PER_COLUMN=6`
- [x] `LayoutDetails.tsx`: chip label uses `col.widgets.flatMap()`
- [x] Added `addWidget` i18n key to EN/RU

### Verification
- [x] Full workspace build: 65/65 packages, 0 errors
- [x] Modified 12 files total

### Next Steps
- QA mode for validation

---

## Completed: Center Zone columnsContainer + Data-Driven MainGrid — 2026-02-19 ✅

> **Context**: Follow-up to Dashboard Zones & Widgets Enhancement. Fixes BUG-5/BUG-6 and implements columnsContainer in center zone.

### Etap A: Fix buildDashboardLayoutConfig — zone-aware center widget flags
- [x] A.1 Add `centerActive` set filtered by `zone === 'center'` in `layoutDefaults.ts`
- [x] A.2 Remove `showDetailsSidePanel`, add `showColumnsContainer`

### Etap D: Seed data + template version
- [x] D.1 Replace standalone `detailsTable` with `columnsContainer` in `DEFAULT_DASHBOARD_ZONE_WIDGETS`
- [x] D.2 Remove `detailsSidePanel` from right zone seed entries
- [x] D.3 Bump template version `1.1.0` -> `1.2.0` in `basic.template.ts`

### Etap B: Runtime API center zone
- [x] B.1 Expand SQL filter to `zone IN ('left', 'right', 'center')` in `applicationsRoutes.ts`
- [x] B.2 Add `center` zone mapping in widget row processing
- [x] B.3 Add `center` array to Zod schema in `api.ts`
- [x] B.4 Add `center` to `applications-frontend/types.ts`

### Etap C: MainGrid data-driven refactor
- [x] C.1 Create `DashboardDetailsContext.tsx` with Provider + hook
- [x] C.2 Add `detailsTable` case to `widgetRenderer.tsx` (uses context)
- [x] C.3 Add `center` to `ZoneWidgets`, wrap Dashboard in `DashboardDetailsProvider`, pass centerWidgets to MainGrid
- [x] C.4 Refactor `MainGrid.tsx` — columnsContainer via `renderWidget()`, fallback to standalone `detailsTable`

### Etap F: Remove legacy code
- [x] F.1 Remove `showDetailsSidePanel` from `useCrudDashboard.ts`, add `showColumnsContainer`
- [x] F.2 Remove `showDetailsSidePanel` from `applicationSyncRoutes.ts`, add `showColumnsContainer`
- [x] F.3 Remove `showDetailsSidePanel` from `LayoutList.tsx`, add `showColumnsContainer`
- [x] F.4 Replace `showDetailsSidePanel` with `showColumnsContainer` in i18n EN/RU

### Etap E-G: Verification
- [x] E.1 Verified `TemplateSeedMigrator` correctly adds columnsContainer to existing metahubs
- [x] E.2 Verified `enrichConfigWithVlcTimestamps` does not corrupt columnsContainer config
- [x] G.1 Full workspace build — 65/65 packages, 0 errors
- Details: progress.md#center-zone-columnscontainer

---

## Completed: Dashboard Zones & Widgets Enhancement (Level 4) — 2026-02-18 ✅

> **Creative phase** — design documented in `memory-bank/creative/creative-dashboard-zones-widgets.md`
> **Implementation**: All 4 phases completed and verified.

### Phase 1: Split detailsSidePanel -> productTree + usersByCountryChart
- [x] 1.1 Add widget keys to `universo-types/metahubs.ts`
- [x] 1.2 Add default widget entries in `layoutDefaults.ts`
- [x] 1.3 Split rendering in `MainGrid.tsx`
- [x] 1.4 Update DashboardLayoutConfig, useCrudDashboard defaults
- [x] 1.5 Update i18n files (widget labels)

### Phase 2: columnsContainer Widget
- [x] 2.1 Add `ColumnsContainerConfig` type + `columnsContainer` widget key to `universo-types`
- [x] 2.2 Create `ColumnsContainerEditorDialog.tsx` (metahubs-frontend, DnD-sortable)
- [x] 2.3 Integrate editor trigger in `LayoutDetails.tsx`
- [x] 2.4 Add `columnsContainer` rendering in `widgetRenderer.tsx` (center zone)
- [x] 2.5 Add i18n keys for columnsContainer

### Phase 3: Right Drawer (SideMenuRight)
- [x] 3.1 Extract `renderWidget()` to shared `widgetRenderer.tsx`
- [x] 3.2 Create `SideMenuRight.tsx` (permanent, 280px), `SideMenuMobileRight.tsx` (temporary)
- [x] 3.3 Modify `SideMenuMobile.tsx` (anchor: right->left)
- [x] 3.4 Update Dashboard + AppNavbar for dual drawer support with mutual exclusion
- [x] 3.5 Backend: expand zone filter in `applicationsRoutes.ts` for right zone
- [x] 3.6 Update `allowedZones` for widgets (`infoCard`, `divider`, `spacer`)

### Phase 4: Routing isolation
- [x] 4.1 Create `createAppRuntimeRoute()` factory in `apps-template-mui`
- [x] 4.2 Export types `AppRouteObject`, `AppRuntimeRouteConfig`
- [x] 4.3 Import and use in `MainRoutesMUI.tsx`

### QA Fixes (8 issues)
- [x] BUG-1: `ColumnsContainerEditorDialog` dead state reset — `useEffect([open, config])`
- [x] BUG-2: `detailsSidePanel` ghost widget — explicit deprecated case in `widgetRenderer.tsx`
- [x] BUG-3: Template version `1.0.0` -> `1.1.0` in `basic.template.ts`
- [x] BUG-4: `TemplateSeedMigrator` ignoring `w.isActive` from seed — fixed
- [x] WARN-1: `totalWidth > 12` validation blocking save
- [x] WARN-2: `MAX_COLUMNS = 6` limit with disabled button
- [x] WARN-3: `MAX_CONTAINER_DEPTH = 1` recursion guard with depth parameter
- [x] WARN-4: Documented SideMenuMobile anchor change. STYLE: Prettier applied (6 files)
- [x] 5 files created, 17+ modified. Build: all packages OK.
- Details: progress.md#dashboard-zones-widgets

---

## Completed: Architecture Refactoring — Headless Controller Hook — 2026-02-17 ✅

- [x] 1. Create `CrudDataAdapter` interface (`api/types.ts`) — decouples CRUD logic from API implementations
- [x] 2. Extract `toGridColumns()` + `toFieldConfigs()` into shared `utils/columns.tsx`
- [x] 3. Create `useCrudDashboard()` headless controller hook (~400 lines)
- [x] 4. Create `createStandaloneAdapter()` + `createRuntimeAdapter()` implementations
- [x] 5. Create `CrudDialogs` + `RowActionsMenu` shared components
- [x] 6. Refactor `DashboardApp.tsx` — 483 -> ~95 lines (-80%)
- [x] 7. Refactor `ApplicationRuntime.tsx` — 553 -> ~130 lines (-76%)
- [x] 8. 7 new files, 4 modified. Build: apps-template-mui clean.
- Pattern: systemPatterns.md#headless-controller-hook
- Details: progress.md#architecture-refactoring

## Completed: QA Bug Fixes — BUG-1/2/3, PERF-1 (2026-02-17) ✅

- [x] BUG-1: Fix `catalogId` propagation in `useUpdateRuntimeCell` — passed dynamically via mutate params + ref
- [x] BUG-2: `useCrudDashboard` accepts `adapter: CrudDataAdapter | null` — queries disabled when null
- [x] BUG-3: Extracted `mapMenuItems()` helper — eliminated ~50 lines duplication
- [x] PERF-1: Stabilized `cellRenderers` ref via `useRef` — prevents DataGrid column re-creation
- [x] Build: 65/65 OK

## Completed: UI Polish — Button Position, Actions Centering, DataGrid i18n — 2026-02-17 ✅

- [x] 1. Move create button below title (toolbar area) — `MainGrid.tsx`
- [x] 2. Fix options button vertical centering — DataGrid cell `display: flex, alignItems: center`
- [x] 3. DataGrid i18n — `getDataGridLocaleText()` utility with `ruRU` locale
- [x] 4. Column menu (Sort/Filter/Hide/Manage) and pagination fully localized
- [x] 5. 6 files modified, 1 created. Build: 65/65 OK.
- Details: progress.md#ui-polish

## Completed: QA Round 6 — M1-M4, UX Improvements — 2026-02-17 ✅

- [x] M1: Backend PATCH null check for required fields in `applicationsRoutes.ts`
- [x] M2: `extractErrorMessage()` helper — structured JSON error parsing across 5 API functions
- [x] M3: 5 shared mutation hooks in `applications-frontend/mutations.ts`, refactored ApplicationRuntime
- [x] M4: Schema fingerprint tracking via `useRef` — prevents stale data submission
- [x] Actions column: `MoreVertRoundedIcon` dropdown menu (28x28, width 48)
- [x] Button text: "Create record"->"Create" across 4 i18n files + JSX fallbacks
- [x] i18n: Added `errorSchemaChanged` key to all 4 locale files
- [x] Build: 65/65 OK.
- Details: progress.md#qa-round-6

## Completed: QA Round 5 — Dialog Input Styling — 2026-02-16 ✅

- [x] Root cause: Dashboard compact `MuiOutlinedInput` (padding: 0, hidden notchedOutline) incompatible with form Dialogs
- [x] Fix: Replaced with form-compatible spacing (`padding: '15.5px 16px'`, standard notchedOutline)
- [x] Added `MuiInputLabel` customization (floating label with shrink background, focused color)
- [x] Added `MuiButton` disabled state (`opacity: 0.6`) + per-variant disabled colors
- [x] Build: 65/65 OK. Only `inputs.tsx` file modified.
- Details: progress.md#qa-round-5

## Completed: QA Round 4 — Theme Dedup, Runtime Rename — 2026-02-16 ✅

- [x] THEME-1: Removed duplicate `<AppTheme>` + `<CssBaseline>` from Dashboard.tsx
- [x] RUNTIME-1: Renamed runtime->app terminology in `api.ts` (functions, types, schema names)
- [x] RUNTIME-2: Renamed in `mutations.ts` (hooks, query keys). Cache namespace: `'application-runtime'`->`'application-data'`
- [x] RUNTIME-3: Updated `DashboardApp.tsx` — imports, local var `runtime`->`appData`, i18n keys
- [x] RUNTIME-4: Updated `index.ts` — canonical `appQueryKeys` export, deprecated `runtimeKeys` alias
- [x] RUNTIME-5: Updated `ApplicationRuntime.tsx` — new imports, i18n `app.*`
- [x] RUNTIME-6: Renamed `tsconfig.runtime.json` -> `tsconfig.build.json`, updated build script
- [x] i18n: Updated `runtime.*` -> `app.*` keys (4 locale files). Backward-compat aliases maintained.
- [x] Build: 65/65 OK.
- Details: progress.md#qa-round-4

## Completed: QA Round 3 — Theme, Hooks, Delete, i18n, Layout — 2026-02-15 ✅

- [x] 1. Created `AppMainLayout` component (theme wrapper + CssBaseline + x-theme)
- [x] 2. Fixed HOOKS-1: moved `useMemo`/`isFormReady` before conditional early return
- [x] 3. Wrapped DashboardApp + ApplicationRuntime returns in `AppMainLayout`
- [x] 4. Fixed DELETE-1: removed auto-close from `ConfirmDeleteDialog.handleConfirm`
- [x] 5. Fixed I18N-1: replaced hardcoded `formatMessage` with `useTranslation('apps')` + 16 new keys
- [x] 6. Updated `index.ts` exports
- [x] 7. Deleted dead code: `MinimalLayout.tsx`, `TableRoute.tsx`, empty `routes/`
- [x] 8. Prettier fixes (12 files). Build: 65/65 OK.
- Details: progress.md#qa-round-3

## Completed: QA Rounds 1-2 — Validation, Cache, VLC, Security — 2026-02-14/15 ✅

- [x] DATE-1: Backend date validation (`new Date()` + `isNaN` check) in coerceRuntimeValue
- [x] VALID-2/3: UUID validation for catalogId and applicationId
- [x] CACHE-1: Broadened cache invalidation (applicationId-only key)
- [x] VLC-1: Structural check for VLC objects (require `locales` property)
- [x] VALID-1: UUID format validation for path params (returns 400 instead of 500)
- [x] AUDIT-1: Added `_upl_updated_by` to PATCH endpoints
- [x] UX-1: Removed `throw err` from delete handlers (avoids Unhandled Promise Rejection)
- [x] I18N-1: `{{message}}` interpolation in standalone error keys
- Details: progress.md#qa-rounds-1-2

## Completed: Runtime CRUD + VLC + i18n + DataGrid — 2026-02-15 ✅

### Phase 1: Backend API (applications-backend)
- [x] 1.1 Extend GET runtime: DATE/JSON types, isRequired, validationRules
- [x] 1.2 POST /:applicationId/runtime/rows — create row with VLC support
- [x] 1.3 PATCH — support all field types (not just BOOLEAN)
- [x] 1.4 DELETE — soft delete
- [x] 1.5 GET /:applicationId/runtime/rows/:rowId — raw data for edit form

### Phase 2: Frontend Components (apps-template-mui)
- [x] 2.1-2.4 Adapted RuntimeFormDialog, LocalizedInlineField, ConfirmDeleteDialog

### Phase 3-4: API + CRUD UI
- [x] 3.1-3.2 Zod schema extension + React Query mutations
- [x] 4.1-4.5 Actions slot, create button, edit/delete columns, dialogs connected

### Phase 5-7: i18n, DataGrid UX, Finalization
- [x] 5.1-5.3 `apps` namespace i18n (EN/RU), `useTranslation` connected
- [x] 6.1-6.3 Column header jitter fix, sorting enabled, actions toolbar
- [x] 7.1 Full build: 65/65 OK
- Details: progress.md#runtime-crud

## Completed: Metahubs UX — Boolean Fix, Auto-fill, Presentation Tab — 2026-02-13 ✅

- [x] Task 1: Fix indeterminate checkbox (DDL `.defaultTo(false)`, runtime null->false, frontend `indeterminate={false}`)
- [x] Task 2: Auto-fill publication name (metahub name + " API" suffix via VLC)
- [x] Task 3: Presentation tab (tabs pattern, PresentationTabFields, display attribute + headerAsCheckbox)
- [x] Task 4: Boolean header as checkbox (uiConfigSchema -> SQL -> Zod -> renderHeader pipeline)
- [x] Task 5: Migration verification (no new migrations needed)
- [x] QA: TYPE-1 (uiConfig to AttributeFormValues), CONCUR-1 (shallow merge for uiConfig update)
- [x] Build: 65/65 OK. 14 files in 6 packages.
- Details: progress.md#metahubs-ux

## Completed: UI/UX Polish — Menu Fix, Buttons, Widget Toggle, Hubs Tab — 2026-02-14 ✅

- [x] Fixed "Layouts" menu position in PRODUCTION config (`menuConfigs.ts`) + synced `metahubDashboard.ts`
- [x] Changed page buttons from "Add" to "Create" in 10 list files (metahubs + applications)
- [x] Replaced Switch with Activate/Deactivate buttons + icons in LayoutDetails
- [x] Show Hubs tab in catalog edit dialog (always, matching create mode)
- [x] Change create dialog button "Save" -> "Create" across 10 files
- [x] Fix codename auto-fill: reset `codenameTouched` when name cleared in edit mode
- [x] Build: 65/65 OK.
- Details: progress.md#ui-ux-polish

---

## Completed: QA Remediation + Migration Support — 2026-02-10 to 2026-02-13 ✅

### QA Round 2 Remediation (2026-02-13)
- [x] Fix `ensureDefaultZoneWidgets` and `createLayout` to respect `isActive` from defaults
- [x] Add unique partial index on `(layout_id, zone, widget_key, sort_order)`
- [x] Fix stale test expectations in `metahubMigrationsRoutes.test.ts` and `metahubBranchesService.test.ts`
- [x] Fix `layoutCodename -> template_key` assumption in TemplateSeedCleanupService
- [x] Reset schema version to 1 and template version to 1.0.0

### Zod Schema + cleanupMode Fix (2026-02-13)
- [x] Add `isActive: z.boolean().optional()` to `seedZoneWidgetSchema`
- [x] Change `cleanupMode` default from `'keep'` to `'confirm'`

### Seed isActive + Cleanup Mode + i18n + Pool Docs (2026-02-13)
- [x] Add `isActive` to `DefaultZoneWidget` type, map through seed pipeline
- [x] Pass `cleanupMode: 'confirm'` from frontend apply handler
- [x] Add `UI_LAYOUT_ZONES_UPDATE` case in `ConnectorDiffDialog` + i18n keys

### Migration 503 Pool Starvation Fix (2026-02-13)
- [x] Replace `inspectSchemaState` Promise.all(7x hasTable) with single information_schema query
- [x] Fix `widgetTableResolver` similarly — single information_schema query
- [x] Update pool formulas in KnexClient.ts and DataSource.ts

### Hash/Typing/UI Toggle Polish (2026-02-13)
- [x] Add `isActive` into snapshot hash normalization
- [x] Remove unnecessary `as any` cast, add optimistic UI update + rollback

### Widget Activation Toggle (2026-02-13)
- [x] Structure V3 DDL (`is_active` column in `_mhb_widgets`) + bump to V3
- [x] Backend service toggle + route, frontend types/API/UI
- [x] `TemplateSeedCleanupService` + `TemplateSeedExecutor` + `TemplateSeedMigrator` updates
- [x] Snapshot/Publication pipeline + Application Sync updates

### README Documentation (2026-02-12/13)
- [x] Full rewrite metahubs-backend README.md (EN, 730 lines) + README-RU.md (RU, 730 lines)
- Details: progress.md (entries from 2026-02-10 to 2026-02-13)

---

## Completed: QA Rounds 5-16 — Pool, Locks, Cache, Error Mapping — 2026-02-11/12 ✅

### Rounds 9-10: Migration Gate + Template Version Source (2026-02-12)
- [x] DB-aware `ensureSchema()`, V1/V2-compatible widget table resolver
- [x] Migration-required 428 errors, pool-timeout 503, `GET /migrations/status` endpoint
- [x] `MetahubMigrationGuard` modal — route-level block until migration resolved
- [x] Branch-level template sync tracking, removed unsafe early cache-return
- [x] Connect-timeout -> 503 mapping, frontend retry reduction + loading indicator

### Rounds 11-12: Scoped Manager + Pool Load Shedding (2026-02-12)
- [x] Split `ensureSchema` into explicit modes, version-aware table checks
- [x] Request-scoped EntityManager in MetahubSchemaService, propagated to routes/services
- [x] Frontend refetch flow fixes, removed global manager fallback

### Rounds 13-14: Atomic Sync + Error Mapping (2026-02-12)
- [x] Update structureVersion only after successful structure + seed sync
- [x] Scoped widget resolver in seed executor/migrator
- [x] Retry dedup in auth-frontend, timeout/domain error mapping
- [x] Apply pre-plan error mapping, status load shedding (skip dry-run in GET)
- [x] Copy sync fields preservation (lastTemplateVersionId/Label/SyncedAt)

### Rounds 15-16: Apply Safety + Pool Contention (2026-02-12)
- [x] Apply post-read safety (no false 500 after successful apply)
- [x] Widget cache freshness, copy cleanup strictness, lock error semantics
- [x] RLS cleanup guard for pool contention, pool budget rebalance
- [x] Advisory lock + transactional initial branch, regression tests
- [x] 12 test suites, 76+ tests across all rounds
- Details: progress.md (entries from 2026-02-11 to 2026-02-12)

---

## Completed: Structure V2 + Template Cleanup + DDL QA — 2026-02-11 ✅

### Structure V2 + Cleanup Policy
- [x] `_mhb_widgets` table rename from `_mhb_layout_zone_widgets`, `CURRENT_STRUCTURE_VERSION=2`
- [x] Safe rename execution in SystemTableMigrator transaction
- [x] Template cleanup policy: `keep`/`dry_run`/`confirm` modes with blocker support
- [x] Removed starter `tags` catalog from template

### QA Rounds 3-8 (2026-02-11)
- [x] Round 3: Metahub access checks, publication delete fail-fast, kind normalization, seed layout protection
- [x] Round 4: Branch access guards, delete locking (advisory + transactional), 32-bit advisory key fix
- [x] Round 5: Shared advisory lock helpers, false structureVersion upgrade prevention, copy hardening
- [x] Round 6: Branch structureVersion alignment, TOCTOU conflict -> 409, advisory lock timeout fix
- [x] Round 7: Branch cache invalidation on activation/reset, race condition removal, codename pre-check
- [x] Round 8: MSW handlers for templates, configurable coverage thresholds, typed user extraction

### DDL Deep Fixes + Declarative DDL QA (2026-02-11)
- [x] JSONB `meta` column fix, unique migration names, SQL identifier quoting
- [x] Entity lookup by `kind`, layouts/zone widgets incremental migration, lazy manifest load
- [x] Copy route structureVersion, branch creation structureVersion, shared helper extraction
- Details: progress.md (entries from 2026-02-11)

---

## Completed: Migration Architecture + Hardened Plan/Apply — 2026-02-10/11 ✅

- [x] V1 baseline, baseline entry in `_mhb_migrations`
- [x] Decouple template seed from structure upgrades, idempotent seed migration
- [x] ALTER_COLUMN handling, migration history/plan/apply API, Migrations page
- [x] Typed migration meta contracts (baseline/structure/template_seed/manual_destructive)
- [x] Template manifest validation with cross-reference safety + structure compatibility
- [x] Seed migration dry-run planning, seed-sync events in `_mhb_migrations`
- [x] Upgraded plan/apply API: structured diffs, blockers, deterministic status codes
- [x] Branch-level template sync tracking fields
- Details: progress.md#migration-architecture

## Completed: DDL Phase 2 — FK Diff + Seed Enrichment — 2026-02-10 ✅

- [x] buildIndexSQL DRY refactor (helper extracted)
- [x] FK diff detection (ADD_FK, DROP_FK, ALTER_COLUMN) in SystemTableDiff
- [x] `_mhb_migrations` table (V2), SystemTableMigrator FK support
- [x] recordMigration method -> `_mhb_migrations` within transaction
- [x] Seed enrichment: settings (language, timezone), entities (tags catalog), elements
- [x] TemplateSeedMigrator implementation
- Details: progress.md#ddl-phase-2

## Completed: Declarative DDL & Migration Engine — 2026-02-10 ✅

- [x] SystemTableDef declarative types, shared field sets (UPL_SYSTEM_FIELDS, MHB_SYSTEM_FIELDS)
- [x] 6 V1 tables defined, SystemTableDDLGenerator
- [x] SystemTableDiff engine, SystemTableMigrator (additive auto, destructive warnings)
- [x] Layout defaults dedup. 7 phases. Build: 65/65 OK.
- Details: progress.md#declarative-ddl

## Completed: Metahub Template System — 2026-02-09/10 ✅

- [x] 10 phases: types, DB migration, entities, JSON template, seed-at-startup
- [x] Schema service refactor, backend routes, publication rename, frontend
- [x] QA Fixes: Zod VLC, default template, audit fields, transaction wrapper
- [x] Template Selector UX: chip layout, localization, edit display
- [x] QA Hardening: Atomic creation, strict VLC schema, DTO types, widgetKey narrowing
- Details: progress.md#template-system

## Completed: PR #668 Bot Review Fixes — 2026-02-09 ✅

- [x] Zod schema mismatch (menus, menu items), non-deterministic fallback
- [x] Unused imports cleanup, initial value fix
- Details: progress.md#pr-668

---

## [2026-02] Historical Completed Tasks ✅

- Menu Widget System (2026-02-09): 6 QA fixes, editor rewrite, runtime integration
- Move Menu into Layout Widget System (2026-02-08): remove menus domain, embed in widgets
- Layout Widget DnD + Edit + Zone Rendering (2026-02-08): widgetRenderer, SortableWidgetChip
- Application Runtime + DataGrid (2026-02-07): column transformers, row counts, route factory
- Layouts System Foundation (2026-02-06): backend CRUD, frontend components, zone widget management
- Details: progress.md (entries from 2026-02-06 to 2026-02-09)

## [2026-01] Historical Completed Tasks ✅

- Feb 5: Attribute data types (STRING/NUMBER/BOOLEAN/DATE/REF/JSON), display attribute, MUI 7 prep
- Jan 29 - Feb 4: Branches system, Elements rename, three-level system fields, optimistic locking
- Jan 16 - Jan 28: Publications, schema-ddl, runtime migrations, isolated schema, codename field
- Jan 11 - Jan 15: Applications modules, DDD architecture, VLC, Catalogs, i18n localized fields
- Jan 4 - Jan 10: Onboarding, legal consent, cookie banner, captcha, auth toggles
- See progress.md for detailed entries.

## [2025-12] Historical Completed Tasks ✅

- Dec 18-31: VLC system, Dynamic locales, Flowise 3.0, AgentFlow, Onboarding wizard
- Dec 5-17: Admin panel, Auth migration, UUID v7, Package extraction, Admin RBAC
- See progress.md for detailed entries.

## [Pre-2025-12] Historical Tasks ✅

- v0.40.0: Tools/Credentials/Variables extraction, Admin Instances MVP.
- v0.39.0: Campaigns, Storages modules, useMutation refactor.
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes.
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics.
- v0.36.0: dayjs migration, publish-frontend architecture.
- v0.35.0: i18n TypeScript migration, rate limiting.
- v0.34.0: Global monorepo refactoring, tsdown build system.

---

## PLANNED TASKS

- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
- [ ] Review auth architecture for scalability
- [ ] Role cloning, templates, permission inheritance
- [ ] Audit log for role/permission changes
- [ ] Multi-instance support (remote instances)
- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness improvements
- [ ] Tour/onboarding for new users
- [ ] Server-side caching, CDN integration
- [ ] Bundle size optimization
- [ ] Complete API documentation (OpenAPI)
- [ ] Architecture decision records (ADR)

## TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation
- [ ] Standardize error handling across packages
- [ ] Add unit/E2E tests for critical flows
- [ ] Resolve Template MUI CommonJS/ESM conflict
- [ ] Database connection pooling optimization

## SECURITY TASKS

- [ ] Rate limiting for all API endpoints
- [ ] CSRF protection review
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system

## Deferred: Layout Defaults + Menu Creation + Schema Diff (2026-02-09)

- [ ] Add second left-zone divider in default layout seeds
- [ ] Reset new menu widget defaults (empty title, auto-show off, no items)
- [ ] Prevent stale diff flash in connector schema sync dialog
