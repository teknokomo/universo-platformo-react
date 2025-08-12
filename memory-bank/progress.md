# Progress

**As of 2025-08-12**

## Completed (chronological)

| Release          | Date       | Highlights                                                                                                                    |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0‑pre‑alpha  | 2025‑03‑03 | Initial project scaffold created                                                                                              |
| 0.2.0‑pre‑alpha  | 2025‑03‑11 | Added multi‑user (Supabase) foundation                                                                                        |
| 0.3.0‑pre‑alpha  | 2025‑03‑17 | Basic **Uniks** functionality delivered                                                                                       |
| 0.4.0‑pre‑alpha  | 2025‑03‑25 | Full Uniks feature‑set shipped                                                                                                |
| 0.5.0‑pre‑alpha  | 2025‑03‑30 | Document Store, Templates, complete i18n                                                                                      |
| 0.6.0‑pre‑alpha  | 2025‑04‑06 | Chatbots module, Auth UI, language‑file refactor                                                                              |
| 0.7.0‑pre‑alpha  | 2025‑04‑16 | First AR prototype with **AR.js** marker scene                                                                                |
| 0.8.0‑pre‑alpha  | 2025‑04‑22 | Enhanced Supabase authentication with secure token refresh, Memory Bank documentation structure created                       |
| 0.8.5‑pre‑alpha  | 2025‑04‑29 | UPDL to A-Frame converter implemented, exporter architecture, basic publication flow                                          |
| 0.9.0‑pre‑alpha  | 2025‑05‑12 | Refactored "Publish & Export" interface, separated ARJSPublisher and ARJSExporter components, improved i18n support           |
| 0.10.0‑pre‑alpha | 2025‑05‑08 | Memory bank updates, Publishing/UPDL apps enhancement, authorization improvements                                             |
| 0.11.0‑pre‑alpha | 2025‑05‑15 | Global refactoring Stage 2 results, Gulp task manager, app separation (updl/publish)                                          |
| 0.12.0‑pre‑alpha | 2025‑05‑22 | Removed pre-generation test functionality, UPDL export cleanup                                                                |
| 0.13.0‑pre‑alpha | 2025‑05‑28 | AR.js library location selection, flexible UPDL assembly, multiple objects support                                            |
| 0.14.0‑pre‑alpha | 2025‑06‑04 | AR.js library loading functionality, AR bot code removal, project cleanup                                                     |
| 0.15.0‑pre‑alpha | 2025‑06‑13 | **Flowise 3.0.1 attempted upgrade with rollback** to 2.2.7-patch.1, UPDL scoring system                                       |
| 0.16.0‑pre‑alpha | 2025‑06‑21 | Russian localization fixes, analytics app separation, user profile enhancements                                               |
| 0.17.0‑pre‑alpha | 2025‑06‑25 | Enhanced user profile fields, menu updates, profile-srv workspace package conversion                                          |
| 0.18.0‑pre‑alpha | 2025‑07‑01 | **Flowise 2.2.8 upgrade**, TypeScript compilation fixes, TypeORM conflicts resolution                                         |
| 0.19.0‑pre‑alpha | 2025‑07‑06 | **High-level UPDL nodes**, PlayCanvas integration, template-first architecture, MMOOMM foundation                             |
| 0.20.0‑alpha     | 2025‑07‑13 | **Alpha status achieved**, Tools Revolution, complete UPDL system, PlayCanvas rendering, template system                      |
| 0.21.0‑alpha     | 2025‑07‑20 | **Firm Resolve**, Memory Bank optimization, MMOOMM stabilization, handler refactoring, improved ship controls                 |
| 0.22.0‑alpha     | 2025‑07‑27 | **Global Impulse**, laser mining, inventory consolidation, ship refactor, resource density, docs & memory bank updates        |
| 0.23.0‑alpha     | 2025‑08‑05 | **Vanishing Asteroid**, docs translation updates, UPDL conditional params, MMOOMM fixes (entity scale, trading), custom modes |

## Stage 2 Issues & Lessons Learned

The initial AR.js implementation faced several challenges:

1. **Complex architecture**: The hybrid approach with both client and server generation proved too complex for the initial MVP
2. **Unclear separation**: AR.js and A-Frame technologies were not clearly separated in the codebase
3. **Disconnected components**: UPDL nodes were not properly connected to the publication flow
4. **Build process issues**: Publication worked in development mode but failed in production builds
5. **Localization structure issues**: Improper organization of i18n keys caused display problems in UI components
6. **Unnecessary complexity in UPDL**: Export/publication functionality duplicated logic found in Flowise core

