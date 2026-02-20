# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

## Completed: PR #686 Bot Review Fixes — 2026-02-20 ✅

> **Context**: IMPLEMENT mode. Applied fixes for 5 valid bot review comments (Gemini + Copilot) on PR #686.

### Code fixes
- [x] Add `_upl_version` increment to `removeHubFromObjectAssociations` update in `hubsRoutes.ts`
- [x] Standardize error response envelope in `metahubsRoutes.ts` for `normalizedComment.error` (2 locations)
- [x] Add `maxLength={510}` to `LocalizedInlineField` in `MemberFormDialog.tsx` and replace hardcoded English validation message with i18n prop
- [x] Add missing i18n keys (`members.validation.commentCharacterCount`, `members.validation.commentTooLong`) to EN/RU `metahubs.json`
- [x] Revert migration `1766351182000` back to `comment TEXT` and create new migration `1766351182001-AlterMetahubUsersCommentToJsonb.ts`
- [x] Update `MetahubMembers.tsx` to pass `commentTooLongMessage` prop to `MemberFormDialog`
- [x] Update test assertion in `metahubsRoutes.test.ts` to match new error envelope format

### Verification
- [x] Build: 66/66 packages
- [x] Tests: 15/15 suites, 83 passed
- [x] Commit and push to PR #686

---

## Completed: Hub Delete Blockers for Enumerations — 2026-02-19 ✅

> **Context**: IMPLEMENT mode. Extend hub delete blocker logic and UI from catalogs-only to catalogs + enumerations.

### Execution checklist
- [x] Analyze current hub delete blocker flow in backend and frontend dialog
- [x] Add backend blocker detection for enumerations with same rule as catalogs (`isSingleHub` + `isRequiredHub` + only this hub linked)
- [x] Extend hub delete API blocker payload with grouped sections (`catalogs`, `enumerations`) and totals
- [x] Update frontend hub delete dialog to show separate tables for blocking catalogs and blocking enumerations
- [x] Run targeted tests/lint/build for touched packages and record outcomes

## Completed: Unified Action Menus, Row Indexing, Access Member Dialog, Migrations Spacing — 2026-02-19 ✅

> **Context**: IMPLEMENT mode. Unify action menu UX and row numbering across metahubs/applications lists; modernize access member dialog (including VLC comment); align migrations page spacing.

### Execution checklist
- [x] Finalize unified `BaseEntityMenu` behavior (three-dot trigger + icon/text spacing + danger action color) and remove per-page trigger deviations in target lists/cards
- [x] Ensure all delete actions in affected metahub/application menus use `tone: 'danger'` so destructive entries are red and visually consistent
- [x] Complete `#` auto-number column parity for hubs, catalogs, enumerations (frontend columns + stable backend sorting by `sortOrder`)
- [x] Refactor metahub access add/edit member dialog to standard spacing and migrate member comment to VLC payload/storage/rendering
- [x] Update add-member dialog title to localized “Добавление участника / Add member” while preserving short toolbar button text
- [x] Verify and align migrations page horizontal gutters with other list sections (no extra side padding)
- [x] Keep structure/template default versions unchanged and avoid adding legacy fallback branches
- [x] Run targeted lint/build checks for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 5 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after latest QA report. Goal is to close critical runtime/backend gaps without widening scope.

### Execution checklist
- [x] Restore invariant checks in `toggle-required` route for enum REF attributes (label mode/default ownership)
- [x] Remove UUID fallback from enum REF runtime cell rendering and show safe empty fallback instead
- [x] Make connector touch operation during schema sync always update `updatedAt`
- [x] Fix blocking prettier/eslint error in `HubList.tsx`
- [x] Run targeted tests/lint/build for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 4 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after latest QA report. Goal is to close remaining high/medium findings before the next QA pass.

### Execution checklist
- [x] Fix runtime FormDialog enum defaults so explicit `null` values are never auto-overwritten in edit flow
- [x] Harden enumeration restore route to return deterministic `409` on codename unique conflicts
- [x] Align hub-scoped enumeration PATCH locale fallback with metahub-scoped PATCH behavior
- [x] Add regression tests for restore conflict handling and locale fallback behavior in `enumerationsRoutes`
- [x] Add runtime enumeration regression tests in `applicationsRoutes` for label readonly and enum ownership validation
- [x] Run targeted lint/test/build verification for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 3 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after repeated QA requests. Goal is to close remaining functional safety gaps around enum FK migration behavior, attribute required/default invariants, and permanent delete blockers.

