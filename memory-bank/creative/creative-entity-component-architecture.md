# Creative Design: Entity-Component Architecture for Universo Platformo

> **Created**: 2026-04-08  
> **Status**: Design exploration — ready for review  
> **Scope**: Flexible Entity-Component constructor for metadata objects, replacing hardcoded entity types with a composable system while preserving full backward compatibility

---

## Table of Contents

1. [Area 1: Entity Type Definition Model](#area-1-entity-type-definition-model)
2. [Area 2: Component System](#area-2-component-system)
3. [Area 3: Entity Builder UI](#area-3-entity-builder-ui)
4. [Area 4: Bridge Layer — Backward Compatibility](#area-4-bridge-layer--backward-compatibility)
5. [Area 5: Publication/Runtime Pipeline](#area-5-publicationruntime-pipeline)
6. [Recommended Architecture Summary](#recommended-architecture-summary)
7. [Risk Assessment Matrix](#risk-assessment-matrix)

---

## Area 1: Entity Type Definition Model

### Objectives

- Define how Entity Types (blueprints for metadata objects) are declared, stored, and resolved
- Preserve existing `MetaEntityKind` enum (`catalog`, `set`, `enumeration`, `hub`, `document`) as first-class built-in types
- Enable user-defined entity types composed from reusable components
- Maintain TypeScript type safety across frontend and backend

### Current State

- `MetaEntityKind` is a TypeScript const enum in `@universo/types` with 5 hardcoded values
- `_mhb_objects.kind VARCHAR` stores the discriminator
- `MetahubObjectsService.createObject()` branches on `kind` for runtime table generation (`catalog | document → physical table`)
- Frontend routing, sidebar sections, and dialog tab compositions are all wired to specific kind values
- Snapshot serializer iterates over objects grouped by kind with hardcoded snapshot section names

---

### Option A: Schema-as-Data (Full Runtime Definitions)

Entity types stored as rows in a new `_mhb_entity_type_definitions` table inside each metahub's isolated schema.

```sql
CREATE TABLE _mhb_entity_type_definitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codename    JSONB NOT NULL,           -- VLC codename
    presentation JSONB,                    -- {name, description} VLC
    kind_key    VARCHAR(64) NOT NULL,      -- machine key, e.g. 'custom_registry'
    is_builtin  BOOLEAN DEFAULT FALSE,     -- protects built-in types from deletion
    components  JSONB NOT NULL,            -- component manifest: which components compose this type
    ui_config   JSONB,                     -- dialog tabs, icon, color, sidebar placement
    config      JSONB,                     -- extra type-level config
    _upl_version INTEGER DEFAULT 1,
    _upl_created_at TIMESTAMPTZ DEFAULT now(),
    _upl_updated_at TIMESTAMPTZ DEFAULT now()
);
```

**How `kind` interacts:** `_mhb_objects.kind` would store the `kind_key` from the definition. Built-in types seed rows with `kind_key = 'catalog' | 'set' | ...` and `is_builtin = true`.

**Components manifest example:**
```jsonc
{
    "dataSchema": { "enabled": true },
    "predefinedElements": { "enabled": true, "maxElements": null },
    "hubAssignment": { "enabled": true },
    "enumerationValues": { "enabled": false },
    "runtimeBehavior": { "enabled": true },
    "scripting": { "enabled": true },
    "layoutConfig": { "enabled": true },
    "physicalTable": { "enabled": true, "prefix": "cat" }
}
```

**Pros:**
- Maximum flexibility — users can create arbitrary entity types at runtime
- Entity type definitions participate in snapshot/import/export naturally
- Types are metahub-scoped — different metahubs can have different type libraries
- Dynamic: type definitions can evolve without code deployment

**Cons:**
- TypeScript exhaustiveness checks no longer possible for component dispatch
- Component resolution becomes a runtime lookup rather than a compile-time switch
- Testing matrix explodes — every component combination must be tested
- UI must be fully data-driven for tab rendering, validation rules, etc.
- Higher risk of runtime errors from misconfigured type definitions
- Migration is complex: must seed built-in definitions for every existing metahub

**Risk:** HIGH — introduces a second abstraction layer on top of the already complex per-kind domain structure. Any regression in type definition resolution silently breaks all entity CRUD.

---

### Option B: Code-as-Schema (Static Type Registry)

Entity types defined as TypeScript objects in code, registered at application startup. Similar to Strapi content-type definitions but compiled.

```typescript
// packages/universo-types/base/src/entityTypes/catalogType.ts
export const CATALOG_TYPE_DEFINITION: EntityTypeDefinition = {
    kindKey: 'catalog',
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: { enabled: true },
        hubAssignment: { enabled: true },
        enumerationValues: { enabled: false },
        runtimeBehavior: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        physicalTable: { enabled: true, prefix: 'cat' }
    },
    ui: {
        icon: 'TableChart',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects'
    }
}

// Registry
export const ENTITY_TYPE_REGISTRY = new Map<string, EntityTypeDefinition>([
    ['catalog', CATALOG_TYPE_DEFINITION],
    ['set', SET_TYPE_DEFINITION],
    ['enumeration', ENUMERATION_TYPE_DEFINITION],
    // ... custom types registered via plugin mechanism
])
```

**How `kind` interacts:** `_mhb_objects.kind` continues storing the registry key. The registry is the canonical source of truth for what components a kind supports at compile time.

**Pros:**
- Full TypeScript type safety — each type definition is compile-time validated
- Exhaustive switch/case dispatch on kind keys remains possible
- Easy to test — each type's behavior is statically known
- Simpler migration — no data migration for type definitions, just code changes
- Plugin/extension system can register types at startup before routes are mounted

**Cons:**
- Users cannot create custom entity types through the UI without code deployment
- Less flexible for non-developer metahub administrators
- Custom types require a coordinated frontend+backend code release
- The type registry must be available on both server and client (shared package dependency)

**Risk:** LOW — this is essentially a refactor of the current hardcoded approach into a registry pattern. Behavior stays deterministic and testable.

---

### Option C: Hybrid — Built-in Code Registry + Data-Driven Custom Types (RECOMMENDED)

Platform provides built-in types as code-defined registry entries (Option B). A data-driven custom type layer (Option A) allows metahub-scoped custom types that compose from the same component set. Built-in types cannot be modified or deleted.

```
┌─────────────────────────┐     ┌───────────────────────────┐
│  Code Registry (Static) │     │  Data Definitions (DB)    │
│  catalog, set, enum,    │     │  _mhb_entity_type_defs    │
│  hub, document          │     │  (custom types per mhb)   │
│  ─────────────────────  │     │  ────────────────────────  │
│  is_builtin = true      │     │  is_builtin = false       │
│  TypeScript type-safe   │     │  JSONB component manifest  │
└───────────┬─────────────┘     └──────────┬────────────────┘
            │                              │
            └──────────┬───────────────────┘
                       ▼
             Unified Type Resolver
             (merge code + data defs)
                       │
                       ▼
          MetahubObjectsService.createObject()
          SnapshotSerializer.serialize()
          EntityFormDialog (tab composition)
```

**Resolution algorithm:**
1. Start with the static code registry (always available, type-safe)
2. For a given metahub, load custom type definitions from `_mhb_entity_type_definitions`
3. Merge into a unified `Map<string, ResolvedEntityType>` — code registry entries win on conflict
4. Cache per-metahub for the request lifetime

**How `kind` interacts:** `_mhb_objects.kind` stores the `kindKey`. Built-in keys (`catalog`, `set`, `enumeration`, `hub`, `document`) resolve from the code registry. Custom keys (`custom_registry`, `custom_reference_book`) resolve from the data definitions table.

**Migration path:**
1. Phase 1: Extract current hardcoded behavior into code registry entries (pure refactor, no user-visible change)
2. Phase 2: Add `_mhb_entity_type_definitions` table and the data-driven custom type creation UI
3. Phase 3: Enable custom type creation in the Entity Builder UI

**TypeScript type safety:**
- Built-in types remain fully type-safe through the code registry's `EntityTypeDefinition` interface
- Custom types use a validated-at-runtime `ComponentManifest` schema (Zod-parsed from JSONB)
- A discriminated union type `BuiltinEntityKind | string` preserves exhaustive checks for built-in kinds while allowing string-typed custom kinds

```typescript
export type BuiltinEntityKind = 'catalog' | 'set' | 'enumeration' | 'hub' | 'document'
export type EntityKind = BuiltinEntityKind | (string & {}) // nominal branding trick

export function isBuiltinKind(kind: EntityKind): kind is BuiltinEntityKind {
    return BUILTIN_KINDS.has(kind as BuiltinEntityKind)
}
```

**Pros:**
- Built-in types keep full compile-time safety and exhaustive dispatch
- Custom types unlock user-defined entity types without code deployment
- Backward compatibility is structurally guaranteed — built-in code paths remain unchanged
- Gradual rollout: Phase 1 (registry refactor) delivers value independently
- Custom type definitions participate in snapshot export/import
- Metahub-scoped: each metahub can have its own type library

**Cons:**
- More complex than pure Option B (two resolution sources)
- Custom type testing still requires dynamic test generation
- Need a clear error path when a custom type definition references an invalid component
- Resolver cache invalidation needed after type definition mutations

**Risk:** MEDIUM — Phase 1 (code registry) is inherently safe. Phase 2 (data definitions) introduces the dynamic layer but is optional and can be gated behind a feature flag.

**Files affected:**
- `packages/universo-types/base/src/common/metahubs.ts` — `MetaEntityKind` type evolution
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` — type resolution
- `packages/metahubs-backend/base/src/domains/router.ts` — generic entity routes
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx` — dynamic tab composition
- `packages/schema-ddl/base/src/` — table name generation for custom kinds
- `packages/universo-types/base/src/common/shared.ts` — shared pool kind extension

---

### Decision: Option C — Hybrid (Code Registry + Data-Driven Custom Types)

**Rationale:** Option C delivers the best of both worlds. Phase 1 (code registry extraction) is a low-risk refactor that immediately improves code organization without changing any user-visible behavior. Phase 2 (data-driven custom types) can be shipped incrementally and gated behind a feature flag. The existing codebase already uses `kind` as a string discriminator, so the transition to a registry-resolved discriminator is architecturally natural.

---

## Area 2: Component System

### Objectives

- Define reusable, composable components that can be attached to entity types
- Each component brings its own storage, CRUD behavior, UI tabs, and snapshot sections
- Declare component capabilities and dependencies explicitly
- Allow the same component to behave differently depending on configuration

### Current State — Implicit Components Already Exist

The current codebase already has implicit components, each implemented as a separate domain:

| Implicit Component | Table(s) | Domain Directory | Routes | Frontend Domain |
|---|---|---|---|---|
| DataSchema | `_mhb_attributes` | `domains/attributes/` | `attributesRoutes.ts` | `domains/attributes/` |
| PredefinedElements | `_mhb_elements` | `domains/elements/` | `elementsRoutes.ts` | `domains/elements/` |
| HubAssignment | `_mhb_objects.config.hubs` | `domains/hubs/` | N/A (inline in catalog CRUD) | `domains/hubs/` |
| EnumerationValues | `_mhb_values` | implied via attributes | `enumerationsRoutes.ts` | `domains/enumerations/` |
| Constants | `_mhb_constants` | `domains/constants/` | `constantsRoutes.ts` | `domains/constants/` |
| RuntimeBehavior | Layout `config.catalogBehavior` | `domains/layouts/` | layoutsRoutes.ts | `domains/layouts/` |
| Scripting | `_mhb_scripts` | `domains/scripts/` | `scriptsRoutes.ts` | `domains/scripts/` |
| LayoutConfig | `_mhb_layouts`, `_mhb_widgets` | `domains/layouts/` | `layoutsRoutes.ts` | `domains/layouts/` |

### Component Formalization Options

---

#### Option A: Thin Interface Layer (Configuration-Only)

Components remain as they are — separate domains with their own tables and routes. The Entity Type Definition simply declares which components are enabled for a given kind, without restructuring the component code itself.

```typescript
export interface ComponentManifest {
    dataSchema:         ComponentConfig | false
    predefinedElements: ComponentConfig | false
    hubAssignment:      ComponentConfig | false
    enumerationValues:  ComponentConfig | false
    constants:          ComponentConfig | false
    runtimeBehavior:    ComponentConfig | false
    scripting:          ComponentConfig | false
    layoutConfig:       ComponentConfig | false
}

export interface ComponentConfig {
    enabled: true
    // Component-specific settings
    [key: string]: unknown
}
```

**How component-entity binding works:**
- Entity routes check the resolved type's component manifest before delegating to domain services
- Example: `GET /metahub/:id/catalog/:catalogId/attributes` checks `resolvedType.components.dataSchema.enabled`
- If disabled, returns 404 or 405

**Dependency declaration:**
```typescript
export const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
    predefinedElements: ['dataSchema'],    // elements need attributes to define columns
    enumerationValues: [],                  // stand-alone
    constants: [],                          // stand-alone
    hubAssignment: [],                      // stand-alone
    runtimeBehavior: ['layoutConfig'],      // behavior lives inside layout config
    scripting: [],                          // stand-alone
    layoutConfig: []                        // stand-alone
}
```

**Pros:**
- Minimal refactoring — existing domain code stays untouched
- Dependencies are declared statically and validated at type definition time
- Each component's storage remains independent (separate table, separate FK to `_mhb_objects.id`)
- Incremental: can be done component-by-component

**Cons:**
- Components are not truly pluggable — adding a new component requires adding a new domain directory, routes, service, tests
- Component isolation is convention-based, not enforced by architecture
- No shared component lifecycle hooks (init, destroy, clone, snapshot, import)

**Risk:** LOW — this is essentially documenting and enforcing what already exists.

---

#### Option B: Component Interface Protocol (Structured Plugin System)

Define a formal `MetahubComponent` interface that each component must implement. Components register themselves and provide standard lifecycle hooks.

```typescript
export interface MetahubComponent<TConfig = unknown> {
    /** Unique component key */
    readonly key: string
    
    /** Human-readable metadata */
    readonly metadata: {
        nameKey: string        // i18n key for display name
        descriptionKey: string // i18n key for description
        icon: string           // MUI icon name
    }
    
    /** Dependencies on other components */
    readonly dependencies: string[]
    
    /** Storage model */
    readonly storage: ComponentStorageDescriptor
    
    /** Route factory: creates Express routes for this component */
    createRoutes(ctx: ComponentRouteContext): Router
    
    /** Snapshot: serialize this component's data for a given entity */
    serialize(entityId: string, ctx: ComponentSerializeContext): Promise<unknown>
    
    /** Snapshot: restore this component's data from snapshot */
    restore(entityId: string, data: unknown, ctx: ComponentRestoreContext): Promise<void>
    
    /** Clone: copy this component's data when an entity is copied */
    clone(sourceEntityId: string, targetEntityId: string, ctx: ComponentCloneContext): Promise<void>
    
    /** Delete: clean up when entity is deleted (if not cascade) */
    onEntityDeleted?(entityId: string, ctx: ComponentDeleteContext): Promise<void>
    
    /** UI: which tabs this component contributes to the entity dialog */
    readonly uiTabs: ComponentTabDescriptor[]
    
    /** Validate component-specific config */
    validateConfig(config: unknown): TConfig
}

export interface ComponentStorageDescriptor {
    /** 'table' = separate _mhb_* table, 'jsonb' = inline in _mhb_objects.config */
    type: 'table' | 'jsonb'
    /** Table name (for type='table') */
    tableName?: string
    /** JSONB path (for type='jsonb') */
    jsonbPath?: string
}
```

**Pros:**
- True pluggability — new components can be added without touching core routing/snapshot code
- Standardized lifecycle: serialize, restore, clone, delete are always present
- UI tab composition is data-driven from component descriptors
- Testing is structured: each component implements the same interface

**Cons:**
- Significant upfront refactoring to extract existing domains into this interface
- Snapshot format changes — snapshot sections become dynamic instead of hardcoded
- Over-engineering risk: 80% of usage will be the 5 built-in types with static components
- Route composition from components may conflict with Express middleware ordering
- Complex DI context requirements for component lifecycle hooks

**Risk:** HIGH — the refactoring effort is substantial, and the interface protocol imposes constraints that may not fit all component behaviors. The current per-domain architecture already works well for the existing components.

---

#### Option C: Pragmatic Component Registry with Convention-Based Hooks (RECOMMENDED)

Keep existing domain directories and services as-is. Introduce a lightweight component registry that maps component keys to their domain-level functions via convention-based hooks, without requiring a strict interface protocol.

```typescript
// packages/metahubs-backend/base/src/domains/shared/componentRegistry.ts

export interface ComponentDescriptor {
    key: string
    /** Which _mhb_* table(s) this component uses */
    tables: string[]
    /** Dependencies on other components */
    dependencies: string[]
    /** Whether this component creates a physical runtime table (e.g., 'catalog' → cat_<uuid>) */
    requiresPhysicalTable: boolean
    /** Physical table prefix for runtime table generation */
    physicalTablePrefix?: string
    /** Supported entity kinds (built-in). Null = all kinds via manifest */
    supportedKinds: string[] | null
}

export const COMPONENT_REGISTRY: Record<string, ComponentDescriptor> = {
    dataSchema: {
        key: 'dataSchema',
        tables: ['_mhb_attributes'],
        dependencies: [],
        requiresPhysicalTable: false,
        supportedKinds: null  // any type can have attributes
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
        tables: [],  // stored in _mhb_objects.config.hubs
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
        tables: [],  // stored inside layout config.catalogBehavior
        dependencies: ['layoutConfig'],
        requiresPhysicalTable: false,
        supportedKinds: ['catalog', 'document']
    }
}
```

**Convention-based snapshot hooks (added to existing services):**
```typescript
// In MetahubAttributesService (existing file)
export class MetahubAttributesService {
    // ... existing methods ...
    
    // Convention: snapshot hooks recognized by SnapshotSerializer
    async serializeForEntity(metahubId: string, entityId: string): Promise<MetaFieldSnapshot[]> { ... }
    async restoreForEntity(metahubId: string, entityId: string, data: MetaFieldSnapshot[]): Promise<void> { ... }
    async cloneForEntity(metahubId: string, sourceId: string, targetId: string): Promise<void> { ... }
}
```

**Pros:**
- Minimal refactoring — existing domains stay in place, only a registry layer is added
- Dependencies are documented and validated at type definition time
- Convention-based hooks are opt-in per service — no breaking interface changes
- SnapshotSerializer can iterate the registry to discover which components to serialize
- Adding a new component = new domain directory + registry entry
- Frontend can read the component manifest to compose dialog tabs dynamically

**Cons:**
- Convention-based hooks are not compiler-enforced (could miss adding a hook)
- Adding truly new components still requires backend + frontend code
- Less elegant than a formal protocol — some component behaviors may not fit the convention

**Risk:** LOW-MEDIUM — the registry is purely additive. Existing code does not change. The convention hooks are added incrementally.

**Files affected:**
- NEW: `packages/metahubs-backend/base/src/domains/shared/componentRegistry.ts`
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts` — registry-driven iteration
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` — component validation on create
- Frontend: `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx` — registry-driven tab composition

---

### Decision: Option C — Pragmatic Component Registry

**Rationale:** The existing domain directory structure already implements the "component" concept implicitly. Formalizing it into a registry with convention-based hooks preserves the working architecture while enabling the Entity Builder to compose custom types. The registry can be incrementally enriched without breaking existing behavior.

### Component Storage Decisions

| Component | Storage Pattern | Reasoning |
|---|---|---|
| DataSchema | Separate table (`_mhb_attributes`) | Already exists. High cardinality per entity, needs indexes. Keep as-is. |
| PredefinedElements | Separate table (`_mhb_elements`) | Already exists. High cardinality. Keep as-is. |
| HubAssignment | JSONB in `_mhb_objects.config.hubs` | Already exists. Low cardinality (typically 0-3 hubs). Keep as-is. |
| EnumerationValues | Separate table (`_mhb_values`) | Already exists. High cardinality. Keep as-is. |
| Constants | Separate table (`_mhb_constants`) | Already exists. Medium cardinality. Keep as-is. |
| Scripting | Separate table (`_mhb_scripts`) | Already exists. Low-medium cardinality. Keep as-is. |
| LayoutConfig | Separate tables (`_mhb_layouts`, `_mhb_widgets`) | Already exists. Complex structure. Keep as-is. |
| RuntimeBehavior | JSONB inside layout `config.catalogBehavior` | Already exists as layout-owned config. Keep as-is. |

**No storage schema changes are needed.** The Entity-Component system is a logical composition layer on top of existing physical storage.

---

## Area 3: Entity Builder UI

### Objectives

- Provide a UI for viewing, creating, and editing Entity Type definitions
- Must fit within existing MUI-based UI patterns (ViewHeader + MainCard + EntityFormDialog)
- "Catalogs v2" (created through Entity Builder) must be visually indistinguishable from current Catalogs in the runtime data editing UI
- Current catalogs remain fully functional alongside Entity-based types

### Current UI Architecture

The metahub frontend sidebar currently has:
```
Metahub (selected)
├── General          ← GeneralPage with Common tabs
├── Catalogs         ← CatalogList + EntityFormDialog
├── Sets             ← SetList + EntityFormDialog
├── Enumerations     ← EnumerationList + EntityFormDialog
├── Hubs             ← HubList
├── Publications     ← PublicationList
├── Templates        ← TemplateList
└── Settings         ← SettingsPage
```

---

### Option A: Dedicated "Entity Types" Section in Sidebar

Add a new top-level sidebar section for managing Entity Type definitions.

```
Metahub (selected)
├── General
├── Entity Types     ← NEW: EntityTypeList + EntityTypeFormDialog
├── ─────────────    ← visual separator
├── Catalogs         ← existing (includes both legacy and v2 catalogs)
├── Sets
├── Enumerations
├── Hubs
├── Publications
├── Templates
└── Settings
```

**EntityTypeList page:**
- `ViewHeader` with search and "Create Entity Type" button
- `FlowListTable` showing all entity type definitions (both built-in and custom)
- Built-in types shown with a lock icon and cannot be deleted
- Each row shows: icon, name, component badges, object count

**EntityTypeFormDialog tabs:**
1. **General** — codename, name, description, icon selection
2. **Components** — component picker with dependency validation
3. **UI** — dialog tab ordering, sidebar placement, color theme
4. **Preview** — live preview of how the entity creation dialog will look

**Component picker design (Tab 2 — Components):**
- Vertical list of all available components
- Each component row: icon, name, description, enabled toggle switch
- Dependency warnings shown inline (e.g., "PredefinedElements requires DataSchema")
- Enabled components expand to show component-specific settings inline
- No drag-and-drop — toggle switches are simpler and less error-prone

**Pros:**
- Clean separation: Entity Types are a meta-level concept, logically distinct from entity instances
- Built-in types are visible and documented in the same list
- Entity creation dialogs for custom types auto-generate from the defined components

**Cons:**
- Adds another sidebar section (UI complexity)
- Two-step mental model: first define the type, then create instances
- Built-in types appearing in the list may confuse users who cannot modify them

**Risk:** LOW — follows established ViewHeader + FlowListTable pattern.

---

### Option B: Entity Types as Settings Sub-Section

Entity Type management lives inside the Settings page as a dedicated tab.

```
Settings Page
├── General          ← existing settings
├── Codename Mode    ← existing
├── Entity Types     ← NEW tab
└── ...
```

**Pros:**
- Does not add a sidebar section — lower cognitive load for basic users
- Entity Types are an "admin" concept — Settings is the right home for admin-level config
- Reduces sidebar clutter

**Cons:**
- Hidden discoverability — users may not find it
- Settings tabs are currently flat key-value pairs; Entity Types are complex CRUD entities
- The EntityFormDialog pattern doesn't fit naturally inside a settings page
- Creates an awkward UX flow: go to Settings → define type → go back to sidebar instance list

**Risk:** MEDIUM — UX mismatch with existing Settings page patterns.

---

### Option C: Adaptive Sidebar with Type-Driven Sections (RECOMMENDED)

Instead of a separate "Entity Types" list, the sidebar sections themselves are driven by the type registry. Built-in sections (Catalogs, Sets, Enumerations) remain as-is. Custom entity types automatically create new sidebar sections when defined.

```
Metahub (selected)
├── General
├── Catalogs                ← built-in, instance list
├── Sets                    ← built-in, instance list
├── Enumerations            ← built-in, instance list
├── Custom: Registers       ← auto-generated from custom type definition
├── Custom: Classifiers     ← auto-generated from custom type definition
├── Hubs
├── ─────────────
├── Entity Types            ← configuration page (simpler than Option A)
├── Publications
├── Templates
└── Settings
```

**Entity Types configuration page:**
- Placed in the "administration" group of the sidebar (with Publications, Templates, Settings)
- `ViewHeader` with "Create Entity Type" button (no search needed — typically <20 custom types)
- Simple card grid or compact list showing all custom types
- Click to edit → `EntityTypeFormDialog`

**Custom type sidebar sections:**
- Automatically appear between the built-in entity sections and the administration group
- Use the icon, name, and i18n key from the type definition
- Link to a generic `EntityInstanceList` page that renders the same ViewHeader + FlowListTable pattern
- EntityFormDialog for instances uses the component manifest to compose tabs dynamically

**EntityTypeFormDialog (for defining new types) — simplified 2-tab dialog:**
1. **General** — codename, name, description, icon picker, physical table prefix
2. **Components** — toggle grid: DataSchema ✓, PredefinedElements ✓, Scripting ✓, etc.

**EntityInstanceList (for instances of custom types) — generic page:**
- Reuses the same ViewHeader + FlowListTable pattern as CatalogList
- Tab composition driven by the component manifest
- Create/Edit dialog tabs auto-generated from enabled components

**Pros:**
- Minimal new UI patterns — reuses ViewHeader + FlowListTable + EntityFormDialog throughout
- Custom entity types feel like first-class citizens — they get their own sidebar sections
- Entity Types administration is cleanly separated from instance management
- 2-tab dialog for type definition keeps the configuration simple
- Progressive complexity: basic users see the same sidebar as today; power users see additional sections

**Cons:**
- Sidebar can grow long if many custom types are defined (mitigated by collapsible groups)
- Auto-generated sidebar sections require dynamic route registration
- The generic EntityInstanceList page must handle component-specific views without hardcoded branches

**Risk:** LOW-MEDIUM — sidebar rendering is already data-driven from route configuration. Dynamic route registration is conceptually new but architecturally straightforward.

---

### Decision: Option C — Adaptive Sidebar

**Rationale:** This approach minimizes new UI patterns while making custom entity types feel like natural extensions of the platform. The Entity Types administration page stays simple (2-tab dialog), and custom types automatically become visible in the sidebar. The existing CatalogList/SetList/EnumerationList pages serve as proven templates for the generic EntityInstanceList.

### UI Detail Specifications

**1. Entity Types sidebar placement:**
- Between the "Hubs" section and a visual separator, in the administration group alongside Publications, Templates, and Settings
- Badge showing count of custom types (hidden if 0)
- i18n key: `metahubs:entityTypes.sidebar.title`

**2. Entity Type list page:**
- ViewHeader title: "Entity Types" / "Типы объектов"
- Create button: "Create Entity Type" / "Создать тип объекта"
- List items show: icon, localized name, enabled components as chips, instance count
- Built-in types shown as informational read-only cards at the top (collapsible)

**3. Entity Type create/edit dialog tabs:**
- Tab 1 — General: CodenameField, name/description VLC fields, MUI icon picker dropdown, table prefix input
- Tab 2 — Components: Grid of component cards, each with an enable toggle and inline settings expansion

**4. Component picker (Tab 2):**
- Toggle switches — not drag-and-drop, not checkboxes. Switches are consistent with the existing admin settings UI.
- Dependency auto-enable: toggling PredefinedElements ON auto-enables DataSchema with a toast notification
- Dependency block: toggling DataSchema OFF while PredefinedElements is ON shows a warning dialog

**5. Per-component inline settings:**
- DataSchema: "Max attributes" limit (optional)
- PredefinedElements: "Max elements" limit (optional)
- HubAssignment: "Is single hub?" toggle, "Is required hub?" toggle
- Scripting: enabled roles from script role registry
- LayoutConfig: available template keys
- Others: no additional settings in v1

---

## Area 4: Bridge Layer — Backward Compatibility

### Objectives

- Existing Catalogs, Sets, Enumerations continue to work with zero breaking changes
- Existing API routes remain stable
- Frontend pages for existing types are unchanged
- Snapshot compatibility: existing snapshots import into the new system
- No forced migration: existing metahubs work without entity type definitions

### Current Integration Points

| Surface | Built-in Kinds | Custom Kinds |
|---|---|---|
| Backend routes | `/metahub/:id/catalogs` etc. | New generic routes |
| Frontend domains | `domains/catalogs/`, `domains/sets/`, etc. | New generic `domains/entities/` |
| Snapshot sections | `entities[kind=catalog]`, etc. | New `customEntities` section |
| Runtime tables | `_app_objects`, `_app_attributes` | Same tables (shared runtime schema) |
| Scripts | `attachedToKind: 'catalog' \| ...` | `attachedToKind: kindKey` |

---

### Option A: Adapter Pattern (Parallel Routes)

Existing routes and services remain completely untouched. New generic entity routes are added alongside them. Custom types use only the new generic routes.

```
Existing preserved:
  POST   /metahub/:id/catalogs              → catalogsController.create
  GET    /metahub/:id/catalogs              → catalogsController.list
  PATCH  /metahub/:id/catalog/:catalogId    → catalogsController.update
  ...

New generic:
  POST   /metahub/:id/entities              → entityController.create
  GET    /metahub/:id/entities?kind=custom_x → entityController.list
  PATCH  /metahub/:id/entity/:entityId      → entityController.update
  ...
```

**Under the hood:** Both route sets call `MetahubObjectsService`, which now resolves the type definition from the Hybrid registry to determine which components are active.

**Pros:**
- Zero risk to existing routes — they are literally untouched
- Custom types get clean, well-designed routes from the start
- API consumers using existing routes see no change at all
- Can deprecate specific routes later via headers/docs without removing them

**Cons:**
- Code duplication — similar CRUD patterns exist in both route sets
- Maintenance burden increases: bugs might be fixed in one route set but not the other
- Two different URL patterns for the same underlying `_mhb_objects` table

**Risk:** LOW — existing code is preserved verbatim.

---

### Option B: Progressive Migration Pattern (Internal Refactor)

Existing services are gradually refactored to use an internal generic layer. Existing routes become thin delegating wrappers.

```typescript
// Old route (preserved API contract):
router.post('/metahub/:metahubId/catalogs', writeLimiter, asyncHandler(async (req, res) => {
    const kind = 'catalog'
    return genericEntityController.create(req, res, kind) // delegates to generic
}))

// New route (same controller):
router.post('/metahub/:metahubId/entities', writeLimiter, asyncHandler(async (req, res) => {
    const kind = req.body.kind
    return genericEntityController.create(req, res, kind)
}))
```

**Pros:**
- Single implementation path — DRY principle maintained
- Bug fixes propagate to all kinds automatically
- Gradual: existing routes can be migrated one at a time
- Eventually, the old routes can be removed (major version bump)

**Cons:**
- Higher risk: refactoring existing routes to delegate may introduce subtle regressions
- Existing per-kind controller logic (e.g., catalog-specific hub wiring, set-specific constant linking) must be generalized
- The generalization may lose per-kind optimizations or validations
- Aggressive refactoring timeline pressure can compound with feature work

**Risk:** MEDIUM — each route migration is a potential regression point. The per-kind specific logic in `catalogsController`, `setsController`, `enumerationsController` is non-trivial.

---

### Option C: Shadow Pattern (Separate Kind Namespace)

Custom entity types use prefixed kind values (e.g., `entity:custom_registry`) and are stored alongside existing objects. A materialization step normalizes them into the standard shape for snapshots/runtime.

**Pros:**
- Built-in kinds are structurally impossible to confuse with custom kinds
- Queries can filter by prefix to separate built-in from custom

**Cons:**
- Adds naming ceremony that does not provide real safety beyond Option A
- `_mhb_objects.kind` queries become pattern-based instead of equality-based
- Snapshot/runtime materialization adds a translation layer for zero benefit
- All downstream code must handle the prefix stripping

**Risk:** MEDIUM — unnecessary complexity for the isolation it provides. String prefixes are fragile.

---

### Decision: Option A — Adapter Pattern (Parallel Routes)

**Rationale:** The existing Catalogs/Sets/Enumerations routes contain significant per-kind business logic (hub wiring, constant linking, enumeration value ordering, display attribute management, shared entity exclusions). Attempting to generalize this into a single controller (Option B) would create a super-controller with complex branching that is harder to maintain than the current per-domain structure. Option A preserves all existing routes verbatim while giving custom entity types clean, well-designed generic routes from the start.

**Migration plan:**
1. Phase 1: Add generic entity CRUD routes (`/entities`) alongside existing routes. Both call `MetahubObjectsService`.
2. Phase 2: Each component's existing routes gain a generic equivalent (`/entity/:entityId/attributes` alongside `/catalog/:catalogId/attributes`).
3. Phase 3: Frontend generic `EntityInstanceList` uses only generic routes; existing pages continue using existing routes.
4. Phase 4 (future): Deprecate per-kind routes via response headers and documentation. Remove only on a major version boundary.

**Files affected:**
- NEW: `packages/metahubs-backend/base/src/domains/entities/routes/entityRoutes.ts`
- NEW: `packages/metahubs-backend/base/src/domains/entities/controllers/entityController.ts`
- NEW: `packages/metahubs-frontend/base/src/domains/entities/` — complete frontend domain
- `packages/metahubs-backend/base/src/domains/router.ts` — register generic entity routes
- Existing routes: **no modifications**

---

## Area 5: Publication/Runtime Pipeline

### Objectives

- Entity-based types must flow through the existing publication → snapshot → DDL → runtime pipeline
- Existing snapshot format must remain backward-compatible (older snapshots must import into new systems)
- Custom entity types must produce runtime `_app_objects` + `_app_attributes` rows
- Runtime RPC/scripting must work for custom entity types
- DDL generation must support custom physical table prefixes

### Current Pipeline

```
Design-Time                 Publication                  Runtime
─────────                   ───────────                  ───────
_mhb_objects  ──┐
_mhb_attributes ├── SnapshotSerializer ──► MetahubSnapshot ──► _app_objects
_mhb_elements  ─┤                              │              _app_attributes
_mhb_values    ─┤                              │              _app_elements
_mhb_constants ─┤                              ▼              _app_values
_mhb_scripts   ─┤                     SchemaGenerator         cat_<uuid> (physical)
_mhb_layouts   ─┘                              │
                                               ▼
                                         DDL: CREATE TABLE, ALTER TABLE
                                         Seed: _app_objects, _app_attributes, ...
```

---

### Option A: Inline Custom Types into Existing Snapshot Sections

Custom entity types are serialized alongside built-ins in the existing `entities` section of `MetahubSnapshot`. The `kind` field differentiates them.

```typescript
export interface MetahubSnapshot {
    version: 1
    // ... existing fields ...
    entities: Record<string, MetaEntitySnapshot>  // keyed by entity ID
    // MetaEntitySnapshot already has `kind` — custom kinds stored as-is
    
    // NEW: entity type definitions travel with the snapshot
    entityTypeDefinitions?: EntityTypeDefinitionSnapshot[]
}
```

**Pipeline changes:**
- `SnapshotSerializer.serialize()`: iterates all `_mhb_objects` regardless of kind. For each entity, checks the resolved type's component manifest to decide which component data to serialize.
- `SnapshotSerializer.materializeSharedEntitiesForRuntime()`: unchanged — shared entities are orthogonal to entity types.
- `SchemaGenerator`: reads `entityTypeDefinition.components.physicalTable.enabled` to decide whether to create a physical runtime table. Uses the custom prefix from the definition.
- `_app_objects` seeding: custom entity objects are inserted with their custom `kind` value.
- Runtime controllers: `runtimeRowsController` already queries `_app_objects` by kind. Custom kinds work without changes.

**Pros:**
- Minimal snapshot format change — only an optional new section for type definitions
- Existing snapshot import/export paths remain unchanged for built-in types
- Runtime tables and controllers already support arbitrary kinds
- DDL generation needs only a small extension for custom table prefixes

**Cons:**
- Old snapshots without `entityTypeDefinitions` import fine (backward compatible) but custom type definitions are not present if re-exported — need a re-seed mechanism
- SchemaGenerator must handle unknown component combinations safely

**Risk:** LOW — the existing snapshot format is already kind-agnostic. Custom kinds are just new kind values in the same structure.

---

### Option B: Separate Snapshot Section for Custom Entities

Custom entity types get their own dedicated snapshot section, separate from built-in `entities`.

```typescript
export interface MetahubSnapshot {
    version: 2  // version bump
    entities: Record<string, MetaEntitySnapshot>           // built-in only
    customEntities?: Record<string, CustomEntitySnapshot>  // custom types only
    entityTypeDefinitions?: EntityTypeDefinitionSnapshot[]
}
```

**Pros:**
- Clean separation — built-in and custom types are structurally distinct
- Version bump signals incompatibility to old consumers

**Cons:**
- Snapshot version bump risks breaking all existing import paths
- Duplication: `CustomEntitySnapshot` would be nearly identical to `MetaEntitySnapshot`
- Every consumer must check both sections
- Shared entity materialization must handle both sections

**Risk:** HIGH — version bump and structural duplication are not justified by the marginal separation benefit.

---

### Option C: Component-Driven Snapshot Serialization (RECOMMENDED)

Keep the existing `entities` section in `MetahubSnapshot` for all entity types. Extend `SnapshotSerializer` to use the component registry when serializing each entity, rather than hardcoding snapshot section assembly by kind.

```typescript
// SnapshotSerializer.serialize() — current:
async serialize(metahubId: string): Promise<MetahubSnapshot> {
    const objects = await this.objectsService.findAll(metahubId)
    const snapshot: MetahubSnapshot = { entities: {} }
    
    for (const obj of objects) {
        // Currently: per-kind hardcoded branches
        if (obj.kind === 'catalog') {
            snapshot.entities[obj.id] = await this.serializeCatalog(obj)
        } else if (obj.kind === 'set') { ... }
    }
}

// SnapshotSerializer.serialize() — proposed:
async serialize(metahubId: string): Promise<MetahubSnapshot> {
    const objects = await this.objectsService.findAll(metahubId)
    const typeResolver = await this.resolveTypes(metahubId)  // Hybrid resolver
    const snapshot: MetahubSnapshot = { entities: {} }
    
    for (const obj of objects) {
        const typeDef = typeResolver.resolve(obj.kind)
        const entitySnapshot = await this.serializeEntity(obj, typeDef)
        snapshot.entities[obj.id] = entitySnapshot
    }
    
    // Add type definitions for custom types
    if (typeResolver.hasCustomTypes()) {
        snapshot.entityTypeDefinitions = typeResolver.getCustomDefinitions()
    }
}

private async serializeEntity(
    obj: MetahubObjectRow, 
    typeDef: ResolvedEntityType
): Promise<MetaEntitySnapshot> {
    const snapshot: MetaEntitySnapshot = {
        kind: obj.kind,
        codename: obj.codename,
        presentation: obj.presentation,
        config: obj.config,
        tableName: obj.table_name
    }
    
    // Component-driven serialization
    if (typeDef.components.dataSchema?.enabled) {
        snapshot.fields = await this.attributesService.serializeForEntity(...)
    }
    if (typeDef.components.predefinedElements?.enabled) {
        snapshot.elements = await this.elementsService.serializeForEntity(...)
    }
    // ... etc for each component
    
    return snapshot
}
```

**Snapshot backward compatibility:**
- Old snapshots (without `entityTypeDefinitions`) import fine — the type resolver falls back to the code registry for built-in kinds
- New snapshots import into old systems — unknown custom kind entities are ignored with a warning (fail-open import for unknown kinds, fail-closed for missing components)

**DDL pipeline:**
- `generateTableName(entityId, kind)` already accepts `kind` as a string → extend to support custom prefixes
- `SchemaGenerator` checks `typeDef.components.physicalTable` to decide table creation
- Runtime `_app_objects` insertion is kind-agnostic — custom kinds insert with the same SQL

**Runtime scripting:**
- `attachedToKind` already accepts string values → custom kinds work without changes
- Script roles and capabilities are orthogonal to entity kinds

**Pros:**
- Snapshot format remains version 1 with optional additions
- Component-driven serialization eliminates per-kind hardcoded branches in the serializer
- Backward compatible: old snapshots import without entity type definitions
- Forward compatible: new snapshots with custom types can be imported by older systems (unknown kinds ignored)
- DDL and runtime paths need minimal changes (mostly string-based, already kind-agnostic)

**Cons:**
- Serialization becomes dependent on the type resolver (additional dependency in the snapshot path)
- Error handling for misconfigured component manifests must be defensive in the snapshot path
- Test coverage must include snapshot round-trips for custom component combinations

**Risk:** LOW-MEDIUM — the snapshot restructuring is internal to `SnapshotSerializer` and does not change the schema. The type resolver dependency is already needed by `MetahubObjectsService.createObject()`.

---

### Decision: Option C — Component-Driven Snapshot Serialization

**Rationale:** This approach naturally aligns the snapshot pipeline with the component registry from Area 2. Instead of maintaining per-kind hardcoded branches in the serializer, each entity is serialized based on its resolved type's component manifest. The snapshot format remains backward-compatible (version 1 with optional `entityTypeDefinitions` section), and DDL/runtime paths need minimal changes because they already operate on kind-agnostic string values.

**Files affected:**
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts` — component-driven serialization
- `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts` — component-driven import
- `packages/schema-ddl/base/src/` — custom table prefix support in `generateTableName()`
- `packages/applications-backend/base/src/services/publishedApplicationSnapshotEntities.ts` — custom kind awareness
- `packages/applications-backend/base/src/controllers/syncController.ts` — custom kind DDL

---

## Recommended Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                    ENTITY TYPE RESOLUTION                      │
│                                                                │
│  ┌─────────────────┐    ┌──────────────────────────────────┐  │
│  │  Code Registry   │    │  Data Definitions (per metahub)  │  │
│  │  (5 built-in)    │    │  _mhb_entity_type_definitions    │  │
│  │  TypeScript safe  │    │  JSONB component manifests       │  │
│  └────────┬─────────┘    └──────────────┬───────────────────┘  │
│           └───────────┬─────────────────┘                      │
│                       ▼                                        │
│              Hybrid Type Resolver                              │
│              (merge code + data)                               │
│                       │                                        │
│                       ▼                                        │
│              ResolvedEntityType                                │
│              { kind, components, ui }                          │
└───────────────────────┬────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│   Backend     │ │  Frontend   │ │  Snapshot     │
│              │ │             │ │  Pipeline     │
│ Existing      │ │ Existing    │ │              │
│ per-kind      │ │ per-kind    │ │ Component-   │
│ routes        │ │ domains     │ │ driven       │
│ (unchanged)   │ │ (unchanged) │ │ serializer   │
│              │ │             │ │              │
│ + Generic     │ │ + Generic   │ │ + Type defs  │
│   entity      │ │   entity    │ │   in snapshot │
│   routes      │ │   domain    │ │              │
└──────────────┘ └─────────────┘ └──────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                   COMPONENT REGISTRY                           │
│                                                                │
│  dataSchema ───── _mhb_attributes ──── serializeForEntity()   │
│  predefined ───── _mhb_elements ────── serializeForEntity()   │
│  hubAssign ────── config.hubs ──────── (inline)               │
│  enumValues ───── _mhb_values ──────── serializeForEntity()   │
│  constants ────── _mhb_constants ──── serializeForEntity()    │
│  scripting ────── _mhb_scripts ────── serializeForEntity()    │
│  layoutCfg ────── _mhb_layouts+w ──── serializeForEntity()    │
│  runtimeBhv ──── layout.config ────── (inline)               │
│                                                                │
│  Each component: tables[], dependencies[], supportedKinds[]   │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                    UI COMPOSITION                              │
│                                                                │
│  Sidebar:                                                      │
│    Built-in sections (Catalogs, Sets, Enumerations, Hubs)     │
│    + Auto-generated sections for custom entity types           │
│    + "Entity Types" admin page                                 │
│                                                                │
│  Entity Type Dialog: General tab + Components tab              │
│  Entity Instance Dialog: tabs driven by component manifest    │
│                                                                │
│  Pattern: ViewHeader + MainCard + EntityFormDialog (reused)    │
└────────────────────────────────────────────────────────────────┘
```

### Selected Approaches Per Area

| Area | Decision | Phase | Risk |
|---|---|---|---|
| 1. Type Definition Model | **Hybrid** — Code registry (built-in) + Data definitions (custom) | Phase 1: Code registry. Phase 2: Data definitions. | Medium |
| 2. Component System | **Pragmatic Component Registry** — declarative descriptors + convention hooks | Phase 1: Registry. Phase 2: Convention hooks. | Low |
| 3. Entity Builder UI | **Adaptive Sidebar** — dynamic sections + Entity Types admin page | Phase 2: Admin page. Phase 3: Dynamic sidebar. | Low-Medium |
| 4. Bridge Layer | **Adapter Pattern** — parallel routes, existing code untouched | Phase 1: Generic routes. Phase 2: Component routes. | Low |
| 5. Publication Pipeline | **Component-Driven Serialization** — registry-aware snapshot with backward compat | Phase 2: Serializer refactor. Phase 3: Custom DDL. | Low-Medium |

### Implementation Phases

**Phase 1 — Registry Foundation (pure refactor, no user-visible change):**
- Extract `MetaEntityKind` into a type registry in `@universo/types`
- Create `COMPONENT_REGISTRY` with descriptors for all 8 existing components
- Add `isBuiltinKind()` and `resolveEntityType()` utility functions
- No database changes, no route changes, no UI changes
- Estimated scope: ~10 files touched, 0 new tables

**Phase 2 — Entity Type Definitions + Generic Routes:**
- Add `_mhb_entity_type_definitions` table (new migration)
- Seed built-in type definitions for existing metahubs
- Add generic entity CRUD routes alongside existing routes
- Add Entity Types admin page in frontend
- Refactor SnapshotSerializer to use component-driven serialization
- Add `entityTypeDefinitions` section to snapshot format
- Estimated scope: ~25 new files, ~15 modified files, 1 new table

**Phase 3 — Entity Builder UI + Dynamic Sidebar:**
- Entity Type creation dialog with component picker
- Auto-generated sidebar sections for custom types
- Generic EntityInstanceList page with component-driven tabs
- DDL pipeline support for custom table prefixes
- Runtime scripting support for custom kinds
- Estimated scope: ~20 new files, ~10 modified files

---

## Risk Assessment Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regression in existing catalog/set/enum routes during Phase 1 | Low | High | Phase 1 is a pure refactor with no route changes. Existing E2E tests remain the regression gate. |
| Custom type component combinations producing invalid snapshots | Medium | High | Validate component manifests at type definition time. Snapshot serializer must fail closed on missing component data. |
| Sidebar becoming too long with many custom types | Low | Low | Collapsible sidebar groups. Max custom types per metahub limit if needed. |
| Snapshot backward compatibility broken by `entityTypeDefinitions` section | Low | High | Section is optional. Old snapshots import without it. New snapshots import into old systems (unknown kinds ignored). |
| Performance degradation from type resolution on every request | Low | Medium | Cache resolved types per-metahub per-request. Built-in types resolve from in-memory registry (no DB query). |
| Component dependency graph cycles | Very Low | Medium | Validate dependencies at type definition time. Current dependency graph is a DAG with no cycles. |
| Generic entity routes duplicating validation logic from per-kind routes | Medium | Medium | Share validation schemas via Zod. Generic routes use component-aware validators. |
| Runtime scripting for custom kinds requiring engine changes | Low | Medium | `attachedToKind` already accepts arbitrary strings. Script roles and capabilities are orthogonal to entity kinds. No engine changes needed. |
| Shared entity materialization for custom kinds | Medium | Medium | Shared containers are already kind-agnostic (`shared-*-pool` kinds). Custom types can opt into shared entity support via component manifest. |
| Migration of existing metahubs to seed built-in type definitions | Low | Low | Built-in definitions resolve from code registry even without DB rows. Seeding is for forward compatibility only. |

---

## Interaction With Existing Code Summary

### Packages Unaffected (No Changes Needed)
- `packages/universo-core-backend/` — no metahub-specific code
- `packages/universo-core-frontend/` — no metahub-specific code
- `packages/auth-backend/`, `packages/auth-frontend/` — orthogonal
- `packages/admin-backend/`, `packages/admin-frontend/` — orthogonal (settings API unchanged)
- `packages/profile-backend/`, `packages/profile-frontend/` — orthogonal
- `packages/universo-i18n/` — unchanged (new i18n keys added by metahubs packages)

### Packages Modified
| Package | Change Type | Phase |
|---|---|---|
| `@universo/types` | Type evolution: `MetaEntityKind` → `EntityKind`, new interfaces | 1 |
| `@universo/metahubs-backend` | Component registry, generic routes, serializer refactor | 1-2 |
| `@universo/metahubs-frontend` | Entity Types admin page, generic instance page, dynamic sidebar | 2-3 |
| `@universo/schema-ddl` | Custom table prefix support | 3 |
| `@universo/applications-backend` | Custom kind awareness in sync/runtime | 3 |
| `@universo/template-mui` | Possible `EntityFormDialog` extension for dynamic tab composition | 2-3 |
| `@universo/universo-migrations-platform` | New migration for `_mhb_entity_type_definitions` | 2 |

---

*This creative design document is ready for review. Once approved, the system has a clear blueprint for implementation starting with Phase 1 (Registry Foundation) as a pure refactoring pass.*
