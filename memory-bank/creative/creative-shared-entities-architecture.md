# Creative Design: Shared/Global Entities Architecture for Metahubs

> **Created**: 2026-04-07
> **Status**: Design complete, ready for implementation review
> **Scope**: Data model for shared (global) entities in Common section, exclusion mechanism, behavior settings, shared scripts, visual distinction, position locking

> **Design note (2026-04-07 QA revision)**: This creative document captures the pre-QA design exploration and alternatives. The implementation source of truth is now [shared-entities-and-scripts-plan-2026-04-07.md](../plan/shared-entities-and-scripts-plan-2026-04-07.md), which supersedes the earlier exclusions-only model with the final QA-revised per-target overrides model and the refined general/library scripts contract.

---

## Table of Contents

1. [Design Topic 1: Data Model for Shared Entities](#design-topic-1-data-model-for-shared-entities)
2. [Design Topic 2: Exclusions Storage](#design-topic-2-exclusions-storage)
3. [Design Topic 3: Behavior Settings Storage](#design-topic-3-behavior-settings-storage)
4. [Design Topic 4: Shared Scripts Architecture](#design-topic-4-shared-scripts-architecture)
5. [Design Topic 5: Visual Distinction of Shared Entities](#design-topic-5-visual-distinction-of-shared-entities)
6. [Design Topic 6: Position Locking Behavior](#design-topic-6-position-locking-behavior)
7. [GeneralPage Tab Architecture](#generalpage-tab-architecture)
8. [Snapshot / Publication Contract](#snapshot--publication-contract)
9. [Summary of Decisions](#summary-of-decisions)

---

## Design Topic 1: Data Model for Shared Entities

### Objectives

- Allow creating "shared" attributes, constants, and values in the Common section
- Shared attributes auto-appear in all Catalogs; shared constants in all Sets; shared values in all Enumerations
- Reuse existing CRUD infrastructure as much as possible
- Keep snapshot/sync path simple and predictable

### Current State

- `_mhb_attributes` has a NOT NULL `object_id` FK → `_mhb_objects.id` (CASCADE)
- `_mhb_constants` has a NOT NULL `object_id` FK → `_mhb_objects.id` (CASCADE)
- `_mhb_values` has a NOT NULL `object_id` FK → `_mhb_objects.id` (CASCADE)
- All unique indexes include `object_id` in their composition
- All entity services take `objectId` as a required parameter for all CRUD operations

### Alternatives Considered

| Option | Description | Schema Impact | CRUD Reuse | Risks |
|--------|-------------|---------------|------------|-------|
| **A. New tables** | `_mhb_shared_attributes`, `_mhb_shared_constants`, `_mhb_shared_values` with dedicated columns | 3 new tables | Low — needs new services/routes | Duplication of CRUD logic, double maintenance burden |
| **B. Marker in existing tables** | Use existing tables with `object_id = NULL` as "shared" marker | Column change (nullable FK) + re-index | High — same services with NULL-aware queries | FK ON DELETE CASCADE breaks (no parent); uniqueness indexes need update; every query filter must handle NULL `object_id` |
| **C. Virtual container object** | Create a well-known "shared" `_mhb_objects` row per entity kind (e.g., `kind = 'shared-catalog-pool'`) and attach shared entities to it | Zero column changes | **Highest** — existing CRUD works unmodified | Need to create/manage sentinel objects; must exclude them from regular object listings |

### Decision: Option C — Virtual Container Object

**Rationale:**

1. **Zero schema changes** to `_mhb_attributes`, `_mhb_constants`, `_mhb_values` — all columns, FK constraints, and unique indexes remain intact.
2. **Maximum CRUD reuse** — existing `MetahubAttributesService.findAll(metahubId, objectId)`, `MetahubAttributesService.create(metahubId, objectId, ...)`, and all mutation/reorder/copy paths work as-is with the virtual container object's `id` as the `objectId`.
3. **FK CASCADE still works** — deleting the virtual container deletes all its shared entities, which is correct behavior if shared entities are fully removed.
4. **Uniqueness indexes** already use `(object_id, codename)` — shared entities are scoped under their own virtual object, so codename uniqueness is enforced naturally.
5. **Snapshot/sync** — the serializer already iterates objects by kind; shared objects can either be serialized as a distinct section or merged into target object snapshots.

**Implementation sketch:**

```typescript
// Well-known virtual container kinds — stored in _mhb_objects.kind
const SHARED_OBJECT_KINDS = {
  SHARED_CATALOG_POOL: 'shared-catalog-pool',    // shared attributes → all catalogs
  SHARED_SET_POOL: 'shared-set-pool',             // shared constants → all sets
  SHARED_ENUM_POOL: 'shared-enumeration-pool',    // shared values → all enumerations
} as const

type SharedObjectKind = (typeof SHARED_OBJECT_KINDS)[keyof typeof SHARED_OBJECT_KINDS]
```

```sql
-- Virtual container objects (created automatically when first shared entity is added,
-- or eagerly when Common section is first opened)
-- One per metahub, per shared kind:
INSERT INTO _mhb_objects (kind, codename, presentation, config)
VALUES (
  'shared-catalog-pool',
  '{"v":"1.0.0","primary":{"text":"__shared_attributes__"}}',
  '{"name":{"en":"Shared Attributes","ru":"Общие атрибуты"}}',
  '{"isVirtualContainer": true}'
);
```

```typescript
// Service helper to resolve or create the virtual container
async function resolveSharedContainerObjectId(
  metahubId: string,
  sharedKind: SharedObjectKind,
  executor: SqlQueryable
): Promise<string> {
  const existing = await queryOne(executor,
    `SELECT id FROM ${qt} WHERE kind = $1 AND ${ACTIVE} LIMIT 1`,
    [sharedKind]
  )
  if (existing) return existing.id
  
  const created = await queryOneOrThrow(executor,
    `INSERT INTO ${qt} (kind, codename, presentation, config, ...)
     VALUES ($1, $2, $3, $4, ...) RETURNING id`,
    [sharedKind, defaultCodename, defaultPresentation, { isVirtualContainer: true }]
  )
  return created.id
}
```

**Edge cases:**
- Virtual container objects must be **excluded from regular object listings** — the objects query must filter out `kind IN ('shared-catalog-pool', 'shared-set-pool', 'shared-enumeration-pool')` or equivalently `config->>'isVirtualContainer' != 'true'`.
- Virtual containers should be **excluded from hub assignment** — they are not real objects.
- On metahub deletion, virtual containers cascade-delete with the schema, so no orphan risk.
- Codenames for virtual containers use reserved `__` prefix to avoid collision with user objects.

---

## Design Topic 2: Exclusions Storage

### Objectives

- Allow specific target objects (e.g., a particular Catalog) to exclude a shared entity (e.g., skip a shared attribute)
- Query pattern: "give me all shared attributes **except** those excluded from this catalog"
- Exclusions should be manageable from both the shared entity settings and the target object settings

### Alternatives Considered

| Option | Description | Query Simplicity | Storage Overhead |
|--------|-------------|------------------|------------------|
| **A. Separate exclusion table** | `_mhb_shared_exclusions(id, shared_entity_id, shared_entity_kind, excluded_from_object_id)` | Simple LEFT JOIN anti-pattern or NOT EXISTS | Minimal — sparse rows only for exclusions |
| **B. JSONB array in shared entity** | `config.exclusions: uuid[]` stored in entity config column | Needs `NOT (config->'exclusions' @> '"<objectId>"')` — GIN index required | No extra table, but bloats entity config; concurrent write risk on config column |
| **C. Override table** | `_mhb_shared_overrides(entity_id, target_object_id, is_excluded, is_active, sort_order_override)` | Same as A but combined with other overrides | More complex, combines concerns |

### Decision: Option A — Separate Exclusion Table

**Rationale:**

1. **Clean separation** — exclusions have a single clear purpose; not mixed with behavior or position overrides.
2. **Simple query model** — exclusion check is a straightforward `NOT EXISTS` subquery.
3. **Concurrent-safe** — no contention on entity config JSON; inserting/deleting exclusion rows is atomic.
4. **Index-friendly** — composite index on `(shared_entity_kind, shared_entity_id, excluded_from_object_id)` handles both lookup directions efficiently.
5. **Snapshot** — export as a simple flat array alongside shared entities.

**Table definition:**

```typescript
const mhbSharedExclusions: SystemTableDef = {
  name: '_mhb_shared_exclusions',
  description: 'Per-object exclusions for shared entities',
  columns: [
    { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
    // Kind discriminator: 'attribute' | 'constant' | 'value'
    { name: 'entity_kind', type: 'string', length: 20, nullable: false },
    // ID of the shared entity being excluded
    { name: 'shared_entity_id', type: 'uuid', nullable: false },
    // ID of the target object excluding it (e.g., a specific catalog)
    { name: 'excluded_from_object_id', type: 'uuid', nullable: false },
  ],
  foreignKeys: [
    { column: 'excluded_from_object_id', referencesTable: '_mhb_objects', referencesColumn: 'id', onDelete: 'CASCADE' },
  ],
  indexes: [
    {
      name: 'uidx_mhb_shared_exclusions_unique',
      columns: ['entity_kind', 'shared_entity_id', 'excluded_from_object_id'],
      unique: true,
      where: '_upl_deleted = false AND _mhb_deleted = false',
    },
    {
      name: 'idx_mhb_shared_exclusions_target',
      columns: ['excluded_from_object_id'],
    },
    {
      name: 'idx_mhb_shared_exclusions_entity',
      columns: ['entity_kind', 'shared_entity_id'],
    },
  ],
}
```

**Query pattern for merged attribute list:**

```sql
-- Get all effective attributes for catalog $catalogId
-- = local attributes + shared attributes (excluding excluded ones)
SELECT a.* FROM _mhb_attributes a
WHERE a.object_id = $1       -- local catalog attributes
  AND a._upl_deleted = false AND a._mhb_deleted = false
  AND a.parent_attribute_id IS NULL

UNION ALL

SELECT a.* FROM _mhb_attributes a
WHERE a.object_id = $2       -- shared container object_id
  AND a._upl_deleted = false AND a._mhb_deleted = false
  AND a.parent_attribute_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM _mhb_shared_exclusions e
    WHERE e.entity_kind = 'attribute'
      AND e.shared_entity_id = a.id
      AND e.excluded_from_object_id = $1
      AND e._upl_deleted = false AND e._mhb_deleted = false
  )
ORDER BY sort_order
```

**Note on FK constraints:** We intentionally do NOT add a FK from `shared_entity_id` to any specific entity table because the `entity_kind` discriminator could point to `_mhb_attributes`, `_mhb_constants`, or `_mhb_values`. The application layer ensures referential integrity, and orphaned exclusions are harmless (they simply won't match any entity). Alternatively, on shared entity deletion the service can clean up related exclusions explicitly.

---

## Design Topic 3: Behavior Settings Storage

### Objectives

- Each shared entity needs configurable behavior: `canDeactivate` (default: true), `canExclude` (default: true), `positionLocked` (default: false)
- Settings affect how the shared entity appears and behaves in target object contexts
- Settings should be easy to extend in the future

### Alternatives Considered

| Option | Description | Extensibility | Migration Impact |
|--------|-------------|---------------|------------------|
| **A. Dedicated columns** | Add 3 boolean columns to `_mhb_attributes`, `_mhb_constants`, `_mhb_values` | Low — need DDL migration for each new setting | High — 3 tables × 3 columns |
| **B. JSONB config** | Store as `shared_config` inside existing entity `config` JSON | High — add any key without DDL change | Zero DDL changes |
| **C. Hybrid** | Boolean `is_shared` + JSONB `shared_config` | Medium | Moderate — 1 column per table |

### Decision: Option B — JSONB Config (Inside Existing `config` Column)

**Rationale:**

1. **Zero DDL changes** — `_mhb_attributes`, `_mhb_constants`, `_mhb_values` already have a `config` JSONB column (attributes don't, but they can use `ui_config`; constants and values don't have a dedicated config column).

   **Correction**: Looking at the actual schema:
   - `_mhb_attributes` has `ui_config jsonb` and `validation_rules jsonb` and `presentation jsonb`
   - `_mhb_constants` has `ui_config jsonb` and `validation_rules jsonb` and `presentation jsonb`
   - `_mhb_values` has `presentation jsonb`
   
   None have a generic `config` column. But all entities owned by a virtual container are inherently "shared" — we don't need `is_shared` marker because the ownership container's `kind` already tells us.

2. **Use the virtual container object's `config`** instead: store the default behavior settings for all shared entities of that kind in the virtual container object's `config` column, and allow per-entity overrides in a new `shared_behavior` key within each entity's existing JSONB columns.

**Revised decision: Store in `presentation` or add thin `config` column to each entity.**

Since we need per-entity behavior settings and the entity tables differ in available JSONB columns, the cleanest path is:

**Approach: Store shared behavior in the entity's `ui_config` JSONB (attributes/constants) or `presentation` JSONB (values) under a `sharedBehavior` key.**

However, mixing concerns in `presentation` is unclean. Better:

**Final approach: Add a `config` JSONB column to `_mhb_values` (the only table missing it), and use `config.sharedBehavior` across all three entity types.**

Wait — `_mhb_values` also doesn't have `ui_config`. Let me re-check:

- `_mhb_attributes`: has `ui_config jsonb`
- `_mhb_constants`: has `ui_config jsonb`  
- `_mhb_values`: does NOT have `ui_config` or `config`

**Simplest final approach:**

Since shared entities live under a virtual container object, and we already know whether an entity is shared based on its `object_id` pointing to a virtual container, we only need to store behavior settings. The cleanest option:

**Use a dedicated `shared_behavior jsonb` column that is NULL for non-shared entities.**

However, this adds 1 column to 3 tables.

**Actual final decision: Use `ui_config.sharedBehavior` for attributes/constants (already have `ui_config`) and add a `config` column to `_mhb_values` for values.**

```typescript
// Shared behavior settings shape
interface SharedBehavior {
  canDeactivate?: boolean   // default: true
  canExclude?: boolean      // default: true
  positionLocked?: boolean  // default: false
}
```

**For attributes and constants** — already have `ui_config jsonb`:
```typescript
// Stored as: ui_config = { ..., sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: false } }
```

**For values** — need to add `config` column to `_mhb_values`:
```typescript
// New version entry for _mhb_values:
const mhbEnumerationValuesV2: SystemTableDef = {
  ...mhbEnumerationValues,
  columns: [...mhbEnumerationValues.columns, { name: 'config', type: 'jsonb', defaultTo: '{}' }],
}
// Stored as: config = { sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: false } }
```

**Runtime resolution:**
```typescript
function resolveSharedBehavior(entity: { ui_config?: unknown; config?: unknown }): SharedBehavior {
  const raw = (entity as any).ui_config?.sharedBehavior ?? (entity as any).config?.sharedBehavior ?? {}
  return {
    canDeactivate: raw.canDeactivate ?? true,
    canExclude: raw.canExclude ?? true,
    positionLocked: raw.positionLocked ?? false,
  }
}
```

**Edge cases:**
- Non-shared entities (regular `object_id` → real object) simply have no `sharedBehavior` key — the resolver returns all-defaults which are all permissive, which is correct (non-shared entities are fully editable).
- Future settings can be added to the same `sharedBehavior` key without DDL changes.

---

## Design Topic 4: Shared Scripts Architecture

### Objectives

- Enable scripts in the Common section that act as reusable libraries for other scripts
- Potentially enable global lifecycle hooks that fire across all objects
- Fit within the existing `attached_to_kind` + `module_role` script model

### Current State

- `SCRIPT_ATTACHMENT_KINDS = ['metahub', 'catalog', 'hub', 'set', 'enumeration', 'attribute']`
- `SCRIPT_MODULE_ROLES = ['module', 'lifecycle', 'widget', 'global']`
- Scripts table uses `attached_to_kind` as a discriminator and `attached_to_id` as nullable UUID (NULL = metahub-level)
- Existing module role `'global'` already exists with capabilities `['metadata.read']`
- Scripts have a unique index on `(attached_to_kind, COALESCE(attached_to_id, NIL_UUID), module_role, codename)`

### Alternatives Considered

| Option | Description | Import Model | Lifecycle Events |
|--------|-------------|--------------|------------------|
| **A. Shared library** | `attached_to_kind = 'general'`, `module_role = 'library'`, importable via `@shared/<codename>` | Static import at compile time | No |
| **B. Global hooks** | `attached_to_kind = 'general'`, `module_role = 'global-hook'`, fires lifecycle events across all objects | N/A | Yes — before/after on all CRUD |
| **C. Both** | Library scripts for reusable code + global hooks for cross-cutting events | Both | Both |

### Decision: Option A first — Shared Library Role (with path to Option C)

**Rationale:**

1. **Clear first use case** — shared scripts as importable libraries is the most requested and highest-value feature. Global hooks are powerful but complex to implement correctly (ordering, error handling, performance).
2. **Minimal script infra changes** — only need to add `'general'` to `SCRIPT_ATTACHMENT_KINDS` and `'library'` to `SCRIPT_MODULE_ROLES`.
3. **Import resolution** — the scripting engine already has an import boundary checker; extending it to resolve `@shared/<codename>` from the general scripts pool is a focused change.
4. **Global hooks deferred** — can be added later as `module_role = 'global-hook'` with `attached_to_kind = 'general'` without breaking the library model.

**Type changes:**

```typescript
// In @universo/types/common/scripts.ts:
export const SCRIPT_ATTACHMENT_KINDS = [
  'metahub', 'catalog', 'hub', 'set', 'enumeration', 'attribute',
  'general'  // NEW: shared/common scripts
] as const

export const SCRIPT_MODULE_ROLES = [
  'module', 'lifecycle', 'widget', 'global',
  'library'  // NEW: reusable library imported via @shared/<codename>
] as const
```

**Capability set for library role:**

```typescript
const SCRIPT_ALLOWED_CAPABILITIES_BY_ROLE = {
  // ...existing...
  library: ['metadata.read'] as const,
}

const SCRIPT_DEFAULT_CAPABILITIES_BY_ROLE = {
  // ...existing...
  library: ['metadata.read'] as const,
}
```

Library scripts are pure code — they expose functions/values but cannot directly read/write records or handle lifecycle events. Consuming scripts get capabilities based on their own role.

**Import resolution in scripting engine:**

```typescript
// In the esbuild plugin resolver:
if (importPath.startsWith('@shared/')) {
  const codename = importPath.slice('@shared/'.length)
  // Resolve from _mhb_scripts where attached_to_kind = 'general' AND module_role = 'library'
  const libraryScript = await findStoredMetahubScriptByScope(executor, schemaName, {
    codename,
    attachedToKind: 'general',
    attachedToId: null,
    moduleRole: 'library',
  })
  if (!libraryScript) {
    throw new Error(`Shared library script "@shared/${codename}" not found`)
  }
  return { contents: libraryScript.source_code, loader: 'ts' }
}
```

**Snapshot:**

Shared (general) scripts are already serialized by the existing script snapshot path since `attached_to_kind = 'general'` + `attached_to_id = NULL` is a valid combination in the current store. The serializer just needs to include them in the export.

**Edge cases:**
- Circular imports between shared libraries must be detected by the bundler/compiler.
- Library scripts should be compiled before consumer scripts during publication — need topological ordering.
- Deleting a shared library that is imported by other scripts should produce a warning, not a silent failure.

---

## Design Topic 5: Visual Distinction of Shared Entities in Target Lists

### Objectives

- When viewing attributes for a specific Catalog, shared attributes should be visually distinct from local ones
- The distinction must be clear but not overwhelming
- Should work in both light and dark themes

### Alternatives Considered

| Option | Description | Discoverability | Performance |
|--------|-------------|-----------------|-------------|
| **A. Background color** | Light tinted row (`alpha(palette.primary.main, 0.04)`) | Medium — subtle, might be missed | Zero overhead |
| **B. Chip/Badge** | Small "Shared" / "Общий" chip next to name | High — explicit label | Minor — one extra element per row |
| **C. Icon overlay** | Small link/globe icon in name column | Medium — requires learning | Minor |
| **D. Combined** | Background + chip | Highest | Minor |

### Decision: Option D — Background + Chip (with conditional rendering)

**Rationale:**

1. **Background tint** provides passive ambient distinction — users see the group at a glance without reading.
2. **Chip** provides explicit labeling for accessibility and new users who don't know what the tint means.
3. **Combined approach** is standard in enterprise UIs for inherited/shared items (e.g., Azure AD inherited policies, Figma inherited styles).
4. The chip can be hidden via a list toggle if the user finds it noisy (future preference).

**Implementation sketch:**

```tsx
// SharedEntityChip component
const SharedEntityChip = () => {
  const { t } = useTranslation('metahubs')
  return (
    <Chip
      label={t('shared.chip', 'Shared')}
      size="small"
      variant="outlined"
      color="info"
      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
    />
  )
}

// Row styling in FlowListTable
const getRowSx = (entity: { isShared?: boolean }) => ({
  ...(entity.isShared && {
    backgroundColor: (theme: Theme) =>
      alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
  }),
})
```

**Additional: row-level behavior indicators:**

```tsx
// When shared entity cannot be deactivated/excluded, show lock icon
{entity.isShared && entity.sharedBehavior?.positionLocked && (
  <Tooltip title={t('shared.positionLocked', 'Position is locked')}>
    <LockIcon fontSize="small" color="disabled" sx={{ ml: 0.5 }} />
  </Tooltip>
)}
```

**Edge cases:**
- Dark theme: background tint must use a higher alpha (0.08 vs 0.04) to be visible.
- Print/export: chip text should be included in text exports for accessibility.
- The "Shared" chip i18n key should be consistent across all entity list surfaces.

---

## Design Topic 6: Position Locking Behavior

### Objectives

- When `positionLocked = true`, the shared entity cannot be manually repositioned within the target object list
- Need clear visual grouping of locked shared entities
- Users must understand where local entities start

### Alternatives Considered

| Option | Description | Sort Stability | UX Clarity |
|--------|-------------|----------------|------------|
| **A. Always at top** | Shared entities sorted before all local entities; `sort_order` among shared entities maintained | High — deterministic | High — clear separation |
| **B. Original position preserved** | Shared entities keep their sort position relative to each other but treated as a prefix block | Same as A effectively | Medium |
| **C. Grouped with divider** | Visual separator line between shared and local entities | High | Highest — explicit boundary |

### Decision: Option A + C — Always at Top with Visual Divider

**Rationale:**

1. **Sorting model**: Shared entities always appear before local entities. Among shared entities, `sort_order` from the shared container object determines order. Among local entities, their own `sort_order` applies.
2. **Visual divider**: When there are both shared and local entities, a thin divider row with label "Local" / "Локальные" separates the two groups. This makes the boundary unambiguous.
3. **Position locking within shared group**: When `positionLocked = true`, the entity cannot be drag-reordered within the shared group either. When `positionLocked = false`, the entity can be reordered within the shared group (but always stays in the shared prefix area).

**Sort order resolution:**

```typescript
function buildMergedEntityList<T extends { id: string; sortOrder: number }>(
  sharedEntities: (T & { isShared: true; sharedBehavior: SharedBehavior })[],
  localEntities: T[],
  exclusions: Set<string>
): MergedEntity<T>[] {
  // 1. Filter out excluded shared entities
  const effectiveShared = sharedEntities.filter(e => !exclusions.has(e.id))
  
  // 2. Sort shared by their own sort_order
  effectiveShared.sort((a, b) => a.sortOrder - b.sortOrder)
  
  // 3. Sort local by their own sort_order
  localEntities.sort((a, b) => a.sortOrder - b.sortOrder)
  
  // 4. Concatenate: shared first, then local
  return [
    ...effectiveShared.map(e => ({ ...e, isShared: true as const })),
    ...localEntities.map(e => ({ ...e, isShared: false as const })),
  ]
}
```

**Drag-and-drop constraints:**

```typescript
// In DnD handler:
function canDrop(draggedEntity: MergedEntity, targetIndex: number, mergedList: MergedEntity[]): boolean {
  if (draggedEntity.isShared && draggedEntity.sharedBehavior.positionLocked) {
    return false // Cannot move locked shared entities
  }
  
  if (draggedEntity.isShared) {
    // Can only reorder within the shared prefix
    const lastSharedIndex = mergedList.findLastIndex(e => e.isShared)
    return targetIndex <= lastSharedIndex
  }
  
  // Local entities can only reorder within the local suffix
  const firstLocalIndex = mergedList.findIndex(e => !e.isShared)
  return targetIndex >= firstLocalIndex
}
```

**Visual divider:**

```tsx
// In FlowListTable renderRow, inject divider between last shared and first local:
{isLastSharedEntity && hasLocalEntities && (
  <TableRow sx={{ height: 32 }}>
    <TableCell
      colSpan={columns.length}
      sx={{
        py: 0.5,
        borderBottom: 'none',
        color: 'text.secondary',
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {t('shared.localDivider', 'Local')}
    </TableCell>
  </TableRow>
)}
```

**Edge cases:**
- If all shared entities are excluded, no divider is shown.
- If there are no local entities, no divider is shown.
- Runtime/publication: the sort order flattening must place shared entities at the top of the effective list for the target object.

---

## GeneralPage Tab Architecture

### Current State

```typescript
type GeneralTab = 'layouts'
// Single <Tab value='layouts' ...>
// Renders <LayoutListContent> when active
```

### Proposed Extension

```typescript
type GeneralTab = 'layouts' | 'attributes' | 'constants' | 'values' | 'scripts'
```

Each new tab follows the same shell-less content pattern established by `LayoutListContent`:

```tsx
export default function GeneralPage() {
  const { metahubId } = useParams<{ metahubId: string }>()
  const { t } = useTranslation('metahubs')
  const [activeTab, setActiveTab] = useState<GeneralTab>('layouts')

  return (
    <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
      <ViewHeader title={t('general.title', 'Common')} />

      <Box data-testid='metahub-common-tabs' sx={PAGE_TAB_BAR_SX}>
        <Tabs
          value={activeTab}
          onChange={(_, nextValue: GeneralTab) => setActiveTab(nextValue)}
          variant='scrollable'
          scrollButtons='auto'
        >
          <Tab value='layouts' label={t('general.tabs.layouts', 'Layouts')} />
          <Tab value='attributes' label={t('general.tabs.attributes', 'Attributes')} />
          <Tab value='constants' label={t('general.tabs.constants', 'Constants')} />
          <Tab value='values' label={t('general.tabs.values', 'Values')} />
          <Tab value='scripts' label={t('general.tabs.scripts', 'Scripts')} />
        </Tabs>
      </Box>

      <Box data-testid='metahub-common-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
        {activeTab === 'layouts' && (
          <LayoutListContent metahubId={metahubId} /* ... */ renderPageShell={false} />
        )}
        {activeTab === 'attributes' && (
          <SharedAttributeListContent metahubId={metahubId} renderPageShell={false} />
        )}
        {activeTab === 'constants' && (
          <SharedConstantListContent metahubId={metahubId} renderPageShell={false} />
        )}
        {activeTab === 'values' && (
          <SharedValueListContent metahubId={metahubId} renderPageShell={false} />
        )}
        {activeTab === 'scripts' && (
          <SharedScriptListContent metahubId={metahubId} renderPageShell={false} />
        )}
      </Box>
    </MainCard>
  )
}
```

### Content Component Strategy

For **attributes**, **constants**, and **values**, we extract shell-less content components from the existing `AttributeList`, `ConstantList`, and `ValueList` — following the same `LayoutList` → `LayoutListContent` extraction pattern.

The shell-less content component receives a `sharedContainerObjectId` instead of a regular `objectId`, and the parent page resolves (or creates) the virtual container object via an API call or React Query hook.

For **scripts**, a new `SharedScriptListContent` renders the script list filtered by `attached_to_kind = 'general'`.

---

## Snapshot / Publication Contract

### Shared Entity Serialization

Shared entities must participate in the snapshot so they survive snapshot export/import and application sync.

**Option A (chosen): Dedicated snapshot section:**

```typescript
interface MetahubSnapshot {
  // ...existing fields...
  sharedAttributes?: SharedAttributeSnapshot[]
  sharedConstants?: Record<string, SharedConstantSnapshot[]>  // keyed by container object id
  sharedValues?: Record<string, SharedValueSnapshot[]>
  sharedExclusions?: SharedExclusionSnapshot[]
}
```

The serializer identifies virtual container objects by their `kind` and serializes their children into the dedicated `shared*` sections. This keeps the existing `entities[objectId].fields` path unchanged for regular objects.

**Publication/runtime materialization:**

During application publication, the sync process:
1. Exports shared entities from their virtual containers
2. For each target object (e.g., each catalog), generates the effective merged attribute list (shared minus exclusions plus local)
3. Flattens the merged result into ordinary `_app_*` runtime rows — runtime has no concept of "shared", it only sees the materialized result

This follows the same pattern as catalog layout publication: authoring has a layered model, but runtime sees only the flattened result.

### Snapshot Hash Participation

The `normalizePublicationSnapshotForHash(...)` function must include the new `sharedAttributes`, `sharedConstants`, `sharedValues`, and `sharedExclusions` sections. Following the established snapshot hash pattern, all sections that affect runtime materialization must participate in hash computation.

---

## Summary of Decisions

| Topic | Decision | Key Pattern |
|-------|----------|-------------|
| **1. Data Model** | Virtual container objects in `_mhb_objects` with well-known kinds | Reuse existing CRUD infrastructure with zero schema changes to entity tables |
| **2. Exclusions** | Dedicated `_mhb_shared_exclusions` table with `(entity_kind, shared_entity_id, excluded_from_object_id)` | Simple NOT EXISTS anti-join pattern |
| **3. Behavior Settings** | `sharedBehavior` key in entity's `ui_config` (attributes/constants) or new `config` column (values) | JSONB-based extensible settings with sensible defaults |
| **4. Shared Scripts** | `attached_to_kind = 'general'`, `module_role = 'library'`, import via `@shared/<codename>` | Extends existing script attachment model |
| **5. Visual Distinction** | Background tint + "Shared" chip | Dual cue: ambient color + explicit label |
| **6. Position Locking** | Always at top with visual divider between shared and local groups | Deterministic sort with drag-drop zone constraints |
| **GeneralPage** | Extend `GeneralTab` union type with 4 new tabs, each rendering a shell-less content component | Follows established `LayoutListContent` pattern |
| **Snapshot** | Dedicated `shared*` sections, runtime publication flattens into ordinary rows | Follows catalog layout publication model |

### Risks

1. **Virtual container object leakage** — Must be sure all object-listing queries exclude virtual containers. Mitigation: add `isVirtualContainer` filter to all object query helpers and add a regression test.
2. **Exclusion orphans** — When a shared entity is deleted, orphan exclusion rows remain. Mitigation: clean up exclusions on shared entity deletion in the service layer, and ignore orphan exclusions in query results (NOT EXISTS handles gracefully).
3. **Library compilation order** — Shared library scripts must be compiled before consumer scripts during publication. Mitigation: topological sort in publication pipeline based on `@shared/` import graph.
4. **Performance for large catalogs** — The UNION ALL query for merged entity list adds one scan per entity type. Mitigation: shared container object IDs are cached per metahub session; the additional scan is on a small table (shared entities).
5. **Snapshot version bump** — Adding shared sections to the snapshot requires incrementing `snapshotFormatVersion`. Mitigation: standard version migration path already established.
