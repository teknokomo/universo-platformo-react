# Plan: Architectural Improvements — Independent Child Tables + Enum Values Table Rename

Date: 2026-02-25
Mode: PLAN (no implementation)
Complexity: Level 3 (Significant)

> **Key Decision**: Test database will be deleted and recreated. No migration of existing data. No legacy code.

---

## Overview

Two related architectural improvements to the Universo Platformo metahub system:

1. **Rename enum values tables**: `_mhb_enum_values` → `_mhb_values`, `_app_enum_values` → `_app_values` (simplified naming — no other "values" tables exist)
2. **Independent child table naming**: Change from derived `{parent}_tp_{attrId12}` to independent `tbl_<UUIDv7>` with junction-table-ready architecture for future multi-parent and arbitrary nesting depth support

### Why These Changes Together

Both changes affect the same DDL pipeline (`naming.ts` → `snapshot.ts` → `diff.ts` → `SchemaMigrator.ts` → `SchemaGenerator.ts`), the same backend routes, and the same frontend components. Bundling them avoids a double-pass through the codebase.

### Design Rationale: Independent `tbl_<UUIDv7>` Naming

**Current**: `cat_<parentUUID>_tp_<attrId12>` — name derives from parent table name and attribute ID.

**Problem**:
- Tightly couples the child table to a SINGLE parent entity
- Makes multi-parent scenarios (junction tables) impossible
- Limits PostgreSQL NAMEDATALEN (63 chars): parent prefix gets truncated
- Name changes if the parent entity kind changes (unlikely but architecturally unsound)

**New**: `tbl_<UUIDv7_hex32>` — independently named, globally unique.

**Benefits**:
- Decoupled from parent identity → ready for junction tables (multi-parent)
- No name length pressure — always exactly `tbl_` (4) + 32 hex chars = 36 chars
- Future multi-level nesting: child of child of child → each is just another `tbl_*`
- The FK `_tp_parent_id` is the ONLY structural link to the parent (data, not naming)

---

## Affected Areas (Files by Package)

### Package 1: `@universo/schema-ddl` (Core DDL Engine)

| File | Changes | Lines |
|---|---|---|
| [naming.ts](packages/schema-ddl/base/src/naming.ts) | Replace `generateTabularTableName()` → `generateChildTableName()` | L48-56 |
| [types.ts](packages/schema-ddl/base/src/types.ts) | No changes needed (`columnName` already stores child table name) | L7-21 |
| [snapshot.ts](packages/schema-ddl/base/src/snapshot.ts) | Use new `generateChildTableName()`, increment snapshot version | L4, 28, 34 |
| [diff.ts](packages/schema-ddl/base/src/diff.ts) | Update table name resolution for TABLE fields | L174, 264 |
| [SchemaGenerator.ts](packages/schema-ddl/base/src/SchemaGenerator.ts) | 3 calls to `generateTabularTableName` (L143, L302, L1029) + 18 refs to `_app_enum_values` → `_app_values` | L5, 113, 117, 143, 291-401, 432, 438, 827-885, 953, 958, 1029 |
| [SchemaMigrator.ts](packages/schema-ddl/base/src/SchemaMigrator.ts) | Update FK target + tabular table creation | L299, 341-400 |
| [index.ts](packages/schema-ddl/base/src/index.ts) | Update public exports | L28 |
| Tests: `naming.test.ts` (15+ refs), `snapshot.test.ts` (3 refs), `diff.test.ts` (7 refs), `SchemaMigrator.test.ts` (2 refs) | Rewrite tests with new naming | - |

### Package 2: `@universo/metahubs-backend`

| File | Changes | Lines |
|---|---|---|
| [ddl/index.ts](packages/metahubs-backend/base/src/domains/ddl/index.ts) | **Re-export**: `generateTabularTableName` → `generateChildTableName` | L22 |
| [systemTableDefinitions.ts](packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts) | `_mhb_enum_values` → `_mhb_values` | L170 |
| [MetahubEnumerationValuesService.ts](packages/metahubs-backend/base/src/domains/metahubs/services/MetahubEnumerationValuesService.ts) | 25+ refs: table name + index names | all |
| [applicationSyncRoutes.ts](packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts) | `generateTabularTableName` → `generateChildTableName`, `_app_enum_values` → `_app_values` | L33, 451, 676 |
| [TemplateSeedExecutor.ts](packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedExecutor.ts) | 3 refs to `_mhb_enum_values` (L428, L442, L457) | - |
| [TemplateSeedMigrator.ts](packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedMigrator.ts) | 3 refs to `_mhb_enum_values` (L615, L633, L648) | - |
| Tests: `structureVersions.test.ts` (1 ref), `metahubSchemaService.test.ts` (1 ref) | Update table names | - |

