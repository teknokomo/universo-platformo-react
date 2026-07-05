# Interpretation Network Runtime Structures And Focused Matrix Follow-up (2026-07-05)

> Status: IMPLEMENT in progress
> Scope: published Interpretation Network structures actions, table/card alignment, focused horizontal hierarchy rendering, and horizontal-row drag thresholds.

## Checklist

-   [x] S1. Inspect current Structures list/table/card, Matrix hierarchy rows, DnD threshold code, tests, and E2E flow.
-   [x] S2. Restore standard Structures action menus in table and card views with Edit/Delete actions and no raw technical fields.
-   [x] S3. Align Structures table description cells vertically with title cells.
-   [x] S4. Add focused horizontal hierarchy rendering so lower rows show only the selected path/selected cell children by default, while keeping full-level rendering configurable.
-   [x] S5. Fix horizontal-row DnD thresholds: no-op below 10%, child insertion from 10-50%, sibling reorder after the leading edge crosses 50%, and origin return without mutation.
-   [x] S6. Update focused Vitest/component and Playwright coverage, including runtime screenshots/overflow assertions on minimal local Supabase.
-   [x] S7. Run the previous slice's focused package tests/builds and fixture/isolation gates.
-   [x] S8. Preserve the selected hierarchy path after creating a nested child so the parent remains expanded and the new cell appears without reopening ancestors.
-   [x] S9. Add cross-level horizontal drop zones: left 25% inserts before, center 50% reparents as a child, and right 25% inserts after, at any higher hierarchy level.
-   [x] S10. Add focused unit/component regression coverage for nested creation and cross-level drop boundaries while preserving same-row 10/50 behavior and cycle rejection.
-   [x] S11. Run Prettier, focused test/build/fixture/isolation gates, browser evidence if required, OntoIndex diff verification, and Thermos/autoreview closeout.

## UI Contract

-   Structures table/card views expose the same user-facing actions pattern as existing Material cards/tables: a three-dot icon opens Edit/Delete actions, with destructive delete confirmation.
-   Structure title and description cells are vertically centered in table view and preserve the existing app-template density and typography.
-   Horizontal hierarchy rows render a focused path by default: no child row is shown until a cell in the current row is selected; then only that selected cell's children fill the next row, recursively by selected path.
-   A full-level horizontal hierarchy remains available as widget config for future/alternate layouts, but the Interpretation Network default is focused horizontal rows.
-   Horizontal drag detection has a stable dead-zone before 10% overlap, child placement from 10% through 50% leading-edge overlap, sibling placement after 50%, and no mutation when released back in the dead-zone/origin slot.
-   Saving a newly created child keeps its parent selected, preserving every already expanded ancestor row while the refreshed data adds the child to the visible next row.
-   Dragging a cell onto any higher horizontal row uses the hovered target's width: the left quarter inserts before it, the middle half reparents into it, and the right quarter inserts after it. Existing same-row overlap rules remain unchanged.
-   No page-level horizontal overflow, raw UUIDs, raw JSON, or untranslated action/drag labels are introduced.
