# Technical Context

## 🔄 Custom Modifications to Preserve

### Authentication Architecture - **COMPLETED MIGRATION**

**Previous**: Multi-user Supabase JWT authentication
**Current**: Passport.js + Supabase hybrid authentication with session management
**Integration Point**: Bridge between Supabase JWT ↔ Passport.js successfully implemented
**Files Affected**: All middleware, controllers, UI authentication components migrated

### Access Control Evolution (Phase 2 - TypeORM Enforcement) - **COMPLETED**

**Current Model (September 2025)**: Application-level access control with TypeORM middleware

**Key Components:**
- **WorkspaceAccessService**: Centralized membership validation with per-request caching
- **Role System**: Strict TypeScript enum (`owner`, `admin`, `editor`, `member`) with hierarchy validation  
- **Schema Isolation**: Dedicated `uniks` schema with RLS policies (Supabase-level protection)
- **Dual Query Strategy**: Membership lookup + entity fetch for cross-schema compatibility
- **TypeORM Integration**: Complete migration from Supabase REST to Repository pattern

**Implementation Pattern:**
```typescript
// All Unik-scoped controllers use this pattern
const userId = await ensureUnikMembershipResponse(req, res, unikId, {
  roles: ['editor', 'admin', 'owner'], // Optional role filtering
  errorMessage: 'Access denied'
})
if (!userId) return // Response already sent
```

**Security Layers:**
1. **Application Layer**: TypeORM-based membership validation (primary protection)
2. **Database Layer**: RLS policies on `uniks.uniks_users` and `uniks.uniks` (fallback protection)
3. **Request Cache**: In-memory membership cache to minimize database hits during request lifecycle

**Migration Context:** 
- **Phase 1 (Complete)**: Supabase REST client with embedded relationship queries
- **Phase 2 (Current)**: TypeORM direct access with application-level enforcement
- **Future Consideration**: Low-privilege database role with mandatory RLS for additional protection

**Critical Security Note:** All new routes accessing Unik-scoped resources MUST use `ensureUnikMembershipResponse` or `requireUnikRole` middleware. Missing this enforcement bypasses all access control.

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
-   **Implementation**: Complete UI text extraction and translation
-   **Files**: `packages/flowise-ui/src/i18n/locales/en.json` & `ru.json`

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

### Authentication Architecture

**Secure Supabase JWT authentication** with multi-user support:

-   **Server-side**: JWT validation, secure token handling, HTTP-only cookies
-   **Frontend**: React context with automatic token refresh
-   **Security**: No exposed keys, backend-only Supabase operations
-   **Environment**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

## APPs Architecture (v0.21.0-alpha)

**6 Working Applications** with modular architecture minimizing core Flowise changes:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages
-   **Resources Frontend/Backend**: Three-tier cluster management with complete data isolation
-   **Uniks Frontend/Backend**: Workspace functionality with modular architecture

### Key Architecture Benefits

-   **Workspace Packages**: `@universo/profile-srv`, `@universo/resources-srv` with clean imports and professional structure
-   **Template-First**: Reusable export templates across multiple technologies
-   **Interface Separation**: Core UPDL interfaces vs simplified integration interfaces
-   **Data Isolation**: Complete cluster-based data separation with TypeORM Repository pattern
-   **Future-Ready**: Prepared for plugin extraction and microservices evolution

## Build System Architecture (Updated 2025-10-18)

**Primary Build Tool**: tsdown v0.15.7 (Rolldown + Oxc based)

**Coverage**: 100% of workspace packages using modern build tooling
- ✅ 15 packages on tsdown (all custom packages)
- ✅ 0 packages on legacy tsc + tsconfig.esm.json pattern
- ℹ️ Base Flowise packages use tsc for unbundled output (intentional)

**Build Configuration Pattern**:
```typescript
// tsdown.config.ts (standard pattern)
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  platform: 'neutral', // or 'node' for backend packages
  clean: true,
  outDir: 'dist',
  exports: false, // CRITICAL: manual control of package.json
  treeshake: true,
  minify: false
})
```

**Output Structure** (dual-format):
```
dist/
├── index.js      # CommonJS bundle
├── index.mjs     # ES Module bundle
├── index.d.ts    # TypeScript declarations (CJS)
└── index.d.mts   # TypeScript declarations (ESM)
```

**Migration History**:
- 2025-01-18: Initial tsdown migration (7 packages: spaces-frt, publish-frt, analytics-frt, profile-frt, finance-frt, uniks-frt, updl, utils)
- 2025-10-18: **Completed migration** (4 packages: auth-frt, auth-srv, template-quiz, types)

**Benefits Achieved**:
- ⚡ ~50% faster builds vs tsc (Rolldown performance)
- 🔧 Single configuration file vs 2-3 tsconfig files
- 📦 Automatic dual-format generation (ESM + CJS)
- 🌲 Built-in tree-shaking
- 🎯 Consistent tooling across monorepo

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

## Technology Stack & Base Platform

**Base Platform**: Universo-platformo-react monorepo built on **Flowise AI 2.2.8** - TypeScript/React frontend with Node.js/Express backend. Flowise provides the visual node editor infrastructure, which we extend with UPDL-specific nodes for 3D/AR/VR development.

**Export Target Technologies**:

-   **AR.js** - Lightweight web AR library (production-ready with A-Frame integration)
-   **PlayCanvas Engine** - High-performance WebGL engine for browser-based 3D (ready for deployment)
-   **Babylon.js** - Comprehensive 3D engine with WebGL/WebGPU support (planned)
-   **Three.js** - Popular low-level 3D library serving as baseline for WebGL (planned)
-   **A-Frame** - Declarative WebVR/AR framework for HTML-based scenes (planned)

**Development Environment**:

-   **Package Management**: PNPM with workspace architecture
-   **Build System**: Turborepo for efficient monorepo builds
-   **Code Quality**: ESLint, Prettier, TypeScript strict mode
-   **Internationalization**: Modular i18n system with English/Russian support
-   **Version Control**: GitHub with standard PR workflow and CI/CD

**Architecture Principles**:

-   Modular APPs structure minimizing core Flowise changes
-   Template-first export system for multi-technology support
-   Workspace packages for backend services (`@universo/package-name`)
-   Open source dual licensing (Apache 2.0 + Omsk Open License)

## Current Development Status (v0.21.0-alpha)

**Platform Status**: **Alpha Achieved** - Production-ready platform with complete UPDL system

**Key Achievements:**

-   ✅ High-level UPDL nodes (7 core abstract nodes)
-   ✅ Multi-technology export (AR.js production, PlayCanvas ready)
-   ✅ Template-first architecture with reusable components
-   ✅ Enhanced Flowise 2.2.8 platform with TypeScript modernization

**Next Focus**: Advanced UPDL features and Universo MMOOMM expansion

## Critical Technical Patterns

### React Performance Optimization

-   Avoid API objects in useEffect dependencies
-   Use useRef for API request state tracking
-   Minimize useEffect dependencies

### TypeORM Repository Pattern

**Database Access Pattern** - All database operations must use TypeORM Repository pattern

**Key Implementation Details:**

-   No direct database calls - all operations through Repository pattern
-   Shared DataSource via `getDataSource()` from `packages/flowise-server/src/DataSource.ts`
-   Entity registration in central registry `packages/flowise-server/src/database/entities/index.ts`
-   Migration registration in `packages/flowise-server/src/database/migrations/postgres/index.ts`
-   CASCADE delete relationships for data integrity
-   UNIQUE constraints on junction tables to prevent duplicates

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
    -   `ioredis@5.3.2` - Redis client with connection pooling
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
