# Interpretation Network

The **Interpretation Network** template adds a real interpretation-network workspace to the Universo Platformo metahub catalog. It is the Stage-1 delivery for generic interpretation-network applications and ships:

-   A pre-defined **Structure / Interpretation / Relation / Material** runtime model on top of the base `object`, `page`, and `enumeration` presets.
-   Two closed enumerations — **Context** and **RelationType** — for interpretation context and typed graph edges.
-   A reusable **interpretationNetworkWorkspace** runtime widget in `packages/universo-react-apps-template-mui` that renders the workspace using the original MUI template primitives.
-   A hierarchy-first Matrix mode where each new cell is created as a child of an existing cell, starting from the root **Universe** cell.
-   Three configurable peer Matrix views: **Table**, **Horizontal rows**, and **Vertical tree**.
-   A product Playwright generator that emits `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` and a strict fixture contract that rejects unrelated dashboard widgets.

## When to use it

-   You need a multi-context knowledge graph: structures that have several interpretations depending on the domain.
-   You need safe cell styling with fill, text, and per-side border colours that round-trip through the snapshot envelope.
-   You need typed edges between concepts, interpretations, and individual cells.
-   You need a workspace-scoped table-template flow so users can create or copy reusable matrix structures inside the published app.
-   You need the same Matrix data to be readable as a semantic table, horizontal rows, or a vertical tree.

## Architecture

The published app keeps the normal left application navigation. The central workspace uses the Interpretation Network widget and shows a parent Structure header above two sibling panes:

-   structure pane: the structure list or its opened Matrix;
-   materials pane: materials attached to the selected matrix cell.

The workspace is intentionally operational, not decorative. It reuses shared runtime primitives and generic CRUD/dialog/material controls instead of introducing a one-off dashboard shell.

### Layer ownership

| Layer                     | Owns                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metahub                   | Canonical `interpretationNetworkWorkspace` defaults, including Matrix views, Table presentation, breadcrumb behaviour, and `splitPane.enabled`.                                               |
| Application control panel | Deployment-specific overrides for active materialized Interpretation Network widgets, including whether users may resize the two panes.                                                           |
| Published workspace       | User-authored Structures, matrix cells, Relations, Materials, table templates, selection state, and a user's transient pane widths.                                                              |

The shared contract lives in `@universo-react/types`: `matrixMode` describes data semantics, while `allowedMatrixViews` and `defaultMatrixView` configure the peer views `table`, `horizontalRows`, and `verticalTree`. `tableProjection`, `breadcrumbDepth`, `toolbarLayout`, `showHierarchicalTableHeaders`, `showHierarchicalTableHeaderCard`, and `colorBreadcrumbsByCell` tune the Table experience. At least one view is required and the default must be allowed. `verticalTree` requires hierarchical cells; the other two views also support independent rows.

## Installation and verification

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run test:e2e:interpretation-network-fixture-gate:local-supabase
pnpm run test:e2e:interpretation-network:verify:local-supabase
```

The last command owns the minimal local Supabase lifecycle, builds the E2E app, generates a controlled snapshot artifact, validates its contract and normalized drift, imports that artifact, and runs the focused flow and visual proof. It stops the dedicated E2E stack in `finally`, including after a failure. It never uses `pnpm dev`.

Fixture updates are generated, never edited as JSON. After a successful dedicated generator run and contract review, replace `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only with that Playwright generator's output. The canonical fixture intentionally contains no user-authored Structure, Matrix, Relation, Material, or table-template rows; it proves metadata shape, while browser flows prove runtime writes.

## Configuration walk-through

The fixture does not seed user-authored structures, matrix cells, or materials. It provides the generic object model, the start Page, and the runtime widget configuration needed for users to author their own content inside the published app.

The Matrix behavior is configured on the materialized `interpretationNetworkWorkspace` layout widget. The supported modes are:

-   `hierarchicalCells` — the default product mode. A newly created Structure receives one root matrix cell named `Universe` / `Вселенная`; users select an existing cell and use **Add** to create child cells below it.
-   `independentRows` — an alternative row/column mode. Users can create independent rows and sibling cells with **Add row** and **Add cell in row**.

Display settings are separate from data semantics:

-   `allowedMatrixViews` — the non-empty allowed subset of `table`, `horizontalRows`, and `verticalTree`.
-   `defaultMatrixView` — the allowed view opened by default.
-   `tableProjection` — `hierarchicalPath` by default, where breadcrumbs represent the parent path and the current level's children become table rows; `independentAxes` keeps the explicit row/column table.
-   `breadcrumbDepth` — full path by default, or the last configured levels with an ellipsis menu for hidden parents.
-   `toolbarLayout` — horizontal by default; vertical is available as an opt-in setting.
-   `showHierarchicalTableHeaders` — hidden by default for the hierarchy-first Table; enable it only when the current-level/cell column headers are useful.
-   `showHierarchicalTableHeaderCard` — enabled by default, keeping the focused parent cell as a separated context card above the row table.
-   `colorBreadcrumbsByCell` — enabled by default so breadcrumb boxes carry the same fill color as their source cells.
-   `splitPane.enabled` — enabled by the template. Application Settings may disable it for a deployment without changing the source metahub.

