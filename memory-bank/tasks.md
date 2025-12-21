# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### MetaHubs Access Control (Restrict to Global Users) ✅

- [x] Add 'metahubs: Metahub' to CASL MODULE_TO_SUBJECT in AbilityContextProvider
- [x] Create migration for metahubs:* permission for superuser role
- [x] Add getMetahubsMenuItem() function to menuConfigs.ts (move from rootMenuItems)
- [x] Update MenuContent with MetaHubs section with divider (like Admin)
- [x] Add canAccessMetahubs to useHasGlobalAccess hook
- [x] Create MetahubGuard component (route protection)
- [x] Update MainRoutesMUI to use MetahubGuard for /metahubs routes
- [x] Full workspace rebuild successful (59 tasks)

### MetaHubs UI Runtime Crash Fix (/metahubs currentPage) ✅

- [x] Fix `MetahubList` to use `PaginationControls` API correctly (pass `pagination` + `actions`)
- [x] Fix `MetahubList` to use `FlowListTable` API correctly (`customColumns`, `renderActions`, `getRowLink`)
- [x] Rebuild `@universo/metahubs-frontend`
- [x] Rebuild `@flowise/core-frontend`
- [x] Run `@universo/metahubs-frontend` lint (clean)
- [x] Full workspace rebuild (`pnpm build`) to propagate changes

### MetaHubs UI Data Contract Fix (/metahubs d.map)

- [x] Normalize metahubs list API response shape (support `{ items, total, limit, offset }` payloads)
- [x] Align `MetahubBoard` entities query consumption with `PaginatedResponse` (`items` vs Axios `.data`)
- [x] Validate with `@universo/metahubs-frontend` lint/build and full `pnpm build`
- [x] Update memory bank (activeContext.md, progress.md)

### MetaHubs Module MVP (Metadata-Driven Entities) ✅

- [x] Create metahubs-backend package structure
- [x] Define TypeORM entities (Metahub, MetahubUser, SysEntity, SysField, UserDataStore)
- [x] Create migration with RLS policies + admin bypass
- [x] Implement Zod validation schemas
- [x] Create routes (metahubsRoutes, entitiesRoutes, recordsRoutes)
- [x] Create metahubs-frontend package structure
- [x] Define TypeScript types and API client
- [x] Create i18n translations (en/ru)
- [x] Create MetahubList and MetahubBoard pages
- [x] Create mutation hooks (CRUD for all resources)
- [x] Register backend in core-backend (entities, migrations, routes)
- [x] Register frontend routes in universo-template-mui
- [x] Add menu items and breadcrumbs support
- [x] Add i18n keys to universo-i18n menu files

### MetaHubs Post-Integration Build Fixes ✅

- [x] Break Turbo cycle: remove `@universo/metahubs-frontend` dependency from `@universo/template-mui`
- [x] Fix TS2352 casts in `@universo/metahubs-backend` routes (user claims extraction)
- [x] Fix TS1128 syntax/registry issue in `@flowise/core-backend` entities index (remove stray fragment, ensure `Canvas` + `SpaceCanvas` are registered)
- [x] Rebuild `@universo/metahubs-backend`
- [x] Rebuild `@flowise/core-backend`
- [x] Full workspace rebuild (`pnpm build`)

---

### PR #608 Bot Comments QA & Fixes ✅

- [x] Remove unused `executionsErrorHandler` import in flowise-core-backend routes
- [x] Remove unused `validationService` variable in flowise-core-backend routes
- [x] Remove unused `position` variable in AgentFlowNode.jsx
- [x] Remove unused `position` variable in IterationNode.jsx
- [x] DEFERRED: Move `showHideInputParams.js` to @universo/utils (architectural refactor, needs testing)
- [x] DEFERRED: Refactor `buildTreeData` in ExecutionDetails.jsx (architectural improvement, not a bug)
- [x] Run lints and builds to validate fixes
- [x] Update memory bank (progress.md, activeContext.md)

---

### AgentFlow Integration - Model Selection & Configuration

