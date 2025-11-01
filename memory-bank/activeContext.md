# Active Context

> **Last Updated**: 2025-10-31
>
> **Purpose**: This file tracks the current focus of development - what we're actively working on RIGHT NOW. Completed work is in `progress.md`, planned work is in `tasks.md`.

---

## Current Focus: JSX→TSX Migration & Role System - COMPLETED ✅

**Status**: Implementation Complete, Documentation Updated

**Summary**: Verified comprehensive implementation of centralized role system and JSX→TSX migration for core UI components. All code and infrastructure were already in place from previous sessions.

**Completed Actions** (Verification Phase):
1. ✅ **Phase 1**: Centralized Role Types
   - Verified `packages/universo-types/base/src/common/roles.ts` exists
   - Confirmed exports from `@universo/types` index
   - Verified imports in metaverses-frt, metaverses-srv, flowise-server
   - Build successful: @universo/types (3.2s)

2. ✅ **Phase 2**: RoleChip Component
   - Verified `packages/universo-template-mui/base/src/components/chips/RoleChip.tsx` exists
   - Confirmed exports from chips/index.ts and main index.ts
   - Verified usage in MetaverseList.tsx (3 usages)
   - Build successful: @universo/template-mui (1.9s), @universo/metaverses-frt (5.1s)

3. ✅ **Phase 3**: JSX→TSX Migration
   - Verified ItemCard.tsx (9254 bytes, generics implemented)
   - Verified MainCard.tsx (2721 bytes, forwardRef pattern)
   - Verified FlowListTable.tsx (21243 bytes, generic table)
   - No .jsx or .d.ts files found (clean migration)

4. ✅ **Phase 4**: Documentation & Build
   - Updated systemPatterns.md with "JSX→TSX Migration Pattern" section
   - Verified progress.md entry already exists (2025-01-19)
   - Full workspace build: 28/29 successful (flowise-ui error unrelated)
   - template-mui exports: No changes needed (single bundle via tsdown)

**Files Modified** (2 documentation files):
- `memory-bank/systemPatterns.md` - Added JSX→TSX Migration Pattern (145 lines)
- `memory-bank/tasks.md` - Updated all 4 phases to completed status
- `memory-bank/activeContext.md` - This update

**Build Results**:
```
@universo/types:build: ✔ Build complete in 3227ms
@universo/template-mui:build: ✔ Build complete in 1898ms
@universo/metaverses-frt:build: ✔ Build complete in 5115ms
Tasks: 28 successful, 29 total
```

**Key Findings**:
- All implementation work was completed in previous sessions
- RoleChip component: Color mapping (owner→error, admin→warning, editor→info, member→default)
- TypeScript generics fully functional: `ItemCard<T>`, `FlowListTable<T>`
- Role types centralized: `BaseRole`, `MetaverseRole`, `UnikRole`, `SectionRole`, `EntityRole`
- Zero new code written (verification-only session)

**Next Steps** (User Responsibility):
- [ ] Browser QA: Test MetaverseList with RoleChip display
- [ ] Verify role colors in both light/dark themes
- [ ] Test language switching (EN/RU) for role chips
- [ ] Check TypeScript autocomplete for `ItemCard<MetaverseData>` usage
- [ ] Fix flowise-ui import error (separate task, not blocking current work)

**Time Spent**: ~30 minutes (verification + documentation updates)

---

## Previous Focus: Pagination Component Refactoring - COMPLETED ✅

**Status**: Implementation Complete, Awaiting User Testing

**Summary**: Successfully simplified pagination component architecture and fixed design issues.

**Completed Actions**:
1. Deleted legacy `PaginationControls.tsx` (unused, with embedded search)
2. Renamed `TablePaginationControls.tsx` → `PaginationControls.tsx`
3. Updated all imports and exports across packages
4. Fixed design issue: wrapped pagination in Box with negative margins
5. Added diagnostic logging for troubleshooting
6. Updated all documentation (systemPatterns.md, progress.md, tasks.md)
7. Build verification: ✅ `pnpm build` successful (30/30 tasks)

**Files Modified** (9 files):
- Component: `packages/universo-template-mui/base/src/components/pagination/PaginationControls.tsx`
- Consumer: `packages/metaverses-frt/base/src/pages/MetaverseList.tsx`
- Docs: `memory-bank/systemPatterns.md`, `progress.md`, `tasks.md`

