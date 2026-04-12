# Technical Context

## 🔄 Custom Modifications to Preserve
### Authentication Architecture - **COMPLETED MIGRATION**
**Previous**: Multi-user Supabase JWT authentication
**Current**: Passport.js + Supabase hybrid authentication with session management
**Integration Point**: Bridge between Supabase JWT ↔ Passport.js successfully implemented
**Files Affected**: All middleware, controllers, UI authentication components migrated

### Access Control Evolution (Phase 2 - Request-Scoped DB Enforcement) - **COMPLETED**
**Current Model**: Application-level access control with request-scoped DB middleware.  
**Key Components**: WorkspaceAccessService (centralized membership validation), strict TypeScript role enum (`owner`, `admin`, `editor`, `member`), dedicated `uniks` schema with RLS policies, and the neutral `DbExecutor` / `DbSession` request contracts used across the SQL-first backend.

**Pattern**:
```typescript
const userId = await ensureUnikMembershipResponse(req, res, unikId, {
  roles: ['editor', 'admin', 'owner']
})
if (!userId) return
```

**Security Layers**: (1) request-scoped membership validation (primary), (2) RLS policies (fallback), (3) Request cache.  
**CRITICAL**: All Unik-scoped routes MUST use `ensureUnikMembershipResponse` or `requireUnikRole` middleware.

#### 2. Uniks (Workspace) System
-   **Purpose**: Multi-tenant workspace isolation.
-   **Implementation**: schema-isolated entities plus request-scoped DB access control through `WorkspaceAccessService`.
-   **Database schema**: `uniks.uniks` for workspace rows and `uniks.uniks_users` for membership/role links consumed by dependent modules.
-   **Role hierarchy**: `owner` (4) > `admin` (3) > `editor` (2) > `member` (1).
-   **Key rule**: create, invite, update, delete, and data-access flows remain membership-gated and must keep the current application-level enforcement model.

#### 3. Internationalization (i18n)

-   **Languages**: English (base) + Russian (full translation)
-   **Implementation**: Complete UI text extraction and translation; feature packages register their own namespaces via `registerNamespace`.
-   **Files**: `packages/universo-core-frontend/base/src/i18n/locales/en.json` & `ru.json`
-   **Gotcha**: Some feature packages consolidate and **flatten** nested translation bundles into a single namespace; component translation keys must match the registered shape (inspect the package `src/i18n/index.ts`). Also, when an app exports a consolidated namespace bundle, every new top-level block (e.g., `applications`, `actions`) must be included in the merge, or the UI will render raw i18n keys.

#### 3.1 Metahub Identifier Field
-   **Metahub table**: `metahubs.metahubs` uses `slug` (not `codename`) as the URL-friendly identifier.
-   **Implication**: Cross-schema joins must select `slug` and map it to frontend `codename` when needed.

#### 3.2 Metahub Hybrid Schema Architecture (Phase 7)
-   **Design-Time Data**: Stored in central `metahubs` schema (tables: `metahubs`, `catalogs`, `attributes`).
-   **Run-Time Data**: Stored in isolated `mhb_<UUID>` schemas unique to each Metahub.
-   **Synchronization**: Changes to Design-Time metadata (e.g., adding a catalog) trigger DDL operations in the corresponding `mhb_<UUID>` schema via `MetahubSchemaService`.
-   **Benefits**: Isolation of user data, scalability, and simplified access control for run-time records.

#### 3.2.2 Codename Validation & Retry Reliability
-   **Shared validation source**: Codename normalization/validation lives in `@universo/utils/validation/codename` and is consumed by frontend + backend.
-   **Shared retry policy**: Backend codename copy/rename flows use centralized constants in `domains/shared/codenameStyleHelper.ts` (`CODENAME_RETRY_MAX_ATTEMPTS`, `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT`).
-   **Style-safe retry generation**: `buildCodenameAttempt()` now preserves style correctness for retry suffixes (`-N` for kebab-case, `N` for pascal-case) while respecting max-length limits.
-   **Single-field storage contract**: shared types, fixed admin/metahubs schemas, and runtime application metadata now converge on one persisted `codename JSONB` field using the canonical VLC shape.
-   **Localized-editor toggle semantics**: `general.codenameLocalizedEnabled` still exists in admin/metahub settings and template-seed config, but it only trims non-primary locale variants inside the persisted VLC payload; it does not switch storage away from `codename JSONB`.
-   **Canonical machine identifier**: lookups, uniqueness, and ordering use the extracted primary locale content from the codename JSONB document instead of a second persisted string field.
-   **Locale sanitization rule**: codename normalization must sanitize every locale entry in the VLC payload under the active codename policy; backend hard uniqueness still remains primary-only.
-   **Fixed-schema rollout rule**: changing the admin/metahubs fixed-schema codename contract for live installations requires a new versioned platform migration file because edits to already-applied bootstrap definitions do not rerun on deployed databases.
-   **Runtime request seam**: applications runtime routes now normalize codename JSON to primary text before using codename as a request-body field key or presentation fallback, preventing JSONB codename from leaking into string-only route assumptions.
-   **Copy-flow seam**: backend copy flows must extract primary codename text for retry/uniqueness generation and then persist the final value through canonical VLC/store helpers; raw SQL string inserts and `String(jsonbValue)` coercion are invalid for copied codename payloads.
-   **Test coverage**:
  - `packages/universo-utils/base/src/validation/__tests__/codename.test.ts`
  - `packages/universo-utils/base/src/vlc/__tests__/getters.test.ts`
  - `packages/universo-utils/base/src/vlc/__tests__/index.test.ts`
  - `packages/metahubs-backend/base/src/tests/services/codenameStyleHelper.test.ts`
  - `packages/metahubs-backend/base/src/tests/shared/codenamePayload.test.ts`

#### 3.2.3 Platform System Attributes Governance
-   **Global policy source**: platform catalog system-attribute behavior is resolved from `admin.cfg_settings` under the `metahubs` category, not from per-metahub settings alone.
-   **Admin keys**: `platformSystemAttributesConfigurable`, `platformSystemAttributesRequired`, `platformSystemAttributesIgnoreMetahubSettings`.
-   **Backend seam**: `packages/metahubs-backend/base/src/domains/shared/platformSystemAttributesPolicy.ts` reads the admin policy, decides which `_upl_*` rows must be seeded, controls whether those rows should be exposed in catalog System responses, and blocks forbidden `_upl_*` toggle writes through `MetahubAttributesService.update(...)`.
-   **Template seam**: builtin template executor/migrator flows resolve the same policy through `readPlatformSystemAttributesPolicyWithKnex(...)` and pass it into `ensureCatalogSystemAttributesSeed(...)`; template repair must not own a second policy interpretation.
-   **Frontend seam**: metahubs UI does not call the admin settings API directly for this feature; instead it relies on `attributes` list response `meta` plus dedicated `/system` routes in `MainRoutesMUI.tsx` and the catalog views.
-   **Ordering behavior**: canonical system-row order is preserved by disabling optimistic `moveToFront` behavior for attribute enable/disable mutations.

