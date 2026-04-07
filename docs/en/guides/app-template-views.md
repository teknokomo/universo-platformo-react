---
description: How to configure card/table view toggle, search filtering, and row height in application dashboards.
---

# Application Template View Settings

The apps-template-mui dashboard supports configurable view modes that allow
end users to switch between table and card layouts, filter data with a search
bar, and customize row display settings.

Layout authoring now lives under General -> Layouts inside the metahub.
Legacy `/layouts` links still redirect there,
but this guide uses the new navigation path.

## View Settings Overview

View settings are stored in the metahub layout `config` JSONB field and are
applied at runtime by the application dashboard. All settings are optional —
existing dashboards continue to render in default table mode when no settings
are configured.

## Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showViewToggle` | `boolean` | `false` | Show card/table view mode toggle in toolbar |
| `defaultViewMode` | `'table' \| 'card'` | `'table'` | Initial view mode when user has no saved preference |
| `showFilterBar` | `boolean` | `false` | Show search input in the toolbar |
| `cardColumns` | `2 \| 3 \| 4` | `3` | Number of columns in card view grid |
| `rowHeight` | `number \| 'auto'` | compact | Row height: fixed pixel value (min 36) or `'auto'` for content-based |

## Configuring View Settings

### Via Layout Details UI

1. Navigate to the metahub → General → Layouts.
2. Select a layout to open its detail page.
3. Scroll to the **Application View Settings** section.
4. Toggle switches and select values for each setting.
5. Changes are saved immediately to the layout configuration.

### Via API

Update the layout `config` JSONB field directly:

```json
{
  "config": {
    "showViewToggle": true,
    "defaultViewMode": "card",
    "showFilterBar": true,
    "cardColumns": 3,
    "rowHeight": "auto"
  }
}
```

## Card/Table View Toggle

When `showViewToggle` is enabled, the dashboard toolbar displays view mode
buttons. Users can switch between:

- **Table view**: The standard DataGrid rendering with sortable columns.
- **Card view**: A responsive grid of cards showing item summaries.

The user's preference is persisted in `localStorage` via the `useViewPreference`
hook from `@universo/template-mui`.

## Search/Filter Bar

When `showFilterBar` is enabled, a search input appears in the toolbar.
The search performs client-side filtering across all visible string columns.
Search is debounced (300ms) to avoid excessive re-renders.

## Row Height Options

The `rowHeight` setting controls how DataGrid rows are rendered:

- **Compact** (default): Standard compact density (~36px rows).
- **Normal** (e.g., `52`): Fixed pixel height per row.
- **Auto**: Content-based height with text wrapping enabled.

When `rowHeight` is set to `'auto'`, cells use `white-space: normal` and
`word-break: break-word` for multi-line text display.

## Integration Architecture

The enhanced dashboard section in `MainGrid.tsx` bridges the existing DataGrid
with shared components from `@universo/template-mui`:

- `ViewHeaderMUI` — search bar with toolbar controls
- `ToolbarControls` — view mode toggle buttons
- `ItemCard` — individual card component for card view
- `PaginationControls` — page navigation with a pagination state adapter
- `useViewPreference` — localStorage-backed view mode persistence

The enhancement is guarded by `isEnhancedMode` which activates only when
`showViewToggle` or `showFilterBar` is explicitly set in the layout config.
