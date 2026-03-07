# QA Review: Metahub Create Options + Entity Settings + Mobile UX + Logout

> **QA Date**: 2026-03-07  
> **Plan Under Review**: `memory-bank/plan/metahub-create-options-entity-settings-mobile-plan-2026-03-07.md`  
> **Verdict**: ❌ Plan requires corrections before implementation

---

## Summary

The plan is well-structured and covers all 8 specification requirements at a high level, but contains **2 CRITICAL**, **4 HIGH**, and **4 MEDIUM** issues discovered during deep codebase verification. The most severe problem is in Phase 4 (Settings tab) where the proposed architecture directly contradicts the specification.

---

## CRITICAL Issues

### C1. Phase 4: Settings Tab Architecture is WRONG

**Severity**: 🔴 CRITICAL — Contradicts an explicit specification requirement

**Plan proposes**: Navigate to `/metahub/:id/settings?tab=X` (page redirect away from current view).

**Specification requires**: "This tab must not open a separate page. It must open the same Edit dialog as the three-dots menu → Edit action, layered above the page where the user already is."

**Translation**: The Settings tab must open an **edit dialog overlay** on top of the current page — the SAME dialog as the three-dots menu → Edit action. It must NOT navigate away.

**Correct approach**:

1. When the user clicks the "Settings" tab, prevent navigation. Instead, set a React state `editDialogOpen = true`.
2. Render `<EntityFormDialog>` inline with `open={editDialogOpen}`, building `tabs` and `initialExtraValues` identically to the edit `ActionDescriptor` in the respective `*Actions.tsx` file.
3. On save/cancel, close the dialog. The user stays on the same page.

**Verified**: `EntityFormDialog` supports `open: boolean` prop — it CAN be rendered standalone without `BaseEntityMenu`. Confirmed in `packages/universo-template-mui/base/src/components/dialogs/EntityFormDialog.tsx` (line 42: `open: boolean`).

**Impact**: Phase 4 Steps 4.1–4.6 ALL need rewriting. Step 4.6 (SettingsPage `?tab=` support) becomes unnecessary and should be removed.

```tsx
// Correct pattern for each detail page:
const [editDialogOpen, setEditDialogOpen] = useState(false)

const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
  if (newValue === 'settings') {
    setEditDialogOpen(true)
    return // Don't change the active tab
  }
  // ... normal tab navigation
}

<EntityFormDialog
  open={editDialogOpen}
  mode="edit"
  tabs={(tabArgs) => buildFormTabs(ctx, hubs, entityId)}
  initialExtraValues={buildInitialValues(entity)}
  onSave={handleSave}
  onCancel={() => setEditDialogOpen(false)}
  validate={validateFunc}
/>
```

---

### C2. Phase 4: Wrong Target Files for 3 out of 5 Entity Detail Pages

**Severity**: 🔴 CRITICAL — Would add Settings tab to the wrong pages

**Plan targets** for Steps 4.2/4.3/4.4:
- `CatalogList.tsx` — this is the **list of catalogs** (shown within a hub or globally)
- `SetList.tsx` — this is the **list of sets** (shown within a hub or globally)
- `EnumerationList.tsx` — this is the **list of enumerations** (shown within a hub or globally)

**These pages show hub-scoping tabs** (`Hubs | Catalogs | Sets | Enumerations`) for navigation between entity types within a hub. They are NOT entity detail pages.

**Correct target files** (entity detail pages where you see entity CONTENTS):

| Entity | WRONG File (plan) | CORRECT File | Current Tabs |
|--------|--------------------|--------------|-------------|
| Hub | HubList.tsx ✅ | HubList.tsx | Hubs / Catalogs / Sets / Enumerations |
| Catalog | CatalogList.tsx ❌ | **AttributeList.tsx** | Attributes / Elements |
| Set | SetList.tsx ❌ | **ConstantList.tsx** | _(none — needs adding)_ |
| Enumeration | EnumerationList.tsx ❌ | **EnumerationValueList.tsx** | _(none — needs adding)_ |
| Publication | PublicationVersionList.tsx ✅ | PublicationVersionList.tsx | Versions / Applications |