### Execution checklist
- [x] Fix `schema-ddl` FK migration path for `REF -> enumeration` to target `_app_enum_values(id)` and ensure system tables are present before FK creation
- [x] Add backend invariant guard for `toggle-required` (`label` mode + required enum REF requires valid `defaultEnumValueId`)
- [x] Add blocker checks to Enumerations permanent delete route (parity with soft delete semantics)
- [x] Add regression tests for all three fixes (`schema-ddl` + metahubs backend routes)
- [x] Run targeted lint/test/build verification for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 2 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after comprehensive QA findings. Goal is to remove high/medium risks that still affect Enumerations behavior and migration safety.

### Execution checklist
- [x] Introduce explicit metahub structure V3 (keep V2 immutable), move `_mhb_enum_values` addition to V3, and align template minimum structure version
- [x] Fix Enumerations routes consistency: `_upl_*` timestamps in API payloads + single-hub validation on create endpoints
- [x] Harden application enum sync to remap stale runtime references before soft-deleting removed enum values
- [x] Resolve remaining blocking prettier errors in touched backend template services
- [x] Add/adjust regression tests for structure version expectations and migration plan target version
- [x] Run targeted verification (`build`/`test`/`lint`) for affected packages and record outcomes

## Completed: Enumerations Stabilization Implementation — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after QA. Goal is to resolve compile/runtime blockers and formatter errors introduced by Enumerations rollout.

### Execution checklist
- [x] Align `EnumerationValueDefinition` usage (`presentation` vs legacy `name/description`) across snapshot + sync flow
- [x] Fix `enumerationsRoutes` typing/runtime blockers (`updated.presentation/config` unknown, missing `attributesService` in value delete handler)
- [x] Fix metahub migration route seed counters mismatch (`enumValuesAdded` in zero seed counts)
- [x] Fix `MetahubAttributesService.findElementEnumValueBlockers` result typing (`rows.map` compile issue)
- [x] Fix optimistic lock entity type narrowing in `MetahubObjectsService` / `MetahubEnumerationValuesService`
- [x] Validate and harden enumeration value sync mapping for `_app_enum_values`
- [x] Replace destructive enum sync cleanup with safe soft-delete/restore semantics to avoid FK/NOT NULL migration breakage
- [x] Resolve Prettier errors in new Enumerations frontend files (`metahubs-frontend`)
- [x] Run targeted verification: build + test + lint for touched packages and record outcomes

## PR #682 Bot Review Fixes — 2026-02-18

> **Context**: Gemini Code Assist and Copilot PR Reviewer left 10 comments on PR #682. QA analysis confirmed 9 actionable items.

### Code fixes
- [x] Add `staleTime: 30_000` to `useMetahubMigrationsList` and `useMetahubMigrationsPlan` hooks
- [x] Remove unused `UpdateSeverity` import from `metahubMigrationsRoutes.ts`
- [x] Remove unused `UpdateSeverity` import from `applicationMigrationsRoutes.ts`
- [x] Add `typeof` guard for `meta?.templateVersionLabel` in `MetahubMigrations.tsx`
- [x] Update `determineSeverity` JSDoc — OPTIONAL means "no update needed / pass-through"

### Documentation fixes
- [x] Fix AGENTS.md roles: `viewer` → `member`
- [x] Fix AGENTS.md schema statuses: add DRAFT, OUTDATED, UPDATE_AVAILABLE
- [x] Fix MIGRATIONS.md: align description with actual guard behavior
- [x] Fix memory-bank/progress.md: translate Russian fragments to English

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Enumerations QA Hardening — 2026-02-19 ✅

> **Context**: Post-QA implementation hardening for enumeration sync safety, metadata cleanup correctness, and regression coverage.

### Backend/DDL fixes
- [x] Make `syncSystemMetadata(removeMissing=true)` cleanup run **before** upsert to prevent `(kind, codename)` unique conflicts on recreate
- [x] Enable `removeMissing: true` for all schema sync paths that can run with no DDL changes (application sync + publication sync + migrator paths)
- [x] Harden `syncEnumerationValues()` with duplicate ID guard and stale-row cleanup for removed enumeration objects
- [x] Add declarative unique partial index `uidx_mhb_enum_values_default_active` to `_mhb_enum_values` system table definition

