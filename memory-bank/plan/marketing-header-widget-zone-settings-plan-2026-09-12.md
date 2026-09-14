# Plan: Marketing Header Widget Composition and Zone Settings

> Status: Implemented and QA-verified
> Created: 2026-09-12
> Last verified: 2026-09-13
> Mode: IMPLEMENT / QA closeout
> Product-code changes: complete
> Complexity: Level 4 / cross-cutting architecture, persistence, runtime UI, synchronization and E2E
> Primary requirements: captured in this plan and the linked research document
> Source task: original user requirements summarized in the Overview below
> Research: `../research/marketing-header-widget-zone-settings-research-2026-09-12.md`

## Overview

Replace the marketing page's composite navigation/AppBar ownership model with a
widget-driven `marketing-header` zone. The zone, rather than each navigation
widget, will own one semantic header shell, one responsive mobile Drawer and the
fixed-versus-flow positioning behavior. Brand, navigation, authentication,
language and color-mode controls become persisted capabilities that can be
placed and ordered independently.

At the same time, introduce a generic layout-zone settings foundation rather
than a marketing-only setting. The first setting is
`marketing-header.position = fixed | flow`, defaulting to `fixed`. Persisted
layout data continues to use the existing `config` JSONB/snapshot carrier; no
new database column, migration, schema-version increment, snapshot-version
increment or metahub-template-version increment is introduced.

This is a clean break. The test database will be recreated, so implementation
must remove obsolete shell-injection behavior and old compatibility branches in
the same change instead of dual-reading or retaining legacy representations.

## Planning evidence and resolved decisions

This plan incorporates the current brief, the QA-reviewed research artifact,
direct source inspection, current package/test scripts, OntoIndex navigation,
read-only architecture/runtime/test Subagent reviews, and current Context7
documentation for Material UI 9.2.0, Playwright 1.58.x and TanStack Query 5.

The following decisions are fixed for implementation:

1. **One generic zone-settings system.** Extend the canonical layout-zone
   registry. Do not create a marketing-specific settings registry.
2. **One existing physical carrier.** Reserved neutral metadata is stored inside
   existing layout/widget `config` objects under the reserved `__layout` key and
   decoded before renderer-specific strict parsing.
3. **One canonical neutral codec.** Replace the current duplicated
   `stripLayoutCompositionMetadata` / reattach logic with shared strict
   encode/decode functions.
4. **Sparse zone-setting inheritance.** Same-template overlays persist only
   their own zone-setting overrides. Resolution is registry default -> base ->
   overlay override.
5. **Application source baseline.** Metahub-derived application layouts persist
   the latest accepted source zone settings separately from application-local
   sparse overrides, inside the same reserved JSONB metadata.
6. **Whole-layout conflict granularity remains for the first slice.** A source
   value that happens to converge to a local override does not automatically
   clear that override. Existing conflict resolution remains explicit.
7. **Five persisted header capabilities.** The marketing header uses
   `marketing.brand`, repeatable `marketing.navigation`, `marketing.auth`,
   shared `languageSwitcher`, and shared `colorModeSwitcher`.
8. **One shell-only responsive mechanism.** The hamburger/menu trigger and
   temporary Drawer are responsive mechanics owned by the header shell; they
   are not persisted widgets.
9. **Typed logical placement.** Header widgets have decoded neutral
   `placement: 'start' | 'end'`. The physical value is stored in the widget's
   reserved `config.__layout` metadata and transported through snapshot,
   inheritance, sync, hashing and runtime adapters.
10. **One semantic banner.** `marketing-header` owns exactly one accessible
    banner/AppBar shell. Navigation widgets create named `nav` landmarks inside
    it; child widgets never own page positioning.
11. **One mobile Drawer.** On compact viewports, brand, language and color mode
    stay in the compact header; all active navigation groups and authentication
    actions are projected into one Drawer in deterministic persisted order.
12. **Measured fixed geometry.** Fixed mode uses the actual rendered header
    height, not hard-coded navigation-stack constants. Flow mode stays in normal
    document flow and has no fixed spacer or fixed-header scroll padding.
13. **Shared authoring primitive.** Zone Settings and logical Start/End grouping
    extend the existing `LayoutAuthoringDetails`; application and metahub
    editors must not fork their own marketing-only authoring surface.
14. **Existing test runner per package.** Use Jest where the affected package
    already uses Jest, Vitest where it already uses Vitest, and Playwright for
    browser E2E. Do not introduce a duplicate runner merely to satisfy a label.

## Scope

### In scope

-   Generic serializable zone-setting descriptors/defaults in the canonical zone
    registry.
-   Strict neutral layout/widget envelope schemas and codecs.
-   `marketing-header.position = fixed | flow` with `fixed` as the registry
    default.
-   Sparse metahub inheritance and targeted reset for zone settings.
-   Application source baseline, local zone override, sync resolution and
    targeted reset semantics.
-   Neutral logical widget placement `start | end` and deterministic order within
    each group.
-   Atomic persisted marketing header widgets: brand, navigation, auth,
    language, color mode.
-   Dashboard support for persisted shared `colorModeSwitcher` and singleton
    shared language/color controls, removing implicit shell ownership of those
    controls.
-   One marketing header shell, one banner, one mobile Drawer and measured
    fixed-header occlusion.
-   TanStack Query authoring mutations with OCC-aware rollback/invalidation.
-   EN/RU i18n for every new user-facing label/message.
-   Jest/Vitest/integration/Playwright/visual/accessibility/concurrency coverage.
-   Package READMEs and EN/RU GitBook documentation.

### Explicit non-goals

-   No database migration or new physical column/table for zone settings.
-   No schema, snapshot or metahub-template version bump.
-   No backwards-compatible read path for the old composite marketing AppBar.
-   No `sharedLayoutWidgets` marketing side channel.
-   No per-setting three-way merge in application synchronization.
-   No template-aware cardinality abstraction in this slice. The two new shared
    controls are singleton in both Dashboard and marketing, so the existing
    `multiInstance` contract remains sufficient after setting it to `false` for
    these controls.
-   No import from `@universo-react/template-mui` into
    `@universo-react/apps-template-mui`. Shared **authoring** UI stays in
    `template-mui`; published runtime remains isolated and shares only neutral
    packages/contracts.
-   No visual redesign away from the current MUI marketing baseline.

## Design Notes

### 1. Canonical neutral envelope

Introduce a shared contract module, preferably
`packages/universo-react-types/src/common/layoutEnvelope.ts`, and export it from
the package's public barrel. It owns strict Zod schemas plus pure encode/decode
helpers. Renderer-specific schemas remain elsewhere.

The DB representation is intentionally one object:

```ts
const RESERVED_LAYOUT_METADATA_KEY = '__layout' as const

type LayoutPosition = 'fixed' | 'flow'
type LayoutLogicalPlacement = 'start' | 'end'

type LayoutZoneSettings = Partial<
    Record<
        ApplicationLayoutZone,
        {
            position?: LayoutPosition
        }
    >
>

type PersistedLayoutNeutralMetadata = {
    composition?: {
        mode: 'overlay' | 'independent'
        baseLayoutId: string | null
    }
    zoneSettings?: LayoutZoneSettings
    // Application rows only. Never exported as source semantic content.
    sourceZoneSettings?: LayoutZoneSettings
}

type PersistedWidgetNeutralMetadata = {
    placement?: LayoutLogicalPlacement
}
```

A persisted layout therefore has the conceptual shape:

```json
{
    "appearance": "...renderer-owned fields...",
    "__layout": {
        "composition": { "mode": "independent", "baseLayoutId": null },
        "zoneSettings": {
            "marketing-header": { "position": "fixed" }
        }
    }
}
```

A persisted widget keeps renderer settings and neutral placement in the same
physical JSONB without exposing the reserved metadata to the renderer parser:

```json
{
    "instanceKey": "primary-navigation",
    "source": { "entityCodename": "MarketingPageNavigation" },
    "__layout": { "placement": "start" }
}
```

The codec contract is:

