# Progress Log

> **Note**: This file tracks completed work with dates and outcomes. For active tasks, see `tasks.md`. For architectural patterns, see `systemPatterns.md`.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination, Publish slug system, Role-based permissions, Publication system with Base58 links |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Localized default canvas handling, Chatflow→Canvas API refactoring, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors, QR code download, Testing strategy & shared utilities, AR.js camera disable mode, Passport.js + Supabase session architecture |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes, Space Builder provider/model selection, Metaverses module introduction, Singular routing pattern |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Resources & Entities modules, Dual CJS/ESM builds, TypeORM migrations, Material-UI integration, Spaces/Canvases refactor |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Template modularization (@universo-platformo packages), Finance integration, Language switcher, MMOOMM i18n integration, Build order stabilization |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Colyseus multiplayer server, PlayCanvas architecture refactoring |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder multi-provider, Metaverse MVP, Core packages (@universo-platformo/types, utils) |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌 | Space Builder, AR.js wallpaper mode, MMOOMM extraction, Uniks separation |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️ | Russian docs, MMOOMM fixes, custom modes, conditional UPDL parameters |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️ | Laser mining, inventory consolidation, ship refactor, resource density |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪 | Memory Bank optimization, MMOOMM stabilization, improved ship controls |
| 0.20.0-alpha | 2025-07-13 | Tools Revolution 🔧 | Complete UPDL system, PlayCanvas rendering, Alpha status achieved |
| 0.19.0-pre-alpha | 2025-07-06 | | High-level UPDL nodes, PlayCanvas integration, template-first architecture, MMOOMM foundation |
| 0.18.0-pre-alpha | 2025-07-01 | | Flowise 2.2.8 upgrade, TypeScript compilation fixes, TypeORM conflicts resolution |
| 0.17.0-pre-alpha | 2025-06-25 | | Enhanced user profile fields, menu updates, profile-srv workspace conversion |
| 0.16.0-pre-alpha | 2025-06-21 | | Russian localization fixes, analytics separation, profile enhancements |
| 0.15.0-pre-alpha | 2025-06-13 | | Flowise 3.0.1 upgrade attempt (rollback to 2.2.7), UPDL scoring |
| 0.14.0-pre-alpha | 2025-06-04 | | AR.js library loading, AR bot removal, cleanup |
| 0.13.0-pre-alpha | 2025-05-28 | | AR.js library selection, flexible UPDL assembly |
| 0.12.0-pre-alpha | 2025-05-22 | | Removed pre-generation test, UPDL export cleanup |
| 0.11.0-pre-alpha | 2025-05-15 | | Global refactoring Stage 2, Gulp task manager, app separation |
| 0.10.0-pre-alpha | 2025-05-08 | | Memory bank updates, Publishing/UPDL enhancement |
| 0.9.0-pre-alpha | 2025-05-12 | | Refactored Publish & Export interface, ARJSPublisher/ARJSExporter separation |
| 0.8.5-pre-alpha | 2025-04-29 | | UPDL to A-Frame converter, publication flow |
| 0.8.0-pre-alpha | 2025-04-22 | | Enhanced Supabase auth, Memory Bank structure |
| 0.7.0-pre-alpha | 2025-04-16 | | First AR.js marker scene prototype |
| 0.6.0-pre-alpha | 2025-04-06 | | Chatbots module, Auth UI, language refactor |
| 0.5.0-pre-alpha | 2025-03-30 | | Document Store, Templates, i18n |
| 0.4.0-pre-alpha | 2025-03-25 | | Full Uniks feature-set |
| 0.3.0-pre-alpha | 2025-03-17 | | Basic Uniks functionality |
| 0.2.0-pre-alpha | 2025-03-11 | | Multi-user Supabase foundation |
| 0.1.0-pre-alpha | 2025-03-03 | | Initial project scaffold |

---

## Recent Completed Work (2025-10)

### 2025-10-26 — Memory Bank Compression ✅
**Problem**: Memory bank files had excessive historical details, violating memory-bank guidelines (activeContext should track current work only, not completed work).

**Execution**:
1. **tasks.md**: Compressed 3922 → 369 lines (90.6% reduction)
   - Removed completed/obsolete tasks from Oct 2024-Jan 2025
   - Kept only active/planned tasks with clear structure
   - Backup: `archived/tasks-backup-2025-10-26.md`
   
2. **progress.md**: Compressed 3668 → 318 lines (91.3% reduction)
   - Condensed historical achievements into concise entries
   - Added missing critical sections (AR.js config, TanStack Query pagination, backend cleanup)
   - **Added version history table** at the top (37 releases from v0.1.0 to v0.34.0-alpha)
   - Preserved all important technical decisions and dates
   - Backup: `archived/progress-backup-2025-10-26.md`
   
