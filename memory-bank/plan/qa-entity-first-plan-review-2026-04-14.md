# QA Review — Entity-First Final Migration Plan (2026-04-14)

> **Reviewed plan**: [entity-first-final-migration-plan-2026-04-14.md](entity-first-final-migration-plan-2026-04-14.md)  
> **Status**: QA Complete — issues found, plan update required before implementation  
> **Reviewer**: QA mode (automated deep codebase analysis)

---

## Executive Summary

The 15-phase plan is **architecturally sound** in its overall approach (Behavior Service Registry → Controller Unification → Legacy Deletion → Frontend Consolidation). The Strategy Pattern choice for behavior services is correct and well-suited to TypeScript. However, **12 significant issues** were found, ranging from critical oversights to factual inaccuracies and missing migration paths. The plan requires corrections before implementation.

**Verdict: 🔴 NOT READY for implementation — requires amendment**

---

## Issues Found

### CRITICAL Issues (Must Fix)

#### C1: Renderer File Naming Violates User Requirement

**Plan says** (Phase 5.1): Create `CatalogInstanceRenderer.tsx`, `HubInstanceRenderer.tsx`, `SetInstanceRenderer.tsx`, `EnumerationInstanceRenderer.tsx` in `entities/ui/renderers/`

**Problem**: The user explicitly stated: _"не должно быть в коде никаких Каталогов, Наборов, Перечислений и Хабов, в том числе никаких папок, никаких доменов, ничего. Всё через гибкий и развитый функционал Entities (Сущностей)."_ Creating files named `CatalogInstanceRenderer`, `HubInstanceRenderer` etc. preserves domain-specific naming inside the codebase.

