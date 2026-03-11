# System Patterns

> **Note**: Reusable architectural patterns and best practices. For completed work -> progress.md. For current tasks -> tasks.md.

---

## Three-Level System Fields Architecture (CRITICAL)

**Rule**: All entities use prefixed system fields for cascade soft delete and audit tracking.
**Levels**:
- `_upl_*` (Platform): Base fields for all entities — `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `deleted`, `deleted_at`, `deleted_by`.
- `_mhb_*` (Metahub): Design-Time fields — `published`, `published_at`, `unpublished_at`, `archived`, `archived_at`.
- `_app_*` (Application): Run-Time fields — `published`, `published_at`, `unpublished_at`, `archived`, `archived_at`, `deleted`, `deleted_at`, `deleted_by`.

**Cascade Delete Logic**: `_app_deleted` → `_mhb_deleted` → `_upl_deleted` (three-level cascade).
**Required**: Always pass `createdBy`/`updatedBy` or `_uplCreatedBy`/`_uplUpdatedBy` when creating/updating entities.
**Detection**: `rg "_uplCreatedBy" packages`.
**Symptoms**:
- NULL values in `_upl_created_by`/`_upl_updated_by` columns.
- Version incrementing unexpectedly (use `createQueryBuilder().update()` instead of `repository.update()`).
**Why**: Consistent audit trail and soft delete cascade across platform, metahub, and application layers.

---

## Public Routes & 401 Redirect Pattern (CRITICAL)

**Rule**: All public route constants live in `@universo/utils/routes`. API clients use `createAuthClient({ redirectOn401: 'auto' })`.
**Required**: `API_WHITELIST_URLS`, `PUBLIC_UI_ROUTES`, `isPublicRoute()`.
**Detection**: `rg "isPublicRoute" packages` (avoid local copies).
**Symptoms**:
- 401 loops after token expiry.
- Public routes redirect to /auth unexpectedly.
**Fix**:
```typescript
const apiClient = createAuthClient({ baseURL: '/api/v1', redirectOn401: 'auto' })
```
**Why**: Centralized public routes prevent drift across frontends.

## CSRF Token Lifecycle + HTTP 419 Contract (CRITICAL)

**Rule**: Backend maps `EBADCSRFTOKEN` -> HTTP 419; frontend retries exactly once.
**Required**: clear cached CSRF after login; logout is idempotent.
**Detection**: `rg "419" packages`.
**Symptoms**:
- Infinite retry loops.
- Random 403 after successful login.
**Fix**: Retry once, then surface error to user.
**Why**: Consistent contract avoids ghost failures on stale tokens.

## Backend Status Codes + PII-safe Logging (CRITICAL)

**Rule**: Preserve 400/403/404 status codes; never log PII or captcha tokens.
**Required**: log only `hasField`, `tokenLength`, or booleans.
**Detection**: `rg "console\.log\(.*token" packages`.
**Symptoms**:
- Logs contain emails/tokens.
- Status code mismatch between backend and frontend.
**Fix**: Sanitize logs; map errors without altering HTTP status.

## ENV Feature Flags + Public Config Endpoint Pattern

**Rule**: Parse env flags in `@universo/utils` and expose via dedicated endpoints.
**Required**: `/auth/auth-config` and `/auth/captcha-config`.
**Detection**: `rg "AUTH_.*ENABLED" packages`.
**Symptoms**:
- Frontend toggles diverge from backend.
**Fix**: Fetch both configs via `Promise.allSettled`.

## Source-Only Package PeerDependencies Pattern (CRITICAL)

**Rule**: Source-only packages (no dist/) must use `peerDependencies`.
**Required**: no `"main"` field in source-only packages.
**Detection**: `find packages/*/base -name "package.json" -exec rg -L '"main"' {} \; | xargs rg '"dependencies"'`.
**Symptoms**:
- Duplicate React instances.
- PNPM hoist conflicts.
**Fix**: Move runtime deps to `peerDependencies`.

## Stable Subpath Export Pattern For tsdown Packages (IMPORTANT)

**Rule**: Every package subpath export that points to `dist/...` must have its own explicit tsdown entry.

**Required**:
- If `package.json` exports `./some-subpath`, tsdown must emit stable files for that subpath (for example `dist/someSubpath.js`, `dist/someSubpath.mjs`, `dist/someSubpath.d.ts`).
- Do not rely on hash-only shared chunks to satisfy exported subpaths.
- Test-only source aliases must stay in Vitest/Vite config, not in package tsconfig files that participate in production builds.

**Symptoms**:
- Workspace package builds fail with `TS2307` for a valid exported subpath.
- Package exports point at files that do not exist in `dist/`.
- Production builds start importing source files outside `rootDir` because a temporary source alias leaked into build-time tsconfig.

**Fix**:
- Add a dedicated tsdown entry for the exported subpath.
- Keep source-resolution overrides local to test config when source-based tests need them.

**Why**: Workspace consumers resolve exported package subpaths during package builds; stable dist outputs are required for TypeScript and bundlers to agree on the same module surface.

## Request-Scoped DB Contract Pattern (CRITICAL)

**Rule**: All new or refactored DB access must use the neutral request-scoped contract (`DbExecutor` / `DbSession`) or package-level SQL-first persistence stores built on top of it.
**Required**: `getRequestDbExecutor()` / `getRequestDbSession()` for neutral paths; request-scoped SQL helpers for transactional work.
**Detection**: `rg "getRequestManager\(|getRepository\(" packages` to find legacy TypeORM-only consumers.
**Fix**: Move route/service logic into SQL-first stores or executor-backed helpers while keeping RLS/session propagation intact.
**Why**: Preserves RLS semantics without keeping TypeORM in newly migrated packages.

## Soft-Delete Parity At Persistence Boundaries (CRITICAL)

**Rule**: SQL-first stores and access guards must treat `_upl_deleted = true` or `_app_deleted = true` rows as inactive in every list/find/count/access query, not only in route-local ad hoc SQL.

**Required**:
- Put active-row predicates directly inside persistence helpers and guard lookups.
- Keep duplicate/single-required checks aligned with the same active-row predicate used by the partial indexes.
- Do not rely on route-level filtering alone for deleted-row exclusion.

**Detection**:
- `rg "FROM applications\\.(applications|connectors|connectors_publications|applications_users)" packages/applications-backend/base/src`
- Check that each read/count/access query also contains `COALESCE(..._upl_deleted, false) = false` and `COALESCE(..._app_deleted, false) = false` where applicable.

**Why**: The platform uses soft-delete flags plus active partial indexes to define live records. If stores or guards skip those predicates, deleted rows can silently reappear in access checks, duplicate-link detection, required-link constraints, and list/detail APIs.

## Metahub Active-Row Parity In SQL-First Stores (CRITICAL)

**Rule**: Metahub-domain SQL-first stores and access guards must treat rows as active only when both `_upl_deleted = false` and `_mhb_deleted = false`.

**Required**:
- Apply the dual predicate in metahub, branch, membership, publication, and publication-version list/find/count/access queries.
- Apply the same dual predicate inside soft-delete helpers and guard membership lookups, not only in route code.
- When soft-deleting metahub-domain rows, update both `_upl_*` delete fields and `_mhb_*` delete fields together.

**Detection**:
- `rg "_upl_deleted = false" packages/metahubs-backend/base/src/persistence packages/metahubs-backend/base/src/domains/shared`
- Verify that metahub-domain queries also include `_mhb_deleted = false` for the same alias or table.

**Why**: The platform schema and active partial indexes for metahub-domain tables define liveness through both delete layers. If SQL-first helpers only enforce `_upl_deleted`, deleted memberships can still grant access and deleted branches/publications can re-enter active reads.

## Cross-Schema Soft-Delete Predicate Pattern (CRITICAL)

**Rule**: Never reuse one domain's active-row predicate on tables from another schema if their lifecycle columns differ.

**Required**:
- Application tables use `_upl_deleted` plus `_app_deleted`.
- Metahub platform tables use `_upl_deleted` plus `_mhb_deleted`.
- Cross-schema joins must apply the predicate that matches each alias's owning schema, even when the query itself lives in one package.

**Detection**:
- `rg "activeRowPredicate\('p'\)|activeRowPredicate\('m'\)|_app_deleted" packages/applications-backend/base/src`
- Inspect joins from `applications.*` into `metahubs.*` and verify alias-specific predicates instead of one shared helper.

**Symptoms**:
- Runtime SQL errors such as `column p._app_deleted does not exist`.
- Connector/publication views fail only when cross-domain metadata is joined.

**Why**: Application and Metahub schemas intentionally keep different lifecycle columns. Cross-domain query helpers must preserve that contract per alias or they will emit invalid SQL despite both sides individually following soft-delete conventions.

## Managed Schema Drop Safety Pattern (CRITICAL)

**Rule**: Any helper that executes `DROP SCHEMA` for runtime application schemas must validate the schema name inside the helper itself, even if callers already performed route-level validation.

**Required**:
- Accept only managed application schemas (`app_*`) that pass the shared schema-name validator.
- Quote the identifier before interpolation into raw SQL.
- Fail before executing any SQL when validation fails.

**Why**: Route-level checks are not a sufficient safety boundary for reusable persistence helpers. The helper itself must enforce managed-schema rules so future callers cannot accidentally bypass the invariant.

## TypeORM Residue Boundary Pattern (TRANSITIONAL)

**Rule**: Treat TypeORM as removed from the live architecture. No new package, route, service, or helper may introduce `DataSource`, repositories, entities, or TypeORM-specific request helpers.
**Required**: New work must use `@universo/database`, `DbExecutor`, `DbSession`, `SqlQueryable`, and SQL-first persistence stores.
**Detection**: `rg "typeorm|DataSource|getRequestManager\(|getRepository\(" packages`.
**Symptoms**:
- TypeORM APIs leaking back into freshly migrated packages.
- New docs or helpers describing `DataSource` or repository-based flows as current practice.
**Fix**:
```typescript
const executor = getRequestDbExecutor(req, createKnexExecutor(getKnex()))
return applicationsStore.listApplications(executor, userId)
```

**Exception**: compatibility-only comments or historical progress entries may mention removed TypeORM surfaces, but they must not describe them as current architecture.

## DDL Utilities Pattern (schema-ddl)

**Rule**: Runtime schema operations must use `@universo/schema-ddl` with DI-created services.
**Required**: Instantiate via `createDDLServices(knex)` or backend wrapper `getDDLServices()`.
**Avoid**: Deprecated static wrappers (use naming utilities directly) and unsafe raw string interpolation in `knex.raw`.
**Compensation Rule**: If metadata creation commits before a runtime DDL step runs, the caller must fail loudly and compensate the fresh metadata immediately when DDL/runtime sync fails.
**Why**: Consistent DI simplifies testing and reduces SQL injection risk.

## Statement Timeout Helper Pattern (CRITICAL)

**Rule**: PostgreSQL `SET LOCAL statement_timeout` must use the shared validated helper from `@universo/utils/database`, not a bound placeholder.

**Required**:
- Use `buildSetLocalStatementTimeoutSql(timeoutMs)` for `SET LOCAL statement_timeout`.
- Keep timeout values numeric and validated before SQL generation.
- Reuse the same helper in request-scoped RLS middleware and schema-ddl locking paths.

**Avoid**:
- `knex.raw('SET LOCAL statement_timeout TO ?', [...])`
- ad hoc SQL assembly for statement timeout changes

**Why**: PostgreSQL rejected placeholder-style `SET LOCAL` in the live RLS path, so the only safe canonical implementation in this repository is the shared helper that emits a validated literal.

## Codename Retry Policy Pattern (IMPORTANT)

**Rule**: All codename copy/auto-rename flows must use shared retry constants from `codenameStyleHelper.ts`.

**Required constants**:
- `CODENAME_RETRY_MAX_ATTEMPTS` (global retry cap)
- `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT` (for concurrent conflict retries where applicable)

**Generation rule**:
- `buildCodenameAttempt(base, attempt, 'kebab-case')` appends `-<attempt>` for attempts >= 2
- `buildCodenameAttempt(base, attempt, 'pascal-case')` appends `<attempt>` for attempts >= 2
- Candidate length is capped by style limits (kebab 100, pascal 80)

**Why**: Prevents domain drift (20 vs 1000 attempts), keeps copy behavior deterministic, and reduces collision-related regressions under concurrent writes.

## Database Pool Budget + Error Logging Pattern

**Rule**: Use one shared Knex pool through `@universo/database`; log pool state on errors and under pressure.
**Required**:
- Knex: attach pool error listener and log `used/free/pending` metrics.
- Default pool max comes from `DATABASE_POOL_MAX` and currently defaults to 15.
**Why**: Prevent pool exhaustion and provide actionable diagnostics during incidents.

## DynamicEntityFormDialog Custom Field Rendering

**Rule**: Use `renderField` override to render domain-specific inputs (e.g., REF element selector) without changing default dialog behavior.
**Usage**: Return `undefined` to fall back to the built-in renderer; return a React node to override.
**Why**: Keeps the dialog generic while enabling custom widgets for special field types.

## Headless Controller Hook + Adapter Pattern (IMPORTANT)

**Rule**: CRUD dashboard views must use the shared `useCrudDashboard(adapter)` hook from `apps-template-mui`. Each deployment context (standalone dev, production runtime) provides its own `CrudDataAdapter` implementation.
**Components**:
- `CrudDataAdapter` interface (`api/types.ts`): `fetchList`, `fetchRow`, `createRow`, `updateRow`, `deleteRow`, `queryKeyPrefix`.
- `useCrudDashboard()` hook (`hooks/useCrudDashboard.ts`): headless controller returning all state + handlers (pagination, CRUD dialogs, row actions menu, schema fingerprint, React Query queries/mutations, columns, fieldConfigs, localeText).
- `createStandaloneAdapter()` (`api/adapters.ts`): adapter wrapping raw `fetch()` calls for standalone dev mode.
- `createRuntimeAdapter()` (`applications-frontend/api/runtimeAdapter.ts`): adapter wrapping auth'd `apiClient` calls for production.
- `CrudDialogs` + `RowActionsMenu` (`components/`): shared UI consuming `CrudDashboardState`.
- `CellRendererOverrides` type: per-dataType custom rendering injected via `cellRenderers` option (e.g., inline BOOLEAN checkbox toggle).
**Why**: Eliminates ~80% code duplication between DashboardApp and ApplicationRuntime while preserving full customization via adapters and cell renderer overrides.
**Detection**: `rg "useCrudDashboard" packages`.

## Optimistic Create Confirmation + Dedupe Pattern (IMPORTANT)

**Rule**: Every optimistic create/invite/copy hook must call `confirmOptimisticCreate()` in `onSuccess` when the server returns a real entity ID.

**Required**:
- Create hooks seed `optimisticId` via `applyOptimisticCreate()`.
- Success handlers replace that ID with the real server ID.
- `confirmOptimisticCreate()` must also drop the stale optimistic placeholder if the real entity already entered cache via another refetch or mutation path.

**Where implemented**:
- Shared admin/template helper: `packages/universo-template-mui/base/src/hooks/optimisticCrud.ts`
- Published runtime helper: `packages/apps-template-mui/src/hooks/optimisticCrud.ts`

**Why**: Prevents duplicate rows/cards during the refetch window and guarantees pending markers are removed as soon as the server confirms the entity.
**Detection**: `rg "applyOptimisticCreate|confirmOptimisticCreate" packages`.

## Nested Optimistic Query Scope Pattern (IMPORTANT)

**Rule**: Nested Metahub CRUD screens must mutate the exact query scope they render, not a broader root entity list.

**Required**:
- Child TABLE attribute screens use child-specific hooks/query prefixes (`childAttributes`, child element caches, child enum caches) instead of reusing root attribute hooks.
- Page-level UI code must not dispatch an optimistic mutation and then immediately call manual list invalidation for the same screen.
- Nested screen regressions should assert the actual UI contract (`mutate(...)` + immediate dialog close), not only helper-level cache behavior.
- If a copy flow can be rendered from both a broad metahub list and a hub-scoped list, optimistic create/confirm must target every currently visible matching list family, not only the broad `all*` cache.

**Symptoms**:
- A nested dialog still waits for network completion even though shared optimistic helpers exist.
- Child TABLE rows flicker, disappear, or fail to update because the wrong query family was mutated.
- Page-level `invalidateQueries()` reintroduces refetch flicker right after an optimistic update.

**Fix**:
- Create a dedicated nested hook if the screen renders a different list/query shape than the root entity list.
- Keep invalidation in the mutation lifecycle (`onSettled` / shared invalidators), not as an unconditional page-level follow-up.
- For hub-scoped copy flows, collect the broad metahub query prefix plus any matching hub query prefixes from current cache state, then apply optimistic create/confirm across all of them.

**Why**: Query-scope mismatches were the main reason nested optimistic parity remained incomplete after the shared helper rollout looked green at the top level.

## RLS Request DB Session Reuse for Admin Guards (CRITICAL)

**Rule**: Reuse request-scoped DB session from `req.dbContext`.
**Required**: pass the neutral `DbSession` into guard helpers.
**Detection**: `rg "req\.dbContext" packages`.
**Symptoms**:
- Permission checks outside RLS context.
**Fix**: fallback to a neutral executor or session derived from `@universo/database` only if the request DB session is missing.

## Template Seed Identity Pattern (IMPORTANT)

**Rule**: Widget identity in template seeds is `{layout_id, zone, widget_key, sort_order}`.
**Risk**: When a template update removes or reorders widgets, `sort_order` shifts cause the Migrator to see relocated widgets as "new" (different key) while old positions become orphans.
**Mitigation (current)**: `TemplateSeedMigrator` inherits `is_active` from existing peers with same `zone + widget_key` and auto-cleans orphan duplicates (system-created only, `_upl_created_by IS NULL`).
**Future improvement**: Consider using `{layout_id, zone, widget_key}` as the stable identity (without `sort_order`) to make template reordering transparent.
**Detection**: Duplicate widgets in same zone — `SELECT zone, widget_key, count(*) FROM _mhb_widgets WHERE _mhb_deleted = false GROUP BY zone, widget_key HAVING count(*) > 1`.

## Structured Blocker Pattern (IMPORTANT)

**Rule**: Migration/cleanup blockers must use `StructuredBlocker` type from `@universo/types` instead of plain strings.
**Interface**: `{ code: string, params: Record<string, string>, message: string }`
**Backend**: Services (`TemplateSeedCleanupService`, `metahubMigrationsRoutes`) create blockers with code + params + fallback message.
**Frontend**: `MetahubMigrationGuard.tsx` renders blockers using `t(\`migrations.blockers.\${blocker.code}\`, blocker.params)` with `<ul>/<li>` markup.
**i18n**: 15 blocker keys in EN/RU locales under `migrations.blockers.*` namespace.
**Detection**: `rg "StructuredBlocker" packages`.
**Why**: Type-safe, i18n-ready error reporting. Backend provides structured context, frontend localizes using standard i18n infrastructure.

---

## i18n Architecture (CRITICAL)

**Rule**: Core namespaces in `@universo/i18n`; feature packages use `registerNamespace()`.
**Required**: feature registration called before app render.
**Detection**: `rg "i18next\.use" packages` (antipattern).
**Symptoms**:
- Missing translations after lazy load.
**Fix**: register namespaces in entrypoints and consolidate bundles.

## Canonical Types Pattern (CRITICAL)

**Rule**: Shared types live in `@universo/types` and are re-exported downstream.
**Required**: pagination/filter types in `@universo/types`, UI packages re-export only.
**Detection**: `rg "PaginationMeta|FilterType" packages/*/src/types`.
**Symptoms**:
- Divergent shapes across frontends.
**Fix**: replace local types with `@universo/types` imports.

## Universal List Pattern (CRITICAL)

**Rule**: Entity lists use `usePaginated` + `useDebouncedSearch` + card/table toggle.
**Required**: ViewHeader, ItemCard, FlowListTable, PaginationControls, localStorage persistence.
**Detection**: `rg "usePaginated" packages`.
**Symptoms**:
- Inconsistent pagination behavior across modules.
**Fix**: adopt shared list components from template-mui.

## Dual Sidebar Menu Config (IMPORTANT)

**Rule**: There are TWO sidebar menu configurations that must be kept in sync:
1. **`metahubDashboard.ts`** (`packages/metahubs-frontend/base/src/menu-items/`) — Legacy config used by `flowise-template-mui/MenuList`
2. **`menuConfigs.ts`** (`packages/universo-template-mui/base/src/navigation/`) — **PRODUCTION config** consumed by `MenuContent.tsx` via `getMetahubMenuItems()`.
**When modifying sidebar items**: Always update BOTH files. The production app uses `menuConfigs.ts`.

## React StrictMode Pattern (CRITICAL)

**Rule**: StrictMode enabled only in DEV builds.
**Fix**:
```tsx
const StrictModeWrapper = import.meta.env.DEV ? React.StrictMode : React.Fragment
```
**Why**: Prevent double-render issues in production.

## Rate Limiting Pattern (CRITICAL)

**Rule**: Redis-based rate limiting for all public API endpoints.
**Required**: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`.
**Detection**: `rg "rateLimit" packages/*/src`.
**Symptoms**:
- 429 missing under load.
**Fix**: apply middleware per router.

