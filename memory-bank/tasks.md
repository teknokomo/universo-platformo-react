# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## ✅ COMPLETED: Admin Packages QA Fixes (2025-12-05)

**Goal**: Fix issues identified during QA analysis of admin-backend and admin-frontend packages.

**Issues Fixed**:
1. **Debug console.log statements** in `ensureGlobalAccess.ts` - removed 4 debug logs
2. **React duplication** in `admin-frontend/package.json` - removed from dependencies (kept in peerDependencies)
3. **Partial TypeORM refactoring** - converted simple CRUD methods to TypeORM Repository pattern
4. **Missing documentation** - created README.md and README-RU.md for both packages

**Architecture Decision**: Kept SQL functions for RLS (e.g., `admin.has_global_access()`) because:
- Used in RLS policies across multiple modules  
- Single source of truth for permission logic
- Called by 6+ backend modules via `hasGlobalAccessByDataSource()`

### Tasks
- [x] Remove debug console.log from ensureGlobalAccess.ts
- [x] Fix react duplication in admin-frontend package.json
- [x] Refactor simple CRUD methods to TypeORM Repository (getAllRoles, getGlobalAccessRoles, getRoleByName, revokeAssignment)
- [x] Keep SQL functions unchanged (hasGlobalAccess, getGlobalAccessInfo, listGlobalUsers, grantRole, etc.)
- [x] Create README.md for admin-backend (EN)
- [x] Create README-RU.md for admin-backend (RU)
- [x] Create README.md for admin-frontend (EN)
- [x] Create README-RU.md for admin-frontend (RU)
- [x] Build and validate (52/52 packages successful)

---

## ✅ COMPLETED: Frontend Metaverse-Scoped API Fix (2025-01-05)

**Goal**: Fix issue where superadmin could see metaverse list but sections/entities were empty when viewing other users' metaverses.

**Root Cause**: 
- `EntityList.tsx` and `SectionList.tsx` used global `/entities` and `/sections` APIs
- These components didn't use `metaverseId` from URL params to fetch metaverse-scoped data
- RLS correctly blocked access since global APIs don't pass metaverse context

**Solution**:
- Updated `EntityList.tsx` to conditionally use `metaversesApi.listMetaverseEntities()` when `metaverseId` is present
- Updated `SectionList.tsx` to conditionally use `metaversesApi.listMetaverseSections()` when `metaverseId` is present
- Updated query keys to use `metaversesQueryKeys.entitiesList()` / `metaversesQueryKeys.sectionsList()` when scoped to metaverse
- Updated cache invalidation to invalidate both metaverse-scoped and global caches
- Added `metaverseId` to useCallback dependencies for context creation functions

### Tasks
- [x] Add `listMetaverseEntities()` paginated API function
- [x] Add `listMetaverseSections()` paginated API function
- [x] Add metaverse-scoped query keys (`entitiesList`, `sectionsList`)
- [x] Update EntityList.tsx to use metaverse-scoped API when metaverseId present
- [x] Update SectionList.tsx to use metaverse-scoped API when metaverseId present
- [x] Update cache invalidation in both components
- [x] Build and verify (52/52 packages)

---

## ✅ COMPLETED: Fix Global Admin RLS Bypass (2025-01-05)

**Goal**: Fix issue where superadmin could see metaverses but not sections/entities inside them.

**Problem**: 
- `admin.has_global_access()` used `SECURITY INVOKER` which ran with user's RLS context
- RLS policy on `admin.user_roles` called `has_global_access()` creating circular dependency
- Function couldn't read user_roles and always returned false

**Solution**:
- Changed `has_global_access()` to `SECURITY DEFINER` (bypasses RLS)
- Changed `has_permission()` to `SECURITY DEFINER`
- Added `users_read_own_roles` policy for users to read their own role assignments
- Added `authenticated_read_roles` policy for all authenticated users to read roles table
- Simplified management policies to use `admin.has_global_access()` function

---

## ✅ COMPLETED: Metaverses Migration Consolidation (2025-01-05)

**Goal**: Consolidate metaverses-backend migrations into single clean migration file with admin bypass.

### Tasks
- [x] Delete garbage SQL file `1733312400000-AddGlobalAdminRLSBypass.sql`
- [x] Create consolidated `1733600000000-CreateMetaversesSchema.ts`
- [x] Update `index.ts` to export only new migration
- [x] Delete old migration files
- [x] Build and verify (52/52 packages)

---

## ✅ COMPLETED: TypeORM Entities for Admin RBAC (2025-12-06)

**Goal**: Create proper TypeORM entities for Admin RBAC system instead of raw SQL queries.

