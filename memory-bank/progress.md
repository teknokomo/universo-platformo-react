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

## 📅 2025-12-31

### Split consent_version into terms_version + privacy_version ✅

Refactored consent tracking to support independent versioning for Terms of Service and Privacy Policy documents.

**Changes**:
- Split single `consent_version` field into `terms_version` and `privacy_version` in Profile entity
- Added two separate version columns in AddConsentFields migration
- Updated database trigger to extract and store both versions from raw_user_meta_data
- auth.ts now reads versions from `LEGAL_TERMS_VERSION` and `LEGAL_PRIVACY_VERSION` environment variables
- Added new env vars to `.env` and `.env.example` with documentation

**Reason**: Terms of Service and Privacy Policy may be updated independently, requiring separate version tracking for compliance.

**Files Modified**: Profile.ts, 2 migrations, auth.ts, .env, .env.example

---

## 📅 2025-12-30

### Profile Creation Debug & Migration Consolidation ✅

Debugged and fixed profile creation during registration, consolidated duplicate migrations.

**Bug Fixes**:
- **CRITICAL**: Fixed TypeORM result parsing in auth.ts registration flow
  - TypeORM `query()` with RETURNING returns `[rows[], rowCount]` tuple format
  - Code incorrectly checked `updateResult.length` instead of `updateResult[0].length`
  - This caused false positives (empty array was treated as success)
  
**Migration Consolidation**:
- Merged `1767057000000-UpdateProfileTrigger.ts` and `1767059500000-FixProfileInsertRLS.ts` into single migration
- The consolidated migration now includes:
  - RLS INSERT policy update (allows INSERT for valid auth.users entries)
  - Trigger function with `SECURITY DEFINER` and `SET search_path = public`
  - Consent field extraction from `raw_user_meta_data`
  - Fail-open strategy (RAISE WARNING instead of blocking signup)
- Deleted redundant migration file `1767059500000-FixProfileInsertRLS.ts`

**Files Modified**:
- `packages/profile-backend/base/src/database/migrations/postgres/1767057000000-UpdateProfileTrigger.ts`
- `packages/profile-backend/base/src/database/migrations/postgres/index.ts`

**Files Deleted**:
- `packages/profile-backend/base/src/database/migrations/postgres/1767059500000-FixProfileInsertRLS.ts`

**GitHub Issue Created**: "Investigate and verify database trigger for profile creation during registration"

**Build**: 61 tasks successful

---

### Legal Pages & Registration Consent Fixes ✅

Fixed post-testing issues with legal compliance features.

**Bug Fixes**:
- **CRITICAL**: Fixed consent not saving during registration
  - **Initial Attempt**: Node.js retry/upsert logic (insufficient due to race conditions/RLS).
  - **Final Solution**: Implemented **Database Trigger** (`create_user_profile`) update.
    - Passed `terms_accepted` and `privacy_accepted` via `raw_user_meta_data` in `supa.auth.signUp`.
    - Updated Postgres trigger to read metadata and insert profile *synchronously* with user creation.
    - Added `SECURITY DEFINER` to trigger function to bypass RLS during profile creation.
- **Terminology**: Changed "Условия использования" → "Пользовательское соглашение" (RU)
- **Version display**: Added version number to legal pages format
  - New format: "Version 1.0.0, last updated: 25.12.2025"
- **Punctuation**: Added periods at the end of consent checkbox link labels

**Files Modified**:
- `packages/auth-backend/base/src/routes/auth.ts` - Added metadata to signUp options.
- `packages/profile-backend/base/src/database/migrations/postgres/1767057000000-UpdateProfileTrigger.ts` - New migration for trigger logic.
- `packages/profile-backend/base/src/database/migrations/postgres/index.ts` - Registered new migration.
- `packages/start-frontend/base/src/i18n/locales/ru/legal.json` - Terminology + version format
- `packages/start-frontend/base/src/i18n/locales/en/legal.json` - Version format
- `packages/start-frontend/base/src/views/LegalPage.tsx` - Pass version to translation
- `packages/universo-i18n/base/src/locales/ru/views/auth.json` - Terminology + periods
- `packages/universo-i18n/base/src/locales/en/views/auth.json` - Periods

**Technical Notes**:
- PostgreSQL RETURNING clause returns array of affected rows (reliable check)
- UPSERT fallback ensures profile with consent is created even if trigger fails
- No migration needed - schema already supports consent fields

---

### Terms of Service & Privacy Policy Consent ✅

Implemented legal compliance features for GDPR/regulatory requirements: legal pages with PDF documents and consent checkboxes in registration form.

