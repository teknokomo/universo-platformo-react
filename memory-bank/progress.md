# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.43.0-alpha | 2025-12-27 | Privacy Consent 🔒 | Cookie Consent Banner, Lead Consent for Quiz AR.js, Legal pages (Terms/Privacy), Profile consent fields |
| 0.42.0-alpha | 2025-12-18 | Onboarding Journey 🎯 | Onboarding Wizard MVP, Start page auth-conditional rendering, Marketing landing page |
| 0.40.0-alpha | 2025-12-06 | Straight Rows 🎹 | Tools, Credentials, Variables, ApiKey, Assistants, Leads, ChatMessage, DocumentStore, CustomTemplates extraction (9 packages), Canvases migrations consolidation, Admin Instances MVP, RBAC Global Roles |
| 0.39.0-alpha | 2025-11-26 | Mighty Campaign 🧙🏿 | Campaigns module, Storages module, useMutation refactor (7 packages), QA fixes |
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management system, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring (OpenAPI 3.1), Uniks metrics update, UnikBoard 7 metrics, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frontend architecture, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n TypeScript migration, Type safety improvements, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown build system, dependencies centralization |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System 429 fixes, API modernization, Metaverses refactoring, Quiz timer |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas versioning, Chatflow→Canvas terminology, PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing, Unik deletion cascade, Space Builder modes, Material-UI template |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases, Global publication library, Analytics selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Cluster isolation architecture, i18n docs checker, GitHub Copilot modes |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🛰 | Metaverses dashboard, Universal List Pattern |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Language switcher, MMOOMM template, Finance module |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Multiplayer Colyseus server |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder MVP, Metaverse module, @universo/types |

---

## 📅 2026-01-12

### Catalogs Unit Tests Added — COMPLETE ✅

- **Context**: QA audit identified test coverage gap for Catalogs routes
- **New Test File**: `packages/metahubs-backend/base/src/tests/routes/catalogsRoutes.test.ts`
  - 17 test cases covering all CRUD operations
  - Tests for: GET list, POST create, DELETE direct, DELETE hub-scoped
  - Validates: empty state, associations, validation errors, 404 cases, cascade delete
- **Mock Infrastructure**: Extended MockRepository with `count` method in typeormMocks.ts
- **All tests passing**: 17/17 ✅

---

## 📅 2026-01-11

### QA Fixes: Catalog Deletion + SQL Injection + getRequestManager Centralization — COMPLETE ✅

- **Context**: QA audit (8.5/10) + Bug report "Cannot delete catalog without hub association"
- **Critical Bug Fix**:
  - **Catalog Deletion**: Added direct DELETE endpoint `/metahubs/:metahubId/catalogs/:catalogId`
  - Backend: new route in catalogsRoutes.ts without hubId requirement
  - Frontend: `deleteCatalogDirect()` API function, updated `useDeleteCatalog` mutation
  - UI: CatalogList `deleteEntity` updated to handle catalogs without hubs
- **Security Fix**:
  - Applied `escapeLikeWildcards()` to loadMembers in campaigns-backend and clusters-backend
- **Code Consolidation (getRequestManager)**:
  - Removed 19 local definitions across 8 backend packages
  - All route handlers now import from `../utils` → `@universo/utils/database`
  - Packages: campaigns, clusters, metahubs, organizations, metaverses, storages, admin, projects
  - Created parserUtils.ts for admin-backend, updated tsconfig to moduleResolution: node16
- **Build**: Full monorepo build successful (61 tasks)

### QA Recommendations: Code Consolidation (Deferred Tasks) — COMPLETE ✅

- **Context**: Completing the 3 low-priority deferred tasks from previous QA session
- **Completed Tasks**:
  1. **EntitySelectionPanel**: Generic component in `@universo/template-mui/components/selection/`
     - Type params: `<T extends SelectableEntity>` with configurable labels, callbacks, columns
     - HubSelectionPanel refactored to thin wrapper (~90 lines vs 325 original)
  2. **BlockingEntitiesDeleteDialog**: Generic dialog in `@universo/template-mui/components/dialogs/`
     - Type params: `<T extends DeletableEntity, B extends BlockingEntity>`
     - Features: blocking entities check/display, async fetching, CompactListTable
     - HubDeleteDialog refactored to thin wrapper (~120 lines vs 175 original)
  3. **ds.manager → getRequestManager**: Applied pattern across all route handlers
     - uniks-backend (2 calls), storages-backend (4 calls), start-backend (13+ calls)
     - campaigns-backend (4 calls), clusters-backend (4 calls)
     - admin-backend globalAccessService: documented as TODO (service layer without request context)
- **Files Created**:
  - `packages/universo-template-mui/base/src/components/selection/EntitySelectionPanel.tsx`
  - `packages/universo-template-mui/base/src/components/selection/index.ts`
  - `packages/universo-template-mui/base/src/components/dialogs/BlockingEntitiesDeleteDialog.tsx`
  - `packages/universo-utils/base/src/database/manager.ts`
- **Build**: Full monorepo build successful (61 tasks)

### QA Recommendations: Code Consolidation — COMPLETE ✅

- **Context**: Follow-up QA audit (8.5/10) identified code duplication and component extraction opportunities
- **High Priority Fixes**:
  - **escapeLikeWildcards**: Centralized to `@universo/utils` (was duplicated in 4 backends)
  - **getVLCString**: Moved to `@universo/utils/vlc` with enhanced utilities (`getVLCStringWithFallback`, `getSimpleLocalizedValue`, `normalizeLocale`)
- **Medium Priority Fixes**:
  - **sanitizeCodename**: Added wrapper to `@universo/utils/validation/codename`
  - **CodenameField**: Extracted to `@universo/template-mui/components/forms`, metahubs-frontend now re-exports
- **Files Created**:
  - `packages/universo-utils/base/src/database/escaping.ts`
  - `packages/universo-utils/base/src/database/index.ts`
  - `packages/universo-utils/base/src/vlc/getters.ts`
  - `packages/universo-template-mui/base/src/components/forms/CodenameField.tsx`
- **Deferred (Low Priority)**:
  - HubSelectionPanel → EntitySelectionPanel (~4h)
  - HubDeleteDialog → BlockingEntitiesDeleteDialog (~4h)
  - ds.manager.* pattern → getRequestManager (~3h)
- **Build**: Full monorepo build successful (61 tasks)

### QA Fixes: QueryRunner Consistency + escapeLikeWildcards — COMPLETE ✅

