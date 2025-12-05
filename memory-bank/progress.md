# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.39.0-alpha | 2025-11-26 | Mighty Campaign 🧙🏿 | Campaigns module, package extractions (7 packages), QA fixes |
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring, Uniks metrics update, UnikBoard expansion, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frontend architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Metaverses dashboard, Universal List Pattern |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Language switcher, MMOOMM template, Finance module |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Multiplayer Colyseus server |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder MVP, Metaverse module, @universo/types |

---

## January 2025

### 2025-01-06: Admin Instances UI Polish (QA Round 2) ✅

**Goal**: Fix UI polishing issues in Instances management after second QA review.

**Issues Fixed**:

1. **Delete button in edit dialog**: Was hidden, now shows as disabled
   - Added `deleteButtonDisabled` prop to `EntityFormDialog` component
   - Added `deleteButtonDisabledInEdit` config option to `createEntityActions` factory
   - Pattern: button visible but non-functional for future features

2. **Alert width mismatch**: MVP notice was narrower than other elements
   - Applied `mx: { xs: -1.5, md: -2 }` negative margin pattern
   - Consistent with other full-width elements in ViewHeader

3. **Section description removed**: "Управление экземплярами платформы" was redundant
   - Removed `description` prop from ViewHeader for consistency with Clusters/Metaverses

4. **Duplicate "Локальный" text on Access page**: Instance name appeared twice
   - Removed Typography with getDisplayName from InstanceAccess.tsx header
   - Removed unused getDisplayName function

**Files Modified**:
- `universo-template-mui/.../EntityFormDialog.tsx` - deleteButtonDisabled prop
- `universo-template-mui/.../createEntityActions.tsx` - deleteButtonDisabledInEdit config
- `admin-frontend/.../InstanceActions.tsx` - enabled disabled delete button
- `admin-frontend/.../InstanceList.tsx` - Alert width fix, description removal
- `admin-frontend/.../InstanceAccess.tsx` - duplicate text removal

**Build Status**: 52/52 packages successful ✅

---

### 2025-01-06: Admin Instances Module ✅

**Goal**: Create "Экземпляры (Instances)" management for Admin module following Clusters pattern.

**MVP Scope**:
- Single pre-seeded "Local" instance (UUID `00000000-0000-0000-0000-000000000000`)
- Simplified left menu: single "Администрирование" item
- Context menu inside instance (Board, Access)
- Create/Delete buttons disabled (future: remote instances)

**Key Changes**:

1. **Backend Entity & Migration**:
   - Created `Instance.ts` TypeORM entity in `admin-backend`
   - Added `instances` table to migration with RLS policies
   - Pre-seeded "Local" instance with `is_local = true`
   - Renamed migration: `CreateAdminRBAC` → `CreateAdminSchema`

2. **Backend Routes**:
   - Created `instancesRoutes.ts` with endpoints: GET `/`, GET `/:id`, GET `/stats`, PATCH `/:id`
   - Uses `ensureGlobalAccess` guard for authorization
   - Wired routes in `flowise-core-backend`

3. **Frontend API & Hooks**:
   - Created `instancesApi.ts`, `instancesQueryKeys`, `useInstanceDetails.ts`, `instanceMutations.ts`
   - Added `Instance`, `InstanceStats`, `InstanceUpdateData` types

4. **Frontend Pages**:
   - Created `InstanceList.tsx` - Grid of instance cards with Local chip
   - Created `InstanceBoard.tsx` - Dashboard inside instance with stats
   - Created `InstanceAccess.tsx` - Global users management within instance context

5. **Navigation**:
   - Routes: `/admin` → InstanceList, `/admin/instance/:id` → Board, `/admin/instance/:id/access` → Access
   - Updated `MenuContent.tsx` to show instance context menu when inside instance
   - Updated `NavbarBreadcrumbs.tsx` for instance route handling
   - Updated `menuConfigs.ts` with `getInstanceMenuItems()`

6. **i18n**:
   - Added translations in `admin.json` (EN/RU)
   - Added translations in `menu.json` (EN/RU): `instance`, `instanceboard`, `board`

**Files Created**:
- `packages/admin-backend/base/src/database/entities/Instance.ts`
- `packages/admin-backend/base/src/routes/instancesRoutes.ts`
- `packages/admin-frontend/base/src/api/instancesApi.ts`
- `packages/admin-frontend/base/src/hooks/useInstanceDetails.ts`
- `packages/admin-frontend/base/src/hooks/instanceMutations.ts`
- `packages/admin-frontend/base/src/pages/InstanceList.tsx`
- `packages/admin-frontend/base/src/pages/InstanceBoard.tsx`
- `packages/admin-frontend/base/src/pages/InstanceAccess.tsx`

**Build Status**: 52/52 packages successful ✅

---

### 2025-01-05: Frontend Metaverse-Scoped API Fix ✅

**Problem**: Superadmin could see metaverse list but sections/entities were empty when viewing other users' metaverses with "show all items" enabled.

**Root Cause**: 
- `EntityList.tsx` and `SectionList.tsx` used global `/entities` and `/sections` APIs
- These APIs apply RLS without metaverse context, so admin bypass couldn't work
- Components didn't use `metaverseId` from URL params

