# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### Metahubs: Metadata-Driven Platform (1C-like) - 2025-06-22

Phase 1: Backend Entities - Replace old schema with new JSONB-based design

- [x] Modify `Metahub.ts` entity with VLC name/description, slug, isPublic
- [x] Create `Hub.ts` entity (replaces MetaSection) with metahubId FK, VLC fields, codename
- [x] Create `Attribute.ts` entity (replaces MetaEntity) with dataType enum, validationRules, uiConfig
- [x] Create `Record.ts` entity (HubRecord class) with hubId FK and JSONB data column
- [x] Update `entities/index.ts` - remove old exports, add Hub, Attribute, HubRecord
- [x] Delete junction table entities (MetaEntityMetahub, MetaSectionMetahub, MetaEntityMetaSection)
- [x] Replace migration `1766351182000-CreateMetahubsSchema.ts` with new schema
  - New schema: metahubs, hubs, attributes, records tables
  - GIN indexes for JSONB queries
  - RLS policies with public access for is_public metahubs
- [x] Run `pnpm --filter metahubs-backend lint` to validate TypeScript

Phase 2: Backend Routes - CRUD for new entities

- [x] Update `metahubsRoutes.ts` for new entity structure (VLC support, removed legacy endpoints)
- [x] Create `hubsRoutes.ts` for Hub CRUD
- [x] Create `attributesRoutes.ts` for Attribute CRUD
- [x] Create `recordsRoutes.ts` with generic JSONB validation
- [x] Create `publicMetahubsRoutes.ts` for read-only public API
- [x] Update `routes/index.ts` with new route exports
- [x] Update `guards.ts` - replace ensureSectionAccess/ensureEntityAccess with ensureHubAccess/ensureAttributeAccess
- [x] Update `src/index.ts` - export new entities and routes
- [x] Update tests - remove legacy entity references from mocks
- [x] Build passes: `pnpm --filter metahubs-backend build` ✅

Phase 3: Frontend Renaming and Updates

- [x] Update `types.ts` - add Hub, Attribute, HubRecord, Display types, helper functions
- [x] Create API clients: `hubs.ts`, `attributes.ts`, `records.ts`
- [x] Update `queryKeys.ts` with factories and invalidation helpers
- [x] Add mutation hooks in `mutations.ts` (9 new hooks)
- [x] Create `HubList.tsx` page with card/table views
- [x] Create `AttributeList.tsx` page with dataType chips
- [x] Create `RecordList.tsx` page with dynamic columns
- [x] Create action files: `HubActions.tsx`, `AttributeActions.tsx`, `RecordActions.tsx`
- [x] Update `menu-items/metahubDashboard.ts` - add hubs menu item
- [x] Update `index.ts` exports
- [x] Add i18n translations (EN/RU) for hubs, attributes, records
- [x] **Fix pagination data access** - extract `items` array from `PaginatedResponse` in HubList, AttributeList, RecordList
- [x] **Remove legacy routes** - deleted `/entities` and `/sections` redirects from MainRoutesMUI.tsx
- [x] Fix VLC type handling - add VersatileLocalizedContent interface and converters
- [x] Update MetahubList.tsx to use Display types and toMetahubDisplay converter
- [x] Update MetahubBoard.tsx to convert VLC to display strings
- [x] Fix breadcrumbs metahub name (template-mui) to handle VLC/SimpleLocalizedInput safely
- [x] Fix TypeScript: all components use Display types for UI rendering
- [x] Build verification: `pnpm build` successful ✅
- [x] Add menu translations in spaces-frontend
- [x] Fix TypeScript errors (Display types, align literals, readonly arrays)
- [x] Lint passes: 0 errors, 204 warnings ✅
- [x] Build passes: `pnpm --filter metahubs-frontend build` ✅
- [x] **Fix i18n consolidation** - added hubs/attributes/records sections to namespace consolidator
- [x] **Add breadcrumb hooks** - created useHubName and useAttributeName for nested entity paths
- [x] **Add navigation tabs** - ToggleButtonGroup in AttributeList/RecordList for switching views
- [x] Full build verification: `pnpm build --filter metahubs-frontend --filter universo-template-mui` ✅

