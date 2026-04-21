# System Patterns

> Reusable architectural patterns and best practices. Completed implementation history belongs in progress.md. Active work belongs in tasks.md.

## Shared Runtime Widget Script Hook Pattern (IMPORTANT)

**Rule**: dashboard runtime widgets that load client-capable scripts from application runtime metadata must reuse the shared script-selection + client-bundle hook instead of duplicating the catalog/metahub fetch logic per widget.

**Required**:
- `@universo/apps-template-mui` runtime widgets with the same script-discovery contract should use `useRuntimeWidgetClientScript(...)` from `runtimeWidgetHelpers.ts`.
- Shared filtering/dedup must stay centralized through `filterRuntimeWidgetScripts(...)` and `selectRuntimeWidgetScript(...)` so widget-specific components only own their model query and render logic.
- The hook must preserve the current dual-scope lookup contract: catalog-attached scripts when a linked collection is present, metahub-attached scripts otherwise, with `attachedToKind` still able to constrain either side.
- Add focused component coverage when a new widget adopts the hook, because the shared hook is a runtime boundary between script metadata and widget rendering.

**Detection**: `rg "fetchRuntimeScripts|fetchRuntimeClientBundle|useRuntimeWidgetClientScript" packages/apps-template-mui/src/dashboard/components`

**Why**: the 2026-04-20 LMS QA remediation finish found that `ModuleViewerWidget` and `StatsViewerWidget` had drifted into copy-pasted script-loading logic. Centralizing the shared query path reduces widget drift and keeps future runtime widget fixes one-place.

## Public Guest Session Envelope Pattern (IMPORTANT)

**Rule**: public LMS guest sessions must validate against persisted server-side session state, including expiry, even when the transport token itself still fits inside the existing legacy string column.

**Required**:
- Persist a JSON envelope with at least `secret` and `expiresAt` in the guest-session token column instead of storing only the raw secret.
- Validate guest-session tokens by loading the persisted row and checking both secret equality and expiry timestamp before accepting quiz/progress mutations.
- Prefer compatibility-safe hardening that avoids schema-version churn when the existing column can safely hold the structured envelope.
- Public runtime script bundles served without authenticated dashboard chrome must set explicit JavaScript MIME type and defensive browser headers (`nosniff`, CSP, cache policy).

**Detection**: `rg "expiresAt|guest_session_token|X-Content-Type-Options|Content-Security-Policy" packages/applications-backend/base/src/controllers/runtimeGuestController.ts`

**Why**: the 2026-04-20 LMS QA remediation finish closed the remaining public guest-runtime hardening gap without forcing a schema migration by serializing the server-side session envelope into the existing students token column.

## Controller-Owned Nested Standard Child Dispatch Pattern (IMPORTANT)

**Rule**: if nested standard child endpoints still depend on the specialized tree/linked-collection/value-group/option-list controllers, move any remaining dispatch ownership out of `entityInstancesRoutes.ts` and into `entityInstancesController.ts` before attempting a deeper semantics rewrite.

**Required**:
- `entityInstancesRoutes.ts` must not import the specialized child-controller factories or keep its own `dispatchStandardRouteKind(...)`-style helper layer once the entity-owned route surface is already mounted.
- `entityInstancesController.ts` may temporarily centralize the specialized child-controller orchestration behind controller-returned handlers while preserving the current route and payload contract for nested standard child and option-value endpoints.
- Revalidate the focused `entityInstancesRoutes.test.ts` suite plus the touched backend package build and canonical root build before closing the slice.
- Do not describe the backend as fully de-specialized while `entityInstancesController.ts` still instantiates the specialized child controllers internally.

**Detection**: `rg "dispatchStandardRouteKind|create(Tree|LinkedCollection|ValueGroup|OptionList)Controller|listNestedStandardInstances|listOptionValues" packages/metahubs-backend/base/src/domains/entities`

**Why**: the 2026-04-15 backend closure slice proved that moving the live route seam out of `entityInstancesRoutes.ts` was a safe intermediate step. It reduced active router ownership without forcing a riskier one-pass rewrite of nested standard child CRUD/value semantics.

## Incremental Specialized Controller Removal Pattern (IMPORTANT)

**Rule**: remove the smallest controller-owned standard-kind seams first when their behavior is already expressible through shared entity services and compatibility helpers, instead of attempting a one-pass rewrite of every nested standard child surface.

**Required**:
- Prefer cutting single-purpose controller dependencies such as the child-hub list path before larger catalog/value-group/option-list controllers with broader copy/delete/value semantics.
- Rebuild the replacement handler directly in `entityInstancesController.ts` or a neutral shared helper using existing services such as `MetahubTreeEntitiesService`, `treeCompatibility`, shared query validation, and shared SQL helpers rather than instantiating the old controller factory.
- Once a surviving child-controller file is only a thin export surface for handlers already expressible through the generic controller, inline the remaining runtime into `entityInstancesController.ts`, delete the file, and prove the active source tree has no remaining imports of that controller file.
- If a specialized child-controller file becomes fully orphaned after earlier cutovers, delete it as a standalone cleanup slice once active source search proves zero remaining imports or symbol references outside the file itself; do not invent a new migration step just to justify keeping a dead controller around.
- Add focused route coverage for the entity-owned endpoint in the same slice, because many nested standard child paths were previously under-tested relative to the router and blocking-endpoint surfaces.
- Keep the remaining specialized controller dependencies explicitly documented after each cut so progress is measurable and closure claims stay honest.