- **Context**: QA audit rated codebase 7.5/10, identified 4 critical/recommended issues:
  1. `ds.query()` calls in admin-backend without QueryRunner
  2. Missing `escapeLikeWildcards` in admin-backend search endpoints (SQL wildcard injection)
  3. `createAccessGuards` factory not supporting QueryRunner parameter
  4. `ds.manager.find()` without request-scoped manager in loadMembers
- **Fixes Applied**:
  - **escapeLikeWildcards**: Created utility in `admin-backend/src/utils/index.ts`, applied to 3 search locations (instancesRoutes, rolesRoutes x2)
  - **createAccessGuards**: Extended `AccessGuardsConfig` interface and factory to accept optional QueryRunner, passed to all callbacks
  - **8 Backend Modules Updated**: Added `getManager(ds, queryRunner?)` helper to guards in organizations, storages, campaigns, uniks, metaverses, clusters, projects, metahubs backends
  - **loadMembers Pattern**: Updated 9 places in org/meta/proj backends to use `getRequestManager(req, ds)` instead of `ds.manager`
- **Pattern Applied**: One request = one QueryRunner = one pool connection for all DB operations
- **Build**: Full monorepo build successful (61 tasks)
- **New Rating Target**: 9/10 (all mandatory/recommended fixes applied)

### QueryRunner Pool Fix (Metahubs + Admin) — COMPLETE ✅

- **Problem**: Creating records in Metahubs sometimes caused UI freeze requiring server restart. Similar issues reported in Admin panel.
- **Root Cause**: Guard/permission checks used `DataSource.query()` which takes a second connection from pool, while request-scoped QueryRunner already held one connection. Under load, this caused pool contention and freezes.
- **Solution**: Ensure all DB operations within a request use the single request-scoped QueryRunner:
  - Updated `@universo/admin-backend` exported helpers to accept optional `QueryRunner`:
    - `isSuperuserByDataSource(ds, userId, queryRunner?)`
    - `hasSubjectPermissionByDataSource(ds, userId, subject, action, queryRunner?)`
    - `getGlobalRoleCodenameByDataSource(ds, userId, queryRunner?)`
    - `canAccessAdminByDataSource(ds, userId, queryRunner?)`
  - Updated `@universo/metahubs-backend` guards to accept optional `QueryRunner`:
    - `ensureMetahubAccess(ds, userId, metahubId, permission?, queryRunner?)`
    - `ensureHubAccess(ds, userId, hubId, permission?, queryRunner?)`
    - `ensureCatalogAccess(ds, userId, catalogId, permission?, hubId?, queryRunner?)`
    - `ensureAttributeAccess(ds, userId, attributeId, permission?, hubId?, queryRunner?)`
  - Updated all metahubs routes to pass `req.dbContext?.queryRunner` into guards/checks
  - Updated `loadMembers()` to use request-scoped manager
- **Pattern**: One request = one QueryRunner = one pool connection. All reads/writes go through `queryRunner.manager`.
- **Build**: Full monorepo build successful
- **Next**: Manual QA, then apply pattern to other modules if stable

### Metahubs Runtime UX Fixes (Cache + HubDeleteDialog) — COMPLETE ✅

- **Problem**:
  - Hub/Catalog list counters stayed stale until hard refresh due to query freshness (`staleTime`) and missing invalidations.
  - Hub delete blocking-catalogs list needed better UX and to update when returning to the tab (cross-tab changes) without polling.
- **Solution**:
  - Added mutation-driven cache invalidations for aggregate lists (hub list + catalog lists) so counters update immediately after CRUD.
  - Refactored HubDeleteDialog to use TanStack Query `useQuery` for blocking catalogs.
  - MVP cross-tab freshness: `refetchOnWindowFocus: "always"` while the dialog is open (no polling).
  - Improved blocking catalogs mini-table: index column, sticky header, bounded scroll container, catalog links.
  - Extracted a reusable dialog mini-table component (`CompactListTable`) into `@universo/template-mui` and documented the reuse pattern in systemPatterns.md.
  - Follow-up hardening: ensured `ensureAuthWithRls` QueryRunner cleanup runs only once per request to reduce risk of pooled connection stalls.
- **Verification**: Full `pnpm build` successful (61 tasks).

### Catalog-Hub Relationship Improvements — COMPLETE ✅

- **Problem**: Catalogs without hubs showed "Error loading catalog". Users needed ability to create catalogs without hub associations, plus protection against orphaning catalogs when deleting hubs.
- **Solution**: Implemented `isRequiredHub` flag (orthogonal to existing `isSingleHub`):
  - `isRequiredHub: true` — catalog must have at least one hub (min constraint)
  - `isRequiredHub: false` (default) — catalog can exist without hubs
  - `isSingleHub: true` — catalog can have at most one hub (max constraint)
- **Database Changes**:
  - New migration `1766500000000-AddIsRequiredHubToCatalogs.ts`
  - Added `is_required_hub BOOLEAN NOT NULL DEFAULT false` column
  - Partial index on `is_required_hub = true` for efficient blocking catalog queries
- **Backend Changes**:
  - Removed hard hub requirement from `catalogsRoutes.ts` (validation now conditional)
  - Added `GET /metahubs/:metahubId/hubs/:hubId/blocking-catalogs` endpoint
  - DELETE hub returns 409 Conflict if blocking catalogs exist (catalogs with `isRequiredHub=true` and only this hub)
- **Frontend Changes**:
  - New `HubDeleteDialog` component shows blocking catalogs before deletion
  - Follow-up fix: hub delete menu uses `onSelect`, and blocking catalog names render as localized strings (VLC → string)
  - `HubSelectionPanel` now has `isRequiredHub` toggle (positioned above `isSingleHub`)
  - Validation in `CatalogList.tsx` and `CatalogActions.tsx` conditional on `isRequiredHub`
- **i18n**: Added translations for `isRequiredHub` toggle and hub delete dialog (en/ru)
- **Files Modified**: 15 files across metahubs-backend and metahubs-frontend packages
- **Build**: Full project build successful

---

### i18n & Documentation Cleanup — COMPLETE ✅

- **Problem**: Legacy i18n keys (`meta_sections`, `meta_entities`) remained after code cleanup. README files contained outdated 3-tier architecture references.
- **i18n Changes**:
  - Removed `meta_sections` section (~25 lines EN / ~28 lines RU)
  - Removed `meta_entities` section (~22 lines EN / ~25 lines RU)
  - Removed `metahubs.table.meta_sections` and `metahubs.table.meta_entities`
  - Files reduced: 327→278 lines (EN), 335→284 lines (RU)