**Next Actions Required from User**:
- [ ] Run application in browser (`pnpm dev` or `pnpm start`)
- [ ] Navigate to Metaverses list
- [ ] Verify pagination controls aligned with content (no clipping)
- [ ] Test "Next" button navigation (should go to page 2)
- [ ] Test "Rows per page" selector (10, 20, 50, 100)
- [ ] Check browser console for `[MetaverseList Pagination Debug]` logs
- [ ] Verify Network tab shows `/metaverses?offset=X` with correct offset

**Diagnostic Tools Added**:
- Console logging: `[MetaverseList Pagination Debug]` with currentPage, offset, totalItems, etc.
- Network inspection: Check `/metaverses?offset=X` requests

---

## Previous Focus: TypeScript Module System Modernization 🔧

**Status**: Partially Complete (Temporary Workaround Applied)

### Task 2: moduleResolution Modernization ✅ (with caveats)

**Completed Actions**:
1. **Phase 1-2**: Updated 20+ TypeScript configs to modern settings
   - Frontend packages: `moduleResolution: "bundler"`, `module: "ESNext"`
   - Backend packages: `moduleResolution: "node16"`, `module: "Node16"`
   
2. **Phase 3 (Blocker Discovered)**: ESM Compatibility Issues
   - `bs58@6.0.0` (publish-srv) and `lunary` (flowise-server) are ESM-first packages
   - TypeScript's `moduleResolution: "node16"` strictly enforces ESM/CJS boundaries
   - Caused TS1479 error despite packages having CommonJS exports

3. **Temporary Fix Applied**:
   - Reverted `publish-srv` and `flowise-server` to `moduleResolution: "node"` + `module: "CommonJS"`
   - Allows TypeScript compilation to succeed
   - Node.js runtime correctly loads packages via their CommonJS exports
   - ✅ **All 30 packages now build successfully**

**Documentation**:
- Added "Known Issues & Workarounds" sections to:
  - `packages/publish-srv/base/README.md` (English)
  - `packages/publish-srv/base/README-RU.md` (Russian)
- Documented problem, temporary solution, and future migration paths

**Future Migration Needed** (Post-MVP):
- **Option A (Recommended)**: Migrate entire backend to ESM
  - Add `"type": "module"` to package.json
  - Update imports with `.js` extensions
  - Test TypeORM in ESM mode
  
- **Option B (Alternative)**: Use dynamic imports for ESM-only packages
  - `const bs58 = (await import('bs58')).default`
  
- **Option C (Quick Fix)**: Downgrade ESM packages to last CommonJS versions
  - Not recommended (loses updates/security fixes)

**Related**: See `tasks.md` → Backlog → "ESM Migration Planning"

---

## Current Focus: MetaverseList as Universal List Pattern Reference 🎯

**Status**: Completed (Ready for Replication)

### Universal List Pattern Implementation ✅

**Finalized**: `packages/metaverses-frt/base/src/pages/MetaverseList.tsx`

**Achievements**:
1. **Fixed UI Regression**: Search moved from PaginationControls back to ViewHeader
   - ViewHeader now contains search input (top right, as in original design)
   - PaginationControls only shows pagination info + navigation controls
   - Debounced search (300ms) synchronized with usePaginated hook

2. **Verified Backend API**: Full pagination support confirmed
   - Query params: limit, offset, sortBy, sortOrder, search
   - Response headers: X-Pagination-Limit, X-Pagination-Offset, X-Total-Count, X-Pagination-Has-More
   - Case-insensitive search filter on name and description

3. **Documented Pattern**: Added "Universal List Pattern" to `systemPatterns.md`
   - Complete implementation guide with code examples
   - Backend API requirements specification
   - Migration steps for existing lists
   - Reference links to usePaginated, PaginationControls, QueryKeys factory

**Next Phase**: Copy MetaverseList pattern to other entity lists
- **Primary Target**: UnikList migration (delete old → copy MetaverseList → rename entities)
- **Secondary Targets**: SpacesList, SectionsList, EntitiesList as needed

---

## Current Focus: i18n Left Menu Diagnostics 🧭

Status: In Progress

