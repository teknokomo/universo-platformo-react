# Research: Dashboard Complete Entity-Backed Widgets

-   **Created:** 2026-10-02
-   **Status:** QA-reviewed for PLAN handoff
-   **Trigger:** Additional RESEARCH pass over the QA-refined Manager brief before implementation planning
-   **Source brief:** QA-reviewed technical requirements brief (2026-10-01)
-   **Source request:** Original implementation request (2026-10-01)
    **Follow-up PLAN:** not started in this RESEARCH turn

## Research Question

Does the QA-refined Dashboard Entity-backed Widgets brief cover the complete current architecture and lifecycle of Dashboard layouts, or are there additional cross-package ownership, nesting, synchronization, authoring, runtime, template, and fixture constraints that must be made explicit before PLAN?

The research also asks which parts of the Marketing Page Entity-backed widget architecture are genuinely generic and should become the common source-managed widget infrastructure, which current Dashboard fields should remain presentation or host/runtime state, and whether the requested regeneration of every tracked file under `tools/fixtures/` is compatible with the repository's fixture contracts.

## Research Boundary

This is a read-only architecture investigation plus Memory Bank documentation. No product code, database schema, built-in template version, snapshot format version, or Manager brief was changed. The disposable development/test database and the user's clean-cutover instruction remain authoritative: there is no requirement to preserve legacy Dashboard payloads, dual reads/writes, old test data, or migration shims.

The inspected checkout was at commit `9bde9eac26a5fc1dfbaceb9ed95295458db8b773`. The worktree already contained unrelated edits in `AGENTS.md`, `CLAUDE.md`, `README.md`, and `README-RU.md`; this research did not modify or reset those files.

## Source Inventory

| Source                                                                                                       | Kind                            | Freshness           | Use in this research                                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Original implementation request (2026-10-01)                                                                 | user requirements               | 2026-10-01          | clean-cutover scope and fixture requirement                                        |
| QA-reviewed technical requirements brief (2026-10-01)                                                        | QA-refined requirements         | 2026-10-01          | primary architecture hypothesis being checked                                      |
| `memory-bank/research/marketing-page-complete-entity-backed-widgets-research-2026-09-27.md`                  | prior repository research       | 2026-09-27          | mature Entity-backed ownership, selector, lifecycle and UX baseline                |
| `memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md`              | prior repository research       | 2026-09-20          | neutral binding envelope and source-managed authoring baseline                     |
| `docs/en/architecture/entity-backed-widgets.md`, `docs/ru/architecture/entity-backed-widgets.md`             | current project architecture    | current checkout    | public source-of-truth contract for Entity-owned content and neutral bindings      |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                                     | project architecture skill      | current checkout    | metahub/application/workspace ownership and Entity-preset rules                    |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md`                                                            | UI architecture skill           | current checkout    | no raw IDs/JSON, reusable MUI primitives, authoring contract                       |
| `.agents/skills/runtime-ux-qa/SKILL.md`                                                                      | runtime QA skill                | current checkout    | browser UX acceptance boundary                                                     |
| `.agents/skills/ontoindex-code-intelligence/SKILL.md`                                                        | code-intelligence skill         | current checkout    | graph-navigation discipline and direct-source fallback                             |
| `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`                                        | source                          | current checkout    | registry asymmetry and generic definition capabilities                             |
| `packages/universo-react-types/src/common/applicationLayouts.ts`                                             | source                          | current checkout    | Dashboard config ownership and nested schemas                                      |
| `packages/universo-react-types/src/common/layoutEnvelope.ts`                                                 | source                          | current checkout    | neutral widget metadata/binding envelope                                           |
| `packages/universo-react-types/src/common/layoutWidgetPrimitives.ts`                                         | source                          | current checkout    | current logical placement vocabulary                                               |
| `packages/universo-react-types/src/common/metahubs.ts`                                                       | source                          | current checkout    | nested Dashboard widget types                                                      |
| `packages/universo-react-metahubs-backend/src/domains/layouts/widgetBindingService.ts`                       | source                          | current checkout    | binding API and overlay restrictions                                               |
| `packages/universo-react-metahubs-backend/src/domains/layouts/widgetBindingSchemas.ts`                       | source                          | current checkout    | source-discovery/provisioning request schemas are still Marketing-only             |
| `packages/universo-react-metahubs-backend/src/domains/layouts/widgetBindingValidation.ts`                    | source                          | current checkout    | discovery-definition validation is still Marketing-key/template constrained        |
| `packages/universo-react-metahubs-backend/src/domains/layouts/widgetBindingPolicyStore.ts`                   | source                          | current checkout    | binding deletion/integrity scan, including Marketing-only scoped-overlay SQL       |
| `packages/universo-react-metahubs-backend/src/domains/shared/layoutDefaults.ts`                              | source                          | current checkout    | canonical Dashboard seed and `show*` derivation                                    |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/*.template.ts`                          | source                          | current checkout    | built-in Dashboard consumers and specialized seeds                                 |
| `packages/universo-react-applications-backend/src/services/applicationLayoutWidgetSourceState.ts`            | source                          | current checkout    | sync/source-baseline semantics                                                     |
| `packages/universo-react-applications-backend/src/services/effectiveLayoutResolver.ts`                       | source                          | current checkout    | effective-layout and overlay binding inheritance                                   |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutEntityBindingPolicy.ts`       | source                          | current checkout    | source removal/copy policy for required Entity-backed widgets                      |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`              | source                          | current checkout    | application widget decoding/source-binding attachment and inherited-binding policy |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutPublishedWidgetProjection.ts` | source                          | current checkout    | persisted published-widget projection used by application sync                     |
| `packages/universo-react-applications-backend/src/services/marketingSeedGuard.ts`                            | source                          | current checkout    | Marketing-specific public source discovery and row-limit policy                    |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutWidgetsStore.ts`              | source                          | current checkout    | application edit/reset paths and residual Marketing conditions                     |
| `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/*`                                         | source                          | current checkout    | split Marketing/generic/Dashboard authoring                                        |
| `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`                             | source                          | current checkout    | Marketing-specific application source-managed gating                               |
| `packages/universo-react-apps-template-mui/src/dashboard/*`                                                  | source                          | current checkout    | runtime fallbacks, demo data and host composition                                  |
| `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`                                  | source                          | current checkout    | route-specific `show*` overrides                                                   |
| `tools/testing/e2e/README.md`, generators, fixture contracts                                                 | source/test documentation       | current checkout    | canonical persistent-fixture producers and drift gates                             |
| `tools/testing/e2e/support/mmoommScriptAssetsProof.ts`                                                       | source/test contract            | current checkout    | immutable MMOOMM historical baseline semantics                                     |
| `.backup/templates/dashboard`                                                                                | local upstream visual reference | repository snapshot | exact Dashboard visual/component provenance                                        |
| Context7 `/mui/material-ui/v9.2.0`                                                                           | current library documentation   | queried 2026-10-02  | MUI composition/accessibility reference                                            |
| Context7 `/mui/mui-x`                                                                                        | current library documentation   | queried 2026-10-02  | centralized Data Source architecture reference                                     |
| `https://react.dev/learn/sharing-state-between-components`                                                   | React primary documentation     | checked 2026-10-02  | single-source-of-truth principle                                                   |
| `https://mui.com/material-ui/getting-started/templates/`                                                     | MUI primary documentation       | checked 2026-10-02  | Dashboard template intent and reusable sections                                    |
| `https://mui.com/x/react-data-grid/server-side-data/`                                                        | MUI X primary documentation     | checked 2026-10-02  | server-side Data Source abstraction                                                |

