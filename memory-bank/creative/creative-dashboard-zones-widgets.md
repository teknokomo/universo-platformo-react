# Creative Design: Dashboard Zones & Widgets Enhancement

> **Created**: 2026-02-18
> **Status**: Design complete, ready for implementation
> **Scope**: Right Drawer, Mobile dual-Drawer, DnD validation, columnsContainer

---

## Design Topic 1: Right Drawer UI/UX

### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Symmetric Drawer | Mirror copy of left Drawer (240px, same widgets) | Rejected — wastes space, not all widgets make sense on right |
| B. Asymmetric Drawer | Specialized right Drawer (280px, context-focused widgets) | **Selected** |
| C. Collapsible Drawer | Persistent + collapsible mini mode (~56px collapsed) | Rejected — tree/chart widgets have no meaningful mini representation |

### Decision: Asymmetric Drawer (Option B)

**Rationale:**
- Clear functional separation: **left = navigation**, **right = context/details**
- Tree view and charts need ≥240px width; collapsible mini mode is useless for them
- Navigation widgets (`brandSelector`, `menuWidget`, `userProfile`) have no purpose on the right side

**Key Specifications:**

| Parameter | Value |
|-----------|-------|
| Width | 280px |
| Variant (desktop) | `permanent` on `md+` breakpoint |
| Variant (mobile) | Hidden (separate mobile component) |
| Anchor | `right` |
| Visibility control | `showRightSideMenu` in `DashboardLayoutConfig` |
| Auto-hide | Do not render if zero active right-zone widgets |

**Widget allowedZones changes:**

| Widget Key | Current allowedZones | New allowedZones |
|-----------|---------------------|------------------|
| `infoCard` | `['left']` | `['left', 'right']` |
| `divider` | `['left', 'top', 'bottom']` | `['left', 'top', 'bottom', 'right']` |
| `spacer` | `['left']` | `['left', 'right']` |
| `productTree` (NEW) | — | `['center', 'right']` |
| `usersByCountryChart` (NEW) | — | `['center', 'right']` |

**Architecture:**
- Extract `renderWidget()` from `SideMenu.tsx` into shared `widgetRenderer.tsx`
- New `SideMenuRight.tsx` uses same renderer + adds cases for new widget types
- `ZoneWidgets` interface: add `right?: ZoneWidgetItem[]`
- `appDataResponseSchema` (Zod): add `right: z.array(zoneWidgetItemSchema).optional().default([])`
- Backend: `applicationsRoutes.ts` expand zone filter from `WHERE zone = 'left'` to `whereIn('zone', ['left', 'right'])`, split results by zone

---

## Design Topic 2: Mobile Dual-Drawer Rules

### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Combined Drawer with Tabs | One right Drawer, Tabs inside (Navigation / Context) | Rejected — empty tab when right zone has no widgets |
| B. Two separate Drawers | Left (anchor=left, hamburger) + Right (anchor=right, context icon) | **Selected** |
| C. Bottom Sheet for right | Left Drawer + Bottom Sheet for context | Rejected — inconsistent with desktop, no native MUI support |

### Decision: Two Separate Mobile Drawers (Option B)

**Rationale:**
- Clean separation follows standard mobile patterns (Slack, Telegram)
- Conditional rendering: right drawer/button hidden when no right-zone widgets
- Mutual exclusion prevents both from being open simultaneously

**Key Specifications:**

| Component | Anchor | Trigger | Breakpoint |
|-----------|--------|---------|------------|
| `SideMenuMobile` (modified) | `left` | Hamburger icon (left side of AppNavbar) | `< md` only |
| `SideMenuMobileRight` (new) | `right` | Context icon (right side of AppNavbar) | `< md` only, conditional |

**Behavior Rules:**
1. Opening left drawer → auto-close right drawer (and vice versa)
2. If `rightWidgets.length === 0` → right button + drawer not rendered
3. Both drawers use `variant='temporary'`
4. `SideMenuMobile.tsx` changes: `anchor='right'` → `anchor='left'` (BREAKING but correct)
5. New `SideMenuMobileRight.tsx`: temporary, `anchor='right'`, renders right-zone widgets

**State Management:**
```tsx
// In Dashboard.tsx
const [leftMobileOpen, setLeftMobileOpen] = useState(false)
const [rightMobileOpen, setRightMobileOpen] = useState(false)

const openLeftMobile = useCallback(() => {
  setRightMobileOpen(false)
  setLeftMobileOpen(true)
}, [])

const openRightMobile = useCallback(() => {
  setLeftMobileOpen(false)
  setRightMobileOpen(true)
}, [])
```

**AppNavbar changes:**
- Left side: `MenuRoundedIcon` → `onToggleLeftDrawer`
- Right side: `InfoRoundedIcon` → `onToggleRightDrawer` (only if right widgets exist)

---

## Design Topic 3: DnD Between Zones

### Current State Analysis — DnD Already Implemented!

