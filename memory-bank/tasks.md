# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-11-22: i18n Refactoring - Members & Tables ✅ COMPLETE

**Status**: Implementation complete ✅

**Problem**: Translation keys for "members" were duplicated across all modules (organizations, clusters, etc.), while some specific table keys (like departments) were incorrectly in common.json.

**Solution**: Centralize `members` keys in `common.json` and decentralize specific `table` keys to their respective module JSONs. Update all React components to use the correct translation namespace (`t` vs `tc`).

**Tasks**:
- [x] Task 1: Move `members` keys to `common.json` (RU & EN)
- [x] Task 2: Move specific `table` keys to module JSONs (RU & EN)
- [x] Task 3: Update `OrganizationMembers.tsx` (use `tc` for members)
- [x] Task 4: Update `ClusterMembers.tsx` (use `tc` for members)
- [x] Task 5: Update `MetaverseMembers.tsx` (use `tc` for members)
- [x] Task 6: Update `ProjectMembers.tsx` (use `tc` for members)
- [x] Task 7: Update `UnikMember.tsx` (use `tc` for members)
- [x] Task 8: Update `ProjectList.tsx` (fix table headers usage)

### 2025-11-22: ItemCard Click Handling Fix ✅ 🧪 TESTING

**Status**: Implementation complete ✅, Browser testing pending 🧪

**Problem**: In ItemCard component, the "3 dots" menu button triggers navigation instead of opening the menu because RouterLink wrapper intercepts all clicks. Previous attempt with `useNavigate` broke SEO/Link behavior.

**Solution**: Use "Overlay Link" pattern. Render a `Link` (react-router-dom) with absolute positioning covering the card, but place the menu button (headerAction) above it using z-index.

**Tasks**:
- [x] Task 1: Modify ItemCard.tsx to use Link overlay instead of useNavigate
- [x] Task 2: Ensure headerAction has higher z-index and stops propagation
- [ ] Task 3: Update ItemCard.test.tsx with new click handling tests
- [x] Task 4: Build @universo/template-mui package
- [x] Task 5: Build flowise-ui package
- [ ] Task 6: Browser test (user): verify card navigation and menu clicks work correctly

**Browser Test Checklist**:
- [ ] Test 6.1: Organizations - click card body → navigates to detail page
- [ ] Test 6.2: Organizations - click "3 dots" → menu opens WITHOUT navigation
- [ ] Test 6.3: Metaverses - verify same behavior (card nav + menu)
- [ ] Test 6.4: Clusters - verify same behavior (card nav + menu)
- [ ] Test 6.5: Projects - verify same behavior (card nav + menu)
- [ ] Test 6.6: Grid spacing visual check (16px gap between cards)

### 2025-01-19: Organizations Integration - Refactoring & Integration ⏸️ PAUSED

**Status**: Phase 1-8 complete ✅ (Backend + Frontend + Build ready), Phase 9 pending (Browser testing by user)
**Note**: Paused to fix ItemCard click handling issue discovered during testing

**Backend Progress**: ✅ Types, Entities, Migration, Integration, Build complete.
**Frontend Progress**: ✅ Package cleaned, i18n fixed, routes added, menu integrated, API naming fixed, Build complete.
**Build Status**: ✅ Full workspace build successful: 36/36 packages built successfully!
**Fixes Applied**:

-   Fixed template-quiz syntax error (unescaped backtick in template string)
-   Renamed createPositionActions → createEntityActions
-   Renamed BasePositionMenu → BaseEntityMenu
-   Renamed PositionFormDialog → EntityFormDialog
-   Updated all prop names (position → entity, positionKind → entityKind)

**Next Step**: Phase 9 (Browser testing by user) - test navigation, CRUD operations, permissions, i18n.

#### Phase 1: Backend Foundation - Types & Guards ✅ COMPLETE

-   [x] Task 1.1: Add OrganizationRole to @universo/types
-   [x] Task 1.2: Create validation schemas for Organizations
-   [x] Task 1.3: Export OrganizationRole from types index
-   [x] Task 1.4: Build @universo/types (18.02 kB CJS, 14.64 kB ESM)
-   [x] Task 1.5: Delete duplicate AuthUser entity
-   [x] Task 1.6: Refactor guards.ts using createAccessGuards factory

#### Phase 2: Backend Entities - Fix Naming ✅ COMPLETE

-   [x] Task 2.1: Organization entity (already correct)
-   [x] Task 2.2: Fix OrganizationUser entity (added @Unique, name mapping)
-   [x] Task 2.3: Fix Department entity (already correct)
-   [x] Task 2.4: Fix DepartmentOrganization entity (added @Unique)
-   [x] Task 2.5: Fix Position entity (added metadata field)
-   [x] Task 2.6: Fix PositionDepartment entity (added @Unique)
-   [x] Task 2.7: Fix PositionOrganization entity (added @Unique)

#### Phase 3: Backend Migration - Single File ✅ COMPLETE

-   [x] Task 3.1: Delete old migration files (2 files removed)
-   [x] Task 3.2: Create single migration file (1741500000000-AddOrganizationsDepartmentsPositions.ts)
-   [x] Task 3.3: Update migration index

