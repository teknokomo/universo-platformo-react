# Active Context

> **Last Updated**: 2025-01-17
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Recently Completed: Dynamic Role Dropdown for Global Users (2025-01-17) ✅

### Goal
Replace hardcoded role dropdown `['superadmin', 'supermoderator']` with dynamic roles from database.

### Problem
User created role "Метаредактор" with `hasGlobalAccess: true`, but it didn't appear in role dropdown when assigning global users.

### Solution Architecture
1. **Backend**: `GET /api/v1/admin/roles/assignable` → roles with `has_global_access: true`
2. **Types**: `GlobalAssignableRole` interface (id, name, displayName, color)
3. **Hook**: `useAssignableGlobalRoles` with React Query caching (5 min staleTime)
4. **Factory**: `createMemberActions` supports `ctx.meta.dynamicRoles` for runtime injection
5. **Cache**: Role CRUD invalidates `rolesQueryKeys.assignable()`

### Key Changes
| Component | Change |
|-----------|--------|
| `rolesRoutes.ts` | New `/assignable` endpoint |
| `useAssignableGlobalRoles.ts` | New hook with `roleOptions`, `roleLabels` |
| `AdminAccess.tsx` | Uses hook for create dialog + passes to context |
| `InstanceAccess.tsx` | Same pattern |
| `MemberActions.tsx` | Removed hardcoded roles |
| `createMemberActions.tsx` | `ctx.meta.dynamicRoles/dynamicRoleLabels` support |

### Build Status
52/52 packages successful

---

## Previously Completed: RBAC Refactoring - Database-driven Permissions (2025-01-17) ✅

### Goal
Replace hardcoded `roleName !== 'superadmin'` check with database-driven CRUD permissions using existing CASL/permissionService infrastructure.

### Root Cause
403 Forbidden when PATCH `/api/v1/admin/roles/:id` was caused by:
```typescript
// OLD: Hardcoded check in ensureGlobalAccess.ts
if (permission === 'manage' && roleName !== 'superadmin') {
    throw createError(403, 'Access denied: superadmin role required')
}
```

### Solution Applied
```typescript
// NEW: Database-driven permission check
const hasPermission = await permissionService.hasPermission(userId, module, action)
if (!hasPermission) {
    throw createError(403, `Access denied: requires ${module}:${action} permission`)
}
```

### Key Changes
1. **CASL Subjects**: Added 'Role' | 'Instance' to universo-types and flowise-store
2. **ensureGlobalAccess signature**: `(module, action)` instead of `('view'|'manage')`
3. **Route patterns**: `ensureGlobalAccess('roles', 'update')` instead of `ensureGlobalAccess('manage')`
4. **Dependency injection**: Routes now receive `permissionService` in config

### Files Modified
- `packages/universo-types/base/src/abilities/index.ts`
- `packages/flowise-store/base/src/context/AbilityContextProvider.jsx`
- `packages/admin-backend/base/src/guards/ensureGlobalAccess.ts`
- `packages/admin-backend/base/src/routes/{rolesRoutes,instancesRoutes,globalUsersRoutes}.ts`
- `packages/flowise-core-backend/base/src/routes/index.ts`

### Impact
- supermoderator with `roles:update` permission can now edit role displayName/description/color
- Future roles can have granular CRUD permissions per module
- All permission decisions from database (PostgreSQL `admin.has_permission()` function)

---

## Previously Completed: RoleUsers usePaginated Pattern Alignment (2025-01-17) ✅

### Goal
Align RoleUsers component with MetaverseList/InstanceList patterns - proper server-side pagination with `usePaginated` hook.

### Issues Fixed (QA Findings)
1. **Client-side Pagination**: Replaced with server-side `usePaginated<RoleUser, 'email' | 'assigned_at'>`
2. **`toLocaleDateString()`**: Replaced with `formatDate(date, 'short')` from `@universo/utils`
3. **Missing PageSize selector**: `rowsPerPageOptions={[10, 20, 50, 100]}` (was `[20]`)
4. **Search delay**: Changed from `delay: 300` to `delay: 0` for instant search
5. **Count text position**: Removed redundant count block below pagination

### Backend Pattern (rolesRoutes.ts)
```typescript
// Zod schema for query validation
const RoleUsersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().optional(),
    sortBy: z.enum(['email', 'assigned_at']).default('assigned_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Search via EXISTS subquery (avoids cross-schema joins)
if (search) {
    qb.andWhere(`EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id AND LOWER(u.email) LIKE :search)`)
}

// Single efficient query
const [userRoles, total] = await qb.getManyAndCount()

// Pagination headers
res.setHeader('X-Pagination-Limit', limit.toString())
res.setHeader('X-Total-Count', total.toString())
```

