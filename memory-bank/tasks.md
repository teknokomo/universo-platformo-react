## IMPLEMENT - Localized Canvas Naming Fix (2025-09-23)

- [x] Frontend: Replace temp canvas rename flow with local state in Canvas/CanvasTabs and ensure localized default propagates on save.
- [x] Backend: Extend Spaces create pipeline with defaultCanvasName validation and localized seeding.
- [x] Cleanup: Remove auto-rename side effects, adjust tests, and document the new behavior.

## PLAN - Canvas Versioning MVP (2025-09-23)

### Overview
- Establish manual canvas versioning so each Space can store multiple saved snapshots per canvas while keeping backwards compatibility with existing Flowise chatflow storage.
- Prepare the data model for future publication links that can point either to the active version or to a specific saved version (planned `/b/{versionUuid}` URLs).

### Affected Areas
- Database: `apps/spaces-srv/base/src/database/migrations/postgres/1743000000000-SpacesCore.ts`, `apps/spaces-srv/base/src/database/entities/{Canvas.ts,SpaceCanvas.ts}`.
- Backend services and API: `apps/spaces-srv/base/src/services/spacesService.ts`, `apps/spaces-srv/base/src/controllers/spacesController.ts`, `apps/spaces-srv/base/src/routes/spacesRoutes.ts`, DTOs under `apps/spaces-srv/base/src/types`.
- Frontend: `apps/spaces-frt/base/src/views/canvas/*`, especially `CanvasHeader.jsx`, dialogs under `packages/ui/src/ui-component/dialog`, hooks in `apps/spaces-frt/base/src/hooks`, and API clients in `apps/spaces-frt/base/src/api`.
- Shared Flowise components leveraged by dialogs (reuse patterns from `ViewLeadsDialog.jsx` and `UpsertHistoryDialog.jsx`).

### Step Breakdown
- [ ] **Data Model Extensions**: Add versioning columns to `canvases` (e.g., `version_group_id`, `version_index`, `version_uuid`, `version_label`, `version_description`, `is_active`) and adjust `spaces_canvases` if we need to differentiate active linkage versus archived entries. Ensure transactional integrity and unique constraints (one active version per `(space_id, version_group_id)`).
- [ ] **Entity & DTO Updates**: Reflect new fields in TypeORM entities and API DTOs, keeping optional fields for backward compatibility with existing Flowise UI calls.
- [ ] **Repository Logic**: Extend `SpacesService` to load version collections, create new versions (clone flow + metadata), switch active version, and delete archived versions while respecting storage cleanup. Ensure `createSpace` seeds an initial version group.
- [ ] **API Surface**: Introduce REST endpoints such as `GET /spaces/:spaceId/canvases/:canvasId/versions`, `POST /spaces/:spaceId/canvases/:canvasId/versions`, `POST /canvases/:canvasId/versions/:versionId/activate`, and `DELETE /canvases/:canvasId/versions/:versionId`. Maintain compatibility with legacy `/canvases/:canvasId` operations by always returning the active version.
- [ ] **Frontend State Management**: Extend `useCanvases` (or dedicated hook) to fetch, cache, and mutate version lists. Keep Redux slice updates minimal while surfacing active version metadata to existing components.
- [ ] **Versions Dialog UI**: Build a versions management dialog in `apps/spaces-frt/base/src/views/canvas` (or colocated) that mirrors table interactions from `ViewLeadsDialog` (basic tabular list) while allowing create/activate/delete actions. Include metadata editing inputs for version label/description.
- [ ] **Settings Menu Integration**: Replace or augment the current "Upsert History" menu item in `CanvasHeader.jsx` with "Canvas Versions" linking to the new dialog. Preserve access to the existing Upsert History dialog via secondary navigation if still needed.
- [ ] **Publication Readiness**: Store `version_uuid` for each saved version so later publishing services can generate `/b/{uuid}` links. Document how to resolve active vs explicit versions when building shareable URLs.
- [ ] **Testing & Documentation**: Add service-level unit tests for version operations, adapt existing integration specs, and document workflows in `docs/en/applications/spaces/README.md` plus memory-bank updates.

