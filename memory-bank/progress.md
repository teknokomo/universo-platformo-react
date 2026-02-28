# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢 | Headless Controller, Application Templates, Enumerations |
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

## Publication Drill-In Feature — Consolidated (2026-02-28)

Full implementation of Publications drill-in navigation with inner tabs (Versions, Applications), replacing the previous flat list + modal-edit approach.

### UX Polish Round 2 (5 fixes)
- Link colors matched catalog pattern: `color: 'inherit'`, underline + `primary.main` on hover
- Actions column: removed custom column, used FlowListTable `renderActions` prop (10% width, centered)
- Pagination: client-side page/pageSize state + PaginationControls for Versions and Applications
- App name URLs: fixed from `/application/${slug}` to `/a/${id}` (new tab)
- App menu URLs: "Open application" → `/a/${id}`, "Dashboard" → `/a/${id}/admin` (window.open)

### UX Polish Round 1 (8 tasks)
- Publication name as drill-in link to `/publication/:id/versions`
- Breadcrumbs: removed UUID fallback, added tab suffix (Versions/Applications)
- ViewHeader: show only tab name, not publication name
- Versions table: fixed name render, removed Branch column, adjusted widths
- Search fields added for both tabs
- Version row three-dot menu (Edit/Activate/Delete) + DELETE endpoint + hook
- Applications tab: name display, translated columns, action menu, clickable names
- i18n: ~13 EN + ~13 RU keys (version delete, app actions, search, menu)

### Create Dialog & Schema Fixes (4 issues)
- Fixed TypeError: useCommonTranslations destructuring in VersionList and AppList
- Reworked Create Publication dialog: toggles above CollapsibleSection, app fields inside
- Fixed broken schema creation: DDL runs after TypeORM transaction commit (deadlock fix)
- Added applicationNameVlc/descriptionVlc inside CollapsibleSection

### CollapsibleSection Export Fix
- Missing export from template-mui root src/index.ts caused @flowise/core-frontend build failure
- Moved to components/layout/ subfolder, created barrel, added to root exports
- Build: 66/66 (was 64/65)

### Navigation & Create Dialog Rework (R1-R9)
- Backend: extracted `createLinkedApplication()` helper, new POST endpoint, `createApplicationSchema` option
- Frontend: routes + lazy imports for `/publication/:publicationId/versions` and `/applications`
- Components: PublicationVersionList, PublicationApplicationList with full CRUD
- Create dialog: 2 tabs (General + Access) with CollapsibleSection spoilers
- CollapsibleSection extracted to universo-template-mui as reusable component
- Cleanup: deleted VersionsPanel, ApplicationsPanel, ApplicationsCreatePanel
- Key decision: circular build dep solved with `(m: any)` cast in lazy imports

### QA Remediation (10 issues)
- H-1: slug collision — unique slug per application; M-2: unused imports (4 files)
- M-3: Russian i18n fallback → English; M-4: react-hooks/exhaustive-deps (useMemo)
- M-5: name validation + disabled Create; L-2: non-null assertion fallback
- L-4: aria attributes on CollapsibleSection; M-1: prettier auto-fix (17→0 errors)

**Build**: 66/66 packages. Modified 11 files, created 11, deleted 3.

---

## Copy UX & QA Remediation (2026-02-27)

### QA Remediation Round 10 — Copy UX
Standardized copy naming convention with i18n-driven naming per metahub locale. Template seed respects metahub primary locale during copy.

### PR #696 Bot Review Fixes
Safe `typeof` checks, dead code removal, `rel="noopener noreferrer"`, nullable name safe-access.

### Copy UX Simplification
- `generateCopyName()` helper with i18n " (copy N)" suffix — shared across metahubs + applications
- Metahub copy dialog with progress indicator, error handling, advisory lock
- Application copy with schema status reset (SYNCED→SYNCED, else→OUTDATED)

### QA Remediation Rounds 5-9
Copy flow refinements: edge cases (no active branch, locked metahubs), error message clarity, naming collision detection, schema status propagation, connector cleanup.