```ts
const decoded = decodeLayoutConfigEnvelope(rawConfig, { templateKey })

// Strict neutral validation happens first and can fail closed.
decoded.neutral.zoneSettings

// Only rendererConfig reaches parseApplicationLayoutConfig().
parseApplicationLayoutConfig(templateKey, decoded.rendererConfig)
```

Rules:

-   `__layout` itself is strict. Unknown reserved keys fail closed.
-   A known setting on an unsupported template/zone fails closed.
-   A known setting with an unsupported value fails closed.
-   Renderer config never sees `__layout`.
-   The read-only admin fallback that currently keeps malformed renderer config
    inspectable must **not** make malformed reserved neutral metadata permissive.
-   No second top-level `zoneSettings` snapshot wire representation is added.
-   Existing snapshot-v1 top-level `compositionMode/baseLayoutId` remain the
    snapshot composition transport for this slice. Snapshot encoding derives
    those fields from the decoded neutral composition and omits duplicate
    composition from `config.__layout`; snapshot `config.__layout` carries the
    semantic zone settings. Application-only `sourceZoneSettings` is never
    exported.
-   In DB persistence, remove the old root-level `compositionMode/baseLayoutId`
    representation atomically and use `__layout.composition`. Because the test DB
    is disposable, do not retain dual readers or compatibility shims.

### 2. Registry extension

Extend `LayoutZoneDefinition` with serializable setting descriptors. Do not
serialize executable Zod schema instances.

Example:

```ts
type LayoutZoneSettingDefinition = {
    key: 'position'
    kind: 'enum'
    options: readonly ['fixed', 'flow']
    defaultValue: 'fixed'
    labelKey: string
    optionLabelKeys: Readonly<Record<'fixed' | 'flow', string>>
}

type LayoutZoneDefinition = {
    // existing fields...
    settings: readonly LayoutZoneSettingDefinition[]
}
```

Only `marketing-header` receives `position` initially. A neutral validator
selects the permitted descriptor from `templateKey + zone + settingKey`; no
marketing-specific switch is added in application/metahub persistence.

### 3. Header widget taxonomy and defaults

Ratify the following canonical definitions:

| Widget                 | Cardinality      | Marketing zone                       | Default placement | Mobile projection |
| ---------------------- | ---------------- | ------------------------------------ | ----------------- | ----------------- |
| `marketing.brand`      | singleton        | `marketing-header`                   | `start`           | compact header    |
| `marketing.navigation` | repeatable       | `marketing-header`                   | `start`           | one shared Drawer |
| `marketing.auth`       | singleton        | `marketing-header`                   | `end`             | one shared Drawer |
| `languageSwitcher`     | singleton/shared | `marketing-header` + Dashboard `top` | `end`             | compact header    |
| `colorModeSwitcher`    | singleton/shared | `marketing-header` + Dashboard `top` | `end`             | compact header    |

`sortOrder` remains authoritative **within** a placement group. Stable tie
breaking uses persisted semantic instance identity/ID only as an internal
deterministic fallback and never as a user-facing label.

The marketing template seed is updated in place to include all intended
default header widgets. No template version is incremented. Existing test data
will be recreated.

For Dashboard, change `languageSwitcher` to `multiInstance: false`, add
`colorModeSwitcher` with `multiInstance: false`, seed the required control rows,
render them through the persisted widget renderer, and remove shell-owned
language/color duplication. Keep Dashboard-specific navigation/shell mechanics
separate from marketing.

### 4. Zone setting resolution

The semantic resolution order is fixed:

```text
registry default
    -> metahub global/independent owned value
    -> same-template metahub overlay sparse override
    -> publication/snapshot source effective value
    -> application sourceZoneSettings baseline
    -> application-local sparse zoneSettings override
    -> effective runtime value
```

Reset removes the local sparse setting key. It never resets renderer
appearance config. When no source baseline exists, the registry default becomes
effective. Independent/global snapshot serialization writes the effective
owned/default value explicitly so a future registry default cannot reinterpret
an old publication.

### 5. Application synchronization contract

Keep the current whole-layout conflict model and define zone-setting behavior
inside each existing resolution:

| Situation                    | Zone-setting result                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Clean source update          | Replace source baseline; no local override; effective becomes source                                 |
| `keep_local`                 | Atomically update source baseline; preserve local sparse override                                    |
| `overwrite_local`            | Update source baseline and remove local override                                                     |
| `copy_source_as_application` | Preserve linked local state; create application-owned independent copy from current source semantics |
| `skip_source`                | Do not accept the new baseline; preserve prior baseline/local state and unresolved state             |
| Unresolved conflict          | Do not advance the accepted baseline until a resolution is chosen                                    |
| Reset after `keep_local`     | Remove local override and reveal latest accepted source baseline                                     |

Do not auto-clear a local override merely because a later source value becomes
equal to it. That optimization is deferred so implementation does not introduce
a second setting-level conflict model.

### 6. Semantic hashing

Stop hashing raw storage metadata. Build a canonical semantic projection:

```ts
const semanticLayout = {
    rendererConfig: decoded.rendererConfig,
    composition: decoded.neutral.composition,
    effectiveZoneSettings: resolveEffectiveZoneSettings(...),
    // existing semantic name/scope/active/default/order fields
}

const semanticWidget = {
    zone: widget.zone,
    widgetKey: widget.widgetKey,
    sortOrder: widget.sortOrder,
    placement: decodedWidget.neutral.placement ?? registryPlacementDefault,
    rendererConfig: decodedWidget.rendererConfig,
    isActive: widget.isActive
}
```

Exclude `sourceZoneSettings`, source/provenance IDs, optimistic versions and
other bookkeeping. A baseline-only update with unchanged effective semantics
must not make a layout locally modified. A real effective position or placement
change must change the semantic hash.

## UI Contract

### Controls

1. Extend the existing `LayoutAuthoringDetails` zone heading with a generic
   metadata-driven action slot. A localized **Settings** action is rendered in
   the zone heading when the canonical registry declares settings for that zone.
   In this slice `marketing-header` is the first settings-capable zone; do not
   render misleading inert Settings buttons for zones that expose no settings.
   The accessible name includes the localized zone name.
2. The Zone Settings surface reuses the existing `template-mui` dialog
   presentation conventions (`useDialogPresentation`, shared Dialog sizing/
   Paper/resize behavior and focus conventions) rather than introducing a new
   dialog shell. The settings body is metadata-driven and uses MUI
   `RadioGroup` for the first enum setting.
3. The first field and options use the exact localized product copy from the
   brief:
    - **Header behavior** / **Поведение шапки**;
    - **Fixed on screen** / **Закреплена на экране** — the header remains
      visible while page content scrolls;
    - **Scrolls with page** / **Прокручивается вместе со страницей** — the
      header remains in normal flow and leaves the viewport when the page
      scrolls.
4. Show a textual status such as **Inherited** / **Customized here**. Do not
   communicate inheritance by color alone.
5. Show **Save**, **Cancel**, and **Reset to inherited/default** only when the
   current layout semantics permit the action.
6. Header-zone authoring displays logical **Start** and **End** groups. Reuse
   the existing `LayoutAuthoringDetails` `moveActions` menu as the explicit
   keyboard/pointer alternative for Start <-> End placement; extend the current
   move contract instead of inventing a second placement editor. Pointer/
   keyboard DnD may remain for reordering, but the workflow must never depend on
   dragging.
7. Widget group labels and actions use localized display names. Never show
   `start`, `end`, `fixed`, `flow`, UUIDs, JSON or CSS values to the user.

### Defaults and display values

-   Default header position: `fixed`.
-   Brand/navigation default to Start.
-   Auth/language/color mode default to End.
-   Inherited values display the resolved human label and provenance state, not a
    raw internal value.
-   When the active layout is read-only for the current user, controls remain
    understandable and the Settings surface still exposes the effective value
    and inheritance state without editable controls; use existing permission UX
    conventions instead of exposing a failing Save button.

### Loading, saving, conflict and error states

-   Use the existing TanStack Query detail query as the cache authority.
-   Disable only the affected Save/Reset/move control while its mutation is
    pending; keep the rest of the page inspectable.