### Changes Made ✅
- [x] Created `Role.ts` entity with `display_name` (JSONB), `color`, `has_global_access`, `is_system`
- [x] Created `RolePermission.ts` entity with `@ManyToOne` relation to Role
- [x] Created `UserRole.ts` entity with `@ManyToOne` relation to Role
- [x] Updated `entities/index.ts` to export `adminEntities` array
- [x] Updated `admin-backend/src/index.ts` to export entities
- [x] Updated `flowise-core-backend/database/entities/index.ts` to import and register adminEntities
- [x] Full build successful (52/52 packages)

---

## ✅ COMPLETED: Migration Consolidation (2025-12-05)

**Goal**: Consolidate all admin-backend migrations into a single clean migration file.

### Changes Made ✅
- [x] Created `1733400000000-CreateAdminRBAC.ts` - single consolidated migration
- [x] Deleted old migration files (5 files + 1 SQL):
  - `1733250000000-CreateGlobalUsers.ts`
  - `1733311200000-AddGlobalUserComment.ts`
  - `1733400000000-CreateRBACSystem.ts`
  - `1733400000000-CreateRBACSystem.sql`
  - `1733500000000-AddRoleMetadata.ts`
  - `SEED_AFTER_RECREATION.sql`
- [x] Updated `index.ts` to export only the new migration
- [x] Replaced `SUPER_USERS_MODE` with `GLOBAL_ADMIN_ENABLED` in `.env` and `.env.example`
- [x] Updated `ensureGlobalAccess.ts` - new `isGlobalAdminEnabled()` function
- [x] Deleted deprecated `GlobalUser.ts` entity
- [x] Deleted deprecated `globalUserService.ts` service
- [x] Cleaned `admin-backend/src/index.ts` exports

---

## ✅ COMPLETED: Dynamic Global Roles - Clean Slate Refactoring (2025-12-06)

**Goal**: Refactor from hardcoded `superadmin`/`supermoderator` to dynamic database-driven global roles with metadata (display_name, color, has_global_access).

### Phase 1: Database Migration ✅
- [x] Add metadata columns to `admin.roles` table (display_name, color, has_global_access)
- [x] Create `admin.has_global_access(uuid)` function
- [x] Create `admin.get_user_global_roles(uuid)` function
- [x] Drop old `admin.global_users` table (migration includes drop)
- Note: Migration `1733500000000-AddRoleMetadata.ts` created

### Phase 2: Types Consolidation ✅
- [x] Update `@universo/types` with unified `GlobalRoleInfo` type
- [x] Add `LocalizedString`, `RoleMetadata`, `GlobalUserMember` interfaces
- [x] Keep `GlobalRole` and `SuperUsersMode` for backward compatibility

### Phase 3: Backend - globalAccessService ✅
- [x] Create new `globalAccessService.ts` to replace `globalUserService.ts`
- [x] Implement `hasGlobalAccess()`, `grantRole()`, `revokeGlobalAccess()`, `listGlobalUsers()`
- [x] Export `hasGlobalAccessByDataSource()`, `getGlobalRoleNameByDataSource()`
- [x] All TypeScript errors fixed

### Phase 4: Backend - Auth Permissions Endpoint ✅
- [x] Expand `/api/v1/auth/permissions` to return `globalRoles` and `rolesMetadata`
- [x] Return `hasGlobalAccess` boolean flag
- [x] Added `getGlobalRoles()`, `getRolesMetadata()`, `getFullPermissionData()` to permissionService

### Phase 5: Backend - Roles CRUD Routes (SKIPPED - later)
- [ ] Create `rolesRoutes.ts` for admin CRUD operations on roles
- [ ] Implement role management endpoints
- Note: Skipped, will be done when admin-frontend refactoring is complete

### Phase 6: Backend - Update Guards ✅
- [x] Update `createAccessGuards.ts` to use `hasGlobalAccess` boolean
- [x] Update guards types (`getGlobalRole` → `hasGlobalAccess`)
- [x] Update 7 module guards (metaverses, clusters, organizations, storages, campaigns, projects, uniks)
- [x] Update 3 routes (sectionsRoutes, entitiesRoutes, metaversesRoutes)
- [x] All backend packages build successfully

### Phase 7: Frontend - AbilityContext ✅
- [x] Update `AbilityContextProvider.jsx` to provide `globalRoles`, `rolesMetadata`, `hasGlobalAccess`
- [x] Create `useHasGlobalAccess.js` hook
- [x] Export from flowise-store index.ts

### Phase 8: Frontend - RoleChip v2 ✅
- [x] Update `RoleChip.tsx` to use dynamic colors from optional `roleMetadata` prop
- [x] Falls back to hardcoded styles if metadata not provided
- [x] Build successful

