# Plan: Metahub "General" Section + Catalog-Specific Layouts (Revised)

> **Created**: 2026-04-06  
> **Revised**: 2026-04-06 (addresses all QA findings from [QA report](general-section-catalog-layouts-QA-2026-04-06.md); second-pass QA adjustments applied)  
> **Status**: Draft v2 — awaiting approval  
> **Creative reference**: [creative-general-section-layout-model.md](../creative/creative-general-section-layout-model.md)  
> **Complexity**: Level 3 (multi-package, schema change, new domain concept)

---

## Overview

Create a new "General" (Общие) **tabbed page** in the metahub sidebar (following the SettingsPage pattern), place its menu item immediately below the divider after Branches and above Hubs, move Layouts into its first tab, and add catalog-specific layouts with a **sparse overlay/inheritance** model. Catalog layouts inherit widgets from an explicit base global layout, store only inherited-widget visibility/position overrides, reuse the existing widget table for catalog-owned widgets, and support full drag-and-drop ordering across inherited and custom widgets. Multiple catalog layouts per catalog, with default/active/inactive. Catalog layout editing also becomes the primary source of truth for the catalog runtime behavior settings that are not part of `DashboardLayoutConfig` (`showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`) by reusing the existing catalog runtime enums/settings shape rather than inventing a parallel contract, while catalogs without a custom layout continue to fall back to the current catalog runtimeConfig behavior until the first catalog layout is created. Publication/sync materializes catalog layouts into ordinary runtime layout/widget rows so the existing application runtime contract stays simple and stable.

---


## QA Issues Addressed

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| C1 | General section = tabbed page, NOT collapse group | CRITICAL | GeneralPage.tsx with SettingsPage tab pattern; update REAL menu in menuConfigs.ts |
| C2 | Catalog layouts = overlay model, NOT fork | CRITICAL | Overlay/inheritance: read-only global widgets + catalog widgets + merged sort |
| C3 | Multiple catalog layouts per catalog | CRITICAL | Full CRUD on `_mhb_layouts` with `catalog_id`; is_default + is_active per catalog |
| M1 | Surface type (dialog/page) E2E verification | MAJOR | Dedicated Playwright phase to verify + fix page mode |
| M2 | Surface settings in layout editor | MAJOR | Move create/edit/copy surface settings into catalog-layout-level config; catalog form becomes the entry point to catalog layouts, not the source of truth |
| M3 | Layouts NOT separate menu item | MAJOR | Remove `metahub-layouts` from getMetahubMenuItems(); add `metahub-general` |
| m1 | Legacy migration unnecessary | MODERATE | Direct schema update in systemTableDefinitions.ts; no platform migration |
| m2 | Two menu systems need sync | MODERATE | Update BOTH menuConfigs.ts (real) and metahubDashboard.ts (descriptive) |
| m3 | Inheritance source = active default global layout | MODERATE | Clear resolution: `is_default = true AND is_active = true AND catalog_id IS NULL` |
| m4 | E2E = single comprehensive flow | MODERATE | One integrated Playwright test following exact spec path |

### Second QA Pass Adjustments

- Place `metahub-general` immediately after the divider that follows Branches and before Hubs, not in the old Layouts slot.
- Use **sparse** inherited-widget overrides only; do not pre-create override rows for every global widget.
- Store catalog-owned widgets in the existing `_mhb_widgets` table under catalog-scoped layout rows; use the override table only for inherited-widget deltas.
- Materialize merged catalog layouts into ordinary snapshot/runtime layout + widget rows during publication/sync; do not introduce a new runtime override table.
- Move create/edit/copy surface settings, `showCreateButton`, and `searchMode` into catalog-layout-level behavior config so multiple catalog layouts stay deterministic without regressing the current catalog runtime options.
- Explicitly define behavior-config resolution order: selected catalog layout behavior config wins; if no catalog layout exists yet, fall back to the catalog's current runtimeConfig behavior subset.
- Extract and reuse existing layout list/detail primitives instead of building a separate mini-list/component family for catalog layouts.
- Cover `copySurface` explicitly in Playwright assertions and reuse the existing E2E helper/selector infrastructure.

---

## Affected Areas