**Build**: 66/66 packages.

---

## Copy Flows & NUMBER Field Parity (2026-02-26)

### QA Remediation Rounds 1-4 — Copy Flows
- Round 1: prevent copy of soft-deleted entities
- Round 2: schema sync after copy — correct status propagation
- Round 3: unique constraint handling (codename conflicts → 409)
- Round 4: FK reference integrity for copied connector publications

### PR #692 Bot Review Remediation
Hardcoded locale → metahub locale, inline helpers extraction, formatting fixes.

### Copying UX/Logic Upgrade
`generateCopyName`, `ApplicationSchemaStatus` reset, advisory lock prevents concurrent copies.

### NUMBER Field Parity
Zone-aware ArrowUp/ArrowDown stepping across all three form contexts (DynamicEntityFormDialog, FormDialog, inline table). Complete NumberEditCell rewrite. 5 files across 3 packages.

### Fix Inline Table nonNegative
Prevented NaN→null regression in NUMBER stepper.

**Build**: 66/66 packages.

---

## QA & Architecture Fixes (2026-02-24 to 2026-02-25)

### QA Rounds 5-8 (02-25 to 02-26)
- Constraint text UX: human-readable violation messages
- Spacing fixes: table cell padding, dialog margins
- 3-dot menu alignment: consistent MoreVert positioning across all lists
- Runtime bugs: stale cache recovery, loading indicators, comprehensive QA pass

### Architectural Improvements (02-24)
- Attribute edit race condition: useRef snapshot prevents stale data submission
- 422 error payload: structured blocker array instead of plain string
- i18n for structured blockers in migration guard UI

### QA Remediation Rounds 1-2 (02-24)
Button spacing, toast improvements, deletion guard, empty-state messaging, column widths.

### QA Findings Code Remediation (02-24)
5 bugs + 5 warnings: attribute validation, catalog access, API route fixes.

### Unified Application Migration Guard QA Fixes (02-24)
- BUG-1: "Continue anyway" calling refetch → added useState dismissed state
- BUG-2: Application copy missing appStructureVersion + lastSyncedPublicationVersionId
- WARN-1: Test timeout fix (mocks for 6 exports, 19s → 650ms)
- INFO-2: TARGET_APP_STRUCTURE_VERSION=1 constant (was hardcoded in 5 places)
- INFO-5: ensureMemberAccess instead of ensureAdminAccess for status endpoint

**Build**: 66/66 packages.

---

## QA & Child TABLE Editing (2026-02-23)

### QA Safe Remediation
Number display formatting, optimistic lock improvements, enum dropdown fixes, status dialog.

### QA Recommendations Implementation
2 high + 3 medium improvements for metahubs entity management.

### Child TABLE Editing & Select UX Parity
Full inline editing parity with parent table — all attribute types (STRING, NUMBER, BOOLEAN, DATE, REF, JSON) supported in child tables.

### QA Fixes Chain (7 rounds)
- Inline Edit, Empty Option & Schema Diff i18n: 4 targeted fixes
- Element Create & Attribute List UX: validation, column widths, i18n
- QA Remediation Pass: 7 issues across frontend/backend
- Child TABLE Select UX: dropdown, column widths, type consistency
- QA Findings Remediation: 6 issues (data loading, types, error handling)
- Child TABLE Attribute Parity + Sync FK Fix: full parity for child attributes, 6 files
- Dialog Init & Child REF Persistence: form initialization, restored persistence, 4 files

**Build**: 66/66 packages.

---

## TABLE Attribute & QA (2026-02-21 to 2026-02-22)

### Documentation Updates — QA Recommendations (02-22)
- metahubs-frontend README (EN/RU): ColumnsContainer, MigrationGuard, Blockers i18n
- metahubs-backend README (EN/RU): Structured Blockers, Migration Endpoints, file structure
- New apps-template-mui README (EN/RU, 307 lines each): dashboard system, zone widgets, CRUD

### TABLE Attribute UX Rounds 1-5.4 + Round 6
Comprehensive inline editing with DnD reorder, stacked columns layout, delete dialog, persistence.

