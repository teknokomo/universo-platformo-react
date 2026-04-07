# QA Review: Plan "General Section + Catalog-Specific Layouts"

> **Date**: 2026-04-06  
> **Reviewed plan**: [general-section-catalog-layouts-plan-2026-04-06.md](general-section-catalog-layouts-plan-2026-04-06.md)  
> **Creative reference**: [creative-general-section-layout-model.md](../creative/creative-general-section-layout-model.md)  
> **Verdict**: **PLAN REQUIRES SIGNIFICANT REVISION** — 3 critical, 3 major, 4 moderate issues

---

## CRITICAL Issues (Plan Fundamentally Misaligns with Spec)

### C1. "General" Section: Collapse Group ≠ Spec Requirement

**Spec says** (point 3):
> "В разделе 'Общие' интерфейс будет такой же как в других разделах, только там будут сразу вкладки, пока будет одна вкладка 'Макеты'"

**Plan proposes**: Sidebar collapse group (`type: 'collapse'`) with "Layouts" as a child menu item.

**Problems found**:

1. **Spec asks for a PAGE with TABS** — "interface same as other sections, only there will be tabs right away". This means a tabbed page at `/metahub/:metahubId/general` (like SettingsPage with its 6 tabs), NOT a collapsible sidebar menu group.

2. **`type: 'collapse'` is not even rendered by the real sidebar**: The actual sidebar renderer is `MenuContent.tsx` in `universo-template-mui`, which uses `TemplateMenuItem = TemplateMenuEntry | TemplateMenuDivider` — **no collapse type is supported**. The `MenuItem` interface in `metahubDashboard.ts` defines `'collapse'` in its union type, but `metahubDashboard.ts` is **never consumed** by the sidebar renderer. The real menu comes from `getMetahubMenuItems()` in `menuConfigs.ts` which has a completely different type system.

3. **TWO menu systems exist** — plan only addresses one:
   - `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts` → exported as `metahubsDashboard` but **NOT imported** anywhere for rendering
   - `packages/universo-template-mui/base/src/navigation/menuConfigs.ts` → `getMetahubMenuItems()` → consumed by `MenuContent.tsx` — this is the **real** sidebar

**Correct approach**: 
- Add a `general` menu item in `getMetahubMenuItems()` (replacing `layouts` item)
- Create a `GeneralPage.tsx` component with tabs (following `SettingsPage.tsx` pattern: `PAGE_TAB_BAR_SX`, `Tabs`, tab switching)
- First tab = "Layouts" which renders the existing `MetahubLayouts` (LayoutList) component inline
- Add route `/metahub/:metahubId/general` in `MainRoutes.tsx`
- Keep existing `/layouts/:layoutId` detail route for editing individual layouts

---

### C2. Catalog Layout Model: "Fork" ≠ Spec Requirement

**Spec says** (point 4):
> "Нужна чтобы там показывались виджеты из активного общего макета, которые нельзя будет редактировать, а можно будет отключить. Ну то есть таким образом для конкретного каталога можно будет сделать тонкую настройку показывать ли в нём виджеты из общего макета, а так же можно будет создать виджеты для конкретного этого каталога, при заходе в этот каталог будут отображаться его персонализированные виджеты, так же должна быть возможность выставить позицию для всех виджетов, в том числе можно будет двигать виджеты из общего макета, перемешивать их с виджетами из макета каталога, тогда при заходе в это каталог все виджеты будут показываться именно согласно персональным настройкам этого каталога."

**Plan proposes**: Option C (Fork-on-Demand) — full copy of global layout into an independent catalog layout. Once forked, the catalog layout is completely independent.

**Why this is wrong**: The spec describes a **MIXED/OVERLAY model**, not a fork:

| Feature | Spec Requires | Plan Proposes |
|---------|--------------|---------------|
| Global widgets visible in catalog editor | ✅ Read-only, can disable | ❌ Independent copy (no link to global source) |
| Catalog-specific widgets | ✅ Can create new widgets | ✅ After fork, can change anything |
| Mix global + catalog widgets | ✅ Interleave with custom ordering | ❌ After fork, all widgets are "owned" |
| Global layout changes reflect in catalogs | ✅ Catalog inherits changes (unless overridden) | ❌ Fork is a snapshot; global changes are lost |
| Per-widget enable/disable from global | ✅ Granular control | ❌ All widgets become catalog-owned after fork |

