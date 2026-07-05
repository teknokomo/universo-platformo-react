# Interpretation Network Data Model

The Interpretation Network data model encodes a generic interpretation network: Structures, matrix cells, optional compatibility rows, and Materials attached to cells.

## Stage-1 model

Stage 1 ships the runtime model directly in the product fixture and in the workspace widget:

-   `Structure` objects are exposed to users as Structures and use `Name` plus optional `Description` in the create/edit form.
-   `Interpretation` objects hold each structure's matrix.
-   `Relation` objects remain available for typed links between structures, interpretations, and cells.
-   `Material` objects use Page-like fields and hold Editor.js content attached to cells.
-   `Context`, `RelationType`, and `CellColor` enumerations drive display and relation labeling.
-   `TableTemplate` workspace records let users create or copy reusable matrix structures inside the published app.

## Cell attributes

Each Interpretation Matrix cell uses flat fields rather than nested JSON:

-   `CellId` — UUID v7.
-   `ParentCellId` — hidden nullable parent `CellId` used by hierarchy-first matrices.
-   `RowKey` and `ColKey` — stable structure keys.
-   `RowLabel` and `ColLabel` — localized display labels.
-   `CellValue` — localized multiline value.
-   `CellFillColor` — reference to `CellColor`.
-   `Border{Top,Right,Bottom,Left}{Color,Width,Style}` — flat border controls.
-   `MaterialRef` — optional Material page reference.
-   `_tp_sort_order` — persisted sibling order. `Depth` is derived at runtime and is not stored.

The default `interpretationNetworkWorkspace` widget config uses `matrixMode: "hierarchicalCells"`. In this mode the first cell created with a Structure is `Universe` / `Вселенная`, and all following cells are children of an existing cell. The compatibility mode `independentRows` keeps the earlier row/column behavior for applications that deliberately choose it.

## UI contract

The runtime widget renders the structure list on the left. After a structure is opened, the matrix is displayed inside the `Matrix` tab so later stages can add more structure-level tabs without changing the route contract. The right pane is reserved for materials attached to the selected matrix cell. Users see labels, material titles, descriptions, and Editor.js content; they do not see raw UUIDs, raw JSON, or internal field names on normal surfaces.

Application settings do not infer Interpretation Network behavior from hardcoded LMS defaults. The settings page reads active materialized layout widgets; Matrix settings are saved back to the `interpretationNetworkWorkspace` widget config, while Learning Content remains visible only for applications whose runtime state actually contains that configuration.

## Workspace templates

A workspace-scoped table template can be created or copied inside the published app and then reused to instantiate a visible matrix. This is part of the Stage-1 product contract.

## Constraints

-   No IPFS in Stage 1.
-   No schema or template version bump.
-   The basic template primitives remain the base; the workspace widget composes them instead of reviving demo dashboard surfaces.
