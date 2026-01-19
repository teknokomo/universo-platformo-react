# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---

## IMPLEMENT (2025-01-19): PR #646 Bot Review Fixes

### Code Quality Fixes (Copilot + Gemini recommendations)
- [x] Keep `generateSchemaName` in applicationsRoutes.ts with comment explaining duplication reason (avoid circular dependency)
- [x] Remove unused imports `ApplicationSchemaStatus`, `ConnectorMetahub` from applicationsRoutes.ts
- [x] Make `applicationId` required parameter in `syncConnector` legacy function (connectors.ts)
- [x] Add console.warn to `useConnectorDiff` before throwing error for better debugging
- [x] Add validation for multiple roles in applicationSyncRoutes.ts access check
- [x] Add validation for multiple connectors/publications in applicationMigrationsRoutes.ts helper
- [x] Wrap connector creation with metahub link in transaction (connectorsRoutes.ts)

### Migration Fixes
- [x] UNIQUE constraint on nullable schema_name is OK - PostgreSQL allows multiple NULLs with UNIQUE (documented behavior)

### Skipped Recommendations (with reasons)
- [ ] Remove autoCreateApplication from Publication entity - **SKIP**: Field is useful for future auditing/cascading deletes
- [ ] Import generateSchemaName from metahubs-backend - **SKIP**: Would create circular dependency

### Build & Verification
- [x] Run pnpm build to verify changes - SUCCESS (63 tasks, 5m35s)

---

## IMPLEMENT (2025-01-18): Publication/Connector QA Fixes (Round 3) ✅

### Issue 1: Migration codename index error
- [x] Remove `idx_connectors_codename` from CreateApplicationsSchema migration (up/down methods)

### Issue 2: Applications endpoint 500 error
- [x] Fix SQL query to use connectors_metahubs instead of deleted connectors_publications

### Issue 3: Auto-create Application checkbox doesn't work
- [x] Pass autoCreateApplication field to API in handleCreatePublication

### Issue 4: Connector sync 404 error
- [x] Refactor sync to use publicationId instead of applicationId
- [x] Add useMetahubPublication hook
- [x] Update connectors.ts API to use publicationId
- [x] Update mutations.ts SyncConnectorParams
- [x] Update ConnectorDiffDialog and ConnectorBoard

### Issue 5: Migrations page 400 error
- [x] Add getApplicationWithSchema helper that finds schemaName via Publication chain

### Issue 6: MetahubSelectionPanel TypeError in Connector create dialog
- [x] Import useAvailableMetahubs hook
- [x] Add hook call to fetch available metahubs
- [x] Fix MetahubSelectionPanel props (use correct prop names)

### Issue 7: Toggle switches should be disabled in Connector create dialog
- [x] Add `togglesDisabled` prop to EntitySelectionPanel
- [x] Add `togglesDisabled` prop to MetahubSelectionPanel (pass through)
- [x] Pass `togglesDisabled={true}` in ConnectorList.tsx buildCreateTabs

### Issue 8: schemaName generated incorrectly for Application (used Publication UUID)
- [x] Fix auto-create logic to generate schemaName based on Application UUID, not copy from Publication
- [x] Add schemaName generation when creating Application manually (applicationsRoutes.ts)
- [x] Fix ConnectorBoard to use Application's schemaName instead of Publication's

### Issue 9: Schema sync not working for manually created Applications (major refactoring)
- [x] Identify root cause: sync used publicationId, but manually created Apps have no Publication
- [x] Create new POST `/:applicationId/sync` endpoint in applicationsRoutes.ts
- [x] Create new GET `/:applicationId/diff` endpoint in applicationsRoutes.ts
- [x] Both endpoints traverse Application → Connector → ConnectorMetahub → Metahub to get catalog definitions
- [x] Add `syncApplication(applicationId, confirmDestructive)` to connectors.ts API
- [x] Add `getApplicationDiff(applicationId)` to connectors.ts API
- [x] Add `useApplicationDiff(applicationId, options)` hook in useConnectorSync.ts
- [x] Update `useSyncConnector` mutation to use applicationId instead of metahubId/publicationId
- [x] Update ConnectorBoard.tsx to use applicationId for sync
- [x] Update ConnectorDiffDialog.tsx to accept applicationId prop
- [x] Add `applicationDiff()` query key factory in queryKeys.ts
- [x] Fix TypeScript errors:
  - Use `ApplicationSchemaStatus` enum instead of string literals
  - Fix `diff.hasDestructiveChanges` to `diff.destructive.length > 0`
  - Fix `applyMigration()` to `applyAllChanges()`
  - Fix role `'viewer'` to `'member'`

### Build & Verification
- [x] Run applications-backend build - SUCCESS
- [x] Run applications-frontend build - SUCCESS
- [x] Run full pnpm build - SUCCESS (63 tasks, 4m52s)

