# Tasks

> **Note**: This file tracks active and planned tasks. Completed work is documented in `progress.md`. For architectural patterns, see `systemPatterns.md`.

---

## 🔥 Active Tasks (In Progress)

### API Client Migration (@universo/api-client Package)

**Context**: Extracting API clients from flowise-ui into unified TypeScript package with TanStack Query integration.

- [ ] **Task 1.5**: Migrate remaining 22 API modules to TypeScript
  - Priority: assistants, credentials, documentstore, tools, nodes
  - Convert to class-based API with query keys
  - Add to createUniversoApiClient return object
  - Update src/index.ts exports
  - Status: ⏸️ Deferred - migrate incrementally after shim replacement

- [ ] **Task 2.2**: Replace shim imports in flowise-template-mui
  - Pattern: `import X from '../../shims/api/X.js'` → `import { api } from '@universo/api-client'`
  - Remaining: 12 imports for other APIs (assistants, credentials, feedback, etc.)
  - These will remain as shims until APIs migrated to TypeScript (Task 1.5)

- [ ] **Task 2.3**: Create automated shim replacement script (optional)
  - Similar to `tools/migrate-to-template-mui.js`
  - Replace shim imports with api-client imports across all files
  - Run on affected files in flowise-template-mui

- [ ] **Task 2.4**: Delete shims/api/* directory
  - Remove `packages/flowise-template-mui/base/src/shims/api/`
  - Verify no remaining references via grep
  - Document deletion

- [ ] **Task 3.2**: Fix flowise-ui build - **BLOCKED**
  - Blocker: 49 shim files use CommonJS (`module.exports`)
  - Vite requires ES modules for bundling
  - Fixed so far: constant.js, useApi.js, useConfirm.js, actions.js, client.js (5/54)
  - Remaining: 49 files need conversion
  - Decision required: massive conversion vs alternative approach?

- [ ] **Task 3.4**: Full workspace build
  - Run `pnpm build` (all 27 packages)
  - Monitor for cascading errors
  - Document any issues
  - Target: 27/27 successful builds

---

## 📋 Backlog (Planned, Not Started)

### UI Component Extraction (@flowise/template-mui)

**Context**: Make @flowise/template-mui self-contained and independently buildable.

#### Phase 2: Extract Core Dependencies (3-4 hours)

- [ ] **Task 2.1**: Extract utility functions
  - Create packages/flowise-template-mui/base/src/utils/
  - Copy genericHelper.js functions (formatDate, kFormatter, getFileName)
  - Copy resolveCanvasContext.js
  - Copy useNotifier.js hook
  - Update imports in extracted files

- [ ] **Task 2.2**: Extract constants
  - Create packages/flowise-template-mui/base/src/constants.ts
  - Move baseURL, uiBaseURL, gridSpacing from @/store/constant
  - Update exports in src/index.ts

- [ ] **Task 2.3**: Extract Redux-related code
  - Decision: Keep Redux or inject via props?
  - Option A: Extract minimal Redux slice for dialogs
  - Option B: Convert components to use props/callbacks
  - Document chosen approach and implement

- [ ] **Task 2.4**: Extract/create API client interfaces
  - Create packages/flowise-template-mui/base/src/api/
  - Option A: Copy API clients (canvasesApi, credentialsApi, etc.)
  - Option B: Create interface types, inject real clients
  - Implement chosen approach

- [ ] **Task 2.5**: Extract custom hooks
  - Create packages/flowise-template-mui/base/src/hooks/
  - Extract useConfirm hook
  - Extract useApi hook
  - Update imports in components

#### Phase 3: Fix Internal Component Imports (2-3 hours)

- [ ] **Task 3.1**: Find all @/ui-components imports
  - Run: `grep -r "from '@/ui-components" packages/flowise-template-mui/base/src/ui-components/`
  - Count total occurrences
  - Document import patterns

- [ ] **Task 3.2**: Create automated replacement script
  - Write script to replace @/ui-components/ → relative paths
  - Example: @/ui-components/cards/MainCard → ../cards/MainCard
  - Test script on 2-3 files manually first

- [ ] **Task 3.3**: Run automated replacement
  - Execute script on all ui-components/ files
  - Verify replacements are correct
  - Manually fix any edge cases

- [ ] **Task 3.4**: Fix circular imports
  - Identify components importing each other
  - Refactor to use proper component hierarchy
  - Document component dependency graph

#### Phase 4: Update Package Configuration (1-2 hours)

- [ ] **Task 4.1**: Add missing dependencies to package.json
  - Add axios (for API calls)
  - Add moment (for date formatting)
  - Add react-redux (if keeping Redux)
  - Add notistack (for notifications)
  - Run: `pnpm install`

- [ ] **Task 4.2**: Configure TypeScript paths
  - Update tsconfig.json with path aliases if needed
  - Configure module resolution
  - Set up proper type checking

- [ ] **Task 4.3**: Update tsdown configuration
  - Ensure all entry points are included
  - Configure external dependencies properly
  - Set platform to 'browser' or 'neutral'

- [ ] **Task 4.4**: Update exports in src/index.ts
  - Export utilities from utils/
  - Export constants
  - Export hooks
  - Export API interfaces/types

#### Phase 5: Iterative Build & Fix Cycle (6-10 hours)

- [ ] **Task 5.1**: First build attempt
  - Run: `pnpm --filter @flowise/template-mui build`
  - Document ALL errors (save to file)
  - Categorize errors: import, type, missing dep, syntax

- [ ] **Task 5.2**: Fix import errors (Iteration 1)
  - Fix unresolved module errors
  - Update relative paths
  - Add missing exports
  - Rebuild and check progress

- [ ] **Task 5.3**: Fix type errors (Iteration 2)
  - Add missing type definitions
  - Fix any type mismatches
  - Update interfaces
  - Rebuild and check progress

- [ ] **Task 5.4**: Fix dependency errors (Iteration 3)
  - Install missing packages
  - Update peer dependencies
  - Configure externals in tsdown
  - Rebuild and check progress

- [ ] **Task 5.5**: Continue iteration until clean build
  - Repeat build → fix → rebuild cycle
  - Track progress (errors decreasing)
  - Maximum 10 iterations planned
  - Document all fixes applied

#### Phase 6: Migrate spaces-frt to Use New Package (3-4 hours)

- [ ] **Task 6.1**: Backup spaces-frt
  - Run: `cp -r packages/spaces-frt/base/src/ui-components packages/spaces-frt/base/src/ui-components.backup`
  - Verify backup created

- [ ] **Task 6.2**: Add @flowise/template-mui dependency
  - Update packages/spaces-frt/base/package.json
  - Add: `"@flowise/template-mui": "workspace:*"`
  - Run: `pnpm install`

- [ ] **Task 6.3**: Create import replacement script for spaces-frt
  - Script to replace: `@ui/ui-components/` → `@flowise/template-mui/`
  - Script to replace: `../../ui-components/` → `@flowise/template-mui/`
  - Test on 2-3 files first

- [ ] **Task 6.4**: Run automated replacement on spaces-frt
  - Execute script on all packages/spaces-frt/base/src/ files
  - Verify ~200+ imports updated
  - Document any manual fixes needed

- [ ] **Task 6.5**: Delete duplicate ui-components folder
  - Run: `rm -rf packages/spaces-frt/base/src/ui-components`
  - Run: `grep -r "ui-components" packages/spaces-frt/base/src/` to verify no refs
  - Document deletion

#### Phase 7: Build & Test spaces-frt (2-3 hours)

- [ ] **Task 7.1**: Build spaces-frt
  - Run: `pnpm --filter @universo/spaces-frt build`
  - Document all errors
  - Fix import errors
  - Rebuild until clean

- [ ] **Task 7.2**: Full workspace build
  - Run: `pnpm build` (root)
  - Monitor for cascading errors
  - Fix errors in order: template-mui → spaces-frt → flowise-ui → others
  - Achieve 26/26 successful builds

- [ ] **Task 7.3**: Run linters
  - Run: `pnpm --filter @flowise/template-mui lint`
  - Run: `pnpm --filter @universo/spaces-frt lint`
  - Fix critical errors
  - Document warnings for post-MVP

#### Phase 8: Migrate flowise-ui to Use New Package (3-4 hours)

- [ ] **Task 8.1**: Add @flowise/template-mui to flowise-ui
  - Update packages/flowise-ui/package.json
  - Add dependency: `"@flowise/template-mui": "workspace:*"`
  - Run: `pnpm install`

- [ ] **Task 8.2**: Create import replacement script for flowise-ui
  - Script to replace: `@/ui-components/` → `@flowise/template-mui/`
  - Script to replace: relative imports → package import where applicable
  - Test on 5-10 files first

- [ ] **Task 8.3**: Run automated replacement on flowise-ui
  - Execute script on packages/flowise-ui/src/**/*.{js,jsx,ts,tsx}
  - Expect 500+ imports to update
  - Document replacement statistics

