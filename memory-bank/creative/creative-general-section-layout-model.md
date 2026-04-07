# Creative Design: Metahub "General" Section + Catalog Layout Model

> **Created**: 2026-04-06
> **Status**: Design complete, ready for implementation review
> **Scope**: Navigation restructuring (General section), catalog-specific layout model, route/i18n architecture

---

## Table of Contents

1. [Design Topic 1: "General" Section Navigation](#design-topic-1-general-section-navigation)
2. [Design Topic 2: Catalog Layout Model](#design-topic-2-catalog-layout-model)
3. [Design Topic 3: i18n Key Structure](#design-topic-3-i18n-key-structure)
4. [Design Topic 4: Security & Access Control](#design-topic-4-security--access-control)
5. [Summary of Decisions](#summary-of-decisions)

---

## Design Topic 1: "General" Section Navigation

### Objectives

- Create a grouped "General" (Общие) section in the metahub sidebar between the secondary divider and current standalone items
- Move "Layouts" from a standalone menu item into the General section
- Add extensibility for future pages: Appearance, Navigation/Menus
- Maintain backward compatibility with existing routes/bookmarks

### Current State

```
metahubboard
branches
──── divider-primary ────
hubs, catalogs, sets, enumerations
──── divider-secondary ────
layouts            ← standalone
publications
migrations
access
──── divider-footer ────
settings
```

Routes in `MainRoutes.tsx` are flat children of `metahub/:metahubId/`:
- `layouts` → `<MetahubLayouts />`
- `layouts/:layoutId` → `<MetahubLayoutDetails />`
- `settings` → `<MetahubSettings />`

Menu items defined in `metahubDashboard.ts` are flat `MenuItem[]` with `type: 'item' | 'divider'`.

### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Collapse Group | Add `type: 'collapse'` menu item "General" with children (Layouts, Appearance, Navigation) | **Selected** |
| B. Nested Route Outlet | Add `/general` parent route with `<Outlet/>`, sub-routes `/general/layouts`, `/general/appearance` | Rejected — breaks existing `/layouts` bookmarks, adds unnecessary nesting |
| C. Tabbed General Page | Single `/general` page with tabs (similar to Settings) | Rejected — Layouts is already a full CRUD page with its own sub-routes, tabs would be too constraining |
| D. Visual Grouping Only | Keep flat items but add a visual label/divider "General" above them | Rejected — no extension point for future pages, not a real group |

### Decision: Collapse Group (Option A)

**Rationale:**
- The `MenuItem` interface already supports `type: 'collapse'` with `children` — the sidebar renderer can handle this without changes
- Routes stay flat under `metahub/:metahubId/` — no URL breaking changes
- The collapse group provides a clean extension point for adding Appearance, Navigation pages later
- Layouts route (`/layouts`, `/layouts/:layoutId`) remains unchanged — zero bookmark breakage

### Proposed Navigation Structure

```
metahubboard
branches
──── divider-primary ────
hubs, catalogs, sets, enumerations
──── divider-secondary ────
▼ General (Общие)              ← NEW collapse group
    Layouts (Макеты)           ← moved here
    Appearance (Оформление)    ← future placeholder (Phase 2)
    Navigation (Навигация)     ← future placeholder (Phase 3)
publications
migrations
access
──── divider-footer ────
settings
```

### Implementation Blueprint: metahubDashboard.ts

```ts
// Replace standalone 'layouts' item with collapse group
{
    id: 'general',
    title: 'menu:general_section',  // "General" / "Общие"
    type: 'collapse',
    icon: icons.IconAdjustments,    // new icon import
    children: [
        {
            id: 'layouts',
            title: 'menu:layouts',
            type: 'item',
            url: '/layouts',
            icon: icons.IconLayoutDashboard,
            breadcrumbs: true
        }
        // Phase 2: appearance
        // Phase 3: navigation
    ]
}
```

### Route Structure (MainRoutes.tsx)

No changes needed. Routes remain flat:

```
metahub/:metahubId/layouts          → MetahubLayouts
metahub/:metahubId/layouts/:layoutId → MetahubLayoutDetails
```

Future pages will add flat routes:
```
metahub/:metahubId/appearance       → MetahubAppearance (Phase 2)
metahub/:metahubId/navigation       → MetahubNavigation (Phase 3)
```

### Phase 2: Appearance Page (Future)

Potential scope for an "Appearance" page:
- Theme selection (light/dark/custom)
- Logo/brand image configuration
- Primary/secondary color palette
- Typography presets
- These are currently not stored anywhere — would need new settings keys in `METAHUB_SETTINGS_REGISTRY` under a `general.appearance.*` tab or a dedicated `appearance` tab

### Phase 3: Navigation Page (Future)

Potential scope:
- Custom menu item ordering for runtime applications
- Menu item visibility toggles
- Custom external link menu items
- This overlaps with dashboard layout left-zone `menuWidget` configuration — design needs careful deduplication

---

## Design Topic 2: Catalog Layout Model

### Objectives

- Let different catalogs present differently at runtime (different widget compositions, zone visibility)
- Maintain backward compatibility with the existing global layouts + catalog `runtimeConfig` overlay
- Keep the publication/sync flow safe and predictable
- Minimize schema complexity while maximizing customization

### Current State

**Global Layout Model:**
- `_mhb_layouts` table: id, template_key, name(JSONB VLC), config(JSONB), is_active, is_default
- `_mhb_widgets` table: layout_id(FK), zone, widget_key, sort_order, config(JSONB), is_active
- 27 widget definitions across 5 zones
- ONE default layout per metahub (UNIQUE partial index on `is_default = true`)
- Layouts are metahub-global — all catalogs share the same runtime dashboard

**Catalog Runtime Config Overlay:**
- Stored in `_mhb_objects.config.runtimeConfig` for each catalog
- Fields: `useLayoutOverrides`, `showSearch`, `searchMode`, `showCreateButton`, `showViewToggle`, `defaultViewMode`, `cardColumns`, `rowHeight`, `enableRowReordering`, `reorderPersistenceField`, `createSurface`, `editSurface`, `copySurface`
- No FK to layouts — pure value overlay
- `resolveCatalogRuntimeDashboardLayoutConfig()` merges layout.config with catalog overrides at runtime

**Publication Flow:**
1. `attachLayoutsToSnapshot()` → reads `_mhb_layouts` + `_mhb_widgets` → writes to snapshot
2. Sync writes to `_app_layouts` + `_app_widgets` in app schema
3. Runtime reads default/active layout, resolves zone widgets, merges catalog overlay

### Key Design Question

> Should a catalog have one effective layout with overlay settings (current model enhanced), or should each catalog support its own full layout with zone-widget composition (new model)?

### Options Analysis

---

#### Option A: Enhanced Overlay Model

**Description**: Keep current architecture. Extend `CatalogRuntimeViewConfig` with more overlay fields (per-zone visibility toggles, per-widget enable/disable flags).

**Schema Changes**: None (extend existing JSONB config only)

**Example Extended Config:**
```ts
interface CatalogRuntimeViewConfig {
    // existing fields...
    useLayoutOverrides: boolean
    showSearch: boolean
    // ...

    // NEW overlay fields
    zoneVisibility?: {
        left?: boolean
        top?: boolean
        center?: boolean
        right?: boolean
        bottom?: boolean
    }
    widgetOverrides?: Record<string, {  // keyed by widgetKey or widgetId
        isActive?: boolean
        config?: Record<string, unknown>
    }>
}
```

**Publication Flow**: Unchanged — overlay travels with catalog config in snapshot.

| Criterion | Assessment |
|-----------|------------|
| Schema complexity | ★★★★★ Minimal — no new tables |
| Customization depth | ★★☆☆☆ Limited — can toggle widgets but not add/reorder/rezone |
| Backward compatibility | ★★★★★ Perfect — old configs still work |
| Snapshot safety | ★★★★★ Unchanged flow |
| Widget composition | ❌ Cannot add catalog-specific widgets or change zone assignment |
| UX complexity | ★★★★☆ Simple — extends existing catalog edit dialog |

**Pros:**
- Zero migration risk
- Trivial to implement — just extend the overlay type and merge function
- No new tables, no new sync logic
- Backward compatible by default

**Cons:**
- Fundamentally limited: catalogs cannot have their own widget composition
- Cannot rearrange widget order per catalog
- Cannot add catalog-specific widgets (e.g., a custom script widget only for Product catalog)
- Widget overrides by key are ambiguous for `multiInstance` widgets
- Will need redesigning later if full customization is ever needed

---

#### Option B: Catalog-Specific Layout References

**Description**: Add a `layout_id` FK to catalog config. Each catalog references a specific global layout. Different catalogs can use different global layouts.

**Schema Changes:**
- Add `layout_id UUID REFERENCES _mhb_layouts(id)` to catalog config (or as a dedicated column in `_mhb_objects`)
- Or store `layoutId` in `_mhb_objects.config.runtimeConfig.layoutId`

**Publication Flow**: Must resolve the referenced layout during snapshot. If catalog.layoutId doesn't match the default layout, snapshot needs to carry multiple layouts or resolve at sync time.

| Criterion | Assessment |
|-----------|------------|
| Schema complexity | ★★★★☆ Minor — one FK/field |
| Customization depth | ★★★☆☆ Can use different global layouts but cannot customize per catalog |
| Backward compatibility | ★★★★☆ Null layoutId = use default (backward compatible) |
| Snapshot safety | ★★★☆☆ Must ensure referenced layouts are included in snapshot |
| Widget composition | ⚠️ Indirect — must create multiple global layouts to differentiate |
| UX complexity | ★★★★☆ Simple dropdown in catalog dialog |

**Pros:**
- Simple mental model: catalog picks from a menu of layouts
- Encourages creating named layout templates
- Small schema change, leverages existing layout editor

**Cons:**
- Proliferation of global layouts ("Products Layout", "Orders Layout", "FAQ Layout"...) when each catalog needs minor tweaks
- No per-catalog widget customization — just layout selection
- Layout count management becomes a concern
- Still no way to have a catalog-specific widget that doesn't appear in other catalogs using the same layout

---

#### Option C: Catalog-Owned Layouts (Fork on Create)

**Description**: Each catalog can optionally own its own layout, forked from a global template. Add `catalog_id` column to `_mhb_layouts` (NULL = global/metahub, UUID = catalog-specific). Catalog-specific layouts inherit the global defaults but can be edited independently.

**Schema Changes:**
- Add `catalog_id UUID NULL` column to `_mhb_layouts` (NULLable, default NULL)
- Add `catalog_id UUID NULL` column to `_mhb_widgets` (denormalized for query speed, or derive through FK)
- Add partial unique index: `UNIQUE (catalog_id, is_default) WHERE is_default = true AND catalog_id IS NOT NULL`
- Keep existing global layout constraint: `UNIQUE (is_default) WHERE is_default = true AND catalog_id IS NULL`

**Fork Logic:**
1. Catalog starts with no owned layout (inherits global default)
2. User clicks "Customize Layout" → system forks the global default into a new layout with `catalog_id = <catalogId>`
3. Forked layout + all zone widgets are copied, with new UUIDs
4. Catalog-specific layout is fully editable with the existing layout editor
5. User can "Reset to Global" → delete catalog-specific layout, revert to inheritance

**Publication Flow:**
- `attachLayoutsToSnapshot()` extended: for each catalog in snapshot, if it has a catalog-specific layout, attach that alongside the global layout
- Sync writes catalog-specific layouts to `_app_layouts` with a `catalog_id` association
- Runtime resolves: catalog-specific layout → catalog overlay → global default (3-level fallback)

| Criterion | Assessment |
|-----------|------------|
| Schema complexity | ★★★☆☆ Two new columns, new indexes |
| Customization depth | ★★★★★ Full — same layout editor, full widget composition per catalog |
| Backward compatibility | ★★★★☆ NULL catalog_id = existing global layouts unchanged |
| Snapshot safety | ★★★☆☆ More data in snapshot, must handle catalog-layout FK resolution |
| Widget composition | ✅ Full per-catalog widget management |
| UX complexity | ★★★☆☆ "Fork/Reset" concept needs clear UX |

**Pros:**
- Maximum customization: each catalog can have completely different zone widgets
- Reuses the existing layout editor — no new UI paradigm
- Clean inheritance model: inherit global → fork when customizing → reset to global
- No proliferation of global layouts for per-catalog tweaks
- Existing global layouts work unchanged

**Cons:**
- Fork creates data duplication (full widget set copied per catalog)
- For a metahub with 20 catalogs and custom layouts, that's 20 × 27 widget rows
- Catalog-specific layout edits don't automatically inherit global layout changes after forking
- Publication snapshot grows with each catalog's custom layout
- Need a "re-sync from global" or "merge changes" mechanism for when global layout evolves

---

#### Option D: Hybrid — Global Templates + Catalog Override Layer

**Description**: Global layouts serve as templates. Catalogs store a lightweight override layer (widget visibility, config overrides, zone reorder) without duplicating the full widget set.

**Schema Changes:**
- New table: `_mhb_catalog_layout_overrides`
  ```sql
  CREATE TABLE _mhb_catalog_layout_overrides (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_id  UUID NOT NULL,          -- FK to _mhb_objects(id)
      layout_id   UUID NOT NULL,          -- FK to _mhb_layouts(id)
      zone        TEXT NOT NULL,           -- zone name
      widget_id   UUID NULL,              -- FK to _mhb_widgets(id), NULL = zone-level override
      override_type TEXT NOT NULL,         -- 'visibility' | 'config' | 'sort_order'
      override_value JSONB NOT NULL,
      -- system fields
      _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      _mhb_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
      _upl_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (catalog_id, layout_id, zone, widget_id, override_type)
  );
  ```

**Override Resolution:**
1. Load global layout + zone widgets (existing)
2. Load catalog override rows for the catalog + layout pair
3. Apply overrides: toggle widget visibility, merge config, adjust sort order
4. Apply existing `runtimeConfig` overlay on top

**Publication Flow:**
- `attachLayoutsToSnapshot()` extended: include catalog override rows in snapshot
- Sync writes override rows to `_app_catalog_layout_overrides` in app schema
- Runtime resolution adds override merge step between layout widgets and catalog runtimeConfig

| Criterion | Assessment |
|-----------|------------|
| Schema complexity | ★★☆☆☆ New table with complex structure |
| Customization depth | ★★★★☆ Good — can toggle/reorder/configure widgets per catalog |
| Backward compatibility | ★★★★★ No overrides = existing behavior |
| Snapshot safety | ★★★☆☆ New data in snapshot, moderate complexity |
| Widget composition | ⚠️ Can toggle/config but cannot truly add new widgets per catalog |
| UX complexity | ★★☆☆☆ Complex — override concept is hard to visualize |

**Pros:**
- No data duplication — only differences are stored
- Catalog overrides automatically reflect global layout changes for non-overridden aspects
- Granular control (per-widget, per-zone)

**Cons:**
- Complex resolution logic — 4-level merge (global layout → zone widgets → catalog overrides → runtimeConfig overlay)
- New table with multi-column unique constraint
- Cannot add entirely new widgets per catalog (only override existing ones)
- Override management UI is conceptually harder than a full layout editor
- Testing the 4-level merge is significantly more complex
- The `override_type` + `override_value` pattern is a generic EAV which is harder to validate and query

---

### Evaluation Matrix

| Criterion | Weight | A: Enhanced Overlay | B: Layout Ref | C: Catalog-Owned | D: Hybrid Override |
|-----------|--------|:------------------:|:-------------:|:-----------------:|:------------------:|
| Schema simplicity | 20% | 5 | 4 | 3 | 2 |
| Customization depth | 25% | 2 | 3 | 5 | 4 |
| Backward compat | 15% | 5 | 4 | 4 | 5 |
| Snapshot safety | 15% | 5 | 3 | 3 | 3 |
| UX clarity | 15% | 4 | 4 | 3 | 2 |
| Extensibility | 10% | 1 | 2 | 5 | 4 |
| **Weighted Score** | | **3.45** | **3.35** | **3.85** | **3.20** |

### Decision: Option C — Catalog-Owned Layouts (Fork on Create)

**Rationale:**

1. **Maximum customization with familiar UX**: The layout editor already exists and works well. Reusing it for catalog-specific layouts means no new UI paradigm — the designer just thinks "this catalog gets a custom layout."

2. **Clean inheritance model**: The fork-on-demand pattern is a well-understood paradigm (similar to template/instance in many CMS systems). Start with global defaults, fork only when you need to customize, reset when you want to re-inherit.

3. **Future-proof**: Adding new widgets per catalog, completely reorganizing zones, or building catalog-specific dashboard experiences — all possible without schema changes later.

4. **Data duplication is bounded**: A metahub typically has 5-15 catalogs, and only a subset needs custom layouts. 27 widget rows × 5 custom catalogs = 135 rows — negligible overhead.

5. **Publication flow extension is natural**: Just attach additional catalog-specific layouts alongside the global ones. The sync engine already handles layout upserts.

**Risk mitigation for cons:**
- Fork divergence: Add a "Compare with Global" or "Re-fork from Global" action that shows what has changed relative to the current global layout and allows selective re-sync
- Snapshot size: Catalog-specific layouts are only included in snapshot if they exist; most catalogs will inherit the global layout
- Widget duplication: Consider lazy forking — only fork when a catalog actually modifies a widget, not preemptively. But full fork is simpler for V1.

### Implementation Blueprint

#### Schema Changes

```sql
-- Add catalog scope to layouts
ALTER TABLE _mhb_layouts ADD COLUMN catalog_id UUID NULL;

-- Partial unique index: one default per catalog-specific scope
CREATE UNIQUE INDEX idx_mhb_layouts_catalog_default
ON _mhb_layouts (catalog_id)
WHERE is_default = true AND catalog_id IS NOT NULL
  AND _upl_deleted = false AND _mhb_deleted = false;

-- Existing global default index remains:
-- UNIQUE (is_default) WHERE is_default = true AND catalog_id IS NULL AND _upl_deleted = false AND _mhb_deleted = false
```

#### Service API (MetahubLayoutsService)

```ts
// New methods
async forkLayoutForCatalog(params: {
    metahubId: string
    catalogId: string
    sourceLayoutId: string  // global layout to fork from
    userId: string
}): Promise<MetahubLayoutRow>

async removeCatalogLayout(params: {
    metahubId: string
    catalogId: string
    layoutId: string
    userId: string
}): Promise<void>

async getCatalogLayout(params: {
    metahubId: string
    catalogId: string
}): Promise<MetahubLayoutRow | null>
```

#### Backend Routes

```
POST   /metahub/:metahubId/catalog/:catalogId/layout/fork
DELETE /metahub/:metahubId/catalog/:catalogId/layout/:layoutId
GET    /metahub/:metahubId/catalog/:catalogId/layout
```

Existing layout CRUD routes work for catalog-specific layouts — the `layoutId` is sufficient to identify them. Only "fork" and "get catalog's layout" need catalog-scoped routes.

#### Publication Snapshot Extension

```ts
interface MetahubSnapshot {
    // existing
    layouts: SnapshotLayout[]
    defaultLayoutId: string | null
    layoutConfig: Record<string, unknown>
    zoneWidgets: SnapshotZoneWidget[]

    // NEW: catalog-specific layouts
    catalogLayouts?: Array<{
        catalogId: string
        layout: SnapshotLayout
        zoneWidgets: SnapshotZoneWidget[]
    }>
}
```

#### Runtime Resolution (3-level)

```
1. Does catalog have a catalog-specific layout in _app_layouts?
   YES → use catalog-specific layout + its zone widgets
   NO  → use default global layout + global zone widgets

2. Apply catalog runtimeConfig overlay (existing useLayoutOverrides logic)

3. Return merged DashboardLayoutConfig
```

#### Catalog runtimeConfig Preserved

The existing `CatalogRuntimeViewConfig` with `useLayoutOverrides`, `showSearch`, etc. continues to work. It remains the lightest way for catalog authors to tweak presentation without touching the layout editor. The merge order is:

```
catalog-specific layout (or global layout) → runtimeConfig overlay → final config
```

#### sync/runtime Tables

```sql
-- App schema additions (during sync)
ALTER TABLE _app_layouts ADD COLUMN catalog_id UUID NULL;

CREATE UNIQUE INDEX idx_app_layouts_catalog_default
ON _app_layouts (catalog_id)
WHERE is_default = true AND catalog_id IS NOT NULL;
```

---

## Design Topic 3: i18n Key Structure

### Objectives

- Define i18n keys for the new General section and future sub-pages
- Follow existing patterns (dot notation, `menu:` prefix for nav items)
- Support EN and RU locales

### Proposed Keys

#### Navigation (menu namespace)

| Key | EN | RU |
|-----|----|----|
| `menu:general_section` | General | Общие |
| `menu:layouts` | Layouts | Макеты |
| `menu:appearance` | Appearance | Оформление |
| `menu:navigation` | Navigation | Навигация |

#### Page Content (metahubs namespace)

| Key | EN | RU |
|-----|----|----|
| `metahubs:general_section.title` | General | Общие |
| `metahubs:general_section.description` | General metahub configuration | Общая конфигурация метахаба |
| `metahubs:catalog_layout.title` | Catalog Layout | Макет каталога |
| `metahubs:catalog_layout.fork_action` | Customize Layout | Настроить макет |
| `metahubs:catalog_layout.reset_action` | Reset to Default | Сбросить к стандартному |
| `metahubs:catalog_layout.fork_confirm` | Create a custom layout for this catalog based on the current default layout? | Создать пользовательский макет для этого каталога на основе текущего стандартного макета? |
| `metahubs:catalog_layout.reset_confirm` | Remove the custom layout and revert to the default layout? | Удалить пользовательский макет и вернуться к стандартному макету? |
| `metahubs:catalog_layout.using_custom` | This catalog uses a custom layout | Этот каталог использует пользовательский макет |
| `metahubs:catalog_layout.using_default` | This catalog inherits the default layout | Этот каталог наследует стандартный макет |

#### Breadcrumb keys

| Key | EN | RU |
|-----|----|----|
| `metahubs:breadcrumb.general` | General | Общие |

---

## Design Topic 4: Security & Access Control

### Requirements

- Catalog layout forking/editing should follow the same permission model as layout editing
- Layout editing is already a metahub management action (requires `manageMetahub` or editor role)
- Catalog-specific layouts should not introduce a new permission surface

### Design

1. **Fork layout for catalog**: Requires `manageMetahub` permission (same as creating/editing global layouts). Only metahub editors/managers can customize catalog presentations.

2. **View catalog layout**: Requires metahub membership (same as viewing global layouts). Any member can see what layout a catalog uses.

3. **Delete catalog layout (reset)**: Requires `manageMetahub` permission (destructive action similar to deleting a global layout).

4. **Publication access**: Catalog-specific layouts are included in the published snapshot and inherit the same application-level access control. No additional runtime permission surface needed.

5. **RLS**: Catalog-specific layout rows in `_mhb_layouts` inherit the same branch schema RLS as all other `_mhb_*` tables — no additional RLS policy needed.

### No New Permission Subjects

The existing `manageMetahub` / metahub membership permissions cover the full surface. We do NOT introduce:
- ~~`manageCatalogLayouts`~~ — unnecessary granularity
- ~~per-catalog layout ownership~~ — layout forking is a management action, not a content-authoring action

---

## Summary of Decisions

### Decision 1: General Section Navigation → **Collapse Group (Option A)**

- Add `type: 'collapse'` group item with id `general` to `metahubDashboard.ts`
- Move Layouts inside as the first child
- Routes remain flat under `metahub/:metahubId/` — no URL changes
- Future pages (Appearance, Navigation) add as additional children + flat routes
- Icon: `IconAdjustments` (from @tabler/icons-react)

### Decision 2: Catalog Layout Model → **Catalog-Owned Layouts — Fork on Create (Option C)**

- Add `catalog_id UUID NULL` to `_mhb_layouts` (and `_app_layouts` at sync)
- Fork global layout when catalog needs customization, full widget copy
- "Reset to Default" deletes the catalog-specific layout
- Runtime: catalog-specific layout → runtimeConfig overlay → final config
- Existing catalog runtimeConfig overlay preserved as a lightweight override mechanism
- Publication snapshot extended with optional `catalogLayouts` array

### Decision 3: i18n → Namespace-consistent dot notation

- `menu:general_section` for nav
- `metahubs:catalog_layout.*` for catalog layout UI
- EN + RU locales

### Decision 4: Security → No new permissions

- Inherits existing `manageMetahub` / membership model
- RLS inherited from branch schema

---

## Implementation Phases

### Phase 1: General Section + Layout Move (Low Risk)
1. Update `metahubDashboard.ts` — collapse group with Layouts child
2. Add i18n keys (`menu:general_section`)
3. No route changes, no backend changes
4. Verify sidebar collapse/expand behavior

### Phase 2: Catalog-Owned Layout Schema + Backend (Medium Risk)
1. Add `catalog_id` column to `_mhb_layouts` via branch schema migration
2. Add `catalog_id` column to sync-generated `_app_layouts`
3. Add fork/reset/get routes to layouts backend
4. Extend `MetahubLayoutsService` with catalog-scoped methods
5. Extend `attachLayoutsToSnapshot()` for catalog layouts
6. Extend sync persistence (`syncLayoutPersistence.ts`) for catalog layouts

### Phase 3: Catalog Layout Frontend (Medium Risk)
1. Add "Customize Layout" / "Reset to Default" actions to catalog edit dialog
2. Catalog-specific layout opens the existing layout editor
3. Add i18n keys for catalog layout actions
4. Visual indicator on catalog list showing which catalogs have custom layouts

### Phase 4: Runtime Resolution (Low Risk)
1. Extend `runtimeRowsController.ts` to resolve catalog-specific layout before global default
2. Keep existing `resolveCatalogRuntimeDashboardLayoutConfig()` merge as the final overlay
3. Frontend: resolve layout per-catalog in runtime application

### Phase 5: Future General Section Pages (Deferred)
1. Appearance page (theme, brand, colors) — requires settings model extension
2. Navigation page (menu customization) — design needs deduplication with layout left-zone widgets

---

## Open Questions for Product Review

1. **Widget-level inheritance after fork**: Should we track which individual widgets were modified after forking, so a "Sync from Global" can selectively update only unmodified widgets? (V1 recommendation: no — full fork, manual re-fork if needed)

2. **Multiple layouts per catalog**: The current design supports at most one catalog-specific layout (forked from default). Should catalogs be able to have multiple layouts (e.g., "Desktop Layout" vs "Mobile Layout")? (V1 recommendation: no — one layout per catalog, multiple layouts is a V2 concern)

3. **Layout template sharing**: Should catalog-specific layouts be shareable between catalogs? e.g., "Apply Products layout to Orders" (V1 recommendation: no — fork independently from global, or fork from another catalog's layout as V2)

4. **Appearance page content**: Should Appearance live in the General section or get its own top-level Settings tab? The Settings page already has General and Common tabs. (Recommendation: keep Appearance in General section as a separate page, not a Settings tab, because it will need rich visual preview UI rather than simple key-value toggles)
