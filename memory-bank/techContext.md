# Technical Context

## 🔄 Custom Modifications to Preserve

### Authentication Architecture - **COMPLETED MIGRATION**

**Previous**: Multi-user Supabase JWT authentication
**Current**: Passport.js + Supabase hybrid authentication with session management
**Integration Point**: Bridge between Supabase JWT ↔ Passport.js successfully implemented
**Files Affected**: All middleware, controllers, UI authentication components migrated

### Access Control Evolution (Phase 2 - TypeORM Enforcement) - **COMPLETED**
**Current Model**: Application-level access control with TypeORM middleware.  
**Key Components**: WorkspaceAccessService (centralized membership validation), strict TypeScript role enum (`owner`, `admin`, `editor`, `member`), dedicated `uniks` schema with RLS policies, TypeORM Repository pattern (migrated from Supabase REST).

**Pattern**:
```typescript
const userId = await ensureUnikMembershipResponse(req, res, unikId, {
  roles: ['editor', 'admin', 'owner']
})
if (!userId) return
```

**Security Layers**: (1) TypeORM membership validation (primary), (2) RLS policies (fallback), (3) Request cache.  
**CRITICAL**: All Unik-scoped routes MUST use `ensureUnikMembershipResponse` or `requireUnikRole` middleware.

#### 2. Uniks (Workspace) System
-   **Purpose**: Multi-tenant workspace isolation (enterprise feature simulation)
-   **Implementation**: Schema-isolated entities with TypeORM access control
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
-   **Files**: `packages/flowise-core-frontend/base/src/i18n/locales/en.json` & `ru.json`
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

#### 3.3 Runtime DDL Utilities (schema-ddl)
-   **Package**: `@universo/schema-ddl` provides shared runtime DDL logic (schema generation, migrations, snapshots).
-   **Pattern**: DI-only (`createDDLServices(knex)`), no static wrapper methods; naming utilities are imported directly.
-   **Safety**: All `knex.raw` calls must use parameterized queries (including `SET LOCAL statement_timeout`).

#### 4. UPDL Nodes & Multi-Technology Export

-   **Location**: `packages/` directory (custom application layer)
-   **Purpose**: Universal high-level logic nodes for AR.js and PlayCanvas scene generation
-   **Integration**: Custom nodes within Flowise canvas system
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
-   **Risk**: Medium - Isolated from core Flowise changes but needs verification

## Platform Foundation

**Flowise AI 2.2.8** - Enhanced platform with ASSISTANT support (upgraded 2025-07-01)
**Supabase Integration** - Multi-user functionality with Postgres-only database support

### Database Pooling (Supabase Nano Tier Optimized)

**Target**: Supabase Nano tier (15 connections max) - compatible with free tier.

**Pool allocation** (as of 2026-02-03):
| Component | Pool Size | Purpose |
|-----------|-----------|---------|
| TypeORM   | 5 (configurable via `DATABASE_POOL_MAX`) | Static entities (metahubs, catalogs, attributes) |
| Knex      | 5 (configurable via `DATABASE_KNEX_POOL_MAX`) | Runtime DDL operations (CREATE SCHEMA, ALTER TABLE) |
| Reserved  | 5 | Supabase internal services (Storage, PostgREST, health checks) |

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

**RLS request context (TypeORM + Postgres/Supabase)**:
- `ensureAuthWithRls` uses a per-request QueryRunner and sets `request.jwt.claims` for RLS policies, then resets context on cleanup.
- No DB role switching (`SET role = ...`) required; see [systemPatterns.md](systemPatterns.md) and [rls-integration-pattern.md](rls-integration-pattern.md).

## APPs Architecture (v0.21.0-alpha)

**6 Working Applications** with modular architecture minimizing core Flowise changes:

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
-   **Data Isolation**: Complete cluster-based data separation with TypeORM Repository pattern
-   **Future-Ready**: Prepared for plugin extraction and microservices evolution

## Build System Architecture (Updated 2025-10-18)