**Detection**: `rg "create(Tree|LinkedCollection|ValueGroup|OptionList)Controller|listNestedStandardInstances" packages/metahubs-backend/base/src/domains/entities`

**Why**: the 2026-04-15 tree-controller removal proved that the backend controller layer can be de-specialized safely in small verified cuts. Removing the smallest single-purpose dependency first reduced the live seam without forcing a risky all-at-once rewrite of nested catalog/value-group/option-list flows.

## Behavior-Based Standard Blocking Endpoint Pattern (IMPORTANT)

**Rule**: when a standard-kind endpoint is already expressible through the shared entity behavior contract, move the entity-owned route to the generic entity controller and remove manual route-level child-controller dispatch for that endpoint.

**Required**:
- Prefer `entityInstancesController` + `getEntityBehaviorService(...)` ownership for standard-kind blocking endpoints once `standardKindCapabilities.ts` already exposes the required blocking-state builder.
- Preserve the existing response payload contract for each kind (`catalogId` / `setId` / `enumerationId` or other established per-kind fields) unless the matching frontend/tests are migrated in the same slice.
- Keep unsupported-kind and missing-entity behavior explicit instead of silently falling through to unrelated specialized controllers.
- Retarget the focused route suite and rerun both the touched package build and the canonical root build before closing the pass.

**Detection**: `rg "blocking-references|blocking-dependencies|treeController|getBlockingReferences|dispatchEntityRoute" packages/metahubs-backend/base/src/domains/entities`

**Why**: the 2026-04-15 backend consolidation slices proved that hub `blocking-dependencies` and catalog/set/enumeration `blocking-references` could move onto the generic entity-controller + behavior-registry path without changing the frontend-visible contract, removing another real standard-kind ownership seam safely.

## Dynamic Shared Resources Tab Pattern (IMPORTANT)

**Rule**: Resources section tabs must be derived from entity type `ComponentManifest` fields, not hardcoded. Show shared pool tabs only when at least one entity type in the metahub has the corresponding component enabled.

**Required**:
- `SharedResourcesPage.tsx` fetches entity type definitions via `useEntityTypesQuery` and computes tab visibility using `isEnabledComponentConfig()`.
- Tab mapping: `dataSchema.enabled` → Field Definitions tab, `fixedValues.enabled` → Fixed Values tab, `optionValues.enabled` → Option Values tab.
- Layouts and Scripts tabs always show (not tied to entity types).
- Active tab auto-falls-back to first visible tab if the current tab becomes hidden.
- i18n keys follow `general.tabs.{fieldDefinitions|fixedValues|optionValues|layouts|scripts}` pattern.

**Detection**: `rg "hasAnyEnabledComponent|TabConfig" packages/metahubs-frontend/base/src/domains/entities/shared`

**Why**: the 2026-04-18 QA closure proved that deriving shared pool participation from existing ComponentManifest fields eliminates the need for a separate `hasSharedElements` toggle while making the system work for future custom entity types.

## Frontend Standard UI Local Alias Neutralization Pattern (IMPORTANT)

## Metadata API Helper Contract Neutralization Pattern (IMPORTANT)

**Rule**: once metadata folder ownership is already neutral (`fieldDefinition`, `fixedValue`, `record`), remove the remaining `attribute` / `constant` / `element` helper-export and touched controller-local schema seams before attempting a deeper transport-route rewrite.

**Required**:
- Neutralize exported metadata API helper names, direct variants, codename helpers, and matching hook/type contracts so active frontend consumers stop depending on `listAttributes|getAttribute|createAttribute`, `listConstants|getConstant|createConstant`, and `listElements|getElement|createElement` style seams.
- Rename touched backend metadata controller-local schemas to neutral field-definition / fixed-value / record names in the same slice so the controller entrypoints stop advertising legacy child-resource wording through their immediate local implementation surface.
- Preserve mounted route segments, request param names, and compatibility payload fields such as `targetConstantId` while those remain transport/runtime truth and have not been explicitly migrated.
- Revalidate the touched frontend package slice and rerun the canonical root build before closing the pass.

**Detection**: `rg "listAttributes|getAttribute|createAttribute|listConstants|getConstant|createConstant|listElements|getElement|createElement|createAttributeSchema|createConstantSchema|createElementSchema" packages/metahubs-{frontend,backend}/base/src/domains/entities/metadata`

**Why**: the 2026-04-15 metadata helper cleanup proved that the remaining legacy surface could be reduced safely by neutralizing export/hook/schema contracts first, without conflating that work with a riskier mounted-route migration in the same change.

## Frontend Standard UI Local Alias Neutralization Pattern (IMPORTANT)

**Rule**: once the entity-owned standard UI already ships neutral runtime behavior, remove any surviving Hub/Catalog/Set/Enumeration local alias and default-export seams from the touched modules/tests before treating that file family as fully stabilized.

**Required**:
- Neutralize purely local/default-export symbols such as `HubList`, `CatalogList`, `SetList`, `EnumerationList`, or `hubActions` when they no longer describe the real runtime contract and do not participate in mounted route/API semantics.
- Retarget the touched focused tests/comments in the same slice so the remaining assertions describe the neutral standard UI contract immediately.
- Preserve i18n namespaces, kind keys, route strings, and data semantics while those remain the current runtime truth and have not been explicitly migrated.
- Revalidate the touched frontend package slice and rerun the canonical root build before closing the pass.

