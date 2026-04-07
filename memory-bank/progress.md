# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0.57.0-alpha | 2026-04-03 | 0.57.0 Alpha — 2026-04-03                          | QA remediation, controller extraction, domain-error cleanup, Playwright CLI hardening              |
| 0.56.0-alpha | 2026-03-27 | 0.56.0 Alpha — 2026-03-27 (Cured Disease) 🤒      | Entity-display fixes, codename JSONB/VLC convergence, security hardening, csurf replacement        |
| 0.55.0-alpha | 2026-03-19 | 0.55.0 Alpha — 2026-03-19 (Best Role) 🎬          | DB access standard, start app, platform attributes, admin roles/metapanel, application workspaces, bootstrap superuser |
| 0.54.0-alpha | 2026-03-13 | 0.54.0 Alpha — 2026-03-13 (Beaver Migration) 🦫   | MetaHub drag-and-drop ordering, nested hubs, create options/settings UX, optimistic CRUD, SQL-first convergence |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 (Lucky Set) 🍱          | Copy options expansion across Applications, Metahubs, Branches, and Sets/Constants delivery        |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪   | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts                 |
| 0.51.0-alpha | 2026-02-19 | 0.51.0 Alpha — 2026-02-19 (Counting Sticks) 🥢    | Headless Controller, Application Templates, Enumerations                                            |
| 0.50.0-alpha | 2026-02-13 | 0.50.0 Alpha — 2026-02-13 (Great Love) ❤️         | Applications, Template System, DDL Migration Engine, Enhanced Migrations                            |
| 0.49.0-alpha | 2026-02-05 | 0.49.0 Alpha — 2026-02-05 (Stylish Cow) 🐮        | Attribute Data Types, Display Attribute, Layouts System                                             |
| 0.48.0-alpha | 2026-01-29 | 0.48.0 Alpha — 2026-01-29 (Joint Work) 🪏         | Branches, Elements rename, Three-level system fields                                                |
| 0.47.0-alpha | 2026-01-23 | 0.47.0 Alpha — 2026-01-23 (Friendly Integration) 🫶 | Runtime migrations, Publications, schema-ddl                                                      |
| 0.46.0-alpha | 2026-01-16 | 0.46.0 Alpha — 2026-01-16 (Running Stream) 🌊     | Applications modules, DDD architecture                                                              |
| 0.45.0-alpha | 2026-01-12 | 0.45.0 Alpha — 2026-01-11 (Structured Structure) 😳 | i18n localized fields, VLC, Catalogs                                                              |
| 0.44.0-alpha | 2026-01-04 | 0.44.0 Alpha — 2026-01-04 (Fascinating Acquaintance) 🖖 | Onboarding, legal consent, cookie banner, captcha                                              |
| 0.43.0-alpha | 2025-12-27 | 0.43.0 Alpha — 2025-12-27 (New Future) 🏋️‍♂️    | Pagination fixes, onboarding wizard                                                                 |
| 0.42.0-alpha | 2025-12-18 | 0.42.0 Alpha — 2025-12-18 (Dance Agents) 👯‍♀️   | VLC system, dynamic locales, upstream shell 3.0                                                    |
| 0.41.0-alpha | 2025-12-11 | 0.41.0 Alpha — 2025-12-11 (High Mountains) 🌄     | Admin panel, auth migration, UUID v7                                                                |
| 0.40.0-alpha | 2025-12-06 | 0.40.0 Alpha — 2025-12-05 (Straight Rows) 🎹      | Package extraction, Admin RBAC, global naming                                                       |
| 0.39.0-alpha | 2025-11-26 | 0.39.0 Alpha — 2025-11-25 (Mighty Campaign) 🧙🏿 | Storages, Campaigns, useMutation refactor                                                          |
| 0.38.0-alpha | 2025-11-22 | 0.38.0 Alpha — 2025-11-21 (Secret Organization) 🥷 | Projects, AR.js Quiz, Organizations                                                               |
| 0.37.0-alpha | 2025-11-14 | 0.37.0 Alpha — 2025-11-13 (Smooth Horizons) 🌅    | REST API docs, Uniks metrics, Clusters                                                              |
| 0.36.0-alpha | 2025-11-07 | 0.36.0 Alpha — 2025-11-07 (Revolutionary indicators) 📈 | dayjs migration, publish-frontend, Metaverse Dashboard                                         |
| 0.35.0-alpha | 2025-10-30 | 0.35.0 Alpha — 2025-10-30 (Bold Steps) 💃         | i18n TypeScript migration, Rate limiting                                                            |
| 0.34.0-alpha | 2025-10-23 | 0.34.0 Alpha — 2025-10-23 (Black Hole) ☕️        | Global monorepo refactoring, tsdown build system                                                   |
| 0.33.0-alpha | 2025-10-16 | 0.33.0 Alpha — 2025-10-16 (School Test) 💼        | Publication system fixes, Metaverses module                                                         |
| 0.32.0-alpha | 2025-10-09 | 0.32.0 Alpha — 2025-10-09 (Straight Path) 🛴      | Canvas versioning, Telemetry, Pagination                                                            |
| 0.31.0-alpha | 2025-10-02 | 0.31.0 Alpha — 2025-10-02 (Victory Versions) 🏆   | Quiz editing, Canvas refactor, MUI Template                                                         |
| 0.30.0-alpha | 2025-09-21 | 0.30.0 Alpha — 2025-09-21 (New Doors) 🚪          | TypeScript aliases, Publication library, Analytics                                                  |
| 0.29.0-alpha | 2025-09-15 | 0.29.0 Alpha — 2025-09-15 (Cluster Backpack) 🎒   | Resources/Entities architecture, CI i18n                                                            |
| 0.28.0-alpha | 2025-09-07 | 0.28.0 Alpha — 2025-09-07 (Orbital Switch) 🥨     | Resources, Entities modules, Template quiz                                                          |
| 0.27.0-alpha | 2025-08-31 | 0.27.0 Alpha — 2025-08-31 (Stable Takeoff) 🐣     | Finance module, i18n, Language switcher                                                             |
| 0.26.0-alpha | 2025-08-24 | 0.26.0 Alpha — 2025-08-24 (Slow Colossus) 🐌      | MMOOMM template, Colyseus multiplayer                                                               |
| 0.25.0-alpha | 2025-08-17 | 0.25.0 Alpha — 2025-08-17 (Gentle Memory) 😼      | Space Builder, Metaverse MVP, core utils                                                            |
| 0.24.0-alpha | 2025-08-12 | 0.24.0 Alpha — 2025-08-12 (Stellar Backdrop) 🌌   | Space Builder enhancements, AR.js wallpaper                                                         |
| 0.23.0-alpha | 2025-08-05 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | Russian docs, UPDL node params                                                                      |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️    | Memory Bank, MMOOMM improvements                                                                    |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 (Firm Resolve) 💪       | Handler refactoring, PlayCanvas stabilization                                                       |

## 2026-04-07 PR Review Follow-up For GH753

Closed the post-publication bot-review follow-up on PR #753 without widening scope beyond what the review evidence justified. This pass fixed malformed EN/RU guide frontmatter, aligned user-facing docs with the shipped Common/Common -> Layouts terminology and the current layout-owned runtime behavior contract, renamed the internal `GeneralPage` export to match its file, and consolidated metahub hub/catalog counts into one active-row-safe aggregate query per branch schema.

| Area | Resolution |
| --- | --- |
| Documentation contract | EN/RU guide, summary, and platform pages now use the shipped Common terminology, `catalog-layouts` has valid frontmatter again, and docs no longer describe the removed catalog fallback runtime-settings contract. |
| Frontend naming alignment | `packages/metahubs-frontend/base/src/domains/general/ui/GeneralPage.tsx` now exports `GeneralPage`, while the public `MetahubCommon` route/export remains unchanged. |
| Backend metahub counts | Metahub summary paths now use one `COUNT(*) FILTER (...)` query with `_upl_deleted = false AND _mhb_deleted = false`, reducing duplicate scans and restoring the branch active-row contract. |
| Regression coverage | `metahubsRoutes.test.ts` now asserts the consolidated count query shape and active-row filtering; focused frontend export/Common-page tests stayed green after the rename. |
| Validation | Targeted frontend and backend regressions passed, edited EN/RU doc pairs kept exact line-count parity, the canonical root `pnpm build` completed green, and the follow-up was pushed to PR #753. A full `@universo/metahubs-frontend` suite attempt still surfaced unrelated pre-existing `MetahubMigrations.test.tsx` mock failures outside this patch scope. |

### Validation

- `pnpm docs:i18n:check` returned `i18n-docs OK. Checked 0 pair(s). Scope=resources`; manual `wc -l` verification confirmed parity for every edited EN/RU doc pair.
- `pnpm --filter @universo/metahubs-frontend test -- --run src/__tests__/exports.test.ts src/domains/general/ui/__tests__/GeneralPage.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts`
- `pnpm build` passed successfully (`30 successful`, `25 cached`, `1m28.286s`).

## 2026-04-07 Layout-Owned Catalog Behavior Contract Closure

Closed the reopened QA remediation that found catalog CRUD/UI/API still preserving a legacy `runtimeConfig` contract after runtime behavior ownership had already moved to layout `catalogBehavior`. This pass removed the stale frontend/backend contract, stripped persisted leftovers during catalog update/copy flows, realigned focused regressions with the live runtime contract, and finished with green focused tests plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Frontend catalog contract | `CatalogActions.tsx`, `CatalogList.tsx`, shared catalog types, and the focused catalog dialog regression no longer serialize or expose legacy `runtimeConfig` in catalog create/edit/copy flows. |
| Backend catalog API contract | The metahubs catalog controller no longer accepts or returns `runtimeConfig`; update/copy flows now pass `config.runtimeConfig: undefined` into persistence so stale stored values are stripped instead of surviving unrelated writes. |
| Regression alignment | Metahubs backend route tests now reject legacy `runtimeConfig` on create/update/copy and assert stale values are stripped, while the applications backend runtime reorder regression now sources enablement from `_app_layouts.config.catalogBehavior`. |
| Validation | Focused metahubs frontend/backend/applications backend suites passed, touched-file ESLint recheck had `0` errors, and the canonical root `pnpm build` finished green with `30 successful`, `28 cached`, and `1m8.073s`. |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/metahubs/ui/__tests__/actionsFactories.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/catalogsRoutes.test.ts`
- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`
- `pnpm exec eslint packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx packages/metahubs-frontend/base/src/domains/catalogs/ui/catalogListUtils.ts packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/actionsFactories.test.ts packages/metahubs-frontend/base/src/types.ts packages/metahubs-backend/base/src/domains/catalogs/controllers/catalogsController.ts packages/metahubs-backend/base/src/tests/routes/catalogsRoutes.test.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts`
- `pnpm build` passed successfully.