### Compatibility + regression
- [x] Add runtime-compatible enumeration kind fallback in `schema-ddl` for mixed `@universo/types` versions
- [x] Fix `calculateSchemaDiff()` old snapshot entity ID extraction (`Object.entries` + id restore)
- [x] Add regression test: enumeration entities are ignored by physical DDL diff
- [x] Add regression test: metadata cleanup happens before upsert when `removeMissing=true`

### Verification
- [x] `pnpm --filter @universo/schema-ddl lint` (warnings only, no errors)
- [x] `pnpm --filter @universo/schema-ddl test` (7/7 test suites passed)
- [x] `pnpm --filter @universo/schema-ddl build` (success)
- [x] `pnpm --filter @universo/metahubs-backend exec eslint ...` for touched backend files (warnings only, no errors)
- [x] `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/systemTableMigrator.test.ts` (passed)

---

## In Progress: Enumerations Feature Implementation — 2026-02-18

> **Context**: Implementing metahub/application Enumerations end-to-end (entity kind, values, REF support, runtime controls, sync, i18n, routes, and tests/build verification).

### Execution checklist
- [x] Finalize shared contracts: `MetaEntityKind.ENUMERATION`, enum value/presentation types, schema/table version constants
- [x] Implement metahub backend enumeration domain (routes + value CRUD + hub association + delete blockers)
- [x] Extend attribute backend validation and payload normalization for `REF -> enumeration`
- [x] Extend publication snapshot serializer/deserializer for enumeration entities and values
- [x] Extend template manifest validator, seed executor, and seed migrator for enumeration support
- [x] Extend application sync pipeline to copy enumeration values into `_app_enum_values`
- [x] Extend runtime backend (`applicationsRoutes`) to expose/read/write `REF` and validate enum value ownership
- [x] Extend `apps-template-mui` runtime API/types/form renderer for enum presentation modes (`select`, `radio`, `label`)
- [x] Complete metahub frontend enumerations domain (API + hooks + list + values)
- [x] Add metahub menu + route wiring (`metahubs-frontend`, `universo-template-mui`)
- [x] Extend attribute frontend UX: target entity selector supports enumerations and presentation tab supports enum modes/defaults
- [x] Add i18n keys and localized labels in EN/RU for menus, metahub pages, and runtime controls
- [x] Run targeted lint/build for touched files/packages and resolve introduced errors (full `metahubs-backend` build still blocked by pre-existing unrelated TypeScript issues)
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with implementation summary

---

## Completed: QA Fixes + UI Polish Round 6 — 2026-02-19 ✅

> **Context**: QA analysis found 1 bug + 3 warnings. User also requested 4 additional improvements.

### QA Fixes
- [x] **BUG-1 + WARN-3**: Publication DELETE cascade fix — moved linked-app status reset BEFORE `remove()` (FK ON DELETE CASCADE), replaced N+1 loop with single bulk UPDATE sub-select query
- [x] **WARN-1**: Fixed prettier indentation in `ApplicationMigrationGuard.tsx` — MigrationGuardShell props at 16 spaces (was 12)
- [x] **WARN-2**: Fixed 89 prettier errors in `columns.tsx` — converted from 2-space to 4-space indentation project-wide

### UI & Backend Improvements
- [x] Remove extra `px` padding from migrations page inner Stack — matches other list pages (MetahubList, PublicationList)
- [x] Template column for baseline migrations — added `templateVersionLabel` to baseline meta schema/builder, frontend shows `"0 → version"` for baseline kind
- [x] Default layout: `detailsTable` widget as standalone active (sortOrder 6), `columnsContainer` moved to sortOrder 7 with `isActive: false`
- [x] Reset template version `1.1.0` → `1.0.0` in `basic.template.ts` (DB wipe pending)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: UI Polish Round 5 — 5 Fixes — 2026-02-19 ✅

> **Context**: Manual testing found 5 UI issues after LanguageSwitcher integration.

