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

## 📅 2025-12-21

### MetaHubs: Access Control Implementation (Restrict to Global Users) ✅

**Context:** MetaHubs functionality needed to be restricted to global users only (superusers and users with explicit metahubs permissions). Regular users should not see the MetaHubs menu item or access the routes.

**Implementation:**

1. **CASL Integration:**
   - Added `metahubs: 'Metahub'` to `MODULE_TO_SUBJECT` in `AbilityContextProvider.jsx`
   - Enables `<Can I="read" a="Metahub">` permission checks

2. **Permission Migration:**
   - Created `1735300100000-AddMetahubsPermission.ts` migration
   - Adds explicit `metahubs:*` permission for superuser role
   - Registered in `admin-backend/migrations/postgres/index.ts`

3. **Menu Protection:**
   - Moved `metahubs` from `rootMenuItems` to `getMetahubsMenuItem()` function
   - Added `canAccessMetahubs` flag to `useHasGlobalAccess()` hook
   - Added MetaHubs section with divider in `MenuContent.tsx` (like Admin section)
   - Menu only visible when `canAccessMetahubs && !inAnyEntityContext`

4. **Route Protection:**
   - Created `MetahubGuard.tsx` component (similar to `AdminGuard.tsx`)
   - Checks authentication + metahubs permission
   - Redirects to `/` if access denied
   - Updated `MainRoutesMUI.tsx` to use `MetahubGuard` for `/metahubs` and `/metahub/:metahubId` routes