- **README Changes**:
  - Complete rewrite with 4-tier architecture (Metahubs → Hubs → Catalogs → Attributes/Records)
  - Updated all component documentation
  - Added hub/catalog API examples
  - Both README.md and README-RU.md have identical structure (363 lines each)

---

### Legacy MetaSection/MetaEntity Code Cleanup — COMPLETE ✅

- **Problem**: QA discovered legacy files (MetaSectionList, MetaEntityList, etc.) that called non-existent backend endpoints `/meta_sections` and `/meta_entities`.
- **Root Cause**: Backend was refactored from MetaSection/MetaEntity to Hub/Catalog/Attribute/Record, but frontend legacy files (~2500 lines) were never removed.
- **Additional Fix**: Breadcrumbs linking to empty page when accessing catalog via global list — changed catalog link to go to `/attributes` route.
- **Files Deleted**:
  - `MetaSectionList.tsx` (500 lines)
  - `MetaSectionActions.tsx` (~200 lines)
  - `MetaEntityList.tsx` (538 lines)
  - `MetaEntityActions.tsx` (~200 lines)
  - `metaSections.ts` API (42 lines)
  - `metaEntities.ts` API (31 lines)
  - `SectionList.test.tsx`, `EntityList.test.tsx`
- **Files Modified**:
  - `NavbarBreadcrumbs.tsx` — Fixed catalog breadcrumb link
  - `mutations.ts` — Removed Section/Entity mutation hooks
  - `queryKeys.ts` — Removed meta_sections/meta_entities query keys
  - `types.ts` — Removed MetaSection, MetaEntity interfaces
  - `metahubs.ts` — Removed listMetahubMetaEntities, listMetahubMetaSections
  - `index.ts` — Removed legacy exports
  - `__mocks__/handlers.ts` — Removed mock data for deleted entities
  - All related test files updated
  - `README.md`, `README-RU.md` — Updated data model documentation
- **Result**: ~2500 lines of dead code removed, documentation aligned with actual data model (Hub/Catalog/Attribute/Record)

---

### Bug Fix: getCatalogById returning AxiosResponse instead of data — COMPLETE ✅

- **Problem**: Accessing catalogs via global route (`/metahub/:id/catalogs/:catalogId/attributes`) showed "Error loading catalog" while hub-scoped route worked fine.
- **Root Cause**: `getCatalogById()` and `getCatalog()` in `catalogs.ts` were returning the raw Axios Response object instead of `.data`. When `AttributeList` called `catalogForHubResolution?.hubs?.[0]?.id`, it was accessing the Response object which doesn't have `hubs`.
- **Fix**: Changed both functions to async functions that return `response.data` properly:
  - `getCatalogById(metahubId, catalogId)` → returns `Promise<CatalogWithHubs>`
  - `getCatalog(metahubId, hubId, catalogId)` → returns `Promise<Catalog>`
- **Files Modified**: [catalogs.ts](packages/metahubs-frontend/base/src/api/catalogs.ts)
- **Affected Components**: `AttributeList.tsx`, `RecordList.tsx` — both use `getCatalogById` for hub resolution when accessed via catalog-centric routes.

---

### CatalogList + AllCatalogsList Consolidation — COMPLETE ✅

- **Summary**: Consolidated two near-identical catalog list components (~70% duplicate code) into a single unified `CatalogList.tsx` using the `isHubScoped` pattern. Removed broken `CatalogDetailPage.tsx` intermediate page.
- **Key Pattern**: `isHubScoped = Boolean(hubId)` — determines hub-scoped vs global behavior:
  - Hub-scoped (`/metahub/:id/hub/:hubId/catalogs`): Uses `listCatalogs()`, current hub auto-selected, soft delete
  - Global (`/metahub/:id/catalogs`): Uses `listAllCatalogs()`, shows Hub column, force delete
- **Files Deleted** (dead code removal):
  - `AllCatalogsList.tsx` — 891 lines removed
  - `CatalogDetailPage.tsx` — 263 lines removed
  - Total: ~1150 lines of duplicate/dead code eliminated
- **Files Modified**:
  - `CatalogList.tsx` — Added `isHubScoped` logic, conditional API/UI/navigation, types from AllCatalogsList
  - `MainRoutesMUI.tsx` — Updated routes: `/catalogs` now uses `CatalogList`, removed `/catalogs/:catalogId` intermediate route
  - `index.ts` — Removed exports for deleted components
- **Route Changes**:
  - `/metahub/:id/catalogs` → `<CatalogList />` (global mode, no hubId)
  - `/metahub/:id/catalogs/:catalogId/attributes|records` → Direct to content (no intermediate page)
  - `/metahub/:id/hub/:hubId/catalogs` → `<CatalogList />` (hub-scoped mode)
- **Architecture Pattern**: Follows `SectionList.tsx` and `Executions.jsx` patterns for dual-context components
- **Build**: SUCCESS (61 tasks, 5m26s)

### Catalogs N:M QA Fixes — COMPLETE ✅

- **Summary**: Fixed remaining issues identified during user QA of N:M catalogs implementation, including catalog-centric navigation from the global catalogs list.
- **Issues Fixed**:
  1. **Missing Hubs tab in edit dialog (inside Hub)** — CatalogList now passes `hubs` to createCatalogContext
  2. **No redirect after creation with different hub** — Added navigation to first hub when catalog created with different hub than current
  3. **Hubs tab empty on edit (no prefill)** — Hub-scoped catalogs list now includes `hubs[]` so edit dialogs can preselect associations
  4. **Global catalogs list still hub-scoped** — Global list navigation is now catalog-centric (no `/hub/:hubId/...`)
  5. **Catalog-centric Attributes/Records** — Added `/metahub/:id/catalogs/:catalogId/attributes|records` routes and resolved `hubId` internally
- **Key changes**:
  - `CatalogList.tsx` — Added `hubs` to context, redirect logic in handleCreateCatalog
  - `catalogsRoutes.ts` — New `GET /metahubs/:metahubId/catalogs/:catalogId` endpoint (owner-level)
  - `catalogsRoutes.ts` — Hub-scoped catalogs list now returns `hubs[]` per catalog (prefill support)
  - `catalogs.ts` (API) — Added `getCatalogById()` function
  - `CatalogDetailPage.tsx` — New page for catalog-centric navigation with quick access to attributes/records
  - `NavbarBreadcrumbs.tsx` — Added `useCatalogNameStandalone` hook and breadcrumb logic for catalog-centric paths
  - `MainRoutesMUI.tsx` — Added `/catalogs/:catalogId` route
  - `MainRoutesMUI.tsx` — Added `/catalogs/:catalogId/attributes|records` routes
  - `AllCatalogsList.tsx` — Switched global navigation to catalog-centric URLs
  - `AttributeList.tsx`, `RecordList.tsx` — Added internal `hubId` resolution for catalog-centric URLs
  - `queryKeys.ts` — Renamed `catalogDetail` to `catalogDetailInHub`, added new `catalogDetail` for catalog-centric
