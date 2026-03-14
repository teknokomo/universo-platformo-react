# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0.54.0-alpha | 2026-03-13 | 0.54.0 Alpha — 2026-03-13                          | MetaHub drag-and-drop ordering, nested hubs, create options/settings UX, optimistic CRUD, SQL-first convergence |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 (Lucky Set) 🍱          | Copy options expansion across Applications, Metahubs, Branches, and Sets/Constants delivery        |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪   | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts                 |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢                                 | Headless Controller, Application Templates, Enumerations                                            |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️                                      | Applications, Template System, DDL Migration Engine, Enhanced Migrations                            |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮                                     | Attribute Data Types, Display Attribute, Layouts System                                             |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                                      | Branches, Elements rename, Three-level system fields                                                |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶                            | Runtime migrations, Publications, schema-ddl                                                        |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊                                  | Applications modules, DDD architecture                                                              |
| 0.45.0-alpha | 2026-01-12 | Structured Structure 😳                            | i18n localized fields, VLC, Catalogs                                                                |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖                        | Onboarding, Legal consent, Cookie banner, Captcha                                                   |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️                                     | Pagination fixes, Onboarding wizard                                                                 |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯                                    | VLC system, Dynamic locales, upstream shell 3.0                                                     |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄                                  | Admin panel, Auth migration, UUID v7                                                                |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹                                   | Package extraction, Admin RBAC, Global naming                                                       |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿                               | Storages, Campaigns, useMutation refactor                                                           |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷                             | Projects, AR.js Quiz, Organizations                                                                 |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅                                 | REST API docs, Uniks metrics, Clusters                                                              |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈                        | dayjs migration, publish-frontend, Metaverse Dashboard                                              |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃                                      | i18n TypeScript migration, Rate limiting                                                            |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️                                     | Global monorepo refactoring, tsdown build system                                                    |
| 0.33.0-alpha | 2025-10-16 | School Test 💼                                     | Publication system fixes, Metaverses module                                                         |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴                                   | Canvas versioning, Telemetry, Pagination                                                            |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆                                | Quiz editing, Canvas refactor, MUI Template                                                         |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                                       | TypeScript aliases, Publication library, Analytics                                                  |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒                                | Resources/Entities architecture, CI i18n                                                            |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨                                  | Resources, Entities modules, Template quiz                                                          |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣                                  | Finance module, i18n, Language switcher                                                             |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌                                   | MMOOMM template, Colyseus multiplayer                                                               |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼                                   | Space Builder, Metaverse MVP, core utils                                                            |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌                                | Space Builder enhancements, AR.js wallpaper                                                         |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️                              | Russian docs, UPDL node params                                                                      |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️                                 | Memory Bank, MMOOMM improvements                                                                    |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪                                    | Handler refactoring, PlayCanvas stabilization                                                       |
## 2026-03-15 Repository-Wide Legacy Branding Removal Complete

Closed the repository-wide legacy branding purge so editable workspace content no longer contains the old upstream brand naming outside git internals. The sweep covered runtime/backend/frontend source, env comments, i18n bundles, deployment docs, memory-bank files, historical plan history, `.kiro` steering guidance, repository instruction files, and generated artifacts/logs.

| Area | Resolution |
| --- | --- |
| Runtime and frontend source | Removed remaining legacy env aliases, comments, path references, external docs links, profile/backend notes, and frontend HTML metadata references. |
| Documentation and guidance | Scrubbed memory-bank core files and historical plans, `.kiro` steering guidance, deployment docs, and repository instruction files so they no longer mention the legacy upstream brand. |
| Generated artifacts | Deleted stale backup/log/coverage artifacts, removed obsolete generated files, and rebuilt the touched packages so regenerated `dist` / `build` outputs stayed clean. |
| Validation | Targeted builds passed for `@universo/admin-frontend`, `@universo/profile-backend`, `@universo/core-backend`, and `@universo/core-frontend`; final repository-wide grep outside `.git` and `node_modules` returned zero matches for `Flowise|FLOWISE|flowise`; final root `pnpm build` passed with 27/27 successful tasks in 3m10.826s. |

## 2026-03-15 Telemetry Removal + Definitive ENV Files Complete

Deleted the entire PostHog telemetry subsystem and produced the definitive version of both `.env.example` and `.env` with all live variables documented and all garbage removed.

| Area | Resolution |
| --- | --- |
| Deleted files | `packages/universo-core-backend/base/src/utils/telemetry.ts` (PostHog `Telemetry` class). |
| Removed dependency | `posthog-node` from `packages/universo-core-backend/base/package.json`. |
| Code cleanup | `index.ts`: removed import, property, initialization, flush. `base.ts`: removed `POSTHOG_PUBLIC_API_KEY` and the legacy telemetry-disable flag definitions and forwarding. `constants.ts`: removed dead `OMIT_QUEUE_JOB_DATA` (zero consumers). `App.initDatabase.test.ts`: removed mock and all 12 telemetry assertions. |
| ENV vars removed | `POSTHOG_PUBLIC_API_KEY` and the legacy telemetry-disable flag from both env files. |
| ENV vars added (12) | **Authentication**: `AUTH_REGISTRATION_ENABLED`, `AUTH_LOGIN_ENABLED`, `AUTH_EMAIL_CONFIRMATION_REQUIRED`, `AUTH_RLS_DEBUG`. **Session cookies**: `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAXAGE`, `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_PARTITIONED`. **Captcha**: `SMARTCAPTCHA_SERVER_KEY`, `SMARTCAPTCHA_SITE_KEY`, `SMARTCAPTCHA_TEST_MODE`, `SMARTCAPTCHA_REGISTRATION_ENABLED`, `SMARTCAPTCHA_LOGIN_ENABLED`, `SMARTCAPTCHA_PUBLICATION_ENABLED`. **Server**: `HOST`. |
| New sections | AUTHENTICATION, SESSION (expanded), CAPTCHA in both env files. |
| QA remediation follow-up | Added documentation for `ALLOW_TRANSACTION_POOLER`, `DATABASE_KNEX_POOL_DEBUG`, `DATABASE_SHUTDOWN_GRACE_MS`, `UNIVERSO_PATH`, and the `FILE_SIZE_LIMIT` alias; removed leftover `DATABASE_TYPE` and structured `REDIS_*` entries that no longer have direct runtime consumers. |
| Pool decision | Kept `DATABASE_POOL_MAX=5` active because `KnexClient` still defaults to 15, while the current repository guidance and Supabase Nano deployment profile require a safe cap of 5 connections. |
| CLI cleanup follow-up | Removed orphaned Oclif flags and process.env passthrough from `packages/universo-core-backend/base/src/commands/base.ts` for `APIKEY_*`, `SECRETKEY_*`, `TOOL_FUNCTION_*`, `DATABASE_TYPE`, `DATABASE_PATH`, `LANGCHAIN_*`, `MODEL_LIST_CONFIG_JSON`, `SHOW_COMMUNITY_NODES`, `DISABLED_NODES`, `BLOB_STORAGE_PATH`, `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`, `GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS`, `DEBUG`, queue/BullMQ vars, and structured `REDIS_*` fields beyond `REDIS_URL`. |

Validation: `pnpm --filter @universo/core-backend build` passed. Final `pnpm build` passed with 27/27 successful tasks. Zero telemetry references in source. All intended env vars are present, and `BaseCommand` now mirrors only live backend runtime inputs.

## 2026-03-14 Environment Config Cleanup Complete

