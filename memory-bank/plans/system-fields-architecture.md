# System Fields Architecture Plan

## Overview

This plan describes the implementation of a three-level system fields architecture for the Universo Platform, providing soft delete functionality and other system-level metadata across Platform, Metahub, and Application levels.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PLATFORM LEVEL (_upl_*)                                                │
│  • Global administrators only                                           │
│  • Physical deletion scheduling, account blocking                       │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  METAHUB LEVEL (_mhb_*)                                             ││
│  │  • Configuration developers                                         ││
│  │  • Versioning, branches, design-time trash                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │  APPLICATION LEVEL (_app_*)                                     │││
│  │  │  • End users                                                    │││
│  │  │  • Publishing, archiving, access control                       │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP - Metahub-Level Soft Delete (_mhb_*)

### 1.1 System Fields Specification

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_mhb_deleted_at` | `TIMESTAMPTZ` | `NULL` | Soft delete timestamp |
| `_mhb_deleted_by` | `UUID` | `NULL` | User who deleted |
| `_mhb_version` | `INTEGER` | `1` | Optimistic locking version |

### 1.2 Database Schema Changes

#### File: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

**Current tables to modify:**
- `_mhb_objects` (lines 195-205)
- `_mhb_attributes` (lines 210-227)
- `_mhb_elements` (lines 232-250)

**Code change for `_mhb_objects`:**

```typescript
// In initSystemTables() method, modify _mhb_objects table creation:
await this.knex.schema.withSchema(schemaName).createTable('_mhb_objects', (t) => {
    t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
    t.string('kind').notNullable().index()
    t.string('codename').notNullable()
    t.string('table_name').nullable()
    t.jsonb('presentation').defaultTo('{}')
    t.jsonb('config').defaultTo('{}')
    t.timestamps(true, true)

    // NEW: System fields for soft delete
    t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
    t.uuid('_mhb_deleted_by').nullable()
    t.integer('_mhb_version').notNullable().defaultTo(1)

    // MODIFIED: Partial unique index excluding deleted records
    // Note: Can't use t.unique() for partial index, use raw SQL below
})

// Add partial unique index (excludes soft-deleted records)
await this.knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mhb_objects_kind_codename_active
    ON "${schemaName}"._mhb_objects (kind, codename)
    WHERE _mhb_deleted_at IS NULL
`)

// Add index for trash queries
await this.knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_mhb_objects_deleted
    ON "${schemaName}"._mhb_objects (_mhb_deleted_at)
    WHERE _mhb_deleted_at IS NOT NULL
`)
```

**Same pattern for `_mhb_attributes`:**

```typescript
await this.knex.schema.withSchema(schemaName).createTable('_mhb_attributes', (t) => {
    t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
    t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
    t.string('codename').notNullable()
    t.string('data_type').notNullable()
    t.jsonb('presentation').defaultTo('{}')
    t.jsonb('validation_rules').defaultTo('{}')
    t.jsonb('ui_config').defaultTo('{}')
    t.integer('sort_order').defaultTo(0)
    t.boolean('is_required').defaultTo(false)
    t.string('target_object_id').nullable()
    t.timestamps(true, true)

    // NEW: System fields
    t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
    t.uuid('_mhb_deleted_by').nullable()
    t.integer('_mhb_version').notNullable().defaultTo(1)

    // Performance indexes
    t.index(['object_id'], 'idx_mhb_attributes_object_id')
    t.index(['target_object_id'], 'idx_mhb_attributes_target_object_id')
})

// Partial unique index
await this.knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mhb_attributes_object_codename_active
    ON "${schemaName}"._mhb_attributes (object_id, codename)
    WHERE _mhb_deleted_at IS NULL
`)
```

**Same pattern for `_mhb_elements`:**

```typescript
await this.knex.schema.withSchema(schemaName).createTable('_mhb_elements', (t) => {
    t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
    t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
    t.jsonb('data').notNullable().defaultTo('{}')
    t.integer('sort_order').defaultTo(0)
    t.uuid('owner_id').nullable()
    t.timestamps(true, true)

    // NEW: System fields
    t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
    t.uuid('_mhb_deleted_by').nullable()
    t.integer('_mhb_version').notNullable().defaultTo(1)

    // Performance indexes
    t.index(['object_id'], 'idx_mhb_elements_object_id')
    t.index(['object_id', 'sort_order'], 'idx_mhb_elements_object_sort')
    t.index(['owner_id'], 'idx_mhb_elements_owner_id')
})
```

