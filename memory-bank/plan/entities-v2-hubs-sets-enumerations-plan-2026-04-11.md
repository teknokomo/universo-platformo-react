# Entity V2 Generalization — Hubs V2, Sets V2, Enumerations V2

> **Created**: 2026-04-11 | **Updated**: 2026-04-11 (post-QA revision)  
> **Status**: Plan — awaiting approval  
> **Complexity**: Level 4 — Major/Complex  
> **Prerequisite**: PR #757 (Entity-Component Architecture) merged or rebased  
> **Creative design**: [creative-entity-v2-generalization-hubs-sets-enumerations.md](../creative/creative-entity-v2-generalization-hubs-sets-enumerations.md)  
> **Previous plan**: [entity-component-architecture-plan-2026-04-08.md](entity-component-architecture-plan-2026-04-08.md)

---

## Overview

Extend the Entity Component Architecture (ECAE) to produce three new entity type presets — **Hubs V2**, **Sets V2**, and **Enumerations V2** — alongside the existing **Catalogs V2**. Each V2 kind shares the same `_mhb_objects` database rows as its legacy counterpart, delegates to the proven legacy frontend surface, and gains scripting/automation capabilities unavailable in legacy.

**Key architectural principles**:

1. `config.compatibility.legacyObjectKind` is the universal adapter for settings, ACL, frontend delegation, blocker resolution, runtime classification, and publication/schema compatibility.
2. **Canonical custom storage**: Custom entity instances must keep their custom `kindKey` in `_mhb_objects.kind`. Legacy-compatible behavior must be resolved through compatibility adapters and metadata-driven kind sets, not by rewriting stored kinds to legacy literals.
3. Legacy-compatible V2 routes must reuse the existing legacy controllers and legacy UI surfaces through shared compatibility utilities and route adapters, not through duplicated CRUD stacks.
4. All V2 kinds are additive — no breaking changes to legacy surfaces, no table schema changes beyond explicit metadata additions, and no unnecessary new UI primitives.

---

## Table of Contents

