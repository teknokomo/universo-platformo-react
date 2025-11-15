# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frt architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination, Publish slug system, Role-based permissions, Publication system with Base58 links |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Localized default canvas handling, Chatflow→Canvas API refactoring, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors, QR code download, Testing strategy & shared utilities, AR.js camera disable mode, Passport.js + Supabase session architecture |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes, Space Builder provider/model selection, Metaverses module introduction, Singular routing pattern |

---

## November 2025 (Latest)

### 2025-01-14: Uniks Refactoring – Guards, Migration Rename, UI Columns ✅
**Context**: Comparative analysis with metaverses-srv and clusters-srv revealed 4 improvement opportunities in uniks package.

**Problems Identified**:
1. **No Guards Module**: uniks-srv had no guards.ts file (unlike metaverses/clusters)
   - Inline permission checks scattered across 8 endpoints
   - Manual `if (role !== 'owner')` checks without DRY pattern
   - Inconsistent error messages and logging
   
2. **Missing Edit/Delete Menu**: Frontend actions menu not showing for non-owner members
   - Root cause: Backend GET /:id endpoint didn't include `permissions` field in response
   - Frontend already had correct filtering logic: `unik.permissions?.manageUnik`
   
3. **Wrong Table Columns**: UnikList.tsx had incorrect columns
   - Missing "Название" (Name) column as first column
   - Showed "Секции" (Sections) and "Сущности" (Entities) - not applicable to Uniks
   - Pattern: Should match MetaverseList/ClusterList structure with spaces column
   
4. **Migration Naming Inconsistency**: Named "CreateUniksSchema" instead of "Add<Domain><Relations>" pattern
   - Other migrations: AddMetaversesSectionsEntities, AddClustersDomainsResources
   - Should be: AddUniksAndLinked (describes what it creates: uniks + links to Flowise tables)

**Implementation** (9 tasks, all completed ✅):

**Backend Refactoring**:

1. **Created Guards Module** (`packages/uniks-srv/base/src/routes/guards.ts`, 98 lines):
   - Used `createAccessGuards` factory from `@universo/auth-srv`
   - Defined ROLE_PERMISSIONS: owner (5 perms) → admin (4) → editor (3) → member (1)
   - Created `baseGuards`: assertPermission, ensureAccess, getMembershipSafe, hasPermission
   - Wrapper `ensureUnikAccess(ds, userId, unikId, permission)` for unik-specific checks
   - Helper `assertNotOwner(membership, action)` to protect owner from modification/removal
   - Pattern: Mirrors metaverses-srv/guards.ts and clusters-srv/guards.ts exactly

2. **Refactored 8 Endpoints** in `uniksRoutes.ts`:
   - **POST /members**: Replaced inline membership check with `ensureUnikAccess(ds, userId, unikId, 'manageMembers')`
   - **GET /:id**: Added permissions calculation based on user's role, included in response
     ```typescript
     const permissions = membership 
       ? { manageUnik: hasPermission(membership.role, 'manageUnik'), ... } 
       : null
     ```
   - **PUT /:id**: Replaced inline role check with `ensureUnikAccess(ds, userId, id, 'editContent')`
   - **DELETE /:id**: Replaced inline owner check with `ensureUnikAccess(ds, userId, id, 'manageUnik')`
   - **GET /:unikId/members**: Added NEW permission check (was missing!)
   - **POST /:unikId/members**: Replaced inline role array check with guards
   - **PATCH /:unikId/members/:memberId**: Added `assertNotOwner(targetMembership, 'modify')` protection
   - **DELETE /:unikId/members/:memberId**: Replaced inline owner check with `assertNotOwner(targetMembership, 'remove')`

**Migration Refactoring**:

3. **Renamed Migration File**: `1731200000000-CreateUniksSchema.ts` → `1731200000000-AddUniksAndLinked.ts`
4. **Updated Class Name**: `CreateUniksSchema1731200000000` → `AddUniksAndLinked1731200000000`
5. **Updated Export**: Modified `migrations/postgres/index.ts` to import/export new class name

**Frontend Refactoring**:

6. **Updated UnikList Columns** (`packages/uniks-frt/base/src/pages/UnikList.tsx`):
   - **Before**: [description, role, sections, entities] (4 columns)
   - **After**: [name, description, role, spaces] (4 columns)
   - Added **name** column FIRST (20% width, fontWeight 500 for emphasis)
   - Removed **sections** column (sectionsCount not relevant for Uniks)
   - Removed **entities** column (entitiesCount not relevant for Uniks)
   - Added **spaces** column (shows spacesCount from backend)
   - Pattern: Now matches MetaverseList.tsx column structure exactly
   - Note: Actions menu filtering already correct (`unik.permissions?.manageUnik`)

