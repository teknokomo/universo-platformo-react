# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## ✅ COMPLETED (2026-01-12): Unit Tests for Catalogs Endpoints

**Context**: QA audit identified missing test coverage for Catalogs routes (5/10 for test coverage)

**Tests Added**:
- [x] Created `catalogsRoutes.test.ts` with 17 test cases covering:
  - GET `/metahubs/:metahubId/catalogs` — empty list, with associations, invalid query
  - POST `/metahubs/:metahubId/catalogs` — create, with hub associations, duplicate codename, missing codename, invalid hub IDs
  - DELETE `/metahubs/:metahubId/catalogs/:catalogId` — direct deletion, 404 for non-existent, cascade delete
  - DELETE `/metahubs/:metahubId/hubs/:hubId/catalogs/:catalogId` — force=true, multiple hubs, single hub, 404 cases

**Mock Infrastructure Extended**:
- [x] Added `count` method to MockRepository in typeormMocks.ts

**Documentation**:
- [x] Explained UUID validation in path-parameters via Zod (LOW priority — deferred for now)

---

## ✅ COMPLETED (2026-01-11): QA Fixes — Catalog Deletion + SQL Injection + Code Consolidation

**Context**: QA audit (8.5/10) + Bug report: "Cannot delete catalog without hub association"

**Critical Bug Fix (🔴)**:
- [x] **Catalog Deletion Bug**: Added direct DELETE endpoint `/metahubs/:metahubId/catalogs/:catalogId`
  - Backend: catalogsRoutes.ts — new endpoint without hubId requirement
  - Frontend API: `deleteCatalogDirect(metahubId, catalogId)` function
  - Mutation: `useDeleteCatalog` now calls direct endpoint when hubId undefined
  - CatalogList: Updated `deleteEntity` logic for catalogs without hubs

**Security Fix (🔴)**:
- [x] **escapeLikeWildcards SQL injection**: Applied to loadMembers in campaigns-backend and clusters-backend

**Code Consolidation (🟡)**:
- [x] **getRequestManager centralization**: Removed 19 local definitions across 8 backend packages
  - campaigns-backend (3 files), clusters-backend (3 files), metahubs-backend (5 files)
  - organizations-backend (3 files), metaverses-backend (3 files), storages-backend (2 files)
  - admin-backend (3 files), projects-backend (3 files)
  - All now import from `../utils` → `@universo/utils/database`
  - Created parserUtils.ts for admin-backend, updated tsconfig to moduleResolution: node16

**Low Priority (🟢)**:
- [x] **Type exports template-mui**: BlockingEntitiesDeleteDialog + EntitySelectionPanel already exported

**Final**:
- [x] Build verification: full monorepo `pnpm build` — SUCCESS (61 tasks)

---

## ✅ COMPLETED (2026-01-11): QA Recommendations Implementation (Code Consolidation)

**Context**: QA audit (8.5/10) identified code duplication and opportunities for shared component extraction.

**High Priority (🔴)**:
- [x] **escapeLikeWildcards**: Centralize to `@universo/utils` → re-export in 4 backends
- [x] **getVLCString**: Move to `@universo/utils/vlc` with enhanced utilities
- [x] **Add @universo/utils dependency** to @universo/template-mui (was importing without declaring)

**Medium Priority (🟡)**:
- [x] **sanitizeCodename**: Add wrapper to `@universo/utils/validation/codename`
- [x] **CodenameField**: Extract to `@universo/template-mui/components/forms`
- [x] **Unit tests for escapeLikeWildcards**: 9 test cases (escaping.test.ts)
- [x] **Unit tests for getVLCString**: 20+ test cases (getters.test.ts)
- [x] **Unit tests for CodenameField**: 14 test cases (CodenameField.test.tsx)

**Low Priority (🟢)** — Addressed:
- [x] **Fix lint errors in template-mui**: Refactored LocalizedInlineField (was: 16 errors → 0 errors, 101 warnings)
    - Separated into SimpleInlineField + LocalizedInlineFieldContent to fix react-hooks/rules-of-hooks

**Low Priority (🟢)** — Completed:
- [x] **HubSelectionPanel**: Generalized to `EntitySelectionPanel<T>` in @universo/template-mui
    - Created generic component with configurable labels, callbacks, table columns
    - HubSelectionPanel now thin wrapper (~90 lines vs 325 original)
- [x] **HubDeleteDialog**: Generalized to `BlockingEntitiesDeleteDialog<T, B>` in @universo/template-mui
    - Created generic dialog with blocking entities check and display
    - HubDeleteDialog now thin wrapper (~120 lines vs 175 original)
- [x] **ds.manager.* pattern**: Applied `getRequestManager(req, ds)` across all route handlers
    - uniks-backend (2 calls), storages-backend (4 calls), start-backend (13+ calls)
    - campaigns-backend (4 calls), clusters-backend (4 calls)
    - admin-backend globalAccessService: documented as TODO (service layer without request context)

**Final**:
- [x] Build verification: full monorepo `pnpm build` — SUCCESS (61 tasks)

---

## ✅ COMPLETED (2026-01-11): QA Fixes — QueryRunner Consistency + Security

**Context**: QA audit identified 4 critical/recommended issues (rating 7.5/10):
1. `ds.query()` calls in admin-backend without QueryRunner
2. Missing `escapeLikeWildcards` in admin-backend search endpoints
3. `createAccessGuards` factory not supporting QueryRunner parameter
4. `ds.manager.find()` without request-scoped manager in loadMembers

**Fixes Applied**:
- [x] Created `escapeLikeWildcards(value: string)` utility in `admin-backend/src/utils/index.ts`
- [x] Applied escape to 3 search locations (instancesRoutes.ts, rolesRoutes.ts x2)
- [x] Extended `AccessGuardsConfig` interface with QueryRunner parameter in all callbacks
- [x] Updated `createAccessGuards` factory (ensureAccess, getMembershipSafe) to pass queryRunner
- [x] Updated all 8 backend modules with `getManager(ds, queryRunner?)` helper:
  - organizations-backend, storages-backend, campaigns-backend, uniks-backend
  - metaverses-backend, clusters-backend, projects-backend, metahubs-backend
