# Technical Context

## 🔄 Custom Modifications to Preserve

### Authentication Architecture - **COMPLETED MIGRATION**

**Previous**: Multi-user Supabase JWT authentication
**Current**: Passport.js + Supabase hybrid authentication with session management
**Integration Point**: Bridge between Supabase JWT ↔ Passport.js successfully implemented
**Files Affected**: All middleware, controllers, UI authentication components migrated

### Access Control Evolution (Phase 2 - Request-Scoped DB Enforcement) - **COMPLETED**
**Current Model**: Application-level access control with request-scoped DB middleware.  
**Key Components**: WorkspaceAccessService (centralized membership validation), strict TypeScript role enum (`owner`, `admin`, `editor`, `member`), dedicated `uniks` schema with RLS policies, and the neutral `DbExecutor` / `DbSession` request contracts used across the SQL-first backend.

**Pattern**:
```typescript
const userId = await ensureUnikMembershipResponse(req, res, unikId, {
  roles: ['editor', 'admin', 'owner']
})
if (!userId) return
```

**Security Layers**: (1) request-scoped membership validation (primary), (2) RLS policies (fallback), (3) Request cache.  
**CRITICAL**: All Unik-scoped routes MUST use `ensureUnikMembershipResponse` or `requireUnikRole` middleware.

#### 2. Uniks (Workspace) System
-   **Purpose**: Multi-tenant workspace isolation (enterprise feature simulation)
-   **Implementation**: Schema-isolated entities with request-scoped DB access control
-   **Database Schema**: 
    - `uniks.uniks` - Workspace entities
    - `uniks.uniks_users` - Membership relationships with roles
    - Cross-references from dependent modules (finance, spaces, resources)
-   **Access Model**: Application-level enforcement via `WorkspaceAccessService`
-   **UI Components**: Custom workspace selection and management pages
-   **Risk**: High - Core business logic that must be preserved
-   **Role Hierarchy**: `owner` (4) > `admin` (3) > `editor` (2) > `member` (1)
-   **Key Operations**:
    - Create workspace → Auto-assign owner role
    - Invite members → Owner/admin privilege required  
    - Update/delete → Role-based restrictions
    - Data access → Membership validation required

#### 3. Internationalization (i18n)

-   **Languages**: English (base) + Russian (full translation)
-   **Implementation**: Complete UI text extraction and translation; feature packages register their own namespaces via `registerNamespace`.
-   **Files**: `packages/universo-core-frontend/base/src/i18n/locales/en.json` & `ru.json`
-   **Gotcha**: Some feature packages consolidate and **flatten** nested translation bundles into a single namespace; component translation keys must match the registered shape (inspect the package `src/i18n/index.ts`). Also, when an app exports a consolidated namespace bundle, every new top-level block (e.g., `applications`, `actions`) must be included in the merge, or the UI will render raw i18n keys.

#### 3.1 Metahub Identifier Field
-   **Metahub table**: `metahubs.metahubs` uses `slug` (not `codename`) as the URL-friendly identifier.
-   **Implication**: Cross-schema joins must select `slug` and map it to frontend `codename` when needed.

#### 3.2 Metahub Hybrid Schema Architecture (Phase 7)
-   **Design-Time Data**: Stored in central `metahubs` schema (tables: `metahubs`, `catalogs`, `attributes`).
-   **Run-Time Data**: Stored in isolated `mhb_<UUID>` schemas unique to each Metahub.
-   **Synchronization**: Changes to Design-Time metadata (e.g., adding a catalog) trigger DDL operations in the corresponding `mhb_<UUID>` schema via `MetahubSchemaService`.
-   **Benefits**: Isolation of user data, scalability, and simplified access control for run-time records.

#### 3.2.1 Metahub Attribute Defaults
-   **NUMBER defaults**: `getDefaultValidationRules()` now uses `scale = 0` (precision 10). This keeps NUMERIC defaults as integers unless explicitly configured.

#### 3.2.2 Codename Validation & Retry Reliability
-   **Shared validation source**: Codename normalization/validation lives in `@universo/utils/validation/codename` and is consumed by frontend + backend.
-   **Shared retry policy**: Backend codename copy/rename flows use centralized constants in `domains/shared/codenameStyleHelper.ts` (`CODENAME_RETRY_MAX_ATTEMPTS`, `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT`).
-   **Style-safe retry generation**: `buildCodenameAttempt()` now preserves style correctness for retry suffixes (`-N` for kebab-case, `N` for pascal-case) while respecting max-length limits.
-   **Test coverage**:
  - `packages/universo-utils/base/src/validation/__tests__/codename.test.ts`
  - `packages/metahubs-backend/base/src/tests/services/codenameStyleHelper.test.ts`

