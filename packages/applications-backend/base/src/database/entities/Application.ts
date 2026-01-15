import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
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
    @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
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
    @Column({ name: 'schema_name', type: 'varchar', length: 100, unique: true, nullable: true })
    schemaName?: string | null

    /** Current schema synchronization status */
    @Column({
        name: 'schema_status',
        type: 'enum',
        enum: ApplicationSchemaStatus,
        enumName: 'application_schema_status',
        default: ApplicationSchemaStatus.DRAFT,
        nullable: true,
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

    // ═══════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
