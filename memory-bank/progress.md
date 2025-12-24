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

## 📅 2025-12-23

### Auth/RLS: Fix Role Change Breaking Admin Schema Access ✅

- **Issue**: After previous RLS fix, `SET role = 'authenticated'` caused "permission denied for schema admin" errors when calling `admin.is_superuser()` and similar functions.
- **Root Cause**: The `authenticated` role doesn't have USAGE privilege on `admin` schema.
- **Fix**: Removed `SET role = 'authenticated'` entirely — RLS policies only need `request.jwt.claims` for `auth.uid()` to work; no role change required.

**Critical Pattern Discovered**: NEVER use `SET role = 'authenticated'` in RLS context setup. The `authenticated` role lacks USAGE on `admin` schema. RLS works purely from `request.jwt.claims`.

**Files:**
- `packages/auth-backend/base/src/utils/rlsContext.ts` - Removed SET role line
- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts` - Removed RESET role from cleanup

**Build Status:** ✅ Full workspace `pnpm build` successful

### Auth/RLS: Fix request-scoped context persistence ✅

- Fixed `@universo/auth-backend` RLS context propagation: session role and `request.jwt.claims` are now set at session scope (not transaction-local), and are reset during middleware cleanup before releasing the pooled connection.
- This prevents `auth.uid()` from becoming `NULL` across subsequent queries and fixes "empty list" symptoms under RLS.

**Files:**
- `packages/auth-backend/base/src/utils/rlsContext.ts`
- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`

**Build Status:** ✅ Full workspace `pnpm build` successful

### Metahubs: VLC Rendering & Breadcrumb Fixes ✅

- Fixed Metahub list/detail pages crashing when VLC objects were rendered as strings (React invariant / `.slice` runtime errors).
- Added VLC-aware extraction/conversion utilities and updated Metahubs UI to use Display types for rendering.
- Hardened `@universo/template-mui` breadcrumb name hook to extract a localized string from VLC/SimpleLocalizedInput before truncation.

**Build Status:** ✅ `pnpm build --filter @flowise/core-frontend` and `pnpm --filter @universo/template-mui build`

### Metahubs: Sidebar Menu & Legacy Route Redirects ✅

- Redirected legacy Metahub UI URLs to the new Hub-based route:
  - `/metahub/:metahubId/entities` → `/metahub/:metahubId/hubs`
  - `/metahub/:metahubId/sections` → `/metahub/:metahubId/hubs`
- Added missing shared menu translations for the new Metahubs terminology (`hubs`, `attributes`, `records`).

**Build Status:** ✅ Full workspace `pnpm build` successful

### Metahubs: Pagination Data Access Fix ✅

**Issue:** `HubList`, `AttributeList`, and `RecordList` pages were calling `.map()` on a `PaginatedResponse<T>` object instead of its `items` array, causing `TypeError: l.map is not a function` crashes.

**Root Cause:** The `usePaginated` hook returns `{ data: PaginatedResponse<T>, ... }` where `PaginatedResponse = { items: T[], pagination: {...} }`. Pages were destructuring `data` directly as the array:
```typescript
// ❌ BEFORE:
const { data: hubs, isLoading, error } = paginationResult
// Then: hubs.map(...) crashes because hubs is { items: [], pagination: {} }

// ✅ AFTER:
const { data, isLoading, error } = paginationResult
const hubs = data?.items || []
// Now: hubs.map(...) works correctly
```

**Fixes Applied:**
- `packages/metahubs-frontend/base/src/pages/HubList.tsx` - Extract `hubs` from `data?.items`
- `packages/metahubs-frontend/base/src/pages/AttributeList.tsx` - Extract `attributes` from `data?.items`
- `packages/metahubs-frontend/base/src/pages/RecordList.tsx` - Extract `records` from `data?.items`

**Backend Verification:** Confirmed `/metahubs/:id/hubs` endpoint returns correct structure:
```typescript
res.json({ items: hubs, pagination: { total: hubs.length, limit: 100, offset: 0 } })
```

