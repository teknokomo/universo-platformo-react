# Research: Unified Entity-Backed Widget Authoring and Marketing Hero Pilot

> Created: 2026-09-20
> Status: Reviewed and QA-refined on 2026-09-21
> Trigger: RESEARCH request for additional repository, prior-research, subagent, web, and Context7 analysis
> Follow-up plan: `memory-bank/plan/unified-entity-backed-widget-authoring-hero-pilot-plan-2026-09-22.md`

## Research Question

What is the smallest reusable contract that makes application-template widgets
authoring and rendering adapters over canonical Entity data, while preserving
the existing metahub-to-application layout lifecycle? Which clean-break changes
are required to prove that contract by migrating only marketing.hero in the
marketing-page metahub template?

This research supports a decision-focused PLAN. It is not an implementation
plan. No product code, database schema, template version, or MANAGER file was
changed during this research.

## Scope And Method

The supplied source input and technical brief were read in English and
Russian. The current repository was inspected directly around the shared
widget registry, marketing schemas, template seed, runtime serializers,
application layout persistence, effective-layout resolution, snapshot/sync
materialization, hashing, and the MUI authoring surface.

The following skills and tools were used:

-   research-before-plan and the repository RESEARCH/PLAN mode rules.
-   universo-platform-architecture, mui-runtime-ux-patterns, and runtime-ux-qa.
-   ontoindex-code-intelligence for graph and symbol exploration. On the QA pass
    the indexed commit exactly matched current HEAD
    (3c52b966bbff89f44cd58b62619488870b7a284f). The graph is therefore not
    stale for tracked product source. Semantic retrieval is degraded because
    embeddings/sidecar enrichment are unavailable and the worktree contains
    Memory Bank/agent-instruction changes, so direct current source remains the
    authority for the conclusions below.
-   Context7 for /mui/material-ui/v9.2.0, including Dialog focus behavior,
    slot APIs, Autocomplete/Select labeling, and responsive Grid guidance.
-   The QA pass rechecked the actual workspace compatibility baseline:
    Material UI 9.2.0, React/React DOM 18.3.1, Zod 3.25.76, and TypeScript
    5.9.x from the current workspace/lockfile. Current public documentation is
    comparative evidence; it does not authorize dependency upgrades.
-   Primary web sources were refreshed on 2026-09-21: the official MUI template
    and Dialog pages, React list-key guidance, PostgreSQL transaction-isolation
    guidance, Contentful field-editor documentation, and Sanity reference
    documentation.
-   Five completed read-only subagent reviews are incorporated: runtime source,
    lifecycle/materialization, historical-research reconciliation, UX and
    authoring contract, and cache/security enforcement. They inspected the Hero
    runtime source path, snapshot/sync/materialization, source_config, overlay
    replacement, restore remapping, cardinality, authoring scope, query
    invalidation, and safe action boundaries. The subagents did not edit files.
    One additional code-review stream disconnected before producing a result;
    no conclusion below depends on that stream.

## QA Status

The artifact is QA-refined for handoff to PLAN. The review verified the two
briefs, the full `.backup/Архитектура-виджетов.md`, linked prior research, the
current source paths and package READMEs, the pinned stack, exact-version
Context7 material, refreshed primary web sources, OntoIndex freshness, and
independent read-only subagent findings. Corrections were applied in this
file and `currentResearch.md` for cardinality, editor scope, source-owned API
enforcement, lifecycle transport, query/cache invalidation, safe actions and
resources, and field-level UI limits.

No new browser, integration, database, or implementation test was run in this
research/QA pass. Current runtime/browser evidence therefore remains baseline
evidence only; the new MarketingPageHero seed, resolver, authoring surfaces,
direct API negatives, and cache lifecycle still require implementation-time
proof. Existing product code and MANAGER files were not changed.

## Source Inventory