### Frontend Pattern (RoleUsers.tsx)
```typescript
// usePaginated hook (matches InstanceList)
const paginationResult = usePaginated<RoleUser, 'email' | 'assigned_at'>({
    queryKeyFn: (params) => rolesQueryKeys.usersList(roleId || '', params),
    queryFn: (params) => getRoleUsers(roleId || '', params),
    initialLimit: 20,
    sortBy: 'assigned_at',
    sortOrder: 'desc',
    enabled: Boolean(roleId)
})

// Instant search
const { handleSearchChange } = useDebouncedSearch({
    onSearchChange: paginationResult.actions.setSearch,
    delay: 0
})

// PaginationControls with full options
<PaginationControls
    pagination={paginationResult.pagination}
    actions={paginationResult.actions}
    isLoading={paginationResult.isLoading}
    rowsPerPageOptions={[10, 20, 50, 100]}
    namespace='common'
/>
```

### queryKeys Pattern (normalized params)
```typescript
usersList: (id: string, params?: PaginationParams) => {
    const normalized = {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        sortBy: params?.sortBy ?? 'assigned_at',
        sortOrder: params?.sortOrder ?? 'desc',
        search: params?.search?.trim() || undefined
    }
    return [...rolesQueryKeys.users(id), 'list', normalized] as const
}
```

### Build Status
52/52 packages successful ✅

---

## Recently Completed: RoleUsers Page Redesign (2025-01-15) ✅

### Goal
Complete redesign of RoleUsers page with standard UI pattern and fix breadcrumbs instance name display.

### Issues Fixed
1. **Breadcrumbs Instance Name**: Fixed useInstanceName hook - was not parsing `{ success: true, data: instance }` response structure correctly (same fix as useRoleName)
2. **RoleUsers Complete UI Redesign**: Replaced basic table (~200 lines) with full standard UI (~350 lines) matching RolesList pattern
3. **Dynamic User Status**: Backend now calculates real user status from auth.users table using CASE expression

### Key Changes
- **useInstanceName.ts**: Added `const data = response?.data || response` before accessing name (same as useRoleName fix)
- **rolesRoutes.ts**: Added status calculation SQL:
  ```sql
  CASE 
      WHEN u.banned_until IS NOT NULL AND u.banned_until > NOW() THEN 'banned'
      WHEN u.confirmed_at IS NULL THEN 'pending'
      WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'active'
      ELSE 'inactive'
  END as status
  ```
- **RoleUsers.tsx**: Complete rewrite with:
  - Card/List view toggle (localStorage persisted)
  - ViewHeader with search
  - usePaginated hook for pagination
  - StatusChip component with color-coded status
  - ItemCard for card view (avatar, name, email, status)
  - FlowListTable for list view
  - Full i18n integration

### New i18n Keys Added
- `roles.users.title`, `description`, `searchPlaceholder`
- `roles.users.empty.title`, `empty.description`
- `roles.users.table.user`, `email`, `assignedAt`, `status`
- `roles.users.status.active`, `inactive`, `pending`, `banned`
- `roles.users.count`, `loading`, `anonymous`

### Build Status
52/52 packages successful

---

## Recently Completed: Roles UI Final Polish (2025-01-14) ✅

### Goal
Final visual and backend fixes for unified Roles UI.

### Issues Fixed
1. **Small Color Dot**: Added 12px color dot before role name in card view (matching table view style)
2. **Button Text**: Changed "Добавить роль" → "Добавить" using common i18n key `tc('addNew')`
3. **Breadcrumbs Dynamic Name**: Fixed useRoleName hook to properly parse API response (handles data wrapper and snake_case field names)
4. **Backend 500 Error**: Fixed SQL query in rolesRoutes.ts - used `created_at AS assigned_at` and `granted_by AS assigned_by` (actual column names from UserRole entity)

### Key Changes
- **ItemCard.tsx**: New `colorDotSize` prop (default 35px); small dots get 1px border for visibility
- **RolesList.tsx**: Cards now show 12px color dot + use common "Добавить" button text
- **useRoleName.ts**: Fixed to extract data from `{ success: true, data: role }` structure and check both `displayName`/`display_name` variants
- **rolesRoutes.ts**: Fixed `/:id/users` endpoint SQL query column names

### Build Status
52/52 packages successful