**Database Changes**:
- Created migration `1767049102876-AddConsentFields.ts` in profile-backend
- Added 4 columns to `profiles` table:
  - `terms_accepted BOOLEAN DEFAULT false`
  - `terms_accepted_at TIMESTAMPTZ`
  - `privacy_accepted BOOLEAN DEFAULT false`
  - `privacy_accepted_at TIMESTAMPTZ`
- Created indexes `idx_profiles_terms_accepted`, `idx_profiles_privacy_accepted`

**Backend Changes**:
- Extended `RegisterSchema` (zod) requiring `termsAccepted: true`, `privacyAccepted: true`
- Updated `/register` endpoint to save consent with timestamps after user creation
- Implemented retry pattern (up to 3 attempts) to handle async profile creation trigger

**Frontend Changes**:
- Created `LegalPage.tsx` component with `TermsPage`/`PrivacyPage` variants
- Added `/terms` and `/privacy` routes with `StartLayoutMUI`
- Added consent checkboxes to `AuthView.tsx` (shown only when labels provided)
- Checkboxes link to /terms and /privacy (opens in new tab)

**i18n**:
- Created `legal.json` translations (EN/RU) for legal pages
- Added consent labels to `auth.json` (termsCheckbox, privacyCheckbox, consentRequired)

**Post-implementation Fixes**:
- Disabled the Register submit button until both consent checkboxes are checked
- Added `/terms` and `/privacy` to the public UI whitelist to prevent guest redirects to `/auth`
- Registered start-frontend i18n in the main route tree so legal pages render translations
- Reworked legal pages layout to match onboarding completion screen and added a "Go to home" button

**Files Created**:
- `packages/profile-backend/base/src/database/migrations/postgres/1767049102876-AddConsentFields.ts`
- `packages/start-frontend/base/src/views/LegalPage.tsx`
- `packages/start-frontend/base/src/i18n/locales/en/legal.json`
- `packages/start-frontend/base/src/i18n/locales/ru/legal.json`

---

## 📅 2025-12-28

### Auth Register 419 Auto-Retry ✅

Fixed a UX issue where registration could fail on the first submit with HTTP 419 (stale CSRF token), requiring a second click.

**Changes**:
- Added retry-once logic for `auth/register`: on 419, clear stored CSRF token and retry once (same approach as login).

**Files Modified**:
- `packages/auth-frontend/base/src/pages/AuthPage.tsx`

### Start Page UI Bugfixes ✅

Fixed two UX issues on the start/onboarding screens.

**Changes**:
- **Completion screen desktop spacing**: Increased top padding when rendering `CompletionStep` standalone so the hero image does not overlap the fixed AppBar.
- **Auth button flicker**: Prevented the brief Login→Logout flash by hiding auth actions until `useAuth()` finishes loading.

**Files Modified**:
- `packages/start-frontend/base/src/views/AuthenticatedStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx`
- `packages/start-frontend/base/src/views/components/AppAppBar.tsx`

## 📅 2025-06-30

### Onboarding Completion Tracking (MVP) ✅

Implemented feature to track whether user has completed onboarding wizard. Existing users will need to complete onboarding again (get `onboarding_completed = FALSE` by default).

**Database Changes**:
- Created migration `1766821477094-AddOnboardingCompleted.ts` in profile-backend
- Added `onboarding_completed BOOLEAN NOT NULL DEFAULT false` column to `profiles` table
- Created index `idx_profiles_onboarding_completed` for query optimization
- Migration uses `IF NOT EXISTS` for idempotent execution

**Backend Changes**:
- Updated `GET /api/v1/onboarding/items` to return `onboardingCompleted` status from Profile entity
- Updated `POST /api/v1/onboarding/join` to set `onboarding_completed = true` within transaction
- Added `@universo/profile-backend` dependency to start-backend for Profile entity access

**Frontend Changes**:
- `AuthenticatedStartPage`: Now fetches onboarding status first, shows loading spinner while checking
  - If `onboardingCompleted === true` → renders `<CompletionStep onStartOver={...} />`
  - If `onboardingCompleted === false` → renders `<OnboardingWizard onComplete={...} />`
- `CompletionStep`: Added `onStartOver` prop with "Start Over" button to allow re-doing onboarding
- `OnboardingWizard`: Fixed `onComplete` callback timing - now called when moving to completion step (was never called before due to button replacement logic)

**Files Created**:
- `packages/profile-backend/base/src/database/migrations/postgres/1766821477094-AddOnboardingCompleted.ts`

