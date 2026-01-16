# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---

## In Progress / QA Follow-ups

- [x] QA cleanup: add MSW handler for connectors metahubs requests in applications-frontend tests.
- [x] QA cleanup: suppress act/AbilityContext warnings in applications-frontend tests.
- [x] Applications connectors refactor: update applications-backend entities/migrations/routes/guards and backend tests.
- [x] Applications connectors refactor: update applications-frontend API/hooks/types/pages/components and frontend tests.
- [x] Metahubs integration: update publications routes and metahubs UI texts to use connectors terminology.
- [x] UI integration: update template-mui routes/menu/breadcrumbs and universo-i18n menu keys to connectors.
- [x] Documentation: update applications READMEs (EN/RU) to connectors terminology and paths.
- [x] Verification: run targeted tests for applications backend/frontend and document any gaps.
- [x] Wrap-up: update memory-bank/progress.md and note changes in activeContext if needed.
- [ ] Reduce non-fatal test noise (optional).
- [ ] Manual QA: breadcrumbs show Application name (not UUID).
- [ ] Manual QA: Access page loads members list (no connection error).
- [ ] Manual QA: delete attribute and confirm UI "#" renumbers 1..N (hub + hub-less).
- [ ] Manual QA: create records repeatedly and confirm UI does not hang.
- [ ] Confirm server logs show QueryRunner cleanup per request.

---

## IMPLEMENT (2026-01-16): Metahubs API routes standardization + test warnings + coverage

- [x] Remove act/MSW/useHasGlobalAccess warnings in metahubs-frontend tests (setup mocks + test fixes).
- [x] Add MSW handler for `/api/v1/profile/settings` in metahubs-frontend mocks.
- [x] Restore shared/utils coverage in metahubs-frontend and add tests to meet thresholds.
- [x] Refactor metahubs-backend routes to singular detail paths (metahub/hub/catalog/attribute/record/publication) and align public routes.
- [x] Update metahubs-frontend API clients/tests and template-mui breadcrumb fetches to new backend paths.
- [x] Update metahubs backend/frontend READMEs (EN/RU) to match new routes and i18n docs rules.
- [ ] Run full root build (timed out after ~200s; re-run needed).
- [x] Update progress.md and activeContext.md with route standardization changes.

---

## IMPLEMENT (2026-01-16): Metahubs frontend build-first + docs + tests

- [x] Switch metahubs-frontend to build-first (dist exports + tsdown entry for src/index.ts).
- [x] Remove src/index.d.ts temporary stub and align package.json exports.
- [x] Update README.md and README-RU.md to remove /api imports and match i18n-docs rules.
- [x] Update/add metahubs-frontend tests for entry exports after build-first.
- [x] Fix failing metahubs-frontend tests (api wrappers mock path, view preference mock shape, actions expectations).
- [x] Verify metahubs-frontend tests, metahubs-backend tests, and full root build.
- [x] Update progress.md and activeContext.md with build-first changes.

---

## IMPLEMENT (2026-01-16): Metahubs backend tests + ddl rename

- [x] Rename `domains/runtime-schema` to `domains/ddl` and update imports/docs.
- [x] Fix metahubsRoutes tests (mocks + expectations for sorting/search/members).
- [x] Move ts-jest isolatedModules to tsconfig.test.json and update base jest config.
- [x] Verify metahubs-backend tests/build and note any gaps.
- [x] Update progress.md and activeContext.md with changes.

---

## IMPLEMENT (2026-01-16): Metahubs backend domain refactor

- [x] Inventory current routes/schema/services usage and monorepo imports.
- [x] Create domain folders (metahubs, hubs, catalogs, attributes, records, publications, runtime-schema, shared) and move code.
- [x] Rebuild route composition and exports using domain routers (no legacy paths).
- [x] Update internal imports, tests, and docs to new domain structure.
- [x] Remove old folders (src/routes, src/schema, src/services, src/schemas) after migration.
- [x] Verify builds/tests for metahubs-backend and note any gaps.
- [x] Update progress.md and activeContext.md with refactor summary.

---

## IMPLEMENT (2026-01-15): Metahubs TS verification

- [x] Run targeted TS builds for metahubs-backend and metahubs-frontend to detect errors.
- [x] Fix any TS errors uncovered by the builds and re-run the affected build.
- [x] Update progress.md with results and note any decisions in activeContext.md if needed.

---

## IMPLEMENT (2026-01-16): Metahubs frontend modular refactor

- [x] Introduce domain folders for metahubs frontend and move UI pages/actions into domains with compatibility exports.
- [x] Move API modules into domain folders and keep stable re-exports for existing imports.
- [x] Update internal imports and tests to match new structure where needed.
- [x] Verify targeted builds for metahubs-frontend.
- [x] Update progress.md with refactor summary.