Phase 4: Public API

- [x] Mount public routes at `/api/public/metahubs/:slug` (created publicMetahubsRoutes.ts)
- [ ] Test public read-only access

Phase 5: Testing and Documentation

- [x] Run full `pnpm build` to validate changes across workspace
- [x] **Fix RLS context persistence** - changed from transaction-local to session-scoped settings
- [x] **Fix role change breaking admin schema** - removed `SET role = 'authenticated'` (unnecessary for RLS)
- [ ] Manual runtime verification (pending user restart of dev server)
- [ ] Update README with new architecture

---

### Metahubs MVP: Copy-Refactor Implementation ✅

- [x] Phase 1: Literal File Copying
  - [x] Copy metaverses-backend → metahubs-backend (22 source files)
  - [x] Copy metaverses-frontend → metahubs-frontend (36 source files)
  - [x] Verify file counts match

### Metahubs: Align with Metaverses baseline (2025-12-22)

- [x] Stabilize Vitest/MSW baseline (shared)
  - [x] Add scoped override `msw>path-to-regexp` (keep global `path-to-regexp` pin for Express)
  - [x] Fix `@universo/i18n` JSON `exports` for `locales/*/common.json`
  - [x] Fix Vitest alias for transitive `@/views/*` imports
  - [x] Fix `@universo/utils` Vitest mock to preserve `publish` export
  - [x] Update Metaverses frontend tests to match paginated API contract (`{ items, pagination }`) and UI/i18n behavior
    - [x] SectionList: make error/empty assertions match real UI output (EmptyListState alt-text)
    - [x] SectionList: fix count/placeholder assertions to match rendered view (card vs list)
    - [x] MetaverseMembers: align mocks to `{ items, pagination }` and fix pagination selector (TablePagination)
    - [x] MetaverseList: align error/empty assertions and view-dependent expectations (card vs list)
    - [x] EntityList: align error UI + list view expectations (types/actions)
    - [x] MetaverseBoard: fix error-state test timeout (retry/timing/selectors)
    - [x] Re-run `pnpm --filter @universo/metaverses-frontend test` until green (incl. coverage thresholds)

  - [x] Fix `@universo/metaverses-frontend` coverage thresholds (70%)
    - [x] Remove unsupported Vitest helper usage in new tests (no `vi.isolateModules`)
    - [x] Prevent jsdom/canvas native dependency chain in exports test
    - [x] Add unit tests for low-coverage hooks/utilities to raise function/statement coverage
    - [x] Fix current failing coverage tests (MetaverseMembers invite role selector; SectionList zero-count assertion/localStorage bleed)
    - [x] Add targeted tests for low-coverage pages to raise function/line coverage (EntityList/MetaverseList/MetaverseMembers/SectionList)
    - [x] If needed, exclude non-runtime TS-only/config files from coverage collection (types.ts, tsdown.config.ts)
      - Note: Not needed; thresholds are met without exclusions.
    - [x] Re-run `pnpm --filter @universo/metaverses-frontend test` until thresholds pass

- [x] Align `@universo/metahubs-frontend` API paths with backend mounts
  - `/meta_entities|/meta_sections` → `/meta-entities|/meta-sections` (no legacy aliases)
- [x] Implement metahub-scoped API endpoints in `@universo/metahubs-backend`
  - `GET /metahubs/:metahubId/entities`
  - `GET /metahubs/:metahubId/sections`
  - Note: Backend API follows plural resource naming (like Metaverses).
- Note: Canonical UI URLs: `/metahubs` for list, `/metahub/:metahubId/*` for a single metahub. Avoid parallel UI alias routes.
- [x] Align UI routing/links to canonical Metahubs URLs
  - List page: `/metahubs`
  - Single metahub pages: `/metahub/:metahubId` (board) + `/metahub/:metahubId/entities|sections|access`
