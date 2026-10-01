# Research: Marketing Page Complete Entity-Backed Widgets

> Created: 2026-09-27
> Status: Reviewed
> Trigger: RESEARCH request to validate and deepen the MANAGER brief for the complete Marketing Page Entity-backed widget cutover.
> Follow-up plan: ../plan/marketing-page-complete-entity-backed-widgets-plan-2026-09-27.md

## Research Question

Does the reviewed MANAGER brief define a safe and complete architecture for moving every durable Marketing Page content value out of widget renderer configuration and into canonical Entities, while preserving the existing layout/publication/application lifecycle, MUI 9 runtime behavior, scoped-layout inheritance, public redaction, and clean-cutover constraints?

The concrete repository decision is whether PLAN can now treat the following contract as normative:

-   Entities own durable authored content and domain relationships.
-   Widget placements own composition, placement, active state, and presentation behavior.
-   Widget definitions own binding-slot requirements, source-selection semantics, authoring metadata, and typed adapter contracts.
-   Persisted binding instances identify semantic Entity sources selected for one placement; they do not become a query language or a copy of current record rows.
-   Metahub/publication remains the owner of source bindings in this refactor. Application layout editing can override only registered presentation behavior.
-   The clean test database permits one cutover with no legacy `source`/`copySource` reader, no dual write, no automatic data migration, and no database-schema or Marketing Page template-version bump solely for this work.

## Source Inventory

| Source                                                                                                                                                                                               | Type                                       | Date / Freshness                        | Why It Matters                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User task specification for the complete Marketing Page Entity-backed widget cutover                                                                                                                | Repository task input                      | 2026-09-27                              | Original scope and clean-cutover constraints.                                                                                                                                             |
| QA-reviewed architecture brief for the complete Marketing Page Entity-backed widget cutover                                                                                                         | Reviewed MANAGER brief                     | 2026-09-27                              | Proposed target architecture and open questions that this research must resolve before PLAN.                                                                                              |
| `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`                                                                                                                          | Prior repository research                  | 2026-08-30, with implementation updates | Establishes the MUI template provenance, Entity-owned marketing content, typed runtime boundary, and browser evidence baseline.                                                           |
| `memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md`                                                                                                                      | Prior repository research                  | 2026-09-04                              | Establishes neutral widget composition, bounded server-owned data access, lifecycle propagation, and no-schema-bump storage constraints.                                                  |
| `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`                                                                                                    | Prior repository research                  | 2026-09-07                              | Establishes effective-layout precedence, same-template overlay lineage, fail-closed runtime behavior, and package ownership.                                                              |
| `memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md`                                                                                                      | Prior repository research                  | 2026-09-20 / QA 2026-09-21              | Establishes the implemented Hero pilot contract: definition versus binding instance, source-owned bindings, generic Entity editing, and lifecycle/hash requirements.                      |
| `packages/universo-react-types/src/common/widgetBindings.ts`                                                                                                                                         | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Current semantic-key-only binding envelope, limits, requirements, record policies, and canonicalization.                                                                                  |
| `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`                                                                                                                                | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Shared widget-definition contract; only Hero currently declares binding slots.                                                                                                            |
| `packages/universo-react-types/src/common/marketingPage.ts`                                                                                                                                          | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Current Marketing widget registry, legacy source schemas, renderer configs, authenticated/public runtime DTO allowlists.                                                                  |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts` and `marketing-page.layouts.ts`                                                                     | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Built-in content model, REF relation for pricing benefits, site settings, demo rows, and the mixed old/new seeded widget generation.                                                      |
| `packages/universo-react-metahubs-backend/src/domains/templates/services/templateSeedElements.ts` and `packages/universo-react-applications-backend/src/routes/sync/{syncSeeding.ts,syncHelpers.ts}` | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Resolves semantic seed REF values to target element UUIDs and materializes non-Set REF values as canonical referenced record IDs.                                                         |
| `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`                                                                                                                     | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Snapshot export and scoped override serialization, including the current duplicated-binding behavior in overlays.                                                                         |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`, `applicationLayoutWidgetsStore.ts`, `applicationLayoutWidgetSyncStore.ts`                           | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Source baseline, customization, reset and sync behavior.                                                                                                                                  |
| `packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts`                                                                                                                    | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Existing canonical semantic hashing that already understands trusted source-owned bindings.                                                                                               |
| `packages/universo-react-applications-backend/src/services/effectiveLayoutResolver.ts`                                                                                                               | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Effective application layout, source binding attachment, and overlay lineage validation.                                                                                                  |
| `packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts` and `src/services/publicMarketingRuntime.ts`                                                        | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Authenticated/public legacy source resolution and the Hero-only generic binding bridge.                                                                                                   |
| `packages/universo-react-template-mui/src/components/layouts/MarketingWidgetConfigDialog.tsx`, metahub `LayoutDetails.tsx`, application `ApplicationLayouts.tsx`                                     | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Hero magic strings and current Add/Duplicate/source-authoring behavior.                                                                                                                   |
| `packages/universo-react-apps-template-mui`                                                                                                                                                          | Current source                             | HEAD `69f7036`; inspected 2026-09-27    | Persistence-free renderer boundary, runtime normalization, independent Hero/Image composition, and current package-boundary test.                                                         |
| `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts` and `tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts`                                                                  | Current browser acceptance                 | HEAD `69f7036`; inspected 2026-09-27    | Existing viewport, EN/RU, light/dark, Axe, overflow, header geometry, keyboard/focus and authoring validation oracles that the generic cutover should preserve.                           |
| `.backup/templates/marketing-page` and `.backup/Архитектура-виджетов.md`                                                                                                                             | Local reference material                   | Repository snapshot                     | Visual provenance and earlier content/presentation separation ideas. The JSON-content ownership ideas in the older architecture note are not normative.                                   |
| Context7 `/mui/material-ui/v9.2.0`                                                                                                                                                                   | Exact-version primary documentation mirror | Queried 2026-09-27                      | Confirms the repository-pinned MUI 9 layout and accessible form/dialog patterns without requiring a MUI upgrade.                                                                          |
| https://mui.com/material-ui/getting-started/templates/                                                                                                                                               | Primary vendor documentation               | Checked 2026-09-27                      | Current Marketing Page template remains a responsive, section-based reference whose parts are intended to be reusable.                                                                    |
| https://mui.com/material-ui/react-grid/ and https://mui.com/material-ui/react-stack/                                                                                                                 | Primary vendor documentation               | Checked 2026-09-27                      | Grid is the responsive column layout primitive; Stack is the one-dimensional layout primitive. Supports preserving the existing MUI composition instead of inventing a new layout system. |
| https://www.contentful.com/headless-cms/                                                                                                                                                             | Primary vendor architecture documentation  | Checked 2026-09-27                      | Supports separating managed content from presentation and serving content through typed APIs.                                                                                             |
| https://www.contentful.com/help/content-models/content-modelling-basics/                                                                                                                             | Primary vendor content-model documentation | Checked 2026-09-27                      | Supports reusable structured content types/fields rather than page-widget-owned content blobs.                                                                                            |
| https://1c-dn.com/library/tutorials/practical_developer_guide_catalog_forms/                                                                                                                         | Primary 1C documentation                   | Checked 2026-09-27                      | Describes forms as user-facing visual presentations of database data.                                                                                                                     |
| https://1c-dn.com/library/tutorials/practical_developer_guide_form_data_and_controls/                                                                                                                | Primary 1C documentation                   | Checked 2026-09-27                      | Separates form controls from data and links controls to explicit data sources, supporting a binding contract without making the form own the business record.                             |