| Package | Scope |
|---------|-------|
| `@universo/metahubs-frontend` | GeneralPage, catalog layout editor with overlay UI, i18n |
| `@universo/metahubs-backend` | Schema update, overlay service methods, routes, snapshot |
| `@universo/universo-types` | Overlay types: CatalogLayoutOverride, merged widget types |
| `@universo/universo-utils` | Overlay resolution helpers |
| `@universo/universo-template-mui` | Menu restructuring (getMetahubMenuItems), page spacing constants |
| `@universo/apps-template-mui` | Runtime catalog-specific layout resolution, surface type fix |
| `@universo/applications-backend` | Runtime sync for catalog layouts |
| `@universo/schema-ddl` | SchemaGenerator: `catalog_id` on `_app_layouts` |
| `docs/` | GitBook EN/RU pages for General section + catalog layouts |
| `tools/testing/e2e/` | Comprehensive Playwright E2E test |

---

## Architecture: Overlay/Inheritance Model

### Core Concept

Catalog layouts do NOT fork (copy) from global layouts. Instead, each catalog layout points to an explicit **base global layout** and resolves its effective widgets from three sources:

```
┌──────────────────────────────────────────────────────────────┐
│ Base Global Layout (referenced by base_layout_id)           │
│   widgets live in _mhb_widgets                              │
└──────────────────────────────┬───────────────────────────────┘
                               │ inherited read-only
                 ┌─────────────▼─────────────┐
                 │ Sparse inherited overrides │
                 │ (_mhb_catalog_widget_overrides) │
                 │ only changed visibility/zone/order │
                 └─────────────┬─────────────┘
                               │ merged with
┌──────────────────────────────▼───────────────────────────────┐
│ Catalog-owned widgets                                        │
│ live in the existing _mhb_widgets table under the            │
│ catalog-scoped layout row                                    │
└──────────────────────────────────────────────────────────────┘
```

### Schema Design

**`_mhb_layouts`** — add catalog scope + explicit inheritance source:
- `catalog_id IS NULL` → global layout (existing behavior)
- `catalog_id = <uuid>` → catalog-specific layout
- `base_layout_id UUID NULL`:
  - `NULL` for global layouts
  - required for catalog layouts, references the global layout they inherit from
- `config JSONB` keeps storing the normal `DashboardLayoutConfig`, and for catalog layouts additionally carries a nested behavior block (for example `config.catalogRuntimeConfig`) with the catalog runtime options that are not part of `DashboardLayoutConfig`

**`_mhb_widgets`** — unchanged table, reused for:
- global layout widgets (existing behavior)
- catalog-owned widgets attached to catalog-scoped layout rows

**`_mhb_catalog_widget_overrides`** — NEW table for inherited-widget deltas only:
```sql
CREATE TABLE _mhb_catalog_widget_overrides (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    catalog_layout_id UUID NOT NULL,   -- FK → _mhb_layouts(id) ON DELETE CASCADE
    source_widget_id  UUID NOT NULL,   -- FK → _mhb_widgets(id) ON DELETE CASCADE
    zone              VARCHAR(20) NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 1,
    is_enabled        BOOLEAN NOT NULL DEFAULT true,
    -- standard lifecycle columns (_upl_*, _mhb_*)
    UNIQUE (catalog_layout_id, source_widget_id)
);
```

**Resolution algorithm** (at runtime and in editor):
1. Load the catalog layout row and its `base_layout_id`
2. Load base global layout widgets from `_mhb_widgets`
3. Load sparse inherited overrides from `_mhb_catalog_widget_overrides`
4. Apply per-widget `is_enabled`, `zone`, and `sort_order` overrides only where rows exist
5. Load catalog-owned widgets from `_mhb_widgets` for the catalog layout row
6. Merge inherited + owned widgets, then sort by zone + sort_order

**Benefits over fork model:**
- Global widget config changes auto-propagate to catalogs because inherited widgets still read config from the base widget row
- No blanket duplication of global widgets into per-catalog state
- Catalog-owned widgets reuse the same storage and editor semantics as existing layout widgets
- Publication/sync can flatten merged output into existing runtime tables without inventing a second runtime composition layer

### Inheritance Source Resolution

Catalog layout creation defaults `base_layout_id` to the current active default global layout:
```sql
SELECT * FROM _mhb_layouts
WHERE catalog_id IS NULL
  AND is_default = true
  AND is_active = true
  AND _upl_deleted = false
  AND _mhb_deleted = false
LIMIT 1
```
After creation, inheritance remains deterministic via `base_layout_id`; switching another global layout to default later does not silently rewrite existing catalog layouts.

---

## Plan Steps

### Phase 1: Shared Types & Utilities (Foundation)

