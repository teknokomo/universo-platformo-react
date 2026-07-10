# Interpretation Network Matrix Axis Dialogs (2026-07-09)

> Status: completed
> Scope: simplify Matrix Table row/column authoring and make new-axis creation from the cell dialog configurable without schema/template version bumps.

## UI Contract

-   Matrix Table `Add row` opens a dedicated localized dialog for a new row name only; it creates a cell in the new row using the selected cell column as context.
-   Matrix Table `Add column` opens a dedicated localized dialog for a new column name only; it creates a cell in the new column using the selected cell row as context.
-   The regular cell dialog hides `New row` and `New column` placement options unless widget/application configuration explicitly enables them.
-   The Interpretation Network fixture defaults this setting to disabled, so new metahubs/applications start with the simpler MVP workflow.
-   System fields remain hidden; no raw UUIDs/JSON/internal field names are exposed in normal runtime UI.
-   Existing Matrix Table DnD remains intact and E2E-covered.

## Checklist

-   [x] T1. Inspect current Matrix settings, cell placement dialog, tests, E2E fixture, and run OntoIndex impact for edited symbols.
-   [x] T2. Add a shared Matrix setting for allowing new row/column creation inside the cell dialog, with default disabled in the Interpretation Network template/fixture and application settings.
-   [x] T3. Implement dedicated Add row/Add column runtime dialogs and route table plus buttons to them.
-   [x] T4. Update cell dialog placement behavior so New row/New column radio options are hidden unless enabled by configuration.
-   [x] T5. Update focused unit/component/E2E tests and fixture contract for the simplified dialogs and default setting.
-   [x] T6. Run Prettier, focused tests/build/lint, local minimal Supabase E2E where feasible, OntoIndex diff verification, and autoreview.
-   [x] T7. Update `memory-bank/progress.md` with implementation and verification results.

# Interpretation Network Matrix Table UX Fixes (2026-07-09)

> Status: completed
> Scope: fix Matrix Table axis dialog spacing and allow moving a cell card into a free table intersection without schema/template version bumps.

## UI Contract

-   Matrix Table `Add row` and `Add column` dialogs use existing `apps-template-mui` MUI dialog primitives and standard action/content spacing; no extra duplicate shared dialog component is introduced.
-   The axis name field label must remain fully visible when focused and unfocused.
-   Matrix Table row/column plus actions are usable from the initial opened table state; if no cell was selected, they use the first visible table cell as the safe anchor context.
-   A free Matrix Table intersection is a valid drop target in table view.
-   Dropping an existing cell card into a free table intersection changes only table coordinates (`RowKey`, `RowLabel`, `ColKey`, `ColLabel`) and local row sort order; the existing parent-child relationship is preserved for MVP predictability.
-   A selected cell can be moved into a free table intersection through a keyboard-reachable empty-slot command as well as pointer drag/drop.
-   Occupied intersections remain protected from accidental overwrite.

## Checklist

-   [x] T1. Inspect current axis dialog and Matrix Table drag/drop implementation, including OntoIndex impact where available.
-   [x] T2. Fix axis dialog spacing using existing template/MUI primitives.
-   [x] T3. Enable free table intersection drops for hierarchical and independent Matrix Table modes while preserving parent links.
-   [x] T4. Add focused regression tests for table-slot drop behavior and dialog layout semantics.
-   [x] T5. Accept and remediate runtime UX QA findings for hidden selection prerequisites and keyboard-accessible empty-slot moves.
-   [x] T6. Run Prettier, focused tests/lint/build/guards, local minimal Supabase E2E where feasible, OntoIndex diff verification, and autoreview.
-   [x] T7. Update `memory-bank/progress.md` with implementation and verification results.
