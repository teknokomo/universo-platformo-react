# Plan: Unified Entity-Backed Widget Authoring and Marketing Hero Pilot

> Status: Implementation and local QA complete (2026-09-24); the full-worktree autoreview timeout is documented below
> Created: 2026-09-22
> Mode: IMPLEMENT
> Product-code changes: complete against the approved plan
> Input: “Unified Entity-Backed Widget Architecture” original brief (2026-09-20; maintained outside this repository)
> Technical brief: “Unified Entity-Backed Widget Authoring Hero Pilot” specification (2026-09-20; maintained outside this repository)
> Research: `memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md`
> Historical deep research: `.backup/Архитектура-виджетов.md`

## Overview

Implement one reusable contract in which Entity records own business/content
data, layout widget instances own composition and presentation, and widget
definitions declare the binding slots that connect them. Prove the contract by
moving only `marketing.hero` to a dedicated `MarketingPageHero` Object with one
seeded semantic record.

The pilot extends the existing widget registry and the reserved `__layout`
envelope. It does not create a second page-builder model, a new Entity kind, a
Hero content table, or another canonical JSON document. The same semantic
binding must survive seed, authoring, snapshot, restore, publication,
application materialization, sync, reset, effective-layout resolution,
authenticated runtime, and anonymous public runtime.

This is a clean break. Remove the obsolete `MarketingPageSection/hero` row,
Hero fields on `MarketingPageSiteSettings`, renderer-owned `source` and
`copySource` for Hero, and all compatibility readers/tests for those paths.
The disposable database is recreated after the seed changes. Do not add a
database migration, and do not increment the schema, snapshot, or metahub
template version.

The plan uses the repository-pinned stack: React 18.3.1, MUI 9.2.0, Zod
3.25.76, TanStack Query v5, Jest in the backend and shared `template-mui`,
Vitest in types/frontends/`apps-template-mui`, and the repository Playwright
runner. Dependency versions remain centralized in `pnpm-workspace.yaml`; this
work does not require a library upgrade.

## QA Disposition and Traceability

The plan was prepared from the two supplied briefs, the QA-refined research,
the full historical `.backup/Архитектура-виджетов.md`, current source, current
package READMEs, OntoIndex, exact-version Context7 material, current primary
MUI/TanStack Query/React/PostgreSQL/OWASP sources already recorded in the
research, and three read-only subagent reviews. Direct source is authoritative
where OntoIndex missed imported TypeScript call sites.

| Requirement                                                    | Planned gate                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entities own content; widgets own presentation and composition | Dedicated `MarketingPageHero` Object plus presentation-only Hero renderer config (Phases 1-4)                                                    |
| One neutral reusable binding contract                          | Serializable slot definition in the registry and a separate persisted binding instance in `__layout` (Phases 1-2)                                |
| No marketing-only source allowlist in shared code              | Capability/Component requirements first; optional allowed Entity kinds; marketing projection stays in the adapter (Phases 1, 6)                  |
| Clean removal of duplicate Hero data                           | Remove SiteSettings Hero fields, `MarketingPageSection/hero`, `source`, and `copySource`; no compatibility reader (Phase 3)                      |
| Source-owned binding in the pilot                              | Trusted seed/materialization writes it; application renderer-config mutations preserve it and direct rebinding fails (Phases 4-5)                |
| Full lifecycle transport                                       | Codec, source baseline, semantic hash, snapshot/restore, sync/reset, effective layout, and materialization tests (Phase 5)                       |
| Authenticated and public parity                                | One bounded resolver with executor-specific loaders, then the existing typed marketing serializer/runtime DTO (Phase 6)                          |
| Real usable authoring                                          | Metahub content editor plus baseline presentation editor with visibly separate saves; application presentation only; no Workspace CRUD (Phase 7) |
| Repeatable Hero with independent content targets               | One seeded placement; additional placements choose or create distinct Hero records through a labelled picker (Phases 2-4, 7, 10)                 |
| Complete tests and screenshots                                 | Jest, Vitest, real PostgreSQL, Playwright EN/RU responsive/visual/a11y flows on minimal Supabase (Phases 9-10)                                   |
| GitBook-quality docs                                           | EN/RU platform docs, package READMEs, localized screenshots, provenance and drift checks (Phase 11)                                              |

No current browser screenshot proves the new contract. Existing marketing-page
screenshots show the old SiteSettings-backed Hero and are only a visual
baseline. Acceptance requires new screenshots captured after implementation
from a fresh minimal-Supabase database.

QA on 2026-09-23 corrected the research document's singleton recommendation:
the technical brief explicitly requires additional Hero records to back
repeated `marketing.hero` instances. The recommendation to defer a record
picker is therefore superseded by the concrete metahub select/create flow in
this plan; the research remains useful for its other architecture evidence.

## Decisions Fixed by This Plan

### 1. Binding slot and binding instance are different contracts

The widget registry declares what a renderer needs. The persisted widget row
declares which semantic Entity record supplies it. Neither contract contains a
physical Entity, Component, table, or row UUID.

The proposed Zod 3-compatible persisted shape is strict and versioned:

```ts
import { z } from 'zod'

const semanticEntityCodenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
const boundEntityKindSchema = z.enum(['hub', 'object', 'page', 'set', 'enumeration'])

export const semanticEntitySelectorSchema = z
    .object({
        kind: z.literal('semantic-key'),
        field: z.string().trim().min(1).max(64),
        value: z.string().trim().min(1).max(128)
    })
    .strict()

export const widgetEntityBindingTargetSchema = z
    .object({
        entityKind: boundEntityKindSchema,
        entityCodename: semanticEntityCodenameSchema,
        selector: semanticEntitySelectorSchema,
        projection: z
            .array(
                z
                    .object({
                        field: z.string().trim().min(1).max(64),
                        componentCodename: semanticEntityCodenameSchema
                    })
                    .strict()
            )
            .min(1)
            .max(32)
    })
    .strict()

export const persistedWidgetBindingsSchema = z
    .object({
        version: z.literal(1),
        slots: z
            .array(
                z
                    .object({
                        slot: z.string().trim().min(1).max(64),
                        targets: z.array(widgetEntityBindingTargetSchema).min(1).max(32)
                    })
                    .strict()
            )
            .min(1)
            .max(16)
    })
    .strict()
```

Add refinements for unique slot names, unique projection roles, unique targets,
exact required-field coverage, stable canonical ordering, and the
registry-declared cardinality. A selector's `field` must name the one
slot-declared semantic-key field and can never name a Component or SQL column
directly. Arrays make canonical hashing explicit and avoid accepting arbitrary
object members as trusted field names. The pilot implements only
`semantic-key`; future selector variants must be new discriminated-union
members with their own authorization, query bound, ordering, and restore rules.

The Hero seed stores:

```ts
{
    instanceKey: 'hero',
    showLeadForm: true,
    __layout: {
        bindings: {
            version: 1,
            slots: [
                {
                    slot: 'content',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MarketingPageHero',
                            selector: { kind: 'semantic-key', field: 'key', value: 'default' },
                            projection: [
                                { field: 'key', componentCodename: 'HeroKey' },
                                { field: 'title', componentCodename: 'Title' },
                                { field: 'accent', componentCodename: 'Accent' },
                                { field: 'description', componentCodename: 'Description' },
                                { field: 'emailLabel', componentCodename: 'EmailLabel' },
                                { field: 'emailPlaceholder', componentCodename: 'EmailPlaceholder' },
                                { field: 'primaryActionLabel', componentCodename: 'PrimaryActionLabel' },
                                { field: 'primaryAction', componentCodename: 'PrimaryAction' },
                                { field: 'termsText', componentCodename: 'TermsText' },
                                { field: 'termsLinkLabel', componentCodename: 'TermsLinkLabel' },
                                { field: 'termsAction', componentCodename: 'TermsAction' }
                            ]
                        }
                    ]
                }
            ]
        }
    }
}
```