#### 3.2.4 Metahubs & Applications Shared Abstractions (Refactoring 2026-03-29)
-   **Backend controller factories**: `createMetahubHandler(services)` injects shared MetahubServices into all domain controllers; `asyncHandler(fn)` wraps async Express handlers for error forwarding.
-   **Backend domain errors**: `MetahubDomainError` base class + typed subclasses (`NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`) with status codes and error codes.
-   **Backend pagination**: `paginateItems(items, page, limit)` + `validateListQuery(query)` provide reusable in-memory pagination and Zod-based query validation.
-   **Frontend error handling**: `createDomainErrorHandler({ errorCodeMap, fallbackKey, t, enqueueSnackbar })` eliminates per-mutation error switch/if chains with a declarative factory.
-   **Frontend mutation types**: each domain extracts mutation types to `mutationTypes.ts` and display converters to `displayConverters.ts`.
-   **Frontend hub caching**: `useMetahubHubs(metahubId)` shared hook centralizes hub list queries with 5-min stale time and automatic React Query deduplication, replacing 8 duplicate inline queries.
-   **Frontend VLC mapping**: `mapBaseVlcFields(entity, locale)` in `@universo/utils` extracts localized name/description/codename from VLC containers for display.
-   **Test coverage**: domainErrors, queryParams (paginateItems + validateListQuery), asyncHandler, createDomainErrorHandler, mapBaseVlcFields — all tested.

#### 3.2.5 Self-Hosted Fixture Contract And Regeneration
-   **Canonical source**: `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs` is the single source of truth for the committed self-hosted snapshot identity, localized copy, layout metadata, section metadata, and settings baseline.
-   **Regeneration path**: regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the contract/canonicalizer rather than hand-editing the committed JSON.
-   **Entity V2 fixture seam**: the canonical self-hosted fixture now exports all four published legacy-compatible V2 entity definitions (`custom.hub-v2`, `custom.catalog-v2`, `custom.set-v2`, `custom.enumeration-v2`) through the supported generator path; browser round-trip checks must keep verifying that expanded import surface instead of assuming the committed JSON is still current.
-   **Automation uplift seam**: the fixture contract now asserts the expected automation components for all four V2 presets, including the explicit Hub V2 and Enumeration V2 uplift that must not be lost by inheriting built-in component maps verbatim.
-   **Structure-version seam**: the committed self-hosted fixture contract intentionally pins exported `versionEnvelope.structureVersion` to `0.1.0`; change that artifact baseline only through the canonical contract/generator path, not by auto-resolving the value from backend dist.
-   **Current structure baseline seam**: public structure version `0.4.0` / numeric version `4` is now the active metahub branch baseline. Historical mappings for `0.1.0` / `0.2.0` / `0.3.0` remain preserved for upgrade planning, and fresh branches default to `CURRENT_STRUCTURE_VERSION_SEMVER` instead of a hardcoded legacy semver.
-   **Import-proof seam**: `snapshot-export-import.spec.ts` must re-export the imported metahub and validate `assertSelfHostedAppEnvelopeContract(...)` with an explicit poll timeout; imported `entityTypeDefinitions` metadata must not be validated only through count/layout checks.
-   **Catalog-layout proof seam**: the canonical self-hosted fixture now includes a dedicated Settings catalog layout override derived from `SELF_HOSTED_APP_SETTINGS_LAYOUT`, and downstream import/runtime verification should keep proving that the imported application visibly diverges from the default global layout for that catalog.
-   **Validation seam**: `assertSelfHostedAppEnvelopeContract(...)` must fail closed on stale self-model markers, mixed-language drift, missing `Settings`, or layout/menu-widget metadata drift.
-   **Consumer seam**: downstream E2E flows must not introduce legacy `self-model` markers when recording imported self-hosted fixtures.
-   **Migrations parity note**: self-hosted migrations parity is represented by real frontend navigation/pages/guards, not by synthetic migration entities in the fixture.

#### 3.2.5.1 ECAE Backend Service Foundation (2026-04-08)
-   **Service seam**: metahubs backend now has a dedicated `domains/entities/services` foundation with `EntityTypeService`, `ActionService`, `EventBindingService`, `EntityEventRouter`, and `EntityMutationService`.
-   **Ownership contract**: actions and event bindings are object-owned rows in `_mhb_actions` / `_mhb_event_bindings`; event bindings may reference only actions owned by the same object.
-   **Lifecycle contract**: generic entity `before*` hooks run on the active transaction runner, while `after*` hooks dispatch only after commit through the pool executor.
-   **Optimistic-lock typing seam**: shared conflict typing now includes `entity_type`, `action`, and `event_binding`, so downstream update flows can use the standard optimistic-lock helpers without lossy `record` placeholders.
-   **Test-fixture seam**: service/unit tests that touch schema-qualified entity tables must use canonical metahub schema names such as `mhb_<hex>_b1`; placeholder names like `mhb_test_schema` fail before business logic because identifier helpers validate schema format.

#### 3.2.5.2 ECAE Backend Route Surface (2026-04-08)
-   **Route seam**: metahubs backend now exposes entity-type, action, and event-binding routes through the standard domain router stack under `/metahub/:metahubId/...`.
-   **Route shape**: entity types use top-level metahub routes, while actions and event bindings are object-scoped lists plus singular record routes (`/object/:objectId/actions`, `/action/:actionId`, `/object/:objectId/event-bindings`, `/event-binding/:bindingId`).
-   **Controller seam**: the new controllers remain thin and instantiate the existing ECAE services directly, following the same `createMetahubHandlerFactory(...)` and domain-error pattern as other metahubs domains.
-   **Current limitation**: this checkpoint exposes only entity-type definitions plus object-owned actions/event bindings; generic entity-instance CRUD remains a later Phase 2.5 task.

#### 3.2.5.3 Shared Entity-Type Resolver DB Extension (2026-04-08)
-   **Resolution order**: the shared `EntityTypeResolver` now resolves built-ins from `BUILTIN_ENTITY_TYPE_REGISTRY` first and falls through to `EntityTypeService.resolveType(...)` only when a metahub context exists and the kind is not built-in.
-   **Caching seam**: repeated custom-kind lookups are cached per resolver instance and keyed by `metahubId + userId + kind`; failed lookups are not kept if the service call throws.
-   **Async contract**: resolver consumers must now treat `resolve(...)`, `resolveOrThrow(...)`, and `isComponentEnabled(...)` as async because custom DB-backed kinds require IO.

#### 3.2.5.4 Generic Custom Entity CRUD Backend (2026-04-08)
-   **Route seam**: metahubs backend now exposes custom-only generic entity instance routes under `/metahub/:metahubId/entities` plus singular `/entity/:entityId` copy/restore/permanent/reorder endpoints.
-   **Coexistence guard**: those generic routes resolve the routed kind through `EntityTypeResolver` and reject built-in kinds fail closed, so catalogs/sets/enumerations continue using their legacy routes until Phase 2.5b/2.5c compatibility work lands.
-   **Mutation seam**: `MetahubObjectsService` now accepts generic kind strings, an optional explicit create-time object id, and optional `SqlQueryable` runners for `findById(...)`, `findByCodenameAndKind(...)`, `updateObject(...)`, `delete(...)`, `restore(...)`, and `permanentDelete(...)`, which lets `EntityMutationService` own the transaction/lifecycle boundary for generic create/update/delete/copy/restore flows.
-   **Deleted-detail read seam**: the generic detail route remains active-row-only by default, but explicit `includeDeleted=true` requests now forward `{ includeDeleted: true }` into `MetahubObjectsService.findById(...)` so deleted-state and restore flows can inspect soft-deleted rows without widening the default read contract.
-   **Compatibility-aware delete seam**: low-level blocker queries for compatible Set V2 / Enumeration V2 kinds now accept resolved compatible target-kind arrays instead of exact built-in literals, and the generic delete/permanent-delete plan must keep passing those arrays into the shared blocker services before final delete continues.
-   **Lifecycle contract**: generic create/update/delete/copy now use the ECAE lifecycle dispatcher; generic create preallocates the object id and persists that same id so `beforeCreate`, the committed row, and `afterCreate` stay aligned, while restore intentionally suppresses hooks through `mode: 'restore'`.