**Recommendation**: Use kind-key-based naming instead:
- `entities/ui/renderers/catalogKindRenderer.tsx` (acceptable — it's a kind key, not a domain)
- OR better: a **single** configurable `StandardKindRenderer.tsx` driven by a `kindRendererConfig` map object that selects specialized sub-components (tree view for hubs, attribute panel for catalogs, etc.) per kind. This is more aligned with the entity-first philosophy: one renderer, different configurations per kind.

**Severity**: CRITICAL — directly contradicts user's stated requirement.

---

#### C2: 37 Cross-Module Dependencies on managed* Folders Not Addressed

**Plan says** (Phase 5.6): Delete managed* folders after creating renderers.

**Problem**: The plan only accounts for imports **inside** managed* folders and direct consumers (`ManagedStandardKindSurfaces.tsx`, `EntityInstanceList.tsx`). However, **37 imports across 12 files** from **generic child-resource domains** depend on managed* folders:

| File (outside managed*) | Imports from managed* |
|---|---|
| `attributes/ui/AttributeFormFields.tsx` | `managedEnumerations/api` |
| `attributes/ui/AttributeList.tsx` | `managedCatalogs/ui/CatalogActions`, `managedCatalogs/hooks/mutations`, `managedCatalogs/ui/catalogRoutePaths` |
| `attributes/hooks/useAttributeListData.ts` | `managedCatalogs`, `managedHubs/hooks` |
| `constants/ui/ConstantList.tsx` | `managedSets/ui/SetActions`, `managedSets/hooks/mutations` |
| `constants/hooks/useConstantListData.ts` | `managedSets`, `managedHubs/hooks` |
| `elements/ui/ElementList.tsx` | `managedCatalogs/ui/CatalogActions`, `managedCatalogs/hooks/mutations`, `managedCatalogs/ui/catalogRoutePaths` |
| `elements/hooks/useElementListData.ts` | `managedCatalogs`, `managedEnumerations/api`, `managedHubs/hooks` |
| `layouts/ui/LayoutList.tsx` | `managedCatalogs/ui/catalogRoutePaths` |
| `layouts/ui/MenuWidgetEditorDialog.tsx` | `managedHubs/hooks` |
| `general/ui/GeneralPage.tsx` | `managedEnumerations/ui/OptionValueList` |
| `entities/ui/EntityInstanceList.tsx` | `managedHubs/hooks` |
| `shared/__tests__/managedMetadataRoutePaths.test.ts` | `managedCatalogs/ui/catalogRoutePaths` |

**Impact**: Deleting managed* folders in Phase 5.6 will cause **immediate build failures** in attributes/, constants/, elements/, layouts/, general/, entities/ and shared/ domains.

**Recommendation**: Phase 5 MUST include an explicit sub-step (before 5.6) to:
1. Extract shared utilities from managed* folders that are used externally:
   - `CatalogActions` type + helpers → move to `entities/ui/shared/`
   - `SetActions` type + helpers → move to `entities/ui/shared/`
   - `catalogRoutePaths` (path builders) → move to `entities/ui/shared/` or `shared/`
   - `useMetahubTrees()` hook → move to unified entity hooks
   - `listEnumerationValues()` API → move to unified entity API
   - `getCatalogById()` / `getSetById()` → move to unified entity API/hooks
2. Rewrite all 37 import paths in the 12 affected files
3. Verify build before deleting managed* folders

This is a significant amount of work not currently estimated in the plan.

**Severity**: CRITICAL — plan will fail at Phase 5.6 without this.

---

#### C3: OptionValueList.tsx Has No Migration Path

**Plan says**: Delete `managedEnumerations/` folder (Phase 5.6).

**Problem**: `OptionValueList.tsx` is a **child-resource component** for enumeration values — analogous to `AttributeList` (for catalogs) and `ConstantList` (for sets). Unlike attributes, constants, and elements which each have their own dedicated domain folder (`attributes/`, `constants/`, `elements/`), enumeration values are embedded inside `managedEnumerations/ui/`. The plan doesn't specify where this component migrates.

**Current consumers**:
- `general/ui/GeneralPage.tsx` imports `OptionValueListContent` from `managedEnumerations/ui/OptionValueList`
- It renders the shared enumeration value pool UI on the General (Common) page

**Recommendation**: Create a new domain `enumerationValues/` (parallel to `attributes/`, `constants/`, `elements/`) with:
- `enumerationValues/api/` — API client for enumeration value CRUD
- `enumerationValues/hooks/` — query/mutation hooks
- `enumerationValues/ui/OptionValueList.tsx` — migrated component
This maintains the existing child-resource domain pattern.

**Severity**: CRITICAL — component will be deleted without replacement.

---

### HIGH Issues (Should Fix)

#### H1: `isBuiltinMetahubObjectKind` Still Exists — Plan Claims "Removed"

**Plan says** (Current State Assessment): "`isBuiltin` / `source`: Removed from types and production code"

**Reality**: `isBuiltinMetahubObjectKind()` function still exists in `MetahubObjectsService.ts` (line 29) and is used at lines 134 and 486:
```
line 29:  const isBuiltinMetahubObjectKind = (kind: string): kind is BuiltinMetahubObjectKind =>
line 134: if (isBuiltinMetahubObjectKind(kind)) {
line 486: entityType: isBuiltinMetahubObjectKind(kind) ? kind : 'entity',
```

**Recommendation**: Add explicit removal to Phase 1 or Phase 3 — this function's logic should be absorbed by the behavior service registry. Update the "Current State Assessment" table to correctly reflect this.

**Severity**: HIGH — factual inaccuracy in assessment + missing cleanup step.

---

#### H2: `legacyBuiltinObjectCompatibility.ts` Not Addressed in Plan

**Plan says**: Phase 3.5 mentions "Remove legacy compatibility utilities. Delete if still present: `legacyCompatibility.ts`"

**Reality**: The actual file is `legacyBuiltinObjectCompatibility.ts` located in `entities/services/` (NOT in the managed* or legacy domains). It exports:
- `executeBlockedDelete()` — generic blocked delete pattern
- `executeHubScopedDelete()` — hub-scoped delete/detach logic
- `executeLegacyReorder()` — reorder pattern

The `entityInstancesController.ts` imports `executeBlockedDelete` from this file (line 37).

**Problem**: These are NOT legacy-only utilities — `executeBlockedDelete` and `executeHubScopedDelete` contain genuinely useful patterns for the behavior services. But the file name contains "legacy" which contradicts the requirement of no legacy references.

**Recommendation**: 
1. Rename the file to `entityDeletePatterns.ts` or `blockingReferenceUtils.ts`
2. The behavior services from Phase 1 should use these utilities (they implement exactly what `EntityBehaviorService.beforeDelete` and `getBlockingReferences` need)
3. Add this to Phase 1 explicitly

**Severity**: HIGH — useful code at risk of accidental deletion; naming violates legacy-free requirement.

---

#### H3: `general/` Domain (GeneralPage.tsx) Not Mentioned in Plan

**Plan doesn't mention** the `general/` domain at all.

**Reality**: `GeneralPage.tsx` is **live production code** that provides a tabbed interface for shared entity pools:
- Tab "Layouts" → `LayoutListContent`
- Tab "Attributes" → `AttributeListContent` (shared catalog pool)
- Tab "Constants" → `ConstantListContent` (shared set pool)  
- Tab "Values" → `OptionValueListContent` (shared enumeration pool)
- Tab "Scripts" → `EntityScriptsTab`

It imports from `managedEnumerations/ui/OptionValueList` (see C3 above).

**Recommendation**: Add Phase 5 sub-step to update GeneralPage.tsx imports to use the new `enumerationValues/` domain (see C3). Also verify the general/ domain doesn't need any other migration for the entity-first architecture.

**Severity**: HIGH — live production page will break.

---

#### H4: Phase 7 (MetahubCreateOptions + Preset Toggles) Is Already Implemented

**Plan says** (Phase 7): "Replace hardcoded create option boolean flags with dynamic preset-driven toggles resolved from template metadata."

**Reality**: This work is **already done** in the current codebase:
- `MetahubCreateOptions.presetToggles?: Record<string, boolean>` already exists in `universo-types` (line 1138)
- `MetahubCreateOptionsTab` component is fully implemented in `MetahubList.tsx` (lines 167-230+):
  - Reads `templateDetail.activeVersionManifest.presets[]`
  - Resolves VLC preset labels via `useTemplates('entity_type_preset')`
  - Renders `Switch` toggles for each preset
  - Initializes defaults from `includedByDefault`
  - Shows "Branch" and "Layout" as always-included checkboxes
  - Sends `presetToggles` in form values
- Backend `MetahubSchemaService` already handles `presetToggles`

**Recommendation**: Phase 7 should be reduced to:
- 7.1: **Verify** existing implementation works correctly (not "build new")
- 7.2: Remove any remaining legacy `createHub`/`createCatalog`/`createSet`/`createEnumeration` fields if they still exist
- 7.3: Add any missing i18n keys (verify EN+RU are complete)

This could save significant implementation time.

**Severity**: HIGH — plan describes building something that exists, wasting effort.

---

#### H5: 3-Pass Seeding vs Plan's 4-Pass Claim

**Plan says** (Phase 8.1): "The executor should follow this 4-pass flow: Pass 0 (Bootstrap) → Pass 1 (Entity type definitions) → Pass 2 (Hub instances first) → Pass 3 (Non-hub instances)"

**Reality**: `TemplateSeedExecutor` uses **3 passes** (confirmed in source code):
```
Pass 1: Insert all entities and build complete codename→id map
Pass 2: Insert set constants and build complete set+constant codename→id map
Pass 3: Insert attributes using the complete entity + constants maps
```

Additionally, `SnapshotRestoreService` comments explicitly reference "3-pass creation order" (line 36).

**Recommendation**: Correct Phase 8.1 to reflect actual 3-pass flow. If the plan intends to change to 4-pass, it should explicitly state this is a NEW change and justify why (the current 3-pass works fine).

**Severity**: HIGH — factual inaccuracy leads to incorrect implementation.

---

### MEDIUM Issues (Consider Fixing)

#### M1: `layout/` Domain Contains Empty Folders — Not in Deletion List

**Reality**: `packages/metahubs-frontend/base/src/domains/layout/` has two empty subfolders:
- `layout/api/` — empty
- `layout/ui/` — empty

This is dead code distinct from the live `layouts/` domain (note plural/singular difference).

**Recommendation**: Add to Phase 5 or Phase 6 deletion list. Trivial fix but should be explicitly listed.

**Severity**: MEDIUM — dead code left behind.

---

#### M2: `managedMetadataRoutePaths.ts` in shared/ Needs Cleanup

**Reality**: `packages/metahubs-frontend/base/src/domains/shared/managedMetadataRoutePaths.ts` contains dual-mode path builders (legacy + entity-owned patterns). After migration, only entity-owned patterns should remain.

The plan mentions removing legacy URL shapes from backend routes (Phase 3.3) but doesn't address this frontend utility file.

**Recommendation**: Add to Phase 6 — clean up or delete `managedMetadataRoutePaths.ts`. The file's test (`shared/__tests__/managedMetadataRoutePaths.test.ts`) also imports from `managedCatalogs/ui/catalogRoutePaths` (see C2).

**Severity**: MEDIUM — stale dual-mode code left behind.

---

#### M3: `constants-library` Preset Not Mentioned

**Reality**: The codebase has a 5th preset beyond the 4 standard kinds — `constants-library` — which is a set-derived custom preset. The plan only discusses 4 standard kind presets.

**Recommendation**: Phase 8.2 / Phase 12.2 should explicitly mention this 5th preset and verify it works correctly with the new architecture. It may also need testing coverage.

**Severity**: MEDIUM — untested preset may regress.

---

#### M4: `MetahubObjectsService` Line 486 Uses `isBuiltinMetahubObjectKind` for ACL Mapping

**Plan doesn't address** how the ACL permission mapping (`entityType: isBuiltinMetahubObjectKind(kind) ? kind : 'entity'`) will be replaced.

**Reality**: Line 486 of `MetahubObjectsService.ts` maps standard kinds to ACL entity types. After removing `isBuiltinMetahubObjectKind`, this mapping needs an alternative — likely through the behavior registry or entity type metadata.

**Recommendation**: Phase 1 behavior service interface should include an optional `aclEntityType` property, or Phase 2 should add ACL mapping to the unified controller.

**Severity**: MEDIUM — ACL regression risk.

---

### LOW Issues (Nice to Fix)

#### L1: Plan Doesn't Address Legacy Query Key Tree Consumers

**Plan says** (Phase 4.3): "Remove legacy per-kind trees: `hubs()`, `hubsList()`, `hubDetail()`, `catalogs()`, etc."

**Observation**: The current `queryKeys.ts` file has extensive legacy per-kind trees (hubs, catalogs, etc.) with ~80 lines of code. The plan correctly identifies this for removal but doesn't list all consumers of these keys that need migration. Some consumers are in the managed* folders (auto-deleted), but any in `shared/__tests__/` or other domains may break.

**Recommendation**: Run grep for all `metahubsQueryKeys.hubs`, `metahubsQueryKeys.catalogs`, etc. consumers before Phase 4.3 to identify migration scope.

**Severity**: LOW — discoverable during implementation.

---

#### L2: Phase 12.1 E2E Deletion List May Be Incomplete

**Plan lists** delete targets: `metahub-entities-legacy-compatible-v2.spec.ts`, `metahub-domain-entities.spec.ts`

**Observation**: There may be additional E2E specs referencing legacy patterns (V2 kind keys, legacy URL shapes, etc.) that need deletion or update. A comprehensive grep during Phase 12 implementation should catch these.

**Severity**: LOW — discoverable during implementation.

---

## Architecture Assessment

### ✅ Strategy Pattern for Behavior Services — CORRECT
The plan's choice of composition-based Strategy Pattern for the Behavior Service Registry is well-suited:
- Runtime-switchable without inheritance hierarchy
- TypeScript-friendly (interface + Map registry)
- Matches the codebase's existing composition patterns
- Allows custom kinds to function without any behavior service (null = generic)
- Easier to test than Template Method (no base class mocking)

### ✅ Unified Entity Controller — CORRECT
Expanding `entityInstancesController` with behavior hooks (pre/post CRUD) is the right approach. The existing `executeBlockedDelete` utility (H2) already implements the exact pattern needed.

### ✅ Query Key Tree Unification — CORRECT
The dual query key tree is a genuine problem. Unifying to entity-scoped keys is the right approach.

### ✅ Child-Resource Route Consolidation — CORRECT
Reducing 4 URL shapes to 2 entity-owned shapes is correct.

### ⚠️ Renderer Approach Needs Refinement (see C1)
The per-kind file approach works but naming needs adjustment to match user requirement.

---

## ТЗ Coverage Check

| # | ТЗ Requirement | Plan Coverage | Status |
|---|---|---|---|
| 1 | Remove all legacy backend domain controllers | Phase 1-3 | ✅ Fully covered |
| 2 | Behavior Service Registry replaces dispatch | Phase 1-2 | ✅ Well-designed |
| 3 | Remove all frontend managed* folders | Phase 5 | ⚠️ Missing cross-deps (C2, C3) |
| 4 | Consolidate child-resource routes | Phase 3.3 | ✅ Covered |
| 5 | Preset-driven metahub create options | Phase 7 | ⚠️ Already exists (H4) |
| 6 | Deep test coverage (Jest/Vitest/Playwright) | Phase 11-12 | ✅ Comprehensive |
| 7 | Regenerate fixtures | Phase 13 | ✅ Covered |
| 8 | Full documentation rewrite | Phase 14 | ✅ Covered |
| 9 | No legacy code preservation | Throughout | ✅ Core principle |
| 10 | All UI text i18n (EN + RU) | Phase 10 | ✅ Covered |

---

## Recommendations Summary

### Must Fix Before Implementation:
1. **C1**: Rename renderers to kind-key-based or use single configurable renderer
2. **C2**: Add cross-dependency migration sub-step to Phase 5 (37 imports in 12 files)
3. **C3**: Create `enumerationValues/` domain for OptionValueList.tsx migration
4. **H1**: Fix "Current State Assessment" — `isBuiltinMetahubObjectKind` still exists
5. **H2**: Rename `legacyBuiltinObjectCompatibility.ts`, integrate into behavior services
6. **H3**: Add `general/` domain to migration scope
7. **H4**: Reduce Phase 7 to "verify existing implementation"
8. **H5**: Correct 4-pass to 3-pass in Phase 8.1

### Should Fix:
9. **M1**: Add `layout/` empty folders to deletion list
10. **M2**: Add `managedMetadataRoutePaths.ts` to cleanup scope
11. **M3**: Include `constants-library` preset in testing scope
12. **M4**: Add ACL mapping strategy to replace `isBuiltinMetahubObjectKind`

---

## Next Steps

1. Amend the plan with fixes for all Critical and High issues
2. Re-run QA after amendments
3. If QA passes, proceed to IMPLEMENT mode

The overall plan structure (15 phases, dependency chain) is sound. The issues found are mostly **gaps and inaccuracies**, not fundamental architectural flaws. With amendments, this plan should guide a successful migration.