**Solution**:
- Modified `EntityList.tsx` to conditionally use `metaversesApi.listMetaverseEntities()` when `metaverseId` is present in URL
- Modified `SectionList.tsx` to conditionally use `metaversesApi.listMetaverseSections()` when `metaverseId` is present
- Updated query keys to use `metaversesQueryKeys.entitiesList()` / `sectionsList()` for metaverse-scoped queries
- Updated cache invalidation to handle both metaverse-scoped and global caches

**Files Changed**:
- `packages/metaverses-frontend/base/src/api/metaverses.ts` - Added `listMetaverseEntities()`, `listMetaverseSections()` 
- `packages/metaverses-frontend/base/src/api/queryKeys.ts` - Added `entitiesList()`, `sectionsList()` query keys
- `packages/metaverses-frontend/base/src/pages/EntityList.tsx` - Use metaverse-scoped API when in metaverse context
- `packages/metaverses-frontend/base/src/pages/SectionList.tsx` - Use metaverse-scoped API when in metaverse context

---

### 2025-01-05: Fix Global Admin RLS Bypass ✅

**Problem**: Superadmin could see metaverses of other users but NOT sections/entities inside them.

**Root Cause**: 
- `admin.has_global_access()` function used `SECURITY INVOKER` 
- When called from metaverses RLS policies, it ran with user's RLS context
- RLS on `admin.user_roles` table called `has_global_access()` → circular dependency
- Function couldn't read data and always returned `false`

**Solution**:
- Changed `has_global_access()` and `has_permission()` to `SECURITY DEFINER` (bypasses RLS)
- Added `users_read_own_roles` SELECT policy for users to read their own role assignments
- Added `authenticated_read_roles` SELECT policy for all authenticated users
- Simplified admin management policies to use the SECURITY DEFINER function

**Files Changed**:
- `packages/admin-backend/base/src/database/migrations/postgres/1733400000000-CreateAdminRBAC.ts`

---

### 2025-01-05: Metaverses Migration Consolidation ✅

**Goal**: Consolidate metaverses-backend migrations into a single clean migration file.

**Problem**: 
- Multiple migration files with timestamp order issues
- Garbage SQL file `1733312400000-AddGlobalAdminRLSBypass.sql` that TypeORM doesn't auto-load
- RLS policies added in separate migration required admin schema to exist first

**Solution Implemented**:
- Deleted garbage SQL file `1733312400000-AddGlobalAdminRLSBypass.sql`
- Created consolidated `1733600000000-CreateMetaversesSchema.ts` with:
  - Schema and 7 tables creation
  - FK constraints with CASCADE delete
  - Performance indexes
  - RLS policies with `admin.has_global_access()` bypass from the start
  - Full-text search indexes
- Timestamp `1733600000000` ensures migration runs AFTER admin schema (`1733400000000`)
- Deleted old files: `1730600000000-AddMetaversesSectionsEntities.ts`, `1733500000000-AddGlobalAdminRLSBypass.ts`
- Updated `index.ts` to export only the new migration
- Build verified: 52/52 packages

---

## December 2025

### 2025-12-05: Admin Packages QA Fixes ✅

**Goal**: Fix issues identified during QA analysis of admin-backend and admin-frontend packages.

**Issues Fixed**:

1. **Debug console.log statements** - Removed 4 debug logs from `ensureGlobalAccess.ts`
2. **React duplication** - Removed `"react": "catalog:"` from admin-frontend dependencies (kept in peerDependencies only)
3. **Partial TypeORM refactoring** - Converted simple CRUD methods to TypeORM Repository pattern while keeping SQL functions for RLS

**TypeORM Refactoring Details** (`globalAccessService.ts`):
- Added imports for `Role` and `UserRole` entities
- Updated `toRoleMetadata()` to accept `Role | RoleRow`
- Refactored to TypeORM: `getAllRoles()`, `getGlobalAccessRoles()`, `getRoleByName()`, `revokeAssignment()`
- Kept as SQL: `hasGlobalAccess()`, `getGlobalAccessInfo()`, `listGlobalUsers()`, `grantRole()`, `updateAssignment()`, `revokeGlobalAccess()`, `getStats()`

**Architecture Decision**: SQL functions must remain for RLS consistency:
- `admin.has_global_access()` used in RLS policies across 6+ modules
- Single source of truth for permission logic
- Called via `hasGlobalAccessByDataSource()` throughout codebase

**Documentation Created**:
- `packages/admin-backend/base/README.md` (EN)
- `packages/admin-backend/base/README-RU.md` (RU)
- `packages/admin-frontend/base/README.md` (EN)
- `packages/admin-frontend/base/README-RU.md` (RU)

**Files Changed**:
- `packages/admin-backend/base/src/guards/ensureGlobalAccess.ts` - removed debug logs
- `packages/admin-backend/base/src/services/globalAccessService.ts` - partial TypeORM refactoring
- `packages/admin-frontend/base/package.json` - fixed react duplication

**Build**: Full workspace build successful (52/52 packages)

---

