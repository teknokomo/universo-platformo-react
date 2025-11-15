# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-11-15: Card Link Preview on Hover ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Step 1: Add `href` prop to ItemCard component
- [x] Step 2: Implement RouterLink wrapper pattern
- [x] Step 3: Update UnikList.tsx (replace onClick with href)
- [x] Step 4: Update MetaverseList.tsx (replace onClick with href)
- [x] Step 5: Update ClusterList.tsx (replace onClick with href)
- [x] Step 6: Add tests for new href functionality
- [x] Step 7: Build @universo/template-mui package (✅ 3207.55 kB CJS, 275.94 kB ESM)
- [x] Step 8: Build frontend packages (uniks-frt, metaverses-frt, clusters-frt) (✅ all successful)

#### Browser Testing (USER)
- [ ] Test 1: Hover over Unik card → verify URL preview shows in browser status bar
- [ ] Test 2: Hover over Metaverse card → verify URL preview
- [ ] Test 3: Hover over Cluster card → verify URL preview
- [ ] Test 4: Right-click card → verify "Open in new tab" works
- [ ] Test 5: Click headerAction menu → verify doesn't navigate
- [ ] Test 6: Verify hover effects still work (background change)

#### Technical Details
- **Solution**: Wrap CardWrapper in RouterLink when href provided
- **Pattern**: `href ? <RouterLink to={href}>{card}</RouterLink> : {card}`
- **Backward Compatible**: Keep onClick for other ItemCard uses
- **Files Modified**:
  1. `packages/universo-template-mui/base/src/components/cards/ItemCard.tsx` - Added href prop and RouterLink wrapper
  2. `packages/uniks-frt/base/src/pages/UnikList.tsx` - Removed goToUnik, use href
  3. `packages/metaverses-frt/base/src/pages/MetaverseList.tsx` - Removed goToMetaverse, use href
  4. `packages/clusters-frt/base/src/pages/ClusterList.tsx` - Removed goToCluster, use href
  5. `packages/universo-template-mui/base/src/components/cards/__tests__/ItemCard.test.tsx` - Added 6 new tests for href

### 2025-01-15: Uniks Pagination Fix ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Add total count query to GET /uniks endpoint
- [x] Set pagination headers (X-Total-Count, X-Pagination-Count, X-Pagination-Limit, X-Pagination-Offset, X-Pagination-Has-More)
- [x] Set default values for limit (20) and offset (0)
- [x] Fix pagination with GROUP BY - use two-step query approach
- [x] Build uniks-srv package (2 times)

#### Browser Testing (USER)
- [ ] Test 1: With 12 uniks, set page size to 10 → verify shows ONLY first 10 uniks and "1-10 of 12"
- [ ] Test 2: Navigate to page 2 → verify shows ONLY remaining 2 uniks and "11-12 of 12"
- [ ] Test 3: Change page size to 20 → verify all 12 uniks appear on single page
- [ ] Test 4: Test pagination with search filter active

#### Technical Changes
- **Problem 1**: GET /uniks returned data array without pagination headers. Frontend couldn't calculate totalPages because `totalItems: 0`.
- **Solution 1**: Added separate count query and pagination headers (X-Total-Count, etc.)

- **Problem 2**: TypeORM `.skip()` and `.take()` don't work correctly with `GROUP BY` - they apply to pre-aggregated rows, not grouped results. Result: all 12 items shown on every page.
- **Solution 2**: Two-step query approach:
  1. **Step 1**: Get paginated list of unik IDs with roles (no aggregation) - apply OFFSET/LIMIT here
  2. **Step 2**: Get full unik details + spaces count for those specific IDs (with GROUP BY)
  3. Merge results preserving pagination order using Map
  
- **Why this works**: OFFSET/LIMIT applied to simple SELECT (before GROUP BY), then aggregation only on needed rows.
- **File**: `packages/uniks-srv/base/src/routes/uniksRoutes.ts`

---

### 2025-01-15: Uniks List - Delete Modal & Search Fixes ✅
**Status**: Implementation complete, browser testing required

#### Implementation Tasks (COMPLETED)
- [x] Task 1: Fix ConfirmDeleteDialog - call onCancel() after successful onConfirm()
- [x] Task 2: Fix GET /uniks endpoint - add search WHERE clause + pagination support
- [x] Task 3: Build template-mui package (contains dialog fix)
- [x] Task 4: Build uniks-srv package (contains search fix)
- [x] Task 5: Build uniks-frt package
- [x] Task 6: Full workspace build (32/32 tasks successful, 4m 23s)

