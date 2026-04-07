# Current Research

## 2026-04-07: Layout-owned catalog behavior contract closure

- Research outcome implemented: the reopened QA defect was a contract split, not a runtime-resolution bug. Applications runtime already resolved behavior from layout `catalogBehavior`, but metahubs catalog authoring/API/tests still carried legacy `runtimeConfig`.
- Implemented fix: metahubs frontend removed `runtimeConfig` from catalog form defaults, payload serializers, and shared catalog types; metahubs backend catalog controller now rejects `runtimeConfig`, strips stale persisted `config.runtimeConfig` on update/copy, and no longer returns it; touched regressions now enforce layout-owned behavior and mock reorder enablement through `_app_layouts.config.catalogBehavior`.
- Closure validation: focused metahubs frontend/backend/applications backend suites passed, touched-file ESLint recheck had no error-level failures, and the canonical root `pnpm build` finished green (`30 successful`, `28 cached`, `1m8s`).
- No open research thread remains for this remediation wave.

## 2026-04-07: Snapshot hash integrity and catalog layout docs closure

- Research outcome implemented: the reopened QA defect was a real integrity gap, not a false positive. The shared canonical publication snapshot hash/checksum path had not kept up with the current export surface.
- Confirmed root cause: `normalizePublicationSnapshotForHash(...)` omitted `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, even though those sections already participate in snapshot export/import and application release lineage.
- Implemented fix: the shared normalizer now includes those sections with deterministic ordering, focused `@universo/utils` regressions fail closed on hash drift and envelope tampering across the newly covered sections, and the EN/RU catalog-layout docs now describe inherited widgets as placement/visibility overlays with base-layout config inheritance.
- Closure validation: focused snapshot/hash tests passed (`22/22`), `pnpm --filter @universo/utils build` completed green, and the canonical root `pnpm build` finished green.
- No open research thread remains for this remediation wave.

## 2026-04-07: Self-hosted fixture regeneration and current structure baseline closure

- Research outcome implemented: the remaining self-hosted generator failure was split across two seams, not one export bug. The generator spec still expected `showDetailsTitle: false` to persist in Settings layout config, while the live contract keeps that behavior as a widget override.
- Confirmed root cause: current public structure version `0.1.0` still mapped numeric version `1` to `SYSTEM_TABLES_V1`, so freshly created branch schemas omitted `_mhb_scripts` and publication creation failed during the generator flow.
- Implemented fix: the generator assertion now follows sparse persisted layout semantics, and `SYSTEM_TABLE_VERSIONS` maps version `1` to `SYSTEM_TABLES`, restoring `_mhb_scripts` to fresh current-version branch schemas.
- Closure validation: the browser self-hosted generator passed (`2 passed`, `4.7m`), the browser snapshot import/export flow passed (`5 passed`, `1.9m`), focused `systemTableDefinitions` backend tests passed (`27/27`), and the canonical root `pnpm build` finished green.
- No open research thread remains for this fixture/baseline wave.

## 2026-04-06: Catalog layout QA remediation closure

- Research outcome implemented: the remaining QA defects were real contract mismatches, not just copy or CSS polish. Catalog runtime behavior still resolved partly from legacy catalog settings, catalog layouts still stored copied widget-visibility booleans, and the catalog dialog still exposed a fallback-runtime form.
- Implemented runtime contract: `catalogRuntimeConfig.ts` and `runtimeRowsController.ts` now resolve active catalog behavior only from layout config, with the global layout acting as the default baseline until a catalog-specific layout exists.
- Implemented storage/materialization split: design-time catalog layouts now strip dashboard widget-visibility booleans from stored config, while application sync reconstructs those booleans from effective widgets when publishing runtime `_app_layouts` rows.
- Implemented UI closure: the catalog tab now ships as `Layouts` / `Макеты`, the redundant embedded heading and fallback form are removed, embedded layout content no longer renders extra shell gutters, and the shared header now provides adaptive search in the embedded dialog-width layout manager.
- Closure validation: focused utils/frontend/backend/shared-header tests passed, `pnpm run build:e2e` completed green (`30 successful`), `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` remained green.
- No open research thread remains for this remediation wave.

## 2026-04-06: Inherited catalog widgets closure

- Research outcome implemented: the remaining reopened defect was narrow and contract-level, not a broader failure of the General/catalog-layout architecture.
- Implemented backend fix: catalog-layout widget payloads now expose `isInherited`, and inherited widgets fail closed on config edit, deletion, and direct reassignment while still supporting move/toggle through sparse override rows.
- Implemented runtime fix: snapshot export and application sync now ignore inherited override config so inherited widgets always materialize with base widget config instead of freezing stale catalog-specific config.
- Implemented UI proof: the shared layout editor now renders inherited badges and hides edit/remove affordances for inherited rows while preserving drag and active-state toggles.
- Closure validation: focused metahubs-backend service tests passed (`7/7`), focused metahubs-frontend layout tests passed (`4 tests total`), focused applications-backend sync tests passed (`2/2`), `pnpm run build:e2e` completed green, `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` remained green.
- No open research thread remains for this defect.

## 2026-04-06: Metahub General section plan final contract clarification

- Research outcome: the revised plan still had one residual ambiguity after the second QA pass. It correctly moved create/edit/copy behavior to the catalog-layout level, but it did not yet specify where that behavior should live in the contract/schema.
- Verified type boundary: `DashboardLayoutConfig` only models dashboard presentation/layout fields, so it should not absorb create/edit/copy or catalog behavior settings.
- Verified reuse seam: the existing `CatalogRuntimeViewConfig` already defines the relevant catalog runtime behavior fields and enums (`showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`).
- Planning conclusion applied: the plan now treats those fields as a catalog-layout-level nested behavior block inside the existing layout `config` JSONB, reusing the established catalog runtime setting shape/enums instead of introducing a new standalone schema family.
- Final refinement applied: runtime behavior resolution is now explicit for the no-layout case as well. The selected catalog layout behavior config wins when present; otherwise runtime falls back to the existing catalog runtimeConfig behavior subset. The first catalog layout seeds its behavior config from the current catalog settings when present.
- Resulting contract split: dashboard presentation stays in `DashboardLayoutConfig`; catalog-specific runtime behavior that is not part of dashboard layout becomes part of the selected catalog layout's nested behavior config.
- No open research thread remains for this plan QA pass; the next action is user approval or implementation.

## 2026-04-05: Frontend test warning remediation closure

- Research outcome implemented: the remaining QA debt was not a product bug. The noisy MUI `anchorEl` warning came from jsdom layout validation for `Popover`/`Select` anchors inside scripting-related frontend tests.
- Implemented fix: the affected metahubs frontend tests now provide a stable non-zero `HTMLElement.prototype.getBoundingClientRect` mock while keeping the existing `user.click(...)` interaction path intact.
- Validation result: focused `@universo/metahubs-frontend` dialog/script tests passed (`9/9`), the warning string `anchorEl` no longer appeared in the captured test log, package lint no longer had error-level failures on the touched scope, and the final root `pnpm build` finished green.
- No open research thread remains for this remediation.

## 2026-04-05: Metahub dialog settings and Scripts-tab responsiveness closure

- Research outcome implemented: the narrow-dialog Scripts-tab regression was not a CRUD bug; the real failure was container-width geometry plus missing real-browser overflow assertions.
- Implemented fix: metahub dialog behavior is now driven by shared settings and one template-mui presentation seam with preset sizing, fullscreen toggle, resize persistence, reset-to-default, and strict-modal close handling.
- Implemented responsive fix: `EntityScriptsTab` now switches by `ResizeObserver` container width, collapses the attached-scripts list on narrow dialogs, and keeps horizontal overflow inside the editor shell only.
- Closure validation: focused template-mui dialog tests passed, focused metahubs-frontend Scripts-tab tests passed, targeted Playwright dialog/settings flows passed, and the final root `pnpm build` finished green.
- No open research thread remains for this wave.

## 2026-04-05: Quiz snapshot fixture export/import closure

- Research outcome implemented: the newly requested durable quiz fixture could not safely ship on top of the existing import path because metahub export already serialized `snapshot.scripts`, but `SnapshotRestoreService` did not restore `_mhb_scripts` at all.
- Implemented fix: metahub export now augments `snapshot.scripts` with live `sourceCode`, and snapshot restore now recreates `_mhb_scripts` with attachment-id remapping for entity- and attribute-scoped scripts.
- Implemented durable fixture contract: `tools/testing/e2e/support/quizFixtureContract.ts` now owns the canonical quiz metahub identity, bilingual 10-question content, canonical widget script source, and fail-closed snapshot assertions.
- Implemented durable proof: the generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` rewrites `tools/fixtures/metahubs-quiz-app-snapshot.json`, and `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts` proves browser import, restored design-time script state, application creation from the imported publication, and the full EN/RU runtime quiz contract.
- Closure validation: focused metahubs-backend Jest passed, `pnpm run build:e2e` passed, the quiz generator passed with `2 passed`, the quiz import/runtime flow passed with `2 passed`, and the final root `pnpm build` finished green.
- No open research thread remains for the 2026-04-05 quiz snapshot fixture wave.

