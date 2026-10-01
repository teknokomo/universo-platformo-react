# Plan: Marketing Page Complete Entity-Backed Widgets

> Status: Implemented and verified (2026-09-30)
> Created: 2026-09-27
> Mode: IMPLEMENT
> Product-code changes: complete
> Input: User task specification for the complete Marketing Page Entity-backed widget cutover (2026-09-27)
> Technical brief: QA-reviewed architecture brief for the complete Marketing Page Entity-backed widget cutover (2026-09-27)
> Research: `memory-bank/research/marketing-page-complete-entity-backed-widgets-research-2026-09-27.md`

## Overview

Complete the Marketing Page migration to one Entity-backed content architecture.
Entity records and Entity relations are the only durable authority for marketing
content; layout widget instances own composition, activation, placement, and
presentation; widget definitions declare bounded source-selection semantics and
adapter requirements.

The existing `marketing.hero` pilot becomes the reusable platform mechanism
rather than a special case. The same neutral binding contract must support:

-   one semantic record (`semantic-key`),
-   one bounded Entity record set (`record-set`), and
-   one bounded relation-backed child set (`relation-set`).

This is a clean cutover. Remove the old Marketing `source` / `copySource`
contract, `MARKETING_SOURCE_CODENAMES`, renderer-owned Brand/Image content, the
Hero-specific binding policy surface where the behavior is generic, and every
compatibility reader for obsolete payloads. A fresh test database will be used;
do not add legacy data-migration/dual-read machinery or increment the database
schema version, minimum structure version, or Marketing Page template version
solely for this refactor. If the clean model needs DDL shape changes, update the
fresh-schema definition directly under the existing platform migration boundary;
do not preserve the disposable database through compatibility migrations.

The implementation stays on the repository-pinned stack: React 18, MUI 9.2.0,
TanStack Query 5, Zod, Jest for backend suites, Vitest for shared/frontend/runtime
packages, PostgreSQL through `DbExecutor`, and the repository Playwright runner.
No new external dependency is required, and dependency versions remain
centralized in `pnpm-workspace.yaml`.

## Planning Evidence and Fixed Decisions

The plan is based on the same-day QA-reviewed research artifact, current source,
relevant package READMEs and Memory Bank architecture notes, OntoIndex semantic
inspection, Context7 documentation for MUI 9.2.0 and TanStack Query, and
independent architecture, UX, testing, and documentation reviews.

Direct source is authoritative where the OntoIndex index reports degraded
coverage for oversized files.

The following decisions are fixed for implementation:

1. **Content ownership** — Entity records and relations own content. Widget
   configs never copy Entity-owned titles, descriptions, media, links, pricing
   rows, footer rows, or branding.
2. **Binding definition vs. binding instance** — registry metadata declares
   what a widget needs; `__layout.bindings` selects the semantic source for one
   concrete placement.
3. **Bounded selectors only** — bindings do not contain SQL, arbitrary filters,
   physical table/column names, row inventories, or client-authored field maps.
4. **Projection is trusted metadata** — server/registry code derives the
   projection from the slot definition; the client cannot invent Component
   mappings.
5. **Ordering and visibility are Entity data** — `SortOrder` / `IsVisible`-style
   Components own authored order and visibility. Per-placement `maxItems` only
   reduces an already bounded resolved set.
6. **Pricing relations use the Entity REF** — `MarketingPagePricingBenefit.TierRef`
   points to the authoritative tier record UUID. Remove the `TierKey`/row-id dual
   matching fallback.
7. **Brand and Footer share one authority** — `MarketingPageSiteSettings` remains
   the canonical singleton for site identity and shared footer copy. Independent
   Brand/Footer slots may read the same record without duplicating ownership.
8. **Image becomes Entity-backed** — add a normal `MarketingPageImage` Object and
   remove content-bearing `media` from `marketing.image` renderer config.
9. **Auth actions have one owner** — `showAuthActions` belongs only to
   `marketing.auth`; remove it from Navigation.
10. **Hero and Image remain separate placements** — preserve MUI reference
    composition through persisted order and the existing `seamlessAfter`
    capability rather than introducing a Marketing-specific grouping model.
11. **Application is presentation-only for source-owned widgets** — bindings,
    source selection, record creation, record cloning, and rebinding are Metahub
    operations. Application controls may change only registered presentation,
    active/order/placement settings and may reset them to the current source
    baseline. Current Entity-backed Marketing widgets with required bindings are
    not added or duplicated from Application.
12. **Scoped overrides inherit bindings** — a base placement is the sole binding
    authority for its override. An override may persist only the registered
    presentation/placement/activity delta and cannot replace or drop a binding.
13. **`source_config` is the trusted config/binding part of the source baseline** —
    application customization detection compares the complete application-editable
    semantic subset to explicit source values, not raw JSON equality between
    `config` and `source_config` and not the current local row as a source fallback.
14. **Required-source removal fails closed** — a source-managed Entity widget may
    not silently survive as an active unbound application widget.
15. **One runtime resolution pipeline** — authenticated and public Marketing
    runtime use the same selector/cardinality/relation logic with different
    authorized record loaders. Public redaction remains a final independent
    boundary.
16. **Runtime renderer remains isolated** —
    `@universo-react/apps-template-mui` consumes shared contracts and validated
    DTOs only; it does not import authoring, backend, persistence, or
    `@universo-react/template-mui` code.
17. **Compatibility is capability-first** — required Entity capabilities and
    Component contracts are the primary source-compatibility test. `entityKinds`
    may narrow that set as an additional safety restriction, but built-in Object
    codenames are seed defaults rather than a platform-wide compatibility
    allowlist. A compatible future Object codename must work without central
    Marketing registration.
18. **Source target cardinality and resolved-row cardinality are different** —
    the current Marketing selector modes bind one Entity source target per slot;
    `record-set` / `relation-set` result limits bound rows returned from that one
    source. An optional empty slot is represented by absence of the slot, never by
    a persisted `targets: []` placeholder.
19. **Application source baseline covers every editable dimension** — the trusted
    source baseline includes renderer presentation plus every independently stored
    source value that Application is allowed to override, including activation,
    sort order and placement/zone where those mutations are supported. Current
    local columns must never be mistaken for their source baseline during
    customization detection or Reset.
20. **Required Entity bindings cannot detach into Application ownership** —
    `copy_source_as_application` is not a supported ownership transition for the
    source-managed Marketing placements in this scope. Sync/conflict resolution
    must reject that resolution for any widget with required source-owned slots.
21. **Workspace may edit content only through Entity policy** — source bindings
    remain Metahub/publication-owned. Workspace/runtime record mutation is allowed
    only where the Entity record policy explicitly permits it and can never mutate,
    drop, or rebind `__layout.bindings`.

## Normative Widget Ownership Matrix