- **Build**: SUCCESS (61 tasks, ~5m)

---

## 📅 2026-01-10

### Catalogs N:M UI Enhancement — COMPLETE ✅

- **Summary**: Implemented tabbed dialog interface for catalog creation with hub selection panel.
- **Key changes**:
  1. **EntityFormDialog tabs extension** — Added `tabs` callback prop for dynamic tabbed layouts with TabPanel helper
  2. **HubSelectionPanel component** — New component for managing catalog-hub associations:
     - Table of selected hubs with add/remove functionality
     - Hub picker dialog with search and multi-select
     - isSingleHub toggle with validation
  3. **AllCatalogsList refactored** — Now uses tabbed form:
     - "Основное" tab: name, description, codename
     - "Хабы" tab: HubSelectionPanel with isSingleHub toggle
  4. **i18n keys** — Added translations for tabs, hub selection UI (en/ru)
- **Build**: SUCCESS (61 tasks, 4m48s)
- **Deferred**: Catalog-centric routes (without hubId in URL) — requires API changes for hub resolution

### Catalogs Many-to-Many with Hubs (N:M Relationship) — COMPLETE ✅

- **Summary**: Full implementation of N:M relationship between Catalogs and Hubs (like 1C:Enterprise pattern). Catalogs owned by Metahub, visible in multiple Hubs.
- **All phases completed**:
  1. **Phase 1: Database Schema** ✅
     - Created `CatalogHub` junction entity (UUID PK, ManyToOne to Catalog/Hub with CASCADE)
     - Migration: `catalogs` gets `metahub_id` FK, `is_single_hub` flag
     - Junction table `catalogs_hubs` with UNIQUE(catalog_id, hub_id)
     - `Catalog` entity: replaced `hubId` with `metahubId`, added `catalogHubs` OneToMany
  2. **Phase 2: Backend API** ✅
     - Rewrote `catalogsRoutes.ts` — junction table queries, N:M hub management
     - Updated `guards.ts` — hub optional in access contexts
     - Added `force` param to DELETE (false=remove from hub, true=delete catalog)
  3. **Phase 5: Frontend Types & API** ✅
     - Added `HubRef` interface for hub associations
     - Updated `Catalog`/`CatalogDisplay` types with `metahubId`, `isSingleHub`, `hubs[]`
     - Multi-select hub dropdown in AllCatalogsList create dialog
     - "+N" badge for catalogs in multiple hubs
     - `useDeleteCatalog` hook with `force` parameter
  4. **Phase 6: Routes & Breadcrumbs** ✅
     - Updated `MainRoutesMUI.tsx` — new catalog routes under `/hub/:hubId/`
     - Updated `NavbarBreadcrumbs.tsx` — catalog-aware navigation
     - Added `useCatalogName`, `truncateCatalogName` hooks
  5. **Phase 7: i18n & Testing** ✅
     - Added "catalogs" key to menu.json (en/ru)
     - Full build verification — SUCCESS (61 tasks, 4m46s)
- **Deferred phases**: 3-4 (EntityFormDialog tabs, HubSelectionPanel component)
- **Files created (8)**:
  - Backend: `Catalog.ts`, `CatalogHub.ts`, `1766400000000-AddCatalogsToMetahubs.ts`, `catalogsRoutes.ts`
  - Frontend: `catalogs.ts`, `AllCatalogsList.tsx`, `CatalogActions.tsx`, `CatalogList.tsx`, `useViewPreference.ts`, `constants/storage.ts`
- **Files modified (44)**:
  - Backend: entities/index, routes (hubs, attributes, records, guards, public), migrations/index
  - Frontend: types.ts, queryKeys.ts, mutations.ts, menu-items, HubList, AttributeList, RecordList, i18n
  - Template-MUI: routes, breadcrumbs, hooks/index, hooks/useBreadcrumbName, menuConfigs
  - i18n: menu.json (spaces-frontend, universo-i18n)
- **Next steps**:
  1. Run `pnpm dev` to apply migration (creates `catalogs_hubs` junction table)
  2. Test catalog CRUD with multiple hub associations
  3. Verify delete behavior (force vs soft remove)

### Metahubs Code Quality Improvements — N+1 Fix & Centralization ✅

- **Summary**: Implemented performance and code quality improvements identified during comprehensive QA analysis.
- **Key changes**:
  1. **Backend N+1 Query Optimization (HIGH priority)**:
     - Replaced `Promise.all(items.map(async => count query))` pattern with single SQL query
     - Used LEFT JOINs with COUNT(DISTINCT) and window function `COUNT(*) OVER()` for total
     - Pattern from Metaverses module (sectionsRoutes.ts) applied to Metahubs
     - Files: `catalogsRoutes.ts`, `hubsRoutes.ts`
     - **Performance**: ~2N fewer queries per list request
  2. **Frontend localStorage Centralization (LOW priority)**:
     - Created `constants/storage.ts` with typed storage keys
     - Created `hooks/useViewPreference.ts` hook for view state management
     - Applied to 6 list pages: MetahubList, HubList, CatalogList, AllCatalogsList, MetaSectionList, MetaEntityList
     - Eliminates magic strings and ensures type safety
- **Files created**:
  - `packages/metahubs-frontend/base/src/constants/storage.ts`
  - `packages/metahubs-frontend/base/src/constants/index.ts`
  - `packages/metahubs-frontend/base/src/hooks/useViewPreference.ts`
- **Files modified**:
  - `packages/metahubs-backend/base/src/routes/catalogsRoutes.ts` — N+1 fix (2 endpoints)
  - `packages/metahubs-backend/base/src/routes/hubsRoutes.ts` — N+1 fix (1 endpoint)
  - `packages/metahubs-frontend/base/src/pages/*.tsx` — useViewPreference applied (6 files)
- **Build**: SUCCESS (full workspace, 61 tasks)
- **Deferred**: CatalogList/AllCatalogsList merge — too risky for production without extensive testing

### Catalogs QA Round 9 — Metahubs i18n + Access sorting ✅

- **Summary**: Fixed remaining RU i18n regression in Metahubs list count headers (“Hubs/Catalogs”) and added missing sorting in the Access/Members table.
- **Key fixes**:
  1. **Metahubs list headers i18n**: Aligned table header keys with the consolidated `metahubs` namespace shape (flattened `bundle.metahubs` → use `table.hubs` / `table.catalogs`).
  2. **Access/Members sorting**: Added sorting for Email, Nickname, Added columns.
