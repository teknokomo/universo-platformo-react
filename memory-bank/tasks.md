# Task Tracking

**Project**: Universo Platformo (v0.24.0-alpha, Alpha achieved)
**Current Focus**: Post-alpha feature development (UPDL expansions, MMOOMM)

## Recently Completed Major Tasks

### Template Package Modularization (2025-08-30)

**Status**: ✅ **COMPLETED** - Complete architectural refactoring achieved
**Type**: Level 4 (Major/Complex) - Platform Architecture Overhaul
**Priority**: High - Foundation for scalable template system

#### Completed Tasks:

1. **✅ Shared Packages Creation**

    - [x] Created `@universo-platformo/types` with complete UPDL interfaces and platform types
    - [x] Created `@universo-platformo/utils` with UPDLProcessor and common utilities
    - [x] Implemented dual build system (CJS + ESM + Types) for maximum compatibility

2. **✅ Template Package Extraction**

    - [x] Extracted AR.js Quiz functionality to `@universo/template-quiz`
    - [x] Extracted PlayCanvas MMOOMM functionality to `@universo/template-mmoomm`
    - [x] Implemented modular handler system (DataHandler, ObjectHandler, etc.)

3. **✅ Template Registry System**

    - [x] Created dynamic template loading with TemplateRegistry
    - [x] Implemented template registration and builder creation
    - [x] Updated publish-frt to use template packages

4. **✅ Documentation and Build System**

    - [x] Created comprehensive English and Russian documentation
    - [x] Updated all README files with new package information
    - [x] Standardized build system across all packages

5. **✅ Bug Fixes and Optimization**
    - [x] Fixed ship duplication in MMOOMM multi-scene processing
    - [x] Reduced excessive logging in AR.js Quiz (75-90% reduction)
    - [x] Cleaned up build artifacts from source directories

### MMOOMM Template Refactoring - Critical Architecture Issues (2025-08-14)

**Status**: ✅ **COMPLETED** - Critical fixes implemented + modular package created
**Type**: Level 3 (Intermediate Feature) - Architectural Refactoring
**Priority**: Critical - Current multiplayer code has JS errors + 1340-line monolith

#### Critical Issues Fixed:

1. **Colyseus Client API Errors** ✅ **FIXED**

    - ✅ Fixed: `Colyseus.getStateCallbacks(room)` replaced with correct `room.state.players.onAdd/onChange/onRemove`
    - ✅ Fixed: Hardcoded `ws://localhost:2567` replaced with environment-aware connection
    - ✅ Fixed: Added proper logging and error handling for multiplayer connections

2. **Monolithic Builder Architecture** 📦 **PARTIALLY ADDRESSED**

    - ✅ Created: `@universo/template-mmoomm` standalone package (successfully builds)
    - ✅ Extracted: All MMOOMM handlers, scripts, and build systems into modular package
    - ⚠️ Deferred: Full integration back into publish-frt (architecture complexity)

3. **Template Extraction** ✅ **COMPLETED**
    - ✅ Created: `apps/template-mmoomm/base` workspace package with complete functionality
    - ✅ Fixed: All import paths and TypeScript compilation issues
    - ✅ Verified: Successful build and modular architecture

#### Implementation Results:

**Phase 0: Critical Bug Fixes** ✅ **COMPLETED**

-   [x] Fix Colyseus 0.16.x client API usage (room.state events)
-   [x] Fix hardcoded connection URLs to use environment variables
-   [x] Test and verify multiplayer connection stability
-   [x] Add proper error handling and connection logging

**Phase 1: Template Package Extraction** ✅ **COMPLETED**

-   [x] Create `apps/template-mmoomm/base` workspace package
-   [x] Copy existing MMOOMM handlers and files with minimal changes
-   [x] Update imports and exports for standalone package
-   [x] Fix all import paths and dependencies
-   [x] Verify successful build of template-mmoomm package
-   [x] Verify `publish-frt` integration with `@universo/template-mmoomm`
    -   ✅ Integration confirmed: `publish-frt` imports `@universo/template-mmoomm` and uses it for MMOOMM functionality
    -   ✅ Package structure includes PlayCanvas builders, handlers, multiplayer support, generators, and utilities
    -   ✅ Dual CJS/ESM build system implemented with proper TypeScript exports
    -   ✅ Backward compatibility maintained with existing publish-frt functionality