These insights informed our revised approach for Stage 3, leading to the simplified architecture we now have.

## Recent Major Achievements

### ✅ AR.js Wallpaper Mode (Markerless) — Frontend + Server + Docs (2025‑08‑12)

Delivered a markerless AR background option for quizzes:

-   UI: `AR Display Type` (default wallpaper), `Wallpaper type` selector, marker controls hidden when wallpaper; disabled techs visually dimmed
-   Persistence: `arDisplayType`/`wallpaperType` stored in `chatbotConfig.arjs`; publish request passes `renderConfig`
-   Backend: `FlowDataService` extracts `renderConfig`; public endpoint returns it
-   Builder: Markerless generation in `ARJSQuizBuilder` using animated wireframe sphere (rotation `dur: 90000`)
-   Public View: `ARViewPage` reads `renderConfig`, falls back to marker when missing
-   Documentation: Updated app READMEs (EN/RU) and `docs/en|ru/applications/publish/README.md`

### ✅ UPDL Applications Complete Refactoring (Completed)

**MAJOR MILESTONE ACHIEVED**

-   **Removed updl-srv entirely** - Flowise server provides all needed backend functionality
-   **Renamed updl-frt to updl** - Simplified naming without corresponding server app
-   **Cleaned UPDL from export/publication logic** - Streamlined to pure node definitions only
-   **Verified system integrity** - All builds pass, UPDL nodes work correctly

**Final Architecture:**

```
apps/
├── updl/           # Pure UPDL node definitions
├── publish-frt/    # Publication frontend
└── publish-srv/    # Publication backend
```

### Application Structure Refactoring (Completed)

-   **Standardized directory structure** across all applications
-   **Features migration** from miniapps → features in publish-frt
-   **Asset management improvement** with dedicated directories
-   **REST API communication** between applications with type-safe clients
-   **Documentation updates** reflecting current architecture

## Current Status ✅ **ALPHA ACHIEVED**

**Platform Status:** **Alpha v0.21.0** - Production-ready stability achieved (July 2025)

**Core Foundation Completed:**

-   ✅ APPs architecture with 6 working applications
-   ✅ High-level UPDL node system (7 core abstract nodes)
-   ✅ Multi-technology export (AR.js, PlayCanvas)
-   ✅ Template-first architecture with reusable templates
-   ✅ Supabase multi-user authentication with enhanced profiles
-   ✅ Universo MMOOMM foundation for MMO development

**Architecture Principles:**

-   **UPDL** → Universal abstract nodes for cross-platform development
-   **Template System** → Reusable export templates across technologies
-   **Multi-Technology** → AR.js (production), PlayCanvas (ready), extensible architecture
-   **Flowise 2.2.8** → Enhanced platform with TypeScript modernization

## UPDL Architecture Simplification ✅

**Key Changes:**

1. **Eliminated updl-srv** - Flowise server provides all backend functionality
2. **Simplified updl app** - Pure node definitions only, removed export/publication logic
3. **Verified system integrity** - All builds pass, no regressions

**Impact:** Clean separation of concerns, reduced code duplication, simplified maintenance.

# Progress Log

## Latest Achievements

### 2025-08-12: AR.js Wallpaper Mode — MVP Delivered ✅

Markerless background for quizzes implemented and documented (see above). Rolling follow-ups:

-   Add additional wallpaper presets and previews
-   Mobile performance QA; analytics for display type selection

### 2025-08-10: Space Builder MVP (Prompt-to-Flow) — Frontend + Server ✅

Implemented a new Space Builder application pair enabling prompt-to-flow generation on canvas:

-   Frontend: FAB + MUI Dialog, model selector from Credentials, authenticated API client usage, i18n bundle registration, fixed TextField placeholder/label behavior, append/replace modes, and node hydration to ensure anchors/handles.
-   Server: `/api/v1/space-builder/{health,config,generate}` with `ensureAuth` middleware and rate-limit; ModelFactory with OpenAI-compatible clients (Groq via `https://api.groq.com/openai/v1`); provider-specific credential resolution; meta‑prompt → RAW JSON extraction → Zod validation → safe normalization.
-   ENV: Single server `.env` with `SPACE_BUILDER_TEST_MODE` and `GROQ_TEST_API_KEY` (placeholders in `.env.example`).
-   Docs: EN/RU pages added; linked in Applications and SUMMARY; apps READMEs updated.

### 2025-08-11: Space Builder Two-step Quiz Flow, Deterministic Builder, and UI Improvements ✅

Shipped a stable, deterministic prompt-to-flow experience with improved UX and updated docs:

