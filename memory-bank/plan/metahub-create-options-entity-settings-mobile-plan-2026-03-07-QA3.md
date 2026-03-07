# QA Report #3: Metahub Create Options, Entity Settings, Mobile UX, Logout

> **Date**: 2026-03-07  
> **Plan file**: `memory-bank/plan/metahub-create-options-entity-settings-mobile-plan-2026-03-07.md`  
> **Scope**: Comprehensive architecture, codebase alignment, patterns, specification completeness  
> **Previous QAs**: QA #1 (10 issues, all fixed), QA #2 (6 issues, all fixed)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🟠 HIGH | 1 | EntityFormDialog uses non-existent `onCancel` prop (should be `onClose`) |
| 🟡 MEDIUM | 3 | Double-close on save, dead `hubs` field in seed entities, missing `usePublicationDetails` re-addition note |
| 🟢 LOW | 3 | ConfirmDialog rendered twice, build order note for @universo/i18n, `satisfies` TS version |
| ✅ INFO | 10 | Positive confirmations from deep codebase research |

**Overall Assessment**: The plan is architecturally sound after QA #1 and QA #2 corrections. Only **one HIGH-severity** issue remains (incorrect prop name) that would cause a TypeScript compilation error. All other findings are non-blocking improvements.

---

## 🟠 HIGH Issues

### H1: EntityFormDialog prop `onCancel` does not exist — must be `onClose`

**Affected steps**: 4.1, 4.2, 4.3, 4.4, 4.5

**Plan says** (all 5 settings dialog implementations):
```tsx
<EntityFormDialog
  open={editDialogOpen}
  ...
  onSave={async (data) => { ... }}
  onCancel={() => setEditDialogOpen(false)}   // ❌ WRONG
/>
```

**Reality** (verified from `EntityFormDialog.tsx` line 52):
```typescript
export interface EntityFormDialogProps {
    open: boolean
    ...
    onClose: () => void         // ✅ CORRECT prop name
    onSave: (data: ...) => Promise<void> | void
    ...
}
```

The `EntityFormDialogProps` interface has `onClose`, NOT `onCancel`. All existing usages across the codebase (`HubList`, `CatalogList`, `SetList`, `MetahubList`, etc.) use `onClose={handleDialogClose}`.

**Impact**: TypeScript compilation error in all 5 detail pages — implementation would not build.

**Fix**: Replace `onCancel` with `onClose` in all code snippets for Steps 4.1–4.5:
```tsx
onClose={() => setEditDialogOpen(false)}   // ✅ CORRECT
```

---

## 🟡 MEDIUM Issues

### M1: Double-close pattern in onSave + autoCloseOnSuccess

**Affected steps**: 4.1, 4.2, 4.3, 4.4, 4.5

**Plan pattern**:
```tsx
<EntityFormDialog
  open={editDialogOpen}
  onClose={() => setEditDialogOpen(false)}
  // autoCloseOnSuccess defaults to true
  onSave={async (data) => {
    await api.updateEntity(id, payload)
    await helpers.refreshList()
    setEditDialogOpen(false)      // ← Manual close
  }}
/>
```

**Reality** (`EntityFormDialog.tsx`, lines 196-202):
```typescript
const handleSave = async () => {
  ...
  await onSave({ name, description, ...extraValues })
  if (onSuccess) onSuccess()
  if (autoCloseOnSuccess) onClose()   // ← Auto-close calls onClose
}
```

After `onSave` returns, `EntityFormDialog` will call `onClose()` automatically (because `autoCloseOnSuccess` defaults to `true`). So `setEditDialogOpen(false)` is called **twice**: once inside `onSave`, then again via `onClose` from `autoCloseOnSuccess`.

While not breaking (React handles double state-set to same value), it's an incorrect pattern and can cause subtle bugs if future logic depends on the exact close sequence.

**Fix options**:
1. **(Recommended)** Remove `setEditDialogOpen(false)` from `onSave`. Let `autoCloseOnSuccess + onClose` handle closing:
   ```tsx
   onSave={async (data) => {
     await api.updateEntity(id, payload)
     await helpers.refreshList()
     // Dialog auto-closes via onClose after successful save
   }}
   ```
