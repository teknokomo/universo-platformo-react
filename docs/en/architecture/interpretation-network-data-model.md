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

-   `RowLabel` and `ColLabel` — user-authored, localized row and column labels.
-   `CellValue` — the user-authored, localized cell title.
-   `CellDescription` — optional user-authored, localized multiline description.
-   `CellId` — system-owned UUID v7.
-   `ParentCellId` — hidden, system-owned nullable parent `CellId` used by hierarchical matrices.
-   `RowKey` and `ColKey` — hidden, system-owned stable axis keys.
-   `CellFillColor` — reference to `CellColor`.
-   `Border{Top,Right,Bottom,Left}{Color,Width,Style}` — flat border controls.
-   `MaterialRef` — optional Material page reference.
-   `_tp_sort_order` — hidden, system-owned persisted sibling order. `Depth` is derived at runtime and is not stored.

The runtime cell dialog lets users name the row, column, and cell and enter the optional multiline description. Creating a cell in an existing row may inherit its row label; creating a row in an existing column may inherit its column label. The user can change inherited labels before saving. Placeholder text such as “New row” or “New cell” is never persisted as authored content.

The default `interpretationNetworkWorkspace` widget config uses `matrixMode: "hierarchicalCells"`. In this mode the first cell created with a Structure is `Universe` / `Вселенная`, and all following cells can participate in the parent/child hierarchy. The `independentRows` mode keeps independent row behavior for configurations that deliberately choose it.

## Matrix display settings

Matrix display settings are widget configuration, not cell data:

-   `matrixMode` controls Matrix data semantics: `hierarchicalCells` or `independentRows`.
-   `allowedMatrixViews` is the non-empty set of peer Matrix views available to workspace users: `table`, `horizontalRows`, and `verticalTree`.
-   `defaultMatrixView` is one member of `allowedMatrixViews` and opens when the workspace is entered.
-   `tableProjection` controls the Table presentation. The template default is `hierarchicalPath`, where parent cells become breadcrumbs and the focused level's children become rows. `independentAxes` remains available for the explicit row/column table projection.
-   `breadcrumbDepth` defaults to the full path. A finite `last` depth shows the configured trailing levels and exposes hidden parents through the localized ellipsis menu.
-   `toolbarLayout` defaults to `horizontal`; `vertical` is an opt-in display setting for dense workspaces.
-   `showHierarchicalTableHeaders` defaults to `false` for the hierarchy-first Table. It can be enabled to show the current-level/cell column headers.
-   `showHierarchicalTableHeaderCard` defaults to `true`, keeping the focused parent cell as a separated context card above the row table before it moves into breadcrumbs.
-   `colorBreadcrumbsByCell` defaults to `true`, so breadcrumb boxes use the same configured fill as their source cells and use a separate hover/focus treatment for navigation feedback.

The authoritative schema and normalizers live in `@universo-react/types` (`common/applicationLayouts`). Matrix views are alternative presentations of one Matrix, not separate Matrix and Table features. At least one view is required, duplicates are invalid, and the default must be allowed. `verticalTree` requires `hierarchicalCells`; `table` and `horizontalRows` also support `independentRows`. The template seeds canonical settings at the metahub layer; the Application control panel may override them for the deployed instance; workspace users switch among the allowed views while authoring content.

These fields do not require a database migration, a new entity preset, or a metahub template version bump.

## UI contract

The runtime widget renders the structure list on the left. After a structure is opened, the matrix is displayed inside the `Matrix` tab so later stages can add more structure-level tabs without changing the route contract. The right pane is reserved for materials attached to the selected matrix cell. Users see labels, material titles, descriptions, and Editor.js content; they do not see raw UUIDs, raw JSON, or internal field names on normal surfaces.

Application settings do not infer Interpretation Network behavior from hardcoded LMS defaults. The settings page reads active materialized layout widgets; Matrix settings are saved back to the `interpretationNetworkWorkspace` widget config, while Learning Content remains visible only for applications whose runtime state actually contains that configuration.

The `table`, `horizontalRows`, and `verticalTree` views present the same cell records. By default, Table view is hierarchy-first: the selected cell path becomes clickable cell-colored breadcrumbs, the focused parent becomes the current table context, direct children become rows, and column headers are hidden unless enabled explicitly. Breadcrumb clicks update selection, route state, visible children, and the Materials pane. When `tableProjection` is `independentAxes`, Table view uses user-authored `RowLabel` and `ColLabel` values as semantic headers; a missing `(RowKey, ColKey)` intersection remains an empty, localized table cell and is not persisted as a new record. User-facing surfaces hide UUIDs, axis keys, parent IDs, sort order, raw JSON, and old product-specific names.

## Workspace templates

A workspace-scoped table template can be created or copied inside the published app and then reused to instantiate a visible matrix. This is part of the Stage-1 product contract.

## Constraints

-   No IPFS in Stage 1.
-   No schema or template version bump.
-   The basic template primitives remain the base; the workspace widget composes them instead of reviving demo dashboard surfaces.
-   Fixture and E2E validation must use generated snapshots, minimal local Supabase, contract checks, and browser evidence for all three responsive Matrix views in EN and RU.