`instanceKey` identifies the widget instance. The selector identifies content.
They must never substitute for each other.

### 2. Slot definitions are capability and Component driven

Extend `LayoutWidgetDefinition` with serializable `bindingSlots`. The proposed
Hero slot is:

```ts
bindingSlots: [
    {
        key: 'content',
        cardinality: { min: 1, max: 1 },
        requirements: {
            entityCapabilities: ['dataSchema', 'records'],
            components: [
                {
                    field: 'key',
                    valueType: 'string',
                    localized: false,
                    required: true,
                    semanticKey: true,
                    maxLength: 64
                },
                { field: 'title', valueType: 'string', localized: true, required: true, maxLength: 255 },
                { field: 'accent', valueType: 'string', localized: true, required: false, maxLength: 120 },
                { field: 'description', valueType: 'string', localized: true, required: true, maxLength: 2000 },
                { field: 'emailLabel', valueType: 'string', localized: true, required: true, maxLength: 120 },
                { field: 'emailPlaceholder', valueType: 'string', localized: true, required: true, maxLength: 120 },
                { field: 'primaryActionLabel', valueType: 'string', localized: true, required: true, maxLength: 120 },
                { field: 'primaryAction', valueType: 'json', localized: false, required: true },
                { field: 'termsText', valueType: 'string', localized: true, required: false, maxLength: 500 },
                { field: 'termsLinkLabel', valueType: 'string', localized: true, required: false, maxLength: 120 },
                { field: 'termsAction', valueType: 'json', localized: false, required: false }
            ]
        },
        allowedSelectors: ['semantic-key'],
        bindingPolicy: { owner: 'source', writableScopes: ['metahub'] },
        allowedEntityKinds: ['object']
    }
]
```

`allowedEntityKinds` narrows the pilot; it is not a marketing codename
allowlist. The resolver verifies the declared capability and projected
Components from authoritative metadata. It never trusts a client-supplied
table, schema, column, Component UUID, or physical row UUID.

### 3. Hero remains repeatable; each placement has an independent target

Keep the existing `repeatable: true` / derived `multiInstance: true` contract
for `marketing.hero`. Replacing these booleans across Dashboard and Marketing
with `maxInstances` is unrelated to the binding pilot and would widen its
blast radius. Seed one placement, but allow further metahub Hero placements to
select an existing compatible `MarketingPageHero` record or create one through
the normal Entity record service. A labelled picker displays `Title`, never a
semantic key or UUID. A second placement can target a second record and render
different content; deliberately choosing the same record shares its content.
`instanceKey` is unique per placement and never serves as the content selector.

Adding/copying a placement must ask whether to reuse an existing record or
create a new one; no implicit content copy or deletion occurs. Copying a
record uses the existing unique-key re-suffixing path, then binds that record
only after its Entity transaction commits. Removing/excluding a placement
leaves its record intact; deletion of an additional record with a live binding
fails with a localized conflict until the placement is rebound or removed.
The protected `default` record is never deletable. Application-created
placements may choose only source-published records through a trusted source
binding flow; ordinary application config updates cannot author a new binding.
If no such flow exists in the pilot, application Add/Copy for Hero must be
disabled while preserving existing source placements. This scope decision
does not restrict metahub repeatability or public rendering.

Additional records authored in the metahub are canonical configuration content
and are published with their selected placements. They are not workspace-user
records. The published Workspace may display these Heroes but cannot create
or edit them in this pilot. Future workspace-owned records need an explicit
workspace-scoped binding/authorization design; the metahub picker must never
list private workspace content.

The published `MarketingPageHero` Entity carries an authoritative
source-owned/read-only policy through materialization. Every application
runtime row mutation route (create, copy, update cell/row, delete,
compensating delete, restore, reorder and relation/library writes where
applicable) rejects writes to it server-side, even if the caller has generic
content rights. Hiding edit controls in Workspace is insufficient.

### 4. Application rebinding is deferred and rejected server-side

Metahub seed and metahub layout authoring own Hero bindings; publication
copies their semantic identities. Application users may override only renderer
presentation (`showLeadForm`, active state, order, and other approved future
presentation fields). A client cannot add, remove, or replace
`__layout.bindings` through ordinary application widget configuration routes.

Renderer updates call `replaceWidgetRendererConfig`, which preserves trusted
neutral metadata. Metahub create/copy uses a narrow, authorized placement
operation that resolves a compatible record and persists the binding with the
new widget row; it never accepts arbitrary `__layout` JSON from a browser.
Application Add/Copy for a new Hero is unavailable until a trusted source
selection workflow exists. Any application request that attempts to submit
reserved binding metadata returns a localized 400/403 contract error and does
not partially update renderer config.

The generic application layout-copy route and sync
`copy_source_as_application` path also create application-owned widgets without
source lineage. For this pilot, both reject a layout containing Hero
before any row is written, with a localized explanation. Silently copying a
binding into an application-owned row without a source baseline is not a valid
substitute. Source-derived Exclude/Restore and publication/sync remain valid.

### 5. Specialized content and presentation saves are visibly separate

Do not create a cross-package pseudo-transaction between Entity content and
layout presentation. The metahub Hero widget dialog has:

-   a presentation form with its own **Save presentation** action;
-   an **Edit Hero content** action that opens the existing Entity record editor
    for the record selected by this placement's binding (`default` only for
    the seeded placement);
-   clear helper text that each dialog saves independently.

The specialized entry point is a facade over normal Entity record read/update
services. The generic Object record page edits the same record. This avoids a
second content API and makes partial failure semantics honest and testable.

### 6. Canonical Hero data model

Create Object `MarketingPageHero` under the existing `MarketingPage` Hub with
`recordBehavior: 'reference'` and `marketingRole: 'hero'`. Seed exactly one
record with codename `default` and a system-managed `HeroKey = 'default'`.
`HeroKey` is nonlocalized, unique, hidden from ordinary forms/tables, and not
editable through the specialized or generic content form.

Use these Components:

| Component            | Type       | Locale/requiredness                   | UI/limit                                          |
| -------------------- | ---------- | ------------------------------------- | ------------------------------------------------- |
| `HeroKey`            | STRING     | system-owned, required, nonlocalized  | hidden, max 64                                    |
| `Title`              | STRING/VLC | EN and RU required                    | single line, 255                                  |
| `Accent`             | STRING/VLC | optional localized value              | single line, 120                                  |
| `Description`        | STRING/VLC | EN and RU required                    | multiline, 2000                                   |
| `EmailLabel`         | STRING/VLC | EN and RU required                    | single line, 120                                  |
| `EmailPlaceholder`   | STRING/VLC | EN and RU required                    | single line, 120                                  |
| `PrimaryActionLabel` | STRING/VLC | EN and RU required                    | single line, 120                                  |
| `PrimaryAction`      | JSON       | required, nonlocalized                | typed action editor, target max 500, bounded JSON |
| `TermsText`          | STRING/VLC | required when terms link is present   | multiline, 500                                    |
| `TermsLinkLabel`     | STRING/VLC | required when terms action is present | single line, 120                                  |
| `TermsAction`        | JSON       | optional, nonlocalized                | typed action editor, target max 500, bounded JSON |

`PrimaryAction` and `TermsAction` reuse the existing strict
`marketingActionSchema` union (`internal`, `external`, `anchor`, `email`,
`tel`). The editor exposes type-specific normal controls; it never exposes raw
JSON. Entity UI metadata selects a reusable `marketingAction` field editor in
`DynamicEntityFormDialog`; its fallback JSON editor is never reachable for
these Components. Server validation keeps the current safe path, URL,
protocol, credential, external-target, and `noopener noreferrer` policy. No
Hero action target may exceed the pilot's 500-character Component limit even
if the shared action union allows a larger general path; the Hero adapter adds
that bounded refinement. No Hero media field is added; `marketing.image`
remains the separate media widget.