## Testing Environment Pattern (CRITICAL)

**Rule**: Vitest + Testing Library; Playwright for E2E. No Jest.
**Required**: use shared test utils packages.
**Detection**: `rg "jest" packages/*/package.json`.
**Fix**: migrate Jest tests to Vitest equivalents.

## Service Factory + NodeProvider Pattern (CRITICAL)

**Rule**: Services are factories to inject neutral dependencies (`DbExecutor`, `DbSession`, telemetry, config).
**Fix**:
```typescript
export const createXService = ({ getDbExecutor, telemetryProvider }) => ({ ... })
```

## Runtime Migration Pattern (CRITICAL)

**Rule**: All schema changes must be recorded in `_sys_migrations` table within Application schema.
**Required**: Use `MigrationManager.recordMigration()` after applying DDL changes via `SchemaMigrator`.
**Migration Format**: `YYYYMMDD_HHMMSS_<description>` (e.g., `20260117_143000_add_products_table`).
**Components**:
- `MigrationManager`: CRUD for migrations, rollback analysis.
- `SchemaMigrator.applyAllChanges({ recordMigration: true, description })`: records migration with snapshot.
**Rollback Policy**: Block rollback if path contains destructive changes (DROP_TABLE, DROP_COLUMN, destructive ALTER_COLUMN).
**Detection**: `rg "recordMigration" packages`.
**Symptoms**:
- Schema changes not tracked.
- Rollback fails silently.
**Fix**: Always pass `recordMigration: true` when applying schema changes that should be reversible.