The application settings page derives the Matrix tab from active materialized widgets. It can enable compatible views, choose the default, and enable or disable pane resizing for the deployed instance. If several active widgets disagree, the settings surface warns the administrator and saves one normalized configuration to all of them. LMS-only settings such as Learning Content are not shown for the Interpretation Network unless the connected metahub publication actually materializes matching runtime configuration.

## Two-pane workspace tour

The published application renders:

-   left application menu: the normal workspace/navigation shell, without a duplicated Interpretation Network menu title;
-   interpretation workspace: the `interpretationNetworkWorkspace` widget;
-   before opening a structure: the structure list and Create structure action;
-   after opening a structure: a parent Structure header with its title and a return action above both panes;
-   matrix content: the Structure pane; and
-   materials: the Materials pane for the selected matrix cell.

On desktop, enabled resizing starts at an even 50/50 split and is bounded to 25–75% per pane. Reset returns to 50/50 and the user's drag position is not saved to the server, URL, or browser storage. On narrow screens the panes stack and the divider is not rendered. Matrix actions use the same contained MUI action style as other runtime Create actions. Dragging a cell shows a stable drag overlay, mutes the origin cell, and renders a dashed drop indicator on the target before the move is saved.

## Matrix views

Table, Horizontal rows, and Vertical tree are peer views over the same Matrix cell data. They do not create separate storage models and do not change `matrixMode`.

-   Users author `CellValue` and the optional multiline `CellDescription`; in the secondary `independentAxes` projection they can also author `RowLabel` and `ColLabel`.
-   The runtime owns `CellId` (UUID v7), `ParentCellId`, `RowKey`, `ColKey`, and `_tp_sort_order`. These fields are not editable or shown on normal user surfaces.
-   Structure create and edit receive the complete localized Name and Description values. The dialog shows every authored language, preserves inactive-language values on save, and keeps Description multiline.
-   The default Table projection is hierarchy-first: parent cells render as clickable cell-coloured breadcrumbs, the focused parent is the separated table context card by default, and direct children render as rows with material summaries.
-   When a breadcrumb is narrower than its label, it keeps the beginning of the label visible and truncates the end with an ellipsis. Its accessible name remains the complete label.
-   If `breadcrumbDepth` is finite, the visible path is reduced to the configured trailing levels and hidden parents are available from the ellipsis menu.
-   The secondary `independentAxes` Table projection uses explicit Matrix rows and columns. Missing intersections render a localized empty state instead of fabricating records.
-   Table headers are optional. In the Interpretation Network default configuration the current-level/cell column headers are hidden; Application Settings or the metahub widget editor can enable them.
-   The table uses semantic MUI table markup: optional `TableHead`, column headers with `scope="col"` when enabled, row headers with `scope="row"`, and labelled scroll containment when horizontal scrolling is needed.
-   Cells expose accessible names that include row, column, position, title, and selected state. Keyboard users can select a cell, open its actions, move through the workflow, and reach the Materials pane.
-   Cell colour, border styling, position labels, selected state, material summary, creation, edit/delete actions, menu movement, and drag/drop behavior remain aligned across compatible views.
-   Only the table container may scroll horizontally. The application page itself must not gain horizontal overflow at desktop, tablet, or mobile widths.
-   Technical IDs, axis keys, widget IDs, relation IDs, raw JSON, and product-internal naming stay hidden from user-facing surfaces.

## Cell styling

Each matrix cell stores six nullable colour fields: `CellFillColor`, `TextColor`, `BorderTopColor`, `BorderRightColor`, `BorderBottomColor`, and `BorderLeftColor`. The only persisted non-null value is uppercase `#RRGGBB`; a clear value is `null`. The editor offers preset swatches and a simple custom colour control, but both write the same canonical value.

Text colour follows the same rule as fill and border colour. Before save, the editor checks the effective foreground/background pair against the active theme and blocks an insufficient contrast combination with a localized corrective message. Untrusted malformed stored values never break rendering: the runtime uses a deterministic maximum-contrast foreground for display without rewriting saved data.

Border colour, width, and style are grouped by default: a change applies to all four sides. Users can explicitly choose separate-side editing when a cell needs different edges. The selected-cell outline is painted at the cell edge and retains an in-bounds focus/selection signal, so it is not clipped.

## Material attachment

Materials use the Page-like object contract with title, description, and Editor.js block content. In the application UI they are shown as Materials, scoped to the selected matrix cell, with table/card modes and title filtering. Structure creation exposes only `Name` and `Description`; Context remains part of interpretations, not a required Structure form field.

## Workspace table templates

Stage 1 includes a workspace-scoped table-template flow. Users can create or copy a reusable matrix template inside the workspace and instantiate visible matrix rows from it without metahub-authoring access.

## Limitations

-   No IPFS/IPNS/content-addressed publication in Stage 1.
-   No new schema or metahub template version bump.
-   No persisted user pane ratio or dynamic metahub-to-runtime inheritance.
-   Existing platform workspace roles remain sufficient for Stage 1.

## Next steps

-   [Interpretation Network data model](../architecture/interpretation-network-data-model.md)
-   [Application layouts](application-layouts.md)
-   [Snapshot Export & Import](snapshot-export-import.md)
-   [Runtime UI UX Quality Gate](../contributing/runtime-ui-ux-quality-gate.md)
