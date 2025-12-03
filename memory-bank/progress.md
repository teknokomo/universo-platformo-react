# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.39.0-alpha | 2025-11-26 | Mighty Campaign 🧙🏿 | Campaigns module, package extractions (7 packages), QA fixes |
| 0.38.0-alpha | 2025-11-22 | Secret Organization 🥷 | Organizations module, Projects management, AR.js Quiz Nodes, Member i18n refactor |
| 0.37.0-alpha | 2025-11-14 | Smooth Horizons 🌅 | REST API docs refactoring, Uniks metrics update, UnikBoard expansion, Clusters breadcrumbs |
| 0.36.0-alpha | 2025-11-07 | Revolutionary indicators 📈 | Date formatting migration to dayjs, TypeScript refactor, publish-frontend architecture improvements, Dashboard analytics charts |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n refactoring migration, TypeScript type safety, Rate limiting with Redis, RLS integration analysis |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication System fixes (429 errors, API modernization), Metaverses module architecture refactoring, Quiz timer feature |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas version metadata editing, Chatflow→Canvas terminology refactoring, Opt-in PostHog telemetry, Metaverses pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Manual quiz editing workflow, Unik deletion cascade fixes, Space Builder modes, Material-UI template system |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript path aliases standardization, Global publication library management, Analytics hierarchical selectors |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities cluster isolation architecture, i18n docs consistency checker, GitHub Copilot modes |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Metaverses dashboard, Universal List Pattern |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Language switcher, MMOOMM template, Finance module |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Multiplayer Colyseus server |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder MVP, Metaverse module, @universo/types |

---

## January 2025

### 2025-01-22: Flowise Core Packages Naming Refactoring ✅

**Summary**: Major restructuring of core Flowise packages.

**Package Renames**:
| Old Path | New Path | New Name |
|----------|----------|----------|
| `packages/flowise-ui/` | `packages/flowise-core-frontend/base/` | `@flowise/core-frontend` |
| `packages/flowise-server/` | `packages/flowise-core-backend/base/` | `@flowise/core-backend` |
| `packages/flowise-components/` | `packages/flowise-components/base/` | (unchanged) |
| `packages/universo-api-client/` | `packages/universo-api-client/base/` | (unchanged) |

**Key Changes**:
- Updated `getNodeModulesPackagePath()` in backend
- Fixed ~50 tsconfig.json files with `types: ["node"]`
- Fixed vite.config.js path aliases

Build: 50/50 successful (4m26s)

---

### 2025-01-20: Spaces Backend Improvements ✅

**Zod Validation Schemas**:
- Created `spaces-backend/src/schemas/index.ts` (~220 lines)
- Controller reduced ~30% (750→515 lines)
- Schemas: CreateSpaceSchema, UpdateSpaceSchema, CreateCanvasSchema, etc.
- Helpers: `extractUnikId()`, `formatZodError()`, `validateBody()`

**System Status Fields**:
- Spaces: 9 new columns (versioning + status)
- Canvases: 4 new columns (status only)
- Partial indexes for performance
- RLS policies updated

**Canvas Versions API**:
- `api.canvasVersions` added to @universo/api-client
- Methods: list, create, update, activate, remove

**Migration Consolidation**:
- 7 chat_flow migrations merged into spaces-backend
- ChatflowType → CanvasType renamed

Build: 50/50 successful

---

### 2025-01-19: CustomTemplates Package Extraction ✅

**Packages Created**:
- `@flowise/customtemplates-backend`: entity, migration, DI service
- `@flowise/customtemplates-frontend`: Templates pages, i18n

**API Client**: MarketplacesApi with full CRUD

**Naming Migration**: Marketplaces → Templates complete

**QA Cleanup**:
- Deleted VectorStore duplicates from template-mui
- Updated imports in spaces-frontend
- Deleted flowise-ui/views/marketplaces/

Build: 50/50 successful

---

## December 2025

### 2025-12-01-02: DocumentStore Full Migration ✅

**Backend (@flowise/docstore-backend)**:
- 3 entities, 4 DI services, consolidated migration
- Clean Integration pattern for CRUD delegation

**Frontend (@flowise/docstore-frontend)**:
- 20 JSX files, merged i18n

**Fixes**:
- 403 error on Preview & Process
- i18n interpolation format