### 2025-12-06: Dynamic Global Roles Refactoring ✅

**Goal**: Replace hardcoded `'superadmin' | 'supermoderator'` with dynamic database-driven roles.

**Problem**: The original design used a separate `admin.global_users` table with hardcoded role strings. This prevented adding new roles or customizing role appearance without code changes.

**Solution Implemented**:

1. **Database Changes** (`admin-backend`):
   - New migration `1733500000000-AddRoleMetadata.ts`
   - Added columns to `admin.roles`: `display_name` (JSONB), `color` (VARCHAR), `has_global_access` (BOOLEAN)
   - Created PostgreSQL functions: `admin.has_global_access(uuid)`, `admin.get_user_global_roles(uuid)`
   - Old `admin.global_users` table marked for deprecation

2. **Backend Services**:
   - New `globalAccessService.ts` replaces `globalUserService.ts`
   - All guards updated to use `hasGlobalAccessByDataSource()` instead of `getGlobalRoleByDataSource()`
   - `globalUsersRoutes.ts` now uses `globalAccessService`
   - `/api/v1/auth/permissions` expanded with `globalRoles` and `rolesMetadata`
   - `/api/v1/admin/global-users/me` now returns `roleMetadata`

3. **Frontend Updates**:
   - `AbilityContextProvider.jsx` provides `globalRoles`, `rolesMetadata`, `hasGlobalAccess`
   - `RoleChip.tsx` accepts optional `roleMetadata` prop for dynamic colors
   - `admin-frontend` types and hooks updated for new API
   - New hooks: `useHasGlobalAccess()`, `useGlobalRoleMetadata()`

4. **Deprecation Strategy**:
   - Old `GlobalUser.ts` entity marked `@deprecated`
   - Old `globalUserService.ts` marked `@deprecated`
   - Files retained for backward compatibility during transition

**Files Created**:
- `packages/admin-backend/base/src/database/migrations/postgres/1733500000000-AddRoleMetadata.ts`
- `packages/admin-backend/base/src/services/globalAccessService.ts`
- `packages/flowise-store/base/src/context/useHasGlobalAccess.js`

**Files Modified**:
- 7 backend guards (metaverses, clusters, organizations, storages, campaigns, projects, uniks)
- 3 routes (sectionsRoutes, entitiesRoutes, metaversesRoutes)
- `@universo/types` - new types: `LocalizedString`, `RoleMetadata`, `GlobalRoleInfo`, `GlobalUserMember`
- `flowise-store` - AbilityContextProvider, index.ts exports
- `universo-template-mui` - RoleChip.tsx
- `admin-frontend` - types.ts, adminApi.ts, useGlobalRole.ts, AdminAccess.tsx
- `admin-backend` - globalUsersRoutes.ts, ensureGlobalAccess.ts, index.ts
- `flowise-core-backend` - routes/index.ts

---

### 2025-12-06: Admin RBAC Migration Consolidation & TypeORM Entities ✅

**Context**: Database recreation on test project caused migration errors (`cannot change return type of existing function`). Decision: consolidate all admin-backend migrations into one and implement proper TypeORM entities.

**Changes Made**:

1. **Migration Consolidation**:
   - Created single consolidated migration `1733400000000-CreateAdminRBAC.ts`
   - Deleted 6 old migration files:
     - `1733250000000-CreateGlobalUsers.ts`
     - `1733311200000-AddGlobalUserComment.ts`
     - `1733400000000-CreateRBACSystem.ts`
     - `1733400000000-CreateRBACSystem.sql`
     - `1733500000000-AddRoleMetadata.ts`
     - `SEED_AFTER_RECREATION.sql`

2. **TypeORM Entities Created** (`admin-backend/base/src/database/entities/`):
   - `Role.ts` - entity for `admin.roles` table with `display_name` (JSONB), `color`, `has_global_access`, `is_system`
   - `RolePermission.ts` - entity for `admin.role_permissions` with `@ManyToOne` to Role
   - `UserRole.ts` - entity for `admin.user_roles` with `@ManyToOne` to Role (no relation to auth.users)
   - `entities/index.ts` - exports `adminEntities` array

3. **Legacy Code Removal**:
   - Deleted deprecated `GlobalUser.ts` entity
   - Deleted deprecated `globalUserService.ts` service
   - Cleaned `ensureGlobalAccess.ts` to only export modern functions

4. **Environment Variable**:
   - Replaced `SUPER_USERS_MODE` with `GLOBAL_ADMIN_ENABLED` in `.env` and `.env.example`
   - New function `isGlobalAdminEnabled()` added to `ensureGlobalAccess.ts`

5. **Entity Registration**:
   - `admin-backend/src/index.ts` now exports `adminEntities`, `Role`, `RolePermission`, `UserRole`
   - `flowise-core-backend/database/entities/index.ts` imports and spreads `adminEntitiesObject`

**Build Status**: 52/52 packages built successfully

---

### 2025-12-04: User Settings System Implemented ✅

**Goal**: Allow superadmin to toggle between "show only my items" vs "show all items" in lists.

**Problem**: After fixing global admin visibility, superadmin ALWAYS saw all metaverses/sections/entities from ALL users - not ideal for daily work.