**Files Changed:**
- `packages/flowise-store/base/src/context/AbilityContextProvider.jsx` - Added metahubs subject
- `packages/flowise-store/base/src/context/useHasGlobalAccess.js` - Added canAccessMetahubs
- `packages/admin-backend/base/src/database/migrations/postgres/1735300100000-AddMetahubsPermission.ts` - New migration
- `packages/admin-backend/base/src/database/migrations/postgres/index.ts` - Registered migration
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts` - Added getMetahubsMenuItem()
- `packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx` - Added MetaHubs section
- `packages/universo-template-mui/base/src/components/routing/MetahubGuard.tsx` - New guard
- `packages/universo-template-mui/base/src/components/routing/index.ts` - Export MetahubGuard
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - Use MetahubGuard

**Access Control Pattern:**
```
┌─────────────────────────────────────────────────────────┐
│                    MetaHubs Access                      │
├─────────────────────────────────────────────────────────┤
│ Superuser (is_superuser=true)      → Full access        │
│ Global Role with 'metahubs:*' perm → Full access        │
│ Regular user                        → NO access (403)   │
└─────────────────────────────────────────────────────────┘
```

**Validation:** Full workspace build successful (59 tasks, 7m42s)

### MetaHubs: Fix `/metahubs` Runtime Crash (PaginationControls currentPage) ✅

**Context:** Opening `/metahubs` crashed the UI with `TypeError: Cannot read properties of undefined (reading 'currentPage')`.

**Root cause:** `MetahubList` used `PaginationControls` with an incorrect props contract, so the component received `pagination === undefined` and accessed `pagination.currentPage`.

**Fixes:**
- Updated `packages/metahubs-frontend/base/src/pages/MetahubList.tsx` to pass `pagination` + `actions` into `PaginationControls`.
- Updated `MetahubList` to use the actual `FlowListTable` API (`customColumns`, `renderActions`, `getRowLink`).
- Auto-fixed Prettier formatting in `@universo/metahubs-frontend` to unblock lint.

**Validation:**
- ✅ `pnpm --filter @universo/metahubs-frontend build`
- ✅ `pnpm --filter @flowise/core-frontend build`
- ✅ `pnpm --filter @universo/metahubs-frontend lint` (clean)
- ✅ Full workspace `pnpm build` (59 tasks)

### MetaHubs: Fix `/metahubs` Runtime Crash (`d.map is not a function`) ✅

**Context:** After the pagination crash was fixed, opening `/metahubs` could still crash with `TypeError: d.map is not a function`.

**Root cause:** Some list endpoints can return a wrapper payload (e.g., `{ items, total, limit, offset }`) instead of a raw array. The frontend `listMetahubs()` assumed `response.data` is always an array and stored the wrapper object into `PaginatedResponse.items`. The `usePaginated()` hook then forwarded that value into UI rendering, which attempted `.map()` on a non-array.

**Fixes:**
- Normalized list response shapes in `packages/metahubs-frontend/base/src/api/metahubs.ts` to always return `PaginatedResponse<T>` with `items: T[]`.
   - Supports both array payloads and `{ items, ... }` payloads.
   - Pagination metadata is derived from headers when present, otherwise from payload / fallbacks.
- Aligned `packages/metahubs-frontend/base/src/pages/MetahubBoard.tsx` to consume `listEntities()` as `PaginatedResponse` (`entitiesData.items`).
- Added a defensive `Array.isArray` normalization in `packages/metahubs-frontend/base/src/pages/MetahubList.tsx` to avoid hard crashes if data is malformed.

**Validation:**
- ✅ `pnpm --filter @universo/metahubs-frontend lint`
- ✅ `pnpm --filter @universo/metahubs-frontend build`
- ✅ Full workspace `pnpm build` (59 tasks, 8m11s)

### MetaHubs: Post-Integration Build Stabilization ✅

**Context:** After integrating MetaHubs into the monorepo, the workspace build was blocked by a Turbo dependency cycle and TypeScript compilation errors.

**Fixes:**
- Broke the Turbo cycle by removing the `@universo/template-mui` → `@universo/metahubs-frontend` workspace dependency.
- Fixed TS2352 unsafe casts in `@universo/metahubs-backend` route helpers by routing the conversion through `unknown`.
- Fixed a syntax issue in `@flowise/core-backend` entities registry and ensured `Canvas`/`SpaceCanvas` are registered.

**Validation:**
- ✅ `pnpm --filter @universo/metahubs-backend build`
- ✅ `pnpm --filter @flowise/core-backend build`
- ✅ Full workspace `pnpm build` succeeded (59 tasks).

## 📅 2025-12-19

### MetaHubs Module MVP ✅

**Context:** Created full-stack MetaHubs module implementing MDA (Model-Driven Architecture) pattern for 1C-like dynamic entity definitions.

**Architecture Decisions:**
- **Database Schema**: Dedicated `metahubs` PostgreSQL schema with RLS policies and admin bypass
- **Entity Structure**: Metahub → SysEntity → SysField hierarchy with JSONB user_data_store
- **Access Model**: Role-based (owner/admin/editor/viewer) following existing module patterns
- **Storage**: JSONB fields with GIN indexes for flexible record storage

**Packages Created:**

1. **@universo/metahubs-backend** (19 files):
   - TypeORM entities: Metahub, MetahubUser, SysEntity, SysField, UserDataStore
   - Migration with RLS policies + `admin.is_superuser()` bypass
   - Zod validation schemas for all inputs
   - Express routes: metahubsRoutes, entitiesRoutes, recordsRoutes
   - Rate limiters following metaverses-backend pattern

2. **@universo/metahubs-frontend** (12 files):
   - React pages: MetahubList, MetahubBoard
   - API client with full CRUD for metahubs/entities/fields/records
   - TanStack Query key factories
   - i18n translations (en/ru)
   - Mutation hooks for all CRUD operations

**Integration:**
- Registered entities and migrations in `flowise-core-backend`
- Added routes with lazy router initialization pattern
- Frontend routes in `universo-template-mui/MainRoutesMUI.tsx`
- Menu items: `getMetahubMenuItems()` in `menuConfigs.ts`
- Breadcrumbs: `/metahubs` and `/metahub/:id` patterns
- i18n: `metahubs` and `metahubboard` keys in menu.json

**Database Tables:**
- `metahubs.metahubs` - MetaHub containers
- `metahubs.metahubs_users` - Access control (role-based)
- `metahubs.sys_entities` - Entity type definitions
- `metahubs.sys_fields` - Field definitions with type config
- `metahubs.user_data_store` - JSONB record storage

---

## 📅 2025-12-18

### PR #608 Bot Comments QA: Code Cleanup ✅

**Context:** GitHub bots (Copilot + Gemini Code Assist) identified unused imports, variables, and architectural improvements in PR #608.

**QA Analysis:**
- **Copilot**: 4 issues (unused imports/variables) ✅ Fixed
- **Gemini**: 2 issues (code duplication + complex function) ⚠️ Deferred

**Fixed Issues:**
1. ✅ Removed unused `executionsErrorHandler` import from `@flowise/core-backend/routes/index.ts`
2. ✅ Removed unused `validationService` variable creation (only router needed)
3. ✅ Removed unused `position` state variable in `AgentFlowNode.jsx`
4. ✅ Removed unused `position` state variable in `IterationNode.jsx`

**Deferred Issues (Architectural Improvements):**
5. ⚠️ Move `showHideInputParams.js` to `@universo/utils` (requires testing all canvas functionality)
6. ⚠️ Refactor `buildTreeData` function in `ExecutionDetails.jsx` (259 lines, but functional)

**Rationale for Deferral:**
- Items 5-6 are architectural improvements, not bugs
- Current code works correctly; refactoring introduces regression risk
- Requires extensive testing of canvas/execution tree rendering
- Better suited for dedicated refactoring PR

**Validation:**
- ✅ `pnpm --filter @flowise/executions-backend lint`: 0 errors
- ✅ `pnpm --filter @universo/spaces-frontend lint`: 0 errors
- ✅ `pnpm --filter @flowise/core-backend build`: TypeScript compilation successful
- ✅ `pnpm --filter @universo/spaces-frontend build`: tsdown build successful

### `@universo/template-mui`: Lint Unblocked + Full Build ✅

**Context:** Workspace was blocked by `@universo/template-mui` lint errors (a11y `no-autofocus`, test `aria-role` false positives, invalid rule-disable comments, `react/display-name`, and Prettier formatting diffs).

**Changes:**
- Replaced `autoFocus` usage with programmatic focus via `ref` + `useEffect`.
- Removed invalid ESLint disable comments for non-existent rules.
- Fixed `react/display-name` for MUI Select icon customization.
- Normalized formatting via ESLint/Prettier.

**Validation:**
- ✅ `pnpm --filter @universo/template-mui lint`: 0 errors (warnings only)
- ✅ Full workspace `pnpm build`: 57 tasks successful

## 📅 2025-12-17

### AgentFlow Dialog UX: Input Focus + Start Conditional Fields ✅

**Context:**
- Typing into text inputs (e.g., Messages → Content) caused focus to be lost after each keystroke.
- New `startAgentflow` nodes showed form-only fields (Form Title/Description/Input Types) even though default `startInputType` is `chatInput`.

**Root causes:**
- `NodeInputHandler` rendered `<Input>` with `key={data.inputs[inputParam.name]}`, which forced a remount on every value change.
- `initNode()` does not apply show/hide rules, so `inputParams.display` was never initialized on first open.

**Changes:**
- `@flowise/template-mui`:
   - Removed the value-based key for `<Input>` in `NodeInputHandler`.
   - Synced `Input` internal state with the `value` prop to support external updates without remounting.
- `@universo/spaces-frontend`:
   - Applied `showHideInputParams` when opening `EditNodeDialog` to compute `display` flags immediately.

**Validation:**
- ✅ `pnpm --filter @flowise/template-mui lint`: 0 errors (warnings only)
- ✅ `pnpm --filter @universo/spaces-frontend lint`: 0 errors (warnings only)
- ✅ Full workspace build `pnpm build`: 57 tasks successful (~7m 06s)

### AgentFlow Messages: Canvas-load Rehydration ✅

**Context:** Older saved canvases could miss array-type `inputParams` (e.g., `llmMessages`) created before `'array'` was whitelisted in `initNode`, causing the `Messages` UI to not render.

**Changes:**
- Moved the “missing array-type inputParams” repair from `EditNodeDialog` to Canvas flow loading paths (Space loader, non-Space loader, and handleLoadFlow), so nodes are repaired on load (Flowise-like).
- Removed dialog-side schema mutation to keep `EditNodeDialog` side-effect free.
- Added a follow-up rehydrate pass when `componentNodes` arrive after nodes, then re-applied `normalizeNodeTypes`.

**Validation:**
- ✅ `pnpm --filter spaces-frontend lint`: 0 errors (warnings only; pre-existing)
- ✅ Full workspace build `pnpm build`: 57 tasks successful (6m 43s)

### Agents + Executions QA Hardening (Authz + Public Contract) ✅

**Context:** QA found scoping/authz gaps for validation and canvas executions, plus a mismatch between share links, frontend routes, api-client endpoints, and server routes for public execution details.

**Changes:**
- Validation: prefer parent route params for `unikId` scoping (with UUID validation) and enforce Unik membership when scoped by `unikId`.
- Executions: enforce Unik membership on canvas-scoped executions routes.
- Public execution contract aligned: UI route `/execution/:id` (no auth) and API `GET /public-executions/:id` mounted in core-backend.

**Validation:**
- ✅ Full workspace build `pnpm build`: 57 tasks successful (~7m 06s)

## 📅 2025-12-16

### AgentFlow Features - Phase 4: Universal Canvas with AgentFlow Node Rendering ✅ (QA Fixes)

**Context:** User clarified that the project uses a **universal canvas architecture** (unlike Flowise's separate Canvas/AgentCanvas), where all node types coexist. Node rendering should be determined by **node data (category/name)**, not by URL or canvas type.

**QA Fixes (2025-12-16 evening):**

1. **ValidationPopUp FAB icon color** ✅:
   - Added `color: 'white'` to StyledFab sx prop
   - Added explicit `color="white"` to IconX and IconChecklist components
   - Now matches ChatPopUp styling with white icons on teal background

2. **AgentFlowNode double-click to open settings** ✅:
   - Added `onNodeClick` from flowContext
   - Created `handleNodeDoubleClick` handler that calls `onNodeClick({}, { id: data.id, data })`
   - Added `onDoubleClick={handleNodeDoubleClick}` to wrapper div
   - Added `cursor: 'pointer'` style to indicate clickable node
   - Now behaves like standard CanvasNode (double-click opens settings dialog)

3. **AgentFlow LLM config: realtime params + credential dropdown** ✅:
   - Root cause: `NodeInputHandler` mutated `data.inputs[...]` without notifying the dialog owner, so `EditNodeDialog` and `ConfigInput` did not re-render until closing/reopening.
   - Fixed: added optional `onCustomDataChange` + `setInputValue()` in `packages/flowise-template-mui/.../NodeInputHandler.jsx` and wired common inputs (Dropdown/AsyncDropdown/Input/Json/Code/etc.) through it.
   - Fixed: corrected credential selector import in NodeInputHandler to use canvas `./CredentialInputHandler` (AsyncDropdown-based) instead of the dialogs handler.
   - Fixed: credential placeholder now shows when empty (`credentialId || t(...)`) in `packages/flowise-template-mui/.../canvas/CredentialInputHandler.jsx`.
   - Cleanup: removed temporary debug `console.log` statements from `packages/spaces-frontend/.../ConfigInput.jsx`.

4. **Provider switch: stale dropdown option lists** ✅:
   - Problem: after changing provider (e.g., ChatOpenAI → ChatAnthropic), the "Connect Credential" and "Model Name" dropdowns still showed options from the old provider until dialog was closed and reopened.
   - Root cause: `AsyncDropdown` had a `hasLoaded` flag preventing reload on remount; wrapper key didn't force remount when provider changed.
   - Fixed: removed `hasLoaded` guard from `packages/flowise-template-mui/.../dropdown/AsyncDropdown.jsx`.
   - Fixed: updated asyncOptions wrapper key to include `data.id`, `inputParam.name`, and `JSON.stringify(data.inputs[inputParam.name])` so component remounts when value changes.
   - Fixed: added `setReloadTimestamp(Date.now())` call in asyncOptions `onSelect` when `inputParam.loadConfig` is true.
   - Fixed: added React key to `CredentialInputHandler` with credentialNames JSON to force remount when provider changes credential list.
   - Fixed: added `useEffect` in `CredentialInputHandler` to reset `reloadTimestamp` when `inputParam.credentialNames` changes.

5. **Messages (array) UI support** ✅:
   - Problem: Flowise 3 LLM nodes have `Messages` input (array of Role + Content), but our UI didn't render array-type inputs.
   - Created `packages/flowise-template-mui/base/src/ui-components/array/ArrayRenderer.jsx` (adapted from Flowise 3).
   - Added `'array'` to `whitelistTypes` in `initNode()` across all three genericHelper.js files (universo-utils, spaces-frontend, flowise-template-mui).
   - Added `inputParam.type === 'array'` rendering in `NodeInputHandler.jsx` using `ArrayRenderer`.
   - Exported `showHideInputs` from `spaces-frontend/utils/showHideInputParams.js` for external use.
   - Fix: for older saved canvases, EditNodeDialog rehydrates missing array params (e.g., `llmMessages`) from `canvas.componentNodes` via `initNode` when opening the dialog.

**Full workspace build successful** (57 tasks, 9m 24s).

**Key Insight:** AgentFlow nodes in flowise-components have `category: 'Agent Flows'` or names ending with `Agentflow` (e.g., `startAgentflow`, `llmAgentflow`). The AGENTFLOW_ICONS constant maps these names to Tabler icons.

**nodeTypeHelper.js Utility Created:**

Created new utility at `packages/spaces-frontend/base/src/utils/nodeTypeHelper.js` (104 lines):

```javascript
// Core functions:
getNodeRenderType(nodeData)      // Returns 'agentFlow' | 'stickyNote' | 'customNode' based on node data
normalizeNodeTypes(nodes, componentNodes)  // Normalizes node.type for all nodes on load
isAgentFlowNode(node)            // Returns true if node is AgentFlow type
getEdgeRenderType(sourceNode, targetNode)  // Returns 'agentFlow' | 'buttonedge' based on connected nodes

