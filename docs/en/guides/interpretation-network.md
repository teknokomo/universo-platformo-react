# Interpretation Network

The **Interpretation Network** template adds a real interpretation-network workspace to the Universo Platformo metahub catalog. It is the Stage-1 delivery for generic interpretation-network applications and ships:

-   A pre-defined **Structure / Interpretation / Relation / Material** runtime model on top of the base `object`, `page`, and `enumeration` presets.
-   Three closed enumerations — **Context**, **RelationType**, and **CellColor** — that drive per-cell styling and graph edges.
-   A reusable **interpretationNetworkWorkspace** runtime widget in `packages/universo-react-apps-template-mui` that renders the two-pane workspace without reviving generic dashboard clutter.
-   A dedicated `cellStylePicker` field widget for the Interpretation Matrix color and border controls.
-   A hierarchy-first Matrix mode where each new cell is created as a child of an existing cell, starting from the root **Universe** cell.
-   Three configurable peer Matrix views: **Table**, **Horizontal rows**, and **Vertical tree**.
-   A product Playwright generator that emits `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` and a strict fixture contract that rejects unrelated dashboard widgets.

## When to use it

-   You need a multi-context knowledge graph: structures that have several interpretations depending on the domain.
-   You need cell-level styling (background color + per-side border) that round-trips through the snapshot envelope.
-   You need typed edges between concepts, interpretations, and individual cells.
-   You need a workspace-scoped table-template flow so users can create or copy reusable matrix structures inside the published app.
-   You need the same Matrix data to be readable as a semantic table, horizontal rows, or a vertical tree.

## Architecture

The published app keeps the normal left application navigation. The central workspace uses the new interpretation-network widget and shows:

-   left pane: structure list and the opened structure's Matrix tab;
-   right pane: materials attached to the selected matrix cell.

The workspace is intentionally operational, not decorative. It reuses shared runtime primitives and generic CRUD/dialog/material controls instead of introducing a one-off dashboard shell.

### Layer ownership

| Layer                     | Owns                                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metahub                   | Canonical `interpretationNetworkWorkspace` widget defaults, including allowed Matrix views, default Matrix view, Table projection, breadcrumb depth, toolbar layout, optional Table headers, the focused parent card, and breadcrumb coloring. |
| Application control panel | Deployment-specific overrides for all active materialized Interpretation Network widgets.                                                                                                                                                      |
| Published workspace       | User-authored Structures, matrix cells, Relations, Materials, table templates, selection state, and transient display switching.                                                                                                               |

The shared contract lives in `@universo-react/types`: `matrixMode` describes data semantics, while `allowedMatrixViews` and `defaultMatrixView` configure the peer views `table`, `horizontalRows`, and `verticalTree`. `tableProjection`, `breadcrumbDepth`, `toolbarLayout`, `showHierarchicalTableHeaders`, `showHierarchicalTableHeaderCard`, and `colorBreadcrumbsByCell` tune the Table experience. At least one view is required and the default must be allowed. `verticalTree` requires hierarchical cells; the other two views also support independent rows.

