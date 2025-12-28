# Active Context

> **Last Updated**: 2025-12-28
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Auth Register 419 Auto-Retry - 2025-12-28 ✅ COMPLETED

**Status**: Completed

### What Was Implemented

- Added retry-once behavior for registration when the first attempt fails with HTTP 419 (stale CSRF).
- On 419, the stored CSRF token is cleared and the register request is retried once, matching the login flow.

### Files Modified

- `packages/auth-frontend/base/src/pages/AuthPage.tsx`

---

## Previous Focus: Start Page UI Bugfixes - 2025-12-28 ✅ COMPLETED

**Status**: Completed

### What Was Implemented

- Fixed onboarding completion screen top spacing on desktop to avoid overlap with the fixed AppBar.
- Prevented the brief Login→Logout button flash by hiding auth actions until the auth hook finishes loading.

### Files Modified

- `packages/start-frontend/base/src/views/AuthenticatedStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx`
- `packages/start-frontend/base/src/views/components/AppAppBar.tsx`

---

## Previous Focus: Onboarding Completion Tracking (MVP) - 2025-12-28 ✅ COMPLETED

**Status**: Implementation complete, ready for testing

### What Was Implemented

Added `onboarding_completed` boolean field to `profiles` table to track whether user has completed the onboarding wizard. This prevents users from having to redo the wizard on every page refresh or re-login.

**Key Behavior**:
- Existing users get `onboarding_completed = FALSE` (must complete wizard again)
- When user completes wizard (saves on Clusters step) → flag set to TRUE
- On page load, if flag is TRUE → show CompletionStep directly (not full wizard)
- "Start Over" button on CompletionStep allows re-doing the wizard

### Files Created

**Migration**: `packages/profile-backend/base/src/database/migrations/postgres/1766821477094-AddOnboardingCompleted.ts`
- Adds `onboarding_completed BOOLEAN NOT NULL DEFAULT false` column
- Creates index `idx_profiles_onboarding_completed`
- Uses `IF NOT EXISTS` for idempotent execution

### Files Modified

**Backend**:
- `Profile.ts` - Added `onboarding_completed` column to entity
- `migrations/postgres/index.ts` - Registered new migration
- `start-backend/package.json` - Added `@universo/profile-backend` dependency
- `onboardingRoutes.ts` - Read flag in GET, set TRUE in POST transaction

**Frontend**:
- `types/index.ts` - Added `onboardingCompleted` to interfaces
- `AuthenticatedStartPage.tsx` - Conditional render based on status
- `CompletionStep.tsx` - Added `onStartOver` prop with button
- `OnboardingWizard.tsx` - Fixed `onComplete` callback timing

### Build Status

✅ `pnpm build` successful (61 tasks, 6m40s)

### Next Steps

1. Run `pnpm dev` and test with live database
2. Verify migration adds column to profiles table
3. Test: complete wizard → refresh → should see CompletionStep
4. Test: click "Start Over" → should re-show full wizard

---

## Previous Focus: Onboarding Wizard Implementation - 2025-06-29 ✅ COMPLETED

**Status**: Implementation complete, ready for testing

### What Was Implemented

Created a multi-step onboarding wizard for new users after registration. Users select:
- **Projects (Global Goals)** - High-level initiatives to participate in
- **Campaigns (Personal Interests)** - Topic-based groups aligned with interests
- **Clusters (Platform Features)** - Specific features/tools to enable

All items shown are owned by the system admin (email: `580-39-39@mail.ru`).

### Packages Created

**@universo/start-backend** (`packages/start-backend/base/`):
- Express routes with rate limiting
- TypeORM queries with admin ownership verification
- Transaction-safe join operation adding user as "member"

**@universo/start-frontend** (`packages/start-frontend/base/`):
- OnboardingWizard - 5-step MUI Stepper component
- SelectableListCard - Clickable card list with checkboxes
- WelcomeStep, SelectionStep, CompletionStep - Step implementations
- i18n support with English/Russian translations

