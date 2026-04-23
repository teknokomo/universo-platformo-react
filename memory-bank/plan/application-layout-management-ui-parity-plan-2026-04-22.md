# Application Layout Management UI Parity Plan (2026-04-22)

## Overview

Rebuild the Application Admin `Layouts` surface so it matches the shipped metahub layout authoring experience instead of using a separate lightweight UI. The application-side feature must preserve the existing runtime-safe lineage and sync model, but the visible list/detail flows, widget authoring UX, dialogs, view-mode behavior, spacing, and interaction patterns must reuse the same shared layout components and authoring patterns that metahubs already use.

The target is not just visual resemblance. The Application and Metahub surfaces should converge on the same extracted core component tree for list/detail authoring, with only thin consumer adapters for data, permissions, lineage, and route wiring.

This plan intentionally treats the current application layouts UI as an intermediate prototype, not as a final contract. The backend merge/safety model stays, while the frontend must be refactored toward true metahub parity and shared ownership in `@universo/template-mui`.

## Current Implementation Gap Summary

### Confirmed UX gaps

- The Application Admin layout list page uses a separate card/list implementation instead of the metahub `LayoutListContent` pattern.
- Shared layout UI extraction into `@universo/template-mui` is still incomplete; detail authoring is now extracted, but list-shell rendering and widget editor dialogs are still not fully shared.
- The actual shell menu is driven by `@universo/template-mui` navigation, while `applications-frontend` still carries a legacy local menu definition. This already caused one shipped regression and shows the current ownership boundaries are blurred.
- Current Playwright coverage proves application-side browser flows and stores screenshots, but it still does not enforce automated screenshot/DOM parity between Metahub and Application surfaces.

### Confirmed code seams

- Metahub list UI already has a reusable core: `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutList.tsx` exports `LayoutListContent`.
- Metahub detail UI now already consumes the extracted shared authoring core: `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutDetails.tsx`.
- The repo already standardizes on `@dnd-kit/core` / `@dnd-kit/sortable`, so no new drag-and-drop library is needed.
- Application layout backend contracts already exist and are good enough to support a richer UI, but the frontend contracts are currently too application-specific and too far from the metahub authoring surface.

## Design Goal

Deliver one shared layout authoring system:

- shared list shell;
- shared list card/table row rendering contract;
- shared detail authoring shell;
- shared zone column + drag-and-drop widget authoring;
- shared widget edit dialog entrypoints;
- shared provenance/state chips;
- consumer-specific data adapters for Metahub and Application surfaces.

The application page should look and behave like the metahub page unless a difference is required by application-specific concerns such as:

- source badges (`Metahub` vs `Application`);
- sync state badges (`Clean`, `Conflict`, `Source removed`, etc.);
- source conflict resolution info;
- application-scope filtering and runtime-schema availability states.

The previous failure happened because the Application surface was built as a parallel custom UI instead of a reused authoring surface. This plan must explicitly prevent that outcome.

## Affected Areas

### Frontend packages

- `packages/universo-template-mui/base`
  - add shared layout list/detail authoring components
  - add shared layout widget row, zone column, header actions, and dialog launcher contracts
  - add shared layout test helpers/selectors where useful
- `packages/metahubs-frontend/base`
  - refactor existing metahub layout list/detail pages to consume extracted shared components
  - keep metahub-specific API hooks, inheritance logic, and permission wiring in metahubs
- `packages/applications-frontend/base`
  - replace the current custom `ApplicationLayouts.tsx` list/detail UI with the shared authoring system
  - add application-specific adapters for lineage/sync-state/source actions
  - preserve existing connector diff dialog and application-side mutations
- `packages/universo-core-frontend/base`
  - verify route shell and breadcrumbs stay aligned after UI refactor
- `packages/universo-i18n/base`
  - move repeated shared layout strings out of package-local JSON where appropriate

### Shared contracts and utilities

- `packages/universo-types/base`
  - add shared frontend-facing layout authoring types if current metahub/application page props are too divergent
- `packages/universo-utils/base`
  - add tiny shared helpers only where they reduce duplication between metahub/application authoring adapters