**Detection**: `rg "const (HubList|CatalogList|SetList|EnumerationList)|export default (HubList|CatalogList|SetList|EnumerationList)|\bhubActions\b" packages/metahubs-frontend/base/src`

**Why**: the 2026-04-14 standard UI alias cleanup proved that even after larger route/runtime cutovers, thin local alias seams can still keep active source looking legacy-owned unless they are removed explicitly and validated like any other entity-first slice.

## Frontend Entity Authoring Route Builder Neutralization Pattern (IMPORTANT)

**Rule**: once the entity-owned frontend runtime already routes through the unified entity shell, remove the remaining Hub/Catalog/Set/Enumeration authoring-path builder symbols from the active shared contract before attempting a deeper transport-route rewrite.

**Required**:
- Rename the shared authoring-path builders and tab/type aliases to neutral tree-entity / linked-collection / value-group / option-list names in `domains/shared/entityMetadataRoutePaths.ts`.
- Retarget the touched standard-runtime views, metadata screens, layout/detail navigation, blocking-delete dialogs, and route-path tests in the same slice so the old builder symbols stop being the live dependency surface immediately.
- Neutralize matching local helper identifiers inside touched standard/metadata API files when the file already proves that the rename is helper-only and does not change emitted URL strings.
- Preserve mounted URL strings, backend route params, and deeper transport semantics while those remain the live server contract and have not been explicitly migrated.
- Revalidate the touched frontend package slice and rerun the canonical root build before closing the pass.

**Detection**: `rg "buildEntity(Hub|Catalog|Set|Enumeration)AuthoringPath|buildCatalogInstancePath|buildHubScopedCatalogPath|buildSetInstancePath|buildHubScopedSetPath|buildEnumerationInstancePath|buildHubScopedEnumerationPath|buildHubInstance(s)?Path" packages/metahubs-frontend/base/src`

**Why**: the 2026-04-14 authoring-route-builder cleanup proved that one more visible business-owned seam could be removed safely by renaming only the shared symbol/helper contract while leaving the mounted backend transport shape untouched.

## Standard Runtime API Helper Neutralization Pattern (IMPORTANT)

**Rule**: once the entity-owned standard runtime hook/form/action surface is neutralized, remove the matching business-named API helper exports from `entities/standard/api/**` and retarget only the direct runtime/test consumers without changing the underlying HTTP path contract in the same pass.

**Required**:
- Neutralize exported API helper/type names such as `createCatalog*`, `getSet*`, `listAllEnumerations`, or `createEnumerationValue` to the linked-collection / value-group / option-list / option-value contract.
- Retarget the touched hooks, list-data helpers, metadata consumers, delete dialogs, and focused tests/mock seams in the same slice so the neutral API helper surface is enforced immediately.
- Preserve HTTP path builders, backend payload semantics, and deeper data-kind terminology while those remain transport/domain truth and have not been explicitly migrated.
- Revalidate the touched frontend package slice and rerun the canonical root build before closing the pass.

**Detection**: `rg "createCatalogAtMetahub|createSetAtMetahub|createEnumerationAtMetahub|getCatalogById|getSetById|getEnumerationById|listEnumerationValues" packages/metahubs-frontend/base/src`

**Why**: the 2026-04-14 standard-runtime API helper cleanup proved that the entity-owned runtime can drop another major layer of old business naming by retargeting the direct data-access contract alone, without forcing an unsafe path/transport migration in the same change.

## Standard Runtime Contract Neutralization Pattern (IMPORTANT)

**Rule**: when entity-owned standard runtime files already implement neutral linked-collection / value-group / option-list behavior, remove business-named hook, form, action, and mutation-type exports from the active frontend contract before attempting deeper API-path or storage renames.

**Required**:
- Neutralize the exported hook/type/form/action contract in `entities/standard/**` so active source stops depending on names such as `useCreateCatalog`, `CreateSetParams`, `EnumerationFormValues`, or `validateCatalogForm`.
- Retarget the touched list views, metadata consumers, action-factory tests, and optimistic mutation tests in the same slice so the new contract is locked immediately.
- Preserve API path shapes, translation namespaces, and durable kind semantics while those are still the backend/data truth and have not been explicitly migrated.
- Revalidate the touched frontend package slice and rerun the canonical root build before closing the pass.

**Detection**: `rg "useCreateCatalog|useCreateSet|useCreateEnumeration|CatalogFormValues|SetFormValues|EnumerationFormValues|CreateCatalogParams|CreateSetParams|CreateEnumerationParams" packages/metahubs-frontend/base/src`

**Why**: the 2026-04-14 standard-runtime mutation contract cleanup proved that a large amount of live business-owned vocabulary was only an export/hook/form seam and could be neutralized safely without changing the underlying API-path or persistence contract in the same step.

## Compatibility-First Runtime Vocabulary Neutralization Pattern (IMPORTANT)

**Rule**: when the active entity-owned runtime still exposes removable business vocabulary in local props, helper names, or UI copy, neutralize the local runtime contract first and preserve persisted config keys or wire paths until a separate persistence/API migration explicitly changes them.

