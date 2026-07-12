# Interpretation Network Hierarchical Table Navigation Plan

> Created: 2026-07-10
> Status: Draft for discussion
> Mode: PLAN
> Source research: `memory-bank/research/interpretation-network-hierarchical-table-navigation-research-2026-07-10.md`
> Source brief: local Platformo Interpretation Network hierarchical table brief tracked outside the repository

## Overview

Implement a new default Matrix Table projection for the Interpretation Network runtime where the hierarchy path is represented by clickable breadcrumbs and the current hierarchical context provides table row labels. The existing independent row/column table remains available as a secondary configurable projection, but the implementation may be refactored substantially because no legacy code shape needs to be preserved.

The implementation must stay template-first: canonical defaults live in the Interpretation Network metahub template, deployed-instance overrides live in Application Settings, and day-to-day structure/cell/material authoring remains in the published application workspace. The published app must continue to use `packages/universo-react-apps-template-mui` primitives and visual style, with no dependency on legacy template or feature packages.

## Source Inputs

-   `memory-bank/research/interpretation-network-hierarchical-table-navigation-research-2026-07-10.md`
-   local Platformo Interpretation Network hierarchical table brief tracked outside the repository
-   Prior research:
    -   `memory-bank/research/interpretation-network-matrix-settings-research-2026-07-03.md`
    -   `memory-bank/research/interpretation-network-matrix-table-view-research-2026-07-07.md`
-   Historical comparison only:
    -   `.backup/elm-suz-dal-master`
    -   `https://lmn.rs/`
-   Current docs checked during planning:
    -   MUI Breadcrumbs via Context7 `/websites/mui_material-ui`: `maxItems`, `itemsBeforeCollapse`, `itemsAfterCollapse`, `expandText`, `aria-label`
    -   MUI Table via Context7 `/websites/mui_material-ui`: `TableContainer`, `Paper`, `Table`, `TableHead`, `TableBody`, `stickyHeader`, constrained scrolling
    -   Playwright via Context7 `/websites/playwright_dev` and `/microsoft/playwright`: web-first assertions, role/label/test-id locators, screenshots, trace artifacts

## Decisions Locked For Implementation

1. **Table projection is explicit.**
   Add `tableProjection: 'hierarchicalPath' | 'independentAxes'`.

    - Default for Interpretation Network: `hierarchicalPath`.
    - `hierarchicalPath` is valid only with `matrixMode: 'hierarchicalCells'`.
    - `independentAxes` keeps the previously built row/column table behavior available as a secondary setting.
    - If `matrixMode: 'independentRows'`, normalization forces `tableProjection: 'independentAxes'`.

2. **Breadcrumb depth is explicit and normalized.**
   Use a discriminated config:

    ```ts
    export type InterpretationNetworkBreadcrumbDepth = { mode: 'full' } | { mode: 'last'; count: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 }
    ```

    Default is `{ mode: 'full' }`. Finite mode shows only the last `count` path items and an ellipsis/expand control before them.

3. **Breadcrumb truncation is tail-first.**
   Do not rely blindly on the MUI default collapse behavior because MUI defaults keep both a prefix and suffix. Implement a small pure helper that returns `hiddenPrefix` plus the visible tail, then render it with MUI `Breadcrumbs`, `IconButton`/`Menu`, localized `expandText`, and `aria-label`.

4. **Breadcrumb navigation updates real focus.**
   A breadcrumb click sets the focused/selected cell to that ancestor and synchronizes table rows, visible child cells, focused title, route state, and the material/details pane. It must not be a separate visual-only breadcrumb state.

5. **Focused cell is route-stable.**
   Extend the existing structure route state with a bounded focused-cell query value. The value may be an internal ID in the URL, but it must never be displayed as a normal user-facing label. Invalid or stale values are ignored and repaired to the exactly-one-root fallback or localized repair state.

6. **Root handling is not silent-first-root.**

    - Exactly one root cell: auto-focus it on structure open.
    - No root cell: show localized recovery/empty state.
    - Multiple root cells: show localized repair/ambiguous state, keep actions safe, and do not silently choose the first root.

7. **Hierarchical Table does not use independent empty-slot DnD.**
   In `hierarchicalPath` projection, do not render Add row/Add column controls or empty row/column intersection drop slots. Cell-to-cell reorder/child/sibling moves can continue through existing dnd-kit/menu flows where valid. Empty-slot DnD remains part of `independentAxes`.

