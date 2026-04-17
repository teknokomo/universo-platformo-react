# Creative Design: Entity V2 Generalization — Hubs, Sets, Enumerations

> **Created**: 2026-04-11  
> **Status**: Design exploration — ready for review  
> **Scope**: Extend the Entity Component Architecture (ECAE) to produce "Hubs V2", "Sets V2", and "Enumerations V2" entity type presets alongside the existing "Catalogs V2", with generic frontend delegation and backend policy generalization  
> **Prerequisite**: Catalogs V2 parity (PR #757) validated and merged  
> **Related**: [creative-entity-component-architecture.md](creative-entity-component-architecture.md), [entity-component-architecture-plan-2026-04-08.md](../plan/entity-component-architecture-plan-2026-04-08.md)

---

## Table of Contents

1. [Design Question 1: Frontend Delegation Pattern](#dq1-frontend-delegation-pattern)
2. [Design Question 2: Settings Generalization](#dq2-settings-generalization)
3. [Design Question 3: Hub V2 Specifics](#dq3-hub-v2-specifics)
4. [Design Question 4: Route Structure](#dq4-route-structure)
5. [Design Question 5: Backend Controller Generalization](#dq5-backend-controller-generalization)
6. [Design Question 6: Preset Template Design](#dq6-preset-template-design)
7. [Design Question 7: Menu Integration](#dq7-menu-integration)
8. [Component Manifest Comparison Matrix](#component-manifest-comparison)
9. [Incremental Migration Strategy](#incremental-migration)
10. [Testing Strategy](#testing-strategy)
11. [i18n Strategy](#i18n-strategy)
12. [Recommendation Summary](#recommendation-summary)

---

## DQ1: Frontend Delegation Pattern

### Problem Statement

`EntityInstanceList.tsx` currently contains a hardcoded `isCatalogCompatibleMode` flag that delegates the entire rendering surface to `<CatalogList />` when the resolved entity type is catalog-compatible. Extending this to Sets, Enumerations, and Hubs would require either adding more hardcoded branches or generalizing the delegation.

### Current State

```
EntityInstanceList
  ├── if isCatalogCompatibleMode → <CatalogList />
  └── else → generic entity list (own CRUD, tabs, dialogs)
```

The `isCatalogCompatibleMode` check uses:
```ts
const isCatalogCompatibleMode = useMemo(
    () => isCatalogCompatibleEntityType(entityType),
    [entityType]
)
```

`isLegacyCompatibleObjectKind(config, kind)` already supports all 5 built-in kinds generically via `config.compatibility.legacyObjectKind`.

### Option A: Kind-Registry Delegation Map (RECOMMENDED)

Create a static `Record<LegacyCompatibleObjectKind, React.ComponentType>` map. `EntityInstanceList` resolves the `legacyObjectKind` from the entity type config, looks up the delegate, and renders it if found. Otherwise, falls through to the generic entity list.

```tsx
// entityInstanceDelegates.ts
import { lazy } from 'react'
import type { LegacyCompatibleObjectKind } from '@universo/types'

type DelegateComponent = React.LazyExoticComponent<React.ComponentType<any>>

export const LEGACY_INSTANCE_DELEGATES: Partial<Record<LegacyCompatibleObjectKind, DelegateComponent>> = {
    catalog: lazy(() => import('../../catalogs/ui/CatalogList')),
    set:     lazy(() => import('../../sets/ui/SetList')),
    enumeration: lazy(() => import('../../enumerations/ui/EnumerationList')),
    hub:     lazy(() => import('../../hubs/ui/HubList')),
}

// EntityInstanceList.tsx
const legacyKind = getLegacyCompatibleObjectKind(entityType?.config)
const DelegateComponent = legacyKind ? LEGACY_INSTANCE_DELEGATES[legacyKind] : null

if (DelegateComponent) {
    return <Suspense fallback={<Skeleton />}><DelegateComponent /></Suspense>
}
// else: generic entity list
```

**Pros:**
- Simple, declarative, zero new abstractions
- Preserves each legacy surface's full UX contract (each surface thinks it is the top-level page)
- Adding a new legacy-compatible kind = one line in the map
- Lazy-loaded: no bundle penalty for unused delegates
- `EntityInstanceList` stays the single entry point for entity-route instances
- Easy to test: mock the map, assert the right delegate is rendered

**Cons:**
- Delegates are opaque; no shared behavior reuse between them
- Each delegate still has its own data-fetching, dialog, and action patterns (code duplication remains across legacy surfaces)
- Hub V2 delegation requires passing through `parentHubId` context from the entity route, which the HubList currently reads from its own route
- Doesn't automatically compose tabs from the component manifest (each delegate defines its own tabs)

**Risk:** LOW — this is the natural extension of the existing `isCatalogCompatibleMode` pattern.

### Option B: Plugin-Like Renderer Registration System

Each V2 preset registers its own "list renderer" function at import time. `EntityInstanceList` calls a global registry to resolve the renderer.

```ts
// Plugin approach
registerEntityInstanceRenderer('custom.catalog-v2', CatalogListRenderer)
registerEntityInstanceRenderer('custom.hub-v2', HubListRenderer)

// EntityInstanceList
const Renderer = resolveInstanceRenderer(entityType.kindKey) || GenericInstanceRenderer
return <Renderer entityType={entityType} ... />
```

**Pros:**
- Extensible: third-party presets could register renderers
- Decouples delegate resolution from `EntityInstanceList` itself

**Cons:**
- Over-engineering: we have 4 known legacy surfaces, not an unknown plugin ecosystem
- Import-time side effects (registration) are fragile and order-dependent
- Testing is harder (global mutable registry state)
- Doesn't solve the UX reuse problem — each renderer is still opaque
- Introduces a new pattern foreign to the existing codebase

**Risk:** MEDIUM — unnecessary complexity for the current 4+1 delegate set.

### Option C: Single Universal Adaptive List

One `EntityInstanceList` component that adapts its columns, actions, tabs, and dialogs based on the resolved `ComponentManifest`. No delegation to legacy surfaces.

```tsx
// EntityInstanceList adapts everything from manifest
const actions = buildActionsFromManifest(entityType.components)
const tabs = buildTabsFromManifest(entityType.components)
const columns = buildColumnsFromManifest(entityType.components)
```

**Pros:**
- Maximum code reuse; one surface for all V2 kinds
- Future-proof: any new entity kind automatically gets the generic surface
- Component manifest becomes the single source of truth for UI composition

**Cons:**
- **Breaks parity**: legacy Hubs have a tree view, legacy Enumerations have inline value editing, legacy Sets have constant management with hub scoping — reproducing all of these in one adaptive list is a full rewrite
- Violates the "coexistence-first" constraint: legacy surfaces must remain usable during validation
- Testing matrix explodes: every manifest combination must be tested
- Hub hierarchy (parent-child tree) is fundamentally different from a flat list — a single component cannot elegantly handle both
- Current Sprint risk: building the universal surface is a Level 4 effort on its own

**Risk:** HIGH — this is the eventual end state, but shipping it now would delay V2 variants by months.

### Decision: Option A — Kind-Registry Delegation Map

**Rationale:** Option A extends the proven `isCatalogCompatibleMode` pattern to all legacy kinds with minimal code change. Each legacy surface keeps its full UX contract intact, which is critical for coexistence validation. The generic entity list remains the fallback for truly custom kinds. Future refactoring can progressively replace delegates with manifest-driven components after parity is proven for each kind.

The key insight is that delegation via `getLegacyCompatibleObjectKind` is already generic — it reads `config.compatibility.legacyObjectKind` which can be `'catalog' | 'set' | 'enumeration' | 'hub' | 'document'`. We simply need to map each value to its appropriate frontend surface.

---

## DQ2: Settings Generalization

### Problem Statement

Copy/delete policy settings currently exist for `catalogs.*` and `enumerations.*`, but not for `sets.*` or `hubs.*`. The `entityInstancesController` hardcodes `'catalogs.allowCopy'` / `'catalogs.allowDelete'`. Need a pattern that works for all V2 kinds.

### Current State

| Setting Key | Exists | Used By |
|---|---|---|
| `catalogs.allowCopy` | ✅ | `CatalogList`, `entityInstancesController` |
| `catalogs.allowDelete` | ✅ | `CatalogList`, `entityInstancesController` |
| `catalogs.allowDeleteLastDisplayAttribute` | ✅ | `CatalogList` (hidden) |
| `enumerations.allowCopy` | ✅ | `EnumerationList` |
| `enumerations.allowDelete` | ✅ | `EnumerationList` |
| `sets.allowCopy` | ❌ | — |
| `sets.allowDelete` | ❌ | — |
| `hubs.allowCopy` | ❌ | — |
| `hubs.allowDelete` | ❌ | — |
| `hubs.allowAttachExistingEntities` | ✅ | `HubList` |
| `hubs.allowNesting` | ✅ | `HubList` |

Frontend `useEntityPermissions(entityType)` already generalizes by prefixing: `\`${entityType}.allowCopy\``.

### Option A: Add Individual Settings Per Kind (Same Pattern) (RECOMMENDED)

Add the missing settings keys (`sets.allowCopy`, `sets.allowDelete`, `hubs.allowCopy`, `hubs.allowDelete`) through the same migration/seeder mechanism that created existing settings. Keep `useEntityPermissions` as-is — it already works generically.

On the backend, replace the hardcoded `'catalogs.allowCopy'` with a resolved settings-key prefix derived from the `legacyObjectKind`:

```ts
const resolveSettingsPrefix = (resolvedType: ResolvedEntityType): string | null => {
    const legacyKind = getLegacyCompatibleObjectKind(resolvedType.config ?? resolvedType)
    if (legacyKind === 'catalog') return 'catalogs'
    if (legacyKind === 'set') return 'sets'
    if (legacyKind === 'enumeration') return 'enumerations'
    if (legacyKind === 'hub') return 'hubs'
    return null // generic custom entity — no legacy settings
}
```

**Pros:**
- Minimal change: same pattern, same migration mechanism, same frontend hook
- Settings admin UI doesn't need changes — keys show up automatically
- Legacy surfaces (`SetList`, `EnumerationList`, `HubList`) already wire through `useEntityPermissions`
- Backend resolution is a simple lookup from the `legacyObjectKind` discriminator
- Legacy defaults are preserved: absent settings = feature allowed (fail-open)

**Cons:**
- Adds 4 more settings rows to every metahub (trivial data cost)
- Naming is locked to `{pluralKindName}.allow*` convention, not fully generic
- Doesn't cover future custom entity kinds that aren't legacy-compatible

**Risk:** LOW — additive settings, same patterns, no new abstractions.

### Option B: Generalize to `entities.<kindKey>.allowCopy` / `entities.<kindKey>.allowDelete`

Introduce a new settings namespace `entities.<kindKey>.*` that works for any entity kind, including custom kinds.

```
entities.custom.catalog-v2.allowCopy = true
entities.custom.hub-v2.allowCopy = true
entities.my-custom-type.allowCopy = true
```

**Pros:**
- Fully generic: works for any entity kind
- One namespace to rule all entity settings
- Future-proof for truly custom entity kinds

**Cons:**
- Breaking change: requires migrating existing `catalogs.*`, `enumerations.*` keys or maintaining two namespaces during coexistence
- Settings UI must dynamically discover entity-kind-specific keys
- Settings seeder must know about every active entity type (data-driven seeding)
- Dot-separated kindKey creates confusingly deep key paths (`entities.custom.catalog-v2.allowCopy`)
- `useEntityPermissions` needs a complete rewrite to accept `kindKey` instead of the predefined `EntityType` union

**Risk:** MEDIUM — sound architecture, but breaking changes during coexistence is risky. Better suited for the post-coexistence cleanup phase.

### Decision: Option A — Add Individual Settings Per Kind

**Rationale:** The frontend `useEntityPermissions` hook already resolves settings keys from a `{entityType}.allowCopy` pattern. The backend just needs 4 new settings rows and a `resolveSettingsPrefix()` helper. Option B is the right long-term direction, but introducing it during the coexistence phase creates unnecessary migration risk.

**Important nuance for truly custom kinds:** When a custom entity kind is NOT legacy-compatible (no `legacyObjectKind` in config), the generic entity route should default to allowing copy/delete (no settings override). This keeps the generic path simple: settings-based policy is a legacy-compatibility adapter, not a universal gate.

---

## DQ3: Hub V2 Specifics

### Problem Statement

Hubs are special across multiple dimensions:
1. **Parent-child hierarchy** (tree structure) via `config.parentHubId`
2. **Widget binding**: menu widget `bindToHub` / `boundHubId` links a layout menu item to a specific hub
3. **Entity categorization**: other entities reference hubs via `config.hubs[]` array
4. **Cycle detection**: on create/update, the backend validates no circular parent references
5. **Hub nesting** controlled by `hubs.allowNesting` setting
6. **No physical runtime table** — hubs don't generate `_xxx_*` tables
7. **Tree view UI** — `HubList` renders a tree with expandable nodes, not a flat list
8. **Snapshot remapping** — hub ids are remapped during restore to maintain referential integrity

### Hub V2 Architecture Options

#### Option A: Full Delegation to Legacy HubList (RECOMMENDED for Phase 1)

Hub V2 preset specifies `config.compatibility.legacyObjectKind: 'hub'`. The `EntityInstanceList` delegation map routes Hub V2 instances to the existing `<HubList />`. No hub-specific generic implementation is needed.

```ts
// hub-v2.entity-preset.ts
export const hubV2EntityPreset: EntityTypePresetManifest = {
    entityType: {
        kindKey: 'custom.hub-v2',
        components: {
            ...HUB_TYPE.components,
            // Enable scripting for V2 hubs (not in legacy)
            scripting: { enabled: true },
            actions: { enabled: true },
            events: { enabled: true },
        },
        config: {
            compatibility: {
                legacyObjectKind: 'hub'
            }
        }
    }
}
```

**What this preserves:**
- Tree view UI with expandable nodes and drag-to-reorder
- Parent-child validation and cycle detection
- `hubs.allowNesting` and `hubs.allowAttachExistingEntities` settings
- Widget `bindToHub` / `boundHubId` binding (existing menu widget editor resolves hub IDs from the same `_mhb_objects WHERE kind='hub'` query)
- Snapshot hub ID remapping
- All other entity references to hubs via `config.hubs[]`

**What Hub V2 adds over legacy:**
- Entity type definition in `_mhb_entity_type_definitions` (discoverable as an entity kind)
- Preset-based creation through `Entities` workspace
- Published to dynamic menu zone
- Potential for scripting/actions/events (if components are enabled in the preset)

**Pros:**
- Zero risk to existing hub behavior — the tree UI, hierarchy validation, and widget binding all stay on proven paths
- Widget `bindToHub` continues resolving from the same `_mhb_objects` query
- Snapshot/restore hub remapping works unchanged
- `useEntityPermissions('hubs')` + `hubs.allow*` settings work immediately

**Cons:**
- Hub V2 doesn't get a new modern UI — it reuses the legacy tree view
- Legacy `HubList` doesn't compose tabs from the component manifest (no dynamic scripts/actions/events tabs in the hub dialog)
- Hub-specific hierarchy is not expressed through the generic entity route; HubList manages its own parent-child state

**Risk:** LOW — this is identical to how Catalogs V2 delegates to CatalogList.

#### Option B: Generic Entity List + Hierarchy Component

Build a generic tree view into the entity instance list that activates when `hierarchy` component is enabled. This would replace `HubList` with a manifest-driven tree.

**Pros:**
- Fully generic: any entity kind can have hierarchy
- Single UI codebase for flat lists and trees

**Cons:**
- Tree view + drag reorder is complex; `HubList` has ~1100 lines of tree-specific logic
- Widget binding resolution would need to move from hub-specific queries to generic entity queries
- Hub ID remapping in snapshots needs a generic hierarchy-aware remapper
- All entity references that bind to hubs via `config.hubs[]` would need to resolve generic hierarchy entities
- Estimated effort: Level 3-4 on its own

**Risk:** HIGH — too much new surface for the V2 coexistence phase.

### Hub V2 Widget Binding Consideration

The `MenuWidgetEditorDialog` currently resolves hubs by querying `_mhb_objects WHERE kind='hub'`. For Hub V2, the query should resolve by checking the entity type's `legacyObjectKind === 'hub'` OR exactly `kind='hub'`. This is already naturally handled because:

1. Hub V2 objects are stored with `kind='custom.hub-v2'` in `_mhb_objects`
2. The widget editor needs to query **all** hub-like entities for its binding picker
3. Solution: the binding picker query should also include kinds where the resolved entity type has `legacyObjectKind='hub'`

Implementation: Add a simple SQL join or application-level resolution that discovers hub-compatible kinds from entity type definitions, then queries `_mhb_objects WHERE kind IN (discovered_hub_kinds)` for the widget binding picker. This can be deferred to Phase 2 — in Phase 1, only built-in `hub` kind objects appear in the binding picker, and Hub V2 entities are still manageable through the legacy hub surface.

### Decision: Option A — Full Delegation to Legacy HubList

**Rationale:** Hub behavior is the most complex and tightly coupled of all built-in kinds. The tree view, parent-child validation, widget binding, and snapshot remapping form a dense contract that cannot be safely reproduced in a generic surface during the coexistence phase. Delegating to `HubList` preserves all hub-specific behavior while establishing Hub V2 as a proper entity type in the system.

**Phase 2 follow-up**: After coexistence validation, consider extracting the tree view into a reusable `HierarchyListView` component that can be composed from the `hierarchy` component manifest entry, but this is a separate design topic.

---

## DQ4: Route Structure

### Problem Statement

Current entity-instance routes use `/metahub/:metahubId/entities/:kindKey/instances` for Catalogs V2. Should all V2 kinds follow this same pattern? What about the legacy routes?

### Current Route Landscape

| Route | Surface | Status |
|---|---|---|
| `/metahub/:metahubId/entities/:kindKey/instances` | `EntityInstanceList` | ✅ Active |
| `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/attributes` | Catalog V2 attributes | ✅ Active |
| `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/system` | Catalog V2 system attrs | ✅ Active |
| `/metahub/:metahubId/entities/:kindKey/instance/:catalogId/elements` | Catalog V2 elements | ✅ Active |
| `/metahub/:metahubId/hubs` | `HubList` | ✅ Legacy |
| `/metahub/:metahubId/catalogs` | `CatalogList` | ✅ Legacy |
| `/metahub/:metahubId/sets` | `SetList` | ✅ Legacy |
| `/metahub/:metahubId/enumerations` | `EnumerationList` | ✅ Legacy |

### Decision: Uniform Entity Route Pattern (RECOMMENDED)

All V2 kinds use the same pattern: `/metahub/:metahubId/entities/:kindKey/instances`

| V2 Kind | Route | Delegate |
|---|---|---|
| `custom.catalog-v2` | `/metahub/:metahubId/entities/custom.catalog-v2/instances` | → `CatalogList` |
| `custom.hub-v2` | `/metahub/:metahubId/entities/custom.hub-v2/instances` | → `HubList` |
| `custom.set-v2` | `/metahub/:metahubId/entities/custom.set-v2/instances` | → `SetList` |
| `custom.enumeration-v2` | `/metahub/:metahubId/entities/custom.enumeration-v2/instances` | → `EnumerationList` |

**Rationale:**
- Consistent entry point: all entity-based navigation goes through `EntityInstanceList`
- `EntityInstanceList` resolves the entity type definition, checks for legacy delegation, and renders accordingly
- The URL is informative: the `:kindKey` segment identifies what type of entity is being managed
- Browser history and bookmarks are consistent across kind types
- Legacy routes remain available for direct legacy access; no need to remove them

**Legacy route coexistence:**
- Legacy routes (`/metahub/:metahubId/hubs`, etc.) continue to work and point to their own legacy surfaces
- Dynamic menu V2 entries use the entity route pattern
- Users can access both surfaces during validation

**Hub V2 route nuance:** `HubList` currently reads parent context from its own route params. When delegated from `EntityInstanceList`, it may need the parent hub context threaded through props instead of route params. This is a localized adaptation:
- `EntityInstanceList` passes `{ legacyKind: 'hub' }` context to the delegate
- `HubList` adapts to accept either route params or props for its parent hub context

---

## DQ5: Backend Controller Generalization

### Problem Statement

`entityInstancesController.ts` has catalog-specific logic:
1. Settings keys hardcoded to `'catalogs.allowCopy'` / `'catalogs.allowDelete'`
2. Blocking references use `findCatalogReferenceBlockers`
3. ACL: `editContent` for catalog-compatible kinds, `manageMetahub` for generic

### Generalization Strategy

#### Step 1: Settings Key Resolution

Replace hardcoded catalog settings with a `resolveLegacySettingsPrefix` helper:

```ts
// In catalogCompatibility.ts → rename to legacyCompatibility.ts
export const resolveLegacySettingsPrefix = (resolvedType: ResolvedEntityType): string | null => {
    const legacyKind = getLegacyCompatibleObjectKind(resolvedType.config ?? resolvedType)
    const LEGACY_SETTINGS_MAP: Record<string, string> = {
        catalog: 'catalogs',
        set: 'sets',
        enumeration: 'enumerations',
        hub: 'hubs',
    }
    return legacyKind ? LEGACY_SETTINGS_MAP[legacyKind] ?? null : null
}
```

Then in the controller:

```ts
const checkLegacyCompatibleCopyPolicy = async (...) => {
    const prefix = resolveLegacySettingsPrefix(resolvedType)
    if (!prefix) return null // no legacy settings for generic custom entities
    
    const allowCopyRow = await settingsService.findByKey(metahubId, `${prefix}.allowCopy`, userId)
    if (allowCopyRow && allowCopyRow.value?._value === false) {
        return { status: 403, body: { error: `Copying ${prefix} is disabled in metahub settings` } }
    }
    return null
}
```

#### Step 2: Blocking References Generalization

Currently only catalogs have blocking references (via `findCatalogReferenceBlockers`). For sets and enumerations, blocking references are different:
- **Sets**: constants may be referenced by attribute default values or element defaults
- **Enumerations**: enumeration values may be referenced by attribute configurations
- **Hubs**: entities reference hubs through `config.hubs[]`

Each kind has its own blocking-reference semantics. The generic entity route should delegate to kind-specific blocker finders:

```ts
const LEGACY_BLOCKER_FINDERS: Partial<Record<string, BlockerFinder>> = {
    catalog: (metahubId, entityId, services, userId) => 
        services.attributesService.findCatalogReferenceBlockers(metahubId, entityId, userId),
    hub: (metahubId, entityId, services, userId) => 
        services.hubsService.findHubReferenceBlockers(metahubId, entityId, userId),
    // sets and enumerations may not need blocking — they use direct delete
}
```

#### Step 3: ACL Per Legacy Kind

Currently:
- Catalog-compatible → `editContent` for create/update/copy/restore, `deleteContent` for delete
- Generic → `manageMetahub` for all mutations

For V2 generalization:

| Legacy Kind | Create/Update/Copy/Restore | Delete |
|---|---|---|
| `catalog` | `editContent` | `deleteContent` |
| `set` | `editContent` | `deleteContent` |
| `enumeration` | `editContent` | `deleteContent` |
| `hub` | `editContent` | `deleteContent` |
| Generic custom | `manageMetahub` | `manageMetahub` |

The rule: if `resolveLegacySettingsPrefix()` returns non-null, use `editContent`/`deleteContent`. Otherwise, use `manageMetahub`.

```ts
const resolveAclPermission = (resolvedType: ResolvedEntityType, mutationType: 'write' | 'delete'): string => {
    const prefix = resolveLegacySettingsPrefix(resolvedType)
    if (!prefix) return 'manageMetahub'
    return mutationType === 'delete' ? 'deleteContent' : 'editContent'
}
```

### Decision Summary

The backend generalization is a mechanical refactoring:
1. Extract `resolveLegacySettingsPrefix()` from the existing catalog-specific code
2. Replace hardcoded `'catalogs.allowCopy'` → `\`${prefix}.allowCopy\``
3. Replace hardcoded `isCatalogCompatibleEntityType` → `resolveLegacySettingsPrefix` for settings/ACL
4. Keep `isCatalogCompatibleEntityType` for catalog-specific behaviors (blocking references, copy options)
5. Add kind-specific blocker finders as an optional extension point

---

## DQ6: Preset Template Design

### Component Manifest Comparison

Based on the existing `BUILTIN_ENTITY_TYPES` definitions:

| Component | Catalog | Set | Enumeration | Hub | Document |
|---|---|---|---|---|---|
| `dataSchema` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `predefinedElements` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `hubAssignment` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `enumerationValues` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `constants` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `hierarchy` | ✅ (folders) | ❌ | ❌ | ❌ | ❌ |
| `nestedCollections` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `relations` | ✅ (m:1) | ❌ | ❌ | ❌ | ✅ (m:1, 1:m) |
| `actions` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `events` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `scripting` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `layoutConfig` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `runtimeBehavior` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `physicalTable` | ✅ (cat) | ❌ | ❌ | ❌ | ✅ (doc) |

### Hub V2 Preset

```ts
export const hubV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'hub-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Hubs V2', 'Хабы V2'),
    description: vlc(
        'Hub-compatible custom entity preset for hierarchical categorization with scripting and automation.',
        'Пресет пользовательской сущности в стиле хаба для иерархической категоризации со скриптами и автоматизацией.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'hub'],
        icon: HUB_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.hub-v2',
        codename: vlc('HubV2', 'HubV2'),
        components: {
            ...HUB_TYPE.components,
            // V2 upgrades over legacy hubs:
            scripting: { enabled: true },
            actions: { enabled: true },
            events: { enabled: true },
        },
        ui: {
            ...HUB_TYPE.ui,
            nameKey: 'Hubs V2',
            descriptionKey: 'Hub-compatible custom entity with tree hierarchy, scripting, and design-time automation.'
        },
        presentation: {
            name: vlc('Hubs V2', 'Хабы V2'),
            description: vlc(
                'Hub-compatible custom entity preset with tree hierarchy, scripting, and automation support.',
                'Пресет пользовательской сущности в стиле хаба с иерархией, скриптами и поддержкой автоматизации.'
            )
        },
        config: {
            compatibility: {
                legacyObjectKind: 'hub'
            }
        }
    }
}
```

**Hub V2 vs Legacy Hub differences:**
- ✅ Scripting enabled (legacy hubs had no scripts)
- ✅ Actions/Events enabled (legacy hubs had no automation)
- ✅ Discoverable as an entity type in `EntitiesWorkspace`
- ✅ Published to dynamic menu zone
- = Same tree view, hierarchy, widget binding, snapshot behavior

### Set V2 Preset

```ts
export const setV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'set-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Sets V2', 'Наборы V2'),
    description: vlc(
        'Set-compatible custom entity preset for attributes, constants, scripting, and automation.',
        'Пресет пользовательской сущности в стиле набора с атрибутами, константами, скриптами и автоматизацией.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'set'],
        icon: SET_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.set-v2',
        codename: vlc('SetV2', 'SetV2'),
        components: SET_TYPE.components,  // already has actions/events/scripting
        ui: {
            ...SET_TYPE.ui,
            nameKey: 'Sets V2',
            descriptionKey: 'Set-compatible custom entity with attributes, constants, scripts, and design-time automation.'
        },
        presentation: {
            name: vlc('Sets V2', 'Наборы V2'),
            description: vlc(
                'Set-compatible custom entity preset with attributes, constants, scripting, and automation support.',
                'Пресет пользовательской сущности в стиле набора с атрибутами, константами, скриптами и автоматизацией.'
            )
        },
        config: {
            compatibility: {
                legacyObjectKind: 'set'
            }
        }
    }
}
```

### Enumeration V2 Preset

```ts
export const enumerationV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'enumeration-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Enumerations V2', 'Перечисления V2'),
    description: vlc(
        'Enumeration-compatible custom entity preset for value lists with scripting and automation.',
        'Пресет пользовательской сущности в стиле перечисления для списков значений со скриптами и автоматизацией.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'enumeration'],
        icon: ENUMERATION_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.enumeration-v2',
        codename: vlc('EnumerationV2', 'EnumerationV2'),
        components: {
            ...ENUMERATION_TYPE.components,
            // V2 upgrades over legacy enumerations:
            actions: { enabled: true },
            events: { enabled: true },
        },
        ui: {
            ...ENUMERATION_TYPE.ui,
            nameKey: 'Enumerations V2',
            descriptionKey: 'Enumeration-compatible custom entity with value lists, scripting, and design-time automation.'
        },
        presentation: {
            name: vlc('Enumerations V2', 'Перечисления V2'),
            description: vlc(
                'Enumeration-compatible custom entity preset for value lists with scripting and automation support.',
                'Пресет пользовательской сущности в стиле перечисления для списков значений, скриптов и автоматизации.'
            )
        },
        config: {
            compatibility: {
                legacyObjectKind: 'enumeration'
            }
        }
    }
}
```

**Enumeration V2 vs Legacy Enumeration differences:**
- ✅ Actions/Events enabled (legacy enumerations had none)
- ✅ Scripting already enabled in legacy (stays as-is)
- ✅ Discoverable as an entity type in `EntitiesWorkspace`
- ✅ Published to dynamic menu zone

### Kind-Specific Feature Handling

| Feature | Where handled | V2 approach |
|---|---|---|
| Hub hierarchy (parent-child) | `hubsController.ts` + `HubList` tree view | Delegated to legacy `HubList` via `legacyObjectKind='hub'` |
| Enumeration values | `enumerationsRoutes.ts` + `OptionValueList` | Delegated to legacy `EnumerationList` via `legacyObjectKind='enumeration'` |
| Set constants | `constantsRoutes.ts` + `ConstantList` | Delegated to legacy `SetList` via `legacyObjectKind='set'` |
| Hub widget binding | `MenuWidgetEditorDialog` queries hubs | Phase 1: only built-in hub kind; Phase 2: query by `legacyObjectKind='hub'` |

---

## DQ7: Menu Integration

### Problem Statement

Currently the sidebar generates menu items for Hubs, Sets, Enumerations as hardcoded entries. With V2, these should appear in the dynamic published-section zone.

### Decision: Dynamic Menu for V2, Legacy Menu for V1 (RECOMMENDED)

During coexistence:
- **Legacy menu entries** (Catalogs, Sets, Enumerations, Hubs) remain hardcoded in the sidebar
- **V2 entity menu entries** appear in the dynamic published-section zone (between legacy items and Publications/Settings)
- V2 entries use `uiConfig.icon` and the entity type's display name
- V2 entries link to `/metahub/:metahubId/entities/:kindKey/instances`

This is exactly how Catalogs V2 already works: published through the dynamic menu mechanism from `getMetahubMenuItems()`, using entity type metadata for label/icon resolution.

After coexistence validation:
- Legacy menu entries can be conditionally hidden when the equivalent V2 type is published
- Eventually legacy entries are removed entirely

No menu integration code changes are needed — the existing dynamic menu mechanism handles new V2 kinds automatically when they are published through the entity type's `published: true` flag.

---

## Component Manifest Comparison

### V2 Preset Manifests Side-by-Side

| Component | Catalogs V2 | Hubs V2 | Sets V2 | Enumerations V2 |
|---|---|---|---|---|
| `dataSchema` | ✅ | ❌ | ✅ | ❌ |
| `predefinedElements` | ✅ | ❌ | ❌ | ❌ |
| `hubAssignment` | ✅ | ❌ | ❌ | ❌ |
| `enumerationValues` | ❌ | ❌ | ❌ | ✅ |
| `constants` | ❌ | ❌ | ✅ | ❌ |
| `hierarchy` | ✅ (folders) | ❌ | ❌ | ❌ |
| `nestedCollections` | ❌ | ❌ | ❌ | ❌ |
| `relations` | ✅ (m:1) | ❌ | ❌ | ❌ |
| `actions` | ✅ | ✅ *(new)* | ✅ | ✅ *(new)* |
| `events` | ✅ | ✅ *(new)* | ✅ | ✅ *(new)* |
| `scripting` | ✅ | ✅ *(new)* | ✅ | ✅ |
| `layoutConfig` | ✅ | ❌ | ✅ | ❌ |
| `runtimeBehavior` | ✅ | ❌ | ❌ | ❌ |
| `physicalTable` | ✅ (catx) | ❌ | ❌ | ❌ |

Items marked *(new)* are components newly enabled in V2 that were absent in the legacy kind.

---

## Incremental Migration Strategy

### Phase 1: V2 Presets + Frontend Delegation (Current Target)

**Scope:**
1. Create `hub-v2.entity-preset.ts`, `set-v2.entity-preset.ts`, `enumeration-v2.entity-preset.ts`
2. Register in `builtinEntityTypePresets` array
3. Generalize `EntityInstanceList` delegation from catalog-only to kind-registry map
4. Add missing settings: `sets.allowCopy`, `sets.allowDelete`, `hubs.allowCopy`, `hubs.allowDelete`
5. Generalize `entityInstancesController` settings/ACL resolution
6. Add EN/RU i18n keys for new presets

**What users get:**
- Can create Hub V2, Set V2, Enumeration V2 entity types from presets in `EntitiesWorkspace`
- V2 entity types appear in the dynamic sidebar menu when published
- Clicking a V2 entity type opens the corresponding legacy list surface (full feature parity)
- Copy/delete policies respect settings per kind

**What stays unchanged:**
- Legacy routes and surfaces continue working
- Snapshot format (v3 already supports custom entity types)
- Runtime behavior (V2 sets/enumerations/hubs have no runtime tables, same as legacy)
- Widget binding (still resolves from built-in hub kind only)

### Phase 2: Enhanced V2 Surfaces

**Scope (deferred):**
- Hub V2 widget binding resolution includes `custom.hub-v2` kind
- Set V2 / Enumeration V2 gain embedded scripts/actions/events tabs in edit dialogs (currently they only have these if the generic entity shell is used, but delegation sends them to legacy surfaces)
- Consider extracting `HierarchyListView` from `HubList` for generic reuse
- Consider extracting `EnumerationValueEditor` for generic reuse

### Phase 3: Legacy Surface Retirement

**Scope (far future):**
- Remove legacy-specific routes when V2 surfaces pass full acceptance
- Collapse `CatalogList`, `SetList`, `EnumerationList`, `HubList` into one manifest-driven component
- Migrate settings keys to `entities.<kindKey>.*` namespace
- Remove `legacyObjectKind` compatibility adapter

### Coexistence Guarantees

During Phases 1-2:
- Both legacy routes (`/metahub/:id/hubs`) and V2 routes (`/metahub/:id/entities/custom.hub-v2/instances`) work simultaneously
- Both entries appear in the sidebar (legacy hardcoded, V2 dynamic)
- Both surfaces read/write the same `_mhb_objects` rows
- Users can freely switch between legacy and V2 access paths
- Data is always consistent — there is no separate V2 data store

---

## Testing Strategy

### Unit Tests

| Test Surface | What to Verify | Package |
|---|---|---|
| `resolveLegacySettingsPrefix()` | Returns correct prefix for each legacy kind, null for custom | `metahubs-backend` |
| `resolveAclPermission()` | Correct ACL for each kind's write/delete mutations | `metahubs-backend` |
| `LEGACY_INSTANCE_DELEGATES` map | Each legacy kind maps to a component | `metahubs-frontend` |
| `EntityInstanceList` delegation | Renders correct delegate for each legacy-compatible kind | `metahubs-frontend` |
| `useEntityPermissions` | Resolves settings for sets/hubs (new keys) | `metahubs-frontend` |
| Preset manifests | Valid component dependencies, correct legacyObjectKind | `metahubs-backend` |
| `buildEntityTypePresetFormPatch` | Correct form values for each new preset | `metahubs-frontend` |

### Integration Tests (Backend Route Tests)

| Test | What to Verify |
|---|---|
| Entity instance copy with set-compatible kind | `sets.allowCopy=false` blocks copy |
| Entity instance delete with hub-compatible kind | `hubs.allowDelete=false` blocks delete |
| Entity instance create with enum-compatible kind | `editContent` ACL applies |
| Settings seeder | New `sets.allowCopy`, `sets.allowDelete`, `hubs.allowCopy`, `hubs.allowDelete` keys exist |

### E2E (Playwright)

| Flow | What to Verify |
|---|---|
| Hub V2 preset → create entity type → publish → sidebar link → opens HubList | Full lifecycle from preset to live surface |
| Set V2 preset → create entity type → publish → sidebar link → opens SetList | Full lifecycle |
| Enumeration V2 preset → create entity type → publish → sidebar link → opens EnumerationList | Full lifecycle |
| V2 + Legacy coexistence | Both sidebar entries resolve, data is shared |
| Copy/delete with settings disabled | Action buttons hidden when settings are off |

### Visual Tests

Snapshot comparisons between:
- Legacy HubList and Hub V2 delegated HubList (should be pixel-identical)
- Legacy SetList and Set V2 delegated SetList (should be pixel-identical)
- Legacy EnumerationList and Enumeration V2 delegated EnumerationList (should be pixel-identical)

---

## i18n Strategy

### New i18n Keys (EN)

```json
{
    "metahubs": {
        "entities": {
            "presets": {
                "hubV2": {
                    "name": "Hubs V2",
                    "description": "Hub-compatible custom entity with tree hierarchy, scripting, and automation"
                },
                "setV2": {
                    "name": "Sets V2",
                    "description": "Set-compatible custom entity with attributes, constants, and automation"
                },
                "enumerationV2": {
                    "name": "Enumerations V2",
                    "description": "Enumeration-compatible custom entity with value lists and automation"
                }
            }
        },
        "settings": {
            "sets.allowCopy": "Allow copying sets",
            "sets.allowDelete": "Allow deleting sets",
            "hubs.allowCopy": "Allow copying hubs",
            "hubs.allowDelete": "Allow deleting hubs"
        }
    }
}
```

### New i18n Keys (RU)

```json
{
    "metahubs": {
        "entities": {
            "presets": {
                "hubV2": {
                    "name": "Хабы V2",
                    "description": "Пользовательская сущность в стиле хаба с иерархией, скриптами и автоматизацией"
                },
                "setV2": {
                    "name": "Наборы V2",
                    "description": "Пользовательская сущность в стиле набора с атрибутами, константами и автоматизацией"
                },
                "enumerationV2": {
                    "name": "Перечисления V2",
                    "description": "Пользовательская сущность в стиле перечисления со списками значений и автоматизацией"
                }
            }
        },
        "settings": {
            "sets.allowCopy": "Разрешить копирование наборов",
            "sets.allowDelete": "Разрешить удаление наборов",
            "hubs.allowCopy": "Разрешить копирование хабов",
            "hubs.allowDelete": "Разрешить удаление хабов"
        }
    }
}
```

Note: The preset manifests use `vlc()` (VersionedLocalizedContent) format for name/description, which handles EN/RU natively through the preset's VLC structure. The i18n keys above are for settings labels and any UI text outside of VLC-backed fields.

---

## Recommendation Summary

### Design Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| DQ1 | Frontend Delegation Pattern | **Kind-Registry Map** | Simple lookup from `legacyObjectKind` → legacy component; extends proven pattern; zero new abstractions |
| DQ2 | Settings Generalization | **Individual Settings Per Kind** | Add `sets.*` and `hubs.*` settings; `useEntityPermissions` already generalized; no breaking changes |
| DQ3 | Hub V2 Specifics | **Full Delegation to Legacy HubList** | Hub tree/widget/hierarchy too complex to reproduce generically in coexistence phase |
| DQ4 | Route Structure | **Uniform Entity Route Pattern** | All V2 kinds use `/entities/:kindKey/instances`; legacy routes remain parallel |
| DQ5 | Backend Controller Generalization | **Settings prefix resolution + ACL mapping** | Mechanical refactoring; catalog-specific → legacy-kind-generic |
| DQ6 | Preset Template Design | **3 new presets** extending built-in types | Hub V2 adds scripting/automation; Set V2 inherits; Enum V2 adds automation |
| DQ7 | Menu Integration | **Dynamic menu for V2** | Existing mechanism handles new kinds automatically; no code changes needed |

### Key Architecture Principles

1. **Delegation over rewrite**: V2 kinds delegate to proven legacy surfaces instead of building new UI
2. **`legacyObjectKind` is the universal adapter key**: settings, ACL, frontend delegation, and blocker resolution all pivot on this single discriminator
3. **Coexistence is non-negotiable**: legacy routes/menus/surfaces stay live until V2 passes acceptance
4. **V2 value add is structural**: entity type definitions, preset-based creation, dynamic menu publishing, and scripting/automation enablement — not new UI surfaces
5. **Phase 1 is low-risk**: all 4 design decisions are additive or mechanical; no breaking changes, no new UI components, no table changes beyond settings rows

### Estimated Effort

| Work Item | Effort |
|---|---|
| 3 new preset files + registration | S (< 1 day) |
| `EntityInstanceList` delegation map | S (< 1 day) |
| Backend settings prefix generalization | M (1–2 days) |
| New settings rows + migration | S (< 1 day) |
| EN/RU i18n keys | S (< 0.5 day) |
| Backend route coverage updates | M (1–2 days) |
| Frontend delegation coverage | M (1 day) |
| E2E flows (3 new presets) | M (1–2 days) |
| Fixture/snapshot regeneration | S (< 0.5 day) |
| **Total Phase 1** | **~1–1.5 weeks** |

### Files To Be Created or Modified

**New Files:**
- `packages/metahubs-backend/base/src/domains/templates/data/hub-v2.entity-preset.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/set-v2.entity-preset.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/enumeration-v2.entity-preset.ts`
- `packages/metahubs-frontend/base/src/domains/entities/ui/entityInstanceDelegates.ts`

**Modified Files:**
- `packages/metahubs-backend/base/src/domains/templates/data/index.ts` — add 3 new presets
- `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` — generalize settings/ACL
- `packages/metahubs-backend/base/src/domains/catalogs/services/catalogCompatibility.ts` — extract `resolveLegacySettingsPrefix()`
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx` — delegation map
- `packages/metahubs-frontend/base/src/domains/settings/hooks/useEntityPermissions.ts` — no change needed (already generic)
- Settings migration file — add missing `sets.*`, `hubs.*` settings
- i18n files (EN/RU) for preset labels

### Constraints Preserved

1. ✅ Legacy Catalogs/Sets/Enumerations/Hubs remain user-visible and operational
2. ✅ `_mhb_objects.kind` accepts both built-in and custom kind values
3. ✅ Snapshot format v3 unchanged
4. ✅ All existing E2E tests remain green
5. ✅ Dynamic menu mechanism handles V2 kinds automatically
6. ✅ ComponentManifest JSON remains the stable contract
7. ✅ Custom-type components stay gated until service/runtime seams are proven
8. ✅ Policy reuse: V2 kinds reuse legacy settings/ACL through the settings prefix adapter
