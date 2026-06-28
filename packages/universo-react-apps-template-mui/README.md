# @universo-react/apps-template-mui

> 🎨 **Modern Package** — TypeScript-first dashboard template with Material-UI v7

Runtime dashboard template for published applications in the Universo Platformo ecosystem. Provides a zone-based widget system, data-driven grid rendering, app-side content authoring, and reusable CRUD UI components without depending on the legacy `@universo-react/template-mui` package.

## Package Information

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| **Version**      | 0.1.0                                  |
| **Type**         | React Frontend Package (TypeScript)    |
| **Status**       | ✅ Active Development                  |
| **Framework**    | React 18 + TypeScript + Material-UI v7 |
| **Package Name** | `@universo-react/apps-template-mui`    |

## Key Features

### 🖥️ Dashboard System

-   **Zone-Based Layout**: 4 dashboard zones — left (sidebar), right (sidebar), center (main content), top (header/navbar)
-   **Data-Driven Rendering**: Widgets rendered from `ZoneWidgets` configuration, not hardcoded JSX
-   **DashboardDetailsContext**: React Context providing table data (rows, columns, pagination) to nested widgets
-   **Layout Config**: Boolean-driven visibility flags (`showSideMenu`, `showHeader`, `showColumnsContainer`, etc.)
-   **Runtime Layout Selection**: Runtime consumes application-side materialized layouts and widgets, but renders only active layouts and active widgets

### 📊 ColumnsContainer Widget

-   **Multi-Column Grid**: Renders `ColumnsContainerConfig` as MUI Grid with configurable column widths (12-unit grid)
-   **Nested Widgets**: Each column can contain multiple widgets via `ColumnsContainerColumnWidget[]`
-   **Recursion Guard**: `MAX_CONTAINER_DEPTH=1` prevents infinite nesting of columnsContainer within columnsContainer
-   **Default Seed**: 2-column layout — 9/12 `detailsTable` + 3/12 `productTree`

### 🧩 Widget Renderer

-   **Shared renderer**: `renderWidget()` maps widget keys to concrete React components
-   **Supported widgets**: `brandSelector`, `divider`, `menuWidget`, `spacer`, `infoCard`, `userProfile`, `productTree`, `usersByCountryChart`, `detailsTable`, `relationBuilder`, `columnsContainer`
-   **Union datasources**: `detailsTable` can render `records.union` by resolving multiple runtime sections from metadata and querying them through the normal `fetchAppData` surface.
-   **Relation builder**: `relationBuilder` keeps child records scoped to a selected parent row while reusing generic CRUD dialogs, record pickers, and persisted row ordering.
-   **Menu resolution**: 2-level fallback — widget ID → menus map → legacy single menu prop
-   **Curated menu contract**: Runtime menus support primary item limits, overflow items, start-page selection, and workspace entry placement without requiring LMS-only components.
-   **LMS fixture rule**: LMS published layouts use the shared MUI dashboard shell and generic data-driven widgets. Demo-only surfaces such as `brandSelector`, `productTree`, and `usersByCountryChart` are blocked by the LMS fixture contract unless they become real runtime-data surfaces.
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

### 🧱 Runtime UI Primitives

