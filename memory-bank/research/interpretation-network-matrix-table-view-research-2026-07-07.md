# Research: Interpretation Network Peer Matrix Views

> Created: 2026-07-07
> Updated: 2026-07-07
> Status: Reviewed against the current repository contract
> Follow-up plan: ../plan/interpretation-network-matrix-table-view-plan-2026-07-07.md

## Research Question

What is the correct configuration, data, interaction, and verification model for adding a semantic Table view to the Interpretation Network Matrix without creating a separate Matrix/Table feature split?

## Executive Finding

Table is one of three peer presentations of the same Matrix data:

-   `table`
-   `horizontalRows`
-   `verticalTree`

The authoritative configuration fields are `allowedMatrixViews` and `defaultMatrixView`. `matrixMode` remains an independent data-semantics setting:

-   `hierarchicalCells` supports all three views.
-   `independentRows` supports `table` and `horizontalRows`.
-   `verticalTree` is incompatible with `independentRows`.

The former `matrix | table` display model, `allowedDisplayModes`, `defaultDisplayMode`, and the rule that Table is limited to `hierarchicalCells` are obsolete and must not appear in implementation guidance.

## Source Inventory

| Source                                                                                                                    | Type                          | Evidence                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/universo-react-types/src/common/applicationLayouts.ts`                                                          | Authoritative shared contract | Defines the three Matrix views, non-empty normalization, allowed default, and `verticalTree` compatibility rule.                   |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts`                  | Canonical template            | Seeds all three views with `table` as the default and keeps `matrixMode: hierarchicalCells`.                                       |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/model.ts`                      | Runtime model                 | Parses the shared view contract and maps stored Matrix records into view data.                                                     |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/MatrixWorkspace.tsx` | Runtime composition           | Exposes Table, Horizontal rows, and Vertical tree as peer toolbar choices.                                                         |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/MatrixTableView.tsx` | Table renderer                | Uses semantic table headers, localized empty intersections, stable hidden keys, local overflow, selection, actions, and DnD hooks. |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/CellEditDialog.tsx`            | Cell authoring                | Resolves flexible `RowLabel`, `ColLabel`, `CellValue`, and `CellDescription` fields and keeps description multiline.               |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/matrixMove.ts`                 | Movement contract             | Preserves user-authored cell content and supports explicit empty table destinations for independent rows.                          |
| `packages/universo-react-applications-frontend/src/pages/application-settings/MatrixSettingsPanel.tsx`                    | Application override UI       | Configures a non-empty allowed view subset and an allowed default, with compatibility feedback.                                    |
| `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/InterpretationNetworkWorkspaceWidgetEditorDialog.tsx`   | Metahub authoring UI          | Uses the same shared contract before materialization.                                                                              |
| `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`                                                       | Fixture gate                  | Requires all three seeded views and `table` as the default in the generated product snapshot.                                      |
| `docs/en/architecture/interpretation-network-data-model.md`                                                               | Architecture documentation    | Records the shared storage model, flexible fields, compatibility, empty-intersection behavior, and no-version-bump rule.           |
| `https://lmn.rs/` and linked numbered table families                                                                      | Domain reference              | Demonstrate that named axes, colored cells, and table layouts are first-class domain representations.                              |

## Confirmed Contract

### View Configuration

-   `allowedMatrixViews` is a non-empty, deduplicated subset of `table`, `horizontalRows`, and `verticalTree`.
-   `defaultMatrixView` must be a member of `allowedMatrixViews`.
-   Normalization preserves declaration order from the authoritative view list.
-   Invalid or empty input falls back to `horizontalRows`.
-   A configured default that is absent or incompatible falls back to the first normalized allowed view.
-   The shared schema and normalizer belong in `@universo-react/types`; runtime, Metahub, Application settings, tests, fixtures, and documentation consume the same semantics.

### Compatibility With `matrixMode`

`matrixMode` describes record relationships, not presentation:

| `matrixMode`        | `table`   | `horizontalRows` | `verticalTree` |
| ------------------- | --------- | ---------------- | -------------- |
| `hierarchicalCells` | Supported | Supported        | Supported      |
| `independentRows`   | Supported | Supported        | Not supported  |

Changing a view must not rewrite cell hierarchy, axis keys, persisted order, materials, relations, or other Matrix records.

### Flexible Cell Content