## 2026-04-05: Scripting QA gap closure and final plan completion

- Research outcome implemented: the previously identified scripting QA gaps are fully closed, and the final plan-completion wave is now the durable state for the 2026-04-05 scripting track.
- Implemented proof: `@universo/scripting-engine` now carries reproducible benchmark evidence with recorded `coldStartMs 7.13`, `meanMs 1.596`, and `p95Ms 2.127`.
- Implemented compatibility hardening: core-backend startup now validates `isolated-vm` / `--no-node-snapshot` compatibility explicitly, and legacy publication snapshots missing `snapshot.scripts` stay supported through direct regression coverage.
- Implemented product proof: browser authoring now exposes `quizWidget` `scriptCodename`, the real browser-authored Playwright flow covers authoring -> publication -> application -> runtime smoke, the shared auth `419` retry defect is fixed, and untouched draft role switches now reapply widget defaults so `rpc.client` remains present.
- Closure validation: focused auth-frontend Vitest passed, focused metahubs-frontend `EntityScriptsTab` coverage passed, the browser-authored Playwright flow passed with `2 passed`, and the final root `pnpm build` finished green with `30 successful`, `27 cached`, and `3m54.625s`.
- No open research thread remains for the 2026-04-05 scripting wave.

## 2026-04-05: Scripting hardening closure follow-up