#### 3.2.3 Platform System Attributes Governance
-   **Global policy source**: platform catalog system-attribute behavior is resolved from `admin.cfg_settings` under the `metahubs` category, not from per-metahub settings alone.
-   **Admin keys**: `platformSystemAttributesConfigurable`, `platformSystemAttributesRequired`, `platformSystemAttributesIgnoreMetahubSettings`.
-   **Backend seam**: `packages/metahubs-backend/base/src/domains/shared/platformSystemAttributesPolicy.ts` reads the admin policy, decides which `_upl_*` rows must be seeded, controls whether those rows should be exposed in catalog System responses, and blocks forbidden `_upl_*` toggle writes through `MetahubAttributesService.update(...)`.
-   **Template seam**: builtin template executor/migrator flows resolve the same policy through `readPlatformSystemAttributesPolicyWithKnex(...)` and pass it into `ensureCatalogSystemAttributesSeed(...)`; template repair must not own a second policy interpretation.
-   **Frontend seam**: metahubs UI does not call the admin settings API directly for this feature; instead it relies on `attributes` list response `meta` plus dedicated `/system` routes in `MainRoutesMUI.tsx` and the catalog views.
-   **Ordering behavior**: canonical system-row order is preserved by disabling optimistic `moveToFront` behavior for attribute enable/disable mutations.

#### 3.3 Runtime DDL Utilities (schema-ddl)
-   **Package**: `@universo/schema-ddl` provides shared runtime DDL logic (schema generation, migrations, snapshots).
-   **Pattern**: DI-only (`createDDLServices(knex)`), no static wrapper methods; naming utilities are imported directly.
-   **Optional global catalog flag**: `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` now controls whether runtime/platform flows use the full catalog lifecycle or only local canonical history plus the minimal platform kernel.
-   **Managed schema naming**: canonical managed schema name generation/validation now comes from `@universo/migrations-core` (`buildManagedDynamicSchemaName`, `isManagedDynamicSchemaName`) and is reused by schema-ddl plus touched metahub/publication runtime paths.
-   **Managed owner validation**: managed schema owner ids must now be canonical UUID or 32-character lowercase hex only; malformed values are rejected instead of being normalized by stripping characters.
-   **Kernel-only platform history**: disabled catalog mode uses `PlatformMigrationKernelCatalog` so `upl_migrations.migration_runs` remains available for platform prelude/post-schema history without bootstrapping the definition registry stack.
-   **Runtime mirror contract**: `mirrorToGlobalCatalog(...)` can now return `null` when the flag is disabled; runtime metadata builders must tolerate missing `globalRunId` in that mode.
-   **Fixed baseline recording**: `SchemaGenerator.generateFullSchema(...)` now accepts an explicit `migrationName`, which `systemAppSchemaCompiler` uses to record deterministic fixed-system baseline rows and backfill missing `_app_migrations` baselines on repeated startup.
-   **Safety**: `knex.raw` calls should use parameterized queries by default, but PostgreSQL `SET LOCAL statement_timeout` is the explicit exception here and must go through `buildSetLocalStatementTimeoutSql()` from `@universo/utils/database`.
-   **Runtime sync ownership seam**: `@universo/applications-backend` owns application runtime sync/diff routes and the adapter that builds application sync context; `@universo/metahubs-backend` exposes only `loadPublishedPublicationRuntimeSource(...)`, and `@universo/core-backend` injects that source into the applications-owned adapter.
-   **Applications fixed-schema bootstrap**: the active applications system-app manifest now bootstraps only the canonical `CreateApplicationsSchema1800000000000` migration; fresh databases do not rely on a legacy table-rename reconciliation step.
-   **Configurable platform runtime columns**: runtime business tables now derive configurable `_upl_archived*` / `_upl_deleted*` presence from `config.systemFields.fields` via shared `@universo/utils` helpers; runtime CRUD/sync SQL must consume the same helper instead of assuming `_upl_deleted` always exists.
-   **Central install metadata seam**: application release/install state now extends `applications.cat_applications` with `installed_release_metadata` instead of introducing a parallel release metadata store.
-   **Application release bundle API**: `@universo/applications-backend` now exposes publication-backed release-bundle export and bundle-apply routes that reuse the existing schema sync engine and persist release state through the same central sync-state contract.
-   **Canonical bundle snapshot hash**: `application_release_bundle` now recomputes a canonical embedded snapshot hash per `sourceKind` (`publication` normalized snapshot contract, `application` runtime checksum contract) and rejects any bundle whose manifest hash does not match the embedded snapshot state.
-   **Manifest validation parity**: fixed-system-app string validation rules must stay within the backing `VARCHAR(N)` contract; shared migrations-platform regressions now enforce that rule across registered definitions.
-   **Architecture docs location**: the converged fixed-system-app model is now documented in `docs/en/architecture/system-app-convergence.md` and `docs/ru/architecture/system-app-convergence.md` in addition to memory-bank planning files.
-   **Repeated-start optimization**: `@universo/migrations-platform` now avoids replaying unchanged fixed metadata synchronization and unchanged catalog registry sync on clean startup by using a live metadata fingerprint check plus a bulk registry/export preflight that also requires published lifecycle provenance on the active revision.
-   **Doctor export health**: `@universo/migrations-platform` doctor checks now treat any export row on the active published revision as healthy; explicit export-target matching remains an operational sync/export concern, not a doctor constraint.
-   **Bundle export lifecycle parity**: bundle-style catalog exports now also persist definition export rows for the active published revisions they contain.
-   **Bootstrap phase discipline**: platform migrations that depend on generated fixed tables now live in `post_schema_generation`; the latest verified examples are `OptimizeRlsPolicies1800000000200` and metahubs builtin-template seeding.
-   **Definition lifecycle execution**: `@universo/migrations-catalog` now routes active `importDefinitions()` calls through draft/review/publish helpers and keeps lifecycle provenance merged on unchanged revisions, so file/bundle imports and platform sync share the same approval-oriented lifecycle contract.
-   **Definition drift detection**: platform/catalog no-op detection now compares stable artifact payload signatures, not only SQL checksum parity, so dependency-only changes re-run the canonical import/export path.

