# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

_No active tasks._

---

## ✅ RECENTLY COMPLETED

### 2026-01-06: Internationalize project metadata and update texts ✅

- [x] Added locale metadata files: `packages/universo-i18n/base/src/locales/en/core/meta.json`, `packages/universo-i18n/base/src/locales/ru/core/meta.json`
- [x] Updated translations for landing and onboarding (`start-frontend` en/ru)
- [x] Updated frontend entrypoints to consume metadata (`packages/flowise-core-frontend/base/index.html`, `packages/flowise-core-frontend/base/src/App.jsx`)
- [x] Updated documentation and package metadata: `README.md`, `README-RU.md`, `package.json`
- [x] Created issue #630 and pull request #631
- [x] Applied bot review recommendations: added `packages/universo-i18n/base/src/supported-languages.json` and `packages/flowise-core-frontend/base/scripts/sync-supported-langs.mjs`; pushed to PR #631.
- **Validation**: Verify EN/RU strings on landing and onboarding, run `pnpm --filter <package> lint`, then `pnpm build` at repo root

### 2026-01-05: Improve Login Error Messages UX ✅

- [x] Update `errorMapping.ts` — add mapping `Invalid credentials` → `loginFailed`
- [x] Add `loginFailed` i18n key to EN locale
- [x] Add `loginFailed` i18n key to RU locale
- [x] Update `serverError` messages in both locales (more informative)
- [x] Lint check `auth-frontend` and `@universo/i18n` (0 errors)
- [x] Full workspace build passed (61 tasks, 4m36s)
- **Result**: "Ошибка сервера" → "Не удалось войти в систему. Проверьте email и пароль или зарегистрируйтесь, если у вас ещё нет аккаунта."
- **Security**: Message doesn't reveal if email exists (OWASP best practice)
- **Pattern**: `mapSupabaseError()` now matches both Supabase and backend error messages

### 2026-01-04: PR #627 Bot Review Fixes ✅

- [x] Fixed DRY violation: extracted mode switcher outside conditional block in AuthView.tsx
- [x] Combined two useEffect hooks into one with Promise.allSettled in AuthPage.tsx
- [x] Fixed systemPatterns.md: documentation now correctly reflects flat config structure (not nested)
- **Changes**: Auth frontend code quality improvements per Gemini/Copilot review comments

### 2025-01-10: Auth Disabled State UX Refinements ✅

- [x] Hide entire form when auth feature disabled (registration/login), show only alert message
- [x] Keep mode switcher links visible when feature disabled ("Нет аккаунта?" / "Уже есть аккаунт?")
- [x] Updated i18n messages with admin contact email: `universo.pro@yandex.ru` (RU), `universo.pro@yandex.com` (EN)
- [x] Fixed LegalPage footer sticky positioning: `minHeight: 100vh` + `flexGrow: 1`
- [x] Simplified button disabled logic (removed auth feature checks since form hidden when disabled)
- [x] Full workspace build passed (61 tasks, 4m52s)
- **Pattern**: Conditional rendering for cleaner disabled state - when feature off, render only Alert + mode switcher, skip form fields entirely

### 2026-01-03: Auth Feature Toggles & Legal Pages Footer ✅

- [x] **Phase 1**: Added StartFooter to LegalPage.tsx (Terms/Privacy pages)
- [x] **Phase 2**: Added AUTH_* env variables to .env and .env.example (AUTH_REGISTRATION_ENABLED, AUTH_LOGIN_ENABLED, AUTH_EMAIL_CONFIRMATION_REQUIRED)
- [x] **Phase 3**: Created @universo/utils/auth module with getAuthFeatureConfig(), isRegistrationEnabled(), isLoginEnabled(), isEmailConfirmationRequired()
- [x] **Phase 4**: Added `/auth-config` endpoint to auth-backend (separate from captcha-config)
- [x] **Phase 5**: Updated auth-frontend types (AuthFeatureConfig interface), AuthView with disabled state UI, AuthPage with useEffect to fetch auth-config
- [x] **Phase 6**: Added i18n keys (registrationDisabled, loginDisabled, successRegisterNoEmail) to en/ru locales
- [x] **Phase 7**: Updated Auth.jsx wrapper with new labels
- [x] **Phase 8**: Added auth submodule export to tsdown.config.ts and package.json exports
- [x] Full workspace build passed (61 tasks, 4m58s)
- **Pattern**: Separate endpoint for auth feature config (like captcha-config pattern), env-driven toggles with defaults to true for backwards compatibility

### 2026-01-03: i18n Migration to registerNamespace() Pattern ✅

