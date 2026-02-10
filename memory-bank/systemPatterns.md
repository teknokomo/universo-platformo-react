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

## RLS Integration Pattern (CRITICAL)

**Rule**: All DB access via TypeORM Repository with user context for RLS.
**Required**: `getDataSource().getRepository(Entity)` and RLS session context.
**Detection**: `rg "supabaseClient" packages` (antipattern).
**Fix**: Use repositories + request-scoped context.
**Why**: Prevents bypassing RLS policies.

## TypeORM Repository Pattern (CRITICAL)

**Rule**: Do not call raw SQL in services; use repositories.
**Required**: `getDataSource()` and per-entity repository.
**Detection**: `rg "\.query\(" packages/*/src`.
**Symptoms**:
- RLS bypass.
- Untracked schema drift.
**Fix**:
```typescript
const repo = getDataSource().getRepository(MyEntity)
return repo.find({ where: { ... } })
```

**Exception (cross-schema joins)**: When TypeORM cannot model cross-schema relations (e.g., connectors ↔ metahubs), use raw SQL **only** via the request-scoped manager: `getRequestManager(req, ds).query(...)`. This preserves RLS context.

## DDL Utilities Pattern (schema-ddl)

**Rule**: Runtime schema operations must use `@universo/schema-ddl` with DI-created services.
**Required**: Instantiate via `createDDLServices(knex)` or backend wrapper `getDDLServices()`.
**Avoid**: Deprecated static wrappers (use naming utilities directly) and raw string interpolation in `knex.raw`.
**Why**: Consistent DI simplifies testing and reduces SQL injection risk.

## Database Pool Budget + Error Logging Pattern

**Rule**: Keep total pooled connections within Supabase Pool Size; log pool state on errors.
**Current Split**: Knex pool max = 8, TypeORM pool max = 7 (total 15).
**Required**:
- Knex: attach pool error listener and log `used/free/pending` metrics.
- TypeORM: `poolErrorHandler` logs `total/idle/waiting` metrics.
**Why**: Prevent pool exhaustion and provide actionable diagnostics during incidents.

## DynamicEntityFormDialog Custom Field Rendering

**Rule**: Use `renderField` override to render domain-specific inputs (e.g., REF element selector) without changing default dialog behavior.
**Usage**: Return `undefined` to fall back to the built-in renderer; return a React node to override.
**Why**: Keeps the dialog generic while enabling custom widgets for special field types.

## RLS QueryRunner Reuse for Admin Guards (CRITICAL)

**Rule**: Reuse request-scoped QueryRunner from `req.dbContext`.
**Required**: pass QueryRunner into guard helpers.
**Detection**: `rg "req\.dbContext" packages`.
**Symptoms**:
- Permission checks outside RLS context.
**Fix**: fallback to `getDataSource().query()` only if QueryRunner missing.

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

**Rule**: Services are factories to inject dependencies (DataSource, telemetry, config).
**Fix**:
```typescript
export const createXService = ({ getDataSource, telemetryProvider }) => ({ ... })
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
**Required**: SchemaGenerator + SchemaMigrator + KnexClient.
**Naming**:
- Schema: `app_<uuid32>`
- Table: `cat_<uuid32>`
- Column: `attr_<uuid32>`
- Tabular: `{parent}_tp_<uuid32>`

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
- Raw SQL in services (use repositories)
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

### TypeORM Repository
- Replace raw SQL in services with repository calls.
- Use getDataSource().getRepository(Entity).
- Keep RLS consistency across repositories.

### QueryRunner Reuse
- Use req.dbContext QueryRunner for guards.
- Fallback to getDataSource().query() only if needed.
- Validate QueryRunner cleanup per request.

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

**DB Tables**: `metahubs.templates` (codename, VLC name/desc, active_version_id FK → templates_versions), `metahubs.templates_versions` (JSONB manifest, SHA-256 hash, version_number, version_label).

**Last Updated**: 2026-02-09
