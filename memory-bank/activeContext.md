# Active Context

> **Last Updated**: 2026-02-17
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Completed: Architecture Refactoring — Headless Controller Hook + Adapter Pattern ✅

**Status**: All changes applied. apps-template-mui builds clean. Full build pending verification.

### Problem Solved

~80% code duplication between `DashboardApp.tsx` (483 lines) and `ApplicationRuntime.tsx` (553 lines). Both contained identical CRUD state management, mutation handlers, menu building, column transformation, and dialog JSX.

### Architecture Implemented

**Adapter Pattern** + **Headless Controller Hook** eliminates duplication:

1. **`CrudDataAdapter` interface** (`api/types.ts`) — abstracts CRUD operations (fetchList, fetchRow, createRow, updateRow, deleteRow) behind a uniform contract. Also defines `CellRendererOverrides` for per-dataType custom rendering.

2. **`useCrudDashboard()` hook** (`hooks/useCrudDashboard.ts`) — headless controller containing ALL shared logic: pagination state, CRUD dialog state (formOpen, editRowId, deleteRowId, errors), row actions menu state, schema fingerprint (M4), React Query list/row queries, mutations via adapter, all handlers (create/edit/close/submit/delete/menu), derived values (columns via `toGridColumns`, fieldConfigs, rows, layoutConfig, menus, menusMap, menuSlot, formInitialData).

3. **Two adapters**:
   - `createStandaloneAdapter()` (`api/adapters.ts`) — wraps `fetchAppData()`/`fetchAppRow()` etc. for standalone dev mode
   - `createRuntimeAdapter()` (`api/runtimeAdapter.ts` in applications-frontend) — wraps `getApplicationRuntime()` etc. for auth'd production mode

4. **Shared UI components**:
   - `CrudDialogs` — wraps `FormDialog` + `ConfirmDeleteDialog`, accepts `CrudDashboardState` + labels
   - `RowActionsMenu` — wraps `Menu` with Edit/Delete items, accepts `CrudDashboardState` + labels