**Evidence**:
- `CatalogList.tsx` line 1305: `<Tabs value='catalogs'>` with `<Tab value='hubs'>` / `<Tab value='catalogs'>` / `<Tab value='sets'>` / `<Tab value='enumerations'>` — these are hub navigation tabs, shown only when `isHubScoped`
- `AttributeList.tsx` line 1233: `<Tabs value='attributes'>` with `<Tab value='attributes'>` / `<Tab value='elements'>` — these are catalog content tabs
- `ConstantList.tsx`: NO tabs at all — this is where the set's constants are shown
- `EnumerationValueList.tsx`: NO tabs at all — this is where the enumeration's values are shown

**Impact**: For ConstantList and EnumerationValueList, the plan must explicitly describe adding a NEW `<Tabs>` component (following the AttributeList pattern), not just "adding a tab" to non-existent tabs.

---

## HIGH Issues

### H1. ConfirmDialog API Usage is Incorrect

**Severity**: 🟠 HIGH — Code would not compile or would behave unexpectedly

**Plan's code** (Phases 5 & 6):
```tsx
const { confirm, ...confirmProps } = useConfirm()
// ...
<ConfirmDialog {...confirmProps} />
```

**Reality**: `ConfirmDialog` takes **NO props**. It reads from `ConfirmContext` internally via its own `useConfirm()` call (see `ConfirmDialog.tsx` line 33: `const { onConfirm, onCancel, confirmState } = useConfirm()`).

**Correct pattern**:
```tsx
const { confirm } = useConfirm()

const handleLogout = async () => {
  const confirmed = await confirm({
    title: t('common:auth.logoutConfirmTitle'),
    description: t('common:auth.logoutConfirmMessage'),
    confirmButtonName: t('common:auth.logout')
  })
  if (confirmed) await logout()
}

// Render ConfirmDialog WITHOUT props:
<ConfirmDialog />
```

**Additional concern**: `<ConfirmDialog />` is currently rendered per-page (e.g., `HubList.tsx` line 1335, `SettingsPage.tsx` line 368), NOT at the layout level. Since `SideMenu` and `SideMenuMobile` live in `MainLayoutMUI.tsx` (always rendered), a `<ConfirmDialog />` MUST be added to `MainLayoutMUI.tsx` to ensure the logout confirm dialog appears. `ConfirmContextProvider` is already there (line 33), so only the `<ConfirmDialog />` render is missing.

---

### H2. Entity Names Use Wrong Russian Translation

**Severity**: 🟠 HIGH — Naming doesn't match the specification

**Plan** (Step 2.7):
```typescript
vlc('Main Hub', 'use the generic RU label for Main Hub')
vlc('Main Catalog', 'use the generic RU label for Main Catalog')
vlc('Main Set', 'use the generic RU label for Main Set')
vlc('Main Enumeration', 'use the neuter RU label for Main Enumeration')
```

**Specification**: the Russian naming must use the gender-correct adjective family for “Main” (masculine / feminine / neuter depending on the noun).

**Issues**:
1. The current Russian adjective family is wrong for the requested wording.
2. Gender correctness is required by Russian grammar rules.

**Correct naming rule**:
```typescript
vlc('Main', 'use the masculine RU form of Main')      // Hub
vlc('Main', 'use the masculine RU form of Main')      // Catalog
vlc('Main', 'use the masculine RU form of Main')      // Set
vlc('Main', 'use the neuter RU form of Main')         // Enumeration
```

Or with entity suffixes if desired:
```typescript
vlc('Main Hub', 'use the masculine RU Main + hub label')
vlc('Main Catalog', 'use the masculine RU Main + catalog label')
vlc('Main Set', 'use the masculine RU Main + set label')
vlc('Main Enumeration', 'use the neuter RU Main + enumeration label')
```

**Note**: Also apply the same rule to Branch and Layout names. Branch requires the feminine RU form of “Main”; Layout requires the masculine RU form.

---

### H3. Missing New Tab Container for ConstantList and EnumerationValueList

**Severity**: 🟠 HIGH — Plan describes "adding a tab" but tabs don't exist

**Problem**: ConstantList.tsx (set detail) and EnumerationValueList.tsx (enumeration detail) currently have **NO `<Tabs>` component at all**. The plan's Phase 4 doesn't address that a new tab structure needs to be created from scratch.

