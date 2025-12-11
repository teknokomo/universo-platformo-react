# Active Context

> **Last Updated**: 2025-12-11
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Development Environment Maintenance ✅ (2025-12-11)

**Status**: Fixed ESLint TypeScript compatibility warnings. Development environment now clean.

**Latest Actions**:
- ✅ Upgraded @typescript-eslint packages to v8.x (now supports TypeScript 5.8.3)
- ✅ Updated eslint-plugin-unused-imports to v4.3.0 for compatibility
- ✅ Reconfigured ESLint to use TypeScript overrides pattern
- ✅ Verified all packages lint correctly without version warnings

**Impact**: No more "unsupported TypeScript version" warnings during linting. Code quality tools now run cleanly across entire codebase.

**Previous Context**: UUID v7 QA investigation completed successfully (see progress.md#2025-12-11)

---

## Previous Focus: UUID v7 Migration - Complete ✅ (2025-12-10)

**Status**: Successfully migrated entire project from UUID v4 to UUID v7 for better database performance.

**Changes**:
- Created `@universo/utils/uuid` module with `generateUuidV7()`, `isValidUuid()`, `extractTimestampFromUuidV7()`
- Updated TypeORM from 0.3.6 → 0.3.28 (removed override)
- Added PostgreSQL `uuid_generate_v7()` function in first migration (admin-backend)
- Updated 75 database migrations: `uuid_generate_v4()` / `gen_random_uuid()` → `public.uuid_generate_v7()`
- Updated 24 backend files: replaced `randomUUID()` from crypto and `{ v4 as uuidv4 } from 'uuid'` with `uuid.generateUuidV7()` from `@universo/utils`
- Updated 7 frontend files: replaced `{ v4 as uuidv4 } from 'uuid'` with `{ uuidv7 } from 'uuidv7'`
- Added `uuidv7: ^1.1.0` to catalog in `pnpm-workspace.yaml`

**Performance Impact**: UUID v7 provides 30-50% faster indexing (time-ordered) compared to random UUID v4

**Details**: progress.md#2025-12-10

---

## Previous Focus: Legacy Code Cleanup ✅ (2025-12-10)

**Status**: Fixed 5 minor issues with outdated comments and legacy naming conventions after Global Roles Access implementation.

**Changes**:
- Updated 4 comment blocks in admin-frontend: `has_global_access = true` → `is_superuser = true`
  - Files: `useRoles.ts`, `queryKeys.ts`, `rolesApi.ts`, `useAssignableGlobalRoles.ts`
- Updated `systemPatterns.md`: Removed reference to deleted `admin.has_global_access()` SQL function
- Enhanced deprecation warning in `adminConfig.ts` with detailed JSDoc and runtime console.warn()

**Details**: progress.md#2025-12-10

---

## Previous Focus: Global Roles Access Implementation ✅ (2025-12-09)

**Summary**: Fixed global roles access architecture - users with subject-specific permissions (e.g., `metaverses:*`) can now access all items of permitted subjects.

**Key Fixes**:
1. Guard bypass: Fixed `ensureMetaverseAccess` to check global permissions before membership (synthetic membership pattern)
2. Legacy SQL: Replaced `admin.has_global_access()` → `admin.is_superuser()`
3. Sections dropdown: Fixed context-awareness for metaverse-specific sections query

**Architecture**: Separated `hasAdminAccess` (admin panel) from `hasGlobalSubjectAccess` (view all data)

**Modified**: 13 files across 4 packages (metaverses-backend, metaverses-frontend, auth-backend, flowise-store)

**Details**: progress.md#2025-12-09

---

## Previous Focus: CASL Standard Compliance ✅ (2025-12-08)

**Summary**: Refactored permission system from `module` → `subject` terminology (CASL/Auth0/OWASP standard).

**Changes**: 21 files - database migration, TypeScript types, backend services, frontend components, i18n (EN/RU)

**Impact**: All permission checks now use `subject` field (e.g., `roles:read`, `metaverses:*`)

**Details**: progress.md#2025-12-08

---

## Previous Focus: RBAC Architecture Cleanup ✅ (2025-12-07)

**Summary**: Removed `canAccessAdmin` flag redundancy - admin access now computed from RBAC permissions.

**Rule**: `IF user has READ permission on ANY of ['roles', 'instances', 'users'] THEN hasAdminAccess = true`

**Changes**: 18 files - dropped database column, added SQL function `admin.has_admin_permission()`, updated frontend hooks

**Details**: progress.md#2025-12-07

---

## Recent Completions (Last 30 Days)

### RBAC System (2025-12-05 to 2025-12-10)
- Dynamic role dropdowns with database-driven roles (2025-12-09)
- Database-driven permissions replacing hardcoded checks (2025-12-08)
- RoleUsers page redesign with pagination/search (2025-12-07)
- Roles UI unification (card/table views, BaseEntityMenu) (2025-12-06)
- Admin Roles menu relocation to Instance context (2025-12-06)
- Admin Roles Management UI with PermissionMatrix (2025-12-05)

### UI/UX Improvements (2025-12-04 to 2025-12-07)
- Route protection guards (AdminGuard, ResourceGuard, MetaverseGuard) (2025-12-06)
- Breadcrumbs flicker fix for admin routes (2025-12-07)
- SettingsDialog UX improvement (disabled state when GLOBAL_ADMIN_ENABLED=false) (2025-12-07)
- Auth.jsx migration to auth-frontend package (layered architecture) (2025-12-08)

### Admin Module (2025-11-30 to 2025-12-05)
- Admin Instances module (InstanceList, InstanceBoard, InstanceAccess) (2025-12-05)
- Metaverse admin access fix (RLS + frontend architecture) (2025-12-04)
- User settings system (profile-backend, useUserSettings, SettingsDialog) (2025-12-04)
- CASL ability system integration (permissionService, AbilityContextProvider) (2025-11-30)

**Full History**: progress.md

---

## Active Patterns

### Access Control
- Pattern: systemPatterns.md#rls-integration-pattern
- Pattern: systemPatterns.md#synthetic-membership-pattern
- Pattern: systemPatterns.md#casl-ability-system

### Frontend Patterns
- Pattern: systemPatterns.md#usepaginated-hook
- Pattern: systemPatterns.md#universal-list-pattern
- Pattern: systemPatterns.md#entity-actions-factory

### i18n & Localization
- Pattern: systemPatterns.md#i18n-architecture

---

## Quick Commands

```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For detailed implementation history, see progress.md. For planned work, see tasks.md.