The Entity record has a context-independent validity contract: Title,
Description, both email fields, PrimaryActionLabel and PrimaryAction are always
complete before the record can be saved, regardless of any layout or
application `showLeadForm` override. `showLeadForm` only controls presentation;
the generic Entity editor therefore never needs to guess a layout context.
Accent is optional as a whole; if authored, both EN and RU values are required.
If TermsAction is absent, terms text and label may be absent together; if any
terms member is present, the complete EN/RU group is required.
The resolver uses locale selection/fallback only when rendering an already
valid record; fallback must not hide an invalid seed or authoring save.

### 7. One bounded resolver, separate authenticated/public loaders

Create a neutral server service such as
`services/widgetBindings/entityWidgetBindingResolver.ts`. It accepts the
registered slot, persisted binding, locale, scope, and an injected loader. It
returns a bounded semantic field map; the marketing adapter then parses that
map into `MarketingHeroData`.

```ts
export async function resolveWidgetBinding(
    input: ResolveWidgetBindingInput,
    loader: WidgetBindingRecordLoader
): Promise<ResolvedWidgetBinding> {
    const slot = requireRegisteredSlot(input.definition, input.binding.slot)
    assertCardinality(slot, input.binding.targets)

    const metadata = await loader.loadEntityMetadataBatch(input.binding.targets)
    const prepared = input.binding.targets.map((target) => {
        assertAllowedKindAndCapabilities(slot, target, metadata)
        const projection = validateProjection(slot, metadata.for(target), target.projection)
        const semanticKey = requireSemanticKeyProjection(slot, projection, target.selector.field)
        return { target, projection, semanticKey }
    })
    const rows = await loader.loadBySemanticKeys(prepared)
    const records = prepared.map((item) => projectBoundedFields(requireUniqueRow(rows, item), item.projection, input.locale))

    return { slot: slot.key, records }
}
```

The authenticated loader uses the request-scoped `DbExecutor` and existing RLS
context. The public loader uses the trusted pool executor only inside the
existing published-read transaction and proves publication, application,
workspace, and public-readability scope before querying records. Both loaders
reuse SQL-first stores with schema-qualified parameterized SQL and verified
metadata; domain services do not import Knex or derive identifiers directly
from binding input.

Missing Entity/record/Component, duplicate semantic key, cardinality mismatch,
scope mismatch, unpublished data, or invalid projection fails closed with a
typed internal error. Public responses remain non-enumerating and do not expose
binding metadata, physical IDs, schema/table names, codenames, or raw errors.

### 8. Hash, baseline, cache, and concurrency semantics

-   `persistedWidgetNeutralMetadataSchema` gains `bindings` beside `placement`.
-   `decodeWidgetForHash` includes canonical semantic bindings; physical row,
    Entity, Component, layout, and widget IDs remain excluded.
-   `source_config` stores the complete trusted encoded widget envelope. Typed
    persistence/service models expose separate effective `bindings` and
    `sourceBindings` views so reset/sync cannot drop the baseline. Ordinary
    application/public DTOs omit those fields for this source-owned pilot.
-   Source sync updates source renderer config and source binding together;
    application-local presentation remains an overlay. A source binding change
    changes the semantic hash and source diff. Because application rebinding is
    forbidden, the new valid source binding always wins; local presentation
    conflicts are evaluated only over locally writable renderer fields and
    must never retain an obsolete binding.
-   Reset restores source presentation and source binding atomically for one
    widget row. It never deletes or rewrites the Entity record.
-   Snapshot/export/import/restore preserve the semantic binding unchanged.
    Physical IDs are forbidden in the schema, so no restore remap is required.
-   Effective-layout resolution carries the binding to server hydration but does
    not expose it in the public DTO.
-   Use existing optimistic `expectedVersion` contracts. Real-PostgreSQL tests
    prove exactly one winner for concurrent presentation writes and one coherent
    graph for snapshot/sync operations.
-   Frontend query keys include application/metahub, layout, widget, target,
    locale, workspace, and every actual request variable. They do not invent a
    selector variable that the browser does not own. Server-side resolver/cache
    identity includes scope, locale, canonical binding digest and effective
    layout/publication hash. Content edit, presentation edit, publish, sync,
    reset, and target switch await targeted invalidations for Entity record,
    layout widget, effective layout, runtime and public-preview data. Keep the
    current public `Cache-Control: no-store`; do not invent an ETag contract.

## Scope and Non-Goals

### In scope

-   Neutral binding-slot definitions and persisted semantic binding instances.
-   The dedicated `MarketingPageHero` Object and one default record.
-   Source-owned Hero binding and presentation-only application overrides.
-   Separate specialized content and presentation save surfaces in metahub UI.
-   Generic Entity record editor parity for the same Hero record.
-   Full seed/snapshot/restore/publication/materialization/sync/reset/hash/runtime
    lifecycle.
-   Authenticated and anonymous published runtime parity.
-   EN/RU i18n, safe action controls, responsive/a11y behavior, Jest/Vitest/
    real-PG/Playwright coverage, screenshots, CI, README and GitBook docs.

### Explicit non-goals

-   No new Entity kind, database schema/table, migration, or version bump.
-   No compatibility reader or dual write for SiteSettings Hero fields,
    `MarketingPageSection/hero`, Hero `source`, or Hero `copySource`.
-   No application binding picker/rebind API in the pilot.
-   No collection selector, relation selector, generalized page-builder UI or
    arbitrary Entity-model picker in the pilot. Repeatable Hero placement uses
    the seeded compatible Object and a human-labelled record picker.
-   No Hero media ownership; continue using `marketing.image`.
-   No Hero CRUD in published Workspace/runtime.
-   No renderer-side database queries from `apps-template-mui`.
-   No dependency upgrade solely for this feature.

## UI Contract

### Permission and denied-state matrix

| Surface/action                                        | Required capability                                 | Normal-user behavior without capability                                                          |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| View Hero Object/record                               | `viewContent`                                       | Surface follows the existing hidden/not-found policy; no record data is leaked                   |
| Edit default/additional Hero content                  | `editContent`                                       | Fields are read-only and mutation actions are hidden; a localized read-only explanation is shown |
| Create/copy an additional Hero record                 | `editContent`                                       | Add/Copy is hidden, matching the existing metahub record-create route                            |
| Delete an additional Hero record                      | Existing record-delete permission                   | Delete is hidden; `default` and live-bound records remain undeletable even with permission       |
| Add/copy/bind/remove metahub Hero placement           | `manageMetahub`; `editContent` if creating a record | Layout mutation controls are hidden; content edit may still be available through `editContent`   |
| Configure/reset/exclude application Hero presentation | `manageApplication`                                 | Presentation controls are hidden and the managed-by-source state is read-only                    |
| View authenticated/published Hero                     | Existing runtime/public read authorization          | Render-only surface; no authoring controls are mounted                                           |

Frontend permission state must be resolved before rendering mutation controls,
so denied users do not discover authorization by pressing Save and receiving a 403. The server repeats every check and returns the existing typed localized
denial for stale/tampered clients. Browser coverage includes each independent
combination, especially `editContent` without `manageMetahub` and
`manageMetahub` without `editContent`.

### Metahub layout authoring

-   One Hero card is seeded; further Hero cards are allowed in the metahub.
    Add/Copy opens the existing layout action shell with a labelled choice to
    select a compatible Hero record or create a new record. The latter opens
    the normal record editor. An inactive placement still owns its binding.
-   **Configure presentation** opens the shared `MarketingWidgetConfigDialog`
    for presentation-only fields. Source/binding codenames, keys, UUIDs and
    projection JSON are absent.