#### Step 1.1 — Extend shared types in `@universo/types`
- [ ] Add `catalog_id: string | null` to `MetahubLayoutRow` interface
- [ ] Add `baseLayoutId: string | null` to `MetahubLayoutRow` interface
- [ ] Add `CatalogWidgetOverride` interface:
  ```typescript
  export interface CatalogWidgetOverride {
    id: string
    catalogLayoutId: string
    sourceWidgetId: string
    zone: DashboardLayoutZone
    sortOrder: number
    isEnabled: boolean
  }
  ```
- [ ] Add `CatalogLayoutBehaviorConfig` as a reused subset of the existing catalog runtime settings contract:
  ```typescript
  export type CatalogLayoutBehaviorConfig = Pick<
    CatalogRuntimeViewConfig,
    'showCreateButton' | 'searchMode' | 'createSurface' | 'editSurface' | 'copySurface'
  >
  ```
- [ ] Add `MergedZoneWidget` type for resolved widget list:
  ```typescript
  export interface MergedZoneWidget {
    widgetId: string               // source widget id (inherited) or owned widget id
    overrideId: string | null      // override row id (null for non-overridden inherited)
    zone: DashboardLayoutZone
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    isInherited: boolean           // UI hint: show "inherited" badge, restrict editing
    isOverridden: boolean          // UI hint: this inherited widget has custom sort/disabled
  }
  ```
- [ ] Add `CatalogLayoutSnapshot` to snapshot types:
  ```typescript
  export interface CatalogLayoutSnapshot {
    catalogId: string
    layout: MetahubLayoutSnapshot
    zoneWidgets: MetahubLayoutZoneWidgetSnapshot[]
    behaviorConfig: CatalogLayoutBehaviorConfig
  }
  ```
- [ ] Extend `MetahubSnapshotExtension` with optional `catalogLayouts?: CatalogLayoutSnapshot[]`

**Files:** `packages/universo-types/base/src/common/metahubs.ts`, `packages/universo-types/base/src/common/dashboardLayout.ts`

#### Step 1.2 — Overlay resolution helper in `@universo/utils`
- [ ] Add `resolveOverlayWidgets()`:
  ```typescript
  export function resolveOverlayWidgets(params: {
    globalWidgets: DashboardLayoutZoneWidget[]
    ownedWidgets: DashboardLayoutZoneWidget[]
    catalogOverrides: CatalogWidgetOverride[]
  }): MergedZoneWidget[] {
    // 1. Start with all global widgets
    // 2. Apply sparse is_enabled / zone / sort_order overrides only when present
    // 3. Add ownedWidgets from the catalog layout row
    // 4. Sort by zone + sort_order
    // 5. Return MergedZoneWidget[]
  }
  ```
- [ ] Add `resolveCatalogEffectiveLayout()`:
  ```typescript
  export function resolveCatalogEffectiveLayout(params: {
    catalogLayout: MetahubLayoutRow | null
    globalDefaultLayout: MetahubLayoutRow | null
    catalogRuntimeConfigFallback?: CatalogRuntimeViewConfig | null
    selectedCatalogLayoutBehaviorConfig?: CatalogLayoutBehaviorConfig
  }): { layoutConfig: DashboardLayoutConfig; layoutId: string | null; behaviorConfig: CatalogLayoutBehaviorConfig | null }
  ```
- [ ] Unit tests: sparse overrides merge correctly, non-overridden global widget config keeps following the base widget, disabled inherited widgets excluded, cross-zone moves respected, catalog-owned widgets included, catalog-layout behavior config reuses existing catalog runtime defaults/enums, and catalogs without a custom layout fall back to the catalog runtimeConfig behavior subset

**Files:** `packages/universo-utils/base/src/validation/catalogLayoutOverlay.ts` (new), tests alongside

---

### Phase 2: Backend Schema Update

> **Note (m1):** Since the test DB will be recreated, no platform migration needed. Update system table definitions directly.

#### Step 2.1 — Add `catalog_id` to `_mhb_layouts`
- [ ] Update `systemTableDefinitions.ts`:
  - Add `catalog_id UUID NULL` column to `_mhb_layouts`
  - Add `base_layout_id UUID NULL` column to `_mhb_layouts` (`NULL` for global layouts, required for catalog layouts)
  - Update `idx_mhb_layouts_default_active` unique index: add `AND catalog_id IS NULL` to WHERE clause
  - Add `idx_mhb_layouts_catalog_default` partial unique index: `UNIQUE (catalog_id) WHERE is_default = true AND catalog_id IS NOT NULL AND _upl_deleted = false AND _mhb_deleted = false`