**Required**:
- Rename active component props, local helper names, and user-facing i18n copy to neutral entity/container/collection wording when the shipped runtime already behaves generically.
- Preserve stored config keys such as `hubs`, `isSingleHub`, and `isRequiredHub` and established backend route/path shapes while those remain the current persistence/API truth.
- Update focused EN/RU locale resources and the touched focused tests in the same change so the neutral runtime contract is locked immediately.
- Revalidate the touched package slice and rerun the canonical root build before calling the pass complete.

**Detection**: `rg "availableHubs|selectedHubIds|parentHubId|buildHubScopedCatalogPath|resolveCatalogKindKey|general\.tabs\.(attributes|constants|values)" packages/metahubs-frontend/base/src`

**Why**: the 2026-04-14 container/shared-runtime cleanup proved that local runtime ownership seams can be removed safely without prematurely rewriting backend persistence or HTTP contracts that need their own migration.

## Standard Kind DB-Only Entity Contract Pattern (IMPORTANT)

**Rule**: standard metadata kinds (`catalog`, `hub`, `set`, `enumeration`) are normal DB-resident entity type definitions. Shared consumers must not rely on `includeBuiltins`, `isBuiltin`, `source`, or `custom.*-v2` remapping once the legacy-removal cleanup is applied.

**Required**:
- Resolve menu, breadcrumb, and selector labels from entity-type presentation/UI metadata for all kinds.
- Keep preset, snapshot, fixture, and runtime contracts on direct standard kind keys.
- Verify exported `entityTypeDefinitions` by content and behavior, not by builtin/custom markers.
- Treat any reintroduction of builtin/source branching in production `src` code as a regression.

**Detection**: `rg "includeBuiltins|isBuiltin|source: 'builtin'|custom\.(catalog|hub|set|enumeration)-v2" packages tools`

**Why**: the 2026-04-13 cleanup removed the shipped builtin-registry contract and aligned shared navigation, fixtures, and runtime/browser proof to direct standard kinds.

## Entity-Owned Managed Kind Count And Fetch Pattern (IMPORTANT)

**Rule**: shared metahub summaries and generic selectors must consume managed standard kinds through neutral entity-owned contracts, not through fixed per-kind DTO fields or separate per-kind fetch clients.

**Required**:
- Return grouped `entityCounts` from board-style metahub summary endpoints instead of hardcoding `hubsCount` / `catalogsCount` as the primary API contract.
- Derive any UI-specific standard-kind cards from `entityCounts` in the consumer layer.
- Use `listEntityInstances(...)` for managed `catalog` / `hub` / `set` / `enumeration` selectors and editors when the flow only needs the shared entity list contract.
- Treat separate per-kind list clients as specialized-only seams for richer domain payloads, not as the default fetch path for shared generic UI.

**Detection**: `rg "hubsCount|catalogsCount|listAllCatalogs|listAllSets|listAllEnumerations" packages/metahubs-frontend packages/metahubs-backend`

**Why**: the final 2026-04-13 closure wave replaced the fixed metahub board summary shape and the last shared frontend per-kind fetch seams with the unified entity-owned contract.

## Managed Metadata Entity Route Dispatch Pattern (IMPORTANT)

**Rule**: top-level metahub hubs/catalogs/sets/enumerations authoring must enter through the entity-owned route tree, but managed kinds must keep reusing specialized controllers instead of forcing the generic entity controller to emulate richer contracts.

**Required**:
- `createEntityInstancesRoutes(...)` owns the top-level metadata CRUD surface for managed hub/catalog/set/enumeration kinds.
- The dispatcher resolves the effective managed kind from compatibility helpers plus entity-type lookup, injects route `kindKey`, and delegates to the matching specialized controller.
- Generic entity CRUD remains the fallback only for true custom-only kinds.
- `domains/router.ts` must not re-mount old top-level hubs/catalogs/sets/enumerations families once the dispatcher-backed entity layer is live.
- Frontend hubs/catalogs/sets/enumerations API clients and query keys must stay scoped by optional `kindKey`.

**Detection**: `rg "createEntityInstancesRoutes|resolveLegacyCompatibleChildKindKey|createHubsRoutes|createCatalogsRoutes|createSetsRoutes|createEnumerationsRoutes" packages`

**Why**: the 2026-04-13 route cutover proved that entity-route ownership plus specialized-controller delegation is the safe migration path.

## Canonical Entity OpenAPI Inventory Pattern (IMPORTANT)

**Rule**: the generated REST inventory must publish entity-owned managed metadata routes as the canonical contract and describe the legacy per-kind route families only as nested/compatibility seams while they remain mounted.

**Required**:
- `packages/universo-rest-docs/scripts/generate-openapi-source.js` must include `domains/entities/routes/entityInstancesRoutes.ts` in `routeSources` under a dedicated `Entities` tag.
- Keep Hubs/Catalogs/Sets/Enumerations tag descriptions explicit that those families are nested or compatibility routes once entity-owned managed paths are the public top-level contract.
- Regenerate `src/openapi/index.yml` through the script instead of hand-editing the YAML snapshot.
- Treat missing `/metahub/{metahubId}/entities/{kindKey}/instances` or `/instance/{entityId}` entries in generated OpenAPI as documentation drift.

**Detection**: `rg "entityInstancesRoutes|tag: 'Entities'|Nested and compatibility" packages/universo-rest-docs/scripts packages/universo-rest-docs/src/openapi`