#### 3.2.5.5 Design-Time Service Genericization And Policy Reuse (2026-04-08)
-   **Object-scoped attribute seam**: `MetahubAttributesService` now exposes object-scoped system-attribute aliases (`listObjectSystemAttributes`, `getObjectSystemFieldsSnapshot`, `ensureObjectSystemAttributes`) while keeping the legacy catalog wrappers as compatibility passthroughs.
-   **Shared copy seam**: `copyDesignTimeObjectChildren(...)` is the new transaction-aware helper for shared design-time child copy work across attributes, elements, constants, and enumeration values, with optional system-attribute reseeding for policy-sensitive catalog flows.
-   **Delete-blocker seam**: the shared constants/attributes blocker helpers used by legacy set/enumeration/constant delete paths are now compatibility-aware as well; they must receive the full compatible target-kind array and keep `ANY($n::text[])` SQL matching so custom V2 target kinds cannot bypass blocked-delete safety.
-   **Legacy reuse rule**: catalog, set, and enumeration copy controllers remain the public route owners but now delegate shared child-copy behavior to the helper instead of maintaining controller-local duplication.
-   **Generic copy rule**: generic custom-entity copy now resolves enabled design-time components from `EntityTypeResolver` and copies only the matching child surfaces; built-in kinds remain rejected on generic routes.
-   **Validation seam**: the Phase 2.5c closure is validated by focused metahubs-backend route/service tests, warning-only package lint, a clean package build, and the canonical root `pnpm build`.

#### 3.2.5.6 Reusable Entity Preset Template Registry (2026-04-09)
-   **Registry seam**: reusable entity presets now live in the existing metahub template registry as `definition_type='entity_type_preset'`, sharing `metahubs.cat_templates` and `metahubs.doc_template_versions` with builtin metahub templates instead of using a second preset store.
-   **DTO/API seam**: shared metahub template DTOs now expose `definitionType` on list responses and `activeVersionManifest` on detail responses so consumers can retrieve the active typed preset manifest directly.
-   **Seeder/validator seam**: builtin entity presets are validated by the shared template manifest validator, including component dependency checks, and are seeded through the unified builtin template definition registry plus checksum-based builtin-template migration.
-   **Preset-uplift seam**: Hub V2 and Enumeration V2 rely on explicit component overrides inside their builtin preset manifests to expose V2-only automation capabilities; direct manifest tests and fixture export checks are both required to keep that uplift from regressing.
-   **Frontend consumption seam**: `useTemplates(definitionType)`, `useTemplateDetail(...)`, `TemplateSelector`, and `EntityTypePresetSelector` now drive create-mode preset prefill in `EntitiesWorkspace` without changing edit-mode flows.

#### 3.2.5.7 Entity Authoring Browser Proof Closure (2026-04-09)
-   **Focused browser seam**: `tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts` is the Phase 2.9 browser proof for the shipped entity-type authoring surface, covering preset-backed create, backend-confirmed persistence, and EN/RU parity through `/metahub/:metahubId/entities`.
-   **Backend helper seam**: Playwright backend support now includes metahub entity-type list/detail helpers so the browser flow can confirm persistence through API state instead of DOM-only assertions.
-   **Visual seam**: `tools/testing/e2e/specs/visual/metahub-entities-dialog.visual.spec.ts` intentionally captures the dialog after the preset selector loses focus; the snapshot baseline represents the non-focused combobox state to avoid focus-ring-only visual diffs.
-   **UI visibility seam**: `EntitiesWorkspace` list mode now renders the primary name column explicitly with `row.name || row.kindKey`, which is the visible-name contract relied on by the focused browser flow after create.

#### 3.2.6 Metahub Scripting Runtime Contract (2026-04-05)
-   **Shared source of truth**: `@universo/types` owns script roles, source kinds, capability enums, role-based allowlists/defaults, and normalization helpers used by compiler, design-time validation, runtime persistence, and execution-context gating.
-   **SDK surface layout**: `@universo/extension-sdk` now keeps a stable root authoring import while physically splitting the source-only SDK into `types`, `decorators`, `ExtensionScript`, `registry`, `widget`, and `apis/*` modules.
-   **Explicit dual-target rule**: shared script methods use the explicit `server_and_client` target via `@AtServerAndClient()`; undecorated helpers stay private, lifecycle handlers remain server-only, and runtime client/public-RPC filtering must use the shared target helpers instead of direct `'client'` / `'server'` equality checks.
-   **Authoring scope**: v1 authoring is limited to `embedded` sources. Future `external` and `visual` seams remain explicit but are not enabled in the design-time UI or backend validation path.
-   **Common scripts authoring seam**: `@universo/metahubs-frontend` now reuses `EntityScriptsTab` directly for the Common page via `attachedToKind='general'` and `attachedToId=null`; this mode is editable without saving a concrete entity id and is locked to the `library` module role.
-   **Fail-closed scope seam**: `MetahubScriptsService` is the server-side source of truth for Common/shared-library scope compatibility: `general` requires `library`, new `library` authoring outside Common/general is rejected, and unchanged legacy out-of-scope rows are preserved only for no-scope-transition maintenance updates.
-   **Compiler boundary**: embedded script compilation is SDK-only. `@universo/scripting-engine` now rejects unsupported static imports plus `require()`, dynamic `import()`, and `import.meta` before bundling, leaving `@universo/extension-sdk` as the only supported authoring import surface.
-   **Publication ordering seam**: `MetahubScriptsService.listPublishedScripts()` now preloads active shared-library sources once, validates `general/library` rows in topological `@shared/*` dependency order, recompiles only consumer scripts that import shared libraries, and keeps library rows out of runtime `snapshot.scripts`.
-   **SDK compatibility boundary**: `sdkApiVersion` is enforced as a real shared contract rather than informational metadata. The current supported set is explicitly `1.0.0`, and unsupported or mismatched record/manifest metadata now fails during compilation, metahub authoring, publication/runtime normalization, and runtime script loading.
-   **Benchmark seam**: reproducible benchmark evidence now lives in `@universo/scripting-engine`; the latest recorded proof is `coldStartMs 7.13`, `meanMs 1.596`, `p95Ms 2.127`.
-   **Payload contract**: runtime script list payloads must not expose executable bundle bodies. Applications backend serves client bundles through a dedicated cacheable endpoint, while `serverBundle` remains backend-only.
-   **Public RPC boundary**: public runtime `/runtime/scripts/:scriptId/call` access is restricted to non-lifecycle server methods from scripts that declare `rpc.client`; the applications-backend service/controller seam enforces this before any runtime engine execution begins.
-   **Browser runtime**: real browser execution requires a Worker-capable runtime and fails closed without it; the worker runtime now uses private host aliases, disables ambient network, nested-worker, storage, and dynamic-code globals before importing the client bundle, and enforces a bounded execution timeout so hanging bundles are terminated instead of pending forever.
-   **Server runtime**: `@universo/scripting-engine` executes server bundles through pooled `isolated-vm` isolates with health monitoring / circuit-breaker behavior instead of per-call isolate churn.
-   **Startup compatibility seam**: core-backend startup validates `isolated-vm` availability and the required `--no-node-snapshot` re-exec contract before serving, and startup regressions must keep that path green.
-   **Runtime sync seam**: publication/runtime script persistence must fail closed when `_app_scripts` bootstrap fails or the table remains unavailable after bootstrap; script sync is not allowed to silently degrade into metadata-only success, and scoped codename-index repair must validate the full `(attached_to_kind, COALESCE(attached_to_id, null-scope uuid), module_role, codename)` plus soft-delete predicate shape before treating an existing index as compatible.
-   **Vitest coverage contract**: the touched runtime/frontend packages now enable coverage by default, allow explicit opt-out only through `VITEST_COVERAGE=false`, and reserve threshold enforcement for the explicit shared opt-in seam (`VITEST_ENFORCE_COVERAGE=true`) rather than ambient CI detection.
-   **Legacy snapshot seam**: publication/runtime normalization treats missing legacy `snapshot.scripts` as an empty scripts set and keeps direct regression coverage for that compatibility path.
-   **Authoring role-switch seam**: untouched draft module-role switches must reapply target-role default capabilities so widget drafts keep default `rpc.client` unless the user already edited capabilities.
-   **Layout authoring seam**: `quizWidget` layout details authoring exposes `scriptCodename`, and the browser-authored Playwright flow depends on that real UI seam end to end.
-   **Testing seam**: backend Jest must map `@universo/types` and `@universo/scripting-engine` to workspace source when validating the scripting surface, but downstream focused validation can still consume built exports; after changing exported helpers in `@universo/types`, rebuild that package before downstream test/build runs.
-   **Bootstrap validity seam**: server isolate runtime tests now parse the generated bootstrap source itself, which protects the runtime against strict-mode-invalid global-blocking code such as `const eval = undefined`.