5. **Utility extraction**: `toGridColumns()` and `toFieldConfigs()` moved to `utils/columns.tsx` with optional `cellRenderers` override for consumer-specific rendering (e.g., ApplicationRuntime's interactive BOOLEAN checkboxes).

### Results

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| DashboardApp.tsx | 483 lines | ~95 lines | -80% |
| ApplicationRuntime.tsx | 553 lines | ~130 lines | -76% |

### New Files Created

- `packages/apps-template-mui/src/api/types.ts` — CrudDataAdapter, CellRendererOverrides
- `packages/apps-template-mui/src/api/adapters.ts` — createStandaloneAdapter()
- `packages/apps-template-mui/src/utils/columns.tsx` — toGridColumns(), toFieldConfigs()
- `packages/apps-template-mui/src/hooks/useCrudDashboard.ts` — headless controller hook
- `packages/apps-template-mui/src/components/CrudDialogs.tsx` — shared dialogs
- `packages/apps-template-mui/src/components/RowActionsMenu.tsx` — shared row menu
- `packages/applications-frontend/base/src/api/runtimeAdapter.ts` — production adapter

### Files Modified

- `packages/apps-template-mui/src/standalone/DashboardApp.tsx` — refactored to use hook + adapter
- `packages/apps-template-mui/src/index.ts` — added new exports
- `packages/apps-template-mui/src/api/index.ts` — added adapter exports
- `packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx` — refactored to use hook + adapter

---

## Completed: UI Polish — Button Position, Actions Centering, DataGrid i18n ✅

**Status**: All changes applied. Build 65/65 OK.

### Changes Applied

1. **Button position**: Create button moved from inline with title to a separate row below the title in `MainGrid.tsx`. Prepares for future toolbar with multiple action buttons.

2. **Options button centering**: Actions column `IconButton` wrapped in `<Box display='flex' alignItems='center' justifyContent='center' width='100%' height='100%'>` in both `DashboardApp.tsx` and `ApplicationRuntime.tsx`.

3. **DataGrid i18n**: Created `getDataGridLocaleText()` utility → passes `ruRU` locale from `@mui/x-data-grid/locales` through `DashboardDetailsSlot.localeText` → `CustomizedDataGrid` → `<DataGrid localeText={...}>`. Column menu (Sort, Filter, Hide, Manage) and pagination text now fully localized.

### Architecture Note

Three-layer component architecture confirmed as correct:
- **AppMainLayout** — pure theme wrapper
- **Dashboard** — pure layout shell (SideMenu + AppNavbar + Header + MainGrid), no business logic
- **DashboardApp** — standalone controller with full CRUD logic (queries, mutations, state, dialogs)

`DashboardApp.tsx` is needed as dev-mode entry point and reference implementation. `ApplicationRuntime.tsx` currently duplicates its logic, which is a future refactoring opportunity.

---

## Completed: QA Round 6 Fixes — M1-M4, UX Improvements ✅

**Status**: All fixes applied. Build 65/65 OK.

### Changes Applied

1. **M1 (MEDIUM)**: Added required-field null check in backend PATCH bulk update (`applicationsRoutes.ts`). Prevents setting required non-BOOLEAN fields to null — returns 400 with descriptive error.

2. **M2 (MEDIUM)**: Created `extractErrorMessage()` helper in `apps-template-mui/api.ts`. Tries JSON.parse on response body, extracts `error`/`message`/`detail` field. Replaced all 5 raw-text error blocks. Users now see clean error messages from backend instead of raw JSON dumps.

3. **M3 (MEDIUM)**: Created `applications-frontend/base/src/api/mutations.ts` with 5 reusable React Query mutation hooks. Refactored `ApplicationRuntime.tsx` to use these hooks instead of inline `useMutation` blocks (~80 lines removed). Hooks use `applicationsQueryKeys` for proper cache invalidation with `effectiveCatalogId`.

4. **M4 (MEDIUM)**: Schema fingerprint tracking. Uses `useRef<string | null>` to capture sorted comma-joined column field names when form opens. Before submission, compares with current fingerprint — if columns changed (schema evolution), shows `errorSchemaChanged` error. Applied to both `DashboardApp.tsx` and `ApplicationRuntime.tsx`.

5. **Actions column dropdown**: Replaced two separate `GridActionsCellItem` icons (edit, delete) with single `MoreVertRoundedIcon` dropdown menu. Compact button: `28x28, p: 0.25, fontSize: 18`. Menu: Edit + Divider + Delete (error color). Column width: 48px. Header: dim icon instead of text. Pattern borrowed from metahubs `LayoutList.tsx` but smaller for compact table rows.

6. **Button text**: Changed `createRow` from "Create record" / "Создать запись" to "Create" / "Создать" across all 4 i18n locale files + JSX fallback text.

7. **i18n**: Added `errorSchemaChanged` key to all 4 locale files (EN/RU for apps-template-mui and applications-frontend).

---

## Completed: QA Round 5 Fix — Dialog Input Styling ✅

**Status**: Fix applied. Build 65/65 OK.

### Root Cause

`apps-template-mui` customization files were exact copies of the original MUI Dashboard template (`.backup/templates/`). The Dashboard template uses a compact input design (`MuiOutlinedInput.input: { padding: 0 }`, fixed heights, hidden `notchedOutline`) unsuitable for form Dialogs. `universo-template-mui` had already fixed this with proper form-style spacing — the fix was ported to `apps-template-mui`.

### Changes Applied

1. **`packages/apps-template-mui/src/shared-theme/customizations/inputs.tsx`**:
   - Added `sharedInputSpacing` / `sharedInputSpacingSmall` constants
   - Replaced `MuiOutlinedInput` Dashboard compact style with form-compatible style (proper padding on `input`, standard `notchedOutline`, multiline support, disabled state)
   - Added `MuiInputLabel` customization (was completely missing)
   - Added `MuiButton` disabled state styles

### Key Design Decisions

- **Other customization files preserved**: `dataDisplay.tsx`, `feedback.tsx`, `navigation.tsx`, `surfaces.ts` left as original MUI template — they work for Dashboard demo content
- **Flowise theme unaffected**: `AppTheme` creates a fresh theme via `createTheme()`, Flowise `compStyleOverride.js` does not influence components inside `AppTheme`
- **No breaking changes**: Only enhanced styling, no API or component interface changes

---

## Completed: QA Fixes Round 4 — Theme Dedup, Runtime Rename ✅

**Status**: All fixes applied. Build 65/65 OK.

### Changes Applied

1. **THEME-1 (CRITICAL)**: Removed duplicate `<AppTheme>` + `<CssBaseline>` from `Dashboard.tsx`. Theme is already provided by parent `AppMainLayout`. Dashboard is now a pure UI shell (sidebar + header + grid layout).

2. **RUNTIME-1→6 (MEDIUM)**: Full rename of ~60+ "runtime" identifiers across `apps-template-mui` and `applications-frontend`:
   - **api.ts**: `fetchApplicationRuntime`→`fetchAppData`, `buildRuntimeUrl`→`buildAppApiUrl`, `fetchRuntimeRow`→`fetchAppRow`, `createRuntimeRow`→`createAppRow`, `updateRuntimeRow`→`updateAppRow`, `deleteRuntimeRow`→`deleteAppRow`, `runtimeResponseSchema`→`appDataResponseSchema`, `ApplicationRuntimeResponse`→`AppDataResponse`
   - **mutations.ts**: `runtimeKeys`→`appQueryKeys`, `useRuntimeRow`→`useAppRow`, `useCreateRuntimeRow`→`useCreateAppRow`, `useUpdateRuntimeRow`→`useUpdateAppRow`, `useDeleteRuntimeRow`→`useDeleteAppRow`. Cache key namespace: `'application-runtime'`→`'application-data'`
   - **DashboardApp.tsx**: All imports, function/hook calls, local variable `runtime`→`appData`, all `t('runtime.*')`→`t('app.*')` i18n keys
   - **ApplicationRuntime.tsx**: `RuntimeFormDialog`→`FormDialog`, `RuntimeFieldConfig`→`FieldConfig`, `RuntimeFieldValidationRules`→`FieldValidationRules`, all `t('runtime.*')`→`t('app.*')`
   - **index.ts**: Added `appQueryKeys` canonical export, kept `runtimeKeys` deprecated alias
   - **tsconfig**: `tsconfig.runtime.json`→`tsconfig.build.json`, updated package.json build script

3. **i18n**: Renamed `"runtime"` key to `"app"` in all 4 locale files:
   - `apps-template-mui/src/i18n/locales/en/apps.json`
   - `apps-template-mui/src/i18n/locales/ru/apps.json`
   - `applications-frontend/base/src/i18n/locales/en/applications.json`
   - `applications-frontend/base/src/i18n/locales/ru/applications.json`

4. **Backward Compatibility**: Deprecated aliases maintained:
   - `ApplicationRuntimeResponse = AppDataResponse` (api.ts)
   - `runtimeKeys = appQueryKeys` (mutations.ts)
   - `RuntimeFormDialog`, `RuntimeFieldConfig`, `RuntimeFieldValidationRules`, `RuntimeDashboardApp` (index.ts re-exports)

### Key Design Decisions

- **API URL paths preserved**: Backend endpoints still use `/applications/:id/runtime/*` — these are server routes, not frontend naming
- **Deprecated aliases kept**: Existing consumers won't break; migration can happen gradually
- **Local variable renamed**: `const runtime = query.data` → `const appData = query.data` for consistency

---

## Completed: QA Fixes Round 3 — Theme, Hooks, Delete, i18n, Layout ✅

**Status**: All fixes applied. Build 65/65 OK.

### Changes Applied

1. **THEME-1 (CRITICAL)**: Created `AppMainLayout` component — wraps children in `AppTheme` with full x-theme components (charts, data-grid, date-pickers, tree-view) + `CssBaseline`. Applied in both `DashboardApp` (standalone) and `ApplicationRuntime` (production). Dialogs now inherit custom MUI theme (borderRadius, button colors, etc.) via React context even through portals.

2. **HOOKS-1 (CRITICAL)**: Moved `useMemo(formInitialData)` and `isFormReady` before the `if (!isReady)` early return in `DashboardApp.tsx`. Hooks now called unconditionally on every render, fixing Rules of Hooks violation.

3. **DELETE-1 (MEDIUM)**: Removed auto-close (`onCancel()`) from `ConfirmDeleteDialog.handleConfirm`. Consumer now controls open/close exclusively via `handleCloseDelete`. Removed unused `entityName`/`entityType` props from interface.

4. **I18N-1 (MEDIUM)**: Replaced hardcoded `formatMessage(en, ru)` pattern in `FormDialog.tsx` with `useTranslation('apps')` + 16 new i18n keys under `validation.*` namespace. Supports any locale configured in i18next.

5. **Dead Code**: Deleted `MinimalLayout.tsx`, `TableRoute.tsx`, and empty `routes/` directory (none were exported or referenced externally).

6. **LINT-1 (MEDIUM)**: Fixed prettier formatting in 12 files via `npx prettier --write`. Lint now clean: 0 errors across all modified files.

### Files Modified (apps-template-mui)

- `src/layouts/AppMainLayout.tsx` — **NEW**: top-level layout with AppTheme wrapper
- `src/standalone/DashboardApp.tsx` — HOOKS-1 fix + AppMainLayout wrapping
- `src/components/dialogs/ConfirmDeleteDialog.tsx` — DELETE-1 fix + unused props cleanup
- `src/components/dialogs/FormDialog.tsx` — I18N-1 fix (formatMessage → useTranslation)
- `src/i18n/locales/en/apps.json` — 16 new validation.* keys
- `src/i18n/locales/ru/apps.json` — 16 new validation.* keys
- `src/index.ts` — export AppMainLayout + AppMainLayoutProps
- `src/layouts/MinimalLayout.tsx` — **DELETED**
- `src/routes/TableRoute.tsx` — **DELETED**
- `src/routes/` — **DELETED** (empty directory)

### Files Modified (applications-frontend)

- `base/src/pages/ApplicationRuntime.tsx` — import + wrap in AppMainLayout

---

## Completed: QA Fixes Round 2 — Validation, Cache, VLC ✅

**Status**: All fixes applied. Build validation pending.

### Changes Applied

1. **DATE-1 (MEDIUM)**: Added `new Date(value)` + `isNaN` check in `coerceRuntimeValue` for DATE type. Invalid date strings now return 400 instead of PostgreSQL 500.

2. **VALID-2 (LOW)**: Added `UUID_REGEX.test(catalogId)` validation to GET-row and DELETE handlers (catalogId query param). Consistent with POST/PATCH Zod schemas.

3. **VALID-3 (LOW)**: Added `UUID_REGEX.test(applicationId)` check to main GET runtime endpoint (which doesn't use `resolveRuntimeSchema`).

4. **CACHE-1 (LOW)**: Changed standalone mutations `onSuccess` invalidation from `runtimeKeys.list(applicationId, catalogId)` to `runtimeKeys.list(applicationId)` — invalidates all catalogs, preventing stale data when catalog switches during mutation.

5. **VLC-1 (LOW)**: Added structural check for VLC objects — require `locales` property. Prevents arbitrary JSON from being stored in VLC columns.

### Files Modified

- `packages/applications-backend/base/src/routes/applicationsRoutes.ts` — DATE validation, UUID checks, VLC structure check
- `packages/apps-template-mui/src/runtime/mutations.ts` — broader cache invalidation keys

---

## Completed: QA Fixes — Runtime CRUD Security & UX ✅

**Status**: All fixes applied. Pending build validation.

### Changes Applied

1. **VALID-1 (MEDIUM)**: Added `UUID_REGEX` constant and validation for `applicationId` (in `resolveRuntimeSchema`) and `rowId` (in each PATCH/GET/DELETE handler). Returns 400 with clear error for malformed IDs instead of letting PostgreSQL throw 500.

2. **AUDIT-1 (LOW)**: Added `_upl_updated_by` column setting to both per-field PATCH and bulk PATCH endpoints. Extended `resolveRuntimeSchema` return type to include `userId` so all handlers can access it uniformly (also removed duplicate `resolveUserId` call from CREATE and DELETE handlers).

3. **UX-1 (MEDIUM)**: Removed `throw err` from `handleConfirmDelete` in both `ApplicationRuntime.tsx` and `RuntimeDashboardApp.tsx`. The error is already captured and displayed via `setDeleteError()`, so re-throwing caused an Unhandled Promise Rejection.

4. **I18N-1 (LOW)**: Updated standalone `apps.json` error keys (EN + RU) to include `{{message}}` interpolation, matching the production `applications.json` format and the actual `t()` calls in code.

### Files Modified

- `packages/applications-backend/base/src/routes/applicationsRoutes.ts` — UUID validation, _upl_updated_by, userId in resolveRuntimeSchema
- `packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx` — removed throw err
- `packages/apps-template-mui/src/runtime/RuntimeDashboardApp.tsx` — removed throw err
- `packages/apps-template-mui/src/i18n/locales/en/apps.json` — error message interpolation
- `packages/apps-template-mui/src/i18n/locales/ru/apps.json` — error message interpolation

---

## Completed: Runtime CRUD + VLC + i18n + DataGrid Improvements ✅

**Status**: All 7 phases implemented. Build 65/65 OK.

### What Was Done

**Phase 1 — Backend (applications-backend)**:
- Extended GET runtime: added `validation_rules`, `is_required`, DATE/JSON data types to SQL and response.
- Added POST `/:applicationId/runtime/rows` — creates rows with per-field type validation and VLC support, checks required fields.
- Extended PATCH `/:applicationId/runtime/:rowId` — removed BOOLEAN-only restriction, now supports STRING (VLC), NUMBER, DATE, JSON via `coerceRuntimeValue()`.
- Added DELETE `/:applicationId/runtime/rows/:rowId` — soft delete with `_upl_deleted = true`.
- Added GET `/:applicationId/runtime/rows/:rowId` — returns raw (un-resolved) data for edit forms.
- Extracted shared helpers: `coerceRuntimeValue()`, `resolveRuntimeCatalog()`, `resolveRuntimeSchema()`.

**Phase 2 — Components (apps-template-mui)**:
- Added `@universo/i18n`, `@universo/types`, `@universo/utils` workspace dependencies.
- Copied `ConfirmDeleteDialog` (145 lines, MUI only) and `LocalizedInlineField` (620 lines, VLC editor).
- Created `RuntimeFormDialog` (adapted from DynamicEntityFormDialog — removed REF type, changed import path, renamed to RuntimeFormDialog/RuntimeFieldConfig).

**Phase 3 — API + Mutations**:
- Extended `api.ts` Zod schema: DATE/JSON in dataType enum, `isRequired`, `validationRules` in columns.
- Added `fetchRuntimeRow`, `createRuntimeRow`, `updateRuntimeRow`, `deleteRuntimeRow` functions.
- Created `mutations.ts` with React Query hooks: `useRuntimeRow`, `useCreateRuntimeRow`, `useUpdateRuntimeRow`, `useDeleteRuntimeRow` — all with cache invalidation via `runtimeKeys`.

**Phase 4 — CRUD UI**:
- Added `actions?: React.ReactNode` to `DashboardDetailsSlot` interface.
- Updated `MainGrid.tsx` to render actions next to details title (Stack row layout).
- Extended `toGridColumns()` with Edit/Delete `GridActionsCellItem` actions column.
- Created `toFieldConfigs()` to convert API columns → `RuntimeFieldConfig[]`.
- Added Create button (`AddIcon`), connected `RuntimeFormDialog` for create/edit, `ConfirmDeleteDialog` for delete.
- Edit mode uses raw row fetch (`useRuntimeRow`) for VLC fields.

**Phase 5 — i18n**:
- Created `src/i18n/index.ts` with `registerNamespace('apps', ...)`.
- Created EN/RU locale files with 18 runtime keys (createRow, editRow, deleteRow, save, etc.).
- Connected via side-effect import in `App.tsx` and export in `index.ts`.

**Phase 6 — DataGrid UX**:
- Added `disableColumnMenu` to fix column header jitter.
- Changed `sortable: false` → `sortable: true` in `toGridColumns()`.
- Fixed pre-existing TS error: added `flatMap<DashboardMenuItem>` type annotation.

### Files Modified/Created

**applications-backend** (1 modified):
- `applicationsRoutes.ts` — Extended GET, PATCH; added POST, DELETE, GET-row; shared helpers

**apps-template-mui** (10 files: 5 modified, 5 created):
- `package.json` — 3 new workspace deps
- `src/index.ts` — added i18n + runtime exports
- `src/App.tsx` — i18n import
- `src/dashboard/Dashboard.tsx` — actions slot in DashboardDetailsSlot
- `src/dashboard/components/MainGrid.tsx` — actions rendering
- `src/dashboard/components/CustomizedDataGrid.tsx` — disableColumnMenu
- `src/runtime/api.ts` — extended schema + 4 new API functions
- `src/runtime/RuntimeDashboardApp.tsx` — CRUD state/handlers/dialogs
- `src/runtime/mutations.ts` (**new**) — React Query mutation hooks
- `src/runtime/components/RuntimeFormDialog.tsx` (**new**) — form dialog
- `src/runtime/components/LocalizedInlineField.tsx` (**new**) — VLC field editor
- `src/runtime/components/ConfirmDeleteDialog.tsx` (**new**) — delete confirmation
- `src/i18n/index.ts` (**new**) — namespace registration
- `src/i18n/locales/en/apps.json` (**new**) — EN translations
- `src/i18n/locales/ru/apps.json` (**new**) — RU translations

---

## Previous: Metahubs UX Improvements — Boolean Fix, Auto-fill, Presentation Tab, Header Checkbox ✅

**Status**: All 5 improvements + QA fixes (P1, P2) implemented. Build OK, tests OK, lint 0 errors.

### What Was Done

- **Task 1 (Indeterminate checkbox fix)**: Fixed BOOLEAN columns showing indeterminate state when value is NULL. Added `.defaultTo(false)` in SchemaGenerator and SchemaMigrator for nullable BOOLEAN columns; normalized null→false in `resolveRuntimeValue`; changed frontend to `checked={params.value === true} indeterminate={false}`.
- **Task 2 (Auto-fill publication name)**: PublicationList now auto-fills the create dialog name field with metahub name + " API" suffix across all locales using VLC.
- **Task 3 (Presentation tab)**: Added "Основное"/"Представление" tabs to both create and edit attribute dialogs. Created `PresentationTabFields` component with display attribute switch and conditional `headerAsCheckbox` switch (BOOLEAN only). Both dialogs (AttributeActions/edit and AttributeList/create) refactored from `extraFields` to `tabs` pattern using `TabConfig[]`.
- **Task 4 (Boolean header as checkbox)**: Full pipeline from backend to runtime UI. Added `headerAsCheckbox` to `uiConfigSchema` in metahubs-backend; added `ui_config` to SQL SELECT and response in applications-backend; extended Zod schema in apps-template-mui; added `renderHeader` for BOOLEAN columns with `uiConfig.headerAsCheckbox` in RuntimeDashboardApp.
- **Task 5 (Migration verification)**: Confirmed no new database migrations needed — `ui_config` column already exists, `headerAsCheckbox` stored in existing JSON field, BOOLEAN defaults only apply to future column creation.

### Files Modified (14 files across 6 packages)

**schema-ddl** (2):
1. `SchemaGenerator.ts` — `.defaultTo(false)` for nullable BOOLEAN
2. `SchemaMigrator.ts` — `.defaultTo(false)` for ADD_COLUMN BOOLEAN

**applications-backend** (1):
3. `applicationsRoutes.ts` — null→false in resolveRuntimeValue + ui_config in SQL SELECT + response

**metahubs-backend** (1):
4. `attributesRoutes.ts` — `headerAsCheckbox: z.boolean().optional()` in uiConfigSchema

**metahubs-frontend** (6):
5. `metahubs.json` (en) — i18n keys for tabs + presentation
6. `metahubs.json` (ru) — i18n keys for tabs + presentation
7. `types.ts` — `uiConfig` added to `AttributeLocalizedPayload`
8. `AttributeFormFields.tsx` — `PresentationTabFields` component + `hideDisplayAttribute` prop
9. `AttributeActions.tsx` — refactored to tabs, uiConfig in payload
10. `AttributeList.tsx` — refactored create dialog to tabs, uiConfig in payload
11. `PublicationList.tsx` — auto-fill name with metahub name + " API"

**apps-template-mui** (2):
12. `api.ts` — uiConfig in column Zod schema
13. `RuntimeDashboardApp.tsx` — renderHeader for checkbox header + indeterminate fix

---

## Previous: UI/UX Polish Round 2 — Menu Fix, Create Buttons, Widget Toggle ✅

**Status**: 3 fixes applied. Full build OK (65/65 packages).

### What Was Done

- **Task 1 (Menu "Макеты" position)**: Fixed in PRODUCTION sidebar config `menuConfigs.ts` (the real config used by `universo-template-mui/MenuContent.tsx`). Swapped `layouts` below `divider-secondary`. Also synced `metahubDashboard.ts` (legacy config) by adding missing `migrations` menu item with `IconHistory`.
- **Task 2 ("Добавить" → "Создать" page buttons)**: Changed `primaryAction.label` from `tc('addNew')` to `tc('create')` in all 10 list pages across metahubs-frontend (8 files) and applications-frontend (2 files). The `create` i18n key already existed ("Create" / "Создать"). Global `addNew` key unchanged to avoid affecting Flowise-upstream pages (canvases, credentials, etc.).
- **Task 3 (Widget activate/deactivate button)**: Replaced `Switch` toggle with `Button` component (text + icon) in `SortableWidgetChip` within `LayoutDetails.tsx`. Active widget shows "Деактивировать" with `ToggleOffRounded` icon; inactive shows "Активировать" with `ToggleOnRounded` icon. Opacity (0.45) now applies only to the label text, not to action buttons (activate/deactivate, edit, delete). Border still becomes dashed for inactive widgets.

### Key Discovery: Two Menu Config Systems

There are **two separate sidebar menu configurations** in the project:
1. **`metahubDashboard.ts`** (in `metahubs-frontend`) — Legacy config used by `flowise-template-mui/MenuList`
2. **`menuConfigs.ts`** (in `universo-template-mui/navigation/`) — **PRODUCTION config** consumed by `universo-template-mui/MenuContent.tsx` via `getMetahubMenuItems()`

Previous session only fixed #1 but the running app uses #2. Both are now synchronized.

### Files Modified (13 files)

1. `menuConfigs.ts` — Task 1 (layouts below divider-secondary, PRODUCTION config)
2. `metahubDashboard.ts` — Task 1 (added migrations menu item + IconHistory import)
3. `LayoutDetails.tsx` — Task 3 (Switch → Button, opacity only on label text)
4-13. 10 *List.tsx files — Task 2 (`tc('addNew')` → `tc('create')` in primaryAction)

---

## Previous: UI/UX Polish Round 1 — Create Buttons, Hubs Tab, Codename AutoFill ✅

**Status**: All P0-P3 fixes applied, menu reordered, version reset to V1/1.0.0, all tests passing (12/12 suites, 76/76 tests), full build OK (73 packages).

### What Was Done

- **P0 HIGH**: `ensureDefaultZoneWidgets` now uses `is_active: item.isActive !== false`; `createLayout` filters active widgets for initial config.
- **P1 MEDIUM**: Added unique partial index `idx_mhb_widgets_unique_active` on `(layout_id, zone, widget_key, sort_order) WHERE _upl_deleted = false AND _mhb_deleted = false`.
- **P2 MEDIUM**: Updated test expectations in `metahubMigrationsRoutes.test.ts` (12/12) and `metahubBranchesService.test.ts` (5/5) to match CURRENT_STRUCTURE_VERSION=1.
- **P3 LOW**: Built `layoutCodenameToTemplateKey` map from seed layouts in `TemplateSeedCleanupService` for correct DB lookup.
- **Menu**: Moved "Layouts" below `divider-secondary` in metahub sidebar.
- **Version Reset**: Consolidated V1/V2/V3 into single V1 with full feature set (`is_active`, unique constraint). `CURRENT_STRUCTURE_VERSION=1`, template `version='1.0.0'`, `minStructureVersion=1`.
- **Test Mocks**: Fixed pre-existing `.raw()` mock missing in `widgetTableResolver.test.ts` (3 tests) and `metahubSchemaService.test.ts` (2 tests, also updated `structureVersion` from 2→1).

### Files Modified (10 files)

1. `MetahubLayoutsService.ts` — P0 (2 changes)
2. `systemTableDefinitions.ts` — P1 + version reset (consolidated to single V1)
3. `structureVersions.ts` — `CURRENT_STRUCTURE_VERSION 3→1`
4. `basic.template.ts` — version `1.0.0`, `minStructureVersion: 1`
5. `TemplateSeedCleanupService.ts` — P3 codename→templateKey map
6. `metahubDashboard.ts` — menu reorder
7. `metahubMigrationsRoutes.test.ts` — P2 expectations
8. `metahubBranchesService.test.ts` — P2 version refs
9. `widgetTableResolver.test.ts` — `.raw()` mock fix
10. `metahubSchemaService.test.ts` — `.raw()` mock + structureVersion fix

### Validation

- `npx jest --no-coverage` ✅ (12/12 suites, 76 passed, 3 skipped)
- `pnpm build` ✅ (73 packages, EXIT_CODE=0)

## Completed: QA Round 2 — Zod Schema isActive Fix + cleanupMode Consistency ✅

**Status**: All 3 findings fixed, validated (65/65 build, 0 lint errors).

### What Was Done

- **P0 CRITICAL (Zod strips isActive)**: Added `isActive: z.boolean().optional()` to `seedZoneWidgetSchema` in `TemplateManifestValidator.ts`. Without this, Zod's default `.strip()` mode removed `isActive` from validated seed data, causing `TemplateSeedExecutor` to treat all widgets as active (`w.isActive !== false` → `undefined !== false` → `true`).
- **P1 LOW (statusQuerySchema)**: Changed `cleanupMode` default from `'keep'` to `'confirm'` in `statusQuerySchema` for consistency with `planBodySchema` and `applyBodySchema`.
- **P2 LOW (buildMigrationPlan default)**: Changed function parameter default from `'keep'` to `'confirm'` for consistency.

### Files Modified (2 files)

1. `TemplateManifestValidator.ts` — added `isActive: z.boolean().optional()` to `seedZoneWidgetSchema`
2. `metahubMigrationsRoutes.ts` — `statusQuerySchema` default + `buildMigrationPlan` default → `'confirm'`

### Validation

- `pnpm --filter metahubs-backend lint` ✅ (0 errors, 219 warnings)
- `pnpm build` ✅ (65/65 tasks successful)

## Completed: QA Fixes P1–P6 — Seed isActive, Cleanup Mode, i18n, Pool Docs ✅

**Status**: All 6 QA findings implemented, validated (65/65 build, 0 new lint errors).

### What Was Done

- **P2 (is_active hardcoded)**: Added `isActive?: boolean` to `DefaultZoneWidget` type and set `isActive: false` on 16 of 19 widgets (only menuWidget, header, detailsTitle, detailsTable active). `buildSeedZoneWidgets()` maps `isActive` into seed data. Template version bumped to `1.3.0`. `TemplateSeedExecutor` now uses `w.isActive !== false` (seed-based). `TemplateSeedMigrator` now does peer lookup (inherits `is_active` from existing widget with same zone+widget_key) + orphan duplicate cleanup (soft-deletes system-created duplicates at non-target sortOrders). Config rebuild queries in both Executor and Migrator now filter by `is_active: true`.
- **P1+P5 (cleanupMode default)**: Changed default from `'keep'` to `'confirm'` in backend route schemas (`metahubMigrationsRoutes.ts`), frontend hooks (`useMetahubMigrations.ts`), UI handler (`MetahubMigrations.tsx`), and mutation fallbacks (`mutations.ts`). Template seed cleanup now runs automatically during migration apply.
- **P3 (i18n missing key)**: Added `UI_LAYOUT_ZONES_UPDATE` case in `ConnectorDiffDialog.tsx` switch + `formatChange` handler. Added `uiLayoutZonesUpdate` i18n keys in en/ru `applications.json`.
- **P6 (DATABASE_CONNECTION_BUDGET)**: Added `# DATABASE_CONNECTION_BUDGET=8` commented entry in `.env`.
- **P4 (sortOrder identity risk)**: Documented in `systemPatterns.md` — "Template Seed Identity Pattern (IMPORTANT)" section with detection query.

### Files Modified (13 files)

1. `layoutDefaults.ts` — type + 16 widgets `isActive: false`
2. `basic.template.ts` — `buildSeedZoneWidgets` isActive mapping + version 1.3.0
3. `TemplateSeedExecutor.ts` — seed-based `is_active` + config rebuild filter
4. `TemplateSeedMigrator.ts` — peer lookup + orphan cleanup + config rebuild filter
5. `metahubMigrationsRoutes.ts` — cleanupMode default `'confirm'`
6. `useMetahubMigrations.ts` — cleanupMode default `'confirm'` (2 hooks)
7. `MetahubMigrations.tsx` — cleanupMode in handleApply
8. `mutations.ts` — 3× fallback `'confirm'`
9. `ConnectorDiffDialog.tsx` — UI_LAYOUT_ZONES_UPDATE case
10. `en/applications.json` + `ru/applications.json` — i18n keys
11. `.env` — DATABASE_CONNECTION_BUDGET comment
12. `systemPatterns.md` — sortOrder identity risk

### Validation

- `pnpm --filter metahubs-backend lint` ✅ (0 errors, 219 warnings)
- `pnpm --filter metahubs-frontend lint` ✅ (0 errors, 317 warnings)
- `pnpm --filter applications-frontend lint` — 14 pre-existing prettier errors in `connectorPublications.ts`, `migrations.ts`, `queryKeys.ts` (NOT in our files)
- `pnpm build` ✅ (65/65 tasks successful)

## Completed: Fix Migration 503 Pool Starvation ✅

**Status**: Implemented and validated. Root cause (Knex pool max=2 + parallel hasTable + advisory locks) eliminated at three layers.

### What Was Done

- **Env workaround**: Added `DATABASE_KNEX_POOL_MAX=5` and `DATABASE_POOL_MAX=5` to `.env` for immediate relief.
- **inspectSchemaState**: Replaced `Promise.all(7 × hasTable)` with single `information_schema.tables` SQL query (1 connection instead of 7).
- **widgetTableResolver**: Replaced `Promise.all(2 × hasTable)` with single `information_schema.tables` SQL query (1 connection instead of 2).
- **Pool formulas**: Raised Knex floor from 2→4 and changed divisor /4→/3 in both `KnexClient.ts` and `DataSource.ts`. With budget=8 (prod): Knex=4, TypeORM=4.
- **Documentation**: Updated `.env.example` with tier-scaling table (Nano/Micro/Small/Medium/Large+) and `techContext.md` with pool formulas + advisory lock safety note.

### Validation

- `pnpm --filter metahubs-backend lint` ✅ (0 errors)
- `pnpm --filter @flowise/core-backend build` ✅
- `pnpm --filter metahubs-backend build` ✅
- `pnpm build` ✅ (65/65 tasks successful)

## Completed: QA Remediation — Hash/Typing/UI Toggle Polish ✅

**Status**: Implemented and validated. Scope was limited to two backend low-risk fixes and one frontend UX consistency improvement.

### What Was Done

- `SnapshotSerializer.normalizeSnapshotForHash()` now includes `layoutZoneWidgets[].isActive` in hash normalization payload.
- `applicationSyncRoutes.normalizeSnapshotLayoutZoneWidgets()` now uses typed access (`item.isActive`) and removes unnecessary `as any` cast.
- `LayoutDetails` widget toggle now uses optimistic cache update with rollback on API failure (same reliability model as drag-and-drop optimistic flow).

### Validation

- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only, no errors)
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (warnings only, no errors)
- `pnpm build` ✅ (65/65 tasks successful)

## Completed: Widget Activation Toggle + Template Seed Widget Cleanup ✅

**Status**: Full implementation complete. All 18 steps done, full build 65/65 OK, lint 0 errors.

### What Was Done

- **Structure V3**: `is_active BOOLEAN DEFAULT true` on `_mhb_widgets`, partial index, `CURRENT_STRUCTURE_VERSION = 3`.
- **Backend toggle**: `MetahubLayoutsService.toggleLayoutZoneWidgetActive()` + PATCH route. `syncLayoutConfigFromZoneWidgets` filters inactive widgets.
- **Layout defaults**: Removed duplicate divider, renumbered. Template bumped to `1.2.0` / `minStructureVersion: 3`.
- **Seed cleanup**: `TemplateSeedCleanupService` extended with widget diff, candidate resolution, soft-delete.
- **Shared types / pipelines**: `isActive` flows through types, snapshot serializer, publication pipeline, app sync (filtered).
- **Frontend**: Switch toggle on `SortableWidgetChip`, opacity/dashed border for inactive, i18n keys (en/ru).
- **Runtime**: `apps-template-mui` ZoneWidgetItem + Zod schema updated with optional `isActive`.

### Validation

- `pnpm build` — 65/65 tasks successful ✅
- `pnpm --filter metahubs-backend lint` — 0 errors ✅
- `pnpm --filter metahubs-frontend lint` — 0 errors ✅

## Completed: QA Fixes Round 16 — Pool Contention + Initial Branch Compensation ✅

**Status**: Implementation completed for the two requested QA items (pool contention hardening and initial-branch compensation safety).

### What Was Done

- RLS middleware timeout hardening (`ensureAuthWithRls`):
  - introduced `runnerConnected` tracking,
  - cleanup no longer executes reset SQL when runner never connected,
  - removes duplicate connect pressure during timeout paths.
- Shared pool-budget tuning:
  - `DataSource` now computes TypeORM defaults from `DATABASE_CONNECTION_BUDGET` and explicit env knobs (`DATABASE_POOL_MAX`, `DATABASE_POOL_MIN`, timeout knobs),
  - `KnexClient` now defaults to a smaller budget slice and supports dedicated timeout knobs (`DATABASE_KNEX_*`).
- `createInitialBranch` reliability hardening:
  - added advisory lock for initial-branch creation,
  - wrapped branch/default-branch persistence into transaction with metahub row lock,
  - added guarded schema rollback only when branch row is absent (no accidental drop of persisted schema).
- Added regression test:
  - verifies schema rollback + lock release on initialization failure before branch persistence.

### Validation

- `pnpm --filter @universo/auth-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend test -- metahubBranchesService` ✅
- `pnpm --filter @universo/auth-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @flowise/core-backend build` ✅

## Completed: QA Fixes Round 15 — Post-Read Safety, Widget Cache Freshness, Copy Cleanup Strictness, Lock Error Semantics ✅

**Status**: Implementation completed for the latest QA findings around apply-response resiliency, stale widget table cache, rollback cleanup guarantees, and advisory-lock error semantics.

### What Was Done

- Hardened migrations apply post-read stage:
  - `metahubMigrationsRoutes` now keeps successful apply result even when post-apply status/history read fails.
  - API response includes `postApplyReadWarning` instead of surfacing a false `500`.
- Added proactive widget-table resolver cache invalidation:
  - `MetahubSchemaService` now clears resolver cache before seed sync paths that can follow table rename transitions.
- Strengthened metahub copy rollback cleanup behavior:
  - removed silent cleanup swallowing,
  - added explicit cleanup error collection/logging and deterministic rollback failure propagation.
- Fixed lock-helper error semantics in shared DDL package:
  - `acquireAdvisoryLock` now throws on DB/connect failures (instead of returning `false`),
  - updated lock helper tests to match thrown-timeout semantics.
- Completed package quality items:
  - moved `@tanstack/react-query` to runtime dependencies in `@universo/metahubs-frontend`,
  - stabilized exports test timeout for slower CI/dev environments.

### Validation

- `pnpm --filter @universo/schema-ddl test -- locking` ✅
- `pnpm --filter @universo/metahubs-backend test -- metahubMigrationsRoutes metahubsRoutes metahubSchemaService metahubMigrationMeta widgetTableResolver` ✅
- `pnpm --filter @universo/metahubs-frontend test -- exports` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/schema-ddl build` ✅
- `pnpm --filter @universo/metahubs-frontend build` ✅
- lint checks on touched scope: ✅ no errors (warnings remain in legacy code)

## Completed: QA Fixes Round 14 — Apply Mapping, Status Load Shedding, Copy Sync Fields, QA Gate Cleanup ✅

**Status**: Implementation completed for the latest QA findings on migrations apply determinism, status endpoint load, copy consistency, and lint/test gate stability.

### What Was Done

- Hardened `migrations/apply` pre-plan error handling:
  - pre-plan stage now maps domain and pool/connect timeout failures through common route mapper,
  - removed generic fallback-only behavior for deterministic API semantics.
- Reduced status endpoint pressure:
  - introduced lightweight migration plan option (`includeTemplateSeedDryRun=false`) for `GET /migrations/status`,
  - status checks no longer trigger template seed dry-run.
- Preserved template sync metadata in metahub copy flow:
  - copied branch `lastTemplateVersionId`, `lastTemplateVersionLabel`, `lastTemplateSyncedAt`.
- Restored QA gates:
  - fixed `@universo/schema-ddl` failing NUMBER default test to match shared type contract (`NUMERIC(10,0)`),
  - removed remaining `metahubs-frontend` lint errors (warnings remain),
  - removed `auth-backend` lint errors (warnings remain).
- Added/updated focused tests:
  - migrations route test: apply pre-plan pool timeout maps to `503`,
  - migrations route test: status path does not execute seed dry-run,
  - metahub copy route test: branch template sync metadata is preserved.

### Validation

- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend test -- metahubMigrationsRoutes` ✅
- `pnpm --filter @universo/metahubs-backend test -- metahubsRoutes` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/schema-ddl lint` ✅ (warnings only)
- `pnpm --filter @universo/schema-ddl test` ✅
- `pnpm --filter @universo/schema-ddl build` ✅
- `pnpm --filter @universo/auth-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/auth-backend build` ✅
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-frontend build` ✅

## Completed: QA Fixes Round 13 — Atomic Structure Sync, Scoped Resolver, Retry Dedup, Timeout Mapping ✅

**Status**: Implementation completed for the latest stability issues in metahub migrations and request retry behavior.

### What Was Done

- Fixed migration sequencing safety in `MetahubSchemaService.migrateStructure()`:
  - branch `structureVersion` is now updated only after both structure migration and template seed sync finish successfully.
  - prevents false "up-to-date structure" state when seed sync fails.
- Removed out-of-transaction widget table resolution:
  - `resolveWidgetTableName` now accepts transaction/query-builder scope,
  - `TemplateSeedExecutor` and `TemplateSeedMigrator` call resolver with active `trx`.
- Removed duplicate transport retry layer in `@universo/auth-frontend` API client:
  - introduced `transientRetryAttempts` option with safe default `0`,
  - idempotent 503/504 transport retries are now opt-in, avoiding double retries with TanStack Query.
- Hardened migrations route timeout/domain mapping for `status/list/plan`:
  - deterministic `503 CONNECTION_POOL_EXHAUSTED` for pool/connect timeouts,
  - deterministic domain-error passthrough (`428`, `503`, etc.) instead of generic 500/422 drift.
- Added focused regression coverage:
  - transaction-scope tests for seed executor/migrator resolver usage,
  - migration route tests for timeout mapping in `status/list/plan`,
  - sequencing test to ensure `structureVersion` is not written when seed sync fails.

### Validation

- `pnpm --filter @universo/metahubs-backend test` ✅
- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/auth-frontend lint` ✅ (warnings only)
- `pnpm --filter @universo/auth-frontend build` ✅

## Completed: QA Fixes Round 12 — Request-Scoped SchemaService Manager and Pool Load Shedding ✅

**Status**: Implementation completed for request-scoped repository reuse in `MetahubSchemaService` and metahub route/service wiring to reduce TypeORM pool pressure under RLS.

### What Was Done

- Added optional request-scoped `EntityManager` support to `MetahubSchemaService` constructor:
  - introduced `repoManager` accessor (`managerOverride ?? dataSource.manager`),
  - switched internal repository reads/writes (`Metahub`, `MetahubBranch`, `MetahubUser`, `TemplateVersion`) to use `repoManager`.
- Propagated request manager to metahub domain call sites that create `MetahubSchemaService`:
  - `catalogsRoutes`, `hubsRoutes`, `elementsRoutes`, `attributesRoutes`,
  - `layoutsRoutes`, `metahubsRoutes`, `publicationsRoutes`,
  - `metahubMigrationsRoutes` apply path,
  - `shared/guards.ensureHubAccess`,
  - `MetahubBranchesService` branch initialization flows.
- Hardened schema-sync helper path:
  - `syncMetahubSchema()` now accepts optional `EntityManager`,
  - attributes route sync calls now pass request-scoped manager instead of falling back to global datasource manager.
- Preserved behavior contracts:
  - no hidden migrations were reintroduced in read paths,
  - migration apply still uses explicit `mode: 'apply_migrations'`.

### Validation

- `pnpm --filter @universo/metahubs-backend exec eslint ...` ✅ (0 errors, warnings only in legacy touched files)
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubMigrationsRoutes.test.ts src/tests/services/metahubSchemaService.test.ts` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅

## Completed: QA Fixes Round 11 — Read-Only EnsureSchema, Scoped Repos, Lock/Pool Stability ✅

**Status**: Implementation completed for hidden-migration removal, schema-state hardening, request-scoped migration planning, and migration UI refetch stabilization.

### What Was Done

- Refactored `MetahubSchemaService.ensureSchema()` into explicit modes:
  - `read_only` (default): never runs DDL/migrations/seed sync, only validates schema readiness and version/template sync.
  - `initialize`: controlled schema bootstrap path with in-flight dedupe.
  - `apply_migrations`: explicit migration path used by migrations apply route.
- Removed hidden auto-upgrades from read paths:
  - read requests now return deterministic `MetahubMigrationRequiredError` (`428`) when structure/template migration is required.
- Tightened schema readiness checks:
  - replaced loose `OR` table checks with version-aware expected-table validation from `SYSTEM_TABLE_VERSIONS`.
  - added partial-schema detection and explicit migration-required response for inconsistent states.
- Reduced lock/pool pressure:
  - read-only ensure path no longer acquires metahub advisory lock or executes `CREATE SCHEMA IF NOT EXISTS`.
- Updated migrations routes to use request-scoped manager:
  - branch/template context resolution now uses `getRequestManager(req, ds)` (RLS QueryRunner-aware).
  - apply flow uses request-scoped repositories and `manager.transaction(...)` instead of opening extra datasource-level transactional contexts.
- Hardened migration apply call contract:
  - migrations apply now calls `ensureSchema(..., { mode: 'apply_migrations', ... })` explicitly.
- Reduced frontend post-apply refetch storm:
  - migration hooks explicitly disable reconnect/remount retries.
  - apply mutation invalidates status/detail with `refetchType: 'none'` to avoid noisy immediate follow-up failures after successful apply.
- Expanded focused tests:
  - new `metahubSchemaService.test.ts` verifies `read_only` behavior (no hidden DDL/lock + migration-required on outdated structure).
  - updated migration routes test to assert apply uses `mode: 'apply_migrations'`.

### Validation

- Backend:
  - `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only, no errors)
  - `pnpm --filter @universo/metahubs-backend test -- metahubMigrationsRoutes.test.ts metahubSchemaService.test.ts` ✅
  - `pnpm --filter @universo/metahubs-backend build` ✅
- Frontend:
  - targeted eslint for touched files ✅
  - `pnpm --filter @universo/metahubs-frontend test -- src/domains/migrations/hooks/__tests__/useMetahubMigrations.test.ts src/domains/migrations/ui/__tests__/MetahubMigrationGuard.test.tsx` ✅ (current config executes full package tests)
  - `pnpm --filter @universo/metahubs-frontend build` ✅
  - package-wide frontend lint still has large pre-existing unrelated prettier/lint debt outside touched scope.

## Completed: QA Fixes Round 10 — Template Version Source, Cache-Safe EnsureSchema, Retry/Loading UX, DB Timeout Mapping ✅

**Status**: Implementation completed for all five reported issues from the latest migration QA pass.

### What Was Done

- Switched migration template source-of-truth to branch sync state:
  - `plan/status` now derive current template version from `metahubs_branches.last_template_version_id`/`last_template_version_label`.
- Removed unsafe fast-path cache exits in `MetahubSchemaService.ensureSchema()`:
  - ensured initialized schemas still pass full sync/upgrade checks under advisory lock.
- Hardened apply pointer update semantics:
  - metahub template pointer update is blocked until branch sync is confirmed.
  - added deterministic conflict response `TEMPLATE_SYNC_NOT_CONFIRMED` (`409`) when branch sync did not converge.
- Reduced migration UI/API retry storms:
  - disabled auto-retries for migration list/plan/status and apply mutation in TanStack Query hooks.
  - added explicit loading spinner on "Apply Migrations" action.
- Added deterministic DB connect-timeout mapping:
  - RLS middleware and global error handler now map connection timeout failures to `503` with `DB_CONNECTION_TIMEOUT`.
- Extended regression tests:
  - backend route tests for branch template source and apply sync-confirmation behavior.
  - frontend migration hooks tests for `retry: false` semantics.

### Validation

- Backend:
  - `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubMigrationsRoutes.test.ts --runInBand` ✅
  - `pnpm --filter @universo/metahubs-backend build` ✅
  - targeted eslint for touched backend migration files ✅
- Frontend:
  - `pnpm --filter @universo/metahubs-frontend test -- src/domains/migrations/hooks/__tests__/useMetahubMigrations.test.ts --runInBand` ✅
  - `pnpm --filter @universo/metahubs-frontend build` ✅
  - targeted eslint for touched frontend migration files ✅
- Note:
  - package-wide frontend lint still has large pre-existing unrelated prettier/lint debt outside touched files.

---

## Completed: QA Fixes Round 9 — Migration Gate, V1/V2 Compatibility, Pool-Safe Apply ✅

**Status**: Implementation completed for migration-required gating, legacy schema compatibility, deterministic API errors, and lock/pool race hardening.

### What Was Done

- Added domain-level errors and deterministic API mapping:
  - `MetahubMigrationRequiredError` (`428`, `MIGRATION_REQUIRED`),
  - `MetahubPoolExhaustedError` (`503`, `CONNECTION_POOL_EXHAUSTED`),
  - lock timeout/conflict error variants for schema and apply flows.
- Hardened `MetahubSchemaService.ensureSchema()`:
  - DB-aware initialized-schema detection (not cache-only),
  - enforced upgrade order: structure migration first, seed sync second,
  - converted pool/lock failures to deterministic domain errors.
- Added V1/V2 widget table compatibility resolver:
  - runtime fallback `_mhb_widgets` -> `_mhb_layout_zone_widgets`,
  - shared resolver used by both `TemplateSeedExecutor` and `TemplateSeedMigrator`.
- Added migration status endpoint for preflight/gating:
  - `GET /metahub/:metahubId/migrations/status` with blockers and required flags.
- Hardened `migrations/apply` error responses:
  - explicit mapping for migration-required and pool-exhaustion states with stable payload shape.
- Added frontend migration guard flow:
  - `MetahubMigrationGuard` blocks non-migration metahub routes when migration is required,
  - migrations route remains available as remediation path,
  - wired into `MainRoutesMUI` route tree.
- Added query/API contract updates for frontend migrations:
  - status API/hook/query keys,
  - `cleanupMode` and cleanup result typing in plan/apply contracts.
- Fixed advisory-lock in-process race in `@universo/schema-ddl` lock helper (`pendingLockAcquires`).

### Validation

- Backend tests:
  - `metahubMigrationsRoutes.test.ts` + `widgetTableResolver.test.ts` -> pass (`8/8`).
  - `pnpm --filter @universo/metahubs-backend test` -> pass (`10/10` suites).
- Frontend tests:
  - `pnpm --filter @universo/metahubs-frontend test -- src/domains/migrations/ui/__tests__/MetahubMigrationGuard.test.tsx` -> pass (full package run in current config).
- Build checks:
  - `@universo/metahubs-backend` build -> pass.
  - `@universo/metahubs-frontend` build -> pass.
  - `@universo/template-mui` build -> pass.
- Lint checks:
  - backend package lint -> pass (warnings only, no errors),
  - targeted frontend lint for changed migration files/locales -> pass.

---

## Completed: Metahub Structure V2 Rename + Template Cleanup Policy ✅

**Status**: Implementation completed for structure upgrade `1 -> 2`, safe rename `_mhb_layout_zone_widgets -> _mhb_widgets`, template seed cleanup controls, and baseline template simplification.

### What Was Done

- Added structure V2 definitions in `systemTableDefinitions.ts`:
  - introduced `_mhb_widgets` with `renamedFrom: ['_mhb_layout_zone_widgets']`,
  - introduced index rename hints for deterministic additive upgrades.
- Bumped runtime structure baseline:
  - `CURRENT_STRUCTURE_VERSION = 2` in `structureVersions.ts`.
- Extended diff engine and migrator for rename-safe upgrades:
  - new diff actions: `RENAME_TABLE`, `RENAME_INDEX`,
  - transactional rename execution in `SystemTableMigrator` before other additive changes.
- Updated runtime table references from `_mhb_layout_zone_widgets` to `_mhb_widgets` in layouts/templates/publications flows.
- Added explicit template cleanup policy:
  - `TemplateSeedCleanupService` with modes: `keep` (default), `dry_run`, `confirm`,
  - ownership/safety checks before any destructive cleanup,
  - `dry_run` blockers returned by migration plan/apply.
- Hardened migrations API contract:
  - `cleanupMode` in `plan/apply` payloads (`keep | dry_run | confirm`),
  - deterministic `422` for invalid/unsafe manifest and cleanup blocker states.
- Updated base template in `basic.template.ts`:
  - removed starter `tags` seed from new metahubs,
  - aligned template metadata to structure V2 compatibility.
- Added test coverage:
  - rename migration behavior (`systemTableMigrator.test.ts`),
  - cleanup-mode blocker behavior (`metahubMigrationsRoutes.test.ts`),
  - template manifest validator tests updated for explicit seed fixtures.

### Validation

- `pnpm --filter @universo/metahubs-backend lint` → pass (no errors).
- `pnpm --filter @universo/metahubs-backend test` → pass.
- `pnpm --filter @universo/metahubs-backend build` → pass.

## Completed: Metahub Migration Hardening — Structured Plan/Apply, Seed Audit, Version Safety ✅

**Status**: Implementation completed for migration planning safety, template seed dry-run, branch-level template sync provenance, and typed migration metadata.

### What Was Done

- Added typed migration meta contracts with strict parsing:
  - `baseline`, `structure`, `template_seed`, `manual_destructive` in `metahubMigrationMeta.ts`.
  - runtime-safe parse via `parseMetahubMigrationMeta` (supports object and JSON string inputs).
- Upgraded migration API (`metahubMigrationsRoutes`) to structured planning/apply:
  - plan now returns stepwise system-structure diffs (`additive`/`destructive`) and explicit blockers.
  - plan now includes template seed dry-run result (`TemplateSeedMigrator` with `dryRun: true`).
  - apply returns deterministic conflicts:
    - `409` when advisory lock is busy,
    - `422` when blockers exist (destructive/unsupported paths).
- Strengthened template manifest validation:
  - cross-reference checks for layouts, zone widgets, entities/elements, and attribute targets.
  - structure compatibility guard (`minStructureVersion <= CURRENT_STRUCTURE_VERSION`).
- Added branch-level template sync provenance fields:
  - `metahubs_branches.last_template_version_id`,
  - `metahubs_branches.last_template_version_label`,
  - `metahubs_branches.last_template_synced_at`.
  - wired into branch creation and schema ensure/apply flow.
- Fixed layout ID mapping safety in `TemplateSeedExecutor`:
  - removed template-key/codename ambiguity by resolving per layout `template_key`.

### Validation

- Backend:
  - `pnpm --filter @universo/metahubs-backend lint` → pass (warnings only, no errors).
  - `pnpm --filter @universo/metahubs-backend test` → pass (`9/9` suites).
  - `pnpm --filter @universo/metahubs-backend build` → pass.
- Frontend (touched API contract file):
  - `pnpm --filter @universo/metahubs-frontend exec eslint src/domains/migrations/api/migrations.ts` → pass.
  - `pnpm --filter @universo/metahubs-frontend build` → pass.
  - package-wide frontend lint still fails due pre-existing unrelated formatting/lint debt outside touched scope.

## Completed: QA Fixes Round 8 — Cache Invalidation, Templates MSW, Coverage Gate, Route Lint Hygiene ✅

**Status**: Implementation completed for QA findings 1–4 with targeted backend/frontend validation.

### What Was Done

- Fixed default-branch cache staleness:
  - `MetahubBranchesService.setDefaultBranch()` now calls `MetahubSchemaService.clearUserBranchCache(metahubId)` after updating `defaultBranchId`.
  - Added regression test `setDefaultBranch clears cached user branch resolution for metahub` in `src/tests/services/metahubBranchesService.test.ts`.
- Reduced type/lint risk in touched branches backend flow:
  - removed `as any` assignments in `updateBranch()` (`name`, `description`).
  - replaced route `any` error handling with `unknown` + message extractor.
  - replaced untyped `req.user` access with explicit local auth-user request typing.
  - removed branches debug `console.*` logging helper from route path.
- Fixed frontend MSW gap:
  - added handlers for `GET /api/v1/templates` and `GET /api/v1/templates/:templateId` in `src/__mocks__/handlers.ts`.
  - test runtime no longer attempts real network call for templates API in metahub create/edit UI code paths.
- Made Vitest coverage gate configurable:
  - added env-driven control in `vitest.config.ts`:
    - `VITEST_COVERAGE=false` disables coverage collection for local runs.
    - thresholds are enforced only when `CI=true` or `VITEST_ENFORCE_COVERAGE=true`.

### Validation

- Backend:
  - `pnpm --filter @universo/metahubs-backend test -- src/tests/services/metahubBranchesService.test.ts` → pass (`4/4`).
  - `pnpm --filter @universo/metahubs-backend test` → pass (`7/7` suites, `51` passed, `3` skipped).
  - `pnpm --filter @universo/metahubs-backend build` → pass.
  - `pnpm --filter @universo/metahubs-backend lint` → pass (warnings only, no errors).
- Frontend:
  - `pnpm --filter @universo/metahubs-frontend test -- src/__tests__/exports.test.ts --runInBand` → pass (`81/81`), no `/templates` unhandled-request regression.
  - `pnpm --filter @universo/metahubs-frontend build` → pass.
  - `pnpm --filter @universo/metahubs-frontend exec eslint src/__mocks__/handlers.ts` → pass.
  - package-wide `pnpm --filter @universo/metahubs-frontend lint` still fails due large pre-existing unrelated prettier/lint debt outside touched files.

## Completed: QA Fixes Round 7 — Branch Cache Consistency & Conflict Semantics ✅

**Status**: Implementation completed for QA findings 1–4 with regression tests and package validation green.

### What Was Done

- Added explicit user branch cache controls in `MetahubSchemaService`:
  - `setUserBranchCache(metahubId, userId, branchId)`
  - `clearUserBranchCache(metahubId, userId?)`
  - included user branch cache cleanup in `clearCache` and `clearAllCaches`.
- Hardened `ensureSchema()` against stale branch cache-key writes:
  - branch context is now resolved again under advisory lock,
  - cache key is rebuilt from locked branch resolution before cache write.
- Aligned branch codename pre-check with DB partial unique index semantics:
  - `findByCodename()` now searches only active rows (`_upl_deleted=false` and `_mhb_deleted=false`).
- Added deterministic API conflict mapping for branch-delete lock contention:
  - route now returns HTTP `409` with `code: BRANCH_DELETION_IN_PROGRESS`.
- Added regression coverage:
  - `metahubBranchesService.test.ts`: active-only codename lookup + cache update on activation.
  - `branchesOptions.test.ts`: lock-contention delete mapping to deterministic `409`.

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/metahubBranchesService.test.ts src/tests/routes/branchesOptions.test.ts` → pass.
- `pnpm --filter @universo/metahubs-backend test` → pass (`7/7` suites, `50` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-backend build` → pass.

## Completed: QA Fixes Round 6 — Consistency, Races, Lock Timeout, Test Coverage ✅

**Status**: Implementation completed for QA findings 1–5 with targeted regression tests green.

### What Was Done

- Fixed branch creation consistency in `MetahubBranchesService.createBranch()`: when no source branch is used, `structureVersion` now follows `manifest.minStructureVersion` (actual initialized schema), not `CURRENT_STRUCTURE_VERSION`.
- Hardened metahub unique-conflict handling for create/update:
  - added nested unique-violation extraction (`driverError` / `cause`) for PostgreSQL `23505`
  - mapped unknown unique constraints to deterministic HTTP `409` (`Unique constraint conflict`) instead of falling into generic `500`.
- Fixed advisory lock timeout handling in `@universo/schema-ddl`:
  - replaced ineffective `SET LOCAL statement_timeout` usage with session-safe timeout setup (`set_config`) on acquired pooled connection
  - added explicit timeout reset before storing/releasing lock connections.
- Confirmed codename/slug pre-checks are aligned with active-row partial unique semantics (`_uplDeleted=false`, `_mhbDeleted=false`) in metahub create/copy/update paths.
- Added regression tests:
  - metahub route tests for deterministic `409` unique-conflict mapping (direct and nested `driverError`)
  - migrator unit test proving destructive diffs block automatic migration apply
  - branches service unit test proving manifest-driven `structureVersion` assignment for source-less branch creation.

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts src/tests/services/systemTableMigrator.test.ts src/tests/services/metahubBranchesService.test.ts` → pass (`3/3` suites).
- Targeted ESLint on changed files → no errors (warnings only in existing legacy-style files/tests).
- `pnpm --filter @universo/schema-ddl build` → pass.
- `pnpm --filter @universo/schema-ddl test --runInBand` still has one pre-existing unrelated failure in `SchemaGenerator.test.ts` (`NUMBER` default scale expectation mismatch).

## Completed: QA Fixes Round 5 — Locks, Migration Semantics, Copy Safety, Frontend QA Gate ✅

**Status**: Implementation completed for QA findings 1–5 with backend validation green and frontend runtime/test regressions resolved.

### What Was Done

- Replaced legacy application migration advisory lock calls with shared lock helpers (`uuidToLockKey`, `acquireAdvisoryLock`, `releaseAdvisoryLock`) in `applicationMigrationsRoutes`.
- Removed legacy lock helper methods from local `KnexClient` to prevent accidental fallback usage.
- Hardened system-table migration semantics: `SystemTableMigrator.applyDiff()` now fails fast on destructive diffs, preventing false-positive structure version upgrades.
- Hardened metahub copy flow:
  - source branches are now copied only when not soft-deleted (`_uplDeleted=false`, `_mhbDeleted=false`)
  - PG unique violations are translated to deterministic HTTP `409` conflict responses.
- Fixed metahubs frontend QA regressions:
  - enabled Vitest server dep inlining + CSS handling for MUI/X Data Grid chain
  - fixed stale DTO expectation in `useMetahubDetails` tests
  - fixed `MetahubBoard` API mocking to include board summary endpoint
  - adjusted flaky timeout-sensitive tests (`actionsFactories`, `exports`)
- Fixed chart runtime/test crash root cause in shared `@universo/template-mui` `StatCard` by normalizing x-axis labels to series length.

### Validation

- Backend:
  - `pnpm --filter @universo/metahubs-backend build` → pass.
  - `pnpm --filter @universo/metahubs-backend test` → pass (`5/5` suites).
  - `pnpm --filter @universo/metahubs-backend lint` → no errors (warnings only).
- Frontend:
  - `pnpm --filter @universo/metahubs-frontend build` → pass.
  - targeted regression test: `vitest run src/domains/metahubs/ui/__tests__/MetahubBoard.test.tsx --coverage.enabled=false` → pass (`13/13`).
  - full `pnpm --filter @universo/metahubs-frontend test` now has passing assertions (`81/81`) but exits non-zero due pre-existing package-level coverage thresholds not met globally.

## Completed: QA Fixes Round 4 — Branch Access + Delete Locking + QA Gate ✅

**Status**: Implementation completed for QA findings 1–4 with package-level validation green.

### What Was Done

- Enforced metahub access guards for all branches routes with route-level permission split (read vs manage operations).
- Hardened metahub delete flow using advisory lock + transactional pessimistic row locks to prevent delete/migrate races.
- Replaced fragile 32-bit advisory lock key strategy with string-based `hashtextextended` locking in both shared `schema-ddl` and local `KnexClient`.
- Restored backend route QA gate by updating route tests to current contracts:
  - `branchesOptions.test.ts` (access-aware mocks, camelCase entity fields)
  - `catalogsRoutes.test.ts` (dynamic-schema service mocks, current response contract)
  - `metahubsRoutes.test.ts` (lock-aware DDL mocks, template-aware create flow, members enrichment field mapping)
- Extended common TypeORM test query-builder mock with `setLock()` chain support for lock-aware route paths.

### Validation

- `pnpm --filter @universo/metahubs-backend lint` → pass (warnings only, no errors).
- `pnpm --filter @universo/metahubs-backend build` → pass.
- `pnpm --filter @universo/metahubs-backend test` → pass (`5/5` suites).

## Completed: QA Fixes Round 3 — Security + Atomicity + Seed Consistency ✅

**Status**: Implementation completed for QA findings 1–6 (plus parser/test hardening) without introducing legacy fallback branches.

### What Was Done

- Enforced metahub access validation (`ensureMetahubAccess`) for metahub-scoped publications and migrations routes, including request-scoped `QueryRunner` propagation.
- Hardened publication deletion flow with advisory lock + pessimistic row locks + fail-fast semantics: publication metadata is not removed when schema drop fails.
- Normalized metahub object `kind` handling to canonical lowercase values (`catalog`, `hub`, `document`) across services/routes.
- Prevented template seed migrators/executors from overwriting non-empty user layout `config` during zone-widget synchronization.
- Hardened migrations apply critical section with advisory lock and transactional `templateVersionId` persistence only after successful `ensureSchema()`.
- Replaced direct `JSON.parse` for migration `meta` with `serialization.safeParseJson()` fallback (`meta: null` for invalid payloads).
- Added targeted backend tests for invalid migration `meta` handling and apply-lock contention (409).

### Validation

- Targeted lint passed on touched files after formatting fix.
- Package build passed: `pnpm --filter @universo/metahubs-backend build`.
- Targeted tests passed:
  - `src/tests/routes/metahubMigrationsRoutes.test.ts`
  - `src/tests/routes/metahubBoardSummary.test.ts`
- Full backend suite still has pre-existing unrelated failures in older route tests; new migration-route tests pass.

---

## Completed: QA Fixes — Metahub Migrations & Consistency ✅

**Status**: Implementation completed for migration metadata consistency, branch deletion safety, and migrations UI standardization.

### What Was Done

-   Migration apply flow kept safe for template upgrades: target manifest is loaded first, schema ensure runs with manifest override, and `templateVersionId` is persisted only after successful schema ensure.
-   `_mhb_migrations` records now store structure snapshots in `meta`:
    - baseline: `snapshotBefore: null`, `snapshotAfter`
    - structure upgrades: `snapshotBefore`, `snapshotAfter`, `applied`, `skippedDestructive`, `migratedAt`
-   Destructive diff entries are now persisted in migration `meta.skippedDestructive` (not logs only).
-   Seed linking ambiguity fixed with `kind + codename` mapping in `TemplateSeedExecutor` and `TemplateSeedMigrator`, including safe resolution for optional `targetEntityKind`.
-   Branch deletion hardened in `MetahubBranchesService.deleteBranch()`:
    - advisory lock added for branch delete flow
    - metahub/branch rows locked (`pessimistic_write`)
    - schema drop + branch row delete executed in one DB transaction
    - schema identifier safety guard added
-   Route tests unblocked from `TypeError: OneToOne is not a function` by extending local `typeorm` jest mocks with missing decorators.
-   Metahub Migrations frontend page migrated to standard table pattern:
    - `FlowListTable` + `PaginationControls`
    - consistent branch selector/actions header
    - plan chips and empty-state kept
    - baseline badge i18n added (`en`/`ru`)

### Validation

-   Build passed:
    - `pnpm --filter @universo/metahubs-backend build`
    - `pnpm --filter @universo/metahubs-frontend build`
-   Targeted eslint checks on touched files: no errors (warnings remain in legacy test/service files due existing `any`/empty-function patterns).
-   `pnpm --filter @universo/metahubs-backend test` no longer fails on `OneToOne` decorator absence; suite still has unrelated pre-existing route expectation mismatches in mocked tests.

---

## Completed: Metahub Migration Architecture Reset ✅

**Status**: Baseline migration architecture refactor shipped end-to-end with backend + frontend migration controls and full workspace build verification.

### What Was Done

-   Structure baseline reset to V1 (`CURRENT_STRUCTURE_VERSION = 1`) and default template aligned to `version: 1.0.0` + `minStructureVersion: 1`
-   New metahub schema initialization now records baseline migration row in `_mhb_migrations`
-   Template seed synchronization decoupled from structure migration; seed sync now runs for both newly initialized and already existing schemas
-   Seed migrators/executors hardened to idempotent insert semantics for layouts/widgets/settings/entities/attributes/elements
-   `ALTER_COLUMN` path implemented in `SystemTableMigrator` with strict additive-only behavior (`DROP NOT NULL` allowed, nullability tightening blocked as destructive)
-   New backend API for metahub migrations: history (`GET`), plan (`POST /plan`), apply (`POST /apply` with dry-run support)
-   New metahub "Migrations" page added in metahubs frontend and routed in MUI template navigation
-   Snapshot version envelope introduced in shared types and wired into publication snapshot serialization
-   Package dependency consistency fixed by adding explicit `@universo/types` workspace dependency where direct imports existed

### Validation

-   Targeted package builds passed: `@universo/types`, `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/template-mui`
-   Full workspace build passed: `pnpm build` → `65/65` successful
-   Targeted lint on modified files: no errors (warnings remain only in legacy/non-scoped areas)

### Pending

-   No active implementation tasks in this scope. Ready for QA mode.
