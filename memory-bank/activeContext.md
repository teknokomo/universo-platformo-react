# Active Context

> **Last Updated**: 2026-01-19
> 
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Refactor Connector-Publication Link

### Implementation In Progress (2025-01-20)

**Original Problem**:
1. `connectors_metahubs` table linked connectors directly to metahubs
2. This allowed connectors to metahubs without publications, breaking sync logic
3. UI showed "Sync Schema" button always, should show "Create Schema" when schema doesn't exist

**Solution**: Link connectors to Publications instead of Metahubs:
- Table renamed: `connectors_metahubs` → `connectors_publications`
- Column renamed: `metahub_id` → `publication_id`
- FK changed: References `metahubs.publications(id)`

**UI/UX Refinement** (latest update):
- Connectors show "Metahubs" tab (not "Publications") for user-friendly terminology
- PublicationSelectionPanel displays Metahub names but returns publication IDs internally
- Only metahubs with publications appear in the selection list
- Single publication limit: One Publication per Metahub (similar to Connector limit)

**Completed Work**:
- ✅ Database migration updated
- ✅ Backend entities and routes updated (applications-backend, metahubs-backend)
- ✅ Frontend types, API, hooks, components updated (applications-frontend)
- ✅ Dynamic button text: "Create Schema" vs "Sync Schema"
- ✅ ConnectorDiffDialog shows tables to be created
- ✅ UI shows "Metahubs" but internally links to Publications
- ✅ Single publication limit (frontend + backend)
- ✅ i18n keys added (English + Russian)
- ✅ Build successful (64 tasks)

**Pending**:
- ⏳ Manual testing of schema creation flow

**Recent Fixes (2026-01-19)**:
- Fixed `/publications/available` query: use `metahubs_users` membership, map metahub `slug` as codename, and publication `schema_name` as codename.
- Removed `publications_users` dependency from backend and migration (see progress.md for details).
- Fixed Connector UI localization issues:
  - Added missing `common.search` translation for search placeholder
  - Added `table.name`, `table.codename` top-level i18n keys
  - Added `connectors.table.created` for "Created" label on connector page
  - Included `table` in applications i18n consolidation for `table.codename` resolution
  - Updated `connectors.metahubInfo.locked` notification text as per user request
  - Changed tab id/label from 'publications' to 'metahubs' in ConnectorActions.tsx
  - Removed Publication info row from ConnectorBoard.tsx (internal detail)
  - Updated admin instances MVP notice text and moved the alert to top of InstanceList
  - Adjusted admin notice spacing to match connector list banner
  - Added "Связь" column and Metahub chip to connector list (table + card)
  - Made connector name a link in table view with hover effect matching ApplicationList pattern
  - Cleaned schema-ddl utilities: parameterized statement_timeout, removed deprecated static wrappers, updated tests; schema-ddl tests and full build successful

**Testing Instructions**:
1. Drop and recreate test database (migration is breaking change)
2. Create Metahub
3. Create Publication in Metahub (verify only one allowed)
4. Create Application with Connector linked to the Metahub
5. Verify "Create Schema" button appears
6. Click button and verify tables are created
7. Verify button changes to "Sync Schema"

---

## Previous: @universo/schema-ddl Package Extraction ✅

### Implementation Completed (2025-01-19)

**Problem Solved**: Circular dependency between metahubs-backend and applications-backend.

**Solution**: Created new package `@universo/schema-ddl` with Dependency Injection pattern:
- All DDL classes (SchemaGenerator, SchemaMigrator, MigrationManager) receive `Knex` via constructor
- Factory function `createDDLServices(knex)` instantiates all services
- Pure functions extracted to modules: `locking.ts`, `naming.ts`

**Integration**:
- `metahubs-backend`: Re-exports from schema-ddl + `getDDLServices()` wrapper
- `applications-backend`: Imports `generateSchemaName` directly from `@universo/schema-ddl`

**Build Result**: 64 tasks successful, 4m36s.

**Status**: Ready for commit.

---

## Previous: Publication/Connector QA Fixes (Round 3) ✅

### Implementation Completed (2025-01-18)

**Issues Fixed**:

1. **MetahubSelectionPanel TypeError** — Fixed missing hook import and corrected component props.

