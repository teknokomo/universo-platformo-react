# @universo-react/apps-template-mui

> 🎨 **Modern Package** — TypeScript-first dashboard and marketing-page templates with Material UI v9

Runtime dashboard template for published applications in the Universo Platformo ecosystem. Provides a zone-based widget system, data-driven grid rendering, app-side content authoring, and reusable CRUD UI components without depending on the legacy `@universo-react/template-mui` package.

## Package Information

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| **Version**      | 0.1.0                                  |
| **Type**         | React Frontend Package (TypeScript)    |
| **Status**       | ✅ Active Development                  |
| **Framework**    | React 18 + TypeScript + Material UI v9 |
| **Package Name** | `@universo-react/apps-template-mui`    |

## Key Features

### 🖥️ Dashboard System

-   **Zone-Based Layout**: 5 dashboard zones — left (sidebar), top (header/navbar), right (sidebar), center (main content), and bottom (footer/content tail)
-   **Data-Driven Rendering**: Widgets rendered from `ZoneWidgets` configuration, not hardcoded JSX
-   **DashboardDetailsContext**: Scoped host context for Page metadata blocks, standalone workspace-page content, and page-player settings; Entity data is delivered to each widget through its validated runtime DTO.
-   **Persisted Composition**: The effective placement graph is the only source of Dashboard widget visibility and placement. Child widgets are independent placements connected by semantic `parentInstanceKey` and `slotKey`; when no placements exist, the Dashboard shows its localized empty state. There is no boolean visibility fallback.
-   **Multiline runtime data**: Semantic long-text cells wrap safely and use auto-height rows by default; configured numeric row heights remain supported.
-   **Runtime Layout Selection**: Hosted and standalone runtimes consume the same target-aware effective-layout response and render only active layouts and active widgets
-   **Entity-backed Dashboard data**: Source-backed placements consume typed, bounded runtime projections; bindings and datasource query logic stay outside renderer configuration, and missing, denied, or stale sources render localized states.
-   **Scoped bound-row actions**: Hosted and standalone Dashboard runtimes share `useDashboardBoundRowActions`; it resolves source Entities unambiguously, checks their permissions, reloads the row in the active workspace, and carries its current version into the existing CRUD, record-command, and workflow handlers. Its public load-state contract hides stale row data while a refetch is pending.
-   **Entity target resolution**: `resolveDashboardEntityTargetSectionId` prefers explicit Entity IDs, resolves unique codenames, and fails closed when a codename matches more than one Entity.

### 📣 Data-driven Marketing Page

-   **MUI 9 reference composition**: App bar, hero, logos, features, testimonials, highlights, pricing, FAQ, and footer are rendered from a typed `MarketingPageData` view model.
-   **Entity-owned content**: The published application runtime receives validated, localized Entity projections from the `marketing-page` metahub template; no section owns a hardcoded demo array. All content-bearing placements render their projected records, while widget configuration carries presentation and placement rather than duplicated business content.
-   **Safe actions and media**: Internal, anchor, external, email, and telephone actions are validated before rendering; unsafe URLs and missing media fail closed with localized feedback.
-   **Application appearance**: Theme mode, bounded colors, and action policy are configured in the typed application layout; persisted marketing widget instances own zone, order, active state, and presentation flags. Marketing text, media, and actions reach renderers only through validated Entity-backed `data.records` projections; widget config contains presentation settings and semantic placement identity, never source locators or duplicate content.
-   **Entity-backed runtime projections**: Authenticated and public runtimes supply bounded records inside the established `data.records` envelope. The isolated renderer DTO strips persistence identity before rendering, and the public Image projection accepts HTTPS URLs only; storage locators never cross the anonymous boundary.
-   **Instance-oriented layouts**: Runtime layout data preserves every active placement, including multiple rows with the same widget key. Placement identity is separate from widget type, so repeatable dashboard and marketing instances render independently; the dashboard `appNavbar` and `header` are explicit single-shell placements.
-   **One theme boundary**: Hosted and standalone shells own providers; `MarketingPage` is presentational and provider-free.
-   **Atomic marketing header**: `marketing.brand`, repeatable `marketing.navigation`, singleton `marketing.auth`, `languageSwitcher`, and `colorModeSwitcher` are persisted as separate header capabilities. One `MarketingHeaderShell` owns the banner, responsive Drawer, measured fixed offset, and Start/End groups.
-   **Shared controls**: `languageSwitcher` and `colorModeSwitcher` use the same registry definitions in Dashboard `top` and marketing `marketing-header`; the runtime renders each active persisted capability once.
-   **Header behavior**: The marketing header supports localized fixed-on-screen and normal-flow modes. Fixed mode preserves the original MUI reference composition with one `ResizeObserver`, the original 28px visual offset, and content scrolling behind the fixed shell; flow mode leaves no fixed-header residue.

