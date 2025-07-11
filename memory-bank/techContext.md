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

#### 4. UPDL Nodes & AR.js Export

-   **Location**: `apps/` directory (custom application layer)
-   **Purpose**: Universal high-level logic nodes for AR.js scene generation
-   **Integration**: Custom nodes within Flowise chatflow system
-   **Components**: Publisher UI, Builder logic, API integration
-   **Risk**: Medium - Isolated from core Flowise changes but needs verification

## Flowise AI

Original project that serves as the foundation. Version 2.2.8 (upgraded from 2.2.7‑patch.1 on 2025-06-27).

## Supabase Integration

Added to implement multi‑user functionality. When creating Universo Platformo React based on Flowise AI, **only** the Postgres/Supabase option is now used; other DBMS are disabled. New migrations are created only for Postgres.

### Authentication Architecture

**Universo Platformo** implements a secure authentication flow with Supabase:

1. **Server-side Integration**:

    - Authentication through `/packages/server/src/controllers/up-auth/auth.ts`
    - Endpoints in `/packages/server/src/routes/up-auth/index.ts`: register, login, logout, me, refresh
    - Secure token handling with HTTP-only cookies for refresh tokens
    - Environment variables in `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

2. **Frontend Authentication Context**:

    - React context in `/packages/ui/src/utils/authProvider.jsx`
    - Implements login, logout, automatic token refresh, and authentication state
    - Utilizes localStorage for access tokens and HTTP-only cookies for refresh tokens
    - Periodic token refresh (every 50 minutes) to maintain sessions

3. **Protected Routes**:

    - Route protection via `/packages/ui/src/routes/AuthGuard.jsx`
    - Redirects unauthenticated users to login page
    - Shows loading indicator during authentication check

4. **Security Features**:
    - No Supabase keys exposed to frontend
    - All Supabase operations through backend API
    - JWT validation and secure token storage
    - Compatible with future desktop app wrapping (Electron/Tauri)

## APPs Architecture Implementation

The project has successfully implemented a modular APPs architecture with 6 working applications that separate functionality while minimizing changes to the core Flowise codebase.

### Workspace Package Architecture

#### Profile Service Workspace Package

The profile service has been successfully converted to a **workspace package** architecture:

**Package Structure:**

-   **Package Name**: `@universo/profile-srv` (scoped workspace package)
-   **Integration**: Main server imports via `import { Profile, profileMigrations, createProfileRoutes } from '@universo/profile-srv'`
-   **Exports**: All components exported via `src/index.ts` for clean package interface
-   **Dependencies**: Workspace dependency `"@universo/profile-srv": "workspace:*"` in main server

**Benefits Achieved:**

-   **Eliminated Complex Relative Paths**: No more `../../../../apps/profile-srv/base/dist` imports
-   **Professional Package Structure**: Scoped package with proper metadata
-   **Automatic Dependency Resolution**: pnpm workspace handles build ordering
-   **Future-Ready**: Prepared for extraction to separate repository as plugin
-   **Type Safety**: Full TypeScript integration with workspace resolution

**Implementation Pattern:**
This workspace package pattern can be applied to other backend services for similar benefits. Frontend applications continue to use REST API communication for appropriate separation.

### Current APPs Implementation (v0.17.0+)

**6 Working Applications:** UPDL, Publish Frontend/Backend, Analytics, Profile Frontend/Backend

**Detailed Directory Structure:** See [apps/README.md](../apps/README.md) for complete architecture documentation, build instructions, and current application structure.

### Interface Architecture (Two-Layer System)

**UPDL Core Interfaces** (`apps/updl/base/src/interfaces/UPDLInterfaces.ts`):

-   **Purpose**: Complete UPDL ecosystem definitions for flows, graphs, and detailed node properties
-   **Scope**: Full UPDL specification with advanced properties (materials, physics, animations)
-   **Usage**: Internal UPDL nodes, graph processing, complex scene definitions
-   **Export**: Available via UPDL module exports for advanced consumers

**Integration Interfaces** (`packages/server/src/Interface.UPDL.ts`):

-   **Purpose**: Simplified interfaces for backend/frontend integration
-   **Scope**: Essential properties for space processing and publication
-   **Usage**: Publication system, API communication, AR.js conversion
-   **Export**: Available via `@server/interface` alias

**Benefits of Separation**:

-   **Clean Integration**: Publication system uses only necessary interfaces
-   **Future Flexibility**: Core UPDL can evolve without breaking integrations
-   **Optimal Performance**: Smaller interface footprint for production use
-   **No Duplication**: Each serves distinct architectural purpose

## UPDL Core Components (v0.17.0+)

### Key Node Types

**Implemented Nodes:** Space (root), Object, Camera, Light, Data (quiz), Interaction, Controller, Animation

**Core Features:**

-   Hierarchical structure with parent-child relationships
-   Typed ports with connection validation
-   JSON serialization with version compatibility
-   Platform-independent intermediate representation

**Export Process:** Flowise JSON → UPDL objects → Platform-specific code → Published applications

**Detailed UPDL Patterns:** See [systemPatterns.md](systemPatterns.md) for comprehensive node architecture and design principles.

### AR.js and A-Frame Architecture

Following a clear design decision, we have separated AR.js and A-Frame implementations to improve maintainability and future extensibility:

1. **File Naming Convention**:

    - AR.js specific files use the `ARJS` prefix (e.g., `updlToARJSBuilder.ts`, `ARJSHTMLGenerator.ts`, `UPDLToARJS.ts`)
    - A-Frame VR implementations will use `AFrame` prefix in the future

2. **Interface Separation**:

    - Created separate UPDL-specific interfaces in `Interface.UPDL.ts`
    - Proper type handling with implementations for AR.js-specific primitives (ARJSPrimitive)
    - Clean separation between UPDL core model and presentation technologies

3. **API Structure**:

    - AR.js endpoints follow `/api/updl/publish/arjs` naming pattern
    - Publication retrieval endpoints use `/api/updl/publication/arjs/:publishId`
    - Clean separation from future A-Frame VR endpoints

4. **Implementation Benefits**:
    - Reduced code complexity through specialized implementations
    - Improved maintainability with clear separation of concerns
    - Future-proofing for additional technologies (A-Frame VR, PlayCanvas, etc.)
    - Clear architecture for new developers to understand the system

This architecture allows us to focus on completing AR.js implementation now while postponing A-Frame VR and other technologies for future development phases.

### Publication System

#### Template-First Architecture (v0.18.0+)

The publication system has been refactored to follow a **template-first architecture** that prioritizes template reusability over technology-specific organization:

**New Structure:**

```
builders/templates/
├── quiz/                    # Educational quiz template
│   └── arjs/               # AR.js implementation
│       ├── ARJSBuilder.ts  # High-level controller
│       ├── ARJSQuizBuilder.ts # Template implementation
│       └── handlers/       # Quiz-specific processors
└── mmoomm/                 # MMO gaming template
    └── playcanvas/         # PlayCanvas implementation
        ├── PlayCanvasBuilder.ts       # High-level controller
        ├── PlayCanvasMMOOMMBuilder.ts # Template implementation
        └── handlers/                  # MMOOMM-specific processors