OntoIndex semantic search was used to locate source-state, effective-layout, binding-policy and sync symbols. Its index reported degraded enrichment and two files outside scan-size limits, so direct source inspection is authoritative for the conclusions below. Two delegated read-only reviews were requested: the backend lifecycle review completed and its findings were re-checked against source; the second delegated environment could not obtain a valid local Codex session and contributed no evidence. No delegated result is treated as a pass unless it is independently verifiable from source.

## QA Follow-up Verdict

**Verdict:** pass after same-day corrections.

The original research direction, ownership model, template inventory, nested-composition diagnosis, clean-cutover boundary and fixture-baseline exception remain valid. The QA pass found two material omissions and one documentation precision issue, all corrected in this artifact:

-   the Marketing-specific binding lifecycle extends beyond the services named in the first pass into request schemas/discovery validation, application widget decoding, published-widget projection and a scoped binding-integrity SQL branch;
-   Dashboard duplication needs an explicit registry-driven `none | share-bindings | clone-record` decision, including the existing atomic clone-record + placement path and nested subtree semantics;
-   the dependency statement now distinguishes the exact local pins (`@mui/material` 9.2.0 and MUI X 9.8.0) from current MUI X documentation used only as architectural evidence where Context7 has no exact 9.8.0 selector.

No new research blocker was found. The remaining unresolved items are PLAN decisions, not missing external evidence.

## Key Findings

### 1. The brief's ownership invariant is correct, but the implementation scope is wider than the visible Dashboard widgets

The strongest reusable decision from the completed Marketing work remains valid:

> Entities own durable editorial/domain content; widget placements own composition and presentation; registry definitions own binding, authoring and renderer contracts.

Current Dashboard code violates that invariant in several independent ways, not only in stock cards and charts. Durable copy and data-source identity exist in widget renderer config; child widget instances exist inside parent config; application and metahub code derive `show*` booleans from placements and persist/use them as another vocabulary; runtime components still create fallback composition; application sync/source-state code contains template-specific Entity-binding rules; and specialized Dashboard templates directly author the old payload shapes.

PLAN therefore must treat the change as a cross-stack contract cutover covering shared types, metahub layout/binding services, publication/snapshot transport, application sync/source state, effective layout, both authoring frontends, the isolated runtime renderer, built-in templates, fixture producers and tests. Refactoring only `apps-template-mui` or `layoutDefaults.ts` would leave multiple competing ownership models alive.

### 2. Dashboard registry definitions are not yet equivalent to the Marketing source-managed contract

`LayoutWidgetDefinition` already supports the right neutral concepts: `bindingSlots`, `initialBindingSlotKey`, `presentationFields`, `authoring`, `bindingVariants`, host capabilities, allowed zones and multiplicity. Marketing definitions populate those capabilities from their contracts. Dashboard definitions are still primarily mechanical projections of `DASHBOARD_LAYOUT_WIDGETS` with zones, multiplicity and host support.

This makes the registry itself a viable convergence point: the project does not need a new Dashboard binding model. The implementation should classify every retained Dashboard widget and populate the existing neutral definition contract. Widget-key conditionals should be reserved for genuinely specialized behavior that cannot be described declaratively.

The classification must be field-level rather than widget-level. A single widget can legitimately combine an Entity binding, presentation fields and host/runtime behavior.

### 3. The current metahub binding service is still Marketing-only at important API boundaries

The strongest new backend finding is in `packages/universo-react-metahubs-backend/src/domains/layouts/widgetBindingService.ts`.

The internal validation logic is already largely definition-driven: it enumerates registry `bindingSlots`, validates cardinality, validates Components/capabilities, validates records, and validates relation slots. However, multiple public source-authoring operations still declare `templateKey: 'marketing-page'`, including source discovery, source provisioning and semantic-record discovery. `assertBasePlacementOwnsMarketingBindings()` also applies overlay binding inheritance only when the template is Marketing Page.

