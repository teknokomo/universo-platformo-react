# Plan: Suz-Dal Structure-First Runtime Remediation

**Plan date:** 2026-06-27  
**Source brief:** Platformo Suz-Dal interpretation network brief, 2026-06-24  
**Supersedes:** `memory-bank/plan/suzdal-interpretation-network-plan-2026-06-24.md`  
**Status:** Draft - awaiting user approval  
**Estimated complexity:** Level 4  
**Working rule:** The superseded 2026-06-24 plan remains historical archive material only. Do not use it as implementation guidance for new work.  
**QA revision:** 2026-06-27 - updated after the latest app rebuild QA. The plan now targets an intro Page as the first section plus a clean empty Structures workflow. Seeded demo Structures/Gravity/material rows are treated as defects for the product fixture.

---

## Overview

The shipped Suz-Dal implementation can render a seeded split view, but it does not match the expected first-use workflow. A newly created app must open with a readable start Page about the interpretation network, expose a stable `Structures` menu item, and show an empty authoring surface until the user creates or selects a Structure.

This plan reframes Stage 1 around an intro Page plus an explicit `Structure` workflow instead of the current seeded interpretation-network preview. The implementation should keep the `basic`-derived metahub foundation, reuse existing `apps-template-mui` primitives first, and only add a generic runtime widget if the clean structure workflow cannot be delivered through reusable composition. The end state must be an operational workspace with no generic dashboard clutter and no prefilled user content.

No IPFS/IPNS work is included. No schema or metahub template version bump is planned. Existing test data can be discarded and recreated.

---

## Research And Context Inputs

-   Brief: Platformo Suz-Dal interpretation network brief, 2026-06-24
-   Original superseded plan: `memory-bank/plan/suzdal-interpretation-network-plan-2026-06-24.md` - archive/reference only, not implementation guidance
-   Current generated fixture: `tools/fixtures/metahubs-suzdal-app-snapshot.json`
-   Current implementation anchors already present in the dirty worktree:
    -   `packages/universo-react-metahubs-backend/src/domains/templates/data/suz-dal.template.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/templates/data/suzdal.stage2.ts`
    -   `tools/testing/e2e/specs/generators/metahubs-suzdal-app-export.spec.ts`
    -   `tools/testing/e2e/support/suzdalFixtureContract.ts`
    -   `tools/testing/e2e/specs/flows/suzdal-app-imported-snapshot.spec.ts`
    -   `tools/testing/e2e/specs/visual/suzdal-workspace.spec.ts`
    -   `packages/universo-react-apps-template-mui/src/components/dialogs/CellStyleDialogField.tsx`
    -   `packages/universo-react-apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx`
    -   `packages/universo-react-apps-template-mui/src/components/TabularPartEditor.tsx`
    -   `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`
-   Required skills during implementation/QA:
    -   `universo-platform-architecture` - layer placement and entity preset mapping.
    -   `mui-runtime-ux-patterns` - runtime UI contract and apps-template-mui isolation.
    -   `runtime-ux-qa` - browser evidence and user-visible usability verdict.
    -   `playwright-best-practices` - Playwright CLI, screenshots, local Supabase E2E.
    -   `ontoindex-code-intelligence` plus generated OntoIndex skills - impact analysis before editing symbols and diff verification before commit.
    -   `thermos` / `autoreview` - final code modification review.

No external web research is required before this remediation plan. If implementation hits a current-library uncertainty, use Context7 or web search only for the specific API/library question and record the source in the implementation notes.

---

## Current Diagnosis