-   **Edit Hero content** opens the existing `RecordList` edit path and its
    `DynamicEntityFormDialog` for this placement's bound record, with normal
    localized labels, helper text, counters and localized validation. It never
    edits Object settings through `EntityFormDialog`.
-   The two dialogs explain their separate save scope. Dirty close/cancel uses
    the existing localized discard-confirmation contract.
-   Description and terms text are multiline. Action fields use a type selector and
    type-specific input. No raw JSON editor is present.
-   Extend the existing `LocalizedInlineField` locale switcher with EN/RU
    completeness/error affordances; do not create a second localization form.
    Switching locale preserves the unsaved draft. Save validates both locales,
    activates the first erroneous locale and focuses its first invalid control.

### Generic Entity authoring

-   `MarketingPageHero` appears as a normal Object. Its `default` and additional
    records use the same generic record UI and mutation path.
-   The Object's protected-record policy forbids deletion or semantic-key
    changes for `default` in both UI and API. Normal Add and CRUD for additional
    records remain available. Seed `Title` as the display Component and set
    `uiConfig.hidden/gridHidden` for `HeroKey`; use only `gridHidden` for JSON
    action Components so their typed editors remain visible in the form. The
    table shows human Title and Description preview. Extend `RecordList`
    row actions to enforce protected-record and live-binding policy for Copy,
    Delete and direct edits; presentation state does not leak into the table.
-   `HeroKey`, internal record UUIDs, Component UUIDs, storage names, and binding
    metadata are hidden from normal forms/tables.
-   Saving through either entry point updates the same row and invalidates both
    views.

### Application control panel

-   Hero content and binding controls are absent; Add/Copy cannot create an
    unbound application Hero placement.
-   A localized informational notice states that Hero content is managed in the
    source metahub.
-   Approved presentation fields remain editable and resettable. Reset clearly
    describes that it restores source presentation and does not delete content.

### Published application and Workspace

-   Render only the hydrated `MarketingHeroData` view model.
-   No content edit, binding picker, raw errors, IDs, codenames or JSON appear.
    Repeated placements resolve independently and preserve their layout order.
-   Invalid/missing binding fails through the existing localized unavailable/
    degraded runtime policy; it never silently reads SiteSettings.

### Typed action controls

-   Internal action uses a human-labelled choice of verified application routes
    already available from the host's route/section metadata. Phase 0 must
    identify that source; if it does not expose the required routes, add a
    narrowly scoped, permission-filtered catalog at the existing host API,
    never a parallel marketing-only registry. Users never type paths from
    memory.
-   Anchor action uses the existing rendered marketing section-anchor mapping
    and active source placements to offer human labels. Repeated sections use
    their placement identity to disambiguate destinations; users never type
    `#section-key`.
-   External, email and telephone actions use normal URL/email/tel fields with
    examples and localized inline validation. External target is a labelled
    same-tab/new-tab choice.
-   A persisted route/section that is no longer available is displayed as a
    localized unavailable selection and blocks save until replaced; raw keys
    are not shown as the label.
-   Route/section choices have localized loading, empty and unavailable states.
    Catalogs are permission-filtered, query-keyed by source scope and layout,
    bounded, and revalidated on the server. The stored value remains the
    existing typed `MarketingAction`; display labels are not persisted.

### Accessibility and responsive acceptance

-   Reuse `StandardDialog`, `TextField`, labelled `Select`/`Autocomplete`, and
    existing dashboard primitives from `template-mui`.
-   Dialog has an accessible title/description, focus trap, focus restoration,
    keyboard save/cancel, first-invalid-field focus, disabled double submit and
    `aria-live` error summary.
-   Initial focus is Title in the content editor and `showLeadForm` in the
    application presentation editor. Enter in multiline fields does not submit.
-   At 390x844 the dialog scrolls internally and keeps actions reachable. At
    768x1024 and 1920x1080 there is no clipped content or page-level horizontal
    overflow.
-   EN/RU labels, helper text, errors, notice text, action kinds and discard
    prompts are translated. Long RU strings must not truncate controls.
-   Browser assertions reject UUIDs, storage codenames, raw JSON and
    `[object Object]` on normal user surfaces.

## Affected Areas

| Area                    | Expected files/modules                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts        | `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`, `layoutEnvelope.ts`, `marketingPage.ts`, `applicationLayouts.ts`, exports and Vitest suites                                   |
| Shared utilities        | `packages/universo-react-utils/src/validation/marketingPage.ts` only if a reusable Component-to-`MarketingAction` adapter is needed; keep validation browser-safe                                    |
| Template seed           | `packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts`, manifest/baseline validators and tests                                                             |
| Metahub lifecycle       | layout services/controllers, `snapshotLayouts.ts`, `SnapshotRestoreService.ts`, template seed executor/validator, Jest suites                                                                        |
| Application persistence | application widget/layout stores, source sync stores, `applicationLayoutStoreSupport.ts`, `effectiveLayoutResolver.ts`, `applicationLayoutHash.ts`, sync materialization/persistence and Jest suites |
| Runtime resolution      | new bounded widget-binding resolver/loader modules, `runtimeMarketingPageController.ts`, `publicMarketingRuntime.ts`, shared marketing serialization tests                                           |
| Shared MUI UI           | `packages/universo-react-template-mui/src/components/layouts/MarketingWidgetConfigDialog.tsx`, `DynamicEntityFormDialog.tsx`, `StandardDialog` reuse, typed action editor, Jest tests                |
| Metahub frontend        | layout details/editor composition, Entity record dialog adapter, TanStack Query keys/mutations, EN/RU resources, Vitest tests                                                                        |
| Applications frontend   | application layout presentation editor, managed-by-source notice, cache invalidation, EN/RU resources, Vitest tests                                                                                  |
| Published renderer      | `packages/universo-react-apps-template-mui/src/marketing-page/normalize.ts`, Hero components and Vitest tests; no persistence dependency                                                             |
| E2E and fixtures        | marketing baseline contract/checker, marketing flows/permissions/lifecycle/snapshot/visual specs, 73rd Meridian generator/contract/snapshot, screenshot provenance/checkers                          |
| CI and scripts          | root `package.json`, backend real-PG wrapper, `.github/workflows/main.yml`, focused Hero/marketing job if needed, docs i18n job                                                                      |
| Documentation           | relevant package READMEs/README-RU, `docs/en/platform/marketing-page-template.md`, RU counterpart, localized assets/provenance, `SUMMARY.md` only if page structure changes                          |

## Plan Steps

### Phase 0 — Preflight and decision freeze

1. Record the current Git/worktree baseline and preserve unrelated changes.
2. Run OntoIndex freshness diagnostics. Before each product symbol edit, run
   `impact` for the exact UID; treat direct source as authoritative for generic
   codecs because the current graph misses imported call sites.
3. Publish the slot/instance/ownership/trust contract in `docs/en/` and
   `docs/ru/` (and link it from the architecture skill) before code relies on
   this plan alone. Freeze the contracts above in tests first: `__layout.bindings`,
   `semantic-key`, source-owned binding, separate saves, repeatable Hero,
   Component names/limits and typed actions.
4. Enumerate every current Hero reader/writer and every neutral-envelope
   decode/encode/replace call. Produce a checklist covering seed, controller,
   public serializer, hash, source baseline, reset, sync, snapshot, restore,
   effective layout, materializer, fixture and UI.
5. Assert that no DDL or migration is needed. If implementation discovers a
   required schema change, stop and revise the plan rather than hiding it in a
   compatibility field.
6. Verify the existing record-create/delete permissions, `RecordList` action
   hooks, route metadata and rendered section-anchor registry. Record the
   precise catalog and authorization source before implementing a picker.
7. Map all application runtime row mutation endpoints, application layout-copy
   paths (`copyApplicationLayout` and `copy_source_as_application`), and the
   metahub layout graph lock order before adding new policy hooks.

