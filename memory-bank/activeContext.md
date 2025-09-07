# Current Active Context

## Current Project Status

**Status**: **Alpha Achieved (v0.21.0-alpha, July 2025)** - Production-ready platform with complete UPDL system

**Platform Maturity**: Alpha-grade stability with 6 working applications and complete high-level UPDL node system

## Current Focus

**Template Package Modularization Complete** - Successfully completed major architectural refactoring:

-   **✅ Shared Packages Created**: Extracted common functionality into `@universo-platformo/types` and `@universo-platformo/utils`
-   **✅ Template Packages Extracted**: Moved AR.js Quiz and PlayCanvas MMOOMM functionality to dedicated packages
-   **✅ Documentation Updated**: Created comprehensive documentation for shared packages and template system
-   **✅ Build System Standardized**: Implemented dual build system (CJS + ESM + Types) across all packages
-   **✅ Bug Fixes**: Resolved ship duplication in MMOOMM and reduced excessive logging in AR.js Quiz

**Post-Alpha Development** - Expanding advanced UPDL features and Universo MMOOMM capabilities:

-   **AR.js Wallpaper Mode (markerless) shipped** — verify UX and extend options
-   **Advanced UPDL Node Types**: Physics, Animation, Networking nodes for complex interactions
-   **Universo MMOOMM Expansion**: Full MMO development pipeline with PlayCanvas
-   **Production Deployment**: Enterprise-grade hosting and scaling solutions
-   **Community Features**: Template sharing and collaborative development tools
-   **Space Builder Test Mode Stabilization**: finalize multi‑provider Test mode (OpenAI‑compatible), enforce credentials disable on UI/server, deduplicate model list, and keep docs in sync
-   **Metaverse Module**: MVP implemented; follow-ups pending (membership & links UI, docs)

## Current Focus — Build Order, i18n Unification, Finance Apps (2025-08-31)

-   Fixed cold-start build issues by enforcing topological order via workspace dependencies: `flowise-ui` now depends on `@universo/template-quiz`, `@universo/template-mmoomm`, and `publish-frt`. This guarantees template packages build before UI.
-   Removed a hidden circular dependency: deleted `flowise-ui` from `apps/finance-frt/base/package.json` to avoid UI↔finance-frt coupling.
-   Standardized template i18n to TypeScript:
    -   Replaced `apps/template-quiz/base/src/i18n/index.js` with `index.ts` (compiled to ESM/CJS).
    -   Replaced `apps/template-mmoomm/base/src/i18n/index.js` with `index.ts`.
    -   Migrated `apps/publish-frt/base/src/i18n/index.js(.d.ts)` to `index.ts` for consistency.
-   Ensured template packages export valid `exports` map to `dist/esm` and `dist/cjs` with `dist/types` and that `publish-frt` tsconfig consumes `index.d.ts` from template `dist`.
-   Integrated Finance apps into server and UI (as Uniks children):
    -   Server mounts `createFinanceRouter()` under `/api/v1/uniks/:unikId/finance/*` and registers `financeEntities` and `financeMigrations`.
    -   UI adds routes `finance/accounts` and `finance/currencies` under Unik workspace and loads `finance` i18n namespace.

Immediate next steps:
-   Write and connect docs for Finance apps (EN/RU), and guidelines for creating new apps/packages (EN/RU).
-   Add missing docs to SUMMARY (e.g., tasks-registry in RU/EN roadmaps).

## Recently Completed

-   **Template Package Modularization (2025-08-30)**

    -   **Created Shared Packages**: Extracted `@universo-platformo/types` and `@universo-platformo/utils` with complete UPDL interfaces and UPDLProcessor
    -   **Template Package Extraction**: Moved AR.js Quiz to `@universo/template-quiz` and PlayCanvas MMOOMM to `@universo/template-mmoomm`
    -   **Template Registry System**: Implemented dynamic template loading with TemplateRegistry for modular architecture
    -   **Documentation Overhaul**: Created comprehensive English and Russian documentation for shared packages and template system
    -   **Build System Standardization**: Implemented dual build system (CJS + ESM + Types) across all new packages
    -   **Bug Fixes**: Resolved ship duplication in MMOOMM multi-scene processing and reduced excessive logging in AR.js Quiz
    -   **Code Cleanup**: Removed build artifacts from source directories and standardized package structure

