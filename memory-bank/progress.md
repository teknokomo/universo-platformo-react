# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

## IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
|---------|------|----------|------------|
| 0.62.0-alpha | 2026-05-06 | Dynamic Portal 🌀 | LMS portal runtime MVP, Page entity authoring, Node.js 22 migration |
| 0.61.0-alpha | 2026-04-30 | Hardened Surface 🛡️ | Data-driven entity resource surfaces, runtime workspace management, GitBook docs refresh |
| 0.60.0-alpha | 2026-04-23 | Academic Foundation 🎓 | LMS MVP platform support, application layout management, empty template |
| 0.59.0-alpha | 2026-04-17 | Universal Entities 🧩 | Entity Component Architecture, entity-first transition, i18n refactoring |
| 0.58.0-alpha | 2026-04-08 | Ancient Manuscripts 📜 | Metahub scripting, quiz runtime, General section, shared attributes |
| 0.57.0-alpha | 2026-04-03 | Good Eyesight 🧐 | Playwright E2E coverage, QA hardening, controllers extraction |
| 0.56.0-alpha | 2026-03-27 | Cured Disease 🤒 | JSONB/VLC unification, security fixes, CSRF middleware |
| 0.55.0-alpha | 2026-03-19 | Best Role 🎬 | Bootstrap superuser, admin roles, metapanel dashboard, workspaces |
| 0.54.0-alpha | 2026-03-13 | Beaver Migration 🦫 | Knex.js migration system, system app convergence, optimistic CRUD |
| 0.53.0-alpha | 2026-03-05 | Lucky Set 🍱 | Sets and constants, drag-and-drop ordering, metahub settings |
| 0.52.0-alpha | 2026-02-25 | Tabular Infinity 🤪 | TABLE attribute type, inline editing, NUMBER field improvements |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢 | Enumerations, migration guard, data-driven MainGrid |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️ | Template system, declarative DDL, layout widgets, cloning |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮 | Layouts system, MUI 7 migration, display attributes, VLC support |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏 | Metahub branches, three-level system fields, optimistic locking |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶 | Publication versioning, schema-ddl package, runtime migrations |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊 | Applications modules, metahubs publications, DDD refactoring |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳 | Catalogs functionality, VLC localization, i18n integration |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding wizard, GDPR consent, Yandex SmartCaptcha |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️‍♂️ | Onboarding wizard, start pages i18n, pagination fixes |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯‍♀️ | VLC system, dynamic locales, Flowise 3.x agents integration |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄 | UUID v7 infrastructure, auth-frontend package, dynamic roles |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹 | Admin panel with RBAC, package extraction, global naming refactoring |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿 | Campaigns integration, storages management, useMutation pattern |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷 | Organizations module, projects hierarchy, AR.js quiz nodes |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅 | Agents system, clusters module, OpenAPI 3.1 refactoring |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | Metaverse dashboard, analytics charts, sections refactoring |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | Rate limiting with Redis, i18n refactoring, TypeScript modernization |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown implementation, dependency centralization |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Metaverses module, quiz timer, publication system fixes |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Publication system, Base58 links, access control, role-based permissions |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Canvas versioning, Material-UI template system, UPDL refactoring |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | Passport.js + Supabase hybrid auth, Vitest coverage, AR.js camera mode |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Metaverses architecture, cluster/domain/resource isolation, publication settings |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Resources and entities services, spaces refactoring, CTE queries |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Template modularization, finance module, multiplayer-colyseus integration |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM template extraction, PlayCanvas integration, Kiro IDE config |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Metaverse module MVP, Space Builder, Gemini Code Assist rules |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌 | Space Builder prompt-to-flow, AR.js wallpaper mode, uniks extraction |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️ | UPDL conditional parameters, custom modes system, Russian docs |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️ | MMOOMM modular architecture, laser mining, inventory refactoring |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪 | PlayCanvas MMOOMM stabilization, handler refactoring, ship controls |

---

## Completed: Connector Schema Diff Entity Metrics QA (2026-05-12)

The schema creation preview in the application connector no longer shows misleading `0 fields, 0 elements` summaries for Entity types whose useful preview data is not field/record based.

### Changes Made

- Added generic backend schema diff metrics to publication sync details for Hubs, Pages, Sets, Enumerations, Catalogs, and custom fallback Entity types.
- Kept Catalog summaries as fields/elements while showing Hubs as linked entities, Pages as blocks, Sets as constants, and Enumerations as values.
- Updated the connector schema diff dialog to render metric summaries and a neutral empty preview state instead of forcing every Entity type into Catalog-like field/element text.
- Extended i18n for EN/RU metric labels with pluralization.
- Added backend and frontend regression coverage for the new metric contract and for the absence of misleading `0 fields, 0 elements` text.
- Extended the imported LMS runtime Playwright flow with focused schema diff sanity assertions and screenshot evidence for the metrics preview.

### Validation

- `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
- `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm build`
- `git diff --check`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector QA Closure (2026-05-12)

The post-QA connector and localization closure fixed the remaining contract and preview issues found after the LMS connector/entity localization pass.

### Changes Made

- Added `schemaDiffLocalizedLabels` to the strict backend application settings schema so the generic Connectors tab setting is accepted and persisted, including explicit `false`.
- Added API regression coverage proving the setting is preserved with the rest of sanitized application dialog settings.
- Hardened managed role policy matching so templates such as `memberPolicy` apply even when imported records omit `baseRole`.
- Split connector schema diff field codenames into canonical lookup keys and localized display labels, preventing localized UI labels from breaking preview record value lookup.
- Updated schema diff tests to assert localized Entity type, Entity codename, and field display behavior without relying on ambiguous single-text matches.
- Updated the imported LMS runtime Playwright flow to assert the source-Metahub Workspace isolation copy.

### Validation

- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts guards.test.ts applicationSyncRoutes.test.ts`
- `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
- `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx displayValue.test.ts tabularCellValues.test.tsx`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm build`
- `git diff --check`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector And Entity Localization Remediation (2026-05-12)

