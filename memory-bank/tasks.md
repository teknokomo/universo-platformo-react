# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### 2025-11-28: ApiKey Package Extraction ✅ COMPLETE

**Status**: All phases complete. Build successful (44/44 packages).

**Summary**: Extracted ApiKey functionality from flowise-server/flowise-ui into separate packages `@universo/flowise-apikey-srv` and `@universo/flowise-apikey-frt`. Following DI factory pattern from Tools/Credentials/Variables.

**Phase 1: Backend Package (flowise-apikey-srv)** ✅ COMPLETE
- [x] 1.1 Create package structure (package.json, tsconfig.json, index.ts)
- [x] 1.2 Create ApiKey entity with Unik relation
- [x] 1.3 Create migration `1720230151480-AddApiKey.ts` with hasTable checks
- [x] 1.4 Create apiKeyUtils (generateAPIKey, generateSecretHash, compareKeys)
- [x] 1.5 Create jsonStorage (full JSON storage support for dual mode)
- [x] 1.6 Create apikeyService with DI pattern and Zod validation (dual storage mode)
- [x] 1.7 Create apikeyRoutes with validation middleware
- [x] 1.8 Export ApiKey, apikeyMigrations, createApikeyService, createApikeyRouter

**Phase 2: Update flowise-server** ✅ COMPLETE
- [x] 2.1 Add @universo/flowise-apikey-srv to dependencies
- [x] 2.2 Import apikeyMigrations in migrations index (removed old AddApiKey import)
- [x] 2.3 Update entities/index.ts - import ApiKey from new package
- [x] 2.4 Update routes/index.ts - create apikeyService with DI, register router, add errorHandler
- [x] 2.5 Update validateKey.ts - use new service via lazy initialization
- [x] 2.6 Update routes/verify/index.ts - use new service
- [x] 2.7 Update index.ts - use getAPIKeysFromJson with getDefaultAPIKeyPath

**Phase 3: Frontend Package (flowise-apikey-frt)** ✅ COMPLETE
- [x] 3.1 Create package structure (package.json, index.ts)
- [x] 3.2 Copy APIKey, APIKeyDialog, UploadJSONFileDialog pages from flowise-ui
- [x] 3.3 Create i18n (en/ru) with registerNamespace pattern
- [x] 3.4 Export all pages and i18n resources

**Phase 4: API Client** ✅ COMPLETE
- [x] 4.1 Implement ApiKeyApi class in universo-api-client
- [x] 4.2 Export types and methods

**Phase 5: Update templates and routing** ✅ COMPLETE
- [x] 5.1 Add @universo/flowise-apikey-frt dependency to universo-template-mui
- [x] 5.2 Update MainRoutesMUI.tsx - import from new package
- [x] 5.3 Register i18n namespace via side-effect import

**Phase 6: Cleanup old files** ✅ COMPLETE
- [x] 6.1 Delete flowise-server routes/apikey, controllers/apikey, services/apikey
- [x] 6.2 Delete flowise-server utils/apiKey.ts
- [x] 6.3 Delete flowise-server database/entities/ApiKey.ts
- [x] 6.4 Delete flowise-server migration 1720230151480-AddApiKey.ts
- [x] 6.5 Delete flowise-ui views/apikey directory
- [x] 6.6 Delete api-keys.json from universo-i18n and spaces-frt
- [x] 6.7 Update universo-i18n/instance.ts - remove apiKeys imports

**Phase 7: Build & Testing** ✅ COMPLETE
- [x] 7.1 Run `pnpm build` - all 44 packages successful
- [ ] 7.2 Test migrations (USER - database)
- [ ] 7.3 Functional testing (USER - browser)

**Phase 8: QA Fixes** ✅ COMPLETE (2025-11-28)
- [x] 8.1 Run prettier fix on all backend files
- [x] 8.2 Fix critical useApi pattern bug in APIKey.jsx (wrap in arrow function)
- [x] 8.3 Unify ID format to UUID (Entity, Service, jsonStorage)
- [x] 8.4 Add replaceAll handling in importKeysToJson()
- [x] 8.5 Fix API response handling - check `createResp` directly, not `.data` (APIKeyDialog, APIKey, UploadJSONFileDialog)
- [x] 8.6 Run full project rebuild - 44/44 packages successful

---

### 2025-11-28: Variables Package Extraction ✅ COMPLETE (Pending Tests)

**Status**: Implementation complete, build successful (43/43 packages), user testing pending