- [x] Updated loadMembers pattern in 9 places (org/meta/proj backends) to use `getRequestManager(req, ds)`
- [x] Build verification: full monorepo `pnpm build` — SUCCESS (61 tasks)

---

## 🔜 NEXT: Validate Record Creation Freeze + QA Fixes

- [x] Implement fix: reuse request-scoped QueryRunner for all metahubs guard/global checks
- [x] Update admin-backend exported helpers to accept optional QueryRunner
- [x] Update metahubs-backend guards to accept QueryRunner and use `queryRunner.manager`
- [x] Update metahubs-backend routes to pass `req.dbContext?.queryRunner` into guards
- [x] Apply escapeLikeWildcards to admin-backend search endpoints (SQL injection protection)
- [x] Extend createAccessGuards with QueryRunner support (8 modules)
- [x] Update loadMembers pattern in organizations/metaverses/projects backends
- [x] Build verification: full monorepo `pnpm build` — SUCCESS
- [ ] Manual QA: create records repeatedly and confirm UI does not hang (Metahubs + Admin)
- [ ] Confirm server logs show QueryRunner cleanup/release per request under normal usage


## ✅ COMPLETED (2026-01-11): RLS QueryRunner Stability + CompactListTable Header

- [x] CompactListTable: make sticky header background match FlowListTable header
- [x] ensureAuthWithRls: make QueryRunner cleanup idempotent (avoid double release/race)
- [x] Build verification (full monorepo `pnpm build`)

## ✅ COMPLETED (2026-01-11): Metahubs Cache + HubDeleteDialog UX

- [x] Fix stale counters after create/update (invalidate hub/catalog aggregates)
   - Note: `usePaginated` default `staleTime` is 5 minutes; correctness should come from mutation-driven invalidation.
- [x] HubDeleteDialog: useQuery for blocking catalogs + `refetchOnWindowFocus: "always"` (MVP, no polling)
- [x] HubDeleteDialog: improve blocking catalogs mini-table ("#" column, sticky header, fixed height with scroll, links to catalogs)
- [x] HubDeleteDialog: make row cells clickable (index + name + codename)
- [x] HubDeleteDialog: prevent codename column from shrinking (min width + no-wrap)
- [x] Extract reusable mini-table component (CompactListTable) in universo-template-mui and use it in HubDeleteDialog
- [x] Document CompactListTable reuse pattern in systemPatterns.md
- [x] Validate changes (package lint + full `pnpm build`)

## ✅ RECENTLY COMPLETED

### 2026-01-11: Bug Fixes for Catalog/Hub Operations ✅ COMPLETE

**Context**: Three bugs reported:
1. Editing catalog without hub silently failed (no save)
2. Hub delete from menu showed old dialog instead of HubDeleteDialog
3. GET /blocking-catalogs returned 500 error (TypeORM alias issue)

**Root Causes**:
1. Frontend `updateEntity` returned early if no hubId, and no metahub-level PATCH endpoint existed
2. HubActions delete action used ConfirmDeleteDialog instead of calling openDeleteDialog helper
3. TypeORM query used raw table name instead of entity relation for joins

**Fixes Applied**:
- [x] Fixed TypeORM queries in hubsRoutes.ts - use entity relations (`c.catalogHubs`) instead of raw table names
- [x] Added PATCH `/metahubs/:metahubId/catalogs/:catalogId` endpoint for metahub-level catalog updates
- [x] Added `updateCatalogAtMetahub` API function and `useUpdateCatalogAtMetahub` mutation hook
- [x] Updated CatalogList.tsx `updateEntity` to use metahub-level endpoint when catalog has no hubs
- [x] Changed HubActions delete action to use `onSelect` that calls `openDeleteDialog` helper
- [x] Updated `openDeleteDialog` in HubList.tsx to accept both Hub and HubDisplay types
- [x] Fixed HubDeleteDialog to render blocking catalog `name` (VLC) as a localized string
- [x] Full project build verified (61 tasks successful)

---

### 2026-01-11: Catalog-Hub Relationship Improvements ✅ COMPLETE

**Context**: User reported catalogs without hubs show "Error loading catalog". Implemented `isRequiredHub` option to allow catalogs to exist without hub associations and protect hub deletion from orphaning critical catalogs.

**Phase 1: Database & Entity** ✅
- [x] Created migration `1766500000000-AddIsRequiredHubToCatalogs.ts` with `is_required_hub` column
- [x] Updated Catalog entity with `isRequiredHub` boolean (default: false)
- [x] Registered migration in postgres/index.ts


### 2026-01-11: Metahubs Catalog/Hub/UX Work ✅ (summary)

- [x] Catalog↔Hub N:M + `isSingleHub`/`isRequiredHub` semantics + hub deletion protection (details in progress.md)
- [x] Metahub-level catalog endpoints to support hub-less catalogs (details in progress.md)
- [x] HubDeleteDialog: blocking catalogs via query + focus refetch (no polling) + shared CompactListTable (details in progress.md)

---
- [x] Implement TabPanel helper component
- [x] Export TabConfig type from dialogs index

**Phase 4: HubSelectionPanel Component** ✅ COMPLETE
- [x] Create HubSelectionPanel for multi-hub selection with add/remove UI
- [x] Add hub picker dialog with search and multi-select
- [x] Integrate isSingleHub toggle with validation
- [x] Export from components index