### Fix 1: languageSwitcher widget label missing i18n
- [x] Add `"languageSwitcher": "Переключатель языка"` to ru/metahubs.json `layouts.widgets`
- [x] Add `"languageSwitcher": "Language switcher"` to en/metahubs.json `layouts.widgets`

### Fix 2: Dry run button text too verbose
- [x] Change ru `"dryRun": "Проверить (dry run)"` → `"Проверить"`
- [x] Change en `"dryRun": "Dry run"` → `"Verify"`

### Fix 3: Actions column shows "actions" key in column management panel
- [x] Add `type: 'actions' as const` to actions column in `columns.tsx`
- [x] Set `headerName: options.actionsAriaLabel ?? 'Actions'` (non-empty for MUI DataGrid v8 fallback)

### Fix 4: Table side padding root cause — investigated
- [x] Root cause: `MainLayoutMUI.tsx` has `Stack px: {xs:2, md:3}` (16-24px). Inner `Stack px: {xs:1.5, md:2}` + `Box mx: -2` compensating pattern is universal across all list pages. Not a bug — by design.

### Fix 5: Split "Из → В" column into "Схема" + "Шаблон"
- [x] Update `MigrationDisplayRow` type: replace `fromTo` with `schemaDisplay` + `templateDisplay`
- [x] Row mapping: baseline → schema `"0 → N"`, template_seed → template `"— → {templateVersionLabel}"`
- [x] Replace `fromTo` column with `schema` (14%) + `template` (14%) columns
- [x] Update column widths: appliedAt 24%, name 48%, schema 14%, template 14%
- [x] Add i18n keys: `migrations.columns.schema` / `migrations.columns.template` (EN + RU)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: i18n Fix + LanguageSwitcher Widget — 2026-02-18 ✅

> **Context**: Guard dialog showed English despite `i18nextLng = ru` in localStorage. Also: copy LanguageSwitcher from `universo-template-mui` → `apps-template-mui` as a dashboard widget.

### i18n Fix
- [x] Add `migrationGuard`, `underDevelopment`, `maintenance` to `ApplicationsBundle` type and `consolidateApplicationsNamespace()` in `i18n/index.ts`

### LanguageSwitcher Widget
- [x] Register `languageSwitcher` widget in `DASHBOARD_LAYOUT_WIDGETS` (`@universo/types`)
- [x] Create `LanguageSwitcher.tsx` in `apps-template-mui/src/components/` — self-contained with static labels
- [x] Integrate into `Header.tsx` (desktop) with `showLanguageSwitcher` config flag
- [x] Integrate into `AppNavbar.tsx` (mobile)
- [x] Add to `DEFAULT_DASHBOARD_ZONE_WIDGETS` (sortOrder 7, top zone, active by default)
- [x] Add `showLanguageSwitcher` to `buildDashboardLayoutConfig()`
- [x] Add `showLanguageSwitcher` to Zod schema in `api.ts`
- [x] Add `showLanguageSwitcher` to `useCrudDashboard.ts` defaults
- [x] Add `showLanguageSwitcher?: boolean` to `DashboardLayoutConfig` interface in `Dashboard.tsx`
- [x] Export `LanguageSwitcher` from `apps-template-mui/src/index.ts`
- [x] Bump template version `1.0.0` → `1.1.0` in `basic.template.ts` (triggers `update_available` for existing metahubs)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Post-QA Polish Round 3 — 6 Fixes — 2026-02-18 ✅

> **Context**: Comprehensive QA analysis found 3 bugs + 3 warnings in Migration Guard implementation.

### BUG-1 (CRITICAL): Missing i18n registration for applications-frontend
- [x] Add `import '@universo/applications-frontend/i18n'` to `MainRoutesMUI.tsx` — namespace was never registered

### BUG-2 (MEDIUM): SchemaStatus type mismatch
- [x] Export `SchemaStatus` type from `types.ts` (single source of truth, 7 values)
- [x] Remove local `SchemaStatus` from `ConnectorBoard.tsx`, import from `types.ts`
- [x] Remove local `SchemaStatus` from `ConnectorDiffDialog.tsx`, import from `types.ts`

### BUG-3 (MINOR): paginationDisplayedRows ignores estimated param
- [x] Add `estimated` to destructuring in `getDataGridLocale.ts` with `примерно ${estimated}` label

