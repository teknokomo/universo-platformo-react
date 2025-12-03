# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## ✅ COMPLETED: Package Naming Refactoring (2025-01-22)

**Goal**: Rename and restructure core Flowise packages with modern naming conventions.

**Changes**:
- `packages/flowise-ui` → `packages/flowise-core-frontend/base` ("@flowise/core-frontend")
- `packages/flowise-server` → `packages/flowise-core-backend/base` ("@flowise/core-backend")
- `packages/flowise-components` → `packages/flowise-components/base` (added base/ structure)
- `packages/universo-api-client` → `packages/universo-api-client/base` (added base/ structure)

**Tasks Completed**:
- [x] Create base/ structure for all 4 packages
- [x] Update package.json names and dependencies
- [x] Update getNodeModulesPackagePath call in index.ts
- [x] Update all documentation and agent instructions
- [x] Fix tsconfig.json files - added `"types": ["node"]` to ~50 packages
- [x] Fix vite.config.js paths for node_modules resolution
- [x] Build: 50/50 successful

Details: progress.md#2025-01-22

---

## ✅ COMPLETED: Zod Validation Schemas for spaces-backend (2025-01-20)

**Summary**: Added Zod validation schemas to `spaces-backend`, replacing verbose manual validation.

**Results**:
- Created `packages/spaces-backend/base/src/schemas/index.ts` (~220 lines)
- Refactored `spacesController.ts` from ~750 lines to ~515 lines (~30% reduction)
- Schemas: CreateSpaceSchema, UpdateSpaceSchema, CreateCanvasSchema, UpdateCanvasSchema, etc.
- Helper functions: `extractUnikId()`, `formatZodError()`, `validateBody()`, `safeValidateBody()`

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: System Status Fields for Spaces & Canvases (2025-01-20)

**Summary**: Added versioning and status fields to Spaces and Canvases.

**Database Changes**:
- Spaces: 9 new columns (version_group_id, version_uuid, version_label, version_index, is_active, is_published, is_deleted, deleted_date, deleted_by)
- Canvases: 4 new columns (is_published, is_deleted, deleted_date, deleted_by)
- Partial indexes for performance
- RLS policies updated to exclude deleted records

**Migration Consolidation**:
- Deleted `1743000000003-FixActiveVersions.ts` (merged into main migration)
- Main migration now has 10-step idempotent process

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: Canvas Versions API Client (2025-01-20)

**Summary**: Added `api.canvasVersions` to @universo/api-client.

**Methods**: `list`, `create`, `update`, `activate`, `remove`
**Types**: `CanvasVersion`, `CreateCanvasVersionPayload`, `UpdateCanvasVersionPayload`

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: Canvases Migration Consolidation (2025-01-20)

**Summary**: Consolidated 7 chat_flow migrations from flowise-server into spaces-backend.

**Changes**:
- Renamed ChatflowType → CanvasType throughout codebase
- Deleted 7 old migrations from flowise-server
- Cleaned up legacy code (IActiveChatflows, validateChatflowAPIKey, getUsedChatflowNames)
- Rewrote flowise-server migrations index with documented phase order

Details: progress.md#2025-01-20

---

## ✅ COMPLETED: CustomTemplates Package Extraction (2025-01-19)

**Summary**: Extracted CustomTemplate (Marketplace) functionality.

**Packages Created**:
- `@flowise/customtemplates-backend`: entity, migration, DI service, exports
- `@flowise/customtemplates-frontend`: Templates pages, i18n (en/ru)

**API Client**: `MarketplacesApi` with getAllTemplates, getAllCustom, saveCustom, deleteCustom

**Integration**:
- flowise-server: imports from @flowise/customtemplates-backend
- universo-template-mui: routes and menu added
- Naming migration: Marketplaces → Templates complete

Build: 50/50 successful. Details: progress.md#2025-01-19

---

## ✅ COMPLETED: QA Cleanup - Remove Duplicates (2025-01-19)

**VectorStore Dialogs**:
- Deleted 4 duplicate files from template-mui
- Updated imports in spaces-frontend to use @flowise/docstore-frontend

**Marketplaces**:
- Deleted `flowise-ui/src/views/marketplaces/`
- Updated CanvasRoutes.jsx, ExportAsTemplateDialog.jsx