The latest manual QA findings from the rebuilt LMS Metahub and application were closed without adding LMS-specific runtime forks or bumping schema/template versions.

### Changes Made

- Updated LMS Page seed generation so Page entities keep stable canonical EN codenames while gaining RU codename VLC values from localized names.
- Made Metahub Settings entity tabs follow Entity constructor ordering from entity type metadata, placing Pages immediately after Hubs without a hardcoded kind list.
- Improved the required Workspace connector schema diff UX by moving the explanatory notice above the disabled enabled switch and rewriting the copy around the source Metahub requirement.
- Added a generic Application Settings `Connectors` tab with a default-enabled option for localized schema diff labels.
- Expanded connector schema diff details to include all transferred Entity types grouped dynamically by Entity metadata, with localized type, entity, and field labels when enabled.
- Added primary-VLC fallback behavior so administrators can switch schema diff labels back to canonical primary text.
- Marked the published app Home menu item active on root application URLs before a concrete section id is present.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and validated bilingual Page codenames.

### Validation

- `pnpm --filter @universo/metahubs-backend test -- templateSeedTransactionScope.test.ts templateManifestValidator.test.ts`
- `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
- `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
- `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-frontend build`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
- Direct JSON contract check for EN/RU Page codenames in `tools/fixtures/metahubs-lms-app-snapshot.json`

## Completed: LMS Runtime Manual QA Remediation (2026-05-12)

The manual QA findings from the freshly rebuilt LMS application were closed without adding LMS-specific runtime branches.

### Changes Made

- Improved the required-Workspace connector diff dialog: required publications now show a disabled enabled switch and explanatory text, while the irreversible acknowledgement checkbox is reserved only for optional admin-initiated Workspace enablement.
- Updated workspace policy validation so required publication policy can force Workspace mode without asking the application administrator for an acknowledgement they cannot act on.
- Added generic runtime value formatting for objects, arrays, localized values, report definitions, and quiz option arrays, preventing `[object Object]` output in grids, details tables, and tabular edit surfaces.
- Restored published-app menu active state for both metadata-selected items and safe URL link items, matching the original MUI dashboard selected-list behavior with `aria-current="page"`.
- Fixed LMS fixture/generator seed localization for class records and strengthened the fixture contract to require EN/RU localized values.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
- Extended unit and browser coverage for required Workspace UX, structured value rendering, active runtime menu state, bilingual fixture integrity, and the imported LMS runtime path.

### Validation

- `pnpm --filter @universo/utils test -- workspacePolicy.test.ts`
- `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
- `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
- `pnpm --filter @universo/apps-template-mui test -- displayValue.test.ts tabularCellValues.test.tsx MenuContent.test.tsx`
- `git diff --check`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/applications-frontend lint`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/utils lint` (existing warnings only)
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/core-frontend build`
- `pnpm --filter @universo/utils build`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/core-backend build`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Roadmap QA Remediation (2026-05-12)

The post-implementation QA pass found and closed the remaining gaps in the iSpring-like LMS roadmap implementation without adding LMS-specific runtime forks.

### Changes Made

- Restricted runtime report execution to saved `Reports` Catalog records by accepting only `reportId` or `reportCodename` at the API boundary.
- Added regression coverage proving inline report definitions are rejected before runtime metadata lookup.
- Added server-side report aggregation execution through safe field metadata and stable public aliases.
- Shared the ordinary runtime Catalog filter between runtime row APIs and report target discovery so registrar-only ledger Catalogs stay hidden from manual/report execution surfaces.
- Added a generic Access tab to application settings for role/capability policy editing through existing MUI settings patterns.
- Updated the isolated app template report API helper to use saved report references and validate aggregation output.
- Extended the LMS imported runtime Playwright flow to execute a saved report from the generated fixture.
- Updated GitBook LMS report docs and memory-bank records with the final saved-report execution contract.

### Validation

- `git diff --check`
- `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts guards.test.ts applicationsRoutes.test.ts`
- `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
- `pnpm --filter @universo/applications-frontend test -- ApplicationSettings.test.tsx`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-frontend lint`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`
- `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: Runtime Report Endpoint Wiring Closure (2026-05-11)

The safe generic runtime report runner is now connected to authenticated application runtime APIs instead of remaining service-only code.

### Changes Made

- Added `POST /applications/:applicationId/runtime/reports/run` for generic `ReportDefinition` execution.
- Resolved report datasource targets from published runtime metadata in `_app_objects` and `_app_attributes`.
- Applied lifecycle and workspace row conditions before report execution.
- Rejected users without `readReports` before touching runtime metadata.
- Added a typed `apps-template-mui` `runRuntimeReport` helper with CSRF and Zod response validation.
- Added route and API helper tests for authorized execution and fail-closed unauthorized access.

### Validation

- `git diff --check`
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts runtimeReportsService.test.ts guards.test.ts`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`

## Completed: LMS Roadmap Role Policies, Widget Metadata Pickers, And Final Validation (2026-05-11)

The iSpring-like LMS roadmap implementation was completed through the remaining role-policy, report authorization, widget authoring, and validation phases without adding LMS-specific runtime forks or bumping the template/schema versions.

### Changes Made

- Added generic application role-policy normalization and effective permission resolution from existing application settings.
- Added `readReports` as a generic application/runtime capability and enforced it fail-closed in the safe runtime report runner.
- Extended the existing widget behavior editor to use metadata-backed section pickers for `records.list` datasources while preserving manual section fallback for advanced cases.
- Reused the existing layout authoring and behavior dialog for details tables, title widgets, charts, and overview cards instead of adding LMS-only UI.
- Added TanStack Query optimistic cache rollback coverage for failed layout widget configuration saves.
- Added a no-version-bump guard to the LMS fixture contract for bundle version, snapshot version, structure version, snapshot format version, and unpinned exported template version.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator after the contract update.

