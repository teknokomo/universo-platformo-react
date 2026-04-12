# System Patterns
> **Note**: Reusable architectural patterns and best practices. For completed work -> progress.md. For current tasks -> tasks.md.
## Metahub Page Shell Unified Horizontal Gutter Pattern (IMPORTANT)
**Rule**: Standalone metahub pages must use the dedicated narrower metahub shell gutter provided by `MainLayoutMUI` and must not reintroduce ad hoc negative `mx` bleed offsets or extra page-local horizontal padding below `ViewHeader`.
**Required**:
- The metahub shell route decision and inset math must come from the shared `pageSpacing.ts` helpers (`isMetahubShellRoute`, `getPageGutterPx`, `getHeaderInsetPx`) instead of duplicating regex logic inside `MainLayoutMUI`, `Header`, or route-level components.
- Do not remove the route-aware `Header` inset just because `MainLayoutMUI` already applies shell `px`; the real `metahub-shell-spacing.spec.ts` browser proof currently requires that extra `Header` inset to keep breadcrumbs aligned with the metahub `ViewHeader` title region.
- Legacy and entity-based metahub list surfaces should not use `mx: { xs: -1.5, md: -2 }` to widen card grids, tables, or pagination beyond the header gutter.
- Metahub page-shell sections such as Common, Settings, Migrations, and Layout details should not use metahub-local `PAGE_CONTENT_GUTTER_MX` / `PAGE_TAB_BAR_SX` overrides that make the content wider than the page title and right-side actions.
- Standalone metahub route pages should not add their own `px: { xs: 1.5, md: 2 }` wrappers on top of the shell; if the shell gutter must change again, change it once in `MainLayoutMUI` for `/metahubs` and `/metahub/*`.
- The shared shell `Header` must stay in the same metahub-specific inset contract as the body content, because breadcrumbs and theme/language controls live there rather than in the page body.
- Metahub loading states must not rely on `SkeletonGrid`'s older negative default `mx`; use the shared semantic contract `SkeletonGrid insetMode='content'` on metahub list/workspace routes so loading cards align with the steady-state content without repeating numeric `mx={0}` overrides.
- If a surface is embedded inside another shell, keep the embedded-specific local layout logic there; the standalone route contract is the important one to preserve.
- When adjusting metahub spacing again, validate both legacy and entity-based pages so the header/title gutter and the content gutter cannot drift apart silently.
**Detection**: `rg "isMetahubShellRoute|getPageGutterPx|getHeaderInsetPx|mx: \{ xs: -1\.5, md: -2 \}|PAGE_CONTENT_GUTTER_MX|PAGE_TAB_BAR_SX|insetMode='content'|insetMode=\"content\"" packages`
**Why**: The 2026-04-12 QA gap-closure pass revalidated that fixing only steady-state page content was not enough. The durable contract now includes one shared route-aware helper source plus a semantic loading-state inset mode, which prevents future spacing passes from reintroducing duplicated route detection or numeric loading overrides.
## EntityFormDialog First-Open State Hydration Pattern (IMPORTANT)
**Rule**: `EntityFormDialog` must render from internal state only; do not reintroduce first-open prop overrides or render-phase ref writes to paper over reset timing.
**Required**:
- Reset incoming dialog state before paint on the first open transition and resync to incoming initials while the dialog is closed.
- Keep `extraValuesRef` synchronized only through reset helpers or effects; writing `extraValuesRef.current` during render is not allowed.
- Preserve the existing async hydration contract: `shouldPreserveAsyncHydration(...)` and `hasTouchedExtraValues` still decide whether late `initialExtraValues` updates may replace current state.
- Keep focused regression coverage for both first-open auto-initializer blanking and first-open child-update races in `EntityFormDialog.test.tsx`.
**Detection**: `rg "isFreshOpen|renderedExtraValues|extraValuesRef\.current =|useLayoutEffect|shouldPreserveAsyncHydration" packages/universo-template-mui/base/src/components/dialogs`
**Why**: The 2026-04-12 GH763 review triage confirmed two coupled issues in the older dialog approach: React render purity was violated by a render-phase ref write, and the passive open-reset cycle could overwrite first-open child updates. A state-backed before-paint reset closes both seams without regressing async hydration.
## Legacy-Compatible V2 Preset Automation Uplift Pattern (IMPORTANT)
**Rule**: Legacy-compatible V2 presets built on top of automation-disabled built-in kinds must explicitly override their component manifest; do not spread `HUB_TYPE.components` or `ENUMERATION_TYPE.components` verbatim when the product contract promises V2-only automation capabilities.
**Required**:
- Hub V2 must explicitly enable `scripting`, `actions`, and `events` on top of `HUB_TYPE.components`.
- Enumeration V2 must explicitly enable `actions` and `events` on top of `ENUMERATION_TYPE.components`; inherited scripting must stay asserted alongside the uplifted components.
- Direct preset regression coverage must assert the upgraded component set instead of only validating manifest schema shape.
- Fixture-facing canonical contracts must also assert the exported V2 entity definition components so preset drift is caught after template seeding/export, not only in unit tests.
**Detection**: `grep -RIn "hub-v2.entity-preset\|enumeration-v2.entity-preset\|templateManifestValidator\|assertSelfHostedAppEntityTypeDefinition" packages tools`
**Why**: The 2026-04-12 QA completion follow-up found that the shipped route/runtime parity work was green, but Hub V2 and Enumeration V2 still inherited the legacy-disabled automation component set because their presets copied the built-in component maps verbatim. Preserving the explicit override rule prevents future parity waves from silently shipping "V2" presets that still lack the promised automation uplift.
## Compatibility-Aware Blocker Query Kind Array Pattern (IMPORTANT)
**Rule**: Low-level delete blocker queries for legacy-compatible kinds must accept the full compatible target-kind set and query with `ANY($n::text[])`; do not hardcode exact built-in `set` or `enumeration` literals once compatibility metadata allows custom V2 kinds.
**Required**:
- Resolve compatible kinds from the same compatibility helper layer used by the owning controller or delete plan before calling blocker services.
- `MetahubConstantsService.findSetReferenceBlockers(...)`, `MetahubConstantsService.findAttributeReferenceBlockersByConstant(...)`, `MetahubAttributesService.findReferenceBlockersByTarget(...)`, `findDefaultEnumValueBlockers(...)`, and `findElementEnumValueBlockers(...)` must stay array-aware and use `ANY($n::text[])` semantics.
- Apply the same contract to both generic custom-entity delete flows and legacy set/enumeration/constant child-delete flows, because both route families reuse the same low-level blocker services.
- Keep direct service-level SQL regressions plus one real browser negative-path proof whenever this seam changes, so route-level mocks cannot hide an exact-kind regression.
**Detection**: `rg "find(SetReferenceBlockers|AttributeReferenceBlockersByConstant|ReferenceBlockersByTarget|DefaultEnumValueBlockers|ElementEnumValueBlockers)|ANY\(\$[0-9]+::text\[\]\)|target_object_kind = 'set'|target_object_kind = 'enumeration'" packages/metahubs-backend tools/testing/e2e`
**Why**: The 2026-04-12 QA completion pass found that route-level compatibility work was not sufficient on its own. Delete safety still drifted because the low-level SQL services filtered only exact built-in target kinds, which meant compatible `custom.set-v2*` and `custom.enumeration-v2*` references could bypass blocked-delete behavior until the query seam became array-aware.
## Validated Legacy-Compatible Read Union Pattern (IMPORTANT)
**Rule**: Legacy-compatible hub/set/enumeration list reads must validate an explicit compatible custom `kindKey`, but after validation they must widen the read scope back to the full compatible kind union so V2 surfaces still show legacy rows on fresh imports.
**Required**:
- Shared backend list helpers such as `resolveRequestedLegacyCompatibleKinds(...)` must validate the explicit compatible `kindKey` and then return the full `resolveLegacyCompatibleKinds(...)` union for list/read surfaces.
- Do not collapse an explicit compatible V2 request to `[requestedKindKey]` on hub/set/enumeration list reads; that hides legacy rows from the V2 surfaces and breaks the accepted fresh-import coexistence contract.
- Shared kind-recognition helpers must still treat preset-derived keys as compatible when they extend known defaults with suffixes, for example `custom.hub-v2-demo`, `custom.set-v2-demo`, or `custom.enumeration-v2-demo`.
- Keep focused regression coverage on shared kind-resolution helpers, backend hubs/sets/enumerations route tests, and the broad legacy-compatible V2 browser flow whenever this seam changes.
**Detection**: `rg "resolveRequestedLegacyCompatibleKinds|getLegacyCompatibleObjectKindForKindKey|custom\.(hub|set|enumeration)-v2-" packages/metahubs-backend packages/universo-types tools/testing/e2e`
**Why**: The 2026-04-12 post-rebuild regression fix revalidated the actual product contract on a fresh imported metahub: Hub V2 / Set V2 / Enumeration V2 must still show legacy rows. Preserving the validated read-union rule prevents future compatibility refactors from reintroducing an exact-scope filter that hides those legacy rows again.
## Legacy-Compatible E2E Pathname Matcher Pattern (IMPORTANT)
**Rule**: Playwright response matchers for legacy-compatible V2 entity routes must match on the response pathname, not on the raw full URL string.
**Required**:
- Use a helper based on `new URL(response.url()).pathname` when matching direct set/enumeration/hub/entity-owned mutation routes.
- Expect optional compatibility query params such as `kindKey` on delegated direct endpoints once entity-route ownership is wired correctly.
- Keep targeted browser proof on the affected flow whenever route query params or compatibility propagation change.
**Detection**: `rg "waitForResponse|response\.url\(\)\.endsWith|kindKey=" tools/testing/e2e/specs/flows`
**Why**: The 2026-04-11 Entity V2 completion remediation found that the fixed Set V2 delegated leaf flow was still failing in Playwright only because the spec compared the full URL suffix and ignored the expected `?kindKey=...` query param. Matching by pathname preserves the real product proof instead of turning compatibility context into a false-negative timeout.
## Compatibility-Metadata Legacy V2 Pattern (IMPORTANT)
**Rule**: Legacy-compatible V2 kinds must preserve their stored custom `kindKey` and derive legacy catalog/hub/set/enumeration behavior through compatibility metadata or known V2 kind-key helpers across frontend caches, backend controllers, publications, runtime, and schema-ddl.
**Required**:
- Do not rewrite `custom.catalog-v2`, `custom.hub-v2`, `custom.set-v2`, or `custom.enumeration-v2` rows to built-in literals in `_mhb_objects.kind`, publication snapshots, or route params.
- Resolve legacy behavior through `config.compatibility.legacyObjectKind`, fallback `config.legacyObjectKind`, and known built-in V2 kind keys before falling back to literal `kind` checks.
- Scope hubs/sets/enumerations frontend query keys, API adapters, and optimistic cache updates by optional `kindKey`; legacy-compatible entity routes must not share unscoped caches with the legacy built-in pages.
- Runtime/publication/schema code must classify section, hub, set, enumeration, and catalog behavior through shared compatibility helpers instead of exact-kind branching.
- Compatibility helpers that promise the narrow `catalog | hub | set | enumeration | null` union must explicitly filter out `document` when the lower-level helper can return it.
- Keep focused regression coverage on scoped frontend query keys plus `SnapshotSerializer`, `runtimeRowsController`, `SchemaGenerator`, `diff`, and `SchemaMigrator` whenever this seam changes.
**Detection**: `rg "legacyObjectKind|custom\.(catalog|hub|set|enumeration)-v2|RUNTIME_LEGACY_COMPATIBLE_KIND_SQL|allSetsScope|allEnumerationsScope|getLegacyCompatibleObjectKindForKindKey" packages/metahubs-frontend packages/metahubs-backend packages/applications-backend packages/schema-ddl`
**Why**: The 2026-04-11 Entity V2 generalization closure found that route-level compatibility was not sufficient on its own. Custom V2 kinds only stay coherent when storage identity, scoped frontend caches, backend mutations, publication snapshots, runtime section filters, and schema-ddl classification all resolve the same legacy behavior from compatibility metadata instead of silently drifting back to exact built-in kind checks.
## Publication Executable Table-Name And Compatibility Propagation Pattern (IMPORTANT)
**Rule**: Publication-to-executable normalization must carry explicit table naming and legacy-compatible V2 metadata through the whole pipeline; applications-backend must not reconstruct physical table names or compatibility behavior from exact-kind defaults alone.
**Required**:
- `SnapshotSerializer` must preserve merged compatibility metadata for legacy-compatible custom V2 kinds in publication snapshots instead of flattening behavior back to built-in literal kinds.
- `publishedApplicationRuntimeSnapshot`, `publishedApplicationSnapshotEntities`, and release-bundle consumers must classify custom hub/set/enumeration-compatible rows through compatibility metadata or known V2 kind helpers instead of exact built-in `kind` checks.
- When a snapshot entity definition includes `tableName`, executable entity payloads must propagate it into `physicalTableName`; do not silently fall back to generated names for explicitly persisted tables.
- Shared contracts such as `SnapshotEntityDefinition` must declare optional `tableName` so full-build type checks stay aligned with the runtime payload seam.
- Keep focused regression coverage on `SnapshotSerializer` and `applicationReleaseBundle` whenever publication/runtime compatibility normalization changes.
**Detection**: `rg "tableName|physicalTableName|SnapshotEntityDefinition|publishedApplication(RuntimeSnapshot|SnapshotEntities)|legacyObjectKind" packages/metahubs-backend packages/applications-backend`
**Why**: The 2026-04-11 Entity V2 QA closure completion found that the upstream serializer merge fix was not sufficient on its own. Downstream applications-backend normalization still drifted on exact-kind checks and dropped explicit table names until the compatibility metadata and `tableName -> physicalTableName` contract were carried through the full publication-to-executable pipeline.
## Entities Workspace Live-Row Resolution And Namespaced i18n Pattern (IMPORTANT)
**Rule**: `EntitiesWorkspace` display and action handlers must resolve the current entity definition from live state and must tolerate built-in `namespace:key` UI labels coming through the consolidated metahubs namespace.
**Required**:
- Resolve action targets through the current entity-type map plus `kindKey` fallback; do not trust `row.raw` to exist on list/table rows when opening edit or delete flows.
- Keep the three-dots delete action aligned with the legacy danger-group contract so shared menu affordances remain consistent between `EntitiesWorkspace` and legacy Catalog surfaces.
- When a built-in entity type carries a `ui.nameKey` or `ui.descriptionKey` in `namespace:key` form, retry translation through an explicit namespace/key split before falling back to the raw string.
- Keep focused frontend coverage proving both seams: list-view actions still work when rows omit `raw`, and built-in Documents labels render localized text instead of raw translation keys.
**Detection**: `rg "resolveEntityTypeForAction|namespaceSeparatorIndex|documents.title|group: 'danger'" packages/metahubs-frontend/base/src/domains/entities`
**Why**: The 2026-04-11 post-rebuild QA closure found two real shipped-surface drifts that package builds alone did not catch: list-view menu actions could open a blank dialog when table rows omitted `raw`, and built-in Documents rows leaked `metahubs:documents.title` because the consolidated namespace path needed an explicit namespace/key fallback.