Context:
- Some users still see raw i18n keys in the left menu, while initialization logs show language resolved to `ru` and namespaces registered.
- The active renderer for the left menu is Universo `MenuContent` (under `MainLayoutMUI → SideMenu`).

Actions Taken:
- Added runtime diagnostics to `packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx` to log:
   - current language and resolved language
   - presence of `menu` namespace bundle
   - sample results for `t('uniks')` and `t('metaverses')`
   - per-item translation results

Next Steps:
- Validate logs in the browser to confirm the translation path and identify mismatches.
- If unresolved, verify whether legacy Flowise menu is rendered on some routes and adjust accordingly.

Update (2025-10-28):
- MetaverseList toolbar tooltips, primary action, and dialog buttons switched to `translation:*`; table headers use `metaverses.table.*` with EN fallbacks; BaseEntityMenu wired with `namespace='metaverses'` and `menuButtonLabelKey='flowList:menu.button'`.
- Confirmed `menu` namespace registration is flat (`menu: menuEn.menu`/`menuRu.menu`) in `@universo/i18n` instance.
- Full root build succeeded (30/30 tasks). Browser QA pending. Note: Vite reports a non-blocking warning about `Trans` not exported from `@universo/i18n` in APICodeDialog.jsx; track as follow-up.

## Current Focus: Global Repository Refactoring 🔨

**Status**: In Progress (Multi-Phase Restructuring)

### Phase 1: Package Structure Consolidation ✅

**Completed Changes**:
1. **Directory Consolidation**: Merged `apps/` into `packages/` directory
   - All applications now colocated with Flowise packages in single `packages/` folder
   - Renamed some package directories for consistency

2. **Build System Migration**: Replaced `tsc + gulp` with `tsdown` in multiple packages
   - Migrated packages: spaces-frt, publish-frt, analytics-frt, profile-frt, finance-frt, uniks-frt, updl
   - Benefits: Faster builds, dual output (CJS + ESM), better tree-shaking

3. **Centralized Dependency Management**: 
   - Implemented version pinning via `pnpm-workspace.yaml`
   - Ensures consistency across all packages

### Phase 2: Code Extraction to Dedicated Packages ✅

**New Packages Created**:

1. **`@flowise/template-mui`**: UI component library
   - Extracted significant portion of `flowise-ui` components
   - Contains layout components, dialogs, forms, cards, pagination
   - Build: JS bundles (17MB CJS, 5.2MB ESM) + declarations + CSS

2. **`@universo/spaces-frt`**: Canvas-related frontend code
   - Extracted from flowise-ui due to heavy dependencies
   - Contains canvas views, hooks, and space management

3. **`@universo/api-client`**: Centralized API client
   - TypeScript-based API layer with TanStack Query integration
   - Consolidates API calls across frontend packages

4. **`@flowise/store`**: Redux store extraction
   - Separated Redux logic from flowise-ui monolith

5. **`@flowise/chatmessage`**: Chat components
   - Extracted 7 files (ChatPopUp, ChatMessage, ChatExpandDialog, etc.)
   - Eliminated ~7692 lines of duplication (3 copies → 1 package)

6. **`@universo/i18n`**: Internationalization package
   - Centralized i18n configuration and translations

7. **`@universo/auth-frt`**: Authentication logic
   - Extracted from flowise-ui for reusability

8. **`@universo/universo-utils`**: Common utilities
   - Shared utility functions across packages

**Impact**: Reduced flowise-ui monolith complexity, improved modularity and reusability.

---

## Recent Technical Achievements

### Memory Bank Compression (2025-10-26) ✅
- **tasks.md**: Reduced 3922 → 369 lines (90.6% reduction)
- **progress.md**: Reduced 3668 → 252 lines (93.1% reduction)  
- Added missing critical sections (AR.js config management, TanStack Query pagination, backend cleanup)
- All backups safely stored in `archived/` directory

### i18n Defense-in-Depth (2025-10-25) ✅
- **Problem**: Menu items showing language keys instead of translations
- **Solution**: Three-layer protection:
  1. Updated `sideEffects` declarations in package.json
  2. Explicit i18n imports in MainRoutesMUI.tsx (before lazy components)
  3. Global imports in flowise-ui/src/index.jsx
- **Impact**: Eliminated translation key display issues