### 1.3 Migration for Existing Schemas

#### File: `packages/metahubs-backend/base/src/database/migrations/postgres/1737820800000-AddSoftDeleteToMetahubTables.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSoftDeleteToMetahubTables1737820800000 implements MigrationInterface {
    name = 'AddSoftDeleteToMetahubTables1737820800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Get all metahub schemas (mhb_*)
        const schemas = await queryRunner.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name LIKE 'mhb_%'
        `)

        for (const { schema_name } of schemas) {
            // Add columns to _mhb_objects
            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_objects
                ADD COLUMN IF NOT EXISTS _mhb_deleted_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS _mhb_deleted_by UUID,
                ADD COLUMN IF NOT EXISTS _mhb_version INTEGER NOT NULL DEFAULT 1
            `)

            // Drop old unique constraint and create partial index
            await queryRunner.query(`
                DROP INDEX IF EXISTS "${schema_name}"._mhb_objects_kind_codename_unique;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_mhb_objects_kind_codename_active
                ON "${schema_name}"._mhb_objects (kind, codename)
                WHERE _mhb_deleted_at IS NULL
            `)

            // Add columns to _mhb_attributes
            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_attributes
                ADD COLUMN IF NOT EXISTS _mhb_deleted_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS _mhb_deleted_by UUID,
                ADD COLUMN IF NOT EXISTS _mhb_version INTEGER NOT NULL DEFAULT 1
            `)

            await queryRunner.query(`
                DROP INDEX IF EXISTS "${schema_name}"._mhb_attributes_object_id_codename_unique;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_mhb_attributes_object_codename_active
                ON "${schema_name}"._mhb_attributes (object_id, codename)
                WHERE _mhb_deleted_at IS NULL
            `)

            // Add columns to _mhb_elements
            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_elements
                ADD COLUMN IF NOT EXISTS _mhb_deleted_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS _mhb_deleted_by UUID,
                ADD COLUMN IF NOT EXISTS _mhb_version INTEGER NOT NULL DEFAULT 1
            `)

            // Add trash index
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS idx_mhb_objects_deleted
                ON "${schema_name}"._mhb_objects (_mhb_deleted_at)
                WHERE _mhb_deleted_at IS NOT NULL
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const schemas = await queryRunner.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name LIKE 'mhb_%'
        `)

        for (const { schema_name } of schemas) {
            // Restore original unique constraints
            await queryRunner.query(`
                DROP INDEX IF EXISTS "${schema_name}".idx_mhb_objects_kind_codename_active;
                CREATE UNIQUE INDEX IF NOT EXISTS _mhb_objects_kind_codename_unique
                ON "${schema_name}"._mhb_objects (kind, codename)
            `)

            await queryRunner.query(`
                DROP INDEX IF EXISTS "${schema_name}".idx_mhb_attributes_object_codename_active;
                CREATE UNIQUE INDEX IF NOT EXISTS _mhb_attributes_object_id_codename_unique
                ON "${schema_name}"._mhb_attributes (object_id, codename)
            `)

            // Remove columns
            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_objects
                DROP COLUMN IF EXISTS _mhb_deleted_at,
                DROP COLUMN IF EXISTS _mhb_deleted_by,
                DROP COLUMN IF EXISTS _mhb_version
            `)

            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_attributes
                DROP COLUMN IF EXISTS _mhb_deleted_at,
                DROP COLUMN IF EXISTS _mhb_deleted_by,
                DROP COLUMN IF EXISTS _mhb_version
            `)

            await queryRunner.query(`
                ALTER TABLE "${schema_name}"._mhb_elements
                DROP COLUMN IF EXISTS _mhb_deleted_at,
                DROP COLUMN IF EXISTS _mhb_deleted_by,
                DROP COLUMN IF EXISTS _mhb_version
            `)
        }
    }
}
```

### 1.4 Service Layer Changes

#### Base Query Builder Helper

Create a new file: `packages/metahubs-backend/base/src/domains/metahubs/services/queryHelpers.ts`