---

## Previously Completed: Roles UI Additional Refinements (2025-12-07) ✅

### Goal
Fix 4 additional issues after previous Roles UI refinements.

### Issues Fixed
1. **Chips Position**: Code was already correct (footerStartContent in ItemCard); user needed browser refresh
2. **Breadcrumbs Role Name**: Created `useRoleName` hook to show actual role name (e.g., "Суперадминистратор") instead of static "Роль"
3. **Breadcrumbs Instance Name**: Created `useInstanceName` hook to show actual instance name (e.g., "local") instead of static "Экземпляр"
4. **Admin Menu Hidden in Entity Contexts**: Fixed MenuContent.tsx to hide "Администрирование" menu when inside any entity context (metaverse, cluster, project, organization, storage, campaign, unik)

### New Files Created
- `useInstanceName.ts` - Hook with API fetch + cache for instance names
- `useRoleName.ts` - Hook with API fetch + cache for role names (handles displayName localization)

### Key Changes
- NavbarBreadcrumbs now shows dynamic names for instance and role (with truncation)
- Admin menu visibility condition extended: `!instanceId && !metaverseId && !clusterId && !projectId && ...`

### Build Status
52/52 packages successful

---

## Previously Completed: Roles UI Refinements (2025-01-14) ✅

### Goal
Fix 4 issues identified during QA testing after Roles UI unification.### Build Status
52/52 packages successful, 0 lint errors

---

## Previously Completed: Roles UI Unification (2025-12-07) ✅

### Goal
Refactor RolesList.tsx to use unified list pattern (MetaverseList style) with card/table views, pagination, search, and BaseEntityMenu.

### Strategy
Copy-then-adapt approach: Used MetaverseList.tsx as canonical reference, adapted for admin-frontend roles context.

### Key Implementation
- **RoleActions.tsx**: Created using `createEntityActions` + custom `viewUsers` action
- **RolesList.tsx**: Full unified pattern with:
  - `usePaginated` hook for pagination/sorting/search
  - `useDebouncedSearch` for search input
  - Card/Table view toggle with localStorage persistence
  - `BaseEntityMenu` with roleActions (edit, viewUsers, delete)
  - `EntityFormDialog` for create, `ConfirmDeleteDialog` for delete
  - `PaginationControls` at bottom
  - Skeleton/Empty states

### New Features
- Card view: Color indicator, system/global access badges, permissions count
- Table view: FlowListTable with custom columns
- Permission filtering: Only superadmins can edit/delete, system roles protected
- View preference saved to localStorage

### Build Status
52/52 packages successful, 0 lint errors

---

## Previously Completed: Admin Roles Menu Relocation (2025-12-07) ✅

### Goal
Move "Roles" (Роли) menu item from main admin menu to Instance context menu.

### Problem
The Roles menu item was incorrectly placed in the main admin menu (`/admin/roles`).
It should be accessible from within Instance context (`/admin/instance/:instanceId/roles`).

### Solution
1. **menuConfigs.ts**: Removed `admin-roles` from `getAdminMenuItems()`, added `instance-roles` to `getInstanceMenuItems(instanceId)`
2. **MainRoutesMUI.tsx**: Moved roles routes inside `/admin/instance/:instanceId/` children, changed param from `:id` to `:roleId`
3. **RolesList.tsx, RoleEdit.tsx, RoleUsers.tsx**: Updated to use `instanceId` from params in all navigation

### New URL Structure
- **Before**: `/admin/roles`, `/admin/roles/:id`, `/admin/roles/:id/users`
- **After**: `/admin/instance/:instanceId/roles`, `/admin/instance/:instanceId/roles/:roleId`, `/admin/instance/:instanceId/roles/:roleId/users`

### Build Status
3/3 packages successful, 0 lint errors

---

## Previously Completed: Admin Roles UI - TypeScript Fixes (2025-12-07) ✅

### Goal
Fix TypeScript errors identified during QA analysis of Admin Roles Management UI.

### Type Architecture
- `BasePermission`: Core fields (module, action, conditions?, fields?) - CASL-compatible
- `PermissionRule`: Extends `BasePermission` with required `roleName` - for DB storage
- `PermissionInput`: Alias for `BasePermission` - for forms and API payloads