#### 3.2.7 Quiz Snapshot Fixture And Script Round-Trip Contract (2026-04-05)
-   **Canonical source**: `tools/testing/e2e/support/quizFixtureContract.ts` is the single source of truth for the committed quiz snapshot identity, bilingual quiz content, canonical widget script source, and fixture assertions.
-   **Committed artifact**: `tools/fixtures/metahubs-quiz-app-snapshot.json` is generated from the dedicated Playwright generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts`; it should be regenerated through that path instead of hand-editing the JSON.
-   **Consumer proof**: `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts` is the durable import proof. It validates browser-UI import, restored design-time metahub scripts, application creation from the imported publication, and the full EN/RU quiz runtime contract.
-   **Snapshot round-trip seam**: metahub export now augments `snapshot.scripts` with `sourceCode`, and `SnapshotRestoreService` restores `_mhb_scripts` with attachment remapping so imported metahubs remain republishable and not only publication-runnable.
-   **Product contract**: the canonical quiz fixture keeps 10 questions per locale, 4 answers per question, sequential question/answer cards, `+1` only for correct answers, no score increment for wrong answers, a final total-score summary, and restart/back navigation.

#### 3.2.8 Metahub Dialog Presentation And Responsive Scripts Tab Contract (2026-04-05)
-   **Settings source of truth**: metahub-wide dialog behavior is registry-driven through `@universo/types` common settings keys `common.dialogSizePreset`, `common.dialogAllowFullscreen`, `common.dialogAllowResize`, and `common.dialogCloseBehavior`.
-   **Shared runtime seam**: `@universo/template-mui` owns the reusable `DialogPresentationProvider` / `useDialogPresentation(...)` contract, including preset width handling, fullscreen toggle, resize persistence, reset-to-default control, and strict-modal backdrop/Escape blocking.
-   **Metahub bridge**: `@universo/metahubs-frontend` injects settings into that shared seam through `MetahubDialogSettingsProvider` and wraps page exports with `withMetahubDialogSettings(...)`; direct MUI dialogs that bypass shared template dialogs must still use the same presentation contract explicitly.
-   **Persistence rule**: dialog resize state is stored in localStorage and scoped by metahub id so one metahub does not overwrite another metahub's authoring dialog size.
-   **Responsive Scripts-tab rule**: `EntityScriptsTab` uses `ResizeObserver` on the rendered container, not viewport breakpoints, to switch between compact and split layouts; on narrow dialogs it collapses the attached-scripts list and keeps horizontal overflow isolated to the editor shell only.
-   **JSDOM validation note**: scripting/dialog tests that open MUI `Select` / `Popover` surfaces may need a non-zero `HTMLElement.prototype.getBoundingClientRect` mock while keeping the stable `user.click(...)` interaction path; otherwise jsdom-only `anchorEl` warnings can appear even when the product behavior is correct.
-   **Validation seam**: this contract is considered closed only when focused unit tests plus targeted real-browser Playwright flows prove the dialog controls, settings persistence, compact layout behavior, and absence of page-level horizontal overflow.

#### 3.2.9 Metahub Common Section And Catalog Layout Overlay Contract (2026-04-06)
-   **Navigation seam**: the layouts authoring entrypoint now lives under `/metahub/:metahubId/common`, while legacy `/metahub/:metahubId/general` and `/metahub/:metahubId/layouts` URLs redirect into the Common page. Catalog-specific layout detail routes use `/metahub/:metahubId/catalog/:catalogId/layout/:layoutId`.
-   **Single-shell frontend composition**: `GeneralPage` remains the component owner of the only `TemplateMainCard` / `ViewHeader` / tab shell for the Common section; `LayoutList.tsx` exports `LayoutListContent` for shell-less embedded reuse with `renderPageShell={false}`, while the default `LayoutList` wrapper preserves standalone route behavior for redirected legacy paths and any direct standalone consumers.
-   **Design-time storage**: `_mhb_layouts` now scopes catalog layouts through `catalog_id` and links them to a global source through `base_layout_id`; catalog-owned widgets remain in `_mhb_widgets`, and sparse inherited-widget deltas live in `_mhb_catalog_widget_overrides`.
-   **Behavior-config seam**: the selected layout stores `showCreateButton`, `searchMode`, and `createSurface` / `editSurface` / `copySurface` as a nested `catalogBehavior` block inside layout `config`, reusing the existing catalog runtime setting shape. The global layout is the default catalog baseline until a catalog-specific layout exists; catalog object `runtimeConfig` is no longer the canonical behavior source for this flow.
-   **Catalog CRUD/API seam**: metahubs frontend catalog payloads/types and metahubs backend catalog create/update/copy/get flows no longer expose `runtimeConfig`; legacy persisted `config.runtimeConfig` is explicitly stripped during update/copy so behavior ownership stays fully in layout `catalogBehavior`.
-   **Inherited-widget contract**: catalog layout widget payloads expose `isInherited`; inherited config stays read-only, and inherited drag/toggle/exclude behavior is gated by base-widget `config.sharedBehavior` (`positionLocked`, `canDeactivate`, `canExclude`). Global layout widget editing now exposes those three behavior toggles for menu/columns/quiz widgets plus a generic behavior-only dialog for widgets without dedicated config editors.
-   **Sparse config/materialization seam**: design-time catalog layouts strip dashboard widget-visibility booleans from stored config so catalog layouts remain sparse overlays rather than copied full-config forks. Publication/runtime materialization reconstructs those booleans from effective widget placement when flattening rows into `_app_layouts`.
-   **Snapshot export seam**: `attachLayoutsToSnapshot()` now serializes the full design-time global/catalog layout set and filters override rows to exported catalog layouts, while `defaultLayoutId` still resolves from the active/default global baseline for runtime consumers.
-   **Embedded authoring seam**: the catalog dialog Layout tab now renders a pure embedded layout manager with no legacy fallback form, no standalone page-shell gutters, and shared adaptive-search toolbar behavior from `ViewHeader`.
-   **Publication/runtime seam**: snapshot export and application sync flatten merged catalog layouts into ordinary `catalog_id`-scoped `_app_layouts` and `_app_widgets` rows. Inherited override config is not materialized at runtime; inherited widgets always use base widget config.
-   **Frontend cache seam**: because the shared QueryClient keeps layout data fresh for 5 minutes, global layout config/widget mutations must invalidate the whole layouts root so cached inherited catalog layout views do not stay stale inside one SPA session.

#### 3.2.10 Shared Snapshot V2 Runtime Materialization Contract (2026-04-07)
-   **Snapshot export surface**: metahub/publication snapshot export now emits `sharedAttributes`, `sharedConstants`, `sharedEnumerationValues`, and `sharedEntityOverrides` in addition to the existing local entity sections; serializer call sites must pass `SharedContainerService` and `SharedEntityOverridesService` or the shared sections will be omitted.
-   **Snapshot format version**: the shared-entity export/import seam now uses `versionEnvelope.snapshotFormatVersion = 2`. Backward compatibility is preserved by treating the shared sections as optional during import/materialization, so older v1 snapshots without those sections still restore correctly.
-   **Runtime flattening seam**: publication runtime loading and publication-controller DDL/runtime sync must call `SnapshotSerializer.materializeSharedEntitiesForRuntime(...)` before `deserializeSnapshot(...)` and `enrichDefinitionsWithSetConstants(...)`. The raw publication snapshot remains stored separately for integrity/history, but runtime/schema consumers must use the materialized view.
-   **Application sync hash seam**: applications-backend sync/release-bundle flows that consume the materialized runtime snapshot must hash that materialized snapshot rather than reuse the stored raw publication snapshot hash, because shared flattening changes the executable snapshot shape.
-   **Applications runtime id-scoping seam**: applications-backend now normalizes the materialized publication runtime source before diff/sync, scoping repeated shared field ids per target entity, scoping repeated shared enumeration value ids per target enumeration object, and rewriting predefined element REF->enumeration ids to the scoped runtime ids when duplicates exist across targets.
-   **Executable payload seam**: applications-backend snapshot entity contracts may carry optional `tableName`; runtime/release-bundle normalization must map that field into executable `physicalTableName`, and compatibility-aware hub/set/enumeration handling must use merged `compatibility.legacyObjectKind` metadata instead of exact built-in kind checks.
-   **Import seam**: `SnapshotRestoreService.restoreFromSnapshot(...)` now recreates the three virtual shared containers (`shared-catalog-pool`, `shared-set-pool`, `shared-enumeration-pool`), restores shared attrs/constants/values into those containers, and remaps `_mhb_shared_entity_overrides` to the restored target/shared entity ids.
-   **Hash seam**: canonical publication snapshot hash normalization now includes all four shared sections, so checksum/envelope validation changes when shared export content drifts.
-   **Validation seam**: after changing exported snapshot-format helpers in `@universo/types`, rebuild that package before downstream focused backend builds because `@universo/metahubs-backend` may resolve the built type declarations during package-local compilation.

#### 3.2.11 Request-Scoped Shared Override Transaction Contract (2026-04-07)
-   **Explicit runner seam**: `SharedEntityOverridesService.upsertOverride(...)` now accepts an explicit `db` runner so request-scoped Common/shared override routes can reuse the current request executor and parent mutation flows can reuse their active `tx`.
-   **RLS safety rule**: request-scoped metahub routes must pass the request executor through that seam instead of reopening nested savepoints for override upserts, and parent merged-order flows must pass their active transaction runner for the same reason.
-   **Regression seam**: focused service coverage now proves the explicit-runner path does not call `exec.transaction()` again.
-   **Closure proof**: the final Chromium `metahub-shared-common.spec.ts` flow is green after this runner reuse plus the runtime hash alignment, confirming the shipped Common/shared override/browser contract end to end.

#### 3.2.12 Shared Exclusion Save Cycle And Container Ensure Contract (2026-04-07)
-   **Dialog-state seam**: `SharedEntitySettingsFields` now keeps exclusion toggles in local form state under `_sharedExcludedTargetIds` instead of writing override rows immediately. Shared attribute/constant/value save handlers sync only the changed `isExcluded` states after a successful entity save.
-   **Locking seam**: when `sharedBehavior.canExclude` is turned off inside the same dialog, the UI trims newly added exclusions back to the currently persisted excluded set so the follow-up sync cannot add locked exclusions after the behavior flag is saved.
-   **Legacy scripting seam**: backend script updates now preserve legacy stored `global` rows when the current UI resubmits the unchanged metahub-scoped role as normalized `library`.
-   **Shared container authoring seam**: `GET /shared-containers` is now read-only and returns only existing virtual pool ids; Common/shared authoring explicitly ensures missing pool ids through `POST /shared-containers/ensure` before embedding shared entity CRUD surfaces.

#### 3.2.13 Routed Attribute Move Ownership Contract (2026-04-08)
-   **Controller seam**: `PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/move` must load the attribute first and return `404` unless `attribute.catalogId === catalogId` before delegating to `moveAttribute(...)`.
-   **Service seam**: `MetahubAttributesService.moveAttribute(...)` must query the current and refreshed rows with `id + object_id + ACTIVE` filters, not by bare `id`, so direct callers cannot reorder foreign-catalog or shared-pool rows through a mismatched routed object id.
-   **Consistency rule**: attribute move must preserve the same routed-object ownership expectations already enforced by update, delete, and reorder.
-   **Regression seam**: focused route coverage must include foreign-catalog ids and shared-pool ids for the move endpoint so merged/shared list work cannot silently reopen the vulnerability.

#### 3.2.14 Package-Scoped Formatting And Lint Verification Nuance (2026-04-08)
-   **Prettier cwd seam**: `pnpm --filter <package> exec prettier` runs from the package root, so workspace-root-relative file paths fail with `No files matching the pattern were found`. For explicit workspace-root-relative file lists, run `pnpm exec prettier --write ...` from the repository root instead.
-   **Lint verification seam**: the metahubs backend/frontend package lint commands fail only on error-level findings; warning-only output still exits `0`. Post-QA closure for this repository therefore has to distinguish release-blocking lint errors from the broader warning backlog when validating a narrow remediation surface.

#### 3.2.15 Core Frontend Build Heap Guard (2026-04-09)
-   **Build script seam**: `@universo/core-frontend` now builds through `NODE_OPTIONS='--max-old-space-size=8192' vite build`.
-   **Why it exists**: isolated `@universo/core-frontend` builds can pass without extra heap, but the canonical root `pnpm build` under Turbo can still hit V8 heap exhaustion during the core-frontend bundle when multiple workspace builds have already consumed memory.
-   **Validation rule**: after touching heavy frontend packages, the canonical root `pnpm build` remains mandatory; do not treat an isolated core-frontend build as a sufficient substitute for the workspace-wide Turbo path.

#### 3.2.16 TypeScript 6 Transitional Tsconfig Guard (2026-04-10)
-   **Touched-package rule**: packages that still rely on `baseUrl` for current import resolution may keep a local `ignoreDeprecations: "5.0"` guard during the current editor-side TypeScript 6 transition instead of widening the migration across untouched packages.
-   **RootDir rule**: touched package `tsconfig` files that emit build artifacts should declare an explicit `rootDir` so TS6 project-service diagnostics do not fail on `outDir` resolution.
-   **Compiler reality**: the workspace catalog currently pins `typescript: ^5.8.3`, so `ignoreDeprecations: "6.0"` is invalid for real builds even if the editor surfaces TS6-style deprecation diagnostics.
-   **Scope rule**: keep this as a minimal touched-package closeout seam, not a blanket monorepo-wide config rewrite, until a dedicated repo-wide alias migration is scheduled.

#### 3.3 Runtime DDL Utilities (schema-ddl)
-   **Package**: `@universo/schema-ddl` provides shared runtime DDL logic (schema generation, migrations, snapshots).
-   **Pattern**: DI-only (`createDDLServices(knex)`), no static wrapper methods; naming utilities are imported directly.
-   **Optional global catalog flag**: `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` now controls whether runtime/platform flows use the full catalog lifecycle or only local canonical history plus the minimal platform kernel.
-   **Managed schema naming**: canonical managed schema name generation/validation now comes from `@universo/migrations-core` (`buildManagedDynamicSchemaName`, `isManagedDynamicSchemaName`) and is reused by schema-ddl plus touched metahub/publication runtime paths.
-   **Managed owner validation**: managed schema owner ids must now be canonical UUID or 32-character lowercase hex only; malformed values are rejected instead of being normalized by stripping characters.
-   **Kernel-only platform history**: disabled catalog mode uses `PlatformMigrationKernelCatalog` so `upl_migrations.migration_runs` remains available for platform prelude/post-schema history without bootstrapping the definition registry stack.
-   **Runtime mirror contract**: `mirrorToGlobalCatalog(...)` can now return `null` when the flag is disabled; runtime metadata builders must tolerate missing `globalRunId` in that mode.
-   **Fixed baseline recording**: `SchemaGenerator.generateFullSchema(...)` now accepts an explicit `migrationName`, which `systemAppSchemaCompiler` uses to record deterministic fixed-system baseline rows and backfill missing `_app_migrations` baselines on repeated startup.
-   **Safety**: `knex.raw` calls should use parameterized queries by default, but PostgreSQL `SET LOCAL statement_timeout` is the explicit exception here and must go through `buildSetLocalStatementTimeoutSql()` from `@universo/utils/database`.
-   **Runtime sync ownership seam**: `@universo/applications-backend` owns application runtime sync/diff routes and the adapter that builds application sync context; `@universo/metahubs-backend` exposes only `loadPublishedPublicationRuntimeSource(...)`, and `@universo/core-backend` injects that source into the applications-owned adapter.
-   **Applications fixed-schema bootstrap**: the active applications system-app manifest now bootstraps only the canonical `CreateApplicationsSchema1800000000000` migration; fresh databases do not rely on a legacy table-rename reconciliation step.
-   **Configurable platform runtime columns**: runtime business tables now derive configurable `_upl_archived*` / `_upl_deleted*` presence from `config.systemFields.fields` via shared `@universo/utils` helpers; runtime CRUD/sync SQL must consume the same helper instead of assuming `_upl_deleted` always exists.
-   **Central install metadata seam**: application release/install state now extends `applications.cat_applications` with `installed_release_metadata` instead of introducing a parallel release metadata store.
-   **Application release bundle API**: `@universo/applications-backend` now exposes publication-backed release-bundle export and bundle-apply routes that reuse the existing schema sync engine and persist release state through the same central sync-state contract.
-   **Canonical bundle snapshot hash**: `application_release_bundle` now recomputes a canonical embedded snapshot hash per `sourceKind` (`publication` normalized snapshot contract, `application` runtime checksum contract) and rejects any bundle whose manifest hash does not match the embedded snapshot state. The shared publication-side normalizer now explicitly covers `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, so release lineage stays aligned with the current export surface.
-   **Manifest validation parity**: fixed-system-app string validation rules must stay within the backing `VARCHAR(N)` contract; shared migrations-platform regressions now enforce that rule across registered definitions.
-   **Architecture docs location**: the converged fixed-system-app model is now documented in `docs/en/architecture/system-app-convergence.md` and `docs/ru/architecture/system-app-convergence.md` in addition to memory-bank planning files.
-   **Repeated-start optimization**: `@universo/migrations-platform` now avoids replaying unchanged fixed metadata synchronization and unchanged catalog registry sync on clean startup by using a live metadata fingerprint check plus a bulk registry/export preflight that also requires published lifecycle provenance on the active revision.
-   **Doctor export health**: `@universo/migrations-platform` doctor checks now treat any export row on the active published revision as healthy; explicit export-target matching remains an operational sync/export concern, not a doctor constraint.
-   **Bundle export lifecycle parity**: bundle-style catalog exports now also persist definition export rows for the active published revisions they contain.
-   **Bootstrap phase discipline**: platform migrations that depend on generated fixed tables now live in `post_schema_generation`; the latest verified examples are `OptimizeRlsPolicies1800000000200` and metahubs builtin-template seeding.
-   **Definition lifecycle execution**: `@universo/migrations-catalog` now routes active `importDefinitions()` calls through draft/review/publish helpers and keeps lifecycle provenance merged on unchanged revisions, so file/bundle imports and platform sync share the same approval-oriented lifecycle contract.
-   **Definition drift detection**: platform/catalog no-op detection now compares stable artifact payload signatures, not only SQL checksum parity, so dependency-only changes re-run the canonical import/export path.