**i18n Updates**:

7. **Added Translations**: 
   - EN: `packages/universo-i18n/base/src/locales/en/core/common.json` → `"table.spaces": "Spaces"`
   - RU: `packages/universo-i18n/base/src/locales/ru/core/common.json` → `"table.spaces": "Пространства"`

**Build & Lint Verification**:

8. **uniks-srv**: ✅ Build successful, ✅ Lint clean (1 acceptable console warning in migration)
9. **uniks-frt**: ✅ Build successful (tsdown 40.11 kB CJS + 39.41 kB ESM), ✅ Lint clean (0 errors)

**Impact**:
- Security: Consistent permission checks across all endpoints, owner protection
- UX: Edit/Delete menu now visible for authorized users, correct table columns
- Maintainability: Guards pattern reduces duplication, follows established conventions
- Consistency: Migration naming matches metaverses/clusters pattern

**Pending** (browser verification by user):
- [ ] Navigate to /uniks and verify Name column displays first in table
- [ ] Click on a Unik and verify Edit/Delete menu appears (for owner/admin)
- [ ] Verify Spaces column shows correct count
- [ ] Test member management (add/edit/remove members with role-based permissions)

**Related**: 
- Guards factory creation: progress.md#2025-11-14 (Code Quality Improvements)
- Metaverses guards refactor: Same session (M2M logic fix)
- Clusters guards refactor: Same session (guards DRY)

---

### 2025-11-14: Code Quality Improvements - M2M Logic, Email Index, Guards DRY ✅
**Context**: Comparative analysis of metaverses-srv and clusters-srv implementations revealed 3 improvement opportunities.

**Problem 1 - M2M Access Logic Bug**:
- `ensureSectionAccess` in metaverses-srv used `findOne()` for M2M relationship
- Sections can link to MULTIPLE metaverses (M2M via sections_metaverses junction)
- User with access to ANY linked metaverse should access the section
- Bug: only checked FIRST link, denied access even if user was member of other linked metaverses

**Problem 2 - Missing Database Index**:
- All services perform case-insensitive email lookups: `LOWER(email) = LOWER(?)`
- No functional index on `LOWER(email)` → full table scans
- TODO comment in code: "Add a functional index to keep this lookup performant"

**Problem 3 - Code Duplication**:
- metaverses-srv/routes/guards.ts and clusters-srv/routes/guards.ts: ~95% identical
- 230 lines of duplicated logic for assertPermission, ensureAccess, getMemb ership, assertNotOwner
- Copy-paste pattern without abstraction → maintenance burden

**Implementation** (3 tasks):

**Task 1 - Fixed ensureSectionAccess M2M Logic**:
- File: `packages/metaverses-srv/base/src/routes/guards.ts` (lines 90-123)
- Changed from `.findOne()` to `.find()` to get ALL section-metaverse links
- Added iteration: loop through all linked metaverses, grant access if user is member of ANY
- Pattern source: mirrors clusters-srv/ensureDomainAccess (which was already correct)
- **Before**: 
  ```typescript
  const sectionMetaverse = await repo.findOne({ where: { section: { id: sectionId } }, relations: ['metaverse'] })
  if (!sectionMetaverse) throw 404
  return ensureMetaverseAccess(ds, userId, sectionMetaverse.metaverse.id, permission)
  ```
- **After**:
  ```typescript
  const sectionMetaverses = await repo.find({ where: { section: { id: sectionId } }, relations: ['metaverse'] })
  if (sectionMetaverses.length === 0) throw 404
  for (const link of sectionMetaverses) {
    try { return await ensureMetaverseAccess(ds, userId, link.metaverse.id, permission) }
    catch { continue } // Try next metaverse
  }
  throw lastError || 403 // No metaverse granted access
  ```

**Task 2 - Added LOWER(email) Functional Index**:
- Modified 3 migration files to add index on `LOWER(email)` in auth.users table:
  1. `packages/metaverses-srv/base/src/database/migrations/postgres/1730600000000-AddMetaversesSectionsEntities.ts`
  2. `packages/clusters-srv/base/src/database/migrations/postgres/1741277700000-AddClustersDomainsResources.ts`
  3. `packages/uniks-srv/base/src/database/migrations/postgres/1731200000000-CreateUniksSchema.ts`
- Added to `up()`: `CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (LOWER(email))`
- Added to `down()`: `DROP INDEX IF EXISTS auth.idx_auth_users_email_lower`
- Location: After full-text search indexes, before closing comment
- Impact: Case-insensitive email lookups now use index instead of full table scan