1. [Phase 1: Backend Foundation](#phase-1-backend-foundation)
2. [Phase 2: Frontend Delegation Generalization](#phase-2-frontend-delegation-generalization)
3. [Phase 3: Preset Templates](#phase-3-preset-templates)
4. [Phase 4: Settings & Policy Verification](#phase-4-settings--policy-verification)
5. [Phase 5: i18n — Preset Labels](#phase-5-i18n--preset-labels)
6. [Phase 6: Testing — Unit & Integration](#phase-6-testing--unit--integration)
7. [Phase 7: Testing — E2E (Playwright)](#phase-7-testing--e2e-playwright)
8. [Phase 8: Documentation](#phase-8-documentation)
9. [Phase 9: Fixture & Snapshot Regeneration](#phase-9-fixture--snapshot-regeneration)
10. [Phase 10: Final Validation & Build](#phase-10-final-validation--build)
11. [Potential Challenges](#potential-challenges)
12. [Design Decisions](#design-decisions)
13. [Files Changed Summary](#files-changed-summary)

---

## Phase 1: Backend Foundation

### Step 1.1: Extract `resolveLegacySettingsPrefix()` from catalog-only code

**File**: `packages/metahubs-backend/base/src/domains/catalogs/services/catalogCompatibility.ts`

Rename and generalize into a broader compatibility utility. The existing `isCatalogCompatibleEntityType` and `isCatalogCompatibleResolvedType` stay for catalog-specific logic; add new generic helpers.

```typescript
// New export in catalogCompatibility.ts (or a new legacyCompatibility.ts)
import { getLegacyCompatibleObjectKind, type ResolvedEntityType } from '@universo/types'

const LEGACY_SETTINGS_PREFIX_MAP: Record<string, string> = {
    catalog: 'catalogs',
    set: 'sets',
    enumeration: 'enumerations',
    hub: 'hubs',
}

/**
 * Resolves the settings key prefix for a legacy-compatible entity type.
 * Returns null for generic custom entity types (no legacy settings apply).
 */
export const resolveLegacySettingsPrefix = (
    resolvedType: Pick<ResolvedEntityType, 'config'>
): string | null => {
    const legacyKind = getLegacyCompatibleObjectKind(resolvedType.config)
    return legacyKind ? LEGACY_SETTINGS_PREFIX_MAP[legacyKind] ?? null : null
}

/**
 * Resolves the ACL permission for a legacy-compatible entity type mutation.
 * Legacy-compatible kinds use editContent/deleteContent; generic custom kinds
 * use manageMetahub.
 */
export const resolveLegacyAclPermission = (
    resolvedType: Pick<ResolvedEntityType, 'config'>,
    operation: 'write' | 'delete'
): 'editContent' | 'deleteContent' | 'manageMetahub' => {
    const prefix = resolveLegacySettingsPrefix(resolvedType)
    if (!prefix) return 'manageMetahub'
    return operation === 'delete' ? 'deleteContent' : 'editContent'
}
```

### Step 1.2: Generalize `entityInstancesController.ts` settings & ACL

**File**: `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`

Replace every hardcoded `'catalogs.allowCopy'` / `'catalogs.allowDelete'` with `resolveLegacySettingsPrefix()`:

```typescript
// Before (hardcoded):
const allowCopyRow = await settingsService.findByKey(metahubId, 'catalogs.allowCopy', userId)

// After (generic):
const settingsPrefix = resolveLegacySettingsPrefix(resolvedType)
if (settingsPrefix) {
    const allowCopyRow = await settingsService.findByKey(
        metahubId, `${settingsPrefix}.allowCopy`, userId
    )
    if (allowCopyRow?.value?._value === false) {
        return res.status(403).json({ error: `Copying is disabled in metahub settings` })
    }
}
```

Also generalize the ACL resolution where `isCatalogCompatibleResolvedType` is used:

```typescript
// Before:
const permission: RolePermission = isCatalogCompatibleResolvedType(resolvedType)
    ? 'editContent' : 'manageMetahub'

// After:
const permission = resolveLegacyAclPermission(resolvedType, 'write')
```

### Step 1.3: Generalize blocking-reference resolution

**File**: `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`

Create a kind-dispatched blocker finder:

```typescript
import { findBlockingCatalogReferences } from '../../catalogs/services/catalogCompatibility'

type BlockerFinder = (
    metahubId: string,
    entityId: string,
    services: { attributesService: MetahubAttributesService },
    userId?: string
) => Promise<Array<{ id: string; name: string; kind: string }>>

const LEGACY_BLOCKER_FINDERS: Record<string, BlockerFinder> = {
    catalog: (metahubId, entityId, { attributesService }, userId) =>
        findBlockingCatalogReferences(metahubId, entityId, attributesService, userId),
    // Hub, set, enumeration: no blocking references in current implementation
    // (direct delete permitted), but the map is extensible
}

const findLegacyReferenceBlockers = async (
    resolvedType: ResolvedEntityType,
    metahubId: string,
    entityId: string,
    services: { attributesService: MetahubAttributesService },
    userId?: string
) => {
    const legacyKind = getLegacyCompatibleObjectKind(resolvedType.config)
    const finder = legacyKind ? LEGACY_BLOCKER_FINDERS[legacyKind] : undefined
    return finder ? finder(metahubId, entityId, services, userId) : []
}
```

### Step 1.4: Introduce a generic legacy-compatibility registry (CRITICAL)

**Files**:
- `packages/metahubs-backend/base/src/domains/catalogs/services/catalogCompatibility.ts` or new `packages/metahubs-backend/base/src/domains/shared/legacyCompatibility.ts`
- `packages/universo-types/base/src/common/entityTypeDefinition.ts`

The previous QA revision proposed storing legacy-compatible V2 objects with legacy `kind` values. A deeper code review shows that approach is **incorrect** because:
- `entityInstancesController.ts` resolves custom entity types via `assertCustomEntityKind(resolver, kind, ...)`, so storing `kind='hub'` would make existing generic entity routes resolve the built-in kind instead of the custom type.
- `EntityTypeService.resolveType()` and `listCustomTypes()` key custom types by `kindKey`, and `entityInstancesController.list()` filters by the request `kind` directly.
- Mixed storage (`'hub'` for some objects, `'custom.hub-v2'` for others) would create data inconsistency rather than remove it.

Therefore, the correct pattern is:
- keep `kind = kindKey` for custom V2 objects,
- resolve compatibility through metadata (`legacyObjectKind`),
- generalize all legacy/runtime/publication seams that currently branch on exact legacy kinds.

Create shared helpers such as:

```typescript
export const isLegacyCompatibleEntityTypeOf = (
    resolvedType: Pick<ResolvedEntityType, 'config'> | null | undefined,
    legacyKind: LegacyCompatibleObjectKind
): boolean => Boolean(resolvedType && getLegacyCompatibleObjectKind(resolvedType.config) === legacyKind)

export const resolveLegacyCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes'>,
    metahubId: string,
    legacyKind: LegacyCompatibleObjectKind,
    userId?: string
): Promise<string[]> => {
    const customTypes = await entityTypeService.listCustomTypes(metahubId, userId)
    return [legacyKind, ...customTypes.filter((row) => isLegacyCompatibleEntityTypeOf(row, legacyKind)).map((row) => row.kindKey)]
}
```

This must become the **single source of truth** for controller lists, blocker checks, runtime filtering, dashboard counts, widget pickers, and schema generation.

### Step 1.5: Generalize legacy controllers and service seams for hubs/sets/enumerations

**Files**:
- `packages/metahubs-backend/base/src/domains/hubs/controllers/hubsController.ts`
- `packages/metahubs-backend/base/src/domains/sets/controllers/setsController.ts`
- `packages/metahubs-backend/base/src/domains/enumerations/controllers/enumerationsController.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubHubsService.ts`
- `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`
- `packages/metahubs-backend/base/src/domains/settings/services/MetahubSettingsService.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/controllers/metahubsController.ts`

Catalogs V2 already use the right structural pattern: the **legacy controller remains authoritative**, while compatibility helpers widen it to include compatible custom kinds. The same pattern must be implemented for hubs, sets, and enumerations.

Required updates:
- `setsController.ts`: replace `kind === MetaEntityKind.SET` and `findAllByKind(..., 'set')` assumptions with compatibility-aware kind sets.
- `enumerationsController.ts`: widen exact-kind branching and list/find/delete/copy flows to include enumeration-compatible custom kinds.
- `hubsController.ts`: widen nested-hub queries and hub blocker aggregation so hub/set/enumeration-compatible custom kinds are treated as first-class linked objects.
- `MetahubHubsService.ts`: replace direct `WHERE kind = 'hub'` assumptions with compatibility-aware hub kind resolution.
- `MetahubBranchesService.ts`: branch copy/prune/delete flows must derive hub/set/enumeration kinds via compatibility helpers, not hardcoded arrays.
- `MetahubSettingsService.ts`: hub-scoped propagation that currently queries `WHERE kind = 'hub'` must include hub-compatible custom kinds.
- `metahubsController.ts`: dashboard/statistics counters must include compatible custom kinds so counts do not silently exclude V2 data.

### Step 1.6: Generalize publication, runtime, and schema-generation seams

**Files**:
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
- `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`

The previous plan treated these as implicitly solved by kind translation. That is no longer valid.

Required updates:
- `SnapshotSerializer.materializeSharedEntitiesForRuntime()` must decide catalog/set/enumeration shared-entity merging through resolved compatibility metadata, not exact `entity.kind === MetaEntityKind.*` checks.
- Snapshot serialization must also exclude hub-compatible custom kinds from the generic entity loop wherever legacy hubs are treated specially, to avoid duplication.
- `runtimeRowsController.ts` must replace `RUNTIME_SECTION_FILTER_SQL = "kind NOT IN ('hub', 'set', 'enumeration')"` and `isRuntimeSectionTargetKind()` with compatibility-aware resolution so V2 hubs/sets/enumerations do not appear as generic runtime sections.
- `SchemaGenerator.ts` must not assume `field.targetEntityKind === 'set'` when normalizing set-constant references; set-compatible custom kinds must follow the same runtime schema logic.

---

## Phase 2: Frontend Delegation Generalization

### Step 2.1: Create Kind-Registry Delegation Map

**New file**: `packages/metahubs-frontend/base/src/domains/entities/ui/entityInstanceDelegates.ts`

```typescript
import { lazy, type LazyExoticComponent, type ComponentType } from 'react'
import type { LegacyCompatibleObjectKind } from '@universo/types'

/**
 * Lazy-loaded legacy surface delegates.
 * Each delegate receives the same props as the entity instance list route.
 * Adding a new legacy-compatible V2 kind = one line in this map.
 */
export const LEGACY_INSTANCE_DELEGATES: Partial<
    Record<LegacyCompatibleObjectKind, LazyExoticComponent<ComponentType<any>>>
> = {
    catalog: lazy(() => import('../../catalogs/ui/CatalogList')),
    set: lazy(() => import('../../sets/ui/SetList')),
    enumeration: lazy(() => import('../../enumerations/ui/EnumerationList')),
    hub: lazy(() => import('../../hubs/ui/HubList')),
}
```

### Step 2.2: Generalize `EntityInstanceList.tsx` delegation

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx`

Replace the hardcoded `CATALOG_COMPATIBLE_KIND_KEY` and `isCatalogCompatibleEntityType` check with the generic delegation map:

```typescript
// Before:
const CATALOG_COMPATIBLE_KIND_KEY = 'custom.catalog-v2'
// ... later in render:
if (isCatalogCompatibleMode) {
    return <CatalogList />
}

// After:
import { Suspense } from 'react'
import { getLegacyCompatibleObjectKind } from '@universo/types'
import { LEGACY_INSTANCE_DELEGATES } from './entityInstanceDelegates'

// In the component body:
const legacyKind = useMemo(
    () => entityType ? getLegacyCompatibleObjectKind(entityType.config) : null,
    [entityType]
)

const DelegateComponent = legacyKind
    ? LEGACY_INSTANCE_DELEGATES[legacyKind] ?? null
    : null

// In JSX:
if (DelegateComponent) {
    return (
        <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
            <DelegateComponent />
        </Suspense>
    )
}
// else: render the generic entity list
```

### Step 2.3: Add route-path adapters for hubs, sets, and enumerations

**New files**:
- `packages/metahubs-frontend/base/src/domains/hubs/ui/hubRoutePaths.ts`
- `packages/metahubs-frontend/base/src/domains/sets/ui/setRoutePaths.ts`
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/enumerationRoutePaths.ts`

Catalogs V2 already preserve route ownership through `catalogRoutePaths.ts`. Hubs, sets, and enumerations must follow the same pattern so V2 surfaces do not silently navigate back into legacy URL trees.

Required behavior:
- when `kindKey` is present, child authoring routes stay under `/metahub/:metahubId/entities/:kindKey/instance/:entityId/...`,
- when `kindKey` is absent, the same helper falls back to the legacy route structure,
- no duplicated navigation logic inside list components.

### Step 2.4: Generalize legacy list components and hooks for entity-route ownership

**Files**:
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubList.tsx`
- `packages/metahubs-frontend/base/src/domains/sets/ui/SetList.tsx`
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationList.tsx`
- `packages/metahubs-frontend/base/src/domains/hubs/hooks/useHubListData.ts`
- `packages/metahubs-frontend/base/src/domains/sets/hooks/useSetListData.ts`
- `packages/metahubs-frontend/base/src/domains/enumerations/hooks/useEnumerationListData.ts`

These components currently render, but still hardcode legacy navigation targets such as `/metahub/:id/set/:setId/constants` and `/metahub/:id/enumeration/:enumerationId/values`.

Update them to:
- detect optional `kindKey` from the entity route,
- build links/navigation through the new `*RoutePaths.ts` helpers,
- preserve breadcrumbs and deep links inside the V2 route tree,
- continue reusing the existing list dialogs, `EntityFormDialog`, cards, menus, and `@universo/template-mui` primitives.

### Step 2.5: Generalize widget and selector integrations for compatible hubs

**Files**:
- `packages/metahubs-frontend/base/src/domains/layouts/ui/MenuWidgetEditorDialog.tsx`
- any hub-selection hooks/selectors used by layouts and other integrations

`MenuWidgetEditorDialog.tsx` and related hub selectors currently assume `kind === 'hub'` and consume only legacy hub lists. Hub V2 must become selectable anywhere the product currently expects hubs.

Required updates:
- resolve compatible hub kinds through shared compatibility-aware APIs,
- make widget binding, hub pickers, and any hub-scoped selection UIs work for both legacy hubs and hub-compatible custom kinds,
- avoid introducing a separate V2-only hub picker.

### Step 2.6: Add explicit sidebar ordering metadata and sort published menu items by it

**Files**:
- `packages/universo-types/base/src/common/entityTypeDefinition.ts`
- `packages/metahubs-backend/base/src/domains/entities/services/EntityTypeService.ts`
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`
- `packages/universo-template-mui/base/src/components/dashboard/MenuContent.tsx`
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`

The original specification requires exact order in the left menu:
- `Хабы V2`
- `Каталоги V2`
- `Наборы V2`
- `Перечисления V2`

Alphabetical `kind_key` ordering does not satisfy this. Add optional metadata such as `ui.sidebarOrder?: number` to entity types and sort published menu items by `sidebarOrder ASC, title ASC`.

Preset defaults should be:
- `hub-v2` → `10`
- `catalog-v2` → `20`
- `set-v2` → `30`
- `enumeration-v2` → `40`

---

## Phase 3: Preset Templates

### Step 3.1: Create Hub V2 preset

**New file**: `packages/metahubs-backend/base/src/domains/templates/data/hub-v2.entity-preset.ts`

```typescript
import type { EntityTypePresetManifest } from '@universo/types'
import { HUB_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const hubV2Name = vlc('Hubs V2', 'Хабы V2')
const hubV2Description = vlc(
    'Hub-compatible custom entity preset with tree hierarchy, scripting, and automation.',
    'Пресет пользовательской сущности в стиле хаба с иерархией, скриптами и автоматизацией.'
)

export const hubV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'hub-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: hubV2Name,
    description: hubV2Description,
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
            scripting: { enabled: true },
            actions: { enabled: true },
            events: { enabled: true },
        },
        ui: {
            ...HUB_TYPE.ui,
            sidebarOrder: 10,
            nameKey: 'Hubs V2',
            descriptionKey:
                'Hub-compatible custom entity with tree hierarchy, scripting, and design-time automation.'
        },
        presentation: {
            name: hubV2Name,
            description: hubV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'hub'
            }
        }
    }
}
```

### Step 3.2: Create Set V2 preset

**New file**: `packages/metahubs-backend/base/src/domains/templates/data/set-v2.entity-preset.ts`

```typescript
import type { EntityTypePresetManifest } from '@universo/types'
import { SET_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const setV2Name = vlc('Sets V2', 'Наборы V2')
const setV2Description = vlc(
    'Set-compatible custom entity preset with attributes, constants, scripting, and automation.',
    'Пресет пользовательской сущности в стиле набора с атрибутами, константами, скриптами и автоматизацией.'
)

export const setV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'set-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: setV2Name,
    description: setV2Description,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'ecae', 'set'],
        icon: SET_TYPE.ui.iconName
    },
    entityType: {
        kindKey: 'custom.set-v2',
        codename: vlc('SetV2', 'SetV2'),
        components: SET_TYPE.components,
        ui: {
            ...SET_TYPE.ui,
            sidebarOrder: 30,
            nameKey: 'Sets V2',
            descriptionKey:
                'Set-compatible custom entity with attributes, constants, scripting, and automation.'
        },
        presentation: {
            name: setV2Name,
            description: setV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'set'
            }
        }
    }
}
```

### Step 3.3: Create Enumeration V2 preset

**New file**: `packages/metahubs-backend/base/src/domains/templates/data/enumeration-v2.entity-preset.ts`

```typescript
import type { EntityTypePresetManifest } from '@universo/types'
import { ENUMERATION_TYPE } from '@universo/types'
import { vlc } from './basic.template'

const enumerationV2Name = vlc('Enumerations V2', 'Перечисления V2')
const enumerationV2Description = vlc(
    'Enumeration-compatible custom entity preset for value lists with scripting and automation.',
    'Пресет пользовательской сущности в стиле перечисления для списков значений со скриптами и автоматизацией.'
)

export const enumerationV2EntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'enumeration-v2',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: enumerationV2Name,
    description: enumerationV2Description,
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
            actions: { enabled: true },
            events: { enabled: true },
        },
        ui: {
            ...ENUMERATION_TYPE.ui,
            sidebarOrder: 40,
            nameKey: 'Enumerations V2',
            descriptionKey:
                'Enumeration-compatible custom entity with value lists, scripting, and automation.'
        },
        presentation: {
            name: enumerationV2Name,
            description: enumerationV2Description
        },
        config: {
            compatibility: {
                legacyObjectKind: 'enumeration'
            }
        }
    }
}
```

### Step 3.4: Update existing Catalog V2 preset sidebar order

**File**: existing `catalog-v2` preset file

Set `ui.sidebarOrder = 20` so the published menu order exactly matches the specification.

### Step 3.5: Register new presets in index

**File**: `packages/metahubs-backend/base/src/domains/templates/data/index.ts`

```typescript
import { hubV2EntityPreset } from './hub-v2.entity-preset'
import { setV2EntityPreset } from './set-v2.entity-preset'
import { enumerationV2EntityPreset } from './enumeration-v2.entity-preset'

export const builtinEntityTypePresets: EntityTypePresetManifest[] = [
    catalogV2EntityPreset,
    documentWorkspaceEntityPreset,
    constantsLibraryEntityPreset,
    hubV2EntityPreset,         // NEW
    setV2EntityPreset,         // NEW
    enumerationV2EntityPreset, // NEW
]
```

---

## Phase 4: Settings & Policy Verification

> **QA note**: All required settings already exist in the codebase. No new settings need to be created.

### Step 4.1: Verify existing settings coverage

The following settings are **already registered** in `packages/universo-types/base/src/common/metahubs.ts`:

| Key | Line | Status |
|---|---|---|
| `hubs.allowCopy` | ~206 | ✅ Already exists |
| `hubs.allowDelete` | ~212 | ✅ Already exists |
| `sets.allowCopy` | ~330 | ✅ Already exists |
| `sets.allowDelete` | ~336 | ✅ Already exists |
| `enumerations.allowCopy` | ~372 | ✅ Already exists |
| `enumerations.allowDelete` | ~379 | ✅ Already exists |

i18n keys for these settings also exist in both `en/metahubs.json` and `ru/metahubs.json`.

**Action**: No settings creation needed. Verify that the settings seeder and settings UI correctly expose all of the above for new metahubs.

### Step 4.2: Verify `useEntityPermissions` frontend hook

**File**: `packages/metahubs-frontend/base/src/domains/settings/hooks/useEntityPermissions.ts`

This hook already resolves settings generically from a `{entityType}` prefix (e.g., `sets.allowCopy`). Verify it works for set/hub/enumeration prefixes — likely no code change needed.

---

## Phase 5: i18n — Preset Labels

> **QA note**: Settings i18n keys (`hubs.allowCopy`, `sets.allowDelete`, etc.) already exist in both EN and RU locale files. Only preset-specific labels need to be added.

### Step 5.1: Add EN locale keys for preset names

**File**: `packages/universo-i18n/base/src/locales/en/metahubs.json` (or `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json` depending on where ECAE preset keys live)

```json
{
    "entities.presets.hubV2.name": "Hubs V2",
    "entities.presets.hubV2.description": "Hub-compatible custom entity with tree hierarchy, scripting, and automation",
    "entities.presets.setV2.name": "Sets V2",
    "entities.presets.setV2.description": "Set-compatible custom entity with attributes, constants, and automation",
    "entities.presets.enumerationV2.name": "Enumerations V2",
    "entities.presets.enumerationV2.description": "Enumeration-compatible custom entity with value lists and automation"
}
```

### Step 5.2: Add RU locale keys for preset names

**File**: `packages/universo-i18n/base/src/locales/ru/metahubs.json` (or equivalent)

```json
{
    "entities.presets.hubV2.name": "Хабы V2",
    "entities.presets.hubV2.description": "Пользовательская сущность в стиле хаба с иерархией, скриптами и автоматизацией",
    "entities.presets.setV2.name": "Наборы V2",
    "entities.presets.setV2.description": "Пользовательская сущность в стиле набора с атрибутами, константами и автоматизацией",
    "entities.presets.enumerationV2.name": "Перечисления V2",
    "entities.presets.enumerationV2.description": "Пользовательская сущность в стиле перечисления со списками значений и автоматизацией"
}
```

### Step 5.3: Run i18n check

```bash
pnpm docs:i18n:check
```

---

## Phase 6: Testing — Unit & Integration

### Step 6.1: Backend unit tests — settings resolution

**File**: `packages/metahubs-backend/base/src/domains/catalogs/services/__tests__/catalogCompatibility.test.ts` (or new `legacyCompatibility.test.ts`)

```typescript
describe('resolveLegacySettingsPrefix', () => {
    it('returns "catalogs" for catalog-compatible types', () => {
        expect(resolveLegacySettingsPrefix({ config: { compatibility: { legacyObjectKind: 'catalog' } } }))
            .toBe('catalogs')
    })
    it('returns "sets" for set-compatible types', () => {
        expect(resolveLegacySettingsPrefix({ config: { compatibility: { legacyObjectKind: 'set' } } }))
            .toBe('sets')
    })
    it('returns "enumerations" for enumeration-compatible types', () => {
        expect(resolveLegacySettingsPrefix({ config: { compatibility: { legacyObjectKind: 'enumeration' } } }))
            .toBe('enumerations')
    })
    it('returns "hubs" for hub-compatible types', () => {
        expect(resolveLegacySettingsPrefix({ config: { compatibility: { legacyObjectKind: 'hub' } } }))
            .toBe('hubs')
    })
    it('returns null for generic custom types', () => {
        expect(resolveLegacySettingsPrefix({ config: {} })).toBeNull()
        expect(resolveLegacySettingsPrefix({ config: null })).toBeNull()
    })
})

describe('resolveLegacyAclPermission', () => {
    it('returns editContent for legacy-compatible write', () => {
        const config = { config: { compatibility: { legacyObjectKind: 'set' } } }
        expect(resolveLegacyAclPermission(config, 'write')).toBe('editContent')
    })
    it('returns deleteContent for legacy-compatible delete', () => {
        const config = { config: { compatibility: { legacyObjectKind: 'hub' } } }
        expect(resolveLegacyAclPermission(config, 'delete')).toBe('deleteContent')
    })
    it('returns manageMetahub for generic custom types', () => {
        expect(resolveLegacyAclPermission({ config: {} }, 'write')).toBe('manageMetahub')
    })
})
```

### Step 6.2: Backend integration tests — legacy controller compatibility

**File**: `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts`

Add test cases verifying compatibility-aware behavior without changing stored custom kinds:

```typescript
describe('legacy-compatible V2 kinds in legacy controllers', () => {
    it('lists set-compatible custom kinds through setsController', async () => {
        // Create custom entity type with legacyObjectKind: 'set'
        // Create object with kind='custom.set-v2'
        // GET /metahub/:id/sets should include it
    })
    it('lists enumeration-compatible custom kinds through enumerationsController', async () => {
        // Same pattern for enumerations
    })
    it('lists hub-compatible custom kinds through hubsController', async () => {
        // Same pattern for hubs
    })
    it('keeps custom kindKey in storage for V2 objects', async () => {
        // Verify DB row kind remains custom.set-v2 / custom.hub-v2 / custom.enumeration-v2
    })
})
```

### Step 6.3: Backend integration tests — settings enforcement

**File**: `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts`

Add test cases in the existing entity routes suite:

```typescript
describe('copy with set-compatible entity type', () => {
    it('blocks copy when sets.allowCopy=false', async () => {
        // Create entity type with legacyObjectKind: 'set'
        // Set settings.sets.allowCopy = false
        // POST copy → expect 403
    })
    it('allows copy when sets.allowCopy=true', async () => {
        // ... expect 200
    })
})

describe('delete with hub-compatible entity type', () => {
    it('blocks delete when hubs.allowDelete=false', async () => {
        // Create entity type with legacyObjectKind: 'hub'
        // Set settings.hubs.allowDelete = false
        // DELETE → expect 403
    })
    it('allows delete when hubs.allowDelete=true', async () => {
        // ... expect 200
    })
})

describe('ACL for enumeration-compatible entity type', () => {
    it('enforces editContent for create', async () => {
        // Create entity type with legacyObjectKind: 'enumeration'
        // Attempt create as user with editContent → expect 200
        // Attempt create as user without editContent → expect 403
    })
})
```

### Step 6.4: Backend integration tests — runtime/schema compatibility

**Files**:
- publication/runtime tests around `SnapshotSerializer` and `runtimeRowsController`
- targeted tests for `SchemaGenerator`

Add coverage for:
- shared attributes/constants/enumeration values merging for compatible custom kinds,
- runtime section filtering so hub/set/enumeration-compatible custom kinds do not appear as generic runtime sections,
- set-constant references in schema generation when `targetEntityKind` points at a set-compatible custom kind.

### Step 6.5: Backend preset validation tests

**File**: `packages/metahubs-backend/base/src/tests/templates/entityTypePresets.test.ts` (new or extend existing)

```typescript
import { hubV2EntityPreset } from '../../domains/templates/data/hub-v2.entity-preset'
import { setV2EntityPreset } from '../../domains/templates/data/set-v2.entity-preset'
import { enumerationV2EntityPreset } from '../../domains/templates/data/enumeration-v2.entity-preset'
import { validateComponentDependencies } from '@universo/types'

describe('V2 entity type presets', () => {
    it.each([
        ['hub-v2', hubV2EntityPreset],
        ['set-v2', setV2EntityPreset],
        ['enumeration-v2', enumerationV2EntityPreset],
    ])('%s has valid component dependencies', (_name, preset) => {
        expect(() => validateComponentDependencies(preset.entityType.components)).not.toThrow()
    })

    it.each([
        ['hub-v2', hubV2EntityPreset, 'hub'],
        ['set-v2', setV2EntityPreset, 'set'],
        ['enumeration-v2', enumerationV2EntityPreset, 'enumeration'],
    ])('%s declares correct legacyObjectKind=%s', (_name, preset, expectedKind) => {
        expect(preset.entityType.config?.compatibility?.legacyObjectKind).toBe(expectedKind)
    })

    it.each([
        ['hub-v2', hubV2EntityPreset],
        ['set-v2', setV2EntityPreset],
        ['enumeration-v2', enumerationV2EntityPreset],
    ])('%s has valid EN/RU presentation', (_name, preset) => {
        expect(preset.name?.locales?.en).toBeTruthy()
        expect(preset.name?.locales?.ru).toBeTruthy()
        expect(preset.description?.locales?.en).toBeTruthy()
        expect(preset.description?.locales?.ru).toBeTruthy()
    })
})
```

### Step 6.6: Frontend delegation and route-ownership tests

**File**: `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`

Extend the existing RTL test suite:

```typescript
describe('legacy-kind delegation', () => {
    it('delegates to CatalogList for catalog-compatible entity type', () => {
        // Existing test — verify it still passes
    })
    it('delegates to SetList for set-compatible entity type', () => {
        // Mock entity type with legacyObjectKind: 'set'
        // Render EntityInstanceList
        // Assert SetList is rendered (via Suspense + lazy)
    })
    it('delegates to EnumerationList for enumeration-compatible entity type', () => {
        // Mock entity type with legacyObjectKind: 'enumeration'
        // Assert EnumerationList is rendered
    })
    it('delegates to HubList for hub-compatible entity type', () => {
        // Mock entity type with legacyObjectKind: 'hub'
        // Assert HubList is rendered
    })
    it('renders generic entity list for custom types without legacyObjectKind', () => {
        // Mock entity type without legacyObjectKind
        // Assert generic entity list renders (no delegation)
    })
    it('keeps set navigation inside entity routes when kindKey is present', () => {
        // Verify links use /entities/:kindKey/instance/:id/constants
    })
    it('keeps enumeration navigation inside entity routes when kindKey is present', () => {
        // Verify links use /entities/:kindKey/instance/:id/values
    })
    it('keeps hub navigation inside entity routes when kindKey is present', () => {
        // Verify links remain in V2 route tree
    })
    it('sorts published menu items by sidebarOrder before title', () => {
        // Verify Hubs V2, Catalogs V2, Sets V2, Enumerations V2 order
    })
})
```

### Step 6.7: Run focused test suites

```bash
# Backend
pnpm --filter @universo/metahubs-backend test -- --run

# Frontend
pnpm --filter @universo/metahubs-frontend test -- --run
```

---

## Phase 7: Testing — E2E (Playwright)

### Step 7.1: Hub V2 lifecycle flow

**New file**: `tools/testing/e2e/specs/flows/metahub-entities-hub-v2.spec.ts`

```typescript
test('Hub V2: create entity type from preset → publish → sidebar → HubList delegation', async ({ page }) => {
    // 1. Navigate to Entities workspace
    // 2. Create new entity type from 'hub-v2' preset
    // 3. Verify entity type appears in the list with name "Hubs V2"
    // 4. Publish the entity type (toggle published flag)
    // 5. Verify dynamic sidebar link appears for Hub V2
    // 6. Click sidebar link → verify HubList surface renders
    // 7. Create a hub via the delegated HubList → verify persistence
    // 8. Verify legacy /hubs route still shows the same hub (shared data)
})
```

### Step 7.2: Set V2 lifecycle flow

**New file**: `tools/testing/e2e/specs/flows/metahub-entities-set-v2.spec.ts`

```typescript
test('Set V2: create entity type from preset → publish → sidebar → SetList delegation', async ({ page }) => {
    // Same pattern as Hub V2 but for sets
    // Verify set creation, constants management, shared data with legacy /sets
})
```

### Step 7.3: Enumeration V2 lifecycle flow

**New file**: `tools/testing/e2e/specs/flows/metahub-entities-enumeration-v2.spec.ts`

```typescript
test('Enumeration V2: create entity type from preset → publish → sidebar → EnumerationList delegation', async ({ page }) => {
    // Same pattern: preset → publish → sidebar → EnumerationList
    // Verify enumeration creation, value management, shared data with legacy /enumerations
})
```

### Step 7.4: V2 + Legacy coexistence flow

**New file**: `tools/testing/e2e/specs/flows/metahub-entities-v2-coexistence.spec.ts`

```typescript
test('V2 and legacy routes show the same data', async ({ page }) => {
    // Create a Hub V2 entity type and publish
    // Create a hub through the V2 delegated surface
    // Navigate to legacy /hubs route
    // Verify the same hub is visible
    // Repeat for sets and enumerations
})
```

### Step 7.5: Visual parity tests

**New file**: `tools/testing/e2e/specs/visual/metahub-entities-v2-parity.visual.spec.ts`

```typescript
test('Hub V2 delegated surface is pixel-identical to legacy HubList', async ({ page }) => {
    // Navigate to Hub V2 entity route
    // Screenshot A
    // Navigate to legacy /hubs
    // Screenshot B
    // Compare A and B (toMatchSnapshot or toHaveScreenshot)
})
// Repeat for Set V2 and Enumeration V2
```

### Step 7.6: Settings enforcement E2E

```typescript
test('copy button hidden when sets.allowCopy=false', async ({ page }) => {
    // Disable sets.allowCopy in settings
    // Navigate to Set V2 delegated surface
    // Verify copy action is not available
})
```

### Step 7.7: Application runtime full cycle (SPEC POINT #7)

> **QA note**: The original spec explicitly requires testing the full cycle through to application runtime. This step ensures V2 entities work not just in the workspace (authoring) but also in published applications.

**New file**: `tools/testing/e2e/specs/flows/metahub-entities-v2-runtime.spec.ts`

```typescript
test('V2 entities survive full publish-deploy-runtime cycle', async ({ page }) => {
    // 1. Create Hub V2, Set V2, Enum V2 entity types from presets
    // 2. Publish all three entity types
    // 3. Create instances via delegated surfaces:
    //    - Hub via HubList delegation
    //    - Set with constants via SetList delegation
    //    - Enumeration with values via EnumerationList delegation
    //    - Catalog via CatalogList delegation (already covered by Catalogs V2 flow)
    // 4. Publish a new application version
    // 5. Verify runtime schema deployment succeeded
    // 6. Open application runtime
    // 7. Verify catalogs appear as selectable runtime sections
    // 8. Verify hub/set/enum objects do NOT appear as runtime sections
    //    (filtered by RUNTIME_SECTION_FILTER_SQL)
    // 9. Verify runtime catalog/set/enumeration data includes shared attributes/constants/values
    //    (SnapshotSerializer.materializeSharedEntitiesForRuntime)
    // 10. Verify runtime row CRUD operations work for the published data
})

test('V2-created objects are indistinguishable from legacy in runtime', async ({ page }) => {
    // Create a catalog via Catalog V2 entity route delegation
    // Create a catalog via legacy Catalogs route
    // Publish → deploy → runtime
    // Verify both catalogs appear identically in runtime
    // Verify both are browseable in the runtime navigation
})
```

### Step 7.8: Entity-route ownership and sidebar order E2E verification

```typescript
test('V2 navigation stays inside entity routes and menu order matches spec', async ({ page }) => {
    // Verify left menu order is: Hubs V2, Catalogs V2, Sets V2, Enumerations V2
    // Open each V2 surface and navigate to a child page
    // Verify URLs remain under /entities/:kindKey/instance/:id/*
})
```

### Step 7.9: Hub widget binding E2E verification

```typescript
test('Hub V2 appears in menu widget hub bindings', async ({ page }) => {
    // Create Hub V2 entity type and a few Hub V2 instances
    // Open Layout -> MenuWidgetEditorDialog
    // Verify Hub V2 instances are selectable as hub bindings
})
```

---

## Phase 8: Documentation

### Step 8.1: Update EN custom-entity workflow guide

**File**: `docs/en/guides/custom-entities.md` (or similar)

Add section:
- "Creating Hubs V2, Sets V2, Enumerations V2 from presets"
- Component manifest differences between kinds
- Coexistence with legacy surfaces

### Step 8.2: Update RU custom-entity workflow guide

**File**: `docs/ru/guides/custom-entities.md`

Mirror EN changes in Russian.

### Step 8.3: Update package README

**File**: `packages/metahubs-frontend/base/README.md` and `packages/metahubs-backend/base/README.md`

Note the new delegation pattern and preset registration locations.

### Step 8.4: Run docs check

```bash
pnpm docs:i18n:check
```

---

## Phase 9: Fixture & Snapshot Regeneration

### Step 9.1: Update fixture contract

**File**: `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`

Add exported constants for the new V2 entity types:

```javascript
export const SELF_HOSTED_APP_HUB_V2_ENTITY_TYPE = {
    templateCodename: 'hub-v2',
    kindKey: 'custom.hub-v2',
    nameEn: 'Hubs V2',
}
export const SELF_HOSTED_APP_SET_V2_ENTITY_TYPE = {
    templateCodename: 'set-v2',
    kindKey: 'custom.set-v2',
    nameEn: 'Sets V2',
}
export const SELF_HOSTED_APP_ENUMERATION_V2_ENTITY_TYPE = {
    templateCodename: 'enumeration-v2',
    kindKey: 'custom.enumeration-v2',
    nameEn: 'Enumerations V2',
}
```

### Step 9.2: Regenerate snapshot fixture

Run the Playwright generator to regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with the 3 new entity types included.

### Step 9.3: Verify snapshot import/export round-trip

Run existing snapshot E2E tests to verify the new entity types are correctly serialized and restored:

```bash
pnpm --filter @universo/utils test -- --run src/snapshot/__tests__/snapshotArchive.test.ts
```

---

## Phase 10: Final Validation & Build

### Step 10.1: Run focused package builds

```bash
pnpm --filter @universo/types build
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-frontend build
```

### Step 10.2: Run focused test suites

```bash
pnpm --filter @universo/metahubs-backend test -- --run
pnpm --filter @universo/metahubs-frontend test -- --run
```

### Step 10.3: Run focused lint

```bash
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/metahubs-frontend lint
```

### Step 10.4: Run canonical full build

```bash
pnpm build
```

Confirm: all `30 successful`, `30 total`.

### Step 10.5: Run E2E suite

```bash
pnpm run build:e2e
npx playwright test --project chromium tools/testing/e2e/specs/flows/metahub-entities-*.spec.ts
```

---

## Potential Challenges

### Challenge 1: HubList route dependency

**Risk**: `HubList` may read `parentHubId` from route params that don't exist under the entity route.

**Mitigation**: Check `HubList` source for `useParams()` usage. If it reads hub-specific route params, wrap it in a thin adapter that passes default values via props.

### Challenge 2: SetList / EnumerationList import cycles

**Risk**: Lazy-importing these components through the delegation map may create circular import chains.

**Mitigation**: Use `lazy(() => import(...))` which breaks the synchronous import cycle. Verify by building the `metahubs-frontend` package.

### Challenge 3: Settings seeder idempotency

**Risk**: Existing metahubs may not have V2-related settings pre-seeded.

**Mitigation**: The settings registry in `metahubs.ts` already defines all required settings (`hubs.allowCopy/Delete`, `sets.allowCopy/Delete`, `enumerations.allowCopy/Delete`), and the seeder uses `INSERT ... ON CONFLICT DO NOTHING`. Verified during QA — no additional seeding work required.

### Challenge 4: Hub V2 widget binding

**Risk**: The `MenuWidgetEditorDialog` hub picker and related selectors currently assume legacy hubs only.

**Mitigation**: Generalize hub selectors and hub list APIs through compatibility-aware kind resolution so hub-compatible custom kinds are selectable without introducing a parallel V2-only widget-binding flow.

---

## Design Decisions

### DD1: Canonical storage stays on custom `kindKey`

**Decision**: Legacy-compatible V2 objects keep their custom `kindKey` in `_mhb_objects.kind`.

**Rationale**:
1. `EntityTypeService`, `entityInstancesController`, and entity-route list filters all resolve custom types by `kindKey`.
2. Rewriting stored kinds to legacy literals would break generic custom entity routes and create mixed-storage inconsistencies.
3. The correct abstraction boundary is compatibility metadata (`legacyObjectKind`), not data mutation during persistence.

### DD2: Legacy-compatible V2 surfaces reuse legacy controllers and legacy UI

**Decision**: The authoritative authoring surface for Hubs V2, Catalogs V2, Sets V2, and Enumerations V2 remains the proven legacy list/detail stack, widened through compatibility helpers and route adapters.

**Rationale**:
1. Catalogs V2 already establish this pattern successfully.
2. It avoids inventing duplicate CRUD screens and keeps the product visually and behaviorally uniform.
3. It reuses existing `EntityFormDialog`, list tables, cards, delete dialogs, and template-mui primitives instead of creating a second V2-only shell.

### DD3: Sidebar order must be explicit metadata, not alphabetical fallback

**Decision**: Add optional `ui.sidebarOrder` and sort published menu items by `sidebarOrder ASC, title ASC`.

**Rationale**:
1. The original specification requires exact order: `Хабы V2`, `Каталоги V2`, `Наборы V2`, `Перечисления V2`.
2. Alphabetical `kind_key` sorting does not satisfy that requirement.
3. Metadata-driven order scales cleanly beyond these four presets and avoids naming hacks.

### DD4: Runtime/publication/schema seams must resolve compatibility metadata

**Decision**: `SnapshotSerializer`, `runtimeRowsController`, `SchemaGenerator`, dashboard counts, hub services, and widget integrations must classify legacy-compatible custom kinds via compatibility metadata.

**Rationale**: These seams currently branch by exact kind and would silently exclude or misclassify V2 data if left unchanged.

---

## Files Changed Summary

### Modified Files (~16)

| File | Change |
|---|---|
| `catalogCompatibility.ts` (or new `legacyCompatibility.ts`) | Extract generic compatibility helpers beyond catalog-only logic |
| `entityInstancesController.ts` | Replace hardcoded settings/ACL with generic resolution |
| `hubsController.ts` | Add hub-compatible custom kind support |
| `setsController.ts` | Add set-compatible custom kind support |
| `enumerationsController.ts` | Add enumeration-compatible custom kind support |
| `MetahubHubsService.ts` | Generalize hub queries for compatible custom kinds |
| `MetahubBranchesService.ts` | Generalize hub/set/enumeration branch copy/prune flows |
| `MetahubSettingsService.ts` | Generalize hub-scoped propagation to compatible hub kinds |
| `metahubsController.ts` | Generalize dashboard counts for compatible custom kinds |
| `SnapshotSerializer.ts` | Generalize shared entity merging and special-kind filtering |
| `runtimeRowsController.ts` | Replace exact-kind runtime section filtering |
| `SchemaGenerator.ts` | Generalize set-compatible constant target handling |
| `templates/data/index.ts` | Register 3 new presets |
| `EntityInstanceList.tsx` | Replace catalog-only delegation with kind-registry map |
| `HubList.tsx`, `SetList.tsx`, `EnumerationList.tsx` | Preserve V2 route ownership via shared route builders |
| `MenuWidgetEditorDialog.tsx` | Generalize hub widget binding for Hub V2 |
| `entityTypeDefinition.ts`, `menuConfigs.ts`, `MenuContent.tsx`, `EntitiesWorkspace.tsx` | Add and consume `ui.sidebarOrder` |
| `en/metahubs.json` | Add EN i18n keys for preset names/descriptions |
| `ru/metahubs.json` | Add RU i18n keys for preset names/descriptions |
| `selfHostedAppFixtureContract.mjs` | Add V2 entity type constants |
| `metahubs-self-hosted-app-snapshot.json` | Regenerated with V2 entity types |

### New Files (~8)

| File | Purpose |
|---|---|
| `packages/metahubs-backend/base/src/domains/templates/data/hub-v2.entity-preset.ts` | Hub V2 preset manifest |
| `packages/metahubs-backend/base/src/domains/templates/data/set-v2.entity-preset.ts` | Set V2 preset manifest |
| `packages/metahubs-backend/base/src/domains/templates/data/enumeration-v2.entity-preset.ts` | Enumeration V2 preset manifest |
| `packages/metahubs-frontend/base/src/domains/entities/ui/entityInstanceDelegates.ts` | Kind-registry delegation map |
| `packages/metahubs-frontend/base/src/domains/hubs/ui/hubRoutePaths.ts` | Hub V2 route ownership helpers |
| `packages/metahubs-frontend/base/src/domains/sets/ui/setRoutePaths.ts` | Set V2 route ownership helpers |
| `packages/metahubs-frontend/base/src/domains/enumerations/ui/enumerationRoutePaths.ts` | Enumeration V2 route ownership helpers |
| optional `legacyCompatibility.ts` | Shared backend compatibility registry |

### New Test Files (~9)

| File | Purpose |
|---|---|
| Backend compatibility tests | Unit tests for settings/ACL resolution + compatibility-kind resolution |
| Backend legacy controller compatibility tests | Verify legacy controllers include compatible custom kinds |
| Runtime/schema compatibility tests | Verify SnapshotSerializer, runtime filter, and schema generation seams |
| Backend preset validation tests | Component dependency + manifest validation |
| Frontend delegation tests | RTL tests for kind-registry delegation and route ownership |
| E2E Hub/Set/Enum V2 workspace flows | Playwright lifecycle tests |
| E2E V2 runtime full-cycle tests | Playwright publish→deploy→runtime verification |
| E2E sidebar-order tests | Verify exact V2 menu ordering |
| E2E hub-widget-binding tests | Verify Hub V2 integration into layout widget bindings |
| E2E visual parity tests | Screenshot comparison tests |

---

## Task Checklist

- [ ] **Phase 1**: Extract `resolveLegacySettingsPrefix()` + `resolveLegacyAclPermission()`
- [ ] **Phase 1**: Generalize `entityInstancesController` settings enforcement
- [ ] **Phase 1**: Generalize `entityInstancesController` ACL resolution
- [ ] **Phase 1**: Generalize blocking-reference resolution
- [ ] **Phase 1**: Introduce a shared compatibility registry for legacy-compatible custom kinds
- [ ] **Phase 1**: Generalize hubs/sets/enumerations controllers for compatible custom kinds
- [ ] **Phase 1**: Generalize hub/branch/settings/dashboard service seams for compatible custom kinds
- [ ] **Phase 1**: Generalize SnapshotSerializer, runtimeRowsController, and SchemaGenerator compatibility seams
- [ ] **Phase 2**: Create `entityInstanceDelegates.ts` kind-registry map
- [ ] **Phase 2**: Replace `EntityInstanceList` catalog-only delegation with generic map
- [ ] **Phase 2**: Add route-path adapters for Hub/Set/Enumeration V2 surfaces
- [ ] **Phase 2**: Keep HubList/SetList/EnumerationList navigation inside entity routes
- [ ] **Phase 2**: Generalize widget/selectors for compatible hubs
- [ ] **Phase 2**: Add `ui.sidebarOrder` metadata and published-menu sorting
- [ ] **Phase 3**: Create `hub-v2.entity-preset.ts`
- [ ] **Phase 3**: Create `set-v2.entity-preset.ts`
- [ ] **Phase 3**: Create `enumeration-v2.entity-preset.ts`
- [ ] **Phase 3**: Update existing `catalog-v2` preset with sidebar order metadata
- [ ] **Phase 3**: Register presets in `templates/data/index.ts`
- [ ] **Phase 4**: Verify existing settings coverage (all already exist — no creation)
- [ ] **Phase 4**: Verify `useEntityPermissions` works for new settings
- [ ] **Phase 5**: Add EN i18n keys for preset names/descriptions
- [ ] **Phase 5**: Add RU i18n keys for preset names/descriptions
- [ ] **Phase 5**: Run `pnpm docs:i18n:check`
- [ ] **Phase 6**: Write backend settings/ACL resolution unit tests
- [ ] **Phase 6**: Write backend legacy controller compatibility integration tests
- [ ] **Phase 6**: Write backend entity route settings enforcement integration tests
- [ ] **Phase 6**: Write backend runtime/schema compatibility tests
- [ ] **Phase 6**: Write backend preset validation tests
- [ ] **Phase 6**: Write frontend delegation/route-ownership/menu-order RTL tests
- [ ] **Phase 6**: Run focused backend + frontend test suites
- [ ] **Phase 7**: Write Hub V2 Playwright lifecycle flow
- [ ] **Phase 7**: Write Set V2 Playwright lifecycle flow
- [ ] **Phase 7**: Write Enumeration V2 Playwright lifecycle flow
- [ ] **Phase 7**: Write V2+Legacy coexistence Playwright flow
- [ ] **Phase 7**: Write visual parity Playwright tests
- [ ] **Phase 7**: Write settings enforcement E2E tests
- [ ] **Phase 7**: Write application runtime full-cycle E2E tests
- [ ] **Phase 7**: Write entity-route ownership and sidebar-order E2E verification
- [ ] **Phase 7**: Write hub widget binding E2E verification
- [ ] **Phase 8**: Update EN docs
- [ ] **Phase 8**: Update RU docs
- [ ] **Phase 8**: Update package READMEs
- [ ] **Phase 9**: Update fixture contract + regenerate snapshot
- [ ] **Phase 9**: Verify snapshot round-trip
- [ ] **Phase 10**: Focused builds + tests + lint
- [ ] **Phase 10**: Canonical `pnpm build` green
- [ ] **Phase 10**: E2E suite green