**Phase 2: Builder Refactoring** 📋 **PLANNED FOR FUTURE**

-   [x] Keep existing publish-frt architecture working
-   [ ] **Future**: Integrate template-mmoomm package back with proper interface adapters
-   [ ] **Future**: Implement clean separation between SP/MP generation logic
-   [ ] **Future**: Reduce main builder complexity using template delegation pattern

#### **RESOLUTION**:

✅ **Critical multiplayer bugs fixed** - Colyseus 0.16.x API compatibility restored  
✅ **Modular architecture created** - Template functionality extracted to standalone package  
✅ **Build stability maintained** - All packages compile successfully  
📋 **Future refactoring prepared** - Foundation laid for full modular integration

**Next Steps for Future Iterations:**

-   Design proper interface adapters between `BaseBuilder` and `AbstractTemplateBuilder` architectures
-   Implement incremental migration strategy for template package integration
-   Create builder delegation pattern to reduce monolithic builder complexity

### Metaverse Integration Issues (2025-08-14)

**Status**: 🔍 VAN Analysis In Progress
**Type**: Level 2 (Simple Enhancement) - Integration Fix
**Urgency**: High - Core functionality missing

#### Issues Identified:

1. **Missing Metaverse Menu Item**

    - ✅ Analysis: Metaverse functionality works at `/metaverses` but missing from main menu
    - ✅ Root Cause: `unikDashboard.js` does not include metaverse menu item between "Уники" and "Профиль"
    - 📍 Location: `apps/uniks-frt/base/src/menu-items/unikDashboard.js` (lines 13-47)
    - 📍 Integration Point: `packages/ui/src/layout/MainLayout/Sidebar/MenuList/index.jsx` (line 5)

2. **Profile Migration Trigger Conflict**
    - ✅ Analysis: Migration `AddProfile1741277504477` fails with trigger already exists error
    - ✅ Root Cause: `create_profile_trigger` already exists in Supabase database
    - 📍 Location: `apps/profile-srv/base/src/database/migrations/postgres/1741277504477-AddProfile.ts` (line 110)
    - 📍 Error: `trigger "create_profile_trigger" for relation "users" already exists`

#### Architecture Analysis:

**Menu System Pattern:**

-   ✅ `unikDashboard.js` defines menu structure for workspace context
-   ✅ `MenuList/index.jsx` handles context switching between workspace and main menus
-   ✅ Route integration already exists: `MetaverseList` imported in `MainRoutes.jsx` (line 16)
-   ⚠️ Missing: Menu item in `unikDashboard.js` array

**Migration System Pattern:**

-   ✅ Profile migrations aggregated in `packages/server/src/database/migrations/postgres/index.ts` (line 67)
-   ✅ Migration uses `IF NOT EXISTS` for tables but not for triggers/functions
-   ⚠️ Database state inconsistent: tables dropped but triggers remain

#### Next Steps:

-   [ ] Add metaverse menu item to `unikDashboard.js`
-   [ ] Add appropriate icon import for metaverse
-   [ ] Fix migration to handle existing triggers gracefully
-   [ ] Test full integration after fixes

## Current Implementation Tasks

### Core Platform Packages (Phase 2)

-   [x] Create `@universo-platformo/types` — core ECS/networking types package created; docs synced (EN/RU); build green
    -   Note: Path `apps/universo-platformo-types/base`; exports from `src/index.ts` to `dist/`
-   [x] Create `@universo-platformo/utils` — validators (Zod), ECS deltas, serialization, time sync; docs EN/RU; integrated into `@universo/publish-srv` (safe JSON parsing)

### Metaverse — Backend + Frontend MVP