```typescript
import { Knex } from 'knex'

export interface SoftDeleteOptions {
    includeDeleted?: boolean
    onlyDeleted?: boolean
}

/**
 * Applies soft delete filter to a query builder.
 * By default, excludes soft-deleted records.
 */
export function applySoftDeleteFilter<T extends Knex.QueryBuilder>(
    query: T,
    options: SoftDeleteOptions = {}
): T {
    const { includeDeleted = false, onlyDeleted = false } = options

    if (onlyDeleted) {
        return query.whereNotNull('_mhb_deleted_at') as T
    }

    if (!includeDeleted) {
        return query.whereNull('_mhb_deleted_at') as T
    }

    return query
}

/**
 * Soft delete a record by setting _mhb_deleted_at timestamp.
 */
export async function softDelete(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string,
    userId?: string
): Promise<number> {
    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .whereNull('_mhb_deleted_at')
        .update({
            _mhb_deleted_at: knex.fn.now(),
            _mhb_deleted_by: userId ?? null,
            updated_at: knex.fn.now()
        })
}

/**
 * Restore a soft-deleted record.
 */
export async function restoreDeleted(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string
): Promise<number> {
    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .whereNotNull('_mhb_deleted_at')
        .update({
            _mhb_deleted_at: null,
            _mhb_deleted_by: null,
            updated_at: knex.fn.now()
        })
}

/**
 * Permanently delete a record (hard delete).
 */
export async function permanentDelete(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string
): Promise<number> {
    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .delete()
}
```

#### MetahubObjectsService Changes

File: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`

```typescript
import { applySoftDeleteFilter, softDelete, restoreDeleted, permanentDelete, SoftDeleteOptions } from './queryHelpers'

export class MetahubObjectsService {
    // ... constructor and other methods ...

    /**
     * Find all objects (excludes deleted by default).
     */
    async findAll(
        metahubId: string,
        kind?: string,
        userId?: string,
        options: SoftDeleteOptions = {}
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        let query = this.knex
            .withSchema(schemaName)
            .select('*')
            .from('_mhb_objects')

        if (kind) {
            query = query.where({ kind })
        }

        query = applySoftDeleteFilter(query, options)

        return query.orderBy('created_at', 'asc')
    }

    /**
     * Find by ID (excludes deleted by default).
     */
    async findById(
        metahubId: string,
        id: string,
        userId?: string,
        options: SoftDeleteOptions = {}
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        let query = this.knex
            .withSchema(schemaName)
            .select('*')
            .from('_mhb_objects')
            .where({ id })
            .first()

        query = applySoftDeleteFilter(query, options)

        return query
    }

    /**
     * Soft delete an object (move to trash).
     */
    async delete(metahubId: string, id: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const deleted = await softDelete(this.knex, schemaName, '_mhb_objects', id, userId)

        if (deleted === 0) {
            throw new Error('Object not found or already deleted')
        }

        // Cascade soft delete to attributes and elements
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: id })
            .whereNull('_mhb_deleted_at')
            .update({
                _mhb_deleted_at: this.knex.fn.now(),
                _mhb_deleted_by: userId ?? null,
                updated_at: this.knex.fn.now()
            })

        await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ object_id: id })
            .whereNull('_mhb_deleted_at')
            .update({
                _mhb_deleted_at: this.knex.fn.now(),
                _mhb_deleted_by: userId ?? null,
                updated_at: this.knex.fn.now()
            })
    }

    /**
     * Restore a soft-deleted object from trash.
     */
    async restore(metahubId: string, id: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const restored = await restoreDeleted(this.knex, schemaName, '_mhb_objects', id)

        if (restored === 0) {
            throw new Error('Object not found in trash')
        }

        // Cascade restore to attributes and elements
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: id })
            .whereNotNull('_mhb_deleted_at')
            .update({
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                updated_at: this.knex.fn.now()
            })

        await this.knex
            .withSchema(schemaName)
            .from('_mhb_elements')
            .where({ object_id: id })
            .whereNotNull('_mhb_deleted_at')
            .update({
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                updated_at: this.knex.fn.now()
            })
    }

    /**
     * Permanently delete an object (hard delete).
     * Only works for already soft-deleted objects.
     */
    async permanentDelete(metahubId: string, id: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // Verify object is in trash first
        const object = await this.findById(metahubId, id, userId, { onlyDeleted: true })
        if (!object) {
            throw new Error('Object not found in trash. Use delete() first.')
        }

        // CASCADE will handle attributes and elements via FK
        await permanentDelete(this.knex, schemaName, '_mhb_objects', id)
    }

    /**
     * List deleted objects (trash).
     */
    async findDeleted(metahubId: string, kind?: string, userId?: string) {
        return this.findAll(metahubId, kind, userId, { onlyDeleted: true })
    }
}
```

### 1.5 API Routes Changes

#### File: `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts`

Add new endpoints:

```typescript
// GET /metahub/:metahubId/catalogs/trash - List deleted catalogs
router.get(
    '/metahub/:metahubId/catalogs/trash',
    asyncHandler(async (req: Request, res: Response) => {
        const { metahubId } = req.params
        const userId = req.user?.id

        const catalogs = await objectsService.findDeleted(metahubId, 'CATALOG', userId)

        res.json(catalogs)
    })
)