**Solution Implemented**:

1. **Backend Settings API** (`profile-backend`):
   - Added `settings` JSONB column to Profile entity/migration
   - Created `UserSettingsData` type with `admin.showAllItems` setting
   - Added `GET /profile/settings` and `PUT /profile/settings` endpoints
   - Deep merge for partial updates

2. **Frontend Components** (`universo-template-mui`):
   - `useUserSettings.ts` hook - loads/updates settings with in-memory cache
   - `SettingsDialog.tsx` - modal with "Show all items" toggle
   - Extended `ToolbarControls` with `settingsEnabled` prop
   - i18n translations (en/ru) for settings namespace

3. **Backend Route Updates** (`metaverses-backend`):
   - `metaversesRoutes.ts` - `showAll` query parameter support
   - `sectionsRoutes.ts` - `showAll` query parameter support
   - `entitiesRoutes.ts` - `showAll` query parameter support
   - Logic: `showAll=true` → LEFT JOIN (see all), `showAll=false` → INNER JOIN (membership filter)

4. **Frontend Integration** (`metaverses-frontend`):
   - `MetaverseList.tsx` now uses `useUserSettings` hook
   - Settings button appears in toolbar (only for superadmin/supermoderator)
   - Query key includes `showAll` for proper cache invalidation

**Build Status**: 52/52 packages built successfully

**Files Created/Modified**:
- `profile-backend/base/src/services/profileService.ts` - getUserSettings, updateUserSettings
- `profile-backend/base/src/controllers/profileController.ts` - getSettings, updateSettings
- `profile-backend/base/src/routes/profileRoutes.ts` - settings endpoints
- `universo-template-mui/base/src/hooks/useUserSettings.ts` - settings hook
- `universo-template-mui/base/src/components/dialogs/SettingsDialog.tsx` - settings dialog
- `universo-template-mui/base/src/components/toolbar/ToolbarControls.tsx` - settingsEnabled prop
- `universo-template-mui/base/locales/{en,ru}/settings.json` - translations

---

## June 2025

### 2025-06-14: RBAC + CASL Integration - Phase 1-3 Complete ✅

**Goal**: Implement flexible RBAC with wildcard support and CASL for frontend/backend permission checks.

**Why CASL?**: After researching RBAC vs ABAC approaches:
- RBAC (Role-Based): Roles like "admin", "editor" with fixed permissions
- ABAC (Attribute-Based): Permissions based on dynamic attributes (time, location, ownership)
- **Chosen**: Hybrid approach - RBAC for role management + ABAC-ready conditions in permissions

**Library Selection**:
- **CASL** (6.7k stars) - Chosen for React isomorphism, TypeScript support, MongoDB-like conditions
- Casbin (2.8k stars) - Policy files, more complex
- AccessControl - Abandoned since 2018

**Architecture Created**:

1. **Database Layer** (PostgreSQL):
   - `admin.roles` - Role definitions (superadmin, admin, moderator, etc.)
   - `admin.role_permissions` - Module/action permissions with wildcard support (`*`)
   - `admin.user_roles` - User to role assignments
   - `admin.has_permission(module, action, context)` - Check permission (RLS-aware)
   - `admin.get_user_permissions(user_id)` - Get all permissions for CASL

2. **Backend CASL** (`auth-backend`):
   - `permissionService.ts` - Loads DB permissions, builds CASL ability
   - `abilityMiddleware.ts` - Express middleware, attaches `req.ability`
   - `/api/v1/auth/permissions` - Endpoint for frontend to get permissions

3. **Frontend CASL** (`flowise-store`):
   - `AbilityContext.jsx` - React context for ability
   - `AbilityContextProvider.jsx` - Loads permissions, builds ability
   - `useAbility.js` - Hook for imperative checks
   - `Can.jsx` / `Cannot` - Declarative permission components

4. **Types** (`@universo/types`):
   - `Actions` = 'create' | 'read' | 'update' | 'delete' | 'manage'
   - `Subjects` = 'Metaverse' | 'Cluster' | 'Project' | ... | 'all'
   - `AppAbility` - MongoAbility type for the app
   - `defineAbilitiesFor(userId, permissions)` - CASL ability builder

**Wildcard Support**:
- `module='*'` matches ALL modules
- `action='*'` matches ALL actions (maps to CASL 'manage')
- Superadmin has `module='*', action='*'` = full access

**Files Created**:
- `packages/admin-backend/base/src/database/migrations/postgres/1733400000000-CreateRBACSystem.ts`
- `packages/universo-types/base/src/abilities/index.ts`
- `packages/auth-backend/base/src/services/permissionService.ts`
- `packages/auth-backend/base/src/middlewares/abilityMiddleware.ts`
- `packages/flowise-store/base/src/context/AbilityContext.jsx`
- `packages/flowise-store/base/src/context/AbilityContextProvider.jsx`
- `packages/flowise-store/base/src/context/useAbility.js`
- `packages/flowise-store/base/src/context/Can.jsx`

**Build Status**: ✅ 52/52 packages successful

**Pending**:
- Run RBAC migration on database
- Integrate AbilityContextProvider in App.jsx
- Test with real permissions