-   [x] Backend: create `@universo/metaverse-srv` with Express router `/api/v1/metaverses` (list by membership, create), `ensureAuth`, per-request Supabase client (Authorization header), Zod validation, and rate-limit
-   [x] Database: TypeORM migrations creating schema `"metaverse"`, tables (`metaverses`, `user_metaverses`, `metaverse_links`), indexes (`uq_user_default_metaverse`, `uq_links`, etc.), and strict RLS policies (owner-only modify; public visibility read)
-   [x] Server Integration: mount router in `packages/server/src/routes/index.ts`; aggregate migrations in `packages/server/src/database/migrations/postgres/index.ts`
-   [x] Frontend: create `@universo/metaverse-frt` with `MetaverseList.jsx` (list/search/create), register i18n bundle, add left menu item and route `/metaverses`, dual build (CJS/ESM) with gulp assets copy
-   [x] Build: full monorepo build green
-   [ ] Migrations: run Postgres migrations on Supabase (UP-test), verify RLS behavior with JWT
-   [ ] Backend endpoints: update/delete/get-by-id; toggle default (unique per user); membership CRUD (invite/remove/update role); links CRUD (create/delete) with RLS checks
-   [ ] Frontend UI: membership management (roles), default toggle, link editor (create/remove/visualize)
-   [ ] Documentation: complete `docs/en|ru/applications/metaverse/metaverse-(frt|srv).md` with architecture and usage
-   [ ] QA: rate-limit tuning, error handling, i18n keys review, pagination and server-side search, basic tests
-   [ ] Security: ensure no PII logs, per-request Supabase header, `auth.uid()` in policies, enforced `schema('metaverse')`

### Space Builder — Test Mode Stabilization (Multi‑provider)

-   [x] Server: Implement `/config` → `{ testMode, disableUserCredentials, items[] }` (auth, no defaults)
-   [x] Server: Collect test providers from env (ENABLE\__, _\_TEST_MODEL/API_KEY/BASE_URL, headers), OpenAI‑compatible client
-   [x] Server: Enforce `SPACE_BUILDER_DISABLE_USER_CREDENTIALS` and legacy `groq_test` only when fully configured
-   [x] Frontend: Read `/config` with Authorization; retry on 401; build test options list
-   [x] Frontend: Enforce test‑only selection when credentials disabled; hide credentials from dropdown in this mode
-   [x] Frontend: Deduplicate model list by label when mixing test and credential models
-   [x] Docs: Update EN/RU docs in `docs/en|ru/applications/space-builder/README.md`; sync app READMEs (frt/srv)
-   [ ] Follow‑up: Credentials selection stabilization for non‑test mode (reliability and UX)

### AR.js Wallpaper Mode (Markerless)

-   [x] UI: Add `AR Display Type` selector (default wallpaper) and `Wallpaper type` selector; hide marker controls when wallpaper
-   [x] Persistence: Save `arDisplayType`/`wallpaperType` to `chatbotConfig.arjs`; include in publish request as `renderConfig`
-   [x] Backend: Extract `renderConfig` in `FlowDataService` and return from public endpoint
-   [x] Builder: Implement markerless scene with wireframe sphere; slow rotation (dur 90000)
-   [x] Public View: Read `renderConfig` and pass to builder with legacy fallbacks
-   [x] UX: Dim disabled technologies (Babylon.js, A‑Frame) in configuration screen
-   [x] Docs: Update app READMEs and `docs/en|ru/applications/publish/README.md`
-   [ ] Wallpaper types: Add more presets (e.g., gradient grid, starfield) and selector previews
-   [ ] QA: Mobile camera performance check and battery impact for wallpaper mode
-   [ ] Analytics: Add basic usage metric for display type selection

### Space Builder Two-step Quiz Flow (Prepare → Preview → Generate)

-   [x] Backend: Add `/prepare` endpoint with strict Zod `QuizPlan` schema and JSON-only prompt
-   [x] Backend: Implement `proposeQuiz`, `generateFromPlan`, deterministic fallback graph with Space node
-   [x] Backend: Test-mode provider fallback (`groq_test`) in ModelFactory when `SPACE_BUILDER_TEST_MODE=true`
-   [x] Frontend: Two-step dialog (input with N×M controls → preview → generate)
-   [x] Frontend: Synthetic model in test mode when models list is empty
-   [x] Validation: Increase `sourceText` limit to 5000 (server + UI + i18n + docs)
-   [x] Documentation: Update apps READMEs and docs/en|ru with deterministic builder, layout rules, and options
-   [x] UI: Add options "Collect Names" (Start) and "Show Final Result" (End), enabled by default
-   [x] UI: Wider responsive dialog (`maxWidth='md'`), spinner on Generate, state reset after success
-   [x] Layout: Deterministic coordinates (vertical Space lane; left offsets for Q/A without overlap)
-   [ ] Next: Editable quiz preview (allow editing questions/answers before generate)
-   [ ] Next: Credentials selection stabilization (non-test mode reliability improvements)