### Backend and API

- `packages/applications-backend/base`
  - may need small response enrichments if the shared UI needs stronger parity fields
  - keep SQL-first safety model and current sync guarantees
- `packages/metahubs-backend/base`
  - likely no functional change unless shared UI extraction reveals missing symmetry in widget catalog/detail payloads

### Docs and tests

- `docs/en`, `docs/ru`
  - GitBook guides for application layouts
  - architecture notes for shared layout authoring ownership
- `packages/*/README.md`
  - update package ownership and UI parity notes
- `tools/testing/e2e`
  - add or replace Playwright proofs for visual and interaction parity

## Key Architecture Decisions

### 1. The shared source of truth must live in `@universo/template-mui`

Any UI reused by both Metahubs and Applications must move into `@universo/template-mui`, not remain inside `metahubs-frontend`. Consumer packages should provide:

- data loading;
- mutation callbacks;
- permission flags;
- page-level route/breadcrumb wiring;
- consumer-specific badges/actions;
- consumer-specific empty states.

Acceptance rule:

- a feature is not considered shared while the same layout/markup/interaction still exists in both `metahubs-frontend` and `applications-frontend`, even if the visuals look close.

### 2. Keep backend ownership separate from UI ownership

The backend application layout model already carries provenance and conflict semantics. The shared UI layer must not reimplement merge logic or infer lineage from presentation state. It should render consumer-provided state and invoke explicit callbacks.

### 2.1. Prefer extraction of existing metahub components over invention of new shells

The default strategy is:

- move the existing `LayoutListContent` and `LayoutDetails` implementation seams into `@universo/template-mui`;
- preserve existing markup, selectors, spacing, and interaction semantics;
- keep Metahub and Application packages as thin adapter layers.

Do **not** start by designing a large new library of speculative `LayoutAuthoring*` abstractions unless direct extraction proves impossible due to package-boundary or data-shape constraints.

### 3. Reuse the existing drag-and-drop stack

Use the already adopted `@dnd-kit/core` and `@dnd-kit/sortable`. Do not introduce another DnD library. The metahub detail page already proves this stack fits the repository.

### 4. Eliminate local menu duplication during the same pass

The stale `applications-frontend/src/menu-items/applicationDashboard.ts` contract is now a liability. The plan should either:

- remove it if unused, or
- reduce it to a compatibility shim with a clear deprecation note and tests proving the canonical menu lives in `@universo/template-mui`.

## Implementation Plan

### Phase 0 — Discovery, parity inventory, and screenshot baseline

- [ ] Capture a fresh UI inventory of the metahub layouts list and metahub layout details screen using the Playwright CLI runner on port `3100`.
- [ ] Capture matching screenshots for the current application layouts list/details screens.
- [ ] Run the baseline on a real LMS-derived application created from `tools/fixtures/metahubs-lms-app-snapshot.json`, not only on minimal synthetic fixtures, so the parity matrix reflects the real widget mix and scope behavior seen by users.
- [ ] Write a parity matrix covering:
  - header layout;
  - card/list toggle behavior;
  - search/filter behavior;
  - empty/loading/error states;
  - layout card actions;
  - detail header actions;
  - zone rendering;
  - widget row rendering;
  - add-widget flow;
  - drag-and-drop behavior;
  - widget edit dialogs;
  - source/sync-state badges.
- [ ] Freeze screenshot artifacts for this phase so later Playwright assertions compare against real UI, not assumptions.

### Phase 1 — Extract shared list authoring shell into `@universo/template-mui`

- [ ] Move the metahub `LayoutListContent` implementation into `@universo/template-mui` with the smallest safe structural change, preserving the current visual hierarchy and behavior.
- [ ] Preserve the existing card/list toggle behavior, search flow, pagination shape, card actions, and spacing from the metahub screen.
- [ ] Introduce new shared list primitives only when they emerge naturally during extraction; do not pre-split the screen into a large new component taxonomy up front.
- [ ] Design new props/interfaces only where the existing metahub contract cannot cross package boundaries cleanly.
- [ ] Keep provenance and sync-state rendering in the shared layer through generic chip/action slots, not hardcoded metahub logic.
- [ ] Refactor the metahub list page to consume the new shared list shell first.
- [ ] Only after metahub parity stays green, wire the application list page to the same shared shell.
- [ ] Remove or deprecate any remaining bespoke application list rendering branch once the shared list shell lands; no parallel shipped list UIs may remain.

