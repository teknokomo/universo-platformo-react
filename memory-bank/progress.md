# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks → tasks.md, architectural patterns → systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.43.0-alpha | 2025-12-27 | Privacy Consent 🔒 | Cookie Consent Banner, Lead Consent for Quiz AR.js, Legal pages (Terms/Privacy), Profile consent fields |
| 0.42.0-alpha | 2025-12-18 | Onboarding Journey 🎯 | Onboarding Wizard MVP, Start page auth-conditional rendering, Marketing landing page |
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
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🛰 | Metaverses dashboard, Universal List Pattern |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Language switcher, MMOOMM template, Finance module |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM modular package, Multiplayer Colyseus server |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder MVP, Metaverse module, @universo/types |

---

## 📅 2026-01-03

### i18n Migration to registerNamespace() Pattern ✅

- **Pattern Unification**: Migrated `start-frontend` from legacy manual registration to standard `registerNamespace()` pattern
- **Problem Solved**: `landing` namespace was missing from central registration, forcing components to call `registerLandingI18n(i18n)` in useEffect
- **Changes**:
  - Added `landing` namespace to `i18n/index.ts` via `registerNamespace()`
  - Refactored `Testimonials.tsx`, `Hero.tsx`, `StartFooter.tsx` - removed useEffect, switched to `@universo/i18n`
  - Refactored `AuthenticatedStartPage.tsx` - removed redundant `registerOnboardingI18n` call
  - Marked all legacy functions in `register.ts` as `@deprecated`
  - Marked legacy exports in `index.ts` as `@deprecated`
- **Benefits**: Cleaner code, no useEffect for i18n, no isReady state, consistent with 20+ other packages
- **Backwards Compatibility**: Legacy functions preserved with @deprecated notice for any external consumers
- **Build Status**: Full workspace build passed (61 tasks, 6m8s)

### Start Section Footer & Onboarding Text Updates ✅

- **StartFooter Component**: New reusable footer for start pages
  - Contact info: Owner name (Telegram link), Email address
  - Legal links: Terms of Service, Privacy Policy
  - Responsive: horizontal on desktop, vertical on mobile
  - i18n support: RU/EN translations
  - Files: `StartFooter.tsx`, `landing.json` (ru/en)
- **Footer Integration**: Added to both GuestStartPage and AuthenticatedStartPage
- **Onboarding Text Updates**:
  - WelcomeStep: Added description4 about Universo MMOOMM metaverse
  - Projects step: Updated subtitle with meta-projects clarification
  - Campaigns step: Changed title to "Определите интересные темы", updated subtitle
  - Clusters step: Updated subtitle with functionality availability note
  - Files: `WelcomeStep.tsx`, `onboarding.json` (ru/en)
- **Build Status**: Full workspace build passed (61 tasks, 8m20s)

### Start Section UI Polish (Footer Hover + Paragraph Rendering) ✅

- **Guest Footer Hover**: Updated guest footer links so hover uses a lighter blue for contrast on the landing hero background (internal pages keep primary blue hover).
- **Onboarding Subtitles**: Fixed paragraph rendering for step subtitles by splitting translation strings on blank lines ("\n\n") and rendering each paragraph as its own Typography block.
- **Footer Spacing**: Restored guest cards↔footer vertical spacing to 4 modules after rollback (adjusted testimonials bottom padding).
- **Brand Link**: Made AppAppBar brand (logo + text) clickable with RouterLink to home route (`/`).
- **Build Status**: start-frontend lint and build passed.

---

## 📅 2026-01-02

### SmartCaptcha UX Improvements & Cookie Text Updates ✅

- **onNetworkError Handler**: Added `onNetworkError` callback to SmartCaptcha widget
  - New optional `captchaNetworkError` label in `AuthViewLabels` interface
  - Shows user-friendly error message when captcha service is unavailable
  - Default message: "Captcha service is temporarily unavailable. Please try again."
- **Cookie Consent Text**: Updated rejection dialog text in both languages
  - Replaced generic "Платформа/Platform" with "Universo Platformo" throughout
  - Files: `start-frontend/i18n/locales/ru/cookies.json`, `en/cookies.json`
- **Build Status**: Full workspace build passed (61 tasks, 6m12s)

### SmartCaptcha Mode Switch Fix ✅