## Applications Runtime Update Targeting (MVP)

**Rule**: Runtime cell updates should include `catalogId` when the application has multiple catalogs.
**Why**: Backend defaults to the first catalog by codename; without `catalogId`, updates can target the wrong table and return 404 (row not found).

## TanStack Query Cache Correctness + v5 Patterns (CRITICAL)

**Rule**: Query key factories must be used for invalidation.
**Required**: `lists()` and `detail(id)` keys; invalidate aggregates explicitly.
**Detection**: `rg "invalidateQueries\(" packages`.
**Fix**: call `invalidateQueries(metaversesQueryKeys.lists())` after mutations.

## Focus-Refetch for Open Dialog Data (No Polling)

**Rule**: `useQuery` with `enabled: open` + `refetchOnWindowFocus: 'always'`.
**Why**: ensures dialog data fresh without polling.

## Reusable Compact List Table Pattern (Dialogs)

**Rule**: Use `CompactListTable` in modal dialogs with sticky header + bounded scroll.
**Required**: `renderRowAction`, `actionColumnWidth` for action column.
**Detection**: `rg "<Table" packages/*/dialogs`.

## Applications Config/Data Separation Pattern

**Rule**: Metahubs store configuration; Applications store data (PG schemas).
**Required**: SchemaGenerator + SchemaMigrator + shared Knex runtime from `@universo/database`.
**Naming**:
- Schema: `app_<uuid32>`
- Table: `cat_<uuid32>`
- Column: `attr_<uuid32>`
- Child (TABLE type): `tbl_<uuid32>` (parent-independent, generated by `generateChildTableName(attrId)`)