Example shared list contract:

```ts
type SharedLayoutListItem = {
  id: string
  title: string
  description?: string | null
  scopeLabel: string
  isActive: boolean
  isDefault: boolean
  badges: Array<{
    key: string
    label: string
    color?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  }>
  pending?: boolean
}

type LayoutAuthoringListPageShellProps = {
  title: string
  items: SharedLayoutListItem[]
  view: 'card' | 'list'
  loading?: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onCreate: () => void
  onOpen: (layoutId: string) => void
  onAction: (layoutId: string, action: 'edit' | 'copy' | 'delete' | 'setDefault' | 'toggleActive') => void
}
```

### Phase 2 — Extract shared detail authoring shell and widget-zone editor

- [ ] Move the metahub `LayoutDetails.tsx` editor into `@universo/template-mui` as the canonical shared authoring surface with minimal markup churn.
- [ ] Preserve the existing drag-and-drop widget rows, zone columns, add-widget menu placement, behavior panel, and icon/action layout instead of redesigning them for Applications.
- [ ] Extract small reusable pieces from `LayoutDetails.tsx` only where they are already distinct seams in the existing code.
- [ ] Keep consumer-specific dialog openers outside the lowest-level primitives, but make the row/actions/rendering identical.
- [ ] Standardize a shared DnD payload contract so Application and Metahub pages both use the same drag/drop semantics.
- [ ] Replace the application detail page’s current zone-specific manual move buttons with the same drag-and-drop zone editor used in metahubs.
- [ ] Keep keyboard-accessible non-drag fallback controls only if the metahub screen already supports them or if accessibility requires them; they should be additive, not a replacement UX.
- [ ] Preserve and reuse the existing selector/test-id contract used by metahub tests (`layout-zone-*`, `layout-widget-*`, widget action selectors) instead of inventing application-only selector conventions.

Example DnD-safe callback contract:

```ts
type SharedLayoutWidgetMoveRequest = {
  widgetId: string
  fromZone: DashboardLayoutZone
  toZone: DashboardLayoutZone
  toIndex: number
  expectedVersion?: number
}

type LayoutAuthoringDetailsShellProps = {
  layoutTitle: string
  zones: Record<DashboardLayoutZone, SharedLayoutWidgetRow[]>
  canManage: boolean
  onMoveWidget: (request: SharedLayoutWidgetMoveRequest) => Promise<void>
  onAddWidget: (zone: DashboardLayoutZone, widgetKey: DashboardLayoutWidgetKey) => Promise<void>
  onToggleWidget: (widgetId: string, active: boolean, expectedVersion?: number) => Promise<void>
  onEditWidget: (widgetId: string) => void
  onDeleteWidget: (widgetId: string, expectedVersion?: number) => Promise<void>
}
```

### Phase 3 — Extract shared widget editor entrypoints and dialog composition

- [ ] Inventory the current metahub widget dialogs:
  - menu widget editor
  - columns container editor
  - quiz widget editor
  - shared widget behavior editor
- [ ] Move the existing dialog UI and validation into `@universo/template-mui` by extraction first; do not replace them with a new application-only editor stack.
- [ ] Keep API submission and consumer-specific data normalization in metahubs/applications packages.
- [ ] Replace the application page’s raw JSON widget config editor with the same dialog-based editor system used by metahubs.
- [ ] Keep a structured JSON fallback only for unsupported widget types, and clearly isolate it behind a shared expert-mode component rather than making it the default editor.
- [ ] Remove application-only dialog copies after extraction unless the dialog truly owns application-specific data that cannot be expressed through shared props.

### Phase 4 — Application-specific adapter layer on top of shared UI