#### Browser Testing (USER)
- [ ] Test 1: Delete unik, verify modal closes automatically after success
- [ ] Test 2: Enter search text "для", verify filtering works (shows matching uniks)
- [ ] Test 3: Enter search text "технокомо", verify it finds "Технокомо" unik
- [ ] Test 4: Test partial matches in name field (e.g., "техн")
- [ ] Test 5: Test partial matches in description field
- [ ] Test 6: Clear search, verify all uniks return

#### Technical Changes
- **Fix 1 (Modal closing)**: Modified `ConfirmDeleteDialog.tsx` handleConfirm() to call `onCancel()` after successful `onConfirm()`. This closes the dialog managed by BaseEntityMenu's dialogState.
- **Fix 2 (Search support)**: Added search parameter extraction in GET /uniks route. Added WHERE clause: `(LOWER(u.name) LIKE :search OR LOWER(u.description) LIKE :search)` with escaped search term. Also added optional limit/offset pagination support for future use.

#### Files Modified
1. `packages/universo-template-mui/base/src/components/dialogs/ConfirmDeleteDialog.tsx` - Added `onCancel()` call after successful delete
2. `packages/uniks-srv/base/src/routes/uniksRoutes.ts` - Added search and pagination to GET /uniks endpoint

#### Root Cause Analysis
- **Issue 1**: ConfirmDeleteDialog didn't signal parent (BaseEntityMenu) to close dialog after successful onConfirm(). Dialog component has comment "dialog will be closed by parent" but never called onCancel/onClose.
- **Issue 2**: GET /uniks endpoint ignored search query parameter. Frontend usePaginated hook passed search correctly via API client, but backend QueryBuilder had no WHERE clause for filtering.

---

### 2025-01-14: Uniks Refactoring – Guards, Migration, UI Columns ✅
Applied best practices from Metaverses/Clusters implementation to Uniks package:
- [x] **Backend Guards**: Created guards.ts with createAccessGuards factory (ROLE_PERMISSIONS, ensureUnikAccess, assertNotOwner)
- [x] **Routes Refactoring**: Updated 8 endpoints in uniksRoutes.ts to use guards pattern (DRY)
  - POST /members, GET /:id (added permissions field), PUT /:id, DELETE /:id
  - GET /:unikId/members, POST /:unikId/members, PATCH /:unikId/members/:memberId, DELETE /:unikId/members/:memberId
- [x] **Migration Rename**: CreateUniksSchema → AddUniksAndLinked (removed Flowise mention, follows naming convention)
- [x] **Frontend Columns**: Updated UnikList.tsx columns (added name first, replaced sections/entities with spaces)
- [x] **i18n Translations**: Added "table.spaces" key to EN and RU common.json files
- [x] **Build & Lint**: Both packages compile successfully, lint clean (1 acceptable console warning in migration)
- [ ] **Browser Testing (USER)**: Verify Edit/Delete menu visible, Name column displays, Spaces column shows count

### 2025-11-14: Code Quality Improvements (M2M Logic, Email Index, Guards DRY)
Implementing 3 fixes identified in comparative analysis of metaverses-srv and clusters-srv:
- [x] **Task 1**: Fix ensureSectionAccess M2M logic - changed findOne → find with loop (mirrors clusters pattern)
- [x] **Task 2**: Add LOWER(email) functional index to auth.users table in 3 migrations (metaverses, clusters, uniks)
- [x] **Task 3**: Extract guards to @universo/auth-srv - created generic createAccessGuards factory
  - [x] Create guards/types.ts with AccessGuardsConfig interface
  - [x] Create guards/createAccessGuards.ts with generic factory (assertPermission, ensureAccess, getMembershipSafe, hasPermission, assertNotOwner)
  - [x] Create guards/index.ts barrel export
  - [x] Export guards from auth-srv/src/index.ts
  - [x] Fix lint error in auth-srv/routes/auth.ts (empty catch block)
  - [x] Build auth-srv successfully
  - [x] Refactor metaverses-srv/routes/guards.ts to use createAccessGuards factory
  - [x] Build and test metaverses-srv (✅ 25/25 tests passing)
  - [x] Refactor clusters-srv/routes/guards.ts to use createAccessGuards factory
  - [x] Build and test clusters-srv (✅ 25/25 tests passing)

