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

## Platform Foundation

**Flowise AI 2.2.8** - Enhanced platform with ASSISTANT support (upgraded 2025-07-01)
**Supabase Integration** - Multi-user functionality with Postgres-only database support

### Authentication Architecture

**Secure Supabase JWT authentication** with multi-user support:

-   **Server-side**: JWT validation, secure token handling, HTTP-only cookies
-   **Frontend**: React context with automatic token refresh
-   **Security**: No exposed keys, backend-only Supabase operations
-   **Environment**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

## APPs Architecture (v0.20.0-alpha)

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

## UPDL Core System (v0.20.0-alpha)

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

## Current Development Status (v0.20.0-alpha)

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