-   **Multiplayer Colyseus Server Implementation (2025-08-22)**

    -   **Created `@universo/multiplayer-colyseus-srv`**: Complete Colyseus-based multiplayer server package for Universo MMOOMM space gameplay
    -   **Full Multiplayer Architecture**: Implemented MMOOMMRoom with 16-player capacity, real-time state synchronization, and server-authoritative gameplay
    -   **Schema System**: Created comprehensive Colyseus schemas (PlayerSchema, EntitySchema, MMOOMMRoomState) for type-safe multiplayer synchronization
    -   **Game Mechanics**: Implemented mining, trading, movement validation, and entity management (asteroids, stations, gates)
    -   **Integration Layer**: Created MultiplayerManager for seamless integration with main Flowise server
    -   **UPDL Integration**: Enhanced entity processing to handle UPDL Flow objects in multiplayer mode
    -   **Production Ready**: Complete TypeScript implementation with proper error handling, logging, and graceful shutdown

-   **MMOOMM Template Extraction and Refactoring (2025-08-22)**

    -   **Refactored `publish-frt`:** Extracted the core MMOOMM template generation logic from the `publish-frt` application into a dedicated workspace package.
    -   **Created `@universo/template-mmoomm`:** A new, reusable workspace package was created at `apps/template-mmoomm/base` to house the extracted logic. This package is designed as a self-contained, shareable library with a dual CJS/ESM build system.
    -   **Updated `publish-frt` Dependencies:** The `publish-frt` application now includes `@universo/template-mmoomm` as a dependency, acting as a consumer of the new template package.
    -   **Architectural Improvement:** This change significantly improves modularity and architectural clarity by separating the generic publication UI from the specific 3D template implementation, promoting code reuse and easier maintenance.
    -   **Package Structure:** The template package includes PlayCanvas builders, handlers, multiplayer support, generators, and utilities with proper TypeScript exports.
    -   **Integration Complete:** `publish-frt` now imports and uses the template package for MMOOMM functionality while maintaining backward compatibility.

-   **Core Types Package `@universo-platformo/types` + Docs i18n Sync (2025-08-14)**

    -   Created workspace package at `apps/universo-platformo-types/base` with ECS domain types (Transform, Health, Visual), networking DTOs (Intent, Ack, Snapshot, Delta, EventPacket), error codes, and protocol version
    -   Build and lint green; exports from `src/index.ts` to `dist/`
    -   Added `README.md` and `README-RU.md` (line-by-line synchronized)
    -   Updated `docs/en|ru/roadmap/implementation-plan/phase-2-core.md` (synchronized) and RU tasks registry to mark the item as completed

-   **Core Utils Package `@universo-platformo/utils` + Docs i18n + Backend Integration (2025-08-14)**

    -   Created workspace package at `apps/universo-platformo-utils/base` with modules: validation (Zod DTO schemas), delta (compute/apply), serialization (stableStringify, safeParseJson, hashFNV1a32), net (time sync, seq/ack), updl (passthrough schemas)
    -   Integrated in `@universo/publish-srv`: replaced unsafe `JSON.parse` with `serialization.safeParseJson` in `FlowDataService`; ensured build via workspace alias
    -   Documentation added and linked: `docs/en|ru/universo-platformo/utils/README.md`; package READMEs `README.md` and `README-RU.md` created under `apps/universo-platformo-utils/base`
    -   Full workspace build successful; types package exports path normalized earlier to `dist/index.*`

-   **AR.js Wallpaper Mode (Markerless) — Frontend + Server + Docs (2025-08-12)**
    -   UI: Added `AR Display Type` (default: wallpaper), wallpaper type selector, conditional instructions; dimmed non-working tech options (Babylon.js, A‑Frame)
    -   Persistence: Save `arDisplayType` and `wallpaperType` into `chatbotConfig.arjs`; publish request includes `renderConfig`
    -   Backend: `FlowDataService` extracts `renderConfig`; public endpoint returns it
    -   Builder: Markerless scene in `ARJSQuizBuilder` with animated wireframe sphere (rotation dur 90000)
    -   Public View: `ARViewPage` reads `renderConfig` and builds accordingly with legacy fallbacks
    -   Docs: Updated app READMEs and `docs/en|ru/applications/publish/README.md`