- [ ] Replace the current `packages/applications-frontend/base/src/pages/ApplicationLayouts.tsx` implementation with an adapter-based page using the shared list/detail authoring components.
- [ ] Remove the current bespoke card/detail/widget-management implementation rather than keeping it in parallel behind alternate branches or duplicated routes.
- [ ] Add an application-specific view model mapper that transforms application layout DTOs into the shared list/detail item contracts.
- [ ] Preserve application-only capabilities:
  - source badge (`Metahub` / `Application`)
  - sync-state badge
  - source metadata panel
  - source conflict/exclusion info
  - scope filtering by runtime object
  - schema-not-ready empty state
- [ ] Keep application-only actions explicit:
  - exclude metahub-origin layout
  - soft-delete application-owned layout
  - create application-owned copy
  - mark as default
  - activate/deactivate
- [ ] Ensure detail headers and action bars visually match the metahub surface while still showing application lineage information.

### Phase 5 — Backend/API alignment for UI parity

- [ ] Review whether the shared detail UI needs fields not currently returned by application layout detail routes, for example:
  - richer widget display labels;
  - widget inheritance markers;
  - linked collection presentation labels;
  - stronger widget behavior/config payload typing.
- [ ] If fields are missing, extend the application API instead of adding frontend heuristics.
- [ ] Keep all backend changes SQL-first, schema-qualified, parameterized, optimistic, and transaction-safe.
- [ ] Re-check deletion/copy/default flows after the UI refactor to ensure no UI path bypasses `expectedVersion`.

Example safe mutation pattern to preserve:

```ts
await executor.query(
  `
  UPDATE ${qSchemaTable(schemaName, '_app_widgets')}
  SET is_active = $2,
      _upl_updated_at = NOW(),
      _upl_updated_by = $3,
      _upl_version = COALESCE(_upl_version, 1) + 1
  WHERE id = $1
    AND ($4::int IS NULL OR COALESCE(_upl_version, 1) = $4)
    AND _upl_deleted = false
    AND _app_deleted = false
  RETURNING id
  `,
  [widgetId, isActive, userId, expectedVersion ?? null]
)
```

### Phase 6 — Navigation, i18n, and ownership cleanup

- [ ] Remove or deprecate duplicate application sidebar menu declarations so the canonical shell menu remains in one place.
- [ ] Remove or deprecate any remaining legacy application-layout UI exports/helpers that would allow the old bespoke surface to drift back in later work.
- [ ] Move truly shared layout UI strings into `packages/universo-i18n` where they are used by both Metahubs and Applications.
- [ ] Keep package-local strings only for consumer-specific copy such as conflict/source messages.
- [ ] Re-check breadcrumbs and page titles for the application routes after the UI replacement.

### Phase 7 — Test system rebuild for UI parity

- [ ] Expand Jest coverage in `@universo/template-mui` for:
  - shared list shell rendering
  - shared detail shell rendering
  - drag-and-drop reorder callbacks
  - add-widget menu behavior
  - badge rendering
  - consumer-specific action slot rendering
- [ ] Expand Vitest coverage in `applications-frontend` for:
  - application adapter mapping
  - schema-not-ready state
  - source/sync-state panels
  - copy/delete/default/active flows using shared UI
  - widget editor dialog wiring
- [ ] Expand existing metahub tests to guarantee refactor parity rather than only application behavior.
- [ ] Add Playwright browser proofs for both surfaces:
  - metahub layouts list/detail
  - application layouts list/detail
  - screenshot comparisons of header/card/table spacing and main action locations
  - screenshot comparisons on LMS-derived data that confirm the same primary list/detail UI elements appear in both surfaces
  - drag-and-drop widget reorder in applications
  - add/edit/delete/toggle widget flows in applications
  - list card rendering with badges in applications
  - connector sync conflict flow followed by inspection of the shared application layouts UI
- [ ] Add one visual parity e2e assertion that compares stable selectors and layout width/spacing contracts between metahub and application pages.
- [ ] Treat screenshot capture without an explicit parity assertion as insufficient; CI should fail when list/detail structure drifts again.