### Key Fixes
1. **PermissionRule type mismatch** - Forms don't have `roleName`, created separate input type
2. **ViewHeaderMUI prop error** - Used `children` prop instead of non-existent `onAddNew`
3. **DOM event types** - Added `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to tsconfig
4. **RoleUsers demo page** - Created placeholder with sample data and info alert
5. **RoleUsers.tsx displayName fix** - Changed `role.displayNameRu`/`role.displayNameEn` to `role.displayName?.ru`/`role.displayName?.en`

### Build Status
52/52 packages successful

---

## Previously Completed: Admin Roles Management UI (2025-12-08) ✅

### Goal
Create UI for managing RBAC roles and permissions with ABAC-ready architecture.

### Implementation
- **Backend**: `rolesRoutes.ts` with CRUD endpoints, Zod validation, system role protection
- **Frontend**: `RolesList.tsx`, `RoleEdit.tsx`, `PermissionMatrix.tsx`, `ColorPicker.tsx`
- **Integration**: Routes in MainRoutesMUI.tsx (/admin/roles), menu item, i18n EN/RU

### Key Components
- `PermissionMatrix` - matrix for modules × actions with bulk selection
- `ColorPicker` - simple color picker with preset colors and native input
- `rolesApi.ts` - API client with snake_case→camelCase transformation

### Routes
- `/admin/roles` - list all roles
- `/admin/roles/new` - create new role
- `/admin/roles/:id` - edit existing role

### API Endpoints
- GET /api/v1/admin/roles
- GET /api/v1/admin/roles/:id
- POST /api/v1/admin/roles
- PATCH /api/v1/admin/roles/:id
- DELETE /api/v1/admin/roles/:id
- GET /api/v1/admin/roles/:id/users

### Build Status
52/52 packages successful

---

## Recently Completed: Auth.jsx Migration to auth-frontend Package (2025-12-08) ✅

### Problem
Auth component was in `flowise-core-frontend/base/src/views/up-auth/Auth.jsx` - tightly coupled to application, mixing generic auth logic with app-specific integrations.

### Solution - Layered Architecture
1. **Generic Component** (`@universo/auth-frontend`): `AuthPage.tsx` with props for labels, callbacks, slots
2. **Application Wrapper** (`@flowise/template-mui`): `Auth.jsx` integrating i18n, CASL, MainCard

### Key Pattern: Callback for Cross-Package Communication
```tsx
// flowise-template-mui/routes/Auth.jsx
import { AuthPage } from '@universo/auth-frontend'
import { useAbility } from '@flowise/store'

const Auth = () => {
    const { refreshAbility } = useAbility()
    const { t } = useTranslation('auth')
    
    // Note: keys WITHOUT namespace prefix when using useTranslation('auth')
    const labels = { welcomeBack: t('welcomeBack'), ... }
    
    return <AuthPage labels={labels} onLoginSuccess={refreshAbility} />
}
```

### i18n Key Pattern (Important!)
When using `useTranslation('auth')`, the namespace is already set. Keys should be:
- ✅ `t('welcomeBack')` 
- ❌ `t('auth.welcomeBack')` 

This is because JSON structure `{ "auth": { "key": "value" } }` is unwrapped in i18n init.

### Files Changed
- Created: `auth-frontend/base/src/utils/errorMapping.ts`
- Created: `auth-frontend/base/src/pages/AuthPage.tsx`
- Created: `flowise-template-mui/base/src/routes/Auth.jsx`
- Modified: `auth-frontend/base/src/index.ts`, `tsdown.config.ts`, `package.json`
- Modified: `flowise-template-mui/base/src/routes/MainRoutes.jsx`
- Modified: `universo-i18n/base/src/locales/{en,ru}/views/auth.json` (added `email` key)
- Deleted: `flowise-core-frontend/base/src/views/up-auth/` folder

### Build Status
52/52 packages successful

---

## Recently Completed: SettingsDialog UX Improvement (2025-12-07) ✅

### Problem
When `GLOBAL_ADMIN_ENABLED=false`, the "Show other users' items" toggle in SettingsDialog appeared active but didn't work — misleading UX that confused users.

### Solution
1. **Alert Warning**: Added info Alert explaining privileges are disabled by admin
2. **Disabled Switch**: Toggle is now disabled when `globalAdminEnabled=false`
3. **Visual Indication**: Added opacity 0.6 when section is disabled
4. **i18n**: Added `globalAdminDisabledWarning` translations (EN/RU)
5. **ENV Documentation**: Updated `.env.example` with combination matrix table

### Code Pattern
```tsx
// SettingsDialog.tsx
const { adminConfig } = useHasGlobalAccess()

{!adminConfig.globalAdminEnabled && (
    <Alert severity="info">
        {t('settings.globalAdminDisabledWarning')}
    </Alert>
)}