---

### 2025-06-13: Superadmin Cross-Entity Access ✅

**Issue**: Superadmin could not access Metaverses, Projects, Clusters where they are not a member.
Error logs showed: `[SECURITY] Permission denied... reason: 'not_member'`

**Root Cause**: `createAccessGuards.ts` in auth-backend only checked membership, not global roles.
Note: Uniks appeared to work because GET /:id had no access check (design inconsistency).

**Solution**: Extended `createAccessGuards` factory pattern with global role bypass:

1. **New Types in auth-backend** (`types.ts`):
   - `GlobalRole = 'superadmin' | 'supermoderator' | null`
   - Added `getGlobalRole?: (ds, userId) => Promise<GlobalRole>` to config
   - Added `createGlobalAdminMembership?: (userId, entityId, globalRole) => TMembership` to config

2. **Updated `createAccessGuards.ts`**:
   - In `ensureAccess()`, checks global role BEFORE membership
   - If superadmin/supermoderator, creates synthetic membership with owner-level permissions
   - Logs `[ACCESS] Global admin access granted` for audit trail

3. **New Standalone Function in admin-backend**:
   - `getGlobalRoleByDataSource(ds, userId)` - allows other modules to check global role

4. **Updated All Entity Guards** (7 modules):
   - metaverses-backend, clusters-backend, projects-backend
   - storages-backend, organizations-backend, campaigns-backend, uniks-backend
   - All now pass `getGlobalRole` and `createGlobalAdminMembership` to factory

**Affected Packages**:
- auth-backend (core factory)
- admin-backend (new standalone function)
- metaverses-backend, clusters-backend, projects-backend
- storages-backend, organizations-backend, campaigns-backend, uniks-backend

**Build**: 52/52 tasks passed

---

### 2025-06-13: RLS Global Admin Bypass Migration ⏳

**Issue**: After fixing application-level access, superadmin still cannot see created sections.
Data appears in database but RLS policies filter it out.

**Root Cause**: RLS policies on metaverses schema check `metaverses_users` membership.
Superadmin not in this table → RLS blocks SELECT even though application allows access.

**Solution**: Created migration to add `admin.is_global_admin()` check to all RLS policies.

**Created Files**:
- `packages/metaverses-backend/base/src/database/migrations/postgres/1733312400000-AddGlobalAdminRLSBypass.ts`
- `packages/metaverses-backend/base/src/database/migrations/postgres/1733312400000-AddGlobalAdminRLSBypass.sql`

**Updated RLS Policies** (7 tables):
- metaverses, sections, entities, entities_sections
- sections_metaverses, entities_metaverses, metaverses_users

**Pattern Added** (example):
```sql
CREATE OR REPLACE FUNCTION admin.is_global_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin.global_users
    WHERE user_id = auth.uid()
    AND role IN ('superadmin', 'supermoderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policy now: (existing_condition) OR admin.is_global_admin()
```

**Status**: Awaiting manual DB migration. See tasks.md

---

### 2025-06-13: Admin Module Refactoring ✅

**Summary**: Refactored admin-frontend and admin-backend to follow unified patterns from clusters module.

**Menu Changes**:
- Replaced single "Администрирование" menu item with section header + 2 items:
  - **Админборд** (`/admin`) - Dashboard with global statistics
  - **Доступ** (`/admin/access`) - Member management with email-based invite

**Backend Changes**:
- `POST /admin/global-users` now accepts `{ email, role }` instead of `{ user_id, role }`
- Added `listAllWithDetails()` - JOINs with AuthUser + Profile for email/nickname display
- Added pagination support (page, limit, search query params)
- Error codes: 404 (user not found by email), 409 (already has role)

**Frontend Changes**:
- Created `AdminBoard.tsx` - Dashboard page (based on ClusterBoard pattern)
- Created `AdminAccess.tsx` - Member management page (based on ClusterMembers pattern)
- Created `MemberActions.tsx` - Factory pattern for edit/remove actions
- Created `types.ts` - GlobalUserMember extends BaseMemberEntity
- Updated `adminApi.ts` - pagination support, grantRoleByEmail, extractPaginationMeta
- Updated i18n files with complete new structure

**Routes Updates**:
- `MainRoutesMUI.tsx` - Nested routes with `<Outlet />` for `/admin` parent
- `menuConfigs.ts` - `getAdminMenuItems()` function replaces single `adminMenuItem`
- `MenuContent.tsx` - Typography section header + item list for admin section

**i18n Updates**:
- Added `adminboard` key to `universo-i18n` menu.json (en/ru)
- Complete rewrite of `admin-frontend` i18n files (en/ru/admin.json)

**Build**: Full `pnpm build` passed (52 tasks successful)

### 2025-06-13: Admin Edit/Delete Bug Fixes ✅

**Issue**: Edit dialog showed empty role list; delete action didn't work.

**Root Causes**:
1. `createMemberActions.tsx` used `AssignableRole` type (admin|editor|member), but admin module needs global roles (superadmin|supermoderator)
2. `roleLabels` were not passed to edit dialog, only default labels for entity roles
3. Delete action called `ctx.api.deleteEntity(ctx.entity.id)` but global users API expects `userId`