Research method note: OntoIndex is indexed at current commit `69f7036`, but the worktree is dirty and embeddings are unavailable, so semantic search is degraded and uncommitted changes are not represented in the graph. Direct source inspection is authoritative for this artifact. Independent read-only subagent QA was also used: one reviewer checked the MUI/runtime/browser/package-boundary contract and another checked binding canonicalization, renderer limits and legacy-source seams. Their findings were re-checked against current source before being incorporated below. A separate delegated lifecycle reviewer failed with `turn token is invalid, expired, or revoked` and contributed no evidence.

## Key Findings

### 1. The MANAGER brief is directionally correct, and the remaining work is a platform binding refactor rather than a Marketing-only source rewrite

-   **[Fact]** The current checkout contains two generations of content sourcing. `marketing.hero` uses registry-declared binding slots and `__layout.bindings`; brand/navigation/collection/pricing/footer still use `source` and, where applicable, `copySource`; `marketing.image` still stores its media payload in renderer config.
-   **[Fact]** The old source vocabulary is not isolated to one renderer. `MARKETING_SOURCE_CODENAMES`, `marketingWidgetSourceSchema`, source parsing, seed guards, public loading, application runtime, frontend authoring options and row-limit/discovery logic all depend on it.
-   **[Inference]** Keeping the legacy source registry while adding new binding selectors would leave two competing trust and ownership models. The clean-cutover requirement therefore has to remove all source/copy-source consumers in the same architecture wave.
-   **[Decision recommendation]** Generalize the Hero infrastructure around registry capabilities and selector modes; do not create sibling Brand/Navigation/Collection/Pricing/Footer binding services.

### 2. The current binding instance is record-oriented; record sets need a model-level selector that does not enumerate rows

-   **[Fact]** `widgetBindings.ts` currently exposes only `{ kind: 'semantic-key', field, value }`. A target also carries Entity kind/codename and a projection, and a slot is capped at 32 targets.
-   **[Fact]** Persisting one target per navigation item, feature, logo, FAQ row or footer link would make normal content CRUD rewrite layout metadata and would eventually hit the target cap.
-   **[Fact]** A persisted slot currently requires at least one target, while slot-definition cardinality can allow zero. Therefore an optional empty slot is represented by absence of that slot, not by persisting `targets: []`.
-   **[Fact]** `canonicalizeWidgetBindings()` sorts slots, targets and projections to stabilize persistence/hash semantics. Target order is therefore not an authored record-order channel and must never be used to order navigation items, cards, pricing rows or footer links.
-   **[Fact]** The repository already has broader runtime datasource descriptors such as record-list queries, filters and sorting, but those are runtime query contracts with a different trust boundary.
-   **[Inference]** Embedding the general datasource query grammar into `__layout.bindings` would make the persistent layout contract too expressive and would weaken the registry/server-controlled boundary.
-   **[Decision recommendation]** Extend the selector union with bounded model-level modes while keeping selection policy in the widget definition:

    -   single record: existing `{ kind: 'semantic-key', field, value }`;
    -   record set: `{ kind: 'record-set' }`;
    -   relation-backed child set: `{ kind: 'relation-set', parentSlot: <semantic slot key> }`.

    The target continues to identify a semantic Entity kind/codename. Any persisted projection must be server-generated and exactly match the definition; the client must not gain arbitrary Component mapping.

