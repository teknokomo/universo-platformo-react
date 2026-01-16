# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.45.0-alpha | 2026-01-12 | 0.45.0 Alpha — 2026-01-11 | GH630 Internationalize project metadata and update texts; GH632 Add localized fields UI, refactor admin locales, integrate into Metahubs; GH634 Implement Metahubs VLC localization + UI fixes |
| 0.44.0-alpha | 2026-01-04 | 0.44.0 Alpha — 2026-01-04 (Fascinating Acquaintance) 🖖 | GH613 Implement Onboarding Completion Tracking with Registration 419 Auto-Retry; GH615 Implement legal consent feature with Terms of Service and Privacy Policy during registration; GH618 Add consent tracking (Terms of Service and Privacy Policy) for Leads |
| 0.43.0-alpha | 2025-12-27 | 0.43.0 Alpha — 2025-12-27 (New Future) 🏋️‍♂️ | GH609 Metahubs Phase 3: Fix Pagination Display and Localization Issues; GH611 feat: Implement onboarding wizard with start pages i18n |
| 0.42.0-alpha | 2025-12-18 | 0.42.0 Alpha — 2025-12-18 (Dance Agents) 👯‍♀️ | GH601 VLC System Implementation and Breadcrumb Hooks Refactoring; GH603 Dynamic Locales Management System; GH605 Upgrade Flowise Components from 2.2.8 to 3.0.12 |
| 0.41.0-alpha | 2025-12-11 | 0.41.0 Alpha — 2025-12-11 (High Mountains) 🌄 | GH589 Implement admin panel disable system with ENV-based feature flags; GH591 Upgrade axios to 1.13.2 to fix SSRF vulnerability (CVE-2025-27152); GH593 Migrate Auth.jsx to auth-frontend package with TypeScript refactoring |
| 0.40.0-alpha | 2025-12-06 | 0.40.0 Alpha — 2025-12-05 (Straight Rows) 🎹 | GH563 Extract Tools functionality into separate packages; GH565 Extract Credentials functionality into separate packages; GH567 Extract Variables functionality into separate packages |
| 0.39.0-alpha | 2025-11-26 | 0.39.0 Alpha — 2025-11-25 (Mighty Campaign) 🧙🏿 | GH555 Refactor Configuration documentation and remove Spanish docs; GH557 Implement Storages Management with Three-Tier Architecture; GH559 Campaigns Integration: Three-tier Architecture Implementation |
| 0.38.0-alpha | 2025-11-22 | 0.38.0 Alpha — 2025-11-21 (Secret Organization) 🥷 | GH546 UI/UX Improvements: Card Link Preview, Pagination, Search, Routing Update; GH549 Implement Projects Management System with Hierarchical Structure; GH551 Implement AR.js Quiz Nodes Interaction Mode |
| 0.37.0-alpha | 2025-11-14 | 0.37.0 Alpha — 2025-11-13 (Smooth Horizons) 🌅 | GH529 Refactor REST API documentation: OpenAPI 3.1 modular structure with Zod validation; GH531 OpenAPI Documentation Refactoring: Workspace -> Unik Terminology & Description Field; GH533 Refactor Metaverses Frontend: Extract Dashboard Components to Template Package |
| 0.36.0-alpha | 2025-11-07 | 0.36.0 Alpha — 2025-11-07 (Revolutionary indicators) 📈 | GH510 Migrate date formatting to dayjs and refactor metaverse components to TypeScript; GH512 Refactor UI Components in universo-template-mui Package; GH514 Improve code quality and testing coverage for universo-template-mui |
| 0.35.0-alpha | 2025-10-30 | 0.35.0 Alpha — 2025-10-30 (Bold Steps) 💃 | GH497 Migrate flowise-chatmessage and flowise-store to base/ structure + i18n consolidation; GH499 Comprehensive i18n Documentation Update: Main README and Packages Documentation; GH502 QA Analysis: i18n Refactoring, TypeScript Modernization & RLS Integration |
| 0.34.0-alpha | 2025-10-23 | 0.34.0 Alpha — 2025-10-23 (Black Hole) ☕️ | GH495 Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | 0.33.0 Alpha — 2025-10-16 (School Test) 💼 | GH487 Publication System: Fix 429 Errors, API Modernization, and UI Improvements; GH489 MVP Implementation: Metaverses Module Architecture Refactoring and Component Migration; GH493 Implement Quiz Timer Feature with Position Configuration and Bug Fixes |
| 0.32.0-alpha | 2025-10-09 | 0.32.0 Alpha — 2025-10-09 (Straight Path) 🛴 | GH464 Enable canvas version metadata editing flow; GH466 Complete Chatflow to Canvas Terminology Refactoring; GH468 Refactor telemetry to opt-in PostHog |
| 0.31.0-alpha | 2025-10-02 | 0.31.0 Alpha — 2025-10-02 (Victory Versions) 🏆 | GH441 Manual quiz editing workflow to Space Builder; GH444 Ensure Unik deletion removes orphaned canvases; GH447 Fix Space Builder dialog hook order mismatch |
| 0.30.0-alpha | 2025-09-21 | 0.30.0 Alpha — 2025-09-21 (New Doors) 🚪 | GH404 Implement TypeScript Path Aliases Standardization Across Frontend Applications; GH406 Implement Global Publication Library Management System and Lead Points Field; GH408 Analytics: hierarchical Space->Canvas selector & spaces API consolidation |
| 0.29.0-alpha | 2025-09-15 | 0.29.0 Alpha — 2025-09-15 (Cluster Backpack) 🎒 | GH385 Resources: Cluster/Domain/Resource architecture, tenant isolation and security hardening; GH387 Resources follow-ups: remove duplicate cluster link on create, simplify entities-srv repos API, clean logs; GH389 CI: Implement i18n docs consistency checker (PNPM task + GitHub Actions) + usage docs |
| 0.28.0-alpha | 2025-09-07 | 0.28.0 Alpha — 2025-09-07 (Orbital Switch) 🥨 | GH309 Add resources service; GH311 Add resources frontend module and menu entry; GH313 Scaffold entities service |
| 0.27.0-alpha | 2025-08-31 | 0.27.0 Alpha — 2025-08-31 (Stable Takeoff) 🐣 | GH277 Standardize GitHub workflow guidelines and AI assistant rules; GH279 Add Language Switcher to Application Header; GH281 Integrate Template MMOOMM translations into main i18n system |
| 0.26.0-alpha | 2025-08-24 | 0.26.0 Alpha — 2025-08-24 (Slow Colossus) 🐌 | GH267 feat: Extract MMOOMM template into modular package; GH270 feat: Create multiplayer-colyseus-srv application with comprehensive documentation; GH272 Add Kiro IDE configuration and steering rules |
| 0.25.0-alpha | 2025-08-17 | 0.25.0 Alpha — 2025-08-17 (Gentle Memory) 😼 | GH248 Space Builder: three-step flow, Model Settings modal, MUI fixes, docs sync; GH250 Space Builder: constraints input, iterative revise endpoint, read-only preview, i18n, docs sync (EN/RU); GH252 Space Builder - Creation mode (New Space default), safer Append, docs |
| 0.24.0-alpha | 2025-08-12 | 0.24.0 Alpha — 2025-08-12 (Stellar Backdrop) 🌌 | GH222 Comprehensive roadmap documentation enhancement; GH224 Fix: MMOOMM Entity hardcoded transform values override UPDL settings; GH226 The Uniks functionality has been moved to separate packages uniks-srv and uniks-frt |
| 0.23.0-alpha | 2025-08-04 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | GH203 Complete Russian translation of Configuration and LangChain components documentation; GH206 Added new Russian translations to the CLI, Configuration, Using Flowise and LlamaIndex sections; GH208 Fixed Entity scale handling in MMOOMM asteroid system |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️ | GH173 Added Memory Bank rules and refactored memory bank files; GH180 Fix UPDL Component Render Priority in MMOOMM Template; GH182 Update Cursor Memory Bank rules to work better with files |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 (Firm Resolve) 💪 | GH157 Optimized Memory Bank and upgraded to Alpha status; GH159 Fixed ship movement and logging issues in MMOOMM template; GH161 Changed the location of MMOOMM PlayCanvas handlers |
| 0.20.0-alpha | 2025-07-13 | 0.20.0 Alpha — 2025-07-13 (Tools Revolution) 🔧 | GH139 UPDL nodes have been refactored to improve reliability and consistency; GH141 Refactoring of the logic and UI of the publication system was carried out; GH143 Implemented a rendering page for PlayCanvas publications |
| 0.19.0-pre-alpha | 2025-07-06 | 0.19.0 Pre-Alpha — 2025-07-06 | GH89 Converted "publish-srv" application to workspace package; GH45 Complete refactoring of buildUPDLflow.ts with separation of functionality; GH101 Refactored UPDL types and removed legacy interfaces file |
| 0.18.0-pre-alpha | 2025-07-01 | 0.18.0 Pre-Alpha — 2025-07-01 | GH77 The project has been updated to Flowise version 2.2.8; GH95 Fixed critical bugs found after migration to Flowise 2.2.8; GH98 Fixed TypeScript compilation errors and TypeORM conflicts in Flowise Components |
| 0.17.0-pre-alpha | 2025-06-25 | 0.17.0 Pre-Alpha — 2025-06-25 | Added new fields to User Profile settings by @VladimirLevadnij in #82; Updated menu items Documentation, Chat Flows, Agent Flows by @VladimirLevadnij in #83; GH84 Convert profile-srv to workspace package |
| 0.16.0-pre-alpha | 2025-06-21 | 0.16.0 Pre-Alpha — 2025-06-21 | Fix Russian text in memory bank; Fix Russian comments; Update app READMEs and Russian translations |