1. The app does not connect a start Page with base text about the interpretation network. The current `startPage: 'Concept'` points users directly into the wrong section.
2. The `Structures` section has extra heading/subtitle text at the top. That text must be removed while preserving the normal top spacing used by other app-template screens.
3. The product fixture currently seeds Concepts/Interpretations/Relations/Materials/TableTemplates and the tests accept that state. A fresh app must not start with demo user content such as `Gravity`; it should show only `Create structure` on the left and a helpful empty-state memo on the right.
4. The left pane currently exposes an `Add page` action. Page/material creation belongs on the right pane for the selected cell as `Add material`.
5. The intended hierarchy is: left pane lists Structures; selecting a Structure opens its page; matrix rows/cells and all materials live inside that Structure workflow.
6. `Material` is currently modeled as an `Object` with Editor.js body content. That is workable for Stage 1 only if the UI contract calls it `Material`, hides the technical storage choice, and behaves like an Editor.js page/material. If Page-backed storage is chosen instead, the implementation must keep the same user-facing contract.
7. Selected cells currently lose their configured fill color because the selected state uses a black/contained visual. Selection must use an outline/ring/shadow/focus treatment that preserves the original fill and border colors.
8. The existing Playwright and fixture tests are anti-oracles: they assert the current seeded `Gravity` demo behavior instead of rejecting it. They must be rewritten to fail on the current defects.
9. The current codebase already contains reusable `FormDialog`, `editorjsBlockContent`, `RuntimeInlineTabularEditor`, `TabularPartEditor`, and `@dnd-kit` patterns elsewhere. The plan should explicitly anchor on those instead of inventing a Suz-Dal-specific one-off editor.
10. Documentation must describe the intro Page plus empty structure-first model, not the old seeded matrix-preview interpretation.

---

## Post-QA Correction Contract

The latest QA findings override any earlier plan text that implied a seeded demo matrix in the generated product fixture.

-   A fresh app created from `tools/fixtures/metahubs-suzdal-app-snapshot.json` must have no precreated Structures, matrix cells, relations, table templates, or materials visible in the `Structures` workflow.
-   The metahub may seed entity type definitions, field/component definitions, enumerations, layout metadata, and one intro Page with localized text.
-   The first visible section should be the intro Page. The `Structures` menu item must remain available so the user can return from Workspaces/settings to the main interpretation-network content.
-   The `Structures` section left pane must show only the structure list and `Create structure` when there are no structures. It must not show `Add page`.
-   The right pane must show an empty-state memo when no Structure/cell is selected. Once a cell is selected, the right pane owns material creation through `Add material`.
-   Selected cell styling must preserve the configured cell fill and border.
-   Test contracts must explicitly reject the old seeded `Gravity` behavior.

---

## Architectural Decisions For The Remediation

-   **Base template:** Suz-Dal still starts from `basic`, not `basic-demo` or `empty`. The plan must keep demo/dashboard widgets out of the runtime app shell.
-   **Entity mapping:** `Structure` should be modeled as the published-app domain object users author; `Concept`, `Interpretation`, `Relation`, and `StructureTemplate` should be `Object`-based records; `Material` should be resolved explicitly as either `Page` or `Object + editorjsBlockContent` before implementation, and the plan must record that decision. `Context`, `RelationType`, and `CellColor` remain `Enumeration` values.
-   **Workspace ownership:** Real authored Structures, matrix rows/cells, relations, and materials belong in the published application workspace. The product metahub seed provides definitions, enumerations, layout metadata, and the intro Page only. It must not seed visible user Structures or matrix/material rows for the fresh app.
-   **Start section:** The default menu route must point to the intro Page, not to `Concept`/`Structures`. `Structures` remains the main authoring section and must be reachable from the left menu at all times.
-   **UI approach:** Build a reusable runtime primitive in `packages/universo-react-apps-template-mui` only if the structure-first workflow cannot be expressed by strengthening existing primitives. The primary surface must be a real authoring workspace, not a preview widget.
-   **Reuse-first gate:** Before any new widget is added, evaluate `RuntimeInlineTabularEditor`, `TabularPartEditor`, `FormDialog`, `editorjsBlockContent`, `CellStyleDialogField`, `relationBuilder`, `detailsTable`, and the existing runtime `@dnd-kit` patterns elsewhere in the repo. A new widget is only justified if the structure page cannot otherwise be delivered coherently. If added, it must be generic and metadata-driven, not Suz-Dal-only.
-   **Workspace-created structures/templates:** Stage 1 must include both a create-flow for a Structure in the workspace and a reusable structure-template flow that users can copy and instantiate without metahub-authoring access.
-   **No raw technical leakage:** No raw UUIDs, JSON, `[object Object]`, internal field names, or raw validation strings may appear in normal user-facing runtime surfaces.
-   **Security and data safety:** All runtime mutations must use existing authenticated runtime APIs, workspace access checks, optimistic row versions where available, and sanitized error rendering. No admin-context shortcut, raw SQL shortcut, debug ID leakage, or client-trusted ownership field is acceptable.
-   **No legacy preservation requirement:** Existing wrong Suz-Dal implementation pieces may be replaced or removed when they conflict with the target UX.

---

## Affected Areas