2. **(Alternative)** Set `autoCloseOnSuccess={false}` and manually close in `onSave`.

### M2: `entity.hubs` field in seed is dead metadata — never consumed

**Affected step**: 2.7

**Plan says** (entity seed definitions):
```typescript
entities: [
  { codename: 'MainCatalog', kind: 'catalog', name: vlc(...), hubs: ['MainHub'] },
  { codename: 'MainSet', kind: 'set', name: vlc(...), hubs: ['MainHub'] },
  { codename: 'MainEnumeration', kind: 'enumeration', name: vlc(...), hubs: ['MainHub'] }
]
```

**Reality** (verified `TemplateSeedExecutor.ts` lines 244–350):
- `createEntities()` inserts into `_mhb_objects` with fields: `kind`, `codename`, `presentation`, `config`
- The `entity.hubs` field is **never read or processed** by the executor
- No hub-entity association records are created by any method in `TemplateSeedExecutor`
- The field exists on `TemplateSeedEntity` type (line 859 of metahubs.ts: `hubs?: string[]`) but is unused

**Impact**: The `hubs: ['MainHub']` references in the plan are silently ignored. Entities will be created without hub associations. This is not breaking (hub assignments are managed at runtime by users), but the dead code is misleading.

**Recommendation**: Either:
1. Remove `hubs` from entity definitions in the plan to avoid confusion, OR
2. Note that `hubs` is future metadata and is NOT wired in the executor

This also makes the "Potential Challenges #1" concern about cross-entity dependency filtering **moot** — since hub associations aren't created from seed, filtering out a hub entity has no impact on catalog/set/enum creation.

### M3: PublicationVersionList needs `usePublicationDetails` hook re-added

**Affected step**: 4.5

**Plan says**: "Add parent publication detail query"

**History** (from `progress.md`): `usePublicationDetails` was previously used in `PublicationVersionList.tsx` but was **removed** in an earlier task (C3/C7: "Removed unused `publicationName` + `usePublicationDetails`").

**Current state**: The `usePublicationDetails` hook still exists at `packages/metahubs-frontend/base/src/domains/publications/hooks/usePublicationDetails.ts` and is exported from the hooks index. It just needs to be re-imported into PublicationVersionList.

**Recommendation**: Plan Step 4.5 should explicitly note: "Re-import `usePublicationDetails` from `../hooks` (was removed in prior cleanup)."

---

## 🟢 LOW Issues

### L1: ConfirmDialog documentation says "render once at root"

**Affected step**: 5.5

`ConfirmDialog.tsx` JSDoc (line 8): "This component should be rendered once at the root level of the application."

Plan Step 5.5 adds `<ConfirmDialog />` at `MainLayoutMUI` level. But some pages also render their own `<ConfirmDialog />` (e.g., `HubList.tsx` line 1335, `SettingsPage.tsx` line 368). So two `<ConfirmDialog />` instances will read from the same `ConfirmContext` and **both** render when `confirmState.show === true`.

**Impact**: Functionally still works (both call the same `onConfirm`/`onCancel`), but two identical MUI Dialog portals render simultaneously. This is not ideal per docs recommendation.

**Recommendation**: Acknowledge in the plan that this is known and acceptable. Per-page ConfirmDialogs can be removed in a future cleanup to leave only the layout-level one (out of scope for this task).

### L2: Build verification should include @universo/i18n

Phase 6.2 modifies `@universo/i18n` (common.json files), but Phase 9 lint/build commands only cover `@universo/types`, `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/template-mui`.