## 2026-04-07 Snapshot Hash Integrity And Catalog Layout Docs Closure

Closed the QA remediation wave that reopened the publication snapshot integrity contract after the broader Common/catalog-layout feature had already shipped. This pass stayed narrow and cross-cutting: extend the shared canonical snapshot hash/checksum helper to cover every exported design-time section currently used by publication export, lock the seam with focused regressions, align the catalog-layout docs with the shipped inherited-widget contract, and finish with green package plus root builds.

| Area | Resolution |
| --- | --- |
| Canonical snapshot integrity | `normalizePublicationSnapshotForHash(...)` now includes `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, so snapshot envelope integrity checks and application release checksums both react to those exported design-time sections. |
| Regression coverage | Focused `publicationSnapshotHash` and `snapshotArchive` regressions now fail when scripts or catalog overlay sections change without hash drift and reject tampered envelopes that try to reuse an old digest. |
| Documentation alignment | EN/RU `catalog-layouts` guides now describe inherited widgets as sparse visibility/placement overlays only and explicitly state that inherited config remains sourced from the base layout. |
| Validation | Focused `@universo/utils` tests passed (`22/22`), `pnpm --filter @universo/utils build` completed green, and the canonical root `pnpm build` finished successfully. |

### Validation

- `pnpm --filter @universo/utils test -- --run src/serialization/__tests__/publicationSnapshotHash.test.ts src/snapshot/__tests__/snapshotArchive.test.ts`
- `pnpm --filter @universo/utils build`
- `pnpm build` passed successfully.

## 2026-04-07 Self-Hosted Fixture Regeneration And Current Structure Baseline Closure

Closed the remaining QA remediation tail around the committed self-hosted snapshot fixture. This pass aligned the generator with the sparse Settings layout contract, fixed the current metahub structure-version baseline so fresh `0.1.0` branch schemas include `_mhb_scripts`, regenerated the self-hosted fixture through the real browser flow, re-proved import/runtime behavior, and finished with a green canonical root build.

| Area | Resolution |
| --- | --- |
| Generator sparse-layout contract | `metahubs-self-hosted-app-export.spec.ts` now asserts only the persisted sparse Settings layout fields and leaves `showDetailsTitle` as a widget-override concern, matching the committed fixture and import proof contract. |
| Current structure baseline | `systemTableDefinitions.ts` now maps structure version `1` to `SYSTEM_TABLES` instead of `SYSTEM_TABLES_V1`, so fresh current-version branch schemas include `_mhb_scripts` and publication export/application creation no longer fail inside the self-hosted generator flow. |
| Fixture regeneration | The browser self-hosted generator passed and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the live artifact, with `snapshot.versionEnvelope.structureVersion = 0.1.0`. |
| Import/runtime proof | The browser snapshot import flow passed against the regenerated fixture, confirming the self-hosted snapshot imports through the UI, restores MVP structure, and preserves the expected runtime contract. |
| Validation | Focused metahubs-backend `systemTableDefinitions` coverage passed (`27/27`), the browser self-hosted generator passed (`2 passed`, `4.7m`), `snapshot-export-import.spec.ts` passed (`5 passed`, `1.9m`), and the canonical root `pnpm build` completed green. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/systemTableDefinitions.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts --project generators`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-06 QA Regression Sweep For Catalog Dialogs, Common Layout Header, And Codename Contract Re-Audit Closure

Closed the reopened browser QA wave triggered after a clean rebuild, database reset, and import from the regenerated self-hosted snapshot fixture. This pass restored the shared catalog dialog helper/export contract, separated Common -> Layouts from the compact dialog-width header mode, fixed a backend undefined-JSON binding bug that surfaced once the dialog path worked again, and re-audited docs/memory around the codename JSONB/VLC storage contract.

| Area | Resolution |
| --- | --- |
| Catalog dialog helper seam | `CatalogActions.tsx` again exports the shared initial-values, copy, and validation helpers expected by catalog edit/copy actions plus nested Settings entrypoints from attributes/elements, removing the `buildInitialValues` / `buildCatalogInitialValues$1` browser crashes. |
| Common layouts header mode | `LayoutList.tsx` now separates `compactHeader` from generic embedded rendering and `GeneralPage` forces the standard full-width Common -> Layouts toolbar/search layout while catalog dialog layout managers keep the compact adaptive variant. |
| Regression coverage | Focused frontend regressions now lock the Common embedded-header contract and the catalog action helper/export seam, while Playwright opens `Settings` from attributes/elements routes and asserts the parent `Edit Catalog` dialog remains usable. |
| Backend JSON binding hardening | `MetahubObjectsService.ts` strips undefined entries from `presentation` and `config` before update SQL binding, and focused backend coverage now fails closed on the exact undefined-binding regression revealed by Playwright after the frontend fix. |
| Codename contract re-audit | The repository re-audit confirmed storage remains one `codename` JSONB/VLC field; `general.codenameLocalizedEnabled` still exists, but only trims non-primary locale variants before persistence via `enforceSingleLocaleCodename(...)`. Stale currentResearch/docs wording was corrected, and no workspace artifact named `admin-role-codename-localized-contract-20260323.json` exists. |
| Validation | Focused metahubs-frontend regressions passed, focused metahubs-backend `MetahubObjectsService` tests passed (`7/7`), Playwright `metahub-domain-entities.spec.ts` passed (`3 passed`, `3.2m`), and the canonical root `pnpm build` finished green with `30 successful`, `30 total`. |

### Validation

- Focused metahubs-frontend Vitest regressions for `GeneralPage`, `LayoutList.copyFlow`, and `actionsFactories` passed.
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubObjectsService.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-domain-entities.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-06 VLC Snapshot Contract And Browser-Faithful Fixture Regeneration Closure

Closed the last snapshot-export QA wave around localized/VLC codename preservation and truthful fixture regeneration. This pass fixed the final field-level attribute-read seam, regenerated both committed browser-authored fixtures from raw export flows, aligned the import proof with the shipped sparse catalog-layout contract, and ended with fresh targeted validation plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Field-level VLC export seam | `MetahubAttributesService` now exposes a snapshot-oriented attribute read path that preserves localized field codename objects for snapshot serialization without widening the default UI/API string contract. `SnapshotSerializer` uses that path only for export, and focused backend regressions lock the behavior. |
| Raw fixture regeneration | The quiz and self-hosted Playwright generators both passed against the stricter raw contracts and rewrote `tools/fixtures/metahubs-quiz-app-snapshot.json` plus `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the real browser/export flow instead of post-export canonicalization. |
| Import-proof alignment | The browser snapshot import/export proof now matches the sparse catalog-layout contract: the Settings catalog layout keeps `showDetailsTitle` as an inherited-widget override rather than a stored config flag, and the spec now verifies that through the imported layout widget state. |
| Validation | Focused metahubs-backend tests passed (`14/14`), focused universo-utils snapshot/hash tests passed (`17/17`), the browser `snapshot-export-import.spec.ts` flow passed (`5 passed`, `2.0m`), and the canonical root `pnpm build` completed green with `30 successful`, `30 cached`, and `384ms`. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubAttributesService.test.ts src/tests/services/SnapshotSerializer.test.ts`
- `pnpm --filter @universo/utils test -- --run src/snapshot/__tests__/snapshotArchive.test.ts src/serialization/__tests__/publicationSnapshotHash.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-06 QA Closure For Snapshot Export And Layout Cache Consistency

Closed the two remaining seam-level defects that reopened the General/catalog-layout wave after the broader feature had already been functionally validated. This pass stayed narrow: preserve full design-time layout state in snapshot export/import, invalidate dependent catalog layout caches after global base-layout mutations, refresh the stale runtime materialization expectation, and then rerun focused validation plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Snapshot export consistency | `snapshotLayouts.ts` now exports the full global/catalog layout set instead of active-only rows and filters override rows to catalog layouts that are actually exported, so snapshot round-tripping no longer drops inactive authoring layouts or carries orphaned override references. |
| Backend regression coverage | Added `src/tests/shared/snapshotLayouts.test.ts` to prove inactive global/catalog layouts and scoped override rows survive export, while existing `SnapshotRestoreService` and layout-route coverage stayed green. |
| Frontend cache invalidation | `LayoutDetails.tsx` and `domains/layouts/hooks/mutations.ts` now invalidate `metahubsQueryKeys.layoutsRoot(metahubId)` for global layout config/widget mutations, which marks dependent inherited catalog layout views stale under the shared 5-minute React Query cache. |
| Frontend regression coverage | Added `LayoutDetails.cacheInvalidation.test.tsx` to lock the global-layout invalidation contract and kept inherited-widget and copy-flow regressions green. |
| Runtime validation alignment | `syncLayoutMaterialization.test.ts` now asserts the current widget-placement-driven visibility contract, matching the shipped runtime materialization behavior instead of the stale pre-remediation expectation. |
| Validation | Focused metahubs-backend (`18/18`), metahubs-frontend (`10/10`), applications-backend (`2/2`), applications-frontend (`11/11`), and apps-template-mui (`5/5`) suites passed; targeted Playwright flows for `metahub-general-catalog-layouts.spec.ts` (`2 passed`, `2.0m`) and `snapshot-export-import.spec.ts` (`5 passed`, `2.1m`) also passed; IDE diagnostics for all touched files stayed clean; and the canonical root `pnpm build` finished green with `30 successful`, `28 cached`, and `1m9.26s`. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/shared/snapshotLayouts.test.ts src/tests/services/SnapshotRestoreService.test.ts src/tests/routes/layoutsRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/layouts/ui/__tests__/LayoutDetails.cacheInvalidation.test.tsx src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx`
- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/syncLayoutMaterialization.test.ts`
- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm --filter @universo/apps-template-mui test -- --run src/standalone/__tests__/DashboardApp.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-06 Catalog Layout QA Remediation And UI Finalization Closure

Closed the reopened catalog-layout QA wave that remained after the earlier General/Common-section delivery had already shipped. This pass removed the last legacy fallback behavior seam, made the catalog dialog Layout tab a pure embedded layout manager, tightened sparse catalog layout storage versus published runtime materialization, and ended with fresh build plus real-browser validation.

| Area | Resolution |
| --- | --- |
| Layout-only runtime behavior contract | `catalogRuntimeConfig.ts` and `runtimeRowsController.ts` now resolve catalog runtime behavior only from layout config. The global layout is the default baseline until a catalog-specific layout exists; catalog object `runtimeConfig` is no longer the canonical fallback for create/edit/copy/search behavior. |
| Sparse catalog layout storage | `MetahubLayoutsService` now strips dashboard widget-visibility booleans from stored catalog layout config while preserving non-widget settings such as `catalogBehavior`. Catalog layouts no longer behave like copied full-config forks of the global layout. |
| Published runtime materialization | `syncHelpers.ts` now reconstructs dashboard widget-visibility booleans from effective materialized widgets when flattening catalog layouts into `_app_layouts`, so sparse design-time storage still yields correct runtime behavior. |
| Catalog dialog UX | The catalog tab now ships as `Layouts` / `Макеты`, the redundant embedded heading and legacy fallback form are removed, embedded layout content renders without standalone shell gutters, and the shared `ViewHeader` adaptive-search contract keeps search/view/create controls usable inside dialog-width toolbars. |
| Layout detail ownership | `LayoutDetails.tsx` now exposes default catalog runtime behavior controls on global layouts and override-specific behavior controls on catalog layouts, matching the runtime contract that behavior lives in layouts rather than in a separate catalog fallback form. |
| Validation | Focused utils/frontend/backend/shared-header tests passed, `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the real `metahub-general-catalog-layouts.spec.ts` Playwright flow passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/utils test -- --run src/validation/__tests__/catalogRuntimeConfig.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/__tests__/exports.test.ts src/domains/catalogs/ui/__tests__/SettingsOriginTabs.test.tsx src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubLayoutsService.test.ts`
- `pnpm --filter @universo/template-mui test -- src/components/headers/__tests__/ViewHeader.test.tsx`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts`
- `pnpm build` passed successfully.