**Summary**: Extract variables functionality from flowise-server/flowise-ui into separate packages `@universo/flowise-variables-srv` and `@universo/flowise-variables-frt`. Following QA-approved plan from plan mode.

**Phase 1: Backend Package (flowise-variables-srv)** ✅ COMPLETE
- [x] 1.1 Create package structure (package.json, tsconfig.json, index.ts)
- [x] 1.2 Create Variable entity with Unik relation (copied from flowise-server)
- [x] 1.3 Create migration `1702200925471-AddVariables.ts` with hasTable checks
- [x] 1.4 Create variablesService with DI pattern and Zod validation
- [x] 1.5 Create variablesRoutes with validation middleware
- [x] 1.6 Export Variable, variablesMigrations, createVariablesService, createVariablesRouter

**Phase 2: Update flowise-server** ✅ COMPLETE
- [x] 2.1 Add @universo/flowise-variables-srv to dependencies
- [x] 2.2 Import variablesMigrations in migrations index (removed old AddVariableEntity)
- [x] 2.3 Update entities/index.ts - import Variable from new package
- [x] 2.4 Update all utils files - buildCanvasFlow, buildAgentGraph, upsertVector, openai-realtime
- [x] 2.5 Update export-import service - use direct repository query (like Tools pattern)
- [x] 2.6 Update routes/index.ts - create variablesService with DI, register router

**Phase 3: Frontend Package (flowise-variables-frt)** ✅ COMPLETE
- [x] 3.1 Create package structure (package.json, tsconfig.json, index.ts)
- [x] 3.2 Copy Variables page from flowise-ui (Variables.jsx, AddEditVariableDialog.jsx, HowToUseVariablesDialog.jsx)
- [x] 3.3 Create i18n (en/ru) with registerNamespace pattern
- [x] 3.4 Export all pages and i18n resources

**Phase 4: Update templates and routing** ✅ COMPLETE
- [x] 4.1 Add @universo/flowise-variables-frt dependency to universo-template-mui
- [x] 4.2 Update MainRoutesMUI.tsx - import from new package instead of @/views/variables
- [x] 4.3 Register i18n namespace via side-effect import

**Phase 5: Cleanup old files** ✅ COMPLETE
- [x] 5.1 Delete flowise-server routes/variables, controllers/variables, services/variables
- [x] 5.2 Delete flowise-server database/entities/Variable.ts
- [x] 5.3 Delete flowise-server migration 1702200925471-AddVariableEntity.ts
- [x] 5.4 Delete flowise-ui views/variables directory
- [x] 5.5 Delete duplicate variables.json from spaces-frt i18n
- [x] 5.6 Delete variables.json from universo-i18n and update instance.ts, i18next.d.ts

**Phase 6: Build & Testing** ✅ BUILD COMPLETE
- [x] 6.1 Run `pnpm build` - 43/43 packages successful
- [ ] 6.2 Test migrations (USER - database)
- [ ] 6.3 Functional testing (USER - browser)

---

### 2025-11-28: QA Fixes - PR #566 Bot Review Comments ✅ COMPLETE

**Status**: All code fixes complete, build successful (42/42 packages)

**Summary**: Review and fix valid issues from Gemini Code Assist and Copilot code review

**Critical Issues (Fixed)**:
- [x] 1. Fix N+1 query / query builder reuse bug in `getAllCredentials` - used IN clause instead of loop
- [x] 2. Add UUID validation for credentialId in `getCredentialById`, `updateCredential`, `deleteCredential`

**Medium Issues (Fixed)**:
- [x] 3. Extract unikId/credentialId validation to middleware in routes
- [x] 4. Add specific error handling for encryption operation in `createCredential` and `updateCredential`
- [x] 5. Improve migration `down()` method with existence check

**Low / Nitpick Issues (Skipped - Low Priority)**:
- ⏭️ TypeScript noUnusedLocals/noUnusedParameters - Consistent with other packages in monorepo
- ⏭️ CredentialsTranslation interface specificity - Works as is, type safety not critical for JSON
- ⏭️ Error handling order consistency - Minor style preference

**False Positives (Already Valid)**:
- ✅ zod version 3.25.76 exists (verified via npm registry)
- ✅ decryptCredentialData callback has proper fallback logic

---

### 2025-11-28: QA Fixes - useApi Universal Response Handling ✅ COMPLETE

**Status**: All code fixes complete, build successful, user testing pending

