# Entity-First Final Refactoring Plan — Complete Transition

> **Created**: 2026-04-16  
> **Status**: Plan — ready for review  
> **Complexity**: Level 4 — Major/Complex  
> **Branch**: `feature/entity-first-final-migration`  
> **Prerequisite**: Current build green (30/30), all prior naming phases (A–M) complete  
> **Prior plans (superseded)**: [legacy-removal-entity-promotion-plan-2026-04-13.md](legacy-removal-entity-promotion-plan-2026-04-13.md), [entity-first-final-migration-plan-2026-04-14.md](entity-first-final-migration-plan-2026-04-14.md)

---

## Overview

This plan picks up from the **current verified state** (QA audit 2026-04-16) and covers **all remaining work** to achieve the 10-point technical specification. The prior plans covered Phases 1–3 (backend architecture), Phase 5 (managed folder removal), Phase 6 (sidebar/workspace cleanup), Phase 7 (preset toggles), and Phase 9 (schema-DDL) — those are **done**. Plus comprehensive naming migration (Phases A–M) across all packages.

**What remains** (organized by priority and dependency):

| Area | Est. Effort | Status |
|------|-------------|--------|
| Prettier lint fix | Trivial | 1726 auto-fixable errors |
| Query key tree unification | Medium | Per-kind trees coexist with unified `entities()` |
| i18n key migration | Medium-Large | 336 legacy refs in source |
| E2E helper naming | Small | 17 legacy-named functions |
| Frontend standard/ consolidation | Medium | 14.5K LOC, 5 parallel List components |
| Backend large file decomposition | Medium | 3029-line controller |
| Comprehensive test suite | Large | New focused tests + E2E flows |
| Fixture regeneration | Medium | 2 snapshot JSONs |
| Documentation rewrite | Large | EN/RU GitBook with screenshots |

---

## Non-Negotiable End-State Constraints (inherited + refined)

1. No `Managed*` exports, imports, or folder names in active source
2. No `isBuiltin`, `isSystemManagedEntityType`, `includeBuiltins`, `source` column in UI
3. No `custom.*-v2` kind keys anywhere
4. No `document` as standard metahub metadata kind
5. Kind key string literals (`'hub'`, `'catalog'`, `'set'`, `'enumeration'`) remain valid as **data values** — they are database kind keys, not legacy artifacts
6. i18n translation keys use neutral vocabulary (no `t('hubs.*')` in source for entity-first UI)
7. Query key factory uses unified entity-scoped tree
8. All UI text internationalized (EN + RU)
9. UUID v7 for all new IDs
10. TanStack Query patterns throughout
11. Full Playwright E2E coverage with actual screenshot verification
12. GitBook docs in EN + RU with fresh screenshots

---

## Current State Assessment (Verified 2026-04-16)

### ✅ COMPLETE — No further work needed

| Area | Evidence |
|------|----------|
| Backend legacy folders (`hubs/`, `catalogs/`, `sets/`, `enumerations/`) | Deleted |
| Frontend managed folders (`managedCatalogs/`, etc.) | Deleted |
| `ManagedStandardKindSurfaces.tsx` | Deleted |
| `dispatchEntityRoute` | Deleted |
| `isBuiltinMetahubObjectKind` | Deleted from source |
| `MetahubObjectsService` business wrappers | Deleted |
| Behavior registry + standard-kind capabilities | Implemented |
| Entity-owned routes (backend) | All routes entity-only |
| `isBuiltin` / `source` / `isSystemManagedEntityType` in UI | Removed |
| `document` kind in presets | Absent |
| `custom.*-v2` kind keys | 0 in source |
| OpenAPI docs | Entity-owned routes only |
| Naming migration A–M (types, files, params, hooks) | Complete |
| Build | 30/30 green |

### ⚠️ REMAINING — This plan covers

| Area | Current State | Target |
|------|---------------|--------|
| Prettier formatting | 1726 errors (all auto-fixable) | 0 |
| i18n keys | 336 legacy refs (`hubs.*`, `catalogs.*`, etc.) | 0 legacy refs |
| Query keys | Per-kind trees coexist with `entities()` | Unified tree only |
| Frontend `standard/` subtree | 14.5K LOC across 5 List components | Consolidated shared patterns |
| `entityInstancesController.ts` | 3029 lines | Split into focused modules |
| `EntityInstanceList.tsx` | 1791 lines | Decomposed |
| Backend `*Compatibility.ts` | 2 files, 240 lines, actively used | Renamed to neutral names |
| E2E helpers | 17 legacy-named functions | Neutral names |
| E2E new flows | No lifecycle/preset/hierarchy specs | 4+ new specs |
| Fixtures | Not regenerated | Fresh snapshots |
| Documentation | Partially updated | Full EN/RU rewrite with screenshots |
| Tests | 69 backend + 15 frontend + 46 E2E | + focused new tests |

---

## Table of Contents