**Why**: the 2026-04-13 closure found that docs could still look legacy-first even after production route ownership had moved, because the generator inventory itself was missing the canonical entity-owned route family.

## Metahub Page Shell Unified Horizontal Gutter Pattern (IMPORTANT)

**Rule**: standalone metahub pages must use the dedicated metahub shell gutter provided by `MainLayoutMUI` and must not reintroduce local negative bleed offsets or extra page-local horizontal padding.

**Required**:
- Route-aware spacing comes only from `pageSpacing.ts` helpers: `isMetahubShellRoute`, `getPageGutterPx`, `getHeaderInsetPx`.
- Do not remove the route-aware `Header` inset while the browser proof still depends on it.
- Metahub list/workspace loading states must use `SkeletonGrid insetMode='content'` instead of repeated numeric `mx={0}` overrides.
- Standalone route pages must not add their own extra `px` wrappers on top of the shell gutter.

**Detection**: `rg "isMetahubShellRoute|getPageGutterPx|getHeaderInsetPx|insetMode='content'|PAGE_CONTENT_GUTTER_MX|PAGE_TAB_BAR_SX" packages`

**Why**: the durable contract now includes one shared route-aware helper source plus semantic loading-state spacing.

## EntityFormDialog First-Open State Hydration Pattern (IMPORTANT)

**Rule**: `EntityFormDialog` must render from internal state only; do not reintroduce first-open prop overrides or render-phase ref writes.

**Required**:
- Reset incoming dialog state before paint on the first open transition.
- Resync to incoming initials while the dialog is closed.
- Keep `extraValuesRef` synchronized only through reset helpers or effects.
- Preserve async hydration through `shouldPreserveAsyncHydration(...)` and `hasTouchedExtraValues`.

**Detection**: `rg "isFreshOpen|renderedExtraValues|extraValuesRef\.current =|shouldPreserveAsyncHydration" packages/universo-template-mui`

**Why**: the accepted fix closed both the render-purity issue and the first-open child-update race.

## Compatibility-Aware Blocker Query Kind Array Pattern (IMPORTANT)

**Rule**: delete blocker queries for legacy-compatible kinds must accept the full compatible target-kind set and query with `ANY($n::text[])`; exact built-in literals are not enough once compatibility metadata allows custom V2 kinds.

**Required**:
- Resolve compatible kinds from the same compatibility helper layer used by the owning controller or delete plan.
- Blocker services for constants, attributes, and enumeration values must stay array-aware.
- Apply the same contract to both generic entity delete flows and legacy child-delete flows.
- Keep direct service-level SQL regressions plus at least one real browser negative-path proof.

**Detection**: `rg "ANY\(\$[0-9]+::text\[\]\)|findSetReferenceBlockers|findReferenceBlockersByTarget|target_object_kind = 'set'|target_object_kind = 'enumeration'" packages/metahubs-backend`

**Why**: route-level compatibility work is not sufficient if the low-level SQL seam still filters only exact built-in kinds.

## Validated Legacy-Compatible Read Union Pattern (IMPORTANT)

**Rule**: legacy-compatible hub/set/enumeration list reads must validate an explicit compatible custom `kindKey`, but then widen the read scope back to the full compatible kind union so V2 surfaces still show legacy rows on fresh imports.

**Required**:
- Shared backend list helpers validate the explicit compatible `kindKey` and then return the full compatibility union.
- Do not collapse explicit compatible V2 requests to `[requestedKindKey]` on list/read surfaces.
- Shared kind-recognition helpers must treat preset-derived keys as compatible when they extend known defaults with suffixes.

**Detection**: `rg "resolveRequestedLegacyCompatibleKinds|getLegacyCompatibleObjectKindForKindKey|custom\.(hub|set|enumeration)-v2-" packages`

**Why**: fresh-import Hub V2 / Set V2 / Enumeration V2 surfaces must still show legacy rows.

## Compatibility-Metadata Legacy V2 Pattern (IMPORTANT)

**Rule**: legacy-compatible V2 kinds must preserve their stored custom `kindKey` and derive legacy behavior through compatibility metadata or known V2 helpers across frontend caches, backend controllers, publications, runtime, and schema-ddl.

**Required**:
- Do not rewrite `custom.catalog-v2`, `custom.hub-v2`, `custom.set-v2`, or `custom.enumeration-v2` rows to built-in literals in storage or snapshots.
- Resolve behavior through `config.compatibility.legacyObjectKind`, fallback `config.legacyObjectKind`, and known V2 kind-key helpers.
- Scope frontend query keys, adapters, and optimistic cache updates by optional `kindKey`.
- Runtime/publication/schema code must classify behavior through shared compatibility helpers instead of exact-kind branching.

**Detection**: `rg "legacyObjectKind|custom\.(catalog|hub|set|enumeration)-v2|allSetsScope|allEnumerationsScope|getLegacyCompatibleObjectKindForKindKey" packages`

**Why**: custom V2 kinds stay coherent only when storage identity, caches, runtime, and schema rules resolve the same behavior source.

## Publication Executable Table-Name And Compatibility Propagation Pattern (IMPORTANT)

**Rule**: publication-to-executable normalization must carry explicit table naming and legacy-compatible metadata through the whole pipeline.

