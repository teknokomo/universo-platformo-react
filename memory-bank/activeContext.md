# Active Context

> **Last Updated**: 2026-01-07
>
> **Purpose**: Current development focus only. Completed work → progress.md, planned work → tasks.md.

---

## Current Focus: Localized Field UI Rollout - 2026-01-07 ✅

Implemented compact localized field UI (inline language button + menu, primary badge) and wired it into
metahubs create/edit flows, admin role/locale forms, and shared utilities. Added backend support for
optional primary locale overrides and dynamic locale keys without deleting data. Added common i18n keys
and updated tests. Metahubs-frontend tests run; all tests pass but coverage thresholds still fail
(same suite now reports coverage below 70%).

Applied UI refinements: language button moved into the top-right corner of the field without shrinking
text width, and multiline input padding aligned with single-line spacing across both `@universo/template-mui`
and legacy `flowise-template-mui` themes.

Removed temporary diagnostic logs and restored the default backend log level after resolving the admin roles reload incident.

---

## Previous Focus: Auth Disabled State UX Refinements - 2025-01-10 ✅

Refined UX when auth features are disabled based on QA feedback.

### Key Deliverables

- **Cleaner disabled state**: When registration/login is disabled, the entire form is now hidden (not just button disabled)
- **Alert message**: Shows only the disabled notification with admin contact email
- **Mode switcher preserved**: Links to switch between login/register remain visible when feature disabled
- **i18n updates**: Updated disabled messages with admin contact emails:
  - RU: `universo.pro@yandex.ru`
  - EN: `universo.pro@yandex.com`
- **Legal pages footer**: Fixed sticky positioning with `minHeight: 100vh` and `flexGrow: 1`

### Build Status

- ✅ Full workspace build passed (61 tasks, 4m52s)

---

## Previous: Auth Feature Flags & Auth UI Layout - 2026-01-04 ✅

- **Guest Start Page Footer**: Adjusted link hover color for better readability on the hero image (lighter blue on hover; internal pages keep the default blue).
- **Onboarding Subtitles**: Ensured the "Notice" text renders as a true second paragraph by splitting subtitle strings on blank lines ("\n\n") and rendering paragraphs as separate Typography blocks.
- **Footer Spacing**: Restored guest cards↔footer vertical spacing to 4 modules (after rollback) by adjusting the testimonials section bottom padding.
- **Brand Link**: Made AppAppBar brand (logo + "Universo" text) clickable with RouterLink to home route.
- **Validation**: start-frontend lint + build verified after changes.

---

## Previous Focus: SmartCaptcha UX & Cookie Text Improvements - 2026-01-02 ✅

Added optional Yandex SmartCaptcha support for the login form, mirroring the existing registration captcha implementation.

- **Environment Variable**: `SMARTCAPTCHA_LOGIN_ENABLED` (default: false) controls login captcha
- **Factory Pattern**: New `createLoginCaptchaService()` in shared `@universo/utils/captcha`
- **UX**: Login button disabled until captcha completed when enabled, widget resets on mode switch

---

## Previous Focus: Captcha QA Fixes - 2026-01-02 ✅

---

## Reference: Publication Captcha Configuration

- Registration SmartCaptcha integrated end-to-end (auth-backend token validation + auth-frontend widget).
- Publication SmartCaptcha now appears in published `/p/:slug` AR.js quiz lead forms when enabled via ENV.
- Global toggles live in backend `.env`:
  - `SMARTCAPTCHA_REGISTRATION_ENABLED=true/false`
  - `SMARTCAPTCHA_PUBLICATION_ENABLED=true/false`
  - `SMARTCAPTCHA_SITE_KEY`, `SMARTCAPTCHA_SERVER_KEY`
  - `SMARTCAPTCHA_TEST_MODE=true/false`
- Public endpoints:
  - `GET /api/v1/auth/captcha-config` (registration UI config)
  - `GET /api/v1/publish/captcha/config` (publication UI config)

### Key Finding (Yandex docs)

- `test=true` does **not** bypass domain validation; it only forces a challenge for debugging.
- For local testing, the hostname must be allowlisted in Yandex Cloud SmartCaptcha settings (or use a dev hostname).

### Implementation Notes

- publish-backend exposes publication captcha config via `GET /api/v1/publish/captcha/config`.
- The endpoint must also be present in `API_WHITELIST_URLS` because flowise-core-backend applies a global `/api/v1` auth middleware.
- publish-frontend `ARViewPage` fetches that config and passes it into the builder as `publicationCaptchaConfig`.
- template-quiz `DataHandler.processMultiScene()` merges `publicationCaptchaConfig` into `leadCollection` defaults:
  - If `leadCollection.captchaEnabled` is explicitly set, it wins.
  - Otherwise, global `publicationCaptchaConfig.enabled && siteKey` enables captcha.
  - If captcha is enabled but `leadCollection.captchaSiteKey` is empty, it falls back to the global siteKey.
- Result: captcha can be globally enabled for publications without requiring per-space captcha fields.

### Publication Test Mode (Follow-up)

- Issue: `/p/:slug` SmartCaptcha widget loaded with `test=false` in iframe URL even when `SMARTCAPTCHA_TEST_MODE=true`.
- Fix: `template-quiz` lead form now initializes the widget via `window.smartCaptcha.render(..., { test })` and loads captcha script with `?render=onload&onload=__onSmartCaptchaReady` to ensure the `test` flag is applied.

### Verification

- Built `template-quiz` and `publish-frontend` successfully.
- Full workspace build succeeded after changes.
- Manual: `/p/:slug` should now show SmartCaptcha in the lead form when publication captcha is enabled.

---

## Recent Highlights (last 7 days)

### 2026-01-01: Publication Captcha Wiring ✅

- Issue: published app `/p/:slug` lacked captcha even with `SMARTCAPTCHA_PUBLICATION_ENABLED=true`.
- Root cause: generated lead form relied only on per-space `leadCollection.captcha*` fields.
- Fix: publish-frontend fetches global config and passes it into template build; template-quiz merges defaults into `leadCollection`.
- Reference: progress.md#2026-01-01 (Publication Captcha Wiring)

### 2026-01-01: Registration SmartCaptcha ✅

- Backend: Yandex SmartCaptcha token verification (fail-open in dev/test).
- Frontend: widget rendered under consent checkboxes; register button blocked until solved.
- Reference: progress.md#2026-01-01 (Yandex Smart Captcha Integration)

### 2025-12-31: Cookie Consent + Lead Consent ✅

- Cookie consent banner (accept/reject) with rejection dialog; localStorage persistence.
- Quiz lead consent: Terms/Privacy checkboxes and schema support.
- Reference: progress.md#2025-12-31

### 2025-12-30: Legal Pages + Profile Fixes ✅

- Legal pages (`/terms`, `/privacy`) and registration consent enforcement.
- Profile creation bugfix (TypeORM query result parsing) + migration consolidation.
- Reference: progress.md#2025-12-30

### 2025-12-28: Onboarding Wizard MVP ✅

- Multi-step onboarding flow (Projects/Campaigns/Clusters) with backend persistence.
- Reference: progress.md#2025-12-28

### 2025-12-26: Auth UX Improvements ✅

- 419 auto-retry after restart; improved logout guest behavior; public endpoints allowlist.
- Reference: progress.md#2025-12-26
