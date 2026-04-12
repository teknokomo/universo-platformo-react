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

## 2026-04-12 Self-Hosted Fixture QA Closure

Closed the last two real QA findings that were still live on the current tree after the broader Entity V2 surface was already green. This pass stayed intentionally narrow: regenerate the committed self-hosted fixture through the supported generator path and harden the browser snapshot import proof so imported V2 entity-definition drift cannot hide behind count/layout-only assertions.

| Area | Resolution |
| --- | --- |
| Browser import contract proof | `snapshot-export-import.spec.ts` now re-exports the imported metahub and polls `assertSelfHostedAppEnvelopeContract(...)`, with an explicit longer stabilization timeout so the browser flow validates imported `entityTypeDefinitions` rather than only counts/layout structure. |
| Fixture regeneration | The supported self-hosted generator rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, and a direct Node contract check now returns `fixture-contract:ok` for the committed artifact. |
| Validation | `pnpm run build:e2e` completed green, the supported self-hosted generator/export flow passed (`2 passed`), the targeted Chromium browser import flow passed (`2 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts --project generators`
- direct self-hosted fixture contract check via `assertSelfHostedAppEnvelopeContract(...)` (`fixture-contract:ok`)
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --project chromium --grep "self-hosted app snapshot fixture imports through the browser UI and restores MVP structure"`
- `pnpm build`

## 2026-04-12 Entity V2 QA Completion Follow-up

Closed the last plan-vs-implementation gap left by the QA audit on the already-green legacy-compatible V2 surface. This follow-up did not change ACL, runtime filtering, or route-ownership behavior; it fixed the shipped preset manifests so Hub V2 and Enumeration V2 finally expose the promised automation uplift instead of inheriting legacy-disabled component maps.

| Area | Resolution |
| --- | --- |
| Hub V2 / Enumeration V2 manifests | `hub-v2.entity-preset.ts` now enables `scripting`, `actions`, and `events`, while `enumeration-v2.entity-preset.ts` now enables `actions` and `events` on top of inherited scripting, aligning the shipped manifests with the approved V2 automation contract. |
| Regression proof | Focused preset-manifest coverage now asserts the upgraded automation component set directly instead of only validating schema shape, so Hub V2 / Enumeration V2 cannot silently fall back to legacy-disabled automation components again. |
| Fixture-facing contract | `selfHostedAppFixtureContract.mjs` now asserts automation component expectations for all four V2 presets, and the committed self-hosted snapshot was regenerated through the supported Playwright generator flow so exported fixture state matches the upgraded preset definitions. |
| Docs and validation | EN/RU custom-entity guide wording now explicitly reflects automation on the legacy-compatible V2 presets, the edited guide pair remains line-count aligned (`72/72`), the supported self-hosted generator/export flow passed (`1 passed`, `5.3m`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend exec jest --config jest.config.js --runInBand src/tests/services/templateManifestValidator.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `pnpm docs:i18n:check`
- `wc -l docs/en/guides/custom-entity-types.md docs/ru/guides/custom-entity-types.md`
- `pnpm build 2>&1 | tail -20`

## 2026-04-12 Entity V2 QA Closure Completion

Closed the last real blocker left by the deeper QA review on the already-shipped legacy-compatible V2 surface. This pass fixed the remaining low-level delete-safety seam by teaching blocker services to honor compatible custom target kinds instead of only built-in `set` / `enumeration` literals, then wired that repair through both the generic entity delete plan and the legacy set/enumeration/constant child-delete flows.

| Area | Resolution |
| --- | --- |
| Compatibility-aware blocker queries | `MetahubConstantsService` and `MetahubAttributesService` now accept compatible target-kind arrays and use `ANY($n::text[])` matching, so custom `custom.set-v2*` and `custom.enumeration-v2*` references participate in delete blocking the same way as built-in kinds. |
| Generic and legacy delete parity | The generic entity-instance delete/permanent-delete path plus the legacy set/enumeration/constant delete flows now resolve compatible kinds explicitly before calling the blocker services, so both route families share the same delete-safety contract. |
| Regression proof closure | Focused service tests now cover the real SQL seam, generic-route regressions now lock ACL/settings behavior for non-catalog compatible kinds, and the Chromium legacy-compatible V2 suite now proves a compatible Set V2 delete remains blocked when a catalog attribute still references it. |
| Validation | Focused metahubs-backend route/service coverage passed (`87/87`), `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the targeted Chromium legacy-compatible V2 suite passed (`7 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- Focused metahubs-backend route/service rerun (`MetahubConstantsService`, `MetahubAttributesService`, `constantsRoutes`, `setsRoutes`, `enumerationsRoutes`, `entityInstancesRoutes`)
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project chromium -- tools/testing/e2e/specs/flows/metahub-entities-legacy-compatible-v2.spec.ts`
- `pnpm build`

## 2026-04-12 Entity V2 QA Gap Closure

Closed the last two QA-found blockers on top of the already-shipped Entity V2 surface without widening the product scope. This pass restored legacy-safe generic delete behavior for compatible Hub V2 / Set V2 / Enumeration V2 custom kinds, extracted the shared hub-delete compatibility seam so the generic controller and the legacy hubs controller reuse the same blocker/cleanup logic, and hardened the runtime browser proof so it validates semantic URL state instead of a brittle raw string pattern.

| Area | Resolution |
| --- | --- |
| Generic delete parity | Generic entity-instance `remove` and `permanentRemove` now build a legacy-compatible delete plan, so compatible catalog/set/enumeration/hub custom kinds reuse the same delete safety as the legacy controllers instead of preserving only the catalog-compatible branch. |
| Hub-specific delete semantics | Shared hub compatibility helpers now expose blocker lookup plus association cleanup, and the generic delete path removes hub references from related objects before deleting a compatible Hub V2 row. |
| Runtime proof hardening | The runtime Chromium spec now polls `pathname` and `catalogId` from `new URL(page.url())`, which keeps the proof stable when the browser uses absolute URLs and expected query strings. |
| Validation | Focused metahubs-backend route coverage passed for the 4 touched suites (`64/64`), `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the combined Chromium legacy-compatible/runtime rerun passed (`7 passed`), and the canonical root `pnpm build` completed green on the final patch set. |

### Validation

- Focused metahubs-backend route rerun (`entityInstancesRoutes`, `hubsRoutes`, `setsRoutes`, `enumerationsRoutes`)
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-legacy-compatible-v2.spec.ts tools/testing/e2e/specs/flows/metahub-entities-v2-runtime.spec.ts --project=chromium`
- `pnpm build`

## 2026-04-12 Entity V2 Post-Rebuild Regression Remediation

Closed the remaining post-rebuild regression debt on the already-shipped Entity V2 surface without widening schema/template versions or reopening a new product wave. This pass finished the last real defects that only remained after the earlier baseline/fixture repair: delegated Sets V2 and Enumerations V2 no longer crash on entity-owned routes, preset-derived compatible kind keys now resolve through the shared helper layer, and backend exact-kind list scoping no longer leaks built-in rows into custom V2 filtered surfaces.

| Area | Resolution |
| --- | --- |
| Delegated Set/Enumeration runtime stability | `SetList` and `EnumerationList` now restore the resolved `kindKey` alias from `entityKindKey`, so the reused legacy authoring surfaces stop crashing on delegated entity-owned V2 routes. |
| Preset-derived compatibility resolution | `getLegacyCompatibleObjectKindForKindKey(...)` now recognizes exact default compatible kind keys plus suffixed preset-derived variants such as `custom.hub-v2-demo`, and focused `@universo/types` plus route-helper regressions lock that behavior. |
| Exact requested-kind filtering | `resolveRequestedLegacyCompatibleKinds(...)` now returns only the explicitly requested compatible custom kind for list routes instead of widening back to the built-in/custom union, which prevents built-in hub/set/enumeration rows from leaking into custom V2 filtered surfaces. |
| Validation | Focused `@universo/types` and metahubs-frontend shared route-helper regressions passed, focused backend hubs/sets/enumerations route coverage passed (`39/39`), `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the targeted Chromium legacy-compatible V2 suite passed (`6 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/types test -- --run src/__tests__/entityTypes.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/shared/__tests__/legacyCompatibleRoutePaths.test.ts`
- Focused backend hubs/sets/enumerations route test rerun (`39/39`)
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-legacy-compatible-v2.spec.ts --project=chromium`
- `pnpm build`

## 2026-04-11 Entity V2 Residual QA Remediation

Closed the reopened residual QA debt on the already-shipped legacy-compatible V2 surface without widening the product scope. This pass focused on backend regression proof rather than new product code: the current tree now has direct tests for compatibility-aware metahub counts, `kindKey`-scoped Hub/Set/Enumeration V2 legacy list visibility, branch partial-copy/prune custom-kind grouping, and hub-nesting settings cleanup/read queries.

| Area | Resolution |
| --- | --- |
| Compatibility-aware counts | Focused route regressions now prove metahub board/list counts use compatibility kind arrays with `ANY($n::text[])` semantics instead of stale exact built-in kind SQL assumptions. |
| Legacy-compatible V2 list visibility | Focused Hub/Set/Enumeration route tests now prove `kindKey`-scoped legacy list routes include compatible custom rows instead of only built-in kinds. |
| Branch/settings service seams | Focused service coverage now proves partial-copy compatibility/prune groups include custom compatible kinds, and `MetahubSettingsService` now has direct hub-nesting tests over built-in + compatible custom hub kinds. |
| Validation | Focused `@universo/metahubs-backend` reruns passed for all 7 touched suites (`110` tests total, `106` passed, `4` skipped), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/routes/metahubBoardSummary.test.ts src/tests/routes/metahubsRoutes.test.ts src/tests/routes/hubsRoutes.test.ts src/tests/routes/setsRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts src/tests/services/metahubBranchesService.test.ts src/tests/services/MetahubSettingsService.test.ts`
- `pnpm build`

## 2026-04-11 Entity V2 QA Closure Completion

Closed the last QA-completion gaps on the legacy-compatible V2 publication/runtime surface without widening scope. This pass preserved merged compatibility metadata from publication snapshots into applications-backend runtime and release-bundle normalization, generalized compatibility-aware executable handling for custom hub/set/enumeration kinds, preserved explicit snapshot table names in executable payloads, added the missing Hub V2 menu-widget browser proof, and finished on green focused/browser/build evidence.

| Area | Resolution |
| --- | --- |
| Publication/runtime compatibility propagation | `SnapshotSerializer` now remains aligned with downstream applications-backend normalization, so legacy-compatible V2 hub/set/enumeration rows keep their merged compatibility metadata through publication, runtime filtering, and release-bundle generation. |
| Executable entity contract | `publishedApplicationSnapshotEntities` now propagates snapshot `tableName` into executable `physicalTableName`, and the shared `SnapshotEntityDefinition` contract now declares optional `tableName` so full-build type checks stay aligned with the runtime payload seam. |
| Browser-proof closure | The legacy-compatible V2 Chromium flow now proves Hub V2 rows are selectable from the menu-widget Bound hub picker, and the final rerun passed after correcting the interaction to target the actual combobox control rendered by the dialog. |
| Validation | Focused `SnapshotSerializer` and `applicationReleaseBundle` regressions passed, the targeted Chromium hub-binding flow passed, `pnpm run build:e2e` completed green, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- Focused `SnapshotSerializer` regression suite
- Focused `applicationReleaseBundle` regression suite
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-legacy-compatible-v2.spec.ts --project chromium --grep "Hub V2 instances are selectable in menu widget hub bindings"`
- `pnpm run build:e2e`
- `pnpm build`

## 2026-04-11 Entity V2 Completion Remediation Closure

Closed the remaining post-QA completion defects on the legacy-compatible V2 surface without widening scope. This pass fixed the missing delegated `kindKey` propagation for direct Set and Enumeration leaf/detail routes, closed the backend direct-enumeration update seam that still hardcoded the built-in `enumeration` kind, refreshed the committed self-hosted fixture through the supported generator path, and finished on green browser/docs/build evidence.

| Area | Resolution |
| --- | --- |
| Delegated Set and Enumeration flows | Direct Set constants and Enumeration detail/value flows now keep compatibility context end to end through frontend APIs, hooks, query keys, invalidation paths, and the backend direct enumeration PATCH path. |
| Browser-proof hardening | The targeted legacy-compatible V2 Playwright proof now compares response pathnames instead of raw full URLs, so expected `?kindKey=...` query params do not create false-negative timeouts on fixed routes. |
| Fixture and snapshot closure | The supported self-hosted generator regenerated `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with the published V2 entity definitions, and the full snapshot export/import browser suite is green again after aligning the slow import test budget with the expanded fixture verification scope. |
| Validation | Focused frontend query-key coverage passed, the focused backend enumeration route regression passed (`18/18`), the targeted Chromium legacy-compatible V2 rerun passed (`3 passed`), the self-hosted generator passed (`2 passed`), the snapshot export/import suite passed (`5 passed`), `pnpm docs:i18n:check` passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/shared/__tests__/queryKeys.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/routes/enumerationsRoutes.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-legacy-compatible-v2.spec.ts --project chromium --grep "Sets V2 delegated workspace flow preserves legacy lifecycle and browser leaf authoring|Enumerations V2 delegated workspace flow preserves legacy lifecycle and browser leaf authoring"`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts --project chromium`
- `pnpm docs:i18n:check`
- `pnpm build`

## 2026-04-11 Entity V2 Generalization Completion

Closed the reopened post-route-ownership implementation wave for legacy-compatible V2 entity kinds without widening scope into a second CRUD stack. This final pass kept the entity-route delegation layer intact, then finished the remaining compatibility seams across backend mutations, scoped frontend caches, runtime section selection, publication snapshot materialization, and schema-ddl classification so hub-v2, set-v2, enumeration-v2, and catalog-v2 now behave like their mature legacy counterparts while preserving stored custom kind identity.

| Area | Resolution |
| --- | --- |
| Frontend scoped ownership | Hubs/sets/enumerations query keys, API adapters, mutation hooks, optimistic cache prefixes, and list UIs now carry optional `kindKey`, so legacy-compatible entity routes no longer share unscoped caches or writes with the legacy built-in surfaces. |
| Runtime/publication/schema compatibility | `runtimeRowsController`, `SnapshotSerializer`, `SchemaGenerator`, `diff`, and `SchemaMigrator` now classify catalog/hub/set/enumeration behavior from compatibility metadata and known V2 kind keys instead of exact built-in literals, while filtering out unsupported `document` fallbacks from the narrower helper unions. |
| Backend closure and build-only debt cleanup | The reopened backend compatibility pass now preserves stored custom kinds through hub/set/enumeration mutation paths, and the final validation sweep also removed the compile-only controller/service leftovers that surfaced only under the canonical root build. |
| Validation | Focused metahubs-frontend regressions passed for scoped cache isolation, focused schema-ddl compatibility tests passed (`69/69`), focused `SnapshotSerializer` and `runtimeRowsController` suites passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/shared/__tests__/queryKeys.test.ts src/domains/shared/__tests__/optimisticMutations.remaining.test.tsx`
- `pnpm --filter @universo/schema-ddl test -- --runInBand src/__tests__/SchemaGenerator.test.ts src/__tests__/diff.test.ts src/__tests__/SchemaMigrator.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/SnapshotSerializer.test.ts`
- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/controllers/runtimeRowsController.test.ts`
- `pnpm build`

## 2026-04-11 Entity V2 Route Ownership Closure

Closed the still-open route-ownership slice of the Entity V2 generalization wave without widening into a second CRUD stack. This pass finished the compatibility surface that was missing after the sidebar-order/preset work: hub/set/enumeration-compatible V2 kinds now delegate through the existing mature authoring pages, nested entity routes keep navigation inside the active `/entities/:kindKey/...` shell, and breadcrumbs follow the legacy-compatible detail names instead of falling back to the generic entity detail endpoint.

| Area | Resolution |
| --- | --- |
| Sidebar ordering and presets | Shared entity-type UI config now persists `sidebarOrder`, the new built-in `hub-v2`, `set-v2`, and `enumeration-v2` presets are registered with explicit `legacyObjectKind` metadata, and dynamic metahub menu items sort by explicit sidebar order before title fallback. |
| Legacy-compatible delegation and route ownership | `EntityInstanceList` now delegates hub/set/enumeration-compatible kinds in the same way as catalog-compatible kinds, shared route helpers preserve entity-route ownership for hub/catalog/set/enumeration detail paths, and core frontend routing now covers the nested entity-owned hub scope plus set/enumeration detail routes. |
| Breadcrumb continuity and focused proof | `NavbarBreadcrumbs` now resolves entity-route labels for hub/catalog/set/enumeration-compatible V2 routes through the matching legacy name hooks, focused metahubs-frontend tests now cover the new delegation and route helper contract (`12/12`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx src/domains/shared/__tests__/legacyCompatibleRoutePaths.test.ts`
- `pnpm build`

## 2026-04-11 Entities QA Closure Remediation

## 2026-04-11 PR #757 Review Comment QA Triage

Closed the actionable review-driven follow-up on top of the shipped Entities/ECAE branch without widening scope. The bot review raised one real create-path lifecycle risk and multiple indentation-only comments. The real risk was fixed by making the generic create path reuse the same preallocated object id for `beforeCreate`, persistence, and `afterCreate`, while the style comments were rejected after package-local codebase verification instead of being applied blindly.

| Area | Resolution |
| --- | --- |
| Review triage | Public GitHub PR review data showed one substantive create-path concern and a batch of indentation comments. Package-local verification showed the indentation comments were not a reliable indicator for the touched metahubs-backend files. |
| Lifecycle id consistency | `MetahubObjectsService.createObject(...)` now accepts an optional explicit id, and generic custom-entity create passes the preallocated pending UUID into persistence so `beforeCreate` and `afterCreate` can target the same persisted object id. |
| Validation | Focused metahubs-backend coverage passed (`34/34`) across entity instance routes, lifecycle services, and object-service tests, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/routes/entityInstancesRoutes.test.ts src/tests/services/MetahubObjectsService.test.ts src/tests/services/EntityLifecycleServices.test.ts`
- `pnpm build`

Closed the remaining QA-closure seams around generic entity automation without widening scope beyond the shipped ECAE/Catalogs surface. This pass finished the real lifecycle path for generic create, verified the automation ACL question against the actual mounted surface, published the missing EN/RU authoring docs/assets, fixed the one compile-only regression the canonical build exposed, and finished on green backend/frontend/docs/browser/root-build evidence.

| Area | Resolution |
| --- | --- |
| Generic create lifecycle parity | `entityInstancesController` now routes generic custom-entity create through `EntityMutationService`, and the service resolves the committed object id from the mutation result before `afterCreate` dispatch so lifecycle actions execute against the real created row. |
| ACL and automation proof | Focused `EntityAutomationTab` coverage now locks save-first validation plus action/event authoring seams, while focused `EntityInstanceList` coverage still proves catalog-compatible routes delegate to `CatalogList` instead of mounting the generic automation tabs. |
| Documentation closure | EN/RU `custom-entity-types` guides now document the save-first `Scripts -> Actions -> Events` workflow, explain the catalog-compatible routing nuance, and ship stable visual references under `docs/assets/entities/`. |
| Validation and build-only fix | Focused metahubs backend coverage passed (`27/27`), focused metahubs frontend automation coverage passed (`12/12`), `pnpm docs:i18n:check` passed, `pnpm run build:e2e` completed green after fixing a missing `DbExecutor` type import in `EntityActionExecutionService`, the targeted Chromium automation flow passed (`2 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/EntityLifecycleServices.test.ts src/tests/services/EntityActionExecutionService.test.ts src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityAutomationTab.test.tsx src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `pnpm docs:i18n:check`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts --project chromium --grep "custom entity instances author scripts actions and events through the browser with custom attachment kinds"`
- `pnpm build`

## 2026-04-11 ECAE Residual Completion

Closed the last explicitly tracked residual ECAE seams without widening scope beyond the already promised delivery wave. This pass stayed narrow and evidence-driven: route generic entity create through the lifecycle boundary, add edit-only object-scoped Actions and Events authoring to the generic custom-entity dialog, extend focused regression coverage, and prove the full script → action → event-binding path in the browser before closing on a green root build.

| Area | Resolution |
| --- | --- |
| Generic create lifecycle parity | `entityInstancesController` now routes generic custom-entity create through `EntityMutationService`, and the service can resolve the after-commit object id from the mutation result so `afterCreate` dispatch targets the real created object row instead of a placeholder id. |
| Generic entity automation authoring | `EntityInstanceList` now mounts edit-only `Actions` and `Events` tabs in the existing `EntityFormDialog`, backed by new frontend object-scoped API helpers for `_mhb_actions` and `_mhb_event_bindings`, while create/copy dialogs keep their intentionally smaller surface. |
| Regression and browser proof | Focused frontend coverage now proves create vs edit tab composition, and the targeted Chromium `metahub-entities-workspace` flow now proves browser-authored script creation, action creation, event-binding creation, plus API-level persistence checks for the resulting object-owned automation rows. |
| Validation | Focused metahubs backend tests passed (`25/25`), focused metahubs frontend dialog coverage passed (`7/7`), the targeted Chromium automation flow passed (`2 passed` including auth bootstrap), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/EntityLifecycleServices.test.ts src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs --grep "custom entity instances author scripts actions and events through the browser"`
- `pnpm build`

## 2026-04-11 Entities QA Remediation Hardening

Closed the remaining high-confidence QA defects that were still live after the broader Entities/Catalogs waves. This pass stayed narrow and evidence-driven: repair the real `ElementList` hook-order violation, harden design-time entity lifecycle semantics so post-commit `after*` failures cannot report false API failures, add a focused regression for the backend contract, and finish on a green canonical root build.

| Area | Resolution |
| --- | --- |
| Frontend hook-order repair | `ElementList` now declares `buildCatalogTabPath` before the invalid/loading/error early returns, preserving stable React hook order while keeping the existing catalog-compatible tab navigation flow intact. |
| Backend lifecycle hardening | `EntityMutationService` now routes post-commit `after*` dispatches through a dedicated fire-and-log helper, so mutations that have already committed return successfully even if a post-commit lifecycle handler later fails. |
| Regression proof | Focused lifecycle service coverage now proves the mutation result still resolves successfully while the post-commit failure is logged, locking the non-blocking after-commit contract directly. |
| Validation | Focused `EntityLifecycleServices` coverage passed (`3/3`), touched frontend/backend lint reruns returned to the warning-only backlog with no error-level failures, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/EntityLifecycleServices.test.ts`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm build`

## 2026-04-11 Entities Workspace Post-Rebuild QA Closure

Closed the residual live defects that surfaced only after a clean rebuild, DB reset, and re-import of the committed self-hosted metahub snapshot. This pass stayed intentionally narrow: restore the last `EntitiesWorkspace` UX seams, harden the shared menu/edit path against missing row-level payloads, pluralize the Catalog V2 product strings everywhere they are user-facing, and refresh the generated fixture through the supported Playwright export path without changing codename or structure/template versions.

| Area | Resolution |
| --- | --- |
| Entities page parity | `EntitiesWorkspace` no longer renders the obsolete top description, the info banner now uses tighter side spacing, the header CTA follows the shared `Create` contract, and built-in Documents rows resolve localized labels instead of leaking raw `metahubs:documents.title`. |
| Shared menu and edit robustness | The three-dots menu now follows the legacy danger-group contract, and edit/delete handlers resolve the current entity definition from the live entity-type map so list-view actions still work when table rows omit or stale `raw` payloads. |
| Product naming and fixture refresh | User-facing `Catalog V2` strings are now pluralized to `Catalogs V2` / `Каталоги V2` across presets, mocks, tests, Playwright flows, fixture contracts, and the regenerated `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, while `custom.catalog-v2` and version metadata remain unchanged. |
| Validation | Focused metahubs backend coverage passed (`24/24`), focused metahubs frontend coverage passed (`22/22`), `pnpm run build:e2e` completed green, the supported self-hosted generator rerun passed, the focused Chromium entities workspace flow passed (`4 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/templatesRoutes.test.ts src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/entities/ui/__tests__/entityTypePreset.test.ts src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx src/i18n/__tests__/index.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts --project chromium`
- `pnpm build`

## 2026-04-11 Catalog V2 QA Closure Implementation

Closed the user-reported post-QA defects on the shipped Catalog V2 shared surface without widening scope. This pass kept the route/storage model intact while restoring the remaining UX seams: `EntitiesWorkspace` now follows the shared three-dots action contract, catalog-compatible entity breadcrumbs continue through the instance and tab routes, built-in Documents labels resolve in both locales, and the focused browser proof now matches the real shared Catalogs contract instead of stale generic-entity expectations.

| Area | Resolution |
| --- | --- |
| Shared action parity | `EntitiesWorkspace` now reuses `BaseEntityMenu` in both list and card modes, eliminating the custom icon-button cluster and locking the list-view edit path behind the same trigger/item contract already used by the browser suite. |
| Breadcrumb and i18n closure | `NavbarBreadcrumbs` now resolves catalog-compatible entity-instance breadcrumbs through the standalone catalog name hook, continues tab labels for `attributes`, `system`, `elements`, and `layout`, and EN/RU metahubs locale bundles now include the missing built-in `documents.title` entry. |
| Focused regression proof | Focused RTL now proves the shared list-view menu opens the populated edit dialog, the targeted workspace/browser flow now asserts entity-route breadcrumb continuation, and the publication/runtime flow now follows the real shared Catalogs contract (`Catalogs` heading, `Create` toolbar label, `Create Catalog` dialog, create mutation via `/catalogs`). |
| Validation | Focused `@universo/metahubs-frontend` RTL passed (`5/5`), the canonical root `pnpm build` completed green (`30 successful`, `30 total`), both affected Chromium flow specs passed in isolation, and the combined targeted Chromium rerun passed (`5 passed`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx`
- `pnpm build`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts --project chromium`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-publication-runtime.spec.ts --project chromium`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts tools/testing/e2e/specs/flows/metahub-entities-publication-runtime.spec.ts --project chromium`

## 2026-04-10 Catalog V2 Shared Surface Closure

## 2026-04-10 Catalog V2 Entity Route Isolation Recovery

Closed the user-reported Catalog V2 regression where the new entity-based catalog surface still fell back to the legacy catalog route tree after load. This pass kept the shared storage model intact but restored route ownership to Catalog V2 itself: list clicks, tab navigation, and blocking-reference links now stay inside the entity-based authoring routes instead of jumping into `/catalog/:id/*`.

| Area | Resolution |
| --- | --- |
| Entity route ownership | Core frontend now registers entity detail routes for `attributes`, `system`, and `elements`, so Catalog V2 no longer depends on legacy catalog routes after the list click. |
| Shared route-aware UI reuse | `CatalogList`, `AttributeList`, `ElementList`, and the catalog/set/enumeration blocking dialogs now resolve authoring links through one helper that prefers `/entities/:kindKey/instance/:catalogId/*` when the current route carries `kindKey`, while legacy catalog pages still keep their original paths. |
| Catalog V2 first-paint behavior | `EntityInstanceList` now treats the known `custom.catalog-v2` route as catalog-compatible before entity-type metadata finishes loading, removing the brief generic entity-shell flash before the catalog-compatible UI appears. |
| Validation | Focused `@universo/metahubs-frontend` Vitest coverage passed (`13/13`) across the touched entity/attribute/element route regressions, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/elements/ui/__tests__/ElementList.settingsContinuity.test.tsx`
- `pnpm build`

## 2026-04-10 Catalog V2 Shared Surface Closure

Closed the residual post-QA Catalog V2 gaps without widening into a new ECAE phase. This pass kept scope tight: route catalog-compatible entity pages through the same authoring surface as legacy Catalogs, preserve localized preset labels in both EN and RU, restore read-only ACL behavior after the shared-surface switch, and refresh the committed self-hosted fixture through the supported generator path.

| Area | Resolution |
| --- | --- |
| Shared Catalog V2 route parity | `EntityInstanceList` now delegates catalog-compatible kinds to `CatalogList`, so the dynamic Catalog V2 route mirrors the legacy Catalogs authoring surface instead of rendering a generic empty-state shell that only exposed `custom.catalog-v2` rows. |
| Localized preset persistence | The `catalog-v2` preset now seeds localized `presentation.name` / `presentation.description`, entity-type form patches preserve both locales, persisted entity-type payloads keep localized presentation data, and dynamic menu rendering now prefers localized presentation labels before raw UI keys. |
| Shared-surface ACL hardening | `CatalogList` now uses the metahub `editContent` / `deleteContent` permission seam to hide create/edit/copy/delete affordances, preventing the shared Catalog V2 surface from leaking authoring actions to read-only metahub members after the route delegation change. |
| Generator and validation | Focused frontend tests passed, `pnpm run build:e2e` completed green, the focused workspace Playwright flow passed (`4 passed`), the focused visual parity spec passed (`2 passed`), and the supported generator reran successfully to refresh `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with snapshot hash `2da40a60d9af46d3976be0233fbe2888118b8b81b58fdd2075fadee129660b00`. |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx src/domains/entities/ui/__tests__/entityTypePreset.test.ts`
- `pnpm --filter @universo/template-mui test -- src/components/dashboard/__tests__/MenuContent.test.tsx`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/visual/metahub-catalogs-v2-parity.visual.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"`

## 2026-04-10 ECAE Generator And Deleted-State QA Gap Closure

Closed the last evidence-backed QA gap on the shipped Catalogs v2 parity surface. This pass stayed intentionally narrow: align the self-hosted fixture contract with the canonical backend structure-version source, restore a deleted-row detail seam for the focused catalog-compatible lifecycle proof without widening the default read contract, accept the new full-page-shell visual baselines, and finish on a green canonical root build.

| Area | Resolution |
| --- | --- |
| Self-hosted fixture contract | `selfHostedAppFixtureContract.mjs` now resolves `CURRENT_STRUCTURE_VERSION_SEMVER` from metahubs-backend dist with a `0.4.0` fallback instead of hardcoding a stale legacy semver, and the regenerated committed self-hosted snapshot now carries `structureVersion: 0.4.0` plus `snapshot.entityTypeDefinitions['custom.catalog-v2']`. |
| Deleted-detail route parity | Generic custom-entity detail reads stay active-row-only by default, but the controller now accepts explicit `includeDeleted=true` and forwards `{ includeDeleted: true }` to `MetahubObjectsService.findById(...)`, which preserves the default runtime/read contract while letting deleted-state and restore flows validate soft-deleted rows directly. |
| Browser and visual proof closure | The focused `metahub-entities-workspace` browser proof now polls deleted/restore state through the explicit deleted-read seam, and the `metahub-catalogs-v2-parity` visual suite now includes committed Linux page-shell baselines for both legacy Catalogs and the catalog-compatible entity surface. |
| Final validation | Focused backend route coverage passed (`21/21`), `pnpm run build:e2e` completed green, the focused lifecycle/browser proof passed (`2 passed`), the focused visual parity spec passed (`2 passed`), and the canonical root `pnpm build` completed green with explicit `EXIT:0`. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts --project chromium --grep "preset-backed create flow"`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/visual/metahub-catalogs-v2-parity.visual.spec.ts --project chromium`
- `pnpm build`

## 2026-04-10 ECAE Final Closeout

Closed the remaining end-of-session tooling and ledger debt after re-auditing the current ECAE tree. This pass verified that generic REF support, custom-entity scripting, and the stronger browser proof were already present on the shipped surface, then limited code changes to the residual TS6 `tsconfig` diagnostics before re-running canonical validation.

| Area | Resolution |
| --- | --- |
| Verified shipped scope | Current-tree audit confirmed that generic REF support is already implemented across target selection, backend attribute validation, element editing, and focused regressions, while arbitrary custom-entity script attachments already flow through shared types, backend validation, frontend authoring, and runtime/application sync. |
| TS6 toolchain closeout | The touched backend/types packages now declare explicit `rootDir`, and the touched frontend/backend package configs that still rely on `baseUrl` now carry a workspace-compatible `ignoreDeprecations: "5.0"` guard under `typescript ^5.8.3`, keeping editor diagnostics clean without breaking real builds or widening into a monorepo-wide config rewrite. |
| Final validation | The patched `tsconfig` files are clean in editor diagnostics, and the canonical root `pnpm build` task completed successfully on the final patch set. |
| Memory-bank sync | `tasks.md`, `activeContext.md`, and `techContext.md` now reflect that the remaining closeout scope was tooling plus ledger synchronization rather than unfinished product functionality. |

### Validation

- Editor diagnostics were rechecked on the touched package `tsconfig` files and returned clean.
- `pnpm build`

## 2026-04-10 ECAE Residual QA Hardening Closure

Closed the remaining honest QA hardening seams on the already shipped strict-parity surface without pretending that future Phase 5 work was partially implemented. This pass stayed intentionally narrow: align generic entity copy with the legacy codename-retry contract, lock the catalog-compatible settings-loading seam on the frontend, add a real browser proof for read-only member access to catalog-compatible instances, and finish on a green canonical root build.

| Area | Resolution |
| --- | --- |
| Generic copy retry parity | `entityInstancesController` now retries generated copy codenames across actual insert-time unique conflicts on `idx_mhb_objects_kind_codename_active`, matching the legacy copy-controller contract instead of relying on preflight availability checks alone. |
| Frontend fail-closed loading proof | `EntityInstanceList` coverage now proves catalog-compatible copy/delete affordances stay hidden while settings-derived entity permissions are still loading, even when `editContent` / `deleteContent` are already present. |
| Browser ACL proof | The targeted `metahub-entities-workspace` Playwright flow now proves an invited metahub member can open the catalog-compatible instances page read-only while create/edit/copy/delete affordances remain absent. |
| Final validation | Focused metahubs backend route coverage passed (`20/20`), focused metahubs frontend `EntityInstanceList` coverage passed (`9/9`), the targeted Playwright member ACL rerun passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts --project chromium --grep "catalog-compatible entity instances stay read-only for metahub members"`
- `pnpm build`

## 2026-04-10 ECAE QA Policy And ACL Closure

Closed the last QA-proven ACL/policy gap on the shipped Catalogs v2 surface without reopening the already validated ECAE delivery wave. This pass stayed intentionally narrow: restore legacy catalog policy parity for catalog-compatible generic mutations, restore the legacy `editContent`/`deleteContent` split on the generic catalog-compatible authoring surface, add direct negative-path regressions, and finish on a green canonical root build.

| Area | Resolution |
| --- | --- |
| Backend catalog-compatible parity | Generic catalog-compatible copy/delete/permanent-delete now reuse the same legacy catalog settings and reference-blocking protections as legacy Catalogs, while create/update/copy/restore/reorder vs delete/permanent-delete enforce the matching `editContent` / `deleteContent` permission split instead of falling back to `manageMetahub` for everything. |
| Frontend catalog-compatible parity | `EntityInstanceList` now mirrors the legacy catalog action model for catalog-compatible kinds, including settings-aware copy/delete visibility, `CatalogDeleteDialog` reuse for blocked deletes, restore/permanent-delete visibility parity, and fail-closed settings handling in `useEntityPermissions`. |
| Focused regression proof | Focused backend route coverage now locks `catalogs.allowCopy`, `catalogs.allowDelete`, and blocking-reference negative paths, while focused frontend coverage proves editor-capable catalog-compatible authoring, delete-dialog reuse, and deleted-row restore/permanent-delete visibility semantics. |
| Final validation | The focused metahubs backend suite passed (`18/18`), the focused metahubs frontend `EntityInstanceList` suite passed (`8/8`), touched package lint reruns returned to no new error-level debt, and the canonical root `pnpm build` completed green with explicit `EXIT:0`. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm build`

## 2026-04-10 ECAE Final Parity Verification Closure

Closed the last evidence-backed parity seam on the shipped Catalogs v2 surface after the final validation rerun exposed a stale shared-field accessibility regression in the legacy copy dialog. This pass stayed intentionally narrow: restore explicit labels on the shared General tab fields for the remaining legacy action dialogs, rebuild the served frontend bundle, strengthen the visual parity proof so it measures only the actually shared edit surface, and finish on a green canonical root build.

| Area | Resolution |
| --- | --- |
| Legacy shared-field repair | `CatalogActions`, `EnumerationActions`, and `SetActions` now pass explicit `GeneralTabFields` labels/helpers again, restoring accessible `Name` / `Description` / `Codename` wiring for legacy copy/edit dialogs and unblocking the real browser copy flow. |
| Browser proof closure | The focused `metahub-entities-workspace` and `metahub-entities-publication-runtime` Playwright flows reran green (`3/3` total), confirming the legacy catalog copy route now reaches the real `/catalog/:id/copy` mutation again on the compiled app bundle. |
| Visual parity hardening | The Catalogs v2 visual parity spec now uses shared Playwright snapshots for the true whole-dialog create/copy parity surfaces and a shared General edit-panel snapshot for edit mode, explicitly tolerating the intentional additive `Attributes` tab and external delete affordance on the entity edit shell. |
| Final validation | The touched frontend lint surface is clean, `pnpm run build:e2e` rebuilt the served frontend/backend bundle successfully, the focused visual spec set passed (`3/3`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm exec eslint packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationActions.tsx packages/metahubs-frontend/base/src/domains/sets/ui/SetActions.tsx`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entities-workspace.spec.ts specs/flows/metahub-entities-publication-runtime.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/visual/metahub-catalogs-v2-parity.visual.spec.ts specs/visual/metahub-entities-dialog.visual.spec.ts`
- `pnpm build`

## 2026-04-10 ECAE Read-Only Entity Contract Closure

Closed the last QA-proven mismatch on the shipped strict-parity surface without widening into future Phase 5 scope. This pass aligned backend entity-type read access with the already shipped read-only entity UI contract, added focused regressions on both sides of the seam, cleaned the touched lint surface back to the warning-only backlog, and finished with a green canonical root build.

| Area | Resolution |
| --- | --- |
| Backend read contract | `entityTypesController` now allows metahub members to load entity-type list/detail data needed by read-only surfaces, while create/update/delete remain gated by `manageMetahub`. |
| Frontend regression sync | Focused entity read-only tests now continue showing the `EntitiesWorkspace` and `EntityInstanceList` shells for members without exposing create/edit/delete/instances affordances. |
| Validation and lint closure | Focused backend/frontend tests passed, targeted Prettier repair removed the touched error-level lint failures, package lint reruns returned to the existing warning-only backlog (`0 errors`), and the canonical root `pnpm build` completed green. |
| Scope integrity | The memory-bank closure sync keeps the strict parity wave honest while leaving Phase 5 explicitly deferred as future post-parity work. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entitiesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm build`

## 2026-04-09 ECAE Strict Catalogs v2 Parity Closure

Closed the last strict acceptance seam that kept Catalogs v2 from being treated as honestly parity-complete with legacy Catalogs. This pass stayed narrow and evidence-driven: widen the backend compatibility pool for catalog-compatible custom kinds, switch the generic entity instance page into catalog semantics where the entity definition explicitly opts into legacy catalog compatibility, and prove the result through focused backend/frontend/browser validation before the canonical root build.

| Area | Resolution |
| --- | --- |
| Backend catalog-compatible pool | Legacy catalog routes now accept catalog-compatible custom rows for list/get/update/reorder/delete flows, generic custom-entity copy accepts catalog-style `copyAttributes` / `copyElements` overrides, and script attachment validation resolves catalog-compatible custom rows behind the legacy `catalog` attachment kind. |
| Frontend catalog mode | `EntityInstanceList` now detects catalog-compatible custom kinds and reuses catalog semantics for labels, copy options, scripts, and dialog behavior while keeping the generic restore/permanent-delete path intact. |
| Focused parity proof | Focused backend route/service tests are green, the `EntityInstanceList` frontend regressions are green, the `metahub-entities-workspace` Playwright flow now proves create/edit/copy catalog-mode behavior plus RU navigation parity, and the `metahub-entities-publication-runtime` flow remains green for published runtime section resolution. |
| Final validation | `pnpm run build:e2e` completed green and the canonical root `pnpm build` completed green (`30 successful`, `30 total`), leaving the strict parity patch set without known build regressions. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/catalogsRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts src/tests/services/MetahubScriptsService.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-publication-runtime.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts`
- `pnpm build`

## 2026-04-09 ECAE Phase 3.6-4 Final Closure

Closed the remaining ECAE implementation wave end to end. This pass repaired the last builder accessibility contract, proved the repaired surface through focused frontend/build/browser evidence, added the missing Phase 3.8 compatibility proofs for legacy snapshot and adapter parity seams, shipped the EN/RU documentation set, and finished with a green canonical root build.

| Area | Resolution |
| --- | --- |
| Structured builder closure | `EntitiesWorkspace` now uses the restored structured builder controls with real checkbox semantics for authoring tabs, publish-to-menu, and component toggles; the focused frontend regressions are green again (`5/5`). |
| Browser and runtime proof | The focused `metahub-entities-workspace` and `metahub-entities-publication-runtime` Playwright flows are green (`2/2` each), confirming workspace authoring, dynamic menu publication, and runtime section rendering end to end. |
| Phase 3.8 compatibility proof | Focused backend proofs now cover legacy snapshot restore when v3-only entity metadata sections are absent and verify that the legacy catalog-wrapper system-attribute reads stay aligned with the object-scoped adapters (`27/27`). |
| Phase 4 docs and final validation | EN/RU architecture + custom entity guide pages now ship alongside updated REST API entries and summaries, the touched EN/RU doc pairs were line-count aligned manually, the repository-standard docs i18n check passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/entities/ui/__tests__/entityTypePreset.test.ts`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-publication-runtime.spec.ts`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/SnapshotRestoreService.test.ts src/tests/services/MetahubAttributesService.test.ts`
- `pnpm docs:i18n:check`
- `pnpm build`

## 2026-04-09 ECAE QA Closure Follow-up

Closed the two residual follow-up seams left after the Phase 3.3-3.5 QA verdict: the runtime parent-row inline PATCH controller now fails closed through the same `editContent` permission seam as the rest of the runtime mutation surface, and the long-term ECAE checklist no longer contradicts the already verified Phase 3.3-3.5 closure state.

| Area | Resolution |
| --- | --- |
| Runtime parent-row edit guard | `applications-backend` `updateCell` now enforces `ensureRuntimePermission(..., 'editContent')` immediately after runtime schema resolution, preventing denied inline PATCH requests from touching runtime catalogs or business tables. |
| Focused regression closure | The applications-backend route suite now includes a regression that temporarily disables `editor.editContent` and proves inline PATCH returns `403` before any runtime table query begins. |
| Memory-bank closure sync | `tasks.md` now marks Phase 1, Phase 2.5c, and Phase 3.3-3.5 as complete in the canonical plan checklist, aligning the ledger with the already green closure evidence in `activeContext.md` and this progress log. |

### Validation

- `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts`
- `pnpm build`

## 2026-04-09 ECAE Phase 3.3-3.5 Closure

Closed the snapshot/runtime genericization wave on top of the already validated Phase 3.2 entity shell. This pass finished the snapshot v3 closure, validated the custom-type DDL propagation path, and shipped the backward-compatible runtime `section*` alias contract across backend, frontend, and shared template-mui surfaces without dropping the legacy catalog fields yet.

| Area | Resolution |
| --- | --- |
| Snapshot v3 closure | Snapshot serialize/restore now preserve v3 custom entity definitions, nested action/event data, and the legacy catalog system-field compatibility needed for safe restores. |
| DDL custom-type pipeline | `@universo/schema-ddl`, metahub publication/runtime sync, and application workspace table-name resolution now validate the custom physical-table prefix and `table_name` propagation end to end. |
| Runtime/shared contract genericization | `applications-backend`, `applications-frontend`, and `apps-template-mui` now expose `section`, `sections`, and `activeSectionId` alongside the legacy catalog fields; runtime helpers resolve backend payloads through `sectionId ?? catalogId`, and user-facing runtime copy now refers to sections instead of catalog-only wording. |
| Regression, lint, and build closure | Focused runtime regressions passed, the touched-file lint surface was cleaned back to no new error-level debt, the touched package builds passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`, `30 cached`). |

### Validation

- `pnpm --filter @universo/apps-template-mui test -- --run src/hooks/__tests__/useCrudDashboard.test.tsx`
- `pnpm --filter @universo/applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts`
- `pnpm build`

## 2026-04-09 ECAE Post-QA Closure Remediation

Closed the remaining QA-proven debt on the shipped Phase 3.2 shell/dialog/entity surface before Phase 3.3 begins. This pass stayed intentionally narrow: fix the real shared-seam defects found during QA, tighten the touched lint surface back to `0 errors`, add regressions exactly where the evidence was missing, and revalidate through focused tests, package builds, and the canonical root build.

| Area | Resolution |
| --- | --- |
| Shared shell auth seam | `@universo/template-mui` `MenuContent` no longer uses raw `fetch` for metahub/application shell resources; it now uses the shared auth-aware `useAuth().client` seam and keeps query enablement gated behind auth bootstrap. |
| Shared dialog safety | `ConflictResolutionDialog` now keeps `useDialogPresentation(...)` on a stable hook order even when `conflict` toggles between `null` and a real payload, and the dialog test suite now locks the null → payload → null rerender path. |
| Focused regression and lint closure | `MenuContent.test.tsx`, the new `ConflictResolutionDialog.test.tsx`, and entity instance regressions now cover the previously unproven QA seams; formatter drift was removed, touched entity files no longer carry local warning debt, and both touched-package lint runs returned to the repository's warning-only backlog (`0 errors`). |
| Validation | Focused template-mui and metahubs-frontend tests passed, `@universo/template-mui` and `@universo/metahubs-frontend` builds passed, and the canonical root `pnpm build` completed green, closing the remediation wave without widening into Phase 3.3 work prematurely. |

### Validation

- `pnpm --filter @universo/template-mui lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/template-mui test -- --runInBand src/components/dashboard/__tests__/MenuContent.test.tsx src/components/dialogs/__tests__/ConflictResolutionDialog.test.tsx`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
- `pnpm --filter @universo/template-mui build`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm build`

## 2026-04-09 ECAE Phase 3.2 QA Remediation And Dynamic Published Menu

Closed the first honest Phase 3.2 shell/navigation checkpoint on top of the shipped generic entity-instance surface. This pass stayed narrow and evidence-driven: repair the QA-proven permanent-delete and ACL gaps, expose published custom-kind metadata through the existing entity-type contract, ship the first dynamic published menu zone without regressing coexistence-first navigation, and prove the result in a real browser flow before widening into later snapshot/runtime work.

| Area | Resolution |
| --- | --- |
| Permanent delete and backend metadata | Generic permanent delete now fails closed unless the custom entity row is already soft-deleted, and custom entity-type list responses now expose `published` so downstream shell consumers can derive published custom-kind navigation without a second metadata endpoint. |
| Shell ACL and dynamic menu zone | The metahub shell now filters authoring-only entries through the existing metahub-details permission seam, keeps `Access` separately gated through `manageMembers`, resolves raw-title menu labels safely, and inserts published custom-kind links between the legacy built-in object cluster and the publications/admin cluster. |
| Focused regressions and browser proof | Focused template-mui menu/config tests now cover permission filtering, divider compaction, and published custom-kind ordering, while the Playwright `metahub-entities-workspace` flow now proves that a preset-backed custom entity type appears as a sidebar link and opens `/entities/:kindKey/instances` in both EN and RU. |
| Validation and build propagation | Focused backend/template-mui tests passed, touched package builds for `@universo/template-mui`, `@universo/metahubs-backend`, and `@universo/core-frontend` passed, and the canonical root `pnpm build` completed green after propagating the shell bundle change into the served frontend build. |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/EntityTypeService.test.ts src/tests/routes/entitiesRoutes.test.ts`
- `pnpm --filter @universo/template-mui test -- src/navigation/__tests__/menuConfigs.test.ts src/components/dashboard/__tests__/MenuContent.test.tsx`
- `pnpm --filter @universo/template-mui build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/core-frontend build`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts`
- `pnpm build`

## 2026-04-09 ECAE Phase 3.1 Generic Entity Instance UI

Closed the first generic entity-instance authoring slice on top of the validated entity-type foundation. This pass stayed intentionally scoped to the metahub authoring surface: ship one custom-kind `EntityInstanceList` page, wire it into the real product, keep unsupported scripts fail-closed, and prove the new seams through focused frontend coverage plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Generic instance authoring surface | Added the first `EntityInstanceList` page for custom kinds with list/card view, create/edit/copy/delete/restore/permanent-delete flows, deleted-row visibility, optimistic-lock conflict handling, and dedicated view-mode persistence. |
| Safe object-scoped reuse | Reused `EntityFormDialog`, `useListDialogs`, `GeneralTabFields`, config-backed hub assignment, and edit-only embedded attribute/layout surfaces where the existing object-id-backed seams were already safe; scripts stay explicitly gated behind a warning until the attachment contract is widened. |
| Product integration | Exposed the page through metahubs exports and core frontend routes, added the direct `EntitiesWorkspace` instances action, and generalized `HubSelectionPanel` with label overrides so the hub-assignment UI no longer leaks catalog-specific wording. |
| i18n, regressions, and validation | Added EN/RU `entities.instances.*` coverage, added focused tests for component-driven tab composition and workspace navigation, fixed the esbuild/vitest generic-arrow transform seam in the shared entity API helpers, and revalidated with passing focused tests, touched-package builds, and a green root `pnpm build`. |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- src/__tests__/exports.test.ts src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm --filter @universo/core-frontend build`
- `pnpm build`

## 2026-04-09 ECAE Phase 2.9 Browser And Visual Validation

Closed the browser-proof checkpoint for the shipped entity-type authoring slice before widening into Phase 3 runtime work. This pass stayed intentionally narrow: validate the real `Entities` workspace, preset-backed create dialog, backend persistence, RU parity, and screenshot stability on the already shipped authoring surface instead of inventing a premature generic runtime UI.

| Area | Resolution |
| --- | --- |
| Focused browser coverage | Added a dedicated Playwright flow for `EntitiesWorkspace` preset-backed entity-type creation, backend-confirmed persistence, and EN/RU parity using the shipped `/metahub/:metahubId/entities` authoring route. |
| Stable visual proof | Added a dedicated visual spec for the entity create dialog with a seeded preset and stabilized it by capturing the dialog after the preset selector loses focus, then refreshed the baseline to that non-focused state. |
| Product repair from browser evidence | The focused flow surfaced a real UI defect: list view rendered a blank primary `Name` cell. `EntitiesWorkspace` now renders the primary name column explicitly with `row.name || row.kindKey`, so newly created custom types remain visible in list mode. |
| Validation | Focused entity flow and visual checks passed after the repair and baseline refresh, and the canonical root `pnpm build` completed successfully, closing Phase 2.9 and moving the next checkpoint to Phase 3.1 generic entity instance UI. |

### Validation

- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts tools/testing/e2e/specs/visual/metahub-entities-dialog.visual.spec.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/visual/metahub-entities-dialog.visual.spec.ts`
- `pnpm build`

## 2026-04-09 ECAE Phase 2.7b Reusable Entity Presets

Completed the reusable entity preset checkpoint on top of the coexistence-first entity foundation without introducing a second preset store. This slice extends the existing metahub template registry so cross-metahub entity presets now reuse the same versioning, validation, and seeding seam as builtin metahub templates, and the `Entities` create dialog can safely prefill authoring state from those manifests.

| Area | Resolution |
| --- | --- |
| Template registry contract | Added shared template definition typing for `entity_type_preset`, exposed `definitionType` on list responses, and exposed `activeVersionManifest` on template detail responses so preset consumers can fetch typed active manifests from the existing templates API. |
| Builtin preset seeding | Added builtin entity preset manifests (`catalog-v2`, `document-workspace`, `constants-library`) and seeded them through the same `TemplateSeeder`, validator, and checksum-driven builtin-template migration path used by metahub templates. |
| Entity authoring flow | Generalized the frontend templates hooks/query keys/selector components for `definitionType`, added `EntityTypePresetSelector`, and wired create-mode preset application into `EntitiesWorkspace` so preset manifests prefill dialog state without affecting edit mode or bypassing normal validation/save behavior. |
| Validation and root-build stability | Focused backend/frontend regressions passed, touched-package lint stayed on the existing warning-only backlog (`0 errors`), and the canonical root `pnpm build` completed green after hardening `@universo/core-frontend` build memory with `NODE_OPTIONS='--max-old-space-size=8192'` for the Turbo workspace path. |

### Validation

- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/persistence/templatesStore.test.ts src/tests/services/templateManifestValidator.test.ts src/tests/routes/templatesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-frontend test -- src/__tests__/exports.test.ts src/domains/shared/__tests__/queryKeys.test.ts src/domains/entities/ui/__tests__/entityTypePreset.test.ts`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm --filter @universo/template-mui build`
- `pnpm --filter @universo/core-frontend build`
- `pnpm build`

## 2026-04-09 ECAE Phase 2.6-2.8 Frontend Entity Foundation

Completed the first validated frontend entity slice on top of the coexistence-first backend ECAE foundation. This checkpoint intentionally stopped at entity-type authoring and frontend integration seams: the new `Entities` workspace is reachable in the shipped shell, localized in EN/RU, covered by query-key smoke tests, and validated through touched-package checks plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Frontend API/hooks | Added the `domains/entities/api` and `domains/entities/hooks` surface with entity-type and generic entity query/mutation helpers aligned to the existing metahubs query-key architecture and invalidation helpers. |
| Workspace routing/navigation | Wired the first `EntitiesWorkspace` through metahubs package exports, core frontend lazy routes, shared template-mui navigation, breadcrumbs, and external-module typing so entity-type authoring is reachable below `Common` without cross-package local imports. |
| i18n and query-key closure | Added the shipped `metahubs.entities.*` EN/RU strings, exposed the `entities` namespace through the metahubs i18n consolidator, extended shared query-key smoke coverage for entity scopes/invalidators, and removed the unstable fallback-array hook warning in `EntitiesWorkspace`. |
| Validation | `@universo/metahubs-frontend` lint returned to the warning-only backlog (`0 errors`), focused exports/query-key tests passed, `@universo/metahubs-frontend`, `@universo/template-mui`, and `@universo/core-frontend` builds passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`, `2m48.007s`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-frontend test -- src/__tests__/exports.test.ts src/domains/shared/__tests__/queryKeys.test.ts`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm --filter @universo/template-mui build`
- `pnpm --filter @universo/core-frontend build`
- `pnpm build`

## 2026-04-08 ECAE Phase 2.5c Design-Time Service Genericization

Completed the first honest design-time genericization slice on top of the coexistence-first entity foundation. This checkpoint deliberately stopped short of broad layout-service rewrites and instead extracted the reusable seams that were already structurally shared: object-scoped system-attribute management and design-time child-copy orchestration.

| Area | Resolution |
| --- | --- |
| Object-scoped policy seam | `MetahubAttributesService` now exposes `listObjectSystemAttributes(...)`, `getObjectSystemFieldsSnapshot(...)`, and `ensureObjectSystemAttributes(...)` while keeping the legacy catalog-named wrappers as compatibility aliases. |
| Shared child-copy helper | Added `copyDesignTimeObjectChildren(...)` to centralize attribute, element, constant, and enumeration-value copy behavior plus optional system-attribute reseeding inside one transaction-aware helper. |
| Legacy/generic copy reuse | Catalog, set, and enumeration legacy copy controllers now use the shared helper internally without changing their public route ownership or response contracts, and generic custom-entity copy now derives child-copy breadth from enabled design-time components. |
| Validation | Focused backend regressions passed (`82/82`), `@universo/metahubs-backend` lint returned to the existing warning-only backlog (`0 errors`), `@universo/metahubs-backend` build passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/MetahubAttributesService.test.ts src/tests/services/designTimeObjectChildrenCopy.test.ts src/tests/routes/entityInstancesRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts src/tests/routes/setsRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm build`

## 2026-04-08 ECAE Phase 2.5b Legacy Built-in Compatibility Layer

Completed the coexistence-first compatibility lift over the new generic entity foundation without widening built-in routes to the generic surface. This checkpoint keeps catalogs, sets, and enumerations on their legacy endpoints, but moves the structurally shared delete/detach/reorder safety semantics into internal helpers so later Phase 2.5c service genericization can build on one shared control-flow seam instead of three parallel copies.

| Area | Resolution |
| --- | --- |
| Shared compatibility helper | Added `legacyBuiltinObjectCompatibility.ts` for shared blocked-delete, hub-detach, and reorder outcome handling while keeping kind-specific policy and blocker checks injected from legacy routes. |
| Set and enumeration reuse | Legacy set and enumeration routes now reuse the shared helper layer for delete, hub detach, and reorder safety paths, preserving the existing optimistic-lock and not-found response contracts. |
| Catalog safety lift | Catalog legacy routes now reuse the shared helper layer only for delete-by-hub, delete, and permanent-delete safety paths while preserving catalog-specific delete policy and blocker behavior. |
| Validation | Focused backend helper + route regressions passed (`61/61`), `@universo/metahubs-backend` lint returned to the existing warning-only backlog (`0 errors`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/LegacyBuiltinObjectCompatibility.test.ts src/tests/routes/setsRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts src/tests/routes/catalogsRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/entities/services/legacyBuiltinObjectCompatibility.ts src/domains/sets/controllers/setsController.ts src/domains/enumerations/controllers/enumerationsController.ts src/tests/services/LegacyBuiltinObjectCompatibility.test.ts --fix`
- `pnpm --filter @universo/metahubs-backend lint && pnpm --filter @universo/metahubs-backend build`
- `pnpm build`

## 2026-04-08 ECAE Phase 2.5 Generic Entity CRUD Backend

Completed the first generic entity-instance backend layer on top of the ECAE foundation while keeping the rollout coexistence-first. This checkpoint intentionally exposes the new CRUD surface only for custom DB-backed kinds, so legacy catalogs/sets/enumerations remain on their dedicated routes until the compatibility layer and service genericization phases prove the shared foundation safe for built-ins too.

| Area | Resolution |
| --- | --- |
| Generic route surface | Added custom-only design-time entity instance routes/controllers for list, create, get, update, delete, restore, permanent delete, copy, and reorder under the standard metahubs auth/rate-limit/domain-error stack. |
| Shared object seam | `MetahubObjectsService` now accepts generic kind strings and optional transaction runners on the mutation/read helpers needed by generic CRUD, so `EntityMutationService` can wrap update/delete/copy/restore flows without controller-owned transaction logic. |
| Coexistence guard | Generic routes explicitly reject built-in kinds and keep catalogs/sets/enumerations on legacy paths for now, preserving coexistence-first rollout and avoiding premature policy/copy-flow bypasses. |
| Validation | Focused generic route coverage passed (`9/9`), the combined ECAE service+route+resolver regression suite passed (`33/33`), `@universo/utils` build passed, `@universo/metahubs-backend` build passed, touched-file lint had `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green after clearing an unrelated generated `packages/applications-backend/base/dist` cleanup blocker (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/utils build`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/EntityTypeService.test.ts src/tests/services/EntityActionService.test.ts src/tests/services/EventBindingService.test.ts src/tests/services/EntityLifecycleServices.test.ts src/tests/routes/entitiesRoutes.test.ts src/tests/routes/entityInstancesRoutes.test.ts src/tests/shared/entityTypeResolver.test.ts`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/entities/controllers/entityInstancesController.ts src/domains/entities/routes/entityInstancesRoutes.ts src/tests/routes/entityInstancesRoutes.test.ts src/domains/metahubs/services/MetahubObjectsService.ts src/domains/router.ts`
- `rm -rf packages/applications-backend/base/dist && pnpm build`

## 2026-04-08 ECAE Phase 2.4 Resolver DB Extension

Completed the first shared-resolution bridge from the built-in registry to DB-backed custom entity kinds. This keeps future generic entity work from hardcoding built-ins only, while still avoiding repeated custom-type lookups inside the same resolver instance.

| Area | Resolution |
| --- | --- |
| Shared resolver behavior | `EntityTypeResolver` is now async and can resolve built-in kinds from the code registry first, then fall through to `EntityTypeService` for custom DB-backed kinds when metahub context is available. |
| Request-local caching | Added resolver-instance caching for repeated custom-kind lookups keyed by metahub/user/kind so genericized backend paths can reuse one resolved custom type inside the same request flow. |
| Validation | Focused resolver tests passed (`5/5`), the combined ECAE service+route+resolver regression suite passed (`24/24`), `@universo/metahubs-backend` build passed, touched-file lint was clean, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/shared/entityTypeResolver.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/EntityTypeService.test.ts src/tests/services/EntityActionService.test.ts src/tests/services/EventBindingService.test.ts src/tests/services/EntityLifecycleServices.test.ts src/tests/routes/entitiesRoutes.test.ts src/tests/shared/entityTypeResolver.test.ts`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/shared/entityTypeResolver.ts src/tests/shared/entityTypeResolver.test.ts`
- `pnpm build`

## 2026-04-08 ECAE Phase 2.3 Backend Route Surface

Completed the first HTTP exposure layer for the new entity/action/event backend foundation. This checkpoint keeps the rollout coexistence-first: it exposes the new ECAE services through standard metahub route/controller seams without yet widening into generic entity instance CRUD or runtime/publication genericization.

| Area | Resolution |
| --- | --- |
| Entity type routes | Added CRUD routes/controllers for custom entity types plus paginated filtered listing of resolved entity types at `/metahub/:metahubId/entity-types` and `/metahub/:metahubId/entity-type/:entityTypeId`. |
| Action and event routes | Added object-scoped routes/controllers for actions and event bindings, keeping route handlers thin and delegating validation/business rules to `ActionService` and `EventBindingService`. |
| Router integration | Registered the new entity-type, action, and event-binding route factories in the top-level metahubs domain router so the new surface participates in the normal auth, rate-limit, and domain-error stack. |
| Validation | Added focused route coverage for entity types, actions, and event bindings; the combined ECAE service+route regression suite passed (`19/19`), `@universo/metahubs-backend` build passed, package lint finished with `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/EntityTypeService.test.ts src/tests/services/EntityActionService.test.ts src/tests/services/EventBindingService.test.ts src/tests/services/EntityLifecycleServices.test.ts src/tests/routes/entitiesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm build`

## 2026-04-08 ECAE Phase 2.2 Backend Service Foundation

Completed the backend service foundation for the coexistence-first Entity-Component-Action-Event rollout. This milestone moved the new metahub entity/action/event logic out of planning-only state and into validated backend services, while keeping the next checkpoint explicitly limited to route/controller exposure rather than widening directly into runtime or frontend work.

| Area | Resolution |
| --- | --- |
| Entity type backend | Added `EntityTypeService` for custom metahub entity-type CRUD/resolution on top of `_mhb_entity_type_definitions`, including built-in plus custom merge behavior and component-dependency validation. |
| Action and event services | Added `ActionService` and `EventBindingService` for object-owned actions and same-object event bindings, with component-manifest gating, script existence checks, conflict validation, and optimistic-lock update support. |
| Lifecycle orchestration | Added `EntityEventRouter` plus `EntityMutationService`, keeping `before*` dispatch inside the mutation transaction and `after*` dispatch only after a successful commit. |
| Validation closure | Normalized the new focused backend tests to canonical metahub schema names, extended optimistic-lock entity typing for `entity_type` / `action` / `event_binding`, and closed the build-only typing gaps in the new services. |
| Validation | Focused Phase 2.2 backend service tests passed (`11/11`), `@universo/utils` build passed, `@universo/metahubs-backend` build passed, package lint finished with `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/EntityTypeService.test.ts src/tests/services/EntityActionService.test.ts src/tests/services/EventBindingService.test.ts src/tests/services/EntityLifecycleServices.test.ts`
- `pnpm --filter @universo/utils build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm build`

## 2026-04-08 Entity Architecture Plan QA Alignment

Completed the planning-only architecture pass for the metahub Entity migration after two rounds of QA against both the original 9-point specification and the real repository seams, followed by a final seam-closure refinement pass. No implementation started in this milestone; the completed work is the corrected Draft v4 plan plus synchronized Memory Bank context so future IMPLEMENT work starts from the stricter coexistence-first contract instead of the earlier over-aggressive refactor framing.

| Area | Resolution |
| --- | --- |
| Plan architecture | Promoted the plan from the earlier ECAE draft to a stricter Draft v3 that keeps legacy Catalogs/Sets/Enumerations alive while introducing the new `Entities` workspace, dynamic published sections, and `Catalogs v2` dogfooding. |
| Service/runtime contract | Recorded that lifecycle dispatch must move through a transaction-aware `EntityMutationService`, and that runtime controllers, script attachments, widget config contracts, and snapshot transports still need explicit genericization rather than being treated as already entity-safe. |
| Final seam coverage | Tightened the plan to Draft v4 by adding explicit `applications-frontend` runtime genericization, a design-time service genericization gate for catalog-centric backend services, the object-owned Actions/Events contract, the `EntityFormDialog` vs `DynamicEntityFormDialog` reuse rule, and mandatory reuse of the existing platform system-attribute governance helpers for Catalogs v2. |
| Reuse-first completion | Added two further QA clarifications: reusable entity presets should extend the existing platform template registry/versioning flow in `metahubs`, and `apps-template-mui` runtime adapter/API contracts must be genericized together with page components so catalog naming does not remain baked into shared runtime abstractions. |
| Scope correction | Moved the form-driven Zerocode MVP into current scope, while keeping advanced visual builders and richer no-code tooling in a future post-parity phase. |
| Memory Bank sync | Updated `activeContext.md` and `tasks.md` to match Draft v4 so the repo memory now reflects coexistence-first rollout, current-scope Zerocode MVP, runtime/design-time seam coverage, and the `Entities` plus dynamic published-menu split. |

### Validation

- Manual QA pass against the plan file and audited repository seams.
- Memory Bank synchronization completed for `activeContext.md`, `tasks.md`, and this progress entry.

## 2026-04-08 PR #755 Review Follow-up And E2E Recovery

Closed the post-publish follow-up for PR #755 after the enforced 20-minute wait window, bot-review triage, and the user-requested requirement to keep repairing the branch until the repository-recommended E2E gate was fully green again. The actual accepted review fix stayed narrow in backend cleanup logic, but full validation also uncovered stale E2E expectations, a codename-mode list-refresh seam, and a stale quiz snapshot integrity hash that had to be repaired before the PR could be safely updated.

| Area | Resolution |
| --- | --- |
| PR review triage | Reviewed PR #755 after the wait window; Gemini reported no actionable issues, while the only accepted Copilot findings were the two `e2eCleanup.mjs` comments about application/metahub discovery drift on partial manifests. |
| Cleanup hardening | `tools/testing/e2e/support/backend/e2eCleanup.mjs` now always attempts discovery by `runId` and only downgrades discovery failures to warnings when explicit manifest ids already exist, restoring the safer merged-cleanup behavior. |
| E2E contract repairs | Rebased stale browser expectations to the shipped UI contracts: admin settings now switch to the `Metahubs` tab before touching codename defaults, Common layouts no longer expect a redundant `Layouts` heading, and metahub common-dialog settings use the shipped `Popup window type` / `Non-modal windows` labels. |
| Additional wide-run fixes | Stabilized `codename-mode` around persisted backend state instead of instantaneous list refresh, refreshed the canonical `metahubs-quiz-app-snapshot.json` `snapshotHash`, and taught `quizFixtureContract` to fail fast when the fixture hash drifts again. |
| Validation | Focused reruns passed for the originally failing flow specs plus the later `codename-mode` and `snapshot-import-quiz-runtime` seams, and the final `pnpm run test:e2e:agent` pass completed green with `45 passed` (`38.6m`). |

### Validation

- `pnpm exec node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/admin-instance-settings.spec.ts tools/testing/e2e/specs/flows/application-runtime-scripting-quiz.spec.ts tools/testing/e2e/specs/flows/codename-mode.spec.ts tools/testing/e2e/specs/flows/metahub-layouts.spec.ts tools/testing/e2e/specs/flows/metahub-settings.spec.ts`
- `pnpm exec node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/codename-mode.spec.ts tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts`
- `pnpm run test:e2e:agent`

## 2026-04-08 Post-QA Lint Closure Remediation

Closed the last release-blocking QA follow-up after the Shared/Common implementation itself was already functionally green. The remaining gap was package lint drift in the touched backend/frontend files rather than a product or security defect, so this final pass stayed narrow: restore green package lint exits, re-run focused regressions, and confirm the canonical root build still holds.

| Area | Resolution |
| --- | --- |
| Lint baseline | Reconfirmed that the blocker was the error-level Prettier/ESLint drift in the touched Shared/Common files, not a new behavioral regression. |
| Backend/frontend remediation | Applied root-level Prettier plus package `eslint --fix` to the confirmed metahubs backend/frontend blocker set until both package lint commands exited green again. |
| Validation | `@universo/metahubs-backend` lint passed, `@universo/metahubs-frontend` lint passed, focused backend routes passed (`35/35`), focused frontend tests passed (`18/18`), and root `pnpm build` passed (`30 successful`, `30 total`, `EXIT:0`). |

### Validation

- `pnpm --filter @universo/metahubs-backend lint`
- `pnpm --filter @universo/metahubs-frontend lint`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/scriptsRoutes.test.ts src/tests/routes/sharedEntityOverridesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/shared/ui/__tests__/SharedEntitySettingsFields.test.tsx src/domains/scripts/ui/__tests__/EntityScriptsTab.test.tsx src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx`
- `pnpm build`

## 2026-04-08 Post-QA Attribute Move Ownership Remediation

Closed the last blocking QA defect that still prevented the Shared/Common wave from being treated as fully complete. The remaining problem was not feature incompleteness anymore but a fail-open mutation seam in the attribute move endpoint: the route trusted `attributeId` too early, and the service trusted a bare id even when the request was scoped to a different catalog.

| Area | Resolution |
| --- | --- |
| Controller ownership guard | The attribute move controller now loads the attribute first and returns `404` unless it belongs to the routed catalog, matching the stricter ownership behavior already used by update and delete. |
| Service fail-closed guard | `MetahubAttributesService.moveAttribute(...)` now requires `id + object_id + active row` on the initial fetch and all follow-up re-reads, so direct service callers cannot reorder foreign-catalog or shared-pool rows through a mismatched routed object id. |
| Regression coverage | Focused attributes route coverage now locks the valid same-catalog move path together with foreign-catalog and shared-pool `404` cases. |
| Validation | Attributes routes passed (`22/22`), constants routes passed (`11/11`), enumerations routes passed (`17/17`), the canonical Shared/Common Chromium wrapper flow passed (`4 passed`, `4.2m`), and the canonical root `pnpm build` completed green (`30 successful`, `27 cached`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/constantsRoutes.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/enumerationsRoutes.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project chromium`
- `pnpm build`

## 2026-04-08 Strict E2E Finalization Cleanup Closure

Closed the last runner-level cleanup seam that still survived after the Phase 8 docs/browser fixes were already green. The product/browser flow had already recovered through the settled-response Playwright helper, but strict wrapper finalization was still calling redundant route-level manifest cleanup before the authoritative full reset and therefore emitting false publication/application delete noise in the tail of an otherwise green run.

| Area | Resolution |
| --- | --- |
| Playwright mutation waits | Added a shared settled-response wait helper for mutation requests and updated the vulnerable flow specs so transient auth-client `419` bootstrap retries no longer fail the final successful browser mutation path. |
| Strict runner finalization | `run-playwright-suite.mjs` now skips route-level manifest/API cleanup when strict full-reset mode is active and lets the post-stop full reset remain the only teardown authority for that lifecycle. |
| Validation | The canonical Shared/Common Chromium wrapper flow finished cleanly (`4 passed`, `3.9m`) with only shutdown plus `[e2e-full-reset] Completed reset for runner-finalize` in the tail, and the canonical root `pnpm build` stayed green (`30 successful`, `30 cached`). |

### Validation

- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project chromium`
- `pnpm build`

## 2026-04-08 QA Closure Sync

Synchronized closure state after the final Shared/Common QA review confirmed that the implementation itself was already complete. No additional product-code patch was required in this pass; the only remaining issue was stale memory-bank and plan status drift.

| Area | Resolution |
| --- | --- |
| Task ledger | Closed the stale 2026-04-08 Shared/Common remediation checklist residue and aligned it with the already verified implementation evidence. |
| Active/project memory | Compressed `activeContext.md` to the real current focus, recorded the closure-only QA result in `currentResearch.md`, and refreshed technical guidance for backend focused test invocation. |
| Plan status | Marked the Shared/Common/shared-scripting plan as implemented historical context instead of pending implementation review. |
| Validation | Revalidated the canonical root build, focused metahubs/applications frontend/backend suites, and retained the Playwright proof artifact paths for Common alignment, RU Shared badge/list state, and runtime page-surface create state. |

### Validation

- `pnpm build`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/general/ui/__tests__/GeneralPage.test.tsx src/domains/attributes/ui/__tests__/attributeDisplayRules.test.ts src/domains/shared/ui/__tests__/SharedEntitySettingsFields.test.tsx src/domains/shared/__tests__/sharedEntityExclusions.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/sharedEntityOverridesRoutes.test.ts src/tests/routes/scriptsRoutes.test.ts src/tests/services/SharedEntityOverridesService.test.ts src/tests/services/MetahubScriptsService.test.ts`
- `pnpm --filter @universo/applications-frontend exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationRuntime.test.tsx`
- `pnpm --filter @universo/applications-backend test -- src/tests/services/applicationReleaseBundle.test.ts src/tests/persistence/applicationCopyPersistence.test.ts src/tests/routes/applicationsRoutes.test.ts`

## 2026-04-08 Manual Repro Clean-Rebuild Closure

Closed the final clean-rebuild remediation pass for the reopened Shared/Common and runtime page-surface defects. This last batch did not change product behavior again; it added explicit proof capture to the already green browser flows, reran the focused Chromium wrapper suite on port `3100`, and recorded the final artifact paths for the user-visible acceptance evidence.

| Area | Resolution |
| --- | --- |
| Browser proof capture | The focused Playwright flows now emit proof screenshots for the runtime page-surface create state, the embedded Common toolbar alignment, and the RU localized Shared badge/list state. |
| Final browser validation | The focused Chromium wrapper run remained green after proof capture (`5 passed`, `5.6m`), confirming that the proof instrumentation did not destabilize the already-fixed flows. |
| Remaining observation | Server logs still show the known post-run cleanup/savepoint error after the green suite summary, but it does not fail the wrapper run and was left out of this product-fix closure batch. |

### Validation

- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-general-catalog-layouts.spec.ts tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project=chromium`
- Proof artifacts:
	- `test-results/flows-metahub-general-cata-b4a3d-alization-and-page-surfaces-chromium/general-runtime-page-surface-create.png`
	- `test-results/flows-metahub-shared-commo-ca48f-on-and-runtime-stay-aligned-chromium/shared-common-toolbar-alignment.png`
	- `test-results/flows-metahub-shared-commo-ca48f-on-and-runtime-stay-aligned-chromium/shared-common-ru-badge.png`

## 2026-04-08 Imported Connector Schema-Sync Closure

Closed the imported self-hosted connector schema-generation blocker that remained after the wider Shared/Common remediation wave was already green. The failure turned out to be an applications-runtime identifier reuse problem on two adjacent seams, not raw fixture corruption: shared field ids were colliding in `_app_attributes`, and after that was fixed the same imported flow still reused shared enumeration value ids across multiple target enumeration objects during `_app_values` sync.

| Area | Resolution |
| --- | --- |
| Executable payload field ids | `resolveExecutablePayloadEntities(...)` now remaps repeated shared field ids deterministically per target entity, so the runtime metadata layer keeps `_app_attributes.id` globally unique without mutating the design-time/publication snapshot contract. |
| Runtime snapshot enumeration ids | The normalized publication runtime source now remaps repeated shared enumeration value ids per target enumeration object and rewrites predefined catalog-element REF payloads to those scoped ids before `_app_values` sync runs. |
| Diff and sync parity | `createLoadPublishedApplicationSyncContext(...)` now returns the normalized runtime source, and the diff controller reuses `syncContext.entities` so browser diff and actual schema sync consume the same scoped identifier contract. |
| Validation | Focused `@universo/applications-backend` `applicationReleaseBundle.test.ts` passed (`14 / 14`), the imported snapshot connector Chromium flow passed (`2 passed`, `1.3m`), and the canonical root `pnpm build` completed green after rebuilding `@universo/applications-backend`. |

### Validation

- `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/applicationReleaseBundle.test.ts`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-connectors.spec.ts --project chromium --grep "imported snapshot publication creates schema on first connector attempt"`
- `pnpm build` passed successfully.

## 2026-04-07 Shared/Common UI And Exclusions Contract Remediation Closure

Closed the reopened Common/shared UI remediation pass that remained after importing the committed self-hosted snapshot fixture. This batch stayed tightly scoped to the user-reported regressions: move shared behavior out of the dedicated Shared tab, replace the checkbox-style exclusions UI with the shipped assignment-panel pattern, repair embedded Common header/layout drift, and realign the generator/browser contracts with the explicit shared-container ensure plus save-on-dialog exclusions model.

| Area | Resolution |
| --- | --- |
| Shared dialog IA | Shared attributes, constants, and enumeration values now keep behavior controls under `Presentation` and expose a dedicated `Exclusions` tab instead of the older dedicated Shared tab. |
| Exclusions UX contract | `SharedEntitySettingsFields` now uses `EntitySelectionPanel`, stores `_sharedExcludedTargetIds` in local dialog state, and applies exclusion writes only through the parent dialog save path. |
| Embedded Common chrome | `ViewHeader` now supports explicit control alignment, and the embedded Common list surfaces use content-offset guards so search/actions stay right-aligned and table/list wrappers no longer overflow inside the Common shell. |
| Generator and browser contract parity | The self-hosted generator now ensures shared containers through the explicit write route, the Common/shared Chromium flow waits for override persistence only after dialog save, and the green generators run refreshed the committed self-hosted snapshot fixture. |
| Validation | Focused metahubs-frontend regressions passed (`2 files / 5 tests`), `metahub-shared-common.spec.ts` passed in Chromium (`4 passed`, `4.1m`), `metahubs-self-hosted-app-export.spec.ts` passed in the generators project (`2 passed`, `4.9m`), and the canonical root `pnpm build` completed green (`30 successful`, `22 cached`, `3m7.785s`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/shared/ui/__tests__/SharedEntitySettingsFields.test.tsx src/domains/general/ui/__tests__/GeneralPage.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project chromium`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts --project generators`
- `pnpm build` passed successfully.

## 2026-04-07 Remaining Shared/Common QA Contract Gap Remediation

Closed the three remaining contract-level QA findings that still survived after the earlier Common/shared closure waves were already green. This pass moved shared-entity exclusions back into the dialog save/cancel lifecycle, hardened legacy `global` script editing against the normalized `library` round-trip sent by the current UI, and split shared container reads from explicit container creation so `GET /shared-containers` is side-effect free again.

| Area | Resolution |
| --- | --- |
| Shared entity save/cancel parity | `SharedEntitySettingsFields` now stores exclusions in local dialog form state, shared attribute/constant/value save handlers sync only the changed `isExcluded` states after a successful entity save, and unsavable new exclusions are trimmed automatically when `canExclude` is turned off in the same dialog. |
| Legacy script compatibility | `MetahubScriptsService.updateScript(...)` now recognizes the normalized `library` role that the UI sends back for legacy `global` rows and preserves the stored `global` contract as long as attachment scope stays unchanged. |
| Shared container read/write split | `GET /shared-containers` now lists only existing virtual containers, while the Common page explicitly ensures missing shared pools through `POST /shared-containers/ensure` before embedding shared Attributes / Constants / Values. |
| Validation | Focused metahubs-frontend regressions passed (`4 files / 19 tests`), focused metahubs-backend regressions passed (`3 suites / 27 tests`), and the canonical root `pnpm build` completed green (`30 successful`, `26 cached`, `58.468s`). |

### Validation

- `VITEST_COVERAGE=false pnpm --filter @universo/metahubs-frontend test -- --run src/domains/shared/ui/__tests__/SharedEntitySettingsFields.test.tsx src/domains/shared/__tests__/sharedEntityExclusions.test.ts src/domains/scripts/ui/__tests__/EntityScriptsTab.test.tsx src/domains/general/ui/__tests__/GeneralPage.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubScriptsService.test.ts src/tests/services/SharedContainerService.test.ts src/tests/routes/sharedEntityOverridesRoutes.test.ts`
- `pnpm build` passed successfully.

## 2026-04-07 Shared Common Fail-Closed Closure Remediation

## 2026-04-07 Residual QA Closure For Shared/Common Docs, Route Coverage, And Runner Cleanup

Closed the last post-QA residual gaps that remained after the wider Common/shared implementation had already shipped green. This pass stayed narrow: align the public REST API docs with the live scripts router, add the missing route-level shared-override regressions, and harden the E2E manifest cleanup path so the Common/shared Chromium runner exits cleanly after a successful browser flow.

| Area | Resolution |
| --- | --- |
| REST API docs parity | EN/RU `rest-api.md` now document the live scripts detail endpoints as `GET/PATCH/DELETE /metahub/{metahubId}/script/{scriptId}` instead of the stale plural-path `PUT` contract. |
| Shared override route coverage | New `sharedEntityOverridesRoutes.test.ts` coverage locks the missing `400` invalid-query/input seams, the `403` guarded write seam, and baseline happy-path container/list/delete routing on the shipped controller/routes. |
| E2E cleanup hardening | `e2eCleanup.mjs` now treats search-based orphan discovery as best-effort when the manifest already contains explicit resource ids, so successful Common/shared runs no longer fail finalization or leave the run manifest behind when discovery hits transient teardown-time noise. |
| Validation | Focused backend route suites passed (`12 / 12`), the Common/shared Chromium flow passed twice (`4 passed`, `3.7m`), EN/RU docs kept exact line parity (`48/48`), `pnpm docs:i18n:check` stayed green, and the canonical root `pnpm build` completed green (`30 successful`, `27 cached`, `22.196s`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/sharedEntityOverridesRoutes.test.ts src/tests/routes/scriptsRoutes.test.ts`
- `wc -l docs/en/api-reference/rest-api.md docs/ru/api-reference/rest-api.md`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project chromium`
- `pnpm docs:i18n:check`
- `pnpm build` passed successfully.

Closed the last reopened QA seams in the Common/shared scripting wave. This pass moved the `general/library` boundary fully into the backend service contract, filled the missing negative browser coverage for dependency-sensitive shared-library failures, updated the shipped EN/RU operator docs in the current docs tree, and finished with green focused validation plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Backend scope contract | `MetahubScriptsService` now rejects `general` scripts outside the `library` role, rejects new `library` authoring outside Common/general, and preserves unchanged legacy out-of-scope rows only for no-scope-transition updates. |
| Browser and UI proof | `metahub-shared-common.spec.ts` now covers delete-in-use, codename-rename conflict, and circular `@shared/*` failure modes in Chromium, while `EntityScriptsTab` now prefers structured backend conflict payloads instead of generic Axios text. |
| Operator documentation | The touched EN/RU guides, architecture notes, and REST API reference pages now describe the fail-closed Common/library authoring rules where operators already look for scripting guidance. |
| Validation | Focused `MetahubScriptsService` tests passed (`16 / 16`), focused `EntityScriptsTab` tests passed (`10 / 10`), the Chromium Common/shared browser flow passed (`4 passed`, `4.0m`), `pnpm run docs:i18n:check` completed without errors, and the canonical root `pnpm build` finished green (`30 successful`, `25 cached`, `1m12.288s`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/MetahubScriptsService.test.ts`
- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/scripts/ui/__tests__/EntityScriptsTab.test.tsx`
- `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts --project chromium`
- `pnpm run docs:i18n:check`
- `pnpm build` passed successfully.

## 2026-04-07 Final Shared Entities And Scripts Closure

Closed the last reopened Common/shared seams for the shared entities and enhanced scripting wave. This final batch removed the request-scoped shared-override transaction coupling, aligned application-sync release-bundle hashing with the materialized runtime snapshot that applications actually consume, and brought the last Chromium Common/shared Playwright file onto the real async UI/runtime contract instead of brittle intermediate assertions.

| Area | Resolution |
| --- | --- |
| Request-scoped shared overrides | `SharedEntityOverridesService.upsertOverride(...)` now accepts an explicit runner, Common/shared override routes reuse the request executor, merged-order callers thread parent `tx` runners through the override helper, and focused service coverage proves the explicit-runner path does not reopen nested transactions. |
| Publication-backed runtime sync hash | `loadPublishedPublicationRuntimeSource(...)` now computes `snapshotHash` from the materialized runtime snapshot rather than reusing the stored raw publication snapshot hash, so release-bundle validation stays aligned when shared sections are flattened into ordinary runtime entities. |
| Final browser contract | `metahub-shared-common.spec.ts` now matches the shipped UI/runtime behavior: disabled Common Library role selector, async exclusion mutation flow, runtime create response/table-row proof, and quiz completion-state UI. |
| Validation | Focused shared override service tests passed (`3 / 3`), focused runtime-source tests passed (`4 / 4`), `pnpm run build:e2e` passed, `metahub-shared-common.spec.ts` passed in Chromium (`3 passed`, `3.3m`), and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m39.093s`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/SharedEntityOverridesService.test.ts`
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/loadPublishedPublicationRuntimeSource.test.ts`
- `pnpm run build:e2e`
- `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-shared-common.spec.ts --project chromium`
- `pnpm build` passed successfully.

## 2026-04-07 Widget Shared Behavior Closure For Inherited Catalog Layout Widgets

Closed the Phase 6 widget shared-behavior seam for the shared entities and enhanced scripting wave. This pass added authoring controls for widget `sharedBehavior` on global/base layouts, reused the existing inherited-widget override model for catalog exclusions, and aligned frontend and backend enforcement so forbidden inherited move/toggle/exclude operations now fail closed instead of relying on UI-only affordances.

| Area | Resolution |
| --- | --- |
| Global widget authoring | `MenuWidgetEditorDialog`, `ColumnsContainerEditorDialog`, and `QuizWidgetEditorDialog` now expose `canDeactivate`, `canExclude`, and `positionLocked` for global/base layouts, and `WidgetBehaviorEditorDialog` provides the same behavior-only editor path for widgets without a dedicated config dialog. |
| Inherited widget UI contract | `LayoutDetails` now gates inherited drag, active toggle, and remove/exclude affordances through base-widget `sharedBehavior`, keeps inherited config read-only, and exposes exclusion through the existing inherited remove action only when the base widget allows it. |
| Backend enforcement | `MetahubLayoutsService` now resolves inherited widgets by ignoring stale forbidden override fields, clears forbidden zone/sort/active override state during normalization, reuses `_mhb_catalog_widget_overrides.is_deleted_override` for inherited exclusion, and rejects forbidden inherited move/toggle/exclude mutations fail closed. |
| Regression coverage | Focused frontend coverage now locks the sharedBehavior-gated inherited control surface, while focused backend coverage proves stale-override suppression plus fail-closed exclusion, position-lock, and deactivation enforcement. |
| Validation | Focused metahubs frontend inherited-widget tests passed (`2 / 2`), focused metahubs-backend `MetahubLayoutsService` tests passed (`11 / 11`), `@universo/metahubs-frontend` and `@universo/metahubs-backend` built successfully, and the canonical root `pnpm build` completed green (`30 successful`, `0 cached`, `3m46.335s`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/layouts/ui/__tests__/LayoutDetails.inheritedWidgets.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/MetahubLayoutsService.test.ts`
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm build` passed successfully.

## 2026-04-07 Shared Snapshot V2 And Runtime Materialization Closure

Closed the Phase 5 shared snapshot/application-sync implementation seam for shared entities. This pass taught snapshot export/import about shared attrs/constants/values plus override rows, preserved the raw publication snapshot for integrity/history, and materialized the shared sections into the existing flattened runtime/schema-sync path instead of inventing a second runtime model.

| Area | Resolution |
| --- | --- |
| Snapshot export contract | `SnapshotSerializer` now emits `sharedAttributes`, `sharedConstants`, `sharedEnumerationValues`, and `sharedEntityOverrides`, and publication/metahub export call sites now pass shared-container plus shared-override services so snapshot v2 exports actually include those sections. |
| Runtime/application sync | Publication runtime loading plus publication-controller DDL/runtime sync paths now call `SnapshotSerializer.materializeSharedEntitiesForRuntime(...)` before deserializing entities, so shared attrs/constants/values flow through the existing flattened `_app_*` and `setConstantRef` paths without a second sync engine. |
| Snapshot import contract | `SnapshotRestoreService` now recreates the three virtual shared containers, restores shared attrs/constants/values into those containers, and remaps `_mhb_shared_entity_overrides` rows to the restored target/shared entity ids during import. |
| Version/hash contract | Snapshot v2 now uses `snapshotFormatVersion = 2`, and the canonical publication snapshot hash includes the new shared sections so integrity checks react to shared-entity export drift. |
| Validation | Focused `SnapshotSerializer` + `SnapshotRestoreService` tests passed (`12 / 12`), `@universo/types` and `@universo/metahubs-backend` built successfully, and the canonical root `pnpm build` completed green (`30 successful`, `0 cached`, `4m3.658s`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/SnapshotSerializer.test.ts src/tests/services/SnapshotRestoreService.test.ts`
- `pnpm --filter @universo/types build`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm build` passed successfully.

## 2026-04-07 Shared Library Publication Ordering Closure

Closed the remaining non-E2E shared-library publication seam for the shared-scripts wave. This pass moved publication from repeated per-script shared-library reloads to one deterministic active-library graph, validated nested `@shared/*` dependencies in topological order, and locked the contract with focused backend service coverage plus a fresh canonical root build.

| Area | Resolution |
| --- | --- |
| Publication compilation model | `MetahubScriptsService.listPublishedScripts()` now preloads active `general/library` sources once, validates shared libraries in topological dependency order, and recompiles only consumer scripts that actually import `@shared/*`. |
| Failure contract | Circular or missing shared-library publication graphs now fail closed before publication output is built, while shared-library rows remain validation-only and are not emitted into runtime `snapshot.scripts`. |
| Regression coverage | Focused backend service coverage now proves deterministic library ordering, one shared-library load for the whole publication batch, and wrapped circular-dependency failures at the publication-service seam. |
| Validation | Focused `MetahubScriptsService` tests passed (`11 / 11`), `@universo/metahubs-backend` built successfully, and the canonical root `pnpm build` completed green (`30 successful`, `27 cached`, `20.427s`). |

### Validation

- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/MetahubScriptsService.test.ts`
- `pnpm --filter @universo/metahubs-backend build`
- `pnpm build` passed successfully.

## 2026-04-07 Shared/Local Merged List Contract Closure

Closed the Phase 3 merged shared/local list seam for attributes, constants, and enumeration values. This pass carried the feature from a landed frontend patch into a root-build-verified contract by finishing merged `includeShared=true` list wiring, shared-row authoring UX, optimistic merged reorder behavior, and the backend typing fix that the canonical build exposed.

| Area | Resolution |
| --- | --- |
| Merged list API contract | Existing attribute/constant/value list endpoints and clients now support merged `includeShared=true` reads plus shared-row metadata typing without introducing a parallel read API surface. |
| Shared-row authoring UX | `AttributeList`, `ConstantList`, and `EnumerationValueList` now render merged shared rows with shared badges, tint/divider treatment, inactive/excluded state rendering, row-level drag constraints, and read-only action gating for shared rows while local rows keep the current CRUD/DnD behavior. |
| Merged reorder/backend typing | The backend merged-order seam now uses typed mapper outputs and a business-scope-specific attribute merged read path, so `planMergedSharedEntityOrder(...)` receives compatible ids/sort orders instead of leaking `unknown` or incompatible union items into the ordering helper. |
| Validation | Focused metahubs-frontend shared-list regressions passed (`3 files / 15 tests`), `@universo/metahubs-frontend` built successfully, and the canonical root `pnpm build` completed green (`30 successful`, `20 cached`, `3m3.393s`). |

### Validation

- Focused metahubs-frontend shared-list regressions passed (`3 files / 15 tests`).
- `pnpm --filter @universo/metahubs-frontend build`
- `pnpm build` passed successfully.

## 2026-04-07 Shared Entity Dialog Controls Closure

Closed the next Phase 2 implementation seam for shared/global entities by wiring one reusable Shared settings surface across Common Attributes, Constants, and Values. This pass also finished the missing enumeration-value API contract so the same `sharedBehavior` editor can flow through value create/update/copy dialogs without a parallel UI or payload model.

| Area | Resolution |
| --- | --- |
| Reusable shared dialog controls | `SharedEntitySettingsFields` is now embedded across Common/shared attribute, constant, and enumeration value dialogs, providing one editor for `canDeactivate`, `canExclude`, `positionLocked`, and per-target exclusions backed by shared override mutations. |
| Enumeration value contract | Enumeration value frontend types plus the metahubs backend controller/service now accept, persist, and return `presentation`, allowing `presentation.sharedBehavior` to survive create/update/copy flows instead of being UI-only state. |
| Common shared-mode propagation | `GeneralPage` now passes explicit `sharedEntityMode` into embedded Common Attributes / Constants / Values content so those dialogs can expose Shared tabs only in the shared-container authoring path. |
| Regression coverage | Focused frontend coverage now locks `sharedEntityMode` propagation plus the shared settings toggle/exclusion behavior, while the existing enumeration value optimistic-update regression stayed green after the dialog refactor. |
| Validation | Focused metahubs-frontend tests passed (`4 files / 6 tests`), focused metahubs-backend enumeration tests passed (`2 files / 20 tests`), and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m2.39s`). |

### Validation

- `pnpm --filter @universo/metahubs-frontend test -- --run src/domains/general/ui/__tests__/GeneralPage.test.tsx src/domains/enumerations/ui/__tests__/EnumerationValueList.optimisticUpdate.test.tsx src/domains/attributes/ui/__tests__/AttributeList.systemTab.test.tsx src/domains/shared/ui/__tests__/SharedEntitySettingsFields.test.tsx`
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/enumerationsRoutes.test.ts src/tests/services/MetahubEnumerationValuesService.test.ts`
- `pnpm build` passed successfully.

## 2026-04-07 Shared Entity Backend Foundation And Common Scripts Tab

Closed the first real implementation milestone for the shared/global entities and enhanced scripting wave. This pass moved the backend shared-entity foundation from plan state into working services/routes/tests, then immediately consumed the new shared-library authoring contract in the Common page by embedding the existing scripts editor in `general/library` mode instead of creating a second UI stack.

| Area | Resolution |
| --- | --- |
| Shared backend foundation | `SharedContainerService` now lazily resolves/creates virtual shared container objects with advisory locking, `SharedEntityOverridesService` enforces `sharedBehavior` fail-closed server-side, and metahubs routes expose shared container plus override list/patch/delete endpoints. |
| Anti-leak and direct CRUD bridge | Generic metahub object list/count flows now hide virtual containers, while explicit object-id lookups remain available so existing set/enumeration CRUD routes can be reused against shared container ids instead of requiring a parallel API surface. |
| Shared route coverage | Focused backend regressions now cover shared container creation/reuse, shared override enforcement, system-table registration, virtual-container filtering, and the shared set/enumeration controller bridge on existing routes. |
| Common scripts integration | `GeneralPage` now exposes a Scripts tab that embeds `EntityScriptsTab` with `attachedToKind='general'`, EN/RU locale strings now include the `library` role guidance, and the existing backend dependency guards continue to block unsafe shared-library delete/codename-change operations. |
| Validation | Focused metahubs-backend route/service suites passed (`63/63`), focused metahubs-frontend Common/scripts suites passed (`9/9`), both touched package builds completed green, and the canonical root `pnpm build` finished successfully (`30 successful`, `13 cached`, `4m12.266s`). |

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
