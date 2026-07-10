# Interpretation Network Peer Matrix Views Plan

> Created: 2026-07-07
> Updated: 2026-07-07
> Status: Revised implementation and verification plan
> Research: ../research/interpretation-network-matrix-table-view-research-2026-07-07.md
> Brief: Platformo Interpretation Network Matrix Table View specification, 2026-07-07

## Objective

Replace the obsolete Matrix/Table split with one authoritative peer-view contract for the Interpretation Network Matrix. The published workspace must present `table`, `horizontalRows`, and `verticalTree` as allowed alternatives over the same cell records while preserving `matrixMode`, flexible cell content, movement semantics, fixture generation, and runtime UX quality.

## Non-Negotiable Decisions

1. **One peer-view contract**
    - Use `allowedMatrixViews` and `defaultMatrixView`.
    - Allowed values are `table`, `horizontalRows`, and `verticalTree`.
    - Do not introduce or preserve `allowedDisplayModes`, `defaultDisplayMode`, `MatrixDisplayMode`, or `matrix | table`.
2. **Independent data semantics**
    - Keep `matrixMode: hierarchicalCells | independentRows`.
    - `hierarchicalCells` supports all three views.
    - `independentRows` supports `table` and `horizontalRows`; `verticalTree` is removed during normalization.
3. **Shared authority**
    - Keep the types, values, and normalizer in `@universo-react/types`.
    - Metahub authoring, Application settings, runtime parsing, tests, fixtures, and documentation must consume the same contract.
4. **Canonical defaults**
    - Seed `allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree']`.
    - Seed `defaultMatrixView: 'table'`.
5. **Flexible content**
    - Users can create and edit `RowLabel`, `ColLabel`, `CellValue`, and optional multiline `CellDescription`.
    - Internal identity, hierarchy, axis keys, and persisted order remain system-owned and hidden.
6. **Table movement**
    - Occupied cells retain normal DnD and action-menu behavior.
    - Empty Table intersections are DnD targets only for `independentRows`.
    - Empty intersections in `hierarchicalCells` are display-only.
7. **No version or legacy work**
    - No database migration.
    - No package, repository, snapshot schema, Metahub template, or minimum structure version bump.
    - No compatibility branch for obsolete display fields.
8. **Generated and visible proof**
    - Regenerate the committed fixture through the product generator.
    - Require focused automated checks and browser evidence in EN and RU at desktop, tablet, and mobile widths.

## Architecture And Ownership

-   **Starting template**: dedicated `interpretation-network`, composed from existing Hub, Page, Object, Set, and Enumeration presets.
-   **Metahub layer**: canonical widget defaults, field metadata, and view configuration authoring.
-   **Application layer**: deployment-specific view overrides on active materialized `interpretationNetworkWorkspace` widgets.
-   **Workspace layer**: Structures, Matrix cells, Materials, Relations, selection, editing, DnD, and transient view switching.
-   **Runtime reuse**: extend the generic `apps-template-mui` Interpretation Network primitives; do not add a configuration-specific shell or legacy-template dependency.

## UI Contract

### Metahub Widget Editor

-   Render checkboxes or equivalent option controls for the three peer views.
-   Prevent removal of the final allowed view.
-   Disable `verticalTree` when `matrixMode` is `independentRows`.
-   Restrict the default selector to currently allowed views.
-   Normalize the default immediately when its view becomes unavailable.
-   Keep all labels and compatibility guidance localized.

### Application Matrix Settings

-   Use the same non-empty allowed-view set and default selector.
-   Save one normalized configuration to every active materialized Interpretation Network workspace widget.
-   Preserve other approved widget config fields and strip system envelope metadata through the existing sanitizer.
-   When widgets disagree, show a localized user-facing warning and normalize them on save without exposing widget IDs or raw JSON.
-   Keep settings responsive with full-width controls on narrow screens.

### Runtime View Switcher

-   Show only configured allowed views.
-   Hide the switcher when exactly one view is allowed.
-   Use stable 40px icon controls, localized tooltips, and accessible names.
-   Initialize from `defaultMatrixView`.
-   Keep a user's runtime choice transient and reset it only when the current view is no longer allowed.
-   Preserve selected cell, Materials pane context, permissions, and mutations while switching.

### Semantic Table

-   Render localized `RowLabel` values as row headers and `ColLabel` values as column headers.
-   Render `CellValue`, position, style, selection, material summary, actions, and drag handle for occupied cells.
-   Render missing intersections as localized empty cells without creating placeholder records.
-   Use internal IDs only for React keys, test attributes, and mutation payloads.
-   Contain horizontal scrolling inside the Table container and prevent page-level overflow.
-   Support keyboard selection, action menus, and navigation to the Materials pane.

### Cell Authoring

