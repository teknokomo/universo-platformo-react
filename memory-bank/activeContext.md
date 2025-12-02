# Active Context

> **Last Updated**: 2025-01-20
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## ✅ Completed: Zod Validation Schemas for spaces-srv (2025-01-20)

**Status**: COMPLETE. Build successful.

**What Was Done**:
- Created `packages/spaces-srv/base/src/schemas/index.ts` with comprehensive Zod schemas
- Refactored `spacesController.ts` from ~750 lines to ~515 lines (~30% reduction)
- Replaced manual validation with declarative Zod schemas
- Added ZodError handling with user-friendly messages

**Schemas Created**:
- `CreateSpaceSchema`, `UpdateSpaceSchema` - Space CRUD
- `CreateCanvasSchema`, `UpdateCanvasSchema` - Canvas CRUD
- `CreateCanvasVersionSchema`, `UpdateCanvasVersionSchema` - Version management
- `ReorderCanvasesSchema` - Canvas ordering
- Path param schemas: `UnikIdParamSchema`, `SpaceParamsSchema`, etc.

**Helper Functions**:
- `extractUnikId(params)` - handles legacy `:id` param fallback
- `formatZodError(error)` - user-friendly error messages
- `validateBody()`, `safeValidateBody()` - typed validation wrappers

---

## ✅ Completed: Canvas Versions API Client (2025-01-20)

**Status**: COMPLETE. Build 50/50 successful.

**Problem**: Dialog "Версии холста" showed "Versioning is not available in this build" because `api.canvasVersions` was missing in `@universo/api-client`.

**What Was Done**:
- Created `packages/universo-api-client/src/api/canvasVersions.ts` with:
  - `CanvasVersionsApi` class with methods: `list`, `create`, `update`, `activate`, `remove`
  - Type definitions: `CanvasVersion`, `CreateCanvasVersionPayload`, `UpdateCanvasVersionPayload`
  - Query keys factory: `canvasVersionsQueryKeys`
- Updated `client.ts` to include `canvasVersions: new CanvasVersionsApi(client)`
- Updated `index.ts` to export new API class and types

**Backend Routes Already Existed**:
- `GET /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions` - list versions
- `POST /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions` - create version
- `PUT /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId` - update metadata
- `POST /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId/activate` - activate version
- `DELETE /unik/:unikId/spaces/:spaceId/canvases/:canvasId/versions/:versionId` - delete version

---

## ✅ Completed: System Status Fields for Spaces & Canvases (2025-01-20)

**Status**: COMPLETE. Build 50/50 successful.

**What Was Done**:

1. **Migration Consolidation**:
   - Deleted `1743000000003-FixActiveVersions.ts` (merged into main migration)
   - Updated `1743000000000-AddSpacesAndCanvases.ts` with 10-step idempotent migration
   - Includes: versioning backfill, is_active fix, status fields, indexes, RLS policies

2. **Spaces Entity Extended** (now versioned like Canvases):
   - Added versioning: `versionGroupId`, `versionUuid`, `versionLabel`, `versionDescription`, `versionIndex`
   - Added status: `isActive`, `isPublished`, `isDeleted`, `deletedDate`, `deletedBy`

3. **Canvas Entity Extended**:
   - Added: `isPublished`, `isDeleted`, `deletedDate`, `deletedBy`

4. **Types Updated**:
   - `SpaceResponse` now includes all versioning + status fields
   - `CanvasResponse` now includes status fields

5. **Service Layer Updated**:
   - Created `toSpaceResponse()` helper function
   - Updated `toCanvasResponse()` with new status fields
   - Fixed `getSpacesForUnik` with `is_deleted = false` filter
   - Updated `createSpace`, `getSpaceDetails`, `updateSpace` to use helpers

**Database Changes**:
- Spaces: versioning + status fields (9 new columns)
- Canvases: status fields (4 new columns)
- Partial indexes for performance
- RLS policies exclude deleted records

---

## ✅ Completed: Canvases Migration Consolidation (2025-01-20)

**Status**: COMPLETE. Build 50/50 successful.

**What Was Done**:
- Consolidated 7 chat_flow migrations from flowise-server into spaces-srv
- Renamed ChatflowType → CanvasType throughout codebase
- Cleaned up legacy code (IActiveChatflows, validateChatflowAPIKey, getUsedChatflowNames)
- Rewrote flowise-server migrations index with documented phase order

---

## ✅ Completed: QA Cleanup - Remove Duplicate Marketplaces (2025-01-19)

**Status**: COMPLETE. Build 50/50 successful.

