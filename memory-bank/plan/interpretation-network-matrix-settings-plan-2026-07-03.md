# Interpretation Network Matrix And Settings Plan

> Created: 2026-07-03
> Status: QA-updated draft for discussion
> Research: ../research/interpretation-network-matrix-settings-research-2026-07-03.md
> Mode: PLAN only; do not implement until approved

## Overview

Improve the existing Interpretation Network published application by making the matrix behavior configurable and metadata-driven, changing the first runtime-created matrix cell from `Meaning` / `Смысл` to `Universe` / `Вселенная`, replacing the fragile drag-and-drop UX with an explicit sortable/drop-target contract, removing LMS-only settings from non-LMS application control panels, and regenerating `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` through the product Playwright generator.

The implementation should preserve the original `packages/universo-react-apps-template-mui` MUI dashboard style, reuse existing runtime primitives, avoid legacy compatibility shims, avoid schema/template version bumps, and treat the test database as disposable.

## Affected Areas

-   `packages/universo-react-apps-template-mui`
    -   `src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`
    -   `src/dashboard/components/interpretation-network/model.ts`
    -   `src/dashboard/components/interpretation-network/MatrixCellButton.tsx`
    -   new local matrix components/hooks/utilities under `src/dashboard/components/interpretation-network/`
    -   `src/i18n/locales/en/interpretationNetwork.json`
    -   `src/i18n/locales/ru/interpretationNetwork.json`
    -   existing widget/unit tests
-   `packages/universo-react-applications-frontend`
    -   `src/pages/ApplicationSettings.tsx`
    -   `src/settings/dialogSettings.ts`
    -   `src/types.ts`
    -   application settings i18n files
    -   `ApplicationSettings` tests
-   `packages/universo-react-applications-backend`
    -   application settings save/sanitize contracts for removing accidental LMS default injection
    -   application layout widget config routes if the Matrix mode editor writes materialized widget config
    -   runtime child-row tests for hierarchy/order operations
-   `packages/universo-react-metahubs-backend`
    -   `src/domains/templates/data/interpretation-network.stage2.ts`
    -   `src/domains/templates/data/interpretation-network.template.ts`
    -   interpretation network template shape tests
-   Shared packages, only if justified
    -   `packages/universo-react-types` for stable matrix mode and typed `interpretationNetworkWorkspace` widget config schema
    -   `packages/universo-react-utils` if a reusable bilingual VLC helper is needed beyond existing `buildVLC`