2. **Toggle Switches Disabled in Create Dialog** — Added `togglesDisabled` prop to EntitySelectionPanel/MetahubSelectionPanel.

3. **schemaName Generation** — Fixed to generate from Application UUID (not copy from Publication).

4. **Major: Application-Centric Sync Architecture** — Complete refactoring:
   - Root cause: sync used publicationId, but manual Applications have no Publication
   - New endpoints: `GET /:applicationId/diff`, `POST /:applicationId/sync`
   - Chain: Application → Connector → ConnectorMetahub → Metahub → Catalogs → Attributes
   - Works for both auto-created and manually created Applications

**New Files/Changes**:
- `applicationsRoutes.ts`: +2 new endpoints (diff, sync)
- `connectors.ts`: +2 new API functions (getApplicationDiff, syncApplication)
- `useConnectorSync.ts`: +useApplicationDiff hook
- `mutations.ts`: SyncConnectorParams uses applicationId
- `ConnectorBoard.tsx`: uses applicationId for sync
- `ConnectorDiffDialog.tsx`: accepts applicationId prop

**Build Result**: 63 tasks successful, 4m52s.

**Status**: Ready for user testing. User should:
1. Create Application manually
2. Create Connector linked to Metahub
3. Click "Синхронизировать схему" → "Создать схему"
4. Verify schema created as `app_<applicationId>`

---

## Previous: Publication/Connector QA Fixes (Round 2) ✅

### Implementation Completed (2025-01-18)

**QA Recommendation**: Add unit tests for DDL module to improve test coverage.

**Implementation**: Created 5 test files in `packages/metahubs-backend/base/src/tests/ddl/`:

| Test File | Coverage |
|-----------|----------|
| `naming.test.ts` | Pure functions: generateSchemaName, generateTableName, generateColumnName, isValidSchemaName, buildFkConstraintName |
| `diff.test.ts` | calculateSchemaDiff with scenarios: initial deployment, add/drop tables/columns, kind changes |
| `snapshot.test.ts` | buildSchemaSnapshot with entity/field mapping, FK references |
| `SchemaGenerator.test.ts` | Static methods (mapDataType) + instance methods with Knex mocking |
| `MigrationManager.test.ts` | generateMigrationName, recordMigration, listMigrations, getMigration |

**Test Results**: 7 test suites passed, 127 tests total.

---

## Previous: Migrations API URL Path Fixed ✅

### Issue Fixed (2026-01-17)

**Issue: Migrations page shows "No migrations yet" despite DB having records**
- Root cause: Frontend API client (`migrations.ts`) used `/metahubs/application/...` URLs but routes are mounted directly as `/application/...` in `metahubsRouter`.
- Fix: Removed `/metahubs/` prefix from all 4 migration API functions:
  - `fetchMigrations()`
  - `fetchMigration()`
  - `analyzeMigrationRollback()`
  - `rollbackMigration()`
- Build: 63 tasks, 4m49s — all successful.

---

## Previous: Fix Schema Status Display + Initial Migration Recording ✅

### Issues Fixed (2026-01-17)

**Issue 1: ConnectorBoard shows "Draft" when DB has "Synced"**
- Root cause: `ConnectorBoard` received `application` as prop from `MainRoutesMUI`, but prop was never passed (always `undefined`), causing fallback to `'draft'`.
- Fix: Added `useApplicationDetails` hook call inside `ConnectorBoard` to fetch application data directly. Removed unused `application` prop.

**Issue 2: Initial schema creation doesn't record migration**
- Root cause: `generateFullSchema()` creates schema and tables but never calls `recordMigration()`. Only `applyAllChanges()` (for updates) records migrations.
- Fix: Added optional `GenerateFullSchemaOptions` parameter with `recordMigration` and `migrationDescription`. When enabled, records initial migration with `snapshotBefore: null` and current state as `snapshotAfter`. Updated sync endpoint to pass `{ recordMigration: true, migrationDescription: 'initial_schema' }`.

**Database verification**: Confirmed via Supabase that `applications.applications` has `schema_status = 'synced'` and `schema_synced_at` set correctly. The `_sys_migrations` table was empty (will now be populated on new schema creation).

---