#### 4. UPDL And Template Export Surface

-   **Location**: `packages/`.
-   **Purpose**: UPDL nodes and template-driven export remain the high-level authoring layer for AR.js, PlayCanvas, and related generated experiences.
-   **Constraint**: keep this surface isolated from core shell/auth/runtime changes; it is durable product scope, not the current platform-foundation seam.

## Platform Foundation
**Legacy upstream shell 2.2.8** - Enhanced platform with ASSISTANT support (upgraded 2025-07-01)
**Supabase Integration** - Multi-user functionality with Postgres-only database support

### Database Pooling (Supabase Tier-Scalable)
**Target**: Supabase Nano tier by default (Pool Size 15, PG max_connections 60).

**Pool model** (as of 2026-03-10):
- Single shared Knex pool owned by `@universo/database`
- Default pool max = `DATABASE_POOL_MAX` or 15
- Pool-level execution uses `createKnexExecutor(getKnex())`
- Request-scoped RLS execution uses pinned connections wrapped by `createRlsExecutor(...)`

**Tier-scaling guide**:
| Tier    | Pool Size | Default Knex Max | Headroom |
|---------|-----------|------------------|----------|
| Nano    | 15        | 15               | 0-5      |
| Micro   | 15        | 15               | 0-5      |
| Small   | 15        | 15               | 0-5      |
| Medium  | 50        | tune via env     | 35+      |
| Large+  | 100       | tune via env     | 85+      |