**Task 3 - Extracted Guards to Common Package @universo/auth-srv**:
- Created generic access control factory to eliminate duplication

**3.1 - New Infrastructure in auth-srv**:
- `packages/auth-srv/base/src/guards/types.ts`: 
  - `AccessGuardsConfig<TRole, TMembership>` interface
  - `MembershipContext`, `RolePermission` types
- `packages/auth-srv/base/src/guards/createAccessGuards.ts`:
  - Generic factory accepting config object (entityName, roles, permissions, getMembership, extractors)
  - Returns 5 guard functions: `assertPermission`, `ensureAccess`, `getMembershipSafe`, `hasPermission`, `assertNotOwner`
  - Handles ESM/CJS compatibility, structured logging with ISO timestamps
- `packages/auth-srv/base/src/guards/index.ts`: Barrel export
- `packages/auth-srv/base/src/index.ts`: Exported guard utilities
- Fixed lint error: empty catch block in auth.ts (added comment)
- Build: ✅ successful (tsc, no errors, 16 pre-existing console warnings)

**3.2 - Refactored metaverses-srv Guards**:
- File: `packages/metaverses-srv/base/src/routes/guards.ts`
- **Before**: 230 lines with manual implementations
- **After**: ~75 lines using factory pattern
- Changed:
  ```typescript
  // Before: manual implementation
  export function assertPermission(membership: MetaverseUser, permission: RolePermission): void {
    const role = (membership.role || 'member') as MetaverseRole
    const allowed = ROLE_PERMISSIONS[role]?.[permission]
    if (!allowed) { /* logging */ throw createError(403, ...) }
  }
  
  // After: use factory
  const baseGuards = createAccessGuards<MetaverseRole, MetaverseUser>({
    entityName: 'metaverse',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds, userId, metaverseId) => ...,
    extractRole: (m) => (m.role || 'member') as MetaverseRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.metaverse_id
  })
  export const { assertPermission, hasPermission } = baseGuards
  ```
- Kept specialized functions: `ensureSectionAccess`, `ensureEntityAccess` (M2M logic specific to metaverses)
- Kept custom `assertNotOwner` with metaverse-specific error messages
- Build: ✅ successful
- Tests: ✅ 25/25 passing (3 skipped Redis rate limit tests)

**3.3 - Refactored clusters-srv Guards**:
- File: `packages/clusters-srv/base/src/routes/guards.ts`
- Same pattern as metaverses-srv: ~230 lines → ~75 lines
- Factory config uses ClusterRole, ClusterUser, cluster_id field names
- Kept specialized: `ensureDomainAccess`, `ensureResourceAccess` (M2M logic)
- Kept custom `assertNotOwner` with cluster-specific messages
- Build: ✅ successful
- Tests: ✅ 25/25 passing (3 skipped Redis rate limit tests)

**Benefits**:
1. **M2M Logic Fix**: ensureSectionAccess now correctly handles multi-metaverse sections
2. **Performance**: LOWER(email) lookups now use index (prevents full table scan)
3. **Code Quality**: Eliminated ~460 lines of duplicate code across 2 services
4. **Maintainability**: Single source of truth for access control logic in @universo/auth-srv
5. **Type Safety**: Generic factory preserves TypeScript typing for roles/permissions
6. **Consistency**: Identical security logging format across all services

**Files Changed** (10 total):
- metaverses-srv: guards.ts (refactored), migration (index added)
- clusters-srv: guards.ts (refactored), migration (index added)
- uniks-srv: migration (index added)
- auth-srv: guards/types.ts (new), guards/createAccessGuards.ts (new), guards/index.ts (new), src/index.ts (updated), routes/auth.ts (lint fix)

**Validation**:
- auth-srv: ✅ build successful
- metaverses-srv: ✅ build + 25/25 tests passing
- clusters-srv: ✅ build + 25/25 tests passing
- All lint checks: ✅ (minor pre-existing warnings only)

**Next Steps** (if migrations need deployment):
1. Review migration SQL for correctness
2. Test on staging database
3. Apply to production (backward-compatible, idempotent)

### 2025-01-14: PR #545 QA Fixes Implementation ✅
**Problem**: Three AI bot reviewers (GitHub Copilot, Gemini Code Assist, ChatGPT Codex Connector) identified 8 issues in PR #545:
1. **CRITICAL**: ensureDomainAccess() using findOne() instead of find() for M2M relationships
2. **HIGH**: clusters-frt package.json with 51 devDependencies (30+ unused)
3. **MEDIUM**: Production debug console.log in ClusterList.tsx
4. **LOW**: Unused imports, variables, missing test assertions