- **Bug Fixed**: Captcha widget not resetting after registration → login mode switch
- **Root Cause**: SmartCaptcha widget visually retained checkmark state while `captchaToken` state was reset
- **Solution**: Added `key={`captcha-${mode}`}` prop to SmartCaptcha component
- **Mechanism**: React unmounts/remounts widget on `key` change, forcing fresh state
- **File Modified**: `packages/auth-frontend/base/src/components/AuthView.tsx`
- **Build Status**: Full workspace build passed (61 tasks, 6m21s)

### SmartCaptcha Login Form Support ✅

- **Feature**: Added optional SmartCaptcha support for login form (in addition to existing registration captcha)
- **Environment Variable**: `SMARTCAPTCHA_LOGIN_ENABLED` (default: false) for granular control
- **Backend Changes**:
  - Added `createLoginCaptchaService()` factory to `@universo/utils/captcha`
  - Updated `captchaService.ts`: new exports `getLoginCaptchaConfig`, `isLoginCaptchaRequired`, `validateLoginCaptcha`
  - Updated `/captcha-config` endpoint: returns both registration and login configs (with legacy format for backwards compatibility)
  - Added captcha validation to `/login` route (LoginSchema accepts optional `captchaToken`)
- **Frontend Changes**:
  - New types: `SingleCaptchaConfig`, updated `CaptchaConfig` with `registration`/`login` fields
  - `AuthView.tsx`: Mode-specific captcha config resolution, shows widget on both login/register when enabled
  - `AuthProvider`: `login()` signature accepts optional `captchaToken` parameter
  - `AuthPage.tsx`: `handleLogin` forwards `captchaToken` to backend
- **UX**: Login button disabled until captcha completed when enabled (same as registration)
- **Pattern**: Factory pattern with separate env vars for each captcha use case
- **Build Status**: Full workspace build passed (61 tasks, 5m46s)

### Captcha QA Fixes — Code Quality & Shared Module ✅

- **QA Issues Fixed**: All 4 issues identified in comprehensive QA analysis resolved
- **P0 React Hooks Violation**: Moved all useCallback hooks in AuthPage.tsx BEFORE early return statement
- **P1 Prettier/Linting**: Fixed formatting issues and replaced `err: any` with `err: unknown` + proper type casting
- **P2 Shared Captcha Module Created**: `@universo/utils/captcha`
  - Factory functions: `createRegistrationCaptchaService()`, `createPublicationCaptchaService()`
  - Core exports: `validateCaptchaToken()`, `isCaptchaRequired()`, `getCaptchaConfig()`
  - Types: `CaptchaValidationResult`, `CaptchaConfig`, `CaptchaServiceOptions`
- **P2 axios Migration**: Replaced native `https.request` with axios (catalog:1.13.2)
  - Cleaner promise-based API, built-in timeout support, consistent error handling
- **Code Deduplication**: ~250 lines duplicated captcha code → 35 lines per service (re-export pattern)
- **Files Modified**:
  - `packages/auth-frontend/base/src/pages/AuthPage.tsx` (hooks order, error typing)
  - `packages/auth-frontend/base/src/components/AuthView.tsx` (error typing)
  - `packages/universo-utils/base/src/captcha/index.ts` (NEW - shared service)
  - `packages/auth-backend/base/src/services/captchaService.ts` (refactored to re-export)
  - `packages/flowise-leads-backend/base/src/services/captchaService.ts` (refactored to re-export)
  - `packages/flowise-leads-backend/base/tsconfig.json` (moduleResolution: node → node16)
- **Lint Status**: auth-frontend 0 errors (down from 9), all packages have 0 errors
- **Build Status**: Full workspace build passed (61 tasks successful, 6m03s)

### SmartCaptcha Fail-Closed Security Hardening ✅

- **Security Pattern Changed**: Changed from fail-open to fail-closed for captcha validation
- **Files Modified**:
  - `packages/auth-backend/base/src/services/captchaService.ts`
  - `packages/flowise-leads-backend/base/src/services/captchaService.ts`
- **Error Cases Now Return Failure**:
  - Missing server key: `{ success: false, error: 'Captcha service is not configured' }`
  - API error (non-200): `{ success: false, error: 'Captcha service unavailable' }`
  - Parse error: `{ success: false, error: 'Captcha service error' }`
  - Network error: `{ success: false, error: 'Captcha service unavailable' }`
  - Timeout: `{ success: false, error: 'Captcha service timeout' }`