---

## IMPLEMENT (2025-01-18): Publication/Connector QA Fixes (Round 2) ✅

### Issue 1: Auto-create Application checkbox doesn't work
- [x] Add imports for Application, ApplicationUser, Connector, ConnectorMetahub entities in publicationsRoutes.ts
- [x] Implement auto-create logic in POST handler (inside transaction)
- [x] Create Application with name/description from Publication
- [x] Create ApplicationUser as owner (snake_case fields: application_id, user_id)
- [x] Create Connector with name/description from Metahub
- [x] Create ConnectorMetahub link

### Issue 2: Remove broken "Открыть" and "Синхронизировать" menu items
- [x] Remove 'view' and 'sync' action descriptors from PublicationActions.tsx
- [x] Remove OpenInNewIcon and SyncIcon imports
- [x] Delete PublicationBoard.tsx file
- [x] Remove PublicationBoard export from metahubs-frontend index.ts
- [x] Remove PublicationBoard export from publications/index.ts
- [x] Remove PublicationBoard route from MainRoutesMUI.tsx
- [x] Update external-modules.d.ts (remove PublicationBoard)
- [x] Update exports.test.ts (remove PublicationBoard)

### Issue 3: Fix Connector create dialog (remove codename, use proper Metahubs panel)
- [x] Remove codename from Connector types (Connector, ConnectorDisplay, ConnectorLocalizedPayload)
- [x] Remove codename from toConnectorDisplay function
- [x] Remove codename from ConnectorActions.tsx
- [x] Remove codename from ConnectorList.tsx (localizedFormDefaults, validation, columns)
- [x] Remove codename from backend connectorsRoutes.ts (schemas, handlers, queries)
- [x] Delete ConnectorMetahubSelectPanel.tsx (garbage component)
- [x] Remove ConnectorMetahubSelectPanel export from components/index.ts
- [x] Replace with MetahubSelectionPanel in buildCreateTabs
- [x] Update state to use metahubIds: [] array instead of metahubId: null

### Issue 4: Remove redundant connectors_publications table
- [x] Delete migration 1800100000000-AddConnectorsPublications.ts (done in previous session)
- [x] Delete ConnectorPublication entity (done in previous session)
- [x] Remove ConnectorPublication export from applications-backend index.ts

### Build & Verification
- [x] Fix import path for applications entities (use '@universo/applications-backend')
- [x] Fix ApplicationUser entity field names (snake_case: application_id, user_id)
- [x] Fix extra closing parenthesis in MainRoutesMUI.tsx
- [x] Run full pnpm build - SUCCESS (63 tasks, 6m10s)

---

## IMPLEMENT (2025-01-18): Publication/Connector QA Fixes (Round 1) ✅

### Issue 1: Publication dialog tabs wrong order
- [x] Create ApplicationsCreatePanel.tsx for auto-create Application checkbox
- [x] Update PublicationList.tsx buildCreateTabs (General → Access → Applications)
- [x] Update PublicationActions.tsx buildFormTabs (remove Metahubs tab)
- [x] Remove unused imports (MetahubInfoPanel, Metahub type, statusColors)

### Issue 2: Remove broken links from Publication cards/table
- [x] Remove Link wrapper from name column in publicationColumns
- [x] Remove onClick from ItemCard
- [x] Remove getRowLink from FlowListTable
- [x] Remove goToPublication function

### Issue 3: Fix Publication display data
- [x] Update PublicationDisplay type (remove schema/status, add accessMode)
- [x] Update getPublicationCardData function
- [x] Update publicationColumns (name, description, accessMode)
- [x] Update ItemCard footerEndContent (accessMode chip)
- [x] Add i18n keys for accessMode (EN + RU)

### Issue 4: Add Metahubs tab to Connector create dialog
- [x] Create ConnectorMetahubSelectPanel.tsx component
- [x] Add export in components/index.ts
- [x] Update backend schema (add metahubId to createConnectorSchema)
- [x] Update backend POST handler to create ConnectorMetahub link
- [x] Update frontend ConnectorLocalizedPayload type (add metahubId)
- [x] Update ConnectorList.tsx - add tabs with General + Metahubs
- [x] Add state for availableMetahubs, useEffect to load them
- [x] Update validateConnectorForm and canSaveConnectorForm
- [x] Update handleCreateConnector to pass metahubId
- [x] Add i18n keys for connector tabs and validation (EN + RU)

### Phase 5: Build & Verification
- [x] Run full pnpm build - SUCCESS (63 tasks, 4m40s)
- [x] Update memory-bank files

---

## IMPLEMENT (2026-01-18): Publication as Separate Entity