**Required**:
- `SnapshotSerializer` preserves merged compatibility metadata for legacy-compatible custom V2 kinds.
- Applications-backend consumers classify custom hub/set/enumeration-compatible rows through compatibility metadata or known V2 helpers.
- When a snapshot entity definition includes `tableName`, executable payloads propagate it into `physicalTableName`.
- Shared contracts such as `SnapshotEntityDefinition` must declare optional `tableName`.

**Detection**: `rg "tableName|physicalTableName|SnapshotEntityDefinition|publishedApplication(RuntimeSnapshot|SnapshotEntities)|legacyObjectKind" packages`

**Why**: downstream normalization drifted until compatibility metadata and explicit table names were preserved end to end.

## Legacy-Compatible Entity Route Ownership Pattern (IMPORTANT)

**Rule**: legacy-compatible entity authoring may reuse mature hub/catalog/set/enumeration UI components, but navigation must stay on the entity-based route tree whenever the current route carries `:kindKey`.

**Required**:
- Build links through shared route-aware helpers that prefer `/metahub/:metahubId/entities/:kindKey/...` paths over legacy `/hub|catalog|set|enumeration/...` paths when `kindKey` is present.
- Keep list/detail actions, tabs, and blocking dialogs aligned to those helpers.
- Register entity-owned nested routes for hub scope, hub-scoped catalog detail, set detail, and enumeration detail flows.
- Extend breadcrumbs through matching legacy-compatible name hooks instead of assuming the generic detail route applies.

**Detection**: `rg "buildCatalogAuthoringPath|buildHubAuthoringPath|buildSetAuthoringPath|buildEnumerationAuthoringPath|entities/:kindKey/instance" packages`

**Why**: the durable contract is legacy UI reuse under entity-route ownership, not legacy-route fallback.

## Reusable Entity Preset Template Registry Pattern (IMPORTANT)

**Rule**: reusable cross-metahub entity presets must extend the existing metahub template registry/versioning flow through `definition_type='entity_type_preset'`.

**Required**:
- Persist reusable presets through `cat_templates` + `doc_template_versions`.
- Expose `definitionType` on template summaries and `activeVersionManifest` on template detail responses.
- Validate entity preset manifests through the shared validator layer.
- Reuse `useTemplates`, `useTemplateDetail`, and `TemplateSelector` for preset-driven create-mode form patching.

**Detection**: `rg "entity_type_preset|activeVersionManifest|EntityTypePresetSelector|TemplateSeeder" packages`

**Why**: reusing the existing registry keeps preset versioning, validation, and builtin seeding aligned with the rest of the template system.

## Custom-Only Generic Entity Route Gating Pattern (IMPORTANT)

**Rule**: the first generic entity-instance CRUD surface must remain custom-kind-only until the compatibility layer proves that built-ins can safely reuse the shared object foundation.

**Required**:
- Resolve routed kinds through `EntityTypeResolver` and reject built-in kinds fail closed on generic routes.
- Keep legacy built-in object routes as the source of truth until dedicated compatibility phases widen the shared surface.
- Let `MetahubObjectsService` accept generic kind strings and transaction runners so shared CRUD code can grow underneath legacy adapters.

**Detection**: `rg "Generic entity routes currently support custom entity kinds only|entityInstancesRoutes|findByCodenameAndKind\(|updateObject\(" packages/metahubs-backend`

**Why**: the shared object plumbing is ready, but built-in design-time objects still carry extra policy, copy, and runtime behavior.

## Component-Gated Generic Entity Instance Tabs Pattern (IMPORTANT)

**Rule**: generic custom-entity instance authoring must compose dialog tabs from the resolved entity-type component manifest and reuse only the seams that are already object-scoped.

**Required**:
- Reuse one `EntityFormDialog` surface for create/edit/copy flows.
- Show `hubs`, `attributes`, `layout`, `scripts`, `actions`, and `events` only when the corresponding components are enabled and the object is already persisted where required.
- Keep catalog-compatible kinds on the reused `CatalogList` surface when the route already delegates there.
- Keep create/copy dialogs intentionally smaller than edit dialogs.

**Detection**: `rg "buildFormTabs|ENTITY_INSTANCE_DISPLAY_STYLE|CatalogList|isCatalogCompatibleMode|EntityInstanceList" packages`

**Why**: the durable contract is edit-only reuse of saved-object tabs, not a second generic authoring shell.

## Transaction-Aware ECAE Lifecycle Dispatch Pattern (IMPORTANT)

**Rule**: generic entity lifecycle dispatch must stay split across transaction boundaries: `before*` hooks execute inside the mutation transaction, and `after*` hooks execute only after a successful commit.

**Required**:
- Keep object-owned Actions and Event Bindings behind component-manifest gates.
- `EntityMutationService` calls `EntityEventRouter` with the active transaction runner for `before*` hooks.
- Generic create also routes through `EntityMutationService`.
- When generic create allocates a pending object id ahead of persistence, that same id becomes the persisted `_mhb_objects.id`.
- `after*` hooks run only after commit and must not be wrapped in fake nested post-commit abstractions.

**Detection**: `rg "EntityMutationService|EntityEventRouter|createEntity\(|createObject\(|_mhb_actions|_mhb_event_bindings" packages/metahubs-backend`

**Why**: explicit transaction boundaries keep lifecycle behavior correct and prevent create-id drift.

## Layout-Owned Catalog Runtime Behavior Pattern (IMPORTANT)