-   Resolve fields by metadata codename or field ID rather than fixed form positions.
-   Allow users to edit row label, column label, title, and description during create/edit flows.
-   Keep description multiline and optional.
-   Preserve localized title and description values during movement; only an `independentRows` empty-slot drop adopts that destination's row and column keys and localized labels.
-   Hide `CellId`, `ParentCellId`, `RowKey`, `ColKey`, `_tp_sort_order`, and raw row IDs.

## Implementation Plan

### Phase 0: Scope And Baseline

-   [ ] Confirm only the intended Matrix-view symbols and generated artifacts are in scope.
-   [ ] Run OntoIndex impact before editing each implementation symbol and report HIGH or CRITICAL risk before proceeding.
-   [ ] Record focused baseline results for shared type normalization, runtime model parsing, Application settings, fixture contract, and imported-snapshot E2E.
-   [ ] Preserve unrelated worktree changes.

### Phase 1: Shared View Contract

-   [ ] Define the three Matrix views and exported TypeScript type in `@universo-react/types`.
-   [ ] Implement one normalizer that:
    -   accepts only known values;
    -   deduplicates values;
    -   removes `verticalTree` for `independentRows`;
    -   guarantees at least one allowed view;
    -   guarantees the default belongs to the allowed set;
    -   falls back to `horizontalRows` for missing or invalid configuration.
-   [ ] Extend the strict Interpretation Network widget config schema.
-   [ ] Add direct tests for valid, duplicate, empty, unknown, incompatible, and invalid-default inputs.

### Phase 2: Remove Obsolete Configuration Paths

-   [ ] Replace every use of `allowedDisplayModes`, `defaultDisplayMode`, and separate Matrix/Table display state.
-   [ ] Remove the old `hierarchyLayout` configuration as a competing persisted view selector; `horizontalRows` and `verticalTree` now belong to the peer-view set.
-   [ ] Keep `hierarchyRowMode` and position numbering as separate hierarchy behavior settings.
-   [ ] Add repository scans that fail if obsolete configuration names return in production code, fixtures, tests, or documentation.

### Phase 3: Metahub Defaults And Authoring

-   [ ] Seed all three views and `table` as the default in the Interpretation Network template.
-   [ ] Update the Metahub widget editor to use the shared normalizer and compatibility rules.
-   [ ] Preserve the existing preset composition and widget ownership.
-   [ ] Assert that package, repository, snapshot schema, Metahub template, and minimum structure versions remain unchanged.
-   [ ] Add focused Metahub editor and template contract tests.

### Phase 4: Application Overrides

-   [ ] Parse Matrix settings through the shared normalizer.
-   [ ] Add `allowedMatrixViews` and `defaultMatrixView` to the approved widget-config save keys.
-   [ ] Update local form state, change detection, save payloads, optimistic cache updates, and query invalidation.
-   [ ] Detect divergent active widgets and display a localized warning.
-   [ ] Save the normalized settings to every active materialized Interpretation Network widget.
-   [ ] Test compatible and incompatible `matrixMode` transitions, multi-widget save, sanitizer behavior, cache updates, and EN/RU rendering.

### Phase 5: Runtime Composition

-   [ ] Parse widget config with the shared contract.
-   [ ] Replace separate layout/display state with one transient `matrixViewOverride`.
-   [ ] Derive the effective view from the override, configured default, and normalized allowed views.
-   [ ] Pass the effective view and allowed set through the existing workspace bridge.
-   [ ] Keep URL state and persisted Matrix records unchanged.
-   [ ] Verify switching views preserves cell selection and Materials context.

### Phase 6: Table View And Flexible Fields

-   [ ] Build the Table model from unique row and column axes while preserving source order and localized labels.
-   [ ] Render semantic MUI table headers and occupied/empty intersections.
-   [ ] Reuse shared cell content, style, selection, actions, permissions, and material-count primitives.
-   [ ] Keep Table overflow local with stable responsive dimensions.
-   [ ] Ensure create/edit forms resolve and preserve `RowLabel`, `ColLabel`, `CellValue`, and multiline `CellDescription`.
-   [ ] Verify no internal identifiers, raw JSON, or internal validation messages reach user-facing surfaces.

### Phase 7: DnD Semantics

-   [ ] Preserve occupied-cell DnD for Table, Horizontal rows, and Vertical tree where compatible.
-   [ ] Represent an empty Table intersection as an explicit row/column destination without persisting an empty record.
-   [ ] Enable empty-slot droppables only when `matrixMode` is `independentRows`.
-   [ ] On an independent-row empty-slot drop:
    -   reuse the destination `RowKey`, `RowLabel`, `ColKey`, and `ColLabel`;
    -   preserve cell identity, title, description, styles, and material relations;
    -   update persisted order coherently;
    -   do not generate replacement axis keys.
-   [ ] Keep hierarchical empty slots non-droppable and require an existing cell as the hierarchy target.
-   [ ] Preserve menu and keyboard movement fallbacks.

### Phase 8: Localization And Accessibility