Consequently, simply adding Dashboard `bindingSlots` would not make Dashboard authoring work. Before or as the first implementation phase, the service boundary must become template-neutral and capability-driven. The generic rule is not “Marketing overlays inherit bindings”; it is “source-managed inherited placements whose definition/application policy makes the base source authoritative cannot introduce a second binding authority.”

This genericization should preserve Marketing-only policy where it is truly Marketing-specific. For example, `marketingSeedGuard.ts` contains public Marketing runtime row-count and semantic-key restrictions. Those limits should not be renamed into generic Dashboard policy unless the corresponding public Dashboard runtime has the same bounded-read contract. Shared binding integrity and source discovery should be generalized; product-specific public-data limits should remain product-specific.

### 4. Application source-state and effective-layout logic also encode Marketing by template identity

`applicationLayoutWidgetSourceState.ts`, `effectiveLayoutResolver.ts`, `applicationLayoutWidgetsStore.ts` and `applicationLayoutEntityBindingPolicy.ts` have generic-looking source-baseline infrastructure, but overlay binding inheritance is still selected through conditions such as `templateKey === 'marketing-page' && sourceBaseWidgetId != null`.

`effectiveLayoutResolver.ts` has a dedicated `attachValidatedMarketingOverlayBindings()` stage. The source-state code rejects bindings in Marketing inherited overlay configs, strips them from those configs, and compares binding baselines differently for non-inherited widgets. `applicationLayoutEntityBindingPolicy.ts` is partly generic—the decision that a widget has required Entity-backed bindings comes from registry `authoring.application.presentationOnly` plus required slots—but persisted overlay handling still special-cases Marketing.

Dashboard source-managed widgets need the same source ownership semantics. PLAN should generalize these concepts around the widget definition and placement lineage, then keep template-specific rules only where the data lifecycle is genuinely different. The change must cover:

-   source baseline creation and update;
-   synchronization and preservation of local presentation changes;
-   reset to source;
-   effective overlay materialization;
-   source-layout removal and copy/fork policy;
-   semantic hashing/conflict detection;
-   publication/snapshot transport;
-   application CRUD restrictions;
-   stale/deleted binding targets;
-   scoped layout inheritance.

The implementation should not introduce a second `Dashboard*BindingService` or Dashboard-only source-state branch. That would reproduce the divergence the refactor is meant to remove.

The same issue appears in application sync comparison. `syncLayoutPersistence.ts::buildComparableWidget()` decides whether a widget may carry a sparse inherited binding envelope through `templateKey === 'marketing-page' && source_base_widget_id !== null`. A Dashboard overlay with the same source lineage would therefore be compared under a different binding rule and can produce false drift or force duplicated bindings. Source-state resolution, sync comparison, effective-layout binding attachment, reset and source-removal policy should all call one neutral ownership/inheritance classifier rather than reimplementing this condition separately.

### 4a. Snapshot export is already partly generic, but deep transport validation remains Marketing-specific

There is a useful positive baseline in `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`. Export of ordinary layout widgets decodes and re-encodes every template's widget with `requireBindings: true`. Export of scoped widget overrides decodes with `requireBindings: false` and rejects any override whose neutral metadata contains Entity bindings. This is already the desired generic rule: base/source placements carry required bindings; sparse scoped overrides cannot become a second binding authority.

The deeper validation path is less generic. `packages/universo-react-utils/src/validation/marketingSnapshot.ts::validateMarketingSnapshotLayouts()` explicitly states that Dashboard payloads return without the Marketing-specific contract. It performs some generic Dashboard override-lineage checks, but the complete binding/content validation remains Marketing-owned. Application sync calls `validateMarketingSnapshotTransportLayouts()` in multiple write paths.

PLAN should split the current validator conceptually into two layers:

-   a template-neutral Entity-backed layout transport validator driven by registry slots/ownership, validating binding completeness, base/overlay authority, allowed zones, composition lineage and neutral metadata for any source-managed widget;
-   Marketing-specific content/record/action validation that remains Marketing-specific.

This allows Dashboard to reuse the proven snapshot/export invariants without importing Marketing record schemas or public-content rules.

### 4b. Semantic hashing is a positive reusable baseline; runtime binding projection is not yet generic

`applicationLayoutHash.ts` already chooses semantic bindings from trusted source-binding state, then `sourceConfig`, and only falls back to the current widget envelope when no source lineage exists. Physical row IDs, lineage IDs and optimistic versions are deliberately excluded from the semantic hash. This design should be preserved and extended to any new nested parent/slot semantic relationship.

The missing piece is a generic Dashboard runtime consumer. Trusted source bindings are attached to application widgets as hidden/non-enumerable state and are currently consumed by hashing and Marketing runtime/action code. Dashboard does not yet have a common pipeline that turns effective widget + trusted binding state into a strict typed, allowlisted runtime DTO.

The preferred architecture is one shared backend projection boundary: effective placement → trusted binding state → generic binding resolver with an authorized loader → widget-specific typed DTO adapter. `apps-template-mui` receives only that DTO. It should never receive raw binding envelopes, Entity table/schema details or internal record identifiers merely to resolve data itself.

### 4c. The Marketing-only boundary is wider than the service layer: request schemas, application decoding and published projection also require genericization

The QA follow-up found three additional hard boundaries that the first research pass did not name explicitly.