### QA Critical/Major Fix Pass
5 critical + 3 major issues: data loss prevention, cascading deletes, schema sync consistency.

### Additional QA Fixes
- Rounds 1-4: grid styling, delete cascade fix, schema diff alignment, i18n
- PR #686 Bot Review: import cleanup, typing improvements, deprecation markers, lodash removal
- Hub Delete Blockers: cascading FK checks across catalogs/hubs/attributes/elements
- Unified Action Menus: standardized 3-dot MoreVert menus across all entity types

**Build**: 66/66 packages.

---

## TABLE Attribute Type Implementation (2026-02-21)

Full TABLE attribute type: backend CRUD, schema DDL, frontend inline editing with DnD reorder, REF column support, publication snapshot pipeline for TABLE children.

**Build**: 66/66 packages.

---

## Enumerations Feature (2026-02-18 to 2026-02-19)

### QA Remediation Rounds 1-5
- Round 1: runtime safety — FormDialog enum default injection (undefined vs null)
- Round 2: structure versioning — consolidated V1/V2/V3 → single V1 (CURRENT_STRUCTURE_VERSION=1)
- Round 3: FK safety — enum REF targets `_app_enum_values(id)`, required-toggle guard
- Round 4: restore conflict → 409 on codename collision, locale fallback consistency
- Round 5: toggle-required invariant — ownership validation for defaultEnumValueId

### Stabilization + Hardening
- Contract alignment: presentation canonicalization, sync mapping for legacy payloads
- Backend fixes: strict typing, missing wiring, migration seed counters
- Shared type safety: ConflictInfo.entityType extended with `document`
- Metadata cleanup: order fixed (remove stale → upsert), duplicate guard, stale values cleanup
- Declarative schema: `uidx_mhb_enum_values_default_active` unique partial index

### Frontend/UI Integration
- Enumeration list + values list flows with CRUD hooks/mutations
- Attribute presentation: enumPresentationMode (select/radio/label), defaultEnumValueId
- TargetEntitySelector supports enumeration target kind
- i18n: enumerations, enumerationValues, ref.*, attributes.presentation.* (EN/RU)

### QA Fixes + UI Polish Rounds 5-6
- Round 6: Publication DELETE cascade N+1→bulk UPDATE, Prettier fixes, baseline template column, default detailsTable widget
- Round 5: widget label i18n, dry run text simplified, actions column headerName, schema/template split columns

**Build**: 66/66. Modified 15+ files across 6 packages.

---

## Migration Guard + UI Polish (2026-02-18)

### i18n Fix + LanguageSwitcher Widget
- `consolidateApplicationsNamespace()` dropped 3 sections (migrationGuard, underDevelopment, maintenance)
- LanguageSwitcher widget: copied from universo-template-mui, registered in dashboard (key: languageSwitcher)
- Template version 1.0.0 → 1.1.0 to trigger update_available

### Post-QA Polish (3 Rounds)
- BUG-1 CRITICAL: missing `import '@universo/applications-frontend/i18n'` (all t() calls → English)
- BUG-2: local SchemaStatus (5 values) vs backend (7 values) — exported from types.ts
- BUG-3: paginationDisplayedRows ignored MUI v8 estimated parameter
- WARNs: double AppMainLayout wrap, typo in RU locale, hardcoded bgcolor → action.hover

### Runtime Fix — React is not defined
Changed `jsx: "react"` → `"react-jsx"` in migration-guard-shared tsconfig. ESM bundle now uses auto-import from react/jsx-runtime.

### QA Fixes (2 Rounds)
- Round 1: split entry points — `./utils` (pure JS, no React) and `.` (React-dependent)
- Round 2: removed MIGRATION_STATUS_QUERY_OPTIONS from data-listing hooks, peerDependenciesMeta