### Phase 1: Database Migrations
- [x] Create migration `AddPublicationsTable` in metahubs-backend (publications + publications_users)
- [x] Create migration `AddConnectorsPublications` in applications-backend (junction table)
- [x] Register migrations in respective index.ts files

### Phase 2: TypeORM Entities
- [x] Create `Publication` entity in metahubs-backend
- [x] Create `PublicationUser` entity in metahubs-backend
- [x] Create `ConnectorPublication` entity in applications-backend
- [x] Update `Connector` entity with new relation
- [x] Update entity exports in both packages

### Phase 3: Backend Routes Refactoring
- [x] Refactor `publicationsRoutes.ts` to use new Publication entity
- [x] Add endpoint for linked applications

### Phase 4: Frontend Changes
- [x] Update Publication tabs (Access + Applications)
- [x] Add AccessPanel and ApplicationsPanel components
- [x] Update API types in publications.ts (accessMode, accessConfig, LinkedApplication)

### Phase 5: i18n
- [x] Add new translation keys (EN + RU)

### Phase 6: Build & Verification
- [x] Build metahubs-backend - SUCCESS
- [x] Build applications-backend - SUCCESS
- [x] Build metahubs-frontend - SUCCESS
- [x] Run full pnpm build - SUCCESS (63 tasks, 6m48s)
- [x] Update memory-bank files

---

## IMPLEMENT (2026-01-17): Add DDL Module Unit Tests ✅

### QA Recommendation: Add unit tests for DDL module
- [x] Study existing test structure (jest.config.js, typeormMocks.ts)
- [x] Create tests for `naming.ts` - 5 pure functions (generateSchemaName, generateTableName, generateColumnName, isValidSchemaName, buildFkConstraintName)
- [x] Create tests for `diff.ts` - calculateSchemaDiff with various scenarios (initial, add/drop tables/columns, kind changes)
- [x] Create tests for `snapshot.ts` - buildSchemaSnapshot with entities and fields
- [x] Create tests for `SchemaGenerator` - static methods (mapDataType) and instance methods (createSchema, dropSchema, generateFullSchema)
- [x] Create tests for `MigrationManager` - generateMigrationName, recordMigration, listMigrations, getMigration
- [x] Run all tests: 7 passed, 127 total (5 DDL test files added)

---

## IMPLEMENT (2026-01-17): Fix Migrations Page Not Loading Data ✅

### Issue: Migrations exist in DB but UI shows "No migrations yet"
- **Root cause**: Frontend API client used wrong URL prefix `/metahubs/application/...` but routes are mounted directly as `/application/...`
- [x] Remove `/metahubs/` prefix from `fetchMigrations()` URL
- [x] Remove `/metahubs/` prefix from `fetchMigration()` URL
- [x] Remove `/metahubs/` prefix from `analyzeMigrationRollback()` URL
- [x] Remove `/metahubs/` prefix from `rollbackMigration()` URL
- [x] Run pnpm build (63 tasks, 4m49s) — all successful

---

## IMPLEMENT (2026-01-17): Fix Schema Status Display + Initial Migration Recording ✅

### Issue 1: ConnectorBoard shows "Draft" when DB has "Synced"
- **Root cause**: `ConnectorBoard` received `application` as prop but it was never passed from `MainRoutesMUI`
- [x] Add `useApplicationDetails` hook call in ConnectorBoard to fetch application data directly
- [x] Remove unused `application` prop from `ConnectorBoardProps`

### Issue 2: Initial schema creation doesn't record migration
- **Root cause**: `generateFullSchema()` doesn't call `recordMigration()` — only `applyAllChanges()` does
- [x] Add `GenerateFullSchemaOptions` interface with `recordMigration` and `migrationDescription` options
- [x] Update `generateFullSchema()` to record initial migration when `recordMigration: true`
- [x] Export `GenerateFullSchemaOptions` from ddl/index.ts
- [x] Update sync endpoint in `publicationsRoutes.ts` to pass `{ recordMigration: true, migrationDescription: 'initial_schema' }`

### Build & Verification
- [x] Run pnpm build (63 tasks, 4m50s) — all successful

---

## IMPLEMENT (2026-01-17): Fix ConnectorBoard Issues ✅

## IMPLEMENT (2026-01-17): Fix Schema Sync Endpoint Path

### Issue: /sync returns HTML (SPA fallback)
- [x] Update connectors API endpoints to use `/metahub/...` (remove extra `/metahubs` prefix) for diff + sync.
- [x] Remove temporary debug logs added during diagnosis (applications-frontend connectors API, core-backend API debug middleware, metahubs-backend schema sync/diff logs if no longer needed).
- [x] Rebuild affected packages (applications-frontend, core-frontend, core-backend, metahubs-backend) and re-verify sync.