## Attribute Type Architecture Pattern

**Rule**: `_mhb_attributes.data_type` stores LOGICAL type (enum); `validation_rules` stores type-specific settings.
**Why**: Separation of concern, flexibility, backward compatibility.
**Components**:
- **@universo/types**: `AttributeDataType` enum (STRING, NUMBER, BOOLEAN, DATE, REF, JSON), `AttributeValidationRules` interface.
- **@universo/schema-ddl**: `SchemaGenerator.mapDataType(dataType, rules)` → PostgreSQL type.
- **@universo/types**: `getPhysicalDataType(dataType, rules)` → `PhysicalTypeInfo` for UI display.

**Type Mappings**:
| Logical Type | Settings | PostgreSQL Type |
|--------------|----------|-----------------|
| STRING | default | TEXT |
| STRING | maxLength: n | VARCHAR(n) |
| STRING | versioned/localized | JSONB |
| NUMBER | precision, scale | NUMERIC(p,s) |
| DATE | dateComposition: 'date' | DATE |
| DATE | dateComposition: 'time' | TIME |
| DATE | dateComposition: 'datetime' | TIMESTAMPTZ |
| BOOLEAN | - | BOOLEAN |
| REF | - | UUID |
| JSON | - | JSONB |

**UI**: Tooltip in AttributeList shows computed PostgreSQL type; Alert in form displays "PostgreSQL type: X".