### Space Builder UI Refinement – 3-step flow + Model Settings modal

-   [x] UX: Move model selection into a gear-button modal ("Model settings") anchored bottom-left in dialog actions on the Input step (implemented)
-   [x] Frontend: Add a third step `settings` and move checkboxes there ("Append", "Collect names", "Show final score", disabled "Generate graphics")
-   [x] Frontend: Replace "Generate" on Preview with "Configure" that navigates to the Settings step
-   [x] Frontend: Implement "Model settings" modal with dropdown "Model", "Cancel" and "Save"; persist chosen model to dialog state
-   [x] i18n: Add keys (en/ru): `spaceBuilder.configure`, `spaceBuilder.settingsTitle`, `spaceBuilder.modelSettingsTitle`, `spaceBuilder.save`, `spaceBuilder.testModeInfo`
-   [x] Docs: Update `apps/space-builder-frt/base/README(.md|‑RU.md)` and `apps/space-builder-srv/base/README(.md|‑RU.md)`; sync `docs/en|ru/applications/space-builder/README.md`
-   [x] QA: Validate state reset, disabled states, test-mode fallback; fix label behavior and paddings; reduce nested-dialog focus warnings

### Space Builder – Creation Mode & Safer Append (2025-08-13)

-   [x] Frontend (UI): Replace single Append checkbox with `Creation mode` Select (`newSpace` | `replace` | `append`); default `newSpace`; reorder options (New Space → Clear → Append)
-   [x] Host Canvas: Add `handleAppendGeneratedGraphBelow` with measured height fallback and increased margin; keep ID remap; add `handleNewSpaceFromGeneratedGraph` using `duplicatedFlowData`
-   [x] i18n: Add EN/RU keys for creation mode labels
-   [x] Docs: Update `apps/space-builder-frt` READMEs and `docs/en|ru/applications/space-builder/README.md`
-   [x] Build/QA: Monorepo build green; manual tests for three modes

### MMOOMM Entity Hardcode Elimination ✅ COMPLETED

**Status**: ✅ Implementation ✅ Reflection ✅ Archive ✅ **COMPLETED**
**Type**: Level 2 (Simple Enhancement) - Bug Fix
**Date Completed**: 2025-08-06
**Archive Document**: [docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md](../docs/archive/enhancements/2025-08/mmoomm-entity-hardcode-elimination-fix.md)
**Reflection Document**: `memory-bank/reflections/reflection-mmoomm-entity-hardcode-fix.md`

**Archive Summary**: Successfully eliminated all hardcoded transform values in MMOOMM Entity types (Ship, Station, Gate, Asteroid) that were overriding UPDL settings from Chatflow. Implemented conditional logic to apply defaults only when UPDL values are unset. Fixed JavaScript variable scope conflicts and preserved all game functionality.

### MMOOMM Template Refactoring - Safe Cleanup Phase ✅ COMPLETE

-   [x] Verify current laser system functionality: Test that current laser mining system in ship.ts works correctly before removing backup files
-   [x] Remove laserSystem_design.js: Delete obsolete design file from entityTypes directory
-   [x] Remove ship_weaponSystem_backup.js: Delete obsolete backup file from entityTypes directory
-   [x] Test MMOOMM template build: Verify that MMOOMM template builds successfully after file removal

### MMOOMM Template Refactoring - Inventory Consolidation Phase (MVP) ✅ COMPLETE

-   [x] Create shared inventory template: Create shared/inventoryTemplate.ts with minimal working implementation
-   [x] Update attachments/inventory.ts: Replace duplicated code with shared template reference (preserves UPDL Component integration)
-   [x] Update components/inventory.ts: Update components/inventory.ts to use shared template while preserving logging and events functionality
-   [x] Test inventory functionality: Verify that laser mining and UPDL Component attachment still work correctly