| Source                                                                                                                                                      | Type                                                | Date / Freshness                                              | Why It Matters                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified Entity-Backed Widget Architecture original brief (maintained outside this repository)                                                                | External brief input                                | 2026-09-20                                                    | States the architectural problem, clean-break boundary, and required research scope.                                                                                             |
| Unified Entity-Backed Widget Authoring Hero Pilot specification (maintained outside this repository)                                                        | External technical brief                            | 2026-09-20                                                    | Defines the Hero pilot, neutral binding goals, lifecycle questions, UI contract, and acceptance gates.                                                                           |
| memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md                                                                                   | Prior repository research                           | 2026-08-30                                                    | Establishes template isolation, Object/Component ownership, metahub/application/workspace boundaries, and the no-version-bump clean break.                                       |
| memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md                                                                               | Prior repository research                           | 2026-09-04                                                    | Establishes the widget lifecycle, typed runtime view-model boundary, source binding, and the earlier neutral-envelope direction.                                                 |
| memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md                                                             | Prior repository research                           | 2026-09-07                                                    | Records the target-first effective-layout and publication/materialization invariants already implemented in the checkout.                                                        |
| .backup/Архитектура-виджетов.md                                                                                                                             | Earlier local architecture analysis                 | Historical; current repository has advanced                   | Supplies the headless-widget intuition, but its generic JSONB recommendation must be reconciled with the current typed Entity model.                                             |
| packages/universo-react-types/src/common/layoutWidgetDefinitions.ts                                                                                         | Current source                                      | Current checkout                                              | Defines the shared serializable widget/zone registry; it currently describes composition and placement, not Entity binding slots.                                                |
| packages/universo-react-types/src/common/layoutEnvelope.ts                                                                                                  | Current source                                      | Current checkout                                              | Defines the reserved \_\_layout neutral metadata envelope and the single persisted JSON carrier.                                                                                 |
| packages/universo-react-types/src/common/marketingPage.ts                                                                                                   | Current source                                      | Current checkout                                              | Defines the marketing source precedent, marketing allowlists, Hero config, and runtime model.                                                                                    |
| packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts                                                              | Current source                                      | Current checkout                                              | Is the canonical bootstrap path for marketing Objects, Components, records, and widget instances.                                                                                |
| packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts                                                              | Current source                                      | Current checkout                                              | Shows the authenticated marketing runtime's fixed source/copy loading and widget-key branches.                                                                                   |
| packages/universo-react-applications-backend/src/services/publicMarketingRuntime.ts                                                                         | Current source                                      | Current checkout                                              | Shows the parallel public serialization path that must not drift from the authenticated resolver.                                                                                |
| packages/universo-react-apps-template-mui/src/marketing-page/{normalize.ts,types.ts,MarketingPage.tsx,MarketingWidgetRenderer.tsx}                          | Current source                                      | Current checkout                                              | Preserves the typed, persistence-free runtime rendering boundary and exposes the dead Hero copy path.                                                                            |
| packages/universo-react-template-mui/src/components/layouts/MarketingWidgetConfigDialog.tsx                                                                 | Current source                                      | Current checkout                                              | Provides the existing shared marketing authoring dialog and source-selection precedent.                                                                                          |
| packages/universo-react-applications-backend/src/persistence/{applicationLayoutStoreSupport.ts,applicationLayoutWidgetSyncStore.ts,effectiveLayoutStore.ts} | Current source                                      | Current checkout                                              | Defines config envelopes, source baselines, reset/sync behavior, and customized/effective widget state.                                                                          |
| packages/universo-react-applications-backend/src/routes/sync/{syncHelpers.ts,syncLayoutPersistence.ts}                                                      | Current source                                      | Current checkout                                              | Defines snapshot normalization, materialization, and comparable widget content.                                                                                                  |
| packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts and SnapshotRestoreService.ts                                                | Current source                                      | Current checkout                                              | Defines snapshot export, source-baseline exclusion, and the allowlisted physical-reference remapping boundary.                                                                   |
| packages/universo-react-applications-backend/src/routes/sync/syncEngine.ts and services/effectiveLayoutResolver.ts                                          | Current source                                      | Current checkout                                              | Defines published application sync, overlay materialization, and effective runtime layout resolution.                                                                            |
| packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts                                                                             | Current source                                      | Current checkout                                              | Defines semantic layout/widget hashing and therefore the conflict/cache consequence of a new binding field.                                                                      |
| Package READMEs for `types`, `metahubs-backend`, `applications-backend`, `apps-template-mui`, and `template-mui`                                            | Current package guidance                            | Current checkout                                              | Confirms additive shared-type evolution, SQL-first/domain boundaries, typed persistence-free runtime, safe action/media handling, and consumer-owned queries/cache invalidation. |
| pnpm-workspace.yaml and pnpm-lock.yaml                                                                                                                      | Current workspace configuration                     | Current checkout                                              | Confirms the implementation baseline: MUI 9.2.0, React/React DOM 18.3.1, Zod 3.25.76, and TypeScript 5.9.x.                                                                      |
| https://tanstack.com/query/latest/docs/framework/react/guides/query-keys                                                                                    | Primary framework documentation                     | Refreshed 2026-09-21                                          | Supports making runtime query identity explicit and including every variable used by a query.                                                                                    |
| https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient                                                                        | Primary framework documentation                     | Refreshed 2026-09-21                                          | Supports awaited, targeted invalidation after binding/content/layout mutations.                                                                                                  |
| https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html                                                          | Primary security guidance                           | Refreshed 2026-09-21                                          | Supports server-side allowlists or server-mapped targets for user-controlled action URLs.                                                                                        |
| Context7: /mui/material-ui/v9.2.0                                                                                                                           | Primary framework documentation                     | Queried 2026-09-21 against the repository-pinned Core version | Confirms MUI Dialog/form composition, accessible Select labeling, and other authoring primitives without assuming a newer MUI API.                                               |
| https://mui.com/material-ui/getting-started/templates/                                                                                                      | Primary framework documentation                     | Refreshed 2026-09-21                                          | Confirms that the marketing template is a responsive set of reusable sections; the repository backup remains the implementation provenance.                                      |
| https://mui.com/material-ui/react-grid/                                                                                                                     | Primary framework documentation                     | Rechecked against the MUI 9.2.0 Context7 baseline             | Supports breakpoint-based responsive authoring/runtime layouts and discourages treating layout composition as data-grid behavior.                                                |
| https://mui.com/material-ui/react-dialog/                                                                                                                   | Primary framework documentation                     | Refreshed 2026-09-21                                          | Provides the current public Dialog contract used alongside exact-version Context7 evidence.                                                                                      |
| https://react.dev/learn/rendering-lists                                                                                                                     | Primary framework documentation                     | Refreshed 2026-09-21; repository runtime is React 18.3.1      | Requires stable data-derived keys for repeatable widget instances and explains why positional/render-generated keys are unsafe when items move.                                  |
| https://www.postgresql.org/docs/current/transaction-iso.html                                                                                                | Primary database documentation                      | Refreshed 2026-09-21                                          | Supports explicit transaction/OCC design and whole-transaction retries when a chosen isolation/locking strategy can raise serialization failures.                                |
| https://www.contentful.com/developers/docs/extensibility/field-editors/overview/                                                                            | Vendor documentation / secondary comparative source | Refreshed 2026-09-21                                          | Demonstrates a specialized field editor over typed entry fields without making the editor a second content store.                                                                |
| https://www.contentful.com/help/content-models/content-modeling-patterns/                                                                                   | Vendor documentation / secondary comparative source | Checked 2026-09-20                                            | Provides fixed-versus-flexible assembly and localization/reference comparisons for future one-to-many bindings.                                                                  |
| https://www.sanity.io/docs/studio/connected-content                                                                                                         | Vendor documentation / secondary comparative source | Checked 2026-09-20                                            | Provides a reference-picker and referential-integrity comparison for future human-readable rebinding.                                                                            |
| https://www.sanity.io/docs/developer-guides/how-to-use-structured-content-for-page-building                                                                 | Vendor documentation / secondary comparative source | Checked 2026-09-20                                            | Supports the distinction between reusable referenced records and page/widget composition.                                                                                        |

## Key Findings

### 1. The repository already has most of the composition lifecycle

Observed facts:

-   layoutWidgetDefinitions.ts is already the shared, serializable registry for
    widget keys, template support, allowed zones, repeatability, and
    presentation capabilities. It is the correct neutral ownership boundary.
-   layoutEnvelope.ts already reserves one system namespace, \_\_layout, in the
    existing persisted widget JSON carrier. The codec strips neutral metadata
    before renderer configuration is parsed and can preserve neutral metadata
    while renderer settings are replaced.
