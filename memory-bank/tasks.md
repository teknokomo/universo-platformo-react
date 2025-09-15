
# API Endpoint Consistency Implementation Tasks

## Objective
Implement singular routing pattern for individual Unik operations in API endpoints to match frontend navigation consistency.

## Tasks

### Backend API Restructuring
- [x] Split uniksRoutes.ts into two routers: collection and individual operations
- [x] Create separate router for individual Unik operations (GET, PUT, DELETE /:id)
- [x] Mount individual operations router at /unik in main routes/index.ts
- [x] Keep list operations (GET /, POST /) at /uniks for collection semantics
- [x] Update API path mappings to maintain backwards compatibility where needed

### Frontend API Call Updates  
- [x] Update SpaceBuilderDialog.tsx to use singular /api/v1/unik/ pattern for individual operations
- [x] Scan for other frontend API calls to individual Unik endpoints
- [x] Update any remaining /api/v1/uniks/:id pattern usage to /api/v1/unik/:id

### Testing and Validation
- [x] Build and test backend changes to ensure API routes work correctly
- [x] Verify frontend can successfully call updated individual Unik endpoints
- [x] Ensure list operations still function at /api/v1/uniks/
- [x] Test full flow: list Uniks, navigate to individual Unik, perform operations

### Bug Fix - unikId Parameter Issue (2025-10-15)
- [x] Identify root cause: parameter name mismatch between new routing (:id) and existing controllers (unikId)
- [x] Add parameter transformation middleware to convert id to unikId in nested routes
- [x] Fix router mounting order to prevent route conflicts between nested and individual operations

### Parameter Unification Implementation (2025-10-15)
- [x] Replace all /:id with /:unikId in backend nested routes (11 routes updated)
- [x] Remove middleware transformation layer that mapped id to unikId
- [x] Update all controllers to use direct req.params.unikId access (removed fallback patterns)
- [x] Validate compilation and build process passes without errors
- [x] Update API documentation to reflect unified parameter naming approach
- [x] Update progress tracking with completion milestone
- [x] Add route skipping middleware in individual router to avoid nested path conflicts
- [x] Build and verify fixes resolve "unikId not provided" errors in nested resources

### Documentation Updates
- [x] Update API documentation to reflect new routing patterns (EN/RU api-reference README updated with /unik vs /uniks section, fallback explanation)
- [x] Update any code comments / system patterns referring to old API paths (systemPatterns.md adjusted, legacy path marked)

# Task Tracking

**Project**: Universo Platformo (v0.29.0-alpha, Alpha achieved)
**Current Focus**: TypeScript Path Aliases Refactoring

## TypeScript Path Aliases Refactoring Plan (2025-09-16) ✅

**Goal**: Standardize imports across the monorepo by replacing long relative paths (`../../../../../`) with clean aliases (`@ui/*`, `@types/*`, `@utils/*`).

### Implementation Tasks:
- [x] Document plan in memory-bank/tasks.md
- [x] Analyze current tsconfig.json files
- [x] Create import analysis tool
- [x] Refactor finance-frt (current file)
- [x] Refactor profile-frt
- [x] Refactor resources-frt
- [x] Refactor analytics-frt
- [x] Refactor auth-frt
- [x] Validation and testing
- [x] Final consistency check

**Priority Patterns:**
- `@ui/*` - UI components from packages/ui
- `@types/*` - Types from universo-platformo-types
- `@utils/*` - Utilities from universo-platformo-utils
- `@api/*`, `@components/*`, `@hooks/*`, `@pages/*` - Local modules

**Reference Configurations:** spaces-frt, metaverses-frt (already working)

## New Task - Flow List i18n (2025-09-15)

Internationalize shared Flow List (table + menu) without polluting root translation files.

### Subtasks
- [x] Create namespace files `flowList.json` (EN/RU)
- [x] Register `flowList` namespace in `i18n/index.js`
- [x] Refactor `FlowListMenu.jsx` to use translations
- [x] Refactor `FlowListTable.jsx` to use translations
- [x] Add plural keys (en/ru) & fix usage in `FlowListTable.jsx`
- [x] Add date formatting utility skeleton `formatDate.js`
- [x] Introduce action types `entityActions.ts`
- [x] Add `BaseEntityMenu.tsx` skeleton (not yet integrated)

## Fix - Spaces Canvas Back Navigation (2025-09-15)

Issue: Clicking the back (exit) icon in a Space canvas redirected to root `/` (Uniks list) instead of the current Unik's Spaces list after migration to singular route pattern.