### 📊 ColumnsContainer Widget

-   **Multi-Column Grid**: Renders `ColumnsContainerConfig` as MUI Grid with configurable column widths (12-unit grid)
-   **Nested Widgets**: Each column can contain multiple independent placements linked to the container by semantic `parentInstanceKey` and `slotKey`; widget config never embeds child widgets.
-   **Recursion Guard**: `MAX_CONTAINER_DEPTH=8` bounds nested containers and prevents unbounded recursive rendering.
-   **Placement composition**: The default dashboard seed is defined by explicit placements and Entity bindings. Nested container children are independent placements linked by `parentInstanceKey` and `slotKey`.

### 🧩 Widget Renderer

-   **Shared renderer**: `renderWidget()` maps widget keys to concrete React components
-   **Registered widgets**: `workspaceSwitcher`, `divider`, `menuWidget`, `spacer`, `infoCard`, `userProfile`, `appNavbar`, `header`, `breadcrumbs`, `search`, `datePicker`, `optionsMenu`, `languageSwitcher`, `colorModeSwitcher`, `overviewTitle`, `overviewCards`, `sessionsChart`, `pageViewsChart`, `detailsTitle`, `detailsTable`, `relationBuilder`, `columnsContainer`, `detailsTabs`, `interpretationNetworkWorkspace`, `quizWidget`, `playcanvasCanvas`, `resourcePreview`, `learnerPlayer`, `footer`
-   **Union datasources**: `detailsTable` can render `records.union` by resolving multiple runtime sections from metadata and querying them through the normal `fetchAppData` surface.
-   **Relation builder**: `relationBuilder` keeps child records scoped to a selected parent row while reusing generic CRUD dialogs, record pickers, and persisted row ordering.
-   **Menu data**: Each `menuWidget` renders only its validated placement runtime data; the renderer does not synthesize fallback menu content.
-   **Generated Dashboard navigation**: Visible Page entities become navigation entries, optionally grouped by their Hub memberships. Objects remain data sources by default; only explicitly selected primary-navigation Objects (`config.runtime.menuVisibility: "primary"`) become links. This keeps ordinary Objects and registers out of the sidebar. Page, Hub, and selected Object icons use bounded semantic metadata mapped to existing MUI icons, with safe defaults.
-   **Hosted and standalone routing**: Published Dashboard menu links use the host application's navigation callback to keep the URL and loaded runtime target synchronized. Standalone deployments support both pathname-based History API navigation and `#/a/...` hash routes.
-   **Curated menu contract**: Runtime menus support primary item limits, overflow items, start-page selection, and workspace entry placement without requiring LMS-only components.
-   **Template parity**: Built-in templates use registered generic widgets for shared Dashboard behavior and keep specialized quiz, PlayCanvas, and Interpretation Network runtimes in their owning renderers.
-   **Generic runtime data surfaces**: Saved-report aggregations, resource previews, sequence policies, and workflow actions are configured through shared widget/Object metadata instead of LMS-specific widget forks.

### 📝 CRUD Components