The visible Table axes and content are user-authored metadata, not fixed display strings:

-   `RowLabel` supplies the localized row header.
-   `ColLabel` supplies the localized column header.
-   `CellValue` supplies the localized cell title.
-   `CellDescription` supplies an optional localized multiline description.

Creation, editing, movement, and rendering must preserve those values. System-owned `CellId`, `ParentCellId`, `RowKey`, `ColKey`, `_tp_sort_order`, raw row IDs, and widget IDs remain hidden from normal user surfaces.

### Empty Table Intersections

A missing `(RowKey, ColKey)` pair is a visual empty slot, not a persisted placeholder record.

-   In `independentRows`, an occupied cell may be dropped into an empty Table slot. The move reuses that slot's existing row and column keys and labels while preserving the cell title, description, styles, identity, and material relation.
-   In `hierarchicalCells`, empty Table slots are display-only and are not DnD targets because hierarchy movement requires an existing semantic cell target.
-   Empty slots must remain localized and accessible in both modes.

### Runtime UX

-   The toolbar shows only allowed views and hides the switcher when only one view is available.
-   Runtime switching is transient and retains selection and the Materials pane state.
-   Table uses semantic row and column headers, stable internal keys, accessible cell names, selected state, styles, material summaries, action menus, and permission gates.
-   Horizontal scrolling is contained by the Table component; the page shell must not overflow horizontally.
-   Cell title, row, column, and description remain editable through user-facing controls; semantic descriptions are multiline.
-   No raw UUID, axis key, relation ID, config key, JSON, internal validation message, or legacy product name is displayed.

## Architecture Placement

-   **Metahub** owns canonical widget defaults and field metadata.
-   **Application control panel** owns deployment-specific `allowedMatrixViews` and `defaultMatrixView` overrides for materialized widgets.
-   **Published workspace** owns Structures, Matrix cells, Materials, Relations, selection, authoring, movement, and transient view switching.

The dedicated Interpretation Network template composes existing Hub, Page, Object, Set, and Enumeration presets. No new preset, custom entity type, database schema, or runtime storage model is needed.

## Versioning And Compatibility

This change is an in-place configuration and UI correction:

-   no legacy `allowedDisplayModes` or `defaultDisplayMode` compatibility path;
-   no separate `displayMode: matrix | table` contract;
-   no database migration;
-   no package or repository version bump;
-   no snapshot schema version bump;
-   no Metahub template version bump;
-   no minimum structure version bump.

Existing missing or invalid view configuration is handled by the shared normalizer rather than by preserving obsolete fields.

## Fixture And Browser Evidence

The committed Interpretation Network snapshot must be regenerated through the product Playwright generator on the minimal local Supabase profile. Hand-editing the fixture is not acceptable.

Required evidence:

-   generated snapshot passes the Interpretation Network fixture contract;
-   normalized generated output matches the committed fixture;
-   all three views are available for `hierarchicalCells`;
-   only Table and Horizontal rows remain available for `independentRows`;
-   Table renders flexible row, column, title, and multiline description data;
-   occupied-cell DnD works in supported views;
-   empty-slot Table DnD works only for `independentRows`;
-   view switching preserves selection and Materials context;
-   EN and RU labels and validation are localized;
-   desktop, tablet, and mobile screenshots show no page-level horizontal overflow.

## Superseded Assumptions

Remove these assumptions from plans, tests, and documentation:

-   Table is a secondary mode inside a separate Matrix display.
-   `MatrixDisplayMode` is `matrix | table`.
-   configuration uses `allowedDisplayModes` and `defaultDisplayMode`.
-   Table is available only for `hierarchicalCells`.
-   `independentRows` must normalize to Matrix-only presentation.
-   Table DnD requires a future fallback instead of using the established movement contract.
-   row and column labels are derived or fixed rather than user-authored.
-   a schema, template, or legacy compatibility version bump is needed.

## Recommended Decision

Use `allowedMatrixViews` and `defaultMatrixView` everywhere, sourced from `@universo-react/types`. Treat Table, Horizontal rows, and Vertical tree as interchangeable presentations over one Matrix record model. Keep `matrixMode` independent, exclude only `verticalTree` for `independentRows`, and enable empty-slot Table drops only for `independentRows`.

The canonical Interpretation Network template should allow all three views and open `table` by default. Acceptance requires fixture regeneration plus browser-visible proof, not only unit tests.