### Migration Guard Full Spec Coverage (6 Phases)
- Table rename `_app_layout_zone_widgets` → `_app_widgets`, template version 1.0.0
- Shared package `@universo/migration-guard-shared`: determineSeverity, MigrationGuardShell<TStatus>
- AGENTS.md (3 new, 2 updated), MIGRATIONS.md (8 files, 4 packages × EN/RU)
- Both Guards rewritten with MigrationGuardShell (202→134 / 199→154 lines)
- Both severity endpoints use shared determineSeverity()

### Unified App Migration Guard QA (2 Rounds, 5 BUGs + 8 WARNs)
- extractAxiosError(.message), isAdminRoute regex, copy status reset, publication DELETE cleanup
- N+1→bulk UPDATE, advisory lock (pg_try_advisory_lock), staleTime, severity fallback
- Blocker keys, ARIA improvements, AGENTS.md relocation

**Build**: 66/66. 15 new files, 17 modified.

---

## PR #682 Bot Review Fixes (2026-02-18)

9 actions: staleTime for list/plan hooks, unused imports, type safety guard, determineSeverity JSDoc, AGENTS.md roles/statuses, MIGRATIONS.md corrections, memory-bank English translation.

**Build**: 66/66.

---

## Dashboard & Architecture (2026-02-17 to 2026-02-20)

### 5-Étap QA Fixes (02-20)
- Étap 1: editor canSave + dirty tracking (useRef snapshot)
- Étap 2: inner widget labels in LayoutDetails chip
- Étap 3: migration guard "Apply (keep data)" button with loading/error
- Étap 4: structured blockers i18n — StructuredBlocker interface, 16 sites, 15 keys
- Étap 5A/B: multiInstance revert, multi-widget columns (widgets[] array, MAX=6)

### columnsContainer QA (02-17)
multiInstance=false, Array.isArray guard, useMemo for stable refs, JSDoc for showDetailsTable.

### Center Zone columnsContainer (02-19)
Zone-aware `buildDashboardLayoutConfig()` with centerActive. Center seed: detailsTable (width 9) + productTree (width 3). DashboardDetailsContext for MainGrid. Template version 1.1.0 → 1.2.0.

### Dashboard Zones & Widgets (4 Phases, 02-18)
Phase 1: widget split (productTree + usersByCountryChart). Phase 3: right drawer. Phase 2: columnsContainer with DnD editor. Phase 4: createAppRuntimeRoute factory. 5 files created, 17+ modified.

### Architecture Refactoring (02-17)
Headless Controller Hook + CrudDataAdapter: DashboardApp 483→95 (-80%), ApplicationRuntime 553→130 (-76%). createStandaloneAdapter + createRuntimeAdapter. Pattern: systemPatterns.md#headless-controller-hook

### UI Polish + QA Rounds 3-6 (02-17)
Button position, actions centering, DataGrid i18n. Required null check, extractErrorMessage, 5 mutation hooks, schema fingerprint (useRef).

**Build**: 65/65.

---

## Runtime CRUD & QA (2026-02-14 to 2026-02-16)

### QA Round 5 — Dialog Input Styling (02-16)
Root cause: apps-template-mui compact MUI Dashboard style (padding: 0, notchedOutline: none). Fixed with proper spacing, MuiInputLabel, MuiButton disabled state.

### QA Round 4 — Theme Dedup + Runtime Rename (02-16)
CRITICAL: removed duplicate AppTheme+CssBaseline from Dashboard.tsx. Runtime rename: 60+ identifiers (applicationRuntime→appData, runtimeKeys→appQueryKeys). Backward-compatible aliases preserved.

### QA Round 3 — Layout, Hooks, Delete (02-15)
AppMainLayout wrapper. Fixed hooks order. ConfirmDeleteDialog auto-close. FormDialog i18n (16 keys).

### QA Round 2 — Validation (02-14)
Date validation (new Date + isNaN → 400). UUID validation for catalogId/applicationId. Cache invalidation broadened. VLC structural check.

### Security Fixes (02-15)
UUID_REGEX constant. `_upl_updated_by` audit field. No unhandled promise rejection (removed throw err).

### Runtime CRUD (7 Phases, 02-15)
Full lifecycle: POST/PATCH/DELETE runtime rows, FormDialog, LocalizedInlineField, ConfirmDeleteDialog, VLC support, validation rules, DataGrid UX.