-   Application rows already distinguish effective renderer config from
    source_config, carry source lineage, and compute customized state. The
    current source sync path updates config and source baseline together for
    source-owned rows, while reset returns to the source baseline.
-   Effective-layout resolution, snapshot normalization, and application
    materialization already carry semantic layout/widget identity separately
    from physical row IDs. The current architecture therefore does not require
    a second marketing-only persistence path.
-   Template seed data is exported through snapshot layout serializers; source
    baselines are excluded from publication, while neutral envelope data is
    expected to round-trip. Published application sync then materializes base
    and overlay widgets. An overlay uses override.config or baseWidget.config,
    so the widget configuration is replaced as a whole rather than merged by
    arbitrary binding fields.
-   Snapshot restore remaps physical entity references through an explicit
    allowlist. A new binding reference must either remain semantic by design or
    receive a dedicated restore/remap rule; an unrecognized physical ID field
    must not be copied from a source scope into a destination scope.
-   apps-template-mui already receives a typed normalized marketing view model.
    Its renderer does not query Entity storage and should keep that boundary.

Inference:

The missing architectural layer is a binding/editor contract, not a new
content database or a general page-builder rewrite. The pilot should extend
the existing neutral registry and envelope instead of adding another widget
registry or another JSON document model.

### 2. The current Hero has a real duplicate source path, and it is already dead in rendering

Observed facts:

-   The seeded marketing.hero widget currently declares a primary
    MarketingPageSiteSettings/site-settings source and a
    MarketingPageSection/hero copySource.
-   MarketingPageSection/hero contains section Title/Description data.
-   The actual Hero fields are on MarketingPageSiteSettings: title, accent,
    subtitle, lead-form labels/placeholders, primary action labels/targets, and
    terms/link fields.
-   Both runtimeMarketingPageController.ts and publicMarketingRuntime.ts still
    load source and copy records through fixed marketing-specific branches.
-   normalize.ts creates the Hero runtime model from the site-settings record;
    the section copy is not part of MarketingHeroData and is dropped before
    rendering.
-   The marketing source schema is syntactically general enough to carry
    entityKind, entityCodename, recordKey, and fieldMap, but
    refineMarketingWidgetSources restricts the current adapter to known
    marketing Object codenames and a keyed MarketingPageSection copy source.

Inference:

The section copy is obsolete duplication, not data that needs migration or a
compatibility read. The clean Hero cut should delete that copy row and remove
the superseded Hero fields from MarketingPageSiteSettings. A new
Object-backed MarketingPageHero record should become the sole content
authority. Both runtime serializers must use the same generic server-side
resolution path; leaving one fixed branch in the public path would preserve
the architectural split.

### 3. Binding slots and binding instances are different contracts

The brief correctly separates two concerns:

1. A widget definition declares the accepted shape. This includes slot name,
   required capabilities, required Components/schema fields, cardinality (one
   or many), and whether a relation-backed source is supported. An
   `allowedEntityKinds` list can narrow a slot where needed, but it must not
   be the foundation of the platform-wide contract: custom Entity Types must
   be able to satisfy the same capability/field contract without extending a
   central built-in-kind enum.
2. A widget placement stores the semantic binding selected for that instance:
   Entity kind, Entity codename, and a typed semantic selector (for example a
   singleton/default record selector or a bounded collection selector).
   Physical schema/table names and runtime row IDs do not cross this boundary.

Current marketing `recordKey` is a precedent for such a selector, but it is
not yet a universal platform record identity. Both marketing runtime
serializers compare `recordKey` with a normalized `semanticKey`, and that
`semanticKey` is derived from an Object-specific key Component (with
`codename` only as a legacy fallback). The neutral contract must therefore
define how a slot obtains and validates semantic record identity instead of
assuming that every Entity kind already exposes the same `recordKey`
mechanism.

A minimal neutral shape for PLAN to refine is:

    BindingSlotDefinition {
      slot: string
      cardinality: one | many
      requiredCapabilities: string[]
      requiredComponents: ComponentRequirement[]
      allowedEntityKinds?: EntityKind[]
    }

    EntityBinding {
      entityKind: EntityKind
      entityCodename: string
      selector?: SemanticEntitySelector
      fieldMap?: SlotFieldProjection
    }

    WidgetBindingInstances {
      [slot: string]: EntityBinding | EntityBinding[]
    }

This is a contract sketch, not an instruction to copy these names literally.
Slot names should be widget-adapter-owned (content for Hero); the shared
registry must not import MARKETING_SOURCE_CODENAMES or any other
template-specific list. Marketing validation can then restrict the Hero slot
to the MarketingPageHero capability and required Components.

The existing marketingWidgetSourceSchema is a useful structural precedent,
but it should not become the shared schema unchanged. Its current allowlist,
record-key interpretation, and copySource rules are adapter-specific. The
generic contract should express capabilities, cardinality, selector semantics,
and field requirements, while the marketing adapter validates the actual
Entity model and fields. Any field projection is defined by the slot's typed
allowlist; a client-supplied arbitrary `Record<string, string>` must never
become a field-access query language.

### 4. The existing reserved neutral carrier is the strongest pilot candidate, with lifecycle changes required

The current \_\_layout envelope is already designed to keep system metadata
outside renderer-owned settings and to survive renderer-config replacement.
`persistedWidgetNeutralMetadataSchema` is strict and currently contains only
`placement`, so a binding would be an explicit extension of this contract,
not an already-supported field. The strongest low-duplication pilot direction
is therefore:

-   keep presentation/composition options in renderer config;
-   store the semantic binding instance in a typed neutral \_\_layout member;
-   keep the existing physical JSON carrier and snapshot/schema boundaries;
-   expose decoded binding metadata only through typed APIs, not as arbitrary
    JSON in normal UI;
-   use one codec for metahub layouts, application layouts, snapshot import/export,
    effective layouts, and runtime transport.

The exact member name (binding versus bindings), selector vocabulary, and
final envelope shape remain PLAN decisions. A plausible Hero instance would
have one content binding to MarketingPageHero and its semantic default
selector. The important constraint is that this remains typed system-owned
metadata, not renderer configuration masquerading as a data source.

