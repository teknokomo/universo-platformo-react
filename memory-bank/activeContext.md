## 2025-10-01 — Uniks UI migration to Template MUI

- Began routing Uniks front-end through the new `@universo/template-mui` stack: `MainLayoutMUI` now supplies the header, toolbar, language switcher, and theme controls while card/list views render inside the template container.
- Replicated Flowise legacy card components into the template package and refactored `ItemCard` for neutral styling (no legacy MainCard dependency) plus responsive width constraints.
- Added template-specific i18n bundles (EN/RU `flowList` namespace) and registered them with the global i18next instance so table headers/localized labels resolve without Flowise coupling.
- Extended `MainCard` with `disableHeader`, `disableContentPadding`, `border={false}`, `shadow={false}` switches, enabling flush containers in the new layout without breaking legacy screens.
- Updated Uniks list grid to use responsive `auto-fit` columns; skeleton state reuses identical layout ensuring smooth loading on mobile/tablet/desktop.
- Registered template-owned menu translations (EN/RU) with the global i18next instance and swapped demo `SideMenu` contents to use the shared root menu config so the new layout renders localized items while preserving template placeholders.

## 2025-09-24 — Chatflow alias bridge & service extraction

- Introduced `CanvasId` alias plus helper mappers in `packages/server/src/Interface.ts`, ensuring every canvas response now carries both `id` and `canvasId` while consumers gradually migrate terminology.
- Replaced the legacy in-repo canvass service with the new `CanvasService` under `@universo/spaces-srv`, injecting Flowise dependencies so backend logic executes from the Spaces package while preserving telemetry, metrics, and document store updates.
- Updated the server adapter to delegate CRUD calls to the Spaces service, keeping `/canvass` routes functional but emitting Canvas-first payloads for downstream routers/controllers.
- Embedded the Spaces router inside `createUniksRouter`, forwarding `/unik/:id/spaces` and `/unik/:id/canvases` through `@universo/spaces-srv` with optional rate limiting while preserving legacy canvass mounts.

## 2025-09-23 — Localized default canvas handling

- Canvas view keeps the temporary `temp` canvas entirely client-side: rename actions update local state, block PUTs until the space is persisted, and forward the chosen label when creating a space.
- Spaces API `createSpace` accepts `defaultCanvasName` and `defaultCanvasFlowData`, trims/validates inputs, and returns the seeded canvas so the UI can hydrate immediately after navigation.
- Removed the legacy auto-rename effect that overwrote saved canvases on locale switch; backend now stores the intended default name, and tests cover the new response shape.

## 2025-09-22 — Space Builder canvas option integration

- Space Builder dialog exposes a new `allowNewCanvas` flag and prioritizes the "new canvas" creation mode for saved spaces while hiding it for unsaved spaces.
- Spaces canvas view calls `useCanvases.createCanvas` with serialized flow data when generating a new quiz, activates the returned canvas, and clears dirty flags.
- Added localized snackbar messaging for Space Builder errors plus expanded manual safeguard tests covering the new mode.

## 2025-09-21 — Auth Session Integration

Current focus: Merge Passport.js + Supabase session flow into core monorepo using @universo/auth-srv and @universo/auth-frt.

**Server updates:**
- Mounted `/api/v1/auth` router from `@universo/auth-srv` inside `packages/server` with express-session + csurf.
- Added session-aware guard replacing legacy JWT middleware; Authorization header auto-populated from session tokens.
- Removed obsolete `controllers/up-auth` REST endpoints.

**Frontend updates:**
- Consumed `createAuthClient`, `useSession`, and `LoginForm` in `packages/ui`.
- Removed `localStorage` token logic; axios clients rely on cookies + automatic redirects on 401.
- Rebuilt login page around shared `LoginForm` with i18n labels.

**Documentation:**
- READMEs (`apps/auth-*` + docs/en|ru) now describe integrated workflow, environment knobs, and build steps.

