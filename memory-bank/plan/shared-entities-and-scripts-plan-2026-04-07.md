# Plan: Shared/Global Entities & Enhanced Scripting

> **Created**: 2026-04-07
> **Revised**: 2026-04-08 (implementation closure sync after final QA)
> **Status**: Implemented and validated across all 8 phases
> **Complexity**: Level 4+ (Major/Complex, cross-cutting)
> **Creative ref**: [creative-shared-entities-architecture.md](../creative/creative-shared-entities-architecture.md)
> **Research ref**: [creative-metahub-scripting-extension-system.md](../creative/creative-metahub-scripting-extension-system.md)
> **Note**: Historical `.backup/...` scripting research files referenced in the original request are not present in the current workspace, so this plan does not depend on unverifiable local backup materials.
> **Closure note**: This file is retained as the original implementation plan. The unchecked boxes below are historical planning artifacts; live completion state now lives in `tasks.md`, `progress.md`, and the shipped validation artifacts.

---

## Overview

Extend the Metahub "Common" / "Общие" section with new tabs for managing shared (global) entities: **Attributes**, **Constants**, **Values**, and **Scripts**. Shared entities auto-propagate to all corresponding target objects (catalogs/sets/enumerations) with per-entity exclusion rules and behavioral settings (can exclude, position locking). Enhance the scripting system with "shared library" scripts importable via `@shared/<codename>`. Add deep E2E, unit/integration test coverage and full i18n bilingual documentation.

**Key architectural decision**: Virtual container objects in `_mhb_objects` with well-known `kind` values (e.g., `shared-catalog-pool`). Zero schema changes to existing entity tables; maximum CRUD reuse; separate `_mhb_shared_entity_overrides` table for per-target exclusion, active-state, and sort overrides. This mirrors the proven widget inheritance pattern where catalog layouts already use `_mhb_catalog_widget_overrides` for per-target behavior. Widget exclusion in catalog layouts uses existing `_mhb_catalog_widget_overrides.is_deleted_override` with behavioral gating from `config.sharedBehavior`. Runtime publication flattens shared entities into ordinary `_app_*` rows.

---

## Affected Packages

| Package | Scope |
|---------|-------|
| `@universo/types` | New shared object kinds, `SharedBehavior` type, script attachment/role enums |
| `@universo/utils` | Snapshot hash normalization for new sections, merged list helpers |
| `metahubs-backend` | Virtual container service, exclusions CRUD, shared entity query patterns, script compilation order |
| `metahubs-frontend` | GeneralPage tabs, shell-less list content components, exclusions UI, visual badges/dividers |
| `applications-backend` | Runtime materialization of shared entities into `_app_*` rows, shared script sync |
| `apps-template-mui` | Visual indicators for shared attributes in columns (badge), inherited widget enhanced styling |
| `extension-sdk` | `SharedLibraryScript` marker base class, library templates, library-role documentation |
| `scripting-engine` | `@shared/<codename>` import resolver in esbuild plugin |
| `universo-i18n` | New i18n keys for shared entity UIs (en + ru) |
| `schema-ddl` | `_mhb_shared_entity_overrides` table migration definition |
| `universo-migrations-platform` | Register new shared entity overrides migration |
| `docs/` | Full bilingual GitBook documentation for shared entities and scripting |
| `tools/testing/e2e` | Playwright E2E tests for complete workflow |
| `tools/fixtures` | Regenerated self-hosted fixture with shared entities |

---

## Plan Steps

### Phase 1: Foundation — Types, Schema, Backend Core

#### Step 1.1: Shared Types in `@universo/types`

**File**: `packages/universo-types/base/src/common/scripts.ts`

- [ ] Add `'general'` to `SCRIPT_ATTACHMENT_KINDS`
- [ ] Replace existing `'global'` role with `'library'` in `SCRIPT_MODULE_ROLES` (do NOT keep both; they overlap semantically and the user explicitly does not want legacy preservation)
- [ ] Update `SCRIPT_ALLOWED_CAPABILITIES_BY_ROLE` and `SCRIPT_DEFAULT_CAPABILITIES_BY_ROLE` for `library` role
- [ ] Update any frontend/i18n/guidance strings that still refer to `'global'` script role so the role model stays unambiguous

**New file**: `packages/universo-types/base/src/common/shared.ts`

```typescript
// Virtual container object kinds for shared entities
export const SHARED_OBJECT_KINDS = {
  SHARED_CATALOG_POOL: 'shared-catalog-pool',
  SHARED_SET_POOL: 'shared-set-pool',
  SHARED_ENUM_POOL: 'shared-enumeration-pool',
} as const

export type SharedObjectKind = (typeof SHARED_OBJECT_KINDS)[keyof typeof SHARED_OBJECT_KINDS]

export const SHARED_ENTITY_KINDS = ['attribute', 'constant', 'value'] as const
export type SharedEntityKind = (typeof SHARED_ENTITY_KINDS)[number]

// Mapping: shared object kind → target entity kind
export const SHARED_POOL_TO_ENTITY_KIND: Record<SharedObjectKind, SharedEntityKind> = {
  'shared-catalog-pool': 'attribute',
  'shared-set-pool': 'constant',
  'shared-enumeration-pool': 'value',
}

// Mapping: shared object kind → target regular object kind
export const SHARED_POOL_TO_TARGET_KIND: Record<SharedObjectKind, string> = {
  'shared-catalog-pool': 'catalog',
  'shared-set-pool': 'set',
  'shared-enumeration-pool': 'enumeration',
}

// Behavior settings per shared entity
// NOTE: target-specific inactive state is stored in _mhb_shared_entity_overrides.is_active.
// This enables the original requirement: shared entities remain part of publication data,
// but inactive target instances are not materialized into runtime fields/columns.
export interface SharedBehavior {
  canDeactivate?: boolean   // default: true — can be made inactive in target object
  canExclude?: boolean      // default: true — can be excluded from target
  positionLocked?: boolean  // default: false — locked at top, non-draggable
}

export const DEFAULT_SHARED_BEHAVIOR: Required<SharedBehavior> = {
  canDeactivate: true,
  canExclude: true,
  positionLocked: false,
}

export function resolveSharedBehavior(raw?: Partial<SharedBehavior>): Required<SharedBehavior> {
  return { ...DEFAULT_SHARED_BEHAVIOR, ...raw }
}
```

- [ ] Export from `packages/universo-types/base/src/index.ts`
- [ ] Build `@universo/types`