## IMPLEMENT - Canvas Versioning Backend (2025-09-23)

- [x] Migrate the existing Supabase schema (Postgres + SQLite variants) to include canvas version metadata, enforce a single active version per group, and backfill current rows so every canvas is seeded as its own active version.
- [x] Extend TypeORM entities (`Canvas`, `SpaceCanvas`, `ChatFlow`) and related repository helpers to surface the new columns with sensible defaults.
- [x] Implement version lifecycle logic inside `SpacesService`, providing methods to list, create (clone), activate, and delete versions while keeping legacy canvas APIs functional.
- [x] Update DTOs, controller handlers, and Express routes to expose REST endpoints for version management alongside existing canvas operations.
- [x] Align Flowise `chatflows` service with version groups so auto-provisioned canvases/spaces use the correct metadata during creation and updates.

### Implementation Checklist (2025-09-23)
- [x] Update Postgres + SQLite migrations to add version metadata, defaults, indexes, and data backfill aligned with existing tables.
- [x] Reflect version columns across TypeORM entities and shared interfaces to keep Flowise compatibility.
- [x] Extend `SpacesService` with transactional version lifecycle helpers and reuse them in controllers/routes.
- [x] Expose REST DTOs and handlers for listing/creating/activating/deleting versions.
- [x] Synchronize Flowise `chatflows` service with version groups during create/update flows.

### Potential Challenges
- Maintaining backward compatibility with Flowise components that expect a single `canvas.id` while we introduce version grouping.
- Enforcing a single active version per canvas group inside existing tables without adding new migrations (must alter current migration safely).
- Handling large `flowData` cloning efficiently and ensuring storage cleanup does not delete assets shared across versions.
- Coordinating future publication routes so they can dereference archived versions without duplicating business logic.

### Follow-up Tasks (Detailed Prompts)
- **Task 1 — Backend Data Model & Services**: "Extend `apps/spaces-srv/base` to support versioned canvases by updating the existing Postgres migration and entities with version metadata, enforcing one active version per group, and exposing service methods plus REST endpoints to list/create/activate/delete versions while keeping legacy canvas operations functional."
- **Task 2 — Frontend Version Management UI**: "Implement a Canvas Versions dialog inside `apps/spaces-frt/base` that consumes the new API, displays version lists with labels/descriptions, enables manual saves, activation, and deletion, and wires the dialog into `CanvasHeader` settings alongside notifications."
- **Task 3 — Documentation & Tests**: "Document the canvas versioning workflow (EN/RU) across spaces READMEs, update memory-bank notes, and add automated tests covering backend version lifecycle plus frontend interaction smoke cases."

## IMPLEMENT - Chatflow Router Consolidation (2025-09-24)

- [x] Mount `apps/spaces-srv` Space/Canvas router under the Unik resource by composing it inside `createUniksRouter`, ensuring parameter aliases (`id` vs `unikId`) remain compatible with existing clients.
- [x] Remove the duplicate Spaces router mount from `packages/server/src/routes/index.ts` and rely on the unified Unik router wiring while keeping rate limiting/auth behaviour intact.
- [x] Update Jest route tests and mocks to account for the embedded Spaces router, providing a stub implementation for `createSpacesRoutes` and verifying the Unik router bootstraps without errors.

## PLAN - Chatflow → Space Consolidation (2025-09-23)

### Overview
- Complete the migration from legacy Flowise `Chatflow` naming to the new Space/Canvas architecture by relocating remaining services and UI into `apps/spaces-srv` and `apps/spaces-frt`, while preserving compatibility with existing database rows and APIs consumed by other modules.
- Reduce confusion for future work by providing clear alias layers, updated documentation, and a phased removal plan for temporary Chatflow bridges.

