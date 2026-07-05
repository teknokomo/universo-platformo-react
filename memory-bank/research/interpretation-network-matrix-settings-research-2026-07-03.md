# Research: Interpretation Network Matrix And Settings Runtime UX

> Created: 2026-07-03
> Status: Draft
> Trigger: PLAN request for Interpretation Network matrix modes, drag-and-drop UX, metadata-driven settings, and snapshot regeneration
> Follow-up plan: ../plan/interpretation-network-matrix-settings-plan-2026-07-03.md

## Research Question

Which current library and repository patterns should guide the implementation of a metadata-driven Interpretation Network matrix with hierarchical child-cell authoring, predictable drag-and-drop, settings visibility based on application/metahub capabilities, and Playwright-generated snapshot validation?

## Source Inventory

| Source                                                                                                           | Type                                | Date / Freshness                           | Why It Matters                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/multiple-sortable-lists.mdx           | Primary library docs via Context7   | Queried 2026-07-03                         | Documents `DndContext`, sensors, `SortableContext`, cross-container logic, and `DragOverlay` patterns for React drag-and-drop.        |
| https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/sortable-state-management.mdx         | Primary library docs via Context7   | Queried 2026-07-03                         | Confirms explicit sortable state management on drag end.                                                                              |
| https://github.com/clauderic/dnd-kit/blob/main/dnd-kit/apps/docs/docs/react/components/drag-drop-provider.mdx    | Primary library docs via Context7   | Queried 2026-07-03                         | Confirms pointer and keyboard sensor support for accessible dragging.                                                                 |
| https://github.com/mui/material-ui/blob/master/packages/mui-material/src/Button/Button.js                        | Primary library source via Context7 | Queried 2026-07-03                         | Confirms supported `Button` icon, variant, color, size, and loading props used by existing template-style actions.                    |
| https://github.com/mui/material-ui/blob/master/docs/data/material/components/menus/BasicMenu.tsx                 | Primary library docs via Context7   | Queried 2026-07-03                         | Confirms accessible button-triggered menu pattern for matrix action menus.                                                            |
| https://github.com/microsoft/playwright/blob/main/docs/src/input.md                                              | Primary library docs via Context7   | Queried 2026-07-03                         | Confirms `Locator.dragTo()` and lower-level mouse APIs for drag-and-drop E2E proof.                                                   |
| https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locatorassertions.md                        | Primary library docs via Context7   | Queried 2026-07-03                         | Confirms `toHaveScreenshot()` waits for stable locator screenshots before comparison.                                                 |
| `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`    | Local code                          | Current working tree, inspected 2026-07-03 | Owns structure creation, default matrix cell creation, matrix add buttons, dnd-kit setup, drag-end persistence, and matrix rendering. |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/model.ts`             | Local code                          | Current working tree, inspected 2026-07-03 | Owns `MatrixCell`, config defaults, row parsing, style mapping, and default child-row data creation.                                  |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/MatrixCellButton.tsx` | Local code                          | Current working tree, inspected 2026-07-03 | Owns the current sortable matrix cell card, drag handle, menu button, and visual drag state.                                          |
| `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx`                                | Local code                          | Current working tree, inspected 2026-07-03 | Currently renders the Learning Content tab unconditionally in the application control panel.                                          |
| `packages/universo-react-applications-frontend/src/settings/dialogSettings.ts`                                   | Local code                          | Current working tree, inspected 2026-07-03 | Currently includes `learningContent` in default saved application settings.                                                           |
| `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`                                              | Local code                          | Current working tree, inspected 2026-07-03 | Owns snapshot contract checks for the Interpretation Network fixture.                                                                 |
| `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`                          | Local code                          | Current working tree, inspected 2026-07-03 | Owns the product Playwright generator for the committed fixture.                                                                      |

## Key Findings