**Env overrides**: `DATABASE_POOL_MAX`, `DATABASE_KNEX_POOL_DEBUG`.

**Tracked env policy**: committed `.env` files in the repository must stay placeholder-only; live Supabase, session, encryption, and object-storage secrets belong outside version control.

**Advisory lock safety**: Schema DDL uses `pg_try_advisory_lock` (session-level) which pins a raw TCP connection. Knex pool must always have ≥4 connections to avoid starvation when 2 advisory locks are held and `inspectSchemaState` / widget resolution queries run.

**Pooler mode detection**:
- Port 6543 = Supavisor transaction mode (shorter timeouts, prepared statement warnings)
- Port 5432 = Direct connection or session mode
- KnexClient emits a warning and switches to shorter pool timeouts when port 6543 is detected

**Observability**:
- Pool status logged every 10s when utilization >70% or waiting connections exist
- Pool error logs include `used/idle/waiting` metrics
- Knex logs `acquireRequest/acquireSuccess/acquireFail/release` events under pressure

**Rate limiting** (increased 2026-02-03):
- Read: 600 requests / 15 minutes (was 100, then 300)
- Write: 240 requests / 15 minutes (was 60, then 120)
- Per-IP by default; consider Redis + user-based keys for multi-user NAT scenarios

### Authentication Architecture
**Current**: Passport.js session auth (Express) integrated with Supabase identity; clients use cookie/session + CSRF protection.