<Switch
    checked={showOthersItems}
    onChange={handleToggle}
    disabled={saving || !adminConfig.globalAdminEnabled}
/>
```

### QA Analysis Results
- Architecture: ✅ Correct separation of concerns
- Libraries: ✅ Using standard stack (TanStack Query, CASL, MUI)
- Security: ✅ No unsafe patterns
- MetaverseGuard placement: ✅ Correctly in `metaverses-frontend` as domain-specific
- Auth.jsx error handling: ✅ Already has try/catch for refreshAbility()

### Build Status
52/52 packages successful

---

## Previously Completed: Fix UI Flicker for Metaverse Routes (2025-12-07) ✅

### Problem
When navigating to `/admin` without admin access, breadcrumbs ("Администрирование", "Администрирование > Экземпляр") appeared briefly before `AdminGuard` redirected to home. This was:
1. A UX issue (visual flicker)
2. A minor security concern (revealed protected route structure)

### Root Cause
Route architecture caused layout to render before guard:
```
MainLayoutMUI (renders Header with breadcrumbs) → Outlet → AdminGuard (check here, too late)
```

`NavbarBreadcrumbs` generated text from URL path **synchronously**, without waiting for access check.

### Solution
Added access check directly in `NavbarBreadcrumbs.tsx`:
- Imported `useHasGlobalAccess` from `@flowise/store`
- For admin routes: returns empty breadcrumbs if loading or no access
- Breadcrumbs only appear after access is confirmed

### Code Change
```tsx
// NavbarBreadcrumbs.tsx
const { canAccessAdminPanel, loading: adminAccessLoading } = useHasGlobalAccess()