Build: 48/48 successful

---

## November 2025

### 2025-11-29: ChatMessage Full Migration ✅

**Summary**: Completed full migration to @universo/flowise-chatmessage-backend.

**Changes**:
- Utility wrappers for buildCanvasFlow compatibility
- Deleted 10 legacy migrations
- All services/controllers/routes deleted from flowise-server

Build: 38/38 successful

---

### 2025-11-29: Leads Package Extraction ✅

**Packages**: @universo/flowise-leads-backend, @universo/flowise-leads-frontend (minimal)

**Bug Fixes**: ChatMessage.jsx and Analytics.jsx leadsApi undefined

Build: 46/46 successful

---

### 2025-11-28-29: Assistants Package Extraction ✅

**Backend**: @universo/flowise-assistants-backend with DI pattern
- Consolidated migration, optional dependencies config
- Fixed cyclic dependency via peerDependency

**Frontend**: @universo/flowise-assistants-frontend
- 8 JSX pages, i18n, side-effect imports

**API Refactoring**: Modern method names, unikId-first pattern

Build: 45/45 successful

---

### 2025-11-28: ApiKey Package Extraction ✅

**Backend**: @universo/flowise-apikey-backend
- Dual storage mode (JSON + DB)
- UUID for IDs, Zod validation

**Frontend**: @universo/flowise-apikey-frontend
- 3 pages, i18n

Build: 44/44 successful

---

### 2025-11-28: Variables Package Extraction ✅

**Packages**: @universo/flowise-variables-backend, @universo/flowise-variables-frontend

Build: 43/43 successful

---

### 2025-11-27: Credentials Package Extraction ✅

**Backend**: @universo/flowise-credentials-backend
- Encryption via DI callbacks

**Frontend**: @universo/flowise-credentials-frontend

Build: 42/42 successful

---

### 2025-11-27: Tools Package Extraction ✅

**Backend**: @universo/flowise-tools-backend
- DI service with telemetry
- Migration order: Init → Tools → Credentials

**Frontend**: @universo/flowise-tools-frontend

Build: 41/41 successful

---

### 2025-11-25-27: QA Fixes ✅

**useApi → useMutation**: 7 packages, ~2000 lines mutations.ts created

**Bot Review Fixes**: PR #560, #564, #566

**AR.js**: Fixed quizState error in Node Connections mode

**useApi Shim**: Fixed flowise-template-mui hooks exports

Build: 40/40+ successful

---

### 2025-11-22-24: Documentation & i18n ✅

**Documentation**:
- Configuration docs: 22 files synced EN→RU
- Integrations docs: 249 files synced
- Applications docs: README rewritten, 4 new module pages

**i18n**:
- Members keys centralized in common.json
- Module-specific table keys decentralized
- Storages architecture fixed

---

### 2025-11-17-18: Projects Integration ✅

- 23 issues fixed
- Router registered, all pages loading
- Terminology: "Milestones" (RU) unified throughout UI

---

### 2025-11-13-14: Uniks & Code Quality ✅

**Uniks Refactoring**:
- UnikBoard: 3→7 metric cards
- Backend: spacesCount/toolsCount metrics

**Code Quality**:
- `createAccessGuards` factory in auth-backend
- Cluster breadcrumbs with useClusterName hook
- M2M logic fix in ensureSectionAccess

---

## October 2025 (Summary)

- **0.35.0-alpha** (2025-10-30): Rate limiting with Redis, i18n TypeScript migration
- **0.34.0-alpha** (2025-10-23): Global monorepo refactoring, tsdown build system
- **0.33.0-alpha** (2025-10-16): Publication System 429 fixes, Quiz timer
- **0.32.0-alpha** (2025-10-09): Canvas versioning, Chatflow→Canvas terminology
- **0.31.0-alpha** (2025-10-02): Manual quiz editing, Material-UI template system

---

## September 2025 (Summary)

- **0.30.0-alpha** (2025-09-21): TypeScript path aliases, Analytics hierarchical selectors
- **0.29.0-alpha** (2025-09-15): Cluster isolation architecture, Copilot modes
- **0.28.0-alpha** (2025-09-07): Metaverses dashboard, Universal List Pattern

---

## August 2025 (Summary)

