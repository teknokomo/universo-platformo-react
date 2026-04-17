# Entity-First Final Migration Plan — Complete Legacy Elimination

> **Created**: 2026-04-14  
> **Status**: Plan — finalized after strict neutral-seam QA rewrite  
> **Complexity**: Level 4 — Major/Complex (multi-package refactoring + new features + deep testing + docs)  
> **Branch**: `feature/entity-first-final-migration`  
> **Prerequisite**: Clean `main` with green `pnpm build`  
> **Creative design**: [creative-entity-first-architecture-v2.md](../creative/creative-entity-first-architecture-v2.md)  
> **Prior plan (superseded)**: [legacy-removal-entity-promotion-plan-2026-04-13.md](legacy-removal-entity-promotion-plan-2026-04-13.md)

---

## Overview

Complete the transition to a **fully entity-first architecture** by:

1. **Removing ALL remaining legacy backend domain controllers/routes/services** (`hubs/`, `catalogs/`, `sets/`, `enumerations/`) and replacing the dispatch delegation pattern with a Behavior Service Registry
2. **Removing ALL frontend managed domain folders** (`managedCatalogs/`, `managedHubs/`, `managedSets/`, `managedEnumerations/`) and consolidating into entity-owned renderers with a unified API layer
3. **Consolidating child-resource routes** (attributes, constants, elements) to entity-only path shapes (no legacy URL shapes)
4. **Implementing preset-driven metahub create options** with dynamic toggles and default instances
5. **Building deep test coverage** (Jest/Vitest/Playwright) with actual screenshot verification
6. **Regenerating all Playwright product fixtures** and self-hosted snapshot files
7. **Completely rewriting EN/RU GitBook documentation** with fresh Playwright screenshots

**Key constraints from the user**:
- No legacy code preservation required — test DB will be wiped and recreated
- No schema/template version bumps needed
- Architecture can be significantly changed, serious refactoring is permitted
- All remaining legacy code must be fully removed, NOT wrapped or hidden
- All UI text must be internationalized (EN + RU)
- Use UUID v7, TanStack Query, modern patterns

## Non-Negotiable End-State Constraints

- Final metadata authoring code must live under entity-owned seams. `managed*` folders are transitional-only and must be deleted. The final merged state must not keep permanent top-level metadata authoring folders outside `domains/entities/**` just because they were safer for migration.
- Top-level child-resource folders such as `attributes/`, `constants/`, `elements/`, and `enumerationValues/` may exist only as temporary migration seams. By acceptance, metahub metadata authoring for those capabilities must either live under `domains/entities/**` or be proven generic cross-feature capability code that no longer exposes the old metadata model through package structure, public exports, route ownership, or test truth surfaces.
- Final merged code must not introduce new permanent business-named frontend/backend seams such as `Managed*Surface`, `Catalog*Renderer`, `Hub*Renderer`, `CatalogBehaviorService`, `HubBehaviorService`, etc. Kind keys like `catalog` and `hub` remain valid as data/config values, but folder/file/class naming should stay entity-owned and neutral.
- Standard kinds are no longer treated as built-in/system-managed in UI behavior. No `isSystemManagedEntityType`, built-in-only row styling, built-in-only delete messaging, or edit/copy/open-instance gating may remain just because a type uses a standard kind key.
- Reuse existing shared primitives where possible instead of inventing parallel shells: `EntityFormDialog`, `DynamicEntityFormDialog`, `ConfirmDeleteDialog`, `ConflictResolutionDialog`, `FlowListTable`, `ToolbarControls`, `PaginationControls`, `GeneralTabFields`, and existing query invalidation helpers.
- The metahub-specific entity model must not expose or seed `document` as a standard metadata kind. Any remaining `document` traces in metahub presets, fixtures, selectors, menus, or tests must be explicitly audited and removed.

---

## Current State Assessment (As of 2026-04-14)

### What is ALREADY in final entity-owned state:
| Area | Status |
|------|--------|
| Frontend route tree | Entity-owned: `/entities/:kindKey/instances`, child-resource paths |
| Backend router | No top-level legacy route mounts (`createHubsRoutes` etc. not mounted) |
| Entity type presets | Direct kindKeys (`catalog`, `hub`, `set`, `enumeration`) |
| Sidebar menu | Fully dynamic, entity-type-driven, no hardcoded standard kinds |
| Settings namespace | `entity.<kind>.*` |
| Kind keys | Direct (`catalog` not `custom.catalog-v2`) |
| `isBuiltin` / `source` | Removed from shared types; `isBuiltinMetahubObjectKind()` still in `MetahubObjectsService.ts` (3 internal uses — table-name resolution + ACL mapping) |
| Schema-DDL | Uses `managedStandardKinds.ts` (direct kind resolution) |
| Snapshot serializer | No `isBuiltin`, all entity types stored identically |
| Template presets | `defaultInstances` with VLC name/description |
| Breadcrumbs | Entity-owned href targets |
| OpenAPI docs | Entity-owned routes as canonical, legacy tags downgraded |

### What MUST be eliminated:
| Area | Current Problem |
|------|----------------|
| Backend `hubs/` folder | Full controller+service+routes still exist, imported by `entityInstancesRoutes.ts` dispatcher |
| Backend `catalogs/` folder | Same — `createCatalogsController` imported and delegated to |
| Backend `sets/` folder | Same |
| Backend `enumerations/` folder | Same |
| `entityInstancesRoutes.ts` dispatch layer | `dispatchEntityRoute()` to legacy controllers instead of unified entity controller |
| Frontend `managedCatalogs/` | Separate API clients, hooks, UI components |
| Frontend `managedHubs/` | Separate API clients, hooks, UI — `HubList.tsx` ~1400 lines |
| Frontend `managedSets/` | Separate API clients, hooks, UI |
| Frontend `managedEnumerations/` | Separate API clients, hooks, UI |
| `ManagedStandardKindSurfaces.tsx` | Thin wrappers: `ManagedCatalogEntitySurface = () => <LinkedCollectionListContent />` |
| Child-resource dual paths | `attributesRoutes.ts` etc. mount 4 URL shapes per operation (2 legacy + 2 entity-owned) |
| Dual query key trees | Legacy per-kind trees (`hubs()`, `catalogs()`) coexist with entity tree |
| Metahub create dialog | Preset-driven toggles already implemented; verify and clean up legacy `createHub`/`createCatalog` field refs in AGENTS.md and plan docs |
| `isBuiltinMetahubObjectKind()` | Private helper in `MetahubObjectsService.ts` — used for table name resolution + ACL mapping; must be replaced by behavior registry or entity-type metadata |
| `legacyBuiltinObjectCompatibility.ts` | File in `entities/services/` with useful delete/reorder patterns; name contradicts legacy-free requirement |
| `OptionValueList.tsx` (1474 lines) | Embedded inside `managedEnumerations/` — no dedicated child-resource domain (unlike attributes/constants/elements) |
| `general/` domain (GeneralPage.tsx) | Live production page importing from `managedEnumerations/` — will break when managed* deleted |
| `layout/` (singular) dead folder | Empty `api/` + `ui/` subfolders — dead code distinct from live `layouts/` |
| `managedMetadataRoutePaths.ts` (112 lines) | Dual-mode URL builders (legacy + entity) in `shared/` — frontend cleanup needed |
| `constants-library` preset | 5th preset (set-derived) not covered in testing scope |
| Cross-module managed* / route-path consumers | Repository evidence already includes components, tests, exports, and helper hooks outside the original 12-file estimate; cleanup must be grep-driven, not tied to a stale fixed count |
| `MetahubObjectsService` business wrappers | `createCatalog()`, `createSet()`, `createEnumeration()` still preserve business-named backend seams after generic object creation already exists |
| Legacy truth surfaces | package exports/tests, optimistic mutation tests, and stale i18n blocks still encode `Managed*` or legacy create-hook contracts |
| E2E tests | Multiple specs reference legacy patterns, legacy V2 kind keys |
| Fixtures | May contain stale legacy compatibility data |
| Documentation | Describes coexistence architecture, needs full rewrite |

---

## Table of Contents