The current storage lifecycle also exposes a subtle transport gap:
`_app_widgets.source_config` stores the whole encoded widget config and reset
writes it back atomically, but `applicationLayoutStoreSupport.ts` currently
decodes `source_config` to renderer-only `sourceConfig` for typed API
responses. If binding metadata lives in `__layout`, a future application
rebind UI cannot infer its inherited binding from the existing
`sourceConfig` response. The source-owned Hero pilot avoids that UI need,
but the typed application contract must still be extended before local
rebinding is introduced.

There is a lifecycle hazard that must be made explicit. Current semantic hash
normalization includes effective widget settings and neutral placement, but a
new binding placed in \_\_layout will be invisible if the hash only sees the
renderer config. The hash/comparison path must explicitly include the semantic
binding. The same applies to source_config, reset, source synchronization,
snapshot export/import, restore remapping, overlay materialization, and
replaceWidgetRendererConfig. A binding change that renders differently but
does not change the semantic hash would break conflict detection and cache
invalidation. The whole-config overlay rule also means that the neutral
binding cannot be assumed to merge with a base widget when an override exists.

The existing instanceKey is a stable layout multiplicity/React identity. It
must remain separate from the Entity binding identity. The binding should be
semantic (for example, Entity kind plus codename and a validated semantic
selector), or it must have an explicit physical-ID remap rule; using
instanceKey as a substitute would make layout identity and content identity
change together.

### 5. The Hero pilot should make binding source-owned

The brief leaves application rebinding open. For the first slice, the safer
and smaller decision is:

-   metahub owns the Hero content model, default record, and source-owned binding;
-   application control-panel authoring may override presentation settings;
-   application authoring does not rebind the Hero or create a second content
    authority;
-   reset and sync therefore retain the existing source baseline semantics for
    the binding;
-   human-readable rebinding and record provisioning are follow-up capabilities.

This still proves the generic binding contract because the widget instance
contains a semantic binding and the resolver materializes it. It avoids
inventing an application binding override precedence at the same time as the
first migration. If rebinding is later enabled, it needs an explicit
inherited/overridden state, a compatible record picker, Reset to source, and
separate hash/conflict semantics for the local binding override.

This recommendation is consistent with the existing source_config model:
the source baseline is a whole encoded widget configuration, not a separate
binding table. A pilot that allows local binding overrides must define whether
the baseline stores the source binding, whether a local binding is compared as
part of customization, and how a source rebind is merged with a local
presentation override. Deferring that branch reduces the first-slice risk.

Source ownership is a server invariant, not only a UI choice. The current
application persistence path rejects client-supplied `__layout` metadata from
the ordinary renderer-config mutation, while the neutral envelope is strict
and currently contains only placement. PLAN must therefore define the trusted
server-side seed/materialization/write path that can carry the Hero binding,
and make the ordinary application widget-config API reject a direct binding
mutation. A hidden or disabled control is insufficient: a negative direct-API
test must prove that an application caller cannot rebind the pilot Hero.

### 6. Runtime resolution must have one generic contract and server-owned scope adapters

The shared resolver contract should accept a semantic binding, widget slot
contract, and a scope-appropriate record loader, then:

1. resolve the Entity metadata in the current scope;
2. resolve the semantic record or bounded record set;
3. verify published/available state and the requested cardinality;
4. verify required capabilities and Components;
5. project only the fields allowed by the widget definition;
6. return a typed adapter input for the marketing normalizer;
7. fail closed on missing, incompatible, malformed, or unauthorized data.

The resolver must never accept arbitrary schema/table identifiers or let a
client turn fieldMap into unrestricted runtime field access. A client may
select a semantic binding only from a server-provided compatible set if that
surface is later exposed.

Runtime freshness is part of the same contract. The 2026-09-07 research
identified target/content-selection context as part of runtime identity. PLAN
must define stable query-key inputs for application, target, selected layout,
semantic selector, locale and other actual query variables, and use the
resulting `effectiveHash`/equivalent freshness token where the runtime cache
needs it. Binding/content mutation, publish/sync/reset, and target switching
must perform targeted, awaited invalidation. A changed layout hash alone does
not prove that an already cached runtime response has been refreshed; current
TanStack Query documentation makes both the variable-complete key and the
promise-returning invalidation contract explicit.

Both runtimeMarketingPageController.ts and publicMarketingRuntime.ts currently
contain parallel marketing source assembly. The Hero migration should share
the selector/capability/cardinality/field-projection logic and resulting typed
adapter contract. It does not require both paths to use the same physical
query implementation: authenticated runtime and anonymous/published runtime
have different authorization/read boundaries and may provide different store
adapters. This retains the security boundary while preventing the public
serializer from becoming a second interpretation of binding semantics.

Repository data-access rules still apply. Domain resolution should compose
store functions over a supplied `DbExecutor`; authenticated RLS flows use
the request-scoped executor, while intentionally public/bootstrap flows use
their existing trusted/public boundary. The resolver must not instantiate a
Knex/Supabase client or bypass the SQL-first store layer.

Hero action targets must reuse the repository's server-owned action/resource
contract. Validate internal routes or allowlisted hosts and protocols on the
server, keep `target`/`rel` typed, and add negative tests for unsafe schemes,
untrusted hosts, and unauthorized resource references. Do not move preview
media into MarketingPageHero: the existing marketing.image/resource boundary
remains the separate media contract. This follows the OWASP guidance that
unvalidated destination URLs can become open redirects and that allowlists or
server-side target mapping are safer than accepting arbitrary URLs.

### 7. Entity model and field ownership for Hero

The pilot should create an Object preset named MarketingPageHero, localized
Components, and one semantic default record in
marketing-page.template.ts. It should not introduce a built-in Entity kind,
a widget-owned table, or an opaque JSON content document. The Object can
contain additional records for future repeated Hero instances, even though
the first seed contains one.

The first field contract should be explicit:

| Category        | Candidate fields                                                              | Ownership                                                                       |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Content         | localized title, accent, subtitle/description, email label, email placeholder | MarketingPageHero Components                                                    |
| Content         | primary action label and safe target; terms text, link label, and safe target | MarketingPageHero Components or existing action Component contract              |
| Presentation    | showLeadForm, visibility/active state, logical placement, layout variant      | widget/layout instance                                                          |
| Separate widget | background/media source                                                       | existing marketing.image media contract unless the plan deliberately changes it |
| Behavior        | form submission, navigation, other programmable actions                       | Entity Modules or existing platform action contract                             |