**Summary**: Fixed useApi.jsx to support both legacy axios responses and modern @universo/api-client direct data responses.

**Root Cause**: `useApi.jsx` expected axios response format (`result.data`), but `@universo/api-client` methods already unwrap `.data` internally and return data directly. This caused `componentsCredentials` to be `undefined` in the Credentials dialog.

**Fix Applied**:
- [x] Modified `useApi.jsx` to detect response format automatically
- [x] Uses `result.data` if response has `.data` property (legacy axios)
- [x] Uses `result` directly if no `.data` property (modern API client)

**Build**: 42/42 packages successful ✅

---

### 2025-11-28: QA Fixes - Credentials API Migration ✅ COMPLETE

**Status**: All code fixes complete, build successful

**Summary**: Fixed Credentials page API method calls to use @universo/api-client method names

**Root Cause**: Credentials.jsx and related components used old flowise-ui API method names, but imported from @universo/api-client which has different method names.

**API Method Mapping Applied**:
| Old (flowise-ui) | New (@universo/api-client) |
|------------------|----------------------------|
| `getAllCredentials(unikId)` | `getAll(unikId)` |
| `getAllComponentsCredentials()` | `getAllComponents()` |
| `getSpecificCredential(unikId, id)` | `getById(unikId, id)` |
| `getSpecificComponentCredential(name)` | `getComponentSchema(name)` |
| `createCredential(unikId, body)` | `create(unikId, body)` |
| `updateCredential(unikId, id, body)` | `update(unikId, id, body)` |
| `deleteCredential(unikId, id)` | `delete(unikId, id)` |
| `getCredentialsByName(unikId, name)` | `getByName(unikId, name)` |

**Files Fixed**:
- [x] `flowise-credentials-frt/pages/Credentials.jsx` - getAll, getAllComponents, delete
- [x] `flowise-template-mui/CredentialInputHandler.jsx` - getComponentSchema
- [x] `flowise-template-mui/AddEditCredentialDialog.jsx` - getById, getComponentSchema, create, update
- [x] `flowise-template-mui/AsyncDropdown.jsx` - getByName

**Additional Fixes**:
- Removed `.data` wrapping (new API returns data directly)
- Fixed useApi wrapper to use arrow functions

**Build**: 42/42 packages successful ✅

---

### 2025-11-27: QA Fixes - useApi & i18n ✅ COMPLETE

**Status**: All code fixes complete, build successful

**Summary**: Fixed useApi shim, CredentialListDialog i18n, cleanup dead code

**Phase 1: Fix useApi hooks (Critical - Tools/Credentials not working)** ✅
- [x] 1.1 Update `hooks/index.ts` - export real hooks from `./hooks/` subfolder
- [x] 1.2 Delete shim files `useApi.js`, `useConfirm.js`
- [x] 1.3 Fix `index.ts` and `package.json` exports
- [x] 1.4 Fix 12 component files with relative imports

**Phase 2: Fix CredentialListDialog i18n** ✅
- [x] 2.1 Fix double namespace in `t()` calls (removed 'credentials.' prefix)

**Phase 3: Cleanup dead code** ✅
- [x] 3.1 Delete `up-admin/AdminPanel.jsx` (unused backend)
- [x] 3.2 Remove AdminPanel route from `MainRoutes.jsx`

**Phase 4: Verification** ✅
- [x] 4.1 Full build - 42/42 packages successful
- [ ] 4.2 Browser testing (USER)

---

### 2025-11-27: Credentials Package Extraction ✅ COMPLETE (Pending Tests)

**Status**: Implementation complete, user testing pending

**Summary**: Extract credentials functionality from flowise-ui/flowise-server into separate packages `@universo/flowise-credentials-srv` and `@universo/flowise-credentials-frt`.

**Phase 0: Prepare - Split Init migration** ✅
- [x] 0.1 Remove credential table creation from `Init.ts`
- [x] 0.2 Delete `1693997070000-ModifyCredential.ts`
- [x] 0.3 Remove ModifyCredential import from `migrations/postgres/index.ts`

**Phase 1: Backend Package (flowise-credentials-srv)** ✅
- [x] 1.1 Create package structure
- [x] 1.2 Create migration `1693891895165-AddCredentials.ts`
- [x] 1.3 Move and adapt Credential entity
- [x] 1.4 Create credentialsService with DI (encryptCredentialData, decryptCredentialData via config)
- [x] 1.5 Create credentialsRoutes factory (transformToCredentialEntity now internal)
- [x] 1.6 Export Credential, credentialsMigrations, createCredentialsService, createCredentialsRouter