**Phase 5: Frontend Types & API** ✅ COMPLETE
- [x] Update Catalog types with `metahubId`, `isSingleHub`, `hubs`
- [x] Add HubRef interface for hub associations
- [x] Update API client (CatalogWithHubs, force param)
- [x] Update AllCatalogsList with tabbed form (General + Hubs tabs)
- [x] Update useDeleteCatalog hook with force param

**Phase 6: Routes & Breadcrumbs** ✅ COMPLETE
- [x] Updated MainRoutesMUI with catalog routes
- [x] Updated NavbarBreadcrumbs for catalog-aware navigation
- [x] Catalog-centric routes (without hubId) DEFERRED — requires API changes

**Phase 7: i18n & Testing** ✅ COMPLETE
- [x] Added i18n keys for tabs, hub selection UI (en/ru)
- [x] Full build verification — SUCCESS (61 tasks, 4m48s)

**NEXT STEPS**:
1. Run `pnpm dev` to apply database migration (creates `catalogs_hubs` table)
2. Test catalog creation with tabbed form and multiple hub selection
3. Verify isSingleHub toggle functionality
4. Test delete behavior (force vs soft remove from hub)


### 2026-01-10: Metahubs/Catalogs Code Quality Improvements

**Phase 1: Backend N+1 Query Optimization (HIGH)** ✅
- [x] Optimize catalogsRoutes.ts — replace N+1 with single query + LEFT JOINs
- [x] Optimize hubsRoutes.ts — apply same pattern for consistency
- [x] Verify full workspace build (SUCCESS)

**Phase 2: Frontend Refactoring (MEDIUM)** ⏸️
- [x] ~~Merge CatalogList/AllCatalogsList~~ — DEFERRED (high risk for production, differences too significant)
- [x] Create shared utilities for common patterns

**Phase 3: Code Quality (LOW)** ✅
- [x] Centralize localStorage keys (constants/storage.ts)
- [x] Create useViewPreference hook
- [x] Apply hook to all list pages (6 files updated)

### 2026-01-10: Catalogs QA Round 9 — Metahubs i18n + Access sorting ✅

- [x] Fix Metahubs list count headers (Hubs/Catalogs) to translate in RU
   - Note: Metahubs i18n namespace is consolidated and flattens `bundle.metahubs` into root keys (use `table.hubs` / `table.catalogs`)
- [x] Add sorting to MetahubMembers (Access): Email, Nickname, Added
- [x] Full project rebuild — verify UI strings compile
   - Note: Build succeeded; UI may require hard refresh/restart to pick up updated locale bundles.

### 2026-01-10: Catalogs QA Round 8 — Sorting & Column Improvements ✅

1. [x] Add sorting to Name, Description columns in MetahubList.tsx
2. [x] Add sorting to Name, Description, Codename columns in HubList.tsx
3. [x] Add sorting to Name, Description, Codename columns in CatalogList.tsx
4. [x] Add sorting to Name, Description, Codename columns in AllCatalogsList.tsx
5. [x] Replace MetaSections/MetaEntities columns with Hubs/Catalogs in MetahubList.tsx
6. [x] Add i18n keys for hubs and catalogs table headers in metahubs.json
7. [x] Add catalogsCount to backend Metahub API response
8. [x] Add catalogsCount to frontend Metahub and MetahubDisplay types
9. [x] Replace dashboard Секции/Сущности widgets with Хабы/Каталоги in MetahubBoard.tsx
10. [x] Update i18n keys for dashboard stats (hubs, catalogs)
11. [x] Full project rebuild — **SUCCESS (61 tasks, 4m59s)**


## ✅ RECENTLY COMPLETED

### 2026-01-10: Catalogs QA Round 6 — UX Improvements ✅

1. [x] Removed description text from AllCatalogs ViewHeader (`t('catalogs.allDescription')`)
2. [x] Reordered table columns (Name first, Codename second) in:
   - AllCatalogsList.tsx
   - HubList.tsx
   - CatalogList.tsx
   - AttributeList.tsx
3. [x] Fixed tab navigation URLs in AttributeList/RecordList (was missing `/catalogs/${catalogId}`)
4. [x] Added `useCatalogName` hook for breadcrumb name fetching
5. [x] Updated `useAttributeName` to accept catalogId parameter (new API path)
6. [x] Added `truncateCatalogName` function
7. [x] Updated NavbarBreadcrumbs.tsx for new catalog-based URL structure:
   - Added support for `/metahub/:id/catalogs` (global catalogs)
   - Added support for `/metahub/:id/hubs/:hubId/catalogs` (hub catalogs)
   - Added support for `/metahub/:id/hubs/:hubId/catalogs/:catalogId/attributes|records`
8. [x] Full project rebuild — **SUCCESS (61 tasks, 5m26s)**

### 2026-01-10: Memory Bank Maintenance — Compression + Logging ✅

- [x] Add progress.md entry for Catalogs QA Round 5 (All Catalogs create parity)
- [x] Compress activeContext.md to ≤100 lines (keep current focus only)
- [x] Compress tasks.md to 400–500 lines (preserve all open tasks + last 14 days)
- [x] Compress progress.md to 400–500 lines (keep releases table + last 3 months)
- [x] Compress systemPatterns.md to ≤500 lines
- [x] Compress techContext.md to ≤300 lines


### 2026-01-10: Catalogs QA Round 5 — All Catalogs Create UX parity ✅

1. [x] Fixed AllCatalogsList primary Add label translation (stop showing raw i18n key)
2. [x] Aligned AllCatalogsList create dialog with CatalogList multilingual form + hub selector
3. [x] Verified edit dialog supports changing hub from AllCatalogsList context (hubs passed via action context)
4. [x] Full project rebuild — SUCCESS (61 tasks, 5m46s)

### 2026-01-10: Catalogs QA Round 4 — Add Button & Hub Editing ✅

**Issues addressed:**