| Area                                   | Files / packages                                                                                                                                                           | Planned action                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime workspace UI                   | `packages/universo-react-apps-template-mui/src/`                                                                                                                           | Add/reshape a reusable structure-first workspace surface and remove Suz-Dal reliance on generic dashboard clutter.                                                                                                |
| Existing runtime primitives            | `RuntimeInlineTabularEditor.tsx`, `TabularPartEditor.tsx`, `RelationBuilderWidget.tsx`, `widgetRenderer.tsx`, `MainGrid.tsx`, `FormDialog.tsx`, `CellStyleDialogField.tsx` | First evaluate and prefer generic strengthening before introducing any new widget key.                                                                                                                            |
| Tabular matrix editing                 | `RuntimeInlineTabularEditor.tsx`, `TabularPartEditor.tsx`, `tabularCellValues.ts`, `tabularColumns.tsx`, DnD helpers                                                       | Make hierarchy/matrix display usable: colored cells, stable cell IDs, selection, breadcrumbs/path, row/cell reordering, and material relation hooks.                                                              |
| Workspace structure/template authoring | existing Object/Page/Enumeration metadata and runtime CRUD surfaces; new generic helper only if needed                                                                     | Let workspace users create/copy a reusable structure and instantiate matrix cells without metahub access.                                                                                                         |
| Cell styling                           | `CellStyleDialogField.tsx`, `FormDialog.tsx`, i18n                                                                                                                         | Keep only if it serves the matrix workflow; ensure localized, accessible controls and no JSON storage leakage.                                                                                                    |
| Intro Page and menu                    | `suz-dal.template.ts`, Page seed helpers, menu widget config                                                                                                               | Add localized start Page text and make it the default app section while keeping `Structures` as a stable return item.                                                                                             |
| Template seed                          | `suz-dal.template.ts`, possible `suzdal.stage2.ts`                                                                                                                         | Rebuild seed layout so the imported app starts cleanly with definitions/enums/intro Page only, with no visible precreated Structures or matrix data.                                                              |
| Fixture and generator                  | `tools/testing/e2e/specs/generators/metahubs-suzdal-app-export.spec.ts`, `suzdalFixtureContract.ts`, `checkSuzdalFixtureContract.ts`                                       | Require product UI contract, no extra widgets, basic-template-derived structure, and zero seeded user content rows for Structure/Concept/Interpretation/Relation/Material/TableTemplate in the fresh app fixture. |
| E2E import/runtime                     | `suzdal-app-imported-snapshot.spec.ts`, `suzdal-app-smoke.spec.ts`, `suzdal-workspace.spec.ts`                                                                             | Add real browser assertions and screenshots for the intro Page, empty Structures workflow, create flow, material flow, and selected-cell styling.                                                                 |
| Docs                                   | `docs/en/...`, `docs/ru/...`, `SUMMARY.md`                                                                                                                                 | Replace placeholder docs/screenshots with real GitBook pages and real screenshot assets.                                                                                                                          |
| README                                 | `packages/universo-react-apps-template-mui/README.md`, `tools/testing/e2e/README*.md`                                                                                      | Document the final implemented contract, not the failed generic-widget plan.                                                                                                                                      |
| Memory Bank                            | this plan only unless implementation later updates tasks/progress                                                                                                          | Keep old plan archived by supersession and use this document for future work.                                                                                                                                     |

---

## Plan Steps

### Phase 0 - Freeze The New Direction

-   [ ] Mark this document as the only active Suz-Dal implementation plan in implementation notes and PR descriptions.
-   [ ] Do not edit or delete `memory-bank/plan/suzdal-interpretation-network-plan-2026-06-24.md`; treat it as historical archive material.
-   [ ] Inspect current dirty Suz-Dal files and classify every change as keep, replace, or remove, with special attention to the current smoke-view that must be replaced by the structure-first flow.
-   [ ] Run `git status --short` and keep a list of user/agent changes that must not be reverted accidentally.
-   [ ] Run OntoIndex status. Because the worktree is dirty, do not rerun analyze unless the user explicitly approves cleanup/stash/commit first.

### Phase 1 - Product UI Contract Before Code