**Required work**: Add a `<Tabs>` component following the `AttributeList.tsx` pattern:

For ConstantList (set detail):
```tsx
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
  <Tabs value="constants" onChange={handleSetTabChange} ...>
    <Tab value="constants" label={t('constants.title')} />
    <Tab value="settings" label={t('settings.title')} />
  </Tabs>
</Box>
```

For EnumerationValueList (enum detail):
```tsx
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
  <Tabs value="values" onChange={handleEnumTabChange} ...>
    <Tab value="values" label={t('enumerationValues.title')} />
    <Tab value="settings" label={t('settings.title')} />
  </Tabs>
</Box>
```

---

### H4. Key Files Section Lists Wrong Files

**Severity**: 🟠 HIGH — Misleading for implementation

The plan's "Key Files" section lists wrong target files for Phase 4:
- Lists `CatalogList.tsx` — should be `AttributeList.tsx`
- Lists `SetList.tsx` — should be `ConstantList.tsx`
- Lists `EnumerationList.tsx` — should be `EnumerationValueList.tsx`

Update the "Key Files" table and all references in the plan.

---

## MEDIUM Issues

### M1. ViewHeader Mobile Search Behavior Insufficiently Specified

**Severity**: 🟡 MEDIUM — Missing implementation detail

**Specification defines precise behavior**: the search field stays on the same row on the left as an icon button; when pressed it expands to the right across the full width, including above the buttons on the right; clicking away collapses it again.

**Current ViewHeader**: Search is `display: { xs: 'none', sm: 'flex' }` — completely hidden on mobile.

**Plan describes** only "CollapsibleSearch" vaguely. Should specify:
1. On mobile, replace `OutlinedInput` with an `IconButton` (search icon)
2. On click, expand to full action-bar width, overlaying the filter/action buttons (use absolute positioning or z-index)
3. On blur / click-outside, collapse back to icon
4. Use `useState(false)` for expanded state + `useRef` for click-outside detection

```tsx
// Sketch of CollapsibleSearch:
const [searchExpanded, setSearchExpanded] = useState(false)
const ref = useRef<HTMLDivElement>(null)
useClickOutside(ref, () => setSearchExpanded(false))

return searchExpanded ? (
  <Box ref={ref} sx={{ position: 'absolute', left: 0, right: 0, zIndex: 1 }}>
    <OutlinedInput autoFocus fullWidth onBlur={() => setSearchExpanded(false)} ... />
  </Box>
) : (
  <IconButton onClick={() => setSearchExpanded(true)}>
    <IconSearch />
  </IconButton>
)
```

---

### M2. Step 4.6 (SettingsPage `?tab=` Query Param) is Unnecessary

**Severity**: 🟡 MEDIUM — Dead code if Phase 4 is corrected

Since Phase 4 should use dialog overlays (not navigation to SettingsPage), Step 4.6 "Update `SettingsPage` to accept `?tab=` query parameter" becomes irrelevant and should be **removed** from the plan.

---

### M3. `requiredEntityKinds` May Be Premature Design

**Severity**: 🟡 MEDIUM — Added complexity without immediate use

The plan adds `requiredEntityKinds?: MetaEntityKind[]` to `MetahubTemplateSeed`, but:
- No existing template uses it
- No specification requirement explicitly asks for it
- All entity kinds are already togglable (none "required" by any template seed)

**Recommendation**: Defer `requiredEntityKinds` to a future iteration. The `filterSeedByCreateOptions` logic is sufficient with just the `MetahubCreateOptions` toggles. If templates need to enforce certain entities, add this later.

---

### M4. `ConfirmDialog` Missing at Layout Level

**Severity**: 🟡 MEDIUM — Logout confirm won't render

As noted in H1, `<ConfirmDialog />` must be added to `MainLayoutMUI.tsx` (inside `ConfirmContextProvider`) so that `useConfirm()` calls from `SideMenu`/`SideMenuMobile` work. The plan does not mention this.

```diff
// MainLayoutMUI.tsx
  <ConfirmContextProvider>
    <CssBaseline enableColorScheme />
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SideMenu />
      <AppNavbar />
      <Box component='main' ...>
        <Stack ...>
          <Header />
          {children || <Outlet />}
        </Stack>
      </Box>
    </Box>
+   <ConfirmDialog />
  </ConfirmContextProvider>
```