1. [x] **Missing "Add" button** — Fixed `addButton` → `primaryAction` prop name in ToolbarControls
2. [x] **Hub editing support** — Added ability to change hub when editing catalog from AllCatalogsList:
   - Added `hubId` to `updateCatalogSchema` in backend
   - Added hub moving logic in PATCH endpoint
   - Updated `CatalogActions.tsx` with hub selector in edit dialog
   - Updated `AllCatalogsList.tsx` to pass hubs and updateEntity to context
3. [x] Full project rebuild — **SUCCESS (61 tasks, 6m59s)**

### 2026-01-10: Catalogs QA Round 3 — Menu, Breadcrumbs & i18n Fixes ✅

**Issues addressed from third QA round:**

1. [x] **Cache invalidation** — Added `allCatalogs` cache invalidation to `useCreateCatalog`, `useUpdateCatalog`, `useDeleteCatalog` mutations
2. [x] **Breadcrumbs for Catalogs** — Added `catalogs` menu item with `breadcrumbs: true` in `metahubDashboard.ts`
3. [x] **Rename "Все каталоги"** — Changed `catalogs.allTitle` from "Все каталоги" to "Каталоги" (ru), "All Catalogs" to "Catalogs" (en)
4. [x] **Add button with hub selector** — Added EntityFormDialog with hub dropdown selector to AllCatalogsList.tsx
5. [x] **"Справочники" → "Каталоги"** — Fixed all remaining occurrences in `hubs.catalogsCount`, `hubs.deleteDialog.message`, `attributes.description`, `attributes.emptyDescription`, `records.description`, `records.emptyDescription`, `records.addAttributesFirst`, `records.noAttributes`
6. [x] **"атр." → full word** — Changed to proper plural forms: `attributesCount_one/few/many/other` for Russian, `_one/_other` for English
7. [x] **HubList interpolation** — Fixed `{hub.catalogsCount} {t('hubs.catalogsCount')}` → `{t('hubs.catalogsCount', { count: hub.catalogsCount })}`
8. [x] Full project rebuild — **SUCCESS (61 tasks, 7m12s)**

### 2026-01-10: Catalogs QA Round 2 — Final Bug Fixes ✅

**Issues found during second QA testing round:**

1. [x] **Russian translation "Справочники" → "Каталоги"** — Changed all occurrences in `ru/metahubs.json`
2. [x] **Card shows "0 {{count}} атр" interpolation error** — Fixed i18n plural keys format (`attributesCount_one`, `attributesCount_few`, `attributesCount_many`, `attributesCount_other`) and fixed CatalogList.tsx to use proper interpolation `{t('key', { count })}`
3. [x] **Menu shows raw "catalogs" key** — Added `catalogs` key to `universo-i18n/locales/*/views/menu.json` (en: "Catalogs", ru: "Каталоги")
4. [x] **AllCatalogsList poorly designed** — Completely rewritten to match HubList.tsx pattern (MainCard, ViewHeader, ToolbarControls, ItemCard grid with Chip for hub name, FlowListTable with hub column, PaginationControls, ConfirmDeleteDialog)
5. [x] **500 error on attributes API** — Added missing `target_catalog_id` column to migration `1766400000000-AddCatalogsToMetahubs.ts` with FK constraint to catalogs table
6. [x] Full project rebuild — **SUCCESS (61 tasks, 4m55s)**

### 2026-01-10: Catalogs Post-Implementation Fixes & Features ✅

**Issues found during QA testing:**

#### Bug Fixes ✅
- [x] Fix i18n keys not translating (catalogs.title, catalogs.empty) — Added `catalogs` to `consolidateMetahubsNamespace()` in i18n/index.ts
- [x] Fix 500 Internal Server Error — was caused by stale build; rebuild resolved it

#### New Feature: "All Catalogs" Global View ✅
- [x] Add backend endpoint `GET /metahubs/:metahubId/catalogs` to list all catalogs across all hubs
- [x] Add `listAllCatalogs()` API function in frontend (with `CatalogWithHub` type)
- [x] Add `allCatalogs`, `allCatalogsList` queryKeys in queryKeys.ts
- [x] Create `AllCatalogsList.tsx` page component with hub info display (Chip badge)
- [x] Add route `/metahub/:metahubId/catalogs` in MainRoutesMUI.tsx
- [x] Add "Catalogs" menu item in metahub sidebar navigation (menuConfigs.ts with IconDatabase)
- [x] Add `catalogs` i18n key in menu.json (en: "Catalogs", ru: "Каталоги")
- [x] Add `allTitle`, `allDescription`, `emptyHint`, `noSearchResults`, `noSearchResultsHint`, `deleted`, `deleteTitle`, `deleteMessage`, `countsHeader`, updated `attributesCount`/`recordsCount` with `{{count}}` i18n keys
- [x] Export AllCatalogsList from package index.ts
- [x] Full project rebuild — **SUCCESS (61 tasks)**

### 2026-01-09: Add Catalogs entity to Metahubs (1C-style Справочники) ✅

**Goal**: Add Catalogs as child level within Hubs. Catalogs are analogous to "Справочники" in 1C:Enterprise.

**Architecture**: `Metahub → Hub → Catalog → Attributes + Records`

#### Phase 1: Backend — Database & Entities ✅
- [x] Create migration `AddCatalogsToMetahubs` (new table, update attributes/records)
- [x] Create `Catalog.ts` TypeORM entity
- [x] Update `Attribute.ts` entity (hubId → catalogId)
- [x] Update `Record.ts` entity (hubId → catalogId)
- [x] Update `entities/index.ts` exports
- [x] Update `migrations/postgres/index.ts`

#### Phase 2: Backend — API Routes ✅
- [x] Create `catalogsRoutes.ts`
- [x] Update `attributesRoutes.ts` (URLs, hubId → catalogId)
- [x] Update `recordsRoutes.ts` (URLs, hubId → catalogId)
- [x] Update `guards.ts` (add ensureCatalogAccess)
- [x] Update `routes/index.ts`
- [x] Update backend `index.ts` exports
- [x] Update `hubsRoutes.ts` (use catalogsCount instead of attributes/records)
- [x] Update `publicMetahubsRoutes.ts` (add Catalog level)