**Removed Legacy Routes:** Deleted unused `/entities` and `/sections` redirect routes from `MainRoutesMUI.tsx` (no longer needed, pages don't exist).

**Build Status:** ✅ `pnpm build --filter metahubs-frontend` successful (3.35s)

### Metahubs: i18n, Breadcrumbs, and Navigation Improvements ✅

**Issues Reported:**
1. i18n keys displayed raw instead of translations (e.g., "hubs.title" shown literally)
2. Breadcrumbs incomplete - Hub and Attribute names not showing in path
3. No obvious UI navigation to Records page after creating Attributes

**Root Cause 1 - i18n Consolidation:**
The `consolidateMetahubsNamespace()` function in `metahubs-frontend/base/src/i18n/index.ts` only extracted `metahubs`, `meta_sections`, `meta_entities`, `members` sections, but not the new `hubs`, `attributes`, `records` sections from the JSON bundle.

**Fix Applied:**
```typescript
const consolidateMetahubsNamespace = (bundle: any) => ({
    ...(bundle?.metahubs ?? {}),
    meta_sections: bundle?.meta_sections ?? {},
    meta_entities: bundle?.meta_entities ?? {},
    members: bundle?.members ?? {},
    hubs: bundle?.hubs ?? {},         // ← Added
    attributes: bundle?.attributes ?? {}, // ← Added
    records: bundle?.records ?? {},     // ← Added
    common: bundle?.common ?? {},
    errors: bundle?.errors ?? {}
})
```

**Root Cause 2 - Breadcrumb Hooks:**
Existing `createEntityNameHook()` factory doesn't support nested resources. Hub requires `metahubId` and `hubId`; Attribute requires all three IDs.

**Fixes Applied:**
- Created `useHubName(metahubId, hubId)` hook with native `fetch()` and React Query
- Created `useAttributeName(metahubId, hubId, attributeId)` hook
- Added `truncateHubName()` and `truncateAttributeName()` utility functions
- Updated `NavbarBreadcrumbs.tsx` to extract `hubId` and `attributeId` from URL path
- Added breadcrumb links for Hub → Attributes/Records nested paths

**Root Cause 3 - Records Navigation:**
No UI element to switch from Attributes view to Records view within a Hub.

**Fix Applied:**
- Added `ToggleButtonGroup` navigation tabs in both `AttributeList.tsx` and `RecordList.tsx`
- Tabs: "Атрибуты" / "Записи" (Attributes / Records)
- Uses `useNavigate` to switch between `/metahub/:id/hubs/:hubId/attributes` and `/metahub/:id/hubs/:hubId/records`

**Files Modified:**
- `packages/metahubs-frontend/base/src/i18n/index.ts` - namespace consolidation
- `packages/metahubs-frontend/base/src/pages/AttributeList.tsx` - navigation tabs
- `packages/metahubs-frontend/base/src/pages/RecordList.tsx` - navigation tabs
- `packages/universo-template-mui/base/src/hooks/useBreadcrumbName.ts` - Hub/Attribute hooks
- `packages/universo-template-mui/base/src/hooks/index.ts` - exports
- `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx` - breadcrumb logic

**Build Status:** ✅ `pnpm build --filter metahubs-frontend --filter universo-template-mui` successful (2m28s)

## 📅 2025-06-22

### Metahubs: Metadata-Driven Platform Transformation - Phase 1-2 Complete ✅

**Goal:** Transform Metahubs from Metaverses clone into a metadata-driven platform (like 1C:Enterprise) with virtual tables (Hubs), virtual fields (Attributes), and JSONB-based dynamic data storage.

**Phase 1 - Backend Entities (COMPLETE):**
- Renamed `MetaSection.ts` → `Hub.ts` with direct FK to Metahub, VLC name/description, codename
- Renamed `MetaEntity.ts` → `Attribute.ts` with AttributeDataType enum, validationRules JSONB, uiConfig JSONB
- Created `Record.ts` (HubRecord class) for JSONB data storage with hubId FK
- Updated `Metahub.ts` - slug now nullable, VLC pattern for name/description
- Deleted junction table entities (MetaEntityMetahub, MetaSectionMetahub, MetaEntityMetaSection)
- Updated `entities/index.ts` to export: Metahub, MetahubUser, Hub, Attribute, HubRecord

**Phase 1 - Migration (COMPLETE):**
- Rewrote `1766351182000-CreateMetahubsSchema.ts` with new schema
- Tables: metahubs, hubs, attributes, records, metahubs_users
- ENUM: attribute_data_type (STRING, NUMBER, BOOLEAN, DATE, DATETIME, REF, JSON)
- GIN indexes on records.data for efficient JSONB queries
- RLS policies with admin.is_superuser() bypass and public access for is_public metahubs

**Phase 2 - Backend Routes (COMPLETE):**
- Created `hubsRoutes.ts` - CRUD for Hubs under `/metahubs/:metahubId/hubs`
- Created `attributesRoutes.ts` - CRUD for Attributes under `/metahubs/:metahubId/hubs/:hubId/attributes`
- Created `recordsRoutes.ts` - CRUD with JSONB validation against attribute definitions
- Created `publicMetahubsRoutes.ts` - Read-only public API at `/api/public/metahubs/:slug`
- Updated `metahubsRoutes.ts` - VLC support, removed legacy endpoints
- Updated `guards.ts` - replaced ensureSectionAccess/ensureEntityAccess with ensureHubAccess/ensureAttributeAccess
- Updated `routes/index.ts` and `src/index.ts` with new exports
- Integrated public routes into flowise-core-backend

**Technical Highlights:**
- VLC pattern: `createLocalizedContent('en', content)` + `updateLocalizedContentLocale(vlc, 'ru', ruContent)`
- Record class renamed to HubRecord to avoid TypeScript built-in `Record<K,V>` conflict
- JSONB validation: validateRecordData() validates data types against attribute definitions
- New terminology: Hub (not Section), Attribute (not Entity), HubRecord (for data rows)

**Files Changed:**
- `packages/metahubs-backend/base/src/database/entities/` - Hub.ts, Attribute.ts, Record.ts (new), index.ts
- `packages/metahubs-backend/base/src/database/entities/Metahub.ts` - slug now nullable
- `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`
- `packages/metahubs-backend/base/src/routes/` - hubsRoutes.ts, attributesRoutes.ts, recordsRoutes.ts, publicMetahubsRoutes.ts (new), metahubsRoutes.ts, guards.ts, index.ts
- `packages/metahubs-backend/base/src/index.ts`
- `packages/metahubs-backend/base/src/tests/routes/metahubsRoutes.test.ts` - updated mocks
- `packages/flowise-core-backend/base/src/routes/index.ts` - added public metahubs routes

**Build Status:** ✅ Both metahubs-backend and flowise-core-backend compile successfully

**Next Steps (Phase 3-5):**
- Phase 3: Frontend updates (rename pages, update API calls, create dynamic form UI)
- Phase 4: Test public API access
- Phase 5: Full build validation and documentation

---

## 📅 2025-06-22 (continued)

### Metahubs Frontend Transformation - Phase 3 Complete ✅

**Goal:** Update frontend to use new Hub/Attribute/Record architecture instead of old MetaSection/MetaEntity.

**Phase 3 - Frontend Updates (COMPLETE):**

**1. Types (`types.ts`):**
- Added `SimpleLocalizedInput` - simplified locale format `{ en?: string, ru?: string }`
- Added `Hub` interface with `name: SimpleLocalizedInput`, `description?: SimpleLocalizedInput`
- Added `HubDisplay` interface with `name: string` for FlowListTable compatibility
- Added `Attribute`, `AttributeDisplay` with `dataType: AttributeDataType`
- Added `HubRecord`, `HubRecordDisplay` for dynamic data rows
- Added `AttributeDataType` enum: STRING, NUMBER, BOOLEAN, DATE, DATETIME, REF, JSON
- Added helper functions: `getLocalizedString()`, `toHubDisplay()`, `toAttributeDisplay()`, `toHubRecordDisplay()`

**2. API Clients:**
- Created `api/hubs.ts` - CRUD for Hubs under `/metahubs/:metahubId/hubs`
- Created `api/attributes.ts` - CRUD for Attributes under `/metahubs/:metahubId/hubs/:hubId/attributes`
- Created `api/records.ts` - CRUD for Records with JSONB data

**3. Query Infrastructure (`api/queryKeys.ts`):**
- Added query key factories: `hubsQueryKeys`, `attributesQueryKeys`, `recordsQueryKeys`
- Added invalidation helpers as objects with methods: `.all()`, `.lists()`, `.detail()`

**4. Mutations (`hooks/mutations.ts`):**
- Added 9 new hooks: useCreateHub, useUpdateHub, useDeleteHub, useCreateAttribute, useUpdateAttribute, useDeleteAttribute, useCreateRecord, useUpdateRecord, useDeleteRecord

**5. Pages:**
- Created `HubList.tsx` (~515 lines) - Card/table view toggle, CRUD dialogs, pagination
- Created `AttributeList.tsx` (~455 lines) - DataType chips, validation display
- Created `RecordList.tsx` (~670 lines) - Dynamic columns based on Hub attributes
- Created `HubActions.tsx`, `AttributeActions.tsx`, `RecordActions.tsx` - Entity menu descriptors

**6. Menu & Navigation:**
- Updated `menu-items/metahubDashboard.ts` - Added hubs menu item
- Updated `index.ts` exports

**7. i18n Translations:**
- Added hubs, attributes, records sections to `locales/en/metahubs.json` and `locales/ru/metahubs.json`
- Added menu translations in `spaces-frontend` for metahubs, metahubboard, hubs

**Technical Challenges Solved:**
- FlowListTable requires `name: string` but Hub has `name: SimpleLocalizedInput` → Created Display types with helper converters
- `createEntityActions` requires `{ id: string; name: string }` constraint → Used Display types in Actions
- `readonly ActionDescriptor[]` incompatible with mutable array → Used spread operator `[...actions]`
- `align: 'left'` inferred as `string` not literal → Added `as const` assertions

**Build Status:** ✅ 
- TypeScript: Compiles with only unused variable warnings (TS6133)
- Lint: 0 errors, 204 warnings
- Build: `pnpm --filter metahubs-frontend build` successful

**Legacy Compatibility:**
- Old pages (MetaSectionList, MetaEntityList) kept for backward compatibility
- Old types (MetaSection, MetaEntity) marked as @deprecated

---

## 📅 2025-01-XX

### Metahubs Access runtime bugs fixed ✅

**Context:** Manual QA of Metahubs Access page revealed two visual bugs compared to the correctly working Metaverses Access page.

**Bug #1: Member cards show "Нет email" instead of actual email addresses**
- **Root cause:** Backend `loadMembers` function in `packages/metahubs-backend/base/src/routes/metahubsRoutes.ts` used a raw `from('auth.users', 'u')` query builder instead of the `AuthUser` entity pattern.
- **Fix:** Replaced raw query with `ds.manager.find(AuthUser, { where: { id: In(userIds) } })` to match the working Metaverses implementation. This ensures proper entity mapping and email retrieval.
- **File changed:** `packages/metahubs-backend/base/src/routes/metahubsRoutes.ts` (lines 111-120)

**Bug #2: "Администрирование" menu item incorrectly appears in Metahub context sidebar**
- **Root cause:** The `MenuList` component in `packages/flowise-template-mui/base/src/layout/MainLayout/Sidebar/MenuList/index.jsx` had no route handler for `/metahub/:id` paths, causing it to fall through to the default `else` case which renders the main app `dashboard` menu (including "Администрирование").
- **Fix:** Added complete metahub route handling:
  - Added `metahubMatch` and `metahubId` state extraction from URL
  - Added `metahubPermissions` state management
  - Added `useEffect` hook to fetch metahub permissions via `GET /metahubs/:metahubId` API
  - Added conditional menu rendering to show `metahubsDashboard` items (Dashboard, Entities, Sections, Access) when on metahub routes
- **File changed:** `packages/flowise-template-mui/base/src/layout/MainLayout/Sidebar/MenuList/index.jsx`
- **Pattern:** Now follows the same structure as metaverses, clusters, and campaigns route handling

**Verification:**
- Both fixes compile successfully (linting passed)
- Full workspace build completed: 59/59 tasks successful
- Manual verification needed: Check that member cards display actual emails and sidebar shows only metahub-specific menu items

---

## 📅 2025-12-22

### Metahubs Access UI parity + tests ✅

- Metahub Access/Members page UI was aligned to the Metaverses “standard” pattern (ViewHeader + ToolbarControls, card/list toggle with localStorage persistence, pagination, stable empty/error states, action menus and dialogs).
- Updated Metahubs members tests to match the new UI, including coverage-driving flows (invite/edit/remove).
- Fixed a Vitest mocking pitfall: `@universo/template-mui` maps `./components/dialogs` to the root runtime entry (`dist/index.mjs`), so mocks for that subpath must preserve root exports (e.g., `usePaginated`).
- Verification: `pnpm --filter @universo/metahubs-frontend test` is green (100 tests) and coverage remains above the 70% gate.

### Metahubs MVP: Copy-Refactor Implementation ✅

**Goal:** Implement Metahubs by literal copy of Metaverses packages and systematic refactor (no “similar” rewrites).

**Scope & approach**

- Copied `packages/metaverses-backend` → `packages/metahubs-backend` and `packages/metaverses-frontend` → `packages/metahubs-frontend`.
- Refactored terminology and domain model:
  - Metaverse → Metahub
  - Entity → MetaEntity (to avoid collision with TypeORM `@Entity()`)
  - Section → MetaSection
- Integrated into core:
  - `packages/flowise-core-backend/base/src/database/entities/index.ts` spreads `metahubsEntities`.
  - `packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts` spreads `metahubsMigrations`.
  - `packages/flowise-core-backend/base/package.json` depends on `@universo/metahubs-backend`.

**Phases executed (copy → refactor → integrate → validate)**

- Phase 1: literal copy (backend + frontend packages).
- Phase 2: backend refactor (entities, migration, routes, guards, exports, tests).
- Phase 3: frontend refactor (pages, API client, i18n, types, exports).
- Phase 4: core integration (entities + migrations registries, dependencies).
- Phase 5: build validation and systematic fixes (imports, casing, relations, payload fields).
- Phase 6: parity verification vs Metaverses patterns + full workspace build.

**Key backend artifacts**

- New packages: `@universo/metahubs-backend@0.1.0`, `@universo/metahubs-frontend@0.1.0`.
- Migration: `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`.
- Metahubs schema tables:
  - `metahubs`, `meta_entities`, `meta_sections`
  - `metahubs_users`
  - `meta_entities_metahubs`, `meta_sections_metahubs`, `meta_entities_meta_sections`
- Junction entity class names were renamed, but TypeORM navigation property names were kept simple where required by existing query patterns.

**Pattern parity verification (Metaverses → Metahubs)**

- EntityFormDialog create/edit modal pattern (no `/metahubs/new` route).
- BaseEntityMenu action dropdown.
- ConfirmDeleteDialog reuse.
- usePaginated list fetching.
- TanStack Query queryKeys factory usage.
- i18n namespace registration (`metahubs`).
- Route structure parity (`/metahubs` and `/metahub/:metahubId/*`).

**High-signal files (entry points and invariants)**

- Backend:
  - `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`
  - `packages/metahubs-backend/base/src/routes/index.ts`
  - `packages/metahubs-backend/base/src/routes/metahubsRoutes.ts`
  - `packages/metahubs-backend/base/src/routes/guards.ts`
- Frontend:
  - `packages/metahubs-frontend/base/src/i18n/index.ts`
  - `packages/metahubs-frontend/base/src/api/*`
  - `packages/metahubs-frontend/base/src/pages/*`
- Integration:
  - `packages/universo-template-mui/base/src/menu-items/menuConfigs.ts`
  - `packages/universo-template-mui/base/src/layout/MainLayout/Sidebar/MenuList/MenuContent.tsx`
  - `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

**Navigation integration (Template-MUI + Core Frontend)**

- Added Metahubs navigation and routes so the module is reachable in the main UI:
  - Menu translations added in `@universo/i18n`.
  - `packages/universo-template-mui/base/src/menu-items/menuConfigs.ts`:
    - Metahubs root entry + helpers (`getMetahubsMenuItem`, `getMetahubMenuItems`).
  - `packages/universo-template-mui/base/src/layout/MainLayout/Sidebar/MenuList/MenuContent.tsx`:
    - Metahub context detection and menu wiring.
  - `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`:
    - `/metahubs` and `/metahub/:metahubId` route tree with nested children.

**Runtime fixes (Metahubs create + data loading)**

- Backend routes were registered in core backend (`createMetahubsServiceRoutes` + `router.use`).
- Critical: Metahubs rate limiters must be initialized during server startup (module-level init is not enough).
- Frontend list API parsing aligned with backend pagination shape:
  - Backend returns `{ items, total, limit, offset }` in response body.
- Breadcrumb/name helpers added for Metahubs.

**Validation checkpoints**

- Package builds: metahubs-backend, metahubs-frontend, core-backend, core-frontend.
- Full workspace build: `pnpm build` (59/59).
- Terminology scan: metahubs packages contain no legacy `metaverse` naming.

### Metahubs terminology purge (strict) ✅

**Requirement:** Remove all legacy metaverse naming inside Metahubs packages (including RU variants).

- Frontend: removed legacy naming in pages, hooks, route params, tests, and links.
- Backend: removed legacy naming in entities/relations, payload fields, schemas, tests, and docs.
- Docs parity preserved:
  - `packages/metahubs-backend/base/README.md`
  - `packages/metahubs-backend/base/README-RU.md` (line parity with EN)
- Jest crash fix in metahubs-backend tests: TypeORM mock was missing `Unique`.

### Core frontend build blocker resolved ✅

- Root cause: `@flowise/core-frontend` imports named exports from `@universo/metahubs-frontend` that were missing.
- Fix: restored missing exports used by core-frontend list pages / mutations (including invalidation helpers).
- Verification:
  - `pnpm --filter @flowise/core-frontend build` succeeded.

### Final validation ✅

- Full workspace build: `pnpm build` succeeded (59/59 tasks).
- Terminology scan in `packages/metahubs-*` returned zero legacy matches (excluding generated outputs).

### Memory Bank maintenance ✅

- Compressed `memory-bank/activeContext.md` and `memory-bank/progress.md` to size targets.

### Metaverses frontend test baseline restored ✅

**Goal:** Re-establish a reliable green baseline for `@universo/metaverses-frontend` before continuing Metahubs work.

- Tests updated to consistently follow the paginated API contract `{ items, pagination }` and use more stable UI assertions.
- Coverage regressions fixed; global thresholds (70%) are now satisfied.
- Verification:
  - `pnpm --filter @universo/metaverses-frontend test` → 97/97 tests passing.
  - Coverage (All files): 76.32% statements, 81.44% branches, 71.42% functions, 76.32% lines.

### Metahubs frontend coverage gates satisfied ✅

**Goal:** Make `@universo/metahubs-frontend` pass CI-style global coverage thresholds (70%), with functions coverage as the last blocker.

- Added coverage-focused unit tests across api/hooks/utils/components/exports.
- Stabilized `MetahubMembers.coverage.test.tsx`:
  - Fixed `useQuery` mock key matching order (members list keys include `detail`).
  - Made DataGrid mock expose stable cell test IDs for action button targeting.
  - Used `hidden: true` role query to click background action button when a MUI Dialog sets `aria-hidden`.
- Verification:
  - `pnpm --filter @universo/metahubs-frontend test` → 95/95 tests passing.
  - Coverage (All files): 78.69% statements, 82.7% branches, 72.64% functions, 78.69% lines.

### Metahubs runtime regressions fixed + gates green ✅

- Fixed backend 500s on metahub-scoped endpoints by rewriting TypeORM joins/aliases:
  - `GET /metahubs/:metahubId/sections`
  - `GET /metahubs/:metahubId/entities`
- Fixed Metahub Access/Members page rendering raw i18n keys by aligning translation namespace usage with Metaverses.
- CI-style checks re-verified after fixes:
  - `pnpm --filter @universo/metahubs-frontend test` (green)
  - `pnpm --filter @universo/metaverses-frontend test` (green)
  - `pnpm --filter @universo/metahubs-frontend lint` and `pnpm --filter @universo/metahubs-backend lint` (warnings only)
  - Full workspace build: `pnpm build` (59/59 tasks)

---

## 📅 2025-12-21

### Metahubs runtime debugging: i18n + API ✅

- Fixed Metahubs i18n structure and RU translations (correct Metahubs label and grammar).
- Stabilized metahubs-backend route logic and access guards:
  - Ensured access functions exist for sections/entities where required.
  - Fixed query/schema parameters (including `showAll`).
- Verified package builds for metahubs-backend / metahubs-frontend / core-backend / core-frontend.

---

## 📅 2025-12-18

### PR #608 bot comments QA & fixes ✅

- flowise-core-backend:
  - Removed unused imports/vars in routes (quality fixes).
- spaces-frontend:
  - Removed unused variables in AgentFlow components.
- template-mui / universo-template-mui:
  - Fixed lint blockers (rules, aria-role false positives, display-name, no-autofocus).
- Validation: lints and builds were run to ensure the cleanups did not break the workspace.

---

## 📅 2025-12-17

### AgentFlow config UX hardening ✅

**Goal:** Make AgentFlow node configuration behave like Flowise 3.0.12 without regressions in universal canvas.

- Fixed input focus loss on each keystroke (removed value-based remount for `<Input>`; synced local state with prop).
- Fixed Start node showing extra fields by default:
  - Applied `showHideInputParams` when opening the dialog so conditional fields stay hidden until activated.
- Fixed missing `Messages` array section for existing saved canvases:
  - Rehydrated missing array-type `inputParams` on flow load (not inside the dialog).
- Agents + executions scoping hardening:
  - Membership enforcement when scoped by `unikId`.
  - Public execution route contract aligned (`/execution/:id` and `GET /public-executions/:id`).

**Key files / areas**

- `packages/spaces-frontend/base/src/views/canvas/*` (EditNodeDialog, ConfigInput, NodeInputHandler, loaders)
- `packages/flowise-core-backend/base/src/routes/*` (execution/validation routing contracts)

**Validation**

- Full workspace build succeeded after the fixes.

---

## 📅 2025-12-16

### Universal canvas: node-based AgentFlow detection ✅

**Problem:** AgentFlow rendering previously depended on route/URL (“agent canvas” vs normal canvas), blocking mixed graphs.

**Solution:** universal registry + node-based detection.

- Utility introduced:
  - `packages/spaces-frontend/base/src/utils/nodeTypeHelper.js`
  - Detects AgentFlow nodes via `category === 'Agent Flows'`, `name` suffix `Agentflow`, or AGENTFLOW icon map.

**Helper responsibilities (high level)**

- `getNodeRenderType(nodeData)` → `agentFlow | stickyNote | customNode`.
- `normalizeNodeTypes(nodes, componentNodes)` → normalizes node.type on flow load.
- `isAgentFlowNode(node)` → boolean detection for mixed graphs.
- `getEdgeRenderType(sourceNode, targetNode)` → agentFlow edge vs default edge.

**Detection rules (ordered)**

- StickyNote type → `stickyNote`.
- `category === 'Agent Flows'` → `agentFlow`.
- `name` ends with `Agentflow` (case-insensitive) → `agentFlow`.
- `name` matches AGENTFLOW icon map key → `agentFlow`.
- Fallback → `customNode`.

**Outcome**

- Mixed node types can coexist on the same canvas.
- Rendering no longer depends on URL routing.
- Validation UI activates when any AgentFlow node exists.
- Canvas updates:
  - `nodeTypes`/`edgeTypes` always registered.
  - Drop/connect/load use helper functions to pick render types per node.
  - Validation popup shown when any AgentFlow node exists in the current graph.

**Validation**

- `pnpm --filter spaces-frontend build` succeeded.
- Full workspace build succeeded.

---

## 📅 2025-12-15

### AgentFlow features: phases 1–3 complete ✅

**Phase 1: Chat popup i18n**

- Added i18n infrastructure for `@flowise/chatmessage-frontend`:
  - `src/i18n/en/chatmessage.json`, `src/i18n/ru/chatmessage.json`, `src/i18n/index.ts`.
  - Side-effect import added in package entry.
- Added `onOpenChange` callback prop to `ChatPopUp` for coordination with validation UI.

**Phase 2: Agents backend package**

- Created `@flowise/agents-backend`:
  - Express router for `GET /validation/:canvasId`.
  - Validation service adapted from Flowise (node connectivity, required params, nested/array params, credentials, hanging edges).
  - Zod schemas for response validation.

**Phase 3: Agents frontend package**

- Created `@flowise/agents-frontend`:
  - i18n registration (`agents` namespace, en/ru).
  - `ValidationPopUp` component (issues list, icons, dark-mode styling).

**API client**

- Added `validation` API to `@universo/api-client` (`createValidationApi`, `checkValidation(canvasId, unikId?)`).

**AgentFlow UX parity (canvas)**

- Double-click on AgentFlow nodes opens settings dialog (Flowise 3.x behavior).

**Validation**

- Builds succeeded for `@flowise/agents-backend`, `@flowise/agents-frontend`, `@universo/api-client`, and full workspace.

### Agent Executions: frontend i18n + cleanup ✅

- Integrated i18n on executions list/details pages (titles, filters, dialogs, empty states).
- Registered executions namespace via `registerNamespace()` pattern and side-effect import in package entry.
- Removed redundant barrel exports in template-mui UI components (avoid duplicate/unused indices).
- Lint/build validations:
  - `pnpm --filter @flowise/executions-frontend lint`.
  - `pnpm --filter @flowise/executions-frontend build`.
  - `pnpm --filter @flowise/core-frontend build`.

**Traceability**

- `packages/flowise-executions-frontend/base/src/pages/Executions.jsx`
- `packages/flowise-executions-frontend/base/src/pages/NodeExecutionDetails.jsx`
- `packages/flowise-executions-frontend/base/src/i18n/*`

---

## 📅 2025-12-14

### Flowise 3.0.12 components replacement + AgentFlow icons ✅

- Replaced `packages/flowise-components` with upstream Flowise 3.0.12 version.
- Adapted build to upstream-aligned approach (`tsc` + `gulp`) to avoid clean-rebuild runtime issues.
- Implemented AgentFlow icon rendering:
  - AgentFlow nodes use Tabler icons (no per-node icon files).
  - Updated UI components to render Tabler icons when `node.color && !node.icon`.
  - Upgraded `@tabler/icons-react` to v3.x for Flowise 3 compatibility.
- Backend error handling improvement:
  - Global error handler respects `err.statusCode` (no masking of 404 as 500).

---

### Dynamic Locales System ✅

- Implemented admin UI for managing content locales (database-driven, not hardcoded `en/ru`).
- Added public API endpoint for localized content (cached, no auth) for editors.
- Type system adjusted so supported locales are validated at runtime rather than being a fixed union type.
- Key decision: content locales are separate from UI i18n namespaces (UI still requires file-based translations).
- System locales (`en`, `ru`) protected from deletion.

---

## 📅 2025-12-13

### Admin locales terminology + i18n cleanup ✅

- Refactored admin-facing terminology from legacy “VLC” to “Localized Content”.
- Renamed public API endpoint from `/api/v1/locales/vlc` to `/api/v1/locales/content`.
- Updated admin UI copy: “Locales” → “Languages” (EN) / “Languages” (RU translation).
- Key decision: removed deprecated aliases and kept only the new names.

---

## 📅 2025-12-11

### Dev environment maintenance ✅

- Upgraded `@typescript-eslint/*` to v8.x for TypeScript 5.8.x compatibility.
- Updated ESLint configuration to use TypeScript overrides pattern.
- Outcome: removed “unsupported TypeScript version” warnings during lint.

---

## 📅 2025-12-10

### UUID v7 migration ✅

- Migrated the project from UUID v4 to UUID v7 for time-ordered IDs.
- Added shared UUID utilities in `@universo/utils` (generate/validate/extract timestamp).
- Added Postgres `uuid_generate_v7()` function and updated migrations to use it.
- Updated backend code to stop using `crypto.randomUUID()` / `uuid.v4` directly.
- Updated frontend code to use `uuidv7` where needed.

### Legacy cleanup ✅

- Updated outdated comments and removed references to deleted legacy SQL helpers.
- Kept patterns docs aligned with current RBAC functions.

---

## 📅 2025-12-09

### Global roles access architecture ✅

- Fixed “global subject access” so permissions like `metaverses:*` allow viewing all items of that subject.
- Ensured subject-wide permissions are checked before membership (synthetic membership pattern).
- Updated frontend queries to be context-aware where subject scoping matters.

---

## 📅 2025-12-08

### CASL terminology compliance ✅

- Refactored permission system naming from `module` → `subject` (CASL/Auth0/OWASP standard alignment).
- Updated types, services, and UI copy where necessary.

---

## 📅 2025-12-07

### RBAC architecture cleanup ✅

- Removed redundant `canAccessAdmin` flag; admin access computed from permissions.
- Rule: if user can read any of `[roles, instances, users]` then admin UI access is granted.

---

## 📅 2025-11 (Summary)

- Admin instances MVP and RBAC improvements (global roles access).
- Organizations, projects, campaigns, storages modules.
- REST API docs refactor (OpenAPI 3.1) and analytics/dashboard updates.

---

## 📅 2025-10 (Summary)

- i18n TypeScript migration and type-safety improvements.
- Rate limiting with Redis and RLS integration analysis.
- Global monorepo refactor and tsdown build system consolidation.