- Research outcome implemented: the compiler was still acting like a general esbuild entrypoint. Embedded script compilation now enforces an explicit SDK-only boundary by rejecting unsupported static imports plus `require()`, dynamic `import()`, and `import.meta` before bundling.
- Research outcome implemented: browser client scripts were still inheriting too much of the ambient Worker environment. The worker runtime now keeps its bridge internals on private host aliases and disables ambient network, nested-worker, storage, and dynamic-code globals before loading the client bundle.
- Hidden defect found and fixed during the same pass: the isolated-vm bootstrap source used strict-mode-invalid `const eval = undefined` code. Runtime tests now parse generated bootstrap source so the same issue fails loudly.
- No open research thread remains for this scripting hardening closure wave.

## 2026-04-06: Codename JSONB/VLC contract re-audit

- Research outcome: the live source contract now persists codename through one `codename` JSONB/VLC field across the touched metahubs/admin flows; the older mixed-storage notes below are historical, not current-state guidance.
- Verified settings seam: `general.codenameLocalizedEnabled` still exists in admin/metahub settings, route helpers, and template-seed config, but it only controls how many locale entries survive into the persisted VLC payload. When false, `enforceSingleLocaleCodename(...)` keeps only the primary locale instead of flattening codename to plain text or reviving `codename_localized` / `presentation.codename`.
- Verified runtime seam: runtime/application code may still extract primary codename text at request or executable boundaries, but that is a boundary conversion only; it is not a second persisted storage contract.
- Workspace audit result: no source file under `packages/**/base/src` still persists `codename_localized` or `presentation.codename`, and no workspace artifact named `admin-role-codename-localized-contract-20260323.json` exists.
- No open research thread remains for this audit.

## 2026-04-04: Self-hosted post-import schema diff and runtime inheritance regression wave

- Research outcome implemented: the connector destructive-diff bug was caused by identity drift, not by harmless UI-only diff rendering. `@universo/schema-ddl/calculateSchemaDiff(...)` matches physical entities and fields by `entity.id` / `field.id`, not by codename.
- Confirmed-and-fixed root cause: `metahubsController.importFromSnapshot` restored the imported snapshot into a fresh branch through `SnapshotRestoreService`, which remapped entity/attribute/layout IDs to new runtime rows, but originally created the initial publication version from the raw imported snapshot payload instead of serializing the restored live branch. The imported publication baseline now serializes from the restored live branch, keeping executable identity aligned with later publications.
- Confirmed-and-fixed runtime-config seam: eager normalization of sparse catalog runtime config erased the distinction between inheritance and authored catalog overrides. The shared contract now keeps runtime config sparse, introduces explicit `useLayoutOverrides`, and applies layout-like catalog overrides only when that seam is actually enabled.
- Closure validation: focused shared/backend/frontend tests passed, the missing browser-safe `sanitizeCatalogRuntimeViewConfig` export was fixed in `@universo/utils`, `pnpm run build:e2e` finished green (`28/28`), the real Playwright self-hosted generator reran and rewrote the committed fixture, the targeted browser import flow passed on the regenerated snapshot, and the canonical root `pnpm build` finished green (`28/28`).
- No open research thread remains for this regression wave.

## 2026-03-23: Unified codename JSONB architecture revalidation

- Historical note: this section captured the pre-convergence migration gap when the branch still carried mixed codename storage seams.
- Outcome preserved for traceability: it established the approved target of one `codename JSONB` VLC field plus primary-text machine semantics.
- Current truth: the live source has since converged on that storage contract for the touched design-time/admin paths; see the 2026-04-06 re-audit above for the current-state summary.
- Closure update 2026-03-24: the touched backend/frontend request-contract slice is now implemented and validated; no open research thread remains for this specific codename payload seam.

## 2026-03-17: Admin roles / metapanel live-architecture revalidation