8. **Toolbar layout is required scope.**
   Add `toolbarLayout: 'horizontal' | 'vertical'`. Default remains `horizontal`. `vertical` is opt-in and must expose the same actions, labels, disabled states, and keyboard path.

9. **No schema/template version bump.**
   The test database can be recreated. Update TypeScript/Zod widget config schemas, template defaults, fixture contract, and generated snapshot in place without increasing database schema or metahub template versions.

10. **No product-specific naming.**
    Do not mention historical product names in code, tests, i18n keys, fixtures, or docs. Use generic terms: Interpretation Network, Matrix, Table, Structure, Material, breadcrumb/path, hierarchical projection, independent axes.

## Affected Areas

-   `packages/universo-react-types`
    -   `src/common/applicationLayouts.ts`
    -   `src/__tests__/applicationLayouts.test.ts`
    -   README files
-   `packages/universo-react-apps-template-mui`
    -   `src/dashboard/components/interpretation-network/model.ts`
    -   `src/dashboard/components/interpretation-network/workspace/useInterpretationNetworkWorkspaceState.ts`
    -   `src/dashboard/components/interpretation-network/workspace/useStructureRoute.ts`
    -   `src/dashboard/components/interpretation-network/workspace/MatrixWorkspace.tsx`
    -   `src/dashboard/components/interpretation-network/workspace/MatrixWorkspaceBridge.tsx`
    -   `src/dashboard/components/interpretation-network/workspace/MatrixTableView.tsx`
    -   new local workspace components/helpers for breadcrumbs and hierarchical table projection
    -   i18n files under `src/i18n/locales/en` and `src/i18n/locales/ru`
    -   focused model/component tests
    -   README files
-   `packages/universo-react-applications-backend`
    -   runtime child-row move/update behavior only if existing move semantics need backend contract tests
-   `packages/universo-react-applications-frontend`
    -   `src/pages/ApplicationSettings.tsx`
    -   `src/pages/application-settings/MatrixSettingsPanel.tsx`
    -   `src/pages/__tests__/ApplicationSettings.test.tsx`
    -   i18n files if the package owns labels locally
    -   README files
-   `packages/universo-react-metahubs-backend`
    -   `src/domains/templates/data/interpretation-network.template.ts`
    -   `src/tests/interpretationNetworkTemplateShape.test.ts`
    -   README files
-   `tools/testing/e2e`
    -   fixture generator, fixture contract, drift checker
    -   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
    -   flow and visual specs for the imported Interpretation Network app
-   `docs/`
    -   GitBook English and Russian docs for Interpretation Network runtime behavior, Application Settings, fixture/testing workflow, and architecture notes.

## UI Contract

### Matrix Workspace Screen

-   Shows the current Structure and Matrix without raw UUID/CID labels, raw JSON, internal field names, or historical diagnostics such as file addresses, child-cell addresses, or tree addresses.
-   Auto-focuses the single root cell for hierarchical matrices.
-   Shows localized no-root and multi-root repair states when root focus cannot be inferred.
-   Keeps page-level horizontal overflow forbidden at `1920x1080`, `768x1024`, and `390x844`; internal table scroll is allowed only inside the table container.

### Hierarchical Matrix Table

-   Displays a focused title, breadcrumb path, hierarchy-derived row labels, and visible child cells for the focused context.
-   Does not show independent-axis `Rows`, `Add row`, `Add column`, or empty intersection controls in `hierarchicalPath`.
-   Uses existing `apps-template-mui` dashboard spacing and MUI `TableContainer`/`Paper`/`Table` patterns with stable dimensions, constrained scroll, semantic table roles, and no nested card layout.
-   Cell buttons show labels, optional position labels, style colors/borders, material counts, action menu, and keyboard focus states.
-   Table/container-level scrolling may appear inside the constrained table surface; document/page-level horizontal overflow must fail.

### Independent-Axis Matrix Table

-   Remains a secondary `tableProjection: 'independentAxes'` mode, not the Interpretation Network default.
-   Keeps row/column headers, Add row/Add column actions, empty intersection slots, and independent-axis DnD only inside this projection.
-   Uses the same table density, action placement, technical-leakage rules, localization, keyboard path, and constrained-scroll behavior as the hierarchical table.
-   Does not force implementation internals to stay unchanged; only the secondary user-facing behavior must remain available.

### Breadcrumbs And Ellipsis

