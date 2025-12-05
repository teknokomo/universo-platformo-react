# Active Context

> **Last Updated**: 2025-01-06
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Recently Completed: Admin Instances UI Polish (2025-01-06) ✅

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
- **Local Instance**: Single pre-seeded instance with UUID `00000000-0000-0000-0000-000000000000`
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
