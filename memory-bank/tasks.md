# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## ✅ COMPLETED: Dynamic Role Dropdown for Global Users (2025-12-08)

**Goal**: Make role dropdown dynamic - load roles with `hasGlobalAccess: true` from database instead of hardcoded `['superadmin', 'supermoderator']`

### Completed Steps:
- [x] Step 1: Update i18n labels for role form fields (en + ru)
- [x] Step 2: Extend MemberRole type for dynamic roles (GlobalAssignableRole interface)
- [x] Step 3: Create backend GET /api/v1/admin/roles/assignable endpoint
- [x] Step 4: Add frontend API getAssignableRoles() method
- [x] Step 5: Add assignable query key to queryKeys.ts
- [x] Step 6: Create useAssignableGlobalRoles hook
- [x] Step 7: Update components for dynamic role loading (AdminAccess, InstanceAccess, MemberActions, createMemberActions)
- [x] Step 8: Implement cache invalidation on role CRUD (RoleEdit.tsx, RolesList.tsx)

### Files Modified:
- `packages/admin-frontend/base/src/i18n/en/admin.json`
- `packages/admin-frontend/base/src/i18n/ru/admin.json`
- `packages/universo-types/base/src/validation/member.ts`
- `packages/admin-backend/base/src/routes/rolesRoutes.ts`
- `packages/admin-frontend/base/src/api/rolesApi.ts`
- `packages/admin-frontend/base/src/api/queryKeys.ts`
- `packages/admin-frontend/base/src/hooks/useAssignableGlobalRoles.ts` (new)
- `packages/admin-frontend/base/src/hooks/index.ts`
- `packages/admin-frontend/base/src/pages/AdminAccess.tsx`
- `packages/admin-frontend/base/src/pages/InstanceAccess.tsx`
- `packages/admin-frontend/base/src/pages/MemberActions.tsx`
- `packages/admin-frontend/base/src/pages/RoleEdit.tsx`
- `packages/admin-frontend/base/src/pages/RolesList.tsx`
- `packages/universo-template-mui/base/src/factories/createMemberActions.tsx`

---

## ✅ COMPLETED: useRoleName Hook Fix for Create Mode (2025-12-08)

**Goal**: Fix 400 Bad Request error when navigating to `/admin/instance/.../roles/new`

### Root Cause:
`useRoleName` hook in `universo-template-mui` was making a fetch request to `/api/v1/admin/roles/new` without checking if roleId === 'new'. The backend correctly rejects this as invalid UUID format.

### Solution Applied:
- Added early return in `useRoleName.ts` when `roleId === 'new'`

### Files Modified:
- `packages/universo-template-mui/base/src/hooks/useRoleName.ts`:
  - Added check: `if (roleId === 'new') { setName(null); return; }`

### Build Verification:
- universo-template-mui package: ✅ builds successfully
- Full project build: ✅ 52/52 packages successful

---

## ✅ COMPLETED: Role Creation UX Fix (2025-12-08)

**Goal**: Fix role creation flow - navigate to RoleEdit page instead of using EntityFormDialog.

### Root Cause:
The 400 Bad Request error when creating roles was caused by:
1. `EntityFormDialog` only collects `name` and `description`
2. Backend `CreateRoleSchema` requires: `name`, `displayName`, `color`, `hasGlobalAccess`, `permissions[].min(1)`
3. `handleCreateRole` passed `permissions: []` which failed validation

### Solution Applied:
- Changed `handleAddNew` to navigate to `/admin/instance/${instanceId}/roles/new`
- Removed `EntityFormDialog` usage from `RolesList.tsx`
- RoleEdit already supports create mode (`isNew = roleId === 'new'`)
- RoleEdit has complete form with all required fields

### Files Modified:
- `packages/admin-frontend/base/src/pages/RolesList.tsx`:
  - Removed `EntityFormDialog` import
  - Removed `isDialogOpen`, `isCreating`, `dialogError` states
  - Removed `handleDialogClose`, `handleCreateRole` functions
  - Changed `handleAddNew` to use `navigate()` instead of `setDialogOpen(true)`
  - Removed `<EntityFormDialog>` component from JSX

### Build Verification:
- admin-frontend package: ✅ builds successfully
- Full project build: ✅ 52/52 packages successful

---

## ✅ COMPLETED: RBAC Refactoring - Database-driven Permission Checks (2025-01-17)

**Goal**: Replace hardcoded `roleName !== 'superadmin'` check in `ensureGlobalAccess.ts` with database-driven CRUD permissions using existing CASL/permissionService infrastructure.

### Root Cause:
The 403 Forbidden error when PATCH `/api/v1/admin/roles/:id` was caused by hardcoded check:
```typescript
if (permission === 'manage' && roleName !== 'superadmin') {
    throw createError(403, 'Access denied: superadmin role required')
}
```

### Solution Applied:
- Refactored `ensureGlobalAccess` to use `permissionService.hasPermission(userId, module, action)`
- Changed signature from `('view'|'manage')` to `(module: string, action: CrudAction)`
- Added 'Role' and 'Instance' to CASL Subjects in universo-types and flowise-store
- Updated all admin routes to use new module:action pattern