-   **[Decision recommendation]** Extend binding-slot definition metadata, rather than binding-instance data, with the bounded selection contract: accepted selector kind, semantic order role, optional visibility role, hard server result limit, and for relation sets the required REF role/Component and parent slot. A custom server validator/policy key can exist in the definition for unusual semantics. Physical schema/table names, row UUIDs, raw SQL, free-form filters and arbitrary field mappings remain impossible to persist.

### 3. Ordering, visibility and display limits have three different owners and should not be conflated

-   **[Fact]** Existing Marketing Entity models already use `SortOrder` and `IsVisible` Components.
-   **[Fact]** Existing widget configs also expose `maxItems`, while backend code has separate aggregate and child-record safety limits.
-   **[Fact]** The isolated Marketing renderer normalizer does not currently apply `maxItems` itself. The generic resolver/materialization boundary therefore has to return a set already filtered, ordered and truncated for the widget contract.
-   **[Decision recommendation]** Entity Components own authored order and visibility. The binding definition names those semantic roles and sets a hard resolver safety ceiling. Per-placement `maxItems` remains a presentation/runtime truncation setting that can only reduce the already bounded set; it is not source identity and must not change `__layout.bindings`. Apply ordering/visibility and `maxItems` before the persistence-free renderer boundary so all adapters observe one deterministic record order.
-   **[Decision recommendation]** Normalize ordering semantics consistently across all record-set variants, including Footer groups/social/legal links, rather than letting some renderer branches preserve incidental backend row order while others sort by the semantic order Component.
-   **[Implication]** Adding, deleting, hiding or reordering rows in a bound record set changes Entity data and runtime output without changing layout identity or binding metadata.

### 4. Pricing already has the correct domain relation primitive; the runtime currently bypasses it semantically

-   **[Fact]** `MarketingPagePricingBenefit.TierRef` is a required `REF` Component targeting the `MarketingPagePricing` Object.
-   **[Fact]** Current authenticated runtime assembly builds a `pricingBenefitsByTier` map and accepts both a row ID and `TierKey`; public runtime has equivalent special handling. The pricing widget also performs an implicit second Object lookup outside a generic binding contract.
-   **[Fact]** Template seeding already resolves Object-target `REF` seed values through `elementIdMap`, so semantic seed codenames such as a tier key become the referenced target element UUID. Application sync then materializes non-Set `REF` values through `normalizeReferenceId()`, preserving the referenced record ID as the canonical runtime value.
-   **[Inference]** The required parent/child relationship already belongs to the Entity model; adding a second list of tier/benefit IDs to widget config would duplicate domain state.
-   **[Conclusion]** The canonical Object `REF` representation needed by this refactor is the referenced record UUID. The current TierRef/TierKey dual matching is compatibility/special-case logic and is not the target relation contract.
-   **[Decision recommendation]** Pricing declares three slots: one semantic section-copy record, one `record-set` tier source, and one `relation-set` benefit source whose definition requires a REF semantic role targeting the tier slot. The generic resolver resolves selected parent records first, compares child `TierRef` against the authoritative referenced parent record UUID under the same read/publication scope, applies ordering/visibility and hard limits, then hands a bounded typed result to the pricing adapter. The adapter shapes DTOs; it does not discover tables, invent relation matching or fall back to a semantic tier key.

### 5. `marketing.image` needs a normal Object-backed content owner; reuse should be capability-based rather than codename-global

-   **[Fact]** `marketing.image` is currently registered as `dataOwnership: 'static'` and stores `media` directly in config.
-   **[Fact]** Marketing media already uses the shared `ResourceSource` contract and validates localized alternative text versus decorative media. The template seed helper already renders ResourceSource JSON through the generic `resourceSource` editor.
-   **[Decision recommendation]** Add a built-in `MarketingPageImage` Object with a semantic `ImageKey`, ResourceSource Component, localized alternative text, decorative flag, and optional dimensions needed by the existing media DTO. Bind each `marketing.image` placement through the normal single-record selector. Remove content-bearing `media` from renderer config.
-   **[Decision recommendation]** Future widgets should reuse the same capability/Component contract when appropriate, not be forced to hardcode `MarketingPageImage`. The built-in codename is a template seed choice; compatibility remains capability-first.

### 6. `MarketingPageSiteSettings` can remain the shared Brand/Footer content authority

-   **[Fact]** The current singleton contains `BrandName`, `BrandLogo`, footer description, copyright and newsletter fields. Brand and Footer both legitimately consume parts of that record.
-   **[Fact]** Brand renderer config currently has optional `brandName` and `brandLogo` overrides, which duplicate Entity-owned content authority.
-   **[Fact]** Page-level `config.brandLogo` is a second competing branding authority: the current normalizer can replace the inherited SiteSettings logo with that page config value.
-   **[Fact]** Navigation currently receives the site-settings record in runtime payload assembly, but `normalizeNavigation` ignores it. The composable header already has a separate Brand widget.
-   **[Decision recommendation]** Keep one `MarketingPageSiteSettings/site-settings` record as the canonical shared singleton for branding, footer newsletter/legal copy and shared site identity. Brand and Footer each bind their own semantic-record slot to the same record. Delete Brand renderer `brandName`/`brandLogo` overrides and remove/reclassify page-level `brandLogo` so it can no longer override canonical Entity content. Theme colors/mode and other true appearance/behavior policy may remain page-level configuration. Stop injecting SiteSettings into Navigation unless a future explicit navigation requirement needs it.
-   **[Implication]** Sharing a record between two widgets is not duplicate ownership; both widgets read one canonical Entity record through independent binding slots.