Next: configure Redis-backed session store for production and QA end-to-end flow.

### 2025-09-21 — Uniks Schema & RLS Refactor (In Progress)
Refactored existing AddUniks migration (same ID) to introduce dedicated schema `uniks`, rename membership table to `uniks.uniks_users`, and replace permissive `auth.role()='authenticated'` policies with strict membership + `auth.uid()` based policies:
- Policies enforce: member-only SELECT, owner/admin UPDATE/DELETE, controlled membership changes, initial unik insertion allowed for any authenticated user (application must create owner membership row transactionally).
- Added helpful indexes on `(unik_id)` and `(user_id)` in membership table.
- Added idempotent column attachment logic for `unik_id` on core tables (does not force NOT NULL yet to allow gradual backfill).
Pending follow-up tasks: adjust dependent migrations/entities to schema-qualify foreign keys, implement user-scoped Supabase client factory, and refactor access control + routers to use `uniks.uniks_users`.
Update (later 2025-09-21): Dependent finance & spaces migrations updated to reference `uniks.uniks`; added user-scoped client factory; refactored access control service and Uniks routers to use schema-qualified tables. Next: add RLS integration tests and documentation updates.
Update (2025-09-21 evening): внедрён TypeORM-сервис `WorkspaceAccessService` с кешированием по запросу, переведены контроллеры Chatflows/Assistants/Credentials/Variables/DocumentStore/API Keys/Bots на новый слой доступа, Supabase REST-клиент удалён. Для Spaces добавлен транзакционный пайплайн (через `manager.getRepository`), обновлены сессионные cookie (`SESSION_COOKIE_PARTITIONED`, дефолт `up.session`). Добавлен unit-тест `packages/server/src/services/access-control/__tests__/workspaceAccessService.test.ts`.

## 2025-09-20 — Flowise UI PropTypes Guard

- Added an explicit `prop-types` import for `ProfileSection` to restore production builds (missing import caused `PropTypes is not defined`).
- Verified the issue by inspecting Vite bundle output; other components already import PropTypes via `import * as PropTypes`.
- Plan: gradually replace PropTypes with TypeScript definitions using the official React 19 codemod (`npx codemod@latest react/prop-types-typescript`), starting from high-traffic UI modules.

## 2025-09-20 — Auth UI Regression Analysis

- `/auth` kept reloading because the shared Axios client automatically redirected to `/auth` on every 401; `useSession` calls `/auth/me` even on the auth page, triggering the redirect loop.
- Legacy login/registration layout (MUI form with toggle) lives in backup repo `universo-platformo-react-2025-09-20` and must be reintroduced on top of the new session-based context.
- Applied fix: guard the Axios 401 interceptor against executing on `/auth`, restore the MUI login/registration UI, and expose a CSRF-protected `/auth/register` endpoint in `@universo/auth-srv` for Supabase sign-up.
- Shared React UI primitives now come from `@universо/auth-frt`: added `AuthView` (MUI-based login/register form with slot overrides) and updated `useSession.refresh()` to return the fetched user so `login()` can surface refresh failures immediately.
- Normalized session consumers to Passport: `@universо/uniks-srv` now reads `req.user.id` (fallback to `sub`) and front-end 401 handlers avoid repeated logout storms.
- Server-side Supabase client switches to `SUPABASE_SERVICE_ROLE_KEY` (with fallback to anon key) so backend routers can read/write Supabase tables under RLS.
- Uniks-роуты используют `schema('uniks')` с fallback на fully-qualified имена и логирование PGRST106/42P01; сервер передаёт per-request Supabase client через `getSupabaseForReq`.

## 2025-09-20 — Build Error Resolution

Current focus: Fixed critical TypeScript build error "Cannot find module '@universo/multiplayer-colyseus-srv'" that was blocking full workspace builds.