**Primary Tool**: tsdown v0.15.7 (Rolldown + Oxc), 100% coverage (15 custom packages).  
**Output**: Dual-format (ESM + CJS), TypeScript declarations (.d.ts/.d.mts), tree-shaking, ~50% faster than tsc.  
**Pattern**: Single `tsdown.config.ts`, platform neutral/node, manual package.json exports control.

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
**Base Platform**: Flowise 2.2.8 with enhanced ASSISTANT support

## Critical Technical Patterns

### React Performance Optimization

-   Avoid API objects in useEffect dependencies
-   Use useRef for API request state tracking
-   Minimize useEffect dependencies

### TypeORM Repository Pattern

**Database Access Pattern** - All database operations must use TypeORM Repository pattern

**Key Implementation Details:**

-   No direct database calls - all operations through Repository pattern
-   Shared DataSource via `getDataSource()` from `packages/flowise-core-backend/base/src/DataSource.ts`
-   Entity registration in central registry `packages/flowise-core-backend/base/src/database/entities/index.ts`
-   Migration registration in `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts`
-   CASCADE delete relationships for data integrity
-   UNIQUE constraints on junction tables to prevent duplicates

### UUID v7 Architecture

**Time-Ordered UUID System** - Project-wide UUID v7 for better database indexing performance

**Migration Status**: ✅ Complete (2025-12-10) - All 75 migrations + 31 service files updated

**Key Implementation Details:**

-   **TypeORM Version**: 0.3.28 (upgraded from 0.3.6)
-   **Infrastructure Migration**: PostgreSQL `public.uuid_generate_v7()` function in dedicated migration (MUST execute first)
    - File: `packages/flowise-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts`
    - Timestamp: `1500000000000` (July 14, 2017) - Earliest migration to ensure execution before all table creation
    - Registered: First entry in `postgresMigrations` array (PHASE 0: Infrastructure)
    - Implementation: Custom PL/pgSQL function following RFC 9562 specification for PostgreSQL 17.4 (Supabase)
    - **Why separate?**: TypeORM sorts migrations by class name timestamp, not array order. Function MUST exist before any table with `DEFAULT public.uuid_generate_v7()` is created.
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
// Backend (TypeORM migration)
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
- Infrastructure migration: `packages/flowise-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts` (PHASE 0)
- Migration registry: `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts` (infrastructure migration first)
- Backend module: `packages/universo-utils/base/src/uuid/index.ts`


**TypeORM Compatibility (QA Verified 2025-12-11):**
- **Entity Decorator Pattern**: `@PrimaryGeneratedColumn('uuid')` is fully compatible with `uuid_generate_v7()`
- **How It Works**: TypeORM does NOT generate UUIDs client-side. When `repository.save(entity)` is called without an id:
  1. TypeORM executes `INSERT INTO table (...) VALUES (...) RETURNING *`
  2. PostgreSQL generates UUID using the column's DEFAULT clause (`uuid_generate_v7()`)
  3. TypeORM receives the generated UUID v7 from the RETURNING clause
- **Schema Synchronization**: DataSource configured with `synchronize: false` to prevent TypeORM from overwriting DEFAULT clauses
- **Migration Safety**: TypeORM's `uuidGenerator` getter (returns `uuid_generate_v4()` or `gen_random_uuid()`) is used only for DDL operations (CREATE/ALTER TABLE). Our raw SQL migrations override this with `public.uuid_generate_v7()`.
- **Auto-Migration Warning**: If using `typeorm migration:generate`, manually edit generated migrations to replace `uuid_generate_v4()` with `public.uuid_generate_v7()`
- **Database Verification**: All 75+ tables confirmed to have `DEFAULT uuid_generate_v7()` in PostgreSQL schema (verified via `information_schema.columns`)

### Data Isolation Architecture

**Cluster-Based Isolation** - Complete data separation between organizational units

**Key Implementation Details:**

-   Three-tier hierarchy: Clusters → Domains → Resources
-   Junction tables with CASCADE delete and UNIQUE constraints
-   Mandatory associations prevent orphaned entities
-   Cluster-scoped API endpoints maintain context
-   Frontend validation prevents invalid data entry
-   Idempotent operations for safe relationship management

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
-   Static library integration with main Flowise server
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