1. [Phase 1: Housekeeping — Prettier & Lint Fix](#phase-1)
2. [Phase 2: i18n Key Migration](#phase-2)
3. [Phase 3: Query Key Tree Unification](#phase-3)
4. [Phase 4: Backend Controller Decomposition](#phase-4)
5. [Phase 5: Backend Compatibility File Rename](#phase-5)
6. [Phase 6: Frontend Standard Subtree Consolidation](#phase-6)
7. [Phase 7: E2E Helper Neutralization](#phase-7)
8. [Phase 8: Comprehensive Test Suite](#phase-8)
9. [Phase 9: E2E Playwright Full-Cycle Tests](#phase-9)
10. [Phase 10: Fixture Regeneration](#phase-10)
11. [Phase 11: Documentation Rewrite (EN/RU GitBook)](#phase-11)
12. [Phase 12: Final Validation & Zero-Debt Audit](#phase-12)

---

## Phase 1: Housekeeping — Prettier & Lint Fix {#phase-1}

> **Goal**: Fix all 1726 Prettier formatting errors introduced by mass renames. Zero lint errors after this phase.

### Step 1.1: Auto-fix metahubs-frontend

```bash
cd /home/vladimir/GigaProjects/upstream-universo-platformo-react
pnpm --filter @universo/metahubs-frontend lint -- --fix
```

### Step 1.2: Auto-fix metahubs-backend

```bash
pnpm --filter @universo/metahubs-backend lint -- --fix
```

### Step 1.3: Check all other packages for Prettier issues

```bash
pnpm --filter @universo/types lint -- --fix
pnpm --filter @universo/utils lint -- --fix
pnpm --filter @universo/template-mui lint -- --fix
pnpm --filter @universo/apps-template-mui lint -- --fix
pnpm --filter @universo/applications-backend lint -- --fix
pnpm --filter @universo/applications-frontend lint -- --fix
```

### Step 1.4: Validate

```bash
pnpm build   # 30/30
pnpm --filter @universo/metahubs-frontend lint
pnpm --filter @universo/metahubs-backend lint
```

### Checklist — Phase 1:
- [ ] 1.1: Auto-fix metahubs-frontend lint
- [ ] 1.2: Auto-fix metahubs-backend lint
- [ ] 1.3: Auto-fix other packages
- [ ] 1.4: Build green + lint clean

---

## Phase 2: i18n Key Migration {#phase-2}

> **Goal**: Rename all 336 legacy i18n key references in frontend source to use neutral entity-first vocabulary. Update EN/RU translation JSON files accordingly.

### Current State

The i18n keys live in `packages/metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json` under legacy section names:

| Section | Approx. keys | New section name |
|---------|-------------|------------------|
| `hubs.*` | ~73 refs | `treeEntities.*` |
| `catalogs.*` | ~110 refs | `linkedCollections.*` |
| `sets.*` | ~78 refs | `valueGroups.*` |
| `enumerations.*` | ~75 refs | `optionLists.*` |

**Key constraint**: Many of these keys have **identical content** across kinds (e.g., "Create", "Delete", "Name", "Copy"). These duplicates should be consolidated into a shared `standardEntities.*` section.

### Step 2.1: Analyze key overlap

Before renaming, analyze the 4 JSON sections to find:
- **Identical keys** (same EN+RU content) → move to `standardEntities.*` shared section
- **Kind-specific keys** (different content per kind) → keep under kind-named sections

Expected outcome: ~60% of keys are identical across kinds → move to shared section, reducing total translation maintenance.

### Step 2.2: Create shared standardEntities section

Add new `standardEntities` section to EN/RU `metahubs.json` with common keys:

```json
{
  "standardEntities": {
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "copy": "Copy",
    "name": "Name",
    "codename": "Codename",
    "description": "Description",
    "sortOrder": "Sort Order",
    "createdAt": "Created At",
    "updatedAt": "Updated At",
    "confirmDelete": "Are you sure you want to delete this {{entityKind}}?",
    "deleteBlocked": "Cannot delete — this {{entityKind}} is referenced by other entities",
    "copySuccess": "{{entityKind}} copied successfully",
    "createSuccess": "{{entityKind}} created successfully"
  }
}
```

### Step 2.3: Migrate source code references

**CRITICAL ORDER**: First migrate shared keys, THEN rename remaining per-kind keys. If we do a blanket `s/t('hubs\./t('treeEntities./g` FIRST, we'll rename keys that should go to `standardEntities.*` into incorrect `treeEntities.*` paths.

**Order of operations:**
1. Identify and extract shared keys → `standardEntities.*`
2. Only THEN rename remaining kind-specific keys → per-kind sections

**i18n namespace note**: The codebase uses **flat keys within a single `metahubs` namespace** — `t('hubs.deleteDialog.title')`, NOT `t('metahubs:hubs.deleteDialog.title')`. All replacements must match this flat pattern.

For each file in `standard/ui/`:

```typescript
// BEFORE
t('hubs.create')
t('catalogs.confirmDelete', { name })

// AFTER — shared keys
t('standardEntities.create')
t('standardEntities.confirmDelete', { entityKind: t('standardEntities.kinds.hub'), name })

// AFTER — kind-specific keys (like tree-specific nesting labels)
t('treeEntities.nestingLevel')
t('linkedCollections.fieldDefinitionsTab')
```

Use `perl -pi -e` for bulk replacement with word boundaries:

```bash
# Shared keys (identical across all 4 kinds)
perl -pi -e "s/t\('hubs\.create'\)/t('standardEntities.create')/g" $(find packages/metahubs-frontend/base/src -name '*.ts' -o -name '*.tsx')

# Kind-specific keys
perl -pi -e "s/t\('hubs\./t('treeEntities./g" $(find packages/metahubs-frontend/base/src -name '*.ts' -o -name '*.tsx')
perl -pi -e "s/t\('catalogs\./t('linkedCollections./g" $(find ...)
perl -pi -e "s/t\('sets\./t('valueGroups./g" $(find ...)
perl -pi -e "s/t\('enumerations\./t('optionLists./g" $(find ...)
```

### Step 2.4: Update JSON translation files

Rename sections in both `en/metahubs.json` and `ru/metahubs.json`:
- `hubs` → `treeEntities`
- `catalogs` → `linkedCollections`
- `sets` → `valueGroups`
- `enumerations` → `optionLists`
- Add `standardEntities` shared section

### Step 2.5: Verify zero legacy refs

```bash
grep -r "t('hubs\.\|t(\"hubs\.\|t('catalogs\.\|t(\"catalogs\.\|t('sets\.\|t(\"sets\.\|t('enumerations\.\|t(\"enumerations\." \
  packages/metahubs-frontend/base/src/ --include='*.ts' --include='*.tsx' | wc -l
# Expected: 0
```

### Step 2.6: Keep `enumerationValues.*`, `attributes.*`, `elements.*`, `constants.*` sections

These are **child-resource** i18n keys (field definitions, fixed values, records, option values) that are NOT legacy entity-kind names. They may be renamed in a future pass but are out of scope here.

### Checklist — Phase 2:
- [ ] 2.1: Analyze key overlap across hubs/catalogs/sets/enumerations
- [ ] 2.2: Create shared `standardEntities` section in EN + RU JSON
- [ ] 2.3: Migrate all 336 source references
- [ ] 2.4: Rename JSON sections
- [ ] 2.5: Verify zero legacy refs
- [ ] 2.6: Build green

---

## Phase 3: Query Key Tree Unification {#phase-3}

> **Goal**: Collapse the per-kind query key trees (`hubs()`, `catalogs()`, `sets()`, `enumerations()`) into a unified `standardInstances(metahubId, kindKey)` tree. This simplifies cache invalidation and aligns with the entity-first model.

### Current State (VERIFIED)

`queryKeys.ts` (766 lines) uses **raw const functions** (NOT `@lukemorales/query-key-factory` or `createQueryKeyStore`). The factory follows TanStack Query v5 recommended pattern with nested `as const` arrays.

**CRITICAL architectural note**: Per-kind keys are **hub-contextual** (e.g., `catalogs(metahubId, treeEntityId)` — catalogs scoped to a specific hub), while the generic `entities()` tree is **kind-contextual** (all instances of a kind). They answer **different queries** and have **no overlaps**. The unification must preserve this hub-scoping for catalog/set/enumeration queries.

**Usage counts**: hubs ~27 refs, catalogs ~10, sets ~10, enumerations ~9, entities ~8.

### Step 3.1: Design unified tree (Hybrid approach)

The unified tree must support BOTH flat kind-scoped queries AND hub-scoped (container-scoped) queries:

```typescript
// Actual pattern: raw const functions with `as const`
export const metahubsQueryKeys = {
  // ... existing metahub-level keys ...
  
  // UNIFIED standard instance key tree (replaces per-kind trees)
  standardInstancesScope: (metahubId: string, kindKey: string) =>
    ['metahubs', 'detail', metahubId, 'standardInstances', kindKey] as const,
  
  standardInstancesList: (metahubId: string, kindKey: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.standardInstancesScope(metahubId, kindKey), 'list', params] as const,
  
  standardInstanceDetail: (metahubId: string, kindKey: string, entityId: string) =>
    [...metahubsQueryKeys.standardInstancesScope(metahubId, kindKey), 'detail', entityId] as const,
  
  // Hub-scoped children (for catalogs/sets/enumerations within a hub)
  standardInstancesInContainer: (metahubId: string, kindKey: string, containerId: string) =>
    [...metahubsQueryKeys.standardInstancesScope(metahubId, kindKey), 'container', containerId] as const,
  
  standardInstancesInContainerList: (metahubId: string, kindKey: string, containerId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.standardInstancesInContainer(metahubId, kindKey, containerId), 'list', params] as const,
  
  // Option values (sub-resource of enumeration instances)
  optionValuesScope: (metahubId: string, optionListId: string) =>
    ['metahubs', 'detail', metahubId, 'optionValues', optionListId] as const,
  
  optionValuesList: (metahubId: string, optionListId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.optionValuesScope(metahubId, optionListId), 'list', params] as const,
  
  optionValueDetail: (metahubId: string, optionListId: string, valueId: string) =>
    [...metahubsQueryKeys.optionValuesScope(metahubId, optionListId), 'detail', valueId] as const,
  
  // Generic entity instances (custom kinds — kept as-is)
  // entities: (metahubId, kind) => ...
}
```

### Step 3.2: Update standard hooks to use unified tree

For each of the 4 standard-kind hook files, replace per-kind query key references:

```typescript
// BEFORE (treeEntityMutations.ts)
metahubsQueryKeys.hubs(metahubId)
metahubsQueryKeys.hubsList(metahubId, params)
metahubsQueryKeys.hubDetail(metahubId, treeEntityId)

// AFTER (raw const functions, NOT method chain)
metahubsQueryKeys.standardInstancesScope(metahubId, 'hub')
metahubsQueryKeys.standardInstancesList(metahubId, 'hub', params)
metahubsQueryKeys.standardInstanceDetail(metahubId, 'hub', treeEntityId)

// Hub-scoped catalogs:
// BEFORE: metahubsQueryKeys.catalogs(metahubId, treeEntityId)
// AFTER:  metahubsQueryKeys.standardInstancesInContainer(metahubId, 'catalog', treeEntityId)
```

### Step 3.3: Update standard list data hooks

All `useTreeEntityListData`, `useLinkedCollectionListData`, etc. replace their query key references.

### Step 3.4: Update invalidation patterns

Review all `invalidateQueries` and `setQueryData` calls. Uses `safeInvalidateQueries()` and `safeInvalidateQueriesInactive()` from shared library (established pattern in codebase).

```typescript
// BEFORE — per-kind scope invalidation
safeInvalidateQueries(queryClient, metahubsQueryKeys.hubs(metahubId))
safeInvalidateQueries(queryClient, metahubsQueryKeys.catalogs(metahubId, treeEntityId))

// AFTER — unified scope invalidation  
safeInvalidateQueries(queryClient, metahubsQueryKeys.standardInstancesScope(metahubId, 'hub'))
safeInvalidateQueries(queryClient, metahubsQueryKeys.standardInstancesInContainer(metahubId, 'catalog', treeEntityId))
```

**IMPORTANT**: Each mutation in `onSettled` must invalidate the CORRECT scope — hub-level scope for hubs, container-scoped key for catalogs/sets/enumerations. Do NOT collapse this into a single broad invalidation.

### Step 3.5: Remove old per-kind query key definitions

Delete the `hubs()`, `catalogs()`, `sets()`, `enumerations()` branches from `queryKeys.ts`. Expected reduction: ~400 lines → ~200 lines.

### Step 3.6: Validate cache behavior

Write focused unit tests:

```typescript
// queryKeys.test.ts
describe('standardInstances query keys', () => {
  it('hub list key is stable', () => {
    const key = metahubsQueryKeys.standardInstances('mh-1', 'hub').list({ limit: 20 })
    expect(key.queryKey).toEqual(['metahubs', 'mh-1', 'standardInstances', 'hub', 'list', { limit: 20 }])
  })
  
  it('invalidating hub scope does not affect catalog scope', () => {
    const hubKey = metahubsQueryKeys.standardInstances('mh-1', 'hub').queryKey
    const catalogKey = metahubsQueryKeys.standardInstances('mh-1', 'catalog').queryKey
    expect(hubKey).not.toEqual(catalogKey)
  })
})
```

### Checklist — Phase 3:
- [ ] 3.1: Design unified query key tree
- [ ] 3.2: Update standard mutation hooks (4 files)
- [ ] 3.3: Update standard list data hooks (4 files)
- [ ] 3.4: Update invalidation patterns across all standard UI
- [ ] 3.5: Remove old per-kind key definitions
- [ ] 3.6: Write and run query key unit tests
- [ ] Build: `pnpm --filter @universo/metahubs-frontend build`

---

## Phase 4: Backend Controller Decomposition {#phase-4}

> **Goal**: Split the ~2960-line `entityInstancesController.ts` into focused modules without changing any API surface or behavior.

### Current State (VERIFIED)

- Factory function signature: `createEntityInstancesController(createHandler, getDbExecutor)`
- Returns ~20+ handler methods via `dispatchStandardRouteKind()` pattern
- Service instantiation duplicated: `createEnumerationRouteServices()`, `createValueGroupRouteServices()` each instantiate 5-6 services inline
- Helper modules exist separately: `linkedCollectionHelpers.ts`, `optionListHelpers.ts`, `treeCompatibility.ts`
- **No composition root file** (`standardEntityChildrenControllers.ts` does NOT exist)
- Security: All handlers use `ensureMetahubAccess()` with role-based permission checks + Zod validation + parameterized SQL — these patterns MUST be preserved in extracted modules

### Step 4.0: Extract shared service factory

Create `packages/metahubs-backend/base/src/domains/entities/controllers/entityServiceFactory.ts` — eliminates duplicated service instantiation across handler groups.

### Step 4.1: Extract standard-kind CRUD handlers

Create `packages/metahubs-backend/base/src/domains/entities/controllers/standardKindHandlers.ts`:

```typescript
// Extracted from entityInstancesController.ts
// Handles: list/get/create/update/copy/delete for standard kinds (hub, catalog, set, enumeration)
// when the kind is recognized by the behavior registry

export function createStandardKindListHandler(deps: ControllerDeps) {
  return async (req: Request, res: Response) => {
    const { metahubId, kindKey } = req.params
    const behavior = getEntityBehaviorService(kindKey)
    if (!behavior) return respondUnsupportedEntityRouteKind(res, kindKey)
    // ... existing list logic extracted here
  }
}
```

### Step 4.2: Extract child-resource handlers

Create `packages/metahubs-backend/base/src/domains/entities/controllers/childResourceHandlers.ts`:

Handles nested entity operations:
- Hub children listing (`/instance/:treeEntityId/instances`)
- Hub child create/update/delete
- Blocking dependency queries

### Step 4.3: Extract option-value handlers

Create `packages/metahubs-backend/base/src/domains/entities/controllers/optionValueHandlers.ts`:

Handles:
- `listOptionValues`, `getOptionValue`, `createOptionValue`, `updateOptionValue`
- `deleteOptionValue`, `copyOptionValue`, `moveOptionValue`, `reorderOptionValues`
- Option value blocking references

### Step 4.4: Slim down entityInstancesController.ts

After extraction, `entityInstancesController.ts` becomes a **composition root** (~300-500 lines):

```typescript
import { createStandardKindListHandler, ... } from './standardKindHandlers'
import { createChildResourceHandlers } from './childResourceHandlers'
import { createOptionValueHandlers } from './optionValueHandlers'

export function createEntityInstancesController(deps: ControllerDeps) {
  const standardKind = createStandardKindListHandler(deps)
  const childResource = createChildResourceHandlers(deps)
  const optionValue = createOptionValueHandlers(deps)
  
  return {
    list: standardKind.list,
    get: standardKind.get,
    create: standardKind.create,
    // ...
    listChildren: childResource.listChildren,
    // ...
    listOptionValues: optionValue.list,
    // ...
  }
}
```

### Step 4.5: Validate

```bash
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-backend test
```

### Checklist — Phase 4:
- [ ] 4.1: Extract standard-kind CRUD handlers
- [ ] 4.2: Extract child-resource handlers
- [ ] 4.3: Extract option-value handlers
- [ ] 4.4: Slim entityInstancesController to composition root
- [ ] 4.5: Backend build + test green

---

## Phase 5: Backend Compatibility File Rename {#phase-5}

> **Goal**: Rename the 2 remaining `*Compatibility.ts` files to neutral entity-first names since they contain active logic, not legacy shims.

### Step 5.1: Rename files

```
treeCompatibility.ts → treeEntityContext.ts
linkedCollectionCompatibility.ts → linkedCollectionContext.ts
```

### Step 5.2: Rename exported types/functions

```typescript
// treeEntityContext.ts
TreeCompatibilityContext → TreeEntityContext
loadTreeCompatibilityContext → loadTreeEntityContext

// linkedCollectionContext.ts
// (function names are already neutral — just file rename)
```

### Step 5.3: Update all imports

3 consumer files in `standardKindCapabilities.ts`, `entityInstancesController.ts`, `linkedCollectionHelpers.ts`.

### Step 5.4: Build validation

```bash
pnpm --filter @universo/metahubs-backend build
```

### Checklist — Phase 5:
- [ ] 5.1: Rename files
- [ ] 5.2: Rename exported types
- [ ] 5.3: Update imports
- [ ] 5.4: Build green

---

## Phase 6: Frontend Standard Subtree Consolidation {#phase-6}

> **Goal**: Reduce code duplication across the 5 parallel List components in `standard/ui/` (~14.5K LOC) by extracting shared patterns into reusable hooks. This is NOT about creating new UI components — `@universo/template-mui` already provides all needed UI primitives.

### Current State Analysis (VERIFIED)

**All 5 List components already import the SAME shared UI primitives from `@universo/template-mui`:**
- `EntityFormDialog` + `TabConfig` system — for create/edit dialogs
- `BlockingEntitiesDeleteDialog` + `ConfirmDeleteDialog` — for delete handling
- `ConflictResolutionDialog` — for optimistic lock conflicts
- `FlowListTable` with DnD — for data tables
- `ToolbarControls` — for search + view toggle + actions
- `PaginationControls` — for pagination UI
- `useListDialogs()` hook — for dialog open/close state management
- `useConfirm()` hook — for imperative confirmations
- `useDebouncedSearch()` — for debounced search
- `revealPendingEntityFeedback()` + optimistic utilities

**Additionally, shared domain components already exist:**
- `GeneralTabFields` (in `domains/shared/ui/`) — used by LinkedCollection, ValueGroup, OptionList lists
- `ContainerSelectionPanel` (in `components/`) — hub picker, used by 3 lists
- `ExistingCodenamesProvider` — codename collision context

**Key finding: DO NOT create new dialog/toolbar/form components.** They already exist.

**What IS actually duplicated** (and should be consolidated):
- Copy dialog logic — inlined in each list (~150 lines × 4)
- Delete dialog wrappers — 2 patterns coexist (custom `TreeDeleteDialog` vs generic `BlockingEntitiesDeleteDialog` wrapper)
- Pagination + search + view mode state management (~100 lines × 5)
- Entity action handler wiring (~200 lines × 5)

**Kind-specific differences** (must NOT be consolidated):
- `TreeEntityList`: Hierarchy/nesting controls, parent selection, cycle detection
- `LinkedCollectionList`: Hub assignment dropdown, field-definitions tab link
- `ValueGroupList`: Hub assignment, fixed-values tab link
- `OptionListList`: Hub assignment, option-values sub-list embed
- `SelectableOptionList`: Option value CRUD, drag-reorder, shared entity settings

### Step 6.1: Extract `useStandardEntityListState` hook

Create `standard/hooks/useStandardEntityListState.ts` — thin state hook combining existing `useListDialogs()`, `useDebouncedSearch()`, `useViewPreference()`, and `usePaginated()` hooks from template-mui:

```typescript
import { useListDialogs, useDebouncedSearch, useViewPreference, usePaginated } from '@universo/template-mui'

// Combines EXISTING hooks into a single state bundle — NOT reinventing any state management
export function useStandardEntityListState(kindKey: StandardEntityKind) {
  const dialogs = useListDialogs()  // Already exists in template-mui
  const search = useDebouncedSearch()  // Already exists in template-mui
  const viewMode = useViewPreference(`entityList-${kindKey}`)  // Already exists in template-mui
  
  return { dialogs, search, viewMode }
}
```

### Step 6.2: Extract `useStandardEntityCopyHandler` hook

Create `standard/hooks/useStandardEntityCopyHandler.ts` — this is the **primary legitimate refactor** since copy logic IS duplicated across all 4 lists:

```typescript
export function useStandardEntityCopyHandler(params: {
  copyMutation: UseMutationResult<...>
  kindKey: StandardEntityKind
  t: TFunction
}) {
  // Shared copy dialog state + handler logic
  // Currently inlined ~150 lines in each list
}
```

### Step 6.3: Consolidate delete dialog strategy

Unify `TreeDeleteDialog.tsx` to use `BlockingEntitiesDeleteDialog` from `@universo/template-mui` — the same pattern that `LinkedCollectionDeleteDialog` and `OptionListDeleteDialog` ALREADY use. Currently, TreeDeleteDialog reimplements blocking query logic manually.

### Step 6.4: Leverage `createEntityActions()` factory

`@universo/template-mui` exports `createEntityActions()` factory that generates action descriptors (edit, delete, copy) programmatically. MetahubActions.tsx already uses it. Standard Lists should leverage this instead of inline action handler wiring.

### Step 6.5: Refactor List components to use shared hooks

Each List component (~1400 lines) should shrink to ~700-900 lines (realistic target):

```typescript
// LinkedCollectionList.tsx — AFTER refactoring
// NOTE: Uses EXISTING template-mui components, NOT new custom wrappers
export function LinkedCollectionListContent() {
  const { metahubId, treeEntityId, entityKindKey } = useLinkedCollectionListData()
  const { dialogs, search, viewMode } = useStandardEntityListState('catalog')
  const copyHandler = useStandardEntityCopyHandler({ copyMutation, kindKey: 'catalog', t })
  
  return (
    <>
      <ToolbarControls  {/* EXISTING from template-mui */}
        searchQuery={search.query}
        onSearchChange={search.handleChange}
        viewMode={viewMode.current}
        onViewModeChange={viewMode.set}
      />
      <FlowListTable  {/* EXISTING from template-mui */}
        columns={linkedCollectionColumns}  // Kind-specific columns
        data={sortedEntities}
      />
      <EntityFormDialog  {/* EXISTING from template-mui */}
        open={dialogs.createOpen}
        tabs={linkedCollectionTabs}  // Kind-specific tabs using GeneralTabFields + ContainerSelectionPanel
      />
      <BlockingEntitiesDeleteDialog  {/* EXISTING from template-mui */}
        {...dialogs.deleteProps}
      />
    </>
  )
}
```

### Step 6.7: Decompose EntityInstanceList.tsx

Split the 1791-line `EntityInstanceList.tsx` into:
- `EntityInstanceList.tsx` — thin routing shell (~100 lines)
- `EntityInstanceListContent.tsx` — generic entity CRUD for custom kinds (~400 lines)
- Uses `StandardEntityCollectionPage` for standard kinds (already exists)

### Step 6.8: Validate

```bash
pnpm --filter @universo/metahubs-frontend build
# Run existing tests to verify no regressions
```

### Checklist — Phase 6:
- [ ] 6.1: Extract `useStandardEntityListState` hook (combines EXISTING template-mui hooks)
- [ ] 6.2: Extract `useStandardEntityCopyHandler` hook (deduplicate copy logic)
- [ ] 6.3: Consolidate TreeDeleteDialog to use `BlockingEntitiesDeleteDialog` from template-mui
- [ ] 6.4: Leverage `createEntityActions()` factory in standard lists
- [ ] 6.5: Refactor 5 List components to use shared hooks
- [ ] 6.6: Decompose EntityInstanceList.tsx
- [ ] 6.7: Build + existing tests green

---

## Phase 7: E2E Helper Neutralization {#phase-7}

> **Goal**: Rename the 17 legacy-named API helper functions in `tools/testing/e2e/support/backend/api-session.mjs`.

### Step 7.1: Rename E2E API helpers

| Old name | New name |
|----------|----------|
| `listMetahubCatalogs` | `listLinkedCollections` |
| `createMetahubCatalog` | `createLinkedCollection` |
| `listMetahubHubs` | `listTreeEntities` |
| `getMetahubHub` | `getTreeEntity` |
| `listMetahubEnumerations` | `listOptionLists` |
| `getMetahubEnumeration` | `getOptionList` |
| `listMetahubSets` | `listValueGroups` |
| `getMetahubSet` | `getValueGroup` |
| `createMetahubAttribute` | `createFieldDefinition` |
| `listCatalogAttributes` | `listFieldDefinitions` |
| `getCatalogAttribute` | `getFieldDefinition` |
| `listCatalogElements` | `listRecords` |
| `getCatalogElement` | `getRecord` |
| `listEnumerationValues` | `listOptionValues` |
| `getEnumerationValue` | `getOptionValue` |
| `listSetConstants` | `listFixedValues` |
| `getSetConstant` | `getFixedValue` |

### Step 7.2: Update all E2E spec consumers

Use `grep -rl` to find and update all spec files that import these helpers.

### Step 7.3: Validate E2E imports

```bash
grep -r "listMetahubCatalogs\|createMetahubCatalog\|listMetahubHubs\|getMetahubHub" \
  tools/testing/e2e/ | wc -l
# Expected: 0
```

### Checklist — Phase 7:
- [ ] 7.1: Rename 17 E2E API helpers
- [ ] 7.2: Update all spec consumers
- [ ] 7.3: Verify zero legacy refs

---

## Phase 8: Comprehensive Test Suite {#phase-8}

> **Goal**: Write focused tests for new architecture. Tests include unit tests (Vitest), integration tests (Jest), and visual verification via screenshots.

### Step 8.1: Backend — Behavior registry tests

**File**: `packages/metahubs-backend/base/src/tests/services/behaviorRegistry.test.ts`

```typescript
describe('EntityBehaviorService registry', () => {
  beforeEach(() => clearBehaviorRegistry())
  
  it('registers and retrieves behavior by kindKey', () => {
    registerBehavior({ kindKey: 'hub', entityLabel: 'Hub', aclEntityType: 'hub' })
    expect(getBehaviorService('hub')).toBeTruthy()
    expect(getBehaviorService('hub')?.aclEntityType).toBe('hub')
  })
  
  it('returns null for unregistered kind', () => {
    expect(getBehaviorService('unknown')).toBeNull()
  })
  
  it('hub behavior builds blocking state correctly', async () => {
    ensureStandardKindBehaviorsRegistered()
    const hubBehavior = getEntityBehaviorService('hub')
    expect(hubBehavior?.buildBlockingState).toBeDefined()
    // Test with mock DB — expect childHubs, linked collections, etc.
  })
})
```

### Step 8.2: Backend — Standard kind capabilities tests

**File**: `packages/metahubs-backend/base/src/tests/services/standardKindCapabilities.test.ts`

Test each capability function:
- `buildStandardKindBlockingState` for each of the 4 kinds
- `buildStandardKindDeletePlan` — policy blocking, reference blocking, cascade hooks
- Edge cases: empty blocking references, multiple blocking references

### Step 8.3: Backend — Template seed executor tests

**File**: `packages/metahubs-backend/base/src/tests/services/TemplateSeedExecutor.test.ts`

```typescript
describe('TemplateSeedExecutor', () => {
  it('seeds all entity types from basic template', async () => {
    const result = await seedFromTemplate(basicTemplate, metahubId, db)
    expect(result.entityTypeDefinitions).toHaveLength(4) // hub, catalog, set, enumeration
  })
  
  it('respects preset toggles — disabled preset not seeded', async () => {
    const options = { presetToggles: { hub: false, catalog: true, set: true, enumeration: true } }
    const result = await seedFromTemplate(basicTemplate, metahubId, db, options)
    expect(result.entityTypeDefinitions.find(t => t.kindKey === 'hub')).toBeUndefined()
    expect(result.entityTypeDefinitions.find(t => t.kindKey === 'catalog')).toBeDefined()
  })
  
  it('seeds default instances with VLC names', async () => {
    const result = await seedFromTemplate(basicTemplate, metahubId, db)
    const catalog = result.instances.find(i => i.kind === 'catalog')
    expect(getVLCString(catalog?.name, 'en')).toBe('Main')
    expect(getVLCString(catalog?.name, 'ru')).toBe('Основной')
  })
  
  it('resolves hub codename references in default instances', async () => {
    // Catalog default instances reference hub codenames for assignment
    const result = await seedFromTemplate(basicTemplate, metahubId, db)
    const mainHub = result.instances.find(i => i.kind === 'hub' && getVLCString(i.codename, 'en') === 'Main')
    const mainCatalog = result.instances.find(i => i.kind === 'catalog')
    expect(mainCatalog?.hubIds).toContain(mainHub?.id)
  })
})
```

### Step 8.4: Frontend — Query key stability tests

**File**: `packages/metahubs-frontend/base/src/domains/shared/__tests__/queryKeys.test.ts`

### Step 8.5: Frontend — Standard entity list manager tests

**File**: `packages/metahubs-frontend/base/src/domains/entities/standard/ui/__tests__/useStandardEntityListManager.test.tsx`

### Step 8.6: Frontend — Entity workspace tests (coverage expansion)

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx`

Add test cases:
- No "Source" column rendered
- All entity types shown equally (no built-in badge)
- Create/edit/delete actions available for all types
- Preset selector integration

### Step 8.7: Frontend — Standard entity dialogs tests

One test file per extracted shared dialog component.

### Checklist — Phase 8:
- [ ] 8.1: Behavior registry tests
- [ ] 8.2: Standard kind capabilities tests
- [ ] 8.3: Template seed executor tests
- [ ] 8.4: Query key stability tests
- [ ] 8.5: Standard entity list manager tests
- [ ] 8.6: Entity workspace expanded tests
- [ ] 8.7: Shared dialog component tests
- [ ] All tests pass: `pnpm test`

---

## Phase 9: E2E Playwright Full-Cycle Tests {#phase-9}

> **Goal**: Full-cycle browser testing with actual screenshot verification. No assumptions — verify real UI.

### Step 9.1: Create lifecycle E2E spec

**File**: `tools/testing/e2e/specs/flows/metahub-entity-full-lifecycle.spec.ts`

```typescript
test.describe('Entity full lifecycle', () => {
  test('create metahub → seed entities → CRUD → publish → create app → verify runtime', async ({ page }) => {
    // 1. Create metahub from "Basic" template with all presets enabled
    // 2. Verify all 4 entity types created (hub, catalog, set, enumeration)
    // 3. Navigate to each entity type via sidebar
    // 4. For each standard kind:
    //    - List page loads with default "Main" instance
    //    - Create new instance with VLC name (EN + RU)
    //    - Edit instance — verify changes saved
    //    - Copy instance — verify copy appears
    //    - Delete instance — verify blocking refs dialog if applicable
    // 5. Create field definitions on catalog
    // 6. Create fixed values on set  
    // 7. Create option values on enumeration
    // 8. Assign catalog/set/enum to hub
    // 9. Publish metahub
    // 10. Create application + connector
    // 11. Verify application schema created
    // 12. SCREENSHOT at each major step
    
    await page.screenshot({ path: 'test-results/entity-lifecycle/01-metahub-created.png' })
    // ...
  })
})
```

### Step 9.2: Create preset toggle E2E spec

**File**: `tools/testing/e2e/specs/flows/metahub-entity-preset-toggles.spec.ts`

```typescript
test.describe('Metahub create — preset toggles', () => {
  test('disable hub preset → no hub entity type created', async ({ page }) => {
    // 1. Open create dialog
    // 2. Select "Basic" template
    // 3. Navigate to Parameters tab
    // 4. SCREENSHOT: parameters tab with all toggles ON
    // 5. Disable "Hubs" toggle
    // 6. SCREENSHOT: parameters tab with hub toggle OFF
    // 7. Create metahub
    // 8. Navigate to entity types → verify no hub type
    // 9. SCREENSHOT: entity types without hub
  })
  
  test('all presets enabled → all entity types + default instances created', async ({ page }) => {
    // Verify constants-library preset (5th) also works
  })
})
```

### Step 9.3: Create sidebar navigation E2E spec

**File**: `tools/testing/e2e/specs/flows/metahub-entity-sidebar.spec.ts`

### Step 9.4: Create hub hierarchy E2E spec

**File**: `tools/testing/e2e/specs/flows/metahub-entity-hub-hierarchy.spec.ts`

### Step 9.5: Create documentation screenshot spec

**File**: `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts`

Captures PNG screenshots for both EN and RU locales:

```typescript
const SCREENSHOTS = [
  { name: 'entities-workspace', path: '/metahub/:id/entities', desc: 'Entity types list' },
  { name: 'metahub-create-dialog', path: '...', desc: 'Create dialog with parameters' },
  { name: 'catalog-instances', path: '...', desc: 'Catalog instance list' },
  { name: 'hub-tree-view', path: '...', desc: 'Hub hierarchy view' },
  { name: 'set-instances', path: '...', desc: 'Set instance list' },
  { name: 'enumeration-values', path: '...', desc: 'Enumeration with option values' },
  { name: 'field-definition-list', path: '...', desc: 'Field definitions tab' },
  { name: 'delete-blocking-dialog', path: '...', desc: 'Delete with blocking references' }
]

for (const locale of ['en', 'ru']) {
  for (const shot of SCREENSHOTS) {
    test(`screenshot: ${shot.name} [${locale}]`, async ({ page }) => {
      await setLocale(page, locale)
      await navigateTo(page, shot.path)
      await page.screenshot({ 
        path: `docs/${locale}/.gitbook/assets/entities/${shot.name}.png`,
        fullPage: false 
      })
    })
  }
}
```

### Step 9.6: Visual verification protocol

After each Playwright run:
1. Review all captured screenshots in `test-results/`
2. Verify: no raw i18n keys, no layout breaks, correct data
3. Compare EN vs RU for layout consistency
4. Fix issues before proceeding

### Checklist — Phase 9:
- [ ] 9.1: Entity full lifecycle spec
- [ ] 9.2: Preset toggle spec
- [ ] 9.3: Sidebar navigation spec
- [ ] 9.4: Hub hierarchy spec
- [ ] 9.5: Documentation screenshot spec
- [ ] 9.6: Visual verification
- [ ] All E2E pass: `npx playwright test`

---

## Phase 10: Fixture Regeneration {#phase-10}

> **Goal**: Regenerate the 2 fixture JSON files from clean metahub state.

### Step 10.1: Update self-hosted app fixture generator

**File**: `tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts`

Ensure it uses:
- Direct kind keys (`catalog`, `hub`, `set`, `enumeration`)
- Neutral API helpers (from Phase 7)
- Entity-owned URL paths
- No `isBuiltin`, no `source`, no `compatibility`

### Step 10.2: Regenerate self-hosted fixture

```bash
npx playwright test --project=chromium tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts
```

Verify: `tools/fixtures/metahubs-self-hosted-app-snapshot.json` updated with entity-only format.

### Step 10.3: Regenerate quiz app fixture

```bash
npx playwright test --project=chromium tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts
```

### Step 10.4: Verify import round-trip

Run snapshot import E2E test with regenerated fixtures:

```bash
npx playwright test --project=chromium tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts
```

### Checklist — Phase 10:
- [ ] 10.1: Update fixture generator code
- [ ] 10.2: Regenerate self-hosted fixture
- [ ] 10.3: Regenerate quiz app fixture
- [ ] 10.4: Verify import round-trip E2E

---

## Phase 11: Documentation Rewrite (EN/RU GitBook) {#phase-11}

> **Goal**: Complete rewrite of entity-related documentation with fresh Playwright screenshots.

### Step 11.1: Create / rewrite entity system architecture doc

**File**: `docs/en/architecture/entity-systems.md` (NEW)

Content:
- Entity-first architecture overview
- Entity type system: presets, custom types, component manifest
- Behavior service registry pattern
- Template → preset → default instance relationship
- Child resources (field definitions, fixed values, records, option values)
- Standard kinds vs custom entity types

**Mirror**: `docs/ru/architecture/entity-systems.md`

### Step 11.2: Rewrite custom entity types guide

**File**: `docs/en/guides/custom-entity-types.md` (REWRITE)

Using screenshots from Phase 9.5:
- Creating a metahub with preset entity types
- Working with standard kinds (hub, catalog, set, enumeration)
- Creating custom entity types
- Entity instance CRUD
- Field definitions, fixed values, records
- Publishing entities
- Default instances feature

### Step 11.3: Update API reference

**Files**: `docs/en/api-reference/` relevant pages

- Remove ALL legacy API endpoints
- Document unified entity API endpoints only
- Update request/response examples

### Step 11.4: Update platform/metahubs docs

**Files**: `docs/en/platform/metahubs/*.md`

- `shared-attributes.md` → `shared-field-definitions.md` (or similar neutral name)
- `shared-constants.md` → `shared-fixed-values.md`
- `shared-values.md` → `shared-option-values.md`
- Update content to entity-first terminology

### Step 11.5: Update SUMMARY.md for both locales

Verify TOC links, add new pages, remove stale entries.

### Step 11.6: EN/RU parity check

- Compare section structure
- Verify screenshots exist in both `docs/en/.gitbook/assets/entities/` and `docs/ru/.gitbook/assets/entities/`

### Step 11.7: Update package READMEs

- `packages/metahubs-frontend/base/README.md`
- `packages/metahubs-backend/base/README.md`
- `packages/README.md` (root packages)

### Checklist — Phase 11:
- [ ] 11.1: Create entity system architecture doc (EN + RU)
- [ ] 11.2: Rewrite custom entity types guide with screenshots
- [ ] 11.3: Update API reference
- [ ] 11.4: Update platform/metahubs docs terminology
- [ ] 11.5: Update SUMMARY.md (EN + RU)
- [ ] 11.6: EN/RU parity check
- [ ] 11.7: Update package READMEs

---

## Phase 12: Final Validation & Zero-Debt Audit {#phase-12}

> **Goal**: Full validation suite confirming all 10 technical specification points are achieved.

### Step 12.1: Full workspace build

```bash
pnpm build  # 30/30
```

### Step 12.2: Full test suite

```bash
pnpm test
```

### Step 12.3: Lint check (all core packages)

```bash
pnpm --filter @universo/metahubs-frontend lint
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/types lint
pnpm --filter @universo/template-mui lint
```

### Step 12.4: E2E test suite

```bash
npx playwright test
```

### Step 12.5: Zero-debt grep audit

**CRITICAL**: Repository-wide negative inventory. The plan is NOT complete if any of these grep targets return production source hits.

```bash
# No managed domain folders or imports
grep -r "managedCatalogs\|managedHubs\|managedSets\|managedEnumerations\|ManagedStandardKindSurfaces" \
  packages/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v dist

# No legacy built-in markers
grep -r "includeBuiltins\|isBuiltin\|isSystemManagedEntityType" \
  packages/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v dist

# No V2 kind keys
grep -r "custom\.hub-v2\|custom\.catalog-v2\|custom\.set-v2\|custom\.enumeration-v2" \
  packages/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v dist

# No legacy i18n key refs (after Phase 2)
grep -r "t('hubs\.\|t(\"hubs\.\|t('catalogs\.\|t(\"catalogs\.\|t('sets\.\|t(\"sets\.\|t('enumerations\.\|t(\"enumerations\." \
  packages/metahubs-frontend/base/src/ --include='*.ts' --include='*.tsx'

# No per-kind query key trees (after Phase 3)
grep -r "metahubsQueryKeys\.hubs(\|metahubsQueryKeys\.catalogs(\|metahubsQueryKeys\.sets(\|metahubsQueryKeys\.enumerations(" \
  packages/metahubs-frontend/base/src/ --include='*.ts' --include='*.tsx'

# No Compatibility.ts files (after Phase 5)
find packages/metahubs-backend/base/src -name '*Compatibility*'
```

### Step 12.6: Technical specification compliance matrix

| # | Spec Point | Evidence |
|---|-----------|----------|
| 1 | Remove old types, rename V2 → base, kind keys direct | Grep: 0 V2 refs; folder audit: 0 legacy folders |
| 2 | Remove Documents built-in type | Grep: 0 document kind in presets |
| 3 | Remove "Source" column | EntitiesWorkspace.test: no source column |
| 4 | Shared components, no duplication | Phase 6 consolidated; standard/shared/ components |
| 5 | Entity type selection when creating metahubs | E2E: preset toggles spec passes |
| 6 | Parameters tab linked to templates | MetahubCreateOptionsTab reads template presets |
| 7 | Default instances functionality | TemplateSeedExecutor tests pass |
| 8 | Full cycle Playwright verification | E2E: lifecycle spec passes end-to-end |
| 9 | Regenerated fixtures | Fresh JSON fixtures committed |
| 10 | Documentation rewritten | EN/RU docs with Playwright screenshots |

### Step 12.7: OpenAPI regeneration

```bash
cd packages/universo-rest-docs && node scripts/generate-openapi-source.js
```

### Step 12.8: Memory bank update

- `tasks.md` — all tasks completed
- `activeContext.md` — new focus
- `progress.md` — completion summary
- `systemPatterns.md` — updated patterns

### Step 12.9: Commit and prepare PR

```
feat(metahubs): complete entity-first refactoring — unified query keys, i18n migration, frontend consolidation, E2E coverage, fixture regeneration, documentation rewrite
```

### Checklist — Phase 12:
- [ ] 12.1: Full build green (30/30)
- [ ] 12.2: Full test suite green
- [ ] 12.3: Lint clean
- [ ] 12.4: All E2E pass
- [ ] 12.5: Zero-debt grep audit passes
- [ ] 12.6: Compliance matrix verified
- [ ] 12.7: OpenAPI regenerated
- [ ] 12.8: Memory bank updated
- [ ] 12.9: PR prepared

---

## Potential Challenges

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **i18n key ordering** — shared keys must be extracted BEFORE per-kind rename to avoid incorrect paths | MEDIUM | Enforce strict Step 2.1→2.2→2.3 ordering; never run blanket rename first |
| 2 | **Query key hub-scoping loss** — unifying per-kind keys may lose container context for catalog/set/enum queries | HIGH | Design with `standardInstancesInContainer()` (fixed in Step 3.1); write focused invalidation tests BEFORE migrating |
| 3 | **Controller decomposition import chains** — 2960 lines with many internal references | MEDIUM | Extract one module at a time, build-check after each extraction |
| 4 | **TreeDeleteDialog refactor** — custom blocking logic differs from other kinds | LOW | Study existing `BlockingEntitiesDeleteDialog` wrapper in LinkedCollectionDeleteDialog as reference |
| 5 | **E2E server cold start** — Playwright tests may timeout on first API call | LOW | Use existing `waitForServer` utility; increase timeout if needed |
| 6 | **Fixture format changes** — regenerated JSONs may differ from expected format | LOW | DB is wiped; no backward compat needed |
| 7 | **Screenshot locale consistency** — EN/RU may render different widget widths | LOW | Use fixed viewport; verify both locales |
| 8 | **Prettier fix may cause massive diff** — 1726 files touched | LOW | Commit as separate `chore:` commit before feature work |
| 9 | **Optimistic update rollback with new query keys** — existing snapshot/rollback utils reference old key shapes | MEDIUM | Update `applyOptimisticCreate/Update/Delete` calls in mutations in same pass as key migration |

---

## Phase Dependency Graph

```
Phase 1 (Prettier) ──→ Phase 2 (i18n) ──→ Phase 3 (Query keys)
                                               │
Phase 4 (Backend split) ─────────────────────→ Phase 8 (Tests)
Phase 5 (Compat rename) ──→                    │
Phase 6 (Frontend consolidation) ──→           │
Phase 7 (E2E helpers) ──→ Phase 9 (E2E tests) ─→ Phase 10 (Fixtures)
                                                     │
                                           Phase 11 (Docs) ──→ Phase 12 (Final)
```

**Parallelizable pairs**:
- Phase 4 + Phase 5 (backend, independent)
- Phase 6 + Phase 7 (frontend + E2E, independent)
- Phase 8 can run incrementally alongside Phases 3-7

---

## Files Changed Summary

### Files to MODIFY (~50-80 files)

**i18n (Phase 2)**:
- `metahubs-frontend/base/src/i18n/locales/en/metahubs.json` — rename sections
- `metahubs-frontend/base/src/i18n/locales/ru/metahubs.json` — rename sections
- ALL standard/ui/*.tsx — update `t()` calls (~20 files)

**Query keys (Phase 3)**:
- `shared/queryKeys.ts` — rewrite
- All `standard/hooks/*.ts` — update key references (~12 files)
- All `standard/ui/*.tsx` — update cache refs

**Backend (Phases 4-5)**:
- `entityInstancesController.ts` — decompose
- New: `standardKindHandlers.ts`, `childResourceHandlers.ts`, `optionValueHandlers.ts`
- `treeCompatibility.ts` → `treeEntityContext.ts`
- `linkedCollectionCompatibility.ts` → `linkedCollectionContext.ts`

**Frontend consolidation (Phase 6)**:
- New: `useStandardEntityListState.ts`, `useStandardEntityCopyHandler.ts`
- Refactor: 5 `*List.tsx` files + TreeDeleteDialog.tsx (to use `BlockingEntitiesDeleteDialog`)
- Decompose: `EntityInstanceList.tsx`

**E2E (Phases 7, 9)**:
- `api-session.mjs` — rename 17 functions
- All E2E specs referencing old helpers (~15 files)
- New: 4 E2E specs + 1 screenshot generator

**Documentation (Phase 11)**:
- New: `entity-systems.md` (EN + RU)
- Rewrite: `custom-entity-types.md` (EN + RU)
- Update: ~8 platform/metahubs docs
- Update: 2 SUMMARY.md, 3 README.md

### Files to CREATE (~20-25 files)

**Backend**:
- `controllers/standardKindHandlers.ts`
- `controllers/childResourceHandlers.ts`
- `controllers/optionValueHandlers.ts`
- `tests/services/behaviorRegistry.test.ts`
- `tests/services/standardKindCapabilities.test.ts`
- `tests/services/TemplateSeedExecutor.test.ts`

**Frontend**:
- `standard/hooks/useStandardEntityListState.ts`
- `standard/hooks/useStandardEntityCopyHandler.ts`
- `domains/shared/__tests__/queryKeys.test.ts`
- `standard/hooks/__tests__/useStandardEntityListState.test.tsx`

**E2E**:
- `specs/flows/metahub-entity-full-lifecycle.spec.ts`
- `specs/flows/metahub-entity-preset-toggles.spec.ts`
- `specs/flows/metahub-entity-sidebar.spec.ts`
- `specs/flows/metahub-entity-hub-hierarchy.spec.ts`
- `specs/generators/docs-entity-screenshots.spec.ts`

**Documentation**:
- `docs/en/architecture/entity-systems.md`
- `docs/ru/architecture/entity-systems.md`
- Screenshot assets in `docs/{en,ru}/.gitbook/assets/entities/`

### Files to DELETE (~5 files)

- Old per-kind query key definitions within `queryKeys.ts` (lines, not files)
- `treeCompatibility.ts` → renamed to `treeEntityContext.ts`
- `linkedCollectionCompatibility.ts` → renamed to `linkedCollectionContext.ts`

---

## QA Review Report (2026-04-16)

### Summary

The plan was reviewed against: (1) the actual codebase architecture, (2) the original 10-point technical specification, (3) TanStack Query v5 best practices, (4) existing UI component inventory, (5) backend security patterns.

**Overall verdict: Plan is VIABLE with corrections applied.** The corrections below have been embedded into the plan text above.

### Issues Found and Corrected

#### ISSUE 1 — Phase 3: Incorrect query key factory pattern (FIXED ✅)

**Problem**: The plan used `createQueryKeyStore()` with nested `contextQueries` objects — this API does not exist in the codebase. The actual pattern uses raw const functions with `as const` arrays (TanStack Query v5 recommended).

**Also**: The plan treated per-kind and unified keys as overlapping. In reality, per-kind keys are **hub-contextual** (catalog queries scoped to a specific hub), while `entities()` is **kind-contextual** (all instances of a kind). Unification must preserve hub-scoping via `standardInstancesInContainer()`.

**Fix applied**: Rewritten Step 3.1 with correct `as const` factory pattern and `standardInstancesInContainer` for hub-scoped queries.

#### ISSUE 2 — Phase 6: Proposed creating UI components that already exist (FIXED ✅)

**Problem**: The plan proposed creating `StandardEntityCreateDialog`, `StandardEntityDeleteDialog`, `StandardEntityToolbar`, `StandardEntityCopyDialog` — 4 new components. However:
- `EntityFormDialog` from `@universo/template-mui` is already used by ALL 5 lists for create/edit
- `BlockingEntitiesDeleteDialog` from `@universo/template-mui` is already used by LinkedCollectionDeleteDialog and OptionListDeleteDialog
- `ToolbarControls` from `@universo/template-mui` is already used by ALL 5 lists

Only the copy handler logic is genuinely duplicated and needs extraction.

**Fix applied**: Phase 6 rewritten to focus on extracting hooks (`useStandardEntityListState`, `useStandardEntityCopyHandler`) and leveraging existing template-mui components, not creating duplicates.

#### ISSUE 3 — Phase 4: Missing service factory deduplication (FIXED ✅)

**Problem**: The plan did not mention that service instantiation is duplicated across handlers (`createEnumerationRouteServices`, `createValueGroupRouteServices` each instantiate 5-6 services). Also, the plan referenced a non-existent `standardEntityChildrenControllers.ts`.

**Fix applied**: Added Step 4.0 for service factory extraction. Removed misleading reference.

#### ISSUE 4 — Phase 2: Missing i18n operation ordering warning (FIXED ✅)

**Problem**: Step 2.3 suggested blanket `perl -pi -e` replacements that would rename `t('hubs.create')` to `t('treeEntities.create')` before checking if it should be `t('standardEntities.create')` instead. The order of operations matters.

**Fix applied**: Added CRITICAL ORDER warning — shared keys must be extracted first.

### Items Verified and Confirmed Correct

| Area | Verification | Status |
|------|-------------|--------|
| TanStack Query v5 patterns | useMutation with onMutate/onError/onSuccess/onSettled, optimistic updates with rollback | ✅ Correct |
| Optimistic update pattern | `applyOptimisticCreate/Update/Delete` + `rollbackOptimisticSnapshots` from template-mui | ✅ Correct |
| Cache invalidation | `safeInvalidateQueries()` in `onSettled` (not just onSuccess) | ✅ Best practice |
| Error handling | notistack `enqueueSnackbar()` with i18n fallback | ✅ Consistent |
| API client | Centralized axios wrapper via `@universo/auth-frontend` createAuthClient | ✅ Correct |
| Pagination | Offset-based (limit/offset) via `usePaginated()` | ✅ Consistent |
| Backend security: RLS | `getRequestDbExecutor()` enforces request-scoped RLS executor | ✅ Secure |
| Backend security: Input validation | Zod schemas with `.strict()` on all request bodies | ✅ Secure |
| Backend security: SQL injection | All queries parameterized ($1, $2), schema names quoted | ✅ Secure |
| Backend security: Authorization | `ensureMetahubAccess()` before all handlers with role permissions | ✅ Secure |
| Template/preset system | Correctly described: template → preset → default instance flow | ✅ Accurate |
| MetahubCreateOptionsTab | Correctly reads template presets, renders toggles, sends presetToggles | ✅ Accurate |

### 10-Point Spec Compliance Check

| # | Spec Requirement | Plan Coverage | Gap? |
|---|-----------------|---------------|------|
| 1 | Remove old types, rename V2 → base, kind keys direct | Already DONE (Phases A–M) | None |
| 2 | Remove Documents built-in type | Already DONE | None |
| 3 | Remove "Source" column | Already DONE | None |
| 4 | Shared components, no code duplication | Phase 6 (corrected) | None |
| 5 | Entity type selection when creating metahubs | Already DONE (preset toggles) | None |
| 6 | Parameters tab linked to templates | Already DONE (MetahubCreateOptionsTab) | None |
| 7 | Default instances with VLC names | Already DONE (TemplateSeedExecutor + preset manifests) | None |
| 8 | Full-cycle Playwright verification | Phase 9 | None |
| 9 | Regenerate fixture files | Phase 10 | None |
| 10 | Documentation rewrite EN/RU with screenshots | Phase 11 | None |

### Architecture Assessment

**Existing patterns are sound.** The codebase uses:
- **Behavior registry + capabilities** — clean Strategy pattern for standard-kind-specific logic
- **Entity-owned routes** — single entry point with kind dispatch, not separate route trees
- **Template/preset manifests** — declarative configuration, seed executor in transaction
- **Optimistic CRUD with rollback** — comprehensive TanStack Query v5 pattern
- **RLS + Zod + parameterized SQL** — defense in depth for security

**No architectural changes needed.** The plan correctly preserves all existing patterns and focuses on debt reduction (naming, duplication, test coverage).

### Recommendations (Non-Blocking)

1. **TanStack Query v5 `queryOptions()` factory** — The codebase could benefit from the v5 `queryOptions()` API for better type inference, but this is a style improvement, not required for this plan.
2. **Code splitting** — No React.lazy() in standard/ subtree. Could be added for route-level splitting, but not critical for functionality.
3. **`createEntityActions()` factory** — `@universo/template-mui` exports this factory but standard Lists don't use it. Phase 6.4 recommends adopting it for consistency with MetahubActions.tsx.
4. **Optimistic feedback inconsistency** — `revealPendingEntityFeedback()` is used by some lists but not all. Phase 6.5 should ensure consistent usage.