-   Uses MUI `Breadcrumbs` style and accessibility contract with localized `aria-label` and localized expand text.
-   Full path is default.
-   Finite depth renders `hiddenPrefix` behind an ellipsis menu/control and the last N visible path items.
-   Visible items are keyboard reachable buttons/links with user-facing labels.
-   Current focused item has the correct selected/current semantics and does not require a raw URL/id to understand.

### Application Settings

-   Adds localized controls for `tableProjection`, `breadcrumbDepth`, and `toolbarLayout`.
-   `tableProjection` uses an existing select or segmented-control pattern with `hierarchicalPath` as the Interpretation Network default and `independentAxes` as the secondary option.
-   `breadcrumbDepth` uses a full-vs-finite control: default `full path`; finite mode exposes only allowed count choices (`1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`) and disables the count control while full path is selected.
-   `toolbarLayout` uses an existing select or segmented-control pattern: default `horizontal`, opt-in `vertical`.
-   Keeps `allowedMatrixViews` and `defaultMatrixView` coherent.
-   Disables or normalizes dependent controls with localized explanation when Table is not allowed or when `matrixMode` makes a projection invalid.
-   Uses existing `MatrixSettingsPanel` row/layout patterns: switches/checkboxes for booleans, selects/segmented controls for finite options, concise helper text, disabled states, and no raw Zod messages.

### Toolbar Layouts

-   `horizontal` remains the default and should visually match the current toolbar.
-   `vertical` is opt-in and reuses the same actions and icons; it must not introduce a separate shell.
-   Both layouts must expose view toggle, add-cell/add-child actions, disabled states, tooltips, and keyboard path with equivalent accessible names.

### Details And Material Pane

-   Breadcrumb/table focus changes update the selected cell and therefore the details/material pane.
-   No stale cell details may remain after breadcrumb-up navigation.
-   Material list/table/card surfaces continue to hide structured payloads, resource-source payloads, optional empty resource-source fields, and internal IDs.
-   Optional resource-source fields must not show validation errors before user input.
-   Seeded media/resource/block-content/material object payloads must render as user-facing summaries, previews, chips, counts, or hidden fields; raw object cells and JSON-looking payloads are defects.

### Dialogs And Menus

-   Add-child, edit-cell, delete confirmation, cell action menu, independent-axis row/column dialogs, material create/edit dialogs, and material action menus remain localized and keyboard reachable.
-   Hierarchical table creation uses parent/child semantics, not row/column axis creation.
-   Independent-axis row/column creation remains available only in the secondary projection.
-   Semantic long-text fields such as `description`, `notes`, `summary`, `details`, `body`, `instructions`, `feedback`, and `comment` use multiline controls by default in Structure, Cell, and Material dialogs.
-   Dialogs and menus must not expose editable or visible raw IDs on normal user-facing surfaces.

## Data And Config Contract

Plan the shared contract in `@universo-react/types` first, then consume it from runtime/settings/template code.

Example target shape:

```ts
export const interpretationNetworkTableProjections = ['hierarchicalPath', 'independentAxes'] as const
export type InterpretationNetworkTableProjection = (typeof interpretationNetworkTableProjections)[number]

export const interpretationNetworkToolbarLayouts = ['horizontal', 'vertical'] as const
export type InterpretationNetworkToolbarLayout = (typeof interpretationNetworkToolbarLayouts)[number]

export const interpretationNetworkBreadcrumbDepthSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('full') }).strict(),
    z
        .object({
            mode: z.literal('last'),
            count: z.union([
                z.literal(1),
                z.literal(2),
                z.literal(3),
                z.literal(4),
                z.literal(5),
                z.literal(6),
                z.literal(8),
                z.literal(10),
                z.literal(12)
            ])
        })
        .strict()
])
```

Normalize safely at the boundary:

```ts
export function normalizeInterpretationNetworkTableSettings(input: {
    matrixMode: InterpretationNetworkMatrixMode
    tableProjection?: unknown
    breadcrumbDepth?: unknown
    toolbarLayout?: unknown
}) {
    const tableProjection =
        input.matrixMode === 'independentRows'
            ? 'independentAxes'
            : input.tableProjection === 'independentAxes'
            ? 'independentAxes'
            : 'hierarchicalPath'

    const breadcrumbDepthResult = interpretationNetworkBreadcrumbDepthSchema.safeParse(input.breadcrumbDepth)

    return {
        tableProjection,
        breadcrumbDepth: breadcrumbDepthResult.success ? breadcrumbDepthResult.data : { mode: 'full' as const },
        toolbarLayout: input.toolbarLayout === 'vertical' ? ('vertical' as const) : ('horizontal' as const)
    }
}
```

