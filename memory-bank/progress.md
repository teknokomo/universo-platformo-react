# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.40.0-alpha | 2025-12-06 | Straight Rows 🎹 | Tools, Credentials, Variables, ApiKey, Assistants, Leads, ChatMessage, DocumentStore, CustomTemplates extraction (9 packages), Canvases migrations consolidation, Admin Instances MVP, RBAC Global Roles |
| 0.39.0-alpha | 2025-11-26 | Mighty Campaign 🧙🏿 | Campaigns module, Storages module, useMutation refactor (7 packages), QA fixes |
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management system, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring (OpenAPI 3.1), Uniks metrics update, UnikBoard 7 metrics, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frontend architecture, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n TypeScript migration, Type safety improvements, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown build system, dependencies centralization |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System 429 fixes, API modernization, Metaverses refactoring, Quiz timer |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas versioning, Chatflow→Canvas terminology, PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing, Unik deletion cascade, Space Builder modes, Material-UI template |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases, Global publication library, Analytics selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Cluster isolation architecture, i18n docs checker, GitHub Copilot modes |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch �� | Metaverses dashboard, Universal List Pattern |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Language switcher, MMOOMM template, Finance module |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Multiplayer Colyseus server |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder MVP, Metaverse module, @universo/types |

---

## December 2025

### 2025-12-10: Legacy Code Cleanup ✅

**Context**: Post-RBAC cleanup - fixed outdated comments and legacy naming conventions.

**Changes**: Updated 4 files in admin-frontend (`has_global_access = true` → `is_superuser = true` in comments), updated systemPatterns.md (removed deleted SQL function reference), enhanced deprecation warning in `adminConfig.ts`.

**Files**: 6 files modified (admin-frontend, universo-utils, memory-bank)

---

### 2025-12-09: Global Roles Access Implementation ✅

**Summary**: Fixed architecture separating `hasAdminAccess` (admin panel) from `hasGlobalSubjectAccess` (view all data). Users with subject-specific permissions (e.g., `metaverses:*`) can now access all items of permitted subjects.

**Key Fixes**: (1) Guard bypass - `ensureMetaverseAccess` checks global permissions before membership, (2) Legacy SQL - replaced `admin.has_global_access()` → `admin.is_superuser()`, (3) Sections dropdown context-awareness.

**Modified**: 13 files (metaverses-backend, metaverses-frontend, auth-backend, flowise-store)

---

### 2025-12-08: CASL Standard Compliance ✅

**Goal**: Align permission system with CASL/Auth0/OWASP standards by renaming `module` → `subject`.

**Changes**: 21 files - database migration (column rename, SQL functions), TypeScript types, backend services, frontend (PermissionMatrix 13 changes), i18n (EN/RU).

**Critical Bug Fixed**: TypeError in InstanceUsers.tsx - `queryKey` → `queryKeyFn` parameter mismatch.

**Architecture**: `subject` field now used throughout (e.g., `roles:read`, `metaverses:*`).

---

### 2025-12-07: RBAC Architecture Cleanup ✅

**Goal**: Remove `canAccessAdmin` flag redundancy - admin access now computed from RBAC permissions.

**Rule**: `IF user has READ permission on ANY of ['roles', 'instances', 'users'] THEN hasAdminAccess = true`

**Changes**: 18 files - dropped database column, added SQL function `admin.has_admin_permission()`, updated frontend hooks/UI.

---

### 2025-12-07: Roles UI Unification ✅

**Summary**: Refactored RolesList to use unified pattern (MetaverseList style) with card/table views, pagination, search, BaseEntityMenu.

**Implementation**: Created RoleActions with `createEntityActions` factory, added direct exports to rolesApi, implemented full unified pattern with `usePaginated` hook.

**Features**: Card view (color indicator, badges, permissions count), table view (FlowListTable), permission filtering, localStorage persistence.

---

### 2025-12-06: Admin Instances Module MVP ✅

**Summary**: Created Instances management with single pre-seeded "Local" instance, simplified left menu, context menu inside instance.

**Routes**: `/admin` (InstanceList), `/admin/instance/:id` (InstanceBoard), `/admin/instance/:id/access` (InstanceAccess).