| Placement              | Durable content owner                                                         | Binding slots                                                                          | Placement-owned presentation/behavior                                      | Metahub Add / Duplicate                                               |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `marketing.brand`      | `MarketingPageSiteSettings`                                                   | `site`: required semantic record                                                       | active/placement only                                                      | singleton; no Duplicate                                               |
| `marketing.navigation` | compatible ordered navigation Object; built-in `MarketingPageNavigation`      | `items`: required record set                                                           | `maxItems`, header/mobile projection                                       | Add selects compatible source; Duplicate shares source                |
| `marketing.auth`       | system-derived                                                                | none                                                                                   | `showAuthActions`, placement/mobile projection                             | singleton                                                             |
| `languageSwitcher`     | system-derived                                                                | none                                                                                   | existing shared-widget behavior                                            | unchanged                                                             |
| `colorModeSwitcher`    | system-derived                                                                | none                                                                                   | existing shared-widget behavior                                            | unchanged                                                             |
| `marketing.hero`       | compatible Hero Object; built-in `MarketingPageHero`                          | `content`: required semantic record                                                    | `showLeadForm`, placement                                                  | Add create/select; Duplicate clones selected record and rebinds clone |
| `marketing.image`      | compatible media Object; built-in `MarketingPageImage`                        | `content`: required semantic record                                                    | active/placement only                                                      | Add create/select; Duplicate clones selected record and rebinds clone |
| `marketing.collection` | `MarketingPageSection` + variant-compatible item Object                       | `section`: required semantic record; `items`: required record set                      | `variant`, `maxItems`, title/description switches and variant presentation | Add selects compatible sources; Duplicate shares bindings             |
| `marketing.pricing`    | `MarketingPageSection`, `MarketingPagePricing`, `MarketingPagePricingBenefit` | `section`: semantic record; `tiers`: record set; `benefits`: relation set over `tiers` | `maxItems`, `showBenefits`, `cardStyle`, `cardWidth`                       | Duplicate shares sources                                              |
| `marketing.footer`     | shared `MarketingPageSiteSettings`, `MarketingPageFooterLink`                 | `site`: semantic record; `links`: record set                                           | `maxItems`, `showNewsletter`                                               | Duplicate shares bindings                                             |

Implementation clarification: Footer has no section-copy slot. Its renderer
uses the shared Site Settings record for branding, description, copyright, and
newsletter content, plus Footer Link records for groups. Seeding a separate
`MarketingPageSection/footer` would be unused and would violate the strict
footer DTO contract.

## UI Contract

This section is an implementation gate, not optional polish. Every touched
authoring surface must satisfy the repository Runtime UI UX Quality Gate.

### Single semantic record (`semantic-key`)

-   Control: searchable/paginated human-readable record picker.
-   Display: localized record title/name plus a useful human-readable secondary
    label when available; never show UUID, binding JSON, Component codename, or
    technical semantic key as the normal label.
-   Actions: **Choose existing**, **Create content**, **Edit content**, and explicit
    **Choose another record** when rebinding is allowed.
-   Defaults: use the seeded semantic record for seeded placements; a newly created
    record becomes the selected binding after the server confirms creation.
-   Duplicate: Hero/Image clone the selected Entity record with fresh UUID v7
    identities and bind the duplicated placement to the clone.
-   Validation: required/missing/incompatible records produce localized inline
    errors, `aria-invalid`, `aria-describedby`, and focus the first invalid control.
-   Editing: open the ordinary Entity record editor or a specialized facade built
    on the same generic Entity CRUD contract; semantic long text uses multiline
    controls.

### Entity record set (`record-set`)

-   Control: choose a compatible **Entity source/model**, not individual rows.
-   Display: localized Entity name and an optional human-readable description;
    never display a row inventory, table name, Entity UUID, source JSON, or SQL.
-   Row CRUD: create/edit/delete/order/visibility remains in the ordinary Entity
    record list/editor. The layout dialog only selects where the set comes from.
-   Duplicate: create a new placement that shares the same source binding. Do not
    clone collection rows by default.
-   Runtime: source ordering and visibility come from registered semantic Component
    roles. `maxItems` may reduce the result but cannot increase the hard resolver
    limit.

### Relation-backed child set (`relation-set`)

-   Control: show the child Entity source and a human-readable relation to the
    parent slot, for example “Pricing benefits → Pricing tiers”.
-   Parent selection: ordinary child-record editing uses a searchable human label
    for the REF Component; referenced UUIDs stay hidden.
-   Reuse the existing Entity-record REF autocomplete path. Refactor it into a
    reusable Metahub-owned primitive where necessary; do not create a separate
    Marketing-only REF picker. A selected record outside the currently loaded page
    must be fetched/resolved by identity and shown with a human label or a localized
    unavailable state; never fall back to displaying a UUID fragment.
-   Dependency: changing a parent source immediately revalidates each dependent
    relation slot. If the child source is no longer compatible, keep the dialog
    open, mark the relation selector invalid, focus it, and require an explicit
    compatible choice before Save. Do not silently rewrite the binding.
-   Duplicate: share both parent and relation sources by default; do not clone tier
    or benefit rows.

### Add, Edit, Duplicate, permissions, and application behavior

-   Policy comes from registry/slot capabilities, not `widgetKey === ...` checks.
-   Singleton widgets never expose Duplicate.
-   Metahub is the binding authority. It may create/select/rebind content sources
    according to existing layout/content permissions enforced again on the server.
-   “Edit content” and “Presentation settings” are distinct, explicit actions.
-   Application never exposes source selection, content CRUD, or rebinding for a
    source-managed widget. It may edit only registry-declared presentation fields,
    active state, permitted placement/order, and reset-to-source.
-   Application-side Add/Duplicate is disabled for current Marketing widgets with
    required source-owned slots. Source-independent registry entries may retain
    their existing allowed local-placement behavior.
-   Permission failures are localized and fail closed. UI visibility is not the
    authorization boundary.

### Dialog, accessibility, responsive, and localization contract

-   Reuse `StandardDialog` or an existing specialized dialog built on it. Before
    expanding `DynamicEntityFormDialog` as the generic content-editor surface,
    align its shell with `StandardDialog`; do not add another Marketing-specific
    dialog shell.
-   Use labelled MUI `TextField` / `Select` / `Autocomplete` controls. Follow MUI
    9 `slotProps` APIs where slot customization is required.
-   Dialogs must keep the canonical footer spacing and focus behavior. Responsive
    full-screen behavior may use `useMediaQuery(theme.breakpoints.down(...))` where
    the existing shared primitive supports it.
-   Open moves focus into the dialog; Save/Cancel/Escape restores focus to the
    invoking action. Autocomplete Escape first closes its popup and returns focus
    to its combobox. No unintended keyboard trap is allowed.
-   Dirty forms use the existing localized discard-changes confirmation contract.
-   Every title, label, helper, empty/loading state, permission message, conflict,
    and validation message ships in real EN/RU resources. Do not expose raw Zod or
    database errors.
-   Authoring proof is required at 1920×1080, 768×1024, and 390×844 with no
    page-level horizontal overflow.

## Affected Areas

### Shared contracts