#### 4. UPDL Nodes & Multi-Technology Export

-   **Location**: `packages/` directory (custom application layer)
-   **Purpose**: Universal high-level logic nodes for AR.js and PlayCanvas scene generation
-   **Integration**: Custom nodes within the inherited canvas system
-   **Components**: Publisher UI, Builder logic, API integration
-   **Templates**: Quiz (AR.js), MMOOMM (PlayCanvas) with template-first architecture

#### 5. PlayCanvas MMOOMM Template (Recent Stabilization)

-   **Purpose**: Space MMO foundation with ship movement and physics
-   **Key Features**: WASD+QZ controls, physics fallback system, optimized logging
-   **Technical Implementation**:
    -   Physics body initialization with direct movement fallback
    -   Global flags to prevent console spam during gameplay
    -   WebSocket connection optimization for local development
    -   Transparent rigidbody → direct position movement transition
-   **Status**: Production-ready with clean console output and reliable ship movement
-   **Risk**: Medium - Isolated from core shell changes but needs verification

## Platform Foundation

**Legacy upstream shell 2.2.8** - Enhanced platform with ASSISTANT support (upgraded 2025-07-01)
**Supabase Integration** - Multi-user functionality with Postgres-only database support

### Database Pooling (Supabase Tier-Scalable)

**Target**: Supabase Nano tier by default (Pool Size 15, PG max_connections 60).

**Pool model** (as of 2026-03-10):
- Single shared Knex pool owned by `@universo/database`
- Default pool max = `DATABASE_POOL_MAX` or 15
- Pool-level execution uses `createKnexExecutor(getKnex())`
- Request-scoped RLS execution uses pinned connections wrapped by `createRlsExecutor(...)`

**Tier-scaling guide**:
| Tier    | Pool Size | Default Knex Max | Headroom |
|---------|-----------|------------------|----------|
| Nano    | 15        | 15               | 0-5      |
| Micro   | 15        | 15               | 0-5      |
| Small   | 15        | 15               | 0-5      |
| Medium  | 50        | tune via env     | 35+      |
| Large+  | 100       | tune via env     | 85+      |

**Env overrides**: `DATABASE_POOL_MAX`, `DATABASE_KNEX_POOL_DEBUG`.

**Tracked env policy**: committed `.env` files in the repository must stay placeholder-only; live Supabase, session, encryption, and object-storage secrets belong outside version control.