### Issue 1: Breadcrumbs don't show "> Коннекторы > Название коннектора"
- [x] Create `useConnectorName` hook in useBreadcrumbName.ts.
- [x] Export `useConnectorName` from hooks/index.ts.
- [x] Add `connector` segment handling in NavbarBreadcrumbs.tsx.

### Issue 2: URL lacks connectorId (future multi-connector support)
- [x] Update route from `connector` to `connector/:connectorId` in MainRoutesMUI.tsx.
- [x] Update ConnectorBoard to use `connectorId` from params.
- [x] Update PublicationList navigation to include connectorId.
- [x] Update ConnectorList navigation to include connectorId.
- [x] Update backend to return connectorId in publication responses (POST, GET, LIST).

### Issue 3: Schema diff shows "No changes detected" for new publication
- [x] Add debug logging to backend diff endpoint (catalogDefs.length, oldSnapshot, hasChanges).
- [x] Treat missing schema as actionable diff in ConnectorDiffDialog (use schemaExists to allow create).
- [x] User to verify schema creation works via sync dialog.

### Issue 4: Missing i18n translation
- [x] Add `schemaUpToDate` key to EN i18n.
- [x] Add `schemaUpToDate` key to RU i18n.

### Build & Verification
- [x] Run pnpm build and verify (63 tasks, 5m37s - all successful).
- [x] Update memory-bank files.

---

## IMPLEMENT (2026-01-17): Fix Connector Metahub Query Error

### Issue: GET /applications/:appId/connectors/:connectorId/metahubs returns 500
- [x] Update cross-schema join to use `metahubs.metahubs.slug` (no `codename` column).
- [x] Build applications-backend.
- [x] Run full workspace build.
- [x] Update memory-bank files.

---

## IMPLEMENT (2026-01-17): Fix Sync Button Disabled (Missing Metahub Data) ✅

### Issue: Sync button always disabled for new publications
- **Root cause**: Backend returned `ConnectorMetahub` links without nested `metahub` object (only `metahubId`).
- **Frontend expected**: `linkedMetahubs[0].metahub` to contain metahub details, but it was undefined.
- [x] Update `connectorsRoutes.ts` GET endpoint to use cross-schema SQL join with `metahubs.metahubs` table.
- [x] Transform response to include nested `metahub` object with id, codename, name, description.
- [x] Update `ConnectorMetahub` type in `types.ts` to include optional `metahub?: MetahubSummary | null`.
- [x] Update `useConnectorMetahubs.ts` hooks to handle nullish coalescing (`?? null`).
- [x] Build and verify (63 tasks, 6m29s) — all successful.

---

## IMPLEMENT (2026-01-17): Fix i18n Keys in ConnectorBoard ✅

### Issue: Non-working Sync button (i18n object error)
- [x] Fix `t('connectors.sync', ...)` → `t('connectors.sync.button', ...)` and `t('connectors.sync.syncing', ...)`.
- [x] Fix `t('connectors.viewMigrations', ...)` → `t('connectors.board.viewMigrations', ...)`.
- [x] Add missing `connectors.schema.*` keys (title, name, status, lastSync, source) to EN i18n.
- [x] Add missing `connectors.schema.*` keys to RU i18n.
- [x] Build and verify (63 tasks, 6m42s) — all successful.
- [x] Update memory-bank files.

---

## IMPLEMENT (2026-01-17): Fix Migration Recording + Move Sync UI to Applications ✅

### Issue 1: Migrations not recorded on schema sync ✅
- [x] Add `{recordMigration: true, migrationDescription: 'schema_sync'}` to `applyAllChanges()` in publicationsRoutes.ts.

### Issue 2: i18n consolidation missing migrations namespace ✅
- [x] Add `migrations?: Record<string, unknown>` to ApplicationsBundle interface.
- [x] Add `migrations: bundle?.migrations ?? {}` to consolidateApplicationsNamespace return.

### Issue 3: Move sync UI from Metahubs to Applications ✅
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

### Build & Verification ✅
- [x] Run pnpm build (63 tasks, 7m19s) — all successful.
- [x] Update memory-bank files.

---

## IMPLEMENT (2026-01-17): Runtime Migrations with Knex

### Phase 1: Backend - Runtime Migrations Engine ✅
- [x] Create MigrationManager class in domains/ddl with migration recording and listing.
- [x] Add recordMigration() method to SchemaGenerator.
- [x] Implement listMigrations() for retrieving migration history.
- [x] Implement rollbackMigration() with destructive change blocking.
- [x] Add analyzeRollbackPath() to check if rollback is safe.
- [x] Add DDL exports to metahubs-backend/src/index.ts.