First, `widgetBindingSchemas.ts` does not merely pass a Marketing template key through to an otherwise generic service. `discoveryPageInputShape` and `provisionSourceInputSchema` use `z.literal('marketing-page')`, and the discovery schemas use `marketingWidgetKeySchema` plus `marketingCollectionVariantSchema`. `widgetBindingValidation.ts::discoveryDefinition()` is likewise typed to `MarketingWidgetKey` and explicitly requires a Marketing definition. Dashboard registry `bindingSlots` therefore cannot become authorable by only generalizing `WidgetBindingService`; the HTTP/input contract and discovery-definition resolver must also become registry-driven while keeping Marketing collection variants as a Marketing-specific extension.

Second, `applicationLayoutStoreSupport.ts::mapWidget()` independently computes `inheritsMarketingBindings` from `templateKey === 'marketing-page' && source_base_widget_id != null`. This function is used by normal application layout reads as well as sync/runtime helpers, so it is another source of truth for whether an inherited widget may omit bindings in `config`/`source_config`. Dashboard inherited source-managed placements would otherwise be decoded under a different rule from Marketing.

Third, `applicationLayoutPublishedWidgetProjection.ts::projectPersistedPublishedWidgets()` repeats the same Marketing-only inheritance test while producing the persisted published-widget projection consumed by `applicationLayoutSyncStore.ts`. Without generalization, a Dashboard overlay that intentionally inherits its source bindings can be rejected for missing bindings or be forced to duplicate bindings during publication/sync projection.

`widgetBindingPolicyStore.ts::hasLiveEntityBinding()` also deserves explicit review. Its base-widget scan is template-neutral, but the scoped-override branch is filtered to `layout.template_key = 'marketing-page'`. That is a policy asymmetry that should be expressed through the same neutral binding-ownership classifier when Dashboard gains source-managed overlays. The current source does not prove an immediate Dashboard deletion bug because base-widget bindings are already included by the first branch; the requirement is to remove the template-specific integrity rule so future overlay/storage changes cannot silently diverge.

### 5. `columnsContainer` and `detailsTabs` require a new canonical composition relationship; the current neutral placement model cannot represent nesting

The current nested-storage problem is concrete. `ColumnsContainerColumn.widgets` and `DetailsTabsTab.widgets` contain child widget identity, key, order, active state and arbitrary config inside the parent's renderer config. The runtime converts these embedded objects into synthetic widget items and recursively renders them. Those synthetic children do not naturally participate as first-class placements in source baselines, binding lifecycle, effective-layout lineage, semantic hashes, application reset/sync or normal authoring operations.

The neutral envelope cannot currently absorb this structure without an explicit model change. `layoutWidgetPrimitives.ts` defines logical placement only as `start | end`; widget neutral metadata contains only `placement` and `bindings`. There is no parent/container/slot relation.

The recommended direction is therefore a true canonical child-placement relationship:

-   a nested child remains a normal persisted widget placement with its own stable server-owned identity, widget key, renderer config, neutral bindings, active state and order;
-   a separate neutral composition reference associates the child with a parent placement and a semantic slot key;
-   the parent renderer config keeps only presentation of its slots/structure, such as column widths or localized tab labels when those values are presentation-only;
-   allowed nesting, container capability, slot existence, cycles, self-parenting and incompatible child types are validated before persistence;
-   Add/Move/Reorder/Duplicate/Delete operate on normal placements and preserve their binding/source-state lifecycle;
-   effective-layout resolution, hashing, snapshots, publication and application sync include the parent/slot relationship deterministically.

The exact physical representation is a PLAN decision. A raw parent UUID should not become portable snapshot semantics or a user-visible field. If database rows use physical IDs, export/import must remap them or snapshots should carry a stable semantic relationship that is resolved during materialization. `source_base_widget_id` must not be overloaded for nesting because it already represents inheritance/source lineage, a different lifecycle concern.

For `detailsTabs`, the tab itself is best treated as a structural semantic slot unless future requirements give tabs their own durable content lifecycle. Localized tab labels and order can remain parent presentation metadata; child placements point at the stable tab slot key. The final model must make this explicit in PLAN rather than reintroducing nested widget JSON under another name.

### 6. Removing `show*` is a coordinated storage/runtime cutover, not a local cleanup

Dashboard visibility is currently represented twice. Active placements exist, while `layoutDefaults.ts`, application sync helpers and `applicationLayoutWidgetsStore.ts` derive and/or persist fields such as `showSideMenu`, `showRightSideMenu`, `showHeader`, `showBreadcrumbs`, `showSearch`, `showOverviewCards`, chart/detail/table flags and `showFooter`.

The runtime still consumes those booleans. `Dashboard.tsx` falls back to `layout.showSideMenu` when persisted left composition is absent, combines `showRightSideMenu` with right-zone contents, and carries a deprecated menu input. `MainGrid.tsx` can synthesize pseudo-items and direct components from booleans when placements are absent. `DashboardApp.tsx` overlays `WORKSPACE_ROUTE_LAYOUT_OVERRIDES` to turn several sections off on workspace routes.

The clean cutover must remove the second authority end-to-end. Presence/order/activity of persisted/effective placements decides composition. Host capabilities can still decide whether an affordance is operational, but they should not silently reconstruct an alternate layout. Workspace-route differences should be expressed as canonical effective composition or an explicit host-projection contract rather than a private `show*` override object.

### 7. Runtime-generated workspace navigation needs an explicit host-projection contract

`Dashboard.tsx` currently injects a `workspaceSwitcher`, a divider and a fallback `menuWidget` at runtime when workspace support is enabled and matching placements are absent. This makes runtime code a hidden third composition author alongside the metahub/application layout stores.

The refactor should distinguish two cases:

1. **Manual/editorial navigation** — user-authored menu sections/links/titles have a durable lifecycle and should be source-managed/Entity-backed where appropriate.
2. **Generated workspace/session navigation** — workspace switcher and other authenticated host-derived controls are host capabilities. They should consume host DTO/state and remain Entity-free.