Root Cause: `CanvasHeader.jsx` still parsed legacy segment `'uniks'` to extract `unikId`. With new routes using `/unik/:unikId/...`, extraction failed and fallback navigated to `/`.

Resolution:
- Added helper `extractUnikId()` in `CanvasHeader.jsx` to support both new `unik` and legacy `uniks` path segments, plus fallbacks (chatflow.unik_id, localStorage `parentUnikId`).
- Updated back button handler and settings actions (delete space, export as template, duplicate) to use the helper.
- Ensures proper navigation to `/unik/{unikId}/spaces` (or `/unik/{unikId}/agentflows` for agent canvases).

Status: ✅ Implemented & built (spaces-frt + ui).

Follow-ups (optional):
- Add integration test around navigation helper.
- Persist last visited tab or filter state when returning to list (TODO candidate).

### Notes
- Reused cancel button key from confirm.delete.cancel to avoid duplicate generic button keys.
- Entity dynamic label resolved via `entities.chatflow` / `entities.agent`.
- Export filename uses localized entity suffix.


## Active Task - Fix Metaverses Localization Button Keys (2025-01-13)

Fix translation keys across metaverses components to match resources-frt patterns.

- [x] Compare localization patterns between metaverses-frt and resources-frt
- [x] Fix translation keys in 6 components (MetaverseDetail, SectionDetail, EntityDetail, EntityDialog)
- [x] Test button text display for proper translations
- [ ] Validate complete metaverses UI functionality

**Fixes Applied:** Changed `metaverses.entities.*` → `entities.*` and `metaverses.entities.common.back` → `common.back` across components.

## Active Issues

### Metaverse Integration Issues (2025-08-14)

**Status**: 🔍 Analysis In Progress | **Type**: Level 2 Integration Fix | **Urgency**: High

#### Issues Identified:

1. **Missing Metaverse Menu Item**
   - [x] Analysis: Metaverse functionality works at `/metaverses` but missing from main menu
   - [x] Root Cause: `unikDashboard.js` does not include metaverse menu item between "Уники" and "Профиль"
   - [ ] Add metaverse menu item to `apps/uniks-frt/base/src/menu-items/unikDashboard.js`
   - [ ] Add appropriate icon import for metaverse

2. **Profile Migration Trigger Conflict**
   - [x] Analysis: Migration `AddProfile1741277504477` fails with trigger already exists error
   - [x] Root Cause: `create_profile_trigger` already exists in Supabase database
   - [ ] Fix migration to handle existing triggers gracefully
   - [ ] Test full integration after fixes

## Completed - Chatflow to Spaces UI Fixes (2025-01-04)

Replace remaining "Chatflow" terminology with "Spaces" and fix canvas display logic.

### Canvas Tabs & Display
- [x] Update conditional rendering logic in canvas/index.jsx
- [x] Add showTabsForNewSpace state management
- [x] Create temporary canvas array for new spaces
- [ ] Test tabs appearance after first save

### Terminology Updates
- [x] Update default name from "Untitled Chatflow" to "Untitled Space"
- [x] Add new translation keys for dynamic save messages
- [x] Update save success notifications
- [ ] Verify all UI text uses Space/Canvas terms

### Header & API Integration
- [x] Update CanvasHeader to show Space name in main title
- [x] Create new spaces.js API file and implement getAllSpaces
- [x] Update spaces/index.jsx to use Spaces API
- [ ] Test header display for both saved and unsaved spaces
- [ ] Test that only Spaces appear in list, not individual Canvas

### UX Improvements
- [ ] Add loading indicators for tab operations
- [ ] Improve error messages with specific types
- [ ] Test complete user flow

## Completed Major Tasks

### Completed - Unik List Spaces Column & Rename Dialog (2025-09-15) ✅

Implemented domain-specific UI adjustments for Unik entities and improved rename dialog UX.

Subtasks:
- [x] Analyze Unik list table existing columns (Category, Nodes) irrelevance
- [x] Add `isUnikTable` prop to `FlowListTable.jsx` for conditional column rendering
- [x] Replace Category/Nodes headers with single `Spaces` header when `isUnikTable`
- [x] Render `spacesCount` value per Unik row (fallback 0)
- [x] Add i18n key `table.columns.spaces` (EN/RU) in `flowList.json`
- [x] Enhance `SaveChatflowDialog.jsx` to accept `initialValue` for rename operations
- [x] Suppress placeholder when editing existing name (remove hardcoded "Мой новый холст")
- [x] Pass current name as `initialValue` from `unikActions.jsx` rename dialog
- [x] Validate build of UI package (vite) without errors
- [x] Confirm backward compatibility for non-Unik tables (unchanged columns)