**What Was Done**:
- Added `@flowise/customtemplates-frt` dependency to spaces-frt
- Updated CanvasRoutes.jsx to import `TemplateCanvas` from `@flowise/customtemplates-frt` instead of old `MarketplaceCanvas` from `@ui/views/marketplaces`
- Updated ExportAsTemplateDialog.jsx to use `api.templates.saveCustom` instead of `api.marketplaces.saveAsCustomTemplate`
- Deleted duplicate folder `flowise-ui/src/views/marketplaces/` (functionality now in @flowise/customtemplates-frt)

**Naming Alignment**: Completed migration from `Marketplaces` → `Templates` naming.

---

## ✅ Completed: CustomTemplates Package Extraction (2025-01-19)

**Status**: COMPLETE. Build 50/50 successful.

**What Was Done**:

1. **Created `@flowise/customtemplates-srv`** (backend package):
   - TypeORM entity `CustomTemplate` with full schema
   - Migration `1725629836652-AddCustomTemplate`
   - Service `CustomTemplatesService` with DI pattern
   - Exports: `CustomTemplate`, `customTemplatesMigrations`, `CustomTemplatesService`, `getCustomTemplatesService`

2. **Created `@flowise/customtemplates-frt`** (frontend package):
   - Templates list page and detail pages (JSX, source-only)
   - i18n translations (en/ru) compiled via tsdown
   - Components: `Templates`, `TemplateCanvas`, `TemplateCanvasHeader`, `TemplateCanvasNode`

3. **Implemented `MarketplacesApi`** in `@universo/api-client`:
   - Full typed methods for templates CRUD
   - TanStack Query keys factory
   - Types: `ICustomTemplateResponse`, `Template`, `ToolTemplate`

4. **Updated flowise-server**:
   - Entity/migration imports from `@flowise/customtemplates-srv`
   - Service imports updated in `marketplaces` and `export-import` services
   - Removed old local CustomTemplate files

5. **Updated universo-template-mui**:
   - Added Templates routes in `MainRoutesMUI.tsx`
   - Added Templates menu item in `menuConfigs.ts`

