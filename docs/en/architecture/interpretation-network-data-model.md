# Interpretation Network Data Model

The Interpretation Network data model encodes a generic interpretation network: Structures, matrix rows and cells, and Materials attached to cells.

## Stage-1 model

Stage 1 ships the runtime model directly in the product fixture and in the workspace widget:

-   `Concept` objects are exposed to users as Structures.
-   `Interpretation` objects hold each structure's matrix.
-   `Relation` objects remain available for typed links between concepts, interpretations, and cells.
-   `Material` objects use Page-like fields and hold Editor.js content attached to cells.
-   `Context`, `RelationType`, and `CellColor` enumerations drive display and relation labeling.
-   `TableTemplate` workspace records let users create or copy reusable matrix structures inside the published app.

## Cell attributes

Each Interpretation Matrix cell uses flat fields rather than nested JSON:

-   `CellId` — UUID v7.
-   `RowKey` and `ColKey` — stable structure keys.
-   `RowLabel` and `ColLabel` — localized display labels.
-   `CellValue` — localized multiline value.
-   `CellFillColor` — reference to `CellColor`.
-   `Border{Top,Right,Bottom,Left}{Color,Width,Style}` — flat border controls.
-   `MaterialRef` — optional Material page reference.

## UI contract

The runtime widget renders the structure list and opened structure matrix on the left. The right pane is reserved for materials attached to the selected matrix cell. Users see labels, material titles, descriptions, and Editor.js content; they do not see raw UUIDs, raw JSON, or internal field names on normal surfaces.

## Workspace templates

A workspace-scoped table template can be created or copied inside the published app and then reused to instantiate a visible matrix. This is part of the Stage-1 product contract.

## Constraints

-   No IPFS in Stage 1.
-   No schema or template version bump.
-   The basic template primitives remain the base; the workspace widget composes them instead of reviving demo dashboard surfaces.