Notes:
- Architecture kept generic: dialog `initialValue` can be adopted by other entity rename actions later.
- Minimal invasive changes; existing sorting & selection logic untouched.
- Placeholder now only appears for create operations with empty initial value.

### Completed - Unik Singular Route & Table Link Fix (2025-09-15) ✅

Implemented correct link formation for Unik list (table view) and introduced singular route `/unik/:unikId`.

Subtasks:
- [x] Locate incorrect table link using `/canvas/:id` for Unik rows  
- [x] Add conditional link logic in `FlowListTable.jsx` for `isUnikTable` → `/unik/{id}`
- [x] Update main route in `MainRoutes.jsx` from `/uniks` to `/unik` 
- [x] Update menu detection regex in `MenuList/index.jsx` and `NavItem/index.jsx`
- [x] Update navigation in `apps/uniks-frt/.../UnikList.jsx` to singular path
- [x] Update navigation in `apps/finance-frt/.../UnikList.jsx` to singular path
- [x] Mass update all frontend navigation paths from `/uniks/${unikId}` to `/unik/${unikId}`
- [x] Update Canvas routes and spaces-frt routes to use singular pattern
- [x] Verify UI build passes without errors

Notes:
- Backend API paths remain unchanged (still use plural `/uniks/` for server endpoints).
- All frontend navigation now uses consistent singular `/unik/:unikId` pattern.
- Menu system properly detects and shows Unik dashboard when on `/unik/:unikId` routes.
- Backward compatibility maintained via existing plural API routes.


### Resources Applications Cluster Isolation (2025-09-10) ✅

Implemented three-tier architecture (Clusters → Domains → Resources) with complete data isolation.

- [x] Implement three-tier architecture with data isolation
- [x] Create junction tables with CASCADE delete and UNIQUE constraints
- [x] Add cluster-scoped API endpoints with mandatory validation
- [x] Implement idempotent relationship management
- [x] Add frontend validation with Material-UI patterns
- [x] Fix domain selection to show only cluster domains
- [x] Update comprehensive EN/RU documentation

### Template Package Modularization (2025-08-30) ✅

Complete architectural refactoring - extracted templates into dedicated packages.

**Shared Packages:**
- [x] Created `@universo-platformo/types` with UPDL interfaces
- [x] Created `@universo-platformo/utils` with UPDLProcessor
- [x] Implemented dual build system (CJS + ESM + Types)

**Template Extraction:**
- [x] Extracted AR.js Quiz to `@universo/template-quiz`
- [x] Extracted PlayCanvas MMOOMM to `@universo/template-mmoomm`
- [x] Implemented TemplateRegistry for dynamic loading
- [x] Fixed ship duplication and reduced logging in templates

### MMOOMM Template Refactoring (2025-08-14) ✅

Critical architecture fixes - modular package created with multiplayer support.

**Critical Fixes:**
- [x] Fix Colyseus 0.16.x client API usage (room.state events)
- [x] Replace hardcoded connection URLs with environment variables
- [x] Add proper error handling and multiplayer connection logging

**Template Extraction:**
- [x] Create `apps/template-mmoomm/base` workspace package
- [x] Extract all MMOOMM handlers and build systems
- [x] Fix import paths and TypeScript compilation
- [x] Verify `publish-frt` integration with template package

### Build Order & Finance Integration (2025-08-31) ✅

Stabilized build system and integrated Finance applications.

- [x] Enforce topological build order via workspace dependencies
- [x] Remove circular dependency from `apps/finance-frt` to `flowise-ui`
- [x] Unify i18n to TypeScript in template packages
- [x] Validate `exports` and `dist` artifacts for templates
- [x] Integrate Finance apps into server and UI routes
- [ ] Add Finance apps documentation (EN/RU)
- [ ] Create "Creating New Apps/Packages" guide
- [ ] Connect missing `tasks-registry.md` to SUMMARY

## Spaces + Canvases Refactor (2025-09-07)

Separate Canvas routes and improve UX with local API clients.

- [x] Prevent legacy Chatflow effects in Spaces mode
- [x] Improve Canvas Tabs UX (borders, spacing, spinner)
- [x] Add local Axios client in `apps/spaces-frt`
- [x] Add local `useApi` and `useCanvases` hooks
- [x] Load Spaces list from `apps/spaces-frt` in UI
- [x] Remove unused Flowise UI files and fix Vite alias collisions
- [ ] Migrate minimal UI wrappers to `apps/spaces-frt/src/ui/`
- [ ] Move repeated component styles to theme overrides
- [ ] Remove remaining unused Flowise UI pieces