**Advisory lock safety**: Schema DDL uses `pg_try_advisory_lock` (session-level) which pins a raw TCP connection. Knex pool must always have ≥4 connections to avoid starvation when 2 advisory locks are held and `inspectSchemaState` / widget resolution queries run.

**Pooler mode detection**:
- Port 6543 = Supavisor transaction mode (shorter timeouts, prepared statement warnings)
- Port 5432 = Direct connection or session mode
- KnexClient emits a warning and switches to shorter pool timeouts when port 6543 is detected

**Observability**:
- Pool status logged every 10s when utilization >70% or waiting connections exist
- Pool error logs include `used/idle/waiting` metrics
- Knex logs `acquireRequest/acquireSuccess/acquireFail/release` events under pressure

**Rate limiting** (increased 2026-02-03):
- Read: 600 requests / 15 minutes (was 100, then 300)
- Write: 240 requests / 15 minutes (was 60, then 120)
- Per-IP by default; consider Redis + user-based keys for multi-user NAT scenarios

### Authentication Architecture
**Current**: Passport.js session auth (Express) integrated with Supabase identity; clients use cookie/session + CSRF protection.

- **CSRF contract**: `EBADCSRFTOKEN` → HTTP 419; clients clear cached CSRF token and retry once when safe.
- **Public routes**: centralized allowlists in `@universo/utils/routes` (`PUBLIC_UI_ROUTES`, `API_WHITELIST_URLS`).

**RLS request context (Knex + Postgres/Supabase)**:
- `ensureAuthWithRls` pins a request-scoped connection, sets `request.jwt.claims` for RLS policies, exposes neutral request helpers, and resets context on cleanup.
- No DB role switching (`SET role = ...`) required; see [systemPatterns.md](systemPatterns.md) and [rls-integration-pattern.md](rls-integration-pattern.md).

## APPs Architecture (v0.21.0-alpha)

**6 Working Applications** with modular architecture minimizing core shell changes:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages
-   **Resources Frontend/Backend**: Three-tier cluster management with complete data isolation
-   **Uniks Frontend/Backend**: Workspace functionality with modular architecture

### Key Architecture Benefits

-   **Workspace Packages**: `@universo/profile-backend`, `@universo/resources-backend` with clean imports and professional structure
-   **Template-First**: Reusable export templates across multiple technologies
-   **Interface Separation**: Core UPDL interfaces vs simplified integration interfaces
-   **Data Isolation**: Complete cluster-based data separation with neutral DB contracts and a shared Knex runtime
-   **Future-Ready**: Prepared for plugin extraction and microservices evolution

## Build System Architecture (Updated 2025-10-18)

**Primary Tool**: tsdown v0.15.7 (Rolldown + Oxc), 100% coverage (15 custom packages).  
**Output**: Dual-format (ESM + CJS), TypeScript declarations (.d.ts/.d.mts), tree-shaking, ~50% faster than tsc.  
**Pattern**: Single `tsdown.config.ts`, platform neutral/node, manual package.json exports control.

### Browser env entrypoint note

- `@universo/utils` now emits a dedicated browser env sub-entry (`dist/env/index.browser.*`) and maps the browser export for `./env` to that entry.
- Current root build is green, but rolldown emits a non-failing warning that `import.meta` is empty in the CJS output of that browser-only env entry; the intended browser/Vite consumption path is the ESM/browser export.

### REST docs generation note

- `@universo/rest-docs` now regenerates `src/openapi/index.yml` from live backend route files through `scripts/generate-openapi-source.js` before package validation and build.
- The package is authoritative for current path and method inventory, but payload schemas remain generic unless promoted from stable backend contracts.
- GitBook API-reference pages now link to the standalone interactive docs flow and document `pnpm --filter @universo/rest-docs build` plus `start` as the canonical launch path.

## UPDL Core System (v0.21.0-alpha)

### High-Level Abstract Nodes ✅ **COMPLETE**

**7 Core Nodes:** Space, Entity, Component, Event, Action, Data, Universo

**Key Features:**

-   Universal cross-platform description layer
-   Template-based export to multiple technologies (AR.js, PlayCanvas)
-   Hierarchical structure with typed connections
-   JSON serialization with version compatibility

**Export Process:** UPDL Graph → Template System → Technology-specific code → Published applications

**Architecture Details:** See [systemPatterns.md](systemPatterns.md) for comprehensive patterns and design principles.

### Multi-Technology Export Architecture

**Template-Based System** with clear technology separation:

-   **AR.js**: Production-ready with iframe-based rendering and quiz functionality
-   **PlayCanvas**: Complete integration with MMOOMM template for MMO development
-   **Naming Convention**: Technology-specific prefixes (ARJS, PlayCanvas)
-   **API Structure**: Clean endpoints (`/api/updl/publish/{technology}`)
-   **Future-Ready**: Extensible for additional technologies (Babylon.js, Three.js)

### Publication System ✅ **COMPLETE**

**Template-First Architecture** with reusable templates across technologies:

-   **Quiz Template**: Educational AR experiences with scoring and lead collection
-   **MMOOMM Template**: MMO gaming experiences with PlayCanvas integration
-   **URL Scheme**: `/p/{uuid}` for public view, `/e/p/{uuid}` for embedding
-   **Multi-Technology**: AR.js (production), PlayCanvas (ready), extensible system

## Development Environment

**Package Management**: PNPM workspaces with monorepo architecture
**Build System**: TypeScript + React frontend, Node.js + Express backend
**Base Platform**: legacy upstream shell 2.2.8 with enhanced ASSISTANT support

## Critical Technical Patterns

### React Performance Optimization

-   Avoid API objects in useEffect dependencies
-   Use useRef for API request state tracking
-   Minimize useEffect dependencies

### Request-Scoped DB Access Pattern (Unified Database Access Standard)

**Database Access Pattern** - All backend database access uses one of three permitted tiers with neutral contracts.

**Three Access Tiers:**
-   **Tier 1 — RLS (request-scoped)**: `getRequestDbExecutor(req, getDbExecutor())` for authenticated routes. Carries JWT claims for RLS policies.
-   **Tier 2 — Admin/Bootstrap**: `getPoolExecutor()` from `@universo/database` for admin routes, startup, and background jobs.
-   **Tier 3 — DDL/Migration**: `getKnex()` from `@universo/database` for schema-ddl services, migration runners, and explicit package-local DDL boundaries only.

**Core Contracts** (all in `@universo/utils/database`):
-   `DbExecutor` — query + transaction + isReleased
-   `DbSession` — query + isReleased (read-only)
-   `SqlQueryable` — minimal query contract for persistence stores

**Identifier Safety** (`@universo/database`): `qSchema()`, `qTable()`, `qColumn()`, `qSchemaTable()` — all validate and double-quote identifiers; reject injection payloads. Use `$1`/`$2` bind parameters for values.

**Mutation Expectations**: business-table UPDATE/DELETE/RESTORE flows use `RETURNING` when row confirmation matters, fail closed on zero-row results, and keep SQL schema-qualified instead of relying on `search_path`.

**CI Enforcement**: `node tools/lint-db-access.mjs` runs as a CI step after ESLint, before build. Zero-violation policy for all domain packages.

**Applications sync boundary**: `@universo/applications-backend` keeps raw Knex access only inside `src/ddl/index.ts`; `applicationSyncRoutes.ts` stays under normal lint enforcement and consumes that dedicated Tier 3 boundary instead of calling `getKnex()` directly.

**Metahubs DDL boundary**: `@universo/metahubs-backend` keeps raw Knex access only inside package DDL seams and schema-ddl integration paths; design-time domain services and persistence helpers remain SQL-first.

**Bridge**: `createKnexExecutor(knex)` wraps Tier 3 Knex instances as `DbExecutor` for Tier 3 → Tier 1 boundary (used in publication sync routes).
-   Shared database runtime comes from `@universo/database`
-   CASCADE delete relationships for data integrity
-   UNIQUE constraints on junction tables to prevent duplicates

### UUID v7 Architecture

**Time-Ordered UUID System** - Project-wide UUID v7 for better database indexing performance

**Migration Status**: ✅ Complete (2025-12-10) - All 75 migrations + 31 service files updated

**Key Implementation Details:**

-   **Infrastructure Migration**: PostgreSQL `public.uuid_generate_v7()` function in dedicated migration (MUST execute first)
    - File: `packages/universo-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts`
    - Timestamp: `1500000000000` (July 14, 2017) - Earliest migration to ensure execution before all table creation
    - Registered: First entry in `postgresMigrations` array (PHASE 0: Infrastructure)
    - Implementation: Custom PL/pgSQL function following RFC 9562 specification for PostgreSQL 17.4 (Supabase)
  - **Why separate?**: The UUID v7 function must exist before any schema bootstrap that relies on `DEFAULT public.uuid_generate_v7()`.