- **Rationale**: When SmartCaptcha is enabled, it MUST work. Users cannot bypass captcha validation due to API unavailability
- **Lint Status**: Both packages have 0 errors (only warnings remain)
- **Build Status**: Full workspace build passed (61 tasks successful, 5m46s)
- **Deferred**: Rate limiting for leads API endpoint (agreed to implement later)

---

## 📅 2026-01-01

### Server-side Captcha Validation for Leads ✅

- **Security Gap Fixed**: QA analysis identified that lead form captcha tokens were NOT being validated server-side
- **captchaService.ts**: Created in `flowise-leads-backend` mirroring auth-backend pattern
- **Functions Added**:
  - `isPublicationCaptchaRequired()` - checks `SMARTCAPTCHA_PUBLICATION_ENABLED` env var
  - `validatePublicationCaptcha(token, ip)` - validates token via Yandex API
- **leadsService.ts Update**: Added captcha validation before database insert
- **Type Update**: Added `captchaToken?: string` to `CreateLeadPayload` in universo-types
- **Fail-Open Pattern**: Allow on API/network errors (5s timeout) to avoid blocking legitimate users
- **Server Key Safety**: Verified `SMARTCAPTCHA_SERVER_KEY` (ysc2_...) only used in backend services, never exposed to frontend

### Publication Leads Captcha Token Wiring + Safe Logging ✅

- **Frontend (template-quiz)**: `captchaToken` is now included in `POST /api/v1/leads` payload for both multi-scene and node-based quiz modes
- **Frontend Logging**: Removed direct logging of full `leadData` objects that may contain PII and captcha tokens (replaced with safe boolean/length summaries)
- **Backend Logging (leads-backend)**: Sanitized logs to avoid PII and token value leakage; logs only presence/length and consent flags
- **Error Handling**: Preserved `LeadsServiceError` status codes (e.g., captcha failures return 400 instead of being coerced to 500)
- **Captcha Validation**: Avoid sending empty `ip` parameter to the SmartCaptcha validation API
- **Build**: Full workspace build completed successfully (`pnpm build`)

### SmartCaptcha for Quiz Lead Forms ✅

- **Quiz Captcha Support**: Extended Yandex SmartCaptcha to AR.js quiz lead collection forms
- **UPDL Schema**: Added `captchaEnabled` and `captchaSiteKey` fields to `IUPDLSpace.leadCollection`
- **Space Node Config**: Added UI inputs in Space Builder for captcha settings
- **HTML Integration**: SmartCaptcha widget rendered via `class="smart-captcha"` with `data-sitekey`, `data-callback`, `data-expired-callback`
- **Script Loading**: Dynamic `captcha.js` script injection with success/expired callbacks
- **Form Validation**: Button disabled until captcha solved; validation on submit for both multi-scene and node-based quiz modes
- **Consent Text**: Updated lead form checkbox text from "Я принимаю" → "Я ознакомился и принимаю" to match registration form

### Environment Documentation Update ✅

- **Clarified test mode**: Updated `.env` and `.env.example` documentation to explain that `SMARTCAPTCHA_TEST_MODE=true` forces challenge display but does NOT bypass domain validation
- **Localhost guidance**: Added note about configuring localhost/127.0.0.1 in Yandex Cloud Console allowed domains

### Publication Captcha Wiring ✅

- **Issue**: Published app `/p/:slug` did not show captcha even with `SMARTCAPTCHA_PUBLICATION_ENABLED=true` because generated lead form relied only on per-space `leadCollection.captcha*` fields.
- **Fix**: Added global publication captcha config fetch in publish-frontend and passed it into template build options; template-quiz merges it into `leadCollection` as default.
- **Endpoint**: `GET /api/v1/publish/captcha/config` returns `{ enabled, siteKey, testMode }`.
- **Auth**: Added `GET /api/v1/publish/captcha/config` to `API_WHITELIST_URLS` to prevent 401 from the global `/api/v1` auth middleware in flowise-core-backend.
- **Result**: SmartCaptcha widget is injected into generated HTML when global publication captcha is enabled and a siteKey is configured.

### Publication Captcha Test Mode Fix ✅

- **Issue**: Published `/p/:slug` SmartCaptcha iframe URL stayed `test=false` even when backend config had `testMode: true`.
- **Fix**: Switched template-quiz lead form integration to explicit `window.smartCaptcha.render(..., { test })` initialization and loaded captcha script with `?render=onload&onload=__onSmartCaptchaReady`.
- **Result**: When `SMARTCAPTCHA_TEST_MODE=true`, the widget receives `test=true` and shows the test-mode behavior.