- [x] Stabilize `@universo/metahubs-frontend` tests (Vitest)
  - [x] Add Redux Provider to MetahubList/SectionList test wrappers (FlowListTable requires `state.customization.isDarkMode`)
  - [x] Fix EntityList tests to match real UI (EmptyListState alt-text, permissions-gated menus, remove invalid type assertions)
  - [x] Fix MetahubBoard error tests (handle duplicate translated error text + stable selectors)
  - [x] Fix MetahubList view-toggle persistence test (stable selector + assert exact `setItem` payload)
  - [x] Re-run `pnpm --filter @universo/metahubs-frontend test` until green

- [x] Fix `@universo/metahubs-frontend` coverage thresholds (70%)
  - [x] Add unit tests for low-coverage modules (apiClient/queryKeys/api wrappers/hooks/utils/components/entry exports)
    - Note: Added tests in `src/api/__tests__/apiClient.test.ts`, `src/api/__tests__/queryKeys.test.ts`, `src/api/__tests__/apiWrappers.test.ts`, `src/api/__tests__/useMetahubDetails.test.ts`, `src/hooks/__tests__/mutations.test.tsx`, `src/hooks/__tests__/useSearchShortcut.test.tsx`, `src/utils/__tests__/genericHelper.test.ts`, `src/components/__tests__/MetahubGuard.test.tsx`, `src/__tests__/exports.test.ts`.
  - [x] Re-run `pnpm --filter @universo/metahubs-frontend test` until thresholds pass
    - Note: Latest coverage (All files) is above thresholds: 78.69% statements, 82.7% branches, 72.64% functions, 78.69% lines.

- [x] Remove pagination debug logs from Metahubs UI pages

- [x] Fix Metahubs runtime regressions (backend + i18n)
  - [x] Fix `GET /metahubs/:metahubId/sections` 500 (TypeORM alias/join)
  - [x] Fix `GET /metahubs/:metahubId/entities` 500 (TypeORM alias/join)
  - [x] Fix Metahub Access page text rendering (i18n keys shown instead of translations)
  - Note: Backend joins rewritten in `packages/metahubs-backend/base/src/routes/metahubsRoutes.ts`.
  - Note: Members page i18n aligned with Metaverses pattern in `packages/metahubs-frontend/base/src/pages/MetahubMembers.tsx`.
  - Note: Coverage test updated to preserve `initReactI18next` and use stable dialog button selector.

- [x] Remove pagination debug logs from Metahubs UI pages
- [x] Validate quality gates
  - [x] `pnpm --filter @universo/metaverses-frontend test`
  - [x] `pnpm --filter @universo/metahubs-frontend test`
  - [x] `pnpm --filter @universo/metahubs-frontend lint`
  - [x] `pnpm --filter @universo/metahubs-backend lint`
  - [x] `pnpm build` (root)
- [ ] Manual runtime verification: Metahubs pages
  - Note: Confirm metahub legacy URLs (/entities, /sections) redirect to /hubs and Access page shows translations (no raw i18n keys).

### Metahubs: Fix sidebar menu after Hub/Attribute refactor (2025-12-23)

- [x] Replace Metahub sidebar items "Entities/Sections" with "Hubs" entry point
  - Note: Metahubs now uses Hub/Attribute/HubRecord; legacy MetaEntity/MetaSection menu items should not be exposed in metahub context.
- [x] Add safe redirects for legacy metahub URLs
  - Note: `/metahub/:metahubId/entities` and `/metahub/:metahubId/sections` redirect to `/metahub/:metahubId/hubs`.
- [x] Update sidebar menu i18n keys for the new items (EN/RU)
  - Note: Added `menu.hubs`, `menu.attributes`, `menu.records` in `@universo/i18n`.
- [x] Run full workspace build
  - Command: `pnpm build` (repo root).

### Metahubs: Metahub Sidebar Menu (2025-12-23)

- [x] Update Metahub sidebar menu items to match new architecture (Hubs entry point)
  - Note: Legacy "Entities" and "Sections" should not appear in Metahub context sidebar.
