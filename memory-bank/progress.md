# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
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
| Imported metahub codename contract | `importFromSnapshot` now derives the imported metahub codename from the localized imported metahub name, producing canonical EN/RU codename locales under the active codename policy. Deterministic `Imported` / `Импорт` suffixes are used only when a real codename collision already exists, replacing the old timestamp/random-noise strategy. |
| Default `Main` entity codename contract | `buildTemplateSeedEntityCodenameValue()` now normalizes the primary English codename from the localized entity name instead of preserving raw template seed keys like `MainHub` / `MainCatalog`, and `TemplateSeedMigrator` now reuses the same logic for incremental seed application. |
| Self-hosted fixture contract | The canonical self-hosted section list no longer defines the deprecated standalone `Enumeration Values` / `Значения перечислений` catalog, and the shared contract assertions now fail loudly if either that catalog or the legacy type-suffixed `Main*` codenames reappear in the committed snapshot. |
| Committed fixture regeneration | The real self-hosted Playwright generator reran successfully and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`; the regenerated artifact now exports plain `Main` codenames for the default entities and 11 canonical self-hosted sections without the deprecated enumeration-values catalog. |
| Browser-flow validation | The targeted Playwright browser flow `self-hosted app snapshot fixture imports through the browser UI and restores MVP structure` passed against the regenerated committed snapshot, confirming that the new codename/section contract remains valid in the real import path. |
| Final validation | Focused metahubs-backend route/template tests passed, `pnpm run build:e2e` passed, the real self-hosted generator rerun passed (`2 passed`), the targeted browser import flow passed (`2 passed`), and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts src/tests/services/templateSeedTransactionScope.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- targeted sanity check on `tools/fixtures/metahubs-self-hosted-app-snapshot.json` confirmed the absence of `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` and `Enumeration Values` / `Значения перечислений`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed successfully

## 2026-04-04 Fresh-Import Self-Hosted Publication/Settings Regression Closure

Closed the next honest defect cluster found only after the user did a full rebuild, cleared the database, and imported the committed self-hosted fixture into a fresh environment. This pass stayed intentionally narrow: fix the publication inner-route cache collision, remove duplicated settings-page chrome, repair the self-hosted live codename payload so the generator can create the metahub again, regenerate the committed fixture with the intended EN/RU codename contract, and prove that the regenerated artifact still imports through the real browser flow.

| Area | Resolution |
| --- | --- |
| Publication cache-shape collision | `useMetahubPublicationName()` now uses its own breadcrumb query key instead of reusing publication detail cache storage, eliminating the object/string collision that could surface as an empty publication settings name or `[object Object]` breadcrumbs after repeated navigation. |
| Application settings header chrome | `ApplicationSettings` no longer passes the application display name as `ViewHeader.description`, so the page renders only the intended main title instead of a duplicated subtitle. |
| Self-hosted live codename contract | The shared self-hosted generator builder now returns a valid CodenameVLC payload for live metahub creation, matching the backend `requiredCodenamePayloadSchema` instead of posting a plain locale map. |
| Committed fixture regeneration | The Playwright self-hosted generator reran successfully and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`; the committed artifact now contains the stable canonical EN/RU metahub codename locales and exactly one canonical left-side `menuWidget` (`Catalogs` / `Каталоги`). |
| Real consumer validation | The targeted browser import flow for `self-hosted app snapshot fixture imports through the browser UI and restores MVP structure` passed against the regenerated committed fixture, confirming the export/import consumer path stays green after the codename/menu-widget corrections. |
| Final validation | Targeted `applications-frontend` and `template-mui` regression tests passed, `pnpm run build:e2e` remained green, the Playwright generator rerun passed (`2 passed`), the targeted browser import flow passed (`2 passed`), and the final root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/template-mui test -- src/hooks/__tests__/useBreadcrumbName.test.ts`
- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationSettings.test.tsx`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed successfully

## 2026-04-04 Post-QA Regression Closure Reopened

Closed the final honest defects that remained after the earlier 2026-04-04 self-hosted parity and QA-remediation passes were challenged by direct browser verification. This follow-up stayed intentionally narrow: repair the stale fixture hash contract, restore runtime inheritance semantics, fix publication settings hydration and branch-label rendering, seed localized default codenames correctly, and prove the repaired state through focused tests plus the real browser import flow.

| Area | Resolution |
| --- | --- |
| Self-hosted fixture hash contract | `canonicalizeSelfHostedAppEnvelope()` now recomputes `snapshotHash` after canonical snapshot mutations, and the committed `tools/fixtures/metahubs-self-hosted-app-snapshot.json` was rewritten with the validator-clean hash `0904ee61b0db8b1c541c9a8b2008d7af35a9c5768f497cf89586af83346b1d7c`. |
| Catalog runtime inheritance | `resolveCatalogRuntimeDashboardLayoutConfig()` now applies only explicit catalog overrides, so omitted catalog runtime fields keep inheriting layout-level defaults instead of being clobbered by eager defaulting. |
| Publication dialog hydration | `EntityFormDialog` now keeps hydrating async `initialExtraValues` while the form is pristine and stops overwriting them after the user edits, restoring real publication settings/edit behavior. |
| Publication branch labels | Publication list/version data hooks now resolve VLC codenames into localized strings before interpolation, eliminating `[object Object]` labels in branch selectors and lists. |
| Localized default codenames | `TemplateSeedExecutor` now derives non-primary locale codename values from localized entity names during template seeding, so default `Main` entities carry Russian codename locales alongside English ones. |
| Validation-blocker closure | The required Playwright rerun exposed a real `@universo/utils` dist issue where Node-side ESM could not resolve extensionless Day.js plugin/locale imports. `formatDate.ts` now uses explicit `.js` Day.js specifiers so built package consumers resolve correctly. |
| Final validation | Focused utils, template-mui, metahubs-frontend, and metahubs-backend regression suites passed; the committed fixture validated through the shared snapshot validator; the real self-hosted browser import flow passed; `pnpm run build:e2e` passed; and the canonical root `pnpm build` finished green. |