Use `safeParse` for external/user input and keep localized UI errors in the settings layer. Do not display raw Zod messages.

The shared normalizer in `@universo-react/types` is the single source of truth for settings repair. Runtime `toConfig`, Application Settings parsing, equality checks, save payloads, optimistic cache updates, template tests, and fixture contract checks must call or mirror this shared contract directly instead of maintaining separate ad hoc repair logic.

## Runtime Model Notes

Add pure helpers before UI wiring. Keep them deterministic and testable.

Breadcrumb display helper:

```ts
export type BreadcrumbDisplayItem<T> = {
    item: T
    hidden: boolean
}

export function buildBreadcrumbDisplayItems<T>(
    path: readonly T[],
    depth: InterpretationNetworkBreadcrumbDepth
): { hiddenPrefix: T[]; visibleTail: T[] } {
    if (depth.mode === 'full' || path.length <= depth.count) {
        return { hiddenPrefix: [], visibleTail: [...path] }
    }

    const visibleTail = path.slice(-depth.count)
    return {
        hiddenPrefix: path.slice(0, path.length - visibleTail.length),
        visibleTail
    }
}
```

Focused path lookup should use maps and visited sets:

```ts
export function resolveMatrixPath(cells: readonly MatrixCell[], focusedCellId: string | null): MatrixCell[] {
    const byId = new Map(cells.map((cell) => [cell.id, cell]))
    const focused = focusedCellId ? byId.get(focusedCellId) : undefined
    if (!focused) return []

    const path: MatrixCell[] = []
    const visited = new Set<string>()
    let current: MatrixCell | undefined = focused

    while (current && !visited.has(current.id)) {
        visited.add(current.id)
        path.push(current)
        current = current.parentCellId ? byId.get(current.parentCellId) : undefined
    }

    return path.reverse()
}
```

Route parsing should validate against loaded cells before applying focus:

```ts
export function resolveRouteFocus(routeCellId: string | null, cells: readonly MatrixCell[], rootState: MatrixRootState): string | null {
    if (routeCellId && cells.some((cell) => cell.id === routeCellId)) {
        return routeCellId
    }
    return rootState.kind === 'singleRoot' ? rootState.root.id : null
}
```

Focused-cell route state should stay inside `useStructureRoute` and related workspace runtime helpers. Preserve unrelated query params/hash, support back/forward via the existing route subscription path, and keep the internal focused-cell ID URL-only; accessible names, breadcrumbs, buttons, menus, and dialogs must use labels rather than the raw ID.

Memoize view models from stable inputs:

```ts
const hierarchicalTableModel = useMemo(
    () =>
        buildHierarchicalMatrixTableModel({
            cells: matrixCells,
            focusedCellId,
            breadcrumbDepth: widgetConfig.breadcrumbDepth,
            positionLabels: matrixPositionLabels
        }),
    [matrixCells, focusedCellId, widgetConfig.breadcrumbDepth, matrixPositionLabels]
)
```

## Implementation Steps

### Phase 0 - Preflight And Impact Mapping

-   [ ] Read local package READMEs for each changed package before editing.
-   [ ] Run OntoIndex impact before editing target symbols:
    -   `toConfig`
    -   `normalizeInterpretationNetworkMatrixViewSettings`
    -   `interpretationNetworkWorkspaceWidgetConfigSchema`
    -   `MatrixSettingsPanel`
    -   `ApplicationSettings`
    -   `useInterpretationNetworkWorkspaceState`
    -   `MatrixWorkspace`
    -   `MatrixTableView`
    -   fixture contract helpers
-   [ ] Report any HIGH/CRITICAL blast radius before making code changes.
-   [ ] Confirm no implementation depends on legacy template/feature packages from `apps-template-mui`.

### Phase 1 - Shared Types And Schema

-   [ ] Add `tableProjection`, `breadcrumbDepth`, and `toolbarLayout` constants/types/schemas in `packages/universo-react-types/src/common/applicationLayouts.ts`.
-   [ ] Add normalization helpers for table settings and update strict widget schema.
-   [ ] Update `normalizeInterpretationNetworkMatrixViewSettings` fallback so missing Interpretation Network config aligns with the product default: Table, hierarchical path projection, full breadcrumbs, horizontal toolbar.
-   [ ] Preserve compatibility with deprecated `hierarchyLayout` migration without adding a schema/template version bump.
-   [ ] Extend `packages/universo-react-types/src/__tests__/applicationLayouts.test.ts` for valid defaults, invalid projection/mode combinations, invalid breadcrumb depth, vertical toolbar, and missing-config fallback.