- [x] Added `landing` namespace registration to `i18n/index.ts` via `registerNamespace()`
- [x] Refactored `Testimonials.tsx` - removed legacy `useEffect` + `registerLandingI18n`, switched to `@universo/i18n`
- [x] Refactored `Hero.tsx` - removed legacy pattern, switched to `@universo/i18n`
- [x] Refactored `StartFooter.tsx` - removed legacy pattern, switched to `@universo/i18n`
- [x] Refactored `AuthenticatedStartPage.tsx` - removed redundant `registerOnboardingI18n` call
- [x] Marked legacy functions in `register.ts` as `@deprecated` with migration guidance
- [x] Marked legacy exports in `index.ts` as `@deprecated`
- [x] Lint passed: start-frontend (0 errors after --fix)
- [x] Full workspace build passed (61 tasks, 6m8s)

### 2026-01-03: Start Section Footer & Onboarding Text Updates ✅

- [x] Created StartFooter component with contact info (owner, email) and legal links
- [x] Added footer i18n keys to landing.json (ru/en)
- [x] Exported StartFooter from components/index.ts
- [x] Integrated StartFooter in GuestStartPage
- [x] Integrated StartFooter in AuthenticatedStartPage
- [x] Added description4 to WelcomeStep (Universo MMOOMM metaverse text)
- [x] Updated projects subtitle in onboarding.json (ru/en)
- [x] Updated campaigns title and subtitle in onboarding.json (ru/en)
- [x] Updated clusters subtitle in onboarding.json (ru/en)
- [x] Adjusted guest footer hover color to a lighter blue for contrast (kept internal hover blue)
- [x] Fixed onboarding subtitle paragraph rendering (split by blank line into two Typography blocks)
- [x] Reduced guest footer top spacing to zero (bring closer to module cards)
- [x] Restored guest cards↔footer spacing to 4 modules after rollback (Testimonials `pb`)
- [x] Made AppAppBar brand (logo + name) clickable with link to home route
- [x] Verified start-frontend lint and build
- [x] Lint passed: start-frontend (0 errors after --fix)
- [x] Full workspace build passed (61 tasks, 8m20s)

### 2026-01-02: SmartCaptcha Login Form Support ✅

- [x] Added `SMARTCAPTCHA_LOGIN_ENABLED` env variable to .env and .env.example
- [x] Created `createLoginCaptchaService()` factory in @universo/utils/captcha shared module
- [x] Updated auth-backend captchaService with login captcha exports (getLoginCaptchaConfig, isLoginCaptchaRequired, validateLoginCaptcha)
- [x] Updated `/captcha-config` endpoint to return both registration and login configs (with legacy format for backwards compatibility)
- [x] Added captcha validation to `/login` route (LoginSchema now accepts optional captchaToken)
- [x] Updated auth-frontend types: SingleCaptchaConfig, CaptchaConfig with registration/login fields
- [x] Updated AuthView.tsx: mode-specific captcha config, shows captcha widget on both login/register, button disabled until captcha completed
- [x] Updated AuthProvider: login signature now accepts optional captchaToken
- [x] Updated AuthPage.tsx: handleLogin forwards captchaToken to login
- [x] Lint passed: auth-frontend (0 errors), auth-backend (0 errors), @universo/utils (0 errors)
- [x] Full workspace build passed (61 tasks, 5m46s)
- **Pattern**: Factory pattern with separate env vars for granular control (SMARTCAPTCHA_REGISTRATION_ENABLED, SMARTCAPTCHA_LOGIN_ENABLED)
- **UX**: Login button disabled until captcha completed when enabled

---

## 📋 PLANNED TASKS

### Session Persistence on Server Restart

**Status**: Deferred until production deployment pattern is clear.
**Note**: Currently using MemoryStore (sessions lost on restart). Auto-retry on 419 makes this non-blocking for MVP.

### Future Auth Improvements

- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
- [ ] Review auth architecture for scalability

### Admin Module Enhancements

- [ ] Role cloning, templates, permission inheritance
- [ ] Audit log for role/permission changes
- [ ] Multi-instance support (remote instances)

### Frontend UX

- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness improvements
- [ ] Tour/onboarding for new users

### Performance & Documentation

- [ ] Server-side caching, CDN integration
- [ ] Bundle size optimization
- [ ] Complete API documentation (OpenAPI)
- [ ] Architecture decision records (ADR)

---

## ✅ COMPLETED TASKS (Last 2 months)

### 2026-01-02: Captcha QA Fixes — Code Quality & Shared Module ✅