// POST /metahub/:metahubId/catalog/:catalogId/restore - Restore from trash
router.post(
    '/metahub/:metahubId/catalog/:catalogId/restore',
    asyncHandler(async (req: Request, res: Response) => {
        const { metahubId, catalogId } = req.params
        const userId = req.user?.id

        await objectsService.restore(metahubId, catalogId, userId)

        res.json({ success: true, message: 'Catalog restored' })
    })
)

// DELETE /metahub/:metahubId/catalog/:catalogId?permanent=true - Permanent delete
router.delete(
    '/metahub/:metahubId/catalog/:catalogId',
    asyncHandler(async (req: Request, res: Response) => {
        const { metahubId, catalogId } = req.params
        const { permanent } = req.query
        const userId = req.user?.id

        if (permanent === 'true') {
            await objectsService.permanentDelete(metahubId, catalogId, userId)
            res.json({ success: true, message: 'Catalog permanently deleted' })
        } else {
            await objectsService.delete(metahubId, catalogId, userId)
            res.json({ success: true, message: 'Catalog moved to trash' })
        }
    })
)
```

---

## Phase 2: Application-Level Fields (_app_*)

### 2.1 System Fields Specification

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_app_deleted_at` | `TIMESTAMPTZ` | `NULL` | Application-level soft delete |
| `_app_deleted_by` | `UUID` | `NULL` | User who deleted |
| `_app_published` | `BOOLEAN` | `TRUE` | Publication status |
| `_app_published_at` | `TIMESTAMPTZ` | `NULL` | When published |
| `_app_owner_id` | `UUID` | `NULL` | Record owner for RLS |
| `_app_archived` | `BOOLEAN` | `FALSE` | Archived status |

### 2.2 SchemaGenerator Changes

#### File: `packages/schema-ddl/base/src/SchemaGenerator.ts`

Modify `createEntityTable` method (around line 177):

```typescript
private async createEntityTable(
    schemaName: string,
    tableName: string,
    entity: EntityDefinition,
    options: { includeAppFields?: boolean } = {}
): Promise<void> {
    const exists = await this.knex.schema.withSchema(schemaName).hasTable(tableName)
    if (exists) return

    await this.knex.schema.withSchema(schemaName).createTable(tableName, (table) => {
        // Core system columns
        table.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
        table.timestamp('created_at').notNullable().defaultTo(this.knex.fn.now())
        table.timestamp('updated_at').notNullable().defaultTo(this.knex.fn.now())

        // Application-level system fields (for app_* schemas)
        if (options.includeAppFields !== false) {
            table.timestamp('_app_deleted_at', { useTz: true }).nullable()
            table.uuid('_app_deleted_by').nullable()
            table.boolean('_app_published').notNullable().defaultTo(true)
            table.timestamp('_app_published_at', { useTz: true }).nullable()
            table.uuid('_app_owner_id').nullable()
            table.boolean('_app_archived').notNullable().defaultTo(false)
        }

        // Entity-specific columns from definition
        for (const field of entity.fields) {
            this.addColumnFromField(table, field)
        }
    })

    // Partial unique indexes for application tables
    if (options.includeAppFields !== false) {
        await this.knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_deleted
            ON "${schemaName}"."${tableName}" (_app_deleted_at)
            WHERE _app_deleted_at IS NOT NULL
        `)

        await this.knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_published
            ON "${schemaName}"."${tableName}" (_app_published)
            WHERE _app_published = true
        `)

        await this.knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_${tableName}_owner
            ON "${schemaName}"."${tableName}" (_app_owner_id)
            WHERE _app_owner_id IS NOT NULL
        `)
    }
}
```

---

## Phase 3: Platform-Level Fields (_upl_*)

### 3.1 System Fields Specification

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_upl_deleted_at` | `TIMESTAMPTZ` | `NULL` | Platform-level deletion |
| `_upl_deleted_by` | `UUID` | `NULL` | Admin who deleted |
| `_upl_purge_after` | `TIMESTAMPTZ` | `NULL` | Scheduled physical deletion |
| `_upl_locked` | `BOOLEAN` | `FALSE` | Platform lock |
| `_upl_locked_reason` | `TEXT` | `NULL` | Lock reason |