### API Endpoints

- `GET /api/v1/onboarding/items` - Returns admin-owned items with user selection status
- `POST /api/v1/onboarding/join` - Joins user to selected items as "member"

### Integration Points

- Backend registered in `flowise-core-backend/routes/index.ts` with lazy router pattern
- Rate limiters initialized in `flowise-core-backend/src/index.ts`
- Frontend used in `universo-template-mui` AuthenticatedStartPage
- i18n registered via `registerOnboardingI18n()` on component mount

### Build Status

✅ `pnpm build` successful (61 tasks, 6m41s)

### Next Steps

1. Manual testing with live database (requires running server with `pnpm dev`)
2. Create test data: Projects, Campaigns, Clusters owned by 580-39-39@mail.ru
3. Register new user and verify onboarding flow

---

## Previous Focus: Quiz Leads API & Analytics Integration Test - 2025-12-26

**Status**: Implementation complete, ready for integration test

### Objective

Verify the complete flow works end-to-end:
1. Create AR.js Quiz through UI
2. Publish quiz and obtain URL
3. Complete quiz (answer all 10 questions)
4. Verify lead saves without 400 error
5. Navigate to Analytics page
6. Verify no TypeError, canvases dropdown works, leads table displays correctly

### What Was Fixed

**Bug 1: Leads API 400 Error**
- Root cause: Zod schema required canvasId as UUID, but quiz sent null/empty string during initialization
- Root cause: Zod schema didn't accept points field sent by quiz template
- Solution: Made canvasId optional with empty string transformation, added points field validation
- Result: Leads now save correctly with optional canvasId and validated points

**Bug 2: Analytics TypeError "w.map is not a function"**
- Root cause: Backend returns `{canvases: [...], total: N}`, frontend expected array
- Solution: Added `normalizeCanvasesResponse()` function to handle both formats
- Result: Analytics page renders correctly without crashes

### Implementation Summary

**Backend Changes**:
- ✅ Lead migration updated (nullable canvas_id + performance indexes)
- ✅ Lead entity updated (optional canvasId field)
- ✅ Zod schema enhanced (points validation, optional canvasId with transformation)
- ✅ leadsService updated to use new types from @universo/types
- ✅ Comprehensive unit tests created (19 tests, all passing)

**Frontend Changes**:
- ✅ Analytics page updated with normalizeCanvasesResponse()
- ✅ useEffect updated to normalize API response before setState

**Type Safety**:
- ✅ Types extracted to @universo/types (ILead, CreateLeadPayload, LeadsAnalytics)
- ✅ Package dependencies updated (@flowise/leads-backend → @universo/types)
- ✅ Backwards compatibility maintained (CreateLeadBody alias)

**Testing**:
- ✅ Unit tests: 19/19 passing (validates Zod schema behavior)
- ⏳ Integration test: Awaiting manual verification

### Build Status

All packages built successfully:
- ✅ @universo/types: 5.021s (50.09 kB CJS + 45.72 kB ESM)
- ✅ @universo/utils: 4.120s (1817.79 kB CJS + 1868.06 kB ESM)
- ✅ @flowise/leads-backend: 15.943s (TypeScript compilation clean)
- ✅ @universo/analytics-frontend: 46.513s total (with dependencies)

### Next Step

**Manual Integration Test**:
1. Start development server (`pnpm dev` with user permission)
2. Create new AR.js Quiz
3. Publish quiz
4. Complete quiz in browser
5. Check browser console: no 400 error on POST /api/v1/leads
6. Navigate to Analytics page
7. Check browser console: no TypeError
8. Verify canvases dropdown displays correctly
9. Verify leads table shows quiz results with points

### Files Modified