-   On optimistic mutation, cancel the affected detail query, snapshot prior
    cache state, apply the typed semantic update, roll back on failure, then
    invalidate layout/runtime/diff queries after settlement.
-   Stale OCC (`409`) displays a localized message that the layout changed and
    must be reloaded/retried.
-   Forbidden (`403`) and not-found/cross-scope (`404`) use localized normal-user
    copy. No internal API error text is rendered.
-   When the layout is in the existing unresolved source-sync conflict state,
    the Zone Settings surface shows a localized conflict explanation and does
    not imply that a local Save/reset has resolved source synchronization.
-   Focus returns to the Settings trigger after the dialog closes and to the
    mobile menu trigger after the Drawer closes.

### Responsive runtime contract

Desktop/tablet header shell:

-   exactly one semantic `banner`;
-   one MUI AppBar/shell owns fixed/flow positioning;
-   Start and End groups are flex logical groups, not absolute left/right
    coordinates;
-   each active navigation widget renders a separate, distinguishably named
    `nav` landmark;
-   each persisted control has exactly one active accessible projection.

Compact/mobile header shell:

-   brand remains in the compact Start area when active;
-   language and color mode remain compact trailing controls when active;
-   exactly one menu trigger appears when active navigation/auth content needs a
    Drawer;
-   exactly one temporary Drawer projects all active navigation groups followed
    by auth actions in deterministic persisted order;
-   an allowed header widget without a declared mobile projection fails closed in
    validation/tests rather than disappearing silently;
-   hidden responsive branches must not leave duplicate interactive controls in
    the accessibility tree.

### Fixed/flow geometry contract

Fixed mode:

-   the shell is fixed relative to the application frame offset;
-   use a `ResizeObserver` on the rendered header content to measure actual
    height after locale changes, wrapping, widget activation/reorder and viewport
    changes;
-   treat rendered height and application-frame/containing-block offset as
    separate inputs. Recompute effective occlusion when either changes; do not
    assume `ResizeObserver` alone observes changes to the fixed containing block
    or the shell's viewport offset;
-   maintain exactly one flow spacer/offset equal to the measured header height;
-   expose an internal CSS custom property such as
    `--marketing-header-occlusion` for downstream anchor/scroll calculations;
-   apply `scroll-padding-block-start` from the measured effective occlusion so
    anchor, skip-link and focus targets are not hidden;
-   avoid synchronous measurement loops: update state/CSS only when the measured
    value actually changes and clean up observers on unmount.

Flow mode:

-   use normal document flow;
-   no fixed spacer;
-   no fixed-header scroll padding/occlusion residue;
-   after sufficient scrolling the header leaves the viewport.

### Accessibility and localization

-   One `banner` landmark only. If MUI `AppBar` remains the banner, do not wrap it
    in another semantic `<header>`; if an outer `<header>` owns the landmark,
    render AppBar as a non-landmark element.
-   Repeated navigation landmarks require unique human-readable accessible names.
-   Drawer trigger exposes correct `aria-expanded` and `aria-controls`.
-   Escape closes the Drawer and focus returns to the trigger.
-   Skip-link Tab -> Enter flow lands on visible main content below the effective
    fixed-header occlusion.
-   All new authoring strings are EN/RU from shared i18n resources. Runtime-only
    template text remains inside the isolated `apps-template-mui` namespace when
    it is not shared authoring copy.
-   No raw IDs, raw JSON, `[object Object]`, internal validation text or technical
    enum tokens on normal user surfaces.
-   No page-level horizontal overflow at 1920x1080, 768x1024 or 390x844.

## Affected Areas

### Shared contracts and registry

-   `packages/universo-react-types/src/common/layoutEnvelope.ts` (new)
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/marketingPage.ts`
-   `packages/universo-react-types/src/common/metahubs.ts`
-   package export barrels and associated Vitest suites

### Application backend

-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutSyncStore.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutWidgetSyncStore.ts` as required for neutral widget placement
-   `packages/universo-react-applications-backend/src/validation/applicationLayoutMutationSchemas.ts`
-   `packages/universo-react-applications-backend/src/controllers/applicationLayoutsController.ts`
-   `packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
-   `packages/universo-react-applications-backend/src/services/effectiveLayoutResolver.ts`
-   `packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts`
-   focused Jest suites for stores/controllers/effective resolution/sync/hash

### Metahub backend and snapshot lifecycle

-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/controllers/layoutsController.ts`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/routes/layoutsRoutes.ts`
-   `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/marketingSnapshotValidation.ts`
-   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts`
-   relevant Jest suites for layout inheritance, copy, snapshot, restore and validation

### Shared authoring UI

-   `packages/universo-react-template-mui/src/components/layouts/LayoutAuthoringDetails.tsx`
-   a focused shared Zone Settings dialog/component beside the layout primitives
-   shared component tests using real `LayoutAuthoringDetails`

### Application/metahub authoring consumers