3. **activeContext.md**: Compressed 2520 → 199 lines (92.1% reduction)
   - Removed 95% historical completed work (i18n fixes, tsdown migration, QueryClient integration, Publication system)
   - Focused on current active work: Global Repository Refactoring (package consolidation, code extraction)
   - Documented recent achievements (last 2 weeks only)
   - Listed active blockers (CommonJS shims, API migration) and immediate next steps
   - Backup: `archived/activeContext-backup-2025-10-26.md`

**Impact**:
- All files now follow memory-bank guidelines strictly
- Total space saved: 540KB → 25KB (95.4% reduction)
- Context clarity: Each file serves its distinct purpose
- Version history: Complete table of 37 releases with codenames and highlights
- All active work preserved, completed tasks moved to progress.md

### 2025-10-25 — i18n Defense-in-Depth Implementation ✅
**Goal**: Eliminate translation key display issues through multi-layer protection.
- **Layer 1**: Fixed sideEffects in package.json (template-mui, uniks-frt)
- **Layer 2**: Added explicit i18n imports in MainRoutesMUI.tsx
- **Layer 3**: Verified global imports in flowise-ui/src/index.jsx
- **Build**: All packages rebuilt (template-mui: 1384ms, uniks-frt: 4056ms, flowise-ui: 54.52s)
- **Docs**: Updated activeContext.md and systemPatterns.md