### Phase 9: Frontend - Admin Module Refactor ✅
- [x] Refactor `admin-frontend` to use new types and API
- [x] Update `types.ts` with RoleMetadata, updated GlobalUserMember
- [x] Update `adminApi.ts` with MyRoleResponse type
- [x] Update `useGlobalRole.ts` with new hooks (useHasGlobalAccess, useGlobalRoleMetadata)
- [x] Update `AdminAccess.tsx` to use roleMetadata in RoleChip
- [x] Update globalUsersRoutes.ts to use globalAccessService
- [x] Update ensureGlobalAccess.ts guard for new service
- [x] Update flowise-core-backend routes to use createGlobalAccessService
- [x] All frontend and backend packages build successfully

### Phase 10: Cleanup ✅
- [x] Mark `GlobalUser.ts` entity as @deprecated 
- [x] Mark `globalUserService.ts` as @deprecated
- [x] Delete old migrations - consolidated into single migration
- [x] Empty adminEntities to prevent TypeORM sync errors

### Phase 11: ENV and Documentation ✅
- [x] Replace `SUPER_USERS_MODE` with `GLOBAL_ADMIN_ENABLED`
- [x] Update `.env` and `.env.example`
- [x] Update `ensureGlobalAccess.ts` with `isGlobalAdminEnabled()`
- [x] Update memory-bank documentation

---

## ✅ COMPLETED: RBAC + CASL Integration (2025-06-14)

**Goal**: Implement flexible RBAC with wildcard support and CASL for frontend/backend permission checks.

### Phase 1: Database Layer ✅
- [x] Create `admin.roles` table
- [x] Create `admin.role_permissions` table with wildcard support (module='*', action='*')
- [x] Create `admin.user_roles` table
- [x] Create `admin.has_permission()` PostgreSQL function
- [x] Create `admin.get_user_permissions()` PostgreSQL function
- [x] Migrate existing global_users to new RBAC system
- [x] Update migration order (admin migrations first)

### Phase 2: Backend CASL Integration ✅
- [x] Install @casl/ability in workspace root
- [x] Create CASL types in @universo/types (Actions, Subjects, AppAbility)
- [x] Create `permissionService.ts` in auth-backend
- [x] Create `abilityMiddleware.ts` in auth-backend
- [x] Add GET /api/v1/auth/permissions endpoint
- [x] Export new services/types from packages

### Phase 3: Frontend CASL Integration ✅
- [x] Install @casl/react in flowise-core-frontend
- [x] Install @casl/ability and @casl/react in flowise-store
- [x] Create `AbilityContext.jsx` in flowise-store
- [x] Create `AbilityContextProvider.jsx` in flowise-store
- [x] Create `useAbility.js` hook in flowise-store
- [x] Create `Can.jsx` component wrapper in flowise-store
- [x] Export all from flowise-store index.ts

### Phase 4: Integration & Testing
- [x] Full project build
- [x] Apply RBAC migration to database
- [x] Pass getDataSource to createAuthRouter() in flowise-core-backend
- [ ] **USER ACTION**: Run SEED_AFTER_RECREATION.sql in Supabase SQL Editor
- [ ] Test permissions endpoint
- [ ] Test Can component in admin module

### Phase 5: Admin UI (Optional)
- [ ] Create roles management page
- [ ] Create role permissions editor
- [ ] Create user roles assignment UI

---

## ✅ COMPLETED: Fix RoleChip for Global Admins (2025-06-15)

**Issue**: When superadmin views items via "Show all items", RoleChip displayed "Owner" instead of actual access type (superadmin/supermoderator).

**Root Cause**: 
- `metaversesRoutes.ts` used `COALESCE(mu.role, 'owner')` for global admins without membership
- Frontend received `role: 'owner'` and displayed "Владелец" instead of actual global role

**Solution**: Added `accessType` field to API response showing how access was obtained.

### Backend Changes
- [x] Add `accessType` field to metaverses list response (values: 'member' | 'superadmin' | 'supermoderator')
- [x] Update metaversesRoutes.ts GET /metaverses to include accessType via CASE expression

### Frontend Changes  
- [x] Add `AccessType` type to metaverses-frontend types.ts
- [x] Update RoleChip to accept `accessType` prop
- [x] Show global role (superadmin/supermoderator) when accessType is not 'member'
- [x] Update MetaverseList table and cards to pass accessType to RoleChip
- [x] Full build (52/52 passed)

---

## ✅ COMPLETED: RLS Global Admin Bypass (2025-12-04)

**Issue**: Superadmin can access metaverse dashboard but created sections don't appear (RLS filters them).

**Root Cause Analysis**:
1. RLS policies DO have `admin.is_global_admin()` bypass - ✅ correct
2. BUT application-level code in routes (sectionsRoutes, entitiesRoutes, metaversesRoutes) 
   explicitly filters by `user_id = :userId` in SQL queries, ignoring global admin status