- **Files modified**:
  - `packages/metahubs-frontend/base/src/pages/MetahubList.tsx`
  - `packages/metahubs-frontend/base/src/pages/MetahubMembers.tsx`
  - `packages/metahubs-frontend/base/src/i18n/index.ts` (reviewed: consolidation/flattening behavior)
- **Build**: SUCCESS (full workspace)
- **Note**: UI may require a hard refresh or dev server restart to pick up updated locale bundles.

### Catalogs QA Round 8 — Sorting & Column Improvements ✅

- **Summary**: Added sorting capability to table columns and replaced legacy MetaSections/MetaEntities with new Hubs/Catalogs.
- **Key changes**:
  1. **Sorting added**: Added `sortable: true` + `sortAccessor` to Name, Description, Codename columns in:
     - MetahubList.tsx (Name, Description only)
     - HubList.tsx, CatalogList.tsx, AllCatalogsList.tsx (Name, Description, Codename)
  2. **Table columns replaced**: Changed MetaSections/MetaEntities → Hubs/Catalogs in MetahubList table
  3. **Dashboard widgets replaced**: Changed Секции/Сущности → Хабы/Каталоги in MetahubBoard stats
  4. **Backend enhanced**: Added `catalogsCount` to Metahub list/detail endpoints (counts catalogs via hubs JOIN)
  5. **i18n updated**: Added `hubs`/`catalogs` keys for table headers and dashboard stats in both EN/RU locales
- **Files modified**:
  - Backend: `metahubsRoutes.ts` (import Catalog entity, add catalogRepo, count catalogs via JOIN)
  - Frontend types: `types.ts` (added catalogsCount to Metahub & MetahubDisplay interfaces)
  - Lists: `MetahubList.tsx`, `HubList.tsx`, `CatalogList.tsx`, `AllCatalogsList.tsx` (sorting + columns)
  - Dashboard: `MetahubBoard.tsx` (replaced stats cards data source and i18n keys)
  - i18n: `ru/metahubs.json`, `en/metahubs.json` (table headers + dashboard stats)
- **Build**: SUCCESS (61 tasks, 4m59s)

### Catalogs QA Round 7 — i18n & URL Fixes ✅

- **Summary**: Fixed column headers translation, changed URLs from /hubs/ to /hub/, fixed column order.
- **Key fixes**:
  1. **i18n keys added**: Added `attributesHeader` and `recordsHeader` keys for column headers
  2. **URL pattern changed**: Changed from plural `/hubs/` to singular `/hub/` for specific hub context
  3. **Column order fixed**: Reordered to Name → Description → Codename (Description before Codename)
- **Files modified**: CatalogList, HubList, AllCatalogsList, AttributeList, RecordList, MainRoutesMUI, NavbarBreadcrumbs, metahubs.json (EN/RU)
- **Build**: SUCCESS (61 tasks, 4m48s)

### Catalogs QA Round 6 — UX Improvements ✅

- **Summary**: Fixed remaining UX issues: removed description text, fixed column order, fixed tab navigation, added breadcrumbs support for catalog-based URLs.
- **Key fixes**:
  1. **Description text removed**: Removed `description={t('catalogs.allDescription')}` from AllCatalogs ViewHeader.
  2. **Column order fixed**: Reordered columns in AllCatalogsList, HubList, CatalogList, AttributeList (Name first, Codename second).
  3. **Tab navigation fixed**: Added missing `/catalogs/${catalogId}` segment to tab URLs in AttributeList and RecordList.
  4. **Breadcrumbs support**: 
     - Added `useCatalogName` hook and `truncateCatalogName` function
     - Updated `useAttributeName` to accept catalogId (new API path: `/metahubs/:id/hubs/:hubId/catalogs/:catalogId/attributes/:attributeId`)
     - Updated NavbarBreadcrumbs.tsx with catalog-aware URL parsing and breadcrumb generation
- **Files modified**: 
  - `AllCatalogsList.tsx`, `HubList.tsx`, `CatalogList.tsx`, `AttributeList.tsx`, `RecordList.tsx` (column order + navigation)
  - `useBreadcrumbName.ts` (new useCatalogName hook, updated useAttributeName signature)
  - `hooks/index.ts` (export new functions)
  - `NavbarBreadcrumbs.tsx` (catalog-aware breadcrumb logic)
- **Build**: SUCCESS (61 tasks, 5m26s)

### Catalogs QA Round 5 — All Catalogs Create UX Parity ✅

- **Summary**: Fixed All Catalogs “Add” label i18n regression and aligned the create dialog to the hub-scoped CatalogList multilingual form (plus hub selector).
- **Key fixes**:
  1. **i18n label**: Switched toolbar primary action label to an existing common key (`common.addNew`) to avoid rendering raw `crud.add`.
  2. **Create dialog parity**: Refactored `AllCatalogsList.tsx` to use the same `EntityFormDialog` + localized fields pattern as `CatalogList.tsx` (`LocalizedInlineField` in `mode='localized'`, `useCodenameAutoFill`, `extractLocalizedInput`).
  3. **Validation + errors**: Added dialog-level error handling and tightened validate/canSave gates to match the standard flow.
- **Files modified**: `AllCatalogsList.tsx`
- **Build**: SUCCESS (61 tasks, 5m46s)

### Catalogs QA Round 4 — Add Button & Hub Editing ✅

- **Summary**: Fixed missing "Add" button and added ability to edit hub assignment for catalogs.
- **Key fixes**:
  1. **Add button fix**: Changed `addButton` to `primaryAction` prop in `AllCatalogsList.tsx` (ToolbarControls component expects `primaryAction`, not `addButton`).
  2. **Hub editing backend**: Added `hubId` field to `updateCatalogSchema` in `catalogsRoutes.ts` and implemented logic to move catalog between hubs with codename conflict checking.
  3. **Hub editing frontend**: 
     - Extended `CatalogActions.tsx` with `CatalogDisplayWithHub` type and hub selector in edit dialog
     - Added `showHubSelector` and `hubs` props to `CatalogEditFields` component
     - Updated validation and payload functions to handle hubId
     - Updated `AllCatalogsList.tsx` to pass hubs list and updateEntity API to context
- **Files modified**: 
  - `catalogsRoutes.ts` (backend schema + hub move logic)
  - `catalogs.ts` (frontend API type)
  - `CatalogActions.tsx` (hub selector in edit dialog)
  - `AllCatalogsList.tsx` (primaryAction fix + context update)