```

**Benefits:**

-   **Template Reusability**: Same template (e.g., `quiz`) can be implemented across multiple technologies
-   **Clear Separation**: Each template contains its own handlers and logic for specific use cases
-   **Extensibility**: Easy addition of new templates or technology implementations
-   **Self-contained**: Templates are independent modules with complete functionality

#### URL Scheme

The publication system implements a modern URL scheme to provide consistent access to published projects:

```
/p/{uuid}         # Main public view with Universo Platformo header/footer
/e/p/{uuid}       # Embedded view (frameless) for external embedding
```

This approach is inspired by PlayCanvas and other professional publishing platforms, providing:

1. **Consistent access pattern** - All published content follows the same URL structure regardless of technology
2. **Unique identifiers** - UUID ensures no collisions between different projects
3. **Versioning support** - Future implementations can add version numbers (/p/{uuid}/v/{version})
4. **Security through obscurity** - Hard-to-guess URLs prevent unauthorized access while public

#### Publication Process

1. **Client-Side Export**:

    - User selects AR.js technology in "Configuration" tab
    - They configure settings in "Publication" tab (title, marker type, etc.)
    - UPDL flow is processed and converted to A-Frame model via `UPDLToAFrameConverter`
    - HTML is generated client-side with `ARJSExporter`

2. **Server-Side Storage**:

    - Generated HTML is sent to server via `publishARJSProject` API
    - `UPDLController` saves the HTML file with unique ID
    - Metadata is stored for future reference
    - Server returns public URL to the client

3. **Access Control**:
    - The "Make Public" toggle controls whether URL is accessible without authentication
    - Future implementations will add more granular permissions

#### AR.js Publication Flow

The AR.js publication flow specifically handles:

1. **Marker Selection** - Preset markers (Hiro, Kanji) or custom marker URL
2. **Scene Configuration** - Title, background color, text color
3. **3D Model Settings** - Model URL for GLB/GLTF files, scale, position
4. **HTML Generation** - A-Frame scene with AR.js integration
5. **QR Code Display** - For easy access on mobile devices

#### Project Sharing

When a project is published:

1. Public URL is generated in format `/p/{uuid}`
2. QR code is displayed for scanning with mobile devices
3. Copy button allows easy sharing of the URL
4. Options for social media sharing are provided

This implementation creates a professional publication flow similar to established platforms like PlayCanvas, while maintaining compatibility with the UPDL architecture.

## Package Management

Using **pnpm** for package management. All commands should be run from the project root directory.

## Technology Stack & Base Platform

The project is built on the **universo-platformo-react** repository – a monorepo primarily written in JavaScript and TypeScript (React for frontend, Node.js / Express for backend). This platform already integrates the **FlowiseAI** engine – an open-source tool for building node-based flows (originally for LLM orchestration) which we are adapting for visual editing of UPDL node graphs. Flowise provides a ready-made infrastructure: a **React frontend** for drag-and-drop node editing and a **Node.js backend** for storing and running flows. We will extend or modify Flowise with our UPDL-specific nodes, leveraging its interface while injecting our custom logic where needed. This base means we don't build the editor from scratch – we reuse Flowise's UI and database, integrating our node system into it.

**Key technologies for export (target engines):** We prioritize support for web-oriented engines and libraries, specifically:

-   **AR.js** – a lightweight JS library for augmented reality on the web (supports marker-based and location-based AR). AR.js is typically used in conjunction with A-Frame or Three.js. In our context, we'll use AR.js with A-Frame to quickly create web AR scenes.
-   **PlayCanvas Engine** and **PlayCanvas React** – PlayCanvas is a high-performance WebGL engine for browser-based 3D. We plan two export strategies: one directly to the engine (imperative JavaScript using the PlayCanvas API), and one via the React wrapper (@playcanvas/react) which allows describing a scene declaratively in JSX. The React approach aligns well with our platform (since we use React) and can simplify integration (embedding the scene as a component).
-   **Babylon.js** – a comprehensive 3D engine for the web (WebGL/WebGPU) with a rich feature set (materials, model loading, VR/AR via WebXR, etc.). Babylon will be another export target, ensuring that UPDL can drive a complex engine. We expect to handle things like setting up scenes, cameras, lights, and basic interactions in Babylon.
-   **Three.js** – the popular low-level 3D library underpinning many other frameworks (including AR.js and A-Frame). Three.js serves as a "baseline" for 3D scene export. Exporting to Three.js means we cover generic WebGL use cases and by extension have the building blocks for other frameworks. Many concepts (cameras, lights, meshes) are similar across Three.js and Babylon, so we can reuse logic.
-   **A-Frame** – a declarative framework from Mozilla for WebVR/AR, allowing us to describe scenes in HTML. We are using it for AR (with AR.js) and potentially for simple VR scenes. A-Frame provides an easy way to structure a scene with markup, which our exporters can generate. It also handles VR setup if needed. Essentially, A-Frame will be our method of exporting AR experiences (with AR.js for camera and tracking) and possibly standalone VR experiences.

These engines cover a broad spectrum of web 3D/AR development. Initially, our focus is AR.js (because it delivers an immediate AR use-case). After that, we will tackle PlayCanvas (React) and Babylon.js, then Three.js, then A-Frame VR and pure PlayCanvas (non-React). This order (AR -> Babylon/PlayCanvas -> Three/A-Frame -> etc.) is chosen based on project priorities and reuse of code (Babylon and Three are similar, so doing Babylon first gives us a lot for Three.js). Each exporter will reside in the `apps/updl` module and output platform-specific code or assets.

**Development Environment:** The monorepo is managed with **pnpm** and **Turborepo** for efficient builds (see `pnpm-workspace.yaml` and `turbo.json` in the repo). This allows simultaneous development of multiple sub-projects (apps). This approach aligns with an architecture based on separate **APPs** modules in the repository. Code style and quality are enforced via ESLint (see the `.eslintrc.js` in the project) and formatting rules (likely Prettier). The project already has a Docker setup, i18n files (internationalization for UI text), and CI scripts configured; we will adhere to these established practices. As we add new modules (like `apps/updl` and `apps/publish`), we integrate them into the existing pipeline and maintain consistency. For example, any user-facing text in the new modules will use the existing i18n system (with translation files residing under the respective `apps/` module as needed) rather than hard-coding strings. We will also update build scripts and configuration so that the new apps are included when running the monorepo (development server, build, etc.).

**Version Control and Collaboration:** The repository is hosted on GitHub. The team uses GitHub Issues and Projects boards to track tasks and progress (we have relevant issues for adding UPDL nodes and exporters already). Our project is open source (Apache-2.0 license and Omsk Open License), meaning we design with openness in mind, and we may eventually invite community contributions. In development, we follow standard practices: feature branches, pull requests, code reviews, and CI checks (lint/tests) before merging. This helps maintain code quality and consistency. Each significant feature (like a new exporter or a new node type) will likely have an issue and possibly an entry in `tasks.md` for AI context. Communication is key: developers, the node designer, and the tester coordinate closely. We have daily stand-up meetings to monitor progress and quickly address blockers. Any change in plan or scope is promptly updated in documentation (Memory Bank and/or issues) so the AI and team remain in sync.

By leveraging this tech stack and workflow, we ensure that UPDL development is robust: we use proven frameworks (Flowise, React, Node, Three.js, etc.), enforce good practices (linting, CI), keep the AI assistant informed (Memory Bank), and maintain agility in development (monorepo tools for speed, GitHub for collaboration). All these technical considerations set a solid foundation for implementing UPDL as envisioned.

## Current Development Focus (June 2025, v0.17.0+)

**Platform Status:** Successfully implemented with 6 working applications, workspace packages, and AR.js publication system.

**Next Development Priorities (v0.18.0-0.20.0):**

1. **Platform Stabilization (0.18.0-pre-alpha)**

    - Enhanced user profile system and architecture consolidation
    - Comprehensive testing framework implementation
    - Performance optimization and stability improvements

2. **Advanced UPDL Development (0.19.0-pre-alpha)**

    - New UPDL node types (Physics, Animation, Interaction, Networking)
    - Universo MMOOMM integration with PlayCanvas technology
    - Multi-scene projects and collaborative features

3. **Publication System Evolution (0.20.0-alpha)**
    - Advanced project versioning and Chatflow (Spaces) management
    - **Transition to Alpha status** - production-ready stability

## Known Technical Issues & Risks

-   **PlayCanvas click events**: first release will inject a ray‑cast helper script to emulate OnClick in 3‑D scenes.
-   **Flowise hierarchy UX**: no tree view; we currently prefix node names (`Parent:`) and may add a custom outline later.

## React Component Performance Optimization

When working with React components integrated with original Flowise code, follow these optimization patterns:

1. **Avoid API Objects in useEffect Dependencies** - API objects created with hooks like useApi should not be added to useEffect dependencies as this can create cyclical updates.

2. **Use useRef for API Request State Tracking** - When tracking whether API requests have been made, use useRef instead of useState to avoid re-renders:

    ```javascript
    const apiRequestMadeRef = useRef({
        specificRequest: false
    })

    useEffect(() => {
        if (!apiRequestMadeRef.current.specificRequest) {
            apiService.request()
            apiRequestMadeRef.current.specificRequest = true
        }
    }, [necessaryDepsOnly])
    ```

3. **Minimize useEffect Dependencies** - Only include truly necessary dependencies while keeping Unik-related dependencies (e.g. unikId).

## AR.js Publication Architecture

**Publication Flow:** Client-side generation with streaming mode for dynamic UPDL to AR.js HTML conversion

**URL Scheme:** `/p/{uuid}` for published projects with iframe-based rendering for proper script execution

**Key Features:**

-   Browser-based UPDL to A-Frame conversion
-   Local library serving for CDN-blocked regions
-   QR code generation for mobile access
-   Quiz functionality with Data nodes and lead collection

## Critical AR.js Rendering Architecture

### Iframe-Based Rendering (ESSENTIAL)

**Problem**: React's `dangerouslySetInnerHTML` prevents JavaScript execution, breaking AR.js library loading.

**Solution**: Iframe approach for proper script isolation and execution:

```typescript
// ❌ WRONG: Scripts don't execute in React context
;<div dangerouslySetInnerHTML={{ __html: arjsHtml }} />