-   E2E and fixtures
    -   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`
    -   `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`
    -   `tools/testing/e2e/support/checkInterpretationNetworkFixtureContract.ts`
    -   new `checkInterpretationNetworkFixtureDrift.ts`
    -   import/runtime/visual specs for matrix modes and settings
    -   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
-   Documentation
    -   `packages/universo-react-apps-template-mui/README.md`
    -   `packages/universo-react-applications-frontend/README.md`
    -   `tools/testing/e2e/README.md`
    -   `tools/testing/e2e/README-RU.md`
    -   `docs/en/...` and `docs/ru/...` GitBook pages for Interpretation Network matrix behavior and application settings

## Architecture Decisions

1. Matrix mode names:
    - `independentRows` — current behavior. EN: "Independent rows"; RU: "Независимые строки".
    - `hierarchicalCells` — new primary behavior. EN: "Hierarchical cells"; RU: "Иерархические ячейки".
    - These labels are i18n copy, not a final product naming lock; they can be changed without changing the stored mode IDs.
2. Interpretation Network default mode:
    - Use `hierarchicalCells` for the generated template/snapshot and newly created Interpretation Network apps.
    - Keep `independentRows` as an explicit compatibility-free option for users who choose that mode in Matrix settings.
3. Ownership:
    - Metahub layout metadata defines the `interpretationNetworkWorkspace` widget and its default `matrixMode`.
    - Application control panel can tune the deployed instance by editing the materialized widget config when that widget exists.
    - Workspace owns user-authored structures, cells, materials, and hierarchy.
4. Settings:
    - Replace unconditional LMS `learningContent` control-panel rendering with derived settings visibility.
    - Derive visible configuration-specific settings from materialized application state such as `schema_snapshot`, `installed_release_metadata`, `_app_widgets`, or a backend-derived read-only `settingsCapabilities` summary.
    - Do not persist capability flags as the source of truth in `application.settings`.
    - Learning Content settings appear only for applications whose installed/materialized runtime state exposes learning-content functionality.
    - Interpretation Network Matrix settings appear only when the installed/materialized app contains the `interpretationNetworkWorkspace` widget.
5. Data model:
    - Add metadata fields to the matrix TABLE child row shape for hierarchy:
        - `ParentCellId` hidden nullable `STRING` pointing to another stable `CellId`; avoid `REF` unless TABLE-child-to-TABLE-child semantics are proven.
        - `Depth` derived display value by default; persist only if query/performance needs prove it necessary.
        - Use existing `_tp_sort_order` for sibling order first; add `SiblingSortOrder` only if `_tp_sort_order` cannot represent sibling-local order safely.
    - Keep `CellId` as UUID v7.
    - `CellId`, `ParentCellId`, depth, and sort fields are hidden/system-owned. They must not render as normal editable fields, normal table columns, card labels, or user-facing UUID text.
    - No platform DB migration and no template version bump; metadata changes still require connector sync/diff coverage and regenerated disposable fixtures/test DB.

## UI Contract

### Matrix Workspace

-   First created Structure creates the first matrix row at runtime inside `createStructureMutation`, not as seeded fixture content.
-   The first runtime-created root cell is labeled `Universe` in English and `Вселенная` in Russian after create and after reload.
-   In `hierarchicalCells` mode, users cannot create an arbitrary row/cell from empty space; they select a cell and use `Add child`.
-   In `independentRows` mode, users can use the existing row/cell creation affordances, renamed and placed consistently.
-   Normal runtime surfaces expose no raw IDs, raw JSON, `[object Object]`, or hidden-knowledge workflows.
-   Text is localized in EN/RU from the first implementation slice.
-   No page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`; component-internal constrained scrolling is allowed only where the existing DataGrid contract already allows it.

### Matrix Cell Card

-   The visible card shows human cell text, optional material/status affordances, drag handle, selection state, and action menu.
-   `CellId`, `ParentCellId`, row keys, column keys, sort order, version fields, raw JSON, and UUID-only labels are hidden from normal users.
-   The drag handle has localized accessible text and remains keyboard focusable.
-   The action menu provides a keyboard-only path for add child, edit, delete, and precise move/reorder operations.

### Matrix Toolbar

-   Matrix add actions are right-aligned and use the same contained/primary MUI `Button` style, icon density, and spacing as existing `Create` actions.
-   Reuse order is mandatory:
    -   first check local `apps-template-mui` primitives such as `CatalogToolbar`, `FormDialog`, `ConfirmDeleteDialog`, `CustomizedDataGrid`, and existing dashboard section layout patterns;
    -   for `applications-frontend` control-panel pages, reuse the current `ViewHeaderMUI`, `PAGE_TAB_BAR_SX`, `PAGE_CONTENT_GUTTER_MX`, and existing settings-row patterns;
    -   create a new `RuntimeSectionToolbar` only inside `apps-template-mui` if the existing primitives cannot express the matrix action layout, and document that reason in the implementation notes.
-   In `hierarchicalCells` mode, the toolbar exposes a single primary `Add child` action. With no selected cell it is disabled and has a localized explanation.
-   In `independentRows` mode, the toolbar exposes exactly two actions: `Add row` and `Add cell in row`.

### Matrix Settings