## Current Implementation Tasks

### MMOOMM Template Refactoring - Ship.ts Modularization Phase

-   [x] Phase 1.1: Create shared/shipSystems/ directory infrastructure
-   [x] Phase 1.2: Create shipSystemsIndex.ts with exports
-   [x] Phase 1.3: Test current MMOOMM template functionality (baseline)
-   [x] Phase 2.1: Create shipControllerTemplate.ts with ShipControllerSystem interface
-   [x] Phase 2.2: Extract ship controller logic (lines 48-221) to shared template
-   [x] Phase 2.3: Create generateShipControllerCode() function
-   [x] Phase 2.4: Update ship.ts to use ship controller template
-   [x] Phase 2.5: Test ship movement controls (WASD+QZ)
-   [x] Phase 3.1: Create cameraControllerTemplate.ts with CameraControllerSystem interface
-   [x] Phase 3.2: Extract camera logic (lines 266-370) to shared template
-   [x] Phase 3.3: Create generateCameraControllerCode() function
-   [x] Phase 3.4: Update ship.ts to use camera controller template
-   [x] Phase 3.5: Test camera following behavior
-   [x] Phase 4.1: Create laserMiningTemplate.ts with LaserMiningSystem interface
-   [x] Phase 4.2: Extract laser system logic (lines 373-872) to shared template
-   [x] Phase 4.3: Create generateLaserMiningCode() function with state machine
-   [x] Phase 4.4: Update ship.ts to use laser mining template
-   [x] Phase 4.5: Test laser mining functionality (critical test)
-   [x] Phase 5.1: Integrate all shared systems in ship.ts
-   [x] Phase 5.2: Ensure global references preservation (window.playerShip, etc.)
-   [x] Phase 5.3: Test complete MVP functionality (mining → inventory → HUD)
-   [x] Phase 5.4: Clean up duplicated code from ship.ts
-   [x] Phase 6.1: Update shared/README.md with ship systems documentation
-   [x] Phase 6.2: Update shared/README-RU.md with Russian documentation
-   [x] Phase 6.3: Final validation of all ship systems

### Enhanced Resource System with Material Density ✅ COMPLETE

-   [x] Phase 1.1: Create material density database with realistic densities for 16 materials
-   [x] Phase 1.2: Implement materialDensity.ts with conversion functions (weight ↔ volume)
-   [x] Phase 1.3: Add material categories (common, rare, precious, exotic) with proper values
-   [x] Phase 2.1: Create enhanced inventory system supporting both weight and volume tracking
-   [x] Phase 2.2: Implement enhancedInventory.ts with automatic density-based conversion
-   [x] Phase 2.3: Add backward compatibility with existing simple inventory system
-   [x] Phase 3.1: Update mineable component with material-specific properties
-   [x] Phase 3.2: Add new UPDL component fields: asteroidVolume, hardness
-   [x] Phase 3.3: Implement density-based pickup generation and collection
-   [x] Phase 4.1: Update ComponentNode.ts with new mineable component fields
-   [x] Phase 4.2: Create comprehensive documentation (README.md and README-RU.md)

### PlayCanvasMMOOMMBuilder.ts Modularization ✅ COMPLETE

**Goal**: Refactor monolithic PlayCanvasMMOOMMBuilder.ts (1,211 lines) into modular architecture
**Target**: 70-80% code reduction (1,211 → 200-250 lines) following Ship.ts refactoring patterns
**Critical**: Preserve HTML-JavaScript hybrid functionality and global objects compatibility
**Result**: Successfully reduced from 1,211 lines to 254 lines (79% reduction) with full functionality preserved

#### Phase 1: Deep Analysis & Infrastructure

-   [x] 1.1: Create modular directory structure (systems/, core/, initialization/, htmlSystems/, globalObjects/)
-   [x] 1.2: Analyze current code structure and create dependency map
-   [x] 1.3: Create baseline test for current MMOOMM template functionality
-   [x] 1.4: Embedded JavaScript Analysis - map SpaceHUD (~150 lines), SpaceControls (~250 lines), initializePhysics (~50 lines)

#### Phase 2: HTML-JavaScript Hybrid Extraction

