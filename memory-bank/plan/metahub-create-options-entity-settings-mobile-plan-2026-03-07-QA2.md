# QA Report #2: Metahub Create Options, Entity Settings, Mobile UX, Logout

> **Date**: 2026-03-07  
> **Plan file**: `memory-bank/plan/metahub-create-options-entity-settings-mobile-plan-2026-03-07.md`  
> **Scope**: Comprehensive plan review — architecture, patterns, codebase alignment, ТЗ coverage  
> **Previous QA**: `metahub-create-options-entity-settings-mobile-plan-2026-03-07-QA.md` (10 issues, all addressed in revision)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | 1 | Plan Phase 3 targets wrong function — create dialog won't get Options tab |
| 🟠 HIGH | 3 | UI component inconsistency, ActionContext construction gap, GeneralTabFields vs MetahubEditFields |
| 🟡 MEDIUM | 2 | Settings tab i18n key undefined, Export feasibility details missing |
| 🟢 INFO | 6 | Positive confirmations from codebase research |

---

## 🔴 CRITICAL Issues

### C1: Phase 3 targets wrong function — create dialog will NOT receive Options tab

**Affected steps**: 3.2, 3.3

**Plan says**:
- Step 3.2: "Modify `buildEditTabs` in `MetahubActions.tsx` to accept `{ includeCreateOptions }`"
- Step 3.3: "Wire create dialog in `MetahubList.tsx` — Update `buildEditTabs` call for create dialog to include `{ includeCreateOptions: true }`"

**Reality** (verified by full file read):
- The **create dialog** in `MetahubList.tsx` does **NOT use** `MetahubActions.tsx`'s `buildEditTabs` at all.
- It has its **OWN** `buildFormTabs` — a `useCallback` hook at line 320 — that returns just 2 tabs: `general` (using `GeneralTabFields` component) and `storage`.
- `MetahubActions.tsx`'s `buildEditTabs` is only used by the **edit** (via ActionDescriptor id='edit' at line 391) and **copy** (via ActionDescriptor id='copy' at line 447) dialogs.

**Evidence**:
- `MetahubList.tsx` line 320: `const buildFormTabs = useCallback(({ values, setValue, isLoading, errors }: BuildFormTabsArgs): TabConfig[] => [...]`
- `MetahubList.tsx` line 842: `<EntityFormDialog ... tabs={buildFormTabs} ...>` — uses the LOCAL `buildFormTabs`
- `MetahubActions.tsx` line 391: `tabs: (args: EditTabArgs) => buildEditTabs(ctx, args, { editingEntityId: ctx.entity.id })` — only for edit
- `MetahubActions.tsx` line 447: `tabs: (args: EditTabArgs) => buildEditTabs(ctx, args, { includeCopyOptions: true, editingEntityId: null })` — only for copy