-   Matrix settings are capability-driven, never shown inside the LMS `Learning Content` tab.
-   Control type: compact select or segmented control with exactly `hierarchicalCells` and `independentRows`.
-   Default: `hierarchicalCells` in the `interpretationNetworkWorkspace` seed zone-widget config unless existing materialized widget config explicitly says otherwise.
-   Save behavior: persisted by updating the materialized `interpretationNetworkWorkspace` widget config through existing layout/widget config APIs, not by adding a parallel `application.settings` source of truth.
-   Empty/unsupported behavior: before connector/sync materializes the widget, show only generic settings and do not save matrix defaults.
-   Loading/disabled/error states are localized and user-facing; no raw Zod/internal validation messages are allowed.
-   The current mode may be mirrored read-only in the matrix toolbar, but the authoritative editable control belongs to the capability-driven settings surface.

### Drag And Drop States

-   Dragging shows:
    -   a stable `DragOverlay` card preview;
    -   the original slot in a muted state;
    -   a visible insertion/drop indicator with stable test id;
    -   invalid targets as disabled/no-drop, not as surprising jumps.
-   Keyboard users must have both a stable action-menu path and dnd-kit `KeyboardSensor` coverage if pointer drag remains the primary interaction.
-   Invalid self/descendant moves do not mutate local state, do not call batch persistence, and show localized feedback if feedback is visible.

### Application Settings

-   Generic settings remain available where applicable.
-   `Learning Content` appears only when installed/materialized runtime state exposes learning-content functionality.
-   Matrix settings appear only when materialized application layouts contain `interpretationNetworkWorkspace`.
-   Save payloads for non-LMS applications do not inject default `learningContent`.
-   All visible labels, empty states, and validation errors are localized in EN/RU.
-   `apps-template-mui` stays isolated from `@universo-react/template-mui` and legacy feature packages; visual consistency with the original MUI template does not permit importing legacy UI into `apps-template-mui`.

## Plan Steps

### Phase 0: Pre-Implementation Safety

-   [ ] Re-run OntoIndex status and impact checks before edits:
    -   `pnpm ontoindex:status`
    -   impact for `InterpretationNetworkWorkspaceWidget`
    -   impact for `buildDefaultMatrixCellData`
    -   impact for `toMatrixRows`
    -   impact for `MatrixCellButton`
    -   impact for `ApplicationSettings`
    -   impact for `sanitizeApplicationDialogSettingsForSave`
    -   impact for backend runtime child-row controller symbols if persistence changes.
-   [ ] If any impact result is HIGH or CRITICAL, stop and report the blast radius before editing.
-   [ ] Check dirty worktree and keep all edits narrowly scoped.

### Phase 1: Matrix Domain Model

-   [ ] Move matrix-specific constants/types out of the large widget into local files:
    -   `matrixMode.ts`
    -   `matrixTree.ts`
    -   `matrixDnd.ts`
    -   `matrixDefaults.ts`
-   [ ] Add stable shared type names, preferably in `@universo-react/types` only if consumed outside `apps-template-mui`.
-   [ ] Extend `InterpretationNetworkWorkspaceConfig` with matrix settings:
    -   `matrixMode?: 'hierarchicalCells' | 'independentRows'`
    -   `matrixDefaultRootTitle?: VLC`
    -   optional field codenames for parent/depth/sibling order.
-   [ ] Add a typed `interpretationNetworkWorkspace` widget config schema in `@universo-react/types/src/common/applicationLayouts.ts` and route it through `parseApplicationLayoutWidgetConfig()`.
-   [ ] Update template/layout validation tests so unknown widget config keys are rejected and known matrix config keys are preserved.
-   [ ] Update `toConfig()` to merge metadata defaults safely and reject unknown mode strings.
-   [ ] Update `toMatrixRows()` to parse hierarchy metadata while preserving the current flat shape for independent mode.
-   [ ] Add pure utilities:
    -   build tree from cells;
    -   flatten visible rows;
    -   calculate allowed child insertion;
    -   calculate sibling reorder;
    -   prevent a cell from being moved under itself or a descendant.

Example safe mode parser:

```ts
export const MATRIX_MODES = ['hierarchicalCells', 'independentRows'] as const
export type MatrixMode = (typeof MATRIX_MODES)[number]

export const parseMatrixMode = (value: unknown): MatrixMode =>
    value === 'independentRows' || value === 'hierarchicalCells' ? value : 'hierarchicalCells'
```