// In crumbs calculation for admin routes:
if (primary === 'admin') {
    if (adminAccessLoading || !canAccessAdminPanel) {
        return []  // No breadcrumbs while checking or if no access
    }
    // ... rest of admin breadcrumbs logic
}
```

### Build Status
52/52 packages successful

---

## Previously Completed: Route Protection Guards (2025-12-06) ✅

### Summary
Implemented route protection system with `AdminGuard` and `ResourceGuard` to redirect unauthorized users to home instead of showing pages with errors.

### Problem Solved
Previously, when accessing protected routes without permission:
1. Admin pages rendered UI with API errors (instead of redirecting)
2. Resource pages (e.g., `/metaverse/:id`) showed "no access" message but revealed resource existence
3. This was a security concern (information disclosure)

### Solution: Guard Components

#### AdminGuard
- Checks authentication AND `canAccessAdminPanel`
- If not authenticated → redirect to `/auth`
- If no admin access → redirect to `/`
- Applied to all `/admin/*` routes

#### ResourceGuard
- Universal guard for resource-based routes
- Uses TanStack Query to prefetch resource
- On 403/404 → redirect to home
- Caches data for child components (no duplicate API calls)

#### MetaverseGuard
- Specialized wrapper around `ResourceGuard` for metaverse routes
- Uses `getMetaverse()` and `metaversesQueryKeys.detail`
- Applied to `/metaverse/:metaverseId/*` routes

### Usage Pattern
```tsx
// AdminGuard - protects entire admin section
<Route path="admin" element={<AdminGuard><Outlet /></AdminGuard>}>
  <Route index element={<InstanceList />} />
  ...
</Route>

// MetaverseGuard - protects metaverse detail routes
<Route path="metaverse/:metaverseId" element={<MetaverseGuard><Outlet /></MetaverseGuard>}>
  <Route index element={<MetaverseBoard />} />
  ...
</Route>
```

### Build Status
✅ Full build successful (52/52 packages)

---

## Previously Completed: Admin Instances UI Polish (2025-01-06) ✅

### Summary
Fixed UI polishing issues in Instances management after second QA review.

### Issues Fixed
1. **Delete button in edit dialog**: Was hidden, now shows as disabled
   - Added `deleteButtonDisabled` prop to `EntityFormDialog`
   - Added `deleteButtonDisabledInEdit` config to `createEntityActions` factory
   
2. **Alert width mismatch**: MVP notice was narrower than other elements
   - Applied `mx: { xs: -1.5, md: -2 }` negative margin pattern

3. **Section description removed**: "Управление экземплярами платформы" was redundant

4. **Duplicate "Локальный" on Access page**: Instance name appeared twice

### New Pattern: Disabled Delete Button in Edit Dialog
When delete functionality should be visible but non-functional (e.g., for future features):
```tsx
createEntityActions({
  showDeleteInEdit: true,
  deleteButtonDisabledInEdit: true, // Shows disabled button
  // ...
})
```

### Build Status
✅ Full build successful (52/52 packages)

---

## Previously Completed: Admin Instances Module (2025-01-06) ✅

### Summary
Created "Экземпляры (Instances)" management for Admin module following the Clusters module pattern.

### MVP Implementation
- **Local Instance**: Single pre-seeded instance (UUID auto-generated by PostgreSQL)
- **Navigation**: Simplified left menu with single "Администрирование" item
- **Context Menu**: Board and Access pages inside instance context
- **Future**: Create/Delete buttons disabled (for remote instances)

### Routes Structure
- `/admin` → `InstanceList` (grid of instance cards)
- `/admin/instance/:id` → `InstanceBoard` (dashboard with stats)
- `/admin/instance/:id/access` → `InstanceAccess` (global users management)

---

## Previously Completed: Metaverse Admin Access Fix (2025-01-05) ✅

### Problem
Superadmin could see metaverses of other users in the list (with "show all items" enabled), but when entering a metaverse, sections and entities were empty.

### Root Cause Analysis
1. **Initial hypothesis**: RLS `admin.has_global_access()` function issue - PARTIALLY CORRECT
   - Fixed by changing to `SECURITY DEFINER`
   
2. **Real root cause**: Frontend architecture issue
   - `EntityList.tsx` and `SectionList.tsx` used global APIs (`/entities`, `/sections`)
   - These APIs don't pass metaverse context, so RLS admin bypass couldn't work
   - Components didn't extract `metaverseId` from URL params

### Solution Applied
1. **RLS Functions**: Changed to `SECURITY DEFINER` (already done)
2. **Frontend APIs**: Added `listMetaverseEntities()` and `listMetaverseSections()` paginated functions
3. **Query Keys**: Added metaverse-scoped query keys
4. **Components**: Modified EntityList and SectionList to:
   - Use `useParams()` to extract `metaverseId`
   - Conditionally use metaverse-scoped API when `metaverseId` present
   - Update cache invalidation for both scoped and global caches

---

## Previously Completed: Bug Fixes Session (2025-06-15) ✅

## Also Pending: RLS Global Admin Bypass

### Issue
Superadmin can now access metaverse dashboard (application-level fix done), BUT:
- Created sections don't appear in UI
- RLS policies filter data by `metaverses_users` membership
- **Root Cause**: User not in `admin.global_users` table after DB recreation

### Solution
1. RLS policies already updated with `admin.is_global_admin()` bypass (migration applied)
2. **USER must run SEED_AFTER_RECREATION.sql** to add themselves to `admin.global_users`

**SEED Location**: `packages/admin-backend/base/src/database/migrations/postgres/SEED_AFTER_RECREATION.sql`

---

## Recent Completions (Last 7 Days)

### 2025-12-04: User Settings System ✅
- Backend: profile-backend with settings JSONB column
- Frontend: useUserSettings hook, SettingsDialog component
- Integration: showAll parameter in backend routes
- Build: 52/52 packages passed
- Backend: permissionService, abilityMiddleware, /api/v1/auth/permissions
- Frontend: AbilityContextProvider, Can/Cannot components, useAbility hook
- Full build passed (52/52)
- Details: progress.md#2025-06-14

### 2025-06-13: Superadmin Cross-Entity Access ✅
- Fixed issue: superadmin couldn't access metaverses/clusters where not a member
- Root cause: `ensureAccess` only checked membership, not global roles
- Solution: Extended `createAccessGuards` with `getGlobalRole` and `createGlobalAdminMembership` options
- Global admins now get synthetic "owner" membership for full access
- Details: progress.md#2025-06-13

### 2025-06-13: Admin Edit/Delete Bug Fixes ✅
- Fixed empty role list in edit dialog (changed type from AssignableRole to MemberRole)
- Added `getMemberId` config option for correct ID extraction
- Details: progress.md#2025-06-13

---

## Active Blockers

### Template MUI CommonJS Shims (DEFERRED)
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Status**: Low priority, workarounds in place

---

## Quick Reference

### Core Patterns
- systemPatterns.md#source-only-package-peerdependencies-pattern
- systemPatterns.md#rls-integration-pattern
- systemPatterns.md#i18n-architecture
- systemPatterns.md#service-factory-nodeprovider-pattern

### Key Commands
```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For implementation details, see progress.md. For planned work, see tasks.md.