**Solution**: 
1. RLS policies - already have bypass via `admin.is_global_admin()`
2. Application routes - added `getGlobalRoleByDataSource` check to:
   - `sectionsRoutes.ts` - GET /sections
   - `entitiesRoutes.ts` - GET /entities  
   - `metaversesRoutes.ts` - GET /metaverses

**Tasks**:
- [x] Create `admin.is_global_admin()` SQL function
- [x] Create migration `1733312400000-AddGlobalAdminRLSBypass.ts`
- [x] Create SQL script for manual deployment
- [x] Update sectionsRoutes.ts to check global admin role
- [x] Update entitiesRoutes.ts to check global admin role
- [x] Update metaversesRoutes.ts to check global admin role
- [x] Build project (52/52 passed)
- [ ] Test as superadmin - verify sections/entities/metaverses visible

---

## ✅ COMPLETED: User Settings System (2025-12-05)

**Goal**: Add user settings system so superadmin can toggle between "show only my items" vs "show all items"

**Solution**: Store settings in profile (profile-backend), settings dialog in toolbar

### Backend (profile-backend)
- [x] Add `settings` JSONB column to Profile entity
- [x] Add `settings` column to AddProfile migration
- [x] Create `UserSettingsData` and `UpdateSettingsDto` types
- [x] Add `getUserSettings()` and `updateUserSettings()` to ProfileService
- [x] Add `getSettings()` and `updateSettings()` to ProfileController
- [x] Add `GET /profile/settings` and `PUT /profile/settings` routes
- [x] Add `getOrCreateProfile()` method - auto-creates profile if not exists
- [x] Add `GET /profile/me` endpoint - returns or creates current user's profile
- [x] Update `updateUserSettings()` to auto-create profile if needed

### Frontend (universo-template-mui)
- [x] Create `useUserSettings.ts` hook
- [x] Create `SettingsDialog.tsx` component
- [x] Add `settingsEnabled` prop to `ToolbarControls`
- [x] Add i18n translations (en/ru) - inline in component
- [x] Fix i18n: use `i18n.addResourceBundle()` directly (bundler compatibility)

### Frontend (profile-frontend)
- [x] Update `Profile.jsx` to use `/api/v1/profile/me` endpoint (auto-creates profile)

### Backend Routes (showAll support)
- [x] Update `metaversesRoutes.ts` to accept `showAll` query parameter
- [x] Update `sectionsRoutes.ts` to accept `showAll` query parameter
- [x] Update `entitiesRoutes.ts` to accept `showAll` query parameter

### Frontend Integration
- [x] Update `metaverses.ts` API to pass `showAll` parameter
- [x] Add `settingsEnabled` prop to MetaverseList
- [x] Connect `useUserSettings` to list query params
- [x] Full project build (52/52 passed)

**Key Fix (2025-12-05)**:
- Problem: Users authenticated via Supabase but with no profile record caused 404 on settings save
- Solution: Auto-create profile on first access via `/profile/me` or when saving settings
- Nickname auto-generated from email prefix + userId suffix

---

## ✅ COMPLETED: Superadmin Cross-Entity Access (2025-06-13)

**Issue**: Superadmin cannot access Metaverses, Projects, Clusters where they are not a member.
Error in logs: `[SECURITY] Permission denied... reason: 'not_member'`

**Root Cause**: `createAccessGuards.ts` only checks membership, not global roles.
Uniks work by accident because GET /:id has no access check.

**Solution**: Modified `createAccessGuards` to:
1. Accept optional `getGlobalRole` function
2. Check global role before membership
3. If superadmin/supermoderator - create synthetic membership with full (owner-level) permissions

**Tasks**:
- [x] Update `types.ts` in auth-backend - add GlobalRole and getGlobalRole to config
- [x] Update `createAccessGuards.ts` - add global role check in ensureAccess
- [x] Add `getGlobalRoleByDataSource` standalone function in admin-backend
- [x] Update metaverses-backend `guards.ts` - pass getGlobalRole function
- [x] Update clusters-backend `guards.ts` - pass getGlobalRole function  
- [x] Update projects-backend `guards.ts` - pass getGlobalRole function
- [x] Update storages-backend `guards.ts` - pass getGlobalRole function
- [x] Update organizations-backend `guards.ts` - pass getGlobalRole function
- [x] Update campaigns-backend `guards.ts` - pass getGlobalRole function
- [x] Update uniks-backend `guards.ts` - pass getGlobalRole function
- [x] Add @universo/admin-backend dependency to all affected packages
- [x] Full rebuild - PASSED (52/52)

---

## ✅ COMPLETED: Admin Comment Field Support (2025-12-04)

**Issue**: Global users don't have comment field support (unlike clusters).

