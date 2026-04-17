# Legacy Removal + Entity-Based Metadata Types Promotion — Implementation Plan

> **Created**: 2026-04-13  
> **Updated**: 2026-04-13 (post-QA corrections finalized)  
> **Status**: Plan — QA-corrected and awaiting implementation approval  
> **Complexity**: Level 4 — Major/Complex (multi-package refactoring + new features + E2E + docs)  
> **Branch**: `feature/legacy-removal-entity-promotion`  
> **Prerequisite**: PR #763 merged, clean `main` with green build  
> **Creative design**: [creative-legacy-removal-entity-promotion.md](../creative/creative-legacy-removal-entity-promotion.md)  
> **QA review**: [qa-legacy-removal-plan-review-2026-04-13.md](qa-legacy-removal-plan-review-2026-04-13.md)  
> **Previous plans**: [entity-component-architecture-plan-2026-04-08.md](entity-component-architecture-plan-2026-04-08.md), [entities-v2-hubs-sets-enumerations-plan-2026-04-11.md](entities-v2-hubs-sets-enumerations-plan-2026-04-11.md)

---

## Overview

Remove **all legacy hardcoded metadata object domains** (Hubs, Catalogs, Sets, Enumerations) from both backend and frontend. Promote Entity V2 types to be the **sole implementation**, rename kind keys from `custom.catalog-v2` to `catalog`, connect entity type presets to metahub templates with default instances support, and make the sidebar 100% dynamic. The test database will be dropped and recreated fresh — **no backward compatibility needed**.

**Key constraints from the user**:
- No legacy code preservation required
- Test DB will be wiped and recreated
- No schema/template version bumps needed
- Architecture can be significantly changed
- Serious refactoring is permitted

---

## Table of Contents