-   `packages/universo-react-applications-frontend/src/api/applications.ts`
-   `packages/universo-react-applications-frontend/src/api/queryKeys.ts` if a dedicated query key becomes necessary
-   `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
-   `packages/universo-react-applications-frontend/src/pages/__tests__/ApplicationLayouts.test.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/api/layouts.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/hooks/mutations.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/LayoutDetails.tsx`
-   metahub layout UI integration tests

### Published application runtime

-   `packages/universo-react-applications-frontend/src/pages/application-runtime/runtimeLayout.ts`
-   `packages/universo-react-applications-frontend/src/pages/application-runtime/__tests__/runtimeLayout.test.ts`
-   `packages/universo-react-apps-template-mui/src/marketing-page/MarketingPage.tsx`
-   `packages/universo-react-apps-template-mui/src/marketing-page/MarketingWidgetRenderer.tsx`
-   `packages/universo-react-apps-template-mui/src/marketing-page/normalize.ts`
-   `packages/universo-react-apps-template-mui/src/marketing-page/types.ts`
-   `packages/universo-react-apps-template-mui/src/marketing-page/components/AppAppBar.tsx` (replace/refactor into the zone shell and atomic renderers)
-   a new focused `MarketingHeaderShell`/header composition module
-   `packages/universo-react-apps-template-mui/src/dashboard/Dashboard.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx`
-   Dashboard Header/AppNavbar/options controls where implicit language/color ownership is removed
-   runtime Vitest suites and package-boundary tests

### i18n

-   `packages/universo-react-i18n/src/locales/en/...`
-   `packages/universo-react-i18n/src/locales/ru/...`
-   application/metahub translation namespaces only for consumer-specific errors/copy that is not genuinely shared
-   `packages/universo-react-apps-template-mui/src/i18n/...` only for runtime-only template wording

### E2E, visual QA and harness

-   `tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-concurrency.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts`
-   `tools/testing/e2e/specs/flows/marketing-page-widget-lifecycle.spec.ts`
-   `tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts`
-   `tools/testing/e2e/specs/flows/application-layout-management.spec.ts`
-   `tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts`
-   `tools/testing/e2e/specs/flows/metahub-global-entity-layouts.spec.ts`
-   `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts`
-   shared `runtimeUx.ts` helpers
-   `tools/testing/e2e/support/runMarketingPageVerificationLocalSupabase.mjs`

### Documentation

-   affected package `README.md` files for types, template-mui,
    apps-template-mui, applications frontend/backend and metahubs frontend/backend
-   `docs/en/platform/marketing-page-template.md`
-   `docs/ru/platform/marketing-page-template.md`
-   `docs/en/guides/application-layouts.md`
-   `docs/ru/guides/application-layouts.md`
-   `docs/en/guides/app-template-views.md`
-   `docs/ru/guides/app-template-views.md`
-   `docs/en/guides/entity-scoped-layouts.md`
-   `docs/ru/guides/entity-scoped-layouts.md`
-   existing GitBook navigation/index files only if a new page is introduced;
    prefer extending these existing pages rather than creating redundant docs

## Plan Steps

### Phase 0 - Baseline, ownership map and clean-break guardrails

-   [x] Record the current HEAD, existing dirty files and the exact affected
        package versions before implementation. Do not modify unrelated
        `AGENTS.md`, `CLAUDE.md` or research work.
-   [x] Use OntoIndex on each concrete symbol before editing it and report any
        HIGH/CRITICAL upstream impact before implementation changes.
-   [x] Capture baseline browser screenshots of the current marketing page at
        desktop/tablet/mobile only as historical comparison evidence; do not turn
        old multi-AppBar behavior into acceptance criteria.
-   [x] Confirm the current default template seed and freshly recreated DB are the
        only migration target. Do not add dual-read fallback or data migration.
-   [x] List and deliberately replace legacy tests that assert multiple fixed
        AppBars/Drawers or `sharedLayoutWidgets` injection:
        `AppAppBar.crossTemplate.test.tsx`, `MarketingPage.test.tsx`, and the old
        geometry assertions in `cross-template-runtime.spec.ts`.
-   [x] Add an architecture guard/test that published marketing runtime no longer
        accepts `sharedLayoutWidgets` as a second composition authority.

### Phase 1 - Neutral contracts, codecs and registry capabilities

-   [x] Add `layoutEnvelope.ts` with strict schemas/types for neutral layout
        metadata, widget placement, zone settings and application source
        baseline.
-   [x] Implement one `decodeLayoutConfigEnvelope` / `encodeLayoutConfigEnvelope`
        and equivalent widget helpers. Ensure they preserve renderer config
        losslessly while removing reserved metadata before strict renderer
        parsing.
-   [x] Make reserved metadata system-owned at every mutation boundary. Renderer-
        config mutation bodies must not be able to create or replace `__layout`;
        reject unexpected reserved metadata rather than merging attacker/client-
        supplied neutral state into the stored envelope.
-   [x] Audit every existing layout/widget config writer and reset path before
        switching the storage shape. Normal renderer-config saves must decode the
        current envelope, replace only `rendererConfig`, and re-encode the
        existing neutral metadata. Widget config saves do the same for widget
        neutral metadata such as `placement`.
-   [x] Refactor `applicationLayouts.ts`, application store support,
        `syncHelpers.ts` and effective resolution to use the codec. Delete the
        duplicated root-level composition strip/reattach helpers in the same
        change.
-   [x] Normalize DB composition metadata to `config.__layout.composition`. Do not
        retain the previous root-level `compositionMode/baseLayoutId` JSONB
        representation.
-   [x] Preserve snapshot-v1 top-level `compositionMode/baseLayoutId` as the
        snapshot composition wire contract, deriving them from the neutral model
        and preventing duplicate composition metadata in snapshot config.
-   [x] Extend `LayoutZoneDefinition`/metadata response with serializable setting
        descriptors and declare `marketing-header.position`, default `fixed`.
-   [x] Add central descriptor-driven validation for template/zone/setting/value.
        Fail closed on unknown values before any write or renderer parse.
-   [x] Add typed neutral widget `placement`, with registry defaults for each
        header capability.
-   [x] Ratify registry entries for `marketing.brand`, `marketing.navigation`,
        `marketing.auth`, `languageSwitcher`, `colorModeSwitcher`. Make language
        and color mode singleton in both templates; keep navigation repeatable.
-   [x] Extend strict metadata response schemas so clients receive zone-setting
        capabilities/defaults without executable validators.

Required Vitest evidence in `@universo-react/types`:

-   codec deterministic round-trip;
-   reserved metadata stripped from renderer input;
-   unknown reserved key fails closed;
-   renderer-only mutation payloads cannot inject/overwrite `__layout`;
-   replacing renderer config preserves all existing neutral metadata;
-   wrong template/zone/setting/value fails closed;
-   `fixed` default and valid `flow`;
-   valid/default `start|end` placement;
-   singleton language/color cardinality and repeatable navigation;
-   snapshot/effective schemas reject any accidental parallel top-level wire
    fields not part of their intended decoded DTO.

### Phase 2 - Metahub storage, sparse inheritance and targeted Zone Settings API

-   [x] Refactor `MetahubLayoutsService` so renderer config and neutral metadata
        are decoded before any shallow renderer-config merge or marketing strict
        parse.
-   [x] Preserve current renderer-config inheritance semantics, but resolve zone
        settings independently as sparse metadata:
        registry default -> base effective -> local overlay override.
-   [x] Global/independent layouts explicitly own/serialize the current supported
        setting value for deterministic snapshots.
-   [x] Same-template overlays store only locally overridden zone-setting keys;
        do not copy the base `zoneSettings` object into the scoped row.
-   [x] Add typed metahub routes adjacent to existing layout routes:
        `PATCH /metahub/:metahubId/layout/:layoutId/zone-settings/:zone/:settingKey`
        with `{ value, expectedVersion }`, and
        `POST .../zone-settings/:zone/:settingKey/reset` with
        `{ expectedVersion }`.
-   [x] Implement service methods such as `updateLayoutZoneSetting` and
        `resetLayoutZoneSetting` using the existing layout `_upl_version` as the
        OCC boundary.
-   [x] Reuse the existing `MetahubLayoutsService` transaction and lock ordering:
        acquire the existing layout graph/scope/row serialization boundary before
        reading the envelope, assert `expectedVersion` against the locked row,
        then write and `RETURNING`-verify the update. Do not introduce an
        independent lock order for Zone Settings.
-   [x] Validate UUID v7 path IDs, template-zone-setting capability and value
        before locking/writing.
-   [x] Use `manageMetahub` for mutations, preserving current permission policy.
-   [x] Reset only the requested sparse setting. It must leave renderer appearance
        config, widget rows and unrelated zone settings untouched.
-   [x] Make layout copy preserve semantic zone settings correctly:
        overlays remain sparse against their base; independent copies own their
        effective value.

Safe mutation pattern (inside the existing locked service transaction):

```ts
return this.exec.transaction(async (tx) => {
    const locked = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
    if (!locked) throw this.createNotFoundError('Layout not found')
    this.assertExpectedLayoutVersion(locked, expectedVersion)

    const current = decodeLayoutConfigEnvelope(locked.config, { templateKey })
    const nextConfig = encodeLayoutConfigEnvelope({
        rendererConfig: current.rendererConfig,
        neutral: applyZoneSetting(current.neutral, zone, settingKey, value)
    })

    const updated = await tx.query<{ id: string }>(parameterizedUpdateSql, [
        JSON.stringify(nextConfig),
        now,
        userId ?? null,
        layoutId,
        expectedVersion
    ])
    if (updated.length !== 1) throw this.createConflictError('Layout was modified by another request')
})
```

Dynamic identifiers remain behind `qSchemaTable`/the existing SQL helpers;
every user/request value is a bind parameter. The exact SQL should reuse the
current service helpers and lock order instead of creating a parallel store
path merely for this feature.

### Phase 3 - Snapshot preflight, publication and restore

-   [x] Update snapshot serialization to encode semantic `zoneSettings` in the
        existing layout `config` carrier while omitting application-only
        `sourceZoneSettings`.
-   [x] Preserve existing snapshot-v1 top-level composition fields and remap
        `baseLayoutId` through the canonical codec/serializer path.
-   [x] Update marketing snapshot validation to strict-decode neutral metadata
        **before** `parseApplicationLayoutConfig()`.
-   [x] Update shared snapshot layout normalization/restore so malformed reserved
        metadata is rejected during preflight before destructive writes begin.
-   [x] Ensure same-template overlay lineage and independent layout ownership
        survive export/import without flattening sparse settings accidentally.
-   [x] Update the marketing-page template seed in place: atomic brand/navigation/
        auth/language/color widgets with their logical placement/default order and
        `marketing-header.position=fixed`. Do not bump the template version.
-   [x] Preserve UUID v7 for every newly persisted row created during restore,
        copy or seed materialization.

Required Jest evidence:

-   non-default `flow` export -> import -> snapshot decode round-trip;
-   malformed `__layout` aborts before restore writes;
-   no application-only `sourceZoneSettings` leaks into publication;
-   overlay sparse override and base lineage preserved;
-   independent layout exports an explicit effective/default setting;
-   widget Start/End placement survives snapshot remap;
-   missing base remains fail closed.

### Phase 4 - Application persistence, source baseline, sync and hashing

-   [x] Add strict application mutation schemas for zone-setting update/reset.
        Reuse shared descriptor/value schemas and require `expectedVersion`.
-   [x] Add application routes adjacent to layout mutations:
        `PATCH /:applicationId/layouts/:layoutId/zone-settings/:zone/:settingKey`
        and `POST .../reset`.
-   [x] Add `updateApplicationLayoutZoneSetting` and
        `resetApplicationLayoutZoneSetting` store operations. Lock/guard the
        entire layout row with existing `_upl_version`; do not add a setting-level
        version counter.
-   [x] Keep the existing `/:layoutId/config/reset` endpoint strictly for whole
        marketing appearance reset. Do not overload it with Zone Settings. Its
        implementation must reset only renderer appearance while preserving
        `__layout.composition`, `zoneSettings` and `sourceZoneSettings`.
-   [x] Require application owner/admin for mutations under the existing control
        panel policy. Cross-application/layout mismatches fail closed as `404`;
        stale version becomes the existing typed `409`.
-   [x] During initial materialization of metahub-derived layouts, store source
        effective zone settings as `sourceZoneSettings` and leave local
        `zoneSettings` empty unless an application override exists.
-   [x] Extend `syncApplicationLayouts()` persistence so accepted source updates
        change source hashes/state **and** the source zone-setting baseline in the
        same transaction.
-   [x] For `keep_local`, update only the accepted source baseline plus existing
        source hash/state metadata; preserve local overrides and renderer config.
-   [x] For `overwrite_local`, replace baseline and clear local zone overrides.
-   [x] For `copy_source_as_application`, create the source copy as independent
        application-owned semantic data without `sourceZoneSettings`; keep the
        linked local-modified layout under the existing workflow.
-   [x] For `skip_source` and unresolved conflicts, do not advance the accepted
        zone baseline.
-   [x] Refactor `buildComparableLayout`, remap helpers and effective resolver to
        decode neutral metadata through the canonical codec instead of assuming
        root-level composition fields.
-   [x] Refactor existing `updateApplicationLayout`/appearance-config reset and
        equivalent metahub layout-config writers so they replace renderer config
        through the codec and preserve neutral metadata. A stale or malicious
        renderer-config payload containing `__layout` must fail closed.
-   [x] Refactor `normalizeApplicationLayoutForHash` and source/widget hash helpers
        to hash renderer config + semantic composition + effective zone settings + semantic placement, excluding baseline/provenance bookkeeping.
-   [x] Recompute `local_content_hash` after a targeted reset so it can converge
        to `source_content_hash` when no other local semantic difference remains.

Use a dedicated source-baseline update rather than rewriting an entire local
config during `keep_local`. Conceptually:

```ts
const current = decodeLayoutConfigEnvelope(row.config, { templateKey })