### 7. Authentication actions should have one widget owner

-   **[Fact]** `showAuthActions` exists in both navigation and auth config schemas/public serialization.
-   **[Fact]** The current isolated renderer's Navigation normalization ignores `showAuthActions`; the Auth widget normalization alone uses it to produce sign-in/sign-up actions.
-   **[Decision recommendation]** Remove `showAuthActions` from Navigation in the clean cutover. Keep it only on `marketing.auth`, where it is a legitimate presentation switch for system-derived actions.

### 8. Hero and Image should remain independent ordered placements

-   **[Fact]** The current registry already marks `marketing.image` with `seamlessAfter: ['marketing.hero']`.
-   **[Fact]** `MarketingPage.tsx` renders main-zone widgets by persisted order and lets the registry-driven divider logic preserve seamless adjacency. The renderer has distinct Hero and Image renderers and stable instance-key anchors.
-   **[Inference]** Adding a second persisted grouping relationship only to preserve stock Hero/Image geometry would duplicate composition state and complicate repeatability, overlays and copy semantics.
-   **[Decision recommendation]** Keep Hero and Image independent widgets. Preserve the MUI reference geometry through normal order plus the existing declarative `seamlessAfter` composition capability. If future layout features need groups, define them as a platform composition feature rather than a Marketing-specific Hero/Image binding.

### 9. The normative widget ownership/binding matrix can now be frozen before PLAN

| Placement                                                         | Durable content owner                                                         | Binding slots                                                                          | Presentation / behavior kept on placement                                             | Default Add / Duplicate semantics                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `marketing.brand`                                                 | `MarketingPageSiteSettings` singleton                                         | required `site`: semantic record `site-settings`                                       | placement/active state only; header placement is neutral layout metadata              | singleton Add only if absent; no Duplicate                                                                                       |
| `marketing.navigation`                                            | compatible ordered navigation Object; built-in `MarketingPageNavigation`      | required `items`: record set                                                           | `maxItems` as display cap; placement/mobile projection through registry; no auth flag | Add selects an existing compatible source; Duplicate reuses binding/source by default                                            |
| `marketing.auth`                                                  | none; system-derived                                                          | none                                                                                   | `showAuthActions`, placement/mobile projection                                        | singleton; no content cloning                                                                                                    |
| `languageSwitcher`                                                | none; system-derived shared widget                                            | none                                                                                   | existing shared-widget behavior                                                       | unchanged                                                                                                                        |
| `colorModeSwitcher`                                               | none; system-derived shared widget                                            | none                                                                                   | existing shared-widget behavior                                                       | unchanged                                                                                                                        |
| `marketing.hero`                                                  | compatible Hero Object; built-in `MarketingPageHero`                          | required `content`: semantic record                                                    | `showLeadForm` and normal placement state                                             | preserve implemented single-record flow: create/select; Duplicate clones the selected content record and binds the new placement |
| `marketing.image`                                                 | compatible media Object; built-in new `MarketingPageImage`                    | required `content`: semantic record                                                    | no media content in config; only placement/active state                               | same single-record flow as Hero; Duplicate clones media content record by default                                                |
| `marketing.collection` logos/features/testimonials/highlights/faq | `MarketingPageSection` + variant-compatible item Object                       | required `section`: semantic record; required `items`: record set                      | `variant`, `maxItems`, `showTitle`, `showDescription`, variant presentation flags     | Add selects compatible sources; Duplicate shares both bindings by default; no row cloning                                        |
| `marketing.pricing`                                               | `MarketingPageSection`, `MarketingPagePricing`, `MarketingPagePricingBenefit` | `section`: semantic record; `tiers`: record set; `benefits`: relation set over `tiers` | `maxItems`, `showBenefits`, `cardStyle`, `cardWidth`                                  | Duplicate shares all sources by default; no tier/benefit cloning                                                                 |
| `marketing.footer`                                                | shared `MarketingPageSiteSettings` + `MarketingPageFooterLink`                | `site`: semantic record; `links`: record set                                           | `maxItems`, `showNewsletter`                                                          | Duplicate shares bindings by default; no row cloning                                                                             |

An explicit future “copy content source” workflow may deep-copy records, but it is not the default meaning of Duplicate for record-set widgets and is outside this refactor unless PLAN finds an existing product requirement.

### 10. Generic integrity is partly implemented, but Component/record policy still contains Hero-only gates

-   **[Fact]** Entity deletion is already guarded generically: `MetahubObjectsService.delete` checks whether an Entity is used by a live layout binding and rejects deletion.
-   **[Fact]** Component mutation/deletion and record-policy enforcement still contain Marketing Hero-specific validator/codename branches such as `MARKETING_HERO_POLICY_VALIDATOR` and `isMarketingHeroBindingComponentCodename`.
-   **[Fact]** Hero record policy can deny deletion of the selected record and make its semantic key immutable while bound.
-   **[Decision recommendation]** Generalize integrity around live binding definitions:
    -   any bound source Entity cannot be deleted/renamed in a way that invalidates its binding;
    -   required Components cannot be removed or made incompatible while the source participates in a live binding;
    -   semantic-record targets can protect the selected record and semantic key when the slot policy requires it;
    -   record-set row CRUD remains normal content CRUD and must not be blocked merely because the model is bound;
    -   relation Components used by a live relation-set contract cannot be removed or retargeted incompatibly.