**Rule**: catalog runtime create/edit/copy/search behavior must be owned by layout config, not by a separate catalog fallback form or object-level `runtimeConfig` fallback.

**Required**:
- Store catalog runtime behavior as nested `catalogBehavior` inside layout `config`.
- Treat the global layout as the default baseline until a catalog-specific layout exists.
- Catalog CRUD/UI/API contracts must not accept, return, or serialize legacy catalog `runtimeConfig`.
- Catalog layouts keep sparse overlay storage; widget-visibility booleans are reconstructed during publication/runtime materialization.

**Detection**: `rg "catalogBehavior|resolveCatalogLayoutBehaviorConfig|runtimeConfig|buildDashboardWidgetVisibilityConfig" packages`

**Why**: the stable contract is layout-owned behavior plus sparse catalog storage with runtime materialization.

## Runtime Section Alias Compatibility Pattern (IMPORTANT)

**Rule**: the generic runtime wave exposes `section*` identifiers as the primary shared contract while keeping legacy `catalog*` fields alive until the remaining builder/runtime surfaces migrate.

**Required**:
- Return `section`, `sections`, and `activeSectionId` alongside `catalog`, `catalogs`, and `activeCatalogId`.
- Accept optional `sectionId` in frontend/shared runtime helpers but continue resolving backend payload/query `catalogId` values from `sectionId ?? catalogId`.
- Prefer section identifiers in menu mapping, runtime selection state, and create/edit/copy flows.

**Detection**: `rg "sectionId \?\? catalogId|activeSectionId|sections|kind: 'section'" packages`

**Why**: preserving both alias families prevents later builder/runtime phases from breaking existing catalog flows.

## Shared Snapshot V2 Runtime Materialization Pattern (IMPORTANT)

**Rule**: shared design-time entities may be exported/imported as first-class snapshot sections, but runtime and schema-sync consumers must continue to see one flattened ordinary snapshot surface.

**Required**:
- Export `sharedAttributes`, `sharedConstants`, `sharedEnumerationValues`, and `sharedEntityOverrides` as dedicated snapshot sections.
- Materialize those sections through `SnapshotSerializer.materializeSharedEntitiesForRuntime(...)` before any runtime/schema consumer calls `deserializeSnapshot(...)` or `enrichDefinitionsWithSetConstants(...)`.
- Compute runtime `snapshotHash` from the materialized snapshot when application sync consumes that materialized view.
- Keep the raw publication snapshot separately for integrity/history paths.
- Snapshot import recreates shared containers and remaps shared override rows.

**Detection**: `rg "materializeSharedEntitiesForRuntime|sharedAttributes|sharedConstants|sharedEnumerationValues|sharedEntityOverrides" packages`

**Why**: the platform needs first-class shared-entity snapshot fidelity without inventing a second runtime model.

## Request-Scoped Shared Override Runner Reuse Pattern (IMPORTANT)

**Rule**: shared override mutation helpers must reuse an explicit caller runner inside request-scoped RLS routes and parent transactions instead of reopening nested savepoints.

**Required**:
- `SharedEntityOverridesService.upsertOverride(...)` accepts an explicit `db` / `SqlQueryable` runner.
- Request handlers already running on request-scoped executors pass that executor through.
- Parent mutation flows already inside `exec.transaction(...)` pass their active `tx`.
- Keep regression coverage proving that the explicit-runner path does not call `exec.transaction()` again.

**Detection**: `rg "upsertOverride\(|db: exec|db: tx" packages/metahubs-backend`

**Why**: reusing the caller runner keeps request and parent transaction lifetimes aligned.

## General/Common Shared Library Fail-Closed Pattern (IMPORTANT)

**Rule**: the shared-library scripting seam is valid only for `attachedToKind='general'` with `moduleRole='library'`; new out-of-scope library authoring must fail closed at the backend service layer.

**Required**:
- Enforce scope/module-role compatibility in `MetahubScriptsService` create and update paths.
- Reject `general` scripts whose persisted role is not `library` and reject new `library` scripts outside Common/general.
- Preserve unchanged legacy out-of-scope rows only for no-scope-transition edits.
- Keep dependency-sensitive delete, codename-rename, and circular `@shared/*` failure modes covered by focused service tests and the browser flow.

**Detection**: `rg "assertScopeModuleRoleCompatibility|moduleRole.*library|attachedToKind.*general|@shared/" packages`

**Why**: the durable contract is server-side fail-closed validation plus browser-backed proof.

## Catalog Layout Inherited Widget Contract Pattern (IMPORTANT)

**Rule**: catalog layouts must expose inherited base-layout widgets as read-only config surfaces while gating inherited move/toggle/exclude overrides through the base widget `config.sharedBehavior` contract.

**Required**:
- Return `isInherited` for inherited catalog-layout widgets.
- Global/base widget editors persist `sharedBehavior` inside widget `config`.
- Reject inherited widget config edits and direct reassignment at the backend service layer.
- Allow inherited remove/exclude, toggle, and move overrides only when `sharedBehavior` permits them.
- Ignore inherited override config during snapshot export and application sync so inherited runtime widgets always materialize with base widget config.

**Detection**: `rg "isInherited|_mhb_catalog_widget_overrides|Inherited widgets cannot|sharedBehavior" packages`