For host-derived controls, choose one explicit model: canonical seeded placements fed by host data, or registry-declared host projections with deterministic read-only placement identity. Whichever model is chosen, metahub/application authoring and the renderer must agree that it exists; the renderer should not silently invent it only at mount time.

### 8. Stock MUI demo content must be classified as retain/replace/retire, not automatically migrated to Entities

The current Dashboard still contains upstream demo semantics. Examples found in source include the default stat-card values/series, `HighlightedCard`, the hard-coded Sitemark selector/product menu, plan-expiration alert copy, Website/Store/Product tree nodes, country chart values and an old fixed date initialization.

Moving every demo constant into an Object would preserve demo baggage rather than complete the platform architecture. The per-widget matrix must make an explicit product decision:

-   retain as a real generic platform widget with a legitimate Entity/runtime source;
-   retain as a host/system control with no Entity source;
-   retain only its presentation primitive and remove demo content;
-   retire the stock widget from the Dashboard registry if it has no real platform role.

The original MUI template should remain the visual/composition reference, not the business-data model. MUI's current template documentation explicitly presents the Dashboard as a reusable starter/data-visualization template whose sections can be extracted and reused; it does not imply that its sample data should remain application state.

### 9. Dashboard renderer config needs a field ownership taxonomy before any schema rewrite

The current configs mix several fundamentally different concerns. PLAN should freeze an ownership decision for every persisted field using this taxonomy:

1. **Durable editorial/domain content** → Entity record(s) in the metahub or workspace according to lifecycle.
2. **Semantic source identity/query target** → neutral binding slot and bounded selector declared by the registry.
3. **Presentation behavior** → renderer config declared by registry `presentationFields` or another serializable presentation contract.
4. **Composition/placement** → canonical placement row and neutral composition relationship.
5. **Host/runtime state** → host context/runtime DTO, never copied into authored content.
6. **Specialized runtime source** → a typed manifest/report/module/engine contract when an Entity binding would be artificial.
7. **Obsolete MUI demo state** → delete/retire.

This is especially important for `detailsTable`, `relationBuilder`, `learnerPlayer`, `resourcePreview`, `quizWidget`, `playcanvasCanvas`, and `interpretationNetworkWorkspace`. Their entire configs should not be moved into generic Objects. Source identity may become a binding while operations, renderer modes, module methods, reports, workflows, column presentation, PlayCanvas project/scene manifest and other behavior stay with their natural owner.

### 10. Generic table/chart data should use a bounded server-owned source abstraction, not a client query language

The existing neutral binding vocabulary (`semantic-key`, `record-set`, `relation-set`) is a better baseline than Dashboard-specific `datasource` objects carrying increasingly expressive source/query behavior in renderer config. If a new selector is required, it should represent a semantic capability that the server can validate and resolve, not expose physical schema/table/column identifiers, SQL, arbitrary filters or client-defined mapping code.

React's primary documentation recommends one source of truth for each unique piece of state instead of duplicating shared state. MUI X's Data Source documentation uses the same architectural direction for server-side grid data: a centralized interface separates the grid from server fetching, filtering, sorting and pagination. This is a useful design analogy for Platformo even where the exact MUI X API is not used.

The repository pins MUI X 9.8.0. Context7's MUI X index did not expose an exact 9.8.0 version selector in this session, so its current Data Source documentation is evidence for the abstraction pattern only. Implementation must verify any concrete MUI X API against the locally installed 9.8.0 package or exact v9 documentation before coding.

### 11. Both authoring frontends still identify source-managed behavior as Marketing-specific

The metahub frontend has a generic `useLayoutWidgetAuthoring` shell, but it delegates Entity-backed flows into `useMarketingLayoutWidgetAuthoring` and exposes Marketing-specific editor state/functions. Dashboard widgets then use widget-key conditionals for menu, columns, quiz, PlayCanvas and other editors.

The Application layout page similarly computes `isSourceManagedMarketingWidget`, and uses it to decide Add, Edit, Duplicate and Reset-to-source behavior even though the registry already has generic `authoring.application` metadata and `presentationFields`.

Dashboard should not be bolted onto these branches. The common authoring controller should decide source-managed behavior from the widget definition:

-   whether bindings exist;
-   which slots/variants/cardinalities apply;
-   whether the Application surface is presentation-only;
-   whether Add/Duplicate/Rebind/Reset are permitted;
-   which presentation fields are editable;
-   which source picker/provisioning capabilities are available.

Specialized editors remain valid for genuinely specialized runtime behavior, but the Entity/reference/source picker and source ownership mechanics should be one neutral implementation. UI must keep source and placement identities server-owned and display localized semantic labels rather than UUIDs/codenames requiring hidden knowledge.

### 11a. Duplicate semantics are already a first-class registry contract, but the atomic clone path is Marketing-specific

The shared authoring contract already distinguishes `duplicate: 'none' | 'share-bindings' | 'clone-record'`. Marketing uses that metadata end to end: the frontend can request an atomic record-copy placement flow, while `marketingWidgetRecordDuplicateController.ts` and `marketingWidgetRecordDuplicate.ts` clone the selected semantic record and create the placement as one backend operation.

Dashboard conversion must therefore classify duplicate semantics per retained source-managed widget instead of treating Duplicate as a generic config copy. A Dashboard widget that should point to the same source uses `share-bindings`; a widget whose product semantics require independent authored content may use `clone-record`; some widgets should disable duplication. If any Dashboard definition selects `clone-record`, the atomic record-copy-and-place capability should be generalized behind registry metadata rather than copied into a Dashboard-specific controller/service. Nested structural duplication also needs a deterministic subtree rule so duplicating `columnsContainer`/`detailsTabs` does not accidentally clone Entity records whose registry contract says to share bindings.