-   **FormDialog**: Generic modal form with configurable fields, validation rules, and Zod integration
-   **ConfirmDeleteDialog**: Confirmation dialog for delete operations
-   **CrudDialogs**: Combined create/edit/delete dialog component
-   **RowActionsMenu**: Per-row action menu with edit/delete options
-   **useCrudDashboard**: Headless controller hook managing CRUD state and API calls
-   **Workflow actions**: Metadata-backed row actions rendered only when effective runtime capabilities explicitly allow them
-   **Block-content authoring**: JSON fields configured with `editorjsBlockContent` reuse the shared `@universo-react/block-editor` package instead of exposing raw JSON or carrying a runtime-local editor fork
-   **ResourcePreview**: Generic safe preview component for supported resource source types with localized deferred/unsupported states
-   **Reports and export**: Published runtime can render saved reports through generic details widgets and export server-defined CSV reports
-   **Trash-aware operations**: Runtime lists can request `lifecycleState=deleted`, delete calls pass optimistic row versions, and adapters expose restore calls for generic soft-delete contracts.
-   **Page player progress**: Metadata Pages can render Editor.js page blocks with outline/progress controls and persist completion through the generic runtime progress API.
-   **Metadata Page display**: Validated Editor.js-compatible `Page.blockContent` renders through the existing `PageBlocksView` host-content slot before the persisted Dashboard placements; page text never enters widget configuration.

### 🧱 Runtime UI Primitives