### Tasks:
- [x] Add 'Role' | 'Instance' to Subjects type in universo-types/abilities
- [x] Add roles/instances mapping in flowise-store AbilityContextProvider
- [x] Refactor ensureGlobalAccess.ts with IPermissionService dependency
- [x] Update rolesRoutes.ts: `ensureGlobalAccess('roles', 'read'|'create'|'update'|'delete')`
- [x] Update instancesRoutes.ts: `ensureGlobalAccess('instances', 'read'|'update')`
- [x] Update globalUsersRoutes.ts: `ensureGlobalAccess('users', 'read'|'create'|'update'|'delete')`
- [x] Update flowise-core-backend routes/index.ts with permissionService injection
- [x] Build validation (52/52 packages successful)

### Files Modified:
- `packages/universo-types/base/src/abilities/index.ts` (+Role, +Instance to Subjects)
- `packages/flowise-store/base/src/context/AbilityContextProvider.jsx` (+roles, +instances mapping)
- `packages/admin-backend/base/src/guards/ensureGlobalAccess.ts` (complete refactoring)
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` (module:action pattern)
- `packages/admin-backend/base/src/routes/instancesRoutes.ts` (module:action pattern)
- `packages/admin-backend/base/src/routes/globalUsersRoutes.ts` (module:action pattern)
- `packages/admin-backend/base/src/index.ts` (export CrudAction, EnsureGlobalAccessOptions)
- `packages/flowise-core-backend/base/src/routes/index.ts` (permissionService injection)

### Impact:
- supermoderator role with `roles:update` permission can now edit role displayName/description/color
- System roles (`is_system=true`) still protected by route logic (cannot modify name/is_system)
- Future roles (Суперредактор, Супераудитор) can have granular CRUD permissions
- No more hardcoded role name checks - all permission decisions from database

---

## ✅ COMPLETED: RoleUsers usePaginated Pattern Alignment (2025-01-17)

**Goal**: Align RoleUsers component with MetaverseList/InstanceList patterns - server-side pagination with `usePaginated` hook.

### Issues Fixed:
1. **Client-side Pagination** → Server-side with `usePaginated` hook
2. **`toLocaleDateString()`** → `formatDate` from `@universo/utils`
3. **Missing PageSize Selector** → `rowsPerPageOptions={[10, 20, 50, 100]}`
4. **`delay: 300`** → `delay: 0` for instant search
5. **Count text below pagination** → Removed (info already in PaginationControls)

### Tasks:
- [x] Backend: Add `RoleUsersQuerySchema` (Zod) with limit/offset/search/sortBy/sortOrder
- [x] Backend: Update GET /:id/users with search via EXISTS subquery, getManyAndCount, X-Pagination-* headers
- [x] Update `queryKeys.ts` with `usersList(id, params)` using normalized defaults
- [x] Update `rolesApi.ts` with `RoleUsersParams` + `PaginatedResponse<RoleUser>`
- [x] Refactor `RoleUsers.tsx` with `usePaginated`, `formatDate`, proper PaginationControls
- [x] Fix exports in `index.ts` (remove `RoleUsersResponse`, add `RoleUsersParams`)
- [x] Build validation (52/52 packages successful)

### Files Modified:
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` (RoleUsersQuerySchema + pagination)
- `packages/admin-frontend/base/src/api/queryKeys.ts` (usersList with normalized params)
- `packages/admin-frontend/base/src/api/rolesApi.ts` (RoleUsersParams + PaginatedResponse)
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx` (usePaginated + formatDate)
- `packages/admin-frontend/base/src/index.ts` (exports fix)

---

## ✅ COMPLETED: RoleUsers TypeORM Refactoring (2025-01-16)

**Goal**: Refactor rolesRoutes.ts to use TypeORM Repository pattern instead of raw SQL, matching the established patterns in rls-integration-pattern.md.

### Issues Fixed:
1. **Raw SQL Violation** - Replaced `ds.query()` with TypeORM Repository pattern following organizations example
2. **Missing AuthUser Fields** - Extended AuthUser entity with status computation fields
3. **Type Mismatches** - Frontend now uses proper camelCase `RoleUser` from API
4. **PaginationControls Errors** - Fixed prop names to match `PaginationState`/`PaginationActions` interfaces

### Tasks:
- [x] Extend AuthUser entity with status-related fields (raw_user_meta_data, confirmed_at, last_sign_in_at, banned_until)
- [x] Add computed getters to AuthUser (fullName, status)
- [x] Refactor rolesRoutes.ts GET /:id/users to use TypeORM Repository pattern
- [x] Refactor rolesRoutes.ts DELETE /:id to use userRoleRepo.count() instead of raw SQL
- [x] Update rolesApi.ts types with UserStatus type and status field
- [x] Fix RoleUsers.tsx field names (camelCase instead of snake_case)
- [x] Fix RoleUsers.tsx PaginationControls props
- [x] Build validation (52/52 packages successful)

### Files Modified:
- `packages/auth-backend/base/src/database/entities/AuthUser.ts` (extended with status fields + getters)
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` (TypeORM Repository pattern)
- `packages/admin-frontend/base/src/api/rolesApi.ts` (UserStatus type + status field)
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx` (camelCase fields + PaginationControls fix)

---

## ✅ COMPLETED: RoleUsers Page Redesign (2025-01-15)

**Goal**: Complete redesign of RoleUsers page with standard UI pattern and fix breadcrumbs instance name display.

### Issues Fixed:
1. **Breadcrumbs Instance Name** - Fixed useInstanceName hook to parse API response structure (same as useRoleName)
2. **RoleUsers UI Complete Redesign** - Replaced basic table with full standard UI matching RolesList pattern
3. **Dynamic User Status** - Backend now returns real user status (active/inactive/pending/banned) from auth.users

### Tasks:
- [x] Fix useInstanceName.ts to handle `{ success: true, data: instance }` response structure
- [x] Add roles.users.* i18n keys to admin.json (EN)
- [x] Add roles.users.* i18n keys to admin.json (RU)
- [x] Update rolesRoutes.ts /:id/users endpoint with status calculation SQL
- [x] Complete rewrite of RoleUsers.tsx with card/list views, search, pagination, StatusChip
- [x] Build validation (52/52 packages successful)

### Files Modified:
- `packages/universo-template-mui/base/src/hooks/useInstanceName.ts` (response parsing fix)
- `packages/admin-frontend/base/i18n/en/admin.json` (roles.users.* section)
- `packages/admin-frontend/base/i18n/ru/admin.json` (roles.users.* section)
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` (status calculation in SQL)
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx` (complete UI redesign)

---

## ✅ COMPLETED: Roles UI Final Polish (2025-01-14)

**Goal**: Final visual and backend fixes for unified Roles UI.

### Issues Fixed:
1. **Small Color Dot** - Added 12px color dot before role name in card view (matching table view)
2. **Button Text** - Changed "Добавить роль" → "Добавить" (using common i18n key)
3. **Breadcrumbs Dynamic Name** - Fixed useRoleName hook to handle API response structure (data wrapper + snake_case)
4. **Backend 500 Error** - Fixed SQL query using correct column names (created_at/granted_by instead of assigned_at/assigned_by)

### Tasks:
- [x] Add `colorDotSize` prop to ItemCard component (default: 35px)
- [x] Use `colorDotSize={12}` in RolesList cards with `color: role.color`
- [x] Change primaryAction label from `t('roles.addNew')` to `tc('addNew')`
- [x] Fix useRoleName hook to handle `{ success: true, data: role }` response structure
- [x] Fix useRoleName hook to check both `displayName` and `display_name` variants
- [x] Fix rolesRoutes.ts SQL query: `created_at AS assigned_at`, `granted_by AS assigned_by`
- [x] Build validation (52/52 packages successful)

### Files Modified:
- `packages/universo-template-mui/base/src/components/cards/ItemCard.tsx` (colorDotSize prop)
- `packages/universo-template-mui/base/src/hooks/useRoleName.ts` (response parsing fix)
- `packages/admin-frontend/base/src/pages/RolesList.tsx` (color dot + button text)
- `packages/admin-backend/base/src/routes/rolesRoutes.ts` (SQL column names fix)

---

## ✅ COMPLETED: Roles UI Additional Refinements (2025-12-07)

**Goal**: Fix 4 additional issues identified during QA testing.

### Issues Fixed:
1. **Chips Position** - Code was already correct; user needed to refresh after build
2. **Breadcrumbs Role Name** - Added `useRoleName` hook for dynamic role name display
3. **Breadcrumbs Instance Name** - Added `useInstanceName` hook for dynamic instance name display
4. **Admin Menu in Entity Contexts** - Fixed condition to hide Admin menu in all entity contexts (metaverse, cluster, project, etc.)

### Tasks:
- [x] Verify Chips code in RolesList.tsx is correct (footerStartContent)
- [x] Create `useInstanceName` hook with API fetch and caching
- [x] Create `useRoleName` hook with API fetch and caching (handles displayName localization)
- [x] Export new hooks from hooks/index.ts
- [x] Update NavbarBreadcrumbs.tsx to use dynamic instance/role names
- [x] Fix MenuContent.tsx to hide Admin menu in all entity contexts
- [x] Build validation (52/52 packages successful)

### Files Created:
- `packages/universo-template-mui/base/src/hooks/useInstanceName.ts`
- `packages/universo-template-mui/base/src/hooks/useRoleName.ts`

### Files Modified:
- `packages/universo-template-mui/base/src/hooks/index.ts` (added exports)
- `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx` (dynamic names)
- `packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx` (hide Admin in entity contexts)

---

## ✅ COMPLETED: Roles UI Refinements (2025-01-14)

**Goal**: Fix 4 issues identified during QA testing of unified Roles UI.

### Issues Fixed:
1. **Card Footer Icons → Chips** - Replaced raw icons with Chip components (matching table view pattern)
2. **Menu Label Rename** - Changed "Доступ" (access) → "Суперпользователи" (superusers) in Instance menu
3. **Breadcrumbs Missing** - Added roles/role/users segments to NavbarBreadcrumbs for admin routes
4. **RoleUsers Demo Data → Real API** - Replaced DEMO_USERS with actual `getRoleUsers` API call

### Tasks:
- [x] Replace icons with Chips in RolesList.tsx footerStartContent (system/custom role + global access)
- [x] Change titleKey from `access` to `superusers` in menuConfigs.ts
- [x] Add i18n keys: `superusers`, `users`, `role` in menu.json (EN/RU)
- [x] Add roles route handling in NavbarBreadcrumbs.tsx with nested users sub-page
- [x] Refactor RoleUsers.tsx to use getRoleUsers API instead of DEMO_USERS
- [x] Remove unused Alert/AlertTitle imports and isDemo flag from RoleUsers.tsx
- [x] Remove unused AdminPanelSettingsRoundedIcon import from RolesList.tsx
- [x] Build validation (52/52 packages successful)
- [x] Lint validation (0 errors)

### Files Modified:
- `packages/admin-frontend/base/src/pages/RolesList.tsx` (Chips in card footer)
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx` (real API data)
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts` (titleKey: superusers)
- `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx` (roles handling)
- `packages/universo-i18n/base/src/locales/en/views/menu.json` (superusers, users, role keys)
- `packages/universo-i18n/base/src/locales/ru/views/menu.json` (superusers, users, role keys)

---

## ✅ COMPLETED: Roles UI Unification (2025-12-07)

**Goal**: Refactor RolesList.tsx to use unified list pattern (MetaverseList style) with card/table views, pagination, search, and BaseEntityMenu.

### Strategy
Copy-then-adapt approach: Used MetaverseList.tsx as reference, adapted imports/types for admin-frontend context.

### Tasks:
- [x] Create `RoleActions.tsx` using createEntityActions + custom viewUsers action
- [x] Add direct exports (listRoles, createRole, etc.) to `rolesApi.ts` for usePaginated compatibility
- [x] Verify `rolesQueryKeys.lists()` exists in queryKeys.ts
- [x] Create new `RolesList.tsx` with full unified pattern:
  - usePaginated hook with rolesApi.listRoles
  - useDebouncedSearch hook
  - Card/Table view toggle with localStorage persistence
  - BaseEntityMenu with roleActions (edit, viewUsers, delete)
  - EntityFormDialog for create
  - ConfirmDeleteDialog for delete
  - PaginationControls at bottom
  - SkeletonGrid/Skeleton loading states
  - EmptyListState for empty/error states
- [x] Add missing i18n keys (searchPlaceholder, confirmDelete, confirmDeleteDescription) EN/RU
- [x] Auto-fix Prettier formatting
- [x] Build validation (52/52 packages successful)
- [x] Lint validation (0 errors)
- [x] Remove backup file

### Files Created:
- `packages/admin-frontend/base/src/pages/RoleActions.tsx`

### Files Modified:
- `packages/admin-frontend/base/src/pages/RolesList.tsx` (replaced)
- `packages/admin-frontend/base/src/api/rolesApi.ts` (added exports)
- `packages/admin-frontend/base/src/i18n/en/admin.json`
- `packages/admin-frontend/base/src/i18n/ru/admin.json`

### New Features:
- Card view with color indicator, system/global access badges, permissions count
- Table view with FlowListTable and custom columns
- Search with debounce (300ms)
- Pagination (10, 20, 50, 100 rows per page)
- View preference saved to localStorage
- BaseEntityMenu with Edit, View Users, Delete actions
- System roles cannot be deleted (action filtered)
- Only superadmins can edit/delete roles

---

## ✅ COMPLETED: Admin Roles Menu Relocation (2025-12-07)

**Goal**: Move "Roles" (Роли) menu item from main admin menu to Instance context menu.

### Tasks:
- [x] Update `menuConfigs.ts` - remove `admin-roles` from `getAdminMenuItems()`
- [x] Update `menuConfigs.ts` - add `instance-roles` to `getInstanceMenuItems(instanceId)`
- [x] Update `MainRoutesMUI.tsx` - move `/admin/roles/*` routes inside `/admin/instance/:instanceId/`
- [x] Update `MainRoutesMUI.tsx` - change param from `:id` to `:roleId` to avoid conflict
- [x] Update `RolesList.tsx` - add `instanceId` param, update all navigation paths
- [x] Update `RoleEdit.tsx` - change `id` to `roleId`, add `instanceId`, update navigation
- [x] Update `RoleUsers.tsx` - change `id` to `roleId`, add `instanceId`, update navigation
- [x] Auto-fix prettier formatting issues
- [x] Remove unused `i18n` variable from RoleEdit.tsx
- [x] Build validation (3/3 packages successful)
- [x] Lint validation (0 errors)

### Files Modified:
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`
- `packages/admin-frontend/base/src/pages/RolesList.tsx`
- `packages/admin-frontend/base/src/pages/RoleEdit.tsx`
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx`

### New URL Structure:
- **Before**: `/admin/roles`, `/admin/roles/:id`, `/admin/roles/:id/users`
- **After**: `/admin/instance/:instanceId/roles`, `/admin/instance/:instanceId/roles/:roleId`, `/admin/instance/:instanceId/roles/:roleId/users`

---

## ✅ COMPLETED: Admin Roles UI - TypeScript Fixes (2025-12-07)

**Goal**: Fix TypeScript errors identified during QA analysis of Admin Roles Management UI.

### Issues Fixed:
1. **PermissionRule type mismatch** - Created `BasePermission` and `PermissionInput` types for CASL-compatible forms
2. **ViewHeaderMUI prop error** - `onAddNew`/`addNewLabel` props don't exist, use `children` instead
3. **DOM event types missing** - Added `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to tsconfig
4. **RoleUser map type error** - Created `ApiRoleUser` interface for snake_case API response

### Type Architecture:
- `BasePermission`: Core fields (module, action, conditions?, fields?) - CASL-compatible
- `PermissionRule`: Extends `BasePermission` with required `roleName` - for DB storage
- `PermissionInput`: Alias for `BasePermission` - for forms and API payloads

### Tasks:
- [x] Add `BasePermission`, `PermissionInput` types to `@universo/types/common/admin.ts`
- [x] Update `PermissionMatrix.tsx` to use `PermissionInput`
- [x] Fix `rolesApi.ts` types with `ApiRoleUser`, `ApiRoleUsersResponse`
- [x] Fix `ColorPicker.tsx` event handler type
- [x] Add DOM lib to `admin-frontend/tsconfig.json`
- [x] Fix `RoleEdit.tsx` - replace `PermissionRule` with `PermissionInput`
- [x] Fix `RolesList.tsx` - replace `onAddNew` prop with Button as children
- [x] Create `RoleUsers.tsx` demo page with sample data and info alert
- [x] Add `/admin/roles/:id/users` route to `MainRoutesMUI.tsx`
- [x] Full build validation (52/52 packages successful)

### Files Modified:
- `packages/universo-types/base/src/common/admin.ts`
- `packages/admin-frontend/base/src/components/PermissionMatrix.tsx`
- `packages/admin-frontend/base/src/api/rolesApi.ts`
- `packages/admin-frontend/base/src/components/ColorPicker.tsx`
- `packages/admin-frontend/base/tsconfig.json`
- `packages/admin-frontend/base/src/pages/RoleEdit.tsx`
- `packages/admin-frontend/base/src/pages/RolesList.tsx`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

### Files Created:
- `packages/admin-frontend/base/src/pages/RoleUsers.tsx`

---

## ✅ COMPLETED: Admin Roles Management UI (2025-12-07)

**Goal**: Create UI for managing RBAC roles and permissions with ABAC-ready architecture.

### Phase A: Backend API for Roles ✅
- [x] A.1: Add types to `@universo/types/common/admin.ts`
  - PermissionAction, PermissionModule types
  - RoleWithPermissions, CreateRolePayload, UpdateRolePayload interfaces
- [x] A.2: Create `rolesRoutes.ts` with CRUD endpoints
  - GET /admin/roles - list all roles
  - GET /admin/roles/:id - get role with permissions
  - POST /admin/roles - create role (superadmin only)
  - PATCH /admin/roles/:id - update role
  - DELETE /admin/roles/:id - delete role (non-system only)
- [x] A.3: Create Zod schemas in `schemas/index.ts`
- [x] A.4: Register routes in flowise-core-backend
- [x] A.5: Export from admin-backend index.ts

### Phase B: Frontend Components ✅
- [x] B.1: Create `rolesApi.ts` API client
- [x] B.2: Add query keys for roles
- [x] B.3: Create `ColorPicker.tsx` component
- [x] B.4: Create `PermissionMatrix.tsx` component
- [x] B.5: Create `RolesList.tsx` page
- [x] B.6: Create `RoleEdit.tsx` page

### Phase C: Integration ✅
- [x] C.1: Add routes to MainRoutesMUI.tsx
- [x] C.2: Add menu item for Roles
- [x] C.3: Add i18n translations (EN, RU)
- [x] C.4: Build and test

---

## ✅ COMPLETED: SettingsDialog UX Improvement (2025-12-07)

**Goal**: Fix misleading UX when `GLOBAL_ADMIN_ENABLED=false` - toggle appeared active but didn't work.

### Implementation:
- [x] Task 1: Add Alert warning when `globalAdminEnabled=false`
  - Imported `Alert` from MUI
  - Added info Alert explaining privileges are disabled by admin
- [x] Task 2: Disable Switch when privileges are off
  - Added `disabled={saving || !adminConfig.globalAdminEnabled}` to Switch
- [x] Task 3: Add visual indication (opacity) when disabled
  - Applied `opacity: 0.6` styling to disabled section
- [x] Task 4: Add i18n translations
  - EN: `settings.globalAdminDisabledWarning`
  - RU: `settings.globalAdminDisabledWarning`
- [x] Task 5: Update ENV documentation
  - Updated `.env.example` with combination matrix table
  - Updated `docker/.env.example` similarly
- [x] Task 6: QA analysis of implementation
  - Architecture ✅, Libraries ✅, Security ✅
  - Auth.jsx already has proper error handling for refreshAbility()
- [x] Task 7: Full build validation (52/52 packages successful)

---

## ✅ COMPLETED: Fix Admin Access Logic (2025-12-07)

**Goal**: Fix incorrect `hasGlobalAccess` logic and eliminate hook duplication.

**Problems identified**:
1. `hasGlobalAccess` returns false when `GLOBAL_ADMIN_ENABLED=false` (wrong - should reflect DB role)
2. Two hooks (`useGlobalRoleCheck` and `useHasGlobalAccess`) cause race conditions
3. Cache not synced after login → admin menu doesn't work until direct navigation

### Implementation Plan:
- [x] Task 1: Fix `permissionService.ts` - decouple `hasGlobalAccess` from `GLOBAL_ADMIN_ENABLED`
  - Removed `globalAdminEnabled` check from global roles collection
  - `hasGlobalAccess` now reflects DB role (globalRoles.length > 0)
- [x] Task 2: Remove `useGlobalRoleCheck`, use `useHasGlobalAccess` everywhere
  - Deleted `universo-template-mui/base/src/hooks/useGlobalRoleCheck.ts`
  - Removed exports from `hooks/index.ts` and main `index.ts`
- [x] Task 3: Update components to use `useHasGlobalAccess` from `@flowise/store`
  - MenuContent.tsx - replaced useGlobalRoleCheck with useHasGlobalAccess
  - SettingsDialog.tsx - replaced useGlobalRoleCheck with useHasGlobalAccess
  - ToolbarControls.tsx - replaced useGlobalRoleCheck with useHasGlobalAccess
- [x] Task 4: NavbarBreadcrumbs already uses `useHasGlobalAccess` (no change needed)
- [x] Task 5: Add `refreshAbility()` call after login in Auth.jsx
  - Added `useAbility` import from `@flowise/store`
  - Call `await refreshAbility()` after successful login
- [x] Task 6: Full build validation (52/52 packages successful)
- [ ] Task 7: Test scenarios (requires user testing)

---

## ✅ COMPLETED: Fix UI Flicker for Metaverse Routes (2025-12-07)

**Goal**: Prevent breadcrumbs and side menu from showing when accessing metaverse without permission.

**Problem**: When accessing `/metaverse/:id` as unauthorized user, breadcrumbs "Метавселенная" and side menu flash briefly before `MetaverseGuard` redirects.

### Solution:
- [x] Add resource access check to NavbarBreadcrumbs for metaverse routes
  - For `/metaverse/:id` and `/metaverses/:id/...` routes
  - Return empty breadcrumbs if `metaverseName` is null (loading or no access)
- [x] Fix MenuContent for metaverse context
  - Added `useMetaverseName` hook to verify resource access
  - Only show metaverse-specific menu if `metaverseName` is loaded
  - Falls back to root menu during loading/error
- [x] Full build validation (52/52 packages successful)

### Files Modified:
- `universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx`
  - Added access check before rendering metaverse breadcrumbs
- `universo-template-mui/base/src/components/dashboard/MenuContent.tsx`
  - Added `useMetaverseName` hook import
  - Conditional metaverse context menu rendering

---

## ✅ COMPLETED: Move Auth.jsx to auth-frontend Package (2025-12-08)

**Goal**: Migrate `Auth.jsx` from `flowise-core-frontend/base/src/views/up-auth/` to `@universo/auth-frontend` package with TypeScript refactoring.

### Architecture:
- **@universo/auth-frontend**: Compiled library package with generic `AuthPage` component
- **@flowise/template-mui**: Source-only package with `Auth.jsx` wrapper for app-specific integrations (i18n, CASL, MainCard)
- **Callback pattern**: `onLoginSuccess` prop for post-login side effects (e.g., CASL ability refresh)

### Implementation:
- [x] Task 1: Create `errorMapping.ts` in auth-frontend
  - `mapSupabaseError()` function mapping Supabase errors to i18n keys
- [x] Task 2: Create `AuthPage.tsx` generic component
  - Props for labels, callbacks (`onLoginSuccess`, `onLoginError`, `onRegisterSuccess`, `onRegisterError`)
  - Slots pattern for UI customization (Card component)
  - `errorMapper` prop for i18n error translation
- [x] Task 3: Update auth-frontend exports
  - Added exports in `src/index.ts`
  - Added entry in `tsdown.config.ts` for pages/AuthPage
  - Added subpath export in `package.json`
- [x] Task 4: Create wrapper `Auth.jsx` in flowise-template-mui/routes
  - Integrates i18n via `useTranslation('auth')`
  - CASL integration via `useAbility().refreshAbility`
  - MainCard slot for consistent styling
- [x] Task 5: Update MainRoutes.jsx import
  - Changed from `@/views/up-auth/Auth` to `./Auth`
- [x] Task 6: Delete legacy `up-auth/` folder
  - Removed entire `flowise-core-frontend/base/src/views/up-auth/` directory
- [x] Task 7: Build validation (52/52 packages successful)
- [x] Task 8: Fix i18n key issue
  - Removed `auth.` prefix from translation keys (namespace already set)
  - Added missing `email` key to EN/RU auth.json files

### Files Created:
- `packages/auth-frontend/base/src/utils/errorMapping.ts`
- `packages/auth-frontend/base/src/pages/AuthPage.tsx`
- `packages/flowise-template-mui/base/src/routes/Auth.jsx`

### Files Modified:
- `packages/auth-frontend/base/src/index.ts`
- `packages/auth-frontend/base/tsdown.config.ts`
- `packages/auth-frontend/base/package.json`
- `packages/flowise-template-mui/base/src/routes/MainRoutes.jsx`
- `packages/universo-i18n/base/src/locales/en/views/auth.json`
- `packages/universo-i18n/base/src/locales/ru/views/auth.json`

### Files Deleted:
- `packages/flowise-core-frontend/base/src/views/up-auth/` (entire folder)

---

## ✅ COMPLETED: Fix UI Flicker in Route Guards (2025-12-07)

**Goal**: Prevent breadcrumbs and layout from showing before guard redirects unauthorized users.

**Root Cause**: Layout (`MainLayoutMUI`) renders BEFORE guard check because guards are inside route children, not wrapping the layout itself. `NavbarBreadcrumbs` generates text like "Администрирование" immediately from URL path.

### Solution: Conditional rendering in NavbarBreadcrumbs
- [x] Add access check to NavbarBreadcrumbs for admin routes
  - Imported `useHasGlobalAccess` from `@flowise/store`
  - Returns empty breadcrumbs for admin routes if loading or no access
- [x] Verify MetaverseGuard is applied to metaverse routes (already done)
  - `/metaverses/:metaverseId/entities` - protected ✓
  - `/metaverses/:metaverseId/sections` - protected ✓
  - `/metaverse/:metaverseId/*` - protected ✓
- [x] Full build validation (52/52 packages successful)

### Files Modified:
- `universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx`
  - Added `useHasGlobalAccess` hook import
  - Added access check before rendering admin breadcrumbs
  - Returns empty array if loading or no access

---

## ✅ COMPLETED: Route Protection Guards Implementation (2025-12-06)

**Goal**: Create route protection system to redirect unauthorized users instead of showing pages with errors.

### Phase 1: AdminGuard
- [x] Create `AdminGuard.tsx` in `@universo/template-mui/components/routing/`
  - Checks authentication (→ /auth if not logged in)
  - Checks `canAccessAdminPanel` (→ / if no admin access)
- [x] Export from `routing/index.ts`
- [x] Apply to `/admin/*` routes in `MainRoutesMUI.tsx`
  - Wrapped entire admin block in `<AdminGuard>`
  - Removed redundant inner `<AuthGuard>` wrappers

### Phase 2: ResourceGuard (Universal)
- [x] Create `ResourceGuard.tsx` in `@universo/template-mui/components/routing/`
  - Checks authentication (→ /auth if not logged in)
  - Fetches resource via TanStack Query to verify access
  - Redirects on 403/404 errors (→ accessDeniedRedirectTo)
  - Caches data for child components (no duplicate API calls)
- [x] Export from `routing/index.ts` and main `index.ts`
- [x] Add `@flowise/store` and `@tanstack/react-query` dependencies

### Phase 3: MetaverseGuard (Specialized)
- [x] Create `MetaverseGuard.tsx` in `@universo/metaverses-frontend/components/`
  - Uses `ResourceGuard` with metaverse-specific config
  - Fetches via `getMetaverse()` API
  - Uses `metaversesQueryKeys.detail` for cache
- [x] Export from `components/index.ts` with package.json exports
- [x] Apply to `/metaverse/:metaverseId/*` routes in `MainRoutesMUI.tsx`

### Phase 4: Validation
- [x] Full build validation (52/52 packages successful)

### Files Created:
- `universo-template-mui/base/src/components/routing/AdminGuard.tsx`
- `universo-template-mui/base/src/components/routing/ResourceGuard.tsx`
- `metaverses-frontend/base/src/components/MetaverseGuard.tsx`
- `metaverses-frontend/base/src/components/index.ts`

### Files Modified:
- `universo-template-mui/base/src/components/routing/index.ts` - exports
- `universo-template-mui/base/src/components/index.ts` - exports
- `universo-template-mui/base/src/index.ts` - exports
- `universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - guard application
- `universo-template-mui/base/package.json` - dependencies
- `metaverses-frontend/base/package.json` - exports

---

## ✅ COMPLETED: Admin Feature Flags Implementation (2025-12-06)

**Goal**: Implement two independent ENV-based feature flags for admin functionality.

### Phase 1: Backend Configuration
- [x] Create `adminConfig.ts` in `@universo/utils/env/`
- [x] Export adminConfig from `env/index.ts`
- [x] Add `AdminConfig` interface to `@universo/types`

### Phase 2: Auth Backend Integration
- [x] Update `permissionService.ts` to include config in response
- [x] Ensure `hasGlobalAccess()` respects `GLOBAL_ADMIN_ENABLED`

### Phase 3: Admin Backend Integration
- [x] Update `ensureGlobalAccess.ts` guard to check `ADMIN_PANEL_ENABLED`
- [x] Update `hasGlobalAccessByDataSource()` to check `GLOBAL_ADMIN_ENABLED`

### Phase 4: Frontend Integration
- [x] Update `AbilityContextProvider.jsx` with adminConfig state
- [x] Update `useHasGlobalAccess.js` with `canAccessAdminPanel`
- [x] Simplify `useGlobalRoleCheck.ts` to use new hook

### Phase 5: Configuration & Validation
- [x] Update `.env.example` files with new ENV variables
- [x] Full build validation (52/52 packages successful)

---

## ✅ COMPLETED: InstanceList UI Polish (2025-12-06)

**Goal**: Fix UI polishing issues in Instances management after second QA review.

### Completed Tasks:
- [x] Show disabled "Удалить" button in edit dialog (was hidden)
  - Added `deleteButtonDisabled` prop to `EntityFormDialog`
  - Added `deleteButtonDisabledInEdit` config option to `createEntityActions`
- [x] Fix Alert width to match other elements (was narrower)
  - Applied `mx: { xs: -1.5, md: -2 }` negative margin pattern
- [x] Remove section description "Управление экземплярами платформы"
  - Removed `description` prop from ViewHeader
- [x] Remove duplicate "Локальный" text on Access page
  - Removed Typography with getDisplayName from InstanceAccess.tsx
  - Removed unused getDisplayName function
- [x] Full build validation (52/52 packages successful)

### Files Modified:
- `universo-template-mui/base/src/components/dialogs/EntityFormDialog.tsx` - deleteButtonDisabled prop
- `universo-template-mui/base/src/factories/createEntityActions.tsx` - deleteButtonDisabledInEdit config
- `admin-frontend/base/src/pages/InstanceActions.tsx` - showDeleteInEdit: true, deleteButtonDisabledInEdit: true
- `admin-frontend/base/src/pages/InstanceList.tsx` - Alert width fix, description removal
- `admin-frontend/base/src/pages/InstanceAccess.tsx` - duplicate text removal

---

## ✅ COMPLETED: InstanceList UI Improvements (2025-12-06)

**Goal**: Fix UI issues in Instances management after QA review.

### Completed Tasks:
- [x] Move MVP notice Alert above pagination (was below)
- [x] Add disabled "Удалить" item in context menu (visible but not clickable)
- [x] Add `table.status`, `table.domains`, `table.resources` to common.json (EN/RU)
- [x] Fix editTitle in dialog (was showing key instead of translation)
- [x] Set `showDeleteInEdit: false` to hide delete button in edit dialog
- [x] Add `footerStartContent` prop to ItemCard for icon display
- [x] Add `i18nKeys` override in InstanceActions.tsx for proper translation paths
- [x] Add `confirmDelete`, `confirmDeleteDescription` keys to admin.json
- [x] Full build validation (52/52 packages successful)

### Files Modified:
- `admin-frontend/base/src/pages/InstanceList.tsx` - alert position, type fixes
- `admin-frontend/base/src/pages/InstanceActions.tsx` - i18n keys, showDeleteInEdit
- `admin-frontend/base/src/i18n/*/admin.json` - confirmDelete keys
- `universo-i18n/base/src/locales/*/core/common.json` - table.status/domains/resources
- `universo-template-mui/base/src/components/cards/ItemCard.tsx` - footerStartContent prop

---

## ✅ COMPLETED: InstanceList Standard UI Refactoring (2025-12-05)

**Goal**: Refactor `InstanceList.tsx` to use standard card/table view like `ClusterList.tsx`.

### Completed Tasks:
- [x] Create `InstanceActions.tsx` using `createEntityActions` pattern
- [x] Update `instancesApi.ts` with direct export functions for `usePaginated`
- [x] Update `instanceMutations.ts` to match clusters pattern
- [x] Update `instancesQueryKeys.ts` to add `lists()` for cache invalidation
- [x] Rewrite `InstanceList.tsx` with:
  - [x] Card/Table view toggle
  - [x] `ItemCard` and `FlowListTable` components
  - [x] `BaseEntityMenu` with edit action
  - [x] `ToolbarControls` with disabled "Add" button
  - [x] `PaginationControls`
  - [x] MVP notice alert
- [x] Update i18n translations (EN/RU) with new keys
- [x] Full build validation (52/52 packages successful)

---

## ✅ COMPLETED: Admin Instances Module (2025-12-05)

**Goal**: Create "Экземпляры (Instances)" management following Clusters module pattern.

**MVP Scope**:
- Single pre-seeded "Local" instance representing current installation
- Context menu inside instance (Board, Access)
- Simplify left menu: single "Администрирование" item instead of section
- Create/Delete buttons disabled (future: remote instances)

### Phase 0: Migration Rename
- [x] Rename `1733400000000-CreateAdminRBAC.ts` → `1733400000000-CreateAdminSchema.ts`

### Phase 1: Backend Entity & Migration
- [x] Create `Instance.ts` entity in `admin-backend/base/src/database/entities/`
- [x] Add instances table to migration
- [x] Add RLS policies for instances
- [x] Seed "Local" instance
- [x] Export entity from admin-backend index.ts
- [x] Register in flowise-core-backend entities

### Phase 2: Backend Routes
- [x] Create `instancesRoutes.ts` with CRUD endpoints
- [x] Create Zod validation schemas
- [x] Wire routes in flowise-core-backend

### Phase 3: Frontend API & Types
- [x] Add `Instance` type to types.ts
- [x] Create `instancesApi.ts` with CRUD functions
- [x] Create `instancesQueryKeys.ts`
- [x] Create `useInstanceDetails.ts` hook
- [x] Create mutation hooks

### Phase 4: Frontend Pages
- [x] Create `InstanceList.tsx` page
- [x] Rename `AdminBoard.tsx` → `InstanceBoard.tsx` with useParams
- [x] Rename `AdminAccess.tsx` → `InstanceAccess.tsx` with useParams
- [x] Update pages index.ts exports

### Phase 5: Navigation Updates
- [x] Update `universo-template-mui` routes for `/admin/instance/:id/*`
- [x] Update `MenuContent.tsx` for simplified admin menu + context menu
- [x] Update `NavbarBreadcrumbs.tsx` for instance routes

### Phase 6: i18n Updates
- [x] Add admin namespace translations (EN/RU)
- [x] Add menu namespace translations (EN/RU)

### Phase 7: Build & Test
- [x] Full build validation (52/52 packages successful)
- [x] Update memory-bank documentation

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

**Last Updated**: 2025-12-07