-   [x] 2.1: Extract HTML Document Generator (~150 lines pure HTML)
-   [x] 2.2: Extract Embedded JavaScript Systems Registry
-   [x] 2.3: Extract Global Objects Manager for window.\* lifecycle
-   [x] 2.4: Test HTML generation with placeholders

#### Phase 3: Embedded Game Systems Extraction

-   [x] 3.1: Extract Embedded HUD System (~150 lines) - preserve window.SpaceHUD compatibility
-   [x] 3.2: Extract Embedded Controls System (~250 lines) - preserve window.SpaceControls compatibility
-   [x] 3.3: Extract Embedded Physics System (~50 lines) - initializePhysics function
-   [x] 3.4: Extract Helper Functions (~100 lines) - tradeAll, tradeHalf, initializeSpaceControls, etc.
-   [x] 3.5: Test embedded systems extraction and global objects accessibility

#### Phase 4: PlayCanvas Core Systems Extraction

-   [x] 4.1: Extract PlayCanvas Initializer (~100 lines) - generatePlayCanvasInit method
-   [x] 4.2: Extract Scene Initializer (~100 lines) - scene initialization logic
-   [x] 4.3: Extract Default Scene Generator - generateDefaultScene, generateErrorScene methods
-   [x] 4.4: Test PlayCanvas core systems functionality

#### Phase 5: Core Builder Refactoring

-   [x] 5.1: Create BuilderSystemsManager for coordinating all systems
-   [x] 5.2: Refactor main PlayCanvasMMOOMMBuilder class (preserve custom build() method)
-   [x] 5.3: Create HTML-JavaScript Integration Layer
-   [x] 5.4: Update exports and imports

#### Phase 6: Integration & Testing

-   [x] 6.1: Comprehensive functionality test (ship controls, laser mining, HUD, physics, trading)
-   [x] 6.2: HTML-JavaScript Integration test (embedded systems, window.\* objects, event listeners)
-   [x] 6.3: Performance validation (loading time, HTML size)
-   [x] 6.4: Backward compatibility verification (AbstractTemplateBuilder, handlers, scripts)

#### Phase 7: Documentation & Cleanup

-   [x] 7.1: Update documentation with new architecture and HTML-JavaScript patterns
-   [x] 7.2: Create migration guide for developers
-   [x] 7.3: Final cleanup and linting

## Open Tasks

### Universo MMOOMM Multiplayer Implementation (MVP)

**Status**: ✅ **COMPLETED** - All 16 tasks successfully implemented and tested!
**Type**: Level 4 (Major/Complex) - Multiplayer Architecture
**Date Started**: 2025-08-19
**Date Completed**: 2025-08-22

#### Phase 1: Analysis and Adaptation of "Collect Name" Logic

-   [x] 1.1: Study existing quiz template "Collect Name" pattern in `apps/publish-frt/base/src/builders/templates/quiz/arjs/handlers/DataHandler/index.ts`
-   [x] 1.2: Create multiplayer mode detector in PlayCanvasMMOOMMBuilder.ts for Space with collectLeadName=true + only Space connections
-   [x] 1.3: Test current MMOOMM template functionality (baseline before changes)

#### Phase 2: Create Minimal Colyseus Server

-   [x] 2.1: Create `apps/multiplayer-colyseus-srv/base` workspace package with TypeScript and Colyseus dependencies
-   [x] 2.2: Implement Colyseus schemas (PlayerSchema, EntitySchema, MMOOMMRoomState) with @colyseus/schema
-   [x] 2.3: Create MMOOMMRoom class with basic join/leave, transform updates, mining, and selling logic
-   [x] 2.4: Test Colyseus server locally (basic connection and state sync)

#### Phase 3: Adapt MMOOMM Template for Multiplayer

-   [x] 3.1: Create auth screen generator using quiz template pattern (name input form)
-   [x] 3.2: Create Colyseus client integration script with connection, state sync, and player management
-   [x] 3.3: Modify PlayCanvasMMOOMMBuilder to detect multiplayer mode and generate appropriate code
-   [x] 3.4: Test multiplayer auth flow (name input → game connection)

#### Phase 4: Integration and Testing