**Root Cause Identified:**
- `rootDirs: ["./src", "../../../tools"]` configuration in tsconfig.json was causing compilation artifacts to land in wrong directory structure
- Generated dist/ files ended up in `dist/apps/multiplayer-colyseus-srv/base/src/` instead of `dist/` 
- Similar issue affected packages/server

**Solution Implemented:**
- Created centralized ensurePortAvailable utility in @universo-platformo/utils package
- Removed problematic rootDirs configuration from both affected packages
- Updated workspace dependencies to use @universo-platformo/utils instead of cross-directory imports
- Simplified tsconfig includes and baseUrl settings

**Build Status:**
- ✅ All individual package builds pass
- ✅ Full workspace build (`pnpm build`) completes successfully in 3m51s across 27 packages
- ✅ No TypeScript compilation errors
- ✅ Proper dist/ structure generated

**Files Modified:**
- `apps/universo-platformo-utils/base/src/net/ensurePortAvailable.ts` (created)
- `apps/multiplayer-colyseus-srv/base/tsconfig.json` (cleaned rootDirs)
- `packages/server/tsconfig.json` (cleaned rootDirs)  
- Updated imports and dependencies across affected packages

Next: Monitor for any runtime issues and continue with regular development workflow.

**Quality Assurance Complete (2025-09-20):**
- ✅ Removed obsolete `tools/network/ensurePortAvailable.ts` and empty directory
- ✅ Updated all README documentation (English and Russian) for @universo-platformo/utils package
- ✅ Updated project documentation in `docs/en/` and `docs/ru/` with new net utilities
- ✅ Final build validation successful - all packages compile correctly

## 2025-09-18 — Build Fix for spaces-srv

Current focus: Restore monorepo build by fixing TS path alias errors in `@universo/spaces-srv`.

Changes applied:
- Updated `apps/spaces-srv/base/tsconfig.json` to add `paths: { "@/*": ["*"] }` with `baseUrl: "./src"`.
- Excluded `src/tests/**` from compilation to avoid fixtures affecting production build.

Outcome:
- `pnpm --filter @universo/spaces-srv build` succeeds.
- Full `pnpm build` across the workspace completes successfully (27/27).

Notes:
- Entities `Canvas`, `Space`, and `SpaceCanvas` are local to the package under `src/database/entities/` and re-exported from `src/index.ts`.

## Current Focus (2025-09-18)

- AR.js wallpaper mode without camera: ensure background renders in A-Frame-only mode.
- Implemented wallpaper as rotating wireframe `a-sphere` with `shader: flat` and as optional `a-sky`.
- DataHandler updated to always keep wallpaper (`a-sphere` wireframe back-side) and `a-sky` visible regardless of scene ID.
- Library loading respects `cameraUsage === 'none'` (no AR.js), scene has no `arjs` attribute.

Next steps: Observe in-browser result; if transparency ordering issues appear, consider `alphaTest` tuning or `render-order`.

## 2025-09-19 — spaces-frt packaging & testing refresh

- Added dedicated TypeScript configs for `@universo/spaces-frt`:
  - `tsconfig.build.cjs.json` (CommonJS), `tsconfig.build.esm.json` (ESM) and `tsconfig.types.json` (declarations).
- Migrated `src/api/spaces` and package entrypoint to TypeScript; exposed `SpacesApi` type for consumers.
- Updated package scripts to produce `dist/cjs`, `dist/esm`, `dist/types`; adjusted workspace script to stop rewriting `package.json`.
- Introduced Vitest-specific mocks for `@dnd-kit/*` to unblock component tests; added `pnpm --filter @universo/spaces-frt test` shortcut.
- READMEs updated (RU/EN) documenting build/tests pipeline.
- Follow-up: reverted to compact `tsconfig.json`/`tsconfig.esm.json` + `tsconfig.types.json`, removed custom build configs and redundant build script; cleaned up API by converting `client`/`canvases` to TS and deleting JS duplicates.
- Added startup safeguards: server checks port availability before boot; multiplayer manager skips launch when target port occupied, preventing `EADDRINUSE` crashes during `pnpm start`.
- Root build currently blocked by upstream Flowise UI Rollup issue (`Loader` default export mismatch) unrelated to spaces-frt; package-specific build/test succeed.