### 2025-01-14: PR #545 QA Fixes Implementation ✅
All critical and code quality issues from bot reviewers (Copilot, Gemini, ChatGPT Codex) resolved:
- [x] **CRITICAL**: Fixed ensureDomainAccess M2M security vulnerability (findOne → find)
- [x] **HIGH**: Cleaned devDependencies in clusters-frt (51 → 19 packages)
- [x] **MEDIUM**: Removed debug console.log from ClusterList
- [x] **LOW**: Removed unused getClustersRateLimiters import
- [x] **LOW**: Removed unused authUserRepo variable from test
- [x] **LOW**: Added response.body.data validation to test
- [x] **LOW**: Fixed all prettier formatting issues
- [x] **LOW**: Fixed unused useEffect import
- [x] Build verification: Both clusters-srv and clusters-frt build successfully
- [x] Lint verification: No errors, 2 minor warnings (unused test variable, React Hook deps)
- [ ] Browser testing (USER): Verify multi-cluster domain access works correctly

### 2025-11-14: AuthUser Entity Migration & Build Fix ✅
- [x] Create database/entities structure in auth-srv
- [x] Move AuthUser entity from uniks-srv to auth-srv
- [x] Update all imports in uniks-srv, metaverses-srv, clusters-srv
- [x] Update flowise-server to import AuthUser from @universo/auth-srv
- [x] Remove duplicate AuthUser files from all services
- [x] **FIX: Replace tsdown with tsc in auth-srv** (decorator syntax errors)
- [x] **FIX: Add experimentalDecorators/emitDecoratorMetadata to tsconfig**
- [x] Build all affected packages (auth-srv, uniks-srv, metaverses-srv, clusters-srv, flowise)
- [x] Verify no TypeScript errors
- [x] Verify server starts without "Invalid or unexpected token" error
- [ ] Browser verification (USER):
  - Test Metaverses dashboard loads without 500 error
  - Test Clusters dashboard loads without 500 error
  - Test Uniks dashboard loads correctly
  - Verify member lists display properly in all three

### 2025-11-14: Cluster Breadcrumbs Implementation ✅
- [x] Create useClusterName hook with fetch from `/api/v1/clusters/:id`
- [x] Add Map-based caching for cluster names
- [x] Add truncateClusterName helper (30 char limit)
- [x] Export useClusterName from hooks/index.ts
- [x] Update NavbarBreadcrumbs with cluster context detection
- [x] Add cluster breadcrumb rendering logic (3 sub-pages: access, resources, domains)
- [x] Build @universo/template-mui package (✅ 3203.41 kB CJS, 271.88 kB ESM)
- [x] Build flowise-ui package (✅ 1m 10s)
- [x] Full workspace build (✅ 32/32 tasks successful, 3m 35s)
- [ ] Browser verification (USER):
  - Navigate to `/clusters/:id` and verify breadcrumbs: Clusters → [ClusterName]
  - Navigate to `/clusters/:id/resources` and verify: Clusters → [ClusterName] → Resources
  - Navigate to `/clusters/:id/domains` and verify: Clusters → [ClusterName] → Domains
  - Navigate to `/clusters/:id/access` and verify: Clusters → [ClusterName] → Access
  - Test long cluster names (verify truncation at 30 chars)
  - Verify Name column displays in all entity lists

### 2025-11-13: Clusters/Metaverses UI Improvements ✅
- [x] Add "Название" (Name) column as first column in Clusters/Metaverses tables
- [x] Fix "columns.actions" translation key (added to common.json)
- [x] Fix delete/edit dialog translation keys (removed i18nPrefix from keys)
- [x] Rebuild affected packages (template-mui, clusters-frt, metaverses-frt, i18n)
- [ ] Browser verification (USER): 
  - Check Clusters/Metaverses tables show Name column first
  - Verify "Действия" column shows correct translation (not key)
  - Test delete dialog shows proper Russian text
  - Test edit dialog shows proper Russian title

### i18n Residual Keys – TemplateSelect, SpeechToText, Space Builder
- [x] R1: TemplateSelect (PlayCanvas) namespace registration
- [x] R2: SpeechToText namespace binding cleanup
- [x] R3: Space Builder dedicated namespace
- [x] R4: Build validation (publish-frt, template-mui, space-builder-frt)
- [ ] R5: Browser verify (USER): TemplateSelect, Speech-to-Text, Space Builder all localized
- [ ] R6: Restore compatibility export for Space Builder i18n (`registerSpaceBuilderI18n()`)

### i18n Publish & Speech-to-Text – JSON fix & build validation
- [x] P1: Fix RU JSON structure in publish-frt/i18n/locales/ru/main.json
- [ ] P2: Build impacted packages (publish-frt, template-mui, universo-template-mui, flowise-ui)
- [ ] P3: Full workspace build
- [ ] P4: Update progress.md with summary