### Phase 2: Backend - Application Migration Routes ✅
- [x] Create applicationMigrationsRoutes.ts in metahubs-backend.
- [x] Add GET /application/:applicationId/migrations endpoint.
- [x] Add GET /application/:applicationId/migrations/:id/analyze endpoint.
- [x] Add POST /application/:applicationId/migrations/:id/rollback endpoint.
- [x] Mount routes in metahubs-backend router.ts.
- [x] Update flowise-core-backend to expose new routes (via metahubs-backend index.ts).

### Phase 3: Frontend - Applications UI ✅
- [x] Create MigrationsTab component in applications-frontend.
- [x] Add migrations API client and hooks.
- [x] Move/adapt SchemaSyncPanel from metahubs to applications (migrations tab replaces sync panel).
- [x] Add rollback UI with destructive change warnings.
- [x] Add i18n keys for migrations UI (EN + RU).

### Phase 4: Navigation & Integration ✅
- [x] Add "Migrations" tab to ApplicationBoard tabbed interface (created ApplicationMigrations page).
- [x] Add route `/application/:applicationId/migrations` in universo-template-mui.
- [x] Add Migrations menu item to Application sidebar with IconHistory.
- [x] Add i18n keys for "migrations" menu item (EN + RU).
- [ ] Add Publications menu item to Application sidebar (navigate to linked Metahubs) — DEFERRED: requires Connector→Metahub API.
- [ ] Update breadcrumbs for Publications → Metahub → Application path — DEFERRED: complex navigation flow.

### Phase 5: Documentation & Testing
- [ ] Add unit tests for MigrationManager.
- [ ] Add integration tests for migration routes.
- [ ] Update metahubs-backend README (EN/RU).
- [ ] Update applications-frontend README (EN/RU).
- [ ] Update memory-bank files.

---

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

---

## IMPLEMENT (2026-01-17): Application system metadata tables (Phase 1)

- [x] Extend @universo/types with MetaPresentation + exports for metahubs metadata.
- [x] Extend DDL types to include presentation + sys metadata shapes.
- [x] Populate presentation/validation/uiConfig in buildCatalogDefinitions.
- [x] Add system tables + DML registration in SchemaGenerator (transaction-safe).
- [x] Update SchemaMigrator for DML changes + new change types.
- [x] Bump schema snapshot version and add hasSystemTables/backward-compat logic.
- [x] Verify builds/tests for @universo/types and @universo/metahubs-backend.
- [x] Update memory-bank activeContext.md and progress.md.

---

## IMPLEMENT (2026-01-16): Metahubs API routes standardization + test warnings + coverage

- [x] Remove act/MSW/useHasGlobalAccess warnings in metahubs-frontend tests (setup mocks + test fixes).
- [x] Add MSW handler for `/api/v1/profile/settings` in metahubs-frontend mocks.
- [x] Restore shared/utils coverage in metahubs-frontend and add tests to meet thresholds.
- [x] Refactor metahubs-backend routes to singular detail paths (metahub/hub/catalog/attribute/record/publication) and align public routes.
- [x] Update metahubs-frontend API clients/tests and template-mui breadcrumb fetches to new backend paths.
- [x] Update metahubs backend/frontend READMEs (EN/RU) to match new routes and i18n docs rules.
- [ ] Run full root build (timed out after ~200s; re-run needed).
- [x] Update progress.md and activeContext.md with route standardization changes.

---

## IMPLEMENT (2026-01-16): Metahubs frontend build-first + docs + tests

- [x] Switch metahubs-frontend to build-first (dist exports + tsdown entry for src/index.ts).
- [x] Remove src/index.d.ts temporary stub and align package.json exports.
- [x] Update README.md and README-RU.md to remove /api imports and match i18n-docs rules.
- [x] Update/add metahubs-frontend tests for entry exports after build-first.
- [x] Fix failing metahubs-frontend tests (api wrappers mock path, view preference mock shape, actions expectations).
- [x] Verify metahubs-frontend tests, metahubs-backend tests, and full root build.
- [x] Update progress.md and activeContext.md with build-first changes.

---

## IMPLEMENT (2026-01-16): Metahubs backend tests + ddl rename

- [x] Rename `domains/runtime-schema` to `domains/ddl` and update imports/docs.
- [x] Fix metahubsRoutes tests (mocks + expectations for sorting/search/members).
- [x] Move ts-jest isolatedModules to tsconfig.test.json and update base jest config.
- [x] Verify metahubs-backend tests/build and note any gaps.
- [x] Update progress.md and activeContext.md with changes.

---

## IMPLEMENT (2026-01-16): Metahubs backend domain refactor

- [x] Inventory current routes/schema/services usage and monorepo imports.
- [x] Create domain folders (metahubs, hubs, catalogs, attributes, records, publications, runtime-schema, shared) and move code.
- [x] Rebuild route composition and exports using domain routers (no legacy paths).
- [x] Update internal imports, tests, and docs to new domain structure.
- [x] Remove old folders (src/routes, src/schema, src/services, src/schemas) after migration.
- [x] Verify builds/tests for metahubs-backend and note any gaps.
- [x] Update progress.md and activeContext.md with refactor summary.