**Tasks**:
- [x] Add `comment` column to `GlobalUser` entity
- [x] Create migration for adding comment column
- [x] Update API routes to handle comment (grant + update)
- [x] Update frontend types (GlobalUserMember)
- [x] Add comment column to AdminAccess table
- [x] Update cards to show comment (description = nickname + comment)
- [x] Update MemberActions to use actual comment from member
- [x] Full rebuild - PASSED (52/52)

---

## ✅ COMPLETED: Admin Edit/Delete Bug Fixes (2025-06-13)

**Issue**: Edit dialog shows empty role list, delete doesn't work.

**Root Cause Analysis**:
1. `createMemberActions.tsx` used type `AssignableRole` (admin|editor|member), but admin module needs `superadmin|supermoderator`
2. `roleLabels` were not passed to edit dialog, so only default labels (admin, editor, member) were available
3. Delete action used `entity.id` but global users API expects `userId` for deletion

**Tasks**:
- [x] Fix `createMemberActions.tsx` - change `availableRoles` type from `AssignableRole` to `MemberRole`
- [x] Add `getMemberId` config option to extract correct ID for API calls
- [x] Add `roleLabels` and `roleLabelsKey` config options for role label customization
- [x] Update `MemberActions.tsx` in admin-frontend - add `getMemberId: (member) => member.userId`
- [x] Full rebuild - PASSED (52/52)

---

## ✅ COMPLETED: Admin Module Refactoring (2025-06-13)

**Goal**: Refactor admin-frontend and admin-backend to follow unified patterns from clusters module.

### Phase 1: Backend Changes
- [x] Update `POST /global-users` - accept email instead of user_id
- [x] Add `listAllWithDetails()` to service (JOIN with auth.users + profiles)
- [x] Add pagination and search to GET endpoint
- [x] Update Zod schemas

### Phase 2: Frontend Changes
- [x] Create `AdminBoard.tsx` (copy from ClusterBoard, adapt)
- [x] Create `AdminAccess.tsx` (copy from ClusterMembers, adapt)
- [x] Create `MemberActions.tsx` (factory pattern)
- [x] Update `types.ts` with GlobalUserMember
- [x] Update `adminApi.ts` - new endpoints
- [x] Update `hooks/mutations.ts` - TanStack Query
- [x] Update i18n files (en/ru admin.json)
- [x] Delete `GlobalUsersList.tsx`

### Phase 3: Menu/Routes Updates
- [x] Replace `adminMenuItem` with `getAdminMenuItems()`
- [x] Update `MenuContent.tsx` - group with header
- [x] Update `MainRoutesMUI.tsx` - nested routes `/admin`, `/admin/access`
- [x] Update exports in `menuConfigs.ts`

### Phase 4: i18n Updates
- [x] Add key `adminboard` to menu.json (en/ru)
- [x] Key `access` already existed in menu.json

### Phase 5: Finalization
- [x] Full build `pnpm build` - PASSED (52 tasks)

**Summary**:
- Menu now shows "Администрирование" section header with 2 items:
  - "Админборд" → `/admin` (AdminBoard.tsx)
  - "Доступ" → `/admin/access` (AdminAccess.tsx)
- User invite by email (not UUID)
- Follows clusters-frontend unified patterns

---

## ✅ COMPLETED: Admin Packages Bug Fixes (2025-12-03)

**Issue**: Menu "Администрирование" not appearing after setting SUPER_USERS_MODE=superadmin and adding DB record.

**Root Causes Identified**:
1. Wrong API response parsing (`data.role` instead of `data.data.role`)
2. Incorrect SUPER_USERS_MODE logic (inverted from requirements)
3. Missing disabled check in /me endpoint
4. **Double API prefix** (`/api/v1/api/v1/admin/global-users`) - apiClient already had `/api/v1` baseURL

**Tasks**:
- [x] Fix `useGlobalRoleCheck.ts` - parse `data?.data?.role` correctly
- [x] Fix `ensureGlobalAccess.ts` - implement effectiveRole with correct downgrade logic
- [x] Fix `/me` endpoint - add disabled check + return effectiveRole based on mode
- [x] Fix `globalUsersRoutes.ts` - add `getSuperUsersMode` import
- [x] Update `.env.example` - correct comments for SUPER_USERS_MODE
- [x] Fix TypeORM entity metadata - use lazy `getDataSource: () => DataSource` pattern
- [x] Fix `adminApi.ts` BASE_PATH - removed duplicate `/api/v1` prefix (now `/admin/global-users`)
- [x] Rebuild admin-frontend

**SUPER_USERS_MODE Logic (Corrected)**:
- `superadmin`: Superadmin = full access (manage+view), Supermoderator = view-only
- `supermoderator`: ALL super users downgraded to view-only (including Superadmin)
- `disabled`: No access for anyone

**User validation pending**: Test page loading after API path fix.

---

## ✅ COMPLETED: Admin Packages (2025-12-03)

**Goal**: Create admin-frontend and admin-backend packages for global user management (Superadmin/Supermoderator).