#### Step 2.2 — Add `_mhb_catalog_widget_overrides` table
- [ ] Add new system table definition in `systemTableDefinitions.ts`:
  ```
  _mhb_catalog_widget_overrides:
    id: uuid PK
    catalog_layout_id: uuid NOT NULL → FK _mhb_layouts(id) ON DELETE CASCADE
    source_widget_id: uuid NOT NULL   → FK _mhb_widgets(id) ON DELETE CASCADE
    zone: varchar(20) NOT NULL
    sort_order: integer NOT NULL DEFAULT 1
    is_enabled: boolean NOT NULL DEFAULT true
    + _upl_* + _mhb_* lifecycle columns
  ```
  Indexes:
  - `(catalog_layout_id)`
  - `(catalog_layout_id, zone, sort_order)`
  - `UNIQUE (catalog_layout_id, source_widget_id) WHERE _upl_deleted = false AND _mhb_deleted = false` — one sparse override per inherited widget

#### Step 2.3 — Update SchemaGenerator for runtime tables
- [ ] Add `catalog_id UUID NULL` to `_app_layouts` in SchemaGenerator.ts
- [ ] Update partial unique indexes for app tables
- [ ] Keep runtime schema flattened: no `_app_catalog_widget_overrides` table

**Files:**
- `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`

---

### Phase 3: Backend Service Layer

#### Step 3.1 — Extend MetahubLayoutsService with catalog-scoped CRUD
- [ ] `listLayouts()` — add filter: `catalog_id IS NULL` for global list (preserve existing behavior)
- [ ] `listCatalogLayouts(metahubId, catalogId)` — list all layouts where `catalog_id = $1`
- [ ] `createCatalogLayout(metahubId, catalogId, input, userId)`:
  - Creates layout row with `catalog_id`
  - Sets `base_layout_id` to the selected global base layout (default = current active default global)
  - Initializes catalog-layout-level behavior config inside the catalog layout `config` JSONB by seeding from the catalog's current runtimeConfig behavior subset when present, otherwise from the existing catalog runtime defaults/enums (`showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`)
  - Does **not** pre-create override rows for all inherited widgets
  - Returns layout + merged widget list
- [ ] `getCatalogLayoutWithOverrides(metahubId, catalogId, layoutId)`:
  - Returns layout row, sparse override rows, and catalog-owned widgets from `_mhb_widgets`
  - Resolves merged widget list using base global widgets + sparse overrides + owned widgets
- [ ] Update existing `updateLayout`, `deleteLayout` to work with `catalog_id`-scoped layouts
- [ ] Add `listCatalogWidgetOverrides(catalogLayoutId)`
- [ ] Add `updateCatalogInheritedWidgetOverride(overrideId, input)` — update zone, sort_order, is_enabled for inherited widgets
- [ ] Add `ensureCatalogInheritedWidgetOverride(catalogLayoutId, sourceWidgetId, input)` — create sparse override row only when a global widget is moved/disabled
- [ ] Add `addCatalogOwnedWidget(catalogLayoutId, input)` — insert into existing `_mhb_widgets` for the catalog layout row
- [ ] Add `removeCatalogOwnedWidget(widgetId)` — soft-delete a catalog-owned widget row
- [ ] Add `moveCatalogWidget(catalogLayoutId, input)` — DnD reorder across inherited + owned widgets
- [ ] Add `resetCatalogLayout(metahubId, catalogId, layoutId)` — delete layout + all overrides, revert to global inheritance
- [ ] Ensure `listLayouts()` default behavior unchanged (catalog_id IS NULL filter)
- [ ] Transaction safety: all mutations in transactions with FOR UPDATE

**File:** `packages/metahubs-backend/base/src/domains/layouts/services/MetahubLayoutsService.ts`

#### Step 3.2 — Add catalog layout routes
- [ ] Routes scoped under `/metahub/:metahubId/catalog/:catalogId/layouts`:
  ```
  GET    .../catalog/:catalogId/layouts              → list catalog layouts
  POST   .../catalog/:catalogId/layouts              → create catalog layout
  GET    .../catalog/:catalogId/layouts/:layoutId     → get with merged widgets
  PATCH  .../catalog/:catalogId/layouts/:layoutId     → update (name, is_default, is_active)
  DELETE .../catalog/:catalogId/layouts/:layoutId     → soft-delete (reset to global)
  ```