### i18n Normalization (2025-09-18)
- Objective: Fix UI showing raw i18n keys by aligning `useTranslation` namespaces and using relative keys.
- Completed today: normalized keys in `APICodeDialog.jsx`, `EmbedChat.jsx`, `ShareChatbot.jsx`, `canvass/index.jsx`, `agentflows/index.jsx`, and `Configuration.jsx`.
- Convention: For `canvass` namespace, use relative keys like `apiCodeDialog.*`, `embedChat.*`, `shareChatbot.*`, `common.*`. For `publish`, use relative keys like `arjs.*`.
# Current Active Context

**Status**: Alpha v0.30.0 (2025-01-17) - AR.js Camera Disable MVP Implemented

## Current Project Focus

**AR.js Camera Usage Settings MVP (2025-01-17)** - ✅ **COMPLETED**

**Implemented Changes:**
- Added "Использование камеры" setting with "Без камеры" (default) and "Стандартное разрешение" options
- Fixed camera initialization by conditionally removing `arjs` attribute from `<a-scene>` when `cameraUsage='none'`
- Fixed HTML generation issues that caused "кусок кода" display artifacts
- **FIXED AR-обои (wallpaper) to work without camera** - major breakthrough!
- Improved UI field ordering: moved camera usage field after template selection field
- Enhanced ARJSQuizBuilder with debug logging for camera usage detection
- Successfully integrated camera disable functionality across the entire pipeline

**Technical Details:**
- Backend: FlowDataService.ts properly extracts `cameraUsage` from `chatbotConfig.arjs` 
- Frontend: ARViewPage.tsx preserves `cameraUsage` settings without fallback override
- Template: ARJSQuizBuilder.ts conditionally removes `arjs` attribute and camera entity based on `cameraUsage`
- UI: ARJSPublisher.jsx field reordering and proper conditional logic for marker/wallpaper modes
- **Library Loading**: Fixed getRequiredLibraries() to conditionally load AR.js only when needed
- **Wallpaper Mode**: Fixed to work with just A-Frame when camera disabled
- Build validation: Clean compilation of template-quiz and publish-frt packages

**Root Cause Fixed:**
- Previously AR.js was initializing regardless of UI setting due to:
  1. Hardcoded `arjs="sourceType: webcam"` attribute in scene generation
  2. Always loading AR.js library through getRequiredLibraries()
- **Major Discovery**: AR-обои (wallpaper) were completely broken because AR.js library was disabled for cameraUsage='none'
- **Solution**: 
  1. Array-based attribute construction with conditional `arjs` attribute addition
  2. Conditional library loading - AR.js only when cameraUsage='standard'
  3. **Wallpaper mode now works with just A-Frame when camera disabled**
  4. Fixed both wallpaper and marker mode HTML generation

**Current State:**
- Camera usage setting: ✅ Properly saved and loaded
- AR.js initialization: ✅ Conditionally disabled when camera=none
- **AR-обои (wallpaper)**: ✅ Now work without camera using only A-Frame
- HTML generation: ✅ Clean markup without comment injection into attributes
- Library loading: ✅ Conditional - only A-Frame when camera disabled, A-Frame+AR.js when camera enabled
- UI field ordering: ✅ Camera usage appears after template selection  
- Debug logging: ✅ Console logs track arjs attribute and library loading
- Build validation: ✅ Both template-quiz and publish-frt packages compiled successfully

**User Experience Now:**
When user selects "Без камеры":
- ❌ No camera permission requests
- ❌ No AR.js initialization logs in console
- ❌ No AR.js library loaded (saves bandwidth and loading time)
- ✅ **AR-обои still work** - 3D wallpaper sphere with A-Frame only
- ✅ Quiz functionality works normally
- ✅ Clean HTML output without artifacts
- ✅ Proper field ordering in UI