---

## 2026-01-16

### Metahubs backend domain refactor
- Moved backend routes into domain folders (metahubs/hubs/catalogs/attributes/records/publications + shared).
- Extracted runtime DDL tooling to domains/ddl (SchemaGenerator/SchemaMigrator/KnexClient + diff/naming).
- Removed legacy folders (routes/schema/schemas/services) and updated tests/imports.
- Updated README structure to reflect the domain layout.
- Build: pnpm --filter @universo/metahubs-backend build.

### Metahubs backend tests + ddl rename
- Renamed runtime-schema folder to `domains/ddl` and updated imports/docs.
- Fixed metahubsRoutes tests to match sorting/search/members enrichment logic.
- Moved `isolatedModules` setting into `tsconfig.test.json` (removed ts-jest warning).
- Tests: pnpm --filter @universo/metahubs-backend test.

### Metahubs frontend modular refactor
- Introduced domain-based folders (metahubs/hubs/catalogs/attributes/records/publications + shared) in metahubs-frontend.
- Moved UI pages/actions into domain UI modules; added page/action wrappers for compatibility exports.
- Moved API and hooks into domain modules; kept stable re-exports via src/api.
- Updated internal imports to use shared query keys and cross-domain API references.
- Build: pnpm --filter @universo/metahubs-frontend build.