### Package 3: `@universo/applications-backend`

| File | Changes | Lines |
|---|---|---|
| [applicationsRoutes.ts](packages/applications-backend/base/src/routes/applicationsRoutes.ts) | 5x `generateTabularTableName` → resolve from `_app_attributes`, 2x `_app_enum_values` → `_app_values` | L7, 591, 734, 1286, 1501, 1891, 2160, 2250 |
| Tests: `applicationsRoutes.test.ts` | 2x SQL pattern `_app_enum_values` → `_app_values` (L751, L803) | - |

### Package 4: `apps-template-mui` (Frontend)

| File | Changes | Lines |
|---|---|---|
| [api/api.ts](packages/apps-template-mui/src/api/api.ts) | No structural changes (uses URL-based API) | - |
| [components/RuntimeInlineTabularEditor.tsx](packages/apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx) | `_tp_sort_order` refs stay (column name unchanged) | L133, 189, 209 |
| [components/TabularPartEditor.tsx](packages/apps-template-mui/src/components/TabularPartEditor.tsx) | `_tp_sort_order` refs stay | L76, 85 |
| i18n: en/apps.json, ru/apps.json | No changes needed | - |

### Package 5: `@universo/metahubs-frontend`

| File | Changes | Lines |
|---|---|---|
| [types.ts](packages/metahubs-frontend/base/src/types.ts) | Comment update: `_mhb_enum_values` → `_mhb_values` | L355 |

### Package 6: `@universo/types`

| File | Changes | Lines |
|---|---|---|
| [common/metahubs.ts](packages/universo-types/base/src/common/metahubs.ts) | Comment updates only | L253, 289 |

---

## Implementation Plan (Step-by-Step)

### Phase 1: Core DDL Engine (`@universo/schema-ddl`)

> All subsequent packages depend on this. Must be completed first.

#### Step 1.1: Rename `generateTabularTableName` → `generateChildTableName` in `naming.ts`

**Current code** (L48-56):
```typescript
export const generateTabularTableName = (parentTableName: string, attributeId: string): string => {
    const cleanId = attributeId.replace(/-/g, '').substring(0, 12)
    const prefix = parentTableName.substring(0, 63 - 4 - 12)
    return `${prefix}_tp_${cleanId}`
}
```

**New code**:
```typescript
/**
 * Generates independent table name for a child table (TABLE attribute).
 * Convention: tbl_{attributeUuid32}
 * Uses full UUID v7 hex (32 chars) of the TABLE attribute ID.
 * Total name = 4 ('tbl_') + 32 (hex) = 36 chars, well within PostgreSQL 63-char limit.
 * The name is independent of the parent table, enabling future multi-parent (junction table) support.
 *
 * Example: tbl_0196117f8e037db3bbe2d3e0f1a2b3c4
 */
export const generateChildTableName = (attributeId: string): string => {
    const cleanId = attributeId.replace(/-/g, '')
    return `tbl_${cleanId}`
}
```

**Key change**: Function signature drops `parentTableName` parameter — the parent is no longer encoded in the table name. The attribute UUID v7 is used in full (32 hex chars).

#### Step 1.2: Update public exports in `index.ts`

**Change**:
```typescript
// Before
export { generateTabularTableName } from './naming'

// After
export { generateChildTableName } from './naming'
```

#### Step 1.3: Verify `SchemaFieldSnapshot` type in `types.ts`

No changes needed — the existing `columnName` field already stores the child table name for TABLE data types. The naming function change in `naming.ts` is sufficient; the snapshot type interface remains unchanged.