-   [ ] Write a short runtime UI contract in the implementation notes or a dedicated test fixture comment covering the required first screen:
    -   left application navigation/sidebar remains available;
    -   the app opens to a localized intro Page with base text about the interpretation network;
    -   a stable `Structures` menu item returns the user to the Suz-Dal authoring content from Workspaces/settings;
    -   the `Structures` work area has exactly two functional panes;
    -   when no Structure exists, the left pane shows only `Create structure` plus the empty list state;
    -   when no Structure/cell is selected, the right pane shows a localized memo that tells the user to create or select a Structure;
    -   after a Structure is created/opened, the left pane shows the Structure list and the selected Structure matrix/tree;
    -   the right pane shows selected structure/cell data, relations, materials, and style controls;
    -   `Add page` is not available in the left pane; selected-cell material creation is exposed as `Add material` in the right pane;
    -   selected-cell styling preserves the configured fill and border colors;
    -   no dashboard demo widgets, charts, generic home cards, raw ids, raw JSON, or placeholder copyright/footer clutter;
    -   Russian and English labels are localized;
    -   desktop, tablet, and mobile do not have page-level horizontal overflow.
-   [ ] Define acceptance screenshots that match the reference intent:
    -   intro Page with left navigation and visible `Structures` entry point;
    -   empty `Structures` section with only `Create structure` on the left and the right-pane memo;
    -   structure create dialog with name/description;
    -   opened structure page with large editable cells and nested row/template navigation;
    -   selected cell/node details with material preview;
    -   selected colored cell where original fill/border remain visible;
    -   relations view;
    -   Editor.js-backed `Add material` editing/viewing from the right pane;
    -   drag/drop reorder state;
    -   mobile/tablet fallback.

### Phase 1A - Reuse-First Feasibility Gate

-   [ ] Review existing primitives before proposing any new runtime widget key:
    -   `RuntimeInlineTabularEditor` and `TabularPartEditor` for matrix/cell editing;
    -   `buildTabularColumns`, `tabularCellValues`, and `tabularColumns` for color/border previews and hidden fields;
    -   `detailsTable` for ordinary record lists;
    -   `relationBuilder` for parent-scoped relation authoring;
    -   `FormDialog` for create/edit/copy/delete dialogs;
    -   `ResourcePreview` and `editorjsBlockContent` for materials;
    -   `columnsContainer` only for layout composition where it does not hide the real workflow;
    -   existing `@dnd-kit` patterns in metahubs/applications frontend for reorder and cross-list movement.
-   [ ] Produce a short decision record with one of two outcomes:
    -   **Extend existing primitives**: preferred when the structure page can be assembled with generic enhancements.
    -   **Add a generic structure workspace widget**: allowed only if the required hierarchical matrix selection, right-pane data binding, and reorder interactions would otherwise force brittle coupling across several generic widgets.
-   [ ] If a new widget is chosen, add tests proving it delegates CRUD/dialog/material/relation/DnD behavior to existing shared primitives rather than duplicating them.

### Phase 2 - Impact Analysis Before Editing Symbols

Before editing each symbol, run OntoIndex impact and record direct callers/risk in implementation notes.

-   [ ] `RuntimeInlineTabularEditor` impact.
-   [ ] `TabularPartEditor` impact.
-   [ ] `FormDialog` impact if structure create dialogs or cell-style widget integration changes.
-   [ ] `renderWidget` / dashboard widget renderer impact if adding a new runtime widget key.
-   [ ] `MainGrid` / `Dashboard` impact if changing layout/chrome behavior.
-   [ ] `suzDalTemplate` / template registry impact.
-   [ ] `assertSuzdalFixtureEnvelopeContract` impact.
-   [ ] `WorkspaceSwitcher` / `DashboardApp` impact if adding a curated return-to-structure menu item.
-   [ ] DnD helper impacts if sortable matrix rows/cells are added.
-   [ ] E2E support helper impacts as needed.

If any impact comes back HIGH or CRITICAL, warn the user before editing that symbol.

### Phase 3 - Remove Wrong Runtime Surface Assumptions

-   [ ] Audit the current Suz-Dal layout seed in `suz-dal.template.ts` and the committed fixture.
-   [ ] Replace the current `startPage: 'Concept'` behavior with a seeded localized intro Page:
    -   title introduces the interpretation network;
    -   body explains that work starts by opening `Structures` and creating/selecting a Structure;
    -   the Page uses the existing Page/Editor.js-capable content model instead of custom hardcoded text where possible.