**Exit gate:** exact contracts have failing tests; impacted execution flows and
file owners are recorded; no product behavior has changed yet.

### Phase 1 — Shared binding schemas and canonicalization

1. Add strict Zod schemas and inferred types for selector, target, projection,
   slot binding and binding envelope in a focused module under
   `@universo-react/types`; re-export through normal public entry points.
2. Add bounded constants for slots, targets, fields and string lengths.
3. Add a pure canonicalizer that sorts slots, targets and projection entries,
   rejects duplicates and never adds physical identity.
4. Extend `persistedWidgetNeutralMetadataSchema` with optional `bindings` and
   make decode/encode/replace preserve it with placement.
5. Add positive/negative Vitest coverage for unknown members, duplicate roles,
   malformed selector, physical-ID-like fields, excessive arrays/strings,
   canonical ordering, renderer replacement and round trip.

**Exit gate:** the neutral envelope round-trips bindings and strict parsing
rejects every unapproved shape without changing renderer config.

### Phase 2 — Registry slots and shared authoring metadata

1. Add serializable binding-slot schemas/types to `LayoutWidgetDefinition` and
   API metadata validation. Retain the existing `repeatable` → `multiInstance`
   mapping, including Hero's `true`, so Dashboard behavior is unchanged.
2. Declare the exact Hero `content` slot and field requirements. Keep the
   definition UI-neutral and persistence-neutral.
3. Define one serializable editor metadata contract for presentation fields:
   stable field key, i18n label/helper keys, control kind, default and
   validation bounds. For Hero, both hosts derive `showLeadForm` and its
   validation from this definition; host-only actions stay compositional.
   Record labels and validation for Entity content still come from Component
   metadata, not a second widget field schema.
4. Centralize a pure `validateWidgetBindings(definition, bindings)` helper used
   by seed validation, trusted materialization and runtime resolution.
5. Extend registry tests and all metadata fixtures. Add server negative tests
   for binding/slot mismatch, forged target and unbound application placement.

**Exit gate:** registry metadata validates slot cardinality, capability and
projection shape; both authoring hosts derive presentation controls from one
definition, while repeatable Hero placement remains valid.

### Phase 3 — Clean template seed and data model

1. Add `MarketingPageHero` Object and Components from the fixed model above.
   Add a generic, typed protected-record policy in Entity metadata for the
   semantic key `default`: its key is immutable and the record cannot be
   deleted. Do not set `maxRecords`; additional Hero records may be created,
   copied and deleted through generic Entity CRUD. Enforce protection in record
   services as well as the UI; do not hard-code the marketing codename in
   generic CRUD. Configure `Title` as the display Component; set hidden and
   grid-hidden UI metadata for `HeroKey`, grid-hidden-only metadata for JSON
   action Components, and a multiline Description preview.
2. Seed one `default` record with current EN/RU Hero content and typed action
   values; generate all physical IDs through existing UUID v7 seed machinery.
3. Move Hero fields out of `MarketingPageSiteSettings`; keep branding,
   newsletter, footer/legal fields there.
4. Remove only the obsolete `MarketingPageSection/hero` row. Keep the Section
   Object and rows still used by collection/pricing/footer widgets.
5. Replace Hero `source`/`copySource` renderer config with the trusted neutral
   binding envelope and presentation config.
6. Update template validator, baseline contract and template-contract checker.
   Assert the schema/template version is unchanged.
7. Update the 73rd Meridian generator, contract and committed fixture through
   the real authoring/export path; do not hand-edit generated snapshot data.

**Exit gate:** a fresh metahub has one valid Hero Object record and one bound
Hero widget, allows further records and placements, and has no old Hero
fields/copy row/source config anywhere.

### Phase 4 — Trusted write and mutation boundaries

1. Allow `__layout.bindings` only in trusted seed, authorized metahub Hero
   placement/binding operations, snapshot restore, publication and
   materialization paths after registry validation. The browser submits a
   selected record reference to the narrow operation, never an envelope.
2. Make ordinary metahub/application renderer-config writes use the envelope
   replacement helper so neutral binding survives.
3. Add an explicit reserved-metadata rejection at public route/service input;
   never rely only on hiding fields in React.
   Provide an authorized metahub placement-to-record read operation: resolve
   the server-owned binding of the selected widget against its Entity scope
   and return a bounded editor target (`recordId`, `recordVersion`, human
   display label) to the host. The widget list DTO can remain presentation
   only; no raw binding/projection enters the normal UI. The host then opens
   the standard record editor by that target and refreshes it after rebind.
4. Verify RBAC separately for content edit/create/copy/delete, placement and
   binding operations, presentation edit, publication, sync and reset. Align
   the UI matrix with actual route guards (`editContent` currently authorizes
   record creation); any new permission must be introduced consistently in
   API, UI and tests rather than assumed to exist.
5. Implement a typed Entity-record policy hook called by create/update/copy/
   delete services. For Hero it generates or preserves a unique semantic key,
   protects `default`, rejects deletion of any live-bound record, validates
   complete EN/RU values and parses actions with `marketingActionSchema` on
   every generic or specialized write. The check is server-side and fails
   closed on direct API calls; UI metadata is only its presentation.
   Materialize the same source-owned/read-only policy to application Entity
   metadata and enforce it in a common runtime row mutation guard used by
   every create/copy/update/delete/restore/reorder/relation write path.
6. Preserve optimistic versions and `RETURNING`/zero-row failure behavior.
   Serialize record-delete versus binding-create in the same metahub database
   transaction using the **existing metahub layout graph lock first**, then
   the authoritative Hero Object row lock, before checking records and live
   placement bindings. Both operations must use this order; a prior unbound
   check alone is race-prone and reversed lock order can deadlock. Verify the
   protocol with two concurrent transactions on real PostgreSQL. If it cannot
   be enforced with the current schema/service boundary, revise Phase 0's
   no-DDL assumption before implementation.
7. Add API/store Jest tests for direct rebinding, malformed binding, repeated
   Heroes with distinct targets, stale version, permission denial, duplicate
   semantic key, bound-record deletion and no partial write. Include direct
   application runtime mutation attempts against the published Hero Entity.

**Exit gate:** only trusted server paths can create/change a binding; authorized
users can independently edit content or presentation according to role.

### Phase 5 — Lifecycle, source baseline, semantic hash and restore

1. Audit and update complete encoded config transport in
   `source_config`, typed row mapping and reset comparison. In particular,
   update `applicationLayoutStoreSupport.ts` (`mapWidget`,
   `readWidgetConfigEnvelope`, `encodeWidgetConfigForStorage`) and every
   create/update/batch/move/copy write in `applicationLayoutWidgetsStore.ts`.
   Keep a full trusted envelope inside persistence; replace renderer fields
   through `replaceWidgetRendererConfig` and preserve binding and placement.
2. Extend source sync/materialization so renderer baseline and binding baseline
   move together. When local presentation is customized, construct the new
   effective config from the **new source binding** plus allowlisted local
   presentation fields; do not retain an old whole `config` envelope with a
   stale binding. Test conflict, reset and repeated sync on real PostgreSQL.
3. Include canonical binding in widget/layout semantic hashes and diff inputs;
   continue excluding physical IDs, versions, timestamps and lineage IDs.
4. Preserve bindings through effective-layout overlay selection. Whole-config
   replacement must choose a coherent renderer+binding envelope.
5. Preserve semantic bindings through snapshot export/import and restore.
   Reject physical IDs rather than adding a remap rule.
6. Reject generic application layout copy and
   `copy_source_as_application` for Hero-containing layouts atomically before
   insertion. Add API/store tests for both paths and retain source-derived
   Exclude/Restore behavior. Revisit this restriction only with an explicit
   application-owned binding/content lifecycle design.
7. Add Jest tests for accepted/no-op/conflicting sync, reset, customization,
   effective layout, hash change, stable hash under physical-ID changes,
   snapshot round trip and restore.