### Phase 2 - Runtime Config Parsing

-   [ ] Extend `InterpretationNetworkWorkspaceConfig` and `DEFAULT_CONFIG` in `apps-template-mui` with the new settings.
-   [ ] Update `toConfig` to normalize all new settings through shared helpers and avoid accepting unknown object payloads as strings.
-   [ ] Ensure `toConfig`, Application Settings parsing, template defaults, and fixture contract all produce the same missing-config fallback: Table, `hierarchicalPath`, full breadcrumbs, horizontal toolbar.
-   [ ] Update `MatrixWorkspaceBridge` and downstream props to carry `tableProjection`, `breadcrumbDepth`, and `toolbarLayout`.
-   [ ] Add unit tests proving runtime parser defaults match the template defaults.

### Phase 3 - Hierarchical Table View Model

-   [ ] Add pure helpers in the interpretation-network model layer:
    -   root-state resolver: no root / single root / multiple roots
    -   focused path resolver
    -   breadcrumb display resolver
    -   `buildHierarchicalMatrixTableModel`
-   [ ] Keep the old row/column table behavior available under a clearer name such as `buildIndependentAxesMatrixTableModel`; refactor `buildMatrixTableModel` only if tests are updated at the same time.
-   [ ] Ensure helpers are O(n) or O(n log n) using `Map`/`Set`; avoid nested scans on every render for large structures.
-   [ ] Use visited sets to prevent cycles or corrupted parent chains from hanging the UI.
-   [ ] Add model tests for root, child, grandchild, duplicate labels, long RU labels, no root, multi-root, cycle tolerance, finite breadcrumb depth, and hidden-ID display mapping.
-   [ ] Add seeded model/test data with material/media/resource/block-content object payloads to prove table and material surfaces render summaries/previews instead of raw objects.

### Phase 4 - Route And Focus State

-   [ ] Extend `useStructureRoute` to include focused cell route state.
-   [ ] Implement focused-cell route handling in `useStructureRoute`/workspace runtime helpers, preserving unrelated query params/hash and handling browser back/forward consistently.
-   [ ] Validate route focus against loaded matrix cells before applying it.
-   [ ] On structure open:
    -   single root -> set focus to root
    -   no root -> localized recovery state
    -   multiple roots -> localized repair/ambiguous state
-   [ ] Breadcrumb clicks call the same focus setter used by cell selection.
-   [ ] Reload/back-forward should preserve a valid focus and repair invalid focus predictably.
-   [ ] Add component/hook tests for route focus, invalid route repair, single-root auto-focus, no-root, and multi-root states.

### Phase 5 - Matrix Workspace UI

-   [ ] Split rendering by `tableProjection`.
-   [ ] Render `hierarchicalPath` Table with:
    -   Matrix breadcrumbs
    -   focused title
    -   hierarchy-derived row labels
    -   visible child cells
    -   no Add row/Add column controls
    -   no independent empty intersection slots
-   [ ] Keep `independentAxes` Table as the secondary mode with row/column headers and axis creation controls.
-   [ ] Before adding a local `MatrixBreadcrumbs`, compare against `NavbarBreadcrumbs.tsx`, `Header.tsx`, and `PageContainer.tsx`; reuse their style contracts where possible. If a local component is still needed, keep it inside `apps-template-mui`, compose MUI Breadcrumbs/Menu/IconButton/Tooltip, and avoid a new runtime shell.
-   [ ] Add `toolbarLayout` rendering in `MatrixWorkspace`; horizontal remains default, vertical is opt-in.
-   [ ] Keep cell action menus, add-child, edit-cell, copy where supported, delete/restore where supported, drag handles, keyboard move fallback, style/color rendering, material counts, disabled states, and permissions coherent.
-   [ ] Verify move behavior explicitly: `hierarchicalPath` disables independent empty-slot DnD but preserves valid cell-to-cell reorder/child/sibling move paths or exposes a localized keyboard/menu fallback; `independentAxes` keeps slot-based row/column moves.
-   [ ] Add component tests for full breadcrumbs, truncated breadcrumbs, ellipsis expansion, breadcrumb-up navigation, focused title update, row-label update, details-pane sync, toolbar layout parity, no independent-axis controls in `hierarchicalPath`, valid move/keyboard fallback behavior, and canonical spacing/density/action placement.