### Validation

- `git diff --check`
- `pnpm --filter @universo/types test -- lmsPlatform.test.ts`
- `pnpm --filter @universo/types lint`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/applications-backend test -- guards.test.ts runtimeReportsService.test.ts`
- `pnpm --filter @universo/applications-backend lint`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog.test.tsx ApplicationLayouts.test.tsx`
- `pnpm --filter @universo/applications-frontend lint`
- `pnpm --filter @universo/applications-frontend build`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/apps-template-mui build`
- `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: iSpring-like LMS Roadmap Implementation Slice And Import Runtime Closure (2026-05-11)

The LMS platform roadmap implementation slice expanded the generic contracts, LMS template, generated product snapshot, safe report runtime, docs, and workspace seeding robustness without adding an LMS-specific runtime fork.

### Changes Made

- Added strict shared LMS/platform primitive schemas for resources, sequence policies, lifecycle statuses, workflow actions, role policy templates, report definitions, and acceptance matrix entries in `@universo/types`.
- Expanded the LMS Metahub template with richer Catalog/Page/Set/Enumeration metadata, realistic seeded records, report definitions, development-plan and knowledge-base structures, and generic runtime widget datasource usage.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and strengthened the fixture contract.
- Added `RuntimeReportsService` as a safe V1 report runner over validated published runtime datasource descriptors.
- Hardened imported publication workspace seeding for restored snapshots: dependency ordering includes table child attributes, unresolved references are retried, unique `_seed_source_key` fallback is available, and legacy table-name object ids can resolve seed rows.
- Updated package READMEs and GitBook docs for LMS resource and report model guidance.

### Validation

- `pnpm --filter @universo/types test`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts`
- `pnpm --filter @universo/applications-backend test -- applicationWorkspaces.test.ts runtimeReportsService.test.ts`
- `pnpm --filter @universo/applications-backend build`
- `pnpm --filter @universo/applications-backend lint`
- `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

---

## Completed: Fix start:allclean Database Reset + App.initDatabase Test Repair (2026-05-11)

> Goal: Fix `pnpm start:allclean` which never reset the Supabase database due to `--reset-db` flag being lost in the `run-script-os -> npm` chain. Also fix 5 pre-existing test failures in `App.initDatabase.test.ts`.

### Summary

The `--reset-db` CLI flag was unreachable because `run-script-os` spawns `npm run start:default --reset-db`, and npm without `--` separator does not forward unknown flags. Replaced with `_FORCE_DATABASE_RESET=true` env var. Auth user deletion switched from Supabase Admin HTTP API (timed out ~35s/user) to direct SQL `DELETE FROM auth.users`, reducing reset from 3+ minutes to 4 seconds.

### Changes Made

- **`package.json:30`**: `start:allclean` uses `_FORCE_DATABASE_RESET=true pnpm start`
- **`start.ts`**: Removed dead `--reset-db` flag
- **`startupReset.ts`**: SQL-based `deleteAllAuthUsers(db, authUsers)` via `DELETE FROM auth.users WHERE id = ANY($1::uuid[])`; removed `createSupabaseAdminClient`, `StartupResetEnabledConfig`, `getStartupResetConfig`, `assertPresent`
- **`startupReset.test.ts`**: Removed Supabase Admin mocks; tests verify SQL deletion
- **`App.initDatabase.test.ts`**: Added missing `getPoolExecutor`+`seedTemplates` mocks
- **`start-command.test.ts`**: New test verifying `--reset-db` flag is not exposed
- **`docs/en/`+`docs/ru/`**: Updated `start:allclean` description

---

## Completed: Workspace Policy QA Remediation Hardening (2026-05-10)

Snapshot import fails closed on invalid `runtimePolicy.workspaceMode`. No-Workspace runtime regression stabilized. Playwright flow reuses existing `Title` field definitions and verifies shared runtime rows with `editor` user.

### Changes Made

- Added explicit `runtimePolicy` object validation and `parseWorkspaceModePolicy` to snapshot import
- Added route-level import regression proving invalid workspace policies return `400`
- Strengthened imported-runtime-policy test to assert canonical publication stores required Workspace policy
- Stabilized no-Workspace Playwright flow around existing default `Title` fields

---

## Completed: LMS Workspace Policy Fixture And Import Closure (2026-05-10)

LMS snapshot now requires `runtimePolicy.workspaceMode = "required"`. Snapshot import preserves valid runtime policy when rebuilding canonical publication. Optional no-Workspace sync path remains covered by route tests.

### Changes Made

- Added required Workspace runtime policy injection to LMS product Playwright generator
- Added LMS fixture contract validation for `snapshot.runtimePolicy.workspaceMode === "required"`
- Preserved imported snapshot runtime policy in `metahubsController.importFromSnapshot`
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: Generic Posting Registrar Kind QA Closure (2026-05-10)

Runtime posting movements receive registrar kind from `_app_objects.kind` instead of hardcoding `catalog`. Missing registrar kind fails closed with controlled API error.

### Changes Made

- Added `kind` loading to `resolveRuntimeLinkedCollection`
- Passed `linkedCollection.kind` into posting append/reversal calls as `registrarKind`
- Removed hardcoded `registrarKind: 'catalog'` from posting movement append and reverse flows
- Updated posting movement regressions to prove non-Catalog registrar kinds forwarded to Ledger service

---

## Completed: Catalog-Backed Ledger Schema Templates (2026-05-10)

Ledger schemas support catalog-backed fact attributes with typed fact columns, auto-generated index tables, idempotent DDL, and E2E posting proof. Generic Ledger schema entity constructor supports fixed/dynamic catalog bindings, option-list enumeration columns, and shared validation.