## Pagination Pattern

**Backend**:
- Zod schema: `limit`, `offset`, `sortBy`, `sortOrder`.
- Single query with `getManyAndCount()`.
**Frontend**:
- `usePaginated<T, SortFields>` hook.
- `PaginationControls` with `rowsPerPageOptions`.

## Error Handling Pattern

**Backend**: central handler, `ValidationError`, `NotFoundError`, `ForbiddenError`.
**Frontend**: error boundaries + toasts; Sentry for monitoring.

## Env Configuration Pattern

**Rule**: Use `@universo/utils/env` for type-safe env access.
**Fix**:
```typescript
export const isAdminPanelEnabled = () => process.env.ADMIN_PANEL_ENABLED !== 'false'
```

## Migration Pattern

**Rule**: Single consolidated migration per package; idempotent `IF NOT EXISTS`.
**Required**: RLS policies in the same migration.
**Avoid**: destructive `down()`.

## VLC (Versioned Localized Content) Utilities Pattern

**Rule**: Shared sanitize/build helpers in `@universo/utils/vlc`.
**Required**: `sanitizeLocalizedInput`, `buildLocalizedContent`, `normalizeCodename`.
**Note**: backend uses `normalizeCodename()`; frontend uses `slugifyCodename()`.

## Build System Patterns