**Files Changed/Created**:
- `packages/flowise-customtemplates-srv/base/` - new package (12 files)
- `packages/flowise-customtemplates-frt/base/` - new package (15 files)
- `packages/universo-api-client/src/api/marketplaces.ts` - new API implementation
- `packages/flowise-server/src/database/entities/index.ts` - updated imports
- `packages/flowise-server/src/database/migrations/postgres/index.ts` - updated imports
- `packages/flowise-server/src/services/marketplaces/index.ts` - updated imports
- `packages/flowise-server/src/services/export-import/index.ts` - updated imports
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - added routes
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts` - added menu

---

## ✅ Completed: Refactor Duplicate Code & Document Isolation (2025-12-02)

**Status**: COMPLETE. Build 39/39 successful.

**What Was Done**:

1. **Refactored `deleteDocumentStore`** (`flowise-server/services/documentstore/`):
   - Removed duplicated DB operations (now delegates to `getDocumentStoreService().deleteDocumentStore()`)
   - Kept file storage cleanup locally (`removeFilesFromStorage()` - requires flowise-components)
   - Changed from 45 lines → 12 lines

2. **Refactored `updateDocumentStoreUsage`**:
   - Complete delegation to `getDocumentStoreService().updateDocumentStoreUsage()`
   - Changed from 35 lines → 1 line

3. **Updated `@flowise/docstore-srv` README**:
   - Added "Partial Extraction" section documenting what's in this package vs flowise-server
   - Added "Blocking Dependencies Analysis" with details on:
     - `getRunningExpressApp()` singleton
     - `flowise-components` file storage
     - `nodesPool.componentNodes` dynamic loading
     - Queue manager
   - Added "Future Isolation Plan" with DI interfaces to implement

4. **Updated `@flowise/docstore-frt` README**:
   - Added "Integration Notes" section
   - Documented flowise-ui integration pattern
   - Confirmed frontend is fully extracted

**Files Changed**:
- `packages/flowise-server/src/services/documentstore/index.ts` - removed ~70 lines of duplicate code
- `packages/flowise-docstore-srv/base/README.md` - added ~100 lines of documentation
- `packages/flowise-docstore-frt/base/README.md` - added ~40 lines of documentation

---

## ✅ Completed: QA Cleanup - Duplicate VectorStore Dialogs Removed (2025-01-19)

**Status**: COMPLETE. Build 48/48 successful.

**What Was Done**:

1. **Deleted Duplicate Files from template-mui**:
   - `VectorStoreDialog.jsx`, `VectorStorePopUp.jsx`
   - `UpsertHistoryDialog.jsx`, `UpsertResultDialog.jsx`

2. **Updated Exports** (`template-mui/index.ts`):
   - Removed `UpsertHistoryDialog` and `VectorStorePopUp` exports
   - Added comment noting move to `@flowise/docstore-frt`

3. **Updated Imports** (`spaces-frt`):
   - `canvas/index.jsx`: `VectorStorePopUp` from `@flowise/docstore-frt`
   - `canvas/CanvasHeader.jsx`: `UpsertHistoryDialog` from `@flowise/docstore-frt`
   - Added `@flowise/docstore-frt` workspace dependency

4. **Fixed Export Pattern** (`docstore-frt/VectorStorePopUp.jsx`):
   - Changed `export const` to `const` + `export default` for index.js compatibility

---

## ✅ Completed: DocumentStore Backend Clean Integration (2025-01-19)

**Status**: COMPLETE. Build 39/39 → 48/48 successful.

**What Was Done**:

1. **Extended DI Interfaces** (`@flowise/docstore-srv`):
   - `INodeMetadata` - node metadata without runtime dependencies
   - `INodeProvider` - abstraction for nodesPool access
   - `ICredentialMetadata`, `IEncryptionService`, `IStorageService`
   - Extended `DocstoreServiceDependencies` with new providers

2. **Created NodeProvider** (`flowise-server/providers/`):
   - `nodeProvider.ts` - implements INodeProvider wrapping nodesPool
   - Type conversion for optional fields (boolean | INodeDisplay → boolean)
   - Lazy initialization via getRunningExpressApp()

3. **Created Service Factory** (`flowise-server/services/docstore-integration/`):
   - `createDocstoreServiceDependencies()` - creates all dependencies
   - `getDocumentStoreService()` - singleton pattern for service access
   - Lazy initialization with proper error handling

4. **Delegated CRUD Operations**:
   - `createDocumentStore()` → `getDocumentStoreService().createDocumentStore()`
   - `getAllDocumentStores()` → `getDocumentStoreService().getAllDocumentStores()`
   - `getDocumentStoreById()` → `getDocumentStoreService().getDocumentStoreById()`
   - `updateDocumentStore()` → `getDocumentStoreService().updateDocumentStore()`
   - Complex ops (updateDocumentStoreUsage, deleteDocumentStore) kept local

**Architecture Decision**: Practical "Clean Integration" approach - basic CRUD delegates to DI services while complex operations (preview, process, vector ops) remain in flowise-server due to deep flowise-components runtime dependencies.

**Files Created**:
- `packages/flowise-docstore-srv/base/src/di/config.ts` - Extended interfaces
- `packages/flowise-server/src/providers/nodeProvider.ts` - INodeProvider impl
- `packages/flowise-server/src/providers/index.ts` - exports
- `packages/flowise-server/src/services/docstore-integration/index.ts` - factory

**Build**: ✅ 48/48 packages

---

## ✅ Completed: DocumentStore Preview 403 & i18n Fixes (2025-12-01)

**Status**: COMPLETE. 48/48 packages build successfully.

**Issues Fixed**:

1. **403 Error on "Preview & Process"**:
   - Root cause: `getSpecificDocumentStoreApi.request(storeId)` missing `unikId` parameter
   - Fix: Changed to `getSpecificDocumentStoreApi.request(unikId, storeId)` in LoaderConfigPreviewChunks.jsx

2. **i18n Interpolation**:
   - Root cause: Single braces `{total}` instead of i18next double braces `{{total}}`
   - Fix: Updated all interpolation variables in document-store.json (en + ru) to use `{{variable}}` format

3. **Hardcoded Tooltips**:
   - Changed `title='Refresh Document Store'` → `title={t('document-store:actions.refresh')}`
   - Changed `title='Refresh'` → `title={t('document-store:common.refresh')}`

---

## ✅ Completed: DocumentStore Frontend Migration (2025-12-01)

**Status**: COMPLETE. 48/48 packages build successfully.

**What Was Done**:

1. **API Client Implementation** (`@universo/api-client`):
   - `DocumentStoreApi` - 20 methods covering store CRUD, loaders, chunks, vector operations
   - `NodesApi` - added `getSpecificNode()` and `getNodesByCategory()`
   - `VectorStoreApi` - 4 methods for upsert and history operations

2. **Component Migration** (20 JSX files):
   - Copied 16 docstore + 4 vectorstore files from flowise-ui to @flowise/docstore-frt
   - Refactored all imports from `@/api/*` pattern to centralized `@universo/api-client`
   - API calls updated: `documentsApi.*` → `api.documentStore.*`, `nodesApi.*` → `api.nodes.*`
   - Fixed relative imports between docstore/vectorstore folders
   - Resolved duplicate imports and prettier formatting issues

3. **Routes Update** (`MainRoutesMUI.tsx`):
   - Changed lazy imports from `@/views/docstore/*` to `@flowise/docstore-frt/pages/docstore/*`
   - Removed unnecessary `@ts-expect-error` directives (TypeScript now resolves types correctly)

4. **Package Dependencies Updated**:
   - Added: `@universo/utils`, `dayjs`, `flowise-react-json-view`, `react-code-blocks`, `react-datepicker`, `react-perfect-scrollbar`, `rehype-mathjax`, `rehype-raw`, `remark-gfm`, `remark-math`

**Pending**: Delete legacy code from flowise-ui (Этап 7) - requires user confirmation after functional testing

---

## ✅ Completed: DocumentStore i18n Consolidation (2025-12-01)

**Status**: COMPLETE. 48/48 packages build successfully.

**Created `@flowise/docstore-srv`** (Backend):
- Package structure with DI pattern (no getRunningExpressApp())
- 3 entities: DocumentStore, DocumentStoreFileChunk, UpsertHistory
- Consolidated migration (1711637331047-AddDocumentStore.ts)
- 4 DI-based services: documentStoreService, chunkService, loaderService, vectorStoreConfigService
- Controller and Router for basic CRUD
- Interface.ts with all types (~300 lines)
- DocumentStoreDTO class

**Created `@flowise/docstore-frt`** (Frontend):
- 20 JSX view files (~7254 lines)
- Merged i18n translations (document-store + vector-store = 600 lines)
- index.js with all exports
- README documentation

**Integrated in flowise-server**:
- Added dependency on @flowise/docstore-srv
- Updated migrations/postgres/index.ts
- Updated entities/index.ts
- Updated 7 service/controller/utils files

**Deleted Legacy Files** (6 files):
- 3 duplicate entities from flowise-server
- 3 duplicate migrations from flowise-server

**Architecture Decision**: Hybrid approach - new packages provide entities/migrations/DI interfaces, legacy flowise-server keeps complex operations (upsert, preview, vector ops) due to deep flowise-components integration.

**Build**: ✅ 48/48 packages

---

## Previous: ChatMessage Full Migration Complete ✅ (2025-11-29)

**Status**: All legacy code deleted. Build 38/38 successful.

**Migration Complete**:
- All ChatMessage functionality now in `@universo/flowise-chatmessage-srv`
- Deleted 10 legacy migration files from flowise-server
- Deleted all legacy services, controllers, routes, utils
- Created utility wrappers for backward compatibility

Details: progress.md#2025-11-29

---

## Recent Completions (Last 7 Days)

### 2025-11-28: Assistants Package Extraction ✅
- Extracted to @universo/flowise-assistants-srv and @universo/flowise-assistants-frt
- DI pattern with optional dependencies config
- Consolidated migration: 1699325775451-AddAssistant.ts
- Fixed cyclic dependency via peerDependency
- Pinned react-i18next for i18next 23.x compatibility
- User testing pending
- Details: progress.md#2025-11-28

### 2025-11-28: ApiKey Package Extraction ✅
- Extracted to @universo/flowise-apikey-srv and @universo/flowise-apikey-frt
- DI pattern with dual storage mode (JSON + DB)
- Migration: 1720230151480-AddApiKey.ts
- API Client implementation complete
- User testing pending
- Details: progress.md#2025-11-28

### 2025-11-28: Variables Package Extraction ✅
- Extracted to @universo/flowise-variables-srv and @universo/flowise-variables-frt
- DI pattern with Zod validation
- User testing pending
- Details: progress.md#2025-11-28

### 2025-11-27: Credentials Package Extraction ✅
- Extracted to @universo/flowise-credentials-srv and @universo/flowise-credentials-frt
- User testing pending

### 2025-11-27: Tools Package Extraction ✅
- Extracted to @universo/flowise-tools-srv and @universo/flowise-tools-frt
- Migration: 1693891895164-AddTools.ts
- Bot review fixes applied (PR #564)
- User testing pending
- Details: progress.md#2025-11-27

### 2025-11-25: AR.js Node Connections Mode Fix ✅
- Fixed `quizState is not defined` error
- Browser testing pending
- Details: progress.md#2025-11-25

---

## Active Blockers

### Template MUI CommonJS Shims (DEFERRED)
- **Problem**: flowise-ui ESM/CJS conflict with @flowise/template-mui
- **Solution**: Extract to @universo package with dual build
- **Impact**: Blocks UI component imports

---

## Quick Reference

### Core Patterns
- i18n Architecture: systemPatterns.md#i18n-architecture
- Universal List: systemPatterns.md#universal-list-pattern
- DI Service Factory: Tools/Credentials extraction pattern
- TypeORM Repository: systemPatterns.md#typeorm-repository-pattern

### Key Commands
```bash
pnpm --filter <package> build    # Build single package
pnpm build                       # Full workspace build
pnpm --filter <package> lint     # Lint single package
```

---

**Note**: For implementation details older than 7 days, see progress.md. For planned work, see tasks.md.