**Backend**:
- `packages/flowise-leads-backend/base/src/database/migrations/postgres/1710832137905-AddLead.ts`
- `packages/flowise-leads-backend/base/src/database/entities/Lead.ts`
- `packages/flowise-leads-backend/base/src/services/leadsService.ts`
- `packages/flowise-leads-backend/base/src/Interface.ts`
- `packages/flowise-leads-backend/base/src/services/__tests__/leadsService.test.ts` (NEW)
- `packages/flowise-leads-backend/base/package.json`
- `packages/flowise-leads-backend/base/jest.config.js` (NEW)

**Frontend**:
- `packages/analytics-frontend/base/src/pages/Analytics.jsx`

**Types**:
- `packages/universo-types/base/src/validation/leads.ts` (NEW)
- `packages/universo-types/base/src/index.ts`

---

## Previous: Auth UX Improvements Complete - 2025-12-26

All active auth UX issues resolved. Ready for manual testing.

---

## Previous: Login After Server Restart Fix - 2025-12-26 ✅ COMPLETED

**Status**: ✅ Implemented and built successfully

### Problem Summary

After server restart, users had to click "Login" button twice (or manually clear cookies) to login successfully.

### Why This Happened

1. Server restarts → MemoryStore sessions cleared → CSRF secrets lost
2. Browser keeps old CSRF token in sessionStorage
3. First login attempt → 419 (stale CSRF token)
4. Frontend clears token but doesn't retry automatically
5. Second click → fetches fresh CSRF → succeeds

### Solution

Added automatic retry logic when receiving 419 CSRF errors during login:

**File**: `packages/auth-frontend/base/src/providers/authProvider.tsx`

```typescript
const login = async (email: string, password: string): Promise<void> => {
    const doLogin = async () => {
        await client.post('auth/login', { email, password })
    }

    try {
        await doLogin()
    } catch (err: any) {
        const status = err?.response?.status
        if (status === 419) {
            // CSRF token expired (e.g., after server restart with MemoryStore)
            // Clear stale token and retry once
            clearStoredCsrfToken(client)
            await doLogin()
        } else {
            throw err
        }
    }

    clearStoredCsrfToken(client)
    const refreshedUser = await session.refresh()
    if (!refreshedUser) {
        throw new Error('Failed to refresh session after login')
    }
}
```

**File**: `packages/auth-frontend/base/src/components/LoginForm.tsx`

Same retry pattern added to standalone LoginForm component.

### Benefits

- ✅ Single-click login after server restart
- ✅ No manual cookie clearing needed
- ✅ Graceful CSRF token refresh
- ✅ Limited to one retry (prevents loops)

### Build Status

✅ `pnpm build` successful (59 tasks, 7m35s)

### Technical Details

- **Pattern**: Try-catch wrapper with conditional retry on 419
- **Safety**: Exactly one retry per login attempt
- **Scope**: Both authProvider (main) and LoginForm (standalone)
- **Interceptor**: Existing axios interceptor clears token on 419, new code adds retry

---

## Previous: Logout Redirect Fix - 2025-12-26 ✅ COMPLETED

**Status**: ✅ Implemented and built successfully

### Problem

After logout, user was forcefully redirected to `/auth` page via `window.location.href = '/auth'`, causing full page reload and preventing natural guest content display.

### Solution

Removed hardcoded redirect from `authProvider.tsx` logout function. Now React naturally re-renders guest content when `isAuthenticated` becomes `false`.

### Changes Made

**File**: `packages/auth-frontend/base/src/providers/authProvider.tsx`

```typescript
// Before:
} finally {
    window.location.href = '/auth'  // ❌ Force redirect
    logoutInProgress.current = false
}

// After:
} finally {
    logoutInProgress.current = false
    // ✅ No redirect - let React re-render with guest content based on isAuthenticated state
}
```

### Benefits

- No page reload on logout (smoother UX)
- Pages like `StartPage.tsx` automatically show guest version via conditional rendering
- Follows React's declarative approach
- User stays on current page and sees guest content if available

### Build Status

✅ `pnpm build` successful (59 tasks, 7m46s)

---

