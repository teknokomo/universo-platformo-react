# Interpretation Network Matrix Visual And Drop Follow-up (2026-07-12)

> Status: in_progress
> Scope: fix Matrix cell selection visibility, hierarchical table spacing, total cell counter wording/coverage, and center-zone drop-to-child behavior.

## UI Contract

-   Selected Matrix cell cards render a visible focus/selection outline that is not clipped in hierarchical table, horizontal rows, or vertical tree views.
-   Hierarchical table row-header cards keep a small stable gap before child-cell columns.
-   The total tree-cell counter uses localized wording equivalent to "Total N cells in the structure" and appears in every Matrix view when the setting is enabled.
-   Hierarchical drag/drop uses center-zone nesting for child placement and edge zones for before/after sibling placement.
-   Runtime UI remains localized, template-style, and covered by focused tests.

## Checklist

-   [x] T1. Inspect Matrix view rendering, DnD placement logic, i18n, and run OntoIndex impact for edited symbols.
-   [x] T2. Fix selected-card outline visibility and hierarchical table row/child spacing.
-   [x] T3. Update total-cell counter wording and render it across all Matrix views behind the existing setting.
-   [x] T4. Adjust hierarchical DnD hit-zone logic so center means nesting and edges mean sibling placement.
-   [x] T5. Add reliable Vitest coverage for selection styling, spacing, counter coverage/wording, and DnD placement.
-   [x] T6. Run Prettier, focused tests, fixture contract, OntoIndex diff verification, and autoreview.