-   [ ] Remove any Suz-Dal layout widgets that exist only because the old generic dashboard plan used them, especially standalone `detailsTable`, generic `workspaceSwitcher` placement, demo charts/cards, and nonessential menu widgets.
-   [ ] Keep only layout primitives that directly support the target workflow.
-   [ ] Ensure the created metahub/snapshot does not use `basic-demo` content or demo dashboard widgets.
-   [ ] Update the fixture contract so these wrong widgets are rejected for Suz-Dal unless explicitly required by the product contract.
-   [ ] Add or correct curated left-menu items:
    -   intro Page is the default first section;
    -   `Structures` is the authoring section;
    -   both remain reachable after visiting Workspaces/settings.

### Phase 4 - Build The Structure Workspace Surface

Implement the structure workspace surface by strengthening existing runtime primitives where possible. Add a reusable runtime component/widget in `apps-template-mui` only if Phase 1A proves generic composition cannot deliver the workflow. Working name if needed: `structureWorkspace` or a similarly generic name; avoid naming it as a Suz-Dal-only fork unless the final design proves it is configuration-specific.

-   [ ] Define metadata/config contract for the widget:
    -   source object/entity codenames for Structure, Concept, Interpretation, Relation, Material, and StructureTemplate;
    -   matrix TABLE component codename;
    -   display fields;
    -   relation endpoint fields;
    -   material reference field;
    -   color/border field mapping;
    -   optional start selection;
    -   whether the widget is the whole page or a details pane anchored to the created Structure page.
-   [ ] Render the two-pane layout:
    -   left pane empty state: only Structure list container and `Create structure`;
    -   left pane after creation: hierarchical Structures, matrix rows/cells, breadcrumb/path, expansion, selection, colored fills and borders;
    -   right pane empty state: localized user memo when no Structure/cell is selected;
    -   right pane after selection: selected item title, description/value, tabs/sections for data, relations, styles, and materials;
    -   no left-pane `Add page` action;
    -   right-pane `Add material` action for the selected cell/node;
    -   actions: create/edit/copy/delete where Stage 1 supports them;
    -   keyboard path and accessible names;
    -   a visible return path back to the structure content from Workspaces routes.
-   [ ] Use existing primitives inside the widget where they fit:
    -   `FormDialog` for create/edit dialogs;
    -   `RuntimeInlineTabularEditor` / `TabularPartEditor` for matrix editing if they can be extended without breaking reuse;
    -   `CellStyleDialogField` for cell styles;
    -   Editor.js block-content control for materials;
    -   shared confirmation dialog for delete;
    -   existing runtime data fetch/mutation helpers and TanStack Query conventions.
-   [ ] If no new widget is needed, encode the same two-pane behavior through metadata and generic primitive extensions, then keep the fixture contract focused on the visible workflow rather than a specific widget key.
-   [ ] Avoid nested cards and marketing-style sections. This is an operational workspace surface.
-   [ ] Add responsive behavior:
    -   desktop: left/right split;
    -   tablet/mobile: stacked panes or drawer/list/detail mode;
    -   no page-level horizontal overflow.

### Phase 5 - Structures, Matrix, Cells, Relations, Materials

-   [ ] Make matrix cells stable and user-meaningful:
    -   hidden stable `CellId` generated as UUID v7;
    -   visible path/breadcrumb instead of raw IDs;
    -   localized value labels;
    -   color and border preview visible in the matrix.
-   [ ] Support hierarchy/multiple nesting for Stage 1 by explicit parent/child links or companion records, not by exposing recursive JSON to the UI.
-   [ ] Add workspace-authored structure/template support:
    -   users can create a reusable structure inside the workspace;
    -   users can copy an existing structure or structure-template as a starting point;
    -   creating a Structure can instantiate matrix cells from the workspace template;
    -   the template appears with a human-readable name and description, not a raw JSON schema;
    -   template records remain workspace-scoped and do not require metahub-authoring permissions.
-   [ ] Make selected node/cell details update the right pane immediately.
-   [ ] Make cell selection visually clear without replacing the configured fill:
    -   keep `backgroundColor`/fill from the cell style for both selected and unselected states;
    -   use outline, box shadow, focus ring, or border accent for selected state;
    -   preserve accessible focus styles for keyboard users;
    -   add regression tests for non-black selected colored cells.
-   [ ] Relations:
    -   show relation type label and human-readable source/target labels;
    -   support concept/interpretation/cell endpoints;
    -   hide raw endpoint IDs from normal users.
