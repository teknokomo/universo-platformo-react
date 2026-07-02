# Research: Interpretation Network Runtime Menu And Matrix Improvements

> Created: 2026-06-29
> Status: Draft
> Trigger: PLAN request for Interpretation Network runtime fixes, side menu modes, and matrix UX
> Follow-up plan: ../plan/interpretation-network-runtime-menu-improvements-plan-2026-06-29.md

## Research Question

Which current upstream/library patterns and repository anchors should guide the implementation plan for:

-   resilient menu bindings after metahub name/codename changes;
-   configurable side menu presentation modes;
-   Interpretation Network structure, cell-dialog, tabs, and matrix move behavior;
-   browser-backed UX verification.

## Source Inventory

| Source                                                                                                         | Type                                           | Date / Freshness   | Why It Matters                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Context7 `/mui/material-ui`, Drawer docs excerpts from MUI repository examples                                 | Primary library docs                           | Queried 2026-06-29 | Confirms Material UI uses `temporary` Drawer for overlay/mobile, `permanent` Drawer for desktop, and documents mini variant behavior.                        |
| Context7 `/clauderic/dnd-kit`, sortable/multiple-list docs excerpts                                            | Primary library docs                           | Queried 2026-06-29 | Confirms modern React sortable patterns, cross-list movement, and keyboard-accessible sensors.                                                               |
| `packages/universo-react-apps-template-mui/src/dashboard/Dashboard.tsx`                                        | Repository source                              | Current checkout   | Runtime shell currently renders a permanent desktop side menu and mobile drawer without a typed menu-mode contract.                                          |
| `packages/universo-react-apps-template-mui/src/dashboard/components/SideMenu.tsx`                              | Repository source                              | Current checkout   | Current left menu is a fixed-width permanent MUI Drawer.                                                                                                     |
| `packages/universo-react-apps-template-mui/src/dashboard/components/AppNavbar.tsx`                             | Repository source                              | Current checkout   | Current overlay drawer entrypoint exists only through mobile navbar state.                                                                                   |
| `packages/universo-react-types/src/common/dashboardLayout.ts`                                                  | Repository source                              | Current checkout   | Existing layout config lacks side menu mode fields and defaults.                                                                                             |
| `packages/universo-react-types/src/common/metahubs.ts`                                                         | Repository source                              | Current checkout   | `MenuWidgetConfig` currently allows `startPage`, `sectionId`, hub/tree bindings, and menu item targets that may be ID or codename.                           |
| `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`                        | Repository source via subagent read-only audit | Current checkout   | Runtime menu normalization resolves menu tokens as UUID-or-codename; stale codename values can become null targets.                                          |
| `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts` and `syncLayoutPersistence.ts`   | Repository source via subagent read-only audit | Current checkout   | Current sync/remap paths cover layout scope IDs but not all menu widget target references inside widget config.                                              |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.stage2.ts`         | Repository source                              | Current checkout   | The Interpretation Network template defines `Concept.Term` and visible `Context`, causing structure create labels/fields that do not match the requested UX. |
| `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`  | Repository source                              | Current checkout   | Structure create field filtering, inline Matrix caption, custom cell dialog, and current swap-based move behavior live here.                                 |
| `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/CellEditDialog.tsx` | Repository source                              | Current checkout   | Cell create/edit currently uses a bespoke dialog and `LocalizedInlineField size='small'`.                                                                    |
| `tools/testing/e2e/support/browser/runtimeUx.ts`                                                               | Repository source                              | Current checkout   | Existing browser UX helpers already define viewport matrix, no-overflow, no-technical-leakage, semantic field, and localized validation oracles.             |
| `tools/testing/e2e/specs/flows/interpretation-network-app-imported-snapshot.spec.ts`                           | Repository source                              | Current checkout   | Existing flow imports the Interpretation Network fixture and covers part of the runtime CRUD/UX path, but not all requested canaries.                        |

## Key Findings

-   Fact: MUI Drawer supports responsive composition with `temporary` drawers for overlay behavior and `permanent` drawers for desktop navigation; MUI also documents mini variant as a width-changing persistent navigation pattern.
-   Fact: The runtime `Dashboard` currently has only boolean layout toggles such as `showSideMenu` / `showAppNavbar`; there is no typed `wide` / `compact` / `overlay` menu mode contract.
-   Fact: The current `SideMenu` is a fixed 240px permanent Drawer on desktop. The only existing overlay-like behavior is mobile drawer state inside `AppNavbar`.
-   Fact: `MenuWidgetConfig` already stores menu item IDs as stable client-generated IDs, but target references such as `sectionId`, `objectCollectionId`, `hubId`, `treeEntityId`, `boundHubId`, `boundTreeEntityId`, and `startPage` can still be codename-shaped.
-   Fact from read-only subagent audit: runtime menu normalization resolves these targets by `id::text = token OR codename = token`. If a target is stored as a stale codename, normalized runtime menu items may lose the target and become inert or disappear.
-   Fact from read-only subagent audit: application sync/remap currently handles layout scope IDs but does not consistently normalize all menu widget references embedded in `widget.config`.
-   Fact: The Interpretation Network template currently defines the structure object display component as `Term` / `Термин` and includes a visible `Context` reference on `Concept`.
-   Fact: The structure create dialog currently derives `structureFields` by including the configured concept name field, description field, and `Context`.
-   Fact: The selected-structure header currently renders a secondary caption `Matrix` under the structure title instead of a tab surface.
-   Fact: `CellEditDialog` is bespoke rather than the shared `FormDialog`, and title/description localized controls are forced to `size='small'`.
-   Fact: Current matrix cell movement swaps source and target payloads by batch-updating both rows, which matches the reported bug and conflicts with the requested "move next to target row" behavior.
-   Fact: `dnd-kit` is already centrally versioned in `pnpm-workspace.yaml` and used by metahubs/template packages, but `@universo-react/apps-template-mui` does not currently depend on it.
-   Fact: Existing Playwright UX helpers and Interpretation Network flow cover many primitives, but subagent review found missing gates for real browser drag/drop, all side-menu modes, full dialog lifecycle, and screenshots after the new workflows.

## Conflicts And Uncertainty

-   The current template uses codename tokens intentionally during seed authoring. The implementation should allow template authoring by codename but materialize runtime-facing menu target references to UUIDs after seed/sync.
-   It is not yet verified whether the user-observed rename bug is in metahub authoring pages, published application runtime, or both. The plan must cover both metahub layout widget config and application layout settings because both expose menuWidget configuration.
-   Adding `@dnd-kit/*` to `@universo-react/apps-template-mui` may be justified for accessible drag/drop, but the current matrix can also be fixed with the existing HTML5 DnD path. The implementation phase should choose the smallest reliable approach after impact analysis; if adding the dependency, use catalog versions from `pnpm-workspace.yaml`.

## Project Implications

-   Shared side-menu mode types and defaults belong in a stable shared package, most likely `@universo-react/types`, then consumed by `apps-template-mui`, metahubs frontend, applications frontend, and backend validators.
-   `apps-template-mui` must stay isolated from legacy template/feature packages; duplicating or creating local primitives inside it is acceptable, importing `@universo-react/template-mui` is not.
-   Menu target stability should be solved in sync/materialization and editor selectors, not by showing UUIDs to users.
-   Interpretation Network metadata should be corrected at template/config level for new databases without schema/template version bumps, consistent with the request.
-   Browser UX evidence should be treated as a merge gate because the defects are visible workflow regressions.

## Recommended Decision

Implement this as four coordinated slices:

1. Normalize menu widget target references to UUIDs during seed/sync/materialization and make menu editors save UUID targets from selectors while displaying human labels.
2. Add a typed side-menu mode contract with defaults: available modes `wide`, `compact`, `overlay`; primary mode `wide`; validate at least one mode and primary-in-available. Reuse MUI Drawer patterns in `apps-template-mui`.
3. Update Interpretation Network metadata and widget behavior: `Name`/`Название`, no `Context` in structure create, shared/base dialog treatment for cell create/edit, tabs for selected structure, and move-not-swap matrix placement.
4. Expand tests and browser evidence before acceptance: focused unit/component tests, fixture contracts, Playwright flows on local Supabase minimal when requested, screenshots, no-overflow, no-technical-leakage, localized validation, and real drag/drop.

## Open Questions Before PLAN

None. The implementation can make conservative choices from the current codebase: default to UUID target materialization, `apps-template-mui` isolation, and browser-proven UX gates.

## Sources

-   https://github.com/mui/material-ui/blob/master/docs/data/material/components/drawers/ResponsiveDrawer.tsx
-   https://github.com/mui/material-ui/blob/master/docs/data/material/components/drawers/drawers.md
-   https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/guides/multiple-sortable-lists.mdx
-   https://github.com/clauderic/dnd-kit/blob/main/apps/docs/docs/react/hooks/use-sortable.mdx