### Affected Areas
- **Backend core**: `packages/server/src/services/chatflows`, `packages/server/src/routes/{chatflows,chatflows-streaming,public-chatflows}`, shared interfaces in `packages/server/src/Interface.ts`, and TypeORM entities under `packages/server/src/database/entities`.
- **Spaces service**: `apps/spaces-srv/base/src/{services,controllers,routes,types}`, migrations referencing `chatflows`, and export surface consumed by the server.
- **Frontend**: `packages/ui/src/views/chatflows`, navigation under `packages/ui/src/routes/MainRoutes.jsx`, sidebar/menu configuration, and translations under `packages/ui/src/i18n/locales/*`.
- **Documentation & tests**: READMEs in `docs/en|ru`, `memory-bank` notes, and jest/vitest specs under `packages/server/test` and `apps/spaces-frt/base/src`.

### Step Breakdown
- [ ] **Inventory & Alias Layer**: Produce a mapping table of every `Chatflow` reference (services, entities, routes, i18n keys) and introduce typed aliases in `packages/server/src/Interface.ts` so downstream consumers can start using `Canvas` terminology without breaking imports.
- [ ] **Backend Service Extraction**: Move the business logic in `packages/server/src/services/chatflows` into `apps/spaces-srv/base`, exposing thin adapters that the legacy router can delegate to during the transition. Ensure transactional helpers (e.g., `purgeUnikSpaces`) remain shared.
- [ ] **API Restructuring**: Replace the `/chatflows` routers mounted under `/unik/:id` with `/spaces` endpoints implemented inside `apps/spaces-srv/base`, keeping compatibility middleware for existing clients and updating rate limiters and auth guards accordingly.
- [ ] **Frontend Migration**: Relocate `packages/ui/src/views/chatflows` screens into `apps/spaces-frt/base` (or retire them if redundant), update navigation to highlight Spaces-first workflows, and adjust hooks/components to consume the new API clients.
- [ ] **Terminology Cleanup**: Update i18n resources, documentation, and test snapshots to use Space/Canvas terminology, providing migration notes where public APIs still mention `chatflowId` parameters.
- [ ] **Bridge Removal**: Once new routes are validated, delete deprecated Chatflow entities/routers from `packages/server` and replace remaining references with re-exported types from `apps/spaces-srv/base`.

### Potential Challenges
- Coordinating changes across multiple packages without breaking Supabase migrations or existing automation that still sends `chatflowId` payloads.
- Maintaining compatibility for Marketplace templates and Flowise import/export tooling that expect `Chatflow` names.
- Ensuring UI lazy imports resolve correctly once modules move under `apps/spaces-frt/base` (avoid circular workspace dependencies).

### Design Notes
- Adopt a two-layer naming strategy: keep database columns like `chatflowid` for now, but expose new TypeScript interfaces (`CanvasId`) and helper mappers to prepare for eventual column rename migrations.
- Favor dependency injection when moving services so that `packages/server` only wires Express routers while business logic lives in `apps/spaces-srv/base`.
- Provide codemod-ready utility functions (e.g., `renameChatflowKeysToCanvas`) to normalize API responses before they reach the UI.

### Dependencies
- Requires stabilized session/auth middleware from `apps/auth-srv/base` and Unik access control from `packages/server/src/services/access-control` to avoid regression while routes shift.
- Dependent on canvas versioning work to prevent merge conflicts in `apps/spaces-srv/base/src/services/spacesService.ts`.
- Coordinate with template marketplace updates to confirm no hardcoded `/chatflows` URLs remain in JSON fixtures under `packages/server/marketplaces`.

### Follow-up Tasks (Detailed Prompts)
- **Task 1 — Backend Chatflow Extraction**: "Refactor `packages/server/src/services/chatflows` by moving core CRUD logic into `apps/spaces-srv/base` services, expose compatibility adapters for existing routers, and update shared interfaces to introduce `Canvas` terminology while keeping database compatibility."
- **Task 2 — Spaces API & Router Migration**: "Replace legacy `/chatflows` Express routers under `packages/server/src/routes` with routes imported from `apps/spaces-srv/base`, update middleware wiring to rely on `unikId` context, and adjust rate limiting/auth configuration so `/unik/:id/spaces` and `/unik/:id/canvases` are the primary entry points."
- **Task 3 — Frontend & Docs Rename**: "Migrate remaining Chatflow UI screens into `apps/spaces-frt/base`, update navigation/i18n to prefer Space/Canvas naming, adapt API clients, and refresh documentation plus memory-bank notes to describe the consolidated architecture."