### 2025-10-23 — Metaverses i18n Single Entry Point ✅
**Goal**: Fix metaverses-frt i18n registration to prevent tree-shaking.
- Changed tsdown.config.ts: one entry for i18n (not split chunks)
- Updated package.json: sideEffects only for dist/i18n/*
- Rewrote src/i18n/index.ts: inline registerNamespace (like uniks-frt)
- Deleted src/i18n/register.ts
- **Menu Fix**: Updated dashboard.js with namespace:key format (uniks:menu.uniks, metaverses:menu.metaverses)
- **NavItem Enhancement**: Parse namespace:key in menu titles
- Build: metaverses-frt (4.2s), flowise-ui (1m 6s)

### 2025-10-21 — @flowise/chatmessage Package Created ✅
**Goal**: Eliminate ~3846 lines of code duplication.
- Created dedicated package for chat components
- Extracted 7 files from flowise-ui (ChatPopUp, ChatMessage, ChatExpandDialog, etc.)
- Build successful (29/29 packages)
- Savings: ~7692 lines eliminated (3 copies → 1 package)

### 2025-10-20 — @flowise/template-mui Build Success ✅
**Critical Fixes**:
- Dynamic import extensions removed (Rolldown module resolution fix)
- Shim path corrections for relative imports
- 7 dialog stubs + 2 view stubs created
- d.ts bundling: disabled rolldown-plugin-dts, using tsc instead
- **Build**: JS bundles (17MB CJS, 5.2MB ESM) + declarations (5KB) + CSS (952B)
- **Import Fixes**: spaces-frt relative paths → @ui/... (5 files fixed)
- **Full Workspace**: 27/27 packages successful (2m 56s)

### 2025-10-19 — White Screen Error Fixed ✅
**Problem**: `/unik/.../spaces/new` showed white screen with `TypeError: Tl is not a function`
**Root Cause**: 9 canvas components importing useTranslation from react-i18next directly
**Solution**:
- Created useGlobalI18n hook (access window.__universo_i18n__instance)
- Fixed all 9 files (CanvasHeader, index, CanvasNode, NodeInputHandler, NodeOutputHandler, CanvasVersionsDialog, CredentialInputHandler, AddNodes, StickyNote)
- Full rebuild: 26/26 packages (2m 36s)

### 2025-10-18 — Build System Fixes ✅
**UI Runtime Shims**: globalRequire.ts, useSyncExternalStoreShim.ts (prevent white screens)
**flowise-components tsdown**: Converted to unbundled dual outputs, 350+ module.exports → ES exports
**Bundle Guard**: check-react-require.mjs script (prevent CommonJS React in browser)

### 2025-10-18 — tsdown Migration Complete ✅
**Packages Migrated** (7 total): spaces-frt, publish-frt, analytics-frt, profile-frt, finance-frt, uniks-frt, updl
**Critical Fix**: UPDL nodes not loading (removed conflicting module.exports from all 10 node files)
**SESSION_SECRET**: Generated secure 64-char hex
**Server Startup**: 10 UPDL nodes registered, Colyseus on :2567, Flowise on :3000

### 2025-10-18 — Circular Dependency Fix ✅
**Problem**: spaces-frt → UI → spaces-frt (baseURL import)
**Solution**: Extended @universo/utils with env module (getApiBaseURL), removed baseURL import
**Result**: Independent builds, flowise-ui successful (1m 10s)

### 2025-10-18 — Metaverses Migration Consolidation ✅
**Goal**: Clean up database migrations before production deployment
- Merged search indexes (LOWER("name"), LOWER("description")) into main migration
- Deleted redundant migration file: 1745000000000-AddMetaverseSearchIndexes.ts
- Updated migration exports in migrations/postgres/index.ts
- **Rationale**: Test project without active users - no legacy concerns
- **Build**: Backend migration successful, all packages compiled

### 2025-10-16 — Bug Fixes ✅
**Auth i18n**: Fixed translation keys (createAccount → registerLink, haveAccount → hasAccount, loginInstead → loginLink)
**Analytics API**: Added getAllLeads alias for getCanvasLeads
**AR.js Timer**: Fixed position validation (added 'top-center' to array)
**AR.js URL Parsing**: Fixed regex patterns to support both `/unik/` and legacy `/uniks/` URLs (prevented "unikId not found" error)
**AR.js Default Values**: Fixed library sources defaulting to 'kiberplano' instead of 'official' when global management disabled

### 2025-10-16 — Code Quality: Duplicate API Method Elimination ✅
**Goal**: Remove getAllLeads/getCanvasLeads duplication
**Solution**: Kept getCanvasLeads, updated Analytics.jsx (getAllLeadsApi → getCanvasLeadsApi)
**Tests**: 1/1 PASSED, 77.57% coverage

### 2025-10-13 — Architecture Simplification ✅
**Goal**: Remove adapter pattern, use direct component imports
- Deleted EntityFormDialogAdapter.tsx, ConfirmDeleteDialogAdapter.tsx (~140 lines)
- MetaverseActions: Direct imports from @universo/template-mui/components/dialogs
- Fixed i18n namespace: 'flowList' → 'metaverses'
- Build: No errors, no new lint warnings

### 2025-10-13 — Dialog Architecture + File Naming ✅
**File Naming**: Created .github/FILE_NAMING.md (PascalCase for JSX, camelCase for pure TS)
**ConfirmDeleteDialog**: New component (120 lines, full TypeScript)
**EntityFormDialog**: Enhanced with edit mode + delete button
**Type Definitions**: Full TypeScript interfaces in template-mui.d.ts
**Builds**: template-mui, metaverses-frt, resources-frt all successful

### 2025-10-12 — SkeletonGrid Component ✅
**Created**: Universal reusable component (81 lines)
**Eliminated**: ~180 lines of duplicate code across 15 files
**Code Reduction**: 92% per file (23 lines → 1 line)
**Location**: components/feedback/SkeletonGrid.tsx (following MUI conventions)

### 2025-10-12 — EmptyListState Quality Improvements ✅
**Task 1.1**: Improved TypeScript type definitions (removed any types)
**Result**: Full type safety, IntelliSense works correctly

## Major Completions (2025-09)

### 2025-09-16 — AR.js Configuration Management System ✅
**Legacy Handling**: Sophisticated legacy configuration handling for conflicting library settings
- **Two Modes**: Auto-correction (PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS=true) vs Recommendation (false)
- **Translation Fixes**: Fixed source name interpolation (recommendedSource → source with conditional translation)
- **Field Accessibility**: Fields editable in recommendation mode, auto-locked in enforcement mode
- **Alert Logic**: Single alert display (legacy replaces standard), clears when user complies
- **Global Management**: Environment-based control (PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT, PUBLISH_DEFAULT_LIBRARY_SOURCE)
- **Backend API**: /api/v1/publish/settings/global endpoint exposes server configuration
- **UI Enhancement**: Visual indicators when global management active, disabled controls with explanatory text

### 2025-09-24 — Chatflow → Space Consolidation ✅
- Moved flowise-server/src/services/canvass logic to spaces-srv
- Replaced /canvass routers with /spaces endpoints
- Updated frontend navigation and i18n to prefer Space/Canvas terminology

### 2025-09-23 — Canvas Versioning Backend ✅
- Added version metadata to canvases table (version_group_id, version_uuid, is_active, etc.)
- Implemented version lifecycle: list, create (clone), activate, delete
- REST endpoints: GET/POST/DELETE /spaces/:spaceId/canvases/:canvasId/versions
- Enforced single active version per group
- Published version links support via version_uuid

### 2025-09-22 — Space Builder Enhancements ✅
- Canvas mode support: newCanvas defaults, dedicated canvas for generated graphs
- Manual quiz editing with normalization endpoint
- Safeguards: pending changes guard, manual editing mode

### 2025-09-21 — Passport.js Session Hardening ✅
- Consolidated auth middleware in auth-srv package
- Replaced Basic Auth with session-based flow
- Updated docs to remove FLOWISE_USERNAME/PASSWORD references

### 2025-09-23 — Backend Cleanup & Cascade Fixes ✅
**Unik Deletion Cascade**: Transactional cleanup removes spaces, canvases, chat history, Document Store metadata
**Canvas Nested Routes**: Added /spaces/:spaceId/canvases/:canvasId scope enforcement
**Shared Purge Helper**: Decoupled Space entity, consolidated cleanup via purgeSpacesForUnik
**Uniks Schema Access**: Migrated REST layer to TypeORM, removed Supabase REST dependencies, fixed PGRST106 errors

### 2025-09-21 — TanStack Query Universal Pagination ✅
**Generic Hook**: usePaginated<TData, TSortBy> with placeholderData strategy, conditional retry logic
**Universal Controls**: PaginationControls component with debounced search, i18n support
**Type System**: PaginationParams, PaginationMeta, PaginatedResponse<T> in @universo/template-mui
**Refactoring**: Replaced app-specific hooks/components (metaverses-frt) with universal system
**Cache Invalidation**: Proper queryClient.invalidateQueries() after mutations

### 2025-09-20 — Auth & PropTypes Fixes ✅
**Auth UI**: Restored MUI login/registration layout with CSRF-protected /register endpoint
**PropTypes**: Reintroduced explicit import to prevent production crashes

### 2025-09-15 — Routing & Navigation Fixes ✅
**Singular Routes**: Migrated from /uniks to /unik
**Canvas Back Navigation**: Fixed extractUnikId helper (supports both unik/uniks)
**Unik List**: Added spacesCount column, enhanced SaveChatflowDialog with initialValue

## Archive: Major Features (2025-08/09)

### Publication System ✅
- Publication links MVP (group vs version links, Base58 slugs)
- Version publication feature (PublishVersionSection component)
- Global library management (backend PUBLISH settings, auto-correction/recommendation modes)
- AR.js wallpaper mode, timer position fixes, QR code generation
- Legacy configuration handling (translation fixes, field accessibility, alert logic)
- URL parsing fix (support for both /unik/ and /uniks/ patterns)

### Metaverses Application ✅
- Three-tier architecture (Clusters → Domains → Resources)
- Backend + Frontend MVP with membership management
- Individual routes implementation (sections, entities)
- Pagination system with integration tests

### Template System ✅
- AR.js Quiz extraction to @universo/template-quiz
- PlayCanvas MMOOMM to @universo/template-mmoomm
- Template registry for dynamic loading
- UPDL processor utilities (@universo-platformo/utils, @universo-platformo/types)

### Multiplayer ✅
- Colyseus integration (@universo/multiplayer-colyseus-srv)
- MMOOMMRoom with 16-player capacity
- Ship controls and mining mechanics

### Build System ✅
- tsdown migration (7 packages: spaces-frt, publish-frt, analytics-frt, profile-frt, finance-frt, uniks-frt, updl)
- Dual build (CJS + ESM + Types)
- Workspace dependency management

### UI Framework ✅
- @universo/template-mui package creation
- MainLayoutMUI routes and language switcher
- ItemCard component with responsive grid
- FlowListTable component
- Universal pagination (usePaginated hook, PaginationControls)

## Build Metrics

**Latest Full Workspace Build** (2025-10-20):
- Tasks: 27 successful / 27 total
- Time: 2m 56s
- All packages compile successfully

**Package Sizes**:
- @flowise/template-mui: 17MB CJS, 5.2MB ESM, 5KB d.ts
- @flowise/chatmessage: Full component set
- @universo packages: Dual format with proper exports

## Testing & Quality

**Test Coverage**:
- Analytics: 77.57% coverage
- Backend services: Unit tests + integration tests
- Jest suites passing across all packages

**Linting**:
- Zero new errors introduced
- 4 pre-existing warnings (documented, non-blocking)
- Prettier formatting enforced

## Documentation

**Updated**:
- activeContext.md: Current focus and recent changes
- systemPatterns.md: i18n patterns, event-driven data loading, pagination
- techContext.md: Package structure, build system
- .github/FILE_NAMING.md: Comprehensive naming conventions

**Languages**:
- Full EN/RU support across all packages
- i18n namespaces properly registered
- Translation keys validated

---

**Last Updated**: 2025-10-26