## 2026-04-06 Common Section, Dialog Tabs, Fixtures, And Import Verification Closure

Closed the broad follow-up wave that started from the Common/layout regressions and ended in fixture regeneration plus browser import verification. This pass corrected the product wording and i18n seam, aligned all relevant dialog entrypoints with the shipped tab contract, repaired manual layout defaults and embedded toolbar responsiveness, regenerated both committed fixtures, and proved the imported self-hosted plus quiz flows in the browser.

| Area | Resolution |
| --- | --- |
| Common section rename and i18n repair | The former General section now ships as `Common` / `Общие` across menu, breadcrumbs, page content, selectors, and `/common` routes, and the metahubs i18n registration once again includes the missing section keys so Russian sessions no longer fall back to English defaults. |
| Layout authoring regressions | Manually created layouts now start with empty zones instead of seeded widgets, localized field badges no longer clip inside layout dialogs, and the single-shell Common layouts surface remains intact. |
| Dialog parity and adaptive catalog toolbar | Shared entity settings dialogs now receive the same metahub-aware action context regardless of whether they are opened from list pages or nested `Settings` buttons, which restores Scripts/Layout tab parity. The embedded catalog Layout toolbar now wraps controls in dialog-width contexts instead of overflowing the action row. |
| Fixture regeneration | The Playwright generator sources were updated and both committed fixtures were regenerated. The self-hosted fixture now includes a dedicated Settings catalog layout override that visibly changes the imported application runtime for that catalog. |
| Import verification and timeout closure | The previously failing imported connector flow turned out not to be a backend sync hang: runtime sync completed quickly, but the Playwright test exhausted the default 60-second budget after import/bootstrap work. The flow now uses `test.setTimeout(180_000)`, the temporary backend instrumentation was removed, and the full fixture import verification trio passed (`8 passed`, `5.6m`). |

### Validation

- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts --project generators`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-connectors.spec.ts --project chromium --grep "imported snapshot publication creates schema on first connector attempt"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts tools/testing/e2e/specs/flows/application-connectors.spec.ts tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-06 Final QA Closure For General Page Single-Shell Contract

Closed the last confirmed architecture debt that remained after the broader General-section and catalog-specific layouts feature had already been functionally revalidated. This pass stayed intentionally narrow: stop mounting the standalone Layouts page inside the General page shell, extract a shell-less reusable layouts content layer, add focused regression coverage for that composition rule, and rerun the relevant browser/build proof.

| Area | Resolution |
| --- | --- |
| Single-shell General composition | `GeneralPage.tsx` now follows the shared `SettingsPage` single-shell pattern with one top-level `MainCard` / `ViewHeader` / tabs shell instead of mounting a second standalone layouts page inside the tab body. |
| Layouts content reuse | `LayoutList.tsx` now exports `LayoutListContent` so embedded flows can reuse the existing layouts CRUD/search/dialog implementation with `renderPageShell={false}`, while the default `LayoutList` wrapper preserves standalone route behavior. |
| Focused regression coverage | Added `packages/metahubs-frontend/base/src/domains/general/ui/__tests__/GeneralPage.test.tsx` to lock the General header/tab shell contract and assert that embedded General usage renders `LayoutListContent` rather than the standalone `LayoutList` page wrapper. |
| Browser/build validation | Focused metahubs-frontend Vitest passed (`7/7` across `GeneralPage.test.tsx`, `LayoutList.copyFlow.test.tsx`, and `LayoutDetails.inheritedWidgets.test.tsx`), targeted ESLint on the changed frontend files passed clean, the real Playwright General/catalog-layout flows passed (`3 passed`, `2.3m`), and the canonical root `pnpm build` completed green after the refactor. |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/general/ui/__tests__/GeneralPage.test.tsx src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx`
- `pnpm exec eslint packages/metahubs-frontend/base/src/domains/general/ui/GeneralPage.tsx packages/metahubs-frontend/base/src/domains/general/ui/__tests__/GeneralPage.test.tsx packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutList.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-layouts.spec.ts tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts`
- `pnpm build` passed successfully.

## 2026-04-06 Reopened QA Closure For Inherited Catalog Widget Contract

## 2026-04-06 Post-QA Completion Closure For General Section Runtime Selection, Permissions, And Docs

Closed the last non-E2E follow-up items that remained after the broader General-section and catalog-specific layouts wave had already been revalidated. This pass stayed narrow and contract-driven: keep implicit runtime startup selection anchored to the global layout scope, align the shared layout authoring UI with the backend `manageMetahub` permission contract, and finish the missing General/catalog-layout GitBook guide surfaces in both locales.

| Area | Resolution |
| --- | --- |
| Runtime startup selection | `runtimeRowsController.ts` now resolves the menu-bound startup catalog from the global default or active runtime layout only, preventing implicit root navigation from deriving its preferred catalog from a catalog-scoped runtime layout. |
| Frontend permission gating | `LayoutList.tsx` and `LayoutDetails.tsx` now treat `permissions.manageMetahub` as the shared mutation gate: write affordances are hidden or disabled for read-only users while detail inspection remains available. |
| Focused regressions | Added a new applications-backend runtime-controller regression plus expanded metahubs-frontend layout tests that lock the read-only layout-authoring contract without regressing existing inherited-widget and copy-flow coverage. |
| Documentation closure | Added EN/RU `guides/general-section.md` and `guides/catalog-layouts.md`, updated both guide indexes and `SUMMARY.md` files, and replaced stale `Layouts` navigation wording in the touched authoring guides with `General -> Layouts` while keeping EN/RU line parity exact. |
| Validation | Focused applications-backend Jest passed (`1/1`), focused metahubs-frontend Vitest passed (`6/6`), the first root build attempt failed only on a transient `@universo/core-frontend` heap OOM, and the canonical full root build completed green after rerunning with `NODE_OPTIONS=--max-old-space-size=8192` (`30 successful`, `30 total`, `3m10.931s`). |

### Validation

- `pnpm --filter @universo/applications-backend test -- src/tests/controllers/runtimeRowsController.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx`
- `wc -l docs/en/guides/general-section.md docs/ru/guides/general-section.md docs/en/guides/catalog-layouts.md docs/ru/guides/catalog-layouts.md docs/en/guides/app-template-views.md docs/ru/guides/app-template-views.md docs/en/guides/quiz-application-tutorial.md docs/ru/guides/quiz-application-tutorial.md docs/en/guides/README.md docs/ru/guides/README.md docs/en/SUMMARY.md docs/ru/SUMMARY.md`
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm build` passed successfully.

## 2026-04-06 Reopened QA Closure For Inherited Catalog Widget Contract

Closed the only confirmed defect that reopened the General-section and catalog-specific layouts wave after the broader feature had already shipped. This pass kept the sparse overlay architecture intact while tightening the inherited-widget contract so inherited base-layout widgets remain draggable and toggleable in catalog layouts, but their config stays read-only and runtime materialization no longer preserves stale inherited config overrides.

| Area | Resolution |
| --- | --- |
| Backend mutation boundary | `MetahubLayoutsService` now exposes `isInherited` on catalog-layout widget payloads and rejects inherited widget config edits, removal, and direct reassignment while keeping move/toggle behavior on sparse override rows only. |
| Snapshot/runtime materialization | `snapshotLayouts.ts`, `syncHelpers.ts`, and the runtime materialization tests now treat inherited override config as inert, so inherited widgets always materialize with base widget config instead of freezing catalog-specific config drift. |
| Shared editor UX | `LayoutDetails.tsx` now renders inherited badges, keeps drag/toggle affordances for inherited rows, and hides edit/remove actions for those rows while leaving catalog-owned widgets fully editable. |
| Regression coverage | Focused metahubs-backend service tests, focused metahubs-frontend layout tests, and focused applications-backend sync tests now fail loudly on the inherited-widget read-only contract. |
| Browser proof and validation | `pnpm run build:e2e` completed green, the real `metahub-general-catalog-layouts.spec.ts` flow passed with `2 passed` in `1.8m`, and the canonical root `pnpm build` remained green with `30 successful` tasks. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubLayoutsService.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx`
- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/syncLayoutMaterialization.test.ts`
- `pnpm run build:e2e`
- `pnpm exec node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts`
- `pnpm build` passed successfully.

## 2026-04-06 QA Remediation Closure For General Section And Catalog-Specific Layouts

Closed the follow-up QA defects that remained after the original General-section and catalog-specific layouts delivery had already shipped. This pass stayed narrow and contract-focused: preserve catalog layout scope during copy flows, restore true base-layout inheritance for new catalog layouts, stop sparse override persistence from freezing inherited widget state, and fail closed when `catalog_id` does not point to a real catalog object.

| Area | Resolution |
| --- | --- |
| Catalog layout copy contract | `layoutsController.ts` now preserves `catalog_id`, `base_layout_id`, catalog-owned widgets, and sparse inherited overrides when copying catalog-scoped layouts, including deactivate-all widget copies for inherited base widgets. |
| Base-layout inheritance | `MetahubLayoutsService.createLayout(...)` now validates the target catalog and starts catalog layouts from the selected global base layout config plus explicit incoming sparse overrides instead of dashboard defaults. |
| Sparse override persistence | Catalog inherited-widget updates now keep only true delta rows in `_mhb_catalog_widget_overrides`, and empty override rows are soft-deleted so later global widget config changes continue to flow into catalog layouts. |
| Frontend create payload | `LayoutList.tsx` now sends only the sparse catalog behavior seed for first catalog-layout creation instead of a full dashboard default config blob. |
| Regression coverage | Focused backend route/service tests now lock the copy contract, inherited-config merge, catalog-kind validation, and override cleanup behavior; focused frontend coverage locks the sparse create payload; the real General/catalog-layout Playwright flow stayed green. |
| Validation | Focused backend Jest passed (`13/13`), focused frontend Vitest passed (`3/3`), touched-file ESLint for the remediated layout files finished clean, `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `2.0m`), and the canonical root `pnpm build` finished green with `EXIT:0`. |