**Files Modified**:
- `packages/profile-backend/base/src/database/entities/Profile.ts` - Added `onboarding_completed` column
- `packages/profile-backend/base/src/database/migrations/postgres/index.ts` - Registered new migration
- `packages/start-backend/base/package.json` - Added profile-backend dependency
- `packages/start-backend/base/src/routes/onboardingRoutes.ts` - Read/write onboarding status
- `packages/start-frontend/base/src/types/index.ts` - Added types for onboardingCompleted
- `packages/start-frontend/base/src/views/AuthenticatedStartPage.tsx` - Conditional rendering
- `packages/start-frontend/base/src/components/CompletionStep.tsx` - Added onStartOver button
- `packages/start-frontend/base/src/components/OnboardingWizard.tsx` - Fixed onComplete timing

**Build**: 61 tasks successful

---

## 📅 2025-12-26

### Start Page i18n & Styling Enhancements ✅

Internationalized remaining guest page elements and updated text styling.

**Internationalization**:
- **Testimonials (4 modules)**: Created `testimonials` section in `landing.json` with translations for Universo Kompendio, Platformo, Kiberplano, and Grandaringo
- **AppAppBar buttons**: Created `appbar.json` (EN/RU) with `login` and `logout` translations; updated both desktop and mobile views

**Text Updates**:
- **Name correction**: "Vladimir Levadnyi" → "Vladimir Levadnij" (EN), kept Russian spelling
- **Title updates**: 
  - EN: "General Worker" → "General Diverseworker"
  - RU: "генеральный разнорабочий" → "Генеральный разнорабочий" (capitalized)

**Styling**:
- **Welcome title**: Added blue color (`color: 'primary.main'`) to match completion slogan
- **Completion slogan**: Increased size from `variant="h6"` to `variant="h4"` to match welcome title

**Cleanup**:
- Removed duplicate files from `packages/universo-template-mui/base/src/views/start-page/`:
  - `StartPage.tsx`
  - `GuestStartPage.tsx`
  - `AuthenticatedStartPage.tsx`
  - `assets/` folder (entire directory)

**Files Created**:
- `packages/universo-template-mui/base/src/i18n/locales/en/appbar.json`
- `packages/universo-template-mui/base/src/i18n/locales/ru/appbar.json`

**Files Modified**:
- `packages/start-frontend/base/src/views/components/Testimonials.tsx` - Internationalized with i18n
- `packages/start-frontend/base/src/i18n/locales/en/landing.json` - Added testimonials section
- `packages/start-frontend/base/src/i18n/locales/ru/landing.json` - Added testimonials section
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx` - Added i18n for buttons
- `packages/start-frontend/base/src/i18n/locales/en/onboarding.json` - Updated name and title
- `packages/start-frontend/base/src/i18n/locales/ru/onboarding.json` - Updated name and title (capitalized)
- `packages/start-frontend/base/src/components/WelcomeStep.tsx` - Added blue color to title
- `packages/start-frontend/base/src/components/CompletionStep.tsx` - Increased slogan size

---

### Onboarding Content & i18n Enhancement ✅

Added personalized content and internationalized guest landing page.

**Changes**:
- **Welcome intro paragraph**: Added personal introduction from Vladimir Levadnyi (General Worker at Teknokomo) after the welcome title in WelcomeStep
- **Completion notice section**: Added styled notice box before "All worlds will be ours!" slogan with:
  - Alpha version warning about potential delays and glitches
  - Links to GitHub and GitVerse repositories for tracking updates
  - Link to Boosty for support information
- **Guest landing page i18n**: Internationalized Hero component:
  - Created `landing.json` localization files (EN/RU)
  - Added `registerLandingI18n` function
  - Hero now uses `useTranslation('landing')` hook
  - All text (title, description, button) now supports language switching

**Files Created**:
- `packages/start-frontend/base/src/i18n/locales/en/landing.json`
- `packages/start-frontend/base/src/i18n/locales/ru/landing.json`

**Files Modified**:
- `packages/start-frontend/base/src/components/WelcomeStep.tsx` - Added intro paragraph
- `packages/start-frontend/base/src/components/CompletionStep.tsx` - Added notice section with links
- `packages/start-frontend/base/src/views/components/Hero.tsx` - Internationalized with i18n
- `packages/start-frontend/base/src/i18n/register.ts` - Added `registerLandingI18n`
- `packages/start-frontend/base/src/i18n/locales/en/onboarding.json` - Added intro and notice keys
- `packages/start-frontend/base/src/i18n/locales/ru/onboarding.json` - Added intro and notice keys
- `packages/start-frontend/base/src/index.ts` - Exported `registerLandingI18n`

---

## 📅 2025-06-29

### Onboarding Wizard QA Round 4 ✅

Fixed additional UI/UX issues reported during testing.

**Changes**:
- **AppAppBar border**: Verified that border styling (`1px solid`) was present in the original code and was not introduced during migration
- **Mobile content visibility**: Increased top padding for OnboardingWizard on mobile devices (`pt: { xs: 14 }` = 112px) to prevent content being hidden under fixed header
- **Removed mobile step indicator**: Deleted the "Шаг X из Y" text that was added in QA Round 3 per user request
- **Language switcher**: Added `LanguageSwitcher` component to AppAppBar (both desktop and mobile views) allowing users to switch between EN/RU on the start page

**Files Modified**:
- `packages/start-frontend/base/src/components/OnboardingWizard.tsx` - Fixed top padding, removed mobile step indicator
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx` - Added LanguageSwitcher import and placement