The current site-settings names (HeroTitle, HeroAccent, HeroSubtitle,
HeroEmailLabel, HeroEmailPlaceholder, HeroPrimaryActionLabel,
HeroPrimaryActionHref, HeroTermsText, HeroTermsLinkLabel, and HeroTermsHref)
are useful evidence of the existing content surface, not a requirement to
preserve the old component names. PLAN should choose one canonical
subtitle/description field rather than recreating both the current subtitle
and the obsolete section description. Long text must use multiline controls.

The current seed's limits are a useful pilot baseline and must be preserved
unless PLAN explicitly changes them: title 255, accent 120, subtitle/description
2000, email label and placeholder 120, primary action label 120, action target
500, terms text 500, terms link label 120, and terms target 500. Subtitle and
terms are multiline fields. The action target is a typed safe route/URL control
with server validation, never a JSON or arbitrary action-object editor. Hero
authoring does not show a background/media field; media remains a separate
widget/resource surface.

### 8. Specialized authoring must be a facade over the generic Entity editor

There are four distinct user surfaces:

1. A metahub specialized Hero editor for the canonical model/default content
   and template baseline.
2. The generic Entity editor for the same MarketingPageHero record.
3. An application control-panel Hero settings surface for deployment-level
   presentation settings.
4. The published application/Workspace runtime surface.

The specialized editor should reuse the same field definitions, validation,
localization, and write services as the generic Entity editor. It may offer a
more focused layout and hide the default binding, but it must not maintain a
second schema or a different interpretation of requiredness/max lengths.

The lifecycle ownership must be explicit:

-   **Metahub specialized Hero editor:** edits the seeded canonical Hero record
    and metahub baseline presentation. The source-owned binding is implicit. It
    does not edit Entity schema or Components definitions.
-   **Metahub generic Entity record editor:** edits the same MarketingPageHero
    record through normal Entity operations. Schema and Component changes remain
    in the normal Entity-definition tools.
-   **Application control panel:** edits only approved deployment-level
    presentation overrides. Hero content and binding are not editable in the
    pilot. If source ownership is shown, use a localized “managed by the
    metahub/source” state; never expose codename, recordKey, UUID, or physical
    identifiers.
-   **Published application/Workspace:** renders Hero and exposes no
    MarketingPageHero CRUD in this pilot. The seeded record is
    configuration-owned, not workspace-owned user content.

Fields outside a surface's lifecycle scope are not rendered as editable
controls. Permission denial applies only to controls belonging to that
surface and renders them read-only/disabled with a localized explanation.

The pilot UI contract requires:

-   real EN/RU labels, helper text, validation, and error messages;
-   localized text fields and multiline inputs for subtitle/description and
    terms;
-   the same localization contract as the generic Entity editor: locale changes
    use a human-readable locale UI rather than JSON, preserve dirty state, and
    make the fallback policy explicit before PLAN. For the pilot, every visible
    required Hero field has an EN and RU value so acceptance does not depend on
    hidden fallback;
-   action controls that expose labels and safe targets as normal fields, never
    JSON or raw action objects;
-   presentation switches/selects for showLeadForm and approved layout options;
-   an implicit binding for the seeded default; if a picker is later enabled,
    it must show human-readable compatible record names and a reset action;
-   `StandardDialog`, or the canonical specialized dialog built on it, with the
    standard action spacing, focus trap/restoration, first-invalid-field focus,
    keyboard Save/Cancel, and Enter behavior that does not submit from a
    multiline field. A merely behavior-compatible bespoke MUI Dialog is not
    sufficient;
-   responsive layouts using existing MUI primitives at 1920x1080, 768x1024,
    and 390x844 without page-level horizontal overflow. At 390x844 the dialog
    must scroll internally, long Russian labels must wrap, and Save/Cancel must
    remain reachable and accessible.

Content mutation, presentation mutation, and future rebinding are separate
authorization capabilities even if a single dialog displays their controls.
Denied controls must become read-only/disabled with localized explanation; the
normal flow must not rely on saving an invalid form and waiting for a 403.

The save contract must also be explicit. The preferred pilot boundary is
content-only writes through the generic Entity operation and application-level
presentation writes through the layout operation. If the metahub specialized
surface edits both in one action, the backend must wrap both mutations in one
transaction or expose visibly separate save scopes. A false appearance of
atomicity would leave the Entity and layout out of sync. PostgreSQL documents
that stronger transaction isolation can detect serialization anomalies but
requires retry handling, so the plan must align this choice with the
repository's existing optimistic versions and locks.

### 9. Repetition needs a stable instance identity and a human content identity

The current marketing registry marks Hero as repeatable. A layout instanceKey
identifies the widget placement and is appropriate for React keys and layout
lifecycle. It must not be confused with the Entity record key. React's current
documentation requires stable keys for list items and warns against
positional or render-generated keys when items can be inserted, deleted, or
reordered.

**Pilot cardinality UI contract.** Until a human-readable second-Hero
binding/create-content flow exists, `marketing.hero` is single-instance in
normal authoring UI. The shared widget metadata must expose an effective
`maxInstances: 1`/non-repeatable authoring contract for this pilot. Add and
duplicate actions are unavailable after the first Hero and show a localized
explanation where the surface needs to explain the limit. The server-side
mutation contract enforces the same cardinality, including direct API calls.
Duplicating a Hero must never silently reuse the same content binding, and
deleting a widget placement must not delete its `MarketingPageHero` Entity
record. The Object may support additional records internally for a future
repeated-Hero flow.

The generic contract must still support:

-   one binding for the Hero pilot;
-   a future many-record slot for marketing.collection;
-   a future human-readable compatible-record picker or a specialized
    create-content flow for a second Hero;
-   fail-closed behavior when a repeated instance points at a missing or
    incompatible record.

A normal user must never be asked to type recordKey, UUID, codename, or a
physical ID to create a future second instance. The generic registry can
retain the broader repeatability capability for later templates, but the
effective Hero pilot metadata and API must be single-instance.

### 10. The implementation contract must match the repository-pinned TypeScript/Zod/React/MUI stack