## 2026-04-06 Final Verification Closure For Metahub General Section And Catalog-Specific Layouts

Closed the remaining verification and documentation debt for the General-section plus catalog-specific layouts feature after the earlier implementation waves had already shipped the backend, runtime, and authoring foundations. This final pass repaired the last runtime page-surface race, reran the real browser/runtime proof on a fresh build, synchronized the EN/RU product docs with the shipped contract, and ended with clean environment hygiene plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Runtime page-surface stability | `ApplicationRuntime` now suppresses already-consumed page-surface requests after successful create/edit/copy submit, preventing the runtime dialog from reopening during URL/form-close transitions. Focused `ApplicationRuntime.test.tsx` passed again (`11/11`) with the new consumed-request regression covered. |
| Backend/runtime verification | The repaired backend coverage now locks active-base lookup, referenced-global-layout deletion guards, sparse snapshot restore/remap behavior, and runtime materialization invariants for catalog overlays and inherited synthetic widgets. |
| Browser/runtime proof | After a fresh `pnpm run build:e2e`, the comprehensive `metahub-general-catalog-layouts.spec.ts` flow passed again (`2 passed`, `1.9m`), proving `/general`, catalog layout authoring, custom-vs-fallback runtime behavior, supported runtime widget materialization, and authored create/edit/copy page surfaces on the real `/a/...` runtime. |
| Documentation closure | The touched EN/RU `platform/metahubs.md` pages now describe the shipped General tab, sparse catalog layout overlay model, behavior fallback, and runtime materialization flow while preserving exact line parity (`63/63`). |
| Validation and hygiene | `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty` ended clean with no owned schemas, auth users, or local artifacts left behind, and the canonical root `pnpm build` finished green with `30 successful`, `24 cached`, and `1m11.613s`. |

### Validation

- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts`
- `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty`
- `pnpm build` passed successfully.

## 2026-04-06 Metahub General Section + Catalog-Specific Layouts Frontend Authoring Completion

Completed the catalog-specific layout authoring frontend slice for the metahub General section after the shared/backend/runtime foundations and the General page/menu/routes/breadcrumb/i18n integration were already in place. This pass finished the catalog-scoped authoring flow by wiring the catalog dialog to the shared layout editor primitives, preserving catalog runtime behavior as the fallback until the first catalog layout exists, and validating the touched frontend/build seams. The broader browser-runtime scenario remains an open closure item in `tasks.md`.

| Area | Resolution |
| --- | --- |
| Catalog dialog authoring entrypoint | Embedded the catalog-scoped `LayoutList` into the catalog edit dialog Layout tab so catalog runtimeConfig behavior continues to act as the fallback before the first custom layout exists. |
| Catalog layout routing | Added the dedicated catalog layout detail route/context at `/metahub/:metahubId/catalog/:catalogId/layout/:layoutId`, so catalog-origin navigation lands in the existing layout editor with catalog scope preserved. |
| Breadcrumb and detail context | Updated breadcrumbs and layout-detail context resolution so catalog-origin layout navigation keeps the metahub -> catalog -> layout path instead of collapsing to the global-layout flow. |
| Catalog-only behavior editing | `LayoutDetails` now exposes catalog-scoped editing for `showCreateButton`, `searchMode`, `createSurface`, `editSurface`, and `copySurface` through the catalog layout behavior-config path. |
| I18n and regression coverage | Added EN/RU copy for the catalog authoring path; focused metahubs-frontend coverage now proves first-layout seeding from runtimeConfig fallback and catalog-context propagation into the catalog dialog Layout tab. |
| Validation | Focused `@universo/metahubs-frontend` regressions passed (`10/10` across `LayoutList.copyFlow.test.tsx` and `actionsFactories.test.ts`), earlier targeted builds passed for `@universo/metahubs-frontend`, `@universo/core-frontend`, and `@universo/template-mui`, and the final root `pnpm build` passed with `30 successful`, `30 total`, `20 cached`, and `2m37.171s`. |

### Validation

- Focused `@universo/metahubs-frontend` tests passed across `LayoutList.copyFlow.test.tsx` and `actionsFactories.test.ts` (`10/10`).
- Targeted package builds passed for `@universo/metahubs-frontend`, `@universo/core-frontend`, and `@universo/template-mui`.
- Final root `pnpm build` passed with `30 successful`, `30 total`, `20 cached`, and `2m37.171s`.


## 2026-04-06 Final QA Debt Closure For Runtime Sync Coverage And Docs

Closed the last remaining technical-debt items that the final QA pass had left open after the earlier scripting/dialog/tutorial implementation wave. This pass stayed intentionally narrow: harden the browser Worker runtime against hangs, tighten `_app_scripts` scoped-index compatibility repair, make the touched Vitest coverage contract explicit and predictable, and finish the remaining bilingual docs polish.

| Area | Resolution |
| --- | --- |
| Browser runtime fail-closed behavior | `packages/apps-template-mui/src/dashboard/runtime/browserScriptRuntime.ts` now enforces a bounded Worker execution timeout with cleanup, and focused runtime coverage adds a hanging-worker regression so stalled client bundles fail closed instead of leaving widgets pending indefinitely. |
| Runtime sync index hardening | `packages/applications-backend/base/src/routes/sync/syncScriptPersistence.ts` now treats an existing `idx_app_scripts_codename_active` index as compatible only when it preserves the full scoped uniqueness shape, including the null-attachment `COALESCE(...)` and active-row predicate; focused sync persistence coverage now proves malformed legacy definitions are repaired while already-correct ones are preserved. |
| Coverage governance | The touched runtime/frontend Vitest packages now enable coverage by default, allow explicit opt-out only through `VITEST_COVERAGE=false`, and reserve threshold enforcement for the explicit `VITEST_ENFORCE_COVERAGE=true` seam instead of ambient CI detection. |
| GitBook closure | The touched EN/RU `metahub-scripting.md` and `quiz-application-tutorial.md` pages now document the Worker-timeout fail-closed contract, the remaining mixed-language Russian phrasing was removed, and exact EN/RU line parity was preserved (`97/97`, `89/89`). |
| Validation | Focused apps-template (`7/7`), applications-backend (`8/8`), applications-frontend (`3/3`), auth-frontend (`2/2`), scripting-engine (`11/11`), and metahubs-frontend (`2/2`) suites all passed, and the canonical root `pnpm build` finished green with `30 successful`, `14 cached`, and `2m54.285s`. |

### Validation

- `pnpm --filter @universo/apps-template-mui test -- src/dashboard/runtime/__tests__/browserScriptRuntime.test.ts`
- `pnpm --filter @universo/applications-backend test -- src/tests/services/syncScriptPersistence.test.ts`
- `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationSettings.test.tsx`
- `cd packages/auth-frontend/base && pnpm exec vitest run --config vitest.config.ts src/api/__tests__/client.test.ts`
- `pnpm --filter @universo/scripting-engine test -- src/compiler.test.ts src/runtime.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/publications/ui/__tests__/PublicationVersionList.test.tsx`
- `wc -l docs/en/guides/metahub-scripting.md docs/ru/guides/metahub-scripting.md docs/en/guides/quiz-application-tutorial.md docs/ru/guides/quiz-application-tutorial.md`
- `pnpm build` passed successfully.


## 2026-04-06 Admin And Application Dialog Settings GitBook Closure

Closed the documentation/tutorial closure for the admin and application dialog settings wave after the earlier product implementation was already complete. This pass finished the missing GitBook coverage, added a reproducible Playwright screenshot generator for the quiz tutorial, fixed the real build defects that surfaced during that browser/docs validation path, and ended with the canonical full-root build.

| Area | Resolution |
| --- | --- |
| GitBook coverage | Rewrote the EN/RU `metahub-scripting.md`, `platform/metahubs.md`, and `platform/applications.md` pages; added new EN/RU `platform/admin.md` and `guides/quiz-application-tutorial.md`; and updated both `docs/*/SUMMARY.md` files so the new pages are part of the GitBook navigation. |
| EN/RU parity | The touched EN/RU page pairs were kept in structural parity, and the docs diagnostics pass reported no file-level errors on the rewritten pages. |
| Tutorial screenshots | Added `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`, which provisions the quiz tutorial state through API helpers and captures `metahub-scripts.png`, `layout-quiz-widget.png`, `application-settings-general.png`, and `runtime-quiz.png` into `docs/assets/quiz-tutorial/`. |
| Build-fix cleanup | The screenshot/doc validation wave exposed real defects that were then fixed in the shipped branch: a missing SQL-parameter comma in `applicationsStore.ts`, the missing `settings` field in the applications update schema, shared dialog `maxWidth` typing/export drift in `@universo/template-mui`, and broken publication-dialog JSX in metahubs frontend consumers. |
| Validation | Focused package builds passed for the touched backend/frontend/shared-dialog seams, `pnpm run build:e2e` finished green with `30 successful`, the final quiz tutorial screenshot generator passed with `2 passed`, all four screenshot assets were written to `docs/assets/quiz-tutorial/`, and the canonical root `pnpm build` finished green with `30 successful`, `17 cached`, and `3m15.638s`. |

### Validation

- Docs parity check on the touched EN/RU pages completed successfully.
- Docs diagnostics on the rewritten pages reported no errors.
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts --project generators`
- Verified the four generated files under `docs/assets/quiz-tutorial/`.
- `pnpm build` passed successfully.

## 2026-04-06 QA Remediation Closure For Dialog Settings And GitBook Coverage

Closed the only confirmed residual QA debt that remained after the admin/application dialog settings and GitBook documentation wave had already shipped. This pass stayed intentionally narrow: align stale targeted test expectations with the working production contracts, clean the remaining mixed-language prose from the touched Russian docs, and end with fresh green validation evidence.

| Area | Resolution |
| --- | --- |
| Frontend regression closure | `ApplicationSettings.test.tsx` now asserts the shipped UI through stable selectors and the current limits-copy contract, removing the stale `Popup window size` text ambiguity and the outdated limits-availability expectations. |
| Backend regression closure | `applicationsRoutes.test.ts` now asserts the real copy insert order where `settings` is persisted before `slug`, so the slug-collision regressions match the current production contract instead of the pre-settings test assumptions. |
| RU GitBook cleanup | The touched Russian `applications`, `metahubs`, `metahub-scripting`, and `quiz-application-tutorial` pages were rewritten to remove the mixed-language prose while preserving the shipped EN/RU documentation structure. |
| Validation | Focused `@universo/applications-frontend` Vitest passed (`3/3`), focused `@universo/applications-backend` Jest route coverage passed (`51/51`), and the canonical root `pnpm build` finished green with `30 successful`, `30 cached`, and `287ms`. |

### Validation

- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationSettings.test.tsx`
- `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/applicationsRoutes.test.ts`
- `pnpm build` passed successfully.

## 2026-04-06 Final QA Remediation For Publication Versions And Docs Polish

Closed the last confirmed QA findings that remained after the renewed final QA sweep for the dialog-settings, scripting, and quiz tutorial wave. This pass fixed the real browser crash on the publication versions route, added the missing focused frontend coverage, cleaned the remaining mixed-language prose from the touched Russian docs, and ended with fresh browser/runtime/build validation.

| Area | Resolution |
| --- | --- |
| Publication versions browser regression | `PublicationVersionList.tsx` now gates the publication settings dialog behind loaded `publicationData`, preventing the `/metahub/:metahubId/publication/:publicationId/versions` crash that previously broke the browser-authoring quiz flow. |
| Focused regression coverage | Added `packages/metahubs-frontend/base/src/domains/publications/ui/__tests__/PublicationVersionList.test.tsx` to prove the versions page stays stable before publication details load and still opens the settings dialog once details exist. Added `packages/admin-frontend/base/src/pages/AdminSettings.test.tsx` to lock the shipped admin General-tab dialog settings save path. |
| RU docs polish | Cleaned the remaining mixed EN/RU prose in the touched Russian `quiz-application-tutorial`, `metahub-scripting`, `platform/applications`, and `platform/metahubs` pages without changing links, asset paths, or page structure. |
| Browser validation | The requested Playwright reruns all completed successfully: `application-runtime-scripting-quiz-browser-authoring.spec.ts`, `application-runtime-scripting-quiz.spec.ts`, and `docs-quiz-tutorial-screenshots.spec.ts` each exited with code `0`. |
| Environment hygiene | `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty` finished clean after the targeted browser runs, confirming there were no leftover project-owned schemas, auth users, or local E2E artifacts. |
| Final repository validation | The canonical root `pnpm build` finished green with `30 successful`, `21 cached`, and `2m50.684s`. |

### Validation

- `VITEST_COVERAGE=false pnpm --filter @universo/metahubs-frontend test -- --run src/domains/publications/ui/__tests__/PublicationVersionList.test.tsx`
- `pnpm --filter @universo/admin-frontend test -- --run src/pages/AdminSettings.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-runtime-scripting-quiz-browser-authoring.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-runtime-scripting-quiz.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`
- `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty`
- `pnpm build` passed successfully.

## 2026-04-06 Dialog Header Polish And Quiz Script Discoverability

Closed the follow-up UX polish requested immediately after the shared dialog and centered-quiz delivery. This pass stayed narrow: remove the remaining oversized right gap around the shared dialog fullscreen button, localize the top-right header icon tooltips, rename the dialog close setting to popup-window wording, and repair the metahub Scripts-tab scope mismatch that hid the imported quiz script from the user.

| Area | Resolution |
| --- | --- |
| Shared dialog header polish | The shared title-action group now sits tighter to the right edge because the dialog title wrappers no longer add extra right padding and the shared action stack applies the stronger right-edge compensation. |
| Header tooltip localization | `DialogPresentationProvider` now accepts localized reset/expand/restore/resize labels, and `MetahubDialogSettingsProvider` supplies them from the metahubs i18n bundle so the top-right icon tooltips follow the current UI language. |
| Settings wording | The metahub common setting now shows `Popup window type` / `Тип всплывающих окон` with `Modal windows` / `Модальные окна` and `Non-modal windows` / `Немодальные окна`, while preserving the existing `strict-modal` and `backdrop-close` stored values. |
| Quiz script discoverability | The committed quiz fixture stores `quiz-widget` as a metahub-level script with `attachedToId = null`; the metahub edit dialog previously opened the Scripts tab with `attachedToId = metahubId`, so imported quiz scripts disappeared from the list. `MetahubActions` now opens the Scripts tab in true metahub-level scope, making the imported quiz questions editable again through the UI. |
| Validation | Focused `@universo/template-mui` Jest passed (`6/6`), focused `@universo/metahubs-frontend` Vitest passed (`6/6`), and the final root `pnpm build` verification finished green with `30 successful`, `30 cached`, and `286ms`. |

### Validation

- `pnpm --filter @universo/template-mui test -- --runInBand src/components/dialogs/__tests__/EntityFormDialog.test.tsx`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/metahubs/ui/__tests__/actionsFactories.test.ts`
- `pnpm build` passed successfully.

## 2026-04-05 Dialog UX And Centered Quiz Layout Refresh

Closed the dialog UX and centered quiz layout wave that was still active in the memory-bank context. The shared dialog seam now matches the requested fullscreen/resize/strict-modal behavior, and the canonical quiz snapshot/runtime path is aligned around a standalone centered `quizWidget` instead of the legacy left-menu plus details-table plus right-sidebar layout.

| Area | Resolution |
| --- | --- |
| Shared dialog UX | The shared dialog presentation seam now keeps the requested fullscreen/reset affordances, visible strict-modal outside-click feedback, and reliable resize cursor/user-select cleanup with persisted custom sizing. |
| Dialog regression coverage | Focused `EntityFormDialog` coverage now locks fullscreen/reset controls, strict-modal attention feedback, and resize lifecycle cleanup so the shared modal seam cannot silently drift. |
| Centered quiz contract | The canonical quiz layout contract disables the side menu, details table/title, and right-side widgets so `quizWidget` renders as a standalone centered center-zone widget. |
| Generator and fixture | The real Playwright generator rewrote `tools/fixtures/metahubs-quiz-app-snapshot.json` from the centered-quiz contract rather than from a hand-edited artifact path. |
| Browser/runtime proof | Targeted Playwright flows now prove browser authoring, published runtime execution on `/a/...`, and snapshot import/runtime behavior for the centered quiz contract. |
| Validation | Focused dialog and apps-template tests passed, `pnpm run build:e2e` passed, the quiz generator passed with `2 passed`, the targeted quiz Playwright rerun passed with `4 passed` (setup + 3 targeted flows), and the final root `pnpm build` finished green with `30 successful`, `30 cached`, and `599ms`. |

### Validation

- Focused shared dialog regression test passed.
- Focused apps-template `MainGrid` quiz-center regression test passed.
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical quiz metahub"`
- `node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "completed through browser surfaces before runtime verification|execute through the real /a browser surface|publication/application/runtime behavior"`
- `pnpm build` passed successfully.

## 2026-04-05 Frontend Test Warning Remediation

Closed the only confirmed residual QA debt left after the 2026-04-05 scripting/dialog closure. The product/runtime/security plan was already complete; this final remediation was intentionally limited to noisy MUI `anchorEl` warnings inside the scripting-related frontend jsdom suites plus the small formatting drift needed to keep the touched package lint-clean at the error level.

| Area | Resolution |
| --- | --- |
| MUI test warning closure | The affected metahubs frontend dialog/script tests now mock a stable non-zero `HTMLElement.prototype.getBoundingClientRect`, which satisfies MUI `Popover` anchor layout validation in jsdom without changing production code. |
| Interaction stability | The tests keep the existing `user.click(...)` interaction path for `Select` controls, so the warning cleanup does not change the behavior being proved. |
| Package hygiene | Touched formatting drift in the same `@universo/metahubs-frontend` scope was cleaned so package lint no longer fails with error-level issues after the remediation. |
| Validation | Focused `@universo/metahubs-frontend` dialog/script tests passed (`9/9`), the warning string `anchorEl` no longer appeared in the captured test log, package lint finished without errors, and the final root `pnpm build` passed with `30 successful`, `27 cached`, and `56.386s`. |

### Validation

- Focused `@universo/metahubs-frontend` dialog/script test run passed (`9/9`).
- Captured frontend test log no longer contained the warning string `anchorEl`.
- `pnpm --filter @universo/metahubs-frontend lint` finished without error-level failures.
- `pnpm build` passed successfully.

## 2026-04-05 Metahub Dialog Settings And Scripts Tab Responsiveness

Closed the metahub dialog/settings/scripts UX wave requested after the earlier scripting closure. The repository now exposes global metahub dialog presentation settings, applies them through one shared presentation seam across shared and direct dialogs, removes the false Turbo warning from the typecheck-only extension SDK package, and keeps the Scripts tab usable on narrow dialogs without page-level horizontal overflow.

| Area | Resolution |
| --- | --- |
| Turbo warning cleanup | `@universo/extension-sdk` now carries a package-level Turbo override with `build.outputs = []`, which matches its intentional `tsc --noEmit` contract and removes the false "no output files found" warning without generating fake artifacts. |
| Shared settings contract | Added the metahub common settings `common.dialogSizePreset`, `common.dialogAllowFullscreen`, `common.dialogAllowResize`, and `common.dialogCloseBehavior`, with registry/UI/i18n support and defaults `medium`, `true`, `true`, and `strict-modal`. |
| Shared dialog runtime | `@universo/template-mui` now owns the reusable dialog presentation provider/hook, including preset sizing, fullscreen expand/collapse, resize handle with localStorage persistence, reset-to-default affordance, and strict-modal close blocking. |
| Metahub integration | `@universo/metahubs-frontend` now bridges settings into dialog behavior through `MetahubDialogSettingsProvider` / `withMetahubDialogSettings(...)`, and both shared dialogs plus direct MUI dialogs were aligned to the same presentation contract. |
| Scripts tab redesign | `EntityScriptsTab` now uses `ResizeObserver` container-width logic instead of viewport breakpoints, switches between compact/split layouts, collapses the attached-scripts list on narrow dialogs, and confines horizontal overflow to the editor shell only. |
| Regression coverage | Added focused unit coverage for dialog controls and Scripts-tab responsiveness, plus targeted Playwright flows that prove dialog fullscreen/resize/strict-modal behavior, settings persistence, compact layout behavior, and no page-level horizontal overflow in a real browser. |
| Validation | Focused template-mui dialog tests passed, focused metahubs-frontend Scripts-tab tests passed, the targeted Playwright dialog/scripts flow passed, the targeted Playwright settings flow passed, and the final root `pnpm build` finished green after fixing one MUI-compatible `onClose` typing issue in `dialogPresentation.tsx`. |

### Validation

- Focused template-mui dialog control test passed.
- Focused metahubs-frontend Scripts-tab responsiveness test passed.
- Targeted Playwright dialog/scripts regression flow passed.
- Targeted Playwright metahub settings persistence flow passed.
- `pnpm build` passed successfully.

## 2026-04-05 Quiz Snapshot Fixture Export And Import Validation

Closed the durable fixture wave requested after the scripting/runtime closure: the repository now ships a committed snapshot artifact for the full quiz metahub, the snapshot export/import path preserves design-time scripts instead of only publication bundles, and the imported artifact is proven to create a real application whose runtime still matches the final quiz product contract.

| Area | Resolution |
| --- | --- |
| Snapshot script round-trip | `SnapshotRestoreService` now restores `_mhb_scripts` with attachment-id remapping, and metahub export augments `snapshot.scripts` with live `sourceCode` before hashing so imported scripting metahubs remain republishable. |
| Canonical fixture contract | Added `tools/testing/e2e/support/quizFixtureContract.ts` as the single source of truth for the bilingual 10-question quiz content, canonical widget script source, fixture identity, and fail-closed snapshot assertions. |
| Committed fixture artifact | Added the Playwright generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` and generated the committed artifact `tools/fixtures/metahubs-quiz-app-snapshot.json` through the real export pipeline instead of hand-editing JSON. |
| Import/application/runtime proof | Added `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts`, which proves browser-UI import, restored design-time metahub scripts, application creation from the imported publication, and the full EN/RU quiz contract: 10 questions, 4 answers each, +1 only for correct answers, no score increment for wrong answers, final score summary, and restart/back navigation. |
| Validation | Focused metahubs-backend Jest passed, `pnpm run build:e2e` passed, the quiz generator passed with `2 passed`, the quiz import/runtime flow passed with `2 passed`, and the final root `pnpm build` finished green with `30 successful`, `27 cached`, and `23.399s`. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/SnapshotRestoreService.test.ts src/tests/routes/metahubsRoutes.test.ts -t "SnapshotRestoreService|GET /metahub/:metahubId/export"`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts --project generators`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts --grep "quiz snapshot fixture imports through the browser UI and preserves publication/application/runtime behavior"`
- `pnpm build` passed successfully

## 2026-04-05 Scripting QA Gap Closure And Final Plan Completion

Closed the previously identified QA gaps and the remaining final-plan completion debt for the metahub scripting wave. This last 2026-04-05 pass stayed intentionally narrow: add durable benchmark evidence, harden startup/runtime compatibility proof, finish the missing browser authoring seam, close the real auth and authoring UX defects found by browser validation, and rerun the final validation stack.

| Area | Resolution |
| --- | --- |
| Benchmark proof | `@universo/scripting-engine` now ships reproducible benchmark evidence with recorded `coldStartMs 7.13`, `meanMs 1.596`, and `p95Ms 2.127` from the verified session run. |
| Startup compatibility proof | Core-backend startup now validates the `isolated-vm` / `--no-node-snapshot` contract explicitly before serving, and startup regression coverage locks that compatibility seam. |
| Legacy publication compatibility | Publication/runtime normalization now treats missing legacy `snapshot.scripts` as a supported path instead of assuming modern snapshots only, and regression coverage proves that fallback. |
| Browser authoring surface | Layout details now expose `quizWidget` `scriptCodename` so the authoring UI matches the runtime widget contract without manual data patching. |
| Real browser proof | Added the browser-authored Playwright flow that creates a metahub, authors a script in the browser, configures a widget, publishes, creates an application, and performs runtime smoke verification on the real `/a/...` surface. |
| Shared auth defect closure | `auth-frontend` now retries one CSRF-protected request once after HTTP `419` with a fresh token, which fixed the real shared defect exposed by the browser-authored flow. |
| Authoring UX defect closure | `EntityScriptsTab` now reapplies target-role default capabilities for untouched drafts when switching from `module` to `widget`, so widget drafts retain default `rpc.client` instead of keeping only the overlapping `metadata.read` capability. |
| Final validation | Focused auth-frontend Vitest passed, focused metahubs-frontend `EntityScriptsTab` coverage passed, the browser-authored Playwright flow passed with `2 passed`, and the final root `pnpm build` finished green with `30 successful`, `27 cached`, and `3m54.625s`. |

### Validation

- Focused auth-frontend CSRF retry regression passed.
- Focused metahubs-frontend `EntityScriptsTab` regression passed.
- Browser-authored Playwright flow passed with `2 passed`.
- Final root `pnpm build` passed with `30 successful`, `27 cached`, `3m54.625s`.

## 2026-04-05 Earlier Scripting Closure Archive

The earlier same-day scripting entries are intentionally condensed here so the file keeps one durable closure trail for the whole wave instead of six overlapping records.

- Runtime hardening is complete: SDK-only compiler imports, restricted Worker execution, pooled `isolated-vm` server runtime, dedicated client-bundle delivery, fail-closed `_app_scripts` sync, and fail-closed public RPC boundaries are all shipped.
- Product delivery is complete: the Space Quiz starter contract, `quizWidget` runtime UX, design-time CRUD coverage, direct publish/runtime proof, and EN/RU plan/doc parity all landed before the final QA-gap pass.
- Reusable scripting contracts now stay aligned across authoring, publication, runtime, and validation through shared role/capability normalization, explicit dual-target support, and enforced `sdkApiVersion` compatibility (`1.0.0`).
- Earlier same-day focused backend/frontend/runtime suites and root-build validation stayed green before the final closure rerun above.

## 2026-04-04 QA Remediation Closure For Self-Hosted Parity Lint Debt

Closed the remaining reproducible QA residue that still existed on top of the self-hosted parity wave after the earlier implementation and QA-complete status. This pass stayed intentionally narrow: rerun current lint on the touched packages, fix only live residual defects, and finish with the canonical root build instead of relying on stale QA evidence.

| Area | Resolution |
| --- | --- |
| Evidence-first validation | Re-ran focused lint for `@universo/utils`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/apps-template-mui` against the live branch state to isolate only currently reproducible issues. |
| Formatting debt closure | Normalized the touched files across utils, template-mui, metahubs-frontend, metahubs-backend, and apps-template-mui to the current Prettier contract, eliminating the blocking formatter drift that was still failing package lint. |
| Final ESLint defect closure | Removed the duplicate `EnumerationValueOption` type import from `packages/metahubs-frontend/base/src/domains/elements/ui/ElementList.tsx`, clearing the last non-formatting blocker (`no-redeclare`) without changing runtime behavior. |
| Final validation | Focused lint now reports `0 errors` for all five touched packages, and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/utils lint`
- `pnpm --filter @universo/template-mui lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Post-Import Self-Hosted Schema-Diff / Runtime-Inheritance Regression Closure

Closed the next real regression cluster found only after importing the committed self-hosted fixture, linking an application, creating schema, changing only catalog/layout runtime settings, and publishing again through the real browser flow. This pass stayed narrow: repair imported-publication baseline identity, redesign sparse catalog runtime inheritance, finish the requested UI/runtime polish, regenerate the committed self-hosted fixture through the real generator, and prove the repaired state through the real build and browser validation stack.

| Area | Resolution |
| --- | --- |
| Imported publication baseline identity | `metahubsController.importFromSnapshot` now creates the initial imported publication from the restored live branch snapshot instead of the raw imported payload, so restore-time entity/field/layout ID remapping no longer turns later layout-only publications into destructive application schema recreation diffs. |
| Sparse catalog runtime inheritance | The shared catalog runtime contract now preserves sparse authored config, adds explicit `useLayoutOverrides`, stores runtime config through `sanitizeCatalogRuntimeViewConfig(...)`, and applies layout-like catalog overrides only when that seam is enabled. This restores the intended contract where catalogs inherit layout defaults until the user opts into local overrides. |
| Runtime/layout UX polish | The layout-details back button was removed, create/edit/copy surface labels were clarified in EN/RU, the published runtime header spacing was improved, and the toolbar toggle/search/filter controls were aligned visually with the primary Create button. |
| Shared package export parity | Final E2E build validation exposed that `sanitizeCatalogRuntimeViewConfig` was exported from the shared `@universo/utils` Node entry but not from `src/index.browser.ts`. Export parity was restored at the shared package boundary so browser consumers resolve the same helper surface as Node consumers. |
| Self-hosted fixture regeneration | The real Playwright self-hosted generator reran successfully and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, preserving the corrected localized Main codename and section-naming contract through the actual generator path instead of manual artifact editing. |
| Final validation | Focused runtime-config and route regressions passed, `pnpm run build:e2e` finished green with `28/28` successful tasks, the Playwright self-hosted generator rerun passed (`2 passed`), the targeted browser import flow `self-hosted app snapshot fixture imports through the browser UI and restores MVP structure` passed (`2 passed`), and the canonical root `pnpm build` also finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/utils test -- --run src/validation/__tests__/catalogRuntimeConfig.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/catalogsRoutes.test.ts src/tests/routes/metahubsRoutes.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed successfully

## 2026-04-04 Post-QA Regression Closure Reopened

## 2026-04-04 Self-Hosted Codename And Section Contract Closure

Closed the next concrete self-hosted drift cluster that became visible only after another clean rebuild, empty-database reset, and fresh import of the committed self-hosted snapshot. This pass stayed narrow: remove the noisy imported metahub codename suffix strategy, normalize the default `Main` entity codename contract at the template-seeding source, remove the deprecated standalone enumeration-values section from the canonical self-hosted fixture contract, regenerate the committed fixture through the real Playwright generator, and prove that the regenerated artifact still imports through the browser flow.

| Area | Resolution |
| --- | --- |
| Imported metahub codename contract | `importFromSnapshot` now derives the imported metahub codename from the localized imported metahub name, producing canonical EN/RU codename locales under the active codename policy. Deterministic localized imported suffixes are used only when a real codename collision already exists, replacing the old timestamp/random-noise strategy. |
| Default `Main` entity codename contract | `buildTemplateSeedEntityCodenameValue()` now normalizes the primary English codename from the localized entity name instead of preserving raw template seed keys like `MainHub` / `MainCatalog`, and `TemplateSeedMigrator` now reuses the same logic for incremental seed application. |
| Self-hosted fixture contract | The canonical self-hosted section list no longer defines the deprecated standalone `Enumeration Values` catalog, and the shared contract assertions now fail loudly if either that catalog or the legacy type-suffixed `Main*` codenames reappear in the committed snapshot. |
| Committed fixture regeneration | The real self-hosted Playwright generator reran successfully and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`; the regenerated artifact now exports plain `Main` codenames for the default entities and 11 canonical self-hosted sections without the deprecated enumeration-values catalog. |
| Browser-flow validation | The targeted Playwright browser flow `self-hosted app snapshot fixture imports through the browser UI and restores MVP structure` passed against the regenerated committed snapshot, confirming that the new codename/section contract remains valid in the real import path. |
| Final validation | Focused metahubs-backend route/template tests passed, `pnpm run build:e2e` passed, the real self-hosted generator rerun passed (`2 passed`), the targeted browser import flow passed (`2 passed`), and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts src/tests/services/templateSeedTransactionScope.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- targeted sanity check on `tools/fixtures/metahubs-self-hosted-app-snapshot.json` confirmed the absence of `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` and the standalone `Enumeration Values` catalog
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed successfully

## 2026-04-04 Self-Hosted Closure Archive

Condensed the overlapping 2026-04-04 self-hosted follow-up entries into one durable record so this file stays within the target range while preserving the implementation trail. The detailed validation inventory remains reflected in repository history and in the surviving 2026-04-03/2026-04-06 progress entries; the outcomes below are the current source of truth for the archived wave.

| Area | Durable outcome |
| --- | --- |
| Fixture and codename fidelity | Repeated real-generator reruns normalized the committed self-hosted fixture, stabilized localized metahub/default-entity codename behavior, removed stale standalone-section drift, and preserved canonical menu/layout metadata. |
| Import/export and publication UX | The archived 2026-04-04 passes closed publication breadcrumb/settings hydration, import/publication linkage, snapshot-hash stability, management-level export authorization, and browser-import fidelity for the committed self-hosted artifact. |
| Runtime/layout contract | The self-hosted/runtime follow-ups restored sparse catalog runtime inheritance, hardened create/reorder truthfulness in the runtime UI, aligned authored page-surface behavior with shared runtime/dialog contracts, and kept imported runtime sync compatible with VLC codename payloads. |
| Validation and browser proof | Focused backend/frontend regressions, generator reruns, targeted browser import/connector/runtime flows, and canonical root builds all completed green across the archived self-hosted closure wave. |
| Documentation and status trail | E2E docs, memory-bank status, and migration-parity wording were aligned so the shipped self-hosted surface is described as real navigation/page/guard functionality instead of synthetic fixture structure. |

### Archived scope

- Fresh-import self-hosted publication/settings regression closure
- Post-QA regression closure reopened
- Final self-hosted documentation drift closure
- Final self-hosted QA audit remediation
- Self-hosted fixture consumer compatibility closure
- Final self-hosted parity completion pass
- Final QA remediation closure for metahub self-hosted parity
- Metahub self-hosting parity wave completion
- Metahub self-hosting runtime surface follow-up
- Metahub self-hosting parity plan QA revision
- PR #747 review remediation closure
- Verified snapshot/runtime residual-gap closure
- 2026-04-03 snapshot/runtime QA follow-up hardening closures

## 2026-04-03 Snapshot Import Final Stabilization And Full E2E Closure

Closed the final snapshot-import follow-up wave by fixing the backend publication linkage created during metahub import, unifying the import dialog with the shared template-mui modal contract, and stabilizing the last full-suite Playwright regressions.

| Area | Resolution |
| --- | --- |
| Import correctness | `importFromSnapshot` now creates the imported publication/version inside a transaction and explicitly updates `metahubs.doc_publications.active_version_id`, which fixes the post-import connector diff/runtime source failure. |
| Export semantics | Verified that plain metahub export does not carry publication metadata, while version export does; `tools/fixtures/self-model-metahub-snapshot.json` is therefore valid as a metahub snapshot and did not need regeneration for this fix. |
| Import UX | Added shared `StandardDialog` in `@universo/template-mui` and migrated the import dialog to configuration wording, localized no-file-selected text, and divider-free shared styling. |
| Regression coverage | Added backend assertions for imported active-version linkage/preserved version number and a real Playwright flow covering imported self-model -> connector -> first schema creation. |
| Full-suite stability | Stabilized the residual admin RBAC and metahub-create visual flakes so the final wrapper-managed full suite completes without manual cleanup. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubsRoutes.test.ts`
- `pnpm build`
- Targeted Playwright reruns for `application-connectors.spec.ts`, `snapshot-export-import.spec.ts`, `admin-rbac-management.spec.ts`, and `metahub-create-dialog.visual.spec.ts`
- `pnpm run test:e2e:full` finished with exit code `0`
- Post-run `lsof -iTCP:3100 -sTCP:LISTEN` showed no listener on port `3100`

## 2026-04-03 E2E Hosted Supabase Full Reset Hardening

Completed the hosted-Supabase cleanup redesign so wrapper-managed E2E runs now start from and return to a project-empty state rather than relying on best-effort manifest cleanup.

| Area | Resolution |
| --- | --- |
| Authoritative reset | Added `e2eFullReset.mjs` and `e2eDatabase.mjs` to inspect and reset application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations`, Supabase auth users, and local E2E artifacts with E2E-only guardrails and advisory locking. |
| Infrastructure safety | Reset derivation now excludes Supabase/Postgres infrastructure such as `public`; the helper also self-heals `public` if a previous bad reset removed it. |
| Runner lifecycle | `run-playwright-suite.mjs` now performs strict pre-start and post-stop reset, rejects `--no-deps`, blocks `E2E_ALLOW_REUSE_SERVER=true` under strict reset mode, and terminates the full `pnpm start` process group before destructive finalize reset. |
| Tooling and docs | Added `run-e2e-doctor.mjs`, upgraded `run-cleanup.mjs`, documented `E2E_FULL_RESET_MODE`, doctor/reset commands, and wrapper-only safety rules in both E2E READMEs, and updated `.env.e2e.example`. |

### Validation

- `pnpm build` passed (`28/28` packages successful).
- `pnpm run test:e2e:full` completed end-to-end under the new wrapper and exposed 5 unrelated spec failures outside the reset scope (`app-runtime-views.spec.ts`, `profile-update.spec.ts`, `snapshot-export-import.spec.ts`, `metahub-create-dialog.visual.spec.ts`).
- After that full run, `pnpm run test:e2e:cleanup` dropped the remaining 6 project-owned schemas and deleted 1 auth user; `pnpm run test:e2e:doctor -- --assert-empty` confirmed zero project-owned schemas, zero auth users, and zero local artifacts.
- After fixing the runner to stop the full server process group, `pnpm run test:e2e:smoke` passed (`11/11`) and the automatic `runner-finalize` reset completed on its own (`dropped 6 schema(s), deleted 1 auth user(s)`).
- A final `pnpm run test:e2e:doctor -- --assert-empty` confirmed the hosted E2E Supabase was empty after the automatic post-reset path as well.

## 2026-04-03 Metahub Self-Hosted App & Snapshot Export/Import — COMPLETE

Implemented full plan v3 (`memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md`) across 8 phases spanning backend, frontend, apps-template-mui enhancements, tests, and documentation.

### Self-Model E2E & Snapshot Validation — 2026-04-03

- **Self-model E2E spec** (`self-model-metahub-export.spec.ts`): Creates full self-model metahub with 9 catalogs + 27 attributes, publishes, exports snapshot to `tools/fixtures/self-model-metahub-snapshot.json` (62 KB).
- **Fixture contents**: 13 entities (9 user catalogs: Metahubs, Catalogs, Attributes, Elements, Constants, Branches, Publications, Layouts, Settings + 4 system: MainHub, MainCatalog, MainEnumeration, MainSet).
- **Key fixes during E2E development**: All API payloads updated to use JSONB/VLC format (`createLocalizedContent`, `{en: ...}` name objects) matching the codename unification from 0.56.0-alpha.
- **QA findings**: Import endpoint `/api/v1/metahubs/import` receives VLC-formatted `metahub.name` from export but `buildLocalizedContent()` expects simple locale-map — this is a production-level compatibility bug tracked for follow-up.

| Phase | Scope | Summary |
| --- | --- | --- |
| 1.1 | Shared types | Zod schema + TS types in `@universo/types` (`common/snapshots.ts`) |
| 1.2 | Snapshot helpers | `snapshotArchive.ts` in `@universo/utils` with 13 unit tests |
| 2.0 | CSRF protection | Global CSRF on `/api/v1` routes |
| 2.1–2.5 | Backend export/import | Publication version export, direct metahub export, import metahub, `SnapshotRestoreService` (3-pass entity restore), import version into publication |
| 3.1–3.5 | Frontend UI | i18n keys (en/ru), `ImportSnapshotDialog`, toolbar import dropdown, mutation hooks, pub version export/import actions |
| 4 | apps-template-mui | `EnhancedDetailsSection`, card/table view toggle, `DashboardLayoutConfig` Zod schema extension (6 new view fields), row height, i18n |
| 5 | Layout config UI | Application View Settings panel in `LayoutDetails` |
| 6 | Self-model script | `tools/create-self-model-metahub.mjs` |
| 7 | Tests | Publication route tests, E2E `snapshot-export-import.spec.ts` (3 tests), E2E `app-runtime-views.spec.ts` (2 tests) |
| 8 | Documentation | GitBook guides (en/ru) for snapshots and app-template-views, README updates for `apps-template-mui` and `metahubs-backend` |

### Build Fixes During Integration

- VLC→Record casts in `metahubsController.ts` and `publicationsController.ts` require `as unknown as Record<string, unknown>`
- Removed invalid `'readMetahub'` permission from export route (not in `RolePermission` union)
- Changed `useCrudDashboard.ts` return type from `Required<DashboardLayoutConfig>` to `NonNullable<DashboardLayoutConfig>`
- Made `showSideMenu`/`showAppNavbar`/`showHeader` optional in `Dashboard.tsx` interface to match Zod schema

### Validation
- Build: `28/28` packages successful.
- Snapshot tests: `15/15` passing (13 original + 2 new per-entity limit tests).
- E2E specs: created but not yet run in CI (require running Playwright environment).

### QA v3 Hardening Fixes (2026-04-03)

Comprehensive QA analysis found 2 CRITICAL, 4 HIGH, 5 MEDIUM, 4 LOW issues. All addressed — 6 code fixes applied, 13 new unit tests added, 1 E2E spec repaired.

| Severity | Issue | Resolution |
| --- | --- | --- |
| C1 | `buildLocalizedContent()` received VLC objects instead of locale-maps during import — double-wrapping broke store writes | Replaced with `ensureVLC()` for name/description/publication in `importFromSnapshot` |
| H1+H2 | Unmapped hub references and cross-reference nullification in `SnapshotRestoreService` silently lost data | Added `log.warn()` calls for unmapped `hubId`, `targetEntityId`, `targetConstantId` |
| H3 | `defaultLayoutId` appeared unremapped in snapshot restore | False positive — snapshot uses original IDs consistently (publication version stores original ID space) |
| H4 | `enableRowReordering` Zod field not consumed at runtime | Intentional future DnD placeholder (confirmed in prior QA session) |
| M1 | Zod snapshot schema too permissive with `.passthrough()` only | Added explicit optional fields for all known snapshot members; `.passthrough()` kept for forward compat |
| M2 | No server-side file size check before import processing | Added `Content-Length` header check as defense-in-depth (Express body parser also enforces global limit) |
| C2 | No unit tests for import/export routes | Added 7 tests: auth 401, invalid envelope 400, hash mismatch 400, happy path 201, export 401/404/400 |
| M5 | No unit tests for `SnapshotRestoreService` | Created `SnapshotRestoreService.test.ts` with 6 tests: entities, hub remap, constants, layouts, orphans, empty |
| M3 | E2E snapshot spec had wrong toolbar selector + import response ID extraction | Fixed selector to `toolbar-primary-action-menu-trigger`; chained `?.metahub?.id ?? ?.data?.id ?? ?.id` |
| L1 | Missing i18n keys for export | Already present under `export.exportVersion` / `export.exportMetahub` — false positive |

**Validation**: Build 28/28; metahubs-backend 47 suites / 421 tests (4 skipped); utils 24 suites / 274 tests.

### QA Post-Implementation Fixes (2026-04-03)

| Severity | Issue | Fix |
| --- | --- | --- |
| HIGH | E2E tampered hash test used 19-char string — tested Zod length, not hash integrity | Changed to `'a'.repeat(64)` in `snapshot-export-import.spec.ts` |
| HIGH | `enableRowReordering` toggle shown in LayoutDetails but runtime never consumed it | Removed toggle from View Settings UI; Zod field kept for future DnD |
| MEDIUM | `MAX_FIELDS_PER_ENTITY` (200) and `MAX_ELEMENTS_PER_ENTITY` (10K) never checked | Added per-entity field/element validation in `validateSnapshotEnvelope` + 2 tests |
| MEDIUM | File input in `ImportSnapshotDialog` not reset on close | Added `useRef` to clear native `<input>` on dialog close |

---

## 2026-04-03 PR #745 Review Remediation Closure

Closed the validated review findings on the Playwright CLI E2E / QA hardening branch without widening the change scope beyond confirmed defects.

| Area | Resolution |
| --- | --- |
| Locale input UX | `LocaleDialog` now preserves a temporary trailing `-` while the user types region-based locale codes such as `en-US`, instead of collapsing `en-` back to `en`. |
| Localized instance edits | `InstanceList` now updates only the active locale via `updateLocalizedContentLocale(...)`, so editing one locale no longer overwrites translations stored in other locales. |
| Role codename validation | `admin-backend` role routes now read runtime `metahubs` codename settings for exact validation, while the shared schema remains broad enough to avoid pre-parse false negatives and still accepts legacy lowercase slug codenames. |
| Regression coverage | Added focused route tests that prove runtime-setting-aware role codename rejection/acceptance paths. |

### Validation
- `pnpm --filter @universo/admin-backend test -- src/tests/routes/rolesRoutes.test.ts`
- `pnpm --filter @universo/admin-backend build`
- `pnpm --filter @universo/admin-frontend build`
- `pnpm build` (`28 successful, 28 total`)

## 2026-04-03 Turbo 2 .env Cache Correctness Hardening

Added a Package Configuration at `packages/universo-core-frontend/base/turbo.json` to include `.env*` files (excluding `*.example`) in the `core-frontend` build hash. This closes the gap where changing a `.env` value would not invalidate the Vite-built bundle. Backend packages (`core-backend`) do NOT need this fix since `tsc` does not read `.env` at build time.

### Validation
- Dry-run after appending a test line to `.env`: `core-frontend` and `core-backend` MISS, all others HIT.
- After reverting `.env`: 28/28 cache HITs restored (FULL TURBO in ~1.9s).

## 2026-04-03 Deep Domain Error Cleanup & Hardening — ALL ISSUES RESOLVED

Closed the final error-handling cleanup wave after the late-March metahubs/applications refactor and QA passes.

| Area | Resolution |
| --- | --- |
| Service error model | Converted remaining generic `throw new Error()` paths to typed domain errors and aligned factory helpers with frontend error-code expectations. |
| Response contract | `domainErrorHandler` and `createMetahubHandler` now expose `{ error, code, ...details }`, removing nested-details drift. |
| Test parity | Updated route, controller, service, and helper tests to assert the canonical domain-error shape instead of message-sniffing behavior. |
| Cleanup | Removed duplicate error guards, orphaned try-blocks, and one remaining lodash helper usage on the touched path. |
| Validation | Full workspace build, touched Jest suites, and Vitest remained green. |

### Validation
- Build: `28/28` packages successful.
- Jest: `45/45` suites green on the touched wave.
- Vitest: touched file set green.

## 2026-04-03 Turbo 2 Root Contract Migration And Cache Hardening

Completed the root Turborepo modernization so the monorepo now runs on a current Turbo 2 contract with real cacheability instead of an effectively uncached orchestration layer.

| Area | Resolution |
| --- | --- |
| Root task model | Migrated the root config from legacy `pipeline` syntax to Turbo 2 `tasks`, added a root `packageManager`, and upgraded the workspace to `turbo 2.9.3`. |
| Cache correctness | Restored build caching by removing the previous `build.cache = false` behavior and then hardening task `inputs` so generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts no longer self-invalidate subsequent runs. |
| Package exceptions | Added one evidence-based package override for `packages/apps-template-mui`, whose `build` contract is `tsc --noEmit` and therefore must not advertise artifact outputs. |
| CI contract | Wired optional `TURBO_TEAM` and `TURBO_TOKEN` secrets into GitHub Actions so remote cache can be enabled without forcing extra local setup on contributors. |
| Documentation | Updated the root README pair and memory-bank context to document the new Turbo 2 build contract and repeated-build cache expectation. |

### Validation
- `pnpm install` completed successfully after the Turbo 2 upgrade.
- First `pnpm build` under Turbo 2 passed with `28/28` packages successful.
- Repeated-build validation exposed and confirmed the self-invalidation seam through Turbo summaries before the `inputs` exclusions were added.
- Final repeated `pnpm build` after the `inputs` fix ended with `Cached: 28 cached, 28 total` in about `1.8s`.

## 2026-04-02 Shared Page-Spacing Regression Follow-up Closure

Closed the rebuild-discovered spacing drift that remained on settings/layout pages after the earlier page-padding remediation.

| Area | Resolution |
| --- | --- |
| Shared UI contract | Updated `PAGE_TAB_BAR_SX` so settings tab rows widen to the same horizontal gutter as the content underneath instead of staying 16px narrower. |
| Affected pages | Revalidated metahub settings, metahub layout details, admin settings, and application settings against the corrected shared contract; `LayoutDetails` also needed a local `MainCard` `p: 0, gap: 0` override because the shared MUI surfaces theme adds `padding: 16px` to every card root. |
| E2E coverage | Added geometry-based Playwright assertions for the touched settings/layout screens and corrected the admin flow to use the real instance settings route. |
| Validation | The dedicated `build:e2e`, targeted Playwright rerun, and full root build all stayed green after the follow-up patch. |

### Validation
- `pnpm run build:e2e`: `28/28` packages successful.
- `pnpm exec playwright test -c tools/testing/e2e/playwright.config.mjs tools/testing/e2e/specs/flows/metahub-layouts.spec.ts`: `2 passed` after the local layout-details card-padding fix.
- Targeted Playwright rerun: `5 passed`.
- `pnpm build`: `28/28` packages successful.

## 2026-04-02 Unified Page Padding Remediation

Introduced one shared spacing contract for non-list pages and migrated the known drifted screens to it.

| Area | Resolution |
| --- | --- |
| Shared UI contract | Added `PAGE_CONTENT_GUTTER_MX` and `PAGE_TAB_BAR_SX` to `@universo/template-mui`. |
| Affected pages | `AdminSettings`, `ApplicationSettings`, `ApplicationMigrations`, `SettingsPage`, and `MetahubMigrations` now use the shared contract. |
| UI result | Tabs flush with content edges and settings/migration pages align with the canonical `ViewHeader` geometry. |
| Evidence | Before/after screenshots captured and compared; the remediation also stayed green under the browser suite. |

### Validation
- `pnpm build` passed (`28/28`).
- Latest full browser suite stayed green (`42/42`).

## 2026-04-02 To 2026-03-11 Condensed Archive

Earlier April and late-March closures remain part of the durable project history, but they are intentionally compressed here so `progress.md` keeps the current scripting and self-hosted context readable.

| Date | Theme | Durable outcome |
| --- | --- | --- |
| 2026-04-02 | Playwright full-suite hardening | Closed the route-timing, determinism, restart-safe, diagnostics, locale/theme, and route-surface browser-testing waves; the full suite stayed green at `42/42`. |
| 2026-04-01 | Supabase auth + E2E QA | Unified HS256/JWKS verification, kept RLS cleanup correct, hardened the E2E runner/cleanup contract, and closed the cross-package QA bug/dead-code/public-route wave. |
| 2026-03-31 | Breadcrumbs + security | Stabilized breadcrumb/query restore behavior, fixed JSONB/text selector drift, and closed the late-March dependency/security hardening tail. |
| 2026-03-30 | Metahubs/applications refactor | Completed the 9-phase backend/frontend decomposition into thin routes, controllers/services/stores, shared hooks, and shared mutation/error helpers. |
| 2026-03-28 to 2026-03-27 | CSRF + vulnerability cleanup | Replaced `csurf`, removed dead dependency/override debt, and closed the March CVE batch while keeping the build/test surface green. |
| 2026-03-25 to 2026-03-24 | Codename/VLC convergence | Finished admin-role codename VLC enablement and the broader codename JSONB single-field contract across schemas, routes, copy flows, and frontend authoring. |
| 2026-03-19 | Bootstrap + application workspaces | Closed bootstrap superuser startup plus the application workspaces UX, breadcrumb, seed-data, and limits follow-through. |
| 2026-03-14 to 2026-03-11 | SQL-first platform foundation | Standardized request/pool/DDL DB access tiers, stabilized optional global-catalog lifecycle behavior, converged fixed system apps, expanded acceptance coverage, and finalized runtime-sync ownership plus managed naming helpers. |

### Validation

- Representative full-browser, focused Jest/Vitest, and root-build validations stayed green across these archived waves; see the original dated entries in repository history for the full command inventory.

## Older 2025-07 To 2026-02 Summary

- Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model.
- Release milestones `0.21.0-alpha` through `0.52.0-alpha` are preserved in the version history table above and remain the canonical high-level timeline for those earlier waves.
