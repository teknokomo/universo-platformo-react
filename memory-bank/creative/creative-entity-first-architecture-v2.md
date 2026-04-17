# Creative Design: Entity-First Architecture V2 — Final Legacy Elimination

> **Created**: 2026-04-14  
> **Status**: Design complete — ready for implementation review  
> **Scope**: Remove ALL remaining legacy specialized domain layers and establish unified entity CRUD as the sole production surface  
> **Prerequisites**: Test DB will be wiped (no backward compatibility), no schema version bumps  
> **Prior art**: [creative-legacy-removal-entity-promotion.md](creative-legacy-removal-entity-promotion.md) (V1 design, partially implemented)

---

## Table of Contents

1. [Current State Assessment](#current-state)
2. [A. Backend Architecture: Replacing Legacy Domain Controllers](#section-a)
3. [B. Frontend Architecture: Replacing Managed Domain Folders](#section-b)
4. [C. Child-Resource Route Architecture](#section-c)
5. [D. Metahub Create Dialog: Preset-Driven Options](#section-d)
6. [E. Default Instance System](#section-e)
7. [F. Entity Type Query Keys & Cache Invalidation](#section-f)
8. [Cross-Cutting Concerns](#cross-cutting)
9. [Migration Path](#migration-path)
10. [Risk Assessment](#risk-assessment)

---

## Current State Assessment {#current-state}

### What has been delivered (V1 outcomes):

| Layer | Current State |
|-------|--------------|
| **Backend router** | `domains/router.ts` no longer mounts top-level legacy families. `createEntityInstancesRoutes(...)` owns the surface. |
| **Backend dispatch** | `entityInstancesRoutes.ts` imports and instantiates 4 specialized controllers (`hubsCtrl`, `catalogsCtrl`, `setsCtrl`, `enumerationsCtrl`), dispatches via `dispatchEntityRoute()` |
| **Backend generic controller** | `entityInstancesController.ts` handles generic list/create/update/delete/copy/restore for all kinds |
| **Backend domain folders** | `hubs/`, `catalogs/`, `sets/`, `enumerations/` still exist with full controller+service code |
| **Frontend top-level** | Legacy domain folders (`catalogs/`, `hubs/`, `sets/`, `enumerations/`) removed |
| **Frontend managed folders** | `managedCatalogs/`, `managedHubs/`, `managedSets/`, `managedEnumerations/` contain separate API clients, hooks, and UI components |
| **Frontend surfaces** | `ManagedStandardKindSurfaces.tsx` wraps: `ManagedCatalogEntitySurface = () => <LinkedCollectionListContent />` |
| **Entity types** | DB-stored; `EntityTypeService` resolved from DB only. Standard kinds = `catalog`, `hub`, `set`, `enumeration` |
| **Sidebar** | Fully dynamic, entity-type-driven |
| **Settings** | Migrated to `entity.<kind>.*` namespace |
| **Query keys** | Dual tree: legacy per-kind (`hubs(metahubId)`, etc.) AND entity-based (`entities(metahubId, kind)`) |
| **Templates** | `basicTemplate.presets[]` references presets by codename; `TemplateSeedExecutor` handles entity seeding |
| **Presets** | `EntityTypePresetManifest` with `defaultInstances` containing seed attributes/constants/values |

### What remains to eliminate:

1. **4 backend legacy domain folders** with specialized controllers
2. **4 frontend `managed*` folders** with separate API/hooks/UI
3. **Dispatch layer** in `entityInstancesRoutes.ts` that delegates to legacy controllers
4. **Dual path shapes** in child-resource routes (4 path patterns per operation)
5. **Dual query key trees** in the frontend cache layer
6. **Legacy per-kind API clients** (`hubs.ts`, `catalogs.ts`, `sets.ts`, `enumerations.ts`) in frontend

---

## A. Backend Architecture: Replacing Legacy Domain Controllers {#section-a}

### Design Topic: How to handle kind-specific CRUD behavior after removing legacy controllers

### Current Architecture
```
entityInstancesRoutes.ts
├── ctrl = entityInstancesController        ← generic list/create/update/delete
├── hubsCtrl = createHubsController         ← hub-specific operations
├── catalogsCtrl = createCatalogsController  ← catalog-specific operations
├── setsCtrl = createSetsController          ← set-specific operations
├── enumerationsCtrl = createEnumerationsController ← enum-specific operations
└── dispatchEntityRoute({ managedHandlers: { hub: hubsCtrl.X, catalog: catalogsCtrl.X } })
```

### Options Evaluated

#### Option 1: Single Generic Controller
One controller handles ALL entity kinds; behavior diverges through `if/switch` on kind.

**Pros**: Maximum simplicity, single code path, easy to find all CRUD logic  
**Cons**: Giant controller (1500+ lines), hub hierarchy logic interleaved with simple kind logic, violates SRP, hard to test kind-specific behavior in isolation

#### Option 2: Behavior Service Registry (RECOMMENDED)
The generic `entityInstancesController` remains thin. Kind-specific behavior is extracted into registered **behavior services** that the controller delegates to for operations that genuinely differ per kind.

**Pros**: Clean separation, each behavior service is independently testable, the controller stays thin, new custom kinds can register behaviors without touching the controller, follows existing `MetahubObjectsService` pattern  
**Cons**: One extra indirection layer  

#### Option 3: Component-Based Middleware
Express middleware chain where each component is opt-in based on the entity kind's manifest.

**Pros**: Very composable  
**Cons**: Over-engineered for 4 standard kinds, middleware ordering is fragile, harder to debug, doesn't match existing patterns  

### Decision: Option 2 — Behavior Service Registry

### Detailed Design

#### 2.1 Behavior Service Interface

```typescript
// packages/metahubs-backend/base/src/domains/entities/services/EntityBehaviorService.ts

import type { Request, Response } from 'express'
import type { SqlQueryable } from '@universo/utils'
import type { ResolvedEntityType } from '@universo/types'

/**
 * Optional behavior extensions for entity kinds.
 * The generic entity controller calls these hooks at specific points.
 * Standard-kind services implement the methods they need; others return null.
 */
export interface EntityBehaviorService {
  /** Kind key this service handles (e.g., 'hub', 'catalog') */
  readonly kindKey: string

  // ─── Pre/Post CRUD hooks ───
  /** Validate kind-specific fields before create. Return error message or null. */
  validateCreate?(payload: Record<string, unknown>, entityType: ResolvedEntityType): string | null
  /** Post-create side effects (e.g., seed hub parent_hub_id column). */
  afterCreate?(entityId: string, payload: Record<string, unknown>, db: SqlQueryable): Promise<void>
  /** Kind-specific update validation. */
  validateUpdate?(entityId: string, payload: Record<string, unknown>, entityType: ResolvedEntityType): string | null
  /** Pre-delete checks beyond generic blocker queries. */
  beforeDelete?(entityId: string, db: SqlQueryable): Promise<{ blocked: boolean; reason?: string }>
  /** Post-delete cleanup (e.g., remove hub parent references). */
  afterDelete?(entityId: string, db: SqlQueryable): Promise<void>
  /** Kind-specific copy logic (e.g., hub tree cloning). */
  afterCopy?(sourceId: string, targetId: string, payload: Record<string, unknown>, db: SqlQueryable): Promise<void>

  // ─── Kind-specific sub-resource routes ───
  /** Get blocking references for delete confirmation dialog. */
  getBlockingReferences?(entityId: string, db: SqlQueryable): Promise<BlockingReferencesResult>
}

export interface BlockingReferencesResult {
  items: Array<{ id: string; name: unknown; kind: string }>
  totalBlocking: number
  canDelete: boolean
}
```

#### 2.2 Hub Behavior Service (the most complex kind)

```typescript
// packages/metahubs-backend/base/src/domains/entities/services/HubBehaviorService.ts

export class HubBehaviorService implements EntityBehaviorService {
  readonly kindKey = 'hub'

  constructor(
    private objectsService: MetahubObjectsService,
    private hubsService: MetahubHubsService,
    private settingsService: MetahubSettingsService
  ) {}

  async afterCreate(entityId: string, payload: Record<string, unknown>, db: SqlQueryable): Promise<void> {
    // Set parent_hub_id if provided in payload
    if (payload.parentHubId) {
      await this.hubsService.setParentHub(entityId, payload.parentHubId as string, db)
    }
  }

  async beforeDelete(entityId: string, db: SqlQueryable): Promise<{ blocked: boolean; reason?: string }> {
    // Check for child hubs, assigned catalogs/sets/enumerations
    const blockers = await findBlockingHubObjects(entityId, db)
    return {
      blocked: blockers.totalBlocking > 0,
      reason: blockers.totalBlocking > 0 ? 'Hub has dependent objects' : undefined
    }
  }

  async afterDelete(entityId: string, db: SqlQueryable): Promise<void> {
    await removeHubFromObjectAssociations(entityId, db)
  }

  async getBlockingReferences(entityId: string, db: SqlQueryable): Promise<BlockingReferencesResult> {
    const result = await findBlockingHubObjects(entityId, db)
    return {
      items: [
        ...result.blockingCatalogs,
        ...result.blockingSets,
        ...result.blockingEnumerations,
        ...result.blockingChildHubs
      ],
      totalBlocking: result.totalBlocking,
      canDelete: result.canDelete
    }
  }

  // ─── Hub-specific route handlers delegated from the controller ───

  async listChildHubs(metahubId: string, parentHubId: string, params: ListParams, db: SqlQueryable) {
    // Extracted from current hubsController.listChildHubs
    return this.hubsService.listChildren(metahubId, parentHubId, params, db)
  }

  async moveHub(hubId: string, newParentId: string | null, db: SqlQueryable) {
    // Cycle detection + parent update
    return this.hubsService.moveWithCycleCheck(hubId, newParentId, db)
  }
}
```

#### 2.3 Catalog/Set/Enumeration Behavior Services (simpler)

```typescript
// packages/metahubs-backend/base/src/domains/entities/services/CatalogBehaviorService.ts

export class CatalogBehaviorService implements EntityBehaviorService {
  readonly kindKey = 'catalog'

  async getBlockingReferences(entityId: string, db: SqlQueryable): Promise<BlockingReferencesResult> {
    const blockers = await findBlockingCatalogReferences(entityId, db)
    return {
      items: blockers.references,
      totalBlocking: blockers.totalBlocking,
      canDelete: blockers.canDelete
    }
  }
}

// SetBehaviorService and EnumerationBehaviorService follow the same pattern
// with their respective blocker query logic.
```

#### 2.4 Behavior Registry

```typescript
// packages/metahubs-backend/base/src/domains/entities/services/behaviorRegistry.ts

const behaviorServices = new Map<string, EntityBehaviorService>()

export function registerBehavior(service: EntityBehaviorService): void {
  behaviorServices.set(service.kindKey, service)
}

export function getBehaviorService(kindKey: string): EntityBehaviorService | null {
  return behaviorServices.get(kindKey) ?? null
}

// Initialize at route creation time (inside createEntityInstancesRoutes):
export function initializeBehaviorRegistry(
  objectsService: MetahubObjectsService,
  hubsService: MetahubHubsService,
  settingsService: MetahubSettingsService,
  getDbExecutor: () => DbExecutor
): void {
  registerBehavior(new HubBehaviorService(objectsService, hubsService, settingsService))
  registerBehavior(new CatalogBehaviorService())
  registerBehavior(new SetBehaviorService())
  registerBehavior(new EnumerationBehaviorService())
}
```

#### 2.5 Simplified entityInstancesRoutes.ts (after cleanup)

```typescript
// The dispatch pattern is replaced by behavior hooks:
export function createEntityInstancesRoutes(
  ensureAuth: RequestHandler,
  getDbExecutor: () => DbExecutor,
  readLimiter: RateLimitRequestHandler,
  writeLimiter: RateLimitRequestHandler
): Router {
  const router = Router({ mergeParams: true })
  router.use(ensureAuth)

  const createHandler = createMetahubHandlerFactory(getDbExecutor)
  const ctrl = createEntityInstancesController(createHandler, getBehaviorService)

  // ═══════ Entity type CRUD ═══════
  // (unchanged — already generic)

  // ═══════ Entity instance CRUD ═══════
  // Kind-scoped routes
  router.get('/metahub/:metahubId/entities/:kindKey/instances', readLimiter, asyncHandler(ctrl.list))
  router.post('/metahub/:metahubId/entities/:kindKey/instances', writeLimiter, asyncHandler(ctrl.create))
  router.patch('/metahub/:metahubId/entities/:kindKey/instances/reorder', writeLimiter, asyncHandler(ctrl.reorder))
  router.get('/metahub/:metahubId/entities/:kindKey/instances/trash', readLimiter, asyncHandler(ctrl.listTrash))
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:entityId', readLimiter, asyncHandler(ctrl.getById))
  router.patch('/metahub/:metahubId/entities/:kindKey/instance/:entityId', writeLimiter, asyncHandler(ctrl.update))
  router.delete('/metahub/:metahubId/entities/:kindKey/instance/:entityId', writeLimiter, asyncHandler(ctrl.remove))
  router.post('/metahub/:metahubId/entities/:kindKey/instance/:entityId/copy', writeLimiter, asyncHandler(ctrl.copy))
  router.post('/metahub/:metahubId/entities/:kindKey/instance/:entityId/restore', writeLimiter, asyncHandler(ctrl.restore))
  router.delete('/metahub/:metahubId/entities/:kindKey/instance/:entityId/permanent', writeLimiter, asyncHandler(ctrl.permanentRemove))

  // Kind-specific sub-resource routes (driven by component manifest)
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references',
    readLimiter, asyncHandler(ctrl.getBlockingReferences))
  router.get('/metahub/:metahubId/entities/:kindKey/instance/:entityId/children',
    readLimiter, asyncHandler(ctrl.listChildren))

  // ═══════ No more dispatchEntityRoute() ═══════
  // ═══════ No more hubsCtrl / catalogsCtrl / setsCtrl / enumerationsCtrl ═══════

  return router
}
```

#### 2.6 Expanded entityInstancesController (behavior-aware)

```typescript
// Key change: the controller calls behavior service hooks at lifecycle points

export function createEntityInstancesController(
  createHandler: MetahubHandlerFactory,
  resolveBehavior: (kindKey: string) => EntityBehaviorService | null
) {
  return {
    create: createHandler(async (req, res, { metahub, userId, db }) => {
      const { kind, codename, name, description, ...rest } = parseCreatePayload(req.body)
      const entityType = await entityTypeService.resolveType(metahub.id, kind, userId)
      
      // Check ACL
      await ensureMetahubAccess(req, resolveManagedAclPermission(kind, 'create'))

      // Generic validation
      validateGenericFields(codename, name, entityType)
      
      // Kind-specific pre-create validation
      const behavior = resolveBehavior(kind)
      if (behavior?.validateCreate) {
        const error = behavior.validateCreate(rest, entityType)
        if (error) throw new MetahubValidationError(error)
      }

      // Generic create
      const entityId = await objectsService.create(db, {
        metahubId: metahub.id,
        kind,
        codename,
        name,
        description,
        config: rest.config,
        userId
      })

      // Kind-specific post-create
      if (behavior?.afterCreate) {
        await behavior.afterCreate(entityId, rest, db)
      }

      // Trigger entity events
      await entityEventRouter.emit('afterCreate', { entityId, kind, metahubId: metahub.id }, db)

      const entity = await objectsService.findById(db, metahub.id, entityId)
      res.status(201).json(entity)
    }),

    remove: createHandler(async (req, res, { metahub, userId, db }) => {
      const { entityId } = req.params
      const entity = await objectsService.findById(db, metahub.id, entityId)
      const kind = entity.kind
      
      await ensureMetahubAccess(req, resolveManagedAclPermission(kind, 'delete'))

      // Kind-specific pre-delete check
      const behavior = resolveBehavior(kind)
      if (behavior?.beforeDelete) {
        const check = await behavior.beforeDelete(entityId, db)
        if (check.blocked) {
          throw new MetahubValidationError(check.reason ?? 'Delete blocked by dependencies')
        }
      }

      // Generic soft-delete
      await objectsService.softDelete(db, metahub.id, entityId, userId)

      // Kind-specific post-delete cleanup
      if (behavior?.afterDelete) {
        await behavior.afterDelete(entityId, db)
      }

      res.status(204).end()
    }),

    getBlockingReferences: createHandler(async (req, res, { metahub, db }) => {
      const { kindKey, entityId } = req.params
      const behavior = resolveBehavior(kindKey)
      
      if (!behavior?.getBlockingReferences) {
        res.json({ items: [], totalBlocking: 0, canDelete: true })
        return
      }

      const result = await behavior.getBlockingReferences(entityId, db)
      res.json(result)
    }),

    listChildren: createHandler(async (req, res, { metahub, db }) => {
      const { kindKey, entityId } = req.params
      const { childKind } = req.query as { childKind?: string }
      const behavior = resolveBehavior(kindKey)

      if (kindKey !== 'hub' || !behavior || !(behavior instanceof HubBehaviorService)) {
        res.json({ items: [], pagination: { total: 0, limit: 100, offset: 0 } })
        return
      }

      const result = await behavior.listChildHubs(metahub.id, entityId, parseListParams(req.query), db)
      res.json(result)
    })
  }
}
```

#### 2.7 Hub-Specific Sub-Routes

Hub children (catalogs/sets/enumerations under a hub) remain as dedicated sub-routes of the entity instance, but their handlers now live in the `HubBehaviorService` instead of a separate `hubsController`:

```typescript
// Still registered in entityInstancesRoutes.ts:
router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/hubs',
  readLimiter, asyncHandler(ctrl.listHubChildren('hub')))
router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalogs',
  readLimiter, asyncHandler(ctrl.listHubChildren('catalog')))
router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/sets',
  readLimiter, asyncHandler(ctrl.listHubChildren('set')))
router.get('/metahub/:metahubId/entities/:kindKey/instance/:hubId/enumerations',
  readLimiter, asyncHandler(ctrl.listHubChildren('enumeration')))

// In the controller — delegates to HubBehaviorService:
listHubChildren: (childKind: string) => createHandler(async (req, res, { metahub, db }) => {
  const { hubId } = req.params
  const behavior = resolveBehavior('hub') as HubBehaviorService
  const params = parseListParams(req.query)
  
  const result = await behavior.listChildrenByKind(
    metahub.id, hubId, childKind, params, db
  )
  res.json(result)
})
```

#### 2.8 Backend File Structure After Cleanup

```
packages/metahubs-backend/base/src/domains/
├── entities/
│   ├── controllers/
│   │   └── entityInstancesController.ts    ← EXPANDED: sole instance controller
│   ├── routes/
│   │   ├── entityInstancesRoutes.ts        ← SIMPLIFIED: no dispatch, no legacy ctrl
│   │   ├── entityTypesRoutes.ts            ← unchanged
│   │   ├── actionsRoutes.ts                ← unchanged
│   │   └── eventBindingsRoutes.ts          ← unchanged
│   └── services/
│       ├── EntityTypeService.ts            ← unchanged
│       ├── EntityBehaviorService.ts        ← NEW: interface definition
│       ├── HubBehaviorService.ts           ← NEW: extracted from hubsController
│       ├── CatalogBehaviorService.ts       ← NEW: extracted from catalogsController
│       ├── SetBehaviorService.ts           ← NEW: extracted from setsController
│       ├── EnumerationBehaviorService.ts   ← NEW: extracted from enumerationsController
│       ├── behaviorRegistry.ts             ← NEW: service registry
│       ├── EntityMutationService.ts        ← unchanged
│       ├── EntityEventRouter.ts            ← unchanged
│       ├── ActionService.ts                ← unchanged
│       └── EventBindingService.ts          ← unchanged
├── attributes/                              ← KEPT (shared child-resource domain)
├── constants/                               ← KEPT
├── elements/                                ← KEPT
├── layouts/                                 ← KEPT
├── scripts/                                 ← KEPT
├── settings/                                ← KEPT
├── templates/                               ← KEPT
├── metahubs/                                ← KEPT (core metahub CRUD)
├── branches/                                ← KEPT
├── publications/                            ← KEPT
├── shared/                                  ← KEPT
├── router.ts                                ← SIMPLIFIED
│
│ ═══ DELETED ═══
│ ├── hubs/                                  ← REMOVED
│ ├── catalogs/                              ← REMOVED
│ ├── sets/                                  ← REMOVED
│ └── enumerations/                          ← REMOVED
```

### Migration Path for Section A

1. Create `EntityBehaviorService` interface and `behaviorRegistry.ts`
2. Extract `HubBehaviorService` from `hubs/controllers/hubsController.ts` + `hubs/services/hubCompatibility.ts`
3. Extract `CatalogBehaviorService` from `catalogs/controllers/catalogsController.ts`
4. Extract `SetBehaviorService` from `sets/controllers/setsController.ts`
5. Extract `EnumerationBehaviorService` from `enumerations/controllers/enumerationsController.ts`
6. Modify `entityInstancesController.ts` to call behavior hooks instead of expecting dispatch
7. Simplify `entityInstancesRoutes.ts` — remove `dispatchEntityRoute()`, remove legacy controller imports
8. Remove `hubs/`, `catalogs/`, `sets/`, `enumerations/` domain folders
9. Update `router.ts` to remove any remaining stale imports
10. Run focused backend test suite to verify

### Risk Assessment for Section A

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hub hierarchy logic (cycle detection, tree CRUD) is complex to extract | HIGH | Keep `MetahubHubsService` intact; `HubBehaviorService` wraps it |
| Hub-scoped child routes (catalogs/sets/enums under hub) have bespoke SQL | MEDIUM | Extract SQL queries to shared functions, call from behavior service |
| Blocking references logic differs per kind | MEDIUM | Each behavior service owns its blocker query; interface enforces uniform output shape |
| Codename style/copy helpers are shared across legacy controllers | LOW | Already in `shared/` — no duplication issue |

---

## B. Frontend Architecture: Replacing Managed Domain Folders {#section-b}

### Design Topic: Target component architecture after removing managed* folders

### Current Architecture
```
domains/
├── managedCatalogs/
│   ├── api/catalogs.ts          ← LinkedCollectionListContent API client using entity-owned paths
│   ├── hooks/                   ← useCatalogs(), useCatalogDetail(), etc.
│   ├── ui/CatalogList.tsx       ← Full catalog list UI (attributes tab, hub panel, etc.)
│   └── index.ts
├── managedHubs/
│   ├── api/hubs.ts              ← Hub API client using entity-owned paths
│   ├── hooks/                   ← useHubs(), useChildHubs(), useMetahubTrees()
│   ├── ui/HubList.tsx           ← Full hub list UI (tree view, hierarchy)
│   └── index.ts
├── managedSets/ (similar)
├── managedEnumerations/ (similar)
├── entities/
│   ├── api/entityInstances.ts   ← Generic entity API client
│   ├── hooks/                   ← useEntityInstances(), etc.
│   └── ui/
│       ├── EntityInstanceList.tsx         ← Delegates to managed surfaces for standard kinds
│       └── ManagedStandardKindSurfaces.tsx ← Thin wrappers
```

### Options Evaluated

#### Option 1: Renderer Registry (lazy-loaded kind-specific renderers)
`EntityInstanceList` lazy-loads renderers from `entities/ui/renderers/`. Each renderer shares the common entity API but has kind-specific UI.

**Pros**: Clean code splitting, each renderer is independently loadable, clear file structure  
**Cons**: Add lazy boundary per kind (4 bundles), slightly more complex import resolution

#### Option 2: Composable Entity Shell (manifest-driven)
A single `EntityInstanceShell` component that composes tabs/panels based on `ComponentManifest`.

**Pros**: No per-kind code at all, fully data-driven  
**Cons**: Each standard kind has genuinely different UX (tree view for hubs, inline editing for enumerations) that can't be reduced to manifest flags without a massive abstraction layer. Level 5 effort.

#### Option 3: Hybrid — Renderer Wrappers + Unified API (RECOMMENDED)
Standard kinds get thin renderer files in `entities/ui/renderers/` that import **relocated** `LinkedCollectionListContent`, `TreeListContent`, etc. But ALL data flows through the **unified entity hooks/API**, not through separate per-kind API modules.

**Pros**: Preserves the mature tested UX per kind, eliminates the managed* API duplication, the unified API is already proven (`entityInstances.ts`), renderers only differ in UI presentation not in data fetching  
**Cons**: Standard-kind renderers are larger than true generic renderers (they carry kind-specific tabs/panels)

### Decision: Option 3 — Hybrid

### Detailed Design

#### 3.1 Target File Structure

```
domains/entities/
├── api/
│   ├── entityInstances.ts           ← EXPANDED: sole instance API for all kinds
│   ├── entityTypes.ts               ← unchanged
│   └── entityAutomation.ts          ← unchanged
├── hooks/
│   ├── queries.ts                   ← EXPANDED: unified hooks for all kinds
│   ├── mutations.ts                 ← EXPANDED: unified mutation hooks for all kinds
│   └── index.ts
├── ui/
│   ├── EntityInstanceList.tsx        ← SIMPLIFIED: routing shell
│   ├── EntitiesWorkspace.tsx         ← unchanged
│   ├── EntityAutomationTab.tsx       ← unchanged
│   ├── EntityTypePresetSelector.tsx  ← unchanged
│   ├── renderers/
│   │   ├── CatalogInstanceRenderer.tsx  ← Relocated from managedCatalogs/ui
│   │   ├── HubInstanceRenderer.tsx      ← Relocated from managedHubs/ui
│   │   ├── SetInstanceRenderer.tsx      ← Relocated from managedSets/ui
│   │   ├── EnumerationInstanceRenderer.tsx ← Relocated from managedEnumerations/ui
│   │   └── GenericInstanceRenderer.tsx  ← For custom entity kinds
│   └── shared/
│       ├── HubSelectionPanel.tsx     ← Relocated from managedHubs
│       ├── HubDeleteDialog.tsx
│       ├── CatalogDeleteDialog.tsx
│       ├── SetDeleteDialog.tsx
│       └── EnumerationDeleteDialog.tsx
└── index.ts

═══ DELETED ═══
├── managedCatalogs/                  ← REMOVED
├── managedHubs/                      ← REMOVED
├── managedSets/                      ← REMOVED
└── managedEnumerations/              ← REMOVED
```

#### 3.2 Unified Entity API Layer

The key change: **all kinds use the same API client** (`entityInstances.ts`), eliminating the duplicated `hubs.ts`, `catalogs.ts`, etc. Kind-specific request/response shapes are handled by extending the unified interface:

```typescript
// entities/api/entityInstances.ts — EXPANDED

// ─── Unified base API (already exists) ───
export const listEntityInstances = async (metahubId: string, params: EntityInstancesListParams) => { ... }
export const getEntityInstance = async (metahubId: string, entityId: string) => { ... }
export const createEntityInstance = (metahubId: string, data: EntityInstancePayload) => { ... }
export const updateEntityInstance = (metahubId: string, entityId: string, data: UpdateEntityInstancePayload) => { ... }
export const deleteEntityInstance = (metahubId: string, entityId: string) => { ... }
export const copyEntityInstance = (metahubId: string, entityId: string, data: CopyEntityInstancePayload) => { ... }
export const restoreEntityInstance = (metahubId: string, entityId: string) => { ... }
export const permanentDeleteEntityInstance = (metahubId: string, entityId: string) => { ... }

// ─── Kind-specific sub-resources (NEW: consolidated from managed* API files) ───
export const getBlockingReferences = async (
  metahubId: string, kindKey: string, entityId: string
): Promise<BlockingReferencesResponse> => {
  const response = await apiClient.get<BlockingReferencesResponse>(
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instance/${entityId}/blocking-references`
  )
  return response.data
}

export const getBlockingCatalogs = async (
  metahubId: string, hubId: string
): Promise<BlockingCatalogsResponse> => {
  const response = await apiClient.get<BlockingCatalogsResponse>(
    `/metahub/${metahubId}/entities/hub/instance/${hubId}/blocking-catalogs`
  )
  return response.data
}

// Hub children
export const listHubChildren = async (
  metahubId: string, hubId: string, childKind: string, params?: PaginationParams
): Promise<PaginatedResponse<MetahubEntityInstance>> => {
  const response = await apiClient.get(
    `/metahub/${metahubId}/entities/hub/instance/${hubId}/${childKind}s`,
    { params }
  )
  return toPaginatedResponse(response.data)
}

// Hub child CRUD (catalogs, sets, enumerations under a hub)
export const createHubChild = (
  metahubId: string, hubId: string, childKind: string, data: EntityInstancePayload
) => apiClient.post(
  `/metahub/${metahubId}/entities/hub/instance/${hubId}/${childKind}s`,
  data
)

export const reorderInstances = (metahubId: string, kindKey: string, ids: string[]) =>
  apiClient.patch(`/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instances/reorder`, { ids })
```

#### 3.3 Unified Entity Hooks

```typescript
// entities/hooks/queries.ts — EXPANDED

/** Universal instance list hook — works for ANY entity kind */
export function useEntityInstancesQuery(
  metahubId: string | undefined,
  kindKey: string,
  params?: PaginationParams & { locale?: string; includeDeleted?: boolean; onlyDeleted?: boolean }
) {
  return useQuery({
    queryKey: metahubsQueryKeys.instances(metahubId!, kindKey, params),
    queryFn: () => listEntityInstances(metahubId!, { kind: kindKey, ...params }),
    enabled: Boolean(metahubId && kindKey)
  })
}

/** Hub children list — for catalogs/sets/enums nested under a hub */
export function useHubChildrenQuery(
  metahubId: string | undefined,
  hubId: string | undefined,
  childKind: string,
  params?: PaginationParams
) {
  return useQuery({
    queryKey: metahubsQueryKeys.instanceChildren(metahubId!, 'hub', hubId!, childKind, params),
    queryFn: () => listHubChildren(metahubId!, hubId!, childKind, params),
    enabled: Boolean(metahubId && hubId && childKind)
  })
}

/** Blocking references for delete confirmation */
export function useBlockingReferencesQuery(
  metahubId: string | undefined,
  kindKey: string,
  entityId: string | undefined
) {
  return useQuery({
    queryKey: metahubsQueryKeys.blockingReferences(metahubId!, kindKey, entityId!),
    queryFn: () => getBlockingReferences(metahubId!, kindKey, entityId!),
    enabled: Boolean(metahubId && kindKey && entityId)
  })
}
```

#### 3.4 Simplified EntityInstanceList (routing shell)

```tsx
// entities/ui/EntityInstanceList.tsx — SIMPLIFIED

import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { SkeletonGrid } from '@universo/template-mui'
import { isStandardEntityKind } from '@universo/types'

const CatalogInstanceRenderer = lazy(() => import('./renderers/CatalogInstanceRenderer'))
const HubInstanceRenderer = lazy(() => import('./renderers/HubInstanceRenderer'))
const SetInstanceRenderer = lazy(() => import('./renderers/SetInstanceRenderer'))
const EnumerationInstanceRenderer = lazy(() => import('./renderers/EnumerationInstanceRenderer'))
const GenericInstanceRenderer = lazy(() => import('./renderers/GenericInstanceRenderer'))

const STANDARD_KIND_RENDERERS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  catalog: CatalogInstanceRenderer,
  hub: HubInstanceRenderer,
  set: SetInstanceRenderer,
  enumeration: EnumerationInstanceRenderer
}

export default function EntityInstanceList() {
  const { kindKey: rawKindKey } = useParams<{ kindKey: string }>()
  const kindKey = decodeURIComponent(rawKindKey ?? '').trim()

  const Renderer = STANDARD_KIND_RENDERERS[kindKey] ?? GenericInstanceRenderer

  return (
    <Suspense fallback={<SkeletonGrid insetMode="content" />}>
      <Renderer />
    </Suspense>
  )
}
```

#### 3.5 Renderer Pattern (example: CatalogInstanceRenderer)

```tsx
// entities/ui/renderers/CatalogInstanceRenderer.tsx

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
// ... MUI imports ...

import {
  useEntityInstancesQuery,
  useCreateEntityInstance,
  useUpdateEntityInstance,
  useCopyEntityInstance,
  useDeleteEntityInstance,
  useBlockingReferencesQuery
} from '../../hooks'
import { metahubsQueryKeys } from '../../../shared'
import { AttributeListContent } from '../../../attributes/ui/AttributeList'
import { HubSelectionPanel } from '../shared/HubSelectionPanel'
import { CatalogDeleteDialog } from '../shared/CatalogDeleteDialog'
// ... more shared imports ...

const KIND_KEY = 'catalog'

export default function CatalogInstanceRenderer() {
  const { metahubId } = useParams<{ metahubId: string }>()
  const { t } = useTranslation('metahubs')

  // ─── All data through unified hooks ───
  const instancesQuery = useEntityInstancesQuery(metahubId, KIND_KEY, paginationParams)
  const createMutation = useCreateEntityInstance(metahubId!)
  const updateMutation = useUpdateEntityInstance(metahubId!)
  // ...

  // ─── Catalog-specific tabs ───
  const tabs: TabConfig[] = useMemo(() => [
    { key: 'general', label: t('catalogs.tabs.general'), content: <GeneralTabFields /> },
    { key: 'hubs', label: t('catalogs.tabs.hubs'), content: <HubSelectionPanel /> },
    { key: 'layout', label: t('catalogs.tabs.layout'), content: <LayoutList /> },
    { key: 'scripts', label: t('catalogs.tabs.scripts'), content: <EntityScriptsTab /> }
  ], [t])

  // ─── Catalog-specific: attribute panel, display attribute, hub assignment ───
  // (This is the actual LinkedCollectionListContent logic, using unified hooks)

  return (
    <>
      <ViewHeader title={entityTypeTitle} actions={...} />
      {/* Catalog list with attribute tab, hub panel, etc. */}
      <FlowListTable items={instances} columns={catalogColumns} />
      <EntityFormDialog tabs={tabs} />
      <CatalogDeleteDialog />
    </>
  )
}
```

### Migration Path for Section B

1. Expand `entityInstances.ts` API with kind-specific sub-resource endpoints (from managed* API files)
2. Expand unified hooks in `queries.ts` and `mutations.ts`
3. Create `entities/ui/renderers/` directory
4. Move `managedCatalogs/ui/CatalogList.tsx` → `entities/ui/renderers/CatalogInstanceRenderer.tsx`, rewire imports to unified hooks/API
5. Repeat for `managedHubs/`, `managedSets/`, `managedEnumerations/`
6. Create `GenericInstanceRenderer.tsx` for custom kinds
7. Simplify `EntityInstanceList.tsx` to the routing shell pattern
8. Move shared UI components (`HubSelectionPanel`, delete dialogs) to `entities/ui/shared/`
9. Delete `managedCatalogs/`, `managedHubs/`, `managedSets/`, `managedEnumerations/` folders
10. Update `ManagedStandardKindSurfaces.tsx` to import from new locations (or remove entirely if `EntityInstanceList` handles the delegation)
11. Fix all import paths across the codebase

### Risk Assessment for Section B

| Risk | Severity | Mitigation |
|------|----------|------------|
| LinkedCollectionListContent is ~1400 lines with complex hub/attribute/layout interactions | HIGH | Migrate incrementally — first move file, then rewire hooks one at a time |
| TreeListContent has drag-reorder tree + widget binding | HIGH | Keep `MetahubHubsService` calls through unified API, only change import paths |
| SharedStateKey break — some hooks share state via query key | MEDIUM | Migrate query keys (Section F) in the same pass |
| Lazy chunk sizes may change, affecting load time | LOW | Verify bundle size after move; renderers are already self-contained |

---

## C. Child-Resource Route Architecture {#section-c}

### Design Topic: Consolidate child-resource routes to entity-only paths

### Current State

`attributesRoutes.ts` supports 4 path shapes per operation:

```typescript
const catalogPaths = (suffix: string) => [
  `/metahub/:metahubId/hub/:hubId/catalog/:catalogId/${suffix}`,           // ① legacy hub-scoped
  `/metahub/:metahubId/catalog/:catalogId/${suffix}`,                       // ② legacy top-level
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,  // ③ entity hub-scoped
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`     // ④ entity top-level
]
```

### Decision: Consolidate to entity-only paths (③ and ④)

Since the DB is being wiped and no backward compatibility is needed:

```typescript
const catalogPaths = (suffix: string) => [
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`
]
```

Path ③ handles the hub-scoped case (catalog belongs to a hub).  
Path ④ handles the top-level case (catalog accessed directly).

### Implementation

```typescript
// attributesRoutes.ts — SIMPLIFIED
const catalogPaths = (suffix: string) => [
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`
]

// constantsRoutes.ts — SIMPLIFIED
const setPaths = (suffix: string) => [
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/set/:setId/${suffix}`,
  `/metahub/:metahubId/entities/:kindKey/instance/:setId/${suffix}`
]

// elementsRoutes.ts — SIMPLIFIED
const catalogElementPaths = (suffix: string) => [
  `/metahub/:metahubId/entities/:kindKey/instance/:hubId/catalog/:catalogId/${suffix}`,
  `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/${suffix}`
]
```

### Why keep dual paths (entity hub-scoped + entity top-level):

The hub-scoped path communicates **authoring context** (which hub this catalog belongs to), which is used by:
- Breadcrumb construction (Hub → Catalog → Attributes)
- Navigation back (user came from hub detail → catalog → attributes)
- Permission resolution (future: hub-scoped permissions)

The top-level path covers direct navigation (user jumps to catalog from sidebar/search).

### Migration Path for Section C

1. Remove legacy path shapes ① and ② from all child-resource route files
2. Update frontend API clients to use only entity-owned paths (already mostly done)
3. Update E2E helpers that target child-resource routes
4. Run focused validation

### Risk Assessment for Section C

| Risk | Severity | Mitigation |
|------|----------|------------|
| Some Playwright support helpers may still use legacy paths | MEDIUM | Grep for legacy patterns, update helpers |
| OpenAPI docs reference all 4 path shapes | LOW | Regenerate OpenAPI after route cleanup |

---

## D. Metahub Create Dialog: Preset-Driven Options {#section-d}

### Design Topic: UI/UX for "Parameters" tab showing preset toggles

### Current State

The current create dialog has hardcoded toggles for `createHub`, `createCatalog`, `createSet`, `createEnumeration` within `MetahubCreateOptions`. The template manifest already references presets:

```typescript
presets: [
  { presetCodename: 'hub', includedByDefault: true },
  { presetCodename: 'catalog', includedByDefault: true },
  { presetCodename: 'set', includedByDefault: true },
  { presetCodename: 'enumeration', includedByDefault: true }
]
```

### Decision: Preset-Driven Create Options UI

#### D.1 Data Model for MetahubCreateOptions

```typescript
// @universo/types — updated interface
export interface MetahubCreateOptions {
  /** Per-preset toggles. Key = preset codename. */
  presetToggles: Record<string, boolean>
}

// Example:
const options: MetahubCreateOptions = {
  presetToggles: {
    hub: true,
    catalog: true,
    set: false,
    enumeration: true
  }
}
```

#### D.2 Create Dialog Parameters Tab

```tsx
// MetahubCreateDialog.tsx → ParametersTab

interface PresetToggleItem {
  codename: string
  name: string          // Resolved from preset VLC name for current locale
  description: string   // Resolved from preset VLC description for current locale
  iconName: string      // From preset entityType.ui.iconName
  includedByDefault: boolean
  defaultInstanceCount: number // Number of defaultInstances[] in preset reference
}

function PresetTogglesPanel({
  presets,
  toggles,
  onToggle,
  uiLocale
}: {
  presets: PresetToggleItem[]
  toggles: Record<string, boolean>
  onToggle: (codename: string, enabled: boolean) => void
  uiLocale: string
}) {
  const { t } = useTranslation('metahubs')

  return (
    <Stack spacing={2}>
      {/* Always-on items (non-toggleable) */}
      <Typography variant="subtitle2" color="text.secondary">
        {t('createOptions.alwaysIncluded')}
      </Typography>
      <FormControlLabel
        control={<Checkbox checked disabled size="small" />}
        label={t('createOptions.mainBranch')}
      />
      <FormControlLabel
        control={<Checkbox checked disabled size="small" />}
        label={t('createOptions.defaultLayout')}
      />

      <Divider sx={{ my: 1 }} />

      {/* Preset toggles */}
      <Typography variant="subtitle2" color="text.secondary">
        {t('createOptions.entityTypes')}
      </Typography>
      {presets.map((preset) => {
        const isEnabled = toggles[preset.codename] ?? preset.includedByDefault
        return (
          <Stack key={preset.codename} direction="row" alignItems="flex-start" spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={isEnabled}
                  onChange={(_, checked) => onToggle(preset.codename, checked)}
                  size="small"
                />
              }
              label={
                <Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <DynamicIcon name={preset.iconName} fontSize="small" />
                    <Typography variant="body2" fontWeight={500}>
                      {preset.name}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {preset.description}
                  </Typography>
                  {isEnabled && preset.defaultInstanceCount > 0 && (
                    <Typography variant="caption" color="primary.main">
                      {t('createOptions.willCreateInstances', { count: preset.defaultInstanceCount })}
                    </Typography>
                  )}
                </Stack>
              }
              sx={{ alignItems: 'flex-start', ml: 0 }}
            />
          </Stack>
        )
      })}
    </Stack>
  )
}
```

#### D.3 Resolving Preset Labels from VLC

```typescript
// In the create dialog setup:
const resolvePresetToggleItems = (
  template: MetahubTemplateManifest,
  presetManifests: Map<string, EntityTypePresetManifest>,
  locale: string
): PresetToggleItem[] => {
  return (template.presets ?? []).map((ref) => {
    const preset = presetManifests.get(ref.presetCodename)
    return {
      codename: ref.presetCodename,
      name: preset ? getVLCString(preset.name, locale) : ref.presetCodename,
      description: preset ? getVLCString(preset.description, locale) : '',
      iconName: preset?.entityType.ui.iconName ?? 'IconBox',
      includedByDefault: ref.includedByDefault,
      defaultInstanceCount: ref.defaultInstances?.length ??
        preset?.defaultInstances?.length ?? 0
    }
  })
}
```

#### D.4 i18n Keys

```json
{
  "createOptions": {
    "alwaysIncluded": "Always included",
    "mainBranch": "Main branch",
    "defaultLayout": "Default layout",
    "entityTypes": "Entity types",
    "willCreateInstances": "Will create {{count}} default instance(s)",
    "willCreateInstances_one": "Will create 1 default instance",
    "willCreateInstances_other": "Will create {{count}} default instances"
  }
}
```

### Migration Path for Section D

1. Update `MetahubCreateOptions` type definition
2. Add preset toggle resolution to metahub create dialog
3. Replace hardcoded `createHub`/`createCatalog`/etc. toggles with dynamic preset list
4. Wire preset toggles to `MetahubSchemaService.createMetahubSchema()` flow
5. Add i18n keys (EN + RU)

---

## E. Default Instance System {#section-e}

### Design Topic: Data model and seed execution flow for preset default instances

### Current State

The `TemplateSeedExecutor` already handles entity creation. Preset manifests already define `defaultInstances` with VLC names/descriptions. The template manifest references presets with `presetCodename`.

### Decision: Extend TemplateSeedExecutor with Preset-Aware 3-Pass Seeding

#### E.1 Data Model (already exists — formalized here)

```typescript
// @universo/types — PresetDefaultInstance (already defined)
export interface PresetDefaultInstance {
  codename: string
  name: VersionedLocalizedContent<string>
  description?: VersionedLocalizedContent<string>
  config?: Record<string, unknown>
  hubs?: string[]                         // Hub codenames to assign to
  attributes?: TemplateSeedAttribute[]    // For catalog-type presets
  constants?: TemplateSeedConstant[]      // For set-type presets
  enumerationValues?: TemplateSeedEnumerationValue[] // For enumeration-type presets
}

// Resolved during seeding:
interface ResolvedPresetSeedEntry {
  presetCodename: string
  kindKey: string
  entityTypeDefinition: EntityTypeDefinition
  defaultInstances: PresetDefaultInstance[]
  enabled: boolean
}
```

#### E.2 Seed Execution Flow (3-Pass)

The seed executor must create entities in dependency order because:
- Hub instances must exist before catalog/set/enumeration instances can reference them via `hubs: ['MainHub']`
- Entity type definitions must exist before instances of that kind can be created
- Hub-assigned child instances need the hub's UUID (resolved from codename)

```
┌─────────────────────────────────────────────────────────┐
│                  SEED EXECUTION FLOW                    │
│                                                         │
│  Input: MetahubTemplateManifest + MetahubCreateOptions  │
│  Transaction: entire seed within single DB transaction  │
│                                                         │
│  PASS 0: Bootstrap                                      │
│  ├── Create layouts                                     │
│  ├── Create zone widgets                                │
│  └── Create settings                                    │
│                                                         │
│  PASS 1: Entity Type Definitions                        │
│  ├── For each enabled preset:                           │
│  │   └── INSERT INTO _mhb_entity_type_definitions       │
│  └── Build entityTypeIdMap: codename → UUID             │
│                                                         │
│  PASS 2: Hub Instances (dependency root)                │
│  ├── For each enabled preset where kindKey = 'hub':     │
│  │   └── For each defaultInstance:                      │
│  │       └── INSERT INTO _mhb_objects (kind='hub')      │
│  └── Build entityIdMap: 'hub:MainHub' → UUID            │
│                                                         │
│  PASS 3: Non-Hub Instances (may reference hubs)         │
│  ├── For each enabled preset where kindKey ≠ 'hub':     │
│  │   └── For each defaultInstance:                      │
│  │       ├── INSERT INTO _mhb_objects                   │
│  │       ├── Resolve hubs[] codenames → UUIDs           │
│  │       ├── Set hub assignments (parent_hub_id)        │
│  │       ├── Seed attributes (if catalog)               │
│  │       ├── Seed constants (if set)                    │
│  │       └── Seed enumeration values (if enumeration)   │
│  └── Build entityIdMap: 'catalog:MainCatalog' → UUID    │
│                                                         │
│  PASS 4: Post-Seed Hub Remapping                        │
│  ├── For non-hub instances with hubs[] references:      │
│  │   └── Resolve hub codenames to UUIDs from entityIdMap│
│  │       and update hub_assignment columns               │
│  └── Update widget configs with resolved hub IDs        │
└─────────────────────────────────────────────────────────┘
```

#### E.3 TemplateSeedExecutor Extension

```typescript
// TemplateSeedExecutor.ts — extended apply() method

async apply(seed: MetahubTemplateSeed, presetEntries: ResolvedPresetSeedEntry[]): Promise<void> {
  await this.knex.transaction(async (trx) => {
    const codenameConfig = resolveTemplateSeedCodenameConfig(seed.settings)

    // PASS 0: Bootstrap (unchanged)
    const layoutIdMap = await this.createLayouts(trx, seed.layouts)
    await this.createZoneWidgets(trx, seed.layoutZoneWidgets, layoutIdMap)
    if (seed.settings?.length) {
      await this.createSettings(trx, seed.settings)
    }

    // PASS 1: Entity type definitions
    const entityTypeIdMap = new Map<string, string>()
    for (const entry of presetEntries.filter(e => e.enabled)) {
      const typeId = await this.createEntityTypeDefinition(trx, entry)
      entityTypeIdMap.set(entry.presetCodename, typeId)
    }

    // PASS 2: Hub instances first (dependency root)
    const entityIdMap = new Map<string, string>()
    const hubEntries = presetEntries.filter(e => e.enabled && e.kindKey === 'hub')
    for (const entry of hubEntries) {
      for (const instance of entry.defaultInstances) {
        const entityId = await this.createEntityInstance(trx, entry.kindKey, instance, codenameConfig)
        entityIdMap.set(buildEntityMapKey(entry.kindKey, instance.codename), entityId)
      }
    }

    // PASS 3: Non-hub instances (catalogs, sets, enumerations)
    const nonHubEntries = presetEntries.filter(e => e.enabled && e.kindKey !== 'hub')
    for (const entry of nonHubEntries) {
      for (const instance of entry.defaultInstances) {
        const entityId = await this.createEntityInstance(trx, entry.kindKey, instance, codenameConfig)
        entityIdMap.set(buildEntityMapKey(entry.kindKey, instance.codename), entityId)

        // Resolve hub references
        if (instance.hubs?.length) {
          for (const hubCodename of instance.hubs) {
            const hubId = entityIdMap.get(buildEntityMapKey('hub', hubCodename))
            if (hubId) {
              await this.assignEntityToHub(trx, entityId, hubId)
            }
          }
        }

        // Seed child resources
        if (instance.attributes?.length && entry.kindKey === 'catalog') {
          await this.createAttributes(trx, entityId, instance.attributes, codenameConfig)
        }
        if (instance.constants?.length && entry.kindKey === 'set') {
          await this.createConstants(trx, entityId, instance.constants, codenameConfig)
        }
        if (instance.enumerationValues?.length && entry.kindKey === 'enumeration') {
          await this.createEnumerationValues(trx, entityId, instance.enumerationValues)
        }
      }
    }

    // PASS 4: Post-seed widget hub ID remapping
    await this.remapWidgetHubReferences(trx, layoutIdMap, entityIdMap)
  })
}
```

#### E.4 Preset Resolution in MetahubSchemaService

```typescript
// MetahubSchemaService.createMetahub() — updated flow

async createMetahub(
  templateCodename: string,
  createOptions: MetahubCreateOptions,
  userId: string
): Promise<string> {
  const template = await this.resolveTemplate(templateCodename)
  const presetManifests = await this.resolvePresets(template.presets ?? [])

  // Build resolved preset entries with toggle state
  const presetEntries: ResolvedPresetSeedEntry[] = (template.presets ?? []).map((ref) => {
    const preset = presetManifests.get(ref.presetCodename)!
    const enabled = createOptions.presetToggles?.[ref.presetCodename] ?? ref.includedByDefault
    return {
      presetCodename: ref.presetCodename,
      kindKey: preset.entityType.kindKey,
      entityTypeDefinition: preset.entityType,
      defaultInstances: enabled ? (preset.defaultInstances ?? []) : [],
      enabled
    }
  })

  // Create schema + apply seed
  const schemaName = await this.createSchema(...)
  const executor = new TemplateSeedExecutor(this.knex, schemaName)
  await executor.apply(template.seed, presetEntries)

  return metahubId
}
```

### Migration Path for Section E

1. Update `TemplateSeedExecutor.apply()` to accept preset entries
2. Add `createEntityTypeDefinition()` method to `TemplateSeedExecutor`
3. Add `assignEntityToHub()` and attribute/constant/value seeding methods
4. Update `MetahubSchemaService.createMetahub()` to resolve presets and build entries
5. Update `MetahubCreateOptions` type to `presetToggles`
6. Remove `seed.entities[]` from template manifests (replaced by preset-driven seeding)
7. Write focused seeding tests

### Risk Assessment for Section E

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hub codename → UUID resolution fails if hub preset is disabled | MEDIUM | Validate preset dependencies at create-time: if catalog has `hubs: ['MainHub']`, require hub preset enabled |
| Transaction size for large preset + instance sets | LOW | Already proven with current seed executor |
| Preset manifest schema drift | LOW | Zod validation at manifest load time |

---

## F. Entity Type Query Keys & Cache Invalidation {#section-f}

### Design Topic: Unified TanStack Query key tree and invalidation strategy

### Current State (dual tree)

```typescript
// Legacy per-kind tree:
metahubsQueryKeys.hubs(metahubId)                          // ['metahubs', 'detail', id, 'hubs']
metahubsQueryKeys.hubsList(metahubId, params)
metahubsQueryKeys.hubDetail(metahubId, hubId)
metahubsQueryKeys.catalogs(metahubId, hubId)                 // different shape per kind
...

// Entity tree:
metahubsQueryKeys.entities(metahubId, kind)                  // ['metahubs', 'detail', id, 'entities', kind]
metahubsQueryKeys.entitiesList(metahubId, params)
metahubsQueryKeys.entityDetail(metahubId, entityId)
```

### Decision: Single Entity-Scoped Tree

#### F.1 Unified Query Key Factory

```typescript
export const metahubsQueryKeys = {
  all: ['metahubs'] as const,

  // ═══════ Metahub-level (unchanged) ═══════
  lists: () => [...metahubsQueryKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => { ... },
  detail: (id: string) => [...metahubsQueryKeys.all, 'detail', id] as const,
  members: (id: string) => [...metahubsQueryKeys.detail(id), 'members'] as const,

  // ═══════ Templates (unchanged) ═══════
  templates: () => [...metahubsQueryKeys.all, 'templates'] as const,
  templatesList: (params?) => [...metahubsQueryKeys.templates(), 'list', normalized] as const,
  templateDetail: (id: string) => [...metahubsQueryKeys.templates(), 'detail', id] as const,

  // ═══════ Branches (unchanged) ═══════
  branches: (metahubId: string) => [...metahubsQueryKeys.detail(metahubId), 'branches'] as const,

  // ═══════ Entity Types ═══════
  entityTypes: (metahubId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'entityTypes'] as const,
  entityTypesList: (metahubId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.entityTypes(metahubId), 'list', normalized] as const,
  entityTypeDetail: (metahubId: string, entityTypeId: string) =>
    [...metahubsQueryKeys.entityTypes(metahubId), 'detail', entityTypeId] as const,

  // ═══════ Entity Instances (UNIFIED — replaces hubs/catalogs/sets/enumerations trees) ═══════
  instances: (metahubId: string, kindKey: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'instances', kindKey] as const,

  instancesList: (
    metahubId: string,
    kindKey: string,
    params?: PaginationParams & { locale?: string; includeDeleted?: boolean; onlyDeleted?: boolean }
  ) => {
    const normalized = {
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
      sortBy: params?.sortBy ?? 'updated',
      sortOrder: params?.sortOrder ?? 'desc',
      search: params?.search?.trim() || undefined,
      locale: params?.locale,
      includeDeleted: params?.includeDeleted ?? false,
      onlyDeleted: params?.onlyDeleted ?? false
    }
    return [...metahubsQueryKeys.instances(metahubId, kindKey), 'list', normalized] as const
  },

  instanceDetail: (metahubId: string, kindKey: string, instanceId: string) =>
    [...metahubsQueryKeys.instances(metahubId, kindKey), 'detail', instanceId] as const,

  // ═══════ Instance Children (hub → catalog/set/enum children) ═══════
  instanceChildren: (
    metahubId: string, parentKindKey: string, parentId: string, childKindKey: string
  ) => [...metahubsQueryKeys.instanceDetail(metahubId, parentKindKey, parentId), 'children', childKindKey] as const,

  instanceChildrenList: (
    metahubId: string,
    parentKindKey: string,
    parentId: string,
    childKindKey: string,
    params?: PaginationParams
  ) => {
    const normalized = { /* ... */ }
    return [...metahubsQueryKeys.instanceChildren(metahubId, parentKindKey, parentId, childKindKey), 'list', normalized] as const
  },

  // ═══════ Blocking References ═══════
  blockingReferences: (metahubId: string, kindKey: string, instanceId: string) =>
    [...metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId), 'blockingReferences'] as const,

  // ═══════ Child Resources (scoped to entity instance) ═══════
  attributes: (metahubId: string, catalogId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'attributes', catalogId] as const,
  attributesList: (metahubId: string, catalogId: string, params?: PaginationParams & { scope?: string }) =>
    [...metahubsQueryKeys.attributes(metahubId, catalogId), 'list', normalized] as const,
  attributeDetail: (metahubId: string, catalogId: string, attributeId: string) =>
    [...metahubsQueryKeys.attributes(metahubId, catalogId), 'detail', attributeId] as const,

  constants: (metahubId: string, setId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'constants', setId] as const,
  constantsList: (metahubId: string, setId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.constants(metahubId, setId), 'list', normalized] as const,

  elements: (metahubId: string, catalogId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'elements', catalogId] as const,
  elementsList: (metahubId: string, catalogId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.elements(metahubId, catalogId), 'list', normalized] as const,

  enumerationValues: (metahubId: string, enumerationId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'enumerationValues', enumerationId] as const,
  enumerationValuesList: (metahubId: string, enumerationId: string, params?: PaginationParams) =>
    [...metahubsQueryKeys.enumerationValues(metahubId, enumerationId), 'list', normalized] as const,

  // ═══════ Layouts (unchanged — already generic) ═══════
  layoutsRoot: (metahubId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'layouts'] as const,

  // ═══════ Shared Entity Overrides (unchanged) ═══════
  sharedEntityOverrides: (metahubId: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'sharedEntityOverrides'] as const,
}
```

#### F.2 Key Tree Visualization

```
['metahubs']
├── ['list', params]
│
├── ['detail', metahubId]
│   ├── ['entityTypes']
│   │   ├── ['list', params]
│   │   └── ['detail', entityTypeId]
│   │
│   ├── ['instances', kindKey]                    ← unified per-kind scope
│   │   ├── ['list', params]
│   │   └── ['detail', instanceId]
│   │       ├── ['children', childKindKey]
│   │       │   └── ['list', params]
│   │       └── ['blockingReferences']
│   │
│   ├── ['attributes', catalogId]                 ← scoped to catalog instance
│   │   ├── ['list', params]
│   │   └── ['detail', attributeId]
│   │
│   ├── ['constants', setId]                      ← scoped to set instance
│   │   └── ['list', params]
│   │
│   ├── ['elements', catalogId]                   ← scoped to catalog instance
│   │   └── ['list', params]
│   │
│   ├── ['enumerationValues', enumerationId]      ← scoped to enumeration instance
│   │   └── ['list', params]
│   │
│   ├── ['branches']
│   │   ├── ['list', params]
│   │   └── ['detail', branchId]
│   │
│   ├── ['layouts', scope]
│   │   └── ['list', params]
│   │
│   └── ['members']
│       └── ['list', params]
│
└── ['templates']
    ├── ['list', params]
    └── ['detail', templateId]
```

#### F.3 Invalidation Patterns

```typescript
// ═══════ Instance mutations ═══════

// After creating/updating/deleting an instance:
const invalidateInstanceList = (metahubId: string, kindKey: string) =>
  queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.instances(metahubId, kindKey)
  })

// After updating a specific instance:
const invalidateInstance = (metahubId: string, kindKey: string, instanceId: string) =>
  queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId)
  })

// ═══════ Cross-kind invalidation ═══════

// After deleting a hub (may affect child lists):
const invalidateHubDeletion = (metahubId: string, hubId: string) => {
  // Invalidate hub list
  invalidateInstanceList(metahubId, 'hub')
  // Invalidate all children lists of this hub
  queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.instanceDetail(metahubId, 'hub', hubId)
  })
  // Invalidate catalog/set/enumeration lists (hub assignments may change)
  invalidateInstanceList(metahubId, 'catalog')
  invalidateInstanceList(metahubId, 'set')
  invalidateInstanceList(metahubId, 'enumeration')
}