Removed ~52 dead environment variables from `packages/universo-core-backend/base/.env.example` and `.env` that accumulated after the removal of legacy upstream packages, Space Builder, Multiplayer, and metrics infrastructure during prior refactoring waves.
| Area | Resolution |
| --- | --- |
| Deleted sections | APIKEY (2 vars), SECRET KEYS (7 vars; `SESSION_SECRET` moved to own section), METRICS (7 vars), MULTIPLAYER (3 vars), SPACE BUILDER (15 vars), QUEUE/BullMQ config (6 vars). |
| Cleaned vars | `DATABASE_PATH`, `DATABASE_CONNECTION_BUDGET`, `DATABASE_KNEX_POOL_MAX`, `TOOL_FUNCTION_BUILTIN_DEP`, `TOOL_FUNCTION_EXTERNAL_DEP`, `BLOB_STORAGE_PATH`, `GOOGLE_CLOUD_STORAGE_BUCKET_NAME`, `GOOGLE_CLOUD_UNIFORM_BUCKET_ACCESS`, `LANGCHAIN_*` (4), `MODEL_LIST_CONFIG_JSON`, `SHOW_COMMUNITY_NODES`, `DISABLED_NODES`. |
| Added vars | `DATABASE_KNEX_ACQUIRE_TIMEOUT_MS`, `DATABASE_KNEX_IDLE_TIMEOUT_MS`, `DATABASE_KNEX_CREATE_TIMEOUT_MS` — already used in `KnexClient.ts` but were not documented. |
| Section restructuring | QUEUE CONFIGURATION → REDIS (rate-limiting only); SECRET KEYS split into standalone SESSION section; pooling header updated from "Knex only" to "Knex". |
Validation: both files verified with grep — 0 dead variable matches, all live variables present.

## 2026-03-14 Applications + Metahubs Migration Docs Refresh Complete

Closed the package-local migration documentation drift that had accumulated after the fixed-system-app convergence and runtime migration refactors. The `MIGRATIONS.md` / `MIGRATIONS-RU.md` pairs for `@universo/applications-backend` and `@universo/metahubs-backend` now describe the current bootstrap origin, runtime migration surfaces, and ownership split truthfully instead of mixing pre-refactor route ownership and obsolete system-table assumptions.
| Area | Resolution |
| --- | --- |
| Applications migration docs | Rewrote the applications pair around the current fixed-system-app lifecycle: manual snapshot-equivalent baseline, manifest plus file-backed SQL support migrations, first-start bootstrap through registered schema plans, real runtime system-table set, and the applications-owned sync/diff/release-bundle surface. |
| Metahubs migration docs | Rewrote the metahubs pair around the current hybrid model: fixed design-time system app bootstrap, branch runtime migrations in `_mhb_migrations`, built-in template seeding, metahub migration status/list/plan/apply routes, and the hosted application migration-control routes. |
| Ownership boundary clarity | Removed the stale implication that applications-backend owns the application migration-control endpoints, and replaced it with the actual split where metahubs-backend hosts migration-control while applications-backend owns runtime sync and release-bundle execution. |
| Validation | Touched EN/RU line-count parity closed at 89/89 for the applications pair and 94/94 for the metahubs pair; focused package builds passed for both backend packages, and the final root `pnpm build` passed with 27/27 successful tasks in 3m13.394s. |
Validation:

- `pnpm --filter @universo/applications-backend build` passed.
- `pnpm --filter @universo/metahubs-backend build` passed.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m13.394s.
## 2026-03-14 REST Documentation Package Follow-Up Cleanup Complete

Closed the short follow-up wave that reopened immediately after the main `@universo/rest-docs` refactor. Post-implementation verification found that four package-level markdown files still contained duplicated legacy sections appended after the refreshed current-state guidance, so this pass removed the stale tails and reran the package validation path.
| Area | Resolution |
| --- | --- |
| Package markdown cleanup | Removed the leftover historical sections from `packages/universo-rest-docs/README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` so each file now contains only the new generated-docs guidance. |
| Validation rerun | Re-ran `pnpm --filter @universo/rest-docs validate`, `pnpm --filter @universo/rest-docs lint`, and `pnpm --filter @universo/rest-docs build`; all three commands passed after the cleanup. |
| Final doc sizes | The cleaned package docs now end at 73/73 lines for `README.md` and `README-RU.md`, 76 lines for `ARCHITECTURE.md`, and 79 lines for `API_ENDPOINTS.md`, replacing the inflated line counts caused by the duplicated tails. |
Validation:

- `pnpm --filter @universo/rest-docs validate` passed and regenerated a valid OpenAPI source.
- `pnpm --filter @universo/rest-docs lint` passed.
- `pnpm --filter @universo/rest-docs build` passed and bundled the OpenAPI spec successfully.
## 2026-03-14 REST Documentation Package Refactor Complete

Closed the `@universo/rest-docs` modernization wave after the audit confirmed that the package still documented removed workspace-era API groups. The package now rebuilds its OpenAPI source from the live mounted backend route files, the historical YAML fragments are gone, and GitBook now points readers to a real run-and-use path for the interactive Swagger docs.
| Area | Resolution |
| --- | --- |
| Generated OpenAPI source | Added `packages/universo-rest-docs/scripts/generate-openapi-source.js` and wired package scripts so validate/build regenerate `src/openapi/index.yml` from the live auth, profile, start, admin, applications, and metahubs route files before linting or bundling. |
| Legacy docs removal | Deleted the old unik/space/canvas/metaverse-oriented path and component fragments from `packages/universo-rest-docs/src/openapi/`, eliminating the stale historical taxonomy from the package source tree. |
| Package guidance refresh | Rewrote `packages/universo-rest-docs/README.md`, `README-RU.md`, `ARCHITECTURE.md`, and `API_ENDPOINTS.md` so they describe the current generated docs flow, route-family scope, runtime commands, and the limits of generic payload schemas. |
| GitBook integration | Updated `docs/en|ru/api-reference/README.md`, `rest-api.md`, both `SUMMARY.md` files, and added `interactive-openapi-docs.md` in both languages so readers can find, launch, and safely use the interactive API docs. |
Validation:

- `pnpm --filter @universo/rest-docs validate` passed after regenerating the OpenAPI source.
- `pnpm --filter @universo/rest-docs lint` passed.
- `pnpm --filter @universo/rest-docs build` passed and regenerated/bundled the YAML successfully.
- Touched English/Russian doc pairs passed line-count parity checks.
- Final root `pnpm build` passed with 27/27 successful tasks in 4m4.739s.
## 2026-03-14 Unified Database Access Standardization — Documentation and Agent Guidance Sync Complete

Closed the follow-through documentation wave after the implementation and remediation work had already stabilized the code. This pass made the repository documentation, package READMEs, AGENTS guidance, and architecture-facing memory-bank files all describe the same finalized SQL-first PostgreSQL access model, so future contributors and agents see the same boundaries the code now enforces.
| Area | Resolution |
| --- | --- |
| Package README alignment | Updated the English and Russian READMEs for `@universo/applications-backend`, `@universo/metahubs-backend`, `@universo/utils`, and `@universo/database` so they explain Tier 1 request-scoped executors, Tier 2 pool executors, Tier 3 transport/DDL-only Knex ownership, and the fail-closed mutation posture consistently. |
| Public architecture and contributing docs | Refreshed `docs/en|ru/architecture/database-access-standard.md`, `docs/en|ru/contributing/creating-packages.md`, and `docs/en|ru/contributing/database-code-review-checklist.md` to document schema-qualified SQL, identifier helpers, `RETURNING` requirements, explicit package-local DDL seams, and code-review expectations. |
| Agent guidance | Updated the root `AGENTS.md`, rewrote the applications/metahubs backend package agents, and added package-local agents for `@universo/utils` and `@universo/database` so repository automation guidance now matches the final transport-versus-domain boundary. |
| Memory-bank architecture sync | Synced `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`, `memory-bank/activeContext.md`, and `memory-bank/tasks.md` so durable architecture notes, active context, and completion tracking all reflect the same closed-state rules. |
Validation:

- All touched English/Russian document pairs passed structure/parity checks with matching line counts.
- Package AGENTS validation confirmed stale direct-Knex domain guidance was removed from the touched agent files.
- Final root `pnpm build` passed with 27/27 successful tasks in 3m44.843s.
## 2026-03-14 Unified Database Access Standardization — Post-Closure Remediation Complete

Closed the final post-closure remediation wave that remained after the broader plan-completion audit. Repository truth showed only one live red test suite and one service-level fail-closed gap: `@universo/applications-backend` still had a stale sync-persistence spec that mocked pre-SQL-refactor transaction builders, and `MetahubObjectsService` still allowed delete/restore/permanent-delete mutations to succeed silently when zero rows were affected.
| Area | Resolution |
| --- | --- |
| Applications sync-persistence proof | `packages/applications-backend/base/src/tests/services/syncPersistenceStores.test.ts` now validates the live `SqlQueryable.query(...)` contract, including the schema-qualified SQL shape, `RETURNING id`, and exact parameter ordering for both persistence helpers. |
| Metahub object mutation hardening | `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` now constrains soft delete to active rows, restore to trash rows, and permanent delete to existing non-`_upl_deleted` rows; each mutation requires `RETURNING id` and throws when zero rows are touched. |
| Direct service-level regression proof | Added `packages/metahubs-backend/base/src/tests/services/MetahubObjectsService.test.ts` to prove delete, restore, permanent delete, and zero-row fail-closed behavior directly at the service layer. |
| Utils advisory-lock follow-up | Revalidated the previously suspected `@universo/utils` advisory-lock typing issue and confirmed it does not reproduce in current diagnostics or package tests, so no speculative code change was introduced. |
Validation:

- `@universo/applications-backend` lint passed and tests passed 84/84.
- `@universo/metahubs-backend` lint remained warning-only with no new errors, and tests passed 230/233 with 3 expected skips.
- `@universo/utils` advisory-lock tests remained green.
- `node tools/lint-db-access.mjs` passed with 0 violations.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Residual Debt Closure Complete

Closed the last residual debts that the final QA truth-check had reopened after the earlier closure claim. The remaining work was narrow but important: `applicationSyncRoutes.ts` still relied on direct Knex transport access behind a lint exclusion, and the shared metahub optimistic-lock helper still accepted raw dynamic SQL identifiers.
| Area | Resolution |
| --- | --- |
| Applications route boundary | Added `packages/applications-backend/base/src/ddl/index.ts` as the dedicated Tier 3 surface for application schema-sync transport acquisition, DDL service factories, and advisory locks; `applicationSyncRoutes.ts` now consumes that boundary instead of importing `Knex` / calling `getKnex()` directly. |
| Lint enforcement truthfulness | Removed the `applicationSyncRoutes.ts` exclusion from `tools/lint-db-access.mjs`; only the dedicated applications-backend DDL boundary remains excluded as a legitimate transport-owning surface. |
| Optimistic-lock helper safety | `packages/metahubs-backend/base/src/utils/optimisticLock.ts` now routes every dynamic update key through `qColumn(...)`, so malformed identifiers fail closed before any SQL update is constructed. |
| Direct regression proof | Added `packages/metahubs-backend/base/src/tests/utils/optimisticLock.test.ts` to prove quoted update-column generation and malformed identifier rejection; existing applications-backend route/seeding regressions stayed green after the boundary refactor. |
Validation:

- `node tools/lint-db-access.mjs` passed with 0 violations.
- `@universo/applications-backend` lint passed and focused route/seeding regressions passed 17/17.
- `@universo/metahubs-backend` lint remained warning-only with no new errors in the touched files, and focused helper/service regressions passed 9/9.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Final QA Closure Complete

Closed the reopened final QA wave for the Unified Database Access Standardization initiative. The earlier completion claim was incomplete; this closure adds the missing service-level soft-delete/active-row fixes, the remaining Phase 7 evidence, the missing Section 8 architecture docs, and a clean final acceptance run.
| Area | Resolution |
| --- | --- |
| Metahub hubs service | `MetahubHubsService` now enforces `_upl_deleted = false AND _mhb_deleted = false` across list/lookups/count/update prefetch, and delete uses metahub soft-delete metadata instead of hard delete. |
| Enumeration values service | `MetahubEnumerationValuesService` now fails closed on soft-deleted values for read/update/delete flows and preserves reorder normalization on the remaining active values. |
| Direct regression proof | New service-level tests prove the hubs and enumeration-values SQL contracts directly, closing the gap left by route tests that mocked the services. |
| Remaining Phase 7 evidence | Added binding-safety regression coverage, optional real-Postgres executor tests for pinned-connection claims / pool isolation / advisory-lock serialization, and auth-side RLS claim isolation tests. |
| Section 8 architecture docs | Added `docs/en/architecture/database-access-standard.md` plus the Russian counterpart, updated both `docs/*/SUMMARY.md`, and aligned the touched package READMEs with the unified access standard. |
Validation:

- `node tools/lint-db-access.mjs` passed with 0 violations.
- `@universo/metahubs-backend` lint ended warning-only and tests passed 222/225 with 3 expected skips.
- `@universo/database` lint ended warning-only and tests passed 112/121 with 9 expected skips.
- `@universo/auth-backend` lint ended warning-only and tests passed 8/8.
- `pnpm docs:i18n:check` passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-14 Unified Database Access Standardization — Phases 1–4 + QA Remediation Complete

Implemented the Unified Database Access Standardization plan (Phases 1–4) plus a full QA Remediation Wave. Converted the backend from mixed KnexClient/Knex.Transaction usage to the canonical DbExecutor/SqlQueryable pattern for the covered domain surfaces. This milestone was later reopened by follow-up QA and fully closed in the later 2026-03-14 residual-debt entry above.

**Phase 1 (Foundation):** Created queryMany/queryOne/queryOneOrThrow typed query helpers in `@universo/utils/database`, safe identifier helpers (qSchemaTable) in `@universo/database`, advisory lock helpers, transaction helpers, getPoolExecutor factory, and lint enforcement script. 271 foundation tests passing.

**Phase 2 (Metahubs-backend):** Converted all 8 service constructors from KnexClient.getInstance() to DbExecutor injection. Updated 68 route handler constructor call sites. Rewrote 10+ copy transaction test stubs from Knex builder chains to SqlQueryable trx mocks. Fixed schema name validation in all test suites. Removed KnexClient from production code. 31/31 test suites (215 tests), 0 lint errors.

**Phase 3 (Applications-backend):** Converted ApplicationSchemaStateStore from KnexClient to getKnex(). 84/84 tests passing.

**Phase 4 (Auth/Core-backend):** Converted core-backend createKnexExecutor call sites to getPoolExecutor. All 4 backend packages build clean.

**QA Remediation Wave:** Addressed all 60 lint violations and 3 unfinished plan items. Created 6 DDL pool wrappers (acquirePoolAdvisoryLock, releasePoolAdvisoryLock, hasPoolRuntimeHistoryTable, createPoolTemplateSeedCleanupService, createPoolTemplateSeedMigrator, poolKnexTransaction). Migrated advisory locks in 5 route files. Converted publicationsRoutes.attachLayoutsToSnapshot and metahubMigrationsRoutes migration-list reads from Knex builder to raw SQL via getPoolExecutor. Fixed sets copy TOCTOU race condition (retry-inside-transaction pattern). Added RETURNING id to 3 batch copy INSERTs (catalogs elements, enumerations values, layouts widgets). Updated 11 test file DDL mocks. Deleted KnexClient deprecated wrapper.

**Validation:** lint-db-access 0 violations. 31/31 test suites (215 tests) metahubs-backend. 19/19 (214 tests) utils. 4/4 (57 tests) database. Full workspace build 27/27 packages successful.

