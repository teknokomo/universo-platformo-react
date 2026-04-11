# Entity-Component Architecture — Implementation Plan

> **Created**: 2026-04-08  
> **Updated**: 2026-04-08 (QA closure: runtime/design-time seam coverage, policy reuse, ownership clarifications)  
> **Status**: Draft v4 — awaiting approval  
> **Complexity**: Level 4 — Major/Complex  
> **Prerequisite**: Shared/Common feature wave (PR #755) merged  
> **Creative design**: [creative-entity-component-architecture.md](../creative/creative-entity-component-architecture.md)  
> **Research**: `.backup/Гибкая-архитектура-метаданных-на-основе-Entity.md`, `.backup/Гибкая-архитектура-метахабов-Universo-Platformo.md`

---

## Overview

Introduce a composable **Entity-Component-Action-Event (ECAE)** architecture for metahubs while keeping the current Catalogs/Sets/Enumerations UX alive during rollout. Entity types are defined by attaching Components (DataSchema, PredefinedElements, Hierarchy, Relations, Actions, Events, etc.) instead of writing new monolithic metadata object classes. The current delivery scope is not just backend genericization: it includes an **Entities** builder surface in the metahub menu, a **dynamic published menu zone** for entity-based sections such as **Catalogs v2**, pixel-perfect parity with legacy Catalogs, and full publication/runtime/browser validation across `metahubs-backend`, `applications-backend`, `applications-frontend`, and `apps-template-mui` using the same underlying tables.

The long-term architecture still converges toward a generic entity domain with dramatically less duplication, but **legacy removal happens only after product acceptance**: old Catalogs and new Catalogs v2 must coexist, operate on the same data, and remain mutually visible until the new path passes the full parity matrix.

### Key Constraints

1. **Same database tables** — entity-based Catalogs v2 must use the same `_mhb_objects` + `_mhb_attributes` + `_mhb_elements` + `_mhb_values` + `_mhb_constants` tables as legacy Catalogs/Sets/Enumerations
2. **Coexistence-first rollout** — legacy Catalogs/Sets/Enumerations remain available until the entity-based replacement passes product validation; no user-facing removal in the current wave
3. **Explicit menu rollout** — add a fixed `Entities` item below `Common`, then publish entity-based sections such as `Catalogs v2` through a new dynamic menu zone below the hardcoded legacy items
4. **Pixel-perfect parity** — entity-based Catalogs v2 must be visually identical to legacy Catalogs in EN and RU, including Attributes, System Attributes, Predefined Elements, and create/edit/copy dialogs
5. **Full cycle validation** — Playwright must create a fresh test metahub, assemble Catalogs v2 through Entities, publish, create an application, and validate runtime behavior in the browser
6. **Service-bound lifecycle safety** — Action/Event dispatch must run through transaction-aware mutation services, not only HTTP route handlers
7. **Full snapshot/shared-contract migration** — snapshot format v2 → v3 plus shared type updates (`MetahubSnapshotFormatVersion`, script attachment contracts, runtime/widget config contracts)
8. **Full i18n** — all new text in EN + RU
9. **Reuse existing UI primitives** — prefer `EntityFormDialog`, `createEntityActions()`, `useListDialogs()`, `FlowListTable`, `ViewHeader`, `EntityScriptsTab`, `LayoutList`, and other existing shared components; new UI building blocks must first be extracted generically into `@universo/template-mui`
10. **Future-ready** — ComponentManifest JSON remains the stable contract for future AOT compilation and advanced Zerocode extensions
11. **Policy reuse over duplication** — Catalog-compatible entity presets must reuse the existing platform system-attribute policy/seed helpers and current shared layout/script contracts instead of re-implementing them in parallel
12. **Capability gating over wishful manifests** — no component is exposed for arbitrary custom types until the corresponding design-time service, publication contract, and runtime UI path are proven generic or explicitly adapter-backed

---

## Affected Areas

### Packages Modified

| Package | Change | Phase |
|---|---|---|
| `@universo/types` | `MetaEntityKind` type evolution → `EntityKind`, `EntityTypeDefinition`, `ComponentManifest` (with ECAE), snapshot v3/shared contract widening, script attachment contract widening | 1–3 |
| `@universo/metahubs-backend` | Shared entity services, coexistence-safe compatibility layer, transaction-aware lifecycle dispatch, entity type service, snapshot serializer/restore refactor | 1–3 |
| `@universo/metahubs-frontend` | `Entities` workspace below `Common`, generic-but-coexisting list/form surfaces, dynamic menu publication zone, shared `GeneralTabFields` extraction, Catalogs v2 parity flow | 1–3 |
| `@universo/schema-ddl` | Custom table prefix support in `generateTableName()` | 3 |
| `@universo/applications-backend` | Generic entity awareness in sync/runtime controllers, catalog-centric selector removal, runtime script attachment widening | 3 |
| `@universo/applications-frontend` | Runtime adapter/page genericization away from catalog-only route state, published-section routing, page-surface parity for entity-based sections | 3 |
| `@universo/apps-template-mui` | Runtime UI genericization for entity-based sections, page-surface/data-form reuse, and widget config widening beyond catalog-only assumptions | 3 |
| `@universo/universo-template-mui` | Reuse-first extensions only: `EntityFormDialog` dynamic tab composition, `DynamicEntityFormDialog` schema-driven editors, `createEntityActions()` integration, no bespoke dialog orchestration | 2–3 |
| `@universo/universo-migrations-platform` | New `_mhb_entity_type_definitions`, `_mhb_actions`, `_mhb_event_bindings` system tables | 2 |
| `@universo/universo-i18n` | New i18n keys for Entity Types UI, ECAE, components (EN + RU) | 2 |
| `@universo/scripting-engine` | Action executor integration with event router | 3 |

### Compatibility Surfaces During Current Rollout

| Surface | Current-wave requirement | Post-acceptance direction |
|---|---|---|
| Legacy routes (`/catalogs`, `/sets`, `/enumerations`) | Must remain reachable and functionally valid during rollout | May later collapse into thin wrappers over generic services |
| Legacy list/dialog UI | Must remain available for side-by-side parity checks | May later reuse generic entity UI completely |
| `Catalogs v2` | Must be produced through the new entity system and dynamic menu publishing, not hardcoded | Becomes the replacement path once acceptance is complete |
| Generic entity domain | Introduced now as the new foundation | Becomes the primary implementation layer after coexistence ends |

### Packages Unaffected

`universo-core-backend`, `universo-core-frontend`, `auth-*`, `admin-*`, `profile-*`, `start-*`, `universo-database`, `extension-sdk` — orthogonal, no changes needed.

### Architecture Decision: Per-Branch Type Definitions

Entity type definitions (`_mhb_entity_type_definitions`) are stored **per-branch** in `_mhb_*` system tables, not in the global `metahubs` schema. Rationale:
- Types can be experimented with in feature branches without affecting production
- Types participate naturally in branch merge/conflict resolution workflows
- Types are included in snapshots and can be exported/imported atomically
- Consistent with existing `_mhb_objects`, `_mhb_attributes` scoping

Branch merge implication: conflicting `kind_key` values produce a merge conflict, resolved manually (same as codename conflicts today).

### Architecture Decision: Coexistence-First Rollout

Even though large refactors are allowed, the current implementation wave must preserve **two simultaneous user paths**:

- Legacy hardcoded Catalogs/Sets/Enumerations stay visible and operational
- New `Entities` workspace appears below `Common` for configuring entity types and published sections
- New entity-based sections such as `Catalogs v2` are published into a separate dynamic menu zone below the legacy static items
- Old and new paths read/write the same records so data stays mutually visible during validation

Legacy removal is a **later cleanup phase**, not part of current acceptance.

### Architecture Decision: Service-Level Lifecycle Boundary

Lifecycle Actions/Events must be dispatched from a transaction-aware mutation service, not only from Express routes. This prevents snapshot restore, template seeding, copy/import flows, and other internal writers from bypassing lifecycle rules accidentally.

Introduce explicit mutation modes:

- `interactive` — full before/after lifecycle dispatch
- `copy` — copy-specific lifecycle dispatch (`beforeCopy`, `afterCopy`) plus configurable create hooks
- `restore` / `seed` — default silent restore without replaying user automations unless explicitly requested

This follows the same safety principle used by mature metadata systems: data import/restore and user-facing interactive CRUD are not treated as the same lifecycle context.

### Architecture Decision: Actions/Events Ownership Model

The current wave uses a single concrete ownership model to avoid dual storage:

- `_mhb_entity_type_definitions` declare whether a type supports Actions/Events
- concrete Action definitions and Event Bindings attach to design-time metadata object rows via `_mhb_actions.object_id` and `_mhb_event_bindings.object_id`
- no separate type-default action store or per-runtime-record override layer exists in the current wave

This keeps routes, persistence, snapshots, and mutation services aligned. Future blueprint presets can be added later, but only as an additive layer on top of the object-owned contract.

### Architecture Decision: Capability Gating Against Proven Service Seams

`ComponentManifest` is an enablement contract, not a promise that every backing service is already generic. A component becomes selectable for arbitrary custom types only after the design-time service, snapshot/publication transport, and runtime UI seams are either genericized or explicitly adapter-backed.

This allows `Catalogs v2` to dogfood catalog-compatible services immediately while preventing the builder from exposing unsupported combinations that would create hidden technical debt.

### Architecture Decision: Reuse Existing Template Registry For Global Presets

The original architecture idea calls for a reusable global catalog of entity-type definitions in the `metahubs` schema. The repository already has a platform-level template registry (`metahubs.cat_templates` + `metahubs.doc_template_versions`) and existing frontend selection patterns (`TemplateSelector`, `useTemplates()`), so the plan should extend that seam instead of introducing a second global preset store.

Current-wave implication:

- branch-local working definitions still live in `_mhb_entity_type_definitions`
- built-in catalog-compatible presets may still ship from code for the first rollout wave
- reusable cross-metahub entity presets should later reuse the existing template registry/versioning flow, not a brand-new global table or separate preset picker UI

### Architecture Decision: Reuse-First UI Composition

The Entities/Zerocode rollout must be built on top of existing frontend primitives wherever possible:

- `EntityFormDialog` for dialog shells and tab containers
- `DynamicEntityFormDialog` for schema-driven field/value editors
- `createEntityActions()` and `BaseEntityMenu` for CRUD action wiring
- `useListDialogs()` for modal state orchestration
- `FlowListTable`, `ViewHeader`, `EntityScriptsTab`, `LayoutList`, `HubSelectionPanel`, and existing localized input/codename helpers

The current wave should prefer **form-driven Zerocode MVP** over a brand-new canvas UI if parity can be reached with existing shared components. The dialog rule is strict: `EntityFormDialog` owns metadata-object authoring shells and mixed tab composition, while `DynamicEntityFormDialog` owns attribute-driven value/data editors. New UI primitives are justified only when extracted generically into `@universo/template-mui`.

---

## Phase 1: Registry Foundation (Pure Refactor)

**Goal**: Extract current hardcoded kind/component behavior into formal registries without any user-visible change.

### Step 1.1: Entity Kind Type Evolution

**File**: `packages/universo-types/base/src/common/metahubs.ts`

Current:
```typescript
const _META_ENTITY_KIND_MAP = {
    CATALOG: 'catalog',
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub',
    DOCUMENT: 'document'
} as const

export type MetaEntityKind = (typeof _META_ENTITY_KIND_MAP)[keyof typeof _META_ENTITY_KIND_MAP]
```

Proposed addition (non-breaking):
```typescript
// Preserve existing type as-is for backward compat
export const BuiltinEntityKinds = _META_ENTITY_KIND_MAP
export type BuiltinEntityKind = MetaEntityKind

// Nominal branding trick: BuiltinEntityKind | arbitrary string
export type EntityKind = BuiltinEntityKind | (string & {})

export function isBuiltinKind(kind: string): kind is BuiltinEntityKind {
    return META_ENTITY_KINDS.includes(kind as BuiltinEntityKind)
}
```

**Validation**: existing code continues using `MetaEntityKind` type — zero impact.

- [ ] Add `EntityKind` type to `@universo/types`
- [ ] Add `isBuiltinKind()` helper
- [ ] Add `BuiltinEntityKinds` re-export
- [ ] Build `@universo/types` — verify zero downstream breakage

### Step 1.2: Component Manifest Interface

**File**: NEW `packages/universo-types/base/src/common/entityComponents.ts`

```typescript
export interface ComponentConfig {
    enabled: boolean
}

export interface DataSchemaComponentConfig extends ComponentConfig {
    maxAttributes?: number | null
}

export interface PredefinedElementsComponentConfig extends ComponentConfig {
    maxElements?: number | null
}

export interface HubAssignmentComponentConfig extends ComponentConfig {
    isSingleHub?: boolean
    isRequiredHub?: boolean
}

export interface HierarchyComponentConfig extends ComponentConfig {
    /** Enables ParentID self-reference and IsFolder flag for tree structures */
    supportsFolders?: boolean
}

export interface NestedCollectionsComponentConfig extends ComponentConfig {
    /** Max number of child collection types (tabular parts) */
    maxCollections?: number | null
}

export interface RelationsComponentConfig extends ComponentConfig {
    /** Allowed relation types: oneToOne, oneToMany, manyToOne, manyToMany */
    allowedRelationTypes?: string[]
}

export interface ActionsComponentConfig extends ComponentConfig {
    /** Enables custom Action definitions attached to this entity type */
}

export interface EventsComponentConfig extends ComponentConfig {
    /** Enables lifecycle Event bindings (BeforeWrite, AfterCreate, etc.) */
}

export interface PhysicalTableComponentConfig extends ComponentConfig {
    prefix: string  // e.g. 'cat', 'doc', 'cust'
}

export interface ComponentManifest {
    // --- Data structure components ---
    dataSchema: DataSchemaComponentConfig | false
    predefinedElements: PredefinedElementsComponentConfig | false
    hubAssignment: HubAssignmentComponentConfig | false
    enumerationValues: ComponentConfig | false
    constants: ComponentConfig | false
    hierarchy: HierarchyComponentConfig | false
    nestedCollections: NestedCollectionsComponentConfig | false
    relations: RelationsComponentConfig | false
    // --- Behavior components (ECAE) ---
    actions: ActionsComponentConfig | false
    events: EventsComponentConfig | false
    scripting: ComponentConfig | false
    // --- UI/Runtime components ---
    layoutConfig: ComponentConfig | false
    runtimeBehavior: ComponentConfig | false
    physicalTable: PhysicalTableComponentConfig | false
}

export const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
    dataSchema: [],
    predefinedElements: ['dataSchema'],
    hubAssignment: [],
    enumerationValues: [],
    constants: [],
    hierarchy: ['dataSchema'],
    nestedCollections: ['dataSchema'],
    relations: ['dataSchema'],
    actions: [],
    events: ['actions'],
    scripting: [],
    layoutConfig: [],
    runtimeBehavior: ['layoutConfig']
}

export function validateComponentDependencies(manifest: ComponentManifest): string[] {
    const errors: string[] = []
    for (const [key, deps] of Object.entries(COMPONENT_DEPENDENCIES)) {
        const config = manifest[key as keyof ComponentManifest]
        if (config && typeof config === 'object' && config.enabled) {
            for (const dep of deps) {
                const depConfig = manifest[dep as keyof ComponentManifest]
                if (!depConfig || (typeof depConfig === 'object' && !depConfig.enabled)) {
                    errors.push(`Component "${key}" requires "${dep}" to be enabled`)
                }
            }
        }
    }
    return errors
}
```

- [ ] Create `entityComponents.ts` in `@universo/types`
- [ ] Export `ComponentManifest`, `COMPONENT_DEPENDENCIES`, `validateComponentDependencies()`
- [ ] Add unit tests for dependency validation

### Step 1.3: Entity Type Definition Interface

**File**: NEW `packages/universo-types/base/src/common/entityTypeDefinition.ts`

```typescript
import type { ComponentManifest } from './entityComponents'
import type { EntityKind, BuiltinEntityKind } from './metahubs'

export interface EntityTypeDefinition {
    kindKey: EntityKind
    isBuiltin: boolean
    components: ComponentManifest
    ui: EntityTypeUIConfig
}

export interface EntityTypeUIConfig {
    iconName: string            // Tabler icon name
    tabs: string[]              // dialog tab ids in order
    sidebarSection: 'objects' | 'admin'
    nameKey: string             // i18n key for display name
    descriptionKey?: string     // i18n key for description
}

export interface ResolvedEntityType extends EntityTypeDefinition {
    /** Loaded from code registry or DB */
    source: 'builtin' | 'custom'
}
```

- [ ] Create `entityTypeDefinition.ts` in `@universo/types`
- [ ] Export all interfaces
- [ ] Re-export from package index

### Step 1.3b: Shared Contract Widening

**Files**: `packages/universo-types/base/src/common/metahubs.ts`, `packages/universo-types/base/src/common/scripts.ts`, runtime/widget config types that currently narrow attachments to catalog-only contracts

The current codebase already exposes several cross-package contracts that must be widened before generic entities can flow safely through publication/runtime:

- `MetahubSnapshotFormatVersion` currently stops at `1 | 2` and must include `3`
- Script attachment consumers that still narrow to `'metahub' | 'catalog'` must be widened to support entity-based sections
- Runtime/widget config contracts that implicitly assume only catalog-backed sections must be audited and widened before Phase 3 runtime testing

- [ ] Update shared snapshot version types to include v3
- [ ] Audit and widen script attachment type consumers that still assume metahub/catalog only
- [ ] Audit widget/runtime config contracts for catalog-only assumptions
- [ ] Add focused type-level tests/build checks for the widened contracts

### Step 1.4: Built-in Type Registry (Code Registry)

**File**: NEW `packages/universo-types/base/src/common/builtinEntityTypes.ts`

```typescript
import { MetaEntityKind } from './metahubs'
import type { EntityTypeDefinition } from './entityTypeDefinition'

export const CATALOG_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.CATALOG,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: { enabled: true },
        hubAssignment: { enabled: true },
        enumerationValues: false,
        constants: false,
        hierarchy: { enabled: true, supportsFolders: true },
        nestedCollections: false,
        relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: { enabled: true },
        physicalTable: { enabled: true, prefix: 'cat' }
    },
    ui: {
        iconName: 'IconDatabase',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:catalogs.title'
    }
}

export const SET_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.SET,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: false,
        constants: { enabled: true },
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFileText',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:sets.title'
    }
}

export const ENUMERATION_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.ENUMERATION,
    isBuiltin: true,
    components: {
        dataSchema: false,
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: { enabled: true },
        constants: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: false,
        events: false,
        scripting: { enabled: true },
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFiles',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:enumerations.title'
    }
}

export const HUB_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.HUB,
    isBuiltin: true,
    components: {
        dataSchema: false,
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: false,
        constants: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: false,
        events: false,
        scripting: false,
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconHierarchy',
        tabs: ['general'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:hubs.title'
    }
}

export const DOCUMENT_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.DOCUMENT,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: { enabled: true },
        hubAssignment: { enabled: true },
        enumerationValues: false,
        constants: false,
        hierarchy: false,
        nestedCollections: { enabled: true },
        relations: { enabled: true, allowedRelationTypes: ['manyToOne', 'oneToMany'] },
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: { enabled: true },
        physicalTable: { enabled: true, prefix: 'doc' }
    },
    ui: {
        iconName: 'IconLayoutDashboard',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:documents.title'
    }
}

export const BUILTIN_ENTITY_TYPE_REGISTRY = new Map<string, EntityTypeDefinition>([
    [MetaEntityKind.CATALOG, CATALOG_TYPE],
    [MetaEntityKind.SET, SET_TYPE],
    [MetaEntityKind.ENUMERATION, ENUMERATION_TYPE],
    [MetaEntityKind.HUB, HUB_TYPE],
    [MetaEntityKind.DOCUMENT, DOCUMENT_TYPE]
])
```

- [ ] Create `builtinEntityTypes.ts` in `@universo/types`
- [ ] Export `BUILTIN_ENTITY_TYPE_REGISTRY` and all `*_TYPE` constants
- [ ] Add unit tests verifying all built-in types pass `validateComponentDependencies()`
- [ ] Re-export from package index

### Step 1.5: Component Registry (Backend)

**File**: NEW `packages/metahubs-backend/base/src/domains/shared/componentRegistry.ts`

```typescript
export interface ComponentDescriptor {
    key: string
    tables: string[]
    dependencies: string[]
    requiresPhysicalTable: boolean
    physicalTablePrefix?: string
    supportedKinds: string[] | null  // null = all kinds
}

export const COMPONENT_REGISTRY: Record<string, ComponentDescriptor> = {
    dataSchema: {
        key: 'dataSchema',
        tables: ['_mhb_attributes'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    predefinedElements: {
        key: 'predefinedElements',
        tables: ['_mhb_elements'],
        dependencies: ['dataSchema'],
        requiresPhysicalTable: false,
        supportedKinds: ['catalog', 'document']
    },
    hubAssignment: {
        key: 'hubAssignment',
        tables: [],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    enumerationValues: {
        key: 'enumerationValues',
        tables: ['_mhb_values'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: ['enumeration']
    },
    constants: {
        key: 'constants',
        tables: ['_mhb_constants'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: ['set']
    },
    hierarchy: {
        key: 'hierarchy',
        tables: [],  // Uses _mhb_objects + config.parentId / isFolder
        dependencies: ['dataSchema'],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    nestedCollections: {
        key: 'nestedCollections',
        tables: ['_mhb_attributes'],  // Reuses child-attribute/tabular-part metadata instead of inventing a new table
        dependencies: ['dataSchema'],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    relations: {
        key: 'relations',
        tables: ['_mhb_attributes'],  // Reuses target_object_id / target_object_kind reference metadata
        dependencies: ['dataSchema'],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    actions: {
        key: 'actions',
        tables: ['_mhb_actions'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    events: {
        key: 'events',
        tables: ['_mhb_event_bindings'],
        dependencies: ['actions'],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    scripting: {
        key: 'scripting',
        tables: ['_mhb_scripts'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    layoutConfig: {
        key: 'layoutConfig',
        tables: ['_mhb_layouts', '_mhb_widgets', '_mhb_catalog_widget_overrides'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    runtimeBehavior: {
        key: 'runtimeBehavior',
        tables: [],
        dependencies: ['layoutConfig'],
        requiresPhysicalTable: false,
        supportedKinds: ['catalog', 'document']
    }
}

export function getEnabledComponents(
    manifest: import('@universo/types').ComponentManifest
): string[] {
    return Object.entries(manifest)
        .filter(([, config]) => config && typeof config === 'object' && config.enabled)
        .map(([key]) => key)
}
```

- [ ] Create `componentRegistry.ts` in metahubs-backend shared domain
- [ ] Export `COMPONENT_REGISTRY`, `getEnabledComponents()`
- [ ] Add unit tests

### Step 1.6: Entity Type Resolver (Backend Service)

**File**: NEW `packages/metahubs-backend/base/src/domains/shared/entityTypeResolver.ts`

```typescript
import { BUILTIN_ENTITY_TYPE_REGISTRY, isBuiltinKind } from '@universo/types'
import type { ResolvedEntityType, EntityKind } from '@universo/types'

export class EntityTypeResolver {
    /**
     * Phase 1: resolve from code registry only.
     * Phase 2: will add DB-backed custom type resolution.
     */
    resolve(kind: EntityKind): ResolvedEntityType | null {
        const builtin = BUILTIN_ENTITY_TYPE_REGISTRY.get(kind)
        if (builtin) {
            return { ...builtin, source: 'builtin' }
        }
        return null  // Phase 2: query _mhb_entity_type_definitions
    }

    resolveOrThrow(kind: EntityKind): ResolvedEntityType {
        const resolved = this.resolve(kind)
        if (!resolved) {
            throw new Error(`Unknown entity kind: ${kind}`)
        }
        return resolved
    }

    isComponentEnabled(kind: EntityKind, componentKey: string): boolean {
        const typeDef = this.resolve(kind)
        if (!typeDef) return false
        const config = typeDef.components[componentKey as keyof typeof typeDef.components]
        return !!config && typeof config === 'object' && config.enabled
    }
}
```

- [ ] Create `entityTypeResolver.ts` in metahubs-backend shared domain
- [ ] Add unit tests (resolve built-in, resolve unknown → null)

### Step 1.7: Validate Phase 1

- [ ] `pnpm --filter @universo/types build` — passes
- [ ] `pnpm --filter @universo/metahubs-backend build` — passes
- [ ] `pnpm build` — full workspace build passes (30 packages)
- [ ] All existing focused tests remain green
- [ ] No user-visible changes — pure refactor confirmed

---

## Phase 2: ECAE System + Coexistence Foundation

**Goal**: Add the data-driven custom type layer, coexistence-safe generic entity services/routes, ECAE system tables, the `Entities` builder surface, and component-driven snapshot serialization without breaking the legacy user path.

### Step 2.0: Extract Shared GeneralTabFields (Quick Win)

Before the main refactor, extract the duplicated `GeneralTabFields` component (~40 lines, 100% identical across CatalogList, SetList, EnumerationList) into a shared location.

**File**: NEW `packages/metahubs-frontend/base/src/domains/shared/ui/GeneralTabFields.tsx`

This eliminates ~120 lines of pure duplication and creates the shared foundation for the generic entity form.

- [ ] Extract `GeneralTabFields` to shared domain
- [ ] Update CatalogList, SetList, EnumerationList to import from shared
- [ ] Verify all three list pages render identically (screenshot baseline)

### Step 2.1: Add ECAE System Tables

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`

Add three new table definitions to the system table registry:

**2.1a: `_mhb_entity_type_definitions`** — stores custom entity type blueprints:

```typescript
{
    tableName: '_mhb_entity_type_definitions',
    columns: [
        { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        { name: 'kind_key', type: 'varchar(64)', notNull: true },
        { name: 'codename', type: 'jsonb', notNull: true },
        { name: 'presentation', type: 'jsonb', default: "'{}'" },
        { name: 'components', type: 'jsonb', notNull: true },
        { name: 'ui_config', type: 'jsonb', default: "'{}'" },
        { name: 'config', type: 'jsonb', default: "'{}'" },
        { name: 'is_builtin', type: 'boolean', default: 'false' },
        // Include standard _upl_* and _mhb_* system columns
    ],
    indexes: [
        { columns: ['kind_key'], unique: true, where: '_mhb_deleted = false' }
    ]
}
```

**2.1b: `_mhb_actions`** — stores Action definitions attached to design-time metadata objects (`_mhb_objects.id`) whose resolved type enables the `actions` component:

```typescript
{
    tableName: '_mhb_actions',
    columns: [
        { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        { name: 'object_id', type: 'uuid', notNull: true, references: '_mhb_objects.id' },
        { name: 'codename', type: 'jsonb', notNull: true },
        { name: 'presentation', type: 'jsonb', default: "'{}'" },
        { name: 'action_type', type: 'varchar(32)', notNull: true },
            // 'script' — bound to a _mhb_scripts entry
            // 'builtin' — platform action (validate, calculate, etc.)
        { name: 'script_id', type: 'uuid', references: '_mhb_scripts.id' },
        { name: 'config', type: 'jsonb', default: "'{}'" },
        { name: 'sort_order', type: 'integer', default: '0' },
        // standard system columns
    ],
    indexes: [
        { columns: ['object_id'] }
    ]
}
```

**2.1c: `_mhb_event_bindings`** — binds lifecycle Events to object-owned Actions for a design-time metadata object:

```typescript
{
    tableName: '_mhb_event_bindings',
    columns: [
        { name: 'id', type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        { name: 'object_id', type: 'uuid', notNull: true, references: '_mhb_objects.id' },
        { name: 'event_name', type: 'varchar(64)', notNull: true },
            // Lifecycle events: 'beforeCreate', 'afterCreate', 'beforeUpdate',
            // 'afterUpdate', 'beforeDelete', 'afterDelete',
            // 'onValidate', 'beforeWrite', 'afterWrite'
            // (inspired by Strapi lifecycle hooks)
        { name: 'action_id', type: 'uuid', notNull: true, references: '_mhb_actions.id' },
        { name: 'priority', type: 'integer', default: '0' },
        { name: 'is_active', type: 'boolean', default: 'true' },
        { name: 'config', type: 'jsonb', default: "'{}'" },
        // standard system columns
    ],
    indexes: [
        { columns: ['object_id', 'event_name'] }
    ]
}
```

**Current-wave ownership rule**:

- entity type definitions enable `actions` / `events` capability but do not own executable graphs
- `_mhb_actions` and `_mhb_event_bindings` stay object-scoped, matching existing object-scoped metadata routes and services
- per-type defaults and per-runtime-record overrides are explicitly out of current scope

**Migration**: Add a structure version increment so existing metahub branches auto-migrate.

- [ ] Add `_mhb_entity_type_definitions` table definition to `systemTableDefinitions.ts`
- [ ] Add `_mhb_actions` table definition
- [ ] Add `_mhb_event_bindings` table definition
- [ ] Increment structure version
- [ ] Add migration handler in `MetahubSchemaService.upgradeSchema()`
- [ ] Test: new branch creation includes all three tables
- [ ] Test: existing branch upgrade creates the tables

### Step 2.2: Entity Type CRUD Service + ECAE Services

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/services/EntityTypeService.ts`

```typescript
export class EntityTypeService {
    constructor(private readonly exec: DbExecutor) {}

    async list(metahubId: string): Promise<EntityTypeDefinitionRow[]> {
        // Returns custom types from _mhb_entity_type_definitions
    }

    async findById(metahubId: string, id: string): Promise<EntityTypeDefinitionRow | null> { ... }

    async create(metahubId: string, input: CreateEntityTypeInput): Promise<EntityTypeDefinitionRow> {
        // 1. Validate kind_key uniqueness (not conflicting with built-in kinds)
        // 2. Validate component manifest dependencies
        // 3. Validate codename VLC format
        // 4. Insert into _mhb_entity_type_definitions
    }

    async update(metahubId: string, id: string, input: UpdateEntityTypeInput): Promise<EntityTypeDefinitionRow> {
        // 1. Verify not is_builtin
        // 2. Validate component dependencies
        // 3. Check for existing instances if disabling a component
        // 4. Update row
    }

    async delete(metahubId: string, id: string): Promise<void> {
        // 1. Verify not is_builtin
        // 2. Check for existing entity instances with this kind_key
        // 3. Soft delete
    }
}
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/services/ActionService.ts`

```typescript
export class ActionService {
    constructor(private readonly exec: DbExecutor) {}

    async listForEntity(metahubId: string, objectId: string): Promise<ActionRow[]> { ... }
    async create(metahubId: string, objectId: string, input: CreateActionInput): Promise<ActionRow> { ... }
    async update(metahubId: string, actionId: string, input: UpdateActionInput): Promise<ActionRow> { ... }
    async delete(metahubId: string, actionId: string): Promise<void> { ... }
}
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/services/EventBindingService.ts`

```typescript
export class EventBindingService {
    constructor(private readonly exec: DbExecutor) {}

    async listForEntity(metahubId: string, objectId: string): Promise<EventBindingRow[]> { ... }
    async bind(metahubId: string, objectId: string, input: CreateEventBindingInput): Promise<EventBindingRow> { ... }
    async unbind(metahubId: string, bindingId: string): Promise<void> { ... }
    async toggleActive(metahubId: string, bindingId: string, isActive: boolean): Promise<void> { ... }
}
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/services/EntityEventRouter.ts`

```typescript
/**
 * Central event dispatcher for ECAE lifecycle.
 * Resolves event bindings → action definitions → script execution.
 * Inspired by Strapi lifecycle hooks pattern.
 */
export class EntityEventRouter {
    constructor(
        private readonly eventBindingService: EventBindingService,
        private readonly actionService: ActionService,
        private readonly scriptRunner: ScriptRunner
    ) {}

    /**
     * Dispatch a lifecycle event for an entity instance.
     * Called from generic entity CRUD routes (beforeCreate, afterCreate, etc.).
     */
    async dispatch(
        metahubId: string,
        objectId: string,
        eventName: LifecycleEvent,
        context: EventContext
    ): Promise<EventResult> {
        const bindings = await this.eventBindingService.listByEvent(metahubId, objectId, eventName)
        const sortedBindings = bindings
            .filter(b => b.is_active)
            .sort((a, b) => a.priority - b.priority)

        for (const binding of sortedBindings) {
            const action = await this.actionService.findById(metahubId, binding.action_id)
            if (!action) continue

            if (action.action_type === 'script' && action.script_id) {
                const result = await this.scriptRunner.execute(action.script_id, context)
                if (result.error) return { success: false, error: result.error }
            }
        }
        return { success: true }
    }
}

export type LifecycleEvent =
    | 'beforeCreate' | 'afterCreate'
    | 'beforeUpdate' | 'afterUpdate'
    | 'beforeDelete' | 'afterDelete'
    | 'onValidate' | 'beforeWrite' | 'afterWrite'
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/services/EntityMutationService.ts`

```typescript
/**
 * Transaction-aware mutation boundary for interactive entity writes.
 * Routes, copy flows, and future UI actions delegate here instead of dispatching lifecycle hooks directly.
 */
export class EntityMutationService {
    async createInteractive(...) { /* beforeCreate -> create -> afterCreate */ }
    async updateInteractive(...) { /* beforeUpdate -> update -> afterUpdate */ }
    async deleteInteractive(...) { /* beforeDelete -> delete -> afterDelete */ }
    async copyInteractive(...) { /* beforeCopy -> copy -> afterCopy */ }
    async restoreSilent(...) { /* no user automation replay by default */ }
}
```

- [ ] Create `EntityTypeService.ts`
- [ ] Create `ActionService.ts`
- [ ] Create `EventBindingService.ts`
- [ ] Create `EntityEventRouter.ts`
- [ ] Create `EntityMutationService.ts` as the single interactive mutation boundary
- [ ] Add Zod schemas for create/update inputs (entity types, actions, event bindings)
- [ ] Add focused service tests (create, update, delete, validation)
- [ ] Add event router dispatch tests (single binding, multi-binding priority, inactive skip)
- [ ] Add mutation-mode tests (`interactive`, `copy`, `restore`) to ensure imports/restores do not replay user automation accidentally

### Step 2.3: Entity Type CRUD Routes + ECAE Routes

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/routes/entityTypeRoutes.ts`

```
GET    /metahub/:metahubId/entity-types              — list all (custom + built-in info)
POST   /metahub/:metahubId/entity-types              — create custom type
GET    /metahub/:metahubId/entity-type/:typeId        — get type definition
PATCH  /metahub/:metahubId/entity-type/:typeId        — update custom type
DELETE /metahub/:metahubId/entity-type/:typeId        — delete custom type
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/routes/actionsRoutes.ts`

```
GET    /metahub/:metahubId/entity/:entityId/actions        — list actions for entity
POST   /metahub/:metahubId/entity/:entityId/actions        — create action
PATCH  /metahub/:metahubId/entity/:entityId/action/:id     — update action
DELETE /metahub/:metahubId/entity/:entityId/action/:id     — delete action
```

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/routes/eventBindingsRoutes.ts`

```
GET    /metahub/:metahubId/entity/:entityId/events          — list event bindings
POST   /metahub/:metahubId/entity/:entityId/events          — bind event → action
PATCH  /metahub/:metahubId/entity/:entityId/event/:id       — update binding (toggle, priority)
DELETE /metahub/:metahubId/entity/:entityId/event/:id        — unbind
```

- [ ] Create `entityTypeRoutes.ts`
- [ ] Create `actionsRoutes.ts`
- [ ] Create `eventBindingsRoutes.ts`
- [ ] Create `entityTypeController.ts`
- [ ] Create `actionsController.ts`
- [ ] Create `eventBindingsController.ts`
- [ ] Register routes in `router.ts`
- [ ] Add focused route tests (CRUD + validation + built-in protection)
- [ ] Add action/event binding route tests

### Step 2.4: Extend Entity Type Resolver for DB Types

**File**: `packages/metahubs-backend/base/src/domains/shared/entityTypeResolver.ts`

```typescript
export class EntityTypeResolver {
    async resolve(kind: EntityKind, metahubId?: string): Promise<ResolvedEntityType | null> {
        // 1. Check code registry first
        const builtin = BUILTIN_ENTITY_TYPE_REGISTRY.get(kind)
        if (builtin) return { ...builtin, source: 'builtin' }
        
        // 2. Check DB for custom type (requires metahubId)
        if (metahubId) {
            const custom = await this.entityTypeService.findByKindKey(metahubId, kind)
            if (custom) return this.mapToResolvedType(custom)
        }
        
        return null
    }
}
```

- [ ] Extend `EntityTypeResolver` with DB lookup
- [ ] Add per-request caching (avoid repeated DB queries within one request)
- [ ] Update unit tests

### Step 2.5: Generic Entity Instance CRUD Routes

**File**: NEW `packages/metahubs-backend/base/src/domains/entities/routes/entityRoutes.ts`

```
GET    /metahub/:metahubId/entities?kind=<kind>                — list entities by kind
POST   /metahub/:metahubId/entities                            — create entity instance
GET    /metahub/:metahubId/entity/:entityId                    — get entity by id
PATCH  /metahub/:metahubId/entity/:entityId                    — update entity
DELETE /metahub/:metahubId/entity/:entityId                    — soft delete entity
POST   /metahub/:metahubId/entity/:entityId/copy               — copy entity
POST   /metahub/:metahubId/entity/:entityId/reorder            — reorder entity

GET    /metahub/:metahubId/entity/:entityId/attributes         — if dataSchema enabled
POST   /metahub/:metahubId/entity/:entityId/attributes         — if dataSchema enabled
PATCH  /metahub/:metahubId/entity/:entityId/attribute/:attrId  — if dataSchema enabled
DELETE /metahub/:metahubId/entity/:entityId/attribute/:attrId  — if dataSchema enabled

GET    /metahub/:metahubId/entity/:entityId/elements           — if predefinedElements enabled
POST   /metahub/:metahubId/entity/:entityId/elements           — if predefinedElements enabled
...
```

**Pattern**: Each component-scoped sub-route checks `resolver.isComponentEnabled(kind, componentKey)` before delegating to an existing domain service or an explicit entity-aware compatibility adapter (for example around `MetahubAttributesService` / `MetahubLayoutsService`). HTTP routes do not own lifecycle orchestration; they delegate to `EntityMutationService`.

- [ ] Create `entityRoutes.ts` with core CRUD
- [ ] Create `entityController.ts` with component-aware delegation
- [ ] **Integrate ECAE** through `EntityMutationService`, not ad-hoc in controllers
    - `POST /entities` → `mutationService.createInteractive()`
    - `PATCH /entity/:id` → `mutationService.updateInteractive()`
    - `DELETE /entity/:id` → `mutationService.deleteInteractive()`
    - `POST /entity/:id/copy` → `mutationService.copyInteractive()`
- [ ] Add component sub-routes (attributes, elements, values, constants)
- [ ] Add action/event sub-routes (if actions/events components enabled)
- [ ] Register in `router.ts`
- [ ] Add focused route tests

### Step 2.5b: Coexistence-First Compatibility Layer

**Phase rationale**: The codebase analysis confirms 70–80% structural duplication between `domains/catalogs/`, `domains/sets/`, `domains/enumerations/` and 85–90% duplication in frontend list/actions. However, the current rollout must preserve old and new user-facing flows simultaneously. Therefore, the current wave introduces a shared entity foundation **without removing the legacy path yet**.

**Backend compatibility approach**:

1. Introduce shared entity services/factories under `domains/entities/`
2. Keep legacy `catalogsRoutes.ts`, `setsRoutes.ts`, `enumerationsRoutes.ts` reachable during rollout
3. Optionally convert legacy controllers/routes into thin wrappers over the shared services only after regression coverage is in place
4. Preserve the same database tables and object IDs so legacy and new views stay mutually visible

**Frontend compatibility approach**:

1. Add the new `Entities` workspace without removing legacy menu items
2. Keep legacy `CatalogList`, `SetList`, `EnumerationList` available for parity comparison
3. Introduce generic/shared builders behind the new flow first
4. Use `Catalogs v2` as the first real dogfooded entity-based section before collapsing legacy pages later

**Acceptance rule**: legacy UI/routes can only be removed in a later cleanup wave after EN/RU pixel-perfect and functional parity are proven.

- [ ] Create shared entity service/controller factories under `domains/entities/`
- [ ] Keep legacy routes/pages reachable during the current rollout
- [ ] Introduce thin-wrapper refactors only where they reduce duplication without removing the legacy acceptance path
- [ ] Add compatibility tests proving legacy and new paths see the same records
- [ ] Defer physical removal of legacy pages/routes to a post-acceptance cleanup wave

### Step 2.5c: Design-Time Service Genericization + Policy Reuse Gate

The current codebase still contains catalog-specific seams in `MetahubObjectsService`, `MetahubAttributesService`, `MetahubLayoutsService`, and related policy helpers. The plan must genericize or explicitly gate those seams before arbitrary custom types can expose the corresponding components.

Required rules for the current wave:

1. Shared object lookup/kind resolution must move behind an entity-aware service seam, not repeated `kind = 'catalog'` branches.
2. `dataSchema`, `predefinedElements`, and related attribute/value flows may reuse existing services only through entity-aware adapters that keep routed-object ownership and component enablement checks.
3. `Catalogs v2` system-attribute behavior must reuse `platformSystemAttributesPolicy.ts` and existing seed/update helpers; do not create a second `_upl_*` policy interpretation for entity presets.
4. `layoutConfig` / `runtimeBehavior` remain available only for presets whose layout services are proven generic or explicitly catalog-compatible during this wave.
5. The builder UI must hide or lock unsupported component combinations until the backing design-time and publication/runtime seams are green.

- [ ] Audit `MetahubObjectsService`, `MetahubAttributesService`, `MetahubLayoutsService`, and related route helpers for catalog-only assumptions
- [ ] Introduce shared adapters/factories where a service cannot be made fully generic in one pass
- [ ] Reuse existing platform system-attribute policy/seed helpers for Catalogs v2 parity
- [ ] Gate unsupported components in the builder until design-time + publication/runtime seams are proven
- [ ] Add focused tests for object loading, attribute/system-attribute flows, and layout behavior through the new entity path

### Step 2.6: Entity Types Frontend — API Layer

**File**: NEW `packages/metahubs-frontend/base/src/domains/entities/api/entityTypes.ts`

```typescript
export const listEntityTypes = (metahubId: string) => 
    apiClient.get(`/metahub/${metahubId}/entity-types`)

export const createEntityType = (metahubId: string, data: CreateEntityTypePayload) =>
    apiClient.post(`/metahub/${metahubId}/entity-types`, data)

// ... update, delete
```

- [ ] Create API layer for entity types
- [ ] Create API layer for generic entity instances
- [ ] Add TanStack Query hooks (list, detail, create, update, delete)
- [ ] Add optimistic mutation hooks following existing patterns

### Step 2.7: `Entities` Workspace — Builder Page

**File**: NEW `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ ViewHeader: "Entities" / "Сущности"            [Create] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌── Built-in Types (collapsible) ──────────────────┐  │
│  │ 🗄  Catalog    │ DataSchema, Elements, Hubs, ... │  │
│  │ 📄 Set         │ DataSchema, Constants, ...       │  │
│  │ 📁 Enumeration │ EnumValues, ...                  │  │
│  │ 🔗 Hub         │ (read-only info cards)           │  │
│  │ 📋 Document    │ DataSchema, Elements, Hubs, ... │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌── Custom Types / Published Sections ─────────────┐  │
│  │ (FlowListTable with DnD ordering)                │  │
│  │ 🏷  My Registry │ DataSchema, Elements │ Publish  │  │
│  │ 🗄  Catalogs v2 │ Catalog preset       │ Publish  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**File**: NEW `packages/metahubs-frontend/base/src/domains/entities/ui/EntityTypeFormDialog.tsx`

Tabs:
1. **General** — CodenameField, name/description VLC, icon picker, table prefix
2. **Components** — Toggle switches for each component with dependency validation
3. **Publish** — menu publication settings for dynamic entity-based sections (e.g. `Catalogs v2`)

- [ ] Create `EntitiesWorkspace.tsx` with ViewHeader + built-in info + custom FlowListTable
- [ ] Create `EntityTypeFormDialog.tsx` with 3 tabs (`General`, `Components`, `Publish`)
- [ ] Create component picker UI with toggle switches and dependency warnings
- [ ] Reuse the existing template/preset selection seam when exposing reusable entity presets across metahubs instead of inventing a second global preset picker
- [ ] Add i18n keys for EN + RU
- [ ] Add fixed sidebar menu item `Entities` directly below `Common`
- [ ] Keep legacy menu items intact while the `Entities` workspace is introduced
- [ ] Register frontend routes

### Step 2.8: i18n Keys

**Files**: `packages/universo-i18n/` — add new translation keys

```json
// EN
{
    "metahubs": {
                "entities": {
                    "sidebar": { "title": "Entities" }
                },
                "entityTypes": {
            "sidebar": { "title": "Entity Types" },
            "list": {
                "title": "Entity Types",
                "create": "Create Entity Type",
                "empty": "No custom entity types defined",
                "builtinSection": "Built-in Types",
                "customSection": "Custom Types"
            },
            "dialog": {
                "create": { "title": "Create Entity Type" },
                "edit": { "title": "Edit Entity Type" },
                "tabs": {
                    "general": "General",
                    "components": "Components"
                }
            },
            "components": {
                "dataSchema": { "name": "Data Schema", "description": "Attribute definitions for data structure" },
                "predefinedElements": { "name": "Predefined Elements", "description": "Preset data rows" },
                "hubAssignment": { "name": "Hub Assignment", "description": "Organize entities into hierarchical groups" },
                "enumerationValues": { "name": "Enumeration Values", "description": "Ordered value list" },
                "constants": { "name": "Constants", "description": "Named constant values" },
                "hierarchy": { "name": "Hierarchy", "description": "Tree structure with parent-child relationships" },
                "nestedCollections": { "name": "Nested Collections", "description": "Child collection types (tabular parts)" },
                "relations": { "name": "Relations", "description": "References to other entity types" },
                "actions": { "name": "Actions", "description": "Custom business logic operations" },
                "events": { "name": "Events", "description": "Lifecycle event bindings (before/after create, update, delete)" },
                "scripting": { "name": "Scripting", "description": "Server and client scripts" },
                "layoutConfig": { "name": "Layout", "description": "Dashboard layout and widgets" },
                "runtimeBehavior": { "name": "Runtime Behavior", "description": "Create, edit, copy behavior configuration" },
                "physicalTable": { "name": "Physical Table", "description": "Generate a runtime data table" }
            },
            "validation": {
                "kindKeyConflict": "This kind key conflicts with a built-in type",
                "dependencyMissing": "Component \"{component}\" requires \"{dependency}\" to be enabled",
                "hasInstances": "Cannot delete: {count} entity instances exist"
            }
        }
    }
}
```

```json
// RU
{
    "metahubs": {
                "entities": {
                    "sidebar": { "title": "Сущности" }
                },
                "entityTypes": {
            "sidebar": { "title": "Типы объектов" },
            "list": {
                "title": "Типы объектов",
                "create": "Создать тип объекта",
                "empty": "Пользовательские типы объектов не определены",
                "builtinSection": "Встроенные типы",
                "customSection": "Пользовательские типы"
            },
            "dialog": {
                "create": { "title": "Создать тип объекта" },
                "edit": { "title": "Редактировать тип объекта" },
                "tabs": {
                    "general": "Основное",
                    "components": "Компоненты"
                }
            },
            "components": {
                "dataSchema": { "name": "Схема данных", "description": "Определения атрибутов для структуры данных" },
                "predefinedElements": { "name": "Предопределённые элементы", "description": "Предустановленные строки данных" },
                "hubAssignment": { "name": "Хабы", "description": "Организация объектов в иерархические группы" },
                "enumerationValues": { "name": "Значения перечисления", "description": "Упорядоченный список значений" },
                "constants": { "name": "Константы", "description": "Именованные константные значения" },
                "hierarchy": { "name": "Иерархия", "description": "Древовидная структура с родительско-дочерними связями" },
                "nestedCollections": { "name": "Вложенные коллекции", "description": "Дочерние типы коллекций (табличные части)" },
                "relations": { "name": "Связи", "description": "Ссылки на другие типы объектов" },
                "actions": { "name": "Действия", "description": "Пользовательские операции бизнес-логики" },
                "events": { "name": "События", "description": "Привязки к событиям жизненного цикла (до/после создания, обновления, удаления)" },
                "scripting": { "name": "Скрипты", "description": "Серверные и клиентские скрипты" },
                "layoutConfig": { "name": "Макет", "description": "Макет дашборда и виджеты" },
                "runtimeBehavior": { "name": "Поведение в рантайме", "description": "Настройка создания, редактирования, копирования" },
                "physicalTable": { "name": "Физическая таблица", "description": "Генерация таблицы данных в рантайме" }
            },
            "validation": {
                "kindKeyConflict": "Этот ключ типа конфликтует со встроенным типом",
                "dependencyMissing": "Компонент \"{component}\" требует включения \"{dependency}\"",
                "hasInstances": "Невозможно удалить: существует {count} экземпляров"
            }
        }
    }
}
```

- [ ] Add EN translation keys to `universo-i18n`
- [ ] Add RU translation keys with exact parity
- [ ] Add EN/RU keys for the fixed `Entities` workspace item and dynamic published-section UI
- [ ] Verify `pnpm docs:i18n:check` passes

### Step 2.9: Validate Phase 2

- [ ] `pnpm --filter @universo/types build` — passes
- [ ] `pnpm --filter @universo/metahubs-backend build` — passes
- [ ] `pnpm --filter @universo/metahubs-frontend build` — passes
- [ ] `pnpm build` — full workspace passes
- [ ] Focused backend route tests — all green (entity types, actions, event bindings, generic CRUD)
- [ ] Focused frontend component tests — all green
- [ ] Existing Catalog/Set/Enumeration functionality — verified via generic entity domain (no regressions)
- [ ] Pixel-perfect screenshots: generic EntityInstanceList for catalogs matches legacy CatalogList baseline

---

## Phase 3: Entity Builder + Published Sections + Runtime Genericization

**Goal**: Enable end-to-end custom entity type creation: define type → create instances → publish → runtime.

### Step 3.1: Generic Entity Instance List Page

**File**: NEW `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx`

Generic list page that renders differently based on the resolved entity type's component manifest:
- ViewHeader with search and Create button
- FlowListTable with DnD ordering
- EntityFormDialog with tabs composed from enabled components:
  - `dataSchema` enabled → show General tab with codename/name/description + Attributes sub-tab
  - `hubAssignment` enabled → show Hubs tab
  - `layoutConfig` enabled → show Layout tab
  - `scripting` enabled → show Scripts tab

**For "Каталоги v2"**: with `CATALOG_TYPE` component manifest, the dialog renders exactly the same 4 tabs (General, Hubs, Layout, Scripts) as the existing CatalogList — pixel-perfect match.

Catalogs v2 must also reuse the existing Attributes / System Attributes / Predefined Elements builders and backend policy helpers so parity is achieved by composition, not by a forked catalog implementation.

**Reuse rules for current scope**:

- Reuse `EntityFormDialog` for metadata-object authoring shells and mixed tab composition
- Reuse `DynamicEntityFormDialog` for attribute-driven value/data editors (predefined elements, dynamic field/value forms, future runtime-backed record forms)
- Reuse `createEntityActions()` / `BaseEntityMenu` patterns instead of inventing a new action system
- Reuse `useListDialogs()` for modal state
- Reuse `EntityScriptsTab`, `HubSelectionPanel`, `LayoutList`, localized input helpers, and existing codename helpers
- Do not introduce a third dialog shell in the current wave
- Extract only the minimum generic helper layer needed for parity (`buildEntityFormTabs()`, shared `GeneralTabFields`, shared initial-value builders)

- [ ] Create `EntityInstanceList.tsx` with component-driven tab composition
- [ ] Create generic API hooks for entity instances
- [ ] Add shared `buildEntityFormTabs()` helper
- [ ] Rebuild Catalog/Set/Enumeration action wiring on top of shared `createEntityActions()` / dialog primitives where it reduces duplication safely
- [ ] Pixel-perfect verification: "Каталоги v2" dialog matches existing Catalog dialog

### Step 3.2: Dynamic Sidebar Sections + Published Menu Zone

**File**: `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`

Extend the dashboard menu builder to accept custom entity types:

```typescript
function buildDynamicMenuItems(customTypes: EntityTypeDefinitionRow[]): MenuItem[] {
    return customTypes.map(typeDef => ({
        id: `entity-type-${typeDef.kind_key}`,
        title: typeDef.presentation.name || typeDef.kind_key,
        type: 'item' as const,
        url: `/entities/${typeDef.kind_key}`,
        icon: resolveIcon(typeDef.ui_config?.iconName),
        breadcrumbs: false
    }))
}
```

Menu structure becomes:
```
Metahub
├── Dashboard
├── Branches
├── ─────────
├── Common
├── Entities           ← new fixed builder item below Common
├── Hubs
├── Catalogs           ← existing built-in
├── Sets               ← existing built-in
├── Enumerations       ← existing built-in
├── ─────────
├── Catalogs v2        ← dynamic published entity-based section
├── My Registry        ← dynamic from published entity type
├── Classifiers        ← dynamic from published entity type
├── ─────────
├── Publications
├── Migrations
├── Access
├── ─────────
├── Settings
```

- [ ] Extend `metahubDashboard.ts` with a fixed `Entities` item below `Common`
- [ ] Add a separate dynamic published-section zone below legacy hardcoded object items
- [ ] Add query hook for custom entity types list (used by sidebar)
- [ ] Add menu publication config so `Catalogs v2` is generated from entity metadata, not hardcoded
- [ ] Register dynamic frontend routes for custom entity instance pages

### Step 3.3: Component-Driven Snapshot Serialization + Format v3

**File**: `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`

**Current problem**: SnapshotSerializer has explicit per-kind branching — `findAllByKind('catalog')`, `findAllByKind('set')`, `findAllByKind('enumeration')` with separate processing loops. Adding a new kind requires changes in 3+ places.

Refactor the serializer to iterate using the entity type resolver:

```typescript
private async serializeEntity(
    obj: MetahubObjectRow, 
    typeDef: ResolvedEntityType
): Promise<MetaEntitySnapshot> {
    const snapshot: MetaEntitySnapshot = {
        id: obj.id,
        kind: obj.kind,
        codename: obj.codename,
        presentation: obj.presentation,
        config: obj.config,
        tableName: obj.table_name,
        fields: [],
        hubs: [],
        actions: [],
        eventBindings: []
    }
    
    if (typeDef.components.dataSchema && typeDef.components.dataSchema.enabled) {
        snapshot.fields = await this.attributesService.serializeForEntity(
            this.metahubId, obj.id
        )
    }
    
    if (typeDef.components.actions && typeDef.components.actions.enabled) {
        snapshot.actions = await this.actionService.listForEntity(
            this.metahubId, obj.id
        )
    }
    
    if (typeDef.components.events && typeDef.components.events.enabled) {
        snapshot.eventBindings = await this.eventBindingService.listForEntity(
            this.metahubId, obj.id
        )
    }
    // ... other components
    
    return snapshot
}
```

**Snapshot format version bump**: `snapshotFormatVersion` 2 → 3

New top-level sections in `MetahubSnapshot`:
```typescript
interface MetahubSnapshot {
    // ... existing sections ...
    entityTypeDefinitions?: Record<string, EntityTypeDefinitionRow>  // custom types (optional for v2 compat)
    // Actions and EventBindings are nested inside MetaEntitySnapshot (above)
}
```

**Backward compatibility**: Old v2 snapshots import fine — `entityTypeDefinitions` is optional, missing Actions/Events sections default to empty arrays. The entity type resolver falls back to the code registry for built-in kinds.

- [ ] Refactor `SnapshotSerializer.serialize()` to iterate by resolver instead of per-kind branching
- [ ] Add `actions` and `eventBindings` to `MetaEntitySnapshot` type
- [ ] Add `entityTypeDefinitions` section to `MetahubSnapshot` type (optional)
- [ ] Bump `snapshotFormatVersion` from 2 to 3 and widen shared `MetahubSnapshotFormatVersion` types
- [ ] Update transport envelope validators/types for snapshot v3 compatibility
- [ ] Update `SnapshotRestoreService` to restore custom type definitions, actions, event bindings
- [ ] Add explicit restore mode so snapshot import does not replay interactive lifecycle automation by default
- [ ] Ensure backward compat: old v2 snapshots import fine (missing sections default to empty)
- [ ] Add snapshot round-trip tests for custom entity types with ECAE data

### Step 3.4: DDL Pipeline for Custom Types

**File**: `packages/schema-ddl/base/src/`

Extend `generateTableName()` to accept custom prefixes:

```typescript
export function generateTableName(entityId: string, kind: string, prefix?: string): string {
    const effectivePrefix = prefix || DEFAULT_PREFIXES[kind] || 'ent'
    return `${effectivePrefix}_${entityId.replace(/-/g, '')}`
}
```

**File**: `packages/applications-backend/base/src/services/`

Extend sync context to resolve custom entity types and generate correct DDL:

- [ ] Update `generateTableName()` in schema-ddl
- [ ] Update application sync context to load entity type definitions from snapshot
- [ ] Update DDL generator to handle custom kind physical tables
- [ ] Add runtime `_app_objects` seeding for custom kinds
- [ ] Add focused tests

### Step 3.5: Runtime, Script Attachment, and Shared Contract Genericization

**Current reality**: runtime/publication/widgets are still partially catalog-centric. The plan must explicitly remove these assumptions instead of assuming custom kinds work automatically.

Required audit targets:

- `applications-backend/runtimeRowsController.ts` and related helpers that still filter by `kind = 'catalog'`
- `applications-frontend/runtimeAdapter.ts` and `ApplicationRuntime.tsx`, which still model the active published section via catalog-only state (`catalogId`, `selectedCatalogId`, `activeCatalogRuntimeConfig`)
- runtime script attachment flows and widget configs that still narrow to metahub/catalog-only assumptions
- `apps-template-mui` API contracts/adapters (`CrudDataAdapter`, runtime API helpers, tabular adapters, dialog props) that still encode `catalogId` as the universal section key
- `apps-template-mui` runtime UI surfaces that assume catalog-backed records only
- publication/runtime source loaders and shared snapshot types that still assume built-in kinds only

- [ ] Replace catalog-only runtime selectors with entity-definition-aware resolution where the section is published from an entity type
- [ ] Refactor `applications-frontend` runtime adapter and page state so published entity sections are not modeled as catalog-only routes/state
- [ ] Preserve the existing single-consumption page-surface URL contract while genericizing create/edit/copy runtime flows for entity-based sections
- [ ] Genericize `apps-template-mui` runtime API/adapters away from `catalogId`-specific contracts toward a published-section/entity-context contract
- [ ] Update `apps-template-mui` list/page-surface/data-entry components to resolve forms and tables from published entity metadata instead of catalog-only assumptions
- [ ] Widen runtime/widget config types that still narrow script attachments to catalog-only contracts
- [ ] Update runtime script loading/execution seams for entity-based sections
- [ ] Keep startup-menu global-only contract intact while genericizing entity-based section lookup
- [ ] Add focused tests: custom kind publication, Catalogs v2 publication, applications-frontend page-surface create/edit/copy flows, runtime scripting on entity-based section, dynamic menu routing

### Step 3.6: Zerocode MVP Builder for Current Scope

The current scope must include a **usable Zerocode editor for Entities**, but it does not need a greenfield visual canvas if parity can be reached faster and more safely through structured forms built from existing shared components.

**MVP definition for this wave**:

- Form-driven entity builder inside the `Entities` workspace
- Component toggles and validation
- Menu publication settings for dynamic sections
- Structured tab/layout configuration for parity with Catalog dialogs
- Script attachment using the existing `EntityScriptsTab`
- Metadata-object authoring on `EntityFormDialog`; schema-driven generated editors on `DynamicEntityFormDialog`
- `Catalogs v2` preset/template that assembles the exact built-in Catalog behavior on top of the same tables

**Deferred to advanced future wave**:

- fully visual node-based action editor
- drag-and-drop freeform canvas for arbitrary form layout composition

- [ ] Build the form-driven Zerocode MVP on top of existing shared UI primitives
- [ ] Reuse existing attribute/system-attribute/predefined-element flows for Catalogs v2 instead of cloning them
- [ ] Use `EntityFormDialog` for metadata shells and `DynamicEntityFormDialog` for generated field/value editors
- [ ] Add `Catalogs v2` preset/template that maps to the same catalog tables and capabilities
- [ ] Allow the builder to publish `Catalogs v2` into the dynamic menu zone
- [ ] Verify records created through legacy Catalogs are visible in Catalogs v2 and vice versa

### Step 3.7: E2E Tests with Pixel-Perfect Screenshot Comparison + Product Dogfooding

**Files**:

- NEW `tools/testing/e2e/specs/flows/entity-component-builder.spec.ts`
- NEW `tools/testing/e2e/specs/flows/entity-pixel-perfect.spec.ts`
- NEW `tools/testing/e2e/specs/flows/catalogs-v2-dogfood.spec.ts`

```typescript
test.describe('Entity Component Builder', () => {
    test('should create a custom entity type with DataSchema + PredefinedElements', async () => {
        // 1. Navigate to the Entities workspace
        // 2. Create new type "My Registry" with DataSchema + PredefinedElements + Actions + Events
        // 3. Verify it appears in sidebar
        // 4. Create instance of "My Registry"
        // 5. Add attributes to the instance
        // 6. Verify dialog tabs match component manifest
    })

    test('should publish custom entity type to runtime', async () => {
        // 1. Create custom type with physicalTable enabled
        // 2. Create instance with attributes
        // 3. Publish → Sync → Verify _app_objects + physical table
    })

    test('ECAE: event bindings dispatch scripts on lifecycle events', async () => {
        // 1. Create custom entity type with Actions + Events enabled
        // 2. Create a script that sets a flag field
        // 3. Create an action bound to the script
        // 4. Bind action to 'afterCreate' event
        // 5. Create an entity instance
        // 6. Verify the script was executed (flag field set)
    })
})
```

Iterative pixel-perfect comparison procedure (per spec point 7):

```typescript
test.describe('Pixel-Perfect Entity UI Verification', () => {
    // Step 1: Take baseline screenshots of legacy UI
    // (run once before the refactor, store as reference snapshots)

    const screenshotTargets = [
        // Legacy Catalogs — EN + RU baselines
        { name: 'catalog-list', url: '/catalogs', viewport: { width: 1280, height: 720 } },
        { name: 'catalog-create-general', action: 'open create dialog, general tab' },
        { name: 'catalog-create-hubs', action: 'open create dialog, hubs tab' },
        { name: 'catalog-create-layout', action: 'open create dialog, layout tab' },
        { name: 'catalog-edit-dialog', action: 'open edit dialog for existing catalog' },
        { name: 'catalog-copy-dialog', action: 'open copy dialog for existing catalog' },
        { name: 'attribute-list', action: 'open attributes list' },
        { name: 'attribute-create-dialog', action: 'open attribute create dialog' },
        { name: 'system-attributes-list', action: 'open system attributes list' },
        { name: 'system-attribute-edit-dialog', action: 'open system attribute edit dialog' },
        { name: 'predefined-elements-list', action: 'open predefined elements list' },
        { name: 'predefined-element-create-dialog', action: 'open predefined element create dialog' },
        // Entity-based Catalogs v2 — EN + RU parity targets
        { name: 'catalog-v2-list', url: '/entities/catalog-v2', viewport: { width: 1280, height: 720 } },
        { name: 'catalog-v2-create-general', action: 'open Catalogs v2 create dialog, general tab' },
        { name: 'catalog-v2-create-hubs', action: 'open Catalogs v2 create dialog, hubs tab' },
        { name: 'catalog-v2-create-layout', action: 'open Catalogs v2 create dialog, layout tab' },
        { name: 'catalog-v2-edit-dialog', action: 'open Catalogs v2 edit dialog' },
        { name: 'catalog-v2-copy-dialog', action: 'open Catalogs v2 copy dialog' },
        { name: 'set-list', url: '/sets' },
        { name: 'set-create-dialog', action: 'open create dialog' },
        { name: 'enumeration-list', url: '/enumerations' },
        { name: 'enumeration-create-dialog', action: 'open create dialog' },
    ]

    for (const target of screenshotTargets) {
        test(`pixel-perfect: ${target.name}`, async ({ page }) => {
            // Navigate to target page/dialog
            // Take screenshot
            await expect(page).toHaveScreenshot(`${target.name}.png`, {
                maxDiffPixelRatio: 0.001,  // 0.1% tolerance for anti-aliasing
                animations: 'disabled',
                caret: 'hide',
            })
        })
    }
})
```

**Workflow**:
1. Before refactor: run `npx playwright test --update-snapshots entity-pixel-perfect` to capture baselines
2. After refactor: run tests — any diff > 0.1% fails
3. Fix UI differences
4. Re-run until all screenshots match
5. Repeat for each viewport (1280×720, 1920×1080) and for both locales (EN, RU)
```

- [ ] Capture legacy EN/RU baseline screenshots before replacing any user-facing parity surface
- [ ] Create E2E spec for entity component builder
- [ ] Create E2E spec for pixel-perfect comparison (legacy vs Catalogs v2)
- [ ] Create product dogfood spec: fresh metahub → Entities builder → Catalogs v2 preset → publication → application → browser validation
- [ ] Add Catalogs v2 runtime flow assertions for applications-frontend page-surface create/edit/copy behavior
- [ ] Add policy-parity E2E coverage for Catalogs v2 system-attribute behavior under the existing platform policy helpers
- [ ] Add ECAE lifecycle event test
- [ ] Add publication/runtime pipeline test
- [ ] Run full E2E suite — all green

### Step 3.8: Validate Phase 3

- [ ] `pnpm build` — full workspace passes
- [ ] All EN/RU pixel-perfect screenshot comparisons pass (legacy Catalogs vs Catalogs v2, plus Sets/Enumerations no-regression coverage)
- [ ] New E2E tests pass (custom types, ECAE, publication pipeline)
- [ ] Fresh test metahub flow passes end-to-end: Entities → Catalogs v2 → publication → application → browser runtime
- [ ] Custom type creation → instances → ECAE bindings → publication → runtime verified end-to-end
- [ ] Legacy Catalogs and Catalogs v2 see the same records bi-directionally
- [ ] Snapshot v2 → v3 migration verified (import old snapshot into new system)

---

## Phase 4: Documentation

### Step 4.1: Developer Documentation

**Files**: update docs tree (EN + RU with exact structure parity)

- [ ] `docs/en/architecture/entity-component-system.md` — ECAE architecture overview (Entity-Component-Action-Event)
- [ ] `docs/ru/architecture/entity-component-system.md` — RU mirror
- [ ] `docs/en/guides/custom-entity-types.md` — user guide (creating custom types, configuring components, defining actions/events)
- [ ] `docs/ru/guides/custom-entity-types.md` — RU mirror
- [ ] `docs/en/api-reference/rest-api.md` — add generic entity routes, action routes, event binding routes
- [ ] `docs/ru/api-reference/rest-api.md` — RU mirror
- [ ] Update SUMMARY.md (EN + RU) with new pages
- [ ] `pnpm docs:i18n:check` passes

### Step 4.2: Memory Bank Updates

- [ ] Update `memory-bank/systemPatterns.md` with ECAE registry patterns
- [ ] Update `memory-bank/techContext.md` with new packages/interfaces
- [ ] Update `memory-bank/progress.md` with completion entry
- [ ] Close out `memory-bank/tasks.md` entries

---

## Phase 5: Advanced Zerocode Extensions (Future — Post-Parity)

> The current scope already includes a form-driven Zerocode MVP inside the `Entities` workspace. This future phase is reserved for advanced visual tooling after Catalogs v2 parity is complete.

### Step 5.1: Entity Builder UI

Advanced visual entity composition interface:

- **Component Palette**: Drag-and-drop available components (dataSchema, hierarchy, relations, actions, events, nestedCollections) onto an entity type canvas
- **Component Configuration**: Inline editors for component-specific settings (e.g., hierarchy depth limits, relation cardinality)
- **Live Preview**: Real-time preview of resulting sidebar sections and form tabs based on selected components
- **Validation Feedback**: Immediate display of component dependency violations (e.g., "nestedCollections requires dataSchema")

### Step 5.2: Action Logic Editor

Visual scripting for ECAE action definitions:

- **Trigger Selector**: Choose lifecycle events (beforeCreate, afterUpdate, afterDelete, etc.) as triggers
- **Action Blocks**: Visual blocks for common actions: send webhook, call scripting-engine function, set field value, validate condition
- **Flow Canvas**: Connect trigger → condition → action chains visually (inspired by Node-RED / Unreal Blueprints)
- **Test Runner**: Execute action chain against mock entity data with step-by-step trace

### Step 5.3: UI Block Layout Designer

Drag-and-drop form layout for entity instances:

- **Field Palette**: Auto-populated from entity's dataSchema component attributes
- **Layout Grid**: Arrange fields into rows/columns/tabs
- **Widget Selector**: Choose display widget per field (text input, dropdown, date picker, rich editor, etc.)
- **Responsive Preview**: Preview layout at different viewport widths

---

## Future Work (Beyond Current Scope)

### AOT Compilation (Ahead-of-Time)

The ComponentManifest JSON is designed as a stable, machine-readable contract that enables future AOT compilation:

1. **Phase A — DDL Generation**: JSON manifest → PostgreSQL DDL statements (CREATE TABLE, indexes, constraints)
2. **Phase B — TypeScript Types**: JSON manifest → TypeScript interfaces and Zod schemas for API validation
3. **Phase C — React Components**: JSON manifest → pre-built React form components with correct field types, validation rules, and layout

This eliminates runtime interpretation overhead for production deployments while keeping the visual Zerocode Constructor for development-time entity design.

### JSON Blueprint Repository

Shareable entity type templates as JSON files and/or exported preset artifacts sourced from the existing template registry:

- Export entity type definition (ComponentManifest + action bindings + event rules) as a single `.entity.json` file
- Import `.entity.json` into any Universo Platformo instance to create the entity type with all its components pre-configured
- Prefer wiring reusable published presets through the existing `metahubs` template registry/versioning flow rather than inventing a second global preset catalog
- Community marketplace potential for sharing domain-specific entity templates (CRM contacts, project tasks, inventory items, etc.)

### Entity-Only Metahub Mode

After coexistence acceptance is complete, add an optional metahub mode that hides legacy Catalogs / Sets / Enumerations navigation and exposes only `Entities` plus dynamically published sections. This is a post-acceptance shell/runtime configuration, not part of the current parity wave.

---

## Potential Challenges

| Challenge | Mitigation |
|---|---|
| **Component dependency cycles** | Static dependency graph in `COMPONENT_DEPENDENCIES` is DAG-only. Validated at build time. No dynamic component loading. |
| **Snapshot v2 → v3 migration** | `snapshotFormatVersion` bump to 3. Old v2 snapshots import via code registry fallback + missing component sections treated as empty arrays. Forward-compatible: v3 export always includes all ECAE sections. |
| **Pixel-perfect UI match** | Use shared `buildEntityFormTabs()` with component manifest driving tab composition. CATALOG_TYPE manifest → same 4 tabs as existing CatalogList. Verified via Playwright `toHaveScreenshot()` with `maxDiffPixelRatio: 0.001`. |
| **Performance of type resolution** | Built-in types resolve from in-memory Map (O(1)). Custom types cached per-request. No per-query DB lookups. |
| **Testing matrix explosion** | Focus on: (a) built-in types pixel-perfect match, (b) custom type happy path, (c) component dependency validation, (d) ECAE lifecycle events. Don't test every combination. |
| **Coexistence complexity** | Keep legacy and new paths alive intentionally during rollout. Add compatibility tests proving old/new paths see the same records. Legacy removal is deferred to a separate cleanup wave. |
| **Event router performance** | EntityEventRouter dispatches events synchronously within request transaction. No event queue or async processing in MVP — keeps implementation simple and debuggable. |
| **Lifecycle replay during import/restore** | Use explicit mutation modes (`interactive`, `copy`, `restore`, `seed`). Snapshot restore and template seeding default to silent restore, not interactive automation replay. |
| **Action script sandboxing** | Actions in MVP are declarative (webhook URLs, scripting-engine references). No arbitrary code execution. Advanced visual scripting remains a later wave and must still execute in a sandbox. |
| **Design-time services still encode catalog-only assumptions** | Use Step 2.5c as a hard gate: genericize or adapter-wrap `MetahubObjectsService`, `MetahubAttributesService`, and `MetahubLayoutsService` before exposing the corresponding components to arbitrary custom types. |
| **System attribute governance divergence** | Reuse `platformSystemAttributesPolicy.ts` and the existing seed/update helpers for Catalogs v2; do not create a duplicate `_upl_*` policy layer for entity presets. |
| **Applications-frontend runtime state remains catalog-centric** | Explicitly genericize `runtimeAdapter.ts` and `ApplicationRuntime.tsx` while preserving the current single-consumption page-surface cleanup contract. |
| **Global preset catalog duplication** | Reuse the existing platform template registry/versioning seam for reusable entity presets instead of introducing a second global preset store in `metahubs`. |
| **apps-template-mui adapter contracts are still catalogId-shaped** | Genericize shared runtime adapter/API contracts together with page components so the entity rollout does not leave catalog naming baked into reusable runtime abstractions. |
| **Dialog abstraction sprawl** | Enforce the two-dialog rule: `EntityFormDialog` for metadata authoring, `DynamicEntityFormDialog` for schema-driven data/value editors. |
| **Runtime contracts still catalog-centric** | Explicitly widen runtime selectors, script attachment contracts, and widget/runtime config types during Phase 3.5; do not assume custom kinds already work. |
| **Schema-DDL custom prefixes** | Small extension to `generateTableName()`. Existing prefix constants preserved. |
| **`_mhb_objects.config` polymorphism** | Config JSONB remains kind-specific (sortOrder for enumerations, hubs/runtimeConfig for catalogs, etc.). ComponentManifest does NOT replace config — it governs which UI tabs/backend capabilities are available per type. Document this boundary clearly. |
| **Over-designing new persistence/UI layers** | Reuse existing `_mhb_attributes` reference/child-attribute seams for relations and nested collections where possible, and reuse existing shared UI primitives before inventing new abstractions. |

---

## Design Notes (for CREATIVE reference)

- **UI Design**: See [creative-entity-component-architecture.md](../creative/creative-entity-component-architecture.md) — Area 3 (Adaptive Sidebar with Type-Driven Sections)
- **Coexistence-First Rollout**: Legacy Catalogs/Sets/Enumerations remain live while `Entities` and published sections such as `Catalogs v2` are introduced.
- **Reuse-First UI**: Prefer extending `EntityFormDialog`, `createEntityActions()`, `useListDialogs()`, `EntityScriptsTab`, and existing list/layout primitives over inventing new orchestration layers.
- **Dialog Boundary**: `EntityFormDialog` is the metadata authoring shell; `DynamicEntityFormDialog` is the schema-driven generated editor. Do not add a third dialog abstraction in the current wave.
- **Component System**: See creative doc Area 2 (Pragmatic Component Registry)
- **Snapshot Pipeline**: See creative doc Area 5 (Component-Driven Serialization)
- **ECAE Lifecycle**: Inspired by Strapi lifecycle hooks. EntityEventRouter dispatches beforeCreate/afterCreate/beforeUpdate/afterUpdate/beforeDelete/afterDelete events to registered action handlers through `EntityMutationService`.
- **Ownership Model**: Entity type definitions enable Actions/Events capability, while concrete actions and event bindings are stored on metadata objects (`_mhb_objects.id`) in the current wave.
- **Runtime Genericization Scope**: Genericization explicitly includes `applications-backend`, `applications-frontend`, and `apps-template-mui`, while preserving the current single-consumption page-surface behavior.
- **Policy Reuse**: Catalogs v2 must reuse the existing platform system-attribute governance helpers and not fork `_upl_*` behavior.

---

## Dependencies

- PR #755 (Shared/Common feature wave) must be merged before starting
- No cross-team dependencies
- No external service changes required
- Supabase/PostgreSQL only (no new database engines)

---

## Summary Checklist

### Phase 1 — Registry Foundation (Pure Refactor)
- [x] 1.1 EntityKind type evolution
- [x] 1.2 ComponentManifest interface (incl. hierarchy, nestedCollections, relations, actions, events)
- [x] 1.3 EntityTypeDefinition interface
- [x] 1.3b Shared contract widening (snapshot v3, script attachments, widget/runtime config types)
- [x] 1.4 Built-in type registry (5 types: CATALOG, SET, ENUMERATION, HUB, DOCUMENT)
- [x] 1.5 Component registry (backend, 10 component descriptors)
- [x] 1.6 Entity type resolver
- [x] 1.7 Full validation (build + tests)

### Phase 2 — ECAE System + Coexistence Foundation
- [x] 2.0 Extract shared GeneralTabFields (quick win)
- [x] 2.1 Add ECAE system tables (`_mhb_entity_type_definitions`, `_mhb_actions`, `_mhb_event_bindings`)
- [x] 2.2 Entity Type CRUD Service + ECAE Services (`ActionService`, `EventBindingService`, `EntityEventRouter`, `EntityMutationService`)
- [x] 2.3 Entity type CRUD routes + ECAE routes (actionsRoutes, eventBindingsRoutes)
- [x] 2.4 Resolver DB extension
- [x] 2.5 Generic entity instance routes + ECAE lifecycle event dispatch
- [x] 2.5b Coexistence-first compatibility layer (legacy paths preserved, shared entity foundation introduced)
- [x] 2.5c Design-time service genericization + policy reuse gate
- [x] 2.6 Frontend API layer
- [x] 2.7 `Entities` workspace below `Common`
- [x] 2.8 i18n keys (EN + RU, incl. ECAE terms)
- [x] 2.9 Full validation (ECAE + pixel-perfect)

### Phase 3 — Entity Builder + Published Sections + Runtime Genericization
- [x] 3.1 Generic EntityInstanceList page
- [x] 3.2 Dynamic sidebar sections + published menu zone (`Catalogs v2`)
- [x] 3.3 Component-driven snapshot serialization (format v3 with ECAE data)
- [x] 3.4 DDL pipeline for custom types
- [x] 3.5 Runtime and shared-contract genericization (`applications-backend`, `applications-frontend`, `apps-template-mui`)
- [x] 3.6 Zerocode MVP builder for current scope
- [x] 3.7 E2E/product dogfooding (pixel-perfect + publication/runtime + Catalogs v2)
- [x] 3.8 Full validation (snapshot v2→v3 migration + legacy/new bi-directional visibility)

### Phase 4 — Documentation
- [x] 4.1 Developer documentation (EN + RU)
- [x] 4.2 Memory bank updates

### Phase 5 — Advanced Zerocode Extensions (Future)
- [ ] 5.1 Visual canvas entity builder
- [ ] 5.2 Action Logic Editor (visual scripting for ECAE actions)
- [ ] 5.3 Freeform UI block layout designer

### Future Work (Beyond Scope)
- AOT compilation: JSON ComponentManifest → DDL + TypeScript types + React components code generation
- JSON Blueprint Repository: shareable entity type templates