-   **Backend Module**: `@universo/utils/uuid` with `generateUuidV7()`, `isValidUuid()`, `extractTimestampFromUuidV7()`
-   **Frontend Package**: `uuidv7@^1.1.0` (npm package for browser bundles)
-   **Migration Pattern**: All DEFAULT clauses use `public.uuid_generate_v7()` instead of `uuid_generate_v4()` or `gen_random_uuid()`
-   **Service Pattern**: Backend services use `uuid.generateUuidV7()` from `@universo/utils`
-   **Performance**: 30-50% faster indexing due to time-ordered nature (better B-tree locality)
-   **UUID v7 Format**: 48-bit Unix timestamp (ms) + 12-bit version/variant + 62-bit random
-   **Compatibility**: Standard RFC 9562 UUID v7 format (backwards compatible with v4 parsing)
-   **PostgreSQL Support**: Native `gen_uuidv7()` available in PostgreSQL 18+, custom function required for 17.4

**Example Usage:**
```typescript
// Backend (SQL migration)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  ...
)

// Backend (service)
import { uuid } from '@universo/utils'
const newId = uuid.generateUuidV7()

// Frontend
import { uuidv7 } from 'uuidv7'
const newId = uuidv7()
```

**Critical Files:**
- Infrastructure migration: `packages/universo-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts` (PHASE 0)
- Migration registry: `packages/universo-core-backend/base/src/database/migrations/postgres/index.ts` (infrastructure migration first)
- Backend module: `packages/universo-utils/base/src/uuid/index.ts`


**Current UUID v7 Contract:**
- SQL-first migrations and schema bootstrap use `DEFAULT public.uuid_generate_v7()` directly.
- Backend services generate UUID v7 through `@universo/utils/uuid` when they need client-side identifiers.
- Database verification previously confirmed the default is present across the PostgreSQL schema.

### Data Isolation Architecture

**Note**: The original cluster-based isolation (Clusters → Domains → Resources) was removed in the legacy packages cleanup (2026-02-28). Current data isolation is handled via RLS policies and tenant-scoped queries (see `rls-integration-pattern.md`).

### Material-UI Validation Pattern

**Frontend Validation** - Consistent form validation with clear user feedback

**Key Implementation Details:**

-   Required fields use Material-UI `required` attribute (automatic asterisk)
-   No manual asterisks in InputLabel components
-   Error states with visual feedback
-   Conditional save buttons disabled until form is valid
-   No empty options for required select fields

### AR.js Rendering Architecture

**Iframe-Based Rendering** - Essential for proper script execution in React context

**Key Implementation Details:**

-   Iframe-based rendering for proper script execution
-   Static library integration with the main backend server
-   User-selectable library sources (CDN vs local)
-   CDN independence for restricted regions

### Rate Limiting Architecture

**Redis-Based Distributed Rate Limiting** - Production-ready DoS protection for multi-instance deployments

**Key Implementation Details:**

-   **Package**: `@universo/utils/rate-limiting` - Universal rate limiter creation
-   **Pattern**: Singleton Redis client (RedisClientManager) with event-driven connection waiting
-   **Libraries**: 
    -   `express-rate-limit@8.2.0` - HTTP rate limiting middleware
    -   `rate-limit-redis@4.2.3` - Distributed storage backend
    -   `ioredis@^5.8.2` - Redis client with connection pooling
-   **Configuration**: Environment variable `REDIS_URL` (optional, falls back to MemoryStore)
-   **Connection Pattern**: Event-driven (`instance.once('ready')`) with proper cleanup (no polling)
-   **Cleanup**: Automatic event listener removal prevents memory leaks
-   **Multi-Instance Support**: Redis store shares counters across replicas (Docker/K8s/PM2)
-   **Deployment Guide**: See `packages/universo-utils/base/DEPLOYMENT.md` for production setup

**Production Setup**:
```bash
# Set REDIS_URL for multi-instance deployments
REDIS_URL=redis://:password@redis.example.com:6379  # Basic auth
REDIS_URL=rediss://:password@redis.example.com:6380 # TLS (recommended)
```

**Documentation**: 
- Production deployment: `packages/universo-utils/base/DEPLOYMENT.md` (Docker, Kubernetes, PM2)
- Troubleshooting: Common issues (connection timeout, high 429 errors, memory leaks)
- Security: TLS encryption, authentication, network isolation

---

_For system architecture patterns, see [systemPatterns.md](systemPatterns.md). For project overview, see [projectbrief.md](projectbrief.md). For current development status, see [activeContext.md](activeContext.md)._