### WARN-1: Double AppMainLayout wrapping
- [x] Remove `<AppMainLayout>` from `ApplicationRuntime.tsx` — Guard already provides it
- [x] Remove `AppMainLayout` import from `ApplicationRuntime.tsx`

### WARN-2: Typo in ru locale
- [x] Fix "приложениеа" → "приложения" in `applications.json` line 351

### WARN-3: grey.50 not dark-theme compatible
- [x] Change `bgcolor: 'grey.50'` → `'action.hover'` in `ConnectorBoard.tsx`

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Post-QA Polish — 4 Fixes — 2026-02-18 ✅

> **Context**: Manual testing revealed 4 remaining issues after QA assessed ~96% ТЗ coverage.

### Fix 1: WARN-1 — MIGRATIONS.md links in READMEs
- [x] Add `> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)` to `applications-backend/base/README.md`
- [x] Add same link to `applications-backend/base/README-RU.md`
- [x] Add link + "Migration Guard" feature bullet to `applications-frontend/base/README.md`
- [x] Add same to `applications-frontend/base/README-RU.md`

### Fix 2: Guard dialog not themed (default MUI blue buttons)
- [x] Root cause: `MinimalLayout` renders bare `<><Outlet />` with no ThemeProvider; guard Dialog renders before `ApplicationRuntime`'s `AppMainLayout`
- [x] Fix: Import and wrap with `<AppMainLayout>` in `ApplicationMigrationGuard.tsx` — Dialog now inherits custom theme

### Fix 3: Table i18n (actions column + pagination)
- [x] `actions` column in column toggle panel: Added `hideable: false` to actions column in `columns.tsx`
- [x] Pagination "1-1 of 1" → "1–1 из 1": Added `paginationDisplayedRows` override to `getDataGridLocale.ts` for 'ru' locale
  - Note: MUI X DataGrid v8 ruRU locale does NOT include `paginationDisplayedRows` by default

### Fix 4: Status display shows "Черновик" for update_available
- [x] Expand `SchemaStatus` type in `ConnectorBoard.tsx`: add `'update_available' | 'maintenance'`
- [x] Add `update_available` and `maintenance` entries to `statusConfig` (color + i18n label)
- [x] Add cases to status description ternary chain
- [x] Add i18n keys to EN and RU `applications.json` (`connectors.status.*` and `connectors.statusDescription.*`)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Runtime Fix — React is not defined — 2026-02-18 ✅

> **Context**: Metahub page crashed at runtime with `ReferenceError: React is not defined` in `index.mjs:33`.

- [x] Diagnose: `tsconfig.json` had `"jsx": "react"` (classic transform → `React.createElement`) but source uses named imports only (`{ useState }`)
- [x] Fix: Changed `"jsx": "react"` → `"jsx": "react-jsx"` (automatic JSX runtime, React 17+)
- [x] Verify: `dist/index.mjs` now imports from `react/jsx-runtime`, zero `React.createElement` calls
- [x] Build: 66/66 packages

---

## Completed: QA Fixes Round 2 — WARN-1/2/3 — 2026-02-18 ✅

> **Context**: Fixes for warnings from second QA verification of Migration Guard fixes.

### WARN-1: Shared status options suppress retry/refetch for listing hooks
- [x] Remove `...MIGRATION_STATUS_QUERY_OPTIONS` from `useMetahubMigrationsList` — use TanStack Query defaults
- [x] Remove `...MIGRATION_STATUS_QUERY_OPTIONS` from `useMetahubMigrationsPlan` — use TanStack Query defaults
- [x] Keep shared options only in `useMetahubMigrationsStatus` (status query)

### WARN-2: Backend-safe entry exports unused RQ config
- [x] Remove `MIGRATION_STATUS_QUERY_OPTIONS` re-export from `utils.ts`

### WARN-3: Missing peerDependenciesMeta with optional: true
- [x] Add `peerDependenciesMeta` to `package.json` — all React deps marked optional

### Verification
- [x] Lint: 0 errors on all modified files
- [x] Build: 66/66 packages

---

## Completed: QA Fixes — BUG-1 + WARN-3/4/5 — 2026-02-18 ✅

> **Context**: Fixes for issues found during comprehensive QA analysis of the Migration Guard implementation.