// ═══════ Child resource invalidation ═══════

// After creating/modifying an attribute:
const invalidateAttributes = (metahubId: string, catalogId: string) =>
  queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.attributes(metahubId, catalogId)
  })

// ═══════ Nuclear invalidation (board refresh, settings change) ═══════
const invalidateAllInstances = (metahubId: string) =>
  queryClient.invalidateQueries({
    queryKey: [...metahubsQueryKeys.detail(metahubId), 'instances']
  })
```

#### F.4 Optimistic Updates (where safe)

```typescript
// Reorder is safe for optimistic updates:
const useReorderInstances = (metahubId: string, kindKey: string) =>
  useMutation({
    mutationFn: (ids: string[]) => reorderInstances(metahubId, kindKey, ids),
    onMutate: async (ids) => {
      // Cancel pending queries for this list
      await queryClient.cancelQueries({
        queryKey: metahubsQueryKeys.instances(metahubId, kindKey)
      })
      // Snapshot previous state
      const previous = queryClient.getQueryData(
        metahubsQueryKeys.instancesList(metahubId, kindKey, currentParams)
      )
      // Optimistically reorder
      if (previous) {
        queryClient.setQueryData(
          metahubsQueryKeys.instancesList(metahubId, kindKey, currentParams),
          reorderItems(previous, ids)
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          metahubsQueryKeys.instancesList(metahubId, kindKey, currentParams),
          context.previous
        )
      }
    },
    onSettled: () => {
      invalidateInstanceList(metahubId, kindKey)
    }
  })