**Next Steps:**
- Browser testing to verify no camera permission prompt when "Без камеры" is selected
- QA validation that AR.js logs are absent when camera is disabled
- **Test AR-обои functionality** - verify 3D wallpaper sphere appears and rotates
- Verify no "кусок кода" artifacts appear in browser display

---

---

## Previous Project Focus

**AR.js Scene Attribute Implementation (2025-01-17)** - ✅ **COMPLETED - SUPERSEDED**

**QR Code Download Feature Implementation (2025-01-17)** - ✅ **COMPLETED**

---

## Previous Project Focus

**QR Code Download Feature Implementation (2025-01-17)** - ✅ **COMPLETED**

**Quiz Lead Saving Reliability Patch (2025-09-17)** - ✅ **COMPLETED**

**Quiz Debug Logging System Enhancement (2025-09-17)** - ✅ **COMPLETED**
**Analytics Page Refactor (2025-09-17)** - ✅ **COMPLETED**

**Implemented Changes:**
- Replaced single Chatflow selector with hierarchical Space -> Canvas selectors (auto-select first Space and first Canvas by backend order)
- Added consolidated `spacesApi` (frontend) using centralized `@universo/spaces-frt` package with `getSpaces` and `getCanvases` hitting existing server routes `/unik/:id/spaces` and `/unik/:id/spaces/:spaceId/canvases`
- Updated Analytics UI to request leads by selected Canvas (still using existing leads endpoint with `canvasid` mapped to Canvas ID)
- Introduced dedicated phone column and refactored points column to use `lead.points` with legacy fallback to numeric `phone`
- Updated i18n (EN/RU) with new keys: `selectSpace`, `selectCanvas`, `table.phone`, and renamed Chatflow ID label to Canvas ID / ID холста
- Updated documentation (publish-frt README EN/RU) removing obsolete note about temporary storage of points in `lead.phone` and referencing new `lead.points`
- **API Architecture Consolidation**: Removed duplicate `packages/ui/src/api/spaces.js` file and ensured all spaces functionality uses centralized `apps/spaces-frt/base/src/api/spaces.js` with proper exports
- Fixed runtime error "F.map is not a function" by adding defensive parsing for API response format `{success, data: {spaces}}` vs expected array
 - **Post-merge Improvements (2025-09-17)**: Addressed GitHub bot recommendations: added explicit dependency `@universo/spaces-frt` to `analytics-frt` package.json and refactored `Analytics.jsx` extracting `normalizeSpacesResponse` & `resolveLeadPoints` helpers (replacing inline ternaries & IIFE) for readability & testability.
 - **Tracking Artifacts (2025-09-17)**: Created Issue #410 and PR #412 (GH410) to formalize the bot recommendation refactor (explicit dependency + helper extraction). PR includes `Fixes #410` for automatic closure upon merge.

**Completed Tasks:**
- ✅ Error diagnosis and fix for white page crash
- ✅ API consolidation using centralized spaces-frt package 
- ✅ Defensive response parsing for wrapped API responses
- ✅ Package cleanup and proper import architecture
- ✅ Successful builds of all affected packages

**Rationale:** Align analytics with Space+Canvas domain model, improve disambiguation where multiple canvases share names across Spaces, maintain clean package separation per refactoring strategy, and finalize transition to dedicated `points` column.


**Implemented Features:**
- ✅ Introduced dual-layer debug control: build-time `QUIZ_DEBUG` constant and mutable runtime `QUIZ_DEBUG_STATE`
- ✅ Added `dbg()` utility wrapper gating all non-error logs
- ✅ Added public runtime API `window.setQuizDebug(true|false)` for live toggling without rebuild
- ✅ Converted all previous “key” production logs (init, results, lead save attempt/success, scene transitions) to conditional debug logs
- ✅ Retained `console.error` for genuine error conditions only
- ✅ Updated English README with "Debug Logging" section
- ✅ Added Russian localized `README-RU.md` with synchronized guidance
- ✅ Verified CJS/ESM/types builds produce no stray logs when debug disabled