**Phase 2: Update flowise-server** ✅
- [x] 2.1 Add @universo/flowise-credentials-srv to dependencies
- [x] 2.2 Import credentialsMigrations in migrations index
- [x] 2.3 Update entities/index.ts - import Credential from new package
- [x] 2.4 Update databaseEntities in utils/index.ts
- [x] 2.5 Delete old files (entity, service, controller, routes)
- [x] 2.6 Update routes/index.ts - create credentials service with DI, register router
- [x] 2.7 Update assistants, openai-assistants, openai-assistants-vector-store imports

**Phase 3: Frontend Package (flowise-credentials-frt)** ✅
- [x] 3.1 Create package structure
- [x] 3.2 Move credentials page from flowise-ui
- [x] 3.3 Create i18n (en/ru) with registerNamespace pattern
- [x] 3.4 Update exports

**Phase 4: Update templates and routing** ✅
- [x] 4.1 Add dependency to flowise-template-mui, universo-template-mui
- [x] 4.2 Update MainRoutesMUI.tsx with credentials route
- [x] 4.3 Register i18n namespace via side-effect import
- [x] 4.4 Add TypeScript module declarations

**Phase 5: Cleanup & Integration** ✅
- [x] 5.1 Delete old credentials from flowise-ui/views/credentials
- [x] 5.2 Delete credentials.json from universo-i18n locales (en/ru)
- [x] 5.3 Remove credentials imports from universo-i18n instance.ts
- [x] 5.4 Remove credentials from universo-i18n i18next.d.ts
- [x] 5.5 Full build `pnpm build` - 42/42 successful

**Phase 6: Testing** 🧪
- [ ] 6.1 Test migrations (USER - database)
- [ ] 6.2 Functional testing (USER - browser)

---

### 2025-11-27: Tools Package Extraction ✅ COMPLETE (Pending Tests)

**Status**: Implementation complete, user testing pending

**Summary**: Extract tools functionality from flowise-ui/flowise-server into separate packages.

**Phase 0: Prepare - Split Init migration** ✅
- [x] 0.1 Modify `1693891895163-Init.ts` - remove tool table creation
- [x] 0.2 Delete `1693997339912-ModifyTool.ts` from flowise-server
- [x] 0.3 Modify `1731200000000-AddUniksAndLinked.ts` - remove 'tool' from flowiseTables

**Phase 1: Backend Package (flowise-tools-srv)** ✅
- [x] 1.1 Create package structure
- [x] 1.2 Create consolidated migration `AddTools.ts`
- [x] 1.3 Create migrations export index
- [x] 1.4 Move and adapt Tool entity
- [x] 1.5 Create toolsService with DI
- [x] 1.6 Configure package.json exports

**Phase 2: Update flowise-server** ✅
- [x] 2.1 Import toolsMigrations in migrations index
- [x] 2.2 Update entities/index.ts - import Tool from new package
- [x] 2.3 Update utils/index.ts - databaseEntities
- [x] 2.4 Delete old files (entity, service, controller, routes)
- [x] 2.5 Update routes/index.ts
- [x] 2.6 Update export-import service

**Phase 3: Frontend Package (flowise-tools-frt)** ✅
- [x] 3.1 Create package structure
- [x] 3.2 Move Tools page from flowise-ui
- [x] 3.3 Update API Client with CRUD methods
- [x] 3.4 Update routes (MainRoutesMUI.tsx, MainRoutes.jsx)
- [x] 3.5 Add TypeScript module declarations

**Phase 4: Integration & Testing** ✅
- [x] 4.1 Build all packages (41/41 successful)
- [ ] 4.2 Test migrations (USER - database) 🧪
- [ ] 4.3 Functional testing (USER - browser) 🧪

**Phase 5: QA Bot Review Fixes** ✅
- [x] 5.1 Add missing @universo/flowise-tools-srv to template-mui dependencies
- [x] 5.2 Fix migration AddTools.ts - add PostgreSQL error codes for CREATE TABLE IF NOT EXISTS
- [x] 5.3 Remove 19 unused lazy imports from MainRoutes.jsx
- [x] 5.4 Add i18n support to flowise-tools-frt (en/ru translations migrated from universo-i18n)
- [x] 5.5 Register tools namespace in MainRoutesMUI.tsx
- [x] 5.6 Remove tools.json files from universo-i18n and update instance.ts