The current checkout resolves Material UI 9.2.0, React/React DOM 18.3.1,
Zod 3.25.76, and TypeScript 5.9.x. This produces several concrete planning
constraints:

-   binding-slot and persisted-binding schemas should be strict Zod 3-compatible
    boundary schemas; unknown snapshot/API data must be parsed before persistence
    or resolution;
-   variants such as selector/cardinality kinds should use explicit
    discriminators rather than open objects whose interpretation depends on
    downstream casts;
-   TypeScript types should be inferred/shared from the neutral schemas where
    practical so authoring, snapshot, application, and runtime paths cannot
    silently diverge;
-   React list identity remains `instanceKey`/another stable persisted layout
    identity, while Entity selector identity remains separate;
-   MUI examples from current public docs must be checked against 9.2.0 before
    implementation; no dependency upgrade is implied by this research.
-   The package READMEs reinforce the same boundary: shared type evolution is
    additive, metahub/application backends stay SQL-first and store-driven,
    apps-template-mui remains typed and persistence-free, and the shared MUI
    package stays domain-neutral while consumer packages own routes, permissions,
    queries, cache invalidation, and server-error presentation. The PLAN should
    add binding metadata through those existing boundaries rather than putting
    marketing persistence or query logic into a shared UI package.

### 11. The earlier .backup architecture research is directionally correct but needs three explicit updates

The earlier `.backup/Архитектура-виджетов.md` was analyzed, not merely cited.
Its core direction remains correct:

1. canonical semantic content belongs to the Entity model, while widgets are
   specialized visual editors/renderers over that model;
2. reusable content should not be copied into per-widget presentation state;
3. data access/rendering should remain separated through server/API
   boundaries.

Three older recommendations must be narrowed for the current repository:

-   broad JSONB flexibility is appropriate for the existing typed layout
    envelope and transport metadata, but it should not replace Object/Component
    records as the canonical Hero content model;
-   "a content type per widget" should not be interpreted as a new built-in
    Entity Type or physical table per widget. The current platform already has
    the Object preset, Components, capabilities, and Modules; the Hero needs a
    dedicated Object model because its content semantics justify it, not because
    every renderer must own a model;
-   renderer components should not independently issue generic REST/GraphQL
    Entity queries. The current apps-template boundary is intentionally typed
    and persistence-free; server-side binding resolution should feed the
    existing normalized view model.

These updates preserve the useful headless-CMS principle from the earlier
research while aligning it with the platform architecture that now exists.

### 12. External framework comparisons support the direction, not the exact API

The official MUI template catalog describes marketing pages as reusable
sections assembled into a responsive page. Exact-version Context7 evidence
for MUI 9.2.0 confirms normal Dialog/form composition and accessible Select
labeling. These sources support the existing package/primitives and UX
requirements; they do not define persistence or Entity semantics.

Contentful's field-editor documentation demonstrates a specialized editing
component over typed entry fields. Its content-modeling guidance separates
fixed assembly from flexible reference-based assembly and documents
localization/default-locale concerns. Sanity's connected-content guidance
demonstrates human-readable reference search, opening/editing referenced
documents, and referential-integrity behavior. These are useful comparisons
for future record pickers and one-to-many composition. They do not justify
copying a CMS schema into this repository: Universo already has Entity
presets, Components, Modules, RLS, publication, and materialization
boundaries.

## Conflicts And Uncertainty

-   .backup/Архитектура-виджетов.md recommends a broadly generic headless
    approach and discusses JSONB as a possible content carrier. That is
    directionally useful but too broad for the current checkout. JSONB remains
    an acceptable physical carrier for the existing layout envelope; it should
    not become the canonical Hero content model because the repository already
    has typed Object/Component records.
-   Older 2026-09-04 research describes earlier gaps in widget persistence and
    marketing dispatch. The current checkout has since gained a typed marketing
    registry, persisted widget instances, neutral layout envelope, and effective
    layout lifecycle. Those older statements are historical findings, not
    current absence claims.
-   The marketing source schema looks generic at its outer boundary but its
    refinement and runtime consumers are marketing-specific. Merely renaming
    source to binding would leave the coupling in place.
-   The current Hero registry is repeatable while the seed has one default
    content record. This is resolved for the pilot by an effective
    single-instance authoring/API contract; the generic Object may still hold
    additional records for a later human-readable repeated-Hero flow.
-   The current site settings record also owns brand, footer, and newsletter
    data. Moving only Hero fields must not accidentally move unrelated settings
    or make MarketingPageHero another mixed-purpose global settings record.
-   The brief allows application binding overrides, but the current source
    baseline model does not by itself specify inherited/overridden binding
    state. This research recommends source-owned binding for Hero and defers
    rebind semantics. That recommendation also requires a server-side rejection
    of direct application rebinding, because UI hiding alone is not an
    authorization boundary.
-   The exact action Component shape, safe target policy, locale fallback
    policy, and capability names are repository decisions that require direct
    source matching in PLAN. The action target must nevertheless retain the
    existing server-owned safe URL/resource boundary. External CMS references
    are comparative evidence only.
-   The current template seed already contains the sentence “Primary hero
    content is managed by the marketing hero object” inside the obsolete
    MarketingPageSection/hero record, even though MarketingPageHero does not yet
    exist. The clean-break implementation must remove that row with the old
    copySource rather than preserve a misleading placeholder.
-   The layout hash and source baseline are necessary lifecycle inputs but do
    not replace runtime cache invalidation. Query keys must include actual
    runtime selection variables, and binding/content/publish/sync/reset/target
    mutations need targeted awaited invalidation.
-   No new browser run was performed in this research pass. Existing marketing
    browser evidence proves the current runtime and UX gates, not the new
    MarketingPageHero contract, generic Entity parity, or missing-binding
    failures. Those remain implementation acceptance requirements.
-   OntoIndex HEAD freshness passed on the QA pass, and symbol/impact graph data
    is available for tracked source. Embeddings/sidecar enrichment are missing,
    semantic search returned no useful candidates, and the untracked research
    file is outside the graph. Direct source inspection therefore remains the
    authority for this research; product-code impact checks should still be
    rerun immediately before implementation edits.

## Project Implications

### Shared type and envelope boundary