### Metahubs frontend cleanup + domain barrels
- Removed pages and api proxy layers; updated package exports and entry mocks.
- Added domain barrel exports and shared API client; reduced cross-domain import depth.
- Split mutation hooks into per-domain modules; updated UI imports and tests.
- Updated template-mui routes to lazy-load from root metahubs-frontend exports.
- Build: pnpm --filter @universo/metahubs-frontend build.

### Metahubs frontend build-first + docs + tests
- Switched metahubs-frontend to build-first exports (dist entry for `src/index.ts` + tsdown entry updated).
- Removed temporary `src/index.d.ts` stub; aligned package.json exports to dist.
- Updated README.md + README-RU.md to drop `/api` imports and align docs structure.
- Fixed metahubs-frontend tests (api wrappers mock path, view preference mock shape, action factories/mutations/useMetahubDetails mocks).
- Adjusted vitest coverage include/exclude to focus on metahubs MVP scope.
- Tests: pnpm --filter @universo/metahubs-frontend test (warnings remain: act/MSW/useHasGlobalAccess).
- Tests: pnpm --filter @universo/metahubs-backend test (security warn logs expected).
- Build: full monorepo `pnpm build` successful (tsdown/import.meta + chunk size warnings pre-existing).

### Metahubs API route standardization + test/coverage cleanup
- Standardized backend routes to singular detail paths (metahub/hub/catalog/attribute/record/publication) and aligned public routes mount.
- Updated metahubs-frontend API clients, template-mui breadcrumb fetches, and MSW handlers for new paths.
- Added MSW handler for `/api/v1/profile/settings` and mocked useHasGlobalAccess to reduce test warnings.
- Restored shared/utils coverage and added tests for queryKeys/localizedInput.
- Tests: pnpm --filter @universo/metahubs-frontend test; pnpm --filter @universo/metahubs-backend test (security warn logs expected).
- Build: `pnpm build` started but timed out after ~200s; needs re-run to confirm full build.

