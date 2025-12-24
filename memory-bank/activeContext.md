# Active Context

> **Last Updated**: 2025-12-23
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: RLS Context Fix Completed (2025-12-23)

**Status**: ✅ FIXED - RLS context now works correctly without breaking admin schema access.

### Issue 1: Empty Lists Despite Data in DB

- After DB reset, Metahubs/Uniks data existed in PostgreSQL but UI lists returned empty arrays.
- **Root Cause**: `applyRlsContext()` used transaction-local settings (`SET LOCAL`), so RLS context was lost after the setup statement.
- **Fix**: Changed to session-scoped `set_config('request.jwt.claims', ..., false)`.

### Issue 2: "permission denied for schema admin"

- After switching to session-scoped settings, added `SET role = 'authenticated'` which broke access to `admin` schema functions (`admin.is_superuser()` etc.).
- **Root Cause**: The `authenticated` role doesn't have USAGE privilege on `admin` schema.
- **Fix**: Removed `SET role = 'authenticated'` entirely. RLS policies only need `request.jwt.claims` for `auth.uid()` to work — no role change required.

### What Was Fixed

**`packages/auth-backend/base/src/utils/rlsContext.ts`**:
- Removed `SET role = 'authenticated'` line
- Kept session-scoped `set_config('request.jwt.claims', ..., false)`

**`packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`**:
- Removed `RESET role` from cleanup
- Kept cleanup of `request.jwt.claims` to empty string before releasing connection

**Build Status:** ✅ Full workspace `pnpm build` successful

### Key Learning (Critical Pattern)

**NEVER use `SET role = 'authenticated'` in RLS context setup:**
- The `authenticated` role lacks USAGE on `admin` schema
- RLS policies use `auth.uid()` which reads from `request.jwt.claims.sub`
- Only `request.jwt.claims` needs to be set; role change is unnecessary and harmful

---

## Recently Completed: Metahubs - Pagination Data Access Fix (2025-12-23)

**Status**: ✅ FIXED - HubList, AttributeList, RecordList no longer crash on `.map()`. Builds passing.

### Issue Discovered

- Clicking `/metahub/:metahubId/hubs` crashed with `TypeError: l.map is not a function` (line 364 in HubList.tsx)
- Same issue in AttributeList and RecordList (pagination data destructuring)

### Root Cause

The `usePaginated` hook returns:
```typescript
{ data: PaginatedResponse<T>, isLoading, error }
// where PaginatedResponse = { items: T[], pagination: {...} }
```

But pages were destructuring:
```typescript
const { data: hubs } = paginationResult
// hubs = { items: [], pagination: {} } ❌ not an array!
hubs.map(...) // TypeError: hubs.map is not a function
```

### What Was Fixed

**All Three List Pages:**
- `HubList.tsx` - changed to: `const { data } = paginationResult; const hubs = data?.items || []`
- `AttributeList.tsx` - changed to: `const { data } = paginationResult; const attributes = data?.items || []`
- `RecordList.tsx` - changed to: `const { data } = paginationResult; const records = data?.items || []`

**Backend Verification:**
- Confirmed `/metahubs/:id/hubs` endpoint returns correct `{ items: Hub[], pagination: {...} }` structure (hubsRoutes.ts line 92)

**Legacy Routes Removal:**
- Deleted unused redirect routes from `MainRoutesMUI.tsx`:
  - Removed `/entities` route (redirect to `/hubs`)
  - Removed `/sections` route (redirect to `/hubs`)
- Since old entity/section pages don't exist anymore, no point in redirecting; let 404 handle it naturally

**Build Status:** ✅ `pnpm build --filter metahubs-frontend` successful (3.35s)

### Recently Completed (context)

User reported React error #31 when creating Metahub:
- Frontend expected `name: string` but backend returns VLC object `{ _schema, locales, _primary }`
- TypeError: Cannot render object as React child

### What Was Fixed

**Type System:**
- Added `VersatileLocalizedContent` interface to match backend VLC format
- Updated `Metahub` type to use `VersatileLocalizedContent` for name/description
- Created `MetahubDisplay` type with string fields for UI rendering
- Added `getVLCString()` helper to extract localized content from VLC

**MetahubList.tsx:**
- Import `MetahubDisplay` and `toMetahubDisplay` converter
- Convert API data to display format: `metahubsDisplay = metahubs.map(toMetahubDisplay)`
- Updated all components to use `MetahubDisplay` instead of `Metahub`
- All column render functions now use Display types with string fields

**MetahubBoard.tsx:**
- Import `toMetahubDisplay` converter
- Convert single metahub: `metahubDisplay = toMetahubDisplay(metahub, i18n.language)`
- Updated ViewHeader and all StatCard components to use display strings
- Fixed `.slice()` runtime errors by ensuring UI receives strings (not VLC objects)

**NavbarBreadcrumbs / breadcrumb hooks (template-mui):**
- `useMetahubName()` previously returned a VLC object from `/api/v1/metahubs/:id` and was treated as a string
- Hardened breadcrumb name fetching and truncation to safely extract localized strings before calling `.slice()`