- **CSRF contract**: `EBADCSRFTOKEN` → HTTP 419; `auth-frontend` clears cached CSRF state, fetches a fresh token, and retries one protected request once before surfacing the error.
- **Public routes**: centralized allowlists in `@universo/utils/routes` (`PUBLIC_UI_ROUTES`, `API_WHITELIST_URLS`).
- **Admin SQL helper boundary**: request-scoped authenticated sessions may call admin helper functions only for their own `auth.uid()`; cross-user permission/role introspection is reserved for pool/service-role style backend execution where no request JWT user is present.

**RLS request context (Knex + Postgres/Supabase)**:
- `ensureAuthWithRls` pins a request-scoped connection, sets `request.jwt.claims` for RLS policies, exposes neutral request helpers, and resets context on cleanup.
- No DB role switching (`SET role = ...`) required; see [systemPatterns.md](systemPatterns.md) and [rls-integration-pattern.md](rls-integration-pattern.md).

## APPs Architecture (v0.21.0-alpha)
**6 Working Applications** with modular architecture minimizing core shell changes:

-   **UPDL**: High-level abstract nodes (Space, Entity, Component, Event, Action, Data, Universo)
-   **Publish Frontend/Backend**: Multi-technology export (AR.js, PlayCanvas)
-   **Analytics**: Quiz performance tracking
-   **Profile Frontend/Backend**: Enhanced user management with workspace packages
-   **Resources Frontend/Backend**: Three-tier cluster management with complete data isolation
-   **Uniks Frontend/Backend**: Workspace functionality with modular architecture

### Key Architecture Benefits
-   Workspace packages, template-first exports, interface separation, and neutral DB contracts remain the durable app-level design principles across the platform packages.

## Build System Architecture (Updated 2025-10-18)
**Primary Tool**: tsdown v0.15.7 (Rolldown + Oxc), 100% coverage (15 custom packages).  
**Output**: Dual-format (ESM + CJS), TypeScript declarations (.d.ts/.d.mts), tree-shaking, ~50% faster than tsc.  
**Pattern**: Single `tsdown.config.ts`, platform neutral/node, manual package.json exports control.

### Root workspace orchestration note (Updated 2026-04-03)
- The repository root now uses Turbo `2.9.3` with Turbo 2 `tasks` syntax and a root `packageManager` declaration.
- Root validation/build commands should continue to run from the repository root via `pnpm build`; repeated root builds are now expected to reuse the local Turbo cache rather than re-executing all 28 package builds.
- Turbo cache correctness depends on excluding generated `dist/**`, `build/**`, `coverage/**`, and `.turbo/**` artifacts from task `inputs`; if repeated root builds ever drop back to `0 cached`, inspect the Turbo summary for output-artifact leakage into hashed inputs before changing package scripts.
- CI exposes optional `TURBO_TEAM` and `TURBO_TOKEN` secrets so remote cache can be enabled later without changing the local developer contract.

### Browser env entrypoint note
- `@universo/utils` now emits a dedicated browser env sub-entry (`dist/env/index.browser.*`) and maps the browser export for `./env` to that entry.
- Current root build is green, but rolldown emits a non-failing warning that `import.meta` is empty in the CJS output of that browser-only env entry; the intended browser/Vite consumption path is the ESM/browser export.
- The package also relies on export parity between `src/index.ts` and `src/index.browser.ts` for browser-safe helpers. When shared codename/VLC helpers were added only to the main entrypoint, downstream shell builds failed on `@universo/metahubs-frontend` dist imports until the browser entrypoint was brought back into sync.

### REST docs generation note
- `@universo/rest-docs` now regenerates `src/openapi/index.yml` from live backend route files through `scripts/generate-openapi-source.js` before package validation and build.
- The package is authoritative for current path and method inventory, but payload schemas remain generic unless promoted from stable backend contracts.
- GitBook API-reference pages now link to the standalone interactive docs flow and document `pnpm --filter @universo/rest-docs build` plus `start` as the canonical launch path.

### Backend focused test wrapper note (Updated 2026-04-08)
- `@universo/*-backend` package `test` scripts invoke `tools/testing/backend/run-jest.cjs --config ...` rather than calling Jest or Vitest directly.
- Focused backend runs must pass test file paths positionally after `--`, for example `pnpm --filter @universo/metahubs-backend test -- src/tests/...`.
- The Vitest-style `--run` flag is invalid for these backend package scripts; when more control is needed, call `node tools/testing/backend/run-jest.cjs --config <jest-config> <paths>` directly.

## UPDL Core System (v0.21.0-alpha)
### High-Level Abstract Nodes ✅ **COMPLETE**

-   **Core model**: 7 nodes (`Space`, `Entity`, `Component`, `Event`, `Action`, `Data`, `Universo`) still define the high-level cross-platform authoring graph.
-   **Export process**: UPDL graph -> template system -> technology-specific code -> published application.
-   **Technology scope**: AR.js is the production path today, PlayCanvas remains the secondary ready path, and the template architecture stays extensible for future runtimes.
-   **Reference**: reusable architecture details live in [systemPatterns.md](systemPatterns.md) rather than this file.

## Development Environment
**Package Management**: PNPM 10.33.0 workspaces with monorepo architecture
**Supply Chain Security**: minimumReleaseAge 7 days, blockExoticSubdeps, trustPolicy no-downgrade (see pnpm-workspace.yaml)
**Build System**: TypeScript + React frontend, Node.js + Express backend
**Base Platform**: legacy upstream shell 2.2.8 with enhanced ASSISTANT support

## Critical Technical Patterns
### React Performance Optimization
-   Avoid API objects in useEffect dependencies
-   Use useRef for API request state tracking
-   Minimize useEffect dependencies

### Request-Scoped DB Access Pattern (Unified Database Access Standard)
**Database Access Pattern** - All backend database access uses one of three permitted tiers with neutral contracts.