**Implementation**: Entity/migration, backend routes, frontend API/hooks/pages, navigation integration, i18n (EN/RU).

---

### 2025-12-05: Dynamic Global Roles System ✅

**Goal**: Replace hardcoded `'superadmin' | 'supermoderator'` with dynamic database-driven roles.

**Changes**: Added `display_name` (JSONB), `color`, `has_global_access` to `admin.roles`, created SQL functions `admin.has_global_access()`, `admin.get_user_global_roles()`, updated API endpoints with `roleMetadata`.

**Frontend**: AbilityContextProvider provides `globalRoles`, `rolesMetadata`, `hasGlobalAccess`; RoleChip accepts `roleMetadata` for dynamic colors.

---

### 2025-12-04: User Settings System ✅

**Goal**: Allow superadmin to toggle "show only my items" vs "show all items".

**Implementation**: Backend (profile-backend with settings JSONB column, GET/PUT endpoints), Frontend (useUserSettings hook, SettingsDialog component), Route updates (showAll query parameter in metaverses, sections, entities).

**Pattern**: `showAll=true` → LEFT JOIN, `showAll=false` → INNER JOIN (membership filter).

**Build**: 52/52 packages ✅

---

### 2025-12-03: Admin Packages (Superadmin/Supermoderator) ✅

**Summary**: Created `@universo/admin-backend` and `@universo/admin-frontend` for global user management.

**Features**: Global roles (superadmin full CRUD, supermoderator read-only), ENV control (`SUPER_USERS_MODE`), separate `admin` schema with RLS, API endpoints, menu integration.

**Architecture**: Local apiClient in admin-frontend (avoid cyclic deps), useGlobalRoleCheck hook, PageCard component usage.

---

## November 2025

### 2025-11-26: Campaigns Integration ✅

**Summary**: Three-tier architecture implementation (campaigns-backend, campaigns-frontend, @universo/api-client).

**Routes**: `/campaign/:campaignId/*` with Board and Access pages, full CRUD operations.

---

### 2025-11-25: Storages Management ✅

**Summary**: Three-tier architecture for storage management system.

**Implementation**: Zod validation, RLS policies, storage types (personal/organization), member management.

---

### 2025-11-22: Organizations Module ✅

**Summary**: Organizations management with Projects hierarchy, breadcrumbs navigation.

**Features**: OrganizationBoard, OrganizationMembers, organization-project relationship, i18n Member keys refactor.

---

### 2025-11-18: Projects Management System ✅

**Summary**: Hierarchical project structure with milestones terminology.

**Router**: Registered, 23 issues fixed, all pages loading, terminology unified throughout UI.

---

### 2025-11-14: REST API Documentation Refactoring ✅

**Summary**: Modular OpenAPI 3.1 structure with Zod validation.

**Changes**: Workspace → Unik terminology, description fields added, modular schema structure.

---

### 2025-11-13: Uniks Module Expansion ✅

**Summary**: UnikBoard expanded from 3 to 7 metric cards, metrics update (Spaces/Tools counts), Clusters breadcrumbs with useClusterName hook.

**Refactor**: Switched from chatflows to spaces metrics, createAccessGuards factory pattern.

---

## October 2025

### 2025-10-30: Bold Steps 💃 (v0.35.0-alpha) ✅

**Summary**: i18n TypeScript migration, type safety improvements, Rate limiting with Redis, RLS integration analysis.

**Changes**: 30+ packages migrated to TypeScript i18n, Redis rate limiter implementation, RLS pattern documentation.

---

### 2025-10-23: Black Hole ☕️ (v0.34.0-alpha) ✅

**Summary**: Global monorepo refactoring, tsdown build system implementation, dependencies centralization.

**Changes**: Package restructuring, dual build (CJS + ESM), workspace dependencies optimization.

---

### 2025-10-16: School Test 💼 (v0.33.0-alpha) ✅

**Summary**: Publication System 429 fixes, API modernization, Metaverses architecture refactoring, Quiz timer feature.

**Changes**: Rate limiting implementation, REST API updates, Quiz interactive timer.

---

### 2025-10-09: Straight Path 🛴 (v0.32.0-alpha) ✅