-   **Local primitives**: `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, and `useViewPreference` live in `src/components/runtime-ui`
-   **Package boundary**: Published-app runtime source is guarded by a test that rejects imports from `@universo-react/template-mui`
-   **Dashboard parity**: Runtime tables, record cards, workspace cards, and metric cards preserve the original MUI dashboard spacing and outlined card surfaces

### 🧑‍🤝‍🧑 Runtime Workspaces

-   **WorkspaceSwitcher**: Header/mobile quick switch for the user's current workspace.
-   **RuntimeWorkspacesPage**: Full workspace management section rendered inside the existing dashboard details content slot.
-   **Workspace APIs**: Typed helpers and query keys for paginated workspace lists, member lists, default switching, shared workspace creation, email-based member invitation, and member removal.
-   **Navigation placement**: Published app menus can keep the workspace entry in the primary menu, move it to overflow, or hide it while preserving the standalone switcher.

### 🔌 Route Factory

-   **createAppRuntimeRoute()**: Creates a react-router-dom v6 route for application runtime view
-   **Guard support**: Optional wrapper component (e.g., AuthGuard) for route protection
-   **Default path**: `a/:applicationId/*` pattern with full-screen minimal layout

### 🌍 Internationalization

-   **appsTranslations**: Side-effect i18n resource registration for the apps domain
-   **Locale utilities**: `getDataGridLocaleText()` for MUI DataGrid locale overrides
-   **interpretationNetwork namespace**: en + ru labels for the Interpretation Network interpretation-network `cellStylePicker` widget (`apps-template-mui/src/i18n/interpretationNetwork.ts`)

## Stage-1 Additions (Interpretation Network interpretation network)

-   **Structure-first runtime**: the Interpretation Network app opens on the localized `InterpretationNetworkIntro` Page; the `interpretationNetworkWorkspace` center widget is scoped to the `Structures` (`Concept`) section so the empty left pane only exposes `Create structure`, while the right pane owns the start memo and selected-cell `Add material` flow.
-   **`CellStyleDialogField`**: `uiConfig.widget: 'cellStylePicker'` extension of the standard `FormDialog` for the Interpretation Matrix cell color/border attributes (12-color chip grid + per-side width/style + current-field preview).
-   **Cell ID defaults**: `buildInitialTabularRowValues` creates RFC 9562 UUID v7 values for hidden `CellId` matrix fields, and the Playwright generator preserves those server-owned IDs in the exported fixture.
-   **`INTERPRETATION_NETWORK_CELL_*` types**: `INTERPRETATION_NETWORK_CELL_COLOR_PRESET_CODENAMES`, `INTERPRETATION_NETWORK_CELL_STYLE_SIDES`, `INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS`, `INTERPRETATION_NETWORK_CELL_STYLE_STYLES` from `@universo-react/types`, plus `InterpretationNetworkCellStyleState` and `InterpretationNetworkCellStyleBorder`.

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo-react/apps-template-mui build
```

## Usage

### Dashboard Integration

```tsx
import { AppsDashboard } from '@universo-react/apps-template-mui'
import type { DashboardProps } from '@universo-react/apps-template-mui'

const props: DashboardProps = {
  layoutConfig: {
    showSideMenu: true,
    showHeader: true,
    showAppNavbar: true,
    showDetailsTitle: true,
    showColumnsContainer: true,
  },
  zoneWidgets: {
    left: [
      { id: 'w1', widgetKey: 'menuWidget', sortOrder: 1, config: {} },
    ],
    center: [
      { id: 'w2', widgetKey: 'columnsContainer', sortOrder: 1, config: {
        columns: [
          { id: 'col1', width: 9, widgets: [{ widgetKey: 'detailsTable' }] },
          { id: 'col2', width: 3, widgets: [{ widgetKey: 'productTree' }] },
        ]
      }},
    ],
  },
  details: {
    title: 'Products',
    rows: [{ id: '1', name: 'Item A' }],
    columns: [{ field: 'name', headerName: 'Name', flex: 1 }],
  },
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

```tsx
import { useCrudDashboard, CrudDialogs } from '@universo-react/apps-template-mui'

function MyDashboard({ adapter }) {
    const crud = useCrudDashboard({ adapter })

    return (
        <>
            <AppsDashboard details={crud.details} layoutConfig={crud.layoutConfig} zoneWidgets={crud.zoneWidgets} />
            <CrudDialogs {...crud.dialogs} />
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
│   └── [left widgets: brandSelector, menuWidget, spacer, infoCard, userProfile]
├── AppNavbar (top zone, mobile)
├── Main Content (center zone)
│   ├── Header (top zone)
│   ├── MainGrid
│   │   ├── Overview section (optional: cards, charts)
│   │   └── Details section
│   │       ├── columnsContainer → renderWidget() per column
│   │       │   ├── Column 1 (width: 9/12) → detailsTable
│   │       │   └── Column 2 (width: 3/12) → productTree
│   │       └── OR standalone detailsTable (fallback)
│   └── Footer (optional)
└── SideMenuRight (right zone, optional)
    └── [right widgets: productTree, usersByCountryChart]
```

### DashboardDetailsContext

```
Dashboard (DashboardDetailsProvider value={details})
  └── MainGrid
       └── renderWidget('detailsTable')
            └── DetailsTableWidget
                 └── useDashboardDetails() → { rows, columns, pagination, ... }
```

Widgets inside a `columnsContainer` access table data via `useDashboardDetails()` hook,
eliminating the need to pass props through multiple component layers.

### Data Flow

```
ZoneWidgets config → Dashboard → zones distribution
  ├── left[]   → SideMenu (renderWidget per item)
  ├── right[]  → SideMenuRight (renderWidget per item)
  └── center[] → MainGrid
       └── filter by widgetKey === 'columnsContainer'
            → renderWidget(container) → Grid with nested renderWidget calls
```

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
│   │   ├── DashboardDetailsContext.tsx  # React Context for table data sharing
│   │   └── components/
│   │       ├── MainGrid.tsx            # Center zone content renderer
│   │       ├── widgetRenderer.tsx      # Shared widget key → component mapper
│   │       ├── SideMenu.tsx            # Left sidebar
│   │       ├── SideMenuRight.tsx       # Right sidebar
│   │       ├── AppNavbar.tsx           # Mobile navigation bar
│   │       ├── Header.tsx              # Top header
│   │       ├── MenuContent.tsx         # Menu widget renderer
│   │       ├── CustomizedDataGrid.tsx  # MUI DataGrid wrapper
│   │       ├── CustomizedTreeView.tsx  # Product tree widget
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

### DashboardProps

```typescript
interface DashboardProps {
    layoutConfig?: DashboardLayoutConfig // Boolean visibility flags
    zoneWidgets?: ZoneWidgets // Widget configs per zone
    details?: DashboardDetailsSlot // Table data for details widgets
    menu?: DashboardMenuSlot // Legacy single menu (deprecated)
    menus?: DashboardMenusMap // Menu map keyed by widget ID
}
```

### ZoneWidgetItem

```typescript
interface ZoneWidgetItem {
    id: string
    widgetKey: string // Widget type identifier
    sortOrder: number
    config: Record<string, unknown> // Widget-specific configuration
    isActive?: boolean
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

### DashboardLayoutConfig — View Settings

The `DashboardLayoutConfig` interface supports optional view settings that enable
enhanced display modes in the details section:

```typescript
interface DashboardLayoutConfig {
    // ... existing boolean flags (showSideMenu, showHeader, etc.)

    // View Settings (optional — when absent, classic table mode is used)
    showViewToggle?: boolean // Show card/table view mode toggle
    defaultViewMode?: 'table' | 'card' // Initial view mode
    showFilterBar?: boolean // Show search input in toolbar
    cardColumns?: number // Number of columns in card view (2–4)
    rowHeight?: number | 'auto' // Fixed pixel height or 'auto' for content-based
}
```

When `showViewToggle` or `showFilterBar` is set, the details section renders an
**EnhancedDetailsSection** that uses the package-local runtime UI primitives
(`ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `PaginationControls`) alongside the DataGrid.

These settings are validated at runtime by the `dashboardLayoutConfigSchema` Zod schema
in `api/api.ts`.

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