-   [ ] Materials:
    -   remove left-pane `Add page`;
    -   expose right-pane `Add material` only when a Structure cell/node is selected;
    -   attach Page/Editor.js material to selected node/cell;
    -   show a useful preview in the right pane;
    -   open/edit through existing block editor controls;
    -   validate block content through existing Page block schema if Material is Page, or through the selected Object block-content contract if Material stays Object.
-   [ ] DnD:
    -   reorder cells within a row;
    -   move a cell between rows;
    -   keep persisted sort order stable;
    -   include a keyboard-accessible fallback and test coverage.

### Phase 6 - Template And Snapshot Rebuild

-   [ ] Rebuild `suz-dal` template seed from the basic template capability set.
-   [ ] Seed definitions and first-use content only:
    -   required entity/object definitions for Structure, Concept, Interpretation, Relation, Material, TableTemplate, Context, RelationType, and CellColor;
    -   required component/field definitions and UI metadata;
    -   localized enumeration option values where the workflow needs choices;
    -   one localized intro Page with Editor.js-compatible content;
    -   no precreated Structure/Concept/Interpretation/Relation/Material/TableTemplate rows visible as user-authored content.
-   [ ] Remove old product fixture demo data, including any `Gravity`-style sample records, seeded matrix cells, material attachments, and table template rows.
-   [ ] Keep display text localized in English and Russian.
-   [ ] Regenerate `tools/fixtures/metahubs-suzdal-app-snapshot.json` through the product Playwright generator, not by hand.
-   [ ] Make the generator fail if the resulting app does not include the intro Page, `Structures` return item, clean empty Structures workflow, and structure workspace widget/layout contract.

### Phase 7 - Strict Fixture Contract

Update `tools/testing/e2e/support/suzdalFixtureContract.ts` so it enforces product intent, not only data shape.

-   [ ] Require canonical metahub identity and basic-template-derived preset set.
-   [ ] Require Structure, Concept, Interpretation, Relation, Material/Page, TableTemplate, Context, RelationType, CellColor definitions.
-   [ ] Require the intro Page definition and default menu start route.
-   [ ] Require the structure workspace layout and visible workflow. If Phase 1A chooses a new widget, require that widget key; if Phase 1A chooses generic primitive extensions, require the equivalent visible two-pane contract without hardcoding a new widget key.
-   [ ] Reject unrelated demo widgets and generic dashboard clutter for Suz-Dal.
-   [ ] Reject seeded user-content rows for Structure/Concept/Interpretation/Relation/Material/TableTemplate in the fresh app fixture unless they are explicitly marked as non-runtime definitions.
-   [ ] Reject known old demo strings such as `Gravity` and `Gravity material` in product fixture runtime data.
-   [ ] Require localized labels for user-visible fields.
-   [ ] Require metadata capable of colored cells, stable UUID v7 cell IDs, material attachments, typed relations, and structure-template coverage without requiring preseeded visible rows.
-   [ ] Require no raw JSON/object cell display configuration for normal runtime surfaces.
-   [ ] Require tests proving workspace-authored structure/template creation can instantiate a visible matrix and is not stored/displayed as raw JSON.
-   [ ] Run `pnpm run check-suz-dal-fixture-contract` after regeneration.

### Phase 8 - Browser E2E And Screenshots

Use Playwright CLI wrapper and local minimal Supabase as requested. Do not use `pnpm dev`.