---

### Onboarding Wizard QA Fixes ✅

Completed three rounds of QA fixes for the onboarding wizard.

**QA Round 3 - Mobile & Text Fixes**:
- Fixed completion text: "shared vision" → "great goals" (EN), "общему видению" → "великим целям" (RU)
- Changed slogan styling from italic to bold (`fontWeight: 700`)
- Fixed mobile horizontal overflow by hiding Stepper on xs screens and adding mobile step indicator ("Step X of Y")
- Added `steps.progress` i18n key for mobile step indicator
- **Major refactor**: Moved start page views from `universo-template-mui` to `@universo/start-frontend`:
  - Created `views/` folder in start-frontend with StartPage, AuthenticatedStartPage, GuestStartPage
  - Created `views/components/` with Hero, Testimonials, SitemarkIcon, AppAppBar
  - Updated MainRoutesMUI.tsx to import StartPage from `@universo/start-frontend/views/StartPage`
  - Added views exports to start-frontend package.json and index.ts

**QA Round 2**:
- Hidden Back button on first (Welcome) step
- Restyled CompletionStep with hero image similar to WelcomeStep
- Renamed start_mars.jpg to start-mars.jpg (kebab-case)

**QA Round 1**:
- Fixed i18n translations not loading (removed extra `onboarding:` wrapper from JSON)
- Added auto-selection of first item on initial load
- Implemented sync logic - added/removed members on selection change
- Replaced "Finish" button with "Start Over" (resets wizard)

**Files Modified/Created**:
- `packages/start-frontend/base/src/components/OnboardingWizard.tsx` - Mobile fixes, Typography import
- `packages/start-frontend/base/src/components/CompletionStep.tsx` - Text & styling fixes
- `packages/start-frontend/base/src/i18n/locales/*/onboarding.json` - Text updates, progress key
- `packages/start-frontend/base/src/views/` - New folder with StartPage, AuthenticatedStartPage, GuestStartPage
- `packages/start-frontend/base/src/views/components/` - Hero, Testimonials, SitemarkIcon, AppAppBar
- `packages/start-frontend/base/package.json` - Added views exports, react-router-dom, @mui/icons-material
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - Updated StartPage import

---

### Onboarding Wizard Implementation ✅

Created multi-step onboarding wizard for new users to select their interests: Projects (Global Goals), Campaigns (Personal Interests), and Clusters (Platform Features) owned by system admin.

**Architecture**:
- Two new packages: `@universo/start-backend` and `@universo/start-frontend`
- Backend uses lazy router pattern matching other services
- Frontend uses MUI Stepper with 5 steps: Welcome, Projects, Campaigns, Clusters, Completion

**Backend (start-backend)**:
- `GET /api/v1/onboarding/items` - Returns admin-owned Projects, Campaigns, Clusters with user's selection status
- `POST /api/v1/onboarding/join` - Validates admin ownership and adds user as "member" to selected items in transaction
- Rate limiting: 30 req/min for reads, 10 req/min for writes
- Searches admin by email (580-39-39@mail.ru) for portability across environments

**Frontend (start-frontend)**:
- `OnboardingWizard` - Main 5-step stepper component with state management
- `SelectableListCard` - Card list with large numbers, checkboxes, click-to-toggle selection
- `WelcomeStep` - Hero image (start_mars.jpg) with inspiring welcome text
- `SelectionStep` - Reusable step for selecting items by category
- `CompletionStep` - Final message with continue button
- i18n support: English and Russian translations in `onboarding` namespace