- **0.27.0-alpha** (2025-08-31): Language switcher, MMOOMM template
- **0.26.0-alpha** (2025-08-24): Multiplayer Colyseus server
- **0.25.0-alpha** (2025-08-17): Space Builder MVP, @universo/types

---

## July 2025 and Earlier (Archive)

For detailed historical entries, see Git history:
- 0.24.0-alpha: Space Builder, UPDL nodes, AR.js wallpaper mode
- 0.23.0-alpha: Russian docs translation, UPDL conditional params
- 0.22.0-alpha: Memory Bank rules, MMOOMM laser mining
- 0.21.0-alpha: Handler refactoring, PlayCanvas stabilization
- 0.20.0-alpha: UPDL node refactoring, Template-First architecture
- Pre-alpha (0.10-0.19): Flowise integration, Supabase auth, UPDL basics

---

**Last Updated**: 2025-12-03

**Note**: For current work → tasks.md. For patterns → systemPatterns.md.

---

## Detailed Entry Archive (Last 3 Months)

### 2025-11-06-12: i18n Systematic Fixes ✅

**Phase 1-5 Completion**:
- Singleton binding pattern established
- Colon syntax standardized across all packages
- Namespace registration via side-effect imports
- Fixed double namespace bug: `t('canvas:key')` with `useTranslation('canvas')`
- 30 packages built successfully

**Key Fixes**:
- react-i18next pinned to 15.5.3 for i18next 23.x compatibility
- registerNamespace pattern for lazy-loaded routes
- Feature packages own their translations (docstore, tools, credentials)

---

### 2025-11-04-05: Metaverse Module Stabilization ✅

**Dashboard Improvements**:
- 3 stat cards + 2 charts
- Universal List Pattern applied across all entity lists
- TanStack Query with proper key factories

**Performance**:
- N+1 query optimization in member lists
- React StrictMode production fix (conditional wrapper)
- COUNT(*) OVER() for efficient pagination

---

### Architecture Decisions Log

**DI Factory Pattern** (November 2025):
- All new packages use `createXxxService(config)` factory pattern
- Config includes: dataSource, optional providers, callbacks
- Enables testing without full app context
- Applied to: Tools, Credentials, Variables, ApiKey, Assistants, ChatMessage, Leads, DocStore

**Package Extraction Strategy**:
1. Create backend package with entity, migration, DI service
2. Create frontend package with pages, i18n
3. Update flowise-server imports
4. Delete legacy files
5. Build and verify

**Migration Consolidation**:
- Each package has single consolidated migration
- Idempotent with IF NOT EXISTS clauses
- No destructive down() migrations in production

---

### Package Count Evolution

| Date | Package Count | Notes |
|------|---------------|-------|
| 2025-12-03 | 50 | After core package renaming |
| 2025-12-01 | 48 | After DocumentStore extraction |
| 2025-11-29 | 46 | After Leads extraction |
| 2025-11-28 | 44-45 | After Assistants/ApiKey extraction |
| 2025-11-27 | 41-43 | After Tools/Credentials/Variables |
| 2025-11-22 | 40 | Before package extraction sprint |

---

### Key Technical Decisions

**TypeORM Repository Pattern**:
- All DB access via `getDataSource().getRepository(Entity)`
- User context for RLS policies
- No direct SQL queries in service code

**TanStack Query v5**:
- Query key factories for cache invalidation
- useQuery for declarative data fetching
- useMutation for state changes (replaced custom useApi)

**i18n Architecture**:
- Core namespaces in @universo/i18n
- Feature packages ship own translations
- registerNamespace for runtime registration

---

### Build System Notes

**pnpm Workspace**:
- Run commands from root only
- `pnpm --filter <package> build` for single package
- `pnpm build` for full workspace (required for cross-deps)

**tsdown Build**:
- Dual output: CJS + ESM
- Path aliases: `@/*` → `src/*`
- Type declarations generated

---

### Known Issues & Workarounds

**Template MUI CommonJS Shims** (DEFERRED):
- flowise-ui ESM/CJS conflict
- Workaround: Direct imports from source packages
- Future: Extract to @universo package with dual build

**useApi Context Loss**:
- Class methods lose `this` when passed to hooks
- Solution: Wrap in arrow functions `(...args) => api.method(...args)`

**React StrictMode**:
- Causes double-mount in React 18
- Solution: Conditional wrapper (dev only)

---