- [x] Update Metahub legacy routes to avoid crashes
  - Note: Keep legacy URLs (`/metahub/:metahubId/entities|sections`) working via redirect to `/hubs`.
- [x] Add `hubs` label in menu i18n (EN/RU)
- [x] Validate with full build
- [x] Align Metahubs Access UI with Metaverses
  - Note: Metahub Access/Members page now mirrors Metaverse UI (ViewHeader + ToolbarControls, card/list toggle, pagination controls).
  - Files: `packages/metahubs-frontend/base/src/pages/MetahubMembers.tsx`.
- [x] Update Metahubs Access tests for new UI
  - Files: `packages/metahubs-frontend/base/src/pages/__tests__/MetahubMembers.test.tsx`, `packages/metahubs-frontend/base/src/pages/__tests__/MetahubMembers.coverage.test.tsx`.
- [x] Re-run Metahubs frontend tests after Access refactor
  - Commands: `pnpm --filter @universo/metahubs-frontend test`.
  - [x] Fix `MetahubMembers.coverage.test.tsx` template-mui dialogs mock to preserve root exports
    - Note: `@universo/template-mui` exports map points `./components/dialogs` to `dist/index.mjs`, so mocking that subpath must include `usePaginated` and other root exports.
  - [x] Re-run `pnpm --filter @universo/metahubs-frontend test` until green
- [x] Re-run full workspace build after Access refactor
  - Command: `pnpm build` (run from repo root).
- [x] Remove unused `validationService` variable in flowise-core-backend routes
- [x] Remove unused `position` variable in AgentFlowNode.jsx

### Metahubs: Hubs list empty after DB reset (2025-12-23)

- [x] Diagnose why `GET /metahubs/:metahubId/hubs` returns empty `items` when rows exist
  - Note: Root cause was RLS context being applied as transaction-local settings (`SET LOCAL` / `set_config(..., true)`), so subsequent queries lost `auth.uid()` context and RLS filtered everything out.
- [x] Ensure metahub creation inserts membership row for the current user (owner/admin role)
  - Note: Verified `POST /metahubs` creates a `metahubs.metahubs_users` owner membership after creating the metahub.
- [ ] Validate hub/attribute/record list visibility under RLS (manual + logs)
- [x] Run full workspace build (`pnpm build`) after the fix

### Fix Metahubs Access page runtime bugs (2025-01-XX)

- [x] Fix member cards showing "Нет email" instead of actual email
  - Note: Backend `loadMembers` function uses raw `from('auth.users', 'u')` query instead of AuthUser entity
  - Action: Replace with `ds.manager.find(AuthUser, { where: { id: In(userIds) } })` pattern from Metaverses
  - File: `packages/metahubs-backend/base/src/routes/metahubsRoutes.ts`
  - Status: Fixed. Backend now uses proper AuthUser entity instead of raw query.
- [x] Fix "Администрирование" menu item appearing in Metahub context sidebar
  - Note: Should only appear in main app menu, not in metahub-specific sidebar
  - Action: Add metahub route handling to MenuList component
  - File: `packages/flowise-template-mui/base/src/layout/MainLayout/Sidebar/MenuList/index.jsx`
  - Status: Fixed. Added metahubMatch, metahubId, metahubPermissions state, useEffect hook, and conditional menu rendering.
- [ ] Manual verification after fixes
  - Verify member cards show actual emails in both card and table views
  - Verify sidebar shows only metahub-specific menu items (Dashboard, Entities, Sections, Access)

## ✅ Recently Completed (see progress.md for details)

  - Metahubs MVP copy-refactor, integration, and terminology purge (2025-12-22)
  - PR #608 bot-comments QA fixes
  - AgentFlow integration workstream
  - Note: Removed value-based remount key and synced Input internal state with prop value.
- [x] Fix Start node conditional fields rendering
  - Note: Apply show/hide rules on dialog open so form-only fields stay hidden for default Chat Input.
- [x] Validate fixes with lint/build
  - Note: `pnpm --filter @flowise/template-mui lint` + `pnpm --filter @universo/spaces-frontend lint` + full `pnpm build`.