Extend packages/universo-react-types/src/common/layoutWidgetDefinitions.ts
with serializable binding-slot metadata and keep it UI-framework-neutral.
Extend the validated neutral metadata in
packages/universo-react-types/src/common/layoutEnvelope.ts with the selected
semantic binding instance if PLAN confirms the reserved-envelope candidate.
Do not import marketing codename enumerations into the shared registry. Keep
marketingPage.ts as the adapter-specific capability/field validation layer
until a broader capability catalog exists.

The codec must be used consistently by:

-   metahub layout writes and the shared marketing authoring dialog;
-   application layout persistence and source_config;
-   snapshot export/import and materialization;
-   snapshot restore physical-reference remapping and whole-config overlay
    replacement;
-   effective-layout responses;
-   semantic hash/comparison and optimistic conflict checks;
-   authenticated and public marketing runtime serializers.

The shared slot definition should be capability/Component-first, with
`allowedEntityKinds` as an optional narrowing rule. The trusted metahub seed
and materialization path may write the source-owned Hero binding; the normal
application widget-config mutation must reject attempts to change it. If a
future application rebind is added, typed source/effective projections must
carry the inherited binding baseline rather than silently dropping it.

The physical JSON carrier and schema/template version boundary can remain
unchanged. This is a clean break against a newly recreated database, not a
compatibility migration.

### Template seed and model

Update
packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts
to create the MarketingPageHero Object, localized Components, one semantic
default record, and the Hero binding. Remove the old Hero fields from
MarketingPageSiteSettings and remove the MarketingPageSection/hero copy row.
Do not add a dual-write or fallback branch.

The plan must preserve the rest of the site-settings model and leave other
marketing widgets on their current contracts. The next migration candidate is
marketing.collection, where the many-record contract can be exercised
separately.

### Runtime and authoring

Refactor the Hero path in
runtimeMarketingPageController.ts and publicMarketingRuntime.ts around a
bounded generic binding resolver. Keep the normalized model and renderer in
apps-template-mui free of persistence knowledge. Reuse serializable metadata
between the shared authoring package and runtime packages without creating an
import from apps-template-mui into legacy template-mui.

The existing MarketingWidgetConfigDialog.tsx can remain the shared
presentation shell while its marketing-specific source controls are replaced
or narrowed by the new metadata contract. The Hero specialized editor should
be a facade over normal Entity writes, with the generic Entity editor able to
edit the same record and produce the same runtime result.

Application controls must expose only presentation in this pilot, and the
published application/Workspace must render without Hero CRUD. The dialog
must use `StandardDialog` or the canonical specialized wrapper, preserve the
generic Entity editor's EN/RU validation and dirty-state behavior, and apply
the existing MUI runtime UX rules for multiline text, safe controls, no raw
IDs/JSON, and mobile internal scrolling.

### Application lifecycle and materialization

Inspect and test these paths as one lifecycle:

    metahub seed
      -> metahub layout snapshot/publication
      -> application source_config/materialization
      -> effective-layout resolution
      -> authenticated/public runtime binding resolution

Semantic codename/selector identity must be carried across the lifecycle
while physical row IDs are remapped in the destination scope. The semantic
selector selects content within a binding; current marketing `recordKey` is
only one adapter-specific precedent and must never select the layout itself.
The binding must participate in:

-   source baseline and reset;
-   local customization detection;
-   source sync and source-hash comparisons;
-   snapshot export/import;
-   semantic layout/widget hash;
-   optimistic version conflict behavior;
-   effective-layout output and runtime resolution.

The source-owned pilot can preserve the current raw reset/sync semantics.
Any future application rebind must be a separate design with
inherited/overridden state, typed exposure of source-neutral binding metadata,
and a dedicated reset operation.

Runtime cache/query identity must also be planned with the same lifecycle:
include all actual target, layout, semantic-selector, locale, application,
and other request variables in stable query keys; carry an effective layout
freshness token where needed; and await targeted invalidation after binding or
content mutation, publication, sync, reset, and target switching. The hash is
one input to this contract, not a substitute for invalidation.

### Security and error handling

The resolver must use existing store/service authorization boundaries.
Shared binding semantics may use different authenticated/public record-loader
adapters, but both must verify the semantic Entity model and field capability
in their own publication/application scope. Missing, deleted, private,
incompatible, malformed, wrong-cardinality, and missing-required-component
cases must fail closed with one localized user-facing error contract where
the error reaches UI. Runtime code must not inject old SiteSettings copy or
demo text when the binding fails.

The source-owned decision must be enforced at the API boundary: an ordinary
application widget-config request that attempts to change Hero binding is a
denied mutation, even when no UI control exposes it. Action targets, resource
references, target/rel values, and media loading likewise use server-owned
allowlists and existing authorization/CSP boundaries.

### Acceptance and evidence

The implementation PLAN should include a test oracle covering:

-   new marketing metahub seed contains the Object/Components/default record and
    one Hero binding;
-   specialized Hero editing changes the same Entity record shown by generic
    Entity editing;
-   metahub publication/materialization preserves the semantic binding;
-   application presentation overrides survive reload and reset correctly;
-   runtime rendering survives application sync and reload;
-   authenticated and public serializer paths agree on Hero data where both are
    enabled;
-   missing/incompatible binding and wrong cardinality fail closed;
-   the Hero pilot exposes one effective authoring instance: Add and Duplicate
    are unavailable after the first Hero with localized explanation, direct API
    mutations enforce the same limit, and deleting a placement leaves the
    MarketingPageHero record intact;
-   the application control panel cannot rebind Hero through the UI or direct
    API, the published application/Workspace exposes no Hero CRUD, and the
    source-owned state is human-readable if surfaced;
-   permission denial covers content, presentation, and future rebind scopes;
-   EN/RU labels, content, validation, keyboard-only flows, and the three
    representative viewports;
-   the baseline field limits are enforced (title 255, accent 120,
    subtitle/description 2000, email label/placeholder 120, action label 120,
    action target 500, terms text 500, terms label 120, terms target 500), with
    multiline subtitle/terms and mobile internal dialog scrolling;
-   no raw IDs, codename/record keys, JSON, object cells, or page-level
    horizontal overflow appear on normal user surfaces;
-   unsafe action URLs, target/rel combinations, and unauthorized resource or
    media references are rejected by server-side tests;
-   the semantic hash changes when the binding changes and ignores physical IDs
    and other non-semantic lineage values;