Details: progress.md#2025-01-19

---

## ✅ COMPLETED: DocumentStore Full Migration (2025-12-01-02)

**Summary**: Full extraction to @flowise/docstore-backend and @flowise/docstore-frontend.

**Backend (@flowise/docstore-backend)**:
- 3 entities: DocumentStore, DocumentStoreFileChunk, UpsertHistory
- 4 DI services: documentStoreService, chunkService, loaderService, vectorStoreConfigService
- Consolidated migration: 1711637331047-AddDocumentStore.ts
- Controller and Router for basic CRUD

**Frontend (@flowise/docstore-frontend)**:
- 20 JSX files (~7254 lines)
- Merged i18n (document-store + vector-store = 600 lines)

**Integration**:
- Clean Integration pattern: CRUD delegates to DI, complex ops stay in flowise-server
- Fixed 403 error on Preview & Process
- Fixed i18n interpolation: `{var}` → `{{var}}`

Build: 48/48 successful. Details: progress.md#2025-12-01

---

## ✅ COMPLETED: Package Extractions (2025-11-27-29)

**ChatMessage** (2025-11-29):
- @universo/flowise-chatmessage-backend: ChatMessage + Feedback entities, consolidated migration
- Full DI pattern with createChatMessagesService, createFeedbackService factories
- Utility wrappers for buildCanvasFlow compatibility
- Deleted 10 legacy migrations from flowise-server

**Leads** (2025-11-29):
- @universo/flowise-leads-backend: Lead entity, DI service, routes
- @universo/flowise-leads-frontend: minimal (namespace exports only)
- Fixed critical bugs in ChatMessage.jsx and Analytics.jsx

**Assistants** (2025-11-28):
- @universo/flowise-assistants-backend: Assistant entity, consolidated migration
- @universo/flowise-assistants-frontend: 8 JSX pages, i18n
- Optional dependencies via DI config
- Fixed cyclic dependency via peerDependency

**ApiKey** (2025-11-28):
- @universo/flowise-apikey-backend: dual storage mode (JSON + DB)
- @universo/flowise-apikey-frontend: 3 pages, i18n
- UUID for IDs throughout

**Variables** (2025-11-28):
- @universo/flowise-variables-backend: DI pattern with Zod validation
- @universo/flowise-variables-frontend: 3 pages, i18n

**Credentials** (2025-11-27):
- @universo/flowise-credentials-backend: encryption via DI callbacks
- @universo/flowise-credentials-frontend: Credentials page, i18n

**Tools** (2025-11-27):
- @universo/flowise-tools-backend: DI service with telemetry
- @universo/flowise-tools-frontend: Tools page
- Migration order: Init → Tools → Credentials

All packages use DI pattern, consolidated migrations, Zod validation.
User testing pending for all.

Details: progress.md#2025-11-27, progress.md#2025-11-28, progress.md#2025-11-29

---

## ✅ COMPLETED: QA Fixes & Refactoring (2025-11-25-28)

**useApi → useMutation Refactoring**:
- 7 packages migrated (campaigns, clusters, metaverses, organizations, projects, storages, uniks)
- Consolidated `hooks/mutations.ts` per package (~2000 lines total)
- Deleted 7 unused useApi.ts files

**PR Bot Review Fixes**:
- PR #560: campaigns-backend displayName, unused variables
- PR #564: toolsErrorHandler registration, package.json cleanup
- PR #566: N+1 query fix, UUID validation, error handling

**AR.js Node Connections Mode**:
- Fixed `quizState is not defined` error
- Changed nested template literal to string concatenation

**useApi Shim Fix**:
- Fixed flowise-template-mui hooks exports
- Deleted stub files, fixed 12 relative imports

Details: progress.md#2025-11-25

---

## 🚧 IN PROGRESS

### Campaigns Integration (Phase 8/9)

**Status**: Build fixes complete, menu integration done.

**Completed**:
- [x] Phase 1-7: Backend + Frontend + Routes + Menu + Breadcrumbs
- [x] Phase 8: Build error fixes (9 files, 22+ changes)

**Remaining**:
- [ ] Phase 9: Browser testing (USER) - CRUD operations, permissions, i18n