### Phase 2: Bilingual Default Root Cell

-   [ ] Change the initial structure-created cell from `Definition`/`Meaning` to one root cell with `Universe`/`Вселенная`.
-   [ ] Use bilingual VLC content, not only `createLocalizedContent(locale, ...)`.
-   [ ] Keep generated `CellId` as UUID v7.
-   [ ] Keep committed Interpretation Network fixture free of seeded runtime Structure/Interpretation/Material rows; `Universe` is created by the runtime Structure flow.
-   [ ] Update EN/RU i18n keys:
    -   `workspace.defaults.universe`
    -   `workspace.matrixModes.hierarchicalCells`
    -   `workspace.matrixModes.independentRows`
    -   `workspace.cell.addChild`
    -   `workspace.cell.addRow`
    -   `workspace.cell.addSibling`
    -   drag/drop status labels.
-   [ ] Update unit tests that currently expect `Meaning` / `Смысл`.
-   [ ] Update existing browser tests that currently assert `Meaning` so they assert `Universe` in EN, `Вселенная` in RU, and the same value after reload.

Example default helper:

```ts
import { buildVLC } from '@universo-react/utils'

const buildRootUniverseCell = (childColumns: RuntimeColumnLike[]) =>
    buildDefaultMatrixCellData(childColumns, 'en', {
        row: 'Universe',
        column: 'Universe',
        value: 'Universe',
        localizedValue: buildVLC('Universe', 'Вселенная')
    })
```

Implementation detail: adapt the exact helper signature so it does not duplicate `CellValue`, `RowLabel`, and `ColLabel` logic inconsistently.

### Phase 3: Matrix Actions And Settings UX

-   [ ] Replace the left-aligned matrix button rail with a right-aligned action toolbar that reuses the template action style.
-   [ ] In `hierarchicalCells` mode:
    -   show one primary `Add child` action only when a cell is selected;
    -   disable it with a localized explanation when no cell is selected;
    -   keep root creation automatic through structure creation, not manual.
-   [ ] In `independentRows` mode:
    -   keep two actions but rename them clearly:
        -   EN: `Add row`, `Add cell in row`;
        -   RU: `Добавить строку`, `Добавить ячейку в строку`.
-   [ ] Add a compact matrix mode setting:
    -   Prefer application-control-panel Matrix settings when the materialized `interpretationNetworkWorkspace` widget exists.
    -   Optionally mirror read-only current mode inside the matrix toolbar.
-   [ ] Persist Matrix mode by updating the widget config through existing layout/widget config APIs, with optimistic UI and reload proof.
-   [ ] Reuse `CatalogToolbar` patterns where practical, or extract a generic local `RuntimeSectionToolbar` only inside `apps-template-mui` after documenting why existing primitives are insufficient.
-   [ ] Add stable test ids for the matrix toolbar, mode selector, root cell, drag overlay, muted origin slot, drop indicator, and invalid drop target.

Example toolbar shape:

```tsx
<Stack direction='row' justifyContent='flex-end' spacing={1} useFlexGap flexWrap='wrap'>
    <Button variant='contained' startIcon={<AddRoundedIcon />} disabled={!selectedCell}>
        {t('workspace.cell.addChild', 'Add child')}
    </Button>
</Stack>
```

### Phase 4: Drag-And-Drop Rework

-   [ ] Replace final-only drag placement inference with explicit drag state:
    -   `activeCellId`
    -   `overCellId`
    -   `dropOperation`
    -   `dropPlacement`
    -   `isValidDrop`
-   [ ] Use dnd-kit `DragOverlay` for the dragged card preview.
-   [ ] Render a visible drop indicator component near the target slot.
-   [ ] Render stable visual states that tests can assert:
    -   `DragOverlay` exists and is nonblank while dragging;
    -   source slot is muted and remains in place during drag;
    -   drop indicator marks the exact before/after/child placement;
    -   invalid self/descendant targets are visibly invalid.