// Instance name/description edit is safe for optimistic:
const useUpdateInstance = (metahubId: string, kindKey: string) =>
  useMutation({
    mutationFn: ({ instanceId, data }) => updateEntityInstance(metahubId, instanceId, data),
    onMutate: async ({ instanceId, data }) => {
      const key = metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      if (previous) {
        queryClient.setQueryData(key, { ...previous, ...data })
      }
      return { previous, key }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous)
      }
    },
    onSettled: (_data, _err, { instanceId }) => {
      invalidateInstance(metahubId, kindKey, instanceId)
      invalidateInstanceList(metahubId, kindKey)
    }
  })
```

### Migration Path for Section F

1. Define the unified query key tree in a fresh `queryKeys.ts` (or update existing)
2. Create a migration map: old key → new key for each legacy entry point
3. Update all hooks to use unified keys
4. Remove legacy per-kind query key entries (`hubs`, `hubsList`, `catalogs`, `catalogsList`, etc.)
5. Update all invalidation callsites
6. Add focused query key tests that verify tree structure

### Risk Assessment for Section F

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cache invalidation regression — some UI doesn't refresh after mutation | HIGH | Write focused smoke tests for each mutation → list refresh path |
| Stale data across kind boundaries (hub deletion → catalog list staleness) | MEDIUM | Cross-kind invalidation helpers with explicit dependency chains |
| Query key collision between different kinds | LOW | Kind key is always part of the key tuple; impossible to collide |

---

## Cross-Cutting Concerns {#cross-cutting}

### Security

- **RBAC**: All entity instance mutations go through `ensureMetahubAccess(req, resolveManagedAclPermission(kind, operation))`. The ACL map resolves to `createContent` for create, `editContent` for edit/copy, `deleteContent` for delete, `readContent` for all reads.
- **SQL Injection**: All queries use parameterized SQL via `MetahubObjectsService` and `DbExecutor.query()`. No raw string interpolation.
- **CSRF**: Existing session-based CSRF protection unchanged.
- **Input Validation**: Zod schemas validate all request payloads before any database operation.

### Performance

- **Lazy Loading**: Standard-kind renderers are lazy-loaded (`React.lazy()`), so the initial bundle only loads the generic shell.
- **Optimistic Updates**: Safe for reorder and name/description edits; full refetch for structural changes.
- **Query Deduplication**: TanStack Query's `staleTime` and `gcTime` prevent redundant fetches during navigation.
- **Pagination**: All list endpoints support cursor/offset pagination; default limit 100.

### i18n

- **UI text**: All through `useTranslation('metahubs')` with existing key structure.
- **VLC**: Entity type names/descriptions are VLC (`VersionedLocalizedContent`) — resolved per locale at render time.
- **Preset labels**: Resolved from VLC `name`/`description` in preset manifest, not from i18n keys.
- **New keys needed**: `createOptions.*` block for preset toggle labels (EN + RU).

### Testing

- **Behavior services**: Pure functions with injected dependencies — unit testable with mock `SqlQueryable`.
- **Controller**: Tested through HTTP-level route tests (existing `supertest` pattern).
- **Query keys**: Structural smoke tests verifying key tree matches expected shape.
- **Renderers**: Vitest + React Testing Library for each renderer in isolation.
- **E2E**: Existing Playwright flows updated to use only entity-owned routes.

---

## Migration Path {#migration-path}

### Execution Order

The sections have dependencies that dictate implementation order:

```
Section F (Query Keys)          ← Foundation: must be done first or in parallel with B
    ↓
