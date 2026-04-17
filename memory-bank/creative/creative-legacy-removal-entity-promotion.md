# Creative Design: Legacy Removal + Entity-Based Metadata Types Promotion

> **Created**: 2026-04-13  
> **Status**: Design exploration — ready for review  
> **Scope**: Remove all legacy hardcoded metadata object domains (hubs, catalogs, sets, enumerations) and promote the Entity Component Architecture (ECAE) V2 types to be the sole implementation  
> **Prerequisite**: Entity V2 generalization for all kinds (PR #763) validated and merged, DB will be recreated fresh  
> **Related**: [creative-entity-component-architecture.md](creative-entity-component-architecture.md), [creative-entity-v2-generalization-hubs-sets-enumerations.md](creative-entity-v2-generalization-hubs-sets-enumerations.md), [creative-metahub-templates.md](creative-metahub-templates.md)

---

## Table of Contents

1. [DQ1: Kind Keys Format After Legacy Removal](#dq1-kind-keys-format)
2. [DQ2: Entity Instance List — Unified vs Specialized UI](#dq2-entity-instance-list)
3. [DQ3: Template ↔ Preset ↔ Default Instances Data Model](#dq3-template-preset-default-instances)
4. [DQ4: Sidebar Architecture After Legacy Removal](#dq4-sidebar-architecture)
5. [DQ5: Route Architecture](#dq5-route-architecture)
6. [DQ6: Query Key Architecture After Unification](#dq6-query-key-architecture)
7. [DQ7: Backend Architecture — Controller & Service Simplification](#dq7-backend-architecture)
8. [DQ8: BUILTIN_ENTITY_TYPE_REGISTRY Removal](#dq8-builtin-registry-removal)
9. [DQ9: Snapshot Serializer Simplification](#dq9-snapshot-serializer)
10. [DQ10: i18n Strategy for Legacy Key Removal](#dq10-i18n-strategy)
11. [UI Component Map](#ui-component-map)
12. [Migration Path — Step-by-Step Transformation Order](#migration-path)
13. [Risk Assessment](#risk-assessment)

---

## DQ1: Kind Keys Format After Legacy Removal {#dq1-kind-keys-format}

### Problem Statement

Current V2 entity types use kind keys like `custom.catalog-v2`, `custom.hub-v2`, etc. After removing legacy types and the `isBuiltin` flag, these keys must change. What format?

### Option A: Singular Kind Names (RECOMMENDED)

```
catalog, hub, set, enumeration, document
```

**Rationale:**
- `kindKey` describes the *type* of a single object, not a collection → singular is semantically correct
- Matches existing `MetaEntityKind` values (`catalog`, `set`, `enumeration`, `hub`, `document`)
- Short, clean, no prefixes
- Consistent with `_mhb_objects.kind` column which already stores singular values
- `TemplateSeedEntity.kind` already uses singular: `kind: 'catalog'`

**Cons:**
- Collides with current built-in kind values — but since we're dropping the DB, this is a non-issue

### Option B: Plural Kind Names

```
catalogs, hubs, sets, enumerations, documents
```

**Pros:** Easy to derive URL segments  
**Cons:** Inconsistent with existing `MetaEntityKind`, requires renaming the DB discriminator convention

### Option C: Keep `custom.*` Prefix for Built-in Presets

```
custom.catalog, custom.hub, custom.set, custom.enumeration
```

**Pros:** Distinguishes platform-standard presets from truly user-defined kinds  
**Cons:** All types are now DB-stored entities; the `custom.` prefix is misleading since `catalog` is a platform-standard concept, not a user customization

### Decision: Option A — Singular Kind Names

```typescript
// After promotion:
export const StandardEntityKinds = {
    CATALOG: 'catalog',
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub',
    DOCUMENT: 'document'
} as const
```

**Impact on `MetaEntityKind`:** The existing enum values stay identical. We can keep `MetaEntityKind` as a *convenience alias* for the five standard kind key strings, without treating them as special at the storage or resolution layer.

**`isBuiltin` flag replacement:** Instead of `isBuiltin: boolean`, entity type definitions will have a `source` field:

```typescript
type EntityTypeSource = 'preset' | 'custom'
```

- `preset` — created from a platform or community preset (catalog, hub, set, enumeration, document, constants-library)
- `custom` — user-defined entity type (created from scratch via the Entity builder)

The `source` field is informational only. It does NOT gate behavior — all types use the same code paths. It's used by the UI to show a "preset" badge and to prevent accidental structural modifications (e.g., changing the component manifest of a preset-created type could break expected behavior).

---

## DQ2: Entity Instance List — Unified vs Specialized UI {#dq2-entity-instance-list}

### Problem Statement

After removing legacy domains, should `EntityInstanceList` still delegate to specialized UI components (`CatalogList`, `HubList`, `SetList`, `EnumerationList`)?

### Option A: Keep Specialized Components, Move Them Into `entities/` Domain (RECOMMENDED)

Legacy domain folders (`catalogs/`, `hubs/`, `sets/`, `enumerations/`) are removed as standalone domains, but their **UI components** are migrated into `entities/ui/` as specialized renderers:

```
packages/metahubs-frontend/base/src/domains/entities/
├── ui/
│   ├── EntityInstanceList.tsx        ← Entry point (router)
│   ├── renderers/
│   │   ├── CatalogListRenderer.tsx   ← Migrated from catalogs/ui/CatalogList
│   │   ├── HubListRenderer.tsx       ← Migrated from hubs/ui/HubList
│   │   ├── SetListRenderer.tsx       ← Migrated from sets/ui/SetList
│   │   ├── EnumerationListRenderer.tsx ← Migrated from enumerations/ui/EnumerationList
│   │   └── GenericEntityListRenderer.tsx ← For truly custom kinds
│   ├── EntityFormDialog.tsx
│   └── EntitiesWorkspace.tsx
├── api/                              ← Unified API layer
│   ├── entityInstances.ts            ← Single CRUD API for all kinds
│   └── entityTypeActions.ts          ← Entity type CRUD
└── hooks/
    ├── useEntityInstances.ts
    └── useEntityPermissions.ts
```

**Delegation pattern (simplified from current):**

```tsx
// EntityInstanceList.tsx — after legacy removal
const INSTANCE_RENDERERS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
    catalog: lazy(() => import('./renderers/CatalogListRenderer')),
    hub: lazy(() => import('./renderers/HubListRenderer')),
    set: lazy(() => import('./renderers/SetListRenderer')),
    enumeration: lazy(() => import('./renderers/EnumerationListRenderer')),
}

const EntityInstanceList: React.FC = () => {
    const { kindKey } = useParams<{ kindKey: string }>()
    const entityType = useEntityTypeDefinition(kindKey)

    // No more "legacy compatible kind" resolution — kindKey IS the kind
    const Renderer = kindKey ? INSTANCE_RENDERERS[kindKey] : null

    if (Renderer) {
        return <Suspense fallback={<SkeletonGrid />}><Renderer /></Suspense>
    }

    return <GenericEntityListRenderer entityType={entityType} />
}
```

**Why keep specialized components:**

| Kind | Unique UI Behavior |
|------|-------------------|
| **Catalog** | Attribute tabs, element management, layout editing, hub assignment panel, system attribute tab, display attribute configuration |
| **Hub** | Tree view with expandable nodes, drag-reorder, parent-child hierarchy, cycle detection UI, nested catalogs/sets/enumerations under each hub |
| **Set** | Constants management (typed key-value pairs), hub-scoped views |
| **Enumeration** | Inline value editing, value ordering, default value selection |

These are genuinely different UX patterns. A single manifest-driven adaptive component would be a Level 5 effort.

**What changes vs current:**
1. No more `legacyCompatibleKind` resolution — `kindKey` directly maps to the renderer
2. No more `isCatalogCompatibleMode` flag — it's just `kindKey === 'catalog'`
3. Renderers consume the same entity instance API (no separate catalog/hub/set/enumeration API layers)
4. Shared UI primitives (`EntityFormDialog`, `GeneralTabFields`, `ViewHeader`) are used by all renderers

### Option B: Single Manifest-Driven Component

One component that dynamically composes tabs, columns, and dialogs from the `ComponentManifest`.

**Rejected:** Level 5 effort, each kind has genuinely different interaction patterns (tree vs flat list vs inline editing). Better suited for a future phase after the architecture stabilizes.

### Decision: Option A

**Rationale:** Preserves the mature, tested UX for each kind while eliminating the legacy domain abstraction. The renderers become implementation details of the `entities` domain, not separate domains. The API layer is unified — only the UI rendering differs per kind.

---

## DQ3: Template ↔ Preset ↔ Default Instances Data Model {#dq3-template-preset-default-instances}

### Problem Statement

Three linked features need design:
1. **Templates define which entity type presets are included** (template → preset connection)
2. **Entity type presets can define default instances** (preset → default instances)
3. **MetahubCreateOptions lists default instances** instead of legacy flags

### Current State

- `MetahubTemplateManifest.seed.entities[]` lists seed entities with `kind: 'hub' | 'catalog' | 'set' | 'enumeration'`
- `MetahubCreateOptions` has four boolean flags: `createHub`, `createCatalog`, `createSet`, `createEnumeration`
- Entity type presets (`EntityTypePresetManifest`) only define the type definition — no default instances
- Templates and presets are stored separately with no explicit link

### New Data Model

#### 3.1: Template ↔ Preset Connection

Templates will include an explicit list of preset references specifying which entity types to create when a metahub is created from this template:

```typescript
export interface MetahubTemplateManifest {
    $schema: 'metahub-template/v1'
    codename: string
    version: string
    minStructureVersion: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    meta?: MetahubTemplateMeta
    seed: MetahubTemplateSeed
    /** Entity type presets included in this template.
     *  References presets by codename from the global preset catalog. */
    presets?: TemplatePresetReference[]
}

export interface TemplatePresetReference {
    /** Preset codename (e.g., 'catalog-v2', 'hub-v2') */
    presetCodename: string
    /** Whether this preset is included by default (user can toggle off in create options) */
    includedByDefault: boolean
    /** Default instances to create when this preset is applied */
    defaultInstances?: PresetDefaultInstance[]
}

export interface PresetDefaultInstance {
    /** Machine codename for this instance */
    codename: string
    /** Localized display name */
    name: VersionedLocalizedContent<string>
    /** Localized description */
    description?: VersionedLocalizedContent<string>
    /** Optional instance-level config overrides */
    config?: Record<string, unknown>
    /** Hub codenames to assign this instance to (for hub-assignable types) */
    hubs?: string[]
    /** Seed attributes for catalog-type instances */
    attributes?: TemplateSeedAttribute[]
    /** Seed constants for set-type instances */
    constants?: TemplateSeedConstant[]
    /** Seed enumeration values for enumeration-type instances */
    enumerationValues?: TemplateSeedEnumerationValue[]
}
```

#### 3.2: Updated Template Manifest Example

```typescript
export const basicTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'basic',
    version: '0.2.0',
    minStructureVersion: '0.5.0',
    name: vlc('Basic', 'Базовый'),
    description: vlc('Minimal template with essential widgets and standard entity types',
                     'Минимальный шаблон с основными виджетами и стандартными типами сущностей'),
    meta: { author: 'universo-platformo', tags: ['starter', 'minimal'], icon: 'Dashboard' },

    presets: [
        {
            presetCodename: 'hub',
            includedByDefault: true,
            defaultInstances: [
                {
                    codename: 'MainHub',
                    name: vlc('Main', 'Основной'),
                    description: vlc('Main hub for organizing metahub content',
                                     'Основной хаб для организации контента метахаба')
                }
            ]
        },
        {
            presetCodename: 'catalog',
            includedByDefault: true,
            defaultInstances: [
                {
                    codename: 'MainCatalog',
                    name: vlc('Main', 'Основной'),
                    description: vlc('Main catalog for storing records',
                                     'Основной каталог для хранения записей')
                }
            ]
        },
        {
            presetCodename: 'set',
            includedByDefault: true,
            defaultInstances: [
                {
                    codename: 'MainSet',
                    name: vlc('Main', 'Основной'),
                    description: vlc('Main set for storing constants and typed values',
                                     'Основной набор для хранения констант и типизированных значений')
                }
            ]
        },
        {
            presetCodename: 'enumeration',
            includedByDefault: true,
            defaultInstances: [
                {
                    codename: 'MainEnumeration',
                    name: vlc('Main', 'Основное'),
                    description: vlc('Main enumeration for fixed values',
                                     'Основное перечисление для фиксированных значений')
                }
            ]
        }
    ],

    seed: {
        layouts: [/* ... same as current ... */],
        layoutZoneWidgets: {/* ... same as current ... */},
        settings: [/* ... same as current ... */]
        // NOTE: seed.entities[] is REMOVED — replaced by presets[].defaultInstances[]
    }
}
```

#### 3.3: Updated MetahubCreateOptions

Instead of four boolean flags, `MetahubCreateOptions` becomes preset-aware:

```typescript
export interface MetahubCreateOptions {
    /** Per-preset toggles. Key = preset codename.
     *  If omitted, uses template's `includedByDefault` value.
     *  If explicitly set, overrides the template default. */
    presetToggles?: Record<string, boolean>
}

// Example usage:
const createOptions: MetahubCreateOptions = {
    presetToggles: {
        'hub': true,        // Include hub type + its default instances
        'catalog': true,    // Include catalog type + its default instances
        'set': false,       // Skip set type entirely
        'enumeration': true // Include enumeration type
    }
}
```

**Migration from old format:** The old `createHub/createCatalog/createSet/createEnumeration` flags map directly to `presetToggles` by codename.

#### 3.4: Seed Execution Flow

```
User creates metahub with template "basic" + createOptions
    │
    ├── 1. Create system schema + system tables (unchanged)
    │
    ├── 2. Execute seed.layouts, seed.layoutZoneWidgets, seed.settings (unchanged)
    │
    ├── 3. For each template.presets[] entry:
    │     ├── Check presetToggles[presetCodename] ?? includedByDefault
    │     ├── If included:
    │     │   ├── 3a. Resolve preset manifest from template catalog
    │     │   ├── 3b. Create entity type definition row in _mhb_entity_type_definitions
    │     │   ├── 3c. For each defaultInstance in the preset reference:
    │     │   │   ├── Create _mhb_objects row with kind = preset.kindKey
    │     │   │   ├── Seed attributes/constants/enumValues if defined
    │     │   │   └── Assign to hubs if specified
    │     │   └── 3d. Create kind-specific settings (e.g., catalogs.allowCopy)
    │     └── If excluded: skip
    │
    └── 4. Done
```

#### 3.5: Frontend Create Options UI

The metahub creation dialog's "Options" tab becomes preset-driven:

```tsx
const MetahubCreateOptionsTab: React.FC<{
    presets: TemplatePresetReference[]
    toggles: Record<string, boolean>
    onToggle: (codename: string, enabled: boolean) => void
}> = ({ presets, toggles, onToggle }) => {
    return (
        <Stack spacing={1}>
            {/* Always-on items */}
            <FormControlLabel
                control={<Checkbox checked disabled />}
                label={t('metahubs:createOptions.branch')}
            />
            <FormControlLabel
                control={<Checkbox checked disabled />}
                label={t('metahubs:createOptions.layout')}
            />
            <Divider />
            {/* Preset toggles */}
            {presets.map(preset => (
                <FormControlLabel
                    key={preset.presetCodename}
                    control={
                        <Checkbox
                            checked={toggles[preset.presetCodename] ?? preset.includedByDefault}
                            onChange={(_, checked) => onToggle(preset.presetCodename, checked)}
                        />
                    }
                    label={resolvePresetLabel(preset.presetCodename)}
                />
            ))}
        </Stack>
    )
}
```

---

## DQ4: Sidebar Architecture After Legacy Removal {#dq4-sidebar-architecture}

### Problem Statement

Current sidebar has hardcoded `metahub-hubs`, `metahub-catalogs`, `metahub-sets`, `metahub-enumerations` items plus a dynamic `publishedEntityTypes` section. After legacy removal, the sidebar should be 100% dynamic.

### Decision: Fully Dynamic Entity-Type Sidebar

After legacy removal, all entity type items in the sidebar are generated from the same source: `publishedEntityTypes` list (which includes ALL entity type definitions, not just custom ones).

#### New Sidebar Generation Algorithm

```typescript
export const getMetahubMenuItems = (
    metahubId: string,
    options?: {
        canManageMetahub?: boolean
        canManageMembers?: boolean
        entityTypes?: MetahubMenuEntityType[]  // renamed from publishedEntityTypes
    }
): TemplateMenuItem[] => {

    // --- Entity type items (fully dynamic) ---
    const entityTypeItems = buildEntityTypeMenuItems(metahubId, options?.entityTypes ?? [])

    const items: TemplateMenuItem[] = [
        // === Dashboard zone ===
        {
            id: 'metahub-board',
            titleKey: 'metahubboard',
            url: `/metahub/${metahubId}`,
            icon: IconBuildingStore,
            type: 'item'
        },
        {
            id: 'metahub-branches',
            titleKey: 'branches',
            url: `/metahub/${metahubId}/branches`,
            icon: IconGitBranch,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        { id: 'metahub-divider', type: 'divider' },

        // === Design zone (always visible) ===
        {
            id: 'metahub-common',
            titleKey: 'commonSection',
            url: `/metahub/${metahubId}/common`,
            icon: IconLayoutDashboard,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        {
            id: 'metahub-entities',
            titleKey: 'entities',
            url: `/metahub/${metahubId}/entities`,
            icon: IconBox,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },

        // === Dynamic entity type items ===
        ...entityTypeItems,

        { id: 'metahub-divider-secondary', type: 'divider' },

        // === Admin zone ===
        {
            id: 'metahub-publications',
            titleKey: 'publications',
            url: `/metahub/${metahubId}/publications`,
            icon: IconApps,
            type: 'item',
            requiredPermission: 'manageMetahub'
        },
        // ... migrations, access, settings (unchanged)
    ]
    // ... permission filtering (unchanged)
}
```

#### buildEntityTypeMenuItems

```typescript
interface MetahubMenuEntityType {
    kindKey: string
    title: string               // Resolved from VLC presentation.name
    iconName: string            // From entityType.ui.iconName
    sidebarSection?: EntitySidebarSection  // 'objects' | 'admin'
    sidebarOrder?: number       // Explicit ordering
}

const buildEntityTypeMenuItems = (
    metahubId: string,
    entityTypes: MetahubMenuEntityType[]
): TemplateMenuItem[] => {
    return entityTypes
        .filter(et => (et.sidebarSection ?? 'objects') === 'objects')
        .sort((a, b) => {
            // Sort by explicit order, then alphabetically
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

#### Standard Sidebar Order for Preset Kinds

Preset entity type definitions include `sidebarOrder` in their `ui` config:

| Kind | sidebarOrder | Icon |
|------|-------------|------|
| `hub` | 10 | `IconHierarchy` |
| `catalog` | 20 | `IconDatabase` |
| `set` | 30 | `IconFileText` |
| `enumeration` | 40 | `IconFiles` |
| `document` | 50 | `IconLayoutDashboard` |
| Custom kinds | none (sorted alphabetically after ordered items) | User-defined |

This preserves the familiar ordering while being fully data-driven.

#### Data Source for Sidebar Entity Types

The sidebar receives entity types from a single API endpoint already used for the dynamic menu:

```
GET /api/metahubs/:metahubId/entity-types?sidebar=true
```

This returns all entity type definitions in the current metahub with their `ui` config resolved. The frontend `useMetahubDetails()` or `useMetahubSidebarEntityTypes()` hook fetches this once and passes it to `getMetahubMenuItems()`.

**Key change:** Currently `publishedEntityTypes` only returns *custom* types. After legacy removal, it returns ALL types including standard preset-based ones (hub, catalog, set, enumeration, document).

---

## DQ5: Route Architecture {#dq5-route-architecture}

### Routes That STAY (The Entity Route Tree)

All entity routes use the uniform pattern:

```
/metahub/:metahubId/entities/:kindKey/instances         ← Instance list
/metahub/:metahubId/entities/:kindKey/instance/:id/...  ← Instance details

Specific instance detail routes:
  .../attributes
  .../system
  .../elements
  .../constants
  .../values
  .../hubs
  .../catalogs        ← For hub instances: catalogs under this hub
  .../sets            ← For hub instances: sets under this hub
  .../enumerations    ← For hub instances: enumerations under this hub
  .../layout/:layoutId

Hub-scoped child routes:
  .../catalog/:catalogId/attributes
  .../catalog/:catalogId/system
  .../catalog/:catalogId/elements
  .../set/:setId/constants
  .../enumeration/:enumerationId/values
```

### Routes That GET REMOVED

All legacy top-level kind routes:

```
/metahub/:metahubId/hubs                  ← REMOVE
/metahub/:metahubId/catalogs              ← REMOVE
/metahub/:metahubId/sets                  ← REMOVE
/metahub/:metahubId/enumerations          ← REMOVE
/metahub/:metahubId/hub/:hubId/...        ← REMOVE
/metahub/:metahubId/catalog/:catalogId/...  ← REMOVE
/metahub/:metahubId/set/:setId/...        ← REMOVE
/metahub/:metahubId/enumeration/:enumerationId/... ← REMOVE
```

### URL Shortening Consideration

**Question:** Should we introduce shorter aliases like `/metahub/:id/catalogs` → `/metahub/:id/entities/catalog/instances`?

**Decision:** No. The extra path segment is clear and consistent. Adding aliases creates maintenance burden and confuses URL-based navigation logic. The sidebar links always use the full entity route, so users never see or type the URL.

### Frontend Route Registration After Cleanup

```tsx
// MainRoutes.tsx — after legacy removal
{
    path: 'metahub/:metahubId',
    element: <MetahubMigrationGuard><Outlet /></MetahubMigrationGuard>,
    children: [
        { index: true, element: <MetahubBoard /> },
        { path: 'publications', element: <PublicationList /> },
        { path: 'publication/:publicationId/versions', element: <PublicationVersionList /> },
        { path: 'publication/:publicationId/applications', element: <PublicationApplicationList /> },
        { path: 'migrations', element: <MetahubMigrations /> },
        { path: 'branches', element: <BranchList /> },
        { path: 'common', element: <MetahubCommon /> },
        { path: 'common/layouts/:layoutId', element: <MetahubLayoutDetails /> },

        // === Entity routes (sole entry point for all metadata objects) ===
        { path: 'entities', element: <EntitiesWorkspace /> },
        { path: 'entities/:kindKey/instances', element: <EntityInstanceList /> },
        { path: 'entities/:kindKey/instance/:catalogId/layout/:layoutId', element: <MetahubLayoutDetails /> },
        { path: 'entities/:kindKey/instance/:catalogId/attributes', element: <AttributeList /> },
        { path: 'entities/:kindKey/instance/:catalogId/system', element: <AttributeList /> },
        { path: 'entities/:kindKey/instance/:catalogId/elements', element: <ElementList /> },
        { path: 'entities/:kindKey/instance/:hubId/hubs', element: <HubList /> },
        { path: 'entities/:kindKey/instance/:hubId/catalogs', element: <CatalogList /> },
        { path: 'entities/:kindKey/instance/:hubId/sets', element: <SetList /> },
        { path: 'entities/:kindKey/instance/:hubId/enumerations', element: <EnumerationList /> },
        { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/attributes', element: <AttributeList /> },
        { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/system', element: <AttributeList /> },
        { path: 'entities/:kindKey/instance/:hubId/catalog/:catalogId/elements', element: <ElementList /> },
        { path: 'entities/:kindKey/instance/:setId/constants', element: <ConstantList /> },
        { path: 'entities/:kindKey/instance/:hubId/set/:setId/constants', element: <ConstantList /> },
        { path: 'entities/:kindKey/instance/:enumerationId/values', element: <OptionValueList /> },
        { path: 'entities/:kindKey/instance/:hubId/enumeration/:enumerationId/values', element: <OptionValueList /> },

        // === Admin routes (unchanged) ===
        { path: 'access', element: <MetahubMembers /> },
        { path: 'settings', element: <MetahubSettings /> }
    ]
}
```

Note: `CatalogList`, `HubList`, `SetList`, `EnumerationList` still exist as components — they're just used exclusively under entity routes now, not registered as standalone routes. In the instance list, they're rendered by `EntityInstanceList` delegation. In the sub-routes (e.g., catalogs under a hub), they're direct route components.

### Backend Route Simplification

```typescript
// router.ts — after legacy removal
export function createMetahubsServiceRoutes(ensureAuth, getDbExecutor): Router {
    const router = Router()
    const { read, write } = getRateLimiters()

    // Core metahubs CRUD
    router.use('/', createMetahubsRoutes(ensureAuth, getDbExecutor, read, write))

    // Branches
    router.use('/', createBranchesRoutes(ensureAuth, getDbExecutor, read, write))

    // Publications
    router.use('/', createPublicationsRoutes(ensureAuth, getDbExecutor, read, write))

    // Migrations
    router.use('/', createMetahubMigrationsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createApplicationMigrationsRoutes(ensureAuth, getDbExecutor, read, write))

    // === Entity routes (SOLE metadata object routes) ===
    router.use('/', createEntityTypesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEntityInstancesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createActionsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createEventBindingsRoutes(ensureAuth, getDbExecutor, read, write))

    // Shared entity services (attributes, elements, constants, layouts, scripts)
    router.use('/', createAttributesRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createConstantsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createElementsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createLayoutsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createScriptsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createSharedEntityOverridesRoutes(ensureAuth, getDbExecutor, read, write))

    // Settings & Templates
    router.use('/', createSettingsRoutes(ensureAuth, getDbExecutor, read, write))
    router.use('/', createTemplatesRoutes(ensureAuth, getDbExecutor, read))

    // REMOVED: createHubsRoutes, createCatalogsRoutes, createSetsRoutes, createEnumerationsRoutes

    router.use(domainErrorHandler)
    return router
}
```

---

## DQ6: Query Key Architecture After Unification {#dq6-query-key-architecture}

### Problem Statement

Current query keys have dual trees: legacy (`hubs(metahubId)`, `catalogs(metahubId)`, etc.) and entity-based (`entities(metahubId, kind)`). After legacy removal, these should unify.

### Decision: Unified Entity-Scoped Query Keys

```typescript
export const metahubsQueryKeys = {
    // ... metahub-level keys unchanged ...

    // ============ ENTITY TYPES ============
    entityTypes: (metahubId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'entityTypes'] as const,

    entityTypesList: (metahubId: string, params?: PaginationParams) => {
        const normalized = { /* ... */ }
        return [...metahubsQueryKeys.entityTypes(metahubId), 'list', normalized] as const
    },

    entityTypeDetail: (metahubId: string, entityTypeId: string) =>
        [...metahubsQueryKeys.entityTypes(metahubId), 'detail', entityTypeId] as const,

    // ============ ENTITY INSTANCES (unified for all kinds) ============
    instances: (metahubId: string, kindKey: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'instances', kindKey] as const,

    instancesList: (
        metahubId: string,
        kindKey: string,
        params?: PaginationParams & { locale?: string; includeDeleted?: boolean; onlyDeleted?: boolean; parentId?: string }
    ) => {
        const normalized = {
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
            sortBy: params?.sortBy ?? 'updated',
            sortOrder: params?.sortOrder ?? 'desc',
            search: params?.search?.trim() || undefined,
            locale: params?.locale,
            includeDeleted: params?.includeDeleted ?? false,
            onlyDeleted: params?.onlyDeleted ?? false,
            parentId: params?.parentId
        }
        return [...metahubsQueryKeys.instances(metahubId, kindKey), 'list', normalized] as const
    },

    instanceDetail: (metahubId: string, kindKey: string, instanceId: string) =>
        [...metahubsQueryKeys.instances(metahubId, kindKey), 'detail', instanceId] as const,

    // ============ INSTANCE CHILDREN (hub children, blocking refs, etc.) ============
    instanceChildren: (metahubId: string, kindKey: string, instanceId: string, childKind: string) =>
        [...metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId), 'children', childKind] as const,

    blockingReferences: (metahubId: string, kindKey: string, instanceId: string) =>
        [...metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId), 'blockingReferences'] as const,

    // ============ ATTRIBUTES (scoped to entity instance) ============
    attributes: (metahubId: string, instanceId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'attributes', instanceId] as const,

    attributesList: (metahubId: string, instanceId: string, params?: PaginationParams & { scope?: string }) => {
        const normalized = { /* ... */ }
        return [...metahubsQueryKeys.attributes(metahubId, instanceId), 'list', normalized] as const
    },

    // ============ CONSTANTS (scoped to set instance) ============
    constants: (metahubId: string, setId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'constants', setId] as const,

    // ============ ELEMENTS (scoped to catalog instance) ============
    elements: (metahubId: string, catalogId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'elements', catalogId] as const,

    // ============ ENUMERATION VALUES (scoped to enumeration instance) ============
    enumerationValues: (metahubId: string, enumerationId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'enumerationValues', enumerationId] as const,

    // ============ LAYOUTS (unchanged — already kind-agnostic) ============
    layoutsRoot: (metahubId: string) =>
        [...metahubsQueryKeys.detail(metahubId), 'layouts'] as const,

    // ... rest unchanged ...
}
```

### Key Changes

| Old Pattern | New Pattern |
|-------------|-------------|
| `hubs(metahubId)` | `instances(metahubId, 'hub')` |
| `hubsScope(metahubId, kindKey)` | `instances(metahubId, 'hub')` (no more scope — `kindKey` IS the kind) |
| `catalogs(metahubId, hubId)` | `instanceChildren(metahubId, 'hub', hubId, 'catalog')` |
| `allCatalogs(metahubId)` | `instances(metahubId, 'catalog')` |
| `sets(metahubId, hubId)` | `instanceChildren(metahubId, 'hub', hubId, 'set')` |
| `allSets(metahubId)` | `instances(metahubId, 'set')` |
| `enumerations(metahubId, hubId)` | `instanceChildren(metahubId, 'hub', hubId, 'enumeration')` |
| `allEnumerations(metahubId)` | `instances(metahubId, 'enumeration')` |
| `entities(metahubId, kind)` | `instances(metahubId, kind)` (renamed for clarity) |

### Invalidation Strategy

Cache invalidation becomes simpler with the unified tree:

```typescript
// Invalidate all instances of a kind when any instance changes:
queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.instances(metahubId, kindKey)
})

// Invalidate a specific instance:
queryClient.invalidateQueries({
    queryKey: metahubsQueryKeys.instanceDetail(metahubId, kindKey, instanceId)
})

// Invalidate all instance data across all kinds (nuclear option):
queryClient.invalidateQueries({
    queryKey: [...metahubsQueryKeys.detail(metahubId), 'instances']
})
```

---

## DQ7: Backend Architecture — Controller & Service Simplification {#dq7-backend-architecture}

### Domains to DELETE

| Domain Folder | What It Contains | Disposition |
|---------------|------------------|-------------|
| `hubs/` | `hubsController.ts`, `hubsRoutes.ts` | DELETE — hub CRUD moves to `entityInstancesController` |
| `catalogs/` | `catalogsController.ts`, `catalogsRoutes.ts` | DELETE — catalog CRUD moves to `entityInstancesController` |
| `sets/` | `setsController.ts`, `setsRoutes.ts` | DELETE — set CRUD moves to `entityInstancesController` |
| `enumerations/` | `enumerationsController.ts`, `enumerationsRoutes.ts` | DELETE — enumeration CRUD moves to `entityInstancesController` |

### Services to KEEP and Expand

| Service | Current Location | Action |
|---------|-----------------|--------|
| `MetahubObjectsService` | `shared/` | KEEP — core CRUD for all `_mhb_objects` rows |
| `MetahubAttributesService` | `shared/` | KEEP — attribute management, system attributes |
| `MetahubLayoutsService` | `layouts/` | KEEP — layout management |
| `MetahubConstantsService` | `shared/` | KEEP — constants management for set-type instances |
| `MetahubSettingsService` | `settings/` | KEEP — settings management |
| `EntityTypeService` | `entities/` | EXPAND — becomes sole resolver for entity type definitions |
| `EntityMutationService` | `entities/` | EXPAND — transaction-aware CRUD dispatching for all kinds |

### entityInstancesController Expansion

The generic entity instances controller becomes the sole CRUD entry point:

```typescript
// Entity instance routes — handles ALL kinds
POST   /api/metahubs/:metahubId/entities                    ← Create instance
GET    /api/metahubs/:metahubId/entities?kind=:kindKey       ← List instances by kind
GET    /api/metahubs/:metahubId/entity/:entityId             ← Get instance detail
PATCH  /api/metahubs/:metahubId/entity/:entityId             ← Update instance
DELETE /api/metahubs/:metahubId/entity/:entityId             ← Soft delete
POST   /api/metahubs/:metahubId/entity/:entityId/copy        ← Copy instance
POST   /api/metahubs/:metahubId/entity/:entityId/restore     ← Restore deleted
DELETE /api/metahubs/:metahubId/entity/:entityId/permanent    ← Permanent delete

// Hub-specific routes (handled by entityInstancesController with kind=hub)
GET    /api/metahubs/:metahubId/entity/:hubId/children?kind=:childKind ← Hub children
POST   /api/metahubs/:metahubId/entity/:entityId/hubs        ← Assign instance to hub
DELETE /api/metahubs/:metahubId/entity/:entityId/hubs/:hubId  ← Remove from hub
```

### ACL Simplification

Without the `isBuiltin` vs custom distinction, ACL becomes uniform:

```typescript
const resolvePermission = (
    entityType: ResolvedEntityType,
    operation: 'read' | 'create' | 'update' | 'delete'
): string => {
    // All entity instance mutations require editContent
    // Entity type definition mutations require manageMetahub
    if (operation === 'read') return 'readContent'
    return 'editContent'
}
```

All metadata object mutations use `editContent` permission (previously, only legacy kinds used `editContent` while generic custom kinds used `manageMetahub`). This is intentional: if you can edit catalog content, you should be able to edit content for any entity type.

### Settings Key Simplification

```typescript
// Before: catalogs.allowCopy, enumerations.allowCopy, etc.
// After: entity.<kindKey>.allowCopy — fully generic

const resolveSettingsKey = (kindKey: string, setting: string): string =>
    `entity.${kindKey}.${setting}`

// Usage:
const allowCopy = await settingsService.findByKey(
    metahubId,
    resolveSettingsKey(entityType.kindKey, 'allowCopy'),
    userId
)
```

The migration creates settings with the new namespace for all preset kinds:
```
entity.catalog.allowCopy = true
entity.catalog.allowDelete = true
entity.set.allowCopy = true
entity.set.allowDelete = true
entity.enumeration.allowCopy = true
entity.enumeration.allowDelete = true
entity.hub.allowCopy = true
entity.hub.allowDelete = true
```

---

## DQ8: BUILTIN_ENTITY_TYPE_REGISTRY Removal {#dq8-builtin-registry-removal}

### Problem Statement

`BUILTIN_ENTITY_TYPE_REGISTRY` is a code-based `Map<string, EntityTypeDefinition>` in `@universo/types`. With all types stored in `_mhb_entity_type_definitions`, do we still need it?

### Decision: Replace with STANDARD_ENTITY_PRESETS (Read-Only Reference)

The code-based registry changes role:

```typescript
// Before: BUILTIN_ENTITY_TYPE_REGISTRY — used for type resolution at runtime
// After: STANDARD_ENTITY_PRESETS — read-only reference for preset seeding and validation

/** Standard entity type presets provided by the platform.
 *  These are NOT used for runtime type resolution (that comes from the DB).
 *  They are used:
 *  1. By TemplateSeeder to seed entity type definitions into new metahubs
 *  2. By TemplateManifestValidator to validate preset component manifests
 *  3. By tests to verify expected preset behavior
 */
export const STANDARD_ENTITY_PRESETS: ReadonlyMap<string, EntityTypePresetManifest> = new Map([
    ['catalog', catalogPreset],
    ['hub', hubPreset],
    ['set', setPreset],
    ['enumeration', enumerationPreset],
    ['document', documentPreset]
])
```

### EntityTypeService Changes

```typescript
// Before:
class EntityTypeService {
    resolveType(kind: string): ResolvedEntityType {
        // 1. Check BUILTIN_ENTITY_TYPE_REGISTRY
        // 2. Query _mhb_entity_type_definitions
        // 3. Legacy-compatible kind resolution
    }
}

// After:
class EntityTypeService {
    resolveType(kind: string): ResolvedEntityType {
        // Single source: query _mhb_entity_type_definitions
        const definition = await this.findByKindKey(metahubId, kind, userId)
        if (!definition) throw new EntityTypeNotFoundError(kind)
        return { ...definition, source: definition.source }
    }
}
```

### Migration Impact

On fresh DB creation, `TemplateSeedExecutor` seeds entity type definition rows from the preset manifests. There is no fallback to code-based definitions — if the seed fails, the entity type simply doesn't exist.

---

## DQ9: Snapshot Serializer Simplification {#dq9-snapshot-serializer}

### Current Complexity

The snapshot serializer has extensive legacy-compatible kind resolution:
- `resolveLegacyCompatibleKind()` with 3-layer resolution (built-in → custom kind key → config)
- `RUNTIME_LEGACY_COMPATIBLE_KIND_SQL` with hardcoded CASE statements
- Entity type definitions indexed by kind in the snapshot alongside built-in type fallback

### After Legacy Removal

```typescript
// Before:
const resolveLegacyCompatibleKind = (kind, config) => {
    if (isBuiltinKind(kind)) return kind
    const configKind = getLegacyCompatibleObjectKind(config)
    if (configKind) return configKind
    return null
}

// After: no resolution needed — kind IS the kind
const resolveEntityBehavior = (kind: string, entityType: EntityTypeDefinition) => {
    // Behavior is determined by the components manifest
    return {
        hasPhysicalTable: entityType.components.physicalTable?.enabled ?? false,
        hasAttributes: entityType.components.dataSchema?.enabled ?? false,
        hasElements: entityType.components.predefinedElements?.enabled ?? false,
        hasConstants: entityType.components.constants?.enabled ?? false,
        hasEnumerationValues: entityType.components.enumerationValues?.enabled ?? false,
        hasHierarchy: entityType.components.hierarchy?.enabled ?? false,
    }
}
```

The snapshot serializer reads `_mhb_entity_type_definitions` to get the component manifest for each kind, then uses the manifest to determine which snapshot sections to include.

### RUNTIME_LEGACY_COMPATIBLE_KIND_SQL Removal

```sql
-- Before: complex CASE statement mapping custom.* kinds to legacy kinds
-- After: kind column directly stores 'catalog', 'hub', 'set', 'enumeration'
-- No SQL-level kind remapping needed
```

---

## DQ10: i18n Strategy for Legacy Key Removal {#dq10-i18n-strategy}

### Keys to DEPRECATE

Current namespace `metahubs:` has separate sections per legacy domain:

```
metahubs:hubs.*          ← Keys used by HubList, hub dialogs
metahubs:catalogs.*      ← Keys used by CatalogList, catalog dialogs
metahubs:sets.*          ← Keys used by SetList, set dialogs
metahubs:enumerations.*  ← Keys used by EnumerationList, enum dialogs
```

### Decision: Keep Keys, Rename Namespace

Since the UI components (CatalogList, HubList, etc.) still exist — they're just moved into the `entities` domain — their i18n keys remain valid. No key removal is needed in this phase.

**What changes:**

1. **Menu title keys** — Hardcoded `titleKey: 'hubs'` etc. in `menuConfigs.ts` are removed. Dynamic menu items use `title` from the entity type definition's VLC presentation, not i18n keys.

2. **"Source" column** — The "Source" column in EntityInstanceList (showing "Builtin" vs "Custom") is removed since there's no more distinction.

3. **New keys needed:**
   - `metahubs:createOptions.preset.*` — Labels for preset toggles in metahub create dialog
   - `metahubs:entities.kindBadge.preset` and `metahubs:entities.kindBadge.custom` — Badge labels in EntitiesWorkspace

4. **Keys that stay as-is:** All dialog labels, field labels, button labels, error messages within CatalogList, HubList, SetList, EnumerationList remain unchanged since those components still exist.

---

## UI Component Map {#ui-component-map}

### Components That STAY (moved to entities/ui/renderers/)

| Component | Current Location | New Location | Notes |
|-----------|-----------------|-------------|-------|
| `CatalogList` | `catalogs/ui/` | `entities/ui/renderers/` | Instance list renderer for kind=catalog |
| `HubList` | `hubs/ui/` | `entities/ui/renderers/` | Instance list renderer for kind=hub |
| `SetList` | `sets/ui/` | `entities/ui/renderers/` | Instance list renderer for kind=set |
| `EnumerationList` | `enumerations/ui/` | `entities/ui/renderers/` | Instance list renderer for kind=enumeration |
| `OptionValueList` | `enumerations/ui/` | `entities/ui/renderers/` | Sub-route component |
| `ConstantList` | `constants/ui/` | stays in place | Shared component, used by multiple renderers |
| `AttributeList` | `attributes/ui/` | stays in place | Shared component |
| `ElementList` | `elements/ui/` | stays in place | Shared component |

### Components That STAY (shared, unchanged)

| Component | Location | Notes |
|-----------|----------|-------|
| `EntityFormDialog` | `shared/` or `entities/ui/` | Dialog shell for create/edit metadata objects |
| `GeneralTabFields` | `shared/` | Name/description/codename fields |
| `FlowListTable` | `shared/` | Generic list/table component |
| `ViewHeader` | template-mui | Page header with actions |
| `EntityScriptsTab` | `scripts/ui/` | Scripts management tab |
| `LayoutList` | `layouts/ui/` | Layout management |
| `HubSelectionPanel` | `hubs/ui/` → `entities/ui/shared/` | Hub assignment panel |
| `TemplateSelector` | `templates/ui/` | Template selection in create flow |

### Components That GET REMOVED

| Component | Reason |
|-----------|--------|
| `legacyCompatibleRoutePaths.ts` | No more legacy route paths to resolve |
| `legacyCompatibility.ts` (backend shared) | No more legacy-compatible kind resolution |
| `entityTypeResolver.ts` | Replaced by direct `EntityTypeService.resolveType()` |
| `resolveLegacyCompatibleKinds()` | No more dual-kind resolution |
| `BUILTIN_ENTITY_TYPE_REGISTRY` | Replaced by DB-only resolution |
| `isBuiltinKind()` | No more built-in/custom distinction |
| `isCatalogCompatibleEntityType()` | Replaced by direct kind check |
| `LEGACY_COMPATIBLE_KIND_KEYS` | No more custom.catalog-v2 → catalog mapping |
| `getLegacyCompatibleObjectKindForKindKey()` | No more kind key indirection |

### API Layer Changes

| Current API Pattern | New Pattern |
|--------------------|-------------|
| Separate `hubsApi.ts`, `catalogsApi.ts`, etc. | Single `entityInstancesApi.ts` for all kinds |
| `useHubs()`, `useCatalogs()`, etc. | `useEntityInstances(kindKey)` |
| `useHubDetail()`, `useCatalogDetail()`, etc. | `useEntityDetail(kindKey, id)` |

**Important:** The specialized UI renderers (CatalogListRenderer, etc.) call the same unified `entityInstancesApi` — they just present the data differently. No separate backend endpoints per kind.

---

## Migration Path — Step-by-Step Transformation Order {#migration-path}

### Phase 0: Types & Interfaces (No Breaking Changes)

1. Add `EntityTypeSource = 'preset' | 'custom'` type
2. Add `TemplatePresetReference` and `PresetDefaultInstance` interfaces to `@universo/types`
3. Update `MetahubCreateOptions` to include `presetToggles`
4. Add `sidebarOrder` to `EntityTypeUIConfig`
5. Rename `EntityTypePresetManifest.entityType.kindKey` values: `custom.catalog-v2` → `catalog`, etc.
6. Update preset manifest files (kind keys, remove `custom.` prefix)

### Phase 1: Backend Legacy Route Removal

7. Remove `hubs/` domain folder (controller, routes)
8. Remove `catalogs/` domain folder (controller, routes)
9. Remove `sets/` domain folder (controller, routes)
10. Remove `enumerations/` domain folder (controller, routes)
11. Remove legacy route registrations from `router.ts`
12. Expand `entityInstancesController` to handle hub-specific operations (hierarchy, parent-child)
13. Remove `legacyCompatibility.ts` from `shared/`
14. Remove `entityTypeResolver.ts` — `EntityTypeService` becomes sole resolver
15. Remove `BUILTIN_ENTITY_TYPE_REGISTRY` usage from `EntityTypeService`
16. Simplify `SnapshotSerializer` — remove `resolveLegacyCompatibleKind()` and `RUNTIME_LEGACY_COMPATIBLE_KIND_SQL`

### Phase 2: Frontend Cleanup

17. Move `CatalogList`, `HubList`, `SetList`, `EnumerationList` into `entities/ui/renderers/`
18. Remove legacy frontend domain folders (`catalogs/`, `hubs/`, `sets/`, `enumerations/`)
19. Simplify `EntityInstanceList` — remove legacy compatible kind resolution
20. Remove `legacyCompatibleRoutePaths.ts`
21. Remove legacy route registrations from `MainRoutes.tsx`
22. Update `getMetahubMenuItems()` — remove hardcoded entity items, make fully dynamic
23. Unify query keys — collapse legacy per-kind trees into unified `instances(metahubId, kindKey)` pattern

### Phase 3: Template & Preset System Update

24. Add `presets[]` field to `MetahubTemplateManifest`
25. Remove `seed.entities[]` from template manifests
26. Update `TemplateSeedExecutor` to process `presets[].defaultInstances[]` instead of `seed.entities[]`
27. Update metahub create dialog to show preset-based options instead of legacy toggles
28. Update `MetahubCreateOptions` in `MetahubSchemaService`

### Phase 4: Settings & ACL Cleanup

29. Migrate settings keys to `entity.<kindKey>.*` namespace
30. Remove hardcoded settings prefix resolution
31. Unify ACL — all instance mutations use `editContent`

### Phase 5: DB Schema Cleanup (Fresh DB)

32. Remove `isBuiltin` column from `_mhb_entity_type_definitions`
33. Add `source VARCHAR(16) DEFAULT 'custom'` column
34. Ensure `kind_key` column in `_mhb_entity_type_definitions` uses singular names
35. Remove any legacy `CASE` statements from system SQL

### Phase 6: Validation & Docs

36. Update E2E flows — remove legacy route assertions
37. Update snapshot/fixture tests
38. Update EN/RU documentation
39. Update memory-bank files

---

## Risk Assessment {#risk-assessment}

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hub hierarchy operations (tree CRUD, cycle detection, widget binding) currently in `hubsController` need careful extraction | HIGH | Move hub-specific logic to `HubBehaviorService` that `entityInstancesController` delegates to |
| Snapshot import/export changes may break self-hosted fixture format | MEDIUM | Bump snapshot version to v4; v3 import remains supported with fallback |
| Query key tree collapse may cause cache invalidation regressions | MEDIUM | Add focused query key smoke tests mirroring the current coverage |
| Preset seed executor is a new code path untested at scale | LOW | Reuse existing `TemplateSeedExecutor.createEntities()` logic, just change the input shape |
| UI renderers moved to new paths may break lazy import chunks | LOW | Verify vite chunk output after move |
| `editContent` ACL for all kinds may widen permissions unintentionally | LOW | This is intentional — all metadata objects are "content". Confirm with acceptance |

---

## Appendix: Key TypeScript Interfaces After Promotion

```typescript
// === @universo/types — core interfaces ===

/** Standard kinds shipped with the platform (convenience alias, not a gate) */
export const StandardEntityKinds = {
    CATALOG: 'catalog',
    SET: 'set',
    ENUMERATION: 'enumeration',
    HUB: 'hub',
    DOCUMENT: 'document'
} as const

export type StandardEntityKind = (typeof StandardEntityKinds)[keyof typeof StandardEntityKinds]
export type EntityKind = StandardEntityKind | (string & {})

export type EntityTypeSource = 'preset' | 'custom'

export interface EntityTypeDefinition {
    kindKey: EntityKind
    source: EntityTypeSource
    components: ComponentManifest
    ui: EntityTypeUIConfig
    presentation?: {
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string>
    }
    config?: Record<string, unknown>
}

export interface EntityTypeUIConfig {
    iconName: string
    tabs: readonly string[]
    sidebarSection: EntitySidebarSection
    sidebarOrder?: number
}

// === Template ↔ Preset connection ===

export interface TemplatePresetReference {
    presetCodename: string
    includedByDefault: boolean
    defaultInstances?: PresetDefaultInstance[]
}

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

export interface MetahubCreateOptions {
    presetToggles?: Record<string, boolean>
}

// === Sidebar ===

export interface MetahubMenuEntityType {
    kindKey: string
    title: string
    iconName: string
    sidebarSection?: EntitySidebarSection
    sidebarOrder?: number
}
```