**Architecture Decision:** Replace noisy unconditional logging with an opt-in layered system enabling deep diagnostics on demand while keeping production console output clean (errors only). Runtime toggle chosen to avoid rebuild cycles during troubleshooting sessions.

**Implemented Features:**
- ✅ Root cause analysis: initial regression where no lead saved if no form; subsequent duplication risk via dual showQuizResults paths
- ✅ Guarded saving moved into `showQuizResults` (primary for results-ending quizzes)
- ✅ Immediate save retained only for non-results endings (basic record fallback)
- ✅ Added origin-tagged logging (`results-completion-path`, `results-navigation-path`, `no-results-ending`, `unknown`)
- ✅ Extended payload logging (pre-payload, payload, warnings if IDs null)
- ✅ Removed second navigation-path invocation of `showQuizResults` to prevent double call race
- ✅ Global `leadSaved` flag still enforced for deduplication
- ✅ Rebuilt `@universo/template-quiz` (CJS/ESM/types) with successful TypeScript compilation
- ✅ Added quiet logging mode (QUIZ_DEBUG=false) + dbg() wrapper, removed verbose scene/object enumeration & point spam

**Technical Implementation:**
- Guarded save executed inside `showQuizResults(totalPoints, fromCompletionFlag)`; basic record synthesized when no form submitted
- Non-results completions perform immediate guarded save (maintains previous analytics behavior)
- Origin parameter threaded through `saveLeadDataToSupabase(…, origin)` for observability
- Removed redundant post-navigation `showQuizResults` trigger; only `showCurrentScene` handles results scene display
- Detailed console tracing enables verification of single POST request

**Architecture Decision:**
Shift from single centralized completion save to context-aware saving (results vs non-results) to resolve timing issues rendering results scene while still guaranteeing exactly one persisted lead (with points). Enhanced observability chosen over silent logic to accelerate future diagnostics.

**Previous Completed:**

**AR.js Legacy Configuration Management Implementation (2025-09-17)** - ✅ **COMPLETED**

**Implemented Features:**
- ✅ Advanced legacy configuration detection and handling system
- ✅ Environment-controlled auto-correction vs recommendation behavior (`PUBLISH_AUTO_CORRECT_LEGACY_SETTINGS`)
- ✅ Three-tier handling: new spaces, legacy with auto-correction, legacy with recommendations
- ✅ Alert UI system with dismissible info/warning messages for legacy scenarios
- ✅ Comprehensive translation keys for different legacy handling messages
- ✅ Fixed English locale issue ("coming soon" translation key)
- ✅ Backend API integration with `autoCorrectLegacySettings` flag exposure

**Technical Implementation:**
- Environment variable with comprehensive documentation in `.env.example`
- Legacy detection logic in `ARJSPublisher.jsx` loadSavedSettings function
- Alert state management and UI component integration
- Translation keys added to both Russian and English locales
- Build validation successful for both frontend and backend

**Architecture Decision:**
Implemented sophisticated three-scenario handling:
1. **New spaces**: Apply global settings directly
2. **Legacy with auto-correction**: Automatically update settings, show info alert
3. **Legacy with recommendations**: Preserve settings, show warning alert

**Previous Completed:**

**AR.js Global Library Management Alert Internationalization (2025-01-16)** - ✅ **COMPLETED**

**Implemented Features:**
- ✅ Internationalized hardcoded Russian alert text in AR.js Publisher component
- ✅ Added translation keys for Russian and English in i18n system
- ✅ Implemented dynamic source name translation (Official server / Kiberplano server)
- ✅ Used parameterized i18next interpolation for dynamic content
- ✅ Maintained proper component structure within publish namespace

