# Task Tracking

**Project**: Universo Platformo (v0.24.0-alpha, Alpha achieved)
**Current Focus**: Post-alpha feature development (UPDL expansions, MMOOMM)

## Current Implementation Tasks

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
-   [x] UI: Add options “Collect Names” (Start) and “Show Final Result” (End), enabled by default
-   [x] UI: Wider responsive dialog (`maxWidth='md'`), spinner on Generate, state reset after success
-   [x] Layout: Deterministic coordinates (vertical Space lane; left offsets for Q/A without overlap)
-   [ ] Next: Editable quiz preview (allow editing questions/answers before generate)
-   [ ] Next: Credentials selection stabilization (non-test mode reliability improvements)

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
-   [x] Phase 4.3: Test material density system with different resource types

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
-   [x] 1.5: Global Dependencies Mapping - document window.\* objects and event listeners

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

## Recently Completed Tasks

-   [x] **Uniks Functionality Extraction and Build System Fixes**: Successfully extracted Uniks (workspace) functionality into dedicated packages and resolved critical build issues. Extracted backend logic into `@universo/uniks-srv` package with Express routes, TypeORM entities, and PostgreSQL migrations. Created `@universo/uniks-frt` frontend package with React components, menu configurations, and i18n support. Resolved circular dependency issues by implementing proper workspace dependencies and TypeScript path aliases. Fixed Vite alias configuration for i18n imports. Corrected translation key usage by removing redundant namespace prefixes. All Uniks functionality now modularized and build system fully operational. ✅ **COMPLETED** ✅ **REFLECTION COMPLETE** ✅ **ARCHIVED** - [Archive](docs/archive/enhancements/2025-08/uniks-functionality-extraction.md) (2025-08-07)
-   [x] **MMOOMM Entity Hardcode Elimination Fix**: Fixed all hardcoded transform values in MMOOMM Entity types that were overriding UPDL settings from Chatflow. Eliminated hardcoded scale values in Ship (2,1,3), Station (4,2,4), Gate (3,3,1), and Asteroid entities. Fixed hardcoded rotation values in Ship entity. Implemented conditional logic to apply default values only when UPDL values are unset (default 1,1,1). Fixed variable name conflicts (entityScale, scaleMultiplier) causing syntax errors. All Entity transform values (scale, position, rotation) now properly respect UPDL Component settings while maintaining fallback defaults for standalone entities. (2025-01-31)
-   [x] **Entity Scale Handling Fix**: Fixed Transform scale data flow from Chatflow to PlayCanvas entities. Removed implicit random scale generation from asteroid entity type that was overriding user-defined scale values. Ensured Transform scale values (e.g., 4,4,4) from Chatflow are always respected in generated entities. Updated mineable properties calculation to use actual entity scale for proper resource yield. (2025-01-31)
-   [x] **Trading Component Configuration Fix**: Fixed Trading Component interaction range configuration not applying from Chatflow interface. Corrected UPDLProcessor to transmit all ComponentNode fields to component generation pipeline, fixed ComponentHandler data source mapping, and prevented Entity Type logic from overriding Component settings. Trading interaction range now properly configurable (tested with 1600 units). (2025-01-31)
-   [x] **Builder Systems File Naming Standardization**: Standardized all builderSystems directory files to consistent camelCase naming convention. Renamed files from mixed PascalCase/camelCase to uniform camelCase (e.g., EmbeddedControlsSystem.ts → embeddedControlsSystem.ts, PlayCanvasInitializer.ts → playcanvasInitializer.ts). Updated all import statements and cross-references. Improved code consistency and maintainability. (2025-01-31)
-   [x] **PlayCanvasMMOOMMBuilder.ts Modularization**: Successfully refactored monolithic PlayCanvasMMOOMMBuilder.ts from 1,211 lines to 254 lines (79% reduction) using modular architecture. Extracted embedded JavaScript systems (SpaceHUD, SpaceControls, Physics, HelperFunctions), HTML document generation, and PlayCanvas core systems into separate modules. Implemented BuilderSystemsManager for coordinating all systems while preserving full HTML-JavaScript hybrid functionality, global objects compatibility, and all game features (ship controls, laser mining, HUD, physics, trading). (2025-01-30)
-   [x] **Enhanced Resource System with Material Density**: Implemented realistic material physics system with 16 material types, density-based weight/volume conversion, enhanced inventory supporting both tons and m³, improved mineable components with hardness/volume properties, and comprehensive documentation. System supports materials from lightweight antimatter (0.001 t/m³) to dense platinum (21.5 t/m³) with proper economic balance
-   [x] **MMOOMM Ship Systems Refactoring**: Successfully refactored ship.ts from 894 lines to 84 lines (90.6% reduction) by extracting ship controller, camera controller, laser mining, and inventory systems into shared templates. Improved maintainability, reusability, and consistency while preserving all MVP functionality
-   [x] **Laser System Critical Fix**: Fixed critical recursive initialization error and visual artifacts in laser mining system
    -   Fixed recursive `this.laserSystem.init()` call causing black screen crashes
    -   Replaced complex line mesh with reliable box model for laser beam rendering
    -   Fixed update loop using `app.on('update')` instead of `entity.on('update')`
    -   Added missing `getItemList()` method to ship inventory for HUD updates
    -   Removed fade-out animation to prevent laser beam detachment during ship movement
-   [x] **Laser Mining System**: Industrial laser mining implementation with auto-targeting and state machine
    -   Replaced projectile weapons with industrial laser mining system
    -   Implemented state machine (idle, targeting, mining, collecting) with 3-second cycles
    -   Added visual red laser beam with target detection and inventory integration
-   [x] **UPDL Priority Fix**: Fixed Entity Type Logic vs Component Render execution order in MMOOMM template - UPDL Component Render settings now properly override hardcoded Entity Type defaults while preserving all MMO game mechanics (2025-07-22)
-   [x] Release 0.21.0-alpha "Firm Resolve": Major platform improvements with memory bank optimization, MMOOMM stabilization, and handler refactoring (2025-07-20)
-   [x] Handler Architecture Refactoring: Refactored ComponentHandler and EntityHandler into modular files for better organization (2025-07-20)
-   [x] Memory Bank System Optimization: Updated all memory bank files to comply with new guidelines (2025-07-20)
-   [x] MMOOMM Template Stabilization: Fixed ship movement controls and console optimization (January 2025)
-   [x] Alpha Status Achievement: Complete UPDL system with production-ready stability (July 2025)
-   [x] High-Level UPDL Node Refactoring: Fixed connector logic, unified architecture, added unique icons (January 2025)
-   [x] Template-First Architecture: Migrated to template-based structure for reusability (2025)
-   [x] PlayCanvas Integration: Complete PlayCanvas publication and rendering system (2025)

## Development Guidelines

-   All modifications maintain existing AR.js functionality
-   Code follows project linting standards
-   Russian user communication, English code documentation maintained
-   Project uses PNPM package manager exclusively
-   Maintain Alpha-grade stability and backward compatibility

_For detailed progress history, see [progress.md](progress.md). For current project context, see [activeContext.md](activeContext.md)._