### Phase 1: admin-backend (Core) ✅
- [x] Create package structure `packages/admin-backend/base/`
- [x] Create `package.json`, `tsconfig.json`
- [x] Create entity `GlobalUser.ts`
- [x] Create migration `CreateGlobalUsers`
- [x] Create service `globalUserService.ts`
- [x] Create guard `ensureGlobalAccess.ts`
- [x] Create routes `globalUsersRoutes.ts`
- [x] Create `index.ts` with exports

### Phase 2: Backend Integration ✅
- [x] Register entities in `flowise-core-backend`
- [x] Register migrations in `flowise-core-backend`
- [x] Connect routes in `flowise-core-backend`

### Phase 3: admin-frontend ✅
- [x] Create package structure `packages/admin-frontend/base/`
- [x] Create `package.json`, `tsconfig.json`, `tsdown.config.ts`
- [x] Create API client `adminApi.ts`
- [x] Create hooks `useGlobalRole.ts`, `mutations.ts`
- [x] Create page `GlobalUsersList.tsx`
- [x] Create i18n files (en/ru)

### Phase 4: Frontend Integration ✅
- [x] Add `adminMenuItem` to `menuConfigs.ts`
- [x] Modify `MenuContent.tsx` with divider
- [x] Add route in `MainRoutesMUI.tsx`
- [x] Register i18n

### Phase 5: Finalization ✅
- [x] Add types to `@universo/types`
- [x] Update `.env.example`
- [x] Run `pnpm build` (52/52 successful)
- [x] Fix cyclic dependency (admin-frontend ↔ template-mui)

### SQL for Initial Superadmin

Run this SQL manually after migrations to grant superadmin role to email `580-39-39@mail.ru`:

```sql
INSERT INTO admin.global_users (user_id, role, granted_by)
SELECT id, 'superadmin', id
FROM auth.users
WHERE email = '580-39-39@mail.ru';
```

---

## ✅ COMPLETED: Package Naming Refactoring (2025-01-22)

**Goal**: Rename and restructure core Flowise packages with modern naming conventions.

**Changes**:
- `packages/flowise-ui` → `packages/flowise-core-frontend/base` ("@flowise/core-frontend")
- `packages/flowise-server` → `packages/flowise-core-backend/base` ("@flowise/core-backend")
- `packages/flowise-components` → `packages/flowise-components/base` (added base/ structure)
- `packages/universo-api-client` → `packages/universo-api-client/base` (added base/ structure)

**Tasks Completed**:
- [x] Create base/ structure for all 4 packages
- [x] Update package.json names and dependencies
- [x] Update getNodeModulesPackagePath call in index.ts
- [x] Update all documentation and agent instructions
- [x] Fix tsconfig.json files - added `"types": ["node"]` to ~50 packages
- [x] Fix vite.config.js paths for node_modules resolution
- [x] Build: 50/50 successful

Details: progress.md#2025-01-22

---

## ✅ COMPLETED: Zod Validation Schemas for spaces-backend (2025-01-20)

**Summary**: Added Zod validation schemas to `spaces-backend`, replacing verbose manual validation.

**Results**:
- Created `packages/spaces-backend/base/src/schemas/index.ts` (~220 lines)
- Refactored `spacesController.ts` from ~750 lines to ~515 lines (~30% reduction)
- Schemas: CreateSpaceSchema, UpdateSpaceSchema, CreateCanvasSchema, UpdateCanvasSchema, etc.
- Helper functions: `extractUnikId()`, `formatZodError()`, `validateBody()`, `safeValidateBody()`

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: System Status Fields for Spaces & Canvases (2025-01-20)

**Summary**: Added versioning and status fields to Spaces and Canvases.

**Database Changes**:
- Spaces: 9 new columns (version_group_id, version_uuid, version_label, version_index, is_active, is_published, is_deleted, deleted_date, deleted_by)
- Canvases: 4 new columns (is_published, is_deleted, deleted_date, deleted_by)
- Partial indexes for performance
- RLS policies updated to exclude deleted records

**Migration Consolidation**:
- Deleted `1743000000003-FixActiveVersions.ts` (merged into main migration)
- Main migration now has 10-step idempotent process

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: Canvas Versions API Client (2025-01-20)

**Summary**: Added `api.canvasVersions` to @universo/api-client.

**Methods**: `list`, `create`, `update`, `activate`, `remove`
**Types**: `CanvasVersion`, `CreateCanvasVersionPayload`, `UpdateCanvasVersionPayload`

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: Canvases Migration Consolidation (2025-01-20)

**Summary**: Consolidated 7 chat_flow migrations from flowise-server into spaces-backend.