- **Build**: SUCCESS (61 tasks, 6m59s)

---

### Catalogs QA Round 3 — Menu, Breadcrumbs & i18n Finalization ✅

- **Summary**: Final polish round for Catalogs feature. Fixed 8 remaining issues related to cache invalidation, breadcrumbs navigation, i18n consistency, and UI improvements.
- **Key fixes**:
  1. **Cache invalidation**: Added `allCatalogs` cache invalidation to `useCreateCatalog`, `useUpdateCatalog`, `useDeleteCatalog` mutations so new catalogs appear immediately in "All Catalogs" view.
  2. **Breadcrumbs**: Added `catalogs` menu item with `breadcrumbs: true` in `metahubDashboard.ts` to enable navigation breadcrumbs.
  3. **Title rename**: Changed `catalogs.allTitle` from "Все каталоги" to "Каталоги" (ru), "All Catalogs" to "Catalogs" (en) for cleaner UI.
  4. **Add button**: Added EntityFormDialog with hub dropdown selector to AllCatalogsList.tsx, allowing creation of catalogs directly from the global view.
  5. **Terminology fix**: Changed all remaining "справочник" occurrences to "каталог" in records section (`description`, `emptyDescription`, `addAttributesFirst`, `noAttributes`).
  6. **Full words**: Changed abbreviated "атр." to full plural forms (`атрибут/атрибута/атрибутов`), "attr" to (`attribute/attributes`).
  7. **Interpolation fix**: Fixed HubList.tsx to use proper i18n interpolation `{t('hubs.catalogsCount', { count })}`.
  8. **Table column fix**: Changed HubList table column label from `t('hubs.catalogsCount')` to `t('catalogs.title')` for consistency.
- **Files modified**: 
  - `mutations.ts` (cache invalidation)
  - `metahubDashboard.ts` (menu + breadcrumbs)
  - `ru/metahubs.json`, `en/metahubs.json` (i18n fixes)
  - `AllCatalogsList.tsx` (Add button + hub selector)
  - `HubList.tsx` (interpolation + column label)
- **Build**: SUCCESS (61 tasks, 7m12s)

---

### Catalogs QA Round 2 — Final Bug Fixes ✅

- **Summary**: Fixed 5 issues discovered during second QA testing round for the Catalogs feature.
- **Key fixes**:
  1. **Russian translations**: Changed all "Справочники" to "Каталоги" in `ru/metahubs.json` for consistency with user expectation.
  2. **i18n interpolation**: Fixed card count display showing raw "0 {{count}} атр" by:
     - Changing i18n keys to use proper plural format (`attributesCount_one`, `attributesCount_few`, `attributesCount_many`, `attributesCount_other`)
     - Fixed CatalogList.tsx footerEndContent to use `{t('catalogs.attributesCount', { count })}` instead of concatenation
  3. **Menu translation**: Added `catalogs` key to `universo-i18n/locales/*/views/menu.json` (the menu loads translations from `universo-i18n` namespace, not from `spaces-frontend`)
  4. **AllCatalogsList redesign**: Complete rewrite to match HubList.tsx pattern with MainCard, ViewHeader (search + subtitle), ToolbarControls (view toggle), ItemCard grid with Chip showing hub name, FlowListTable with hub column using Chip, PaginationControls, and ConfirmDeleteDialog
  5. **Database migration**: Added missing `target_catalog_id` column to `1766400000000-AddCatalogsToMetahubs.ts` with FK constraint to catalogs table (required for REF-type attributes)
- **Files modified**: 
  - `1766400000000-AddCatalogsToMetahubs.ts` (migration)
  - `ru/metahubs.json`, `en/metahubs.json` (translations)
  - `universo-i18n/locales/en/views/menu.json`, `ru/views/menu.json`
  - `CatalogList.tsx` (i18n interpolation fix)
  - `AllCatalogsList.tsx` (complete rewrite)
- **Validation**: Full project build successful (61 tasks, 4m55s).

---

## 📅 2026-01-09

### Add Catalogs Entity to Metahubs (1C-style Справочники) ✅

- **Summary**: Added Catalogs as a new hierarchy level within Metahubs, analogous to "Справочники" in 1C:Enterprise 8.3-8.5. The new architecture is: `Metahub → Hub → Catalog → Attributes + Records`.
- **Key changes**:
  - **Backend Database**: Created `catalogs` table migration, `Catalog.ts` TypeORM entity. Updated Attribute and Record entities to reference catalogId instead of hubId.
  - **Backend API**: Created `catalogsRoutes.ts` with full CRUD. Updated `attributesRoutes.ts` and `recordsRoutes.ts` URLs to include catalogId. Added `ensureCatalogAccess` guard. Updated `hubsRoutes.ts` to return catalogsCount. Updated `publicMetahubsRoutes.ts` with Catalog hierarchy.
  - **Frontend Types & API**: Added Catalog types and toCatalogDisplay(). Created `api/catalogs.ts`. Updated attributes/records APIs with catalogId parameter. Updated queryKeys and mutations.
  - **Frontend Pages**: Created `CatalogList.tsx` and `CatalogActions.tsx`. Updated `AttributeList.tsx` and `RecordList.tsx` with catalogId param. Updated `HubList.tsx` to route to catalogs. Added routes in `MainRoutesMUI.tsx`.
  - **i18n**: Added English and Russian translations for catalogs. Updated hubs/attributes/records descriptions.
- **Files created**: `Catalog.ts`, `catalogsRoutes.ts`, `api/catalogs.ts`, `CatalogList.tsx`, `CatalogActions.tsx`, migration file.
- **Files modified**: 20+ files across metahubs-backend, metahubs-frontend, universo-template-mui.
- **Validation**: Full project build successful (61 tasks).

### Metahubs Code Deduplication Refactoring ✅

- **Summary**: Extracted duplicated code from Metahubs backend and frontend into shared utilities in `@universo/utils` and created a reusable `useCodenameAutoFill` hook in `@universo/template-mui`.
- **Issue**: #634 (continued from PR #635 bot reviews)
- **Key changes**:
  - Created `@universo/utils/vlc` module with `sanitizeLocalizedInput()` and `buildLocalizedContent()` functions.
  - Created `@universo/utils/validation/codename` module with `CODENAME_PATTERN`, `normalizeCodename()`, `isValidCodename()` functions.
  - Updated `tsdown.config.ts` and `package.json` in universo-utils to export new modules.
  - Refactored 3 backend routes (attributesRoutes, hubsRoutes, metahubsRoutes) to use shared functions (~112 lines removed).
  - Created `useCodenameAutoFill` hook for automatic codename generation from localized name.
  - Refactored `HubList.tsx` and `AttributeList.tsx` to use the new hook.