-   Deterministic local builder: final UPDL graph is built from `quizPlan` without LLM, stabilizing output and avoiding hallucinations; predictable node naming and coordinates
-   Layout engine: vertical Space lane with consistent spacing; left offsets for Question and Answer Data nodes with non-overlapping horizontal steps
-   Optional Start/End: new UI options “Collect Names” (Start) and “Show Final Result” (End) enabled by default
-   Input limit: increased `sourceText` limit to 5000 chars (server + UI + i18n + docs)
-   Adaptive dialog: wider, responsive `maxWidth='md'` without horizontal scrollbar; visible spinner on Generate
-   State reset: dialog state fully clears after successful generation
-   Endpoints: `/prepare` (strict Zod `QuizPlan`) and `/generate` (plan-based)
-   Docs: READMEs (apps) and `docs/en|ru/applications/space-builder/` updated to reflect deterministic builder and new options
-   Build: full monorepo build green

### 2025-07-26: Universo MMOOMM Laser Mining System (v0.22.0-alpha development) ✅

**Industrial laser mining system implementation completed** - Major enhancement to Universo MMOOMM template with fully functional laser mining system:

**Core System Implementation:**

-   Replaced projectile-based weapon system with industrial laser mining with auto-targeting
-   Implemented state machine for laser system (idle, targeting, mining, collecting)
-   Added visual red laser beam rendering with PlayCanvas box model
-   Enhanced target detection using `window.app.root.findByTag('asteroid')`
-   3-second mining cycles with automatic resource collection and inventory integration

**Critical Bug Fixes:**

-   Fixed recursive `this.laserSystem.init()` call that caused black screen and system crash
-   Integrated LaserSystemDesign logic properly into ship entity without circular dependencies
-   Replaced complex line mesh rendering with reliable box model for laser beam
-   Fixed update loop to use `app.on('update')` instead of `entity.on('update')` for proper event handling

**Visual System Improvements:**

-   Restored red laser beam visibility with emissive material
-   Fixed `animateLaserOpacity` method to work with box model instead of meshInstances
-   Fixed `updateLaserPosition` to use correct ship entity reference instead of window.playerShip
-   Fixed laser beam detachment issue by removing fade-out animation in `hideLaser()` method
-   Laser beam now disappears instantly when mining completes, preventing visual lag during ship movement

**Game Integration:**

-   Added missing `getItemList()` method to ship inventory to fix HUD update error
-   Integrated with existing inventory system with cargo hold validation
-   Added real-time HUD indicators for laser status and mining progress
-   Added debug logging to `updateMining` for progress tracking
-   Implemented debug mode with visual range indicators

### 2025-01-29: High-Level UPDL Node Refactoring Complete ✅

**Major UPDL system enhancement** - Completed comprehensive refactoring of all 7 core abstract nodes with significant architectural improvements:

**Connector Logic Fixed:**

-   Input Connectors: Implemented correct connection logic with proper type definitions
-   Output Connectors: Fixed critical bug by using Flowise default behavior (empty outputs array)

**Architecture Unified:**

-   BaseUPDLNode.ts: Extracted connector types into CONNECTABLE_TYPES constant
-   ActionNode.ts: Redesigned with internal configuration fields instead of input connectors
-   UniversoNode.ts: Simplified by removing all input connectors

**Visual Identity Enhanced:**

-   All 7 core nodes received unique SVG icons (Space: 3D cube, Entity: person silhouette, Component: modular block, Event: lightning bolt, Action: gear, Data: database cylinder, Universo: globe with network lines)
-   Improved visual navigation and user experience

**System Benefits:**

-   All nodes connect correctly and logically on canvas
-   Simplified Action node configuration
-   Enhanced code maintainability through type centralization
-   Ready for PlayCanvas export template development

### 2025-01-27: MMOOMM Template Ship Movement & Console Optimization ✅

**PlayCanvas MMOOMM template stabilized** - Fixed critical ship movement issues and optimized console logging for local development. Implemented physics body initialization with direct movement fallback, eliminated repetitive error message spam, and optimized WebSocket connection logging. Ship now responds smoothly to WASD+QZ controls with clean console output and transparent fallback system.

### 2025-01-27: Template-First Architecture Refactoring ✅

**Publication system architecture modernized** - Successfully migrated from technology-first structure to template-first structure in `publish-frt` application. Changed from `builders/arjs/` and `builders/playcanvas/` to `builders/templates/quiz/arjs/` and `builders/templates/mmoomm/playcanvas/` for improved template reusability. Fixed all import paths, achieved zero TypeScript errors, and updated documentation with synchronized README files (506 lines each).