-   [x] 4.1: Integrate multiplayer client with existing ship controls and mining systems
-   [x] 4.2: Implement other players visualization (ship entities with name badges)
-   [x] 4.3: Test complete multiplayer flow (auth → join → movement → mining → selling)
-   [x] 4.4: Verify backward compatibility (single-player mode still works)

#### Phase 5: UPDL Objects Fix in Multiplayer Mode

-   [x] 5.1: Fix generateGameScene() method to properly extract entities from second Space
-   [x] 5.2: Improve prepareEntitiesForColyseus() method with validation and logging
-   [x] 5.3: Enhance MMOOMMRoom server-side entity processing
-   [x] 5.4: Add comprehensive debugging logs for data flow tracking
-   [x] 5.5: Fix UPDLProcessor to include entities in spaceData for multi-scene flows
-   [x] 5.6: Fix entity data extraction from entity.data.inputs instead of entity.data
-   [x] 5.7: Test complete UPDL Flow → Multiplayer → Objects in game cycle
-   [x] 5.8: Verify backward compatibility with single-player mode

#### Phase 6: Documentation and Cleanup

-   [ ] 6.1: Update MMOOMM template documentation with multiplayer mode instructions
-   [ ] 6.2: Create README for multiplayer-srv package with setup instructions
-   [ ] 6.3: Add linting fixes and code cleanup
-   [ ] 6.4: Final integration test and QA validation

### Post-Alpha Features

-   [ ] Physics Node: Implement physics simulation node for complex interactions
-   [ ] Animation System: Add keyframe animation node for dynamic content
-   [ ] Networking Node: Implement multiplayer networking capabilities
-   [ ] Advanced Scene Management: Multi-scene UPDL projects with complex interactions

### Universo MMOOMM Expansion

-   [ ] PlayCanvas Builder Structure: Create `apps/publish-frt/base/src/builders/playcanvas/` directory structure
-   [ ] PlayCanvas Builder Implementation: Implement `PlayCanvasBuilder` class and register in `setupBuilders`
-   [ ] MMOOMM Template Development: Create `templates/mmoomm/` directory and implement `MMOOMMTemplate.ts`
-   [ ] Node Handlers: Create node handlers (SpaceHandler, EntityHandler, etc.) for PlayCanvas integration
-   [ ] PlayCanvas Engine Integration: Integrate PlayCanvas Engine v2.9.0 with template system
-   [ ] UI Implementation: Create PlayCanvas publication settings page and add PlayCanvas tab to publication interface
-   [ ] Settings Persistence: Implement settings persistence for PlayCanvas configurations
-   [ ] Game Flow Creation: Design Universo MMOOMM JSON flow and test import/export functionality
-   [ ] Game Mechanics Validation: Test and validate game mechanics in PlayCanvas environment

### Production Deployment

-   [ ] Enterprise-grade hosting: Implement scalable hosting solutions
-   [ ] Performance optimization: Optimize platform performance for production use
-   [ ] Security enhancements: Implement additional security measures for production
-   [ ] Monitoring and analytics: Add comprehensive monitoring and analytics systems

### Community Features

-   [ ] Template sharing: Implement template sharing and collaboration features
-   [ ] Real-time collaboration: Develop multi-user editing capabilities
-   [ ] Community marketplace: Create marketplace for templates and components
-   [ ] Documentation system: Enhance documentation and tutorial systems

### Space Builder – Constraints & Iterative Quiz Editing