- [x] Fixed P0 React Hooks order violation in AuthPage.tsx (moved useCallback before early return)
- [x] Fixed P1 Prettier errors in auth-frontend (ran prettier --fix, reformatted function signatures)
- [x] Fixed P1 `err: any` typing → `err: unknown` with proper type casting in AuthPage.tsx and AuthView.tsx
- [x] Created @universo/utils/captcha shared module (extracted from auth-backend and leads-backend)
- [x] Implemented factory pattern: `createRegistrationCaptchaService()`, `createPublicationCaptchaService()`
- [x] Replaced native https.request with axios (cleaner error handling, timeout support, catalog dependency)
- [x] Updated leads-backend tsconfig.json: moduleResolution node → node16 (for subpath exports)
- [x] auth-frontend lint: 0 errors (down from 9), 11 warnings
- [x] Full workspace build passed (61 tasks successful)
- **Deduplication**: ~250 lines of duplicate captcha code → 35 lines per service (re-export pattern)
- **Consistency**: Both captcha services now share identical validation logic

### 2026-01-02: SmartCaptcha Fail-Closed Security Hardening ✅

- [x] Implemented fail-closed behavior for auth-backend captchaService.ts
- [x] Implemented fail-closed behavior for flowise-leads-backend captchaService.ts
- [x] All error cases now return `{ success: false, error: '...' }` instead of allowing bypass
- [x] Error messages: "Captcha service is not configured", "Captcha service unavailable", "Captcha service error", "Captcha service timeout"
- [x] Ran lint --fix on auth-backend (0 errors, 40 warnings)
- [x] Ran lint --fix on flowise-leads-backend (0 errors, 5 warnings)
- [x] Full workspace build passed (61 tasks successful)
- **Security**: When Yandex SmartCaptcha API is unavailable, registration and lead forms are blocked
- **Rationale**: "единственная возможность пройти дальше это пройти эту капчу"

### 2026-01-01: Server-side Captcha Validation for Leads ✅

- [x] Added `captchaToken?: string` to CreateLeadPayload type (universo-types)
- [x] Created captchaService.ts in flowise-leads-backend (mirrors auth-backend pattern)
- [x] Added `isPublicationCaptchaRequired()` and `validatePublicationCaptcha(token, ip)` functions
- [x] Updated leadsService.ts with captcha validation before lead creation
- [x] Updated leadsRoutes.ts to pass clientIp from request
- [x] Exported captcha functions from leads-backend index
- **Security**: Server key (ysc2_...) used only in backend; fail-open on API errors (5s timeout)
- **Trigger**: `SMARTCAPTCHA_PUBLICATION_ENABLED=true` env variable

### 2026-01-01: SmartCaptcha Domain Fix in /p/:slug ✅

- [x] Created quizRenderService.ts for server-side quiz HTML generation
- [x] Added GET /api/v1/publish/render/:slug endpoint to serve quiz HTML from server
- [x] Updated ARViewPage to use server endpoint (iframe.src) instead of blob: URL
- [x] Added /api/v1/publish/render/ to API_WHITELIST_URLS
- [x] Fixed timerConfig.position type narrowing (TimerPosition literal type)
- **Root cause**: blob: URL creates opaque origin that SmartCaptcha cannot validate
- **Solution**: Server-side rendering ensures iframe content comes from actual domain

### 2026-01-01: SmartCaptcha for Quiz Lead Forms ✅

- [x] Added `captchaEnabled` and `captchaSiteKey` to IUPDLSpace.leadCollection type
- [x] Added captcha inputs to SpaceNode (UPDL node config)
- [x] Updated DataHandler to generate SmartCaptcha HTML in lead form
- [x] Added captcha.js script loader with success/expired callbacks
- [x] Updated button state logic to require captcha token (both multi-scene and node-based)
- [x] Added captcha validation in form submission
- [x] Updated consent checkbox text to match registration form style ("Я ознакомился и принимаю")
- [x] Updated .env/.env.example documentation about test mode behavior
- [x] Added SMARTCAPTCHA_PUBLICATION_ENABLED env variable for separate control
- [x] Created captchaService.ts in publish-backend for publication captcha config
- [x] Added /captcha/config API endpoint in publish-backend routes
- [x] Whitelisted /api/v1/publish/captcha/config in API_WHITELIST_URLS (fix 401 for public /p/:slug)
- [x] Fixed published /p/:slug missing captcha by injecting publicationCaptchaConfig into template build
- [x] Fixed SmartCaptcha domain error in /p/:slug by rendering iframe content via blob URL (avoid about:srcdoc)

### 2026-01-01: Yandex Smart Captcha ✅

- [x] Backend: Captcha validation service (fail-open)
- [x] Backend: Register route update (token verification)
- [x] Frontend: AuthView update (SmartCaptcha widget, state logic)
- [x] Frontend: AuthPage update (pass token to API)
- [x] i18n: Updated consent labels and added captcha error messages
- Details: progress.md#2026-01-01

### 2025-12-31: Cookie Consent & Lead Consent ✅

- [x] Cookie consent banner (useCookieConsent, CookieConsentBanner, CookieRejectionDialog)
- [x] Lead consent for AR.js Quiz (migration, entity, DataHandler)
- [x] Split consent_version into terms_version + privacy_version
- [x] Bot review fixes for PR #621 (SSR, localStorage, alpha(), aria role)
- Details: progress.md#2025-12-31