-   a configured semantic selector resolves only against the slot-declared key
    contract and cannot turn `fieldMap` or selector input into arbitrary field
    access;
-   application APIs do not silently drop binding baseline state if/when local
    rebinding is enabled; the source-owned pilot may keep that control hidden;
-   runtime query keys include the actual selection context and targeted
    invalidation is awaited after binding/content mutation, publish, sync, reset,
    and target switch; `effectiveHash` or its equivalent is checked as a
    freshness token;
-   restore remaps any physical reference according to an explicit rule, while
    a semantic binding remains valid across metahub/application scopes;
-   snapshot export/import and source reset retain the binding while excluding
    application-only baseline data as designed.

No current pass result should be upgraded to acceptance for the new pilot.
The existing browser gates are a baseline to extend.

## Recommended Decision

Proceed to a decision-focused PLAN with this architecture:

1. Use the existing Object preset and create a dedicated MarketingPageHero
   Object with localized Components and one default semantic record. Do not
   create a new Entity kind, widget content table, or canonical JSON document.
2. Add a neutral, serializable binding-slot contract to the shared widget
   registry. Make capabilities/required Components and cardinality primary;
   keep any allowed-kind list as optional narrowing. Keep slot metadata
   distinct from the persisted binding instance.
3. Prefer a versioned semantic binding in the existing reserved \_\_layout
   widget envelope because the current codec, raw source_config, snapshot, and
   renderer-replacement lifecycle already preserve that carrier. At the start
   of PLAN, confirm the exact member/selector shape and explicitly extend
   hash/comparison, source-baseline/effective-layout projections, and the
   trusted write/materialization path that currently exposes or accepts only
   renderer config. Keep renderer settings limited to
   presentation/composition.
4. Make the Hero binding source-owned for the pilot and enforce that choice at
   the server boundary. Let the application override approved presentation
   settings only; a direct application API attempt to rebind must fail.
   Defer rebind, picker, and ad-hoc backing-model provisioning until the
   binding lifecycle is proven.
5. Implement one bounded binding-resolution contract used by both marketing
   runtime serializers, with scope-appropriate authenticated/public record
   loaders. Validate scope, publication/readability, selector semantics,
   capabilities, required Components, cardinality, and projection before
   returning the typed MarketingHeroData input.
6. Delete the dead MarketingPageSection/hero copy path and superseded Hero
   fields from site settings in the clean template seed. Do not preserve a
   compatibility reader or dual-write path.
7. Keep specialized Hero authoring as a facade over the generic Entity
   operations. Define separate ownership for content and presentation, use
   real EN/RU resources and MUI dialog primitives, enforce the pilot's
   single-instance contract and exact field limits, and make any combined
   metahub save atomic or visibly split. Keep application content/binding
   controls and Workspace Hero CRUD out of this pilot.
8. Extend semantic hash, source baseline, snapshot/materialization, reset,
   sync, query-key, targeted-invalidation, and safe action/resource tests so
   the new neutral binding is not invisible to lifecycle behavior or cache and
   navigation safety.
9. Publish the finalized neutral contract in a repository-facing source
   document or architecture skill before other templates depend on it.

This path follows the current repository evidence, respects the clean-break
brief, preserves package boundaries, and makes marketing.collection a
meaningful next test of many-record binding rather than overloading the Hero
pilot.

## Questions Handed To PLAN

The follow-up plan dated 2026-09-22 resolves these questions as implementation
decisions. They remain listed here as the research-to-plan traceability record.

Only the following decisions remain material for the implementation plan:

-   What exact strict Zod 3-compatible shapes should represent binding slots,
    selector kinds, and the persisted \_\_layout member (binding or bindings)?
-   How will the effective Hero pilot `maxInstances: 1` contract be represented
    in shared metadata and enforced by every server mutation path, while the
    Object remains able to hold future additional records?
-   What is the platform-neutral semantic selector contract? The existing
    marketing `recordKey -> semanticKey` behavior is adapter-specific because
    semantic keys are derived from record-specific key Components. The Hero
    pilot should use one explicit default semantic selector, with physical IDs
    server-resolved, without pretending that `recordKey` is already universal.
-   Is application rebinding explicitly deferred for the Hero pilot? This
    research recommends yes.
-   If application rebinding is enabled later, what typed API field exposes the
    inherited/source binding baseline now that `sourceConfig` currently
    projects renderer config only?
-   What exact canonical Hero Component names and locale fallback/requiredness
    rules replace the old site-settings names, especially subtitle versus
    description and action targets?
-   Will the metahub specialized surface submit content and baseline
    presentation atomically, or expose separate save scopes? The plan must not
    leave this implicit.
-   Which existing action, capability, permission, and safe-target contracts
    should the Hero fields reuse, including the server allowlist for internal
    routes, external hosts, protocols, target/rel, and resource references?
-   What exact query-key shape and awaited targeted-invalidation helpers cover
    binding/content mutation, publication, sync, reset, and target switching?
-   Is the first resolver allowed to read normal runtime Entity records
    directly, or does the current publication flow require a compact
    widget-facing projection? The recommendation is to reuse bounded runtime
    records first and avoid a new projection store unless evidence requires it.
-   What exact future cardinality/relation vocabulary is reserved for
    marketing.collection, without expanding the Hero implementation?

## Sources

-   https://mui.com/material-ui/getting-started/templates/
-   https://mui.com/material-ui/react-grid/
-   https://mui.com/material-ui/react-dialog/
-   https://react.dev/learn/rendering-lists
-   https://www.postgresql.org/docs/current/transaction-iso.html
-   https://www.contentful.com/developers/docs/extensibility/field-editors/overview/
-   https://www.contentful.com/help/content-models/content-modeling-patterns/
-   https://www.sanity.io/docs/studio/connected-content
-   https://www.sanity.io/docs/developer-guides/how-to-use-structured-content-for-page-building
-   https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
-   https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient
-   https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
-   Unified Entity-Backed Widget Architecture original brief (2026-09-20; maintained outside this repository)
-   Unified Entity-Backed Widget Authoring Hero Pilot specification (2026-09-20; maintained outside this repository)
-   memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md
-   memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md
-   memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md
-   .backup/Архитектура-виджетов.md
-   Context7 resource /mui/material-ui/v9.2.0