### i18n Phase 5 – Residual fixes
- [x] 5.1: CanvasConfigurationDialog – bind 'canvas' namespace
- [x] 5.2: UpsertHistoryDialog – bind 'vectorStore' namespace
- [x] 5.3: CanvasHeader – colon namespace for publish/delete actions
- [x] 5.4: Build affected packages
- [ ] 5.5: Browser verification (USER): Configuration dialog, Upsert History, Canvas header actions
- [x] 5.6: SpeechToText.jsx – short keys after binding
- [x] 5.7: ChatPopUp.jsx – drop `chatMessage.` prefix
- [x] 5.8: Publish/Export dialog audit (PlayCanvas/ARJS colon syntax)
- [x] 5.9: Rebuild impacted packages
- [ ] 5.10: Update progress.md with Phase 5 summary

### i18n Phase 3 – View Messages/Leads Dialog Fixes
- [x] 1-8: All code fixes and builds complete
- [ ] 9: Browser verification (USER): Canvas settings tooltip, View Messages/Leads dialogs, Configuration dialog, EN↔RU toggle

---

## 🚧 IN PROGRESS

### UnikBoard Dashboard Refactoring (2025-01-13)
**Status**: Implementation complete, critical fixes applied, browser testing required

#### Implementation Tasks (COMPLETED ✅)
- [x] U-1: Backend endpoint - Add 4 COUNT queries (credentials, variables, API keys, document stores)
- [x] U-2: TypeScript types - Extend Unik interface with 4 optional count fields
- [x] U-3: UnikBoard component - Reorganize Grid to 3 rows with 7 metric cards
- [x] U-4: Demo data - Add 5 trend arrays for new metrics
- [x] U-5: i18n EN - Add translations for 4 new metrics
- [x] U-6: i18n RU - Add translations for 4 new metrics
- [x] U-7: Orthography - Fix "Учётные данные" (ё letter) in 8 i18n files
- [x] U-8: Menu - Comment out Assistants menu item (route still accessible)
- [x] U-9: Tests - Update UnikBoard.test.tsx mock data and assertions
- [x] U-10: Validation - Backend build ✅, frontend build ✅, lint ✅
- [x] U-11: Fix table name bug - Changed api_key → apikey in backend query
- [x] U-12: Migration fix - Added apikey to flowiseTables in down() method
- [x] U-13: Critical fix - Added custom_template to migration (up + down methods)

#### Browser Testing (USER)
- [ ] U-14: Navigate to /uniks/:id and verify 7 stat cards display correctly
- [ ] U-15: Test EN ↔ RU language switching (verify new metrics translate)
- [ ] U-16: Test responsive layout (mobile/tablet/desktop breakpoints)
- [ ] U-17: Verify Assistants menu hidden but route /uniks/:id/assistants accessible
- [ ] U-18: Check all metric cards show correct icons and demo trend lines
- [ ] U-19: Test Custom Templates feature (depends on unik_id migration fix)

#### Technical Notes
- Row 1: 3 small cards (Spaces, Members, Credentials) + documentation card
- Row 2: 4 small cards (Tools, Variables, API Keys, Documents)
- Row 3: 2 large demo charts unchanged (Sessions, Page Views)
- Grid breakpoints: xs=12, sm=6, lg=3 for responsive behavior
- Demo data: 30-point arrays using `Array(30).fill(count).map((n, i) => n + i % 3)` pattern
- **CRITICAL FIXES**: 
  - Table name is `apikey` (not `api_key`) - verified from TypeORM entity
  - Added `custom_template` to migration (was missing, but Entity has @ManyToOne Unik relation)
- **Migration now handles 7 tables**: credential, tool, assistant, variable, apikey, document_store, custom_template

---

### PR #539 Bot Review Fixes (QA Analysis)
**Status**: All critical fixes completed ✅

#### Critical Blockers (MUST FIX before merge)
- [x] QA-1: Fix Analytics.test.tsx import path ('analytics:react-router-dom' → 'react-router-dom')
- [x] QA-2: Fix Analytics.test.tsx assertions ('analytics:Alice' → 'Alice', 'analytics:Bob' → 'Bob')
- [x] QA-3: Fix RLS policy for uniks_users to allow owner/admin manage all members

#### Medium Priority (Recommended)
- [x] QA-4: Rename useMetaverseDetails.ts → useUnikDetails.ts
- [x] QA-5: Remove duplicate file UnikMemberActions.tsx (keep MemberActions.tsx)
- [x] QA-6: Remove unused handleChange function in UnikMember.tsx

#### Build & Lint Verification
- [x] Lint analytics-frt (98 errors auto-fixed, 11 warnings remain)
- [x] Lint uniks-frt (1 warning auto-fixed)
- [x] Lint uniks-srv (1 console warning - acceptable in migration)
- [x] Build analytics-frt (✅ successful)
- [x] Build uniks-frt (✅ successful)
- [x] Build uniks-srv (✅ successful)