**Changes**:
- Renamed ChatflowType → CanvasType throughout codebase
- Deleted 7 old migrations from flowise-server
- Cleaned up legacy code (IActiveChatflows, validateChatflowAPIKey, getUsedChatflowNames)
- Rewrote flowise-server migrations index with documented phase order

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: CustomTemplates Package Extraction (2025-01-19)

**Summary**: Extracted CustomTemplate (Marketplace) functionality.

**Packages Created**:
- `@flowise/customtemplates-backend`: entity, migration, DI service, exports
- `@flowise/customtemplates-frontend`: Templates pages, i18n (en/ru)

**API Client**: `MarketplacesApi` with getAllTemplates, getAllCustom, saveCustom, deleteCustom

**Integration**:
- flowise-server: imports from @flowise/customtemplates-backend
- universo-template-mui: routes and menu added
- Naming migration: Marketplaces → Templates complete

Build: 50/50 successful. Details: progress.md#2025-01-19

---

## ✅ COMPLETED: QA Cleanup - Remove Duplicates (2025-01-19)

**VectorStore Dialogs**:
- Deleted 4 duplicate files from template-mui
- Updated imports in spaces-frontend to use @flowise/docstore-frontend

**Marketplaces**:
- Deleted `flowise-ui/src/views/marketplaces/`
- Updated CanvasRoutes.jsx, ExportAsTemplateDialog.jsx

Details: progress.md#2025-01-19

---

## ✅ COMPLETED: DocumentStore Full Migration (2025-12-01-02)

**Summary**: Full extraction to @flowise/docstore-backend and @flowise/docstore-frontend.

**Backend (@flowise/docstore-backend)**:
- 3 entities: DocumentStore, DocumentStoreFileChunk, UpsertHistory
- 4 DI services: documentStoreService, chunkService, loaderService, vectorStoreConfigService
- Consolidated migration: 1711637331047-AddDocumentStore.ts
- Controller and Router for basic CRUD

**Frontend (@flowise/docstore-frontend)**:
- 20 JSX files (~7254 lines)
- Merged i18n (document-store + vector-store = 600 lines)

**Integration**:
- Clean Integration pattern: CRUD delegates to DI, complex ops stay in flowise-server
- Fixed 403 error on Preview & Process
- Fixed i18n interpolation: `{var}` → `{{var}}`

Build: 48/48 successful. Details: progress.md#2025-12-01

---

## ✅ COMPLETED: Package Extractions (2025-11-27-29)

**ChatMessage** (2025-11-29):
- @universo/flowise-chatmessage-backend: ChatMessage + Feedback entities, consolidated migration
- Full DI pattern with createChatMessagesService, createFeedbackService factories
- Utility wrappers for buildCanvasFlow compatibility
- Deleted 10 legacy migrations from flowise-server

**Leads** (2025-11-29):
- @universo/flowise-leads-backend: Lead entity, DI service, routes
- @universo/flowise-leads-frontend: minimal (namespace exports only)
- Fixed critical bugs in ChatMessage.jsx and Analytics.jsx

**Assistants** (2025-11-28):
- @universo/flowise-assistants-backend: Assistant entity, consolidated migration
- @universo/flowise-assistants-frontend: 8 JSX pages, i18n
- Optional dependencies via DI config
- Fixed cyclic dependency via peerDependency

**ApiKey** (2025-11-28):
- @universo/flowise-apikey-backend: dual storage mode (JSON + DB)
- @universo/flowise-apikey-frontend: 3 pages, i18n
- UUID for IDs throughout

**Variables** (2025-11-28):
- @universo/flowise-variables-backend: DI pattern with Zod validation
- @universo/flowise-variables-frontend: 3 pages, i18n

**Credentials** (2025-11-27):
- @universo/flowise-credentials-backend: encryption via DI callbacks
- @universo/flowise-credentials-frontend: Credentials page, i18n

**Tools** (2025-11-27):
- @universo/flowise-tools-backend: DI service with telemetry
- @universo/flowise-tools-frontend: Tools page
- Migration order: Init → Tools → Credentials

All packages use DI pattern, consolidated migrations, Zod validation.
User testing pending for all.

Details: progress.md#2025-11-27, progress.md#2025-11-28, progress.md#2025-11-29

---

## ✅ COMPLETED: QA Fixes & Refactoring (2025-11-25-28)

**useApi → useMutation Refactoring**:
- 7 packages migrated (campaigns, clusters, metaverses, organizations, projects, storages, uniks)
- Consolidated `hooks/mutations.ts` per package (~2000 lines total)
- Deleted 7 unused useApi.ts files

**PR Bot Review Fixes**:
- PR #560: campaigns-backend displayName, unused variables
- PR #564: toolsErrorHandler registration, package.json cleanup
- PR #566: N+1 query fix, UUID validation, error handling

**AR.js Node Connections Mode**:
- Fixed `quizState is not defined` error
- Changed nested template literal to string concatenation