## Legacy-Compatible Entity Route Ownership Pattern (IMPORTANT)
**Rule**: Legacy-compatible entity authoring may reuse the mature legacy hub/catalog/set/enumeration UI components, but navigation must stay on the entity-based route tree whenever the current route carries `:kindKey`.
**Required**:
- Build hub/catalog/set/enumeration authoring links through shared route-aware helpers that prefer `/metahub/:metahubId/entities/:kindKey/...` paths over legacy `/hub|catalog|set|enumeration/...` paths whenever `kindKey` is present.
- Keep `HubList`, `CatalogList`, `SetList`, `EnumerationList`, `AttributeList`, `ElementList`, and the related pending-navigation/blocking-dialog flows aligned to those helpers so row links, tabs, and fallback navigation cannot drift between route trees.
- Register entity-owned nested routes for the hub scope (`hubs`, `catalogs`, `sets`, `enumerations`) plus hub-scoped catalog detail, top-level set detail, hub-scoped set detail, top-level enumeration detail, and hub-scoped enumeration detail.
- Extend breadcrumbs through the same contract: resolve legacy-compatible detail labels through `useHubName`, `useCatalogName(_Standalone)`, `useSetNameStandalone`, and `useEnumerationName` instead of assuming the generic custom-entity detail route applies to those ids.
- Recognize the known V2 kind keys (`custom.catalog-v2`, `custom.hub-v2`, `custom.set-v2`, `custom.enumeration-v2`) as legacy-compatible before entity-type metadata finishes loading so the page does not flash the generic entity shell first.
**Detection**: `rg "buildCatalogAuthoringPath|buildHubAuthoringPath|buildSetAuthoringPath|buildEnumerationAuthoringPath|entities/:kindKey/instance/:hubId/(hubs|catalogs|sets|enumerations)" packages/metahubs-frontend packages/universo-core-frontend packages/universo-template-mui`
**Why**: The 2026-04-10 Catalogs V2 isolation recovery established the durable rule for catalog-compatible routes, and the 2026-04-11 Entity V2 generalization closure extended the same route-ownership contract to hub/set/enumeration-compatible V2 kinds. The stable contract is legacy UI reuse under entity-route ownership, not legacy-route fallback or a second generic CRUD shell.
## Shared GeneralTabFields Explicit Label Pattern (IMPORTANT)
**Rule**: Every caller that mounts `GeneralTabFields` must pass explicit localized `nameLabel`, `descriptionLabel`, `codenameLabel`, and `codenameHelper` props from its own translation scope; do not rely on implicit defaults inside the shared field component.
**Required**:
- Treat `GeneralTabFields` as a presentational shell only: the caller owns visible copy and accessibility labels for all shared localized inputs.
- Keep legacy action builders (`CatalogActions`, `EnumerationActions`, `SetActions`) aligned with list/workspace call sites whenever `GeneralTabFields` prop requirements change.
- Preserve real browser coverage on legacy copy/edit flows that still target `getByLabel('Name')` / `getByLabel('Codename')`, because the current build stack can miss these stale JSX call-site mismatches until runtime.
- When visual proof compares catalog-compatible and legacy dialogs, compare only the actually shared edit surface (General panel plus shared affordances); whole-dialog edit equality is too strict because the entity shell intentionally adds extra edit-only affordances.
**Detection**: `rg "<GeneralTabFields|nameLabel=|descriptionLabel=|codenameLabel=|codenameHelper=" packages/metahubs-frontend/base/src tools/testing/e2e`
**Why**: The 2026-04-10 final parity verification found that stale legacy action call sites were still rendering `GeneralTabFields` without the explicit label props introduced by the shared-field refactor. The result was silent loss of accessible labels in the real browser copy dialog even though focused package builds still passed.
## Shared Template Shell Auth Client Pattern (IMPORTANT)
**Rule**: Shared route-bound shell queries inside `@universo/template-mui` must use the auth-aware client from `@universo/auth-frontend`, not raw `fetch` and not a feature-package-specific API client.
**Required**:
- Shared shell components should read `client` and `loading` from `useAuth()` and route typed resource loading through a small `client.get(...)` helper instead of duplicating ad-hoc request logic.
- Route-bound React Query hooks must gate request execution on both the required route params and `!authLoading` so shell queries do not fire before auth bootstrap completes.
- `@universo/template-mui` must remain domain-neutral: do not import metahub/application feature-package API clients into shared shell code just to avoid `fetch`.
- Keep focused regression coverage proving that `MenuContent` metahub detail and published-menu requests go through the authenticated client seam.
**Detection**: `rg "loadMenuResource|useAuth\(|client.get|fetch\(" packages/universo-template-mui/base/src/components/dashboard`
**Why**: The post-QA closure pass found that raw `fetch` in shared shell code bypassed the established auth/interceptor seam and weakened package boundaries. The durable fix is one shared auth-client pattern inside template-mui rather than per-domain request exceptions.
## Published Custom Entity Menu Contract Pattern (IMPORTANT)
**Rule**: The metahub shell must derive published custom-kind navigation from the existing entity-type list metadata plus the metahub-details permission seam; do not hardcode per-kind sidebar entries or bypass permission-aware filtering in the shell.
**Required**:
- Custom entity-type list responses must expose `published` so shell consumers can derive the dynamic menu zone without an extra metadata fetch contract.
- Shared template-mui menu entries must support either `titleKey` or a raw `title`, and all shared renderers must resolve labels through the same helper instead of assuming every item is translation-key-backed.
- `getMetahubMenuItems(...)` must filter authoring-only entries through `manageMetahub` / `manageMembers`, keep `Access` separately gated through `manageMembers`, and compact dividers after permission filtering.
- Published custom-kind links must be inserted after the legacy built-in object items and before `Publications`, `Migrations`, `Access`, and `Settings` so coexistence-first navigation stays stable.
- Browser coverage should target the sidebar link role explicitly when the same custom entity name can also appear inside the entities table.
**Detection**: `rg "published.*entity-types|resolveTemplateMenuLabel|getMetahubMenuItems|metahub-entity-" packages/metahubs-backend packages/universo-template-mui tools/testing/e2e`
**Why**: Phase 3.2 QA remediation showed that the durable contract spans backend metadata exposure, shared shell label resolution, permission-aware filtering, insertion order, and real browser navigation. Keeping it as one pattern reduces the chance that future snapshot/runtime work reintroduces hardcoded object menus or ambiguous browser proofs.
## Read-Only Entity Definition Access Pattern (IMPORTANT)
**Rule**: Entity-type definitions that back the shipped read-only entity surfaces must stay membership-readable, while entity-type writes remain gated by `manageMetahub`.
**Required**:
- `GET /metahub/:metahubId/entity-types` and `GET /metahub/:metahubId/entity-type/:entityTypeId` must rely on ordinary metahub membership access so read-only `EntitiesWorkspace` and `EntityInstanceList` shells can resolve their definitions.
- `POST`, `PATCH`, and `DELETE` entity-type routes must continue requiring `manageMetahub`; do not widen authoring mutations just because the read contract became member-readable.
- Frontend read-only entity surfaces may remain visible to members without `manageMetahub`, but create/edit/delete/instances affordances must stay hidden in that state.
- Keep focused backend route coverage and frontend read-only coverage in lockstep so mocked UI assumptions cannot drift from the backend authorization seam again.
**Detection**: `rg "entityTypesController|entity-type|manageMetahub|noManagePermission|EntityInstanceList" packages/metahubs-backend packages/metahubs-frontend`
**Why**: The post-parity QA pass found a real backend/frontend mismatch: the UI already exposed read-only entity shells to ordinary members, but backend entity-type reads still required `manageMetahub`, which caused 403s on the shipped surface. Preserving the membership-readable definition contract prevents future entity/runtime refactors from reintroducing that drift.
## Entity Authoring Visible Name Pattern (IMPORTANT)
**Rule**: Entity-type authoring lists must render a visible human-readable primary name and fall back to `kindKey`; the primary `Name` column must never render blank just because the stored display field is absent or derived from a translated builtin key.
**Required**:
- Build display rows through one helper that resolves builtin translation keys and custom names/codenames into a single visible `name` field.
- Render the primary list/table name cell explicitly with `row.name || row.kindKey` so newly created custom kinds stay visible immediately after save.
- Keep focused browser coverage asserting that the newly created custom entity type is visible by its display name on the shipped `EntitiesWorkspace` list surface.
**Detection**: `rg "buildEntityTypeDisplayRow|row.name \|\| row.kindKey|metahub-entities-workspace\.spec" packages/metahubs-frontend tools/testing/e2e`
**Why**: Phase 2.9 browser validation exposed a real product bug where the create flow persisted correctly but the list view appeared empty because the primary `Name` column rendered no text. The fallback-visible-name rule prevents that regression from reappearing.
## Structured Entity Builder Checkbox Accessibility Pattern (IMPORTANT)
**Rule**: Structured builder toggles in `EntitiesWorkspace` must render actual checkbox semantics, not aliased switch semantics, because the authoring contract and the focused validation stack both depend on checkbox roles.
**Required**:
- Use MUI `Checkbox` for authoring-tab toggles, the publish-to-menu control, and component toggles in the structured builder UI.
- Do not alias `Switch` as `Checkbox` or otherwise emit `role="switch"` for these multi-select authoring controls.
- Keep focused frontend coverage asserting checkbox roles for `Publish to dynamic menu`, authoring-tab toggles, and component toggles.
- Keep the workspace/publication Playwright proofs in the validation chain whenever the builder surface changes.
**Detection**: `rg "Publish to dynamic menu|Switch as Checkbox|<Checkbox|EntitiesWorkspace" packages/metahubs-frontend tools/testing/e2e`
**Why**: The restored builder UI still failed the browser and RTL proof until the runtime controls switched from aliased MUI `Switch` semantics to real `Checkbox` semantics. Preserving that accessibility contract reduces the chance that future builder refactors silently regress the validated surface.
## Reusable Entity Preset Template Registry Pattern (IMPORTANT)
**Rule**: Reusable cross-metahub entity presets must extend the existing metahub template registry/versioning flow through `definition_type='entity_type_preset'`; do not introduce a second preset store or a one-off preset transport.
**Required**:
- Persist reusable entity presets through the existing `cat_templates` + `doc_template_versions` seam and keep builtin seeding on the shared `TemplateSeeder` / migration-checksum path.
- Expose `definitionType` on template summaries and expose the typed `activeVersionManifest` on template detail responses so preset consumers can fetch active manifests without duplicating version-selection logic.
- Validate entity preset manifests through the shared template validator layer, including component dependency rules, instead of accepting untyped JSON in the entity authoring flow.
- Reuse the existing frontend templates query/UI seam (`useTemplates`, `useTemplateDetail`, `TemplateSelector`) and apply preset data as a create-mode form patch; preset selection must not silently mutate edit-mode entities.
**Detection**: `rg "entity_type_preset|activeVersionManifest|EntityTypePresetSelector|TemplateSeeder" packages/metahubs-backend packages/metahubs-frontend packages/universo-types`
**Why**: Phase 2.7b proved that the durable seam already existed in the template registry. Reusing it keeps preset versioning, validation, and seeding aligned with builtin templates instead of splitting metahub-wide reusable definitions across multiple storage models.
## Custom-Only Generic Entity Route Gating Pattern (IMPORTANT)
**Rule**: The first generic entity-instance CRUD surface must remain custom-kind-only until the coexistence compatibility layer proves that built-in catalogs/sets/enumerations can reuse the shared object foundation without bypassing their existing policy, copy, and runtime contracts.
**Required**:
- Resolve routed kinds through `EntityTypeResolver` and reject built-in kinds fail closed on the generic entity routes.
- Keep legacy built-in object routes as the source of truth until the later compatibility and service-genericization phases explicitly widen the shared surface.
- Let `MetahubObjectsService` accept generic kind strings and transaction runners so shared CRUD code can grow underneath legacy adapters without forcing an early route cutover.
- Keep focused route coverage proving both the custom-kind happy path and the built-in rejection path.
**Detection**: `rg "entityInstancesRoutes|Generic entity routes currently support custom entity kinds only|findByCodenameAndKind\(|updateObject\(" packages/metahubs-backend`
**Why**: The first Phase 2.5 implementation already has enough shared object plumbing to expose generic CRUD, but built-in design-time objects still have extra policy/copy/runtime behavior. Preserving the custom-only gate prevents the new routes from accidentally becoming a bypass around those legacy seams.
## Component-Gated Generic Entity Instance Tabs Pattern (IMPORTANT)
**Rule**: Generic custom-entity instance authoring must compose its dialog tabs from the resolved entity-type component manifest and reuse only the authoring seams that are already object-scoped; unsupported components must fail closed with an explicit notice instead of exposing a fake tab.
**Required**:
- Reuse one `EntityFormDialog` surface for create/edit/copy flows and build tabs from the resolved entity-type definition instead of hardcoding catalog-era assumptions into a second generic dialog stack.
- Show `hubs` only when `hubAssignment` is enabled and the entity UI requests the tab; show embedded `attributes` only in edit mode when `dataSchema` is enabled; show embedded `layout` only in edit mode when `layoutConfig` is enabled.
- Show `scripts` only in edit mode when `scripting` is enabled and the entity UI requests the tab; reuse `EntityScriptsTab` with the saved object id as the attachment owner.
- Show `actions` and `events` only in edit mode when the corresponding components are enabled; reuse the same dialog shell and existing object-scoped backend routes instead of inventing a second automation authoring surface.
- Keep catalog-compatible kinds on the reused `CatalogList` surface when the route already delegates there; do not widen the generic automation tabs onto catalog-compatible routes unless route ownership changes first.
- Keep create/copy dialogs intentionally smaller than edit dialogs: automation tabs depend on an already persisted object id and must not appear on unsaved entity flows.
- Preserve a distinct route and view-preference storage key for the instance surface and keep the primary in-product entry path in `EntitiesWorkspace` so type authoring and instance authoring remain separate concerns.
- Keep focused frontend coverage proving the create-vs-edit tab-composition contract, and keep browser proof on the generic custom-entity flow proving script → action → event-binding authoring end to end.
**Detection**: `rg "showScriptsUnavailableNotice|buildFormTabs|ENTITY_INSTANCE_DISPLAY_STYLE|entities.actions.instances|CatalogList|isCatalogCompatibleMode|EntityInstanceList" packages/metahubs-frontend packages/universo-core-frontend`
**Why**: Phase 3.1 established the component-gated dialog-composition seam, and the 2026-04-11 residual ECAE closure completed the object-scoped automation authoring surface on top of it. The durable contract is now edit-only Scripts/Actions/Events reuse on saved objects, not a temporary scripts-unavailable warning, and the same closure confirmed that catalog-compatible routes do not mount those generic tabs because they delegate to `CatalogList` first.
## Design-Time Child Copy And Object-Scoped System Attribute Pattern (IMPORTANT)
**Rule**: Reuse one shared helper for design-time child copy and one object-scoped system-attribute seam before widening any more built-in design-time routes onto the generic entity foundation.
**Required**:
- Keep `MetahubAttributesService` object-facing for new shared code through `listObjectSystemAttributes(...)`, `getObjectSystemFieldsSnapshot(...)`, and `ensureObjectSystemAttributes(...)`, while preserving catalog-named wrappers as compatibility aliases.
- Keep `listCatalogSystemAttributes(...)` / `getCatalogSystemFieldsSnapshot(...)` aligned with `listObjectSystemAttributes(...)` / `getObjectSystemFieldsSnapshot(...)` for the same object id; the legacy catalog wrappers are compatibility aliases, not a second policy interpretation.
- Route legacy catalog/set/enumeration copy flows through `copyDesignTimeObjectChildren(...)` for shared attribute/element/constant/value copy behavior instead of maintaining three separate controller-local copy implementations.
- Let generic custom-entity copy derive child-copy breadth from enabled design-time components (`dataSchema`, `predefinedElements`, `constants`, `enumerationValues`) instead of exposing built-in kinds or hardcoding per-kind copy branches.
- Keep legacy built-in routes authoritative even when they reuse the shared helper underneath; helper reuse is an internal seam, not a route-surface widening.
- When catalog copy needs `_upl_*` reseeding, pass the shared platform-system-attribute policy through the object-scoped adapter instead of reimplementing catalog-only policy logic in the helper.
**Detection**: `rg "copyDesignTimeObjectChildren|ensureObjectSystemAttributes|copyEnumerationValues|copyConstants" packages/metahubs-backend`
**Why**: Phase 2.5c showed that the safe genericization step was not broad layout/service renaming. The durable reusable seam is shared child-copy orchestration plus object-scoped policy reuse, and the later Phase 3.8 parity proof showed that the legacy wrapper reads must stay exact compatibility aliases instead of drifting into a second policy path.
## Legacy Built-in Compatibility Helper Pattern (IMPORTANT)
**Rule**: When legacy built-in catalog/set/enumeration routes begin sharing the generic object foundation, extract only the low-risk delete/detach/reorder control flow into internal helpers while keeping each legacy route responsible for its own policy checks, blocker lookups, and public HTTP contract.
**Required**:
- Keep legacy built-in routes authoritative even after helper extraction; shared helpers may orchestrate not-found, last-hub conflict, detach, reorder, blocker short-circuit, and final delete outcomes only.
- Pass kind-specific policy checks and blocker lookups into the helper layer as closures instead of hardcoding catalog/set/enumeration governance inside the helper itself.
- Preserve existing route-level response bodies/messages and optimistic-lock conflict mapping where a legacy route already exposes them.
- Limit helper reuse in this coexistence phase to safety-path behavior that is already structurally shared; wider service genericization stays a separate Phase 2.5c gate.
**Detection**: `rg "legacyBuiltinObjectCompatibility|executeBlockedDelete|executeHubScopedDelete|executeLegacyReorder" packages/metahubs-backend`
**Why**: Phase 2.5b proved that built-ins can reuse shared delete/detach/reorder flow beneath their legacy endpoints without opening a policy bypass. The helper-first pattern reduces duplication while keeping catalog/set/enumeration-specific governance and copy/runtime contracts intact.
## Catalog-Compatible Generic Mutation Parity Pattern (IMPORTANT)
**Rule**: When a custom entity kind explicitly opts into catalog compatibility, the generic entity-instance backend and frontend must reuse the legacy catalog ACL and policy seams instead of treating the surface as ordinary `manageMetahub`-only generic authoring.
**Required**:
- Resolve catalog-compatible kinds before mutation permission checks and map create/update/copy/restore/reorder to `editContent`, while delete/permanent-delete stay on `deleteContent`.
- Reuse the legacy catalog settings/policy gates for generic catalog-compatible copy/delete/permanent-delete flows, including `catalogs.allowCopy`, `catalogs.allowDelete`, and blocking-reference safety.
- Keep the generic entity routes custom-kind-only; catalog compatibility is a behavior/policy adapter, not permission to expose built-in kinds through the generic route surface.
- `EntityInstanceList` must mirror the same split on the frontend, respect catalog settings for action visibility, reuse `CatalogDeleteDialog` for blocked deletes, and fail closed while settings data is still loading.
- Preserve focused backend/frontend regressions for the negative paths so future refactors cannot silently reopen the parity drift.
**Detection**: `rg "catalogCompatibility|catalogs\\.allowCopy|catalogs\\.allowDelete|CatalogDeleteDialog|useEntityPermissions\('catalogs'\)|editContent|deleteContent" packages/metahubs-backend packages/metahubs-frontend`
**Why**: The 2026-04-10 QA closure found that catalog-compatible custom kinds had drifted from legacy catalog governance: the generic surface narrowed authoring to `manageMetahub` and bypassed legacy copy/delete safety. Locking the adapter contract preserves strict parity without reopening the generic built-in route gate.
## Legacy-Compatible Generic Delete Parity Pattern (IMPORTANT)
**Rule**: Generic custom-entity delete and permanent-delete flows for legacy-compatible kinds must reuse the same kind-specific safety behavior as the matching legacy controllers instead of preserving only catalog-compatible blocker handling.
**Required**:
- Build one compatibility-aware delete plan before generic `remove` / `permanentRemove`; do not branch ad hoc inside the final delete call.
- Catalog-compatible custom kinds must continue reusing legacy catalog settings and blocking-reference safety.
- Set-compatible custom kinds must reuse constant-reference blocker checks, and enumeration-compatible custom kinds must reuse attribute-reference blocker checks, before generic delete continues.
- Hub-compatible custom kinds must reuse the legacy hub blocker path and must remove hub associations from related objects before the final delete so generic delete cannot orphan nested relations.
- Shared hub delete helpers should stay reusable by both `hubsController` and the generic entity controller, and focused route regressions must cover blocked-delete plus hub-cleanup paths for compatible custom kinds.
**Detection**: `rg "buildLegacyCompatibleDeletePlan|findBlockingHubObjects|removeHubFromObjectAssociations|findSetReferenceBlockers|findReferenceBlockersByTarget" packages/metahubs-backend`
**Why**: The 2026-04-12 QA-gap closure found a real product regression: generic custom-entity delete had preserved the catalog-compatible branch but still bypassed the legacy Set/Enumeration/Hub delete safety contract. Centralizing a legacy-compatible delete plan closed that gap without widening generic routes onto built-in kinds.
## Generic Entity Deleted Detail Read Pattern (IMPORTANT)
**Rule**: Generic custom-entity detail reads must remain active-row-only by default; any flow that needs to inspect a soft-deleted row must opt in explicitly through `includeDeleted=true` instead of widening the default `GET /entity/:entityId` contract.
**Required**:
- Keep the default detail controller path calling `MetahubObjectsService.findById(metahubId, entityId, userId)` with no deleted-row widening.
- Parse `includeDeleted` as an explicit query flag and forward `{ includeDeleted: true }` to `findById(...)` only when a caller intentionally needs deleted-state visibility, such as restore or deleted-row verification flows.
- Preserve focused route coverage proving both seams: the legacy/default detail call shape and the explicit deleted-row path.
- Keep browser lifecycle proofs using the explicit deleted-read seam for soft-delete and restore polling; permanent-delete checks should continue asserting the default `404` contract.
**Detection**: `rg "includeDeleted|getById = async|findById\(metahubId, entityId, userId|metahub-entities-workspace\.spec" packages/metahubs-backend tools/testing/e2e`
**Why**: The 2026-04-10 generator/QA-gap closure exposed a real mismatch: the browser lifecycle proof needed to inspect soft-deleted catalog-compatible rows, but the default generic detail route correctly hid them. Preserving the explicit opt-in seam prevents future refactors from silently widening ordinary detail reads while still supporting deleted-state workflows.
## Generic Entity Copy Insert-Retry Pattern (IMPORTANT)
**Rule**: Generic custom-entity copy must preserve the legacy codename retry contract across the actual insert path, not only during preflight codename availability checks.
**Required**:
- When copy generates a codename automatically, retry `buildCodenameAttempt(...)` candidates across actual `createObject(...)` / `mutationService.run(...)` unique conflicts on `idx_mhb_objects_kind_codename_active`.
- Treat preflight `findByCodenameAndKind(...)` checks as an optimization only; they do not replace insert-time retry handling under concurrent copy races.
- User-supplied copy codenames still get a single final attempt and should fail closed with `409` if the same unique constraint fires after the preflight check.
- Keep focused route regressions for both retry-success and exhausted-retry paths so future refactors cannot collapse the behavior back to a single preflight-only check.
- Preserve the transaction-aware lifecycle split: retrying copy is safe because `before*` hooks execute inside the failed transaction and `after*` hooks run only after a successful commit.
**Detection**: `rg "buildCopyCodename|idx_mhb_objects_kind_codename_active|retries copy after codename unique violation|exhausting generated codename retries" packages/metahubs-backend`
**Why**: The 2026-04-10 residual QA hardening pass found that generic entity copy could still fail under concurrent codename races even though it prechecked availability. Matching the legacy insert-retry behavior removes that concurrency gap without widening built-in route exposure.
## Transaction-Aware ECAE Lifecycle Dispatch Pattern (IMPORTANT)
**Rule**: Generic entity lifecycle dispatch must stay split across transaction boundaries for create/update/delete/copy: `before*` events execute inside the mutation transaction, but `after*` events execute only after a successful commit.
**Required**:
- Keep object-owned Actions and Event Bindings behind component-manifest gates resolved from the entity-type definition for the owning object kind.
- `EntityMutationService` must call `EntityEventRouter` with the active transaction runner for `before*` hooks so validation or pre-write guards can fail the write atomically.
- Generic create must also route through `EntityMutationService`; resolve the committed object id from the mutation result before `afterCreate` dispatch instead of bypassing the lifecycle boundary with a direct controller/service call.
- When generic create allocates a pending object id ahead of persistence, that same id must become the persisted `_mhb_objects.id`; `beforeCreate` must never dispatch against a placeholder UUID that differs from the committed row id.
- `after*` hooks must run only after the transaction resolves successfully and must not be wrapped in a nested callback-based pseudo-commit abstraction.
- Event bindings must fail closed when they reference an action owned by a different object.
- Backend unit tests that exercise schema-qualified entity/action/event services must use canonical metahub schema names because shared identifier helpers reject ad-hoc fake schema strings.
**Detection**: `rg "EntityMutationService|EntityEventRouter|createEntity\(|createObject\(|_mhb_actions|_mhb_event_bindings|mhb_[a-z0-9]+_b1" packages/metahubs-backend`
**Why**: The first ECAE service pass proved that mixing post-commit dispatch into the transaction closure complicates typing and makes the lifecycle boundary harder to reason about. The 2026-04-11 QA-closure pass extended that same contract to generic create, and the subsequent PR #757 review triage closed the last id-drift seam by requiring preallocated create ids to become the persisted row id. The durable rule is explicit: pre-commit guards inside the transaction, post-commit side effects outside it, no controller-level bypass around `EntityMutationService`, and no placeholder create ids that diverge from the committed row.
## Routed Entity Move Ownership Pattern (IMPORTANT)
**Rule**: Any routed move/up-down mutation for design-time entities must verify routed-container ownership in both the controller and the service. A bare entity id is never sufficient when lists can surface merged shared rows or when a caller can submit foreign ids directly.
**Required**:
- The controller must load the entity first and return `404` unless it belongs to the routed catalog/set/enumeration before delegating to a move service.
- The service must still fail closed by querying the current row with `id + object_id + active-row` filters on the initial fetch and the final re-reads after normalization/swap logic.
- Preserve the same ownership contract across update, delete, reorder, and move seams so one mutation route cannot become looser than the others.
- Keep focused route regressions for foreign-container ids and shared-pool ids whenever a list can expose merged shared rows.
**Detection**: `rg "attribute/:attributeId/move|moveAttribute\(|constant/:constantId/move|moveValue\(" packages/metahubs-backend`
**Why**: QA found that the attribute move path accepted a routed catalog id plus a foreign/shared attribute id and could mutate sort order outside the intended container. Closing the controller seam alone was not enough; the service also has to distrust bare ids.
## Shared Container Read/Ensure Split Pattern (IMPORTANT)
**Rule**: Shared virtual container discovery must stay read-only; container creation belongs to an explicit ensure/write path.
**Required**:
- `GET /metahub/:metahubId/shared-containers` must return only already existing shared pool ids and must not lazily insert missing rows.
- Any authoring surface that needs concrete shared container ids up front, such as the Common page embedding shared Attributes / Constants / Values, must explicitly call the write path `POST /metahub/:metahubId/shared-containers/ensure`.
- Keep the ensure path idempotent and continue using `SharedContainerService.resolveAllContainerObjectIds(...)` there.
- Route coverage should prove that GET uses the read-only lookup while POST performs the explicit ensure.
**Detection**: `rg "shared-containers|ensureContainers|findAllContainerObjectIds|resolveAllContainerObjectIds" packages/metahubs-backend packages/metahubs-frontend`
**Why**: QA found that the original `GET /shared-containers` route was silently mutating metahub state by lazily creating missing virtual containers. Splitting read vs ensure paths removes the writeful-GET contract without breaking Common/shared authoring.
## Shared Entity Exclusions Save-Cycle Pattern (IMPORTANT)
**Rule**: Shared entity exclusion toggles in edit dialogs must behave like the rest of the entity form and commit only on the parent dialog save path.
**Required**:
- `SharedEntitySettingsFields` may read current overrides for initial state, but it must store checkbox edits in local form state instead of mutating override rows immediately.
- Shared attribute, constant, and enumeration value save handlers must sync only the changed `isExcluded` states after the entity save succeeds.
- When `sharedBehavior.canExclude` is turned off in the same dialog, trim unsavable newly added exclusions before save so the follow-up override sync cannot fail on new locked exclusions.
- Keep focused frontend helper/component coverage for the local state and diff-sync contract.
**Detection**: `rg "_sharedExcludedTargetIds|syncSharedEntityExclusions|SharedEntitySettingsFields" packages/metahubs-frontend`
**Why**: QA found that exclusion checkboxes were bypassing the dialog save/cancel lifecycle and persisting override rows immediately. Moving exclusions into form state restores expected dialog behavior and makes Cancel reliable again.
## Shared Entity Presentation/Exclusions IA Pattern (IMPORTANT)
**Rule**: Shared entity dialogs must keep shared behavior controls inside the existing `Presentation` tab and use a dedicated `Exclusions` tab only for target-selection behavior.
**Required**:
- Do not reintroduce a dedicated `Shared` tab for shared attributes, constants, or enumeration values.
- Keep the three shared behavior toggles rendered through `SharedEntitySettingsFields section='behavior'` under the existing `Presentation` tab.
- Render exclusions through `SharedEntitySettingsFields section='exclusions'` inside a dedicated `Exclusions` tab.
- Keep EN/RU tab labels and panel copy aligned so shared constants and values do not silently fall back to English labels.
- Update focused browser and component coverage whenever the tab structure changes so Common/shared authoring keeps matching the shipped information architecture.
**Detection**: `rg "section='behavior'|section='exclusions'|shared\.exclusions\.tab|tabs\.presentation" packages/metahubs-frontend tools/testing/e2e`
**Why**: The reopened Common/shared QA pass showed that the dedicated Shared tab and mixed inline behavior/exclusion controls no longer matched the intended authoring flow. Preserving the Presentation + Exclusions split reduces the chance of future dialog regressions.
## Embedded Common List Chrome Pattern (IMPORTANT)
**Rule**: Shell-less pages embedded under the Common tab shell must align their search/action controls to the right cluster and neutralize standalone-page spacing assumptions instead of relying on nested page chrome.
**Required**:
- Use `ViewHeader.controlsAlign='end'` for embedded Common list surfaces that do not own a standalone title region.
- Keep embedded list/table wrappers on explicit content-offset styles instead of reusing standalone negative-margin spacing inside the Common shell.
- Apply the shell-less alignment/offset seam consistently across Layouts, Attributes, Constants, and Values when `renderPageShell={false}` or equivalent embedded mode is active.
- Prefer the shared header/content seam over per-page CSS hacks so future Common tabs inherit the same layout contract.
**Detection**: `rg "controlsAlign|contentOffsetSx|renderPageShell" packages/metahubs-frontend packages/universo-template-mui`
**Why**: Post-import QA found that standalone list spacing leaked into the Common shell, leaving search/actions misaligned and some embedded surfaces horizontally overflowing. The shared alignment/offset contract fixes the root cause without reintroducing nested page shells.
## E2E Manifest Cleanup Best-Effort Discovery Pattern (IMPORTANT)
**Rule**: Browser-run cleanup should treat manifest-recorded resource ids as the primary teardown contract and search-based orphan discovery only as a best-effort augmentation.
**Required**:
- When the run manifest already contains explicit application or metahub ids, cleanup may continue using those ids even if search-based discovery endpoints fail during teardown.
- Search-based discovery warnings must not turn a green browser run into a failed finalization when the manifest already provides enough ids for deterministic cleanup.
- Keep the explicit manifest resources authoritative so successful runs remove `tools/testing/e2e/.artifacts/run-manifest.json` and do not emit runner-level `Manifest cleanup warning` noise.
- Preserve the separate full-reset path as the heavy recovery tool for truly incomplete or crashed runs.
**Detection**: `grep -n "Application discovery warning|Metahub discovery warning|Manifest cleanup warning" tools/testing/e2e/support/backend/e2eCleanup.mjs tools/testing/e2e/run-playwright-suite.mjs`
**Why**: The Common/shared Chromium flow was already functionally green, but finalization still failed because cleanup treated search-based orphan discovery as mandatory even when the manifest already had exact resource ids. Making discovery best-effort preserves deterministic teardown without widening product-code scope.
## Strict Full-Reset Finalization Pattern (IMPORTANT)
**Rule**: Wrapper-managed E2E runs in strict full-reset mode must not execute route-level manifest/API cleanup during finalization; the post-stop full reset is the only teardown authority in that lifecycle.
**Required**:
- When strict full-reset mode is enabled, `run-playwright-suite.mjs` should stop the owned server and then call the destructive full reset without first invoking `cleanupE2eRun()`.
- Keep manifest/API cleanup for non-strict or manual-debug flows where no authoritative full reset will run afterward.
- A green strict-mode tail should contain the test summary, normal server shutdown, and `[e2e-full-reset] Completed...`, not route-level delete/savepoint noise.
- Preserve the pre-start and post-stop full-reset lifecycle as the source of truth for project-empty E2E state.
**Detection**: `rg "cleanupE2eRun|runFullReset|fullResetEnabled" tools/testing/e2e/run-playwright-suite.mjs`
**Why**: QA proved that strict mode already removes all project-owned schemas, auth users, and local artifacts through the full reset. Running route-level delete APIs first only reintroduced false savepoint/RLS errors and noisy cleanup tails after otherwise green Playwright runs.
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
## Runtime Section Alias Compatibility Pattern (IMPORTANT)
**Rule**: The generic runtime wave must expose `section*` identifiers as the primary shared contract while keeping the legacy `catalog*` fields alive until the remaining builder/runtime surfaces are migrated.
**Required**:
- Return `section`, `sections`, and `activeSectionId` alongside `catalog`, `catalogs`, and `activeCatalogId` from runtime/backend responses instead of replacing the legacy fields in one pass.
- Accept optional `sectionId` in frontend/shared runtime helpers, query keys, adapters, and mutations, but continue resolving backend payload/query `catalogId` values from `sectionId ?? catalogId` until the backend route vocabulary can change safely.
- Prefer section identifiers in menu mapping, runtime selection state, and page-surface create/edit/copy flows whenever both alias families are present.
- Keep generic runtime copy and empty/fallback messaging section-oriented so new custom-type/runtime surfaces do not leak catalog-only wording.
**Detection**: `rg "sectionId \?\? catalogId|activeSectionId|sections|kind: 'section'|workspace limit for this section" packages/applications-backend packages/applications-frontend packages/apps-template-mui`
**Why**: Phase 3.5 genericization turned the runtime identifier contract into a cross-package compatibility seam: applications-backend still speaks catalog ids internally, while applications-frontend and apps-template-mui now need generic section terminology for custom entity/runtime work. Preserving both alias families reduces the chance that later builder/runtime phases break existing catalog flows or reintroduce catalog-only assumptions into the generic surface.
## Runtime Parent-Row Mutation Permission Pattern (IMPORTANT)
**Rule**: Runtime parent-row mutations must fail closed on the permission that matches the mutation type before any runtime catalog, attribute, or table query begins.
**Required**:
- Gate inline parent-row cell PATCH and bulk row PATCH through `editContent`.
- Gate create and copy flows through `createContent`, delete through `deleteContent`, and row reorder through `editContent`.
- Keep the permission check immediately after `resolveRuntimeSchema(...)` so denied requests do not touch runtime catalogs, attributes, or business tables.
- Preserve focused route coverage for the inline PATCH guard because the parent-row permission contract already differs between create/copy and delete.
**Detection**: `rg "updateCell = async|bulkUpdateRow = async|ensureRuntimePermission\(res, ctx, 'editContent'\)|runtime/rows/.*/copy|runtime/rows/reorder" packages/applications-backend`
**Why**: The post-closure QA follow-up found that inline runtime PATCH had drifted from the rest of the parent-row mutation surface and was missing the explicit `editContent` guard present on adjacent edit/delete/create/reorder flows. Locking the guard order reduces the chance that future runtime refactors reopen that controller inconsistency.
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
## Shared Entity Settings Storage Split Pattern (IMPORTANT)
**Rule**: Shared entity dialogs must reuse one frontend Shared settings component, but they must write `sharedBehavior` back through the entity-specific storage field that already owns the rest of the entity presentation config.
**Required**:
- Reuse `SharedEntitySettingsFields` for shared attributes, constants, and enumeration values instead of duplicating per-entity toggle/exclusion UIs.
- Persist shared attribute and constant settings through `uiConfig.sharedBehavior`.
- Persist shared enumeration value settings through `presentation.sharedBehavior` and keep the backend controller/service contract aligned so create/update/copy flows round-trip that field.
- Keep per-target exclusions on the shared override routes/hooks rather than embedding exclusion flags directly in entity payloads.
**Detection**: `rg "SharedEntitySettingsFields|storageField='uiConfig'|storageField='presentation'|presentation\.sharedBehavior" packages/metahubs-frontend packages/metahubs-backend`
**Why**: The shared dialog controls were intentionally unified across entity types, but enumeration values already store authoring presentation under `presentation` while attributes/constants use `uiConfig`. Preserving that split avoids a second configuration model while keeping one reusable Shared tab.
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
## Shared Snapshot V2 Runtime Materialization Pattern (IMPORTANT)
**Rule**: Shared design-time entities may be exported/imported as first-class snapshot sections, but runtime and schema-sync consumers must continue to see one flattened ordinary snapshot surface.
**Required**:
- Export shared attrs/constants/values plus shared override rows as dedicated snapshot v2 sections instead of copying them into local entity sections at authoring time.
- Materialize those shared sections through `SnapshotSerializer.materializeSharedEntitiesForRuntime(...)` before any runtime/schema consumer calls `deserializeSnapshot(...)` or `enrichDefinitionsWithSetConstants(...)`.
- When an applications-backend sync/release-bundle flow consumes the materialized runtime snapshot, compute `snapshotHash` from that materialized snapshot instead of reusing the stored raw publication snapshot hash; otherwise bundle validation can fail even when the publication itself is valid.
- Keep the raw publication snapshot available separately for integrity/history paths; do not overwrite the stored publication source with the runtime-materialized view.
- Snapshot import must recreate the three virtual shared containers and remap shared override rows to the restored target/shared entity ids.
- Treat the shared snapshot sections as optional during import/materialization so older snapshots without them remain valid.
**Detection**: `rg "materializeSharedEntitiesForRuntime|sharedAttributes|sharedConstants|sharedEnumerationValues|sharedEntityOverrides" packages/metahubs-backend packages/applications-backend`
**Why**: The shared-entity authoring model needs first-class snapshot fidelity, but the application runtime and DDL sync paths were already built around one flattened snapshot contract. Materializing shared sections at the publication/runtime seam preserves both requirements without inventing a second runtime model.
## Application Runtime Shared Identifier Scoping Pattern (IMPORTANT)
**Rule**: Applications-backend must scope any shared design-time identifiers that become duplicated across multiple runtime targets before browser diff, schema metadata sync, or runtime seed steps consume the publication runtime source.
**Required**:
- Repeated shared field ids materialized into multiple runtime entities must be remapped deterministically per target entity before `_app_attributes` metadata sync runs.
- Repeated shared enumeration value ids materialized into multiple runtime enumeration objects must be remapped deterministically per target object before `_app_values` sync runs.
- When enumeration value ids are remapped, predefined catalog-element REF payloads in the same normalized runtime snapshot must also rewrite their stored ids according to the field target enumeration object so seeded runtime data stays consistent.
- Browser diff and actual schema sync must consume the same normalized application sync context/entities instead of recomputing a divergent raw executable entity list in controller code.
**Detection**: `rg "publishedApplicationRuntimeSnapshot|createLoadPublishedApplicationSyncContext|Duplicate enumeration value id in snapshot|resolveExecutablePayloadEntities" packages/applications-backend`
**Why**: The imported self-hosted connector flow regressed twice on live data: first via duplicated shared field ids in `_app_attributes`, then via duplicated shared enumeration value ids in `_app_values`. The durable fix is to normalize the applications runtime source once at the boundary and keep diff/sync on that same scoped identifier contract.
## Request-Scoped Shared Override Runner Reuse Pattern (IMPORTANT)
**Rule**: Shared override mutation helpers must reuse an explicit caller runner inside request-scoped RLS routes and parent transactions instead of reopening nested savepoints for simple upserts.
**Required**:
- Shared override helpers such as `SharedEntityOverridesService.upsertOverride(...)` must accept an explicit `db` / `SqlQueryable` runner.
- Metahub request handlers already running on request-scoped executors should pass the request executor through that explicit runner seam.
- Parent mutation flows already inside `exec.transaction(...)` must pass their active `tx` into the shared override helper instead of falling back to the service-level executor.
- Keep focused regression coverage that proves the explicit-runner path does not call `exec.transaction()` again.
**Detection**: `rg "upsertOverride\(|db: exec|db: tx" packages/metahubs-backend`
**Why**: The final Common/shared closure exposed a real request-scoped RLS failure where reopening nested savepoints for shared override writes caused brittle transaction behavior during browser flows. Reusing the caller runner keeps request and parent-transaction lifetimes aligned.
## General/Common Shared Library Fail-Closed Pattern (IMPORTANT)
**Rule**: The shared-library scripting seam is valid only for `attachedToKind='general'` with `moduleRole='library'`; any new out-of-scope `library` authoring or non-library Common script authoring must fail closed at the backend service layer.
**Required**:
- Enforce the scope/module-role compatibility in `MetahubScriptsService` create and update paths, not only through frontend defaults.
- Reject `general` scripts whose persisted role is not `library` and reject new `library` scripts outside the Common/general scope.
- Preserve unchanged legacy out-of-scope rows only for no-scope-transition edits so source-only maintenance does not silently coerce old data into a new stored contract.
- Keep dependency-sensitive delete, codename-rename, and circular `@shared/*` failure modes covered by focused service tests and the shipped Common/shared browser flow.
**Detection**: `rg "assertScopeModuleRoleCompatibility|moduleRole.*library|attachedToKind.*general|@shared/" packages/metahubs-backend packages/metahubs-frontend tools/testing/e2e`
**Why**: QA found that the authoring UI already constrained Common/shared libraries correctly, but the backend still accepted illegal create/update combinations. The durable contract is server-side fail-closed validation plus regression coverage for dependency-sensitive shared-library failure modes.
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
**Rule**: Catalog layouts must expose inherited base-layout widgets as read-only config surfaces while gating inherited move/toggle/exclude overrides through the base widget `config.sharedBehavior` contract, and publication/runtime flows must flatten the merged result into ordinary layout/widget rows.
**Required**:
- Return `isInherited` for inherited catalog-layout widgets so the shared editor can distinguish inherited vs catalog-owned rows.
- Global/base layout widget editors must persist `sharedBehavior` inside widget `config`, including a generic behavior-only editor path for widgets without specialized config dialogs.
- Reject inherited widget config edits and direct reassignment at the backend service layer.
- Allow inherited remove/exclude, toggle, and move overrides only when `sharedBehavior.canExclude`, `sharedBehavior.canDeactivate`, and `!sharedBehavior.positionLocked` permit them; forbidden inherited override writes must fail closed server-side.
- Keep catalog-owned widgets in the existing `_mhb_widgets` table and store inherited-widget deltas only in `_mhb_catalog_widget_overrides`; do not add a runtime override table.
- Reuse `_mhb_catalog_widget_overrides.is_deleted_override` for inherited exclusion and ignore or clear stale forbidden override fields when the base widget now locks that behavior.
- Ignore inherited override config during snapshot export and application sync so inherited runtime widgets always materialize with base widget config.
**Detection**: `rg "isInherited|_mhb_catalog_widget_overrides|Inherited widgets cannot" packages/metahubs-backend packages/metahubs-frontend packages/applications-backend`
**Why**: The broader General/catalog-layout feature already shipped, but the inherited-widget contract regressed again once shared/global entity behavior work reached widgets. Preserving the sharedBehavior-gated override model prevents future layout refactors from silently reopening locked inherited controls or reintroducing runtime-config drift.
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