### Phase 6 - Application Settings

-   [ ] Extend `ApplicationSettings.tsx` allowlist, parser, equality check, save payload, cache update, and active-widget propagation for the new settings.
-   [ ] Extend `MatrixSettingsPanel.tsx` with localized controls for:
    -   Table projection
    -   Breadcrumb depth
    -   Toolbar layout
-   [ ] Use existing settings panel primitives and rows; do not introduce a separate settings page, shell, or one-off control system.
-   [ ] Make exact control behavior explicit in tests: projection select/segmented control, full-vs-finite breadcrumb depth with disabled finite count while full is selected, finite count allowlist, and horizontal-default toolbar layout.
-   [ ] Disable or normalize invalid combinations with localized helper text.
-   [ ] Add settings tests proving:
    -   values round-trip through strict schema and save payload
    -   all active `interpretationNetworkWorkspace` widgets are updated consistently
    -   divergent widgets normalize safely
    -   invalid controls do not produce raw Zod/internal messages
    -   vertical toolbar is opt-in and horizontal remains default
-   [ ] Add Application Settings E2E proving `tableProjection`, `breadcrumbDepth`, and `toolbarLayout` save to the materialized widget, survive reload/imported snapshot flow, and visibly affect runtime behavior.

### Phase 7 - Template, Fixture, And Snapshot

-   [ ] Update `interpretation-network.template.ts` widget defaults:
    -   `matrixMode: 'hierarchicalCells'`
    -   `allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree']`
    -   `defaultMatrixView: 'table'`
    -   `tableProjection: 'hierarchicalPath'`
    -   `breadcrumbDepth: { mode: 'full' }`
    -   `toolbarLayout: 'horizontal'`
    -   `allowNewAxesInCellDialog: false`