---

### Organizations Integration (PAUSED)

**Status**: Phases 1-8 complete, paused for ItemCard fix.

**Remaining**:
- [ ] Phase 9: Browser testing after ItemCard fix

---

### ItemCard Click Handling 🧪

**Status**: "Overlay Link" pattern implemented.

**Pattern**:
- RouterLink replaced with Link overlay (z-index: 5)
- Menu button z-index: 10 (above link)
- Prevents navigation on menu click

**Tests** (USER):
- [ ] Card body click → navigation
- [ ] Menu button click → menu opens (no navigation)
- [ ] Verify in: Organizations, Metaverses, Clusters, Projects

---

### Browser Testing Backlog 🧪

**Pending user verification**:
- [ ] Package extractions (ChatMessage, Leads, Assistants, ApiKey, Variables, Credentials, Tools)
- [ ] DocumentStore migration functional testing
- [ ] AR.js Node Connections Mode
- [ ] Templates page after CustomTemplates extraction

---

## 📦 DEFERRED

### Template MUI CommonJS Shims
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Status**: Low priority, workarounds in place

---

## ✅ HISTORICAL TASKS (Before November 2025)

For completed tasks before November 2025, see progress.md:
- October 2025: Rate limiting, i18n migration, tsdown build system
- September 2025: AR.js configuration, TanStack Query, cluster isolation
- August 2025 and earlier: Space Builder MVP, Metaverse module, Flowise integration

---

**Note**: For implementation details, see progress.md. For patterns, see systemPatterns.md.

---

## ✅ COMPLETED: Earlier November Tasks

### 2025-11-25: Compression Rules Enhancement ✅
- Added trigger conditions: compress ONLY files exceeding limits
- Added minimum size requirement: ≥80% of limit after compression
- Updated validation rubric with over-compression check

### 2025-11-24: Documentation Major Refactoring ✅
- Configuration docs: 22 files synced EN→RU
- Integrations docs: 249 files synced
- Applications docs: Main README rewritten (593→234 lines)
- Created 4 new module pages (Organizations, Clusters, Projects, Spaces)

### 2025-11-23: Storages i18n Architecture Fix ✅
- Removed duplicates from storages.json
- Removed module-specific keys from common.json
- Fixed translation function usage

### 2025-11-22: i18n Members & Tables Refactoring ✅
- Centralized `members` keys in common.json
- Decentralized module-specific table keys
- Updated 16+ files across 5 modules

### 2025-11-17-18: Projects Integration ✅
- 23 issues fixed (11 QA + 12 runtime)
- Router registered, all pages loading
- Terminology consistency: "Milestones" label unified in Russian UI

### 2025-11-14: Code Quality & Clusters ✅
- Created `createAccessGuards` factory (auth-backend)
- Fixed M2M logic in ensureSectionAccess
- Cluster breadcrumbs with useClusterName hook

### 2025-11-13: Uniks Refactoring ✅
- Route cleanup, type definitions updated
- Backend: spacesCount/toolsCount metrics
- UnikBoard dashboard: 3 → 7 metric cards

---

## 📋 Task Management Guidelines

### Task States
- `[ ]` - Not started / Pending
- `[x]` - Completed
- `🚧` - In progress
- `🧪` - Awaiting user testing
- `⏸️` - Paused

### Task Format
```markdown
## ✅ COMPLETED: [Feature Name] (YYYY-MM-DD)

**Summary**: One-line description.

**Key Changes**:
- Change 1
- Change 2

**Build**: X/X successful
Details: progress.md#YYYY-MM-DD
```

### Archival Rules
- Tasks >60 days: Move to progress.md, keep 1-line summary here
- Tasks 15-60 days: Condense to summary format
- Tasks <15 days: Keep full details

---

## 🔗 Cross-References

### Related Files
- **progress.md**: Chronological completion log
- **systemPatterns.md**: Architectural patterns
- **activeContext.md**: Current focus

### Key Patterns
- DI Factory Pattern: systemPatterns.md#service-factory-nodeprovider-pattern
- RLS Integration: systemPatterns.md#rls-integration-pattern
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern

---

**Last Updated**: 2025-12-03
