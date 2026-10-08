# Plan: Dashboard Complete Entity-Backed Widgets

**Date:** 2026-10-02
**Status:** Implementation complete — ready for commit/PR
**Scope:** Clean-cutover refactor of the complete Dashboard layout/widget family to the Entity-backed widget architecture
**Primary brief:** Original implementation request (2026-10-01)
**Technical brief:** QA-reviewed technical requirements brief (2026-10-01)
**Research:** `memory-bank/research/dashboard-complete-entity-backed-widgets-research-2026-10-02.md`

## Implementation Closeout Evidence — 2026-10-07

The phase checklists below are retained as planning traceability. This closeout ledger is the authoritative execution record for the completed implementation state.

-   **Architecture:** clean cutover is implemented. Durable Dashboard content is Entity-backed; placement rows own composition/presentation/`instanceKey`/nesting; registry metadata owns source/binding/authoring policy; runtime DTOs fail closed; no schema or built-in metahub-template version bump was introduced for this refactor.
-   **Focused runtime unit verification:** `pnpm --filter @universo-react/apps-template-mui exec vitest run src/dashboard/__tests__/Dashboard.test.tsx src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.entity-table.test.tsx src/dashboard/components/__tests__/widgetRenderer.runtime-state.test.tsx src/dashboard/runtime/__tests__/widgetPlacementGraph.test.ts` passed **5/5 files, 74/74 tests**.
-   **Runtime UX helper verification:** `node --test tools/testing/e2e/support/browser/runtimeUx.test.ts` passed **9/9 tests**. The final `expectLocatorFullyFitsViewport` implementation uses a web-first visibility assertion and retries only the bounding-box read/geometry assertions, preserving full horizontal and vertical viewport checks.
-   **Fresh local-Supabase browser acceptance:** `pnpm test:e2e:dashboard-entity-backed:verify:local-supabase` passed **11/11**. The authoritative status artifact is `tools/testing/e2e/.artifacts/dashboard-entity-backed/2026-10-07T00-12-06-878Z/status.json` with `status: passed` and `finishedAt: 2026-10-07T00:20:02.009Z`. The included LMS snapshot-import runtime also passed.
-   **Visual inspection:** current Dashboard desktop/tablet/mobile screenshots and the 390 px Dashboard source-picker screenshot were inspected from the same acceptance artifact. No page-level horizontal overflow, raw ID/JSON leakage, clipped source-picker dialog, or reference-sensitive Dashboard geometry defect was observed.
-   **Fixture regeneration:** `pnpm test:e2e:dashboard-fixtures:regenerate:verify:local-supabase` passed. The generated 73rd Meridian, Interpretation Network, LMS, MMOOMM, Quiz, and Self-hosted snapshots byte-matched the committed six Dashboard-family fixtures.
-   **Historical MMOOMM baseline:** `tools/fixtures/mmoomm-runtime-pre-extraction-baseline.json` remains unchanged with SHA-256 `ee6025ab24f00ffaa3b88cd3f3ab34f27290e4662876d3584de4ab51e6667c00`.
-   **Package/documentation gates:** `pnpm check:apps-template-isolation`, `pnpm check:runtime-no-lms-forks`, `pnpm docs:i18n:check`, `node tools/docs/check-gitbook-links.mjs`, and `pnpm docs:gitbook-screenshot-assets:check` all passed. The documentation check covered **115 EN/RU page pairs**.
-   **Build/formatting:** the full acceptance wrapper completed the root build with **36/36 build tasks**. Final `git diff --check` is clean.
-   **OntoIndex:** `ontoindex detect-changes --repo universo-platformo-react` completed and reported a **high** blast radius, **8 affected processes**, and scan caps of **200 files / 1000 symbols**, which is expected for this unusually large dirty refactor. The earlier `gn_verify_diff` run was formally non-passing because it was invoked without populated expected file/symbol sets and hit the same capped diff; it reported no missing required tests. Direct source review plus deterministic test/browser evidence remain authoritative for uncommitted changes not represented by the stale graph snapshot.
-   **Thermos closeout:** a full local autoreview bundle was intentionally not run because the dirty tree expands to 64 review parts and the nested review-engine launch was rejected before execution in the current Codex bridge. Following the user's explicit instruction to bound Thermos for this very large change, two independent narrow specialist reviews were run instead: backend correctness/security **PASS** and Dashboard runtime/maintainability **PASS**, with **no confirmed CRITICAL/HIGH/MEDIUM findings**.

## Overview

Complete the Dashboard migration to one storage and runtime ownership model:

-   Entity records own durable editorial/domain content.
-   Widget placement rows own composition, activation, order, zone, nested parent/slot position, and registry-declared presentation settings.
-   Registry definitions own binding/source compatibility, authoring policy, duplication semantics, multiplicity, host requirements, and runtime adapter contracts.
-   Workspace records remain workspace-owned runtime data.
-   Specialized runtime sources such as PlayCanvas manifests, quiz/module contracts, and Interpretation Network state remain specialized typed sources when forcing them into a generic Entity record would be artificial.

This is a clean cutover. The disposable test database will be recreated, so implementation must delete the old Dashboard payload model instead of preserving compatibility readers, dual writes, translators, repair jobs, or migration adapters. Do not bump database schema versions, minimum-structure versions, or built-in metahub-template versions solely because of this refactor.

The visible MUI 9 Dashboard design is not being redesigned. `.backup/templates/dashboard` remains the geometry/visual provenance. The refactor changes data ownership and authoring while preserving the recognizable Dashboard shell and responsive behavior.

## Planning Evidence and Fixed Decisions

### Evidence used

-   Same-day QA-refined research artifact:
    `memory-bank/research/dashboard-complete-entity-backed-widgets-research-2026-10-02.md`.
-   Prior completed Marketing Page Entity-backed implementation and plan:
    `memory-bank/plan/marketing-page-complete-entity-backed-widgets-plan-2026-09-27.md`.
-   Current source in:
    `@universo-react/types`, metahub backend/frontend, applications backend/frontend,
    `@universo-react/apps-template-mui`, built-in template data, fixture generators/contracts,
    and `.backup/templates/dashboard`.
-   Project skills:
    `universo-platform-architecture`, `mui-runtime-ux-patterns`,
    `runtime-ux-qa`, and `playwright-best-practices`.
-   Context7 spot checks:
    -   MUI 9.2.0 continues to separate two-dimensional Grid layout from Stack-based one-dimensional layout and supports responsive breakpoint objects.
    -   TanStack Query v5 recommends explicit mutation/cache synchronization with cancel/snapshot/rollback/invalidate when optimistic updates are used.
    -   Current MUI X Data Grid documentation reinforces a server-owned Data Source boundary. Context7 did not expose an exact MUI X 9.8.0 version selector, so concrete APIs must be verified against the locally installed 9.8.0 package before implementation.
-   OntoIndex semantic inspection confirmed current cross-package hotspots around snapshot materialization, application layout sync, effective layout persistence, and the existing Marketing binding path. Its index reported degraded coverage for two oversized files, therefore graph findings must be paired with direct source inspection before edits.
-   Independent architecture and QA subagent reviews are required before implementation starts; their findings are to be applied to this plan rather than deferred into IMPLEMENT.

### Fixed architecture decisions

1. **Canonical ownership:** Entity content, placement composition/presentation, registry contracts, workspace runtime records.
2. **No legacy:** retired `show*` composition, embedded child widget arrays, content-bearing Dashboard configs, and old datasource locators fail strict validation.
3. **No template-key source lifecycle:** replace `templateKey === 'marketing-page'` binding/source inheritance branches with one neutral registry/lineage classifier.
4. **Persist host controls as placements:** retained host/system widgets use normal canonical placement rows supplied with host DTO/state. The runtime must not silently inject missing widgets at mount time.
5. **First-class nested composition:** `columnsContainer` and `detailsTabs` children are ordinary placement rows linked by `parent_widget_id` + `slot_key`.
6. **Universal portable semantic identity:** every retained Dashboard placement has a mandatory server-owned `instanceKey`. It is generated for create/seed, persisted as placement metadata, preserved through snapshot/publication/application synchronization and Reset, remains unique inside each effective graph, and is replaced with a new unique value only when a placement/subtree is duplicated. Physical UUIDs are never semantic identity and never participate in semantic hashes.
7. **Separate source lineage from nesting:** `source_base_widget_id` remains source/inheritance lineage and is never reused as a parent pointer.
8. **Atomic subtree duplication:** structural container duplication is orchestration over the persisted subtree, not a fourth duplicate mode. Placement-copy permission is distinct from the binding duplicate policy `none | share-bindings | clone-record`; every copied node gets a new UUID v7 placement ID and a new unique `instanceKey`, and the whole operation commits or rolls back as one transaction.
9. **Runtime isolation:** `@universo-react/apps-template-mui` receives strict allowlisted DTOs, not bindings, physical Entity/Component IDs, schema/table names, or arbitrary persistence metadata.
10. **Bounded data sources:** charts/tables consume server-owned semantic source contracts. Renderer config must not evolve into a client query/SQL language.
11. **Six generated fixtures, one immutable baseline:** regenerate the six snapshot fixtures; preserve `mmoomm-runtime-pre-extraction-baseline.json` byte-for-byte and rerun its historical parity proof.
12. **MVP stock-widget decisions:** retire MUI-demo-only widgets that do not have a real Platformo role; retain useful generic surfaces only when they have a legitimate host, Entity, bounded data, or specialized runtime owner.

## Normative Dashboard Widget Ownership Matrix

Seed policy terms:

-   **shell** — canonical system/shell placement seeded for Dashboard layouts where the surface is applicable.
-   **optional** — registered and user-addable, but not active by default in Basic.
-   **demo** — active with real seeded sources in Basic Demo only.
-   **specialized** — seeded only by the built-in template that needs the domain/runtime capability.
-   **retired** — removed from the registry, schemas, renderer, authoring, templates, tests, and docs.

Binding duplicate mode uses the shared registry vocabulary `none | share-bindings | clone-record` only for placements that actually own bindings. A separate serializable placement-copy permission controls whether an ordinary placement can be copied. Host/structural widgets without bindings therefore do not pretend to have a `share-bindings` binding operation. For structural subtrees, the container operation is atomic and each descendant's placement-copy permission and binding duplicate policy are authoritative.