## Installation

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:interpretation-network-fixture-gate
pnpm run check:interpretation-network-fixture-contract
pnpm run check:snapshot-fixtures-contract
```

Fixture updates are generated, not hand-authored. For product E2E work use the minimal local Supabase profile (`pnpm supabase:e2e:start:minimal`, `pnpm env:e2e:local-supabase`, and the dedicated generator/gate commands). The generated snapshot must pass the Interpretation Network fixture contract and the repository snapshot-fixture contract before replacing `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`.

## Configuration walk-through

The fixture does not seed user-authored structures, matrix cells, or materials. It provides the generic object model, the startup Page, the runtime widget configuration, and the style enumerations needed for users to create their own structures inside the published app.

The Matrix behavior is configured on the materialized `interpretationNetworkWorkspace` layout widget, not in generic application settings. The supported modes are:

-   `hierarchicalCells` — the default product mode. A newly created Structure receives one root matrix cell named `Universe` / `Вселенная`; users select an existing cell and use **Add** to create child cells below it.
-   `independentRows` — the compatibility mode. Users can create independent rows and sibling cells with **Add row** and **Add cell in row**.

Display settings are separate from data semantics:

-   `allowedMatrixViews` — the non-empty allowed subset of `table`, `horizontalRows`, and `verticalTree`.
-   `defaultMatrixView` — the allowed view opened by default.
-   `tableProjection` — `hierarchicalPath` by default, where breadcrumbs represent the parent path and the current level's children become table rows; `independentAxes` keeps the explicit row/column table.
-   `breadcrumbDepth` — full path by default, or the last configured levels with an ellipsis menu for hidden parents.
-   `toolbarLayout` — horizontal by default; vertical is available as an opt-in setting.
-   `showHierarchicalTableHeaders` — hidden by default for the hierarchy-first Table; enable it only when the current-level/cell column headers are useful.
-   `showHierarchicalTableHeaderCard` — enabled by default, keeping the focused parent cell as a separated context card above the row table.
-   `colorBreadcrumbsByCell` — enabled by default so breadcrumb boxes carry the same fill color as their source cells.

The application settings page derives the Matrix tab from active materialized widgets. It can enable any compatible views and choose the default for the deployed instance. If several active widgets disagree, the settings surface warns the administrator and saves one normalized configuration to all of them. LMS-only settings such as Learning Content are not shown for the Interpretation Network unless the connected metahub publication actually materializes matching runtime configuration.

## Two-pane workspace tour

The published application renders:

-   left application menu: the normal workspace/navigation shell;
-   interpretation workspace: the new `interpretationNetworkWorkspace` widget;
-   left pane before opening a structure: the structure list and Create structure action;
-   left pane after opening a structure: the structure title and a `Matrix` tab with matrix actions;
-   right pane: materials attached to the selected matrix cell.

Matrix actions are right-aligned and use the same contained MUI action style as other Create actions in the runtime template. Dragging a cell shows a stable drag overlay, mutes the origin cell, and renders a dashed drop indicator on the target before the move is saved.

## Matrix views

Table, Horizontal rows, and Vertical tree are peer views over the same Matrix cell data. They do not create separate storage models and do not change `matrixMode`.

-   Users author `CellValue` and the optional multiline `CellDescription`; in the secondary `independentAxes` projection they can also author `RowLabel` and `ColLabel`.
-   The runtime owns `CellId` (UUID v7), `ParentCellId`, `RowKey`, `ColKey`, and `_tp_sort_order`. These fields are not editable or shown on normal user surfaces.
-   The default Table projection is hierarchy-first: parent cells render as clickable cell-colored breadcrumbs, the focused parent is the separated table context card by default, and direct children render as rows with material summaries.
-   If `breadcrumbDepth` is finite, the visible path is truncated to the configured trailing levels and hidden parents are available from the ellipsis menu.
-   The secondary `independentAxes` Table projection uses explicit Matrix rows and columns. Missing intersections render a localized empty state instead of fabricating records.
-   Table headers are optional. In the Interpretation Network default configuration the current-level/cell column headers are hidden; Application Settings or the metahub widget editor can enable them.
-   The table uses semantic MUI table markup: optional `TableHead`, column headers with `scope="col"` when enabled, row headers with `scope="row"`, and labelled scroll containment when horizontal scrolling is needed.
-   Cells expose accessible names that include row, column, position, title, and selected state. Keyboard users can select a cell, open its actions, move through the workflow, and reach the Materials pane.
-   Cell color, border styling, position labels, selected state, material summary, creation, edit/delete actions, menu movement, and drag/drop behavior remain aligned across compatible views.
-   Only the table container may scroll horizontally. The application page itself must not gain horizontal overflow at desktop, tablet, or mobile widths.
-   Technical IDs, axis keys, widget IDs, relation IDs, raw JSON, and old product-specific naming stay hidden from user-facing surfaces.

## Cell styling

Each matrix cell carries a stable `CellId` (UUID v7) plus flat color and border fields. The `cellStylePicker` widget renders a chip grid for color selection, border width/style controls, and a live preview.

## Material attachment

Materials use the Page-like object contract with title, description, and Editor.js block content. In the application UI they are shown as Materials, scoped to the selected matrix cell, with table/card modes and title filtering. Structure creation exposes only `Name` and `Description`; Context remains part of interpretations, not a required Structure form field.

## Workspace table templates

Stage 1 includes a workspace-scoped table-template flow. Users can create or copy a reusable matrix template inside the workspace and instantiate visible matrix rows from it without metahub-authoring access.

## Limitations

-   No IPFS/IPNS/content-addressed publication in Stage 1.
-   No new schema or metahub template version bump.
-   No old product-specific naming in code, fixture names, i18n keys, tests, or docs.
-   Existing platform workspace roles remain sufficient for Stage 1.

## Next steps

-   [Interpretation Network data model](../architecture/interpretation-network-data-model.md)
-   [Snapshot Export & Import](snapshot-export-import.md)
-   [Runtime UI UX Quality Gate](../contributing/runtime-ui-ux-quality-gate.md)