-   **Space Builder MVP (Prompt-to-Flow, Frontend + Server)**: Implemented an end-to-end generator to create UPDL flows from a natural-language prompt on the canvas. Frontend: FAB + MUI Dialog with model selector (from Credentials), authenticated calls, i18n bundle, placeholder/label fixes, append/replace modes, and hydration of nodes for anchors/handles. Server: `/api/v1/space-builder/{health,config,generate}` with `ensureAuth` and rate-limit, provider ModelFactory (OpenAI-compatible including Groq via `https://api.groq.com/openai/v1`), credential resolution by `credentialId`, meta-prompt → RAW JSON extraction → Zod validation → safe normalization. Environment: single server `.env` with `SPACE_BUILDER_TEST_MODE` and `GROQ_TEST_API_KEY`. Documentation: EN/RU pages added and linked in Applications and SUMMARY.
-   **Space Builder UI Refinement — 3‑step flow + Model Settings + UX/a11y fixes (2025-08-13)**

    -   Moved model selection into a gear‑button modal (bottom‑left of dialog actions)
    -   Added third step `settings`; moved checkboxes (Append, Collect names, Show final score) there; disabled "Generate graphics"
    -   Improved main input field: doubled height (rows=16), correct Material UI label behavior, consistent padding in DialogActions
    -   Added Tooltip to gear button; square button style for consistency; info banner in Test mode
    -   i18n: added keys (configure/settings/model settings/save/testModeInfo) EN/RU
    -   Updated docs: app READMEs already 3‑step; synchronized `docs/en|ru/applications/space-builder/README.md` to 3‑step flow
    -   Full monorepo build green

-   **Space Builder – Constraints & Iterative Quiz Editing (2025-08-13)**

### 2025-09-07: Spaces + Canvases Refactor (Phase 1–2) ✅

- Guarded legacy Chatflow effects in Canvas when `spaceId` exists to prevent races and stale overwrites; Active Canvas is always hydrated from Spaces/Canvases.
- Canvas Tabs UX improvements: subtle border on inactive tabs, 3px lift from bottom edge, spinner moved to the left of the label with contrasting color on an active tab; “Create Canvas” button placed immediately after tabs, smaller and with subdued colors.
- Introduced local Axios client in `apps/spaces-frt/src/api/client.js` with JWT + refresh; switched `spaces.js` and `canvases.js` to use it.
- Localized hooks in `apps/spaces-frt`: added `src/hooks/useApi.js` and copied/adapted `src/hooks/useCanvases.js` (detached from Flowise UI).
- UI routing: `packages/ui/src/routes/MainRoutes.jsx` now loads the Spaces list from `apps/spaces-frt`; Canvas routes restored under MinimalLayout via `apps/spaces-frt/base/src/entry/CanvasRoutes.jsx` and wired in `packages/ui/src/routes/index.jsx` — no left menu on Canvas pages.
- Removed unused Flowise UI code: `packages/ui/src/components/*`, `packages/ui/src/views/spaces`, `packages/ui/src/api/{canvases,spaces}.js`, `packages/ui/src/hooks/useCanvases.js`.
- Fixed Vite alias issues by converting remaining `@/...` imports in spaces‑frt to relative local paths (CanvasTabs, useApi, useCanvases, spacesApi).

    -   Backend: `/prepare` now accepts `additionalConditions` (0..500); added `/revise` endpoint with strict JSON‑only prompt and minimal‑change guarantee; invariant checks keep question/answer counts and one correct per question
    -   Frontend: added "Additional conditions" on Prepare; read‑only quiz preview; "What to change?" with iterative apply; field clears on successful change and when going Back + Prepare
    -   Docs: Updated EN/RU docs in `docs/en|ru/applications/space-builder/README.md` and packages `apps/space-builder-frt`/`apps/space-builder-srv` READMEs
    -   Build: Full workspace build green

-   **Space Builder – Creation Mode, Safer Append, and Docs (2025-08-13)**

    -   UI: Added "Creation mode" Select with three options; default set to "Create a new space"; options order updated (New Space → Clear → Append)
    -   Canvas: Implemented safe Append placement below the lowest existing nodes using measured node height when available (fallback default) and a larger vertical margin; preserved ID remap; wired `newSpace` mode via existing `duplicatedFlowData` handoff
    -   i18n: Added EN/RU keys for creation mode
    -   Docs: Updated app READMEs and `docs/en|ru/applications/space-builder/README.md` with new setting and integration snippet
    -   Build: Full workspace build green