## Previous: Fix Schema Sync Endpoint Path ✅

### Issues Fixed (2026-01-17)

**Schema sync endpoint path**: Frontend was calling `/api/v1/metahubs/metahub/.../sync` which returned SPA HTML. Updated connectors API to use `/api/v1/metahub/.../sync` (and diff) and removed temporary debug logs across frontend/backends. Rebuilt applications-frontend, core-frontend, core-backend, metahubs-backend.

**Schema status display**: Application detail endpoint now returns `schemaName`, `schemaStatus`, `schemaSyncedAt`, and `schemaError`, so ConnectorBoard reflects actual schema state after sync.

## Previous: Fix ConnectorBoard Issues ✅

### Issues Fixed (2026-01-17)

**Issue 1 (Breadcrumbs)**: Added `useConnectorName` hook and `connector` segment handling in `NavbarBreadcrumbs.tsx`. Now shows "Applications > [App Name] > Connectors > [Connector Name]".

**Issue 2 (URL structure)**: Updated route from `/application/:applicationId/connector` to `/application/:applicationId/connector/:connectorId` for future multi-connector support. Updated:
- Route definition in `MainRoutesMUI.tsx`
- `ConnectorBoard.tsx` to use `connectorId` from params
- `PublicationList.tsx` and `ConnectorList.tsx` navigation
- Backend `publicationsRoutes.ts` to return `connectorId` in responses

**Issue 3 (Schema diff handling)**: Updated ConnectorDiffDialog to treat `schemaExists=false` or `schemaStatus='draft'` as actionable state. UI now shows "Schema not created yet" message and enables sync to create schema. Added new i18n labels for missing schema title and create action.

**Issue 4 (i18n)**: Added `connectors.diffDialog.schemaUpToDate` key (EN + RU).

**Build verified**: `pnpm --filter @universo/applications-frontend build` — successful (post schemaStatus fallback).

### Navigation Flow (Updated)
- Metahub → Publications → Click Publication → `/application/{applicationId}/connector/{connectorId}` (ConnectorBoard)
- Application → Connectors → Click Connector → `/application/{applicationId}/connector/{connectorId}` (same page)

---

## Previous: Fix Connector Metahub Query Error ✅

### Issues Fixed (2026-01-17)

**Issue 1: Migrations not recorded during schema sync**
- Root cause: `applyAllChanges()` called without `recordMigration: true`.
- Fix: Added `{ recordMigration: true, migrationDescription: 'schema_sync' }` to `publicationsRoutes.ts`.

**Issue 2: i18n missing migrations namespace**
- Root cause: `consolidateApplicationsNamespace` missing `migrations` key.
- Fix: Added migrations to interface and consolidation return in `applications-frontend/i18n/index.ts`.

**Issue 3: Sync UI moved from Metahubs to Applications**
- Created `useFirstConnectorDetails` hook — fetches first connector by applicationId (no connectorId in URL).
- Updated `ConnectorBoard.tsx` to use `useFirstConnectorDetails`.
- Changed route to `/application/:applicationId/connector` (without `:connectorId`).
- Changed navigation in `PublicationList.tsx` and `ConnectorList.tsx` to use new route.
- Added i18n keys: `connectors.statusDescription.*` (EN + RU).
- **Full build verified**: 63 tasks, 7m19s — all successful.

### Navigation Flow (After Fix)
- Metahub → Publications → Click Publication → `/application/{applicationId}/connector` (ConnectorBoard in Applications)
- Application → Connectors → Click Connector → `/application/{applicationId}/connector` (same page)

## Runtime Migrations System (Phases 1-4 complete)

- **MigrationManager**: Created class in `domains/ddl` with full migration CRUD and rollback analysis.
- **Migration Routes**: 4 new endpoints in `metahubs-backend` under `/application/:applicationId/migration*`.
- **Frontend UI**: `MigrationsTab` component with expandable rows, rollback dialog, destructive change warnings.
- **Navigation**: New `ApplicationMigrations` page, sidebar menu item "Migrations" with IconHistory.
- Full build verified (4m54s, 63 tasks successful).
- Remaining Phase 4 items (Publications menu, cross-module breadcrumbs) deferred — require Connector→Metahub API.