- [ ] Widget override routes under the catalog layout:
  ```
  GET    .../catalog/:catalogId/layouts/:layoutId/widgets           → merged widget list
  POST   .../catalog/:catalogId/layouts/:layoutId/widgets           → add catalog-owned widget
  PATCH  .../catalog/:catalogId/layouts/:layoutId/widgets/:widgetId → update inherited override or owned widget depending on kind
  DELETE .../catalog/:catalogId/layouts/:layoutId/widgets/:widgetId → remove catalog-owned widget or clear inherited override
  POST   .../catalog/:catalogId/layouts/:layoutId/widgets/move      → DnD reorder
  ```
- [ ] Auth: `ensureMetahubAccess` with `manageMetahub` for mutations, membership for reads
- [ ] Input validation: Zod schemas with bind parameters for SQL

**File:** `packages/metahubs-backend/base/src/domains/layouts/routes/catalogLayoutRoutes.ts` (new)

#### Step 3.3 — Extend publication snapshot
- [ ] Update `attachLayoutsToSnapshot()` in `snapshotLayouts.ts`:
  - After global layouts: query `_mhb_layouts WHERE catalog_id IS NOT NULL`
  - For each catalog layout: resolve merged widgets from base global widgets + sparse overrides + owned widgets
  - Attach as `snapshot.catalogLayouts[]`
  - Each entry: `{ catalogId, layout, zoneWidgets[], behaviorConfig }`
- [ ] Update snapshot restore: if `catalogLayouts` present, recreate catalog layout rows, inherited overrides, and owned widgets with remapped IDs

**File:** `packages/metahubs-backend/base/src/domains/shared/snapshotLayouts.ts`

#### Step 3.4 — Backend tests
- [ ] Unit: createCatalogLayout stores `base_layout_id` and does not preseed inherited overrides
- [ ] Unit: getCatalogLayoutWithOverrides returns merged widget list
- [ ] Unit: creating one inherited override does not block auto-propagation for non-overridden global widgets
- [ ] Unit: addCatalogOwnedWidget inserts into `_mhb_widgets` under the catalog layout row
- [ ] Unit: removeCatalogOwnedWidget soft-deletes only the catalog-owned widget row
- [ ] Unit: moveCatalogWidget reorders mixed inherited+owned widgets across zones
- [ ] Unit: resetCatalogLayout removes layout + all overrides
- [ ] Unit: listLayouts (global) still excludes catalog layouts
- [ ] Unit: multiple catalog layouts with is_default/is_active constraints
- [ ] Route integration: full CRUD lifecycle
- [ ] Route integration: auth (403 for non-members)

**File:** `packages/metahubs-backend/base/src/tests/` (new test files)

---

### Phase 4: Application Runtime Sync

#### Step 4.1 — Sync catalog layouts to application schema
- [ ] Update `syncDataLoader.ts`:
  - After syncing global layouts to `_app_layouts`: sync `catalogLayouts` from snapshot
  - For each catalog layout: insert into `_app_layouts` with `catalog_id`
  - Persist the **materialized merged widgets** into the ordinary `_app_widgets` table for that catalog layout row
  - Map snapshot catalog entity IDs → runtime catalog object IDs

#### Step 4.2 — Runtime layout resolution per catalog
- [ ] Update runtime row/data controller:
  ```
  1. Load catalog-specific active default layout from _app_layouts WHERE catalog_id = $1
     AND is_default = true AND is_active = true
  2. If found → load its ordinary _app_widgets rows (already materialized during sync)
  3. If found → apply the selected catalog layout's behaviorConfig + layout config
  4. If NOT found → use global default layout + global widgets (existing behavior) and keep using the catalog's current runtimeConfig behavior subset for `showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`
  ```
- [ ] Keep runtimeRowsController close to the existing `_app_layouts` / `_app_widgets` contract; do not introduce a second runtime composition engine

#### Step 4.3 — Update DashboardApp runtime
- [ ] In `DashboardApp.tsx`/`Dashboard.tsx`: when `activeCatalogId` is set:
  - Request the already materialized layout/widgets for that catalog from backend
  - Display merged widget set per zone
  - Existing behavior (no catalog layout) continues to work unchanged

**Files:**
- `packages/applications-backend/base/src/routes/sync/syncDataLoader.ts`
- `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`
- `packages/apps-template-mui/src/standalone/DashboardApp.tsx`

---

### Phase 5: Frontend — "General" Tabbed Page + Navigation (fixes C1, M3, m2)

