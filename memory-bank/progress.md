# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release      | Date       | Codename                                           | Highlights                                                                                          |
| ------------ | ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
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
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯                                    | VLC system, Dynamic locales, Flowise 3.0                                                            |
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

Validation:

- focused migrations-core validation passed.
- focused migrations-platform validation passed.
- touched owner-package backend validation passed.
- standalone touched-package builds passed.
- root `pnpm build` passed.

Why it still matters:

- repeated-start safety depends on the compiler emitting the same canonical metadata shape that startup later reads.
- fixed-system metadata bootstrap now has an explicit artifact trail instead of relying on partially synthetic assumptions.

## Legacy Safety and Doctor Gates Burst COMPLETE (2026-03-12)

The platform now fails fast when fixed-system bootstrap or reconciliation leaves the database in an incomplete or mixed physical state.

| Area | Resolution |
| --- | --- |
| Metadata completeness gate | platform doctor, sync, and startup now inspect required `_app_objects` and `_app_attributes` rows for registered fixed system apps. |
| Legacy physical-model gate | startup and doctor now reject leftover legacy fixed-schema table names after reconciliation/bootstrap instead of silently continuing. |
| Forward-only reconciliation bridges | profile, admin, applications, and metahubs fixed schemas now have deterministic forward-only rename/merge bridges into the converged application-like model. |
| CLI/bootstrap observability | fixed-system bootstrap reports object and attribute counts directly and is available through both platform and backend CLI surfaces. |
| Startup failure semantics | startup stops before later sync/doctor assumptions if metadata or physical-table invariants are still broken. |

Validation:

- focused migrations-platform regressions passed.
- focused core-backend startup validation passed.
- touched backend package regression coverage passed.
- standalone touched-package builds passed.
- root `pnpm build` passed.

Operational significance:

- later convergence and repeated-start closure work relied on these gates to fail fast instead of silently masking drift.
- doctor output now has direct signal for both metadata incompleteness and legacy-table leftovers.

## Registry and Acceptance Hardening Burst COMPLETE (2026-03-11)

Several earlier 2026-03-11 waves hardened the registry/lifecycle surface and provided the acceptance foundation later waves built on.

| Area | Resolution |
| --- | --- |
| Lifecycle governance | draft creation, review requests, publication, export recording, and approval-event persistence now follow an explicit operational contract. |
| Export dedupe safety | repeated export targets now use an idempotent recording path backed by database-level uniqueness instead of a fragile read-then-insert flow. |
| Runtime-sync ownership | application runtime sync is application-owned, while metahubs-backend provides publication runtime context only. |
| Doctor/bootstrap health | registry/export/lifecycle drift is surfaced explicitly through doctor and bootstrap health rather than being treated as an implicit clean state. |
| Acceptance coverage | focused route-level and orchestration-level regressions now prove publication-driven application sync and bootstrap lifecycle behavior on the real ownership seams. |

Validation:

- focused migrations-catalog validation passed.
- focused migrations-platform validation passed.
- focused applications-backend and metahubs-backend validation passed.
- focused core-backend composition validation passed.
- root workspace validation passed.

Why it still matters:

- the later 2026-03-12 and 2026-03-13 closure waves assume this registry/lifecycle foundation is real and test-backed.
- keeping this condensed record avoids losing the ownership and acceptance boundaries that future reopen work must preserve.


## Validation Posture Consolidation COMPLETE (2026-03-13)

The late 2026-03-13 closure waves also hardened the repository-level acceptance posture for future fixed-system and release-bundle work.

| Area | Resolution |
| --- | --- |
| Repeated-start acceptance | fixed-system startup changes now require a real second startup in addition to focused regression suites. |
| Live health check | HTTP health on `http://127.0.0.1:3000/` is now part of the accepted close-out pattern for startup-sensitive work. |
| Package-to-root validation | touched package tests/lint/build remain necessary, but closure claims now also require a final root `pnpm build`. |
| Fail-closed preference | malformed snapshot history, ambiguous release lineage, and enabled-mode catalog failures must remain fail-closed rather than silently degraded. |

Why it matters:

- this shared validation posture explains why the repeated-start closure explicitly included both focused compiler validation and live startup confirmation.
- future reopen work should reuse the same acceptance bar instead of reverting to test-only closure claims.