**Correct approach**: Catalog layouts should reference global layout + overlay:
- Catalog layout stores: widget overrides (enable/disable global widgets), additional catalog-specific widgets, sort positions for ALL widgets (global + catalog)
- Runtime resolution: load global layout widgets + catalog layout widgets → apply overrides → merge sort order → render
- Editor UI: shows global widgets with "inherited" badge (read-only except toggle), shows catalog-specific widgets (fully editable), all items draggable for sort order

---

### C3. Multiple Catalog Layouts Not Supported

**Spec says** (point 5):
> "У макетов каталога тоже должна быть возможность создать несколько макетов, выбрать по умолчанию, сделать активным / неактивным."

**Plan proposes**: "currently one layout max per catalog" — single fork with ConflictError on duplicate.

**Problem**: The plan explicitly limits catalogs to ONE layout and throws ConflictError if you try to create a second one. The spec requires multiple layouts per catalog with default selection and active/inactive toggles — exactly the same CRUD functionality as global layouts, but scoped to a catalog.

**Correct approach**: Catalog layouts should be a full `_mhb_layouts` subset scoped by `catalog_id`:
- Multiple layouts per catalog (just like global layouts)
- `is_default` + `is_active` per catalog scope
- Same list/create/edit/copy/delete operations
- The partial unique index for `is_default` needs `catalog_id` in its expression

---

## MAJOR Issues (Missing or Incorrect Plan Elements)

### M1. Surface Type (Dialog vs Page) Verification Missing

**Spec says** (point 7):
> "проверить что правильно работают настройки каталога Тип окна создания / редактирования / копирования, проверить что работает вариант 'Страница', мне кажется что раньше работал только вариант 'Диалог'... Если это так, то нужно осторожно без лишних изменений сделать нужный компонент в темплейте `packages/apps-template-mui`."

**Plan**: Does not address this at all. No Playwright verification, no fix plan.

**Research findings**: The `FormDialog.tsx` in `apps-template-mui` DOES have `surface === 'page'` support via `PageContainer`, and `ApplicationRuntime.tsx` in `applications-frontend` handles URL-based page mode. However:
- `DashboardApp.tsx` (standalone) has `surface="dialog"` hardcoded
- The full page-mode pathway needs Playwright E2E verification to confirm it works end-to-end
- CatalogLayoutTabFields already has the createSurface/editSurface/copySurface dropdowns

**Required addition**: Plan needs a Phase for:
1. E2E Playwright test that sets surface = 'page' on a catalog, publishes, and verifies in application
2. If 'page' mode doesn't work, fix the rendering path in apps-template-mui

---

### M2. "General" Section Surface Settings in Layout Editor

**Spec says** (point 4):
> "там будет все необходимые общие настройки в том числе как показывать окно создания / редактирования / копирования, в видео диалога или страницы"

**Plan**: Doesn't address that surface settings (createSurface, editSurface, copySurface) should be in the catalog layout editor. Currently they're only in `CatalogLayoutTabFields` which is the catalog's runtimeConfig tab.