| Widget key                       | Decision / owner                                                                                                                                        | Binding or runtime source                                                                                                                               | Placement-owned presentation / structure                                                                     | Multiplicity / seed                                 | Placement copy / binding policy                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| `brandSelector`                  | **Retire.** Current Sitemark/product selector is upstream demo state with no Platformo product contract.                                                | none                                                                                                                                                    | none                                                                                                         | retired                                             | n/a                                                |
| `workspaceSwitcher`              | Retain, host-derived workspace/session control.                                                                                                         | host workspace DTO                                                                                                                                      | compact/wide variant only                                                                                    | repeatable; shell where workspace UX is enabled     | allowed / n/a                                      |
| `divider`                        | Retain, structural.                                                                                                                                     | none                                                                                                                                                    | orientation/spacing only if needed                                                                           | repeatable; shell/optional                          | allowed / n/a                                      |
| `menuWidget`                     | Retain with explicit **generated** and **manual** registry variants. Generated navigation is host-derived; manual navigation content is Entity-owned.   | generated: host section/workspace navigation; manual: required `items` record-set plus optional semantic heading record if the title is editorial       | max visible items, overflow behavior, compact/wide projection, generated/manual variant                      | repeatable; shell; Basic Demo exercises manual mode | allowed / generated: n/a; manual: `share-bindings` |
| `spacer`                         | Retain, structural flex spacer.                                                                                                                         | none                                                                                                                                                    | flex/size constraints only                                                                                   | repeatable; shell/optional                          | allowed / n/a                                      |
| `infoCard`                       | Retain as a generic editorial notice/info card; delete hard-coded `CardAlert` content.                                                                  | required `content` semantic-record binding to a compatible Object/Page record                                                                           | severity/visual variant, optional icon/action presentation                                                   | repeatable; optional/demo                           | allowed / `clone-record`                           |
| `userProfile`                    | Retain, authenticated host-derived state.                                                                                                               | host current-user DTO                                                                                                                                   | compact/wide presentation                                                                                    | repeatable; shell                                   | allowed / n/a                                      |
| `appNavbar`                      | Retain, shell composition primitive.                                                                                                                    | host/navigation context                                                                                                                                 | fixed/mobile shell presentation                                                                              | singleton; shell                                    | forbidden / n/a                                    |
| `header`                         | Retain, shell composition primitive.                                                                                                                    | host/layout context                                                                                                                                     | shell geometry only                                                                                          | singleton; shell                                    | forbidden / n/a                                    |
| `breadcrumbs`                    | Retain, route-derived host control.                                                                                                                     | host route/breadcrumb DTO                                                                                                                               | overflow/compact presentation                                                                                | repeatable; shell                                   | allowed / n/a                                      |
| `search`                         | Retain, host/runtime search control.                                                                                                                    | registered host search capability, not persisted Entity content                                                                                         | width/variant only                                                                                           | repeatable; shell/optional                          | allowed / n/a                                      |
| `datePicker`                     | Retain as an interaction control; remove fixed/demo date state.                                                                                         | current host/local date state; optional registered runtime filter context                                                                               | date-range/presentation options only                                                                         | repeatable; optional                                | allowed / n/a                                      |
| `optionsMenu`                    | Retain, host/system actions.                                                                                                                            | host notification/preferences capabilities                                                                                                              | action visibility/order from registered host capabilities                                                    | repeatable; shell                                   | allowed / n/a                                      |
| `languageSwitcher`               | Retain, host locale state.                                                                                                                              | host locale capability                                                                                                                                  | existing switcher presentation                                                                               | singleton; shell                                    | forbidden / n/a                                    |
| `colorModeSwitcher`              | Retain, host theme state.                                                                                                                               | host theme capability                                                                                                                                   | existing switcher presentation                                                                               | singleton; shell                                    | forbidden / n/a                                    |
| `overviewTitle`                  | Retain as editorial heading.                                                                                                                            | required `content` semantic-record binding                                                                                                              | typography/alignment/level                                                                                   | repeatable; optional/demo                           | allowed / `clone-record`                           |
| `overviewCards`                  | Retain as generic metric-summary surface; delete embedded card values/sparklines.                                                                       | required bounded `metric-set` semantic source resolved server-side; no physical fields/SQL in client config                                             | card count cap, formatting, density, trend visualization                                                     | repeatable; optional/demo/specialized               | allowed / `share-bindings`                         |
| `sessionsChart`                  | Retain as a generic time/record-series chart preset, not a demo dataset.                                                                                | required bounded `series` semantic source                                                                                                               | title/interval/series labels, chart style, max points within server cap                                      | repeatable; optional/demo/specialized               | allowed / `share-bindings`                         |
| `pageViewsChart`                 | Retain as a second generic chart preset using the same bounded resolver architecture.                                                                   | required bounded `series` semantic source                                                                                                               | title/interval/series labels, chart style, max points within server cap                                      | repeatable; optional/demo/specialized               | allowed / `share-bindings`                         |
| `detailsTitle`                   | Retain as editorial heading.                                                                                                                            | required `content` semantic-record binding                                                                                                              | typography/alignment/level                                                                                   | repeatable; optional/demo                           | allowed / `clone-record`                           |
| `detailsTable`                   | Retain as generic Entity/workspace record surface.                                                                                                      | required `rows` record-set binding; server resolves schema/display metadata and permitted actions                                                       | search/view toggle, row-reorder affordance, bounded display/action configuration                             | repeatable; optional/demo/specialized               | allowed / `share-bindings`                         |
| `relationBuilder`                | Retain as generic relation authoring surface.                                                                                                           | optional `parent` record-set + repeatable semantic `panel:<slotKey>` relation-set family; source identities live in bindings, not panel datasource JSON | panel title/width/order, row reorder, wizard/display behavior; domain workflow actions remain typed behavior | repeatable; specialized/optional                    | allowed / `share-bindings`                         |
| `columnsContainer`               | Retain, structural container.                                                                                                                           | none; children are first-class placements                                                                                                               | stable column `slotKey`, width and order only                                                                | repeatable; optional/demo/specialized               | allowed subtree orchestration / n/a                |
| `detailsTabs`                    | Retain, structural container.                                                                                                                           | none; children are first-class placements                                                                                                               | stable tab `slotKey`, localized label, active/default tab, order only                                        | repeatable; optional/demo/specialized               | allowed subtree orchestration / n/a                |
| `interpretationNetworkWorkspace` | Retain, specialized typed runtime surface.                                                                                                              | registered Interpretation Network runtime/source contract; Entity bindings only for genuinely Entity-owned supporting content                           | view/display defaults and safe runtime behavior                                                              | repeatable; specialized                             | allowed / source contract share                    |
| `quizWidget`                     | Retain, specialized module/domain surface.                                                                                                              | server-resolved quiz/module semantic source; any durable quiz content stays in its existing Entity/domain model                                         | submit method/behavior and presentation fields; no raw quiz IDs in normal UI/runtime DTO                     | repeatable; specialized                             | allowed / source contract share                    |
| `playcanvasCanvas`               | Retain, specialized PlayCanvas runtime.                                                                                                                 | published-manifest source contract resolved server-side                                                                                                 | height/camera/presentation and allowlisted runtime options                                                   | repeatable; specialized                             | allowed / source contract share                    |
| `resourcePreview`                | Retain as Entity/resource preview.                                                                                                                      | optional/required-by-variant `resource` semantic-record binding resolved to an allowlisted preview DTO                                                  | display mode, title override only when explicitly presentation                                               | repeatable; specialized/optional                    | allowed / `share-bindings` when bound              |
| `learnerPlayer`                  | Retain, LMS/runtime record surface.                                                                                                                     | bounded parent/items record-set + relation/source bindings; learner progress remains workspace/runtime-owned                                            | sequencing/display behavior and safe field-role metadata                                                     | repeatable; specialized                             | allowed / `share-bindings`                         |
| `productTree`                    | **Retire.** Current Website/Store/Product tree is demo-specific. A future real tree widget must be introduced from an actual hierarchy source contract. | none                                                                                                                                                    | none                                                                                                         | retired                                             | n/a                                                |
| `usersByCountryChart`            | **Retire.** Current country values are upstream demo content; legitimate country analytics can use the generic chart source contract.                   | none                                                                                                                                                    | none                                                                                                         | retired                                             | n/a                                                |
| `footer`                         | Retain as host/application metadata projection.                                                                                                         | host application/site metadata DTO                                                                                                                      | spacing/alignment and optional display toggles                                                               | repeatable; shell/optional                          | allowed / n/a                                      |

### Field ownership rules

The matrix above is enforced at field level:

1. Durable copy/list/card/resource data -> Entity/domain record.
2. Semantic source identity -> neutral binding/source contract.
3. Renderer appearance -> registry-declared presentation field.
4. active/order/zone/parent/slot -> placement row.
5. route/user/theme/locale/workspace/session state -> host DTO.
6. PlayCanvas/module/report/Interpretation Network engine state -> specialized typed source.
7. MUI sample values/content -> delete.

Old Dashboard config fields such as physical section/object IDs/codenames, embedded menu items, embedded stat-card values, chart arrays, nested widget arrays, and `show*` composition booleans are not accepted by the final strict schemas.

Before any schema implementation in Phase 1, produce an exhaustive **Dashboard Field Ownership Inventory** from every current Dashboard config/source schema. It is a blocking design artifact, not an implementation afterthought. Each persisted path must have exactly one row with:

```text
widgetKey | current field/path | semantic purpose | final owner
          | final contract location | validation disposition
          | placement-copy/binding-copy behavior | required tests
```

Allowed final-owner values are `entity`, `binding`, `placement`, `presentation`, `host-runtime`, `specialized-runtime`, or `retired`. The inventory must have zero unclassified current fields. A completeness test must compare the current/final strict schema key surface to this inventory so fields such as `detailsTable` actions/defaults, `relationBuilder` panels, learner/resource settings, and specialized runtime options cannot silently remain mixed source/presentation blobs.

### Source/application authority classes

The registry must encode these application-authoring classes explicitly instead of inferring them from `templateKey`:

-   **Source-managed Entity/bounded-data:** manual `menuWidget`, `infoCard`, `overviewTitle`, `overviewCards`, `sessionsChart`, `pageViewsChart`, `detailsTitle`, `detailsTable`, `relationBuilder`, `resourcePreview`, and `learnerPlayer`. Metahub owns source selection/bindings; Application may apply only registry-declared presentation plus explicitly enabled active/root-order deployment overrides to the inherited placement.
-   **Source-managed specialized runtime:** `interpretationNetworkWorkspace`, `quizWidget`, and `playcanvasCanvas`. Their source identity remains Metahub/publication-owned; Application may tune only registry-declared presentation/runtime-safe options.
-   **Source-owned structural composition:** inherited `columnsContainer` and `detailsTabs`. Metahub owns parent/slot composition for MVP; Application can tune presentation and Reset to source but cannot reparent/rebind inherited descendants.
-   **Host/system/structural without source bindings:** `workspaceSwitcher`, `divider`, generated `menuWidget`, `spacer`, `userProfile`, `appNavbar`, `header`, `breadcrumbs`, `search`, `datePicker`, `optionsMenu`, `languageSwitcher`, `colorModeSwitcher`, and `footer`. Their placements are still canonical persisted placements; the runtime supplies current host state through verified host capabilities.
-   **Retired:** `brandSelector`, `productTree`, `usersByCountryChart`.

Phase 1 must inventory the existing `ApplicationTemplateHostCapability` literals and attach only capabilities that already exist or are deliberately added with shared type/tests. Do not invent string capability names ad hoc in renderer code.

For inherited source-managed placements, the application override contract is explicit:

-   source/Metahub owns `instanceKey`, bindings/source identity, `zone`, `parent`, `slot`, and all reparent/rebind operations;
-   Application may override only registry-declared presentation fields plus `active` and root-level sibling `order` when the registry explicitly enables those two deployment overrides;
-   nested descendant order is source-owned for MVP because it is part of source-managed container composition;
-   Application-owned local placements keep the normal local placement controls;
-   Reset removes every permitted Application override and restores all source-owned placement/composition values from the current source baseline.

This authority must be represented by serializable registry metadata; frontend visibility alone is never the security or integrity boundary.

## Nested Composition Model

### Persistence

Add nullable fresh-schema columns to both metahub and application widget tables:

-   `instance_key TEXT NOT NULL`
-   `parent_widget_id UUID NULL`
-   `slot_key TEXT NULL`

Requirements:

-   IDs use the project UUID v7 generator.
-   `(layout_id, instance_key)` is unique for physical placements in one layout; an effective graph must also reject duplicate semantic `instanceKey` values after base/overlay resolution.
-   Root placements have both fields null.
-   Nested placements require both fields.
-   Add a database `CHECK` equivalent to `((parent_widget_id IS NULL AND slot_key IS NULL) OR (parent_widget_id IS NOT NULL AND slot_key IS NOT NULL))`.
-   Parent and child must belong to the same effective source graph. A metahub overlay child may reference a placement stored in its base layout; the application materializer resolves that graph into one application layout.
-   `parent_widget_id != id`.
-   A useful index is `(layout_id, parent_widget_id, slot_key, sort_order, id)`.
-   Metahub widget rows use a scalar parent-ID foreign key so an overlay child can reference an inherited base placement. Snapshot, authoring, and sync boundaries validate the resolved graph; application materialization enforces same-layout placement rows.
-   Deleting a container must remove or explicitly reject orphaned descendants atomically; do not leave detached child placements.

### Container metadata

`columnsContainer` config contains only structural column descriptors:

```ts
type ColumnsContainerPresentation = {
    columns: Array<{
        slotKey: string
        width: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
    }>
}
```

`detailsTabs` config contains only tab presentation:

```ts
type DetailsTabsPresentation = {
    tabs: Array<{
        slotKey: string
        label: LocalizedText
        isDefault?: boolean
    }>
}
```

No child `widgetKey`, child config, child active state, or child sort order may be embedded in those arrays.

### Graph validation

Build one template-neutral graph validator used by template parsing, CRUD, snapshot import/restore, application sync, and effective-layout resolution. It must fail closed on:

-   missing parent;
-   self-parent;
-   cycles;
-   foreign-layout parent;
-   unknown `slotKey`;
-   parent that is not registry-declared as a container;
-   child type incompatible with the slot/container capability;
-   duplicated/invalid `instanceKey`;
-   nested placement under a source overlay that violates source ownership.

### Snapshot, restore, sync and hash

-   Snapshot placement DTO carries `parentWidgetId` and `slotKey`.
-   Snapshot placement DTO carries mandatory `instanceKey` as semantic identity.
-   Snapshot export may serialize snapshot-local physical parent UUIDs.
-   Restore first creates/remaps widget UUIDs, then rewrites parent UUIDs using the same widget ID remap graph used for base/source lineage.
-   Restore preserves valid semantic `instanceKey` values; it generates a new value only for an explicit duplication/collision-resolution operation, never merely because physical UUIDs changed.
-   Semantic hash must represent parent identity as `parent.instanceKey + slotKey`, never physical parent UUID.
-   Layout scope participates through semantic identity, not physical IDs: global scope is identified by the template/scope kind; Entity scope is identified by registered Entity kind plus its stable semantic key/codename resolved in the trusted server layer.
-   Composition participates semantically: independent vs overlay is hashed explicitly; an overlay identifies its base by the base layout's portable semantic content identity/hash, never `baseLayoutId`.
-   Placement provenance participates as a semantic authority state (`local` vs `source-managed`) plus the canonical trusted source/binding semantics. Physical `source_widget_id` / `source_base_widget_id` never participate. Thus structurally identical local and inherited placements are distinguishable without making hashes environment-specific.
-   Source baselines/effective-state comparison include semantic parent identity and slot.
-   Reset-to-source restores source-owned parent/slot composition.
-   Publication -> application materialization preserves parent/slot + bindings.
-   Application source-managed nested composition permits only registry-declared presentation plus explicitly enabled active/root-order deployment overrides for MVP; nested order, reparent/rebind, zone and parent/slot remain metahub/source-owned.

## Duplicate and Clone Semantics

Keep the existing binding duplicate vocabulary `none | share-bindings | clone-record`; do not add a Dashboard-specific or `container` duplicate mode. Add a distinct registry-level placement-copy permission so source-less host/structural placements can be copied without inventing a fake binding operation.

For a single placement with bindings:

-   `none`: Duplicate action is hidden/disabled and server rejects direct attempts.
-   `share-bindings`: create a new UUID v7 placement and preserve semantic source bindings.
-   `clone-record`: clone the selected Entity record with new UUID v7 record identity, rewrite the new placement's binding, then commit both as one transaction.

For `columnsContainer` and `detailsTabs`:

1. Load the whole subtree under one transaction/consistent snapshot.
2. Pre-validate every descendant's duplicate mode.
3. If any node is `none`, reject the whole operation before writing.
4. Clone placement rows with new UUID v7 IDs and new unique `instanceKey` values.
5. Remap parent IDs to the new subtree and preserve semantic `slotKey`.
6. Apply `share-bindings` or `clone-record` per source-managed descendant.
7. Check optimistic layout version immediately before commit.
8. Roll back all placement and record changes on conflict or any child failure.

Generalize the current Marketing atomic record-copy implementation instead of creating
`dashboardWidgetRecordDuplicateController` / Dashboard-only persistence.

## UI Contract

This is a blocking implementation contract for the Metahub Layout editor, Application Layout editor, nested composition authoring, and published Dashboard runtime.

### Per-surface UI Contract matrix

| Surface                                                        | User role / semantic controls                                                                                                     | Display value                                                                                                              | Hidden / system-owned                                                                             | Defaults                                                                                        | Validation / error behavior                                                                                                                                          | Responsive / browser proof                                                                                                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout widget picker / Add                                     | Metahub editor chooses a localized widget by semantic category and compatible zone/parent                                         | localized widget name + short semantic description/category                                                                | widget key, UUID v7 placement id, instanceKey, registry internals                                 | current zone/selected container when valid; otherwise registry default zone                     | incompatible zone, singleton already present, invalid parent/slot and permission denial are localized before Save                                                    | picker/dialog usable at all 3 viewports; no raw key/ID leakage                                                                                                                                         |
| Source picker                                                  | Metahub editor selects compatible Entity/bounded/specialized source through searchable `Autocomplete`/canonical picker            | localized source/Entity/record title and human secondary label                                                             | Entity/record UUID, schema/table, Component codename, binding envelope                            | seeded source for seeded placements; otherwise empty optional or explicit required state        | required/optional distinction, stale/deleted source, permissions and incompatible capability are localized; optional empty source is quiet                           | popup/combobox does not overflow viewport; keyboard selection and Escape behavior verified                                                                                                             |
| Edit Content dialog                                            | Metahub editor changes Entity/domain content through ordinary record editor or canonical specialized facade                       | semantic field values; references rendered as human labels/previews                                                        | IDs, source metadata, storage locators                                                            | current canonical record data                                                                   | semantic long text multiline; localized validation; first invalid field focus; no raw Zod/database error                                                             | `StandardDialog` or canonical specialized dialog built on it; mobile full-screen only through shared primitive behavior                                                                                |
| Presentation Settings dialog                                   | Metahub/Application editor changes only registry-declared presentation fields                                                     | localized field labels and current presentation values                                                                     | bindings, source IDs, parent UUID, instanceKey, server-only fields                                | effective source/default presentation merged with local override                                | unsupported field and stale-version conflict fail closed with localized message                                                                                      | `StandardDialog`; footer padding/focus/keyboard contract preserved                                                                                                                                     |
| Layout placement list/table                                    | Metahub/Application editor reviews placements and actions                                                                         | localized widget/source/zone/parent semantic labels, active/status badges                                                  | physical ids, binding JSON, raw config                                                            | effective order/zone                                                                            | stale/deleted source and invalid graph show semantic status/action                                                                                                   | canonical table/list primitive; preserve normal density/header styling and comparable structural affordances such as numbered `#` rows where canonical surface uses them; bounded internal scroll only |
| Nested container editor                                        | Metahub editor adds/moves/reorders children and edits column/tab presentation                                                     | localized tab label / “Column N”, child widget human label                                                                 | parent_widget_id, child UUID, raw slot key storage value                                          | current semantic slot; new slot receives deterministic semantic key generated by server/service | prevent cycle, unknown slot, incompatible child, foreign parent before Save where possible; server repeats validation                                                | dense builder controls stack/reflow on tablet/mobile; no page overflow; keyboard move/reorder path tested                                                                                              |
| Duplicate / subtree duplicate                                  | Metahub editor duplicates allowed placement/subtree                                                                               | human widget/container name + source-sharing/clone consequence                                                             | internal duplicate mode and remap graph                                                           | registry duplicate policy                                                                       | `none` is unavailable and server-rejected; atomic failure/conflict shown as localized single operation                                                               | canonical action/dialog pattern; focus returns to invoking row/card                                                                                                                                    |
| Delete / remove source/placement confirmation                  | Authorized editor confirms destructive action                                                                                     | semantic widget/source name and consequence                                                                                | IDs, SQL/storage metadata                                                                         | no destructive action preselected                                                               | permission/conflict/source-reference errors localized; operation fails closed                                                                                        | canonical confirmation/delete dialog only; no resize/fullscreen controls; standard action-footer spacing                                                                                               |
| Optimistic conflict / reload state                             | Concurrent editor resolves stale layout                                                                                           | semantic explanation of changed layout/source                                                                              | revision/version internals                                                                        | keep unsaved form state when safe                                                               | localized Reload/Retry/Cancel; never silently overwrite                                                                                                              | usable by keyboard/mobile and returns focus correctly                                                                                                                                                  |
| `menuWidget` generated/manual editor                           | Metahub editor chooses generated host navigation or manual Entity-backed navigation, then edits only controls valid for that mode | generated mode explains the host-derived source; manual mode shows the selected semantic source and normal content actions | generated route/workspace internals; manual binding envelope, UUIDs/codenames; embedded item JSON | generated for shell/default navigation; manual only after explicit source selection             | generated mode has no source/content CRUD; manual mode uses canonical picker + Edit content; switching modes validates/discards incompatible source state explicitly | reuse the existing menu/source/dialog controls; keyboard source selection and mobile popup bounds verified                                                                                             |
| Application placement actions                                  | Application editor manages inherited or local placements according to registry authority                                          | semantic placement/source name, inherited/local status, allowed Duplicate/Remove/Reset actions                             | UUIDs, source lineage IDs, registry internals                                                     | inherited source-managed actions are conservative; Reset only when a source baseline exists     | forbidden duplicate/remove/reparent/rebind is hidden and server-rejected; local placements use normal allowed actions; destructive confirmation explains consequence | canonical menu/dialog/confirmation patterns; focus returns to initiator after close/action                                                                                                             |
| `infoCard` runtime card                                        | End user reads editorial notice                                                                                                   | title/body/action from strict DTO, localized as authored                                                                   | Entity/binding identifiers                                                                        | valid empty only when variant permits it                                                        | missing required/stale/permission/network states use shared semantic state UI                                                                                        | card reflows, long content wraps, no horizontal page overflow                                                                                                                                          |
| `overviewCards` metric cards                                   | End user reads bounded metrics                                                                                                    | allowlisted label/value/trend/sparkline                                                                                    | source query details, field ids                                                                   | empty metric set is valid empty state                                                           | required source missing/stale/permission/network differentiated                                                                                                      | responsive Grid/Stack cards; screenshot proof at 3 viewports                                                                                                                                           |
| `sessionsChart` / `pageViewsChart`                             | End user reads bounded series                                                                                                     | localized title/series labels and chart data from DTO                                                                      | raw records/source mapping/storage ids                                                            | empty series is valid empty state                                                               | malformed/unsupported data is semantic error state, not renderer exception                                                                                           | chart container bounded; labels/legend reflow; no page overflow                                                                                                                                        |
| `detailsTable`                                                 | End user works with workspace/entity records                                                                                      | canonical formatted columns, human reference labels, badges/previews                                                       | raw JSON/object values, field ids/codenames unless explicitly admin/debug                         | server-provided column/display metadata                                                         | valid empty rows, permission, stale source, network, mutation errors differentiated                                                                                  | canonical DataGrid/table primitive; internal horizontal scroll allowed; page overflow forbidden                                                                                                        |
| `relationBuilder`                                              | End user edits related records/panels                                                                                             | human parent and relation labels; canonical row representations                                                            | relation/source UUIDs, panel source envelopes                                                     | parent from route/runtime context when available                                                | missing parent, incompatible relation, permission and validation localized                                                                                           | panels use responsive Grid/Stack; collapse/stack on narrow viewports instead of widening page                                                                                                          |
| `resourcePreview`                                              | End user previews optional/required resource by variant                                                                           | allowlisted title/description/preview badge/media                                                                          | source URI credentials, storage locator, binding ids                                              | optional source may be empty                                                                    | **optional empty source is quiet valid state with no error helper**; required missing/stale/permission states explicit                                               | preview scales within container; no raw URI/JSON overflow                                                                                                                                              |
| Specialized Quiz / PlayCanvas / Interpretation Network runtime | End user uses typed specialized runtime                                                                                           | domain-safe DTO/state and localized shell status                                                                           | manifest storage ids, module internals, protocol payloads                                         | source-defined runtime defaults                                                                 | specialized errors map to localized safe states; generic permission/network states remain consistent                                                                 | wrapper obeys Dashboard frame/overflow/focus rules; canvas/runtime-specific skill gates remain authoritative                                                                                           |