const next = encodeLayoutConfigEnvelope({
    rendererConfig: current.rendererConfig,
    neutral: {
        ...current.neutral,
        sourceZoneSettings: sourceEffectiveZoneSettings,
        zoneSettings: current.neutral.zoneSettings // preserve local override
    }
})

// Persist next + source hashes/state in the same transaction/OCC operation.
```

Required application backend Jest/integration evidence:

-   owner/admin success; forbidden role and cross-scope negative cases;
-   stale update/reset `409`;
-   reset preserves renderer appearance config;
-   ordinary appearance save/reset preserves `composition`, zone settings and
    application `sourceZoneSettings`, and rejects client attempts to overwrite
    the reserved namespace;
-   source baseline established on materialization;
-   clean update, `keep_local`, `overwrite_local`,
    `copy_source_as_application`, `skip_source`;
-   critical sequence: source `flow` -> local `fixed` -> upstream changes ->
    `keep_local` -> reset -> latest accepted source value;
-   two concurrent writers cannot silently overwrite one another;
-   baseline-only change does not create a false local modification;
-   effective position/placement change does change semantic hash.

### Phase 5 - Typed logical placement through authoring, persistence and runtime adapters

-   [x] Do not make clients edit raw `config.__layout`. Extend the existing widget
        move contract with typed `targetPlacement` (or add an equally narrow
        typed placement mutation if implementation review proves extending move
        ambiguous). The backend owns envelope mutation.
-   [x] Preserve `targetZone`, `targetIndex`, `expectedVersion` and add
        `targetPlacement: 'start' | 'end'` for header-capable widgets.
-   [x] Validate that placement is supported for the target zone/widget/template.
        Non-header widgets cannot receive arbitrary placement metadata.
-   [x] For metahub inherited widgets, store a sparse placement override through
        the existing override lineage; reset reveals current base placement.
-   [x] For application inherited widgets, preserve the source placement baseline
        through the existing source widget config/lineage and ensure reset reveals
        source placement without resetting unrelated layout appearance.
-   [x] Refactor ordinary application/metahub widget-config update, batch-update
        and reset paths to replace only renderer widget config while preserving
        `config.__layout.placement`. Dedicated move/placement operations remain
        the only public writers of neutral placement metadata.
-   [x] Update hosted `toMarketingLayoutWidgets()` so it carries decoded typed
        placement and never drops neutral renderer-required metadata.
-   [x] Remove `sharedLayoutWidgets` from marketing runtime props/content.
-   [x] Ensure snapshot, copy, duplicate, disable/enable and reorder all preserve
        placement semantics and deterministic group order.

### Phase 6 - Shared authoring UI and TanStack Query integration

-   [x] Extend `LayoutAuthoringDetails` generically with optional zone actions,
        status and optional logical subgroups. Do not put marketing logic in the
        shared component.
-   [x] Add a reusable Zone Settings dialog/panel built from registry metadata and
        MUI primitives. Reuse `template-mui` dialog-presentation helpers rather
        than cloning another Dialog shell. The first control is a RadioGroup for
        position.
-   [x] Render Start and End subgroups for `marketing-header`; keep the existing
        DnD sensors for pointer/keyboard reorder and expose an explicit move menu
        for Start <-> End so no workflow is drag-only.
-   [x] Add a localized accessible zone Settings button whose name includes the
        zone label in the existing zone heading action area. The heading supports
        generic actions for all zones, while the actual button is rendered only
        for zones declaring settings metadata.
-   [x] Pin the brief's field/option strings in shared EN/RU i18n:
        `Header behavior` / `Поведение шапки`, `Fixed on screen` /
        `Закреплена на экране`, and `Scrolls with page` /
        `Прокручивается вместе со страницей`.
-   [x] Add textual inherited/customized status and reset semantics.
-   [x] Add application API wrappers/mutations and metahub API/hooks for typed
        zone settings. Reuse existing query keys where the layout detail is the
        cache authority.
-   [x] In `ApplicationLayouts.tsx`, follow the current TanStack Query optimistic
        pattern: cancel -> snapshot -> typed optimistic patch -> rollback ->
        invalidate layout list/detail, application diff and runtime queries.
-   [x] Keep mutation state scoped to the affected dialog/action; preserve the
        rest of the authoring surface during save/retry.
-   [x] Keep application/metahub permissions in their existing server-owned
        boundaries. The shared UI receives capability/read-only props; it does not
        infer authorization from client role names.
-   [x] For read-only users, keep the effective setting/inheritance state
        inspectable but render no mutation controls. For unresolved source-sync
        conflict, reuse the existing layout conflict state/copy rather than
        inventing a Zone Settings conflict model.
-   [x] Put genuinely shared authoring labels/options in
        `@universo-react/i18n` EN/RU resources. Keep consumer-specific error copy
        in the respective application/metahub namespaces and template-only
        runtime strings inside `apps-template-mui`.

TanStack Query pattern:

```ts
const mutation = useMutation({
    mutationFn: updateZoneSetting,
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: layoutDetailQueryKey })
        const previous = queryClient.getQueryData<ApplicationLayoutDetailResponse>(layoutDetailQueryKey)
        queryClient.setQueryData(layoutDetailQueryKey, (current) => (current ? applyOptimisticZoneSetting(current, variables) : current))
        return { previous }
    },
    onError: (error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(layoutDetailQueryKey, context.previous)
        notifyLocalizedZoneSettingError(error)
    },
    onSettled: async () => {
        await invalidateLayoutsAndRuntime()
    }
})
```

The optimistic helper operates on typed decoded fields, never a raw JSON editor.

### Phase 7 - Marketing runtime decomposition and Dashboard shared controls

-   [x] Replace the current per-navigation `AppAppBar` ownership with one
        `MarketingHeaderShell` owned by the `marketing-header` zone.
-   [x] Keep the current MUI visual baseline: `Container maxWidth="lg"`, blurred /
        bordered translucent toolbar, theme-aware colors and application-frame
        offset.
-   [x] Refactor marketing normalization so brand and auth are no longer embedded
        inside every `marketing.navigation` runtime widget. Produce independent
        view models for `marketing.brand`, navigation instances and
        `marketing.auth`.
-   [x] Render desktop Start/End groups from effective persisted composition.
        Child widgets render content only; they do not set `position`, top offsets
        or page spacing.
-   [x] Render exactly one banner landmark. Preserve unique named `nav` landmarks
        for repeated navigation widgets.
-   [x] Delete repeated-navigation fixed stack constants/offset calculations and
        old first-navigation language ownership.
-   [x] Render exactly one mobile trigger/Drawer from the shell. Aggregate all
        navigation instances and auth actions in persisted order.
-   [x] Keep compact brand/language/color controls as the only active mobile
        projection of those persisted widgets.
-   [x] Fail closed if the registry permits a header capability for which the
        mobile renderer lacks a defined projection.
-   [x] Implement a focused measured-header hook with `ResizeObserver`, stable
        cleanup and change-only updates. Combine measured header height with the
        application frame offset to derive effective occlusion.
-   [x] In fixed mode, reserve one measured spacer and set scroll padding. In flow
        mode, remove all fixed spacer/occlusion effects.
-   [x] Ensure anchors, focus targets and skip-link target remain visible under
        the fixed header.
-   [x] In Dashboard, add the persisted `colorModeSwitcher` renderer, make shared
        language/color controls singleton, and remove implicit color/language
        ownership branches from Header/AppNavbar/options where they would create
        duplicate persisted controls. Keep Dashboard navigation and responsive
        shell behavior otherwise template-specific.
-   [x] Preserve the `apps-template-mui` package-isolation test: no import from
        `@universo-react/template-mui` or legacy application/metahub frontend
        packages.

Performance requirements:

-   sort/group header widgets with memoized derived data from the effective
    payload, not repeated full-list scans per child render;
-   one `ResizeObserver` for the zone shell, not one per navigation widget;
-   no scroll event loop for header positioning;
-   no synchronous repeated layout reads during render;
-   lazy/conditional Drawer content is acceptable, but accessibility projection
    must remain deterministic;
-   preserve stable keys from persisted instances and avoid remounting controls on
    unrelated layout changes.

### Phase 8 - Deep automated test system

Use each package's existing runner:

-   `@universo-react/types`: Vitest;
-   `@universo-react/apps-template-mui`: Vitest;
-   `@universo-react/applications-frontend`: Vitest;
-   `@universo-react/utils`: Vitest if shared helpers are added there;
-   `@universo-react/template-mui`: Jest;
-   `@universo-react/applications-backend`: Jest through the repository wrapper;
-   `@universo-react/metahubs-backend`: Jest through the repository wrapper;
-   browser flows: Playwright through `tools/testing/e2e/run-playwright-suite.mjs`.

#### Unit and contract tests

-   [x] Registry descriptors serialize without executable schema objects.
-   [x] Neutral layout/widget codec round-trip and strict failure cases.
-   [x] Renderer parser never receives `__layout`.
-   [x] Existing renderer-config update/reset paths preserve neutral layout/widget
        metadata; direct `__layout` injection through renderer mutation schemas is
        rejected.
-   [x] Placement default/validation/cardinality.
-   [x] Marketing runtime component: one banner, atomic header widgets,
        deterministic Start/End order, named repeated nav landmarks, zero control
        when persisted widget is inactive/absent, one Drawer.
-   [x] Dashboard: exactly one language and color-mode projection from persisted
        singleton widgets.
-   [x] Replace tests that intentionally expect multiple AppBars/Drawers.

#### Backend persistence/integration tests

-   [x] Dedicated update/reset zone setting with OCC and RBAC.
-   [x] Cross-application/scope `404`; stale version `409`.
-   [x] Metahub default -> base -> sparse override -> reset; later base update is
        visible after reset.
-   [x] Snapshot preflight fails before destructive writes on malformed reserved
        metadata.
-   [x] Non-default `flow` and widget placement survive snapshot round-trip.
-   [x] Materialization/sync matrix for all four existing resolutions.
-   [x] Source `flow` -> local `fixed` -> upstream update -> `keep_local` -> reset
        -> latest source baseline.
-   [x] Hash ignores source-baseline bookkeeping but reacts to effective settings
        and placement.
-   [x] Two concurrent writers prove whole-layout OCC prevents lost updates.

#### Shared authoring component/integration tests

-   [x] Render the **real** `LayoutAuthoringDetails`; do not mock it for the
        acceptance test.
-   [x] EN/RU Settings dialog labels and fixed/flow RadioGroup.
-   [x] inherited/customized textual status.
-   [x] Save/reset/loading/409/403 states.
-   [x] Read-only effective-value state and localized unresolved sync-conflict
        state, with no enabled mutation controls.
-   [x] focus returns to trigger after close.
-   [x] Start -> End using keyboard/single-pointer action -> reload persists.
-   [x] no raw enum/ID/JSON/CSS leakage.
-   [x] At least one unmocked application consumer integration and one unmocked
        metahub consumer integration so a marketing-only fork cannot pass.

### Phase 9 - Playwright browser truth, screenshots and accessibility

Run browser verification only through the repository E2E harness; do not run
`pnpm dev`. For local database-backed E2E, use the explicitly authorized
minimal Supabase workflow and always stop it in `finally`:

```text
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm build:e2e
... Playwright suites ...
pnpm supabase:e2e:stop
```

Extend existing suites instead of creating a parallel marketing harness:

-   [x] `marketing-page-widget-lifecycle.spec.ts`: atomic widget lifecycle,
        Start/End move, zone setting save/reset and reload.
-   [x] `metahub-global-entity-layouts.spec.ts`: global `flow` -> overlay inherit ->
        local `fixed` -> reset -> inherited `flow`; independent ownership.
-   [x] `marketing-page-snapshot-roundtrip.spec.ts`: set non-default `flow`, export,
        import, link application, resolve effective layout, then prove real flow
        geometry.
-   [x] `application-layout-management.spec.ts`: local override + upstream change
        and the keep/overwrite/copy/skip resolution matrix.
-   [x] `marketing-page-permissions.spec.ts`: owner/admin success, forbidden roles,
        cross-scope `404`, stale `409`, localized browser error states.
-   [x] `cross-template-runtime.spec.ts`: replace all multi-AppBar assertions with
        one zone-shell fixed/flow geometry contract.
-   [x] `cross-template-concurrency.spec.ts`: two writers/OCC around the new
        setting and placement mutations where appropriate.
-   [x] `marketing-page-visual.spec.ts`: real persisted language/color controls,
        one Drawer, skip link, screenshots and accessibility.

Browser oracles must assert behavior before screenshots:

1. `getByRole('banner')` count is exactly one.
2. Repeated navigation landmarks have distinct non-technical accessible names.
3. Fixed mode: measure `banner.getBoundingClientRect()` before and after scroll;
   its top remains stable within tolerance and main/anchor/focus targets are not
   above the actual banner bottom.
4. Flow mode: banner top decreases with scroll and exits the viewport; no fixed
   spacer/scroll-padding residue remains.
5. Re-measure after locale change, responsive wrap, widget reorder/deactivate
   and viewport changes.
6. Run one explicit dynamic-geometry chain:
   `reorder/deactivate header widget -> rendered header height changes -> measured