The `LayoutDetails.tsx` constructor already supports **cross-zone drag-and-drop**:
- `DndContext` wraps ALL zones in a single context
- `LayoutZoneColumn` uses `useDroppable({ id: 'zone:${zone}' })` — each zone is a drop target
- `SortableWidgetChip` uses `useSortable({ id })` — each widget is draggable
- `handleDragEnd` handles cross-zone: detects target zone from `overId`, calls `moveLayoutZoneWidget()` API
- Optimistic update with rollback on API error

### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. No changes | Current DnD is sufficient | Rejected — no allowedZones validation on client |
| B. Add client-side allowedZones validation | Validate drop target zone against widget's allowedZones | **Selected** |

### Decision: Add Client-Side allowedZones Validation (Option B)

**Rationale:**
- Base DnD already works — only ~20 lines of validation code needed
- Prevents invalid drops before API call (better UX than optimistic update → rollback → flash)
- As widget types expand (`productTree` → `['center', 'right']`), invalid moves become more likely

**Implementation Details:**

1. **handleDragEnd validation** (~5 lines):
```tsx
const draggedWidget = zoneWidgets.find(w => w.id === activeWidgetId)
const catalogEntry = widgetCatalog.find(c => c.key === draggedWidget?.widgetKey)
if (catalogEntry && !catalogEntry.allowedZones.includes(targetZone)) {
  return // Cancel drop — zone not allowed
}
```

2. **Visual feedback in LayoutZoneColumn** (~10 lines):
- Use `useDndMonitor` to track active drag item
- Pass `allowedForCurrentDrag` to `LayoutZoneColumn`
- When `isOver && !allowedForCurrentDrag` → `borderColor: 'error.main'` (red border)
- When `isOver && allowedForCurrentDrag` → `borderColor: 'primary.main'` (blue border, current behavior)

3. **No backend changes needed** — backend already validates zones server-side

---

## Design Topic 4: columnsContainer Widget — Constructor UI

### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Dialog editor (chip → Edit → Dialog) | Follows MenuWidgetEditorDialog pattern | **Selected (enhanced)** |
| B. Inline DnD constructor | Inline expandable block with nested DnD | Rejected — nested DnD conflicts with LayoutDetails DnD |
| C. Modal visual editor with drag-resize | Dialog with draggable column separators | Rejected — too complex for MVP |

### Decision: Dialog Editor with Visual Proportion Bar (Enhanced Option A)

**Rationale:**
- Follows proven `MenuWidgetEditorDialog` pattern
- Isolated dialog avoids DnD context conflicts
- Visual proportion bar provides WYSIWYG-like feedback without drag complexity
- Presets simplify common layouts (most users want 9:3 or 6:6)

### Type Definition

```typescript
export interface ColumnsContainerConfig {
  /** Number of columns (2-4) */
  columnCount: number
  /** MUI Grid span for each column (must sum to 12) */
  columnSpans: number[]
  /** Widget key to render in each column, null for empty */
  columnWidgets: (DashboardLayoutWidgetKey | null)[]
}
```

### Dialog UI: `ColumnsContainerEditorDialog`

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Configure Columns Layout                   │
├─────────────────────────────────────────────┤
│                                             │
│  Columns: [2] [3] [4]        ← ToggleGroup  │
│                                             │
│  Presets: [9:3] [6:6] [3:9] [8:4] [4:8]    │
│           (for 2-col mode)                  │
│                                             │
│  ┌─────────────┬─────┐      ← Visual bar   │
│  │      9      │  3  │        (colored)     │
│  └─────────────┴─────┘                      │
│                                             │
│  Column 1 (span: 9):                        │
│  Widget: [▼ detailsTable        ]           │
│                                             │
│  Column 2 (span: 3):                        │
│  Widget: [▼ productTree         ]           │
│                                             │
│           [Cancel]  [Save]                  │
└─────────────────────────────────────────────┘
```

**Presets by column count:**

| Columns | Presets |
|---------|---------|
| 2 | `9:3`, `6:6`, `3:9`, `8:4`, `4:8` |
| 3 | `4:4:4`, `6:3:3`, `3:6:3`, `3:3:6` |
| 4 | `3:3:3:3`, `6:2:2:2`, `2:4:4:2` |

**Widget selection per column:**
- `<Select>` with options from `DASHBOARD_LAYOUT_WIDGETS` where `allowedZones` includes `'center'`
- Additional option: `(empty)` → `null`
- Each widget can only be selected once across all columns (unless `multiInstance: true`)

### Runtime Rendering (MainGrid.tsx)

When center zone has a `columnsContainer` widget active, `MainGrid` reads its config and renders:

```tsx
<Grid container spacing={2}>
  {config.columnSpans.map((span, idx) => (
    <Grid key={idx} size={{ xs: 12, lg: span }}>
      {renderCenterWidget(config.columnWidgets[idx])}
    </Grid>
  ))}