---

## LOW Issues / Notes

### L1. Plan's Potential Challenges Section Needs Update

Section 3 ("Settings Tab UX Consistency") describes the navigation approach, which is now obsolete. Update to describe the dialog overlay approach.

Section 4 ("Mobile Search Collapsibility") says "this is optional and can be deferred" — but the specification explicitly requires it.

### L2. i18n Keys for "Settings" Tab

The plan assumes `t('settings.title')` works everywhere. Verify that the `settings.title` key in the metahubs i18n namespace is suitable as a tab label (it is — both EN and RU locale values already exist).

### L3. Template Split File Strategy is Acceptable

The plan creates a new `basic-demo.template.ts` and modifies the existing `basic.template.ts` to be minimal. The specification says "rename current to basic-demo and create new basic," but the end result is identical (you get codename `basic` = minimal, codename `basic-demo` = full widgets). The file-level strategy is implementation detail and is fine.

### L4. Demo Template Entity Names

For `basic-demo.template.ts`, the plan uses separate demo-oriented entity labels. Verify that this still matches specification expectations. Consider using the same "Main" naming pattern for demo template entities too, since the template name already communicates "demo".

### L5. Publication Settings Tab Scope

Step 4.5 says navigate to `settings?tab=common` for publications. Since Phase 4 is now dialog-based, this is moot. The publication edit dialog should open with publication-specific form tabs (from PublicationActions or equivalent), not metahub-level settings.

---

## Verified: What the Plan Gets Right

✅ **Phase 1** (Types) — `MetahubCreateOptions` type is well-designed  
✅ **Phase 2** (Backend template split) — Seed widget transformation logic is correct  
✅ **Phase 2** (API contract) — Zod schema extension for `createOptions` is clean  
✅ **Phase 2** (Seed filtering) — `filterSeedByCreateOptions` includes proper cascade filtering of elements/enumerationValues  
✅ **Phase 3** (Create dialog Options tab) — Toggle UI with locked Branch/Layout + togglable entities is correct  
✅ **Phase 5** (AppNavbar) — Removal of CustomIcon + "Kiberplano" text is correct  
✅ **Phase 5** (CardAlert) — Comment-out approach with `return null` is safe  
✅ **Phase 6** (Desktop logout) — Using `useAuth().logout()` is correct; `@universo/auth-frontend` is already a dependency of `@universo/template-mui`  
✅ **Phase 7** (i18n) — Create options keys are well-structured  
✅ **Phase 8** (Documentation) — MIGRATIONS.md updates are appropriate  
✅ **Phase 9** (Build order) — Lint → per-package build → full build → test is correct  
✅ **Dependencies** — Build order (types first, then backend/frontend in parallel, mobile independent) is correct  

---

## Recommended Corrections Summary

| # | Severity | Change Required |
|---|----------|-----------------|
| C1 | 🔴 CRITICAL | Rewrite Phase 4: Settings tab → EntityFormDialog overlay, NOT navigation |
| C2 | 🔴 CRITICAL | Fix target files: AttributeList, ConstantList, EnumerationValueList |
| H1 | 🟠 HIGH | Fix ConfirmDialog usage: no props, singleton pattern |
| H2 | 🟠 HIGH | Fix entity names: use the requested gender-correct Russian “Main” naming family, not the current alternate adjective family |
| H3 | 🟠 HIGH | Describe new tab container creation for ConstantList/EnumerationValueList |
| H4 | 🟠 HIGH | Update Key Files section to list correct files |
| M1 | 🟡 MEDIUM | Detail CollapsibleSearch implementation for mobile |
| M2 | 🟡 MEDIUM | Remove Step 4.6 (SettingsPage `?tab=` — no longer needed) |
| M3 | 🟡 MEDIUM | Consider deferring `requiredEntityKinds` |
| M4 | 🟡 MEDIUM | Add `<ConfirmDialog />` to MainLayoutMUI.tsx |

---

## Next Steps

1. **Correct the plan** — Address all CRITICAL and HIGH issues
2. Re-run QA on the updated plan
3. If plan passes QA, proceed to IMPLEMENT mode
