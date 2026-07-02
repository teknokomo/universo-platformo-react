# Interpretation Network Runtime Menu Improvements Plan

> Created: 2026-06-29
> Mode: PLAN
> Research: ../research/interpretation-network-runtime-menu-research-2026-06-29.md
> Status: QA-revised

## Overview

Fix the Interpretation Network runtime defects and add side-menu display-mode configuration while preserving the `packages/universo-react-apps-template-mui` dashboard style and isolation boundary. The implementation must make menu bindings resilient to metahub name/codename changes by using UUID-backed targets internally, update Interpretation Network structure/matrix UX, and finish with unit, integration, and Playwright browser evidence.

No schema/template version bump is allowed or required. The test database will be deleted and recreated, new metahubs/applications will be generated from the updated template, and the request explicitly allows direct template/model changes plus substantial refactoring across existing packages.

## Affected Areas

-   `packages/universo-react-types/src/common/dashboardLayout.ts`
-   `packages/universo-react-types/src/common/metahubs.ts`
-   `packages/universo-react-utils/src/validation/dashboardLayout.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/Dashboard.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/SideMenu.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/AppNavbar.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/MenuContent.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/*`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.*`
-   `packages/universo-react-metahubs-backend/src/domains/shared/layoutDefaults.ts`
-   `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/*/services/*Layouts*`
-   `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/MenuWidgetEditorDialog.tsx`
-   `packages/universo-react-metahubs-frontend/src/i18n/locales/{en,ru}/metahubs.json`
-   `packages/universo-react-applications-frontend/src/components/layouts/ApplicationMenuWidgetEditorDialog.tsx`
-   `packages/universo-react-applications-frontend/src/i18n/locales/{en,ru}/applications.json`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
-   `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/interpretationNetwork.json`
-   `packages/universo-react-utils/src/snapshot/__tests__/snapshotFixtures.test.ts`
-   `packages/universo-react-i18n` only if shared labels are promoted out of package-local i18n
-   `package.json`
-   `tools/testing/e2e/support/browser/runtimeUx.ts`
-   `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`
-   `tools/testing/e2e/support/checkInterpretationNetworkFixtureContract.ts`
-   `tools/testing/e2e/support/interpretationNetworkRuntime.ts`
-   `tools/testing/e2e/support/interpretationNetworkSnapshotImport.ts`
-   `tools/testing/e2e/specs/flows/*interpretation-network*`
-   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`
-   `tools/testing/e2e/specs/smoke/interpretation-network-app-smoke.spec.ts`
-   `tools/testing/e2e/specs/visual/*interpretation-network*`
-   `tools/testing/e2e/README.md`
-   `tools/testing/e2e/README-RU.md`
-   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
-   `docs/` GitBook docs and affected package READMEs

## Architecture Decisions

-   No legacy compatibility path is required for the Interpretation Network template or generated test data. Remove obsolete template/runtime assumptions directly instead of preserving aliases for old generated databases.
-   Interpretation Network domain objects stay mapped to existing platform presets:
    -   Structure: `Object` preset. Rename the old generated/template terminology `Concept` -> `Structure` and `Term` -> `Name` across the template, generator, fixture contract, runtime defaults, tests, and docs. Do not keep `Concept`/`Term` as a supported new-data compatibility path.
    -   Interpretation: `Object` preset with `TABLE` component `InterpretationMatrix`.
    -   Material: `Object` preset with Editor.js block content.
    -   Context / RelationType / CellColor: `Enumeration`.
-   Menu target persistence must be UUID-first after seed/sync. Template authors may use codename tokens as source descriptors only before materialization. Runtime-facing stored layout/widget config must resolve to stable UUIDs where the target is a section, object collection, hub, or tree entity.
-   Canonical menu targets must distinguish target kind. Do not blindly mirror `sectionId` into `objectCollectionId` or `hubId` into `treeEntityId`. Existing alias fields may be populated only when the target kind matches their semantics and the current renderer still requires them.
-   Menu/widget normalization must happen before layout/widget hash and drift detection in application sync. The normalized content is what `hashApplicationLayoutContent`, `hasPublishedLayoutsChanges`, `persistPublishedLayouts`, and `persistPublishedWidgets` must see.
-   Side-menu mode configuration is generic runtime infrastructure, not Interpretation Network-specific behavior.
-   `apps-template-mui` remains isolated from legacy UI packages. Do not import `@universo-react/template-mui`, metahubs frontend, applications frontend, or other deprecated feature UI into `apps-template-mui`.
-   Use existing MUI dashboard primitives and style: `SideMenu`, `MenuContent`, `renderWidget`, MUI `Drawer`/`List`/`ListItem`/`IconButton`/`Tabs`, local `apps-template-mui` `FormDialog`, `ConfirmDeleteDialog`, `CustomizedDataGrid` or existing runtime table/list/card primitives, existing row actions, and `ResourcePreview`. New Interpretation Network-only or LMS-only UI forks are not allowed unless an existing primitive demonstrably cannot express the workflow.
-   Layer ownership is a gate:
    -   Metahub owns entity definitions, enums, seeded intro/content, default layout metadata, and source template descriptors.
    -   Application control panel owns deployment-wide layout/menu overrides and conflict-aware sync state.
    -   Published application workspace owns normal user CRUD for Structures, matrix cells, relations, and materials. Do not move day-to-day knowledge-base authoring into metahub or application layout settings.

## UI Contract

| Surface                          | Controls / Display                                                                                                                                            | Hidden/System Fields                                                                                                       | Defaults                                                                                      | Validation / i18n                                                             | Responsive / Browser Proof                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Left menu runtime                | Human labels from localized menu item title or section name; icons visible in wide/compact modes; active state by UUID target                                 | `sectionId`, `objectCollectionId`, `hubId`, `treeEntityId`, `metahubId`, widget IDs are never displayed                    | Wide menu if no config exists                                                                 | Missing target is fail-closed and logged/tested, not shown as inert user item | Screenshots for wide, compact, overlay at desktop/tablet/mobile; no page overflow   |
| Metahub menu widget settings     | Checkboxes/toggles for available modes, select/segmented control for primary mode; section/startPage/hub pickers with human label and codename secondary text | UUID target values stored behind selectors; no `freeSolo`, raw id, raw codename, or raw hub-id text entry for normal users | Available: `wide`, `compact`, `overlay`; primary: `wide`                                      | At least one available mode; primary must be available; localized messages    | Dialog usable by keyboard; no raw IDs in selector labels                            |
| Application layout menu settings | Same side-menu mode controls and target selectors as metahub widget settings                                                                                  | Same UUID-only internal storage; no raw `startPage` or `Hub id` text field                                                 | Same defaults; app-level settings override/extend published layout config by clear precedence | Same validation                                                               | Component tests plus browser proof in application layout screen                     |
| Structure create dialog          | Fields: `Название` / `Name`, `Описание` / `Description`; no `Контекст` field                                                                                  | Context and parent/internal references hidden or omitted                                                                   | Name required; Description optional multiline                                                 | RU/EN labels and errors, no raw Zod/internal messages                         | Browser proof of RU dialog showing `Название` and no `Контекст`                     |
| Cell create/edit dialog          | Standard MUI/base dialog layout; tabs for basic/style if style remains separate; title is roomy/multiline enough                                              | `CellId`, row/column keys, material ref IDs hidden                                                                         | Title required if metadata requires it; Description multiline                                 | Localized labels/errors                                                       | Screenshot proves title field is not cramped                                        |
| Selected structure screen        | Header with structure title, below it MUI Tabs; first tab `Матрица` / `Matrix`                                                                                | Internal structure/interpretion IDs hidden                                                                                 | Active tab `matrix`                                                                           | Accessible tab names and keyboard navigation                                  | Desktop/tablet/mobile screenshots; no overlap/overflow                              |
| Matrix surface                   | Cells display titles and styles; drag/drop/menu move places source near target row instead of swapping payloads                                               | Cell IDs, row keys, column keys hidden                                                                                     | Existing first default cell remains                                                           | Localized move/create/delete errors                                           | Playwright real drag/drop before/after screenshot and backend persistence assertion |
| Resource/block/structured fields | Resource-source and block-content fields render with existing previews, chips, hidden fields, or Editor.js controls                                           | Raw JSON, `[object Object]`, storage descriptors, and UUID-only labels are hidden from normal tables/cards                 | Empty optional resource-source fields are quiet                                               | Localized validation only                                                     | Oracles prove no technical leakage and constrained table scroll                     |

## Plan Steps

### Phase 0: Preflight And Impact

-   [ ] Load PLAN/IMPLEMENT follow-up rules, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `playwright-best-practices`, `universo-platform-architecture`, `ontoindex-code-intelligence`, and Thermos/autoreview instructions.
-   [ ] Inspect the dirty worktree and preserve unrelated user changes.
-   [ ] Run OntoIndex impact before editing each target symbol where the tool is available. Minimum symbols:
    -   `Dashboard`
    -   `SideMenu`
    -   `AppNavbar`
    -   `MenuContent`
    -   `resolveMenuForWidget`
    -   `MenuWidgetConfig`
    -   `dashboardLayoutConfigSchema`
    -   `InterpretationNetworkWorkspaceWidget`
    -   `CellEditDialog`
    -   `moveCellMutation` / extracted matrix movement helper
    -   runtime menu normalization functions in `runtimeRowsController.ts`
    -   sync layout materialization helpers
-   [ ] If any impact result is HIGH or CRITICAL, report blast radius before editing.

### Phase 1: Menu Binding Stability After Rename/Codename Changes

-   [ ] Define a canonical menu target contract before code edits:
    -   source template descriptors may reference codenames while seeding only;
    -   persisted metahub/application/runtime widget config stores UUID target values after materialization/sync;
    -   each target keeps its semantic kind: page/section, object collection, hub/tree entity, or menu item;
    -   `startPage` may resolve to a menu item id, section UUID, object collection UUID, or hub/tree UUID only through an explicit resolver, never by ambiguous field mirroring;
    -   unresolved targets fail closed and do not create inert clickable menu entries;
    -   normal UI never asks users to type raw UUIDs, entity ids, hub ids, or codenames.
-   [ ] Add a typed pure helper in a stable shared layer, preferably `@universo-react/utils`, for menu target normalization. Keep backend map builders separate from the pure helper. Example shape:

```ts
type RuntimeMenuTargetMaps = {
    sectionByToken: Map<string, { id: string; kind: 'page' | 'objectCollection' }>
    hubByToken: Map<string, { id: string; kind: 'hub' | 'treeEntity' }>
    menuItemByToken: Map<string, { id: string }>
}

type NormalizedMenuTarget =
    | { kind: 'section'; sectionId: string }
    | { kind: 'objectCollection'; objectCollectionId: string }
    | { kind: 'hub'; hubId: string }
    | { kind: 'menuItem'; menuItemId: string }

export function normalizeMenuWidgetConfigTargets(config: MenuWidgetConfig, maps: RuntimeMenuTargetMaps): MenuWidgetConfig {
    // Resolve each field by semantic kind; do not mirror alias fields blindly.
    return normalizeByExplicitTargetKind(config, maps)
}
```

-   [ ] Apply normalization during metahub template seed/materialization so source codename tokens become stored UUIDs for the created metahub.
-   [ ] Apply normalization during publication/application sync so runtime app layout widgets store UUID targets after schema sync and before layout/widget hash or change detection:
    -   before `hashApplicationLayoutContent`;
    -   before `hasPublishedLayoutsChanges`;
    -   before `persistPublishedLayouts`;
    -   before `persistPublishedWidgets`.
-   [ ] Add tests for `hasPublishedLayoutsChanges`, `persistPublishedLayouts`, and `persistPublishedWidgets` proving UUID materialization does not create endless drift or false conflicts.
-   [ ] Update runtime menu normalization to fail closed on unresolved active section targets and avoid user-visible inert menu items unless the item is intentionally a non-clickable hub label.
-   [ ] Replace free target entry in metahub/application menu editors with selectors that save UUID values and display localized name plus codename as secondary text:
    -   remove `freeSolo` section target entry in `MenuWidgetEditorDialog.tsx`;
    -   replace raw `startPage` text entry in both metahub and application editors;
    -   replace raw `Hub id` field in `ApplicationMenuWidgetEditorDialog.tsx`;
    -   update EN/RU hints that currently mention manual `id/codename`.
-   [ ] Add explicit tests where a metahub name and codename are changed after menu creation and:
    -   entering `/metahub/:metahubId` still shows all left-menu entity sections in authoring UI;
    -   the published application runtime still shows all sections and navigates by UUID;
    -   the application layout editor continues to show human target labels, not raw IDs.

### Phase 2: Side Menu Mode Configuration

-   [ ] Extend shared types with:

```ts
export const DASHBOARD_SIDE_MENU_MODES = ['wide', 'compact', 'overlay'] as const
export type DashboardSideMenuMode = (typeof DASHBOARD_SIDE_MENU_MODES)[number]

export interface DashboardSideMenuConfig {
    availableModes: DashboardSideMenuMode[]
    primaryMode: DashboardSideMenuMode
    rememberUserChoice?: boolean
}

export const defaultDashboardSideMenuConfig: DashboardSideMenuConfig = {
    availableModes: ['wide', 'compact', 'overlay'],
    primaryMode: 'wide',
    rememberUserChoice: true
}
```

-   [ ] Add Zod validation to `dashboardLayoutConfigSchema` and `MenuWidgetConfig`-level config where appropriate:
    -   available modes cannot be empty;
    -   primary mode must be included in available modes;
    -   unknown modes are ignored or rejected consistently at API boundaries.
-   [ ] Update all layout config entry points, not only the shared type:
    -   `dashboardLayoutConfigSchema`;
    -   `defaultDashboardLayoutConfig`;
    -   `ResolvedDashboardLayoutConfig`;
    -   `normalizeDashboardLayoutConfig` in `@universo-react/utils`;
    -   any backend/runtime validators that otherwise strip unknown layout keys.
-   [ ] Implement runtime resolution precedence:
    -   local application-owned or locally modified layout settings, respecting `source_kind`, `local_content_hash`, and `sync_state`;
    -   widget-level `menuWidget.config.sideMenu` for the menu instance when that widget is the active source of the menu;
    -   materialized metahub source layout fallback;
    -   default config.
-   [ ] Define user runtime controls:
    -   if multiple modes are available, show a stable icon control in the app bar/header with localized tooltip and `aria-label`;
    -   unavailable modes are not offered;
    -   `rememberUserChoice` stores the user's selected mode per application/layout/widget scope in local storage or existing user preference storage;
    -   keyboard users can open overlay, switch modes, navigate menu items, and close overlay with Escape.
-   [ ] Update `SideMenu` to support:
    -   `wide`: current 240px permanent Drawer;
    -   `compact`: permanent mini Drawer with icon-only list, tooltips, and stable width;
    -   `overlay`: temporary Drawer opened by a menu button and not consuming content width.
-   [ ] Update `AppNavbar`/Header controls so overlay mode is available on desktop when configured, while mobile behavior remains accessible and consistent.
-   [ ] Update `MenuContent` to render compact mode without text but with accessible labels and tooltips.
-   [ ] Add menu mode controls to:
    -   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/MenuWidgetEditorDialog.tsx`;
    -   `packages/universo-react-applications-frontend/src/components/layouts/ApplicationMenuWidgetEditorDialog.tsx` and/or application layout settings surface.
-   [ ] Update default template/widget config for Interpretation Network and other defaults without any schema/template version bump.

### Phase 3: Interpretation Network Template Metadata Fixes

-   [ ] Change the structure display component from user-facing and internal generated-data `Term` / `Термин` to `Name` / `Название` for new fixture/database generation.
-   [ ] Change the component codename to `Name`; do not keep a new-template `Term` alias.
-   [ ] Change the structure entity codename from `Concept` to `Structure` in the same no-legacy cleanup; do not keep a new-template `Concept` alias.
-   [ ] Remove `Context` from the structure create workflow:
    -   either remove `Context` from `INTERPRETATION_NETWORK_CONCEPT_OBJECT_COMPONENTS`, or mark it hidden/non-form if it remains needed for future data modeling;
    -   update `structureFields` to include only concept name + description.
-   [ ] Update widget defaults:
    -   `conceptNameField: 'Name'`;
    -   `conceptDescriptionField: 'Description'`;
    -   remove `Context` fallback from create field filtering.
-   [ ] Update product generator and fixture pipeline explicitly:
    -   update `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`;
    -   update `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts` to require `Structure.Name`, `Description`, absent structure create `Context`, UUID-materialized menu targets, and generic runtime widget reuse;
    -   remove or invert any fixture contract assertion that forbids generic dashboard primitives such as `columnsContainer`, `detailsTabs`, or `detailsTable` when those are the correct reusable runtime widgets;
    -   update `tools/testing/e2e/support/checkInterpretationNetworkFixtureContract.ts`;
    -   update `tools/testing/e2e/support/interpretationNetworkRuntime.ts` and imported flow specs from `Term` locators/payloads to `Name`;
    -   regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` only through the generator, not by hand.
-   [ ] Update `packages/universo-react-metahubs-backend/src/tests/interpretationNetworkTemplateShape.test.ts` and fixture contract assertions to expect Name/Название and no visible Context in structure create.

### Phase 4: Structure Screen Tabs

-   [ ] Replace the inline caption under the selected structure title with MUI `Tabs` / `Tab`.
-   [ ] Add local state or route-safe state for selected tab, defaulting to `matrix`.
-   [ ] Render the current `matrixWorkspace` inside the Matrix tab panel.
-   [ ] Use accessible tab attributes (`id`, `aria-controls`, `role='tabpanel'`) and localized labels.
-   [ ] Keep the visual density aligned with existing dashboard template spacing; no nested cards.

### Phase 5: Cell Create/Edit Dialog Standardization

-   [ ] Replace bespoke `CellEditDialog` internals with the shared `FormDialog` where possible:
    -   pass `cellMetadataFields` and `styleFields` through existing `FieldConfig` contracts;
    -   preserve `CellStyleDialogField` support for style fields;
    -   ensure title/description fields use normal size and multiline rows from metadata.
-   [ ] If a small wrapper remains necessary for Basic/Style tabs, use the same MUI Dialog structure and spacing as `FormDialog` and avoid `size='small'` on title.
-   [ ] Ensure `CellValue` uses `uiConfig.widget='textarea'`, rows 2 or more, and localized validation.
-   [ ] Add component tests proving the title control is multiline/roomy and the dialog uses expected role/name/action layout.

### Phase 6: Matrix Move Semantics

-   [ ] Extract matrix placement logic into a pure helper that can be unit-tested.
-   [ ] Replace swap semantics with move semantics:
    -   source cell keeps its payload and `CellId`;
    -   source receives target row key/label;
    -   source gets deterministic placement metadata near the target cell;
    -   target cell payload does not move back to source row.
-   [ ] Define deterministic placement:
    -   add or reuse row-local ordering metadata, for example `ColumnOrder` / `CellOrder`, as the canonical sort key for matrix cells;
    -   dropping on a cell in another row moves the source cell to the target row and sets its order immediately after the target cell;
    -   dropping within the same row reorders by the same order helper;
    -   empty row support should be implemented if the UI exposes empty rows; otherwise tests assert no empty-row drop target exists.
-   [ ] Persist through `batchUpdateTabularRows` with only the rows that actually change, and keep workspace/objectCollection scoping.
-   [ ] Keep menu move actions aligned with the same helper as drag/drop.
-   [ ] Add optimistic disabled/pending states and localized error recovery.
-   [ ] Treat adding `@dnd-kit/*` to `@universo-react/apps-template-mui` as a package-boundary decision:
    -   allowed only if HTML5 drag/drop cannot meet accessibility and browser reliability gates;
    -   use catalog versions from `pnpm-workspace.yaml`;
    -   run the app-template isolation/package-boundary check after adding it.

### Phase 7: Tests

-   [ ] `@universo-react/types` tests:
    -   side-menu config defaults;
    -   validation rejects empty modes and primary-not-in-available;
    -   menu target normalization maps codename source tokens to UUIDs.
-   [ ] Backend Jest tests:
    -   sync/materialization remaps `menuWidget.config` references;
    -   runtime menu normalization survives stale codename after UUID normalization;
    -   `bindToHub` does not empty the menu after metahub/entity codename changes;
    -   Interpretation Network template shape expects structure Name/Название and hidden/absent Context.
    -   layout sync hashing/change detection sees already-normalized UUID widget config and does not create drift.
-   [ ] `apps-template-mui` Vitest tests:
    -   `SideMenu` renders wide/compact/overlay modes and accessible labels;
    -   `MenuContent` compact mode hides text visually but keeps accessible names/tooltips;
    -   `InterpretationNetworkWorkspaceWidget` create dialog fields are Name/Description only;
    -   selected structure renders MUI Tabs with Matrix tab;
    -   cell dialog title field uses multiline/standard sizing;
    -   matrix move helper moves without swapping.
-   [ ] Frontend layout editor tests:
    -   metahub `MenuWidgetEditorDialog` saves UUID targets and side-menu mode config and no longer exposes `freeSolo` id/codename entry;
    -   application `ApplicationMenuWidgetEditorDialog` saves UUID targets and side-menu mode config and no longer exposes raw `startPage` or `Hub id` text fields;
    -   validation messages are localized.
-   [ ] Playwright E2E additions:
    -   update existing `tools/testing/e2e/specs/flows/interpretation-network-app-imported-snapshot.spec.ts`;
    -   update existing `tools/testing/e2e/specs/smoke/interpretation-network-app-smoke.spec.ts`;
    -   update existing `tools/testing/e2e/specs/visual/interpretation-network-workspace.spec.ts`;
    -   `runtime-ux-contract.imported-interpretation-network.spec.ts`;
    -   `interpretation-network-matrix-dragdrop.browser.spec.ts`;
    -   `interpretation-network-lifecycle.browser.spec.ts`;
    -   `runtime-responsive-visual.spec.ts`;
    -   side-menu mode browser spec for wide/compact/overlay.
-   [ ] Fixture generator and snapshot contract gates:
    -   generator gate fails if generated fixture still emits `Term`, visible structure `Context`, raw target text/codename where UUID materialization is required, raw JSON/object cells, or one-off widgets bypassing generic runtime primitives;
    -   generated artifact must pass `check:interpretation-network-fixture-contract`;
    -   committed snapshot registry must pass `check:snapshot-fixtures-contract`;
    -   update `tools/testing/e2e/README.md` and `README-RU.md` for the product generator flow.
-   [ ] Playwright oracles must call:
    -   `expectNoTechnicalLeakage`;
    -   `expectNoDataGridTechnicalLeakage({ requireVisibleGrid: true })` where DataGrid is expected;
    -   `expectDataGridHorizontalScrollConstrained` or an equivalent constrained-scroll oracle where table/grid overflow is expected inside the component;
    -   `expectSemanticFieldControls`;
    -   `expectLocalizedValidation`;
    -   `expectNoPageHorizontalOverflow`;
    -   `expectRuntimeUxViewportMatrix`.

### Phase 8: Browser Evidence

-   [ ] Use Node 22 before browser tests:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
node -v
```

-   [ ] Do not run `pnpm dev`.
-   [ ] For local Supabase minimal:

```bash
pnpm run build:e2e:local-supabase
UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium specs/flows/interpretation-network-app-imported-snapshot.spec.ts specs/smoke/interpretation-network-app-smoke.spec.ts specs/visual/interpretation-network-workspace.spec.ts specs/flows/interpretation-network-matrix-dragdrop.browser.spec.ts specs/flows/interpretation-network-lifecycle.browser.spec.ts specs/visual/runtime-responsive-visual.spec.ts
UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run test:e2e:interpretation-network-fixture-gate
pnpm run check:snapshot-fixtures-contract
```

-   [ ] Capture screenshots/attachments through Playwright `testInfo.attach` after meaningful assertions for:
    -   side menu `wide`, `compact`, `overlay` closed/open;
    -   metahub/application menu settings dialogs;
    -   RU structure create dialog showing `Название` and no `Контекст`;
    -   selected structure screen with Matrix tab;
    -   cell create/edit dialog title field;
    -   matrix before and after moving a cell to another row;
    -   viewport matrix `1920x1080`, `768x1024`, `390x844`.

### Phase 9: Documentation

-   [ ] Update `packages/universo-react-apps-template-mui/README.md` and `README-RU.md`:
    -   side-menu modes;
    -   menu target UUID contract;
    -   Interpretation Network runtime workflow changes.
-   [ ] Update relevant backend/frontend package READMEs if layout authoring behavior changes.
-   [ ] Add GitBook-style docs under `docs/en/` and `docs/ru/`:
    -   runtime menu configuration;
    -   Interpretation Network structure/matrix workflow;
    -   testing/browser evidence notes for maintainers.
-   [ ] Update `memory-bank/tasks.md` during IMPLEMENT to track execution, in English.

### Phase 10: Validation And Closeout

-   [ ] Run focused tests:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/apps-template-mui test
pnpm --filter @universo-react/metahubs-backend test -- interpretationNetworkTemplateShape
pnpm --filter @universo-react/applications-backend test -- runtimeRowsController
pnpm --filter @universo-react/metahubs-frontend test
pnpm --filter @universo-react/applications-frontend test
```

-   [ ] Run fixture contract/generator checks:

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run test:e2e:interpretation-network-fixture-gate
pnpm run check:snapshot-fixtures-contract
```

-   [ ] Run relevant package builds:

```bash
pnpm --filter @universo-react/types build
pnpm --filter @universo-react/apps-template-mui build
pnpm --filter @universo-react/metahubs-backend build
pnpm --filter @universo-react/applications-backend build
pnpm --filter @universo-react/metahubs-frontend build
pnpm --filter @universo-react/applications-frontend build
```

-   [ ] Run E2E wrappers on the requested local Supabase minimal setup.
-   [ ] Run app-template isolation check / package boundary test.
-   [ ] Run `pnpm ontoindex:changes` before any commit.
-   [ ] Run Thermos/autoreview closeout. If autoreview fails due known read-only sqlite environment issue, record it as environmental and include all other evidence.

## Potential Challenges

-   Menu target normalization must preserve template authoring ergonomics while guaranteeing runtime UUID stability. The safe approach is codename allowed at source, UUID stored after materialization.
-   Compact and overlay menu modes can create layout overflow or hidden text regressions. The implementation must use stable dimensions, tooltips, accessible names, and viewport proof.
-   Matrix move semantics need a deterministic data model. If there is no explicit column/order field, the implementation may need a small metadata addition or a documented row-local ordering rule.
-   Replacing `Concept/Term` with `Structure/Name` can affect widget defaults, fixture contracts, and test data. Because there is no legacy database requirement, do direct cleanup without compatibility aliases and update all fixture/generator/runtime paths together.
-   `apps-template-mui` cannot import legacy shared UI components even if they look convenient. Any shared logic must go into `@universo-react/types`, `@universo-react/utils`, or remain duplicated inside the isolated app template.

## Dependencies

-   Context7/MUI Drawer and dnd-kit research captured in the research artifact.
-   Local Supabase minimal for E2E when running browser acceptance.
-   Playwright wrapper owns app startup on `127.0.0.1:3100`; do not use `pnpm dev`.
-   UUID v7 generation remains the repository standard for newly generated runtime IDs.

## Acceptance Criteria

-   Renaming a metahub and changing its codename does not break left menu visibility, selected section, active route, or menu navigation.
-   Menu target references are UUID-backed internally and never shown as raw IDs to normal users.
-   Menu target normalization runs before application layout/widget hash and sync drift checks; repeated sync after materialization is stable.
-   Metahub/application menu editors provide target pickers and do not expose manual raw ID/codename/startPage/hub-id inputs to normal users.
-   Side menu modes are configurable in both metahub widget settings and application layout settings; defaults are all modes available and primary `wide`.
-   Normal knowledge-base authoring stays in the published application workspace; metahub and application control panel remain configuration/deployment layers.
-   Structure create dialog shows `Название`/`Name`, `Описание`/`Description`, and no `Context`.
-   Cell create/edit dialog uses standard MUI/base presentation and the title field is not cramped.
-   Selected structure screen uses Tabs with first tab `Матрица`/`Matrix`.
-   Moving a matrix cell to another row places it near the target row/cell and does not swap the other cell back into the source position.
-   RU/EN runtime surfaces have no raw IDs, JSON/object leakage, internal validation messages, or page-level horizontal overflow.
-   Product fixture is regenerated through `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`, passes `test:e2e:interpretation-network-fixture-gate`, and the committed snapshot registry passes `check:snapshot-fixtures-contract`.
-   No schema/template version is incremented, no legacy Interpretation Network generated-data path is preserved, and new generated metahubs/applications use the updated Structure/Name model.
-   Browser screenshots and Playwright assertions prove the implemented UI at desktop, tablet, and mobile sizes.