**Recommendation**: Add `pnpm --filter @universo/i18n build` to Step 9.2 (or verify it's picked up transitively by downstream builds).

### L3: TypeScript `satisfies` operator requires TS 4.9+

Step 4.1 uses `satisfies Partial<ActionContext<...>> & Record<string, unknown>`. This requires TypeScript 4.9+. Should work with the project's current setup, but worth noting for awareness.

---

## ✅ INFO — Positive Confirmations

### I1: Template split architecture is correct ✅
- Current basic template has NO entities in seed — plan correctly adds them (Step 2.7)
- `enrichConfigWithVlcTimestamps` function exists locally in `basic.template.ts` — can be reused/copied to basic-demo
- `DEFAULT_DASHBOARD_ZONE_WIDGETS` provides the source data for both templates
- Widget changes match the specification: `detailsTable` removed standalone, `columnsContainer` activated with detailsTable+productTree columns

### I2: Seed filtering approach is architecturally sound ✅
- `filterSeedByCreateOptions` correctly targets `entities`, `elements`, and `enumerationValues` (keyed by entity codename)
- `TemplateSeedExecutor.apply()` wraps everything in a DB transaction — partial seed is safe
- Executor logs warnings and skips when entity codenames are not found (graceful degradation)

### I3: All update mutation hooks exist and are exported ✅
- `useUpdateCatalog()` — `catalogs/hooks/mutations.ts` L100
- `useUpdateSet()` — `sets/hooks/mutations.ts` L100
- `useUpdateEnumeration()` — `enumerations/hooks/mutations.ts` L141
- `useUpdatePublication()` — `publications/hooks/mutations.ts` L62

### I4: Parent entity queries exist for all detail pages ✅
- AttributeList: `getCatalogById` via `catalogForHubResolution` query (already present)
- ConstantList: `getSetById` via `setForHubResolution` query (already present)
- EnumerationValueList: `getEnumerationById` API exists — needs query addition
- PublicationVersionList: `usePublicationDetails` hook exists — needs re-import

### I5: All builder functions in *Actions.tsx are pure and safely exportable ✅
- HubActions: `buildInitialValues`, `buildFormTabs`, `validateHubForm`, `canSaveHubForm`, `toPayload` — all `const` functions
- CatalogActions: same pattern — all `const` functions
- SetActions: same pattern — all `const` functions
- EnumerationActions: same pattern — all `const` functions
- PublicationActions: same pattern — all `const` functions

### I6: ActionContext construction has reference implementation ✅
- `createHubContext` in `HubList.tsx` (lines 636–740) provides a complete reference for ActionContext assembly
- All required fields identified: `entity`, `t`, `uiLocale`, `hubMap/hubs`, `_codenameConfig`, `api`, `helpers`

### I7: SideMenuMobile rendered inside AppNavbar within ConfirmContextProvider scope ✅
- AppNavbar.tsx line 73: `<SideMenuMobile open={open} toggleDrawer={toggleDrawer} />`
- MainLayoutMUI wraps all in ConfirmContextProvider → includes AppNavbar → includes SideMenuMobile
- `useConfirm()` in SideMenuMobile will work correctly

### I8: `settings.title` i18n key confirmed in both locales ✅
- EN `metahubs.json` L1503: `"title": "Settings"`
- RU `metahubs.json` L1555: `"title": "Settings"` in the Russian locale entry

### I9: `useAuth().logout()` available in template-mui ✅
- `@universo/template-mui` has `@universo/auth-frontend` as dependency (package.json)
- `useAuth()` confirmed used in `AuthGuard`, `ResourceGuard`, `AdminGuard`, `AppAppBar`

### I10: MetahubInput interface needs `createOptions` field — addressed by Step 3.4 ✅
- Current `MetahubInput` in `metahubs.ts` L13 doesn't have `createOptions`
- Step 3.4 correctly identifies this and says to add it

---

## Specification Coverage Verification

| # | Specification Requirement | Plan Coverage | Status |
|---|---------------|---------------|--------|
| 1 | "Options" tab in create dialog with entity toggles | Phase 3 (MetahubList.tsx local `buildFormTabs` + `MetahubCreateOptionsTab`) | ✅ Correct |
| 2 | Branch/Layout locked ON; Hub/Catalog/Set/Enum togglable (default ON) | Step 3.1 — disabled checked Checkbox for Branch/Layout, active Checkbox for others | ✅ Correct |
| 3 | Server-side validation + seed entity filtering | Steps 2.4 (Zod schema), 2.5 (threading), 2.6 (filterSeedByCreateOptions) | ✅ Correct |
| 4 | Documentation updates (MIGRATIONS.md/-RU.md, AGENTS.md) | Phase 8 Steps 8.1–8.4 | ✅ Covered |
| 5 | Template split: basic (minimal) + basic-demo (full) | Steps 2.1 (basic-demo), 2.2 (basic minimal), 2.3 (registry), 2.7 (entities) | ✅ Correct |
| 5a | Replace standalone details table with a columns container that includes details table + product tree | Steps 2.1–2.2: remove standalone `detailsTable`, activate `columnsContainer` | ✅ Correct |
| 5b | Use the gender-correct Russian “Main” naming family | Step 2.7: Hub=masculine form, Branch=feminine form, Enumeration=neuter form | ✅ Correct |
| 6 | "Settings" tab in 5 entity detail views → edit dialog overlay | Phase 4 Steps 4.1–4.6 with EntityFormDialog | ✅ Correct (H1 prop name fix needed) |
| 7a | Mobile: remove Kiberplano + icon from AppNavbar | Step 5.1 | ✅ Covered |
| 7b | Mobile: responsive collapsible search | Step 5.2 — CollapsibleMobileSearch component | ✅ Covered |
| 7c | Mobile: drawer cleanup (comment demo block + plan-to-expire) | Steps 5.3 (SideMenuMobile cleanup), 5.4 (CardAlert → null) | ✅ Covered |
| 7d | Mobile: functional internationalized Logout with confirmation | Step 5.3 — useAuth + useConfirm in SideMenuMobile | ✅ Covered |
| 8 | Desktop logout in SideMenu with confirmation | Phase 6 Steps 6.1 (SideMenu logout), 6.2 (i18n keys) | ✅ Covered |
| — | "No legacy preservation needed, DB recreated" | Plan header note, no version bumps, no migrations | ✅ Acknowledged |

**All 8 specification points are fully covered.** No missing requirements.

---

## Architecture Assessment

### Patterns — Correct ✅
| Pattern | Assessment |
|---------|-----------|
| ActionDescriptor for entity CRUD dialogs | Established pattern, correctly reused |
| EntityFormDialog for all dialogs | Consistent with codebase |
| ConfirmDialog + useConfirm via context | Properly imperative API |
| TemplateSeedExecutor pre-filtering | Clean separation of concerns |
| Zod schema extension for API validation | Consistent with existing routes |
| i18n namespace separation | metahubs.json for domain, common.json for shared |
| Checkbox for toggle controls | Matches ALL existing copy-options tabs |
| MetahubList.tsx local buildFormTabs | Correctly preserves GeneralTabFields + showTemplateSelector |
| Builder function export from *Actions.tsx | Pure functions, safe to export |

### Codebase Consistency ✅
- No unnecessary new UI components invented — reuses EntityFormDialog, Checkbox, Tabs, Tab, ConfirmDialog
- Settings tab follows the exact same ActionDescriptor edit dialog pattern
- Logout pattern uses established useAuth + useConfirm hooks
- CollapsibleMobileSearch is new but simple and contained within ViewHeader.tsx

### Performance Considerations
- `useMemo` for `settingsDialogCtx` has large dependency arrays — acceptable for edit dialog use case (not high-frequency rendering)
- Hubs query in detail pages adds one extra API call — negligible since it's cached by TanStack Query
- No unnecessary re-renders from the new Settings tab (dialog opens on click, not on tab render)

---

## Recommended Actions

### MUST FIX (1)
1. **H1**: Replace `onCancel` with `onClose` in Steps 4.1, 4.2, 4.3, 4.4, 4.5

### SHOULD FIX (3)
2. **M1**: Remove `setEditDialogOpen(false)` from `onSave` in Steps 4.1–4.5 (let autoCloseOnSuccess handle it)
3. **M2**: Remove `hubs: ['MainHub']` from seed entity definitions in Step 2.7 (or note it's unused)
4. **M3**: Note `usePublicationDetails` re-import need in Step 4.5

### NICE TO HAVE (2)
5. **L1**: Add note about ConfirmDialog dual-rendering being known/acceptable
6. **L2**: Add `@universo/i18n` to build verification in Step 9.2

---

## Next Steps

The plan requires only **minor corrections** (prop name fix + 3 clarifications). No architectural changes needed.

- **If fixes applied** → Proceed to **IMPLEMENT** mode. Recommended starting order: Phase 1 → Phase 7 → Phase 2 → Phase 3 → Phase 4 → Phase 5+6 → Phase 8 → Phase 9
- **If further clarification needed** → Return to PLAN mode for targeted updates