### 12. The built-in Dashboard template impact is larger than the brief's short example list

Current source shows Dashboard layouts in at least:

-   `basic.template.ts`;
-   `basic-demo.template.ts`;
-   `empty.template.ts`;
-   `one-c-compatible.template.ts`;
-   `lms.template.ts`;
-   `interpretation-network.template.ts`;
-   `playcanvas.template.ts`.

`basic-demo.template.ts` explicitly relies on the old nested-container behavior by suppressing standalone `detailsTable` because its demo `columnsContainer` embeds `detailsTable + productTree`. LMS has both `columnsContainer` and `detailsTabs` nested configurations and many scoped Dashboard layouts. These are direct consumers of the cutover, not incidental tests.

PLAN must enumerate every `templateKey: 'dashboard'` built-in manifest and every helper that derives from `DEFAULT_DASHBOARD_ZONE_WIDGETS` or `buildBasicMinimalSeedZoneWidgets()`. Basic and Empty should remain structurally valid without becoming demo-heavy. Basic Demo can seed sample Entity records. Specialized templates should compose the same generic placement/binding primitives and keep only legitimate domain-specific runtime settings.

### 13. The requested fixture work contains one important exception: the MMOOMM pre-extraction baseline is deliberately immutable

Six files under `tools/fixtures/` are application/metahub snapshot configurations with canonical E2E producers/contracts:

1. `metahubs-73rd-meridian-app-snapshot.json`
2. `metahubs-interpretation-network-app-snapshot.json`
3. `metahubs-lms-app-snapshot.json`
4. `metahubs-mmoomm-app-snapshot.json`
5. `metahubs-quiz-app-snapshot.json`
6. `metahubs-self-hosted-app-snapshot.json`

Those should be regenerated/rebased from their canonical export/generator flows after the final clean architecture and checked with their contract/drift/runtime gates.

The seventh tracked JSON file, `mmoomm-runtime-pre-extraction-baseline.json`, is different. `mmoommScriptAssetsProof.ts` documents it as an **immutable pre-extraction runtime trace**. The loader validates its historical commit, source path and source SHA-256 and intentionally fails if the baseline is missing, malformed or accidentally regenerated, because regenerating it from the current runtime would weaken a historical current-versus-old parity proof into a current-versus-current comparison.

Therefore the original user requirement to regenerate configuration files should be interpreted by artifact semantics, not by folder glob:

-   regenerate the six configuration/snapshot fixtures;
-   keep the historical MMOOMM parity baseline unchanged and prove the final runtime still passes against it;
-   replace/regenerate that baseline only if a separate, explicit product/testing decision intentionally retires or re-baselines the historical parity contract, with a documented capture process and provenance.

This is a required correction to the Manager brief's broad wording that all seven tracked files should be regenerated.

### 14. Exact visual preservation and data ownership are compatible goals

The repository pins Material UI 9.2.0 and MUI X 9.8.0, while `.backup/templates/dashboard` preserves the local upstream Dashboard reference used by the project. MUI's current template documentation describes the Dashboard as a complex data-visualization starter using MUI X Data Grid and Charts, with layout sections intentionally reusable/extractable.

The cutover therefore does not require redesigning the shell. It should preserve reference-sensitive geometry and responsive composition while changing where data and composition authority come from. Existing MUI primitives should continue to drive Grid/Stack/Dialog/form behavior. Semantic fields need accessible labels/helper text, localized validation and keyboard/focus behavior, and runtime browser evidence must prove there is no page-level horizontal overflow.

### 15. Clean cutover is preferable to a compatibility layer for this task

The user's disposable-database instruction eliminates the main justification for translation readers, dual writes or migrations from old Dashboard payloads. Introducing those mechanisms would create exactly the parallel authority the refactor is trying to remove.

The clean boundary should instead be strict:

-   old content-bearing config shapes are rejected by current validators/seed tests;
-   nested child-widget arrays are rejected once canonical child placements exist;
-   `show*` composition booleans disappear from the supported Dashboard contract;
-   runtime no longer reconstructs old composition when placements are absent;
-   built-in seeds immediately create the final contract;
-   committed snapshot configurations are regenerated from the final contract;
-   no database-schema or built-in-template version bump is made solely to label this clean-start refactor.

## Recommended Dashboard Ownership Classes

This research does not freeze the final per-widget schema; PLAN must do that exhaustively for every `DASHBOARD_LAYOUT_WIDGETS` entry. The current source supports the following starting classification.

### Structural or host-derived

Examples include `divider`, workspace switching, locale/theme controls and authenticated user/session affordances. These should not receive fake Entity records. If persisted in the layout, they are placements driven by host capabilities; if projected by the host, that projection must be explicit and deterministic.

### Editorial/manual content

Manual menu sections/links, reusable information/alert copy if those widgets remain, static titles/copy and similar authored content belong to ordinary Entity records, normally Object + Components unless Page or another existing preset better matches the lifecycle.

### Data summaries and visualizations

Overview/stat cards and charts should bind to bounded semantic data sources. Labels/format/variant/chart appearance stay in presentation metadata when they are presentation. Static MUI demo arrays must disappear. Country/example charts with no legitimate platform data source should be retired rather than seeded as fake production data.

### Workspace/entity data surfaces

`detailsTable`, relation builders, record lists and learner/resource surfaces may bind to Entity models while actual day-to-day records remain workspace-owned. Binding a widget to an Entity type does not move workspace records into the metahub layout. Row actions, reports, workflows, create defaults and field presentation require separate classification into behavior, presentation and domain semantics.

### Specialized runtime surfaces