-   **Metaverse — Backend + Frontend MVP (2025-08-14)**

    -   Backend: new package `@universo/metaverse-srv`; PostgreSQL migration creates `metaverse` schema with `metaverses`, `user_metaverses`, `metaverse_links`, strict RLS policies, and indexes; per-request Supabase client with `Authorization` header; Express router `/api/v1/metaverses` with `ensureAuth` and rate-limit; endpoints: list (by membership), create (owner)
    -   Server integration: migrations aggregated in `packages/server/src/database/migrations/postgres/index.ts`; router mounted in `packages/server/src/routes/index.ts`
    -   Frontend: new package `@universo/metaverse-frt`; page `MetaverseList.jsx` (list + search + create), integrated via routes and left menu; i18n bundle registered in global i18n; dual build (CJS/ESM) with gulp asset copy
    -   Build: full monorepo build passed

-   **Uniks Functionality Extraction and Build System Fixes**: Successfully completed on 2025-08-07. Extracted Uniks (workspace) functionality from monolithic codebase into dedicated packages `@universo/uniks-srv` and `@universo/uniks-frt`, resolving critical build system issues. Implemented modular architecture with clean separation of concerns, eliminated circular dependencies, fixed TypeScript compilation issues, and corrected internationalization configuration. Archive: [docs/archive/enhancements/2025-08/uniks-functionality-extraction.md](../docs/archive/enhancements/2025-08/uniks-functionality-extraction.md)

**MMOOMM Entity Hardcode Elimination Fix**: Successfully completed on 2025-08-06. Eliminated all hardcoded transform values in MMOOMM Entity types that were overriding UPDL settings from Chatflow. Fixed JavaScript variable scope conflicts and preserved all game functionality. Archive: [docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md](../docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md)

**Previous Development**: Enhanced Resource System with Material Density implemented successfully. Created realistic material physics with separate weight/volume tracking, 16 material types with proper densities (0.001-21.5 t/m³), enhanced inventory system supporting both tons and m³, and improved mineable components with hardness/volume properties. MMOOMM ship.ts refactoring also completed with 90.6% code reduction and modular shared templates architecture.

## System Architecture

**6 Working Applications** (see [productContext.md](productContext.md) for details):

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages
-   **Uniks Frontend/Backend**: Modular workspace functionality (newly extracted)

**Core Technologies**: React + Material-UI, Node.js + TypeScript, Supabase integration, PNPM workspaces

## Technical Status

**Base Platform**: Flowise 2.2.8 with enhanced ASSISTANT support
**Build Quality**: 100% TypeScript compilation success across entire workspace
**Export Pipeline**: Template-based system for AR.js (production) and PlayCanvas (ready)
**Security**: Enhanced Supabase authentication with secure profile management
**Modular Architecture**: Clean package separation with eliminated circular dependencies

## Next Steps

**Immediate Priorities**:

-   Extend wallpaper variants (additional `wallpaperType`s) and visual presets
-   Editable quiz preview (edit questions/answers before generation)
-   Credentials selection stabilization for non‑test mode (reliable provider key usage)
-   Universo MMOOMM feature expansion
-   Production deployment preparation
-   Community collaboration features
-   Additional package extractions following Uniks pattern
-   Metaverse follow-ups: DB migration run on UP-test (Supabase), add update/delete/default endpoints and membership/links CRUD, front-end UI for membership/default/links, docs (EN/RU), and QA

_For detailed progress history, see [progress.md](progress.md). For current tasks, see [tasks.md](tasks.md)._

## Recent Update — Auth System PoC (Isolated)

-   Implemented isolated authentication PoC using Passport.js + Supabase:
    -   New packages: `apps/auth-srv/base` (server) and `apps/auth-frt/base` (frontend)
    -   Server stores Supabase access/refresh tokens in server-side sessions; CSRF, rate-limit, session fixation mitigation
    -   Frontend uses cookie session with `withCredentials` and `X-CSRF-Token`; no tokens stored client-side
-   Important: This code is fully isolated and NOT integrated into the current system yet. No existing routes or UI have been changed.
-   Next steps (planned): phased integration into `packages/server` (replace header-based RLS with session-based) and `packages/ui` (remove localStorage tokens; use `/auth/me`).