### BUG-1: CJS bundle pulls React/MUI on backend
- [x] Create `src/utils.ts` — backend-safe entry point (determineSeverity + MIGRATION_STATUS_QUERY_OPTIONS only)
- [x] Update `tsdown.config.ts` — add second entry point `utils`
- [x] Update `package.json` exports map — add `./utils` subpath
- [x] Update `applicationMigrationsRoutes.ts` import → `@universo/migration-guard-shared/utils`
- [x] Update `metahubMigrationsRoutes.ts` import → `@universo/migration-guard-shared/utils`
- [x] Verify `dist/utils.js` has no React/MUI requires

### WARN-3: Inline query options duplication in useMetahubMigrations.ts
- [x] Replace inline options in `useMetahubMigrationsList` with `...MIGRATION_STATUS_QUERY_OPTIONS`
- [x] Replace inline options in `useMetahubMigrationsPlan` with `...MIGRATION_STATUS_QUERY_OPTIONS`

### WARN-4: Misleading error on refetch failure in MetahubMigrationGuard
- [x] Separate try-catch blocks for migration apply and refetch

### WARN-5: Unstable statusQuery in useCallback deps
- [x] Extract `refetchStatus = statusQuery.refetch` (stable ref)
- [x] Use `refetchStatus` in useCallback deps instead of `statusQuery`

### Verification
- [x] Lint: 0 errors on all modified files
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Migration Guard — Full ТЗ Coverage (6-Phase Plan) — 2026-02-18 ✅

> **Context**: 6-phase plan to achieve 100% ТЗ coverage for the Unified Application Migration Guard feature. Covers table rename, shared package creation, AGENTS.md, MIGRATIONS.md extraction, README updates, and code deduplication.

### Phase 1: Rename _app_layout_zone_widgets → _app_widgets
- [x] Rename table in `SchemaGenerator.ts` (table name + 2 index names)
- [x] Rename in `applicationSyncRoutes.ts` (8 table refs, 3 function renames, variable rename with 6 refs)
- [x] Rename in `applicationsRoutes.ts` (2 SQL literals)
- [x] Reset template version 1.2.0 → 1.0.0 in `basic.template.ts`
- [x] CURRENT_STRUCTURE_VERSION already at 1, no change needed

### Phase 2: Create @universo/migration-guard-shared package
- [x] Create package.json, tsconfig.json, tsdown.config.ts
- [x] Create `determineSeverity.ts` — pure utility function
- [x] Create `migrationStatusQueryOptions.ts` — shared TanStack Query options
- [x] Create `MigrationGuardShell.tsx` — generic render-props shell component
- [x] Create `index.ts` — re-exports (backend-safe + frontend-only)
- [x] Build verification: 66/66 packages

### Phase 3: Create missing AGENTS.md files
- [x] `metahubs-frontend/base/AGENTS.md` — new
- [x] `applications-backend/base/AGENTS.md` — new
- [x] `migration-guard-shared/base/AGENTS.md` — new
- [x] `applications-frontend/base/AGENTS.md` — updated (MigrationGuardShell ref)
- [x] `metahubs-backend/base/AGENTS.md` — updated (determineSeverity ref)