- Research outcome: the corrected admin-roles/metapanel plan still had hidden integration gaps against the live repository architecture, mainly around root routing, onboarding completion timing, permission refresh ownership, menu section filtering, and dashboard stats contracts.
- Confirmed root cause: the current app does not use TanStack Query for permission state; `AbilityContextProvider` owns `/auth/permissions` loading and exposes `refreshAbility()`, so query invalidation alone cannot refresh role-driven routing/menu state.
- Confirmed root cause: `OnboardingWizard` currently calls `completeOnboarding()` before the completion screen is shown, which means a `CompletionStep` CTA must first move the authoritative completion mutation out of the wizard instead of calling it a second time.
- Confirmed root cause: the current root route `/` bypasses the main shell and always enters the start flow for authenticated users, so `RegisteredUserGuard` alone cannot redirect post-onboarding users into Metapanel; a dedicated `/start` route plus root resolver is required.
- Confirmed root cause: shell menu rendering is split between `rootMenuItems`, a separate MetaHubs section, and an Admin section derived from `isSuperuser || hasAnyGlobalRole`; filtering only `rootMenuItems` would leave visible sections that the role UX intends to hide.
- Confirmed root cause: Metapanel currently points at a global-users-specific stats endpoint, while the desired cards aggregate multiple domains; this should be promoted to a dedicated admin dashboard stats contract shared with AdminBoard.
- Planning fix applied: the implementation plan is now v3 and explicitly adds `/start` topology, `AbilityContext` refresh, section-aware menu gating, injected privileged system-role provisioning, and a dedicated admin dashboard stats contract.
- No open research thread remains before implementation approval; the next action is user approval or another targeted plan QA pass.

## 2026-03-17: Configurable platform runtime `_upl_*` columns

- Research outcome implemented: the remaining bug was below the metahub/publication layer. Catalog snapshots already preserved disabled `upl.*` states, but runtime application business-table generation still created configurable `_upl_archived*` / `_upl_deleted*` columns unconditionally.
- Confirmed root cause: `@universo/schema-ddl` consumed only `config.systemFields.lifecycleContract`, while applications runtime CRUD/sync helpers still hardcoded `_upl_deleted` predicates and updates for dynamic business tables.
- Implemented fix: one shared `@universo/utils` helper now derives platform archive/delete families from `config.systemFields.fields`, schema-ddl consumes that helper for conditional runtime DDL, and applications-backend consumes the same helper for active-row and soft-delete SQL.
- Regression result: shared utils tests, schema-ddl generator tests, and applications runtime route tests all passed after the fix, and the final root build is green.
- No open research thread remains for this runtime `_upl_*` contract issue.

## 2026-03-17: Catalog tab mixing and basic template layout defaults

- Research outcome implemented: the tab-mixing defect was a scoped-list UX issue, not a backend data-integrity bug. `AttributeList` was using the shared paginated hook with previous-query placeholder reuse enabled while switching between two different scopes inside the same component instance.
- Implemented fix: the scoped attributes view now opts out of `keepPreviousData` on query-key changes and resets page/expanded TABLE state on tab switches so old rows cannot linger in the new scope.
- Research outcome implemented: the unwanted default center-zone columns container came directly from the built-in `basic` template seed data, not from a migration or runtime repair path.
- Implemented fix: the built-in base template now seeds `appNavbar` in the top zone and only `detailsTable` in the center zone for new metahubs; no template version bump or legacy branch was required because the target environment recreates the database from scratch.
- No open research thread remains for this wave.

## 2026-03-17: Disabled system attributes still created runtime `_app_*` columns

- Research outcome implemented: the bug was not in publication snapshot generation and not in schema-ddl itself. Publication snapshots already carried `systemFields.lifecycleContract`, and schema-ddl already omitted `_app_*` lifecycle columns when that contract disabled them.
- Confirmed root cause: the application release-bundle executable payload builder reconstructed entities directly from `snapshot.entities`, which do not carry the top-level publication `systemFields` data. That dropped `config.systemFields.lifecycleContract` before schema generation and caused runtime tables to fall back to default lifecycle columns.
- Implemented fix: `createApplicationReleaseBundle(...)` now hydrates snapshot-level `systemFields` back into each executable entity config before creating the executable payload schema snapshot.
- Regression result: release-bundle tests now assert payload hydration from publication `systemFields`, and application sync route tests now prove the generated schema payload contains the disabled lifecycle contract during publication-driven schema creation.
- No open research thread remains for this runtime lifecycle propagation issue.

## 2026-03-17: Application connector snapshot-hash mismatch

- Research outcome implemented: connector schema creation failed because the publication-side hash producer and the application-side hash verifier were normalizing different snapshot payloads.
- Confirmed root cause: `SnapshotSerializer.normalizeSnapshotForHash(...)` includes `systemFields` and omits absent optional keys, but `normalizePublicationSnapshotForHash(...)` had drifted by omitting `systemFields` and coercing absent optional publication/layout keys to `null`.
- Implemented fix: the applications-backend publication normalization now includes `systemFields` per entity and as normalized top-level metadata before computing the canonical release-bundle snapshot hash, and it preserves serializer-compatible omission semantics for optional keys.
- Regression result: direct release-bundle tests now cover publication snapshots with disabled lifecycle-related `systemFields` and the real layout/widget omitted-key shape that reproduced the runtime mismatch on compiled `dist`.
- No open research thread remains for this connector snapshot-hash issue.