```typescript
// No change required to SchemaFieldSnapshot
export interface SchemaFieldSnapshot {
    codename: string
    columnName: string  // ← stores tbl_<uuid32> for TABLE fields
    dataType: AttributeDataType
    isRequired: boolean
    isDisplayAttribute?: boolean
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
    /** Child field snapshots for TABLE data type, keyed by child field ID */
    childFields?: Record<string, SchemaFieldSnapshot>
}
```

#### Step 1.4: Update `snapshot.ts`

**Change** at L4, L34:
```typescript
// Before
import { generateColumnName, generateTableName, generateTabularTableName } from './naming'

// After
import { generateColumnName, generateTableName, generateChildTableName } from './naming'
```

```typescript
// Before (L34)
const columnName = isTable ? generateTabularTableName(entityTableName, field.id) : generateColumnName(field.id)

// After
const columnName = isTable ? generateChildTableName(field.id) : generateColumnName(field.id)
```

**Increment snapshot version** at L6:
```typescript
// Before
export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 1

// After
export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 2
```

#### Step 1.5: Update `diff.ts`

**Change** at L3 (import):
```typescript
// Before
import { generateColumnName, generateTableName, generateTabularTableName } from './naming'

// After
import { generateColumnName, generateTableName, generateChildTableName } from './naming'
```

**Change** at L174 (new TABLE attribute → create tabular table):
```typescript
// Before
const tabularTableName = generateTabularTableName(tableName, field.id)

// After
const tabularTableName = generateChildTableName(field.id)
```

**Change** at L264 (TABLE child field diffs):
```typescript
// Before
const tabularTableName = generateTabularTableName(tableName, field.id)

// After
const tabularTableName = generateChildTableName(field.id)
```

#### Step 1.6: Update `SchemaGenerator.ts`

**1.6a: Rename method and update signature** (L291-304):

```typescript
// Before
public async createTabularTable(
    schemaName: string,
    parentTableName: string,
    tableField: FieldDefinition,
    childFields: FieldDefinition[],
    trx?: Knex.Transaction
): Promise<void> {
    const tabularTableName = generateTabularTableName(parentTableName, tableField.id)

// After
public async createTabularTable(
    schemaName: string,
    parentTableName: string,
    tableField: FieldDefinition,
    childFields: FieldDefinition[],
    trx?: Knex.Transaction
): Promise<void> {
    const tabularTableName = generateChildTableName(tableField.id)
```

> **Note**: Method name `createTabularTable` stays — it accurately describes what it creates. Only the internal naming changes.

**1.6b: Import update**:
```typescript
// Before
import { generateTabularTableName, ... } from './naming'

// After
import { generateChildTableName, ... } from './naming'
```

**1.6c: Rename `_app_enum_values` → `_app_values`** (18 occurrences total):

All occurrences of `'_app_enum_values'` across the entire file:
```typescript
// Before
const hasEnumValues = await knex.schema.withSchema(schemaName).hasTable('_app_enum_values')
console.log(`[SchemaGenerator] _app_enum_values exists: ${hasEnumValues}`)
if (!hasEnumValues) {
    console.log(`[SchemaGenerator] Creating _app_enum_values...`)
    await knex.schema.withSchema(schemaName).createTable('_app_enum_values', (table) => {

// After
const hasValues = await knex.schema.withSchema(schemaName).hasTable('_app_values')
console.log(`[SchemaGenerator] _app_values exists: ${hasValues}`)
if (!hasValues) {
    console.log(`[SchemaGenerator] Creating _app_values...`)
    await knex.schema.withSchema(schemaName).createTable('_app_values', (table) => {
```

**Index names** also change (L875-888):
```typescript
// Before
table.index(['object_id'], 'idx_app_enum_values_object_id')
table.index(['object_id', 'sort_order'], 'idx_app_enum_values_object_sort')

// After
table.index(['object_id'], 'idx_app_values_object_id')
table.index(['object_id', 'sort_order'], 'idx_app_values_object_sort')
```

And unique indexes:
```typescript
// Before
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_enum_values_object_codename_active
CREATE INDEX IF NOT EXISTS idx_app_enum_values_default_active
CREATE UNIQUE INDEX IF NOT EXISTS uidx_app_enum_values_default_active

// After
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_values_object_codename_active
CREATE INDEX IF NOT EXISTS idx_app_values_default_active
CREATE UNIQUE INDEX IF NOT EXISTS uidx_app_values_default_active
```

