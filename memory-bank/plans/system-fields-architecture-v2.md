# System Fields Architecture Plan v2

## Executive Summary

This plan describes the implementation of a three-level system fields architecture for the Universo Platform. The architecture provides audit trails, soft delete functionality, and lifecycle management across Platform (`_upl_`), Metahub (`_mhb_`), and Application (`_app_`) levels.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Fields Specification](#2-system-fields-specification)
3. [Implementation Strategy](#3-implementation-strategy)
4. [Phase 1: Platform Level Fields](#4-phase-1-platform-level-fields)
5. [Phase 2: Metahub Level Fields](#5-phase-2-metahub-level-fields)
6. [Phase 3: Application Level Fields](#6-phase-3-application-level-fields)
7. [Migration Strategy](#7-migration-strategy)
8. [Code Examples](#8-code-examples)
9. [Testing Strategy](#9-testing-strategy)
10. [Rollback Plan](#10-rollback-plan)

---

## 1. Architecture Overview

### 1.1 Three-Level Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PLATFORM LEVEL (_upl_*)                                                         │
│ ═══════════════════════════════════════════════════════════════════════════════ │
│ • Global administrators / Technical support only                                │
│ • Physical deletion scheduling, account blocking                                │
│ • Audit trail: created/updated timestamps and user IDs                         │
│ • Optimistic locking via version counter                                        │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ METAHUB LEVEL (_mhb_*)                                                      │ │
│ │ ═════════════════════════════════════════════════════════════════════════   │ │
│ │ • Configuration developers / Metahub administrators                         │ │
│ │ • Design-time drafts, archiving, trash (recycle bin)                       │ │
│ │ • Publication control for objects                                           │ │
│ │ ┌─────────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ APPLICATION LEVEL (_app_*)                                              │ │ │
│ │ │ ═══════════════════════════════════════════════════════════════════════ │ │ │
│ │ │ • End users / Application administrators                                │ │ │
│ │ │ • Runtime publishing, user-level archiving, user-level trash           │ │ │
│ │ │ • Owner-based access control (RLS)                                      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **No Physical Deletion by Users**: All user-initiated deletions are soft deletes
2. **Cascading Recovery**: Platform admins can recover any deleted data
3. **Audit Everything**: Every create/update/delete is tracked with user and timestamp
4. **Optimistic Locking**: Prevent concurrent modification conflicts
5. **Partial Unique Indexes**: Allow recreating records with same codenames after deletion

### 1.3 Question: Should `id` be renamed to `_upl_id`?

**Answer: NO** — Keep `id` as the primary key name.

**Reasons:**
1. PostgreSQL/Supabase conventions expect `id` as the primary key
2. TypeORM, Knex, and all ORMs use `id` by default
3. Foreign key references are cleaner: `user_id` → `users.id`
4. Supabase RLS policies and auth.uid() comparisons expect standard naming
5. The `_upl_` prefix is for **additional** system fields, not replacement of standard fields

---

## 2. System Fields Specification

### 2.1 Platform Level (`_upl_*`)

These fields appear on **ALL** entities across the platform.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `UUID` | `uuid_generate_v7()` | NO | Primary key (standard, no prefix) |
| `_upl_created_at` | `TIMESTAMPTZ` | `now()` | NO | Creation timestamp (replaces `created_at`) |
| `_upl_created_by` | `UUID` | - | YES | User who created the record |
| `_upl_updated_at` | `TIMESTAMPTZ` | `now()` | NO | Last update timestamp (replaces `updated_at`) |
| `_upl_updated_by` | `UUID` | - | YES | User who last updated |
| `_upl_version` | `INTEGER` | `1` | NO | Optimistic locking counter |
| `_upl_archived` | `BOOLEAN` | `false` | NO | Cold storage flag |
| `_upl_archived_at` | `TIMESTAMPTZ` | - | YES | When archived |
| `_upl_archived_by` | `UUID` | - | YES | Who archived |
| `_upl_deleted` | `BOOLEAN` | `false` | NO | Platform-level soft delete |
| `_upl_deleted_at` | `TIMESTAMPTZ` | - | YES | When deleted (platform level) |
| `_upl_deleted_by` | `UUID` | - | YES | Who deleted (platform level) |
| `_upl_purge_after` | `TIMESTAMPTZ` | - | YES | Scheduled physical deletion date |
| `_upl_locked` | `BOOLEAN` | `false` | NO | Account/record lock |
| `_upl_locked_at` | `TIMESTAMPTZ` | - | YES | When locked |
| `_upl_locked_by` | `UUID` | - | YES | Who locked |
| `_upl_locked_reason` | `TEXT` | - | YES | Lock reason |

### 2.2 Metahub Level (`_mhb_*`)

These fields appear on entities within **Metahub schemas** (dynamic tables in `mhb_*` schemas).

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `_mhb_published` | `BOOLEAN` | `true` | NO | Published/draft status |
| `_mhb_published_at` | `TIMESTAMPTZ` | - | YES | When published |
| `_mhb_published_by` | `UUID` | - | YES | Who published |
| `_mhb_archived` | `BOOLEAN` | `false` | NO | Metahub-level archive |
| `_mhb_archived_at` | `TIMESTAMPTZ` | - | YES | When archived |
| `_mhb_archived_by` | `UUID` | - | YES | Who archived |
| `_mhb_deleted` | `BOOLEAN` | `false` | NO | Metahub-level soft delete (trash) |
| `_mhb_deleted_at` | `TIMESTAMPTZ` | - | YES | When deleted |
| `_mhb_deleted_by` | `UUID` | - | YES | Who deleted |
| `_mhb_order` | `INTEGER` | `0` | NO | Sort order for UI |
| `_mhb_readonly` | `BOOLEAN` | `false` | NO | Write protection |

### 2.3 Application Level (`_app_*`)

These fields appear on entities within **Application schemas** (dynamic tables in `app_*` schemas).

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `_app_published` | `BOOLEAN` | `true` | NO | Published/draft status |
| `_app_published_at` | `TIMESTAMPTZ` | - | YES | When published |
| `_app_published_by` | `UUID` | - | YES | Who published |
| `_app_archived` | `BOOLEAN` | `false` | NO | Application-level archive |
| `_app_archived_at` | `TIMESTAMPTZ` | - | YES | When archived |
| `_app_archived_by` | `UUID` | - | YES | Who archived |
| `_app_deleted` | `BOOLEAN` | `false` | NO | Application-level soft delete (user trash) |
| `_app_deleted_at` | `TIMESTAMPTZ` | - | YES | When deleted |
| `_app_deleted_by` | `UUID` | - | YES | Who deleted |
| `_app_owner_id` | `UUID` | - | YES | Record owner for RLS |
| `_app_access_level` | `VARCHAR(20)` | `'private'` | NO | Access: private/team/public |

---

## 3. Implementation Strategy

### 3.1 Files to Modify

#### TypeORM Migrations (Platform-level fields for static tables)

| File | Tables Affected |
|------|-----------------|
| `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts` | `metahubs`, `metahubs_branches`, `metahubs_users`, `publications`, `publication_versions` |
| `packages/applications-backend/base/src/database/migrations/postgres/1800000000000-CreateApplicationsSchema.ts` | `applications`, `connectors`, `connectors_publications`, `applications_users` |

#### TypeORM Entities (Platform-level fields)

| File | Entity |
|------|--------|
| `packages/metahubs-backend/base/src/database/entities/Metahub.ts` | Metahub |
| `packages/metahubs-backend/base/src/database/entities/MetahubBranch.ts` | MetahubBranch |
| `packages/metahubs-backend/base/src/database/entities/MetahubUser.ts` | MetahubUser |
| `packages/metahubs-backend/base/src/database/entities/Publication.ts` | Publication |
| `packages/metahubs-backend/base/src/database/entities/PublicationVersion.ts` | PublicationVersion |
| `packages/applications-backend/base/src/database/entities/Application.ts` | Application |
| `packages/applications-backend/base/src/database/entities/Connector.ts` | Connector |
| `packages/applications-backend/base/src/database/entities/ConnectorPublication.ts` | ConnectorPublication |
| `packages/applications-backend/base/src/database/entities/ApplicationUser.ts` | ApplicationUser |

#### Dynamic Schema Services (Metahub & Application level fields)

| File | Dynamic Tables |
|------|----------------|
| `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts` | `_mhb_objects`, `_mhb_attributes`, `_mhb_elements` |
| `packages/schema-ddl/base/src/SchemaGenerator.ts` | Application data tables (`cat_*`, `doc_*`, etc.) |

### 3.2 Approach: Modify Existing Migrations

Since the test database will be recreated, we will **modify the existing migrations** rather than creating new ones. This ensures:

1. Clean schema from the start
2. No migration chain complexity
3. Consistent field naming from day one

---

## 4. Phase 1: Platform Level Fields

### 4.1 Base Entity Pattern

Create a shared base entity for consistent field definitions.

#### File: `packages/shared-backend/base/src/database/entities/PlatformBaseEntity.ts`

```typescript
import {
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeUpdate,
    VersionColumn
} from 'typeorm'

/**
 * Base entity with platform-level system fields (_upl_*).
 * All entities should extend this class for consistent audit and lifecycle management.
 */
export abstract class PlatformBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    // ═══════════════════════════════════════════════════════════════════════════
    // Audit Fields
    // ═══════════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: '_upl_created_at', type: 'timestamptz' })
    _uplCreatedAt!: Date

    @Column({ name: '_upl_created_by', type: 'uuid', nullable: true })
    _uplCreatedBy?: string

    @UpdateDateColumn({ name: '_upl_updated_at', type: 'timestamptz' })
    _uplUpdatedAt!: Date

    @Column({ name: '_upl_updated_by', type: 'uuid', nullable: true })
    _uplUpdatedBy?: string

    @VersionColumn({ name: '_upl_version', default: 1 })
    _uplVersion!: number

    // ═══════════════════════════════════════════════════════════════════════════
    // Archive Fields
    // ═══════════════════════════════════════════════════════════════════════════

    @Column({ name: '_upl_archived', type: 'boolean', default: false })
    _uplArchived!: boolean

    @Column({ name: '_upl_archived_at', type: 'timestamptz', nullable: true })
    _uplArchivedAt?: Date

    @Column({ name: '_upl_archived_by', type: 'uuid', nullable: true })
    _uplArchivedBy?: string

    // ═══════════════════════════════════════════════════════════════════════════
    // Soft Delete Fields (Platform Level)
    // ═══════════════════════════════════════════════════════════════════════════

    @Column({ name: '_upl_deleted', type: 'boolean', default: false })
    _uplDeleted!: boolean

    @Column({ name: '_upl_deleted_at', type: 'timestamptz', nullable: true })
    _uplDeletedAt?: Date

    @Column({ name: '_upl_deleted_by', type: 'uuid', nullable: true })
    _uplDeletedBy?: string

    @Column({ name: '_upl_purge_after', type: 'timestamptz', nullable: true })
    _uplPurgeAfter?: Date

    // ═══════════════════════════════════════════════════════════════════════════
    // Lock Fields
    // ═══════════════════════════════════════════════════════════════════════════

    @Column({ name: '_upl_locked', type: 'boolean', default: false })
    _uplLocked!: boolean

    @Column({ name: '_upl_locked_at', type: 'timestamptz', nullable: true })
    _uplLockedAt?: Date

    @Column({ name: '_upl_locked_by', type: 'uuid', nullable: true })
    _uplLockedBy?: string

    @Column({ name: '_upl_locked_reason', type: 'text', nullable: true })
    _uplLockedReason?: string
}
```

### 4.2 Updated Metahub Entity

#### File: `packages/metahubs-backend/base/src/database/entities/Metahub.ts`

```typescript
import { Entity, Column } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { PlatformBaseEntity } from '@universo/shared-backend'

/**
 * Metahub entity - represents a configuration/module in the metadata-driven platform
 */
@Entity({ name: 'metahubs', schema: 'metahubs' })
export class Metahub extends PlatformBaseEntity {
    /** Localized name using VLC pattern */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** Unique codename for internal references (e.g., "crm-core") */
    @Column({ type: 'varchar', length: 100, unique: true })
    codename!: string

    /** URL-friendly identifier for public access (e.g., "ideas", "products") */
    @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
    slug?: string

    /** Default branch for this metahub */
    @Column({ name: 'default_branch_id', type: 'uuid', nullable: true })
    defaultBranchId!: string | null

    /** Monotonic counter for branch numbers (used in schema names) */
    @Column({ name: 'last_branch_number', type: 'int', default: 0 })
    lastBranchNumber!: number

    /** Whether this metahub is publicly accessible via API */
    @Column({ type: 'boolean', default: false, name: 'is_public' })
    isPublic!: boolean
}
```

### 4.3 Updated Migration

#### File: `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`

```typescript
// In the up() method, replace the metahubs table creation:

await queryRunner.query(`
    CREATE TABLE metahubs.metahubs (
        id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
        name JSONB NOT NULL DEFAULT '{}',
        description JSONB DEFAULT '{}',
        codename VARCHAR(100) NOT NULL,
        slug VARCHAR(100),
        default_branch_id UUID,
        last_branch_number INT NOT NULL DEFAULT 0,
        is_public BOOLEAN NOT NULL DEFAULT false,

        -- Platform-level system fields (_upl_*)
        _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        _upl_created_by UUID,
        _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        _upl_updated_by UUID,
        _upl_version INTEGER NOT NULL DEFAULT 1,

        _upl_archived BOOLEAN NOT NULL DEFAULT false,
        _upl_archived_at TIMESTAMPTZ,
        _upl_archived_by UUID,

        _upl_deleted BOOLEAN NOT NULL DEFAULT false,
        _upl_deleted_at TIMESTAMPTZ,
        _upl_deleted_by UUID,
        _upl_purge_after TIMESTAMPTZ,

        _upl_locked BOOLEAN NOT NULL DEFAULT false,
        _upl_locked_at TIMESTAMPTZ,
        _upl_locked_by UUID,
        _upl_locked_reason TEXT
    )
`)

-- Partial unique index (excludes soft-deleted records)
await queryRunner.query(`
    CREATE UNIQUE INDEX idx_metahubs_codename_active
    ON metahubs.metahubs (codename)
    WHERE _upl_deleted = false
`)

await queryRunner.query(`
    CREATE UNIQUE INDEX idx_metahubs_slug_active
    ON metahubs.metahubs (slug)
    WHERE _upl_deleted = false AND slug IS NOT NULL
`)

-- Index for trash queries
await queryRunner.query(`
    CREATE INDEX idx_metahubs_deleted
    ON metahubs.metahubs (_upl_deleted_at)
    WHERE _upl_deleted = true
`)

-- Index for archived queries
await queryRunner.query(`
    CREATE INDEX idx_metahubs_archived
    ON metahubs.metahubs (_upl_archived)
    WHERE _upl_archived = true
`)
```

---

## 5. Phase 2: Metahub Level Fields

### 5.1 Updated MetahubSchemaService

#### File: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

Replace the `initSystemTables` method:

```typescript
/**
 * Initialize system tables in the isolated schema.
 * Includes platform-level (_upl_*) and metahub-level (_mhb_*) system fields.
 */
private async initSystemTables(schemaName: string): Promise<void> {
    // _mhb_objects: Unified registry for all object types
    const hasObjects = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_objects')
    if (!hasObjects) {
        await this.knex.schema.withSchema(schemaName).createTable('_mhb_objects', (t) => {
            // Primary key
            t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))

            // Business fields
            t.string('kind').notNullable().index() // 'CATALOG', 'HUB', 'DOCUMENT', etc.
            t.string('codename').notNullable()
            t.string('table_name').nullable()
            t.jsonb('presentation').defaultTo('{}')
            t.jsonb('config').defaultTo('{}')

            // ═══════════════════════════════════════════════════════════════
            // Platform-level system fields (_upl_*)
            // ═══════════════════════════════════════════════════════════════
            t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_created_by').nullable()
            t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_updated_by').nullable()
            t.integer('_upl_version').notNullable().defaultTo(1)

            t.boolean('_upl_archived').notNullable().defaultTo(false)
            t.timestamp('_upl_archived_at', { useTz: true }).nullable()
            t.uuid('_upl_archived_by').nullable()

            t.boolean('_upl_deleted').notNullable().defaultTo(false)
            t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            t.uuid('_upl_deleted_by').nullable()
            t.timestamp('_upl_purge_after', { useTz: true }).nullable()

            t.boolean('_upl_locked').notNullable().defaultTo(false)
            t.timestamp('_upl_locked_at', { useTz: true }).nullable()
            t.uuid('_upl_locked_by').nullable()
            t.text('_upl_locked_reason').nullable()

            // ═══════════════════════════════════════════════════════════════
            // Metahub-level system fields (_mhb_*)
            // ═══════════════════════════════════════════════════════════════
            t.boolean('_mhb_published').notNullable().defaultTo(true)
            t.timestamp('_mhb_published_at', { useTz: true }).nullable()
            t.uuid('_mhb_published_by').nullable()

            t.boolean('_mhb_archived').notNullable().defaultTo(false)
            t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
            t.uuid('_mhb_archived_by').nullable()

            t.boolean('_mhb_deleted').notNullable().defaultTo(false)
            t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
            t.uuid('_mhb_deleted_by').nullable()

            t.integer('_mhb_order').notNullable().defaultTo(0)
            t.boolean('_mhb_readonly').notNullable().defaultTo(false)
        })

        // Partial unique index (excludes deleted records at both levels)
        await this.knex.raw(`
            CREATE UNIQUE INDEX idx_${schemaName.replace(/-/g, '_')}_objects_kind_codename_active
            ON "${schemaName}"._mhb_objects (kind, codename)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)

        // Index for metahub trash queries
        await this.knex.raw(`
            CREATE INDEX idx_${schemaName.replace(/-/g, '_')}_objects_mhb_deleted
            ON "${schemaName}"._mhb_objects (_mhb_deleted_at)
            WHERE _mhb_deleted = true
        `)

        // Index for platform trash queries
        await this.knex.raw(`
            CREATE INDEX idx_${schemaName.replace(/-/g, '_')}_objects_upl_deleted
            ON "${schemaName}"._mhb_objects (_upl_deleted_at)
            WHERE _upl_deleted = true
        `)
    }

    // _mhb_attributes: Field definitions for objects
    const hasAttributes = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_attributes')
    if (!hasAttributes) {
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

            // Platform-level system fields
            t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_created_by').nullable()
            t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_updated_by').nullable()
            t.integer('_upl_version').notNullable().defaultTo(1)
            t.boolean('_upl_archived').notNullable().defaultTo(false)
            t.timestamp('_upl_archived_at', { useTz: true }).nullable()
            t.uuid('_upl_archived_by').nullable()
            t.boolean('_upl_deleted').notNullable().defaultTo(false)
            t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            t.uuid('_upl_deleted_by').nullable()
            t.timestamp('_upl_purge_after', { useTz: true }).nullable()
            t.boolean('_upl_locked').notNullable().defaultTo(false)
            t.timestamp('_upl_locked_at', { useTz: true }).nullable()
            t.uuid('_upl_locked_by').nullable()
            t.text('_upl_locked_reason').nullable()

            // Metahub-level system fields
            t.boolean('_mhb_published').notNullable().defaultTo(true)
            t.timestamp('_mhb_published_at', { useTz: true }).nullable()
            t.uuid('_mhb_published_by').nullable()
            t.boolean('_mhb_archived').notNullable().defaultTo(false)
            t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
            t.uuid('_mhb_archived_by').nullable()
            t.boolean('_mhb_deleted').notNullable().defaultTo(false)
            t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
            t.uuid('_mhb_deleted_by').nullable()
            t.integer('_mhb_order').notNullable().defaultTo(0)
            t.boolean('_mhb_readonly').notNullable().defaultTo(false)

            // Performance indexes
            t.index(['object_id'], 'idx_mhb_attributes_object_id')
            t.index(['target_object_id'], 'idx_mhb_attributes_target_object_id')
        })

        // Partial unique index
        await this.knex.raw(`
            CREATE UNIQUE INDEX idx_${schemaName.replace(/-/g, '_')}_attributes_object_codename_active
            ON "${schemaName}"._mhb_attributes (object_id, codename)
            WHERE _upl_deleted = false AND _mhb_deleted = false
        `)
    }

    // _mhb_elements: Predefined data for catalogs
    const hasElements = await this.knex.schema.withSchema(schemaName).hasTable('_mhb_elements')
    if (!hasElements) {
        await this.knex.schema.withSchema(schemaName).createTable('_mhb_elements', (t) => {
            t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))
            t.uuid('object_id').notNullable().references('id').inTable(`${schemaName}._mhb_objects`).onDelete('CASCADE')
            t.jsonb('data').notNullable().defaultTo('{}')
            t.integer('sort_order').defaultTo(0)
            t.uuid('owner_id').nullable()

            // Platform-level system fields
            t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_created_by').nullable()
            t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
            t.uuid('_upl_updated_by').nullable()
            t.integer('_upl_version').notNullable().defaultTo(1)
            t.boolean('_upl_archived').notNullable().defaultTo(false)
            t.timestamp('_upl_archived_at', { useTz: true }).nullable()
            t.uuid('_upl_archived_by').nullable()
            t.boolean('_upl_deleted').notNullable().defaultTo(false)
            t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
            t.uuid('_upl_deleted_by').nullable()
            t.timestamp('_upl_purge_after', { useTz: true }).nullable()
            t.boolean('_upl_locked').notNullable().defaultTo(false)
            t.timestamp('_upl_locked_at', { useTz: true }).nullable()
            t.uuid('_upl_locked_by').nullable()
            t.text('_upl_locked_reason').nullable()

            // Metahub-level system fields
            t.boolean('_mhb_published').notNullable().defaultTo(true)
            t.timestamp('_mhb_published_at', { useTz: true }).nullable()
            t.uuid('_mhb_published_by').nullable()
            t.boolean('_mhb_archived').notNullable().defaultTo(false)
            t.timestamp('_mhb_archived_at', { useTz: true }).nullable()
            t.uuid('_mhb_archived_by').nullable()
            t.boolean('_mhb_deleted').notNullable().defaultTo(false)
            t.timestamp('_mhb_deleted_at', { useTz: true }).nullable()
            t.uuid('_mhb_deleted_by').nullable()
            t.integer('_mhb_order').notNullable().defaultTo(0)
            t.boolean('_mhb_readonly').notNullable().defaultTo(false)

            // Performance indexes
            t.index(['object_id'], 'idx_mhb_elements_object_id')
            t.index(['object_id', 'sort_order'], 'idx_mhb_elements_object_sort')
            t.index(['owner_id'], 'idx_mhb_elements_owner_id')
        })

        // GIN index for JSONB search
        await this.knex.raw(`
            CREATE INDEX IF NOT EXISTS idx_mhb_elements_data_gin
            ON "${schemaName}"._mhb_elements USING GIN(data)
        `)
    }
}
```

---

## 6. Phase 3: Application Level Fields

### 6.1 SchemaGenerator for Application Tables

Application tables (`cat_*`, `doc_*`) include `_upl_*` and `_app_*` fields.

```typescript
/**
 * Creates a data table for a catalog in an application schema.
 */
async createCatalogTable(
    schemaName: string,
    tableName: string,
    attributes: Attribute[],
    userId?: string
): Promise<void> {
    await this.knex.schema.withSchema(schemaName).createTable(tableName, (t) => {
        // Primary key
        t.uuid('id').primary().defaultTo(this.knex.raw('public.uuid_generate_v7()'))

        // Dynamic attribute columns
        for (const attr of attributes) {
            this.addColumnForAttribute(t, attr)
        }

        // ═══════════════════════════════════════════════════════════════
        // Platform-level system fields (_upl_*)
        // ═══════════════════════════════════════════════════════════════
        t.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
        t.uuid('_upl_created_by').nullable()
        t.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(this.knex.fn.now())
        t.uuid('_upl_updated_by').nullable()
        t.integer('_upl_version').notNullable().defaultTo(1)
        t.boolean('_upl_archived').notNullable().defaultTo(false)
        t.timestamp('_upl_archived_at', { useTz: true }).nullable()
        t.uuid('_upl_archived_by').nullable()
        t.boolean('_upl_deleted').notNullable().defaultTo(false)
        t.timestamp('_upl_deleted_at', { useTz: true }).nullable()
        t.uuid('_upl_deleted_by').nullable()
        t.timestamp('_upl_purge_after', { useTz: true }).nullable()
        t.boolean('_upl_locked').notNullable().defaultTo(false)
        t.timestamp('_upl_locked_at', { useTz: true }).nullable()
        t.uuid('_upl_locked_by').nullable()
        t.text('_upl_locked_reason').nullable()

        // ═══════════════════════════════════════════════════════════════
        // Application-level system fields (_app_*)
        // ═══════════════════════════════════════════════════════════════
        t.boolean('_app_published').notNullable().defaultTo(true)
        t.timestamp('_app_published_at', { useTz: true }).nullable()
        t.uuid('_app_published_by').nullable()
        t.boolean('_app_archived').notNullable().defaultTo(false)
        t.timestamp('_app_archived_at', { useTz: true }).nullable()
        t.uuid('_app_archived_by').nullable()
        t.boolean('_app_deleted').notNullable().defaultTo(false)
        t.timestamp('_app_deleted_at', { useTz: true }).nullable()
        t.uuid('_app_deleted_by').nullable()
        t.uuid('_app_owner_id').nullable()
        t.string('_app_access_level', 20).notNullable().defaultTo('private')
    })

    // Indexes for application-level queries
    await this.knex.raw(`
        CREATE INDEX idx_${tableName}_app_deleted
        ON "${schemaName}"."${tableName}" (_app_deleted_at)
        WHERE _app_deleted = true
    `)

    await this.knex.raw(`
        CREATE INDEX idx_${tableName}_app_owner
        ON "${schemaName}"."${tableName}" (_app_owner_id)
        WHERE _app_owner_id IS NOT NULL
    `)

    await this.knex.raw(`
        CREATE INDEX idx_${tableName}_app_published
        ON "${schemaName}"."${tableName}" (_app_published)
        WHERE _app_published = true
    `)
}
```

### 6.2 Data Migration from Metahub to Application

When publishing a Metahub to an Application, system fields are populated:

```typescript
/**
 * Migrates data from Metahub to Application, populating system fields.
 */
async migrateDataToApplication(
    metahubSchemaName: string,
    appSchemaName: string,
    catalogId: string,
    tableName: string,
    userId: string
): Promise<void> {
    const now = new Date()

    // Get elements from metahub
    const elements = await this.knex
        .withSchema(metahubSchemaName)
        .select('*')
        .from('_mhb_elements')
        .where({ object_id: catalogId })
        .whereRaw('_upl_deleted = false AND _mhb_deleted = false')

    // Insert into application with system fields
    for (const element of elements) {
        await this.knex.withSchema(appSchemaName).table(tableName).insert({
            id: element.id,
            ...element.data,

            // Platform-level: inherit from metahub
            _upl_created_at: now,
            _upl_created_by: userId,
            _upl_updated_at: now,
            _upl_updated_by: userId,
            _upl_version: 1,
            _upl_archived: false,
            _upl_deleted: false,
            _upl_locked: false,

            // Application-level: inherit from metahub's _mhb_published
            _app_published: element._mhb_published ?? true,
            _app_published_at: element._mhb_published ? now : null,
            _app_published_by: element._mhb_published ? userId : null,
            _app_archived: false,
            _app_deleted: false,
            _app_owner_id: userId,
            _app_access_level: 'private'
        })
    }
}
```

---

## 7. Migration Strategy

### 7.1 Deletion Cascade Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DELETION CASCADE FLOW                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User clicks "Delete"                                                        │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ _app_deleted = true                                                     │ │
│  │ _app_deleted_at = now()                                                 │ │
│  │ _app_deleted_by = userId                                                │ │
│  │                                                                         │ │
│  │ → Record visible in Application Trash                                   │ │
│  │ → User can restore                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ Admin empties Application Trash (or auto after 30 days)           │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ _mhb_deleted = true (for Metahub data)                                  │ │
│  │ _mhb_deleted_at = now()                                                 │ │
│  │                                                                         │ │
│  │ → Record hidden from users                                              │ │
│  │ → Metahub admin can restore                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ Metahub admin empties Metahub Trash (or auto after 90 days)       │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ _upl_deleted = true                                                     │ │
│  │ _upl_deleted_at = now()                                                 │ │
│  │ _upl_purge_after = now() + 365 days                                     │ │
│  │                                                                         │ │
│  │ → Record only visible to Platform admins                                │ │
│  │ → Platform admin can restore                                            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ Scheduled job after _upl_purge_after date                         │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ DELETE FROM table WHERE id = ?                                          │ │
│  │                                                                         │ │
│  │ → Physical deletion                                                     │ │
│  │ → Data permanently removed                                              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Query Helpers

```typescript
// packages/shared-backend/base/src/database/queryHelpers.ts

export interface SoftDeleteOptions {
    includeAppDeleted?: boolean      // Include _app_deleted = true
    includeMhbDeleted?: boolean      // Include _mhb_deleted = true
    includeUplDeleted?: boolean      // Include _upl_deleted = true (admin only)
    onlyAppDeleted?: boolean         // Only _app_deleted = true (app trash)
    onlyMhbDeleted?: boolean         // Only _mhb_deleted = true (mhb trash)
    onlyUplDeleted?: boolean         // Only _upl_deleted = true (platform trash)
}

/**
 * Applies soft delete filters to a query.
 * By default, excludes all soft-deleted records.
 */
export function applySoftDeleteFilter<T extends Knex.QueryBuilder>(
    query: T,
    options: SoftDeleteOptions = {}
): T {
    const {
        includeAppDeleted = false,
        includeMhbDeleted = false,
        includeUplDeleted = false,
        onlyAppDeleted = false,
        onlyMhbDeleted = false,
        onlyUplDeleted = false
    } = options

    // "Only" filters (for trash views)
    if (onlyAppDeleted) {
        return query.where('_app_deleted', true) as T
    }
    if (onlyMhbDeleted) {
        return query.where('_mhb_deleted', true).where('_app_deleted', false) as T
    }
    if (onlyUplDeleted) {
        return query.where('_upl_deleted', true).where('_mhb_deleted', false) as T
    }

    // Exclusion filters (default behavior)
    if (!includeUplDeleted) {
        query = query.where('_upl_deleted', false) as T
    }
    if (!includeMhbDeleted) {
        query = query.where('_mhb_deleted', false) as T
    }
    if (!includeAppDeleted) {
        query = query.where('_app_deleted', false) as T
    }

    return query
}

/**
 * Performs a soft delete at the specified level.
 */
export async function softDelete(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string,
    userId: string,
    level: 'app' | 'mhb' | 'upl' = 'app'
): Promise<number> {
    const prefix = `_${level}_`
    const now = knex.fn.now()

    const update: Record<string, unknown> = {
        [`${prefix}deleted`]: true,
        [`${prefix}deleted_at`]: now,
        [`${prefix}deleted_by`]: userId,
        _upl_updated_at: now,
        _upl_updated_by: userId
    }

    // Set purge date for platform-level deletion
    if (level === 'upl') {
        update._upl_purge_after = knex.raw("now() + interval '365 days'")
    }

    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .where(`${prefix}deleted`, false)
        .update(update)
}

/**
 * Restores a soft-deleted record at the specified level.
 */
export async function restoreDeleted(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string,
    userId: string,
    level: 'app' | 'mhb' | 'upl' = 'app'
): Promise<number> {
    const prefix = `_${level}_`
    const now = knex.fn.now()

    const update: Record<string, unknown> = {
        [`${prefix}deleted`]: false,
        [`${prefix}deleted_at`]: null,
        [`${prefix}deleted_by`]: null,
        _upl_updated_at: now,
        _upl_updated_by: userId
    }

    if (level === 'upl') {
        update._upl_purge_after = null
    }

    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .where(`${prefix}deleted`, true)
        .update(update)
}
```

---

## 8. Code Examples

### 8.1 Service Layer Example

```typescript
// MetahubObjectsService - updated delete method

async delete(metahubId: string, id: string, userId: string): Promise<void> {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    // Soft delete at metahub level
    const deleted = await softDelete(
        this.knex,
        schemaName,
        '_mhb_objects',
        id,
        userId,
        'mhb'
    )

    if (deleted === 0) {
        throw new Error('Object not found or already deleted')
    }

    // Cascade soft delete to attributes
    await this.knex
        .withSchema(schemaName)
        .from('_mhb_attributes')
        .where({ object_id: id })
        .where('_mhb_deleted', false)
        .update({
            _mhb_deleted: true,
            _mhb_deleted_at: this.knex.fn.now(),
            _mhb_deleted_by: userId,
            _upl_updated_at: this.knex.fn.now(),
            _upl_updated_by: userId
        })

    // Cascade soft delete to elements
    await this.knex
        .withSchema(schemaName)
        .from('_mhb_elements')
        .where({ object_id: id })
        .where('_mhb_deleted', false)
        .update({
            _mhb_deleted: true,
            _mhb_deleted_at: this.knex.fn.now(),
            _mhb_deleted_by: userId,
            _upl_updated_at: this.knex.fn.now(),
            _upl_updated_by: userId
        })
}

async restore(metahubId: string, id: string, userId: string): Promise<void> {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    const restored = await restoreDeleted(
        this.knex,
        schemaName,
        '_mhb_objects',
        id,
        userId,
        'mhb'
    )

    if (restored === 0) {
        throw new Error('Object not found in trash')
    }

    // Cascade restore to attributes and elements
    await this.knex
        .withSchema(schemaName)
        .from('_mhb_attributes')
        .where({ object_id: id })
        .where('_mhb_deleted', true)
        .update({
            _mhb_deleted: false,
            _mhb_deleted_at: null,
            _mhb_deleted_by: null,
            _upl_updated_at: this.knex.fn.now(),
            _upl_updated_by: userId
        })

    await this.knex
        .withSchema(schemaName)
        .from('_mhb_elements')
        .where({ object_id: id })
        .where('_mhb_deleted', true)
        .update({
            _mhb_deleted: false,
            _mhb_deleted_at: null,
            _mhb_deleted_by: null,
            _upl_updated_at: this.knex.fn.now(),
            _upl_updated_by: userId
        })
}

async findDeleted(metahubId: string, kind?: string, userId?: string) {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    let query = this.knex
        .withSchema(schemaName)
        .select('*')
        .from('_mhb_objects')

    if (kind) {
        query = query.where({ kind })
    }

    // Only metahub-deleted, not platform-deleted
    query = applySoftDeleteFilter(query, { onlyMhbDeleted: true })

    return query.orderBy('_mhb_deleted_at', 'desc')
}
```

### 8.2 Optimistic Locking Example

```typescript
async update(
    metahubId: string,
    id: string,
    data: Partial<MhbObject>,
    userId: string,
    expectedVersion: number
): Promise<MhbObject> {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    const updated = await this.knex
        .withSchema(schemaName)
        .from('_mhb_objects')
        .where({ id })
        .where('_upl_version', expectedVersion)
        .where('_upl_deleted', false)
        .where('_mhb_deleted', false)
        .update({
            ...data,
            _upl_updated_at: this.knex.fn.now(),
            _upl_updated_by: userId,
            _upl_version: this.knex.raw('_upl_version + 1')
        })
        .returning('*')

    if (!updated || updated.length === 0) {
        // Check if record exists with different version
        const existing = await this.knex
            .withSchema(schemaName)
            .select('_upl_version')
            .from('_mhb_objects')
            .where({ id })
            .first()

        if (existing && existing._upl_version !== expectedVersion) {
            throw new OptimisticLockError(
                `Record was modified by another user. Expected version ${expectedVersion}, current version ${existing._upl_version}`
            )
        }

        throw new Error('Object not found')
    }

    return updated[0]
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('SoftDelete', () => {
    it('should soft delete at app level', async () => {
        const id = await createTestRecord()

        await softDelete(knex, schema, 'test_table', id, userId, 'app')

        const record = await knex.select('*').where({ id }).first()
        expect(record._app_deleted).toBe(true)
        expect(record._app_deleted_at).toBeDefined()
        expect(record._app_deleted_by).toBe(userId)
        expect(record._mhb_deleted).toBe(false)
        expect(record._upl_deleted).toBe(false)
    })

    it('should exclude soft-deleted records by default', async () => {
        const id = await createTestRecord()
        await softDelete(knex, schema, 'test_table', id, userId, 'app')

        let query = knex.select('*').from('test_table')
        query = applySoftDeleteFilter(query)

        const results = await query
        expect(results.find(r => r.id === id)).toBeUndefined()
    })

    it('should restore soft-deleted records', async () => {
        const id = await createTestRecord()
        await softDelete(knex, schema, 'test_table', id, userId, 'app')
        await restoreDeleted(knex, schema, 'test_table', id, userId, 'app')

        const record = await knex.select('*').where({ id }).first()
        expect(record._app_deleted).toBe(false)
        expect(record._app_deleted_at).toBeNull()
    })

    it('should cascade soft delete to child records', async () => {
        const objectId = await createTestObject()
        const attrId = await createTestAttribute(objectId)

        await objectsService.delete(metahubId, objectId, userId)

        const attr = await knex.select('*').where({ id: attrId }).first()
        expect(attr._mhb_deleted).toBe(true)
    })
})

describe('OptimisticLocking', () => {
    it('should increment version on update', async () => {
        const id = await createTestRecord()

        await service.update(metahubId, id, { name: 'Updated' }, userId, 1)

        const record = await knex.select('*').where({ id }).first()
        expect(record._upl_version).toBe(2)
    })

    it('should throw on version mismatch', async () => {
        const id = await createTestRecord()

        // Simulate concurrent update
        await knex.update({ _upl_version: 2 }).where({ id })

        await expect(
            service.update(metahubId, id, { name: 'Updated' }, userId, 1)
        ).rejects.toThrow(OptimisticLockError)
    })
})
```

---

## 10. Rollback Plan

### 10.1 If Issues Arise

1. **Database**: Since we're modifying the initial migration, rollback means recreating the database without the new fields
2. **Code**: Revert git commits
3. **Entities**: Remove system field properties from TypeORM entities

### 10.2 Feature Flags (Optional)

```typescript
const FEATURE_FLAGS = {
    SOFT_DELETE_ENABLED: process.env.SOFT_DELETE_ENABLED === 'true',
    OPTIMISTIC_LOCKING_ENABLED: process.env.OPTIMISTIC_LOCKING_ENABLED === 'true'
}

// In service methods:
if (FEATURE_FLAGS.SOFT_DELETE_ENABLED) {
    await softDelete(...)
} else {
    await knex.delete().where({ id })
}
```

---

## Implementation Checklist

### Phase 1: Platform Level (_upl_*)

- [ ] 1.1 Create `PlatformBaseEntity` abstract class
- [ ] 1.2 Update `1766351182000-CreateMetahubsSchema.ts` migration
- [ ] 1.3 Update `1800000000000-CreateApplicationsSchema.ts` migration
- [ ] 1.4 Update Metahub entity to extend PlatformBaseEntity
- [ ] 1.5 Update MetahubBranch entity
- [ ] 1.6 Update MetahubUser entity
- [ ] 1.7 Update Publication entity
- [ ] 1.8 Update PublicationVersion entity
- [ ] 1.9 Update Application entity
- [ ] 1.10 Update Connector entity
- [ ] 1.11 Update ConnectorPublication entity
- [ ] 1.12 Update ApplicationUser entity
- [ ] 1.13 Create queryHelpers.ts with soft delete utilities
- [ ] 1.14 Add partial unique indexes for codename/slug

### Phase 2: Metahub Level (_mhb_*)

- [ ] 2.1 Update MetahubSchemaService.initSystemTables()
- [ ] 2.2 Update MetahubObjectsService with soft delete
- [ ] 2.3 Update MetahubAttributesService with soft delete
- [ ] 2.4 Update MetahubElementsService with soft delete
- [ ] 2.5 Update MetahubHubsService with soft delete
- [ ] 2.6 Add trash endpoints to catalogsRoutes.ts
- [ ] 2.7 Add trash endpoints to elementsRoutes.ts
- [ ] 2.8 Add trash endpoints to hubsRoutes.ts
- [ ] 2.9 Add trash endpoints to attributesRoutes.ts

### Phase 3: Application Level (_app_*)

- [ ] 3.1 Update SchemaGenerator for application tables
- [ ] 3.2 Create data migration logic from Metahub to Application
- [ ] 3.3 Add application-level soft delete services
- [ ] 3.4 Add trash API routes for applications

### Phase 4: Frontend

- [ ] 4.1 Update TypeScript types for system fields
- [ ] 4.2 Add trash API functions
- [ ] 4.3 Add restore/permanent delete mutation hooks
- [ ] 4.4 Create TrashPanel UI component
- [ ] 4.5 Add i18n translations (en, ru)
- [ ] 4.6 Update menu with Trash link

### Phase 5: Testing & Documentation

- [ ] 5.1 Write unit tests for soft delete operations
- [ ] 5.2 Write unit tests for optimistic locking
- [ ] 5.3 Write integration tests for cascade delete/restore
- [ ] 5.4 Update API documentation
- [ ] 5.5 Update Memory Bank with implementation details

---

## Conclusion

This plan provides a comprehensive three-level system fields architecture that:

1. **Protects user data** through cascading soft deletes
2. **Enables recovery** at multiple levels (user → admin → platform)
3. **Tracks all changes** with full audit trail
4. **Prevents conflicts** with optimistic locking
5. **Maintains data integrity** with partial unique indexes

The implementation is backward-compatible and can be rolled out incrementally.