PlayCanvas project/scene manifests, report engines, module-backed quiz behavior and Interpretation Network runtime contracts can keep specialized typed sources. Durable descriptive/editorial content associated with them can still be Entity-backed where appropriate, but the engine/module manifest itself should not be copied into an Object merely for uniformity.

### Structural containers

`columnsContainer` and `detailsTabs` are composition primitives. Their children must become first-class placements connected through canonical parent/slot metadata. Parent config may retain structural presentation such as widths, labels and tab ordering, subject to the field-level ownership decision.

## Runtime and Authoring States Required by the Final Contract

The QA-refined brief correctly requires separate user-facing states and they remain necessary after this deeper pass:

-   loading;
-   valid empty collection;
-   optional unbound source;
-   missing required source;
-   stale/deleted source;
-   permission denied;
-   malformed/unsupported persisted config;
-   network/server failure.

These states must be produced by validated source/runtime DTOs rather than inferred from raw IDs or renderer exceptions. Optional-unbound is not an error. Required-source-missing and stale-source are explicit authoring/runtime failures. Application presentation-only edits must not silently rebind content. Normal user surfaces must not expose raw binding JSON, UUIDs, schema/table names, internal Zod messages or `[object Object]` cells.

## Acceptance and Verification Implications

The PLAN should carry forward the existing Runtime UI UX gate and add Dashboard-specific contract tests at each boundary.

### Shared/type contract

-   every Dashboard widget has an explicit retained/retired ownership classification;
-   retained source-managed widgets declare their binding slots/variants/cardinality and authoring capabilities;
-   host-only/structural widgets do not acquire artificial bindings;
-   retired config fields and nested widget arrays are rejected;
-   canonical child composition rejects cycles, invalid slots and incompatible parents/children;
-   singleton/repeatable behavior is registry-driven.

### Metahub and publication

-   Basic/Basic Demo/Empty/1C-Compatible/LMS/Interpretation Network/PlayCanvas Dashboard seeds validate on a fresh DB;
-   required Entity models/seed records and bindings resolve without post-create repair;
-   scoped overlays inherit source bindings according to the neutral ownership rule;
-   publication/snapshot round trips preserve semantic binding/composition identity and remap any physical references safely.

### Application sync/effective layout

-   source baseline and local presentation changes converge correctly;
-   reset-to-source restores presentation without creating a second binding owner;
-   source removal/fork/copy behavior fails closed for required source-managed widgets;
-   semantic hashes change for effective binding/composition changes but not for irrelevant physical lineage;
-   nested parent/slot relationships participate in sync/hash/effective ordering;
-   no `show*` or route-specific fallback reconstructs missing composition.

### Authoring UX

-   Metahub and Application layout editors use one registry-driven source-managed flow;
-   Add/Move/Reorder/Duplicate/Delete work for nested placements;
-   Duplicate behavior follows the registry contract (`none`, `share-bindings`, or `clone-record`), with clone-record operations atomic across record creation and placement creation;
-   source pickers use human/localized labels and hide raw IDs;
-   presentation-only Application widgets expose only registered presentation fields;
-   invalid nesting and invalid binding cardinality are blocked before Save;
-   EN/RU validation and keyboard/focus/Escape behavior use shared dialogs/primitives.

### Runtime/browser proof

Use the existing QA floor at minimum:

-   EN and RU;
-   `1920x1080`, `768x1024`, `390x844`;
-   keyboard/focus and accessible labels;
-   no raw technical identifiers or JSON;
-   no page-level horizontal overflow;
-   representative host/structural, single-record, record-set, chart/table, nested-composition and specialized-runtime widgets;
-   absence of old demo values and old boolean/direct-component fallback behavior.

### Fixture proof

-   regenerate the six application/metahub snapshots through their canonical producers;
-   run dedicated contract/drift/runtime gates for 73rd Meridian, Interpretation Network, LMS, MMOOMM, Quiz and Self-hosted flows;
-   keep `mmoomm-runtime-pre-extraction-baseline.json` immutable and rerun its parity gate;
-   add negative fixture assertions that the regenerated Dashboard snapshots no longer contain retired nested-widget/config-owned-content/boolean-composition shapes.

## Conflicts and Uncertainty

### Resolved conflict: “regenerate all seven tracked files”

The broad brief wording conflicts with the explicit test contract for `mmoomm-runtime-pre-extraction-baseline.json`. The source code calls the file immutable and verifies historical source provenance to prevent accidental re-baselining. The recommended interpretation is to regenerate six configuration snapshots and validate the historical seventh baseline unchanged.

### PLAN decision: physical representation of nested parent/slot composition

The research establishes the required semantic contract but intentionally does not choose a database-column versus neutral-envelope encoding. PLAN must select the representation after mapping snapshot remap, application sync, overlay inheritance and query/index requirements. It must not reuse `source_base_widget_id`.

### PLAN decision: structural metadata inside `detailsTabs` and `columnsContainer`

Column widths and localized tab labels are likely presentation owned by the container, while child widget instances are not. PLAN must freeze whether tab ordering is parent presentation metadata or derived entirely from child slot order, and define stable semantic slot keys independently from translated labels.

### PLAN decision: exact per-widget retained/retired matrix

The categories above are sufficient to proceed to PLAN, but the plan must enumerate every `DASHBOARD_LAYOUT_WIDGETS` key and every persisted config field. In particular, it must decide the fate of MUI-derived `brandSelector`, `infoCard`, `productTree`, country chart/default cards and other demo-era surfaces.

### PLAN decision: `detailsTable` and other behavior-rich source configs

Existing `datasource`, create targets/defaults, row actions, workflows and reports mix source identity with behavior. PLAN must split these concerns without turning bindings into an arbitrary query language and without pushing deployment/runtime policy into Entity content.