## 2026-03-16: Platform system attributes governance closure

- Research outcome implemented: platform `_upl_*` catalog system attributes no longer depend only on metahub configuration; a global admin policy now decides whether they are configurable, always created, or forced back to platform defaults.
- Confirmed architectural seam: metahubs frontend should not fetch admin settings directly for this feature; the correct contract is backend policy resolution plus list-response `meta` for catalog System views.
- Confirmed UX/root-cause findings: the empty platform action menu was caused by `canDisable: false` in the shared registry, and the row-jump bug was caused by optimistic `moveToFront: true` rather than backend `sort_order` rewrites.
- Routing result implemented: catalog System uses dedicated `/system` routes for both global and hub-scoped catalog views, while legacy `?tab=system` URLs are redirected from the attribute view.
- No open research thread remains for this platform-governance wave.

## 2026-03-16: Metahub catalog system attributes and runtime lifecycle contract planning

- Code audit result: configurable catalog system attributes cannot be implemented safely as a metahub-only change because `_app_*` lifecycle fields are still hardcoded in runtime schema generation and assumed directly in application sync/CRUD routes.
- The critical propagation seam is the publication snapshot pipeline: catalog-level system-field metadata must be serialized explicitly and then resolved into a compact runtime lifecycle contract during publication/app sync.
- The safest scope cut for wave 1 is to make lifecycle families (`published`, `archived`, `deleted` and their `_at` / `_by` companions) configurable while leaving `_app_owner_id`, `_app_access_level`, and baseline `_upl_*` audit infrastructure fixed.
- Recommended runtime rule: derive the lifecycle contract once during publication/app sync and persist it with application sync or release metadata; runtime requests should consume that contract instead of probing live schema shape or hardcoding `_app_deleted` assumptions.
- Template/base seeding and manual catalog creation must share one idempotent `ensureCatalogSystemAttributes(...)` path so default rows cannot drift between builtin templates and interactive creation.
- Frontend planning result: add a dedicated `System` tab, standardize catalog tab order to `Attributes -> System -> Elements -> Settings`, keep `Settings` visible from every catalog sub-view, and expose toggle-only controls for system rows with localized labels and type badges.
- External references used in the planning pass: Context7 Knex guidance, MUI Tabs guidance, TanStack Query invalidation/query-key guidance, PostgreSQL ALTER TABLE behavior, and UP-test Supabase live schema inspection.
- Open decision for implementation review: whether design-time persistence should extend the existing catalog-attribute entity with `isSystem/systemKey/isEnabled` metadata or use a small dedicated side-table if the current schema shape proves too rigid.
- QA refinement conclusion: for this repository, wave 1 should extend `_mhb_attributes` directly rather than introduce a separate side-table, because template seeding, template migration, cleanup, snapshot serialization, and optimistic attribute CRUD already converge on `_mhb_attributes`.
- QA refinement conclusion: any richer system-field registry must reuse `@universo/utils/database/systemFields.ts` as the canonical low-level field-name source and must not duplicate raw `_app_*` / `_upl_*` string constants in a second independent catalog.
- QA refinement conclusion: backend service-level guards are required for reorder/move operations on system rows; UI-only restrictions are not sufficient because attribute ordering and transfer operations already exist in `MetahubAttributesService`.
- QA refinement conclusion: because metahub attribute routes, metahub element validation, snapshot serialization, and runtime application metadata all currently consume generic attribute collections, the implementation must exclude system rows from ordinary attribute/business-field flows by default and serialize them through a dedicated lifecycle metadata channel.

## 2026-03-13: Optional global migration catalog true final closure