**Exit gate:** changing only the semantic binding changes the effective hash
and sync/diff result; every lifecycle operation retains one valid binding.

### Phase 6 — Generic resolver and Hero runtime adapter

1. Implement the pure resolver and injected loader interfaces in small modules;
   keep route controllers as composition roots.
2. Implement authenticated and public record loaders over existing SQL-first
   stores/`DbExecutor`; batch metadata and field reads to avoid N+1 queries.
   The public loader extends `publicApplicationRuntimeStore` and uses the
   `publicApplicationRuntimeController`'s existing `REPEATABLE READ` tx,
   publication/workspace/field allowlists and `Cache-Control: no-store` policy.
   Apply authorization and result limits before projection; the binding can
   select only metadata-verified Components, never SQL identifiers.
3. Resolve semantic key through the declared system key Component, not through
   a universal assumption about current marketing `recordKey`.
4. Validate Entity scope, capabilities, required Components, Component types,
   localization, selector uniqueness, projection and cardinality before data
   leaves the service.
5. Replace fixed Hero branches in `runtimeMarketingPageController.ts` and
   `publicMarketingRuntime.ts` with the shared resolver plus one Hero adapter.
   Resolve each widget placement separately and preserve the existing
   `instanceKey`-based React/anchor identity for repeated Heroes.
6. Keep existing public DTO allowlists/redaction. Do not serialize the binding,
   Entity metadata or storage details.
7. Remove the old Hero SiteSettings/copy-source serializer branches and tests.

**Exit gate:** authenticated and public Hero payloads are semantically equal
for the same published content and fail closed for every invalid binding case.

### Phase 7 — Metahub/application authoring UI

1. Refactor `MarketingWidgetConfigDialog` into renderer-owned field sections
   plus optional host-provided content actions. Shared `template-mui` must not
   import metahub/application data hooks.
2. In `LayoutDetails.tsx`, provide **Edit Hero content** through the existing
   `RecordList` record-edit adapter and `DynamicEntityFormDialog` for the
   placement's selected record. Obtain its target through the authorized
   placement-to-record read operation and carry its optimistic version;
   `EntityFormDialog` edits Object settings and
   is not the record editor. Reuse the existing dialog presentation and
   `LocalizedInlineField` controls. Extend its `renderField` hook for typed
   marketing actions, and forbid raw-JSON fallback for action Components in
   both specialized and generic entry points.
3. Ensure generic Entity UI and specialized entry point use one schema/query/
   mutation path and one optimistic version.
4. Configure multiline fields, counters, context-independent required Hero
   content, optional complete terms group, existing locale-switch controls
   with draft preservation, typed route/section/external/email/tel action
   controls and localized first-error-locale focus. Extend generic validation
   so both required locales are checked, rather than only nonempty locales.
5. In application layout UI, show the managed-by-source notice and only
   presentation/reset controls. Remove source/binding controls for Hero.
6. Keep Add/Copy in metahub `LayoutDetails.tsx` for Hero, but route it through
   a labelled, permission-filtered record select/create step. Reuse the
   existing layout action/dialog shell and `Autocomplete`; object options need
   `getOptionLabel`, stable `isOptionEqualToValue`, and a key for duplicate
   labels per MUI 9.2.0. `ApplicationLayouts.tsx` must hide Add/Copy for Hero
   until an application binding workflow exists; direct application API
   attempts also fail. The generic Hero record list shows human Title and
   Description, allows additional records, and prevents deletion or key change
   of the protected default and deletion of any bound record.
7. Keep reorder/activate and rename destructive placement removal to **Remove from
   layout / Удалить из макета**. Use the canonical confirmation dialog and
   state explicitly that the Entity record remains. Application inherited
   placement follows the existing Exclude/Restore behavior.
8. Apply the permission matrix before rendering controls and repeat every guard
   server-side. Add Jest/Vitest component tests for both hosts, independent
   capability combinations, dirty close, keyboard, error focus, double-submit
   protection, complete terms validation, locale-switch draft preservation,
   repeated Hero selection, no technical leakage and application read-only
   ownership. Keep the `MarketingWidgetConfigDialog` `StandardDialog` footer,
   save/cancel and focus behavior.

**Exit gate:** both metahub entry points edit the same selected content record;
two Hero placements can render two different records. Application edits
presentation only and cannot create an unbound placement.

### Phase 8 — Query identity, invalidation and i18n

1. Add typed TanStack Query key factories/options for bound Hero content,
   permission-filtered route/section catalogs and effective runtime reads;
   include every function variable.
2. Await targeted invalidation after content/presentation edit, record
   create/copy/delete, placement add/copy/rebind/remove, publish, sync,
   reset and target switch. Invalidate inactive dependent queries when needed;
   do not use broad `applicationsQueryKeys.all` as the normal solution.
3. Add cache tests proving no stale Hero after switching metahub/application,
   target, workspace or locale.
4. Place reusable user-facing strings in `@universo-react/i18n`; keep
   package-specific strings in package EN/RU resources. Add parity/coverage
   checks.
5. Map typed server errors to localized messages; never display raw Zod/SQL
   text.

**Exit gate:** UI updates immediately and correctly after every mutation and
no missing/raw translation key appears in EN or RU.

### Phase 9 — Unit, service and real-PostgreSQL verification

Run the repository-native framework for each package instead of introducing a
duplicate runner:

-   Vitest: `@universo-react/types`, `@universo-react/utils`, metahub/application
    frontends, and `@universo-react/apps-template-mui`.
-   Jest: metahubs backend, applications backend, and
    `@universo-react/template-mui`.
-   Real PostgreSQL: focused integration wrapper using the minimal E2E Supabase
    database and `DATABASE_TEST_URL`.

Required real-database scenarios:

1. Fresh seed creates one Object/record/binding graph and UUID v7 physical IDs;
   add/copy placement resolves a second record without changing the first.
2. Specialized content update commits all required EN/RU/action fields or rolls back
   fully on validation failure.
3. Concurrent writes with the same expected version produce one winner and one
   typed conflict.
4. Publication/snapshot sees one coherent Entity+layout graph under concurrent
   change.
5. Sync/reset retains binding and presentation baseline without deleting or
   duplicating the Entity row.
6. Authenticated RLS loader cannot cross metahub/application/workspace scope.
7. Public loader cannot read draft/unpublished/private data and does not reveal
   whether a semantic key exists.
8. Concurrent record-delete versus placement-bind cannot leave a dangling
   binding; repeated source sync with a local presentation override retains
   the new source binding; application update/batch/move/copy cannot erase
   neutral metadata.
9. Generic application layout copy and `copy_source_as_application` reject
   Hero-containing layouts without partial writes. Runtime create/copy/update/
   delete/restore/reorder/relation routes cannot mutate source-owned Hero
   records, even under broad generic content permissions.

**Exit gate:** focused Jest/Vitest/real-PG suites pass with no mocked own
database behavior in integration cases.

### Phase 10 — Playwright browser, responsive, visual and accessibility proof

Use the repository's existing marketing verification wrapper as the full gate;
it owns the local environment, contract checker, Playwright suites, artifacts
and cleanup. Never start `pnpm dev`:

```bash
pnpm test:e2e:marketing-page:verify:local-supabase
```

For a focused debug run, use the wrapper's environment/setup conventions and
guaranteed Supabase cleanup in `finally`; do not concatenate a standalone
start, a build script that starts it again, and a raw Playwright invocation.

Extend/add flows for:

1. Fresh metahub -> specialized Hero content edit -> generic Entity edit of the
   same record -> presentation edit -> publish/sync -> authenticated runtime ->
   anonymous public runtime -> reload.
