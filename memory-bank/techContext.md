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

Original project that serves as the foundation. Version 2.2.7‑patch.1 (will be updated in the future).

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

The project is transitioning to a modular APPs architecture that separates functionality into distinct applications while minimizing changes to the core Flowise codebase.

### Current Directory Structure (Post-QA Verification)

```
universo-platformo-react/
├── packages/                  # Original Flowise packages
│   ├── components/            # Components and utilities
│   ├── server/                # Server-side code
│   │   └── src/
│   │       └── Interface.UPDL.ts  # Simplified UPDL interfaces for integration
│   └── ui/                    # Frontend
├── apps/                      # New APPs architecture
│   ├── updl/                  # UPDL node system (renamed from updl-frt)
│   │   └── base/              # Core UPDL functionality
│   │       ├── src/
│   │       │   ├── nodes/     # UPDL node definitions
│   │       │   │   ├── base/  # Base node classes
│   │       │   │   ├── space/ # Space nodes (formerly scene)
│   │       │   │   ├── object/# Object nodes
│   │       │   │   ├── camera/# Camera nodes
│   │       │   │   └── light/ # Light nodes
│   │       │   ├── assets/    # Static resources (icons, images)
│   │       │   ├── i18n/      # Internationalization
│   │       │   ├── interfaces/# Complete UPDL ecosystem definitions
│   │       │   │   └── UPDLInterfaces.ts # Full UPDL specification
│   │       │   └── index.ts   # Entry point for node definitions
│   │       ├── dist/          # Compiled output
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── gulpfile.ts    # Asset copying during build
│   ├── publish-frt/           # Publication system frontend
│   │   └── base/
│   │       ├── src/
│   │       │   ├── api/       # HTTP clients to backend
│   │       │   ├── assets/    # Static resources
│   │       │   ├── components/# UI components
│   │       │   ├── features/  # Technology-specific handlers
│   │       │   │   └── arjs/  # AR.js publication handler
│   │       │   ├── i18n/      # Localization
│   │       │   ├── pages/     # Page components
│   │       │   ├── services/  # Service layer for backend communication
│   │       │   ├── utils/     # Utilities (UPDLToARJSConverter)
│   │       │   └── index.ts   # Entry point
│   │       ├── dist/          # Compiled output
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── gulpfile.ts    # Asset copying during build
│   └── publish-srv/           # Publication system backend
│       └── base/
│           ├── src/
│           │   ├── controllers/# Express controllers
│           │   ├── routes/    # API routes
│           │   ├── utils/     # Helper functions
│           │   └── index.ts   # Entry point
│           ├── dist/          # Compiled output
│           ├── package.json
│           └── tsconfig.json
```

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

## UPDL Implementation Details

### Core Node Components

1. **BaseUPDLNode**:

    - Abstract base class for all UPDL nodes
    - Implements common functionality and interfaces
    - Handles input/output port definitions
    - Provides serialization/deserialization methods

2. **Scene Node**:

    - Root node for UPDL scene graph
    - Contains global scene settings
    - Manages environment and rendering options
    - Can contain camera, lights, and objects

3. **Object Node**:

    - Represents 3D objects in the scene
    - Supports primitives (cube, sphere, etc.)
    - Handles 3D model loading
    - Manages materials and textures
    - Can contain child objects

4. **Camera Node**:

    - Defines view parameters
    - Supports perspective and orthographic modes
    - Configures AR/VR specific settings
    - Can be attached to scene or objects

5. **Light Node**:

    - Implements various light types
    - Configures intensity, color, range
    - Handles shadows and other effects
    - Can be global or attached to objects

6. **Interaction Node**:

    - Processes user input events
    - Handles click/touch interactions
    - Triggers actions based on input
    - Configures raycasting for 3D object selection

7. **Controller Node**:

    - Manages object behaviors
    - Implements rotation, orbit, movement patterns
    - Processes input to control objects
    - Links input events to animation triggers

8. **Animation Node**:
    - Controls property animations
    - Manages timing and sequencing
    - Supports looping and easing
    - Handles playback control (play/pause/stop)

### Export Process

1. **Data Flow**:

    - Flowise serializes UPDL node graph to JSON
    - Export handler deserializes to UPDL objects
    - Platform-specific exporter generates code
    - Publication server saves and serves generated files

2. **Default Value Handling**:

    - Missing required components (camera, lights) are auto-created
    - Platform-specific optimizations are applied
    - Default values are used for missing properties
    - Warnings are generated for unsupported features

3. **Technology-Specific Export**:
    - AR.js: Generates HTML with A-Frame tags and AR.js scripts
    - PlayCanvas React: Creates JSX component hierarchy
    - Babylon.js: Generates JavaScript using Babylon APIs
    - Three.js: Creates core Three.js scene setup
    - A-Frame VR: Produces A-Frame HTML for VR experiences
    - PlayCanvas Engine: Outputs JavaScript using native PC APIs

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