- Research outcome implemented: the last remaining gap was not runtime correctness but artifact completeness. `application_release_bundle` now embeds deterministic executable payloads for both baseline and incremental execution instead of checksum-only descriptors.
- The executable payload contract is intentionally deterministic: bundle artifact `schemaSnapshot.generatedAt` is bound to `manifest.generatedAt`, which keeps checksum validation stable across export and import.
- Bundle apply now consumes the embedded artifact payloads on the real execution paths and rejects corrupted payload/checksum combinations before any schema existence checks, diff calculation, or DDL execution begin.
- Validation for this closure wave is complete: `@universo/applications-backend` tests passed (80/80), package lint is green, and the final root `pnpm build` completed green (`27/27`, `2m38.453s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: Optional global migration catalog closure

- Research outcome implemented: the remaining QA gaps were operational closure issues, not missing core architecture.
- `@universo/applications-backend` now exposes a real application release-bundle workflow: publication-backed export emits the canonical `application_release_bundle` contract, and bundle apply reuses the existing schema sync engine instead of creating a second install path.
- Successful publication sync and bundle apply now both persist `installed_release_metadata` through the central `applications.cat_applications` sync-state seam, keeping release/install state out of per-app runtime schemas.
- The last touched raw global-catalog env parser in migrations-platform CLI now uses the shared `@universo/utils` helper, aligning the touched startup/runtime/CLI paths on one parsing contract.
- Mirrored EN/RU operator docs now describe disabled-vs-enabled catalog behavior, release bundles, recovery guidance, and the env flag.
- Validation for this closure wave is complete: utils tests 189, core-backend tests 17, applications-backend release-bundle tests 12 with lint green, migrations-platform tests 49 with lint green, final root `pnpm build` green (`27/27`, `2m37.175s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

## 2026-03-13: Optional global migration catalog architecture audit

- Code audit: `@universo/core-backend` startup still always calls `syncRegisteredPlatformDefinitionsToCatalog(...)`, so global catalog bootstrap remains in the critical startup path.
- Code audit: runtime application/metahub migrations already write local history into `_app_migrations` / `_mhb_migrations`, but `MigrationManager`, `SystemTableMigrator`, and `MetahubSchemaService` also hard-call `mirrorToGlobalCatalog(...)`, which currently auto-creates `upl_migrations` through `PlatformMigrationCatalog.ensureStorage()`.
- Code audit: fixed system-app schema generation uses `SchemaGenerator.generateFullSchema(...)` directly and does not record local baseline rows, which is why fixed-schema `_app_migrations` tables remain empty in the live database.
- Context7 findings: Knex treats seeds as repeatable data loaders and keeps schema history in migrations; Prisma baselining uses a full `0_init` baseline plus incremental pending migrations, which matches the target direction for exported/file-backed apps.
- Supabase UP-test read-only inspection: `upl_migrations` currently holds 20 `migration_runs`, 215 `definition_registry` rows, 215 `definition_revisions`, 215 `definition_exports`, 215 `definition_drafts`, and 430 `approval_events`; fixed `applications._app_migrations` and `metahubs._app_migrations` exist but have zero rows.
- Planning implication: local per-schema migration history should remain canonical, while the global catalog should become optional observability/export infrastructure behind a feature flag and explicit capability checks.
- Open research thread: implementation must safely degrade CLI/doctor/export commands that currently assume `PlatformMigrationCatalog.isStorageReady()` or definition-registry tables.
- QA refinement finding: the earlier master-plan wording that expected `definition_registry` population on every fresh bootstrap is too strict for the intended architecture and must be replaced with an explicit two-mode acceptance contract.
- QA refinement finding: enabled-mode global audit should remain fail-closed and same-transaction with local history/schema-state persistence; disabled mode may no-op safely, but enabled mode must not silently degrade.
- QA refinement finding: file-bundle release/install metadata should reuse the existing central application sync-state surface in `applications.cat_applications` before any new metadata store is introduced.
- QA refinement finding: the env/config layer should follow the repository’s established small helper pattern in `@universo/utils` first, rather than introducing a broader shared capability abstraction prematurely.

## 2026-03-13: Optional global migration catalog implementation closure

- Research outcome implemented: the repository now supports explicit catalog-enabled and catalog-disabled modes without treating the full global definition registry as a mandatory cold-start dependency.
- `@universo/migrations-platform` now uses `PlatformMigrationKernelCatalog` in disabled mode, preserving `upl_migrations.migration_runs` while keeping definition-registry lifecycle storage behind the feature flag.
- Runtime application/metahub migration writes now preserve local canonical history even when global catalog mirroring is disabled, and enabled mode remains fail-closed by keeping explicit capability checks.
- Fixed system-app schema generation now records deterministic local baseline rows and backfills missing `_app_migrations` baseline history when a schema already exists.
- Central application release/install metadata now reuses `applications.cat_applications.installed_release_metadata`, keeping sync/install state in one canonical persistence surface.
- Validation for this wave is complete: `@universo/schema-ddl` tests green, `@universo/migrations-catalog` tests 36/36 green, `@universo/migrations-platform` tests 101/101 green, and final root `pnpm build` green (`27/27`, `2m41.284s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

- Research outcome implemented: the still-live blockers were narrow package-level correctness/tooling issues, not missing architecture from the completed system-app program.
- The failing `@universo/migrations-core` validation case was caused by a malformed test owner id; the fix preserved strict managed owner-id validation by correcting the test input to a canonical UUID.
- `@universo/migrations-core` lint now ignores committed/generated `src/**/*.d.ts`, `@universo/schema-ddl` no longer has error-level lint failures, and `@universo/core-backend` again exposes a package-level lint script with warning-only output on the touched surface.
- Validation for this closure wave is complete: `@universo/migrations-core` tests 58/58 + lint green, `@universo/schema-ddl` tests green with warning-only lint, `@universo/core-backend` tests 16/16 with warning-only lint, final root `pnpm build` green (`27/27`, `2m27.925s`).
- No open research thread remains for this blocker-closure wave.

## 2026-03-13: Final QA closure gap audit

- Research outcome implemented: the remaining repository-side gaps were narrow contract and proof issues, not missing architectural waves.
- Profile and admin fixed-system-app manifests now keep string validation limits aligned with their backing `VARCHAR(50)` columns, and shared migrations-platform tests assert that manifest `maxLength` never exceeds declared `VARCHAR(N)` lengths.
- `@universo/applications-backend` now has direct persistence-level regression coverage for `copyApplicationWithOptions(...)`, so copy safety no longer depends only on route-level mocks.
- The core-backend acceptance regression now captures both halves of the final contract: application-like fixed-schema fresh bootstrap and publication-created application runtime sync composition.
- The docs tree now contains mirrored English/Russian architecture docs for fixed system-app convergence, with verified line parity across the touched doc pairs.
- Validation for this closure wave is complete: profile Jest 5/5, admin Jest 3/3, applications persistence Jest 12/12, migrations-platform Jest 35/35, core-backend acceptance Jest 2/2, error-free lint for applications-backend and migrations-platform, warning-only touched lint elsewhere, final root `pnpm build` green (`27/27`, `2m37.515s`).
- No open research thread remains for this final QA closure wave.

## 2026-03-13: QA closure completion revalidation

- Research outcome implemented: four real residual defects remained after the earlier green state, and all were operational contract issues rather than broad architectural failures.
- `@universo/migrations-platform` now records export lifecycle rows for bundle-oriented catalog exports, so CLI export and doctor observe the same active published revision state.
- `@universo/migrations-catalog` and `@universo/migrations-platform` now use stable artifact-equivalence checks, so dependency-only changes are no longer skipped behind checksum-only no-op detection.
- `@universo/utils` now exposes a browser-specific env entry whose precedence is `__UNIVERSO_PUBLIC_ENV__` → `import.meta.env` → `process.env` → browser origin, and `@universo/store` mirrors `import.meta.env` fallback support.
- `@universo/migrations-core` now rejects malformed managed owner ids instead of silently normalizing them into potentially colliding schema-name inputs.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 28/28, `@universo/migrations-platform` regressions 64/64, `@universo/utils` env tests 5/5, `@universo/migrations-core` identifiers 8/8, touched-surface lint green, final root `pnpm build` green (`27/27`, `2m39.834s`).
- No open research thread remains for this QA closure completion wave.

## 2026-03-13: QA plan completion revalidation

- Research outcome implemented: the suspected metahubs naming/parity mismatch was not real on the live branch; the parity contract already expects the converged `cat_*` / `doc_*` fixed-schema naming.
- `@universo/migrations-platform` doctor lifecycle checks now treat any export recorded for the active published revision as healthy, while operational sync/export flows still keep explicit export targets.
- Shared backend Jest mapping now resolves `@universo/database`, which restores package-local execution of the metahubs parity contract suite.
- A new core-backend router-level regression now covers publication-created application bootstrap through the composed runtime-sync seam.
- Validation for this closure wave is complete: touched focused Jest suites are green, touched-package lint is green, and final root `pnpm build` is green (`27/27`, `2m39.643s`).
- No open research thread remains for this QA completion wave.

## 2026-03-13: Definition lifecycle closure audit

- Research outcome implemented: the remaining gap was operational, not storage-level — lifecycle tables and helpers already existed, but live imports still bypassed them.
- `@universo/migrations-catalog` now routes active imports through draft creation, review request, and publication, while preserving published lifecycle provenance on unchanged revisions.
- `@universo/migrations-platform` no-op and doctor checks now require published lifecycle provenance in addition to registry checksum/export parity, so pre-fix catalog rows are repaired once.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 34/34, `@universo/migrations-platform` tests 98/98, package lint green, final root `pnpm build` green (`27/27`, `2m51.177s`).
- No open research thread remains for this lifecycle closure wave.

## 2026-03-12: Ownership seam and live-start bootstrap investigation

- Research outcome implemented: the publication-derived runtime sync seam now stops at `loadPublishedPublicationRuntimeSource(...)` in `@universo/metahubs-backend`, while `@universo/applications-backend` owns the final sync-context adapter.
- Reproduced and fixed package-level Jest forwarding drift by moving touched backend packages to the shared `tools/testing/backend/run-jest.cjs` wrapper.
- Live startup investigation proved that the remaining bootstrap failures were phase-ordering defects, not only SQL idempotency defects: `OptimizeRlsPolicies1800000000200` and `SeedBuiltinMetahubTemplates1800000000250` both needed `post_schema_generation` registration.
- Live validation now reaches a serving server: after bootstrap, `node ./run start` listens on port 3000 and returns `HTTP/1.1 200 OK` for the root route.
- No open research thread remains for this closure wave; future work should treat live startup smoke as mandatory whenever platform migration phases or fixed-schema bootstrap sequencing change.

## 2026-03-11: System-app unification completion planning audit

- Codebase audit result: the loader/CLI/registry foundation exists, but the completion program still lacks a rich system-app contract, unified schema-target handling across fixed + runtime schemas, runtime application-sync ownership separation, and the deep acceptance test matrix.
- Context7 PostgreSQL 17 guidance confirmed that `SECURITY DEFINER` functions must set a trusted `search_path` explicitly with `pg_temp` last, and should revoke default `PUBLIC` execute privileges before selective grants.
- Context7 TanStack Query guidance confirmed the repository should keep creating a fresh `QueryClient` per test, disable retries in tests, and prefer explicit query-key invalidation patterns.
- Supabase UP-test (`osnvhnawsmyfduygsajj`) currently shows live drift: `profiles` schema exists with zero tables, `public.profiles` still exists, and all `upl_migrations.definition_*` tables are present but empty.
- Supabase UP-test operational defaults observed during planning: transaction pooler on port `6543`, `search_path = "$user", public`, `statement_timeout = 2min`, `lock_timeout = 0`.
- The failed live SQL probe against `upl_migrations.migration_runs.created_at` confirmed that operational tooling must use the real catalog timestamp columns (`_upl_created_at`, `_upl_updated_at`) instead of assuming generic names.
- QA refinement after the first draft of the master plan: exact Metahub schema parity must stay explicit, requirement traceability must remain inside the plan, and future-facing abstractions such as managed custom schemas / rich artifact catalogs must not delay the current parity milestone unless they solve a concrete present-tense requirement.
- Existing frontend reuse patterns confirmed during the QA pass: `MigrationGuardShell`, `ApplicationMigrationGuard`, `MetahubMigrationGuard`, `ConnectorDiffDialog`, `EntityFormDialog`, `DynamicEntityFormDialog`, `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`, `createEntityActions`, `createMemberActions`, and existing optimistic/query invalidation helpers should be treated as the default UI/CRUD surface.

## 2026-03-07: Optimistic create UX redesign audit

- Existing optimistic create/copy behavior is intentionally immediate in cache **and** immediate in presentation: `ItemCard`, `FlowListTable`, and `CustomizedDataGrid` all react to `__pending` right away instead of deferring visual feedback until user interaction.
- The current shared model has no dedicated concept of “optimistically created but visually normal until touched”; that distinction will need to be introduced at the helper/renderer level without changing backend schemas.
- Metahubs and Applications optimistic create hooks still contain temporary `sortOrder ?? 999` placeholders, while many list renderers still display `sortOrder ?? 0`; this combination is the strongest current explanation for the observed temporary `999` / `0` ordinal artifacts.
- `ElementList` still awaits `createElementMutation.mutateAsync(...)`, confirming that at least one create dialog remains blocking after the earlier fire-and-forget pass.
- `MetahubList` and `ApplicationList` table name cells use direct `Link` rendering, so pending entities in those views do not inherit the shared pending-navigation guard behavior.

## 2026-03-04: Codename QA closure follow-up

- Research outcome implemented: codename retry policy standardized across backend domains using shared constants.
- Added direct unit coverage for codename validation/sanitization (`@universo/utils`) and retry candidate generation (`metahubs-backend` helper).
- No unresolved blocker from this research thread remains.

## 2026-02-10: Application Runtime 404 on Checkbox Update

- Root cause: runtime update requests did not include `catalogId`, so backend defaulted to the first catalog by codename and returned 404 (row not found) for other catalogs.
- Fix: include `catalogId` in runtime cell update payloads to target the correct runtime table.

## 2026-02-03: Display Attribute UX Fixes

- No new external research required; changes were internal UX and default-value adjustments.

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations
- UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).

### Code audit (createQueryRunner call sites)
- `@universo/auth-backend`: `ensureAuthWithRls` creates a per-request QueryRunner and releases it on response completion.
- `@universo/auth-backend`: `permissionService` creates a QueryRunner only when one is not provided; releases it in `finally`.
- `@universo/core-backend`: export/import uses QueryRunner with explicit connect + transaction and releases in `finally`.

### Current hypothesis
- The freeze is likely caused by pooled connection contention (too many concurrent requests each holding a per-request QueryRunner) or an edge-case where cleanup/release does not run.
- The middleware cleanup is now guarded to run once per request to reduce cleanup races.

---

## schema-ddl cleanup follow-up (2026-01-19)

### Notes
- Parameterized statement_timeout in `@universo/schema-ddl` locking helper to avoid raw interpolation
- Removed deprecated static wrapper methods in `SchemaGenerator` and `MigrationManager`
- Updated tests to use naming utilities directly

---

## Database pool monitoring (2026-01-31)

### Notes
- Supabase Pool Size observed at 15 connections for the project tier.
- Knex + TypeORM pool budgets aligned to 8 + 7 (total 15).
- Error logging now includes pool state metrics to diagnose exhaustion events.