### Agent Executions Integration (Flowise 3.x)

- [x] Phase 1: Backend Package (`flowise-executions-backend`)
  - [x] Create package structure and configuration files
  - [x] Copy and adapt Execution entity from Flowise 3.0.12
  - [x] Create migration for executions table
  - [x] Implement service factory with Zod validation
  - [x] Implement router factory with error handlers
  - [x] Create public exports (index.ts)
- [x] Phase 2: Frontend Package (`flowise-executions-frontend`)
  - [x] Create package structure and configuration files
  - [x] Create i18n translations (en/ru)
  - [x] Copy and adapt Executions.jsx page (464 lines)
  - [x] Copy ExecutionDetails.jsx page (985 lines)
  - [x] Copy remaining components (NodeExecutionDetails, PublicExecutionDetails, ShareExecutionDialog)
  - [x] Create ExecutionsListTable component with MUI DataGrid
- [x] Phase 3: Integration
  - [x] Register backend service and router in flowise-core-backend
  - [x] Mount routes in spaces-backend at `/spaces/:spaceId/canvases/:canvasId/executions`
  - [x] Register Execution entity in core-backend entities
  - [x] Register executionsMigrations in Phase 5 (after spaces/canvases)
  - [x] Add ExecutionsApi class to universo-api-client
  - [x] Add menu translation keys to universo-i18n (EN "Executions" + RU translation)
  - [x] Add LICENSE-Flowise.md to both packages
- [x] Phase 4: Build Validation
  - [x] Full workspace build (`pnpm build` - 55 tasks, 4m 41s)
  - [x] Fix TypeScript compilation errors (entity initializers, ExecutionState export, filter types, AxiosInstance import)
  - [x] Run linters on new packages (all passed: executions-backend, executions-frontend, api-client, spaces-backend, i18n)
- [x] Phase 5: Frontend Pages
  - [x] Copy all execution pages from Flowise 3.0.12 (Executions, ExecutionDetails, NodeExecutionDetails, PublicExecutionDetails, ShareExecutionDialog)
  - [x] Adapt imports to use @flowise/template-mui and @universo/api-client
  - [x] Create ExecutionsListTable component
  - [x] Add useParams for canvas context (unikId, spaceId, canvasId)
    - [x] Full workspace build successful (55 tasks, 4m 56s)

- [ ] Phase 6: Unik UI Integration
    - [x] Expose Executions in Unik UI (menu + route)
    - [x] Add Unik-level executions API endpoints (list/detail/update/delete)
    - [x] Fix Template MUI build resolution for executions-frontend route import
        - Note: `@universo/template-mui` depends on `@flowise/executions-frontend`; the route lazy import is suppressed for dts emit under TS `moduleResolution: bundler`.
    - [x] Prevent tsdown from bundling executions-frontend internals
        - Note: Externalized `@flowise/executions-frontend` in `packages/universo-template-mui/base/tsdown.config.ts`.
    - [x] Fix executions-frontend build compatibility (Vite strict exports)
        - Note: Full adaptation of NodeExecutionDetails.jsx from Flowise 3.0.12, replaced all @/ aliases, created SafeHTML/JSONViewer components
    - [x] Fix lint errors in NodeExecutionDetails.jsx
        - Note: Removed unused ToolIconFallback, fixed catch(e) to catch blocks
    - [x] Delete unnecessary index.js files in template-mui/ui-components
        - Note: Removed 5 redundant barrel export files (safe, json, markdown, editor, dialog)
    - [x] Integrate i18n for Executions page (en/ru translations)
        - Note: Added useTranslation hook, registerNamespace pattern, translated filters/states/actions/delete dialog
    - [x] Full workspace rebuild (`pnpm --filter @flowise/core-frontend build`) - SUCCESS
    - [ ] Manual runtime testing (start at Unik menu → Executions)
    - [ ] Test full E2E functionality (create execution via AgentFlow, view details, share, delete)

    ### Agents + Executions QA Hardening (Authz + Contracts + Lint)

    - [x] Enforce scope + membership for validation routes
      - Note: Validation must be unik/canvas-scoped and reuse the same membership enforcement pattern used by spaces-backend canvas routes.
    - [x] Enforce scope + membership for executions routes
      - Note: Executions list/detail/update/delete must be canvas-scoped and deny cross-canvas access.
    - [x] Align "public execution" contract (frontend route + api-client + backend)
      - Note: Share links use `/execution/:id` (no auth). API uses `/public-executions/:id`. Backend now mounts `/public-executions` and serves `GET /public-executions/:id`.
    - [x] Fix lint/Prettier issues in agents/executions packages
      - Note: Package lints for agents/executions/spaces backends no longer have blocking errors; full `pnpm build` succeeded.
    - [x] Triage/fix `@universo/template-mui` lint failures
      - Note: `pnpm --filter @universo/template-mui lint` now reports 0 errors (warnings only; previously included a11y `no-autofocus`, tests `aria-role`, Prettier formatting, invalid rule disables, `react/display-name`).
      - Note: Full workspace build `pnpm build` succeeded after the fixes.

    - [x] Re-verify executions/validation hardening after formatting
      - Note: Reviewed scoping/membership enforcement in the listed routes/services after lint/formatting changes; no regressions found.
      - Files:
        - `packages/spaces-backend/base/src/routes/spacesRoutes.ts`
        - `packages/flowise-executions-backend/base/src/database/migrations/postgres/1734220800000-AddExecutions.ts`
        - `packages/flowise-executions-backend/base/src/services/executionsService.ts`
        - `packages/flowise-executions-backend/base/src/routes/executionsRoutes.ts`