**1.6d: Update remaining `generateTabularTableName` calls** (L143, L1029):

**L143** — `generateFullSchema()` — FK for child REF fields inside tabular tables:
```typescript
// Before (L143)
const tabularTableName = generateTabularTableName(parentTableName, tableParentField.id)

// After
const tabularTableName = generateChildTableName(tableParentField.id)
```

**L1029** — `syncSystemMetadata()` — stores `column_name` in `_app_attributes` for TABLE fields:
```typescript
// Before (L1029)
const columnName =
    field.dataType === AttributeDataType.TABLE && !field.parentAttributeId
        ? generateTabularTableName(entityTableName, field.id)
        : generateColumnName(field.id)

// After
const columnName =
    field.dataType === AttributeDataType.TABLE && !field.parentAttributeId
        ? generateChildTableName(field.id)
        : generateColumnName(field.id)
```

**L113** — `generateFullSchema()` — informational log entry (cosmetic):
```typescript
// Before
result.tablesCreated.push(`${entity.codename}__tp__${tableField.codename}`)

// After
result.tablesCreated.push(`${entity.codename}__tbl__${tableField.codename}`)
```

**L117** — Comment referencing old table name:
```typescript
// Before
// Ensure system tables before adding REF FKs that may target _app_enum_values.

// After
// Ensure system tables before adding REF FKs that may target _app_values.
```