**useApi Shim Fix**:
- Fixed flowise-template-mui hooks exports
- Deleted stub files, fixed 12 relative imports

Details: progress.md#2025-11-25

---

## 🚧 IN PROGRESS

### Campaigns Integration (Phase 8/9)

**Status**: Build fixes complete, menu integration done.

**Completed**:
- [x] Phase 1-7: Backend + Frontend + Routes + Menu + Breadcrumbs
- [x] Phase 8: Build error fixes (9 files, 22+ changes)

**Remaining**:
- [ ] Phase 9: Browser testing (USER) - CRUD operations, permissions, i18n

---

### Organizations Integration (PAUSED)

**Status**: Phases 1-8 complete, paused for ItemCard fix.

**Remaining**:
- [ ] Phase 9: Browser testing after ItemCard fix

---

### ItemCard Click Handling 🧪

**Status**: "Overlay Link" pattern implemented.

**Pattern**:
- RouterLink replaced with Link overlay (z-index: 5)
- Menu button z-index: 10 (above link)
- Prevents navigation on menu click

**Tests** (USER):
- [ ] Card body click → navigation
- [ ] Menu button click → menu opens (no navigation)
- [ ] Verify in: Organizations, Metaverses, Clusters, Projects

---

### Browser Testing Backlog 🧪

**Pending user verification**:
- [ ] Package extractions (ChatMessage, Leads, Assistants, ApiKey, Variables, Credentials, Tools)
- [ ] DocumentStore migration functional testing
- [ ] AR.js Node Connections Mode
- [ ] Templates page after CustomTemplates extraction

---

## 📦 DEFERRED

### Template MUI CommonJS Shims
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Status**: Low priority, workarounds in place

---

## ✅ HISTORICAL TASKS (Before November 2025)

For completed tasks before November 2025, see progress.md:
- October 2025: Rate limiting, i18n migration, tsdown build system
- September 2025: AR.js configuration, TanStack Query, cluster isolation
- August 2025 and earlier: Space Builder MVP, Metaverse module, Flowise integration

---

**Note**: For implementation details, see progress.md. For patterns, see systemPatterns.md.

---

## ✅ COMPLETED: Earlier November Tasks

### 2025-11-25: Compression Rules Enhancement ✅
- Added trigger conditions: compress ONLY files exceeding limits
- Added minimum size requirement: ≥80% of limit after compression
- Updated validation rubric with over-compression check

### 2025-11-24: Documentation Major Refactoring ✅
- Configuration docs: 22 files synced EN→RU
- Integrations docs: 249 files synced
- Applications docs: Main README rewritten (593→234 lines)
- Created 4 new module pages (Organizations, Clusters, Projects, Spaces)

### 2025-11-23: Storages i18n Architecture Fix ✅
- Removed duplicates from storages.json
- Removed module-specific keys from common.json
- Fixed translation function usage

### 2025-11-22: i18n Members & Tables Refactoring ✅
- Centralized `members` keys in common.json
- Decentralized module-specific table keys
- Updated 16+ files across 5 modules

### 2025-11-17-18: Projects Integration ✅
- 23 issues fixed (11 QA + 12 runtime)
- Router registered, all pages loading
- Terminology consistency: "Milestones" label unified in Russian UI

### 2025-11-14: Code Quality & Clusters ✅
- Created `createAccessGuards` factory (auth-backend)
- Fixed M2M logic in ensureSectionAccess
- Cluster breadcrumbs with useClusterName hook

### 2025-11-13: Uniks Refactoring ✅
- Route cleanup, type definitions updated
- Backend: spacesCount/toolsCount metrics
- UnikBoard dashboard: 3 → 7 metric cards

---

## 📋 Task Management Guidelines

### Task States
- `[ ]` - Not started / Pending
- `[x]` - Completed
- `🚧` - In progress
- `🧪` - Awaiting user testing
- `⏸️` - Paused

### Task Format
```markdown
## ✅ COMPLETED: [Feature Name] (YYYY-MM-DD)

**Summary**: One-line description.

**Key Changes**:
- Change 1
- Change 2

**Build**: X/X successful
Details: progress.md#YYYY-MM-DD
```

### Archival Rules
- Tasks >60 days: Move to progress.md, keep 1-line summary here
- Tasks 15-60 days: Condense to summary format
- Tasks <15 days: Keep full details

---

## 🔗 Cross-References

### Related Files
- **progress.md**: Chronological completion log
- **systemPatterns.md**: Architectural patterns
- **activeContext.md**: Current focus

### Key Patterns
- DI Factory Pattern: systemPatterns.md#service-factory-nodeprovider-pattern
- RLS Integration: systemPatterns.md#rls-integration-pattern
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern

---

**Last Updated**: 2025-12-03