offset/scroll padding follows the new geometry -> reload -> persisted
composition and the same geometry remain correct`.
7. At 390x844: exactly one menu trigger, `aria-expanded false -> true`, one
   valid `aria-controls` target, one open Drawer, Escape closes it and restores
   focus.
8. Exactly one accessible projection exists per active persisted auth/language/
   theme capability at a given viewport.
9. Real language control changes `html[lang]` **and visible content**, and the
   selection survives reload according to existing runtime behavior.
10. Real color-mode control changes the MUI scheme/presentation and survives
    reload according to existing behavior.
11. Keyboard skip flow: Tab -> Skip to content -> Enter -> visible main ->
    continued keyboard navigation.
12. Verify fixed positioning against the actual application-frame containing
    block after responsive/frame-offset changes; do not infer viewport geometry
    from CSS classes or a static 28px assumption.
13. Axe runs on fixed desktop and with the mobile Drawer open.
14. Reuse shared `runtimeUx.ts` assertions for technical leakage, localized
    validation, semantic controls and page-level overflow.

Visual matrix:

```text
Viewports: 1920x1080, 768x1024, 390x844
Locales:   en, ru
Themes:    light, dark
Positions: fixed, flow
Total:     24 semantic/visual states
```

For every matrix state, run semantic/geometry/overflow assertions before
`toHaveScreenshot`. Keep Playwright traces/screenshots under the existing
artifact convention and **open/inspect the generated screenshots manually**;
a snapshot comparison exit code alone is not visual acceptance.

Update `runMarketingPageVerificationLocalSupabase.mjs` so the canonical
`test:e2e:marketing-page:verify:local-supabase` gate also includes the required
`cross-template-runtime.spec.ts` geometry coverage and
`application-layout-management.spec.ts` sync coverage. Today those suites are
not part of that marketing verification wrapper, which can otherwise produce a
false green result for this feature.

### Phase 10 - Documentation and README updates

-   [x] Update `packages/universo-react-types/README.md` with the neutral envelope,
        reserved-key ownership and registry capability model.
-   [x] Update `packages/universo-react-template-mui/README.md` with generic Zone
        Settings/logical-group authoring and accessibility behavior.
-   [x] Update `packages/universo-react-apps-template-mui/README.md` with the
        isolated one-shell marketing runtime, atomic header widgets, mobile
        projection and measured fixed geometry.
-   [x] Update application/metahub frontend/backend READMEs with typed routes,
        OCC, inheritance, baseline and reset semantics where those READMEs cover
        layouts.
-   [x] Update EN/RU `marketing-page-template.md` with widget taxonomy, Start/End,
        fixed/flow behavior and responsive projection.
-   [x] Update EN/RU `application-layouts.md` with application-local override,
        source baseline, sync resolutions and targeted reset.
-   [x] Update EN/RU `entity-scoped-layouts.md` with sparse same-template zone
        setting inheritance/reset.
-   [x] Update EN/RU `app-template-views.md` if it describes shared controls or
        template runtime boundaries.
-   [x] Add Mermaid diagrams for storage/decode flow and source-baseline
        resolution where they materially improve GitBook understanding.
-   [x] Keep English/Russian pages structurally aligned and run the existing docs
        i18n/link/screenshot gates.

### Phase 11 - Final technical QA and closeout

-   [x] Run Prettier/ESLint for every affected package using package filters.
-   [x] Run affected Jest/Vitest suites, then package builds.
-   [x] Run the full root `pnpm build` after focused builds so workspace consumers
        use the new shared contracts consistently.
-   [x] Run `check:marketing-page-template-contract` and existing runtime package
        boundary checks.
-   [x] Run the complete canonical local-Supabase marketing verification gate and
        the cross-template/concurrency gates required by this change.
-   [x] Open and inspect all newly generated marketing visual snapshots and any
        failure screenshots/traces. Record actual viewport/locale/theme/position
        evidence rather than inferring visual correctness from code.
-   [x] Run the project Thermos/autoreview closeout for correctness/security and
        maintainability; fix CRITICAL/HIGH findings before merge.
-   [x] Run OntoIndex diff verification (`gn_verify_diff` / repository equivalent)
        after code changes to verify only expected symbols/execution flows changed.
-   [x] Run `git diff --check` and verify no schema/template/snapshot version was
        incremented and no compatibility shim/old `sharedLayoutWidgets` path
        remains.

## Verification Commands Used For IMPLEMENT/QA

The following commands were used from the repository root, with filters
where appropriate. The complete evidence is recorded in the closeout section
below; equivalent reruns may be used when source-only documentation changes do
not affect product behavior:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/template-mui test
pnpm --filter @universo-react/apps-template-mui test
pnpm --filter @universo-react/applications-frontend test
pnpm --filter @universo-react/applications-backend test
pnpm --filter @universo-react/metahubs-backend test

pnpm --filter @universo-react/types lint
pnpm --filter @universo-react/template-mui lint
pnpm --filter @universo-react/apps-template-mui lint
pnpm --filter @universo-react/applications-frontend lint
pnpm --filter @universo-react/applications-backend lint
pnpm --filter @universo-react/metahubs-backend lint

pnpm build
pnpm run check:marketing-page-template-contract
pnpm run test:e2e:marketing-page:verify:local-supabase
pnpm run test:e2e:cross-template:verify:local-supabase
pnpm run test:e2e:cross-template:concurrency
pnpm run docs:i18n:check
pnpm exec node tools/docs/check-gitbook-links.mjs
```