### Build System Stability (2025-10-18 to 10-20) ✅
- Fixed template-mui build: shim path corrections, dynamic import extensions removal
- All 27 packages build successfully (2m 56s)
- Full workspace dependency resolution working

---

## Active Blockers & Issues

### 1. flowise-ui Build Blocked by CommonJS Shims ⚠️
**Status**: BLOCKING - High Priority

- **Problem**: 49 shim files in `@flowise/template-mui` use CommonJS (`module.exports`)
- **Impact**: Vite requires ES modules for bundling, causing build failures
- **Progress**: 5/54 files converted (constant.js, useApi.js, useConfirm.js, actions.js, client.js)
- **Remaining**: 49 files need ES module conversion
- **Decision Needed**: Massive conversion vs alternative approach?

**Related Tasks**: See `tasks.md` → Active Tasks → Task 3.2

### 2. API Client Migration Incomplete ⏸️
**Status**: Deferred - Not Blocking

- **Completed**: Migrated 5 core APIs to TypeScript (canvas, spaces, credentials, leads, chatflows)
- **Remaining**: 22 API modules to migrate (assistants, documentstore, tools, nodes, etc.)
- **Strategy**: Migrate incrementally after shim replacement complete

**Related Tasks**: See `tasks.md` → Active Tasks → Task 1.5

---

## Immediate Next Steps

### High Priority (This Week)
1. **Resolve CommonJS Shims Blocker**:
   - Evaluate bulk conversion approach vs incremental migration
   - Convert remaining 49 shim files to ES modules
   - Target: flowise-ui build success

2. **Complete UI Component Extraction**:
   - Phase 3-5: Extract core dependencies, fix imports, iterative build cycle
   - See `tasks.md` → UI Component Extraction for full plan

### Medium Priority (Next 2 Weeks)
1. **Full Workspace Build Validation**:
   - Ensure all 27 packages build successfully after shim fixes
   - Verify no cascading errors across dependencies

2. **Migration spaces-frt and flowise-ui**:
   - Update to use components from `@flowise/template-mui`
   - Remove duplicate ui-components folders
   - Re-test full workspace build

---

## Architecture Decisions Log

### Package Structure Philosophy
- **Monorepo with Feature Apps**: `packages/` contains both apps and libraries
- **Base Directory Pattern**: Each package has `base/` for default implementation
- **Frontend Apps Include i18n**: Default locales `en/` and `ru/` in front-end packages
- **TypeScript Preferred**: Migrate incrementally from JavaScript where present

### Build System Strategy
- **tsdown for New Packages**: Modern Rolldown+Oxc based builds
- **Dual Output**: CJS + ESM + TypeScript declarations
- **Legacy tsc for Core Flowise**: Minimize changes to original Flowise packages

### Dependency Management
- **PNPM Workspaces**: Centralized version control via `pnpm-workspace.yaml`
- **Workspace Protocol**: Use `workspace:*` for inter-package dependencies
- **Build Order**: Manual coordination via `pnpm build` at root

### Code Organization Principles
- **Separation of Concerns**: UI, API, state, auth in separate packages
- **Reusability**: Extract shared code to dedicated packages (@universo/utils, @universo/types)
- **Gradual Migration**: Don't break existing functionality, migrate incrementally

---

## Quick Reference

**Active Work Tracking**:
- Full task list: `tasks.md`
- Completed work: `progress.md`
- Architecture patterns: `systemPatterns.md`
- Tech stack details: `techContext.md`

**Key Package Relationships**:
```
flowise-ui (main app)
├── @flowise/template-mui (UI components)
├── @universo/spaces-frt (canvas features)
├── @universo/api-client (API layer)
├── @flowise/store (Redux state)
├── @flowise/chatmessage (chat UI)
└── @universo/i18n (translations)
```

**Build Commands**:
```bash
# Build specific package (fast)
pnpm --filter <package> build

# Full workspace build (slow, ensures consistency)
pnpm build

# Lint specific package (fast)
pnpm --filter <package> lint
```

**Critical Files**:
- Package structure: `pnpm-workspace.yaml`
- Build configurations: `tsdown.config.ts` (per package)
- Type declarations: `tsconfig.json` (per package)

---

**Note**: This file should remain under ~200 lines. Move completed work to `progress.md` and detailed plans to `tasks.md`.