## 2026-01-15

### Applications connectors refactor
- Renamed Sources -> Connectors across applications-backend/frontend (entities, routes, guards, tests).
- Updated publications integration in metahubs-backend and metahubs UI copy to connector terminology.
- Updated template-mui routes/menu/breadcrumbs + universo-i18n menu keys to connectors.
- Updated applications READMEs (EN/RU) to connector terminology and /connectors paths.
- Build: @universo/template-mui rebuilt to refresh dist imports.
- Tests: pnpm --filter @universo/applications-backend test; pnpm --filter @universo/applications-frontend test (pre-existing warnings remain).

### Applications frontend test noise cleanup
- MSW handler added for connectors metahubs endpoint.
- Mocked useHasGlobalAccess in test setup to avoid AbilityContext warnings.
- ApplicationMembers tests now await async updates (act/waitFor).
- Tests: pnpm --filter @universo/applications-frontend test.

### Types unification (canonical types)
- Standardized pagination/filter types in @universo/types (items array + filter configs).
- Removed PaginationMeta duplicates; template-mui dependency updated.
- @universo/template-mui re-exports shared types; only MUI-specific types remain.
- Pagination types migrated across 11 frontends; UseApi removed from 7 packages.
- Packages touched include admin/campaigns/storages/projects/organizations/clusters/metaverses/uniks/metahubs/applications.
- getLocalizedString removed in favor of getVLCString.
- Build: full monorepo build (63 tasks) passed.
- Pattern: systemPatterns.md#canonical-types-pattern-critical.

### QA fixes for types unification
- Updated member role tests for dynamic roles; added empty role rejection test.
- Role schema now matches z.string() behavior.
- Removed PaginationMeta duplicate (re-export from @universo/types).
- Replaced dangerouslySetInnerHTML with SafeHTML in chat components.

### Metahubs types refactor + cleanup
- Removed legacy types (gulp/ui, LocalizedField, getLocalizedContent, UseApi).
- Kept getLocalizedString with deprecation notice for public API.
- Moved pagination types to @universo/types; added PaginationParams alias.
- Reorganized types.ts and exports; build verified.

### Metahubs QA fixes
- SchemaMigrator FK naming/length fixes.
- Shared getVLCString usage in publications UI.
- Removed unused renderLocalizedFields; lint warning baseline unchanged.
- Prettier deviations in metahubs-frontend remain pre-existing.

### Publications refactor + sync fixes
- Backend routes: /metahubs/:id/publications for list/detail/sync/diff/delete.
- Frontend API aligned to /publications endpoints.
- Breadcrumbs fetch publication names from /publications.
- Sync action wired to create/update/sync/delete APIs.
- Remaining application naming cleaned in publications context.

### Source -> Metahub links UI
- MetahubSelectionPanel component + sourceMetahubs API/hooks.
- sourceMetahubsQueryKeys factory added for invalidation.
- Added SourceMetahub/MetahubSummary types and i18n keys.
- Build: @universo/applications-frontend successful.

### useViewPreference QA improvements
- SSR-safe hook with isLocalStorageAvailable guard.
- ViewStyle + DEFAULT_VIEW_STYLE exports; re-export across 7 packages.
- 14 unit tests added; localStorage keys normalized.
- SSR guard: isLocalStorageAvailable() integrated.
- Pattern: systemPatterns.md#universal-list-pattern-critical.

---

## 2026-01-14

### Publications rename stabilization and fixes
- Rename Application* -> Publication* in metahubs UI and types.
- Update routes, query keys, and API/hook names.
- Menu configs updated with publications labels (EN/RU).
- Add missing i18n labels; fix publication diff hook naming.
- Breadcrumbs aligned to publication routes.

### Source deletion + table unification
- Disable Source delete actions and hide Delete button.
- Extend CompactListTable action column; unify selection panels.
- Action column header/width standardized for dialogs.
- Pattern: systemPatterns.md#reusable-compact-list-table-pattern-dialogs.