If a package does not expose one of the generic script names above, use its
actual existing package script rather than adding a redundant runner just for
this work.

## Security and correctness requirements

-   All persisted/request UUIDs use the existing UUID v7 validators; no UUID v4
    fallback for new rows.
-   Every public mutation uses strict Zod schemas and rejects unknown keys.
-   Dynamic SQL identifiers go only through existing `qSchema*`/`qTable*` helpers;
    request values are parameterized.
-   Mutations fail closed on zero-row/OCC results and return the repository's
    typed `409` semantics rather than silently succeeding.
-   Application authorization remains owner/admin for layout mutation; metahub
    mutation remains `manageMetahub`. The client never substitutes for the server
    authorization check.
-   Cross-application/metahub/layout IDs do not disclose another tenant's layout;
    return the existing not-found/fail-closed behavior.
-   Never log raw layout configs, credentials, publication data or user content as
    part of conflict diagnostics.
-   The reserved `__layout` namespace is system-owned. UI never exposes a JSON
    editor for it and renderer config cannot override it accidentally.
-   Renderer-config and widget-config endpoints accept renderer-owned data only;
    they reject reserved `__layout` input, preserve the currently stored neutral
    envelope when saving/resetting renderer config, and leave neutral placement
    changes to the typed placement/move contract.
-   New Zone Settings mutations reuse the existing layout transaction/advisory-
    lock/row-lock order and `_upl_version` OCC boundary. They do not create a
    second lock family or acquire the same hierarchy in a different order.
-   Snapshot preflight validates the complete reserved metadata graph before
    destructive restore/materialization writes.
-   One transaction owns source-baseline + source-hash/state advancement so a
    crash cannot acknowledge a source hash without retaining the corresponding
    zone-setting baseline.

## Potential Challenges

### Strict renderer parsers versus neutral metadata

`marketingPageConfigSchema` is strict, so a missed decode boundary will reject
otherwise valid layouts. Mitigation: make the canonical codec the only path and
add tests at storage, sync, snapshot and runtime boundaries proving the
renderer never sees `__layout`.

### Existing config writers can erase reserved neutral metadata

Current application and metahub layout/widget config mutations replace whole
JSONB config objects. After `__layout` becomes the neutral carrier, a naive
appearance/widget save or reset could therefore delete zone settings,
`sourceZoneSettings`, composition metadata or widget placement. Mitigation:
make the envelope codec the read-modify-write boundary for every existing
config writer, reject reserved metadata in renderer mutation payloads, and add
regression tests for ordinary save/reset paths as well as the new APIs.

### Mutation lock-order regression