## Recent Highlights (last 7 days)

### Runtime Migrations System (2026-01-17)
- Phase 1: MigrationManager + recordMigration in SchemaMigrator.
- Phase 2: applicationMigrationsRoutes with list/detail/analyze/rollback endpoints.
- Phase 3: Frontend API client, hooks, MigrationsTab component, i18n (EN+RU).
- Phase 4: ApplicationMigrations page, route, sidebar menu item.
- Details: progress.md#2026-01-17.

### Application system metadata tables (2026-01-17)
- System tables (_sys_objects, _sys_attributes, _sys_migrations) created and synced during schema generation/migration.
- Metahubs metadata definitions now include presentation + UI/validation config.
- Sync endpoint refreshes metadata even when schema is unchanged.
- Builds: @universo/types, @universo/metahubs-backend.

### Publications rename stabilization (2026-01-14)
- Routes standardized to /publications and /metahubs/:id/publications.
- Breadcrumbs and diff hook aligned to publication naming.
- Details: progress.md#2026-01-14.

### Metahubs QA fixes (2026-01-15)
- SchemaMigrator FK naming/length fixes and shared getVLCString reuse.
- Publications UI cleanup and grammar fixes.
- Details: progress.md#2026-01-15.

### Metahubs frontend build-first (2026-01-16)
- Dist-first exports and updated README imports for metahubs frontend.
- Tests fixed and coverage scope refined for MVP modules.
- Full build and package tests verified.
- Details: progress.md#2026-01-16.

### Applications connectors refactor (2026-01-15)
- Sources renamed to Connectors across applications + metahubs integration.
- template-mui navigation and universo-i18n menu keys aligned to connectors.
- Details: progress.md#2026-01-15.

### Connector -> Metahub links UI (2026-01-15)
- Added MetahubSelectionPanel, connectorMetahubs APIs, and query hooks.
- Added ConnectorMetahub/MetahubSummary types and i18n keys.
- Details: progress.md#2026-01-15.

### useViewPreference QA improvements (2026-01-15)
- SSR-safe hook with isLocalStorageAvailable guard.
- 14 unit tests added; localStorage keys normalized across packages.
- Details: progress.md#2026-01-15.

## QA Notes

- Pre-existing Prettier deviations remain in metahubs-frontend.
- No new lint regressions introduced by the QA cleanups.
- Root build timed out after ~200s; rerun needed for full verification.
- metahubs-frontend tests emit React Router future-flag and KaTeX quirks warnings.
- metahubs-backend tests emit expected security warn logs for permission checks.

## Active Checks

- Re-run full `pnpm build` to confirm monorepo build completion.
- Manual QA: publications list/detail/sync/diff endpoints.
- Manual QA: connector-metahub link/unlink constraints (single/required).
- Manual QA: useViewPreference storage keys in projects/storages.
- Confirm publication naming consistency across UI and API.
- Confirm member role tests remain green after schema changes.

## Context Snapshot

- Metahubs-backend: domain architecture under `src/domains/*`; runtime schema tooling moved to `domains/ddl`.
- Legacy backend folders removed: `src/routes`, `src/schema`, `src/schemas`, `src/services`.
- Singular detail routes: `/metahub/:metahubId`, `/metahub/:metahubId/hub/:hubId`, `/metahub/:metahubId/catalog/:catalogId`, `/attribute/:attributeId`, `/record/:recordId`, `/metahub/:metahubId/publication/:publicationId`.
- List routes remain plural: `/metahubs`, `/metahub/:metahubId/catalogs`, `/metahub/:metahubId/hubs`, `/metahub/:metahubId/publications`.
- Public routes base: `/public/metahub/:slug` (core backend mount updated).
- Connector-metahub links: `/applications/:appId/connectors/:connectorId/metahubs`.
- Canonical types: PaginationParams, PaginationMeta, PaginatedResponse<T>, Filter* (in @universo/types).
- Pattern: systemPatterns.md#universal-list-pattern-critical.
- Schema naming: `app_<uuid32>` remains standard.

## Blockers

- None.

## Next Steps

- Await QA verification and close remaining manual checks.
- If no blockers, switch to reflect mode on request.
- Review open tasks: tasks.md#planned-tasks.