## IMPLEMENT - Chatflow Service Migration (2025-09-24)

- [x] Establish transitional alias layer by cataloguing remaining `Chatflow` references and introducing Canvas-first types/utilities in `packages/server/src/Interface.ts`, updating key consumers to rely on the new names.
- [x] Extract core CRUD/business logic from `packages/server/src/services/chatflows` into `apps/spaces-srv/base/src/services`, exposing adapter exports that keep legacy imports functional during rollout.
- [x] Replace the Express router wiring under `packages/server/src/routes` to delegate `/unik/:id` chatflow endpoints to the new Spaces service/controller layer while keeping backwards-compatible request/response shapes.

## IMPLEMENT - Space Builder Canvas Mode (2025-09-22)

- [x] Update SpaceBuilderDialog creation modes to support newCanvas defaults and localized labels for saved spaces.
- [x] Propagate allowNewCanvas through Space Builder triggers and keep apply handlers consistent across entry points.
- [x] Extend Spaces canvas view to create a dedicated canvas for generated graphs and synchronize React Flow state.
- [x] Enhance useCanvases.createCanvas to accept initial flow payloads and surface errors cleanly to callers.
- [x] Refresh Space Builder tests/documentation for the new mode and execute the targeted frontend test suite.

## IMPLEMENT - Unik Cascade Consolidation (2025-09-22)

- [x] Decouple @universo/spaces-srv from direct Unik entity import by switching `Space` to string-based relations and updating related tests/build config.
- [x] Introduce a shared purge helper under `apps/spaces-srv/base/src/services` that accepts an `EntityManager` plus target identifiers to remove spaces, canvases, and chat/document-store/storage artifacts.
- [x] Refactor `SpacesService.deleteSpace` to delegate its cleanup work to the shared helper while keeping single-space semantics and transaction boundaries.
- [x] Update `apps/uniks-srv/base/src/routes/uniksRoutes.ts` to consume the helper, drop duplicated logic, and adjust mocks/tests to cover the new import path.
- [x] Extend automated coverage (spaces service + uniks route) and refresh memory-bank progress notes to describe the consolidated cascade behaviour.

## IMPLEMENT - PropTypes Runtime Fix (2025-09-20)

- [x] Подтвердить отсутствие `PropTypes` в production-бандле и указать проблемный модуль
- [x] Внести точечный патч, возвращающий безопасный доступ к `PropTypes` без поломки линтеров
- [x] Зафиксировать стратегию дальнейшей миграции с PropTypes на TypeScript в соответствующих заметках

## IMPLEMENT - Auth UI Regression (2025-09-20)

- [x] Document the root cause of the `/auth` refresh loop and capture UI requirements from the 2025-09-20 backup.
- [x] Restore the legacy login/registration layout in `packages/ui/src/views/up-auth/Auth.jsx` while reusing the new auth context.
- [x] Provide a compatible registration endpoint in `@universo/auth-srv` and wire up the frontend to use it; run `pnpm --filter flowise-ui build` for verification.

## IMPLEMENT - Uniks Schema Migration (2025-09-21)

- [x] Переключить серверные обращения Supabase (утилита + маршруты Uniks) на `schema('uniks')` с fallback на публичную схему.
- [x] Обновить тесты/типизацию после переноса и прогнать `tsc` для задействованных пакетов.
- [x] Задокументировать изменения в memory-bank и подготовить отчёт.

## IMPLEMENT - Passport.js Session Hardening (2025-09-21)

- [x] Consolidate auth middleware into shared packages
  - Move `ensureAuth` logic into `apps/auth-srv/base` with typed helpers for session tokens
  - Update `packages/server` to consume the shared middleware and drop `middlewares/up-auth`
- [x] Replace legacy Basic Auth usage in UI
  - Use `useAuth()` and the shared Axios client for logout, About dialog, AsyncDropdown, and streaming chat
  - Ensure streaming requests send cookies/CSRF tokens instead of Basic Auth headers