### Application/Source UX improvements
- Add Stack spacing + tabs in dialogs; pass metahub context.
- Fix SourceMetahubInfoWrapper items extraction.
- Make Source cards clickable; keep Add button disabled but visible.

### Application creation from Metahubs
- Add Application creation tabs + MetahubInfoPanel.
- Copy Metahub name/description to Source on create.
- Single Source limit with translations.

### Link Applications and Metahubs via Sources
- Extend application schema with sync fields; add SourceMetahub entity + RLS.
- Create applicationsRoutes in metahubs-backend with CRUD/diff/sync.
- Add source-metahub link endpoints and verify build.

### Applications QA fixes + tests
- Rename tests, remove obsolete backend tests, update README terminology.
- Add applicationsRoutes/sourcesRoutes test suites + MSW handler.
- Apply useViewPreference to MetahubMembers; tests updated.

---

## 2026-01-13

### Applications packages creation
- Clone metahubs packages -> applications-frontend/backend.
- Remove catalogs/attributes/records artifacts.
- Register entities, migrations, routes, i18n, and menu entries.
- Postgres migrations registered in core index.
- Build verified.

### Catalogs/attributes improvements
- Normalize Attribute.sortOrder after delete.
- Hub-less attributes/records endpoints and direct query keys.
- Cache invalidation for direct keys added.
- Routes refactor: /catalogs/:id -> /catalog/:id.

### Schema sync UUID naming
- Use UUID-based app_/cat_ names; SchemaMigrator diff aligned.
- Build verified.

### Applications UI + diff fixes
- VLC structure comparisons; primaryLocale fields in create flow.
- Replace confirm() with ConfirmDeleteDialog.
- Add edit action + PATCH endpoint + i18n keys.
- Search/pagination and Options menu crash fixes.

### Applications config/data separation
- Application entity + schema status fields; migrations.
- SchemaGenerator/SchemaMigrator services + CRUD/diff/sync routes.
- Frontend hooks + ApplicationList/Board/Diff UI.
- Menu/routes/i18n/storage keys registered.

---

## 2026-01-12

### Catalogs endpoint tests
- Added catalogsRoutes tests (17 cases).
- Extended MockRepository count method.
- Documented UUID validation in routes.

---

## 2026-01-11

### Catalogs + QueryRunner QA fixes
- Hub-less catalog delete endpoint + deleteCatalogDirect API.
- escapeLikeWildcards and getRequestManager consolidation.
- Search endpoints aligned to safer LIKE handling.
- QueryRunner support in AccessGuards + loadMembers pattern.
- CompactListTable header + HubDeleteDialog UX improvements.
- HubDeleteDialog uses useQuery for blocking catalogs list.
- Catalog/Hub operations fixes and update endpoints.
- isRequiredHub migration + documentation.
- Pattern: systemPatterns.md#rls-queryrunner-reuse-for-admin-guards-critical.

---

## 2026-01-10

### Catalogs QA rounds + code quality
- Sorting, columns, catalogsCount, dashboard widget updates.
- AllCatalogs list UI, i18n fixes, cache invalidation.
- Catalogs dashboard widgets updated with counts.
- useCatalogName hook + breadcrumbs updates.
- Catalogs columns and tab URLs aligned with new naming.
- N+1 query fixes in catalogsRoutes/hubsRoutes.
- Centralized localStorage keys + useViewPreference in list pages.

---

## 2026-01-09

### Metahubs VLC rollout + FlowListTable fix
- VLC rendering fixes in metahubs lists.
- FlowListTable listView rendering corrected.

---

## 2026-01-08

### Record edit fixes
- Pass raw record data to actions; fetch full record when missing.
- Delay record edit fields until hydration completes.
- Build: metahubs-frontend verified.

---

## 2026-01-07

### Localized field UI rollout
- LocalizedInlineField + EntityFormDialog rolled out across metahubs/admin.
- VLC parsing hardened; primary-locale handling stabilized.
- Diagnostics cleanup and log level restored.
- Diagnostic logs removed; backend log level restored.

---

## 2026-01-06

