# Active Context

> **Last Updated**: 2025-12-21
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: MetaHubs UI Data Contract Fix ✅ (2025-12-21)

**Status**: Fixed `/metahubs` runtime crash (`TypeError: d.map is not a function`).

**Root cause**: Some MetaHubs list endpoints can return a wrapper payload (e.g., `{ items, total, limit, offset }`) instead of a raw array. The frontend `listMetahubs()` assumed `response.data` is always an array and placed the wrapper object into `PaginatedResponse.items`. `usePaginated()` then forwarded that value as the `data` array, and the UI attempted to call `.map()` on a non-array.

**Fix**:
- Normalized list response shapes in `packages/metahubs-frontend/base/src/api/metahubs.ts` so `items` is always an array (supports both array payloads and `{ items, ... }` wrapper payloads; pagination meta derived from headers or payload).
- Aligned `packages/metahubs-frontend/base/src/pages/MetahubBoard.tsx` to use `entitiesData.items` (not Axios-style `entitiesData.data`).
- Added a defensive `Array.isArray` normalization in `packages/metahubs-frontend/base/src/pages/MetahubList.tsx` to avoid runtime crashes if malformed data slips through.

**Validation**:
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm build` (full workspace)

## Current Focus: MetaHubs UI Runtime Crash Fix ✅ (2025-12-21)

**Status**: Fixed `/metahubs` runtime crash (`Cannot read properties of undefined (reading 'currentPage')`).

**Root cause**: `MetahubList` used `PaginationControls` with an outdated/incorrect props shape, so `pagination` was `undefined` and the component accessed `pagination.currentPage`.

**Fix**:
- Updated `packages/metahubs-frontend/base/src/pages/MetahubList.tsx` to pass `pagination` + `actions` object props into `PaginationControls`.
- Aligned `FlowListTable` usage with its actual API (`customColumns`, `renderActions`, `getRowLink`).

**Validation**:
- `pnpm --filter @universo/metahubs-frontend lint` (clean)
- `pnpm --filter @flowise/core-frontend build`
- `pnpm build` (full workspace)

---

## Previous Focus: MetaHubs Access Control ✅ (2025-12-21)

**Status**: Access control implemented; MetaHubs restricted to global users only.

**Branch**: `main` (direct implementation)

**Overview**: Implemented access restrictions for MetaHubs module to ensure only superusers and users with explicit metahubs permissions can see and access the functionality.

**Implementation Summary**:

1. **CASL Integration**:
   - Added `metahubs: 'Metahub'` to MODULE_TO_SUBJECT mapping
   - Enables declarative permission checks with `<Can I="read" a="Metahub">`

2. **Permission System**:
   - New migration `1735300100000-AddMetahubsPermission.ts`
   - Superuser role has `metahubs:*` permission (all actions)
   - Future roles can receive granular metahubs permissions

3. **Menu Protection**:
   - Moved metahubs from `rootMenuItems` to `getMetahubsMenuItem()` function
   - Added `canAccessMetahubs` flag to `useHasGlobalAccess()` hook
   - MetaHubs appears in sidebar with divider (like Admin section)
   - Only visible when user has permission and not in entity context

4. **Route Protection**:
   - Created `MetahubGuard` component (like `AdminGuard`)
   - Wraps `/metahubs` and `/metahub/:metahubId` routes
   - Redirects to `/` if access denied

**Access Control Pattern**:
```
Superuser → Full access
metahubs:* permission → Full access  
Regular user → NO access (menu hidden, route redirects to /)
```

**Files Changed**:
- `flowise-store/AbilityContextProvider.jsx` - CASL subject mapping
- `flowise-store/useHasGlobalAccess.js` - canAccessMetahubs flag
- `admin-backend/migrations/` - New permission migration
- `universo-template-mui/menuConfigs.ts` - Separate menu function
- `universo-template-mui/MenuContent.tsx` - MetaHubs section
- `universo-template-mui/routing/MetahubGuard.tsx` - Route guard
- `universo-template-mui/MainRoutesMUI.tsx` - Use MetahubGuard

**Validation**: Full workspace build successful (59 tasks, 7m42s)

---

## Previous Focus: MetaHubs Post-Integration Build Stabilization ✅ (2025-12-21)

**Status**: Build blockers resolved; full workspace `pnpm build` is green.

**Branch**: `main` (direct implementation)

**Overview**: Fixed post-integration build issues for MetaHubs (Turbo dependency cycle and TypeScript strictness errors in backend routes).

**Fixes Applied**:
- Removed the `@universo/template-mui` → `@universo/metahubs-frontend` workspace dependency to break the Turbo cycle.
- Fixed TS2352 unsafe user-claims casts in `@universo/metahubs-backend` routes.
- Fixed a syntax issue in `@flowise/core-backend` entities registry introduced during integration.

**Architecture**:
- **Database**: `metahubs` schema with 5 tables (metahubs, metahubs_users, sys_entities, sys_fields, user_data_store)
- **Backend**: Express routes with RLS-aware managers, Zod validation, rate limiting
- **Frontend**: React + MUI + TanStack Query with MetahubList and MetahubBoard pages
- **Storage**: JSONB for flexible user data, GIN indexes for performance

**Packages Created**:
1. `@universo/metahubs-backend` - TypeORM entities, migrations, routes, services
2. `@universo/metahubs-frontend` - React pages, API client, i18n, hooks

**Integration Points**:
- Registered in `flowise-core-backend` (entities, migrations, routes)
- Routes added to `universo-template-mui/MainRoutesMUI.tsx`
- Menu items added to `menuConfigs.ts` with `getMetahubMenuItems()`
- Breadcrumbs support in `NavbarBreadcrumbs.tsx`
- i18n keys in `universo-i18n` menu files

**Next Steps**:
- Optional: runtime test MetaHubs UI (`/metahubs`, `/metahub/:metahubId`).
- Optional: improve breadcrumbs by resolving metahub name instead of showing truncated id.

---

## Previous Focus: PR #608 Post-Merge Cleanup & QA ✅ (2025-12-18)

**Status**: Universal canvas architecture implemented with node-based type detection; finishing AgentFlow UX parity for node configuration.

**Branch**: `main` (direct implementation)

**Overview**: Implementing AgentFlow-specific features from Flowise 3.0.12 for improved canvas UX - Chat Popup i18n fix, Validation Checklist (ValidationPopUp), and **universal canvas with node-based rendering**.

**Key Architecture Decision**: 
- Project uses **universal single canvas** for all node types (unlike Flowise's separate Canvas/AgentCanvas)
- Node rendering determined by **node data (category/name)**, not URL or canvas type
- AgentFlow nodes detected by: `category === 'Agent Flows'`, name ending with `Agentflow`, or AGENTFLOW_ICONS match

**Completed (Phases 1-4)**:

1. **Chat Popup i18n Fix** (`@flowise/chatmessage-frontend`) ✅
2. **flowise-agents-backend Package** (NEW) ✅
3. **flowise-agents-frontend Package** (NEW) ✅
4. **Universal Canvas with AgentFlow Node Rendering** ✅:
   - **nodeTypeHelper.js utility** (NEW, 104 lines):
     - `getNodeRenderType(nodeData)` → 'agentFlow' | 'stickyNote' | 'customNode'
     - `normalizeNodeTypes(nodes, componentNodes)` → normalizes on load
     - `isAgentFlowNode(node)` → boolean check
     - `getEdgeRenderType(sourceNode, targetNode)` → 'agentFlow' | 'buttonedge'
   - **Canvas changes**:
     - Universal nodeTypes/edgeTypes registry (all types always available)
     - onDrop uses `getNodeRenderType(nodeData)` 
     - onConnect uses `getEdgeRenderType()`
     - handleLoadFlow wraps with `normalizeNodeTypes()`
     - `hasAgentFlowNodes` useMemo for ValidationPopUp condition
   - **AgentFlowNode.jsx** - compact node with colored border, toolbar
   - **AgentFlowEdge.jsx** - gradient edge with hover delete button
   - **StickyNoteNode.jsx** - simple note node with color

**QA Fixes (2025-12-15)** ✅:
- ValidationPopUp icon color fixed to white (like ChatPopUp)
- AgentFlow node config dialog on double-click (Flowise 3.x behavior): Canvas-level `onNodeDoubleClick` opens `EditNodeDialog`

**QA Fixes (2025-12-16)** ✅:
- Fixed EditNodeDialog/ConfigInput reactivity: NodeInputHandler now calls `onCustomDataChange` on value changes, so provider parameters update immediately without closing/reopening dialogs.
- Fixed Connect Credential UI: NodeInputHandler now uses the canvas CredentialInputHandler (AsyncDropdown-based) and shows the placeholder correctly when empty.
- Removed temporary debug logs from `packages/spaces-frontend/base/src/views/canvas/ConfigInput.jsx`.

**QA Fixes (2025-12-17)** ✅:
- Fixed missing `Messages` section for existing saved canvases: moved array-type inputParams rehydration (e.g., `llmMessages`) from `EditNodeDialog` to Canvas flow loading (Space + non-Space loaders + handleLoadFlow) and removed dialog-side schema mutation.

**QA Fixes (2025-12-17)** ✅:
- Fixed input focus loss on each keystroke: removed value-based remount key for `<Input>` and synced internal input state with the `value` prop.
- Fixed Start node extra fields shown by default: apply `showHideInputParams` when opening `EditNodeDialog` so form-only fields stay hidden unless `startInputType === 'formInput'`.

**Agents + Executions QA Hardening (2025-12-17)** ✅:
- Validation and executions routes now enforce Unik membership when scoped by `unikId` and prefer parent route params for scoping.
- Public execution contract aligned: share links use `/execution/:id` (no auth) and the server exposes `GET /public-executions/:id`.

**QA Fixes (2025-12-18)** ✅:
- Fixed `@universo/template-mui` lint blockers (no-autofocus, test aria-role false positives, invalid rule disables, react/display-name, Prettier).
- Full workspace `pnpm build` succeeded after the lint fixes.

**Pending (Phase 5 - Final Testing)**:
- [ ] Runtime testing (pnpm start) with AgentFlow nodes
- [ ] E2E test: create canvas → add AgentFlow nodes → configure → validate → run

**Build Status**:
- ✅ Full workspace build (`pnpm build`) successful
- ✅ `pnpm --filter @universo/spaces-frontend lint`: 0 errors (warnings only)
- ✅ `pnpm --filter @flowise/template-mui lint`: 0 errors (warnings only)
- ✅ `pnpm --filter @universo/template-mui lint`: 0 errors (warnings only)

---

## Previous Focus: Agent Executions Integration (Flowise 3.x) ✅ (2025-12-15)

5. **i18n Integration**:
   - Menu translations added: "executions" → "Executions" (en), "Исполнения" (ru)

**Build Fixes Applied**:
- Fixed TypeScript errors: entity initializers, ExecutionState visibility, filter types, AxiosInstance import
- All packages build successfully, full workspace build passes (55 tasks)

**Phase 5 Completed (2025-12-15)**:
- ✅ Copied all pages: Executions.jsx (464 lines), ExecutionDetails.jsx (985 lines), NodeExecutionDetails.jsx, PublicExecutionDetails.jsx, ShareExecutionDialog.jsx
- ✅ Created ExecutionsListTable component with MUI DataGrid
- ✅ Adapted imports to use @flowise/template-mui and @universo/api-client
- ✅ Added useParams() for routing context (unikId, spaceId, canvasId)
- ✅ Full workspace build: 55 tasks, 4m 56s - SUCCESS

**Next Steps**:
- Integrate executions into spaces-frontend routing (add Executions tab to Canvas view)
- Manual runtime testing
- End-to-end validation

**Technical Notes**:
- Router uses `mergeParams: true` to inherit URL params from parent routes
- Service methods include canvas scoping for isolation
- Soft delete pattern preserves execution history
- Migration order critical due to canvas_id FK constraint

---

## Previous Focus: Flowise 3.0.12 Full Package Replacement ✅ (2025-12-14)

**Status**: Completed. Full workspace builds successfully (54 tasks). AgentFlow icons implemented in spaces-frontend.

**Branch**: `feature/flowise-3.0.12-full-replacement`

**Key Changes**:
1. **Package Replacement**:
   - Backed up old package as `flowise-components-2.2.8-backup`
   - Copied full Flowise 3.0.12 components package (820 files, 8.6MB)

2. **Build System Adaptation (Upstream-aligned)**:
   - Switched `flowise-components` build to upstream approach: `tsc` + `gulp` (instead of rolldown/tsdown)
   - Removed/avoided CJS lazy-init patterns (`__esm`) that were causing runtime failures on clean rebuilds

3. **API Changes Handled**:
   - `IServerSideEventStreamer`: Added 8 new methods (AgentFlow + TTS streaming)
   - Storage functions now return `{ path: string; totalSize: number }` instead of `string`
   - `addBase64FilesToStorage`: Added `orgId` parameter (4th arg)
   - `streamStorageFile`: Added `orgId` parameter (4th arg)
   - `removeFolderFromStorage` / `removeFilesFromStorage`: Now return `{ totalSize: number }`
   
4. **New Features in 3.0.12**:
   - AgentFlow nodes (`nodes/agentflow/`)
   - AGENTFLOW canvas type added to CanvasType enum
   - TTS streaming events (text-to-speech)
   - Enhanced evaluation system

5. **AgentFlow Icons Fix** (2025-12-14):
   - **Root cause**: AgentFlow nodes don't have icon files - they use built-in @tabler/icons-react v3.x components
   - **Selection rule** (upstream-aligned): `node.color && !node.icon` → render Tabler icon; otherwise → `/api/v1/node-icon/...`
   - **AGENTFLOW_ICONS constant**: Array with 15 entries `{name, icon: TablerComponent, color}` in `flowise-template-mui/constants.ts`
   - **spaces-frontend patches** (2025-12-14):
     - `AddNodes.jsx`: Added `renderNodeIcon()` helper using `AGENTFLOW_ICONS.find()`
     - `CanvasNode.jsx`: Same `renderNodeIcon()` pattern for node rendering on canvas
     - `agentflows/index.jsx`: `buildImageMap()` returns `{images, icons}`; component manages both states
     - `canvases/index.jsx`: Same pattern applied
     - `spaces/index.jsx`: Same pattern for `buildImagePreviewMap()`
     - `NodeInfoDialog.jsx`: Conditional Tabler icon rendering for AgentFlow nodes
   - **Backend fix**: Global error handler in `routes/index.ts` now respects `err.statusCode` (no longer masks 404 as 500)
   - Upgraded `@tabler/icons-react` from ^2.32.0 to ^3.30.0 to match Flowise 3.0.12

**Files Modified** (this session):
- `packages/spaces-frontend/base/src/views/canvas/AddNodes.jsx`
- `packages/spaces-frontend/base/src/views/canvas/CanvasNode.jsx`
- `packages/spaces-frontend/base/src/views/agentflows/index.jsx`
- `packages/spaces-frontend/base/src/views/canvases/index.jsx`
- `packages/spaces-frontend/base/src/views/spaces/index.jsx`
- `packages/flowise-template-mui/base/src/ui-components/dialog/NodeInfoDialog.jsx`
- `packages/flowise-core-backend/base/src/routes/index.ts`

**Current Blockers / Next Steps**:
- Runtime testing (`pnpm start`) to verify AgentFlow icons display correctly
- After verification: commit changes to branch

---

## Previous Focus: Admin Roles Delete Dialog i18n ✅ (2025-12-13)

**Status**: Completed comprehensive terminology refactoring from "VLC" to "Localized Content".

**Summary**:
- Renamed all VLC types to LocalizedContent (no deprecated aliases)
- Renamed all VLC utility functions (createVlc → createLocalizedContent, etc.)
- Updated database columns: `is_enabled_vlc` → `is_enabled_content`, `is_default_vlc` → `is_default_content`
- Changed API endpoint: `/api/v1/locales/vlc` → `/api/v1/locales/content`
- Updated admin UI terminology: "Locales" → "Languages" (en: "Languages", ru: "Языки")
- UI/UX improvements: nativeName field first and required, column headers shortened

**Key Technical Decisions**:
- Removed legacy aliases and deprecated exports; use new names only
- Both index.ts and index.browser.ts updated in universo-utils

**Files Modified**: 18 files across universo-types, universo-utils, admin-backend, admin-frontend, universo-i18n, universo-template-mui

**Details**: See progress.md#2025-12-15

---

## Previous Focus: Dynamic Locales System ✅ (2025-12-14)

**Status**: Implemented admin "Locales" management for VLC (Versioned Localized Content).

**Summary**:
- Admin UI at `/admin/instance/:instanceId/locales` for managing available locales
- Database-driven instead of hardcoded `en`/`ru`
- Public API `/api/v1/locales/content` for LocalizedFieldEditor (no auth, cached)
- Type system changed: `SupportedLocale` now string alias with runtime validation
- Full i18n support (en/ru translations for all new UI)

**Key Technical Decisions**:
- Content locales separate from UI i18n (UI still requires file-based translations)
- System locales (en, ru) protected from deletion
- Backward compatibility via deprecated type aliases

**Files Created**: 9 new files (entity, migration, routes, API, pages, components)
**Files Modified**: 14 files (types, utils, routes, i18n, frontend routing)

**Details**: See progress.md#2025-12-14

---

## Previous Focus: Development Environment Maintenance ✅ (2025-12-11)

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