## Current Implementation Focus (Apr 2025, v0.1)

These items track the hands‑on technical work that is actively in progress:

1. **Custom UPDL nodes in Flowise**

    - Add the first nodes: _Scene, Object, Camera, Light, OnClick, Animation, Spin Controller_.
    - Modify `packages/editor` (because no plugin system) to register the nodes (likely under a new "UPDL" category in the node palette).
    - Verify serialization/deserialization of the graph on save.

2. **AR.js / A‑Frame Exporter**

    - HTML template generator ("checkerboard + Hiro marker → 3D model").
    - Insert properties from UPDL JSON instead of hard‑coded values.
    - Emit events (_OnClick_ → A‑Frame listener).
    - Sprint goal: CLI command `npm run export:ar`.

3. **`apps/updl` Core Module**

    - Node types in `src/nodes`, `Exporter` interface in `src/exporters`.
    - Library must be consumed by both the editor and the publish backend.
    - Create a unit test: load sample JSON → run each exporter → validate HTML.

4. **CI / Turborepo**
    - Add pipelines `build:updl` and `build:publish`.
    - ESLint and unit tests must pass before merge requests.

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

## AR.js Publication Architecture (Stage 3)

The AR.js publication architecture has been revised for Stage 3 to focus on a simplified "Streaming" approach. This approach moves the generation of AR.js HTML to the client-side, reducing server complexity and improving the development workflow.

### Publication Modes

1. **Streaming Mode** (Priority Implementation):

    - Client-side generation of AR.js HTML
    - Dynamic conversion of UPDL data to AR.js scene
    - Progressive loading with status indicators
    - URL format: `/p/{uuid}`

2. **Pre-generation Mode** (Future Implementation):
    - Server-side generation and storage of HTML
    - Pre-processing of resources and optimizations
    - Faster initial loading for end users
    - Same URL format: `/p/{uuid}`

### Technical Implementation

#### Client-Side Generation Flow

```
┌─────────────┐     ┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  User loads │     │ Server sends │     │ Browser runs  │     │ AR.js scene  │
│  /p/{uuid}  │────▶│  UPDL data   │────▶│  conversion   │────▶│  displayed   │
└─────────────┘     └─────────────┘     └───────────────┘     └──────────────┘
                                              │
                                              ▼
                                        ┌──────────────┐
                                        │ Progress bar │
                                        │   updates    │
                                        └──────────────┘
```

#### Key Components

1. **Publication Interface**:

    - Added "Generation Type" field to select between modes
    - Simplified tabs for Streaming mode (Settings, Published)
    - Form to configure AR.js-specific settings

2. **Client-Side Converter**:

    - `apps/publish/base/miniapps/arjs/ARJSExporter.ts` optimized for browser
    - `UPDLToARJSConverter` converts UPDL scene to A-Frame model
    - `ARJSHTMLGenerator` creates final HTML with markers

3. **Server-Side Components**:

    - Endpoint to retrieve UPDL node data: `/api/updl/scene/{id}`
    - URL handler for publications: `/p/{uuid}`
    - Publication metadata storage

4. **Publication Process**:
    - User configures publication settings in UI
    - System saves publication metadata and generates URL
    - When URL is accessed, client fetches UPDL data
    - Browser converts data to AR.js HTML
    - AR.js scene loads and requests camera access

### Browser Compatibility Considerations

-   Modern browsers with WebXR support recommended
-   Fallback for older browsers with warnings
-   Mobile device optimizations for AR viewing
-   Emphasis on Android Chrome and iOS Safari compatibility

### Security Considerations

-   CORS settings to allow resource loading
-   CSP adjustments for AR.js and A-Frame scripts
-   User permission handling for camera access
-   Content validation for user-generated UPDL scenes

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

1. **UI Selection**: User chooses "Официальный сервер" (CDN) or "Сервер Kiberplano" (local)
2. **Storage**: Settings saved in Supabase `chatbotConfig.arjs.libraryConfig`
3. **Backend**: `utilBuildUPDLflow` extracts and returns library configuration
4. **Frontend**: `ARJSBuilder` generates appropriate script tags based on user selection
5. **Rendering**: Iframe executes HTML with user-selected library sources

**Path Resolution**:

-   **CDN Sources**: `https://aframe.io/releases/1.7.1/aframe.min.js`
-   **Local Sources**: `/assets/libs/aframe/1.7.1/aframe.min.js` (absolute paths from main server)

**Critical Fix**: Changed relative paths (`./assets/libs/`) to absolute paths (`/assets/libs/`) in `ARJSBuilder.generateCustomLibrarySources()` for proper browser loading.