#### Phase 3: Frontend — Types & API ✅
- [x] Update `types.ts` (Catalog types, Attribute/Record catalogId)
- [x] Create `api/catalogs.ts`
- [x] Update `api/attributes.ts` (URLs, catalogId)
- [x] Update `api/records.ts` (URLs, catalogId)
- [x] Update `api/queryKeys.ts`
- [x] Update `hooks/mutations.ts`

#### Phase 4: Frontend — Pages & Components ✅
- [x] Create `CatalogList.tsx` page (copy from HubList.tsx)
- [x] Create `CatalogActions.tsx` (copy from HubActions.ts)
- [x] Update `AttributeList.tsx` (catalogId param)
- [x] Update `RecordList.tsx` (catalogId param)
- [x] Update routes in `MainRoutesMUI.tsx`
- [x] Update `HubList.tsx` (routes → catalogs, catalogsCount column)

#### Phase 5: i18n ✅
- [x] Add English translations for catalogs
- [x] Add Russian translations for catalogs
- [x] Update hubs/attributes/records translations for new hierarchy

#### Phase 6: Final exports & testing ✅
- [x] Update all index.ts exports
- [x] Import CatalogList in MainRoutesMUI.tsx
- [x] Add routes for catalogs level
- [x] Full project build verification — **SUCCESS (61 tasks)**

---

### 2026-01-10: QA fixes from PR #635 review ✅

- [x] Fix `replace('_', '-')` in `universo-utils/vlc/sanitize.ts` → use `replace(/_/g, '-')` for global replacement.
- [x] Fix metahubsRoutes.ts sorting hardcoded 'en' → use `COALESCE(m.name->>(m.name->>'_primary'), m.name->>'en', '')` pattern.
- [x] Create `CodenameField.tsx` shared component in metahubs-frontend for consistent codename field behavior.
- [x] Refactor `HubFormFields` in HubList.tsx to use `CodenameField`.
- [x] Refactor `AttributeFormFields` in AttributeList.tsx to use `CodenameField`.
- [x] Refactor `HubEditFields` in HubActions.tsx to use `useCodenameAutoFill` hook + `CodenameField`.
- [x] Refactor `AttributeEditFields` in AttributeActions.tsx to use `useCodenameAutoFill` hook + `CodenameField`.
- [x] Build verification: universo-utils, metahubs-backend, metahubs-frontend all compile successfully.
- **Result**: All 3 QA issues resolved; ~45 lines of duplicated codename field logic removed via shared component.

### 2026-01-10: Metahubs code deduplication refactoring ✅

- [x] Create `vlc/sanitize.ts` in universo-utils with `sanitizeLocalizedInput()` and `buildLocalizedContent()` functions.
- [x] Create `validation/codename.ts` in universo-utils with `CODENAME_PATTERN`, `normalizeCodename()`, `isValidCodename()` functions.
- [x] Update universo-utils exports (package.json, tsdown.config.ts) to expose new modules.
- [x] Update metahubs-backend routes (attributesRoutes, hubsRoutes, metahubsRoutes) to use shared functions.
- [x] Update metahubs-frontend codename.ts to re-export shared utilities.
- [x] Create `useCodenameAutoFill` hook in universo-template-mui for form codename auto-generation.
- [x] Refactor HubList.tsx to use `useCodenameAutoFill` hook instead of duplicated useEffect.
- [x] Refactor AttributeList.tsx to use `useCodenameAutoFill` hook instead of duplicated useEffect.
- [x] Full project build successful.
- **Result**: Removed ~112 lines of duplicated code in backend, created reusable hook for frontend.

### 2026-01-09: Metahubs VLC rollout — PR #635 opened ✅

- [x] Opened PR #635 containing Metahubs localized Attributes/Records (VLC) and UI/backend updates; includes FlowListTable header center fix.
- [x] All changed files committed and pushed to `feature/metahubs-vlc`.
- [x] Local `pnpm build` completed; request CI & reviewers.

### 2026-01-09: FlowListTable centered sortable column fix ✅

- [x] Replace complex grid-based centering with standard MUI flex approach for TableSortLabel.
- [x] Use inline-flex + justifyContent: center on TableSortLabel for center-aligned sortable columns.
- [x] Remove nested Box wrapper with grid layout that caused misalignment.
- [x] Build entire project to apply changes.

### 2026-01-08: Records UI localization fixes ✅

- [x] Switch record field labels to VLC-aware rendering and fix "1" placeholders.
- [x] Add localized input for STRING record fields using LocalizedInlineField.
- [x] Disable record save when all fields are empty and strip empty values before submit.
- [x] Localize records table "Updated" column.
- [x] Replace record actions to open the correct record dialogs (fix metahub delete copy).
- [x] Build metahubs-frontend after changes.

### 2026-01-08: Record save validation (VLC strings) ✅

- [x] Allow record validation to accept VLC objects for STRING fields.
- [x] Apply required/validation rules against VLC primary content.
- [x] Build metahubs-backend after changes.

### 2026-01-08: Record edit hydration fix ✅

- [x] Pass raw record data to record actions and fetch full record when missing.
- [x] Build metahubs-frontend after changes.

### 2026-01-08: Record edit initial render guard ✅

- [x] Delay record edit fields until initial data is hydrated to avoid empty first render.
- [x] Build metahubs-frontend after changes.

### 2026-01-08: Attributes localization + codename cleanup ✅