### 11. Authenticated and public runtime must converge on one resolver before typed adapters

-   **[Fact]** `runtimeMarketingPageController.ts` still discovers fixed Marketing Objects, resolves legacy source/copySource, contains Hero-only compatibility checks, implicitly adds SiteSettings/section/pricing-benefit rows, and then validates widget DTOs.
-   **[Fact]** `publicMarketingRuntime.ts` has its own source parsing and equivalent widget-specific assembly. It also has deliberate public DTO redaction and URL-only media constraints.
-   **[Fact]** `widgetBindingResolver.ts` is already persistence-neutral and the Hero projector proves that a binding can resolve before a strict widget adapter.
-   **[Decision recommendation]** Use one definition-driven binding resolver contract for both authenticated and public paths. Scope-specific loaders enforce authorization/publication visibility and return only the records/components required by the definition. A typed widget adapter then converts the resolved semantic fields into the existing authenticated/public DTO families. Public redaction remains a separate final boundary.
-   **[Implication]** Runtime adapters may be widget-specific for real semantics, but source discovery, selector validation, cardinality, relation traversal, required Components and record bounds are generic infrastructure.

### 12. `source_config` is the right source baseline, but current SQL customization detection is wrong for source-owned bindings

-   **[Fact]** Application persistence deliberately decodes `config` as application renderer/presentation state and separately decodes `source_config` with `requireBindings: true`. Trusted bindings from source_config are attached out-of-band to the typed application widget.
-   **[Fact]** `encodeWidgetConfigForStorage` does not write source-owned bindings into normal application renderer config.
-   **[Fact]** Several application widget queries still compute `is_customized` as raw JSON inequality: `source_config IS NOT NULL AND config IS DISTINCT FROM source_config`.
-   **[Conclusion]** Once a source-managed widget carries neutral bindings only in source_config, raw JSON equality can report customization solely because the two envelopes intentionally have different neutral metadata. This is a confirmed lifecycle defect for the full binding model, not a hypothetical future risk.
-   **[Fact]** `normalizeApplicationLayoutForHash` already implements a better semantic pattern: it reads trusted source binding state when present, combines it with renderer config and placement, and excludes physical row/lineage IDs and optimistic versions.
-   **[Decision recommendation]** Reuse the same registry-aware canonical semantics for customization/reset/sync comparisons. Application customization must compare the application-overridable presentation/placement subset against the source presentation baseline while treating source-owned bindings as inherited source semantics. Do not use raw envelope JSON equality as the product meaning of “customized.”

### 13. Sync already preserves source-owned bindings, but source removal and reset need required-slot rules

-   **[Fact]** `applicationLayoutWidgetSyncStore.ts` updates `source_config` from the latest source snapshot while preserving the current application `config` for locally modified layouts. This is the correct direction for source binding updates plus local presentation overrides.
-   **[Fact]** Semantic hashing can already include the trusted source binding independently of generated physical IDs.
-   **[Fact]** On locally modified layouts, a source widget that disappears can be retained as an application-local row with `source_config = NULL` in some sync paths.
-   **[Inference]** That fallback is unsafe for a widget whose definition requires source-owned Entity bindings: retaining an active placement without the required source binding would create an invalid effective runtime state.
-   **[Decision recommendation]** PLAN must distinguish source-managed widgets with required bindings from genuinely application-local widgets. Source removal for a required source-owned binding must resolve deterministically through tombstone/removal/conflict semantics; it must not silently produce an active unbound Entity widget.

### 14. Scoped/overlay snapshot handling currently duplicates bindings and violates the target inheritance model

-   **[Fact]** Base `_mhb_widgets` snapshot rows are decoded and re-encoded with `requireBindings: true`, which correctly preserves the source binding.
-   **[Fact]** `_mhb_layout_widget_overrides` snapshot rows are also decoded with `requireBindings: true` and re-encoded with their own neutral bindings.
-   **[Fact]** Effective application layout validation already has explicit base-widget lineage via `sourceBaseWidgetId`.
-   **[Conclusion]** Current override serialization treats a source-owned binding as duplicated override state. That conflicts with the reviewed brief's intended rule that an overlay inherits binding identity from its base placement and changes only an allowlisted presentation subset.
-   **[Decision recommendation]** For overlay composition, the base placement is the sole source-binding authority. Override storage/snapshot validation must reject binding replacement and may serialize only allowed presentation/placement/activity deltas. Effective resolution attaches the base source binding after validating lineage. An independent scoped layout still owns its own complete bindings.

### 15. Snapshot transport is structurally permissive, so domain validation remains mandatory

-   **[Fact]** `MetahubSnapshotTransportEnvelopeSchema` types `layoutZoneWidgets` and `layoutWidgetOverrides` as arrays of unknown values for transport round-trip flexibility.
-   **[Fact]** `snapshotLayouts.ts` performs the deeper template/widget envelope validation before publication snapshot use.
-   **[Decision recommendation]** Do not rely on the transport schema alone for the new selector contract. Keep strict domain-level validation of every base widget and override during snapshot creation/restore/import, including source ownership and overlay no-rebind rules.