**Why**: the sharedBehavior-gated override model prevents future layout refactors from silently reopening locked inherited controls or reintroducing runtime-config drift.

## Source-Only Package PeerDependencies Pattern (CRITICAL)

**Rule**: source-only packages with no built `dist/` output must use `peerDependencies` instead of runtime `dependencies`.

**Required**:
- Do not add a `main` field to source-only packages.
- Move runtime dependencies that would otherwise create duplicate React or duplicate framework instances into `peerDependencies`.

**Detection**: `find packages/*/base -name package.json -exec grep -L '"main"' {} \;`

**Symptoms**:
- duplicate React instances
- PNPM hoist conflicts
- cross-package resolution drift

**Why**: this keeps source-only workspace packages from behaving like accidentally bundled runtime packages.

## Store Pattern With Raw SQL (CRITICAL)

**Rule**: backend persistence lives in store modules that call `DbExecutor.query(sql, params)` through SQL-first stores; route files stay thin and controllers/services orchestrate behavior.

**Required**:
- Route files remain small and contain only registrations.
- Controllers validate input and format responses.
- Services own orchestration and transactions.
- Stores use parameterized raw SQL through `DbExecutor` / `SqlQueryable`.
- Prefer explicit column lists and `RETURNING` clauses where row confirmation matters.

**Detection**: `rg "DbExecutor\.query|SqlQueryable|createMetahubHandler|asyncHandler|RETURNING" packages`

**Why**: this repository standardized on SQL-first stores and thin route/controller/service boundaries.

## RLS Integration Pattern (CRITICAL)

**Rule**: authenticated request routes must use request-scoped DB executors/sessions that carry JWT claims for RLS policies; admin/bootstrap work must use the pool executor; DDL uses explicit Knex boundaries only.

**Required**:
- Tier 1: `getRequestDbExecutor(req, getDbExecutor())` / `getRequestDbSession(req, getDbExecutor())` for authenticated routes.
- Tier 2: `getPoolExecutor()` for admin routes, startup provisioning, and background jobs outside user context.
- Tier 3: `getKnex()` only for schema-ddl, migration runners, and explicit DDL seams.
- Request-scoped admin guards reuse the request DB session instead of silently escaping the RLS context.
- Route handlers and SQL-first stores outside explicit DDL seams must not call `getKnex()` directly.

**Detection**: `rg "getRequestDbExecutor|getRequestDbSession|getPoolExecutor|getKnex\(|RLS Request DB Session Reuse" packages`

**Why**: this keeps request RLS, bootstrap execution, and DDL transport isolated and predictable.

## i18n Architecture (CRITICAL)

**Rule**: English is the base locale, Russian stays full parity, and feature packages own their namespaces through registration instead of leaking unregistered top-level translation blocks.

**Required**:
- Register feature-package namespaces through package-local `src/i18n/index.ts` entrypoints.
- Keep EN and RU structures aligned when adding new top-level keys.
- When a package exports a consolidated namespace bundle, every new top-level block must be included in the merge.
- UI must prefer resolved localized presentation/name data over raw translation keys on shipped surfaces.

**Detection**: `rg "registerNamespace|locales/en.json|locales/ru.json|namespace" packages`

**Why**: missing namespace registration or unmerged top-level blocks produce raw i18n keys in the UI even when translations exist.

## Universal List Pattern (CRITICAL)

**Rule**: large list pages decompose into a data hook, pure utilities, and a presentation component; shared entity/cached supporting queries belong in reusable hooks.

**Required**:
- `use<Domain>ListData(...)` owns React Query, pagination, filtering, and dialog state.
- `*ListUtils.ts` keeps pure display/sort helpers.
- Presentation components render from hook return values only.
- Shared supporting queries such as `useMetahubTrees(metahubId)` centralize deduplicated list reads.

**Detection**: `rg "ListData|ListUtils|useMetahubTrees" packages/metahubs-frontend`

**Why**: this prevents 1000+ line list components from carrying duplicated data-loading logic and cache drift.

## React StrictMode Pattern (CRITICAL)

**Rule**: components must tolerate React StrictMode double-render and double-effect semantics; render-phase mutation, implicit side effects, and stale hook ordering are not acceptable.

**Required**:
- No render-phase writes to refs used as state substitutes.
- Hooks remain stable across loading/error/null branches.
- Async/client-side resets must be state-backed and idempotent.
- Browser-facing fixes must be backed by focused regression coverage when StrictMode behavior is involved.

**Detection**: `rg "extraValuesRef\.current =|hook order|StrictMode|render-phase" packages`

**Why**: many recent dialog and list regressions appeared only when real React lifecycle behavior invalidated optimistic JSX assumptions.

## Rate Limiting Pattern (CRITICAL)

**Rule**: HTTP rate limiting uses the shared `@universo/utils/rate-limiting` package with Redis when available and memory fallback only for single-instance/local scenarios.

**Required**:
- Use the shared singleton Redis client manager.
- Keep configuration environment-driven through `REDIS_URL`.
- Preserve per-instance memory fallback only when Redis is intentionally unavailable.
- Document production deployment expectations in the shared utils deployment docs.

**Detection**: `rg "rate-limiting|RedisClientManager|REDIS_URL|express-rate-limit|rate-limit-redis" packages`

**Why**: the project expects production-ready distributed rate limiting for multi-instance deployments without each package inventing its own limiter contract.