**Phase 6: Migration Architecture Refactoring** ✅
- [x] 6.1 Rename AddTools migration: 1748400000000 → 1693891895164 (right after Init)
- [x] 6.2 Simplify AddTools: only creates table, unik_id handled by AddUniksAndLinked
- [x] 6.3 Return 'tool' to flowiseTables in AddUniksAndLinked
- [x] 6.4 Move toolsMigrations right after Init in postgresMigrations array
- [x] 6.5 Fix importTools: don't mutate input array (create new objects)

**Phase 7: Remaining Bot Review Fixes** ✅
- [x] 7.1 Register toolsErrorHandler in flowise-server routes/index.ts
- [x] 7.2 Fix package.json: remove zod from devDependencies (duplicate)
- [x] 7.3 Remove redundant `typeof req.params === 'undefined'` checks in toolsRoutes.ts
- [x] 7.4 Keep `dbResponse.affected ?? undefined` (TypeORM returns null, not undefined) - ⚠️ False positive
- [x] 7.5 Improve type safety: use `Pick<Unik, 'id'>` instead of `as any` in toolsService.ts

---

### 2025-11-25: PR #560 Bot Comments QA ✅ COMPLETE
### 2025-11-26: DepartmentList.tsx Bug Fix ✅ COMPLETE

**Status**: Fixed copy-paste error in DepartmentList.tsx, all other List pages verified correct.

**Summary**: Organization edit was not working due to wrong method names in createDepartmentContext.

**Root Cause**: Copy-paste from PositionList.tsx left `updatePosition`/`deletePosition` instead of `updateEntity`/`deleteEntity`.

**Fixed Files**:
- [x] organizations-frt/DepartmentList.tsx - Changed `updatePosition` → `updateEntity`, `deletePosition` → `deleteEntity`

**Verified Correct** (no changes needed):
- [x] organizations-frt/OrganizationList.tsx ✅ (fixed in previous session)
- [x] organizations-frt/PositionList.tsx ✅ (correctly uses position methods)
- [x] projects-frt/ProjectList.tsx, MilestoneList.tsx, TaskList.tsx ✅
- [x] metaverses-frt/MetaverseList.tsx, SectionList.tsx, EntityList.tsx ✅
- [x] storages-frt/StorageList.tsx, ContainerList.tsx, SlotList.tsx ✅
- [x] campaigns-frt/CampaignList.tsx, ActivityList.tsx, EventList.tsx ✅
- [x] clusters-frt/ClusterList.tsx, ResourceList.tsx, DomainList.tsx ✅
- [x] uniks-frt/UnikList.tsx ✅

---

### 2025-01-26: useApi → useMutation QA Fixes ✅ COMPLETE

**Status**: All 4 QA recommendations implemented, build passed (40/40)

**Summary**: QA analysis identified remaining issues after main refactoring.

**Completed Tasks**:
- [x] 1. Migrate handleInviteMember to use mutation hooks (5 packages)
  - organizations-frt/OrganizationMembers.tsx ✅
  - projects-frt/ProjectMembers.tsx ✅
  - storages-frt/StorageMembers.tsx ✅
  - metaverses-frt/MetaverseMembers.tsx ✅
  - clusters-frt/ClusterMembers.tsx ✅
  - Note: campaigns-frt already uses useMemberMutations correctly
- [x] 2. Unify uniks-frt useMemberMutations API (added unikId parameter)
  - Also fixed UnikMember.tsx to use unified API
- [x] 3. Delete 7 unused useApi.ts files (spaces-frt kept - still used)
- [x] 4. Reviewed refreshList helpers - no action needed (part of ActionContext pattern)

---

### 2025-11-25: useApi → useMutation Refactoring ✅ COMPLETE

**Status**: All 8 packages migrated, full build passed

**Summary**: Replaced custom useApi hook with idiomatic useMutation from @tanstack/react-query.
**Architecture**: 1 consolidated `hooks/mutations.ts` per package (TkDodo colocation principle).

**Completed Packages** (7 with mutations.ts + 1 N/A):
- [x] campaigns-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] clusters-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] metaverses-frt ✅ - hooks/mutations.ts (12 hooks), lint/build passed
- [x] organizations-frt ✅ - hooks/mutations.ts (~340 lines), 4 pages updated
- [x] projects-frt ✅ - hooks/mutations.ts (~330 lines), 4 pages updated
- [x] storages-frt ✅ - hooks/mutations.ts (~330 lines), 4 pages updated
- [x] uniks-frt ✅ - hooks/mutations.ts (~160 lines), 2 pages updated
- [x] spaces-frt - N/A (no useApi usage)