**tsdown**: dual output (CJS + ESM), path aliases `@/*`, type declarations.
**pnpm**: run from root, `--filter <package>` for single build; full `pnpm build` for cross-deps.
**turbo**: cache + parallel builds.

## Naming Conventions

**Files**: `PascalCase` components, `camelCase` hooks/utils, `kebab-case` folders/files.
**Database**: `snake_case` tables/columns, `PascalCase` entities.
**i18n**: dot notation (`auth.login.button`) with namespace prefixes.

## RBAC + CASL Authorization Pattern (CRITICAL)

**Rule**: Hybrid RBAC (DB) + CASL (app) for isomorphic permissions.
**Required**: `module='*'` + `action='*'` maps to `subject='all'`, `action='manage'`.
**Detection**: `rg "ensureGlobalAccess" packages`.

## Admin Route Guards Pattern

**Rule**: Use DB-driven permission checks, not hardcoded roles.
**Fix**: `ensureGlobalAccess('roles', 'delete')` for route protection.

## Scoped-API Pattern for RLS

**Rule**: Use parent-scoped endpoints to carry RLS context (e.g., `/metaverse/:id/entities`).
**Why**: ensures correct tenant scoping for permissions and data visibility.

## Public Execution Share Contract Pattern

**Rule**:
- Frontend route: `/execution/:id` (minimal layout)
- Backend: `GET /public-executions/:id`
- Client: `getPublicExecutionById(id)` uses public endpoint

## Route Protection Guards Pattern