-   [ ] Add or update EN/RU labels for the three views, compatibility guidance, semantic Table regions, empty intersections, cell names, movement, and divergent settings.
-   [ ] Use role, label, and accessible-name locators as the primary browser contract.
-   [ ] Verify icon-only controls have tooltips and accessible names.
-   [ ] Verify keyboard users can switch views, select cells, open actions, edit flexible fields, and reach Materials.
-   [ ] Prove localized validation on deliberately invalid EN and RU flows.

### Phase 9: Automated Coverage

-   [ ] **Shared types**: normalizer and strict schema tests.
-   [ ] **Runtime model**: config parsing, Table-axis order, empty intersections, flexible labels, and hidden IDs.
-   [ ] **Movement**: occupied targets in both modes and empty Table destinations only for `independentRows`.
-   [ ] **Runtime components**: all three views, single-view switcher hiding, selection continuity, permissions, styles, materials, keyboard access, and technical-leakage checks.
-   [ ] **Metahub editor**: non-empty selection, default membership, and `verticalTree` compatibility.
-   [ ] **Application settings**: parsing, save, divergence warning, multi-widget persistence, sanitizer, cache behavior, and localization.
-   [ ] **Template and fixture contract**: canonical defaults, no user-authored runtime seed data, and unchanged versions.

### Phase 10: Fixture Regeneration

-   [ ] Activate Node 22.
-   [ ] Start the dedicated minimal local Supabase E2E profile.
-   [ ] Run the Interpretation Network product generator through the repository Playwright wrapper.
-   [ ] Run the Interpretation Network fixture contract and repository snapshot-fixture contract.
-   [ ] Compare normalized generated output with the committed fixture.
-   [ ] Commit only generator-produced fixture changes; never hand-edit the product snapshot.
-   [ ] Stop the dedicated E2E stack after verification.

### Phase 11: Browser Evidence

-   [ ] Run the imported-snapshot flow through `tools/testing/e2e/run-playwright-suite.mjs`.
-   [ ] Prove all three views for `hierarchicalCells`.
-   [ ] Switch to `independentRows` and prove only Table and Horizontal rows remain.
-   [ ] Create and edit a cell with custom row, column, title, and multiline description values.
-   [ ] Move an occupied cell between normal targets.
-   [ ] Move a cell into an empty Table intersection in `independentRows` and verify persisted content and axes after reload.
-   [ ] Prove hierarchical empty intersections are not DnD targets.
-   [ ] Attach and inspect EN/RU screenshots at `1920x1080`, `768x1024`, and `390x844`.
-   [ ] Assert Table-local horizontal scrolling and zero page-level horizontal overflow.
-   [ ] Run technical-leakage and localized-validation oracles after valid and invalid flows.

### Phase 12: Documentation And Closeout

-   [ ] Update existing EN/RU guides, architecture pages, package READMEs, and E2E documentation with the peer-view contract.
-   [ ] Remove obsolete Matrix/Table terminology and compatibility claims.
-   [ ] Keep EN/RU document structure synchronized.
-   [ ] Run focused package tests, builds, lint, isolation guards, fixture checks, docs checks, and `git diff --check`.
-   [ ] Run OntoIndex diff verification and confirm only expected symbols and flows changed.
-   [ ] Run Thermos/autoreview closeout and resolve all accepted CRITICAL/HIGH findings.

## Verification Matrix

| Area            | Required proof                                                                          |
| --------------- | --------------------------------------------------------------------------------------- |
| Shared contract | Unit tests for allowed/default normalization and compatibility                          |
| Metahub         | Editor tests plus seeded template contract                                              |
| Application     | Settings tests for save, divergence, sanitizer, and cache behavior                      |
| Runtime         | Model and component tests for all peer views and flexible fields                        |
| Movement        | Unit tests plus browser DnD for occupied and empty destinations                         |
| Fixture         | Generator output, fixture gate, and normalized drift comparison                         |
| UX              | EN/RU browser flow, keyboard path, responsive screenshots, no leakage, no page overflow |
| Architecture    | Isolation guards, unchanged versions, OntoIndex diff verification                       |

## Acceptance Criteria

-   `table`, `horizontalRows`, and `verticalTree` are represented as peer Matrix views everywhere.
-   `allowedMatrixViews` is non-empty and `defaultMatrixView` is allowed.
-   `verticalTree` is unavailable only for `independentRows`.
-   `matrixMode` remains unchanged and independent from presentation.
-   Row, column, title, and multiline description are flexible user-authored values.
-   Empty Table slots accept drops only in `independentRows`.
-   Movement preserves cell identity, title, description, styles, material relations, and coherent order; an empty-slot move adopts the destination axes.
-   No obsolete display fields or compatibility layer remain.
-   No package, repository, snapshot schema, Metahub template, or minimum structure version is bumped.
-   The committed fixture is generator-produced and passes drift checks.
-   Browser evidence proves the complete EN/RU workflow without technical leakage or page-level horizontal overflow.