// Detection logic:
// 1. StickyNote type → 'stickyNote'
// 2. category === 'Agent Flows' → 'agentFlow'
// 3. name ends with 'Agentflow' (case-insensitive) → 'agentFlow'
// 4. name matches AGENTFLOW_ICONS key → 'agentFlow'
// 5. Default → 'customNode'
```

**Canvas Changes (index.jsx):**

- **Universal nodeTypes/edgeTypes registry**: Single registry with all types always available
- **onDrop**: Uses `getNodeRenderType(nodeData)` instead of `isAgentCanvas` conditional
- **onConnect**: Uses `getEdgeRenderType(sourceNode, targetNode)` to determine edge style
- **handleLoadFlow**: Wraps nodes with `normalizeNodeTypes()` on load
- **hydrateGeneratedGraph**: Uses `getNodeRenderType(data)` for generated nodes
- **hasAgentFlowNodes**: New `useMemo` that checks `nodes.some(isAgentFlowNode)`
- **ValidationPopUp condition**: Changed from `isAgentCanvas` to `hasAgentFlowNodes`

**Benefits of Universal Canvas Approach:**

1. **Mixed node types**: Standard and AgentFlow nodes can coexist on same canvas
2. **No URL dependency**: Works regardless of route path (`/space/...` or `/agentcanvas/...`)
3. **Node-based detection**: Each node self-determines its render style
4. **Dynamic ValidationPopUp**: Appears when any AgentFlow node is added

**Build Validation:**
- ✅ `pnpm --filter spaces-frontend build` - SUCCESS (5.2s)
- ✅ `pnpm --filter spaces-frontend lint --fix` - 0 errors, 14 warnings (console.log)
- ✅ Full workspace build: 57 tasks in 6m 26s, all successful

**Build Validation (follow-up 2025-12-16):**
- ✅ Full workspace build (`pnpm build`): 57 tasks, 6m 13s, all successful
- ✅ Re-run full workspace build (`pnpm build`): 57 tasks, 6m 25s, all successful
- Note: `@flowise/template-mui` lint currently reports pre-existing errors unrelated to the changes above

---

### AgentFlow Features - Phases 1-3 Complete ✅

**Context:** Implementing AgentFlow-specific features from Flowise 3.0.12 for improved canvas UX: Chat Popup i18n fix, Validation Checklist (ValidationPopUp), and foundation for AgentFlow node rendering.

**Phase 1: Chat Popup i18n Fix ✅**

Created proper i18n infrastructure for `@flowise/chatmessage-frontend`:
- Created `src/i18n/en/chatmessage.json` with English translations
- Created `src/i18n/ru/chatmessage.json` with Russian translations
- Created `src/i18n/index.ts` using `registerNamespace('chatmessage', { en, ru })` pattern
- Updated `src/index.js` with side-effect i18n import
- Added `onOpenChange` callback prop to `ChatPopUp.jsx` for ValidationPopUp coordination

**Phase 2: flowise-agents-backend Package ✅**

Created new package `@flowise/agents-backend` for Agent-specific backend services:

Files created:
- `package.json` - Package config with express, typeorm, zod, http-status-codes
- `tsconfig.json` / `tsconfig.esm.json` - Dual CJS/ESM build configs
- `src/types/index.ts` - Type definitions (IValidationResult, IReactFlowNode, IReactFlowEdge, INodeParam, IComponentNode, IFlowData)
- `src/services/validationService.ts` - Adapted from Flowise (329→300 lines), factory pattern with DI
- `src/services/index.ts` - Services exports
- `src/routes/validationRouter.ts` - Express router with GET /validation/:canvasId endpoint
- `src/routes/index.ts` - Routes exports
- `src/index.ts` - Public exports

Validation service features:
- Checks node connections (disconnected nodes)
- Validates required parameters with show/hide conditions
- Validates array parameter items with nested conditions
- Validates nested config parameters
- Validates credential requirements
- Detects hanging edges (source/target not existing)
- Zod schemas for response validation

**Phase 3: flowise-agents-frontend Package ✅**

Created new package `@flowise/agents-frontend` for Agent-specific UI components:

Files created:
- `package.json` - Package config with @flowise/store, @universo/api-client, @universo/i18n
- `tsconfig.json` / `tsconfig.esm.json` - Dual CJS/ESM build configs (noImplicitAny: false for store compatibility)
- `src/i18n/en/agents.json` - English translations for validation UI
- `src/i18n/ru/agents.json` - Russian translations
- `src/i18n/index.ts` - i18n registration using `registerNamespace('agents', { en, ru })`
- `src/components/ValidationPopUp.tsx` - Adapted from Flowise (302→310 lines TypeScript)
- `src/components/index.ts` - Component exports
- `src/index.ts` - Public exports with i18n side-effect import

ValidationPopUp features:
- Popper-based popup with FAB toggle (IconChecklist/IconX)
- Integration with redux store (customization.isDarkMode)
- AgentFlow icons rendering via AGENTFLOW_ICONS constant
- Issue list with warning styling (amber/orange theme)
- Empty state SVG (inline data URI)
- i18n translations for all UI strings
- TypeScript interfaces for props and validation items

**API Client Update:**

Added ValidationApi to `@universo/api-client`:
- Created `src/api/validation.ts` with `createValidationApi()` factory
- Types: ValidationResult, ValidationResponse
- Method: `checkValidation(canvasId, unikId?)` → `{ data: ValidationResult[] }`
- Integrated into `createUniversoApiClient()` as `validation` property

**Phase 4 Status (AgentFlow Node Rendering):**

Implemented in `packages/spaces-frontend` (universal canvas):
- ✅ Universal nodeTypes/edgeTypes with node-based type detection
- ✅ ValidationPopUp visibility based on presence of AgentFlow nodes
- ✅ AgentFlow node config dialog on double-click (Canvas-level `onNodeDoubleClick` + `EditNodeDialog`)

**Build Validation:**
- ✅ `pnpm --filter @flowise/agents-backend build` - SUCCESS
- ✅ `pnpm --filter @flowise/agents-frontend build` - SUCCESS
- ✅ `pnpm --filter @universo/api-client build` - SUCCESS
- ✅ Full workspace build: 57 tasks in 6m 55s, all successful

---

## 📅 2025-12-15

### Agent Executions - Full Implementation Complete ✅

**Context:** Continuing execution tracking integration. Previous sessions completed backend/API; this session addresses frontend build issues, QA fixes, and i18n integration.

**QA Analysis Completed:**
1. **Lint errors fixed:** Removed unused `ToolIconFallback`, converted `catch(e)` to `catch` blocks
2. **Unnecessary files removed:** Deleted 5 redundant index.js barrel exports in template-mui/ui-components
3. **Security verified:** DOMPurify correctly configured, no unsafe patterns found
4. **Library choices documented:** flowise-react-json-view is fork of archived repo, noted for future replacement

**I18N Integration (Executions Page):**
- Added `useTranslation('executions')` hook to Executions.jsx
- Translated: title, filters (state/dates/canvas/session), buttons (apply/reset), delete dialog, empty state
- Updated i18n JSON files with proper keys and Russian translations
- Registered namespace using `registerNamespace()` pattern from apikey-frontend

**Files Cleaned Up:**
- Deleted: `packages/flowise-template-mui/base/src/ui-components/{safe,json,markdown,editor,dialog}/index.js`
- Deleted: `packages/universo-i18n/base/src/locales/{en,ru}/views/executions.json` (duplicate)

**Files Modified:**
- `packages/flowise-executions-frontend/base/src/pages/NodeExecutionDetails.jsx` (lint fixes)
- `packages/flowise-executions-frontend/base/src/pages/Executions.jsx` (i18n integration)
- `packages/flowise-executions-frontend/base/src/i18n/index.ts` (registerNamespace pattern)
- `packages/flowise-executions-frontend/base/src/i18n/en/executions.json` (updated keys)
- `packages/flowise-executions-frontend/base/src/i18n/ru/executions.json` (updated translations)
- `packages/flowise-executions-frontend/base/src/index.ts` (i18n side-effect import)

**Build Validation:**
- ✅ `pnpm --filter @flowise/executions-frontend lint` - 0 errors
- ✅ `pnpm --filter @flowise/executions-frontend build` - SUCCESS
- ✅ `pnpm --filter @flowise/core-frontend build` - SUCCESS (~1m 35s)

**Remaining Work:**
- [ ] Manual runtime testing (navigate to Unik → Executions menu)
- [ ] E2E testing: create execution via AgentFlow, view details, share, delete

### AgentFlow Canvas UX Parity ✅

**Context:** Aligning AgentFlow UX with Flowise 3.0.12 inside the universal `spaces-frontend` canvas.

**Implemented:** Double-click on AgentFlow nodes opens a settings dialog (Flowise 3.x behavior).

**Files Modified / Added:**
- Added: `packages/spaces-frontend/base/src/views/canvas/EditNodeDialog.jsx`
- Added: `packages/spaces-frontend/base/src/utils/showHideInputParams.js`
- Updated: `packages/spaces-frontend/base/src/views/canvas/index.jsx` (wired `onNodeDoubleClick`)
- Updated: `packages/spaces-frontend/base/src/views/canvas/AgentFlowNode.jsx` (removed incorrect node-level dblclick handler)

**Build Validation:**
- ✅ `pnpm --filter spaces-frontend build` - SUCCESS
- ✅ Full workspace build (`pnpm build`) - SUCCESS

---

### Agent Executions Integration - Backend & API Client Complete ✅

**Context:** Integrating Agent Executions tracking from Flowise 3.0.12 into Universo Platformo. This feature allows tracking execution history for AgentFlow canvases with filtering, pagination, and public sharing capabilities.

**Runtime Hotfix (fresh DB migrations):**
- Root cause: TypeORM orders migrations by numeric timestamp in the migration class name.
- The original executions migration (`AddExecutions1734220800000`) ran before spaces/canvases (`AddSpacesAndCanvases1743000000000`) on a fresh DB, so the FK target table `public.canvases` did not exist.
- Fix: introduced `AddExecutions1743100000000` and updated `executionsMigrations` to export only the new migration.

**Implementation Overview:**

1. **Backend Package (`@flowise/executions-backend`)**:
   - Created new package with factory pattern architecture
   - Execution entity with ExecutionState enum (INPROGRESS, FINISHED, ERROR, TERMINATED, TIMEOUT, STOPPED)
   - Canvas foreign key relationship with CASCADE delete
   - Soft delete support (isDeleted, deletedDate columns)
   - PostgreSQL migration `1734220800000-AddExecutions.ts` (Phase 5, after spaces/canvases)
   - Service factory with Zod validation (executionFiltersSchema, updateExecutionSchema)
   - Router factory with 5 routes + error handler middleware
   - Routes: GET /, GET /:id, PUT /:id, DELETE /:id, DELETE / (bulk)

2. **Frontend Package (`@flowise/executions-frontend`)**:
   - Created package structure with tsdown dual-build (CJS + ESM)
   - Complete i18n translations (en/ru) for executions UI
   - Translation keys: title, filters, table columns, states, actions, details, share, delete
   - Frontend pages pending adaptation from Flowise 3.x (ExecutionDetails.jsx - 985 lines)

3. **Backend Integration**:
   - Registered Execution entity in `flowise-core-backend/entities/index.ts`
   - Added executionsMigrations to Phase 5 in `migrations/postgres/index.ts`
   - Created executionsService and executionsRouter in `flowise-core-backend/routes/index.ts`
   - Modified `spaces-backend/routes/spacesRoutes.ts` to accept executionsRouter option
   - Mounted routes at: `/spaces/:spaceId/canvases/:canvasId/executions` and `/canvases/:canvasId/executions`
   - Full route path: `/api/v1/unik/:unikId/spaces/:spaceId/canvases/:canvasId/executions`

4. **API Client Integration**:
   - Created `ExecutionsApi` class in `universo-api-client`
   - Methods: getExecutions, getExecutionById, getPublicExecutionById, updateExecution, deleteExecution, deleteExecutions
   - TanStack Query key factory: executionQueryKeys with all(), lists(), list(), details(), detail(), public()
   - Types: Execution, ExecutionState, GetExecutionsParams, GetExecutionsResponse, UpdateExecutionPayload, DeleteExecutionsPayload, DeleteExecutionsResponse
   - Instantiated in createUniversoApiClient: `executions: new ExecutionsApi(client)`

5. **i18n Integration**:
   - Added menu translations in `universo-i18n`: "executions" → "Executions" (en), "Исполнения" (ru)

**Build Fixes Applied:**
- Fixed entity property initializers (added `!` assertion for strictPropertyInitialization)
- Fixed ExecutionState export visibility (added re-export in services/index.ts)
- Fixed filter types in router (changed to `any` for Zod validation)
- Fixed tsconfig.esm.json declarationMap error (disabled when declaration is false)
- Fixed ExecutionsApi constructor (changed from `typeof client` to `AxiosInstance` type)

**Build Validation:**
- ✅ `@flowise/executions-backend` builds successfully
- ✅ `@flowise/executions-frontend` builds successfully
- ✅ `@universo/spaces-backend` builds successfully
- ✅ `@universo/api-client` builds successfully
- ✅ Full workspace build: 55 tasks in 4m 41s, all successful

**Files Created:**
- `packages/flowise-executions-backend/base/` (package.json, tsconfig, LICENSE-Flowise.md, README.md)
- `packages/flowise-executions-backend/base/src/database/entities/Execution.ts`
- `packages/flowise-executions-backend/base/src/database/migrations/postgres/1734220800000-AddExecutions.ts`
- `packages/flowise-executions-backend/base/src/services/executionsService.ts`
- `packages/flowise-executions-backend/base/src/routes/executionsRoutes.ts`
- `packages/flowise-executions-backend/base/src/index.ts`
- `packages/flowise-executions-frontend/base/` (package.json, tsconfig, LICENSE-Flowise.md, README.md)
- `packages/flowise-executions-frontend/base/src/i18n/en/executions.json`
- `packages/flowise-executions-frontend/base/src/i18n/ru/executions.json`
- `packages/flowise-executions-frontend/base/src/index.ts`
- `packages/universo-api-client/base/src/api/executions.ts`

**Files Modified:**
- `packages/flowise-core-backend/base/src/routes/index.ts` (added executionsService and executionsRouter creation)
- `packages/flowise-core-backend/base/src/database/entities/index.ts` (added Execution entity)
- `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts` (added executionsMigrations)
- `packages/spaces-backend/base/src/routes/spacesRoutes.ts` (added executionsRouter option and mounting)
- `packages/universo-api-client/base/src/client.ts` (added ExecutionsApi instantiation)
- `packages/universo-api-client/base/src/index.ts` (added executions exports)
- `packages/universo-i18n/base/src/locales/en/views/menu.json` (added "executions")
- `packages/universo-i18n/base/src/locales/ru/views/menu.json` (added "executions")

**Phase 5 Completed (2025-12-15):**
- ✅ Copied all execution pages from Flowise 3.0.12 to flowise-executions-frontend/base/src/pages/
- ✅ Adapted imports: @flowise/template-mui for UI components, @universo/api-client for API calls
- ✅ Created ExecutionsListTable component using MUI DataGrid
- ✅ Added useParams() for canvas routing context (unikId, spaceId, canvasId)
- ✅ Updated API calls to use api.executions.getExecutions(unikId, spaceId, canvasId, params)
- ✅ Full workspace build successful: 55 tasks in 4m 56s

**Next Steps:**
- [ ] Integrate executions pages into spaces-frontend routing
- [ ] Add Executions tab to Canvas view
- [ ] Manual runtime testing of executions UI
- [ ] End-to-end testing: create execution, view details, delete execution

**Technical Notes:**
- Migration order critical: executions table depends on canvases table (FK constraint)
- Router uses `mergeParams: true` to inherit :unikId, :spaceId, :canvasId from parent routes
- Service methods include canvas scoping to ensure execution isolation by canvas
- Soft delete pattern allows execution history recovery and audit trails
- TanStack Query keys support granular cache invalidation for list/detail views

---

## 📅 2025-12-14

### AgentFlow Icons - spaces-frontend Complete Implementation ✅

**Context:** Previous session added `AGENTFLOW_ICONS` to `flowise-template-mui`, but runtime still showed 500 errors on canvas. The `spaces-frontend` package (unified canvas for Universo) wasn't patched yet.

**Root Cause:**
- `spaces-frontend` has its own views: `AddNodes.jsx`, `CanvasNode.jsx`, `agentflows/index.jsx`, etc.
- These views were still requesting `/api/v1/node-icon/*Agentflow` for AgentFlow nodes
- AgentFlow nodes identified by upstream rule: `node.color && !node.icon` (have color but no icon property)
- `AGENTFLOW_ICONS` is an **array** (not object), requiring `.find()` lookup

**Technical Fix - Frontend:**

1. **AddNodes.jsx** (canvas node palette):
   - Added `renderNodeIcon(node)` helper
   - Uses `AGENTFLOW_ICONS.find((item) => item.name === node.name)` for lookup
   - Returns `<IconComponent size={30} color={color} />` for AgentFlow nodes
   - Returns `<img src="/api/v1/node-icon/...">` for standard nodes

2. **CanvasNode.jsx** (node rendering on canvas):
   - Same `renderNodeIcon(data)` pattern
   - Icon size 30px for AgentFlow, matches upstream

3. **agentflows/index.jsx** (list/grid preview):
   - Refactored `buildImageMap()` to return `{images, icons}` object
   - Added `[icons, setIcons]` state
   - Passes `icons` prop to ItemCard and FlowListTable

4. **canvases/index.jsx** (standard canvas list):
   - Same pattern as agentflows

5. **spaces/index.jsx** (spaces list with canvas previews):
   - `buildImagePreviewMap()` returns `{images, icons}`
   - Same state and prop passing pattern

6. **NodeInfoDialog.jsx** (flowise-template-mui):
   - Added conditional Tabler icon rendering for AgentFlow nodes

**Technical Fix - Backend:**

7. **routes/index.ts** (global error handler):
   - Now checks `(err as any).statusCode` before defaulting to 500
   - AgentFlow icon 404s now properly return 404 (not masked as 500)

**Files Modified (this session):**
- `packages/spaces-frontend/base/src/views/canvas/AddNodes.jsx`
- `packages/spaces-frontend/base/src/views/canvas/CanvasNode.jsx`
- `packages/spaces-frontend/base/src/views/agentflows/index.jsx`
- `packages/spaces-frontend/base/src/views/canvases/index.jsx`
- `packages/spaces-frontend/base/src/views/spaces/index.jsx`
- `packages/flowise-template-mui/base/src/ui-components/dialog/NodeInfoDialog.jsx`
- `packages/flowise-core-backend/base/src/routes/index.ts`

**Key Pattern (upstream-aligned):**
```javascript
import { AGENTFLOW_ICONS } from '@universo/template-mui'

const renderNodeIcon = (node) => {
    const agentflowEntry = node?.color && !node?.icon
        ? AGENTFLOW_ICONS.find((item) => item.name === node.name)
        : null
    
    if (agentflowEntry) {
        const IconComponent = agentflowEntry.icon
        return <IconComponent size={30} color={agentflowEntry.color} />
    }
    return <img src={`/api/v1/node-icon/${node.name}`} ... />
}
```

**Build Result:** ✅ All 54 tasks successful (~5m23s)

---

### AgentFlow Icons Fix for Flowise 3.0.12 ✅

**Context:** After Flowise 3.0.12 upgrade, AgentFlow section appeared in menu but all node icons returned 500 Internal Server Error from `/api/v1/node-icon/{nodeName}`.

**Root Cause Analysis:**
- Original Flowise components have `this.icon = 'filename.svg'` property pointing to actual SVG files
- AgentFlow nodes (Agent, LLM, Condition, etc.) do NOT have icon files - they never set `this.icon`
- API correctly throws 404 "icon not found" for AgentFlow nodes since there are no files
- Original Flowise UI uses `AGENTFLOW_ICONS` constant with @tabler/icons-react React components
- Our codebase was missing this constant and tried to load all icons via API

**Technical Fix:**
1. Added `AGENTFLOW_ICONS` constant to `flowise-template-mui/constants.ts` with 15 icon definitions:
   - conditionAgentflow, startAgentflow, llmAgentflow, agentAgentflow, humanInputAgentflow
   - loopAgentflow, directReplyAgentflow, customFunctionAgentflow, toolAgentflow
   - retrieverAgentflow, conditionAgentAgentflow, stickyNoteAgentflow, httpAgentflow
   - iterationAgentflow, executeFlowAgentflow

2. Updated `agentflows/index.jsx`:
   - Import `AGENTFLOW_ICONS` from template-mui
   - Refactored `buildImageMap()` to return `{images, icons}` object
   - Check node names against AGENTFLOW_ICONS before making API calls
   - Added `icons` state and pass to ItemCard/FlowListTable

3. Updated `ItemCard.jsx`:
   - Added `icons` prop support
   - Combined images and icons arrays for rendering
   - Render React icon components inline vs img tags for URL images

4. Updated `FlowListTable.jsx`:
   - Added `icons` prop support  
   - Same combined rendering approach as ItemCard

5. Upgraded `@tabler/icons-react` from ^2.32.0 to ^3.30.0 in flowise-template-mui to match Flowise 3.0.12

**Files Modified:**
- `packages/flowise-template-mui/base/src/constants.ts`
- `packages/flowise-template-mui/base/src/index.ts`
- `packages/flowise-template-mui/base/package.json`
- `packages/flowise-template-mui/base/src/ui-components/cards/ItemCard.jsx`
- `packages/flowise-template-mui/base/src/ui-components/table/FlowListTable.jsx`
- `packages/flowise-core-frontend/base/src/views/agentflows/index.jsx`

**Build Result:** ✅ All 54 tasks successful

---

## 📅 2025-12-11

### ESLint Configuration Upgrade ✅

**Context:** Fixed TypeScript ESLint compatibility warning by upgrading to supported versions.

**Technical Details:**
- Upgraded `@typescript-eslint/eslint-plugin` from 7.13.1 to 8.49.0
- Added `@typescript-eslint/parser` 8.49.0 (replacement for typescript-estree)
- Upgraded `eslint-plugin-unused-imports` from 2.0.0 to 4.3.0
- Updated ESLint configuration to use TypeScript overrides instead of global extends

**Results:**
- ✅ Eliminated "unsupported TypeScript version" warning (5.8.3 now supported)
- ✅ All TypeScript files now lint correctly with proper type checking
- ✅ No breaking changes to existing lint rules
- ✅ All packages maintain consistent linting standards

**Impact:** Development environment now runs cleanly without deprecation warnings, ensuring consistent code quality across the TypeScript codebase.

---

## December 2025

### 2025-12-13: Admin Roles Delete Dialog i18n Fix ✅

**Context**: Role deletion confirmation dialog showed raw i18n keys (`confirmDelete`, `confirmDeleteDescription`) instead of translated strings.

**Root Cause**: Role action descriptors used `createEntityActions()` defaults (`confirmDelete*`) while `admin-frontend` translations are nested under `admin.roles.*`.

**Fix**:
- Updated `admin-frontend` role actions to override `i18nKeys` to `roles.confirmDelete` and `roles.confirmDeleteDescription`.

**Result**:
- ✅ Role delete dialog now renders proper localized text.

### 2025-12-13: VLC → Localized Content Rename Refactoring ✅

**Context**: Comprehensive terminology refactoring to replace "VLC" (Versioned Localized Content) abbreviation with clearer "Localized Content" naming across types, utilities, database, API, and UI.

**Why**: "VLC" was an internal abbreviation that was not intuitive for developers. "Localized Content" better describes the purpose - managing multilingual content for entities.

**Technical Implementation**:

1. **Type System Updates** (`universo-types`):
   - `VlcSchemaVersion` → `LocalizedContentSchemaVersion`
   - `VlcLocaleEntry<T>` → `LocalizedContentEntry<T>`
   - Removed legacy aliases; new names only

2. **Utility Functions** (`universo-utils`):
   - `createVlc()` → `createLocalizedContent()`
   - `updateVlcLocale()` → `updateLocalizedContentLocale()`
   - `resolveVlcContent()` → `resolveLocalizedContent()`
   - `getVlcLocales()` → `getLocalizedContentLocales()`
   - `isVlc()` → `isLocalizedContent()`
   - Removed legacy aliases; new names only
   - Updated both `index.ts` and `index.browser.ts` exports

3. **Database Layer** (`admin-backend`):
   - Migration: Renamed columns `is_enabled_vlc` → `is_enabled_content`, `is_default_vlc` → `is_default_content`
   - Entity: Properties `isEnabledVlc` → `isEnabledContent`, `isDefaultVlc` → `isDefaultContent`

4. **Backend API**:
   - Public endpoint: `/api/v1/locales/vlc` → `/api/v1/locales/content`
   - Admin routes: All VLC references updated to "content" terminology
   - Zod schemas updated to use `isEnabledContent`, `isDefaultContent`

5. **Frontend Implementation** (`admin-frontend`):
   - `LocalesList.tsx`: Handlers renamed (`handleToggleContent`, `handleSetDefaultContent`)
   - `LocaleDialog.tsx`: Field order changed (nativeName first), nativeName now required, name optional
   - Query keys: `['locales', 'vlc', 'public']` → `['locales', 'content', 'public']`
   - API interface: `LocaleData.isEnabledVlc` → `isEnabledContent`

6. **i18n Updates**:
   - Menu: "Locales" → "Languages" (en), "Локали" → "Языки" (ru)
   - Admin columns: Shortened to "Content"/"UI" (en), "Контент"/"Интерфейс" (ru)
   - All locale-related translations updated

7. **Template Components** (`universo-template-mui`):
   - `LocalizedFieldEditor.tsx`: Uses new function names, fetches from `/content` endpoint
   - `RoleChip.tsx`: Import updated to `resolveLocalizedContent`

**Files Modified** (16 files):
- `universo-types/base/src/common/admin.ts`
- `universo-types/base/src/validation/vlc.ts`
- `universo-utils/base/src/vlc/index.ts`
- `universo-utils/base/src/index.ts`
- `universo-utils/base/src/index.browser.ts`
- `admin-backend/.../migrations/1734100000000-CreateLocalesTable.ts`
- `admin-backend/.../entities/Locale.ts`
- `admin-backend/.../routes/publicLocalesRoutes.ts`
- `admin-backend/.../routes/localesRoutes.ts`
- `admin-backend/.../schemas/index.ts`
- `admin-frontend/.../pages/LocalesList.tsx`
- `admin-frontend/.../components/LocaleDialog.tsx`
- `admin-frontend/.../api/localesApi.ts`
- `admin-frontend/.../i18n/en/admin.json`
- `admin-frontend/.../i18n/ru/admin.json`
- `universo-i18n/.../menu.json` (en + ru)
- `universo-template-mui/.../LocalizedFieldEditor.tsx`
- `universo-template-mui/.../RoleChip.tsx`

**Backward Compatibility**:
- ❌ No backward compatibility: deprecated aliases were removed as requested
- ✅ All internal usages updated to new names

**UI/UX Improvements** (user requested):
- ✅ "Native Name" field moved above "Name" field in locale dialog
- ✅ "Native Name" now required (for creating locales)
- ✅ "Name" now optional
- ✅ Column headers shortened from verbose text to concise "Content"/"UI"
- ✅ Menu terminology changed from "Locales" to "Languages"

---

### 2025-12-14: Dynamic Locales System ✅

**Context**: Implemented admin "Locales/Localizations" section for dynamic locale management, replacing hardcoded `en`/`ru` values in VLC (Versioned Localized Content) system.

**Technical Implementation**:

1. **Database Layer**:
   - Created `admin.locales` table with UUID v7, sortable codes
   - Fields: `id`, `code`, `name` (VLC), `nativeName`, `isEnabledVlc`, `isEnabledUi`, `isDefaultVlc`, `isDefaultUi`, `isSystem`, `sortOrder`
   - Partial unique indexes for enforcing single default locale per type
   - Seed data: `en` (English) and `ru` (Russian) as system locales

2. **Backend API**:
   - Admin CRUD: `GET/POST/PUT/PATCH/DELETE /api/v1/admin/locales` (auth required via `ensureGlobalAccess`)
   - Public API: `GET /api/v1/locales/vlc` and `/api/v1/locales/ui` (no auth, 5-min cache)
   - Zod schemas for validation: `CreateLocaleSchema`, `UpdateLocaleSchema`, `LocalesListQuerySchema`

3. **Type System Updates**:
   - Changed `SupportedLocale = 'en' | 'ru'` → `LocaleCode = string` (runtime validation)
   - Added `isValidLocaleCode()` utility function
   - Kept deprecated `SupportedLocale` alias for backward compatibility
   - Updated `VersionedLocalizedContent.locales` from `Partial<Record<...>>` to `Record<LocaleCode, ...>`
   - Updated VLC Zod schemas (`LocaleCodeSchema` now uses `z.string().min(2).max(10)`)

4. **Frontend Implementation**:
   - `LocalesList` page with DataGrid, toggle switches, search, pagination
   - `LocaleDialog` component for create/edit with VLC name editor
   - Updated `LocalizedFieldEditor` to fetch locales from API with fallback support
   - Route: `/admin/instance/:instanceId/locales`
   - Full i18n support (en/ru translations)

**Files Created** (9 files):
- `packages/admin-backend/base/src/database/migrations/postgres/1734100000000-CreateLocalesTable.ts`
- `packages/admin-backend/base/src/database/entities/Locale.ts`
- `packages/admin-backend/base/src/routes/localesRoutes.ts`
- `packages/admin-backend/base/src/routes/publicLocalesRoutes.ts`
- `packages/admin-frontend/base/src/api/localesApi.ts`
- `packages/admin-frontend/base/src/pages/LocalesList.tsx`
- `packages/admin-frontend/base/src/components/LocaleDialog.tsx`

**Files Modified** (14 files):
- Backend: entities/index.ts, migrations/postgres/index.ts, routes/index.ts, schemas/index.ts
- Core: flowise-core-backend routes/index.ts
- Types: universo-types admin.ts, vlc.ts
- Utils: universo-utils vlc/index.ts
- Frontend: queryKeys.ts, components/index.ts, MainRoutesMUI.tsx
- i18n: admin.json (en + ru)
- Template: LocalizedFieldEditor.tsx

**Architecture Decisions**:
- VLC locales separate from UI i18n (UI still requires file-based translations)
- System locales (en, ru) cannot be deleted, ensuring data integrity
- Public API without auth for LocalizedFieldEditor access in any context
- Backward compatibility maintained via deprecated type aliases

**Impact**:
- ✅ Admins can now add new VLC locales via UI (e.g., de, fr, es)
- ✅ LocalizedFieldEditor automatically shows all enabled VLC locales
- ✅ Type safety maintained with runtime validation
- ✅ Existing code using `SupportedLocale` continues to work

---

### 2025-12-11: UUID v7 QA Verification ✅

**Context**: Deep investigation and QA verification of UUID v7 implementation to ensure TypeORM compatibility and data integrity.

**QA Activities**:
1. **Database Schema Verification**: Queried `information_schema.columns` to confirm all 75+ tables have `DEFAULT uuid_generate_v7()` - ✅ Verified
2. **Data Integrity Check**: Sampled existing records from `admin.roles`, `metaverses.*`, `organizations.*` - all have UUID version 7 - ✅ Verified
3. **TypeORM Behavior Analysis**: 
   - Examined TypeORM source code (PostgresDriver, PostgresQueryRunner)
   - Confirmed `uuidGenerator` getter is used ONLY for DDL operations (CREATE/ALTER TABLE)
   - Verified TypeORM does NOT generate UUIDs client-side during INSERT
   - During `repository.save()` without id, TypeORM executes `INSERT ... RETURNING *` and PostgreSQL generates UUID via DEFAULT clause
4. **Configuration Audit**: Confirmed `synchronize: false` in DataSource prevents schema override
5. **Web Research**: Analyzed TypeORM GitHub issues (#11571, #7663) confirming default uuid_generate_v4() behavior and lack of custom UUID strategy support

**Findings**:
- ✅ `@PrimaryGeneratedColumn('uuid')` decorator is fully compatible with `uuid_generate_v7()` DEFAULT
- ✅ Raw SQL migrations successfully override TypeORM's default uuid_generate_v4() behavior
- ✅ No client-side UUID generation - all UUIDs generated by PostgreSQL
- ⚠️ Future warning: If using `typeorm migration:generate`, manually edit to use uuid_generate_v7()

**Documentation Updated**:
- `techContext.md`: Added "TypeORM Compatibility (QA Verified 2025-12-11)" section with detailed behavior explanation
- `activeContext.md`: Updated Current Focus to "UUID v7 QA Complete" with findings summary

**Outcome**: UUID v7 implementation verified as fully working. No code changes required.

---

### 2025-12-10: UUID v7 Migration ✅

**Context**: Migrated entire project from UUID v4 to UUID v7 for better database indexing performance (30-50% faster).

**Changes**:
1. **Infrastructure** (Stage 0): Created `@universo/utils/uuid` module with `generateUuidV7()`, `isValidUuid()`, `extractTimestampFromUuidV7()` functions. Updated TypeORM 0.3.6 → 0.3.28 (removed override). Added `uuidv7: ^1.1.0` to catalog.
2. **Database Function** (Stage 2): Added PostgreSQL `uuid_generate_v7()` function in first migration (`1733400000000-CreateAdminSchema.ts`).
3. **Migrations** (Stage 3): Updated 75 migration files - replaced `uuid_generate_v4()` and `gen_random_uuid()` → `public.uuid_generate_v7()`.
4. **Backend Services** (Stage 4): Updated 24 backend files - replaced `randomUUID()` from crypto and `{ v4 as uuidv4 } from 'uuid'` with `uuid.generateUuidV7()` from `@universo/utils`.
5. **Frontend** (Stage 5): Updated 7 frontend files - replaced `{ v4 as uuidv4 } from 'uuid'` with `{ uuidv7 } from 'uuidv7'`. Added UUID validation helper in `LoaderConfigPreviewChunks.jsx`.

**Technical Details**:
- UUID v7 format: 48-bit timestamp + 12-bit version/variant + 62-bit random
- Time-ordered nature improves B-tree index performance
- Database function uses PL/pgSQL with `gen_random_bytes()` and bitwise operations
- Backend packages use centralized `@universo/utils/uuid` module
- Frontend packages use direct `uuidv7` npm package for bundle size

**Files Modified**: 109 files across 25 packages (migrations: 75, backend: 24, frontend: 7, config: 3)

**Performance Impact**: Estimated 30-50% improvement in UUID primary key indexing operations based on industry benchmarks.

---

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

**@universo/template-mui lint**: `pnpm --filter @universo/template-mui lint` currently fails due to a mix of ESLint config/rule issues, a11y rules, and Prettier formatting. This appears pre-existing and does not block `pnpm build`, but may block CI if lint is enforced.

**React StrictMode**: Conditional wrapper (dev only) to avoid double-mount issues.

---

## Statistics

**Package Evolution**:
- August 2025: 25 packages
- November 2025: 46 packages
- December 2025: 52 packages (current)

**Build Performance**: Full workspace build ~4-6 minutes depending on cache state.

---

**Last Updated**: 2025-12-18

**Note**: For current work → tasks.md. For patterns → systemPatterns.md.