### Phase 8 — Documentation and README refresh

- [ ] Update `docs/en/guides/application-layouts.md` and `docs/ru/guides/application-layouts.md` to describe the real parity UI and shared authoring behavior.
- [ ] Update GitBook `SUMMARY.md` entries only if page structure changes.
- [ ] Update package READMEs:
  - `applications-frontend`
  - `metahubs-frontend`
  - `universo-template-mui`
- [ ] Document that shared layout authoring UI lives in `@universo/template-mui`, while consumer packages own API adapters and route wiring.

## Additional Refactoring Targets

- [ ] Audit whether `packages/applications-frontend/base/src/menu-items/applicationDashboard.ts` should be deleted or converted into a compatibility export that delegates to canonical menu config.
- [ ] Audit whether `LayoutListContent` and `LayoutDetails` exports from `metahubs-frontend` should shrink to adapter wrappers around shared `template-mui` components.
- [ ] Audit whether any newly introduced shared type/interface is genuinely required; remove speculative abstractions that do not reduce duplication in both consumers.
- [ ] Audit docs and READMEs that currently overstate application layout completeness and align them with the refactored shared authoring architecture.

## Potential Challenges And Mitigations

### Challenge 1 — Metahub detail UI is not yet cleanly separable

`LayoutDetails.tsx` currently mixes:

- DnD mechanics,
- widget row rendering,
- layout behavior settings,
- dialog state,
- consumer-specific API calls.

**Mitigation**

Refactor in layers:

1. move existing UI pieces almost as-is into `template-mui`;
2. split only the seams that are necessary for package isolation or shared testing;
3. keep thin metahub/application adapter containers in their own packages.

### Challenge 2 — Application DTOs may not match metahub visual needs

The application APIs were shaped around the first implementation pass, not parity reuse.

**Mitigation**

Do not patch gaps in the frontend with guesswork. Extend DTOs and typed responses where needed.

### Challenge 3 — Drag-and-drop parity can regress on accessibility or test stability

**Mitigation**

- keep stable `data-testid` contracts for zone and widget rows;
- keep keyboard-visible action buttons where appropriate;
- validate with Playwright screenshots and direct browser interactions, not only unit tests.

### Challenge 4 — Shared extraction can create cyclic dependencies

**Mitigation**

`@universo/template-mui` must depend only on shared types/utilities, never on `metahubs-frontend` or `applications-frontend`. Consumer packages may wrap shared components, but the dependency direction must stay one-way.

## Acceptance Criteria

- Application `Layouts` list visually matches the metahub list pattern for cards/table/header/controls.
- Application layout details visually and behaviorally match the metahub widget authoring pattern.
- Application and Metahub list/detail pages share the same extracted core implementation instead of maintaining two separate authoring UIs.
- The default application widget editing path uses structured dialogs, not raw JSON editing.
- Widget editor dialogs are shared or clearly proven to be consumer-specific thin wrappers over shared dialog content.
- Shared authoring UI lives in `@universo/template-mui`.
- Metahub and Application pages both consume the shared authoring system.
- Existing backend lineage/sync safety remains intact.
- Tests cover shared UI, application adapters, metahub adapters, and real browser flows.
- Playwright enforces automated parity proof for the main list/detail UI regions instead of relying only on manually inspected screenshots.
- GitBook docs and touched READMEs match the shipped behavior.

## Recommended Delivery Order

1. Phase 0 baseline and parity matrix
2. Phase 1 shared list extraction
3. Phase 2 shared detail extraction
4. Phase 3 dialog extraction
5. Phase 4 application adapter rewrite
6. Phase 5 backend alignment
7. Phase 6 cleanup
8. Phase 7 tests
9. Phase 8 docs

## Notes On External Research

No external web research is required to start this plan. The repository already contains:

- the shipped metahub UI that defines the target interaction model;
- the current application UI that demonstrates the gap;
- the existing DnD library choice;
- Playwright infrastructure for live screenshot-based verification.

If implementation reveals ambiguity around MUI or `@dnd-kit` best practices, consult official docs only and keep the library surface unchanged.