### PLAN decision: host-projected navigation versus canonical persisted host placements

Both approaches can satisfy the ownership invariant. The chosen contract must be explicit across authoring/effective layout/runtime and must eliminate mount-time fallback injection as an invisible third authority.

### Documentation-version caveat

The repository catalog pins `@mui/material` 9.2.0 and MUI X packages such as `@mui/x-data-grid` and `@mui/x-charts` 9.8.0. Context7 provided exact Material UI 9.2.0 indexing, while its MUI X catalogue in this session did not expose an exact 9.8.0 selector. Current MUI X Data Source documentation is therefore used only as architectural support for a centralized bounded source layer. Any concrete v9.8 API usage must be verified against the installed package or exact v9.8 source before implementation.

## Project Implications

The refactor should preserve current package ownership:

-   `@universo-react/types`: serializable registry, binding, presentation and neutral composition contracts;
-   metahub backend: canonical template seed, binding/source authoring, semantic source validation and publication inputs;
-   metahub frontend: registry-driven source/content/presentation authoring without raw technical fields;
-   applications backend: source baselines, sync/reset/copy/remove policy, effective layout, hashing and runtime projections;
-   applications frontend: presentation-only source-managed editing driven by registry metadata;
-   `apps-template-mui`: isolated typed renderer consuming validated DTOs, never persistence tables or metahub/application authoring packages;
-   workspaces/runtime APIs: ordinary end-user Entity record lifecycle;
-   E2E tooling: canonical fixture generation and runtime parity evidence.

The implementation sequence should generalize the shared source-managed lifecycle before converting large numbers of Dashboard widgets. Otherwise each widget conversion will tend to copy Marketing-specific exceptions into new Dashboard branches.

## Recommended Decision

The QA-refined Manager brief is directionally sound and is ready to enter PLAN after incorporating the constraints established by this research. PLAN should treat the following as normative:

1. Keep the clean-cutover ownership invariant: Entity content, placement composition/presentation, registry contracts.
2. Generalize the existing Marketing source-managed binding/overlay/source-state authoring infrastructure into template-neutral registry-driven infrastructure before broad Dashboard migration.
   This includes the discovery/provisioning schemas and definition resolver, application widget decoding, published-widget projection, scoped binding integrity policy and all inherited-binding classifiers—not only `WidgetBindingService` and `effectiveLayoutResolver`.
3. Introduce a canonical first-class nested placement relationship for `columnsContainer`/`detailsTabs`; do not retain embedded child widget instances.
4. Remove `show*`, direct-component/demo fallbacks and route-specific composition overrides as alternate authorities.
5. Make runtime-injected workspace navigation an explicit host projection or canonical host placement contract.
6. Freeze a field-level ownership/retain-retire matrix for every Dashboard widget before changing schemas.
7. Freeze per-widget duplicate semantics (`none`, `share-bindings`, `clone-record`) and generalize the atomic clone-record placement flow if any Dashboard widget requires it.
8. Preserve specialized runtime sources where Entity storage would be artificial.
9. Update every built-in Dashboard-bearing template, including Empty and 1C-Compatible in addition to Basic, Basic Demo, LMS, Interpretation Network and PlayCanvas.
10. Regenerate the six configuration snapshots from canonical producers; preserve and revalidate the immutable MMOOMM pre-extraction parity baseline.
11. Preserve MUI 9 reference geometry and require the existing EN/RU responsive/accessibility/browser UX proof.
12. Do not add legacy compatibility, migration shims, dual writes, or schema/template version bumps solely for this disposable-DB refactor.

## Open Questions Before PLAN

These are design choices for PLAN rather than research blockers:

1. What exact persisted/snapshot representation carries child `parent + slot` composition while remaining remappable and semantically stable across publication/application materialization?
2. Are `detailsTabs` tab order/labels entirely structural presentation metadata, or does any product requirement give tabs a separate durable content lifecycle?
3. Which current stock Dashboard widgets are retained, replaced by generic primitives, converted to source-managed Entity-backed widgets, exposed only as host controls, or retired?
4. For behavior-rich widgets such as `detailsTable`, `relationBuilder`, `learnerPlayer` and `resourcePreview`, which current fields are binding source identity, which are renderer presentation, and which are runtime behavior contracts?
5. Should workspace-generated navigation be represented as deterministic host-projected virtual placements or as canonical seeded host-capability placements?
6. For each source-managed Dashboard widget, should Duplicate share the existing binding, atomically clone the bound semantic record, or be disabled; and how should nested container subtree duplication compose with that policy?

No further external research is required to begin that decision-focused PLAN. The remaining work is repository-specific contract design and exhaustive per-widget classification. Exact MUI X 9.8 API verification remains an implementation precondition if PLAN chooses to use a concrete Data Source API rather than only the architectural pattern.

## External Sources

-   React, **Sharing State Between Components / A single source of truth for each state**: https://react.dev/learn/sharing-state-between-components — checked 2026-10-02.
-   Material UI, **React templates**: https://mui.com/material-ui/getting-started/templates/ — checked 2026-10-02. The current Dashboard is described as a complex data-visualization starter using MUI X Data Grid and Charts, and layout sections are designed for extraction/reuse.
-   MUI X, **Data Grid — Server-side data**: https://mui.com/x/react-data-grid/server-side-data/ — checked 2026-10-02. The Data Source layer centralizes client/server data communication and bounded server-side fetching concerns.
-   Context7 Material UI library `/mui/material-ui/v9.2.0` — queried 2026-10-02 for MUI 9 composition/accessibility patterns.
-   Context7 MUI X library `/mui/mui-x` — queried 2026-10-02 for Data Source concepts; exact repository-pinned 9.8.0 API must be verified locally before implementation.