-   `packages/universo-react-types/src/common/widgetBindings.ts`
-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/marketingPage.ts`
-   `packages/universo-react-types/src/common/layoutEnvelope.ts`
-   related `@universo-react/types` exports and tests
-   `packages/universo-react-utils/src/validation/*` only for genuinely reusable
    validation/canonicalization helpers; do not move feature orchestration here

### Metahub template, binding lifecycle, and Entity integrity

-   `packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.*`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/*`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts`
-   generic Object/Component/record integrity paths used by live bindings
-   snapshot layout validation/restore paths

### Metahub authoring UI

-   `packages/universo-react-metahubs-frontend/src/domains/layouts/*`
-   existing Entity record list/form primitives reused by the binding workflow
-   package-local TanStack Query hooks/query keys and i18n resources
-   `packages/universo-react-template-mui/src/components/layouts/*` only for visual
    controls that are actually reused across host packages

### Application materialization and control plane

-   `packages/universo-react-applications-backend/src/persistence/applicationLayout*.ts`
-   `packages/universo-react-applications-backend/src/services/effectiveLayout*.ts`
-   publication/materialization/sync/reset/hash helpers and tests
-   `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
-   package-local query keys, mutations, i18n and conflict handling

### Authenticated/public Marketing runtime

-   `packages/universo-react-applications-backend/src/services/widgetBindingResolver.ts`
-   typed Marketing adapter/serialization services
-   `packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts`
-   `packages/universo-react-applications-backend/src/services/publicMarketingRuntime.ts`
-   public runtime stores/routes and DTO-redaction tests

### Isolated runtime renderer

-   `packages/universo-react-apps-template-mui/src/marketing-page/*`
-   `packages/universo-react-apps-template-mui/src/__tests__/packageBoundary.test.ts`
-   `tools/check-apps-template-isolation.mjs`

### Test infrastructure and documentation

-   existing Marketing Page Jest/Vitest suites
-   existing real-PostgreSQL integration runners
-   `tools/testing/e2e/specs/flows/marketing-page-*.spec.ts`
-   `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts`
-   `tools/testing/e2e/support/runMarketingPageVerificationLocalSupabase.mjs`
-   Marketing Page screenshot/provenance tooling
-   relevant package READMEs
-   `docs/en|ru/architecture/entity-backed-widgets.md`
-   `docs/en|ru/platform/marketing-page-template.md`
-   `docs/en|ru/guides/application-layouts.md` if the user-facing Application
    presentation/reset contract changes materially

## Design Notes

### Selector contract

Extend the persisted selector as a discriminated union rather than adding
optional fields to the current semantic selector:

```ts
export const widgetBindingSelectorSchema = z.discriminatedUnion('kind', [
    semanticEntitySelectorSchema,
    z.object({ kind: z.literal('record-set') }).strict(),
    z
        .object({
            kind: z.literal('relation-set'),
            parentSlot: semanticRoleSchema
        })
        .strict()
])
```

The slot definition carries trusted selection policy. The exact property names
may follow the existing contract naming during implementation, but the semantic
shape is:

```ts
selection: {
    kind: 'relation-set',
    orderField: 'order',
    visibilityField: 'isVisible',
    hardLimit: 100,
    relation: {
        componentCodename: 'TierRef',
        parentSlot: 'tiers'
    }
}
```

`componentCodename`, allowed Entity kinds, projection fields, order/visibility
roles, relation rules, and hard limits are registry/server-owned. The client
sends a semantic source selection, never an arbitrary projection or query.

Canonicalization must sort set-like slots/targets/projections for stable hashes,
but **must not sort resolved content rows by binding target order**. Record-set
row order comes only from the registered Entity ordering Component.

### Generic resolver shape

Keep selector logic persistence-neutral. Inject an authorized loader that knows
how to fetch only the required Components under the current scope:

```ts
type ResolvedBindingSlot = {
    slot: string
    records: readonly WidgetBindingRecord[]
}

type WidgetBindingRecordLoader = (input: {
    slot: WidgetBindingSlotDefinition
    target: WidgetBindingTarget
    selector: WidgetBindingSelector
    resolvedParentRecordIds?: readonly string[]
    hardLimit: number
}) => Promise<readonly WidgetBindingRecord[]>
```

The generic resolver performs this sequence:

1. strict definition + binding validation;
2. capability/Component compatibility and source-target cardinality validation;
3. resolve parent slots before dependent relation slots;
4. authorized loader call with only trusted selector constraints and a hard bound;
5. inside the persistence loader, apply semantic/relation predicates, visibility,
   and deterministic registered ordering **before** the database `LIMIT` so a
   desired semantic record or child relation cannot be truncated out first;
6. verify resolved-record cardinality and exact trusted projection;
7. apply the per-placement `maxItems` display cap to the already bounded,
   deterministically ordered result;
8. hand the typed adapter only the resolved semantic data.

No runtime adapter constructs source SQL, discovers arbitrary Entities, or
implements fallback relation semantics. The generic resolver passes semantic
constraints to a scope-specific loader; only the loader translates trusted
metadata into parameterized SQL.

### Application source baseline and customization

Replace raw JSON inequality with registry-aware canonical comparison:

```ts
const isCustomized = !equalCanonical(
    normalizeApplicationEditableWidget(currentWidget, definition),
    normalizeApplicationEditableWidget(sourceWidget, definition)
)
```

The editable normalization includes only fields that Application is allowed to
override. Source-owned bindings remain inherited trusted semantics. The semantic
layout/source hash still includes the effective source binding so a binding-only
source change triggers synchronization.

The current `source_config` column alone is not a complete baseline for
independently persisted widget state such as `is_active` and `sort_order`.
Implementation must introduce one typed source-state representation alongside
`source_config` (for example explicit source baseline fields or one dedicated
application-only source-state envelope) for every source value that Application
may override. Do not infer a source value from the current local column. The
chosen representation must be canonical, transactionally updated during sync,
excluded from public/runtime DTOs, and usable by customization comparison and
Reset without copying bindings into normal renderer config.

Reset restores the latest **complete source presentation baseline** atomically —
renderer presentation plus source activation/order/placement state where those
fields are overridable — and clears local customization while preserving the
trusted inherited binding.

### TanStack Query authoring pattern

Keep server state in package-local Query hooks and invalidate the exact affected
keys after a successful mutation:

```ts
const mutation = useMutation({
    mutationFn: saveWidgetBinding,
    onSuccess: async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: layoutKeys.detail(metahubId, layoutId) }),
            queryClient.invalidateQueries({ queryKey: bindingKeys.sources(metahubId, widgetKey, slotKey) })
        ])
    }
})
```

Every variable used by a query function belongs in the query key. Local dirty
form state may exist while a dialog is open, but the query cache remains the
server-state authority after mutation/refetch.

### Database safety

-   Keep physical database access in owning store modules behind `DbExecutor`.
-   Use parameterized `$1`, `$2`, ... values and schema-qualified identifiers.
-   Dynamic identifiers come only from trusted, validated metadata and existing
    identifier-quoting helpers; never interpolate client selector strings.
-   Use `RETURNING` and fail closed on zero-row mutation when confirmation matters.
-   Define one deterministic lock order for bind/delete/Component/relation
    mutations and prove it with real PostgreSQL concurrency tests.

## Plan Steps

### Phase 0 — Preflight, impact map, and acceptance freeze

-   [ ] Preserve the existing dirty worktree; do not reset or rewrite unrelated
        changes.
-   [ ] Reconfirm the research/spec paths and record the exact implementation HEAD.
-   [ ] Use OntoIndex semantic search/context and **upstream impact before editing**
        each shared/high-risk symbol; verify direct source for files outside complete
        graph coverage.
-   [ ] Freeze the widget ownership matrix and the UI Contract above as acceptance
        criteria so implementation cannot drift back into Hero-specific policy.
-   [ ] Inventory every production/test consumer of `marketingWidgetSourceSchema`,
        `MARKETING_SOURCE_CODENAMES`, `MARKETING_WIDGET_SOURCE_CODENAMES`,
        `source`, `copySource`, Brand content overrides, page-level brand-logo override,
        Image inline `media`, and Hero-only binding/policy names.
-   [ ] Record a deletion checklist for those legacy paths. The work is complete only
        when the production code and tests reject the obsolete shape.

**Exit gate:** one bounded impact/deletion inventory; no code modified before the
affected shared symbols have impact evidence.

### Phase 1 — Generalize the shared binding and registry contracts

-   [ ] Extend `widgetBindings.ts` with strict `semantic-key`, `record-set`, and
        `relation-set` selector variants.
-   [ ] Preserve the current capability-first contract explicitly:
        `requirements.entityCapabilities` + required Component semantics are the
        primary compatibility test; `entityKinds` is only an optional additional
        restriction. Do not replace `MARKETING_SOURCE_CODENAMES` with another
        central list of compatible Marketing Object codenames.
-   [ ] Freeze source-target cardinality separately from resolved-row limits. Current
        Marketing slots select exactly one Entity source target; `record-set` and
        `relation-set` may resolve many rows from that source under a separate hard
        result limit.
-   [ ] Preserve the optional-slot wire invariant: an absent optional binding is an
        omitted slot. Persisting an empty slot with `targets: []` is invalid.
-   [ ] Update canonicalization identity logic for every selector kind without using
        row order as layout identity.
-   [ ] Extend slot-definition metadata for selector kind, semantic order role,
        optional visibility role, hard server limit, relation REF requirement/parent
        slot, authoring capabilities, and record policy.
-   [ ] Keep projection generation server/registry-owned; reject client projection
        drift and arbitrary Component mappings.
-   [ ] Replace Hero-only `MARKETING_WIDGET_DEFINITIONS` branching with complete
        registry definitions for Brand, Navigation, Hero, Image, Collection variants,
        Pricing, Footer, Auth, and the shared switchers where relevant.
-   [ ] Add declarative authoring capabilities for singleton placement,
        single-record create/select/edit, record-set source selection, content clone,
        presentation-only Application editing, and source-owned required slots.
-   [ ] Keep these contracts UI-framework-neutral in `@universo-react/types`.
-   [ ] Add exhaustive registry-completeness/type tests: every marketing widget has
        exactly the slots/presentation fields its ownership matrix requires.
-   [ ] Add compatibility tests with a non-built-in Object codename that satisfies
        the declared capabilities/Components and is accepted, plus a similarly named
        incompatible Object that is rejected.

**Exit gate:** all selector/canonicalization/registry tests pass; no frontend or
backend needs `widgetKey === 'marketing.hero'` to discover generic capability.

### Phase 2 — Prepare the Marketing Page Entity models and demo records

-   [ ] Add `MarketingPageImage` as a normal Object in the existing Marketing Page
        template, with a semantic image key, `ResourceSource`, localized alternative
        text, decorative flag, and only the dimensions required by the current runtime
        media DTO.
-   [ ] Keep existing standard Object presets/capabilities; do not create a CMS Entity
        kind or dedicated database table.
-   [ ] Keep one seeded Hero record and support additional Hero/Image records.
-   [ ] Prepare/normalize the canonical seeded SiteSettings, Navigation, Section,
        Collection-item, Pricing-tier/benefit, Footer-link, Hero and Image records
        needed by the final 14-placement template.
-   [ ] Ensure seeded `PricingBenefit.TierRef` resolves to the referenced tier record
        UUID through the existing seed reference machinery.
-   [ ] Keep the Marketing Page template version, database schema version, and
        minimum structure version unchanged solely for this refactor.
-   [ ] Add focused Entity-seed contract tests for the new/normalized models, required
        Components, semantic keys, REF integrity, ResourceSource/alt-text rules and
        UUID v7 identities. Do not declare the widget seed cutover complete here.

**Exit gate:** every canonical Entity model/demo record needed by the target Marketing
Page seed is deterministic and contract-tested; final widget placement/binding cutover
waits for the generic backend + lifecycle semantics below.

### Phase 3 — Replace Hero-specific binding backend with generic binding services

-   [ ] Extract the reusable behavior from `MarketingHeroBindingService` and related
        stores into widget/slot-driven services addressed by `widgetKey + slotKey`.
-   [ ] Keep adapter/policy hooks only for real domain differences such as
        single-record content cloning or semantic record validation.
-   [ ] Generalize list-compatible-sources, provision/create source, bind/rebind,
        inspect usage, and edit-target operations from registry metadata.
-   [ ] Preserve trusted transaction boundaries and one deterministic lock order.
-   [ ] Convert Hero-only routes/controllers to generic binding endpoints or generic
        route handlers with strict widget/slot lookup.
-   [ ] Reuse UUID v7 for all new Entity/record/component identities created by these
        flows.
-   [ ] Return bounded, user-safe DTOs; do not expose table names, raw component maps,
        SQL fields, or internal binding envelopes unnecessarily.
-   [ ] Delete obsolete Hero-only service/store/route names after all callers move;
        do not leave forwarding wrappers solely for compatibility.

**Exit gate:** Hero and Image semantic-record operations plus Navigation/Collection
record-set source operations use one generic service surface.

### Phase 4 — Generalize Entity/Component/record integrity around live bindings

-   [ ] Make Entity deletion/rename checks definition-driven for any live bound source.
-   [ ] Protect required Components from deletion or incompatible type/localization/
        relation changes while the Entity participates in a live binding.
-   [ ] Apply semantic-record protections only where the slot policy requests them:
        selected-record deletion denial and semantic-key immutability where required.
-   [ ] Do **not** block normal record-set row CRUD merely because its Entity is bound.
-   [ ] Protect a relation Component used by a live `relation-set` from deletion or
        incompatible retargeting.
-   [ ] Revalidate dependent relation bindings if their parent slot/source changes.
-   [ ] Generalize source-owned runtime-mutation denial from Hero to every slot whose
        record policy says the published source is not workspace-authored content.
-   [ ] Keep authorization in existing Entity/layout permission layers and enforce it
        server-side for every binding/content operation.

**Exit gate:** live binding integrity is expressed by slot/policy metadata, not by
Marketing Hero codenames.

### Phase 5 — Build the generic Metahub authoring workflow

-   [ ] Generalize the existing Hero binding workflow first: refactor
        `MarketingHeroBindingDialog`, `useMarketingHeroBindingDialog`, the existing
        source/entity selector patterns, and `MarketingWidgetConfigDialog` around
        registry slot semantics. Extract a small shared hook/controller only where
        the existing code proves reusable non-view state is needed; do not introduce
        a parallel Marketing settings framework or universal JSON-like source builder.
-   [ ] Refactor `MarketingWidgetConfigDialog` and Metahub layout pages to render
        controls from registry capabilities/presentation metadata instead of Hero
        magic strings.
-   [ ] Implement the UI Contract exactly: labelled human selectors, explicit content
        vs presentation actions, hidden technical identity, localized validation,
        keyboard/focus behavior, and StandardDialog reuse.
-   [ ] Reuse existing `DynamicEntityFormDialog` / Entity record list/form flows for
        content editing, but first align `DynamicEntityFormDialog` with the canonical
        `StandardDialog` shell. Do not create a second dialog-shell contract.
        Do not create a Marketing-only form shell.
-   [ ] Reuse/refactor the current `ReferenceFieldAutocomplete` path for Pricing
        `TierRef`: fetch/search the selected reference when it is outside the first
        result page and show only a human-readable label or localized unavailable
        state. Remove the current UUID-fragment fallback from normal user UI.
-   [ ] A record-set binding dialog chooses the compatible Entity model; it does not
        duplicate row CRUD.
-   [ ] Implement single-record Add/Create/Edit/Rebind and Hero/Image clone-on-
        Duplicate.
-   [ ] Implement record-set/relation-set Duplicate as placement duplication with the
        same bindings, not content cloning.
-   [ ] Make parent-source changes revalidate dependent relation slots immediately;
        block Save and focus the invalid relation selector until resolved.
-   [ ] Use package-local TanStack Query hooks with stable keys and targeted
        invalidation after successful server mutations.
-   [ ] Add every new EN/RU label/helper/loading/empty/error/conflict/permission key in
        the owning package. Move genuinely shared Marketing layout/binding labels that
        are currently duplicated between Metahub/Application bundles into
        `@universo-react/i18n` common resources and add real-resource parity tests.
-   [ ] Remove obsolete Hero-specific authoring UI files/tests after equivalent generic
        flows are covered.

**Exit gate:** a normal user can add/edit/rebind/duplicate every supported source
shape in Metahub without seeing UUIDs, raw JSON, technical codenames, or internal
errors.

### Phase 6 — Make snapshot, restore, and scoped-layout semantics binding-safe

-   [ ] Update strict domain validation in snapshot layout serialization/restore for
        all selector kinds; do not rely on permissive transport arrays alone.
-   [ ] Reject malformed selector kind, unknown slot, incompatible Entity,
        unauthorized projection, bad relation parent, and missing required slot before
        any restore mutation begins.
-   [ ] Preserve semantic-key selectors, record-set source identity, relation-set
        parent-slot semantics, and REF record UUIDs through snapshot round-trip.
-   [ ] Make the base placement the only binding authority for a scoped override.
-   [ ] Reject binding replacement/removal inside an override; persist only allowed
        presentation/placement/activity deltas.
-   [ ] Attach the validated base binding after lineage resolution in the effective
        scoped layout.
-   [ ] Keep an independent scoped layout responsible for its own complete required
        bindings.

**Exit gate:** export/import and scoped-layout resolution cannot duplicate, erase,
or silently rebind Entity ownership.

### Phase 7 — Correct publication, materialization, `source_config`, sync, reset, and hash

-   [ ] Treat `source_config` as the trusted Metahub config/binding portion of the
        source baseline and keep source bindings out of ordinary Application renderer
        config.
-   [ ] Define and persist the complete trusted widget source state for every
        Application-overridable dimension. `source_config` continues to own source
        renderer config + trusted bindings; add a typed application-only baseline for
        independently persisted source activation/order/placement state as needed.
        Do not compare/reset a local field unless its source value is represented.
-   [ ] Replace raw `config IS DISTINCT FROM source_config` customization semantics
        with registry-aware canonical comparison of the complete Application-editable
        subset against its complete source baseline.
-   [ ] Ensure a source binding-only change participates in semantic source/layout
        hashing and triggers the required materialization/sync work.
-   [ ] Ensure editing ordinary Entity record content changes runtime content without
        changing binding identity or the layout hash.
-   [ ] Preserve local Application presentation overrides when a source binding or
        source presentation baseline updates.
-   [ ] Implement reset as atomic restore of the **current source presentation
        baseline**, including activation/order/placement source values where those are
        editable, preserving inherited trusted binding semantics and optimistic
        version checks.
-   [ ] Verify hidden/trusted binding metadata survives every row mapping/parsing/
        transformation path; add a regression test where an object spread or encoder
        would otherwise drop it.
-   [ ] Define source removal for a required source-owned binding as deterministic
        removal/tombstone/conflict behavior. Never turn it silently into an active
        unbound Application-owned widget.
-   [ ] Generalize sync-conflict preflight so `copy_source_as_application` is rejected
        for every source-managed Marketing widget with required bindings. This
        refactor defines no detach/ownership-transfer workflow for those placements.

**Exit gate:** publish → materialize → sync → local presentation edit → source
update → sync → reset produces one deterministic binding and presentation state.

### Phase 7B — Finalize the binding-bearing Marketing Page seed cutover

-   [ ] Convert all 14 seeded Marketing Page placements to neutral bindings according
        to the ownership matrix and the now-implemented generic lifecycle contract.
-   [ ] Bind Brand and Footer independently to the same `site-settings` record.
-   [ ] Bind every Collection section copy separately from its variant-compatible
        item record-set source.
-   [ ] Bind Pricing section, tiers, and benefits as semantic/record/relation slots;
        preserve the authoritative `PricingBenefit.TierRef` record UUID relation.
-   [ ] Remove Navigation `showAuthActions`, Brand renderer content, Image inline
        media, all seeded `source`/`copySource`, and obsolete section/content rows.
-   [ ] Strengthen `check:marketing-page-template-contract` with positive new-contract
        assertions and negative legacy-payload assertions.
-   [ ] Add a registry-driven fresh-seed integrity check that resolves every required
        slot against seeded Entity metadata/records with no manual wiring, including
        `MarketingPageImage` and every multi-slot Collection/Pricing/Footer placement.
-   [ ] Prove the seed round-trips through snapshot/publication/materialization using
        the Phase 6–7 contracts before treating it as the new canonical template.

**Exit gate:** a fresh Marketing Page metahub has the intended 14 placements, every
required slot resolves immediately, snapshot/publication/materialization preserves the
bindings, and no content-bearing legacy source/config path remains.

### Phase 8 — Make Application layout editing truly presentation-only

-   [ ] Replace Hero-specific Application Add/Duplicate/source rules with generic
        registry capabilities.
-   [ ] Do not pass source options/binding mutation callbacks into Application
        dialogs for source-managed widgets.
-   [ ] Hide/disable Add and Duplicate for current Marketing widgets whose required
        content binding is Metahub-owned; keep only operations permitted by the registry
        for source-independent widgets.
-   [ ] Expose inherited source information only as a human-readable read-only
        summary when useful; never expose binding JSON or IDs.
-   [ ] Permit only registered presentation fields, activation, valid order/placement,
        and reset-to-source.
-   [ ] On optimistic conflict, refetch authoritative layout/source state, explain the
        conflict in localized user language, preserve safe local form state where
        possible, and allow a fresh save.
-   [ ] Reuse existing query keys/mutations and canonical dialogs; do not create a
        second settings framework.
-   [ ] Add negative API/UI tests proving source selection, record CRUD, rebinding,
        Add, Duplicate, and `copy_source_as_application` remain unavailable for **all**
        current Marketing widgets with required source-owned slots, with policy driven
        by registry capabilities rather than widget-key checks.

**Exit gate:** no Application UI/API path can rebind Entity content for a
Metahub-source-managed Marketing placement.

### Phase 9 — Unify authenticated/public binding resolution and typed adapters

-   [ ] Extend `widgetBindingResolver.ts` into the single definition-driven resolver
        for semantic, record-set, and relation-set selectors.
-   [ ] Keep persistence and authorization in injected loaders. Authenticated loaders
        use the current request scope; public loaders enforce ready publication/public
        visibility and bounded published reads.
-   [ ] Resolve parent slots before relation slots and compare child REF values only
        to authoritative resolved parent record UUIDs.
-   [ ] Pass only trusted semantic selector constraints to loaders. Apply semantic or
        relation predicates, visibility and deterministic order in the authorized
        persistence query **before** its hard SQL limit; then apply placement
        `maxItems` to the bounded result before entering the renderer package.
-   [ ] Replace `MARKETING_SOURCE_CODENAMES`-based public object discovery and
        `marketingSeedGuard` participation with registry/template-metadata-driven
        source participation derived from validated bindings and slot definitions.
        Preserve per-source and aggregate row limits, UUID v7 validation, semantic-key
        uniqueness checks, publication/workspace scope, and fail-closed behavior.
-   [ ] Prove capability-first runtime discovery with a compatible custom Object
        codename, while unrelated/incompatible Objects remain unread and cannot expand
        the public data surface.
-   [ ] Convert resolved semantic slots through bounded widget adapters into the
        existing strict Marketing runtime DTO family.
-   [ ] Remove fixed Marketing Object discovery, implicit extra Object lookups,
        source/copySource parsing, Hero compatibility branches, and TierKey fallback
        from authenticated runtime assembly.
-   [ ] Stop injecting `MarketingPageSiteSettings` into Navigation; Brand owns site
        identity in the header and Navigation resolves only its declared slots.
-   [ ] Move public runtime to the same semantic resolved view model, then apply its
        independent allowlist/redaction/URL-media policy.
-   [ ] Fail closed on stale/deleted/incompatible targets, cross-workspace sources,
        cross-publication relation records, over-limit collections, or malformed REF.
-   [ ] Keep runtime payloads free of binding envelopes, source_config, row UUIDs,
        Entity codenames, physical identifiers, lineage, and private metadata unless a
        specific public DTO field intentionally requires a semantic value.

**Exit gate:** authenticated and public rendering agree on semantic content while
public serialization remains strictly redacted.

### Phase 10 — Simplify the isolated MUI runtime renderer

-   [ ] Keep `apps-template-mui` persistence-free: it receives validated typed runtime
        DTOs and normalizes presentation only.
-   [ ] Remove renderer normalization for legacy `source`, `copySource`, Brand
        content overrides, page-level logo authority, Navigation auth duplication, and
        Image inline media config.
-   [ ] Preserve the MUI 9 reference composition: complete header, Hero + Image,
        logos, features, testimonials, highlights, pricing, FAQ, and footer.
-   [ ] Preserve fixed/flow header behavior, anchor offset/scroll padding, Hero/Image
        seamless composition, current media geometry, and responsive behavior.
-   [ ] Keep `tools/check-apps-template-isolation.mjs` as the authoritative package
        isolation policy for authoring frontends, feature backends/persistence,
        `@universo-react/template-mui`, and legacy scopes. Strengthen the package unit
        test by reusing/exercising that same policy rather than maintaining a second
        divergent denylist.
-   [ ] Keep Query usage at the runtime shell/data-loading boundary; `MarketingPage`
        itself remains provider/persistence agnostic.

**Exit gate:** renderer components have no knowledge of how an Entity was selected
or persisted.

### Phase 11 — Delete the legacy Marketing source architecture

-   [ ] Delete `marketingWidgetSourceSchema`, `MARKETING_SOURCE_CODENAMES`,
        `MARKETING_WIDGET_SOURCE_CODENAMES`, old field maps, source helpers, and their
        production consumers once the new paths are live.
-   [ ] Remove codename-list classification from `marketingSeedGuard` and public
        Marketing row loading only after the registry/template-metadata replacement
        from Phase 9 preserves the same bounded integrity/security guarantees.
-   [ ] Delete all `source` / `copySource` handling from Marketing widget config
        schemas, seed, runtime serialization, authoring and tests.
-   [ ] Delete duplicate Brand name/logo renderer ownership and page-level brand-logo
        override authority.
-   [ ] Delete Image content-bearing `media` config.
-   [ ] Delete Hero-only policy/service/UI exceptions whose semantics are now generic.
-   [ ] Add negative schema/API/template tests that prove the old payload forms are
        rejected rather than silently accepted.
-   [ ] Run a repository-wide source scan for obsolete names and classify any
        remaining match as an intentional historical/doc reference or a defect.

**Exit gate:** there is exactly one supported content/binding architecture for a
fresh Marketing Page database.

### Phase 12 — Build the deep automated test system

#### Shared contract and frontend unit tests (Vitest)

-   [ ] Selector schema/canonicalization for semantic, record-set, relation-set, and
        multi-slot envelopes.
-   [ ] Optional-slot absence semantics (`slot` omitted, never `targets: []`) and
        separate source-target versus resolved-row cardinality limits.
-   [ ] Registry completeness and presentation/authoring capabilities for every
        Marketing widget.
-   [ ] Capability-first compatibility: a non-built-in compatible Object codename is
        accepted from its declared capabilities/Components; an incompatible Object is
        rejected without relying on a Marketing codename allowlist.
-   [ ] Clean rejection of legacy source/copySource and content-bearing config.
-   [ ] Metahub selector views: labels, loading/empty/error, keyboard, focus,
        permissions, Create/Edit/Rebind/Duplicate semantics, and query invalidation.
-   [ ] Application dialogs: presentation-only fields, no source actions, reset and
        conflict recovery.
-   [ ] `apps-template-mui`: adapter/normalization/rendering behavior plus package
        boundary guards.

#### Backend service/store tests (Jest)

-   [ ] Generic binding CRUD/source discovery/provision/rebind/usage.
-   [ ] Entity/Component/record/relation integrity policy.
-   [ ] Strict snapshot creation/restore/import validation.
-   [ ] Application source baseline, semantic customization, sync, reset, source
        removal, hidden trusted metadata, optimistic conflict and semantic hashing,
        including independently persisted `isActive`, `sortOrder`, placement/zone
        state where Application can override them.
-   [ ] Overlay inheritance and no-rebind enforcement.
-   [ ] Generic resolver selector semantics, cardinality, ordering, visibility,
        hard limits, relation traversal and stale-target failure. Include regression
        cases proving selector/relation/visibility filtering and registered ordering
        happen before the persistence hard limit.
-   [ ] Authenticated/public semantic parity and public DTO redaction.
-   [ ] Registry/template-driven public/seed participation keeps row bounds and
        integrity checks while removing the `MARKETING_SOURCE_CODENAMES` dependency.

#### Real PostgreSQL integration and concurrency

-   [ ] Direct SQL-first store tests through `DbExecutor`; do not rely only on mocked
        controller tests.
-   [ ] Bind ↔ selected-record delete race.
-   [ ] Bind ↔ required Component/schema mutation race.
-   [ ] Bind ↔ relation REF retarget/delete race.
-   [ ] Publication/materialization/sync/reset competing-update cases.
-   [ ] Assert one deterministic lock order and one valid final state; no deadlock,
        partial bind, or orphaned required binding.
-   [ ] Reuse `test:records-integration:local-supabase` and
        `test:applications-integration:local-supabase` and generalize the current
        Marketing Hero integration runner into a Marketing widget binding gate rather
        than creating a parallel infrastructure stack.

#### Critical lifecycle oracles

-   [ ] Reset never copies a trusted binding into ordinary Application `config` and
        restores every Application-editable source field from its latest trusted
        baseline, not from the current local value.
-   [ ] A binding-only source change affects the semantic source/layout hash and
        causes sync.
-   [ ] Editing Entity record content affects runtime output but not layout/binding
        identity/hash.
-   [ ] Adding/deleting/reordering/hiding records in a bound record set leaves the
        placement `instanceKey`, anchor identity, widget row identity, and binding
        envelope stable.
-   [ ] An overlay inherits its base binding and cannot override it.
-   [ ] Pricing `TierRef` remains the referenced record UUID through
        seed → snapshot → restore → publication → materialization → runtime.
-   [ ] Removing a source cannot orphan an active required binding.
-   [ ] `copy_source_as_application` is rejected for every required source-owned
        Marketing placement, including conflict/bulk-resolution paths.
-   [ ] Workspace/runtime can mutate Entity records only when record policy allows it,
        and no Workspace/API path can mutate or rebind source-owned binding metadata.
-   [ ] Public DTOs contain no internal binding/source/physical identity leakage.
-   [ ] Real PostgreSQL races end in one allowed state.

**Exit gate:** targeted tests catch lifecycle corruption, not just schema parsing.

### Phase 13 — Browser E2E, accessibility, screenshots, and visual inspection

-   [ ] Use the dedicated E2E Supabase stack and start the minimal variant with
        `pnpm supabase:e2e:start:minimal`; never use `pnpm dev` for this browser gate.
-   [ ] Extend the existing `test:e2e:marketing-page:verify:local-supabase` runner
        rather than adding a competing Marketing Page verification pipeline.
-   [ ] Keep browser specs isolated and drive normal user-visible behavior with
        resilient Playwright locators (`getByRole`, `getByLabel`, explicit accessible
        names) plus web-first assertions; avoid CSS/XPath or implementation-detail
        selectors when a user-facing contract exists.
-   [ ] Exercise all three selector UX shapes through real user-facing controls:
        Hero/Image semantic record; Navigation/Collection record-set; Pricing
        record-set + relation-set.
-   [ ] Prove content edit → publish ready version → connector/application sync →
        updated runtime.
-   [ ] Prove Application presentation override → source update → sync preserves
        override → reset restores latest source presentation without rebinding.
-   [ ] Prove source/relation deletion/retarget protection and conflict recovery.
-   [ ] Prove anonymous published runtime for the same authored records; verify users
        without content/layout permission cannot mutate protected state.
-   [ ] Where a Workspace record policy permits content edits, prove the allowed
        Entity record mutation updates runtime while source selection/rebinding remains
        unavailable from Workspace.
-   [ ] Run authoring in EN and RU and runtime in EN/RU × light/dark.
-   [ ] Verify 1920×1080, 768×1024, and 390×844.
-   [ ] Run Axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
-   [ ] Assert no page-level horizontal overflow, no clipped dialog actions, no raw
        UUID/codename/binding JSON/Zod errors, and keyboard-complete workflows.
-   [ ] Preserve fixed/flow header, anchor visibility/occlusion, scroll padding,
        established header offset, and Hero/Image reference geometry.
-   [ ] Capture screenshots at least for header/Brand/Navigation, Hero + Image, one
        Collection variant, Pricing relation output, Footer, Metahub source selection,
        and Application presentation-only editing.
-   [ ] Use the existing controlled Playwright environment for visual comparisons;
        keep committed `toHaveScreenshot()` baselines only where the repository's
        current visual-oracle pattern is stable, and do not compare screenshots
        generated under different OS/browser rendering environments.
-   [ ] Inspect the produced screenshots directly after the run. Screenshot creation
        alone is not acceptance evidence; record visible defects and fix them before
        closing the phase.
-   [ ] Stop the E2E Supabase stack cleanly when browser verification is complete.

**Exit gate:** browser-visible behavior, responsive geometry, accessibility and
content flow are proven from a fresh database rather than inferred from unit tests.

### Phase 14 — README and GitBook documentation closeout

-   [ ] Update relevant package READMEs for final ownership/binding/runtime boundaries:
        `@universo-react/types`, Metahub backend/frontend, Applications
        backend/frontend, and `apps-template-mui`; update `template-mui` README only if
        its reusable authoring primitives materially change.
-   [ ] Rewrite `docs/en/architecture/entity-backed-widgets.md` as the normative
        architecture contract for semantic, record-set, relation-set bindings,
        cardinality, ordering/visibility, hard limits, source baseline, overlays,
        runtime resolution and public redaction.
-   [ ] Keep `docs/ru/architecture/entity-backed-widgets.md` in semantic parity.
-   [ ] Update `docs/en|ru/platform/marketing-page-template.md` with the actual 14
        seeded placements, final ownership matrix, Add/Edit/Duplicate flow,
        MarketingPageImage, Pricing relation semantics, and Application presentation-
        only behavior.
-   [ ] Update `docs/en|ru/guides/application-layouts.md` only where the public guide
        must explain inherited source settings/reset behavior.
-   [ ] Do not add a new GitBook section unless the final implementation creates a
        genuinely separate user concept; if a new page is added, update both SUMMARY
        files symmetrically.
-   [ ] Regenerate localized screenshots from the real fresh-database E2E flow and
        update Marketing Page screenshot provenance/drift metadata.
-   [ ] Run docs i18n/link/screenshot/provenance gates.

**Exit gate:** EN/RU docs describe the implementation that browser tests actually
proved; no text still calls Hero the sole Entity-backed pilot or states the old
13-placement count.

### Phase 15 — Final verification and review

-   [ ] Run Prettier/formatting for changed files.
-   [ ] Run targeted lint/test/build for every changed package first.
-   [ ] Run `check:catalog-versions`, current MUI v9 policy checks, Marketing template
        contract, and `check:apps-template-isolation`.
-   [ ] Run the generalized Marketing binding unit/integration gate and real-PG
        integration suites.
-   [ ] Run the canonical fresh minimal-Supabase Marketing Page E2E/visual/docs gate.
-   [ ] Run affected workspace/root build after targeted packages are green; do not
        treat a partial package build as cross-workspace proof.
-   [ ] Run Thermos correctness/security + maintainability review for the final diff,
        including UUID v7, SQL parameterization, data integrity, concurrency, package
        boundaries and test quality.
-   [ ] Run OntoIndex `gn_verify_diff` / changed-scope verification and reconcile any
        HIGH/CRITICAL blast-radius finding before completion.
-   [ ] Update `memory-bank/tasks.md` / progress records only in IMPLEMENT/QA closeout
        with observed results; do not mark unrun remote/CI checks as passed.

**Exit gate:** no CRITICAL/HIGH unresolved correctness finding, all local required
gates pass, generated screenshots have been inspected, and the changed scope
matches this plan.

## Test Matrix

| Layer                | Required proof                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Shared types         | strict selector schemas, canonicalization, registry completeness, negative legacy shapes                         |
| Metahub backend      | generic binding CRUD, compatibility, record/component/relation integrity, snapshot validation                    |
| Metahub frontend     | three selector UX shapes, create/edit/rebind/duplicate, i18n, keyboard/focus, permissions                        |
| Application backend  | source baseline, materialization, semantic custom detection, sync/reset/hash, source removal, overlays           |
| Application frontend | presentation-only surface, no rebinding, reset/conflict UX, EN/RU                                                |
| Runtime service      | one authenticated/public semantic resolver, deterministic order/limits, relation traversal, stale-target failure |
| Public boundary      | publication scope + strict DTO redaction, no internal identity leakage                                           |
| `apps-template-mui`  | typed rendering only, MUI visual behavior, isolation guard                                                       |
| Real PostgreSQL      | lock ordering and races for bind/delete/schema/relation/sync                                                     |
| Playwright           | end-to-end authoring→publish→sync→runtime, permissions, responsive, a11y, screenshots                            |
| Docs                 | EN/RU parity, links, real screenshots, provenance/drift                                                          |

## Potential Challenges and Mitigations

### 1. Binding metadata becoming a query language

**Risk:** record-set support grows into arbitrary filters/sorts/SQL and weakens the
trust boundary.

**Mitigation:** persist only three bounded selector variants. Put ordering,
visibility, relation Component, projection and hard limits in trusted registry
definitions. Add negative tests for unknown fields/free-form filters/projections.

### 2. Application customization incorrectly compares unlike envelopes

**Risk:** raw `config != source_config` marks every source-bound widget customized
or makes Reset copy bindings into the wrong storage layer.

**Mitigation:** canonicalize the Application-editable semantic subset and test
binding-only changes, presentation-only changes, sync and reset independently.

### 3. Source removal creates orphaned widgets

**Risk:** existing sync fallback can retain a locally customized source widget
with `source_config = NULL`.

**Mitigation:** registry-aware required-source policy. Required source-owned
placements are removed/tombstoned/conflicted deterministically; they never remain
active and unbound.

### 4. Pricing relation drift

**Risk:** keeping TierKey fallback creates two parent identities and inconsistent
behavior between authenticated/public/snapshot paths.

**Mitigation:** one canonical REF record UUID end-to-end and a lifecycle regression
test covering seed through public runtime.

### 5. Generic UI becomes a technical configuration editor

**Risk:** one overly generic dialog exposes codenames, IDs, bindings or JSON.

**Mitigation:** generalize the existing Hero/Entity authoring path first, extract
shared non-view state only when reuse requires it, keep selector-specific human MUI
views, normal Entity CRUD for content, StandardDialog parity, real EN/RU labels and
browser UX gates.

### 6. Renderer boundary regresses during convenience refactors

**Risk:** `apps-template-mui` starts importing authoring or persistence packages.

**Mitigation:** strengthen the automated package deny contract and keep the runtime
boundary as shared validated DTO → package-local renderer model → React.

### 7. Large lifecycle refactor hides concurrency/data-integrity defects

**Risk:** unit mocks pass while real PostgreSQL permits inconsistent bind/delete or
sync/reset races.

**Mitigation:** direct DbExecutor tests plus real-PG concurrency scenarios with one
documented lock order and fail-closed zero-row mutations.

### 8. Visual regressions pass functional E2E

**Risk:** content is technically correct but MUI reference geometry, dialog layout,
header behavior or mobile overflow regresses.

**Mitigation:** retain the established desktop/tablet/mobile screenshot matrix,
Axe checks, geometry assertions, and mandatory direct inspection of screenshots.

## Dependencies and Sequencing

The critical dependency chain is:

1. shared selector/registry contracts;
2. clean template models/demo records + generic binding backend/integrity;
3. Metahub authoring;
4. snapshot/publication/materialization/complete source-baseline lifecycle;
5. finalize the binding-bearing fresh seed against those generic lifecycle rules;
6. unified runtime resolver/adapters;
7. renderer cleanup and legacy deletion;
8. deep tests/browser/docs/final review.

Phases may be parallelized only where their write sets do not overlap. In
particular, Phase 2 may establish fresh Object/Component/demo-record contracts early
so backend/authoring work has realistic fixtures, but the binding-bearing seed is not
accepted as complete until generic integrity + snapshot/source-baseline lifecycle
semantics are in place. Runtime renderer cleanup can proceed after typed DTOs
stabilize, and documentation preparation can proceed from the frozen contracts, but
lifecycle tests must follow the final persistence semantics.

No external library upgrade, legacy data migration, new Entity kind, new workspace
package, or new GitBook section is a prerequisite.

## Definition of Done

The refactor is complete when:

-   every Marketing Page content-bearing widget resolves content exclusively from
    Entity-backed bindings;
-   the three selector modes are strict, bounded and registry-controlled;
-   compatibility is capability/Component-first and no central Marketing Object
    codename allowlist is required for a compatible future source;
-   `MarketingPageImage` replaces inline Image content;
-   Pricing relations use authoritative REF UUIDs with no fallback identity;
-   Metahub offers usable human source/content authoring for all selector modes;
-   Application is presentation-only for source-owned widgets;
-   source_config + complete widget source-state baselines make customization,
    sync/reset/hash/overlay semantics preserve exactly one inherited binding
    authority and restore every editable source field correctly;
-   authenticated and public runtime use one semantic resolution pipeline and the
    public payload is redacted;
-   `apps-template-mui` remains isolated and persistence-free;
-   legacy source/copySource schemas/readers/config are deleted and rejected;
-   Jest, Vitest, real PostgreSQL, Playwright, responsive visual, accessibility,
    screenshot and documentation gates pass on a fresh minimal-Supabase database;
-   EN/RU README/GitBook documentation matches observed browser behavior;
-   no database schema-version, minimum-structure-version, or Marketing Page
    template-version bump was introduced solely for this refactor, and no legacy
    compatibility layer was introduced.

## Implementation Closeout (2026-09-30)

All implementation phases and the definition of done above are complete. The
fresh Marketing Page template stores authored content in Object/Component records
and relations; layout placements keep composition, activation, order, presentation,
and validated binding instances. The Application/runtime paths preserve the
source-owned binding boundary through copy, snapshots, restore, overrides, sync,
reset, hashing, publication, and materialization. The implementation is a clean
cutover: obsolete source/copySource contracts are removed, and no schema,
minimum-structure, or template version was increased.

The final verification evidence for this implementation pass is:

-   The full workspace build completed successfully (36/36 tasks). The Marketing
    unit gate and the focused backend persistence/policy tests passed. After the
    last shared-record-guard cleanup, the three direct applications-backend suites
    passed 24/24 tests, and the applications-backend lint and build passed.
-   The canonical minimum-Supabase Marketing Page verification wrapper passed with
    19 Chromium tests and 5 visual-matrix tests; one opt-in standalone-host test
    was skipped because it requires external host/application configuration. No
    tests were retried or unexpectedly failed.
-   The wrapper's documentation checks passed for 115 English/Russian GitBook page
    pairs, screenshot provenance/assets, and local links. Fresh published-runtime,
    authoring, and EN/RU responsive screenshots were inspected at useful resolution;
    the bound Marketing Image rendered actual dashboard pixels and no page-level
    horizontal overflow was reported.
-   The expected permission-denied runtime request remained a 403 in the
    unauthorized-user test. The final run contained no PostgreSQL SAVEPOINT errors.
    The local E2E Supabase container was stopped by the wrapper after completion.
-   Marketing overlay binding-ownership/configuration logic and the published
    widget source-baseline projection were extracted into focused modules. The
    larger service, sync-store, and service-test files were already above 1,000
    lines before this task (3,214, 1,094, and 2,381 lines respectively); this work
    did not materially expand them, while the sync store and test file shrank.
    Feature-specific rules now live in the extracted modules. Further decomposition
    of the pre-existing service into query/read, mutation/lifecycle, widget, and
    scope operations; of sync persistence into baseline/projection, read, write,
    and lineage modules; and of its tests by contract is a separate structural
    cleanup, not an unverified requirement of this completed implementation.

Final review details and the exact OntoIndex file/test-inventory result are
recorded in `memory-bank/progress.md` and `memory-bank/tasks.md` after closeout.