**Integration**:
- Registered in `flowise-core-backend/routes/index.ts` with lazy router pattern
- Rate limiters initialized in `flowise-core-backend/src/index.ts`
- `AuthenticatedStartPage.tsx` in `universo-template-mui` replaced demo DataGrid with OnboardingWizard
- i18n registration via `registerOnboardingI18n()` function

**Files Created** (19 files):
- `packages/start-backend/base/*` - Backend package (7 files)
- `packages/start-frontend/base/*` - Frontend package (12 files)

**Build Status**: ✅ `pnpm build` successful (61 tasks)

---

## 📅 2025-12-26

### Quiz Leads API & Analytics Bug Fixes ✅

Fixed two critical bugs preventing quiz leads from being saved and analytics data from displaying correctly after AR.js Quiz completion.

**Problems**:
1. **Leads API 400 Error**: POST `/api/v1/leads` returned 400 when quiz sent `{canvasId: null, points: 9}` payload after completion
2. **Analytics TypeError**: `w.map is not a function` error crashed Analytics page when displaying canvases dropdown

**Root Causes**:
1. Zod schema in `leadsService.ts` required `canvasId` as UUID, rejecting null/empty string values sent during quiz initialization
2. Zod schema didn't accept `points` field sent by quiz template
3. Backend returns canvases as `{canvases: [...], total: N}` but frontend expected plain array

**Solutions Implemented**:

*Backend Changes*:
- Updated Lead migration to make `canvas_id` nullable, added performance indexes (IDX_lead_canvas_id, IDX_lead_created_date)
- Updated Lead entity: `canvasId` changed to optional field with `nullable: true`
- Enhanced Zod schema:
  - `canvasId`: Made optional with transformation: `z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? undefined : val)`
  - `points`: Added field with validation: `z.number().int().nonnegative().optional().default(0)`
- Updated `createLead` logic to use `validatedData.points ?? 0`

*Frontend Changes*:
- Added `normalizeCanvasesResponse()` function in Analytics.jsx to handle both array and object wrapper formats
- Updated canvases useEffect to normalize API response before setState

*Type Extraction*:
- Created `packages/universo-types/base/src/validation/leads.ts` with ILead, CreateLeadPayload, LeadsAnalytics interfaces
- Updated @flowise/leads-backend to use types from @universo/types
- Added backwards compatibility aliases (CreateLeadBody → CreateLeadPayload)

*Testing*:
- Created comprehensive unit tests for leadsService (`__tests__/leadsService.test.ts`)
- 19 test suites covering: valid data, optional canvasId, points validation, email format, real-world quiz scenarios
- All tests passing ✅

**Files Modified**:
- `packages/flowise-leads-backend/base/src/database/migrations/postgres/1710832137905-AddLead.ts`
- `packages/flowise-leads-backend/base/src/database/entities/Lead.ts`
- `packages/flowise-leads-backend/base/src/services/leadsService.ts`
- `packages/flowise-leads-backend/base/src/Interface.ts`
- `packages/analytics-frontend/base/src/pages/Analytics.jsx`
- `packages/universo-types/base/src/validation/leads.ts` (NEW)
- `packages/universo-types/base/src/index.ts`
- `packages/flowise-leads-backend/base/src/services/__tests__/leadsService.test.ts` (NEW)
- `packages/flowise-leads-backend/base/package.json` (added test scripts + Jest dependencies)
- `packages/flowise-leads-backend/base/jest.config.js` (NEW)

**Build Status**: 
- ✅ `pnpm build --filter @universo/types` successful (5.021s)
- ✅ `pnpm build --filter @flowise/leads-backend` successful (15.943s)
- ✅ `pnpm build --filter @universo/analytics-frontend` successful (46.513s total with dependencies)
- ✅ `pnpm test` for @flowise/leads-backend: 19/19 tests passed (2.654s)

**Benefits**:
- Quiz leads now save correctly without 400 errors
- Analytics page displays canvases dropdown without crashes
- Improved database query performance with new indexes
- Type safety across backend/frontend with centralized types
- Comprehensive test coverage for validation logic
- Modern patterns without legacy code

**Next Steps**: Integration test required - create quiz → publish → complete → verify Analytics displays data correctly.

---

### Anonymous Quiz Access Fix ✅

Fixed 401 Unauthorized error when unauthenticated users tried to access published quizzes via `/p/{slug}` URLs.

**Problem**: 
- Anonymous users couldn't access published quizzes 
- Browser console showed `GET /api/v1/publish/public/{slug}` returning 401
- Expected behavior: anyone should be able to view and complete published quizzes without login