- [x] Update Attribute domain types/display to use VLC for name (drop description) and fix attribute table rendering.
- [x] Implement localized create/edit UI for attributes with codename auto-fill and no description field.
- [x] Replace Attribute actions dialog to support localized name + codename editing.
- [x] Align attributes API payloads/mutations with localized inputs + primary locale fields.
- [x] Update attributes backend routes to use sanitized localized inputs, primary locale handling, and codename normalization/validation.
- [x] Remove attribute description column/labels from UI and update i18n helper/validation strings.
- [x] Run package builds/tests relevant to metahubs frontend/backend changes.

### 2026-01-06: Metahubs localization hardening ✅

- [x] Harden metahubs localized field handling to avoid crashes on mixed formats (VLC / SimpleLocalizedInput / string).
- [x] Align metahubs create/update mutations with localized payloads based on current UI language.
- [x] Adjust metahubs frontend tests to cover VLC payloads and updated mutation calls.
- [x] Verify metahubs list rendering is resilient for language variants (e.g., ru-RU) and update docs if needed.

### 2026-01-06: Internationalize project metadata and update texts ✅

- [x] Added locale metadata files: `packages/universo-i18n/base/src/locales/en/core/meta.json`, `packages/universo-i18n/base/src/locales/ru/core/meta.json`
- [x] Updated translations for landing and onboarding (`start-frontend` en/ru)
- [x] Updated frontend entrypoints to consume metadata (`packages/flowise-core-frontend/base/index.html`, `packages/flowise-core-frontend/base/src/App.jsx`)
- [x] Updated documentation and package metadata: `README.md`, `README-RU.md`, `package.json`
- [x] Created issue #630 and pull request #631
- [x] Applied bot review recommendations: added `packages/universo-i18n/base/src/supported-languages.json` and `packages/flowise-core-frontend/base/scripts/sync-supported-langs.mjs`; pushed to PR #631.
- [x] Applied additional review improvements: fixed LanguageSwitcher components (template-mui & flowise-template-mui), adjusted `packages/universo-i18n/base/package.json`, and tweaked `vite.config.js`; pushed to PR #631.
- **Validation**: Verify EN/RU strings on landing and onboarding, run `pnpm --filter <package> lint`, then `pnpm build` at repo root

### 2026-01-05: Improve Login Error Messages UX ✅

- [x] Update `errorMapping.ts` — add mapping `Invalid credentials` → `loginFailed`
- [x] Add `loginFailed` i18n key to EN locale
- [x] Add `loginFailed` i18n key to RU locale
- [x] Update `serverError` messages in both locales (more informative)
- [x] Lint check `auth-frontend` and `@universo/i18n` (0 errors)
- [x] Full workspace build passed (61 tasks, 4m36s)
- **Result**: "Ошибка сервера" → "Не удалось войти в систему. Проверьте email и пароль или зарегистрируйтесь, если у вас ещё нет аккаунта."
- **Security**: Message doesn't reveal if email exists (OWASP best practice)
- **Pattern**: `mapSupabaseError()` now matches both Supabase and backend error messages

### 2026-01-04: PR #627 Bot Review Fixes ✅

- [x] Fixed DRY violation: extracted mode switcher outside conditional block in AuthView.tsx
- [x] Combined two useEffect hooks into one with Promise.allSettled in AuthPage.tsx
- [x] Fixed systemPatterns.md: documentation now correctly reflects flat config structure (not nested)
- **Changes**: Auth frontend code quality improvements per Gemini/Copilot review comments

### 2025-01-10: Auth Disabled State UX Refinements ✅

- [x] Auth disabled-state UX refinements (conditional rendering pattern). See systemPatterns.md (auth disabled state).

### 2026-01-03: Auth Feature Toggles & Legal Pages Footer ✅

- [x] **Phase 1**: Added StartFooter to LegalPage.tsx (Terms/Privacy pages)
- [x] **Phase 2**: Added AUTH_* env variables to .env and .env.example (AUTH_REGISTRATION_ENABLED, AUTH_LOGIN_ENABLED, AUTH_EMAIL_CONFIRMATION_REQUIRED)
- [x] **Phase 3**: Created @universo/utils/auth module with getAuthFeatureConfig(), isRegistrationEnabled(), isLoginEnabled(), isEmailConfirmationRequired()
- [x] **Phase 4**: Added `/auth-config` endpoint to auth-backend (separate from captcha-config)
- [x] **Phase 5**: Updated auth-frontend types (AuthFeatureConfig interface), AuthView with disabled state UI, AuthPage with useEffect to fetch auth-config
- [x] **Phase 6**: Added i18n keys (registrationDisabled, loginDisabled, successRegisterNoEmail) to en/ru locales
- [x] **Phase 7**: Updated Auth.jsx wrapper with new labels
- [x] **Phase 8**: Added auth submodule export to tsdown.config.ts and package.json exports
- [x] Full workspace build passed (61 tasks, 4m58s)
- **Pattern**: Separate endpoint for auth feature config (like captcha-config pattern), env-driven toggles with defaults to true for backwards compatibility

### 2026-01-03: i18n Migration to registerNamespace() Pattern ✅

- [x] Added `landing` namespace registration to `i18n/index.ts` via `registerNamespace()`
- [x] Refactored `Testimonials.tsx` - removed legacy `useEffect` + `registerLandingI18n`, switched to `@universo/i18n`
- [x] Refactored `Hero.tsx` - removed legacy pattern, switched to `@universo/i18n`
- [x] Refactored `StartFooter.tsx` - removed legacy pattern, switched to `@universo/i18n`
- [x] Refactored `AuthenticatedStartPage.tsx` - removed redundant `registerOnboardingI18n` call
- [x] Marked legacy functions in `register.ts` as `@deprecated` with migration guidance
- [x] Marked legacy exports in `index.ts` as `@deprecated`
- [x] Lint passed: start-frontend (0 errors after --fix)
- [x] Full workspace build passed (61 tasks, 6m8s)

### 2026-01-03: Start Section Footer & Onboarding Text Updates ✅