- [x] Refresh documentation and tooling for session flow
  - Remove `FLOWISE_USERNAME/PASSWORD` references from docs, docker configs, and CLI flags
  - Document required Passport.js/Supabase environment variables and session behaviour across languages

## IMPLEMENT - Passport.js Session MVP (2025-09-21)

- [x] Align auth packages for integration
  - Remove standalone Vite build from apps/auth-frt/base and expose reusable UI components
  - Ensure apps/auth-srv/base exports passport router and session utilities
- [x] Wire Passport.js session stack into packages/server
  - Add express-session, passport initialization, CSRF route, and mount new /api/v1/auth endpoints
  - Replace legacy token-based up-auth controllers with session-based flow
- [x] Update packages/ui authentication client
  - Replace localStorage token usage with cookie-based session checks via /auth/me
  - Add shared hooks/components consuming apps/auth-frt/base login form
- [x] Refresh docs and memory bank
  - Document new session flow in auth READMEs and update progress log

## Build Failure Fix - multiplayer-colyseus-srv (2025-09-20)

Objective: Fix TypeScript build error "Cannot find module '@universo/multiplayer-colyseus-srv'" by resolving rootDirs issues and integrating ensurePortAvailable into @universo-platformo/utils.

- [x] Add ensurePortAvailable to @universo-platformo/utils
   - Create `src/net/ensurePortAvailable.ts` in utils package
   - Export from `src/net/index.ts`
- [x] Update dependencies in multiplayer-colyseus-srv
   - Add @universo-platformo/utils workspace dependency
   - Update imports to use utils package
- [x] Fix tsconfig.json in multiplayer-colyseus-srv
   - Remove problematic rootDirs configuration
   - Set baseUrl to "./src"
   - Remove tools include paths
- [x] Update dependencies in packages/server
   - Add @universo-platformo/utils workspace dependency
   - Update imports to use utils package
- [x] Fix tsconfig.json in packages/server
   - Remove problematic rootDirs configuration
   - Simplify include paths
- [x] Build and validate changes
   - Test individual package builds
   - Run full workspace build
- [x] Update memory-bank documentation
   - Document the fix in progress.md and activeContext.md
   - Clean up obsolete files (tools/network/ensurePortAvailable.ts)
   - Update package and docs READMEs with new net utilities

- [x] AR.js wallpaper: add flat shader to `a-sphere` background
  - Hide AR display type and wallpaper type fields when camera usage is "none"
  - Show background color picker when camera usage is "none"
  - Add background color field to form state management
- [x] Update backend chatbotConfig schema
  - Add backgroundColor field to arjs section
  - Ensure proper saving/loading from Supabase canvases table
- [x] Update ARJSQuizBuilder 
- [x] Test the complete flow
  - Frontend form shows/hides fields correctly
   - Added optional `wallpaperType === 'sky'` to generate `<a-sky>`; extended `DataHandler` to treat `a-sky` as always visible.
- [x] Adjust DataHandler visibility logic

# Tasks Tracker
### Objective
Fix incorrect i18n namespaces/usages causing raw keys to appear in UI for Publish AR.js and API dialogs.

### Plan
### Notes
 - Completed normalization fixes eliminate visible raw keys in top-right API dialog and embed/share panels.
   - Move tables into uniks schema; rename user_uniks to uniks_users; update policies (completed 2025-09-21)
   - Implemented membership + auth.uid() RLS policies replacing broad auth.role() rules
### План работ
- [x] Подготовить конфигурацию TypeScript: добавить `tsconfig.types.json`, обновить `tsconfig.json`/`tsconfig.esm.json` для чётких путей, `rootDir`, `moduleResolution`.
## Current Implementation - QR Code Download Notification Fix (2025-09-18)

### [x] Task 1: Add Download Success Notification
- Added Snackbar component to QRCodeSection.jsx
### [x] Task 2: Update UI Components
- Added Material-UI Snackbar import
- Confirmed `downloadSuccess` key exists in both en/main.json and ru/main.json
- English: "QR code saved successfully"
- Successfully built publish-frt with updated QR code notification
- QR code download now shows proper user feedback

