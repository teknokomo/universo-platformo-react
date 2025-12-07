# Active Context

> **Last Updated**: 2025-12-08
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

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