### Metahub Layout editor

-   **Widget picker:** show localized human labels and category/owner badges; never raw widget keys as the only label.
-   **Add:** registry decides allowed zone, multiplicity, required source slots, compatible parents/slots, and duplicate policy.
-   **Source selection:** searchable/paginated semantic picker using human-readable Entity/source names. Never require UUIDs, table names, schema names, codenames that require hidden knowledge, or raw JSON.
-   **Content editing:** explicit **Edit content** action opens the ordinary Entity/domain editor or a specialized safe facade. Structured/JSON fields on normal user-facing Dashboard authoring surfaces must use a typed control, semantic preview/specialized facade, or remain hidden. The generic raw JSON textarea fallback is admin/debug-only and must not be reachable through normal Dashboard Edit content flows.
-   **Presentation editing:** separate **Presentation settings** action/dialog exposing only registry-declared fields.
-   **Long text:** every semantic long-text field, including description, summary, details, body, instructions, notes, feedback and comment, is multiline by default through the canonical semantic-long-text detection/field-control contract.
-   **Nested move/add:** parent and slot are selected through localized container/tab/column labels. `parent_widget_id` and `slot_key` are system-owned and hidden.
-   **Duplicate:** only when the registry permits it; subtree duplicate displays one semantic operation and is atomic.
-   **Validation:** localized field/helper messages; raw Zod/database errors never reach the UI.
-   **Conflicts:** optimistic-version conflict keeps the editor open and offers a localized reload/retry path; it must not silently overwrite another editor.
-   **Dialog shell:** every ordinary settings/content dialog uses `StandardDialog` or the canonical specialized dialog built on it. Preserve shared footer right/bottom padding, Escape behavior and focus restoration.
-   **Destructive actions:** use the canonical confirmation/delete dialog contract; no resize/fullscreen affordances are allowed on destructive confirmation surfaces.

### Application Layout editor

-   Source-managed widgets inherit source bindings and source-owned nested composition.
-   Application UI may edit only registry-permitted presentation plus explicitly enabled active/root-order deployment overrides and Reset to source. Inherited source-managed zone/parent/slot are source-owned for MVP.
-   Source picker, rebind, source content CRUD, and source-owned reparenting are hidden and rejected server-side.
-   Reset shows localized semantic changes; no binding envelope or physical IDs are exposed.
-   Application-local widgets are allowed only where registry policy explicitly permits local ownership.

### UI reuse map

Implementation starts from the existing primitives and editors below. A new component family is justified only when these contracts cannot express the required semantics after a reasonable generalization:

-   layout list/card surfaces -> existing `LayoutAuthoringList` patterns with `FlowListTable` / `ItemCard`;
-   source binding authoring -> generalize `MarketingWidgetBindingDialogView` + `MarketingWidgetBindingSlots`, retaining existing `DropdownAutocomplete`, loading/pagination/error semantics and `DynamicEntityFormDialog`;
-   ordinary authoring dialogs -> `StandardDialog` and existing specialized `EntityFormDialog`-based editors;
-   destructive delete/remove -> canonical `ConfirmDeleteDialog`; discard/reset/non-destructive confirmation -> shared `useConfirm`;
-   menu/container/specialized authoring -> adapt existing `MenuWidgetEditorDialog`, `ColumnsContainerEditorDialog`, Quiz, PlayCanvas and Interpretation Network editors instead of creating parallel Dashboard editors;
-   Application layout settings -> existing `ApplicationLayoutWidgetEditors`, typed widget editors and `LayoutZoneSettingsDialog`;
-   runtime generic tables/lists -> existing `CustomizedDataGrid` / `ObjectTable` / `FlowListTable` contracts as appropriate to the owning package;
-   runtime shell -> existing `Dashboard`, `AppNavbar`, `SideMenu`, `SideMenuMobile` and `MainGrid` composition.

The published `@universo-react/apps-template-mui` isolation rule still applies: reuse its own local runtime primitives there rather than importing authoring primitives from `@universo-react/template-mui`.

### Structural container authoring

-   Columns show localized semantic labels such as “Column 1”; tabs show their localized configured labels.
-   Drag/move/reorder uses user-facing locators and keyboard-accessible controls, not UUIDs.
-   Invalid cycles/parent/slot combinations are prevented before Save where possible and always rejected server-side.
-   Tab labels are structural presentation; tab order and column widths stay in parent config.
-   Child widget rows remain ordinary placements, so normal Edit/Duplicate/Delete actions and source lifecycle work consistently.

### Runtime data surfaces

Runtime must display explicit, localized states:

-   loading;
-   valid empty;
-   optional source unbound;
-   required source missing;
-   stale/deleted source;
-   permission denied;
-   malformed/unsupported config;
-   network/server error.

Optional-unbound is a quiet valid state, not an error.

Tables/cards/charts:

-   no raw JSON, `[object Object]`, UUID-only business labels, table names, binding envelopes, or internal field names;
-   DataGrid may scroll inside its own bounded container, but the page must not horizontally overflow;
-   server bounds result size independently of client `maxRows`/`maxItems`;
-   row actions are allowlisted by the server/runtime DTO and re-authorized on mutation.
-   canonical table/list primitives keep their normal density/header styling and comparable structural affordances; do not create a Dashboard-only table shell for generic Entity rows.

### MUI geometry, accessibility and browser proof

Preserve the checked-in MUI Dashboard reference geometry:

-   wide sidebar/drawer approximately the reference 240 px geometry;
-   correct desktop/mobile Drawer/AppBar visibility;
-   correct main-content offset/background owner;
-   reference Stack spacing/top offset;
-   mobile fixed AppBar behavior;
-   `--template-frame-height` behavior where used;
-   no page-level horizontal overflow.

Required browser viewport proof:

-   1920×1080;
-   768×1024;
-   390×844.

Use real EN/RU locale resources in browser tests. Verify keyboard access, focus restoration for dialogs, accessible labels, responsive tables, and screenshot output by inspecting the rendered screenshots rather than merely saving them.

## Affected Areas

### Shared contracts — `@universo-react/types`

-   `src/common/layoutWidgetDefinitions.ts`
-   `src/common/widgetBindings.ts`
-   `src/common/layoutEnvelope.ts`
-   `src/common/applicationLayouts.ts`
-   `src/common/metahubs.ts`
-   Dashboard registry completeness/translation tests

### Shared utilities/i18n

-   `@universo-react/utils`: only genuinely cross-package source/graph/hash helpers.
-   `@universo-react/i18n`: common widget labels, source states, presentation labels, nested actions/errors, validation messages.

### Metahub backend

-   layout/widget stores and migrations/DDL definitions;
-   `widgetBindingService.ts` and binding policy/integrity logic;
-   layout defaults/creation;
-   snapshot transport/restore/publication;
-   source deletion integrity;
-   atomic duplicate-record/subtree service;
-   all built-in Dashboard templates:
    `basic`, `basic-demo`, `empty`, `one-c-compatible`, `lms`,
    `interpretation-network`, `playcanvas`.

### Metahub frontend

-   replace Marketing-specific source-managed delegation with one registry-driven authoring controller;
-   generic source pickers/content actions;
-   container parent/slot authoring;
-   nested subtree duplicate/move/reorder UI;
-   real EN/RU resources and component tests.

### Applications backend

-   application widget persistence;
-   source baseline state;
-   materialization/sync;
-   source-removal/reset/copy semantics;
-   effective-layout graph resolution;
-   semantic hash;
-   published widget projection;
-   strict runtime DTO resolver.

### Applications frontend

-   `ApplicationLayouts.tsx` and related hooks/dialogs;
-   registry-driven source-managed behavior with explicit Application deployment overrides;
-   nested composition presentation/reset states;
-   TanStack Query cache synchronization.

### Isolated runtime — `@universo-react/apps-template-mui`

-   Dashboard shell and `widgetRenderer.tsx`;
-   MainGrid/container rendering;
-   strict DTO consumer adapters;
-   remove demo components/data and mount-time composition fallbacks;
-   preserve template isolation.

### Tooling, fixtures, E2E and docs

-   six snapshot generator specs and fixture contracts;
-   cross-template/app-layout E2E;
-   new Dashboard Entity-backed fresh-DB wrapper;
-   MUI geometry screenshot oracle;
-   GitBook docs and screenshot provenance;
-   package READMEs.

## Design Notes

### 1. Registry-driven source ownership

Introduce one neutral policy resolver plus one lineage-state resolver in a shared server-safe contract layer. They must not branch on a template key. Registry policy determines source authority even before any lineage row exists; physical lineage only states whether this particular placement is currently linked to a source:

```ts
type PlacementSourcePolicy =
    | {
          authority: 'local'
          sourceMode: 'none' | 'optional'
          inheritBindings: false
          inheritComposition: false
      }
    | {
          authority: 'metahub-source'
          sourceMode: 'none' | 'optional' | 'required' | 'specialized'
          inheritBindings: boolean
          inheritComposition: boolean
      }

type PlacementLineageState = { kind: 'unlinked' } | { kind: 'source-linked' }

export function getPlacementSourcePolicy(definition: LayoutWidgetDefinition): PlacementSourcePolicy {
    return definition.sourcePolicy
}

export function getPlacementLineageState(placement: { sourceBaseWidgetId: string | null }): PlacementLineageState {
    return placement.sourceBaseWidgetId ? { kind: 'source-linked' } : { kind: 'unlinked' }
}
```

`getPlacementSourcePolicy()` is authoritative for source discovery/provisioning, binding/source authorization and which lifecycle is allowed even while lineage is still `unlinked`. `getPlacementLineageState()` is only evidence of the current concrete source relationship used for effective overlay/materialization/sync/reset comparison. The pair is the single source of truth for the complete lifecycle: source discovery/provisioning, binding validation, base/overlay authority, source baselines, effective layout, Application overlays, materialization/sync, Reset, published projection, source removal, copy/fork, snapshot restore, and binding integrity/policy stores. Both authoring frontends consume the same registry policy. No ownership decision in those seams may remain conditional on `templateKey === 'marketing-page'`; template-key checks that only select template-specific zones, labels, renderers, or routing are outside this rule.

