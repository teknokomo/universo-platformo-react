# Universo MMOOMM Implementation Tasks Registry

This document is a step-by-step registry of tasks for creating a fully functional multiplayer Universo MMOOMM project. It records stages, tasks, and their brief explanations. As of the current version, "Stage 1" and "Stage 2" are detailed — improving current platform functionality and preparing base packages.

## Stage 1. Improving Current Functionality and Creating Common Platform Features

-   **Redesign Authentication System (Supabase, preparation for Passport.js)**

    Task: stabilize multi-user authentication, fix token handling and refresh, consistently pass authentication to frontend/backend and exported applications. Create `packages/auth-frt` and `packages/auth-srv` applications.

    Details:

    -   In `packages/auth-srv` implement abstraction layer over Supabase Auth (access/refresh validation, rotation, webhook events), provide adapter for future Passport.js integration.
    -   In `packages/auth-frt` — UI components for login/registration/token refresh, Supabase SDK integration, token storage/refresh, request interceptors.
    -   Update authentication integration in `packages/publish-frt`, `packages/template-engine-srv` (PlayCanvas export), `packages/multiplayer-colyseus-srv` (JWT in join parameters).

-   **Metaverses: frontend and server, Unik/Space relationships and roles**

    Task: create `packages/metaverse-frt` and `packages/metaverse-srv` as base applications for metaverse domain. Provide meta↔meta relationship models (child/partner), metaverse catalog, and Unik/Space integration.

    Details:

    -   In `metaverse-srv`: schemas `metaverse.metaverses`, `metaverse.links`, basic REST (`/metaverses`, `/metaverses/:id/links`, `/overview`).
    -   In `metaverse-frt`: metaverse management interfaces, relationship overview, Unik/Space connection.
    -   Define architecturally: Unik as parallel catalog (not child meta), meta — world catalog (shared and personal). Clarify in documentation and API the "meta ↔ unik ↔ space" relationships.

-   **Multi-canvas UPDL Architecture: Space↔Space/Unik/Metaverse Links**

    Task: enable logic distribution across multiple canvases and link them.

    Details:

    -   In `packages/updl/` and/or `packages/updl/imp/*` add link nodes: `SpaceLink` (external Chatflow/Space reference), `UnikLink` (Space set connection from Unik), `MetaverseLink` (complete world connection).
    -   Implement dependent graph loading by reference (with version control), canvas link port display, cycle validation.
    -   Documentation: update `universo-platformo/updl-nodes/*` and `applications/metaverse/*` for new link architecture.

-   **Space Generation (auto-assembly by description), Agent v2 concept migration (Flowise 3.x)**

    Task: add "Generate Logic" button/panel to Space, chat for task specification and UPDL graph auto-generation.

    Details:

    -   Import Agent v2 concept (Flowise 3.x) into `packages/updl` → single constructor (without Chatflow/Agentflow separation): prompt → node/link synthesis.
    -   Save graph drafts/versions, rollback, version comparison.

-   **Chatbot Publishing: extract embed to separate application**

    Task: fix chatbot publishing on server (remove localhost dependency).

    Details:

    -   Create `packages/chatbot-embed-srv` for serving chatbot embeds independently.
    -   Update `packages/publish-frt` to use dedicated embed service.
    -   Implement proper CORS and security for embedded chatbots.

-   **Template Engine Server: pre-generation mode**

    Task: add pre-generation mode for applications instead of streaming generation in browser. On publication request, `template-engine-srv` generates target project (e.g., PlayCanvas) on server, saves artifacts to storage (S3 or local), and serves ready-built bundle to users.

    Details:

    -   Implement server-side template processing in `packages/template-engine-srv`.
    -   Add artifact storage system (S3/local filesystem).
    -   Create build queue and status tracking.
    -   Update `packages/publish-frt` to support both streaming and pre-generation modes.

## Stage 2. Base Package Creation and Modularization

-   **✅ COMPLETED: Create Shared Types Package (`@universo-platformo/types`)**

    Task: extract all shared TypeScript interfaces and types into a dedicated package.

    Status: ✅ Completed
    - Created `packages/universo-types/` with dual build system
    - Migrated all UPDL interfaces and platform types
    - Updated all consuming packages to use shared types