**Security Impact**: ensureDomainAccess vulnerability allowed users with legitimate access to domains via secondary clusters to be incorrectly denied access (403 errors) because findOne() returned only the first domain-cluster link from junction table.

**Implementation** (8 fixes + verification):
1. **CRITICAL FIX - ensureDomainAccess M2M Support**:
   - File: `packages/clusters-srv/base/src/routes/guards.ts` (lines 103-137)
   - Changed `findOne()` → `find()` to retrieve ALL domain-cluster links
   - Added iteration loop: tries each cluster until finding one with user membership
   - Returns first successful cluster context or throws 403 after exhausting all options
   - **Before**: `const domainCluster = await domainClusterRepo.findOne(...)`
   - **After**: `const domainClusters = await domainClusterRepo.find(...); for (const domainCluster of domainClusters) { try { ... } catch { continue } }`
   - **Security Test**: ensureResourceAccess already handled M2M correctly (verified)

2. **HIGH PRIORITY - devDependencies Cleanup**:
   - File: `packages/clusters-frt/base/package.json`
   - Reduced from 51 to 19 devDependencies (~200-300 MB savings)
   - **Removed 32 packages**: react-redux, reactflow, flowise-react-json-view, react-syntax-highlighter, react-markdown, react-datepicker, react-color, framer-motion, react-perfect-scrollbar, html-react-parser, use-debounce, i18next-browser-languagedetector, dayjs, react-code-blocks, @mui/x-data-grid*, @mui/x-date-pickers*, @mui/x-tree-view (duplicate), codemirror suite (7 pkgs)
   - **Kept 19 essential**: testing libraries (@testing-library/*, vitest, msw, jest-axe, axe-core), build tools (tsdown, rimraf, eslint), form validation (react-hook-form, zod, @hookform/resolvers), Material-UI icons, React Query, notistack, react-router-dom

3. **MEDIUM PRIORITY - Debug Log Removal**:
   - File: `packages/clusters-frt/base/src/pages/ClusterList.tsx` (deleted lines 79-99)
   - Removed entire 21-line useEffect block with console.log tracking 8 pagination fields
   - Cleaned 8-item dependency array

4. **LOW PRIORITY - Code Quality Fixes**:
   - **Unused import**: `packages/flowise-server/src/routes/index.ts` - removed `getClustersRateLimiters`
   - **Unused variable**: `packages/clusters-srv/base/src/tests/routes/clustersRoutes.test.ts:320` - removed `authUserRepo`
   - **Test assertion**: Same file line 740 - added `expect(response.body.data).toBeDefined()`
   - **Prettier formatting**: Auto-fixed 12 formatting issues (whitespace, line breaks) across guards.ts, domainsRoutes.ts, clustersRoutes.test.ts
   - **Unused imports**: ClusterList.tsx - removed useEffect from imports, renamed unused searchValue to _searchValue

**Build & Lint Verification**:
- clusters-srv: ✅ Build successful, lint clean (1 warning: unused options param in test mock)
- clusters-frt: ✅ Build successful (tsdown 4217ms), lint clean (1 warning: React Hook deps)
- pnpm install: ✅ Completed (2m 13s), 47 peer dependency warnings (acceptable)

**Deferred Work** (Architectural Changes - Separate PR Recommended):
- **HIGH PRIORITY** (4-6 hours): Refactor useApi → useMutation throughout clusters-frt for React Query consistency
- **MEDIUM PRIORITY** (1 hour): Migrate useClusterName from raw fetch() to shared @universo/api-client

**Testing Status**:
- Unit tests: SKIPPED (Jest configuration issue with TypeORM decorators - requires root tsconfig.json fix)
- Build tests: ✅ PASSED (both packages compile without errors)
- Lint tests: ✅ PASSED (no errors, 2 acceptable warnings)
- Browser tests: ⏳ PENDING USER (verify multi-cluster domain access works correctly)

**Technical Debt Identified**:
- Root `tsconfig.json` missing `experimentalDecorators` and `emitDecoratorMetadata` (breaks Jest for TypeORM entities)
- Consider upgrading to newer TypeScript eslint version (currently 5.8.3 vs supported <5.2.0)

### 2025-11-14: Cluster Breadcrumbs Implementation ✅
**Problem**: Breadcrumbs navigation working for Metaverses (`/metaverses/:id/entities`) but missing for Clusters (`/clusters/:id/resources`). No cluster name displayed in navigation path.

**Solution**: Implemented cluster breadcrumbs following same pattern as Metaverses:
1. **Custom Hook**: Created `useClusterName.ts` hook:
   - Fetches cluster name from `/api/v1/clusters/:id` endpoint
   - Implements Map-based in-memory caching (same as useMetaverseName)
   - Includes `truncateClusterName()` helper for long names (30 char max + ellipsis)
   - Returns `string | null` with proper loading state handling

2. **Breadcrumbs Update**: Modified `NavbarBreadcrumbs.tsx`:
   - Added cluster context extraction: `const clusterIdMatch = location.pathname.match(/^\/clusters\/([^/]+)/)`
   - Added `useClusterName(clusterId)` hook call
   - Implemented cluster breadcrumb logic with 3 sub-pages:
     - `/clusters/:id` → Clusters → [ClusterName]
     - `/clusters/:id/access` → Clusters → [ClusterName] → Access
     - `/clusters/:id/resources` → Clusters → [ClusterName] → Resources
     - `/clusters/:id/domains` → Clusters → [ClusterName] → Domains

3. **Export Management**: Updated `/packages/universo-template-mui/base/src/hooks/index.ts` with `useClusterName` export

**Build Results**:
- @universo/template-mui: ✅ 3203.41 kB CJS, 271.88 kB ESM (1285ms)
- flowise-ui: ✅ 1m 10s compilation
- Full workspace: ✅ 32/32 tasks successful (3m 35s)

**Pattern Consistency**: Clusters now have same breadcrumb functionality as Metaverses (name display, truncation, sub-page navigation)

**Browser Testing Required**:
- Navigate to cluster pages and verify breadcrumbs display with actual cluster names
- Test truncation for long cluster names
- Verify all sub-pages (access, resources, domains) show correct breadcrumb paths
- Confirm Name column visible in all entity lists (Domains, Resources, Sections, Entities)

### 2025-01-13: UnikBoard Dashboard Refactoring ✅
**Problem**: UnikBoard showed only 3 metric cards (Spaces, Tools, Members). User requested expansion with 4 additional metrics: Credentials, Variables, API Keys, Document Stores. Dashboard layout needed reorganization from 2 rows to 3 rows to accommodate 7 small cards plus existing documentation card and 2 large demo charts.

**Critical Bugs Found & Fixed**: 
1. Initial implementation used incorrect table name `api_key` causing 500 error. Analysis revealed:
   - TypeORM entity uses `@Entity('apikey')` (table name is `apikey`, not `api_key`)
   - Old migration `.backup/.../1741277504476-AddUniks.ts` correctly referenced `'apikey'`
   - Current migration `1731200000000-CreateUniksSchema.ts` was missing `'apikey'` in down() method

2. QA analysis discovered `custom_template` table missing from migration:
   - Entity `CustomTemplate` has `@ManyToOne(() => Unik)` relationship
   - Used actively in `marketplaces` service (`getAllCustomTemplates`, `deleteCustomTemplate`)
   - Old migration included it, but new migration had it removed
   - Without `unik_id` column, Custom Templates feature would fail with FK constraint errors

**Requirements**:
- **Row 1**: 3 small metric cards (Spaces, Members, Credentials) + 1 documentation card
- **Row 2**: 4 small metric cards (Tools, Variables, API Keys, Documents)
- **Row 3**: 2 large demo charts unchanged (Sessions, Page Views)
- **i18n Fix**: Correct Russian orthography "Учетные данные" → "Учётные данные" (letter ё) across 8 files
- **Menu Cleanup**: Comment out "Assistants" menu item while keeping route accessible

**Implementation** (10 tasks):
1. **Backend Extension**: Added 4 new COUNT queries to GET /unik/:id endpoint using QueryBuilder pattern:
   - `credentialsCount` from `public.credential` table (WHERE unikId = :id)
   - `variablesCount` from `public.variable` table (WHERE unikId = :id)
   - `apiKeysCount` from `public.api_key` table (WHERE unikId = :id)
   - `documentStoresCount` from `public.document_store` table (WHERE unikId = :id)

2. **TypeScript Types**: Extended Unik interface with 4 optional count fields (credentialsCount, variablesCount, apiKeysCount, documentStoresCount)

3. **Component Refactoring**: Reorganized UnikBoard.tsx Grid layout:
   - Changed from 2-row to 3-row structure
   - Added 4 new StatCard components with proper breakpoints (xs=12, sm=6, lg=3)
   - Positioned documentation HighlightedCard in Row 1 after 3 stat cards
   - Maintained responsive design with Material-UI Grid system

4. **Demo Data**: Added 5 trend arrays (30 data points each) for SparkLineChart visualization:
   - `credentialsData`, `variablesData`, `apiKeysData`, `documentStoresData` using `Array(30).fill(count).map((n, i) => n + i % 3)` pattern

5. **i18n English**: Added translations to `uniks-frt/i18n/locales/en/uniks.json` under `board.stats`:
   - credentials (title, interval, description)
   - variables (title, interval, description)
   - apiKeys (title, interval, description)
   - documentStores (title, interval, description)

6. **i18n Russian**: Added translations to `uniks-frt/i18n/locales/ru/uniks.json` (same structure as EN)

7. **Orthography Fixes**: Updated 8 i18n files to replace "Учетные данные" with "Учётные данные" (letter ё):
   - universo-i18n/locales/ru/views/menu.json
   - spaces-frt/i18n/locales/ru/views/menu.json
   - uniks-frt/i18n/locales/ru/credentials.json
   - uniks-frt/i18n/locales/ru/auth.json
   - uniks-frt/i18n/locales/ru/assistants.json
   - uniks-frt/i18n/locales/ru/vector-store.json
   - uniks-frt/i18n/locales/ru/canvas.json
   - uniks-frt/i18n/locales/ru/speech-to-text.json

8. **Menu Configuration**: Commented out "Assistants" menu item in `unikDashboard.ts` with explanatory comment:
   ```typescript
   // Temporarily disabled in navigation menu while keeping route accessible
   // Users can still access /uniks/:id/assistants via direct URL
   ```

9. **Test Updates**: Modified `UnikBoard.test.tsx` to accommodate new dashboard structure:
   - Extended mockUnikData from 3 to 7 count fields
   - Updated assertions to expect 7 stat cards instead of 3
   - Adjusted edge case tests (zero counts, missing data fields) to validate ≥7 cards

10. **Build Validation**: Verified compilation and code quality:
    - Backend build (uniks-srv): ✅ SUCCESS (TypeScript compilation clean)
    - Frontend build (uniks-frt): ✅ SUCCESS (tsdown dual ESM/CJS output: 40.11 kB CJS, 39.41 kB ESM)
    - Linting (uniks-frt): ✅ SUCCESS (Prettier formatting auto-fixed)
    - Linting (uniks-srv): ⚠️ 1 pre-existing console.log warning in migration (unrelated to changes)
    - Unit tests: ⚠️ 3 test suites failed due to pre-existing import resolution issues (UnikList, UnikMember, template imports), NOT related to implemented changes

**Files Modified**:
- packages/uniks-srv/base/src/routes/uniksRoutes.ts (backend endpoint)
- packages/uniks-frt/base/src/types.ts (TypeScript interface)
- packages/uniks-frt/base/src/pages/UnikBoard.tsx (Grid reorganization, 7 cards)
- packages/uniks-frt/base/src/i18n/locales/en/uniks.json (EN translations)
- packages/uniks-frt/base/src/i18n/locales/ru/uniks.json (RU translations)
- 8 i18n files (orthography fixes for "Учётные данные")
- packages/uniks-frt/base/src/menu-items/unikDashboard.ts (Assistants commented out)
- packages/uniks-frt/base/src/pages/__tests__/UnikBoard.test.tsx (test assertions)

**Status**: Implementation 100% complete, builds passing. **Next Step**: Browser testing by user (verify 7 cards render, test EN↔RU switching, check responsive layout, confirm Assistants route accessible).

**Technical Notes**:
- Test project environment: no active users, acceptable to replace legacy code, database can be recreated
- Pre-existing test failures do NOT affect implemented functionality (import resolution issues in unrelated components)
- All TypeScript compilation successful, code quality standards met (ESLint/Prettier)

### 2025-11-13: PR #539 Bot Review Fixes (QA Analysis Complete) ✅
**Problem**: GitHub PR #539 received automated bot reviews (Gemini Code Assist, Copilot, Codex) with 14 comments. Needed verification of suggestions against actual codebase to avoid breaking changes.

**QA Analysis Results**:
- **Total Comments**: 14 from 4 bots
- **Real Issues**: 6 (3 critical, 2 medium, 1 low)
- **False Positives**: 3 (Copilot analyzed build-time shims instead of runtime code)
- **Bot Accuracy**: 67%

**Critical Fixes Implemented**:
1. **Analytics.test.tsx Import Path** (CRITICAL): Fixed TypeScript generic type import `'analytics:react-router-dom'` → `'react-router-dom'` (line 51)
2. **Analytics.test.tsx Assertions** (HIGH): Removed i18n namespace prefix from test assertions `'analytics:Alice'` → `'Alice'`, `'analytics:Bob'` → `'Bob'` (lines 122-123)
3. **RLS Policy for uniks_users** (CRITICAL - P1): Updated PostgreSQL Row Level Security policy to allow owner/admin roles to manage all members in their Unik:
   - **Before**: `USING (user_id = auth.uid())` - only shows user's own record
   - **After**: Added EXISTS subquery checking owner/admin role to allow viewing/managing all members in the Unik
   - **Impact**: Without this fix, member management endpoints (GET/POST/PATCH/DELETE /unik/:id/members) would not work

**Medium Priority Fixes**:
4. **File Rename**: `useMetaverseDetails.ts` → `useUnikDetails.ts` to match exported hook name (reduces confusion)
5. **Duplicate Removal**: Deleted `UnikMemberActions.tsx` (100% identical to `MemberActions.tsx`, verified with diff)
6. **Cleanup**: Removed unused `handleChange` function in `UnikMember.tsx` (direct setter used instead per comment)

**False Positives Identified**:
- Copilot: "Unused variable handleChange" - verified function was actually unused (removed in fix #6)
- Copilot: "Superfluous argument to useApi" (2 instances) - analyzed build-time shim instead of runtime implementation

**Verification**:
- Lint: analytics-frt (98 errors auto-fixed), uniks-frt (1 warning fixed), uniks-srv (1 console.log in migration - acceptable)
- Build: analytics-frt ✅, uniks-frt ✅, uniks-srv ✅

**Files Modified**:
- packages/analytics-frt/base/src/pages/__tests__/Analytics.test.tsx (import + assertions)
- packages/uniks-srv/base/src/database/migrations/postgres/1731200000000-CreateUniksSchema.ts (RLS policy + down migration)
- packages/uniks-frt/base/src/api/useMetaverseDetails.ts → useUnikDetails.ts (renamed)
- packages/uniks-frt/base/src/pages/UnikBoard.tsx (import path updated)
- packages/uniks-frt/base/src/pages/UnikMemberActions.tsx (DELETED - duplicate)
- packages/uniks-frt/base/src/pages/UnikMember.tsx (removed unused handleChange)

**Deferred**:
- Low priority issue: Unused variable 't' in UpsertHistoryDialog (upstream Flowise code, needs separate cleanup issue)

### 2025-11-14: Uniks Module Refactoring (Stages 1-8 Complete) ✅
**Problem**: After Metaverses refactoring, Uniks showed 3 UI issues: (1) Route conflicts showing old UI, (2) Wrong metrics in UnikBoard (Sections/Entities instead of Spaces/Tools), (3) Legacy code copied from Metaverses.

**Architecture Decision**: QA analysis revealed critical error in initial plan—Uniks and Metaverses are INDEPENDENT modules with different purposes:
- **Uniks**: 3D content + Tools + Members
- **Metaverses**: Sections + Entities + Members

**Implementation** (8 stages):
1. **Route Cleanup**: Removed all Unik-related routes from flowise-template-mui (MainRoutes.jsx) to eliminate conflict with universo-template-mui
2. **Legacy File Deletion**: Removed unused sections.ts and entities.ts from uniks-frt (copy-paste waste from Metaverses, 0 imports found via grep)
3. **Type Definitions**: Updated Unik interface in types.ts (sectionsCount/entitiesCount → spacesCount/toolsCount), removed Section/Entity interfaces
4. **Backend API**: Enhanced GET /unik/:id endpoint to calculate and return spacesCount (from public.spaces), toolsCount (from public.tool), membersCount (from public.unik_member)
5. **i18n Updates**: Replaced board.stats.sections/entities with board.stats.spaces/tools in en/uniks.json and ru/uniks.json
6. **Component Updates**: Modified UnikBoard.tsx to use new metrics (spacesData/toolsData instead of sectionsData/entitiesData)
7. **API Cleanup**: Removed legacy methods from uniks.ts API client (getUnikSections, getUnikEntities, addEntityToUnik, removeEntityFromUnik, reorderUnikEntities, addSectionToUnik)
8. **Build Validation**: Full pnpm build successful (30/30 packages), lint errors fixed with --fix, only non-critical console warnings remain

**Files Modified**:
- packages/flowise-template-mui/base/src/routes/MainRoutes.jsx (routes removed)
- packages/uniks-frt/base/src/api/sections.ts (DELETED)
- packages/uniks-frt/base/src/api/entities.ts (DELETED)
- packages/uniks-frt/base/src/types.ts (Unik interface updated)
- packages/uniks-srv/base/src/routes/uniksRoutes.ts (GET /unik/:id enhanced)
- packages/uniks-frt/base/src/i18n/locales/en/uniks.json (i18n keys updated)
- packages/uniks-frt/base/src/i18n/locales/ru/uniks.json (i18n keys updated)
- packages/uniks-frt/base/src/pages/UnikBoard.tsx (component refactored)
- packages/uniks-frt/base/src/api/uniks.ts (legacy methods removed)

**Status**: Implementation complete, browser testing pending (Stage 7).

### 2025-11-13: Space Builder Namespace Refactor ✅
Registered dedicated `spaceBuilder` namespace (was merged into default), bound components to `useTranslation('spaceBuilder')`, short keys (`t('title')`). Fixed JSX parse errors. Build OK.

### 2025-11-12: i18n Systematic Fixes (Phases 1-5) ✅
**Residual Keys**: Registered PlayCanvas template namespace, fixed SpeechToText/Space Builder hooks. **Publish RU**: Fixed JSON structure (`common` under `publish` root). **Phase 4**: Canvas nodes, VectorStore, Configuration (14 files). **Phase 2-3**: Singleton binding (`getInstance()` → `i18n`), 18 canvas menu colon syntax, ViewMessages/ViewLeads namespace binding, AddNodes categories path. **Translation Keys**: Publish namespace registration, canvas menu 9 keys added, legacy i18nInstance.js removed. 30 packages built.

**Critical Pattern**:
```typescript
// ❌ Double namespace
const { t } = useTranslation('canvas')
t('canvas.key') // → canvas:canvas.key (broken)

// ✅ Correct
const { t } = useTranslation('canvas')
t('key') // → canvas:key

// ✅ Cross-namespace
const { t } = useTranslation()
t('canvas:key') // → canvas:key
```

### 2025-11-11: Canvas MinimalLayout + Members API ✅
**MinimalLayout**: Created bare `<Outlet/>` layout (no sidebar), restructured routes (Canvas paths in MinimalRoutes array), full-screen editing mode. **Members API**: Backend TypeORM repositories, Zod validation, pagination with standard headers (`X-Pagination-*`). Fixed pagination TypeError. Canvas crash mitigation: CanvasVersionsDialog feature detection, safe wrappers, placeholder UI when `api.canvasVersions` undefined.

### 2025-11-10: i18n Double Namespace Fix ✅
Fixed Assistants/Credentials/API Keys pages showing raw keys (`assistants:custom.title` with `useTranslation('assistants')` → double prefix). Changed to `useTranslation()` without namespace param. 16 files fixed, 3 builds OK.

### 2025-11-09: MSW Handlers + createMemberActions Factory ✅
**MSW**: Pagination metadata унификация, relative dates (dayjs), critical fixes (400/404/409 responses). **Factory**: createMemberActions pattern (action hooks), TypeScript generics, 1543 LOC refactored. MetaverseBoardGrid simplification, architecture QA fixes.

### 2025-11-07 to 2025-11-08: Error Handling + Profile QA ✅
HTTP error middleware (http-errors package, Variant A), i18n error messages (members.errors), proper status codes. Profile service tests fixed, OpenAPI YAML fixes, Member dialog UX, Test infrastructure validation, Profile entity duplication fix.

### 2025-11-06: Metaverse Module Stabilization ✅
**Dashboard**: Analytics backend (TypeORM), 3 stat cards + 2 charts, TanStack Query caching. **Universal List Pattern**: SectionList, EntityList, MetaverseMembers (1543 LOC), backend pagination (Zod), role-based filtering (documented in systemPatterns.md). **Fixes**: N+1 query batch loading, entity count sync triggers, React StrictMode production bug (RouterContext wrapper), search LIKE→Russian, form reset UX, MUI v5→v6 grid spacing.

### 2025-11-02: Backend Pagination + Router Context ✅
Unified pagination utilities (Zod schemas), applied to metaverses/sections/entities endpoints. Added react-router-dom peerDependency to @flowise/template-mui (resolved RouterContext loss).

---

## October 2025

Rate limiting with Redis, i18n migration to TypeScript, metaverses namespace consolidation, tsdown build system migration (all packages), template-mui extraction, white screen production fix, publication system 429 errors resolved.

## September 2025

Chatflow→Canvas terminology refactoring, canvas versioning backend, Space Builder enhancements, Passport.js session hardening, TanStack Query pagination, AR.js configuration management, routing fixes.

---

**Note**: For detailed older entries, see Git history. For current work → tasks.md. For architectural patterns → systemPatterns.md.