-   [ ] Use a deterministic collision strategy suitable for rows/cards:
    -   start with `closestCenter`;
    -   add custom placement math if half-cell before/after insertion is needed.
-   [ ] In `hierarchicalCells` mode, allowed operations:
    -   drag onto a cell to become a child;
    -   drag between siblings to reorder;
    -   reject self/descendant moves.
-   [ ] In `independentRows` mode, preserve current row/cell reorder semantics but make insertion preview explicit.
-   [ ] Persist moves with batch updates and optimistic row versions.
-   [ ] Keep fallback menu actions for keyboard and precise moves.
-   [ ] Ensure invalid drops do not call `batchUpdateTabularRows`, do not mutate local order, and remain unchanged after reload.

Example drop guard:

```ts
export const canMoveCell = (tree: MatrixTree, sourceId: string, targetId: string): boolean => {
    if (sourceId === targetId) return false
    return !isDescendant(tree, targetId, sourceId)
}
```

### Phase 5: Derived Settings Visibility

-   [ ] Introduce derived settings visibility in `applications-frontend`:
    -   generic settings are always shown;
    -   limits are shown only when runtime schema/workspaces support them;
    -   Learning Content settings require installed/materialized learning-content runtime state;
    -   Matrix settings require a materialized `interpretationNetworkWorkspace` widget.
-   [ ] If a reusable backend summary is needed, expose read-only `settingsCapabilities` derived from materialized state; do not store capability flags in `application.settings`.
-   [ ] Remove unconditional `learningContent` from visible tabs.
-   [ ] Split generic defaults from capability-specific defaults.
-   [ ] Stop saving default `learningContent` settings for non-LMS applications unless existing settings already contain it or derived capabilities prove learning-content support.
-   [ ] Preserve backend server-managed/public runtime settings when saving generic settings.
-   [ ] Add a neutral empty state: if no materialized configuration-specific settings exist before connector sync, show only General/Connectors/Access/Limits as applicable.
-   [ ] Ensure Application Settings uses localized EN/RU labels and no raw config JSON.

Example visible-tab builder:

```ts
const buildVisibleSettingsTabs = (capabilities: DerivedApplicationSettingsCapabilities): SettingsTab[] => [
    'general',
    ...(capabilities.learningContent ? ['learningContent' as const] : []),
    ...(capabilities.interpretationNetworkMatrix ? ['matrix' as const] : []),
    'connectors',
    'access',
    ...(capabilities.workspaceLimits ? ['limits' as const] : [])
]
```

### Phase 6: Template And Snapshot Contract

-   [ ] Update Interpretation Network template metadata:
    -   `INTERPRETATION_NETWORK_SEED_ZONE_WIDGETS` sets `interpretationNetworkWorkspace.config.matrixMode` to `hierarchicalCells`;
    -   initial root label contract `Universe` / `Вселенная`;
    -   child-row hierarchy fields if needed;
    -   no LMS/learning-content capability marker leaks into Interpretation Network.
-   [ ] Do not bump platform schema/template versions; still verify runtime schema diff and connector sync behavior for TABLE child field metadata changes.
-   [ ] Extend `interpretationNetworkFixtureContract.ts` to assert:
    -   `interpretationNetworkWorkspace` widget config contains `matrixMode: 'hierarchicalCells'`.
    -   Learning Content settings/capability is absent.
    -   `InterpretationMatrix` includes hierarchy fields.
    -   hidden system fields use hidden/gridHidden/formHidden/serverOwned UI config.
    -   app layout still uses `interpretationNetworkWorkspace`.
-   [ ] Extend fixture contract/drift gate to fail on wrong default mode, missing matrix widget config, LMS capability leakage, missing hierarchy fields, or committed/generated mismatch.
-   [ ] Add generated-vs-committed drift script:
    -   `tools/testing/e2e/support/checkInterpretationNetworkFixtureDrift.ts`
    -   root script `check:interpretation-network-fixture-drift`.
-   [ ] Regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only through the Playwright generator.

### Phase 7: Unit And Integration Tests