**Impact**: If the plan is followed as-is, the create-options tab would only appear in edit/copy dialogs (where it makes no sense), NOT in the create dialog (where it's needed).

**Fix options**:
1. **(Recommended)** Add the create-options tab directly to `MetahubList.tsx`'s local `buildFormTabs` callback. This is simpler and preserves the existing separation between create and edit/copy logic.
2. **(Alternative)** Refactor `MetahubList.tsx` to use `MetahubActions.tsx`'s `buildEditTabs` for create — but this requires replacing `GeneralTabFields` with `MetahubEditFields`, losing the template selector and create-specific UI.

---

## 🟠 HIGH Issues

### H1: UI component inconsistency — `Switch` vs `Checkbox`

**Affected step**: 3.1

**Plan says**: Step 3.1 proposes `MetahubCreateOptionsFields` using `<Switch>` components for entity toggles.

**Reality**: EVERY existing options/copy-options tab in the codebase uses `<Checkbox>` (specifically `FormControlLabel` + `Checkbox`):

| File | Component | Copy options UI |
|------|-----------|-----------------|
| `MetahubActions.tsx` | copy-options tab (line 334) | `<Checkbox>` |
| `HubActions.tsx` | `HubCopyOptionsTab` (line 349) | `<Checkbox>` |
| `CatalogActions.tsx` | copy-options (line 355) | `<Checkbox>` |
| `SetActions.tsx` | copy-options (line 351) | `<Checkbox>` |
| `EnumerationActions.tsx` | copy-options (line 357) | `<Checkbox>` |

**ТЗ quote**: "переключатели (switches)... по умолчанию все включено" — ТЗ explicitly says "switches".

**Recommendation**: Choose one of:
- **(A) Honor ТЗ, use `Switch`**: Accept visual difference between create-options (Switch) and copy-options (Checkbox). This is valid if the semantics differ (create = toggle on/off, copy = select/deselect).
- **(B) Use `Checkbox` for consistency**: Match the existing codebase pattern. Argue back to ТЗ that `Checkbox` achieves the same UX with visual consistency.
- **(C) Migrate ALL copy-options to `Switch`**: Most thorough, but scope creep.

### H2: Phase 4 — ActionContext construction not detailed

**Affected steps**: 4.1–4.5

**Plan says** (Step 4.1): `const ctx = { entity: parentHub, t, uiLocale, ... }` — but uses `...` without specifying all required fields.

**Reality**: The `ActionContext` type used by `buildFormTabs` in `*Actions.tsx` requires multiple fields:

```typescript
// ActionContext has these required fields:
type ActionContext<E, P> = {
  entity: E              // The entity being edited
  t: TFunction           // Translation function
  uiLocale?: string      // Current UI locale
  hubMap?: Map<...>      // Hub map (used by HubActions)
  api?: {                // API methods
    updateEntity?: (id, payload) => Promise<void>
    // ...
  }
  helpers?: {            // Helper methods
    refreshList?: () => Promise<void>
    enqueueSnackbar?: (msg, opts) => void
    confirm?: (params) => Promise<boolean>
    openDeleteDialog?: (entity) => void
  }
}
```

For HubActions specifically, `HubActionContext` extends this with:
- `hubs?: Hub[]` — array of ALL hubs (for parent selection)
- `currentHubId?: string | null` — current hub context
- `allowHubNesting?: boolean` — nesting config

**Impact**: The detail pages must assemble these context objects manually, which is non-trivial and error-prone. The plan hand-waves this with `...`.

**Recommendation**: Plan should include explicit code showing how to construct the `ActionContext` for each of the 5 entity detail pages, or consider a simpler approach — extract only the FORM FIELDS as reusable components (e.g., export `HubEditFields` directly), and build tabs locally in the detail page.

### H3: GeneralTabFields vs MetahubEditFields — different components

**Affected step**: 3.2 (also C1 above)

**Plan assumption**: The create dialog uses `MetahubEditFields` (from MetahubActions.tsx).

**Reality**: The create dialog uses `GeneralTabFields` — a different component with different props:
- `GeneralTabFields` has a `showTemplateSelector` prop (enabled during creation to let users pick a template)
- `MetahubEditFields` (MetahubActions.tsx line 213) disables the template selector during edit

**Impact**: If Phase 3 is implemented by adding create-options to `buildEditTabs` in MetahubActions.tsx AND refactoring the create dialog to use it, the template selector would be lost (since `MetahubEditFields` renders it as disabled).

**Recommended fix**: Keep the create dialog using its own `buildFormTabs` in MetahubList.tsx (which uses `GeneralTabFields`), and add the create-options tab to THAT function. See C1 fix option 1.

---

## 🟡 MEDIUM Issues

### M1: Settings tab i18n key not defined in plan

**Affected steps**: 4.1–4.5, 7.2

Step 7.2 says "Verify that `t('settings.title')` is used consistently" but doesn't define the key if it doesn't exist.

**Current state**: The metahubs settings page uses keys from `metahubs.json` under a `settings` namespace. But there is no generic `settings.title` key that would work across all entity detail pages (hubs, catalogs, sets, enumerations, publications).

**Recommendation**: Add an explicit i18n key to Phase 7 for entity detail page tab labels. Example:
```json
"entitySettings": {
  "tabLabel": "Settings" / "Настройки"
}
```
Or reuse `common:settings` if available.

### M2: Export feasibility — functions depend on internal types

**Affected step**: 4.6

Step 4.6 proposes exporting `buildInitialValues`, `buildFormTabs`, `validateXxxForm`, `canSaveXxxForm`, `toPayload` from each `*Actions.tsx`.

**Verified**: These are indeed module-level pure functions (no closure over mutable state). They CAN be exported.

**BUT**: The consuming code in detail pages will also need access to internal types like:
- `HubFormValues` (in HubActions.tsx: `type HubFormValues = Record<string, unknown>`)
- `HubDialogTabArgs` (in HubActions.tsx)
- `HubActionContext` (extends `ActionContext`)

These types are not currently exported and would also need to be exported for proper TypeScript usage.

**Recommendation**: Plan Step 4.6 should also list types that need to be exported alongside the functions.

---

## 🟢 INFO — Positive Confirmations

### I1: Backend architecture is sound ✅

The plan correctly traces the creation pipeline:
```
POST /metahubs → createInitialBranch → initializeSchema → initSystemTables → TemplateSeedExecutor.apply(seed)
```
Filtering the seed BEFORE passing to executor (Step 2.6) is the correct approach — no modifications to `TemplateSeedExecutor` are needed.

### I2: `@universo/auth-frontend` dependency confirmed ✅

`@universo/template-mui`'s `package.json` line 67: `"@universo/auth-frontend": "workspace:*"`. The `useAuth()` hook is available in SideMenu, SideMenuMobile, and other template-mui components.

### I3: ConfirmContextProvider already in MainLayoutMUI ✅

`MainLayoutMUI.tsx` line 35 wraps everything in `<ConfirmContextProvider>`. Plan's Step 5.5 to add `<ConfirmDialog />` inside this provider is architecturally correct.

### I4: `useConfirm` and `ConfirmDialog` exist in template-mui ✅

Located at:
- `src/hooks/useConfirm.ts`
- `src/components/dialogs/ConfirmDialog.tsx`

### I5: All *Actions.tsx functions are pure and exportable ✅

Verified that `buildInitialValues`, `buildFormTabs`, `validateXxxForm`, `canSaveXxxForm`, `toPayload` in HubActions, CatalogActions, SetActions, EnumerationActions are module-level functions with no closure over mutable state. They are safe to export.

### I6: Navigation config already includes Settings ✅

`menuConfigs.ts` already has `metahub-settings` item in `getMetahubMenuItems()`, pointing to `/metahub/${metahubId}/settings` with `IconSettings` icon. No changes needed to menu configs.

---

## ТЗ Coverage Verification

| # | ТЗ Requirement | Plan Coverage | Status |
|---|---------------|---------------|--------|
| 1 | "Options" tab in create dialog with entity toggles | Phase 3, Steps 3.1–3.4 | ⚠️ **Targets wrong function** (C1) |
| 2 | Branch/Layout locked ON; Hub/Catalog/Set/Enum togglable (default ON) | Step 3.1 MetahubCreateOptionsFields | ✅ Correct |
| 3 | Server-side createOptions validation & seed filtering | Steps 2.4–2.6 | ✅ Correct |
| 4 | Documentation updates | Phase 8, Steps 8.1–8.4 | ✅ Covered |
| 5 | Template split (basic minimal + basic-demo full) | Steps 2.1–2.3, 2.7 | ✅ Covered |
| 6 | "Settings" tab in entity detail views → edit dialog overlay | Phase 4, Steps 4.1–4.6 | ⚠️ ActionContext gap (H2) |
| 7 | Mobile responsiveness (AppNavbar, ViewHeader, Drawer) | Phase 5, Steps 5.1–5.5 | ✅ Covered |
| 8 | Desktop logout with confirmation | Phase 6, Steps 6.1–6.2 | ✅ Covered |

**Overall ТЗ coverage**: All 8 points are addressed. Two have implementation issues (C1 and H2) that need plan corrections.

---

## Architecture Assessment

### Correct patterns used:
- **ActionDescriptor pattern** for entity CRUD dialogs — existing and proven
- **EntityFormDialog** for all dialogs — consistent
- **ConfirmDialog + useConfirm via context** — proper imperative API usage
- **TemplateSeedExecutor pre-filtering** — clean separation of concerns
- **Zod schema extension** for API validation — consistent with existing routes
- **i18n namespace separation** — metahubs.json for domain, common.json for shared keys

### Pattern concerns:
- **Switch vs Checkbox** — see H1 above
- **Phase 3 architectural disconnect** — see C1 above

---

## Recommended Actions

1. **MUST FIX (C1)**: Rewrite Phase 3 Steps 3.2–3.3 to target `MetahubList.tsx`'s local `buildFormTabs` instead of `MetahubActions.tsx`'s `buildEditTabs`. Keep `MetahubCreateOptionsFields` component in MetahubActions.tsx (or move to a shared location), but wire it into MetahubList.tsx's tab builder.

2. **MUST FIX (H2)**: Add explicit code examples in Phase 4 showing how to construct `ActionContext` in each detail page, including ALL required fields (`entity`, `t`, `uiLocale`, `api.updateEntity`, `helpers.refreshList`).

3. **SHOULD FIX (H1)**: Decide Switch vs Checkbox and document the decision. The ТЗ says "переключатели (switches)" but the codebase consistently uses Checkbox. Either way is fine, but the choice should be explicit.

4. **SHOULD FIX (H3)**: Note that `GeneralTabFields` (with template selector) is used in create dialog, NOT `MetahubEditFields`. The plan should preserve this distinction.

5. **SHOULD FIX (M1, M2)**: Add missing i18n keys definition and type export list to Phase 4/Phase 7.

---

## Next Steps

If the plan is corrected to address the issues above, the implementation can proceed. The backend architecture (Phases 1-2) is solid and can start immediately.

- **If issues are fixed** → Proceed to IMPLEMENT mode
- **If issues need discussion** → Return to PLAN mode for targeted corrections