### 2025-01-27: Flowise 2.2.8 Platform Upgrade ✅

**Platform modernization completed** - Upgraded from 2.2.7-patch.1 to 2.2.8 with enhanced ASSISTANT type support, improved TypeScript compatibility, and preserved user isolation. Zero data loss, all builds successful.

### 2025-06-24: Profile-SRV Workspace Package Conversion ✅

**Workspace package architecture implemented** - Converted apps/profile-srv to scoped package `@universo/profile-srv` with clean imports, eliminated complex relative paths, prepared for future plugin architecture.

### 2025-01-26: Universal UPDL Data Extraction Fix ✅

**Multi-object spaces enhancement** - Fixed buildUPDLSpaceFromNodes data extraction with corrected field mapping, position handling, and color format. Maintained architectural separation between universal UPDL and AR.js-specific logic.

### 2024-12-19: Documentation QA & Code Cleanup ✅

**Documentation verification completed** - Corrected app structure documentation, clarified interface architecture (UPDLInterfaces.ts vs Interface.UPDL.ts), verified directory structures.

**Code refactoring completed** - Cleaned ARJSPublishApi.ts and ARJSPublisher.jsx, removed redundant code while preserving demo functionality and streaming pipeline.

### 2025-06-30: Template-Based Export Architecture & Documentation Sync ✅

**Major refactor finalized** - Implemented fully modular template architecture (`AbstractTemplateBuilder`, `TemplateRegistry`, updated `ARJSBuilder`). Added `ARJSQuizBuilder` as first concrete template. English and Russian READMEs synchronized line-by-line.

### 2025-07-20: Release 0.21.0-alpha "Firm Resolve" ✅

**Major platform improvements** - Released version 0.21.0-alpha with significant enhancements to memory bank system, MMOOMM template stabilization, and handler architecture refactoring:

**Memory Bank System Optimization:**

-   Comprehensive refactoring of all memory bank files to comply with new guidelines
-   Improved file structure with clear separation of concerns and cross-references
-   Enhanced maintainability and AI context understanding

**MMOOMM Template Stabilization:**

-   Fixed ship movement and logging issues in PlayCanvas MMOOMM template
-   Improved ship controls with better physics handling
-   Optimized console output for cleaner development experience

**Handler Architecture Refactoring:**

-   Refactored ComponentHandler into modular files for better organization
-   Restructured EntityHandler logic modules for improved maintainability
-   Updated Quiz Template Handlers structure for consistency
-   Enhanced handler exports for refactored directory structure

**Documentation Updates:**

-   Updated publish-frt documentation for new handler folder structure
-   Maintained comprehensive technical documentation across all changes

**System Benefits:**

-   Improved code organization and maintainability
-   Enhanced developer experience with cleaner console output
-   Better separation of concerns in handler architecture
-   Preserved all existing functionality while improving structure

## Future Roadmap

### **Next: Post-Alpha Development (v0.22.0+)**

**Advanced UPDL Features:**

-   Physics Node: Implement physics simulation node for complex interactions
-   Animation System: Add keyframe animation node for dynamic content
-   Networking Node: Implement multiplayer networking capabilities
-   Advanced Scene Management: Multi-scene UPDL projects with complex interactions

**Universo MMOOMM Expansion:**

-   Full MMO development pipeline with multiplayer features
-   Advanced game mechanics and territorial control systems
-   Integration with Kiberplano for real-world implementation

**Production Deployment:**

-   Enterprise-grade hosting and scaling solutions
-   Performance optimization and monitoring systems
-   Security enhancements for production environments

**Community Features:**

-   Template sharing and collaboration marketplace
-   Real-time collaborative editing capabilities
-   Community-driven template and component library

## Recently Completed Enhancements

### 2025-08-07: Uniks Functionality Extraction and Build System Fixes

Successfully extracted Uniks (workspace) functionality from monolithic codebase into dedicated packages `@universo/uniks-srv` and `@universo/uniks-frt`, resolving critical build system issues. Implemented modular architecture with clean separation of concerns, eliminated circular dependencies, fixed TypeScript compilation issues, and corrected internationalization configuration. All packages build successfully with improved maintainability and scalability. See [archive entry](../docs/archive/enhancements/2025-08/uniks-functionality-extraction.md) for complete documentation.

### 2025-08-06: MMOOMM Entity Hardcode Elimination Fix

Successfully eliminated all hardcoded transform values in MMOOMM Entity types that were overriding UPDL settings from Chatflow. Fixed JavaScript variable scope conflicts and preserved all game functionality. See [archive entry](../docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md) for complete documentation.