- **Validation**: Full project build successful.

## 📅 2026-01-09

### Metahubs VLC rollout & UI fixes (PR #635) — PR opened ✅

- **Summary**: Opened PR #635 containing the Metahubs localization (VLC) rollout and related UI/backend updates; this includes a small UI fix to center the sortable `#` header in Attributes tables (FlowListTable change).
- **PR**: https://github.com/teknokomo/universo-platformo-react/pull/635
- **Issue**: #634
- **Key files changed**: `packages/metahubs-frontend/base/src/pages/AttributeList.tsx`, `packages/metahubs-frontend/base/src/pages/RecordList.tsx`, `packages/metahubs-backend/base/src/routes/attributesRoutes.ts`, `packages/universo-template-mui/base/src/components/table/FlowListTable.tsx`, i18n locales, tests and utilities.
- **Validation**: Local `pnpm build` completed successfully; please run CI and request reviewers.

## 📅 2026-01-08

### Records Form Localization & Validation ✅

- **Summary**: Record fields now render localized labels from attribute VLC, STRING fields use LocalizedInlineField, empty records are blocked, and the records table "Updated" column is localized.
- **UI**: Record actions now open the correct dialog (no metahub delete copy).
- **Validation**: `pnpm --filter @universo/metahubs-frontend build`

### Records Backend Validation for VLC ✅

- **Summary**: Record creation/update now accepts VLC objects for STRING attributes and validates required/length rules against primary content.
- **Validation**: `pnpm --filter @universo/metahubs-backend build`

### Record Edit Hydration ✅

- **Summary**: Record edit now passes full record data through the action menu and fetches a record when missing so fields are pre-filled on first open.
- **Validation**: `pnpm --filter @universo/metahubs-frontend build`

### Record Edit Initial Render Guard ✅

- **Summary**: Record edit form delays field rendering until initial data hydration completes to avoid empty first paint.
- **Validation**: `pnpm --filter @universo/metahubs-frontend build`

### Hub Attributes Localization & Codename Fixes ✅

- **Summary**: Migrated hub attributes to the localized field workflow (VLC), added codename auto-fill/editing, removed unused description UI, and aligned backend validation/normalization.
- **Frontend**: Attribute list now uses localized inline fields, codename validation, and updated i18n strings.
- **Backend**: Attribute routes now sanitize localized inputs, honor primary locale, and normalize/validate codenames.
- **Validation**: `pnpm --filter @universo/metahubs-frontend build`, `pnpm --filter @universo/metahubs-backend build`

## 📅 2026-01-07

### Localized Field UI Rollout & Hardening ✅

- **Summary**: Rolled out compact localized field UI (LocalizedInlineField + EntityFormDialog) across metahubs and admin flows, plus backend support for safer VLC parsing and primary-locale handling.
- **Also**: PR #633 bot-review fixes (VLC filtering, locale validation, deterministic primary fallback, CSRF shared promise docs).
- **Incident note**: Documented admin roles reload issue (QueryRunner reuse) in READMEs and system patterns.
- **Validation**: Package builds succeeded; metahubs-frontend tests pass but coverage thresholds are known to fail (existing gate).
- **Files**: Multiple packages under `universo-template-mui`, `universo-utils`, `universo-i18n`, `metahubs-{frontend,backend}`, `admin-{frontend,backend}`.

### Diagnostics Logs Cleanup ✅

- **Summary**: Removed temporary diagnostic logs and restored default backend log level to reduce noise.
- **Files**: `packages/flowise-core-backend/base/src/utils/config.ts`

## 📅 2026-01-06

### Internationalize project metadata and update texts ✅