- [ ] **Task 8.4**: Handle special cases in flowise-ui
  - Some components may still need local ui-components/ for now
  - Identify components to migrate later (post-MVP)
  - Document migration plan for remaining components

- [ ] **Task 8.5**: Build flowise-ui
  - Run: `pnpm --filter flowise-ui build`
  - Fix errors iteratively
  - Document all changes
  - Achieve clean build

#### Phase 9: Functional Testing (2-3 hours)

- [ ] **Task 9.1**: Test Canvas editor (white screen fix)
  - Navigate to /unik/<any-id>/spaces/new
  - Verify NO white screen error
  - Verify Canvas editor loads
  - Test adding nodes
  - Test saving canvas

- [ ] **Task 9.2**: Test Spaces list
  - Navigate to Spaces list
  - Verify list renders
  - Test CRUD operations
  - Check all UI components

- [ ] **Task 9.3**: Test other flowise-ui features
  - Test Canvases page
  - Test Marketplace
  - Test Settings
  - Verify no regressions

- [ ] **Task 9.4**: Browser testing
  - Test Chrome, Firefox, Edge
  - Check console for errors
  - Verify visual consistency
  - Document any issues

#### Phase 10: Documentation & Cleanup (2-3 hours)

- [ ] **Task 10.1**: Update @flowise/template-mui README
  - Document extracted utilities
  - Add usage examples
  - Document exported hooks
  - Add API documentation