### Summary

Catalog entity type templates now expose the generic `ledgerSchema` capability in the same Entity constructor contract that already drives behavior, scripts, layouts, and field definitions. LMS template models progress, score, enrollment, attendance, certificate, points, activity, and notification registers as Catalog instances with `config.ledger`. These Catalog-backed ledger objects are registrar-only in runtime.

### Changes Made

- Enabled `ledgerSchema` in the standard Catalog entity type definition and added `ledgerSchema` tab to Catalog authoring contract
- Removed default Ledger preset seeding from `basic`, `basic-demo`, and LMS metahub templates; standalone Ledger preset preserved for manual use
- Converted LMS ledger-like objects to `kind: catalog` entities with `config.ledger`, registrar-only source policy, field roles, and projections
- Reused generic Ledger schema UI in standard Catalog create/edit/copy dialogs
- Updated linked-collection backend helpers to validate, persist, copy, and remove `config.ledger` safely
- Kept registrar-only Catalog-backed ledger objects out of ordinary runtime row lists and automatic workspace seed passes

---

## Completed: Ledger Schema QA Closure (2026-05-10)

Ledger runtime access fails closed with controlled API errors for invalid, missing, or unavailable Ledger ids. `config.ledger` references validated in Entity create/update/copy flows and snapshot publication/import paths.

### Changes Made

- Added controlled Ledger id validation and unavailable-ledger errors in runtime Ledger controllers and services
- Enforced strict Ledger config reference validation across frontend authoring, backend CRUD, copy, publication serialization, and snapshot restore
- Removed remaining Ledger kind-only compatibility checks from schema/runtime/workspace/script paths
- Fixed workspace seed type discovery for generated child TABLE JSONB columns
- Fixed Entity dialog action helpers so validation/can-save callbacks tolerate uninitialized form values

---

## Completed: Generic Ledger Schema Entity Constructor Implementation (2026-05-10)

Ledger semantics exposed through generic `ledgerSchema` component contract. Shared types normalize and validate `config.ledger`. Metahub Entity dialog exposes reusable Ledger schema tab. Application layout widgets consume generic `ledger.facts` and `ledger.projection` datasources.

### Changes Made

- Added strict Ledger config schemas, normalizers, component capability helpers, and reference validation to `@universo/types`
- Replaced Ledger kind-only checks in schema generation, published snapshot serialization, runtime Ledger services, scripts, and workspace copy/delete flows with capability-aware gates
- Added generic `LedgerSchemaFields` UI surface wired into shared Entity instance dialog via `ledgerSchema` tab
- Extended Entity type authoring so `ledgerSchema` component settings can be enabled for future compatible custom or hybrid entity types
- Extended application widget behavior editor with generic `records.list`, `ledger.facts`, and `ledger.projection` datasource editing

---

## Completed: Linked Collection Record Behavior QA Fixes (2026-05-09)

The linked-collection preset keeps the Entity constructor contract generic. Script, action, event, and record behavior script lookups use the active route `kindKey` first, falling back to entity kind when no route kind is available. Copy dialogs now include edited `config.recordBehavior` payload.

### Changes Made

- Added linked-collection attachment-kind resolver preferring `routeKindKey` over base entity kind
- Replaced hardcoded Catalog attachment kinds in linked-collection script tabs and record behavior script queries
- Replaced remaining generic Entity list linked-collection script/action/event attachment fallback with resolved active kind key
- Added regression tests for non-Catalog linked-collection script tab attachment and record behavior copy payload preservation

---

## Completed: Entity-Driven Catalog Record Behavior UI (2026-05-09)

Catalog record behavior exposed through generic Entity authoring surface. `behavior` tab appears from entity type `components` plus `ui.tabs`, not from Catalog-only branching. Template path defect fixed: `TemplateManifestValidator` now preserves `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema` instead of stripping them.

### Changes Made

- Added shared `CatalogRecordBehavior` validation and normalization in `@universo/types`
- Reused shared normalizer/schema from schema generation, application runtime services, and `apps-template-mui`
- Added component-driven `behavior` tab in Entity authoring and reusable `RecordBehaviorFields` form
- Persisted `config.recordBehavior` without dropping existing entity config keys
- Added structured constructor controls for `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema`
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: LMS Runtime Datasource QA Closure (2026-05-09)

Integrated published application runtime provides dashboard widgets with active locale, runtime sections, and linked collections. Chart widgets localize MUI Charts empty-data overlay. Backend runtime list validation resolves localized attribute codenames before checking sort/filter fields.

### Changes Made

- Passed `locale`, `sections`, and `linkedCollections` into integrated `DashboardDetailsProvider` data from `ApplicationRuntime`
- Added localized no-data support to shared `SessionsChart` and `PageViewsBarChart` wrappers
- Propagated runtime list `search`, `sort`, and `filters` through production applications frontend adapter/API
- Resolved localized backend attribute codenames in runtime sort/filter validation

---

## Completed: LMS Runtime UX QA Remediation (2026-05-09)

Ledger collections use consolidated `ledgers` i18n namespace in metahub UI. Ledger rows/cards open shared field-definition resource surface. Field-definition tabs and empty-state fallbacks have shared localized keys. Runtime dashboard widget contract accepts localized text for stat-card titles, chart titles, intervals, and series labels.

### Changes Made

- Added `ledgers` to metahub i18n bundle consolidation path
- Extended generic entity instance list so standard Ledger rows open configured data-schema resource surface route
- Added shared and Ledger-specific field-definition i18n keys in English and Russian
- Extended application layout widget schemas to accept localized widget text
- Resolved localized widget text in apps-template dashboard renderer for overview cards and record-series charts
- Suppressed demo chart series whenever configured `records.list` datasource has no rows

---

## Completed: LMS Catalog/Ledger Platform Implementation (2026-05-08)