### Publication Captcha Domain Fix ✅

- **Issue**: SmartCaptcha showed "Key cannot be used on domain" inside published `/p/:slug` because AR content was embedded via `iframe.srcdoc`, making the iframe origin `about:srcdoc` (not `localhost`).
- **Fix**: Switched AR iframe rendering from `srcdoc` to a `blob:` URL created from the generated HTML, preserving the parent origin (e.g., `http://localhost:3000`) for domain allowlisting.
- **Where**: publish-frontend AR viewer.

### Yandex Smart Captcha Integration ✅

- **Registration Security**: Integrated Yandex Smart Captcha into registration flow
- **Two-Way Validation**: Frontend widget + Backend API token verification
- **Fail-Open Design**: Allows registration if captcha keys are missing (Dev/Test mode)
- **UI/UX**: Added captcha widget below consent checkboxes, disabled register button until solved
- **i18n**: Added translations for captcha requirements and updated consent checkbox labels

### Captcha Configuration Centralization ✅

- **Centralized ENV**: All captcha settings in `packages/flowise-core-backend/base/.env`:
  - `SMARTCAPTCHA_REGISTRATION_ENABLED` - registration on/off toggle
  - `SMARTCAPTCHA_TEST_MODE` - enable test mode for localhost
  - `SMARTCAPTCHA_SITE_KEY` - client-side key
  - `SMARTCAPTCHA_SERVER_KEY` - server-side secret
- **API Config Endpoint**: `/api/v1/auth/captcha-config` serves config to frontend
- **Removed from Frontend**: Frontend `.env` no longer contains captcha keys
- **Test Mode**: Added `test={true}` prop support for SmartCaptcha widget (forces challenge; does NOT bypass domain validation)

## 📅 2025-12-31 (Latest)

### Cookie Consent & Lead Consent Implementation ✅

- **Cookie Consent Banner**: GDPR-compliant two-stage flow (accept/decline), non-modal banner, rejection dialog with self-hosting links, localStorage persistence, full i18n (EN/RU)
- **Lead Consent for Quiz AR.js**: 6 new columns in Lead entity for consent tracking, checkboxes in quiz form, validation before submission
- **Profile Consent Versioning**: Split `consent_version` into `terms_version` + `privacy_version` for independent document updates

### Profile Creation & Registration Fixes ✅

- Fixed TypeORM result parsing in registration (tuple format `[rows[], rowCount]`)
- Database trigger `create_user_profile` with `SECURITY DEFINER` for RLS bypass
- Consent fields extracted from `raw_user_meta_data` during signup
- Migration consolidation (merged duplicate trigger migrations)

### Legal Pages Implementation ✅

- Created `/terms` and `/privacy` routes with PDF document display
- Version display format: "Version X.X.X, last updated: DD.MM.YYYY"
- Registration form consent checkboxes linked to legal pages
- Public UI whitelist updated for unauthenticated access

---

## 📅 2025-12-28

### Auth & UX Fixes ✅

- **Auth Register 419 Auto-Retry**: Retry-once logic for stale CSRF token on registration
- **Start Page Spacing**: Fixed desktop padding for completion screen, auth button loading state
- **Onboarding Tracking**: `onboarding_completed` column in profiles, conditional rendering in AuthenticatedStartPage

---

## 📅 2025-12-26

### Onboarding Wizard & Start Page Enhancement ✅

- **Onboarding Wizard**: 5-step wizard (Welcome → Projects → Campaigns → Clusters → Completion), card selection UI, member sync on selection change
- **Start Page i18n**: Internationalized Hero, Testimonials, AppAppBar; added language switcher
- **Content Updates**: Personal intro from Vladimir Levadnij, alpha notice with repo links, testimonial translations
- **View Migration**: Moved start page views from template-mui to @universo/start-frontend

### Quiz Leads API & Analytics Fixes ✅

- Fixed Leads API 400 error (nullable canvasId, points field added to Zod schema)
- Fixed Analytics TypeError (normalized canvases response for array/object formats)
- Created @universo/types leads validation types
- Added comprehensive unit tests (19 test suites)

### Anonymous Quiz Access Fix ✅

- Added `/api/v1/publish/public/` and `/api/v1/publish/canvas/public/` to API whitelist
- Updated `createEnsureAuthWithRls` to bypass whitelisted public endpoints