-   [ ] Apps-template Vitest:
    -   `model.test.ts` for mode parsing, bilingual defaults, tree flattening, invalid drop prevention.
    -   `InterpretationNetworkWorkspaceWidget.test.tsx` for root default, mode-specific buttons, no raw IDs, right-aligned contained action placement, selected-cell child creation, and no left button rail regression.
    -   `MatrixCellButton` tests for drag handle accessibility, overlay props, muted origin state, drop indicator props, and invalid target state.
    -   Widget config parsing tests for `interpretationNetworkWorkspace` mode defaults and unknown-key rejection.
-   [ ] Applications-frontend Vitest:
    -   `ApplicationSettings.test.tsx` confirms Learning Content tab is hidden for Interpretation Network and visible for LMS.
    -   Matrix settings tab appears only when materialized `interpretationNetworkWorkspace` state exists.
    -   Save payload does not inject `learningContent` for non-LMS apps.
    -   Matrix mode save writes through the layout/widget config API or a backend-derived capability route, not by injecting unsupported generic settings.
-   [ ] Applications-backend tests:
    -   settings save preserves server-managed settings;
    -   settings save does not inject capability-specific defaults for unsupported application types;
    -   layout widget config update accepts typed Matrix settings only for `interpretationNetworkWorkspace`;
    -   child-row batch updates preserve hierarchy and version checks.
-   [ ] Template tests:
    -   Interpretation Network template shape includes matrix capability and no LMS capability.
    -   snapshot fixture contract covers new metadata.
    -   `parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', ...)` accepts valid matrix config and rejects invalid modes.

### Phase 8: Playwright UX And Fixture Tests

-   [ ] Add a focused runtime matrix flow instead of growing the already large import flow:
    -   create structure;
    -   verify `Universe` / `Вселенная` in EN/RU after create and after reload;
    -   add children in hierarchical mode;
    -   attempt invalid arbitrary row/cell creation and verify it is unavailable;
    -   drag child to another parent with visible `DragOverlay`, muted origin slot, and exact drop indicator;
    -   attempt invalid self/descendant drop and verify no mutation request and no state change;
    -   reorder siblings;
    -   reload and verify hierarchy/material links persist.
-   [ ] Add independent mode E2E coverage:
    -   switch to `independentRows`;
    -   verify two add actions;
    -   create row/cell;
    -   drag with drop indicator.
-   [ ] Add settings E2E:
    -   imported Interpretation Network app does not show Learning Content settings;
    -   Matrix settings are visible only after sync/materialization exposes `interpretationNetworkWorkspace`;
    -   changing Matrix mode persists through reload and affects runtime behavior.
-   [ ] Apply runtime UX oracles to all new matrix/settings browser flows:
    -   `expectNoTechnicalLeakage`;
    -   `expectNoDataGridTechnicalLeakage` where DataGrid surfaces are present;
    -   `expectSemanticFieldControls` for dialogs;
    -   `expectLocalizedValidation` for EN/RU validation states;
    -   `expectNoPageHorizontalOverflow` and the viewport matrix helper at desktop/tablet/mobile sizes.
-   [ ] Add visual screenshots:
    -   initial Universe root;
    -   add-child toolbar state;
    -   drag overlay + drop indicator;
    -   EN/RU and light/dark representative states.
-   [ ] Treat screenshots as assertions, not attachments only: use visible locators plus nonblank/screenshot comparison checks where stable.
-   [ ] Use Playwright CLI wrapper, not `pnpm dev`.
-   [ ] Use minimal local Supabase for final E2E gate:
    -   `pnpm supabase:e2e:start:minimal`
    -   `pnpm env:e2e:local-supabase`
    -   `pnpm doctor:e2e:local-supabase`
    -   E2E runner with `UNIVERSO_ENV_FILE=.env.e2e.local-supabase`.

### Phase 9: Documentation

-   [ ] Update `packages/universo-react-apps-template-mui/README.md`:
    -   matrix modes;
    -   dnd-kit interaction contract;
    -   materialized widget-config settings behavior.