**Research**: The createSurface/editSurface/copySurface fields are in `CatalogRuntimeViewConfig` (stored in `_mhb_objects.config.runtimeConfig`), independent of the layout system. The spec implies these should also be accessible from the catalog layout editor page (not just the catalog's form). This needs clarification — are they part of the layout or part of the catalog config?

**Recommendation**: Since these already work via CatalogRuntimeViewConfig, confirm with user whether they should be duplicated into the layout editor or remain in the catalog form.

---

### M3. Existing Layouts Route (/layouts) Behavior

**Spec says** (point 3):
> "макеты НЕ будут иметь отдельную кнопку в левом меню, это будет отображаться в разделе 'Общие' на первой вкладке 'Макеты'"

**Plan**: Keeps the `/layouts` route and menu item, just groups it under a collapse group.

**Problem**: Spec clearly says layouts should NOT have a separate button in the left menu. The layouts list should only be accessible via the General section's "Layouts" tab.

**Correct approach**: 
- Remove `metahub-layouts` from `getMetahubMenuItems()` in `menuConfigs.ts`
- Add `metahub-general` item that navigates to `/metahub/:metahubId/general`
- The General page renders LayoutList as a tab
- `/layouts/:layoutId` route remains for editing a specific layout (navigated to from the LayoutList within the General page)

---

## MODERATE Issues (Improvements + Completeness)

### m1. Legacy Migration Not Needed

**Spec says** (point at the end):
> "Внимание! Не нужно сохранять никакой легаси код, тестовая база данных будет удалена и создана новая"

**Plan**: Phase 2.3 creates a platform migration with `IF NOT EXISTS` patterns and backward-compatible ALTER TABLE.

**Optimization**: Since the database will be recreated, the plan can simplify:
- No need for a platform migration — just update `systemTableDefinitions.ts` and `SchemaGenerator.ts` directly
- New schemas will include `catalog_id` from creation
- This reduces complexity and test burden

However, keep the migration if there is any chance of running this against existing data in staging/production.

---

### m2. Two Menu Systems Inconsistency

**Found**: `metahubDashboard.ts` in `metahubs-frontend` defines the metahub menu with `MenuItem` type, but the actual sidebar uses `getMetahubMenuItems()` from `universo-template-mui` with `TemplateMenuEntry` type. These are separate, unsynchronized definitions.

**Impact**: Any menu changes need to update BOTH systems, or the unused one should be deprecated/removed. The plan only updates `metahubDashboard.ts`, which has no effect on the rendered UI.

**Required**: Update `getMetahubMenuItems()` in `menuConfigs.ts` (this is the real working menu definition).

---

### m3. Catalog Layout Widget Inheritance Source

**Spec says**: "Нужна чтобы там показывались виджеты из активного общего макета"

**Clarification needed**: "Активного общего макета" — this means the DEFAULT ACTIVE global layout. If the metahub has multiple global layouts, catalog inherits from the one marked as `is_default = true AND is_active = true`.

**Plan gap**: The plan's fork model doesn't address which global layout is the source for inheritance. The overlay model needs a clear "source layout" reference.

---

### m4. Test Completeness — Full E2E Flow

**Spec says** (point 6):
> "пройти путь от создания метахаба, настройки общего макета, создания нескольких каталогов с несколькими атрибутами, настройки макета одного каталога, чтобы он отличался, публикации метахаба, создания приложения и проверки в приложении что в каталогах показывается общий макет, а в одном каталоге показывает кастомизированный макет"

**Plan**: Has three separate E2E tests instead of the single comprehensive flow described. Need one integrated E2E test that follows the exact path described above.

---

## Architecture Assessment

### What the plan gets RIGHT:
- ✅ Using `catalog_id` column on `_mhb_layouts` (scoped layouts, not a separate table)
- ✅ Backend Controller-Service-Store pattern compliance
- ✅ Transaction-safe operations with FOR UPDATE locks
- ✅ Publication snapshot extension (adding catalogLayouts as optional field)
- ✅ Security: inheriting existing manageMetahub permissions (no new surfaces)
- ✅ Input validation via Zod at the route layer
- ✅ Bind parameters for SQL (no injection risk)

### What needs architectural revision:
- ❌ Navigation: tabbed page model (like SettingsPage), not collapse group
- ❌ Catalog layout model: overlay/inheritance, not fork
- ❌ Widget composition: read-only global + editable catalog + merged sort order
- ❌ Menu system: update `getMetahubMenuItems()` in template-mui, not just `metahubDashboard.ts`

---

## Summary: Required Plan Changes

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| C1 | General section = tabbed page, NOT collapse group | CRITICAL | Rewrite Phase 5 completely |
| C2 | Catalog layouts = overlay model, NOT fork | CRITICAL | Rewrite Phases 1,3,4,6 |
| C3 | Multiple catalog layouts support needed | CRITICAL | Revise schema design + service: support multiple layouts per catalog |
| M1 | Surface type (dialog/page) E2E verification missing | MAJOR | Add new phase for Playwright verification + fix if needed |
| M2 | Surface settings in layout editor clarification | MAJOR | Clarify with user, add to plan if needed |
| M3 | Layouts should NOT have separate menu item | MAJOR | Fix menu update approach |
| m1 | Legacy migration may be unnecessary | MODERATE | Simplify if DB will be recreated |
| m2 | Two menu systems need sync | MODERATE | Update real menu in template-mui |
| m3 | Inheritance source layout clarification | MODERATE | Define "active global layout" resolution |
| m4 | E2E test should be single comprehensive flow | MODERATE | Merge into one test |

---

## Recommended Next Steps

1. **Clarify with user**: Surface settings in layout editor vs catalog form (M2), and whether overlay model matches their intention for C2.
2. **CREATIVE revision**: Re-run the creative phase for catalog layout model with the correct overlay/inheritance architecture.
3. **Plan rewrite**: Address all critical + major issues before implementation.