- [ ] **Task 10.2**: Update spaces-frt README
  - Remove ui-components references
  - Document new import patterns
  - Add troubleshooting section

- [ ] **Task 10.3**: Update flowise-ui README
  - Document migration to @flowise/template-mui
  - Add import guidelines
  - Note remaining local components

- [ ] **Task 10.4**: Update memory-bank files
  - Update activeContext.md with migration details
  - Update progress.md with completion status
  - Update systemPatterns.md with new architecture
  - Update techContext.md with package structure

- [ ] **Task 10.5**: Clean up backup files
  - Remove spaces-frt backup if tests pass
  - Remove any temporary files
  - Clean git working directory

- [ ] **Task 10.6**: Final verification
  - Run: `pnpm build` (full workspace)
  - Run: `pnpm lint` (or per-package)
  - Verify 26/26 builds successful
  - Commit with detailed message

---

## ⏸️ Deferred / Future Work

### Optional Improvements (Post-MVP)

- [ ] **CanvasVersionsDialog Extension**: Add publish buttons in Actions column
  - Context: Not critical for MVP, can add later if needed
  - Reference: See progress.md section "Version Publication Feature"

- [ ] **Performance Optimizations**: Improve build times and runtime performance
  - Context: Current performance acceptable for MVP
  - Potential areas: Bundle size optimization, lazy loading improvements

- [ ] **ESLint Rule Creation**: Add custom rule to prevent react-i18next direct imports
  - Context: Pattern documented in systemPatterns.md
  - Purpose: Prevent future useTranslation antipattern issues
  - Reference: See "i18n Defense-in-Depth Pattern"

- [ ] **Unit Testing**: Add comprehensive test coverage
  - Dialog components (EntityFormDialog, ConfirmDeleteDialog, ConfirmDialog)
  - Pagination components (usePaginated, PaginationControls)
  - Skeleton components (SkeletonGrid)
  - Empty state components (EmptyListState)

- [ ] **Migration of Other List Views**: Apply universal pagination pattern
  - UnikList (consider if needed)
  - SpacesList (consider if needed)
  - Other resource lists

- [ ] **SkeletonTable Variant**: Create table-specific skeleton component
  - Context: Current SkeletonGrid works for card grids
  - Need: Specialized skeleton for table view loading states

---

## 📝 Quick Reference

### Documentation Links

- **Architecture Patterns**: See `systemPatterns.md`
  - i18n Defense-in-Depth Pattern
  - Event-Driven Data Loading Pattern
  - Universal Pagination Pattern
  - useAutoSave Hook Pattern

- **Completed Work History**: See `progress.md`
  - All completed tasks with detailed implementation notes
  - Build metrics and validation results
  - Impact summaries and lessons learned

- **Technical Context**: See `techContext.md`
  - Package structure and dependencies
  - Build system configuration (tsdown, Vite, TypeScript)
  - Monorepo workspace setup

### Key Architectural Decisions

1. **Gradual UI Migration**: Hybrid approach using template-mui components with @ui infrastructure
2. **MVP-First Philosophy**: Simple solutions over premature optimization
3. **Type Safety**: Full TypeScript support with proper interfaces
4. **Reusable Components**: Extract shared patterns into template-mui
5. **Cache Management**: Proper TanStack Query invalidation patterns

---

**Last Updated**: 2025-10-26