- [x] Created StartFooter component with contact info (owner, email) and legal links
- [x] Added footer i18n keys to landing.json (ru/en)
- [x] Exported StartFooter from components/index.ts
- [x] Integrated StartFooter in GuestStartPage
- [x] Integrated StartFooter in AuthenticatedStartPage
- [x] Added description4 to WelcomeStep (Universo MMOOMM metaverse text)
- [x] Updated projects subtitle in onboarding.json (ru/en)
- [x] Updated campaigns title and subtitle in onboarding.json (ru/en)
- [x] Updated clusters subtitle in onboarding.json (ru/en)
- [x] Adjusted guest footer hover color to a lighter blue for contrast (kept internal hover blue)
- [x] Fixed onboarding subtitle paragraph rendering (split by blank line into two Typography blocks)
- [x] Reduced guest footer top spacing to zero (bring closer to module cards)
- [x] Restored guest cards↔footer spacing to 4 modules after rollback (Testimonials `pb`)
- [x] Made AppAppBar brand (logo + name) clickable with link to home route
- [x] Verified start-frontend lint and build
- [x] Lint passed: start-frontend (0 errors after --fix)
- [x] Full workspace build passed (61 tasks, 8m20s)

### 2026-01-02: SmartCaptcha Login Form Support ✅

- [x] Added `SMARTCAPTCHA_LOGIN_ENABLED` env variable to .env and .env.example
- [x] Created `createLoginCaptchaService()` factory in @universo/utils/captcha shared module
- [x] Updated auth-backend captchaService with login captcha exports (getLoginCaptchaConfig, isLoginCaptchaRequired, validateLoginCaptcha)
- [x] Updated `/captcha-config` endpoint to return both registration and login configs (with legacy format for backwards compatibility)
- [x] Added captcha validation to `/login` route (LoginSchema now accepts optional captchaToken)
- [x] Updated auth-frontend types: SingleCaptchaConfig, CaptchaConfig with registration/login fields
- [x] Updated AuthView.tsx: mode-specific captcha config, shows captcha widget on both login/register, button disabled until captcha completed
- [x] Updated AuthProvider: login signature now accepts optional captchaToken
- [x] Updated AuthPage.tsx: handleLogin forwards captchaToken to login
- [x] Lint passed: auth-frontend (0 errors), auth-backend (0 errors), @universo/utils (0 errors)
- [x] Full workspace build passed (61 tasks, 5m46s)
- **Pattern**: Factory pattern with separate env vars for granular control (SMARTCAPTCHA_REGISTRATION_ENABLED, SMARTCAPTCHA_LOGIN_ENABLED)
- **UX**: Login button disabled until captcha completed when enabled

### 2026-01-02: Captcha QA Fixes — Code Quality & Shared Module ✅

- [x] Fixed P0 React Hooks order violation in AuthPage.tsx (moved useCallback before early return)
- [x] Fixed P1 Prettier errors in auth-frontend (ran prettier --fix, reformatted function signatures)
- [x] Fixed P1 `err: any` typing → `err: unknown` with proper type casting in AuthPage.tsx and AuthView.tsx
- [x] Created @universo/utils/captcha shared module (extracted from auth-backend and leads-backend)
- [x] Implemented factory pattern: `createRegistrationCaptchaService()`, `createPublicationCaptchaService()`
- [x] Replaced native https.request with axios (cleaner error handling, timeout support, catalog dependency)
- [x] Updated leads-backend tsconfig.json: moduleResolution node → node16 (for subpath exports)
- [x] auth-frontend lint: 0 errors (down from 9), 11 warnings
- [x] Full workspace build passed (61 tasks successful)
- **Deduplication**: ~250 lines of duplicate captcha code → 35 lines per service (re-export pattern)
- **Consistency**: Both captcha services now share identical validation logic

### 2026-01-02: SmartCaptcha Fail-Closed Security Hardening ✅

- [x] Implemented fail-closed behavior for auth-backend captchaService.ts
- [x] Implemented fail-closed behavior for flowise-leads-backend captchaService.ts
- [x] All error cases now return `{ success: false, error: '...' }` instead of allowing bypass
- [x] Error messages: "Captcha service is not configured", "Captcha service unavailable", "Captcha service error", "Captcha service timeout"
- [x] Ran lint --fix on auth-backend (0 errors, 40 warnings)
- [x] Ran lint --fix on flowise-leads-backend (0 errors, 5 warnings)
- [x] Full workspace build passed (61 tasks successful)
- **Security**: When Yandex SmartCaptcha API is unavailable, registration and lead forms are blocked
- **Rationale**: "единственная возможность пройти дальше это пройти эту капчу"

### 2026-01-01: Server-side Captcha Validation for Leads ✅

- [x] Added `captchaToken?: string` to CreateLeadPayload type (universo-types)
- [x] Created captchaService.ts in flowise-leads-backend (mirrors auth-backend pattern)
- [x] Added `isPublicationCaptchaRequired()` and `validatePublicationCaptcha(token, ip)` functions
- [x] Updated leadsService.ts with captcha validation before lead creation
- [x] Updated leadsRoutes.ts to pass clientIp from request
- [x] Exported captcha functions from leads-backend index
- **Security**: Server key (ysc2_...) used only in backend; fail-open on API errors (5s timeout)
- **Trigger**: `SMARTCAPTCHA_PUBLICATION_ENABLED=true` env variable

### 2026-01-01: SmartCaptcha Domain Fix in /p/:slug ✅

- [x] Created quizRenderService.ts for server-side quiz HTML generation
- [x] Added GET /api/v1/publish/render/:slug endpoint to serve quiz HTML from server
- [x] Updated ARViewPage to use server endpoint (iframe.src) instead of blob: URL
- [x] Added /api/v1/publish/render/ to API_WHITELIST_URLS
- [x] Fixed timerConfig.position type narrowing (TimerPosition literal type)
- **Root cause**: blob: URL creates opaque origin that SmartCaptcha cannot validate
- **Solution**: Server-side rendering ensures iframe content comes from actual domain