#### Step 1.2: System Table Definition — `_mhb_shared_entity_overrides`

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`

- [ ] Add `mhbSharedEntityOverrides` table definition:

```typescript
const mhbSharedEntityOverrides: SystemTableDef = {
  name: '_mhb_shared_entity_overrides',
  description: 'Per-target overrides for shared/global entities',
  columns: [
    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
    { name: 'entity_kind', type: 'string', length: 20, nullable: false },
    { name: 'shared_entity_id', type: 'uuid', nullable: false },
    { name: 'target_object_id', type: 'uuid', nullable: false },
    { name: 'is_excluded', type: 'boolean', nullable: false, defaultTo: false },
    { name: 'is_active', type: 'boolean', nullable: true },
    { name: 'sort_order', type: 'integer', nullable: true },
    // Include standard _upl_* and _mhb_* system fields
  ],
  foreignKeys: [
    {
      column: 'target_object_id',
      referencesTable: '_mhb_objects',
      referencesColumn: 'id',
      onDelete: 'CASCADE',
    },
  ],
  indexes: [
    {
      name: 'uidx_mhb_shared_entity_overrides_unique',
      columns: ['entity_kind', 'shared_entity_id', 'target_object_id'],
      unique: true,
      where: '_upl_deleted = false AND _mhb_deleted = false',
    },
    { name: 'idx_mhb_shared_entity_overrides_target', columns: ['target_object_id'] },
    { name: 'idx_mhb_shared_entity_overrides_entity', columns: ['entity_kind', 'shared_entity_id'] },
  ],
}
```

- [ ] Add `mhbSharedEntityOverrides` to `SYSTEM_TABLES` array
- [ ] No version bump — DB will be recreated
- [ ] **Note**: Storage location for `sharedBehavior`:
  - **Attributes**: `ui_config.sharedBehavior` (JSONB column already exists)
  - **Constants**: `ui_config.sharedBehavior` (JSONB column already exists)
  - **Values**: `presentation.sharedBehavior` (`_mhb_values` has only `presentation` JSONB — no `ui_config`/`config` columns). Trade-off accepted: mixing behavior data into the presentation JSONB avoids schema changes; the `sharedBehavior` key is namespaced and does not collide with existing `name`/`description` VLC keys in `presentation`
  - **Per-target state**: inactive / excluded / per-target sort live in `_mhb_shared_entity_overrides`, not in the entity rows themselves

#### Step 1.3: Virtual Container Object Service

**New file**: `packages/metahubs-backend/base/src/domains/shared/services/SharedContainerService.ts`

```typescript
import { SHARED_OBJECT_KINDS, type SharedObjectKind } from '@universo/types'

export class SharedContainerService {
  /**
   * Resolve or lazily create the virtual container object for a given shared kind.
   * Returns the container's UUID.
   */
  async resolveContainerObjectId(
    metahubId: string,
    sharedKind: SharedObjectKind,
    executor: SqlQueryable,
    userId?: string
  ): Promise<string> {
    // SELECT id FROM {schema}._mhb_objects
    // WHERE kind = $1 AND _upl_deleted = false AND _mhb_deleted = false LIMIT 1
    // If not found: INSERT with well-known codename/presentation
  }

  /** List all shared container object IDs for a metahub (for filtering from regular object lists). */
  async getContainerObjectIds(
    metahubId: string,
    executor: SqlQueryable
  ): Promise<string[]> { /* ... */ }
}
```

- [ ] Integrate with existing `MetahubObjectsService.findAllByKind()` to filter OUT virtual containers
- [ ] Add `isVirtualContainer` check to `MetahubObjectsService` query helpers
- [ ] Extend anti-leak filtering beyond regular object lists: exclude virtual containers from object pickers, summary/count queries, copy/move selectors, and public object-search responses so internal containers never surface in UX or API payloads
- [ ] Add advisory lock during container creation to prevent race conditions

#### Step 1.4: Shared Entity Overrides Service

**New file**: `packages/metahubs-backend/base/src/domains/shared/services/SharedEntityOverridesService.ts`

```typescript
export class SharedEntityOverridesService {
  /** List all per-target overrides for a specific shared entity. */
  async findBySharedEntity(metahubId: string, entityKind: string, sharedEntityId: string): Promise<SharedEntityOverrideRow[]>

  /** List all shared overrides that affect a target object. */
  async findByTargetObject(metahubId: string, entityKind: string, targetObjectId: string): Promise<SharedEntityOverrideRow[]>

  /** Upsert target-specific override state (exclude / active / sort). */
  async upsertOverride(params: {
    metahubId: string
    entityKind: string
    sharedEntityId: string
    targetObjectId: string
    isExcluded?: boolean
    isActive?: boolean | null
    sortOrder?: number | null
  }): Promise<void>

  /** Remove override row when target returns to default inherited behavior. */
  async clearOverride(metahubId: string, entityKind: string, sharedEntityId: string, targetObjectId: string): Promise<void>

  /** Clean orphan overrides when a shared entity is deleted. */
  async cleanupForDeletedEntity(metahubId: string, entityKind: string, sharedEntityId: string): Promise<void>
}
```

- [ ] On every override mutation, load the base entity's `sharedBehavior` and reject `isExcluded = true` when `canExclude === false`, `isActive = false` when `canDeactivate === false`, and `sortOrder` mutations when `positionLocked === true`
- [ ] Return clear 403/validation errors from the backend service/controller; frontend gating is advisory only

#### Step 1.5: Shared Entity Overrides Controller (REST API)

**New file**: `packages/metahubs-backend/base/src/domains/shared/controllers/sharedEntityOverridesController.ts`

Endpoints:
- [ ] `GET /metahubs/:metahubId/shared-entity-overrides?entityKind=attribute&sharedEntityId=:id` → list per-target overrides for one shared entity
- [ ] `GET /metahubs/:metahubId/shared-entity-overrides?entityKind=attribute&targetObjectId=:id` → list overrides affecting one target object
- [ ] `PATCH /metahubs/:metahubId/shared-entity-overrides` → upsert `{ isExcluded, isActive, sortOrder }` for a target object
- [ ] `DELETE /metahubs/:metahubId/shared-entity-overrides?entityKind=attribute&sharedEntityId=:id&targetObjectId=:targetId` → clear override row back to inherited default

**Zod schemas:**
```typescript
const upsertSharedEntityOverrideSchema = z.object({
  entityKind: z.enum(SHARED_ENTITY_KINDS),
  sharedEntityId: z.string().uuid(),
  targetObjectId: z.string().uuid(),
  isExcluded: z.boolean().optional(),
  isActive: z.boolean().nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
})
```

#### Step 1.6: Merged Entity List Helpers (`@universo/utils` or `metahubs-backend`)

**New file**: `packages/metahubs-backend/base/src/domains/shared/helpers/mergedEntityHelpers.ts`

```typescript
/**
 * Build merged attribute list for a catalog:
 * = shared attributes (from shared-catalog-pool, honoring target overrides) + local attributes
 * Shared entities expose effective `isActive`, `isExcluded`, `isShared`, and `sharedBehavior` state.
 *
 * IMPORTANT:
 * - locked shared entities stay in the locked top zone ordered by base shared sort_order
 * - unlocked shared entities can mix with local entities using per-target override sort_order
 * - inactive shared entities stay visible in design-time merged lists but are skipped during runtime materialization
 */