-   Fact: dnd-kit supports the exact building blocks needed for a predictable matrix drag contract: pointer and keyboard sensors, explicit sortable contexts, cross-container `onDragOver`/`onDragEnd` state, and a `DragOverlay`.
-   Fact: Playwright supports both high-level `Locator.dragTo()` and lower-level mouse APIs, so the implementation can test drag preview/drop-target behavior without depending only on unit tests.
-   Fact: Playwright screenshot assertions wait for visual stability before comparison; this fits the requested screenshot proof for matrix drag states and final layout.
-   Fact: The current Interpretation Network runtime already uses `@dnd-kit/core` and `@dnd-kit/sortable`, but only persists the final move in `handleMatrixDragEnd`; it does not model an explicit hover insertion target or render a stable drop indicator.
-   Fact: The first matrix child row is created in `createStructureMutation` by calling `buildDefaultMatrixCellData(..., { row: Definition, column: Meaning })`; `buildDefaultMatrixCellData` then makes `CellValue` default to `labels.value ?? labels.column`.
-   Fact: `createLocalizedContent(locale, value)` stores only one active locale. For the first default cell, the requested `Universe` / `Вселенная` should use an explicit bilingual VLC helper such as `buildVLC('Universe', 'Вселенная')` or a local equivalent, not only the current active locale.
-   Fact: Matrix visual rows are derived from child rows grouped by `RowKey`; persisted rows are TABLE child rows under the selected `Interpretation`, with `_tp_parent_id` and `_tp_sort_order` managed by runtime child-row endpoints.
-   Fact: The current add buttons are local outlined matrix actions on the left; existing catalog actions use a shared `CatalogToolbar` and MUI `Button` style for `Create`.
-   Fact: `ApplicationSettings` unconditionally includes a `learningContent` tab, and `DEFAULT_APPLICATION_DIALOG_SETTINGS` always includes `DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS`. This is hardcoded application-control-panel behavior, not metahub-capability driven behavior.
-   Fact: The Interpretation Network Playwright generator and fixture contract already exist and cover many template/runtime assumptions, but there is no generated-vs-committed drift check equivalent to `check:mmoomm-app-fixture-drift`.

## Conflicts And Uncertainty

-   The desired product naming for the two matrix modes is not yet confirmed. Recommended implementation labels are "Independent rows" / "Независимые строки" for the current mode and "Hierarchical cells" / "Иерархические ячейки" for the new primary mode.
-   The current data model can support hierarchy by adding child metadata such as `ParentCellId`, `Depth`, and sibling sort order, but the exact persisted shape should be finalized during implementation after OntoIndex impact checks and runtime schema generation review.
-   The user said schema/template versions should not be bumped and the test DB will be recreated. The plan therefore assumes direct metadata/template changes are acceptable without migration compatibility shims.

## Project Implications

-   Keep published runtime UI in `packages/universo-react-apps-template-mui` and preserve its isolation from `@universo-react/template-mui`.
-   Move reusable matrix behavior out of the large `InterpretationNetworkWorkspaceWidget.tsx` into local hooks/utilities/components inside the same package before the component grows further.
-   Represent matrix behavior mode in metadata/application runtime settings, not in hardcoded widget-only state.
-   Replace unconditional Learning Content settings rendering with a capability-driven settings registry, where LMS contributes Learning Content settings and Interpretation Network contributes Matrix settings.
-   Extend product generator, fixture contract, import flow, visual flow, unit tests, and local-Supabase gate scripts together.

## Recommended Decision

Implement the new matrix behavior as a metadata-driven matrix mode with two supported values:

-   `independentRows`: current behavior, where users can add rows and cells independently.
-   `hierarchicalCells`: new default for Interpretation Network, where users add children only from a selected parent cell and every cell except the root has a parent.

Use dnd-kit with an explicit drag state model: active cell, target cell, placement, allowed operation, `DragOverlay`, and visible drop indicator. Persist hierarchy and order through existing TABLE child-row endpoints where possible, extending child fields and row-update tests as needed. Make control-panel settings capability-driven so non-LMS applications do not show Learning Content settings.

## Open Questions Before PLAN

None. The plan can proceed with the recommended names as implementation defaults, while keeping labels in i18n so they can be changed without structural rewrites.

## Sources

-   https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/multiple-sortable-lists.mdx
-   https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/sortable-state-management.mdx
-   https://github.com/clauderic/dnd-kit/blob/main/dnd-kit/apps/docs/docs/react/components/drag-drop-provider.mdx
-   https://github.com/mui/material-ui/blob/master/packages/mui-material/src/Button/Button.js
-   https://github.com/mui/material-ui/blob/master/docs/data/material/components/menus/BasicMenu.tsx
-   https://github.com/microsoft/playwright/blob/main/docs/src/input.md
-   https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locatorassertions.md