**Summary**: Canvas versioning, Chatflow→Canvas terminology refactoring, PostHog telemetry (opt-in), Metaverses pagination.

**Changes**: Canvas metadata editing, terminology alignment, analytics integration.

---

### 2025-10-02: Victory Versions 🏆 (v0.31.0-alpha) ✅

**Summary**: Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Material-UI template system.

**Changes**: Quiz editing UI, cascading delete fixes, Space Builder view modes.

---

## September 2025

### 2025-09-21: New Doors 🚪 (v0.30.0-alpha) ✅

**Summary**: TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors.

**Changes**: `@/*` path aliases, publication CRUD, multi-level analytics filtering.

---

### 2025-09-15: Cluster Backpack 🎒 (v0.29.0-alpha) ✅

**Summary**: Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes.

**Changes**: Cluster-level resource isolation, documentation tooling, AI-assisted development modes.

---

### 2025-09-07: Orbital Switch 🥨 (v0.28.0-alpha) ✅

**Summary**: Metaverses dashboard implementation, Universal List Pattern establishment.

**Changes**: Metaverse metrics dashboard, reusable list pattern for all entity types.

---

## August 2025

### 2025-08-31: Stable Takeoff 🐣 (v0.27.0-alpha) ✅

**Summary**: Language switcher, MMOOMM template, Finance module.

**Changes**: EN/RU language toggle, metaverse template, financial tracking module.

---

### 2025-08-24: Slow Colossus 🐌 (v0.26.0-alpha) ✅

**Summary**: MMOOMM modular package, Multiplayer Colyseus server integration.

**Changes**: Template package extraction, real-time multiplayer server setup.

---

### 2025-08-17: Gentle Memory 😼 (v0.25.0-alpha) ✅

**Summary**: Space Builder MVP, Metaverse module, @universo/types foundation.

**Changes**: Initial Space Builder functionality, Metaverse entity system, shared types package.

---

## July 2025 and Earlier (Condensed Archive)

### Major Milestones (0.20-0.24)

- **0.24.0-alpha**: Space Builder enhancements, UPDL nodes expansion, AR.js wallpaper mode
- **0.23.0-alpha**: Russian documentation translation, UPDL conditional params
- **0.22.0-alpha**: Memory Bank rules establishment, MMOOMM laser mining feature
- **0.21.0-alpha**: Handler refactoring, PlayCanvas stabilization
- **0.20.0-alpha**: UPDL node refactoring, Template-First architecture

### Foundation Phase (0.10-0.19)

- Flowise integration and customization
- Supabase authentication system
- UPDL (Universal Platform Description Language) basics
- Initial RLS policies and security model
- Core entity system (Metaverses, Clusters, Projects)

---

## Architecture Decisions & Patterns

### Package Extraction Strategy (November 2025)

**Standard Approach**:
1. Create backend package with entity, migration, DI service
2. Create frontend package with pages, i18n
3. Update flowise-server imports
4. Delete legacy files
5. Build and verify

**DI Factory Pattern**: All new packages use `createXxxService(config)` with dataSource, optional providers, callbacks.

---

### Key Technical Decisions

**TypeORM Repository Pattern**: All DB access via `getDataSource().getRepository(Entity)`, user context for RLS policies, no direct SQL.

**TanStack Query v5**: Query key factories, useQuery for fetching, useMutation for state changes (replaced custom useApi).

**i18n Architecture**: Core namespaces in @universo/i18n, feature packages own translations, registerNamespace for runtime.

**Build System**: pnpm workspace (run from root), tsdown dual output (CJS + ESM), path aliases `@/*`.

---

### Known Issues & Workarounds

**Template MUI CommonJS** (DEFERRED): flowise-ui ESM/CJS conflict, workaround via direct source imports.

**React StrictMode**: Conditional wrapper (dev only) to avoid double-mount issues.

---

## Statistics

**Package Evolution**:
- August 2025: 25 packages
- November 2025: 46 packages
- December 2025: 52 packages (current)

**Build Performance**: Full workspace build ~4-6 minutes depending on cache state.

---

**Last Updated**: 2025-12-10

**Note**: For current work → tasks.md. For patterns → systemPatterns.md.
