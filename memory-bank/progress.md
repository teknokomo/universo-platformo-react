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

- **Menu fix**: Fixed "Макеты" menu position in PRODUCTION config (`menuConfigs.ts` in `universo-template-mui`). Previous fix was in legacy config only. Also synced `metahubDashboard.ts` with missing migrations item.
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

### Round 9: Migration Gate, V1/V2 Compatibility, Pool-Safe Apply
- DB-aware `ensureSchema()` with strict order: structure migration → seed sync.
- V1/V2-compatible widget table resolver for both `_mhb_widgets` and `_mhb_layout_zone_widgets`.
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

## 2026-02-11: QA Rounds 3-8, Structure V2, Template Cleanup ✅

### Structure V2 Rename + Template Cleanup Policy
- `_mhb_widgets` table rename from `_mhb_layout_zone_widgets`, `CURRENT_STRUCTURE_VERSION=2`.
- Diff engine emits `RENAME_TABLE` and `RENAME_INDEX` operations via `renamedFrom` metadata.
- Migrator executes rename transactionally before other additive changes.
- `TemplateSeedCleanupService` with modes `keep`/`dry_run`/`confirm` + ownership safety checks.
- Removed starter `tags` catalog from `basic.template.ts` for new metahubs.
- Added regression tests for V1→V2 rename and cleanup blocker behavior.

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