-   [ ] Update `interpretationNetworkTemplateShape.test.ts`.
-   [ ] Update and run `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts` so the Playwright generator itself emits and verifies the new defaults.
-   [ ] Update `interpretationNetworkFixtureContract.ts` and drift checks for the new defaults, no diagnostic-address leakage, and no unrelated dashboard/demo/LMS widgets in the product snapshot.
-   [ ] Regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` through the Playwright generator; do not hand-edit it as the source of truth.
-   [ ] Prefer hosted wrapper-owned E2E for fixture validation. Run the local Supabase minimal fixture gate when hosted E2E is unavailable, when local-Supabase workflow is under test, or when final release confidence requires a local database proof; stop/cleanup the local Supabase stack after the run.

### Phase 8 - E2E And Visual Test Oracles

-   [ ] Split old Matrix Table assertions:
    -   default oracle: hierarchical breadcrumb Table
    -   secondary oracle: independent-axis Table under explicit `tableProjection: 'independentAxes'`
-   [ ] Extend `interpretation-network-app-imported-snapshot.spec.ts` for:
    -   open imported snapshot
    -   auto-focus root
    -   descend root -> child -> grandchild
    -   verify breadcrumbs/path chips
    -   verify hierarchy-derived rows/cells
    -   verify right material/details pane
    -   create child in `hierarchicalPath`
    -   edit cell in `hierarchicalPath`
    -   copy cell if supported, or assert clearly that copy is not exposed
    -   delete/restore cell if supported, or assert clearly that restore is not exposed
    -   verify visible table/details/material state after each lifecycle step
    -   verify valid move behavior or localized keyboard/menu fallback in `hierarchicalPath`
    -   verify `independentAxes` keeps slot-based move/add-row/add-column behavior only in the secondary projection
    -   create/edit material from the focused context
    -   configure finite breadcrumb depth
    -   save `tableProjection`, `breadcrumbDepth`, and `toolbarLayout` in Application Settings
    -   reload/import the snapshot and verify those settings affect runtime behavior
    -   click breadcrumb upward
    -   reload/back-forward coherence
    -   switch to independent-axis secondary mode
-   [ ] Extend visual spec screenshots for the implemented hierarchical path, not only the empty workspace.
-   [ ] Require screenshots at `1920x1080`, `768x1024`, and `390x844`, after settled visible locators and with a nonblank/meaningful-content assertion before attaching artifacts.
-   [ ] Add EN and RU E2E checks for labels, tooltips, validation, ellipsis expand text, settings labels, and no raw internal errors.
-   [ ] Add `expectSemanticFieldControls` checks for Structure, Cell, and Material dialogs in EN/RU so description-like fields are multiline.
-   [ ] Add optional resource-source empty-state checks proving empty optional resource fields do not show premature errors.
-   [ ] Add fixture rows/materials containing media/resource/block-content object payloads and assert they render as previews/summaries/chips/counts or stay hidden, never as raw JSON/object text.
-   [ ] Add negative leakage assertions for:
    -   `Адрес файлов`
    -   `Адрес дочерних ячеек`
    -   tree/file address text
    -   UUID-only labels
    -   CID-like hashes
    -   raw JSON-looking payloads
    -   `[object Object]`
    -   internal field names
    -   raw Zod/internal validation phrases
-   [ ] Run leakage checks with `checkUuidSubstrings: true` on Matrix, breadcrumbs, details/material pane, settings panel, dialogs, and visible menus; also scan accessible names/ARIA labels for UUID/CID/internal ID leakage.
-   [ ] Add a primitive-reuse UX oracle that fails one-off nested-card shells, non-semantic fake tables, missing breadcrumb navigation semantics, or action placement that diverges from the existing dashboard pattern without documented product justification.

### Phase 9 - Documentation

-   [ ] Update package READMEs:
    -   `packages/universo-react-apps-template-mui/README.md` and `README-RU.md`
    -   `packages/universo-react-applications-frontend/README.md` and `README-RU.md`
    -   `packages/universo-react-types/README.md` and `README-RU.md`
    -   `packages/universo-react-metahubs-backend/README.md` and `README-RU.md`
-   [ ] Update GitBook docs:
    -   `docs/en/guides/interpretation-network.md`
    -   `docs/ru/guides/interpretation-network.md`
    -   `docs/en/architecture/interpretation-network-data-model.md`
    -   `docs/ru/architecture/interpretation-network-data-model.md`
    -   Application/settings references under `docs/en/platform/applications.md` and `docs/ru/platform/applications.md` if needed
-   [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if new pages are added.
-   [ ] Keep English/Russian docs structurally synchronized.
-   [ ] Document the local Supabase E2E fixture workflow and screenshot expectations where relevant.

### Phase 10 - Final QA And Review

-   [ ] Run focused unit/component tests.
-   [ ] Run fixture contract and drift checks.
-   [ ] Run Playwright flow/visual specs with screenshots and trace artifacts.
-   [ ] Run runtime isolation and no-LMS-fork guards.
-   [ ] Run package-level lint/build for touched packages.
-   [ ] Run OntoIndex diff verification before commit.
-   [ ] Run Thermos/autoreview for correctness/security/maintainability before final handoff.

## Testing And Evidence Plan

### Unit / Vitest / Jest

-   `packages/universo-react-types/src/__tests__/applicationLayouts.test.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/__tests__/model.test.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/__tests__/matrixMove.test.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/__tests__/MatrixWorkspace.test.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/__tests__/InterpretationNetworkWorkspaceWidget.test.tsx`
-   `packages/universo-react-applications-frontend/src/pages/__tests__/ApplicationSettings.test.tsx`
-   `packages/universo-react-metahubs-backend/src/tests/interpretationNetworkTemplateShape.test.ts`

### Playwright

Use repository wrappers. Do not run `pnpm dev` for E2E.

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
node -v
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "interpretation-network"
node tools/testing/e2e/run-playwright-suite.mjs --project ru-light --grep "interpretation-network"
```

Conditional local Supabase minimal gate, used when hosted E2E is unavailable, local Supabase is the target, or a release gate needs local database proof:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:interpretation-network-fixture-gate:local-supabase
pnpm supabase:e2e:stop
```

Fixture and drift checks:

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run check:interpretation-network-fixture-drift
pnpm run test:e2e:interpretation-network-fixture-gate
```

Critical Interpretation Network browser flows should be repeated before acceptance, using the repository wrapper's supported repeat/retry option or the nearest equivalent command discovered from current scripts. The repeat gate should run at least five iterations for the hierarchical table navigation/settings flow, with isolated test data per worker and no orphan local Supabase services.

### UX Oracles