### Validation

- `pnpm --filter @universo/utils test -- --run src/validation/__tests__/catalogRuntimeConfig.test.ts`
- `pnpm --filter @universo/universo-template-mui test -- --run src/components/dialogs/__tests__/EntityFormDialog.test.tsx`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/publications/hooks/__tests__/usePublicationVersionListData.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateSeedTransactionScope.test.ts`
- shared snapshot-validator script reported `fixture-valid` for `tools/fixtures/metahubs-self-hosted-app-snapshot.json`
- `pnpm build --filter @universo/utils`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed successfully

## 2026-04-04 Final Self-Hosted Documentation Drift Closure

Closed the last low-severity debt left by the 2026-04-04 self-hosted QA audit after the runtime, backend, fixture, and route-proof fixes were already complete. This final pass was intentionally limited to documentation truthfulness so the shipped artifact contract, the tooling guides, and the memory-bank status all describe the same finished state.

| Area | Resolution |
| --- | --- |
| E2E generator docs | Updated both E2E READMEs so the generator screenshots note now points to the canonical `test-results/self-hosted-app/` directory naming instead of the stale self-model path. |
| Drift verification | Targeted workspace grep confirmed the old `test-results/self-model` screenshot-path reference no longer appears in the active tooling/docs surface. |
| Final parity closure | Memory-bank task and active-context state now explicitly record that the self-hosted parity wave no longer carries even low-severity documentation drift from the QA audit. |

### Validation

- Targeted workspace grep for `test-results/self-model` under `tools/testing/e2e/**` returned no matches
- Diagnostics for `tools/testing/e2e/README.md`, `tools/testing/e2e/README-RU.md`, and `memory-bank/tasks.md` were clean

## 2026-04-04 Final Self-Hosted QA Audit Remediation

Closed the last concrete defects that remained after the 2026-04-04 QA audit challenged the earlier self-hosted parity completion claim. This follow-up stayed intentionally narrow: tighten export authorization, repair the product copy in the canonical self-hosted fixture contract, remove the final legacy self-model marker, prove catalog runtime config through HTTP route coverage, and document migrations parity the way the real implementation already ships it.

| Area | Resolution |
| --- | --- |
| Export authorization contract | `GET /metahub/:metahubId/export` now requires `manageMetahub` on the backend instead of plain membership access, the metahub frontend gates export behind `permissions.manageMetahub`, and the export route suite now includes a direct `403` forbidden regression path. |
| Catalog runtimeConfig route proof | Added route-level Jest coverage for catalog `runtimeConfig` persistence across create, update, and copy HTTP flows so the shared catalog runtime contract is now verified through controller validation and route payloads, not only through service/shared-schema seams. |
| Canonical fixture/product copy | Rewrote the self-hosted fixture contract text to clean product-grade EN/RU names and descriptions for the metahub, layout, publication metadata, and all canonical sections; extended the canonicalizer to normalize section/layout/menu-widget metadata and regenerated the committed `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from that corrected contract. |
| Legacy self-model naming cleanup | Removed the last consumer-side `imported-self-model-fixture` codename marker from the self-hosted connector flow so the shipped consumer validation path no longer leaks transitional identity. |
| Migration parity evidence | Updated the plan/memory trail so migrations parity is described honestly as the shipped self-hosted menu/page/guard surface already present in `metahubs-frontend` and `applications-frontend`, rather than as an implied synthetic fixture section. |
| Final validation | Focused metahubs-backend export tests passed, focused catalogs route `runtimeConfig` tests passed, focused metahubs-frontend `MetahubList` Vitest passed after repairing its `StandardDialog` test double, the regenerated fixture passed the canonical contract assertion, and the final root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/metahubsRoutes.test.ts -t "GET /metahub/:metahubId/export"`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/catalogsRoutes.test.ts -t "runtimeConfig"`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
- `node --input-type=module` canonicalized and re-asserted `tools/fixtures/metahubs-self-hosted-app-snapshot.json` via `canonicalizeSelfHostedAppEnvelope()` + `assertSelfHostedAppEnvelopeContract()`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Self-Hosted Fixture Consumer Compatibility Closure

Closed the last verified downstream defect that remained after the canonical self-hosted fixture regeneration pass. The generator, CLI, and committed fixture were already corrected, but real consumer validation still found one honest blocker: imported self-hosted publications could still fail on the first connector-driven application schema creation flow.

| Area | Resolution |
| --- | --- |
| Applications runtime sync compatibility | `applications-backend` now normalizes imported enumeration-value codenames as canonical VLC payloads during runtime seeding instead of collapsing them to string-only values. This preserves JSONB compatibility for `_app_values` and keeps imported self-hosted snapshots valid during schema sync. |
| Regression coverage | Added focused `applicationSyncSeeding` coverage that locks the enum-value VLC codename path so future snapshot/runtime refactors fail loudly before reaching browser flows. |
| Runtime validation discipline | Confirmed that server/runtime checks consume package build output rather than only live TypeScript source, so the applications-backend package was rebuilt before repeating the real import -> connector -> sync verification. |
| Consumer-flow validation | Reproduced the failing flow directly through backend API helpers, confirmed the error source, rebuilt the package, then revalidated both self-hosted fixture-consuming Playwright flows: browser import remained green and the previously failing connector-driven first schema creation flow now returns `200` and reaches `schemaStatus: synced`. |
| Final validation | Focused applications-backend Jest passed, targeted self-hosted Playwright consumer reruns passed, and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationSyncSeeding.test.ts`
- `pnpm build --filter @universo/applications-backend`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-connectors.spec.ts --grep "imported snapshot publication creates schema on first connector attempt"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Final Self-Hosted Parity Completion Pass

Closed the last QA-confirmed defects that still separated the nominally finished self-hosted parity wave from an actually complete, validation-clean delivery. This pass stayed intentionally narrow: fix the remaining runtime truthfulness bugs, expose the already-supported metahub export affordance, repair the stale frontend test seam, and bring the plan/memory status into line with reality.

| Area | Resolution |
| --- | --- |
| Persisted reorder fail-closed contract | `MainGrid` now exposes durable row reordering only when the runtime has a complete dataset and no active local search, while showing explicit user-facing copy when partial-data or filtered views make persisted order ambiguous. |
| Hidden-create route hardening | `ApplicationRuntime` now blocks direct page-surface create activation when `catalog.runtimeConfig.showCreateButton` is false, so search-param navigation cannot bypass authored create restrictions. |
| Direct metahub export UX | The metahub frontend now exposes export as a per-entity action backed by the existing `/metahub/:id/export` route, matching the supported backend surface without introducing ambiguous list-level export behavior. |
| Test and lint debt cleanup | Repaired the stale `ApplicationSettings` shared mock, fixed the touched-file formatting drift in `apps-template-mui`, and added focused regression coverage for reorder fail-closed behavior plus hidden-create page-surface blocking. |
| Final validation | Focused Vitest suites passed for the touched apps-template and applications-frontend files, lint passed for `@universo/apps-template-mui`, `@universo/applications-frontend`, and `@universo/metahubs-frontend`, and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/MainGrid.test.tsx src/standalone/__tests__/DashboardApp.test.tsx`
- `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationSettings.test.tsx`
- `pnpm --filter @universo/apps-template-mui lint`
- `pnpm --filter @universo/applications-frontend lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Final QA Remediation Closure For Metahub Self-Hosted Parity

Closed the final follow-up wave that remained after the nominal self-hosted parity completion. This pass stayed limited to the defects confirmed by the QA review: the committed fixture was still stale, the English metahubs locale bundle had corrupted runtime/layout copy, and the regression net did not fail loudly enough to catch either problem.

| Area | Resolution |
| --- | --- |
| English locale repair | Repaired `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json` so the catalog runtime/layout strings are genuinely English again and no longer bleed the malformed `sets` content into the EN bundle. |
| Package-level regression coverage | Strengthened `packages/metahubs-frontend/base/src/__tests__/exports.test.ts` so EN runtime/layout strings are asserted explicitly and `sets.runtime` is required to stay absent from the exported EN shape. |
| Fixture-consumer regression coverage | Tightened the self-hosted snapshot/import and connector Playwright flows plus the generator assertions so they require the real self-hosted fixture identity, reject stale standalone `Attributes`, and require `Settings`. |
| Real generator contract fix | The targeted self-hosted generator initially failed in `seedSettingsBaseline()` because the seeded settings rows used lowercase payload keys while element validation expects normalized attribute codenames. Updating both generator sources to use `Key` / `Value` / `Category` fixed the root cause. |
| Committed fixture regeneration | Reran the real self-hosted generator successfully and regenerated `tools/fixtures/metahubs-self-hosted-app-snapshot.json` so the committed artifact now carries the self-hosted metahub identity and current `Settings` catalog structure instead of the stale self-model output. |
| Final validation | Focused metahubs-frontend tests passed, the targeted self-hosted generator rerun passed (`2 passed`), artifact sanity checks confirmed the regenerated fixture content, and the canonical root `pnpm build` finished green with `28/28` successful tasks. |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/__tests__/exports.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Metahub Self-Hosting Parity Wave Completion

Closed the remaining implementation phases from the 2026-04-04 self-hosting parity plan after the QA pass surfaced real defects and unfinished seams. This completion pass finished the standalone/runtime UX parity, the self-hosted migration navigation seam, the V2 self-hosted fixture/tooling contract, and the final validation/build closure.

| Area | Resolution |
| --- | --- |
| Runtime page-surface parity | Standalone `DashboardApp` now derives the active CRUD form surface from authored catalog runtime config (`createSurface`, `editSurface`, `copySurface`) instead of always forcing dialog mode. A focused `DashboardApp.test.tsx` suite now locks that behavior. |
| Self-hosted migration parity | The application dashboard menu now exposes `/migrations`, reusing the existing application migration page/guard route so self-hosted admins can discover migration history/status directly from navigation. |
| V2 self-hosted fixture/tooling contract | Renamed the transitional self-model artifacts to `tools/create-metahubs-self-hosted-app.mjs`, `tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts`, and `tools/fixtures/metahubs-self-hosted-app-snapshot.json`; updated dependent flow specs and EN/RU E2E docs; removed the standalone `Attributes` catalog from generator/CLI output; and seeded a non-empty runtime settings baseline in the `Settings` catalog. |
| Snapshot/export/import regression closure | Updated the import/export Playwright flows to consume the renamed self-hosted fixture artifact and to assert the new filename through the browser import dialog contract. |
| Shared browser export stability | Final root validation exposed that `@universo/utils` exported `normalizeDashboardLayoutConfig` only from the Node entrypoint; the browser entry now exports the same runtime/dashboard normalization helpers, fixing the real shared-package drift at the source. |
| Final validation | Focused Vitest suites passed for `applications-frontend` and `apps-template-mui`; the renamed Playwright specs loaded cleanly via `--list`; the renamed CLI helper passed `node --check`; `@universo/utils` and `@universo/core-frontend` rebuilt successfully after the export fix; and the final root `pnpm build` passed with `28/28` tasks. |

### Validation

- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`
- `pnpm --filter @universo/apps-template-mui test -- src/standalone/__tests__/DashboardApp.test.tsx`
- `pnpm --filter @universo/applications-frontend test -- src/__tests__/exports.test.ts`
- `node --check tools/create-metahubs-self-hosted-app.mjs`
- `pnpm exec playwright test --config tools/testing/e2e/playwright.config.mjs tools/testing/e2e/specs/flows/application-connectors.spec.ts tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts --list`
- `pnpm --filter @universo/utils build`
- `pnpm --filter @universo/core-frontend build`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Metahub Self-Hosting Runtime Surface Follow-up

Closed another small but real parity gap in the published runtime after the DataGrid-first and persisted-reorder wave. The goal of this pass was to make the authored catalog runtime config more truthful in the UI and to harden the new page-surface behavior with focused tests.

| Area | Resolution |
| --- | --- |
| Catalog create-button contract | `ApplicationRuntime` and standalone `DashboardApp` now honor `catalog.runtimeConfig.showCreateButton`, so authored catalogs can suppress the create CTA instead of always rendering it. |
| Page-surface regression coverage | `ApplicationRuntime.test.tsx` now covers both configured page-surface create flow and direct URL-driven page-surface activation, so the new `surface=page` search-param contract is no longer untested. |
| Shared page primitives build health | The follow-up package build exposed stale `Link` imports from `react-router` inside shared apps-template page components; these were corrected to `react-router-dom` so the page-surface stack compiles cleanly. |

### Validation

- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm --filter @universo/apps-template-mui build`
- `pnpm --filter @universo/applications-frontend build`

## 2026-04-04 Metahub Self-Hosting Parity Plan QA Revision

Completed the QA review of the new metahub self-hosting parity plan before implementation. The outcome was a tighter, more codebase-aligned plan rather than new production code.

| Area | Resolution |
| --- | --- |
| Config-contract scope | Refined the plan so catalog-level runtime settings reuse the existing flat layout-style keys instead of introducing a new nested runtime-settings DSL for the MVP. |
| Attribute presentation seam | Recorded that the existing attribute `uiConfig.widget` contract already includes `textarea`, so multiline planning should extend that seam first instead of inventing a parallel editor contract unless implementation proves it insufficient. |
| Shared UI reuse | Clarified that catalog and attribute changes must extend the existing tabbed `EntityFormDialog` flows and that page editing must wrap shared form logic rather than fork CRUD surfaces. |
| Cross-package schema alignment | Added an explicit requirement to unify the runtime/dashboard config schema across `metahubs`, `applications-backend`, and `apps-template-mui` so enhanced view flags cannot be lost during publication sync or application install. |
| Migration-control parity | Added a dedicated migration-control parity phase so the self-hosted metahub plan explicitly covers status/history/plan/apply UX instead of leaving migrations as an implicit future gap. |
| Fixture replacement scope | Expanded the plan to cover the real rename surface for `tools/fixtures/self-model-metahub-snapshot.json`, including the generator spec, CLI helper, E2E flows, and docs that currently hardcode the old filename. |
| Validation workflow | Added an explicit rule that full browser flows must use the repository wrapper-based E2E commands, while direct `pnpm exec playwright screenshot` should stay limited to visual captures against a known running app. |

### Validation

- Codebase inspection across metahubs backend/frontend, applications backend, and apps-template runtime paths
- README and docs review for affected packages and guides
- Additional MUI DataGrid guidance review for quick filter, row height, and pagination behavior
- Updated `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md` as the canonical discussion-ready plan

## 2026-04-03 PR #747 Review Remediation Closure

Closed the selective remediation pass for bot review comments on PR #747. The work stayed constrained to findings that were verified against the current branch state and backed by code inspection plus targeted documentation checks.

| Area | Resolution |
| --- | --- |
| Import/export controller hygiene | Moved `attachLayoutsToSnapshot` back into the main import section in `publicationsController.ts`, matching the ES module top-level import requirement. |
| Frontend type correctness | `ImportSnapshotDialog.tsx` now imports `ChangeEvent` directly instead of referencing `React.ChangeEvent` without a React namespace import. |
| Snapshot validation coverage | `snapshotArchive.test.ts` now validates the actually polluted snapshot payload and proves dangerous keys are stripped while preserving valid data. |
| Snapshot restore diagnostics | `SnapshotRestoreService` warning logs now print the primary codename text instead of interpolating a VLC object into the message. |
| Import codename collision hardening | `metahubsController.importFromSnapshot()` now appends a random hex suffix in addition to `Date.now()` when deriving the imported metahub codename. |
| Runtime FlowListTable compatibility | `MainGrid` now passes a minimal DataGrid-style API shim to `renderCell` callbacks in the FlowListTable path, and the runtime test suite covers that contract directly. |
| Scope discipline | Review comments suggesting server-side runtime search and persisted row ordering were explicitly rejected for this pass because they were broader feature suggestions rather than safe correctness fixes. |

### Validation

- `pnpm --filter @universo/utils test -- --run src/snapshot/__tests__/snapshotArchive.test.ts`
- `pnpm --filter @universo/apps-template-mui test -- --run src/dashboard/components/__tests__/MainGrid.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/SnapshotRestoreService.test.ts src/tests/routes/metahubsRoutes.test.ts`
- `pnpm build` passed with `28/28` successful tasks

## 2026-04-04 Verified Snapshot/Runtime Residual Gap Closure

Closed the small follow-up wave that remained after direct verification of the previous snapshot/runtime remediation pass. The work stayed constrained to the proven gaps: early import rollback coverage, deterministic runtime browser proof, self-model fixture fidelity, and stale generator tooling/docs.

| Area | Resolution |
| --- | --- |
| Import rollback completeness | `importFromSnapshot()` now routes the two early post-create failure branches (`Failed to create metahub branch`, `Branch schema not found`) through the same compensating cleanup path used for restore/publication failures instead of returning before rollback. |
| Backend regression coverage | `metahubsRoutes.test.ts` now proves rollback behavior for those early branch/schema failure paths in addition to restore-failure and cleanup-failure coverage. |
| Runtime browser proof | `app-runtime-views.spec.ts` now provisions a real metahub/publication/application, uses the real `/a/...` route, creates runtime rows through the UI, and asserts card mode, search filtering, and FlowListTable activation when row reordering is enabled. |
| Self-model fixture fidelity | The self-model generator reran successfully and regenerated `tools/fixtures/self-model-metahub-snapshot.json` with persisted enhanced runtime layout config fields (`showViewToggle`, `showFilterBar`, `defaultViewMode`, `cardColumns`, `rowHeight`, `enableRowReordering`). |
| Manual utility and docs | `tools/create-self-model-metahub.mjs` now fetches CSRF from `/api/v1/auth/csrf` and persists layout config after widget synchronization; the English and Russian E2E READMEs now describe the real 13-section generator scope. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/app-runtime-views.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-model"`
- `pnpm build` passed with `28/28` successful tasks (`25` cached)

## 2026-04-03 QA Remediation Follow-up For Snapshot/Runtime Settings Hardening

## 2026-04-03 QA Closure For Snapshot Import Cleanup, Runtime Contracts, And Self-Model Scope

Closed the six-point implementation pass that reopened the earlier snapshot/runtime wave only for concrete QA defects. The work stayed surgical: fail-closed import cleanup, runtime list-contract repair, real row-reordering consumption, self-model scope correction, and diagnostics cleanup.

| Area | Resolution |
| --- | --- |
| Snapshot import rollback | `metahubsController.importFromSnapshot()` now compensates restore/publication failures by dropping created branch schemas, soft-deleting created metahub/publication metadata, clearing metahub schema cache, and returning explicit rollback vs cleanup-failure API codes. |
| Backend regression coverage | `metahubsRoutes.test.ts` now proves both cleanup-success and cleanup-failure import paths; `SnapshotRestoreService.test.ts` remained green after diagnostics cleanup. |
| Runtime search/pagination contract | `MainGrid` now uses local filtered totals and page slices when search narrows the already-loaded dataset, instead of mixing filtered rows with stale server `rowCount`. The enhanced table path also hides the internal DataGrid footer and uses the shared external pagination controls consistently. |
| Real row reordering | `enableRowReordering` is wired end-to-end again: layout config schema/defaults, `LayoutDetails` UI, and apps-template runtime now switch table rendering to shared `FlowListTable` sortable mode instead of leaving a noop config seam. |
| Self-model scope | The Playwright generator and `tools/create-self-model-metahub.mjs` now create the planned 13 sections via 10 catalog sections plus real hub/set/enumeration endpoints, seed an enumeration value, and regenerate `tools/fixtures/self-model-metahub-snapshot.json` from the corrected architecture. |
| QA diagnostics cleanup | `snapshotArchive.test.ts` and `SnapshotRestoreService.test.ts` no longer carry the editor/type errors that triggered the QA follow-up. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/metahubsRoutes.test.ts`
- `pnpm --filter @universo/apps-template-mui test`
- `pnpm --filter @universo/utils test -- --run snapshot`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/SnapshotRestoreService.test.ts`
- `pnpm run test:e2e:generators -- --grep "self-model"`
- `pnpm build` passed with `28/28` successful tasks

Closed the narrow post-QA remediation wave that remained after the snapshot/import implementation landed. The work stayed intentionally scoped to validated defects rather than reopening the larger feature surface.

| Area | Resolution |
| --- | --- |
| Snapshot transport contract | Tightened `buildSnapshotEnvelope()` to the shared transport snapshot type and aligned the touched backend export callsites and utils tests with that stricter contract. |
| Runtime settings contract | Removed the stale `enableRowReordering` setting from the live apps-template-mui layout/runtime schema, metahubs layout translations, and public docs so the product no longer advertises a noop runtime feature. |
| Backend regression coverage | Added direct publication import happy-path assertions for permission gating, version deactivation, `active_version_id` update, linked-app notification, and imported source metadata. |
| Repository hygiene | Deleted accidental repository-root artifact files that were outside the project contract. |

### Validation

- Editor diagnostics for the touched implementation files reported no errors.
- `pnpm --filter @universo/utils test -- snapshotArchive.test.ts` passed (`15/15`).
- `pnpm --filter @universo/metahubs-backend test -- publicationsRoutes.test.ts metahubsRoutes.test.ts SnapshotRestoreService.test.ts` passed (`4` suites, `76` passed, `4` skipped).
- Final root `pnpm build` passed with `28/28` successful tasks.

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

## 2026-04-02 Final E2E Hardening Closure and Full-Suite Green

Closed the last helper and route-timing regressions in the Playwright suite without weakening assertions.

| Area | Resolution |
| --- | --- |
| Create/copy determinism | Replaced brittle `waitForResponse(...)` timing dependencies with backend-persistence confirmation in the touched metahub flows. |
| Guarded routes | Direct navigation to guarded metahub pages now waits through the transient migration-guard shell before steady-state assertions. |
| Regression contract | Publication variants, admin RBAC, metahub create/copy/delete, and branch flows remained green after the last fixes. |
| Validation | Targeted reruns stayed green before the final full suite. |

### Validation
- `pnpm run test:e2e:full` finished at `42 passed`.
- Targeted route-flow reruns stayed green on the same wave.

## 2026-04-02 Extended Playwright Coverage, Restart-Safe Validation, and Diagnostics

Expanded browser acceptance coverage around locale/theme, restart-safe startup, diagnostics, publication variants, codename UX, and workspace isolation.

| Area | Resolution |
| --- | --- |
| Locale/theme matrix | Added focused Russian and dark-theme coverage without cloning the entire CRUD surface. |
| Restart-safe checks | Added sequential start-stop-start validation against the same e2e environment. |
| Diagnostics | Added bounded browser diagnostics and artifact capture for long-lived dialog investigation. |
| Product flows | Covered publication create variants, metahub create options, codename autofill/reset, dialog regressions, pre-schema limits, and workspace isolation. |

### Validation
- `test:e2e:restart-safe` and diagnostics commands verified on the same remediation wave.
- Flow inventory and full-suite verification stayed aligned with the documented README state.

## 2026-04-02 Playwright Full-Suite Closure and Route-Surface Completion

Finished the remaining route-surface coverage planned for the browser-testing program.

| Area | Resolution |
| --- | --- |
| Linked-application stability | Removed retry masking and stabilized the linked application creation path through real publication readiness checks. |
| Board and route surfaces | Added browser coverage for board pages, admin role-users, application lists, layouts, connectors, migration history, and runtime CRUD through existing UI surfaces only. |
| Documentation parity | README and browser-testing guidance now reflect the validated route inventory and suite contract. |

### Validation
- Full route-surface coverage passed on the owned server.
- Flow inventory and suite counts were refreshed in docs during the same closure wave.

## 2026-04-01 Playwright Determinism and Linked Application Stability Hardening

Stabilized the Playwright runtime contract and the publication-linked application path under full-suite load.

| Area | Resolution |
| --- | --- |
| Runtime determinism | Pinned browser defaults, artifact cleanup, and timeout/motion behavior. |
| Linked application flow | Added publication-ready polling and bounded retry only for the known narrow generic-500 seam. |
| Suite reliability | The full flow slice and the full suite stopped relying on transport timing luck. |

### Validation
- Full flow slice green.
- Full browser suite green after the hardening pass.

## 2026-04-01 Supabase JWT/JWKS Compatibility Remediation — COMPLETE

Resolved the auth/runtime incompatibility between legacy HS256 projects and modern Supabase JWKS-backed JWT projects.

| Area | Resolution |
| --- | --- |
| Shared verification contract | Added one shared verifier that supports legacy `SUPABASE_JWT_SECRET` and modern JWKS validation. |
| RLS parity | Request auth and RLS setup now reuse the same verification path and no longer diverge on token shape. |
| Startup/env contract | Startup validation now accepts JWKS-era Supabase projects without forcing deprecated secret-only configuration. |
| Cleanup ordering | `ensureAuthWithRls` no longer releases the request session too early on aborted requests. |
| Docs | Backend docs and env guidance now explain JWKS support and pooler expectations for RLS workloads. |

### Validation
- Focused auth/core tests passed for both HS256 and JWKS paths.
- Build and browser validation passed against the updated Supabase test project.

## 2026-04-01 E2E Browser Testing QA Remediation — COMPLETE

Closed the foundational QA debt in the browser-testing stack.

| Area | Resolution |
| --- | --- |
| Cleanup safety | Retained manifests on partial teardown and made repeated cleanup idempotent enough to recover orphaned resources. |
| Runtime boundary | Separated backend-only env loading from frontend e2e env overrides. |
| Runner safety | Locked suite execution and stopped silently reusing stale servers by default. |
| Access defaults | Moved the default browser persona away from `Superuser` to least-privilege coverage where possible. |
| Visual layer | Added and documented committed Playwright snapshots with an explicit refresh workflow. |

### Validation
- End-to-end browser foundation validated against the real workspace runtime.

## 2026-04-01 Comprehensive QA Fix — ALL 16 ISSUES RESOLVED

Closed the broad cross-package QA report that covered bugs, architecture drift, public routes, and dead code.

| Area | Resolution |
| --- | --- |
| Product bugs | Fixed dialog-open state, breadcrumb fallback handling, and Metahub schema-sync response shape. |
| Backend architecture | Replaced remaining raw controller errors with domain errors and extracted the large public routes controller. |
| Public-route hardening | Added limit/offset validation and DTO filtering on the public metahubs surface. |
| Frontend cleanup | Removed dead hooks and migrated the touched list pages to `useListDialogs`. |
| Validation | Full workspace build plus full Jest/Vitest validation stayed green. |

## 2026-03-31 Late-March QA, Breadcrumbs, And Security Summary

The late-March wave focused on two threads: repository hardening and the large breadcrumb/query-state cleanup.

| Theme | Resolution |
| --- | --- |
| Breadcrumb refresh | Fixed the final root cause in `queryClient.clear()` during initial auth restore, then aligned retry/refetch behavior and authenticated client usage across breadcrumb hooks. |
| Attribute/codename UX | Restored the attribute-create button after VLC codename typing drift and fixed connector/metahub selector failures caused by JSONB/text SQL mismatches. |
| Security hardening | Upgraded/patched vulnerable dependency chains, removed hardcoded-secret fallbacks, and improved supply-chain policy (`minimumReleaseAge`, trust settings, exotic subdep blocking). |
| Cleanup | Removed dead hooks, dead comments, and remaining pre-refactor debt uncovered by the QA passes. |

### Representative validated outcomes
- Full build stayed green across the security and breadcrumb waves.
- Touched Jest/Vitest suites were rerun on each closure wave.
- The browser suite stayed green after the final breadcrumb/query fix.

## 2026-03-30 Metahubs & Applications Refactoring — ALL 9 PHASES COMPLETE

Completed the main structural refactor that split oversized route and frontend list surfaces into reusable abstractions.

| Phase | Resolution |
| --- | --- |
| Backend | Route files became thin registrations; controllers/services/stores and `asyncHandler` / `createMetahubHandler` became the default pattern. |
| Frontend | Large list pages were split into data hooks, utils, and presentation layers; shared mutation/error helpers were introduced. |
| Performance | Reused shared hub queries and batch child-attribute loading to remove repeated query work. |
| Testing and docs | Added direct tests for the new abstractions and updated package READMEs plus memory-bank context. |

### Validation
- Workspace build green.
- Touched backend/frontend test suites green.

## 2026-03-28 Comprehensive Cleanup & csurf Replacement

Replaced deprecated `csurf` with a local CSRF middleware and removed a large dead-dependency tail.

| Area | Resolution |
| --- | --- |
| CSRF contract | Preserved session-secret storage, `req.csrfToken()`, header/body/query token handling, and the existing 419 error mapping. |
| Dependency cleanup | Removed dead frontend devDependencies, stale Babel/browserlist config, and orphan root overrides. |
| Validation | Full build, lint, and large test surface stayed green after lockfile regeneration. |

## 2026-03-27 Security Vulnerability Fixes (3 CVEs)

Closed the initial late-March security batch.

| CVE Theme | Resolution |
| --- | --- |
| `SESSION_SECRET` | Moved to fail-fast outside development and auto-generated only for local dev. |
| `flatted` | Forced a patched transitive version through root overrides. |
| `happy-dom` | Upgraded the testing environment package and catalog version to a safe release line. |

### Validation
- Build green.
- Workspace tests green.

## 2026-03-25 Admin Role Codename VLC Enablement

Closed the last major admin-surface seam that still edited codenames as plain text.

| Area | Resolution |
| --- | --- |
| Backend | Roles persistence now treats codename as VLC/JSONB at the store boundary while text comparisons use extracted primary text. |
| Frontend | `RoleFormDialog` now uses `CodenameField` plus VLC-aware autofill and validation. |
| Shared types | Role payloads and admin-facing role shapes now carry canonical codename VLC values instead of strings. |
| QA follow-through | Fixed codename-specific validation wiring, copy truncation, route logging, and migration SQL parameter safety. |

### Validation
- Admin backend/frontend tests green.
- Root build green.

## 2026-03-24 Codename JSONB Final Contract Closure

Closed the codename migration so the live architecture now treats codename as one canonical JSONB/VLC field across fixed schemas, snapshots, runtime metadata, backend routes, and touched frontend flows.

| Area | Resolution |
| --- | --- |
| Fixed schemas and runtime metadata | Admin/metahubs fixed schemas plus runtime `_app_*` metadata now use one codename JSONB contract with extracted-primary text for lookup/order/uniqueness. |
| Backend route contract | Touched metahubs/admin routes stopped exchanging split codename payloads and now normalize canonical VLC payloads through shared helpers. |
| Frontend authoring | Touched metahubs/admin dialogs now use one canonical VLC codename value instead of split string/localized state. |
| Copy/seeding flows | Template seed, copy, retry, and duplicate-check flows now derive uniqueness from primary text but persist through canonical VLC helpers. |
| Browser export parity | Restored browser-safe export parity in `@universo/utils` so downstream dist consumers resolve the same codename helpers. |

### Related closures on the same wave
- Admin SQL helper security tightened for self-scoped authenticated introspection only.
- PL/pgSQL `RETURN QUERY` strict-type issues fixed with explicit `::TEXT` casts.
- Fixed-system metadata inspectors updated to understand JSONB codename rows.
- Idempotent metahubs auth FK and quoting fixes closed fresh-bootstrap failures in the same time window.

### Validation
- Focused admin/metahubs/utils/frontend builds and tests green.
- Final root build green.

## 2026-03-19 Bootstrap Superuser Startup Closure

Added automatic first-start bootstrap for the initial platform superuser.

| Area | Resolution |
| --- | --- |
| Shared provisioning | Startup bootstrap and admin create-user reuse one canonical provisioning/rollback pipeline. |
| Safe startup behavior | Bootstrap runs after migrations under advisory-lock protection and refuses unsafe elevation/reset scenarios. |
| Env/CLI parity | Added the required bootstrap env flags and service-role requirements to backend runtime/docs. |
| Follow-through | Later March follow-ups hardened rollback, protected-role mutation rules, and live integration coverage against real Supabase. |

### Validation
- Focused admin/core tests green.
- Final root build green after the follow-up QA closures.

## 2026-03-19 Application Workspaces UX, Breadcrumbs, Seed Data, And Limits Closure

Closed the largest application workspaces follow-through wave after the public-access implementation landed.

| Area | Resolution |
| --- | --- |
| Runtime limits | Moved limit state to a forward-compatible runtime table shape and fixed pre-schema/info-state UX. |
| Workspace seed propagation | Publication seed data now materializes into personal workspaces instead of leaking into workspace-less rows. |
| Breadcrumb/admin refresh | Cold reloads on application/publication/admin surfaces keep detail labels and menu visibility stable. |
| Access model | Public discovery, join/leave, member access, and runtime/admin role boundaries were hardened across backend and frontend paths. |
| UI polish | Start page offsets, onboarding progress, admin-entry routing, and runtime-limit banners were corrected across the same wave. |

### Validation
- Focused applications backend/frontend/template packages green.
- Final root build green.

## 2026-03-14 Unified Database Access Standardization

| Area | Resolution |
| --- | --- |
| Three-tier contract | Standardized backend DB access around request-scoped RLS executors, pool executors, and explicit Tier 3 DDL boundaries. |
| Enforcement | Added `tools/lint-db-access.mjs` as the policy gate for domain packages. |
| Identifier safety | Hardened shared identifier helpers and optimistic-lock boundaries for SQL-first paths. |
| Documentation | Synced READMEs, docs, and memory-bank architecture notes to the SQL-first contract. |

## 2026-03-13 Optional Global Catalog, Metahub QA, And Definition Lifecycle

| Area | Resolution |
| --- | --- |
| Optional catalog modes | The platform now supports catalog-enabled and catalog-disabled operation without forcing full definition-registry bootstrap on every startup. |
| Lifecycle integrity | Imports/exports and doctor checks now rely on real lifecycle provenance instead of checksum parity alone. |
| Metahub QA | Active-row parity, repeated-start stability, and sorting/filtering regressions were closed through focused QA reopens. |
| Validation | Platform/backend/workspace validation remained green through the closure waves. |

## 2026-03-12 System-App Structural Convergence And Acceptance Coverage

| Area | Resolution |
| --- | --- |
| Structural convergence | Admin, profile, applications, and metahubs fixed schemas moved onto one application-like model. |
| Metadata/compiler foundation | Added metadata observability, compiler artifact preservation, and fail-fast startup checks. |
| Acceptance proof | Added direct frontend acceptance coverage for CRUD, sync dialogs, migration guards, runtime shells, and publication-linked flows. |

## 2026-03-11 Registry, Naming, And Runtime Ownership Foundation

| Area | Resolution |
| --- | --- |
| Runtime ownership | Application runtime sync ownership moved decisively into `@universo/applications-backend`. |
| Managed naming | Shared schema-name helpers replaced local naming logic across bootstrap/runtime paths. |
| Registry foundation | Definition lifecycle and export-health checks received their first stable baseline. |

## Older 2025-07 To 2026-02 Summary

- Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model.
- Release milestones `0.21.0-alpha` through `0.52.0-alpha` are preserved in the version history table above and remain the canonical high-level timeline for those earlier waves.