**Fixes Applied**:
1. **Type fix** (`createMemberActions.tsx`): Changed `availableRoles` type from `AssignableRole` to `MemberRole`
2. **ID extraction** (`createMemberActions.tsx`): Added `getMemberId` config option to extract correct ID for API calls
3. **Role labels** (`createMemberActions.tsx`): Added `roleLabels` and `roleLabelsKey` config options
4. **Admin config** (`MemberActions.tsx`): Added `getMemberId: (member) => member.userId` and fixed `entityType` (was `resourceType`)

**Files Modified**:
- `packages/universo-template-mui/base/src/factories/createMemberActions.tsx`
- `packages/admin-frontend/base/src/pages/MemberActions.tsx`

**Build**: Full `pnpm build` passed (52 tasks successful)

### 2025-12-04: Admin Comment Field Support ✅

**Issue**: Global users don't have comment field support (unlike clusters).

**Changes**:

**Backend** (`admin-backend`):
- Added `comment` column to `GlobalUser` entity
- Created migration `AddGlobalUserComment1733311200000`
- Updated `GrantRoleSchema` and added `UpdateGlobalUserSchema` with comment support
- Updated `GlobalUserDetails` interface to include comment
- Updated `grantRole()` and added `updateGlobalUser()` service methods
- Updated POST and PATCH routes to handle comment

**Frontend** (`admin-frontend`):
- Added `comment` to `GlobalUserMember` interface
- Updated `GrantRolePayload` and `UpdateRolePayload` with comment
- Added Comment column to table view
- Updated cards to show comment in description (`[nickname, comment].filter(Boolean).join('\n')`)
- Updated `MemberActions.tsx` to use actual `member.comment`
- Updated `handleInviteMember` and `createMemberContext` to pass comment

**Build**: Full `pnpm build` passed (52 tasks successful)

---

## December 2025

### 2025-12-03: Admin Packages (Superadmin/Supermoderator) ✅

**Summary**: Created `admin-frontend` and `admin-backend` packages for global user management.

**New Packages**:
| Package | Path | Description |
|---------|------|-------------|
| `@universo/admin-backend` | `packages/admin-backend/base/` | TypeORM entities, Express routes, guards for global user management |
| `@universo/admin-frontend` | `packages/admin-frontend/base/` | React pages, TanStack Query hooks, i18n for admin UI |

**Key Features**:
- **Global Roles**: `superadmin` (full CRUD) and `supermoderator` (read-only)
- **ENV Control**: `SUPER_USERS_MODE` = `superadmin` | `supermoderator` | `disabled`
- **Database**: `admin.global_users` table in separate schema with RLS policies
- **API Endpoints**: `/api/v1/admin/global-users` (GET list, GET /me, POST grant, DELETE revoke)
- **Menu Integration**: "Администрирование" divider visible only for super users

**Architecture Decisions**:
- Created local `apiClient` in admin-frontend to avoid cyclic dependency with template-mui
- Created `useGlobalRoleCheck` hook in template-mui for menu visibility (direct fetch, no package dependency)
- Used `PageCard` component instead of importing `MainCard` from template-mui