- Update both wallpaper and marker modes in ARJSQuizBuilder.ts

### [x] Task 2: Fix UI Field Ordering
- Move "Использование камеры" field to appear after "Шаблон экспорта" 
- Reorder FormControl components in ARJSPublisher.jsx
- Maintain all existing conditional logic and functionality

### [x] Task 3: Enhance Debug Logging  
- Add console logs in ARJSQuizBuilder to track `cameraUsage` value
- Log whether `arjs` attribute is added or removed
- Fixed invalid HTML generation causing "кусок кода" artifacts
- Removed comment injection into tag attributes
### [x] Task 5: Complete Camera Entity Removal
- Fixed all camera entity creation points in ARJSQuizBuilder.ts
### [x] Task 6: Fix Library Loading Logic
- Updated getRequiredLibraries() to conditionally exclude AR.js when cameraUsage='none'
### [x] Task 7: Fix AR-обои (Wallpaper) for No-Camera Mode
- **Problem**: AR-обои didn't work with cameraUsage='none' because AR.js was completely disabled
- Now: wallpaper + cameraUsage='none' = A-Frame 3D scene without AR.js or camera

### [x] Task 8: Package Build and Validation
- Build template-quiz package with all camera disable logic
- Validate TypeScript compilation across affected packages

### Status: ✅ COMPLETED
All tasks implemented and built successfully. Camera usage settings now properly:
- Disable AR.js initialization when "Без камеры" is selected
- Allow AR-обои to work without camera using only A-Frame
- Fix HTML generation to prevent display artifacts
- Conditionally load only required libraries (A-Frame vs A-Frame+AR.js)

---

## Previous Implementation - QR Code Download Feature (2025-01-17)

### Objective
Implement QR code download functionality for published applications.

### [x] Task 1: Create SVG to PNG Conversion Utility
- Create a utility function to convert QR code SVG to high-quality PNG image (512x512)
- Add proper loading states during download process
- Position button appropriately in the component layout

- Connect QR code SVG element with download functionality
- Generate appropriate filename for downloaded file
- Handle download errors with user feedback

### [x] Task 4: Add Internationalization Support
- Add download-related translation keys to Russian language file
- Add corresponding English translations
- Include loading, success, and error message keys

- Validate that all changes integrate properly

### Status: ✅ COMPLETED
All tasks have been successfully implemented. QR code download feature is ready for testing.
## Previous Fix - AR.js Internationalization (2025-01-17)


### Objective
Fix quiz lead saving functionality to ensure quiz completion always creates exactly one lead record.

### AR.js Internationalization Fix - COMPLETED ✅

**Problem**: When opening published AR.js applications (localhost:3000/p/[id]), users saw language keys like 'general.loading' instead of translated text during loading screens.

**Root Cause**: 
- useTranslation() hooks called without namespace specification
- Translation key mismatches between code and language files

**Solution**:
- ✅ **Fixed PublicFlowView.tsx**: Updated useTranslation('publish'), corrected 'common.loading' → 'general.loading'
- ✅ **Fixed ARViewPage.tsx**: Updated useTranslation('publish'), corrected 'publish.arjs.loading' → 'arjs.loading'  
- ✅ **Added Missing Keys**: Added 'applicationNotAvailable' to both Russian and English translation files
- ✅ **Package Rebuild**: Successfully compiled publish-frt package

---

**Status**: ✅ **COMPLETED**

### Problem Identified
After initial fix for duplicate records, quiz completion stopped creating ANY lead records due to overly restrictive `leadData.hasData` condition.


### Solution Implemented