2. Create a second Hero record through generic CRUD, Add/Copy a second metahub
   placement through the labelled picker, bind it to that record and prove two
   different EN/RU titles render in stable order. Remove one placement and
   verify both records remain; re-add it with explicit selection. Reject
   forged binding, duplicate semantic key and deletion of a bound record.
   Application Add/Copy without a trusted source binding is rejected, while
   source-derived Exclude/Restore remains available.
3. Permissions matrix for content, presentation, create/delete additional
   records, publish, sync and public read. Controls are hidden/read-only before
   action; tampered direct requests still receive typed denial. Attempt
   Workspace Hero record writes and both application layout-copy paths through
   direct APIs; assert denial and no partial write.
4. Snapshot export/import round trip and source reset.
5. EN/RU light/dark at 1920x1080, 768x1024 and 390x844, including editor
   screenshots and published Hero screenshots.
6. Keyboard-only open/edit/validation/save/cancel/restore-focus flow, axe scan,
   first-invalid focus, dialog internal scroll and no page overflow.
7. Human-labelled internal-route and anchor pickers, unavailable-selection
   state, safe external/email/tel rendering, plus negative unsafe scheme,
   credentials, malformed target and missing `rel` cases.
8. Console/page-error monitoring and assertions that no UUID, codename, raw
   JSON or `[object Object]` leaks.
9. In both specialized and generic editors: author EN and RU, switch locales
   without losing dirty values, remove one required locale, assert localized
   error plus first-invalid focus, save both locales, then verify EN and RU
   runtime output. Toggle `showLeadForm` false then true and prove the complete
   content invariant needs no layout-context-dependent Entity validation.
10. Create an additional generic Hero record and prove the first placement
    remains on `default` while the second renders the new record; protect the
    default key/delete, and allow CRUD only when an additional record is not
    bound. Verify both specialized entry points resolve their own placement to
    the correct record and open the same record editor with its current version.

Use role/label locators and web-first assertions. Disable animations for visual
captures, mask only truly volatile content, and inspect every newly generated
screenshot manually before accepting/updating baselines. Store traces,
screenshots and HTML reports for failures.

**Exit gate:** focused flow, permissions, lifecycle, snapshot and visual matrix
pass on a fresh minimal-Supabase database; screenshots have a recorded manual
review verdict.

### Phase 11 — Fixtures, documentation and CI

1. Update the marketing-page baseline contract, template checker, 73rd Meridian
   generator/fixture/contract and all drift checks for `MarketingPageHero`.
   Rewrite old E2E Hero-duplication assertions to require a selected Entity
   record and prove distinct content per repeated instance; retain the
   repeatability coverage.
2. Add a dedicated EN/RU documentation screenshot generator, manifest and
   provenance file. Store locale-specific assets under both GitBook trees; do
   not reuse the English image in the Russian page.
3. Update README/README-RU files for types, metahubs backend/frontend,
   applications backend/frontend, `template-mui`, and `apps-template-mui` where
   their public contract or workflow changes.
4. Update `docs/en/platform/marketing-page-template.md` and RU counterpart with:
   ownership model, Hero editing workflow, source-managed application behavior,
   publish/sync/reset semantics, safe action choices and screenshots.
5. Update the Phase 0 EN/RU architecture document for the final implemented
   slots/bindings, lifecycle, trust boundary and extension checklist. Link it
   from both GitBook navigations and keep their summaries synchronized.
6. Add the missing focused unit/integration/docs commands and extend the
   **existing** marketing verification command; do not redefine it:

```bash
pnpm test:marketing-hero-unit-gate
pnpm test:marketing-hero-integration:local-supabase
pnpm test:e2e:marketing-page:verify:local-supabase
pnpm docs:marketing-page:verify:local-supabase
```

7. Wire a fast schema/Jest/Vitest gate on each relevant PR, focused real-PG and
   Chromium coverage in CI, and path-filtered visual/docs jobs. Upload report,
   trace and screenshot artifacts. Ensure docs-i18n CI invokes marketing
   screenshot provenance/drift checks.

**Exit gate:** code, fixtures, EN/RU docs and screenshots describe the same
contract, and CI can reproduce every acceptance gate.

### Phase 12 — Final quality review and closeout

1. Run Prettier, targeted lint, package builds, focused tests, real-PG and the
   full marketing verification wrapper. Broaden to root build/full relevant
   E2E only after focused gates are green.
2. Run OntoIndex `gn_verify_diff`/`detect-changes`; verify only intended symbols
   and flows changed and inspect any HIGH/CRITICAL impact.
3. Run Thermos/autoreview for correctness, security and maintainability. Block
   closeout on CRITICAL/HIGH findings and remediate accepted MEDIUM findings in
   scope.
4. Re-scan for old Hero fields, old Hero `copySource`, binding physical IDs,
   hard-coded marketing source allowlists, raw user-facing identifiers/JSON,
   missing translations and accidental version increments.
5. Record exact commands, counts, screenshots, trace/report paths and any
   genuinely unrun external CI evidence in `progress.md`/`tasks.md`.

**Exit gate:** all local gates are green, independent review has no blockers,
the minimal Supabase instance is stopped, and no claim exceeds observed
evidence.

## Test Oracle Matrix

| Concern                                | Unit/component      | Service/API               | Real PostgreSQL        | Browser                          |
| -------------------------------------- | ------------------- | ------------------------- | ---------------------- | -------------------------------- |
| Strict binding schema/canonicalization | Vitest              | seed/route negative       | round trip             | API tamper negative              |
| Slot capability/Component validation   | Vitest              | resolver Jest             | authoritative metadata | invalid-binding state            |
| Repeatable Hero and distinct targets   | registry Vitest     | create/copy/bind Jest     | bind/delete race       | two Heroes, two records          |
| Source-owned binding                   | envelope tests      | direct rebind rejected    | no partial write       | application has no picker        |
| Source-owned Hero content              | record-policy tests | all runtime writes denied | no partial write       | Workspace read-only              |
| Application layout-copy boundary       | copy/store tests    | both copy paths denied    | no partial write       | localized unavailable action     |
| Content/presentation ownership         | dialog Jest/Vitest  | RBAC tests                | independent OCC        | metahub vs app flows             |
| Hash/sync/reset                        | hash Jest           | diff/sync/reset Jest      | coherent graph         | publish/reset/reload             |
| Snapshot/restore                       | snapshot tests      | restore Jest              | import/export          | round-trip flow                  |
| Auth/public parity                     | adapter tests       | both controller suites    | RLS/public scope       | authenticated + anonymous        |
| Actions/security                       | schema/utils tests  | redaction/allowlist       | persisted typed value  | safe link attributes             |
| Cache freshness                        | query-key Vitest    | mutation invalidation     | n/a                    | edit/rebind/publish/sync/locale  |
| UX/a11y/i18n                           | component tests     | localized error mapping   | n/a                    | EN/RU, keyboard, axe, overflow   |
| Visual fidelity                        | renderer Vitest     | n/a                       | n/a                    | 3 viewports x EN/RU x light/dark |

## Performance and Security Budgets

-   Resolver performs bounded metadata and record queries; batch projection reads
    and avoid one query per field. Hero cardinality is one and projection is at
    most 32 fields.
-   Parse strict schemas at every untrusted boundary. Do not use `passthrough`,
    arbitrary field maps, dynamic client SQL identifiers or unbounded JSON.
-   Public payload keeps existing field allowlists and row/size limits. Binding
    metadata remains server-only.
-   Semantic hash canonicalization is deterministic and linear in the bounded
    slot/field counts.
-   Frontend does not duplicate Entity content in local/widget storage. Draft
    state exists only while a dialog is open.
-   External links use the existing typed action policy and mandatory
    `noopener noreferrer`; unsafe schemes, protocol-relative URLs, embedded
    credentials and unsupported query parameters fail validation.
-   Logs may include stable error codes and request correlation IDs, never Entity
    content, email values, raw bindings, SQL, credentials or public-read secrets.