-   **✅ COMPLETED: Create Shared Utils Package (`@universo-platformo/utils`)**

    Task: extract common utilities, especially UPDLProcessor, into a shared package.

    Status: ✅ Completed
    - Created `packages/universo-utils/` with UPDLProcessor
    - Implemented dual build system (CJS + ESM + Types)
    - Migrated UPDLProcessor from local implementations

-   **✅ COMPLETED: Extract Quiz Template Package (`@universo/template-quiz`)**

    Task: move AR.js quiz functionality to a dedicated template package.

    Status: ✅ Completed
    - Created `packages/template-quiz/` with complete AR.js quiz implementation
    - Implemented modular handler system (DataHandler, ObjectHandler)
    - Integrated with TemplateRegistry system

-   **✅ COMPLETED: Extract MMOOMM Template Package (`@universo/template-mmoomm`)**

    Task: move PlayCanvas MMOOMM functionality to a dedicated template package.

    Status: ✅ Completed
    - Created `packages/template-mmoomm/` with complete PlayCanvas implementation
    - Implemented entity system, physics, and multiplayer support
    - Fixed ship duplication issues in multi-scene processing

-   **Create Profile Package (`@universo/profile`)**

    Task: extract profile management functionality into a dedicated package.

    Details:

    -   Move profile-related components from `packages/profile-frt` to shared package.
    -   Create reusable profile widgets and forms.
    -   Implement profile data synchronization utilities.

-   **Create Workspace Package (`@universo/workspace`)**

    Task: extract workspace/Unik management functionality.

    Details:

    -   Move workspace components from `packages/uniks-frt` to shared package.
    -   Create reusable workspace management widgets.
    -   Implement workspace collaboration utilities.

## Stage 3. Advanced Features and Optimization

-   **Real-time Collaboration System**

    Task: implement real-time collaborative editing for UPDL graphs.

    Details:

    -   Add WebSocket support to `packages/updl/`.
    -   Implement operational transformation for concurrent editing.
    -   Add user presence indicators and conflict resolution.

-   **Advanced Template System**

    Task: create template marketplace and custom template support.

    Details:

    -   Implement template discovery and installation system.
    -   Add template versioning and dependency management.
    -   Create template development SDK and documentation.

-   **Performance Optimization**

    Task: optimize platform performance for large-scale deployments.

    Details:

    -   Implement lazy loading for UPDL nodes and components.
    -   Add caching layers for frequently accessed data.
    -   Optimize database queries and API responses.

-   **Mobile Support**

    Task: add mobile support for key platform features.

    Details:

    -   Create responsive designs for mobile devices.
    -   Implement touch-friendly UPDL editor.
    -   Add mobile-specific templates and features.

## Stage 4. Enterprise Features

-   **Multi-tenant Architecture**

    Task: implement multi-tenant support for enterprise deployments.

    Details:

    -   Add tenant isolation at database and application levels.
    -   Implement tenant-specific customization options.
    -   Add enterprise authentication integration (SAML, LDAP).

-   **Analytics and Monitoring**

    Task: add comprehensive analytics and monitoring.

    Details:

    -   Implement usage analytics for spaces and templates.
    -   Add performance monitoring and alerting.
    -   Create admin dashboards for system oversight.

-   **API Gateway and Rate Limiting**

    Task: implement API gateway with rate limiting and security.

    Details:

    -   Add API gateway for request routing and transformation.
    -   Implement rate limiting and quota management.
    -   Add API security and threat protection.

## Implementation Notes

### Completed Achievements

1. **Modular Architecture**: Successfully extracted core functionality into shared packages
2. **Template System**: Implemented flexible template registry with dynamic loading
3. **Type Safety**: Established consistent type system across all packages
4. **Build System**: Standardized dual build system for maximum compatibility
5. **Documentation**: Created comprehensive documentation for shared packages

### Current Focus Areas

1. **Authentication System**: Stabilizing multi-user authentication
2. **Metaverse Integration**: Building metaverse management capabilities
3. **Template Engine**: Adding server-side pre-generation
4. **Performance**: Optimizing for production deployments

### Next Priorities

1. Complete authentication system redesign
2. Implement metaverse frontend and backend
3. Add multi-canvas UPDL architecture
4. Create template marketplace foundation

This registry serves as a living document that tracks the evolution of the Universo MMOOMM platform from its current state to a fully-featured metaverse creation platform.