### Phase 4: Extract MIGRATIONS.md from READMEs (4 packages × 2 languages)
- [x] `metahubs-backend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `metahubs-frontend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `applications-frontend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `applications-backend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`

### Phase 5: Update READMEs with links to MIGRATIONS.md
- [x] `metahubs-backend/base/README.md` — replaced 4 migration sections with links
- [x] `metahubs-backend/base/README-RU.md` — replaced 4 migration sections with links
- [x] `metahubs-frontend/base/README.md` — replaced MetahubMigrationGuard + Structured Blockers with link
- [x] `metahubs-frontend/base/README-RU.md` — replaced MetahubMigrationGuard + Structured Blockers with link

### Phase 6: Refactor Guards to use shared package
- [x] `applicationMigrationsRoutes.ts` — determineSeverity() replaces inline logic
- [x] `metahubMigrationsRoutes.ts` — determineSeverity() replaces inline logic
- [x] `useApplicationMigrationStatus.ts` — MIGRATION_STATUS_QUERY_OPTIONS from shared
- [x] `useMetahubMigrations.ts` — MIGRATION_STATUS_QUERY_OPTIONS from shared
- [x] `ApplicationMigrationGuard.tsx` — rewritten with MigrationGuardShell (202→134 lines)
- [x] `MetahubMigrationGuard.tsx` — rewritten with MigrationGuardShell (199→154 lines)
- [x] Prettier/lint fixes on both Guard files

### Verification
- [x] Build: 66/66 packages (65 original + migration-guard-shared)
- [x] Grep: 0 remaining references to old names
- [x] Memory-bank updated

---

## Completed: Unified Application Migration Guard — 2026-02-18 ✅

> **Context**: Unifying metahub migration system with application sync system. Adding proactive schema status checking, severity-based migration guard, and "under development" page for applications.

### Implementation (Этапы 1-10) — ✅ Completed 2026-02-23
- [x] All 10 étaps implemented and build-verified (65/65)

### QA Fixes Round 1 — ✅ Completed 2026-02-24
- [x] **BUG-1**: Fix "Continue anyway" button — added `useState(false)` dismissed state, `setDismissed(true)` on click
- [x] **BUG-2**: Application copy now copies `appStructureVersion` and `lastSyncedPublicationVersionId`
- [x] **WARN-1**: Added test mocks for new exports in `exports.test.ts` (was timeout, now 653ms)
- [x] **WARN-2**: Fixed all prettier formatting errors in guard + hook
- [x] **WARN-3**: Changed `key={idx}` to `key={blocker.code}` for blockers list
- [x] **INFO-2**: Extracted `TARGET_APP_STRUCTURE_VERSION = 1` constant in both route files
- [x] **INFO-5**: Added `ensureMemberAccess` for status endpoint (any member can check, not just admins)
- [x] Build verification: 65/65 packages, 0 errors

### QA Fixes Round 2 — ✅ Completed 2026-02-18
- [x] **BUG-1**: `extractAxiosError()` returns object, not string — appended `.message` in 4 places (ApplicationGuard, MetahubGuard×2, mutations.ts)
- [x] **BUG-2**: `isAdminRoute`/`isMigrationsRoute` — replaced `.includes()` with regex `/\/admin(\/|$)/`; removed unused `useMemo` imports
- [x] **BUG-3**: Application copy resets `schemaStatus` (SYNCED→SYNCED, else→OUTDATED), clears `schemaError` and `lastSyncedPublicationVersionId`
- [x] **BUG-4**: Publication DELETE cleanup — resets `UPDATE_AVAILABLE` → `SYNCED` on linked applications (inside transaction)
- [x] **BUG-5**: Connector/ConnectorPublication DELETE cleanup — same `UPDATE_AVAILABLE` → `SYNCED` reset
- [x] **WARN-4**: `notifyLinkedApplicationsUpdateAvailable()` — replaced N+1 loop with single UPDATE + sub-select query
- [x] **WARN-5**: Advisory lock for sync route — `pg_try_advisory_lock` via `acquireAdvisoryLock`, returns 409 on conflict
- [x] **WARN-6**: `useMetahubMigrationsStatus` — added `staleTime: 30_000` for consistency
- [x] **WARN-7**: MetahubGuard severity fallback — changed to `status?.severity === MANDATORY` (matches ApplicationGuard pattern)
- [x] **WARN-8**: MetahubGuard — `key={blocker.code}` instead of `key={idx}`
- [x] **WARN-9/12**: Dialog `aria-describedby` + `onClose` for RECOMMENDED severity (both guards)
- [x] **WARN-10**: `MaintenancePage` + `UnderDevelopmentPage` — added `role='status'` + `aria-live='polite'`
- [x] **WARN-11**: ApplicationGuard blockers i18n — 15 keys in EN + RU `applications.json`
- [x] AGENTS.md files moved to `/base` directories (metahubs-backend, applications-frontend)
- [x] Prettier/lint fixes on all 8 modified files
- [x] Build verification: 65/65 packages, 0 errors, 0 new lint errors

---

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

## Completed: Structure Baseline + Template Cleanup + DDL QA — 2026-02-11 ✅

### Structure Baseline + Cleanup Policy
- [x] `_mhb_widgets` baseline alignment, `CURRENT_STRUCTURE_VERSION=1`
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