### Flowise 3.0.12 Full Package Replacement (Branch: feature/flowise-3.0.12-full-replacement)

- [x] Create branch from main, backup old package as flowise-components-2.2.8-backup
- [x] Copy new Flowise 3.0.12 components from .backup/Flowise-flowise-3.0.12/packages/components
- [x] Adapt build system (tsdown, remove gulpfile, update package.json)
- [x] Adapt source code (add missing bufferToUint8Array, add type annotation to getGcsClient)
- [x] Convert module.exports to ESM exports (106 credentials + 310 nodes)
- [x] Update CanvasType enum (add AGENTFLOW)
- [x] Build flowise-components package successfully
- [x] Update IServerSideEventStreamer implementations (8 new methods for AgentFlow + TTS)
- [x] Update storage function return types (addBase64FilesToStorage, addArrayFilesToStorage, removeFolderFromStorage)
- [x] Update streamStorageFile calls (add orgId parameter)
- [x] Full project build - SUCCESS (54 tasks)
- [x] Fix rolldown circular dependency issue (pin rolldown 1.0.0-beta.43 via pnpm.overrides)
- [x] Fix customtemplates-frontend dts generation (disable dts for JSON re-exports)

#### TSC Build Fix (Flowise 3.0.12 components)


- [x] Align root-level pnpm overrides/resolutions with Flowise 3.0.12 requirements (openai/@langchain/*)
	- Note: Current root pins force older versions (e.g., openai 4.82.0, @langchain/core 0.3.37, @langchain/openai 0.4.4) which breaks Flowise 3.0.12 types.
- [x] Revert tsdown/rolldown-only type hacks that break tsc (e.g., getGcsClient return type with missing Bucket)
- [x] Re-run `pnpm install` and rebuild `flowise-components` with `tsc && gulp`
- [ ] Fix `@flowise/core-backend` build errors introduced by OpenAI SDK vector stores API changes
    - Note: `openai.beta.vectorStores` no longer exists in openai >= 4.96; update code to `openai.vectorStores` and adjust types.
- [ ] Fix `buildCanvasFlow` follow-up prompts typing (Flowise components typing currently returns `{}`)
- [ ] Full workspace rebuild (`pnpm build`) to validate cross-package compatibility

#### AgentFlow Icons Fix (Flowise 3.0.12)

- [x] Investigate 500 errors for AgentFlow node icons
    - Root cause: AgentFlow nodes don't have icon files; they use built-in @tabler/icons-react components defined in AGENTFLOW_ICONS constant
- [x] Add AGENTFLOW_ICONS constant to flowise-template-mui/constants.ts
- [x] Update agentflows/index.jsx to use AGENTFLOW_ICONS for built-in icons instead of API calls
- [x] Update ItemCard component to support icons prop (React components)
- [x] Update FlowListTable component to support icons prop
- [x] Upgrade @tabler/icons-react from ^2.32.0 to ^3.30.0 in flowise-template-mui

##### Follow-up: Apply upstream AgentFlow icon rendering in spaces-frontend

- [x] Patch AgentFlow icons in spaces-frontend canvas palette (AddNodes)
    - Done: Added renderNodeIcon() helper using AGENTFLOW_ICONS.find() with upstream rule `node.color && !node.icon`
- [x] Patch AgentFlow icons in spaces-frontend canvas node renderer (CanvasNode)
    - Done: Same renderNodeIcon pattern applied
- [x] Patch AgentFlow icons in spaces-frontend agentflows list previews
    - Done: buildImageMap returns {images, icons}, ItemCard/FlowListTable receive icons prop
- [x] Patch AgentFlow icons in spaces-frontend canvases and spaces list previews
    - Done: Same pattern applied to canvases/index.jsx and spaces/index.jsx
- [x] Patch NodeInfoDialog to render AgentFlow icons
    - Done: Added conditional Tabler icon rendering
- [x] Fix backend global error handler to respect `statusCode` (avoid masking 404 as 500)
    - Done: Updated routes/index.ts error handler
- [x] Full workspace rebuild (`pnpm build`) and package lints for touched packages
    - Done: Build successful (54 tasks, ~5m23s)

- [x] Runtime testing (pnpm start)
    - Done: AgentFlow icons display correctly on canvas, palette, and lists

- [x] Cleanup and documentation
    - Done: Removed flowise-components-2.2.8-backup (20MB), updated Memory Bank
- [x] Commit changes to branch
    - Done: Changes committed and pushed to feature/flowise-3.0.12-full-replacement

### AgentFlow Features Integration (Flowise 3.0.12)

- [x] Phase 1: Chat Popup i18n Fix
  - [x] Create i18n structure in flowise-chatmessage-frontend (locales/en,ru + registerNamespace)
  - [x] Add side-effect import in index.js
  - [x] Add onOpenChange callback for ValidationPopUp coordination
  - [x] Rebuild and verify

- [x] Phase 2: flowise-agents-backend Package
  - [x] Create package structure (services, routes, types, index.ts)
  - [x] Adapt validation service from Flowise 3.0.12 (329 lines → 300 lines)
  - [x] Create validation router with GET /validation/:canvasId
  - [x] Register validation router in core-backend with lazy componentNodes getter

- [x] Phase 3: flowise-agents-frontend Package
  - [x] Create package structure with i18n
  - [x] Adapt ValidationPopUp component (302 lines → 310 lines TypeScript)
  - [x] Add ValidationApi to universo-api-client
  - [x] Integrate ValidationPopUp into canvas (conditional render for AgentFlow)
  - [x] Fix isAgentCanvas detection to check canvas.type (MULTIAGENT/AGENTFLOW) not just URL
  - [x] Style ValidationPopUp FAB with teal color like Flowise

- [x] Phase 4: Universal Canvas with AgentFlow Node Rendering
  - [x] Create AgentFlowNode.jsx (compact node with colored border, toolbar)
  - [x] Create AgentFlowEdge.jsx (gradient edge with hover delete button)
  - [x] Create StickyNoteNode.jsx (simple note node with color)
  - [x] Create nodeTypeHelper.js utility (getNodeRenderType, normalizeNodeTypes, isAgentFlowNode, getEdgeRenderType)
  - [x] Update canvas to use universal nodeTypes/edgeTypes registry
  - [x] Update onDrop logic to use getNodeRenderType (based on node data, not canvas type)
  - [x] Update onConnect to use getEdgeRenderType (based on connected nodes)
  - [x] Update handleLoadFlow and hydrateGeneratedGraph to normalize node types
  - [x] Add hasAgentFlowNodes useMemo for ValidationPopUp condition
  - [x] Update ValidationPopUp condition from isAgentCanvas to hasAgentFlowNodes
  - [x] Fix ESLint/prettier errors in new components
  - [x] Implement AgentFlow node settings on double-click (Flowise 3.x behavior)
    - Note: Canvas-level `onNodeDoubleClick` opens `EditNodeDialog`.
  - [x] Add show/hide input params logic for the AgentFlow edit dialog
    - Note: Ported `showHideInputParams` logic (upstream) to keep conditional inputs in sync.
  - [ ] Full workspace build and runtime test
    - [x] Full workspace build (`pnpm build`)
    - [ ] Manual runtime test (`pnpm start`)
  - [ ] Test universal canvas with mixed node types (standard + AgentFlow)

- [ ] Phase 5: Testing & Polish (FUTURE)
  - [ ] Full E2E test: create AgentFlow → add nodes → validate → run
  - [ ] Test ValidationPopUp visibility coordination with ChatPopUp
  - [ ] Update Memory Bank documentation

### Memory Bank Maintenance

- [x] Fixed TypeScript ESLint compatibility warning (upgraded to v8.x)
- [ ] Review and update Memory Bank files monthly
- [ ] Archive old progress entries (>6 months) when files exceed limits
- [ ] Update version table in progress.md when new releases published

---

## 📋 PLANNED FEATURES (Backlog)

### Admin Module Enhancements

- [ ] Implement role cloning feature (duplicate existing role)
- [ ] Add role templates (predefined permission sets)
- [ ] Implement permission inheritance system
- [ ] Add audit log for role/permission changes
- [ ] Multi-instance support (remote instances management)

### RBAC System Improvements

- [ ] Implement ABAC conditions system (time-based, IP-based, resource-based)
- [ ] Add permission testing UI (simulate user permissions)
- [ ] Implement permission delegation (temporary access grants)
- [ ] Add custom permission subjects via UI

### Frontend UX

- [ ] Implement dark mode theme
- [ ] Add keyboard shortcuts system
- [ ] Improve mobile responsiveness
- [ ] Add tour/onboarding system for new users

### Performance Optimization

- [ ] Implement server-side caching strategy
- [ ] Add CDN integration for static assets
- [ ] Optimize bundle size (code splitting)
- [ ] Database query optimization audit

### Documentation

- [ ] Complete API documentation (OpenAPI specs)
- [ ] Add architecture decision records (ADR)
- [ ] Create video tutorials for key features
- [ ] Write migration guide for breaking changes

---

## 🧪 TECHNICAL DEBT

### Code Quality

- [ ] Refactor remaining useApi usages → useMutation pattern
- [ ] Standardize error handling across all packages
- [ ] Add unit tests for critical business logic
- [ ] Add E2E tests for key user flows

### Architecture Cleanup

- [ ] Resolve Template MUI CommonJS/ESM conflict (extract to @universo package)
- [ ] Audit and remove unused dependencies
- [ ] Consolidate duplicate utility functions
- [ ] Standardize TypeScript strict mode across all packages

### Database

- [ ] Add database connection pooling optimization
- [ ] Implement database backup automation
- [ ] Add migration rollback testing
- [ ] Optimize RLS policies performance

---

## 🔒 SECURITY TASKS

- [ ] Implement rate limiting for all API endpoints
- [ ] Add CSRF protection
- [ ] Implement API key rotation mechanism
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Conduct security audit
- [ ] Implement 2FA/MFA system

---


## ✅ Recently Completed (Archive)

- ✅ Metahubs MVP copy-refactor + navigation + runtime fixes (2025-12-22–2025-12-23). Details: progress.md
- ✅ PR #608 bot QA fixes (2025-12-18). Details: progress.md
- ✅ AgentFlow integration + QA hardening (2025-12-15–2025-12-18). Details: progress.md

<!-- Keeping tasks.md focused: long roadmap/statistics moved out of this file. -->