**Type Conversions:**
- `getVLCString(vlc, locale)` - extract string from VLC
- `getLocalizedString(simple, locale)` - extract from SimpleLocalizedInput
- `toMetahubDisplay(metahub, locale)` - convert Metahub to MetahubDisplay
- `toHubDisplay(hub, locale)` - convert Hub to HubDisplay
- `toAttributeDisplay(attr, locale)` - convert Attribute to AttributeDisplay
- `toHubRecordDisplay(record, attrs, locale)` - convert HubRecord to HubRecordDisplay

**Build Status:**
- ✅ `pnpm --filter metahubs-frontend build` - successful
- ✅ `pnpm --filter spaces-frontend build` - successful  
- ✅ `pnpm --filter @flowise/core-frontend build` - successful
- ✅ Full project build completed without errors

### Type Pattern Summary

**Backend → Frontend:**
```typescript
// Backend returns VLC
{ 
  name: { 
    _schema: "vlc/1",
    locales: { en: { content: "Test" } },
    _primary: "en"
  }
}

// Frontend converts to Display
{ 
  name: "Test"  // Extracted string for current locale
}
```

**Hubs/Attributes (SimpleLocalizedInput):**
```typescript
// API layer
{ name: { en: "Hub Name", ru: "Имя хаба" } }

// UI layer (Display)
{ name: "Hub Name" }  // Current locale
```

### Next Steps

1. Manual runtime verification in browser:
  - Metahub sidebar shows Hub-based navigation (no legacy Entities/Sections).
  - Navigating to `/metahub/:metahubId/entities` and `/sections` redirects to `/hubs`.
2. If anything still renders legacy menu items, confirm the running app is using latest build artifacts.

### What's true right now

- **New Architecture Implemented (Backend + Frontend):**
  - Metahubs now uses metadata-driven pattern (like 1C:Enterprise)
  - Hubs = virtual tables within a Metahub
  - Attributes = virtual fields within a Hub (with dataType enum)
  - Records = JSONB data rows within a Hub

- **Backend is complete and builds:**
  - `pnpm --filter metahubs-backend build` ✅
  - `pnpm --filter @flowise/core-backend build` ✅
  - New entities: Hub, Attribute, HubRecord
  - New routes: hubsRoutes, attributesRoutes, recordsRoutes, publicMetahubsRoutes
  - Guards updated: ensureHubAccess, ensureAttributeAccess

- **Frontend is complete and builds:**
  - `pnpm --filter metahubs-frontend build` ✅
  - New pages: HubList, AttributeList, RecordList
  - Display types: HubDisplay, AttributeDisplay, HubRecordDisplay (for FlowListTable)
  - Helper functions: toHubDisplay(), toAttributeDisplay(), toHubRecordDisplay()
  - i18n: EN/RU translations for hubs, attributes, records

- **New API Structure:**
  - `GET/POST /metahubs/:metahubId/hubs` - Hub CRUD
  - `GET/POST /metahubs/:metahubId/hubs/:hubId/attributes` - Attribute CRUD
  - `GET/POST /metahubs/:metahubId/hubs/:hubId/records` - Record CRUD
  - `GET /api/public/metahubs/:slug` - Public read-only access

- **Frontend Type Pattern:**
  - `SimpleLocalizedInput` = `{ en?: string, ru?: string }` - for API
  - `Hub`, `Attribute`, `HubRecord` - with SimpleLocalizedInput fields
  - `HubDisplay`, `AttributeDisplay`, `HubRecordDisplay` - with string name/description for UI
  - Helper functions convert between them

- **Database Migration:**
  - New schema replaces old M2M junction tables
  - GIN indexes for JSONB queries on records.data
  - RLS policies support public access for is_public metahubs

### What's been removed (legacy)

- ❌ MetaEntity, MetaSection, MetaEntityMetahub, MetaSectionMetahub, MetaEntityMetaSection entities
- ❌ metaEntitiesRoutes.ts, metaSectionsRoutes.ts
- ❌ ensureSectionAccess, ensureEntityAccess guards
- ❌ /metahubs/:metahubId/entities and /metahubs/:metahubId/sections endpoints
- Legacy pages (MetaSectionList, MetaEntityList) kept for backward compatibility

### Notes for next steps

- Frontend needs update:
  - Rename pages from MetaSection→Hub, MetaEntity→Attribute
  - Update API calls to new endpoints
  - Create dynamic form UI based on Hub attributes
  - LocalizedFieldEditor for VLC name/description

- Database will be recreated:
  - User confirmed: "База данных будет удалена и создана новая"
  - No migration of legacy data needed

- Record class is named HubRecord to avoid TypeScript conflict with built-in Record<K,V>

### Next steps

1. Phase 3: Update metahubs-frontend pages and API calls
2. Phase 4: Test public API access at /api/public/metahubs/:slug
3. Phase 5: Full `pnpm build` validation and README updates