**Files Modified**:
- `flowise-core-backend/base/src/database/entities/index.ts` - added adminEntities
- `flowise-core-backend/base/src/database/migrations/postgres/index.ts` - added Phase 7 adminMigrations
- `flowise-core-backend/base/src/routes/index.ts` - added admin routes
- `universo-template-mui/base/src/navigation/menuConfigs.ts` - added adminMenuItem
- `universo-template-mui/base/src/components/dashboard/MenuContent.tsx` - added admin divider/menu
- `universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - added /admin route
- `universo-types/base/src/common/admin.ts` - created GlobalRole, SuperUsersMode types
- `.env.example` - documented SUPER_USERS_MODE

**SQL for Initial Superadmin**:
```sql
INSERT INTO admin.global_users (user_id, role, granted_by)
SELECT id, 'superadmin', id
FROM auth.users
WHERE email = '580-39-39@mail.ru';
```

Build: 52/52 successful (6m5s)

---

## January 2025

### 2025-01-22: Flowise Core Packages Naming Refactoring ✅

**Summary**: Major restructuring of core Flowise packages.

**Package Renames**:
| Old Path | New Path | New Name |
|----------|----------|----------|
| `packages/flowise-ui/` | `packages/flowise-core-frontend/base/` | `@flowise/core-frontend` |
| `packages/flowise-server/` | `packages/flowise-core-backend/base/` | `@flowise/core-backend` |
| `packages/flowise-components/` | `packages/flowise-components/base/` | (unchanged) |
| `packages/universo-api-client/` | `packages/universo-api-client/base/` | (unchanged) |

**Key Changes**:
- Updated `getNodeModulesPackagePath()` in backend
- Fixed ~50 tsconfig.json files with `types: ["node"]`
- Fixed vite.config.js path aliases

Build: 50/50 successful (4m26s)

---

### 2025-01-20: Spaces Backend Improvements ✅

**Zod Validation Schemas**:
- Created `spaces-backend/src/schemas/index.ts` (~220 lines)
- Controller reduced ~30% (750→515 lines)
- Schemas: CreateSpaceSchema, UpdateSpaceSchema, CreateCanvasSchema, etc.
- Helpers: `extractUnikId()`, `formatZodError()`, `validateBody()`

**System Status Fields**:
- Spaces: 9 new columns (versioning + status)
- Canvases: 4 new columns (status only)
- Partial indexes for performance
- RLS policies updated

**Canvas Versions API**:
- `api.canvasVersions` added to @universo/api-client
- Methods: list, create, update, activate, remove

**Migration Consolidation**:
- 7 chat_flow migrations merged into spaces-backend
- ChatflowType → CanvasType renamed

Build: 50/50 successful

---

### 2025-01-19: CustomTemplates Package Extraction ✅

**Packages Created**:
- `@flowise/customtemplates-backend`: entity, migration, DI service
- `@flowise/customtemplates-frontend`: Templates pages, i18n

**API Client**: MarketplacesApi with full CRUD

**Naming Migration**: Marketplaces → Templates complete

**QA Cleanup**:
- Deleted VectorStore duplicates from template-mui
- Updated imports in spaces-frontend
- Deleted flowise-ui/views/marketplaces/

Build: 50/50 successful

---

## December 2025

### 2025-12-01-02: DocumentStore Full Migration ✅

**Backend (@flowise/docstore-backend)**:
- 3 entities, 4 DI services, consolidated migration
- Clean Integration pattern for CRUD delegation

**Frontend (@flowise/docstore-frontend)**:
- 20 JSX files, merged i18n

**Fixes**:
- 403 error on Preview & Process
- i18n interpolation format

Build: 48/48 successful

---

## November 2025

### 2025-11-29: ChatMessage Full Migration ✅

**Summary**: Completed full migration to @universo/flowise-chatmessage-backend.

**Changes**:
- Utility wrappers for buildCanvasFlow compatibility
- Deleted 10 legacy migrations
- All services/controllers/routes deleted from flowise-server

Build: 38/38 successful

---

### 2025-11-29: Leads Package Extraction ✅

**Packages**: @universo/flowise-leads-backend, @universo/flowise-leads-frontend (minimal)

**Bug Fixes**: ChatMessage.jsx and Analytics.jsx leadsApi undefined

Build: 46/46 successful

---

### 2025-11-28-29: Assistants Package Extraction ✅

**Backend**: @universo/flowise-assistants-backend with DI pattern
- Consolidated migration, optional dependencies config
- Fixed cyclic dependency via peerDependency

**Frontend**: @universo/flowise-assistants-frontend
- 8 JSX pages, i18n, side-effect imports

**API Refactoring**: Modern method names, unikId-first pattern

Build: 45/45 successful

---

### 2025-11-28: ApiKey Package Extraction ✅

**Backend**: @universo/flowise-apikey-backend
- Dual storage mode (JSON + DB)
- UUID for IDs, Zod validation

**Frontend**: @universo/flowise-apikey-frontend
- 3 pages, i18n

Build: 44/44 successful

---

### 2025-11-28: Variables Package Extraction ✅

**Packages**: @universo/flowise-variables-backend, @universo/flowise-variables-frontend

Build: 43/43 successful

---

### 2025-11-27: Credentials Package Extraction ✅

**Backend**: @universo/flowise-credentials-backend
- Encryption via DI callbacks

**Frontend**: @universo/flowise-credentials-frontend

Build: 42/42 successful

---

### 2025-11-27: Tools Package Extraction ✅

**Backend**: @universo/flowise-tools-backend
- DI service with telemetry
- Migration order: Init → Tools → Credentials

**Frontend**: @universo/flowise-tools-frontend

Build: 41/41 successful

---

### 2025-11-25-27: QA Fixes ✅

**useApi → useMutation**: 7 packages, ~2000 lines mutations.ts created

**Bot Review Fixes**: PR #560, #564, #566

**AR.js**: Fixed quizState error in Node Connections mode

**useApi Shim**: Fixed flowise-template-mui hooks exports

Build: 40/40+ successful

---

### 2025-11-22-24: Documentation & i18n ✅

**Documentation**:
- Configuration docs: 22 files synced EN→RU
- Integrations docs: 249 files synced
- Applications docs: README rewritten, 4 new module pages

**i18n**:
- Members keys centralized in common.json
- Module-specific table keys decentralized
- Storages architecture fixed

---

### 2025-11-17-18: Projects Integration ✅

- 23 issues fixed
- Router registered, all pages loading
- Terminology: "Milestones" (RU) unified throughout UI

---

### 2025-11-13-14: Uniks & Code Quality ✅

**Uniks Refactoring**:
- UnikBoard: 3→7 metric cards
- Backend: spacesCount/toolsCount metrics

**Code Quality**:
- `createAccessGuards` factory in auth-backend
- Cluster breadcrumbs with useClusterName hook
- M2M logic fix in ensureSectionAccess

---

## October 2025 (Summary)

- **0.35.0-alpha** (2025-10-30): Rate limiting with Redis, i18n TypeScript migration
- **0.34.0-alpha** (2025-10-23): Global monorepo refactoring, tsdown build system
- **0.33.0-alpha** (2025-10-16): Publication System 429 fixes, Quiz timer
- **0.32.0-alpha** (2025-10-09): Canvas versioning, Chatflow→Canvas terminology
- **0.31.0-alpha** (2025-10-02): Manual quiz editing, Material-UI template system

---

## September 2025 (Summary)

- **0.30.0-alpha** (2025-09-21): TypeScript path aliases, Analytics hierarchical selectors
- **0.29.0-alpha** (2025-09-15): Cluster isolation architecture, Copilot modes
- **0.28.0-alpha** (2025-09-07): Metaverses dashboard, Universal List Pattern

---

## August 2025 (Summary)

- **0.27.0-alpha** (2025-08-31): Language switcher, MMOOMM template
- **0.26.0-alpha** (2025-08-24): Multiplayer Colyseus server
- **0.25.0-alpha** (2025-08-17): Space Builder MVP, @universo/types

---

## July 2025 and Earlier (Archive)

For detailed historical entries, see Git history:
- 0.24.0-alpha: Space Builder, UPDL nodes, AR.js wallpaper mode
- 0.23.0-alpha: Russian docs translation, UPDL conditional params
- 0.22.0-alpha: Memory Bank rules, MMOOMM laser mining
- 0.21.0-alpha: Handler refactoring, PlayCanvas stabilization
- 0.20.0-alpha: UPDL node refactoring, Template-First architecture
- Pre-alpha (0.10-0.19): Flowise integration, Supabase auth, UPDL basics

---

**Last Updated**: 2025-12-03

**Note**: For current work → tasks.md. For patterns → systemPatterns.md.

---

## Detailed Entry Archive (Last 3 Months)

### 2025-11-06-12: i18n Systematic Fixes ✅

**Phase 1-5 Completion**:
- Singleton binding pattern established
- Colon syntax standardized across all packages
- Namespace registration via side-effect imports
- Fixed double namespace bug: `t('canvas:key')` with `useTranslation('canvas')`
- 30 packages built successfully

**Key Fixes**:
- react-i18next pinned to 15.5.3 for i18next 23.x compatibility
- registerNamespace pattern for lazy-loaded routes
- Feature packages own their translations (docstore, tools, credentials)

---

### 2025-11-04-05: Metaverse Module Stabilization ✅

**Dashboard Improvements**:
- 3 stat cards + 2 charts
- Universal List Pattern applied across all entity lists
- TanStack Query with proper key factories

**Performance**:
- N+1 query optimization in member lists
- React StrictMode production fix (conditional wrapper)
- COUNT(*) OVER() for efficient pagination

---

### Architecture Decisions Log

**DI Factory Pattern** (November 2025):
- All new packages use `createXxxService(config)` factory pattern
- Config includes: dataSource, optional providers, callbacks
- Enables testing without full app context
- Applied to: Tools, Credentials, Variables, ApiKey, Assistants, ChatMessage, Leads, DocStore

**Package Extraction Strategy**:
1. Create backend package with entity, migration, DI service
2. Create frontend package with pages, i18n
3. Update flowise-server imports
4. Delete legacy files
5. Build and verify

**Migration Consolidation**:
- Each package has single consolidated migration
- Idempotent with IF NOT EXISTS clauses
- No destructive down() migrations in production

---

### Package Count Evolution

| Date | Package Count | Notes |
|------|---------------|-------|
| 2025-12-03 | 50 | After core package renaming |
| 2025-12-01 | 48 | After DocumentStore extraction |
| 2025-11-29 | 46 | After Leads extraction |
| 2025-11-28 | 44-45 | After Assistants/ApiKey extraction |
| 2025-11-27 | 41-43 | After Tools/Credentials/Variables |
| 2025-11-22 | 40 | Before package extraction sprint |

---

### Key Technical Decisions

**TypeORM Repository Pattern**:
- All DB access via `getDataSource().getRepository(Entity)`
- User context for RLS policies
- No direct SQL queries in service code

**TanStack Query v5**:
- Query key factories for cache invalidation
- useQuery for declarative data fetching
- useMutation for state changes (replaced custom useApi)

**i18n Architecture**:
- Core namespaces in @universo/i18n
- Feature packages ship own translations
- registerNamespace for runtime registration

---

### Build System Notes

**pnpm Workspace**:
- Run commands from root only
- `pnpm --filter <package> build` for single package
- `pnpm build` for full workspace (required for cross-deps)

**tsdown Build**:
- Dual output: CJS + ESM
- Path aliases: `@/*` → `src/*`
- Type declarations generated

---

### Known Issues & Workarounds

**Template MUI CommonJS Shims** (DEFERRED):
- flowise-ui ESM/CJS conflict
- Workaround: Direct imports from source packages
- Future: Extract to @universo package with dual build

**useApi Context Loss**:
- Class methods lose `this` when passed to hooks
- Solution: Wrap in arrow functions `(...args) => api.method(...args)`

**React StrictMode**:
- Causes double-mount in React 18
- Solution: Conditional wrapper (dev only)

---