**Rule**: Protected routes redirect unauthorized users; no error pages exposing resource structure.
**Guards**:
- `AuthGuard` -> `/auth`
- `AdminGuard` -> `/`
- `ResourceGuard` -> `/`

## ReactFlow AgentFlow Node Config Dialog Pattern

**Rule**: Open node dialogs from canvas events (`onNodeDoubleClick`), not node DOM.
**Why**: avoids focus issues and event propagation bugs.

## Public Routes Consistency Pattern

**Rule**: Keep public UI routes and API whitelist in sync across packages.
**Detection**: `rg "PUBLIC_UI_ROUTES" packages`.

## Known Antipatterns to Avoid

- Direct Supabase client usage (violates RLS pattern)
- Hardcoded role checks (use database permissions)
- `dependencies` in source-only packages (use `peerDependencies`)
- Raw SQL in routes or service layers (use dedicated SQL-first persistence helpers)
- `i18next.use()` in packages (use `registerNamespace()`)
- StrictMode in production builds
- Client-side pagination for large datasets
- Duplicate state management (prefer TanStack Query cache)


## Operational Checklists

### Public Routes & 401 Redirect
- Verify API_WHITELIST_URLS and PUBLIC_UI_ROUTES are updated together.
- Confirm API clients use redirectOn401: 'auto'.
- Add new public paths to both route lists.

### CSRF 419 Contract
- Ensure EBADCSRFTOKEN maps to HTTP 419 in backend.
- Confirm frontend retries only once.
- Clear cached CSRF token after login.

### Status Codes + PII-safe Logging
- Preserve 400/403/404 without remapping.
- Strip PII and captcha tokens from logs.
- Log only boolean or length indicators.

### ENV Feature Flags + Public Config
- Keep auth-config and captcha-config endpoints separate.
- Parse flags in @universo/utils.
- Fetch configs via Promise.allSettled.

### PeerDependencies for Source-only Packages
- No "main" field in source-only packages.
- Runtime deps belong in peerDependencies.
- Run detection command before release.

### RLS Integration
- Enforce repository access with user context.
- Avoid direct Supabase client usage.
- Validate RLS session context on requests.

### SQL-First Persistence
- Put database reads and writes into dedicated persistence/store modules.
- Use `DbExecutor`, `DbSession`, or `SqlQueryable` contracts instead of repositories.
- Keep RLS consistency by threading the request-scoped executor/session through the store boundary.

### Request DB Session Reuse
- Use `req.dbContext.session` for guards and other raw-query access paths.
- Fallback to a neutral executor built from `createKnexExecutor(getKnex())` only if needed.
- Validate request-session cleanup per request.

### i18n Architecture
- Register namespaces before app render.
- Avoid i18next.use() in packages.
- Consolidate bundles after new keys.

### Canonical Types
- Centralize pagination/filter types in @universo/types.
- Replace local duplicates with imports.
- Re-export only UI-specific types in template packages.

### Universal List Pattern
- Use usePaginated + useDebouncedSearch.
- Support card/table toggle with ViewHeader.
- Persist view preference via storage keys.

### React StrictMode
- StrictMode only in DEV builds.
- Keep wrapper pattern in app entry.
- Validate production build behavior.

### Rate Limiting
- Enable Redis-backed middleware for public routes.
- Keep env config consistent across services.
- Verify 429 responses under load tests.

### Testing Environment
- Prefer Vitest + Testing Library.
- Reserve Playwright for E2E.
- Remove Jest configs when migrating.

### Service Factory Pattern
- Build services via factories with injected deps.
- Avoid singleton side effects.
- Mock dependencies in tests.

### TanStack Query Cache
- Use query key factories for invalidation.
- Invalidate lists after mutations.
- Avoid staleTime workarounds.

### Compact List Table
- Use CompactListTable in dialogs.
- Keep sticky headers and scroll bounds.
- Provide renderRowAction for actions.

### Applications Config/Data Separation
- Keep config in Metahubs, data in Applications schema.
- Use SchemaGenerator + SchemaMigrator.
- Ensure app_*/cat_* naming convention.

### Pagination
- Enforce limit/offset defaults in backend.
- Align pagination shape to { items, pagination }.
- Use PaginationControls in UI.

### Error Handling
- Use centralized backend error handlers.
- Show user-friendly toasts in frontend.
- Capture unexpected errors via Sentry.

### Env Configuration
- Access env via @universo/utils/env helpers.
- Avoid string comparisons in feature checks.
- Keep defaults explicit.

### Migration Discipline
- One consolidated migration per package.
- Avoid destructive down() migrations.
- Bundle RLS policies with schema changes.

### VLC Utilities
- Use sanitizeLocalizedInput/buildLocalizedContent.
- Normalize codename in backend only.
- Keep frontend slugify for user-facing input.

