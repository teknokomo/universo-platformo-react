# Tasks
> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

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

> See full plan: `memory-bank/plans/optimistic-locking-unification.md`

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
## COMPLETED (2026-01-14 to 2026-01-01): Condensed log

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