-   Use role/label/test-id locators and web-first assertions.
-   Capture screenshots only after the relevant user-facing locators, table content, breadcrumbs, and no-overflow checks have passed.
-   Use `expectNoTechnicalLeakage` on Matrix, details pane, settings panel, and dialogs.
-   Use `expectNoTechnicalLeakage` with `checkUuidSubstrings: true` on Matrix, breadcrumbs, details pane, settings panel, dialogs, and visible menus.
-   Scan accessible names and ARIA labels for UUID/CID/internal ID leakage.
-   Use `expectSemanticFieldControls` for Structure, Cell, and Material dialogs.
-   Use `expectLocalizedValidation` in EN/RU settings flows.
-   Check optional resource-source empty states do not emit premature errors.
-   Use `expectRuntimeUxViewportMatrix` or equivalent no-overflow checks.
-   Assert table/container scroll is constrained while document-level horizontal overflow fails.
-   Assert screenshots are nonblank and contain the expected user-facing breadcrumb/table content before attaching artifacts.
-   Attach screenshots for:
    -   default hierarchical Table root
    -   child focus
    -   grandchild focus with full breadcrumbs
    -   truncated breadcrumbs with ellipsis
    -   breadcrumb-up navigation
    -   horizontal toolbar default
    -   vertical toolbar opt-in

## Validation Commands

Exact commands may be refined after implementation, but the expected validation set is:

```bash
pnpm --filter @universo-react/types test -- src/__tests__/applicationLayouts.test.ts
pnpm --filter @universo-react/apps-template-mui test -- src/dashboard/components/interpretation-network
pnpm --filter @universo-react/applications-frontend test -- src/pages/__tests__/ApplicationSettings.test.tsx
pnpm --filter @universo-react/metahubs-backend test -- src/tests/interpretationNetworkTemplateShape.test.ts
pnpm run check:runtime-no-lms-forks
pnpm run check:apps-template-isolation
pnpm run check:interpretation-network-fixture-contract
pnpm run check:interpretation-network-fixture-drift
pnpm run test:e2e:interpretation-network-fixture-gate:local-supabase
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
pnpm ontoindex:changes
git diff --check
```

If package scripts differ, discover the current package-specific scripts before running broad root commands.

## Potential Challenges And Controls

-   **MUI Breadcrumbs default collapse is not tail-only.**
    Control: use a pure tail-first display helper and render hidden prefix behind a localized ellipsis menu while retaining MUI style.

-   **Old E2E tests may lock the independent-axis Table as default.**
    Control: split test oracles so default hierarchical Table and secondary independent-axis Table are both tested intentionally.

-   **Strict Zod schema can reject new settings or raw errors can leak.**
    Control: update shared schema first, use `safeParse`, normalize invalid config, and keep localized UI messages in settings.

-   **Route focus can become stale after reload or fixture import.**
    Control: validate route cell IDs against loaded cells and repair invalid values.

-   **Multiple roots are ambiguous.**
    Control: represent root state explicitly and show localized repair UI; do not silently choose the first root.

-   **Hierarchical table DnD can accidentally preserve row/column slot semantics.**
    Control: disable empty-slot DnD in hierarchical projection and keep slot DnD only in independent-axis mode.

-   **Large hierarchies can cause render/model slowness.**
    Control: build maps once per input set, memoize view models, avoid per-cell parent-chain scans during render, and add tests for cycle tolerance.

-   **`apps-template-mui` dependency boundary can be violated during UI reuse.**
    Control: duplicate local components when needed; do not import from `@universo-react/template-mui` or legacy feature packages.

-   **Fixture can drift from template defaults.**
    Control: generator, contract, drift check, and committed snapshot move together.

## Subagent QA Findings Incorporated

-   Added per-surface UI Contract instead of only aggregate runtime requirements.
-   Corrected scope from `n/a` to concrete packages and tools.
-   Made `toolbarLayout` required scope with horizontal default and vertical opt-in.
-   Chose explicit `tableProjection` to avoid hidden settings behavior.
-   Chose route-stable focus because acceptance requires reload coherence.
-   Chose tail-first breadcrumb truncation, not the MUI default prefix-plus-suffix behavior.
-   Chose to disable independent empty-slot DnD in hierarchical Table.
-   Planned dedicated model/component/E2E oracles for hierarchical breadcrumb Table and split the old independent-axis tests into a secondary-mode oracle.
-   Added fixture contract checks for `breadcrumbDepth`, `toolbarLayout`, `tableProjection`, and diagnostic-address leakage.

## Open Questions

No blocking product questions remain for implementation approval. The decisions above are proposed for discussion; implementation should start only after the user approves or adjusts them.