- [x] Remove spam log '[Canvas] URL params' from Canvas (line 148)
- [x] Add debug logs to AsyncDropdown (fetchDynamicOptions, loadOptions useEffect)
- [x] Add debug log when opening EditNodeDialog (node data keys, inputParams)
- [x] User tested and provided logs showing empty response from API
- [x] Analyzed logs: API returns empty array because `componentNodes` not passed to loadMethods
- [x] Fixed: Added `componentNodes: appServer.nodesPool.componentNodes` to options in getSingleNodeAsyncOptions
- [x] Added icon rendering (imageSrc) to AsyncDropdown renderOption
- [x] Created ConfigInput component for AgentFlow model configuration (based on Flowise 3)
- [x] Integrated ConfigInput into EditNodeDialog (shows when inputParam.loadConfig === true)
- [x] Fixed AsyncDropdown imageSrc transformation to full URL (`/api/v1/node-icon/${name}`)
- [x] Copied full ConfigInput from Flowise 3.0.12 (339 lines) with api.nodes.getSpecificNode
- [x] Created IterationNode component (resizable container for loops, 380 lines)
- [x] Created ConnectionLine component (animated edge with labels, 100 lines)
- [x] Updated AgentFlowNode to full Flowise 3 version (model/tools display, 570 lines)
- [x] Integrated new components into Canvas (nodeTypes, connectionLineComponent)
- [x] Full workspace build successful (57 tasks, 7m 53s)
- [x] Fixed ConfigInput not appearing immediately after provider selection (removed async API reload in second useEffect)
- [x] Fixed ConfigInput width and border-radius styling (added ml/mr margins, borderRadius '8px')
- [x] Added debug logs for Connect Credential investigation
- [x] Fix NodeInputHandler: correct CredentialInputHandler import + propagate input changes via onCustomDataChange
- [x] Fix credential dropdown empty value placeholder (AsyncDropdown value)
- [x] Remove temporary debug logs from ConfigInput (spaces-frontend)
- [x] Validate with builds/lints (template-mui, spaces-frontend) + full pnpm build
- [x] Fix: switching provider should refresh Connect Credential + Model Name option lists
  - Note: added remount keys to AsyncDropdown wrapper (node id + param name + current value), update reloadTimestamp on loadConfig select, and reset CredentialInputHandler when credentialNames changes.
  - Removed "hasLoaded" guard from AsyncDropdown so it reloads on each mount.
- [x] Implement: Messages section (Role + Content) in ConfigInput like Flowise 3.0.12
  - Note: created ArrayRenderer component, added 'array' to whitelistTypes in initNode, added array type rendering in NodeInputHandler.
  - Follow-up: existing saved canvases may still miss array params in node.inputParams (created before 'array' was whitelisted).
- [x] Fix: show Messages for existing nodes
  - Note: Temporary fix used EditNodeDialog to rehydrate missing array params (e.g., llmMessages) from componentNodes via initNode when opening the dialog.
- [x] Move array-param rehydration from EditNodeDialog to Canvas flowData loading
  - Note: Repair nodes on load (both Space and non-Space loaders, plus handleLoadFlow) by merging in missing array-type inputParams from componentNodes.
- [x] Remove EditNodeDialog array-param rehydration (keep the dialog side-effect free)
- [x] Validate AgentFlow config UX after migration
  - Note: Confirm Messages section appears for existing canvases without reopening dialogs; confirm provider switching + credential/model lists still update.
- [x] Validate with lints/builds
  - Note: Run `pnpm --filter spaces-frontend lint` and full `pnpm build`.

- [x] Fix focus loss while typing in input fields
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
  - [x] Add menu translation keys to universo-i18n (en: "Executions", ru: "Исполнения")
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

## ✅ RECENTLY COMPLETED (Last 30 Days)

**For detailed completion history, see progress.md**

### December 2025
- ✅ VLC→LocalizedContent rename refactoring (2025-12-15) - Renamed VLC terminology to Localized Content across types, utils, API
- ✅ Dynamic Locales System (2025-12-14) - Database-driven locale management for VLC
- ✅ Legacy code cleanup (2025-12-10)
- ✅ Global roles access implementation (2025-12-09)
- ✅ CASL standard compliance refactoring (2025-12-08)
- ✅ RBAC architecture cleanup (2025-12-07)
- ✅ Roles UI unification (2025-12-07)
- ✅ Admin Instances module MVP (2025-12-06)
- ✅ Dynamic global roles system (2025-12-05)
- ✅ User settings system (2025-12-04)
- ✅ Admin packages creation (2025-12-03)

### November 2025
- ✅ Campaigns integration (2025-11-26)
- ✅ Storages management (2025-11-25)
- ✅ Organizations module (2025-11-22)
- ✅ Projects management system (2025-11-18)
- ✅ Uniks module expansion (2025-11-13)

---

## 📊 PROJECT STATISTICS

**Current Package Count**: 52 packages

**Build Performance**: ~4-6 minutes (full workspace)

**Test Coverage**: TBD (tests not yet comprehensive)

---

## 🎯 ROADMAP (Tentative)

### Q1 2025
- [x] Admin module with RBAC
- [x] Global roles system
- [ ] Role-based UI customization
- [ ] Multi-tenancy support

### Q2 2025
- [ ] ABAC conditions implementation
- [ ] Advanced permission testing
- [ ] Performance optimization sprint
- [ ] Security audit & hardening

### Q3 2025
- [ ] Mobile app development
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Plugin/extension system

### Q4 2025
- [ ] AI-powered features
- [ ] Advanced automation workflows
- [ ] Enterprise features (SSO, LDAP)
- [ ] Compliance certifications (SOC 2, ISO 27001)

---

**Last Updated**: 2025-12-14

**Note**: For implementation details → progress.md. For patterns → systemPatterns.md.
