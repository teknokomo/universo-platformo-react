# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring, Uniks metrics update, UnikBoard expansion, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frt architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes |

---

## January 2025

### 2025-01-20: Zod Validation Schemas for spaces-srv ✅

**Summary**: Added Zod validation schemas to `spaces-srv` package, replacing verbose manual validation in `spacesController.ts`. Controller reduced from ~750 lines to ~515 lines (~30% reduction).

**Files Created**:
- `packages/spaces-srv/base/src/schemas/index.ts` - centralized Zod schemas

**Schemas Added**:
- `CreateSpaceSchema`, `UpdateSpaceSchema` - Space CRUD validation
- `CreateCanvasSchema`, `UpdateCanvasSchema` - Canvas CRUD validation
- `CreateCanvasVersionSchema`, `UpdateCanvasVersionSchema` - Version management
- `ReorderCanvasesSchema` - Canvas ordering validation
- Path parameter schemas: `UnikIdParamSchema`, `SpaceParamsSchema`, etc.

**Helper Functions**:
- `extractUnikId(params)` - extract unikId with fallback to legacy :id param
- `formatZodError(error)` - convert ZodError to user-friendly message
- `validateBody(schema, data)` - parse with typed result
- `safeValidateBody(schema, data)` - safe parse with error handling

**Code Quality**:
- Declarative validation instead of imperative if/else chains
- Centralized error messages
- Type-safe inferred types from schemas
- Consistent response formatting

---

### 2025-01-20: System Status Fields for Spaces & Canvases ✅

**Summary**: Added comprehensive system status fields (is_active, is_published, is_deleted, deleted_date, deleted_by) to both Spaces and Canvases tables. Made Spaces versioned like Canvases. Consolidated FixActiveVersions migration into main AddSpacesAndCanvases migration.

**New Fields Added**:
1. **Spaces table** (new versioning + status):
   - `version_group_id` uuid NOT NULL - groups versions together
   - `version_uuid` uuid UNIQUE NOT NULL - unique identifier for this version
   - `version_label` varchar(255) NOT NULL DEFAULT 'v1' - human-readable label
   - `version_description` text - optional description
   - `version_index` integer NOT NULL DEFAULT 1 - ordering within group
   - `is_active` boolean NOT NULL DEFAULT true - active version in group
   - `is_published` boolean NOT NULL DEFAULT false - publicly accessible
   - `is_deleted` boolean NOT NULL DEFAULT false - soft delete flag
   - `deleted_date` timestamptz - when deleted
   - `deleted_by` uuid - who deleted (FK to users)

2. **Canvases table** (new status fields):
   - `is_published` boolean NOT NULL DEFAULT false - publicly accessible
   - `is_deleted` boolean NOT NULL DEFAULT false - soft delete flag
   - `deleted_date` timestamptz - when deleted
   - `deleted_by` uuid - who deleted (FK to users)

**Migration Consolidation**:
- Deleted `1743000000003-FixActiveVersions.ts` (merged into main migration)
- Main migration now handles:
  - Step 3: Backfill versioning for existing spaces
  - Step 4: Fix is_active defaults + unique constraint (was in FixActiveVersions)

**Indexes Created**:
- `idx_spaces_active` - partial index on (version_group_id) WHERE is_active = true
- `idx_spaces_published` - partial index on (id) WHERE is_published = true
- `idx_canvases_published` - partial index on (id) WHERE is_published = true
- `idx_canvases_not_deleted` - partial index on (space_id) WHERE is_deleted = false

**RLS Policies Updated**:
- All SELECT policies now include `NOT is_deleted` filter
- Ensures deleted records are invisible to users

**Build Status**: SUCCESS (50/50 packages)

---

### 2025-01-20: Canvases Migration Consolidation ✅

**Summary**: Consolidated all chat_flow migrations from flowise-server into spaces-srv package. Renamed ChatflowType → CanvasType. Cleaned up legacy code references.

**Migration Changes**:
1. **Deleted from flowise-server** (7 migrations):
   - `1693891895163-Init.ts` - original chat_flow table creation
   - `1693995626941-ModifyChatFlow.ts` - add chatbotConfig column
   - `1694099183389-AddApiConfig.ts` - add apiConfig column
   - `1694432361423-AddAnalytic.ts` - add analytic column
   - `1699900910291-AddCategoryToChatFlow.ts` - add category column
   - `1706364937060-AddSpeechToText.ts` - add speechToText column
   - `1716300000000-AddTypeToChatFlow.ts` - add type column

2. **Updated in spaces-srv**:
   - Renamed `SpacesCore` → `AddSpacesAndCanvases` for clarity
   - Deleted `DropLegacyChatFlow` migration (no longer needed)

3. **Rewrote flowise-server migrations index** with documented order:
   - Phase 1: Core domain tables (chat_message, tools, credentials, assistants)
   - Phase 2: Uniks module (tables with unik_id FK)
   - Phase 3: Spaces module (spaces, canvases, spaces_canvases - creates canvases table)
   - Phase 4: Publish module (publications, publish_sessions, publish_analytics)

**Type Refactoring**:
- `ChatflowType` → `CanvasType` in all 7 spaces-srv files
- Canvas entity now imports type from central `types/index.ts`
- Type definition: `'CHATFLOW' | 'MULTIAGENT' | 'ASSISTANT'`

**Legacy Code Cleanup**:
- Removed `IActiveChatflows` interface from Interface.ts
- Removed `validateChatflowAPIKey` alias from validateKey.ts
- Renamed `getUsedChatflowNames` → `getUsedCanvasNames` in documentstore service
- Updated controller call to use new function name

**Decision: Template Types Not Changed**:
- Template types (`'Chatflow' | 'Agentflow' | 'Tool'`) are UI/marketplace labels
- CanvasType (`'CHATFLOW' | 'MULTIAGENT' | 'ASSISTANT'`) is database enum
- These are separate domains - no changes needed

**Build Result**: 50/50 packages successful in 4m43s

**Next Step**: User to recreate database and verify migrations run correctly

---

### 2025-01-19: Templates API Route Fix ✅

**Summary**: Fixed 500 error on "My Templates" (Мои шаблоны) tab by correcting regex pattern for unikId extraction in marketplaces controller.

**Problem**: API client was calling `/api/v1/unik/:unikId/templates/custom` but the controller regex only matched `/uniks/` (plural), not `/unik/` (singular).

**Root Cause**: Route mismatch - server routes use `/unik/:unikId/templates` (via `createUniksRouter`), but the controller regex was `/\/uniks\/([^\/]+)\/templates/` which didn't match.

**Fix Applied** (`packages/flowise-server/src/controllers/marketplaces/index.ts`):
- Changed regex from `/\/uniks\/([^\/]+)\/templates/` to `/\/uniks?\/([^\/]+)\/templates/`
- The `s?` makes the 's' optional, matching both `/unik/` and `/uniks/`
- Applied to all 4 methods: `getAllTemplates`, `getAllCustomTemplates`, `saveCustomTemplate`, `deleteCustomTemplate`

**Build Result**: 50/50 packages successful

---

### 2025-01-19: QA Cleanup - Remove Duplicate Marketplaces ✅

**Summary**: Post-CustomTemplates extraction cleanup - removed duplicate code and unified naming from `Marketplaces` to `Templates`.