// ✅ CORRECT: Iframe provides isolated execution context
const iframe = document.createElement('iframe')
iframe.style.width = '100%'
iframe.style.height = '100%'
iframe.style.border = 'none'
container.appendChild(iframe)

const iframeDoc = iframe.contentDocument
iframeDoc.open()
iframeDoc.write(arjsHtml) // AR.js HTML with <script> tags executes properly
iframeDoc.close()
```

**Implementation**: `apps/publish-frt/base/src/pages/public/ARViewPage.tsx`

### Static Library Integration with Main Server

**Architecture**: Main Flowise server serves AR.js libraries directly instead of separate static server.

**Server Configuration** (`packages/server/src/index.ts`):

```typescript
// Serve static assets from publish-frt for AR.js libraries
const publishFrtAssetsPath = path.join(__dirname, '../../../apps/publish-frt/base/dist/assets')
this.app.use('/assets', express.static(publishFrtAssetsPath))
```

**Library Paths**:

-   **A-Frame**: `/assets/libs/aframe/1.7.1/aframe.min.js`
-   **AR.js**: `/assets/libs/arjs/3.4.7/aframe-ar.js`
-   **Source**: `apps/publish-frt/base/dist/assets/libs/` (built via Gulp)

**Benefits**:

-   **Single Server**: No separate static file server needed
-   **CDN Independence**: Solves CDN blocking in restricted regions
-   **Performance**: Direct serving from main Flowise instance
-   **Maintenance**: Libraries bundled with frontend distribution

### User-Selectable Library Sources

**Configuration Flow**:

1. **UI Selection**: User chooses "Official server" (CDN) or "Kiberplano server" (local)
2. **Storage**: Settings saved in Supabase `chatbotConfig.arjs.libraryConfig`
3. **Backend**: `utilBuildUPDLflow` extracts and returns library configuration
4. **Frontend**: `ARJSBuilder` generates appropriate script tags based on user selection
5. **Rendering**: Iframe executes HTML with user-selected library sources

**Path Resolution**:

-   **CDN Sources**: `https://aframe.io/releases/1.7.1/aframe.min.js`
-   **Local Sources**: `/assets/libs/aframe/1.7.1/aframe.min.js` (absolute paths from main server)

**Critical Fix**: Changed relative paths (`./assets/libs/`) to absolute paths (`/assets/libs/`) in `ARJSBuilder.generateCustomLibrarySources()` for proper browser loading.