export async function buildMergedAttributeList(
  executor: SqlQueryable,
  schemaName: string,
  catalogObjectId: string,
  sharedContainerObjectId: string,
  options?: { includeInactive?: boolean }
): Promise<MergedAttribute[]> {
  // LEFT JOIN shared rows to _mhb_shared_entity_overrides on (entity_kind, shared_entity_id, target_object_id)
  // Filter out rows with override.is_excluded = true
  // Compute effective active state from override.is_active ?? true
  // Compute effective sort order:
  //   - if sharedBehavior.positionLocked === true -> locked zone at top ordered by base sort_order
  //   - else use override.sort_order ?? base sort_order and mix with local rows in the normal zone
  // Reorder APIs must update either entity.sort_order (local rows) or override.sort_order (shared unlocked rows)
}
```

- [ ] Keep merged-list helpers N+1-free: one merged SQL/CTE query per entity type plus joins against `_mhb_shared_entity_overrides`, not per-shared-row follow-up queries
- [ ] Equivalent helpers for constants (sets) and values (enumerations)

#### Step 1.7: Unit Tests for Phase 1

- [ ] `SharedContainerService` unit tests: create, resolve, idempotency, race condition, and anti-leak coverage for list/picker/count seams
- [ ] `SharedEntityOverridesService` unit tests: upsert/clear/list/cleanup plus forbidden exclude/deactivate/reorder mutations when `sharedBehavior` disables them
- [ ] Merged entity helper tests: exclusion applied, inactive state exposed, locked-zone ordering, mixed unlocked ordering, divider index, and no N+1 regression for representative shared/local mixes
- [ ] `resolveSharedBehavior()` tests: defaults, partial overrides, full overrides

---

### Phase 2: Frontend — GeneralPage Tabs & Shared Entity CRUD

#### Step 2.1: i18n Keys

**Files**: `packages/universo-i18n/base/src/locales/en.json`, `ru.json`

- [ ] Add keys under `metahubs.general.tabs.*`:
  - `attributes` / `Attributes` / `Атрибуты`
  - `constants` / `Constants` / `Константы`
  - `values` / `Values` / `Значения`
  - `scripts` / `Scripts` / `Скрипты`
- [ ] Add keys for shared entity chips, divider, behavior settings:
  - `shared.chip` / `Shared` / `Общий`
  - `shared.localDivider` / `Local` / `Локальные`
  - `shared.behavior.canDeactivate` / `Can be deactivated` / `Можно сделать неактивным`
  - `shared.behavior.canExclude` / `Can be excluded` / `Можно исключить`
  - `shared.behavior.positionLocked` / `Position locked` / `Позиция закреплена`
  - `shared.inactiveBadge` / `Inactive` / `Неактивно`
  - `shared.exclusions.title` / `Exclusions` / `Исключения`
  - `shared.exclusions.addCatalog` / `Add catalog exclusion` / `Добавить исключение каталога`
  - ...analogous for sets, enums

#### Step 2.2: Extract Shell-Less Content from Existing Lists

Following the `LayoutList` → `LayoutListContent` extraction pattern:

- [ ] **AttributeList.tsx**: Extract `AttributeListContent` that accepts `objectId`, `metahubId`, `renderPageShell` props
- [ ] **SetList.tsx → ConstantListContent**: *(Note: existing SetList manages constants/set items)* Extract `ConstantListContent`
- [ ] **EnumerationValueList.tsx → ValueListContent**: Extract `ValueListContent`
- [ ] Each *Content component receives the virtual container's `objectId` and renders the same table/toolbar as the regular list, with `isShared` context for visual indicators

#### Step 2.3: Extend GeneralPage with New Tabs

**File**: `packages/metahubs-frontend/base/src/domains/general/ui/GeneralPage.tsx`

```typescript
type GeneralTab = 'layouts' | 'attributes' | 'constants' | 'values' | 'scripts'
```

- [ ] Add `useSharedContainerIds(metahubId)` hook that calls backend to resolve/create container object IDs for all three shared kinds
- [ ] Render 5 tabs with conditional content
- [ ] Each content component receives `sharedContainerObjectId` from the hook
- [ ] Scripts tab renders `EntityScriptsTab` filtered by `attachedToKind='general'`

#### Step 2.4: "Exclusions" Tab in Shared Entity Dialogs

In the create/edit/copy dialog for shared entities (attributes/constants/values in the Common section):

- [ ] Add new tab `'exclusions'` — follow the `HubSelectionPanel` pattern
- [ ] `ExclusionPanel` component: shows list of target objects with checkboxes (catalogs for attributes, sets for constants, enumerations for values)
- [ ] Queries available target objects from `MetahubObjectsService.findAllByKind()`
- [ ] Selected objects = excluded targets
- [ ] On save: batch sync `isExcluded` override state via `SharedEntityOverridesService`

```tsx
<ExclusionPanel
  metahubId={metahubId}
  entityKind="attribute"
  sharedEntityId={entityId}
  targetObjectKind="catalog"
  excludedObjectIds={excludedCatalogIds}
  onExclusionChange={(newIds) => setValue('excludedCatalogIds', newIds)}
/>
```

#### Step 2.5: Behavior Settings in Shared Entity Dialogs

In the create/edit/copy dialog for shared entities, add to "General" tab or separate "Settings" tab:

- [ ] Three toggle switches:
  - `canDeactivate` (default: ON) — target object may mark the shared entity inactive without deleting it
  - `canExclude` (default: ON) — `Switch` with label
  - `positionLocked` (default: OFF) — `Switch` with label
- [ ] Stored in `ui_config.sharedBehavior` (attributes/constants) or `presentation.sharedBehavior` (values)
- [ ] Validated with Zod on save

```tsx
<FormControlLabel
  control={<Switch checked={sharedBehavior.canDeactivate} onChange={...} />}
  label={t('shared.behavior.canDeactivate', 'Can be deactivated')}
/>
<FormControlLabel
  control={<Switch checked={sharedBehavior.canExclude} onChange={...} />}
  label={t('shared.behavior.canExclude', 'Can be excluded')}
/>
<FormControlLabel
  control={<Switch checked={sharedBehavior.positionLocked} onChange={...} />}
  label={t('shared.behavior.positionLocked', 'Position locked')}