-   [ ] Start local minimal Supabase: `pnpm supabase:e2e:start:minimal`.
-   [ ] Build E2E local Supabase target: `pnpm run build:e2e:local-supabase`.
-   [ ] Run the Suz-Dal generator gate.
-   [ ] Import the generated fixture into a fresh metahub/application.
-   [ ] Browser assertions must verify:
    -   the app opens to the Suz-Dal intro Page, not a generic dashboard home and not directly to `Structures`;
    -   the intro Page has localized base text about the interpretation network and a visible route to `Structures`;
    -   extra top/header/sidebar widgets from the screenshot complaint are absent or intentionally hidden;
    -   the `Structures` section has normal top spacing but no redundant heading/subtitle block;
    -   the empty left pane shows only the Structure list container and `Create structure`;
    -   the empty right pane shows a localized memo to create or select a Structure;
    -   the left pane does not show `Add page`;
    -   old demo records such as `Gravity` are absent;
    -   creating a Structure with name/description adds it to the left list and opens its page;
    -   after creating/selecting a cell, the right pane changes to selected cell details;
    -   `Add material` is on the right pane and creates/edits an Editor.js-backed material for the selected cell;
    -   colored cells render with computed styles;
    -   selected colored cells keep their original fill/border and use a non-destructive selection effect;
    -   relations show readable labels;
    -   material preview/editor is usable;
    -   a workspace user can create or copy a structure/template and instantiate a matrix from it;
    -   no raw IDs/JSON/object cells/internal validation messages;
    -   keyboard navigation reaches the structure pane, matrix cells, right-pane tabs, relation actions, style controls, drag handles, and material editor controls;
    -   no page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`.
-   [ ] Save screenshots as test artifacts and final documentation assets.
-   [ ] Tear down local Supabase when finished: `pnpm supabase:e2e:stop`.

### Phase 9 - Unit, Component, And Integration Tests

-   [ ] Unit tests for structure/matrix/cell normalization, cell ID generation, relation endpoint label resolution, material preview helpers, and drag/drop reorder reducers.
-   [ ] Component tests for the structure workspace:
    -   renders split panes;
    -   renders the empty state with only `Create structure` and the right-pane memo;
    -   does not render left-pane `Add page`;
    -   selects matrix cells;
    -   preserves selected cell fill/border styling;
    -   opens cell-style editor;
    -   shows right-pane details;
    -   exposes `Add material` from the right pane only for selected cells/nodes;
    -   hides raw IDs;
    -   handles empty/error states with localized text.
-   [ ] Fixture/contract tests that fail on current bad snapshots:
    -   `startPage: 'Concept'` is rejected;
    -   seeded `Gravity`/`Gravity material` runtime data is rejected;
    -   required intro Page is missing;
    -   precreated Structure/Concept/Interpretation/Relation/Material/TableTemplate rows are present in the fresh product fixture.
-   [ ] Component/integration tests for workspace-authored structure templates:
    -   create structure/template;
    -   copy structure/template;
    -   instantiate matrix from template;
    -   keep template records scoped to the current workspace;
    -   reject raw JSON display in template lists/cards.
-   [ ] Component tests for responsive mode.
-   [ ] Backend/template tests for `suz-dal` shape and seed transaction behavior.
-   [ ] Snapshot fixture tests in `@universo-react/utils`.
-   [ ] Playwright smoke, flow, and visual tests for imported fixture runtime.

### Phase 10 - Documentation And README

-   [ ] Replace placeholder docs/screenshots with real GitBook documentation:
    -   `docs/en/guides/suzdal-interpretation-network.md`
    -   `docs/ru/guides/suzdal-interpretation-network.md`
    -   `docs/en/architecture/suz-dal-data-model.md`
    -   `docs/ru/architecture/suz-dal-data-model.md`
-   [ ] Use real screenshots captured from the imported published app.
-   [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.
-   [ ] Update `packages/universo-react-apps-template-mui/README.md` to document the final reusable structure runtime primitive and cell-style field.
-   [ ] Update `tools/testing/e2e/README.md` and `tools/testing/e2e/README-RU.md` with the generator/import/browser proof flow.
-   [ ] Run docs checks:
    -   `pnpm docs:i18n:check`
    -   `pnpm docs:gitbook-screenshot-assets:check`

### Phase 11 - Final QA And Review

-   [ ] Run focused builds/tests:
    -   `pnpm --filter @universo-react/types test`
    -   `pnpm --filter @universo-react/utils test`
    -   `pnpm --filter @universo-react/metahubs-backend test`
    -   `pnpm --filter @universo-react/apps-template-mui test`
    -   `pnpm --filter @universo-react/apps-template-mui lint`
-   [ ] Run Suz-Dal fixture and runtime gates on local minimal Supabase.
-   [ ] Run `pnpm ontoindex:changes` before commit to verify affected symbols/processes.
-   [ ] Run Thermos/autoreview on the final diff.
-   [ ] Run or document a Thermos maintainability check for any new/changed file approaching 1,000 lines; split large runtime widgets/helpers before merge.
-   [ ] Run security/correctness review for runtime mutations: workspace authorization, optimistic row versions, UUID v7 generation, sanitized errors, no credential/PII logging, and no raw SQL shortcuts.
-   [ ] Produce a Runtime UX QA verdict using `runtime-ux-qa` format:
    -   verdict;
    -   blockers/major/minor issues;
    -   passed checks;
    -   browser evidence;
    -   missing evidence;
    -   required fixes.
-   [ ] Do not mark the work complete until browser screenshots prove the user-visible layout matches the intended two-pane structure-first workflow, including return navigation, structure creation, style editing, and DnD.

---

## UI Contract

The accepted Stage 1 Suz-Dal runtime must satisfy these conditions:

-   The first section is a real localized intro Page about the interpretation network, not a marketing hero, generic dashboard demo, or direct jump into `Structures`.
-   Normal users see the left navigation/sidebar with a stable `Structures` entry.
-   The `Structures` section is a two-pane working surface.
-   In a fresh app with no user-created Structures, the left pane shows the empty Structure list and one `Create structure` action. It does not show `Add page`.
-   In a fresh app with no selected Structure/cell, the right pane shows a localized memo explaining that the user should create or select a Structure.
-   After a Structure exists, the left pane exposes the hierarchy/structure page with colored cells and readable labels.
-   After a Structure cell/node is selected, the right pane presents selected item/cell data, relations, `Add material`, material previews/editors, and style controls.
-   Selected cells keep their configured fill and border colors; selection is shown with a non-destructive outline/ring/shadow/focus effect.
-   Matrix cells can show fill color and per-side border styling.
-   Materials are Editor.js-backed and visible as previews/editors, not raw JSON.
-   Relations use localized type labels and human-readable endpoint labels.
-   UUIDs, raw IDs, raw JSON, `[object Object]`, internal field names, and untranslated validation errors are not visible in normal runtime flows.
-   Long semantic text is multiline.
-   Optional materials/resource fields do not show errors when empty.
-   The layout has no page-level horizontal overflow at desktop, tablet, and mobile widths.

---

## Plan UX Review Gate

This plan is accepted for implementation only if the implementation and tests keep the following UX canaries:

-   [ ] Browser flow proves intro Page first, `Structures` second, and return navigation from Workspaces/settings.
-   [ ] Browser flow proves empty `Structures` state with no seeded runtime records.
-   [ ] Browser flow proves the left pane has `Create structure` but no `Add page`.
-   [ ] Browser flow proves the right pane owns `Add material` for a selected cell/node.
-   [ ] Component or browser test proves selected colored cells do not turn black or lose their configured fill/border.
-   [ ] Fixture contract rejects old seeded demo data, including `Gravity` and `Gravity material`.
-   [ ] Runtime UX QA verdict explicitly answers whether a normal user can complete the workflow without hidden technical knowledge.

---

## Potential Challenges

| Risk                                                                   | Impact | Mitigation                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic dashboard widgets cannot express the target structure workflow | High   | Add a reusable structure workspace runtime primitive in `apps-template-mui` instead of forcing `detailsTable`/`detailsTabs` to do the wrong job.                        |
| New widget becomes Suz-Dal-specific hardcoding                         | Medium | Make the widget metadata-driven: object codenames, field mappings, labels, tabs, and return navigation come from template metadata/i18n.                                |
| Existing fixture contract keeps passing despite bad UI                 | High   | Add negative assertions rejecting unrelated demo widgets, `startPage: 'Concept'`, old `Gravity` demo data, missing intro Page, and missing clean empty Structures flow. |
| Cell hierarchy becomes raw JSON                                        | High   | Store stable cell IDs and parent/child links in typed fields; render labels/path, not JSON.                                                                             |
| Browser E2E passes API checks but misses visual regression             | High   | Require screenshots and visible locators for the imported published app.                                                                                                |
| Dirty worktree hides unrelated changes                                 | Medium | Review `git status`, avoid reverting unknown changes, and keep diffs scoped.                                                                                            |
| OntoIndex index cannot be refreshed while dirty                        | Low    | Use current index for impact where possible; run `pnpm ontoindex:changes` before commit.                                                                                |

---

## Non-Goals

-   IPFS, IPNS, decentralized publishing, or pinning.
-   New platform-level entity kind.
-   Metahub schema or template schema version bump.
-   Preserving the wrong generic Suz-Dal shell for backward compatibility.
-   Full semantic search over materials.
-   Native mobile/offline mode.
-   Parallel RBAC or domain-specific permission system outside existing workspace roles.
-   Using `pnpm dev` for E2E/browser proof.

---

## Approval Gate

Implementation should start only after the user approves this remediation plan or requests edits. The expected next command is `IMPLEMENT` against this plan, not against the superseded 2026-06-24 plan.