#### Low Priority (Deferred)
- [ ] QA-7: Create separate issue for upstream cleanup (unused variable 't' in UpsertHistoryDialog)

### Uniks Functionality Refactoring
**Status**: Stages 1-8 complete, Stage 7,9,11 browser testing pending

#### Stage 1-6: Implementation (COMPLETED ✅)
- [x] 1.1: Remove duplicate /uniks routes from old UI (MainRoutes.jsx)
- [x] 1.2: Delete legacy sections.ts and entities.ts files
- [x] 1.3: Update TypeScript types (Unik interface)
- [x] 1.4: Enhance backend GET /unik/:id endpoint
- [x] 1.5: Update i18n translation keys
- [x] 1.6: Update UnikBoard component to use new metrics
- [x] 1.7: Clean up unused API methods
- [x] 1.8: Build and verify all packages (✅ 30/30 successful)

#### Stage 7: Browser Testing (USER)
- [ ] 7.1: Test navigation (/uniks → UnikList → UnikBoard)
- [ ] 7.2: Verify menu shows all 10 sections
- [ ] 7.3: Test UnikBoard metrics (Spaces, Tools, Members)
- [ ] 7.4: Test UnikMember access management
- [ ] 7.5: Verify legacy components load
- [ ] 7.6: Verify redirects (/unik → /uniks)
- [ ] 7.7: Test EN ↔ RU switching

#### Stage 8: API Path Alignment Fix
- [x] 8.1-8.2: Update endpoints from /uniks/ to /unik/
- [ ] 8.3: Rebuild uniks-frt
- [ ] 8.4: Browser test: /unik/:id/access members request (Content-Type: application/json)
- [ ] 8.5: Verify owner membership renders
- [ ] 8.6: Invite second member
- [ ] 8.7: Clean up diagnostics

#### Stage 9: Canvas Routes Registration (COMPLETED ✅)
- [x] 9.1-9.7: All Canvas routes registered, reactflow unified
- [ ] 9.8: Browser test: /unik/:id/spaces/new loads
- [ ] 9.9: Verify no "api is not defined" errors
- [ ] 9.10: Verify ReactFlow components render

#### Stage 11: Canvas Versions Crash Mitigation (COMPLETED ✅)
- [x] 11.1-11.5, 11.M1-11.M8: Defensive guards, MinimalLayout created
- [ ] 11.6: Browser verify no crash, graceful message
- [ ] 11.M9: Verify Canvas renders WITHOUT sidebar (full-screen)

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-13: Space Builder Namespace Refactor ✅
- Details: progress.md#2025-11-13

### 2025-11-12: i18n Phase 2-3 Fixes ✅
- Singleton binding, colon syntax, dialog fixes
- Details: progress.md#2025-11-12

### 2025-11-11: API Keys & Assistants i18n ✅
- Colon syntax migration, double namespace fix
- Details: progress.md#2025-11-11

### 2025-11-08: Profile Tests & OpenAPI YAML ✅
- Details: progress.md#2025-11-08

### 2025-11-07: HTTP Error Handling ✅
- Details: progress.md#2025-11-07

### 2025-11-06: Member Dialog UX ✅
- Details: progress.md#2025-11-06

### 2025-11-05: Dashboard & Universal Lists ✅
- Details: progress.md#2025-11-05

### 2025-11-04: React StrictMode Fix ✅
- Details: progress.md#2025-11-04

### 2025-11-03: Backend Pagination & Metrics ✅
- Details: progress.md#2025-11-03

---

## 📦 DEFERRED

### createMemberActions Factory Implementation
- Completed: Factory created, metaverses-frt refactored
- Pending: Browser tests for edit/remove functionality
- Details: progress.md#2025-11-XX

### Metaverses Architecture Refactoring
- Completed: Dashboard migration, actions consolidation, test organization
- Pending: Browser testing for dashboard and actions menu
- Details: progress.md#2025-11-XX

### API Client Migration (@universo/api-client)
- Problem: flowise-ui uses fetch() directly
- Solution: Create shared types package
- Status: DEFERRED (not blocking)

### Test Infrastructure Improvements
- MSW integration for proper API mocking
- Increase coverage beyond current levels
- Apply pattern to other list components

### QA Recommendations
- Form validation cleanup (remove manual regex, use Zod)
- Error handling improvements
- Details: progress.md#2025-11-XX

---

**Note**: For completed tasks older than 30 days, see progress.md. For detailed implementation steps, see progress.md entries by date.