#### Step 5.1 — Update REAL menu in `menuConfigs.ts`
- [ ] In `getMetahubMenuItems()`:
  - **Insert** `metahub-general` immediately after the divider that follows Branches and before `metahub-hubs`:
    ```typescript
    {
      id: 'metahub-general',
      titleKey: 'menu:general_section',
      url: `/metahub/${metahubId}/general`,
      icon: IconAdjustments,
    }
    ```
  - Remove `metahub-layouts` from the later slot after `metahub-divider-secondary`
  - Resulting order: divider-after-branches → General → Hubs → Catalogs → Sets → Enumerations

**File:** `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

#### Step 5.2 — Update descriptive menu in `metahubDashboard.ts`
- [ ] Place `general` item above `hubs` and remove standalone `layouts` item
  - This syncs the descriptive definition even though it's not rendered
  - Remove any 'collapse' approach — keep flat like all other menu items

**File:** `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`

#### Step 5.3 — Create `GeneralPage.tsx` (SettingsPage pattern)
- [ ] New component following exact SettingsPage structure:
  ```typescript
  const GENERAL_TABS = ['layouts'] as const  // extensible later: 'appearance', 'navigation'
  type GeneralTab = (typeof GENERAL_TABS)[number]

  const GeneralPage = () => {
    const [activeTab, setActiveTab] = useState<GeneralTab>('layouts')
    return (
      <MainCard disableHeader border={false} shadow={false}
                contentSX={{ px: 0, py: 0 }} disableContentPadding>
        <ViewHeader title={t('general.title')} />
        <Box sx={PAGE_TAB_BAR_SX}>
          <Tabs value={activeTab} onChange={handleTabChange}
                variant='scrollable' scrollButtons='auto'>
            {GENERAL_TABS.map(tab => (
              <Tab key={tab} label={t(`general.tabs.${tab}`)} value={tab} />
            ))}
          </Tabs>
        </Box>
        <Box sx={{ py: 0, mx: PAGE_CONTENT_GUTTER_MX }}>
          {activeTab === 'layouts' && <LayoutsListContent />}
        </Box>
      </MainCard>
    )
  }
  ```
- [ ] Extract `LayoutsListContent` from `LayoutList.tsx` so the existing list UI is reused without nesting page shells/MainCard containers
- [ ] Import `PAGE_TAB_BAR_SX`, `PAGE_CONTENT_GUTTER_MX` from `@universo/template-mui`

**File:** `packages/metahubs-frontend/base/src/domains/general/ui/GeneralPage.tsx` (new)

#### Step 5.4 — Add route in MainRoutes.tsx
- [ ] Add `general` route:
  ```typescript
  { path: 'general', element: <MetahubGeneral /> }
  ```
- [ ] Keep existing `layouts` and `layouts/:layoutId` routes (for deep linking / editing detail)
- [ ] Lazy import: `const MetahubGeneral = Loadable(lazy(() => import('...')))` (follow existing pattern)

**File:** `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`

#### Step 5.5 — i18n keys
- [ ] Add keys for EN and RU:
  ```
  menu:general_section = "General" / "Общие"
  general.title = "General" / "Общие"
  general.tabs.layouts = "Layouts" / "Макеты"
  ```

**Files:** metahubs-frontend i18n `en/` and `ru/` locale files

---

### Phase 6: Frontend — Catalog Layout Overlay Editor

#### Step 6.1 — Catalog layout list in CatalogActions
- [ ] Extend the existing "Layout" tab in `CatalogActions.tsx`:
  - Replace the current `CatalogLayoutTabFields` source-of-truth with catalog layout management
  - Reuse extracted list/controller primitives from `LayoutList.tsx` in a compact host surface; do not build a separate mini-list component family
  - Button: "Create Catalog Layout" → creates layout from active default global
  - Each layout: name, is_default badge, active/inactive toggle, edit/delete actions
  - If no catalog layouts exist: show "Inheriting from global layout: [layout name]"
  - If no catalog layouts exist: explain that runtime behavior still follows the catalog's current settings until the first catalog layout is created
  - The selected catalog layout edits the existing catalog runtime behavior options that are not covered by dashboard layout config: `showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`

#### Step 6.2 — Catalog Layout Detail (overlay editor)
- [ ] Create `CatalogLayoutDetails.tsx` by extracting a reusable editor canvas from `LayoutDetails.tsx`, then layering catalog-specific rules on top:
  - **Inherited widgets** (from global): shown with "inherited" badge/icon, read-only config
    - Can: toggle is_active (enable/disable), drag to reorder, move across zones
    - Cannot: edit widget config or delete the source widget
  - **Catalog-owned widgets**: fully editable (same as current LayoutDetails)
    - Can: edit config, toggle active, reorder, delete, change zone
  - **Add widget button**: creates a catalog-owned widget row in the existing `_mhb_widgets` table for the catalog layout
  - **DnD**: all widgets (inherited + owned) participate in sort ordering
  - Reuses: extracted editor-canvas pieces from `LayoutDetails.tsx`, `SortableWidgetChip` (extend with `isInherited` prop for badge/disabled actions), `LayoutZoneColumn`, widget editor dialogs
  - Catalog layout detail page also edits the selected catalog layout's behavior config (`showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`) using the existing catalog runtime enums/labels where possible
  - API calls: `PATCH .../widgets/:widgetId` for sort/active, `POST .../widgets/move` for DnD

#### Step 6.3 — Catalog layout route
- [ ] Add route: `catalog/:catalogId/layout/:layoutId` → CatalogLayoutDetails
- [ ] Navigation from CatalogActions "Layout" tab → click layout → navigate to detail route

**Files:**
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx` (extend Layout tab)
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogLayoutDetails.tsx` (new)
- `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx` (add route)

---

### Phase 7: Surface Type (Dialog/Page) Verification (fixes M1)

#### Step 7.1 — Playwright E2E: verify surface type
- [ ] Create Playwright test:
  1. Create metahub + catalog with attributes
  2. Create a catalog layout and set `createSurface = 'page'`, `editSurface = 'page'`, `copySurface = 'page'`
  3. Publish metahub → create application
  4. Open application runtime
  5. **Assert**: create button opens a full page (PageContainer), not dialog
  6. **Assert**: edit action opens a full page, not dialog
  7. **Assert**: copy action opens a full page, not dialog

#### Step 7.2 — Fix if page mode doesn't work
- [ ] If DashboardApp.tsx hardcodes `surface="dialog"`:
  - Fix to read the selected catalog layout behavior config `createSurface` / `editSurface` / `copySurface`
  - Pass resolved surface type to FormDialog
- [ ] FormDialog.tsx already supports `surface === 'page'` via PageContainer — just needs correct prop passing
- [ ] ApplicationRuntime.tsx URL-based page mode should work — verify the full chain

**Files:**
- `tools/testing/e2e/specs/` (new test)
- `packages/apps-template-mui/src/standalone/DashboardApp.tsx` (fix if needed)

---

### Phase 8: Comprehensive E2E Test (fixes m4)

#### Step 8.1 — Single integrated Playwright test following spec path
- [ ] One test file, one flow:
  ```
  1. Create metahub
  2. Configure global layout (General → Layouts tab → edit default layout → add/configure widgets)
  3. Create 2-3 catalogs with attributes
  4. For ONE catalog: create catalog layout → disable some global widgets → add catalog-specific widgets → reorder
  5. Publish metahub
  6. Create application from publication
  7. Open application runtime
  8. VERIFY: catalogs WITHOUT custom layout show global layout widgets
  9. VERIFY: catalog WITH custom layout shows customized widget set (disabled globals hidden, catalog widgets present, custom order)
  10. VERIFY: create/edit/copy surface type page mode works correctly
  ```

- [ ] Reuse the existing backend helpers from `tools/testing/e2e/support/backend/api-session.mjs` and extend selector contracts in `tools/testing/e2e/support/selectors/contracts.ts` instead of relying on ad hoc locators

**File:** `tools/testing/e2e/specs/metahub-general-catalog-layouts.spec.ts` (new)

---

### Phase 9: Documentation

#### Step 9.1 — GitBook pages (EN + RU)
- [ ] New page: "General Section" — navigating to General, Layouts tab
- [ ] New page: "Catalog Layouts" — overlay model, creating catalog layout, editing widgets, inheritance
- [ ] Update existing "Layouts" page with reference to General section
- [ ] Update SUMMARY.md for both locales

**Files:** `docs/en/guides/`, `docs/ru/guides/`, `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md`

---

### Phase 10: Validation & Memory Bank

#### Step 10.1 — Full project build
- [ ] `pnpm build` — must pass with 0 errors

#### Step 10.2 — Run all tests
- [ ] Focused package tests (metahubs-backend, metahubs-frontend, apps-template-mui)
- [ ] E2E Playwright comprehensive test

#### Step 10.3 — Update memory-bank
- [ ] `tasks.md` — mark all steps completed
- [ ] `activeContext.md` — update to reflect completed feature
- [ ] `progress.md` — add entry for General section + catalog layouts
- [ ] `systemPatterns.md` — document overlay/inheritance model

---

## Implementation Order

```
Phase 1 (types/utils)  ──→ Phase 2 (schema update) ──→ Phase 3 (backend service/routes)
                                                               │