### Project metadata i18n + localized fields hardening
- Added locale metadata files; updated landing/onboarding translations.
- Updated entrypoints + supported-languages sync scripts.
- Supported languages metadata synced via script.
- Hardened localized field handling for mixed formats.
- Updated frontend tests for VLC payloads.

---

## 2026-01-05

### Login error UX improvements
- mapSupabaseError now recognizes backend "Invalid credentials".
- Added loginFailed i18n keys (EN/RU) + improved serverError copy.
- Copy remains OWASP-safe (no account enumeration).
- Build passed (61 tasks).

---

## 2026-01-04

### Auth bot review fixes
- Extracted mode switcher outside conditional block in AuthView.tsx.
- Combined AuthPage effects via Promise.allSettled.
- Updated systemPatterns docs for flat config.

---

## 2026-01-03

### Auth toggles + start-frontend i18n cleanup
- Added AUTH_* env toggles + /auth-config endpoint.
- StartFooter added to legal pages; onboarding copy updated.
- Migrated start-frontend to registerNamespace(); deprecated legacy helpers.
- StartFooter added to legal pages for auth flows.
- Full build passed (61 tasks).

---

## 2026-01-02

### SmartCaptcha improvements
- Added login captcha support end-to-end.
- Captcha logic extracted to @universo/utils/captcha (axios-based).
- Fail-closed validation when enabled; improved UX errors.
- Full build passed (61 tasks).

---

## 2026-01-01

### SmartCaptcha + lead forms
- Server-side captcha validation for leads and publication flows.
- /p/:slug SmartCaptcha domain fix via server render endpoint.
- Quiz lead forms support with captchaEnabled + captchaSiteKey.
- API_WHITELIST updated for publish captcha/render endpoints.
- Auth captcha integration and i18n updates.
- Pattern: systemPatterns.md#public-routes-401-redirect-pattern-critical.

---

## 2025-12-31

### Privacy consent + lead consent
- Cookie consent banner (accept/decline) with i18n + persistence.
- Lead consent fields for quiz AR.js submissions.
- Consent versioning split into terms/privacy fields.
- Profile consent versioning and signup/profile fixes.

---

## 2025-12-30

### Profile + legal pages
- Profile creation debug fix and trigger consolidation.
- Legal pages (/terms, /privacy) with consent checkboxes.
- Consent trigger consolidation for profile creation.
- RLS alignment for profile creation flow.

---

## 2025-12-28

### Onboarding + auth fixes
- Onboarding completion tracking; auth 419 auto-retry.
- Start page UI spacing and button flicker fixes.

---

## 2025-12-26

### Quiz leads + auth UX + start page i18n
- Completed QA fixes + start page i18n updates.
- Captcha copy aligned to registration flow.

---

## 2025-12-25

### Start page MVP + API client refactor
- Start page MVP shipped; API client refactor completed.
- Start page layout stabilized for guest/auth views.

---

## 2025-12-23

### RLS + Metahubs fixes
- RLS issues resolved and QA fixes applied.
- Access control checks tightened for metahubs endpoints.
- Metahubs endpoints hardened for access control.

---

## 2025-12-22

### Metahubs transformation
- Metahubs MVP transformation (backend + frontend).
- Schema sync scaffolding introduced.

---

## 2025-12-18

### AgentFlow QA hardening
- QA hardening + lint fixes for AgentFlow.
- Stability improvements documented.

---

## 2026-01-15

### Metahubs TS verification
- Targeted builds: @universo/metahubs-backend and @universo/metahubs-frontend succeeded.
- No TypeScript errors detected after full rebuild.

## 2025-12-17

### AgentFlow config UX
- AgentFlow configuration UX improvements.
- Dialog and form layout refinements.

---

## 2025-12-15

### AgentFlow integration
- AgentFlow integration across backend + frontend.
- Build verification logged.

---

## 2025-12-14

### Flowise 3.0.12 components
- Flowise components refresh to 3.0.12.
- Compatibility fixes for updated component APIs.

---

## 2025-12-09

### Catalogs baseline stabilization
- Initial catalogs QA stabilization pass.
- Baseline build status recorded.

---

## 2025-01-10

### Auth disabled state UX refinements
- Auth disabled-state UX improvements with conditional rendering pattern.
- Pattern: systemPatterns.md#admin-route-guards-pattern.