**Total Changes**: ~20 page files updated, 7 mutations.ts created (~2000 lines)

---

### 2025-11-25: PR #560 Bot Comments QA ✅ COMPLETE

**Status**: All valid issues fixed, PR merged

**Summary**: QA analysis of Copilot and Gemini Code Assist comments on PR #560.

---

### 2025-11-25: AR.js Node Connections Mode Fix ✅ COMPLETE

**Status**: Implementation complete, browser testing pending 🧪

**Summary**: Fixed `quizState is not defined` error in Node Connections mode.
- File: `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts`
- Build: ✅ Full project (40/40 packages)
- Details: progress.md#2025-11-25

**Browser Testing (USER)** 🧪:
- [ ] Navigate to AR.js publishing page
- [ ] Set "Режим взаимодействия" to "Соединение узлов"
- [ ] Verify quiz displays correctly, no console errors

---

### 2025-01-22: Campaigns Integration ⏳ Phase 8/9

**Status**: Build fixes complete, menu integration in progress

**Summary**: Three-tier hierarchy (Campaigns → Events → Activities) following Metaverses/Clusters patterns.

**Completed Phases**:
- [x] Phase 1-7: Backend + Frontend + Routes + Menu + Breadcrumbs
- [x] Phase 8.1-8.16: Build error fixes (9 files, 22+ changes)

**Remaining**:
- [ ] Phase 9: Browser testing (USER) - CRUD operations, permissions, i18n

**Build Fixes Applied**:
- IconBullhorn → IconFlag
- createActivityActions → createEntityActions (3 files)
- BaseActivityMenu → BaseEntityMenu (4 files, 22 changes)

---

### 2025-01-20: PR #558 Storages QA ✅ COMPLETE

**Status**: Pushed to upstream PR #558

**Summary**: 17 bot recommendations validated, 9 fixed, 3 false alarms identified.

**Fixed**: Duplicate files deleted, copy-paste errors, BOM characters, unused code.

**False Alarms**: RLS filtering (correct by design), lazy router pattern (global).

---

## 🚧 IN PROGRESS

### 2025-01-19: Organizations Integration ⏸️ PAUSED

**Status**: Phases 1-8 complete, paused for ItemCard fix

**Summary**: Full backend + frontend integration ready.

**Remaining**: Phase 9 browser testing after ItemCard fix.

---

### 2025-11-22: ItemCard Click Handling ✅ 🧪 TESTING

**Status**: Implementation complete, browser testing pending

**Summary**: "Overlay Link" pattern implemented.

**Browser Tests** (USER):
- [ ] Card body click → navigation
- [ ] Menu button click → menu opens (no navigation)
- [ ] All modules: Organizations, Metaverses, Clusters, Projects

---

## 📦 DEFERRED

### Template MUI CommonJS Shims
- **Problem**: flowise-ui ESM/CJS conflict
- **Solution**: Extract to @universo package with dual build
- **Status**: DEFERRED

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

### 2025-11-25
- Compression Rules Enhancement ✅
  - Added trigger condition: compress ONLY files exceeding limits
  - Added minimum size requirement: ≥80% of limit after compression
  - Updated validation rubric with over-compression check
  - File: `.github/instructions/memory-bank-compression.instructions.md`
- QA Fixes & Documentation Cleanup ✅
- AR.js Node Connections Mode Fix ✅

### 2025-11-23-24
- Documentation Major Refactoring ✅
- Storages i18n Architecture Fix ✅

### 2025-11-22
- i18n Members & Tables Refactoring ✅
- ItemCard Click Handling Fix ✅
- PR #554 Fixes ✅
- Applications Documentation ✅

### 2025-11-17-18
- Projects Integration (23 issues fixed) ✅
- AR.js InteractionMode Persistence ✅
- Line Endings Normalization ✅

### 2025-11-14
- Cluster Breadcrumbs ✅
- Code Quality (Guards Factory) ✅
- PR #545 QA Fixes ✅

### 2025-11-13
- Uniks Refactoring (Stages 1-8) ✅
- UnikBoard Dashboard Expansion ✅
- Space Builder Namespace ✅

---

**Note**: For completed tasks older than 30 days, see progress.md.