**Root Cause**:
- `/api/v1/publish/public/` endpoint was missing from `API_WHITELIST_URLS` in auth middleware configuration
- While `/api/v1/publish/arjs/public/` was whitelisted, the general `/api/v1/publish/public/` was not
- All non-whitelisted API routes require JWT authentication
- Additionally, `createEnsureAuthWithRls` middleware wrapped `ensureAuth` and returned 401 for anonymous requests before the whitelist could apply

**Investigation Performed**:
- Verified frontend route `/p/` is in `PUBLIC_UI_ROUTES` ✅
- Checked RLS policies via Supabase MCP: `canvases` table has RLS (authenticated only), `publish_canvases` RLS disabled
- Confirmed FlowDataService uses direct DataSource (bypasses RLS) but checks `isPublic` flag for security

**Solution**:
Added two endpoints to `API_WHITELIST_URLS` in `packages/universo-utils/base/src/routes/index.ts`:
```typescript
// Public publication endpoints (accessible without authentication)
'/api/v1/publish/public/',
'/api/v1/publish/canvas/public/'
```

Updated `createEnsureAuthWithRls` to bypass whitelisted public endpoints (prevents 401 for anonymous publish URLs even when RLS middleware is mounted):
- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`

**Security Verification**:
- `FlowDataService.getFlowDataBySlug()` already validates: `if (!link.isPublic) throw new Error('Unik link is not public')`
- Only canvases explicitly marked as public are accessible via these endpoints
- No authorization bypass for private content

**Files Modified**:
- `packages/universo-utils/base/src/routes/index.ts`
- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`

**Build Status**:
- ✅ `pnpm build --filter @universo/utils` successful (13.474s)
- ✅ `pnpm build --filter @universo/auth-backend` successful (23.45s)
- ✅ `pnpm build --filter @flowise/core-backend` successful (48 tasks, 6m12.606s)

**Result**: Anonymous users can now access published quizzes at `/p/{slug}` without login requirement.

---

### Login After Server Restart Fix ✅

Implemented automatic retry on CSRF token expiration during login, eliminating the need for users to click twice or manually clear cookies.

**Problem**:
- After server restart, first login attempt returned 419 (CSRF token expired)
- User had to click "Login" button twice OR manually clear browser cookies
- Poor UX due to stale CSRF token stored in `sessionStorage`

**Root Cause**:
- Server restart clears MemoryStore sessions (old CSRF secrets gone)
- Browser still holds old CSRF token in sessionStorage (`up.auth.csrf`)
- First POST `/auth/login` with stale token → server returns 419
- Frontend interceptor clears token on 419, but doesn't auto-retry
- Second click fetches fresh CSRF and succeeds

**Solution**:
- Added retry wrapper in `authProvider.tsx` login function
- On 419 response: clear stale CSRF token → immediate retry once
- Same pattern added to `LoginForm.tsx` for standalone usage
- Retry limited to exactly one attempt to prevent infinite loops

**Files Modified**:
- `packages/auth-frontend/base/src/providers/authProvider.tsx` - Retry logic in login function
- `packages/auth-frontend/base/src/components/LoginForm.tsx` - Retry logic in handleSubmit

**Build Status**: ✅ `pnpm build` successful (59 tasks, 7m35s)

**Benefits**:
- Single-click login after server restart
- No manual intervention required
- Graceful handling of stale CSRF tokens
- Minimal code changes (~15 lines total)

**Related Issues**: Session persistence on restart remains deferred (see tasks.md). This fix makes the symptom (login failure) non-blocking for MVP.

---

### Logout Redirect Fix ✅

Removed forced page redirect after logout for smoother user experience.

**Problem**:
- After logout, user was redirected to `/auth` via `window.location.href = '/auth'`, causing full page reload and preventing natural guest content display.

**Solution**:
- Removed hardcoded redirect from `authProvider.tsx` logout function.
- React now naturally re-renders guest content when `isAuthenticated` becomes `false`.
- Pages with conditional rendering (e.g., `StartPage.tsx`) automatically show guest version.

**Files Modified**:
- `packages/auth-frontend/base/src/providers/authProvider.tsx` - Removed redirect, added comment explaining React's declarative approach.

**Build Status**: ✅ `pnpm build` successful (59 tasks, 7m46s)

**Benefits**:
- No page reload on logout (smoother UX)
- User stays on current page and sees guest content if available
- Follows React's declarative rendering approach

---

### Session Persistence Planning 📋 DEFERRED

Documented issue where sessions are lost on server restart (MemoryStore limitation). Deferred implementation until production deployment pattern is clear.

