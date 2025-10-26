# Active Context

> **Last Updated**: 2025-10-26
>
> **Purpose**: This file tracks the current focus of development - what we're actively working on RIGHT NOW. Completed work is in `progress.md`, planned work is in `tasks.md`.

---

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
