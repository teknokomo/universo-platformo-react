# System Patterns
> **Note**: Reusable architectural patterns and best practices. For completed work -> progress.md. For current tasks -> tasks.md.
## Layout-Owned Catalog Runtime Behavior Pattern (IMPORTANT)
**Rule**: Catalog runtime create/edit/copy/search behavior must be owned by layout config, not by a separate catalog fallback form or by catalog object `runtimeConfig` fallback during runtime resolution.
**Required**:
- Store catalog runtime behavior as the nested `catalogBehavior` block inside layout `config`, reusing the existing behavior shape/enums.
- Treat the global layout as the default baseline for all catalogs until a catalog-specific layout exists.
- Do not resolve active runtime behavior from catalog object `runtimeConfig`; runtime helpers and controllers must read the selected layout config only.
- Catalog CRUD/UI/API contracts must not accept, return, or serialize legacy catalog `runtimeConfig`; update/copy flows should explicitly strip stale persisted `config.runtimeConfig` so a second source of truth cannot survive unrelated writes.
- Do not keep dashboard widget-visibility booleans as persisted catalog-layout fork state; strip them from stored catalog layout config and reconstruct them from effective widgets during publication/runtime materialization.
- Keep the catalog dialog Layout tab as a pure embedded layout manager; do not reintroduce a separate fallback-runtime form there.
**Detection**: `rg "catalogBehavior|resolveCatalogLayoutBehaviorConfig|buildDashboardWidgetVisibilityConfig|runtimeConfig" packages/universo-utils packages/applications-backend packages/metahubs-backend packages/metahubs-frontend`
**Why**: QA found that the earlier implementation still behaved too much like a copied catalog fallback model: runtime behavior was partially resolved from legacy catalog settings, catalog CRUD/UI still preserved `runtimeConfig`, catalog layouts stored copied widget-visibility booleans, and the catalog dialog still exposed an outdated fallback form. The stable contract is now layout-owned behavior plus sparse catalog storage with runtime materialization.
## Imported Fixture Playwright Timeout Pattern (IMPORTANT)
**Rule**: Browser flows that import a full metahub fixture and then create an application schema must opt into an explicit extended Playwright timeout instead of relying on the default 60-second test budget.
**Required**:
- Use `test.setTimeout(180_000)` or higher on imported-fixture flows that include metahub import, application creation, and first schema sync in one test body.
- Diagnose timeout failures against the total test budget first before assuming a backend stall; a late `waitForResponse(...)` failure can be a false signal when earlier bootstrap/import work already consumed most of the default timeout.
- Remove temporary backend instrumentation after narrowing the issue if the root cause is test-budget exhaustion rather than a real runtime hang.
**Detection**: `rg "test\.setTimeout\(180_000\)|imported snapshot publication creates schema on first connector attempt|snapshot-import" tools/testing/e2e/specs`
**Why**: The imported self-hosted connector schema flow appeared to hang on `/application/:id/sync`, but step logging proved runtime sync completed in a few seconds. The real failure was the default Playwright timeout expiring after a long fixture import/bootstrap path.
## Shared Entity Dialog Context Parity Pattern (IMPORTANT)
**Rule**: Entity edit dialogs opened from nested `Settings` buttons must receive the same full action context as dialogs opened from top-level list pages, especially `metahubId`, so shared tab builders render the same Scripts/Layout surfaces.
**Required**:
- Pass `metahubId` and any other list-origin routing context into shared action builders for nested entity settings dialogs.
- Reuse the same shared tab/action builders across list-origin and settings-origin entrypoints instead of maintaining separate tab compositions.
- Cover the parity seam with focused regressions so missing context cannot silently drop Scripts or the catalog Layout manager from one dialog entrypoint only.
**Detection**: `rg "metahubId:.*actionContext|Scripts|Layout" packages/metahubs-frontend/base/src/domains/**`
**Why**: The nested entity `Settings` dialogs were rendering an older tab set because the shared builders only enabled Scripts/Layout tabs when `metahubId` was present in the action context.
## Single-Shell Embedded Page Reuse Pattern (IMPORTANT)
**Rule**: When a parent page embeds an existing list/detail page inside its own tabbed shell, extract a shell-less content component and keep the standalone page as a thin wrapper; never nest full page chrome inside another page shell.
**Required**:
- Let the parent page own the outer `MainCard`, `ViewHeader`, tabs, and page spacing.
- Expose a shell-less content seam for embedded reuse, for example a named `*Content` export or an explicit `renderPageShell={false}` contract.
- Preserve the public standalone route contract by keeping the default page component as a wrapper around the shared content.
- Add focused regression coverage that proves the embedded path renders the shell-less content seam and does not mount the standalone page wrapper.
**Detection**: `rg "renderPageShell|LayoutListContent|GeneralPage" packages/metahubs-frontend`
**Why**: QA found that the General page still mounted the standalone Layouts page inside its own header/tab shell. The behavior worked, but the nested `MainCard`/`ViewHeader` composition left architecture debt that future General tabs could easily copy.
## Full Layout Snapshot Export And Global Layout Cache Invalidation Pattern (IMPORTANT)
**Rule**: Layout snapshots must carry the full design-time layout set, and global base-layout mutations in the authoring UI must invalidate the full metahub layouts query tree rather than only the edited layout detail.
**Required**:
- `attachLayoutsToSnapshot()` must export all global and catalog layouts from `_mhb_layouts`, not only active rows, so snapshot export/import preserves authoring state consistently.
- Snapshot override rows must be scoped to catalog layouts that are actually exported into `snapshot.catalogLayouts`.
- `defaultLayoutId` and `layoutConfig` should still resolve from the active/default global baseline so runtime consumers keep the same active-layout semantics.
- Global layout config/widget mutations in `LayoutDetails` and the shared layouts mutation hooks must invalidate `metahubsQueryKeys.layoutsRoot(metahubId)` so cached inherited catalog layout views are marked stale under the shared 5-minute QueryClient cache.
**Detection**: `rg "attachLayoutsToSnapshot|layoutsRoot\(|invalidateLayoutsQueries\.all|safeInvalidateQueriesInactive" packages/metahubs-backend packages/metahubs-frontend`
**Why**: QA found two linked seams: active-only snapshot export could drop authoring layouts while still serializing override rows, and per-layout React Query invalidation left inherited catalog views stale after base global layout mutations.
## Runtime Startup Catalog Resolution Pattern (IMPORTANT)
**Rule**: When runtime opens without an explicit `catalogId`, the preferred startup catalog may be inferred only from the global default or active runtime layout, never from a catalog-scoped runtime layout.
**Required**:
- Resolve implicit startup menu bindings from `_app_layouts` rows where `catalog_id IS NULL`.
- Keep catalog-scoped runtime layouts eligible only after a concrete catalog has already been selected.
- Preserve the existing explicit-catalog fallback path where runtime first tries `catalog_id = $1` and then falls back to the global layout.
- Keep a focused regression test on the startup-resolution helper so future runtime-controller refactors cannot silently widen the implicit root-selection scope again.
**Detection**: `rg "resolvePreferredCatalogIdFromGlobalMenu|catalog_id IS NULL|loadRuntimeSelectedLayout" packages/applications-backend`
**Why**: The General/catalog-layout feature already flattened catalog layouts into runtime rows, but QA found that the implicit startup path could still derive its preferred catalog from a catalog-scoped runtime layout. Constraining that lookup to the global layout scope preserves deterministic root navigation while keeping explicit catalog runtime selection unchanged.
## Catalog Layout Inherited Widget Contract Pattern (IMPORTANT)
**Rule**: Catalog layouts must expose inherited base-layout widgets as read-only config surfaces while still allowing move/toggle overrides through the sparse overlay model, and publication/runtime flows must flatten the merged result into ordinary layout/widget rows.
**Required**:
- Return `isInherited` for inherited catalog-layout widgets so the shared editor can distinguish inherited vs catalog-owned rows.
- Reject inherited widget config edits, removal, and direct reassignment at the backend service layer; only move/toggle operations may create or update sparse override rows.
- Keep catalog-owned widgets in the existing `_mhb_widgets` table and store inherited-widget deltas only in `_mhb_catalog_widget_overrides`; do not add a runtime override table.
- Ignore inherited override config during snapshot export and application sync so inherited runtime widgets always materialize with base widget config.
**Detection**: `rg "isInherited|_mhb_catalog_widget_overrides|Inherited widgets cannot" packages/metahubs-backend packages/metahubs-frontend packages/applications-backend`
**Why**: The broader General/catalog-layout feature already shipped, but QA found that inherited widgets were still config-editable in the shared editor. Preserving this contract prevents future layout refactors from silently turning inherited widgets into mutable copies or runtime-config drift.
## MUI Select JSDOM Geometry Pattern (IMPORTANT)
**Rule**: Frontend jsdom tests that open MUI `Select` / `Menu` / `Popover` surfaces must provide a stable non-zero anchor geometry instead of tolerating noisy `anchorEl` warnings.
**Required**:
- Mock `HTMLElement.prototype.getBoundingClientRect` (or an equivalent narrow seam) with a non-zero rectangle inside the affected test scope.
- Keep the existing stable user interaction path if it already proves the behavior correctly; do not rewrite passing tests to a different interaction pattern unless the interaction itself is broken.
- Confirm that the warning string `anchorEl` no longer appears in the captured test output after the fix.
- Prefer test-harness stabilization over production component changes when the warning is jsdom-specific.
**Detection**: `rg "anchorEl|getBoundingClientRect" packages/metahubs-frontend/base/src/**/__tests__/**`
**Why**: MUI `Popover` validates that the anchor is part of the visible document layout, while jsdom returns zero rectangles by default. Leaving the warning in place makes the suite noisy and can hide future real UI regressions.
## Embedded Script Import Boundary Pattern (IMPORTANT)
**Rule**: Embedded metahub scripts are single-file SDK consumers, not general workspace module entrypoints.
**Required**:
- Allow imports only from `@universo/extension-sdk` during script compilation.
- Reject unsupported static imports, `require()`, dynamic `import()`, and `import.meta` before esbuild bundling begins.
- Keep this validation in the compiler/analyzer layer so unsupported module loading never reaches runtime bundles.
**Detection**: `rg "Only @universo/extension-sdk imports are supported|dynamic import expressions|CommonJS require\(\) calls|import\.meta" packages/scripting-engine`
**Why**: With `bundle: true` and `resolveDir: process.cwd()`, embedded script compilation can silently widen into arbitrary workspace module loading unless the compiler enforces the intended SDK-only boundary explicitly.
## Restricted Browser Worker Script Surface Pattern (IMPORTANT)
**Rule**: Client script bundles must execute against a restricted worker/global surface, not the raw ambient Worker environment.
**Required**:
- Keep runtime bridge internals on private host aliases before disabling globals used by script bundles.
- Disable ambient network, nested-worker, storage, and dynamic-code globals in the worker before importing the client bundle.
- Shadow the same globals inside the generated bundle module source so non-browser/test execution follows the same deny-by-default contract.
- Preserve the existing fail-closed requirement when a Worker-capable browser runtime is unavailable.
- Bound each Worker execution with an explicit timeout budget and terminate/revoke the worker on timeout; hanging client bundles must fail closed instead of leaving the widget in an unbounded pending state.
**Detection**: `rg "private host aliases|RESTRICTED_WORKER_GLOBALS|Client script execution requires a Worker-capable browser runtime|shadows restricted globals" packages/apps-template-mui`
**Why**: A raw Worker environment still exposes more browser APIs than the scripting contract intends. Restricting the worker surface keeps client execution aligned with the safe host-bridge model instead of relying only on convention.
## Capability-Gated Scripting Runtime Pattern (IMPORTANT)
**Rule**: Script execution contexts must preserve the shared SDK surface while failing closed per normalized manifest capability and module-role rules.
**Required**:
- Normalize `moduleRole`, `sourceKind`, and `capabilities` through the shared helpers in `@universo/types` before persistence, publication, or execution.
- Validate design-time capabilities against the selected module-role allowlist; undeclared or disallowed capabilities must not be silently widened at runtime.
- Inject explicit fail-closed stubs for unavailable APIs instead of omitting fields entirely, so the runtime SDK shape remains predictable while unauthorized calls still throw.
- Require the `lifecycle` capability before dispatching runtime lifecycle hooks.
**Detection**: `rg "normalizeScriptCapabilities|hasScriptCapability|resolveAllowedScriptCapabilities|dispatchLifecycleEvent" packages`
**Why**: The scripting wave originally left capability gating incomplete, which made the runtime surface depend on implicit assumptions instead of the manifest contract. Central normalization plus fail-closed stubs keeps authoring, persistence, and execution aligned.
## Explicit Dual-Target Script Exposure Pattern (IMPORTANT)
**Rule**: Script methods stay private unless they are explicitly decorated, and `@AtServerAndClient()` is the only supported opt-in for a method that must remain available in both bundles.
**Required**:
- Preserve the stable root `@universo/extension-sdk` import while the SDK stays split into modular source files internally.
- Treat `server_and_client` as a first-class shared method target in compiler manifests plus runtime client-list and public-RPC filtering helpers.
- Do not treat undecorated helper methods as runtime entrypoints; shared exposure must remain explicit.
- Keep lifecycle handlers server-only even after adding dual-target support.
**Detection**: `rg "AtServerAndClient|server_and_client|isClientScriptMethodTarget|isServerScriptMethodTarget" packages`
**Why**: The early scripting draft implied that undecorated methods might run on both targets, but the shipped contract intentionally keeps helper methods private to avoid accidental runtime exposure while still allowing deliberate shared methods.
## Untouched Draft Module-Role Default Reapplication Pattern (IMPORTANT)
**Rule**: When a new script draft changes `moduleRole` before the user edits role-sensitive capabilities, reapply the target-role defaults instead of intersecting the previous-role capability set.
**Required**:
- Track whether the current capabilities are still pristine/default-derived.
- On a pristine role switch, replace capabilities with `resolveDefaultScriptCapabilities(nextRole)`.
- Preserve explicit user-edited capability choices on later role switches; only untouched drafts are auto-reset.
- Widget drafts must retain widget-default `rpc.client` after a `module` -> `widget` switch.
**Detection**: `rg "resolveDefaultScriptCapabilities|moduleRole|EntityScriptsTab" packages/metahubs-frontend packages/universo-types`
**Why**: Overlap-only role switching made fresh widget drafts lose required default capabilities and forced manual correction or browser-test workarounds.
## Public Runtime RPC Boundary Pattern (IMPORTANT)
**Rule**: Public runtime script call routes must fail closed at the real backend service/controller seam, not only inside internal execution-context helpers.
**Required**:
- Enforce public callability before runtime engine execution begins for both the direct HTTP `/runtime/scripts/:scriptId/call` route and any shared runtime bridge that reaches the same service method.
- Allow only server methods from scripts that declare `rpc.client`; lifecycle handlers (`eventName`) are event-only hooks and must never be callable from the public RPC surface.
- Return an explicit client-facing authorization/forbidden error for public-RPC boundary violations instead of falling through to runtime execution.
- Keep the public-callability decision on shared `@universo/types` helpers so authoring/runtime/docs stay aligned on the same boundary.
**Detection**: `rg "callServerMethod|public RPC|rpc.client|eventName" packages/applications-backend packages/universo-types`
**Why**: The earlier guard lived only inside the execution-context bridge, which left the direct runtime route weaker than the documented contract. Enforcing the rule at the service seam removes that bypass.
## Enforced Script SDK Compatibility Pattern (IMPORTANT)
**Rule**: `sdkApiVersion` is a real compatibility contract and must be validated consistently anywhere scripts are compiled, persisted, normalized, or executed.
**Required**:
- Keep the supported SDK-version allowlist in shared `@universo/types` helpers and treat it as the single source of truth.
- Validate both record-level and manifest-level SDK metadata during compiler analysis, metahub authoring create/update flows, publication/runtime snapshot normalization, and runtime script loading.
- Reject unsupported versions and record/manifest mismatches fail-closed instead of silently carrying the metadata forward.
- After changing exported SDK helpers in `@universo/types`, rebuild that package before downstream focused validation because some consumers still resolve built exports on disk.
**Detection**: `rg "sdkApiVersion|assertSupportedScriptSdkApiVersion|resolveScriptSdkApiVersion" packages`
**Why**: Treating `sdkApiVersion` as informational metadata allowed incompatible scripts to appear valid until much later in the flow. Shared fail-closed validation turns compatibility drift into an early, direct failure.
## Runtime Script Sync Fail-Closed Pattern (IMPORTANT)
**Rule**: Publication-to-runtime script persistence must never report sync success while silently skipping `_app_scripts` data.
**Required**:
- Treat `_app_scripts` bootstrap errors as real sync failures.
- Throw if `_app_scripts` is still unavailable after bootstrap rather than skipping script persistence.
- Normalize snapshot and persisted script metadata, including SDK compatibility, before diffing or persisting rows.
- Treat the legacy `idx_app_scripts_codename_active` index as compatible only when it preserves the full runtime uniqueness shape: `attached_to_kind`, `COALESCE(attached_to_id, null-scope uuid)`, `module_role`, `codename`, and the active-row predicate on `_upl_deleted` / `_app_deleted`.
- Let the higher-level sync engine surface the persistence error as an application sync failure instead of downgrading it to a warning.
**Detection**: `rg "persistPublishedScripts|_app_scripts|ensureSystemTables|normalizeSnapshotScripts" packages/applications-backend`
**Why**: A fail-open sync path can make runtime applications look healthy while published scripts never reach `_app_scripts`. Fail-closed persistence preserves the real publication/runtime contract.
## Dedicated Client Bundle Delivery Pattern (IMPORTANT)
**Rule**: Runtime script list surfaces must never expose executable bundle bodies; client code is delivered through a dedicated cacheable bundle endpoint.
**Required**:
- Strip `serverBundle` and `clientBundle` from runtime list payloads returned to client-facing consumers.
- Serve client bundles from a dedicated applications-backend route with `ETag` / cache validators instead of piggybacking on the manifest list response.
- Keep `serverBundle` backend-only at all times.
- Update widget/runtime bridges to fetch client bundles separately before execution.
**Detection**: `rg "getClientScriptBundle|clientBundle|serverBundle|If-None-Match|ETag" packages/applications-backend packages/apps-template-mui`
**Why**: Inline bundle payloads widened the runtime surface and mixed metadata delivery with executable content. The dedicated endpoint keeps the contract smaller, cacheable, and fail-closed.
## Metahub Export Authorization Pattern (IMPORTANT)
**Rule**: Direct metahub snapshot export is a management action, not a membership-level read action.
**Required**:
- Backend `GET /metahub/:metahubId/export` must call `ensureMetahubAccess(..., 'manageMetahub', ...)`.
- Frontend metahub action menus must gate export with the same `permissions.manageMetahub` seam already used for edit/delete/copy.
- Keep a direct route-level forbidden regression test for export so permission drift fails closed.
**Detection**: `rg "exportMetahub|manageMetahub|/export" packages/metahubs-backend packages/metahubs-frontend`
**Why**: QA found that export had been left on bare membership access even after the frontend started exposing it as a user-facing action. Export now has to stay aligned with the explicit management contract on both sides.
## Metahub Snapshot Script Round-Trip Pattern (IMPORTANT)
**Rule**: Metahub snapshot export/import must preserve design-time script authoring state, not only publication/runtime bundles.
**Required**:
- `GET /metahub/:metahubId/export` must augment exported `snapshot.scripts` with live `sourceCode` before envelope hashing so committed metahub fixtures can restore the authoring script, not only the compiled bundles.
- `SnapshotRestoreService.restoreFromSnapshot(...)` must clear and restore `_mhb_scripts`, remapping entity- and attribute-scoped attachment ids from snapshot ids to the newly inserted branch ids.
- When older snapshots do not embed `sourceCode`, restore must still keep manifest/bundle/checksum data and write a valid placeholder authoring source instead of silently dropping the script.
- E2E fixture validation should assert both restored design-time scripts on the imported metahub and runtime client/server bundle delivery from the application created from that import.
**Detection**: `rg "sourceCode: liveScript.sourceCode|restoreScripts\(|_mhb_scripts|snapshot-import-quiz-runtime" packages tools/testing/e2e`
**Why**: Export already carried `snapshot.scripts` bundles, but import previously skipped `_mhb_scripts`, which made imported scripting metahubs appear valid while losing the script before republishing.
## Self-Hosted Migrations Surface Documentation Pattern (IMPORTANT)
**Rule**: Self-hosted migrations parity must be documented as a real navigation/page/guard surface, not as a synthetic snapshot section.
**Required**:
- Reuse the existing migrations menu items, pages, API hooks, and guards in `metahubs-frontend` and `applications-frontend`.
- Do not add fake migration entities to the committed self-hosted fixture just to satisfy documentation.
- Keep plans/progress/memory wording aligned with the shipped UI surface.
**Detection**: `rg "migrations|MigrationGuard|/migrations" packages/metahubs-frontend packages/applications-frontend memory-bank`
**Why**: The implementation already shipped real migrations UI surfaces, but QA found the plan language still implied that parity depended on a fixture-level migration section. Documenting the actual seam prevents future drift between product reality and the fixture contract.
## Generated REST Docs Source-Of-Truth Pattern (IMPORTANT)
**Rule**: `@universo/rest-docs` must derive its OpenAPI path and method inventory from the live backend route files, not from a hand-maintained historical YAML taxonomy.
**Required**:
- Update `packages/universo-rest-docs/scripts/generate-openapi-source.js` when mounted route families are added, removed, or remapped.
- Keep `packages/universo-rest-docs/src/openapi/index.yml` generated from that script before validate/build.
- Delete removed route families from the generator inputs immediately so Swagger stays fail-closed.
- Keep GitBook API-reference pages aligned with the standalone interactive docs workflow.
**Detection**: `rg "generate-openapi-source|routeSources|interactive-openapi-docs" packages/universo-rest-docs docs`
**Why**: The repository has already removed older workspace-era API domains. Leaving REST docs on a hand-maintained mirror makes deleted route families look alive long after the runtime stopped mounting them.
## Turbo 2 Root Cache Contract Pattern (IMPORTANT)
**Rule**: Root Turborepo tasks must keep generated artifacts out of task `inputs`; otherwise repeated workspace builds self-invalidate and Turbo degrades back into an orchestrator.
**Required**:
- Keep the root config on Turbo 2 `tasks` syntax with `envMode: "strict"`.
- Include root dependency manifests that should invalidate the whole workspace cache, at minimum `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `tsconfig.json`, in `globalDependencies`.
- Exclude generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts from task `inputs` for cached tasks such as `build` and `test`.
- Keep package-level Turbo overrides minimal and evidence-based; the current confirmed exception is `packages/apps-template-mui`, whose `build` script is `tsc --noEmit` and therefore must declare `outputs: []`.
- Validate Turbo contract changes with two consecutive root builds and require the second run to show cache hits before considering the migration complete.
**Detection**: `rg '"tasks"|globalDependencies|outputs|inputs' turbo.json packages/*/turbo.json`
**Why**: The first Turbo 2 migration pass built successfully but still produced `0 cached` on repeated runs because task hashes included `dist/**`, `build/**`, and `.turbo/turbo-build.log` as inputs. Excluding generated artifacts restored `28/28` cache hits on the next repeated root build.
## Fixed System-App Snapshot-Equivalent Baseline Pattern (IMPORTANT)
**Rule**: Package-local docs and implementation for fixed system apps must describe applications and metahubs as separate application-like platform apps whose current baseline is maintained as a manual snapshot-equivalent model, then codified in `SystemAppDefinition` plus file-backed SQL support migrations and materialized during platform bootstrap.
**Required**:
- Update the fixed system-app manifest and the companion parity SQL artifact together when the baseline shape changes.
- Document platform-start fixed-schema bootstrap separately from metahub branch runtime migrations and from application runtime sync/release-bundle flows.
- Keep the current ownership split explicit: `@universo/metahubs-backend` hosts migration-control routes, while `@universo/applications-backend` owns runtime sync and release-bundle execution.
**Detection**: `rg "systemAppDefinition|CreateApplicationsSchema|CreateMetahubsSchema|/application/:applicationId/migrations|/application/:applicationId/sync" packages`
**Why**: Future documentation or refactor waves can easily blur fixed bootstrap, runtime migration ownership, and the temporary manual-baseline origin unless the repository keeps this hybrid model explicit.
## Definition-Driven Fixed-System-App Constraint Promotion Pattern (IMPORTANT)
**Rule**: When a fixed system app relies on definition-driven schema generation for business tables, package-local `CREATE TABLE ... CONSTRAINT ...` SQL embedded in support migrations is not the source of truth for the final table shape and must not be trusted to carry business-table constraints.
**Required**:
- Keep table creation concerns inside the `SystemAppDefinition` business-table model and the schema compiler.
- Express extra business-table constraints that are not representable in the definition model as explicit post-generation SQL, for example `ALTER TABLE ... ADD CONSTRAINT ...` in a `post_schema_generation` migration.
- Add regression tests that assert the post-generation migration contains the explicit constraint statement whenever a package migration intentionally filters out `CREATE TABLE IF NOT EXISTS <schema>.*` support SQL.
**Detection**: `rg "CREATE TABLE IF NOT EXISTS start\.|ADD CONSTRAINT|post_schema_generation|startsWith\('CREATE TABLE IF NOT EXISTS'" packages/*/base/src/platform packages/universo-migrations-platform/base/src/__tests__`
**Why**: The start-system-app PR review exposed that the compiler-generated `start.rel_user_selections` table never received the inline `catalog_kind` CHECK because the support migration intentionally discarded the package-local `CREATE TABLE` statements during bootstrap splitting.
## Platform System Attributes Governance Pattern (IMPORTANT)
**Rule**: Platform catalog system attributes (`_upl_*`) remain part of the shared catalog system-field registry, but their create/visibility behavior is governed by global admin settings rather than only by per-metahub configuration.
**Required**:
- Resolve platform system-attribute policy on the metahubs backend from `admin.cfg_settings` using the `metahubs` category keys `platformSystemAttributesConfigurable`, `platformSystemAttributesRequired`, and `platformSystemAttributesIgnoreMetahubSettings`.
- Pass that policy into shared catalog seeding flows (`ensureCatalogSystemAttributes(...)`) on catalog create/copy paths so platform defaults are enforced consistently even when ordinary attribute copy is skipped.
- Reuse the same backend policy helper for existing `_upl_*` toggle writes and for template-driven catalog seeding; UI visibility is advisory only and must not be the sole enforcement layer.
- Hide `_upl_*` rows from catalog System responses when platform configuration is disabled, but continue returning the resolved policy in list-response `meta` so the frontend can match backend rules.
- Keep the System tab on dedicated `/system` routes rather than query-param tabs, and preserve canonical registry order during optimistic toggle updates.
**Detection**: `rg "platformSystemAttributes|ensureCatalogSystemAttributes\(|/system'|/system\"" packages/admin-* packages/metahubs-* packages/universo-template-mui`
**Why**: Platform attributes must be creatable independently of metahub configuration when required by policy, and UI-only hiding or toggle logic is insufficient unless backend seeding, template repair, existing toggle writes, and optimistic ordering all share the same contract.
## Three-Level System Fields Architecture (CRITICAL)
**Rule**: All entities use prefixed system fields, but runtime business-table lifecycle families are contract-driven rather than unconditional.
**Levels**:
- `_upl_*` (Platform): Base fields for all entities — business tables always keep `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `purge_after`, `locked`, `locked_at`, `locked_by`, `locked_reason`, while configurable runtime `archived*` and `deleted*` families are emitted only when catalog `config.systemFields.fields` enables them.
- `_app_*` (Application): Run-Time fields for platform system tables and business tables. Business tables always keep `_app_owner_id` and `_app_access_level`, while `published*`, `archived*`, and soft-delete `_app_deleted*` columns are emitted only when the catalog lifecycle contract enables them.
- `_mhb_*` (Metahub Branch): Design-Time fields ONLY inside dynamic branch schemas (`mhb_<uuid>_bN`) — kept separate from `_app_*`.
**Lifecycle source of truth**: metahub catalog system rows live in `_mhb_attributes`, publication snapshots emit `systemFields`, runtime `_app_objects.config.systemFields.lifecycleContract` drives `_app_*`, and runtime `config.systemFields.fields` drives configurable `_upl_archived*` / `_upl_deleted*` presence.
**Active row predicate (platform tables)**: always `_upl_deleted = false`; add `_app_deleted = false` only when the runtime lifecycle contract uses soft delete.
**Active row predicate (branch schemas)**: `_upl_deleted = false AND _mhb_deleted = false`
**Cascade Delete Logic**: runtime soft delete writes `_upl_deleted*` only when the configurable platform delete family is enabled, and writes `_app_deleted*` only when the runtime lifecycle contract uses soft delete; hard delete mode removes the row physically. Branch delete continues to use `_mhb_deleted` → `_upl_deleted`.
**Required**: Always pass `createdBy`/`updatedBy` or `_uplCreatedBy`/`_uplUpdatedBy` when creating/updating entities.
**Detection**: `rg "lifecycleContract|resolvePlatformSystemFieldsContractFromConfig|systemFields|_app_deleted|_upl_deleted" packages/applications-backend packages/schema-ddl packages/metahubs-backend packages/universo-utils`.
**Why**: Runtime schema generation, CRUD predicates, and publication/app sync must agree on the same contract; treating either `_app_*` or configurable `_upl_*` runtime families as unconditional will reintroduce invalid SQL predicates, missing-column bugs, and stale architecture assumptions.
## Codename JSONB Single-Field Pattern (IMPORTANT)
**Rule**: Persist codename in one field only, `codename JSONB`, using the canonical VLC / `VersionedLocalizedContent<string>` shape; do not persist `codename_localized`, string-only codename storage, or `presentation.codename` as a second codename seam.
**Required**:
- Use the extracted primary locale content as the canonical machine identifier for duplicate checks, uniqueness indexes, ordering, and route/store lookups.
- Treat `general.codenameLocalizedEnabled` as a VLC payload-shaping/editor flag only: when false, persist a single-locale VLC via `enforceSingleLocaleCodename(...)` instead of flattening codename to plain text or reviving legacy secondary codename columns.
- Sanitize every locale entry in the codename VLC document under the configured codename style/alphabet policy, but enforce hard uniqueness only on the extracted primary locale content.
- Implement SQL uniqueness and sort semantics through immutable extracted-primary expression indexes or helper expressions rather than by storing a second machine codename column.
- For fixed system apps, any codename storage/index contract change that must reach already-deployed schemas requires a new versioned `post_schema_generation` migration ID; editing an already-applied bootstrap definition is not a live upgrade path.
- Reuse shared codename helpers from `@universo/types` / `@universo/utils` for codename validation, primary-text extraction, and VLC normalization.
- Runtime request-body handling must normalize JSON codename to its primary text before using codename as a field key; route code must not index request payloads with raw JSON objects.
- Copy flows must follow the same boundary rule as create/update flows: derive uniqueness from extracted primary codename text, but persist through shared VLC/store helpers instead of raw SQL string inserts or `String(jsonbValue)` coercion.
**Detection**: `rg "codename_localized|presentation\?\.codename|ORDER BY codename ASC|data\[[^\]]*codename" packages docs`
**Why**: The approved architecture is one persisted codename field across shared types, fixed schemas, snapshots, and runtime metadata. Reintroducing a second codename seam would recreate the same storage/query drift that this wave is removing.
## Runtime Admin Codename Validation Pattern (IMPORTANT)
**Rule**: Admin role codename validation must be split into two layers: a broad shared schema that accepts any supported runtime format plus legacy slugs, and an exact backend route check that reads the active `metahubs` codename settings from `admin.cfg_settings` before create/copy/update writes.
**Required**:
- Keep `RoleCodenameSchema` broad enough to avoid rejecting inputs that are valid under a non-default runtime codename configuration.
- Perform exact role codename validation in `rolesRoutes` after reading `codenameStyle`, `codenameAlphabet`, and `codenameAllowMixedAlphabets` from settings, and after applying `enforceSingleLocaleCodename(...)`.
- Preserve legacy lowercase slug compatibility for already-existing role codenames during the route-level check.
- Keep admin frontend role codename UX and backend validation aligned with the same runtime settings contract.
**Detection**: `rg "RoleCodenameSchema|codenameStyle|codenameAlphabet|codenameAllowMixedAlphabets|usePlatformCodenameConfig" packages/admin-*`
**Why**: The admin UI already used runtime codename settings while backend role validation remained hardcoded to PascalCase + `en-ru`, which created a frontend/backend drift and false request rejections under valid non-default settings.
## Self-Scoped Admin SQL Helper Pattern (IMPORTANT)
**Rule**: Admin `SECURITY DEFINER` helper functions that accept an optional or explicit `user_id` must remain self-scoped for authenticated request sessions and may perform cross-user introspection only from Tier 2 backend/bootstrap contexts where `auth.uid()` is absent.
**Required**:
- Guard helper functions such as `admin.has_permission(...)`, `admin.is_superuser(...)`, `admin.has_admin_permission(...)`, `admin.get_user_permissions(...)`, and `admin.get_user_global_roles(...)` so `p_user_id IS DISTINCT FROM auth.uid()` raises `42501` whenever `auth.uid()` is present.
- Keep `authenticated` execute grants only when the SQL function body itself enforces the self-scope rule; safe `search_path` alone is not sufficient.
- Preserve backend/bootstrap ability to inspect arbitrary users through pool/service execution where no request JWT user is bound.
- Cover this contract in migration-level tests and in at least one live bootstrap path that exercises the existing-user branch.
**Detection**: `rg "Authenticated sessions may inspect only their own|get_user_permissions|get_user_global_roles|has_admin_permission|is_superuser" packages/admin-backend packages/auth-backend`
**Why**: Without a self-scope guard, helper functions granted to `authenticated` can leak cross-user role and permission state even when the surrounding backend routes remain correctly authorized.
## Controller–Service–Store Backend Pattern (IMPORTANT)
**Rule**: Backend route files must stay thin (~30–80 lines of route registrations); all handler logic lives in domain controllers, which delegate to services and stores.
**Required**:
- Route file: `router.get('/path', controller.handler)` — no inline logic.
- Controller: receives `(req, res, next)`, validates input, calls services, formats response.
- Service: orchestrates business logic, transactions.
- Store: raw SQL via `DbExecutor.query(sql, params)`.
- `createMetahubHandler(services)` factory injects shared services into metahub controllers.
- `asyncHandler(fn)` wraps async Express handlers to forward rejected promises to `next()`.
**Detection**: `rg "createMetahubHandler|asyncHandler" packages/metahubs-backend packages/applications-backend`
**Why**: 13 metahubs route files (15,000+ → ~700 lines) and 3 applications route files (5,700+ → ~140 lines) were refactored to this pattern, preventing inline handler bloat.
## Frontend List Component Decomposition Pattern (IMPORTANT)
**Rule**: Large list page components (~1,000–2,500 lines) must be split into a data hook + utils module + presentation component.
**Required**:
- `use<Domain>ListData(metahubId)` hook: encapsulates all React Query calls, pagination, search, filtering, dialog state.
- `<domain>ListUtils.ts`: pure functions (display formatting, sort helpers, VLC mappers).
- Presentation component: consumes hook return value and renders UI.
- `useMetahubHubs(metahubId)` shared hook: centralizes hub list queries with `staleTime: 5min` and automatic React Query deduplication.
**Detection**: `rg "useMetahubHubs|ListData|ListUtils" packages/metahubs-frontend/base/src`
**Why**: 11 list components decomposed; replaced 8 duplicate hub query implementations with one shared hook.
## Domain Error Handler Factory Pattern (IMPORTANT)
**Rule**: Frontend mutation error handling must use `createDomainErrorHandler(config)` factory instead of inline switch/if chains.
**Required**:
- Factory accepts `{ errorCodeMap, fallbackKey, t, enqueueSnackbar }`.
- `errorCodeMap` maps backend error codes to `{ messageKey, severity }`.
- Fallback chain: matched code → `response.data.message` → `error.message` → `t(fallbackKey)`.
- Backend domain errors extend `MetahubDomainError` base class with typed `statusCode` and `code`.
**Detection**: `rg "createDomainErrorHandler|MetahubDomainError" packages/metahubs-frontend packages/metahubs-backend`
**Why**: 6+ mutation files shared nearly identical error handling; the factory eliminates ~20 lines of boilerplate per mutation file.
---
## Public Routes & 401 Redirect Pattern (CRITICAL)
**Rule**: Keep public UI/API allowlists in `@universo/utils/routes` and use `createAuthClient({ redirectOn401: 'auto' })` so public routes do not redirect into auth flows accidentally.
**Detection**: `rg "isPublicRoute" packages`
**Why**: Centralized public-route ownership prevents 401-loop and public-route drift across frontends.
## CSRF Token Lifecycle + HTTP 419 Contract (CRITICAL)
**Rule**: Backend maps `EBADCSRFTOKEN` to HTTP `419`; frontend clears cached CSRF state, fetches a fresh token, and retries at most one safe protected request.
**Detection**: `rg "419|EBADCSRFTOKEN" packages`
**Why**: Consistent retry-once behavior avoids stale-token ghost failures and infinite retry loops.
## Backend Status Codes + PII-safe Logging (CRITICAL)
**Rule**: Preserve intended `400` / `403` / `404` codes and keep logs free of emails, tokens, captcha payloads, or other PII.
**Detection**: `rg "console\.log\(.*token" packages`
**Why**: Sanitized logs and stable status codes keep frontend error handling and operational diagnostics trustworthy.
## ENV Feature Flags + Public Config Endpoint Pattern
**Rule**: Parse auth feature flags in shared utils and expose them through dedicated config endpoints so frontend toggles consume backend truth instead of hardcoded env reads.
**Detection**: `rg "AUTH_.*ENABLED|auth-config|captcha-config" packages`
## Source-Only Package PeerDependencies Pattern (CRITICAL)
**Rule**: Source-only packages (no dist/) must use `peerDependencies`.
**Required**: no `"main"` field in source-only packages.
**Detection**: `find packages/*/base -name "package.json" -exec rg -L '"main"' {} \; | xargs rg '"dependencies"'`.
**Symptoms**:
- Duplicate React instances.
- PNPM hoist conflicts.
**Fix**: Move runtime deps to `peerDependencies`.
## Stable Subpath Export Pattern For tsdown Packages (IMPORTANT)
**Rule**: Every package subpath export that points to `dist/...` must have its own explicit tsdown entry.
**Required**:
- If `package.json` exports `./some-subpath`, tsdown must emit stable files for that subpath (for example `dist/someSubpath.js`, `dist/someSubpath.mjs`, `dist/someSubpath.d.ts`).
- Do not rely on hash-only shared chunks to satisfy exported subpaths.
- Test-only source aliases must stay in Vitest/Vite config, not in package tsconfig files that participate in production builds.
**Symptoms**:
- Workspace package builds fail with `TS2307` for a valid exported subpath.
- Package exports point at files that do not exist in `dist/`.
- Production builds start importing source files outside `rootDir` because a temporary source alias leaked into build-time tsconfig.
**Fix**:
- Add a dedicated tsdown entry for the exported subpath.
- Keep source-resolution overrides local to test config when source-based tests need them.
**Why**: Workspace consumers resolve exported package subpaths during package builds; stable dist outputs are required for TypeScript and bundlers to agree on the same module surface.
## Shell-To-Feature Dependency Direction Pattern (IMPORTANT)
**Rule**: Frontend feature packages rendered by `@universo/template-mui` routes must remain leaf packages and must not depend back on the shell package that imports and routes them.
**Required**:
- Keep the dependency direction one-way: `@universo/template-mui` may depend on feature frontend packages, but those feature packages must not import runtime UI helpers back from `@universo/template-mui`.
- If a feature dashboard needs generic cards/layout primitives, either use MUI directly or move the primitive into a lower shared package that does not itself depend on routed feature packages.
- When adding a new routed feature package, declare it explicitly in the shell package `dependencies` so PNPM/Vite resolve the package from the shell import site.
**Symptoms**:
- `pnpm install` reports a workspace cycle between the shell and a newly added feature package.
- Production builds fail to resolve a feature package subpath imported from `MainRoutesMUI.tsx` even though the package exists in the workspace.
**Detection**:
- `rg "@universo/metapanel-frontend|MainRoutesMUI|@universo/template-mui" packages/*/base/package.json packages/universo-template-mui/base/src/routes`
**Why**: The shell owns routing composition. If a routed feature package also depends on shell UI exports, PNPM creates a cycle and production consumers can fail on package-graph resolution even when local package builds appear green.
## Workspace Shell Access Versus Admin Access Pattern (IMPORTANT)
**Rule**: Workspace shell access and admin-panel access are separate contracts; admin-only roles must not inherit workspace routing just because they can reach `/admin`, and workspace access must be derived from real workspace capabilities instead of hardcoded role codenames.
**Required**:
- Resolve workspace-shell access (`/`, `/metapanel`, registered-user guards, start redirect escape, shared dashboard entry) from actual permissions/CASL ability for workspace subjects such as `Application`, `Metahub`, and `Profile`, not only from `user` / `superuser` role codenames.
- Route authenticated admin-only roles to `/admin` instead of `/metapanel` when resolving the root/home path.
- Keep `registered`-only users fail-closed on `/start`, even when shared dashboard/backend contracts are widened for ordinary workspace users.
- Keep admin navigation visibility driven by `canAccessAdminPanel`, not by the workspace-shell resolver.
- Reuse one shared frontend helper and one aligned backend helper so shell/menu/start/dashboard decisions do not drift.
**Detection**:
- `rg "resolveShellAccess|HomeRouteResolver|RegisteredUserGuard|StartAccessGuard" packages/universo-template-mui/base/src`
**Why**: The admin roles / metapanel QA reopen exposed two separate failure modes: conflating admin access with workspace access routed admin-only roles into the workspace shell, and codename-only workspace checks kept custom capability-based roles out of the shell/dashboard even when their permissions should have allowed entry.
## Compensating Lifecycle Writes Pattern (IMPORTANT)
**Rule**: When auth/admin lifecycle flows cross non-transactional boundaries such as Supabase auth user creation and later role provisioning, the route must compensate already-completed earlier steps if a later required step fails.
**Required**:
- Admin-side user creation must delete the just-created Supabase auth user when `setUserRoles(...)` fails after successful `createUser(...)` or invite provisioning.
- Registration must surface explicit rollback status when post-signup provisioning fails, and should compensate both the local profile row and the auth user when service-role cleanup is available.
- Onboarding completion must revert `profiles.cat_profiles.onboarding_completed` when auto-promotion to `user` fails for a newly completed profile.
- Failures after compensation should stay explicit in the HTTP response instead of being reduced to a silent generic success or ambiguous partial-success state.
**Detection**:
- `rg "deleteUser\(|cleanupRegisteredUser|onboarding_completed = \$1|create-user|assignSystemRole" packages/admin-backend packages/auth-backend packages/start-backend`
**Why**: These flows cannot be made fully atomic across Supabase auth and SQL-side role/profile writes, so correctness depends on explicit compensation rather than optimistic assumption that later steps will always succeed.
## Browser Env Precedence Pattern (IMPORTANT)
**Rule**: Shared browser-facing env helpers must resolve runtime config in this order: host-provided public env → Vite `import.meta.env` → `process.env` → browser origin.
**Required**:
- `@universo/utils` browser consumers must use the dedicated browser env entry instead of the Node/shared env module.
- Host-provided `__UNIVERSO_PUBLIC_ENV__` overrides remain the highest-precedence runtime source.
- Browser helpers may fall back to `window.location.origin` only when no explicit base URL is provided.
- Browser-oriented packages that mirror env access outside `@universo/utils` must preserve the same precedence order.
**Detection**:
- `rg "__UNIVERSO_PUBLIC_ENV__|import.meta.env|getBrowserOrigin" packages/universo-utils/base/src packages/universo-store/base/src`
**Why**: Browser bundles need to preserve Vite runtime configuration without regressing host-level override injection or Node/test fallbacks.
## Dual Entrypoint Export Parity Pattern (IMPORTANT)
**Rule**: Packages that publish both a main/root entrypoint and a browser-specific entrypoint must keep all browser-safe public exports aligned between those entrypoints.
**Required**:
- When a helper is exported from the main package root and is safe for browser bundles, re-export it from the browser entrypoint as well.
- Prefer fixing public-surface parity in the shared package instead of adding consumer-side deep-import workarounds.
- Revalidate at least one downstream dist consumer and the final shell/root build whenever browser entry exports change.
**Detection**:
- `rg "index.browser|browser" packages/*/base/src packages/*/base/package.json`
- `rg "from '@universo/utils'" packages/*/base/src`
**Why**: The codename JSONB closure exposed that `@universo/metahubs-frontend` dist consumed `getCodenamePrimary` from `@universo/utils`, but `@universo/utils/src/index.browser.ts` lagged behind `src/index.ts`. That kind of drift surfaces only at downstream shell-build time and is safer to prevent centrally.
## Fixed-System-App Validation Length Parity Pattern (IMPORTANT)
**Rule**: When a fixed system-app manifest declares `physicalDataType: 'VARCHAR(N)'` for a string field, the manifest `validationRules.maxLength` must not exceed `N` in either the current or target business-table model.
**Required**:
- Keep profile/admin/application/metahub manifest validation metadata aligned with the physical fixed-schema contract.
- Preserve the same limits in compiled schema-plan and compiler-artifact tests, not only in package-local manifest tests.
- Treat UI/manifest metadata that permits longer values than the database column as a correctness bug, not as a soft documentation mismatch.
**Detection**:
- `rg "maxLength:|physicalDataType: 'VARCHAR" packages/*/base/src/platform packages/universo-migrations-platform/base/src/__tests__`
**Why**: Manifest metadata now drives compiler artifacts, docs, and UI validation. If it allows longer values than PostgreSQL accepts, the system can report input as valid and then fail on write.
## Definition Artifact Equivalence Pattern (CRITICAL)
**Rule**: Registered-definition no-op detection must compare the full stable artifact payload signature, not only the compiled SQL checksum.
**Required**:
- `registerDefinition()` may return `unchanged` only when checksum parity and full artifact-equivalence both hold.
- Startup/catalog preflight checks in `@universo/migrations-platform` must compare stored active payload artifacts to the incoming artifacts before skipping sync.
- Dependency lists and other artifact metadata that can change independently of SQL text must be part of the equivalence signature.
**Detection**:
- `rg "areDefinitionArtifactsEquivalent|buildDefinitionArtifactComparisonSignature" packages/universo-migrations-catalog/base/src packages/universo-migrations-platform/base/src`
**Why**: Dependency-only changes are operationally meaningful. Checksum-only parity can leave the active registry payload stale even though the platform reports a false green no-op state.
## Bundle Export Lifecycle Recording Pattern (CRITICAL)
**Rule**: Bundle-oriented catalog exports must record the same published revision export rows as non-bundle export paths.
**Required**:
- After `exportDefinitionBundle(...)`, the platform must record `definition_exports` rows for every exported active published revision.
- Doctor and sync health may rely on the recorded revision lifecycle, not on whether the export was bundle or non-bundle shaped.
- Bundle export metadata should preserve the operational source/target context used to create the bundle.
**Detection**:
- `rg "recordCatalogDefinitionExports|exportDefinitionBundle" packages/universo-migrations-platform/base/src`
**Why**: CLI and operational export paths increasingly use bundles. If bundle exports skip lifecycle recording, doctor/export health drifts from the actual artifacts users generated.
## Definition Lifecycle Import Pattern (CRITICAL)
**Rule**: Active catalog imports must use the real definition lifecycle (`draft` → `review` → `published`) instead of registering active revisions directly.
**Required**:
- `importDefinitions()` must go through lifecycle helpers that create a draft, request review, and publish the draft unless the current active revision already carries published lifecycle provenance.
- `registerDefinition()` must preserve/merge published lifecycle provenance even for unchanged revisions, because repeated imports are allowed to refresh provenance without changing the checksum.
- Platform catalog-state no-op checks and doctor output must treat published lifecycle provenance as part of lifecycle completeness, not only registry/checksum/export parity.
**Detection**:
- `rg "importDefinitions\(|publishDefinitionDraft\(|requestDefinitionReview\(" packages/universo-migrations-catalog/base/src`
- `rg "hasPublishedLifecycle|missingPublishedLifecycleKeys" packages/universo-migrations-platform/base/src`
**Why**: The plan requires real lifecycle operations for drafts, review, publish, export, and import metadata. If active sync/import bypasses that lifecycle, the platform can report a green checksum/export state while still missing the approval-ready lifecycle contract.
## Optional Global Catalog Capability Pattern (CRITICAL)
**Rule**: Global migration catalog features must be explicitly gated by `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED`; disabled mode must preserve local canonical migration history and only keep the minimal platform migration kernel.
**Required**:
- Runtime application and metahub writes keep `_app_migrations` / `_mhb_migrations` as canonical history and may mirror to the global catalog only when the feature flag is enabled.
- Platform execution in disabled mode must use only `upl_migrations.migration_runs` through `PlatformMigrationKernelCatalog`; it must not auto-bootstrap definition-registry tables.
- Catalog-backed commands such as definition sync/import/export must fail explicitly when the feature flag is disabled instead of silently degrading.
- Enabled mode remains fail-closed: if global mirroring or catalog lifecycle work is requested and the catalog path fails, the write must fail.
**Detection**:
- `rg "UPL_GLOBAL_MIGRATION_CATALOG_ENABLED|PlatformMigrationKernelCatalog|globalMigrationCatalogEnabled" packages`
**Why**: The repository now supports two valid operational modes. Reintroducing unconditional full-catalog bootstrap into startup or runtime paths would recreate the original cold-start dependency that this wave removed.
## Release-Bundle Canonical Snapshot-Hash Pattern (CRITICAL)
**Rule**: `application_release_bundle` validation must recompute a canonical embedded snapshot hash before trusting `manifest.snapshotHash` for artifact checksums, installation metadata, or runtime lineage decisions.
**Required**:
- Publication bundles derive the canonical hash from the normalized publication snapshot contract; application-origin bundles derive it from the runtime snapshot checksum contract.
- Bundle validation must fail closed when `manifest.snapshotHash` does not match the embedded snapshot, even if bundle artifact checksums were recomputed to match the tampered manifest.
- Bundle-apply routes and `installed_release_metadata` persistence must use the recomputed canonical hash, not the unchecked manifest field.
**Detection**:
- `rg "calculateCanonicalApplicationReleaseSnapshotHash|resolveApplicationReleaseSnapshotHash|validateApplicationReleaseBundleArtifacts" packages/applications-backend/base/src`
**Why**: `manifest.snapshotHash` drives idempotency and release lineage. Trusting it without recomputation allows a structurally valid but semantically tampered bundle to alter no-op decisions and stored release provenance.
## Shared Publication Snapshot Hash Pattern (CRITICAL)
**Rule**: Publication snapshot hash normalization must live in one shared helper in `@universo/utils`, and both producer and consumer packages must use that helper for canonical verification.
**Required**:
- Keep publication hash normalization aligned with `SnapshotSerializer.normalizeSnapshotForHash(...)`, including `systemFields`, exported design-time sections such as `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, and omission semantics for absent optional keys.
- Treat every new snapshot-export section as a shared hash-contract change: update `PublicationSnapshotHashInput`, `normalizePublicationSnapshotForHash(...)`, and the corresponding snapshot-envelope plus release-checksum regressions in the same wave.
- Make both `@universo/metahubs-backend` and `@universo/applications-backend` call the shared helper instead of maintaining package-local copies.
- Add direct shared regression coverage whenever publication snapshot structure changes.
**Detection**: `rg "publicationSnapshotHash|normalizePublicationSnapshotForHash|normalizeSnapshotForHash" packages/universo-utils/base/src packages/applications-backend/base/src packages/metahubs-backend/base/src`
**Why**: Producer/consumer drift already caused false snapshot-hash mismatches during application sync; one shared normalization seam keeps publication export, transport validation, and release-bundle lineage aligned.
## Scoped Paginated View Isolation Pattern (IMPORTANT)
**Rule**: Screens that switch between semantically different paginated scopes inside the same component instance must not reuse previous-query placeholder data across query-key changes.
**Required**:
- Pass `keepPreviousDataOnQueryKeyChange: false` to `usePaginated(...)` when a route/tab switch changes the list scope itself rather than just the page number.
- Reset local row-specific UI state such as expanded-table ids when the scope/tab changes, so stale per-row UI state does not bleed into the next scoped list.
- Keep this opt-out local to truly scope-changing screens; ordinary page/sort transitions may still keep previous data when the UX benefits from it.
**Detection**:
- `rg "keepPreviousDataOnQueryKeyChange|activeCatalogTab|scope: isSystemView" packages/metahubs-frontend/base/src`
## Publication Executable Payload Lifecycle Hydration Pattern (CRITICAL)
**Rule**: Publication-driven application release bundles must hydrate top-level `snapshot.systemFields` back into each executable entity config before schema snapshot generation or runtime schema apply.
**Required**:
- Keep `createApplicationReleaseBundle(...)` aligned with the publication snapshot contract where catalog lifecycle metadata lives in `snapshot.systemFields`, not only in `snapshot.entities[*].config`.
- Ensure the executable payload entities used for bootstrap and incremental schema execution carry `config.systemFields.lifecycleContract` whenever the publication snapshot defines it.
- Add regression coverage at the release-bundle or sync-route layer whenever publication snapshot lifecycle metadata changes, so schema-ddl is exercised through the real application-sync payload path rather than only through direct generator inputs.
**Detection**:
- `rg "snapshot\.systemFields|resolveReleaseBundleEntities|generateFullSchema\(" packages/applications-backend/base/src`
**Why**: Schema-ddl already honors `entity.config.systemFields.lifecycleContract`, but publication snapshots serialize that contract at the top level. If application release-bundle payloads are rebuilt from raw `snapshot.entities` without rehydrating `systemFields`, fresh application schemas silently recreate default `_app_published`, `_app_archived`, and `_app_deleted` columns even when the metahub disabled them.
**Why**: Reusing placeholder rows across a semantic scope switch can show stale entities from the previous tab and make two different list types appear mixed until a hard refresh.
## Application Release Bundle Sync-State Pattern (CRITICAL)
**Rule**: Publication-backed sync and file-bundle install/update for applications must share the same schema sync engine and the same central persistence seam in `applications.cat_applications`.
**Required**:
- `@universo/applications-backend` owns the canonical `application_release_bundle` contract plus the application release-bundle export/apply routes.
- Successful publication sync and successful bundle apply must both persist `installed_release_metadata` through the existing application schema sync-state contract, not through a second per-app or per-schema metadata store.
- Incremental bundle artifacts must carry a trusted `baseSchemaSnapshot` plus a precomputed `diff`; validation must recompute that diff from the embedded base snapshot and target payload before apply.
- Bundle apply may use release-version checks against `installed_release_metadata`, but for trusted incremental artifacts it must apply the embedded validated diff and reject tracked-schema/base-snapshot mismatches instead of recalculating an opportunistic runtime diff.
**Detection**:
- `rg "release-bundle|installedReleaseMetadata|application_release_bundle" packages/applications-backend/base/src`
**Why**: The optional-catalog architecture explicitly keeps application release/install state centralized. If bundle installs diverge into a separate metadata path, the platform loses one-source-of-truth behavior for sync status, release provenance, and recovery decisions.
## Fixed System-App Baseline Recording Pattern (CRITICAL)
**Rule**: Fixed system-app schema generation must record deterministic local baseline rows in `_app_migrations`, and repeated startup must backfill the baseline row when business tables already exist but local history is missing.
**Required**:
- Baseline migration names must be deterministic and derived from the registered system-app structure version (`baseline_<definition>_structure_<version>` with dots replaced by underscores).
- `SchemaGenerator.generateFullSchema(...)` must accept an explicit `migrationName` so fixed schemas do not depend on timestamp-generated baseline names.
- Repeated startup may backfill only the missing deterministic baseline row; it must not invent a second baseline or overwrite existing local history.
**Detection**:
- `rg "baseline_.*_structure_|migrationName\?: string|baseline_backfilled" packages/universo-migrations-platform/base packages/schema-ddl/base`
**Why**: Fixed schemas already own local `_app_migrations` tables. Without deterministic baseline recording, disabled-mode local history stays empty and repeated startup cannot distinguish a healthy preexisting schema from missing migration history.
## Doctor Lifecycle Export-Health Pattern (CRITICAL)
**Rule**: Registered-platform doctor checks must treat any export row on the active published revision as healthy; only sync/export operations themselves should care about a specific explicit export target.
**Required**:
- Doctor lifecycle inspection for registered platform definitions and system-app artifacts must accept any export recorded for the active revision.
- Sync/export commands must continue to record their explicit `exportTarget` values for provenance and replayability.
- Regression coverage must prove that doctor stays green when the active revision was exported by a non-bootstrap target such as CLI `migration sync`.
**Detection**:
- `rg "any-active-revision-export|inspectDefinitionCatalogLifecycle" packages/universo-migrations-platform/base/src`
**Why**: Doctor is a lifecycle-health check, not a command-origin filter. If it hardcodes a single bootstrap export target, valid active revisions exported by other stable operational paths will appear falsely unhealthy.
## Soft-Delete Parity At Persistence Boundaries (CRITICAL)
**Rule**: SQL-first stores and access guards must treat `_upl_deleted = true` or `_app_deleted = true` rows as inactive in every list/find/count/access query, not only in route-local ad hoc SQL.
**Required**:
- Put active-row predicates directly inside persistence helpers and guard lookups.
- Keep duplicate/single-required checks aligned with the same active-row predicate used by the partial indexes.
- Do not rely on route-level filtering alone for deleted-row exclusion.
**Detection**:
- `rg "FROM applications\\.(applications|connectors|connectors_publications|applications_users)" packages/applications-backend/base/src`
- Check that each read/count/access query also contains `COALESCE(..._upl_deleted, false) = false` and `COALESCE(..._app_deleted, false) = false` where applicable.
**Why**: The platform uses soft-delete flags plus active partial indexes to define live records. If stores or guards skip those predicates, deleted rows can silently reappear in access checks, duplicate-link detection, required-link constraints, and list/detail APIs.
## Metahub Active-Row Parity In SQL-First Stores (CRITICAL)
**Rule**: Metahub-domain SQL-first stores and access guards must treat rows as active only when both `_upl_deleted = false` and `_mhb_deleted = false`.
**Required**:
- Apply the dual predicate in metahub, branch, membership, publication, and publication-version list/find/count/access queries.
- Apply the same dual predicate inside soft-delete helpers and guard membership lookups, not only in route code.
- When soft-deleting metahub-domain rows, update both `_upl_*` delete fields and `_mhb_*` delete fields together.
**Detection**:
- `rg "_upl_deleted = false" packages/metahubs-backend/base/src/persistence packages/metahubs-backend/base/src/domains/shared`
- Verify that metahub-domain queries also include `_mhb_deleted = false` for the same alias or table.
**Why**: The platform schema and active partial indexes for metahub-domain tables define liveness through both delete layers. If SQL-first helpers only enforce `_upl_deleted`, deleted memberships can still grant access and deleted branches/publications can re-enter active reads.
## Cross-Schema Soft-Delete Predicate Pattern (CRITICAL)
**Rule**: Never reuse one domain's active-row predicate on tables from another schema if their lifecycle columns differ.
**Required**:
- Application tables use `_upl_deleted` plus `_app_deleted`.
- Metahub platform tables use `_upl_deleted` plus `_mhb_deleted`.
- Cross-schema joins must apply the predicate that matches each alias's owning schema, even when the query itself lives in one package.
**Detection**:
- `rg "activeRowPredicate\('p'\)|activeRowPredicate\('m'\)|_app_deleted" packages/applications-backend/base/src`
- Inspect joins from `applications.*` into `metahubs.*` and verify alias-specific predicates instead of one shared helper.
**Symptoms**:
- Runtime SQL errors such as `column p._app_deleted does not exist`.
- Connector/publication views fail only when cross-domain metadata is joined.
**Why**: Application and Metahub schemas intentionally keep different lifecycle columns. Cross-domain query helpers must preserve that contract per alias or they will emit invalid SQL despite both sides individually following soft-delete conventions.
## Managed Schema Drop Safety Pattern (CRITICAL)
**Rule**: Any helper that executes `DROP SCHEMA` for runtime application schemas must validate the schema name inside the helper itself, even if callers already performed route-level validation.
**Required**:
- Accept only managed application schemas (`app_*`) that pass the shared schema-name validator.
- Quote the identifier before interpolation into raw SQL.
- Fail before executing any SQL when validation fails.
**Why**: Route-level checks are not a sufficient safety boundary for reusable persistence helpers. The helper itself must enforce managed-schema rules so future callers cannot accidentally bypass the invariant.
## Managed Dynamic Schema Naming Pattern (CRITICAL)
**Rule**: Runtime and bootstrap code must build and validate managed schema names through the shared `@universo/migrations-core` helpers, not with local string templates or local regex checks.
**Required**:
- Use `buildManagedDynamicSchemaName(...)` for canonical managed application and metahub schema names.
- Use `isManagedDynamicSchemaName(...)` when validating incoming/stored managed schema names before DDL or raw SQL.
- Preserve current naming contracts exactly: `app_<uuid32>` for managed application schemas and `mhb_<uuid32>_bN` for metahub branch schemas.
- Align tests/mocks with those canonical names instead of placeholder strings such as `app_publication_1`.
**Why**: Centralizing managed-schema naming eliminates drift between schema-ddl, metahub runtime code, publication compensation paths, and regression fixtures, while keeping the live naming contract stable.
## Fresh-Bootstrap System-App Manifest Pattern (CRITICAL)
**Rule**: On recreatable environments, active system-app manifests must bootstrap only the canonical fresh-schema migration chain and must not keep table-rename reconciliation migrations in the live manifest path.
**Required**:
- The active applications fixed-schema manifest keeps only `CreateApplicationsSchema1800000000000` in its migration chain.
- Fresh bootstrap creates canonical `cat_*` / `rel_*` table names directly.
- Legacy reconcile migrations may exist only as historical references outside the active manifest path, or be deleted when no longer needed.
**Why**: Keeping rename-based reconciliation inside the active manifest hides fresh-DB regressions and violates the expected bootstrap contract for disposable environments.
## Applications Sync Persistence Target Pattern (CRITICAL)
**Rule**: Application runtime sync persistence helpers must write only to the converged fixed-schema tables `applications.cat_applications` and `applications.cat_connectors`, and they must refuse to update soft-deleted rows.
**Required**:
- `persistApplicationSchemaSyncState(...)` targets `cat_applications` with `_upl_deleted = false AND _app_deleted = false`.
- `persistConnectorSyncTouch(...)` targets `cat_connectors` with the same active-row guard.
- Direct service-level regression tests must cover these helpers because route tests may mock them.
**Why**: Route-level application sync tests often stub helper calls; without direct service coverage, stale pre-convergence table names can survive unnoticed until fresh-bootstrap runtime sync executes.
## TypeORM Residue Boundary Pattern (TRANSITIONAL)
**Rule**: Treat TypeORM as removed from the live architecture. No new package, route, service, or helper may introduce `DataSource`, repositories, entities, or TypeORM-specific request helpers.
**Required**: New work must use `@universo/database`, `DbExecutor`, `DbSession`, `SqlQueryable`, and SQL-first persistence stores.
**Detection**: `rg "typeorm|DataSource|getRequestManager\(|getRepository\(" packages`.
**Symptoms**:
- TypeORM APIs leaking back into freshly migrated packages.
- New docs or helpers describing `DataSource` or repository-based flows as current practice.
**Fix**:
```typescript
const executor = getRequestDbExecutor(req, createKnexExecutor(getKnex()))
return applicationsStore.listApplications(executor, userId)
```
**Exception**: compatibility-only comments or historical progress entries may mention removed TypeORM surfaces, but they must not describe them as current architecture.
## DDL Utilities Pattern (schema-ddl)
**Rule**: Runtime schema operations must use `@universo/schema-ddl` with DI-created services.
**Required**: Instantiate via `createDDLServices(knex)` or backend wrapper `getDDLServices()`.
**Avoid**: Deprecated static wrappers (use naming utilities directly) and unsafe raw string interpolation in `knex.raw`.
**Compensation Rule**: If metadata creation commits before a runtime DDL step runs, the caller must fail loudly and compensate the fresh metadata immediately when DDL/runtime sync fails.
**Why**: Consistent DI simplifies testing and reduces SQL injection risk.
## Application Runtime Sync Ownership Boundary (CRITICAL)
**Rule**: Application runtime schema sync and diff endpoints belong to `@universo/applications-backend`; metahubs only supplies publication-derived sync context as a narrow seam.
**Required**:
- Mount `/application/:applicationId/sync` and `/application/:applicationId/diff` from `createApplicationsServiceRoutes(...)`.
- Keep publication compilation and snapshot deserialization inside `@universo/metahubs-backend`, but expose them only through `loadPublishedPublicationRuntimeSource(...)`.
- Build the final application sync context inside `@universo/applications-backend` through `createLoadPublishedApplicationSyncContext(...)`.
- Inject the metahubs publication-runtime seam from `@universo/core-backend` instead of making `@universo/applications-backend` import metahubs internals directly.
**Why**: This preserves application-owned runtime orchestration, avoids cross-package architecture drift, and keeps the HTTP contract stable while separating publication authoring from application runtime schema ownership.
## Fixed-System-App Bootstrap Phase Boundary (CRITICAL)
**Rule**: Platform migrations that read or mutate generated fixed-system-app tables must run only in `post_schema_generation`, never in the prelude wave.
**Required**:
- Keep schema/extension/setup work that does not require generated business tables in `pre_schema_generation`.
- Register `OptimizeRlsPolicies1800000000200` in `post_schema_generation` because it recreates policies on generated fixed tables.
- Register `SeedBuiltinMetahubTemplates1800000000250` in `post_schema_generation` because it writes to `metahubs.cat_templates` after fixed schema generation.
- When adding future platform migrations, classify them by the earliest bootstrap phase in which all referenced schemas/tables definitely exist.
**Why**: Focused tests can miss fresh-start ordering bugs. The live bootstrap contract is `prelude -> fixed schema generation -> post-schema migrations`; violating that boundary produces startup failures even when individual migrations are otherwise correct.
## Cross-System-App Dependency Ordering Pattern (CRITICAL)
**Rule**: A fixed system-app migration that references helper functions, policies, or other bootstrap artifacts owned by another system app must use a version that sorts after the provider app's migration that creates those dependencies.
**Required**:
- Treat global platform migration sorting (`version` then `id`) as the real execution contract across all registered system apps, not just within one package.
- Keep same-app schema enablement/index/seed work in the normal `post_schema_generation` finalize migration, but move cross-system-app policy creation into a later migration when it depends on another app's helper functions.
- Add an ordering regression in `@universo/migrations-platform` whenever a migration depends on artifacts from another fixed system app.
**Why**: Bootstrap phase alone is not enough to guarantee dependency safety. On a clean database, two `post_schema_generation` migrations from different system apps still execute in global sorted order, so cross-app references can fail unless the dependent migration is explicitly versioned after the provider.
## Publication Bootstrap Runtime Sync Sequencing (CRITICAL)
**Rule**: When publication routes create an application schema from a publication snapshot, runtime sync must execute inside the DDL generator's `afterMigrationRecorded(...)` hook, and synced schema state must be persisted in that same post-recording step.
**Required**:
- Call `runPublishedApplicationRuntimeSync(...)` from the publication route only after the initial schema migration record exists.
- Persist application schema sync state immediately after runtime sync via `persistApplicationSchemaSyncState(...)` using the same transaction context supplied to `afterMigrationRecorded(...)`.
- Keep compensation logic outside the metadata transaction and run it only when DDL/runtime sync fails after publication or linked-application metadata already exists.
**Avoid**:
- Running runtime sync before migration history is recorded.
- Persisting `SYNCED` application schema state before runtime sync finishes.
- Treating success-path proof as implied by failure-compensation tests alone.
**Why**: Publication-driven bootstrap must preserve a truthful migration history boundary. The runtime sync contract depends on the recorded migration id and snapshot, and premature state persistence would create false synced metadata after partial DDL success.
## Repeated-Startup Fast-Path Pattern For Fixed Metadata And Catalog Sync (CRITICAL)
**Rule**: `App.initDatabase()` may validate registered migrations and definitions on every startup, but it must skip heavy fixed metadata writes and definition-registry churn when the live state already matches the compiled target state.
**Required**:
- Fixed system-app metadata bootstrap must compare the live `_app_objects` / `_app_attributes` state against the compiled target fingerprint and only call `syncSystemMetadata(...)` when tables, rows, or payloads drift.
- Registered definition catalog sync must bulk-load registry active revisions and export rows, then skip `registerDefinition()` entirely when every artifact checksum and export target already matches.
- Both fast paths must preserve self-healing behavior by falling back to the canonical full sync path whenever fingerprint/checksum/export drift is detected.
**Why**: Idempotent startup is not enough for operational safety in this repository. Replaying hundreds of registry writes and metadata upserts on every clean boot makes startup slow and obscures real drift behind noisy repeated synchronization.
## Explicit RETURNING + Soft-Delete Compensation Pattern (IMPORTANT)
**Rule**: Touched SQL-first stores on platform catalog tables should return explicit column lists, and cleanup/rollback paths should prefer dual-flag soft delete over raw `DELETE` whenever the rows belong to normal soft-deletable platform metadata.
**Required**:
- Prefer `RETURNING id, ...` with the exact row contract expected by the store instead of `RETURNING *`.
- When compensating partially created platform metadata such as role assignments or provisional metahub catalog rows, update both `_upl_*` and `_app_*` delete fields through the shared soft-delete helpers instead of issuing a physical delete.
- If associated child metadata is created in the same flow, compensate it explicitly as well unless an existing hard database cascade is still part of the intended contract.
**Why**: Explicit `RETURNING` clauses prevent silent shape drift when schema support fields change, and soft-delete compensation preserves the repository-wide lifecycle/audit contract even on rollback paths.
## Statement Timeout Helper Pattern (CRITICAL)
**Rule**: PostgreSQL `SET LOCAL statement_timeout` must use the shared validated helper from `@universo/utils/database`, not a bound placeholder.
**Required**:
- Use `buildSetLocalStatementTimeoutSql(timeoutMs)` for `SET LOCAL statement_timeout`.
- Keep timeout values numeric and validated before SQL generation.
- Reuse the same helper in request-scoped RLS middleware and schema-ddl locking paths.
**Avoid**:
- `knex.raw('SET LOCAL statement_timeout TO ?', [...])`
- ad hoc SQL assembly for statement timeout changes
**Why**: PostgreSQL rejected placeholder-style `SET LOCAL` in the live RLS path, so the only safe canonical implementation in this repository is the shared helper that emits a validated literal.
## Codename Retry Policy Pattern (IMPORTANT)
**Rule**: All codename copy/auto-rename flows must use shared retry constants from `codenameStyleHelper.ts`.
**Required constants**:
- `CODENAME_RETRY_MAX_ATTEMPTS` (global retry cap)
- `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT` (for concurrent conflict retries where applicable)
**Generation rule**:
- `buildCodenameAttempt(base, attempt, 'kebab-case')` appends `-<attempt>` for attempts >= 2
- `buildCodenameAttempt(base, attempt, 'pascal-case')` appends `<attempt>` for attempts >= 2
- Candidate length is capped by style limits (kebab 100, pascal 80)
**Why**: Prevents domain drift (20 vs 1000 attempts), keeps copy behavior deterministic, and reduces collision-related regressions under concurrent writes.
## Database Pool Budget + Error Logging Pattern
**Rule**: Use one shared Knex pool through `@universo/database`; log pool state on errors and under pressure.
**Required**:
- Knex: attach pool error listener and log `used/free/pending` metrics.
- Default pool max comes from `DATABASE_POOL_MAX` and currently defaults to 15.
**Why**: Prevent pool exhaustion and provide actionable diagnostics during incidents.
## Headless Controller Hook + Adapter Pattern (IMPORTANT)
**Rule**: CRUD dashboard views must use the shared `useCrudDashboard(adapter)` hook from `apps-template-mui`. Each deployment context (standalone dev, production runtime) provides its own `CrudDataAdapter` implementation.
**Components**:
- `CrudDataAdapter` interface (`api/types.ts`): `fetchList`, `fetchRow`, `createRow`, `updateRow`, `deleteRow`, `queryKeyPrefix`.
- `useCrudDashboard()` hook (`hooks/useCrudDashboard.ts`): headless controller returning all state + handlers (pagination, CRUD dialogs, row actions menu, schema fingerprint, React Query queries/mutations, columns, fieldConfigs, localeText).
- `createStandaloneAdapter()` (`api/adapters.ts`): adapter wrapping raw `fetch()` calls for standalone dev mode.
- `createRuntimeAdapter()` (`applications-frontend/api/runtimeAdapter.ts`): adapter wrapping auth'd `apiClient` calls for production.
- `CrudDialogs` + `RowActionsMenu` (`components/`): shared UI consuming `CrudDashboardState`.
- `CellRendererOverrides` type: per-dataType custom rendering injected via `cellRenderers` option (e.g., inline BOOLEAN checkbox toggle).
**Why**: Eliminates ~80% code duplication between DashboardApp and ApplicationRuntime while preserving full customization via adapters and cell renderer overrides.
**Detection**: `rg "useCrudDashboard" packages`.
## Optimistic Create Confirmation + Dedupe Pattern (IMPORTANT)
**Rule**: Every optimistic create/invite/copy hook must call `confirmOptimisticCreate()` in `onSuccess` when the server returns a real entity ID.
**Required**:
- Create hooks seed `optimisticId` via `applyOptimisticCreate()`.
- Success handlers replace that ID with the real server ID.
- `confirmOptimisticCreate()` must also drop the stale optimistic placeholder if the real entity already entered cache via another refetch or mutation path.
**Where implemented**:
- Shared admin/template helper: `packages/universo-template-mui/base/src/hooks/optimisticCrud.ts`
- Published runtime helper: `packages/apps-template-mui/src/hooks/optimisticCrud.ts`
**Why**: Prevents duplicate rows/cards during the refetch window and guarantees pending markers are removed as soon as the server confirms the entity.
**Detection**: `rg "applyOptimisticCreate|confirmOptimisticCreate" packages`.
## Nested Optimistic Query Scope Pattern (IMPORTANT)
**Rule**: Nested Metahub CRUD screens must mutate the exact query scope they render, not a broader root entity list.
**Required**:
- Child TABLE attribute screens use child-specific hooks/query prefixes (`childAttributes`, child element caches, child enum caches) instead of reusing root attribute hooks.
- Page-level UI code must not dispatch an optimistic mutation and then immediately call manual list invalidation for the same screen.
- Nested screen regressions should assert the actual UI contract (`mutate(...)` + immediate dialog close), not only helper-level cache behavior.
- If a copy flow can be rendered from both a broad metahub list and a hub-scoped list, optimistic create/confirm must target every currently visible matching list family, not only the broad `all*` cache.
**Symptoms**:
- A nested dialog still waits for network completion even though shared optimistic helpers exist.
- Child TABLE rows flicker, disappear, or fail to update because the wrong query family was mutated.
- Page-level `invalidateQueries()` reintroduces refetch flicker right after an optimistic update.
**Fix**:
- Create a dedicated nested hook if the screen renders a different list/query shape than the root entity list.
- Keep invalidation in the mutation lifecycle (`onSettled` / shared invalidators), not as an unconditional page-level follow-up.
- For hub-scoped copy flows, collect the broad metahub query prefix plus any matching hub query prefixes from current cache state, then apply optimistic create/confirm across all of them.
**Why**: Query-scope mismatches were the main reason nested optimistic parity remained incomplete after the shared helper rollout looked green at the top level.
## RLS Request DB Session Reuse for Admin Guards (CRITICAL)
**Rule**: Reuse request-scoped DB session from `req.dbContext`.
**Required**: pass the neutral `DbSession` into guard helpers.
**Detection**: `rg "req\.dbContext" packages`.
**Symptoms**:
- Permission checks outside RLS context.
**Fix**: fallback to a neutral executor or session derived from `@universo/database` only if the request DB session is missing.
---
## i18n Architecture (CRITICAL)
**Rule**: Core namespaces live in `@universo/i18n`; feature packages register namespaces before render and must not call `i18next.use()` locally.
**Detection**: `rg "i18next\.use" packages`
## Canonical Types Pattern (CRITICAL)
**Rule**: Shared list, filter, and pagination types live in `@universo/types`; downstream packages re-export or consume them instead of redefining local variants.
**Detection**: `rg "PaginationMeta|FilterType" packages/*/src/types`
## Universal List Pattern (CRITICAL)
**Rule**: Large entity lists use `usePaginated`, `useDebouncedSearch`, shared card/table toggle components, and persistent view state through the template-mui list stack.
**Detection**: `rg "usePaginated" packages`
## Page Spacing Contract (IMPORTANT)
**Rule**: Non-list pages must use `PAGE_CONTENT_GUTTER_MX` and `PAGE_TAB_BAR_SX` from `@universo/template-mui`; avoid local tab/content `px` overrides that make headers and content widths drift.
**Detection**: `rg "px: 2.*Tabs\|borderBottom.*px" packages/*/base/src`
## React StrictMode Pattern (CRITICAL)
**Rule**: Enable `React.StrictMode` only in development builds; production entrypoints must render without the double-render wrapper.
## Rate Limiting Pattern (CRITICAL)
**Rule**: Public API routers use the shared Redis-backed rate limiting contract and its env-driven thresholds rather than package-local limiter variants.
**Detection**: `rg "rateLimit" packages/*/src`
## Testing Environment Pattern (CRITICAL)
**Rule**: Use Vitest + Testing Library for package tests and Playwright for E2E; do not introduce new Jest-based package test stacks.
**Detection**: `rg "jest" packages/*/package.json`
## Runtime Migration Pattern (CRITICAL)
**Rule**: All schema changes must be recorded in `_sys_migrations` table within Application schema.
**Required**: Use `MigrationManager.recordMigration()` after applying DDL changes via `SchemaMigrator`.
**Migration Format**: `YYYYMMDD_HHMMSS_<description>` (e.g., `20260117_143000_add_products_table`).
**Components**:
- `MigrationManager`: CRUD for migrations, rollback analysis.
- `SchemaMigrator.applyAllChanges({ recordMigration: true, description })`: records migration with snapshot.
**Rollback Policy**: Block rollback if path contains destructive changes (DROP_TABLE, DROP_COLUMN, destructive ALTER_COLUMN).
**Detection**: `rg "recordMigration" packages`.
**Symptoms**:
- Schema changes not tracked.
- Rollback fails silently.
**Fix**: Always pass `recordMigration: true` when applying schema changes that should be reversible.
## TanStack Query Cache Correctness + v5 Patterns (CRITICAL)
**Rule**: Query key factories must be used for invalidation.
**Required**: `lists()` and `detail(id)` keys; invalidate aggregates explicitly.
**Detection**: `rg "invalidateQueries\(" packages`.
**Fix**: call `invalidateQueries(metaversesQueryKeys.lists())` after mutations.
## Metahub Template + Definition Model
**Metahub template/versioning**: Structure versions own system-table DDL in `structureVersions.ts`, while semver template versions own JSON/TS seed manifests under `templates/data/`. Seeds reference entities by codenames, generate UUIDs at apply time, stay idempotent through manifest hashing, keep template entities platform-level (`_upl_*` only), and load from `metahubs.templates` / `metahubs.templates_versions` with DB manifest override support.
**Application-definition model**: Metahubs are one specialization of the generic definition system. `DefinitionArtifact` payloads are stored through `upl_migrations.definition_registry`, immutable `definition_revisions`, optional lifecycle drafts, and export provenance rows in `definition_exports`. `registerDefinition(...)` stays idempotent, `exportDefinitions()` / `importDefinitions()` preserve round-trip storage, template `definition_type` differentiates `metahub_template`, `application_template`, or `custom`, and dependency direction remains `@universo/migrations-catalog` -> `@universo/migrations-core` only.
## Unified Database Access Standard (CRITICAL)
**Rule**: All backend database access must go through one of three permitted tiers. No direct Knex or KnexClient references in domain code.
**Tiers**:
- **Tier 1 — RLS (request-scoped)**: `getRequestDbExecutor(req, getDbExecutor())` / `getRequestDbSession(req, getDbExecutor())`. Used by authenticated route handlers; carries JWT claims for RLS policies.
- **Tier 2 — Admin/Bootstrap (non-RLS)**: `getPoolExecutor()` from `@universo/database`. Used by admin routes, startup provisioning, and background jobs that run outside user context.
- **Tier 3 — DDL/Migration**: `getKnex()` from `@universo/database`. Used only by `schema-ddl` services, migration runners, and explicit package-local DDL boundaries.
**Core Contracts**:
- `DbExecutor` — `query<T>(sql, params): Promise<T[]>`, `transaction<T>(cb): Promise<T>`, `isReleased(): boolean`
- `DbSession` — `query<T>(sql, params): Promise<T[]>`, `isReleased(): boolean`
- `SqlQueryable` — minimal `query<T>(sql, params): Promise<T[]>` for persistence stores
- Bridge: `createKnexExecutor(knex)` wraps a Knex instance as `DbExecutor` for Tier 3 → Tier 1 boundary crossings
**Allowed Tier 3 Boundaries**:
- `@universo/database` owns the shared Knex lifecycle and executor factories.
- `@universo/schema-ddl` plus migration packages own direct Knex DDL orchestration.
- `@universo/applications-backend` keeps raw Knex behind `src/ddl/index.ts` for runtime sync DDL work.
- `@universo/metahubs-backend` keeps raw Knex inside package DDL seams and schema-ddl integration paths.
- Route handlers and SQL-first stores outside these seams must not call `getKnex()` directly.
**Identifier Safety**:
- Use `qSchema()`, `qTable()`, `qColumn()`, `qSchemaTable()` from `@universo/database` for all dynamic identifiers.
- All helpers validate input and quote with double quotes; reject injection payloads.
- Bind parameters (`$1`, `$2`, ...) for all user-supplied values.
**Mutation Rules**:
- Mutating DML uses `RETURNING` when affected-row confirmation matters.
- Zero-row updates, deletes, restores, and sync-state writes fail closed instead of silently succeeding.
- Domain SQL stays schema-qualified; no domain path may rely on `search_path` for business-table resolution.
- Restore/delete flows constrain row state explicitly instead of mutating by bare `id` only.
**Enforcement**:
- `tools/lint-db-access.mjs` runs in CI (GitHub Actions) after ESLint, before build.
- Zero-violation policy: no baseline, no exceptions for domain packages.
- Excluded paths are narrow Tier 3 boundaries only: auth middleware, DDL subsystems, migration seeds, and package-local DDL boundary folders.
- `@universo/applications-backend` sync routes are not excluded from lint; raw Knex ownership for runtime sync now lives behind `src/ddl/index.ts`.
**Detection**: `node tools/lint-db-access.mjs` locally; CI step in `.github/workflows/main.yml`.
**Why**: Prevents SQL injection, enforces RLS correctness, keeps DDL transport isolated, and makes race-prone mutations observable through fail-closed contracts.