**Build**: 65/65.

---

## Metahubs UX & UI Polish (2026-02-13 to 2026-02-14)

### Boolean Fix, Auto-fill, Presentation Tab (02-13)
Boolean indeterminate: DDL `.defaultTo(false)`, runtime null→false, frontend indeterminate=false. Publication auto-fill from metahub name + " API". Presentation tab: `uiConfig` with `headerAsCheckbox`.

### UI/UX Polish Rounds 1-2 (02-14)
TWO sidebar configs discovered (metahubDashboard.ts legacy + menuConfigs.ts production) — synchronized. Create buttons: `tc('addNew')` → `tc('create')`. Widget toggle: Switch → Button with ToggleOn/ToggleOff icons.

### QA Remediation + Version Reset (02-13)
ensureDefaultZoneWidgets respects isActive. Unique partial index on widgets. TemplateSeedCleanupService fix. V1/V2/V3 → single V1. Zod isActive fix. cleanupMode default → 'confirm'.

### Migration 503 Pool Starvation Fix
Promise.all(7×hasTable) → single information_schema query. Pool formula: floor(budget/4) → floor(budget/3).

### Widget Activation Toggle
Structure V3 DDL (is_active column), backend toggle route, hash normalization, optimistic UI, snapshot pipeline.

### README Documentation
Full rewrite metahubs-backend README.md (EN/RU, 730 lines each).

**Build**: 65/65.

---

## 2026-02-12: QA Rounds 9-16 — Pool, Locks, Cache, Migrations ✅

### Round 9: Migration Gate, Baseline Compatibility, Pool-Safe Apply
- DB-aware `ensureSchema()` with strict order. Widget table resolver aligned to `_mhb_widgets`.
- Deterministic error model: `MIGRATION_REQUIRED` (428), `CONNECTION_POOL_EXHAUSTED` (503).
- Frontend `MetahubMigrationGuard` modal. Serialized advisory-lock acquires in schema-ddl.

### Round 10: Template Version Source, Cache Safety, Retry/Loading UX
- plan/status reads from branch sync fields. Removed unsafe early cache-return paths.
- Apply requires confirmed branch sync (409 if not). Disabled auto-retries for migration queries.

### Round 11: Read-Only EnsureSchema, Scoped Repos
- Split ensureSchema: read_only / initialize / apply_migrations modes.
- Version-aware table validation. Request-scoped manager via getRequestManager.

### Round 12: Request-Scoped SchemaService Manager
MetahubSchemaService accepts optional EntityManager. Propagated to all entry points.

### Rounds 13-16: Atomic Sync, Retry Dedup, Error Mapping, Pool Contention
- Branch structureVersion update only after successful sync.
- auth-frontend API client: transientRetryAttempts=0. Timeout/pool→503.
- Post-apply tolerates read failures. Widget cache invalidation before seed sync.
- RLS cleanup skip when QueryRunner never connected. Pool budget rebalance env knobs.
- createInitialBranch: advisory lock + transactional metadata + safe schema rollback.

12 test suites, 76+ tests. Build: OK.

---

## 2026-02-11: QA Rounds 3-8, Structure Baseline, DDL Deep Fixes ✅

### Structure Baseline + Template Cleanup
_mhb_widgets baseline table. CURRENT_STRUCTURE_VERSION=1. Diff engine: RENAME_TABLE/RENAME_INDEX via renamedFrom. TemplateSeedCleanupService with modes keep/dry_run/confirm. Removed starter tags catalog.

### QA Rounds 3-8
- R3: Access checks, advisory lock + pessimistic locks, kind normalization, protected layout config
- R4: Branch access guards, metahub delete locking, `hashtextextended` lock-key strategy
- R5: Application rollback advisory lock, SystemTableMigrator destructive abort, copy excludes soft-deleted
- R6: Source-less branch stores minStructureVersion, unique-violation → 409, advisory lock timeout
- R7: User-branch cache invalidation, findByCodename active-only filter, branch delete → 409
- R8: MSW handlers for templates, vitest.config.ts coverage mode, `any` → `unknown` catches

