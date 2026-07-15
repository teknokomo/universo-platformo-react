# Interpretation Network Data Model

The Interpretation Network data model encodes a generic interpretation network: Structures, matrix cells, optional row/column presentation, and Materials attached to cells.

## Stage-1 model

Stage 1 ships the runtime model directly in the product fixture and in the workspace widget:

-   `Structure` objects are exposed to users as Structures and use localized `Name` plus optional localized `Description` in the create/edit dialog.
-   `Interpretation` objects hold each structure's matrix.
-   `Relation` objects remain available for typed links between structures, interpretations, and cells.
-   `Material` objects use Page-like fields and hold Editor.js content attached to cells.
-   `Context` and `RelationType` enumerations define interpretation context and relation labels.
-   `TableTemplate` workspace records let users create or copy reusable matrix structures inside the published app.

## Cell attributes

Each Interpretation Matrix cell uses flat fields rather than nested JSON:

-   `RowLabel` and `ColLabel` — user-authored, localized row and column labels.
-   `CellValue` — the user-authored, localized cell title.
-   `CellDescription` — optional user-authored, localized multiline description.
-   `CellId` — system-owned UUID v7.
-   `ParentCellId` — hidden, system-owned nullable parent `CellId` used by hierarchical matrices.
-   `RowKey` and `ColKey` — hidden, system-owned stable axis keys.
-   `CellFillColor` — nullable cell background colour.
-   `TextColor` — nullable text foreground colour.
-   `BorderTopColor`, `BorderRightColor`, `BorderBottomColor`, and `BorderLeftColor` — nullable per-side border colours.
-   `Border{Top,Right,Bottom,Left}{Width,Style}` — flat per-side border controls.
-   `MaterialRef` — optional Material page reference.
-   `_tp_sort_order` — hidden, system-owned persisted sibling order. `Depth` is derived at runtime and is not stored.

The six colour fields share one current-data contract: each value is `null` or uppercase `#RRGGBB`. `null` means no explicit fill or border colour, or the theme-default text colour. The editor accepts `#RGB` only as input and normalizes it immediately to `#RRGGBB`; it rejects alpha, named colours, functional CSS, variables, URLs, whitespace-padded values, arrays, objects, and JSON. Preset swatches are UI shortcuts, not entities, references, or another persisted grammar.

Metadata declares this semantic validation through `validationRules.format: 'hexColor'`, `maxLength: 7`, and `pattern: '^#[0-9A-F]{6}$'`. Runtime write, copy, batch, synchronization, and snapshot-import boundaries apply the shared typed normalizer for that known format; they do not execute a template-provided regular expression. Invalid input fails closed before persistence. There is no `CellColor` entity, preset identifier, or reference decoder in the current model.

The runtime cell dialog lets users name the row, column, and cell and enter the optional multiline description. Creating a cell in an existing row may inherit its row label; creating a row in an existing column may inherit its column label. The user can change inherited labels before saving. Placeholder text such as “New row” or “New cell” is never persisted as authored content.

The default `interpretationNetworkWorkspace` widget config uses `matrixMode: "hierarchicalCells"`. In this mode the first cell created with a Structure is `Universe` / `Вселенная`, and all following cells can participate in the parent/child hierarchy. The `independentRows` mode keeps an explicit row/column presentation for configurations that choose it.

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
-   `splitPane` has only `{ enabled: boolean }`. It controls whether desktop users may resize the Structure and Materials panes. The template default is enabled; no ratio is persisted.

The authoritative schema and normalizers live in `@universo-react/types` (`common/applicationLayouts`). Matrix views are alternative presentations of one Matrix, not separate Matrix and Table features. At least one view is required, duplicates are invalid, and the default must be allowed. `verticalTree` requires `hierarchicalCells`; `table` and `horizontalRows` also support `independentRows`. The template seeds canonical settings at the metahub layer; the Application control panel may override them for the deployed instance; workspace users switch among allowed views and temporarily resize panes while authoring content.

These fields do not require a database migration, a new entity preset, or a metahub template version bump.

## UI contract

The runtime widget renders the structure list on the left. After a structure is opened, its parent header sits above both panes, while the Matrix remains in the Structure pane and the right pane is reserved for materials attached to the selected matrix cell. Users see labels, material titles, descriptions, and Editor.js content; they do not see raw UUIDs, raw JSON, or internal field names on normal surfaces.

The localized Structure edit dialog receives the full versioned localized content object for `Name` and `Description`, not a locale-formatted display string. It displays all authored locales and preserves them on save. Descriptions are multiline.

Cell styles use the scoped editor. A fill or text change is checked against the effective MUI foreground/background pair and is rejected with localized guidance if normal-size text is below WCAG AA 4.5:1. For untrusted externally stored malformed or inaccessible values, rendering falls back to black or white with maximum contrast against the resolved background without modifying data. Borders apply uniformly to all sides by default; an explicit advanced mode permits separate sides. Selection and focus retain an edge-aligned, unclipped non-colour signal.

Application settings do not infer Interpretation Network behavior from hardcoded LMS defaults. The settings page reads active materialized layout widgets; Matrix settings and `splitPane.enabled` are saved back to the `interpretationNetworkWorkspace` widget config, while Learning Content remains visible only for applications whose runtime state actually contains that configuration.

The `table`, `horizontalRows`, and `verticalTree` views present the same cell records. By default, Table view is hierarchy-first: the selected cell path becomes clickable cell-coloured breadcrumbs, the focused parent becomes the current table context, direct children become rows, and column headers are hidden unless enabled explicitly. Breadcrumb labels preserve their beginning and ellipsize their end when constrained; their accessible names remain complete. Breadcrumb clicks update selection, route state, visible children, and the Materials pane. When `tableProjection` is `independentAxes`, Table view uses user-authored `RowLabel` and `ColLabel` values as semantic headers; a missing `(RowKey, ColKey)` intersection remains an empty, localized table cell and is not persisted as a new record. User-facing surfaces hide UUIDs, axis keys, parent IDs, sort order, raw JSON, and internal product names.

## Workspace templates

A workspace-scoped table template can be created or copied inside the published app and then reused to instantiate a visible matrix. This is part of the Stage-1 product contract.

## Constraints

-   No IPFS in Stage 1.
-   No schema or template version bump.
-   No `CellColor` reference entity, superseded colour persistence grammar, or persisted pane ratio.
-   The basic template primitives remain the base; the workspace widget composes them instead of reviving demo dashboard surfaces.
-   Fixture and E2E validation use generated snapshots, minimal local Supabase, contract checks, and browser evidence for desktop and narrow layouts in EN and RU.