### 3.2 TypeORM Entity Changes

#### File: `packages/metahubs-backend/base/src/database/entities/Metahub.ts`

```typescript
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from 'typeorm'

@Entity({ schema: 'metahubs', name: 'metahubs' })
@Index('idx_metahubs_deleted', ['_upl_deleted_at'], { where: '"_upl_deleted_at" IS NOT NULL' })
export class Metahub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    codename?: string

    // ... other existing fields ...

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    // Platform-level system fields
    @Column({ name: '_upl_deleted_at', type: 'timestamptz', nullable: true })
    _uplDeletedAt?: Date

    @Column({ name: '_upl_deleted_by', type: 'uuid', nullable: true })
    _uplDeletedBy?: string

    @Column({ name: '_upl_purge_after', type: 'timestamptz', nullable: true })
    _uplPurgeAfter?: Date

    @Column({ name: '_upl_locked', type: 'boolean', default: false })
    _uplLocked!: boolean

    @Column({ name: '_upl_locked_reason', type: 'text', nullable: true })
    _uplLockedReason?: string
}
```

---

## Phase 4: Frontend Implementation

### 4.1 Type Definitions

#### File: `packages/metahubs-frontend/base/src/types.ts`

```typescript
// System fields interface for reuse
export interface SoftDeleteFields {
    _mhb_deleted_at?: string | null
    _mhb_deleted_by?: string | null
}

export interface Catalog extends SoftDeleteFields {
    id: string
    kind: 'CATALOG'
    codename: string
    table_name?: string
    presentation: VersionedLocalizedContent<string>
    config: CatalogConfig
    created_at: string
    updated_at: string
}

// Trash item wrapper with deletion metadata
export interface TrashItem<T> {
    item: T
    deletedAt: string
    deletedBy?: string
    deletedByName?: string
}
```

### 4.2 API Functions

#### File: `packages/metahubs-frontend/base/src/domains/catalogs/api/catalogs.ts`

```typescript
// List deleted catalogs
export const listDeletedCatalogs = async (
    metahubId: string,
    branchId?: string
): Promise<Catalog[]> => {
    const params = branchId ? { branchId } : {}
    const response = await apiClient.get(
        `/metahub/${metahubId}/catalogs/trash`,
        { params }
    )
    return response.data
}

// Restore catalog from trash
export const restoreCatalog = async (
    metahubId: string,
    catalogId: string
): Promise<void> => {
    await apiClient.post(`/metahub/${metahubId}/catalog/${catalogId}/restore`)
}

// Permanent delete
export const permanentDeleteCatalog = async (
    metahubId: string,
    catalogId: string
): Promise<void> => {
    await apiClient.delete(
        `/metahub/${metahubId}/catalog/${catalogId}`,
        { params: { permanent: 'true' } }
    )
}
```

### 4.3 Mutation Hooks

#### File: `packages/metahubs-frontend/base/src/domains/catalogs/hooks/mutations.ts`

```typescript
export function useRestoreCatalog() {
    const queryClient = useQueryClient()
    const { t } = useTranslation('metahubs')
    const { enqueueSnackbar } = useSnackbar()

    return useMutation({
        mutationFn: ({ metahubId, catalogId }: { metahubId: string; catalogId: string }) =>
            restoreCatalog(metahubId, catalogId),
        onSuccess: (_, { metahubId }) => {
            enqueueSnackbar(t('trash.restoreSuccess'), { variant: 'success' })
            // Invalidate both active and trash lists
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.trashCatalogs(metahubId) })
        },
        onError: (error) => {
            enqueueSnackbar(t('trash.restoreError'), { variant: 'error' })
        }
    })
}

export function usePermanentDeleteCatalog() {
    const queryClient = useQueryClient()
    const { t } = useTranslation('metahubs')
    const { enqueueSnackbar } = useSnackbar()

    return useMutation({
        mutationFn: ({ metahubId, catalogId }: { metahubId: string; catalogId: string }) =>
            permanentDeleteCatalog(metahubId, catalogId),
        onSuccess: (_, { metahubId }) => {
            enqueueSnackbar(t('trash.permanentDeleteSuccess'), { variant: 'success' })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.trashCatalogs(metahubId) })
        },
        onError: (error) => {
            enqueueSnackbar(t('trash.permanentDeleteError'), { variant: 'error' })
        }
    })
}
```