**Changes Made**:
1. **spaces-frt/package.json**: Added `@flowise/customtemplates-frt: workspace:*` dependency
2. **CanvasRoutes.jsx**: Changed import from `@ui/views/marketplaces/MarketplaceCanvas` to `TemplateCanvas` from `@flowise/customtemplates-frt`
3. **ExportAsTemplateDialog.jsx**: Changed `api.marketplaces.saveAsCustomTemplate` to `api.templates.saveCustom`, removed outdated TODO comment
4. **flowise-ui/src/views/marketplaces/**: Deleted entire duplicate folder (now in @flowise/customtemplates-frt)

**Naming Alignment Completed**:
- API: `MarketplacesApi` → `TemplatesApi` (with legacy aliases for backward compatibility)
- Routes: `/marketplaces` → `/templates`
- Components: `MarketplaceCanvas` → `TemplateCanvas`

**Build Result**: 50/50 packages successful

---

### 2025-01-19: CustomTemplates Package Extraction ✅

**Summary**: Extracted CustomTemplate (formerly Marketplace) functionality from flowise-server and flowise-ui into dedicated standalone packages.

**Packages Created**:
1. **@flowise/customtemplates-srv** - Backend package:
   - TypeORM entity `CustomTemplate` with full schema
   - Migration `1725629836652-AddCustomTemplate` with indexes
   - Service `CustomTemplatesService` with DI pattern for canvas dependency
   - Full TypeScript support with decorators

2. **@flowise/customtemplates-frt** - Frontend package:
   - Templates list page (`Templates/index.jsx`)
   - Template detail page (`TemplateCanvas.jsx`)
   - Header and node components
   - i18n translations (en/ru)

**API Client Implementation** (`@universo/api-client`):
- Full `MarketplacesApi` implementation with typed methods:
  - `getAllTemplatesFromMarketplaces()`
  - `getAllToolsMarketplaces()`
  - `getAllCustomTemplates()`
  - `saveAsCustomTemplate()`
  - `deleteCustomTemplate()`
- TanStack Query keys factory
- Response types: `ICustomTemplateResponse` for API responses

**Integration Updates**:
- `flowise-server/database/entities/index.ts` - imports from package
- `flowise-server/database/migrations/postgres/index.ts` - uses package migrations
- `flowise-server/services/marketplaces/index.ts` - updated imports
- `flowise-server/services/export-import/index.ts` - updated imports
- `universo-template-mui/routes/MainRoutesMUI.tsx` - added template routes
- `universo-template-mui/navigation/menuConfigs.ts` - added Templates menu item

**Files Removed**:
- `flowise-server/src/database/entities/CustomTemplate.ts` (moved to package)
- `flowise-server/src/database/migrations/postgres/1725629836652-AddCustomTemplate.ts` (moved to package)

**Build Result**: 50/50 packages successful

---

### 2025-01-19: QA Cleanup - Removed Duplicate VectorStore Dialogs ✅

**Summary**: Removed 4 duplicate VectorStore dialog files from `@flowise/template-mui` that were obsolete after full DocumentStore migration to `@flowise/docstore-frt`.

**Files Deleted from template-mui**:
- `ui-components/dialog/VectorStoreDialog.jsx`
- `ui-components/dialog/VectorStorePopUp.jsx`
- `ui-components/dialog/UpsertHistoryDialog.jsx`
- `ui-components/dialog/UpsertResultDialog.jsx`

**Updates Made**:
1. **Exports cleanup** (`template-mui/base/src/index.ts`):
   - Removed exports for deleted files
   - Added comment noting components moved to `@flowise/docstore-frt`

2. **Import updates** (`spaces-frt`):
   - `views/canvas/index.jsx`: Changed `VectorStorePopUp` import to `@flowise/docstore-frt`
   - `views/canvas/CanvasHeader.jsx`: Changed `UpsertHistoryDialog` import to `@flowise/docstore-frt`
   - `package.json`: Added `@flowise/docstore-frt: workspace:*` dependency

3. **Export fix** (`docstore-frt/pages/vectorstore/VectorStorePopUp.jsx`):
   - Changed named export `export const VectorStorePopUp` to `const VectorStorePopUp` + `export default VectorStorePopUp`
   - Required for compatibility with `index.js` re-export pattern

**Build Result**: ✅ 48/48 packages successful

---

### 2025-01-19: DocumentStore Backend Clean Integration ✅

**Summary**: Migrated DocumentStore CRUD operations to use `@flowise/docstore-srv` DI services via practical "Clean Integration" approach. Complex operations (preview, process, vector ops) remain in flowise-server due to runtime dependencies.

**What Was Done**:
1. **Extended DI Interfaces** (`@flowise/docstore-srv/di/config.ts`):
   - `INodeMetadata` - node metadata without runtime dependencies
   - `INodeProvider` - abstraction for nodesPool access with methods: getComponentNodes(), getNode(), getNodesByCategory(), createNodeInstance()
   - `ICredentialMetadata`, `IEncryptionService`, `IStorageService` interfaces
   - Extended `DocstoreServiceDependencies` with new providers

2. **Created NodeProvider** (`flowise-server/src/providers/nodeProvider.ts`):
   - Implements `INodeProvider` interface
   - Wraps `nodesPool` from getRunningExpressApp()
   - Handles type conversion (boolean | INodeDisplay → boolean | undefined)
   - Lazy initialization pattern

3. **Created Service Factory** (`flowise-server/src/services/docstore-integration/index.ts`):
   - `createDocstoreServiceDependencies()` - factory for all dependencies
   - `getDocumentStoreService()` - singleton pattern with lazy initialization
   - `initializeDocstoreService()` - manual initialization support

4. **Delegated CRUD Operations** (`flowise-server/src/services/documentstore/index.ts`):
   - `createDocumentStore()` → `getDocumentStoreService().createDocumentStore()`
   - `getAllDocumentStores()` → `getDocumentStoreService().getAllDocumentStores()`
   - `getDocumentStoreById()` → `getDocumentStoreService().getDocumentStoreById()`
   - `updateDocumentStore()` → `getDocumentStoreService().updateDocumentStore()`
   - Complex operations (updateDocumentStoreUsage, deleteDocumentStore, preview/process/vector) kept local

**Architecture Decision**: Practical approach - CRUD operations delegate to testable DI services, while operations deeply tied to flowise-components runtime (preview chunks, process loaders, vector store upsert) remain in flowise-server. This provides immediate value (testable CRUD, cleaner separation) without risky refactoring of complex code.

**Build Result**: ✅ 39/39 packages successful

---

## November 2025

### 2025-12-01: DocumentStore Frontend Migration to @flowise/docstore-frt ✅

**Summary**: Completed full migration of Document Store UI components from flowise-ui monolith to standalone `@flowise/docstore-frt` package with proper `@universo/api-client` integration.

**What Was Done**:
1. **API Client Implementation** (`@universo/api-client`):
   - `DocumentStoreApi` - 20 methods for store CRUD, loaders, chunks, vector operations
   - `NodesApi` - added `getSpecificNode()` and `getNodesByCategory()` 
   - `VectorStoreApi` - 4 methods for upsert and history

2. **Component Migration** (20 JSX files):
   - Copied from `flowise-ui/src/views/docstore/` and `vectorstore/`
   - Refactored all imports from `@/api/*` to `@universo/api-client`
   - Fixed relative imports between docstore/vectorstore folders
   - Removed duplicate imports, fixed eslint/prettier issues

3. **Routes Update** (`MainRoutesMUI.tsx`):
   - Changed imports from `@/views/docstore/*` to `@flowise/docstore-frt/pages/docstore/*`
   - Removed unnecessary `@ts-expect-error` directives

4. **Package Dependencies**:
   - Added missing dependencies: `@universo/utils`, `dayjs`, `flowise-react-json-view`, etc.

**Build Result**: 48/48 packages successful

**Files Modified**:
- `packages/universo-api-client/src/api/documentstore.ts` - full implementation
- `packages/universo-api-client/src/api/nodes.ts` - added 2 methods
- `packages/universo-api-client/src/api/vectorstore.ts` - full implementation
- `packages/universo-api-client/src/index.ts` - type exports
- `packages/flowise-docstore-frt/base/src/pages/docstore/*.jsx` - 16 files
- `packages/flowise-docstore-frt/base/src/pages/vectorstore/*.jsx` - 4 files
- `packages/flowise-docstore-frt/base/package.json` - dependencies
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - imports

**Pending**: Delete legacy code from flowise-ui (requires user confirmation for functional testing first)

---

### 2025-12-01: DocumentStore i18n Fixed ✅

**Summary**: Fixed localization issue (Document Store showing "Пространства" + raw keys) and finalized architecture so translations live inside `@flowise/docstore-frt` only.

**Root Cause Analysis**:
1. Components in flowise-ui used `t('document-store:title')` with hyphenated namespace
2. universo-i18n instance.ts only exposed legacy `docstore` namespace (without hyphen)
3. Fallback chain `['common', 'header', 'spaces']` returned `spaces.title` ("Пространства")
4. Namespace registration from `@flowise/docstore-frt` wasn't guaranteed before first render

**Solution Applied**:
1. Added `registerDocstoreI18n()` helper in `@flowise/docstore-frt` (side-effect + explicit export)
2. Ensured both template route bundles import `@flowise/docstore-frt/i18n`
3. Copied translations temporarily into `@universo/i18n` to unblock QA, then **removed them** once package-level registration was stable
4. Deleted `packages/universo-i18n/base/src/locales/**/features/{docstore,document-store,vector-store}.json` and cleaned `instance.ts`, README(-RU), and `i18next.d.ts`
5. Updated i18n architecture pattern to document "feature packages own their namespaces"

**Build Result**: 48/48 packages successful

---

### 2025-11-30: DocumentStore Full Migration Complete ✅

**Summary**: Completed full extraction of DocumentStore functionality into `@flowise/docstore-srv` and `@flowise/docstore-frt` packages. Used hybrid approach - new packages provide entities/migrations/DI interfaces, legacy flowise-server keeps complex operations. Build successful: 48/48 packages.

**Created Backend Package** (`@flowise/docstore-srv`):
1. **Package Configuration**:
   - `packages/flowise-docstore-srv/base/package.json`
   - `packages/flowise-docstore-srv/base/tsconfig.json`

2. **Database Layer**:
   - `src/database/entities/DocumentStore.ts` - with Unik relation
   - `src/database/entities/DocumentStoreFileChunk.ts`
   - `src/database/entities/UpsertHistory.ts`
   - `src/database/migrations/postgres/1711637331047-AddDocumentStore.ts` - consolidated idempotent migration

3. **DI-based Services**:
   - `src/services/documentStoreService.ts` - CRUD operations
   - `src/services/chunkService.ts` - chunk pagination
   - `src/services/loaderService.ts` - loader management
   - `src/services/vectorStoreConfigService.ts` - vector config

4. **Controller & Router**:
   - `src/controllers/documentStoreController.ts` - HTTP handlers with DI
   - `src/routes/documentStoreRouter.ts` - Express router factory

**Created Frontend Package** (`@flowise/docstore-frt`):
1. **Views** (20 JSX files, ~7254 lines):
   - `src/pages/docstore/` - 16 files (DocumentStore UI)
   - `src/pages/vectorstore/` - 4 files (VectorStore dialogs)

2. **i18n** (600 lines merged):
   - `src/i18n/locales/en.json` - merged document-store + vector-store
   - `src/i18n/locales/ru.json` - merged translations

**Integrated in flowise-server**:
1. Added `@flowise/docstore-srv` dependency
2. Updated `migrations/postgres/index.ts` to use `docstoreMigrations`
3. Updated `entities/index.ts` to import from `@flowise/docstore-srv`
4. Updated 7 files to use new imports:
   - `Interface.DocumentStore.ts`
   - `services/documentstore/index.ts`
   - `services/export-import/index.ts`
   - `services/spacesCanvas/index.ts`
   - `services/upsert-history/index.ts`
   - `controllers/documentstore/index.ts`
   - `utils/index.ts`, `utils/upsertVector.ts`

**Deleted Legacy Files** (6 files):
- `database/entities/DocumentStore.ts`
- `database/entities/DocumentStoreFileChunk.ts`
- `database/entities/UpsertHistory.ts`
- `database/migrations/postgres/1709814301358-AddUpsertHistoryEntity.ts`
- `database/migrations/postgres/1711637331047-AddDocumentStore.ts`
- `database/migrations/postgres/1715861032479-AddVectorStoreConfigToDocStore.ts`

**Architecture Decision**: Hybrid approach chosen because legacy DocumentStore service (2097 lines) has deep integration with flowise-components (node loaders, vector stores, embeddings). Full extraction would require major refactoring.

**Build**: 48/48 packages successful ✅

---

### 2025-11-30: DocumentStore Backend Package Created ✅

**Summary**: Created `@flowise/docstore-srv` backend package with DI pattern. Phase 1 of DocumentStore extraction complete - package structure, entities, migrations, services created and building successfully.

**Created Files**:

1. **Package Configuration**:
   - `packages/flowise-docstore-srv/base/package.json` - with dependencies
   - `packages/flowise-docstore-srv/base/tsconfig.json` - TypeScript config

2. **Database Layer**:
   - `src/database/entities/DocumentStore.ts` - with Unik relation (kept as-is per user request)
   - `src/database/entities/DocumentStoreFileChunk.ts` - chunk entity
   - `src/database/entities/UpsertHistory.ts` - history entity
   - `src/database/entities/index.ts` - exports `docstoreEntities`
   - `src/database/migrations/postgres/1711637331047-AddDocumentStore.ts` - consolidated idempotent migration

3. **Interfaces and DTOs**:
   - `src/Interface.ts` - ~300 lines with DocumentStoreStatus enum, all interfaces
   - `src/dto/DocumentStoreDTO.ts` - DTO class with fromEntity/toEntity methods

4. **DI-based Services**:
   - `src/di/config.ts` - DI configuration with ILogger, ISSEStreamer, ITelemetry interfaces
   - `src/services/documentStoreService.ts` - CRUD operations with unikId filtering
   - `src/services/chunkService.ts` - chunk operations with pagination
   - `src/services/loaderService.ts` - loader management
   - `src/services/vectorStoreConfigService.ts` - vector store config management

5. **Errors**:
   - `src/errors/InternalFlowiseError.ts`
   - `src/errors/utils.ts`

6. **Documentation**:
   - `README.md` - English documentation
   - `README-RU.md` - Russian documentation

**Architecture Decisions**:
- Uses DI pattern (no `getRunningExpressApp()` calls)
- All services created via factory functions
- Unik relation kept in DocumentStore entity as-is
- Consolidated 3 migrations into 1 idempotent migration

**Build**: 8/8 packages successful ✅

**Next Steps**: Phase 2 - Create frontend package, Phase 3 - Integrate in flowise-server

---

### 2025-11-29: ChatMessage Full Migration Complete ✅

**Summary**: Completed full migration of ChatMessage functionality to `@universo/flowise-chatmessage-srv`. All legacy code deleted from flowise-server. Build successful: 38/38 packages.

**Major Changes**:

1. **Created Utility Wrappers in chatmessage-srv**:
   - `utilAddChatMessage(chatMessage, dataSource)` - for buildCanvasFlow compatibility
   - `utilGetChatMessage(params, dataSource, aMonthAgo)` - for stats service
   - `utilAddChatMessageFeedback`, `utilGetChatMessageFeedback`, `utilUpdateChatMessageFeedback`
   - Created `src/routes/internalCanvasMessagesRouter.ts` for internal API

2. **Updated flowise-server routes/index.ts**:
   - DI-based service/controller/router creation
   - Imports `removeFilesFromStorage` from `flowise-components`
   - Uses `process.env.MODE === MODE.QUEUE` for queue mode check
   - Imports `canvasService` (not just config) for getCanvasById

3. **Deleted from flowise-server** (10 migration files):
   - `1693996694528-ModifyChatMessage.ts`
   - `1699481607341-AddUsedToolsToChatMessage.ts`
   - `1700271021237-AddFileAnnotationsToChatMessage.ts`
   - `1701788586491-AddFileUploadsToChatMessage.ts`
   - `1707213601923-AddFeedback.ts`
   - `1711538016098-AddLeadToChatMessage.ts`
   - `1714679514451-AddAgentReasoningToChatMessage.ts`
   - `1721078251523-AddActionToChatMessage.ts`
   - `1726156258465-AddArtifactsToChatMessage.ts`
   - `1726666309552-AddFollowUpPrompts.ts`
   - Kept `1710497452584-FieldTypes.ts` (only assistant credential varchar→uuid)

4. **Deleted Legacy Directories** (services/controllers/routes):
   - `src/services/canvas-messages/`, `src/services/feedback/`
   - `src/controllers/canvas-messages/`, `src/controllers/feedback/`
   - `src/routes/canvas-messages/`, `src/routes/feedback/`, `src/routes/internal-canvas-messages/`

5. **Deleted Legacy Utils Files**:
   - `addChatMessage.ts`, `getChatMessage.ts`
   - `addChatMessageFeedback.ts`, `getChatMessageFeedback.ts`, `updateChatMessageFeedback.ts`

6. **Fixed export-import/index.ts**:
   - Removed canvasMessagesService dependency
   - Uses direct repository queries via dataSource

**Build**: 38/38 packages successful ✅

---

### 2025-11-29: ChatMessage Package QA Fixes ✅

**Summary**: Fixed QA issues found in ChatMessage extraction. Added consolidation comments to 9 legacy migrations. Re-exported interfaces from chatmessage-srv package. Changed MessageType from enum to type alias for compatibility.

**Changes Made**:
1. **flowise-server/Interface.ts**: Re-export `IChatMessage`, `IChatMessageFeedback`, `GetChatMessageParams` from `@universo/flowise-chatmessage-srv`
2. **chatmessage-srv/Interface.ts**: Changed `MessageType` from enum to string literal union type for flowise-server compatibility
3. **9 Legacy Migrations**: Added LEGACY consolidation comments to all chat_message-related migrations in flowise-server

**Legacy Migrations Marked**:
- `1693996694528-ModifyChatMessage.ts`
- `1699481607341-AddUsedToolsToChatMessage.ts`
- `1700271021237-AddFileAnnotationsToChatMessage.ts`
- `1701788586491-AddFileUploadsToChatMessage.ts`
- `1707213601923-AddFeedback.ts`
- `1710497452584-FieldTypes.ts`
- `1714679514451-AddAgentReasoningToChatMessage.ts`
- `1721078251523-AddActionToChatMessage.ts`
- `1726156258465-AddArtifactsToChatMessage.ts`
- `1726666309552-AddFollowUpPrompts.ts`

**Design Notes**:
- Enums (ChatType, ChatMessageRatingType) kept locally in flowise-server because TypeScript doesn't allow clean re-export of runtime values with type usage
- Interfaces successfully re-exported as types
- flowise-server has extended IReactFlowNode/IReactFlowObject with more fields than chatmessage-srv (position, handleBounds, etc.)

**Build**: 38/38 packages successful ✅

---

### 2025-11-29: ChatMessage Package Extraction ✅

**Summary**: Extracted ChatMessage/Feedback functionality from flowise-server into separate package `@universo/flowise-chatmessage-srv`. Renamed frontend package `@flowise/chatmessage` → `@flowise/chatmessage-frt`. Full DI pattern with factory functions. Build successful: 38/38 packages.

**Packages Created/Modified**:
- `packages/flowise-chatmessage-srv/base/` - Backend package with full DI pattern
- `packages/flowise-chatmessage-frt/base/` - Frontend package (renamed)

**Key Design Decisions**:
1. **DI Factory Pattern**: All components use factory functions:
   - `createChatMessagesService(config)` - with DataSource, logger, abortController, queueManager
   - `createFeedbackService(dataSource)` - TypeORM repository pattern
   - `createChatMessagesController(service)` - Express request handlers
   - `createFeedbackController(service)` - CRUD handlers
   - `createChatMessagesRouter(controller)` - Express Router
   - `createFeedbackRouter(controller)` - Express Router
2. **Consolidated Migration**: Single `1693891895163-AddChatMessage.ts` with IF NOT EXISTS clauses for both tables
3. **Full Type Exports**: MessageType, ChatType, ChatMessageRatingType enums; IChatMessage, IChatMessageFeedback, GetChatMessageParams, IReactFlowNode, IReactFlowObject interfaces
4. **Zod Validation**: createFeedbackSchema, updateFeedbackSchema for feedback endpoints

**Package Structure**:
```
flowise-chatmessage-srv/base/
├── src/
│   ├── Interface.ts (types & enums)
│   ├── database/
│   │   ├── entities/ (ChatMessage, ChatMessageFeedback)
│   │   └── migrations/postgres/ (AddChatMessage)
│   ├── services/ (chatMessagesService, feedbackService)
│   ├── controllers/ (chatMessagesController, feedbackController)
│   ├── routes/ (chatMessagesRouter, feedbackRouter)
│   └── index.ts
├── README.md, README-RU.md
```

**flowise-server Integration**:
- package.json: Added @universo/flowise-chatmessage-srv dependency
- entities/index.ts: Imports entities from new package
- migrations/index.ts: Added chatMessageMigrations after Init
- Init.ts: Removed chat_message table creation (moved to package)
- All service/controller files updated to import types from new package

**Build Fixes Applied**:
1. Added IReactFlowNode, IReactFlowObject interfaces to Interface.ts
2. Changed feedbackTypeFilters → feedbackTypes in controller calls
3. Added chatMessageEntities export to entities/index.ts
4. Fixed rating type casting in feedbackService.updateFeedback

**Files Deleted from flowise-server**:
- `src/database/entities/ChatMessage.ts`
- `src/database/entities/ChatMessageFeedback.ts`

**Build**: 38/38 packages successful ✅

---

### 2025-11-29: Leads Package Extraction ✅

**Summary**: Extracted Leads functionality from flowise-server into separate packages `@universo/flowise-leads-srv` and `@universo/flowise-leads-frt`. Fixed critical bugs in ChatMessage.jsx and Analytics.jsx where leadsApi was undefined. Build successful: 46/46 packages.

**Packages Created**:
- `packages/flowise-leads-srv/base/` - Backend package with DI pattern (entity, service, routes, migration)
- `packages/flowise-leads-frt/base/` - Minimal frontend package (namespace exports only)

**Key Design Decisions**:
1. **DI Factory Pattern**: `createLeadsService(config)`, `createLeadsRouter(service)` - following Tools/Credentials/Assistants pattern
2. **Migration Split**: `AddLead` migration moved to new package; `AddLeadToChatMessage` stays in flowise-server (modifies chat_message table)
3. **API Client Implementation**: LeadApi class in `@universo/api-client` with getCanvasLeads(), addLead() methods
4. **No Component Copying**: Frontend package only exports types/namespace, components remain in flowise-template-mui

**Bug Fixes**:
1. **ChatMessage.jsx**: Added `const leadsApi = api.leads` after api import (was undefined, breaking lead capture)
2. **Analytics.jsx**: Replaced deprecated `import leadsApi from '@/api/lead'` with `@universo/api-client`
3. **Legacy Cleanup**: Deleted obsolete `flowise-ui/src/api/lead.js`

**Files Deleted from flowise-server**:
- `src/database/entities/Lead.ts`
- `src/services/leads/index.ts`
- `src/controllers/leads/index.ts`
- `src/routes/leads/index.ts`
- `src/database/migrations/postgres/1710832137905-AddLead.ts`

---

### 2025-11-29: Assistants API Clean Refactoring ✅

**Summary**: Complete refactoring of Assistants frontend components to use modern API methods from `@universo/api-client`. Removed ~120 lines of legacy aliases. Following industry-standard pattern: `unikId` always first argument (like GitHub, Stripe, Firebase APIs).

**Key API Method Mappings Applied**:
| Legacy | Modern | Arg Change |
|--------|--------|------------|
| `getAllAssistants(type, unikId)` | `getAll(unikId, type)` | Swapped |
| `getSpecificAssistant(id, unikId)` | `getById(unikId, id)` | Swapped |
| `getAllAvailableAssistants(credId, unikId)` | `listOpenAIAssistants(unikId, credId)` | Swapped |
| `getAssistantObj(id, credId, unikId)` | `getOpenAIAssistant(unikId, id, credId)` | Swapped |
| `createNewAssistant(unikId, obj)` | `create(unikId, obj)` | Same |
| `updateAssistant(unikId, id, obj)` | `update(unikId, id, obj)` | Same |
| `deleteAssistant(unikId, id, bool)` | `delete(unikId, id, bool)` | Same |
| `*AssistantVectorStore(...)` | `*VectorStore(unikId, ...)` | Swapped |
| Response: `resp.data.id` | `resp.id` | Direct access |

**Runtime Fixes Applied**:
1. **`this` context loss in useApi**: Wrap class methods in arrow functions - `useApi((...args) => api.assistants.getAll(...args))`
2. **Missing CredentialInputHandler dropdown**: Use `canvas/CredentialInputHandler` (not `dialogs/`) for `type: 'credential'`
3. **i18n interpolation**: Use double braces `{{variable}}` for i18next format
4. **Missing theme palette**: Add defensive fallback for `theme.palette.canvasHeader` (same pattern as CanvasHeader.jsx)
5. **Missing api import in AsyncDropdown**: Added `import { api } from '@universo/api-client'`

**Files Updated**:
- `universo-api-client/src/api/assistants.ts` - Removed legacy aliases (~120 lines)
- `CustomAssistantLayout.jsx`, `OpenAIAssistantLayout.jsx` - Updated API calls with arrow wrappers
- `LoadAssistantDialog.jsx` - Fixed CredentialInputHandler import (canvas/), updated API calls
- `AddCustomAssistantDialog.jsx`, `AssistantDialog.jsx` - All API calls updated with arrow wrappers
- `CustomAssistantConfigurePreview.jsx` - Added canvasHeaderPalette fallback, renamed hooks & API calls
- `AssistantVectorStoreDialog.jsx` - All VectorStore methods updated
- `PromptGeneratorDialog.jsx` - Added missing `api` import, updated generateInstructions call
- `AsyncDropdown.jsx` - Added missing `api` import
- `MainRoutesMUI.tsx` - Added missing route `/unik/:unikId/assistants/custom/:id`
- `flowise-assistants-frt/package.json` - Added export for CustomAssistantConfigurePreview
- `i18n/locales/*/assistants.json` - Fixed structure (removed nested object, changed to `{{type}}` format)

**Build**: 45/45 packages successful ✅

---

### 2025-11-28: Assistants Package Extraction ✅

**Summary**: Extracted Assistants functionality from flowise-server and flowise-ui into separate packages `@universo/flowise-assistants-srv` and `@universo/flowise-assistants-frt`. Following DI factory pattern from Tools/Credentials/Variables/ApiKey.

**New Packages Created**:
- `packages/flowise-assistants-srv/base/` - Backend service with Assistant entity, consolidated migration, DI-based service/controller/router
- `packages/flowise-assistants-frt/base/` - Frontend pages (Assistants, AssistantDialog, CustomAssistant, OpenAI) with i18n

**Key Architectural Decisions**:
- **DI Factory Pattern**: `createAssistantsService`, `createAssistantsController`, `createAssistantsRouter` with optional dependencies
- **Consolidated Migration**: Combined AddAssistantEntity + AddTypeToAssistant into single 1699325775451-AddAssistant.ts
- **Optional Dependencies**: Config includes nodesService, documentStoreRepository, nodesPool for flexible DI
- **MVP Approach**: Copied files with minimal changes, kept JSX for frontend compatibility
- **peerDependency**: flowise-template-mui uses peerDependency to avoid cyclic dependency with assistants-frt
- **i18n Pattern**: Side-effect imports with registerNamespace for lazy-loaded route components
- **react-i18next Pinning**: Pinned to 15.5.3 in pnpm catalog for i18next 23.x compatibility

**Consumer Package Updates**:
- `universo-template-mui`: Added dependency, updated MainRoutesMUI.tsx imports
- `flowise-template-mui`: Added peerDependency, updated NodeInputHandler.jsx AssistantDialog import

**Files Deleted**:
- `flowise-server/src/routes/assistants/`, `flowise-server/src/controllers/assistants-api/`, `flowise-server/src/controllers/openai-assistants/`, `flowise-server/src/services/assistants/`
- `flowise-server/src/database/entities/Assistant.ts`, `flowise-server/src/database/migrations/postgres/1699325775451-*.ts`
- `flowise-ui/src/views/assistants/`
- `spaces-frt/base/src/views/assistants/`, `spaces-frt/base/src/i18n/locales/*/views/assistants.json`

**Build**: 45/45 packages successful ✅

---

### 2025-11-28: P1 Bug Fixes - unikId Handling in ApiKey Validation ✅

**Summary**: Fixed two P1 bugs from PR #570 bot review related to unikId handling in API key validation.

**Bug 1: verify/index.ts route missing unikId parameter**
- Changed route from `/apikey/:apikey` to `/unik/:unikId/apikey/:apikey`
- Handler now correctly receives unikId from route params
- Updated WHITELIST_URLS in constants.ts to match new route pattern

**Bug 2: validateKey functions calling getAllApiKeys() without unikId**
- Added `getApiKeyById(id)` method to IApikeyService interface and implementation
- Updated `validateCanvasApiKey` to use `getApiKeyById(canvasApiKeyId)` instead of getAllApiKeys
- Updated `validateAPIKey` to extract unikId from req.params and pass to getApiKey

**Technical Changes**:
- `packages/flowise-apikey-srv/base/src/services/apikeyService.ts`: Added getApiKeyById method (works in both JSON and DB modes)
- `packages/flowise-server/src/routes/verify/index.ts`: Changed route to include unikId
- `packages/flowise-server/src/utils/constants.ts`: Updated WHITELIST_URLS
- `packages/flowise-server/src/utils/validateKey.ts`: Fixed both validation functions

**Build**: 44/44 packages successful

---

### 2025-11-28: ApiKey Package Extraction ✅

**Summary**: Extracted ApiKey functionality from flowise-server/flowise-ui into separate packages `@universo/flowise-apikey-srv` and `@universo/flowise-apikey-frt`. Following DI factory pattern from Tools/Credentials/Variables.

**New Packages Created**:
- `packages/flowise-apikey-srv/base/` - Backend service with ApiKey entity, migration, service with dual storage mode (JSON + DB), routes
- `packages/flowise-apikey-frt/base/` - Frontend pages (APIKey, APIKeyDialog, UploadJSONFileDialog) with i18n

**Key Architectural Decisions**:
- **Dual Storage Mode**: Service supports both JSON file storage and PostgreSQL via `ApikeyStorageConfig.type` ('json' | 'db')
- **DI Pattern**: createApikeyService/createApikeyRouter factory functions with config injection
- **Lazy Service Initialization**: validateKey.ts and verify routes use getApikeyService() for lazy loading
- **Zod Validation**: Routes use Zod for request validation with validateUnikId/validateApiKeyId middleware
- **i18n**: Namespace 'apiKeys' registration via registerNamespace from @universo/i18n/registry
- **UUID for IDs**: All ID generation uses uuid v4 for consistency with PostgreSQL migration

**QA Fixes Applied (2025-11-28)**:
- Fixed critical useApi pattern bug: `useApi(() => api.apiKeys.getAllAPIKeys(unikId))` (arrow function required for lazy evaluation)
- Unified ID format to UUID across Entity (`@PrimaryGeneratedColumn('uuid')`), Service (uuidv4()), and jsonStorage (uuidv4())
- Added replaceAll mode handling in importKeysToJson()
- Applied Prettier formatting to all 12 backend TypeScript files

**API Client**:
- Implemented ApiKeyApi class in universo-api-client with getAllAPIKeys, createNewAPI, updateAPI, deleteAPI, importAPI methods
- Types: ApiKey, CreateApiKeyPayload, UpdateApiKeyPayload, ImportApiKeysPayload

**Files Deleted**:
- `flowise-server/src/routes/apikey/`
- `flowise-server/src/controllers/apikey/`
- `flowise-server/src/services/apikey/`
- `flowise-server/src/utils/apiKey.ts`
- `flowise-server/src/database/entities/ApiKey.ts`
- `flowise-server/src/database/migrations/postgres/1720230151480-AddApiKey.ts`
- `flowise-ui/src/views/apikey/`
- `universo-i18n/base/src/locales/en/views/api-keys.json`
- `universo-i18n/base/src/locales/ru/views/api-keys.json`
- `spaces-frt/base/src/i18n/locales/en/views/api-keys.json`
- `spaces-frt/base/src/i18n/locales/ru/views/api-keys.json`

**Build**: 44/44 packages successful ✅

---

### 2025-11-28: Variables Package Extraction ✅

**Summary**: Extracted variables functionality from flowise-server/flowise-ui into separate packages `@universo/flowise-variables-srv` and `@universo/flowise-variables-frt`.

**New Packages Created**:
- `packages/flowise-variables-srv/base/` - Backend service with Variable entity, migration, service with DI, routes
- `packages/flowise-variables-frt/base/` - Frontend pages (Variables, AddEditVariableDialog, HowToUseVariablesDialog) with i18n

**Key Architectural Decisions**:
- **DI Pattern**: variablesService requires dataSource injection, consistent with tools/credentials pattern
- **Zod Validation**: variablesRoutes uses Zod for request validation with middleware
- **i18n**: Namespace registration via side-effect import in MainRoutesMUI.tsx
- **Export-import**: Uses direct repository query (like Tools) instead of service dependency

**Files Deleted**:
- `flowise-server/src/routes/variables/`
- `flowise-server/src/controllers/variables/`
- `flowise-server/src/services/variables/`
- `flowise-server/src/database/entities/Variable.ts`
- `flowise-server/src/database/migrations/postgres/1702200925471-AddVariableEntity.ts`
- `flowise-ui/src/views/variables/`
- `universo-i18n/base/src/locales/en/views/variables.json`
- `universo-i18n/base/src/locales/ru/views/variables.json`
- `spaces-frt/base/src/i18n/locales/en/views/variables.json` (duplicate)
- `spaces-frt/base/src/i18n/locales/ru/views/variables.json` (duplicate)

**Build**: 43/43 packages successful ✅

---

## January 2026

### 2026-01-28: Credentials API Migration Fix ✅

**Summary**: Fixed Credentials page and related components to use correct @universo/api-client method names.

**Root Cause**: Components were migrated from flowise-ui but still using old API method names (`getAllCredentials`, `createCredential`, etc.), while @universo/api-client uses different names (`getAll`, `create`, etc.).

**API Method Mapping**:
| Old (flowise-ui) | New (@universo/api-client) |
|------------------|----------------------------|
| `getAllCredentials` | `getAll` |
| `getAllComponentsCredentials` | `getAllComponents` |
| `getSpecificCredential` | `getById` |
| `getSpecificComponentCredential` | `getComponentSchema` |
| `createCredential` | `create` |
| `updateCredential` | `update` |
| `deleteCredential` | `delete` |
| `getCredentialsByName` | `getByName` |

**Files Fixed (4)**:
- `flowise-credentials-frt/pages/Credentials.jsx`
- `flowise-template-mui/CredentialInputHandler.jsx`
- `flowise-template-mui/AddEditCredentialDialog.jsx`
- `flowise-template-mui/AsyncDropdown.jsx`

**Additional Fixes**:
- Removed `.data` wrapper access (new API returns data directly from axios response)
- Fixed useApi hook calls to use arrow functions for methods that need parameters

**Build**: 42/42 packages ✅

---

### 2026-01-27: QA Fixes - useApi Shim & i18n ✅

**Summary**: Fixed critical bugs discovered during browser testing of Tools and Credentials packages.

**Root Cause Analysis**:
1. **useApi hook returning null data**: `flowise-template-mui/hooks/useApi.js` was a **build-time stub** returning `{ data: null, loading: false }`. Real implementation was in nested `hooks/hooks/useApi.jsx`.
2. **CredentialListDialog showing i18n keys**: Double namespace - `useTranslation('credentials')` + `t('credentials.key')`.
3. **AdminPanel dead code**: Calls `/api/v1/users` which doesn't exist in backend.

**Fixes Applied**:

| Task | Files Changed | Status |
|------|---------------|--------|
| Fix hooks/index.ts exports | hooks/index.ts | ✅ |
| Fix index.ts exports | src/index.ts | ✅ |  
| Fix package.json exports | package.json | ✅ |
| Delete stub files | useApi.js, useConfirm.js | ✅ |
| Fix 12 relative imports | ProfileSection, ToolDialog, etc. | ✅ |
| Fix i18n double namespace | CredentialListDialog.jsx | ✅ |
| Delete AdminPanel | up-admin/AdminPanel.jsx | ✅ |
| Remove AdminPanel route | MainRoutes.jsx | ✅ |

**Files Modified (flowise-template-mui/base/src)**:
- `hooks/index.ts` - export from `./hooks/` subfolder
- `index.ts` - export from `./hooks/hooks/`
- `package.json` - explicit `./hooks/useApi`, `./hooks/useConfirm` exports

**Files with Fixed Relative Imports (12)**:
- ProfileSection/index.jsx, ToolDialog.jsx, ViewLeadsDialog.jsx
- NodeInfoDialog.jsx, ExpandTextDialog.jsx, AddEditCredentialDialog.jsx
- ViewMessagesDialog.jsx, ExportAsTemplateDialog.jsx, PromptLangsmithHubDialog.jsx
- FlowListMenu.jsx, OverrideConfig.jsx, ConfirmDialog.jsx

**Files Deleted**:
- `flowise-template-mui/base/src/hooks/useApi.js` (stub)
- `flowise-template-mui/base/src/hooks/useConfirm.js` (stub)
- `flowise-ui/src/views/up-admin/AdminPanel.jsx`
- `flowise-ui/src/views/up-admin/` folder

**Build**: Full project (42/42 packages) ✅

---

### 2026-01-26: useApi → useMutation QA Fixes ✅

**Summary**: QA analysis identified and fixed remaining issues after main useApi → useMutation refactoring.

**Fixes Applied**:
| Task | Files Changed | Status |
|------|---------------|--------|
| handleInviteMember migration | 5 *Members.tsx pages | ✅ |
| uniks-frt useMemberMutations API | mutations.ts, UnikMember.tsx | ✅ |
| Delete unused useApi.ts | 7 files deleted (spaces-frt kept) | ✅ |
| refreshList duplication | N/A (part of ActionContext pattern) | ✅ |

**handleInviteMember Migration**:
- Replaced direct API calls with `useInviteMember().mutateAsync()`
- Removed manual `isInviting` state - now uses `inviteMember.isPending`
- Preserved special error handling (404 userNotFound, 409 alreadyMember)
- Packages: organizations-frt, projects-frt, storages-frt, metaverses-frt, clusters-frt

**uniks-frt API Unification**:
- `useMemberMutations(unikId)` now accepts unikId parameter like other packages
- Fixed incorrect usage in UnikMember.tsx (`useUpdateMemberRole(unikId)` → `useMemberMutations(unikId)`)

**Deleted Files (7)**:
- storages-frt/hooks/useApi.ts
- projects-frt/hooks/useApi.ts
- metaverses-frt/hooks/useApi.ts
- organizations-frt/hooks/useApi.ts
- uniks-frt/hooks/useApi.ts
- campaigns-frt/hooks/useApi.ts
- clusters-frt/hooks/useApi.ts
- Note: spaces-frt/hooks/useApi.ts retained (still used by useCanvases.ts)

**Build**: Full project (40/40 packages) ✅

---

## November 2025

### 2025-11-27: Credentials Package Extraction ✅

**Summary**: Extracted credentials functionality from flowise-ui/flowise-server into separate packages `@universo/flowise-credentials-srv` (backend) and `@universo/flowise-credentials-frt` (frontend), following the same pattern as Tools extraction.

**Backend Package (@universo/flowise-credentials-srv)**:
- TypeORM entity `Credential` with ManyToOne relation to Unik (CASCADE delete)
- Migration `1693891895165-AddCredentials.ts` (right after Init, before Tools)
- DI-based `createCredentialsService()` factory with encryption callbacks in config
- Express router factory `createCredentialsRouter()` with embedded controller logic
- Encryption utils stay in flowise-server, passed via DI to avoid circular dependencies:
  ```typescript
  const credentialsService = createCredentialsService({
      getDataSource,
      encryptCredentialData: async (data) => await encryptCredentialData(data),
      decryptCredentialData: async (encrypted, componentName?) => 
          await decryptCredentialData(encrypted, componentName, appServer.nodesPool.componentCredentials)
  })
  ```

**Frontend Package (@universo/flowise-credentials-frt)**:
- Source-only package with peerDependencies (react, @mui, @universo/*)
- Moved Credentials page from flowise-ui/src/views/credentials
- i18n with registerNamespace pattern (en/ru translations)
- TypeScript module declarations added to universo-template-mui

**Key Architecture Decisions**:
- **DI for Encryption**: Avoids circular deps (credentials-srv ← flowise-server → credentials-srv)
- **Migration Order**: Init (163) → Tools (164) → Credentials (165) → other migrations
- **No Legacy Code**: Deleted all old files (entity, service, controller, routes, flowise-ui views, i18n JSONs)

**Files Changed**:
- Created: 16 new files in 2 packages
- Modified: ~10 files in flowise-server, universo-template-mui, universo-i18n
- Deleted: ~12 files (old credentials from flowise-server, flowise-ui, universo-i18n)

**Build**: 42/42 packages successful ✅

**Pending**: User testing (migrations, browser CRUD operations)

---

### 2025-11-27: Tools Package Extraction ✅

**Summary**: Extracted tools functionality from flowise-ui/flowise-server into separate packages `@universo/flowise-tools-srv` (backend) and `@universo/flowise-tools-frt` (frontend).

**Backend Package (@universo/flowise-tools-srv)**:
- TypeORM entity `Tool` with ManyToOne relation to Unik
- Consolidated migration `1748400000000-AddTools.ts` (idempotent, after uniks migration)
- DI-based `createToolsService()` factory with telemetry/metrics
- Express router factory `createToolsRouter()` with embedded controller logic
- Removed old Init migration tool table, deleted ModifyTool migration

**Frontend Package (@universo/flowise-tools-frt)**:
- Source-only package with peerDependencies
- Moved Tools page from flowise-ui/src/views/tools
- TypeScript module declarations added to consuming packages

**API Client Updates**:
- Added `CustomTool` type (distinct from component Tool)
- CRUD methods: `getCustomTools`, `createCustomTool`, `updateCustomTool`, `deleteCustomTool`
- Endpoints: `/unik/${unikId}/tools` pattern

**Files Deleted** (flowise-server):
- `src/services/tools/` directory
- `src/controllers/tools/` directory  
- `src/routes/tools/` directory
- Old migrations: `1693997339912-ModifyTool.ts`

**Bot Review Fixes (PR #564)**:
- Registered `toolsErrorHandler` middleware in flowise-server routes/index.ts
- Removed duplicate `zod` from devDependencies in package.json
- Removed 3 redundant `typeof req.params === 'undefined'` checks in toolsRoutes.ts
- Kept `dbResponse.affected ?? undefined` (TypeORM DeleteResult.affected can be null)

**Build**: 41/41 packages successful

**Testing Pending**: Database migrations, browser functional testing

---

### 2025-11-25: PR #560 Bot Comments QA ✅

**Copilot Issues Fixed (3)**:
- Removed unused `authUserRepo` variable in campaignsRoutes.test.ts:320
- Removed unused `response` variable in campaignsRoutes.test.ts:734
- Removed unused `initializeCampaignsRateLimiters` import from routes/index.ts

**Gemini Issues Fixed (2)**:
- Fixed displayName `'clusters-srv'` → `'campaigns-srv'` in jest.config.js (HIGH priority)
- Renamed test file `clustersRoutes.test.ts` → `campaignsRoutes.test.ts`

**Deferred**: useApi → useMutation refactoring (MEDIUM) - requires changes across multiple packages (storages-frt, campaigns-frt, metaverses-frt). Architectural decision for separate PR.

**Lint**: campaigns-srv ✅ 0 errors, 0 warnings

---

### 2025-11-25: QA Fixes & Documentation Cleanup ✅

**Completed**:
- Fixed unused `t` variable in ClusterMembers.tsx (lint 0 errors)
- Fixed campaigns-frt README.md: 19+ replacements (package name, routes, links)
- Fixed clusters-frt README.md/README-RU.md: route paths, related packages links
- All README files: 384 lines each (perfect bilingual parity)

**Pattern Applied**: Plural for lists (`/campaigns`), singular for detail pages (`/campaign/:id`)

---

### 2025-11-25: AR.js Node Connections Mode Fix ✅

**Problem**: `ReferenceError: quizState is not defined` in "Соединение узлов" mode.

**Root Cause**: Nested template literal in `finishQuiz()` (line ~2605) evaluated `quizState.points` at compile-time.

**Solution**: Changed to string concatenation pattern in `generateNodeBasedScript()`.

**File**: `packages/template-quiz/base/src/arjs/handlers/DataHandler/index.ts`

**Build**: template-quiz (3.9s), full project (40/40 packages, 4m 13s)

---

### 2025-11-24: Storages i18n Architecture Fix ✅

**Problem**: Module-specific keys in common.json, wrong translation function usage.

**Solution**:
- Removed duplicates from storages.json (name, description, role)
- Removed module-specific keys from common.json (containers, slots)
- Changed `tc('table.containers')` → `t('table.containers')` in StorageList
- Removed DEBUG code from ContainerList/SlotList

**Files Modified**: 9 files, 67 lines changed

---

### 2025-11-23: Documentation Comprehensive Update ✅

**Configuration Docs** (Phase 1):
- Full EN→RU sync: 22 files copied
- File renaming: running-flowise-* → running-up-*
- Branding fixes: Flowise → Universo Platformo (10 files)
- 7 core files translated to Russian

**Integrations Docs**:
- Full EN→RU sync: 249 files
- 10 critical README files translated
- 6 missing LangChain sections now documented

**Applications Docs** (7/9 phases):
- Main README rewritten: 593→234 lines
- 4 new module pages (Organizations, Clusters, Projects, Spaces)
- Obsolete directories deleted (finance, resources, entities)
- Both EN/RU SUMMARY.md updated

**Documentation QA** (12/12 tasks):
- Priority 1: 6 critical issues fixed
- Priority 2: 16 new files created (frontend/backend docs for all major modules)

---

### 2025-11-22: i18n & ItemCard Fixes ✅

**i18n Refactoring**:
- Centralized `members` keys in common.json
- Decentralized module-specific table keys
- Updated 16+ files across 5 modules

**ItemCard Click Handling**:
- Replaced RouterLink with "Overlay Link" pattern
- Menu button z-index: 10, Link z-index: 5
- Fixed event propagation issues

**PR #554 Fixes**:
- RLS policy for organizations_users updated
- Unused variables removed
- ItemCard.test.tsx updated for new pattern

---

### 2025-11-17-18: Projects Integration & AR.js Fixes ✅

**Projects Integration**:
- 23 issues fixed (11 QA + 12 runtime)
- Router registered in flowise-server
- All pages loading, correct menu navigation
- Terminology consistency: "Этапы" throughout Russian UI

**AR.js InteractionMode**:
- Added interactionMode to LOAD_SETTINGS payload
- Fixed nested template string interpolation
- Line endings normalized: 260 files (CRLF→LF)
- Created .gitattributes for consistent line endings

---

### 2025-11-14: Code Quality & Clusters ✅

**Guards Factory** (auth-srv):
- Created `createAccessGuards<TRole, TMembership>` factory
- Refactored metaverses-srv and clusters-srv guards (~460 lines → ~150 lines)

**M2M Logic Fix**:
- Fixed `ensureSectionAccess` to check ALL linked metaverses
- Added LOWER(email) index to 3 migrations

**Cluster Breadcrumbs**:
- Created `useClusterName` hook with Map caching
- Support for /clusters/:id, /access, /resources, /domains

**QA for PR #545**:
- Fixed ensureDomainAccess M2M support
- Cleaned devDependencies: 51→19 packages
- Removed debug console.log from ClusterList

---

### 2025-11-13: Uniks & Space Builder ✅

**Uniks Refactoring** (Stages 1-8):
- Route cleanup, type definitions updated
- Backend: spacesCount/toolsCount metrics
- i18n: Updated board.stats keys
- Architecture: Uniks independent from Metaverses

**UnikBoard Dashboard**:
- Expanded from 3 to 7 metric cards
- Added: Credentials, Variables, API Keys, Documents
- Fixed apikey table reference
- Orthography: "Учетные данные" → "Учётные данные" (8 files)

**Space Builder**:
- Dedicated namespace registration
- `useTranslation('spaceBuilder')` binding

---

### 2025-11-06-12: i18n Phases & Module Stabilization ✅

**i18n Systematic Fixes**:
- Phase 1-5: Singleton binding, colon syntax, namespace registration
- Fixed double namespace bug: `t('canvas:key')` with `useTranslation('canvas')`
- 30 packages built successfully

**Metaverse Module**:
- Dashboard: 3 stat cards + 2 charts
- Universal List Pattern applied
- N+1 query optimization
- React StrictMode production fix

---

## October 2025

**Key Achievements**:
- Rate limiting with Redis implementation
- i18n migration to TypeScript
- tsdown build system migration (all packages)
- Publication system 429 errors resolved
- Chatflow→Canvas terminology refactoring
- Canvas versioning backend
- Space Builder enhancements
- Passport.js session hardening

---

## September 2025

**Key Achievements**:
- AR.js configuration management
- TanStack Query pagination patterns
- Resources/Entities cluster isolation
- i18n docs consistency checker
- GitHub Copilot modes
- Metaverses module introduction
- Singular routing pattern

---

## August 2025 (Summary)

- 0.27.0-alpha: Language switcher, MMOOMM template, Finance module
- 0.26.0-alpha: MMOOMM modular package, Multiplayer Colyseus server
- 0.25.0-alpha: Space Builder MVP, Metaverse module, @universo/types

---

## July-Earlier 2025 (Summary)

- 0.24.0-alpha: Space Builder, UPDL nodes, AR.js wallpaper mode
- 0.23.0-alpha: Russian docs translation, UPDL conditional params
- 0.22.0-alpha: Memory Bank rules, MMOOMM laser mining, resource system
- 0.21.0-alpha: Handler refactoring, PlayCanvas MMOOMM stabilization
- 0.20.0-alpha: UPDL node refactoring, Template-First architecture
- Pre-alpha (0.10-0.19): Flowise integration, Supabase auth, UPDL basics

---

**Note**: For detailed implementation logs, see Git history. For current work → tasks.md. For patterns → systemPatterns.md.