Section A (Backend Behavior)    ← Can proceed independently
    ↓
Section C (Child Routes)        ← Depends on A (backend routes simplified first)
    ↓
Section B (Frontend Renderers)  ← Depends on A (API surface finalized) + F (query keys unified)
    ↓
Section D (Create Dialog)       ← Depends on E (preset model finalized)
    ↓
Section E (Default Instances)   ← Can proceed after A/B but shares D data model
```

### Recommended Implementation Phases

#### Phase 1: Foundation (Sections F + A backend internals)
- Define unified query key tree
- Create behavior service interface + registry
- Extract behavior services from legacy controllers
- **Validation**: Focused backend tests pass, frontend still uses old query keys (compatibility)

#### Phase 2: Backend Route Cleanup (Sections A routes + C)
- Simplify `entityInstancesRoutes.ts` — remove dispatch, remove legacy controller imports
- Consolidate child-resource routes to entity-only paths
- Delete legacy domain folders
- **Validation**: All backend tests pass, OpenAPI regenerated

#### Phase 3: Frontend Unification (Section B + F finalization)
- Move managed* UI to `entities/ui/renderers/`
- Migrate all hooks to unified query keys
- Delete managed* folders + legacy query key entries
- **Validation**: Frontend Vitest passes, build green

#### Phase 4: Preset & Seed System (Sections D + E)
- Update `MetahubCreateOptions` type
- Extend `TemplateSeedExecutor` with preset-aware seeding
- Implement preset toggle UI in create dialog
- **Validation**: Seed tests pass, create flow E2E passes

#### Phase 5: Final Validation
- Full build green
- E2E flows pass on entity-owned routes only
- OpenAPI regenerated and validated
- EN/RU docs updated
- Memory bank synced

---

## Risk Assessment {#risk-assessment}

### Aggregate Risk Matrix

| Risk | Section | Severity | Likelihood | Mitigation |
|------|---------|----------|------------|------------|
| Hub hierarchy extraction complexity | A | HIGH | MEDIUM | Keep `MetahubHubsService` intact; behavior service wraps it |
| LinkedCollectionListContent (1400 LOC) migration | B | HIGH | MEDIUM | Incremental: move file first, rewire hooks one by one |
| Cache invalidation regression | F | HIGH | LOW | Write cross-kind invalidation smoke tests up front |
| Hub-scoped child route SQL migration | A/C | MEDIUM | MEDIUM | Keep SQL in shared helper functions, not in controllers |
| Preset dependency validation (hub required for catalog) | E | MEDIUM | LOW | Validate at create-time before seeding |
| Playwright support helper breakage | C | MEDIUM | LOW | Grep and update all E2E helpers in same pass |
| Bundle chunk size changes | B | LOW | LOW | Verify with build analysis after move |
| i18n key additions | D | LOW | LOW | EN + RU keys added atomically |

### Rollback Strategy

Since the test DB will be wiped, there is no data rollback concern. Code rollback is standard git:
- Each phase can be reverted independently (git revert)
- No schema migrations to undo
- No settings format to back-convert

### Success Criteria

1. **Zero legacy domain folders** in `packages/metahubs-backend/base/src/domains/` (no `hubs/`, `catalogs/`, `sets/`, `enumerations/`)
2. **Zero managed domain folders** in `packages/metahubs-frontend/base/src/domains/` (no `managedHubs/`, `managedCatalogs/`, `managedSets/`, `managedEnumerations/`)
3. **Single query key tree** — no legacy per-kind query key factories
4. **Single entity API layer** — no per-kind API client files
5. **Entity-only child routes** — no legacy path shapes
6. **Preset-driven create dialog** — no hardcoded `createHub`/`createCatalog` toggles
7. **Full build green** + focused test suites pass
8. **E2E browser flows pass** on entity-owned routes only