### 2. Registry additions

Extend serializable definitions only as far as the Dashboard contract requires. Freeze the shared shape before backend/frontend work so every layer interprets the same contract. A representative shape is:

```ts
type LayoutWidgetSourceClass = 'host' | 'entity' | 'bounded-data' | 'specialized-runtime' | 'structural'

type ApplicationPlacementOverridePolicy = {
    active: boolean
    order: 'none' | 'root-only' | 'any'
    zone: boolean
    parentSlot: boolean
}

type LayoutWidgetCompositionDefinition = {
    sourceOwned: boolean
    container?: {
        slots: readonly LayoutContainerSlotDefinition[]
        allowedChildCapabilities?: readonly string[]
    }
}

type LayoutWidgetCopyPolicy = {
    placement: 'none' | 'copy'
    binding?: 'none' | 'share-bindings' | 'clone-record'
}

type LayoutWidgetDefinition = {
    // existing registry fields remain
    sourceClass: LayoutWidgetSourceClass
    sourcePolicy: PlacementSourcePolicy
    identity: { instanceKey: 'required' }
    bindingSlots?: readonly WidgetBindingSlotDefinition[]
    bindingSlotFamilies?: readonly WidgetBindingSlotFamilyDefinition[]
    presentationFields?: readonly LayoutWidgetPresentationField[]
    composition?: LayoutWidgetCompositionDefinition
    copyPolicy: LayoutWidgetCopyPolicy
    applicationPlacementOverrides: ApplicationPlacementOverridePolicy
}
```

The exact property names may follow repository conventions, but these semantics are normative: source class, explicit source policy/authority independent of current lineage, mandatory stable `instanceKey`, fixed/repeatable binding slots, presentation fields, authoring permissions, placement-copy policy, binding-copy policy, container/child capability, source-owned composition, Application override authority, host capability requirements, and seed policy where useful. A structural container may therefore have `sourceMode: 'none'` while still using `authority: 'metahub-source'` and `inheritComposition: true`; an optional `resourcePreview` can declare `sourceMode: 'optional'` without being misclassified as local.

Repeatable relation panels use one serializable slot-family contract rather than frontend/backend string parsing conventions:

```ts
type WidgetBindingSlotFamilyDefinition = {
    familyKey: 'panel'
    slotPrefix: 'panel:'
    memberKeyPattern: string // bounded semantic-key format, not arbitrary regex from users
    selectorKinds: readonly ['relation-set']
    cardinality: { min: number; max: number }
    maxMembers: number
    requirements: WidgetBindingSlotRequirements
    relation: { field: string; parentSlot: string }
}
```

Validation resolves a concrete slot against an exact fixed slot first and then exactly one family. Unknown, ambiguous, duplicate, over-limit, malformed-suffix, incompatible-capability, or invalid-selector family members fail closed. Serialization keeps concrete semantic slots such as `panel:materials`; canonicalization/hash sorting uses the concrete semantic slot identity, never array position or a physical record ID. Fixed slots and family expansions must not collide.

Do not encode renderer functions, SQL, arbitrary query expressions, or package imports in the registry.

### 2a. Universal `instanceKey` invariant

`instanceKey` moves from a historically Marketing-oriented optional convention to a placement invariant for every retained Dashboard widget:

-   create, template seed, copy, import and restore all return a non-empty key;
-   the key is placement metadata, not renderer-owned content;
-   ordinary content CRUD, record reorder/hide, presentation edits, publication and sync preserve it;
-   source overlays preserve the semantic key of the placement they override;
-   explicit Duplicate/subtree Duplicate generates a fresh unique key for every copied placement;
-   snapshot restore with new physical UUIDs preserves semantic keys;
-   strict schemas reject missing/duplicate keys at persisted/effective boundaries;
-   semantic comparison and nested parent identity use the key while physical placement/source-lineage UUIDs remain persistence-only.

Do not retain a Dashboard path where `instanceKey` is optional merely because older Marketing code generated it conditionally.

### 2b. Portable layout hash identity

The portable semantic hash is intentionally broader than placement identity. Its canonical semantic envelope must include:

```text
layout:
  templateKey
  semanticScope = global | (entityKind + entitySemanticKey/codename)
  compositionMode = independent | overlay
  baseSemanticIdentity = null | portable semantic content hash of the referenced base layout
  effective zone/presentation settings

placement:
  widgetKey + instanceKey
  semanticParent = null | (parent.instanceKey + slotKey)
  semanticSourceAuthority = local | source-managed
  canonical trusted bindings/source selector
  effective registry-allowed presentation + active/order/zone
```

Physical layout/widget/parent/Entity/base-layout/source-lineage UUIDs, optimistic versions, timestamps and persistence bookkeeping are excluded. The server resolves semantic scope/base/source identity before hashing. This makes a snapshot restore portable across remapped UUIDs while still distinguishing a local placement from an inherited source-managed placement, an independent layout from an overlay, different semantic scoped targets, and different base-layout semantics.

### 3. Bounded semantic data-source resolvers

For generic metrics/charts/tables, the browser sends/receives semantic source keys and presentation preferences only.
The server maps them to authorized, bounded queries and returns strict DTOs.

```ts
const metricCardRuntimeSchema = z
    .object({
        label: z.string().min(1).max(120),
        value: z.string().max(80),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        sparkline: z.array(z.number().finite()).max(120).optional()
    })
    .strict()

const metricSetRuntimeSchema = z
    .object({
        cards: z.array(metricCardRuntimeSchema).max(8)
    })
    .strict()
```

The runtime DTO contains no Entity UUID, schema/table name, Component codename, SQL/filter expression, or arbitrary record object.

### 4. Database safety

Domain stores continue through `DbExecutor.query()`, schema-qualified identifiers and bind parameters.
Mutation confirmation must fail closed:

```ts
const result = await executor.query<{ id: string }>(
    `
      UPDATE ${qSchemaTable(schema, '_app_widgets')}
      SET parent_widget_id = $1,
          slot_key = $2,
          updated_at = NOW()
      WHERE id = $3
        AND layout_id = $4
      RETURNING id
    `,
    [parentWidgetId, slotKey, widgetId, layoutId]
)

if (result.rows.length !== 1) {
    throw new LayoutMutationTargetNotFoundError()
}
```

Dynamic identifiers are produced only through the repository quoting helpers.
User/source values always remain bind parameters.
Optimistic concurrency must use the repository's existing layout-version / expected-version seam around the transaction; implementation must not invent a widget-level revision column solely for this refactor.

Parent/slot graph rules that cannot be expressed safely as local SQL constraints (cycle detection, registry-declared container capability, semantic slot compatibility, effective source ownership) are checked inside the same mutation transaction before commit. Container deletion must either cascade the validated subtree inside that transaction or reject the operation before any write; it must never orphan descendants.

### 5. TanStack Query authoring behavior

Use TanStack Query for server state and explicit local form state for dirty edits.
For reorder/move operations where optimistic UX is useful, snapshot and roll back:

```tsx
const mutation = useMutation({
    mutationFn: moveWidget,
    onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: layoutKey(input.layoutId) })
        const previous = queryClient.getQueryData(layoutKey(input.layoutId))
        queryClient.setQueryData(layoutKey(input.layoutId), (current) => applyOptimisticMove(current, input))
        return { previous }
    },
    onError: (_error, input, context) => {
        queryClient.setQueryData(layoutKey(input.layoutId), context?.previous)
    },
    onSettled: (_data, _error, input) => queryClient.invalidateQueries({ queryKey: layoutKey(input.layoutId) })
})
```

Do not duplicate canonical layout state into long-lived component state.

### 6. Package boundaries

-   Shared serializable contracts: `@universo-react/types`.
-   Generic pure helpers: `@universo-react/utils` only when they have multiple consumers.
-   Common UI strings: `@universo-react/i18n`.
-   Metahub source authoring/seeding: metahub packages.
-   Publication/application lifecycle/runtime resolution: application packages.
-   Published UI rendering: isolated `@universo-react/apps-template-mui`.
-   No runtime import from metahub/application authoring packages.

## Plan Steps

-### Phase 0 — Freeze contracts, blast radius and negative acceptance

-   [x] Re-check `git status`; preserve all unrelated dirty files.
-   [x] Verify OntoIndex commit freshness. If stale, coordinate one index refresh before graph-backed impact claims.
-   [x] Run OntoIndex semantic/context/impact checks on the registry, snapshot transport, source-state classifier, effective resolver, application sync/hash, and runtime renderer symbols before implementation edits. Index coverage is degraded on two oversized files; those seams also require direct source review.
-   [x] Freeze the matrix in this plan as the normative product decision.
-   [x] Produce the exhaustive Dashboard Field Ownership Inventory defined above from all current Dashboard schemas/config paths. See `memory-bank/research/dashboard-complete-entity-backed-widgets-field-ownership-2026-10-02.md`.
-   [x] Inventory every built-in manifest with `templateKey: 'dashboard'` and every seed/default helper that derives from Dashboard widget/default definitions, including consumers of `DEFAULT_DASHBOARD_ZONE_WIDGETS`, `buildBasicMinimalSeedZoneWidgets()` or their successors. Seven manifests and shared seed/lifecycle paths are recorded in the inventory.
-   [x] Inventory every current optional/Marketing-specific `instanceKey` generation/validation seam and define its replacement by the universal placement invariant. The inventory records insertion, mapping, mutation, sync, and public-runtime boundaries.
-   [x] Add an implementation checklist of retired shapes that must produce validation failures:
        `show*`, embedded `columns[].widgets`, embedded `tabs[].widgets`,
        embedded stat values/series, manual menu arrays, and duplicated datasource locators.
-   [x] Confirm current built-in template versions and schema version values and record that they remain unchanged: metahub schema `1` / `0.1.0`; all Dashboard template versions remain `0.1.0`.

### Phase 1 — Make the shared Dashboard registry complete

-   [ ] Refactor `DASHBOARD_LAYOUT_WIDGETS` into/through the canonical `LayoutWidgetDefinition` registry instead of a mechanically separate Dashboard list.
-   [ ] Encode the ownership matrix, mandatory `instanceKey`, source class, fixed/repeatable binding slots, presentation fields, authoring permissions, placement-copy/binding-copy policies, Application override authority, multiplicity, host requirements and container capabilities using the serializable shapes above.
-   [ ] Remove `brandSelector`, `productTree`, and `usersByCountryChart` from the supported registry.
-   [ ] Replace permissive `z.record(z.unknown())` Dashboard acceptance with strict per-widget schemas.
-   [ ] Make old content-bearing/nested shapes explicitly invalid.
-   [ ] Add registry completeness tests that iterate every retained Dashboard key and every retired key, and a field-inventory completeness test that leaves no persisted Dashboard config/source path unclassified.
-   [ ] Add a Dashboard EN/RU registry translation test using real locale resources with no fallback masking.

### Phase 2 — Add first-class nested placement persistence

-   [ ] Extend fresh-schema metahub/application widget DDL with mandatory `instance_key`, `parent_widget_id` and `slot_key` without a version bump.
-   [ ] Extend row types, selects/inserts/updates and API/snapshot DTOs.
-   [ ] Add the root/nested null-pair CHECK, `(layout_id, instance_key)` uniqueness, parent existence and self-parent constraints, plus useful indexes. Preserve valid overlay references to base-layout parents and test the effective graph and restored FK references.
-   [ ] Centralize graph validation and container-slot capability checks.
-   [ ] Remove nested child widget types from `applicationLayouts.ts` / `metahubs.ts`.
-   [ ] Add unit/integration tests for roots, valid nesting, missing parent, foreign parent, self-parent, cycles, invalid slot, invalid container and incompatible child.