---

## 📅 2025-12-25

### Auth Flow Improvements ✅

- **Login After Restart**: Auto-retry on 419 (CSRF expiration), single-click login restored
- **Logout Fix**: Removed forced redirect, React declarative re-rendering approach
- **CSRF Handling**: Clear stale token on 419, proper session regeneration handling
- **Backend**: HTTP 419 for EBADCSRFTOKEN, idempotent logout with cookie cleanup

### Landing Page & Auth Redirect Fixes ✅

- Fixed flash of protected content (AuthGuard wraps MainLayoutMUI)
- Fixed infinite redirect loop (added /auth to PUBLIC_UI_ROUTES)
- Landing page UI: RouterLink for buttons, commented out demo data

### API Client Architecture Refactoring ✅

- Created `@universo/utils/routes` with centralized public routes
- Added `redirectOn401` option to `createAuthClient()` ('auto'|true|false|string[])
- Eliminated ~500 lines duplicate code across 9 apiClient.ts files

---

## 📅 2025-12-23-24

### Auth/RLS Architecture Fixes ✅

- **Role Change Fix**: Removed `SET role = 'authenticated'` (lacks admin schema USAGE)
- **RLS Context Persistence**: Session-scoped JWT claims, proper cleanup on connection release
- **Critical Pattern**: RLS works from `request.jwt.claims` only, no role switching needed

### Metahubs Fixes ✅

- Fixed VLC rendering (Display types for UI, VLC extraction utilities)
- Fixed breadcrumb name hook for VLC/SimpleLocalizedInput
- Fixed pagination data access (`.items` extraction from PaginatedResponse)
- Added i18n namespace consolidation for hubs/attributes/records
- Created breadcrumb hooks (useHubName, useAttributeName)
- Added navigation tabs between Attributes and Records views

---

## 📅 2025-12-22

### Metahubs Metadata Platform Transformation ✅

**Phase 1-2 Backend Complete:**
- Renamed MetaSection → Hub, MetaEntity → Attribute
- Created Record.ts (HubRecord) for JSONB data storage
- New schema: hubs, attributes, records tables with GIN indexes
- ENUM: attribute_data_type (STRING, NUMBER, BOOLEAN, DATE, DATETIME, REF, JSON)
- RLS policies with admin bypass and public access

**Phase 3 Frontend Complete:**
- Types: SimpleLocalizedInput, Hub, Attribute, HubRecord with Display variants
- API clients: hubs.ts, attributes.ts, records.ts
- Pages: HubList (~515 lines), AttributeList (~455 lines), RecordList (~670 lines)
- Mutations: 9 hooks for CRUD operations
- i18n: EN/RU translations for new terminology

### Metahubs Access & Members Fixes ✅

- Fixed member cards showing "Нет email" (proper AuthUser entity query)
- Fixed sidebar showing wrong menu (added metahub route detection)
- UI aligned to Metaverses pattern (ViewHeader, card/list toggle, pagination)

---

## 📅 2025-12-15-21 (Consolidated)

### AgentFlow Features Complete ✅

**Node-based Detection**:
- Universal registry + node-based detection (no URL dependency)
- `getNodeRenderType(nodeData)` → `agentFlow | stickyNote | customNode`
- `normalizeNodeTypes(nodes, componentNodes)` → normalizes node.type on flow load
- Detection rules: StickyNote type → `stickyNote`, `category === 'Agent Flows'` → `agentFlow`, `name` ends with `Agentflow` → `agentFlow`

**Chat popup i18n**:
- @flowise/chatmessage-frontend i18n infrastructure
- `onOpenChange` callback prop for coordination with validation UI

**Agents backend/frontend**:
- Validation service (node connectivity, required params, credentials, hanging edges)
- ValidationPopUp component with issues list, icons, dark-mode styling
- API client: `createValidationApi`, `checkValidation(canvasId, unikId?)`

**Config UX Fixes**:
- Fixed input focus loss (removed value-based remount for `<Input>`)
- Fixed Start node showing extra fields by default (applied `showHideInputParams`)
- Fixed missing Messages array section (rehydrated on flow load)

### Agent Executions i18n ✅

- Integrated i18n on executions list/details pages (titles, filters, dialogs, empty states)
- Registered executions namespace via side-effect import in package entry

### Flowise 3.0.12 Components ✅