#### 1. Universal Lead Saving
- ✅ **Form Data Check**: Check if `leadData.hasData` is false (no form used)
- ✅ **Basic Record Setup**: Set name/email/phone to null for basic completion tracking
- ✅ **Enable Saving**: Set `hasData = true` to enable saveLeadDataToSupabase call
saveLeadDataToSupabase(leadData, pointsManager.getCurrentPoints());
```

### Files Modified
- ✅ **Removed Duplicates**: Eliminated duplicate call from showQuizResults function
- ✅ **Race Condition Protection**: Global flag prevents timing issues

Quiz lead saving now works correctly:
- **Every quiz completion** creates exactly **one lead record**
- **Form-based leads** save collected name/email/phone data
- **Basic leads** save null values for tracking completion with points
- **No duplicates** due to global deduplication system
- **No missing records** due to universal saving logic

### Post-Fix Enhancement (2025-09-17)
Logging noise reduction implemented:
- Added `QUIZ_DEBUG` flag (default false) and `dbg()` wrapper.
- Converted verbose scene enumeration, object highlighting, incremental point logs to conditional debug output.
- Retained only essential production logs: init, results screen, lead save attempt, lead save success/failure, ID warning.
- Simplifies console during normal operation while preserving ability to re-enable diagnostics quickly.
- [x] Add PUBLISH section to .env and .env.example files with global library management settings
- [x] Create PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT and PUBLISH_DEFAULT_LIBRARY_SOURCE environment variables
- [x] Add getGlobalSettings method to PublishController for retrieving server environment settings
- [x] Create /api/v1/publish/settings/global endpoint to expose global settings to frontend
- [x] Add getGlobalSettings method to PublicationApi frontend client
- [x] Update ARJSPublisher component to load and use global settings
- [x] Implement frontend logic to prioritize global settings when enabled
- [x] Add UI indicators showing when global library management is active
- [x] Disable library source selection controls when global management is enabled
- [x] Build and validate full implementation works correctly

### Bug Fix - URL Parsing in getCurrentUrlIds (2025-09-16)
- [x] Identify root cause: getCurrentUrlIds function using legacy '/uniks/' regex pattern
- [x] Update regex to support both new singular '/unik/' and legacy '/uniks/' patterns
- [x] Test AR.js Publisher load/save functionality after URL parsing fix
- [x] Audit codebase for other similar URL parsing issues (none found)
- [x] Validate publish-frt package builds successfully without TypeScript errors

### Global Library Management Implementation (2025-01-16)
- [x] Add PUBLISH section to .env and .env.example files with global library management settings
- [x] Create PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT and PUBLISH_DEFAULT_LIBRARY_SOURCE environment variables
- [x] Add getGlobalSettings method to PublishController for retrieving server environment settings
- [x] Create /api/v1/publish/settings/global endpoint to expose global settings to frontend
- [x] Add getGlobalSettings method to PublicationApi frontend client
- [x] Update ARJSPublisher component to load and use global settings
- [x] Implement frontend logic to prioritize global settings when enabled
- [x] Add UI indicators showing when global library management is active
- [x] Disable library source selection controls when global management is enabled
- [x] Build and validate full implementation works correctly

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

## IMPLEMENT - Space Builder Manual Safeguards (2025-09-22)

- [x] Guard the revise action when manual edits are pending so user changes cannot be discarded.
- [x] Prevent closing the Space Builder dialog while manual normalization is running to avoid post-unmount updates.
- [x] Cover the new safeguards with focused component tests or interaction specs.

## IMPLEMENT - Space Builder Manual Quiz Editing (2025-09-22)

- [x] Expose structured errors from `useSpaceBuilder` and add manual quiz normalization hook.
- [x] Add manual editing mode to `SpaceBuilderDialog` with guard against pending changes and ✅ insertion helper.
- [x] Implement backend manual quiz normalization endpoint with deterministic parser and tests.

## IMPLEMENT - Unik Deletion Cascade Cleanup (2025-09-23)

- [x] Implement transactional Unik deletion cascade in `apps/uniks-srv/base/src/routes/uniksRoutes.ts`, ensuring spaces, space_canvases, canvases, chat history, and document store references are purged before removing the Unik row.
- [x] Add integration coverage verifying DELETE `/unik/:id` removes spaces, canvases, chat artefacts, and storage folders for a seeded Unik.
- [x] Document the cascade cleanup in `memory-bank/progress.md` with implementation notes and follow-up considerations.