### 4.4 i18n Translations

#### File: `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json`

```json
{
    "trash": {
        "title": "Recycle Bin",
        "empty": "No deleted items",
        "restore": "Restore",
        "permanentDelete": "Delete Permanently",
        "restoreSuccess": "Item restored successfully",
        "restoreError": "Failed to restore item",
        "permanentDeleteSuccess": "Item permanently deleted",
        "permanentDeleteError": "Failed to delete item",
        "permanentDeleteWarning": "This will permanently delete the item. This action cannot be undone.",
        "confirmPermanentDelete": "Are you sure you want to permanently delete this item?",
        "deletedAt": "Deleted",
        "deletedBy": "Deleted by"
    }
}
```

#### File: `packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json`

```json
{
    "trash": {
        "title": "Корзина",
        "empty": "Нет удаленных элементов",
        "restore": "Восстановить",
        "permanentDelete": "Удалить навсегда",
        "restoreSuccess": "Элемент успешно восстановлен",
        "restoreError": "Не удалось восстановить элемент",
        "permanentDeleteSuccess": "Элемент окончательно удален",
        "permanentDeleteError": "Не удалось удалить элемент",
        "permanentDeleteWarning": "Это действие удалит элемент навсегда. Отменить его будет невозможно.",
        "confirmPermanentDelete": "Вы уверены, что хотите навсегда удалить этот элемент?",
        "deletedAt": "Удалено",
        "deletedBy": "Удалил"
    }
}
```

---

## Implementation Checklist

### Phase 1: MVP (_mhb_* fields) - Metahub Level

- [ ] 1.1 Create queryHelpers.ts with soft delete utilities
- [ ] 1.2 Modify MetahubSchemaService.ts - add system fields to table creation
- [ ] 1.3 Create migration for existing schemas
- [ ] 1.4 Update MetahubObjectsService.ts
- [ ] 1.5 Update MetahubAttributesService.ts
- [ ] 1.6 Update MetahubElementsService.ts
- [ ] 1.7 Update MetahubHubsService.ts
- [ ] 1.8 Add trash/restore routes to catalogsRoutes.ts
- [ ] 1.9 Add trash/restore routes to elementsRoutes.ts
- [ ] 1.10 Add trash/restore routes to hubsRoutes.ts
- [ ] 1.11 Add trash/restore routes to attributesRoutes.ts
- [ ] 1.12 Update frontend types.ts
- [ ] 1.13 Add API functions for trash operations
- [ ] 1.14 Add mutation hooks for restore/permanent delete
- [ ] 1.15 Create TrashPanel UI component
- [ ] 1.16 Add i18n translations
- [ ] 1.17 Update menu to include Trash link
- [ ] 1.18 Write tests for soft delete operations

### Phase 2: Application Level (_app_* fields)

- [ ] 2.1 Update SchemaGenerator.ts
- [ ] 2.2 Update DDL definitions
- [ ] 2.3 Create application-level soft delete service
- [ ] 2.4 Add API routes for application data
- [ ] 2.5 Frontend integration

### Phase 3: Platform Level (_upl_* fields)

- [ ] 3.1 Add fields to TypeORM entities
- [ ] 3.2 Create platform-level migration
- [ ] 3.3 Implement admin-only trash management
- [ ] 3.4 Create scheduled purge job

---

## Security Considerations

1. **Access Control**: Only users with appropriate permissions can restore or permanently delete items
2. **Audit Trail**: All deletions and restorations are logged with user ID and timestamp
3. **Cascade Protection**: Soft delete cascades to related records
4. **Unique Constraints**: Partial indexes ensure deleted records don't block new records with same codenames
5. **Platform Lock**: `_upl_locked` prevents any modifications when account is frozen

---

## Sources

- [TypeORM Soft Delete Documentation](https://typeorm.io)
- [TypeORM Best Practices - Medium](https://medium.com)
- [GitHub TypeORM Issues on Soft Delete](https://github.com/typeorm/typeorm/issues)
- [Stack Overflow - Soft Delete Patterns](https://stackoverflow.com)