### 2025-12-30: Profile & Legal Pages ✅

- [x] Profile creation debug - TypeORM result parsing fix
- [x] Migration consolidation (UpdateProfileTrigger + FixProfileInsertRLS)
- [x] Legal pages (/terms, /privacy) with consent checkboxes
- [x] Database trigger for consent via raw_user_meta_data
- Details: progress.md#2025-12-30

### 2025-12-28: Onboarding & Auth Fixes ✅

- [x] Onboarding completion tracking (onboarding_completed flag)
- [x] Bot review fixes for PR #614
- [x] Auth register 419 auto-retry
- [x] Start page UI bugfixes (spacing, button flicker)
- Details: progress.md#2025-12-28

### 2025-12-26: Quiz Leads, Auth UX, Start Page i18n ✅

- [x] Quiz leads API fix (optional canvasId, points validation)
- [x] Analytics TypeError fix (normalizeCanvasesResponse)
- [x] Anonymous quiz access fix (public endpoints whitelist)
- [x] Login after restart fix (419 auto-retry)
- [x] Logout redirect fix (React re-render instead of redirect)
- [x] Start page i18n (Testimonials, AppAppBar buttons)
- [x] Onboarding content & notices enhancement
- Details: progress.md#2025-12-26

### 2025-12-25: Start Page MVP & API Client Refactor ✅

- [x] Start page auth-conditional rendering (Guest/Authenticated)
- [x] StartLayoutMUI, GuestStartPage, AuthenticatedStartPage
- [x] Guest redirect fix (public routes allowlist)
- [x] API client architecture refactoring (~500 lines duplicate code eliminated)
- [x] Public routes centralized in @universo/utils/routes
- [x] Auth redirect & landing page fixes
- Details: progress.md#2025-12-25

### 2025-12-23: RLS & Metahubs Fixes ✅

- [x] RLS context persistence (session-scoped settings)
- [x] Role change breaking admin schema fix (removed SET role)
- [x] Metahubs pagination data access fix
- [x] Metahubs i18n, breadcrumbs, navigation improvements
- Details: progress.md#2025-12-23

### 2025-12-22: Metahubs Transformation ✅

- [x] Phase 1-2: Backend entities (Hub, Attribute, HubRecord)
- [x] Phase 3: Frontend (HubList, AttributeList, RecordList)
- [x] VLC type handling (Display types, converters)
- [x] Metahubs MVP copy-refactor from Metaverses
- Details: progress.md#2025-12-22

### 2025-12-18: AgentFlow QA Hardening ✅

- [x] Scope + membership enforcement for validation/executions routes
- [x] Public execution share contract alignment
- [x] Lint/Prettier fixes in agents/executions packages
- [x] Template-MUI lint failures triage
- Details: progress.md#2025-12-18

### 2025-12-17: AgentFlow Config UX ✅

- [x] Input focus loss fix (removed value-based remount)
- [x] Start node conditional fields rendering
- [x] Messages array section for saved canvases
- Details: progress.md#2025-12-17

### 2025-12-15-16: AgentFlow Integration ✅

- [x] Universal canvas: node-based AgentFlow detection
- [x] Chat popup i18n (flowise-chatmessage-frontend)
- [x] Agents backend package (validation service/router)
- [x] Agents frontend package (ValidationPopUp)
- [x] AgentFlow node/edge rendering
- Details: progress.md#2025-12-15

### 2025-12-14: Flowise 3.0.12 Components ✅

- [x] Components replacement with upstream version
- [x] AgentFlow icon rendering (Tabler icons)
- [x] Backend error handler improvement
- Details: progress.md#2025-12-14

---

## 🧪 TECHNICAL DEBT

- [ ] Refactor remaining useApi → useMutation
- [ ] Standardize error handling across packages
- [ ] Add unit/E2E tests for critical flows
- [ ] Resolve Template MUI CommonJS/ESM conflict
- [ ] Database connection pooling optimization

---

## 🔒 SECURITY TASKS

- [ ] Rate limiting for all API endpoints
- [ ] CSRF protection review
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system

---

## 📚 HISTORICAL TASKS

For tasks completed before 2025-11, see progress.md.

Main achievements:
- v0.40.0: Tools/Credentials/Variables/ApiKey/Assistants/Leads/ChatMessage/DocStore/CustomTemplates extraction, Admin Instances MVP, RBAC Global Roles
- v0.39.0: Campaigns, Storages modules, useMutation refactor
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics
- v0.36.0: dayjs migration, publish-frontend architecture
- v0.35.0: i18n TypeScript migration, Rate limiting, RLS analysis
- v0.34.0: Global monorepo refactoring, tsdown build system