**Problem**: User must re-login after server restart because sessions stored in memory are cleared.

**Options**: PostgreSQL session store, Redis, or stateless JWT approach.

**Decision**: For MVP/dev, manual re-login on restart is acceptable. Will revisit when production needs are clearer.

---

## 📅 2025-12-25

### Logout Functionality Fix ✅

Implemented a more robust logout flow to prevent users from being immediately re-authenticated after clicking logout.

**Root Cause**:
- Frontend cached CSRF token became stale after server-side `session.regenerate()` during login (CSRF secret stored in session via `csurf({ cookie: false })`).
- CSRF failures were not surfaced as HTTP 419, so the client did not clear/refresh CSRF and logout could fail to execute reliably.
- The `/auth` page refresh logic then called `/auth/me`; if the session/cookie remained valid, the UI redirected back into the app.

**Fixes Implemented**:
1. **Frontend**
  - Clear cached CSRF token after successful login before refreshing the session.
  - Retry logout exactly once on HTTP 419 by clearing CSRF and retrying the POST.
2. **Backend**
  - Map `EBADCSRFTOKEN` to HTTP 419 in the global error middleware (and preserve existing status codes).
  - Harden `/logout` to be idempotent and deterministic: best-effort Supabase signOut, Passport logout, session destroy, and clear the session cookie using the correct path.

Build verification: ✅ `pnpm build` successful (full workspace)

Note: Manual browser verification is still required (confirm `/api/v1/auth/me` returns 401 after logout and UI stays on `/auth`).

### Auth Redirect & Landing Page Fixes ✅

Fixed multiple issues with auth flow and landing page for guests.

**Issues Fixed**:

1. **Flash of Protected Content** - Protected routes briefly showed layout/breadcrumbs before redirect
   - Root Cause: `MainLayoutMUI` rendered before `AuthGuard` could redirect
   - Fix: Moved `AuthGuard` to wrap entire `MainLayoutMUI`, removed 35+ redundant child wrappers

2. **Infinite Redirect Loop on /auth** - Auth page kept reloading infinitely
   - Root Cause: `/auth` was not in `PUBLIC_UI_ROUTES`, so 401 from `/auth/me` triggered redirect back to `/auth`
   - Fix: Added `/auth` to `PUBLIC_UI_ROUTES` in `@universo/utils/routes`

3. **Landing Page UI Updates**:
   - "Start now" button now links to `/auth` (RouterLink)
   - Header: Commented out "Sign in" text button, changed "Sign up" to "Sign in"
   - Both desktop and mobile buttons link to `/auth`
   - Commented out Testimonials header (title + description)
   - Commented out demo user data in cards (avatar, name, occupation, logo)

**Files Modified**:
- `packages/universo-utils/base/src/routes/index.ts` - Added `/auth` to `PUBLIC_UI_ROUTES`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx` - AuthGuard architecture fix
- `packages/universo-template-mui/base/src/views/start-page/components/Hero.tsx` - RouterLink for Start now
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx` - Sign in button + RouterLink
- `packages/universo-template-mui/base/src/views/start-page/components/Testimonials.tsx` - Commented out header/demo data

Build verification: `pnpm build` successful (59 tasks)

---

### API Client Architecture Refactoring ✅

Eliminated ~500 lines of duplicate code by consolidating public routes and 401 redirect logic.

**New Modules Created**:
1. **`@universo/utils/routes`** - Single source of truth for public routes:
   - `API_WHITELIST_URLS` - Backend endpoints not requiring JWT (21 endpoints)
   - `PUBLIC_UI_ROUTES` - Frontend routes where 401 should not redirect
   - `isPublicRoute()` - Helper function for route checking

2. **`@universo/utils/api/pagination`** - Shared pagination utilities:
   - `extractPaginationMeta()` - Extract pagination from response headers
   - `PaginationMeta` type

**Extended `@universo/auth-frontend`**:
- Added `redirectOn401` option to `createAuthClient()`:
  - `'auto'` (default) - Use `isPublicRoute()` from `@universo/utils`
  - `true` - Always redirect to `/auth` on 401
  - `false` - Never redirect
  - `string[]` - Custom routes array

**Files Simplified (9 apiClient.ts files)**:
- Each file reduced from ~50 lines to ~15 lines
- Removed duplicate `isPublicRoute()` definitions
- Removed duplicate 401 interceptors
- Now use centralized `createAuthClient({ redirectOn401: 'auto' })`

**Backend Update**:
- `flowise-core-backend` now imports `API_WHITELIST_URLS` from `@universo/utils`
- Removed `WHITELIST_URLS` from `utils/constants.ts`