### Phase 3 — Generalize source binding and ownership infrastructure

-   [ ] Replace Marketing-named/shared concepts with neutral names where their semantics are generic.
-   [ ] Introduce the single registry/lineage source-ownership classifier and use it for discovery/provisioning, validation, base/overlay authority, source baselines, effective state, Application overlays, sync/materialization, Reset, publication projection, source removal, copy/fork/restore, and integrity/policy decisions.
-   [ ] Update `widgetBindingService`, binding policy/integrity stores, and source deletion checks to use registry capabilities.
-   [ ] Support required/optional Entity slots and the serialized repeatable relation-panel slot-family contract, including canonical slot identity, max-family-member bounds, collision rules and shared validation/canonicalization.
-   [ ] Keep specialized runtime source contracts separate from Entity bindings.
-   [ ] Remove template-key checks used only to identify inherited source-managed bindings.
-   [ ] Cover Entity/source deletion, semantic-key mutation, source replacement, source copy/fork, scoped inheritance, publication and Application propagation through the same lifecycle. Required bindings either remap deterministically through an explicit operation or fail closed; no silent detach/rebind is allowed.
-   [ ] Add direct service/store tests for every binding ownership rule and every lifecycle transition above.

### Phase 4 — Metahub layout lifecycle and atomic duplication

-   [ ] Generalize the Marketing clone-record flow into a registry-driven duplicate service.
-   [ ] Implement placement-copy permission separately from `share-bindings`, transactional `clone-record`, and `none` binding policies; source-less host/structural copies must not fabricate binding semantics.
-   [ ] Implement atomic subtree duplicate with parent-ID remap and per-descendant duplicate policy.
-   [ ] Make delete/move/reparent operations transactionally graph-safe.
-   [ ] Use optimistic layout revision/version checks and `RETURNING`; fail closed on zero rows.
-   [ ] Ensure record clones and placements use UUID v7.
-   [ ] Ensure every placement create/seed/duplicate path writes a mandatory unique `instanceKey`; duplication always generates a fresh key while ordinary content/presentation mutations preserve the existing key.
-   [ ] Add regression tests proving Entity/workspace content CRUD, row reorder and visibility changes do not recreate or renumber unrelated placement IDs or change unaffected `instanceKey` values.
-   [ ] Add rollback/concurrency tests proving partial subtrees/record clones cannot persist.

### Phase 5 — Snapshot, publication and restore

-   [ ] Split the existing Marketing-specific deep validator into:
    1. template-neutral Entity-backed layout transport validation;
    2. Marketing-only content/action validation.
-   [ ] Serialize mandatory semantic `instanceKey` plus parent/slot data for all placement rows.
-   [ ] Preserve the base/source binding-authority rule: base placement owns bindings; sparse source overlays cannot become another binding authority.
-   [ ] During restore, remap parent UUIDs only after the widget-ID map exists.
-   [ ] Validate graph integrity before commit.
-   [ ] Add snapshot round-trip tests proving physical UUIDs may change while semantic `instanceKey`/parent-slot graph identity and semantic hash remain equivalent.

### Phase 6 — Application materialization, sync, reset and semantic hash

-   [ ] Update application materialization/store row shapes for parent/slot.
-   [ ] Replace Marketing-only binding inheritance in:
        `applicationLayoutWidgetSourceState.ts`,
        `effectiveLayoutResolver.ts`,
        `syncLayoutPersistence.ts`,
        `applicationLayoutStoreSupport.ts`,
        `applicationLayoutPublishedWidgetProjection.ts`,
        and policy stores.
-   [ ] Include semantic nested composition in source baselines/comparable state.
-   [ ] Define canonical hash input using `widgetKey`, `instanceKey`, semantic parent identity (`parent.instanceKey + slotKey`), canonical semantic bindings/sources, effective registry-permitted presentation, and effective active/order/zone values according to their authority.
-   [ ] Normalize layout-level physical references before hashing as well: scoped target identity uses a stable semantic Entity locator (registered kind + codename/semantic key), and overlay composition uses the referenced base layout's portable semantic content identity/hash rather than physical `scopeEntityId` or `baseLayoutId`.
-   [ ] Explicitly exclude physical layout/entity/widget/base-layout UUIDs, placement/parent UUIDs, Entity/source physical IDs when a semantic selector exists, `source_widget_id` / `source_base_widget_id`, optimistic version/revision fields, timestamps and other persistence bookkeeping from the portable semantic hash.
-   [ ] Replace existing hash tests that intentionally distinguish physical `baseLayoutId` values with the portable contract. Required oracle: source `H1` -> snapshot/export -> restore with remapped layout/entity/widget UUIDs -> restored `H2` -> publication/Application materialization -> `H3`, with `H1 === H2 === H3`; changing semantic scope, `instanceKey`, parent semantic key, `slotKey`, binding/source selector, effective presentation, active/order/zone or base semantic content must change the appropriate hash.
-   [ ] Apply the exact inherited-placement authority contract: source owns zone/parent/slot/bindings/instanceKey; Application can change only registry-permitted presentation plus explicitly enabled active/root-order deployment overrides.
-   [ ] Make Reset restore source bindings, source-owned nested composition, and every source-owned placement field while clearing allowed local overrides.
-   [ ] Make source replacement/copy/fork/removal and semantic-key mutation fail closed or converge through one documented classifier-driven lifecycle.
-   [ ] Add sync/materialization/reset/hash/concurrency tests.
-   [ ] Add portability tests proving: different physical UUIDs produce the same semantic hash; nested snapshot round-trip preserves graph/hash; source sync/Reset preserves intended semantic identity; publication -> Application projection preserves nested semantics.

### Phase 7 — Metahub authoring UI

-   [ ] Replace `useMarketingLayoutWidgetAuthoring` delegation with one registry-driven `useLayoutWidgetAuthoring` source-managed controller.
-   [ ] Generalize/reuse the existing `MarketingWidgetBindingDialogView` source flow rather than creating a Dashboard binding dialog family. Reuse `StandardDialog`, `DynamicEntityFormDialog`/`EntityFormDialog`, existing Entity/reference pickers, canonical table/list primitives, `LayoutZoneSettingsDialog`, and `useConfirm`/canonical destructive confirmation where their contracts fit.
-   [ ] Generalize the existing `ColumnsContainerEditorDialog`/widget editor patterns for first-class structural children and `detailsTabs` before introducing any new structural authoring primitive.
-   [ ] Implement manual/generated menu variants without raw IDs/codenames.
-   [ ] Implement source pickers for Entity/bounded semantic sources.
-   [ ] Add Edit content vs Presentation settings as explicit separate actions.
-   [ ] Implement nested parent/slot UI, move/reorder, and atomic subtree duplicate actions.
-   [ ] Prevent invalid nesting before Save and display localized server validation if a race still invalidates it.
-   [ ] Add Vitest + Testing Library coverage using real EN/RU resources at least once.

### Phase 8 — Application authoring UI

-   [ ] Derive source-managed behavior and the exact allowed Application deployment overrides solely from registry policy + lineage state.
-   [ ] Remove `isSourceManagedMarketingWidget`-style template checks.
-   [ ] Hide/reject rebind, source CRUD, and source-owned reparenting.
-   [ ] Reuse the existing `ApplicationLayoutWidgetEditors`, `StandardDialog`, `LayoutZoneSettingsDialog`, typed widget editors and `useConfirm` patterns; do not create Dashboard-only editor families for generic source/presentation operations.
-   [ ] Keep registry-declared presentation and only the explicitly permitted active/root-order deployment overrides plus Reset-to-source; inherited source-managed zone/parent/slot changes are hidden and server-rejected.
-   [ ] Use TanStack Query invalidation/optimistic rollback patterns consistently.
-   [ ] Add Vitest component tests for inherited/local/source-removed/conflict states in EN/RU.

### Phase 9 — Generic authorized runtime source resolver

-   [ ] Introduce/extend server resolver contracts for:
        semantic record, record set, relation set, metric set, series, resource preview and specialized runtime sources.
-   [ ] Enforce permission checks before data fetch and again on mutations.
-   [ ] Cap rows/points/cards server-side.
-   [ ] Project only allowlisted DTO fields.
-   [ ] Remove physical datasource descriptors and arbitrary field/table identifiers from published Dashboard DTOs.
-   [ ] Add negative tests for unauthorized source, stale/deleted source, malformed config and over-limit requests.

### Phase 10 — Cut over `@universo-react/apps-template-mui`

-   [ ] Remove renderer consumption of legacy Dashboard content blobs and datasource descriptors.
-   [ ] Remove mount-time fallback injection and boolean `show*` composition.
-   [ ] Render only the effective placement graph supplied by the runtime boundary.
-   [ ] Replace recursive synthetic `columnsContainer`/`detailsTabs` children with graph children grouped by parent + slot.
-   [ ] Replace hard-coded `CardAlert` content with the info-card DTO renderer.
-   [ ] Delete retired `SelectContent`/product-tree/country-demo widget paths where no other supported feature uses them.
-   [ ] Keep specialized PlayCanvas/quiz/Interpretation Network renderers specialized.
-   [ ] Preserve MUI reference geometry and package isolation.
-   [ ] Add Vitest renderer tests for every ownership class and every runtime state.

### Phase 11 — Rebuild built-in Dashboard templates and seeds

-   [ ] Use the exhaustive Phase 0 manifest/helper inventory as the checklist; fail the completeness test if any `templateKey: 'dashboard'` built-in or Dashboard seed/default helper is not covered by the final registry/seed path.
-   [ ] Centralize Dashboard placement construction so layout defaults and built-in templates cannot drift.
-   [ ] **Basic:** structurally complete shell; no fake/demo metrics; only visible source-managed content that has real seeded records.
-   [ ] **Basic Demo:** real demo Entities and bounded sources for info/headings/metrics/charts/table; demonstrate first-class nested placements.
-   [ ] **Empty:** valid final-format Dashboard layout with only the deliberately required system shell contract, no compatibility fallback.
-   [ ] **1C-Compatible:** convert all Dashboard placements/sources to the same final contract.
-   [ ] **LMS:** replace embedded nested configs and ad-hoc source locators while preserving specialized learner/runtime behavior.
-   [ ] **Interpretation Network:** keep specialized runtime source and adopt common placement/source semantics.
-   [ ] **PlayCanvas:** keep manifest/runtime specialization and adopt common placement/source semantics.
-   [ ] Add fresh-template tests proving no post-create repair/compatibility step is needed.

### Phase 12 — Localization and user-facing states

-   [ ] Add common Dashboard widget/source/presentation/nesting labels to `@universo-react/i18n`.
-   [ ] Keep feature-specific specialized labels in their owning feature bundles.
-   [ ] Add real EN/RU keys for source states, duplicate/move/reorder, conflicts, validation and runtime errors.
-   [ ] Ensure no test-only fallback hides missing Russian resources.
-   [ ] Add unit and browser assertions for all required runtime/authoring states.

### Phase 13 — Regenerate persistent fixtures through canonical producers

Regenerate exactly these six files from their Playwright generators:

1. `tools/fixtures/metahubs-73rd-meridian-app-snapshot.json`
2. `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
3. `tools/fixtures/metahubs-lms-app-snapshot.json`
4. `tools/fixtures/metahubs-mmoomm-app-snapshot.json`
5. `tools/fixtures/metahubs-quiz-app-snapshot.json`
6. `tools/fixtures/metahubs-self-hosted-app-snapshot.json`

For each fixture enforce:

```text
producer -> generated artifact -> contract check -> normalized drift check -> runtime/import proof
```

-   [ ] Add dedicated normalized drift gates for LMS, Quiz, and Self-hosted. The current root scripts expose an LMS contract check but no dedicated LMS/Quiz/Self-hosted normalized drift scripts.
-   [ ] Add one top-level canonical-six-fixture orchestration gate (name may follow repository conventions) that executes `producer -> contract -> normalized drift -> import/runtime` for each of the six allowlisted persistent snapshot paths and fails if a producer writes another tracked fixture. Temporary generated output stays under the E2E `.artifacts` area.
-   [ ] Add explicit negative fixture assertions: no `show*` authority, embedded nested child arrays, retired stock demo widgets, or content-bearing Dashboard renderer configs.
-   [ ] Add the currently missing 73rd Meridian producer entry to the E2E README/RU generator tables.
-   [ ] Explicitly run `snapshot-import-mmoomm-app-parity.spec.ts`.
-   [ ] **Do not regenerate** `tools/fixtures/mmoomm-runtime-pre-extraction-baseline.json`. Capture its SHA-256 before the six producers, require the identical SHA-256 afterwards, run `git diff --exit-code -- tools/fixtures/mmoomm-runtime-pre-extraction-baseline.json`, and execute the existing current-runtime historical parity proof. The baseline is never a generator output.

### Phase 14 — Deep unit/integration/package tests

Use the existing runner by package rather than duplicating identical tests across frameworks:

-   backend contracts/services/stores: Jest;
-   types/frontends/runtime React packages: Vitest;
-   browser flows/visual proof: Playwright.

Transaction/concurrency proof is layered intentionally: Jest covers deterministic service/store decisions; a real PostgreSQL/local-Supabase integration suite proves subtree `clone-record` rollback, source-delete-vs-reference races and optimistic revision conflicts; Playwright covers one representative concurrent-editor conflict UX. Do not try to prove database atomicity only with mocks or multiply the same race through every browser scenario.

Required seams include:

-   `dashboardLayout.test.ts`
-   `widgetBindings.test.ts`
-   `layoutEnvelope.test.ts`
-   `widgetBindingService.*.test.js/ts`
-   `MetahubLayoutsService.test.ts`
-   `snapshotLayouts.integration.test.ts`
-   SnapshotRestore/publication tests
-   `effectiveLayoutResolver.test.ts`
-   `syncLayoutMaterialization*.test.ts`
-   `syncLayoutPersistence*.test.ts`
-   `applicationLayoutHash.test.ts`
-   source-state/published-projection tests
-   `ApplicationLayouts.test.tsx`
-   metahub layout-authoring tests
-   `Dashboard.test.tsx`
-   `MainGrid.test.tsx`
-   `widgetRenderer.test.tsx`
-   Dashboard EN/RU registry completeness tests
-   Dashboard field-ownership inventory completeness tests
-   universal `instanceKey` creation/seed/sync/restore/duplicate tests
-   repeatable binding-slot-family canonicalization/validation tests
-   source lifecycle tests for semantic-key mutation, source replacement, copy/fork, deletion and scoped inheritance
-   ordinary content-CRUD placement-identity stability tests
-   semantic-hash physical-ID invariance and nested portability tests
-   runtime UX helper canary tests that intentionally inject a UUID-bearing label, raw JSON/object value, semantic long text rendered as a single-line input, RU form with raw Zod/internal/English-only validation, and page-level horizontal overflow and assert that the strict helper fails; include a positive canary proving bounded DataGrid internal horizontal scrolling remains allowed

Mandatory negative tests:

-   retired `show*`;
-   embedded nested child-widget arrays;
-   old content-bearing Dashboard config;
-   missing/self/foreign parent;
-   cycle;
-   invalid/unknown slot;
-   incompatible parent/child;
-   invalid source-binding authority;
-   raw physical datasource locator in final schemas;
-   `clone-record`/subtree transactional rollback;
-   source deletion while referenced;
-   optimistic version conflict.
-   missing/duplicate `instanceKey`;
-   root/nested parent-slot null-pair violation;
-   unknown/ambiguous/colliding/over-limit repeatable binding-family slot;
-   forbidden Application source-managed zone/parent/slot/rebind mutation;
-   semantic hash changes caused only by physical UUID/source-lineage/version bookkeeping.

Blocking package gates:

```bash
pnpm check:apps-template-isolation
pnpm check:runtime-no-lms-forks
```

Add a narrowly scoped Dashboard primitive-reuse gate/component contract tests covering the files touched by this refactor. Ordinary authoring dialogs must use `StandardDialog`/canonical confirmation contracts and generic Dashboard lists/tables must use the established shared/runtime primitives. Keep the check scoped so legitimate specialized Quiz/PlayCanvas/Interpretation Network surfaces are not forbidden from their domain-specific controls.

### Phase 15 — Fresh local-Supabase Playwright, visual and accessibility acceptance

Add a dedicated `test:e2e:dashboard-entity-backed:verify:local-supabase` wrapper (or extend the cross-template wrapper only if it remains one obvious explicit gate). The top-level command itself owns the disposable-database lifecycle so a caller cannot accidentally run acceptance against stale state:

```text
nuke -> start:minimal -> env -> doctor -> build:e2e -> Playwright/evidence -> preserve artifacts -> stop in finally
```

The gate must be reproducible by invoking this single command; it must not depend on a preceding manual `nuke`.

Start from a disposable database:

```bash
pnpm supabase:e2e:nuke
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm run build:e2e
```

The wrapper must use `tools/testing/e2e/run-playwright-suite.mjs`; do not run `pnpm dev`.

Locator/wait policy is semantic and user-facing: prefer `getByRole`, `getByLabel` and localized visible names; use stable `data-testid` only for geometry/runtime hooks that accessibility locators cannot express. Never locate normal UI by UUID, database codename or implementation CSS class. Use Playwright web-first assertions / `expect.poll` for product state and no fixed sleeps.

Browser proof:

-   Basic, Basic Demo, Empty, 1C-Compatible, LMS, Interpretation Network and PlayCanvas all create/publish/run from the fresh DB with no repair path.
-   Metahub authoring: add/edit source, presentation edit, duplicate, nested move/reorder, invalid nesting, deletion/stale source.
-   Application authoring: registry-limited inherited presentation/active/root-order editing and Reset-to-source; no inherited source/reparent/slot/zone mutation.
-   Runtime: structural, semantic-record, record-set, relation, metric/chart/table, nested, resource and specialized cases.
-   EN and RU authoring/runtime.
-   permission denied and network/server error.
-   page-level overflow assertion at 1920×1080, 768×1024 and 390×844.
-   constrained DataGrid scrolling remains allowed.
-   keyboard/focus and accessible labels.
-   screenshots are captured and visually inspected.
-   source picker mobile proof at 390×844 covers focus -> type -> ArrowDown/Enter -> Escape and verifies the popup stays within the viewport;
-   Metahub/Application optimistic-conflict proof verifies localized Reload/Retry/Cancel, preserved unsaved values when safe, and focus restoration;
-   destructive confirmation verifies canonical non-resizable/non-fullscreen behavior and footer spacing/focus return;
-   nested editor proves a keyboard-accessible move/reorder path;
-   inherited source-managed vs Application-local placement actions prove the registry Duplicate/Remove/Reset/reparent policy from the normal UI and corresponding server rejection;
-   technical-leakage checks run while authoring dialogs/forms are open, not only against runtime cards/tables.

Required Playwright UX assertions must reuse or add semantic helpers equivalent to:

-   `expectStrictRuntimeUxSurface` (or an equivalent strict composition) — UUID substrings as well as UUID-only values, binding JSON, structured/raw object text, schema/table names, internal validation and internal field names are forbidden on every normal Dashboard dialog/card/table/runtime surface;
-   `expectNoDataGridTechnicalLeakage(..., { requireVisibleGrid: true })` + bounded DataGrid horizontal-scroll assertion for every visible generic DataGrid;
-   `expectSemanticFieldControls` — source/reference controls expose human labels and expected control types;
-   `expectLocalizedValidation` — no raw Zod/internal English-only validation on RU surfaces;
-   `expectOptionalSourceQuietState` — add/reuse a real helper proving optional unbound `resourcePreview`/source variants render without error helper;
-   `expectNoPageHorizontalOverflow` — page width stays bounded while DataGrid/table containers may scroll internally;
-   viewport-specific geometry assertions for the 1920×1080, 768×1024 and 390×844 profiles.

Content dialogs pass all semantic long-text labels/roles to `expectSemanticFieldControls`, not only a fixed list of four field names.

Keep the browser matrix intentional rather than Cartesian: run the geometry oracle at all three target viewports, run real EN/RU coverage across representative Metahub/Application/runtime flows, and cover every ownership class. Do not multiply every widget × template × locale × viewport combination when a smaller orthogonal matrix proves the same contract.

Add a Dashboard geometry oracle against `.backup/templates/dashboard` for:

-   ~240 px wide reference drawer;
-   mobile/desktop visibility rules;
-   main content offset/background;
-   Stack spacing/top offset;
-   fixed mobile AppBar;
-   `--template-frame-height`;
-   no page horizontal overflow.

Keep/extend these existing suites:

-   `application-layout-management.spec.ts`
-   `cross-template-runtime.spec.ts`
-   `cross-template-scoped-layout.spec.ts`
-   `cross-template-concurrency.spec.ts`
-   fixture-specific runtime import/parity specs

### Phase 16 — README and GitBook documentation closeout

Update at minimum:

-   `docs/en/architecture/entity-backed-widgets.md`
-   `docs/ru/architecture/entity-backed-widgets.md`
-   `docs/en/guides/application-layouts.md`
-   `docs/ru/guides/application-layouts.md`
-   `docs/en/platform/applications.md`
-   `docs/ru/platform/applications.md`
-   `packages/universo-react-apps-template-mui/README.md`
-   `packages/universo-react-apps-template-mui/README-RU.md`
-   relevant types/metahubs/applications backend/frontend READMEs
-   `tools/testing/e2e/README.md` and `README-RU.md`

Remove documentation of:

-   `show*` fallback composition;
-   nested `columnsContainer.widgets` / `detailsTabs.widgets`;
-   Marketing-only descriptions of infrastructure that is now generic.

If this implementation changes/adds Dashboard/Application-layout screenshots in these guides, reuse or extend the repository's existing canonical Playwright screenshot/provenance pipeline first. Add Dashboard-specific producer/drift plumbing only when no existing producer can express the required final state; creating a parallel screenshot subsystem is out of scope.

When screenshot assets are required, preserve these properties:

-   a Playwright `generators` producer for the documented Metahub/Application/runtime states;
-   a deterministic artifact/output manifest recording locale, viewport, route and fixture/source provenance;
-   a `docs:application-layouts:screenshot:check`-style provenance/drift gate (exact script name may follow repository naming conventions);
-   a local-Supabase verification wrapper that captures from the same final Dashboard contract.

Do not hand-add unverifiable screenshots and do not reuse Marketing/LMS screenshots as proof of Dashboard geometry.

Documentation gates:

```bash
pnpm docs:i18n:check
node tools/docs/check-gitbook-links.mjs
pnpm docs:gitbook-screenshot-assets:check
```

### Phase 17 — Final clean-cutover verification and review

-   [ ] Repository search proves no supported Dashboard path still reads retired `show*`, embedded nested child arrays, or content-bearing legacy config.
-   [ ] Repository search proves common source lifecycle no longer depends on `templateKey === 'marketing-page'`.
-   [ ] Repository-wide retired-artifact inventory proves there are no supported legacy Dashboard helpers, schemas/types, config keys, compatibility adapters, obsolete translations/tests/fixtures/docs, or alternate composition/source-authority paths. Any remaining historical references are explicitly allowlisted as historical evidence only.
-   [ ] The exhaustive field-ownership and built-in/helper completeness gates report zero unclassified items.
-   [ ] Universal `instanceKey` validation is mandatory across fresh seeds, CRUD, snapshot, publication, sync, effective layout and runtime projection.
-   [ ] Six regenerated fixtures pass producer/contract/drift/runtime gates.
-   [ ] MMOOMM historical baseline is unchanged and parity passes.
-   [ ] Run scoped package tests/builds/lints first.
-   [ ] Run the dedicated fresh local-Supabase Dashboard gate.
-   [ ] Run cross-template/local-Supabase verification.
-   [ ] Run package isolation/runtime-fork checks.
-   [ ] Run docs gates.
-   [ ] Run final root:

```bash
pnpm build
```

-   [ ] Run OntoIndex `gn_verify_diff` / change detection and review all affected execution flows.
-   [ ] Apply the repository Thermos/autoreview gate to the complete final diff; fix all CRITICAL/HIGH findings before merge.
-   [ ] Inspect final screenshots manually and record the viewport/locale/template evidence in the implementation closeout.

## Test Matrix

| Layer                                              | Runner                              | Required proof                                                                                                     |
| -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Shared registry/types/schemas                      | Vitest                              | exhaustive key classification, strict retired-shape rejection, UUID v7/slot schemas, translations                  |
| Metahub stores/services/snapshot/duplicate         | Jest                                | SQL safety, binding authority, graph rules, clone/subtree transaction rollback, snapshot restore                   |
| Application sync/effective/hash/runtime projection | Jest                                | neutral source lineage, baseline/reset/remove, parent/slot materialization, semantic hash portability, concurrency |
| Metahub/Application React authoring                | Vitest + Testing Library            | real EN/RU resources, source/presentation separation, no raw IDs/JSON, nesting UX, conflicts                       |
| `apps-template-mui` runtime                        | Vitest                              | strict DTO rendering, all state classes, nested graph rendering, no demo fallback                                  |
| Full browser flow                                  | Playwright                          | fresh DB create/publish/runtime, EN/RU, permissions/errors, screenshots, keyboard/accessibility, viewport overflow |
| Fixture pipeline                                   | Playwright + contract/drift scripts | six canonical regenerations and runtime/import proof; immutable MMOOMM historical baseline                         |
| Package boundaries/docs                            | Node scripts + build                | isolation, no LMS forks, GitBook links/i18n/assets, full root build                                                |

### Critical portability acceptance

-   Fresh DB contains no child-widget JSON arrays.
-   Every retained persisted/effective Dashboard placement has a mandatory unique semantic `instanceKey`.
-   Snapshot -> restore changes physical placement UUIDs while preserving semantic graph/hash.
-   Publication -> application preserves parent/slot + source bindings.
-   Reset restores source-owned composition.
-   Subtree duplicate obeys placement-copy permission plus each bound descendant's `none/share-bindings/clone-record` policy atomically.
-   Invalid graph snapshots fail closed.
-   Source deletion/replacement/copy/fork and semantic-key mutation cannot silently detach or rebind required source-managed placements.
-   Ordinary Entity/workspace content CRUD does not recreate unaffected placements or change their `instanceKey` values.
-   Runtime is visually equivalent to the MUI Dashboard reference for reference-sensitive geometry.

## Potential Challenges and Mitigations

### 1. Generic registry becomes a query language

**Risk:** chart/table flexibility pushes SQL/field mappings into browser-authored config.
**Mitigation:** keep semantic bounded source contracts server-owned; add a new selector class only for a real reusable semantic need.

### 2. Nested graphs create portability bugs

**Risk:** physical parent UUIDs leak into hash/source baseline or become stale after restore.
**Mitigation:** portable `instanceKey` identity for semantic comparison; explicit UUID remap for persistence only; round-trip tests.

### 3. Source and nesting lineage are conflated

**Risk:** reusing `source_base_widget_id` for parent relationships breaks reset/sync inheritance.
**Mitigation:** separate `parent_widget_id`/slot graph and test source reset with nested children.

### 4. Atomic duplicate partially clones content

**Risk:** a child fails after some records/placements have already been copied.
**Mitigation:** preflight every subtree node, one DB transaction, optimistic revision check, rollback tests.

### 5. Retiring demo surfaces breaks a fixture silently

**Risk:** fixtures/templates relied on `productTree`, country chart or brand selector.
**Mitigation:** convert legitimate demonstrations to generic data widgets, update all built-in templates in one cutover, add negative fixture checks.

### 6. Source-managed application overlays drift

**Risk:** Marketing-only branch removal changes comparison rules inconsistently.
**Mitigation:** one neutral source-ownership classifier shared by source state, effective layout, sync, reset, policy and publication projection.

### 7. UI becomes a technical configuration editor

**Risk:** bindings/parent/slot/source abstractions leak UUIDs/codenames/JSON.
**Mitigation:** human semantic selectors, hidden server-owned IDs, explicit content vs presentation actions, real EN/RU browser tests.

### 8. Functional tests miss MUI geometry regression

**Risk:** all CRUD flows pass but Dashboard spacing/drawer/mobile behavior drifts.
**Mitigation:** dedicated geometry oracle and inspected screenshots at all three target viewports.

### 9. Scope expands into unrelated domain redesign

**Risk:** converting every specialized widget to generic Objects or redesigning report/quiz/PlayCanvas domain models.
**Mitigation:** refactor only duplicated source/content ownership; specialized runtime contracts remain specialized.

## Dependencies and Sequencing

1. Registry ownership and strict schemas before backends/frontends.
2. Nested persistence and graph validator before snapshot/application/runtime work.
3. Neutral source ownership/binding infrastructure before source-managed Dashboard authoring.
4. Metahub lifecycle/duplicate before frontend Duplicate/Nesting controls.
5. Snapshot/publication before application materialization/reset/hash.
6. Runtime DTO resolver before isolated renderer cutover.
7. Built-in templates before fixture generation.
8. Final schemas/templates before six fixtures are regenerated.
9. Unit/integration gates before fresh-DB Playwright; browser proof before docs screenshots.
10. Full root build, OntoIndex diff verification and Thermos review only after the final source/fixture/docs state is complete.

## Plan UX Reviewer Gate

**Independent plan-ux-reviewer verdict after the final per-surface contract refinement:** **pass**.
**Blockers:** none.
**Major issues:** none.

Checklist:

-   [x] UI Contract exists for all touched authoring/runtime surfaces.
-   [x] Raw IDs, raw binding JSON, table/schema names and hidden-knowledge workflows are forbidden.
-   [x] Raw JSON/`[object Object]` table/card rendering is forbidden.
-   [x] Semantic long text is multiline.
-   [x] Validation/errors are localized and do not expose Zod/internal messages.
-   [x] Page-level horizontal overflow is forbidden; constrained DataGrid scroll is explicitly allowed.
-   [x] Existing MUI Dashboard/app-template primitives are the default.
-   [x] Browser/Playwright evidence is mandatory.
-   [x] Reference-sensitive MUI geometry has a dedicated oracle.
-   [x] Real EN/RU resources are exercised in component/browser tests.

Any implementation that violates one of these checks is a blocking UX defect, even if CRUD/unit tests pass.

## Final QA Review Gate

The revised plan received independent plan-level re-review after the QA amendments:

-   **requirement traceability:** **PASS** — no remaining HIGH/MEDIUM gap against the brief, technical spec, or research;
-   **architecture:** **PASS** — no remaining BLOCKER/MAJOR issue after separating registry source policy from concrete lineage state and making scope/base/source-origin hash semantics portable;
-   **Runtime UI UX:** **PASS** — no remaining BLOCKER/MAJOR issue after the explicit per-surface contracts and reuse map;
-   **test/oracle quality:** **PASS** — no remaining BLOCKER/MAJOR issue after the fresh-DB lifecycle, hash portability, fixture, concurrency and UX-canary refinements.

These are plan-level QA verdicts. Implementation still must satisfy the executable Jest/Vitest/PostgreSQL/Playwright/fixture/docs/build/Thermos gates defined below before implementation QA can pass.

## Definition of Done

The work is complete only when all of the following are true:

-   Every retained Dashboard widget has one explicit registry ownership/source/presentation/duplicate contract.
-   Every currently persisted Dashboard field/path has one final owner in the exhaustive field-ownership inventory, with no unclassified fields.
-   Every retained placement has a mandatory stable `instanceKey`; duplicates get new keys, while content/presentation/sync/restore preserve semantic identity as specified.
-   Demo-only `brandSelector`, `productTree`, and `usersByCountryChart` are removed.
-   No durable editorial content remains duplicated in renderer config.
-   No persisted `show*` value acts as a second composition authority.
-   No container embeds child widget instances in JSON.
-   Parent/slot placement graphs are validated, portable across snapshot restore, source-aware, and semantically hashed without physical UUIDs.
-   Repeatable relation-panel bindings use one validated serializable slot-family contract shared by types, backend, frontend and hash/canonicalization code.
-   No common source lifecycle path depends on Marketing template identity.
-   Source discovery/provisioning, validation, overlay authority, publication, sync, Reset, replacement/copy/fork/removal and integrity policies all use the same neutral classifier.
-   Metahub authoring is registry-driven; Application source-managed editing is limited to registry-declared presentation plus explicitly enabled active/root-order deployment overrides, with source/zone/parent/slot/rebind remaining source-owned.
-   Runtime receives only authorized strict DTOs.
-   Specialized runtime surfaces retain their natural typed source contracts.
-   Basic, Basic Demo, Empty, 1C-Compatible, LMS, Interpretation Network and PlayCanvas work from a nuked fresh local Supabase database without repair/compatibility.
-   The exhaustive built-in/helper inventory proves every current Dashboard manifest and seed/default helper uses the final canonical path.
-   Jest, Vitest and Playwright coverage above is green.
-   Required 1920×1080, 768×1024 and 390×844 screenshots were generated and visually inspected.
-   All new/changed UI text is real EN/RU and no fallback masks missing Russian keys.
-   Six snapshot fixtures were canonically regenerated and validated.
-   `mmoomm-runtime-pre-extraction-baseline.json` is unchanged and parity passes.
-   Package isolation and `runtime-no-lms-forks` gates pass.
-   GitBook/README documentation describes only the final architecture.
-   `pnpm build`, OntoIndex diff verification and Thermos/autoreview closeout pass.
-   No schema/template version was increased solely for this clean refactor.

## Implementation Closeout Expectations

IMPLEMENT should return a compact evidence ledger containing:

-   changed architectural seams;
-   exact Jest/Vitest/package gates executed;
-   exact fresh local-Supabase/Playwright suites executed;
-   fixture producer/contract/drift/runtime results for all six generated fixtures;
-   immutable MMOOMM baseline checksum/parity result;
-   EN/RU and viewport screenshot paths plus explicit visual-inspection result;
-   package isolation/docs/full-build results;
-   OntoIndex final affected-flow summary;
-   Thermos/autoreview verdict and resolved findings.

Do not claim completion for browser-visible behavior from unit tests alone.