## Previous: Logout Functionality Fix - 2025-12-25 ✅ COMPLETED

**Status**: ✅ COMPLETED - Eliminated ~500 lines of duplicate code across 15+ packages.
- Updated all duplicate `isPublicRoute()` definitions

### Files Modified: 17+ files
### Build Status: ✅ `pnpm build` successful - 59 tasks

---

## Previous: Start Page Auth-Conditional Rendering - 2025-12-25 ✅ COMPLETED

**1. Hero Component Cleanup**
- Removed email input field and Terms & Conditions text
- Commented out dashboard screenshot image (StyledBox)
- Kept only "Start now" button centered

**2. AppAppBar Menu Cleanup**
- Commented out left navigation buttons (Features, Testimonials, Highlights, Pricing, FAQ, Blog)
- Kept only: Sitemark logo, Sign in, Sign up, ColorMode switcher
- Commented out mobile menu items as well

**3. Created StartLayoutMUI**
- New minimal layout at `layout/StartLayoutMUI.tsx`
- Contains only AppAppBar (top navigation) without sidebar
- Used for both guest and authenticated start pages

**4. Split Pages by Auth Status**
- `GuestStartPage.tsx` - Landing page for non-authenticated users (Hero + Testimonials)
- `AuthenticatedStartPage.tsx` - Dashboard for authenticated users (MUI DataGrid with demo data)
- `StartPage.tsx` - Switcher component that renders appropriate page based on auth status

**5. Route Updates**
- Replaced `LandingRoute` with `StartRoute`
- Uses `StartLayoutMUI` wrapper with `StartPage` inside
- Path `/` now shows different content based on authentication
- No AuthGuard redirect - guests see landing, authenticated see dashboard

**6. Guest Redirect Root Cause + Fix** (Latest)
- **Problem**: Non-authenticated users saw the guest landing briefly, then were redirected to `/auth`
- **Root Cause**: Multiple frontend API clients/hooks enforced a global `401 → /auth` redirect without considering public routes. Background requests like `/api/v1/auth/me` and `/api/v1/auth/permissions` return `401` for guests and triggered the redirect.
- **Fix**: Added a public-route allowlist (including `/`, `/p/*`, `/b/*`, `/chatbot/*`, `/bots/*`, `/execution/*`) and skip the auto-redirect on those routes.
- **Files Modified**:
  - `packages/flowise-core-frontend/base/src/api/client.js`
  - `packages/flowise-core-frontend/base/src/api.js`
  - `packages/universo-api-client/base/src/client.ts`
  - `packages/auth-frontend/base/src/hooks/useAuthError.ts`
  - Several `*/frontend/*/src/api/*` clients with the same 401 redirect pattern

**Files Created:**
- `packages/universo-template-mui/base/src/layout/StartLayoutMUI.tsx`
- `packages/universo-template-mui/base/src/views/start-page/GuestStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/AuthenticatedStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/StartPage.tsx`

**Files Modified:**
- `packages/universo-template-mui/base/src/views/start-page/components/Hero.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

**Build Status:** ✅ `pnpm build` successful

### Architecture Pattern

```
/                          → StartRoute
├── StartLayoutMUI         → AppTheme + AppAppBar
│   └── StartPage          → useAuth() check
│       ├── GuestStartPage       (if !isAuthenticated)
│       │   ├── Hero             (title + Start now button)
│       │   └── Testimonials     (6 cards)
│       └── AuthenticatedStartPage (if isAuthenticated)
│           └── DataGrid         (demo table)
```

### Next Steps (Future)
- [ ] Replace demo content with actual Universo Platform branding
- [ ] Connect Sign In / Sign Up buttons to auth routes (`/auth`)
- [ ] Connect "Start now" button to appropriate action
- [ ] Add i18n support for landing page text
- [ ] Replace AuthenticatedStartPage demo table with real dashboard

---

## Recently Completed: Start Page (Marketing Page) MVP - 2025-12-25

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