- **Summary**: Internationalized project metadata and updated translations and documentation across the repository.
- **PR / Issue**: PR #631, Issue #630
- **Scope**: Added locale metadata (meta.json), updated landing/onboarding translations, updated core-frontend entrypoints, and added scripts to sync supported languages.
- **Files**: start-frontend, universo-i18n, core-frontend, and repo docs (see PR #631).
- **Validation**: Recommended: package lints + `pnpm build` at repo root.

### Metahubs localized fields hardening ✅

- **Summary**: Prevented runtime crashes when metahubs name/description arrive in mixed formats (VLC, SimpleLocalizedInput, or string). Updated metahubs mutations to send localized payloads based on current UI language and adjusted tests to include VLC data.
- **Files**: metahubs-frontend types/mutations/tests.
- **Validation**: `pnpm --filter @universo/metahubs-frontend test -- --runInBand` (known existing timeout in `src/__tests__/exports.test.ts`).

## 📅 2026-01-05

### Improve Login Error Messages UX ✅

- **Problem**: User tried to login with unregistered email and saw generic "Ошибка сервера" (Server error) message
- **Root Cause**: `mapSupabaseError()` looked for Supabase phrase "Invalid login credentials" but our backend returned "Invalid credentials"
- **Fix**: Updated `errorMapping.ts` to match both Supabase and backend error messages
- **New i18n Key**: `loginFailed` with user-friendly message guiding to registration
  - EN: "Failed to sign in. Please check your email and password, or register if you don't have an account yet."
  - RU: "Не удалось войти в систему. Проверьте email и пароль или зарегистрируйтесь, если у вас ещё нет аккаунта."
- **Improved `serverError`**: Changed from generic to more helpful message for actual server errors
  - EN: "An unexpected error occurred. Please try again later or contact support if the problem persists."
  - RU: "Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку, если проблема сохраняется."
- **Security**: Message doesn't reveal if email exists in system (OWASP best practice)
- **Files Changed**: `errorMapping.ts`, `auth.json` (en/ru)
- **Build**: Full workspace passed (61 tasks, 4m36s)

---

## 📅 2026-01-03

### Auth toggles + start-frontend i18n cleanup ✅

- Added `AUTH_*` feature toggles and `GET /api/v1/auth/auth-config` (backend returns 403 when disabled; frontend shows disabled-state UX).
- Added `StartFooter` to start pages and legal pages; updated onboarding and landing copy (RU/EN).
- Migrated start-frontend to `registerNamespace()` pattern and deprecated legacy register helpers.
- UX polish: landing footer hover contrast, onboarding subtitle paragraph rendering, clickable AppBar brand.
- Validation: Full workspace build passed (61 tasks).

---

## 📅 2026-01-02

### SmartCaptcha: Login Support + QA Fixes ✅

- Added optional SmartCaptcha for login (`SMARTCAPTCHA_LOGIN_ENABLED`) end-to-end (widget + backend validation).
- Refactored captcha logic into shared `@universo/utils/captcha` and re-exported from auth/leads services (axios-based).
- Security: switched captcha validation to fail-closed when enabled (prevents bypass on API errors).
- UX: widget resets on mode switch; added user-facing network error message; updated cookie consent text (“Universo Platformo”).
- Validation: Full workspace build passed (61 tasks).

## 📅 2026-01-01

### SmartCaptcha: Registration + Publication + Leads Wiring ✅

- Added server-side captcha validation for leads (prevents unvalidated tokens reaching DB).
- Wired `captchaToken` from quiz lead forms to backend and sanitized logging to avoid PII/token leaks.
- Publication support: global captcha config endpoint (`/api/v1/publish/captcha/config`) and allowlisting in `API_WHITELIST_URLS`.
- Domain/test-mode learnings: `test=true` does not bypass domain allowlisting; `iframe.srcdoc` breaks domain checks → switched integration to preserve origin.
- Validation: Full workspace build passed.

## 📅 2025-12-31 (Latest)

### Privacy Consent 🔒 (Cookie + leads + legal pages) ✅

- Implemented cookie consent banner (accept/decline) with i18n + persistence.
- Added lead consent fields/validation for quiz AR.js submissions.
- Updated profile consent versioning (`terms_version`, `privacy_version`) and fixed signup/profile creation (TypeORM tuple parsing + RLS-safe trigger/migration consolidation).
- Added `/terms` and `/privacy` pages (version display, consent links, public UI whitelist updates).

---

## 📅 2025-12-28

### Auth & UX Fixes ✅

- Added retry-once for registration on HTTP 419 (stale CSRF).
- Polished start page spacing/loading states and added onboarding completion tracking.

---

## 📅 2025-12-26

### Onboarding wizard + quiz/publication fixes ✅

- Shipped 5-step onboarding wizard and improved start page i18n/content; migrated views to `@universo/start-frontend`.
- Fixed Leads API/analytics issues (schema + response normalization) and added types/tests.
- Fixed anonymous quiz access via publish endpoint allowlisting and RLS/auth bypass for whitelisted routes.

---

## 📅 2025-12-25

### Auth flow + routing + shared API client refactor ✅

- Improved auth resilience (419 CSRF auto-retry, logout cleanup, no forced redirect).
- Fixed auth routing edge cases (AuthGuard flash, redirect loop; `/auth` in public UI routes).
- Centralized public routes in `@universo/utils/routes` and added `redirectOn401` controls; removed large API client duplication.

---

## 📅 2025-12-23-24

### Auth/RLS fixes + Metahubs stability ✅

- Fixed RLS/auth architecture (no DB role switching; session-scoped JWT claims + cleanup on release).
- Hardened Metahubs UI for localization/pagination (VLC display/utilities, breadcrumb hooks, `.items` extraction, hubs/attributes/records i18n consolidation, Attributes↔Records tabs).

---

## 📅 2025-12-22

### Metahubs metadata platform transformation ✅

- Backend: renamed hierarchy (MetaSection→Hub, MetaEntity→Attribute), added JSONB records storage, indexes, enums, and RLS policies.
- Frontend: added types (incl. display variants), API clients, CRUD pages (hubs/attributes/records), and EN/RU i18n.
- UX fixes: member cards auth-user lookup, correct sidebar menu detection, aligned list UI to Metaverses pattern.

---

## 📅 2025-12-15-21 (Consolidated)

### Agents/AgentFlow + dynamic locales (consolidated) ✅

- AgentFlow node-type detection/normalization and multiple UX fixes in the editor.
- Agents validation pipeline (service + UI popup) and chat popup i18n plumbing.
- Executions pages i18n and namespace registration cleanup.
- Upgraded `flowise-components` to upstream Flowise 3.0.12 (build alignment + icon rendering fixes).
- Added dynamic content locales system (DB-driven locales; system locales protected; public cached endpoint).

---

## 📅 2025-12-09-14 (Consolidated)

### UUID v7 + infra updates (consolidated) ✅

- Migrated UUID v4 → v7, added shared UUID utilities and Postgres `uuid_generate_v7()`.
- Upgraded ESLint toolchain for TS 5.8.
- RBAC/CASL cleanup (module→subject terminology, synthetic membership/global roles, derived admin access, context-aware queries).

---

## 📅 2025-12 Early: Metahubs MVP Complete ✅

### Metahubs MVP (copy-refactor) ✅

- Implemented Metahubs by copying/refactoring Metaverses packages; created backend/frontend packages and initial schema migration.
- Preserved list/form/menu patterns (EntityFormDialog, BaseEntityMenu, ConfirmDeleteDialog, usePaginated, queryKeys, i18n namespaces).
- Integrated navigation/routes and menu translations.
- Tests: 95/95 passing at the time (coverage noted in CI output).

---

## 📅 2025-11 (Summary)

### Admin Instances MVP & RBAC ✅
- Admin instances management system
- RBAC improvements with global roles access
- Subject-wide permissions architecture

### Organizations & Projects ✅
- Organizations module with membership management
- Projects management system with hierarchical structure
- AR.js Quiz Nodes for interactive content
- Member i18n refactor

### Campaigns & Storages ✅
- Campaigns module for marketing workflows
- Storages module for file management
- useMutation refactor across 7 packages
- QA fixes and polish

### Documentation & Analytics ✅
- REST API docs refactor (OpenAPI 3.1)
- Uniks metrics update with UnikBoard 7 metrics
- Clusters breadcrumbs navigation
- Dashboard analytics charts implementation

---

## 📅 2025-10 (Summary)

### TypeScript & i18n Migration ✅
- i18n TypeScript migration with type-safety improvements
- Date formatting migration to dayjs
- publish-frontend architecture refactoring

### Infrastructure ✅
- Rate limiting with Redis implementation
- RLS integration analysis and planning
- Global monorepo refactoring
- tsdown build system and dependencies centralization

### Publication System ✅
- Publication System 429 fixes
- API modernization
- Metaverses refactoring
- Quiz timer implementation
- Canvas versioning (Chatflow→Canvas terminology)
- PostHog telemetry integration

---

## 📅 2025-09 and earlier (Summary)

### Core Features ✅
- Space Builder MVP with multiple modes
- Metaverse module with @universo/types
- Cluster isolation architecture
- Multiplayer Colyseus server
- Canvas versioning and publication system
- Quiz features with manual editing
- Language switcher and MMOOMM template
- TypeScript path aliases and global publication library