---

## IMPLEMENT (2026-01-16): Metahubs frontend cleanup + domain barrels

- [x] Inventory and update monorepo imports to remove pages/* usage; switch routes to root exports.
- [x] Introduce domain barrel exports to reduce relative import depth.
- [x] Domainize metahubs mutations and shared helpers; update imports.
- [x] Remove obsolete proxy layers (src/pages, src/api) and update package exports/tests.
- [x] Verify targeted builds/tests for metahubs-frontend.
- [x] Update progress.md with cleanup summary.

---

## ✅ COMPLETED (2026-01-15): QA fixes for types unification

- [x] Update roleSchema/memberFormSchema tests for dynamic roles; add empty role rejection test.
- [x] Remove PaginationMeta duplication (re-export from @universo/types).
- [x] Replace dangerouslySetInnerHTML with SafeHTML in chat UI.
- [x] All tests passing.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Monorepo-wide types unification

- [x] Canonical types in @universo/types: PaginatedResponse items, PaginationParams alias, Filter types.
- [x] @universo/template-mui re-exports pagination/filter types; keeps MUI-specific types.
- [x] getLocalizedString -> getVLCString migration (applications/metahubs).
- [x] Pagination types migrated across 11 frontends (admin, campaigns, storages, projects, spaces, organizations, publish, start, clusters, metaverses, metahubs, applications, uniks).
- [x] Remove UseApi from 7 frontends (campaigns, projects, storages, organizations, clusters, metaverses, uniks).
- [x] Full build passed; systemPatterns updated.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Metahubs types refactor + cleanup

- [x] Remove dead/legacy types (gulp.d.ts, ui.d.ts, LocalizedField, getLocalizedContent, UseApi).
- [x] Migrate pagination types to @universo/types; add PaginationParams alias.
- [x] Reorganize types.ts with JSDoc and grouped exports.
- [x] Build metahubs-frontend and full monorepo passed.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Metahubs QA fixes

- [x] SchemaMigrator FK naming + constraint length fixes.
- [x] Reuse shared getVLCString; remove renderLocalizedFields.
- [x] Publications UI naming cleanup + EN grammar fix.
- [x] Lint re-run (pre-existing warnings remain).
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Publications refactor + sync fixes

- [x] Backend routes: `/metahubs/:id/publications` (list/detail/sync/diff/delete).
- [x] Frontend publications API aligned to `/publications` endpoints.
- [x] Breadcrumbs fetch publication names from `/publications`.
- [x] Sync action wired to create/update/sync/delete publication APIs.
- [x] Build verified (63 tasks).
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): Source -> Metahub links UI (Phase 5-6)

- [x] MetahubSelectionPanel component.
- [x] sourceMetahubs API functions (list/link/unlink/listAvailable).
- [x] useSourceMetahubs hooks (list/available/link/unlink).
- [x] Types: SourceMetahub, MetahubSummary, SourceMetahubsResponse.
- [x] EN/RU translations for sources.metahubs.*.
- [x] Build @universo/applications-frontend success.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-15): useViewPreference QA improvements

- [x] SSR-safe hook in @universo/template-mui with isLocalStorageAvailable guard.
- [x] Export ViewStyle + DEFAULT_VIEW_STYLE; re-export across 7 packages.
- [x] 14 unit tests added; keys normalized (projects/storages).
- [x] Lint and build verification completed.
- [x] Details: progress.md#2026-01-15.

---

## ✅ COMPLETED (2026-01-14): Publications rename stabilization

- [x] Rename Application* -> Publication* in metahubs UI and types.
- [x] Update API/hook names and routes (`/publications`, `/publication/:publicationId`).
- [x] Update query keys/mutations and menu configs (EN/RU).
- [x] Backend routes factory renamed to createPublicationsRoutes.
- [x] Build verified (63 tasks).
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Publications page fixes

- [x] Add missing publications i18n keys + labels (EN/RU).
- [x] Fix crash on /metahub/:id/publications and diff hook naming.
- [x] Update breadcrumbs for publication routes.
- [x] Build verified.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Source deletion & table unification

- [x] Disable Source delete actions and hide Delete button.
- [x] Update EN/RU deletion restriction copy.
- [x] Extend CompactListTable action column props.
- [x] Unify selection panels via EntitySelectionPanel.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Application/Source UX fixes

- [x] Add Stack spacing and tabs to Application/Source dialogs.
- [x] Pass metahub context into creation/edit dialogs.
- [x] Fix SourceMetahubInfoWrapper items extraction.
- [x] Move Source list alert below ViewHeader and keep Add button disabled/visible.
- [x] Add clickable Source cards + row navigation links.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Application creation from Metahubs fixes

- [x] Add Application creation tabs with MetahubInfoPanel.
- [x] Resolve owner assignment when creating Application.
- [x] Copy Metahub name/description to Source on create.
- [x] Add Source edit dialog Metahubs tab; single Source limit.
- [x] Add translations for singleSourceLimit.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Link Applications and Metahubs via Sources

- [x] Extend applications schema with schema sync fields.
- [x] Add SourceMetahub junction entity + RLS policy.
- [x] Create applicationsRoutes in metahubs-backend (CRUD/diff/sync).
- [x] Add source-metahub link endpoints and build verification.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Applications packages QA fixes

- [x] Rename tests and remove obsolete backend tests.
- [x] Update README terminology and jest config.
- [x] Clean Metahubs/Catalogs comments in sources.
- [x] useViewPreference in ApplicationMembers; build/tests verified.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-14): Applications backend tests + localStorage improvements

- [x] Add applicationsRoutes/sourcesRoutes test suites.
- [x] Fix test expectations (403 vs 404, pagination shape).
- [x] Add MSW handler for profile settings.
- [x] Apply useViewPreference to MetahubMembers + tests.
- [x] Details: progress.md#2026-01-14.

---

## ✅ COMPLETED (2026-01-13): Applications packages creation

- [x] Clone metahubs packages -> applications-frontend/backend.
- [x] Remove catalogs/attributes/records artifacts.
- [x] Rename Metahub -> Application and Hub -> Source files.
- [x] Register entities, migrations, routes, i18n, and menu entries.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Catalogs/attributes improvements

- [x] Normalize Attribute.sortOrder after delete (1..N).
- [x] Hub-less attribute endpoints + direct API functions.
- [x] Hub-less record endpoints + direct query keys.
- [x] Routes refactor `/catalogs/:id` -> `/catalog/:id`.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Schema sync UUID naming

- [x] Use UUID-based `cat_<uuid32>` and `app_<uuid32>` naming.
- [x] SchemaMigrator diff uses UUID names consistently.
- [x] Build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-13): Applications UI & diff fixes

- [x] Save VLC structure for comparisons and primaryLocale fields.
- [x] Replace confirm() with ConfirmDeleteDialog.
- [x] Add edit action + PATCH endpoint + i18n keys.
- [x] Add search/pagination and fix Options menu crash.
- [x] Build verification.

---

## ✅ COMPLETED (2026-01-13): Applications config/data separation

- [x] Add Application entity + schema status fields.
- [x] Create migrations + SchemaGenerator/SchemaMigrator services.
- [x] Add CRUD/diff/sync routes and frontend hooks/UI.
- [x] Register menu, routes, i18n, storage keys.
- [x] Build verification.
- [x] Details: progress.md#2026-01-13.

---

## ✅ COMPLETED (2026-01-12): Catalogs endpoint tests

- [x] Add catalogsRoutes tests (17 cases).
- [x] Extend MockRepository count.
- [x] Document UUID validation in routes.
- [x] Details: progress.md#2026-01-12.

---

## ✅ COMPLETED (2026-01-11): Catalogs + QueryRunner QA fixes

- [x] Hub-less catalog DELETE endpoint and deleteCatalogDirect API.
- [x] escapeLikeWildcards and getRequestManager consolidation.
- [x] QueryRunner support in AccessGuards and loadMembers patterns.
- [x] CompactListTable header + HubDeleteDialog UX improvements.
- [x] Catalog/Hub operations fixes (blocking catalogs, update endpoints).
- [x] isRequiredHub migration + documentation.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-11.

---

## ✅ COMPLETED (2026-01-10): Catalogs QA rounds + code quality

- [x] Sorting, columns, catalogsCount, dashboard widget updates.
- [x] AllCatalogs list UI, i18n fixes, cache invalidation.
- [x] useCatalogName hook + breadcrumbs updates.
- [x] Optimize catalogsRoutes/hubsRoutes to avoid N+1 queries.
- [x] Centralize localStorage keys + useViewPreference hook in list pages.
- [x] Full project rebuilds.
- [x] Details: progress.md#2026-01-10.

---

## ✅ COMPLETED (2026-01-09): Metahubs VLC rollout + FlowListTable fix

- [x] VLC rendering fixes in metahubs lists.
- [x] FlowListTable listView rendering fixed.
- [x] Build verification.
- [x] Details: progress.md#2026-01-09.

---

## ✅ COMPLETED (2026-01-08): Record edit fixes

- [x] Pass raw record data to actions; fetch full record when missing.
- [x] Delay record edit fields until hydration completes.
- [x] Build metahubs-frontend verified.
- [x] Details: progress.md#2026-01-08.

---

## ✅ COMPLETED (2026-01-06): Attributes localization hardening

- [x] Localized name + codename auto-fill; remove description field.
- [x] Align API payloads/mutations and backend validation.
- [x] Update tests and builds for metahubs frontend/backend.
- [x] Details: progress.md#2026-01-06.

---

## ✅ COMPLETED (2026-01-05): Project metadata i18n + login UX

- [x] Add locale metadata files and update landing/onboarding translations.
- [x] Update entrypoints and docs metadata.
- [x] Improve login error messages and i18n keys; security-safe copy.
- [x] Full build and lint verification.
- [x] Details: progress.md#2026-01-05.

---

## ✅ COMPLETED (2026-01-04): Auth bot review fixes

- [x] Refactor AuthView/AuthPage per review (mode switcher + useEffect).
- [x] Align systemPatterns docs to flat config.
- [x] Details: progress.md#2026-01-04.

---

## ✅ COMPLETED (2026-01-03): Auth feature toggles + i18n migration

- [x] Add auth feature toggles and /auth-config endpoint.
- [x] Update auth-frontend types, UI, and i18n keys.
- [x] Migrate start page i18n to registerNamespace(); add StartFooter.
- [x] Full build verification.
- [x] Details: progress.md#2026-01-03.

---

## ✅ COMPLETED (2026-01-02): SmartCaptcha improvements

- [x] Add login captcha support and shared captcha module.
- [x] Fail-closed behavior for captcha services.
- [x] Lint and full build passed.
- [x] Details: progress.md#2026-01-02.

---

## ✅ COMPLETED (2026-01-01): SmartCaptcha + lead forms

- [x] Server-side captcha validation for leads.
- [x] /p/:slug SmartCaptcha domain fix via server render endpoint.
- [x] Quiz lead forms support (captchaEnabled, captchaSiteKey, submit guard).
- [x] Auth captcha integration and i18n updates.
- [x] Details: progress.md#2026-01-01.

---

## ✅ COMPLETED (2025-12-31 to 2025-12-14): Condensed log

- [x] Cookie/lead consent, legal pages, onboarding/auth fixes, start page MVP.
- [x] Metahubs transformation + RLS QA fixes.
- [x] AgentFlow integration, config UX, QA hardening.
- [x] Flowise 3.0.12 components refresh.
- [x] Details: progress.md#2025-12-31.
- [x] Also see progress.md#2025-12-30 for legal/profile updates.

---

## 📋 PLANNED TASKS

### Session Persistence on Server Restart

- Status: Deferred until production deployment pattern is clear; currently using MemoryStore.

### Future Auth Improvements

- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT).
- [ ] Review auth architecture for scalability.

### Admin Module Enhancements

- [ ] Role cloning, templates, permission inheritance.
- [ ] Audit log for role/permission changes.
- [ ] Multi-instance support (remote instances).

### Frontend UX

- [ ] Dark mode theme.
- [ ] Keyboard shortcuts.
- [ ] Mobile responsiveness improvements.
- [ ] Tour/onboarding for new users.
- [ ] Server-side caching, CDN integration.
- [ ] Bundle size optimization.
- [ ] Complete API documentation (OpenAPI).
- [ ] Architecture decision records (ADR).

---

## 🧪 TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation.
- [ ] Standardize error handling across packages.
- [ ] Add unit/E2E tests for critical flows.
- [ ] Resolve Template MUI CommonJS/ESM conflict.
- [ ] Database connection pooling optimization.

---

## 🔒 SECURITY TASKS

- [ ] Rate limiting for all API endpoints.
- [ ] CSRF protection review.
- [ ] API key rotation mechanism.
- [ ] Security headers (HSTS, CSP).
- [ ] Security audit.
- [ ] 2FA/MFA system.

---

## 📚 HISTORICAL TASKS

For tasks completed before 2025-12, see progress.md.
Main achievements:
- v0.40.0: Tools/Credentials/Variables/ApiKey/Assistants/Leads/ChatMessage/DocStore/CustomTemplates extraction, Admin Instances MVP, RBAC Global Roles.
- v0.39.0: Campaigns, Storages modules, useMutation refactor.
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes.
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics.
- v0.36.0: dayjs migration, publish-frontend architecture.
- v0.35.0: i18n TypeScript migration, rate limiting, RLS analysis.
- v0.34.0: Global monorepo refactoring, tsdown build system.