### DDL Deep Fixes
JSONB meta column, unique migration names, SQL identifier quoting. Entity lookup by kind, layouts incremental migration, lazy manifest load. Copy+branch structureVersion fixes.

Build/tests: all rounds green.

---

## Metahub Migration Hardening — Structured Plan/Apply (2026-02-11)

Typed migration metadata contracts: baseline | structure | template_seed | manual_destructive. Template manifest validation with cross-reference safety checks. Seed dry-run planning. Structured plan/apply API with deterministic blocking. Branch-level template sync tracking. Tests: templateManifestValidator, metahubMigrationMeta, metahubMigrationsRoutes.

---

## 2026-02-10: Template System, DDL Engine, Migration Architecture ✅

### Metahub Template System (10 phases)
DB entities (templates, templates_versions), TemplateSeedExecutor, TemplateManifestValidator (Zod), TemplateSeeder (SHA-256 idempotent), frontend TemplateSelector. QA: Zod VLC fix, default auto-assign, transaction wrapper, atomic creation.

### Declarative DDL & Migration Engine (7 phases)
SystemTableDef types, 6 V1 tables, SystemTableDDLGenerator, SystemTableDiff engine, SystemTableMigrator (additive auto + destructive warnings). FK diff (ADD_FK/DROP_FK/ALTER_COLUMN). TemplateSeedMigrator for upgrades.

### Migration Architecture Reset
V1 baseline with _mhb_migrations entry. Decoupled template seed from structure upgrades. Migration history/plan/apply API, Migrations page + menu route.

Build: 65/65.

---

## 2026-02-05 to 2026-02-09: Layouts, Runtime, Menu Widget, PR Review ✅

### PR #668 Bot Review Fixes (02-09)
Zod schema mismatch, non-deterministic Object.keys→Object.values, unused imports.

### Menu Widget System (02-08 to 02-09)
Removed menus domain. MenuWidgetConfig with embedded items. Publication pipeline updated. MenuWidgetEditorDialog, MenuContent integration. 6 QA fixes (VLC, default title, runtime catalog).

### Layout Widget DnD + Rendering (02-08)
Widget DnD reorder, zone rendering, widgetRenderer.tsx, SortableWidgetChip.

### Application Runtime + DataGrid (02-07)
Column transformers, row counts, menu propagation, createAppRuntimeRoute factory.

### Layouts System Foundation (02-06)
Backend CRUD routes, LayoutList/LayoutDetails/LayoutInput, zone widget management, application sync, DashboardLayoutConfig type.

### Attribute Data Types + Display Attribute (02-05)
STRING, NUMBER, BOOLEAN, DATE, REF, JSON with validation rules. Display attribute with auto-selection. MUI 7 migration prep. Pattern: systemPatterns.md#attribute-type-architecture

Build: 65/65.

---

## 2026-01-29 through 2026-02-04: Branches, Elements, System Fields ✅ (v0.48.0-alpha)

- Metahub branches system (create, activate, delete, copy with schema isolation)
- Records renamed to Elements across backend, frontend, types, i18n
- Three-level system fields (`_upl_*`, `_mhb_*`, `_app_*`) with cascade soft delete
- Optimistic locking (version column, 409 conflicts, email lookup for `updated_by`)
- Pattern: systemPatterns.md#three-level-system-fields

---

## 2026-01-16 through 2026-01-28: Publications, schema-ddl, Migrations ✅ (v0.47.0-alpha)

- Runtime migrations (schema sync between metahub design and application runtime)
- Publication as separate entity with application-centric schema sync
- `@universo/schema-ddl` package for DDL utilities (SchemaGenerator, SchemaMigrator, KnexClient)
- Isolated schema storage + publication versioning system
- Pattern: systemPatterns.md#runtime-migration-pattern

---

## 2026-01-11 through 2026-01-15: i18n, VLC, Catalogs ✅ (v0.45.0-alpha, v0.46.0-alpha)