**Cleanup**:
- Deleted unused `packages/flowise-core-frontend/base/src/api.js`
- Updated all files with duplicate `isPublicRoute()` to use shared version

**Build**: ✅ `pnpm build` successful (59 tasks)

---

### Start Page: Auth-Conditional Rendering ✅

Extended start page to show different content based on authentication status.

**Changes**:
1. **Hero Cleanup**: Removed email input, Terms & Conditions text, commented out dashboard screenshot
2. **AppAppBar Cleanup**: Commented out left navigation buttons (Features, Testimonials, etc.)
3. **Architecture Split**:
   - Created `StartLayoutMUI.tsx` - minimal layout with AppAppBar only
   - Created `GuestStartPage.tsx` - landing for non-authenticated (Hero + Testimonials)
   - Created `AuthenticatedStartPage.tsx` - dashboard with MUI DataGrid demo
   - Created `StartPage.tsx` - switcher component using `useAuth()`

4. **Guest Redirect Fix (401 auto-redirect)**:
  - **Problem**: Non-authenticated users saw the guest landing briefly, then were redirected to `/auth`
  - **Root Cause**: Several frontend API clients/hooks enforced a global `401 → /auth` redirect without considering public routes. Background requests that return `401` for guests (e.g. `/auth/me`, `/auth/permissions`) triggered the redirect.
  - **Fix**: Added a public-route allowlist (including `/`, `/p/*`, `/b/*`, `/chatbot/*`, `/bots/*`, `/execution/*`) and skip the auto-redirect on those routes.
  - **Note**: The legacy `MainRoutes` catch-all cleanup was kept, but it was not sufficient on its own.

**Route Architecture**:
```
/                          → StartRoute
├── StartLayoutMUI         → AppTheme + AppAppBar
│   └── StartPage          → useAuth() check
│       ├── GuestStartPage       (if !isAuthenticated)
│       └── AuthenticatedStartPage (if isAuthenticated)
```

**Files Created**:
- `packages/universo-template-mui/base/src/layout/StartLayoutMUI.tsx`
- `packages/universo-template-mui/base/src/views/start-page/GuestStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/AuthenticatedStartPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/StartPage.tsx`

**Files Modified**:
- `packages/universo-template-mui/base/src/views/start-page/components/Hero.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`
- `packages/flowise-template-mui/base/src/routes/index.jsx` - removed MainRoutes from routeTree
- `packages/flowise-template-mui/base/src/routes/MainRoutes.jsx` - deprecated (set to null)
- `packages/flowise-core-frontend/base/src/api/client.js` - skip 401 redirect on public routes
- `packages/flowise-core-frontend/base/src/api.js` - skip 401 redirect on public routes
- `packages/universo-api-client/base/src/client.ts` - skip 401 redirect on public routes
- `packages/auth-frontend/base/src/hooks/useAuthError.ts` - skip navigation to /auth on public routes

**Build Status:** ✅ `pnpm build` successful (59 tasks)

---

### Start Page: Marketing Page Template MVP ✅

Integrated MUI Marketing Page template as the public landing page for the platform.

**Problem**: Copied MUI marketing-page template had build errors due to:
1. Incorrect import paths (template expected `shared-theme/` folder)
2. MUI Grid2 API (`size` prop) incompatible with current project's Grid v1 usage
3. TypeScript errors with `theme.vars` type definitions

**Solution**:
1. Fixed import paths: `../shared-theme/` → `../../components/shared/` for `AppTheme` and `ColorModeIconDropdown`
2. Converted Grid2 API to Grid v1: `size={{ xs: 12, sm: 6 }}` → `xs={12} sm={6}` in Highlights, Pricing, Testimonials
3. Fixed TypeScript in AppAppBar.tsx using theme fallback pattern

**Route Changes**:
- Created public `LandingRoute` for `/` path (no AuthGuard)
- Moved `UnikList` from index route to `/dashboard` path
- Landing page shows: AppAppBar (menu), Hero (products + email), Testimonials

**MVP Status**: Demo sections temporarily commented (LogoCollection, Features, Highlights, Pricing, FAQ, Footer) with `MVP: Temporarily commented out` markers for future restoration.

**Files Modified**:
- `packages/universo-template-mui/base/src/views/start-page/MarketingPage.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/AppAppBar.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/Highlights.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/Pricing.tsx`
- `packages/universo-template-mui/base/src/views/start-page/components/Testimonials.tsx`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

**Build Status:** ✅ `pnpm build --filter @universo/template-mui` successful

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