1. [Phase 1: Types & Interfaces Foundation](#phase-1)
2. [Phase 2: Backend — Template & Preset System Update](#phase-2)
3. [Phase 3: Frontend — Legacy API Migration & Component Consolidation](#phase-3)
4. [Phase 4: Backend — Legacy Domain Removal](#phase-4)
5. [Phase 5: Frontend — Sidebar & Route Unification](#phase-5)
6. [Phase 6: Schema-DDL & Runtime Simplification](#phase-6)
7. [Phase 7: Snapshot & Settings Cleanup](#phase-7)
8. [Phase 8: i18n Updates](#phase-8)
9. [Phase 9: Unit & Integration Tests](#phase-9)
10. [Phase 10: E2E Playwright Tests](#phase-10)
11. [Phase 11: Fixture Regeneration](#phase-11)
12. [Phase 12: Documentation (EN/RU)](#phase-12)
13. [Phase 13: Final Validation & Build](#phase-13)
14. [Potential Challenges](#challenges)
15. [Files Changed Summary](#files-summary)

> **Phase order rationale (QA correction)**: Frontend migration (Phase 3) must precede backend legacy deletion (Phase 4) because legacy list components (CatalogList, HubList, SetList, EnumerationList) currently call legacy backend endpoints. If backend routes are deleted before frontend consumers are migrated to the unified API, the application will be broken and untestable during development.

---

## Phase 1: Types & Interfaces Foundation {#phase-1}

> Goal: Update `@universo/types` to reflect the new unified entity model before touching backend/frontend code.

### Step 1.1: Update kind keys in entity type presets

**Files**:
- `packages/universo-types/base/src/common/entityTypeDefinition.ts`

**Actions**:
- Remove `LEGACY_COMPATIBLE_KIND_KEYS` mapping (`custom.catalog-v2` → `catalog` etc.)
- Remove `getLegacyCompatibleObjectKind()`, `isLegacyCompatibleObjectKind()`, `getLegacyCompatibleObjectKindForKindKey()`
- Remove `LEGACY_COMPATIBLE_OBJECT_KINDS` constant
- Add `StandardEntityKinds` const object (without DOCUMENT per TZ #2 — "пока не будет Документов"):

```typescript
export const StandardEntityKinds = {
    CATALOG: 'catalog',
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub'
} as const

export type StandardEntityKind = (typeof StandardEntityKinds)[keyof typeof StandardEntityKinds]
export type EntityKind = StandardEntityKind | (string & {})
```

> **QA note**: DOCUMENT intentionally excluded. When documents are needed in the future, add `DOCUMENT: 'document'` to `StandardEntityKinds` and create a new preset.

### Step 1.2: Remove `isBuiltin` field entirely

**File**: `packages/universo-types/base/src/common/entityTypeDefinition.ts`

**Actions**:
- Remove `isBuiltin` from `EntityTypeDefinition` interface — do NOT replace with `source` or any other discriminator field
- Remove `source: 'builtin' | 'custom'` from `ResolvedEntityType`
- All entity type definitions (whether from presets or custom-created) are equal DB rows with no distinguishing column

> **TZ #3 rationale**: *"я пока не вижу необходимости их как-то специальным образом помечать в таблице типов сущностей, поэтому нужно убрать колонку 'Источник'"*. No replacement field is needed.

```typescript
export interface EntityTypeDefinition {
    kindKey: EntityKind
    components: ComponentManifest
    ui: EntityTypeUIConfig
    presentation?: {
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string>
    }
    config?: Record<string, unknown>
}
```

### Step 1.3: Delete builtinEntityTypes.ts — move presets to backend-only seed data

**File**: `packages/universo-types/base/src/common/builtinEntityTypes.ts` → DELETE entirely

**Actions**:
- Delete `builtinEntityTypes.ts` from `@universo/types` — the `BUILTIN_ENTITY_TYPE_REGISTRY` must not exist as a runtime registry
- Delete `BUILTIN_ENTITY_TYPES` array and all individual type constants (`CATALOG_TYPE`, `HUB_TYPE`, `SET_TYPE`, `ENUMERATION_TYPE`, `DOCUMENT_TYPE`)
- Entity type preset definitions move to backend-only seed data: `packages/metahubs-backend/base/src/domains/templates/data/presets/` (already there, just remove `@universo/types` dependency)
- At metahub creation, `TemplateSeedExecutor` reads preset manifests and inserts rows into `_mhb_entity_type_definitions` table. After that, **all entity type resolution comes exclusively from the DB**
- Remove all imports of `BUILTIN_ENTITY_TYPE_REGISTRY` / `BUILTIN_ENTITY_TYPES` across the codebase

> **TZ #3 rationale**: Entity type presets are seed data, not runtime constants. Once seeded into the DB, they are identical to custom entity types. No runtime registry needed.

**Impact on other packages**:
- `EntityTypeResolver` (metahubs-backend): remove `resolveBuiltin()` method — DB-only lookup
- `SnapshotSerializer` (metahubs-backend): remove `BUILTIN_ENTITY_TYPE_REGISTRY.entries()` fallback — load all types from DB
- `EntityTypeService` (metahubs-backend): remove `listCustomTypes()` → just `listTypes()` (no builtin/custom distinction)
- `entityTypesController` (metahubs-backend): remove `includeBuiltins` query parameter — all types returned equally

### Step 1.4: Add template ↔ preset connection interfaces

**File**: `packages/universo-types/base/src/common/metahubs.ts`

**Actions**:
- Add `PresetDefaultInstance` and extend `EntityTypePresetManifest` so reusable entity presets can carry their own predefined instances:

```typescript
export interface PresetDefaultInstance {
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    config?: Record<string, unknown>
    hubs?: string[]
    attributes?: TemplateSeedAttribute[]
    constants?: TemplateSeedConstant[]
    enumerationValues?: TemplateSeedEnumerationValue[]
}

export interface EntityTypePresetManifest {
    $schema: 'entity-type-preset/v1'
    codename: string
    version: string
    minStructureVersion: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    meta?: MetahubTemplateMeta
    entityType: {
        kindKey: string
        codename?: VersionedLocalizedContent<string>
        components: ComponentManifest
        ui: EntityTypeUIConfig
        presentation?: Record<string, unknown>
        config?: Record<string, unknown>
    }
    defaultInstances?: PresetDefaultInstance[]
}

export interface TemplatePresetReference {
    /** Codename of the preset in the template's presets registry */
    presetCodename: string
    includedByDefault: boolean
}
```

> **TZ alignment note**: The reusable entity preset owns its final `entityType.kindKey` (for example `'catalog'` or `'hub'`). The metahub template should only reference which presets participate in creation; it should not introduce a second template-level kind-key override layer unless a future product requirement explicitly needs it.

> **Architecture refinement**: `defaultInstances` must live in the reusable `EntityTypePresetManifest`, not be duplicated inside `MetahubTemplateManifest.presets[]`. The repository already has a first-class `entity_type_preset` template registry plus validator and frontend selector flow, so preset-defined instances should travel with that manifest and metahub templates should only declare which presets are included.

- Update `MetahubCreateOptions`:

```typescript
export interface MetahubCreateOptions {
    presetToggles?: Record<string, boolean>
}
```

- Add `presets?: TemplatePresetReference[]` to `MetahubTemplateManifest` (or the relevant template type)
- Remove legacy `createHub`, `createCatalog`, `createSet`, `createEnumeration` boolean flags from `MetahubCreateOptions`

### Step 1.5: Update sidebar entity type interface

**File**: `packages/universo-types/base/src/common/metahubs.ts` or `entityTypeDefinition.ts`

**Actions**:
- Add `MetahubMenuEntityType` interface:

```typescript
export interface MetahubMenuEntityType {
    kindKey: string
    title: string
    iconName: string
    sidebarSection?: 'objects' | 'admin'
    sidebarOrder?: number
}
```

### Step 1.6: Update package exports and barrel files

**Files**: `packages/universo-types/base/src/index.ts`, other barrel files

**Actions**:
- Update exports to reflect renamed/new files
- Ensure backward-compatible re-exports are NOT added (clean break)

**Checklist**:
- [ ] Step 1.1: Remove legacy kind key mappings, add StandardEntityKinds (without DOCUMENT)
- [ ] Step 1.2: Remove `isBuiltin` field entirely — no replacement
- [ ] Step 1.3: Delete `builtinEntityTypes.ts` from `@universo/types` — presets are backend-only seed data
- [ ] Step 1.4: Add template ↔ preset ↔ default instances interfaces
- [ ] Step 1.5: Add MetahubMenuEntityType interface
- [ ] Step 1.6: Update package exports
- [ ] Build `@universo/types` to verify: `pnpm --filter @universo/types build`

---

## Phase 2: Backend — Template & Preset System Update {#phase-2}

> Goal: Connect entity type presets to metahub templates, add default instances support. Presets become backend-only seed data inserted into DB at metahub creation time.

### Step 2.1: Update entity type preset manifests

**Files**: All preset files in `packages/metahubs-backend/base/src/domains/templates/data/presets/`

**Actions**:
- `catalog-v2.entity-preset.ts` → rename to `catalog.entity-preset.ts`, change `kindKey: 'catalog'`
- `hub-v2.entity-preset.ts` → rename to `hub.entity-preset.ts`, change `kindKey: 'hub'`
- `set-v2.entity-preset.ts` → rename to `set.entity-preset.ts`, change `kindKey: 'set'`
- `enumeration-v2.entity-preset.ts` → rename to `enumeration.entity-preset.ts`, change `kindKey: 'enumeration'`
- **Delete** `document-workspace.entity-preset.ts` — TZ #2: no documents. This file imports `DOCUMENT_TYPE` which will be removed
- Decide on `constants-library.entity-preset.ts`: rename `kindKey` from `custom.constants-library` to `constants-library` (remove `custom.` prefix). Keep if useful, or delete if redundant with `set` preset
- Remove `isBuiltin: true` from all presets — no replacement field
- Preset definitions now ONLY exist here as builtin seed sources (not in `@universo/types`); they seed the existing template catalog and are later consumed through that catalog during metahub creation
- Move component/UI definitions that were previously in `@universo/types` `CATALOG_TYPE`, `HUB_TYPE`, etc. into these preset files directly
- Add `sidebarOrder` to UI config (hub=10, catalog=20, set=30, enumeration=40)
- Add `defaultInstances` to the built-in hub/catalog/set/enumeration preset manifests with the localized Main/Основной entries and descriptions that should be created when the preset is enabled

### Step 2.2: Add presets[] to template manifests

**Files**:
- `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts`

**Actions**:
- Add `presets: TemplatePresetReference[]` to each template
- Remove `seed.entities[]` (replaced by `presets[]` references plus `defaultInstances[]` stored in the referenced `entity_type_preset` manifests)
- Example for `basic.template.ts`:

```typescript
presets: [
    {
        presetCodename: 'hub',
        includedByDefault: true
    },
    {
        presetCodename: 'catalog',
        includedByDefault: true
    },
    {
        presetCodename: 'set',
        includedByDefault: true
    },
    {
        presetCodename: 'enumeration',
        includedByDefault: true
    }
]
```

> **QA refinement**: The metahub template should decide **which** presets participate in metahub creation. The reusable entity preset manifest should decide **which default instances** belong to that preset and what localized name/description payload they carry.

### Step 2.3: Update TemplateSeedExecutor

**File**: `packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedExecutor.ts`

**Actions**:
- Replace `createEntities()`-only seeding with a two-stage flow: first create entity type definitions from template preset references, then create preset default instances
- Resolve `presetCodename` through the existing template catalog seam for `definitionType='entity_type_preset'` (reusing the seeded builtin templates as the bootstrap source), not through filesystem scanning and not through a second runtime registry dedicated only to metahub creation
- New flow for each preset:
    1. Check `presetToggles[presetCodename] ?? includedByDefault`
    2. If included: resolve the referenced `EntityTypePresetManifest` from the existing template catalog / active manifest seam, then create `_mhb_entity_type_definitions` row from `presetManifest.entityType`
    3. Use `presetManifest.entityType.kindKey` as the single source of truth for the created entity type key
    4. For each `presetManifest.defaultInstances[]`: create `_mhb_objects` row with `kind = resolvedKindKey`, seed attributes/constants/enumerationValues if defined
- Make preset default-instance seeding dependency-aware instead of coupling it to UI ordering: create all entity type definitions first, then create hub-kind default instances and record codename → objectId mappings, then create the remaining default instances, and finally apply hub-assignment links / other cross-instance references in a dedicated final pass
- Introduce explicit internal helpers such as `createEntityTypeDefinitions()` and `createPresetDefaultInstances()` inside `TemplateSeedExecutor` rather than mixing type-definition creation into the old `seed.entities` pass
- Remove legacy `createEnumerationValues()` separate pass — fold it into preset default instance seeding

### Step 2.4: Update MetahubSchemaService.filterSeedByCreateOptions

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

> **QA correction**: `filterSeedByCreateOptions()` is a static method on `MetahubSchemaService` (line 631), NOT in `TemplateSeedExecutor` as previously stated.

**Actions**:
- Update `filterSeedByCreateOptions()` to use `presetToggles` instead of legacy boolean flags (`createHub`, `createCatalog`, etc.)
- Update `createMetahub()` flow to pass new `MetahubCreateOptions` format
- Remove legacy `createOptions.createHub` / `createCatalog` etc. branching
- Filter template preset references/default-instance seeding inputs, not only the old `seed.entities` array

### Step 2.5: Update metahubsController create handler

**Files**:
- `packages/metahubs-backend/base/src/domains/metahubs/controllers/metahubsController.ts`
- `packages/universo-types/base/src/common/metahubs.ts`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/metahubListUtils.ts`

**Actions**:
- Parse new `MetahubCreateOptions` format from request body
- Pass `presetToggles` through to `MetahubSchemaService`
- Remove the legacy `createHub` / `createCatalog` / `createSet` / `createEnumeration` DTO fields from shared types and form state
- Update the actual metahub create dialog implementation in `MetahubList.tsx` (there is no standalone `MetahubCreateDialog.tsx` file in the current codebase)

### Step 2.6: Update boardSummary endpoint

**File**: `packages/metahubs-backend/base/src/domains/metahubs/controllers/metahubsController.ts`

> **QA addition**: `boardSummary` uses `resolveLegacyCompatibleKindsInSchema()` to count hubs and catalogs. This will break when legacy compatibility utilities are removed.

**Actions**:
- Update `boardSummary` to query entity counts generically from `_mhb_objects` grouped by `kind` column
- Return `entityCounts: Record<string, number>` as the primary future-proof contract for template-driven metahubs
- Preserve derived `hubsCount` / `catalogsCount` response fields temporarily only as frontend compatibility aliases until `MetahubBoard.tsx`, `packages/metahubs-frontend/base/src/domains/metahubs/api/metahubs.ts`, and related board tests switch to `entityCounts`
- Remove `resolveLegacyCompatibleKindsInSchema()` from this path entirely

**Checklist**:
- [ ] Step 2.1: Rename preset files, update kind keys, delete document-workspace preset
- [ ] Step 2.2: Add presets[] to template manifests
- [ ] Step 2.3: Update TemplateSeedExecutor
- [ ] Step 2.4: Update MetahubSchemaService.filterSeedByCreateOptions
- [ ] Step 2.5: Update metahubsController create handler
- [ ] Step 2.6: Update boardSummary endpoint
- [ ] Build backend: `pnpm --filter metahubs-backend build`

---

## Phase 3: Frontend — Legacy API Migration & Component Consolidation {#phase-3}

> Goal: Migrate all legacy frontend consumers to the unified entity API BEFORE backend legacy routes are deleted (Phase 4). Move specialized list components into entities domain.
>
> **QA rationale**: Legacy list components (CatalogList → catalogsApi, HubList → hubsApi, etc.) currently call legacy backend endpoints. Frontend must be migrated to the unified API first, otherwise the app would be broken and untestable when legacy backend routes are removed.

### Step 3.1: Migrate legacy list component data sources to unified API

**Current state** (parallel systems that must be consolidated):
- CatalogList → `useLinkedCollectionListData` → `catalogsApi` (legacy `/catalogs` endpoints)
- HubList → `useTreeListData` → `hubsApi` (legacy `/hubs` endpoints)
- SetList → `useValueGroupListData` → `setsApi` (legacy `/sets` endpoints)
- EnumerationList → `useOptionListData` → `enumerationsApi` (legacy `/enumerations` endpoints)

**Target**: All list components use the **existing** unified API at `entities/api/entityInstances.ts` and unified hooks at `entities/hooks/queries.ts`.

> **QA note**: `entityInstances.ts` already exists with full CRUD (list, get, create, update, delete, restore, permanentDelete, copy, reorder). No new API file needed — the real work is migrating consumers.

**Actions per component**:
1. Replace `useLinkedCollectionListData` → `useEntityInstancesQuery({ kind: 'catalog', ... })`
2. Replace `useTreeListData` → `useEntityInstancesQuery({ kind: 'hub', ... })`
3. Replace `useValueGroupListData` → `useEntityInstancesQuery({ kind: 'set', ... })`
4. Replace `useOptionListData` → `useEntityInstancesQuery({ kind: 'enumeration', ... })`
5. Replace mutation hooks (`useCatalogMutations`, etc.) → unified entity mutation hooks
6. Verify each component works against the unified `/entities` endpoint before proceeding

### Step 3.2: Move specialized list components to entities/ui/renderers/

**Source → Destination mapping**:
```
catalogs/ui/CatalogList.tsx   → entities/ui/renderers/CatalogListRenderer.tsx
hubs/ui/HubList.tsx           → entities/ui/renderers/HubListRenderer.tsx
sets/ui/SetList.tsx           → entities/ui/renderers/SetListRenderer.tsx
enumerations/ui/EnumerationList.tsx → entities/ui/renderers/EnumerationListRenderer.tsx
```

**Actions**:
- Move files, update import paths
- Each renderer must already use the unified entity instances API (from Step 3.1)
- Keep `HubSelectionPanel` → move to `entities/ui/shared/HubSelectionPanel.tsx`

### Step 3.3: Simplify EntityInstanceList delegation

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx`

**Actions**:
- Replace `resolveLegacyCompatibleKind()` with direct `kindKey` matching:

```tsx
const INSTANCE_RENDERERS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
    catalog: lazy(() => import('./renderers/CatalogListRenderer')),
    hub: lazy(() => import('./renderers/HubListRenderer')),
    set: lazy(() => import('./renderers/SetListRenderer')),
    enumeration: lazy(() => import('./renderers/EnumerationListRenderer')),
}

const EntityInstanceList: React.FC = () => {
    const { kindKey } = useParams<{ kindKey: string }>()
    const Renderer = kindKey ? INSTANCE_RENDERERS[kindKey] : null
    if (Renderer) return <Suspense fallback={<SkeletonGrid />}><Renderer /></Suspense>
    // For unknown/custom entity types, keep the existing inline generic fallback branch
    return renderExistingGenericFallback()
}
```

> **QA note**: `renderExistingGenericFallback()` is pseudocode here, not a new component contract. Do NOT create a separate `GenericEntityListRenderer` or `GenericEntityInstanceList` component. Keep the existing inline generic branch inside `EntityInstanceList`.

- Remove `getLegacyCompatibleObjectKind()` calls
- Remove `LEGACY_INSTANCE_DELEGATES` map
- Remove the `isCatalogCompatibleMode` flag

### Step 3.4: Remove "Source" column from EntitiesWorkspace

**Files**:
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx`
- `packages/metahubs-frontend/base/src/components/TargetEntitySelector.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/api/entityTypes.ts`

**Actions**:
- Remove `source` / `isBuiltin` field from `EntityTypeDisplayRow` entirely — no replacement
- Remove "Source" column (builtin/custom badge) from the table definition
- Per TZ #3, no `preset` badge — all entity types are equal
- Remove `source === 'custom'` / `source === 'builtin'` branching from action availability and display logic; standard preset-seeded types and user-created types must follow the same UI rules
- Remove `includeBuiltins`, `isBuiltin`, and `source` from the frontend entity types API contract and from all consumers (`EntitiesWorkspace`, `EntityInstanceList`, `TargetEntitySelector`)
- In selectors and menus, resolve display labels from VLC presentation/codename for all entity types — do NOT preserve a separate built-in translation path

### Step 3.5: Unify query keys

**File**: `packages/metahubs-frontend/base/src/domains/shared/queryKeys.ts`

**Actions**:
- Collapse legacy per-kind trees (`hubs()`, `catalogs()`, `sets()`, `enumerations()`) into unified `instances(metahubId, kindKey)` pattern
- Remove `normalizeLegacyCompatibleScope()`, `normalizeLegacyCompatibleKindKey()`
- Remove `includeBuiltins` from `entityTypesList()` query key normalization and from `invalidateEntityTypesQueries`
- New structure:

```typescript
instances: (metahubId: string, kindKey: string) =>
    [...metahubsQueryKeys.detail(metahubId), 'instances', kindKey] as const,
instancesList: (metahubId: string, kindKey: string, params?) =>
    [...metahubsQueryKeys.instances(metahubId, kindKey), 'list', normalized] as const,
instanceDetail: (metahubId: string, kindKey: string, instanceId: string) =>
    [...metahubsQueryKeys.instances(metahubId, kindKey), 'detail', instanceId] as const,
instanceChildren: (metahubId: string, kindKey: string, instanceId: string, childKind: string) =>
    [...metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId), 'children', childKind] as const,
```

### Step 3.6: Delete legacy frontend domain directories and API files

**Directories to delete** (after renderer migration is verified):
```
packages/metahubs-frontend/base/src/domains/catalogs/   ← REMOVE
packages/metahubs-frontend/base/src/domains/hubs/       ← REMOVE
packages/metahubs-frontend/base/src/domains/sets/       ← REMOVE
packages/metahubs-frontend/base/src/domains/enumerations/ ← REMOVE
```

**Files to delete**:
- `packages/metahubs-frontend/base/src/domains/shared/legacyCompatibleRoutePaths.ts`
- Any `isCatalogCompatible*` helpers in frontend

**Checklist**:
- [ ] Step 3.1: Migrate all legacy list components to unified entity API
- [ ] Step 3.2: Move specialized list components to renderers/
- [ ] Step 3.3: Simplify EntityInstanceList delegation (no GenericEntityListRenderer)
- [ ] Step 3.4: Remove "Source" column from EntitiesWorkspace entirely
- [ ] Step 3.5: Unify query keys
- [ ] Step 3.6: Delete legacy frontend domain directories and API files
- [ ] Build frontend: `pnpm --filter metahubs-frontend build`

---

## Phase 4: Backend — Legacy Domain Removal {#phase-4}

> Goal: Remove all legacy controllers/routes/services for hubs, catalogs, sets, enumerations. Expand `entityInstancesController` to handle all CRUD. Safe to do now because frontend no longer depends on legacy endpoints (Phase 3 completed).

### Step 4.1: Delete legacy backend domain directories

**Directories to delete**:
```
packages/metahubs-backend/base/src/domains/hubs/           ← REMOVE entirely
packages/metahubs-backend/base/src/domains/catalogs/       ← REMOVE entirely
packages/metahubs-backend/base/src/domains/sets/           ← REMOVE entirely
packages/metahubs-backend/base/src/domains/enumerations/   ← REMOVE entirely
```

**Important**: Before deletion, extract any unique hub-specific logic (tree CRUD, cycle detection, parent-child hierarchy management, nested catalogs/sets/enumerations under hubs) into a new `HubBehaviorService` that `entityInstancesController` will delegate to.

### Step 4.2: Create HubBehaviorService

**New file**: `packages/metahubs-backend/base/src/domains/entities/services/HubBehaviorService.ts`

**Actions**:
- Extract hub hierarchy operations from `hubsController.ts`:
  - Tree CRUD (list children, reorder, set parent)
  - Cycle detection
  - Nested entity listing under a hub (catalogs/sets/enumerations under hub)
  - Widget binding (MenuWidgetConfig with hub selection)
- This service is called by `entityInstancesController` when the resolved entity type's kind is `hub`

### Step 4.3: Expand entityInstancesController

**File**: `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`

**Actions**:
- Add hub-specific sub-routes: `GET /entity/:hubId/children?kind=:childKind`, `POST /entity/:entityId/hubs`, `DELETE /entity/:entityId/hubs/:hubId`
- Ensure all entity instance CRUD operations work for all kinds (catalog, hub, set, enumeration, custom)
- Remove any `isBuiltin` checks — all entities use the same code path
- Import and delegate to `HubBehaviorService` for hub-specific operations

### Step 4.4: Remove legacy route registrations from router.ts

**File**: `packages/metahubs-backend/base/src/domains/metahubs/router.ts`

**Actions**:
- Remove `createHubsRoutes()` registration
- Remove `createCatalogsRoutes()` registration
- Remove `createSetsRoutes()` registration
- Remove `createEnumerationsRoutes()` registration
- Keep all entity routes, attribute routes, constant routes, element routes, layout routes, script routes

### Step 4.5: Remove legacy compatibility utilities

**Files**:
- `packages/metahubs-backend/base/src/domains/shared/legacyCompatibility.ts` — DELETE
- `packages/metahubs-backend/base/src/domains/catalogs/services/catalogCompatibility.ts` — DELETE
- `packages/metahubs-backend/base/src/domains/shared/entityTypeResolver.ts` — refactor to DB-only resolution (remove `resolveBuiltin()` method)

### Step 4.6: Simplify EntityTypeService

**File**: `packages/metahubs-backend/base/src/domains/entities/services/EntityTypeService.ts`

**Actions**:
- Remove `BUILTIN_ENTITY_TYPE_REGISTRY` import and fallback — all type resolution from `_mhb_entity_type_definitions` table
- Remove `listCustomTypes()` → rename to `listTypes()` (no builtin/custom distinction)
- Remove `resolveLegacyCompatibleKind()` calls
- Single code path: query DB → return definition or throw `EntityTypeNotFoundError`

### Step 4.7: Simplify entityTypesController

**File**: `packages/metahubs-backend/base/src/domains/entities/controllers/entityTypesController.ts`

> **QA addition**: Remove `includeBuiltins` query parameter. After removing `isBuiltin`, all entity types are returned equally.

**Actions**:
- Remove `includeBuiltins` from `entityTypeListQuerySchema`
- `list` handler always calls `service.listTypes()` (no `listCustomTypes` vs `listResolvedTypes` branching)

### Step 4.8: Simplify ACL

**Actions**:
- All entity instance mutations use `editContent` permission (no more `isBuiltin` branching via `resolveLegacyAclPermission()`)
- Entity type definition mutations remain gated by `manageMetahub`
- Remove `resolveLegacyAclPermission()` — direct permission assignment

### Step 4.9: Remove `is_builtin` column from DB schema

**Actions**:
- Remove `is_builtin` column from `_mhb_entity_type_definitions` table definition in platform migration
- Since test DB will be wiped, no ALTER TABLE migration needed — just update the CREATE TABLE statement
- Update all INSERT/SELECT statements referencing `is_builtin`

**Checklist**:
- [ ] Step 4.1: Extract hub logic before deletion, delete legacy domain directories
- [ ] Step 4.2: Create HubBehaviorService
- [ ] Step 4.3: Expand entityInstancesController
- [ ] Step 4.4: Remove legacy route registrations
- [ ] Step 4.5: Remove legacy compatibility utilities
- [ ] Step 4.6: Simplify EntityTypeService (DB-only resolution, no builtin/custom split)
- [ ] Step 4.7: Simplify entityTypesController (remove includeBuiltins parameter)
- [ ] Step 4.8: Simplify ACL (direct permission, no legacy resolution)
- [ ] Step 4.9: Remove `is_builtin` DB column
- [ ] Build backend: `pnpm --filter metahubs-backend build`

---

## Phase 5: Frontend — Sidebar & Route Unification {#phase-5}

> Goal: Make sidebar 100% dynamic, remove hardcoded legacy items, unify all routes under entity tree.

### Step 5.1: Update getMetahubMenuItems()

**File**: `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

**Actions**:
- Remove hardcoded `metahub-hubs`, `metahub-catalogs`, `metahub-sets`, `metahub-enumerations` items
- Replace `publishedEntityTypes` with generic `entityTypes` (all entity types, not just custom ones)
- Add `buildEntityTypeMenuItems()` helper that sorts by `sidebarOrder` then alphabetically
- Dynamic items use `title` from VLC presentation (not i18n keys)
- **QA note**: The sidebar currently fetches entity types with `GET /entity-types?includeBuiltins=false`. After Phase 4 removes `includeBuiltins`, update the sidebar hook to call without this parameter (the endpoint simply returns all types).
- Preserve visibility parity with the current static object menu items: dynamic object items must NOT introduce a new `requiredPermission: 'manageMetahub'` gate unless the old static item had the same restriction

```typescript
const buildEntityTypeMenuItems = (
    metahubId: string,
    entityTypes: MetahubMenuEntityType[]
): TemplateMenuItem[] => {
    return entityTypes
        .filter(et => (et.sidebarSection ?? 'objects') === 'objects')
        .sort((a, b) => {
            const orderA = a.sidebarOrder ?? Number.MAX_SAFE_INTEGER
            const orderB = b.sidebarOrder ?? Number.MAX_SAFE_INTEGER
            if (orderA !== orderB) return orderA - orderB
            return a.title.localeCompare(b.title)
        })
        .map(et => ({
            id: `metahub-entity-${et.kindKey}`,
            title: et.title,
            url: `/metahub/${metahubId}/entities/${et.kindKey}/instances`,
            icon: resolveMenuIcon(et.iconName),
            type: 'item' as const
        }))
}
```

### Step 5.2: Remove legacy route registrations from MainRoutes.tsx

**File**: `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`

**Actions**:
- Remove all legacy routes:
```
/metahub/:metahubId/hubs             ← REMOVE
/metahub/:metahubId/catalogs         ← REMOVE
/metahub/:metahubId/sets             ← REMOVE
/metahub/:metahubId/enumerations     ← REMOVE
/metahub/:metahubId/hub/:hubId/…     ← REMOVE
/metahub/:metahubId/catalog/:id/…    ← REMOVE
/metahub/:metahubId/set/:id/…        ← REMOVE
/metahub/:metahubId/enumeration/:id/… ← REMOVE
```
- Keep only entity-based routes:
```
/metahub/:metahubId/entities
/metahub/:metahubId/entities/:kindKey/instances
/metahub/:metahubId/entities/:kindKey/instance/:id/…
```

### Step 5.3: Update breadcrumbs

**File**: `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx`

**Actions**:
- Remove legacy breadcrumb hooks/resolvers for `/hub/`, `/catalog/`, `/set/`, `/enumeration/` paths
- All entity breadcrumbs resolve through the unified entity detail lookup
- Entity type name in breadcrumb comes from VLC presentation

### Step 5.4: Update metahub create dialog options

**Files**:
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/metahubListUtils.ts`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`

**Actions**:
- Replace legacy boolean toggles (Create Hub / Create Catalog / etc.) with preset-driven toggles
- Reuse the existing `TemplateSelector` + `useTemplateDetail(templateId)` / `GET /templates/:templateId` seam to read `activeVersionManifest.presets[]`; do NOT invent a new template-preset fetch API or a second selector component
- UI reads `template.presets[]` to generate dynamic checkboxes and resolves each preset's localized label/description through the existing preset template summaries/details cache (`definitionType='entity_type_preset'`) instead of duplicating display text inside `TemplatePresetReference`
- Each preset toggle sends `presetToggles[codename]: boolean` in the create request
- Keep default-instance payloads out of the dialog form state: localized Main/Основной instance definitions come from the referenced `entity_type_preset` manifests during backend seed execution, not from a duplicated frontend form model
- Remove the old form defaults and helper types keyed by `createHub` / `createCatalog` / `createSet` / `createEnumeration`

**Checklist**:
- [ ] Step 5.1: Update getMetahubMenuItems() to fully dynamic
- [ ] Step 5.2: Remove legacy routes from MainRoutes.tsx
- [ ] Step 5.3: Update breadcrumbs for unified entity paths
- [ ] Step 5.4: Update metahub create dialog with preset-driven options
- [ ] Build: `pnpm --filter universo-template-mui build && pnpm --filter universo-core-frontend build`

---

## Phase 6: Schema-DDL & Runtime Simplification {#phase-6}

> Goal: Remove legacy kind resolution from schema-ddl and runtime controllers.

### Step 6.1: Simplify legacyCompatibleKinds.ts

**File**: `packages/schema-ddl/base/src/legacyCompatibleKinds.ts`

**Actions**:
- Remove 3-layer kind resolution (`resolveLegacyCompatibleKind()`)
- Simplify: `kind` column now directly stores `catalog`, `hub`, `set`, `enumeration`
- `isNonPhysicalLegacyCompatibleEntity()` stays but simplified — checks `kind` directly
- Remove `getLegacyCompatibleObjectKindForKindKey()` calls

```typescript
export type EntityKindBehavior = 'catalog' | 'hub' | 'set' | 'enumeration' | 'document'

export const isNonPhysicalEntity = (entity: { kind: string }): boolean =>
    ['hub', 'set', 'enumeration'].includes(entity.kind)
```

### Step 6.2: Simplify runtimeRowsController.ts

**File**: `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`

**Actions**:
- Remove `RUNTIME_LEGACY_COMPATIBLE_KIND_SQL()` — no more CASE statement for `custom.*-v2` → legacy mapping
- Replace with direct `kind` column reads (already stores `catalog`, `hub`, `set`, `enumeration`)
- Simplify `RUNTIME_SECTION_FILTER_SQL`:

```typescript
// Before: complex COALESCE/CASE SQL transformation
// After: direct kind check
export const RUNTIME_SECTION_FILTER_SQL = (kindColumn: string) =>
    `${kindColumn} NOT IN ('hub', 'set', 'enumeration')`
```

- Remove `resolveRuntimeLegacyCompatibleKind()` — direct kind comparison
- Simplify `isRuntimeSectionTargetKind()`, `isRuntimeEnumerationTargetKind()`, etc.

### Step 6.3: Update SchemaGenerator and SchemaMigrator

**Files**:
- `packages/schema-ddl/base/src/SchemaGenerator.ts`
- `packages/schema-ddl/base/src/SchemaMigrator.ts`
- `packages/schema-ddl/base/src/diff.ts`

**Actions**:
- Remove all `resolveLegacyCompatibleKind()` calls
- Use direct `kind` value for behavior classification
- Remove any `custom.*-v2` pattern matching

**Checklist**:
- [ ] Step 6.1: Simplify schema-ddl kind resolution
- [ ] Step 6.2: Simplify runtimeRowsController SQL
- [ ] Step 6.3: Update SchemaGenerator/SchemaMigrator
- [ ] Build: `pnpm --filter schema-ddl build && pnpm --filter applications-backend build`

---

## Phase 7: Snapshot & Settings Cleanup {#phase-7}

> Goal: Simplify snapshot serializer, update settings namespace.

### Step 7.1: Simplify SnapshotSerializer

**File**: `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`

**Actions**:
- Remove `resolveLegacyCompatibleKind()` — kind IS the kind
- Entity behavior determined from component manifest, not from legacy kind resolution
- Remove `isBuiltin` from snapshot `entityTypeDefinitions` entirely — **do NOT replace with `source`**
- Remove `isBuiltin` from `MetahubEntityTypeDefinitionSnapshot` interface in `@universo/types`

> **QA note (behavioral change)**: Currently `loadSnapshotTypeDefinitions()` calls `listCustomTypes()` which excludes builtins. After removing `isBuiltin`, **ALL** entity types (including preset-based ones like catalog, hub, set, enumeration) will be exported in snapshots. This is **correct** for the new model: entity types are DB-resident, may differ between metahubs, and must be preserved in snapshots. Verify the snapshot import path handles entity type definition upsert/merge correctly.

### Step 7.2: Update settings key namespace

**File**: `packages/universo-types/base/src/common/metahubs.ts` (METAHUB_SETTINGS_REGISTRY)

**Actions**:
- Rename settings keys to uniform `entity.<kindKey>.*` namespace:
  - `catalogs.allowCopy` → `entity.catalog.allowCopy`
  - `hubs.allowCopy` → `entity.hub.allowCopy`
  - `sets.allowCopy` → `entity.set.allowCopy`
  - `enumerations.allowCopy` → `entity.enumeration.allowCopy`
  - etc.
- Update all backend settings reads/writes to use new keys
- Update frontend settings UI to reflect new keys

### Step 7.3: Update snapshot import compatibility

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

**Actions**:
- Snapshot import should only accept new format (no legacy v2 fallback since DB is fresh)
- Remove any `custom.*-v2` → `catalog`/`hub`/etc. migration logic in import path

**Checklist**:
- [ ] Step 7.1: Simplify SnapshotSerializer
- [ ] Step 7.2: Update settings namespace
- [ ] Step 7.3: Update snapshot import
- [ ] Build: `pnpm --filter metahubs-backend build`

---

## Phase 8: i18n Updates {#phase-8}

> Goal: Update EN/RU translation files for removed/renamed concepts.

### Step 8.1: Menu i18n cleanup

**Files**:
- `packages/universo-i18n/base/src/locales/en/metahubs.json`
- `packages/universo-i18n/base/src/locales/ru/metahubs.json`

**Actions**:
- Remove unused legacy menu title keys (`hubs`, `catalogs`, `sets`, `enumerations` as sidebar titles — only if they were used solely for sidebar)
- Keep all UI component keys (dialog labels, field labels, error messages) since CatalogListRenderer, HubListRenderer, etc. still use them
- Add new keys:
    - `createOptions.preset.*` — labels for preset toggles in create dialog

### Step 8.2: Settings i18n

**Actions**:
- Update settings labels to match new `entity.<kindKey>.*` namespace
- Ensure EN/RU parity

**Checklist**:
- [ ] Step 8.1: Menu i18n cleanup
- [ ] Step 8.2: Settings i18n updates
- [ ] Verify: `pnpm docs:i18n:check` (if applicable to metahubs namespace)

---

## Phase 9: Unit & Integration Tests {#phase-9}

> Goal: Update/remove/create tests to match new architecture.

### Step 9.1: Remove legacy test files

**Actions**:
- Delete test files for removed legacy controllers:
  - `hubsRoutes.test.ts`, `catalogsRoutes.test.ts`, `setsRoutes.test.ts`, `enumerationsRoutes.test.ts`
  - `hubsController.test.ts`, etc.
- Delete test files for removed compatibility utilities

### Step 9.2: Update entity instance tests

**Actions**:
- Expand `entityInstancesRoutes.test.ts` to cover all kinds (catalog, hub, set, enumeration CRUD)
- Test hub-specific operations (hierarchy, children, cycle detection)
- Test preset-based entity type creation
- Update frontend tests that currently depend on `source` / `isBuiltin` / `includeBuiltins`: `EntitiesWorkspace.test.tsx`, `EntityInstanceList.test.tsx`, `TargetEntitySelector.test.tsx`, `queryKeys.test.ts`

### Step 9.3: Update template seed tests

**Actions**:
- Test new `TemplateSeedExecutor` flow with metahub template `presets[]` references plus `EntityTypePresetManifest.defaultInstances[]`
- Test `presetToggles` filtering
- Test VLC name/description seeding for default instances
- Test dependency-aware seeding for hub-linked default instances without relying on UI `sidebarOrder`

### Step 9.4: Update snapshot serializer tests

**Actions**:
- Remove legacy kind resolution test cases
- Test simplified direct-kind serialization
- Update fixture contract assertions to validate preset-seeded entity type definitions by presence/content rather than `isBuiltin` checks

### Step 9.5: Update metahub board and create-dialog tests

**Actions**:
- Update `packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/MetahubBoard.test.tsx` and `packages/metahubs-backend/base/src/tests/routes/metahubBoardSummary.test.ts` for the new `entityCounts` + compatibility-alias contract
- Update `packages/metahubs-frontend/base/src/domains/metahubs/ui/__tests__/MetahubList.test.tsx` for preset-driven create options

### Step 9.6: Add query key smoke tests

**Actions**:
- Test unified `instances(metahubId, kindKey)` pattern
- Verify cache invalidation breadth

### Step 9.7: Update schema-ddl tests

**Actions**:
- Remove `resolveLegacyCompatibleKind()` test cases
- Test simplified `isNonPhysicalEntity()` behavior

**Checklist**:
- [ ] Step 9.1: Remove legacy test files
- [ ] Step 9.2: Update entity instance tests
- [ ] Step 9.3: Update template seed tests
- [ ] Step 9.4: Update snapshot serializer tests
- [ ] Step 9.5: Update metahub board and create-dialog tests
- [ ] Step 9.6: Add query key smoke tests
- [ ] Step 9.7: Update schema-ddl tests
- [ ] Run: `pnpm test` (all suites across workspace)

---

## Phase 10: E2E Playwright Tests {#phase-10}

> Goal: Full cycle browser testing for all entity operations.

### Step 10.1: Update existing E2E flows

**Files in `tools/testing/e2e/specs/flows/`**:

**Actions**:
- **Delete** `metahub-domain-entities.spec.ts` — tests ALL legacy domain routes (`/hubs`, `/catalogs`, `/sets`, `/enumerations`) with 12+ legacy API calls. Its coverage is superseded by the new `metahub-entity-lifecycle.spec.ts`
- **Delete or rewrite** `metahub-create-options-codename.spec.ts` — tests old boolean flags (Hub, Catalog, Set, Enumeration checkboxes) and legacy API functions (`listMetahubHubs`, `listMetahubCatalogs`, etc.). Merge its coverage into the new `metahub-create-options.spec.ts`
- **Update** `metahub-entities-workspace.spec.ts`:
  - Remove `source?: 'builtin' | 'custom'` type definition (line ~35) entirely — no replacement
  - Remove `includeBuiltins: false` parameter (line ~337) — endpoint returns all types
  - Remove "Source" column assertions
  - Update kind key expectations (`custom.catalog-v2` → `catalog`, etc.)
- **Update** `metahub-entities-publication-runtime.spec.ts` — remove legacy route assertions
- **Update** `boards-overview.spec.ts` — update `MetahubBoardSummary` assertions (`hubsCount`, `catalogsCount` → generic entity counts by kind)
- **Remove** `metahub-entities-legacy-compatible-v2.spec.ts` — no more legacy compatibility
- **Update** `snapshot-export-import.spec.ts` — use new snapshot format, verify entity type definitions included for ALL kinds

### Step 10.2: Create new E2E flows

**New test files**:

1. **`metahub-entity-lifecycle.spec.ts`** — Full CRUD lifecycle for each entity kind:
   - Create metahub from basic template → verify all preset entities exist
   - Create/read/update/delete catalog instances
   - Create/read/update/delete hub instances with hierarchy
   - Create/read/update/delete set instances with constants
   - Create/read/update/delete enumeration instances with values
   - Default instance verification (VLC names in both locales)

2. **`metahub-sidebar-dynamic.spec.ts`** — Sidebar behavior:
   - Verify all entity types appear in sidebar after metahub creation
   - Verify correct ordering (hub → catalog → set → enumeration)
   - Verify navigation to entity instance lists
   - Create custom entity type → verify it appears in sidebar

3. **`metahub-create-options.spec.ts`** — Create dialog options:
   - Create metahub with all presets enabled → verify all types + default instances
   - Create metahub with some presets disabled → verify only enabled types exist
   - Verify preset toggle UI labels

### Step 10.3: Update visual baseline specs

**Actions**:
- Remove/update visual specs that reference legacy surfaces
- Update `metahub-catalogs-v2-parity.visual.spec.ts` — no more "v2" concept, just "catalogs"
- Capture new visual baselines after UI changes

### Step 10.4: Screenshot capture for docs

**Actions**:
- Create screenshot generator spec: `docs-entity-types-screenshots.spec.ts`
- Capture screenshots of:
  - EntitiesWorkspace (list view, card view)
  - Metahub create dialog with preset options
  - Each entity kind instance list (catalog, hub, set, enumeration)
  - Sidebar with dynamic entity types
  - Entity type create/edit dialog
- Save to `docs/en/.gitbook/assets/entities/` and `docs/ru/.gitbook/assets/entities/`

**Checklist**:
- [ ] Step 10.1: Update existing E2E flows
- [ ] Step 10.2: Create new E2E flows
- [ ] Step 10.3: Update visual baselines
- [ ] Step 10.4: Screenshot capture for docs
- [ ] Run: `pnpm run build:e2e && npx playwright test` (all specs)

---

## Phase 11: Fixture Regeneration {#phase-11}

> Goal: Regenerate fixture files to match new entity format.

### Step 11.1: Update self-hosted app fixture contract

**File**: `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`

**Actions — detailed kind key transitions**:
- `kindKey: 'custom.catalog-v2'` → `kindKey: 'catalog'` (4 entity type definitions affected)
- `kindKey: 'custom.hub-v2'` → `kindKey: 'hub'`
- `kindKey: 'custom.set-v2'` → `kindKey: 'set'`
- `kindKey: 'custom.enumeration-v2'` → `kindKey: 'enumeration'`
- `templateCodename: 'catalog-v2'` → `templateCodename: 'catalog'`
- `templateCodename: 'hub-v2'` → `templateCodename: 'hub'`
- `templateCodename: 'set-v2'` → `templateCodename: 'set'`
- `templateCodename: 'enumeration-v2'` → `templateCodename: 'enumeration'`
- **Remove** `compatibility: { legacyObjectKind: '...' }` from ALL entity type definitions
- **Remove** `isBuiltin` field entirely — **do NOT replace with `source`**
- Update entity count assertions (preset entity types now included in export)

### Step 11.2: Regenerate metahubs-self-hosted-app-snapshot.json

**Actions**:
- Run self-hosted fixture generator: `npx playwright test --project=chromium tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts`
- Verify generated fixture against updated contract
- Commit updated `tools/fixtures/metahubs-self-hosted-app-snapshot.json`

### Step 11.3: Regenerate metahubs-quiz-app-snapshot.json

**Actions**:
- Run quiz app fixture generator (if exists)
- Verify and commit updated fixture

### Step 11.4: Verify import flow

**Actions**:
- Run snapshot import E2E test with regenerated fixtures
- Verify all entity types and instances are correctly imported

**Checklist**:
- [ ] Step 11.1: Update fixture contract
- [ ] Step 11.2: Regenerate self-hosted fixture
- [ ] Step 11.3: Regenerate quiz app fixture
- [ ] Step 11.4: Verify import flow
- [ ] Run: full import/export E2E cycle

---

## Phase 12: Documentation (EN/RU) {#phase-12}

> Goal: Completely rewrite EN/RU GitBook documentation with updated screenshots.

### Step 12.1: Update architecture documentation

**Files**:
- `docs/en/architecture/metahub-system.md` (or equivalent)
- `docs/ru/architecture/metahub-system.md`

**Actions**:
- Remove all references to "legacy" vs "V2" distinction
- Update entity type system description (single unified model)
- Update template ↔ preset ↔ default instances documentation
- Update ECAE architecture description

### Step 12.2: Update guide documentation

**Files**:
- `docs/en/guides/custom-entity-types.md`
- `docs/ru/guides/custom-entity-types.md`

**Actions**:
- Remove legacy compatibility references
- Update kind key examples (`catalog` instead of `custom.catalog-v2`)
- Update screenshots using generated images from Phase 10.4
- Document new default instances feature
- Document preset-based metahub creation

### Step 12.3: Update API reference documentation

**Files**:
- `docs/en/api-reference/metahubs.md` (or equivalent)
- `docs/ru/api-reference/metahubs.md`

**Actions**:
- Remove legacy API endpoints (/hubs, /catalogs, /sets, /enumerations)
- Document unified entity API endpoints
- Update request/response examples with new format
- Document MetahubCreateOptions new format

### Step 12.4: Update platform documentation

**Actions**:
- Update entity type preset documentation
- Document sidebar configuration
- Update template manifest documentation

### Step 12.5: Verify EN/RU parity

**Actions**:
- Run `pnpm docs:i18n:check` to verify line-count parity
- Manual review of both language versions

**Checklist**:
- [ ] Step 12.1: Update architecture docs
- [ ] Step 12.2: Update guide docs with screenshots
- [ ] Step 12.3: Update API reference docs
- [ ] Step 12.4: Update platform docs
- [ ] Step 12.5: Verify EN/RU parity

---

## Phase 13: Final Validation & Build {#phase-13}

> Goal: Ensure everything compiles, passes tests, and is ready for merge.

### Step 13.1: Full workspace build

```bash
pnpm build
```

### Step 13.2: Full test suite

```bash
pnpm test
```

### Step 13.3: E2E tests

```bash
pnpm run build:e2e
npx playwright test
```

### Step 13.4: Lint check

```bash
pnpm --filter metahubs-frontend lint
pnpm --filter metahubs-backend lint
pnpm --filter universo-types lint
pnpm --filter schema-ddl lint
pnpm --filter applications-backend lint
```

### Step 13.5: Memory bank update

**Actions**:
- Update `activeContext.md` with new active focus
- Update `progress.md` with completed work summary
- Update `tasks.md` with completion status
- Update `systemPatterns.md` if architectural patterns changed
- Update `techContext.md` if technology stack details changed

**Checklist**:
- [ ] Step 13.1: Full workspace build passes
- [ ] Step 13.2: Full test suite passes
- [ ] Step 13.3: All E2E tests pass
- [ ] Step 13.4: Lint checks pass
- [ ] Step 13.5: Memory bank updated

---

## Potential Challenges {#challenges}

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Hub hierarchy logic extraction** — tree CRUD, cycle detection, nested entity operations in `hubsController` are complex and tightly coupled to legacy domain | HIGH | Create dedicated `HubBehaviorService` before deleting legacy domain. Test hierarchy operations independently. |
| 2 | **Query key tree collapse** — changing query key structure may cause stale cache issues | MEDIUM | Add focused query key invalidation tests. Review every `invalidateQueries()` call site. |
| 3 | **Snapshot format break** — old snapshots won't import | MEDIUM | Intentional — DB is wiped. No backward compat needed. Document in release notes. |
| 4 | **Snapshot export behavioral change** — after removing `isBuiltin`, ALL entity types (including preset-based catalogs/hubs/sets/enumerations) will be exported in snapshots. Previously only custom entity types were exported. | MEDIUM | This is correct for the new model. Verify import path handles entity type definition upsert/merge. Add explicit test in `snapshot-export-import.spec.ts`. |
| 5 | **Frontend lazy import paths** — moving components to new directories may break code splitting | LOW | Verify Vite chunk output after move. Test lazy loading in browser. |
| 6 | **Settings migration** — changing settings key namespace requires updating both backend validation and frontend rendering | MEDIUM | Use a systematic find-and-replace for all settings key references. |
| 7 | **Hub widget binding** — `MenuWidgetConfig` has hub-specific binding that links sidebar navigation to hub tree; this needs to work with new kind key | MEDIUM | Update `MenuWidgetConfig.hubId` to use entity instance ID. The widget doesn't care about kind — it just needs the hub ID. |
| 8 | **Breadcrumb resolution** — removing legacy route breadcrumb hooks may break navigation path display | MEDIUM | Implement unified entity breadcrumb resolver before removing legacy ones. Test with browser. |
| 9 | **Preset default instances with hub assignment** — `hubs: string[]` in `PresetDefaultInstance` references hub codenames that must exist when the instance is created. Ordering matters. | MEDIUM | Use an explicit dependency-aware seed pipeline: create hub-kind default instances first, record codename-to-id mappings, then create dependent instances and apply hub links in a final pass. Do not rely on `sidebarOrder`, which is a UI concern. |
| 10 | **Phase ordering: Frontend before Backend** — frontend migration to unified API (Phase 3) MUST complete before backend legacy routes are removed (Phase 4). If order is violated, frontend breaks immediately. | HIGH | Strict phase ordering. Do NOT merge Phase 4 before Phase 3 is verified. Build + smoke test after Phase 3. |

---

## Files Changed Summary {#files-summary}

### Files to DELETE (~40 files)

**Backend legacy domains**:
- `packages/metahubs-backend/base/src/domains/hubs/` (controllers, routes, services, tests)
- `packages/metahubs-backend/base/src/domains/catalogs/` (controllers, routes, services, tests)
- `packages/metahubs-backend/base/src/domains/sets/` (controllers, routes, services, tests)
- `packages/metahubs-backend/base/src/domains/enumerations/` (controllers, routes, services, tests)
- `packages/metahubs-backend/base/src/domains/shared/legacyCompatibility.ts`

**Frontend legacy domains**:
- `packages/metahubs-frontend/base/src/domains/catalogs/`
- `packages/metahubs-frontend/base/src/domains/hubs/`
- `packages/metahubs-frontend/base/src/domains/sets/`
- `packages/metahubs-frontend/base/src/domains/enumerations/`
- `packages/metahubs-frontend/base/src/domains/shared/legacyCompatibleRoutePaths.ts`

**Legacy test files**:
- `hubsRoutes.test.ts`, `catalogsRoutes.test.ts`, `setsRoutes.test.ts`, `enumerationsRoutes.test.ts`, etc.

**E2E legacy specs**:
- `metahub-entities-legacy-compatible-v2.spec.ts`
- `metahub-domain-entities.spec.ts`
- `metahub-create-options-codename.spec.ts` (or rewrite into `metahub-create-options.spec.ts`)

**Backend preset files**:
- `document-workspace.entity-preset.ts` (TZ #2: no documents)

**Types**:
- `packages/universo-types/base/src/common/builtinEntityTypes.ts` — DELETE entirely (presets are backend-only seed data)

### Files to RENAME (~5 files)

- `catalog-v2.entity-preset.ts` → `catalog.entity-preset.ts`
- `hub-v2.entity-preset.ts` → `hub.entity-preset.ts`
- `set-v2.entity-preset.ts` → `set.entity-preset.ts`
- `enumeration-v2.entity-preset.ts` → `enumeration.entity-preset.ts`

### Files to CREATE (~10 files)

- `packages/metahubs-backend/base/src/domains/entities/services/HubBehaviorService.ts`
- `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/CatalogListRenderer.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/HubListRenderer.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/SetListRenderer.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/renderers/EnumerationListRenderer.tsx`
- `tools/testing/e2e/specs/flows/metahub-entity-lifecycle.spec.ts`
- `tools/testing/e2e/specs/flows/metahub-sidebar-dynamic.spec.ts`
- `tools/testing/e2e/specs/flows/metahub-create-options.spec.ts`
- `tools/testing/e2e/specs/generators/docs-entity-types-screenshots.spec.ts`

### Files to MODIFY (~30+ files)

**@universo/types**: `entityTypeDefinition.ts`, `metahubs.ts`, `entityComponents.ts`, `index.ts`  
**metahubs-backend**: `router.ts`, `entityInstancesController.ts`, `EntityTypeService.ts`, `MetahubSchemaService.ts`, `metahubsController.ts`, `TemplateSeedExecutor.ts`, `SnapshotSerializer.ts`, template data files  
**metahubs-frontend**: `EntityInstanceList.tsx`, `EntitiesWorkspace.tsx`, `queryKeys.ts`  
**universo-template-mui**: `menuConfigs.ts`, `NavbarBreadcrumbs.tsx`  
**universo-core-frontend**: `MainRoutes.tsx`  
**schema-ddl**: `legacyCompatibleKinds.ts`, `SchemaGenerator.ts`, `SchemaMigrator.ts`, `diff.ts`  
**applications-backend**: `runtimeRowsController.ts`  
**universo-i18n**: `en/metahubs.json`, `ru/metahubs.json`  
**docs**: multiple EN/RU guide and architecture pages

---

## Implementation Order (Recommended)

> **QA correction**: Frontend migration (Phase 3) MUST precede backend legacy route deletion (Phase 4). Otherwise legacy frontend consumers break immediately.

```
Phase 1 (Types) → Phase 2 (Templates/Presets) → Phase 3 (Frontend migration) →
Phase 4 (Backend legacy removal) → Phase 5 (Sidebar/Routes) →
Phase 6 (Schema-DDL/Runtime) → Phase 7 (Snapshot/Settings) →
Phase 8 (i18n) → Phase 9 (Unit tests) → Phase 10 (E2E) →
Phase 11 (Fixtures) → Phase 12 (Docs) → Phase 13 (Final validation)
```

Key dependency: Types (Phase 1) must come first since all other packages import from `@universo/types`. Template/preset work in Phase 2 is safe before frontend migration because it updates seed/create flows without deleting legacy list routes, while backend legacy removal in Phase 4 must wait until Phase 3 is verified so legacy frontend consumers are already off the old endpoints. Schema-DDL (Phase 6) and Snapshot (Phase 7) can proceed once the route/menu consolidation work is underway, but they must preserve the validated Phase 3 → Phase 4 ordering and the temporary `boardSummary` compatibility aliases until the frontend switches fully to `entityCounts`.
