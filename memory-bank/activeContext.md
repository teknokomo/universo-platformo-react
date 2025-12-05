# Active Context

> **Last Updated**: 2025-01-05
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Metaverse Admin Access Fix (2025-01-05) ✅

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

### Build Status
✅ Full build successful (52/52 packages)

### User Next Steps
1. **Restart server** to apply changes
2. **Test scenario**: 
   - Login as superadmin
   - Enable "Show all items" in settings
   - Navigate to another user's metaverse
   - Verify sections and entities are now visible

---

## Previously Completed: Bug Fixes Session (2025-06-15) ✅

### Completed (Phase 1-3)
✅ Database migration for RBAC tables (roles, permissions, user_roles)
✅ PostgreSQL functions (has_permission, get_user_permissions)
✅ Backend CASL integration (permissionService, abilityMiddleware)
✅ Frontend CASL integration (AbilityContext, Can component)
✅ Fixed getDataSource passed to createAuthRouter()

### Pending (Phase 4)
- [ ] **USER ACTION**: Run SEED_AFTER_RECREATION.sql in Supabase SQL Editor to assign superadmin role
- [ ] Test permissions endpoint (should return permissions now)
- [ ] Test Can component in admin module

---

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