-   **Local primitives**: `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, and `useViewPreference` live in `src/components/runtime-ui`
-   **Package boundary**: Published-app runtime source is guarded by a test that rejects imports from `@universo-react/template-mui`
-   **Dashboard parity**: Runtime tables, record cards, workspace cards, and metric cards preserve the original MUI dashboard spacing and outlined card surfaces

### 🧑‍🤝‍🧑 Runtime Workspaces

-   **WorkspaceSwitcher**: Header/mobile quick switch for the user's current workspace.
-   **RuntimeWorkspacesPage**: Full workspace management section rendered inside the existing dashboard details content slot.
-   **Workspace route shell**: Workspace management keeps registry-declared Dashboard host controls and filters content widgets from every shell zone; the content footer is hidden on this route.
-   **Workspace APIs**: Typed helpers and query keys for paginated workspace lists, member lists, default switching, shared workspace creation, email-based member invitation, and member removal.
-   **Navigation placement**: Published app menus can keep the workspace entry in the primary menu, move it to overflow, or hide it while preserving the standalone switcher.
-   **Workspace Settings**: Allowed per-workspace overrides are rendered through the existing workspace page cards and use localized labels from the runtime `apps` bundle. Locked keys stay controlled by Application Settings.

### 🔌 Route Factory

-   **createAppRuntimeRoute()**: Creates a react-router-dom v6 route for application runtime view
-   **Guard support**: Optional wrapper component (e.g., AuthGuard) for route protection
-   **Default path**: `a/:applicationId/*` pattern with full-screen minimal layout

### 🌍 Internationalization

-   **appsTranslations**: Side-effect i18n resource registration for the apps domain
-   **Locale utilities**: `getDataGridLocaleText()` for MUI DataGrid locale overrides
-   **interpretationNetwork namespace**: en + ru labels for the Interpretation Network workspace, the three Matrix view controls, semantic table states, and `cellStylePicker` widget (`apps-template-mui/src/i18n/interpretationNetwork.ts`)

## Stage-1 Additions (Interpretation Network)

-   **Structure-first runtime**: the Interpretation Network app opens on the localized `InterpretationNetworkIntro` Page; the `interpretationNetworkWorkspace` center widget is scoped to the `Structures` (`Concept`) section so the empty left pane only exposes `Create structure`, while the right pane owns the start memo and selected-cell `Add material` flow.
-   **Structure navigation modes**: the built-in Interpretation Network template defaults to `structureMode: "multiple"`, showing the Structure list. Authors can explicitly select `singleSystem` to use one server-owned hidden Structure and open its Matrix directly from `Structures`, without the catalog, visible Structure name, or back control. The Matrix and Templates tabs remain available according to `templatePanel.showInMatrix`.
-   **Hierarchy-first Matrix**: `interpretationNetworkWorkspace.config.matrixMode` defaults to `hierarchicalCells`. New Structures seed one root cell named `Universe` / `Вселенная`, and users create further cells with the right-aligned `Add child` action. `independentRows` remains available for row/column compatibility.
-   **Workspace table templates**: editors with create+edit content permissions can save the current Structure as a template, choosing structure-only copy or copy with attached cell Materials. Multi-Structure deployments can instantiate a new visible Structure from a saved template; single-system deployments keep creation hidden and still allow saving the current Matrix as a reusable template.
-   **Template placement and access**: `templatePanel.showInStructureList` and `templatePanel.showInMatrix` default to `true`. If both are `false`, templates remain isolated workspace data but no template UI is exposed. Save/instantiate require create+edit content permissions, metadata changes require edit, and deletion requires delete. Matrix and optional authored Material fields are cloned with fresh UUID v7 identities; Relations, binary objects, and external files are not cloned, while ordinary external URLs already stored in Material `Body` remain authored content.
-   **Peer Matrix view contract**: `allowedMatrixViews`, `defaultMatrixView`, `tableProjection`, `breadcrumbDepth`, `toolbarLayout`, `showHierarchicalTableHeaders`, `showHierarchicalTableHeaderCard`, `showMatrixTreeTotalCells`, and `colorBreadcrumbsByCell` come from the shared `@universo-react/types` contract. The runtime lets users switch among the allowed `table`, `horizontalRows`, and `verticalTree` views and falls back to an allowed configured view.
-   **Hierarchical Table view**: Table defaults to `hierarchicalPath`: parent cells render as clickable cell-colored breadcrumbs, the focused parent is a separate table context card by default, direct children render as rows, finite breadcrumb depth uses an ellipsis menu, the total tree-cell counter is shown by default, optional column headers are hidden by default, and breadcrumb clicks update selection, URL focus, and the Materials pane.
-   **Independent-axis Table projection**: `tableProjection: "independentAxes"` keeps the explicit row/column table available with real table headers, row headers, accessible cell names, localized empty intersections, local horizontal scrolling, and no page-level horizontal overflow.
-   **Matrix drag/drop UX**: cells use dnd-kit sortable primitives with a drag overlay, muted origin slot, dashed drop indicator, invalid target state, and menu/keyboard fallback through the existing card action menu.
-   **`CellStyleDialogField`**: `uiConfig.widget: 'cellStylePicker'` extension of the standard `FormDialog` for the Interpretation Matrix cell color/border attributes (12-color chip grid + per-side width/style + current-field preview).
-   **Cell ID and hierarchy defaults**: `buildInitialTabularRowValues` creates RFC 9562 UUID v7 values for hidden `CellId` matrix fields. `ParentCellId` is hidden/system-owned, `_tp_sort_order` stores sibling order, and `Depth` is derived at runtime.
-   **Flexible cell authoring**: users edit `RowLabel`, `ColLabel`, `CellValue`, and optional multiline `CellDescription`. `CellId`, `ParentCellId`, `RowKey`, `ColKey`, and `_tp_sort_order` remain protected system fields.
-   **`INTERPRETATION_NETWORK_CELL_*` types**: `INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES`, `INTERPRETATION_NETWORK_CELL_STYLE_SIDES`, `INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS`, `INTERPRETATION_NETWORK_CELL_STYLE_STYLES` from `@universo-react/types`, plus `InterpretationNetworkCellStyleState` and `InterpretationNetworkCellStyleBorder`.

All three Matrix views use one data model. They preserve compatible creation, selection, material attachment, styling, movement, and drag/drop behavior. Internal UUIDs, axis keys, parent IDs, persisted order, widget IDs, relation IDs, and JSON payloads stay hidden from normal user surfaces.

### Documentation and Screenshot Gate

-   The user guide lives in `docs/en/interpretation-network/` and `docs/ru/interpretation-network/` with GitBook summary entries and localized screenshots.
-   Screenshot generation uses the real imported-snapshot runtime through `pnpm docs:interpretation-network:screenshots:local-supabase`; the generator writes `tools/docs/interpretation-network-screenshot-provenance.json`.
-   `pnpm docs:interpretation-network:check` validates EN/RU document parity, localized step screenshots, provenance freshness, non-blank `1920x1080` assets, no raw IDs/JSON, and runtime UX evidence before the guide is accepted.
-   `pnpm docs:interpretation-network:drift:check` runs after regeneration in the verification workflow and fails when the generated PNG/provenance evidence differs from the tracked baseline or remains untracked.

### PlayCanvas Script-Asset Runtime

`PlayCanvasCanvasWidget` can bind to a published `runtimeManifest`. When the
manifest contains scripts, the widget waits for every artifact to load before
calling `app.start()`. The main-thread loader fetches each `data:` or HTTP URL,
checks the lowercase hexadecimal SHA-256 `artifactHash`, imports the module as
`text/javascript`, registers its exported script class in the app-scoped
registry, and attaches it to the entity named by `sceneEntityStableId` with the
published attribute values. A missing entity, failed fetch, or hash mismatch
fails closed and shows the localized script-load error.

The canvas exposes stable diagnostic markers for browser verification:
`data-scripts-loaded` (`true`, `failed`, or `none`), `data-runtime-module-executed`,
`data-ship-screen-x`, `data-ship-screen-y`, `data-camera-distance`, and
`data-camera-yaw`. The MMOOMM fixture uses these markers to prove script loading,
flight movement, and camera behavior without exposing internal ids in the UI.

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo-react/apps-template-mui build
```

## Usage

### Dashboard Integration

Pass the validated effective Dashboard composition to `AppsDashboard` after the
published runtime loader resolves it. Do not construct visibility from boolean
flags or embed child widgets in container config:

```tsx
import { AppsDashboard, fetchRuntimeEffectiveLayout, toDashboardZoneWidgets } from '@universo-react/apps-template-mui'
import type { DashboardProps } from '@universo-react/apps-template-mui'

const effectiveLayout = await fetchRuntimeEffectiveLayout({ apiBaseUrl, applicationId })
if (effectiveLayout.status !== 'ok' || effectiveLayout.layout.templateKey !== 'dashboard') {
  throw new Error('A Dashboard effective layout is required')
}

const props: DashboardProps = {
  zoneWidgets: toDashboardZoneWidgets(effectiveLayout),
}

<AppsDashboard {...props} />
```

### Route Factory

```tsx
import { createAppRuntimeRoute } from '@universo-react/apps-template-mui'
import ApplicationRuntime from './ApplicationRuntime'
import AuthGuard from './AuthGuard'

const runtimeRoute = createAppRuntimeRoute({
    component: ApplicationRuntime,
    guard: AuthGuard
})

// Use in MinimalRoutes children:
// children: [...otherRoutes, runtimeRoute]
```

### CRUD Dashboard Hook

The hook requires an adapter and locale and returns `CrudDashboardState`.
`CrudDialogs` receives that state plus localized labels. Dashboard placements
and optional host/runtime details are supplied by the host, not by the CRUD hook.
Entity-backed placements use the shared `useDashboardBoundRowActions` hook for
permission-checked row actions and optimistic-version-aware record/workflow
mutations; it reuses the existing runtime menu and CRUD dialogs.

```tsx
import { AppsDashboard, CrudDialogs, useCrudDashboard } from '@universo-react/apps-template-mui'
import type { CrudDataAdapter, CrudDialogsLabels, DashboardDetailsSlot, ZoneWidgets } from '@universo-react/apps-template-mui'

type MyDashboardProps = {
    adapter: CrudDataAdapter | null
    locale: string
    labels: CrudDialogsLabels
    zoneWidgets?: ZoneWidgets
    details?: DashboardDetailsSlot
}

function MyDashboard({ adapter, locale, labels, zoneWidgets, details }: MyDashboardProps) {
    const state = useCrudDashboard({ adapter, locale })

    return (
        <>
            <AppsDashboard details={details} zoneWidgets={zoneWidgets} />
            <CrudDialogs state={state} locale={locale} labels={labels} />
        </>
    )
}
```

### Standalone App

```tsx
import { DashboardApp } from '@universo-react/apps-template-mui'

// Renders a standalone dashboard with its own i18n and theme
;<DashboardApp adapter={myAdapter} />
```

## Architecture

### Zone-Based Widget System

```
Dashboard
├── SideMenu (left zone)
│   └── active left-zone placements, rendered from validated runtime data
├── AppNavbar (top zone, mobile)
├── Main Content (center zone)
│   ├── Header (top zone)
│   ├── MainGrid renders active root placements in effective order
│   │   └── containers resolve children by semantic parentInstanceKey + slotKey
│   └── Bottom widgets (bottom zone, optional)
└── SideMenuRight renders active root placements from the right zone
```

### DashboardDetailsContext

```
Dashboard (DashboardDetailsProvider value={details})
  └── MainGrid
       ├── optional standalone workspace host content
       └── renderWidget(placement.runtimeData)
            └── validated typed Entity projection
```

Nested widget content comes from its typed runtime DTO. The context is retained for
explicit standalone host content and Page Player settings; it is not a parallel
store for widget business data.

### Data Flow

```
ZoneWidgets config → Dashboard → zones distribution
  ├── left[]   → SideMenu (renderWidget per item)
  ├── top[]    → explicit top placements; Header hosts only controls without an equivalent placement
  ├── right[]  → SideMenuRight (renderWidget per item)
  ├── center[] → MainGrid
       └── render root placements; containers resolve graph children by semantic parent + slot
  └── bottom[] → Main Content footer/content tail
```

### Target-aware runtime contract

The runtime first requests `GET /api/v1/applications/:applicationId/runtime/effective-layout`.
The request may target the global application surface or an authorized Page/Object
entity type. The server applies entity-scoped precedence, validates template and
widget capabilities, and returns the selected template, zones, lineage, and
`effectiveHash` in one response. `recordKey` belongs only to content hydration;
it never selects a layout.

Same-template scoped layouts may be sparse overlays. A scoped layout with a
different template is an explicit independent composition: it does not inherit
incompatible widgets or physical zones. Missing or invalid materialization is a
localized fail-closed runtime error, not a silent global-template fallback.

The standalone entry uses the same effective-layout API and requires an
authenticated runtime adapter with target/workspace context. GuestApp and
anonymous template selection are outside this contract.

Hosted routes keep runtime context in the normal query string. Standalone
hash routes keep the same parameters inside the hash route, for example:

```text
/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&workspaceId=<workspaceId>&locale=ru
/#/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&workspaceId=<workspaceId>&locale=ru
```

The shared language control updates the correct query location and preserves
target/workspace parameters. Invalid target selectors fail closed before any
layout is rendered.

## File Structure

```
packages/universo-react-apps-template-mui/
├── src/
│   ├── api/              # Data adapter types and implementations
│   │   ├── types.ts      # CrudDataAdapter, CellRendererOverrides interfaces
│   │   ├── adapters.ts   # createStandaloneAdapter factory
│   │   └── mutations.ts  # appQueryKeys, React Query utilities
│   ├── components/       # Reusable UI components
│   │   ├── block-editor/             # Published-app Editor.js authoring surface
│   │   ├── dialogs/
│   │   │   ├── FormDialog.tsx          # Generic configurable form dialog
│   │   │   └── ConfirmDeleteDialog.tsx # Delete confirmation dialog
│   │   ├── resource-preview/         # Generic safe resource preview states
│   │   ├── runtime-ui/               # Local runtime view/list/card primitives
│   │   ├── CrudDialogs.tsx             # Combined CRUD dialog component
│   │   └── RowActionsMenu.tsx          # Per-row actions dropdown
│   ├── dashboard/        # Dashboard core
│   │   ├── Dashboard.tsx               # Main dashboard component (zone orchestrator)
│   │   ├── DashboardDetailsContext.tsx  # Host/runtime context; widget Entity data comes from typed runtime DTOs
│   │   └── components/
│   │       ├── MainGrid.tsx            # Center zone content renderer
│   │       ├── widgetRenderer.tsx      # Shared widget placement dispatcher
│   │       ├── DashboardDataWidget.tsx # Entity-bound tables, relations, and metrics
│   │       ├── LibraryDetailsTableWidget.tsx # Actor-scoped library and trash view
│   │       ├── ReportDetailsTableWidget.tsx  # Saved report runtime view
│   │       ├── LearnerPlayerWidget.tsx # Sequenced learning content and progress
│   │       ├── SideMenu.tsx            # Left sidebar
│   │       ├── SideMenuRight.tsx       # Right sidebar
│   │       ├── AppNavbar.tsx           # Mobile navigation bar
│   │       ├── Header.tsx              # Top header
│   │       ├── MenuContent.tsx         # Menu widget renderer
│   │       ├── CustomizedDataGrid.tsx  # MUI DataGrid wrapper
│   │       └── ...                     # Charts, stat cards, etc.
│   ├── hooks/            # Custom React hooks
│   │   └── useCrudDashboard.ts         # Headless CRUD controller
│   ├── i18n/             # Internationalization resources
│   ├── layouts/          # Layout wrappers
│   │   └── AppMainLayout.tsx           # Main application layout
│   ├── routes/           # Route configuration
│   │   └── createAppRoutes.tsx         # Route factory function
│   ├── standalone/       # Standalone app entry
│   │   └── DashboardApp.tsx            # Self-contained dashboard app
│   ├── workspaces/       # Runtime workspace management screens
│   │   └── RuntimeWorkspacesPage.tsx
│   ├── utils/            # Utility functions
│   │   ├── columns.ts    # toGridColumns, toFieldConfigs
│   │   └── getDataGridLocale.ts        # MUI DataGrid locale helper
│   └── index.ts          # Package exports
├── package.json
├── tsconfig.json
├── tsconfig.build.json   # Build-specific TypeScript config
├── vite.config.ts        # Vite configuration (standalone dev)
└── README.md             # This file
```

## Key Types

### Dashboard menu type migration

The former root exports `DashboardMenuItem`, `DashboardMenuSlot`, and `DashboardMenusMap` were removed with the legacy menu-prop path. They have no one-to-one replacement: menu content is now configured as registered Dashboard widget placements and resolved entity-backed runtime data. For custom Dashboard hosts, consume validated `ZoneWidgets` and the `ZoneWidgetItem` / `DashboardDetailsSlot` types exported from `@universo-react/apps-template-mui`; do not recreate menu rows from raw entity IDs.

### DashboardProps

```typescript
interface DashboardProps {
    layoutConfig?: Pick<DashboardLayoutConfig, 'sideMenu'> // Side-menu behavior only
    zoneWidgets?: ZoneWidgets // Validated effective placements grouped by zone
    details?: DashboardDetailsSlot // Host/runtime context; widget data comes from typed runtime DTOs
}
```

### ZoneWidgetItem

```typescript
interface ZoneWidgetItem {
    id: string // UUID v7 placement identity
    instanceKey: string // Semantic placement identity
    widgetKey: string // Registered widget type
    zone: 'left' | 'top' | 'right' | 'bottom' | 'center'
    sortOrder: number
    config: Record<string, unknown> // Strictly validated by the canonical widget registry before rendering
    isActive: boolean
    parentInstanceKey: string | null
    slotKey: string | null
}
```

### DashboardDetailsSlot

```typescript
interface DashboardDetailsSlot {
    title: string
    rows: Array<Record<string, unknown> & { id: string }>
    columns: GridColDef[]
    loading?: boolean
    rowCount?: number
    paginationModel?: GridPaginationModel
    onPaginationModelChange?: (model: GridPaginationModel) => void
    pageSizeOptions?: number[]
    actions?: React.ReactNode // Toolbar actions (e.g., Create button)
    localeText?: Partial<GridLocaleText> // MUI DataGrid locale overrides
}
```

### Dashboard shell settings

Dashboard visibility comes from effective widget placements. `layoutConfig` on
the direct component accepts only side-menu behavior settings; widget presentation
belongs to each widget's strict registry config:

```typescript
type DashboardShellLayoutConfig = Pick<DashboardLayoutConfig, 'sideMenu'>

interface EffectiveChildPlacement {
    instanceKey: string
    parentInstanceKey: string
    slotKey: string
}
```

## Development

### Available Modules

```bash
# Development
pnpm build                       # Type-check (noEmit)
pnpm dev:standalone              # Standalone Vite dev server (port 5174)
pnpm preview:standalone          # Preview standalone build

# Code Quality
pnpm lint                        # Run ESLint
```

### TypeScript Configuration

The package uses strict TypeScript configuration with `noEmit` build mode.
Source files are consumed directly by other workspace packages via `main`/`module` pointing to `./src/index.ts`.

## Related Packages

-   [`@universo-react/metahubs-frontend`](../universo-react-metahubs-frontend/README.md) — Metahub management UI
-   [`@universo-react/metahubs-backend`](../universo-react-metahubs-backend/README.md) — Backend service
-   [`@universo-react/types`](../universo-react-types/README.md) — Shared TypeScript types
-   [`@universo-react/i18n`](../universo-react-i18n/README.md) — Shared localization resources
-   [`@universo-react/utils`](../universo-react-utils/README.md) — Shared runtime normalization and utility helpers

---

_Part of [Universo Platformo](../../README.md) — A package-based business platform_