### 2026-01-01: SmartCaptcha for Quiz Lead Forms ✅

- [x] Added `captchaEnabled` and `captchaSiteKey` to IUPDLSpace.leadCollection type
- [x] Added captcha inputs to SpaceNode (UPDL node config)
- [x] Updated DataHandler to generate SmartCaptcha HTML in lead form
- [x] Added captcha.js script loader with success/expired callbacks
- [x] Updated button state logic to require captcha token (both multi-scene and node-based)
- [x] Added captcha validation in form submission
- [x] Updated consent checkbox text to match registration form style ("Я ознакомился и принимаю")
- [x] Updated .env/.env.example documentation about test mode behavior
- [x] Added SMARTCAPTCHA_PUBLICATION_ENABLED env variable for separate control
- [x] Created captchaService.ts in publish-backend for publication captcha config
- [x] Added /captcha/config API endpoint in publish-backend routes
- [x] Whitelisted /api/v1/publish/captcha/config in API_WHITELIST_URLS (fix 401 for public /p/:slug)
- [x] Fixed published /p/:slug missing captcha by injecting publicationCaptchaConfig into template build
- [x] Fixed SmartCaptcha domain error in /p/:slug by rendering iframe content via blob URL (avoid about:srcdoc)

### 2026-01-01: Yandex Smart Captcha ✅

- [x] Backend: Captcha validation service (fail-open)
- [x] Backend: Register route update (token verification)
- [x] Frontend: AuthView update (SmartCaptcha widget, state logic)
- [x] i18n: Updated consent labels and added captcha error messages
- Details: progress.md#2026-01-01

### 2025-12-31: Cookie Consent & Lead Consent ✅

- [x] Cookie consent banner (useCookieConsent, CookieConsentBanner, CookieRejectionDialog)
- [x] Lead consent for AR.js Quiz (migration, entity, DataHandler)
- [x] Split consent_version into terms_version + privacy_version
- [x] Bot review fixes for PR #621 (SSR, localStorage, alpha(), aria role)
- Details: progress.md#2025-12-31

### 2025-12-30: Profile & Legal Pages ✅

- [x] Profile creation debug - TypeORM result parsing fix
- [x] Migration consolidation (UpdateProfileTrigger + FixProfileInsertRLS)
- [x] Legal pages (/terms, /privacy) with consent checkboxes
- [x] Database trigger for consent via raw_user_meta_data
- Details: progress.md#2025-12-30

### 2025-12-28: Onboarding & Auth Fixes ✅

- [x] Onboarding completion tracking (onboarding_completed flag)
- [x] Bot review fixes for PR #614
- [x] Auth register 419 auto-retry
- [x] Start page UI bugfixes (spacing, button flicker)
- Details: progress.md#2025-12-28

### 2025-12-26: Quiz Leads, Auth UX, Start Page i18n ✅

- [x] Completed QA fixes + Start page i18n updates. Details: progress.md#2025-12-26

### 2025-12-25: Start Page MVP & API Client Refactor ✅

- [x] Start page MVP + API client refactor. Details: progress.md#2025-12-25

### 2025-12-23: RLS & Metahubs Fixes ✅

- [x] RLS + Metahubs QA fixes. Details: progress.md#2025-12-23

### 2025-12-22: Metahubs Transformation ✅

- [x] Metahubs MVP transformation (backend + frontend). Details: progress.md#2025-12-22

### 2025-12-18: AgentFlow QA Hardening ✅

- [x] AgentFlow QA hardening + lint fixes. Details: progress.md#2025-12-18

### 2025-12-17: AgentFlow Config UX ✅

- [x] AgentFlow config UX improvements. Details: progress.md#2025-12-17

### 2025-12-15-16: AgentFlow Integration ✅

- [x] AgentFlow integration (backend + frontend). Details: progress.md#2025-12-15

### 2025-12-14: Flowise 3.0.12 Components ✅

- [x] Flowise 3.0.12 components refresh. Details: progress.md#2025-12-14


## 📋 PLANNED TASKS

### Session Persistence on Server Restart

- Status: Deferred until production deployment pattern is clear; currently using MemoryStore (auto-retry on 419 makes this non-blocking for MVP)

### Future Auth Improvements

- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
- [ ] Review auth architecture for scalability

### Admin Module Enhancements

- [ ] Role cloning, templates, permission inheritance
- [ ] Audit log for role/permission changes
- [ ] Multi-instance support (remote instances)

### Frontend UX

- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness improvements
- [ ] Tour/onboarding for new users

- [ ] Server-side caching, CDN integration
- [ ] Bundle size optimization
- [ ] Complete API documentation (OpenAPI)
- [ ] Architecture decision records (ADR)

## 🧪 TECHNICAL DEBT

- [ ] Refactor remaining useApi → useMutation
- [ ] Standardize error handling across packages
- [ ] Add unit/E2E tests for critical flows
- [ ] Resolve Template MUI CommonJS/ESM conflict
- [ ] Database connection pooling optimization

## 🔒 SECURITY TASKS

- [ ] Rate limiting for all API endpoints
- [ ] CSRF protection review
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system

## 📚 HISTORICAL TASKS

For tasks completed before 2025-11, see progress.md.
Main achievements:
- v0.40.0: Tools/Credentials/Variables/ApiKey/Assistants/Leads/ChatMessage/DocStore/CustomTemplates extraction, Admin Instances MVP, RBAC Global Roles
- v0.39.0: Campaigns, Storages modules, useMutation refactor
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics
- v0.36.0: dayjs migration, publish-frontend architecture
- v0.35.0: i18n TypeScript migration, Rate limiting, RLS analysis
- v0.34.0: Global monorepo refactoring, tsdown build system