### Codename Validation
- Two styles: `kebab-case` (English-only lowercase) and `pascal-case` (PascalCase).
- `pascal-case` supports two alphabets: `en` (English-only) and `en-ru` (English + Russian).
- Style + alphabet configured per metahub via `general.codenameStyle` and `general.codenameAlphabet` settings.
- Use `isValidCodenameForStyle(value, style, alphabet)` and `normalizeCodenameForStyle(value, style, alphabet)`.
- Backend reads both settings via `getCodenameStyle()`/`getCodenameAlphabet()` or batch `extractCodenameStyle()`/`extractCodenameAlphabet()`.

### RBAC + CASL
- Map module='*' + action='*' to manage/all.
- Use ensureGlobalAccess for checks.
- Avoid hardcoded role logic.

### Route Guards
- Use AuthGuard/AdminGuard/ResourceGuard consistently.
- Redirect unauthorized users (no info leaks).
- Validate guard coverage in routes.

### Public Execution Share
- Keep /execution/:id and /public-executions/:id aligned.
- Use public client for shared routes.
- Verify minimal layout for public pages.

### ReactFlow Node Dialogs
- Open config dialogs on onNodeDoubleClick.
- Avoid direct DOM event usage.
- Validate focus behavior after close.

### Public Routes Consistency
- Sync UI and API public route lists.
- Update utils routes before adding new public pages.
- Add tests for new public paths.

### Metahubs UI: Display Attribute Locking
- When a catalog has a single attribute, the Display Attribute switch must be auto-enabled and locked (create + edit).
- Action menu should expose explicit set/clear actions (no dynamic icon/label callbacks) to avoid undefined context crashes.

---

## Metahub Template/Versioning System

**Architecture**: Two-layer separation of concerns for metahub schema initialization.
- **Structure Version** (integer, code-owned): DDL for system tables (`_mhb_layouts`, `_mhb_zone_widgets`, etc.) in `structureVersions.ts`. Registry pattern: `getStructureVersion(n).init(knex, schemaName)`.
- **Template Version** (SemVer, JSON-driven): Seed data (layouts, widgets, settings, entities, elements) in typed TS files under `templates/data/`. Applied by `TemplateSeedExecutor.apply(knex, schemaName, manifest)`.

**Key Patterns**:
- Template files use **codenames** for cross-references (not UUIDs). UUIDs generated at seed time with `generateUuidV7()`.
- VLC entries in seed files use a `vlc()` helper with epoch-zero timestamps for `createdAt`/`updatedAt`.
- `TemplateSeeder` is idempotent: SHA-256 hash of manifest (via `json-stable-stringify`) compared before upsert.
- Template entities are platform-level only (`_upl_*` fields, no `_mhb_*`).
- `MetahubSchemaService.initSystemTables()` delegates to structure version init + template seed executor.
- Template manifest is loaded from DB (`TemplateVersion.manifestJson`) when `metahub.templateVersionId` exists, falls back to built-in default.

**DB Tables**: `metahubs.templates` (codename, VLC name/desc, active_version_id FK → templates_versions, definition_type), `metahubs.templates_versions` (JSONB manifest, SHA-256 hash, version_number, version_label).

**Last Updated**: 2026-02-09

---

## Application-Definition Model

**Architecture**: Metahubs are treated as one specialization of a generic "application definition" pattern. The unified definition model supports future non-Metahub definitions (e.g., custom app templates).

**Key Concepts**:
- **DefinitionArtifact** (`@universo/migrations-catalog`): A single schema definition unit (table, index, RLS policy, etc.) with `kind`, `name`, `schemaQualifiedName`, `sql`, `checksum`, `dependencies[]`.
- **Definition Registry** (`upl_migrations.definition_registry`): Central catalog of all definition artifacts. Each entry has a `logical_key` (schemaQualifiedName::kind) and `active_revision_id`.
- **Definition Revisions** (`upl_migrations.definition_revisions`): Immutable revision history for each definition. Each revision stores the full `payload` (DefinitionArtifact) and a `checksum`.
- **Definition Drafts** (`upl_migrations.definition_drafts`): Draft revisions for future editor UI support. Same schema as revisions but with `status: draft|review|published` and `author_id`.
- **Template definition_type** (`metahubs.templates.definition_type`): Distinguishes `metahub_template`, `application_template`, or `custom`. Default: `metahub_template` for backward compatibility.

**Patterns**:
- `registerDefinition(trx, artifact)` is idempotent — returns existing record if checksum matches, creates new revision if different.
- `exportDefinitions()` + `importDefinitions()` provide round-trip support for file-based storage.
- Definition exports are tracked in `upl_migrations.definition_exports` for provenance.
- Template system remains backward-compatible: all existing templates auto-receive `definition_type = 'metahub_template'` via column default.

**Dependency Direction**: `@universo/migrations-catalog` → `@universo/migrations-core` (core types + read functions). Never reverse.

**Last Updated**: 2026-03-09