**Three Access Tiers:**
-   **Tier 1 — RLS (request-scoped)**: `getRequestDbExecutor(req, getDbExecutor())` for authenticated routes. Carries JWT claims for RLS policies.
-   **Tier 2 — Admin/Bootstrap**: `getPoolExecutor()` from `@universo/database` for admin routes, startup, and background jobs.
-   **Tier 3 — DDL/Migration**: `getKnex()` from `@universo/database` for schema-ddl services, migration runners, and explicit package-local DDL boundaries only.

**Core Contracts** (all in `@universo/utils/database`):
-   `DbExecutor` — query + transaction + isReleased
-   `DbSession` — query + isReleased (read-only)
-   `SqlQueryable` — minimal query contract for persistence stores

**Identifier Safety** (`@universo/database`): `qSchema()`, `qTable()`, `qColumn()`, `qSchemaTable()` — all validate and double-quote identifiers; reject injection payloads. Use `$1`/`$2` bind parameters for values.

**Mutation Expectations**: business-table UPDATE/DELETE/RESTORE flows use `RETURNING` when row confirmation matters, fail closed on zero-row results, and keep SQL schema-qualified instead of relying on `search_path`.

**CI Enforcement**: `node tools/lint-db-access.mjs` runs as a CI step after ESLint, before build. Zero-violation policy for all domain packages.

**Applications sync boundary**: `@universo/applications-backend` keeps raw Knex access only inside `src/ddl/index.ts`; `applicationSyncRoutes.ts` stays under normal lint enforcement and consumes that dedicated Tier 3 boundary instead of calling `getKnex()` directly.

**Metahubs DDL boundary**: `@universo/metahubs-backend` keeps raw Knex access only inside package DDL seams and schema-ddl integration paths; design-time domain services and persistence helpers remain SQL-first.

**Bridge**: `createKnexExecutor(knex)` wraps Tier 3 Knex instances as `DbExecutor` for Tier 3 → Tier 1 boundary (used in publication sync routes).
-   Shared database runtime comes from `@universo/database`
-   CASCADE delete relationships for data integrity
-   UNIQUE constraints on junction tables to prevent duplicates

### UUID v7 Architecture
**Time-Ordered UUID System** - Project-wide UUID v7 for better database indexing performance

**Migration Status**: ✅ Complete (2025-12-10) - All 75 migrations + 31 service files updated

**Key Implementation Details:**

-   **Infrastructure Migration**: PostgreSQL `public.uuid_generate_v7()` function in dedicated migration (MUST execute first)
    - File: `packages/universo-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts`
    - Timestamp: `1500000000000` (July 14, 2017) - Earliest migration to ensure execution before all table creation
    - Registered: First entry in `postgresMigrations` array (PHASE 0: Infrastructure)
    - Implementation: Custom PL/pgSQL function following RFC 9562 specification for PostgreSQL 17.4 (Supabase)
  - **Why separate?**: The UUID v7 function must exist before any schema bootstrap that relies on `DEFAULT public.uuid_generate_v7()`.
-   **Backend Module**: `@universo/utils/uuid` with `generateUuidV7()`, `isValidUuid()`, `extractTimestampFromUuidV7()`
-   **Frontend Package**: `uuidv7@^1.1.0` (npm package for browser bundles)
-   **Migration Pattern**: All DEFAULT clauses use `public.uuid_generate_v7()` instead of `uuid_generate_v4()` or `gen_random_uuid()`
-   **Service Pattern**: Backend services use `uuid.generateUuidV7()` from `@universo/utils`
-   **Performance**: 30-50% faster indexing due to time-ordered nature (better B-tree locality)
-   **UUID v7 Format**: 48-bit Unix timestamp (ms) + 12-bit version/variant + 62-bit random
-   **Compatibility**: Standard RFC 9562 UUID v7 format (backwards compatible with v4 parsing)
-   **PostgreSQL Support**: Native `gen_uuidv7()` available in PostgreSQL 18+, custom function required for 17.4

**Example Usage:**
```typescript
// Backend (SQL migration)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  ...
)

// Backend (service)
import { uuid } from '@universo/utils'
const newId = uuid.generateUuidV7()

// Frontend
import { uuidv7 } from 'uuidv7'
const newId = uuidv7()
```

**Critical Files:**
- Infrastructure migration: `packages/universo-core-backend/base/src/database/migrations/postgres/1500000000000-InitializeUuidV7Function.ts` (PHASE 0)
- Migration registry: `packages/universo-core-backend/base/src/database/migrations/postgres/index.ts` (infrastructure migration first)
- Backend module: `packages/universo-utils/base/src/uuid/index.ts`

**Current UUID v7 Contract:**
- SQL-first migrations and schema bootstrap use `DEFAULT public.uuid_generate_v7()` directly.
- Backend services generate UUID v7 through `@universo/utils/uuid` when they need client-side identifiers.
- Database verification previously confirmed the default is present across the PostgreSQL schema.

### Data Isolation Architecture
**Note**: The original cluster-based isolation (Clusters → Domains → Resources) was removed in the legacy packages cleanup (2026-02-28). Current data isolation is handled via RLS policies and tenant-scoped queries (see `rls-integration-pattern.md`).

### Material-UI Validation Pattern
**Frontend Validation** - Consistent form validation with clear user feedback

**Key Implementation Details:**

-   Required fields use Material-UI `required` attribute (automatic asterisk)
-   No manual asterisks in InputLabel components
-   Error states with visual feedback
-   Conditional save buttons disabled until form is valid
-   No empty options for required select fields

### AR.js Rendering Architecture
**Iframe-Based Rendering** - Essential for proper script execution in React context

**Key Implementation Details:**

-   Iframe-based rendering for proper script execution
-   Static library integration with the main backend server
-   User-selectable library sources (CDN vs local)
-   CDN independence for restricted regions

### Rate Limiting Architecture
**Redis-Based Distributed Rate Limiting** - Production-ready DoS protection for multi-instance deployments

**Key Implementation Details:**

-   **Package**: `@universo/utils/rate-limiting` - Universal rate limiter creation
-   **Pattern**: Singleton Redis client (RedisClientManager) with event-driven connection waiting
-   **Libraries**: 
    -   `express-rate-limit@8.2.0` - HTTP rate limiting middleware
    -   `rate-limit-redis@4.2.3` - Distributed storage backend
    -   `ioredis@^5.8.2` - Redis client with connection pooling
-   **Configuration**: Environment variable `REDIS_URL` (optional, falls back to MemoryStore)
-   **Connection Pattern**: Event-driven (`instance.once('ready')`) with proper cleanup (no polling)
-   **Cleanup**: Automatic event listener removal prevents memory leaks
-   **Multi-Instance Support**: Redis store shares counters across replicas (Docker/K8s/PM2)
-   **Deployment Guide**: See `packages/universo-utils/base/DEPLOYMENT.md` for production setup

**Production Setup**:
```bash
# Set REDIS_URL for multi-instance deployments
REDIS_URL=redis://:password@redis.example.com:6379  # Basic auth
REDIS_URL=rediss://:password@redis.example.com:6380 # TLS (recommended)
```

**Documentation**: 
- Production deployment: `packages/universo-utils/base/DEPLOYMENT.md` (Docker, Kubernetes, PM2)
- Troubleshooting: Common issues (connection timeout, high 429 errors, memory leaks)
- Security: TLS encryption, authentication, network isolation

---

_For system architecture patterns, see [systemPatterns.md](systemPatterns.md). For project overview, see [projectbrief.md](projectbrief.md). For current development status, see [activeContext.md](activeContext.md)._