> Consolidation of 20+ LMS QA/feature closures from 2026-05-08.

**Runtime & Security**: Public guest runtime uses neutral platform aliases (`participantId`, `assessmentId`, `contentNodeId`). Guest session secrets stored as SHA-256 hashes. Application settings preserves server-managed `publicRuntime`/`guestRuntime`. Registrar-only Ledger writes rejected. Bounded guest answer validation.

**Ledger & Posting**: Ledger projection errors return controlled `UpdateFailure` responses. Manual-editable Ledger facts observable through guarded `PATCH`/`DELETE` routes. Reversal idempotency via `_app_reversal_of_fact_id` system column. Runtime section sort/filter state reset on section switch.

**LMS Fixture**: LMS metahub snapshot carries explicit `application.publicRuntime.guest` settings. LMS template seeds lifecycle scripts, bilingual page entities, transactional event catalogs, additional ledger definitions. Generic runtime policy settings, overview card metrics, chart datasource authoring, details table datasource authoring.

**Datasource & Widgets**: Generic metric widgets, runtime datasource tables, generic widget datasource closure. Placeholder configuration cleanup. Posting movement E2E proof with authenticated runtime record commands through real UI action menu.

### Key Changes Made

- Added `ledger` as first-class standard entity kind; shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts
- Added template seed-script support with manifest validation, compilation, checksum storage, and entity attachment resolution
- Added `RuntimePostingMovementService` for movement normalization, target-ledger validation, and Ledger append orchestration
- Added `RuntimeLedgerService` for metadata loading, fact listing, projection queries, append-only writes, idempotent append, and reversal batches
- Added `RuntimeNumberingService` and `RuntimeRecordCommandService` for transactional Catalog record commands
- Added runtime response metadata for `recordBehavior` and posting state fields; `RowActionsMenu` with state chip and command actions
- Added `runtimeDataSources` schemas and types; extended `detailsTableWidgetConfigSchema` with optional `datasource` descriptor
- Added `statCardWidgetConfigSchema` and `overviewCardsWidgetConfigSchema` for generic metric widgets
- Added `records-series` chart widget config; registered chart config validation; updated `MainGrid` to fetch chart records
- Added codename target fields to generic `records.list` and `records.count` datasource schemas
- Added bounded guest answer validation for question count, selected-option count, and session-token length
- Converted Ledger projection service failures to stable 400/404/409 API responses with error codes
- Added guarded Ledger fact `PATCH` and `DELETE` routes with `manualEditable` policy enforcement and soft delete
- Added neutral `publicRuntime.guest` object and field keys; backwards-compatible aliases for legacy guest runtime settings
- Added `_app_reversal_of_fact_id` to generated Ledger tables with partial unique index
- Reset runtime DataGrid sort/filter state when switching sections to avoid cross-catalog field leakage
- Added `buildTransactionalCatalogConfig()` to LMS template; applied to QuizResponses, Assignments, TrainingEvents, Certificates, Enrollments
- Added LMS lifecycle scripts: `AutoEnrollmentRuleScript`, `QuizAttemptPostingScript`, `ModuleCompletionPostingScript`, `CertificateIssuePostingScript`
- Added bilingual Page entities: `CourseOverview`, `KnowledgeArticle`, `AssignmentInstructions`, `CertificatePolicy`
- Added transactional event catalogs: `QuizAttempts`, `AssignmentSubmissions`, `TrainingAttendance`, `CertificateIssues`
- Added additional Ledgers: `LearningActivityLedger`, `EnrollmentLedger`, `AttendanceLedger`, `CertificateLedger`, `PointsLedger`, `NotificationLedger`
- Added generic runtime policy settings: `dashboardDefaultMode`, `datasourceExecutionPolicy`, `workspaceOpenBehavior`
- Added compact multi-card controls to `ApplicationWidgetBehaviorEditorDialog` for overview-card metric authoring
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator multiple times

### Validation

- Full root build passed (30/30 Turbo tasks)
- All focused backend/frontend/template tests passed
- LMS snapshot import/runtime Playwright flow passed with browser issue collection, security edge assertions, and UI geometry checks

---

## Completed: LMS Catalog And Ledger Metadata Foundation (2026-05-07)

Added `ledger` as first-class standard entity kind. Shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts. Ledgers flow through standard templates, metahub routing, publication snapshots, schema helpers, scripts capability metadata, i18n, docs, and canonical LMS Playwright fixture without LMS-specific runtime widgets.

### Changes Made

- Added shared Catalog record behavior and Ledger config types in `@universo/types`
- Extended Entity component manifests with identity fields, record lifecycle, posting, and ledger schema flags
- Added `ledger` to standard entity kinds, settings, surface labels, script attachment kinds, and schema DDL built-in helpers
- Added standard Ledger preset and default `Main` ledger instance
- Extended standard Catalog config with default record behavior; added LMS `ProgressLedger` and `ScoreLedger` definitions
- Routed Ledgers through existing generic Entity list/details authoring surface
- Added EN/RU labels and breadcrumb titles; documented Ledgers in GitBook architecture docs

---

## Completed: Startup Supabase Full Reset (2026-05-07)

Full database reset on startup: drops project-owned schemas, deletes auth users, verifies cleanup. Safety: production guard, advisory lock, schema validation, post-reset residue check. Triggered by `FULL_DATABASE_RESET=true` env var or `_FORCE_DATABASE_RESET=true` env var (set by `start:allclean`).

### Changes Made

- New module `startupReset.ts` with config parsing, production guard, advisory lock, schema discovery, safe schema drop, auth user deletion, post-reset verification
- Integration in `index.ts` — `executeStartupFullReset()` called before migrations in `initDatabase()`
- Environment: `.env.example` / `.env` — "DANGER ZONE" block with `FULL_DATABASE_RESET`
- Tests: 14 new tests (13 in `startupReset.test.ts`, 1 in `App.initDatabase.test.ts`)
- Documentation: `docs/en/` and `docs/ru/getting-started/configuration.md` — "Danger Zone" section