1. [Phase 1: Backend — Behavior Registry & Capability Extraction](#phase-1)
2. [Phase 2: Backend — Entity Controller Unification](#phase-2)
3. [Phase 3: Backend — Legacy Domain Deletion + Child Route Consolidation](#phase-3)
4. [Phase 4: Frontend — Unified API & Hooks Consolidation](#phase-4)
5. [Phase 5: Frontend — Renderer Registry Migration & Managed Folder Deletion](#phase-5)
6. [Phase 6: Frontend — Sidebar, Breadcrumbs & Route Finalization](#phase-6)
7. [Phase 7: Metahub Create Dialog — Preset-Driven Options](#phase-7)
8. [Phase 8: Template Seed System — Default Instance Enhancement](#phase-8)
9. [Phase 9: Schema-DDL & Runtime Finalization](#phase-9)
10. [Phase 10: i18n Updates](#phase-10)
11. [Phase 11: Unit & Integration Tests (Jest/Vitest)](#phase-11)
12. [Phase 12: E2E Playwright Tests & Screenshot Verification](#phase-12)
13. [Phase 13: Fixture Regeneration](#phase-13)
14. [Phase 14: Documentation Rewrite (EN/RU GitBook)](#phase-14)
15. [Phase 15: Final Validation & Memory Bank Sync](#phase-15)

> **Phase ordering rationale**: Backend behavior extraction (Phases 1-3) comes first because it's the riskiest change and foundation for everything else. Frontend migration (Phases 4-6) depends on unified backend API being stable. Create dialog/seed (Phases 7-8) is additive. Testing (Phases 11-12) runs throughout but has dedicated phases for comprehensive coverage. Documentation (Phase 14) comes last since it needs stable UI for screenshots.

---

## Phase 1: Backend — Behavior Registry & Capability Extraction {#phase-1}

> **Goal**: Extract kind-specific domain logic from legacy controllers into standalone behavior services BEFORE touching routes or deleting legacy folders. This ensures no logic is lost during deletion.

### Step 1.1: Rename legacyBuiltinObjectCompatibility.ts → entityDeletePatterns.ts

**Rename**: `packages/metahubs-backend/base/src/domains/entities/services/legacyBuiltinObjectCompatibility.ts` → `entityDeletePatterns.ts`

This file exports genuinely useful delete/reorder patterns (`executeBlockedDelete`, `executeHubScopedDelete`, `executeLegacyReorder`) currently used by `entityInstancesController`. Rename types too:
- `LegacyBuiltinDeleteOutcome` → `EntityDeleteOutcome`
- `LegacyBuiltinReorderOutcome` → `EntityReorderOutcome`
- `ExecuteHubScopedDeleteParams` → keep (already generic)
- `executeLegacyReorder` → `executeEntityReorder`

Update the single import in `entityInstancesController.ts` to use the new path/names.

**Why first**: Behavior services (Steps 1.4-1.7) will delegate delete logic to these utilities, so they need stable names before extraction begins.

### Step 1.2: Create EntityBehaviorService interface

**New file**: `packages/metahubs-backend/base/src/domains/entities/services/EntityBehaviorService.ts`

```typescript
import type { SqlQueryable } from '@universo/utils'
import type { ResolvedEntityType } from '@universo/types'

export interface BlockingReferencesResult {
  items: Array<{ id: string; name: unknown; kind: string; targetKind?: string }>
  totalBlocking: number
  canDelete: boolean
}

export interface EntityBehaviorService {
  readonly kindKey: string

  // ACL entity type mapping (replaces isBuiltinMetahubObjectKind in MetahubObjectsService)
  readonly aclEntityType?: string

  // Pre/Post CRUD hooks
  validateCreate?(payload: Record<string, unknown>, entityType: ResolvedEntityType): string | null
  afterCreate?(entityId: string, payload: Record<string, unknown>, db: SqlQueryable): Promise<void>
  validateUpdate?(entityId: string, payload: Record<string, unknown>, entityType: ResolvedEntityType): string | null
  beforeDelete?(entityId: string, db: SqlQueryable): Promise<{ blocked: boolean; reason?: string }>
  afterDelete?(entityId: string, db: SqlQueryable): Promise<void>
  afterCopy?(sourceId: string, targetId: string, payload: Record<string, unknown>, db: SqlQueryable): Promise<void>

  // Blocking references for delete confirmation
  getBlockingReferences?(entityId: string, db: SqlQueryable): Promise<BlockingReferencesResult>

  // Table name generation override (replaces isBuiltinMetahubObjectKind table logic)
  resolveGeneratedTableName?(metahubPrefix: string): string | null
}
```

> **Note**: `aclEntityType` and `resolveGeneratedTableName` replace the private `isBuiltinMetahubObjectKind()` function in `MetahubObjectsService.ts`. Each standard-kind behavior service sets `aclEntityType` to its kind key (e.g. `'catalog'`); custom kinds default to `'entity'`. This eliminates the last production `isBuiltin` check (see QA finding H1/M4).

### Step 1.3: Create behavior registry

**New file**: `packages/metahubs-backend/base/src/domains/entities/services/behaviorRegistry.ts`

```typescript
const behaviorServices = new Map<string, EntityBehaviorService>()

export function registerBehavior(service: EntityBehaviorService): void {
  behaviorServices.set(service.kindKey, service)
}

export function getBehaviorService(kindKey: string): EntityBehaviorService | null {
  return behaviorServices.get(kindKey) ?? null
}
```

### Step 1.4: Extract neutral standard-kind capabilities

**New directory**: `packages/metahubs-backend/base/src/domains/entities/services/standardKindCapabilities/`

Extract legacy domain logic into neutral capability helpers instead of permanent per-kind service classes. The final merged state must not ship `HubBehaviorService`, `CatalogBehaviorService`, `SetBehaviorService`, or `EnumerationBehaviorService` as the architecture surface.

Suggested capability-oriented modules:
- `hierarchyCapability.ts` — tree CRUD, cycle detection, parent assignment, child listing, reorder logic
- `referenceCapability.ts` — blocking-reference queries, delete-precheck logic, after-delete cleanup
- `assignmentCapability.ts` — hub assignment, widget binding, copy-time relationship remap
- `metadataCapability.ts` — ACL mapping and generated-table-name resolution

These modules remain private helpers under `domains/entities/services/**`; kind-specific differences are expressed as config/registration entries, not exported business-named classes.

### Step 1.5: Assemble standard-kind registrations inside the entity registry

**New file**: `packages/metahubs-backend/base/src/domains/entities/services/standardKindBehaviorRegistry.ts`

Register `catalog`, `hub`, `set`, and `enumeration` behavior through neutral `EntityBehaviorService` objects keyed by `kindKey`:

```typescript
registerBehavior({
  kindKey: 'hub',
  aclEntityType: 'hub',
  beforeDelete: createReferencePrecheck({ kindKey: 'hub' }),
  afterDelete: createReferenceCleanup({ kindKey: 'hub' }),
  afterCreate: createHierarchyAssignment({ kindKey: 'hub' }),
  getBlockingReferences: createBlockingReferenceResolver({ kindKey: 'hub' }),
  resolveGeneratedTableName: createGeneratedTableResolver({ kindKey: 'hub' })
})
```

Requirements:
- Keep kind keys only as registration data, not as permanent class/file ownership.
- If a temporary extraction helper still needs legacy source names during the migration, mark it transitional and delete/collapse it before the final merge.
- Shared capability helpers must be reusable by both standard and future custom kinds where technically valid.

### Step 1.6: Write focused registry/capability tests

**New test files**:
- `packages/metahubs-backend/base/src/tests/services/behaviorRegistry.test.ts`
- `packages/metahubs-backend/base/src/tests/services/standardKindCapabilities.test.ts`

Each test validates:
- Registry resolution returns the expected behavior object for each standard kind
- Capability helpers cover blocking references, pre-delete checks, after-delete cleanup, and generated-table/ACL mapping
- Hierarchy capability covers cycle detection, parent assignment, move operations, and child listing

### Step 1.7: Keep transitional extraction seams explicitly temporary

If the safest migration path temporarily introduces kind-specific extraction files while pulling logic out of legacy folders, the plan requires collapsing them into the neutral registry/capability structure before Phase 3 completes. No business-named behavior service files survive as final architecture.

### Checklist — Phase 1:
- [ ] 1.1: Rename `legacyBuiltinObjectCompatibility.ts` → `entityDeletePatterns.ts`, rename types, update imports
- [ ] 1.2: Create EntityBehaviorService interface (with `aclEntityType` + `resolveGeneratedTableName`)
- [ ] 1.3: Create behavior registry
- [ ] 1.4: Extract neutral standard-kind capability helpers from legacy domains
- [ ] 1.5: Assemble standard-kind registrations in the entity registry
- [ ] 1.6: Write focused registry/capability tests
- [ ] 1.7: Collapse any transitional kind-specific extraction seams before legacy deletion
- [ ] Build: `pnpm --filter metahubs-backend build`
- [ ] Test: `pnpm --filter metahubs-backend test`

---

## Phase 2: Backend — Entity Controller Unification {#phase-2}

> **Goal**: Modify `entityInstancesController` to use behavior service hooks instead of delegation. Remove dispatch pattern from `entityInstancesRoutes.ts`.

### Step 2.1: Expand entityInstancesController with behavior hooks

**File**: `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`

Modify the controller factory to accept `resolveBehavior` function. For each CRUD operation:
- `create`: Call `behavior.validateCreate()` before insert, `behavior.afterCreate()` after insert
- `update`: Call `behavior.validateUpdate()` before update
- `delete`: Call `behavior.beforeDelete()` before soft-delete, `behavior.afterDelete()` after
- `copy`: Call `behavior.afterCopy()` after copy
- Add `getBlockingReferences` handler that delegates to behavior service

```typescript
export function createEntityInstancesController(
  createHandler: MetahubHandlerFactory,
  resolveBehavior: (kindKey: string) => EntityBehaviorService | null
) {
  return {
    create: createHandler(async (req, res, { metahub, userId, db }) => {
      const payload = parseCreatePayload(req.body)
      const entityType = await resolveEntityType(metahub.id, payload.kind, userId)
      await ensureMetahubAccess(req, resolveManagedAclPermission(payload.kind, 'create'))

      const behavior = resolveBehavior(payload.kind)
      if (behavior?.validateCreate) {
        const error = behavior.validateCreate(payload, entityType)
        if (error) throw new MetahubValidationError(error)
      }

      const entityId = await objectsService.create(db, { ...payload, metahubId: metahub.id, userId })

      if (behavior?.afterCreate) {
        await behavior.afterCreate(entityId, payload, db)
      }

      await entityEventRouter.emit('afterCreate', { entityId, kind: payload.kind, metahubId: metahub.id }, db)
      const entity = await objectsService.findById(db, metahub.id, entityId)
      res.status(201).json(entity)
    }),
    // ... similar pattern for update, delete, copy, restore, permanentRemove
  }
}
```

### Step 2.2: Add hierarchy-specific sub-route handlers

Hub children routes (`/instance/:hubId/hubs`, `/instance/:hubId/catalogs`, etc.) need dedicated handlers that delegate to the registry-resolved hierarchy capability, not to a permanent `HubBehaviorService` class:

```typescript
listHubChildren: (childKind: string) => createHandler(async (req, res, { metahub, db }) => {
  const { hubId } = req.params
  const hubBehavior = getBehaviorService('hub')
  const result = await hubBehavior?.listChildrenByKind?.(metahub.id, hubId, childKind, parseListParams(req.query), db)
  res.json(result)
})
```

### Step 2.3: Simplify entityInstancesRoutes.ts

**File**: `packages/metahubs-backend/base/src/domains/entities/routes/entityInstancesRoutes.ts`

- Remove ALL imports from `../../hubs/controllers/`, `../../catalogs/controllers/`, `../../sets/controllers/`, `../../enumerations/controllers/`
- Remove `dispatchEntityRoute()` function
- Remove `ManagedEntityKind` type
- Remove `MANAGED_ENTITY_PARAM_BY_KIND` mapping
- Wire routes directly to unified controller with behavior hooks
- Keep hub-specific child routes as explicit route registrations

```typescript
// AFTER (clean)
export function createEntityInstancesRoutes(...): Router {
  initializeBehaviorRegistry(objectsService, hubsService, settingsService)
  const ctrl = createEntityInstancesController(createHandler, getBehaviorService)

  // Instance CRUD — unified for ALL kinds
  router.get('/metahub/:metahubId/entities/:kindKey/instances', readLimiter, asyncHandler(ctrl.list))
  router.post('/metahub/:metahubId/entities/:kindKey/instances', writeLimiter, asyncHandler(ctrl.create))
  // ... all CRUD routes ...

  // Hub child-resource routes
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/hubs', readLimiter, asyncHandler(ctrl.listHubChildren('hub')))
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalogs', readLimiter, asyncHandler(ctrl.listHubChildren('catalog')))
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/sets', readLimiter, asyncHandler(ctrl.listHubChildren('set')))
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/enumerations', readLimiter, asyncHandler(ctrl.listHubChildren('enumeration')))

  // Blocking references
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references', readLimiter, asyncHandler(ctrl.getBlockingReferences))

  return router
}
```

### Step 2.4: Update entityInstancesRoutes tests

**File**: `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts`

Update test suite to:
- Test all CRUD for each standard kind (`catalog`, `hub`, `set`, `enumeration`) through unified endpoint
- Test behavior hooks are called (blocking references, pre-delete checks)
- Test hub-specific children routes
- Test custom kinds fall through to generic behavior (no behavior service)
- Remove any tests that assert dispatch to legacy controllers

### Step 2.5: Eliminate isBuiltinMetahubObjectKind from MetahubObjectsService

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`

Remove the private `isBuiltinMetahubObjectKind()` function and its `BUILTIN_METAHUB_OBJECT_KINDS` constant. Replace its 3 internal usages:

1. **Line 134** (`resolveGeneratedTableName`): Replace with `getBehaviorService(kind)?.resolveGeneratedTableName(prefix) ?? null`. The `catalog` registry entry resolves the virtual attribute table name; other standard kinds return `null`.
2. **Line 486** (`toObject` → `entityType` ACL mapping): Replace with `getBehaviorService(kind)?.aclEntityType ?? 'entity'`. Each standard-kind behavior service sets `aclEntityType` to its kind key.

This eliminates the last production `isBuiltin` branching, completing the entity-first architecture for the backend.

### Step 2.6: Remove business-named object wrappers from MetahubObjectsService

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`

After the route/controller cutover no permanent backend API should still advertise business-shaped wrappers such as `createCatalog()`, `createSet()`, or `createEnumeration()` when `createObject()` already provides the generic implementation.

Requirements:
- Delete or inline `createCatalog()`, `createSet()`, and `createEnumeration()` wrappers once no caller depends on them.
- Keep one generic object creation/update/delete surface and let kind-specific behavior live in the entity behavior registry.
- Update focused backend tests so they assert generic object/entity seams rather than wrapper method names.

### Checklist — Phase 2:
- [ ] 2.1: Expand entityInstancesController with behavior hooks
- [ ] 2.2: Add hub-specific sub-route handlers
- [ ] 2.3: Simplify entityInstancesRoutes.ts (remove dispatch + legacy imports)
- [ ] 2.4: Update entityInstancesRoutes tests
- [ ] 2.5: Eliminate `isBuiltinMetahubObjectKind` from `MetahubObjectsService` (replace with behavior registry queries)
- [ ] 2.6: Remove business-named `MetahubObjectsService` wrappers after cutover
- [ ] Build: `pnpm --filter metahubs-backend build`
- [ ] Test: `pnpm --filter metahubs-backend test`

---

## Phase 3: Backend — Legacy Domain Deletion + Child Route Consolidation {#phase-3}

> **Goal**: Delete legacy backend domain folders. Consolidate child-resource routes to entity-only paths. Safe because dispatch is already replaced by behavior services (Phase 2).

### Step 3.1: Delete legacy backend domain directories

```
packages/metahubs-backend/base/src/domains/hubs/           ← DELETE
packages/metahubs-backend/base/src/domains/catalogs/       ← DELETE
packages/metahubs-backend/base/src/domains/sets/           ← DELETE
packages/metahubs-backend/base/src/domains/enumerations/   ← DELETE
```

**Pre-deletion audit**: Before deleting, verify every exported function is either:
- Now covered by a behavior service (Phase 1)
- Used only internally within the legacy folder (safe to delete)
- A shared utility already available in `shared/` or `entities/services/`

### Step 3.2: Clean up router.ts

**File**: `packages/metahubs-backend/base/src/domains/router.ts`

Remove any stale imports from deleted folders. Verify only entity-owned routes remain.

### Step 3.3: Consolidate child-resource routes to entity-only paths

**Files**:
- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/constants/routes/constantsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts`

Remove legacy path shapes (① and ②), keep only entity-owned paths (③ and ④):

```typescript
// BEFORE (4 shapes):
const catalogPaths = (suffix: string) => [
  `/metahub/:metahubId/hub/:hubId/catalog/:catalogId/${suffix}`,                           // ① legacy hub-scoped
  `/metahub/:metahubId/catalog/:catalogId/${suffix}`,                                       // ② legacy top-level
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,     // ③ entity hub-scoped
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`                      // ④ entity top-level
]

// AFTER (2 shapes):
const catalogPaths = (suffix: string) => [
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`
]
```

Similarly for `setPaths`, `enumerationPaths`, and `elementPaths`.

### Step 3.4: Delete legacy test files

Delete test files that test removed controllers/routes:
- `hubsRoutes.test.ts`
- `catalogsRoutes.test.ts`
- `setsRoutes.test.ts`
- `enumerationsRoutes.test.ts`
- Any legacy controller/service unit tests in deleted folders

### Step 3.5: Remove legacy compatibility utilities

Delete if still present:
- `packages/metahubs-backend/base/src/domains/shared/legacyCompatibility.ts`
- Any `*Compatibility.ts` service files
- `resolveLegacyCompatible*()` functions in `shared/`

### Step 3.6: Verify no dangling imports

Run `pnpm --filter metahubs-backend build` and fix all import errors caused by deleted files.

### Checklist — Phase 3:
- [ ] 3.1: Delete 4 legacy backend domain directories
- [ ] 3.2: Clean up router.ts
- [ ] 3.3: Consolidate child-resource routes to entity-only paths
- [ ] 3.4: Delete legacy test files
- [ ] 3.5: Remove legacy compatibility utilities
- [ ] 3.6: Verify no dangling imports
- [ ] Build: `pnpm --filter metahubs-backend build`
- [ ] Test: `pnpm --filter metahubs-backend test`

---

## Phase 4: Frontend — Unified API & Hooks Consolidation {#phase-4}

> **Goal**: Consolidate ALL entity data access into `entities/api/entityInstances.ts` and `entities/hooks/`. Remove legacy per-kind API modules and hook files. This MUST happen before deleting managed* folders (Phase 5).

### Step 4.1: Expand unified entity API client

**File**: `packages/metahubs-frontend/base/src/domains/entities/api/entityInstances.ts`

Add kind-specific sub-resource endpoints currently spread across managed* API files:
- `listHubChildren(metahubId, hubId, childKind, params)` — catalogs/sets/enums under a hub
- `createHubChild(metahubId, hubId, childKind, data)` — create child under a hub
- `getBlockingReferences(metahubId, kindKey, entityId)` — delete confirmation
- `reorderInstances(metahubId, kindKey, ids)` — drag-and-drop reorder
- `moveHub(metahubId, hubId, newParentId)` — hub hierarchy operations

ALL using entity-owned URL patterns:
```typescript
// Hub children
export const listHubChildren = (metahubId: string, hubId: string, childKind: string, params?: PaginationParams) =>
  apiClient.get(`/metahub/${metahubId}/entities/hub/instance/${hubId}/${childKind}s`, { params })
```

### Step 4.2: Expand unified hooks

**File**: `packages/metahubs-frontend/base/src/domains/entities/hooks/queries.ts`

Consolidate ALL per-kind query hooks into universal ones:

```typescript
// Universal — works for ANY entity kind
export function useEntityInstancesQuery(metahubId: string | undefined, kindKey: string, params?: PaginationParams) {
  return useQuery({
    queryKey: metahubsQueryKeys.instancesList(metahubId!, kindKey, params),
    queryFn: () => listEntityInstances(metahubId!, { kind: kindKey, ...params }),
    enabled: Boolean(metahubId && kindKey)
  })
}

// Hub children hook
export function useHubChildrenQuery(metahubId: string | undefined, hubId: string | undefined, childKind: string, params?: PaginationParams) {
  return useQuery({
    queryKey: metahubsQueryKeys.instanceChildren(metahubId!, 'hub', hubId!, childKind, params),
    queryFn: () => listHubChildren(metahubId!, hubId!, childKind, params),
    enabled: Boolean(metahubId && hubId && childKind)
  })
}
```

**File**: `packages/metahubs-frontend/base/src/domains/entities/hooks/mutations.ts`

Consolidate ALL per-kind mutation hooks:

```typescript
export function useCreateEntityInstance(metahubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: EntityInstancePayload) => createEntityInstance(metahubId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.instances(metahubId, variables.kind) })
    }
  })
}

// Similar for update, delete, copy, restore, reorder
```

### Step 4.3: Unify query key tree

**File**: `packages/metahubs-frontend/base/src/domains/shared/queryKeys.ts`

Replace dual tree with single entity-scoped tree (as designed in creative document Section F):

- Remove legacy per-kind trees: `hubs()`, `hubsList()`, `hubDetail()`, `catalogs()`, etc.
- Remove `normalizeLegacyCompatibleScope()`, `normalizeLegacyCompatibleKindKey()`
- Unified pattern: `instances(metahubId, kindKey)` → `instancesList(...)` → `instanceDetail(...)`
- Add: `instanceChildren(metahubId, parentKindKey, parentId, childKindKey)`
- Add: `blockingReferences(metahubId, kindKey, instanceId)`

### Step 4.4: Absorb externally-used managed* API functions into unified API

Before managed* folders can be deleted (Phase 5), all API functions used by **external** domains (attributes/, constants/, elements/, layouts/, general/) must be available from unified sources. This is the critical step that prevents build failures.

**Functions to absorb into `entities/api/entityInstances.ts`**:

| Function | Source | External consumers |
|---|---|---|
| `listEnumerationValues()` | `managedEnumerations/api` | `AttributeFormFields.tsx`, `ElementList.tsx`, `useElementListData.ts` |
| `getCatalogById()` | `managedCatalogs/api` | `useAttributeListData.ts`, `useElementListData.ts` |
| `getSetById()` | `managedSets/api` | `useConstantListData.ts` |

These become `getEntityInstanceById(metahubId, kindKey, instanceId)` in the unified API (the existing `getCatalogById`/`getSetById` are just GET calls to `/entities/:kindKey/instance/:id`). `listEnumerationValues` becomes `listEntityChildResources(metahubId, kindKey, instanceId, 'values', params)`.

**Hooks to absorb into `entities/hooks/`**:

| Hook | Source | External consumers |
|---|---|---|
| `useMetahubTrees()` | `managedHubs/hooks` | `useAttributeListData.ts`, `useConstantListData.ts`, `useElementListData.ts`, `EntityInstanceList.tsx`, `MenuWidgetEditorDialog.tsx`, `OptionValueList.tsx` |
| `useUpdateCatalogAtMetahub()` | `managedCatalogs/hooks/mutations` | `AttributeList.tsx`, `ElementList.tsx` |
| `useUpdateSetAtMetahub()` | `managedSets/hooks/mutations` | `ConstantList.tsx` |

`useMetahubTrees` becomes `useEntityInstances(metahubId, 'hub', { limit: 1000, sortBy: 'sortOrder' })` which returns the same `Hub[]` data. `useUpdateCatalogAtMetahub` → `useUpdateEntityInstance('catalog')`.

### Step 4.5: Rewrite all cross-module imports and legacy use-sites via grep-driven inventory

Do not rely on the earlier fixed estimate of 37 imports in 12 files. Current repository evidence already shows additional consumers in shared components, tests, exports, and route helpers. The migration must finish with a grep-driven inventory that leaves no live `managed*` or `managedMetadataRoutePaths` consumers outside transitional files being deleted in the same phase.

After Step 4.4 provides unified replacements, update all import paths:

| File | Old import | New import |
|---|---|---|
| `attributes/ui/AttributeFormFields.tsx` | `../../managedEnumerations/api` | `../../entities/api/entityInstances` |
| `attributes/ui/AttributeList.tsx` | `../../managedCatalogs/ui/CatalogActions` + `../../managedCatalogs/hooks/mutations` + `../../managedCatalogs/ui/catalogRoutePaths` | `../../entities/ui/shared/instanceActions` + `../../entities/hooks/mutations` + `../../shared/entityRoutePaths` |
| `attributes/hooks/useAttributeListData.ts` | `../../managedCatalogs` + `../../managedHubs/hooks` | `../../entities/api/entityInstances` + `../../entities/hooks/queries` |
| `constants/ui/ConstantList.tsx` | `../../managedSets/ui/SetActions` + `../../managedSets/hooks/mutations` | `../../entities/ui/shared/instanceActions` + `../../entities/hooks/mutations` |
| `constants/hooks/useConstantListData.ts` | `../../managedSets` + `../../managedHubs/hooks` | `../../entities/api/entityInstances` + `../../entities/hooks/queries` |
| `elements/ui/ElementList.tsx` | `../../managedCatalogs/ui/CatalogActions` + `../../managedCatalogs/hooks/mutations` + `../../managedCatalogs/ui/catalogRoutePaths` | `../../entities/ui/shared/instanceActions` + `../../entities/hooks/mutations` + `../../shared/entityRoutePaths` |
| `elements/hooks/useElementListData.ts` | `../../managedCatalogs` + `../../managedEnumerations/api` + `../../managedHubs/hooks` | `../../entities/api/entityInstances` + `../../entities/hooks/queries` |
| `layouts/ui/LayoutList.tsx` | `../../managedCatalogs/ui/catalogRoutePaths` | `../../shared/entityRoutePaths` |
| `layouts/ui/MenuWidgetEditorDialog.tsx` | `../../managedHubs/hooks` | `../../entities/hooks/queries` |
| `general/ui/GeneralPage.tsx` | `../../managedEnumerations/ui/OptionValueList` | `../../enumerationValues/ui/OptionValueList` (see Phase 5) |
| `entities/ui/EntityInstanceList.tsx` | `../../managedHubs/hooks` | `../hooks/queries` |
| `shared/__tests__/entityMetadataRoutePaths.test.ts` | `../../managedCatalogs/ui/catalogRoutePaths` | `../entityRoutePaths` |
| `components/HubDeleteDialog.tsx` | `../domains/shared/managedMetadataRoutePaths` | `../domains/shared/entityRoutePaths` |
| `components/SetDeleteDialog.tsx` | `../domains/shared/managedMetadataRoutePaths` | `../domains/shared/entityRoutePaths` |
| `components/EnumerationDeleteDialog.tsx` | `../domains/shared/managedMetadataRoutePaths` | `../domains/shared/entityRoutePaths` |
| `src/__tests__/exports.test.ts` | `ManagedStandardKindSurfaces` expectations | entity-owned exports only |
| `shared/__tests__/optimisticMutations.remaining.test.tsx` | `useCreateHub`, `useCreateSetAtMetahub`, `useCreateEnumerationAtMetahub` | unified entity mutation hooks or deleted test coverage |

### Step 4.6: Extract shared form utilities (CatalogActions, SetActions patterns)

`AttributeList.tsx` and `ElementList.tsx` import `CatalogActions` type + helpers (form building, validation). `ConstantList.tsx` imports `SetActions`. These contain shared form patterns for parent-entity editing within child-resource lists (e.g., editing the parent catalog's settings from within the attributes tab).

Create `entities/ui/shared/instanceActions.ts` — a generic parent-entity form builder that:
- Accepts entity kind and current instance data
- Builds form tabs, initial values, validation, payload conversion
- The existing `CatalogActions` and `SetActions` patterns are parameterized by kind

This replaces direct dependency on `managedCatalogs/ui/CatalogActions` and `managedSets/ui/SetActions`.

### Step 4.7: Consolidate route path builders

Create `shared/entityRoutePaths.ts` to replace:
- `managedCatalogs/ui/catalogRoutePaths.ts` (18 lines — `buildCatalogAuthoringPath`)
- `shared/managedMetadataRoutePaths.ts` (112 lines — `buildManagedHubAuthoringPath`, `buildManagedSetAuthoringPath`, `buildManagedEnumerationAuthoringPath`)

New unified function:
```typescript
export function buildEntityAuthoringPath(
  metahubId: string,
  kindKey: string,
  instanceId: string,
  tab?: string,
  parentHubId?: string
): string {
  const base = parentHubId
    ? `/metahub/${metahubId}/entities/${kindKey}/instance/${parentHubId}/${kindKey}/${instanceId}`
    : `/metahub/${metahubId}/entities/${kindKey}/instance/${instanceId}`
  return tab ? `${base}/${tab}` : base
}
```

Remove legacy URL pattern generation entirely — entity-owned paths only.

### Checklist — Phase 4:
- [ ] 4.1: Expand unified entity API client
- [ ] 4.2: Expand unified entity hooks (queries + mutations)
- [ ] 4.3: Unify query key tree (remove legacy per-kind trees)
- [ ] 4.4: Absorb externally-used managed* API functions into unified API/hooks
- [ ] 4.5: Complete grep-driven rewrite of all cross-module managed*/route-path consumers
- [ ] 4.6: Extract shared form utilities (`instanceActions.ts`)
- [ ] 4.7: Consolidate route path builders (`entityRoutePaths.ts`)
- [ ] Build: `pnpm --filter metahubs-frontend build`

---

## Phase 5: Frontend — Renderer Registry Migration, EnumerationValues Domain & Managed Folder Deletion {#phase-5}

> **Goal**: Create the `enumerationValues/` child-resource domain, migrate specialized list components from managed* folders into kind-agnostic renderers within `entities/ui/renderers/`, and delete all managed* folders plus dead code.
>
> **Important naming principle**: The user requires NO Catalog/Hub/Set/Enumeration domain-specific file names. Renderer files use **kind key** naming (lowercase, matching the `_mhb_entity_type_definitions.kind_key` column value). These are configuration identifiers, not domain concepts.
>
> **QA tightening**: Any temporary split kept for migration safety must be collapsed to a final neutral entity-owned folder structure before acceptance. Do not treat top-level `attributes/`, `constants/`, `elements/`, `enumerationValues/`, or per-kind renderer files as permanent architectural endpoints if they keep the old metadata model visible in the package structure.

### Step 5.1: Create `enumerationValues/` child-resource domain

**New directory**: `packages/metahubs-frontend/base/src/domains/enumerationValues/`

This parallels the existing `attributes/`, `constants/`, `elements/` child-resource domains. The `OptionValueList.tsx` (1474 lines) currently embedded in `managedEnumerations/ui/` is a true child-resource component (CRUD for values within an enumeration instance) — not an instance-level surface like `EnumerationList.tsx`.

**Migration mapping**:
```
managedEnumerations/ui/OptionValueList.tsx  → enumerationValues/ui/OptionValueList.tsx
managedEnumerations/api/ (value-specific parts)  → enumerationValues/api/enumerationValues.ts
managedEnumerations/hooks/ (value-specific parts) → enumerationValues/hooks/
```

**Refactoring during migration**:
- Replace imports from `../../managedHubs/hooks` → `../../entities/hooks/queries` (unified `useEntityInstances('hub', ...)`)
- Replace imports from `../hooks` (managedEnumerations internals) → local `./hooks` or `../../entities/hooks/`
- Replace settings hooks with entity-scoped settings

**Consumers to update**:
- `general/ui/GeneralPage.tsx`: Change import from `../../managedEnumerations/ui/OptionValueList` → `../../enumerationValues/ui/OptionValueList`

### Step 5.2: Create a neutral entity renderer registry

**New directory**: `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/`

**Final architecture uses entity-owned registry files**, not one permanent renderer file per business kind:
```
managedCatalogs/ui/CatalogList.tsx          → entities/ui/renderers/entityRendererRegistry.tsx
managedHubs/ui/HubList.tsx                  → entities/ui/renderers/standardKindPanels.tsx
managedSets/ui/SetList.tsx                  → entities/ui/renderers/standardKindPanels.tsx
managedEnumerations/ui/EnumerationList.tsx  → entities/ui/renderers/standardKindPanels.tsx
```

Requirements:
- Use kind keys only as registry/config entries inside `entityRendererRegistry.tsx`.
- Keep specialized UI behavior (hub tree view, catalog attribute panel, constants tab, enumeration values tab) but host it behind neutral entity-owned components/panels.
- Use ONLY the unified entity hooks from `entities/hooks/`.
- Use ONLY the unified entity API from `entities/api/entityInstances.ts`.
- Use child-resource components from `attributes/`, `constants/`, `elements/`, `enumerationValues/` — NO imports from managed* folders.
- Do not leave permanent public components named `CatalogKindRenderer`, `HubKindRenderer`, etc. in the merged tree.

### Step 5.3: Create GenericEntityRenderer

**New file**: `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/genericEntityRenderer.tsx`

For custom entity kinds that don't have specialized renderers. Uses fully generic entity list/create/edit/delete UI.

### Step 5.4: Move shared UI sub-components

Move to `entities/ui/shared/` any sub-components from managed* folders that are used by multiple registry entries or child-resource domains:
- `HubSelectionPanel.tsx` → `entities/ui/shared/hubSelectionPanel.tsx` (used by standard-kind registry entries for hub assignment)
- Delete confirmation sub-components (blocking reference dialog integration) — shared between entity-owned panels

**Note**: `CatalogActions.tsx` (~660 lines) and `SetActions.tsx` (~551 lines) are NOT used externally — they are only imported within their respective managed* `CatalogList.tsx` / `SetList.tsx`. Their logic is absorbed into neutral entity-owned shared helpers and registry-driven panels, not into permanent business-named renderer files.

### Step 5.5: Simplify EntityInstanceList to routing shell

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx`

Replace current delegation logic (~1400 lines) with a thin lazy-loaded registry shell:

```tsx
import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'

const EntityRendererRegistry = lazy(() => import('./renderers/entityRendererRegistry'))
const GenericRenderer = lazy(() => import('./renderers/genericEntityRenderer'))

export default function EntityInstanceList() {
  const { kindKey } = useParams<{ kindKey: string }>()
  const decoded = decodeURIComponent(kindKey ?? '')
  const Renderer = getEntityRenderer(decoded) ?? GenericRenderer
  return <Suspense fallback={<SkeletonGrid insetMode="content" />}><Renderer /></Suspense>
}
```

`getEntityRenderer(decoded)` resolves standard-kind registry entries from a neutral module. If an intermediate migration step still uses one file per kind while moving code, those files are temporary scaffolding and must be collapsed into the registry before Phase 6 completes.

### Step 5.6: Remove ManagedStandardKindSurfaces.tsx

Delete `ManagedStandardKindSurfaces.tsx` — no longer needed since renderers are loaded directly by EntityInstanceList.

### Step 5.7: Update GeneralPage.tsx import

**File**: `packages/metahubs-frontend/base/src/domains/general/ui/GeneralPage.tsx`

Verify the import updated in Step 5.1 works:
```typescript
// BEFORE: import { OptionValueListContent } from '../../managedEnumerations/ui/OptionValueList'
// AFTER:  import { OptionValueListContent } from '../../enumerationValues/ui/OptionValueList'
```

### Step 5.8: Delete managed* folders + dead code

```
packages/metahubs-frontend/base/src/domains/managedCatalogs/    ← DELETE
packages/metahubs-frontend/base/src/domains/managedHubs/        ← DELETE
packages/metahubs-frontend/base/src/domains/managedSets/        ← DELETE
packages/metahubs-frontend/base/src/domains/managedEnumerations/ ← DELETE
packages/metahubs-frontend/base/src/domains/layout/             ← DELETE (dead code: empty api/ + ui/ folders, distinct from live layouts/)
```

**Pre-deletion verification**: Run `pnpm --filter metahubs-frontend build` BEFORE deleting to confirm the full grep-driven Phase 4.5 inventory is already rewritten and `enumerationValues/` domain is wired.

### Step 5.9: Delete old shared route utilities

```
packages/metahubs-frontend/base/src/domains/shared/managedMetadataRoutePaths.ts ← DELETE (replaced by shared/entityRoutePaths.ts in Phase 4.7)
packages/metahubs-frontend/base/src/domains/shared/__tests__/entityMetadataRoutePaths.test.ts ← DELETE or rewrite for entityRoutePaths
```

### Step 5.10: Update package exports and imports

Update `packages/metahubs-frontend/base/src/index.ts` and all internal imports to reflect new locations.

### Step 5.11: Fix MainRoutes.tsx imports

**File**: `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`

Remove lazy imports for `ManagedCatalogEntitySurface`, `ManagedHubEntitySurface`, etc. The route tree should use `EntityInstanceList` as the sole entry for all entity kinds, loaded from `metahubs-frontend`.

### Step 5.12: Collapse child-resource domains into entity-owned capability folders by acceptance

The current top-level folders `attributes/`, `constants/`, `elements/`, and `enumerationValues/` can be tolerated only while migration is in progress. Before acceptance, move metahub metadata child-resource authoring under an entity-owned subtree or a clearly neutral capability subtree owned by entities.

Requirements:
- No metahub metadata route ownership should remain under top-level legacy-shaped domains once Phase 5/6 is complete.
- Reuse the existing shared primitives already proven across the codebase: `EntityFormDialog`, `ConfirmDeleteDialog`, `ConflictResolutionDialog`, `FlowListTable`, `ToolbarControls`, `PaginationControls`, and `GeneralTabFields`.
- Extract reusable sections from the current managed or child-resource screens before introducing any new UI shell. New wrappers/panels are justified only when existing primitives cannot express the needed behavior.
- Final package structure must make it obvious that attributes/constants/elements/values are entity capabilities, not separate first-class metadata modules parallel to entities.

### Checklist — Phase 5:
- [ ] 5.1: Create `enumerationValues/` child-resource domain (migrate OptionValueList.tsx, API, hooks)
- [ ] 5.2: Create neutral `entityRendererRegistry` and standard-kind registry panels
- [ ] 5.3: Create `genericEntityRenderer` for custom kinds
- [ ] 5.4: Move shared UI sub-components (hub selection panel etc.)
- [ ] 5.5: Simplify EntityInstanceList to lazy renderer shell
- [ ] 5.6: Delete ManagedStandardKindSurfaces.tsx
- [ ] 5.7: Update GeneralPage.tsx import to `enumerationValues/`
- [ ] 5.8: Pre-deletion build verification, then delete managed* folders + dead `layout/` folder
- [ ] 5.9: Delete old shared route utilities (`managedMetadataRoutePaths.ts`)
- [ ] 5.10: Update package exports
- [ ] 5.11: Fix MainRoutes.tsx imports
- [ ] 5.12: Collapse top-level child-resource folders into entity-owned capability folders before acceptance
- [ ] Build: `pnpm --filter metahubs-frontend build`

---

## Phase 6: Frontend — Sidebar, Breadcrumbs & Route Finalization {#phase-6}

> **Goal**: Clean up any remaining legacy patterns in sidebar, breadcrumbs, and route tree.

### Step 6.1: Verify sidebar is clean

**File**: `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

Verify:
- No hardcoded standard kind menu items remain
- `getMetahubMenuItems()` uses only `menuEntityTypes` parameter
- No `includeBuiltins` or `source` references

### Step 6.2: Clean breadcrumb legacy references

**File**: `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx`

- Remove any remaining `LEGACY_COMPATIBLE_ENTITY_LABEL_KEYS` mappings if stale
- Verify all breadcrumb paths use entity-owned URLs
- Remove any legacy URL pattern handlers (e.g. `/hub/:hubId`, `/catalog/:catalogId`)
- Entity breadcrumbs should resolve type name from VLC entity-type metadata

### Step 6.3: Finalize MainRoutes.tsx

**File**: `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`

- Remove any remaining legacy redirects if no longer needed
- Verify clean entity-only route tree
- Ensure hub child-resource paths are correctly nested under entity paths

### Step 6.4: Clean up EntitiesWorkspace

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`

- Remove any `source` / `isBuiltin` / `includeBuiltins` references
- Verify entity type list shows ALL types equally (no builtin/custom badge, no "Source" column)

### Step 6.5: Remove standard-kind special casing from entity type management

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`

Eliminate the remaining "system-managed/built-in standard kinds" behavior:
- Remove `isSystemManagedEntityType(kindKey) => isStandardEntityKind(kindKey)` and all derived `row.isSystemManaged` UI branching
- Remove action guards that block edit/copy/open-instances only because the kind is standard
- Remove built-in-only wording such as `Existing built-in types cannot be deleted`
- Remove built-in-only row styling/highlighting
- If any action still must be blocked, gate it by actual technical conditions (published dependencies, existing instances, permissions), not by standard kind membership

This aligns the UI with the product rule: standard kinds are now ordinary entity types that may be template-created, not built-in special cases.

### Step 6.6: Remove public Managed* surfaces and stale consumer contracts

**Files**:
- `packages/metahubs-frontend/base/src/index.ts`
- `packages/universo-template-mui/base/src/types/external-modules.d.ts`
- `packages/metahubs-frontend/base/README.md`

Explicitly remove public exports and consumer contracts that preserve the transitional surface model:
- Delete `ManagedHubEntitySurface`, `ManagedCatalogEntitySurface`, `ManagedSetEntitySurface`, `ManagedEnumerationEntitySurface` exports
- Remove their type declarations from external module typings
- Rewrite README integration examples and architecture text so they reference only entity-owned routes/components (`EntityInstanceList`, entity-owned child-resource routes) and not the removed managed surface names
- Remove stale four-tier/legacy wording that describes hubs/catalogs as first-class frontend modules rather than entity-owned metadata types

### Checklist — Phase 6:
- [ ] 6.1: Verify sidebar is clean
- [ ] 6.2: Clean breadcrumb legacy references
- [ ] 6.3: Finalize MainRoutes.tsx
- [ ] 6.4: Clean up EntitiesWorkspace
- [ ] 6.5: Remove standard-kind special casing (`isSystemManagedEntityType`, built-in messages, row styling, action gating)
- [ ] 6.6: Remove public `Managed*EntitySurface` exports/typings and stale README examples
- [ ] Build: `pnpm --filter universo-template-mui build && pnpm --filter universo-core-frontend build`

---

## Phase 7: Metahub Create Dialog — Verify & Cleanup {#phase-7}

> **Goal**: Verify existing preset-driven toggle implementation works correctly. Remove any remaining legacy field references.
>
> **Note (H4 fix)**: This feature is **already implemented** in the current codebase:
> - `MetahubCreateOptions.presetToggles?: Record<string, boolean>` exists in `universo-types` (line 1138)
> - `MetahubCreateOptionsTab` is fully implemented in `MetahubList.tsx` (lines 167-230+): reads template presets, resolves VLC labels, renders Switch toggles, initializes from `includedByDefault`, sends `presetToggles`
> - Backend `MetahubSchemaService` already handles `presetToggles`
>
> This phase is therefore **verification-only**, not "build new".

### Step 7.1: Verify existing implementation end-to-end

1. Confirm `MetahubCreateOptions.presetToggles` type is present and correct
2. Confirm `MetahubCreateOptionsTab` renders toggles from template presets
3. Confirm backend `filterSeedByCreateOptions` respects `presetToggles`
4. Manual or automated smoke test: create metahub with one preset disabled → verify that type not seeded

### Step 7.2: Remove legacy field references

Grep for and remove any remaining references to legacy boolean fields:
- `createHub`, `createCatalog`, `createSet`, `createEnumeration` — in types, controllers, docs
- These should NOT exist in active code; if found only in `AGENTS.md` or `memory-bank/`, clean up those references

### Step 7.3: Verify i18n completeness

Check that `metahubs.json` (EN + RU) has all required keys for the create options UI:
- `createOptions.alwaysIncluded`, `createOptions.entityTypes`, `createOptions.willCreateInstances_*`
- Add any missing keys

### Checklist — Phase 7:
- [ ] 7.1: Verify existing preset toggle implementation works end-to-end
- [ ] 7.2: Remove any remaining legacy `createHub`/`createCatalog`/`createSet`/`createEnumeration` field references
- [ ] 7.3: Verify i18n keys complete (EN + RU)
- [ ] Build: full `pnpm build`

---

## Phase 8: Template Seed System — Default Instance Enhancement {#phase-8}

> **Goal**: Ensure preset default instances are created with full VLC content, dependency-safe ordering, and correct hub assignment.

### Step 8.1: Verify/update TemplateSeedExecutor

**File**: `packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedExecutor.ts`

> **Note (H5 fix)**: The existing executor uses a **3-pass** flow (not 4-pass as previously stated):
> 1. **Pass 1**: Insert all entities and build complete codename→id map
> 2. **Pass 2**: Insert set constants and build complete set+constant codename→id map
> 3. **Pass 3**: Insert attributes using the complete entity + constants maps
>
> `SnapshotRestoreService` also references "3-pass creation order".

Verify this 3-pass flow handles all preset default instance scenarios correctly:
- Hub instances created in Pass 1 (no dependency on other entities)
- Catalog/set/enumeration instances created in Pass 1 (hub assignment resolved via codename→id map within same pass)
- Constants seeded in Pass 2 after all entity instances exist
- Attributes seeded in Pass 3 after all entity instances + constants exist
- Enumeration values seeded — verify they are handled in one of the existing passes (likely Pass 2 or a sub-step)

### Step 8.2: Verify preset default instance VLC data

**Preset files**: `packages/metahubs-backend/base/src/domains/templates/data/presets/`

Each preset's `defaultInstances[]` should contain:
- `codename: string` — machine identifier
- `name: VersionedLocalizedContent<string>` — localized display name (EN + RU)
- `description?: VersionedLocalizedContent<string>` — localized description
- `hubs?: string[]` — hub codenames for assignment (only for catalogs/sets/enums)
- `attributes?: TemplateSeedAttribute[]` — for catalog presets
- `constants?: TemplateSeedConstant[]` — for set presets
- `enumerationValues?: TemplateSeedEnumerationValue[]` — for enumeration presets

### Step 8.3: Write focused seed tests

**File**: `packages/metahubs-backend/base/src/tests/services/TemplateSeedExecutor.test.ts`

Tests:
- Create metahub with all presets → verify all entity types + default instances exist
- Create metahub with hub preset disabled → verify no hub instances but catalogs still created (without hub assignment)
- Verify VLC names are correctly seeded in both locales
- Verify hub assignment codename → UUID resolution
- Verify attribute/constant/enumeration value seeding
- Verify dependency order: hub instances before non-hub instances

### Checklist — Phase 8:
- [ ] 8.1: Verify TemplateSeedExecutor 3-pass flow handles all presets correctly
- [ ] 8.2: Verify preset default instance VLC data (including `constants-library` preset)
- [ ] 8.3: Write focused seed tests
- [ ] Build: `pnpm --filter metahubs-backend build`
- [ ] Test: `pnpm --filter metahubs-backend test`

---

## Phase 9: Schema-DDL & Runtime Finalization {#phase-9}

> **Goal**: Remove any remaining legacy kind resolution from schema-ddl and runtime controllers.

### Step 9.1: Verify managedStandardKinds.ts is clean

**File**: `packages/schema-ddl/base/src/managedStandardKinds.ts`

- No legacy compatibility mapping references
- Direct kind checks only: `kind === 'hub'`, `kind === 'catalog'`, etc.

### Step 9.2: Verify SchemaGenerator uses direct kinds

**File**: `packages/schema-ddl/base/src/SchemaGenerator.ts`

- No `resolveLegacyCompatible*()` calls
- No `custom.*-v2` pattern matching

### Step 9.3: Simplify runtimeRowsController.ts

**File**: `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`

- Remove any remaining legacy kind translation SQL
- Direct `kind` column reads for behavior classification
- Verify `RUNTIME_SECTION_FILTER_SQL` uses direct kind checks

### Step 9.4: Verify SnapshotSerializer is clean

**File**: `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`

- No `isBuiltin` serialization
- All entity types exported equally (preset-based and custom)
- Direct kind resolution

### Step 9.5: Audit and remove metahub-specific `document` traces

The original technical brief explicitly says the metahub metadata model must NOT keep `document` as a built-in/standard metadata kind.

Verify and clean all metahub-specific paths that could still imply `document` support:
- Template presets and template selectors
- Metahub entity type tests and fixtures
- Snapshot/fixture generators for metahub applications
- Sidebar/menu expectations and docs examples
- Any metahub runtime/schema branching that still assumes document is a standard metahub metadata kind

Platform-level `documentTables` capabilities outside metahubs may remain if they are unrelated to the metahub metadata model; the requirement here is specifically about metahub standard kinds and preset-driven authoring.

### Checklist — Phase 9:
- [ ] 9.1: Verify managedStandardKinds.ts
- [x] 9.2: Verify SchemaGenerator
- [ ] 9.3: Simplify runtimeRowsController.ts
- [ ] 9.4: Verify SnapshotSerializer
- [ ] 9.5: Audit/remove metahub-specific `document` traces
- [x] Build: `pnpm --filter schema-ddl build && pnpm --filter applications-backend build`

---

## Phase 10: i18n Updates {#phase-10}

> **Goal**: Update EN/RU translation files for removed/renamed concepts. All new UI text must be i18n-ready.

### Step 10.1: Clean metahubs namespace

**Files**:
- `packages/universo-i18n/base/src/locales/en/metahubs.json`
- `packages/universo-i18n/base/src/locales/ru/metahubs.json`

- Remove unused legacy menu title keys (only if no longer referenced)
- Keep all UI component keys used by renderers (dialog labels, field names, error messages)
- Add preset-driven create option keys (from Phase 7.5)
- Add any new keys needed for behavior service error messages

### Step 10.2: Verify metahubs-frontend namespace

- All `useTranslation('metahubs')` calls should resolve correctly
- No raw keys displayed in UI
- Remove stale top-level `documents` locale block and related tests if no active metahub UI consumes it; keep only platform-wide documentation/help keys that are still actually referenced

### Step 10.3: EN/RU parity check

Run `pnpm docs:i18n:check` (if available for metahubs namespace).

### Checklist — Phase 10:
- [ ] 10.1: Clean metahubs i18n namespace
- [ ] 10.2: Verify namespace resolution
- [ ] 10.3: EN/RU parity check

---

## Phase 11: Unit & Integration Tests (Jest/Vitest) {#phase-11}

> **Goal**: Comprehensive test coverage for new architecture. Tests written throughout earlier phases are verified and expanded here.

### Step 11.1: Backend tests

| Test Area | File | Coverage |
|-----------|------|----------|
| Behavior registry/capabilities | `behaviorRegistry.test.ts`, `standardKindCapabilities.test.ts` | Blocking refs, pre-delete, after-create, cycle detection, ACL/table-name mapping |
| Entity routes | `entityInstancesRoutes.test.ts` | CRUD for all 4 standard kinds + custom kinds |
| Entity type service | `EntityTypeService.test.ts` | No builtin/custom distinction; DB-only resolution |
| Template seed executor | `TemplateSeedExecutor.test.ts` | 3-pass flow, preset toggles (including `constants-library`), VLC seeding, hub assignment |
| Board summary | `metahubBoardSummary.test.ts` | `entityCounts` map, correct aggregation |
| Snapshot serializer | `SnapshotSerializer.test.ts` | All entity types exported equally |
| Create handler | `metahubsRoutes.test.ts` | Preset-driven create options |

### Step 11.2: Frontend tests

| Test Area | File | Coverage |
|-----------|------|----------|
| EntityInstanceList | `EntityInstanceList.test.tsx` | Lazy renderer loading for all kinds, fallback to generic |
| entityRendererRegistry | `entityRendererRegistry.test.tsx` | Selects registry panels for all standard kinds; stays entity-owned |
| standard-kind panels | `standardKindPanels.test.tsx` | Attributes tab, tree view, constants tab, values tab via registry-selected panels |
| genericEntityRenderer | `genericEntityRenderer.test.tsx` | Generic list/create/edit/delete |
| EntitiesWorkspace | `EntitiesWorkspace.test.tsx` | No source column, all types equal |
| MetahubCreateDialog | `MetahubList.test.tsx` | Preset toggles, dynamic labels |
| Query keys | `queryKeys.test.ts` | Unified tree, invalidation correctness |
| Breadcrumbs | `NavbarBreadcrumbs.test.tsx` | Entity-owned hrefs for all kinds |
| Menu | `MenuContent.test.tsx` | Dynamic entity type items |
| Legacy truth-surface cleanup | `src/__tests__/exports.test.ts`, `domains/shared/__tests__/optimisticMutations.remaining.test.tsx`, `EntityInstanceList.test.tsx` | No `Managed*` exports, no legacy create hooks, no wrapper-surface expectations |

### Step 11.3: Schema-DDL tests

- Direct kind resolution tests
- SchemaGenerator with standard kinds
- SchemaMigrator with standard kinds
- Snapshot round-trip with entity types

### Step 11.4: Run full test suite

```bash
pnpm test
```

### Checklist — Phase 11:
- [ ] 11.1: Backend tests comprehensive and passing
- [ ] 11.2: Frontend tests comprehensive and passing
- [ ] 11.3: Schema-DDL tests
- [ ] 11.4: Full test suite green

---

## Phase 12: E2E Playwright Tests & Screenshot Verification {#phase-12}

> **Goal**: Full-cycle browser testing with actual screenshot verification. No assumptions — verify real UI.

### Step 12.1: Delete/update legacy E2E specs

**Delete**:
- `metahub-entities-legacy-compatible-v2.spec.ts` — no more legacy compatibility
- `metahub-domain-entities.spec.ts` — tests legacy domain routes

**Update**:
- `metahub-entities-workspace.spec.ts`:
  - Remove `source` / `isBuiltin` / `includeBuiltins` references
  - Update kind key expectations to direct keys
  - Remove "Source" column assertions
- `metahub-entities-publication-runtime.spec.ts`:
  - Remove legacy route assertions
  - Update to entity-owned paths only
- `metahub-create-options-codename.spec.ts`:
  - Rewrite for preset-driven toggles
  - Or merge into new `metahub-create-options.spec.ts`
- `boards-overview.spec.ts`:
  - Update to `entityCounts` assertions
- `snapshot-export-import.spec.ts`:
  - Verify entity type definitions included for ALL kinds
  - Use new snapshot format

### Step 12.2: Create new E2E flows

1. **`metahub-entity-full-lifecycle.spec.ts`** — THE critical acceptance test:
   - Create metahub from "Basic" template → verify all preset entity types + default instances
   - For each standard kind (hub, catalog, set, enumeration):
     - Navigate via sidebar → verify list page loads correctly
     - Create new instance → verify it appears in list
     - Edit instance → verify changes saved
     - Copy instance → verify copy created
     - Delete instance → verify delete dialog with blocking references
     - Verify attribute/constant/value management on appropriate kinds
   - Verify `constants-library` preset (5th set-derived preset) creates and functions correctly
   - Assign catalog/set/enum to hub → verify hub detail shows children
   - Publish metahub → verify publication
   - Create application + connector → verify entity runtime
   - **Screenshot at each stage for visual verification**

2. **`metahub-sidebar-dynamic.spec.ts`** — Sidebar behavior:
   - Verify all standard entity types appear in sidebar after creation
   - Verify correct ordering (hub → catalog → set → enumeration)
   - Navigate each sidebar item → verify correct page loads
   - Create custom entity type → verify it appears in sidebar
   - **Screenshot sidebar before and after custom type creation**

3. **`metahub-create-options-presets.spec.ts`** — Preset-driven create dialog:
   - Select "Basic" template → verify preset toggles rendered (including `constants-library` as 5th preset)
   - Disable one preset → create metahub → verify that type not created
   - Enable all presets → create metahub → verify all types + default instances (5 presets total)
   - Check VLC labels are rendered in current locale
   - **Screenshot create dialog with toggles**

4. **`metahub-hub-hierarchy.spec.ts`** — Hub-specific tests:
   - Create hub hierarchy (parent → child)
   - Move hub in tree → verify position updated
   - Assign catalog to nested hub → verify hub detail shows catalog
   - Delete hub with children → verify blocking dialog
   - **Screenshot hub tree view**

### Step 12.3: Create screenshot capture specs for docs

**New file**: `tools/testing/e2e/specs/generators/docs-entity-types-screenshots.spec.ts`

Capture screenshots for documentation in both EN and RU locales:
- EntitiesWorkspace (list view with all entity types)
- Metahub create dialog (Parameters tab with preset toggles)
- Each entity kind instance list (catalog with attributes, hub with tree, set with constants, enumeration with values)
- Entity type create/edit dialog
- Sidebar with dynamic entity types
- Hub detail with nested children
- Delete dialog with blocking references

Save to:
- `docs/en/.gitbook/assets/entities/`
- `docs/ru/.gitbook/assets/entities/`

### Step 12.4: Visual verification protocol

After each Playwright run:
1. Review all captured screenshots
2. Verify UI matches expected design (no layout breaks, no raw i18n keys, correct data)
3. Compare EN vs RU screenshots for layout consistency
4. Fix any visual issues before proceeding

### Checklist — Phase 12:
- [ ] 12.1: Delete/update legacy E2E specs
- [ ] 12.2: Create 4 new E2E flows
- [ ] 12.3: Create screenshot capture spec for docs
- [ ] 12.4: Run and visually verify
- [ ] All E2E specs pass: `pnpm run build:e2e && npx playwright test`

---

## Phase 13: Fixture Regeneration {#phase-13}

> **Goal**: Regenerate ALL fixture files to match new entity-only format.

### Step 13.1: Update self-hosted app fixture contract

**File**: `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`

- All entity types use direct kindKeys (`catalog`, `hub`, `set`, `enumeration`)
- No `compatibility` field
- No `isBuiltin` field
- Template codenames use direct names (`catalog` not `catalog-v2`)
- Update entity count assertions for preset-seeded types

### Step 13.2: Regenerate metahubs-self-hosted-app-snapshot.json

```bash
npx playwright test --project=chromium tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts
```

Verify generated fixture against updated contract. Commit updated file.

### Step 13.3: Regenerate metahubs-quiz-app-snapshot.json

```bash
npx playwright test --project=chromium tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts
```

Verify and commit.

### Step 13.4: Verify import flow

Run snapshot import E2E test with regenerated fixtures. Verify all entity types and instances correctly imported.

### Checklist — Phase 13:
- [ ] 13.1: Update fixture contract
- [ ] 13.2: Regenerate self-hosted fixture
- [ ] 13.3: Regenerate quiz app fixture
- [ ] 13.4: Verify import flow E2E
- [ ] Run: full import/export E2E cycle

---

## Phase 14: Documentation Rewrite (EN/RU GitBook) {#phase-14}

> **Goal**: Complete rewrite of documentation with fresh screenshots from Phase 12.3.

### Step 14.1: Update architecture documentation

**Files**:
- `docs/en/architecture/metahub-system.md` → `docs/en/architecture/entity-system.md` (rename if needed)
- `docs/ru/architecture/entity-system.md`

Content:
- Entity-first architecture overview (no legacy vs V2 distinction)
- Entity type system: presets, custom types, component manifest
- Template ↔ preset ↔ default instance relationship
- Behavior service pattern
- Child-resource model (attributes, constants, elements under entities)
- No references to "legacy", "V2", "compatibility", "migration"

### Step 14.2: Rewrite entity types guide

**Files**:
- `docs/en/guides/custom-entity-types.md`
- `docs/ru/guides/custom-entity-types.md`

Using screenshots from Phase 12.3:
- Creating a metahub with preset types
- Working with standard kinds (hub, catalog, set, enumeration)
- Creating custom entity types
- Managing entity instances (CRUD, attributes, constants, values)
- Publishing entities
- Default instances feature

### Step 14.3: Update API reference

**Files**:
- `docs/en/api-reference/metahubs.md`
- `docs/ru/api-reference/metahubs.md`

- Remove ALL legacy API endpoints (/hubs, /catalogs, /sets, /enumerations)
- Document unified entity API endpoints only
- Update request/response examples
- Document MetahubCreateOptions with presetToggles

### Step 14.4: Update other affected docs

- `docs/en/guides/quiz-application-tutorial.md` → update entity references
- `docs/en/platform/` pages if they reference entity types
- `docs/en/getting-started/` if it mentions metahub creation

### Step 14.5: Verify EN/RU parity

- Compare line counts and section structure
- Verify screenshots exist in both locale asset trees:
  - `docs/en/.gitbook/assets/entities/*.png`
  - `docs/ru/.gitbook/assets/entities/*.png`
- Run `pnpm docs:i18n:check` if available

### Step 14.6: Update package READMEs

- `packages/metahubs-frontend/base/README.md` — remove legacy domain references
- `packages/metahubs-backend/base/README.md` — update architecture description
- `packages/universo-template-mui/base/README.md` — update menu/breadcrumb documentation

### Checklist — Phase 14:
- [ ] 14.1: Rewrite architecture docs (EN first, then RU)
- [ ] 14.2: Rewrite entity types guide with screenshots
- [ ] 14.3: Update API reference
- [ ] 14.4: Update other affected docs
- [ ] 14.5: Verify EN/RU parity
- [ ] 14.6: Update package READMEs

---

## Phase 15: Final Validation & Memory Bank Sync {#phase-15}

> **Goal**: Full validation suite and memory bank update.

### Step 15.1: Full workspace build

```bash
pnpm build
```

Validated on 2026-04-14 during the stale-contract cleanup pass after the schema-ddl/application truth-surface updates.

### Step 15.2: Full test suite

```bash
pnpm test
```

### Step 15.3: Lint check

```bash
pnpm --filter metahubs-frontend lint
pnpm --filter metahubs-backend lint
pnpm --filter universo-types lint
pnpm --filter schema-ddl lint
pnpm --filter applications-backend lint
pnpm --filter universo-template-mui lint
```

### Step 15.4: E2E tests

```bash
pnpm run build:e2e
npx playwright test
```

### Step 15.5: OpenAPI validation

```bash
pnpm --filter @universo/rest-docs validate
```

### Step 15.6: Regenerate OpenAPI from new routes

```bash
cd packages/universo-rest-docs && node scripts/generate-openapi-source.js
```

Verify generated spec contains only entity-owned routes for entity CRUD.

### Step 15.7: Run final zero-debt grep audit

Run a repository-wide negative inventory check before acceptance. The migration is not complete if any production source, exported public surface, route tree, or canonical tests/docs still contain removed transitional markers outside explicitly grandfathered archive/history files.

Required grep audit targets:
- No frontend managed domain folders or imports remain live in production source: `managedCatalogs`, `managedHubs`, `managedSets`, `managedEnumerations`, `ManagedStandardKindSurfaces`
- No removed route helper seams remain: `managedMetadataRoutePaths`, legacy top-level `/hubs`, `/catalogs`, `/sets`, `/enumerations` CRUD route families for entity authoring
- No deleted built-in/source-era contract markers remain in production truth surfaces: `includeBuiltins`, `isBuiltin`, `source`, `isSystemManagedEntityType`
- No removed compatibility placeholders remain in shipped metahub entity flows: `custom.hub-v2`, `custom.catalog-v2`, `custom.set-v2`, `custom.enumeration-v2`, `legacy-compatible`
- No stale metahub-specific `document` metadata kind markers remain in active metahub UI/docs/tests unless explicitly proven platform-generic and out of metahub metadata authoring scope

Acceptance rule:
- Grep results must be zero for production `src`, active tests, generated docs sources, and package exports.
- Any remaining hits must be either deleted in the same phase or explicitly justified as platform-generic/non-metahub code in the validation notes.

### Step 15.8: Final screenshot review

Run documentation screenshot generator. Review all screenshots for correct UI. Fix any issues.

### Step 15.9: Memory bank update

- Update `tasks.md` — mark all tasks completed, add outcome notes
- Update `activeContext.md` — new active focus / next steps
- Update `progress.md` — completion summary
- Update `systemPatterns.md` — new behavior service pattern, updated route/query key patterns
- Update `techContext.md` — updated architecture description

### Step 15.10: Commit and prepare PR

- Conventional commit: `feat(metahubs): complete entity-first migration — remove all legacy domain controllers and consolidate to behavior service registry`
- PR description with all changed areas and acceptance evidence

### Checklist — Phase 15:
- [x] 15.1: Full workspace build green
- [ ] 15.2: Full test suite green
- [ ] 15.3: Lint pass
- [ ] 15.4: E2E pass
- [ ] 15.5: OpenAPI validation pass
- [ ] 15.6: OpenAPI regeneration
- [ ] 15.7: Zero-debt grep audit passes
- [ ] 15.8: Final screenshot review
- [x] 15.9: Memory bank updated
- [ ] 15.10: Commit and PR prepared

---

## Potential Challenges

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Hierarchy capability extraction** — tree CRUD, cycle detection, nested entity operations are complex (~1000+ lines) and tightly coupled | HIGH | Extract shared hierarchy helpers first, register them under the neutral behavior registry, and test independently before deleting legacy controller code |
| 2 | **Standard-kind surface complexity** — rich hub/attribute/layout interactions are currently concentrated in large managed components | HIGH | Migrate incrementally into entity-owned registry panels; rewire hooks one at a time; keep specialized UX while collapsing ownership into neutral modules |
| 3 | **Query key tree collapse** — changing structure may cause stale cache issues everywhere | MEDIUM | Add focused invalidation tests; review every `invalidateQueries()` call; do query key migration in Phase 4 before UI changes |
| 4 | **Snapshot format break** — old snapshots won't import after changes | LOW | Intentional — DB is wiped. No backward compat needed. Document in release notes |
| 5 | **Frontend lazy chunk sizes** — moving components may change code splitting boundaries | LOW | Verify bundle output; renderers are already self-contained UI modules |
| 6 | **E2E server readiness** — Playwright harness may fail on cold-start `api/v1/ping` | MEDIUM | Add configurable timeout; consider warm-start helper; test infrastructure fix before running full suite |
| 7 | **Phase ordering**: Frontend migration (Phase 4-5) MUST complete before backend legacy routes are unusable | HIGH | Backend behavior extraction (Phase 1-2) runs in parallel with legacy; legacy deletion (Phase 3) only after Phase 2 verified |
| 8 | **Settings namespace drift** — if any consumer still reads legacy key names | MEDIUM | Grep for old key patterns after migration; test settings resolution end-to-end |
| 9 | **Hub widget binding** — `MenuWidgetConfig.hubId` references must work with entity instance IDs | LOW | Hub IDs are entity instance IDs; no conversion needed |
| 10 | **Preset dependency validation** — if catalog preset has `hubs: ['MainHub']` but hub preset is disabled | MEDIUM | Validate at create-time; if hub preset disabled, skip hub assignments in seed (don't fail) |
| 11 | **Managed* and route-path cleanup inventory drift** — fixed import counts can go stale and leave hidden consumers in components/tests/exports | HIGH | Use grep-driven cleanup instead of a fixed file count; Phase 4.5 becomes exhaustive, and Phase 11 locks stale truth-surface removal |
| 12 | **OptionValueList.tsx is 1474 lines** (C3) — large component migration risk | MEDIUM | Create parallel `enumerationValues/` domain first; copy-then-adapt rather than refactor in-place; test separately before deleting source |
| 13 | **ACL permission mapping drift** (M4) — removing `isBuiltinMetahubObjectKind` may break permissions | MEDIUM | `EntityBehaviorService.aclEntityType` provides per-kind mapping; Step 2.5 explicitly replaces all 3 usages |
| 14 | **`constants-library` preset** (M3) — 5th set-derived preset not in all test scopes | LOW | Explicitly added to Phase 8.2, 11.1, 12.2 testing; verify it works with the same set behavior service |
| 15 | **Hidden generic-wrapper debt in shared services** — business-named wrappers may survive after route deletion and silently preserve the old model | MEDIUM | Phase 2.6 removes `MetahubObjectsService` wrapper methods once generic object seams are in place |

---

## Files Changed Summary

### Files to DELETE (~65+ files)

**Backend legacy domains (4 directories, ~30 files)**:
- `packages/metahubs-backend/base/src/domains/hubs/` (controllers, routes, services)
- `packages/metahubs-backend/base/src/domains/catalogs/` (controllers, routes, services)
- `packages/metahubs-backend/base/src/domains/sets/` (controllers, routes, services)
- `packages/metahubs-backend/base/src/domains/enumerations/` (controllers, routes, services)

**Frontend managed domains (4 directories + dead code, ~25 files)**:
- `packages/metahubs-frontend/base/src/domains/managedCatalogs/`
- `packages/metahubs-frontend/base/src/domains/managedHubs/`
- `packages/metahubs-frontend/base/src/domains/managedSets/`
- `packages/metahubs-frontend/base/src/domains/managedEnumerations/`
- `packages/metahubs-frontend/base/src/domains/entities/ui/ManagedStandardKindSurfaces.tsx`
- `packages/metahubs-frontend/base/src/domains/layout/` (dead empty folders — M1 fix)
- `packages/metahubs-frontend/base/src/domains/shared/managedMetadataRoutePaths.ts` (M2 fix)
- `packages/metahubs-frontend/base/src/domains/shared/__tests__/entityMetadataRoutePaths.test.ts`

**Frontend top-level child-resource domains (delete after relocation under entities-owned subtree)**:
- `packages/metahubs-frontend/base/src/domains/attributes/`
- `packages/metahubs-frontend/base/src/domains/constants/`
- `packages/metahubs-frontend/base/src/domains/elements/`
- `packages/metahubs-frontend/base/src/domains/enumerationValues/`

**Legacy test files**:
- Backend: `hubsRoutes.test.ts`, `catalogsRoutes.test.ts`, `setsRoutes.test.ts`, `enumerationsRoutes.test.ts`
- Legacy compatibility tests

**E2E legacy specs**:
- `metahub-entities-legacy-compatible-v2.spec.ts`
- `metahub-domain-entities.spec.ts`

### Files to CREATE (~25+ files)

**Backend**:
- `entities/services/EntityBehaviorService.ts` — interface (with `aclEntityType`, `resolveGeneratedTableName`)
- `entities/services/behaviorRegistry.ts`
- `entities/services/standardKindBehaviorRegistry.ts`
- `entities/services/standardKindCapabilities/hierarchyCapability.ts`
- `entities/services/standardKindCapabilities/referenceCapability.ts`
- `entities/services/standardKindCapabilities/assignmentCapability.ts`
- `entities/services/standardKindCapabilities/metadataCapability.ts`
- `tests/services/behaviorRegistry.test.ts`
- `tests/services/standardKindCapabilities.test.ts`

**Frontend — Entity-owned renderer registry**:
- `entities/ui/renderers/entityRendererRegistry.tsx`
- `entities/ui/renderers/standardKindPanels.tsx`
- `entities/ui/renderers/genericEntityRenderer.tsx`
- `entities/ui/shared/HubSelectionPanel.tsx` (relocated)
- `entities/ui/shared/instanceActions.ts` — unified form builders (from CatalogActions/SetActions)

**Frontend — Entity-owned capability subtree**:
- entity-owned replacements for `attributes/`, `constants/`, `elements/`, and `enumerationValues/` under `domains/entities/**`
- entity-owned replacements for child-resource hooks/API/query helpers previously split across top-level folders

**Frontend — New shared utilities**:
- `shared/entityRoutePaths.ts` — unified path builders (replaces managedMetadataRoutePaths)

**E2E**:
- `metahub-entity-full-lifecycle.spec.ts`
- `metahub-sidebar-dynamic.spec.ts`
- `metahub-create-options-presets.spec.ts`
- `metahub-hub-hierarchy.spec.ts`
- `docs-entity-types-screenshots.spec.ts`

### Files to RENAME (H2 fix)
- `entities/services/legacyBuiltinObjectCompatibility.ts` → `entities/services/entityDeletePatterns.ts`

### Files to MODIFY (~45+ files)

**Backend**: `entityInstancesController.ts`, `entityInstancesRoutes.ts`, `router.ts`, `attributesRoutes.ts`, `constantsRoutes.ts`, `elementsRoutes.ts`, `MetahubSchemaService.ts`, `metahubsController.ts`, `TemplateSeedExecutor.ts`, `SnapshotSerializer.ts`, `MetahubObjectsService.ts` (H1 — remove `isBuiltinMetahubObjectKind`)
**Frontend (grep-driven cross-module import rewrites — C2 fix)**:
- `attributes/ui/AttributeFormFields.tsx`, `AttributeList.tsx`, `useAttributeListData.ts`
- `constants/ui/ConstantList.tsx`, `useConstantListData.ts`
- `elements/ui/ElementList.tsx`, `useElementListData.ts`
- `layouts/ui/LayoutList.tsx`, `MenuWidgetEditorDialog.tsx`
- `general/ui/GeneralPage.tsx` (H3 fix)
- `entities/ui/EntityInstanceList.tsx`, `EntitiesWorkspace.tsx`
- `shared/queryKeys.ts`
**Template-MUI**: `menuConfigs.ts`, `NavbarBreadcrumbs.tsx`
**Core-Frontend**: `MainRoutes.tsx`
**Schema-DDL**: `managedStandardKinds.ts`, `SchemaGenerator.ts`
**Applications-Backend**: `runtimeRowsController.ts`
**i18n**: `en/metahubs.json`, `ru/metahubs.json`
**Types**: `metahubs.ts`, `entityTypeDefinition.ts`
**Docs**: Multiple EN/RU pages
**REST-Docs**: `generate-openapi-source.js`  

---

## Implementation Order

```
Phase 1 (Behavior Registry/Capabilities) → Phase 2 (Controller Unification) → Phase 3 (Legacy Deletion) →
Phase 4 (Frontend API/Hooks) → Phase 5 (Frontend Renderer Registry) → Phase 6 (Sidebar/Routes) →
Phase 7 (Create Dialog) → Phase 8 (Seed System) →
Phase 9 (Schema-DDL) → Phase 10 (i18n) →
Phase 11 (Unit Tests) → Phase 12 (E2E + Screenshots) →
Phase 13 (Fixtures) → Phase 14 (Docs) → Phase 15 (Final Validation)
```

**Critical dependency chain**:
- Phase 1 → Phase 2 → Phase 3 (backend: extract → unify → delete)
- Phase 4 → Phase 5 (frontend: unified API → renderers → delete managed*)
- Phase 12 → Phase 14 (screenshots → documentation)
- Phase 15 must be last (final validation across everything)

**Parallelizable**:
- Phases 7-8 (create dialog + seed) can be done in parallel with Phases 4-6 (frontend cleanup) since they affect different areas
- Phase 10 (i18n) can be done incrementally throughout
- Phase 11 (unit tests) written throughout all phases but has dedicated sweep