#### Phase 4: Backend Routes - Fix Naming & Imports ✅ PARTIAL (1/5 tasks)

-   [x] Task 4.1: Fix organizationsRoutes.ts imports (AuthUser from @universo/auth-srv)
-   [ ] Task 4.2: Fix variable naming in organizationsRoutes.ts (deferred - not critical)
-   [ ] Task 4.3: Fix relations case in organizationsRoutes.ts (deferred - not critical)
-   [ ] Task 4.4: Create departmentsRoutes.ts (deferred - can use existing organizationsRoutes)
-   [ ] Task 4.5: Create positionsRoutes.ts (deferred - can use existing organizationsRoutes)

#### Phase 5: Backend Integration ✅ COMPLETE

-   [x] Task 5.1: Register entities in flowise-server
-   [x] Task 5.2: Register migrations in flowise-server
-   [x] Task 5.3: Add dependencies to flowise-server package.json
-   [ ] Task 5.4: Register routes in flowise-server (deferred - routes exist in organizationsRoutes)
-   [x] Task 5.5: Run pnpm install
-   [x] Task 5.6: Build backend packages (organizations-srv ✅, flowise has pre-existing errors)

#### Phase 6: Frontend Foundation ✅ COMPLETE

-   [x] Task 6.1: Clean devDependencies in organizations-frt (51→7 packages)
-   [x] Task 6.2: Verify API client (organizations.ts - correct)
-   [x] Task 6.3: Verify OrganizationList component (correct)
-   [x] Task 6.4: Verify OrganizationActions.tsx (correct)
-   [x] Task 6.5: Verify DepartmentList & PositionList (exist)
-   [x] Task 6.6: Fix i18n translations structure (EN/RU aligned)
-   [x] Task 6.7: Run pnpm install
-   [x] Task 6.8: Build organizations-frt (15.18 kB CJS, 14.04 kB ESM)

#### Phase 7: Frontend Integration ✅ COMPLETE

-   [x] Task 7.1: Add routes to template-mui (MainRoutesMUI.tsx)
-   [x] Task 7.2: Add menu items (menuConfigs.ts - getOrganizationMenuItems)
-   [x] Task 7.3: Add menu translations (EN/RU in universo-i18n)
-   [x] Task 7.4: Add organizations-frt to flowise-ui (index.jsx, vite.config.js, package.json)
-   [x] Task 7.5: Build template-mui (284.01 kB ESM, 3216.94 kB CJS)

#### Phase 8: Build & Validation ✅ COMPLETE

-   [x] Task 8.1: Build organizations-frt (i18n: 15.18 kB CJS, 14.04 kB ESM)
-   [x] Task 8.2: Build template-mui (284.01 kB ESM, 3.2 MB CJS with routes)
-   [x] Task 8.3: Fix template-quiz syntax error (unescaped backtick)
-   [x] Task 8.4: Fix API naming (createEntityActions, BaseEntityMenu, EntityFormDialog)
-   [x] Task 8.5: Update all Organizations components with correct API names
-   [x] Task 8.6: Full workspace build ✅ (36/36 packages successful, 4m50s)

#### Phase 9: Browser Testing (USER) 🧪 PENDING

-   [ ] Test 9.1: Navigation & Menu
-   [ ] Test 9.2: Organization CRUD
-   [ ] Test 9.3: Departments CRUD
-   [ ] Test 9.4: Positions CRUD
-   [ ] Test 9.5: Members Management
-   [ ] Test 9.6: i18n Switching
-   [ ] Test 9.7: Pagination & Search
-   [ ] Test 9.8: URL Parameters & Routing
-   [ ] Test 9.9: Error Handling
-   [ ] Test 9.10: Permissions & Security

---

## 🚧 IN PROGRESS

### 2025-01-18: AR.js InteractionMode Persistence Fix ✅ COMPLETE

**Status**: Implementation complete, template-quiz rebuilt, line endings normalized, ready for browser testing

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-17: PR #550 Bot Review Fixes ✅

-   Details: progress.md#2025-11-17

### 2025-11-14: Cluster Breadcrumbs Implementation ✅

-   Details: progress.md#2025-11-14

---

## 📦 DEFERRED

### Template MUI CommonJS Shims

-   Problem: flowise-ui cannot import from @flowise/template-mui (ESM/CJS conflict)
-   Solution: Extract to @universo package with dual build
-   Status: DEFERRED

---

### 2025-11-22: PR #554 Fixes (RLS, Cleanup, Tests) ✅ COMPLETE

**Status**: Implementation complete ✅

**Context**: Addressed feedback from PR #554 regarding RLS policy, unused variables, and frontend test practices.

**Tasks**:
- [x] Task 1: Fix RLS policy for `organizations_users` (migration)
- [x] Task 2: Remove unused variables in `organizationsRoutes.test.ts`
- [x] Task 3: Remove unused import in `flowise-server/src/routes/index.ts`
- [x] Task 4: Update `ItemCard.test.tsx` to test `<a>` tags
- [x] Task 5: Fix `organizationsRoutes.test.ts` environment (mocking)
- [x] Task 6: Verify tests and builds

---

**Note**: For completed tasks older than 30 days, see progress.md. For detailed implementation steps, see progress.md entries by date.