---

## Completed: Node.js 22 Migration (2026-05-06)

Migrated from Node.js 20 to Node.js 22.6.0+ with upgraded isolated-vm 6.x. All configuration files, documentation, and CI/CD workflows updated.

### Changes Made

- `package.json` engines.node updated to `>=22.6.0`; `.nvmrc` created
- `packages/scripting-engine/base/package.json` upgraded isolated-vm from 5.0.4 to ^6.1.2
- `.github/workflows/main.yml` updated CI matrix to Node.js 22.x
- Documentation: `.kiro/steering/tech.md`, `README.md`, `memory-bank/techContext.md`, migration guides updated
- Critical: isolated-vm 5.0.4 does NOT support Node.js 22; 6.x REQUIRED; migration sequence: upgrade isolated-vm first

---

## Completed: Runtime Start Section Stale Placeholder Suppression (2026-05-06)

Published application root no longer briefly renders non-start section while menu-defined start page is loading. `useCrudDashboard` suppresses mismatched section data as loading state.

### Changes Made

- `useCrudDashboard` suppresses mismatched section data and returns loading state when current response section differs from initial menu start section
- Initial menu section detection treats `page` items as valid section targets
- Extended LMS browser flow to assert Access Links is not visible on runtime root loading

---

## Completed: Application Sync RLS Transaction Boundary (2026-05-06)

Application schema sync no longer runs inside request-scoped RLS transaction. Sync route uses plain authenticated middleware with application access checks and sync-engine advisory locks.

---

## Completed: Generic Localized Variant Tabs For Page Content (2026-05-06)

Page content language tabs render through shared `LocalizedVariantTabs` in `@universo/template-mui`. Same typography parity as metahub MUI tab customization.

### Changes Made

- Extracted `LocalizedVariantTabs` into `@universo/template-mui` for reuse
- Matched localized content tabs to metahub MUI tab typography and compact 28px action/add button geometry
- Marked primary content locale with 16px `Star` icon affordance

---

## Completed: LMS Page Content Import And Editor.js UX Closure (2026-05-06)

LMS snapshot contains full EN/RU Editor.js block content. Page block content renders on first open. Editor.js block picker stays visible/scrollable inside viewport.

### Changes Made

- Removed short preset Welcome page from LMS output; kept `LearnerHome` as stable codename
- Added `localizeCodenameFromName` for seed entities to opt out of codename localization
- Regenerated LMS fixture through official Playwright generator with full EN/RU Welcome block content
- Fixed late-data initialization so content renders on first open; constrained block toolbox to remain visible/scrollable

---

## Completed: Page Entity Authoring And LMS UX Closures (2026-05-05)

Multiple Page entity authoring closures: shared action icons, Editor.js toolbar geometry, language tab parity, primary locale ordering, hubs picker VLC codename crash fix, generic Page form capability, stable labels/loading/dialog titles.

### Key Changes Made