/>
```

#### Step 2.6: Frontend Unit Tests for Phase 2

- [ ] `GeneralPage` test: all 5 tabs render, tab switching works
- [ ] `SharedAttributeListContent` test: renders shared attributes with badge and divider
- [ ] `ExclusionPanel` test: renders target objects, toggle exclusion, submit
- [ ] Shared behavior settings tests: defaults, toggle, persist

---

### Phase 3: Shared Entities in Target Object Lists (Visual Merge)

#### Step 3.1: Backend — Merged Entity API Endpoints

Either extend existing attribute/constant/value list endpoints or add new endpoints:

**Option (recommended)**: Extend existing `GET /metahubs/:metahubId/objects/:objectId/attributes` with `?includeShared=true`

- [ ] When `includeShared=true`, backend uses `buildMergedAttributeList()` to return a unified list
- [ ] Each item has `isShared: boolean` and `sharedBehavior?: SharedBehavior` in the response
- [ ] Each item also exposes effective target state: `isActive`, `isExcluded`, `effectiveSortOrder`
- [ ] Ordering model:
  - locked shared rows always remain in the locked top zone ordered by base shared sort_order
  - unlocked shared rows can mix with local rows according to per-target effective sort order
- [ ] Apply exclusion and inactive overrides automatically
- [ ] Override/reorder mutations must enforce `sharedBehavior` again on the backend (403 on forbidden exclude/deactivate/reorder), not only hide UI actions
- [ ] Extend reorder endpoints to accept mixed lists and update either local entity `sort_order` or shared override `sort_order`
- [ ] Same pattern for constants and values endpoints

#### Step 3.2: Frontend — Visual Shared Entity Rendering in Target Lists

**Shared reusable component**: `SharedEntityBadge`

Follow the existing inherited-widget badge pattern from `LayoutDetails.tsx` (styled `<Box>` with `borderRadius: 999`) rather than MUI `<Chip>`. This keeps the visual language consistent for all "this item is not local to this object" indicators:

```tsx
const SharedEntityBadge = () => {
  const { t } = useTranslation('metahubs')
  return (
    <Box
      component="span"
      sx={{ px: 0.75, py: 0.25, ml: 1, borderRadius: 999, bgcolor: 'action.hover',
            color: 'text.secondary', fontSize: 11, whiteSpace: 'nowrap' }}
    >
      {t('shared.chip', 'Shared')}
    </Box>
  )
}
```

- [ ] In `AttributeList` / `ConstantList` / `EnumerationValueList`:
  - Add background tint for shared rows: `alpha(theme.palette.info.main, 0.04)`
  - Add `SharedEntityBadge` next to entity name for shared rows
  - Add explicit inactive indicator for shared rows with effective `isActive === false`
  - Add visual divider between last shared row and first local row
  - Respect `positionLocked`: disable drag handle for locked shared entities
  - Respect `canDeactivate`: show inactive toggle only if `canDeactivate`
  - Respect `canExclude`: show "Exclude from this catalog" action if `canExclude`
  - Disable "Delete" for shared entities — they can only be deleted from Common section

#### Step 3.3: Inherited Widget Enhanced Styling in Catalog Layouts

**File**: `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutDetails.tsx`

- [ ] Apply same visual treatment to inherited widgets:
  - Background tint: `alpha(theme.palette.info.main, 0.04)`
  - "Inherited" badge (already exists — ensure styling consistency with `SharedEntityBadge`)
- [ ] Add `sharedBehavior` settings to widget creation dialog in global Layouts:
  - `canDeactivate`, `canExclude`, `positionLocked` toggles (same `SharedBehavior` contract as shared entities)
- [ ] Store in widget `config.sharedBehavior`
- [ ] **Widget exclusion uses existing `is_deleted_override`**: The `_mhb_catalog_widget_overrides` table already has `is_deleted_override` (boolean, NOT NULL, default false) which hides inherited widgets from catalog layouts. Do NOT add a new `is_excluded_override` column or try to reuse `_mhb_shared_entity_overrides` for widgets. Instead:
  - Read `config.sharedBehavior.canExclude` from the base widget to gate the "Exclude" action
  - The "Exclude" action sets `is_deleted_override = true` in `_mhb_catalog_widget_overrides`
  - The "Include back" action sets `is_deleted_override = false`

#### Step 3.4: Frontend/Backend Unit Tests for Phase 3

- [ ] Merged attribute list API test: returns shared + local with markers
- [ ] Exclusion filter API test: excluded shared entities absent from merged list
- [ ] Inactive override API test: inactive shared entities stay in merged design-time list with `isActive=false`
- [ ] Visual rendering tests: badge, background tint, inactive marker, divider rendering
- [ ] DnD constraint tests: locked shared entities not draggable; unlocked shared entities can mix with local rows
- [ ] Widget inheritance visual tests: background + badge consistency

---

### Phase 4: Shared Scripts — Library Role & `@shared/` Import

#### Step 4.1: Types and Backend Configuration

- [ ] Update `SCRIPT_ATTACHMENT_KINDS` in `@universo/types` (done in Step 1.1)
- [ ] Replace `global` with `library` in `SCRIPT_MODULE_ROLES`, script-role guidance, UI role selectors, i18n keys, and backend validation so there is one clear read-only reusable-code role
- [ ] Normalize persisted `moduleRole='global'` records to `library` on read/write/publication so there is no shadow legacy role at runtime
- [ ] Ensure `library` role defaults/capabilities fail closed and the frontend pristine role-switch path resets capabilities from `resolveDefaultScriptCapabilities(nextRole)` instead of carrying over stale executable permissions
- [ ] Update backend script controller Zod schemas to accept `'general'` as `attachedToKind` and `'library'` as `moduleRole`
- [ ] Define and document the scope contract explicitly:
  - `attachedToKind='general'` + `moduleRole='library'` = shared reusable import-only code for the whole metahub
  - `attachedToKind='metahub'` = executable metahub-scoped scripts (current behavior preserved)
  - `attachedToKind in {'catalog','hub','set','enumeration','attribute'}` = executable object-scoped scripts (current behavior preserved)
- [ ] Extend backend null-attachment handling so `attachedToKind='general'` also normalizes to `attachedToId = null` (same storage pattern as metahub-level scripts)
- [ ] Update frontend `EntityScriptsTab` gating and query behavior so `attachedToKind='general'` with `attachedToId = null` is editable/listable (current UI only allows null attachment for `metahub`)
- [ ] Add `SharedLibraryScript` to `packages/extension-sdk` as a marker base class for shared libraries; keep it thin and use it mainly for intent, templates, and compiler validation

#### Step 4.2: Scripting Engine — `@shared/` Import Resolver

**File**: `packages/scripting-engine/base/src/compiler.ts`

The compiler's import boundary checker currently allows only `@universo/extension-sdk`. Add `@shared/*` resolution:

```typescript
// In the import validator / esbuild plugin:
if (importPath.startsWith('@shared/')) {
  const codename = importPath.slice('@shared/'.length)
  // Validate codename format
  if (!/^[a-z][a-z0-9-]*$/.test(codename)) {
    throw new CompilationError(`Invalid shared library codename: "${codename}"`)
  }
  // The actual source resolution happens via esbuild plugin at compile time
  return true // allowed import
}
```

**esbuild plugin for @shared/ resolution:**

```typescript
const sharedLibraryPlugin: esbuild.Plugin = {
  name: 'universo-shared-library',
  setup(build) {
    build.onResolve({ filter: /^@shared\// }, async (args) => ({
      path: args.path,
      namespace: 'shared-library',
    }))

    build.onLoad({ filter: /.*/, namespace: 'shared-library' }, async (args) => {
      const codename = args.path.slice('@shared/'.length)
      const libraryScript = sharedLibraries.get(codename)
      if (!libraryScript) {
        throw new Error(`Shared library "@shared/${codename}" not found in metahub`)
      }
      return { contents: libraryScript.sourceCode, loader: 'ts' }
    })
  },
}
```

- [ ] Pass shared libraries map to `compileScript()` as a parameter
- [ ] For `moduleRole='library'`, add role-specific compiler validation:
  - reject lifecycle decorators such as `@OnEvent(...)`
  - reject execution-target decorators such as `@AtServer`, `@AtClient`, `@AtServerAndClient`
  - reject detectable `ctx`-bound runtime access (`this.ctx`, `callServerMethod`, stateful/event APIs) so shared libraries stay pure reusable helpers rather than hidden executable scripts
  - reject executable SDK base classes / registration helpers; only `SharedLibraryScript` or plain helper classes are valid library entrypoints
- [ ] Detect circular imports between shared libraries (topological sort)
- [ ] Compile shared libraries FIRST, then compile consumer scripts with resolved libraries
- [ ] Add `@shared/*` to the allowed import paths in the import boundary checker
- [ ] Keep import boundary fail-closed: only `@universo/extension-sdk` and `@shared/*` are allowed; all other imports remain blocked
- [ ] Keep the `@shared/*` resolution map per-metahub compilation context; the same codename in another metahub must never satisfy the import

#### Step 4.3: Publication — Shared Script Compilation Order

**File**: `packages/metahubs-backend/base/src/domains/publications/services/publicationPipeline.ts` (or equivalent)

- [ ] During publication, compile scripts in dependency order:
  1. Collect all shared library scripts (`attached_to_kind = 'general'`, `module_role = 'library'`)
  2. Extract `@shared/*` dependencies from each library source and build a dependency graph
  3. Detect cycles and fail publication with a human-readable cycle path
  4. Topologically sort the shared library graph (deterministic order; e.g. Kahn's algorithm)
  5. Compile shared libraries in sorted order
  6. Compile consumer scripts with all shared libraries available
- [ ] If a shared library has compile errors, fail the publication with a clear error message

#### Step 4.4: Scripts Tab in GeneralPage

- [ ] The "Scripts" tab on GeneralPage renders `EntityScriptsTab` with:
  - `attachedToKind = 'general'`
  - `attachedToId = null`
  - Only `moduleRole` choices available: `'library'`
  - Default template: shared library template
- [ ] Treat shared-library codename as an import-path contract: on codename change, detect dependent scripts before save; never allow a silent rename that leaves dangling `@shared/<old>` imports. Preferred implementation: explicit transactional rewrite of dependent import specifiers inside the same metahub; minimum safe behavior: block save with a dependent-script report.
- [ ] Backend delete flow for shared libraries checks dependents before deletion:
  - if other scripts import `@shared/<codename>`, return conflict/warning response instead of silent deletion
  - frontend shows the dependent scripts list so users can fix references first
- [ ] Template content:

```typescript
import { SharedLibraryScript } from '@universo/extension-sdk'

export default class SharedHelpers extends SharedLibraryScript {
  static formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }

  static slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
```

#### Step 4.5: Scripting Tests

- [ ] **Compiler unit tests**:
  - `@shared/` import resolution succeeds
  - Invalid `@shared/` codename rejected
  - Circular `@shared/` import detected and rejected
  - Library script compiled before consumer
  - Consumer script correctly bundles resolved library code
  - Library role rejects lifecycle decorators and execution-target decorators
  - Library role rejects detectable `ctx` access / mutable runtime APIs
  - Cross-metahub `@shared/` leakage is rejected even when another metahub has the same codename
- [ ] **Runtime integration tests**:
  - Library methods callable from consumer scripts via `@shared/<codename>` import
  - Library scripts do not register lifecycle hooks or runtime entry points
  - Existing metahub-level scripts still work after adding `general/library`
  - Existing object-attached scripts still work after adding `general/library`
  - Mixed dependency graph works: `libA -> libB -> consumer`
  - Persisted legacy `global` records normalize to `library` without inheriting executable capabilities
- [ ] **E2E Playwright tests**:
  - Create shared library script in Common → Scripts tab
  - Create catalog script that imports `@shared/<codename>`
  - Publish metahub — both scripts compile
  - Runtime: catalog script works with library code
  - Attempt circular shared-library dependency → publication fails with clear error
  - Attempt delete of in-use shared library → warning/conflict shown
  - Attempt rename of in-use shared library codename → explicit dependent report or transactional rewrite; never leave dangling imports
  - Existing metahub/catalog/widget script flows remain green (no regression matrix)

---

### Phase 5: Snapshot, Publication & Application Sync

#### Step 5.1: Snapshot Export — Add Shared Entity Sections

**File**: `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`

- [ ] Identify virtual container objects during export
- [ ] Serialize shared attributes/constants/values into dedicated snapshot sections:

```typescript
interface MetahubSnapshot {
  // ...existing...
  sharedAttributes?: SharedAttributeSnapshot[]
  sharedConstants?: SharedConstantSnapshot[]
  sharedValues?: SharedValueSnapshot[]
  sharedEntityOverrides?: SharedEntityOverrideSnapshot[]
  // scripts already included — just ensure 'general' attachment kind is serialized
}
```

- [ ] Virtual container objects are NOT exported as entities — they are implementation detail

#### Step 5.2: Snapshot Import — Restore Shared Entities

**File**: `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts`

- [ ] Add restoration pass between Pass 1 (entities) and Pass 2 (constants):
  - `restoreSharedEntities()`: create virtual containers, insert shared attributes/constants/values
  - `restoreSharedEntityOverrides()`: insert per-target override rows with remapped IDs
- [ ] Shared scripts already handled by `restoreScripts()` — just ensure `attached_to_kind = 'general'` is preserved

#### Step 5.3: Snapshot Hash Normalization

**File**: `packages/universo-utils/base/src/serialization/publicationSnapshotHash.ts`

- [ ] Add `sharedAttributes`, `sharedConstants`, `sharedValues`, `sharedEntityOverrides` sections to normalizer
- [ ] Each section: sort by deterministic keys (codename, id)

#### Step 5.3b: Snapshot Format Version Bump

- [ ] Increment `snapshotFormatVersion` in the version envelope (currently `1`). Adding `sharedAttributes`, `sharedConstants`, `sharedValues`, `sharedEntityOverrides` sections is a structural change to the snapshot format.
- [ ] Update snapshot import to handle both old format (no shared sections) and new format (with shared sections). Old snapshots without shared sections import cleanly — shared fields are `undefined`/`[]` (already optional in the interface).
- [ ] Update any snapshot format validation that checks version number.

#### Step 5.4: Application Sync — Flatten Shared Entities into Runtime Tables

**File**: `packages/applications-backend/base/src/routes/sync/syncHelpers.ts`

During app creation from publication snapshot:

- [ ] For each catalog: merge shared attributes (minus exclusions) with local attributes → insert all into `_app_attributes`
- [ ] For each enumeration: merge shared values (minus exclusions) with local values → insert all into `_app_values`
- [ ] **Shared constants must reuse the existing set-constant runtime path**: there is no `_app_constants` runtime table. Publication snapshots already serialize constants in the top-level `constants` section keyed by set object ID, metahub runtime loading already enriches definitions through `enrichDefinitionsWithSetConstants(...)`, and application runtime export already reconstructs the same shape through `loadApplicationRuntimeSetConstants(...)`. Shared constants must therefore merge into the existing snapshot `constants` payload per target set and continue flowing through the current `setConstantRef` enrichment/runtime-export path instead of inventing a new runtime table or config-only side channel.
- [ ] Excluded shared entities are omitted from runtime materialization; inactive shared entities remain represented in publication data via override state but do NOT create runtime fields/columns/values
- [ ] Runtime has NO concept of "shared" — it sees only flattened, materialized data
- [ ] Store `isShared` flag in `_app_attributes.config` for frontend display purposes only (optional)

#### Step 5.5: Snapshot/Sync Integration Tests

- [ ] Export snapshot with shared entities → verify sections present
- [ ] Import snapshot with shared entities → verify virtual containers + entities restored
- [ ] Hash normalization test: shared entities change → hash changes
- [ ] Application sync test: shared attributes appear in `_app_attributes` for target catalogs
- [ ] Exclusion test: excluded shared attributes NOT in `_app_attributes` for excluded catalog
- [ ] Inactive override test: inactive shared attributes remain represented in publication override state but do NOT create runtime fields/columns
- [ ] Shared constants test: merged shared constants appear under snapshot `constants[setId]` and continue to enrich `setConstantRef` payloads without creating any new `_app_*` runtime table
- [ ] Mixed unlocked ordering test: unlocked shared entities preserve per-target mixed order after export/import + sync roundtrip

---

### Phase 6: Widget Shared Behavior in Catalog Layouts

#### Step 6.1: Widget Behavior Settings in Global Layout

- [ ] Add `sharedBehavior` to widget `config` in the global layout widget editor:
  - `canDeactivate` (default: true) — controls whether catalog can toggle widget `is_active`
  - `canExclude` (default: true) — controls whether catalog can set `is_deleted_override = true`
  - `positionLocked` (default: false) — locks widget position in inherited catalog layouts
- [ ] UI: three toggles in widget settings panel in LayoutDetails

#### Step 6.2: Widget Exclusion Enforcement via Existing `is_deleted_override`

**No new schema needed.** The existing `_mhb_catalog_widget_overrides.is_deleted_override` column already implements widget exclusion. The plan now adds behavioral gating on top:

- [ ] In catalog layout editor, inherited widgets show "Exclude from this catalog" action **only if** the base widget's `config.sharedBehavior.canExclude !== false`
- [ ] The "Exclude" action writes `is_deleted_override = true` via the existing override upsert path
- [ ] If `canExclude = false`, the "Exclude" action is hidden (frontend) and rejected with 403 (backend)
- [ ] Excluded inherited widgets do not appear in catalog layout at all (already implemented via `is_deleted_override` check in `MetahubLayoutsService`)

#### Step 6.3: Widget Backend Enforcement

- [ ] `LayoutDetails` backend: before toggling `is_deleted_override`, check `config.sharedBehavior.canExclude` on the base widget; reject if `false`
- [ ] Honor `positionLocked`: reject reorder requests for locked inherited widgets (check base widget `config.sharedBehavior.positionLocked`)
- [ ] Honor `canDeactivate`: reject `is_active` toggle requests via `_mhb_catalog_widget_overrides` if base widget `config.sharedBehavior.canDeactivate === false`

#### Step 6.4: Widget Tests

- [ ] Backend: widget exclusion filter applied in catalog layout response
- [ ] Backend: locked widget reorder rejected
- [ ] Frontend: excluded widgets not rendered in catalog layout editor
- [ ] Frontend: locked widgets have disabled drag handle

---

### Phase 7: E2E Playwright Testing

#### Step 7.1: Shared Entities E2E Flow

**New spec**: `tools/testing/e2e/specs/flows/shared-entities.spec.ts`

```typescript
test.describe('Shared entities in Common section', () => {
  test('Create shared attributes, constants, values in Common tabs', async ({ page }) => {
    // Navigate to metahub → Common
    // Switch to Attributes tab
    // Create shared attribute with exclusions and behavior settings
    // Switch to Constants tab → create shared constant
    // Switch to Values tab → create shared value
    // Verify all appear in respective tabs
  })

  test('Shared attributes appear in catalogs with visual indicators', async ({ page }) => {
    // Navigate to catalog → Attributes
    // Verify locked shared attributes appear at top with badge + background tint
    // Verify divider between shared and local
    // Verify locked shared attributes cannot be dragged
    // Verify excluded shared attributes not present
  })

  test('Inactive and unlocked shared attributes behave correctly in target catalogs', async ({ page }) => {
    // Create one shared attribute with canDeactivate=true
    // Mark it inactive inside a catalog
    // Verify it remains visible in design-time merged list as inactive
    // Verify runtime application does not materialize its field/column
    // Create one shared attribute with positionLocked=false
    // Reorder it among local attributes and verify mixed ordering persists
  })

  test('Exclusion management from shared entity dialog', async ({ page }) => {
    // Open shared attribute → Exclusions tab
    // Add catalog to exclusions
    // Verify attribute disappears from catalog
    // Remove exclusion → verify attribute reappears
  })

  test('Publish and create application with shared entities', async ({ page }) => {
    // Create publication
    // Create application + connector
    // Verify schema includes shared attributes in all catalogs
    // Verify application runtime shows shared attribute columns
  })
})
```

#### Step 7.2: Shared Scripts E2E Flow

**New spec**: `tools/testing/e2e/specs/flows/shared-scripts.spec.ts`

```typescript
test.describe('Shared scripts (library role)', () => {
  test('Create shared library script in Common → Scripts', async ({ page }) => {
    // Navigate to Common → Scripts tab
    // Create library script with helper functions
    // Verify it appears in the list
  })

  test('Import shared library from catalog script', async ({ page }) => {
    // Create catalog script with @shared/<codename> import
    // Save → verify compilation succeeds
    // Publish metahub → verify publication succeeds
  })

  test('Nested shared-library dependencies stay deterministic and do not break existing scopes', async ({ page }) => {
    // Create shared lib A
    // Create shared lib B importing A
    // Create metahub-level script and catalog-level script importing B
    // Publish → verify all compile and runtime behavior stays correct
  })

  test('Circular shared-library imports fail loudly', async ({ page }) => {
    // Create lib A importing B
    // Create lib B importing A
    // Publish → verify explicit cycle error
  })

  test('Runtime execution of catalog script using shared library', async ({ page }) => {
    // Open application runtime
    // Trigger catalog script that uses shared library
    // Verify correct result
  })
})
```

#### Step 7.3: Fixture Regeneration

- [ ] Update `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`:
  - Add shared attributes (e.g., `_shared_name`, `_shared_description`) with various settings
  - Add shared constants (e.g., `_shared_max_items`) with exclusion on specific set
  - Add shared script (library with utility functions)
  - Configure behavior: one attribute with `positionLocked=true`, one with `positionLocked=false` and mixed target order, one with `canExclude=false`, one target-specific inactive override
- [ ] Regenerate fixture: `tools/fixtures/metahubs-self-hosted-app-snapshot.json`
- [ ] Verify import + runtime via Playwright

#### Step 7.4: Existing Script Functionality Verification

- [ ] Playwright test: verify existing metahub-level scripts still compile and execute
- [ ] Playwright test: verify catalog-level scripts still work
- [ ] Playwright test: verify widget-level scripts still work
- [ ] Compare script behavior across all attachment kinds and roles after `global -> library` role replacement
- [ ] Verify import-only `general/library` scripts stay distinct from executable `metahub` scripts in UI copy, validation, and runtime behavior

---

### Phase 8: Documentation

#### Step 8.1: User Documentation (GitBook format)

**Files to create/update:**

- [ ] `docs/en/platform/metahubs/common-section.md` — overview of Common section with all tabs
- [ ] `docs/en/platform/metahubs/shared-attributes.md` — shared attributes guide
- [ ] `docs/en/platform/metahubs/shared-constants.md` — shared constants guide
- [ ] `docs/en/platform/metahubs/shared-values.md` — shared values guide
- [ ] `docs/en/platform/metahubs/shared-scripts.md` — shared library scripts guide
- [ ] `docs/en/platform/metahubs/script-scopes.md` — exact difference between general/library, metahub-level, and object-attached scripts
- [ ] `docs/en/platform/metahubs/exclusions.md` — exclusion mechanism guide
- [ ] `docs/en/platform/metahubs/shared-behavior-settings.md` — behavior settings reference
- [ ] Update `docs/en/platform/metahubs/scripts.md` — add section on shared library imports
- [ ] Update `docs/en/SUMMARY.md` — add new pages to navigation
- [ ] Mirror all pages to `docs/ru/` with Russian translations
- [ ] Ensure exact line-count parity between EN and RU files

#### Step 8.2: API Reference Documentation

- [ ] `docs/en/api-reference/shared-entity-overrides.md` — REST API for per-target shared entity overrides
- [ ] Update `docs/en/api-reference/scripts.md` — add `general` attachment kind, `library` role
- [ ] Mirror to `docs/ru/`

#### Step 8.3: Architecture Documentation Update

- [ ] Update `docs/en/architecture/metahub-schema.md` — add virtual container objects, shared exclusions table
- [ ] Mirror to `docs/ru/`

---

## Potential Challenges & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Virtual container leakage into object APIs | Users see internal objects or internal IDs leak into UX flows | Filter `isVirtualContainer` in lists, pickers, summary/count queries, copy selectors, and public search responses; regression test each seam |
| Exclusion orphans accumulate | DB bloat (minor) | Clean on shared entity delete (both soft- and hard-delete paths); ignore orphans in queries via NOT EXISTS |
| Library circular imports | Publication failure | Topological sort + cycle detection in compiler; clear error message |
| Merged list performance | Slow attribute load for catalogs | Keep shared/local merge N+1-free with one SQL/CTE per entity type, use override indexes, and add regression coverage for representative shared/local mixes |
| Snapshot format change | Import compatibility | New sections are optional (`sharedAttributes?`); old snapshots import without shared entities; `snapshotFormatVersion` bumped |
| DnD zone constraints complexity | Buggy reorder | Isolated DnD context per zone (shared/local); thorough test coverage |
| Shared entity behavior only UI-gated | API callers can bypass `canExclude` / `canDeactivate` / `positionLocked` | Enforce `sharedBehavior` in backend override/reorder mutations and return clear 403/validation errors |
| Widget behavior enforcement | Inconsistency if only frontend gated | Backend enforcement on `is_deleted_override` / `is_active` / reorder uses existing `_mhb_catalog_widget_overrides` — check `sharedBehavior` from base widget before mutation |
| `_app_constants` table absence | Shared constants could drift if implementation invents a parallel runtime path | Keep constants on the existing snapshot `constants` plus `setConstantRef` enrichment/runtime-export path; do not add a new `_app_*` table |
| Sort order collision in merged lists | Non-deterministic entity ordering | Explicit `is_shared DESC` discriminator column in UNION ALL ORDER BY |
| Ambiguous `global` vs `library` script role model | User confusion, duplicated semantics | Replace `global` with `library` instead of keeping both roles |
| Legacy `global` capabilities survive the role rename | Shared libraries accidentally retain executable/runtime privileges | Normalize persisted `global` to `library` and reset `library` defaults/capabilities fail closed through shared helpers |
| Shared-library code silently behaving like executable scripts | Hard-to-debug runtime coupling and privilege drift | Compiler rejects decorators and detectable `ctx`/runtime-context usage for `library` role |
| In-use shared library deleted | Broken dependent scripts after save/delete | Dependency check before delete; clear conflict response with dependent script list |
| Shared-library codename rename breaks dependents | Broken publication/runtime after edit | Dependency-aware rename guard/refactor; never allow silent dangling `@shared/<old>` imports |

---

## Dependencies Between Steps

```
Step 1.1 (types) ─────────────┐
Step 1.2 (schema) ────────────┤
                               ├── Step 1.3 (container service) ──┐
                               │                                   │
Step 1.4 (exclusions service)──┤                                   ├── Step 2.3 (GeneralPage tabs)
                               │                                   │
Step 1.6 (merged helpers) ─────┘                                   ├── Step 3.1 (merged API)
                                                                   │
Step 2.1 (i18n) ──────────────────────────────────────────────────┤
Step 2.2 (shell-less content) ─────────────────────────────────────┤
Step 2.4 (exclusions UI) ─────────────────────────────────────────┘
                                                                    
Step 4.1 (types) ── Step 4.2 (compiler) ── Step 4.3 (publication) ── Step 4.4 (scripts UI)

Step 5.1-5.4 (snapshot/sync) depends on Phases 1-4 being complete

Step 6.* (widgets) can run in parallel with Phase 4

Step 7.* (E2E) runs after all implementation phases

Step 8.* (docs) can start in parallel with Phase 5
```

---

## Implementation Sequence (Recommended)

| Order | Steps | Estimated Scope |
|-------|-------|-----------------|
| 1 | 1.1–1.7 | Foundation: types + schema + services + unit tests |
| 2 | 2.1–2.6 | Frontend: GeneralPage tabs + shared entity CRUD + unit tests |
| 3 | 3.1–3.4 | Visual merge in target lists + backend API extensions |
| 4 | 4.1–4.5 | Shared scripts: compiler + publication + UI + tests |
| 5 | 5.1–5.5 | Snapshot/publication/sync contract extensions |
| 6 | 6.1–6.4 | Widget shared behavior in catalog layouts |
| 7 | 7.1–7.4 | Full E2E Playwright testing + fixture regeneration |
| 8 | 8.1–8.3 | Full bilingual documentation |

---

## Security Considerations

1. **SQL injection**: All queries use parameterized `$1`, `$2` bind parameters — no string concatenation
2. **Authorization**: Shared entity CRUD uses existing `permissions.manageMetahub` gate
3. **Override ownership**: Shared entity overrides are scoped to the metahub schema (isolated per schema); cross-metahub target references are impossible
4. **Script compilation boundary**: `@shared/` imports resolve only within the same metahub's `_mhb_scripts` table — no cross-metahub library leakage
5. **Snapshot integrity**: New sections participate in SHA-256 hash — tampering detected on import
6. **Virtual container access**: Containers are not exposed via public API; only internal service uses them
7. **Rate limiting**: Existing Express middleware protects new endpoints
8. **RLS enforcement**: All runtime queries use request-scoped DB executor with Row-Level Security
9. **Shared behavior enforcement**: `canExclude`, `canDeactivate`, and `positionLocked` are enforced on backend override/reorder mutations, not only in UI affordances
10. **Role compatibility hardening**: legacy `global` records normalize to `library`, and `library` capabilities fail closed before persistence, publication, or execution

---

## QA Revision Log (2026-04-07)

Corrections applied after deep codebase verification, UI pattern audit, security review, and requirements-coverage mapping:

| # | Issue | Resolution |
|---|-------|------------|
| 1 | The earlier exclusions-only shared-entity model could not satisfy the original requirement for target-specific inactive state and mixed unlocked ordering | Replaced it with `_mhb_shared_entity_overrides`, which stores per-target `is_excluded`, `is_active`, and `sort_order` overrides for shared attributes/constants/values |
| 2 | Phase 6.2 proposed new `is_excluded_override` or reuse of the shared-entity override table for widgets — both would duplicate existing `_mhb_catalog_widget_overrides.is_deleted_override` | Rewrote Phase 6 to use existing `is_deleted_override` for widgets and kept `_mhb_shared_entity_overrides` only for shared attributes/constants/values |
| 3 | `SharedEntityChip` used MUI `<Chip>`, but existing inherited badge in `LayoutDetails.tsx` uses styled `<Box>` with `borderRadius: 999` | Changed to `SharedEntityBadge` using styled `<Box>` to match existing visual language |
| 4 | UNION ALL sort order had no explicit `is_shared` discriminator — shared and local `sort_order` values could collide | Added `1 AS is_shared` / `0 AS is_shared` columns with `ORDER BY is_shared DESC` as primary sort key |
| 5 | Step 5.4 assumed `_app_constants` exists — it does NOT; only `_app_values` exists in runtime schema | Replaced the vague investigation note with the confirmed constants flow: snapshot `constants` keyed by set ID, `enrichDefinitionsWithSetConstants(...)` on the metahub side, and `loadApplicationRuntimeSetConstants(...)` on the application side |
| 6 | No `snapshotFormatVersion` bump despite adding new snapshot sections | Added Step 5.3b for format version increment and backward-compatible import handling |
| 7 | `presentation.sharedBehavior` for values mixed behavior data into display column without explanation | Added explicit trade-off documentation in Step 1.2 note |
| 8 | Historical `.backup/...` scripting research files are not present in the current workspace | Removed them as active plan dependencies and marked them unverifiable in the current environment |
| 9 | Current scripts model already has `global` role with overlapping semantics, so adding `library` beside it would create a confusing double role model | Refined the plan to replace `global` with `library` instead of keeping both |
| 10 | `general + null` attachment would not be editable in the current `EntityScriptsTab` gating logic | Added explicit frontend/backend null-attachment handling work for `general` scope |
| 11 | Shared libraries were not constrained enough and the old template still looked like an executable decorated script | Added pure-library contract, `SharedLibraryScript` marker base class, compiler validation, and a static-method template |
| 12 | The scripts test matrix did not yet cover nested imports, delete-dependency guard, or role/scope regressions | Expanded Phase 4/7 tests and docs coverage accordingly |
| 13 | The last architecture unknown in Phase 5 was the shared-constants runtime path | Verified the current code path and aligned the plan with existing `snapshot.constants` plus `setConstantRef` enrichment instead of leaving a speculative runtime-table branch |
| 14 | Shared-entity `sharedBehavior` rules were described in UI flows but not yet enforced as a backend contract | Added backend service/controller enforcement plus regression coverage so forbidden exclude/deactivate/reorder mutations fail closed |
| 15 | Replacing `global` with `library` did not yet cover capability defaults, role normalization, or stored-record compatibility | Added fail-closed role/capability normalization so persisted `global` records map to `library` and pristine role switches reset to `library` defaults |
| 16 | Shared-library codename edits could silently leave dangling `@shared/<old>` imports in dependent scripts | Added a dependency-aware rename contract: detect dependents before save, block silent breakage, and prefer explicit transactional import rewrites within the same metahub |
| 17 | Virtual-container leakage and merged-list performance guidance were still too vague for a cross-cutting object/query surface | Expanded anti-leak coverage to lists/pickers/counts/selectors/public search and required merged shared/local queries to stay N+1-free with regression coverage |