### 16. The authoring UI cannot become generic by adding slots alone

-   **[Fact]** `MarketingWidgetConfigDialog.tsx` explicitly excludes Hero from the old entity-source picker, has a Hero-only presentation path, hardcodes per-widget fields, edits Image media directly, and edits Brand name/logo directly.
-   **[Fact]** Metahub `LayoutDetails.tsx` has a dedicated `MarketingHeroBindingDialog`, Hero-only Add/Duplicate/content-permission behavior and Hero-specific source flows.
-   **[Fact]** Application `ApplicationLayouts.tsx` separately special-cases Hero duplication/source behavior.
-   **[Decision recommendation]** Add declared authoring capabilities to the widget definition/slot contract and make hosts branch on semantics such as “has source-owned binding,” “single-record create/select,” “record-set source selection,” “supports content clone,” “presentation-only application editing,” and “singleton placement.” Keep specialized content dialogs as facades over generic Entity CRUD where field UX merits specialization; do not make `widgetKey === 'marketing.hero'` the policy.
-   **[Decision recommendation]** PLAN must define a UI Contract for every selector shape with control type, human-readable selected value, hidden/system-owned fields, defaults, localized validation/error behavior, responsive behavior and keyboard/focus behavior. Normal user surfaces must not expose UUIDs, binding JSON, raw technical codenames, persistence details or raw Zod/internal errors.
-   **[Decision recommendation]** The default interaction should remain Entity-centric: `semantic-key` uses a human-readable record chooser plus the ordinary Entity record editor/facade; `record-set` chooses a compatible Entity source/model while row CRUD stays in the normal Entity list/editor; `relation-set` edits ordinary child records with a human-readable REF picker to the parent. These selectors configure where content comes from; they do not become a second content editor.
-   **[Decision recommendation]** Authoring hosts should reuse the established `StandardDialog` primitive/pattern where package ownership permits it, including its labelled dialog, full-width/max-width and footer/focus behavior. This does not authorize `packages/universo-react-apps-template-mui` to import the legacy `@universo-react/template-mui`; the published renderer remains isolated.

### 17. The isolated renderer boundary is clean today, but its automated guard is too narrow

-   **[Fact]** `packages/universo-react-apps-template-mui/package.json` does not depend on metahub/application backend or authoring feature packages.
-   **[Fact]** Its `packageBoundary.test.ts` only scans for `@universo-react/template-mui`, so it would not catch a future import from metahub/application authoring or persistence packages.
-   **[Decision recommendation]** Strengthen the package-wide deny contract so `apps-template-mui` rejects the legacy `@universo-react/template-mui`, metahub/application authoring frontends, backend and persistence packages. A narrower allowlist may additionally be useful for `src/marketing-page`, but a package-wide allowlist would be too rigid because the package also contains Dashboard, CRUD/runtime, workspaces and other independent runtime surfaces. Runtime receives shared types plus already validated DTOs.

### 18. The seed/documentation baseline has a concrete count drift

-   **[Fact]** The current Marketing Page layout seed contains 14 placements: Brand, Navigation, Auth, Language Switcher, Color Mode Switcher, Hero, Image, five Collection placements, Pricing, and Footer.
-   **[Fact]** `docs/en/platform/marketing-page-template.md` currently states “the thirteen seeded widget placements.”
-   **[Decision recommendation]** Documentation closeout must correct this count and replace Hero-pilot/legacy-source wording with the final all-widget Entity-backed contract.

### 19. Current external guidance supports the ownership split, but Universo's binding schema remains a repository decision

-   **[Fact]** Contentful documents a headless architecture where managed content is separated from presentation and delivered through APIs; its content-model guidance treats content types and fields as reusable structured content.
-   **[Fact]** 1C documentation describes forms as visual presentations of stored data and separately documents links between form controls and data sources.
-   **[Fact]** MUI's current template documentation still presents Marketing Page as a responsive section-based layout, while exact-version Context7 guidance for MUI 9.2.0 keeps Grid/Stack/standard Dialog and labelled input patterns as the correct primitives.
-   **[Inference]** These sources support the general ownership and UI direction, but none of them define Universo's selector wire format, sync semantics, source_config baseline or overlay rules. Current repository lifecycle evidence is authoritative for those decisions.

### 20. Existing browser tests define a stronger acceptance contract than the brief's generic “responsive” wording