-   [ ] Update `packages/universo-react-applications-frontend/README.md`:
    -   metadata-driven settings tabs;
    -   no unconditional LMS settings.
-   [ ] Update `tools/testing/e2e/README.md` and `README-RU.md`:
    -   generator, drift check, local-Supabase matrix commands.
-   [ ] Add GitBook docs:
    -   `docs/en/guides/interpretation-network-matrix.md`
    -   `docs/ru/guides/interpretation-network-matrix.md`
    -   `docs/en/architecture/materialized-application-settings.md`
    -   `docs/ru/architecture/materialized-application-settings.md`
-   [ ] Run docs checks:
    -   `pnpm docs:i18n:check`
    -   `pnpm docs:gitbook-screenshot-assets:check` if screenshot assets are added.

### Phase 10: Final Verification And Review

-   [ ] Focused validation:
    -   `pnpm --filter @universo-react/apps-template-mui test -- InterpretationNetworkWorkspaceWidget.test.tsx model.test.ts`
    -   `pnpm --filter @universo-react/applications-frontend test -- ApplicationSettings.test.tsx`
    -   relevant backend route/controller tests.
-   [ ] Package validation:
    -   `pnpm --filter @universo-react/apps-template-mui build`
    -   `pnpm --filter @universo-react/applications-frontend build`
    -   `pnpm --filter @universo-react/applications-backend build`
    -   `pnpm --filter @universo-react/metahubs-backend build`
-   [ ] Fixture validation:
    -   `pnpm run check:interpretation-network-fixture-contract`
    -   `pnpm run test:e2e:interpretation-network-fixture-gate`
    -   `pnpm run check:interpretation-network-fixture-drift`
-   [ ] Browser validation:
    -   `pnpm run build:e2e:local-supabase`
    -   focused interpretation-network runtime Playwright flows.
-   [ ] Quality gates:
    -   `pnpm run check:apps-template-isolation`
    -   `pnpm run check:runtime-no-lms-forks`
    -   `pnpm ontoindex:changes`
    -   Thermos/autoreview closeout for the final diff.

## Potential Challenges

-   `InterpretationNetworkWorkspaceWidget.tsx` is already large. The implementation should extract pure matrix logic before adding hierarchy features, otherwise the component will become harder to test and review.
-   Hierarchical rows can be represented as a tree or as nested visual tables. The first implementation should persist parent/sibling metadata and render an indented tree-matrix; deeper nested child tables can be added later if product needs require literal nested table components.
-   Drag-and-drop tests can be flaky if they assert only final order. They must assert visible drag state, drop indicator, and persisted result after reload.
-   Materialized configuration-specific settings may not be available before connector sync. The UI should degrade to generic settings only, not show LMS defaults.
-   `ApplicationSettings` tests previously had timeout/noisy runs in a prior rollout. Keep validation targeted and fix real blockers rather than treating broad warnings as success.

## Dependencies

-   Node 22 for local validation.
-   Existing dnd-kit dependencies in `apps-template-mui`; no new DnD library is needed.
-   MUI v7 and existing MUI dashboard primitives.
-   Playwright runner at `tools/testing/e2e/run-playwright-suite.mjs`.
-   Minimal local Supabase for final browser/generator proof.

## Acceptance Criteria

-   A newly created Interpretation Network structure opens with one root cell `Universe` / `Вселенная`.
-   Hierarchical mode is the default in the generated Interpretation Network snapshot.
-   Users add child cells from selected cells; arbitrary row creation is unavailable in hierarchical mode.
-   Independent mode remains available and clearly named.
-   Matrix add actions are right-aligned and visually consistent with existing template `Create` buttons.
-   Dragging has stable preview, visible target indicator, valid/invalid target behavior, keyboard fallback, and persisted result after reload.
-   Non-LMS application settings do not show Learning Content.
-   Matrix settings are driven by materialized `interpretationNetworkWorkspace` widget config.
-   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` is regenerated by Playwright and passes contract plus drift checks.
-   Unit, integration, Playwright, screenshot, docs, isolation, OntoIndex, and Thermos gates are complete.