Phase 5 (GeneralPage + navigation)  ←── can start in parallel ─┘
                                                               │
                         Phase 4 (runtime sync) ←──────────────┘
                                    │
                         Phase 6 (catalog overlay editor UI)
                                    │
                         Phase 7 (surface type verification)
                                    │
                         Phase 8 (comprehensive E2E)
                                    │
                         Phase 9 (docs) → Phase 10 (validation)
```

**Dependency notes:**
- Phases 1 + 2 can start in parallel
- Phase 3 depends on Phases 1 + 2
- Phase 5 is independent (UI/navigation only), can start any time
- Phase 4 depends on Phase 3 (backend APIs)
- Phase 6 depends on Phases 3 + 5 (backend APIs + navigation)
- Phase 7 can start independently (diagnostics + fix)
- Phase 8 depends on Phases 4 + 6 + 7 (full integration)
- Phases 9 + 10 are final gates

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Tabbed page (SettingsPage pattern), NOT collapse group | Real sidebar (MenuContent.tsx) doesn't support collapse; spec says "interface same as other sections, tabs right away" |
| General menu item goes above Hubs | The spec explicitly requires the item immediately below the divider after Branches and above Hubs |
| Overlay/inheritance, NOT fork | Spec requires: inherited widgets read-only + disable + catalog widgets + mixed sort. Fork loses link to global. |
| Sparse inherited overrides + existing `_mhb_widgets` for owned widgets | Preserves automatic inheritance for non-overridden global widget config while reusing the existing widget storage/editor model |
| Multiple layouts per catalog | Spec explicitly requires is_default + is_active per catalog scope |
| No platform migration | Spec says "DB will be recreated" — simplify by updating systemTableDefinitions directly |
| Catalog layout owns the non-dashboard catalog runtime behavior settings | Multiple catalog layouts need deterministic `showCreateButton`, `searchMode`, and create/edit/copy behavior tied to the selected layout, while dashboard presentation stays in the existing layout config/widget model |
| No-layout fallback stays explicit | Catalogs without a custom layout should continue to behave predictably by falling back to their existing catalog runtimeConfig behavior subset until the first catalog layout is created |
| Flatten overlay during publication/sync | Keeps the runtime contract aligned with the current `_app_layouts` / `_app_widgets` pipeline instead of adding a second runtime composition layer |
| Update BOTH menu systems | menuConfigs.ts (real renderer) + metahubDashboard.ts (descriptive) to avoid drift |
| Surface type as separate verification phase | Existing code MAY work, needs Playwright validation first before writing fix code |
| Single comprehensive E2E | Spec describes one flow from metahub creation to application runtime verification |

---

## Potential Challenges

1. **Overlay resolution complexity in design-time**: Catalog layouts need base widgets + sparse overrides + owned widgets. Mitigate: keep the overlay engine in metahub design-time only, then flatten during snapshot/sync so runtime stays simple.

2. **DnD complexity in overlay editor**: Inherited widgets have restricted editing but still need cross-zone moves. Mitigate: reuse extracted editor-canvas primitives from `LayoutDetails.tsx` and gate only config/delete actions on inherited rows.

3. **Base-layout drift**: Existing catalog layouts should not silently change if another global layout later becomes default. Mitigate: store explicit `base_layout_id` on each catalog layout and add future rebase capability only when needed.

4. **Snapshot size**: Each catalog layout adds a flattened merged widget set to the snapshot. For typical metahubs (4-5 catalogs), this is still bounded and simpler than runtime overlay resolution.

5. **Page mode (surface type)**: May need fix in DashboardApp.tsx if `surface` prop is hardcoded. FormDialog.tsx and ApplicationRuntime.tsx already support page mode.

6. **Behavior source-of-truth transition**: Runtime behavior settings currently live on the catalog object. Mitigate: seed the first catalog layout from the existing catalog runtimeConfig subset, then resolve runtime behavior as `selected catalog layout behaviorConfig ?? catalog runtimeConfig subset` so catalogs without a custom layout remain stable.