This intermediate milestone was later extended through Phase 5 hardening, Phase 7 proof, Section 8 docs, and the final residual-debt closure. Only optional Phase 6 (materialized views) remains intentionally deferred.
## 2026-03-14 Unified Database Access Standardization — Plan Completion Audit Complete

Ran a final repository-level truthfulness audit against the implementation plan after all closure waves had already landed. The audit confirmed that the repository contains the required CI lint step, architecture docs, bilingual checklist pages, `getPoolExecutor()` rollout, and the dedicated applications-backend DDL boundary, so no additional mandatory implementation gap remained.
| Area | Outcome |
| --- | --- |
| Plan truthfulness | `memory-bank/plan/unified-database-standard-plan-2026-03-14.md` now reports the initiative as implemented instead of awaiting approval. |
| Status alignment | `tasks.md` and `activeContext.md` now describe the database-standard initiative as closed rather than reopened. |
| Scope confirmation | The only intentionally unimplemented item is optional Phase 6 (materialized views), which was already evaluated and deferred by the plan itself. |
Validation:

- Repository audit confirmed the expected implementation artifacts in code, docs, and CI.
- A fresh `node tools/lint-db-access.mjs` rerun still returned 0 violations after the status sync.
- No new source-code changes were needed beyond status/document truthfulness updates.
- The latest recorded acceptance remains `node tools/lint-db-access.mjs` = 0 violations and root `pnpm build` = 27/27 successful tasks.
## 2026-03-13 Metahub Frontend Regression Reopen Closure

Closed the metahub frontend regression reopen that surfaced after the earlier shared-table and hub-settings QA waves had already been marked complete. This narrow follow-through restored deep-view Settings continuity, hardened shared confirm delayed-render behavior for detached hub-entity creation, and brought optimistic publication row interaction feedback back to parity with the existing pending card path.
| Area | Resolution |
| --- | --- |
| Deep-view Settings continuity | `ElementList` now exposes hub Settings again, and `PublicationApplicationList` keeps publication Settings reachable from the applications subview by reusing the existing publication settings dialog flow. |
| Detached-create confirmation rendering | Shared `useConfirm` fallback timing now tolerates delayed dialog mount, and `ConfirmDialog` exposes an extra request-id marker so detached-create warnings no longer auto-cancel before the dialog renders. |
| Optimistic publication feedback parity | `FlowListTable` and `FlowListTableDnd` now intercept blocked pending-row interactions across custom row content, so optimistic publication rows show the same blocked-click glow/spinner feedback path as other optimistic entities. |
| Direct regression proof | `PublicationApplicationList.test.tsx` proves Settings stays reachable from the applications subview, `useConfirm.test.tsx` proves delayed dialog mount no longer auto-cancels early, and `FlowListTable.test.tsx` proves pending feedback can be triggered from custom row cells. |
Validation:

- `PublicationApplicationList.test.tsx` passed 3/3.
- Touched `@universo/template-mui` tests passed 6/6.
- Touched `@universo/template-mui` and `@universo/metahubs-frontend` lint runs ended warning-only with no errors.
- `@universo/template-mui` build passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-13 System App Migration Documentation

Created missing documentation for the system app migration lifecycle, schema update workflow, and CLI commands.
| Area | Work Done |
| --- | --- |
| Architecture page | `docs/en/architecture/system-app-migration-lifecycle.md` + RU translation. Covers bootstrap sequence, diff engine change types, migration storage JSON format, synthetic entity generation, ensure vs apply semantics, and the shared pipeline diagram. |
| Practical guide | `docs/en/guides/updating-system-app-schemas.md` + RU translation. Step-by-step instructions for adding, modifying, and removing fields/tables in SystemAppDefinition manifests. |
| admin-backend README | Added "Platform Schema Definition" section explaining the manifest-driven schema approach in both EN and RU READMEs. |
| migrations-platform README | Added "System App Schema Management" and "CLI Commands" sections in both EN and RU READMEs. |
| Navigation | Updated SUMMARY.md, guides/README.md, and architecture/README.md in both languages. |
## 2026-03-13 Optional Global Catalog QA Reopen Follow-Through Closure

Closed the residual debt left after the earlier optional global catalog QA closure was re-reviewed. This narrow reopen wave hardened public profile updates and deletes at the controller/store boundary, corrected runtime-origin release-bundle lineage to follow the actual installed release contract, and removed the touched local SQL identifier quoting fork.
| Area | Resolution |
| --- | --- |
| Profile public update/delete hardening | `PUT /profile/:userId` and `DELETE /profile/:userId` now fail closed for cross-user requests before RLS is reached, public update payloads reject unsupported fields, and persistence only updates an explicit allowlist of columns. |
| Direct regression proof | `profileController.test.ts` now proves cross-user update/delete rejection and malformed payload rejection, while `profileService.test.ts` proves unsupported fields never reach SQL update construction. |
| Runtime bundle lineage correctness | Runtime release-bundle export now chooses the incremental base snapshot from the installed release semantics: advancing from an installed release uses `releaseSchemaSnapshot`, while unchanged application-origin bundle re-exports keep stored `baseSchemaSnapshot` lineage. |
| Shared helper reuse | The touched runtime snapshot loaders now use `@universo/migrations-core` identifier helpers instead of a private regex-based `quoteIdentifier` implementation. |
Validation:

- `@universo/profile-backend` tests passed 25/25.
- `@universo/profile-backend` lint passed.
- `@universo/applications-backend` tests passed 84/84.
- `@universo/applications-backend` lint passed.
- Final root `pnpm build` passed with 27/27 successful tasks.
## 2026-03-13 Optional Global Catalog QA Follow-Through Closure

Closed the last open QA follow-through findings without reopening unrelated metahub or startup work. This wave hardened profile ownership end to end and upgraded application release bundles from checksum-protected snapshots to true lineage-aware incremental artifacts.
| Area | Resolution |
| --- | --- |
| Profile ownership security | `POST /profile` no longer trusts request-body `user_id`; controller logic now fails closed on cross-user attempts, and the profile INSERT policy is limited to `auth.uid() = user_id`. |
| Direct regression proof | `profileController.test.ts`, `platformMigrationsSecurity.test.ts`, and the touched profile service expectations now prove the self-only creation and delete-audit path directly. |
| Incremental release artifact contract | `application_release_bundle.incrementalMigration` now carries `baseSchemaSnapshot` plus a precomputed `diff`, and bundle validation recomputes that diff against the embedded target payload. |
| Release apply/export lineage | Application-origin export now requires trusted base-snapshot lineage, and upgrade apply rejects tracked-schema mismatches instead of recalculating opportunistic diffs from current target state. |
Validation:

- `@universo/profile-backend` tests passed 21/21.
- `@universo/profile-backend` lint passed.
- `@universo/applications-backend` tests passed 84/84.
- `@universo/applications-backend` lint passed.
- Final root `pnpm build` passed.
## 2026-03-13 Metahub QA Final Closure
## 2026-03-13 Metahub QA Shared-Table Final Reopen Closure

Closed the last remaining defect found by the post-closure QA pass in the metahub/shared-table slice. The residual issue was not the filtered render path anymore, but a deeper DnD contract mismatch: when callers supplied external `sortableItemIds`, the table could render rows in explicit column-sort order while `SortableContext` still kept the pre-sort external order.
| Area | Resolution |
| --- | --- |
| Shared table DnD ordering contract | `FlowListTable` now derives final `SortableContext` ids from the visible filtered/sorted row sequence and only uses external `sortableItemIds` as the allowed DnD membership set. |
| Direct proof | `FlowListTable.test.tsx` now proves `sortableItemIds + sortableRows + filterFunction + column sort`, asserting both the rendered DOM row order and the captured sortable item ids reorder together. |
| Final validation | The targeted shared-table Jest suite passed 4/4 again, `@universo/template-mui` lint returned to its pre-existing warning-only state with no new errors, and the final root `pnpm build` passed. |
Validation:

- `FlowListTable.test.tsx` passed 4/4.
- `@universo/template-mui` lint is warning-only with no errors.
- Root `pnpm build` passed.
## 2026-03-13 Metahub QA Final Closure

Closed the last QA-found debt in the metahub/shared-table slice after the earlier follow-up remediation wave had been marked complete too early. This final closure repaired the remaining `sortableRows` filtering contract in the shared table, aligned the backend query-builder helper with the branch-schema active-row contract, added direct regression proof for both, and removed the final package-local error-level lint blocker surfaced during revalidation.
| Area | Resolution |
| --- | --- |
| Shared table filtering contract | `FlowListTable` now filters the sorted row set before render, empty-state/header decisions, and sortable DnD id derivation when `sortableRows` is enabled. |
| Backend active-row consistency | `MetahubAttributesService.getAllAttributes(...)` now applies `_upl_deleted = false AND _mhb_deleted = false` before ordering. |
| Direct proof | `FlowListTable.test.tsx` now proves `filterFunction + sortableRows`, and `MetahubAttributesService.test.ts` now proves active-row filtering on the query-builder path. |
| Lint closure during revalidation | The remaining error-level Prettier failure in `@universo/template-mui` `src/hooks/optimisticCrud.ts` was cleared so package lint returned to warning-only status. |
Validation:

- `MetahubAttributesService.test.ts` passed 4/4.
- `FlowListTable.test.tsx` passed 4/4.
- `HubList.settingsReopen.test.tsx` passed 1/1.
- `@universo/template-mui` lint is warning-only with no errors.
- `@universo/metahubs-backend` lint remained warning-only on the touched validation pass.
- Root `pnpm build` passed.
## 2026-03-13 Metahub QA Follow-Up Remediation Closure

Closed the remaining debt left by the direct QA review of the metahub/shared-table refactor wave. This follow-up completed the missing branch-schema active-row filtering in hot attribute reads, added direct regression evidence for hub settings reopen and shared sortable-row behavior, and removed the shared Jest bootstrap blocker that had previously hidden the table-level proof.
| Area | Resolution |
| --- | --- |
| Runtime attribute read contract | `MetahubAttributesService` now applies `_upl_deleted = false AND _mhb_deleted = false` consistently across the remaining hot raw-SQL and query-builder read paths. |
| Hub settings reopen proof | `HubList.settingsReopen.test.tsx` now proves `HubList` reopens edit settings from one-shot router state and clears that state via replace navigation. |
| Shared table sorting proof | `FlowListTable.test.tsx` now proves explicit column sorting still reorders rows correctly when `sortableRows` is enabled. |
| Shared Jest bootstrap | `@universo/template-mui` no longer proxies all `.json` files through `identity-obj-proxy`, so dependencies like `ci-info/vendors.json` load correctly during package-local test execution. |
Validation:

- metahubs-backend focused regressions passed 77/80 with 3 expected skips;
- metahubs-frontend focused regressions passed 2/2;
- `@universo/template-mui` `FlowListTable` regression passed 3/3;
- touched package lint is error-free in `@universo/metahubs-backend` and `@universo/metahubs-frontend`;
- root `pnpm build` passed.
## 2026-03-13 Metahub Post-Refactor Regression Closure

Closed the four live metahub regressions that appeared after the global refactor. The failures were split across shared frontend infrastructure, hub-scoped navigation continuity, shared table behavior, and backend request-scoped SQL boundaries.
| Area | Resolution |
| --- | --- |
| Settings-tab continuity | `CatalogList`, `SetList`, and `EnumerationList` now expose the hub-scoped Settings tab again and navigate back through `HubList` state to reopen the hub settings dialog. |
| Warning confirmation flow | Redundant metahub-page `ConfirmContextProvider` wrappers were removed so page-level `useConfirm()` calls use the root dialog/provider pair mounted in the shared layout. |
| Attribute sorting | `FlowListTable` now keeps sortable headers active even when `sortableRows` is enabled and preserves DnD order until the user explicitly selects a sortable column. |
| Backend 500/pool exhaustion | Hot metahub read/count methods on the catalog and attribute page path now use `MetahubSchemaService.query(...)` instead of global Knex pool acquisition under RLS. |
| Type compatibility after raw SQL refactor | `MetahubObjectsService` now exposes an explicit compatible object-row contract again so routes and snapshot serializers do not collapse to `{}` after the service-level raw-SQL change. |
Validation:

- direct Vitest regression for `ChildAttributeList.optimisticCreate` passed 1/1;
- metahubs-backend route regressions for `attributesRoutes` and `catalogsRoutes` passed 37/37;
- touched package builds passed for `@universo/template-mui`, `@universo/metahubs-frontend`, and `@universo/metahubs-backend`;
- root `pnpm build` passed.
Residual validation note:

- the targeted `@universo/template-mui` Jest run for `FlowListTable.test.tsx` is currently blocked by an existing pre-test bootstrap failure in the shared Jest stack (`vendors.map is not a function` from `ci-info`), so package build plus downstream integration validation remains the current acceptance signal for that shared-table path.
## 2026-03-13 Repeated-Start Stability Closure

Closed the last live regression in fixed system-app repeated startup. The first clean bootstrap was already green, but the second startup failed because the fixed-system snapshot reader rejected a valid local snapshot shape that schema-ddl had written intentionally.
| Area | Resolution |
| --- | --- |
| Root cause | `readLatestSystemAppSnapshot` in `packages/universo-migrations-platform/base/src/systemAppSchemaCompiler.ts` incorrectly validated `snapshotAfter.entities` as an array. |
| Canonical contract | `SchemaSnapshot.entities` is a record/object map in `packages/schema-ddl/base/src/types.ts`, and the same shape is emitted by `packages/schema-ddl/base/src/snapshot.ts`. |
| Live failure mode | First startup wrote a valid local `_app_migrations` snapshot, but second startup rejected that valid snapshot as malformed and failed closed. |
| Regression debt | `systemAppSchemaCompiler.test.ts` still used stale array-shaped snapshot fixtures and outdated `applyAllChanges` expectations, so the suite stayed green while the live repeated-start path was broken. |
| Fix | The snapshot reader now accepts the canonical record-shaped payload, stale regressions were updated, and a dedicated repeated-start regression was added. |
Validation:

- `@universo/migrations-platform` full suite passed 105/105.
- Focused lint on the touched package passed.
- Touched package build passed.
- Root `pnpm build` passed.
- Second live `pnpm start` stayed healthy.
- `curl -I http://127.0.0.1:3000/` returned `HTTP/1.1 200 OK`.
Impact:

- Fixed application-like system apps now reuse valid local `_app_migrations` snapshots across repeated starts.
- Acceptance for future startup work in this area now requires a real second startup, not only focused compiler tests.
## Optional Global Catalog Final Integrity Closure COMPLETE (2026-03-13)

Closed the last integrity debt that remained after the renewed QA re-check. This wave fixed delete-cascade ordering, replaced existence-only startup shortcuts with canonical local-history-driven evolution, and hardened shared schema-ddl apply behavior for fixed-schema upgrades.
| Area | Resolution |
| --- | --- |
| Delete-cascade integrity | `deleteApplicationWithSchema(...)` now soft-deletes `rel_connector_publications` before `cat_connectors`, so active link rows cannot survive connector cleanup order. |
| Fixed-system evolution | `ensureRegisteredSystemAppSchemaGenerationPlans(...)` now reads canonical local `_app_migrations`, computes diff/apply through `SchemaMigrator`, and records real incremental migrations for drift. |
| Shared DDL safety | Recorded apply flows now preserve physical table/column names, explicit SQL defaults/types, capability-gated system tables, and explicit migration names. |
| Artifact hygiene | Accidental generated `.js`, `.d.ts`, and `.d.ts.map` files were removed from `@universo/migrations-core/src`, and package cleanup now removes the same patterns deterministically. |
Validation:

- applications-backend targeted regression passed 9/9.
- schema-ddl targeted regression passed 4/4.
- migrations-platform compiler regression passed 23/23.
- Touched package builds passed.
- Root `pnpm build` passed.
## Optional Global Catalog Strict QA Remediation COMPLETE (2026-03-13)

Closed the last two strict QA gaps in release-bundle provenance and Phase 8 executable evidence without reopening unrelated runtime paths.
| Area | Resolution |
| --- | --- |
| Snapshot provenance | Bundle validation now recomputes the embedded snapshot hash instead of trusting `manifest.snapshotHash`. |
| Trusted lineage seam | Install metadata and lineage persistence now flow through the recomputed canonical hash. |
| Phase 8 proof | Direct regressions now cover tampered snapshot hashes, nullable `globalRunId`, disabled-mode local history persistence, and enabled-mode fail-closed mirror aborts. |
| Operating mode safety | Disabled-mode local `_app_migrations` / `_mhb_migrations` history remains canonical, and enabled-mode failures still abort rather than degrading silently. |
Validation:

- applications-backend tests passed 82/82.
- applications-backend lint passed.
- targeted `MigrationManager.test.ts` passed.
- targeted `systemTableMigrator.test.ts` passed.
- applications-backend build passed.
- root `pnpm build` passed.
## Optional Global Catalog True Final Closure Wave COMPLETE (2026-03-13)

Release bundles now carry deterministic executable payloads for both bootstrap and incremental execution, and apply consumes those payloads directly.
| Area | Resolution |
| --- | --- |
| Executable artifact contract | Both `bootstrap` and `incrementalMigration` now embed deterministic executable payloads plus canonical schema snapshots. |
| Real execution path | Fresh installs execute from `bootstrap.payload.entities`; upgrades reconcile from `incrementalMigration.payload.entities`. |
| Fail-closed import | Corrupted executable artifact checksums now fail with `400 Invalid release bundle` before schema execution starts. |
| Persistence boundary | The central `installed_release_metadata` seam in `applications.cat_applications` remains unchanged. |
Validation:

- applications-backend tests passed 80/80.
- applications-backend lint passed.
- root `pnpm build` passed.
## Optional Global Catalog Final Debt Closure Wave COMPLETE (2026-03-13)

Closed the last ambiguous baseline-apply gap and added direct evidence for disabled-mode mirror behavior.
| Area | Resolution |
| --- | --- |
| Existing-schema guard | Baseline bundle apply now fails when a target already has `schema_name` but lacks trusted `installed_release_metadata`. |
| Fresh-install boundary | Fresh installs remain on the baseline/bootstrap path when no runtime schema exists. |
| Disabled-mode regression | `mirrorToGlobalCatalog(...)` now has direct regression proof that disabled mode returns `null` and performs no catalog writes. |
| Route-level fail-closed proof | Existing-schema/no-lineage bundle apply now fails before schema existence, diff, or apply execution begins. |
Validation:

- applications-backend tests passed 77/77.
- applications-backend lint passed.
- migrations-catalog tests passed 37/37.
- migrations-catalog lint passed.
- root `pnpm build` passed.
## Optional Global Catalog Final Closure Wave COMPLETE (2026-03-13)

Closed the last semantic gap in application-origin release-bundle export and verified the live runtime path from this workspace.
| Area | Resolution |
| --- | --- |
| Application-origin lineage | Runtime-origin export now preserves a real prior-version -> new-version transition for upgrade bundles. |
| Canonical runtime parity | Runtime export reconstructs top-level set constants and canonical snapshot data from `_app_*` metadata/data sources. |
| Executable proof | Direct regressions now cover runtime-origin upgrade apply, unchanged runtime re-export lineage reuse, and the baseline empty-install fast path. |
| Live smoke | Read-only SQL smoke, `pnpm migration:status`, and live `pnpm start` all succeeded from this workspace. |
Validation:

- applications-backend tests passed 76/76.
- applications-backend lint passed.
- root `pnpm build` passed.
- live `pnpm start` returned `pong` on `/api/v1/ping`.
## Optional Global Catalog Architecture Closure COMPLETE (2026-03-13)

The optional global catalog/runtime migration architecture is now closed across startup, runtime, CLI, and operator documentation.
| Area | Resolution |
| --- | --- |
| Shared helper adoption | Remaining raw `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` parsing was replaced with the shared `@universo/utils` helper. |
| Application-owned export | `@universo/applications-backend` can now export canonical release bundles directly from existing application runtime state. |
| Canonical local history | `_app_migrations` and `_mhb_migrations` remain canonical in disabled mode, while enabled mode remains fail-closed on mirror failure. |
| Operator docs | Mirrored English/Russian architecture docs were published and linked from the docs navigation with verified parity. |
Validation:

- utils, core-backend, applications-backend, and migrations-platform focused validation passed.
- touched lint passed on the relevant packages.
- root `pnpm build` passed.
## QA Remnant Fix Wave COMPLETE (2026-03-13)

Closed the last four findings from the comprehensive QA analysis without reopening unrelated architecture work.
| Area | Resolution |
| --- | --- |
| ApplicationSchemaStateStore | `.table('applications')` became `.table('cat_applications')` and active-row filtering now requires both `_upl_deleted = false` and `_app_deleted = false`. |
| Error-level formatting debt | Six Prettier failures in metahubs-backend were resolved on the touched path. |
| globalAccessService active-row safety | Three UPDATE statements and one SELECT gained `activeAppRowCondition()` filtering. |
| Dead code removal | The duplicate metahubs-side `ConnectorSyncTouchStore.ts` and its test were removed. |
Validation:

- metahubs-backend tests passed.
- admin-backend tests passed.
- touched lint is error-free.
- root `pnpm build` passed.
## QA Blocker Closure Wave COMPLETE (2026-03-13)

Closed the last reproducible red validation surfaces without weakening actual runtime contracts.
| Area | Resolution |
| --- | --- |
| Managed-owner validation | The failing migrations-core test now uses a canonical UUID; runtime validation remains strict. |
| Lint scope hygiene | `@universo/migrations-core` lint now ignores committed/generated `src/**/*.d.ts` output and evaluates real implementation sources. |
| schema-ddl touched lint debt | The remaining touched error-level formatting failure was removed from schema-ddl. |
| core-backend lint gate | A package-level lint script exists again and the touched error-level formatting debt is gone. |
Validation:

- migrations-core tests/lint passed.
- schema-ddl tests passed and lint is warning-only.
- core-backend tests passed and lint is warning-only.
- root `pnpm build` passed.
## Final QA Closure Wave COMPLETE (2026-03-13)

Closed the last repository-side gaps that the renewed QA pass found in the system-app completion program.
| Area | Resolution |
| --- | --- |
| Manifest-to-DDL parity | Profile `nickname` and admin role `codename` now cap validation at `VARCHAR(50)` parity, and shared tests assert that manifest `maxLength` never exceeds declared `VARCHAR(N)`. |
| Copy persistence coverage | applications-backend now has direct persistence regression coverage for `copyApplicationWithOptions(...)`, including copied-access guards and propagated failures. |
| Executable bootstrap proof | The core-backend publication-to-application acceptance regression now also asserts the fixed fresh-bootstrap contract for all application-like system schemas. |
| Architecture docs parity | Mirrored docs for fixed system-app convergence were published with verified English/Russian line parity. |
Validation:

- profile, admin, applications persistence, migrations-platform, and core-backend acceptance suites passed.
- applications-backend and migrations-platform lint are error-free.
- touched profile/admin/core lint is warning-only.
- root `pnpm build` passed.
## QA Closure Completion Wave COMPLETE (2026-03-13)

Closed the remaining operational debt around export lifecycle recording, browser env compatibility, dependency-aware drift detection, and managed owner-id hardening.
| Area | Resolution |
| --- | --- |
| Bundle export lifecycle parity | `@universo/migrations-platform` now records `definition_exports` rows for bundle-oriented catalog exports. |
| Browser env precedence | The browser env entry now resolves `__UNIVERSO_PUBLIC_ENV__` -> `import.meta.env` -> `process.env` -> browser origin, and `@universo/store` mirrors the same fallback. |
| Dependency-aware drift | `@universo/migrations-catalog` and `@universo/migrations-platform` now compare stable artifact payload signatures instead of SQL text alone. |
| Managed owner-id hardening | Managed schema names now accept only canonical UUID or 32-character lowercase hex owner ids. |
Validation:

- migrations-catalog tests passed 28/28.
- migrations-platform regressions passed 64/64.
- utils env tests passed 5/5.
- migrations-core identifier tests passed 8/8.
- touched lint/build passed.
- root `pnpm build` passed.
## Definition Lifecycle Closure Wave COMPLETE (2026-03-13)

The live DB/file definition lifecycle now runs through the real draft -> review -> publish contract instead of bypassing it in operational paths.
| Area | Resolution |
| --- | --- |
| Lifecycle-aware imports | `importDefinitions()` now creates drafts, requests review, and publishes when needed instead of bypassing lifecycle helpers. |
| Provenance repair | `registerDefinition()` now preserves or merges published lifecycle provenance for created, updated, and unchanged revisions. |
| No-op and doctor safety | Bulk lifecycle checks now require published provenance in addition to checksum/export parity, so pre-fix direct-import rows are repaired once. |
| File import semantics | Raw JSON imports are now persisted as file-sourced lifecycle imports. |
Validation:

- migrations-catalog tests passed 34/34.
- migrations-platform tests passed 98/98.
- touched lint/build passed.
- root `pnpm build` passed.
## QA Deep Remediation Wave 2 COMPLETE (2026-03-13)

The second deep QA pass closed the remaining cross-package dual-flag and cascade delete gaps.
| Area | Resolution |
| --- | --- |
| applicationQueriesStore dual-flag parity | Nine touched query helpers across applications catalog tables now use `activeAppRowCondition()`. |
| Metahub cascade delete ordering | `doc_publication_versions` now soft-delete before `doc_publications` in metahub cascade delete. |
| Publication delete ordering | Individual publication delete now also soft-deletes publication versions before the publication row. |
| Stats endpoint filtering | Touched inline stats queries now ignore deleted rows through active-row predicates. |
Validation:

- focused regressions passed in applications-backend and metahubs-backend.
- touched route/store assertions were updated.
- root `pnpm build` passed.
## QA Final Remediation Wave 1 COMPLETE (2026-03-13)

Closed the first final QA set of dual-flag and migration idempotency defects.
| Area | Resolution |
| --- | --- |
| Metahub cascade dual-flag | Child rows now receive both `_upl_deleted` and `_app_deleted` fields during cascade delete. |
| rolesStore active-row parity | `countUsersByRoleId()` and `listRoleUsers()` now use `activeAppRowCondition()`. |
| templatesStore active-row parity | `findTemplateById()` now filters on both `_upl_deleted = false` and `_app_deleted = false`. |
| Migration idempotency | Five bare `ALTER TABLE ADD CONSTRAINT` statements are wrapped with `IF NOT EXISTS` guards. |
Validation:

- focused admin-backend, metahubs-backend, and migrations-platform checks passed.
- regression tests were added or updated.
- root `pnpm build` passed.
## QA Follow-up Remediation Closure COMPLETE (2026-03-13)

Closed the follow-up QA issues found after the earlier cutover/build-green milestone.
| Area | Resolution |
| --- | --- |
| Memory-bank accuracy | tasks.md and activeContext.md were reopened and resynchronized with the real remediation state. |
| Auth/profile active-row safety | touched auth/profile read and update flows now require active rows and target the correct partial unique index. |
| Admin/profile active-row safety | `globalAccessService.ts` now uses the converged direct dual-flag predicate for the touched profile search/hydration paths. |
| Compensation-test stability | publication compensation tests now assert full cleanup behavior instead of brittle SQL call ordering. |
Validation:

- auth-backend lint/test passed.
- admin-backend lint/test passed.
- targeted metahubs-backend regressions passed.
- root `pnpm build` passed.
## QA-Discovered Store/Service Layer Fixes COMPLETE (2026-03-13)

Post-implementation QA showed that while DDL was converged, parts of the persistence layer still referenced pre-convergence columns and single-flag delete logic.
| Area | Resolution |
| --- | --- |
| Column-name convergence | Touched admin/profile/app stores, services, routes, and frontend types now use `_upl_created_at` / `_upl_updated_at` instead of stale names. |
| Dual-flag active-row parity | Touched SQL paths now use `activeAppRowCondition()` instead of `_upl_deleted = false` alone. |
| Soft-delete parity | The profile delete path now uses `softDeleteSetClause()` instead of physical `DELETE FROM`. |
| Shared helper exposure | The root `@universo/utils` barrel now exports the canonical touched helper surface. |
Validation:

- touched files across backend, frontend, shared utils, and tests were updated.
- contract regressions were aligned.
- root `pnpm build` passed 27/27.
## Ownership And Validation Closure Wave COMPLETE (2026-03-12)

Closed the final post-QA implementation debt around publication/runtime sync ownership, repeatable backend tests, and live startup HTTP serving.
| Area | Resolution |
| --- | --- |
| Publication/runtime seam | metahubs-backend now exposes only publication runtime source loading; applications-backend owns application sync-context adaptation; core-backend composes the seam. |
| Repeatable backend tests | A shared Jest wrapper now forwards CLI args correctly for backend package test runs. |
| Live startup behavior | `pnpm start` now completes bootstrap successfully and the workspace serves HTTP on port 3000. |
| Final validation | Focused backend/platform validation and the root build are green. |
## QA Debt Closure Wave COMPLETE (2026-03-12)

Revalidated the previously reported debt and fixed only the still-real residual issues.
| Area | Resolution |
| --- | --- |
| QA revalidation | The earlier suspected compiler blocker no longer reproduced, so this wave stayed focused on real remaining debt. |
| SQL row-shape hardening | Touched admin/profile stores now use explicit `RETURNING column_list` contracts instead of `RETURNING *`. |
| Soft-delete and cleanup parity | Admin revocation and metahub compensation cleanup now follow the converged soft-delete contract. |
| Frontend tooling cleanup | The shared MUI template SCSS entrypoint now uses Sass `@use` instead of deprecated `@import`. |
Validation:

- targeted backend validation passed.
- touched frontend tooling remained green.
- root `pnpm build` passed.
## System-App Definition Cutover And QA Closure COMPLETE (2026-03-12)

Fixed application-like system apps now bootstrap through definition-driven schema-ddl plans, while phased support migrations keep only auxiliary setup that schema-ddl does not express.
| Area | Resolution |
| --- | --- |
| Bootstrap source of truth | applications, profile, admin, and metahubs now create/sync business tables through registered schema generation plans. |
| Manifest cleanup | Active fixed-system manifest chains now keep phased support migrations plus required auxiliary setup only. |
| Predicate/security convergence | Touched cross-schema joins and runtime routes now use direct dual-flag active-row predicates, and touched `SECURITY DEFINER` helpers now enforce deterministic execute privileges. |
| Regression coverage | Registry, compiler, startup orchestration, manifest parity, soft-delete parity, and security tests were aligned with the definition-driven path. |
Validation:

- focused migrations-platform, core-backend, profile-backend, admin-backend, applications-backend, and metahubs-backend suites passed.
- root `pnpm build` passed.
## Startup Runtime Regression Remediation COMPLETE (2026-03-13)

Closed the repeated-start performance and no-op regression discovered after the structural convergence rollout.
| Area | Resolution |
| --- | --- |
| Metadata fast path | `systemAppSchemaCompiler` now skips fixed metadata sync when the live metadata fingerprint already matches the compiled target state. |
| Drift recovery | The previous bootstrap path remains the fallback whenever tables, metadata rows, or fingerprints drift. |
| Catalog fast path | Bulk registry/export preflight now skips `registerDefinition()` and export-row writes for unchanged artifacts on repeated startup. |
| Regression coverage | Focused tests prove no-op startup behavior and drift fallback on both the metadata and catalog sides. |
Validation:

- focused migrations-platform/core-backend validation passed.
- root `pnpm build` passed.
## Frontend Acceptance Coverage Burst COMPLETE (2026-03-12)

Page-level acceptance coverage now exists across the main user-facing CRUD, navigation, sync, and migration-guard flows.
| Area | Resolution |
| --- | --- |
| CRUD/list coverage | Application, metahub, connector, and publication pages now prove create/edit/copy/delete payload routing through existing shells. |
| Navigation coverage | Connector detail navigation, application control-panel navigation, and publication-linked application entry flows are covered directly. |
| Sync coverage | Connector/publication diff dialogs, sync mutations, `ConnectorBoard`, `PublicationList`, and `MetahubMigrations` all have direct user-facing acceptance proof. |
| Guard coverage | `ApplicationMigrationGuard` and `MetahubMigrationGuard` now have route-level and interactive acceptance coverage for the real user-visible states. |
Validation:

- focused ESLint/Vitest/build checks passed for the touched frontend packages.
- standalone package builds passed on the touched slices.
- root `pnpm build` passed.
## Fixed-System Metadata, Legacy-Reconciliation, and Compiler Foundation Burst COMPLETE (2026-03-12)

The safety and metadata foundations for converged fixed system apps are now in place.
| Area | Resolution |
| --- | --- |
| Metadata observability | Fixed-system bootstrap now reports object and attribute counts, and CLI entry points expose the same bootstrap path. |
| Doctor/startup gates | Platform doctor, sync, and startup now fail fast on incomplete fixed-system metadata or leftover legacy fixed-schema table names. |
| Legacy reconciliation | Forward-only reconciliation bridges now rename or merge legacy profile, admin, applications, and metahubs fixed tables into the converged application-like model. |
| Compiler metadata preservation | Compiled object/attribute artifacts and validation gates now preserve explicit manifest metadata and relation targets. |
Validation:

- focused platform/backend regressions passed.
- standalone package builds on the touched slices passed.
- root `pnpm build` passed.
## Registry and Master-Plan Foundation Burst COMPLETE (2026-03-11)

The registry, lifecycle, and ownership foundations that later waves built on were completed earlier in the session and remain relevant.
| Area | Resolution |
| --- | --- |
| Runtime sync ownership | Application runtime sync routes are application-owned, with metahubs-backend providing publication context only. |
| Definition lifecycle | Draft/review/publish/export/import flows, approval-event persistence, and canonical bundle behavior are real operational contracts. |
| Doctor/bootstrap visibility | Startup and doctor report missing lifecycle/export state explicitly instead of relying on silent assumptions. |
| Shared schema naming | Managed application and metahub schema naming moved to shared helpers, removing local builder drift. |
Validation:

- focused migrations-catalog, migrations-platform, applications-backend, metahubs-backend, and core-backend validation passed across the relevant waves.
- root workspace validation finished green on the associated closure waves.
## Older 2026-03-11 to 2026-03-12 Detail Condensed

The older sections from this same implementation cluster were intentionally compressed into the grouped entries above to keep the file within an operational size range while preserving the critical delivered outcomes:

- fixed-system convergence implementation and QA remediation,
- publication/runtime sync ownership transfer,
- registry lifecycle and export recording hardening,
- metadata bootstrap observability and fail-fast gates,
- legacy fixed-schema reconciliation,
- frontend acceptance coverage expansion,
- repeated-start no-op optimization,
- copy/runtime/persistence regression hardening.

Use tasks.md for checklist-oriented summaries and systemPatterns.md for reusable implementation rules. This file keeps the durable outcome record only.
## Fixed-System Compiler Metadata Expansion Burst COMPLETE (2026-03-12)

Before the final repeated-start and convergence closures, the fixed-system compiler pipeline was expanded so `_app_objects` / `_app_attributes` bootstrap no longer depended on thin synthetic defaults alone.
| Area | Resolution |
| --- | --- |
| Rich manifest metadata | Fixed-system manifests now support explicit table presentation, field presentation, validation rules, and UI config on stable business metadata. |
| Remaining manifest expansion | admin, applications, and metahubs now declare richer business metadata and targeted internal REF metadata instead of leaving those details implicit. |
| Compiled artifact integrity | `system_app_compiled.*` now includes deterministic object and attribute artifacts, and validation rejects dropped or malformed metadata. |
| Relation target preservation | Internal REF target metadata now survives into compiler entities and compiled attribute artifacts for fixed system apps. |
| Standalone build hygiene | touched migration packages now resolve workspace dependencies from source when neighbor `dist` output is absent. |
Validation: focused migrations-core/platform plus owner-package backend validation passed, standalone touched-package builds passed, and root `pnpm build` stayed green.
## Legacy Safety and Doctor Gates Burst COMPLETE (2026-03-12)

The platform now fails fast when fixed-system bootstrap or reconciliation leaves the database in an incomplete or mixed physical state.
| Area | Resolution |
| --- | --- |
| Metadata completeness gate | platform doctor, sync, and startup now inspect required `_app_objects` and `_app_attributes` rows for registered fixed system apps. |
| Legacy physical-model gate | startup and doctor now reject leftover legacy fixed-schema table names after reconciliation/bootstrap instead of silently continuing. |
| Forward-only reconciliation bridges | profile, admin, applications, and metahubs fixed schemas now have deterministic forward-only rename/merge bridges into the converged application-like model. |
| CLI/bootstrap observability | fixed-system bootstrap reports object and attribute counts directly and is available through both platform and backend CLI surfaces. |
| Startup failure semantics | startup stops before later sync/doctor assumptions if metadata or physical-table invariants are still broken. |
Validation: focused migrations-platform/core-backend validation plus touched backend regression coverage passed, standalone touched-package builds passed, and root `pnpm build` stayed green.
## Registry + Validation Foundations COMPLETE (2026-03-11 to 2026-03-13)

Earlier 2026-03-11 lifecycle hardening and later 2026-03-13 validation-posture work were intentionally grouped here because they now act as one shared foundation for future reopen decisions.
| Area | Resolution |
| --- | --- |
| Lifecycle governance | Draft/review/publish/export flows, export dedupe, and approval-event persistence are real operational contracts backed by database uniqueness and focused regression coverage. |
| Runtime ownership boundary | Application runtime sync remains application-owned, with metahubs-backend limited to publication runtime context. |
| Doctor/bootstrap health | Registry/export/lifecycle drift is surfaced explicitly instead of being treated as an implicit clean state. |
| Acceptance posture | Startup-sensitive work now requires focused validation plus live second-start/HTTP checks where relevant, and closure claims still end with touched package validation plus a final root `pnpm build`. |
| Fail-closed rule | Malformed snapshot history, ambiguous release lineage, and enabled-mode catalog failures must stay fail-closed instead of silently degrading. |
Validation: focused migrations-catalog/platform, applications-backend, metahubs-backend, and core-backend validation passed across the source waves, and root workspace validation stayed green.
