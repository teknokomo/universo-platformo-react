import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    VersionColumn,
    OneToMany
} from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Metahub } from './Metahub'
import { PublicationVersion } from './PublicationVersion'

/**
 * Access mode for Publication API
 */
export enum PublicationAccessMode {
    /** Full access to all Metahub data via API */
    FULL = 'full',
    /** Restricted access based on access_config rules */
    RESTRICTED = 'restricted'
}

/**
 * Schema synchronization status for publications
 */
export enum PublicationSchemaStatus {
    /** Initial state, schema not yet created */
    DRAFT = 'draft',
    /** Schema creation/update in progress */
    PENDING = 'pending',
    /** Schema is synchronized with Metahub configuration */
    SYNCED = 'synced',
    /** Metahub configuration changed, schema needs update */
    OUTDATED = 'outdated',
    /** Schema sync failed */
    ERROR = 'error'
}

/**
 * Publication entity - external interface of a Metahub with API access control.
 *
 * Publications provide controlled access to Metahub data through generated database schemas.
 * Each Publication belongs to exactly one Metahub and can be linked to multiple Applications
 * via Connectors.
 */
@Entity({ name: 'publications', schema: 'metahubs' })
export class Publication {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahubId!: string

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true, default: {} })
    description!: VersionedLocalizedContent<string> | null

    @Column({
        name: 'access_mode',
        type: 'enum',
        enum: PublicationAccessMode,
        enumName: 'publication_access_mode',
        default: PublicationAccessMode.FULL
    })
    accessMode!: PublicationAccessMode

    @Column({ name: 'access_config', type: 'jsonb', nullable: true, default: {} })
    accessConfig!: Record<string, unknown> | null

    @Column({ name: 'schema_name', type: 'varchar', length: 100, nullable: true })
    schemaName!: string | null

    @Column({
        name: 'schema_status',
        type: 'enum',
        enum: PublicationSchemaStatus,
        enumName: 'publication_schema_status',
        default: PublicationSchemaStatus.DRAFT
    })
    schemaStatus!: PublicationSchemaStatus

    @Column({ name: 'schema_error', type: 'text', nullable: true })
    schemaError!: string | null

    @Column({ name: 'schema_synced_at', type: 'timestamptz', nullable: true })
    schemaSyncedAt!: Date | null

    @Column({ name: 'schema_snapshot', type: 'jsonb', nullable: true })
    schemaSnapshot!: Record<string, unknown> | null

    @Column({ name: 'auto_create_application', type: 'boolean', default: false })
    autoCreateApplication!: boolean

    /** Reference to active version */
    @Column({ name: 'active_version_id', type: 'uuid', nullable: true })
    activeVersionId!: string | null

    @OneToMany(() => PublicationVersion, (version) => version.publication)
    versions!: PublicationVersion[]

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
    // Metahub-level system fields (_mhb_*)
    // ═══════════════════════════════════════════════════════════════════════════

    // Publication fields
    @Column({ name: '_mhb_published', type: 'boolean', default: false })
    _mhbPublished!: boolean

    @Column({ name: '_mhb_published_at', type: 'timestamptz', nullable: true })
    _mhbPublishedAt?: Date

    @Column({ name: '_mhb_published_by', type: 'uuid', nullable: true })
    _mhbPublishedBy?: string

    // Archive fields
    @Column({ name: '_mhb_archived', type: 'boolean', default: false })
    _mhbArchived!: boolean

    @Column({ name: '_mhb_archived_at', type: 'timestamptz', nullable: true })
    _mhbArchivedAt?: Date

    @Column({ name: '_mhb_archived_by', type: 'uuid', nullable: true })
    _mhbArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_mhb_deleted', type: 'boolean', default: false })
    _mhbDeleted!: boolean

    @Column({ name: '_mhb_deleted_at', type: 'timestamptz', nullable: true })
    _mhbDeletedAt?: Date

    @Column({ name: '_mhb_deleted_by', type: 'uuid', nullable: true })
    _mhbDeletedBy?: string
}