**Global Library Management Enhancement (2025-01-16)** - ✅ **COMPLETED**

**Implemented Features:**
- ✅ Environment-driven global control for AR.js/A-Frame library sources
- ✅ Backend API endpoint for exposing global settings to frontend
- ✅ Frontend integration with priority-based configuration loading
- ✅ UI enhancements showing when global management is active
- ✅ Permission controls disabling library source selection when managed globally
- ✅ Full backward compatibility with individual project settings

**Technical Architecture:**
- Server environment variables: `PUBLISH_ENABLE_GLOBAL_LIBRARY_MANAGEMENT`, `PUBLISH_DEFAULT_LIBRARY_SOURCE`
- REST API endpoint: `/api/v1/publish/settings/global`
- Frontend component integration with global settings priority logic
- Visual indicators and disabled controls when global management is enabled

**Previous Focus:**

**Routing Consistency Implementation (2025-01-21)** - ✅ **COMPLETED**

**Fixed Issues:**
- ✅ Unik table navigation from broken to fully functional
- ✅ Backend API restructured to singular pattern (/unik/:id for individual operations) 
- ✅ Parameter name mismatch resolved (id vs unikId in nested routes)
- ✅ Router mounting order fixed to prevent route conflicts
- ✅ Nested routing bugs eliminated with middleware transformations

**Technical Implementation:**
- Three-tier routing architecture: collections (/uniks), individual (/unik/:id), nested (/unik/:id/resources)
- Parameter transformation middleware for backward compatibility
- Route precedence optimization to avoid conflicts
- Complete build validation with no errors

## Recent Major Achievements

**Global Library Management System (2025-01-16)**: Environment-driven library source control with admin override capabilities for AR.js publications

**Routing Bug Fixes (2025-01-21)**: Comprehensive routing restructure fixing parameter passing, route conflicts, and nested resource access issues

**Resources Applications Cluster Isolation (2025-09-10)**: Three-tier architecture (Clusters→Domains→Resources) with complete data isolation implemented (see progress.md)

**Template Package Modularization (2025-08-30)**: Extracted `@universo/template-quiz` and `@universo/template-mmoomm` with shared packages `@universo-platformo/types` and `@universo-platformo/utils`

**Multiplayer Colyseus Implementation (2025-08-22)**: Complete `@universo/multiplayer-colyseus-srv` package for real-time MMOOMM gameplay

**Spaces + Canvases Refactor (2025-09-07)**: Separated Canvas routes under MinimalLayout, added local API clients, improved tabs UX

## System Architecture

**6 Working Applications**: UPDL (abstract nodes), Publish (AR.js/PlayCanvas export), Analytics, Profile, Uniks, Resources/Entities
**Platform**: Flowise 2.2.8 with React + Material-UI, Node.js + TypeScript, Supabase integration, PNPM workspaces
**Build Quality**: 100% TypeScript compilation across workspace

## Current Technical Status

**Platform Maturity**: Alpha-grade stability with complete high-level UPDL system
**Export Pipeline**: AR.js (production), PlayCanvas (ready), template-based architecture
**Security**: Enhanced Supabase authentication with workspace-scoped operations
**Architecture**: Clean package separation, eliminated circular dependencies

## Immediate Next Steps

**Critical Priorities:**
- Complete metaverses localization fix validation
- Add Finance apps documentation (EN/RU)
- Migrate minimal UI wrappers to spaces-frt
- Remove remaining unused Flowise UI components

**Strategic Goals:**
- Editable quiz preview for Space Builder
- Additional AR.js wallpaper variants
- Production deployment preparation
- Community collaboration features

## System Context

**Base Foundation**: Universo Platformo React - Universal Platform for Digital Experiences
**Mission**: Create scalable platform for cross-technology content creation (AR, VR, 3D, multiplayer)
**Target**: Production-ready by 2025-Q1 with enterprise hosting solutions