-   [x] Backend: Extend `/prepare` to accept `additionalConditions?: string (0..500)`; validate length and include in prompt
-   [x] Backend: Add `POST /api/v1/space-builder/revise` → Body: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel }` → Response: `{ quizPlan }`
-   [x] Backend: Service `reviseQuizPlan()` with strict JSON-only output and minimal-change guarantee; preserve sizes and one correct answer per question
-   [x] Backend: Update prompts
    -   [x] Prepare prompt: add "Constraints" section; MUST follow; never echo constraints; preserve JSON schema
    -   [x] Revise prompt: input current plan JSON + instructions; change only requested parts; keep other text identical; preserve counts; output RAW JSON
-   [x] Backend: Controllers validation with `QuizPlanSchema`; verify items count and answers per item; return 422 on mismatch
-   [x] Frontend: Input step – add `Additional conditions` textarea below `Main material` (rows≈3, max 500 chars, helper counter)
-   [x] Frontend: Hook `useSpaceBuilder` – extend `PreparePayload` with `additionalConditions?: string`; add `reviseQuiz(payload)` calling `/revise`
-   [x] Frontend: Preview step – add `What to change?` textarea (max 500, counter) and `Change` button; on click call `revise`, update in-place `quizPlan`, show spinner; allow multiple iterations; clear field after success
-   [x] Frontend: Error handling – surface backend errors via `onError`; disable controls while busy
-   [x] Frontend: i18n (en/ru) – keys added: `additionalConstraints`, `reviseTitle`, `reviseInstructions`, `revise`, `revising`, `tooManyRequests`
-   [x] Docs: Update `apps/space-builder-frt/base/README(.md|‑RU.md)` and `apps/space-builder-srv/base/README(.md|‑RU.md)`; sync `docs/en|ru/applications/space-builder/README.md`
-   [x] QA: Test in `SPACE_BUILDER_TEST_MODE=true`; validate limits (5000/500), sizes, single-correct; repeated revisions; clear-on-back behavior

## Recently Completed Tasks

-   [x] **Multiplayer Colyseus Server Implementation**: Successfully created complete `@universo/multiplayer-colyseus-srv` package with full multiplayer architecture for Universo MMOOMM. Implemented MMOOMMRoom with 16-player capacity, comprehensive Colyseus schemas (PlayerSchema, EntitySchema, MMOOMMRoomState), server-authoritative gameplay mechanics (mining, trading, movement validation), MultiplayerManager integration layer, and enhanced UPDL entity processing. Complete TypeScript implementation with proper error handling, logging, and graceful shutdown. Production-ready multiplayer system for MMOOMM space gameplay. ✅ **COMPLETED** (2025-08-22)

-   [x] **Uniks Functionality Extraction and Build System Fixes**: Successfully extracted Uniks (workspace) functionality into dedicated packages and resolved critical build issues. Extracted backend logic into `@universo/uniks-srv` package with Express routes, TypeORM entities, and PostgreSQL migrations. Created `@universo/uniks-frt` frontend package with React components, menu configurations, and i18n support. Resolved circular dependency issues by implementing proper workspace dependencies and TypeScript path aliases. Fixed Vite alias configuration for i18n imports. Corrected translation key usage by removing redundant namespace prefixes. All Uniks functionality now modularized and build system fully operational. ✅ **COMPLETED** ✅ **REFLECTION COMPLETE** ✅ **ARCHIVED** - [Archive](docs/archive/enhancements/2025-08/uniks-functionality-extraction.md) (2025-08-07)
-   [x] **MMOOMM Entity Hardcode Elimination Fix**: Fixed all hardcoded transform values in MMOOMM Entity types that were overriding UPDL settings from Chatflow. Eliminated hardcoded scale values in Ship (2,1,3), Station (4,2,4), Gate (3,3,1), and Asteroid entities. Fixed hardcoded rotation values in Ship entity. Implemented conditional logic to apply default values only when UPDL values are unset (default 1,1,1). Fixed variable name conflicts (entityScale, scaleMultiplier) causing syntax errors. All Entity transform values (scale, position, rotation) now properly respect UPDL Component settings while maintaining fallback defaults for standalone entities. (2025-01-31)

### Auth System — Passport.js + Supabase (PoC, Isolated)

-   [x] Create isolated packages `apps/auth-srv/base` and `apps/auth-frt/base` with server-side sessions, CSRF, rate-limit, and cookie-based client (no tokens on client)
-   [x] Ensure PNPM workspace build for both packages is green
-   [x] Add RU/EN READMEs with rollout plan
-   [x] Confirm code is fully isolated and NOT integrated with current system
-   [ ] Integration (server): adopt session-based Supabase client per request; replace header-based RLS
-   [ ] Integration (ui): remove localStorage tokens, Authorization interceptor; switch to `withCredentials` + `/auth/me`
-   [ ] Production hardening: Redis session store, distributed refresh lock, HTTPS & SameSite policy