-   **[Fact]** Existing Marketing Page visual E2E uses three concrete viewports: desktop `1920x1080`, tablet `768x1024`, and mobile `390x844`; it exercises EN/RU, light/dark, page-level horizontal-overflow checks and Axe rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`.
-   **[Fact]** The visual suite also verifies fixed versus flow header behavior, anchor visibility/occlusion and scroll padding, while the runtime header contract exposes `MARKETING_HEADER_VISUAL_OFFSET_PX = 28`.
-   **[Fact]** Existing Hero/runtime evidence preserves the reference Hero geometry/background behavior, including the established 400px/700px media-height behavior and radial-gradient ownership. The generic refactor must not silently degrade these reference-sensitive invariants.
-   **[Fact]** Existing Marketing authoring E2E already proves keyboard editing, localized validation, `aria-invalid`, `aria-describedby`, Escape/focus behavior, responsive dialogs at all three viewports and advanced source-picker behavior for the Hero pilot.
-   **[Decision recommendation]** Treat these existing browser oracles as the minimum acceptance contract for the generalized authoring/runtime work. PLAN should extend them across `semantic-key`, `record-set` and `relation-set` flows rather than replacing them with weaker CRUD-only tests or generic “looks responsive” assertions.

## Conflicts And Uncertainty

-   **Repository pin versus live MUI docs.** The project is pinned to Material UI 9.2.0, while the live MUI site can move ahead independently. Exact API decisions for this refactor should continue to use Context7 `/mui/material-ui/v9.2.0` and the lockfile/source baseline. The current live templates remain useful for visual/reference intent, not dependency-version policy.
-   **Current REF runtime compatibility is broader than the desired contract.** Pricing runtime currently accepts both row IDs and semantic tier keys when linking benefits, while source inspection now establishes the canonical Object REF value as the referenced record UUID across template seed resolution and application materialization. The target relation-set contract should eliminate adapter-level dual identity matching and use the authoritative REF value directly.
-   **Projection duplication remains in the existing binding instance.** The current target persists a projection while the slot definition also declares semantic fields/Components. This research does not require removing that field in the same refactor because Hero already uses it. It does require that persisted projection be server-generated/canonical and not become arbitrary user mapping. A later simplification can move projection entirely into the definition if lifecycle evidence supports it.
-   **Per-widget application customization granularity.** Current sync uses layout-level `sync_state` in places, while `isCustomized` is exposed per widget. The clean binding cutover needs correct canonical comparison first; changing the wider layout-sync conflict model is not automatically in scope unless tests prove it is required.
-   **Deep-copy source workflow.** No current product requirement proves that Duplicate on a collection/pricing/footer should clone whole record sets. The recommended default is shared content. A future explicit “copy content source” workflow can be designed separately.
-   **Delegated review coverage is partial but useful.** Two read-only independent reviews completed and their findings were re-checked against current source: one focused on MUI/runtime UX/browser/package boundaries and one on binding canonicalization/limits/legacy-source behavior. A separate lifecycle reviewer failed because its Codex Native turn token expired/revoked, so no claim relies on that failed review.

## Project Implications

The following repository surfaces are in the blast radius of the eventual implementation:

-   **Shared types and registry:** `packages/universo-react-types/src/common/widgetBindings.ts`, `layoutWidgetDefinitions.ts`, `marketingPage.ts`, binding tests and snapshot/runtime DTO schemas.
-   **Built-in Marketing template:** `packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts`, `marketing-page.layouts.ts`, template manifest/shape tests, plus a new built-in image Object and bindings for every stock placement.
-   **Generic metahub binding/integrity:** Hero-specific binding services/stores/policies, `MetahubLayoutsService`, Entity/Object/Component/record mutation guards, snapshot validation and restore.
-   **Authoring:** `MarketingWidgetConfigDialog`, metahub `LayoutDetails`, generic Entity dialogs and Application layout editing. Application remains presentation-only for source-owned Marketing bindings.
-   **Publication/application lifecycle:** snapshot export/restore, publication materialization, `source_config`, widget sync/reset, semantic hash/diff, source removal, effective layout and scoped overlay lineage.
-   **Runtime:** authenticated and public loaders converge on one generic binding resolver plus bounded explicit widget adapters. Remove `MARKETING_SOURCE_CODENAMES`, `marketingWidgetSourceSchema`, source/copy-source field maps and implicit supplemental Object loading.
-   **Renderer:** preserve the current `apps-template-mui` typed DTO boundary, current MUI composition, stable `instanceKey` keys/anchors, public redaction, responsive behavior and fail-closed normalization. Convert Image runtime content to a normal Entity-backed DTO without giving the renderer persistence knowledge. Feed it already filtered/ordered/truncated record sets; do not make renderer target order or incidental row order a data-order contract.
-   **Tests:** selector/canonicalization tests, including optional-slot absence and order-independent target canonicalization; generic binding/integrity tests; fresh template contract; snapshot/restore; source_config sync/reset and binding-only hash change; overlay no-rebind; authenticated/public DTO parity/redaction; real PostgreSQL bind/delete/schema-mutation races; and browser authoring/runtime/failure-state proof across `1920x1080`, `768x1024`, `390x844`, EN/RU, light/dark, Axe WCAG 2/2.1 A/AA, keyboard/focus/Escape, header/anchor geometry and no page-level horizontal overflow.
-   **Documentation:** EN/RU entity-backed widget architecture and Marketing Page docs must describe the completed generic contract, correct the 14-placement count, and remove old source/copy-source and Hero-only pilot language.

The OntoIndex graph is current at committed HEAD but cannot represent the dirty uncommitted README/package metadata changes. No source file examined for this research was modified by this RESEARCH turn.

## Recommended Decision

Proceed to PLAN with the following contract frozen:

1. **Keep the ownership invariant.** Entity records and relations are the only durable Marketing content authority; placements own composition/presentation; definitions own binding selection and adapter contracts.
2. **Extend the neutral selector union minimally.** Retain `semantic-key`; add `record-set`; add `relation-set` with a semantic parent-slot reference. Keep order/visibility/relation Component roles and hard limits in definition metadata, not arbitrary binding-instance queries.
3. **Keep binding instances semantic and stable.** Bind to Entity kind/codename plus the bounded selector. Never persist row inventories, physical IDs, schema/table names, SQL, free-form filters or client field maps. Any persisted projection is generated and verified from the definition.
4. **Freeze the widget matrix in this artifact.** Brand/Footer share one SiteSettings singleton; Navigation is a record set; Hero and Image are independent single-record widgets; each Collection has section + item-set slots; Pricing has section + tier-set + REF-backed relation-set benefits; Footer has site + link-set slots because branding, footer description, copyright, and newsletter content belong to Site Settings and the renderer has no separate footer section heading; Auth/language/theme controls remain data-free.
5. **Create `MarketingPageImage` as the built-in image content Object.** Preserve ResourceSource and localized alt/decorative validation. Change `marketing.image` to Entity ownership and remove media from renderer config.
6. **Use the authoritative Entity REF semantics for PricingBenefit.** Object REF seed values resolve to target element UUIDs and application materialization preserves the referenced record ID. The relation selector follows that required REF Component to the already selected parent records; remove ID/key dual matching and implicit extra Object discovery from adapters.
7. **Keep `MarketingPageSiteSettings` shared.** Remove Brand content overrides and remove/reclassify page-level `brandLogo` so Entity branding has one authority. Stop Navigation from receiving unused SiteSettings data. Keep `showAuthActions` only on the Auth widget.
8. **Keep Hero/Image composition order-based.** Preserve independent placement identity and the existing `seamlessAfter` registry capability; do not add Marketing-specific group persistence.
9. **Generalize integrity by binding semantics.** Protect bound Entity contracts and required Components; protect selected semantic records only when the slot policy requires it; allow normal row CRUD in record sets; protect relation Components from incompatible mutation while bound.
10. **Converge authenticated/public runtime on one resolver.** Resolve definition → validated source binding → bounded records/relations → explicit typed adapter → authenticated/public DTO. Preserve public redaction and safe resource/action validation.
11. **Replace raw JSON customization comparison.** Use registry-aware canonical source/presentation semantics consistent with the existing semantic hash implementation. Binding-only source changes must change semantic hash/sync, but inherited source binding metadata must not by itself mark an application presentation customized.
12. **Make overlay inheritance strict.** Base placement owns source binding. Overlay overrides cannot persist, drop or replace bindings; they can change only registered presentation/composition deltas. Independent scoped layouts own full bindings.
13. **Define source removal for required bindings.** Do not let a source-managed Entity widget silently survive active with `source_config = NULL`. Fail/resolve through explicit lineage conflict/removal semantics.
14. **Generalize authoring behavior from declared capabilities.** Replace Hero magic strings with slot/cardinality/ownership/Add-Duplicate capabilities. Record-set Duplicate shares sources by default; Hero/Image single-record Duplicate clones content by default; deep-copying an entire collection is a separate explicit operation. Define explicit UI Contracts for each selector shape and preserve the established StandardDialog/focus/localization patterns in authoring hosts.
15. **Preserve MUI 9.2.0 and renderer isolation with measurable browser oracles.** No MUI upgrade or custom layout abstraction is required. Strengthen package-boundary deny rules, optionally add a Marketing-specific allowlist, and preserve the existing `1920x1080` / `768x1024` / `390x844` matrix, EN/RU, light/dark, Axe WCAG 2/2.1 A/AA, keyboard/focus/Escape, no horizontal overflow, fixed/flow header behavior, anchor occlusion/scroll padding, the 28px header visual offset, and current Hero geometry/background invariants.
16. **Resolve record-set semantics before the renderer.** The resolver applies visibility, semantic ordering, hard safety limits and placement `maxItems` before producing typed DTOs. Binding target canonicalization is set-like metadata and never encodes content order.
17. **Perform a true clean cutover.** Remove every old `source`/`copySource` schema/reader/field-map/seed path and content-bearing Brand/Image/page-logo config. Fresh-template negative tests must prove retired payloads are rejected. Keep the database schema, minimum structure version and Marketing Page template version unchanged unless another independent requirement forces a change.

This is sufficiently specific for PLAN to phase implementation without inventing a second content model or leaving the selector/ownership matrix unresolved.

## Open Questions Before PLAN

None.

Source inspection resolves the previous REF-storage question: Object-target REF values are materialized as referenced record UUIDs. PLAN still has mandatory implementation detailing to perform, especially the per-selector UI Contracts and exact extension of the existing browser matrix, but these are acceptance/design details within the frozen architecture rather than unresolved product or storage decisions.

## Sources

-   https://mui.com/material-ui/getting-started/templates/
-   https://mui.com/material-ui/react-grid/
-   https://mui.com/material-ui/react-stack/
-   https://mui.com/material-ui/guides/responsive-ui/
-   https://www.contentful.com/headless-cms/
-   https://www.contentful.com/help/content-models/content-modelling-basics/
-   https://www.contentful.com/help/content-models/
-   https://1c-dn.com/library/tutorials/practical_developer_guide_catalog_forms/
-   https://1c-dn.com/library/tutorials/practical_developer_guide_form_data_and_controls/
-   Context7 library: `/mui/material-ui/v9.2.0` (queried 2026-09-27; relevant upstream docs include Grid, Stack, TextField, Select and Dialog/Form composition guidance).
-   User task specification for the complete Marketing Page Entity-backed widget cutover (2026-09-27)
-   QA-reviewed architecture brief for the complete Marketing Page Entity-backed widget cutover (2026-09-27)
-   `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`
-   `memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md`
-   `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`
-   `memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md`
