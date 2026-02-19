import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Status of schema synchronization for an Application
 * Used when publishing Metahub configuration to Application
 */
export enum ApplicationSchemaStatus {
    /** Draft - schema not yet generated */
    DRAFT = 'draft',
    /** Pending - schema generation requested but not yet applied */
    PENDING = 'pending',
    /** Synced - schema matches the connector metahub configuration */
    SYNCED = 'synced',
    /** Outdated - connector metahub changed, schema needs update */
    OUTDATED = 'outdated',
    /** Error - schema generation/migration failed */
    ERROR = 'error',
    /** Schema update available but not yet applied */
    UPDATE_AVAILABLE = 'update_available',
    /** Schema is being migrated — read-only mode */
    MAINTENANCE = 'maintenance'
}

/**
 * Application entity - represents a standalone application container
 *
 * Applications contain Connectors which connect to data providers (Metahubs).
 * When linked to a Metahub, an Application can have real PostgreSQL tables
 * generated from the Metahub's structure (similar to 1C:Enterprise Information Bases).
 */
@Entity({ name: 'applications', schema: 'applications' })
export class Application {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    /** Localized name using VLC pattern */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** URL-friendly identifier for public access */
    @Column({ type: 'varchar', length: 100, nullable: true })
    slug?: string

    /** Whether this application is publicly accessible via API */
    @Column({ type: 'boolean', default: false, name: 'is_public' })
    isPublic!: boolean

    // ═══════════════════════════════════════════════════════════════════════
    // Schema sync fields (for Metahub → Application publishing)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * PostgreSQL schema name where tables are generated
     * Format: app_{uuid-without-hyphens}
     * Example: app_0190a1b2c3d4e5f6a7b8c9d0e1f2a3b4
     */
    @Column({ name: 'schema_name', type: 'varchar', length: 100, nullable: true })
    schemaName?: string | null

    /** Current schema synchronization status */
    @Column({
        name: 'schema_status',
        type: 'enum',
        enum: ApplicationSchemaStatus,
        enumName: 'application_schema_status',
        default: ApplicationSchemaStatus.DRAFT,
        nullable: true
    })
    schemaStatus?: ApplicationSchemaStatus | null

    /** Error message if schema_status is ERROR */
    @Column({ name: 'schema_error', type: 'text', nullable: true })
    schemaError?: string | null

    /** Timestamp of last successful schema sync */
    @Column({ name: 'schema_synced_at', type: 'timestamptz', nullable: true })
    schemaSyncedAt?: Date | null

    /**
     * Snapshot of metahub structure at last sync (Catalog IDs, Attribute IDs)
     * Used to detect changes and compute migration diff
     */
    @Column({ name: 'schema_snapshot', type: 'jsonb', nullable: true })
    schemaSnapshot?: Record<string, unknown> | null

    /** Current structure version of the application system tables */
    @Column({ name: 'app_structure_version', type: 'integer', nullable: true, default: null })
    appStructureVersion?: number | null

    /** ID of the publication version last synced to this application */
    @Column({ name: 'last_synced_publication_version_id', type: 'uuid', nullable: true })
    lastSyncedPublicationVersionId?: string | null

    // ═══════════════════════════════════════════════════════════════════════════
    // Platform-level system fields (_upl_*)
    // ═══════════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: '_upl_created_at', type: 'timestamptz' })
    _uplCreatedAt!: Date

    @Column({ name: '_upl_created_by', type: 'uuid', nullable: true })
    _uplCreatedBy?: string

    @UpdateDateColumn({ name: '_upl_updated_at', type: 'timestamptz' })
    _uplUpdatedAt!: Date

    @Column({ name: '_upl_updated_by', type: 'uuid', nullable: true })
    _uplUpdatedBy?: string

    @VersionColumn({ name: '_upl_version' })
    _uplVersion!: number

    // Archive fields
    @Column({ name: '_upl_archived', type: 'boolean', default: false })
    _uplArchived!: boolean

    @Column({ name: '_upl_archived_at', type: 'timestamptz', nullable: true })
    _uplArchivedAt?: Date

    @Column({ name: '_upl_archived_by', type: 'uuid', nullable: true })
    _uplArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_upl_deleted', type: 'boolean', default: false })
    _uplDeleted!: boolean

    @Column({ name: '_upl_deleted_at', type: 'timestamptz', nullable: true })
    _uplDeletedAt?: Date

    @Column({ name: '_upl_deleted_by', type: 'uuid', nullable: true })
    _uplDeletedBy?: string

    @Column({ name: '_upl_purge_after', type: 'timestamptz', nullable: true })
    _uplPurgeAfter?: Date

    // Lock fields
    @Column({ name: '_upl_locked', type: 'boolean', default: false })
    _uplLocked!: boolean

    @Column({ name: '_upl_locked_at', type: 'timestamptz', nullable: true })
    _uplLockedAt?: Date

    @Column({ name: '_upl_locked_by', type: 'uuid', nullable: true })
    _uplLockedBy?: string

    @Column({ name: '_upl_locked_reason', type: 'text', nullable: true })
    _uplLockedReason?: string

    // ═══════════════════════════════════════════════════════════════════════════
    // Application-level system fields (_app_*)
    // ═══════════════════════════════════════════════════════════════════════════

    // Publication fields
    @Column({ name: '_app_published', type: 'boolean', default: true })
    _appPublished!: boolean

    @Column({ name: '_app_published_at', type: 'timestamptz', nullable: true })
    _appPublishedAt?: Date

    @Column({ name: '_app_published_by', type: 'uuid', nullable: true })
    _appPublishedBy?: string

    // Archive fields
    @Column({ name: '_app_archived', type: 'boolean', default: false })
    _appArchived!: boolean

    @Column({ name: '_app_archived_at', type: 'timestamptz', nullable: true })
    _appArchivedAt?: Date

    @Column({ name: '_app_archived_by', type: 'uuid', nullable: true })
    _appArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_app_deleted', type: 'boolean', default: false })
    _appDeleted!: boolean

    @Column({ name: '_app_deleted_at', type: 'timestamptz', nullable: true })
    _appDeletedAt?: Date

    @Column({ name: '_app_deleted_by', type: 'uuid', nullable: true })
    _appDeletedBy?: string

    // Access control
    @Column({ name: '_app_owner_id', type: 'uuid', nullable: true })
    _appOwnerId?: string

    @Column({ name: '_app_access_level', type: 'varchar', length: 20, default: 'private' })
    _appAccessLevel!: string
}