- Applications modules (frontend + backend) with Metahubs publications integration
- Domain-Driven Design architecture refactoring for metahubs packages
- VLC (Versioned Localized Content) localization system for metahub entities
- Catalogs functionality in Metahubs (CRUD, attributes, elements)
- Pattern: systemPatterns.md#vlc-utilities

---

## 2026-01-04 through 2026-01-10: Auth & Onboarding ✅ (v0.44.0-alpha)

- Onboarding completion tracking with registration 419 auto-retry
- Legal consent, cookie banner, captcha, auth toggles
- Pattern: systemPatterns.md#public-routes-401-redirect

---

## 2025-12-18 through 2025-12-31: VLC, Flowise 3.0, Onboarding ✅ (v0.42.0-alpha, v0.43.0-alpha)

- VLC system implementation + breadcrumb hooks refactoring
- Dynamic locales management. Flowise Components upgrade 2.2.8 → 3.0.12
- AgentFlow Agents + Executions integration (Flowise 3.x)
- Onboarding wizard with start pages i18n

---

## 2025-12-05 through 2025-12-17: Admin Panel, Auth, Package Extraction ✅ (v0.40.0-alpha, v0.41.0-alpha)

- Admin panel disable system with ENV-based feature flags
- Axios 1.13.2 upgrade (CVE-2025-27152). Auth.jsx → auth-frontend TypeScript migration
- UUID v7 infrastructure and core backend package
- Package extraction: Tools, Credentials, Variables, ApiKey, Assistants, Leads, ChatMessage, DocStore
- Admin panel + RBAC system. Admin Instances MVP
- Pattern: systemPatterns.md#source-only-package-peerdependencies

---

## 2025-11-07 through 2025-11-25: Organizations, Projects, Campaigns ✅ (v0.36.0-v0.39.0-alpha)

- dayjs migration, UI refactoring, publish-frontend TypeScript migration
- Russian README files. Metaverse Dashboard with analytics. REST API docs refactoring
- Member actions factory, Agents migration. Projects management. AR.js Quiz Nodes
- Organizations module. Campaigns integration. Storages management
- Pattern: systemPatterns.md#universal-list-pattern

---

## 2025-10-23 through 2025-11-01: Global Refactoring ✅ (v0.34.0-alpha, v0.35.0-alpha)

- Global monorepo refactoring: package restructuring, tsdown build system, centralized dependencies
- i18n TypeScript migration. Rate limiting production implementation with Redis
- Pattern: systemPatterns.md#build-system-patterns, systemPatterns.md#rate-limiting-pattern

---

## 2025-10-02 through 2025-10-16: Metaverses, Canvas, Publications ✅ (v0.31.0-v0.33.0-alpha)

- Publication system fixes, Metaverses module MVP, Quiz timer
- Canvas versioning, telemetry refactoring, role-based permissions
- MUI Template System implementation

---

## 2025-09-07 through 2025-09-21: Resources, Testing, Auth ✅ (v0.28.0-v0.30.0-alpha)

- Resources/Entities architecture with tenant isolation and security hardening
- CI i18n docs consistency checker. Spaces/Canvases publication settings
- TypeScript path aliases. Global publication library. Analytics hierarchy
- Passport.js + Supabase hybrid session architecture migration

---

## Pre-2025-09: Foundation Work ✅ (v0.21.0-v0.27.0-alpha)

- v0.27.0 (2025-08-31): Finance module, language switcher, i18n integration
- v0.26.0 (2025-08-24): MMOOMM template extraction, Colyseus multiplayer server
- v0.25.0 (2025-08-17): Space Builder MVP, Metaverse module, core utils package
- v0.24.0 (2025-08-12): Space Builder enhancements, AR.js wallpaper mode
- v0.23.0 (2025-08-05): Russian documentation, UPDL node params, custom modes
- v0.22.0 (2025-07-27): Memory Bank system, MMOOMM improvements, documentation
- v0.21.0 (2025-07-20): Handler refactoring, PlayCanvas stabilization, Alpha status