## Active Implementation Tasks

### Metaverse - Backend + Frontend MVP

Complete metaverse functionality with membership and links management.

**Backend:**
- [x] Create `@universo/metaverse-srv` with Express router `/api/v1/metaverses`
- [x] Implement TypeORM migrations with `metaverse` schema
- [x] Add per-request Supabase client with Authorization header
- [x] Mount router and aggregate migrations in server
- [ ] Run Postgres migrations on Supabase (UP-test)
- [ ] Add update/delete/get-by-id endpoints
- [ ] Implement membership CRUD and links management

**Frontend:**
- [x] Create `@universo/metaverse-frt` with MetaverseList component
- [x] Register i18n bundle and add menu item
- [x] Implement dual build (CJS/ESM) with gulp assets
- [ ] Add membership management UI (roles, default toggle)
- [ ] Implement link editor (create/remove/visualize)
- [ ] Complete documentation (EN/RU)

### Space Builder - Multi-provider & Quiz Features

Enhance Space Builder with better provider support and editing capabilities.

**Multi-provider Support:**
- [x] Implement `/config` endpoint with test mode detection
- [x] Add multi-provider support (OpenAI, Groq, Cerebras, etc.)
- [x] Enforce test-only selection when credentials disabled
- [x] Update documentation (EN/RU)
- [ ] Stabilize credentials selection for non-test mode

**Quiz Enhancement:**
- [x] Add `/prepare` endpoint with strict Zod QuizPlan schema
- [x] Implement deterministic fallback graph generation
- [x] Add three-step flow (Prepare → Preview → Settings)
- [x] Add constraints input and iterative quiz editing
- [x] Implement Creation mode (New Space/Clear/Append)
- [ ] Add editable quiz preview
- [ ] Improve credentials selection reliability

### AR.js Wallpaper Mode

Enhance markerless AR experience with additional options.

- [x] Add AR Display Type selector (default wallpaper)
- [x] Implement markerless scene with wireframe sphere
- [x] Add persistence for arDisplayType/wallpaperType
- [x] Update backend to extract renderConfig
- [x] Update documentation (EN/RU)
- [ ] Add more wallpaper presets (gradient grid, starfield)
- [ ] Add mobile camera performance check
- [ ] Add usage metrics for display type selection

## Completed Refactoring Tasks

### MMOOMM Entity Hardcode Elimination (2025-08-06) ✅
- [x] Fix hardcoded transform values overriding UPDL settings
- [x] Implement conditional logic for default values only when UPDL unset
- [x] Fix variable scope conflicts and preserve game functionality

### MMOOMM Template Modularization ✅
- [x] Extract ship.ts logic to shared templates (90.6% code reduction)
- [x] Create modular inventory system with material density support
- [x] Refactor PlayCanvasMMOOMMBuilder (79% reduction: 1,211→254 lines)
- [x] Implement enhanced resource system with 16 material types

### Multiplayer Colyseus Implementation (2025-08-22) ✅
- [x] Create `@universo/multiplayer-colyseus-srv` package
- [x] Implement MMOOMMRoom with 16-player capacity
- [x] Add Colyseus schemas (PlayerSchema, EntitySchema, MMOOMMRoomState)
- [x] Integrate multiplayer client with ship controls and mining
- [x] Fix UPDL objects in multiplayer mode
- [x] Verify backward compatibility with single-player

## Strategic Goals

### Post-Alpha Features
- [ ] Implement physics simulation node for complex interactions
- [ ] Add keyframe animation node for dynamic content
- [ ] Implement multiplayer networking capabilities
- [ ] Add multi-scene UPDL projects support

### Production Deployment
- [ ] Implement scalable hosting solutions
- [ ] Optimize platform performance for production
- [ ] Add security enhancements for production
- [ ] Implement monitoring and analytics systems

### Community Features
- [ ] Implement template sharing and collaboration
- [ ] Develop multi-user editing capabilities
- [ ] Create marketplace for templates and components
- [ ] Enhance documentation and tutorial systems

### Auth System - Passport.js + Supabase (PoC)
- [x] Create isolated packages `apps/auth-srv/base` and `apps/auth-frt/base`
- [x] Implement server-side sessions with CSRF and rate-limit
- [x] Ensure PNPM workspace build success
- [x] Add RU/EN READMEs with rollout plan
- [ ] Integrate session-based Supabase client
- [ ] Remove localStorage tokens, switch to `withCredentials`
- [ ] Add production hardening (Redis, HTTPS, SameSite)