---

## IMPLEMENT (2026-01-15): Metahubs TS verification

- [x] Run targeted TS builds for metahubs-backend and metahubs-frontend to detect errors.
- [x] Fix any TS errors uncovered by the builds and re-run the affected build.
- [x] Update progress.md with results and note any decisions in activeContext.md if needed.

---

## IMPLEMENT (2026-01-16): Metahubs frontend modular refactor

- [x] Introduce domain folders for metahubs frontend and move UI pages/actions into domains with compatibility exports.
- [x] Move API modules into domain folders and keep stable re-exports for existing imports.
- [x] Update internal imports and tests to match new structure where needed.
- [x] Verify targeted builds for metahubs-frontend.
- [x] Update progress.md with refactor summary.

---

## IMPLEMENT (2026-01-16): Metahubs frontend cleanup + domain barrels

- [x] Inventory and update monorepo imports to remove pages/* usage; switch routes to root exports.
- [x] Introduce domain barrel exports to reduce relative import depth.
- [x] Domainize metahubs mutations and shared helpers; update imports.
- [x] Remove obsolete proxy layers (src/pages, src/api) and update package exports/tests.
- [x] Verify targeted builds/tests for metahubs-frontend.
- [x] Update progress.md with cleanup summary.

---

## ✅ COMPLETED (2026-01-15): QA fixes for types unification

- [x] Update roleSchema/memberFormSchema tests for dynamic roles; add empty role rejection test.
- [x] Remove PaginationMeta duplication (re-export from @universo/types).
- [x] Replace dangerouslySetInnerHTML with SafeHTML in chat UI.
- [x] All tests passing.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Monorepo-wide types unification

- [x] Canonical types in @universo/types: PaginatedResponse items, PaginationParams alias, Filter types.
- [x] @universo/template-mui re-exports pagination/filter types; keeps MUI-specific types.
- [x] getLocalizedString -> getVLCString migration (applications/metahubs).
- [x] Pagination types migrated across 11 frontends (admin, campaigns, storages, projects, spaces, organizations, publish, start, clusters, metaverses, metahubs, applications, uniks).
- [x] Remove UseApi from 7 frontends (campaigns, projects, storages, organizations, clusters, metaverses, uniks).
- [x] Full build passed; systemPatterns updated.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Metahubs types refactor + cleanup

- [x] Remove dead/legacy types (gulp.d.ts, ui.d.ts, LocalizedField, getLocalizedContent, UseApi).
- [x] Migrate pagination types to @universo/types; add PaginationParams alias.
- [x] Reorganize types.ts with JSDoc and grouped exports.
- [x] Build metahubs-frontend and full monorepo passed.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Metahubs QA fixes

- [x] SchemaMigrator FK naming + constraint length fixes.
- [x] Reuse shared getVLCString; remove renderLocalizedFields.
- [x] Publications UI naming cleanup + EN grammar fix.
- [x] Lint re-run (pre-existing warnings remain).
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Publications refactor + sync fixes

- [x] Backend routes: `/metahubs/:id/publications` (list/detail/sync/diff/delete).
- [x] Frontend publications API aligned to `/publications` endpoints.
- [x] Breadcrumbs fetch publication names from `/publications`.
- [x] Sync action wired to create/update/sync/delete publication APIs.
- [x] Build verified (63 tasks).
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Source -> Metahub links UI (Phase 5-6)

- [x] MetahubSelectionPanel component.
- [x] sourceMetahubs API functions (list/link/unlink/listAvailable).
- [x] useSourceMetahubs hooks (list/available/link/unlink).
- [x] Types: SourceMetahub, MetahubSummary, SourceMetahubsResponse.
- [x] EN/RU translations for sources.metahubs.*.
- [x] Build @universo/applications-frontend success.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): useViewPreference QA improvements

- [x] SSR-safe hook in @universo/template-mui with isLocalStorageAvailable guard.
- [x] Export ViewStyle + DEFAULT_VIEW_STYLE; re-export across 7 packages.
- [x] 14 unit tests added; keys normalized (projects/storages).
- [x] Lint and build verification completed.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-14): Publications rename stabilization

- [x] Rename Application* -> Publication* in metahubs UI and types.
- [x] Update API/hook names and routes (`/publications`, `/publication/:publicationId`).
- [x] Update query keys/mutations and menu configs (EN/RU).
- [x] Backend routes factory renamed to createPublicationsRoutes.
- [x] Build verified (63 tasks).
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Publications page fixes

- [x] Add missing publications i18n keys + labels (EN/RU).
- [x] Fix crash on /metahub/:id/publications and diff hook naming.
- [x] Update breadcrumbs for publication routes.
- [x] Build verified.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Source deletion & table unification

- [x] Disable Source delete actions and hide Delete button.
- [x] Update EN/RU deletion restriction copy.
- [x] Extend CompactListTable action column props.
- [x] Unify selection panels via EntitySelectionPanel.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Application/Source UX fixes

- [x] Add Stack spacing and tabs to Application/Source dialogs.
- [x] Pass metahub context into creation/edit dialogs.
- [x] Fix SourceMetahubInfoWrapper items extraction.
- [x] Move Source list alert below ViewHeader and keep Add button disabled/visible.
- [x] Add clickable Source cards + row navigation links.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Application creation from Metahubs fixes

- [x] Add Application creation tabs with MetahubInfoPanel.
- [x] Resolve owner assignment when creating Application.
- [x] Copy Metahub name/description to Source on create.
- [x] Add Source edit dialog Metahubs tab; single Source limit.
- [x] Add translations for singleSourceLimit.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Link Applications and Metahubs via Sources

- [x] Extend applications schema with schema sync fields.
- [x] Add SourceMetahub junction entity + RLS policy.
- [x] Create applicationsRoutes in metahubs-backend (CRUD/diff/sync).
- [x] Add source-metahub link endpoints and build verification.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Applications packages QA fixes

- [x] Rename tests and remove obsolete backend tests.
- [x] Update README terminology and jest config.
- [x] Clean Metahubs/Catalogs comments in sources.
- [x] useViewPreference in ApplicationMembers; build/tests verified.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Applications backend tests + localStorage improvements

- [x] Add applicationsRoutes/sourcesRoutes test suites.
- [x] Fix test expectations (403 vs 404, pagination shape).
- [x] Add MSW handler for profile settings.
- [x] Apply useViewPreference to MetahubMembers + tests.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-13): Applications packages creation

- [x] Clone metahubs packages -> applications-frontend/backend.
- [x] Remove catalogs/attributes/records artifacts.
- [x] Rename Metahub -> Application and Hub -> Source files.
- [x] Register entities, migrations, routes, i18n, and menu entries.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Catalogs/attributes improvements

- [x] Normalize Attribute.sortOrder after delete (1..N).
- [x] Hub-less attribute endpoints + direct API functions.
- [x] Hub-less record endpoints + direct query keys.
- [x] Routes refactor `/catalogs/:id` -> `/catalog/:id`.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Schema sync UUID naming

- [x] Use UUID-based `cat_<uuid32>` and `app_<uuid32>` naming.
- [x] SchemaMigrator diff uses UUID names consistently.
- [x] Build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Applications UI & diff fixes

- [x] Save VLC structure for comparisons and primaryLocale fields.
- [x] Replace confirm() with ConfirmDeleteDialog.
- [x] Add edit action + PATCH endpoint + i18n keys.
- [x] Add search/pagination and fix Options menu crash.
- [x] Build verification.

---

## ✅ COMPLETED (2026-01-13): Applications config/data separation

- [x] Add Application entity + schema status fields.
- [x] Create migrations + SchemaGenerator/SchemaMigrator services.
- [x] Add CRUD/diff/sync routes and frontend hooks/UI.
- [x] Register menu, routes, i18n, storage keys.
- [x] Build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-12): Catalogs endpoint tests

- [x] Add catalogsRoutes tests (17 cases).
- [x] Extend MockRepository count.
- [x] Document UUID validation in routes.
- [x] Details: progress.md#2026-01-12.

---

## ✅ COMPLETED (2026-01-11): Catalogs + QueryRunner QA fixes

- [x] Hub-less catalog DELETE endpoint and deleteCatalogDirect API.
- [x] escapeLikeWildcards and getRequestManager consolidation.
- [x] QueryRunner support in AccessGuards and loadMembers patterns.
- [x] CompactListTable header + HubDeleteDialog UX improvements.
- [x] Catalog/Hub operations fixes (blocking catalogs, update endpoints).
- [x] isRequiredHub migration + documentation.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-11.

---

## ✅ COMPLETED (2026-01-10): Catalogs QA rounds + code quality

- [x] Sorting, columns, catalogsCount, dashboard widget updates.
- [x] AllCatalogs list UI, i18n fixes, cache invalidation.
- [x] useCatalogName hook + breadcrumbs updates.
- [x] Optimize catalogsRoutes/hubsRoutes to avoid N+1 queries.
- [x] Centralize localStorage keys + useViewPreference hook in list pages.
- [x] Full project rebuilds.
- [x] Details: progress.md#2026-01-10.

---

## ✅ COMPLETED (2026-01-09): Metahubs VLC rollout + FlowListTable fix

- [x] VLC rendering fixes in metahubs lists.
- [x] FlowListTable listView rendering fixed.
- [x] Build verification.
- [x] Details: progress.md#2026-01-09.

---

## ✅ COMPLETED (2026-01-08): Record edit fixes

- [x] Pass raw record data to actions; fetch full record when missing.
- [x] Delay record edit fields until hydration completes.
- [x] Build metahubs-frontend verified.
- [x] Details: progress.md#2026-01-08.

---

## ✅ COMPLETED (2026-01-06): Attributes localization hardening

- [x] Localized name + codename auto-fill; remove description field.
- [x] Align API payloads/mutations and backend validation.
- [x] Update tests and builds for metahubs frontend/backend.
- [x] Details: progress.md#2026-01-06.

---

## ✅ COMPLETED (2026-01-05): Project metadata i18n + login UX

- [x] Add locale metadata files and update landing/onboarding translations.
- [x] Update entrypoints and docs metadata.
- [x] Improve login error messages and i18n keys; security-safe copy.
- [x] Full build and lint verification.
- [x] Details: progress.md#2026-01-05.

---

## ✅ COMPLETED (2026-01-04): Auth bot review fixes

- [x] Refactor AuthView/AuthPage per review (mode switcher + useEffect).
- [x] Align systemPatterns docs to flat config.
- [x] Details: progress.md#2026-01-04.

---

## ✅ COMPLETED (2026-01-03): Auth feature toggles + i18n migration

- [x] Add auth feature toggles and /auth-config endpoint.
- [x] Update auth-frontend types, UI, and i18n keys.
- [x] Migrate start page i18n to registerNamespace(); add StartFooter.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-03.

---

## ✅ COMPLETED (2026-01-02): SmartCaptcha improvements

- [x] Add login captcha support and shared captcha module.
- [x] Fail-closed behavior for captcha services.
- [x] Lint and full build passed.
- [x] Details: progress.md#2026-01-02.

---

## ✅ COMPLETED (2026-01-01): SmartCaptcha + lead forms

- [x] Server-side captcha validation for leads.
- [x] /p/:slug SmartCaptcha domain fix via server render endpoint.
- [x] Quiz lead forms support (captchaEnabled, captchaSiteKey, submit guard).
- [x] Auth captcha integration and i18n updates.
- [x] Details: progress.md#2026-01-01.

---

## ✅ COMPLETED (2025-12-31 to 2025-12-14): Condensed log

- [x] Cookie/lead consent, legal pages, onboarding/auth fixes, start page MVP.
- [x] Metahubs transformation + RLS QA fixes.
- [x] AgentFlow integration, config UX, QA hardening.
- [x] Flowise 3.0.12 components refresh.
- [x] Details: progress.md#2025-12-31.
- [x] Also see progress.md#2025-12-30 for legal/profile updates.

---

## 📋 PLANNED TASKS

### Session Persistence on Server Restart

- Status: Deferred until production deployment pattern is clear; currently using MemoryStore.

### Future Auth Improvements

- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT).
- [ ] Review auth architecture for scalability.

### Admin Module Enhancements

- [ ] Role cloning, templates, permission inheritance.
- [ ] Audit log for role/permission changes.
- [ ] Multi-instance support (remote instances).

### Frontend UX

- [ ] Dark mode theme.
- [ ] Keyboard shortcuts.
- [ ] Mobile responsiveness improvements.
- [ ] Tour/onboarding for new users.
- [ ] Server-side caching, CDN integration.
- [ ] Bundle size optimization.
- [ ] Complete API documentation (OpenAPI).
- [ ] Architecture decision records (ADR).

---

## 🧪 TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation.
- [ ] Standardize error handling across packages.
- [ ] Add unit/E2E tests for critical flows.
- [ ] Resolve Template MUI CommonJS/ESM conflict.
- [ ] Database connection pooling optimization.

---

## 🔒 SECURITY TASKS

- [ ] Rate limiting for all API endpoints.
- [ ] CSRF protection review.
- [ ] API key rotation mechanism.
- [ ] Security headers (HSTS, CSP).
- [ ] Security audit.
- [ ] 2FA/MFA system.

---

## 📚 HISTORICAL TASKS

For tasks completed before 2025-12, see progress.md.
Main achievements:
- v0.40.0: Tools/Credentials/Variables/ApiKey/Assistants/Leads/ChatMessage/DocStore/CustomTemplates extraction, Admin Instances MVP, RBAC Global Roles.
- v0.39.0: Campaigns, Storages modules, useMutation refactor.
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes.
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics.
- v0.36.0: dayjs migration, publish-frontend architecture.
- v0.35.0: i18n TypeScript migration, rate limiting, RLS analysis.
- v0.34.0: Global monorepo refactoring, tsdown build system.