The existing application and metahub layout stores already serialize related
mutations with transactions, advisory/row locks and optimistic versions. A
standalone Zone Settings SQL update could introduce a different lock order or a
lost-update window. Mitigation: implement the new generic setting mutation
inside the existing locked service/store path and test concurrent setting,
appearance and placement writers against the same layout.

### Current metahub scoped layouts copy renderer config

Copying the nested zone settings would freeze inheritance. Mitigation: keep the
existing renderer-config behavior separate and resolve neutral settings with a
sparse overlay algorithm.

### Existing sync accepts a new source hash without retaining new source config

`keep_local` currently lacks the baseline needed for later targeted reset.
Mitigation: add one transactional source-baseline update and verify the exact
`keep_local -> reset` sequence with database tests and Playwright.

### Hash false positives

Hashing raw `config.__layout.sourceZoneSettings` would mark baseline bookkeeping
as a user modification. Mitigation: hash a decoded semantic projection only.

### Existing tests encode obsolete multiple-AppBar behavior

A correct refactor will intentionally break those assertions. Mitigation:
replace them with one-banner/one-Drawer/zone-shell oracles before treating test
failures as regressions.

### Responsive duplicate controls

Dashboard and marketing shells currently contain implicit language/color
ownership logic. Mitigation: make persisted composition authoritative and test
the accessibility tree for exactly one active projection at each viewport.

### Dynamic fixed-header height

Locale, wrapping and widget changes invalidate hard-coded offsets. Mitigation:
one ResizeObserver on the shell plus browser coordinate assertions after each
dynamic change.

### Large visual matrix cost

The 24-state matrix is intentionally broad. Mitigation: seed once per worker/run
where safe, keep browser workers controlled for visual stability, and put
semantic assertions before screenshots so visual reruns are diagnostic rather
than the sole correctness mechanism.

## Dependencies

-   Material UI 9.2.0 behavior for fixed AppBar offset and temporary Drawer is
    part of the runtime contract. Context7 reconfirmed that fixed AppBar is
    removed from normal flow and needs an explicit offset/spacer strategy; the
    temporary Drawer supports Escape dismissal.
-   Playwright 1.58.x role locators, web-first assertions and `toHaveScreenshot`
    are the browser acceptance basis.
-   TanStack Query 5 optimistic mutations use the established cancel -> snapshot
    -> optimistic update -> rollback -> invalidate pattern already present in
    `ApplicationLayouts.tsx`.
-   `@universo-react/apps-template-mui` remains runtime-isolated from
    `@universo-react/template-mui`; only neutral shared packages can cross that
    boundary.
-   Existing application/metahub layout version fields and sync transaction
    boundaries are reused. No new persistence version counter is introduced.

## Implementation and QA closeout evidence

All implementation phases and acceptance items in this plan are complete. The
clean-break contract was preserved: no database schema or migration was added,
no snapshot or metahub-template version was incremented, UUID v7 allocation and
existing RLS/RBAC/OCC boundaries remain authoritative, and the old
`sharedLayoutWidgets`/multi-AppBar composition paths were removed.

-   The shared neutral envelope, registry descriptors, sparse zone inheritance,
    targeted reset, source-baseline bookkeeping, semantic hashing, typed Start/
    End placement, and single-shell marketing runtime are implemented across
    the shared types, metahub, application, authoring, and isolated runtime
    packages.
-   The metahub and application authoring flows use the real shared
    `LayoutAuthoringDetails` and `LayoutZoneSettingsDialog`, with EN/RU labels,
    inherited/customized/read-only/reset/conflict states, keyboard focus
    behavior, owner/admin server authorization, and stale-version handling.
-   Focused and full package evidence passed: applications backend 51 suites /
    884 tests, metahubs backend 99 suites / 1,284 passed with 4 existing
    contract skips, apps-template focused Vitest 7 files / 74 tests, the
    shared Zone Settings Jest suite 3/3, and the affected package type/build
    and lint checks.
-   The canonical local-minimal-Supabase marketing verification passed 13 flow
    tests with one intentional standalone skip and 5 visual-matrix projects.
    The flow suite covers application/metahub permissions, OCC, source sync,
    sparse inheritance, snapshot round-trip, Start/End placement, and fixed /
    flow geometry at desktop, tablet, and mobile sizes. The visual suite covers
    EN/RU light/dark fixed states, responsive flow assertions, real language and
    color controls, screenshots, and axe checks for fixed desktop and the open
    mobile Drawer.
-   The full workspace build passed 36/36 projects. GitBook provenance, EN/RU
    parity for 113 page pairs, screenshot-asset validation, local-link checks,
    the marketing template contract, package isolation, Prettier, and
    `git diff --check` passed. Generated screenshots were inspected from the
    real browser.
-   Final OntoIndex `gn_verify_diff` passed against the complete 137-file dirty
    worktree allowlist (125 tracked changes and 12 untracked additions) and 9
    representative test surfaces, with no unexpected
    files, symbols, impacts, or missing required tests.
-   The separately deployed standalone shell remains an explicit environment
    boundary: its test is intentionally skipped and is not counted as browser
    acceptance evidence when no authenticated standalone shell is configured.
-   The Thermos review findings available in this workspace were fixed. The
    local autoreview helper produced no structured verdict because its Codex
    strict-JSON stream disconnected repeatedly and the Claude fallback API was
    unavailable; no clean external autoreview PASS is claimed.

## Acceptance Checklist

Implementation is complete only when all items below are true:

-   [x] Fresh marketing template creates atomic brand/navigation/auth/language/
        color-mode header widgets with deterministic placement/order.
-   [x] Header zone Settings is visible in both metahub and application authoring
        through the shared `LayoutAuthoringDetails` primitive.
-   [x] The Settings action is rendered in the shared zone-heading action area
        only for zones that declare settings; read-only users can inspect the
        effective/inherited value without mutation controls.
-   [x] Fixed/flow save, inheritance and targeted reset work without touching
        renderer appearance config.
-   [x] Existing appearance/widget config save and reset operations preserve all
        neutral `__layout` metadata, and renderer-config APIs reject direct
        reserved-namespace injection.
-   [x] Same-template metahub overlay reset reveals a later base change.
-   [x] Application `keep_local` retains local value while persisting the latest
        source baseline; reset reveals that baseline.
-   [x] Widget Start/End placement survives reload, snapshot, application sync and
        runtime projection.
-   [x] Marketing runtime contains one banner and one mobile Drawer, regardless of
        the number of navigation widgets.
-   [x] Brand/navigation/auth/language/color are independently activatable and no
        shell silently injects language/color controls.
-   [x] Fixed header uses measured geometry; flow header scrolls away and leaves no
        fixed spacer/padding residue.
-   [x] Reorder/deactivate that changes header height recalculates the measured
        offset immediately and preserves the same correct geometry after reload.
-   [x] Skip links, anchors and focus targets remain visible under fixed header.
-   [x] EN/RU, light/dark, desktop/tablet/mobile and fixed/flow browser matrix is
        semantically asserted and visually inspected.
-   [x] Axe passes fixed desktop and open mobile Drawer states.
-   [x] No page-level horizontal overflow or user-facing raw ID/JSON/internal
        validation leakage.
-   [x] Jest/Vitest/backend integration/Playwright/concurrency suites pass.
-   [x] Canonical marketing verification includes geometry and sync suites.
-   [x] README and EN/RU GitBook documentation describe the final contract.
-   [x] Full root build, package lint/tests, docs checks, OntoIndex diff
        verification, and `git diff --check` pass; Thermos findings were fixed
        and autoreview was executed with its no-structured-verdict environment
        limitation recorded above.
-   [x] No schema, snapshot or metahub-template version was incremented.
-   [x] No legacy `sharedLayoutWidgets`, multi-AppBar stack or dual neutral-metadata
        reader remains.

## Approval Boundary

This plan is closed for implementation review. Product code, tests, seeds,
runtime behavior, documentation, and verification evidence were updated under
IMPLEMENT/QA mode. Remaining environment boundaries are recorded explicitly in
this document and do not represent product debt.