## Potential Challenges and Mitigations

### Neutral metadata is silently dropped

The current renderer codec preserves only placement in its typed neutral view,
and hash normalization currently emits only placement. Add failing lifecycle
tests before implementation and update every encode/decode/projection path in
one phase.

### Source baseline compares renderer config only

Raw `source_config` can contain the complete envelope while typed projections
may strip neutral data. Keep one canonical encoded baseline for persistence and
derive presentation/binding views explicitly. Test sync/reset at store level.

### Fixed Hero logic remains in one runtime path

Authenticated and public serializers currently have separate hard-coded Hero
branches. Make both depend on the same resolver and adapter; keep only the
authorization/data-loader boundary separate.

### Specialized and generic editors diverge

Both must open/update the same Entity row through the same schema and mutation.
The specialized surface supplies field ordering/help only. Browser flow edits
through both paths and verifies the second sees the first immediately.

### Typed actions are stored as JSON

JSON is acceptable as an Entity Component storage type only behind the strict
`marketingActionSchema` and normal form controls. Bound depth/size, reject
unknown members, and never show a raw JSON editor.

### Repeatable placement and record lifecycle can race

The brief requires that different Hero placements **can** bind different
records; explicit shared-record selection remains valid.
Metahub Add/Copy must resolve an explicit record choice; `RecordList` and the
layout service must share a server-enforced live-binding/deletion policy. Test
concurrent binding versus deletion and keep application Add/Copy unavailable
without a trusted source binding.

### Existing fixtures lock the old model

The marketing baseline and 73rd Meridian snapshot currently assert
SiteSettings Hero fields and `copySource`. Regenerate fixtures through product
APIs and update drift contracts in the same change; do not weaken the gates.

### Visual baselines can pass while the workflow is unusable

Keep semantic browser assertions, keyboard/a11y/overflow checks and manual
screenshot review alongside visual diffs. Record viewport, locale, theme and
fixture provenance for every accepted image.

## Acceptance Criteria

-   `MarketingPageHero/default` is the only seeded Hero content record in a
    fresh database. Additional records can be created and bound to additional
    metahub Hero placements through a human-labelled selection flow.
-   No Hero content remains in SiteSettings or `MarketingPageSection/hero`; no
    Hero renderer config uses `source` or `copySource`.
-   Each Hero placement has one strict semantic binding in `__layout.bindings`;
    two placements may target different records, and all bindings survive the
    lifecycle and participate in hashes/conflicts/caches.
-   Normal application APIs cannot alter the binding; application users can
    edit/reset presentation only. Generic runtime row mutations cannot edit
    source-owned Hero content. Application layout-copy paths reject Hero
    atomically until their ownership/lifecycle model is designed.
-   Metahub specialized and generic Entity editors update the same record with
    localized, accessible, safe controls and separate honest save scopes. Each
    placement resolves its own authorized record target and version.
-   Authenticated and public runtime use the same resolver semantics and emit the
    same typed Hero data without technical leakage.
-   Repeatable Hero is preserved in metadata, UI, API, store and materializer;
    deleting a placement never deletes content, and a bound record cannot be
    deleted until its placement is rebound or removed.
-   Jest, Vitest, real-PG and focused Playwright suites pass on a recreated
    minimal Supabase database.
-   EN/RU light/dark screenshots at desktop/tablet/mobile are inspected and show
    no clipping, raw identifiers, JSON, inaccessible controls or horizontal
    overflow.
-   README and EN/RU GitBook documentation, localized assets, provenance, fixture
    contracts and CI all match the implemented behavior.
-   No database migration, schema/template/snapshot version bump, legacy reader,
    hidden compatibility branch, or new `pnpm dev` dependency is introduced.

## Primary References

-   Research handoff:
    `memory-bank/research/unified-entity-backed-widget-authoring-hero-pilot-research-2026-09-20.md`
-   Historical architecture source: `.backup/Архитектура-виджетов.md`
-   Exact-version Context7 baseline used by the research: MUI 9.2.0, TanStack
    Query v5, and Zod 3-compatible parsing patterns.
-   MUI Dialog: https://mui.com/material-ui/react-dialog/
-   MUI Grid/responsive layout: https://mui.com/material-ui/react-grid/
-   TanStack Query keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
-   TanStack Query invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
-   React stable list keys: https://react.dev/learn/rendering-lists
-   PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
-   OWASP redirect/forward safety:
    https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html

## Implementation and QA Closure (2026-09-24)

The QA findings from the implementation closeout and the follow-up review were
resolved. Marketing card tests use stable card test IDs instead of MUI class
selectors. The shared-primitive architecture guard scopes its JSX count to the
actual owning component body and asserts both `LayoutAuthoringList` render
branches. The Hero unit gate now contains only Hero-specific suites, avoiding
duplication with the landing-runtime gate. CI runs the full minimal-Supabase
Marketing Hero browser/visual runner and uploads its evidence once, requiring
that evidence after a successful gate.

The marketing authoring support layer no longer imports parsers from flow
specs. Responsive list/card UX assertions live in their own helper, separate
from copy mutations and persistence assertions. The screenshot checker and
generator share a PNG parser that validates the complete signature, IHDR,
chunk bounds, CRCs, IDAT, and terminal IEND; malformed-image tests cover these
failure paths.

Verification completed on 2026-09-24:

-   `pnpm test:marketing-hero-unit-gate` passed, including the scoped architecture
    guard and Hero-specific metahub/application suites.
-   `pnpm --filter @universo-react/apps-template-mui lint` and
    `pnpm --filter @universo-react/metahubs-frontend lint` passed; changed files
    pass Prettier and `git diff --check`.
-   `pnpm docs:marketing-page:verify:local-supabase` passed: 36 workspace build
    tasks, screenshot generator 2/2, provenance, 115 EN/RU documentation pairs,
    screenshot assets, and local links. The regenerated English and Russian
    pages were visually inspected.
-   `pnpm test:e2e:marketing-page:verify:local-supabase` passed on minimal local
    Supabase: Chromium 17 passed, one documented opt-in standalone-host test was
    skipped, retries 0; the EN/RU light/dark visual matrix passed 5/5 with retries 0. The runner stopped the E2E Supabase stack.
-   OntoIndex `gn_verify_diff` passed for all 325 explicitly supplied changed and
    untracked paths, in 200-path and 125-path batches, with the executed gates
    recorded. OntoIndex still warns that its diff scan is capped at 200 paths per
    call and returns no symbol/impact verdict for this dirty, uncommitted tree;
    the pass therefore certifies the supplied file/test inventory only.
-   The security review reported no actionable findings. The initial test-oracle
    and maintainability reviews produced findings which were fixed and verified.
    The broad Autoreview could not complete: it returned `ENGINE_TIMEOUT` after
    120 seconds on a 1.72-million-character, 32-part bundle. No Autoreview PASS
    is claimed.

The clean-break constraints remain satisfied: no legacy Hero reader, database
migration, schema or metahub-template version bump, or `pnpm dev` dependency was
introduced.

### Follow-up review closure (2026-09-24)

The final test-architecture review's two LOW findings were corrected. The AST
guard now verifies one `LayoutAuthoringList` render in each `error`/data branch,
and responsive copy-dialog screenshots/assertions use a separate helper. The
Hero unit gate passed, the metahubs frontend and E2E support lint passed, and
the minimal-Supabase authoring E2E passed 3/3. Its desktop, tablet and mobile
copy-dialog screenshots, including mobile validation, were inspected. The
focused independent reviewer confirmed the fixes without further findings.
Canonical Autoreview of an isolated 16,367-character bundle containing only
these three test/support files ended `INCOMPLETE/ENGINE_TIMEOUT` at 180 seconds,
so no Autoreview PASS is claimed; the earlier full-worktree timeout is recorded
above. Deterministic tests, lint and browser evidence passed.