**L432** — Console log in `addForeignKeyToTable()`:
```typescript
// Before
console.log(`[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> _app_enum_values.id`)

// After
console.log(`[SchemaGenerator] Adding FK: ${sourceTableName}.${columnName} -> _app_values.id`)
```

**L438** — Raw SQL in `addForeignKeyToTable()` (CRITICAL):
```typescript
// Before
REFERENCES ??._app_enum_values(id)

// After
REFERENCES ??._app_values(id)
```

**L953, L958** — Raw SQL in `normalizeAppEnumValueDefaults()` (CRITICAL):
```typescript
// Before
FROM "${schemaName}"._app_enum_values
UPDATE "${schemaName}"._app_enum_values AS ev

// After
FROM "${schemaName}"._app_values
UPDATE "${schemaName}"._app_values AS ev
```

#### Step 1.7: Update `SchemaMigrator.ts`

**Change** at L299 (FK target for enumeration):
```typescript
// Before
targetTableName = '_app_enum_values'

// After
targetTableName = '_app_values'
```

**Change** at L353 (ADD_TABULAR_TABLE handler):
```typescript
// Before
const parentTableName = generateTableName(entity.id, entity.kind)
await this.generator.createTabularTable(schemaName, parentTableName, tableField, childFields, trx)

// After — parentTableName is still needed for the FK constraint
const parentTableName = generateTableName(entity.id, entity.kind)
await this.generator.createTabularTable(schemaName, parentTableName, tableField, childFields, trx)
```

> **Note**: No change needed here — `createTabularTable` still receives `parentTableName` for the FK, but internally uses `generateChildTableName` for the table name.

#### Step 1.8: Update tests

All test files in `packages/schema-ddl/base/src/__tests__/`:

- `naming.test.ts` (15+ refs): Replace import and all usages of `generateTabularTableName` → `generateChildTableName`. Update all expected values from `{parent}_tp_{id12}` → `tbl_{uuid32}`. Note: new function takes only 1 argument (`attributeId`), not 2.
- `snapshot.test.ts` (3 refs):
  - L195: Update comment `{parentTableName}_tp_{cleanAttrId}` → `tbl_{cleanAttrId}`
  - L196: `expect(field.columnName).toContain('_tp_')` → `expect(field.columnName).toContain('tbl_')`
  - L197: `expect(field.columnName).toBe('cat_entityt00000000000000000001_tp_tableattr111')` → `expect(field.columnName).toBe('tbl_tableattr11100000000000000000000')` (full 32-char hex of the TABLE attribute UUID)
- `diff.test.ts` (7 refs): Update all `columnName` expected values containing `_tp_` → `tbl_` format. Lines: 291, 314, 355, 397, 447, 505, 559.
- `SchemaMigrator.test.ts` (2 refs):
  - L8: `'_app_enum_values'` → `'_app_values'` in test description
  - L59: `'_app_enum_values'` → `'_app_values'` in expected raw SQL arguments

---

### Phase 2: Metahub Backend (`@universo/metahubs-backend`)

#### Step 2.0: Update re-export in `ddl/index.ts`

**File**: `packages/metahubs-backend/base/src/domains/ddl/index.ts` (L22)

This file re-exports pure functions from `@universo/schema-ddl`. Must update to re-export the renamed function:

```typescript
// Before
export {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateTabularTableName,
    ...
} from '@universo/schema-ddl'

// After
export {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    generateChildTableName,
    ...
} from '@universo/schema-ddl'
```

> **Why this matters**: `applicationSyncRoutes.ts` imports `generateTabularTableName` from `'../../ddl'` (this file), NOT directly from `@universo/schema-ddl`. Without updating this re-export, Step 2.3 will fail to compile.

#### Step 2.1: Rename `_mhb_enum_values` in `systemTableDefinitions.ts`

**Change** at L170:
```typescript
// Before
const mhbEnumerationValues: SystemTableDef = {
    name: '_mhb_enum_values',
    description: 'Enumeration values for objects with kind=enumeration',

// After
const mhbEnumerationValues: SystemTableDef = {
    name: '_mhb_values',
    description: 'Enumeration values for objects with kind=enumeration',
```

**Index names** also change (L189-204):
```typescript
// Before
{ name: 'idx_mhb_enum_values_object_id', ... }
{ name: 'idx_mhb_enum_values_object_sort', ... }
{ name: 'idx_mhb_enum_values_object_codename_active', ... }
{ name: 'idx_mhb_enum_values_default_active', ... }
{ name: 'uidx_mhb_enum_values_default_active', ... }

// After
{ name: 'idx_mhb_values_object_id', ... }
{ name: 'idx_mhb_values_object_sort', ... }
{ name: 'idx_mhb_values_object_codename_active', ... }
{ name: 'idx_mhb_values_default_active', ... }
{ name: 'uidx_mhb_values_default_active', ... }
```

#### Step 2.2: Update `MetahubEnumerationValuesService.ts`

Replace all 25+ occurrences of `'_mhb_enum_values'` → `'_mhb_values'` (string literal table name in Knex queries). This is a global find-replace within this single file.

#### Step 2.3: Update `applicationSyncRoutes.ts`

**Change** at L33 (import):
```typescript
// Before
import { generateTabularTableName, ... } from '@universo/schema-ddl'

// After
import { generateChildTableName, ... } from '@universo/schema-ddl'
```

**Change** at L451 (seed TABLE child rows):
```typescript
// Before
const tabularTableName = generateTabularTableName(tableName, tableField.id)

// After
const tabularTableName = generateChildTableName(tableField.id)
```

**Change** at L676 (enum sync table name):
```typescript
// Before
trx.withSchema(schemaName).table('_app_enum_values')

// After
trx.withSchema(schemaName).table('_app_values')
```

#### Step 2.4: Update template seed files

In `TemplateSeedExecutor.ts` and `TemplateSeedMigrator.ts`:
```typescript
// Before
'_mhb_enum_values'

// After
'_mhb_values'
```

#### Step 2.5: Update tests

- `structureVersions.test.ts`: Update expected table names
- `metahubSchemaService.test.ts`: Update expected table names

---

### Phase 3: Applications Backend (`@universo/applications-backend`)

#### Step 3.1: Update import in `applicationsRoutes.ts`

**Change** at L7:
```typescript
// Before
import { cloneSchemaWithExecutor, generateSchemaName, isValidSchemaName, generateTabularTableName } from '@universo/schema-ddl'

// After
import { cloneSchemaWithExecutor, generateSchemaName, isValidSchemaName, generateChildTableName } from '@universo/schema-ddl'
```

#### Step 3.2: Replace 5 calls to `generateTabularTableName`

At L734, L1501, L1891, L2160, L2250:
```typescript
// Before
const fallbackTabTableName = generateTabularTableName(activeCatalog.table_name, tAttr.id)
// or
const fallbackTabTableName = generateTabularTableName(catalog.table_name, tAttr.id)

// After
const fallbackTabTableName = generateChildTableName(tAttr.id)
```

> **Key simplification**: The new function only needs `tAttr.id`. No need to resolve `catalog.table_name` first. This simplifies the calling code.

#### Step 3.3: Replace `_app_enum_values` references

At L591, L1286:
```typescript
// Before
'_app_enum_values'

// After
'_app_values'
```

#### Step 3.4: `resolveTabularContext` helper

At L2207+ — this helper function resolves tabular table context. Update its internal call:
```typescript
// Before
const tabularTableName = generateTabularTableName(catalog.table_name, tableAttr.id)

// After
const tabularTableName = generateChildTableName(tableAttr.id)
```

#### Step 3.5: Update tests

`applicationsRoutes.test.ts` — 2 SQL pattern matchers:
- L751: `sql.includes('FROM "app_runtime_test"._app_enum_values')` → `sql.includes('FROM "app_runtime_test"._app_values')`
- L803: Same pattern, same replacement

---

### Phase 4: Frontend Packages

#### Step 4.1: `apps-template-mui` — No structural changes

The frontend uses URL-based API calls (`/api/v1/applications/:id/runtime/rows/:rowId/tabular/:attributeId/...`). The actual table name is resolved server-side. Frontend code does NOT contain table name generation logic.

**`_tp_sort_order` and `_tp_parent_id`** column names remain unchanged — they are internal child table column names, not related to the table naming convention.

Frontend files affected: **NONE** for this architectural change.

#### Step 4.2: `metahubs-frontend` — Comment update only

At types.ts L355:
```typescript
// Before
/** Stores value options in _mhb_enum_values. */

// After
/** Stores value options in _mhb_values. */
```

#### Step 4.3: `@universo/types` — Comment updates only

At common/metahubs.ts L253, L289:
```typescript
// Update any JSDoc comments that reference the old table names
```

---

### Phase 5: Verification & Cleanup

#### Step 5.1: Build verification
```bash
# Build the core DDL package first (dependency for all backends)
pnpm --filter @universo/schema-ddl build

# Build affected backend packages
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/applications-backend build

# Build affected frontend packages
pnpm --filter apps-template-mui build
pnpm --filter @universo/metahubs-frontend build

# Full workspace build
pnpm build
```

#### Step 5.2: Lint verification
```bash
pnpm --filter @universo/schema-ddl lint
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/applications-backend lint
```

#### Step 5.3: Global grep for remnants
```bash
# Verify no references remain
grep -rn '_app_enum_values\|_mhb_enum_values' packages/*/base/src/ --include='*.ts' --include='*.tsx'
grep -rn 'generateTabularTableName' packages/*/base/src/ --include='*.ts' --include='*.tsx'
grep -rn '_tp_\b' packages/*/base/src/ --include='*.ts' --include='*.tsx' | grep -v '_tp_parent_id\|_tp_sort_order'
```

#### Step 5.4: Update memory-bank
- `tasks.md` → mark completed
- `activeContext.md` → describe what was done
- `progress.md` → add milestone
- `systemPatterns.md` → update table naming pattern

---

## Potential Challenges & Mitigations

### Challenge 1: Snapshot Version Compatibility

**Risk**: Existing snapshots stored in `_app_migrations.meta` use `CURRENT_SCHEMA_SNAPSHOT_VERSION = 1` with old table names.

**Mitigation**: Since the test database will be deleted and recreated, all old snapshots become irrelevant. Incrementing version to `2` is purely informational — no migration mapper is needed.

### Challenge 2: `_app_attributes` Metadata in Existing Apps

**Risk**: `_app_attributes` rows store `column_name` which for TABLE fields contained the old tabular table name format.

**Mitigation**: New apps created after this change will use `tbl_*` naming. The DB reset eliminates old data. The `syncSystemMetadata()` method in `SchemaGenerator.ts` will need to correctly store the new format.

### Challenge 3: FK from User Data Tables to `_app_values`

**Risk**: `SchemaMigrator.ts` L299 hardcodes `targetTableName = '_app_enum_values'` for ENUMERATION kind FKs. If changed to `_app_values`, all NEW apps get correct FKs.

**Mitigation**: Clean rename, DB reset removes old FKs.

### Challenge 4: Test Coverage

**Risk**: Multiple test files reference old table names and function names.

**Mitigation**: Update all tests in the same phase as the source code. Use grep to find all remaining references.

### Challenge 5: `SchemaGenerator.createTabularTable` Receives `parentTableName` That Is No Longer Needed for Naming

**Risk**: Method signature includes a parameter (`parentTableName`) that is used ONLY for the FK constraint, not for the table name.

**Mitigation**: Keep the parameter — it IS needed for the FK `_tp_parent_id REFERENCES parent_table(id) ON DELETE CASCADE`. The naming is decoupled, but the FK still points to the parent.

---

## Junction Table Architecture — Future Design Notes

> This is NOT part of the current implementation. Documenting for future reference.

The `tbl_<UUIDv7>` naming convention enables future junction table support:

```
                    ┌─── cat_<catalogA> (parent 1)
                    │
tbl_<UUIDv7> ──────┤    junction table: tbl_<UUIDv7>_parents
                    │
                    └─── doc_<documentB> (parent 2)
```

**Future migration path**:
1. Add `_tbl_parents` junction table alongside child table
2. Move `_tp_parent_id` FK to junction table
3. Child table rows linked to multiple parents via junction entries
4. No renaming needed — table names are already parent-agnostic

---

## Summary Checklist

### Phase 1: `@universo/schema-ddl` (6 source files + 4 test files)
- [ ] Step 1.1: Rename `generateTabularTableName` → `generateChildTableName` in `naming.ts`
- [ ] Step 1.2: Update public exports in `index.ts`
- [ ] Step 1.3: Verify `types.ts` — no changes needed
- [ ] Step 1.4: Update `snapshot.ts` (import + call + version bump)
- [ ] Step 1.5: Update `diff.ts` (import + 2 calls)
- [ ] Step 1.6a: Update `SchemaGenerator.ts` — internal naming call (L302)
- [ ] Step 1.6b: Update `SchemaGenerator.ts` — import
- [ ] Step 1.6c: Rename `_app_enum_values` → `_app_values` in `SchemaGenerator.ts` (18 occurrences)
- [ ] Step 1.6d: Update remaining `generateTabularTableName` calls (L143, L1029) + log (L113) + comment (L117) + log/SQL (L432, L438, L953, L958)
- [ ] Step 1.7: Update `SchemaMigrator.ts` — FK target table name
- [ ] Step 1.8: Update all DDL tests (naming 15+, snapshot 3, diff 7, migrator 2)

### Phase 2: `@universo/metahubs-backend` (6+ source files + 2 test files)
- [ ] Step 2.0: Update re-export `generateTabularTableName` → `generateChildTableName` in `ddl/index.ts`
- [ ] Step 2.1: Rename `_mhb_enum_values` → `_mhb_values` in `systemTableDefinitions.ts`
- [ ] Step 2.2: Update `MetahubEnumerationValuesService.ts` (25+ refs)
- [ ] Step 2.3: Update `applicationSyncRoutes.ts` (import + call + enum table)
- [ ] Step 2.4: Update template seed files (2 files, 6 refs total)
- [ ] Step 2.5: Update tests

### Phase 3: `@universo/applications-backend` (1 source file + 1 test file)
- [ ] Step 3.1: Update import in `applicationsRoutes.ts`
- [ ] Step 3.2: Replace 5 calls to `generateTabularTableName`
- [ ] Step 3.3: Replace 2 `_app_enum_values` references
- [ ] Step 3.4: Update `resolveTabularContext` helper
- [ ] Step 3.5: Update tests (2 SQL pattern matchers at L751, L803)

### Phase 4: Frontend (comment-only changes)
- [ ] Step 4.1: Verify `apps-template-mui` — no changes needed
- [ ] Step 4.2: Update comment in `metahubs-frontend` types.ts
- [ ] Step 4.3: Update comments in `@universo/types`

### Phase 5: Verification
- [ ] Step 5.1: Build verification (`pnpm build`)
- [ ] Step 5.2: Lint verification
- [ ] Step 5.3: Global grep for remnants
- [ ] Step 5.4: Update memory-bank
