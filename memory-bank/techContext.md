# Technical Context

## 🔄 Custom Modifications to Preserve

### 1. Authentication Architecture

-   **Current**: Multi-user Supabase JWT authentication
-   **Integration Point**: Must create bridge between Supabase JWT ↔ Passport.js
-   **Files Affected**: All middleware, controllers, UI authentication

#### 2. Uniks (Workspace) System

-   **Purpose**: Multi-tenant workspace isolation (enterprise feature simulation)
-   **Implementation**: Hierarchical entity relationships with access control
-   **Database Schema**: Custom entities with `unik_id` foreign keys
-   **UI Components**: Custom workspace selection and management pages
-   **Risk**: High - Core business logic that must be preserved

#### 3. Internationalization (i18n)

-   **Languages**: English (base) + Russian (full translation)
-   **Implementation**: Complete UI text extraction and translation
-   **Files**: `packages/ui/src/i18n/locales/en.json` & `ru.json`

#### 4. UPDL Nodes & Multi-Technology Export

-   **Location**: `apps/` directory (custom application layer)
-   **Purpose**: Universal high-level logic nodes for AR.js and PlayCanvas scene generation
-   **Integration**: Custom nodes within Flowise chatflow system
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

### Key Architecture Benefits

-   **Workspace Packages**: `@universo/profile-srv` with clean imports and professional structure
-   **Template-First**: Reusable export templates across multiple technologies
-   **Interface Separation**: Core UPDL interfaces vs simplified integration interfaces
-   **Future-Ready**: Prepared for plugin extraction and microservices evolution

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

### AR.js Rendering Architecture

**Iframe-Based Rendering** - Essential for proper script execution in React context

**Key Implementation Details:**

-   Iframe-based rendering for proper script execution
-   Static library integration with main Flowise server
-   User-selectable library sources (CDN vs local)
-   CDN independence for restricted regions

---

_For system architecture patterns, see [systemPatterns.md](systemPatterns.md). For project overview, see [projectbrief.md](projectbrief.md). For current development status, see [activeContext.md](activeContext.md)._