</Grid>
```

Where `renderCenterWidget()` maps widget keys to components:
- `detailsTable` → `<CustomizedDataGrid />`
- `productTree` → `<CustomizedTreeView />`
- `usersByCountryChart` → `<ChartUserByCountry />`
- `overviewCards` → `<StatCards />`
- etc.

### Migration from Current Layout

Current `MainGrid.tsx` hardcodes `Grid 9:3` split for `detailsTable` + `detailsSidePanel`. After this change:
- `detailsSidePanel` is **removed** (split into `productTree` + `usersByCountryChart` in Phase 1)
- Default `columnsContainer` config: `{ columnCount: 2, columnSpans: [9, 3], columnWidgets: ['detailsTable', 'productTree'] }`
- This reproduces the current layout exactly, but now configurable

---

## Implementation Order (Confirmed)

```
Phase 1: Split detailsSidePanel → productTree + usersByCountryChart
    ↓
Phase 3: Right Drawer (SideMenuRight, backend zone filter, Zod schema)
    ↓
Phase 2: columnsContainer widget (type, editor dialog, runtime rendering)
    ↓
Phase 4: Routing in apps-template-mui (route factory export)
```

## Architectural Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard.tsx                         │
│  ┌──────────┐  ┌────────────────────────────┐  ┌──────────┐ │
│  │ SideMenu │  │         Main Content       │  │SideMenu  │ │
│  │  (left)  │  │  ┌──────────────────────┐  │  │  Right   │ │
│  │  240px   │  │  │     AppNavbar        │  │  │  280px   │ │
│  │          │  │  ├──────────────────────┤  │  │          │ │
│  │ widgets: │  │  │     Header           │  │  │ widgets: │ │
│  │-brand    │  │  ├──────────────────────┤  │  │-tree     │ │
│  │-divider  │  │  │     MainGrid         │  │  │-chart    │ │
│  │-menu     │  │  │  ┌──────────┬─────┐  │  │  │-infoCard │ │
│  │-spacer   │  │  │  │  col 9   │ c 3 │  │  │  │-divider  │ │
│  │-infoCard │  │  │  │(table)   │(wdg)│  │  │  │-spacer   │ │
│  │-profile  │  │  │  └──────────┴─────┘  │  │  │          │ │
│  │          │  │  │     Footer            │  │  │          │ │
│  └──────────┘  │  └──────────────────────┘  │  └──────────┘ │
│                └────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘

 Mobile (< md):
 ┌─────────────────────────────────┐
 │ [≡]    AppNavbar          [ⓘ]  │
 ├─────────────────────────────────┤
 │         Main Content            │
 │    (full width, no drawers)     │
 └─────────────────────────────────┘
   ← Left Drawer    Right Drawer →
   (temporary)       (temporary)
```

---

## Files Affected (Summary)

### Phase 1 — Split detailsSidePanel (8 files)
- `packages/universo-types/base/src/common/metahubs.ts` — add `productTree`, `usersByCountryChart` keys
- `packages/metahubs-backend/base/src/domains/shared/layoutDefaults.ts` — add defaults
- `packages/apps-template-mui/src/dashboard/components/MainGrid.tsx` — split rendering
- `packages/apps-template-mui/src/dashboard/Dashboard.tsx` — add show* flags
- `packages/apps-template-mui/src/hooks/useCrudDashboard.ts` — add defaults
- `packages/apps-template-mui/src/api/api.ts` — no change (config-driven)
- i18n files — add widget labels

### Phase 3 — Right Drawer (10 files)
- `packages/apps-template-mui/src/dashboard/components/SideMenuRight.tsx` — NEW
- `packages/apps-template-mui/src/dashboard/components/SideMenuMobileRight.tsx` — NEW
- `packages/apps-template-mui/src/dashboard/components/SideMenuMobile.tsx` — anchor change
- `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx` — NEW (extracted)
- `packages/apps-template-mui/src/dashboard/Dashboard.tsx` — add right drawer + mobile state
- `packages/apps-template-mui/src/dashboard/components/AppNavbar.tsx` — dual toggle
- `packages/apps-template-mui/src/api/api.ts` — Zod schema update
- `packages/applications-backend/base/src/routes/applicationsRoutes.ts` — zone filter
- `packages/universo-types/base/src/common/metahubs.ts` — allowedZones updates

### Phase 2 — columnsContainer (6 files)
- `packages/universo-types/base/src/common/metahubs.ts` — add type + widget key
- `packages/metahubs-frontend/.../ColumnsContainerEditorDialog.tsx` — NEW
- `packages/metahubs-frontend/.../LayoutDetails.tsx` — editor trigger
- `packages/apps-template-mui/src/dashboard/components/MainGrid.tsx` — container rendering
- `packages/metahubs-backend/.../layoutDefaults.ts` — default config
- i18n files

### Phase 4 — Routing (4 files)
- `packages/apps-template-mui/src/routes/` — NEW route factory
- `packages/universo-template-mui/.../MainRoutesMUI.tsx` — import from factory
- `packages/apps-template-mui/src/index.ts` — export routes
- `packages/apps-template-mui/package.json` — no change expected

### DnD Validation (1 file, Phase 2/3)
- `packages/metahubs-frontend/.../LayoutDetails.tsx` — allowedZones check in handleDragEnd + visual feedback