- Replaced `packages/flowise-components` with upstream Flowise 3.0.12 version
- Adapted build to upstream approach (`tsc` + `gulp`)
- AgentFlow icon rendering (Tabler icons when `node.color && !node.icon`)
- Upgraded @tabler/icons-react to v3.x for Flowise 3 compatibility
- Global error handler respects `err.statusCode` (no masking of 404 as 500)

### Dynamic Locales System ✅

- Admin UI for managing content locales (database-driven, not hardcoded `en/ru`)
- Public API endpoint for localized content (cached, no auth) for editors
- System locales (`en`, `ru`) protected from deletion
- Content locales separate from UI i18n namespaces

---

## 📅 2025-12-09-14 (Consolidated)

### UUID v7 Migration ✅

- Migrated from UUID v4 to UUID v7 for time-ordered IDs
- Added shared UUID utilities in `@universo/utils` (generate/validate/extract timestamp)
- Added Postgres `uuid_generate_v7()` function and updated migrations
- Updated backend code to stop using `crypto.randomUUID()` / `uuid.v4` directly

### Infrastructure Updates ✅

- **ESLint Upgrade**: @typescript-eslint/* v8.x for TypeScript 5.8.x compatibility
- **Global Roles Access**: Subject-wide permissions checked before membership (synthetic membership pattern)
- **CASL Terminology**: Refactored `module` → `subject` (CASL/Auth0/OWASP standard alignment)
- **RBAC Cleanup**: Removed redundant `canAccessAdmin` flag; admin access computed from permissions
- Updated frontend queries to be context-aware where subject scoping matters

---

## 📅 2025-12 Early: Metahubs MVP Complete ✅

### Metahubs Copy-Refactor Implementation

**Scope**: Implemented Metahubs by literal copy of Metaverses packages + systematic refactor.

**Backend Artifacts**:
- New packages: `@universo/metahubs-backend@0.1.0`, `@universo/metahubs-frontend@0.1.0`
- Migration: `1766351182000-CreateMetahubsSchema.ts`
- Tables: metahubs, meta_entities, meta_sections, metahubs_users, junction tables
- Terminology: Metaverse → Metahub, Entity → MetaEntity, Section → MetaSection

**Pattern Parity with Metaverses**:
- EntityFormDialog create/edit modal pattern
- BaseEntityMenu action dropdown
- ConfirmDeleteDialog reuse
- usePaginated list fetching
- TanStack Query queryKeys factory
- i18n namespace registration

**Navigation Integration**:
- Menu translations in @universo/i18n
- Metahubs root entry + helpers in menuConfigs.ts
- Metahub context detection in MenuContent.tsx
- Route tree in MainRoutesMUI.tsx

**Test Coverage**: 95/95 tests passing, 78.69% statements, 72.64% functions

---

## 📅 2025-11 (Summary)

### Admin Instances MVP & RBAC ✅
- Admin instances management system
- RBAC improvements with global roles access
- Subject-wide permissions architecture

### Organizations & Projects ✅
- Organizations module with membership management
- Projects management system with hierarchical structure
- AR.js Quiz Nodes for interactive content
- Member i18n refactor

### Campaigns & Storages ✅
- Campaigns module for marketing workflows
- Storages module for file management
- useMutation refactor across 7 packages
- QA fixes and polish

### Documentation & Analytics ✅
- REST API docs refactor (OpenAPI 3.1)
- Uniks metrics update with UnikBoard 7 metrics
- Clusters breadcrumbs navigation
- Dashboard analytics charts implementation

---

## 📅 2025-10 (Summary)

### TypeScript & i18n Migration ✅
- i18n TypeScript migration with type-safety improvements
- Date formatting migration to dayjs
- publish-frontend architecture refactoring

### Infrastructure ✅
- Rate limiting with Redis implementation
- RLS integration analysis and planning
- Global monorepo refactoring
- tsdown build system and dependencies centralization

### Publication System ✅
- Publication System 429 fixes
- API modernization
- Metaverses refactoring
- Quiz timer implementation
- Canvas versioning (Chatflow→Canvas terminology)
- PostHog telemetry integration

---

## 📅 2025-09 and earlier (Summary)

### Core Features ✅
- Space Builder MVP with multiple modes
- Metaverse module with @universo/types
- Cluster isolation architecture
- Multiplayer Colyseus server
- Canvas versioning and publication system
- Quiz features with manual editing
- Language switcher and MMOOMM template
- TypeScript path aliases and global publication library