- Added standard CRUD action icon factories in `@universo/template-mui`; centralized icon factories removed Page/Catalog menu drift
- Editor.js wrapper keeps add/tune controls inside editor card and left of block text without overlap
- `ContainerSelectionPanel` resolves VLC codenames through `getVLCString` before rendering (fixed React error #31)
- Generic Entity form accepts standard `hubs` tab alias and exposes Page `Hubs` and `Layouts` tabs from template capability metadata
- Generic Entity list helpers and navbar breadcrumbs use localized built-in fallbacks before async metadata resolves
- Standard Entity template presets expose localized `presentation.dialogTitles` for create/edit/copy/delete actions
- `EditorJsBlockEditor` accepts `contentLocale` separately from UI locale; merges saves back into selected locale only
- Metahub Page content route exposes content-language tabs labeled from admin content locales
- Editor.js toolbar/popover CSS reserves left-side toolbar space and keeps opened menu inside content card
- Regenerated LMS snapshot through Playwright generator

---

## Completed: Page Block Content And Editor.js Authoring (2026-05-04)

Implemented real Editor.js authoring for metahub Page content. Shared `EditorJsBlockEditor` in `@universo/template-mui` is domain-neutral and reusable by any `blockContent` Entity type. `apps-template-mui` remains Editor.js-free, rendering canonical Page blocks through safe MUI runtime components.

### Changes Made

- Added official Editor.js core/tools through central PNPM catalog
- Added lazy-loaded `EditorJsBlockEditor` and tool factory in `@universo/template-mui`
- Added shared Editor.js-to-Page block adapters that normalize list 2.x data, reject nested lists and inline HTML
- Hardened entity create/update validation so Page block content is normalized before persistence
- Added entity-owned `/content` route for `components.blockContent.enabled` Entity types
- `SnapshotRestoreService` normalizes imported Page `config.blockContent` and rejects unsafe content
- Added `allowedBlockTypes` and `maxBlocks` constraints to block normalizer
- Regenerated LMS fixture; fixed LMS snapshot import failure (empty import presets for `page` type)
- Fixed `[object Object]` import error display with shared formatter

---

## Completed: LMS Workspace Policy, Page Type, And Runtime Cleanup (2026-05-03 to 2026-05-02)

Implemented Page metadata type, publication-version workspace policy, connector-owned workspace schema decisions, and regenerated LMS product snapshot. Removed old no-workspaces publication policy; valid policies are `optional | required`. Connector schema options persisted only after successful sync.

### Key Changes Made

- Added `page` to metahub/script/runtime kind unions; added `blockContent` component; introduced `WorkspaceModePolicy` plus shared validation helpers
- Registered Page preset in standard templates; added LMS `LearnerHome` Page with Editor.js-compatible blocks
- Added physical-table contract so `hub`, `set`, `enumeration`, `page` sync as metadata-only objects with nullable runtime `table_name`
- Publication versions store `optional | required`; transition guards prevent disabling previously required workspace contract
- `schema_options` on connector-publication links stores optional workspace choices; `workspaces_enabled` updated after successful schema sync
- Guest sessions persist access link id, workspace id, secret, expiry; validation rejects tampered tokens
- `apps-template-mui` renders Page block content through existing dashboard details surface; supports Page menu items
- `sanitizeMenuHref`/`isSafeMenuHref` in `@universo/utils`; editors reject protocol-relative/unsafe-scheme links
- `MenuContent.tsx` uses whitelist (`/`, `https:`, `mailto:`, `tel:`, `#`); unsafe links render as inert items
- JSONB/VLC runtime writes: plain string STRING fields normalized to VLC object before insert/update
- Application `member` is now read-only: create/edit/copy/delete fail closed
- TABLE child-row listing no longer requires mutation permissions; mutations fail closed

---

## Completed: Runtime Workspace Management Implementation (2026-04-27 to 2026-04-29)

`isPublic` mutable through application update. Runtime workspace/member endpoints support paginated/searchable responses. Published workspace management renders as full dashboard section. Workspace copy resets runtime system metadata. Runtime workspace API returns stable error codes. Workspace navigation uses host-provided SPA navigation.

### Key Changes Made

- Owners can change public/closed visibility through settings page; workspace mode is structural read-only
- Backend workspace API: pagination/search for workspace/member listing; member invitation accepts email or user id
- `@universo/apps-template-mui` owns full runtime workspace section with card/list, pagination, search, CRUD, invite, remove
- Workspace copy excludes runtime system columns; resets metadata with fresh timestamps
- Workspace endpoints return stable error `code` values alongside messages
- Runtime workspace navigation uses host-provided SPA navigation callbacks
- Sidebar workspace switcher reads VLC names with active `i18n.language`
- `_app_workspaces` no longer creates machine-name column; create/edit/copy accept only `name`
- Workspace-enabled app sync materializes `workspaceSwitcher` widget in left layout zone
- Workspace routes validate UUID format before schema resolution or service execution
- Playwright flow performs real negative UI actions for invalid creation, blocked removal, missing-user invite

---

## Completed: Application Layout Management (2026-04-22)

Converged application/metahub layout detail onto shared `LayoutAuthoringDetails` in `@universo/template-mui`. Shared `LayoutAuthoringList` for both application and metahub layout lists. Application layout authors can configure `overviewCards`, chart widgets, and `detailsTable` through shared widget behavior editor.

### Changes Made

- Added `LayoutAuthoringList` to `@universo/template-mui` as common card/list renderer; restored metahub compact embedded-header behavior
- `LayoutAuthoringDetails` is common five-zone widget authoring surface for both metahub and application layout detail
- Added shared `LayoutAuthoringDetails` move action menu with accessible zone-move control
- `ConnectorDiffDialog` exposes stable select ids and test hooks for bulk/per-layout resolution
- Read access policy honors explicit per-application `settings.applicationLayouts.readRoles`
- Shared widget validation via `@universo/types` schema-driven parsers

---

## Completed: LMS MVP Implementation (2026-04-19 to 2026-04-21)

LMS MVP as metahub configuration data. Guest/public runtime access end-to-end: public link resolution, guest session creation, quiz submission, progress updates. LMS fixture/docs scaffolding. Guest runtime credential transport hardened. Canonical LMS snapshot regenerated through Playwright generator.

### Key Changes Made

- Header-based guest runtime transport (`X-Guest-Student-Id`/`X-Guest-Session-Token`)
- Shared-workspace-aware access-link resolver; inline SVG fixture assets
- `workspaceId` query override with UUID format validation and membership check
- Public workspace discovery limited to active shared only; personal-workspace member-management fail-closed with explicit `403`
- String-based child-table references remapped to workspace-scoped ids during personal-workspace seeding
- Transaction-safe `createSharedWorkspace`/`addWorkspaceMember`; server-side guest session expiry
- Public script delivery with `Content-Type`, `nosniff`, CSP, cache headers
- Widget/runtime UX hardening (QRCode timeout cleanup, completion screen for last module item)
- EN/RU locale resources include guest completion keys; defensive locale resolution from URL query

---

## Completed: Entity-First Final Refactoring (2026-04-14 to 2026-04-18)

Eliminated all top-level legacy `domains/` folders. Neutralized metadata route segments, public type exports, API helpers, mutation hooks. Backend: removed specialized child-controller factories, moved to generic entity controller + behavior registry. Bulk parameter renaming across 7 packages. Resources tabs made dynamic from entity type `ComponentManifest`.

### Key Changes Made

- Renamed all entity type display names from surface-key terminology (`tree_entity`, `linked_collection`, `value_group`, `option_list`) to traditional names (Hubs, Catalogs, Sets, Enumerations). Internal surface keys preserved unchanged
- Automated renames via perl: `enumerationId`->`optionListId` (321 refs), `setId`->`valueGroupId` (393 refs), `catalogId`->`linkedCollectionId` (904 refs), `hubId`->`treeEntityId` (957 refs)
- `copyOptions.ts` treats `TreeEntityCopyOptions`/`LinkedCollectionCopyOptions`/`ValueGroupCopyOptions`/`OptionListCopyOptions` as canonical
- Removed unused controller-factory tails; deleted `valueGroupController.ts`, `treeController.ts`, `linkedCollectionController.ts`
- Generic custom-entity ACL maps to `createContent`/`editContent`/`deleteContent`
- Removed `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families
- Backend routes mount `field-definitions`/`fixed-values`/`records` suffixes; frontend URLs/navigation updated
- `HubList`/`CatalogList`/`SetList`/`EnumerationList` replaced with neutral names
- `@universo/types` exposes neutral `EntitySurfaceKey`, `EntitySettingsScope`, surface-kind resolvers
- `MainRoutes.tsx` no longer registers old hubs/catalogs/sets/enumerations pages; unified `/entities/:kindKey/...` authoring surface
- Top-level `domains/attributes`/`domains/constants`/`domains/elements`/`domains/general` physically deleted
- Entity-owned routes, read-only definition access, explicit shared-field labels, and browser workspace parity aligned
- Entity types, actions, event bindings, lifecycle orchestration, and resolver DB extension validated as backend seams
- Shared/Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
- ECAE (Entity-Component-Action-Event) architecture: entity presets, script tabs, lifecycle dispatch, runtime execution, browser proof all landed

---

## 2026-04-13 And Earlier: Archive

### 2026-04-13: Legacy Removal + Metahub QA

- Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports; neutral `getTypeById`/`listTypes`/`createType` naming
- `createRlsExecutor` scopes transaction depth lexically; middleware-owned request transactions reused directly
- `entity.hub|catalog|set|enumeration.*` settings keys replace plural legacy prefixes
- `TemplateSeedExecutor` applies hub-assignment remap pass after seeded entities receive real ids
- Entity-Type Codename Enforcement: server-side duplicate codename blocking via `EntityTypeService`; `_mhb_entity_type_definitions` active-row unique index
- Legacy Frontend Route Tree Cleanup: unified `/entities/:kindKey/...` authoring surface

### 2026-04-12: Metahub QA + Entity V2 Closure

- `EntityFormDialog` resets incoming initial state before paint on first open; no render-phase ref writes
- Shared shell-spacing contract extracted to `pageSpacing.ts`; `SkeletonGrid` exposes semantic `insetMode`
- Standalone metahub pages respect outer gutter from `MainLayoutMUI`
- Entity V2 route-ownership, compatibility, review-triage, automation, and workspace/browser seams closed

### 2026-04-09 to 2026-04-10: ECAE Delivery + Catalog V2 Closeout

- Strict Catalogs V2 parity: backend/frontend/browser/runtime paths treat catalog-compatible entity kinds as shared catalog surfaces
- Snapshot v3, DDL custom-type propagation, runtime `section*` aliases generalized
- Dynamic published custom-entity menu zone is permission-aware and stable
- First generic entity instance UI with focused browser proof passed on real product route surface
- Entity presets reuse template registry/versioning flow; frontend authoring workspace integrated into shared shell

### 2026-04-08: ECAE Foundation And QA Recovery

- Backend service foundation: entity types, actions, event bindings, lifecycle orchestration, resolver DB extension
- Generic CRUD and compatibility layer: custom-only generic entity CRUD shipped first, then legacy built-in delete/detach/reorder semantics lifted into shared helpers
- Design-time service genericization: shared child copy and object-scoped system-attribute management behind reusable helpers
- Review and QA hardening: PR review fixes, lint closure, attribute move ownership, strict E2E finalization

### 2026-04-07: Shared/Common And Runtime Materialization

- Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
- Shared sections export/import as first-class snapshot data, materialized into flattened runtime/app-sync view
- Catalog layout inherited widgets stay sparse, read-only for config, gated by shared behavior rules

### 2026-04-06: Layout, Runtime, Fixture, And Docs

- General/Common page owns single shell; catalog-specific layouts remain sparse overlays
- Self-hosted and quiz fixtures regenerated from real generator/browser flows
- Dialog settings, GitBook documentation, screenshot generation brought into EN/RU parity

### 2026-04-05: Scripting And Quiz Delivery

- Embedded scripts are SDK-only; browser worker execution restricted; server runtime pooled; public RPC boundaries fail closed
- Scripts tabs, quizWidget, runtime execution, fixture export/import, and browser-authored quiz flows all landed
- `sdkApiVersion`, CSRF retry, default capability resets, and runtime script sync fail-closed behavior became cross-package contracts

### 2026-04-04: Self-Hosted Parity

- Fixture identity and codename fidelity through repeated real-generator reruns
- Snapshot import/export, publication linkage, runtime inheritance, and browser-import fidelity aligned with live product

### 2026-04-03: Snapshot, E2E Reset, And Turbo Hardening

- Direct metahub export/import, publication version export, `SnapshotRestoreService`, browser verification all landed
- Wrapper-managed E2E runs start from and return to project-empty state with doctor/reset tooling
- Turbo 2 root migration, cache correctness, and repeated-build cache hits became documented build contract

### 2026-04-02 To 2026-03-11: Condensed Archive

| Date | Theme | Durable outcome |
|------|-------|-----------------|
| 2026-04-02 | Playwright full-suite hardening | Route timing, determinism, restart-safe cleanup, diagnostics, locale/theme, route-surface browser-testing closed |
| 2026-04-01 | Supabase auth + E2E QA | HS256/JWKS verification, RLS cleanup, E2E runner cleanup, public-route/auth QA seams stabilized |
| 2026-03-31 | Breadcrumbs + security | Breadcrumb/query restore behavior, JSONB/text selector drift, dependency/security tail closed |
| 2026-03-30 | Metahubs/applications refactor | Thin routes, controller/service/store decomposition, shared hooks, shared mutation/error helpers |
| 2026-03-28 to 2026-03-24 | CSRF + codename convergence | `csurf` replacement, vulnerability cleanup, codename JSONB/VLC single-field contract |
| 2026-03-19 to 2026-03-11 | Platform foundation | Request/pool/DDL DB access tiers, fixed system-app convergence, runtime-sync ownership, managed naming helpers, bootstrap/application workspace work |

### Older 2025-07 To 2026-02 Summary

- Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model
- Release milestones `0.21.0-alpha` through `0.52.0-alpha` in the version table above remain the canonical high-level timeline for those earlier waves
